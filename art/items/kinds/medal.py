"""
Soviet medals on a pentagonal mount: the striped moiré ribbon over a pentagonal
plate with a pin behind, a small eye at its point, a jump ring, and the struck disc
with its eyelet.

Placeholder convention (src/render/items.ts): pentagonal ribbon block on top
(x ±0.0125, y 0.006…0.034; sides down to y 0.016, point at 0.006), disc r 0.0185
centred at y = −0.02, face +Z, about 3 mm thick; eyelet at the top of the disc
(y ≈ −0.0005), pin across the back of the block at y ≈ 0.022.

`model.emblem` picks the design (courage | merit | victory) and `model.ribbon`
lists the stripe colours left to right. Disc designs are drawn on the placeholder's
256 px canvas (centre 128, radius 128 = the disc radius); see _award.Face.
"""

from __future__ import annotations

import math

import lib
from kinds import _award as aw
from mathutils import Vector

R = 0.0185
CY = -0.02  # disc centre
FIELD = 0.00105  # field height above the disc's mid-plane
RIM_TOP = 0.0015
RELIEF = 0.0003

W = 0.0125  # half width of the mount
Y_TOP, Y_SIDE, Y_POINT = 0.034, 0.016, 0.006
PLATE_FRONT, PLATE_BACK = -0.0007, -0.0016

AO_DISTANCE = 0.0012


# ---------------------------------------------------------------------------
# Ribbon and mount


def _inside_dist(x: float, y: float) -> float:
    """Distance from (x, y) to the pentagon's outline (positive inside)."""
    d = min(x + W, W - x, Y_TOP - y)
    # lower edges: from (±W, Y_SIDE) to (0, Y_POINT)
    for s in (-1, 1):
        a = Vector((0, Y_POINT))
        b = Vector((s * W, Y_SIDE))
        t = (b - a).normalized()
        nrm = Vector((-t.y, t.x)) * (1 if s > 0 else -1)  # inward (up)
        d = min(d, (Vector((x, y)) - a).dot(nrm))
    return d


