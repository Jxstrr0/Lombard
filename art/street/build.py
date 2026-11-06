"""
Street life outside the shop window: sprite sheets and the canal's extra
layers, rendered headless in Blender. Nobody opens the Blender UI.

    ~/blender/blender --background --factory-startup --python art/street/build.py -- [--only people,props,canal] [--samples 48]
    npm run street:pack

Everything is seeded and made here; the only third-party content is the
Rocketbox cast (public/assets/customers/*.glb, MIT, see ATTRIBUTION.md).

Writes into art/out/street/ (git-ignored):
  people_dry.png   8 passers-by x 8 frames of the walk clip, side-on, 128x256 px per frame
  people_rain.png  the same 8 people holding an umbrella (left arm on IK)
  props.png        cars, a minibus, a bus, a canal tour boat, pigeon frames
  canal_extra.png  640x336 data texture over the canal render:
                   R = depth (three.js z, see DEPTH), 255 = sky
                   G = night light from lamps, shop fronts and windows lit by day
                   B = windows that light up early at dusk, A = windows that light up late
                   (G/B/A store sqrt of the tone-mapped light, rows bottom-up)
  street.json      atlas cells with their size in metres
and art/street/preview.jpg (committed, for review on GitHub).

Sprites are rendered under the canal render's own overcast sky (art/backdrop/build.py
setup_world) with an orthographic camera looking along three.js +z (the player's view
direction), so they are lit like the backdrop, and developed with its ACES curve and
exposure. Every sprite faces three.js +x (screen left); the game mirrors it for -x.
"""

from __future__ import annotations

import argparse
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
ROOT = HERE.parent.parent
BACKDROP = ROOT / "art" / "backdrop"
sys.path.insert(0, str(BACKDROP))
import build as backdrop  # noqa: E402  (art/backdrop/build.py: camera, world, develop)
import scene as canal  # noqa: E402

OUT = ROOT / "art" / "out" / "street"
CAST = ROOT / "public" / "assets" / "customers"

# --- people ---------------------------------------------------------------------

# Cast members who dress for a northern street (no shorts or vests), four men, four women.
PEOPLE = [
    "business_male_02",
    "male_adult_03",
    "delivery_male_01",
    "male_adult_18",
    "business_female_02",
    "female_adult_04",
    "female_adult_07",
    "female_adult_14",
]
FRAMES = 8  # per 1.2 s stride of the walk clip
CELL = (128, 256)  # px
CELL_M = (1.1, 2.2)  # metres the cell covers (width, height); the feet are on the bottom edge
UMBRELLA_COLOURS = ["#1c1c20", "#22304a", "#5a1f22", "#1f3a2c", "#2a2a2a", "#3b2a40", "#1c1c20", "#4a4038"]

# --- props ----------------------------------------------------------------------

# name: (atlas x, y, w, h in px, metres covered w, h)
PROPS = {
    "car_white": (0, 0, 256, 128, 4.8, 2.4),
    "car_green": (256, 0, 256, 128, 4.8, 2.4),
    "car_red": (512, 0, 256, 128, 4.8, 2.4),
    "minibus": (768, 0, 256, 128, 6.4, 3.2),
    "bus": (0, 128, 512, 128, 12.8, 3.2),
    "boat": (512, 128, 512, 128, 13.6, 3.4),
}
PIGEON_FRAMES = ["stand", "peck1", "peck2", "fly1", "fly2", "fly3", "fly4", "land"]
PIGEON_CELL = 128
PIGEON_M = 0.7
PROPS_SIZE = (1024, 384)

# --- canal extras -----------------------------------------------------------------

EXTRA_SCALE = 0.5  # of the canal render's 1280x672
DEPTH = {"z0": 4.0, "step": 0.2352}  # code = (z - z0) / step, 0..254; 255 = sky
NIGHT_EXPOSURE = 2.2
WINDOW_SHARE = {"early": 0.36, "late": 0.3}  # the rest stay dark all evening


def log(msg: str) -> None:
    print(f"[street] {msg}", flush=True)


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--only", default="people,props,canal")
    p.add_argument("--samples", type=int, default=48)
    p.add_argument("--people", default="", help="comma list, for quick looks")
    p.add_argument("--rain-only", action="store_true")
    return p.parse_args(argv)


# --- shared render helpers ---------------------------------------------------------


def reset() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


def render_setup(w: int, h: int, samples: int, transparent: bool = True) -> None:
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = samples
    sc.cycles.use_adaptive_sampling = False
    sc.cycles.seed = 4127
    sc.cycles.max_bounces = 4
    sc.cycles.diffuse_bounces = 2
    sc.cycles.glossy_bounces = 2
    sc.cycles.transparent_max_bounces = 16
    sc.cycles.sample_clamp_indirect = 4.0
    sc.render.threads_mode = "FIXED"
    sc.render.threads = os.cpu_count() or 4
    sc.cycles.use_denoising = True
    sc.cycles.denoiser = "OPENIMAGEDENOISE"
    sc.render.resolution_x = w
    sc.render.resolution_y = h
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = transparent
    sc.render.filter_size = 1.2
    sc.view_settings.view_transform = "Standard"
    sc.render.image_settings.file_format = "OPEN_EXR"
    sc.render.image_settings.color_depth = "32"
    sc.render.image_settings.color_mode = "RGBA"


def render_exr(path: Path) -> np.ndarray:
    """Render the scene camera, return scene-linear RGBA (premultiplied), top row first."""
    sc = bpy.context.scene
    sc.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(str(path))
    w, h = img.size
    buf = np.empty(w * h * 4, np.float32)
    img.pixels.foreach_get(buf)
    bpy.data.images.remove(img)
    path.unlink()
    return np.flipud(buf.reshape(h, w, 4))


