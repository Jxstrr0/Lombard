"""
Canal backdrop: the view through the shop's street window and door glass.
Nobody opens the Blender UI.

    ~/blender/blender --background --factory-startup --python art/backdrop/build.py -- [--samples 256] [--scale 1] [--develop]
    node scripts/backdrop-pack.mjs

The player's eye never moves (it only rotates, plus ~2 cm of sway), so one
Cycles render made from the eye and projected onto a plane outside the street
wall is perspective-exact. The camera uses off-axis lens shift so the frame
covers exactly a rectangle on that plane (PLANE_Z): big enough to fill the
window and the door glass from the eye, the idle sway and the inspect camera.

Writes into art/out/backdrop/ (git-ignored):
  beauty0001.exr / water0001.exr / mist0001.exr   scene-linear render passes
  canal.png    tone-mapped sRGB colour, alpha = water mask (rows top-down)
  canal.json   plane rectangle, eye, water level, render settings, input hash
and art/backdrop/preview.jpg (committed, for review on GitHub).
--develop re-runs only the tone mapping from the saved passes (seconds, not minutes).
scripts/backdrop-pack.mjs then encodes canal.png to KTX2 into public/assets/backdrop/.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import struct
import sys
import time
import zlib
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))
import scene as canal  # noqa: E402

OUT = ROOT / "art" / "out" / "backdrop"

# --- projection ------------------------------------------------------------------

EYE = (0.0, 1.62, -3.2)  # src/render/camera.ts
PLANE_Z = 11.0  # three.js z of the plane the render is shown on (about the near railing)
# Openings in the street wall (three.js metres): x0, x1, y0, y1, z of the faces that bound them.
OPENINGS = [
    ("window", -2.5, 0.5, 0.85, 3.25, (4.0, 4.1)),  # bake/layout.json window, wall 4.0..4.1
    ("door_glass", 1.25, 2.15, 0.9, 2.05, (3.97,)),  # door glass panel
]
RES_X = 1280
MARGIN = 0.015  # of the rectangle's size, each side


def viewpoints() -> list[tuple[float, float, float]]:
    """Every camera position the rectangle must serve: the eye with idle sway, and the inspect camera."""
    ex, ey, ez = EYE
    pts = [(ex + dx, ey + dy, ez) for dx in (-0.025, 0.025) for dy in (-0.012, 0.012)]
    # inspect: camera at (0, 1.5, -2.7 - distance), distance ~0.03..1.2 m (src/render/stage.ts)
    for z in (-3.9, -3.3, -2.72):
        pts.append((0.0, 1.5, z))
        pts.append(((ex + 0) / 2, (ey + 1.5) / 2, (ez + z) / 2))
    return pts


def plane_rect() -> dict:
    xs, ys = [], []
    for vx, vy, vz in viewpoints():
        for _, x0, x1, y0, y1, zs in OPENINGS:
            for z in zs:
                t = (PLANE_Z - vz) / (z - vz)
                for cx in (x0, x1):
                    xs.append(vx + (cx - vx) * t)
                for cy in (y0, y1):
                    ys.append(vy + (cy - vy) * t)
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    w, h = x1 - x0, y1 - y0
    x0, x1, y0, y1 = x0 - w * MARGIN, x1 + w * MARGIN, y0 - h * MARGIN, y1 + h * MARGIN
    w, h = x1 - x0, y1 - y0
    res_y = int(math.ceil(RES_X * h / w / 4) * 4)
    grow = (w * res_y / RES_X - h) / 2
    y0, y1 = y0 - grow, y1 + grow
    return {"z": PLANE_Z, "x0": x0, "x1": x1, "y0": y0, "y1": y1, "size": [RES_X, res_y]}


# --- Blender setup -----------------------------------------------------------------


def log(msg: str) -> None:
    print(f"[backdrop] {msg}", flush=True)


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--samples", type=int, default=256)
    p.add_argument("--scale", type=float, default=1.0, help="resolution scale for quick looks")
    p.add_argument("--develop", action="store_true", help="only re-run tone mapping from saved passes")
    p.add_argument("--exposure", type=float, default=None, help="override the develop exposure")
    return p.parse_args(argv)


def reset() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


def setup_camera(rect: dict) -> bpy.types.Object:
    D = rect["z"] - EYE[2]
    wt = (rect["x1"] - rect["x0"]) / D
    xc, yc = (rect["x0"] + rect["x1"]) / 2, (rect["y0"] + rect["y1"]) / 2
    cam_data = bpy.data.cameras.new("eye")
    cam_data.sensor_fit = "HORIZONTAL"
    cam_data.sensor_width = 36.0
    cam_data.lens = 36.0 / wt
    # image right = three.js -x (the camera looks along +z)
    cam_data.shift_x = (-(xc - EYE[0]) / D) / wt
    cam_data.shift_y = ((yc - EYE[1]) / D) / wt
    cam_data.clip_start = 0.5
    cam_data.clip_end = 2000
    cam = bpy.data.objects.new("eye", cam_data)
    cam.location = canal_to_blender(EYE)
    cam.rotation_euler = (math.radians(90), 0.0, math.radians(180))
    bpy.context.scene.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    return cam


def canal_to_blender(p) -> Vector:
    return Vector((p[0], -p[2], p[1]))


def check_projection(cam: bpy.types.Object, rect: dict) -> None:
    from bpy_extras.object_utils import world_to_camera_view

    sc = bpy.context.scene
    bpy.context.view_layer.update()
    for x, y, want in ((rect["x0"], rect["y0"], (1, 0)), (rect["x1"], rect["y1"], (0, 1)), (rect["x0"], rect["y1"], (1, 1))):
        v = world_to_camera_view(sc, cam, canal_to_blender((x, y, rect["z"])))
        err = abs(v.x - want[0]) + abs(v.y - want[1])
        log(f"corner ({x:.2f}, {y:.2f}) -> ({v.x:.4f}, {v.y:.4f}) want {want}")
        if err > 1e-3:
            raise SystemExit("[backdrop] camera does not frame the plane rectangle")


def setup_world() -> None:
    """Overcast northern sky: brighter towards the zenith (CIE overcast), cool grey, a faint warm ground bounce."""
    world = bpy.data.worlds.new("overcast")
    bpy.context.scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Generated"], sep.inputs[0])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    # map z (sin elevation) -1..1 -> 0..1
    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.inputs["From Min"].default_value = -1
    mr.inputs["From Max"].default_value = 1
    nt.links.new(sep.outputs["Z"], mr.inputs["Value"])
    nt.links.new(mr.outputs["Result"], ramp.inputs["Fac"])
    cr = ramp.color_ramp
    cr.interpolation = "B_SPLINE"
    stops = [
        (0.0, "#3a3732", 0.25),
        (0.49, "#59564f", 0.35),
        (0.5, "#c9ced2", 0.62),  # horizon
        (0.56, "#c3cbd2", 0.72),
        (0.7, "#b4c1cc", 0.86),
        (1.0, "#a9b8c6", 1.0),  # zenith: the bake's sky colour
    ]
    cr.elements[0].position = stops[0][0]
    cr.elements[1].position = stops[-1][0]
    for _ in stops[1:-1]:
        cr.elements.new(0.5)
    for el, (pos, hexc, lum) in zip(sorted(cr.elements, key=lambda e: e.position), stops):
        el.position = pos
        c = canal.lin(hexc)
        el.color = (c[0] * lum, c[1] * lum, c[2] * lum, 1)
    # soft, low-contrast cloud mass so the sky isn't a flat void (stretched along the horizon)
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (2.2, 2.2, 7.0)
    nt.links.new(tc.outputs["Generated"], mp.inputs["Vector"])
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 1.0
    nz.inputs["Detail"].default_value = 6.0
    nz.inputs["Roughness"].default_value = 0.55
    nt.links.new(mp.outputs["Vector"], nz.inputs["Vector"])
    cl = nt.nodes.new("ShaderNodeMapRange")
    cl.inputs["From Min"].default_value = 0.3
    cl.inputs["From Max"].default_value = 0.72
    cl.inputs["To Min"].default_value = 0.86
    cl.inputs["To Max"].default_value = 1.07
    nt.links.new(nz.outputs["Fac"], cl.inputs["Value"])
    sky = nt.nodes.new("ShaderNodeVectorMath")
    sky.operation = "SCALE"
    nt.links.new(ramp.outputs["Color"], sky.inputs[0])
    nt.links.new(cl.outputs["Result"], sky.inputs["Scale"])
    nt.links.new(sky.outputs["Vector"], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = 1.0
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])
    world.mist_settings.start = 12
    world.mist_settings.depth = 260
    world.mist_settings.falloff = "LINEAR"

    # a sun behind the clouds: very soft, from high on the player's left and behind
    sun_data = bpy.data.lights.new("sun", "SUN")
    sun_data.energy = 0.55
    sun_data.angle = math.radians(60)
    sun_data.color = (1.0, 0.96, 0.9)
    sun = bpy.data.objects.new("sun", sun_data)
    direction = canal_to_blender((-0.35, -0.75, 0.55)).normalized()  # direction the light travels
    sun.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.collection.objects.link(sun)


def setup_render(rect: dict, samples: int, scale: float) -> None:
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = samples
    sc.cycles.use_adaptive_sampling = False
    sc.cycles.seed = 1861
    sc.cycles.max_bounces = 6
    sc.cycles.diffuse_bounces = 3
    sc.cycles.glossy_bounces = 3
    sc.cycles.sample_clamp_indirect = 4.0
    # Blender's automatic thread count can come out as 1 in containers; ask for every core.
    sc.render.threads_mode = "FIXED"
    sc.render.threads = os.cpu_count() or 4
    sc.cycles.use_denoising = True
    sc.cycles.denoiser = "OPENIMAGEDENOISE"
    sc.cycles.denoising_input_passes = "RGB_ALBEDO_NORMAL"
    sc.render.resolution_x = rect["size"][0]
    sc.render.resolution_y = rect["size"][1]
    sc.render.resolution_percentage = int(round(scale * 100))
    sc.render.film_transparent = False
    sc.view_settings.view_transform = "Standard"
    vl = bpy.context.view_layer
    vl.use_pass_mist = True
    aov = vl.aovs.add()
    aov.name = "water"
    aov.type = "VALUE"

    sc.use_nodes = True
    tree = sc.node_tree
    for n in list(tree.nodes):
        tree.nodes.remove(n)
    rl = tree.nodes.new("CompositorNodeRLayers")
    comp = tree.nodes.new("CompositorNodeComposite")
    tree.links.new(rl.outputs["Image"], comp.inputs["Image"])
    fo = tree.nodes.new("CompositorNodeOutputFile")
    fo.base_path = str(OUT)
    fo.format.file_format = "OPEN_EXR"
    fo.format.color_depth = "32"
    fo.format.exr_codec = "ZIP"
    fo.file_slots.clear()
    for slot, socket in (("beauty", "Image"), ("water", "water"), ("mist", "Mist")):
        fo.file_slots.new(slot)
        tree.links.new(rl.outputs[socket], fo.inputs[slot])


# --- develop: scene-linear passes -> display sRGB ---------------------------------------

# three.js ACESFilmicToneMapping (src/renderers/shaders/ShaderChunk/tonemapping_pars_fragment)
ACES_IN = np.array([[0.59719, 0.35458, 0.04823], [0.07600, 0.90834, 0.01566], [0.02840, 0.13383, 0.83777]], np.float32)
ACES_OUT = np.array([[1.60475, -0.53108, -0.07367], [-0.10208, 1.10813, -0.00605], [-0.00327, -0.07276, 1.07602]], np.float32)
# Haze towards the horizon sky colour by Cycles' mist pass (aerial perspective over the water).
HAZE = 0.4
HAZE_COLOR = (0.60, 0.63, 0.66)
# Exposure: chosen so the far-bank plaster reads as daylight next to the interior's ACES at 1.0.
EXPOSURE = 2.2


def aces(rgb: np.ndarray, exposure: float) -> np.ndarray:
    c = rgb * (exposure / 0.6)
    c = c @ ACES_IN.T
    c = (c * (c + 0.0245786) - 0.000090537) / (c * (0.983729 * c + 0.4329510) + 0.238081)
    c = c @ ACES_OUT.T
    return np.clip(c, 0.0, 1.0)


def srgb_encode(c: np.ndarray) -> np.ndarray:
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(np.maximum(c, 0.0031308), 1 / 2.4) - 0.055)


def load_pass(name: str) -> np.ndarray:
    files = sorted(OUT.glob(f"{name}*.exr"))
    if not files:
        raise SystemExit(f"[backdrop] missing pass {name}: render first")
    img = bpy.data.images.load(str(files[-1]))
    w, h = img.size
    buf = np.empty(w * h * 4, np.float32)
    img.pixels.foreach_get(buf)
    bpy.data.images.remove(img)
    return np.flipud(buf.reshape(h, w, 4))  # top row first


def write_png(path: Path, rgba: np.ndarray) -> None:
    h, w, ch = rgba.shape
    raw = b"".join(b"\x00" + rgba[y].tobytes() for y in range(h))

    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6 if ch == 4 else 2, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    path.write_bytes(png)


def write_jpg(path: Path, rgb8: np.ndarray, quality: int = 86) -> None:
    h, w, _ = rgb8.shape
    img = bpy.data.images.new("preview", w, h, alpha=False)
    px = np.ones((h, w, 4), np.float32)
    px[:, :, :3] = np.flipud(rgb8).astype(np.float32) / 255.0
    img.pixels.foreach_set(px.ravel())
    sc = bpy.context.scene
    sc.render.image_settings.file_format = "JPEG"
    sc.render.image_settings.quality = quality
    img.filepath_raw = str(path)
    img.file_format = "JPEG"
    img.save(filepath=str(path), quality=quality)
    bpy.data.images.remove(img)


def develop(exposure: float) -> np.ndarray:
    beauty = load_pass("beauty")[:, :, :3]
    water = load_pass("water")[:, :, 0]
    mist = load_pass("mist")[:, :, 0]
    m = np.clip(mist, 0, 1)[:, :, None]
    haze = HAZE * (0.35 * m + 0.65 * m**3)  # light over the canal, heavier on the distant skyline
    lin = beauty * (1 - haze) + np.array(HAZE_COLOR, np.float32) * haze
    disp = srgb_encode(aces(lin, exposure))
    rng = np.random.default_rng(1861)
    dither = (rng.random(disp.shape, dtype=np.float32) - 0.5) / 255.0
    rgb8 = np.clip(np.round((disp + dither) * 255.0), 0, 255).astype(np.uint8)
    a8 = np.clip(np.round(np.clip(water, 0, 1) * 255.0), 0, 255).astype(np.uint8)
    rgba = np.dstack([rgb8, a8])
    write_png(OUT / "canal.png", rgba)
    write_jpg(HERE / "preview.jpg", rgb8)
    lum = disp @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    log(f"developed: exposure {exposure}, display luminance p5/p50/p95 = {np.percentile(lum, 5):.2f}/{np.percentile(lum, 50):.2f}/{np.percentile(lum, 95):.2f}, water {float((water > 0.5).mean()) * 100:.1f}% of pixels")
    return rgba


def input_hash() -> str:
    h = hashlib.sha256()
    for f in sorted(HERE.glob("*.py")):
        h.update(f.read_bytes())
    return h.hexdigest()[:16]


def main() -> None:
    args = parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    rect = plane_rect()
    D = rect["z"] - EYE[2]
    log(f"plane z={rect['z']} x {rect['x0']:.3f}..{rect['x1']:.3f} y {rect['y0']:.3f}..{rect['y1']:.3f}, {rect['size'][0]}x{rect['size'][1]} px, {rect['size'][0] / ((rect['x1'] - rect['x0']) / D):.0f} px per radian-ish (tan) at the eye")
    exposure = args.exposure if args.exposure is not None else EXPOSURE
    if not args.develop:
        reset()
        t0 = time.time()
        font = bpy.data.fonts.load(str(Path(bpy.utils.system_resource("DATAFILES", path="fonts")) / "Inter.woff2"))
        canal.build(font)
        setup_world()
        cam = setup_camera(rect)
        setup_render(rect, args.samples, args.scale)
        check_projection(cam, rect)
        tris = sum(len(o.data.polygons) for o in bpy.data.objects if o.type == "MESH")
        log(f"scene built in {time.time() - t0:.1f}s: {tris} faces")
        for f in OUT.glob("*.exr"):
            f.unlink()
        t0 = time.time()
        bpy.ops.render.render(write_still=False)
        log(f"rendered in {time.time() - t0:.0f}s at {args.samples} samples")
    rgba = develop(exposure)
    manifest = {
        "version": 1,
        "eye": list(EYE),
        "plane": {k: round(rect[k], 4) for k in ("z", "x0", "x1", "y0", "y1")},
        "size": [rgba.shape[1], rgba.shape[0]],
        "waterY": canal.WATER_Y,
        "samples": args.samples,
        "exposure": exposure,
        "blender": bpy.app.version_string,
        "inputHash": input_hash(),
    }
    (OUT / "canal.json").write_text(json.dumps(manifest, indent=2) + "\n")
    log(f"wrote {OUT / 'canal.png'} and canal.json")


if __name__ == "__main__":
    main()
