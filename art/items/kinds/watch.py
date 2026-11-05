"""
Wristwatches: case with lugs, domed or flat crystal, a printed dial, hands, crown
(plus chronograph pushers or a rotating bezel where the def has those hotspots),
an engraved caseback and a short strap or bracelet stub along ±Y.

Placeholder convention (src/render/items.ts): round case, dial faces +Z, caseback
−Z, crown +X, strap along ±Y. The placeholder sizes the case from the hotspots:
radius R = crown.x − 1.6 mm and half-thickness H = |caseback.z| − 0.3 mm, both
clamped; `case_dims()` does the same so the def's hotspots land on this surface.

Dial print (indices, numerals, logos) is thin raised relief, PRINT high. Angles
on the dial are clock angles: degrees clockwise from 12. Each def is drawn by its
own function, picked by id, so every watch reads as itself.
"""

from __future__ import annotations

import itertools
import math

import bmesh
import lib
from mathutils import Matrix, Vector

AO_DISTANCE = 0.0006

PRINT = 0.00003  # printed ink
APPLIED = 0.00022  # applied indices and logos
HAND_T = 0.0001  # hand thickness


# ---------------------------------------------------------------------------
# 2D helpers (dial plane, metres)


def clock(r: float, deg: float, c=(0.0, 0.0)) -> tuple[float, float]:
    a = math.radians(deg)
    return (c[0] + r * math.sin(a), c[1] + r * math.cos(a))


def circle(r: float, n: int = 24, c=(0.0, 0.0)) -> list[tuple[float, float]]:
    return [(c[0] + r * math.cos(2 * math.pi * i / n), c[1] + r * math.sin(2 * math.pi * i / n)) for i in range(n)]


def turn(pts, deg: float, c=(0.0, 0.0)):
    """Rotate points clockwise by a clock angle about c."""
    a = math.radians(deg)
    ca, sa = math.cos(a), math.sin(a)
    return [(c[0] + x * ca + y * sa, c[1] - x * sa + y * ca) for x, y in pts]


def rect(w: float, h: float, cx: float = 0.0, cy: float = 0.0) -> list[tuple[float, float]]:
    return [(cx - w / 2, cy - h / 2), (cx + w / 2, cy - h / 2), (cx + w / 2, cy + h / 2), (cx - w / 2, cy + h / 2)]


def radial_bar(r0: float, r1: float, w0: float, deg: float, w1: float | None = None, c=(0.0, 0.0)):
    """A bar from radius r0 to r1 along a clock angle (an index or a tick)."""
    w1 = w0 if w1 is None else w1
    return turn([(-w0 / 2, r0), (w0 / 2, r0), (w1 / 2, r1), (-w1 / 2, r1)], deg, c)


def prisms(name: str, polys, z: float, h: float, mat, facing: int = 1):
    """Many raised outlines in one mesh (ticks, plots, dashes)."""
    bm = bmesh.new()
    for pts in polys:
        lib.prism(bm, pts, z, lib.jitter(facing * h), base=False)
    return lib.mesh_object(name, bm, mat)


def ring_line(name: str, r: float, width: float, h: float, mat, *, z: float, c=(0.0, 0.0), n: int = 72, facing: int = 1):
    """A printed circle (closed stroke without round joints)."""
    pts = circle(r, n, c)
    return lib.stroke(name, pts, width, h, mat, z=z, facing=facing, closed=True, round_caps=False)


