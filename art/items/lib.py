"""
Shared helpers for the scripted item models (art/items/build.py).

Authoring convention: every helper takes **three.js item coordinates**, the
same ones src/render/items.ts documents and the hotspots in src/data/items use:
metres, centred on the origin, +Y up, front faces +Z. `finish()` converts the
whole scene to Blender's Z-up once before export, and the glTF exporter
converts it back, so authors never think in Blender axes.

A builder (art/items/kinds/<placeholder>.py) gets an `Item` and adds meshes
with these helpers. Relief (lettering, emblems, beading) is real geometry; an
ambient-occlusion pass bakes dirt into the recesses as vertex colours (COLOR_0),
which three multiplies into the base colour. No UVs or textures are needed
unless a builder adds an image (e.g. a printed screen).
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable, Sequence

import bmesh
import bpy
from mathutils import Matrix, Vector

Vec3 = Sequence[float]
Vec2 = Sequence[float]

# three.js (x, y, z) -> Blender (x, -z, y)
THREE_TO_BLENDER = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))

FONT_DIR = Path(bpy.utils.system_resource("DATAFILES", path="fonts"))


# ---------------------------------------------------------------------------
# Item context


@dataclass
class Item:
    """One item def being built. `d` is the raw JSON def from src/data/items."""

    d: dict
    materials: dict[str, bpy.types.Material] = field(default_factory=dict)
    #: Edge length of the baked AO texture, px (a builder may change it before adding materials).
    ao_size: int = 512
    _ao: bpy.types.Image | None = None

    def ao_image(self) -> bpy.types.Image:
        if self._ao is None:
            self._ao = bpy.data.images.new(f"{self.id}_ao", self.ao_size, self.ao_size, alpha=False)
            self._ao.generated_color = (1, 1, 1, 1)
        return self._ao

    @property
    def id(self) -> str:
        return self.d["id"]

    @property
    def model(self) -> dict:
        return self.d["model"]

    @property
    def color(self) -> str:
        return self.model["color"]

    def hotspot(self, hid: str) -> Vector | None:
        for h in self.model.get("hotspots", []):
            if h["id"] == hid:
                return Vector(h["position"])
        return None


# ---------------------------------------------------------------------------
# Scene


def reset() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _fonts.clear()
    _piece[0] = 0
    s = bpy.context.scene
    s.unit_settings.system = "METRIC"
    s.unit_settings.scale_length = 1.0


def _link(obj: bpy.types.Object) -> bpy.types.Object:
    bpy.context.scene.collection.objects.link(obj)
    return obj


def mesh_object(name: str, bm: bmesh.types.BMesh, mat: bpy.types.Material | None) -> bpy.types.Object:
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if mat is not None:
        me.materials.append(mat)
    return _link(bpy.data.objects.new(name, me))


# ---------------------------------------------------------------------------
# Materials


def srgb_to_linear(c: float) -> float:
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_rgba(hex_color: str) -> tuple[float, float, float, float]:
    h = hex_color.lstrip("#")
    r, g, b = (int(h[i : i + 2], 16) / 255 for i in (0, 2, 4))
    return (srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b), 1.0)


def shade(hex_color: str, k: float) -> str:
    """Scale an sRGB hex colour (k < 1 darker, > 1 lighter, clamped)."""
    h = hex_color.lstrip("#")
    rgb = [min(255, max(0, round(int(h[i : i + 2], 16) * k))) for i in (0, 2, 4)]
    return "#" + "".join(f"{v:02x}" for v in rgb)


def material(
    it: Item,
    name: str,
    color: str,
    *,
    metal: float = 0.0,
    rough: float = 0.5,
    ao: bool = True,
    emissive: str | None = None,
    alpha: float = 1.0,
    double_sided: bool = False,
) -> bpy.types.Material:
    """A Principled material, cached per item by name.

    With `ao` the item's baked AO texture multiplies the colour (glTF: baseColorTexture
    × baseColorFactor), darkening recesses as dirt and wear would. Turn it off for
    glass, screens and other flat, clean parts. Every material gets the AO image as
    its active node anyway, because Cycles bakes into each material's active image."""
    key = name
    if key in it.materials:
        return it.materials[key]
    m = bpy.data.materials.new(f"{it.id}:{name}")
    m.use_nodes = True
    m.use_backface_culling = not double_sided
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = hex_rgba(color)
    bsdf.inputs["Metallic"].default_value = metal
    bsdf.inputs["Roughness"].default_value = rough
    if emissive:
        bsdf.inputs["Emission Color"].default_value = hex_rgba(emissive)
        bsdf.inputs["Emission Strength"].default_value = 1.0
    if alpha < 1:
        bsdf.inputs["Alpha"].default_value = alpha
        m.surface_render_method = "BLENDED"
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = it.ao_image()
    tex.interpolation = "Linear"
    nt.nodes.active = tex
    if ao:
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        mix.inputs["Factor"].default_value = 1.0
        mix.inputs["B"].default_value = hex_rgba(color)
        nt.links.new(tex.outputs["Color"], mix.inputs["A"])
        nt.links.new(mix.outputs["Result"], bsdf.inputs["Base Color"])
    m["lombard_ao"] = ao
    it.materials[key] = m
    return m


