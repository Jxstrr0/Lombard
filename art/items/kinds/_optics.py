"""
Shared parts for the camera and lens builders (kinds/camera.py, kinds/lens.py).

Not a builder itself (no def has placeholder `_optics`). Everything is in
three.js item coordinates like lib; lens parts are built around the Z axis,
front towards +Z, and moved into place with `place()`.
"""

from __future__ import annotations

import math
import random

import bmesh
import bpy
import lib
from mathutils import Matrix, Vector

TAU = 2 * math.pi


# ---------------------------------------------------------------------------
# Placement


def frame(right, up, normal, origin) -> Matrix:
    """Matrix taking a piece drawn in the XY plane (facing +Z, up +Y) onto a plane."""
    r, u, n, o = (Vector(v) for v in (right, up, normal, origin))
    return Matrix(((r.x, u.x, n.x, o.x), (r.y, u.y, n.y, o.y), (r.z, u.z, n.z, o.z), (0, 0, 0, 1)))


def scale(x: float, y: float, z: float) -> Matrix:
    return Matrix(((x, 0, 0, 0), (0, y, 0, 0), (0, 0, z, 0), (0, 0, 0, 1)))


class Grab:
    """Collects the mesh objects created inside a `with` block, to move them as one."""

    def __enter__(self) -> "Grab":
        self.before = {o.name for o in bpy.context.scene.objects}
        self.objs: list[bpy.types.Object] = []
        return self

    def __exit__(self, *exc) -> None:
        self.objs = [o for o in bpy.context.scene.objects if o.type == "MESH" and o.name not in self.before]

    def place(self, m: Matrix) -> None:
        lib.transform(self.objs, m)


def orient(obj: bpy.types.Object, want) -> None:
    """Flip faces of an open surface so their normals agree with `want(center, normal) -> Vector`."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    flip = [f for f in bm.faces if f.normal.dot(want(f.calc_center_median(), f.normal)) < 0]
    if flip:
        bmesh.ops.reverse_faces(bm, faces=flip)
    bm.to_mesh(obj.data)
    bm.free()


def orient_axial(obj: bpy.types.Object, z_mid: float, inward: bool = False) -> None:
    """Normals of a part round the Z axis: radial on the sides, ±Z on the end faces."""

    def want(c, n):
        if abs(n.z) > 0.85:
            return Vector((0, 0, 1 if c.z > z_mid else -1))
        v = Vector((c.x, c.y, 0))
        return -v if inward else v

    orient(obj, want)


def flatten(objs) -> None:
    """Keep only the faces of printed lettering that face +Z (drawn in the XY plane):
    a paint fill a few hundredths of a millimetre proud has no visible sides, and
    dropping them roughly halves the lettering's triangles."""
    for o in [objs] if isinstance(objs, bpy.types.Object) else objs:
        bm = bmesh.new()
        bm.from_mesh(o.data)
        # sides and anything facing down (where a bold outline overlaps itself the fill comes out
        # inverted; it was never visible from the front)
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.normal.z < 0.5], context="FACES")
        # some glyphs (Inter's K) keep a piece of the back cap wound upwards; it lies on the
        # surface itself, so drop everything below the top
        if bm.faces:
            top = max(f.calc_center_median().z for f in bm.faces)
            bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.calc_center_median().z < top - 0.00001], context="FACES")
        bm.to_mesh(o.data)
        bm.free()


def letter_k(name: str, size: float, depth: float, mat, *, weight: float = 0.17, h: float | None = None) -> list[bpy.types.Object]:
    """A sans-serif K drawn from three strokes, centred on the origin in the XY plane.

    Blender's fill of Inter's K (its stem and leg are overlapping contours) spans the
    notch between them with a stray triangle, so lettering with a K uses this instead."""
    h = h or size * 0.727  # Inter cap height
    w = h * weight
    x0, y0, y1 = -h * 0.33, -h / 2, h / 2
    jy = y0 + h * 0.42
    strokes = [
        [(x0, y0), (x0 + w, y0), (x0 + w, y1), (x0, y1)],
        [(x0 + w * 0.7, jy - w * 0.35), (x0 + h * 0.66, y1), (x0 + h * 0.66 - w * 1.35, y1), (x0 + w * 0.7, jy + w * 1.05)],
        [(x0 + w + h * 0.06, jy + h * 0.05), (x0 + h * 0.70, y0), (x0 + h * 0.70 - w * 1.35, y0), (x0 + w * 0.7, jy + h * 0.11 - w)],
    ]
    out = [lib.polygon(f"{name}.{i}", pts, depth, mat, base=False) for i, pts in enumerate(strokes)]
    flatten(out)
    return out


