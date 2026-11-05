"""
Coins: struck relief, beaded border, raised rim, reeded or lettered edge.

Placeholder convention (src/render/items.ts): disc r 0.0125, 2 mm thick,
obverse +Z, reverse −Z, edge at x = 0.0125; `model.scale` sizes the real coin
at runtime. `model.emblem` picks the design: smith | eagle | sower | sprinter.

Designs are drawn on the same 256 px canvas grid the placeholder used (centre
128, beads at radius 112) so the two read alike; `C()` maps canvas pixels to metres.
"""

from __future__ import annotations

import math

import lib
from mathutils import Matrix, Vector

R = 0.0125
FIELD = 0.00072  # field height above the mid-plane
RELIEF = 0.00024  # struck relief height above the field
RIM_TOP = 0.001
AO_DISTANCE = 0.0007


def C(px: float, py: float) -> tuple[float, float]:
    """Canvas pixel (y down) → coin metres (y up)."""
    return ((px - 128) / 128 * R, -(py - 128) / 128 * R)


def S(px: float) -> float:
    return px / 128 * R


def ellipse(cx: float, cy: float, rx: float, ry: float, n: int = 16, rot: float = 0.0) -> list[tuple[float, float]]:
    out = []
    for i in range(n):
        a = 2 * math.pi * i / n
        x, y = rx * math.cos(a), ry * math.sin(a)
        out.append((cx + x * math.cos(rot) - y * math.sin(rot), cy + x * math.sin(rot) + y * math.cos(rot)))
    return out


class Face:
    """Draws relief on one face: side +1 = obverse (+Z), −1 = reverse (−Z).

    Coordinates are as seen by someone looking at that face."""

    def __init__(self, it: lib.Item, side: int, relief_mat, field_z: float = FIELD):
        self.it, self.side, self.mat, self.z = it, side, relief_mat, field_z * side
        self.n = 0

    def _name(self, kind: str) -> str:
        self.n += 1
        return f"{'obv' if self.side > 0 else 'rev'}.{kind}.{self.n}"

    def _xy(self, pts):
        # Seen from the back, x is mirrored.
        return [(p[0] * self.side, p[1]) for p in pts]

    def poly(self, pts, h: float = RELIEF, bevel: float = 0.00005):
        pts = self._xy(pts)
        if self.side < 0:
            pts = pts[::-1]
        return lib.polygon(self._name("poly"), pts, h, self.mat, z=self.z, facing=self.side, bevel=bevel, base=False)

    def line(self, pts, width: float, h: float = RELIEF):
        return lib.stroke(self._name("line"), self._xy(pts), width, h, self.mat, z=self.z, facing=self.side)

    def beads(self, n: int, radius: float, size: float, h: float = RELIEF * 0.9):
        return lib.dots(self._name("beads"), lib.ring_points(n, radius), size, h, self.mat, z=self.z, facing=self.side)

    def text(self, s: str, size: float, x: float, y: float, h: float = RELIEF * 0.8, bold: float = 1.5):
        return lib.text(self._name("text"), s, size, h, self.mat, pos=(x * self.side, y, self.z), facing=self.side, bold=bold)

    def arc(self, s: str, radius: float, size: float, *, start: float = math.pi / 2, inward: bool = False, spacing: float = 0.7):
        return lib.arc_text(self._name("arc"), s, radius, size, RELIEF * 0.8, self.mat, z=self.z, start=start, inward=inward, facing=self.side, spacing=spacing)


# ---------------------------------------------------------------------------
# Designs


def smith(f: Face) -> None:
    """A hammer raised over an anvil, the denomination and the date."""
    f.poly([C(88, 150), C(168, 150), C(160, 162), C(146, 166), C(146, 192), C(110, 192), C(110, 166), C(96, 162)])  # anvil
    f.poly([C(102, 192), C(154, 192), C(160, 198), C(96, 198)], h=RELIEF * 0.7)  # block
    f.line([C(118, 144), C(158, 74)], S(7))  # handle
    f.poly([C(146, 54), C(182, 62), C(178, 78), C(142, 70)], h=RELIEF * 1.15)  # hammer head
    # sparks
    for a in (-0.9, -0.4, 0.1):
        x0, y0 = C(128, 140)
        f.line([(x0 + math.cos(a + 2.2) * S(22), y0 + math.sin(a + 2.2) * S(22)), (x0 + math.cos(a + 2.2) * S(34), y0 + math.sin(a + 2.2) * S(34))], S(3), h=RELIEF * 0.6)
    f.arc("ОДИН ПОЛТИННИК", S(96), S(15), start=-math.pi / 2, inward=True)
    f.text("1924", S(16), *C(128, 216))