# ---------------------------------------------------------------------------
# Primitives (all in three.js item coordinates)


def lathe(
    name: str,
    profile: Sequence[Vec2],
    mat: bpy.types.Material | None,
    *,
    segments: int = 64,
    axis: str = "z",
    center: Vec3 = (0, 0, 0),
    smooth: bool = True,
    cap: bool = True,
) -> bpy.types.Object:
    """Revolve a profile of (radius, height) points around `axis` ('x', 'y' or 'z').

    The profile runs in order; a point with radius 0 closes onto the axis. With
    `cap`, ends that don't reach the axis are filled. `height` is measured along
    the axis from `center`."""
    bm = bmesh.new()
    rings = []
    for r, h in profile:
        ring = []
        n = 1 if r <= 1e-9 else segments
        for i in range(n):
            a = 2 * math.pi * i / segments
            u, v = r * math.cos(a), r * math.sin(a)
            if axis == "z":
                p = (u, v, h)
            elif axis == "y":
                p = (u, h, -v)
            else:
                p = (h, u, v)
            ring.append(bm.verts.new(Vector(p) + Vector(center)))
        rings.append(ring)
    for a, b in zip(rings, rings[1:]):
        if len(a) == 1 and len(b) == 1:
            continue
        for i in range(segments):
            j = (i + 1) % segments
            if len(a) == 1:
                bm.faces.new((a[0], b[i], b[j]))
            elif len(b) == 1:
                bm.faces.new((a[i], b[0], a[j]))
            else:
                bm.faces.new((a[i], b[i], b[j], a[j]))
    if cap:
        for ring in (rings[0], rings[-1]):
            if len(ring) > 2:
                bm.faces.new(ring)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if smooth:
        for f in bm.faces:
            f.smooth = True
    obj = mesh_object(name, bm, mat)
    return obj


def cylinder(
    name: str,
    radius: float,
    depth: float,
    mat: bpy.types.Material | None,
    *,
    segments: int = 64,
    axis: str = "z",
    center: Vec3 = (0, 0, 0),
    bevel: float = 0.0,
) -> bpy.types.Object:
    """A capped cylinder centred on `center`, `depth` along `axis`, optional rounded edges."""
    h = depth / 2
    if bevel > 0:
        b = min(bevel, radius * 0.5, h * 0.95)
        prof = [(0, -h), (radius - b, -h)]
        for k in range(1, 4):
            a = (math.pi / 2) * k / 4
            prof.append((radius - b + b * math.sin(a), -h + b - b * math.cos(a)))
        prof += [(radius, -h + b), (radius, h - b)]
        for k in range(1, 4):
            a = (math.pi / 2) * k / 4
            prof.append((radius - b + b * math.cos(a), h - b + b * math.sin(a)))
        prof += [(radius - b, h), (0, h)]
    else:
        prof = [(0, -h), (radius, -h), (radius, h), (0, h)]
    obj = lathe(name, prof, mat, segments=segments, axis=axis, center=center, smooth=True, cap=False)
    auto_smooth(obj, 50)
    return obj


def box(
    name: str,
    size: Vec3,
    mat: bpy.types.Material | None,
    *,
    center: Vec3 = (0, 0, 0),
    bevel: float = 0.0,
    bevel_segments: int = 3,
) -> bpy.types.Object:
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2])) + Vector(center)
    obj = mesh_object(name, bm, mat)
    if bevel > 0:
        add_bevel(obj, bevel, bevel_segments)
    return obj


