"""
CC0 item models from Poly Haven (docs/04-ASSETS.md § Items, M6 wave A). Nobody opens the Blender UI.

    ~/blender/blender --background --factory-startup --python art/items/cc0.py -- [--only id,id] [--preview]

For every entry in art/items/cc0.json (keyed by item def id): downloads the
Poly Haven 1k glTF (CC0) into art/out/cc0/<asset>/, keeps the listed parts,
joins them, turns them into three.js item coordinates (metres, centred at the
origin, +Y up, front +Z; in Blender that is Z up, front -Y, and `rot` turns a
model that faces elsewhere), rescales it (`size`: its largest side in metres),
decimates it to `tris`, drops glass and flames (no per-item transparency),
optional `tint` multiplies a material's colour (a brass model retinted silver),
keeps the base colour, normal and metal/roughness maps at `tex` px, and writes:
  art/out/items/<id>.glb    raw model; scripts/items-pack.mjs Draco/KTX2s it
  art/out/items/<id>.json   triangles, materials, bounds and resolved hotspots
  art/out/items/<id>.png    (--preview) workbench render, front and side

Hotspots: `hotspots` maps an id to a ray in item coordinates ({"from": [x,y,z],
"dir": [dx,dy,dz]}); the first surface hit is written to <id>.json, from where
it is copied into the def's model.hotspots. The def's placeholder is "block"
(a box of `model.size` shown while the glb loads); the game raycasts the glb
itself for these models, since they are a few thousand triangles.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
import urllib.request
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
SPECS = HERE / "cc0.json"


def log(msg: str) -> None:
    print(f"[cc0] {msg}", flush=True)


def fetch(asset: str, cache: Path) -> Path:
    d = cache / asset
    gltf = d / f"{asset}_1k.gltf"
    if gltf.exists():
        return gltf
    d.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(f"https://api.polyhaven.com/files/{asset}", headers={"User-Agent": "lombard-asset-prep"})
    files = json.loads(urllib.request.urlopen(req, timeout=60).read())["gltf"]["1k"]["gltf"]
    todo = [(gltf, files["url"])] + [(d / rel, f["url"]) for rel, f in files.get("include", {}).items()]
    for path, url in todo:
        path.parent.mkdir(parents=True, exist_ok=True)
        log(f"downloading {url}")
        r = urllib.request.Request(url, headers={"User-Agent": "lombard-asset-prep"})
        path.write_bytes(urllib.request.urlopen(r, timeout=120).read())
    return gltf


def three_to_blender(v) -> Vector:
    x, y, z = v
    return Vector((x, -z, y))


def blender_to_three(v: Vector) -> list[float]:
    return [round(v.x, 4), round(v.z, 4), round(-v.y, 4)]


def prepare(item_id: str, spec: dict, cache: Path, out: Path, tmp: Path, preview: bool) -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    gltf = fetch(spec["src"], cache)
    bpy.ops.import_scene.gltf(filepath=str(gltf))
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    if spec.get("keep"):
        meshes = [o for o in meshes if any(re.search(k, o.name) for k in spec["keep"])]
    if spec.get("drop"):
        meshes = [o for o in meshes if not any(re.search(k, o.name) for k in spec["drop"])]
    if not meshes:
        raise RuntimeError(f"{item_id}: nothing to keep")
    for o in bpy.context.scene.objects:
        o.select_set(False)
    for o in meshes:
        o.data = o.data.copy()
        o.data.transform(o.matrix_world)
        o.parent = None
        o.matrix_world = Matrix.Identity(4)
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    for o in list(bpy.context.scene.objects):
        if o is not ob:
            bpy.data.objects.remove(o, do_unlink=True)
    me = ob.data
    if me.shape_keys:
        ob.shape_key_clear()
    while len(me.uv_layers) > 1:
        me.uv_layers.remove(me.uv_layers[-1])
    for attr in list(me.color_attributes):
        me.color_attributes.remove(attr)
    rot = spec.get("rot", [0, 0, 0])
    me.transform(Matrix.Rotation(math.radians(rot[2]), 4, "Z") @ Matrix.Rotation(math.radians(rot[1]), 4, "Y") @ Matrix.Rotation(math.radians(rot[0]), 4, "X"))
    # drop glass, lenses and flames before measuring (a lamp chimney, a clock's glass)
    glass = {i for i, m in enumerate(me.materials) if m and re.search(r"glass|lens|flame|fire", m.name.lower())}
    glass |= {i for i, m in enumerate(me.materials) if m and any(re.search(k, m.name) for k in spec.get("dropMaterials", []))}
    if glass:
        bm = bmesh.new()
        bm.from_mesh(me)
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index in glass], context="FACES")
        bm.to_mesh(me)
        bm.free()
    co = [v.co for v in me.vertices]
    lo = Vector((min(c.x for c in co), min(c.y for c in co), min(c.z for c in co)))
    hi = Vector((max(c.x for c in co), max(c.y for c in co), max(c.z for c in co)))
    me.transform(Matrix.Translation(-(lo + hi) / 2))
    if spec.get("size"):
        me.transform(Matrix.Scale(spec["size"] / max(hi - lo), 4))
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    tris = len(me.polygons)
    if tris > spec["tris"]:
        mod = ob.modifiers.new("decimate", "DECIMATE")
        mod.ratio = spec["tris"] / tris
        mod.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=mod.name)
    # unused slots out; textures resized and saved as PNG (items-pack turns PNGs into KTX2)
    used = {p.material_index for p in me.polygons}
    for i in sorted(range(len(me.materials)), reverse=True):
        if i not in used:
            ob.active_material_index = i
            bpy.ops.object.material_slot_remove()
    tint = spec.get("tint", {})
    done: set[str] = set()
    for mi, mat in enumerate(me.materials):
        if not mat or not mat.use_nodes:
            continue
        bsdf = next((n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
        for name, t in tint.items():
            if bsdf and re.search(name, mat.name):
                # multiply the base colour texture by a tint (MixRGB multiply in front of Base Color)
                links = bsdf.inputs["Base Color"].links
                mix = mat.node_tree.nodes.new("ShaderNodeMix")
                mix.data_type = "RGBA"
                mix.blend_type = "MULTIPLY"
                mix.inputs["Factor"].default_value = 1.0
                mix.inputs[7].default_value = (*t[:3], 1.0)
                if links:
                    mat.node_tree.links.new(links[0].from_socket, mix.inputs[6])
                else:
                    mix.inputs[6].default_value = bsdf.inputs["Base Color"].default_value
                mat.node_tree.links.new(mix.outputs[2], bsdf.inputs["Base Color"])
                if len(t) > 3:
                    bsdf.inputs["Metallic"].default_value = t[3]
        for n in mat.node_tree.nodes:
            if n.type == "TEX_IMAGE" and n.image and n.image.name not in done:
                img = n.image
                done.add(img.name)
                # colour at `tex`; normal and metal/roughness maps at half that (they are UASTC, 4x the bytes)
                px = spec.get("tex", 512) if "diff" in img.name or "col" in img.name.lower() else spec.get("tex", 512) // 2
                img.scale(px, px)
                p = tmp / f"{item_id}_{len(done)}.png"
                img.filepath_raw = str(p)
                img.file_format = "PNG"
                img.save()
    # hotspots: first surface hit along each ray (item coordinates)
    bpy.context.view_layer.update()
    resolved = []
    r = max(ob.dimensions)
    for hid, h in spec.get("hotspots", {}).items():
        if "view" in h:
            # a point picked on a 256 px preview view (`--preview`, ortho scale 1.15 × the largest side)
            a = (h["px"][0] / 256 - 0.5) * 1.15 * r
            b = (0.5 - h["px"][1] / 256) * 1.15 * r
            v = h["view"]
            if v == "front":
                frm, dr = [a, b, 2 * r], [0, 0, -1]
            elif v == "back":
                frm, dr = [a, b, -2 * r], [0, 0, 1]
            elif v == "right":
                frm, dr = [2 * r, b, -a], [-1, 0, 0]
            elif v == "top":
                frm, dr = [a, 2 * r, -b], [0, -1, 0]
            else:  # bottom, picked on the top view
                frm, dr = [a, -2 * r, -b], [0, 1, 0]
        else:
            frm, dr = h["from"], h["dir"]
        origin = three_to_blender(frm)
        d = three_to_blender(dr).normalized()
        ok, loc, _n, _i = ob.ray_cast(origin, d)
        # a picked point just off a thin part: try rings of nearby rays, nearest first (up to 6% of the size)
        side = d.orthogonal().normalized()
        up = d.cross(side).normalized()
        step = 0
        while not ok and step < 12:
            step += 1
            for k in range(12):
                ang = k * math.pi / 6
                off = (side * math.cos(ang) + up * math.sin(ang)) * (r * 0.005 * step)
                ok, loc, _n, _i = ob.ray_cast(origin + off, d)
                if ok:
                    break
        if not ok:
            log(f"WARNING {item_id}/{hid}: ray missed")
            continue
        resolved.append({"id": hid, "position": blender_to_three(loc)})
    co = [v.co for v in me.vertices]
    lo = Vector((min(c.x for c in co), min(c.y for c in co), min(c.z for c in co)))
    hi = Vector((max(c.x for c in co), max(c.y for c in co), max(c.z for c in co)))
    out.mkdir(parents=True, exist_ok=True)
    path = out / f"{item_id}.glb"
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        export_texcoords=True,
        export_normals=True,
        export_tangents=False,
        export_materials="EXPORT",
        export_image_format="AUTO",
        export_cameras=False,
        export_lights=False,
        export_yup=True,
        export_apply=True,
    )
    size3 = [round(hi.x - lo.x, 4), round(hi.z - lo.z, 4), round(hi.y - lo.y, 4)]
    stats = {"id": item_id, "src": spec["src"], "tris": len(me.polygons), "materials": len(me.materials), "size": size3, "hotspots": resolved}
    (out / f"{item_id}.json").write_text(json.dumps(stats, indent=1))
    log(f"{path.name}: {len(me.polygons)} tris (from {tris}), {len(me.materials)} materials, size {size3} m, {path.stat().st_size // 1024} KB")
    if preview:
        render_preview(ob, out / f"{item_id}.png", resolved)


def render_preview(ob, path: Path, hotspots: list) -> None:
    s = bpy.context.scene
    # Cycles on the CPU (headless machines have no GL for workbench/Eevee)
    s.render.engine = "CYCLES"
    s.cycles.samples = 16
    s.cycles.use_denoising = False
    s.render.resolution_x = 768
    s.render.resolution_y = 384
    world = bpy.data.worlds.new("w")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.8, 0.8, 0.8, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 1.2
    s.world = world
    for h in hotspots:
        bpy.ops.mesh.primitive_uv_sphere_add(radius=max(ob.dimensions) * 0.015, location=three_to_blender(h["position"]))
        bead = bpy.context.active_object
        m = bpy.data.materials.new("bead")
        m.diffuse_color = (1, 0.2, 0.6, 1)
        bead.data.materials.append(m)
    # three orthographic views in three.js terms: front (+Z), right (+X), top (+Y)
    r = max(ob.dimensions)
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = r * 1.15
    s.collection.objects.link(cam)
    s.camera = cam
    s.render.resolution_x = 512
    s.render.resolution_y = 512
    views = {
        "front": ((0, -r * 4, 0), (math.radians(90), 0, 0)),
        "right": ((r * 4, 0, 0), (math.radians(90), 0, math.radians(90))),
        "top": ((0, 0, r * 4), (0, 0, 0)),
    }
    for name, (loc, rot) in views.items():
        cam.location = loc
        cam.rotation_euler = rot
        s.render.filepath = str(path.with_name(f"{path.stem}_{name}.png"))
        bpy.ops.render.render(write_still=True)


def main() -> None:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--only", default="")
    p.add_argument("--preview", action="store_true")
    p.add_argument("--cache", default=str(ROOT / "art" / "out" / "cc0"))
    p.add_argument("--out", default=str(ROOT / "art" / "out" / "items"))
    args = p.parse_args(argv)
    only = {s for s in args.only.split(",") if s}
    cache = Path(args.cache)
    tmp = cache / "_textures"
    tmp.mkdir(parents=True, exist_ok=True)
    specs = json.loads(SPECS.read_text())
    for item_id, spec in specs.items():
        if item_id.startswith("_") or (only and item_id not in only):
            continue
        prepare(item_id, spec, cache, Path(args.out), tmp, args.preview)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        import traceback

        traceback.print_exc()
        sys.exit(1)
