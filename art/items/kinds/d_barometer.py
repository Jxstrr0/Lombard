"""
barometer_mostpribor_ship: a 1960s ship's aneroid barometer in a turned brass
case, by the (fictional) Mostograd instrument works Mostpribor.

It rests flat, dial (+Z) up. Everything is drawn in a local frame with the case
axis on the origin and the back rim at z = 0; `build` ends by moving the lot so
its bounding box is centred on the origin (the hanging loop makes it taller than
it is wide, so the case centre ends up a little below the origin).

Front: wall flange, body, a stepped bezel with a reeded band, a thick bevelled
glass with the brass set hand and its knurled knob, a silvered dial (mm Hg, 700
to 800 over 300 degrees, weather words on an inner arc), an open centre showing
the corrugated capsule under a bridge, and the blued needle with its crescent
counterweight. Back: a brass plate on three screws, the adjusting hole, stamps.
"""

from __future__ import annotations

import math

import bmesh
import lib
from kinds import box as B
from kinds import box_c as C
from kinds import phone as P
from mathutils import Vector

F, disc, circle = P.F, P.disc, P.circle
txt, line_on, poly_on, lathe, tube = B.txt, C.line_on, C.poly_on, C.lathe, C.tube

R_FLANGE = 0.070
Z_DIAL = 0.0392  # top of the dial plate
Z_GLASS = 0.0448  # underside of the glass
Z_TOP = 0.0490  # top of the glass
INK = 0.00005  # print height: about five Draco steps over 17 cm


def scale_angle(v: float) -> float:
    """Dial angle (radians, 0 = +X, anticlockwise) of a reading in mm Hg."""
    return math.radians(240 - (v - 700) * 3)


def polar(r: float, a: float):
    return (r * math.cos(a), r * math.sin(a))


def flat_mesh(name, mat, m, quads, z, dz):
    """Many small prisms (ticks) in one mesh, each with its own jittered height."""
    bm = bmesh.new()
    for q in quads:
        lib.prism(bm, q, z, lib.jitter(dz), base=False)
    return P.place(lib.mesh_object(P._name(name), bm, mat), m)


def arc_band(mat, m, r0, r1, a0, a1, z, dz, n=48, name="band"):
    """A flat ring sector r0..r1 between angles a0 and a1, standing dz above z."""
    bm = bmesh.new()
    top = z + lib.jitter(dz)
    rows = []
    for k in range(n + 1):
        a = a0 + (a1 - a0) * k / n
        rows.append([bm.verts.new((r * math.cos(a), r * math.sin(a), zz)) for r, zz in ((r0, z), (r0, top), (r1, top), (r1, z))])
    closed = abs(abs(a1 - a0) - 2 * math.pi) < 1e-6
    pairs = list(zip(rows, rows[1:]))
    for a, b in pairs:
        for i in range(3):
            bm.faces.new((a[i], a[i + 1], b[i + 1], b[i]))
    if not closed:
        bm.faces.new(rows[0])
        bm.faces.new(rows[-1][::-1])
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-8)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    # an open strip has no inside: make sure the top faces +Z
    if not any(f.normal.z > 0.5 for f in bm.faces):
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
    return P.place(lib.mesh_object(P._name(name), bm, mat), m)