def polygon(
    name: str,
    pts: Sequence[Vec2],
    depth: float,
    mat: bpy.types.Material | None,
    *,
    z: float = 0.0,
    facing: int = 1,
    bevel: float = 0.0,
    xform: Matrix | None = None,
    base: bool = True,
) -> bpy.types.Object:
    """A flat 2D outline (XY plane, points in order) extruded by `depth`.
    `base=False` for relief on a surface (see `prism`).

    The back sits at `z` and the top at `z + facing * depth` (facing +1 = towards
    +Z, -1 = towards -Z). `bevel` rounds the top edges, which reads as struck relief."""
    bm = bmesh.new()
    prism(bm, pts, z, jitter(facing * depth), base=base)
    obj = mesh_object(name, bm, mat)
    if xform is not None:
        obj.data.transform(xform)
    if bevel > 0:
        add_bevel(obj, bevel, 2)
    return obj


def stroke(
    name: str,
    pts: Sequence[Vec2],
    width: float,
    depth: float,
    mat: bpy.types.Material | None,
    *,
    z: float = 0.0,
    facing: int = 1,
    closed: bool = False,
    round_caps: bool = True,
) -> bpy.types.Object:
    """A raised line of `width` along a 2D polyline (XY plane), like an engraved or struck line.

    Built from overlapping extruded quads (plus round joints), which is robust and
    renders fine; the pieces are not boolean-merged."""
    bm = bmesh.new()
    hw = width / 2
    segs = list(zip(pts, pts[1:])) + ([(pts[-1], pts[0])] if closed else [])
    for a, b in segs:
        ax, ay = a
        bx, by = b
        dx, dy = bx - ax, by - ay
        ln = math.hypot(dx, dy) or 1e-9
        nx, ny = -dy / ln * hw, dx / ln * hw
        quad = [(ax + nx, ay + ny), (bx + nx, by + ny), (bx - nx, by - ny), (ax - nx, ay - ny)]
        _extrude_into(bm, quad, z, facing * depth)
    if round_caps:
        for p in pts:
            circ = [(p[0] + hw * math.cos(2 * math.pi * i / 10), p[1] + hw * math.sin(2 * math.pi * i / 10)) for i in range(10)]
            _extrude_into(bm, circ, z, facing * depth)
    return mesh_object(name, bm, mat)


_piece = [0]


def jitter(dz: float) -> float:
    """Every raised piece gets a slightly different height (0–4.8 % of it, deterministic).

    Two coincident top faces occlude each other in the AO bake and both turn
    black where they overlap; offset ones don't (the lower one is simply hidden)."""
    _piece[0] += 1
    return dz * (1 + 0.012 * (_piece[0] % 5))


def _extrude_into(bm: bmesh.types.BMesh, pts: Sequence[Vec2], z: float, dz: float) -> None:
    """A closed prism: outline `pts` at height z, cap at z + dz, outward-facing winding."""
    prism(bm, pts, z, jitter(dz), base=False)


def prism(bm: bmesh.types.BMesh, pts: Sequence[Vec2], z: float, dz: float, base: bool = True) -> None:
    """Add a prism to `bm` with explicit winding (no normal recalculation, which is
    unreliable for many overlapping pieces in one mesh).

    `base=False` leaves out the face at z: relief sitting on a surface never shows
    it, and every face left out is one less tiny island in the AO texture."""
    pts = list(pts)
    area = sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1] for i in range(len(pts)))
    if abs(area) < 1e-14 or abs(dz) < 1e-12:
        return
    if area < 0:
        pts.reverse()  # counter-clockwise seen from +Z
    lo = [bm.verts.new((p[0], p[1], z)) for p in pts]
    hi = [bm.verts.new((p[0], p[1], z + dz)) for p in pts]
    up = dz > 0
    # the cap at z + dz faces away from z; the base faces the other way
    try:
        bm.faces.new(hi if up else hi[::-1])
        if base:
            bm.faces.new(lo[::-1] if up else lo)
    except ValueError:
        return
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        quad = (lo[i], lo[j], hi[j], hi[i])
        bm.faces.new(quad if up else quad[::-1])


