"""
Shared helpers for the militaria builders (medal, order, badge). Not a kind itself:
build.py only loads kinds/<placeholder>.py, and no def has the placeholder "_award".

Everything is in three.js item coordinates (metres, +Y up, front +Z), like lib.
"""

from __future__ import annotations

import math
import random
from typing import Sequence

import bmesh
import bpy
import lib
from mathutils import Matrix, Vector

Vec2 = Sequence[float]


def ellipse(cx: float, cy: float, rx: float, ry: float, n: int = 16, rot: float = 0.0) -> list[tuple[float, float]]:
    out = []
    for i in range(n):
        a = 2 * math.pi * i / n
        x, y = rx * math.cos(a), ry * math.sin(a)
        out.append((cx + x * math.cos(rot) - y * math.sin(rot), cy + x * math.sin(rot) + y * math.cos(rot)))
    return out


def rng(it: lib.Item, salt: str = "") -> random.Random:
    """Deterministic per item (string seeds hash stably in Python's random)."""
    return random.Random(f"{it.id}:{salt}")


# ---------------------------------------------------------------------------
# Relief drawn on a 256 px canvas, like the placeholder textures


class Face:
    """Relief on one face of a round part (disc, medallion).

    `side` +1 draws on the front (+Z), −1 on the back (seen from behind, so x is
    mirrored). Designs are drawn on the placeholder's 256 px canvas: centre 128,
    radius 128 = `radius` metres, y down. `center` is the part's centre in item space."""

    def __init__(self, side: int, mat, z: float, radius: float, *, center: Vec2 = (0, 0), relief: float = 0.0003):
        self.side, self.mat, self.z, self.R = side, mat, z * side, radius
        self.cx, self.cy = center
        self.h = relief
        self.n = 0

    def C(self, px: float, py: float) -> tuple[float, float]:
        """Canvas pixel → face-local metres (as seen looking at this face)."""
        return ((px - 128) / 128 * self.R, -(py - 128) / 128 * self.R)

    def S(self, px: float) -> float:
        return px / 128 * self.R

    def _name(self, kind: str) -> str:
        self.n += 1
        return f"{'obv' if self.side > 0 else 'rev'}.{kind}.{self.n}"

    def _xy(self, pts):
        return [(self.cx + p[0] * self.side, self.cy + p[1]) for p in pts]

    def poly(self, pts, h: float | None = None, bevel: float = 0.00004, mat=None):
        pts = self._xy(pts)
        if self.side < 0:
            pts = pts[::-1]
        return lib.polygon(self._name("poly"), pts, h or self.h, mat or self.mat, z=self.z, facing=self.side, bevel=bevel, base=False)

    def line(self, pts, width: float, h: float | None = None, mat=None):
        return lib.stroke(self._name("line"), self._xy(pts), width, h or self.h, mat or self.mat, z=self.z, facing=self.side)

    def dots(self, centers, radius: float, h: float | None = None, mat=None, segments: int = 8):
        return lib.dots(self._name("dots"), self._xy(centers), radius, h or self.h * 0.9, mat or self.mat, z=self.z, facing=self.side, segments=segments)

    def text(self, s: str, size: float, x: float, y: float, h: float | None = None, bold: float = 1.2, mat=None, rot: float = 0.0, spacing: float = 1.0):
        return text(
            self._name("text"), s, size, h or self.h * 0.9, mat or self.mat, pos=(self.cx + x * self.side, self.cy + y, self.z), facing=self.side, bold=bold, rot_z=rot, spacing=spacing
        )

    def arc(self, s: str, radius: float, size: float, *, start: float = math.pi / 2, inward: bool = False, spacing: float = 0.7, h: float | None = None, mat=None):
        return arc_text(
            self._name("arc"), s, radius, size, h or self.h * 0.85, mat or self.mat, center=(self.cx, self.cy), z=self.z, start=start, inward=inward, facing=self.side, spacing=spacing
        )


# ---------------------------------------------------------------------------
# Text without even-odd holes
#
# Inter (Blender's bundled font) is a variable font: many glyphs are drawn as
# overlapping contours (the stem and bowl of В, the strokes of И, Я, Ж …).
# Blender fills a text curve even-odd, so where two contours overlap the cap gets
# a hole: a dark pit straight through the letter. Here each outer contour is
# filled on its own, with only its own counters as holes, and gets its own
# (jittered) height, so overlapping pieces never share a top face.


