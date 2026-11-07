"""
Box-kind items, M6 items wave C: the sports category (skates, a stick, a signed puck
and football, a goalie mask, boxing gloves, a chess clock, a marathon medal, a
spinning reel, a stopwatch) and the electronics and camera top-up (a tablet, an
e-reader, a car navigator, a transistor radio, headphones, a portable speaker, a
twin-lens reflex and a DSLR body).

box.py's `build` falls back to BUILDERS here, so the placeholder stays `box` and
the conventions are box.py's: `model.size` [w, h, d] centred on the origin, front
+Z, `rest = "upright"` stands on −Y. Most of these are not boxes, so besides
box.py's and phone.py's helpers there are a few for round things: a parametric
grid surface, a swept profile (tubes, bands, straps), an ellipsoid and a frame on
any surface normal.

Signatures and other hand-drawn squiggles use a seeded `random.Random`, so a
rebuild is identical.
"""

from __future__ import annotations

import math
import random

import bmesh
import lib
from kinds import box as B
from kinds import phone as P
from mathutils import Matrix, Vector

F, slab, rr, rr_shape, pill, circle, circle_shape = P.F, P.slab, P.rr, P.rr_shape, P.pill, P.circle, P.circle_shape
pocket, cut, disc, holes, crosshead = P.pocket, P.cut, P.disc, P.holes, P.crosshead
txt, arc_on, plate, knob, cab, sticker, screws_on, material_get = B.txt, B.arc_on, B.plate, B.knob, B.cab, B.sticker, B.screws_on, B.material_get


def poly_on(m, pts, depth, mat, *, z=0.0, bevel=0.0):
    return B.poly_on(m, pts, depth, mat, z=z, bevel=bevel)


def line_on(m, pts, width, depth, mat, *, z=0.0, closed=False):
    return B.line_on(m, pts, width, depth, mat, z=z, closed=closed)


# ---------------------------------------------------------------------------
# Helpers


def uvn(o, u, v, n) -> Matrix:
    """A frame from its axes: local x = u, y = v, z = n (outward), origin o."""
    return Matrix(((u[0], v[0], n[0], o[0]), (u[1], v[1], n[1], o[1]), (u[2], v[2], n[2], o[2]), (0, 0, 0, 1)))


def frame(o, n, up=(0, 1, 0)) -> Matrix:
    """A frame at o with local +Z along n and local +Y as close to `up` as it can be."""
    n = Vector(n).normalized()
    up = Vector(up).normalized()
    if abs(n.dot(up)) > 0.999:
        up = Vector((0, 0, 1)) if abs(n.z) < 0.9 else Vector((0, 1, 0))
    x = up.cross(n).normalized()
    return uvn(o, x, n.cross(x), n)


def ccw(pts):
    pts = list(pts)
    a = sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1] for i in range(len(pts)))
    return pts if a > 0 else pts[::-1]


def outline(pts):
    """A slab shape from a fixed outline: each ring's inset moves its edges inwards."""
    pts = ccw(pts)
    return lambda inset: pts if inset <= 0 else lib._offset_loop(pts, inset)


def _obj(name, bm, mats, smooth=40):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = lib.mesh_object(P._name(name), bm, mats[0])
    for mt in mats[1:]:
        o.data.materials.append(mt)
    lib.auto_smooth(o, smooth)
    return o


def clip(a, b, hx, hy):
    """Clip segment a-b to the rectangle |x| <= hx, |y| <= hy (Liang-Barsky); None if outside."""
    t0, t1 = 0.0, 1.0
    dx, dy = b[0] - a[0], b[1] - a[1]
    for p, q in ((-dx, a[0] + hx), (dx, hx - a[0]), (-dy, a[1] + hy), (dy, hy - a[1])):
        if p == 0:
            if q < 0:
                return None
            continue
        t = q / p
        if p < 0:
            t0 = max(t0, t)
        else:
            t1 = min(t1, t)
    if t0 >= t1:
        return None
    return [(a[0] + dx * t0, a[1] + dy * t0), (a[0] + dx * t1, a[1] + dy * t1)]


def sweep(pts, shape, mat, *, closed=False, up=(0, 0, 1), smooth=40, name="sweep"):
    """Sweep a 2D cross-section (x along the binormal, y along the normal, which starts
    as `up` and is carried along the path) through 3D points; capped unless closed."""
    pts = [Vector(p) for p in pts]
    n = len(pts)
    bm = bmesh.new()
    rings = []
    prev = Vector(up)
    for i, p in enumerate(pts):
        a, b = (pts[i - 1], pts[(i + 1) % n]) if closed else (pts[max(i - 1, 0)], pts[min(i + 1, n - 1)])
        t = (b - a).normalized()
        nr = prev - t * prev.dot(t)
        if nr.length < 1e-9:
            nr = t.orthogonal()
        nr.normalize()
        prev = nr
        bi = t.cross(nr)
        rings.append([bm.verts.new(p + bi * x + nr * y) for x, y in shape])
    k = len(shape)
    pairs = list(zip(rings, rings[1:])) + ([(rings[-1], rings[0])] if closed else [])
    for ra, rb in pairs:
        for i in range(k):
            j = (i + 1) % k
            bm.faces.new((ra[i], ra[j], rb[j], rb[i]))
    if not closed:
        bm.faces.new(rings[0])
        bm.faces.new(rings[-1][::-1])
    return _obj(name, bm, [mat], smooth)


def tube(pts, r, mat, *, n=8, closed=False, name="tube"):
    return sweep(pts, circle(r, n), mat, closed=closed, name=name)


def ellipsoid(c, radii, mat, *, m=None, seg=32, rings=16, name="ell"):
    prof = [(math.sin(math.pi * k / rings), -math.cos(math.pi * k / rings)) for k in range(rings + 1)]
    o = lib.lathe(P._name(name), prof, mat, segments=seg, axis="y", cap=False)
    lib.transform(o, lib.at(*c) @ (m or Matrix.Identity(4)) @ Matrix.Diagonal((radii[0], radii[1], radii[2], 1)))
    lib.auto_smooth(o, 60)
    return o


def lathe(prof, mat, *, axis="z", center=(0, 0, 0), seg=48, smooth=40, name="lathe"):
    o = lib.lathe(P._name(name), prof, mat, segments=seg, axis=axis, center=center, cap=False)
    lib.auto_smooth(o, smooth)
    return o


def signature(rng: random.Random, length: float, height: float):
    """A scrawled autograph: a run of loops along x with a flourish underneath."""
    pts = []
    n = rng.randint(18, 28)
    ph = rng.uniform(0, math.pi)
    freq = rng.uniform(3.0, 5.0)
    for k in range(n):
        t = k / (n - 1)
        a = 2 * math.pi * freq * t + ph
        pts.append((-length / 2 + length * t + 0.25 * height * math.cos(a), height * (0.5 * math.sin(a) + rng.uniform(-0.12, 0.12) + 0.25 * (1 - t))))
    tail = [(length * (0.5 - 0.9 * t), -height * (0.55 + 0.15 * math.sin(math.pi * t))) for t in (0.0, 0.3, 0.6, 0.9)]
    return pts, tail


def scrawl(m, rng, length, height, width, depth, mat, *, z=0.0):
    a, b = signature(rng, length, height)
    line_on(m, a, width, depth, mat, z=z)
    line_on(m, b, width * 0.8, depth, mat, z=z)


# ---------------------------------------------------------------------------
# Skates


HOCKEY_BOOT = [(-0.118, -0.062), (0.118, -0.062), (0.134, -0.052), (0.14, -0.034), (0.132, -0.016), (0.104, -0.002), (0.068, 0.016), (0.042, 0.05), (0.026, 0.09),
               (0.016, 0.114), (-0.03, 0.118), (-0.082, 0.121), (-0.112, 0.112), (-0.118, 0.088), (-0.13, 0.04), (-0.136, -0.01), (-0.132, -0.046)]
HOCKEY_TONGUE = [(-0.004, 0.06), (0.036, 0.046), (0.054, 0.072), (0.054, 0.108), (0.04, 0.124), (0.004, 0.124), (-0.008, 0.1)]
FIGURE_BOOT = [(-0.118, -0.074), (-0.06, -0.08), (0.04, -0.094), (0.11, -0.096), (0.126, -0.088), (0.13, -0.07), (0.118, -0.052), (0.08, -0.034), (0.05, -0.002), (0.034, 0.05),
               (0.03, 0.1), (0.032, 0.13), (-0.03, 0.134), (-0.086, 0.13), (-0.1, 0.1), (-0.104, 0.05), (-0.116, 0.0), (-0.124, -0.04)]


def boot_rings(zc, hw, mat, edge=None):
    e = edge or mat
    return [(0.010, zc - hw, e), (0.0035, zc - hw + 0.004, e), (0, zc - hw + 0.011, mat), (0, zc + hw - 0.011, mat), (0.0035, zc + hw - 0.004, e), (0.010, zc + hw, e)]


def edge_x(poly, y):
    """The front-most x where the outline crosses height y (the instep, for the laces)."""
    xs = []
    for (x0, y0), (x1, y1) in zip(poly, poly[1:] + poly[:1]):
        if (y0 - y) * (y1 - y) <= 0 and y0 != y1:
            xs.append(x0 + (x1 - x0) * (y - y0) / (y1 - y0))
    return max(xs)


def eyelets(zc, hw, poly, ys, lace, *, cross=True):
    """Laces across the instep at heights ys, criss-crossed, sitting on the boot's front edge."""
    prev = None
    for y in ys:
        x = edge_x(poly, y) + 0.0008
        a = Vector((x, y, zc - hw * 0.55))
        b = Vector((x, y, zc + hw * 0.55))
        tube([a, b], 0.0018, lace, n=6)
        if prev is not None and cross:
            tube([prev[0], b], 0.0015, lace, n=6)
            tube([prev[1], a], 0.0015, lace, n=6)
        prev = (a, b)