def arc_text_k(name: str, body: str, radius: float, size: float, depth: float, mat, *, z: float, start: float, spacing: float, inward: bool = False) -> None:
    """lib.arc_text, flattened, with any K drawn by `letter_k` in its place."""
    flatten(lib.arc_text(name, body.replace("K", " "), radius, size, depth, mat, z=z, start=start, spacing=spacing, inward=inward))
    step = size * spacing / radius
    total = step * (len(body) - 1)
    for i, ch in enumerate(body):
        if ch != "K":
            continue
        a = start + total / 2 - i * step if not inward else start - total / 2 + i * step
        rot_z = a - math.pi / 2 if not inward else a + math.pi / 2
        for o in letter_k(f"{name}.k{i}", size, depth, mat):
            lib.transform(o, lib.at(radius * math.cos(a), radius * math.sin(a), z) @ lib.rot("z", rot_z))


# ---------------------------------------------------------------------------
# Lens parts (round the Z axis)


def ring(name: str, prof, mat, *, segments: int = 72, smooth_angle: float = 40) -> bpy.types.Object:
    """A lathe of (radius, z) round Z, normals pointing away from the axis/ends, hard edges kept."""
    o = lib.lathe(name, prof, mat, segments=segments, axis="z", cap=False)
    zs = [p[1] for p in prof]
    orient_axial(o, (min(zs) + max(zs)) / 2)
    lib.auto_smooth(o, smooth_angle)
    return o


def knurl(
    name: str,
    r_valley: float,
    r_peak: float,
    z0: float,
    z1: float,
    n: int,
    mat,
    *,
    chamfer: float = 0.0004,
    caps: tuple[float | None, float | None] = (None, None),
    top: float = 0.3,
) -> bpy.types.Object:
    """A ring of `n` flat-topped ribs between z0 and z1 (a knurled grip).

    The rib ends are chamfered down to the valley radius; `caps` (inner radius
    at z0, at z1) closes an exposed end with a flat annulus. `top` is the share
    of each rib's pitch that is flat on top."""
    bm = bmesh.new()
    rise = (1 - top) / 4
    fr = [(0.0, r_valley), (rise, r_peak), (rise + top, r_peak), (2 * rise + top, r_valley)]

    def ring_at(z: float, ribbed: bool):
        vs = []
        for k in range(n):
            for f, r in fr:
                a = TAU * (k + f) / n
                rr = r if ribbed else r_valley
                vs.append(bm.verts.new((rr * math.cos(a), rr * math.sin(a), z)))
        return vs

    rings = [ring_at(z0, False), ring_at(z0 + chamfer, True), ring_at(z1 - chamfer, True), ring_at(z1, False)]
    m = len(rings[0])
    for a, b in zip(rings, rings[1:]):
        for i in range(m):
            j = (i + 1) % m
            bm.faces.new((a[i], a[j], b[j], b[i]))
    for r_in, rg, z in ((caps[0], rings[0], z0), (caps[1], rings[-1], z1)):
        if r_in is None:
            continue
        inner = [bm.verts.new((r_in * v.co.x / r_valley, r_in * v.co.y / r_valley, z)) for v in rg]
        for i in range(m):
            j = (i + 1) % m
            bm.faces.new((rg[i], rg[j], inner[j], inner[i]))
    o = lib.mesh_object(name, bm, mat)
    orient_axial(o, (z0 + z1) / 2)
    lib.auto_smooth(o, 30)
    return o