def dots(
    name: str,
    centers: Iterable[Vec2],
    radius: float,
    height: float,
    mat: bpy.types.Material | None,
    *,
    z: float = 0.0,
    facing: int = 1,
    segments: int = 8,
) -> bpy.types.Object:
    """Small domed beads (beaded borders, rivets) on the XY plane."""
    bm = bmesh.new()
    for c in centers:
        hh = jitter(height)
        prof = [(radius, 0), (radius * 0.92, hh * 0.45), (radius * 0.6, hh * 0.85), (0, hh)]
        rings = []
        for r, h in prof:
            n = 1 if r == 0 else segments
            rings.append(
                [
                    bm.verts.new((c[0] + r * math.cos(2 * math.pi * i / segments), c[1] + r * math.sin(2 * math.pi * i / segments), z + facing * h))
                    for i in range(n)
                ]
            )
        for a, b in zip(rings, rings[1:]):
            for i in range(segments):
                j = (i + 1) % segments
                if len(b) == 1:
                    bm.faces.new((a[i], a[j], b[0]) if facing > 0 else (a[j], a[i], b[0]))
                else:
                    bm.faces.new((a[i], a[j], b[j], b[i]) if facing > 0 else (a[j], a[i], b[i], b[j]))
    for f in bm.faces:
        f.smooth = True
    return mesh_object(name, bm, mat)


# ---------------------------------------------------------------------------
# Text


_fonts: dict[str, bpy.types.VectorFont] = {}


def font(name: str = "Inter.woff2") -> bpy.types.VectorFont:
    """A font from Blender's bundled datafiles (Inter and DejaVu Sans Mono both cover Cyrillic)."""
    if name not in _fonts:
        _fonts[name] = bpy.data.fonts.load(str(FONT_DIR / name), check_existing=True)
    return _fonts[name]


def text(
    name: str,
    body: str,
    size: float,
    depth: float,
    mat: bpy.types.Material | None,
    *,
    pos: Vec3 = (0, 0, 0),
    rot_z: float = 0.0,
    facing: int = 1,
    align: str = "CENTER",
    valign: str = "CENTER",
    font_name: str = "Inter.woff2",
    bold: float = 0.0,
    spacing: float = 1.0,
    bevel: float = 0.0,
    base: bool = False,
) -> bpy.types.Object:
    """Raised lettering in the XY plane at `pos`, reading upright when seen from `facing`
    (+1 = from +Z, the front; -1 = from -Z, the back). Returns a mesh object.
    The back faces of the letters are dropped unless `base` (they sit on the surface).

    Blender fills a text curve even-odd, and many of Inter's glyphs are drawn with
    contours that cross themselves (e, R, A, K, N, И, Я, Ж …), so that fill punches
    holes where strokes overlap. Unbevelled text is therefore filled by
    `_text_filled` (end of this file): crossing contours are cut into simple loops
    and each outer loop is filled with only its own counters as holes."""
    if bevel <= 0:
        return _text_filled(name, body, size, depth, mat, pos=pos, rot_z=rot_z, facing=facing, align=align, valign=valign, font_name=font_name, bold=bold, spacing=spacing, base=base)
    cu = bpy.data.curves.new(name, "FONT")
    cu.body = body
    cu.font = font(font_name)
    cu.size = size
    depth = abs(jitter(depth))
    cu.extrude = depth / 2
    cu.offset = bold * size * 0.02
    cu.align_x = align
    cu.align_y = valign
    cu.space_character = spacing
    cu.resolution_u = 3
    if bevel > 0:
        cu.bevel_depth = bevel
        cu.bevel_resolution = 1
    obj = _link(bpy.data.objects.new(name, cu))
    obj.location = (pos[0], pos[1], pos[2] + facing * depth / 2)
    obj.rotation_euler = (0, math.pi if facing < 0 else 0, rot_z if facing > 0 else -rot_z)
    out = to_mesh(obj)
    if mat is not None:
        assign(out, mat)
    if not base:
        bm = bmesh.new()
        bm.from_mesh(out.data)
        back = Vector((0, 0, -facing))
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.normal.dot(back) > 0.99 and abs(f.calc_center_median().z - pos[2]) < depth * 0.25], context="FACES_ONLY")
        bm.to_mesh(out.data)
        bm.free()
    return out


