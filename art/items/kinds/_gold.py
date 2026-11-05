"""
Shared parts for the gold jewellery builders (ring, signet, chain, earrings, pendant).

Not a builder itself (no def has placeholder "_gold"). Everything here works in
three.js item coordinates like lib.py: metres, +Y up, front +Z.

- materials: polished gold, a rougher gold for struck stamps, a satin gold for wear
- hallmark(): a struck fineness stamp (583 / 585) beside an assay star or a maker's
  mark, as micro relief in a flat XY frame (reading from +Z), to place with a matrix
  or wrap onto a cylinder with wrap_cylinder()
- tube(), torus_into(): wire and link geometry, many links into one bmesh
"""

from __future__ import annotations

import math
from typing import Callable, Sequence

import bmesh
import lib
from mathutils import Matrix, Vector

# Stamp relief: digits and frames stand this proud of the surface (struck punches
# leave raised digits inside a sunken field; at this scale the raised part is what reads).
STAMP_H = 0.000035


def gold(it: lib.Item, rough: float = 0.13) -> object:
    return lib.material(it, "gold", it.color, metal=1.0, rough=rough)


def stamp_mat(it: lib.Item) -> object:
    return lib.material(it, "stamp", lib.shade(it.color, 0.96), metal=1.0, rough=0.34)


def satin(it: lib.Item) -> object:
    """Worn, finely scratched gold (scratches, seams, the inside of a bail)."""
    return lib.material(it, "satin", lib.shade(it.color, 0.98), metal=1.0, rough=0.3)


# ---------------------------------------------------------------------------
# Stamps


def _rrect(w: float, h: float, clip: float) -> list[tuple[float, float]]:
    """Rectangle with clipped corners, centred on the origin."""
    x, y, c = w / 2, h / 2, clip
    return [(-x + c, -y), (x - c, -y), (x, -y + c), (x, y - c), (x - c, y), (-x + c, y), (-x, y - c), (-x, -y + c)]


def hallmark(name: str, fineness: str, mark: str, mat, *, digit: float = 0.00055, h: float = STAMP_H) -> list:
    """A fineness stamp ('583') in a clipped-corner frame, then a second stamp to its
    right: mark='star' (Soviet assay star in an oval) or letters (maker's mark in a
    rectangle). Flat, on z = 0, relief towards +Z, centred on the origin."""
    objs = []
    fw = digit * 0.62 * len(fineness) + digit * 0.55
    fh = digit * 1.45
    lw = digit * 0.13
    if mark == "star":
        mw = fh * 1.05
    else:
        mw = digit * 0.66 * len(mark) + digit * 0.5
    gap = digit * 0.35
    total = fw + gap + mw
    x0 = -total / 2 + fw / 2
    x1 = total / 2 - mw / 2
    frame = [(x + x0, y) for x, y in _rrect(fw, fh, fh * 0.22)]
    objs.append(lib.stroke(f"{name}.frame", frame, lw, h * 0.8, mat, closed=True, round_caps=True))
    objs.append(lib.text(f"{name}.num", fineness, digit, h, mat, pos=(x0, 0, 0), bold=0.8, spacing=1.05))
    if mark == "star":
        oval = [(x1 + mw / 2 * math.cos(2 * math.pi * i / 20), fh / 2 * math.sin(2 * math.pi * i / 20)) for i in range(20)]
        objs.append(lib.stroke(f"{name}.oval", oval, lw, h * 0.8, mat, closed=True, round_caps=True))
        objs.append(lib.polygon(f"{name}.star", lib.star_points(5, fh * 0.36, fh * 0.15, (x1, -fh * 0.02)), h, mat, base=False))
    else:
        objs.append(lib.stroke(f"{name}.mframe", [(x + x1, y) for x, y in _rrect(mw, fh, 0)], lw, h * 0.8, mat, closed=True, round_caps=True))
        objs.append(lib.text(f"{name}.mark", mark, digit * 0.82, h, mat, pos=(x1, 0, 0), bold=0.8, spacing=1.0))
    return objs


# ---------------------------------------------------------------------------
# Placing flat relief


def wrap_cylinder(objs, radius: Callable[[float], float], theta0: float, *, inward: bool) -> None:
    """Bend flat relief (built on z = 0 in XY, relief towards +Z) onto a cylinder
    round the Z axis. x runs along the circumference, y along the axis (+Z), relief
    height goes inwards (inside of a band, read from the hole) or outwards.
    `radius(z)` is the surface radius at axial position z; `theta0` the angle (from +X)
    of the relief's centre."""
    for o in objs if isinstance(objs, (list, tuple)) else [objs]:
        me = o.data
        for v in me.vertices:
            x, y, hgt = v.co
            r0 = radius(y)
            th = theta0 - x / r0 if inward else theta0 + x / r0
            r = r0 - hgt if inward else r0 + hgt
            v.co = Vector((r * math.cos(th), r * math.sin(th), y))
        me.update()


def place(objs, m: Matrix) -> None:
    lib.transform(objs if isinstance(objs, (list, tuple)) else [objs], m)


def frame_matrix(origin, right, up) -> Matrix:
    """Matrix taking flat relief (x right, y up, +Z out) to a surface at `origin`
    whose outward normal is right × up."""
    r = Vector(right).normalized()
    u = Vector(up).normalized()
    n = r.cross(u).normalized()
    u = n.cross(r)
    o = Vector(origin)
    return Matrix(((r.x, u.x, n.x, o.x), (r.y, u.y, n.y, o.y), (r.z, u.z, n.z, o.z), (0, 0, 0, 1)))


# ---------------------------------------------------------------------------
# Wire and links