def reeded(mat, r_in, r_lo, r_hi, z0, z1, teeth, name="reeding"):
    """A reeded (coin-edge) band: radius alternates r_lo / r_hi round the ring."""
    bm = bmesh.new()
    n = teeth * 4
    rows = []
    for i in range(n):
        a = 2 * math.pi * i / n
        r = r_hi if i % 4 in (0, 1) else r_lo
        c, s = math.cos(a), math.sin(a)
        rows.append([bm.verts.new((r_in * c, r_in * s, z0)), bm.verts.new((r * c, r * s, z0)), bm.verts.new((r * c, r * s, z1)), bm.verts.new((r_in * c, r_in * s, z1))])
    for i in range(n):
        a, b = rows[i], rows[(i + 1) % n]
        for k in range(3):
            bm.faces.new((a[k], b[k], b[k + 1], a[k + 1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = lib.mesh_object(P._name(name), bm, mat)
    lib.auto_smooth(o, 30)
    return o


def emblem(m, r, mat, *, z=0.0, depth=INK, w=None):
    """The works' mark: a bridge arch over two waves, in a ring."""
    w = w or r * 0.13
    arc_band(mat, m, r - w, r, 0, 2 * math.pi, z, depth, n=28, name="mark")
    # the arch, springing from two piers, with a flat deck above it
    arch = [(r * 0.62 * math.cos(a), -r * 0.18 + r * 0.5 * math.sin(a)) for a in [math.pi * k / 8 for k in range(9)]]
    line_on(m, arch, w, depth, mat, z=z)
    line_on(m, [(-r * 0.74, r * 0.42), (r * 0.74, r * 0.42)], w, depth, mat, z=z)
    for x in (-r * 0.62, r * 0.62):
        line_on(m, [(x, -r * 0.18), (x, r * 0.42)], w, depth, mat, z=z)
    for y in (-r * 0.42, -r * 0.66):
        hw = r * (0.66 if y > -r * 0.5 else 0.42)
        wave = [(-hw + 2 * hw * k / 8, y + r * 0.07 * (1 if k % 2 else -1)) for k in range(9)]
        line_on(m, wave, w * 0.8, depth, mat, z=z)


def slot_screw(m, r, head, dark, spin, h=0.0009):
    disc(m, r, -0.0003, h, head, n=20, round_top=h * 0.5)
    line_on(m, [polar(-r * 0.8, spin), polar(r * 0.8, spin)], r * 0.24, 0.00006, dark, z=h)


def build(it: lib.Item) -> None:
    M = B.setup(it)
    # The dial sits 5.6 mm under the glass; keep the AO rays shorter than that, or
    # the (opaque to the bake) glass would darken the whole dial.
    B.AO_DISTANCE = 0.0035
    brass = lib.material(it, "brass", it.color, metal=1.0, rough=0.3)
    dial = lib.material(it, "dial", "#e6e3da", metal=0.25, rough=0.5)
    blue = lib.material(it, "blued", "#1c2c58", metal=0.9, rough=0.28)
    nickel = lib.material(it, "nickel", "#aeb0ad", metal=1.0, rough=0.3)
    stamp = lib.material(it, "stamp", lib.shade(it.color, 0.3), metal=0.4, rough=0.6, ao=False)
    ink, dark, glass = M["black_ink"], M["dark"], M["glass_clear"]

    # --- case: back recess, wall flange, body, stepped bezel, dial seat, capsule well
    lathe(
        [
            (0, 0.0010), (0.0610, 0.0010), (0.0612, 0.0), (0.0688, 0.0), (0.0700, 0.0012), (0.0700, 0.0076), (0.0690, 0.0088), (0.0640, 0.0090),
            (0.0618, 0.0096), (0.0606, 0.0112), (0.0600, 0.0135), (0.0600, 0.0318), (0.0606, 0.0334), (0.0622, 0.0346), (0.0634, 0.0350),
            (0.0634, 0.0428), (0.0626, 0.0438), (0.0616, 0.0444), (0.0612, 0.0456), (0.0600, 0.0468), (0.0580, 0.0475), (0.0562, 0.0474),
            (0.0553, 0.0467), (0.0553, 0.0388), (0.0170, 0.0388), (0.0170, 0.0300), (0, 0.0300),
        ],
        brass, seg=96, smooth=28, name="case",
    )
    reeded(brass, 0.0630, 0.0636, 0.0645, 0.0358, 0.0420, 100)
    # a turned groove line on the body, as a lathe leaves
    for z in (0.0165, 0.0290):
        lathe([(0.0598, z - 0.0006), (0.0604, z - 0.0004), (0.0604, z + 0.0004), (0.0598, z + 0.0006)], brass, seg=96, name="bead")

    # wall-mounting holes in the flange (front and back), clear of the loop post
    for deg in (30, 150, 270):
        x, y = polar(0.0667, math.radians(deg))
        fm = F("front", (x, y, 0.0090))
        disc(fm, 0.0023, -0.0002, 0.00012, brass, n=16)
        disc(fm, 0.0015, 0.0, 0.00018, dark, n=12)
        disc(F("back", (x, y, 0.0)), 0.0015, -0.0002, 0.00008, dark, n=12)

    # --- hanging loop on a turned post at the top of the flange
    zf = 0.0044
    lathe(
        [(0, 0.0685), (0.0034, 0.0685), (0.0034, 0.0712), (0.0043, 0.0716), (0.0043, 0.0726), (0.0030, 0.0732), (0.0025, 0.0750),
         (0.0034, 0.0762), (0.0040, 0.0780), (0.0034, 0.0798), (0, 0.0806)],
        brass, axis="y", center=(0, 0, zf), seg=24, name="post",
    )
    rr_, yc = 0.0085, 0.0780 + 0.0085
    tube([(rr_ * math.cos(2 * math.pi * k / 36), yc + rr_ * math.sin(2 * math.pi * k / 36), zf) for k in range(36)], 0.0016, brass, n=8, closed=True, name="loop")

    # --- capsule in the open centre: corrugated diaphragm, bridge, arbor, hairspring
    prof = [(0, 0.0345), (0.0030, 0.0345), (0.0034, 0.0328)]
    for k in range(9):
        r = 0.0045 + k * 0.0012
        prof.append((r, 0.0322 + (0.0007 if k % 2 else 0.0)))
    prof += [(0.0155, 0.0322), (0.0158, 0.0302), (0, 0.0302)]
    lathe(prof, nickel, seg=48, smooth=50, name="capsule")
    wm = F("front", (0, 0, 0))
    ba = math.radians(35)
    bx, by = math.cos(ba), math.sin(ba)
    nx, ny = -by * 0.0022, bx * 0.0022
    bridge = [(-bx * 0.0178 + nx, -by * 0.0178 + ny), (bx * 0.0178 + nx, by * 0.0178 + ny), (bx * 0.0178 - nx, by * 0.0178 - ny), (-bx * 0.0178 - nx, -by * 0.0178 - ny)]
    poly_on(wm, bridge, 0.0009, brass, z=0.0366, bevel=0.0002)
    for s in (-1, 1):
        slot_screw(F("front", (s * bx * 0.0142, s * by * 0.0142, 0.0375)), 0.0011, blue, dark, 0.6 + s, h=0.0004)
    spiral = [polar(0.0012 + 0.0042 * k / 40, 2 * math.pi * 3 * k / 40) for k in range(41)]
    flat_mesh("hairspring", blue, wm, [[polar(math.hypot(*a) - 0.00012, math.atan2(a[1], a[0])), polar(math.hypot(*a) + 0.00012, math.atan2(a[1], a[0])),
                                         polar(math.hypot(*b) + 0.00012, math.atan2(b[1], b[0])), polar(math.hypot(*b) - 0.00012, math.atan2(b[1], b[0]))]
                                        for a, b in zip(spiral, spiral[1:])], 0.0375, 0.0004)
    # a lever from the capsule boss to the arbor chain
    line_on(wm, [(-0.0105, 0.0062), (-0.0035, -0.0095)], 0.0009, 0.0005, nickel, z=0.0350)
    disc(F("front", (-0.0105, 0.0062, 0)), 0.0012, 0.0322, 0.0362, brass, n=12)

    # --- dial plate (an annulus) and the brass trim round the open centre
    lathe([(0.0176, 0.0386), (0.0550, 0.0386), (0.0550, Z_DIAL), (0.0176, Z_DIAL)], dial, seg=96, name="dial")
    lathe([(0.0168, 0.0386), (0.0190, 0.0386), (0.0190, 0.0394), (0.0184, 0.0399), (0.0174, 0.0399), (0.0168, 0.0394)], brass, seg=64, name="trim")
    dm = F("front", (0, 0, Z_DIAL))

    # scale: 700..800 mm Hg, one tick per mm, clockwise from lower left to lower right
    quads = []
    for v in range(700, 801):
        a = scale_angle(v)
        r0, hw = (0.0452, 0.00035) if v % 10 == 0 else ((0.0470, 0.00024) if v % 5 == 0 else (0.0486, 0.00016))
        r1 = 0.0512
        c, s = math.cos(a), math.sin(a)
        quads.append([(r0 * c + hw * s, r0 * s - hw * c), (r1 * c + hw * s, r1 * s - hw * c), (r1 * c - hw * s, r1 * s + hw * c), (r0 * c - hw * s, r0 * s + hw * c)])
    flat_mesh("ticks", ink, dm, quads, 0.0, INK)
    arc_band(ink, dm, 0.0510, 0.0514, scale_angle(800.12), scale_angle(699.88), 0.0, INK, n=72)
    arc_band(ink, dm, 0.0524, 0.0527, scale_angle(800.12), scale_angle(699.88), 0.0, INK, n=72)
    arc_band(ink, dm, 0.0245, 0.0248, 0, 2 * math.pi, 0.0, INK, n=64)
    for v in range(700, 801, 10):
        a = scale_angle(v)
        x, y = polar(0.0405, a)
        txt(dm, str(v), 0.0050, ink, x=x, y=y, rot=a - math.pi / 2, depth=INK, bold=0.35)
    # weather words on the inner arc, each centred on its part of the scale
    for word, v in (("БУРЯ", 710), ("ДОЖДЬ", 730), ("ПЕРЕМЕННО", 750), ("ЯСНО", 770), ("В.СУХО", 790)):
        lib_objs = lib.arc_text(P._name("word"), word, 0.0315, 0.0040, INK, ink, start=scale_angle(v), spacing=0.78)
        P.place(lib_objs, dm)
    for v in (720, 740, 760, 780):  # small diamonds between the words
        x, y = polar(0.0315, scale_angle(v))
        d = 0.0007
        flat_mesh("dot", ink, dm, [[(x - d, y), (x, y - d), (x + d, y), (x, y + d)]], 0.0, INK)
    # lower dial: the mark, the maker, the unit
    emblem(dm @ lib.at(0, -0.0292, 0), 0.0036, ink)
    txt(dm, "МОСТПРИБОР", 0.0031, ink, y=-0.0355, depth=INK, bold=0.5, spacing=1.08)
    txt(dm, "мм рт. ст.", 0.0024, ink, y=-0.0397, depth=INK)
    txt(dm, "СДЕЛАНО В СССР", 0.00155, ink, y=-0.0436, depth=INK, spacing=1.1)

    # --- needle: blued steel, a crescent counterweight on the tail
    na = scale_angle(733)
    nm = F("front", (0, 0, 0.0412)) @ lib.rot("z", na)
    needle = [(-0.0100, 0.0005), (0.0, 0.0011), (0.0300, 0.00055), (0.0425, 0.0010), (0.0500, 0.0), (0.0425, -0.0010), (0.0300, -0.00055), (0.0, -0.0011), (-0.0100, -0.0005)]
    poly_on(nm, needle, 0.00035, blue)
    cres = []
    for k in range(13):
        a = math.radians(-115 + 230 * k / 12)
        cres.append((-0.0128 - 0.0040 * math.cos(a), 0.0040 * math.sin(a)))
    for k in range(13):
        a = math.radians(115 - 230 * k / 12)
        cres.append((-0.0142 - 0.0032 * math.cos(a) * 0.55, 0.0036 * math.sin(a)))
    poly_on(nm, cres, 0.00033, blue)
    disc(F("front", (0, 0, 0)), 0.0021, 0.0368, 0.0421, brass, n=20, round_top=0.0004)
    disc(F("front", (0, 0, 0)), 0.0008, 0.0420, 0.0426, blue, n=10)

    # --- glass, the set hand under it and its knurled knob on top
    lathe([(0, Z_GLASS), (0.0551, Z_GLASS), (0.0551, 0.0465), (0.0518, Z_TOP), (0, Z_TOP)], glass, seg=96, smooth=20, name="glass")
    sa = scale_angle(748)
    sm = F("front", (0, 0, 0.0436)) @ lib.rot("z", sa)
    poly_on(sm, [(0.0, 0.0009), (0.0400, 0.0005), (0.0432, 0.0016), (0.0478, 0.0), (0.0432, -0.0016), (0.0400, -0.0005), (0.0, -0.0009)], 0.0003, brass)
    disc(F("front", (0, 0, 0)), 0.0026, 0.0432, 0.0447, brass, n=20)
    lathe([(0, 0.0486), (0.0046, 0.0486), (0.0050, 0.0496), (0.0050, 0.0500), (0.0058, 0.0503), (0.0058, 0.0538), (0.0052, 0.0546), (0.0030, 0.0552), (0, 0.0553)],
          brass, seg=40, name="knob")
    reeded(brass, 0.0054, 0.0058, 0.0062, 0.0506, 0.0536, 28, name="knurl")

    # --- back: plate on three screws, adjusting hole, stamps
    bk = F("back", (0, 0, 0.0004))
    plate = disc(bk, 0.0602, -0.0008, 0.0, brass, n=96)
    hole = (0.0, -0.0300)
    P.cut(plate, P.holes(bk, [hole], 0.0026, 0.0005, dark, n=20))
    hm = bk @ lib.at(hole[0], hole[1], -0.0005)
    disc(hm, 0.0019, -0.0002, 0.00012, brass, n=14)
    line_on(hm, [(-0.0015, 0.0006), (0.0015, -0.0006)], 0.0005, 0.00006, dark, z=0.00012)
    arc_band(stamp, bk, 0.0572, 0.0576, 0, 2 * math.pi, 0.0, INK, n=72)
    for deg in (90, 210, 330):
        x, y = polar(0.0505, math.radians(deg))
        slot_screw(bk @ lib.at(x, y, 0), 0.0030, brass, dark, math.radians(deg * 1.7 + 20))
    emblem(bk @ lib.at(0, 0.0270, 0), 0.0075, stamp, depth=INK, w=0.0007)
    txt(bk, "МОСТПРИБОР", 0.0068, stamp, y=0.0085, depth=INK, bold=0.6, spacing=1.08)
    txt(bk, "МОСТОГРАД", 0.0030, stamp, y=0.0015, depth=INK, spacing=1.3)
    txt(bk, "№ 31874", 0.0052, stamp, y=-0.0080, depth=INK, bold=0.3)
    txt(bk, "1964 г.", 0.0046, stamp, y=-0.0165, depth=INK, bold=0.3)
    # an arrow and + / − by the adjusting hole
    txt(bk, "−", 0.004, stamp, x=0.0072, y=-0.0300, depth=INK, bold=0.5)
    txt(bk, "+", 0.004, stamp, x=-0.0072, y=-0.0300, depth=INK, bold=0.5)

    # --- centre the bounding box on the origin
    lo, hi = Vector((1e9,) * 3), Vector((-1e9,) * 3)
    objs = lib.mesh_objects()
    for o in objs:
        for v in o.data.vertices:
            p = o.matrix_world @ v.co
            lo, hi = Vector(map(min, lo, p)), Vector(map(max, hi, p))
    c = (lo + hi) / 2
    lib.transform(objs, lib.at(-c.x, -c.y, -c.z))
    print(f"[items] barometer bounds {tuple(round(x, 5) for x in hi - lo)} shift {tuple(round(-x, 5) for x in c)}", flush=True)
