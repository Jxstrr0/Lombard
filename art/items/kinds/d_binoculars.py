"""
binoculars_army_8x30: late-1970s army Porro-prism field binoculars, 8×30, with
centre focusing. No maker's name, only a type mark and a works' stamp.

They rest flat: optical axes along Y (objectives at +Y, eyepieces at -Y), top up
(+Z). Each half is a prism housing (the outline is the hull of a big circle on
the objective axis and a smaller one on the eyepiece axis), closed by enamelled
cover plates at both ends, with the objective barrel in front and the eyepiece
behind. The halves hang on a central hinge that also carries the focus wheel
and the eyepiece bridge. The eyepiece-side cover of the right half carries the
engraving (filled white): the type, the works' mark, the serial.
"""

from __future__ import annotations

import math

import lib
from kinds import box as B
from kinds import box_c as C
from kinds import d_barometer as BR
from kinds import phone as P
from mathutils import Vector

txt, line_on, poly_on, lathe, tube, uvn = B.txt, C.line_on, C.poly_on, C.lathe, C.tube, C.uvn

XO, RO = 0.058, 0.026  # objective axis, housing radius round it
XE, RE = 0.032, 0.0205  # eyepiece axis (64 mm between the eyes), housing radius round it
Y0, Y1 = -0.024, 0.022  # prism housing, back and front
PLATE = 0.0016  # cover plate thickness
INK = 0.00005


def hull(inset: float, sx: int, n: int = 28):
    """Housing outline in (x, up) for the half on side sx, anticlockwise."""
    ro, re = RO - inset, RE - inset
    phi = math.acos((RO - RE) / (XO - XE))
    pts = [(XO + ro * math.cos(a), ro * math.sin(a)) for a in (-phi + 2 * phi * k / n for k in range(n + 1))]
    pts += [(XE + re * math.cos(a), re * math.sin(a)) for a in (phi + (2 * math.pi - 2 * phi) * k / n for k in range(n + 1))]
    if sx < 0:
        pts = [(-x, y) for x, y in reversed(pts)]
    return pts


def lug_outline(sx: int, r: float = 0.0098, n: int = 20):
    """A hinge lug: a knuckle round the axle, running out into the housing."""
    pts = [(r * math.cos(a), r * math.sin(a)) for a in (math.radians(60) + math.radians(240) * k / n for k in range(n + 1))]
    pts += [(0.0190, -0.0105), (0.0190, 0.0105)]
    if sx < 0:
        pts = [(-x, y) for x, y in reversed(pts)]
    return pts


def hammer_sickle(m, s, mat):
    """A crude hammer and sickle, s across, as paint-filled engraving."""
    w = s * 0.11
    arc = [(s * 0.36 * math.cos(a) + s * 0.05, s * 0.36 * math.sin(a) + s * 0.05) for a in (math.radians(-150 + 250 * k / 12) for k in range(13))]
    line_on(m, arc, w, INK, mat)
    line_on(m, [(-s * 0.30, -s * 0.20), (-s * 0.46, -s * 0.40)], w * 1.3, INK, mat)  # sickle handle
    line_on(m, [(s * 0.34, -s * 0.42), (-s * 0.22, s * 0.22)], w, INK, mat)  # hammer shaft
    line_on(m, [(-s * 0.36, s * 0.16), (-s * 0.12, s * 0.40)], w * 2.0, INK, mat)  # hammer head


def works_mark(m, r, mat):
    """The works' mark: a prism (triangle) with a ray through it, in a ring."""
    BR.arc_band(mat, m, r * 0.86, r, 0, 2 * math.pi, 0.0, INK, n=24, name="mark")
    tri = [(r * 0.62 * math.cos(math.radians(a)), r * 0.62 * math.sin(math.radians(a)) - r * 0.06) for a in (90, 210, 330)]
    line_on(m, tri, r * 0.12, INK, mat, closed=True)
    line_on(m, [(-r * 0.7, -r * 0.2), (-r * 0.12, r * 0.02), (r * 0.7, -r * 0.3)], r * 0.09, INK, mat)


