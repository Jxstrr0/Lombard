"""
Scripted item models. Nobody opens the Blender UI.

    blender --background --factory-startup --python art/items/build.py -- [--only id,id] [--kind coin] [--preview]

For every item def in src/data/items/*.json whose `model.placeholder` has a
builder in art/items/kinds/<placeholder>.py, builds the model and writes into
art/out/items/:
  <id>.glb          raw model (no compression), three.js axes, metres
  <id>.json         stats: triangles, draw calls, bounds, hotspot gaps
  <id>.png          (--preview) Cycles render, front and back, hotspots marked
scripts/items-pack.mjs then Draco-compresses the glbs (and KTX2s any textures)
into public/assets/items/. The game loads a def's glb when `model.glb` is set,
and falls back to the procedural placeholder otherwise.

A builder module exposes `build(item: lib.Item) -> None` (add meshes with the
lib helpers) and may set `AO_DISTANCE` (metres, default 0.002) or `AO = False`.
"""

from __future__ import annotations

import argparse
import importlib
import json
import math
import sys
import time
from pathlib import Path

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))
import lib  # noqa: E402

# Triangle budget for one inspected item (docs/04-ASSETS.md § Items).
MAX_TRIS = 60_000
# A hotspot further than this from the surface is reported as a problem.
MAX_HOTSPOT_GAP = 0.0015
PREVIEW_PX = int(__import__("os").environ.get("PREVIEW_PX", "512"))


def log(msg: str) -> None:
    print(f"[items] {msg}", flush=True)


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--only", default="", help="comma-separated item ids")
    p.add_argument("--kind", default="", help="only defs with this placeholder kind")
    p.add_argument("--out", default=str(ROOT / "art" / "out" / "items"))
    p.add_argument("--preview", action="store_true", help="also render <id>.png")
    p.add_argument("--no-ao", action="store_true", help="skip the AO bake (fast geometry check)")
    p.add_argument("--strict", action="store_true", help="exit 1 on budget or hotspot problems")
    return p.parse_args(argv)


def load_defs() -> list[dict]:
    defs = []
    for f in sorted((ROOT / "src" / "data" / "items").glob("*.json")):
        defs.extend(json.loads(f.read_text()))
    return defs


def builder(kind: str):
    path = HERE / "kinds" / f"{kind}.py"
    if not path.exists():
        return None
    return importlib.import_module(f"kinds.{kind}")


