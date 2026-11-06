"""
Records (M6): an LP lying on its sleeve, or a bone record (rock and roll cut into
an old x-ray) on its paper envelope.

Placeholder convention (src/render/items.ts RECORD): sleeve 0.314 square × 0.004
centred at (−0.05, 0.02), front +Z (z −0.002…0.002); the disc r 0.15, 1.8 mm
thick, on the sleeve at (0.07, −0.03), its face at z ≈ 0.0041; label r 0.045.
Hotspots: label (0.07, −0.03), runout (0.122, −0.03), grooves (0.17, −0.03) on the
disc face; sleeve (−0.17, 0.14) top left of the cover, back (−0.05, 0.02) behind.
The bone record (model.scale 0.58) is built at the same layout and scaled at
runtime, so its hotspots stay where the def says.

Grooves are track bands (a raised, rougher annulus per track) with a few glossy
hairline rings in them; the gaps between tracks and the run-out are smooth.
"""

from __future__ import annotations

import math
import random

import lib
from kinds import phone as P
from mathutils import Matrix

AO_DISTANCE = 0.006

SLEEVE, ST = 0.314, 0.004
SX, SY = -0.05, 0.02
R, T = 0.15, 0.0018
DX, DY = 0.07, -0.03
LABEL = 0.045
FACE = 0.0041
BOT = FACE - T

F, slab, rr, circle, disc = P.F, P.slab, P.rr, P.circle, P.disc

# Print must stand a few Draco steps proud (14-bit positions over ~0.37 m: ~23 µm).
PRINT = 0.00007
# Track bands stand 0.2 mm proud: a broad band only 70 µm over the face z-fights at counter distance.
BAND = 0.0002


def poly_on(m: Matrix, pts, depth: float, mat, *, z: float = 0.0, bevel: float = 0.0):
    return P.poly_on(m, pts, max(depth, PRINT), mat, z=z, bevel=bevel)


def line_on(m: Matrix, pts, width: float, depth: float, mat, *, z: float = 0.0, closed: bool = False):
    return P.line_on(m, pts, width, max(depth, PRINT), mat, z=z, closed=closed)


def txt(m: Matrix, body: str, size: float, mat, *, x: float = 0.0, y: float = 0.0, z: float = 0.0, depth: float = 0.00002, rot: float = 0.0, bold: float = 0.0, spacing: float = 1.0, align: str = "CENTER", font: str = "Inter.woff2"):
    o = lib.text(P._name("txt"), body, size, max(depth, PRINT), mat, pos=(x, y, z), rot_z=rot, facing=1, bold=bold, spacing=spacing, align=align, font_name=font)
    return P.place(o, m)


def arc_on(m: Matrix, body: str, radius: float, size: float, mat, *, z: float = 0.0, start: float = math.pi / 2, inward: bool = False, spacing: float = 0.7):
    return P.place(lib.arc_text(P._name("arc"), body, radius, size, PRINT, mat, z=z, start=start, inward=inward, facing=1, spacing=spacing), m)


def ring(fm: Matrix, r: float, w: float, z: float, mat, h: float = PRINT) -> None:
    """A flat hairline ring (a thin lathe annulus: far fewer triangles than a stroked circle)."""
    o = lib.lathe(P._name("ring"), [(r - w / 2, z), (r - w / 2, z + h), (r + w / 2, z + h), (r + w / 2, z)], mat, segments=96, axis="z", cap=False)
    lib.auto_smooth(o, 30)  # hard corners: smooth normals round a flat band into a torus
    P.place(o, fm)


def sleeve(it: lib.Item, card) -> None:
    o = lib.box("sleeve", (SLEEVE, SLEEVE, ST), card, center=(SX, SY, 0), bevel=0.0012, bevel_segments=2)
    lib.auto_smooth(o, 40)