def build(it: lib.Item) -> None:
    M = B.setup(it)
    grain = lib.material(it, "grain", it.color, rough=0.88)
    enamel = lib.material(it, "enamel", "#0d0d0f", metal=0.35, rough=0.32)
    black = lib.material(it, "blackmetal", "#1d1d20", metal=0.45, rough=0.42)
    gun = lib.material(it, "gunmetal", "#4a4a4c", metal=1.0, rough=0.4)
    fill = lib.material(it, "fill", "#cfcabb", rough=0.6, ao=False)
    coat = lib.material(it, "coating", "#342f96", metal=0.85, rough=0.06, ao=False)
    brass = lib.material(it, "brass", "#a8853f", metal=1.0, rough=0.35, ao=False)
    steel = lib.material(it, "steel", "#8d8f91", metal=1.0, rough=0.35)
    dark = M["dark"]

    up_y = lambda y: uvn((0, y, 0), (1, 0, 0), (0, 0, -1), (0, 1, 0))  # noqa: E731  local z = +Y
    back = lambda y: uvn((0, y, 0), (1, 0, 0), (0, 0, 1), (0, -1, 0))  # noqa: E731  facing -Y, x right, z up
    front = lambda y: uvn((0, y, 0), (-1, 0, 0), (0, 0, 1), (0, 1, 0))  # noqa: E731  facing +Y

    for sx in (1, -1):
        shape = lambda inset, sx=sx: hull(inset, sx)  # noqa: E731
        # --- prism housing in grained covering, the ends rounded over
        ln = Y1 - Y0
        P.slab(shape, [(0.0030, 0.0, grain), (0.0009, 0.0012, grain), (0.0, 0.0040, grain), (0.0, ln - 0.0040, grain), (0.0009, ln - 0.0012, grain), (0.0030, ln, grain)],
               cap_lo=grain, cap_hi=grain, m=up_y(Y0), smooth=50, name="housing")
        # --- enamelled cover plates, standing a little proud at each end
        for y, sgn in ((Y0, -1), (Y1, 1)):
            rings = [(0.0022, -0.0006, enamel), (0.0016, PLATE - 0.0005, enamel), (0.0021, PLATE, enamel)]
            m = up_y(y) if sgn > 0 else uvn((0, y, 0), (-1, 0, 0), (0, 0, -1), (0, -1, 0))
            P.slab((lambda inset, sx=sx, sgn=sgn: hull(inset, sx * sgn)), rings, cap_lo=enamel, cap_hi=enamel, m=m, smooth=40, name="cover")

        # --- objective barrel, its ring and the coated lens
        lathe(
            [(0.0190, 0.0180), (0.0190, 0.0246), (0.0199, 0.0253), (0.0199, 0.0276), (0.0187, 0.0283), (0.0187, 0.0290), (0.0196, 0.0390), (0.0203, 0.0446),
             (0.0215, 0.0460), (0.0215, 0.0584), (0.0209, 0.0592), (0.0183, 0.0592), (0.0177, 0.0585), (0.0172, 0.0547), (0.0160, 0.0535), (0, 0.0535)],
            black, axis="y", center=(sx * XO, 0, 0), seg=64, smooth=35, name="objective",
        )
        for h in (0.0478, 0.0498, 0.0518, 0.0538, 0.0558):  # grip grooves cut as fine dark rings
            lathe([(0.0213, h - 0.0005), (0.02168, h - 0.0003), (0.02168, h + 0.0003), (0.0213, h + 0.0005)], enamel, axis="y", center=(sx * XO, 0, 0), seg=64, name="rib")
        lathe([(0, 0.0553), (0.0060, 0.05515), (0.0120, 0.0546), (0.0167, 0.05375)], coat, axis="y", center=(sx * XO, 0, 0), seg=48, smooth=60, name="lens")

        # --- eyepiece: collar, tube, dioptre ring, flared eyecup, eye lens
        lathe(
            [(0.0128, -0.0220), (0.0128, -0.0282), (0.0118, -0.0290), (0.0105, -0.0292), (0.0105, -0.0410), (0.0127, -0.0412), (0.0127, -0.0446), (0.0118, -0.0451),
             (0.0118, -0.0458), (0.0148, -0.0470), (0.0158, -0.0560), (0.0165, -0.0584), (0.0160, -0.0590), (0.0140, -0.0590), (0.0126, -0.0572), (0.0096, -0.0556),
             (0.0090, -0.0535), (0, -0.0535)],
            black, axis="y", center=(sx * XE, 0, 0), seg=48, smooth=35, name="eyepiece",
        )
        lathe([(0, -0.0548), (0.0045, -0.05465), (0.0093, -0.0539)], coat, axis="y", center=(sx * XE, 0, 0), seg=32, smooth=60, name="eyelens")
        if sx > 0:  # the right eyepiece focuses on its own: a knurled ring and a scale
            P.place(BR.reeded(black, 0.0110, 0.0129, 0.0136, 0.0414, 0.0444, 44, name="dioptre"), uvn((sx * XE, 0, 0), (1, 0, 0), (0, 0, 1), (0, -1, 0)))
            tm = uvn((sx * XE, -0.0383, 0.0105), (1, 0, 0), (0, -1, 0), (0, 0, 1))
            txt(tm, "+  0  −", 0.0026, fill, depth=INK, bold=0.4)
        else:
            lathe([(0.0124, -0.0414), (0.0132, -0.0417), (0.0132, -0.0441), (0.0124, -0.0444)], black, axis="y", center=(sx * XE, 0, 0), seg=48, name="ring")

        # --- hinge lugs, front and back; the two halves' lugs sit side by side on the axle
        for a, b in (((0.0158, 0.0208), (0.0105, 0.0155)), ((-0.0235, -0.0185), (-0.0182, -0.0132))):
            lo, hi = a if sx > 0 else b
            P.slab((lambda inset, sx=sx: lug_outline(sx, 0.0098 - inset)), [(0.0006, 0.0, black), (0.0, 0.0006, black), (0.0, hi - lo - 0.0006, black), (0.0006, hi - lo, black)],
                   cap_lo=black, cap_hi=black, m=up_y(lo), smooth=40, name="lug")

        # --- strap staple on the outer shoulder
        tube([(sx * 0.0810, -0.0150, 0.0055), (sx * 0.0880, -0.0150, 0.0055), (sx * 0.0880, -0.0150, -0.0055), (sx * 0.0810, -0.0150, -0.0055)], 0.0011, gun, n=8, name="staple")

        # --- cover screws (slotted, steel: they are what answers the magnet)
        yb, yf = Y0 - PLATE, Y1 + PLATE
        for k, (x, z) in enumerate(((XO + 0.0212 * math.cos(math.radians(72)), 0.0212 * math.sin(math.radians(72))), (XO + 0.0212 * math.cos(math.radians(72)), -0.0212 * math.sin(math.radians(72))), (0.0158, 0.0))):
            BR.slot_screw(back(yb) @ lib.at(sx * x, z, 0), 0.0015, steel, dark, 0.7 * k + sx, h=0.0005)
        for k, (x, z) in enumerate(((0.0158, 0.0), (0.0335, 0.0165), (0.0335, -0.0165))):
            BR.slot_screw(front(yf) @ lib.at(-sx * x, z, 0), 0.0015, steel, dark, 1.1 * k + sx, h=0.0005)

    # --- hinge axle, end caps, focus wheel
    lathe(
        [(0, -0.0387), (0.0040, -0.0387), (0.0048, -0.0381), (0.0048, -0.0360), (0.0060, -0.0358), (0.0060, -0.0245), (0.0070, -0.0242), (0.0070, 0.0212), (0.0082, 0.0214), (0.0082, 0.0248),
         (0.0074, 0.0256), (0, 0.0258)],
        black, axis="y", seg=40, smooth=35, name="axle",
    )
    P.place(BR.reeded(black, 0.0060, 0.0119, 0.0127, 0.0002, 0.0188, 40, name="focus"), uvn((0, 0.0090, 0), (1, 0, 0), (0, 0, 1), (0, -1, 0)))
    lathe([(0.0115, -0.0100), (0.0121, -0.0104), (0.0121, -0.0108), (0.0100, -0.0110), (0.0064, -0.0110)], black, axis="y", seg=40, name="focus_a")
    lathe([(0.0064, 0.0092), (0.0100, 0.0092), (0.0121, 0.0089), (0.0115, 0.0086)], black, axis="y", seg=40, name="focus_b")
    # eye-spacing scale on the front cap
    fm = front(0.0258)
    for k, deg in enumerate(range(-40, 41, 10)):
        a = math.radians(90 + deg)
        r0 = 0.0046 if k % 2 == 0 else 0.0054
        line_on(fm, [(r0 * math.cos(a), r0 * math.sin(a)), (0.0066 * math.cos(a), 0.0066 * math.sin(a))], 0.00035, INK, fill)
    txt(fm, "64", 0.0022, fill, y=0.0012, depth=INK, bold=0.3)
    BR.slot_screw(back(-0.0387), 0.0030, steel, dark, 0.4, h=0.0005)

    # --- eyepiece bridge: an arm from the focus shaft to both eyepieces
    bar = [(-XE, -0.0042), (XE, -0.0042), (XE, 0.0042), (-XE, 0.0042)]
    P.slab((lambda inset: [(x - inset if x > 0 else x + inset, z - inset if z > 0 else z + inset) for x, z in bar]),
           [(0.0005, 0.0, black), (0.0, 0.0005, black), (0.0, 0.0027, black), (0.0005, 0.0032, black)], cap_lo=black, cap_hi=black, m=up_y(-0.0345), name="bridge")
    for x in (-XE, XE):
        lathe([(0.0100, -0.0353), (0.0140, -0.0353), (0.0146, -0.0348), (0.0146, -0.0311), (0.0140, -0.0306), (0.0100, -0.0306)], black, axis="y", center=(x, 0, 0), seg=40, name="yoke")
    lathe([(0.0040, -0.0356), (0.0078, -0.0356), (0.0084, -0.0351), (0.0084, -0.0307), (0.0078, -0.0302), (0.0040, -0.0302)], black, axis="y", seg=32, name="boss")

    # --- engraving, filled white, on the eyepiece-side covers
    bm = back(Y0 - PLATE)
    cx = 0.0640
    works_mark(bm @ lib.at(cx, 0.0118, 0), 0.0030, fill)
    txt(bm, "БПЦ", 0.0047, fill, x=cx, y=0.0050, depth=INK, bold=0.45, spacing=1.12)
    txt(bm, "8×30", 0.0047, fill, x=cx, y=-0.0015, depth=INK, bold=0.45, spacing=1.08)
    txt(bm, "№ 784213", 0.0027, fill, x=cx, y=-0.0078, depth=INK, bold=0.3)
    hammer_sickle(bm @ lib.at(cx, -0.0130, 0), 0.0034, fill)
    txt(bm, "8,5°", 0.0042, fill, x=-cx, y=0.0050, depth=INK, bold=0.45)
    txt(bm, "150 м", 0.0030, fill, x=-cx, y=-0.0012, depth=INK, bold=0.3)
    txt(bm, "на 1000 м", 0.0024, fill, x=-cx, y=-0.0058, depth=INK, bold=0.2)
    txt(bm, "СДЕЛАНО В СССР", 0.0017, fill, x=-cx, y=-0.0118, depth=INK, bold=0.3, spacing=1.05)
    # paint chipped to the brass along the left cover's edge and on the bridge
    poly_on(bm, [(-0.0800, 0.0030), (-0.0786, 0.0052), (-0.0779, 0.0088), (-0.0789, 0.0101), (-0.0801, 0.0072)], 0.00004, brass)
    poly_on(bm, [(-0.0470, -0.0185), (-0.0440, -0.0192), (-0.0421, -0.0188), (-0.0448, -0.0178)], 0.00004, brass)
    poly_on(back(-0.0345), [(0.0050, 0.0026), (0.0085, 0.0031), (0.0102, 0.0024), (0.0078, 0.0015)], 0.00004, brass)

    # --- centre the bounding box on the origin
    lo, hi = Vector((1e9,) * 3), Vector((-1e9,) * 3)
    objs = lib.mesh_objects()
    for o in objs:
        for v in o.data.vertices:
            p = o.matrix_world @ v.co
            lo, hi = Vector(map(min, lo, p)), Vector(map(max, hi, p))
    c = (lo + hi) / 2
    lib.transform(objs, lib.at(-c.x, -c.y, -c.z))
    print(f"[items] binoculars bounds {tuple(round(x, 5) for x in hi - lo)} shift {tuple(round(-x, 5) for x in c)}", flush=True)