def render_preview(item: lib.Item, objs: list, path: Path) -> None:
    """Front and back views side by side, hotspots as small pink spheres."""
    s = bpy.context.scene
    s.render.engine = "CYCLES"
    s.cycles.samples = 32
    s.cycles.use_denoising = True
    s.render.resolution_x = 1024
    s.render.resolution_y = 512
    s.render.film_transparent = False
    s.view_settings.view_transform = "AgX"
    s.view_settings.exposure = -1.6
    s.render.image_settings.file_format = "PNG"
    world = s.world or bpy.data.worlds.new("w")
    s.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.05, 0.05, 0.05, 1)
    bg.inputs["Strength"].default_value = 0.35

    st = lib.stats(objs)
    lo, hi = Vector(st["min"]), Vector(st["max"])
    size = max((hi - lo).length, 0.005)
    center3 = (lo + hi) / 2

    pink = bpy.data.materials.new("hotspot")
    pink.use_nodes = True
    pink.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (1, 0.05, 0.35, 1)
    pink.node_tree.nodes["Principled BSDF"].inputs["Emission Color"].default_value = (1, 0.05, 0.35, 1)
    pink.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = 2
    for h in item.model.get("hotspots", []):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=size * 0.012, location=lib.THREE_TO_BLENDER @ Vector(h["position"]))
        bpy.context.object.data.materials.append(pink)

    # Two copies of the scene side by side would double the geometry; render twice instead.
    cam_data = bpy.data.cameras.new("cam")
    cam_data.lens = 85
    cam_data.clip_start = size * 0.02
    cam_data.clip_end = size * 50
    cam = bpy.data.objects.new("cam", cam_data)
    s.collection.objects.link(cam)
    s.camera = cam
    key = bpy.data.lights.new("key", "AREA")
    key.energy = 40 * size * size / 0.0025
    key.size = size * 2
    key_o = bpy.data.objects.new("key", key)
    s.collection.objects.link(key_o)
    fill = bpy.data.lights.new("fill", "AREA")
    fill.energy = key.energy * 0.4
    fill.size = size * 3
    fill_o = bpy.data.objects.new("fill", fill)
    s.collection.objects.link(fill_o)

    s.render.resolution_x = s.render.resolution_y = PREVIEW_PX
    halves = []
    for back in (False, True):
        # three.js view direction: front from +Z (slightly above/right), back from −Z.
        d = Vector((0.45, 0.35, 1.0) if not back else (-0.45, 0.35, -1.0)).normalized()
        eye3 = center3 + d * size * 2.6
        cam.location = lib.THREE_TO_BLENDER @ eye3
        target = lib.THREE_TO_BLENDER @ center3
        cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
        for o, offs in ((key_o, (0.8, 1.2, 0.9)), (fill_o, (-1.2, 0.2, 0.6))):
            v = Vector(offs) if not back else Vector((-offs[0], offs[1], -offs[2]))
            o.location = lib.THREE_TO_BLENDER @ (center3 + v * size * 2.5)
            o.rotation_euler = (target - o.location).to_track_quat("-Z", "Y").to_euler()
        half = path.with_name(f"{path.stem}.{'back' if back else 'front'}.png")
        s.render.filepath = str(half)
        bpy.ops.render.render(write_still=True)
        halves.append(half)

    # Stitch the two halves into one image.
    a = bpy.data.images.load(str(halves[0]))
    b = bpy.data.images.load(str(halves[1]))
    w, h = a.size
    out = bpy.data.images.new("preview", w * 2, h)
    import numpy as np

    pa = np.array(a.pixels[:]).reshape(h, w, 4)
    pb = np.array(b.pixels[:]).reshape(h, w, 4)
    out.pixels = np.concatenate([pa, pb], axis=1).ravel().tolist()
    out.filepath_raw = str(path)
    out.file_format = "PNG"
    out.save()
    for p in halves:
        p.unlink()


def build_one(d: dict, mod, out: Path, args: argparse.Namespace) -> dict:
    lib.reset()
    item = lib.Item(d)
    t0 = time.time()
    mod.build(item)
    ao = getattr(mod, "AO", True) and not args.no_ao
    objs = lib.finish(item, ao_distance=getattr(mod, "AO_DISTANCE", 0.002) if ao else None)
    st = lib.stats(objs)
    st["hotspotGaps"] = lib.hotspot_gaps(item, objs)
    st["seconds"] = round(time.time() - t0, 1)
    problems = []
    if st["tris"] > MAX_TRIS:
        problems.append(f"{st['tris']} tris > {MAX_TRIS}")
    for hid, gap in st["hotspotGaps"].items():
        if gap > MAX_HOTSPOT_GAP:
            problems.append(f"hotspot {hid} is {gap * 1000:.1f} mm from the surface")
    st["problems"] = problems
    lib.export_glb(out / f"{item.id}.glb")
    if args.preview:
        render_preview(item, objs, out / f"{item.id}.png")
    (out / f"{item.id}.json").write_text(json.dumps(st, indent=2) + "\n")
    log(f"{item.id}: {st['tris']} tris, {st['draws']} draws, {st['seconds']} s" + (f"  PROBLEMS: {'; '.join(problems)}" if problems else ""))
    return st


def main() -> None:
    args = parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    only = {s for s in args.only.split(",") if s}
    built, problems = 0, 0
    for d in load_defs():
        kind = d["model"]["placeholder"]
        if only and d["id"] not in only:
            continue
        if args.kind and kind != args.kind:
            continue
        mod = builder(kind)
        if mod is None:
            continue
        st = build_one(d, mod, out, args)
        built += 1
        problems += len(st["problems"])
    log(f"built {built} models, {problems} problems ({bpy.app.version_string})")
    if args.strict and problems:
        sys.exit(1)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        import traceback

        traceback.print_exc()
        sys.exit(1)