def ortho_camera(cx: float, cy: float, scale: float) -> None:
    """Orthographic camera looking along three.js +z, centred on three.js (cx, cy)."""
    sc = bpy.context.scene
    cd = bpy.data.cameras.new("cam")
    cd.type = "ORTHO"
    cd.ortho_scale = scale
    cd.clip_start = 0.1
    cd.clip_end = 100
    cam = bpy.data.objects.new("cam", cd)
    cam.location = backdrop.canal_to_blender((cx, cy, -20.0))
    cam.rotation_euler = (math.radians(90), 0.0, math.radians(180))
    sc.collection.objects.link(cam)
    sc.camera = cam


def develop_sprite(rgba: np.ndarray) -> np.ndarray:
    """Premultiplied scene-linear RGBA -> straight-alpha display sRGB RGBA8, colour bled into empty texels."""
    a = np.clip(rgba[:, :, 3], 0, 1)
    rgb = rgba[:, :, :3] / np.maximum(a, 1e-4)[:, :, None]
    disp = backdrop.srgb_encode(backdrop.aces(rgb, backdrop.EXPOSURE))
    disp = bleed(disp, a)
    out = np.dstack([disp, a[:, :, None]])
    return np.clip(np.round(out * 255), 0, 255).astype(np.uint8)


def bleed(rgb: np.ndarray, a: np.ndarray, steps: int = 12) -> np.ndarray:
    """Grow colour outwards into transparent texels so mipmaps and ETC1S blocks don't pull in black."""
    rgb = rgb.copy()
    known = a > 0.02
    for _ in range(steps):
        if known.all():
            break
        acc = np.zeros_like(rgb)
        cnt = np.zeros(a.shape, np.float32)
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            k = np.roll(known, (dy, dx), (0, 1))
            acc += np.roll(rgb, (dy, dx), (0, 1)) * k[:, :, None]
            cnt += k
        grow = (~known) & (cnt > 0)
        rgb[grow] = acc[grow] / cnt[grow][:, None]
        known = known | grow
    rgb[~known] = rgb[known].mean(axis=0) if known.any() else 0.5
    return rgb


def flat_material(name: str, hex_color: str, rough: float = 0.6, metal: float = 0.0, emission: float = 0.0, coat: float = 0.0, alpha: float = 1.0) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    b = mat.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = canal.lin(hex_color)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if coat:
        b.inputs["Coat Weight"].default_value = coat
    if emission:
        b.inputs["Emission Color"].default_value = canal.lin(hex_color)
        b.inputs["Emission Strength"].default_value = emission
    if alpha < 1:
        b.inputs["Alpha"].default_value = alpha
    return mat


def mesh_object(name: str, bm: bmesh.types.BMesh, mat: bpy.types.Material, smooth: bool = False) -> bpy.types.Object:
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


# --- people ---------------------------------------------------------------------------


def find_bone(arm: bpy.types.Object, suffix: str) -> str:
    for b in arm.data.bones:
        if b.name.endswith(suffix):
            return b.name
    raise SystemExit(f"[street] no bone *{suffix}")


def umbrella(arm: bpy.types.Object, colour: str) -> None:
    """Left (camera-side) hand on an IK target in front of the chest; an umbrella held upright in it."""
    sc = bpy.context.scene
    sc.frame_set(0)
    bpy.context.view_layer.update()
    mw = arm.matrix_world
    shoulder = mw @ arm.pose.bones[find_bone(arm, "L UpperArm")].head
    head = mw @ arm.pose.bones[find_bone(arm, "Head")].head
    spine = find_bone(arm, "Spine2")
    # The person faces Blender +X (three.js +x); their left side is towards the camera (Blender +Y).
    hand_at = shoulder + Vector((0.22, -0.1, -0.13))
    pole_at = shoulder + Vector((-0.3, 0.25, -0.45))
    empties = []
    for name, at in (("ik_target", hand_at), ("ik_pole", pole_at)):
        e = bpy.data.objects.new(name, None)
        sc.collection.objects.link(e)
        e.location = at
        e.parent = arm
        e.parent_type = "BONE"
        e.parent_bone = spine
        bpy.context.view_layer.update()
        e.matrix_world.translation = at
        bpy.context.view_layer.update()
        empties.append(e)
    target, pole = empties
    fore = arm.pose.bones[find_bone(arm, "L Forearm")]
    ik = fore.constraints.new("IK")
    ik.target = target
    ik.pole_target = pole
    ik.pole_angle = math.radians(-90)
    ik.chain_count = 2

    # umbrella: shaft from the hand up past the head, an 8-panel canopy, a crook handle
    top_z = head.z + 0.42
    shaft_len = top_z - hand_at.z
    tilt = math.atan2(hand_at.x - head.x - 0.02, shaft_len)  # lean the top back over the head
    fabric = flat_material("umbrella", colour, rough=0.8)
    steel = flat_material("umbrella_steel", "#2a2a2a", rough=0.35, metal=0.8)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=0.008, radius2=0.008, depth=shaft_len + 0.08, matrix=Matrix.Translation((0, 0, (shaft_len + 0.08) / 2 - 0.04)))
    shaft = mesh_object("shaft", bm, steel)
    bm = bmesh.new()
    rim = []
    seg = 16
    R = 0.48
    for i in range(seg):
        a = 2 * math.pi * i / seg
        r = R * (1.0 if i % 2 == 0 else 0.94)  # scalloped edge between ribs
        rim.append(bm.verts.new((r * math.cos(a), r * math.sin(a), -0.2 + (0.0 if i % 2 == 0 else 0.03))))
    mid = [bm.verts.new((0.7 * R * math.cos(2 * math.pi * i / seg), 0.7 * R * math.sin(2 * math.pi * i / seg), -0.07)) for i in range(seg)]
    apex = bm.verts.new((0, 0, 0.02))
    for i in range(seg):
        j = (i + 1) % seg
        bm.faces.new((rim[i], rim[j], mid[j], mid[i]))
        bm.faces.new((mid[i], mid[j], apex))
    canopy = mesh_object("canopy", bm, fabric, smooth=True)
    canopy.location = (0, 0, shaft_len)
    canopy.parent = shaft
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=0.016, radius2=0.016, depth=0.12, matrix=Matrix.Translation((0, 0, -0.06)))
    handle = mesh_object("handle", bm, flat_material("handle", "#3a2a1e", rough=0.5))
    handle.parent = shaft
    shaft.rotation_euler = (0.0, -tilt * 0.8, 0.0)
    c = shaft.constraints.new("COPY_LOCATION")
    c.target = target