def thread(name: str, r_minor: float, r_major: float, z0: float, z1: float, pitch: float, mat, *, segments: int = 48) -> bpy.types.Object:
    """A male screw thread: one helical strip with a trapezoid profile, clipped to z0…z1."""
    bm = bmesh.new()
    prof = [(0.0, r_minor), (0.3, r_major), (0.55, r_major), (0.85, r_minor)]
    turns = (z1 - z0) / pitch + 2
    steps = int(turns * segments)
    grid = []
    for i in range(steps + 1):
        th = TAU * i / segments
        row = []
        for s, r in prof:
            z = z0 - pitch + pitch * (th / TAU + s)
            row.append((r * math.cos(th), r * math.sin(th), min(max(z, z0), z1), z0 < z < z1))
        grid.append(row)
    verts = [[bm.verts.new(p[:3]) for p in row] for row in grid]
    P = len(prof)

    def face(vs, inside):
        if any(inside):
            bm.faces.new(vs)

    for i in range(steps):
        for j in range(P - 1):
            q = [(i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1)]
            face([verts[a][b] for a, b in q], [grid[a][b][3] for a, b in q])
        if i + segments + 1 <= steps:
            q = [(i, P - 1), (i + 1, P - 1), (i + 1 + segments, 0), (i + segments, 0)]
            face([verts[a][b] for a, b in q], [grid[a][b][3] for a, b in q])
    loose = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=loose, context="VERTS")
    o = lib.mesh_object(name, bm, mat)
    orient(o, lambda c, n: Vector((c.x, c.y, 0)))
    lib.auto_smooth(o, 50)
    return o


def dome(name: str, r: float, apex: float, radius: float, mat, *, facing: int = 1, segments: int = 64, rings: int = 6) -> bpy.types.Object:
    """A spherical cap of base radius `r` (a lens surface), apex at z = apex, bulging towards `facing`."""
    prof = []
    for k in range(rings + 1):
        rho = r * k / rings
        sag = radius - math.sqrt(max(radius * radius - rho * rho, 0))
        prof.append((rho, apex - facing * sag))
    o = lib.lathe(name, prof, mat, segments=segments, axis="z", cap=False)
    orient(o, lambda c, n: Vector((0, 0, facing)))
    return o


def cup(name: str, prof, mat, *, facing: int = 1, segments: int = 48) -> bpy.types.Object:
    """The dark inside of a barrel, seen through the glass from `facing` (+1 = front):
    side walls face the axis, end walls face the viewer."""
    o = lib.lathe(name, prof, mat, segments=segments, axis="z", cap=False)
    orient(o, lambda c, n: Vector((0, 0, facing)) if abs(n.z) > 0.6 else Vector((-c.x, -c.y, 0)))
    return o


def cyl_text(name: str, body: str, radius: float, z: float, angle: float, size: float, depth: float, mat, *, bold: float = 1.0, flip: bool = False) -> bpy.types.Object:
    """Lettering on the outside of a cylinder round Z, at `angle` (0 = top, +Y; towards +X positive),
    the letters' tops towards the front (+Z) unless `flip`. Sits flush at its middle."""
    o = lib.text(name, body, size, depth, mat, pos=(0, 0, 0), bold=bold)
    flatten(o)
    n = Vector((math.sin(angle), math.cos(angle), 0))
    up = Vector((0, 0, -1 if flip else 1))
    right = up.cross(n)
    width = max(len(body), 1) * size * 0.6
    sag = width * width / (8 * radius)
    lib.transform(o, frame(right, up, n, n * (radius - sag * 0.6) + Vector((0, 0, z))))
    return o


def tick(name: str, radius: float, z0: float, z1: float, angle: float, width: float, depth: float, mat) -> bpy.types.Object:
    """A painted index line along a cylinder round Z."""
    o = lib.polygon(name, [(-width / 2, z0), (width / 2, z0), (width / 2, z1), (-width / 2, z1)], depth, mat, base=False)
    flatten(o)
    n = Vector((math.sin(angle), math.cos(angle), 0))
    up = Vector((0, 0, 1))
    right = up.cross(n)
    # polygon y is the lens z here: map (x, y, z) -> right*x + n*(radius+z) + up*y
    m = Matrix(((right.x, up.x, n.x, n.x * radius), (right.y, up.y, n.y, n.y * radius), (right.z, up.z, n.z, 0), (0, 0, 0, 1)))
    lib.transform(o, m)
    return o


# ---------------------------------------------------------------------------
# Camera body parts (plan in XZ, height along Y)