def hockey_skate(it, M, zc, side):
    boot = lib.material(it, "boot", it.color, rough=0.45)
    trim = material_get(M, "trim", "#b8222a", rough=0.5)
    felt = material_get(M, "felt", "#3b3d44", rough=0.9)
    holder = material_get(M, "holder", "#e9e9e6", rough=0.35)
    hw = 0.047
    slab(outline(HOCKEY_BOOT), boot_rings(zc, hw, boot), cap_lo=boot, cap_hi=boot, m=Matrix.Identity(4), name="boot")
    # toe cap and the heel counter in a second, harder shell
    toe = [(0.064, -0.064), (0.12, -0.064), (0.138, -0.05), (0.143, -0.034), (0.134, -0.014), (0.104, 0.002), (0.074, 0.006)]
    slab(outline(toe), boot_rings(zc, hw + 0.0015, trim), cap_lo=trim, cap_hi=trim, name="toe")
    slab(outline(HOCKEY_TONGUE), [(0.006, zc - 0.03, felt), (0, zc - 0.026, felt), (0, zc + 0.026, felt), (0.006, zc + 0.03, felt)], cap_lo=felt, cap_hi=felt, name="tongue")
    eyelets(zc, hw, HOCKEY_BOOT, [0.004 + 0.016 * k for k in range(6)], material_get(M, "lace", "#efefe8", rough=0.8))
    # holder: one moulded piece with two towers, the runner in its slot
    hold = [(-0.115, -0.058), (0.112, -0.058), (0.122, -0.07), (0.106, -0.106), (0.03, -0.106), (0.0, -0.088), (-0.03, -0.106), (-0.104, -0.106), (-0.124, -0.074)]
    slab(outline(hold), [(0.003, zc - 0.013, holder), (0, zc - 0.011, holder), (0, zc + 0.011, holder), (0.003, zc + 0.013, holder)], cap_lo=holder, cap_hi=holder, name="holder")
    run = [(x, -0.125 + 0.006 * (x / 0.13) ** 2) for x in [0.13 - 0.026 * k for k in range(11)]] + [(-0.128, -0.1), (0.128, -0.1)]
    slab(outline(run), [(0, zc - 0.0016, M["steel"]), (0, zc + 0.0016, M["steel"])], cap_lo=M["steel"], cap_hi=M["steel"], name="runner")
    # print on the outer side: brand, model, size
    out_z = zc + side * hw
    fm = F("front" if side > 0 else "back", (0, 0, out_z))
    sx = 1 if side > 0 else -1  # the back frame mirrors x
    txt(fm, "LEDOKOL", 0.022, M["ink"], x=sx * -0.04, y=0.04, bold=0.6, spacing=1.05)
    txt(fm, "VECTOR 70", 0.009, trim, x=sx * -0.04, y=0.02, bold=0.4)
    txt(F("front" if side > 0 else "back", (0, 0, zc + side * 0.013)), "LEDOKOL  TUUK-LS", 0.006, M["black_ink"], x=sx * -0.02, y=-0.07)
    for x in (-0.1, -0.06, -0.02, 0.02, 0.06, 0.1):
        disc(F("front" if side > 0 else "back", (x if side > 0 else -x, -0.064, out_z - side * 0.004)), 0.002, -0.0004, 0.0004, M["chrome"], n=10)


def figure_skate(it, M, zc, side):
    boot = lib.material(it, "boot", it.color, rough=0.3)
    sole = material_get(M, "sole", "#5a3a22", rough=0.55)
    heel_m = material_get(M, "heel", "#3b2a1c", rough=0.5)
    hw = 0.044
    slab(outline(FIGURE_BOOT), boot_rings(zc, hw, boot), cap_lo=boot, cap_hi=boot, name="boot")
    # leather sole and the stacked heel
    sol = [(-0.12, -0.072), (0.11, -0.096), (0.126, -0.09), (0.13, -0.1), (0.11, -0.104), (0.04, -0.102), (-0.06, -0.088), (-0.12, -0.082)]
    slab(outline(sol), [(0.002, zc - hw + 0.004, sole), (0, zc - hw + 0.006, sole), (0, zc + hw - 0.006, sole), (0.002, zc + hw - 0.004, sole)], cap_lo=sole, cap_hi=sole, name="sole")
    heel = [(-0.122, -0.078), (-0.064, -0.084), (-0.066, -0.104), (-0.118, -0.104)]
    slab(outline(heel), [(0.002, zc - 0.03, heel_m), (0, zc - 0.028, heel_m), (0, zc + 0.028, heel_m), (0.002, zc + 0.03, heel_m)], cap_lo=heel_m, cap_hi=heel_m, name="heel")
    eyelets(zc, hw, FIGURE_BOOT, [-0.03 + 0.02 * k for k in range(6)], material_get(M, "lace", "#f4f2ec", rough=0.8))
    for k in range(4):  # speed hooks up the ankle
        for s in (-1, 1):
            disc(frame((0.034 - 0.001 * k, 0.07 + 0.016 * k, zc + s * hw * 0.55), (1, 0, 0)), 0.0022, -0.001, 0.0025, M["chrome"], n=10)
    # blade: sole and heel plates, two stanchions, the rocker, the toe pick
    blade = [(-0.124, -0.104), (-0.06, -0.104), (-0.05, -0.112), (0.02, -0.114), (0.04, -0.102), (0.118, -0.104), (0.126, -0.108), (0.13, -0.116), (0.124, -0.12), (0.129, -0.124),
             (0.122, -0.127), (0.118, -0.131), (0.1, -0.134)]
    blade += [(x, -0.135 + 0.005 * ((x - 0.0) / 0.12) ** 2) for x in [0.09 - 0.02 * k for k in range(10)]]
    blade += [(-0.122, -0.128), (-0.128, -0.118)]
    slab(outline(blade), [(0, zc - 0.002, M["chrome"]), (0, zc + 0.002, M["chrome"])], cap_lo=M["chrome"], cap_hi=M["chrome"], name="blade")
    out_z = zc + side * hw
    fm = F("front" if side > 0 else "back", (0, 0, out_z))
    sx = 1 if side > 0 else -1
    txt(fm, "Снегурка", 0.012, material_get(M, "gold_ink", "#b8913d", metal=0.9, rough=0.3), x=sx * -0.045, y=0.0, bold=0.4)
    txt(F("front" if side > 0 else "back", (0, 0, zc + side * 0.002)), "СНЕГУРКА  № 36", 0.0045, M["black_ink"], x=sx * 0.0, y=-0.108)


def skates_hockey(it):
    M = B.setup(it)
    for zc, side in ((0.057, 1), (-0.057, -1)):
        hockey_skate(it, M, zc, side)


def skates_figure(it):
    M = B.setup(it)
    for zc, side in ((0.052, 1), (-0.052, -1)):
        figure_skate(it, M, zc, side)


# ---------------------------------------------------------------------------
# Stick, puck, football, mask, gloves


def stick(it):
    M = B.setup(it)
    shaft_m = lib.material(it, "shaft", it.color, rough=0.25)
    graphic = material_get(M, "graphic", "#d7262e", rough=0.3)
    tape = material_get(M, "tape", "#f1efe8", rough=0.95)
    grip = material_get(M, "grip", "#2a2a2c", rough=0.95)
    p0, p1 = Vector((-0.47, -0.022, 0)), Vector((0.705, 0.042, 0))
    d = (p1 - p0).normalized()
    L = (p1 - p0).length
    u, v = Vector((0, 0, 1)), d.cross(Vector((0, 0, 1)))
    sm = uvn(p0, u, v, d)
    shape = lambda i: rr(0.022 - 2 * i, 0.028 - 2 * i, max(0.004 - i, 0.0005), 4)
    slab(shape, [(0.003, 0.0, shaft_m), (0, 0.004, shaft_m), (0, L - 0.24, shaft_m), (0, L - 0.236, grip), (0, L - 0.004, grip), (0.002, L, grip)], cap_lo=shaft_m, cap_hi=grip, m=sm, name="shaft")
    # butt end cap
    disc(sm @ lib.at(0, 0, L), 0.0105, -0.002, 0.0, M["rubber"], n=20)
    # graphics on both faces, reading along the shaft
    for s in (1, -1):
        fn = Vector((0, 0, s))
        fu = d * s
        fv = fn.cross(fu)
        for k, (word, size, mat, off) in enumerate((("LEDOKOL", 0.016, M["ink"], 0.55), ("STRELA", 0.012, graphic, 0.75), ("FLEX 85   GRIP   P92   L", 0.005, M["ink"], 0.37))):
            o = p0 + d * (L * off) + Vector((0, 0, s * 0.011))
            txt(uvn(o, fu, fv, fn), word, size, mat, bold=0.6 if k < 2 else 0.0, spacing=1.1)
        for k in range(3):
            o = p0 + d * (L * 0.25 + k * 0.02) + Vector((0, 0, s * 0.011))
            poly_on(uvn(o, fu, fv, fn), [(-0.004, -0.014), (0.004, -0.014), (0.012, 0.014), (0.004, 0.014)], 0.0002, graphic)
    # blade: a curved slab taped white, with its heel under the shaft
    hx = -0.452
    bl = [(hx + 0.012, 0.004), (hx + 0.016, -0.03), (hx + 0.004, -0.062), (-0.66, -0.065), (-0.693, -0.058), (-0.708, -0.04), (-0.7, -0.022), (-0.672, -0.012), (-0.6, -0.01), (hx - 0.02, -0.004)]
    o = slab(outline(bl), [(0.0012, -0.0042, tape), (0, -0.003, tape), (0, 0.003, tape), (0.0012, 0.0042, tape)], cap_lo=tape, cap_hi=tape, name="blade")
    for vt in o.data.vertices:
        if vt.co.x < hx:
            vt.co.z += 0.009 * ((hx - vt.co.x) / 0.256) ** 2
    o.data.update()
    # tape turns: dark lines across the blade, following the curve
    for k in range(13):
        x = hx - 0.012 - 0.018 * k
        zc = 0.009 * ((hx - x) / 0.256) ** 2
        for s in (1, -1):
            line_on(uvn((x, 0, zc + s * 0.0042), (s, 0, 0), (0, 1, 0), (0, 0, s)), [(-0.003 * s, -0.062), (0.003 * s, -0.008)], 0.0008, 0.0002, M["black_ink"])