def arc_text(
    name: str,
    body: str,
    radius: float,
    size: float,
    depth: float,
    mat: bpy.types.Material | None,
    *,
    center: Vec2 = (0, 0),
    z: float = 0.0,
    start: float = math.pi / 2,
    span: float | None = None,
    facing: int = 1,
    inward: bool = False,
    font_name: str = "Inter.woff2",
    spacing: float = 0.62,
) -> list[bpy.types.Object]:
    """Lettering around a circle, as on coin and medal rims.

    The text is centred on angle `start` (radians, 0 = +X, π/2 = top, as seen from
    `facing`). Letters run clockwise along the top (reading left to right) with
    their feet towards the centre; `inward=True` puts their heads towards the centre
    instead, for text along the bottom that reads left to right. `span` is the arc
    used, default from `spacing` × size per letter."""
    chars = [c for c in body]
    step = (span / max(len(chars) - 1, 1)) if span else (size * spacing / radius)
    total = step * (len(chars) - 1)
    objs = []
    for i, ch in enumerate(chars):
        if ch == " ":
            continue
        if not inward:
            a = start + total / 2 - i * step
            rot = a - math.pi / 2
        else:
            a = start - total / 2 + i * step
            rot = a + math.pi / 2
        # seen from the back, mirror the angle so the text still reads correctly
        ax = a if facing > 0 else math.pi - a
        px = center[0] + radius * math.cos(ax)
        py = center[1] + radius * math.sin(a)
        objs.append(
            text(f"{name}.{i}", ch, size, depth, mat, pos=(px, py, z), rot_z=rot, facing=facing, font_name=font_name, valign="CENTER")
        )
    return objs


def to_mesh(obj: bpy.types.Object) -> bpy.types.Object:
    """Convert a curve/text object to a mesh object (materials kept)."""
    dg = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev, depsgraph=dg)
    me.transform(obj.matrix_world)
    new = _link(bpy.data.objects.new(obj.name + ".mesh", me))
    bpy.data.objects.remove(obj)
    return new


def assign(objs: Iterable[bpy.types.Object] | bpy.types.Object, mat: bpy.types.Material) -> None:
    for o in [objs] if isinstance(objs, bpy.types.Object) else objs:
        o.data.materials.clear()
        o.data.materials.append(mat)


# ---------------------------------------------------------------------------
# Modifiers / transforms


def add_bevel(obj: bpy.types.Object, width: float, segments: int = 2, angle: float = 40) -> None:
    mod = obj.modifiers.new("bevel", "BEVEL")
    mod.width = width
    mod.segments = segments
    mod.limit_method = "ANGLE"
    mod.angle_limit = math.radians(angle)
    mod.harden_normals = False
    apply_modifiers(obj)
    auto_smooth(obj, angle + 5)


def apply_modifiers(obj: bpy.types.Object) -> None:
    dg = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev, depsgraph=dg)
    old = obj.data
    obj.modifiers.clear()
    obj.data = me
    bpy.data.meshes.remove(old)


def auto_smooth(obj: bpy.types.Object, angle_deg: float = 35) -> None:
    """Smooth shading with hard edges above `angle_deg` (Blender 4.1+ replacement for auto smooth)."""
    me = obj.data
    me.shade_smooth()
    bm = bmesh.new()
    bm.from_mesh(me)
    lim = math.radians(angle_deg)
    for e in bm.edges:
        if len(e.link_faces) == 2 and e.calc_face_angle(0) > lim:
            e.smooth = False
    bm.to_mesh(me)
    bm.free()
    me.set_sharp_from_angle(angle=lim)


def transform(objs: Iterable[bpy.types.Object] | bpy.types.Object, m: Matrix) -> None:
    """Apply a matrix (three.js item space) to object data."""
    for o in [objs] if isinstance(objs, bpy.types.Object) else objs:
        o.data.transform(o.matrix_world)
        o.matrix_world = Matrix.Identity(4)
        o.data.transform(m)


def rot(axis: str, angle: float) -> Matrix:
    return Matrix.Rotation(angle, 4, axis.upper())


def at(x: float, y: float, z: float) -> Matrix:
    return Matrix.Translation((x, y, z))


def ring_points(n: int, radius: float, center: Vec2 = (0, 0), phase: float = 0.0) -> list[tuple[float, float]]:
    return [(center[0] + radius * math.cos(phase + 2 * math.pi * i / n), center[1] + radius * math.sin(phase + 2 * math.pi * i / n)) for i in range(n)]


def star_points(n: int, r_out: float, r_in: float, center: Vec2 = (0, 0), phase: float = math.pi / 2) -> list[tuple[float, float]]:
    pts = []
    for i in range(n * 2):
        r = r_out if i % 2 == 0 else r_in
        a = phase + math.pi * i / n
        pts.append((center[0] + r * math.cos(a), center[1] + r * math.sin(a)))
    return pts


# ---------------------------------------------------------------------------
# Finish: join, AO, convert axes


def mesh_objects() -> list[bpy.types.Object]:
    return [o for o in bpy.context.scene.objects if o.type == "MESH"]