def rrect(a: float, b: float, r: float, nc: int = 6) -> list[tuple[float, float]]:
    """Rounded-rectangle outline in plan (x, z), half sizes a × b, corner radius r, counter-clockwise from +X towards +Z."""
    r = max(min(r, a, b), 1e-6)
    pts: list[tuple[float, float]] = []
    for cx, cz, a0 in ((a - r, b - r, 0), (-(a - r), b - r, 90), (-(a - r), -(b - r), 180), (a - r, -(b - r), 270)):
        for k in range(nc + 1):
            t = math.radians(a0 + 90 * k / nc)
            p = (cx + r * math.cos(t), cz + r * math.sin(t))
            if pts and math.dist(pts[-1], p) < 1e-9:
                continue
            pts.append(p)
    if math.dist(pts[0], pts[-1]) < 1e-9:
        pts.pop()
    return pts


def slab(name: str, a: float, b: float, r: float, prof, mat, *, nc: int = 6, smooth_angle: float = 35) -> bpy.types.Object:
    """A rounded-rectangle solid lofted through `prof` = [(inset, y)] from bottom to top
    (inset > 0 rounds or chamfers an edge). Both ends are capped."""
    bm = bmesh.new()
    rings = []
    for ins, y in prof:
        pts = rrect(a - ins, b - ins, r - ins if r - ins > 1e-5 else 1e-5, nc)
        rings.append([bm.verts.new((x, y, z)) for x, z in pts])
    n = len(rings[0])
    assert all(len(rg) == n for rg in rings), "slab rings differ in vertex count"
    for A, B in zip(rings, rings[1:]):
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((A[i], B[i], B[j], A[j]))
    bm.faces.new(rings[0][::-1])
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = lib.mesh_object(name, bm, mat)
    lib.auto_smooth(o, smooth_angle)
    return o


def round_prof(y0: float, y1: float, r_bot: float, r_top: float, steps: int = 3):
    """Profile for `slab`: straight sides from y0 to y1 with quarter-round edges of r_bot / r_top."""
    prof = []
    for k in range(steps + 1) if r_bot > 0 else [steps]:
        t = (math.pi / 2) * k / steps
        prof.append((r_bot * (1 - math.sin(t)), y0 + r_bot * (1 - math.cos(t))))
    for k in range(steps + 1) if r_top > 0 else [0]:
        t = (math.pi / 2) * k / steps
        prof.append((r_top * (1 - math.cos(t)), y1 - r_top + r_top * math.sin(t)))
    return prof


def band(
    name: str,
    a: float,
    b: float,
    r: float,
    y0: float,
    y1: float,
    mat,
    *,
    spacing: float,
    amp: float,
    thick: float = 0.0003,
    holes=(),
    seed: int = 1,
    flat: bool = False,
) -> bpy.types.Object:
    """Leatherette wrapped round a rounded-rectangle body between y0 and y1: a grid
    whose vertices are pushed out by a random grain (real relief, so it catches
    light and AO). `holes` = [(x, y, radius)] on the front (+Z) are left open
    (a lens mount flange covers the ragged edge)."""
    rng = random.Random(seed)
    dense = rrect(a, b, r, 32)
    seg = [math.dist(dense[i], dense[(i + 1) % len(dense)]) for i in range(len(dense))]
    L = sum(seg)
    N = max(8, round(L / spacing))
    pts = []
    acc, k = 0.0, 0
    for i in range(N):
        t = L * i / N
        while acc + seg[k] < t:
            acc += seg[k]
            k += 1
        f = (t - acc) / seg[k]
        p0, p1 = dense[k], dense[(k + 1) % len(dense)]
        pts.append((p0[0] + (p1[0] - p0[0]) * f, p0[1] + (p1[1] - p0[1]) * f))
    norms = []
    for x, z in pts:
        cx, cz = max(-(a - r), min(a - r, x)), max(-(b - r), min(b - r, z))
        v = Vector((x - cx, 0, z - cz))
        norms.append(v.normalized() if v.length > 1e-9 else Vector((0, 0, 1)))
    M = max(2, round((y1 - y0) / spacing))
    bm = bmesh.new()
    grid = []
    for j in range(M + 1):
        y = y0 + (y1 - y0) * j / M
        row = []
        for i in range(N):
            inner = 0 < j < M
            g = thick + (amp * rng.random() ** 1.3 if inner else 0.0)
            n = norms[i]
            # shift interior vertices a little along the surface so the grain doesn't line up in rows
            du = (rng.random() - 0.5) * 0.6 * spacing if inner else 0.0
            dy = (rng.random() - 0.5) * 0.6 * (y1 - y0) / M if inner else 0.0
            row.append(bm.verts.new((pts[i][0] + n.x * g - n.z * du, y + dy, pts[i][1] + n.z * g + n.x * du)))
        grid.append(row)
    for j in range(M):
        for i in range(N):
            ii = (i + 1) % N
            n = norms[i]
            cx = (pts[i][0] + pts[ii][0]) / 2
            cy = y0 + (y1 - y0) * (j + 0.5) / M
            if n.z > 0.7 and any((cx - hx) ** 2 + (cy - hy) ** 2 < hr * hr for hx, hy, hr in holes):
                continue
            bm.faces.new((grid[j][i], grid[j + 1][i], grid[j + 1][ii], grid[j][ii]))
    loose = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=loose, context="VERTS")
    for f in bm.faces:
        f.smooth = not flat
    o = lib.mesh_object(name, bm, mat)

    def want(c, n):
        cx, cz = max(-(a - r), min(a - r, c.x)), max(-(b - r), min(b - r, c.z))
        return Vector((c.x - cx, 0, c.z - cz))

    orient(o, want)
    return o