def puck(it):
    M = B.setup(it)
    rubber = lib.material(it, "puck", it.color, rough=0.75)
    silver = material_get(M, "silver", "#d9dadc", metal=0.6, rough=0.35)
    r, h = 0.0372, 0.0127
    lathe([(0, -h), (r - 0.0012, -h), (r, -h + 0.0012), (r, h - 0.0012), (r - 0.0012, h), (0, h)], rubber, seg=72, smooth=50)
    # knurled band round the edge
    for k in range(72):
        t = 2 * math.pi * k / 72
        rb = lib.box(P._name("knurl"), (0.0008, 0.0012, 0.013), rubber)
        lib.transform(rb, lib.rot("z", t) @ lib.at(r + 0.0002, 0, 0))
    top = F("front", (0, 0, h))
    # printed crest: a ring, an oar crossed with a hockey stick, the club name round it
    line_on(top, circle(0.03, 48), 0.0012, 0.00004, M["ink"], closed=True)
    arc_on(top, "БУРЛАКИ  МОСТОГРАД", 0.025, 0.0042, M["ink"], start=math.pi / 2)
    arc_on(top, "ЧЕМПИОН 1994", 0.025, 0.0036, M["ink"], start=-math.pi / 2, inward=True)
    line_on(top, [(-0.011, -0.011), (0.011, 0.011)], 0.0018, 0.00004, M["ink"])
    poly_on(top, [(0.009, 0.007), (0.015, 0.013), (0.013, 0.015), (0.007, 0.009)], 0.00004, M["ink"])
    line_on(top, [(0.011, -0.011), (-0.009, 0.009)], 0.0016, 0.00004, M["ink"])
    poly_on(top, [(-0.009, 0.009), (-0.016, 0.009), (-0.016, 0.006), (-0.008, 0.006)], 0.00004, M["ink"])
    # the champions' signatures in silver marker, across the crest
    rng = random.Random(1994)
    for k in range(6):
        y = 0.013 - k * 0.005
        m = top @ lib.at(rng.uniform(-0.004, 0.004), y, 0) @ lib.rot("z", rng.uniform(-0.25, 0.25))
        scrawl(m, rng, rng.uniform(0.022, 0.032), 0.0028, 0.0005, 0.00006, silver, z=0.00004)
    bot = F("back", (0, 0, -h))
    arc_on(bot, "LEDOKOL  OFFICIAL GAME PUCK", 0.027, 0.0034, M["ink"], start=math.pi / 2)
    txt(bot, "LEDOKOL", 0.008, M["ink"], bold=0.6)
    txt(bot, "MOSTOGRAD", 0.0035, M["ink"], y=-0.008)


def ti_faces():
    """Truncated icosahedron from the icosahedron: (centre, edge a, edge b, is_pentagon) fan triangles."""
    g = (1 + 5 ** 0.5) / 2
    V = [Vector(p).normalized() for p in ((-1, g, 0), (1, g, 0), (-1, -g, 0), (1, -g, 0), (0, -1, g), (0, 1, g), (0, -1, -g), (0, 1, -g), (g, 0, -1), (g, 0, 1), (-g, 0, -1), (-g, 0, 1))]
    Fc = [(0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11), (1, 5, 9), (5, 11, 4), (11, 10, 2), (10, 7, 6), (7, 1, 8),
          (3, 9, 4), (3, 4, 2), (3, 2, 6), (3, 6, 8), (3, 8, 9), (4, 9, 5), (2, 4, 11), (6, 2, 10), (8, 6, 7), (9, 8, 1)]

    def p(a, b):
        return V[a] + (V[b] - V[a]) / 3

    fans = []
    for a, b, c in Fc:
        cen = (V[a] + V[b] + V[c]) / 3
        ring = [p(a, b), p(b, a), p(b, c), p(c, b), p(c, a), p(a, c)]
        for i in range(6):
            fans.append((cen, ring[i], ring[(i + 1) % 6], False))
        for v, x, y in ((a, b, c), (b, c, a), (c, a, b)):
            fans.append((V[v], p(v, y), p(v, x), True))
    return fans


def football(it):
    M = B.setup(it)
    white = lib.material(it, "leather", it.color, rough=0.45)
    dark = material_get(M, "panel", "#16181c", rough=0.45)
    marker = material_get(M, "marker", "#1d2a6b", rough=0.6, ao=False)
    R = 0.11
    n = 5
    bm = bmesh.new()
    for cen, a, b, pent in ti_faces():
        grid = {}
        for i in range(n + 1):
            for j in range(i + 1):
                q = cen + (a - cen) * (i / n) + (b - a) * (j / n) if i else cen
                rr_ = R * (1 - 0.011 * (i / n) ** 5)
                grid[i, j] = bm.verts.new(q.normalized() * rr_)
        for i in range(n):
            for j in range(i + 1):
                f = bm.faces.new((grid[i, j], grid[i + 1, j], grid[i + 1, j + 1]))
                f.material_index = 1 if pent else 0
                if j < i:
                    f = bm.faces.new((grid[i, j], grid[i + 1, j + 1], grid[i, j + 1]))
                    f.material_index = 1 if pent else 0
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    _obj("ball", bm, [white, dark], smooth=50)
    # valve
    vn = Vector((-1, 0, 1)).normalized()
    vm = frame(vn * R * 0.996, vn)
    disc(vm, 0.0035, -0.001, 0.0006, M["rubber"], n=16)
    disc(vm, 0.0012, 0.0006, 0.0007, M["dark"], n=10)
    # print: club name and the cup line, then the squad's signatures in blue marker
    for nrm, word, size, up in (((0.35, -0.55, 0.76), "RECHNIK", 0.011, (0, 1, 0)), ((0.35, -0.67, 0.65), "КУБОК МОСТОГРАДА 2008", 0.0045, (0, 1, 0))):
        nv = Vector(nrm).normalized()
        txt(frame(nv * (R - 0.0012), nv, up), word, size, M["black_ink"], depth=0.0016, bold=0.6)
    rng = random.Random(2008)
    for k in range(14):
        th = rng.uniform(-0.9, 0.9)
        ph = 0.15 + rng.uniform(-0.5, 0.75)
        nv = Vector((math.sin(th) * math.cos(ph), math.sin(ph), math.cos(th) * math.cos(ph))).normalized()
        if k == 0:
            nv = Vector((0, 0.05, 0.098)).normalized()
        m = frame(nv * R, nv) @ lib.rot("z", rng.uniform(-0.5, 0.5))
        scrawl(m, rng, rng.uniform(0.024, 0.036), 0.004, 0.0008, 0.0016, marker, z=-0.0012)


def mask(it):
    M = B.setup(it)
    shell = lib.material(it, "shell", it.color, rough=0.2)
    blue = material_get(M, "paint_blue", "#1f3d8f", rough=0.2)
    red = material_get(M, "paint_red", "#c4262c", rough=0.2)
    pad = material_get(M, "pad", "#202124", rough=0.95)
    trim = material_get(M, "trim", "#141414", rough=0.7)
    wire = material_get(M, "wire", "#e8e8e4", metal=0.3, rough=0.35)
    C = Vector((0, -0.005, -0.02))
    A, Bh, Cz = 0.105, 0.145, 0.125
    nf, npsi = 60, 42
    fm, p0, p1 = math.radians(118), math.radians(-62), math.radians(90)

    def pos(i, j, s):
        f = -fm + 2 * fm * i / nf
        q = p0 + (p1 - p0) * j / npsi
        return C + Vector(((A - s) * math.cos(q) * math.sin(f), (Bh - s) * math.sin(q), (Cz - s) * math.cos(q) * math.cos(f)))

    def keep(i, j):
        if not (0 <= i < nf and 0 <= j < npsi):
            return False
        c = pos(i + 0.5, j + 0.5, 0)
        return not (abs(c.x) < 0.052 and -0.088 < c.y < 0.038 and c.z > 0)

    def paint(i, j):
        c = pos(i + 0.5, j + 0.5, 0)
        f = -fm + 2 * fm * (i + 0.5) / nf
        if c.y > 0.07 + 0.014 * math.sin(f * 7):
            return 1
        if abs(c.x) > 0.055 and math.sin(f * 5 + (c.y / 0.05) * 2.4) > 0.55 and c.y < 0.05:
            return 2
        return 0

    bm = bmesh.new()
    vo = {(i, j): bm.verts.new(pos(i, j, 0)) for i in range(nf + 1) for j in range(npsi + 1)}
    vi = {(i, j): bm.verts.new(pos(i, j, 0.005)) for i in range(nf + 1) for j in range(npsi + 1)}
    for i in range(nf):
        for j in range(npsi):
            if not keep(i, j):
                continue
            f = bm.faces.new((vo[i, j], vo[i + 1, j], vo[i + 1, j + 1], vo[i, j + 1]))
            f.material_index = paint(i, j)
            f = bm.faces.new((vi[i, j], vi[i, j + 1], vi[i + 1, j + 1], vi[i + 1, j]))
            f.material_index = 3
            for (di, dj), (a, b) in (((0, -1), ((i, j), (i + 1, j))), ((1, 0), ((i + 1, j), (i + 1, j + 1))), ((0, 1), ((i + 1, j + 1), (i, j + 1))), ((-1, 0), ((i, j + 1), (i, j)))):
                if not keep(i + di, j + dj):
                    try:
                        f = bm.faces.new((vo[a], vi[a], vi[b], vo[b]))
                        f.material_index = 4
                    except ValueError:
                        pass
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-7)
    _obj("shell", bm, [shell, blue, red, pad, trim], smooth=45)
    # cage: bars on a bulging ellipsoid in front of the face opening
    Cg, Ag, Bg, Zg = Vector((0, -0.025, -0.02)), 0.085, 0.13, 0.1415

    def cz(x, y):
        k = 1 - (x / Ag) ** 2 - ((y - Cg.y) / Bg) ** 2
        return Cg.z + Zg * math.sqrt(max(k, 0.0))

    for x in (-0.036, -0.012, 0.012, 0.036):
        tube([(x, y, cz(x, y)) for y in [-0.1 + 0.0145 * k for k in range(11)]], 0.0024, wire)
    for y in (-0.075, -0.045, -0.015, 0.012, 0.04):
        xm = 0.062 if y < 0.03 else 0.05
        tube([(x, y, cz(x, y)) for x in [-xm + 2 * xm * k / 12 for k in range(13)]], 0.0024, wire)
    for s in (-1, 1):  # clips holding the cage to the shell
        for y in (-0.045, 0.012):
            ellipsoid((s * 0.062, y, cz(0.062, y) - 0.002), (0.006, 0.008, 0.005), trim, seg=12, rings=8)
    # chin cup and the backplate on its straps
    ellipsoid((0, -0.108, 0.07), (0.03, 0.014, 0.018), trim, seg=16, rings=10)
    bp = F("back", (0, 0.03, -0.099))
    plate(bp, 0.12, 0.085, 0.006, shell, r=0.02, bev=0.002)
    poly_on(bp @ lib.at(0, 0, 0.006), rr(0.1, 0.065, 0.014, 4), 0.0003, blue)
    txt(bp @ lib.at(0, 0, 0.0063), "LEDOKOL", 0.012, M["ink"], bold=0.6)
    for s in (-1, 1):
        for y in (0.06, -0.0):
            sweep([(s * 0.055, y, -0.1), (s * 0.08, y, -0.088), (s * 0.097, y, -0.065)], rr(0.016, 0.002, 0.0008, 2), M["rubber"], up=(0, 1, 0))
    # the painter's signature on the chin
    rng = random.Random(77)
    nv = Vector((0.4, -0.55, 0.73)).normalized()
    scrawl(frame(C + Vector((nv.x * A, nv.y * Bh, nv.z * Cz)) * 0.985, nv), rng, 0.03, 0.004, 0.0007, 0.0014, M["black_ink"], z=-0.0008)
    for y in (0.0, -0.03):  # vent holes either side above the cheek
        for s in (-1, 1):
            nv = Vector((s * 0.85, y / 0.145, 0.5)).normalized()
            disc(frame(C + Vector((nv.x * A, nv.y * Bh, nv.z * Cz)) * 0.99, nv), 0.004, -0.002, 0.0006, trim, n=16)