def join_all() -> bpy.types.Object:
    """Merge every mesh into one object (materials kept as slots; the glTF exporter
    writes one primitive, so one draw call, per material)."""
    objs = mesh_objects()
    for o in objs:
        if not o.data.materials:
            raise RuntimeError(f"mesh {o.name} has no material")
        o.data.transform(o.matrix_world)
        o.matrix_world = Matrix.Identity(4)
    if len(objs) > 1:
        with bpy.context.temp_override(active_object=objs[0], selected_editable_objects=objs, object=objs[0]):
            bpy.ops.object.join()
    obj = objs[0]
    obj.name = "item"
    return obj


def unwrap(obj: bpy.types.Object, margin: float) -> None:
    """Smart UV project into the single UV set the AO texture uses."""
    me = obj.data
    while me.uv_layers:
        me.uv_layers.remove(me.uv_layers[0])
    me.uv_layers.new(name="uv")
    vl = bpy.context.view_layer
    for o in vl.objects:
        o.select_set(False)
    vl.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=margin, area_weight=0.0, scale_to_bounds=False)
    bpy.ops.uv.pack_islands(rotate=True, margin=margin)
    bpy.ops.object.mode_set(mode="OBJECT")


def bake_ao(item: Item, obj: bpy.types.Object, *, distance: float, samples: int = 64, strength: float = 0.85) -> None:
    """Bake ambient occlusion into the item's AO image (Cycles, CPU, fixed seed).

    `strength` < 1 lifts the result towards white so recesses darken without going black."""
    import numpy as np

    img = item.ao_image()
    s = bpy.context.scene
    s.render.engine = "CYCLES"
    s.cycles.device = "CPU"
    s.cycles.samples = samples
    s.cycles.seed = 1907
    s.world = s.world or bpy.data.worlds.new("w")
    s.world.light_settings.distance = distance
    bk = s.render.bake
    bk.use_selected_to_active = False
    bk.target = "IMAGE_TEXTURES"
    bk.margin = 6
    bk.margin_type = "EXTEND"
    with bpy.context.temp_override(selected_objects=[obj], active_object=obj, object=obj, selected_editable_objects=[obj]):
        bpy.ops.object.bake(type="AO")
    px = np.array(img.pixels[:], dtype=np.float32).reshape(-1, 4)
    v = 1 - strength * (1 - px[:, 0])
    px[:, 0] = px[:, 1] = px[:, 2] = v
    px[:, 3] = 1
    img.pixels = px.ravel().tolist()
    img.file_format = "PNG"
    img.pack()


def finish(item: Item, *, ao_distance: float | None = None, ao_strength: float = 0.85) -> list[bpy.types.Object]:
    """Join everything, convert to Blender axes, unwrap and bake AO (unless ao_distance is None)."""
    obj = join_all()
    obj.data.validate()
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-7)
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.transform(THREE_TO_BLENDER)
    obj.data.update()
    if ao_distance:
        unwrap(obj, margin=4 / item.ao_size)
        bake_ao(item, obj, distance=ao_distance, strength=ao_strength)
    else:
        # No bake: drop the (white) AO image so the export carries no texture.
        for m in obj.data.materials:
            nt = m.node_tree
            for n in [n for n in nt.nodes if n.type in ("TEX_IMAGE", "MIX")]:
                nt.nodes.remove(n)
    return [obj]


def stats(objs: list[bpy.types.Object]) -> dict:
    tris = 0
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    for o in objs:
        me = o.data
        me.calc_loop_triangles()
        tris += len(me.loop_triangles)
        for v in me.vertices:
            # back to three.js axes: Blender (x, y, z) -> three (x, z, -y)
            p = Vector((v.co.x, v.co.z, -v.co.y))
            lo = Vector(map(min, lo, p))
            hi = Vector(map(max, hi, p))
    draws = sum(len({p.material_index for p in o.data.polygons}) for o in objs)
    return {"tris": tris, "draws": draws, "min": [round(c, 5) for c in lo], "max": [round(c, 5) for c in hi]}


def hotspot_gaps(item: Item, objs: list[bpy.types.Object]) -> dict[str, float]:
    """Distance (metres) from each hotspot to the nearest surface; large gaps mean a
    hotspot floats in the air or is buried, so the model or the def needs adjusting."""
    out = {}
    dg = bpy.context.evaluated_depsgraph_get()
    for h in item.model.get("hotspots", []):
        x, y, z = h["position"]
        p = THREE_TO_BLENDER @ Vector((x, y, z))
        best = 1e9
        for o in objs:
            ok, loc, _n, _i = o.evaluated_get(dg).closest_point_on_mesh(p)
            if ok:
                best = min(best, (loc - p).length)
        out[h["id"]] = round(best, 5)
    return out