def eagle(f: Face) -> None:
    """A double-headed eagle: wings with feathers, two crowned heads, a shield on the breast."""
    cx, cy = C(128, 132)
    f.poly(ellipse(cx, cy, S(18), S(34), 20))  # body
    for s in (-1, 1):
        wing = [C(128 + s * 14, 110), C(128 + s * 50, 84), C(128 + s * 80, 78), C(128 + s * 74, 104), C(128 + s * 82, 120), C(128 + s * 70, 132), C(128 + s * 74, 150), C(128 + s * 18, 150)]
        f.poly(wing if s > 0 else wing[::-1])
        for k in range(5):
            t = 0.2 + k * 0.16
            ax, ay = C(128 + s * 18, 140 - k * 5)
            bx, by = C(128 + s * (40 + 34 * t + k * 4), 92 + k * 12)
            f.line([(ax, ay), (bx, by)], S(2.2), h=RELIEF * 1.35)
        f.line([C(128 + s * 8, 104), C(128 + s * 16, 88)], S(7))  # neck
        hx, hy = C(128 + s * 19, 84)
        f.poly(ellipse(hx, hy, S(8), S(7), 14))  # head
        f.poly([C(128 + s * 26, 82), C(128 + s * 36, 86), C(128 + s * 26, 89)][:: s], h=RELIEF * 0.9)  # beak
        f.poly([C(128 + s * 12, 74), C(128 + s * 26, 74), C(128 + s * 27, 66), C(128 + s * 22, 70), C(128 + s * 19, 64), C(128 + s * 16, 70), C(128 + s * 11, 66)][:: s], h=RELIEF * 1.1)  # crown
        # claws with orb and sceptre
        f.line([C(128 + s * 10, 162), C(128 + s * 26, 178)], S(4))
    f.poly([C(110, 50), C(146, 50), C(150, 38), C(139, 44), C(128, 32), C(117, 44), C(106, 38)], h=RELIEF * 1.1)  # big crown
    f.poly([C(116, 164), C(140, 164), C(150, 190), C(128, 182), C(106, 190)])  # tail
    f.line([C(160, 170), C(186, 150)], S(3))  # sceptre
    ox, oy = C(96, 182)
    f.poly(ellipse(ox, oy, S(7), S(7), 14))  # orb
    f.poly([C(119, 118), C(137, 118), C(137, 136), C(128, 144), C(119, 136)], h=RELIEF * 1.5)  # breast shield
    f.beads(64, S(112), S(2.3))


def sower(f: Face) -> None:
    """The sower striding, a rising sun and factory chimneys behind."""
    sx, sy = C(150, 120)
    rays = []
    for i in range(9):
        a = math.pi * i / 8
        rays.append(f.line([(sx + math.cos(a) * S(32), sy + math.sin(a) * S(32)), (sx + math.cos(a) * S(46), sy + math.sin(a) * S(46))], S(2.5), h=RELIEF * 0.5))
    f.line([(sx + math.cos(math.pi * i / 24) * S(30), sy + math.sin(math.pi * i / 24) * S(30)) for i in range(25)], S(4), h=RELIEF * 0.6)
    f.poly([C(62, 104), C(72, 104), C(72, 186), C(62, 186)], h=RELIEF * 0.6)  # chimneys
    f.poly([C(79, 116), C(88, 116), C(88, 186), C(79, 186)], h=RELIEF * 0.6)
    for i, x in enumerate((67, 83)):
        cx, cy = C(x + 4, 96 - i * 4)
        f.poly(ellipse(cx, cy, S(6), S(4), 12), h=RELIEF * 0.4)  # smoke
    hx, hy = C(120, 82)
    f.poly(ellipse(hx, hy, S(10), S(10), 16), h=RELIEF * 1.2)
    f.poly([C(108, 96), C(132, 96), C(138, 120), C(150, 186), C(136, 186), C(122, 142), C(104, 186), C(90, 186), C(106, 130)], h=RELIEF * 1.2)
    f.line([C(130, 104), C(160, 94), C(172, 80)], S(6), h=RELIEF * 1.1)  # throwing arm
    f.line([C(110, 104), C(96, 128)], S(6), h=RELIEF * 1.1)  # arm with the seed bag
    f.poly(ellipse(*C(94, 134), S(9), S(7), 14), h=RELIEF * 1.0)
    f.poly([C(56, 186), C(200, 186), C(200, 194), C(56, 194)], h=RELIEF * 0.7)  # field
    for x in range(60, 200, 12):
        f.line([C(x, 198), C(x + 8, 206)], S(2), h=RELIEF * 0.4)  # furrows
    f.arc("ОДИН ЧЕРВОНЕЦ", S(98), S(12), start=-math.pi / 2, inward=True)
    f.beads(70, S(114), S(1.9))