def glove(it, M, c, rot, scale_z, mirror):
    leather = lib.material(it, "leather", it.color, rough=0.35)
    white = material_get(M, "white", "#efeee8", rough=0.45)
    s = -1 if mirror else 1
    R = lib.rot("z", rot)
    ax = R @ Vector((0, 1, 0))
    side = R @ Vector((1, 0, 0))
    c = Vector(c)
    ellipsoid(c, (0.072, 0.092, 0.045 * scale_z), leather, m=R, seg=36, rings=18)
    th = c + side * (-0.056 * s) + ax * (-0.012) + Vector((0, 0, 0.012 * scale_z))
    ellipsoid(th, (0.024, 0.056, 0.024 * scale_z), leather, m=R @ lib.rot("z", 0.35 * s), seg=24, rings=12)
    wrist = c - ax * 0.098
    ellipsoid(wrist - ax * 0.03, (0.056, 0.07, 0.038 * scale_z), leather, m=R, seg=32, rings=16)
    # white band at the wrist and the strap
    path = [wrist + side * (0.061 * math.cos(t)) + Vector((0, 0, 0.042 * scale_z * math.sin(t))) for t in [2 * math.pi * k / 32 for k in range(32)]]
    sweep(path, rr(0.003, 0.014, 0.001, 2), white, closed=True, up=ax)
    path = [wrist - ax * 0.05 + side * (0.058 * math.cos(t)) + Vector((0, 0, 0.04 * scale_z * math.sin(t))) for t in [2 * math.pi * k / 32 for k in range(32)]]
    sweep(path, rr(0.0035, 0.024, 0.001, 2), material_get(M, "strap", "#1b1b1d", rough=0.8), closed=True, up=ax)
    return c, ax, side


def gloves(it):
    M = B.setup(it)
    glove(it, M, (-0.05, 0.04, -0.034), 0.45, 0.62, True)
    c, ax, side = glove(it, M, (0.05, 0.05, 0.012), -0.45, 1.0, False)
    top = c + Vector((0, 0, 0.045))
    m = uvn(top, side, ax, Vector((0, 0, 1)))
    txt(m, "УДАР", 0.02, material_get(M, "white", "#efeee8"), y=0.012, depth=0.0032, z=-0.0028, bold=0.7)
    txt(m, "12 OZ", 0.008, material_get(M, "white", "#efeee8"), y=-0.008, depth=0.0024, z=-0.0022, bold=0.4)


# ---------------------------------------------------------------------------
# Chess clock, medal, reel, stopwatch


def chess_clock(it):
    M = B.setup(it)
    wood = lib.material(it, "wood", it.color, rough=0.4)
    brass = material_get(M, "brass", "#c8a24a", metal=1.0, rough=0.28)
    face_m = material_get(M, "dial", "#f1ece0", rough=0.6)
    red = material_get(M, "red", "#b3221c", rough=0.5)
    w, h, d = it.size
    yt, zb = h / 2 - 0.016, -0.029
    prof = [(-h / 2, zb), (yt, zb), (yt, 0.012), (-h / 2, d / 2)]
    sh = outline(prof)
    slab(sh, [(0.003, -w / 2, wood), (0, -w / 2 + 0.003, wood), (0, w / 2 - 0.003, wood), (0.003, w / 2, wood)], cap_lo=wood, cap_hi=wood, m=F("px", (0, 0, 0)), name="case")
    vy, vz = yt + h / 2, 0.012 - d / 2
    ln = math.hypot(vy, vz)
    v = Vector((0, vy / ln, vz / ln))
    n = Vector((0, -vz / ln, vy / ln))

    def slant(x, s, lift=0.0):
        o = Vector((x, -h / 2, d / 2)) + v * s + n * lift
        return uvn(o, Vector((1, 0, 0)), v, n)

    for k, x in enumerate((-0.045, 0.045)):
        m = slant(x, 0.05)
        disc(m, 0.034, -0.001, 0.004, brass, n=48, round_top=0.0012)
        disc(m, 0.029, 0.0035, 0.0042, face_m, n=48)
        dm = m @ lib.at(0, 0, 0.0042)
        for t in range(60):
            a = math.pi / 2 - 2 * math.pi * t / 60
            r0 = 0.0245 if t % 5 else 0.0225
            line_on(dm, [(r0 * math.cos(a), r0 * math.sin(a)), (0.0268 * math.cos(a), 0.0268 * math.sin(a))], 0.0007 if t % 5 == 0 else 0.0004, 0.00003, M["black_ink"])
        for num, t in (("12", 0), ("3", 3), ("6", 6), ("9", 9)):
            a = math.pi / 2 - 2 * math.pi * t / 12
            txt(dm, num, 0.0045, M["black_ink"], x=0.018 * math.cos(a), y=0.018 * math.sin(a), depth=0.00003, bold=0.3)
        ha = [math.radians(60 + 25 * k), math.radians(-30 - 40 * k)]
        line_on(dm @ lib.at(0, 0, 0.0002), [(0, 0), (0.013 * math.cos(ha[0]), 0.013 * math.sin(ha[0]))], 0.0016, 0.0003, M["black_ink"])
        line_on(dm @ lib.at(0, 0, 0.0005), [(0, 0), (0.021 * math.cos(ha[1]), 0.021 * math.sin(ha[1]))], 0.0011, 0.0003, M["black_ink"])
        disc(dm, 0.0014, 0.0, 0.001, brass, n=12)
        # the flag hanging at the twelve
        poly_on(dm @ lib.at(0.003, 0.02, 0), [(0, 0), (0.004, -0.002), (0, -0.006)], 0.0005, red)
        disc(m, 0.029, 0.0055, 0.006, M["glass_clear"], n=48)
        txt(slant(x, 0.0075), "ЛАДЬЯ" if k == 0 else "МОСТОГРАД", 0.0055 if k == 0 else 0.004, brass, depth=0.0003, bold=0.5)
    # the two plungers: left pressed down, right up
    for x, up in ((-0.045, 0.004), (0.045, 0.012)):
        tm = F("top", (x, yt, -0.011))
        disc(tm, 0.012, -0.0005, 0.0015, brass, n=32, round_top=0.0005)
        disc(tm, 0.004, 0.0015, up, M["chrome"], n=16)
        disc(tm, 0.0085, up, up + 0.004, M["dark"], n=32, round_top=0.0015)
    # back: two winding keys and two setting knobs, a paper label
    bk = F("back", (0, 0, zb))
    for x in (-0.045, 0.045):
        disc(bk @ lib.at(x, 0.018, 0), 0.006, -0.0005, 0.0015, brass, n=24)
        plate(bk @ lib.at(x, 0.018, 0.0015), 0.016, 0.004, 0.005, brass, r=0.0018, bev=0.0006)
        knob(bk @ lib.at(x, -0.02, 0), 0.0055, 0.006, brass)
    sticker(bk @ lib.at(0, -0.002, 0), 0.04, 0.026, M["paper"], M["black_ink"], ["ЛАДЬЯ", "Часы шахматные", "Завод «Ладья», Мостоград", "№ 30417   Ц. 18 р."], size=0.0022)
    for x in (-0.085, 0.085):
        for z in (-0.025, 0.025):
            disc(F("bottom", (x, -h / 2 + 0.0015, z)), 0.006, -0.0004, 0.0015, material_get(M, "felt", "#2c3a2a", rough=0.95), n=16)


def medal(it):
    M = B.setup(it)
    bronze = lib.material(it, "metal", it.color, metal=1.0, rough=0.32)
    rib_w = material_get(M, "ribbon_w", "#f2f0ea", rough=0.8)
    rib_b = material_get(M, "ribbon_b", "#2c5aa8", rough=0.8)
    cy, R, t = -0.022, 0.025, 0.0024
    lathe([(0, -t + 0.0006), (R - 0.0018, -t + 0.0006), (R - 0.0015, -t), (R, -t + 0.0004), (R, t - 0.0004), (R - 0.0015, t), (R - 0.0018, t - 0.0006), (0, t - 0.0006)], bronze, center=(0, cy, 0), seg=72)
    ob = F("front", (0, cy, t - 0.0006))
    # obverse: a runner over the river, the bridge arches behind, the race name round it
    for k in range(3):
        line_on(ob, [(-0.016 + 0.011 * k + 0.0055 * math.cos(a), -0.006 + 0.0045 * math.sin(a)) for a in [math.pi * i / 10 for i in range(11)]], 0.0007, 0.0004, bronze)
    line_on(ob, [(-0.018, -0.006), (0.018, -0.006)], 0.0008, 0.0004, bronze)
    for k in range(4):
        line_on(ob, [(-0.016 + 0.003 * k, -0.0095 - 0.0016 * k), (0.016 - 0.003 * k, -0.0095 - 0.0016 * k)], 0.0004, 0.0003, bronze)
    run = [((0.002, 0.006), (0.0, -0.0)), ((0.0, -0.0), (-0.004, -0.004)), ((0.0, -0.0), (0.004, -0.0045)), ((0.0015, 0.004), (-0.003, 0.002)), ((0.0015, 0.004), (0.005, 0.0035))]
    for a, b in run:
        line_on(ob @ lib.at(0.004, 0.0, 0), [a, b], 0.0012, 0.0006, bronze)
    disc(ob @ lib.at(0.0067, 0.008, 0), 0.0016, 0.0, 0.0006, bronze, n=14, round_top=0.0003)
    arc_on(ob, "МАРАФОН «БЕЛЫЕ НОЧИ»", 0.0195, 0.0032, bronze, start=math.pi / 2, depth=0.0004)
    txt(ob, "1989", 0.0042, bronze, y=-0.0175, depth=0.0004, bold=0.5)
    rv = F("back", (0, cy, -t + 0.0006))
    line_on(rv, circle(0.0205, 48), 0.0006, 0.0003, bronze, closed=True)
    for k, (s, size) in enumerate((("ФИНИШЁР", 0.0042), ("42 195 м", 0.0034), ("МОСТОСПОРТ", 0.0026))):
        txt(rv, s, size, bronze, y=0.007 - k * 0.007, depth=0.0003, bold=0.4 if k == 0 else 0.0)
    # eye and ring, the ribbon folded through it, the pin bar on top
    tube([(0.0045 * math.cos(a), cy + R + 0.0035 + 0.0045 * math.sin(a), 0) for a in [2 * math.pi * k / 20 for k in range(20)]], 0.0009, bronze, closed=True)
    plate(F("top", (0, cy + R - 0.001, 0)), 0.005, 0.003, 0.0025, bronze, r=0.001)
    rib = [(-0.016, 0.0475), (0.016, 0.0475), (0.016, 0.019), (0.0, 0.0085), (-0.016, 0.019)]
    slab(outline(rib), [(0, -0.0006, rib_w), (0, 0.0006, rib_w)], cap_lo=rib_w, cap_hi=rib_w, name="ribbon")
    for x0 in (-0.016, 0.0085):
        poly_on(F("front", (0, 0, 0.0006)), [(x0, 0.0475), (x0 + 0.0075, 0.0475), (x0 + 0.0075, 0.019 - (0.0075 if x0 < 0 else 0.0)), (x0, 0.019 - (0.0 if x0 < 0 else 0.0075))], 0.00008, rib_b)
    plate(F("front", (0, 0.0475, -0.001)), 0.034, 0.005, 0.002, bronze, r=0.0012, bev=0.0004)