def catmull(pts: Sequence[Sequence[float]], n: int, closed: bool = False) -> list[Vector]:
    """Centripetal-ish (uniform) Catmull-Rom through pts, n samples per span."""
    P = [Vector(p) for p in pts]
    out = []
    m = len(P)
    spans = m if closed else m - 1
    for s in range(spans):
        p0 = P[(s - 1) % m] if closed or s > 0 else P[0] * 2 - P[1]
        p1 = P[s % m]
        p2 = P[(s + 1) % m]
        p3 = P[(s + 2) % m] if closed or s + 2 < m else P[-1] * 2 - P[-2]
        for k in range(n):
            t = k / n
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    if not closed:
        out.append(P[-1])
    return out


def frames(path: Sequence[Vector], closed: bool, up=(0, 0, 1)) -> list[tuple[Vector, Vector, Vector]]:
    """(tangent, normal, binormal) per point; normal stays as close to ⊥ `up` as it can."""
    n = len(path)
    out = []
    upv = Vector(up)
    for i in range(n):
        if closed:
            t = path[(i + 1) % n] - path[i - 1]
        else:
            t = path[min(i + 1, n - 1)] - path[max(i - 1, 0)]
        t.normalize()
        b = upv - t * upv.dot(t)
        if b.length < 1e-6:
            b = Vector((1, 0, 0)) - t * t.x
        b.normalize()
        nrm = b.cross(t).normalized()
        out.append((t, nrm, b))
    return out


def tube(name: str, path: Sequence[Vector], radius, mat, *, sides: int = 8, closed: bool = False, caps: bool = True, up=(0, 0, 1)) -> object:
    """A round wire along `path` (list of points). `radius` is a float or a function of
    the path fraction 0…1 (tapered prongs)."""
    bm = bmesh.new()
    fr = frames(path, closed, up)
    rings = []
    n = len(path)
    for i, (p, (t, nrm, b)) in enumerate(zip(path, fr)):
        r = radius(i / max(n - 1, 1)) if callable(radius) else radius
        rings.append([bm.verts.new(p + (nrm * math.cos(2 * math.pi * k / sides) + b * math.sin(2 * math.pi * k / sides)) * r) for k in range(sides)])
    pairs = list(zip(rings, rings[1:])) + ([(rings[-1], rings[0])] if closed else [])
    for a, c in pairs:
        for k in range(sides):
            j = (k + 1) % sides
            bm.faces.new((a[k], a[j], c[j], c[k]))
    if caps and not closed:
        bm.faces.new(rings[0][::-1])
        bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        f.smooth = True
    return lib.mesh_object(name, bm, mat)


def torus_into(bm, m: Matrix, R: float, r: float, seg: int = 12, sides: int = 6, sx: float = 1.0, sy: float = 1.0, sz: float = 1.0, phase: float = 0.0) -> None:
    """Add a torus (ring in the local XY plane, hole along local Z) to `bm`, scaled
    (sx, sy) in its plane for oval links and sz across, then transformed by `m`.
    Winding is explicit (outward), so no normal recalculation is needed."""
    rings = []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        ca, sa = math.cos(a), math.sin(a)
        ring = []
        for k in range(sides):
            b = 2 * math.pi * k / sides + phase
            rr = R + r * math.cos(b)
            p = Vector((rr * ca * sx, rr * sa * sy, r * math.sin(b) * sz))
            ring.append(bm.verts.new(m @ p))
        rings.append(ring)
    for i in range(seg):
        a, c = rings[i], rings[(i + 1) % seg]
        for k in range(sides):
            j = (k + 1) % sides
            bm.faces.new((a[k], c[k], c[j], a[j]))


def torus(name: str, R: float, r: float, mat, m: Matrix, *, seg: int = 24, sides: int = 8, sx: float = 1.0, sy: float = 1.0) -> object:
    bm = bmesh.new()
    torus_into(bm, m, R, r, seg, sides, sx, sy)
    for f in bm.faces:
        f.smooth = True
    return lib.mesh_object(name, bm, mat)


def sphere(name: str, r: float, mat, center, *, seg: int = 16, rings: int = 8, scale=(1, 1, 1)) -> object:
    prof = [(r * math.sin(math.pi * i / rings), -r * math.cos(math.pi * i / rings)) for i in range(rings + 1)]
    prof[0] = (0, -r)
    prof[-1] = (0, r)
    o = lib.lathe(name, prof, mat, segments=seg, axis="y", cap=False)
    o.data.transform(Matrix.Diagonal((*scale, 1)))
    o.data.transform(lib.at(*center))
    return o


def oval_into(bm, m: Matrix, a: float, b: float, r: float, seg: int = 14, sides: int = 6, sz: float = 1.0) -> None:
    """An oval link: a round wire of radius r along an ellipse (half axes a, b) in the
    local XY plane, the wire squashed by sz across the plane (flattened, diamond-cut
    links), transformed by `m`. Explicit outward winding."""
    rings = []
    for i in range(seg):
        t = 2 * math.pi * i / seg
        cx, cy = a * math.cos(t), b * math.sin(t)
        nx, ny = b * math.cos(t), a * math.sin(t)  # outward normal of the ellipse
        ln = math.hypot(nx, ny)
        nx, ny = nx / ln, ny / ln
        ring = []
        for k in range(sides):
            u = 2 * math.pi * k / sides
            ring.append(bm.verts.new(m @ Vector((cx + nx * r * math.cos(u), cy + ny * r * math.cos(u), r * sz * math.sin(u)))))
        rings.append(ring)
    for i in range(seg):
        A, C = rings[i], rings[(i + 1) % seg]
        for k in range(sides):
            j = (k + 1) % sides
            bm.faces.new((A[k], C[k], C[j], A[j]))