def export_glb(path: Path) -> None:
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=False,
        export_extras=False,
        export_texcoords=True,
        export_normals=True,
        export_tangents=False,
        export_materials="EXPORT",
        export_vertex_color="NONE",
        export_image_format="AUTO",
        export_cameras=False,
        export_lights=False,
        export_yup=True,
        export_apply=True,
        export_draco_mesh_compression_enable=False,
    )


# ---------------------------------------------------------------------------
# Text filled without even-odd holes (used by `text`; ported from the militaria
# builders' kinds/_award.py)


def _text_filled(
    name: str,
    body: str,
    size: float,
    depth: float,
    mat: bpy.types.Material | None,
    *,
    pos: Vec3,
    rot_z: float,
    facing: int,
    align: str,
    valign: str,
    font_name: str,
    bold: float,
    spacing: float,
    base: bool,
) -> bpy.types.Object:
    """`text` with every glyph contour filled solid (same placement rules)."""
    loops = _glyph_loops(body, size, bold=bold, spacing=spacing, align=align, valign=valign, font_name=font_name)
    bm = bmesh.new()
    if loops:
        main = max(loops, key=lambda l: abs(_loop_area(l)))
        outer_sign = 1 if _loop_area(main) > 0 else -1
        outers = [l for l in loops if _loop_area(l) * outer_sign > 0]
        holes = [l for l in loops if _loop_area(l) * outer_sign < 0]
        # a counter lies wholly inside one outer contour; a reversed contour that
        # doesn't (an overlapping stroke drawn the other way round) is filled too
        owned = []
        for h in holes:
            probe = h[:: max(1, len(h) // 16)]
            owners = [o for o in outers if all(_inside_loop(q, o) for q in probe)]
            if owners:
                owned.append((h, min(owners, key=lambda o: abs(_loop_area(o)))))
            else:
                outers.append(h[::-1])
        groups: dict[int, list] = {id(o): [] for o in outers}
        for h, o in owned:
            groups[id(o)].append(h)
        for o in outers:
            # each outer piece its own (jittered) height: overlapping pieces never share a top
            _text_solid(bm, o, groups[id(o)], abs(jitter(depth)), base)
    for f in bm.faces:
        f.smooth = False
    out = mesh_object(name, bm, mat)
    m = Matrix.Translation(Vector(pos)) @ Matrix.Rotation(rot_z if facing > 0 else -rot_z, 4, "Z") @ Matrix.Rotation(math.pi if facing < 0 else 0.0, 4, "Y")
    out.data.transform(m)
    return out


def _glyph_loops(body: str, size: float, *, bold: float, spacing: float, align: str, valign: str, font_name: str) -> list[list[tuple[float, float]]]:
    """The text's outline as simple closed loops (text-local XY), emboldened by `bold`."""
    cu = bpy.data.curves.new("glyphs", "FONT")
    cu.body = body
    cu.font = font(font_name)
    cu.size = size
    cu.align_x = align
    cu.align_y = valign
    cu.space_character = spacing
    cu.resolution_u = 3
    cu.fill_mode = "NONE"
    ob = bpy.data.objects.new("glyphs", cu)
    bpy.context.scene.collection.objects.link(ob)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg), depsgraph=dg)
    bpy.data.objects.remove(ob)
    bpy.data.curves.remove(cu)
    bm = bmesh.new()
    bm.from_mesh(me)
    bpy.data.meshes.remove(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=size * 1e-5)
    loops, seen = [], set()
    for v0 in bm.verts:
        if v0.index in seen or len(v0.link_edges) != 2:
            continue
        loop, prev, v = [], None, v0
        while True:
            seen.add(v.index)
            loop.append((v.co.x, v.co.y))
            nxt = [e.other_vert(v) for e in v.link_edges if e.other_vert(v) is not prev]
            if not nxt or len(v.link_edges) != 2:
                break
            prev, v = v, nxt[0]
            if v is v0:
                break
        clean: list = []  # drop near-duplicate points (zero-length edges make the offset spike)
        for q in loop:
            if not clean or math.dist(q, clean[-1]) > size * 0.004:
                clean.append(q)
        if len(clean) > 1 and math.dist(clean[0], clean[-1]) <= size * 0.004:
            clean.pop()
        if len(clean) >= 3:
            loops.append(clean)
    bm.free()
    loops = [q for l in loops for q in _split_simple(l) if abs(_loop_area(q)) > size * size * 1e-5]
    b = bold * size * 0.02  # embolden: outer contours grow, counters shrink
    if b and loops:
        main = max(loops, key=lambda l: abs(_loop_area(l)))
        sign = 1 if _loop_area(main) > 0 else -1
        out = []
        for l in loops:
            d = -b if _loop_area(l) * sign > 0 else b
            out += [q for q in _split_simple(_offset_loop(l, d)) if _loop_area(q) * _loop_area(l) > 0 and abs(_loop_area(q)) > size * size * 1e-5]
        loops = out
    return loops