def reel(it):
    M = B.setup(it)
    body = lib.material(it, "body", it.color, metal=0.7, rough=0.35)
    gold = material_get(M, "gold", "#c9a14a", metal=1.0, rough=0.3)
    line = material_get(M, "line", "#2f7f6f", rough=0.5)
    # gearbox housing and its side plate
    ellipsoid((-0.03, -0.004, 0), (0.034, 0.032, 0.022), body, seg=32, rings=16)
    disc(F("front", (-0.03, -0.004, 0.019)), 0.022, -0.002, 0.003, body, n=40, round_top=0.001)
    txt(F("front", (-0.03, -0.004, 0.022)), "KASATKA", 0.0055, gold, y=0.004, bold=0.6)
    txt(F("front", (-0.03, -0.004, 0.022)), "3000", 0.0065, gold, y=-0.005, bold=0.6)
    # rotor cup, spool with line, drag knob, all along +X
    lathe([(0.012, -0.004), (0.026, 0.004), (0.03, 0.012), (0.03, 0.026), (0.025, 0.029), (0, 0.029)], body, axis="x", center=(0, -0.004, 0), seg=48, name="rotor")
    lathe([(0, 0.029), (0.031, 0.029), (0.031, 0.032), (0.0297, 0.033), (0.0297, 0.056), (0.0325, 0.058), (0.0325, 0.061), (0.012, 0.062), (0, 0.062)], gold, axis="x", center=(0, -0.004, 0), seg=48, name="spool")
    lathe([(0.0297, 0.033), (0.0299, 0.0335), (0.0299, 0.0555), (0.0297, 0.056)], line, axis="x", center=(0, -0.004, 0), seg=48, name="line")
    lathe([(0, 0.062), (0.011, 0.062), (0.012, 0.064), (0.012, 0.068), (0.009, 0.0698), (0, 0.0698)], M["dark"], axis="x", center=(0, -0.004, 0), seg=32, name="drag")
    # bail: wire over the spool front, arms back to the rotor
    br = 0.0335
    arc = [(0.067, -0.004 + br * math.cos(a), br * math.sin(a)) for a in [math.radians(-100 + 200 * k / 20) for k in range(21)]]
    tube(arc, 0.0013, M["chrome"])
    for end in (arc[0], arc[-1]):
        tube([end, (0.04, end[1] * 0.98, end[2] * 0.98), (0.014, end[1] * 0.92, end[2] * 0.92)], 0.0016, M["chrome"])
    disc(F("px", (0.016, -0.004 + br * 0.92, 0)), 0.004, -0.002, 0.002, body, n=16)
    # stem and foot
    sweep([(-0.03, 0.024, 0), (-0.028, 0.04, 0), (-0.024, 0.054, 0)], rr(0.008, 0.012, 0.002, 3), body, up=(0, 0, 1))
    foot = cab(0.084, 0.012, -0.003, 0.003, 0.004, body, bev=0.0015, name="foot")
    lib.transform(foot, lib.rot("x", -math.pi / 2) @ lib.at(-0.022, 0, 0))
    lib.transform(foot, lib.at(0, 0.057, 0))
    # handle on the −Z side: shaft, arm, knob
    disc(F("back", (-0.03, -0.004, -0.02)), 0.006, -0.002, 0.007, body, n=20)
    sweep([(-0.03, -0.004, -0.027), (-0.03, -0.04, -0.029)], rr(0.008, 0.004, 0.0015, 3), body, up=(0, 0, 1))
    lathe([(0, -0.029), (0.004, -0.029), (0.0065, -0.031), (0.0072, -0.036), (0.006, -0.0398), (0, -0.0398)], material_get(M, "knob", "#3a2a1c", rough=0.4), axis="z", center=(-0.03, -0.04, 0), seg=24, name="knob")
    disc(F("front", (-0.03, -0.004, 0.022)), 0.005, 0.0, 0.002, M["chrome"], n=16)


def stopwatch(it):
    M = B.setup(it)
    case = lib.material(it, "case", it.color, metal=1.0, rough=0.22)
    dial = material_get(M, "dial", "#f3f1ea", rough=0.55)
    red = material_get(M, "red", "#c0281f", rough=0.4)
    cy = -0.004
    lathe([(0, -0.0078), (0.021, -0.0078), (0.0248, -0.0062), (0.026, -0.003), (0.026, 0.0028), (0.0246, 0.0054), (0.022, 0.006), (0.0215, 0.0045), (0, 0.0045)], case, center=(0, cy, 0), seg=64)
    dm = F("front", (0, cy, 0.0045))
    disc(dm, 0.0216, -0.0002, 0.00005, dial, n=64)
    for t in range(120):
        a = math.pi / 2 - 2 * math.pi * t / 120
        r0 = 0.0175 if t % 10 == 0 else (0.0188 if t % 2 == 0 else 0.0196)
        line_on(dm, [(r0 * math.cos(a), r0 * math.sin(a)), (0.0205 * math.cos(a), 0.0205 * math.sin(a))], 0.00045 if t % 10 == 0 else 0.00025, 0.00003, M["black_ink"], z=0.00005)
    for k in range(12):
        a = math.pi / 2 - 2 * math.pi * k / 12
        txt(dm, str(60 if k == 0 else 5 * k), 0.0026, red if k % 3 == 0 else M["black_ink"], x=0.0145 * math.cos(a), y=0.0145 * math.sin(a), z=0.00005, depth=0.00003, bold=0.3)
    sub = dm @ lib.at(0, 0.0075, 0.00005)
    line_on(sub, circle(0.005, 32), 0.0003, 0.00003, M["black_ink"], closed=True)
    for k in range(30):
        a = math.pi / 2 - 2 * math.pi * k / 30
        line_on(sub, [(0.0042 * math.cos(a), 0.0042 * math.sin(a)), (0.005 * math.cos(a), 0.005 * math.sin(a))], 0.0002, 0.00003, M["black_ink"])
    txt(dm, "СЕКУНДА", 0.0022, M["black_ink"], y=-0.0065, z=0.00005, depth=0.00003, bold=0.5, spacing=1.15)
    txt(dm, "1/5", 0.0016, M["black_ink"], y=-0.0095, z=0.00005, depth=0.00003)
    a = math.radians(40)
    line_on(dm @ lib.at(0, 0, 0.0004), [(-0.004 * math.cos(a), -0.004 * math.sin(a)), (0.019 * math.cos(a), 0.019 * math.sin(a))], 0.0005, 0.0002, red)
    line_on(sub @ lib.at(0, 0, 0.0004), [(0, 0), (0.0042 * math.cos(2.2), 0.0042 * math.sin(2.2))], 0.0004, 0.0002, M["black_ink"])
    disc(dm, 0.0009, 0.0, 0.0008, case, n=12)
    lathe([(0.0215, 0.0045), (0.019, 0.0068), (0.012, 0.0077), (0, 0.0079)], M["glass_clear"], center=(0, cy, 0), seg=64, name="crystal")
    # crown with its stem, and the reset pusher at two o'clock
    lathe([(0, 0.0215), (0.0024, 0.0215), (0.0024, 0.028), (0.0042, 0.0282), (0.0044, 0.0325), (0.0036, 0.0338), (0, 0.034)], case, axis="y", seg=24, name="crown")
    for k in range(16):
        t = 2 * math.pi * k / 16
        rb = lib.box(P._name("knurl"), (0.0006, 0.004, 0.0006), case, center=(0.0044 * math.cos(t), 0.0303, 0.0044 * math.sin(t)))
    pa = math.radians(45)
    pm = frame((0.0255 * math.sin(pa), cy + 0.0255 * math.cos(pa), 0), (math.sin(pa), math.cos(pa), 0), (0, 0, 1))
    disc(pm, 0.0018, -0.001, 0.0032, case, n=16, round_top=0.0006)
    bk = F("back", (0, cy, -0.0078))
    line_on(bk, circle(0.018, 48), 0.0004, 0.00003, M["black_ink"], closed=True)
    for k, (s, size) in enumerate((("СЕКУНДА", 0.0026), ("1/5 СЕК   15 КАМНЕЙ", 0.0016), ("№ 074419", 0.0018))):
        txt(bk, s, size, M["black_ink"], y=0.005 - k * 0.0045, depth=0.00003)


# ---------------------------------------------------------------------------
# Electronics