def hull(name: str, pts, mat, *, bevel: float = 0.0, segments: int = 3) -> bpy.types.Object:
    """Convex hull of points (e.g. a prism housing), coplanar triangles merged, edges optionally rounded."""
    bm = bmesh.new()
    vs = [bm.verts.new(p) for p in pts]
    bmesh.ops.convex_hull(bm, input=vs)
    bmesh.ops.dissolve_limit(bm, angle_limit=math.radians(1), verts=bm.verts, edges=bm.edges)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = lib.mesh_object(name, bm, mat)
    if bevel > 0:
        lib.add_bevel(o, bevel, segments, angle=15)
    return o


def plan_poly(name: str, pts_xz, y0: float, h: float, mat, *, bevel: float = 0.0) -> bpy.types.Object:
    """A flat plate drawn in plan (x, z), from y0 up by h."""
    o = lib.polygon(name, [(x, -z) for x, z in pts_xz], h, mat, base=True)
    lib.transform(o, lib.at(0, y0, 0) @ lib.rot("x", -math.pi / 2))
    if bevel > 0:
        lib.add_bevel(o, bevel, 2)
    return o


def top_text(name: str, body: str, x: float, y: float, z: float, size: float, depth: float, mat, *, angle: float = 0.0, bold: float = 1.0, shear: float = 0.0, align: str = "CENTER") -> bpy.types.Object:
    """Lettering lying on a horizontal surface at height y, reading from the front
    (tops towards −Z) when angle = 0; `angle` turns it about +Y; `shear` slants it (italic/script)."""
    o = lib.text(name, body, size, depth, mat, pos=(0, 0, 0), bold=bold, align=align)
    flatten(o)
    if shear:
        lib.transform(o, Matrix(((1, shear, 0, 0), (0, 1, 0, 0), (0, 0, 1, 0), (0, 0, 0, 1))))
    lib.transform(o, lib.at(x, y, z) @ lib.rot("y", angle) @ lib.rot("x", -math.pi / 2))
    return o


def dial_text(name: str, body: str, cx: float, y: float, cz: float, radius: float, angle: float, size: float, depth: float, mat, *, bold: float = 1.0) -> bpy.types.Object:
    """A number on top of a dial (horizontal, at height y), its top pointing away from the dial
    centre. angle 0 = towards the back (−Z), positive turning towards +X."""
    up = Vector((math.sin(angle), 0, -math.cos(angle)))
    nrm = Vector((0, 1, 0))
    right = up.cross(nrm)
    o = lib.text(name, body, size, depth, mat, pos=(0, 0, 0), bold=bold)
    flatten(o)
    lib.transform(o, frame(right, up, nrm, Vector((cx, y, cz)) + up * radius))
    return o