def _seg_cross(a, b, c, d):
    """Intersection point of segments ab and cd if they properly cross, else None."""
    r = (b[0] - a[0], b[1] - a[1])
    q = (d[0] - c[0], d[1] - c[1])
    den = r[0] * q[1] - r[1] * q[0]
    if abs(den) < 1e-30:
        return None
    t = ((c[0] - a[0]) * q[1] - (c[1] - a[1]) * q[0]) / den
    u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den
    if 1e-9 < t < 1 - 1e-9 and 1e-9 < u < 1 - 1e-9:
        return (a[0] + t * r[0], a[1] + t * r[1])
    return None


def _split_simple(pts, depth: int = 0) -> list:
    """Cut a self-crossing loop at its crossings into simple loops."""
    n = len(pts)
    if depth < 24:
        for i in range(n):
            a, b = pts[i], pts[(i + 1) % n]
            for j in range(i + 2, n):
                if i == 0 and j == n - 1:
                    continue
                x = _seg_cross(a, b, pts[j], pts[(j + 1) % n])
                if x is not None:
                    one = pts[: i + 1] + [x] + pts[j + 1 :]
                    two = [x] + pts[i + 1 : j + 1]
                    return [q for part in (one, two) if len(part) >= 3 for q in _split_simple(part, depth + 1)]
    return [pts]


def _loop_area(pts) -> float:
    return sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1] for i in range(len(pts))) / 2


def _inside_loop(p, poly) -> bool:
    x, y = p
    c = False
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1 + 1e-30) + x1:
            c = not c
    return c


def _offset_loop(pts, d: float) -> list[tuple[float, float]]:
    """Move every edge of a simple polygon inwards by `d` (mitred corners, clamped)."""
    pts = list(pts)
    n = len(pts)
    sgn = 1 if _loop_area(pts) > 0 else -1
    out = []
    for i in range(n):
        p0, p1, p2 = Vector(pts[i - 1]), Vector(pts[i]), Vector(pts[(i + 1) % n])
        e1 = (p1 - p0).normalized()
        e2 = (p2 - p1).normalized()
        n1 = Vector((-e1.y, e1.x)) * sgn
        n2 = Vector((-e2.y, e2.x)) * sgn
        k = 1 + n1.dot(n2)
        off = (n1 + n2) * (d / k) if k > 1e-6 else n1 * d
        if off.length > 2.5 * abs(d):
            off = off.normalized() * 2.5 * abs(d)
        v = p1 + off
        out.append((v.x, v.y))
    return out


def _text_solid(bm: bmesh.types.BMesh, outer, holes, dz: float, base: bool) -> None:
    """One outer loop with its counters as a prism from z = 0 to dz (text-local)."""
    rings = []
    for k, loop in enumerate([outer] + holes):
        pts = list(loop)
        if (k == 0) != (_loop_area(pts) > 0):  # outer anticlockwise, counters clockwise
            pts.reverse()
        lo = [bm.verts.new((x, y, 0.0)) for x, y in pts]
        hi = [bm.verts.new((x, y, dz)) for x, y in pts]
        for i in range(len(pts)):
            j = (i + 1) % len(pts)
            bm.faces.new((lo[i], lo[j], hi[j], hi[i]))
        rings.append((lo, hi))
    for level, want in ((1, 1.0), (0, -1.0)):
        if level == 0 and not base:
            continue
        edges = [bm.edges.get((r[level][i], r[level][(i + 1) % len(r[level])])) for r in rings for i in range(len(r[level]))]
        res = bmesh.ops.triangle_fill(bm, use_beauty=True, use_dissolve=False, edges=edges)
        for f in res["geom"]:
            if isinstance(f, bmesh.types.BMFace):
                f.normal_update()
                if f.normal.z * want < 0:
                    f.normal_flip()