def pad_air(it):
    w, h, d = it.size
    M = B.setup(it)
    alu = lib.material(it, "alu", it.color, metal=0.85, rough=0.38)
    r = 0.011
    body = slab(rr_shape(w, h, r, 10), [(0.0028, -d / 2, alu), (0.001, -d / 2 + 0.001, alu), (0.0002, -d / 2 + 0.0026, alu), (0, 0.0, alu), (0, d / 2 - 0.0009, alu)], cap_lo=alu, cap_hi=alu, smooth=40)
    front = slab(rr_shape(w, h, r, 10), [(0.0002, d / 2 - 0.0009, M["glass"]), (0.0002, d / 2 - 0.0002, M["glass"]), (0.0005, d / 2, M["glass"])], cap_lo=M["glass"], cap_hi=M["glass"])
    fm = F("front", (0, 0, d / 2))
    cut(front, [pocket(circle_shape(0.0055, 40), 0.0004, M["dark"], fm @ lib.at(0, -h / 2 + 0.0095, 0))])
    disc(fm @ lib.at(0, -h / 2 + 0.0095, 0), 0.005, -0.0004, -0.00008, M["glass"], n=40)
    B.line_on(fm @ lib.at(0, -h / 2 + 0.0095, 0), rr(0.0028, 0.0028, 0.0007, 4), 0.00016, 0.00001, M["ink"], z=-0.00008, closed=True)
    disc(fm @ lib.at(0, h / 2 - 0.0085, 0), 0.001, -0.00002, 0.00002, M["dark"], n=16)
    bm = F("back", (0, 0, -d / 2))
    with B.thick_print():
        P.mangosteen_logo(bm @ lib.at(0, 0.01, 0), M["chrome"], scale=1.8)
    txt(bm, "Pad", 0.007, M["chrome"], y=-0.03, depth=0.00002, bold=0.5)
    txt(bm, "Designed by Mangosteen in Mostograd   32 GB", 0.0017, M["black_ink"], y=-0.088, depth=0.00001)
    txt(bm, "Model MG-1474   Serial DMPL 7RX2 FK10", 0.0017, M["black_ink"], y=-0.092, depth=0.00001)
    P.camera(F("back", (-(w / 2 - 0.0085), h / 2 - 0.0085, -d / 2)), M["chrome"], M["dark"], M["glass"], r=0.0021, proud=0.0002)
    disc(F("back", (-(w / 2 - 0.0165), h / 2 - 0.0085, -d / 2)), 0.0006, -0.00002, 0.00003, M["dark"], n=12)
    for y, ln in ((0.072, 0.02), (0.098, 0.009)):
        slab(lambda i, ln=ln: pill(ln - 2 * i, 0.0024 - 2 * i, 8), [(0, -0.0003, alu), (0, 0.0003, alu), (0.0003, 0.00042, alu)], cap_lo=alu, cap_hi=alu, m=F("px", (w / 2 - 0.0004, y, -0.0004)))
    bt = F("bottom", (0, -h / 2, -0.0004))
    ends = [pocket(lambda i: rr(0.0085, 0.0016, 0.0007, 4), 0.003, M["dark"], bt)]
    for s in (-1, 1):
        ends += holes(bt, [(s * (0.02 + i * 0.0018), 0) for i in range(10)], 0.0005, 0.0015, M["dark"], 10)
    cut(body, ends)
    slab(lambda i: pill(0.0085 - 2 * i, 0.0024 - 2 * i, 8), [(0, -0.0003, M["dark"]), (0, 0.0003, M["dark"])], cap_lo=M["dark"], cap_hi=M["dark"], m=F("top", (w / 2 - 0.028, h / 2 - 0.0004, -0.0004)))


def ereader(it):
    w, h, d = it.size
    M = B.setup(it)
    plastic = lib.material(it, "plastic", it.color, rough=0.75)
    eink = material_get(M, "eink", "#d6d4cb", rough=0.95, ao=False)
    grey = material_get(M, "eink_text", "#56565a", rough=0.9, ao=False)
    r = 0.008
    body = slab(rr_shape(w, h, r, 10), [(0.0022, -d / 2, plastic), (0.0007, -d / 2 + 0.0012, plastic), (0, -d / 2 + 0.003, plastic), (0, d / 2 - 0.0015, plastic), (0.0006, d / 2, plastic)], cap_lo=plastic, cap_hi=plastic, smooth=40)
    sy = 0.01
    fm = F("front", (0, sy, d / 2))
    cut(body, [pocket(lambda i: rr(0.093, 0.124, 0.001, 3), 0.0008, M["dark"], fm)])
    sc = F("front", (0, sy, d / 2 - 0.0008))
    poly_on(sc, rr(0.0925, 0.1235, 0.0008, 3), 0.0001, eink)
    # a page of a novel on the e-ink
    pm = sc @ lib.at(0, 0, 0.0001)
    txt(pm, "Глава седьмая", 0.0042, grey, y=0.05, depth=0.00002, bold=0.4)
    rng = random.Random(7)
    for k in range(17):
        y = 0.041 - k * 0.0052
        L = 0.078 if k not in (5, 11, 16) else rng.uniform(0.03, 0.06)
        x0 = -0.039 + (0.005 if k in (6, 12) else 0)
        x = x0
        while x < -0.039 + L:
            wl = rng.uniform(0.004, 0.012)
            line_on(pm, [(x, y), (min(x + wl, -0.039 + L), y)], 0.0013, 0.00002, grey)
            x += wl + 0.0018
    txt(pm, "143", 0.0026, grey, y=-0.056, depth=0.00002)
    # page-turn bars on both margins, the brand and the home key below
    for s in (-1, 1):
        plate(F("front", (s * 0.0515, -0.02, d / 2)), 0.0026, 0.028, 0.0005, M["dark"], r=0.0012, bev=0.0002)
    txt(F("front", (0, -0.065, d / 2)), "KNIGA", 0.005, M["ink"], bold=0.6, spacing=1.3)
    plate(F("front", (0, -0.074, d / 2)), 0.016, 0.0035, 0.0004, M["dark"], r=0.0017, bev=0.0002)
    # back: quilted soft-touch, the name, a label
    bk = F("back", (0, 0, -d / 2))
    quilt = material_get(M, "quilt", lib.shade(it.color, 0.8), rough=0.8)
    for s in (1, -1):
        for k in range(-30, 31):
            seg = clip((k * 0.008 - s * 0.2, -0.2), (k * 0.008 + s * 0.2, 0.2), w / 2 - 0.007, h / 2 - 0.007)
            if seg:
                line_on(bk, seg, 0.0006, 0.00012, quilt)
    poly_on(bk @ lib.at(0, 0.0, 0), rr(0.05, 0.022, 0.004, 4), 0.0003, plastic, z=0.00012)
    txt(bk @ lib.at(0, 0.004, 0.0004), "KNIGA", 0.0065, M["ink"], bold=0.6, spacing=1.2)
    txt(bk @ lib.at(0, -0.005, 0.0004), "Lumen 6", 0.0038, M["ink"])
    sticker(bk @ lib.at(0, -0.06, 0), 0.04, 0.012, M["paper"], M["black_ink"], ["KNIGA LUMEN 6   KL-612", "S/N KL6 1407 3392"], size=0.0016)
    bt = F("bottom", (0, -h / 2, 0))
    cut(body, [pocket(lambda i: rr(0.0075, 0.0025, 0.0006, 3), 0.003, M["dark"], bt @ lib.at(0.012, 0, 0))])
    slab(lambda i: pill(0.008 - 2 * i, 0.003 - 2 * i, 8), [(0, -0.0003, M["dark"]), (0, 0.0005, M["dark"])], cap_lo=M["dark"], cap_hi=M["dark"], m=bt @ lib.at(-0.015, 0, 0))


def navigator(it):
    w, h, d = it.size
    M = B.setup(it)
    gloss = lib.material(it, "gloss", it.color, rough=0.12)
    matte = material_get(M, "matte", "#232325", rough=0.7)
    r = 0.007
    slab(rr_shape(w, h, r, 10), [(0.004, -d / 2 + 0.006, matte), (0, -d / 2 + 0.009, matte), (0, 0.004, gloss), (0, d / 2 - 0.001, gloss), (0.0006, d / 2, gloss)], cap_lo=matte, cap_hi=gloss, smooth=40)
    # back: the battery hump down to the back face, speaker, mount socket at the bottom
    hump = slab(rr_shape(w - 0.03, h - 0.022, 0.008, 8), [(0.003, -d / 2, matte), (0, -d / 2 + 0.003, matte), (0, -d / 2 + 0.008, matte)], cap_lo=matte, cap_hi=matte, smooth=40, name="hump")
    lib.transform(hump, lib.at(0, 0.004, 0))
    bk = F("back", (0, 0, -d / 2))
    cuts = holes(bk @ lib.at(0.028, 0.012, 0), [(x * 0.0022, y * 0.0022) for x in range(-3, 4) for y in range(-3, 4) if x * x + y * y < 11], 0.0006, 0.001, M["dark"], 8)
    cut(hump, cuts)
    sticker(bk @ lib.at(-0.018, 0.01, 0), 0.045, 0.022, M["paper"], M["black_ink"], ["SEVERIN NAVI 5", "GPS navigator  SN-500", "5 V DC  1 A", "S/N SN5 1311 20457"], size=0.0019)
    cut(hump, [pocket(lambda i: rr(0.022, 0.008, 0.002, 4), 0.004, M["dark"], F("back", (0, -0.012, -d / 2)))])
    # front: glass with the display, logo, power key on top, SD slot on the right edge
    fz = d / 2
    sm = F("front", (-0.004, 0, fz))
    poly_on(sm, rr(0.112, 0.068, 0.002, 4), 0.0002, M["glass"])
    poly_on(sm, rr(0.1, 0.06, 0.0008, 3), 0.00002, material_get(M, "lcd", "#0b1014", rough=0.08, ao=False), z=0.0002)
    txt(F("front", (0.06, 0.02, fz)), "SEVERIN", 0.0032, M["ink"], rot=math.pi / 2, bold=0.5, spacing=1.2)
    txt(F("front", (0.06, -0.022, fz)), "NAVI 5", 0.0028, M["ink"], rot=math.pi / 2)
    plate(F("top", (0.045, h / 2, 0.0)), 0.012, 0.004, 0.0008, matte, r=0.0015, bev=0.0003)
    sd = F("px", (w / 2, 0, 0))
    plate(sd, 0.026, 0.006, 0.0002, M["dark"], r=0.001, bev=0.0001)
    poly_on(sd, rr(0.022, 0.0016, 0.0006, 3), 0.00004, M["black_ink"], z=0.0002)
    disc(F("bottom", (0.03, -h / 2, 0.002)), 0.0016, -0.0004, 0.0002, M["dark"], n=16)
    disc(F("bottom", (-0.03, -h / 2, 0.002)), 0.0016, -0.0004, 0.0002, M["dark"], n=16)