def ribbon(it: lib.Item, stripes: list[str], *, cols_per: int, rows: int = 120) -> None:
    """The ribbon as one cushioned sheet over the plate: stripes are faces of one
    grid (one material per distinct colour), with a fine watered rib in the weave
    and an edge rolling back round the plate."""
    colors = []
    for c in stripes:
        if c not in colors:
            colors.append(c)
    mats = [lib.material(it, f"ribbon{k}", lib.shade(c, 0.86), metal=0.0, rough=0.8) for k, c in enumerate(colors)]
    stripe_mat = [colors.index(c) for c in stripes]
    n = len(stripes) * cols_per
    z_edge, z_peak = 0.0005, 0.00155
    amp, period = 0.00003, 0.0008

    def surf(x: float, y: float) -> float:
        d = max(_inside_dist(x, y), 0)
        t = min(d / 0.0032, 1)
        t = t * t * (3 - 2 * t)
        phase = 2.4 * math.sin(x * 520 + y * 180) + 1.3 * math.sin(-x * 300 + y * 610 + 1.7)
        return z_edge + (z_peak - z_edge) * t + amp * t * math.sin(2 * math.pi * y / period + phase)

    import bmesh

    bm = bmesh.new()
    grid = []
    for j in range(rows + 1):
        row = []
        v = j / rows
        for i in range(n + 1):
            x = -W + 2 * W * i / n
            yb = Y_POINT + (Y_SIDE - Y_POINT) * abs(x) / W
            y = Y_TOP - v * (Y_TOP - yb)
            row.append(bm.verts.new((x, y, surf(x, y))))
        grid.append(row)
    for j in range(rows):
        for i in range(n):
            f = bm.faces.new((grid[j][i], grid[j + 1][i], grid[j + 1][i + 1], grid[j][i + 1]))
            f.material_index = stripe_mat[i // cols_per]
            f.smooth = True
    # perimeter, clockwise seen from the front: top row, right side, bottom (V), left side
    per = [(grid[0][i], i) for i in range(n + 1)]
    per += [(grid[j][n], n - 1) for j in range(1, rows + 1)]
    per += [(grid[rows][i], i) for i in range(n - 1, -1, -1)]
    per += [(grid[j][0], 0) for j in range(rows - 1, 0, -1)]
    m = len(per)
    mid, low, tuck = [], [], []
    for k, (v, _i) in enumerate(per):
        p0 = per[k - 1][0].co
        p1 = per[(k + 1) % m][0].co
        t = (p1 - p0).to_2d().normalized()
        out = Vector((-t.y, t.x))  # the loop runs clockwise, so this points outwards
        mid.append(bm.verts.new((v.co.x + out.x * 0.00022, v.co.y + out.y * 0.00022, (v.co.z + PLATE_FRONT) / 2)))
        low.append(bm.verts.new((v.co.x + out.x * 0.0001, v.co.y + out.y * 0.0001, PLATE_FRONT - 0.0002)))
        # folded under the plate's edge
        tuck.append(bm.verts.new((v.co.x - out.x * 0.0007, v.co.y - out.y * 0.0007, PLATE_FRONT - 0.0002)))
    rings = [[v for v, _i in per], mid, low, tuck]
    for k in range(m):
        j = (k + 1) % m
        col = min(max(min(per[k][1], per[j][1]), 0), n - 1)
        for a, b in zip(rings, rings[1:]):
            f = bm.faces.new((a[k], a[j], b[j], b[k]))
            f.material_index = stripe_mat[col // cols_per]
            f.smooth = True
    obj = lib.mesh_object("ribbon", bm, mats[0])
    for mt in mats[1:]:
        obj.data.materials.append(mt)


def mount(it: lib.Item, plate_mat, steel) -> None:
    """Pentagonal back plate, a small eye at its point, the pin and catch behind."""
    outline = [(-W, Y_TOP), (-W, Y_SIDE), (0, Y_POINT), (W, Y_SIDE), (W, Y_TOP)]
    inner = aw.offset_polygon(outline, 0.00025)
    p = lib.polygon("plate", inner[::-1], PLATE_FRONT - PLATE_BACK, plate_mat, z=PLATE_BACK, facing=1, bevel=0.00018)
    lib.auto_smooth(p, 40)
    # eye under the point, the jump ring hangs from it
    aw.torus("mount.eye", 0.00105, 0.00042, plate_mat, center=(0, Y_POINT - 0.001, -0.0005), minor_axial=0.00036, segments=20, sides=8)
    # pin: hinge, wire, catch
    py, pz = 0.022, -0.0021
    lib.box("pin.hinge", (0.0016, 0.0026, 0.0009), steel, center=(-0.0088, py, PLATE_BACK - 0.00035), bevel=0.0002)
    aw.tube("pin.wire", [(-0.0088, py, pz + 0.0001), (-0.004, py, pz), (0.0070, py, pz), (0.0084, py, pz + 0.00005)], 0.00042, steel, sides=8)
    lib.lathe("pin.point", [(0.00042, 0.0084), (0.0003, 0.0090), (0.00008, 0.0094), (0, 0.00945)], steel, segments=8, axis="x", center=(0, py, pz), cap=False)
    lib.box("pin.catch", (0.0016, 0.0028, 0.0007), steel, center=(0.0092, py, PLATE_BACK - 0.00032), bevel=0.0002)
    # the catch's lip curls round the pin point, from the plate over the back of the pin
    rr = 0.00072
    hook = [(0.0092, py + rr * math.cos(a), pz + rr * math.sin(a)) for a in [math.radians(d) for d in range(70, -170, -20)]]
    aw.tube("pin.hook", hook, 0.00026, steel, sides=6)


# ---------------------------------------------------------------------------
# Disc


def disc(it: lib.Item, field_mat) -> None:
    """The disc with a raised rim on both faces and the eyelet struck with it."""
    r_in = R * 0.915
    prof = [(0, -FIELD), (r_in * 0.5, -FIELD), (r_in, -FIELD), (r_in + R * 0.015, -RIM_TOP), (R * 0.985, -RIM_TOP), (R, -RIM_TOP * 0.8), (R, RIM_TOP * 0.8), (R * 0.985, RIM_TOP), (r_in + R * 0.015, RIM_TOP), (r_in, FIELD), (r_in * 0.5, FIELD), (0, FIELD)]
    d = lib.lathe("disc", prof, field_mat, segments=128, axis="z", center=(0, CY, 0), cap=False)
    lib.auto_smooth(d, 30)
    return d


def eyelet(it: lib.Item, mat) -> None:
    # a flattened loop rising out of the rim (struck in one piece with the disc)
    aw.torus("eyelet", 0.00148, 0.00062, mat, center=(0, CY + R + 0.00085, 0), minor_axial=0.00078, segments=28, sides=10)
    # a little fillet where it meets the rim
    lib.polygon("eyelet.neck", aw.ellipse(0, CY + R - 0.0001, 0.0011, 0.0006, 14), 0.0015, mat, z=-0.00075, facing=1, bevel=0.0002)


def jump_ring(it: lib.Item, mat) -> None:
    """Joins the eyelet to the mount's eye; worn a little oval."""
    # the disc hangs on the ring: the wire rests at the top of the eyelet's hole and
    # at the bottom of the mount eye's hole
    y_lo = CY + R + 0.00085 + 0.00086 - 0.00038
    y_hi = Y_POINT - 0.001 - 0.00063 + 0.00038
    yc, hy = (y_lo + y_hi) / 2, (y_hi - y_lo) / 2
    hz = hy * 0.82
    pts = [(0, yc + hy * math.sin(a), -0.0002 + hz * math.cos(a)) for a in [2 * math.pi * k / 28 for k in range(28)]]
    aw.tube("jumpring", pts, 0.00036, mat, closed=True, sides=8)


# ---------------------------------------------------------------------------
# Designs


def plane(f: aw.Face, x: float, y: float, s: float, rot: float = math.radians(-18)) -> None:
    """A fighter seen from above, nose up and to the right."""

    def P(px, py):
        u, v = px * s, py * s
        return (x + u * math.cos(rot) - v * math.sin(rot), y + u * math.sin(rot) + v * math.cos(rot))

    f.poly([f.C(*P(-2.2, 14)), f.C(*P(2.2, 14)), f.C(*P(2.6, 4)), f.C(*P(1.6, -12)), f.C(*P(-1.6, -12)), f.C(*P(-2.6, 4))], h=RELIEF * 1.15)  # fuselage
    f.poly([f.C(*P(-17, 3)), f.C(*P(-2, 6)), f.C(*P(2, 6)), f.C(*P(17, 3)), f.C(*P(17, 0)), f.C(*P(2, -1)), f.C(*P(-2, -1)), f.C(*P(-17, 0))], h=RELIEF)  # wings
    f.poly([f.C(*P(-6, -9)), f.C(*P(6, -9)), f.C(*P(6, -12)), f.C(*P(-6, -12))], h=RELIEF * 0.95)  # tailplane
    f.line([f.C(*P(-4, 15.5)), f.C(*P(4, 15.5))], f.S(1.2 * s), h=RELIEF * 0.8)  # propeller


def tank(f: aw.Face, enamel) -> None:
    """A heavy tank moving left, its hull riveted, road wheels inside the track."""
    C = f.C
    track = [C(70, 182), C(76, 176), C(178, 176), C(186, 182), C(186, 190), C(178, 198), C(78, 198), C(70, 190)]
    f.poly(track, h=RELIEF * 0.9)
    f.dots([C(x, 189) for x in range(84, 176, 13)], f.S(4.6), h=RELIEF * 1.25, segments=10)  # road wheels
    f.dots([C(77, 186), C(179, 186)], f.S(4.0), h=RELIEF * 1.2, segments=10)  # sprocket, idler
    f.poly([C(78, 176), C(84, 164), C(176, 164), C(182, 176)], h=RELIEF * 1.1)  # hull
    f.poly([C(110, 164), C(114, 152), C(150, 152), C(156, 164)], h=RELIEF * 1.25)  # turret
    f.poly([C(84, 164), C(87, 158), C(100, 158), C(102, 164)], h=RELIEF * 1.2)  # small front turret
    f.line([C(112, 157), C(64, 154)], f.S(3.2), h=RELIEF * 1.2)  # main gun
    f.line([C(86, 161), C(72, 160)], f.S(2), h=RELIEF * 1.1)  # front gun
    f.dots([C(x, 170) for x in range(90, 176, 7)], f.S(1.15), h=RELIEF * 1.35, segments=6)  # rivets
    f.dots([C(x, 156) for x in range(118, 150, 6)], f.S(1.0), h=RELIEF * 1.45, segments=6)


def courage(f: aw.Face, enamel) -> None:
    """Three aircraft, ЗА ОТВАГУ in red enamel, a tank, СССР in red enamel."""
    for x, y, s in ((76, 64, 1.2), (128, 46, 1.3), (180, 64, 1.2)):
        plane(f, x, y, s)
    f.text("ЗА", f.S(28), *f.C(128, 100), h=RELIEF * 1.3, mat=enamel, bold=1.2)
    f.text("ОТВАГУ", f.S(30), *f.C(128, 134), h=RELIEF * 1.3, mat=enamel, bold=1.2)
    tank(f, enamel)
    f.text("СССР", f.S(19), *f.C(128, 220), h=RELIEF * 1.2, mat=enamel, bold=1.2)


def merit(f: aw.Face) -> None:
    """A small star, СССР, and ЗА БОЕВЫЕ ЗАСЛУГИ in three lines of serifed capitals."""
    f.poly(lib.star_points(5, f.S(20), f.S(8), f.C(128, 54)), h=RELIEF * 1.2, bevel=0.00005)
    f.text("СССР", f.S(21), *f.C(128, 92), h=RELIEF * 1.1, bold=1.2)
    f.line([f.C(84, 108), f.C(172, 108)], f.S(1.6), h=RELIEF * 0.6)
    for txt, y in (("ЗА", 130), ("БОЕВЫЕ", 160), ("ЗАСЛУГИ", 190)):
        f.text(txt, f.S(25), *f.C(128, y), h=RELIEF * 1.1, bold=1.2, spacing=1.05)
    f.line([f.C(96, 212), f.C(160, 212)], f.S(1.6), h=RELIEF * 0.6)


def victory_face(f: aw.Face) -> None:
    """Star in a burst of rays between laurel sprigs; НАШЕ ДЕЛО ПРАВОЕ / МЫ ПОБЕДИЛИ round the rim."""
    cx, cy = f.C(128, 126)
    for i in range(24):
        a = math.pi / 2 + 2 * math.pi * i / 24
        r0, r1 = f.S(40), f.S(64 if i % 2 == 0 else 54)
        w = f.S(4.0 if i % 2 == 0 else 2.6)
        f.poly([(cx + math.cos(a) * r0 - math.sin(a) * w, cy + math.sin(a) * r0 + math.cos(a) * w), (cx + math.cos(a) * r1, cy + math.sin(a) * r1), (cx + math.cos(a) * r0 + math.sin(a) * w, cy + math.sin(a) * r0 - math.cos(a) * w)], h=RELIEF * 0.6, bevel=0)
    f.poly(lib.star_points(5, f.S(38), f.S(15), (cx, cy)), h=RELIEF * 1.3, bevel=0.00006)
    f.poly(lib.star_points(5, f.S(30), f.S(12), (cx, cy)), h=RELIEF * 1.45, bevel=0.00004)
    # laurel sprigs low left and right
    for s in (-1, 1):
        stem = [f.C(128 + s * (14 + 9 * k), 196 - 7 * k + 0.6 * k * k) for k in range(7)]
        f.line(stem, f.S(2), h=RELIEF * 0.7)
        for k in range(1, 7):
            x, y = stem[k]
            for side in (-1, 1):
                a = math.atan2(stem[k][1] - stem[k - 1][1], stem[k][0] - stem[k - 1][0]) + side * 0.7
                f.poly(aw.ellipse(x + math.cos(a) * f.S(5), y + math.sin(a) * f.S(5), f.S(5.5), f.S(2.4), 10, rot=a), h=RELIEF * 0.9)
    f.arc("НАШЕ ДЕЛО ПРАВОЕ", f.S(103), f.S(15), start=math.pi / 2, spacing=0.74)
    f.arc("МЫ ПОБЕДИЛИ", f.S(103), f.S(15), start=-math.pi / 2, inward=True, spacing=0.74)


def victory_back(f: aw.Face) -> None:
    """Star above ЗА ПОБЕДУ НАД ГЕРМАНИЕЙ, the war's dates round the rim."""
    f.poly(lib.star_points(5, f.S(13), f.S(5.2), f.C(128, 56)), h=RELIEF * 1.1)
    for txt, y, s in (("ЗА ПОБЕДУ", 96, 19), ("НАД", 126, 19), ("ГЕРМАНИЕЙ", 156, 18)):
        f.text(txt, f.S(s), *f.C(128, y), h=RELIEF * 1.0, bold=1.2, spacing=1.08)
    f.arc("В ВЕЛИКОЙ ОТЕЧЕСТВЕННОЙ ВОЙНЕ 1941—1945 гг.", f.S(104), f.S(11), start=-math.pi / 2, inward=True, spacing=0.66)


def serial(it: lib.Item) -> str:
    r = aw.rng(it, "serial")
    return f"№{r.randint(120000, 3900000)}"


def build(it: lib.Item) -> None:
    it.ao_size = 1024
    emblem = it.model.get("emblem", "courage")
    color = it.color
    brass = emblem == "victory"
    field = lib.material(it, "field", lib.shade(color, 0.92), metal=1.0, rough=0.42 if not brass else 0.38)
    relief = lib.material(it, "relief", lib.shade(color, 1.04), metal=1.0, rough=0.3)
    steel = lib.material(it, "steel", "#8d8c88", metal=1.0, rough=0.45)

    stripes = list(it.model.get("ribbon", ["#8a8a86"]))
    ribbon(it, stripes, cols_per=max(1, round(44 / len(stripes))))
    mount(it, field, steel)
    jump_ring(it, field)

    d = disc(it, field)
    eyelet(it, field)

    obv = aw.Face(1, relief, FIELD, R, center=(0, CY), relief=RELIEF)
    rev = aw.Face(-1, relief, FIELD, R, center=(0, CY), relief=RELIEF)
    if emblem == "courage":
        enamel = lib.material(it, "enamel", "#a3161c", metal=0.0, rough=0.2)
        courage(obv, enamel)
    elif emblem == "merit":
        merit(obv)
    elif emblem == "victory":
        victory_face(obv)
        victory_back(rev)
    if emblem in ("courage", "merit"):
        # the award number, hand-punched digit by digit into the plain back
        aw.stamp(d, it, serial(it), size=0.0026, x=0, y=CY - 0.0006, z=-FIELD, facing=-1, depth=0.00013, uneven=1.0, spacing=0.62)