def people_atlas(samples: int, rain: bool, only: list[str]) -> tuple[np.ndarray, list[dict]]:
    cols = 2048 // CELL[0]
    rows = math.ceil(len(PEOPLE) * FRAMES / cols)
    atlas = np.zeros((rows * CELL[1], cols * CELL[0], 4), np.uint8)
    cells = []
    for li, cid in enumerate(PEOPLE):
        if only and cid not in only:
            continue
        reset()
        bpy.ops.import_scene.gltf(filepath=str(CAST / f"{cid}.glb"))
        arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
        walk = next(a for a in bpy.data.actions if a.name.lower().startswith("walk"))
        arm.animation_data.action = walk
        arm.rotation_mode = "XYZ"
        arm.rotation_euler = (0, 0, math.radians(90))  # face three.js +x (nose towards Blender +X)
        for o in bpy.data.objects:
            if o.type == "MESH":
                o.visible_shadow = True
        if rain:
            umbrella(arm, UMBRELLA_COLOURS[li % len(UMBRELLA_COLOURS)])
        backdrop.setup_world()
        ortho_camera(0.0, CELL_M[1] / 2, CELL_M[1])
        render_setup(CELL[0], CELL[1], samples)
        f0, f1 = walk.frame_range
        for fi in range(FRAMES):
            f = f0 + (f1 - f0) * fi / FRAMES
            bpy.context.scene.frame_set(int(f), subframe=f - int(f))
            px = develop_sprite(render_exr(OUT / f"tmp_{cid}_{fi}.exr"))
            k = li * FRAMES + fi
            x, y = (k % cols) * CELL[0], (k // cols) * CELL[1]
            atlas[y : y + CELL[1], x : x + CELL[0]] = px
        log(f"{'rain' if rain else 'dry'} {cid}: {FRAMES} frames")
    for li, cid in enumerate(PEOPLE):
        k = li * FRAMES
        cells.append({"id": cid, "x": (k % cols) * CELL[0], "y": (k // cols) * CELL[1]})
    return atlas, cells


# --- props -------------------------------------------------------------------------------


class Kit:
    """Boxes and wheels in three.js coordinates (x along the vehicle, front at +x; y up; z towards the far bank)."""

    def __init__(self) -> None:
        self.bms: dict[str, bmesh.types.BMesh] = {}
        self.mats: dict[str, bpy.types.Material] = {}

    def mat(self, name: str, *a, **k) -> None:
        self.mats[name] = flat_material(name, *a, **k)

    def bm(self, mat: str) -> bmesh.types.BMesh:
        return self.bms.setdefault(mat, bmesh.new())

    def box(self, mat: str, x0, x1, y0, y1, z0, z1, bevel: float = 0.0) -> None:
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        for v in bm.verts:
            v.co = Vector(((x0 + x1) / 2 + v.co.x * (x1 - x0), -((z0 + z1) / 2 + v.co.y * (z1 - z0)), (y0 + y1) / 2 + v.co.z * (y1 - y0)))
        if bevel:
            bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=2, affect="EDGES", profile=0.5)
        self._merge(mat, bm)

    def side_poly(self, mat: str, pts_xy: list[tuple[float, float]], z0: float, z1: float) -> None:
        """Polygon in the vehicle's side plane (x, y), extruded across z0..z1."""
        bm = bmesh.new()
        a = [bm.verts.new((x, -z0, y)) for x, y in pts_xy]
        b = [bm.verts.new((x, -z1, y)) for x, y in pts_xy]
        bm.faces.new(a)
        bm.faces.new(list(reversed(b)))
        n = len(a)
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((a[i], a[j], b[j], b[i]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        self._merge(mat, bm)

    def wheel(self, x: float, r: float, z0: float, z1: float, tyre: str = "tyre", hub: str = "hub") -> None:

        for mat, rr, za, zb in ((tyre, r, z0, z1), (hub, r * 0.55, z0 - 0.01, z1 + 0.01)):
            bm = bmesh.new()
            m = Matrix.Translation((x, -(za + zb) / 2, r)) @ Matrix.Rotation(math.radians(90), 4, "X")
            bmesh.ops.create_cone(bm, cap_ends=True, segments=18, radius1=rr, radius2=rr, depth=zb - za, matrix=m)
            self._merge(mat, bm)

    def _merge(self, mat: str, src: bmesh.types.BMesh) -> None:
        me = bpy.data.meshes.new("tmp")
        src.to_mesh(me)
        src.free()
        self.bm(mat).from_mesh(me)
        bpy.data.meshes.remove(me)

    def finish(self) -> None:
        for name, bm in self.bms.items():
            ob = mesh_object(name, bm, self.mats[name])
            ob.visible_shadow = True
        self.bms.clear()


def vehicle_mats(k: Kit, body: str) -> None:
    k.mat("body", body, rough=0.35, coat=0.6)
    k.mat("glass", "#15191c", rough=0.08, coat=0.3)
    k.mat("tyre", "#161616", rough=0.85)
    k.mat("hub", "#8a8c8c", rough=0.4, metal=0.7)
    k.mat("trim", "#202020", rough=0.6)
    k.mat("chrome", "#b8b8b4", rough=0.25, metal=0.9)
    k.mat("lamp", "#e8e4d8", rough=0.2)
    k.mat("tail", "#8a1a14", rough=0.3)
    k.mat("plate", "#e0ddd2", rough=0.5)
    k.mat("stripe", "#7a2420", rough=0.4, coat=0.4)
    k.mat("shade", "#0b0b0c", rough=0.9)


def car(k: Kit) -> None:
    """A boxy 1980s-style saloon: generic, no badges."""
    L, W = 4.15, 1.62
    z0, z1 = -W / 2, W / 2
    k.box("body", -L / 2, L / 2, 0.3, 0.86, z0, z1, bevel=0.05)
    k.side_poly("body", [(-1.25, 0.84), (1.0, 0.84), (0.55, 1.4), (-0.95, 1.4)], z0 + 0.06, z1 - 0.06)
    k.side_poly("glass", [(-1.13, 0.9), (0.9, 0.9), (0.5, 1.34), (-0.88, 1.34)], z0 + 0.04, z1 - 0.04)
    k.box("body", -0.2, -0.12, 0.9, 1.38, z0 + 0.03, z1 - 0.03)  # B pillar
    k.box("trim", -L / 2 - 0.04, -L / 2 + 0.25, 0.3, 0.5, z0, z1)
    k.box("trim", L / 2 - 0.25, L / 2 + 0.04, 0.3, 0.5, z0, z1)
    k.box("trim", -L / 2 + 0.3, L / 2 - 0.3, 0.52, 0.56, z0 - 0.015, z1 + 0.015)  # rubbing strip
    k.box("lamp", L / 2 - 0.02, L / 2 + 0.02, 0.62, 0.74, z0 + 0.1, z0 + 0.45)
    k.box("lamp", L / 2 - 0.02, L / 2 + 0.02, 0.62, 0.74, z1 - 0.45, z1 - 0.1)
    k.box("tail", -L / 2 - 0.02, -L / 2 + 0.02, 0.62, 0.76, z0 + 0.1, z0 + 0.4)
    k.box("tail", -L / 2 - 0.02, -L / 2 + 0.02, 0.62, 0.76, z1 - 0.4, z1 - 0.1)
    k.box("chrome", 0.25, 0.4, 0.8, 0.82, z0 - 0.02, z0 + 0.02)  # door handles
    k.box("chrome", -0.75, -0.6, 0.8, 0.82, z0 - 0.02, z0 + 0.02)
    k.box("shade", -1.5, 1.5, 0.12, 0.32, z0 + 0.15, z1 - 0.15)
    for x in (-1.3, 1.25):
        k.wheel(x, 0.3, z0 + 0.02, z0 + 0.2)
        k.wheel(x, 0.3, z1 - 0.2, z1 - 0.02)


def minibus(k: Kit) -> None:
    """A yellow route minibus (no route boards or lettering)."""
    L, W = 5.6, 1.95
    z0, z1 = -W / 2, W / 2
    k.side_poly("body", [(-L / 2, 0.35), (L / 2, 0.35), (L / 2, 1.05), (L / 2 - 0.75, 1.55), (L / 2 - 1.0, 2.35), (-L / 2, 2.35)], z0, z1)
    k.side_poly("glass", [(L / 2 - 0.06, 1.12), (L / 2 - 0.72, 1.6), (L / 2 - 0.95, 2.22), (L / 2 - 1.0, 1.12)], z0 - 0.01, z1 + 0.01)
    for i in range(4):
        x = -L / 2 + 0.25 + i * 0.95
        k.box("glass", x, x + 0.8, 1.45, 2.1, z0 - 0.01, z1 + 0.01)
    k.box("trim", -L / 2 - 0.03, L / 2 + 0.03, 0.35, 0.55, z0 - 0.01, z1 + 0.01)
    k.box("trim", -0.6, -0.56, 0.6, 2.15, z0 - 0.012, z0)  # sliding door seam
    k.box("lamp", L / 2 - 0.01, L / 2 + 0.02, 0.7, 0.85, z0 + 0.1, z0 + 0.4)
    k.box("tail", -L / 2 - 0.02, -L / 2 + 0.01, 0.75, 1.05, z0 + 0.08, z0 + 0.3)
    k.box("shade", -2.2, 2.2, 0.12, 0.36, z0 + 0.15, z1 - 0.15)
    for x in (-1.75, 1.75):
        k.wheel(x, 0.33, z0 + 0.02, z0 + 0.22)
        k.wheel(x, 0.33, z1 - 0.22, z1 - 0.02)


def bus(k: Kit) -> None:
    """A city bus in cream with a red band (no route number or operator)."""
    L, W = 11.8, 2.5
    z0, z1 = -W / 2, W / 2
    k.box("body", -L / 2, L / 2, 0.35, 3.0, z0, z1, bevel=0.08)
    k.box("stripe", -L / 2 - 0.01, L / 2 + 0.01, 0.75, 1.0, z0 - 0.01, z1 + 0.01)
    k.box("glass", L / 2 - 0.05, L / 2 + 0.02, 1.15, 2.75, z0 + 0.12, z1 - 0.12)  # windscreen
    k.box("glass", -L / 2 + 0.3, L / 2 - 0.3, 1.45, 2.65, z0 - 0.012, z1 + 0.012)  # window band
    for x in (-L / 2 + 1.75, -2.9, -1.5, 1.6, 3.0, 4.2):
        k.box("body", x - 0.07, x + 0.07, 1.4, 2.7, z0 - 0.02, z1 + 0.02)  # pillars
    for x0d in (L / 2 - 1.45, -0.6, -L / 2 + 0.55):
        k.box("glass", x0d, x0d + 1.1, 0.45, 2.65, z0 - 0.016, z1 + 0.016)  # doors
        k.box("trim", x0d + 0.53, x0d + 0.57, 0.45, 2.65, z0 - 0.02, z1 + 0.02)
    k.box("trim", -L / 2, L / 2, 2.92, 3.02, z0 + 0.05, z1 - 0.05)
    k.box("lamp", L / 2, L / 2 + 0.03, 0.55, 0.72, z0 + 0.15, z0 + 0.45)
    k.box("tail", -L / 2 - 0.03, -L / 2, 0.6, 0.9, z0 + 0.1, z0 + 0.3)
    k.box("shade", -5.0, 5.0, 0.14, 0.36, z0 + 0.15, z1 - 0.15)
    for x in (-3.4, 3.3):
        k.wheel(x, 0.48, z0 + 0.02, z0 + 0.3)
        k.wheel(x, 0.48, z1 - 0.3, z1 - 0.02)


def tour_boat(k: Kit) -> None:
    """A low canal tour boat with a glazed cabin: from the waterline (y = 0) up. Bow at +x."""
    k.mat("hull", "#1d2f45", rough=0.3, coat=0.6)
    k.mat("deck", "#e6e2d6", rough=0.5)
    k.mat("seat", "#6e3a2a", rough=0.7)
    k.mat("flag", "#b8b2a2", rough=0.8)
    L = 12.0
    z0, z1 = -1.4, 1.4
    k.side_poly("hull", [(-L / 2, 0.0), (L / 2 - 1.0, 0.0), (L / 2, 0.55), (L / 2 - 0.2, 0.75), (-L / 2, 0.75)], z0, z1)
    k.box("deck", -L / 2 - 0.02, L / 2 - 0.15, 0.72, 0.8, z0 - 0.02, z1 + 0.02)  # gunwale
    k.box("deck", -L / 2 + 0.5, L / 2 - 1.6, 0.8, 1.05, z0 + 0.15, z1 - 0.15)
    k.side_poly("glass", [(-L / 2 + 0.6, 1.05), (L / 2 - 1.7, 1.05), (L / 2 - 2.3, 1.85), (-L / 2 + 0.9, 1.85)], z0 + 0.2, z1 - 0.2)
    for i in range(9):
        x = -L / 2 + 0.95 + i * 1.0
        k.box("deck", x, x + 0.06, 1.05, 1.86, z0 + 0.18, z1 - 0.18)  # mullions
        k.box("seat", x + 0.25, x + 0.75, 1.0, 1.4, z0 + 0.3, z1 - 0.3)  # seat backs inside
    k.side_poly("deck", [(-L / 2 + 0.85, 1.85), (L / 2 - 2.25, 1.85), (L / 2 - 2.45, 1.95), (-L / 2 + 0.85, 1.95)], z0 + 0.15, z1 - 0.15)
    k.box("trim", -L / 2 + 0.3, -L / 2 + 0.36, 1.95, 2.6, -0.03, 0.03)  # flagpole
    k.box("flag", -L / 2 - 0.15, -L / 2 + 0.3, 2.3, 2.58, -0.01, 0.01)
    k.box("trim", -L / 2 + 0.2, L / 2 - 1.2, 0.18, 0.24, z0 - 0.01, z1 + 0.01)  # boot stripe


def render_prop(build, body: str, name: str, samples: int, atlas: np.ndarray, origin_y: float = 0.0) -> None:
    x, y, w, h, mw, mh = PROPS[name]
    reset()
    k = Kit()
    vehicle_mats(k, body)
    build(k)
    k.finish()
    backdrop.setup_world()
    ortho_camera(0.0, origin_y + mh / 2, mw)
    render_setup(w, h, samples)
    atlas[y : y + h, x : x + w] = develop_sprite(render_exr(OUT / f"tmp_{name}.exr"))
    log(f"prop {name}")


def pigeon(pose: str) -> None:
    """A feral pigeon from primitives, facing three.js +x, feet at y = 0."""

    grey = flat_material("p_grey", "#8b8f98", rough=0.7)
    dark = flat_material("p_dark", "#4b4e57", rough=0.7)
    neck = flat_material("p_neck", "#66766f", rough=0.4, metal=0.25)
    pink = flat_material("p_pink", "#b8706a", rough=0.6)
    beak = flat_material("p_beak", "#3a3434", rough=0.5)
    eye = flat_material("p_eye", "#c06a20", rough=0.3)

    def ell(name, mat, c, s, rot=(0, 0, 0), seg=20):
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=seg // 2, radius=1.0)
        ob = mesh_object(name, bm, mat, smooth=True)
        ob.location = backdrop.canal_to_blender(c)
        ob.scale = (s[0], s[2], s[1])
        ob.rotation_euler = rot
        return ob

    flying = pose.startswith("fly") or pose == "land"
    body_tilt = {"stand": -0.2, "peck1": 0.35, "peck2": 0.6, "land": -0.4}.get(pose, 0.05)
    by = 0.125 if not flying else 0.2
    ell("body", grey, (0, by, 0), (0.13, 0.075, 0.075), rot=(0, body_tilt * 0.5, 0))
    # head and neck
    hx, hy = {"stand": (0.1, 0.25), "peck1": (0.16, 0.13), "peck2": (0.17, 0.04)}.get(pose, (0.15, 0.24))
    ell("neck", neck, ((hx * 0.55), (by + hy) / 2 + 0.01, 0), (0.05, 0.06, 0.042))
    ell("head", grey, (hx, hy, 0), (0.04, 0.036, 0.034))
    ell("eye", eye, (hx + 0.018, hy + 0.01, -0.026), (0.008, 0.008, 0.008), seg=8)
    bm = bmesh.new()
    down = {"peck1": -0.9, "peck2": -1.4}.get(pose, -0.25)
    bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=0.009, radius2=0.002, depth=0.035, matrix=Matrix.Translation((0, 0, 0.0175)))
    b = mesh_object("beak", bm, beak)
    b.location = backdrop.canal_to_blender((hx + 0.035, hy - 0.004, 0))
    b.rotation_euler = (0, math.pi / 2 - down * 0.5, 0)
    # tail
    tail = ell("tail", dark, (-0.15, by + 0.02 + body_tilt * 0.06, 0), (0.09, 0.012, 0.04))
    tail.rotation_euler = (0, body_tilt * 0.55, 0)
    # wings
    if flying:
        ang = {"fly1": 1.25, "fly2": 0.35, "fly3": -0.7, "fly4": 0.0, "land": 1.0}[pose]
        for side in (1, -1):
            w = ell("wing", grey, (0, 0, 0), (0.065, 0.01, 0.2))
            w.location = backdrop.canal_to_blender((0.01, by + 0.03, 0.04 * side))
            # spread out sideways (three.js z) and swing up/down about the body axis
            w.rotation_euler = (-side * ang, 0.15, side * 0.3)
            wb = ell("wingbar", dark, (0, 0, 0), (0.03, 0.012, 0.21))
            wb.location = w.location
            wb.rotation_euler = w.rotation_euler
            # hinge at the shoulder: offset each wing one radius sideways in unit-sphere space
            for o in (w, wb):
                o.data.transform(Matrix.Translation((0, -side * 1.0, 0)))
    else:
        w = ell("wing", grey, (-0.02, by + 0.02, 0.0), (0.12, 0.055, 0.08))
        w.rotation_euler = (0, body_tilt * 0.5, 0)
        for dx in (-0.04, 0.02):
            ell("bar", dark, (dx - 0.02, by + 0.0, -0.075), (0.012, 0.03, 0.006))
        ell("tip", dark, (-0.11, by + 0.02 + body_tilt * 0.04, 0.0), (0.06, 0.03, 0.07))
    # legs
    if pose != "fly1" and pose != "fly2" and pose != "fly3" and pose != "fly4":
        for dz in (-0.025, 0.025):
            bm = bmesh.new()
            h = by - 0.065 if not flying else 0.06
            bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=0.006, radius2=0.006, depth=h, matrix=Matrix.Translation((0, 0, h / 2)))
            leg = mesh_object("leg", bm, pink)
            base_y = 0.0 if not flying else by - 0.14
            leg.location = backdrop.canal_to_blender((0.0, base_y, dz))
            if flying:
                leg.rotation_euler = (0, -0.8, 0)
            bm = bmesh.new()
            bmesh.ops.create_cube(bm, size=1.0)
            foot = mesh_object("foot", bm, pink)
            foot.scale = (0.045, 0.012, 0.006)
            foot.location = backdrop.canal_to_blender((0.012, base_y + 0.003, dz))


def props_atlas(samples: int) -> tuple[np.ndarray, list[dict]]:
    W, H = PROPS_SIZE
    atlas = np.zeros((H, W, 4), np.uint8)
    render_prop(car, "#d6d3c8", "car_white", samples, atlas)
    render_prop(car, "#46564c", "car_green", samples, atlas)
    render_prop(car, "#6b2622", "car_red", samples, atlas)
    render_prop(minibus, "#d8b23e", "minibus", samples, atlas)
    render_prop(bus, "#e2dccb", "bus", samples, atlas)
    render_prop(tour_boat, "#1d2f45", "boat", samples, atlas)
    cells = [{"id": n, "x": v[0], "y": v[1], "w": v[2], "h": v[3], "m": [v[4], v[5]]} for n, v in PROPS.items()]
    y = 256
    for i, pose in enumerate(PIGEON_FRAMES):
        reset()
        pigeon(pose)
        backdrop.setup_world()
        cy = 0.2 if pose.startswith("fly") or pose == "land" else PIGEON_M / 2
        ortho_camera(0.0, cy, PIGEON_M)
        render_setup(PIGEON_CELL, PIGEON_CELL, samples)
        x = i * PIGEON_CELL
        atlas[y : y + PIGEON_CELL, x : x + PIGEON_CELL] = develop_sprite(render_exr(OUT / f"tmp_pigeon_{pose}.exr"))
        cells.append({"id": f"pigeon_{pose}", "x": x, "y": y, "w": PIGEON_CELL, "h": PIGEON_CELL, "m": [PIGEON_M, PIGEON_M], "y0": round(cy - PIGEON_M / 2, 4)})
    log("pigeons")
    return atlas, cells


# --- canal extras: depth and night light, from the backdrop's own scene and eye ---------------

GLASS = {"glass_dark", "glass_room", "glass_curtain", "glass_lit"}


def canal_extras(samples: int) -> dict:
    reset()
    font = bpy.data.fonts.load(str(Path(bpy.utils.system_resource("DATAFILES", path="fonts")) / "Inter.woff2"))
    # Tag every facade window's glass by which group it lights up with, without touching the
    # scene's own random stream (the geometry must match the daytime render exactly).
    pick = random.Random(7731)
    state = {"group": None}
    orig_unit = canal.window_unit
    orig_bm = canal.Geo.bm

    def unit(f, rng, uc, v0, ww, wh, trim, hood="", glass=None):
        r = pick.random()
        state["group"] = "early" if r < WINDOW_SHARE["early"] else ("late" if r < WINDOW_SHARE["early"] + WINDOW_SHARE["late"] else "never")
        try:
            orig_unit(f, rng, uc, v0, ww, wh, trim, hood, glass)
        finally:
            state["group"] = None

    def bm(self, mat):
        if state["group"] and mat in GLASS:
            mat = "glass_lit" if mat == "glass_lit" else f"night_{state['group']}_{mat}"
        return orig_bm(self, mat)

    canal.window_unit = unit
    canal.Geo.bm = bm
    try:
        mats = canal.Mats()
        geo = canal.Geo()
        canal.embankments(geo)
        canal.bridge(geo)
        canal.boat(geo, -3.6, 2.4)
        canal.far_bank(geo, font)
        for name in list(geo.bms):
            if name.startswith("night_"):
                mats.m[name] = mats.m[name.split("_", 2)[2]]
        geo.finish(mats.m)
    finally:
        canal.window_unit = orig_unit
        canal.Geo.bm = orig_bm

    rect = backdrop.plane_rect()
    backdrop.setup_camera(rect)
    w, h = int(rect["size"][0] * EXTRA_SCALE), int(rect["size"][1] * EXTRA_SCALE)
    sc = bpy.context.scene
    render_setup(w, h, samples, transparent=False)
    sc.render.filter_size = 1.5

    # night: the sky almost black, no sun; only emitters light the street
    backdrop.setup_world()
    for o in list(bpy.data.objects):
        if o.type == "LIGHT":
            bpy.data.objects.remove(o)
    sc.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.012
    sc.view_layers[0].use_pass_z = True

    warm = canal.lin("#ffc98a")
    lamp = canal.lin("#ffb870")

    def set_emit(names: set[str], prefixes: tuple[str, ...]) -> None:
        for o in bpy.data.objects:
            if o.type != "MESH":
                continue
            for m in o.data.materials:
                b = m.node_tree.nodes.get("Principled BSDF")
                if not b:
                    continue
                base = m.get("orig_emit")
                if base is None:
                    m["orig_emit"] = float(b.inputs["Emission Strength"].default_value)
                on = m.name in names or o.name.startswith(prefixes)
                if m.name == "lamp_glass" and on:
                    b.inputs["Emission Color"].default_value = lamp
                    b.inputs["Emission Strength"].default_value = 14.0
                elif o.name.startswith("night_") and on:
                    b.inputs["Emission Color"].default_value = warm
                    b.inputs["Emission Strength"].default_value = 1.6 if "curtain" in o.name else 1.1
                elif m.name in ("shop_back", "shop_tube", "glass_lit") and on:
                    b.inputs["Emission Strength"].default_value = float(m["orig_emit"]) * (2.2 if m.name != "shop_tube" else 1.0)
                else:
                    b.inputs["Emission Strength"].default_value = 0.0

    # Windows share materials with the daytime glass, so give each night object its own copy.
    for o in bpy.data.objects:
        if o.type == "MESH" and o.name.startswith("night_"):
            o.data.materials[0] = o.data.materials[0].copy()

    groups = [
        ("lamps", {"lamp_glass", "shop_back", "shop_tube", "glass_lit"}, ()),
        ("early", set(), ("night_early",)),
        ("late", set(), ("night_late",)),
    ]
    layers = {}
    depth = None
    for name, mats_on, prefixes in groups:
        set_emit(mats_on, prefixes)
        tree_out = OUT / f"tmp_night_{name}.exr"
        sc.render.filepath = str(tree_out)
        sc.use_nodes = True
        tree = sc.node_tree
        for n in list(tree.nodes):
            tree.nodes.remove(n)
        rl = tree.nodes.new("CompositorNodeRLayers")
        comp = tree.nodes.new("CompositorNodeComposite")
        tree.links.new(rl.outputs["Image"], comp.inputs["Image"])
        fo = None
        if depth is None:
            fo = tree.nodes.new("CompositorNodeOutputFile")
            fo.base_path = str(OUT)
            fo.format.file_format = "OPEN_EXR"
            fo.format.color_depth = "32"
            fo.file_slots.clear()
            fo.file_slots.new("depth")
            tree.links.new(rl.outputs["Depth"], fo.inputs["depth"])
        t0 = time.time()
        rgba = render_exr(tree_out)
        log(f"night {name}: {time.time() - t0:.0f}s")
        lin = rgba[:, :, :3]
        disp = backdrop.srgb_encode(backdrop.aces(lin, NIGHT_EXPOSURE))
        lum = disp.max(axis=2)
        layers[name] = lum
        if depth is None:
            f = sorted(OUT.glob("depth*.exr"))[-1]
            img = bpy.data.images.load(str(f))
            buf = np.empty(img.size[0] * img.size[1] * 4, np.float32)
            img.pixels.foreach_get(buf)
            depth = np.flipud(buf.reshape(img.size[1], img.size[0], 4))[:, :, 0]
            bpy.data.images.remove(img)
            f.unlink()
    zw = depth + backdrop.EYE[2]
    code = np.clip(np.round((zw - DEPTH["z0"]) / DEPTH["step"]), 0, 254)
    code[depth > 1e5] = 255
    out = np.dstack(
        [
            code,
            np.sqrt(np.clip(layers["lamps"], 0, 1)) * 255,
            np.sqrt(np.clip(layers["early"], 0, 1)) * 255,
            np.sqrt(np.clip(layers["late"], 0, 1)) * 255,
        ]
    )
    out = np.clip(np.round(out), 0, 255).astype(np.uint8)
    backdrop.write_png(OUT / "canal_extra.png", np.flipud(out).copy())  # rows bottom-up: v = 0 at the bottom
    sky = float((code == 255).mean())
    log(f"canal extras {w}x{h}: sky {sky * 100:.1f}% of pixels")
    # a review image: the night light over a darkened day render, plus the depth
    return {"size": [w, h], "depth": DEPTH, "nightExposure": NIGHT_EXPOSURE, "preview": out}


def input_hash() -> str:
    import hashlib

    h = hashlib.sha256()
    for f in sorted(HERE.glob("*.py")):
        h.update(f.read_bytes())
    return h.hexdigest()[:16]


def preview(people: np.ndarray | None, props: np.ndarray | None, extra: np.ndarray | None) -> None:
    """art/street/preview.jpg: the atlases on grey, and the night layers in false colour."""
    parts = []
    bg = np.array([150, 156, 162], np.float32)

    def on_grey(a: np.ndarray) -> np.ndarray:
        al = a[:, :, 3:4].astype(np.float32) / 255
        return (a[:, :, :3] * al + bg * (1 - al)).astype(np.uint8)

    if people is not None:
        parts.append(on_grey(people)[::2, ::2])
    if props is not None:
        p = on_grey(props)
        parts.append(np.pad(p, ((0, 0), (0, max(0, 1024 - p.shape[1])), (0, 0)), constant_values=255))
    if extra is not None:
        e = extra.astype(np.float32)
        night = np.dstack([e[:, :, 1] ** 2 / 255 + e[:, :, 2] ** 2 / 255, e[:, :, 1] ** 2 / 255 * 0.8 + e[:, :, 3] ** 2 / 255, e[:, :, 0]])
        parts.append(np.pad(np.clip(night, 0, 255).astype(np.uint8), ((0, 0), (0, max(0, 1024 - e.shape[1])), (0, 0)), constant_values=255))
    if not parts:
        return
    wmax = max(p.shape[1] for p in parts)
    img = np.concatenate([np.pad(p, ((0, 8), (0, wmax - p.shape[1]), (0, 0)), constant_values=255) for p in parts])
    backdrop.write_jpg(HERE / "preview.jpg", img, quality=82)


def main() -> None:
    args = parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    only = set(args.only.split(","))
    pick = [p for p in args.people.split(",") if p]
    manifest_path = OUT / "street.json"
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    people = props = extra = None
    t0 = time.time()
    if "people" in only:
        for rain in ((True,) if args.rain_only else (False, True)):
            atlas, cells = people_atlas(args.samples, rain, pick)
            name = "people_rain" if rain else "people_dry"
            if pick and (OUT / f"{name}.png").exists():
                # partial rebuild: keep the other people from the last full run
                old = bpy.data.images.load(str(OUT / f"{name}.png"))
                buf = np.empty(old.size[0] * old.size[1] * 4, np.float32)
                old.pixels.foreach_get(buf)
                prev = np.flipud(np.round(buf.reshape(old.size[1], old.size[0], 4) * 255)).astype(np.uint8)
                bpy.data.images.remove(old)
                cols = 2048 // CELL[0]
                for li, cid in enumerate(PEOPLE):
                    if cid in pick:
                        continue
                    for fi in range(FRAMES):
                        k = li * FRAMES + fi
                        x, y = (k % cols) * CELL[0], (k // cols) * CELL[1]
                        atlas[y : y + CELL[1], x : x + CELL[0]] = prev[y : y + CELL[1], x : x + CELL[0]]
            backdrop.write_png(OUT / f"{name}.png", atlas)
            people = atlas if not rain else (people if people is not None else atlas)
        manifest["people"] = {
            "cell": list(CELL),
            "metres": list(CELL_M),
            "frames": FRAMES,
            "clip": 1.2,
            "atlas": [2048, people.shape[0]],
            "looks": cells,
            "walkSpeed": {"m": 1.012, "f": 1.214},
        }
    if "props" in only:
        props, cells = props_atlas(args.samples)
        backdrop.write_png(OUT / "props.png", props)
        manifest["props"] = {"atlas": list(PROPS_SIZE), "cells": cells}
    if "canal" in only:
        info = canal_extras(max(16, args.samples // 2))
        extra = info.pop("preview")
        manifest["canal"] = {**info, "file": "canal_extra.png"}
    manifest["version"] = 1
    manifest["blender"] = bpy.app.version_string
    # the canal layers follow the backdrop's scene and eye: tests/street.test.ts checks both hashes
    if "canal" in only:
        manifest["backdropHash"] = backdrop.input_hash()
    manifest["inputHash"] = input_hash()
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    preview(people, props, extra)
    log(f"done in {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