def radio(it):
    w, h, d = it.size
    M = B.setup(it)
    leather = lib.material(it, "leather", it.color, rough=0.75)
    panel = material_get(M, "panel", "#c9c2b0", metal=0.6, rough=0.4)
    cloth = material_get(M, "cloth", "#3a3330", rough=0.95)
    scale_m = material_get(M, "scale", "#efe6c8", rough=0.5, ao=False, emissive="#2a2410")
    W2, H2 = 0.25, 0.162
    cab(W2, H2, -d / 2, d / 2, 0.022, leather, bev=0.006, name="case")
    fz = d / 2
    fm = lambda x, y: F("front", (x, y, fz))
    # front panel: the dial window over the speaker grille
    plate(fm(0, 0), W2 - 0.024, H2 - 0.024, 0.0008, panel, r=0.012, bev=0.0004)
    dw = fm(0, 0.046)
    plate(dw, 0.2, 0.042, 0.0016, M["chrome"], r=0.004, bev=0.0006)
    poly_on(dw @ lib.at(0, 0, 0.0016), rr(0.19, 0.034, 0.003, 4), 0.0002, scale_m)
    sz = 0.0018
    for k, (band, lo, hi) in enumerate((("ДВ", 150, 408), ("СВ", 525, 1605), ("КВ", 5.9, 12.1))):
        y = 0.01 - k * 0.01
        txt(dw @ lib.at(0, 0, sz), band, 0.0042, M["black_ink"], x=-0.088, y=y, depth=0.00002, bold=0.5)
        for t in range(13):
            x = -0.075 + t * 0.0135
            line_on(dw @ lib.at(0, 0, sz), [(x, y - 0.002), (x, y + 0.002)], 0.0004, 0.00002, M["black_ink"])
            if t % 3 == 0:
                val = lo + (hi - lo) * t / 12
                txt(dw @ lib.at(0, 0, sz), f"{val:.0f}" if hi > 20 else f"{val:.1f}", 0.0022, M["black_ink"], x=x, y=y + 0.0038, depth=0.00002)
    line_on(dw @ lib.at(0, 0, sz), [(0.022, -0.016), (0.022, 0.016)], 0.0008, 0.0002, material_get(M, "red", "#c0281f", rough=0.4))
    poly_on(dw @ lib.at(0, 0, sz + 0.0002), rr(0.19, 0.034, 0.003, 4), 0.0003, M["glass_clear"])
    # grille: cloth behind chrome bars, the badge across it
    gm = fm(0, -0.03)
    poly_on(gm, rr(0.2, 0.074, 0.004, 4), 0.0003, cloth, z=0.0008)
    for k in range(9):
        y = -0.032 + k * 0.008
        line_on(gm, [(-0.098, y), (0.098, y)], 0.0018, 0.0012, M["chrome"], z=0.0008)
    bm = fm(-0.06, -0.03)
    plate(bm, 0.075, 0.016, 0.0022, material_get(M, "badge", "#8a1e1c", rough=0.3), r=0.003, bev=0.0006)
    txt(bm, "ПРИБОЙ-209", 0.0075, M["chrome"], z=0.0022, depth=0.0005, bold=0.7)
    txt(fm(0.07, -0.072), "ПРИБОЙ  •  МОСТОГРАД", 0.0028, M["black_ink"], depth=0.00002)
    # knobs on the ends, band keys and the folded antenna on top
    for s, lab in ((1, "НАСТРОЙКА"), (-1, "ГРОМКОСТЬ")):
        km = F("px" if s > 0 else "nx", (s * W2 / 2, 0.02, 0.0))
        knob(km, 0.013, 0.009, material_get(M, "knob", "#2a2420", rough=0.4), skirt=0.0015, ink=M["ink"])
        disc(F("px" if s > 0 else "nx", (s * W2 / 2, -0.05, -0.015)), 0.008, -0.0005, 0.004, M["chrome"], n=20)
    tz = H2 / 2
    for k in range(4):
        plate(F("top", (-0.06 + k * 0.016, tz, 0.012)), 0.012, 0.016, 0.003, material_get(M, "keys", "#e6dfcc", rough=0.4), r=0.0015, bev=0.0005)
    tube([(-0.115, tz + 0.0012, -0.026), (0.1, tz + 0.0012, -0.026)], 0.0022, M["chrome"])
    disc(F("top", (0.104, tz, -0.026)), 0.004, -0.0004, 0.0018, M["chrome"], n=16)
    disc(F("top", (-0.118, tz, -0.026)), 0.0035, -0.0004, 0.0028, M["chrome"], n=16, round_top=0.001)
    # back: the battery door and its catch, a price stamp
    bk = F("back", (0, 0, -d / 2))
    line_on(bk, rr(0.16, 0.09, 0.008, 4), 0.0012, 0.0004, M["dark"], closed=True)
    plate(bk @ lib.at(0, -0.035, 0), 0.03, 0.008, 0.0015, M["chrome"], r=0.002, bev=0.0005)
    sticker(bk @ lib.at(0, 0.015, 0), 0.06, 0.03, M["paper"], M["black_ink"], ["ПРИБОЙ-209", "Радиоприёмник переносной", "Питание 9 В (6 эл. 343)", "Цена 43 руб.   № 209 5512"], size=0.0024)


def headphones(it):
    M = B.setup(it)
    shell = lib.material(it, "shell", it.color, rough=0.15)
    cushion = material_get(M, "cushion", "#1a1a1c", rough=0.8)
    cloth = material_get(M, "cloth", "#2a2a2e", rough=0.95)
    cyc = -0.03
    for s in (1, -1):
        def L(prof, mat, name):
            lathe([(r, s * x) for r, x in prof], mat, axis="x", center=(0, cyc, 0), seg=48, name=name)
        L([(0, 0.0605), (0.024, 0.0605), (0.0255, 0.061)], cloth, "cloth")
        L([(0.0255, 0.061), (0.029, 0.0585), (0.034, 0.0582), (0.0375, 0.0605), (0.039, 0.064), (0.0385, 0.0685)], cushion, "pad")
        L([(0.0385, 0.0685), (0.0392, 0.071), (0.0392, 0.08), (0.0365, 0.0878), (0.029, 0.0928), (0.018, 0.0946), (0, 0.095)], shell, "cup")
        lm = frame((s * 0.0946, cyc, 0), (s, 0, 0))
        disc(lm, 0.012, -0.0008, 0.0002, M["chrome"], n=32)
        txt(lm, "b", 0.016, shell, z=0.0002, depth=0.0004, bold=0.8)
        # yoke from the band down onto the cup
        sweep([(s * 0.0795, 0.012, 0.0), (s * 0.0795, 0.0035, 0.0)], rr(0.012, 0.016, 0.003, 3), M["chrome"], up=(0, 0, 1))
        ellipsoid((s * 0.0795, 0.004, 0), (0.008, 0.005, 0.01), M["chrome"], seg=16, rings=8)
    # band: glossy top, padded underneath, the name printed on it
    R0 = 0.08
    pts = [(R0 * math.cos(a), R0 * math.sin(a) + 0.001, 0) for a in [math.radians(8 + 164 * k / 40) for k in range(41)]]
    sweep(pts, rr(0.007, 0.028, 0.0025, 3), shell, up=(0, 0, 1))
    pts = [(0.0735 * math.cos(a), 0.0735 * math.sin(a) + 0.001, 0) for a in [math.radians(28 + 124 * k / 30) for k in range(31)]]
    sweep(pts, rr(0.006, 0.022, 0.0025, 3), cushion, up=(0, 0, 1))
    tm = F("top", (0, 0.0845, 0))
    txt(tm, "basstone", 0.0055, M["ink"], bold=0.6, spacing=1.1)


def speaker(it):
    w, h, d = it.size
    M = B.setup(it)
    body = lib.material(it, "body", it.color, rough=0.5)
    rub = material_get(M, "end", "#1d1f22", rough=0.85)
    mesh = material_get(M, "mesh", "#2b2e33", metal=0.6, rough=0.55)
    shape = lambda i: rr(h - 2 * i, d - 2 * i, max(0.022 - i, 0.002), 8)
    slab(shape, [(0.006, -w / 2, rub), (0.0022, -w / 2 + 0.002, rub), (0, -w / 2 + 0.006, rub), (0, -w / 2 + 0.014, rub), (0, -w / 2 + 0.0145, body), (0, w / 2 - 0.0145, body),
                 (0, w / 2 - 0.014, rub), (0, w / 2 - 0.006, rub), (0.0022, w / 2 - 0.002, rub), (0.006, w / 2, rub)], cap_lo=rub, cap_hi=rub, m=F("px", (0, 0, 0)), smooth=40, name="body")
    gm = F("front", (0, 0, d / 2))
    poly_on(gm, rr(0.166, 0.034, 0.004, 4), 0.0002, mesh)
    for k in range(-40, 41):
        line_on(gm, [(k * 0.002, -0.016), (k * 0.002, 0.016)], 0.0005, 0.0001, M["dark"], z=0.0002)
    for s in (-1, 1):
        line_on(gm @ lib.at(s * 0.05, 0, 0.0003), circle(0.0145, 40), 0.0008, 0.0001, M["chrome"], closed=True)
    plate(gm, 0.034, 0.009, 0.0008, M["dark"], r=0.002, bev=0.0003)
    txt(gm @ lib.at(0, 0, 0.0008), "TOSAKI", 0.0045, M["chrome"], depth=0.00004, bold=0.6, spacing=1.2)
    # buttons on top: power, volume, pairing
    tm = F("top", (0, h / 2, 0))
    plate(tm, 0.07, 0.012, 0.0008, rub, r=0.005, bev=0.0004)
    for k, lab in enumerate(("⏻", "−", "+", "ʙ")):
        plate(tm @ lib.at(-0.024 + k * 0.016, 0, 0.0008), 0.011, 0.008, 0.0008, rub, r=0.0035, bev=0.0004)
        txt(tm @ lib.at(-0.024 + k * 0.016, 0, 0.0016), lab if k in (1, 2) else ("I" if k == 0 else "B"), 0.004, M["ink"], depth=0.00003, bold=0.5)
    # ports on the back, the rubber foot underneath
    bk = F("back", (0, 0, -d / 2))
    plate(bk @ lib.at(0.05, 0, 0), 0.03, 0.012, 0.0006, rub, r=0.003, bev=0.0002)
    for x in (-0.006, 0.006):
        poly_on(bk @ lib.at(0.05 + x, 0, 0.0006), rr(0.006, 0.0025, 0.0006, 2), 0.00004, M["black_ink"])
    txt(bk @ lib.at(-0.03, 0, 0), "TOSAKI BOOM 2   TB-200   5 V  2 A", 0.0026, M["ink"], depth=0.00003)
    plate(F("bottom", (0, -h / 2, 0)), 0.15, 0.016, 0.0012, rub, r=0.006, bev=0.0005)


# ---------------------------------------------------------------------------
# Cameras