def _glyph_loops(body: str, size: float, *, bold: float, spacing: float, align: str, valign: str, font_name: str) -> list[list[tuple[float, float]]]:
    cu = bpy.data.curves.new("glyphs", "FONT")
    cu.body = body
    cu.font = lib.font(font_name)
    cu.size = size
    cu.align_x = align
    cu.align_y = valign
    cu.space_character = spacing
    cu.resolution_u = 3
    cu.fill_mode = "NONE"  # (the curve's own offset only applies when filled)
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
        # drop near-duplicate points (zero-length edges make the offset spike)
        clean = []
        for q in loop:
            if not clean or math.dist(q, clean[-1]) > size * 0.004:
                clean.append(q)
        if len(clean) > 1 and math.dist(clean[0], clean[-1]) <= size * 0.004:
            clean.pop()
        if len(clean) >= 3:
            loops.append(clean)
    bm.free()
    # some Inter glyphs (И, А, Я …) are one contour that crosses itself where two
    # strokes overlap; split those into simple loops so nothing fills even-odd
    loops = [q for l in loops for q in _split_simple(l) if abs(_area(q)) > size * size * 1e-5]
    # embolden: outer contours grow, counters shrink, by the same amount
    b = bold * size * 0.02
    if b and loops:
        main = max(loops, key=lambda l: abs(_area(l)))
        sign = 1 if _area(main) > 0 else -1
        out = []
        for l in loops:
            d = -b if _area(l) * sign > 0 else b
            # where the offset crosses itself (acute notches) cut it apart and drop
            # the inside-out swallowtails
            parts = [q for q in _split_simple(offset_polygon(l, d)) if _area(q) * _area(l) > 0 and abs(_area(q)) > size * size * 1e-5]
            out += parts
        loops = out
    return loops


def _seg_x(a, b, c, d):
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
                x = _seg_x(a, b, pts[j], pts[(j + 1) % n])
                if x is not None:
                    one = pts[: i + 1] + [x] + pts[j + 1 :]
                    two = [x] + pts[i + 1 : j + 1]
                    return [q for part in (one, two) if len(part) >= 3 for q in _split_simple(part, depth + 1)]
    return [pts]


def _area(pts) -> float:
    return sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1] for i in range(len(pts))) / 2


def _inside(p, poly) -> bool:
    x, y = p
    c = False
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1 + 1e-30) + x1:
            c = not c
    return c