def vinyl_disc(it: lib.Item, tracks: list[float], *, label_mat, vinyl, grooves, sheen) -> Matrix:
    """The disc and its track bands; returns the face frame at the disc centre."""
    prof = [(0.0037, BOT), (R - 0.0006, BOT), (R, BOT + 0.0005), (R, FACE + 0.0001), (R - 0.0012, FACE + 0.00025), (R - 0.0035, FACE),
            (0.06, FACE - 0.0001), (LABEL + 0.002, FACE - 0.0001), (LABEL + 0.0005, FACE - 0.00025), (0.0037, FACE - 0.00025), (0.0037, BOT)]
    o = lib.lathe("disc", prof, vinyl, segments=128, axis="z", cap=False)
    lib.auto_smooth(o, 30)
    lib.transform(o, lib.at(DX, DY, 0))
    fm = Matrix.Translation((DX, DY, 0))
    # track bands between run-out (0.06) and lead-in (0.146)
    edges = [0.0605] + tracks + [0.1455]
    for a, b in zip(edges, edges[1:]):
        a2, b2 = a + 0.0007, b - 0.0007
        band = lib.lathe(P._name("band"), [(a2, FACE - 0.0001), (a2, FACE - 0.0001 + BAND), (b2, FACE - 0.0001 + BAND), (b2, FACE - 0.0001)], grooves, segments=128, axis="z", cap=False)
        lib.auto_smooth(band, 30)
        P.place(band, fm)
        for k in range(1, 3):
            rr_ = a2 + (b2 - a2) * k / 3
            ring(fm, rr_, 0.00025, FACE - 0.0001 + BAND, sheen)
    # paper label
    disc(fm, LABEL, FACE - 0.00025, FACE - 0.0002, label_mat, n=96)
    disc(fm, 0.0038, FACE - 0.0003, FACE - 0.00018, lib.material(it, "hole", "#050505", rough=0.6), n=24)
    return fm


def label_text(fm: Matrix, ink, lines: list[tuple[str, float, float]], arc: str, cat: str, side: str) -> None:
    z = FACE - 0.0002
    arc_on(fm, arc, LABEL - 0.006, 0.0042, ink, z=z, spacing=0.7)
    txt(fm, cat, 0.0032, ink, x=-0.022, y=0.0, z=z, rot=0.0)
    txt(fm, side, 0.0036, ink, x=0.022, y=0.0, z=z, bold=0.4)
    for s, y, size in lines:
        txt(fm, s, size, ink, y=y, z=z)


def runout(fm: Matrix, mat, text: str) -> None:
    """A hand-scratched matrix number in the run-out, at the runout hotspot (+x of the centre)."""
    txt(fm @ lib.at(0.052, 0.0, 0), text, 0.0019, mat, z=FACE - 0.0001, rot=math.pi / 2, depth=0.00001, font="DejaVuSansMono.woff2")


def back_text(it: lib.Item, ink, lines: list[str], *, size: float = 0.0045) -> None:
    bm = F("back", (SX, SY, -ST / 2))
    for i, s in enumerate(lines):
        txt(bm, s, size if i else size * 1.6, ink, y=0.11 - i * size * 2.0, bold=0.4 if i == 0 else 0.0)


def estrada(it: lib.Item) -> None:
    card = lib.material(it, "card", "#e7ddc4", rough=0.85)
    ink = lib.material(it, "ink", "#2a2620", rough=0.6, ao=False)
    art = lib.material(it, "art", it.color, rough=0.8)
    skin = lib.material(it, "skin", "#e3b48e", rough=0.8)
    hair = lib.material(it, "hair", "#4a2e1c", rough=0.8)
    shirt = lib.material(it, "shirt", "#f1ece0", rough=0.8)
    red = lib.material(it, "red", "#b5262a", rough=0.7)
    sleeve(it, card)
    fm = F("front", (SX, SY, ST / 2))
    poly_on(fm, rr(SLEEVE - 0.008, SLEEVE - 0.008, 0.002, 3), 0.00003, art)
    # the singer: big hair, a smile, a wide white collar on a red shirt (left of the disc)
    sx, sy = -0.09, 0.0
    poly_on(fm @ lib.at(sx, sy - 0.07, 0), [(-0.06, -0.06), (0.06, -0.06), (0.05, 0.03), (-0.05, 0.03)], 0.00005, red, z=0.00003)
    for s in (-1, 1):
        poly_on(fm @ lib.at(sx, sy - 0.04, 0), [(0, 0.0), (s * 0.045, 0.002), (s * 0.03, -0.045)][:: s], 0.00006, shirt, z=0.00008)
    poly_on(fm @ lib.at(sx, sy + 0.035, 0), [(0.05 * math.cos(t), 0.058 * math.sin(t)) for t in [2 * math.pi * i / 40 for i in range(40)]], 0.00005, hair, z=0.00003)
    poly_on(fm @ lib.at(sx, sy + 0.02, 0), [(0.032 * math.cos(t), 0.042 * math.sin(t)) for t in [2 * math.pi * i / 40 for i in range(40)]], 0.00005, skin, z=0.00008)
    line_on(fm @ lib.at(sx, sy + 0.01, 0), [(0.014 * math.cos(t), -0.006 * math.sin(t)) for t in [math.pi * i / 10 for i in range(11)]], 0.0016, 0.00002, red, z=0.00013)
    for ex in (-0.011, 0.011):
        poly_on(fm @ lib.at(sx + ex, sy + 0.03, 0), circle(0.0028, 12), 0.00002, hair, z=0.00013)
    # title strip along the top (above the disc), the price top left
    txt(fm, "ПЕСНИ  ГОДА", 0.016, ink, x=0.02, y=0.132, z=0.00003, bold=0.8, spacing=1.15)
    txt(fm, "ВАЛЕНТИНА ЗОРИНА  •  ЭСТРАДНЫЙ ОРКЕСТР", 0.0056, ink, x=0.03, y=0.112, z=0.00003)
    txt(fm, "2 руб. 15 коп.", 0.0062, ink, x=-0.12, y=0.12, z=0.00003, bold=0.3)
    txt(fm, "ЛИРАФОН", 0.007, ink, x=-0.12, y=-0.135, z=0.00003, bold=0.6, spacing=1.2)
    # back: the track list and the small print
    back_text(it, ink, ["ВАЛЕНТИНА ЗОРИНА", "1. Белые ночи над Мостом", "2. Июльский дождь", "3. Свадебный вальс", "4. Песня о Мостограде",
                        "", "«Лирафон»  1979", "С60—12417   Цена 2 руб. 15 коп."])
    vinyl = lib.material(it, "vinyl", "#0b0b0c", rough=0.22)
    grooves = lib.material(it, "grooves", "#0f0f10", rough=0.34)
    sheen = lib.material(it, "sheen", "#202022", rough=0.12, ao=False)
    blue = lib.material(it, "label", "#2a4a9c", rough=0.6)
    silver = lib.material(it, "label_ink", "#e6e3da", rough=0.5, ao=False)
    d = vinyl_disc(it, [0.073, 0.088, 0.104, 0.12, 0.134], label_mat=blue, vinyl=vinyl, grooves=grooves, sheen=sheen)
    label_text(d, silver, [("ВАЛЕНТИНА ЗОРИНА", -0.012, 0.0038), ("Песни года", -0.019, 0.0034), ("33 об/мин", 0.014, 0.003)], "ЛИРАФОН • МОСТОГРАД", "С60—12417", "1")
    runout(d, lib.material(it, "scratch", "#2b2b2e", rough=0.5, ao=False), "С60-12417 1-3")