def lyra(it):
    w, h, d = it.size
    M = B.setup(it)
    leather = lib.material(it, "leatherette", it.color, rough=0.85)
    metal = material_get(M, "metal", "#bfc0c2", metal=1.0, rough=0.3)
    by0, by1 = -h / 2, 0.04
    bw = 0.08
    b = cab(bw, by1 - by0, -d / 2, 0.012, 0.004, leather, bev=0.0015, name="body")
    lib.transform(b, lib.at(0, (by0 + by1) / 2, 0))
    # lens board, the two lenses, the shutter dial round the taking lens
    lb = cab(0.07, 0.102, 0.012, 0.022, 0.004, metal, bev=0.0012, name="board")
    lib.transform(lb, lib.at(0, -0.014, 0))
    vm = F("front", (0, 0.016, 0.022))
    tm = F("front", (0, -0.033, 0.022))
    B.lens_barrel(vm, M, 0.0, 0.026, 0.0165, glass_r=0.012, text_ring="ЛИРА  1:3,5  F=75", text_mat=M["ink"], body=M["dark"])
    disc(tm, 0.025, -0.0005, 0.005, metal, n=48)
    for k, lab in enumerate(("B", "1", "2", "5", "10", "25", "50", "100", "250")):
        t = math.pi / 2 + k * 0.42
        txt(tm, lab, 0.0024, M["black_ink"], x=0.0215 * math.cos(t), y=0.0215 * math.sin(t), z=0.005, depth=0.00002)
    B.lens_barrel(tm, M, 0.005, 0.028, 0.0175, glass_r=0.012, text_ring="Т-22  3,5/75  № 6208114", text_mat=M["ink"], body=M["dark"])
    plate(F("front", (0.03, -0.004, 0.022)), 0.008, 0.005, 0.0025, metal, r=0.001)  # shutter lever
    # the folded finder hood on top, its name plate facing the front
    hd = cab(0.074, 0.03, -0.034, 0.012, 0.003, metal, bev=0.001, name="hood")
    lib.transform(hd, lib.at(0, 0.055, 0))
    txt(F("front", (0, 0.055, 0.012)), "ЛИРА-2", 0.0075, M["black_ink"], depth=0.0003, bold=0.7, spacing=1.1)
    for x in (-0.03, 0.03):
        line_on(F("top", (x, 0.07, -0.011)), [(0, -0.02), (0, 0.02)], 0.0012, 0.0004, M["dark"])
    # knobs: focus on the left, film advance on the right; strap lugs
    knob(F("nx", (-bw / 2, -0.02, -0.015)), 0.011, 0.004, metal, ink=M["black_ink"])
    knob(F("px", (bw / 2, -0.01, -0.02)), 0.009, 0.004, metal, ink=M["black_ink"])
    for s in (-1, 1):
        disc(F("px" if s > 0 else "nx", (s * bw / 2, 0.03, -0.02)), 0.0035, -0.0005, 0.0025, metal, n=12)
    # back: the door, the red frame-counter window, a slide
    bk = F("back", (0, -0.015, -d / 2))
    line_on(bk, rr(0.07, 0.095, 0.004, 3), 0.001, 0.0003, M["dark"], closed=True)
    disc(bk @ lib.at(0.015, -0.01, 0), 0.0045, -0.0002, 0.0006, metal, n=20)
    disc(bk @ lib.at(0.015, -0.01, 0), 0.003, 0.0006, 0.0008, material_get(M, "red_glass", "#7a1410", rough=0.08, ao=False), n=20)
    txt(bk @ lib.at(0, 0.02, 0), "ЛИРА", 0.008, leather, depth=0.0004, bold=0.6)
    disc(F("bottom", (0, by0, -0.01)), 0.005, -0.0002, 0.0002, M["steel"], n=20)


def d70(it):
    w, h, d = it.size
    M = B.setup(it)
    body = lib.material(it, "body", it.color, rough=0.6)
    grip_m = material_get(M, "grip", "#141414", rough=0.88)
    lcd = material_get(M, "lcd", "#7d8a72", rough=0.25, ao=False)
    zb0, zb1 = -d / 2, 0.026
    yb0, yb1 = -h / 2, 0.04
    zback = zb0 + 0.007
    b = cab(w - 0.004, yb1 - yb0, zback, zb1, 0.012, body, bev=0.004, name="body")
    lib.transform(b, lib.at(0.002, (yb0 + yb1) / 2, 0))
    slab(lambda i: [(-0.028 + i, 0.0), (0.028 - i, 0.0), (0.017 - i, h / 2 - yb1 - i), (-0.017 + i, h / 2 - yb1 - i)], [(0, -0.05, body), (0, -0.002, body)], cap_lo=body, cap_hi=body, m=F("front", (0, yb1 - 0.002, zb1 - 0.006)), name="hump")
    g = cab(0.036, yb1 - yb0 - 0.004, zb1 - 0.012, d / 2, 0.012, grip_m, bev=0.007, name="grip")
    lib.transform(g, lib.at(-w / 2 + 0.019, (yb0 + yb1) / 2 - 0.002, 0))
    # mount: the throat, the mirror inside, the chrome bayonet ring and its contacts
    mc = F("front", (0.004, -0.004, zb1))
    cut(b, [pocket(circle_shape(0.0235, 48), 0.022, M["dark"], mc)])
    poly_on(mc @ lib.at(0, 0, -0.016), rr(0.034, 0.024, 0.001, 2), 0.0002, material_get(M, "mirror", "#9ea4aa", metal=1.0, rough=0.08, ao=False))
    lathe([(0.0235, 0.0), (0.0305, 0.0), (0.0305, 0.006), (0.029, 0.0075), (0.0235, 0.0075)], M["chrome"], center=(0.004, -0.004, zb1), seg=64, name="mount")
    for k in range(3):
        a = math.radians(30 + 120 * k)
        poly_on(mc @ lib.at(0, 0, 0.0075), [(0.0235 * math.cos(a + s), 0.0235 * math.sin(a + s)) for s in [-0.35 + 0.07 * i for i in range(11)]] + [(0.0275 * math.cos(a + s), 0.0275 * math.sin(a + s)) for s in [0.35 - 0.07 * i for i in range(11)]], 0.0008, M["chrome"])
    for k in range(7):
        a = math.radians(-120 + 10 * k)
        disc(mc @ lib.at(0.0215 * math.cos(a), 0.0215 * math.sin(a), 0), 0.0007, -0.002, -0.0005, material_get(M, "gold", "#d6b25a", metal=1.0, rough=0.25), n=10)
    disc(F("front", (0.038, 0.014, zb1)), 0.004, -0.0005, 0.0015, M["dark"], n=20)  # lens release
    txt(F("front", (0.004, yb1 + 0.007, zb1 - 0.006)), "KANON", 0.0062, M["chrome"], depth=0.0003, bold=0.8, spacing=1.05)
    txt(F("front", (0.052, 0.03, zb1)), "D70", 0.006, M["ink"], depth=0.00003, bold=0.6)
    txt(F("front", (0.052, 0.022, zb1)), "DIGITAL", 0.0024, M["ink"], depth=0.00002)
    # top: mode dial on the left shoulder, the status LCD on the right, the shutter on the grip
    md = F("top", (-0.044, yb1, -0.012))
    slab(circle_shape(0.011, 48), [(0, -0.001, body), (0, 0.0065, body), (0.0006, 0.007, body)], cap_lo=body, cap_hi=body, m=md)
    for k, lab in enumerate(("P", "S", "A", "M", "AUTO")):
        t = math.pi / 2 + k * 0.62
        txt(md, lab, 0.002, M["ink"], x=0.0075 * math.cos(t), y=0.0075 * math.sin(t), z=0.007, depth=0.00002)
    tl = F("top", (0.045, yb1, -0.01))
    plate(tl, 0.034, 0.024, 0.0012, M["dark"], r=0.002, bev=0.0004)
    poly_on(tl, rr(0.028, 0.017, 0.001, 2), 0.0001, lcd, z=0.0012)
    txt(tl, "1/250  F5.6  [ 74 ]", 0.0022, M["black_ink"], z=0.0013, depth=0.00002)
    gt = F("top", (-w / 2 + 0.019, yb1 - 0.002, 0.018))
    disc(gt, 0.007, 0.0, 0.002, body, n=24)
    disc(gt, 0.0045, 0.002, 0.0045, M["chrome"], n=20, round_top=0.001)
    plate(F("top", (0.004, h / 2 - 0.002, -0.025)), 0.02, 0.018, 0.0012, M["steel"], r=0.001)
    # back: screen, eyecup, the button column
    bk = F("back", (0, 0, zback))
    sc = bk @ lib.at(0.01, -0.012, 0)
    plate(sc, 0.05, 0.04, 0.0005, M["dark"], r=0.003)
    poly_on(sc, rr(0.044, 0.034, 0.001, 3), 0.0001, M["glass"], z=0.0005)
    ey = F("back", (-0.004, 0.032, zback))
    plate(ey, 0.036, 0.024, 0.006, M["rubber"], r=0.008, bev=0.002)
    poly_on(ey, rr(0.02, 0.014, 0.002, 3), 0.0002, M["glass"], z=0.006)
    for by in (0.012, 0.0, -0.012, -0.024, -0.036):
        plate(bk @ lib.at(-0.03, by - 0.004, 0), 0.008, 0.006, 0.0015, M["dark"], r=0.002, bev=0.0005)
    disc(bk @ lib.at(-0.052, -0.012, 0), 0.008, 0.0, 0.0015, M["dark"], n=32)
    # base: tripod socket, label, battery door
    bt = F("bottom", (0, yb0, 0))
    disc(bt @ lib.at(0.004, -0.0, 0), 0.006, -0.0002, 0.0002, M["steel"], n=24)
    disc(bt @ lib.at(0.004, -0.0, 0), 0.0035, 0.0002, 0.00022, M["dark"], n=16)
    sticker(bt @ lib.at(0.035, -0.015, 0), 0.042, 0.012, material_get(M, "label", "#202022", rough=0.5), M["ink"], ["KANON D70   DS6041", "No. 3021 7748 15"], size=0.002)
    line_on(bt @ lib.at(-w / 2 + 0.019, 0.0, 0), rr(0.026, 0.05, 0.003, 3), 0.0006, 0.0002, M["dark"], closed=True)


BUILDERS = {
    "skates_ledokol_hockey": skates_hockey,
    "skates_snegurka_figure": skates_figure,
    "stick_ledokol_composite": stick,
    "puck_signed_burlaki": puck,
    "mask_ledokol_goalie": mask,
    "gloves_udar_boxing": gloves,
    "chessclock_ladya": chess_clock,
    "medal_mostograd_marathon": medal,
    "reel_kasatka_3000": reel,
    "stopwatch_sekunda": stopwatch,
    "football_signed_rechnik": football,
    "tablet_mangosteen_pad_air": pad_air,
    "ereader_kniga_lumen": ereader,
    "navigator_severin_navi5": navigator,
    "radio_priboy_209": radio,
    "headphones_basstone_studio": headphones,
    "speaker_tosaki_boom2": speaker,
    "camera_lyra_tlr": lyra,
    "camera_kanon_d70": d70,
}