def text(
    name: str,
    body: str,
    size: float,
    depth: float,
    mat,
    *,
    pos=(0, 0, 0),
    rot_z: float = 0.0,
    facing: int = 1,
    align: str = "CENTER",
    valign: str = "CENTER",
    font_name: str = "Inter.woff2",
    bold: float = 0.0,
    spacing: float = 1.0,
    base: bool = False,
) -> bpy.types.Object:
    """Raised lettering like lib.text (same placement rules), but every contour of
    every glyph filled correctly. `base` keeps the faces at the surface (a closed
    solid, e.g. a punch for `stamp`)."""
    loops = _glyph_loops(body, size, bold=bold, spacing=spacing, align=align, valign=valign, font_name=font_name)
    bm = bmesh.new()
    if loops:
        main = max(loops, key=lambda l: abs(_area(l)))
        outer_sign = 1 if _area(main) > 0 else -1
        outers = [l for l in loops if _area(l) * outer_sign > 0]
        holes = [l for l in loops if _area(l) * outer_sign < 0]
        # a counter lies wholly inside one outer contour; a reversed contour that
        # doesn't (an overlapping stroke drawn the other way round) is filled too
        owned = []
        for h in holes:
            probe = h[:: max(1, len(h) // 16)]
            owners = [o for o in outers if all(_inside(p, o) for p in probe)]
            if owners:
                owned.append((h, min(owners, key=lambda o: abs(_area(o)))))
            else:
                outers.append(h[::-1])
        groups = {id(o): [] for o in outers}
        for h, o in owned:
            groups[id(o)].append(h)
        for o in outers:
            dz = abs(lib.jitter(depth))
            _solid(bm, o, groups[id(o)], dz, base)
    for f in bm.faces:
        f.smooth = False
    obj = lib.mesh_object(name, bm, mat)
    ry = math.pi if facing < 0 else 0.0
    rz = rot_z if facing > 0 else -rot_z
    m = Matrix.Translation(Vector(pos)) @ Matrix.Rotation(rz, 4, "Z") @ Matrix.Rotation(ry, 4, "Y")
    obj.data.transform(m)
    return obj


def _solid(bm: bmesh.types.BMesh, outer, holes, dz: float, base: bool) -> None:
    """One outer contour with its counters, from z = 0 to dz (local)."""
    rings = []
    for k, loop in enumerate([outer] + holes):
        pts = list(loop)
        ccw = _area(pts) > 0
        if (k == 0) != ccw:  # outer anticlockwise, counters clockwise
            pts.reverse()
        lo = [bm.verts.new((x, y, 0.0)) for x, y in pts]
        hi = [bm.verts.new((x, y, dz)) for x, y in pts]
        n = len(pts)
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((lo[i], lo[j], hi[j], hi[i]))
        rings.append((lo, hi))
    for level, want in ((1, 1.0), (0, -1.0)):
        if level == 0 and not base:
            continue
        edges = []
        for ring in rings:
            vs = ring[level]
            for i in range(len(vs)):
                e = bm.edges.get((vs[i], vs[(i + 1) % len(vs)]))
                edges.append(e)
        res = bmesh.ops.triangle_fill(bm, use_beauty=True, use_dissolve=False, edges=edges)
        for f in res["geom"]:
            if isinstance(f, bmesh.types.BMFace):
                f.normal_update()
                if f.normal.z * want < 0:
                    f.normal_flip()


def arc_text(name: str, body: str, radius: float, size: float, depth: float, mat, *, center=(0, 0), z: float = 0.0, start: float = math.pi / 2, facing: int = 1, inward: bool = False, spacing: float = 0.62, bold: float = 0.0):
    """Lettering round a circle; the same layout as lib.arc_text, built with `text`."""
    step = size * spacing / radius
    total = step * (len(body) - 1)
    objs = []
    for i, ch in enumerate(body):
        if ch == " ":
            continue
        if not inward:
            a = start + total / 2 - i * step
            rot = a - math.pi / 2
        else:
            a = start - total / 2 + i * step
            rot = a + math.pi / 2
        ax = a if facing > 0 else math.pi - a
        px = center[0] + radius * math.cos(ax)
        py = center[1] + radius * math.sin(a)
        objs.append(text(f"{name}.{i}", ch, size, depth, mat, pos=(px, py, z), rot_z=rot, facing=facing, bold=bold))
    return objs


# ---------------------------------------------------------------------------
# Shapes


def offset_polygon(pts: Sequence[Vec2], d: float) -> list[tuple[float, float]]:
    """Move every edge of a simple polygon inwards by `d` (mitred corners)."""
    pts = list(pts)
    n = len(pts)
    area = sum(pts[i][0] * pts[(i + 1) % n][1] - pts[(i + 1) % n][0] * pts[i][1] for i in range(n))
    sgn = 1 if area > 0 else -1  # CCW: inward normal is the left normal
    out = []
    for i in range(n):
        p0, p1, p2 = Vector(pts[i - 1]), Vector(pts[i]), Vector(pts[(i + 1) % n])
        e1 = (p1 - p0).normalized()
        e2 = (p2 - p1).normalized()
        n1 = Vector((-e1.y, e1.x)) * sgn
        n2 = Vector((-e2.y, e2.x)) * sgn
        m = n1 + n2
        k = 1 + n1.dot(n2)
        off = m * (d / k) if k > 1e-6 else n1 * d
        if off.length > 2.5 * abs(d):  # clamp the mitre at very sharp corners
            off = off.normalized() * 2.5 * abs(d)
        v = p1 + off
        out.append((v.x, v.y))
    return out


def faceted_star(
    name: str,
    mat,
    *,
    n: int = 5,
    r_out: float,
    r_in: float,
    center: Vec2 = (0, 0),
    z_base: float,
    z_edge: float,
    z_tip: float,
    z_apex: float,
    chips: dict[int, tuple[float, float]] | None = None,
) -> bpy.types.Object:
    """A star whose rays are cut as two facets meeting on a ridge (the way enamel
    stars on orders are struck). Ridges run from each tip (`z_tip`) to the centre
    apex (`z_apex`); the inner corners sit at `z_edge`. Side walls go down to `z_base`.

    `chips` {ray index: (left, right)} breaks the enamel off a ray tip: the tip is cut
    back that fraction along each of its two edges."""
    chips = chips or {}
    cx, cy = center
    bm = bmesh.new()
    apex = bm.verts.new((cx, cy, z_apex))
    tips, inner = [], []
    for i in range(n):
        a = math.pi / 2 + 2 * math.pi * i / n
        tips.append(Vector((cx + r_out * math.cos(a), cy + r_out * math.sin(a))))
        b = a + math.pi / n
        inner.append(Vector((cx + r_in * math.cos(b), cy + r_in * math.sin(b))))
    # outline CCW: tip i, inner i (to its left), tip i+1 ...
    top: list = []  # outline verts in order
    for i in range(n):
        t = tips[i]
        lft = inner[i]
        rgt = inner[i - 1]
        if i in chips:
            fl, fr = chips[i]
            pr = t + (rgt - t) * fr
            pl = t + (lft - t) * fl
            vr = bm.verts.new((pr.x, pr.y, z_edge + (z_tip - z_edge) * (1 - fr) * 0.6))
            vl = bm.verts.new((pl.x, pl.y, z_edge + (z_tip - z_edge) * (1 - fl) * 0.6))
            top += [("tipR", i, vr), ("tipL", i, vl)]
        else:
            top.append(("tip", i, bm.verts.new((t.x, t.y, z_tip))))
        top.append(("in", i, bm.verts.new((lft.x, lft.y, z_edge))))
    vs = [v for _k, _i, v in top]
    m = len(vs)
    for k in range(m):
        a, b = vs[k], vs[(k + 1) % m]
        bm.faces.new((a, b, apex))
    lo = [bm.verts.new((v.co.x, v.co.y, z_base)) for v in vs]
    for k in range(m):
        j = (k + 1) % m
        bm.faces.new((vs[k], lo[k], lo[j], vs[j]))
    for f in bm.faces:
        f.normal_update()
    obj = lib.mesh_object(name, bm, mat)
    lib.auto_smooth(obj, 20)
    return obj


def torus(name: str, major: float, minor: float, mat, *, center=(0, 0, 0), axis: str = "z", minor_axial: float | None = None, segments: int = 32, sides: int = 10) -> bpy.types.Object:
    """A ring; `minor_axial` flattens the tube along the axis (an eyelet struck flat)."""
    ma = minor_axial or minor
    prof = [(major + minor * math.cos(2 * math.pi * k / sides), ma * math.sin(2 * math.pi * k / sides)) for k in range(sides + 1)]
    obj = lib.lathe(name, prof, mat, segments=segments, axis=axis, center=center, cap=False)
    return obj


def tube(name: str, path: Sequence[Sequence[float]], radius: float, mat, *, closed: bool = False, sides: int = 8, caps: bool = True) -> bpy.types.Object:
    """Sweep a circle along a 3D polyline (wire: pins, jump rings)."""
    P = [Vector(p) for p in path]
    m = len(P)
    bm = bmesh.new()
    rings = []
    prev_n = None
    for i in range(m):
        if closed:
            t = (P[(i + 1) % m] - P[i - 1]).normalized()
        else:
            t = (P[min(i + 1, m - 1)] - P[max(i - 1, 0)]).normalized()
        if prev_n is None:
            ref = Vector((0, 0, 1)) if abs(t.z) < 0.9 else Vector((1, 0, 0))
            nrm = t.cross(ref).normalized()
        else:
            nrm = (prev_n - t * prev_n.dot(t)).normalized()
        prev_n = nrm
        bnr = t.cross(nrm).normalized()
        rings.append([bm.verts.new(P[i] + radius * (math.cos(2 * math.pi * k / sides) * nrm + math.sin(2 * math.pi * k / sides) * bnr)) for k in range(sides)])
    segs = m if closed else m - 1
    for i in range(segs):
        a, b = rings[i], rings[(i + 1) % m]
        for k in range(sides):
            j = (k + 1) % sides
            bm.faces.new((a[k], a[j], b[j], b[k]))
    if caps and not closed:
        bm.faces.new(rings[0][::-1])
        bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        f.smooth = True
    return lib.mesh_object(name, bm, mat)


def threaded_post(name: str, radius: float, z0: float, z1: float, mat, *, pitch: float = 0.0005, depth: float = 0.00018, worn: float = 0.5, segments: int = 20, center: Vec2 = (0, 0)) -> bpy.types.Object:
    """A screw post along −Z from z0 (the back it is soldered to) to z1 (its end),
    thread as rounded rings; `worn` (0–1) flattens the crests. Domed end."""
    prof = [(0, z0), (radius * 1.25, z0), (radius * 1.08, z0 - 0.0003), (radius, z0 - 0.0006)]
    length = abs(z1 - z0) - 0.0009
    steps = max(int(length / pitch * 4), 4)
    for k in range(steps + 1):
        z = z0 - 0.0006 - length * k / steps
        ph = 2 * math.pi * k / 4
        w = (math.cos(ph) + 1) / 2  # 1 = crest
        w = min(w, 1 - worn * 0.5) / (1 - worn * 0.5)
        prof.append((radius - depth * (1 - w), z))
    prof += [(radius * 0.8, z1 + 0.0001), (radius * 0.45, z1 - 0.00002), (0, z1 - 0.00005)]
    obj = lib.lathe(name, prof, mat, segments=segments, axis="z", center=(center[0], center[1], 0), cap=False)
    lib.auto_smooth(obj, 50)
    return obj


# ---------------------------------------------------------------------------
# Stamping and finishing


def stamp(target: bpy.types.Object, it: lib.Item, chars: str, *, size: float, x: float, y: float, z: float, facing: int, depth: float, rot: float = 0.0, uneven: float = 0.0, spacing: float = 0.72, salt: str = "stamp") -> None:
    """Punch characters into `target` (boolean difference), one punch per character,
    as a hand stamp would: with `uneven` > 0 each punch varies a little in depth,
    angle and height. `z` is the surface; `facing` which side reads it."""
    r = rng(it, salt)
    cutters = []
    step = size * spacing
    total = step * (len(chars) - 1)
    ca, sa = math.cos(rot), math.sin(rot)
    mat = target.data.materials[0]
    for i, ch in enumerate(chars):
        if ch == " ":
            continue
        u = -total / 2 + i * step
        dv = r.uniform(-1, 1) * uneven * size * 0.06
        dr = r.uniform(-1, 1) * uneven * 0.07
        dd = depth * (1 + r.uniform(-1, 1) * uneven * 0.35)
        # local offset along the reading direction (mirrored on the back)
        lx = (u * ca - dv * sa) * facing
        ly = u * sa + dv * ca
        o = text(f"punch.{i}", ch, size, dd + 0.0003, mat, pos=(x + lx, y + ly, z - facing * dd), rot_z=rot + dr, facing=facing, bold=1.0, base=True)
        cutters.append(o)
    if not cutters:
        return
    if len(cutters) > 1:
        with bpy.context.temp_override(active_object=cutters[0], selected_editable_objects=cutters, object=cutters[0]):
            bpy.ops.object.join()
    cutter = cutters[0]
    bm = bmesh.new()
    bm.from_mesh(cutter.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-8)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(cutter.data)
    bm.free()
    for o in (target, cutter):
        o.data.transform(o.matrix_world)
        o.matrix_world = Matrix.Identity(4)
    zs = [v.co.z for v in target.data.vertices]
    span = (min(zs), max(zs))
    mod = target.modifiers.new("stamp", "BOOLEAN")
    mod.operation = "DIFFERENCE"
    mod.solver = "EXACT"
    mod.use_self = True  # glyphs of the variable font overlap themselves
    mod.use_hole_tolerant = True
    mod.object = cutter
    lib.apply_modifiers(target)
    bpy.data.objects.remove(cutter)
    zs = [v.co.z for v in target.data.vertices]
    if not zs or abs(min(zs) - span[0]) > 1e-6 or abs(max(zs) - span[1]) > 1e-6:
        raise RuntimeError(f"stamping {chars!r} into {target.name} went wrong")
    # the boolean leaves long slivers across the flat field: shade the field and the
    # punched walls flat (smooth normals across slivers streak), keep curved parts smooth
    lib.auto_smooth(target, 30)
    bm = bmesh.new()
    bm.from_mesh(target.data)
    c = Vector((x, y))
    reach = size * spacing * len(chars)
    for f in bm.faces:
        if abs(f.normal.z) > 0.97 or (f.calc_center_median().to_2d() - c).length < reach:
            f.smooth = False
    bm.to_mesh(target.data)
    bm.free()


def back_material(obj: bpy.types.Object, mat, *, below: float = -0.5) -> None:
    """Give the faces of `obj` that face −Z (normal.z < `below`) a second material:
    the back of a part, darker and untouched by polishing."""
    me = obj.data
    if mat.name not in [m.name for m in me.materials]:
        me.materials.append(mat)
    idx = [m.name for m in me.materials].index(mat.name)
    for p in me.polygons:
        if p.normal.z < below:
            p.material_index = idx


def scale_about(obj: bpy.types.Object, sx: float, sy: float, sz: float, center=(0, 0, 0)) -> None:
    c = Vector(center)
    m = Matrix.Translation(c) @ Matrix.Diagonal((sx, sy, sz, 1)) @ Matrix.Translation(-c)
    lib.transform(obj, m)