def rock(it: lib.Item) -> None:
    card = lib.material(it, "card", "#d9d2c0", rough=0.85)
    ink = lib.material(it, "ink", "#1b1b1c", rough=0.6, ao=False)
    art = lib.material(it, "art", it.color, rough=0.82)
    dark = lib.material(it, "dark", "#2b2d30", rough=0.8)
    foxing = lib.material(it, "foxing", "#b49f78", rough=0.9, ao=False)
    sleeve(it, card)
    fm = F("front", (SX, SY, ST / 2))
    poly_on(fm, rr(SLEEVE - 0.006, SLEEVE - 0.006, 0.002, 3), 0.00003, art)
    # the raised drawbridge: two towers, the leaves up, the river below
    for s in (-1, 1):
        poly_on(fm @ lib.at(s * 0.08, -0.04, 0), [(-0.018, -0.05), (0.018, -0.05), (0.018, 0.03), (0, 0.05), (-0.018, 0.03)], 0.00005, dark, z=0.00003)
        poly_on(fm @ lib.at(s * 0.062, -0.07, 0), [(0, 0.0), (0, 0.012), (-s * 0.05, 0.1), (-s * 0.056, 0.094)][:: s], 0.00005, dark, z=0.00003)
    for k in range(4):
        line_on(fm, [(-0.14 + 0.02 * i, -0.11 - k * 0.01 + (0.003 if i % 2 else -0.003)) for i in range(15)], 0.0016, 0.00002, dark, z=0.00008)
    txt(fm, "РАЗВОДНЫЕ  МОСТЫ", 0.017, ink, x=0.0, y=0.13, z=0.00003, bold=1.2, spacing=1.25, font="DejaVuSansMono.woff2")
    txt(fm, "ЛИРАФОН  1987", 0.006, ink, x=-0.12, y=0.112, z=0.00003, spacing=1.2)
    rnd = random.Random(it.id)
    for k in range(14):
        x, y = rnd.uniform(-0.15, 0.15), rnd.uniform(-0.15, 0.15)
        poly_on(fm @ lib.at(x, y, 0), circle(rnd.uniform(0.001, 0.003), 10), 0.00001, foxing, z=0.00008)
    back_text(it, ink, ["РАЗВОДНЫЕ МОСТЫ", "1. Разводной мост", "2. Канатная улица", "3. Ночной трамвай", "4. Последний паром",
                        "", "«Лирафон»  1987   Тираж 50 000", "Цена 2 руб. 50 коп."])
    vinyl = lib.material(it, "vinyl", "#0b0b0c", rough=0.24)
    grooves = lib.material(it, "grooves", "#0f0f10", rough=0.36)
    worn = lib.material(it, "worn", "#232325", rough=0.5)
    sheen = lib.material(it, "sheen", "#202022", rough=0.12, ao=False)
    white = lib.material(it, "label", "#ece9e0", rough=0.6)
    d = vinyl_disc(it, [0.0745, 0.09, 0.108, 0.125], label_mat=white, vinyl=vinyl, grooves=grooves, sheen=sheen)
    # the first track (outermost) a little greyer: someone's favourite
    band = lib.lathe("favourite", [(0.1252, FACE - 0.0001), (0.1252, FACE + 0.00001), (0.1448, FACE + 0.00001), (0.1448, FACE - 0.0001)], worn, segments=128, axis="z", cap=False)
    P.place(band, d)
    label_text(d, ink, [("РАЗВОДНЫЕ МОСТЫ", -0.010, 0.0036), ("1. Разводной мост", -0.017, 0.0026), ("2. Канатная улица   3. Ночной трамвай", -0.022, 0.0024), ("1987", 0.014, 0.003)], "ЛИРАФОН • МОСТОГРАД", "С60—25091", "А")
    runout(d, lib.material(it, "scratch", "#2b2b2e", rough=0.5, ao=False), "С60-25091 1-1")


