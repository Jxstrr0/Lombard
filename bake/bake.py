"""
Headless shop bake. Nobody opens the Blender UI.

    blender --background --factory-startup --python bake/bake.py -- --quality preview|full

Reads bake/layout.json + bake/materials.py and writes, into bake/out/:
  shop_raw.glb        static shop, uv0 = world-metre box projection, uv1 = lightmap
  shop_lightmap.png   diffuse lighting only (direct + indirect, no albedo), sRGB,
                      divided by `lightmapScale` so it fits 8 bits
  shop_bake.json      manifest (quality, size, scale, samples, Blender version)
  preview.jpg         Cycles render from the player's eye (portrait)
  preview-wide.jpg    the same, landscape
scripts/bake-pack.mjs then Draco-compresses the glb, converts the lightmap to
KTX2 and copies everything into public/assets/shop/.

Geometry is generated directly into four meshes, one per material kind
(baked / dynamic / glass / unlit), so the shop costs roughly one draw call per
material. Coordinates in layout.json are three.js (y up); the conversion to
Blender (z up) happens once here, and the glTF exporter converts back.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import random
import sys
import time
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from materials import MATERIALS, hex_to_linear, validate  # noqa: E402

QUALITY = {
    # lightmap px, bake samples, island margin px, preview samples
    "preview": {"size": 512, "samples": 96, "margin": 3, "preview_samples": 48},
    "full": {"size": 2048, "samples": 768, "margin": 6, "preview_samples": 192},
}

# three.js (x, y, z) -> Blender (x, -z, y)
THREE_TO_BLENDER = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))


def log(msg: str) -> None:
    print(f"[bake] {msg}", flush=True)


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--quality", choices=QUALITY.keys(), default="preview")
    p.add_argument("--out", default=str(HERE / "out"))
    p.add_argument("--no-bake", action="store_true", help="geometry + export only (fast check)")
    p.add_argument("--no-preview", action="store_true")
    p.add_argument("--threads", type=int, default=0)
    p.add_argument("--layout", default=str(HERE / "layout.json"), help="alternative layout (experiments)")
    return p.parse_args(argv)


# ---------------------------------------------------------------------------
# Transforms


def euler_three(deg: list[float]) -> Matrix:
    """three.js Euler 'XYZ' (matrix = Rx * Ry * Rz)."""
    x, y, z = (math.radians(a) for a in deg)
    return Matrix.Rotation(x, 4, "X") @ Matrix.Rotation(y, 4, "Y") @ Matrix.Rotation(z, 4, "Z")


def trs(pos: list[float], rot: list[float] | None, scale: Vector | None = None) -> Matrix:
    m = Matrix.Translation(Vector(pos)) @ euler_three(rot or [0, 0, 0])
    if scale is not None:
        m = m @ Matrix.Diagonal((*scale, 1.0))
    return m


# ---------------------------------------------------------------------------
# Primitives, built in three.js local space (y up) into a bmesh


def add_box(bm: bmesh.types.BMesh, size: list[float], m: Matrix, mat: int) -> None:
    w, h, d = size
    hw, hh, hd = w / 2, h / 2, d / 2
    corners = [Vector((x, y, z)) for x in (-hw, hw) for y in (-hh, hh) for z in (-hd, hd)]
    verts = [bm.verts.new(m @ c) for c in corners]
    # index = xi*4 + yi*2 + zi
    faces = [
        (0, 1, 3, 2),  # -x
        (4, 6, 7, 5),  # +x
        (0, 4, 5, 1),  # -y
        (2, 3, 7, 6),  # +y
        (0, 2, 6, 4),  # -z
        (1, 5, 7, 3),  # +z
    ]
    for f in faces:
        face = bm.faces.new([verts[i] for i in f])
        face.material_index = mat


def add_lathe(bm, rings: list[tuple[float, float]], segments: int, m: Matrix, mat: int, cap_bottom: bool, cap_top: bool, smooth: bool) -> None:
    """Surface of revolution around local y. rings = [(radius, y), ...] bottom to top."""
    grid = []
    for r, y in rings:
        row = []
        for s in range(segments):
            a = 2 * math.pi * s / segments
            row.append(bm.verts.new(m @ Vector((r * math.sin(a), y, r * math.cos(a)))))
        grid.append(row)
    for i in range(len(grid) - 1):
        lo, hi = grid[i], grid[i + 1]
        for s in range(segments):
            t = (s + 1) % segments
            quad = [lo[s], lo[t], hi[t], hi[s]]
            # collapse degenerate quads at poles
            uniq = []
            for v in quad:
                if all((v.co - u.co).length > 1e-7 for u in uniq):
                    uniq.append(v)
            if len(uniq) < 3:
                continue
            try:
                face = bm.faces.new(uniq)
            except ValueError:
                continue
            face.material_index = mat
            face.smooth = smooth
    if cap_bottom and rings[0][0] > 0:
        face = bm.faces.new(list(reversed(grid[0])))
        face.material_index = mat
    if cap_top and rings[-1][0] > 0:
        face = bm.faces.new(grid[-1])
        face.material_index = mat


def add_torus(bm, radius: float, tube: float, m: Matrix, mat: int, radial: int = 10, tubular: int = 24) -> None:
    """three.js TorusGeometry: ring in the local xy plane."""
    grid = []
    for j in range(tubular):
        u = 2 * math.pi * j / tubular
        row = []
        for i in range(radial):
            v = 2 * math.pi * i / radial
            cx = (radius + tube * math.cos(v)) * math.cos(u)
            cy = (radius + tube * math.cos(v)) * math.sin(u)
            cz = tube * math.sin(v)
            row.append(bm.verts.new(m @ Vector((cx, cy, cz))))
        grid.append(row)
    for j in range(tubular):
        a, b = grid[j], grid[(j + 1) % tubular]
        for i in range(radial):
            k = (i + 1) % radial
            face = bm.faces.new([a[i], b[i], b[k], a[k]])
            face.material_index = mat
            face.smooth = True


def add_shape(bm, obj: dict, m: Matrix, mat: int) -> None:
    shape = obj["shape"]
    seg = obj.get("segments", 24)
    if shape == "box":
        add_box(bm, obj["size"], m, mat)
    elif shape == "cylinder":
        r0 = obj["radius"]
        r1 = obj.get("radiusTop", r0)
        h = obj["height"]
        add_lathe(bm, [(r0, -h / 2), (r1, h / 2)], seg, m, mat, True, True, True)
    elif shape == "cone":
        h = obj["height"]
        add_lathe(bm, [(obj["radius"], -h / 2), (0.0, h / 2)], seg, m, mat, not obj.get("openEnded", False), False, True)
    elif shape == "sphere":
        r = obj["radius"]
        rings = [(r * math.sin(math.pi * i / 8), -r * math.cos(math.pi * i / 8)) for i in range(9)]
        add_lathe(bm, rings, 12, m, mat, False, False, True)
    elif shape == "torus":
        add_torus(bm, obj["radius"], obj["tube"], m, mat)
    else:
        raise ValueError(f"{obj['name']}: unknown shape {shape}")


# ---------------------------------------------------------------------------
# Layout walk


class Builder:
    """Accumulates geometry per material kind."""

    def __init__(self, seed: int, room: dict):
        self.seed = seed
        self.room = room
        self.kinds = {k: {"bm": bmesh.new(), "mats": []} for k in ("baked", "dynamic", "glass", "unlit")}
        self.names: set[str] = set()

    def mat_index(self, name: str) -> tuple[bmesh.types.BMesh, int]:
        if name not in MATERIALS:
            raise ValueError(f"unknown material '{name}' (add it to bake/materials.py)")
        k = self.kinds[MATERIALS[name]["kind"]]
        if name not in k["mats"]:
            k["mats"].append(name)
        return k["bm"], k["mats"].index(name)

    def jitter(self, name: str, spec: dict | None) -> tuple[Vector, float]:
        if not spec:
            return Vector((0, 0, 0)), 0.0
        rng = random.Random(f"{self.seed}:{name}")
        p = spec.get("position", 0.0)
        return Vector((rng.uniform(-p, p), 0.0, rng.uniform(-p, p))), rng.uniform(-1, 1) * spec.get("yaw", 0.0)

    def walk(self, obj: dict, parent: Matrix) -> None:
        name = obj["name"]
        if name in self.names:
            raise ValueError(f"duplicate object name '{name}'")
        self.names.add(name)
        if "children" in obj:
            m = parent @ trs(obj.get("position", [0, 0, 0]), obj.get("rotation"))
            for child in obj["children"]:
                self.walk(child, m)
            return
        rep = obj.get("repeat", {"count": 1, "step": [0, 0, 0]})
        mats = rep.get("materials")
        heights = rep.get("heights")
        base = Vector(obj.get("position", [0, 0, 0]))
        for i in range(rep["count"]):
            o = dict(obj)
            pos = base + Vector(rep["step"]) * i
            if heights:
                size = list(obj["size"])
                bottom = base.y - size[1] / 2
                size[1] = heights[i % len(heights)]
                pos.y = bottom + size[1] / 2 + rep["step"][1] * i
                o["size"] = size
            dpos, dyaw = self.jitter(f"{name}#{i}", obj.get("jitter"))
            pos = pos + dpos
            m = parent @ Matrix.Translation(pos) @ Matrix.Rotation(math.radians(dyaw), 4, "Y") @ euler_three(obj.get("rotation") or [0, 0, 0])
            bm, idx = self.mat_index(mats[i % len(mats)] if mats else obj["material"])
            add_shape(bm, o, THREE_TO_BLENDER @ m, idx)


def cull_hidden_faces(bm: bmesh.types.BMesh, room: dict) -> int:
    """Drop faces nobody can see: outside the room shell (and its annexes, e.g.
    the back room), or face-down on the floor."""
    hw, hd, h = room["halfW"], room["halfD"], room["height"]
    eps = 0.002
    # annex boxes in three.js coords: min/max [x, y, z]
    annexes = [(a["min"], a["max"]) for a in room.get("annexes", [])]

    def in_annex(x: float, y: float, z: float) -> bool:
        return any(lo[0] - eps <= x <= hi[0] + eps and lo[1] - eps <= y <= hi[1] + eps and lo[2] - eps <= z <= hi[2] + eps for lo, hi in annexes)

    gone = []
    for f in bm.faces:
        c = f.calc_center_median()  # Blender coords: x, y = -z_three, z = y_three
        in_main = abs(c.x) <= hw + eps and abs(c.y) <= hd + eps and -eps <= c.z <= h + eps
        outside = not in_main and not in_annex(c.x, c.z, -c.y)
        under = c.z < eps and f.normal.z < -0.9
        if outside or under:
            gone.append(f)
    bmesh.ops.delete(bm, geom=gone, context="FACES")
    return len(gone)


def box_project_uv(bm: bmesh.types.BMesh, layer) -> None:
    """uv0 in world metres from the dominant face axis (tiling textures)."""
    for f in bm.faces:
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for loop in f.loops:
            co = loop.vert.co
            if ax == 2:
                uv = (co.x, co.y)
            elif ax == 0:
                uv = (-co.y if n.x > 0 else co.y, co.z)
            else:
                uv = (co.x if n.y > 0 else -co.x, co.z)
            loop[layer].uv = uv


# ---------------------------------------------------------------------------
# Blender scene


def make_material(name: str, for_render: bool) -> bpy.types.Material:
    spec = MATERIALS[name]
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    r, g, b = hex_to_linear(spec["color"])
    bsdf.inputs["Base Color"].default_value = (r, g, b, 1)
    bsdf.inputs["Roughness"].default_value = spec.get("roughness", 0.5)
    bsdf.inputs["Metallic"].default_value = spec.get("metalness", 0.0)
    kind = spec["kind"]
    if kind == "glass":
        bsdf.inputs["Transmission Weight"].default_value = 1.0
        bsdf.inputs["IOR"].default_value = 1.5
    if kind == "unlit" and spec.get("emissive"):
        bsdf.inputs["Emission Color"].default_value = (r, g, b, 1)
        bsdf.inputs["Emission Strength"].default_value = 30.0
    if name == "door_glass":
        bsdf.inputs["Transmission Weight"].default_value = 1.0
    if spec.get("doubleSided"):
        mat.use_backface_culling = False
    # Exported as glTF material extras; the game reads these.
    mat["kind"] = kind
    if "runtime" in spec:
        mat["runtime"] = spec["runtime"]
    if "opacity" in spec:
        mat["opacity"] = spec["opacity"]
    if spec.get("doubleSided"):
        mat["doubleSided"] = True
    return mat


def kelvin_node(nt, kelvin: float):
    bb = nt.nodes.new("ShaderNodeBlackbody")
    bb.inputs["Temperature"].default_value = kelvin
    return bb


def add_lights(layout: dict) -> None:
    for spec in layout["lights"]:
        pos = THREE_TO_BLENDER @ Vector(spec["position"])
        t = spec["type"]
        if t == "portal":
            data = bpy.data.lights.new(spec["name"], "AREA")
            data.shape = "RECTANGLE"
            data.size, data.size_y = spec["size"]
            data.cycles.is_portal = True
            ob = bpy.data.objects.new(spec["name"], data)
            ob.location = pos
            # area lights emit along local -Z; portals must face into the room (three -z = Blender +y)
            ob.rotation_euler = (math.radians(-90), 0, 0)
        else:
            data = bpy.data.lights.new(spec["name"], "POINT" if t == "point" else "SPOT")
            data.energy = spec["power"]
            data.shadow_soft_size = spec.get("radius", 0.05)
            data.use_nodes = True
            nt = data.node_tree
            emission = nt.nodes["Emission"]
            nt.links.new(kelvin_node(nt, spec["kelvin"]).outputs["Color"], emission.inputs["Color"])
            if t == "spot":
                data.spot_size = math.radians(spec.get("spotSize", 90))
                data.spot_blend = spec.get("spotBlend", 0.5)
            ob = bpy.data.objects.new(spec["name"], data)
            ob.location = pos
            if "target" in spec:
                direction = (THREE_TO_BLENDER @ Vector(spec["target"])) - pos
                ob.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
        bpy.context.scene.collection.objects.link(ob)


def setup_world(layout: dict) -> None:
    world = bpy.data.worlds.new("sky")
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    r, g, b = hex_to_linear(layout["world"]["color"])
    bg.inputs["Color"].default_value = (r, g, b, 1)
    bg.inputs["Strength"].default_value = layout["world"]["strength"]
    bpy.context.scene.world = world


def build_objects(layout: dict) -> dict[str, bpy.types.Object]:
    b = Builder(layout["seed"], layout["room"])
    for obj in layout["objects"]:
        b.walk(obj, Matrix.Identity(4))
    out = {}
    for kind, k in b.kinds.items():
        bm = k["bm"]
        if not bm.faces:
            bm.free()
            continue
        culled = cull_hidden_faces(bm, layout["room"])
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
        bm.normal_update()
        uv0 = bm.loops.layers.uv.new("uv0")
        box_project_uv(bm, uv0)
        mesh = bpy.data.meshes.new(f"shop_{kind}")
        bm.to_mesh(mesh)
        bm.free()
        for name in k["mats"]:
            mesh.materials.append(make_material(name, True))
        ob = bpy.data.objects.new(f"shop_{kind}", mesh)
        ob["kind"] = kind
        bpy.context.scene.collection.objects.link(ob)
        out[kind] = ob
        log(f"{ob.name}: {len(mesh.polygons)} faces, {len(k['mats'])} materials, {culled} hidden faces culled")
    return out


def select_only(ob: bpy.types.Object) -> None:
    for o in bpy.context.scene.objects:
        o.select_set(False)
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob


def lightmap_unwrap(ob: bpy.types.Object, size: int, margin_px: int) -> None:
    mesh = ob.data
    lm = mesh.uv_layers.new(name="lightmap")
    mesh.uv_layers.active = lm
    select_only(ob)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.0, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
    bpy.ops.uv.pack_islands(rotate=True, scale=True, margin_method="FRACTION", margin=margin_px / size)
    bpy.ops.object.mode_set(mode="OBJECT")


def configure_cycles(samples: int, threads: int) -> None:
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = samples
    scene.cycles.use_adaptive_sampling = False
    scene.cycles.max_bounces = 6
    scene.cycles.diffuse_bounces = 4
    scene.cycles.glossy_bounces = 2
    scene.cycles.transmission_bounces = 4
    scene.cycles.seed = 1907
    if threads:
        scene.render.threads_mode = "FIXED"
        scene.render.threads = threads


def bake_lightmap(ob: bpy.types.Object, hidden: list[bpy.types.Object], q: dict, out: Path) -> float:
    size = q["size"]
    img = bpy.data.images.new("lightmap", size, size, alpha=False, float_buffer=True)
    for mat in ob.data.materials:
        nt = mat.node_tree
        uv = nt.nodes.new("ShaderNodeUVMap")
        uv.uv_map = "lightmap"
        node = nt.nodes.new("ShaderNodeTexImage")
        node.image = img
        node.name = "lightmap_target"
        nt.links.new(uv.outputs["UV"], node.inputs["Vector"])
        nt.nodes.active = node
    for o in hidden:
        o.hide_render = True
    scene = bpy.context.scene
    scene.render.bake.use_pass_direct = True
    scene.render.bake.use_pass_indirect = True
    scene.render.bake.use_pass_color = False
    scene.render.bake.margin = q["margin"] * 2
    scene.render.bake.margin_type = "EXTEND"
    scene.render.bake.target = "IMAGE_TEXTURES"
    select_only(ob)
    t0 = time.time()
    bpy.ops.object.bake(type="DIFFUSE", pass_filter={"DIRECT", "INDIRECT"}, use_clear=True)
    log(f"baked {size}px x {q['samples']} samples in {time.time() - t0:.0f}s")
    for o in hidden:
        o.hide_render = False
    for mat in ob.data.materials:
        nt = mat.node_tree
        for n in [n for n in nt.nodes if n.name == "lightmap_target" or n.bl_idname == "ShaderNodeUVMap"]:
            nt.nodes.remove(n)

    raw = out / "lightmap_raw.exr"
    img.filepath_raw = str(raw)
    img.file_format = "OPEN_EXR"
    img.save()
    denoised = denoise(raw, size, out)
    return encode_png(denoised, out / "shop_lightmap.png", size)


def denoise(raw: Path, size: int, out: Path) -> np.ndarray:
    """OpenImageDenoise through the compositor, in a throwaway scene."""
    src = bpy.data.images.load(str(raw))
    scene = bpy.data.scenes.new("denoise")
    cam = bpy.data.objects.new("denoise_cam", bpy.data.cameras.new("denoise_cam"))
    scene.collection.objects.link(cam)
    scene.camera = cam
    scene.render.resolution_x = size
    scene.render.resolution_y = size
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "OPEN_EXR"
    scene.render.image_settings.color_depth = "32"
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0
    scene.view_settings.gamma = 1
    scene.render.use_compositing = True
    scene.use_nodes = True
    nt = scene.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    image_node = nt.nodes.new("CompositorNodeImage")
    image_node.image = src
    dn = nt.nodes.new("CompositorNodeDenoise")
    dn.use_hdr = True
    dn.prefilter = "ACCURATE"
    comp = nt.nodes.new("CompositorNodeComposite")
    nt.links.new(image_node.outputs["Image"], dn.inputs["Image"])
    nt.links.new(dn.outputs["Image"], comp.inputs["Image"])
    target = out / "lightmap_denoised.exr"
    scene.render.filepath = str(target)
    t0 = time.time()
    bpy.ops.render.render(write_still=True, scene=scene.name)
    log(f"denoised in {time.time() - t0:.1f}s")
    res = bpy.data.images.load(str(target))
    px = np.empty(size * size * 4, dtype=np.float32)
    res.pixels.foreach_get(px)
    bpy.data.scenes.remove(scene)
    return px.reshape(size, size, 4)[:, :, :3]


def encode_png(rgb: np.ndarray, path: Path, size: int) -> float:
    """Scale linear lighting into 0..1, sRGB-encode, save 8-bit PNG. Returns the scale."""
    rgb = np.clip(rgb, 0, None)
    lum = rgb.max(axis=2)
    lit = lum[lum > 1e-4]
    peak = float(np.percentile(lit, 99.7)) if lit.size else 1.0
    scale = max(0.25, math.ceil(peak / 0.95 * 4) / 4)  # round up to a quarter
    v = np.clip(rgb / scale, 0, 1)
    srgb = np.where(v <= 0.0031308, v * 12.92, 1.055 * np.power(v, 1 / 2.4) - 0.055)
    rgba = np.concatenate([srgb, np.ones((size, size, 1), dtype=np.float32)], axis=2)
    img = bpy.data.images.new("lightmap_png", size, size, alpha=False, float_buffer=False)
    img.colorspace_settings.name = "sRGB"
    img.pixels.foreach_set(rgba.astype(np.float32).ravel())
    img.filepath_raw = str(path)
    img.file_format = "PNG"
    img.save()
    log(f"lightmap peak {peak:.3f}, scale {scale}")
    return scale


def render_previews(layout: dict, samples: int, out: Path) -> None:
    scene = bpy.context.scene
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.cycles.denoiser = "OPENIMAGEDENOISE"
    scene.view_settings.view_transform = "AgX"
    # three's ACES tone mapping multiplies by exposure / 0.6; match its brightness (2^0.74 = 1/0.6).
    scene.view_settings.exposure = 0.74
    # JPEG keeps each committed preview ~150 KB instead of ~1 MB.
    scene.render.image_settings.file_format = "JPEG"
    scene.render.image_settings.quality = 88
    scene.render.resolution_percentage = 100
    for spec in layout["cameras"]:
        cam_data = bpy.data.cameras.new(spec["name"])
        cam_data.sensor_fit = "VERTICAL"
        cam_data.angle_y = math.radians(spec["verticalFov"])
        cam = bpy.data.objects.new(spec["name"], cam_data)
        pos = THREE_TO_BLENDER @ Vector(spec["position"])
        cam.location = pos
        cam.rotation_euler = ((THREE_TO_BLENDER @ Vector(spec["target"])) - pos).to_track_quat("-Z", "Y").to_euler()
        scene.collection.objects.link(cam)
        scene.camera = cam
        scene.render.resolution_x = spec["width"]
        scene.render.resolution_y = spec["height"]
        scene.render.filepath = str(out / f"{spec['name']}.jpg")
        t0 = time.time()
        bpy.ops.render.render(write_still=True)
        log(f"rendered {spec['name']} in {time.time() - t0:.0f}s")


def export_glb(path: Path) -> None:
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=False,
        export_extras=True,
        export_texcoords=True,
        export_normals=True,
        export_tangents=False,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        export_yup=True,
        export_apply=False,
        export_draco_mesh_compression_enable=False,
    )


def input_hash() -> str:
    h = hashlib.sha256()
    # Same files, same order as the bake workflow's "Decide whether to bake" step.
    for p in (HERE / "layout.json", HERE / "materials.py", HERE / "bake.py", HERE.parent / "scripts" / "bake-pack.mjs"):
        h.update(p.read_bytes())
    return h.hexdigest()[:16]


def main() -> None:
    args = parse_args()
    q = QUALITY[args.quality]
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    validate()
    layout = json.loads(Path(args.layout).read_text())

    bpy.ops.wm.read_factory_settings(use_empty=True)
    setup_world(layout)
    add_lights(layout)
    objs = build_objects(layout)
    configure_cycles(q["samples"], args.threads)

    scale = 1.0
    baked = objs["baked"]
    lightmap_unwrap(baked, q["size"], q["margin"])
    if not args.no_bake:
        hidden = [objs[k] for k in ("glass", "unlit") if k in objs]
        scale = bake_lightmap(baked, hidden, q, out)
    if not args.no_preview:
        render_previews(layout, q["preview_samples"], out)

    # uv0 first (TEXCOORD_0), lightmap second (TEXCOORD_1)
    baked.data.uv_layers.active_index = 0
    baked.data.uv_layers[0].active_render = True
    export_glb(out / "shop_raw.glb")
    manifest = {
        "version": layout["version"],
        "quality": args.quality,
        "lightmapSize": q["size"],
        "lightmapScale": scale,
        "samples": q["samples"],
        "blender": bpy.app.version_string,
        "inputHash": os.environ.get("BAKE_INPUT_HASH") or input_hash(),
        "baked": not args.no_bake,
    }
    (out / "shop_bake.json").write_text(json.dumps(manifest, indent=2) + "\n")
    for tmp in ("lightmap_raw.exr", "lightmap_denoised.exr"):
        (out / tmp).unlink(missing_ok=True)
    log(f"done: {json.dumps(manifest)}")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        import traceback

        traceback.print_exc()
        sys.exit(1)