def sprinter(f: Face) -> None:
    """A runner in mid-stride, the Games legend round the rim."""
    hx, hy = C(140, 70)
    f.poly(ellipse(hx, hy, S(11), S(11), 18), h=RELIEF * 1.3)
    w = S(9)
    f.line([C(136, 84), C(118, 136)], S(13), h=RELIEF * 1.3)  # torso
    f.line([C(118, 136), C(100, 156), C(84, 176)], w, h=RELIEF * 1.2)  # back leg
    f.line([C(118, 136), C(150, 160), C(160, 196)], w, h=RELIEF * 1.2)  # front leg
    f.line([C(132, 96), C(108, 102), C(94, 116)], S(7), h=RELIEF * 1.15)  # arms
    f.line([C(132, 96), C(156, 104), C(168, 92)], S(7), h=RELIEF * 1.15)
    for i, y in enumerate((204, 212)):
        f.line([C(60 + i * 6, y), C(196 - i * 6, y)], S(2), h=RELIEF * 0.5)  # track lanes
    f.arc("ИГРЫ XXII ОЛИМПИАДЫ", S(100), S(13), start=math.pi / 2, spacing=0.66)
    f.text("МОСКВА 1980", S(10), *C(92, 196))


def state_emblem(f: Face, value: str, small: str) -> None:
    """Reverse of the Soviet coins: a globe in a wreath of wheat ears, star above, value below."""
    gx, gy = C(128, 104)
    gr = S(30)
    f.poly(ellipse(gx, gy, gr, gr, 40), h=RELIEF * 0.55)  # globe
    for k in (-0.55, 0, 0.55):
        f.line([(gx + gr * k * math.cos(t), gy + gr * math.sin(t)) for t in [math.pi / 2 - i * math.pi / 10 for i in range(11)]], S(1.6), h=RELIEF * 0.75)  # meridians
    for k in (-0.5, 0, 0.5):
        y = gy + gr * k
        half = math.sqrt(max(gr * gr - (gr * k) ** 2, 0)) * 0.95
        f.line([(gx - half, y), (gx + half, y)], S(1.6), h=RELIEF * 0.75)  # parallels
    # hammer and sickle over the globe
    f.line([C(116, 90), C(140, 118)], S(4), h=RELIEF * 1.1)
    f.poly([C(134, 84), C(146, 96), C(142, 100), C(130, 88)], h=RELIEF * 1.1)
    f.line([(gx + S(14) * math.cos(a), gy + S(14) * math.sin(a)) for a in [math.radians(d) for d in range(150, -60, -15)]], S(3.6), h=RELIEF * 1.1)
    f.line([C(124, 114), C(116, 122)], S(3.6), h=RELIEF * 1.1)
    # sun rays under the globe
    for i in range(7):
        a = math.pi + math.pi * (i + 1) / 8
        f.line([(gx + math.cos(a) * S(32), gy + math.sin(a) * S(32)), (gx + math.cos(a) * S(42), gy + math.sin(a) * S(42))], S(2), h=RELIEF * 0.5)
    # wheat-ear wreath: two arcs of grains
    for s in (-1, 1):
        for i in range(10):
            a = math.pi / 2 + s * (0.55 + i * 0.22)
            r = S(52)
            ex, ey = gx + math.cos(a + math.pi) * r * -1, gy + math.sin(a) * r * 0.95 - S(4)
            ex = gx + s * abs(math.cos(a)) * r
            f.poly(ellipse(ex, ey, S(4.2), S(8.5), 10, rot=a + (math.pi / 2 if s > 0 else -math.pi / 2) * 0.35), h=RELIEF * 0.9)
    f.poly(lib.star_points(5, S(9), S(3.8), C(128, 50)), h=RELIEF * 1.0)
    f.text("СССР", S(16), *C(128, 168))
    if value:
        f.text(value, S(22) if len(value) <= 3 else S(14), *C(128, 192))
    if small:
        f.text(small, S(9), *C(128, 212))


def wreath_value(f: Face) -> None:
    """Reverse of the Imperial rouble: value and date in a wreath of leaves."""
    for s in (-1, 1):
        for i in range(12):
            a = -math.pi / 2 + s * (0.35 + i * 0.21)
            r = S(90)
            ex, ey = math.cos(a) * r, math.sin(a) * r
            f.poly(ellipse(ex, ey, S(4.5), S(10), 12, rot=a), h=RELIEF * 0.9)
        f.line([(math.cos(-math.pi / 2 + s * (0.3 + i * 0.21)) * S(84), math.sin(-math.pi / 2 + s * (0.3 + i * 0.21)) * S(84)) for i in range(13)], S(2), h=RELIEF * 0.6)
    f.text("РУБЛЬ", S(22), *C(128, 104))
    f.text("1877", S(17), *C(128, 140))
    f.text("С.П.Б.", S(10), *C(128, 166))
    f.line([C(100, 122), C(156, 122)], S(1.5), h=RELIEF * 0.5)
    f.beads(64, S(112), S(2.3))