def bone(it: lib.Item) -> None:
    paper = lib.material(it, "envelope", "#9a7a52", rough=0.9)
    pencil = lib.material(it, "pencil", "#4a4740", rough=0.7, ao=False)
    film = lib.material(it, "film", "#3e4a52", rough=0.25, alpha=0.82)
    bonew = lib.material(it, "bone", "#7f8d94", rough=0.3, alpha=0.85)
    sheen = lib.material(it, "sheen", "#7d8a92", rough=0.12, ao=False)
    scorch = lib.material(it, "scorch", "#5a3a1e", rough=0.8)
    sleeve(it, paper)
    fm = F("front", (SX, SY, ST / 2))
    # the envelope's flap seam
    line_on(fm, [(-SLEEVE / 2 + 0.01, 0.12), (SLEEVE / 2 - 0.01, 0.12)], 0.0012, 0.00003, lib.material(it, "seam", "#86683f", rough=0.9))
    txt(fm, "BLUE MOON BOOGIE", 0.0085, pencil, x=-0.06, y=0.135, z=0.00003, rot=0.03)
    line_on(fm, [(-0.15, 0.134), (0.03, 0.14)], 0.0009, 0.00002, pencil, z=0.00004)
    txt(fm, "Лунный буги", 0.009, pencil, x=-0.09, y=0.105, z=0.00003, rot=-0.02)
    # the film disc: snipped round, uneven
    rnd = random.Random(it.id)
    outline = []
    n = 72
    for i in range(n):
        t = 2 * math.pi * i / n
        rr_ = R - 0.002 - (0.0015 if i % 3 == 0 else 0.0) - rnd.uniform(0, 0.0015)
        outline.append((DX + rr_ * math.cos(t), DY + rr_ * math.sin(t)))
    lib.polygon("film", outline, 0.0003, film, z=FACE - 0.0003, facing=1)
    dm = Matrix.Translation((DX, DY, 0))
    # the x-ray: a spine, ribs curving off it, a collarbone, grooves cut across it all
    line_on(dm, [(0.0, -0.12), (0.0, 0.11)], 0.012, 0.00003, bonew, z=FACE)
    for k in range(8):
        y = 0.075 - k * 0.019
        for s in (-1, 1):
            line_on(dm, [(s * 0.008, y), (s * 0.045, y + 0.01), (s * 0.085, y - 0.004), (s * 0.1, y - 0.022)], 0.0042, 0.00003, bonew, z=FACE)
    for s in (-1, 1):
        line_on(dm, [(s * 0.008, 0.1), (s * 0.05, 0.106), (s * 0.08, 0.097)], 0.005, 0.00003, bonew, z=FACE)
    for k in range(9):
        ring(dm, 0.06 + k * 0.009, 0.00025, FACE + 0.00003, sheen)
    # the burned centre hole
    disc(dm, 0.0075, FACE - 0.0003, FACE + 0.00002, scorch, n=24)
    disc(dm, 0.0038, FACE - 0.00035, FACE + 0.00004, lib.material(it, "hole", "#0a0a0a", rough=0.6), n=16)


BUILDERS = {"lp_liraphon_estrada": estrada, "lp_liraphon_rock": rock, "lp_bone_record": bone}


def build(it: lib.Item) -> None:
    it.ao_size = 1024
    P._n[0] = 0
    BUILDERS[it.id](it)
