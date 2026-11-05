"""
Shop props for the bake (docs/04-ASSETS.md § Props). Nobody opens the Blender UI.

    ~/blender/blender --background --factory-startup --python art/props/prepare.py -- [--only id,id] [--cache art/out/props]

For each prop in PROPS: downloads the Poly Haven 1k glTF (CC0), keeps the
listed parts, joins them into one mesh, puts the origin at the bottom centre
(Blender +Z up, the model's own front facing -Y, i.e. glTF +Z), decimates to
the triangle budget, keeps only the base colour texture (resized; the shop is
drawn unlit plus baked lighting, so normal/roughness maps would do nothing),
drops glass covers, lenses and flames, and writes bake/props/<id>.glb. Those glbs are committed bake inputs: CI never
downloads anything. bake/bake.py places them from `"shape": "prop"` entries in
bake/layout.json and bakes their lighting per vertex.
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

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "bake" / "props"

# id: Poly Haven asset; tris: decimation budget; tex: base colour size in px;
# keep / drop: regexes searched in the object names to keep (multi-object
# assets; default all) or to leave out; scale: fix a model's size; densify:
# longest edge in metres, for big flat faces (lighting is baked per vertex).
PROPS: dict[str, dict] = {
    # counter and behind it
    "cash_register": {"src": "CashRegister_01", "tris": 6000, "tex": 512},
    "television": {"src": "television_02", "tris": 2400, "tex": 512},
    "magnifier": {"src": "magnifying_glass_01", "tris": 2000, "tex": 256},
    "cardboard_box": {"src": "cardboard_box_01", "tris": 1500, "tex": 512},
    "security_camera": {"src": "security_camera_01", "tris": 3000, "tex": 256},
    # walls, cases, shelves
    "wall_clock": {"src": "wall_clock", "tris": 2000, "tex": 512},
    "mantel_clock": {"src": "mantel_clock_01", "tris": 4000, "tex": 512},
    "alarm_clock": {"src": "alarm_clock_01", "tris": 3000, "tex": 256},
    "boombox": {"src": "boombox", "tris": 4000, "tex": 512},
    "ukulele": {"src": "Ukulele_01", "tris": 3000, "tex": 512},
    "cassette_player": {"src": "portable_cassette_player", "tris": 2500, "tex": 256},
    "suitcase": {"src": "vintage_suitcase", "tris": 4000, "tex": 512, "keep": ["01"]},
    # shop floor and window
    "monobloc_chair": {"src": "plastic_monobloc_chair_01", "tris": 3400, "tex": 512},
    "potted_plant": {"src": "potted_plant_04", "tris": 4000, "tex": 512},
    # storeroom
    "food_cans": {"src": "russian_food_cans_01", "tris": 1400, "tex": 512},
    "kettle": {"src": "vintage_electric_kettle", "tris": 3000, "tex": 256},
    "multimeter": {"src": "retro_multimeter", "tris": 3000, "tex": 256},
    "toolbox": {"src": "metal_toolbox", "tris": 3000, "tex": 512},
    "crate": {"src": "plastic_crate_02", "tris": 3000, "tex": 512},
    "hand_truck": {"src": "hand_truck", "tris": 4000, "tex": 512},
    "broom": {"src": "plastic_broom", "tris": 2500, "tex": 256},
    "dustpan": {"src": "dustpan", "tris": 1500, "tex": 256},
    # clutter wave 2: stock on the right-hand shelves
    "video_camera": {"src": "vintage_video_camera", "tris": 2500, "tex": 512},
    "drill": {"src": "Drill_01", "tris": 1500, "tex": 256},
    "film_projector": {"src": "filmstrip_projector_8mm", "tris": 3000, "tex": 512, "drop": ["cable", "connector", "schuko"]},
    "binoculars": {"src": "binoculars", "tris": 2000, "tex": 256, "drop": ["strap"]},
    "rotary_phone": {"src": "vintage_telephone_wall_clock", "tris": 2500, "tex": 512},
    "brass_vase": {"src": "brass_vase_01", "tris": 1500, "tex": 256, "scale": 0.55},
    "ceramic_vase": {"src": "ceramic_vase_03", "tris": 1200, "tex": 256},
    "milk_jug": {"src": "jug_01", "tris": 1200, "tex": 256},
    "oil_lamp": {"src": "vintage_oil_lamp", "tris": 2000, "tex": 256, "scale": 0.6},
    # clutter wave 2: the tall glass cases
    "brass_binocular": {"src": "vintage_binocular", "tris": 2000, "tex": 256},
    "microscope": {"src": "vintage_microscope", "tris": 2500, "tex": 256},
    "compass": {"src": "seadogs_compass", "tris": 1200, "tex": 256},
    "candleholders": {"src": "brass_candleholders", "tris": 2000, "tex": 256, "keep": ["candleholder_02"]},
    "lighter": {"src": "vintage_lighter", "tris": 600, "tex": 128},
    "spectacles": {"src": "round_spectacles", "tris": 1000, "tex": 128},
    "chess_set": {"src": "chess_set", "tris": 4000, "tex": 512},
    "tea_set": {"src": "tea_set_01", "tris": 1500, "tex": 512, "keep": ["teapot"]},
    # clutter wave 2: counter, walls, ceiling
    "notepads": {"src": "office_notepads", "tris": 700, "tex": 256, "keep": ["yellow_pad"], "densify": 0.06},
    "stapler": {"src": "vintage_stapler", "tris": 1000, "tex": 128},
    "pen_cup": {"src": "stationery_supplies", "tris": 1500, "tex": 256, "keep": ["pencilcup"]},
    "painting": {"src": "hanging_picture_frame_02", "tris": 1000, "tex": 512, "densify": 0.06},
    "old_painting": {"src": "fancy_picture_frame_01", "tris": 1000, "tex": 512, "densify": 0.06},
    "ceiling_fan": {"src": "ceiling_fan", "tris": 2500, "tex": 256},
    # clutter wave 2: storeroom
    "binder": {"src": "binder_notebook", "tris": 1500, "tex": 256, "keep": ["_closed$"]},
    "microwave": {"src": "vintage_microwave", "tris": 2000, "tex": 256, "scale": 0.5},
    "army_crate": {"src": "old_military_crate", "tris": 1500, "tex": 512, "keep": ["_a$"]},
    "cleaner_bottle": {"src": "multi_cleaner_bottle", "tris": 1000, "tex": 256},
    "jerrycan": {"src": "plastic_jerrycan", "tris": 1200, "tex": 256},
    "trash_bag": {"src": "trashbag", "tris": 1200, "tex": 256},
}


def log(msg: str) -> None:
    print(f"[props] {msg}", flush=True)


def fetch(asset: str, cache: Path) -> Path:
    """Download the 1k glTF set (gltf, bin, textures) into cache/<asset>/."""
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


def reset() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


def base_colour_image(mat: bpy.types.Material) -> bpy.types.Image | None:
    if not mat or not mat.use_nodes:
        return None
    bsdf = next((n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if not bsdf:
        return None
    links = bsdf.inputs["Base Color"].links
    seen = [links[0].from_node] if links else []
    while seen:
        n = seen.pop()
        if n.type == "TEX_IMAGE":
            return n.image
        for inp in n.inputs:
            seen += [l.from_node for l in inp.links]
    return None


def simplify_material(mat: bpy.types.Material, prop_id: str, idx: int, tex_px: int, out_dir: Path) -> None:
    """Principled BSDF with only the base colour texture (or colour), metallic 0
    so the diffuse bake sees it, marked as a baked surface for the game."""
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    img = base_colour_image(mat)
    colour = tuple(bsdf.inputs["Base Color"].default_value)
    for n in list(nt.nodes):
        if n not in (bsdf,) and n.type != "OUTPUT_MATERIAL":
            nt.nodes.remove(n)
    bsdf.inputs["Base Color"].default_value = colour
    bsdf.inputs["Metallic"].default_value = 0.0
    bsdf.inputs["Roughness"].default_value = 0.6
    bsdf.inputs["Alpha"].default_value = 1.0
    if img:
        img.scale(tex_px, tex_px)
        path = out_dir / f"{prop_id}_{idx}.jpg"
        img.filepath_raw = str(path)
        img.file_format = "JPEG"
        img.save()
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = bpy.data.images.load(str(path))
        uv = nt.nodes.new("ShaderNodeUVMap")
        uv.uv_map = "uv0"
        nt.links.new(uv.outputs["UV"], tex.inputs["Vector"])
        nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    mat.name = f"prop_{prop_id}_{idx}"
    mat["kind"] = "baked"


def densify(me: bpy.types.Mesh, max_len: float) -> None:
    """Subdivide (UVs interpolated) the faces that are big in both directions
    (shortest edge over max_len metres) until none is; thin faces are left."""
    bm = bmesh.new()
    bm.from_mesh(me)
    for _ in range(6):
        big = [f for f in bm.faces if min(e.calc_length() for e in f.edges) > max_len]
        long = list({e for f in big for e in f.edges})
        if not long:
            break
        bmesh.ops.subdivide_edges(bm, edges=long, cuts=1, use_grid_fill=True)
        bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3])
    bm.to_mesh(me)
    bm.free()


def prepare(prop_id: str, spec: dict, cache: Path, tmp: Path) -> None:
    reset()
    gltf = fetch(spec["src"], cache)
    bpy.ops.import_scene.gltf(filepath=str(gltf))
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    keep = spec.get("keep")
    if keep:
        meshes = [o for o in meshes if any(re.search(k, o.name) for k in keep)]
    drop = spec.get("drop")
    if drop:
        meshes = [o for o in meshes if not any(re.search(k, o.name) for k in drop)]
    if not meshes:
        raise RuntimeError(f"{prop_id}: nothing to keep")
    # bake every transform into the mesh, then join
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
    while len(me.uv_layers) > 1:
        me.uv_layers.remove(me.uv_layers[-1])
    if me.uv_layers:
        me.uv_layers[0].name = "uv0"
    # no vertex colours: the bake adds the one the game reads (baked lighting)
    for attr in list(me.color_attributes):
        me.color_attributes.remove(attr)
    if spec.get("scale"):
        me.transform(Matrix.Scale(spec["scale"], 4))
    # origin at the bottom centre
    co = [v.co for v in me.vertices]
    lo = Vector((min(c.x for c in co), min(c.y for c in co), min(c.z for c in co)))
    hi = Vector((max(c.x for c in co), max(c.y for c in co), max(c.z for c in co)))
    me.transform(Matrix.Translation(Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z)) * -1))
    # triangulate and decimate to the budget
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
    # drop glass covers, lenses and flames (clock faces, gauges, camera, lamps):
    # drawn opaque they'd hide what's behind them (or glow as solid cards), and
    # the shop has no per-prop transparency
    glass = {i for i, m in enumerate(me.materials) if m and re.search(r"_glass(\.\d+)?$|lens|flame", m.name.lower())}
    if glass:
        bm = bmesh.new()
        bm.from_mesh(me)
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index in glass], context="FACES")
        bm.to_mesh(me)
        bm.free()
    # big flat faces (a canvas, a pad of paper) get their lighting from their
    # corners only (the bake is per vertex), so split edges longer than this
    if spec.get("densify"):
        densify(me, spec["densify"])
    # drop unused material slots, simplify the rest
    used = {p.material_index for p in me.polygons}
    for i in sorted(range(len(me.materials)), reverse=True):
        if i not in used:
            ob.active_material_index = i
            bpy.ops.object.material_slot_remove()
    for i, mat in enumerate(me.materials):
        mat = mat.copy()
        me.materials[i] = mat
        simplify_material(mat, prop_id, i, spec["tex"], tmp)
    size = hi - lo
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f"{prop_id}.glb"
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        export_extras=True,
        export_texcoords=True,
        export_normals=True,
        export_tangents=False,
        export_materials="EXPORT",
        export_image_format="JPEG",
        export_jpeg_quality=88,
        export_cameras=False,
        export_lights=False,
        export_yup=True,
        export_apply=True,
    )
    log(f"{path.relative_to(ROOT)}: {len(me.polygons)} tris (from {tris}), {len(me.materials)} materials, "
        f"{size.x:.2f} x {size.y:.2f} x {size.z:.2f} m, {path.stat().st_size // 1024} KB")


def main() -> None:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--only", default="")
    p.add_argument("--cache", default=str(ROOT / "art" / "out" / "props"))
    args = p.parse_args(argv)
    only = {s for s in args.only.split(",") if s}
    cache = Path(args.cache)
    tmp = cache / "_textures"
    tmp.mkdir(parents=True, exist_ok=True)
    for prop_id, spec in PROPS.items():
        if only and prop_id not in only:
            continue
        prepare(prop_id, spec, cache, tmp)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        import traceback

        traceback.print_exc()
        sys.exit(1)