def annulus(name: str, inner, outer, z0: float, z1: float, mat, *, smooth_angle: float = 40):
    """A ring between two closed outlines with equal point counts (serrated or scalloped bezels)."""
    bm = bmesh.new()
    n = len(inner)
    ib = [bm.verts.new((p[0], p[1], z0)) for p in inner]
    it_ = [bm.verts.new((p[0], p[1], z1)) for p in inner]
    ob = [bm.verts.new((p[0], p[1], z0)) for p in outer]
    ot = [bm.verts.new((p[0], p[1], z1)) for p in outer]
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((it_[i], ot[i], ot[j], it_[j]))
        bm.faces.new((ib[j], ob[j], ob[i], ib[i]))
        bm.faces.new((ot[i], ob[i], ob[j], ot[j]))
        bm.faces.new((it_[j], ib[j], ib[i], it_[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = lib.mesh_object(name, bm, mat)
    lib.auto_smooth(obj, smooth_angle)
    return obj


def shear_obj(obj, k: float, pivot=(0.0, 0.0)) -> None:
    """Italicise lettering: x += k·(y − pivot.y)."""
    for v in obj.data.vertices:
        v.co.x += k * (v.co.y - pivot[1])


# ---------------------------------------------------------------------------
# Case pieces


def case_dims(it: lib.Item) -> tuple[float, float]:
    crown = it.hotspot("crown")
    back = it.hotspot("caseback")
    R = min(max(crown.x - 0.0016, 0.016), 0.022) if crown else 0.019
    depth = min(max(abs(back.z) * 2 - 0.0006, 0.007), 0.014) if back else 0.009
    return R, depth / 2


def vintage_case(R: float, h: float, zd: float, mat, *, bezel_w: float = 0.06) -> None:
    """Round case middle with a polished fixed bezel and a rehaut down to the dial."""
    b_in = 1 - bezel_w - 0.065  # inner lip radius / R
    prof = [
        (0.84 * R, -h + 0.0011),
        (0.92 * R, -h + 0.0011),
        (0.975 * R, -h + 0.0014),
        (0.995 * R, -h + 0.0019),
        (R, -h + 0.0024),
        (R, h - 0.0024),
        (0.993 * R, h - 0.0017),
        (0.97 * R, h - 0.0012),
        ((b_in + bezel_w + 0.02) * R, h - 0.0007),
        ((b_in + bezel_w * 0.55) * R, h - 0.0001),
        ((b_in + bezel_w * 0.2) * R, h),
        (b_in * R, h - 0.0001),
        ((b_in - 0.004) * R, zd + 0.0004),
        ((b_in - 0.02) * R, zd - 0.0002),
        (0.84 * R, zd - 0.0004),
        (0.84 * R, -h + 0.0011),
    ]
    o = lib.lathe("case", prof, mat, segments=96, axis="z", cap=False)
    lib.auto_smooth(o, 38)


def diver_case(R: float, h: float, zd: float, mat, rehaut_mat) -> None:
    """Case middle for a rotating-bezel diver: straight flanks, a seat for the bezel, a rehaut."""
    prof = [
        (0.80 * R, -h + 0.0011),
        (0.92 * R, -h + 0.0011),
        (0.975 * R, -h + 0.0015),
        (0.996 * R, -h + 0.0020),
        (R, -h + 0.0025),
        (R, h - 0.0026),
        (0.99 * R, h - 0.0021),
        (0.95 * R, h - 0.0020),
        (0.95 * R, h - 0.0006),
        (0.775 * R, h - 0.0006),
        (0.765 * R, h - 0.0008),
        (0.765 * R, zd - 0.0002),
        (0.80 * R, zd - 0.0004),
        (0.80 * R, -h + 0.0011),
    ]
    o = lib.lathe("case", prof, mat, segments=96, axis="z", cap=False)
    lib.auto_smooth(o, 38)
    # rehaut: a dark sloped ring from under the crystal down to the dial edge
    reh = [(0.766 * R, h - 0.00075), (0.742 * R, zd + 0.00008), (0.742 * R, zd - 0.0001), (0.766 * R, zd - 0.0001), (0.766 * R, h - 0.00075)]
    lib.lathe("rehaut", reh, rehaut_mat, segments=96, axis="z", cap=False)


def caseback(R: float, h: float, mat, *, field: float = 0.66, screw_notches: int = 0, flutes: int = 0) -> float:
    """Slightly stepped caseback; returns the radius of the flat engraving field (at z = −h)."""
    prof = [(0, -h), (field * R, -h), ((field + 0.08) * R, -h + 0.00025), (0.86 * R, -h + 0.0006), (0.90 * R, -h + 0.0011), (0.90 * R, -h + 0.0017), (0, -h + 0.0017)]
    o = lib.lathe("caseback", prof, mat, segments=96, axis="z", cap=False)
    lib.auto_smooth(o, 30)
    if screw_notches:
        # the screw-back ring: raised flats a case wrench grips
        polys = [radial_bar((field + 0.095) * R, 0.855 * R, 0.0014, 360 * i / screw_notches) for i in range(screw_notches)]
        prisms("caseback.notches", [[(-x, y) for x, y in p] for p in polys], -h + 0.0003, 0.00022, mat, facing=-1)
    if flutes:
        polys = [radial_bar(0.865 * R, 0.895 * R, 0.0005, 360 * i / flutes) for i in range(flutes)]
        prisms("caseback.flutes", polys, -h + 0.0007, 0.00025, mat, facing=-1)
    return field * R


class Back:
    """Engraving on the caseback, in coordinates as seen looking at the back."""

    def __init__(self, z: float, mat):
        self.z, self.mat, self.n = z, mat, 0

    def _nm(self, k: str) -> str:
        self.n += 1
        return f"back.{k}.{self.n}"

    def poly(self, pts, h: float = 0.00012, mat=None, bevel: float = 0.0):
        pts = [(-x, y) for x, y in pts][::-1]
        return lib.polygon(self._nm("poly"), pts, h, mat or self.mat, z=self.z, facing=-1, bevel=bevel, base=False)

    def line(self, pts, width: float, h: float = 0.00008, mat=None, closed: bool = False, caps: bool = True):
        return lib.stroke(self._nm("line"), [(-x, y) for x, y in pts], width, h, mat or self.mat, z=self.z, facing=-1, closed=closed, round_caps=caps)

    def text(self, s: str, size: float, x: float, y: float, *, h: float = 0.0001, mat=None, font: str = "Inter.woff2", bold: float = 1.0, rot: float = 0.0, italic: float = 0.0):
        o = lib.text(self._nm("text"), s, size, h, mat or self.mat, pos=(-x, y, self.z), facing=-1, font_name=font, bold=bold, rot_z=rot)
        if italic:
            shear_obj(o, -italic, (0, y))
        return o

    def arc(self, s: str, radius: float, size: float, *, start: float = math.pi / 2, inward: bool = False, spacing: float = 0.7, h: float = 0.00009, mat=None):
        return lib.arc_text(self._nm("arc"), s, radius, size, h, mat or self.mat, z=self.z, start=start, inward=inward, facing=-1, spacing=spacing)


def lug_set(R: float, h: float, W: float, lw: float, L: float, mat, *, top0: float, top1: float, bot0: float, bot1: float, bevel: float, n: int = 10) -> float:
    """Four lugs at x = ±(W/2 + lw/2), curving down from the case to their tips at |y| = R + L.

    Returns the lug centre x."""
    xc = W / 2 + lw / 2 + 0.0001
    y_in = math.sqrt(max(R * R - (xc + lw / 2) ** 2, 0)) - 0.0012
    y_tip = R + L
    top, bot = [], []
    for i in range(n + 1):
        t = i / n
        y = y_in + (y_tip - 0.0012 - y_in) * t
        e = t * t
        top.append((y, top0 + (top1 - top0) * e))
        bot.append((y, bot0 + (bot1 - bot0) * e))
    # rounded tip
    zt, zb = top[-1][1], bot[-1][1]
    tip = [(y_tip - 0.0012 + 0.0012 * math.sin(a), (zt + zb) / 2 + (zt - zb) / 2 * math.cos(a)) for a in [math.pi * k / 6 for k in range(1, 6)]]
    pts = top + tip + bot[::-1]
    for sx in (-1, 1):
        for sy in (-1, 1):
            m = Matrix(((0, 0, sy, sx * xc), (sy, 0, 0, 0), (0, 1, 0, 0), (0, 0, 0, 1)))
            lib.polygon(f"lug.{sx}.{sy}", pts, lw, mat, z=-lw / 2, xform=m, bevel=bevel)
    return xc


def crown(R: float, x_end: float, r: float, mat, *, teeth: int = 24, tooth: float = 0.00018, tube_r: float = 0.0011, soft: float = 0.00005, cap_r: float | None = None):
    """A knurled crown on a tube along +X; the end face sits at x_end."""
    lib.cylinder("crown.tube", tube_r, (x_end - R) + 0.001, mat, axis="x", center=(R - 0.0005 + ((x_end - R) + 0.001) / 2 - 0.001, 0, 0), segments=24)
    x0 = R + 0.0005
    ln = x_end - 0.0003 - x0
    pts = []
    for i in range(teeth):
        a0 = 2 * math.pi * i / teeth
        da = 2 * math.pi / teeth
        for f, rr in ((0.0, r - tooth), (0.18, r), (0.5, r), (0.68, r - tooth)):
            a = a0 + da * f
            pts.append((rr * math.cos(a), rr * math.sin(a)))
    lib.polygon("crown.knurl", pts, ln, mat, z=0, xform=lib.at(x0, 0, 0) @ lib.rot("y", math.pi / 2), bevel=soft, base=True)
    cr = cap_r or r * 0.94
    lib.lathe("crown.cap", [(0, x_end), (cr * 0.82, x_end), (cr, x_end - 0.00025), (r - tooth * 0.6, x_end - 0.0005)], mat, segments=48, axis="x", cap=True)
    lib.lathe("crown.collar", [(r - tooth * 0.6, x0 + 0.0002), (cr * 0.92, x0), (tube_r, x0 - 0.0001), (tube_r, x0 + 0.0002), (r - tooth * 0.6, x0 + 0.0002)], mat, segments=48, axis="x", cap=False)


def crown_face(objs, x_end: float) -> None:
    """Move relief drawn on the XY plane (facing +Z, centred) onto the crown's end face."""
    lib.transform(objs, lib.at(x_end, 0, 0) @ lib.rot("y", math.pi / 2))


# ---------------------------------------------------------------------------
# Strap and bracelet


def strap_path(sign: int, y0: float, zc: float, flat: float, k: float):
    """Centre line of a strap: straight for `flat`, then bending back (−Z) with curvature k."""

    def f(s: float):
        if s <= flat:
            y, z, th = y0 + s, zc, 0.0
        else:
            th = (s - flat) * k
            y = y0 + flat + math.sin(th) / k
            z = zc - (1 - math.cos(th)) / k
        p = Vector((0, sign * y, z))
        tg = Vector((0, sign * math.cos(th), -math.sin(th)))
        up = Vector((0, sign * math.sin(th), math.cos(th)))
        return p, tg, up

    return f


def frame(p: Vector, tg: Vector, up: Vector) -> Matrix:
    side = tg.cross(up)
    if side.x < 0:
        side = -side
    m = Matrix((side, tg, up)).transposed().to_4x4()
    m.translation = p
    return m


def round_rect(w: float, t: float, rr: float, k: int = 3):
    out = []
    for cx, cy, a0 in ((w / 2 - rr, t / 2 - rr, 0), (-w / 2 + rr, t / 2 - rr, 90), (-w / 2 + rr, -t / 2 + rr, 180), (w / 2 - rr, -t / 2 + rr, 270)):
        for j in range(k + 1):
            a = math.radians(a0 + 90 * j / k)
            out.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    return out


def strap(name: str, path, length: float, w0: float, w1: float, t: float, mat, *, stitch_mat=None, flat: float, stations: int = 18):
    bm = bmesh.new()
    ss = sorted({flat * i / 3 for i in range(4)} | {flat + (length - flat) * i / stations for i in range(stations + 1)})
    rings = []
    for s in ss:
        p, tg, up = path(s)
        m = frame(p, tg, up)
        w = w0 + (w1 - w0) * s / length
        rings.append([bm.verts.new(m @ Vector((a, 0, b))) for a, b in round_rect(w, t, t * 0.42)])
    n = len(rings[0])
    for A, B in itertools.pairwise(rings):
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((A[i], A[j], B[j], B[i]))
    bm.faces.new(rings[0])
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = lib.mesh_object(name, bm, mat)
    lib.auto_smooth(o, 60)
    if stitch_mat is not None:
        bm = bmesh.new()
        s = 0.0045
        while s < length - 0.0015:
            p, tg, up = path(s)
            w = w0 + (w1 - w0) * s / length
            for xs in (-1, 1):
                m = frame(p, tg, up) @ Matrix.Translation((xs * (w / 2 - 0.0011), 0, t / 2)) @ Matrix.Diagonal((0.00032, 0.0009, 0.00014, 1))
                bmesh.ops.create_cube(bm, size=1.0, matrix=m)
            s += 0.0016
        lib.mesh_object(name + ".stitch", bm, stitch_mat)


def bracelet(name: str, path, length: float, w0: float, w1: float, t: float, pieces, *, pitch: float, end_len: float, end_mat, gap: float = 0.0002, round_: float = 0.6, segs: int = 2):
    """Link rows along the path. `pieces` = [(fraction of width, material, extra height)], left to right."""
    lib.box(f"{name}.end", (w0 - 0.0003, end_len, t), end_mat, center=(0, 0, 0), bevel=0.0003, bevel_segments=2)
    o = [ob for ob in lib.mesh_objects() if ob.name.startswith(f"{name}.end")][-1]
    p, tg, up = path(end_len / 2)
    lib.transform(o, frame(p, tg, up))
    s = end_len + gap
    while s + pitch <= length + 1e-6:
        p, tg, up = path(s + pitch / 2)
        w = w0 + (w1 - w0) * (s / length)
        x = -w / 2
        for k, (frac, mat, extra) in enumerate(pieces):
            pw = w * frac
            ob = lib.box(f"{name}.{s:.4f}.{k}", (pw - gap, pitch - gap, t + extra), mat, bevel=min(t * 0.5 * round_, (pw - gap) * 0.45), bevel_segments=segs)
            lib.transform(ob, frame(p, tg, up) @ Matrix.Translation((x + pw / 2, 0, extra / 2)))
            x += pw
        s += pitch


# ---------------------------------------------------------------------------
# Crystal


def _shell(name: str, prof, mat) -> None:
    """An open surface of revolution (the crystal's outer face only), normals towards +Z / outwards.

    One surface instead of a closed shell: a blended glass layer seen twice veils the dial twice."""
    o = lib.lathe(name, prof, mat, segments=72, axis="z", cap=False)
    me = o.data
    bm = bmesh.new()
    bm.from_mesh(me)
    for f in bm.faces:
        c = f.calc_center_median()
        out = Vector((c.x, c.y, 0)).normalized() * 0.3 + Vector((0, 0, 1))
        if f.normal.dot(out) < 0:
            f.normal_flip()
    bm.to_mesh(me)
    bm.free()


def dome_crystal(Rc: float, z_edge: float, z_top: float, mat) -> None:
    n = 8
    outer = [(Rc * i / n, z_edge + (z_top - z_edge) * (1 - (i / n) ** 2)) for i in range(n + 1)]
    _shell("crystal", outer + [(Rc, z_edge - 0.0006)], mat)


def flat_crystal(Rc: float, z_top: float, mat) -> None:
    _shell("crystal", [(0, z_top), (Rc * 0.5, z_top), (Rc - 0.0003, z_top), (Rc, z_top - 0.0002), (Rc, z_top - 0.0008)], mat)


def glass_mat(it: lib.Item):
    """Clear crystal: a faint dark tint that carries the reflections (no white veil)."""
    return lib.material(it, "crystal", "#1a1d22", rough=0.03, alpha=0.16, ao=False)


# ---------------------------------------------------------------------------
# Hands (drawn pointing at 12 from the pivot, then turned)


def hand(name: str, pts, deg: float, z: float, mat, *, c=(0.0, 0.0), t: float = HAND_T):
    return lib.polygon(name, turn(pts, deg, c), t, mat, z=z, base=True)


def leaf(length: float, w: float, tail: float = 0.0):
    pts = [(0, -tail)]
    for i in range(1, 8):
        u = i / 8
        pts.append((w / 2 * math.sin(math.pi * u ** 0.8), length * u))
    pts.append((0, length))
    left = [(-x, y) for x, y in pts[1:-1]][::-1]
    return pts + left


def sword(length: float, w: float, tail: float):
    return [(0, -tail), (w * 0.3, -tail * 0.6), (w / 2, length * 0.12), (w / 2, length * 0.78), (0, length), (-w / 2, length * 0.78), (-w / 2, length * 0.12), (-w * 0.3, -tail * 0.6)]


def baton(length: float, w0: float, w1: float, tail: float):
    return [(-w0 / 2, -tail), (w0 / 2, -tail), (w1 / 2, length), (-w1 / 2, length)]


def pivot(zd: float, z_top: float, r: float, mat, c=(0.0, 0.0)) -> None:
    lib.cylinder("pivot", r, z_top - zd, mat, center=(c[0], c[1], (zd + z_top) / 2), segments=14, bevel=r * 0.3)


# ---------------------------------------------------------------------------
# Dial helpers


class Dial:
    def __init__(self, zd: float, rd: float):
        self.z, self.rd, self.n = zd, rd, 0

    def _nm(self, k: str) -> str:
        self.n += 1
        return f"dial.{k}.{self.n}"

    def disc(self, mat, *, edge: float | None = None) -> None:
        r = edge or self.rd
        # extra rings keep the centre fan short; hard edges keep the face flat-shaded
        prof = [(0, self.z)] + [(r * k / 4, self.z) for k in range(1, 5)] + [(r, self.z - 0.0003), (0, self.z - 0.0003)]
        o = lib.lathe(self._nm("disc"), prof, mat, segments=96, axis="z", cap=False)
        lib.auto_smooth(o, 30)
        for p in o.data.polygons:
            p.use_smooth = False

    def text(self, s: str, size: float, x: float, y: float, mat, *, h: float = PRINT, bold: float = 1.0, rot: float = 0.0, font: str = "Inter.woff2", italic: float = 0.0, spacing: float = 1.0, z: float | None = None):
        o = lib.text(self._nm("text"), s, size, h, mat, pos=(x, y, self.z if z is None else z), rot_z=rot, bold=bold, font_name=font, spacing=spacing)
        if italic:
            shear_obj(o, italic, (x, y))
        return o

    def ticks(self, n: int, r0: float, r1: float, w: float, mat, *, skip=lambda i: False, h: float = PRINT, c=(0.0, 0.0), w1: float | None = None):
        polys = [radial_bar(r0, r1, w, 360 * i / n, w1, c) for i in range(n) if not skip(i)]
        return prisms(self._nm("ticks"), polys, self.z, h, mat)

    def ring(self, r: float, w: float, mat, *, c=(0.0, 0.0), h: float = PRINT, n: int = 72):
        return ring_line(self._nm("ring"), r, w, h, mat, z=self.z, c=c, n=n)

    def poly(self, pts, mat, *, h: float = PRINT, z: float | None = None, bevel: float = 0.0):
        return lib.polygon(self._nm("poly"), pts, h, mat, z=self.z if z is None else z, bevel=bevel, base=False)

    def line(self, pts, w: float, mat, *, h: float = PRINT, closed: bool = False, z: float | None = None):
        return lib.stroke(self._nm("line"), pts, w, h, mat, z=self.z if z is None else z, closed=closed)

    def plots(self, centres, r: float, mat, *, h: float = PRINT, z: float | None = None, seg: int = 18):
        return prisms(self._nm("plots"), [circle(r, seg, c) for c in centres], self.z if z is None else z, h, mat)


# ---------------------------------------------------------------------------
# Common assembly


def leather_straps(R: float, W: float, mat, stitch_mat, *, zc: float, t: float = 0.0032, length: float = 0.03, flat: float = 0.0085, k: float = 38.0, taper: float = 0.0015):
    for sign in (1, -1):
        y0 = R - 0.0012
        path = strap_path(sign, y0, zc, flat, k)
        strap(f"strap.{sign}", path, length, W - 0.0003, W - 0.0003 - taper, t, mat, stitch_mat=stitch_mat, flat=flat)


def bracelets(R: float, W: float, pieces, end_mat, *, zc: float, t: float = 0.0031, length: float = 0.03, pitch: float = 0.0052, k: float = 34.0, round_: float = 0.6, segs: int = 2):
    for sign in (1, -1):
        path = strap_path(sign, R + 0.0004, zc, 0.0075, k)
        bracelet(f"bracelet.{sign}", path, length, W, W - 0.0018, t, pieces, pitch=pitch, end_len=0.0042, end_mat=end_mat, round_=round_, segs=segs)


def flank_text(s: str, size: float, R: float, z: float, h: float, mat) -> None:
    """Engraved lettering on the case flank at 12 o'clock (between the lugs), reading from +Y."""
    o = lib.text("flank.serial", s, size, h, mat, pos=(0, 0, 0), font_name="DejaVuSansMono.woff2", bold=0.6)
    m = Matrix(((-1, 0, 0, 0), (0, 0, 1, R - 0.00003), (0, 1, 0, z), (0, 0, 0, 1)))
    lib.transform(o, m)
    for v in o.data.vertices:
        v.co.y += math.sqrt(max(R * R - v.co.x ** 2, 0)) - R


# ---------------------------------------------------------------------------
# The watches


def pobeda(it: lib.Item) -> None:
    """1950s Pobeda: small gold case, aged cream dial, thin script, small seconds at 6, leaf hands."""
    R, h = case_dims(it)
    gold = lib.material(it, "gold", it.color, metal=1.0, rough=0.24)
    dial_m = lib.material(it, "dial", "#e6d8b6", rough=0.62)
    ink = lib.material(it, "ink", "#2a2118", rough=0.4)
    glass = glass_mat(it)
    leather = lib.material(it, "leather", "#5a3620", rough=0.72)
    hands_m = lib.material(it, "hands", "#3a2a1e", metal=0.6, rough=0.3)

    zd = h - 0.0015
    vintage_case(R, h, zd, gold, bezel_w=0.05)
    rd = 0.87 * R
    d = Dial(zd, rd)
    d.disc(dial_m)
    # railway minute track
    d.ring(rd * 0.955, 0.00012, ink)
    d.ring(rd * 0.895, 0.00012, ink)
    d.ticks(60, rd * 0.895, rd * 0.955, 0.00012, ink, skip=lambda i: i % 5 == 0)
    d.ticks(12, rd * 0.875, rd * 0.965, 0.0004, ink, skip=lambda i: i in (6,))
    # numerals (the 6 is under the seconds subdial)
    for i in range(1, 13):
        if i == 6:
            continue
        x, y = clock(rd * 0.74, i * 30)
        d.text(str(i), 0.0021, x, y, ink, bold=0.6)
    # the thin script name, slightly uneven
    t = d.text("Победа", 0.0021, 0, rd * 0.42, ink, italic=0.28, bold=0.15)
    for k, v in enumerate(t.data.vertices):
        v.co.y += 0.00003 * math.sin(v.co.x * 3100)
    d.text("СДЕЛАНО В СССР", 0.0007, 0, -rd * 0.93 + 0.0002, ink, bold=0.3)
    # small seconds at 6
    sc = (0, -rd * 0.5)
    d.ring(0.0034, 0.0001, ink, c=sc, n=48)
    d.ticks(60, 0.0029, 0.0034, 0.00008, ink, c=sc, skip=lambda i: i % 5 == 0)
    d.ticks(12, 0.0026, 0.0034, 0.00014, ink, c=sc)
    for v, deg in (("10", 60), ("20", 120), ("40", 240), ("50", 300)):
        x, y = clock(0.0020, deg, sc)
        d.text(v, 0.0007, x, y, ink, bold=0.2)
    # hands at 10:09, seconds at 38
    hz = zd + 0.00025
    hand("hand.hour", leaf(rd * 0.5, 0.0018, 0.0012), 304.5, hz, hands_m)
    hand("hand.min", leaf(rd * 0.84, 0.0014, 0.0014), 54, hz + 0.00016, hands_m)
    hand("hand.sec", baton(0.0032, 0.00016, 0.00008, 0.0008), 228, zd + 0.00012, hands_m, c=sc, t=0.00006)
    pivot(zd, hz + 0.00032, 0.0006, hands_m)
    pivot(zd, zd + 0.0002, 0.00035, hands_m, c=sc)
    dome_crystal(0.89 * R, h - 0.0002, h + 0.0009, glass)

    # caseback: 583 with a star assay mark, a scratched repair date
    fr = caseback(R, h, gold, field=0.66)
    b = Back(-h, gold)
    b.poly(lib.star_points(5, 0.0026, 0.0011, (-0.0047, 0.0017)), h=0.00012)
    b.text("583", 0.0044, 0.0016, 0.0017, h=0.00013, bold=0.8)
    b.text("№ 2840571", 0.0015, 0.0, -0.0028, h=0.00008, font="DejaVuSansMono.woff2", bold=0.3)
    # the repair date, scratched in by hand: shallow, a little crooked
    b.text("17.III.81 Д.", 0.0014, 0.0, -0.0054, h=0.00004, font="DejaVuSansMono.woff2", bold=0.0, rot=0.07)
    b.line([(math.cos(a) * fr * 0.93, math.sin(a) * fr * 0.93) for a in [2 * math.pi * i / 72 for i in range(72)]], 0.00012, h=0.00005, closed=True)

    crown(R, it.hotspot("crown").x + 0.0006, 0.0021, gold, teeth=20, tooth=0.00012, soft=0.00009)
    W = 0.016
    lug_set(R, h, W, 0.0021, 0.0055, gold, top0=h - 0.0019, top1=0.0010, bot0=-h + 0.0026, bot1=-0.0016, bevel=0.0004)
    leather_straps(R, W, leather, dial_m, zc=0.0002, t=0.0032)


def vostok(it: lib.Item) -> None:
    """1980s Komandirskie: chromed case, green dial, red star and the Defence Ministry legend, tank caseback."""
    R, h = case_dims(it)
    steel = lib.material(it, "chrome", it.color, metal=1.0, rough=0.3)
    dial_m = lib.material(it, "dial", "#2f4a33", rough=0.55)
    white = lib.material(it, "print", "#ece8da", rough=0.45)
    red = lib.material(it, "red", "#c0281e", rough=0.4)
    glass = glass_mat(it)
    leather = lib.material(it, "leather", "#1e1a17", rough=0.68)

    zd = h - 0.0017
    vintage_case(R, h, zd, steel, bezel_w=0.075)
    rd = 0.85 * R
    d = Dial(zd, rd)
    d.disc(dial_m)
    d.ticks(60, rd * 0.92, rd * 0.97, 0.00014, white, skip=lambda i: i % 5 == 0)
    d.ticks(12, rd * 0.88, rd * 0.97, 0.0006, white)
    for i in range(1, 13):
        x, y = clock(rd * 0.74, i * 30)
        d.text(str(i), 0.0022, x, y, white, bold=1.6)
    # red star, crisply printed, and the order text, tiny and even
    d.poly(lib.star_points(5, 0.0024, 0.00095, (0, rd * 0.45)), red)
    d.text("ЗАКАЗ МО СССР", 0.00075, 0, rd * 0.27, white, bold=0.5, spacing=1.15)
    d.text("КОМАНДИРСКИЕ", 0.00105, 0, -rd * 0.2, white, bold=0.9, spacing=1.05)
    d.text("ВОСТОК", 0.0013, 0, -rd * 0.34, white, bold=1.1)
    d.text("17 КАМНЕЙ", 0.0007, 0, -rd * 0.47, white, bold=0.4)
    # hands: lumed arrows, red seconds
    hz = zd + 0.00025
    hand("hand.hour", [(0, -0.0012), (0.0007, 0), (0.0007, rd * 0.38), (0.0014, rd * 0.4), (0, rd * 0.52), (-0.0014, rd * 0.4), (-0.0007, rd * 0.38), (-0.0007, 0)], 304.5, hz, white)
    hand("hand.min", [(0, -0.0014), (0.0006, 0), (0.0006, rd * 0.68), (0.0011, rd * 0.7), (0, rd * 0.86), (-0.0011, rd * 0.7), (-0.0006, rd * 0.68), (-0.0006, 0)], 54, hz + 0.00016, white)
    hand("hand.sec", baton(rd * 0.9, 0.00022, 0.0001, 0.003), 198, hz + 0.00032, red, t=0.00007)
    pivot(zd, hz + 0.00044, 0.0006, red)
    dome_crystal(0.885 * R, h - 0.0002, h + 0.0010, glass)

    fr = caseback(R, h, steel, field=0.62, screw_notches=8)
    b = Back(-h, steel)
    # tank: hull, tracks, turret, gun
    tk = 0.0019
    b.poly([(-3.6 * tk, -0.4 * tk), (3.4 * tk, -0.4 * tk), (3.9 * tk, 0.4 * tk), (-3.9 * tk, 0.4 * tk)], h=0.00012)
    b.poly([(-3.2 * tk, -1.4 * tk), (3.2 * tk, -1.4 * tk), (3.7 * tk, -0.5 * tk), (-3.7 * tk, -0.5 * tk)], h=0.0001)
    for i in range(6):
        b.poly(circle(0.38 * tk, 12, (-2.6 * tk + i * 1.04 * tk, -0.95 * tk)), h=0.00014)
    b.poly([(-1.8 * tk, 0.4 * tk), (1.0 * tk, 0.4 * tk), (0.7 * tk, 1.25 * tk), (-1.5 * tk, 1.3 * tk)], h=0.00013)
    b.line([(0.9 * tk, 0.9 * tk), (4.4 * tk, 1.05 * tk)], 0.00034, h=0.00013)
    b.text("№ 274913", 0.0016, 0, -0.0052, h=0.00009, font="DejaVuSansMono.woff2", bold=0.3)
    b.arc("ВОДОНЕПРОНИЦАЕМЫЕ", fr * 0.84, 0.0014, start=math.pi / 2, spacing=0.66)
    b.arc("НЕРЖ. СТАЛЬ", fr * 0.84, 0.0014, start=-math.pi / 2, inward=True, spacing=0.68)

    x_end = it.hotspot("crown").x + 0.0006
    crown(R, x_end, 0.0024, steel, teeth=26, tooth=0.00018, soft=0.00004)
    crown_face([lib.polygon("crown.star", lib.star_points(5, 0.0013, 0.0005), 0.00008, steel, base=False)], x_end)
    W = 0.018
    lug_set(R, h, W, 0.0022, 0.0055, steel, top0=h - 0.0021, top1=0.0012, bot0=-h + 0.0027, bot1=-0.0018, bevel=0.00012)
    leather_straps(R, W, leather, white, zc=0.0002, t=0.0033)


def rolland(it: lib.Item) -> None:
    """1990s Rolland Abyssal: black diver, lume plots, date with magnifier, unidirectional bezel, Oyster-style bracelet."""
    R, h = case_dims(it)
    steel = lib.material(it, "steel", it.color, metal=1.0, rough=0.16)
    brushed = lib.material(it, "brushed", lib.shade(it.color, 0.92), metal=1.0, rough=0.42)
    black = lib.material(it, "black", "#0c0d0f", rough=0.32)
    white = lib.material(it, "print", "#e9e9e4", rough=0.4)
    lume = lib.material(it, "lume", "#d8dcc4", rough=0.5)
    glass = glass_mat(it)

    zd = h - 0.0022
    diver_case(R, h, zd, steel, black)
    # rotating bezel: coin-edge steel ring, black insert with deep numerals
    n = 120
    inner = circle(0.94 * R, 2 * n)
    outer = [((R * (1.004 if i % 2 == 0 else 0.988)) * math.cos(2 * math.pi * i / (2 * n)), (R * (1.004 if i % 2 == 0 else 0.988)) * math.sin(2 * math.pi * i / (2 * n))) for i in range(2 * n)]
    annulus("bezel", inner, outer, h - 0.00195, h + 0.00045, steel)
    zi = h + 0.00038
    lib.lathe("insert", [(0.765 * R, h - 0.0004), (0.955 * R, h - 0.0004), (0.955 * R, zi), (0.765 * R, zi), (0.765 * R, h - 0.0004)], black, segments=96, axis="z", cap=False)
    ri = 0.86 * R
    for k in range(1, 6):
        x, y = clock(ri, k * 60)
        lib.text(f"bezel.{k}", str(k * 10), 0.0021, PRINT * 2, white, pos=(x, y, zi), rot_z=-math.radians(k * 60), bold=1.6)
    polys = [radial_bar(0.82 * R, 0.91 * R, 0.00028, i * 6) for i in range(1, 15)]
    polys += [radial_bar(0.80 * R, 0.92 * R, 0.0007, deg) for deg in (30, 90, 150, 210, 270, 330)]
    prisms("bezel.ticks", polys, zi, PRINT * 2, white)
    tri = [clock(0.80 * R, 0), clock(0.925 * R, 7), clock(0.925 * R, -7)]
    lib.polygon("bezel.triangle", tri, PRINT * 2, white, z=zi, base=False)
    prisms("bezel.pip", [circle(0.0005, 14, clock(0.885 * R, 0))], zi + PRINT * 2.2, 0.00006, lume)

    rd = 0.745 * R
    d = Dial(zd, rd)
    d.disc(black)
    d.ticks(60, rd * 0.93, rd * 0.99, 0.0001, white, skip=lambda i: i % 5 == 0)
    # lume plots with steel surrounds
    rp = rd * 0.81
    dots = [clock(rp, i * 30) for i in range(12) if i not in (0, 3, 6, 9)]
    d.plots(dots, 0.00095, steel, h=0.00018)
    d.plots(dots, 0.00075, lume, h=0.00022)
    for deg in (180, 270):
        d.poly(radial_bar(rd * 0.68, rd * 0.92, 0.0016, deg), steel, h=0.00018)
        d.poly(radial_bar(rd * 0.695, rd * 0.905, 0.0012, deg), lume, h=0.00022)
    t12 = [clock(rd * 0.93, -9), clock(rd * 0.93, 9), clock(rd * 0.66, 0)]
    d.poly(t12, steel, h=0.00018)
    d.poly([clock(rd * 0.915, -7.5), clock(rd * 0.915, 7.5), clock(rd * 0.69, 0)], lume, h=0.00022)
    # date at 3
    dc = (rd * 0.74, 0)
    d.poly(rect(0.0031, 0.0024, *dc), steel, h=0.00012)
    d.poly(rect(0.0026, 0.0019, *dc), white, h=0.00016)
    d.text("17", 0.0015, dc[0], dc[1], black, h=PRINT, bold=0.6, z=zd + 0.00019)
    # the R-and-anchor and dial text
    ay = rd * 0.55
    d.line([(0, ay - 0.0011), (0, ay + 0.0011)], 0.00022, white)
    d.line([(-0.0006, ay + 0.0006), (0.0006, ay + 0.0006)], 0.0002, white)
    d.line([clock(0.0009, a, (0, ay - 0.0003)) for a in range(120, 250, 13)], 0.0002, white)
    d.line(circle(0.00028, 12, (0, ay + 0.0014)), 0.00012, white, closed=True)
    d.text("R", 0.0011, -0.0011, ay + 0.0001, white, bold=1.2)
    d.text("ROLLAND", 0.00125, 0, rd * 0.38, white, bold=1.4, spacing=1.08)
    d.text("AUTOMATIC", 0.0006, 0, rd * 0.28, white, bold=0.6, spacing=1.1)
    d.text("ABYSSAL", 0.00095, 0, -rd * 0.3, white, bold=1.0, spacing=1.08)
    d.text("300 m = 1000 ft", 0.00072, 0, -rd * 0.42, white, bold=0.6)
    # hands: baton with a lume ring (hour), tapered baton (minute), lollipop seconds
    hz = zd + 0.00028
    hp = [(-0.0006, -0.0012), (0.0006, -0.0012), (0.0006, rd * 0.36), (-0.0006, rd * 0.36)]
    hand("hand.hour", hp, 304.5, hz, steel)
    hand("hand.hour.ring", circle(0.0013, 20, (0, rd * 0.44)), 304.5, hz, steel)
    hand("hand.hour.tip", [(-0.0005, rd * 0.5), (0.0005, rd * 0.5), (0, rd * 0.58)], 304.5, hz, steel)
    hand("hand.hour.lume", circle(0.0010, 20, (0, rd * 0.44)), 304.5, hz + HAND_T, lume, t=0.00004)
    hand("hand.hour.lume2", [(-0.0003, 0.0006), (0.0003, 0.0006), (0.0003, rd * 0.34), (-0.0003, rd * 0.34)], 304.5, hz + HAND_T, lume, t=0.00004)
    hand("hand.min", baton(rd * 0.9, 0.0011, 0.0008, 0.0014), 54, hz + 0.00018, steel)
    hand("hand.min.lume", baton(rd * 0.86, 0.0005, 0.0004, -0.001), 54, hz + 0.00018 + HAND_T, lume, t=0.00004)
    hand("hand.sec", baton(rd * 0.94, 0.0002, 0.00012, 0.0032), 198, hz + 0.00036, steel, t=0.00007)
    hand("hand.sec.dot", circle(0.00065, 16, (0, rd * 0.7)), 198, hz + 0.00036, steel, t=0.00007)
    hand("hand.sec.lume", circle(0.0005, 16, (0, rd * 0.7)), 198, hz + 0.00043, lume, t=0.00003)
    pivot(zd, hz + 0.00048, 0.00065, steel)
    flat_crystal(0.77 * R, h + 0.0002, glass)
    # date magnifier on the crystal
    cyc = [(dc[0] + 0.0024 * math.copysign(abs(math.cos(a)) ** 0.5, math.cos(a)), 0.002 * math.copysign(abs(math.sin(a)) ** 0.5, math.sin(a))) for a in [2 * math.pi * i / 28 for i in range(28)]]
    lib.polygon("cyclops", cyc, 0.0007, glass, z=h + 0.00019, bevel=0.0002)

    caseback(R, h, steel, field=0.7, flutes=48)
    b = Back(-h, brushed)
    # fine swirl scratches: short arcs about wandering centres (deterministic)
    for k in range(34):
        u = math.sin(k * 12.9898) * 43758.5453
        u -= math.floor(u)
        v = math.sin(k * 78.233) * 12543.731
        v -= math.floor(v)
        cx, cy = (u - 0.5) * 0.004, (v - 0.5) * 0.004
        r0 = 0.002 + 0.0095 * ((u + v * 0.7) % 1.0)
        a0 = 2 * math.pi * v + k
        span = 0.25 + 0.5 * u
        b.line([(cx + r0 * math.cos(a0 + span * j / 7), cy + r0 * math.sin(a0 + span * j / 7)) for j in range(8)], 0.00003, h=0.000006, caps=False)

    x_end = it.hotspot("crown").x + 0.0006
    crown(R, x_end, 0.0029, steel, teeth=30, tooth=0.00022, tube_r=0.0016, soft=0.00004)
    crown_face([lib.text("crown.R", "R", 0.0024, 0.00008, steel, bold=1.5)], x_end)
    # crown guards
    for sy in (-1, 1):
        g = [(R - 0.0012, sy * 0.0022), (R + 0.0011, sy * 0.0027), (R + 0.0014, sy * 0.0038), (R - 0.0006, sy * 0.0062)]
        lib.polygon(f"guard.{sy}", g if sy > 0 else g[::-1], 0.0046, steel, z=-0.0023, bevel=0.0006)
    W = 0.020
    lug_set(R, h, W, 0.0026, 0.006, steel, top0=h - 0.0027, top1=0.0006, bot0=-h + 0.0027, bot1=-0.0024, bevel=0.0005)
    flank_text("8 1 7 3 4 0 2", 0.0011, R, 0.0015, 0.00006, brushed)
    bracelets(R, W, [(0.37, brushed, 0.0), (0.26, steel, 0.0003), (0.37, brushed, 0.0)], brushed, zc=-0.0015, round_=0.85, segs=3)


def poljot(it: lib.Item) -> None:
    """1960s–70s Poljot Strela: silver chronograph dial, three subdials, tachymeter, pushers at 2 and 4."""
    R, h = case_dims(it)
    steel = lib.material(it, "steel", it.color, metal=1.0, rough=0.28)
    dial_m = lib.material(it, "dial", "#dcdad2", metal=0.35, rough=0.42)
    ink = lib.material(it, "ink", "#17181a", rough=0.45)
    red = lib.material(it, "red", "#b5291f", rough=0.4)
    glass = glass_mat(it)
    leather = lib.material(it, "leather", "#231a14", rough=0.7)

    zd = h - 0.0017
    vintage_case(R, h, zd, steel, bezel_w=0.05)
    rd = 0.87 * R
    d = Dial(zd, rd)
    d.disc(dial_m)
    # tachymeter outer ring
    d.ring(rd * 0.985, 0.0001, ink)
    d.ring(rd * 0.86, 0.0001, ink)
    for v in (500, 400, 300, 250, 200, 150, 120, 100, 90, 80, 70, 60):
        deg = 3600 / v * 6
        x, y = clock(rd * 0.925, deg)
        d.text(str(v), 0.00078, x, y, ink, rot=-math.radians(deg), bold=0.5)
        d.poly(radial_bar(rd * 0.965, rd * 0.985, 0.00009, deg), ink)
    d.ticks(60, rd * 0.80, rd * 0.86, 0.0001, ink, skip=lambda i: i % 5 == 0)
    # hour batons except where the subdials sit
    for i in range(12):
        if i in (3, 6, 9):
            continue
        if i == 0:
            d.poly(radial_bar(rd * 0.62, rd * 0.79, 0.0005, -1.4), ink)
            d.poly(radial_bar(rd * 0.62, rd * 0.79, 0.0005, 1.4), ink)
        else:
            d.poly(radial_bar(rd * 0.64, rd * 0.79, 0.0006, i * 30), ink)
    # three subdials: running seconds (9), 30-minute counter (3), 12-hour counter (6)
    rs = 0.0040
    for name, deg, n_ticks, labels in (("sec", 270, 60, ("60", "20", "40")), ("min", 90, 30, ("30", "10", "20")), ("hr", 180, 12, ("12", "3", "6", "9"))):
        c = clock(rd * 0.45, deg)
        d.ring(rs, 0.0001, ink, c=c, n=48)
        d.ring(rs * 0.7, 0.00006, ink, c=c, n=40)
        d.ticks(n_ticks, rs * 0.78, rs * 0.97, 0.00007, ink, c=c)
        d.ticks(12 if n_ticks != 30 else 6, rs * 0.7, rs * 0.97, 0.00014, ink, c=c)
        for k, s in enumerate(labels):
            x, y = clock(rs * 0.47, 360 * k / len(labels) if name != "hr" else 90 * k, c)
            d.text(s, 0.0007, x, y, ink, bold=0.3)
    d.text("ПОЛЁТ", 0.0016, 0, rd * 0.42, ink, bold=1.4)
    d.text("17 КАМНЕЙ", 0.0006, 0, rd * 0.3, ink, bold=0.3)
    d.text("СДЕЛАНО В СССР", 0.00062, 0, -rd * 0.735, ink, bold=0.3)
    # hands
    hz = zd + 0.00025
    hand("hand.hour", baton(rd * 0.5, 0.0011, 0.0008, 0.001), 304.5, hz, ink)
    hand("hand.min", baton(rd * 0.82, 0.0009, 0.0006, 0.0012), 54, hz + 0.00015, ink)
    hand("hand.chrono", baton(rd * 0.98, 0.00018, 0.0001, 0.0028), 0, hz + 0.0003, red, t=0.00007)
    hand("hand.chrono.cw", circle(0.00045, 14, (0, -0.0024)), 0, hz + 0.0003, red, t=0.00007)
    for deg, ang, ln in ((270, 140, 0.0034), (90, 0, 0.0032), (180, 0, 0.003)):
        c = clock(rd * 0.45, deg)
        hand(f"hand.sub.{deg}", baton(ln, 0.00026, 0.0001, 0.0007), ang, zd + 0.00012, ink, c=c, t=0.00006)
        pivot(zd, zd + 0.0002, 0.00032, ink, c=c)
    pivot(zd, hz + 0.0004, 0.0006, steel)
    dome_crystal(0.89 * R, h - 0.0002, h + 0.0011, glass)

    fr = caseback(R, h, steel, field=0.64, screw_notches=6)
    b = Back(-h, steel)
    b.text("№ 0731586", 0.0021, 0, 0.0012, h=0.0001, font="DejaVuSansMono.woff2", bold=0.3)
    b.text("НЕРЖ. СТАЛЬ", 0.0015, 0, -0.0018, h=0.00009, bold=0.3)
    b.text("23 КАМНЯ", 0.0015, 0, -0.0043, h=0.00009, bold=0.3)
    b.arc("ПОЛЁТ • ХРОНОГРАФ", fr * 0.82, 0.0015, start=math.pi / 2, spacing=0.68)

    x_end = it.hotspot("crown").x + 0.0006
    crown(R, x_end, 0.0022, steel, teeth=22, tooth=0.00012, soft=0.00008)
    # pushers at 2 and 4
    pr = 0.0011
    for deg in (60, 120):  # clock angles; the crown is at 90
        p_end = R + 0.0028
        objs = [
            lib.cylinder(f"pusher.stem.{deg}", 0.0007, 0.0024, steel, axis="x", center=(R - 0.0004 + 0.0012, 0, 0), segments=20),
            lib.lathe(f"pusher.cap.{deg}", [(0, p_end), (pr * 0.85, p_end), (pr, p_end - 0.0002), (pr, p_end - 0.0011), (0.0007, p_end - 0.0013), (0, p_end - 0.0013)], steel, segments=28, axis="x", cap=False),
        ]
        lib.transform(objs, lib.rot("z", math.radians(90 - deg)))
    W = 0.018
    lug_set(R, h, W, 0.0022, 0.0055, steel, top0=h - 0.0021, top1=0.0011, bot0=-h + 0.0027, bot1=-0.0017, bevel=0.0003)
    leather_straps(R, W, leather, dial_m, zc=0.0002, t=0.0033)


def omeca(it: lib.Item) -> None:
    """2000s Omeca Aquastar: blue wave dial, applied indices and logo, scalloped bezel, five-link bracelet."""
    R, h = case_dims(it)
    steel = lib.material(it, "steel", it.color, metal=1.0, rough=0.14)
    brushed = lib.material(it, "brushed", lib.shade(it.color, 0.93), metal=1.0, rough=0.4)
    blue = lib.material(it, "blue", "#1f3f86", metal=0.25, rough=0.3)
    white = lib.material(it, "print", "#eef0f2", rough=0.4)
    lume = lib.material(it, "lume", "#cfe0d6", rough=0.5)
    glass = glass_mat(it)

    zd = h - 0.0022
    diver_case(R, h, zd, steel, blue)
    # scalloped bezel ring and a blue insert
    n = 240
    inner = circle(0.94 * R, n)
    outer = []
    for i in range(n):
        a = 2 * math.pi * i / n
        rr = R * (0.986 + 0.016 * abs(math.cos(a * 3)) ** 0.6)
        outer.append((rr * math.cos(a), rr * math.sin(a)))
    annulus("bezel", inner, outer, h - 0.00195, h + 0.0004, steel, smooth_angle=60)
    zi = h + 0.00034
    lib.lathe("insert", [(0.765 * R, h - 0.0004), (0.952 * R, h - 0.0004), (0.952 * R, zi), (0.765 * R, zi), (0.765 * R, h - 0.0004)], blue, segments=96, axis="z", cap=False)
    ri = 0.86 * R
    for k in range(1, 6):
        x, y = clock(ri, k * 60)
        lib.text(f"bezel.{k}", str(k * 10), 0.0019, PRINT * 2, white, pos=(x, y, zi), rot_z=-math.radians(k * 60), bold=1.0)
    polys = [radial_bar(0.83 * R, 0.9 * R, 0.0005, i * 6) for i in range(1, 15) if i % 5]
    polys += [radial_bar(0.81 * R, 0.92 * R, 0.0005, deg) for deg in (90, 150, 210, 270)]
    prisms("bezel.ticks", polys, zi, PRINT * 2, white)
    prisms("bezel.pip", [circle(0.0007, 16, clock(0.86 * R, 0))], zi, 0.0001, lume)
    prisms("bezel.pipring", [circle(0.00085, 16, clock(0.86 * R, 0))], zi, 0.00006, white)

    rd = 0.745 * R
    d = Dial(zd, rd)
    d.disc(blue)
    # waves
    wy = -rd
    while wy < rd:
        pts = []
        for j in range(33):
            x = -rd + 2 * rd * j / 32
            y = wy + 0.00045 * math.sin(x / 0.0021 * math.pi)
            if x * x + y * y < (rd * 0.9) ** 2:
                pts.append((x, y))
        if len(pts) > 2:
            lib.stroke(f"wave.{wy:.4f}", pts, 0.00035, 0.00003, blue, z=zd, round_caps=False)
        wy += 0.0013
    d.ticks(60, rd * 0.93, rd * 0.99, 0.00012, white, skip=lambda i: i % 5 == 0)
    for i in range(12):
        zz = zd + 0.0001
        if i == 0:
            for s in (-1, 1):
                d.poly(turn(rect(0.0009, 0.0028, s * 0.0007, rd * 0.78), 0), steel, h=APPLIED, z=zz)
                d.poly(turn(rect(0.0004, 0.0021, s * 0.0007, rd * 0.78), 0), lume, h=APPLIED + 0.00003, z=zz)
        else:
            d.poly(radial_bar(rd * 0.67, rd * 0.89, 0.0011, i * 30), steel, h=APPLIED, z=zz)
            d.poly(radial_bar(rd * 0.69, rd * 0.87, 0.0005, i * 30), lume, h=APPLIED + 0.00003, z=zz)
    # applied star logo, polished
    d.poly(lib.star_points(5, 0.0011, 0.00045, (0, rd * 0.52)), steel, h=APPLIED, z=zd + 0.00006, bevel=0.00006)
    d.text("OMECA", 0.0013, 0, rd * 0.36, white, bold=1.2, spacing=1.12)
    d.text("Aquastar", 0.0011, 0, -rd * 0.3, white, italic=0.22, bold=0.6)
    d.text("AUTOMATIC  300 M", 0.00062, 0, -rd * 0.42, white, bold=0.6)
    # hands: polished swords with lume
    hz = zd + 0.0004
    hand("hand.hour", sword(rd * 0.56, 0.0017, 0.0012), 304.5, hz, steel)
    hand("hand.hour.lume", sword(rd * 0.48, 0.0009, -0.0012), 304.5, hz + HAND_T, lume, t=0.00004)
    hand("hand.min", sword(rd * 0.9, 0.0014, 0.0014), 54, hz + 0.00016, steel)
    hand("hand.min.lume", sword(rd * 0.8, 0.0007, -0.0016), 54, hz + 0.00016 + HAND_T, lume, t=0.00004)
    hand("hand.sec", baton(rd * 0.92, 0.0002, 0.00012, 0.003), 198, hz + 0.00032, steel, t=0.00007)
    hand("hand.sec.lol", [(0, rd * 0.62), (0.0006, rd * 0.7), (0, rd * 0.8), (-0.0006, rd * 0.7)], 198, hz + 0.00032, steel, t=0.00007)
    hand("hand.sec.lume", [(0, rd * 0.645), (0.00038, rd * 0.7), (0, rd * 0.765), (-0.00038, rd * 0.7)], 198, hz + 0.00039, lume, t=0.00003)
    pivot(zd, hz + 0.00044, 0.00065, steel)
    flat_crystal(0.77 * R, h + 0.0002, glass)

    fr = caseback(R, h, steel, field=0.7, flutes=36)
    b = Back(-h, steel)
    # seahorse: body, curled tail, fin, ridges
    sh = 0.0155
    body = [(-0.02, 0.50), (0.06, 0.52), (0.10, 0.44), (0.17, 0.42), (0.34, 0.40), (0.36, 0.35), (0.16, 0.33), (0.12, 0.26), (0.17, 0.15), (0.20, 0.03), (0.18, -0.09), (0.12, -0.19), (0.03, -0.26), (-0.06, -0.24), (-0.10, -0.12), (-0.12, 0.02), (-0.10, 0.16), (-0.06, 0.28), (-0.08, 0.38), (-0.06, 0.46)]
    S = lambda pts: [(x * sh, y * sh + 0.0008) for x, y in pts]
    b.poly(S(body), h=0.00016, bevel=0.00004)
    b.line(S([(-0.01, -0.22), (0.0, -0.32), (-0.03, -0.40), (-0.09, -0.45), (-0.15, -0.43), (-0.17, -0.37), (-0.14, -0.32), (-0.10, -0.33)]), 0.0005, h=0.00016)
    b.poly(S([(-0.10, 0.12), (-0.21, 0.16), (-0.24, 0.03), (-0.12, -0.04)]), h=0.00012)
    for y in (0.1, 0.0, -0.1):
        b.line(S([(-0.10, y), (0.17, y - 0.02)]), 0.00012, h=0.00021)
    b.arc("OMECA • AQUASTAR • 300 M", fr * 0.87, 0.0013, start=math.pi / 2, spacing=0.66)
    b.text("81274093", 0.0015, 0, -fr * 0.66, h=0.0001, font="DejaVuSansMono.woff2", bold=0.3)

    x_end = it.hotspot("crown").x + 0.0006
    crown(R, x_end, 0.0029, steel, teeth=28, tooth=0.0002, tube_r=0.0016, soft=0.00005)
    crown_face([lib.polygon("crown.logo", lib.star_points(5, 0.0014, 0.00058), 0.0001, steel, base=False)], x_end)
    W = 0.020
    lug_set(R, h, W, 0.0026, 0.0062, steel, top0=h - 0.0027, top1=0.0005, bot0=-h + 0.0027, bot1=-0.0024, bevel=0.0002)
    flank_text("81274093", 0.0011, R, 0.0015, 0.00007, brushed)
    bracelets(R, W, [(0.25, brushed, 0.0), (0.12, steel, 0.00015), (0.26, brushed, 0.0), (0.12, steel, 0.00015), (0.25, brushed, 0.0)], brushed, zc=-0.0015, pitch=0.0046, round_=0.5)


def brequet(it: lib.Item) -> None:
    """1990s Brequet-Fils Classique: slim 750 gold case with a fluted band, engine-turned silver dial,
    Roman chapter ring, blued moon-tipped hands, welded wire lugs with screw bars."""
    R, h = case_dims(it)
    gold = lib.material(it, "gold", it.color, metal=1.0, rough=0.2)
    silver = lib.material(it, "dial", "#d9d8d2", metal=0.85, rough=0.34)
    ink = lib.material(it, "ink", "#1b1c20", rough=0.4)
    blued = lib.material(it, "blued", "#1c2f7a", metal=1.0, rough=0.22)
    glass = glass_mat(it)
    leather = lib.material(it, "leather", "#121214", rough=0.42)

    zd = h - 0.0013
    vintage_case(R, h, zd, gold, bezel_w=0.045)
    # coin-edge band on the flank
    n = 150
    bm = bmesh.new()
    for i in range(n):
        a = 2 * math.pi * i / n
        w = 2 * math.pi * R / n * 0.42
        m = lib.rot("z", a) @ Matrix.Translation((R + 0.00005, 0, 0.0)) @ Matrix.Diagonal((0.00018, w, 2 * h - 0.0054, 1))
        bmesh.ops.create_cube(bm, size=1.0, matrix=m)
    lib.mesh_object("flutes", bm, gold)

    rd = 0.875 * R
    # engine-turned dial: a polar mesh whose vertices alternate high/low, twisted per ring
    bm = bmesh.new()
    N = 96
    A = 0.00005
    rings_r = [rd * 0.06 + (rd * 0.58 - rd * 0.06) * j / 11 for j in range(12)] + [rd * 0.6, rd * 0.605, rd * 0.83, rd * 0.835] + [rd * 0.86 + (rd * 1.0 - rd * 0.86) * j / 4 for j in range(5)]
    rings = []
    for r in rings_r:
        tw = 1.6 * (r / rd) if r < rd * 0.6 else 0.0
        if r < rd * 0.6:
            zz = [zd + (A if i % 2 == 0 else 0) for i in range(2 * N)]
        elif r > rd * 0.855:
            zz = [zd + (A * 0.6 if i % 2 == 0 else 0) for i in range(2 * N)]
        else:
            zz = [zd + A * 0.5] * (2 * N)
        rings.append([bm.verts.new((r * math.cos(math.pi * i / N + tw), r * math.sin(math.pi * i / N + tw), zz[i])) for i in range(2 * N)])
    for a_, b_ in itertools.pairwise(rings):
        for i in range(2 * N):
            j = (i + 1) % (2 * N)
            bm.faces.new((a_[i], a_[j], b_[j], b_[i]))
    centre = bm.verts.new((0, 0, zd + A * 0.5))
    for i in range(2 * N):
        bm.faces.new((centre, rings[0][i], rings[0][(i + 1) % (2 * N)]))
    # step faces between the zones are hidden by ring overlaps; recalc for +Z
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        if f.normal.z < 0:
            f.normal_flip()
        f.smooth = False
    lib.mesh_object("dial.guilloche", bm, silver)
    lib.lathe("dial.under", [(0, zd - 0.00002), (rd, zd - 0.00002), (rd, zd - 0.0003), (0, zd - 0.0003)], silver, segments=96, axis="z", cap=False)
    d = Dial(zd + A * 0.5, rd)
    # chapter ring: Roman numerals, pearled minute track
    for i in range(1, 13):
        deg = i * 30
        x, y = clock(rd * 0.715, deg)
        d.text(["I", "II", "III", "IIII", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"][i - 1], 0.0021, x, y, ink, rot=-math.radians(deg), bold=0.3, spacing=0.9)
    d.ring(rd * 0.83, 0.00008, ink)
    d.ring(rd * 0.605, 0.00008, ink)
    zz = zd + A * 0.6
    d.plots([clock(rd * 0.93, i * 6) for i in range(60) if i % 5], 0.00009, ink, z=zz, seg=8)
    d.plots([clock(rd * 0.93, i * 30) for i in range(12)], 0.00022, ink, z=zz, seg=12)
    d.text("BREQUET-FILS", 0.0011, 0, rd * 0.36, ink, bold=0.4, spacing=1.15, z=zd + A)
    d.text("№ 4127", 0.0007, 0, -rd * 0.36, ink, bold=0.3, z=zd + A)
    # the secret signature beside the XII: dial metal only, shows when tilted to the light
    d.text("BF", 0.0006, -0.0021, rd * 0.86, silver, h=0.000012, bold=0.2, z=zd + A * 0.5)
    d.text("BF", 0.0006, 0.0021, rd * 0.86, silver, h=0.000012, bold=0.2, z=zd + A * 0.5)
    # blued hands with hollow moon tips
    hz = zd + 0.00022
    for nm, deg, ln, z in (("hour", 304.5, rd * 0.5, hz), ("min", 54, rd * 0.8, hz + 0.00016)):
        mr = 0.00085 if nm == "hour" else 0.0007
        shaft = baton(ln - 2 * mr, 0.00045, 0.0003, 0.0016)
        hand(f"hand.{nm}", shaft, deg, z, blued)
        ringpts = turn(circle(mr - 0.00012, 22, (0, ln - mr)), deg)
        lib.stroke(f"hand.{nm}.moon", ringpts, 0.00026, HAND_T, blued, z=z, closed=True, round_caps=False)
        hand(f"hand.{nm}.tip", [(-0.00022, ln - 0.00012), (0.00022, ln - 0.00012), (0, ln + (0.0028 if nm == "hour" else 0.0034))], deg, z, blued)
        hand(f"hand.{nm}.boss", circle(0.0008, 18), deg, z, blued)
    pivot(zd, hz + 0.0003, 0.00045, blued)
    dome_crystal(0.895 * R, h - 0.0002, h + 0.0006, glass)

    fr = caseback(R, h, gold, field=0.68)
    b = Back(-h, gold)
    b.arc("BREQUET-FILS • PARIS", fr * 0.84, 0.0014, start=math.pi / 2, spacing=0.66)
    b.text("750", 0.003, 0.0032, 0.0008, h=0.00012, bold=0.6)
    # assay hallmark: a little shield with a star in it
    sx, sy = -0.0032, 0.0009
    b.line([(sx - 0.0017, sy + 0.0014), (sx + 0.0017, sy + 0.0014), (sx + 0.0017, sy - 0.0004), (sx, sy - 0.0018), (sx - 0.0017, sy - 0.0004)], 0.00022, h=0.0001, closed=True)
    b.poly(lib.star_points(5, 0.0008, 0.00033, (sx, sy + 0.00005)), h=0.0001)
    b.text("№ 4127 B", 0.0017, 0, -0.0040, h=0.00006, italic=0.3, bold=0.1)

    crown(R, it.hotspot("crown").x + 0.0006, 0.0019, gold, teeth=18, tooth=0.0001, tube_r=0.0009, soft=0.00007)
    # welded wire lugs: round bars from the case, a screw boss at each tip, screw heads flush
    W = 0.016
    lr = 0.00085
    xc = W / 2 + lr + 0.0001
    y_in = math.sqrt(R * R - xc * xc) - 0.0008
    for sx_ in (-1, 1):
        for sy_ in (-1, 1):
            p0 = Vector((sx_ * xc, sy_ * y_in, -0.0004))
            p1 = Vector((sx_ * xc, sy_ * (R + 0.0040), -0.0008))
            p2 = Vector((sx_ * xc, sy_ * (R + 0.0058), -0.0021))
            for k, (a_, b_) in enumerate(((p0, p1), (p1, p2))):
                dv = b_ - a_
                o = lib.cylinder(f"wire.{sx_}.{sy_}.{k}", lr, dv.length, gold, axis="y", segments=14)
                ang = math.atan2(dv.z, abs(dv.y)) * sy_
                lib.transform(o, Matrix.Translation((a_ + b_) / 2) @ lib.rot("x", ang))
            lib.lathe(f"wire.knee.{sx_}.{sy_}", [(0, -lr), (lr * 0.7, -lr * 0.7), (lr, 0), (lr * 0.7, lr * 0.7), (0, lr)], gold, segments=14, axis="z", center=tuple(p1), cap=False)
            lib.cylinder(f"boss.{sx_}.{sy_}", 0.0011, 2 * lr + 0.0002, gold, axis="x", center=tuple(p2), segments=18, bevel=0.0002)
            # screw head flush with the boss face, its slot a hair proud
            hx = sx_ * (xc + lr + 0.0001)
            lib.cylinder(f"screw.{sx_}.{sy_}", 0.0006, 0.00004, gold, axis="x", center=(hx + sx_ * 0.00002, p2.y, p2.z), segments=16)
            lib.box(f"slot.{sx_}.{sy_}", (0.00003, 0.0011, 0.00014), ink, center=(hx + sx_ * 0.00005, p2.y, p2.z))
    for sign in (1, -1):
        y0 = R - 0.0012
        path = strap_path(sign, y0, 0.0, 0.0072, 36.0)
        strap(f"strap.{sign}", path, 0.03, W - 0.0004, W - 0.0019, 0.0028, leather, stitch_mat=leather, flat=0.0072)


BUILDERS = {
    "watch_pobeda_gold": pobeda,
    "watch_vostok_komandirskie": vostok,
    "watch_rolland_abyssal": rolland,
    "watch_poljot_strela": poljot,
    "watch_omeca_aquastar": omeca,
    "watch_brequet_classique": brequet,
}


def build(it: lib.Item) -> None:
    it.ao_size = 1024
    fn = BUILDERS.get(it.id)
    if fn is None:
        # an unknown watch def: the Pobeda layout in the def's colour
        fn = pobeda
    fn(it)
    # Lettering is very thin relief: smooth normals across its cap and walls would tilt
    # the caps and render them dark, so text meshes get hard edges.
    for o in lib.mesh_objects():
        if o.name.endswith(".mesh"):
            lib.auto_smooth(o, 30)