# ---------------------------------------------------------------------------
# Body


def body(it: lib.Item, metal_mat, rim_mat) -> None:
    """Disc with a raised rim (listel) on both faces and a slightly rounded edge."""
    r_in = R * 0.905
    rings = [r_in * 0.5]
    prof = [(0, -FIELD)] + [(r, -FIELD) for r in rings] + [
        (r_in, -FIELD),
        (r_in + R * 0.012, -RIM_TOP),
        (R * 0.985, -RIM_TOP),
        (R, -RIM_TOP * 0.82),
        (R, RIM_TOP * 0.82),
        (R * 0.985, RIM_TOP),
        (r_in + R * 0.012, RIM_TOP),
        (r_in, FIELD),
    ] + [(r, FIELD) for r in reversed(rings)] + [(0, FIELD)]
    disc = lib.lathe("coin", prof, metal_mat, segments=128, axis="z", cap=False)
    lib.auto_smooth(disc, 30)


def reeded_edge(it: lib.Item, mat, n: int = 140) -> None:
    """Fine vertical grooves: a thin ribbed band just proud of the edge."""
    h = RIM_TOP * 0.78
    for i in range(n):
        a = 2 * math.pi * i / n
        w = 2 * math.pi * R / n * 0.45
        o = lib.box(f"reed.{i}", (0.00012, w, h * 2), mat, center=(R + 0.00004, 0, 0))
        lib.transform(o, lib.rot("z", a))


def lettered_edge(it: lib.Item, mat, legend: str) -> None:
    """Tiny raised lettering round the edge, reading along it, feet towards the reverse."""
    size = RIM_TOP * 0.95
    chars = list(legend)
    step = size * 0.78 / R
    for i, ch in enumerate(chars):
        if ch == " ":
            continue
        a = -i * step
        o = lib.text(f"edge.{i}", ch, size, 0.00006, mat, pos=(0, 0, 0), facing=1, bold=1.2)
        n = Vector((math.cos(a), math.sin(a), 0))
        up = Vector((0, 0, 1))
        right = (-n).cross(up)
        m = Matrix((
            (right.x, up.x, n.x, n.x * R),
            (right.y, up.y, n.y, n.y * R),
            (right.z, up.z, n.z, n.z * R),
            (0, 0, 0, 1),
        ))
        lib.transform(o, m)


EDGES = {
    "smith": ("letters", "ЧИСТАГО СЕРЕБРА 9 ГРАММ • 2 ЗОЛОТНИКА 10.5 ДОЛЕЙ •"),
    "eagle": ("letters", "ЧИСТАГО СЕРЕБРА 4 ЗОЛОТНИКА 21 ДОЛЯ • Н•Ф •"),
    "sower": ("reeds", ""),
    "sprinter": ("letters", "СЕРЕБРО 900 • 33.3 • ЛМД • СЕРЕБРО 900 • 33.3 • ЛМД •"),
}


def build(it: lib.Item) -> None:
    it.ao_size = 1024
    emblem = it.model.get("emblem", "smith")
    color = it.color
    gold = emblem == "sower"
    proof = emblem == "sprinter"
    field = lib.material(it, "field", color, metal=1.0, rough=0.09 if proof else (0.22 if gold else 0.3))
    relief = lib.material(it, "relief", lib.shade(color, 0.98), metal=1.0, rough=0.48 if proof else (0.26 if gold else 0.36))
    body(it, field, relief)

    obv = Face(it, 1, relief)
    rev = Face(it, -1, relief)
    if emblem == "smith":
        smith(obv)
        obv.beads(60, S(112), S(2.4))
        state_emblem(rev, "", "")
        rev.arc("ПРОЛЕТАРИИ ВСЕХ СТРАН, СОЕДИНЯЙТЕСЬ!", S(100), S(9), start=math.pi / 2, spacing=0.64)
    elif emblem == "eagle":
        eagle(obv)
        wreath_value(rev)
    elif emblem == "sower":
        sower(obv)
        state_emblem(rev, "", "1977")
    elif emblem == "sprinter":
        sprinter(obv)
        obv.beads(80, S(116), S(1.6))
        state_emblem(rev, "10", "РУБЛЕЙ")
    else:
        obv.poly(lib.star_points(5, S(40), S(16)))

    kind, legend = EDGES.get(emblem, ("reeds", ""))
    if kind == "letters":
        lettered_edge(it, relief, legend)
    else:
        reeded_edge(it, relief)
