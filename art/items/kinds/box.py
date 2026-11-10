"""
Box-kind items (M6): anything that is, at heart, a box with a front. Tape decks, a
video recorder, games consoles, a turntable under its lid, cameras that are not
the Zenit, a zoom lens, a tablet and a music player, a car stereo and a dashcam,
and the two gold pieces that come in odd shapes (four dental crowns, a bar in its
bank card).

Placeholder convention (src/render/items.ts): `model.size` [w, h, d] centred on
the origin, front +Z; ids with `model.rest = "upright"` stand on −Y. Each id has
its own function below (BUILDERS); the hotspots in the defs sit on the faces
named in their labels, so every function keeps those faces where the size says.

The phone kind's helpers do the work: rounded outlines lofted along Z (`slab`),
features built flat in a face frame (`F`) and moved onto it, boolean pockets
(`pocket` + `cut`) whose walls take the dark material.
"""

from __future__ import annotations

import math
import random

import lib
from kinds import phone as P
from mathutils import Matrix

AO_DISTANCE = 0.004

F, slab, rr, rr_shape, pill, circle, circle_shape = P.F, P.slab, P.rr, P.rr_shape, P.pill, P.circle, P.circle_shape
pocket, cut, disc, holes, crosshead = P.pocket, P.cut, P.disc, P.holes, P.crosshead

# Print (text, lines, flat decals) must stand proud by a few Draco steps or it
# collapses into its surface when packed (14-bit positions over the item's longest
# side: ~26 µm on a 43 cm deck). `setup` sets this per item; see docs/04 § laptop.
PRINT = 0.00006


_P_POLY_ON, _P_LINE_ON = P.poly_on, P.line_on


def poly_on(m: Matrix, pts, depth: float, mat, *, z: float = 0.0, bevel: float = 0.0):
    return _P_POLY_ON(m, pts, max(depth, PRINT), mat, z=z, bevel=bevel)


class thick_print:
    """While borrowing phone.py drawings (the fruit logo), thicken their print too."""

    def __enter__(self):
        P.poly_on = poly_on
        P.line_on = line_on

    def __exit__(self, *exc):
        P.poly_on, P.line_on = _P_POLY_ON, _P_LINE_ON


def line_on(m: Matrix, pts, width: float, depth: float, mat, *, z: float = 0.0, closed: bool = False):
    return _P_LINE_ON(m, pts, width, max(depth, PRINT), mat, z=z, closed=closed)


# ---------------------------------------------------------------------------
# Helpers


def txt(m: Matrix, body: str, size: float, mat, *, x: float = 0.0, y: float = 0.0, z: float = 0.0, depth: float = 0.00003, rot: float = 0.0, bold: float = 0.0, spacing: float = 1.0, align: str = "CENTER", font: str = "Inter.woff2"):
    o = lib.text(P._name("txt"), body, size, max(depth, PRINT), mat, pos=(x, y, z), rot_z=rot, facing=1, bold=bold, spacing=spacing, align=align, font_name=font)
    return P.place(o, m)


def arc_on(m: Matrix, body: str, radius: float, size: float, mat, *, z: float = 0.0, start: float = math.pi / 2, inward: bool = False, depth: float = 0.00003, spacing: float = 0.7):
    o = lib.arc_text(P._name("arc"), body, radius, size, max(depth, PRINT), mat, z=z, start=start, inward=inward, facing=1, spacing=spacing)
    return P.place(o, m)


def cab(w: float, h: float, z0: float, z1: float, r: float, mat, *, bev: float = 0.0, front=None, back=None, name: str = "cab"):
    """A rounded-rectangle block from z0 to z1 (outline w × h in XY), bevelled at both ends."""
    b = min(bev, (z1 - z0) / 3, r * 0.9 if r else bev)
    rings = [(b, z0, mat), (0, z0 + b, mat), (0, z1 - b, mat), (b, z1, mat)] if b > 0 else [(0, z0, mat), (0, z1, mat)]
    return slab(rr_shape(w, h, r, 6), rings, cap_lo=back or mat, cap_hi=front or mat, name=name)


def plate(m: Matrix, w: float, h: float, t: float, mat, *, r: float = 0.0005, bev: float = 0.0002, z: float = 0.0):
    """A thin rounded plate standing out of a face (frame m), from z to z + t."""
    b = min(bev, t / 2, r * 0.9 if r else bev)
    rings = [(0, z - 0.0003, mat), (0, z + t - b, mat), (b, z + t, mat)] if b > 0 else [(0, z - 0.0003, mat), (0, z + t, mat)]
    return slab(lambda i: rr(w - 2 * i, h - 2 * i, max(r - i, 0.00005), 4), rings, cap_lo=mat, cap_hi=mat, m=m)


def knob(m: Matrix, r: float, h: float, mat, cap=None, *, skirt: float = 0.0, n: int = 32, ink=None):
    """A round knob: a skirt (optional), the body with a rounded top, an index line."""
    if skirt:
        disc(m, r + skirt, -0.0002, h * 0.25, mat, n=n)
    slab(circle_shape(r, n), [(0, -0.0002, mat), (0, h * 0.85, mat), (r * 0.12, h, mat)], cap_lo=mat, cap_hi=cap or mat, m=m)
    line_on(m, [(0, r * 0.25), (0, r * 0.8)], max(r * 0.08, 0.0003), 0.00004, ink or mat, z=h)


def keyrow(m: Matrix, n: int, w: float, h: float, gap: float, mat, *, t: float = 0.004, labels=(), ink=None, size=0.0025):
    x0 = -(n - 1) * (w + gap) / 2
    for i in range(n):
        km = m @ lib.at(x0 + i * (w + gap), 0, 0)
        plate(km, w, h, t, mat, r=min(w, h) * 0.12, bev=0.0006)
        if i < len(labels) and ink is not None:
            txt(km, labels[i], size, ink, z=t, depth=0.00002)


def vents(m: Matrix, n: int, length: float, pitch: float, mat, *, width: float = 0.0016, depth: float = 0.00005, vertical: bool = False):
    for i in range(n):
        o = (i - (n - 1) / 2) * pitch
        pts = [(o, -length / 2), (o, length / 2)] if vertical else [(-length / 2, o), (length / 2, o)]
        line_on(m, pts, width, depth, mat)


def rca(m: Matrix, x: float, y: float, ring, dark, colour):
    disc(m @ lib.at(x, y, 0), 0.0045, 0.0, 0.0008, ring, n=20)
    disc(m @ lib.at(x, y, 0), 0.0032, 0.0008, 0.008, ring, n=20)
    disc(m @ lib.at(x, y, 0), 0.0016, 0.008, 0.0081, dark, n=16)
    disc(m @ lib.at(x, y, 0), 0.0055, -0.0001, 0.00005, colour, n=20)


def feet(w: float, d: float, y: float, mat, *, r: float = 0.008, h: float = 0.006, inset: float = 0.03):
    for sx in (-1, 1):
        for sz in (-1, 1):
            disc(F("bottom", (sx * (w / 2 - inset), y, sz * (d / 2 - inset))), r, -0.0003, h, mat, n=24, round_top=0.001)


def screws_on(m: Matrix, pts, head, dark, r: float = 0.0018):
    for x, y in pts:
        crosshead(m @ lib.at(x, y, 0), head, dark, r=r)


def sticker(m: Matrix, w: float, h: float, mat, ink, lines, *, size: float = 0.0022, z: float = 0.0):
    poly_on(m, rr(w, h, 0.001, 3), 0.00008, mat, z=z)
    n = len(lines)
    for i, line in enumerate(lines):
        y = (n - 1) / 2 * size * 1.6 - i * size * 1.6
        txt(m, line, size * (1.25 if i == 0 else 1.0), ink, y=y, z=z + 0.00008, depth=0.00001, bold=0.4 if i == 0 else 0.0)


def mats(it: lib.Item) -> dict:
    return {
        "dark": lib.material(it, "dark", "#111112", metal=0.2, rough=0.6),
        "glass": lib.material(it, "glass", "#060708", rough=0.05, ao=False),
        "ink": lib.material(it, "ink", "#e9e8e2", rough=0.5, ao=False),
        "black_ink": lib.material(it, "black_ink", "#151515", rough=0.5, ao=False),
        "chrome": lib.material(it, "chrome", "#cfd1d4", metal=1.0, rough=0.12),
        "alu": lib.material(it, "alu", "#b9b9b6", metal=0.9, rough=0.32),
        "rubber": lib.material(it, "rubber", "#1a1a1a", rough=0.85),
        "paper": lib.material(it, "paper", "#ece6d6", rough=0.85),
        "steel": lib.material(it, "steel", "#8f9094", metal=1.0, rough=0.38),
    }


# ---------------------------------------------------------------------------
# Hi-fi: two cassette decks, a video recorder, a turntable


def cassette_window(m: Matrix, w: float, h: float, M: dict, *, heads: int = 0) -> None:
    """A smoked door window with a cassette behind it (shell, label, two hubs, the tape)."""
    smoke = M.get("smoke")
    shell = material_get(M, "shell", "#2a2a2c")
    poly_on(m, rr(w * 0.82, h * 0.7, 0.002, 4), 0.0006, shell, z=-0.004)
    poly_on(m, rr(w * 0.62, h * 0.3, 0.001, 3), 0.0001, M["paper"], z=-0.0034, )
    for sx in (-1, 1):
        disc(m @ lib.at(sx * w * 0.18, -h * 0.02, 0), h * 0.12, -0.0034, -0.0032, M["dark"], n=24)
        disc(m @ lib.at(sx * w * 0.18, -h * 0.02, 0), h * 0.05, -0.0032, -0.003, M["paper"], n=6)
    if heads:
        for i in range(heads):
            plate(m @ lib.at((i - (heads - 1) / 2) * w * 0.12, -h * 0.36, -0.0035), w * 0.07, h * 0.12, 0.0016, M["chrome"], r=0.0008)
    plate(m, w, h, 0.0012, smoke, r=0.003, bev=0.0004)


def material_get(M: dict, key: str, colour: str, **kw):
    if key not in M:
        M[key] = lib.material(M["_it"], key, colour, **kw)
    return M[key]


def meter(m: Matrix, w: float, h: float, M: dict, label: str) -> None:
    face = material_get(M, "meter_face", "#e8dcb4", rough=0.6, ao=False, emissive="#4a3a10")
    plate(m, w + 0.004, h + 0.004, 0.0004, M["dark"], r=0.0015)
    poly_on(m, rr(w, h, 0.001, 3), 0.0001, face, z=0.0004)
    cx, cy = 0, -h * 0.42
    for k in range(11):
        a = math.radians(130 - k * 8)
        r0, r1 = h * 0.62, h * (0.72 if k % 5 == 0 else 0.68)
        line_on(m, [(cx + r0 * math.cos(a), cy + r0 * math.sin(a)), (cx + r1 * math.cos(a), cy + r1 * math.sin(a))], 0.0004, 0.00002, M["black_ink"], z=0.0005)
    red = material_get(M, "red", "#b3221c", rough=0.5, ao=False)
    line_on(m, [(cx + h * 0.66 * math.cos(math.radians(a)), cy + h * 0.66 * math.sin(math.radians(a))) for a in range(58, 44, -2)], 0.0009, 0.00002, red, z=0.0005)
    line_on(m, [(cx, cy), (cx + h * 0.66 * math.cos(math.radians(108)), cy + h * 0.66 * math.sin(math.radians(108)))], 0.0004, 0.00004, M["black_ink"], z=0.00055)
    txt(m, label, h * 0.13, M["black_ink"], y=-h * 0.3, z=0.0005, depth=0.00001)
    poly_on(m, rr(w, h, 0.001, 3), 0.0003, M["glass_clear"], z=0.0007)


def hifi_case(it, w, h, d, M, *, front_mat, case_mat, front_t=0.006):
    case = cab(w - 0.002, h, -d / 2, d / 2 - front_t, 0.002, case_mat, bev=0.001)
    panel = cab(w, h, d / 2 - front_t, d / 2, 0.0015, front_mat, bev=0.0006)
    return case, panel


def deck_back(m: Matrix, M: dict, lines, *, price_plate=True):
    """Back plate of a deck: RCA pairs, the mains lead, the riveted or printed plate."""
    for i, (x, col) in enumerate(((-0.06, "#c9c9c4"), (-0.045, "#b3221c"), (-0.09, "#c9c9c4"), (-0.075, "#b3221c"))):
        rca(m, x - 0.06, 0.012 if i < 2 else -0.012, M["chrome"], M["dark"], material_get(M, f"rca{i}", col, rough=0.5))
    disc(m @ lib.at(0.17, -0.02, 0), 0.0045, 0.0, 0.012, M["rubber"], n=16)
    if price_plate:
        pm = m @ lib.at(0.05, 0.0, 0)
        plate(pm, 0.11, 0.05, 0.0006, M["alu"], r=0.002)
        for sx in (-1, 1):
            for sy in (-1, 1):
                disc(pm @ lib.at(sx * 0.05, sy * 0.02, 0.0006), 0.0015, 0.0, 0.0006, M["chrome"], n=12, round_top=0.0004)
        n = len(lines)
        for i, line in enumerate(lines):
            txt(pm, line, 0.0045 if i == 0 else 0.0036, M["black_ink"], y=(n - 1) / 2 * 0.0075 - i * 0.0075, z=0.0006, depth=0.00012, bold=0.3 if i == 0 else 0.0)


def deck_rubezh(it: lib.Item) -> None:
    w, h, d = it.size
    M = setup(it)
    front = lib.material(it, "front", it.color, metal=0.85, rough=0.36)
    case = lib.material(it, "case", "#3a3a38", metal=0.6, rough=0.55)
    M["smoke"] = lib.material(it, "smoke", "#2a2420", rough=0.06, alpha=0.75, ao=False)
    M["glass_clear"] = lib.material(it, "glass_clear", "#dfe6e8", rough=0.04, alpha=0.2, ao=False)
    hifi_case(it, w, h, d, M, front_mat=front, case_mat=case)
    fz = d / 2
    fm = lambda x, y: F("front", (x, y, fz))
    # badge and the quality mark
    txt(fm(-0.17, 0.035), "РУБЕЖ М-302", 0.0085, M["chrome"], depth=0.0006, bold=0.6, spacing=1.1)
    pent = [(0.006 * math.cos(math.pi / 2 + 2 * math.pi * k / 5), 0.006 * math.sin(math.pi / 2 + 2 * math.pi * k / 5)) for k in range(5)]
    poly_on(fm(-0.12, 0.035), pent, 0.0005, M["chrome"], bevel=0.0002)
    txt(fm(-0.12, 0.035), "К", 0.0055, M["dark"], z=0.0005, depth=0.00005, bold=0.6)
    txt(fm(-0.17, 0.02), "СТЕРЕОФОНИЧЕСКИЙ КАССЕТНЫЙ МАГНИТОФОН", 0.0028, M["black_ink"], depth=0.00002)
    # power key and the cassette door
    plate(fm(-0.185, -0.03), 0.022, 0.012, 0.004, M["dark"], r=0.001, bev=0.0005)
    txt(fm(-0.185, -0.017), "СЕТЬ", 0.0026, M["black_ink"], depth=0.00002)
    cassette_window(fm(-0.08, -0.005), 0.13, 0.072, M)
    # transport keys under the door
    keyrow(fm(-0.08, -0.049), 6, 0.018, 0.010, 0.0025, M["alu"], t=0.005, labels=("<<", ">", ">>", "СТОП", "II", "ЗАП"), ink=M["black_ink"], size=0.0032)
    # the meters, and the knobs below them
    for sx in (-1, 1):
        meter(fm(0.1 + sx * 0.03, 0.025), 0.05, 0.03, M, "dB")
    txt(fm(0.1, 0.048), "ЛЕВЫЙ          ПРАВЫЙ", 0.0024, M["black_ink"], depth=0.00002)
    for i, (lab, x) in enumerate((("УРОВЕНЬ", 0.06), ("БАЛАНС", 0.1), ("ТЕЛЕФОН", 0.14), ("Fe/Cr", 0.18))):
        knob(fm(x, -0.025), 0.009, 0.012, M["alu"], skirt=0.002)
        txt(fm(x, -0.044), lab, 0.0024, M["black_ink"], depth=0.00002)
    disc(fm(0.18, 0.04), 0.0025, -0.0001, 0.0006, material_get(M, "lamp", "#d6382a", rough=0.3, emissive="#5a0d08"), n=16)
    # case: vents on the lid, screws at the back, feet
    vents(F("top", (0.08, h / 2, -0.05)), 12, 0.12, 0.008, M["dark"], width=0.003)
    deck_back(F("back", (0, 0, -d / 2)), M, ("РУБЕЖ М-302", "№ 0417735   1986", "ЦЕНА 380 руб.", "~220 В  50 Гц  25 Вт"))
    feet(w, d, -h / 2, M["rubber"])


def deck_nakashima(it: lib.Item) -> None:
    w, h, d = it.size
    M = setup(it)
    front = lib.material(it, "front", it.color, metal=0.6, rough=0.4)
    case = lib.material(it, "case", "#1a1a1b", metal=0.6, rough=0.5)
    M["smoke"] = lib.material(it, "smoke", "#15171a", rough=0.05, alpha=0.7, ao=False)
    hifi_case(it, w, h, d, M, front_mat=front, case_mat=case)
    fz = d / 2
    fm = lambda x, y: F("front", (x, y, fz))
    bp = fm(-0.17, 0.04)
    plate(bp, 0.07, 0.014, 0.0007, M["alu"], r=0.001)
    txt(bp, "NAKASHIMA", 0.0068, M["black_ink"], z=0.0007, depth=0.00004, bold=0.6, spacing=1.15)
    txt(fm(-0.17, 0.027), "3 HEAD  CASSETTE DECK  CX-7", 0.0028, M["ink"], depth=0.00002)
    txt(fm(-0.17, 0.021), "MADE IN JAPAN", 0.0024, M["ink"], depth=0.00002, spacing=1.2)
    plate(fm(-0.19, -0.035), 0.02, 0.01, 0.004, M["alu"], r=0.001, bev=0.0005)
    txt(fm(-0.19, -0.023), "POWER", 0.0024, M["ink"], depth=0.00002)
    cassette_window(fm(-0.08, -0.005), 0.13, 0.075, M, heads=3)
    # fluorescent level display and the counter
    disp = fm(0.11, 0.03)
    plate(disp, 0.15, 0.024, 0.0005, M["glass"], r=0.001)
    cyan = material_get(M, "vfd", "#59e0d8", rough=0.4, ao=False, emissive="#1b6f6a")
    for row, y in enumerate((0.004, -0.004)):
        for k in range(18):
            poly_on(disp @ lib.at(-0.06 + k * 0.0052, y, 0.0005), rr(0.0036, 0.004, 0.0003, 2), 0.00002, cyan if k < 13 - row * 2 else M["dark"])
    txt(disp, "L", 0.003, cyan, x=-0.068, y=0.004, z=0.0005, depth=0.00002)
    txt(disp, "R", 0.003, cyan, x=-0.068, y=-0.004, z=0.0005, depth=0.00002)
    # soft-touch transport keys
    keyrow(fm(0.11, -0.035), 6, 0.016, 0.008, 0.003, M["rubber"], t=0.003, labels=("<<", "<", "STOP", ">", ">>", "REC"), ink=M["ink"], size=0.003)
    for i, x in enumerate((0.05, 0.08, 0.17, 0.2)):
        knob(fm(x, 0.0), 0.0075, 0.012, M["alu"])
    txt(fm(0.065, -0.012), "REC LEVEL", 0.0023, M["ink"], depth=0.00002)
    txt(fm(0.185, -0.012), "OUTPUT   BIAS", 0.0023, M["ink"], depth=0.00002)
    vents(F("top", (0.08, h / 2, -0.06)), 14, 0.12, 0.007, M["dark"], width=0.0025)
    deck_back(F("back", (0, 0, -d / 2)), M, ("NAKASHIMA ELECTRIC CO., LTD.", "MODEL CX-7   No. 7310482", "AC 220 V  50 Hz  30 W", "TOKYO  JAPAN"))
    feet(w, d, -h / 2, M["rubber"])


def vhs_tosaki(it: lib.Item) -> None:
    w, h, d = it.size
    M = setup(it)
    body = lib.material(it, "body", it.color, metal=0.4, rough=0.45)
    case, panel = hifi_case(it, w, h, d, M, front_mat=body, case_mat=lib.material(it, "case", "#202022", metal=0.6, rough=0.5), front_t=0.008)
    fz = d / 2
    fm = lambda x, y: F("front", (x, y, fz))
    txt(fm(-0.13, 0.025), "TOSAKI", 0.009, M["ink"], depth=0.00003, bold=0.8, spacing=1.2)
    txt(fm(-0.13, 0.012), "VR-80  HQ", 0.0045, M["ink"], depth=0.00002, spacing=1.15)
    txt(fm(-0.13, 0.004), "VIDEO CASSETTE RECORDER  PAL/SECAM", 0.0022, M["ink"], depth=0.00002)
    # cassette flap: a sprung plate in a dark surround
    flap = fm(-0.02, 0.01)
    poly_on(flap, rr(0.2, 0.036, 0.002, 4), 0.0003, M["dark"])
    plate(flap, 0.192, 0.028, 0.0012, body, r=0.0015, bev=0.0004, z=0.0003)
    txt(flap, "VHS", 0.006, M["ink"], z=0.0015, depth=0.00002, bold=1.0, x=0.075)
    # display and buttons
    disp = fm(0.11, 0.016)
    plate(disp, 0.08, 0.022, 0.0004, M["glass"], r=0.001)
    green = material_get(M, "vfd", "#7ee08a", rough=0.4, ao=False, emissive="#2a6a30")
    txt(disp, "12:00", 0.011, green, z=0.0004, depth=0.00002, font="DejaVuSansMono.woff2")
    keyrow(fm(0.11, -0.016), 5, 0.012, 0.006, 0.003, M["dark"], t=0.0025)
    txt(fm(0.11, -0.026), "REW   PLAY   FF   STOP   REC", 0.0022, M["ink"], depth=0.00002)
    plate(fm(-0.155, -0.025), 0.022, 0.01, 0.003, M["dark"], r=0.001, bev=0.0004)
    txt(fm(-0.155, -0.035), "POWER", 0.0022, M["ink"], depth=0.00002)
    vents(F("top", (0.07, h / 2, -0.05)), 10, 0.1, 0.008, M["dark"], width=0.0028)
    bk = F("back", (0, 0, -d / 2))
    for x in (-0.12, -0.09):
        disc(bk @ lib.at(x, 0.01, 0), 0.006, 0.0, 0.009, M["chrome"], n=20)
        disc(bk @ lib.at(x, 0.01, 0), 0.0022, 0.009, 0.0091, M["dark"], n=16)
    plate(bk @ lib.at(-0.04, 0.0, 0), 0.05, 0.014, 0.005, M["dark"], r=0.001)
    txt(bk @ lib.at(-0.04, 0.012, 0), "EURO AV", 0.0028, M["ink"], depth=0.00002)
    sk = bk @ lib.at(0.06, 0.0, 0)
    sticker(sk, 0.07, 0.04, M["paper"], M["black_ink"], ["TOSAKI  VR-80", "PAL / SECAM   220-240 V ~ 50 Hz", "SERIAL No. 80H21194", "MADE IN TOSAKI WORKS"], size=0.0027)
    holo = material_get(M, "holo", "#c9d2dc", metal=1.0, rough=0.15)
    poly_on(sk @ lib.at(0.026, -0.012, 0), circle(0.005, 24), 0.0001, holo, z=0.0001)
    disc(bk @ lib.at(0.15, -0.02, 0), 0.004, 0.0, 0.012, M["rubber"], n=16)
    feet(w, d, -h / 2, M["rubber"], r=0.007, h=0.005)


def turntable(it: lib.Item) -> None:
    w, h, d = it.size
    M = setup(it)
    wood = lib.material(it, "wood", it.color, rough=0.55)
    top_m = lib.material(it, "deck", "#c9c7c0", metal=0.85, rough=0.35)
    lid = lib.material(it, "lid", "#3a2c24", rough=0.04, alpha=0.38, ao=False)
    y0, y_plinth = -h / 2, -0.01
    # plinth (cab is centred on y = 0)
    lib.transform(cab(w, y_plinth - y0, -d / 2, d / 2, 0.003, wood, bev=0.002, name="plinth"), lib.at(0, (y0 + y_plinth) / 2, 0))
    # top plate
    tp = F("top", (0, y_plinth, 0))
    poly_on(tp, rr(w - 0.012, d - 0.012, 0.004, 4), 0.0012, top_m)
    yt = y_plinth + 0.0012
    # platter with a ribbed rubber mat, spindle
    pc = (-0.05, 0.0)
    pm = F("top", (pc[0], yt, pc[1]))
    slab(circle_shape(0.152, 96), [(0, 0.0, top_m), (0, 0.012, top_m), (0.001, 0.013, top_m)], cap_lo=top_m, cap_hi=M["rubber"], m=pm)
    for k in range(9):
        line_on(pm, circle(0.06 + k * 0.011, 96), 0.0016, 0.0004, M["rubber"], z=0.013, closed=True)
    disc(pm, 0.0035, 0.013, 0.03, M["chrome"], n=20, round_top=0.001)
    # tonearm: pivot, straight arm, headshell, counterweight
    piv = (0.15, -0.09)  # x, z on the top plate
    pv = F("top", (piv[0], yt, piv[1]))
    disc(pv, 0.018, 0.0, 0.006, M["alu"], n=40)
    disc(pv, 0.008, 0.006, 0.03, M["chrome"], n=24)
    arm_y = yt + 0.028
    tip = (0.04, 0.09)
    ax, az = tip[0] - piv[0], tip[1] - piv[1]
    L = math.hypot(ax, az)
    tube = lib.cylinder("arm", 0.0035, L, M["chrome"], axis="z", segments=16)
    ang = math.atan2(ax, az)
    lib.transform(tube, lib.at((piv[0] + tip[0]) / 2, arm_y, (piv[1] + tip[1]) / 2) @ lib.rot("y", ang))
    hs = lib.box("headshell", (0.016, 0.006, 0.03), M["dark"], center=(0, 0, 0), bevel=0.001)
    lib.transform(hs, lib.at(tip[0], arm_y - 0.004, tip[1]) @ lib.rot("y", ang + 0.35))
    cw = lib.cylinder("counterweight", 0.012, 0.022, M["chrome"], axis="z", segments=32, bevel=0.002)
    lib.transform(cw, lib.at(piv[0] - math.sin(ang) * 0.045, arm_y, piv[1] - math.cos(ang) * 0.045) @ lib.rot("y", ang))
    rest = lib.cylinder("armrest", 0.003, 0.022, M["dark"], axis="y", segments=12)
    lib.transform(rest, lib.at(0.19, yt + 0.011, 0.0))
    # speed switch and the badge on the plinth front
    fz = d / 2
    fm = lambda x, y: F("front", (x, y, fz))
    pb = fm(-0.15, -0.04)
    plate(pb, 0.07, 0.014, 0.0007, top_m, r=0.001)
    txt(pb, "РУБЕЖ  ЭП-101", 0.0055, M["black_ink"], z=0.0007, depth=0.00003, bold=0.5)
    sw = fm(0.12, -0.03)
    plate(sw, 0.05, 0.02, 0.0008, top_m, r=0.002)
    txt(sw, "33", 0.005, M["black_ink"], x=-0.015, z=0.0008, depth=0.00002)
    txt(sw, "45", 0.005, M["black_ink"], x=0.015, z=0.0008, depth=0.00002)
    plate(sw @ lib.at(-0.006, 0, 0), 0.008, 0.012, 0.006, M["dark"], r=0.001, bev=0.0006, z=0.0008)
    plate(fm(0.18, -0.04), 0.016, 0.012, 0.005, M["dark"], r=0.001, bev=0.0005)
    # lid: smoked, a box open at the bottom, hinged at the back
    lw, ld = w - 0.001, d - 0.001
    ly0, ly1 = y_plinth + 0.001, h / 2
    slab(lambda i: rr(lw - 2 * i, ld - 2 * i, 0.004, 4), [(0, 0.0, lid), (0, ly1 - ly0 - 0.002, lid), (0.002, ly1 - ly0, lid)], cap_lo=lid, cap_hi=lid, m=F("top", (0, ly0, 0)), name="lid")
    for sx in (-1, 1):
        plate(F("back", (sx * 0.12, -0.002, -d / 2)), 0.03, 0.03, 0.006, M["chrome"], r=0.002, bev=0.001)
    # back: riveted plate on the plinth, the lead
    bk = F("back", (0, 0, -d / 2))
    pm2 = bk @ lib.at(0.1, -0.042, 0)
    plate(pm2, 0.09, 0.026, 0.0006, M["alu"], r=0.001)
    for sx in (-1, 1):
        disc(pm2 @ lib.at(sx * 0.04, 0, 0.0006), 0.0014, 0.0, 0.0005, M["chrome"], n=12, round_top=0.0004)
    for i, line in enumerate(("РУБЕЖ ЭП-101", "№ 831207   1983", "ЦЕНА 260 руб.")):
        txt(pm2, line, 0.004 if i == 0 else 0.0034, M["black_ink"], y=0.007 - i * 0.0068, z=0.0006, depth=0.0001)
    disc(bk @ lib.at(-0.16, -0.04, 0), 0.004, 0.0, 0.012, M["rubber"], n=16)
    feet(w, d, y0, M["rubber"], r=0.012, h=0.008, inset=0.04)


# ---------------------------------------------------------------------------
# Games consoles


def console_nimbus(it: lib.Item) -> None:
    w, h, d = it.size
    M = setup(it)
    gloss = lib.material(it, "gloss", it.color, rough=0.08)
    matte = lib.material(it, "matte", lib.shade(it.color, 1.15), rough=0.6)
    # the slim's top half is glossy, the lower band matte, a groove between
    slab(rr_shape(w, d, 0.012, 8), [(0.004, -h / 2, matte), (0.001, -h / 2 + 0.003, matte), (0, -0.005, matte), (0.0012, -0.004, M["dark"]), (0.0012, -0.003, M["dark"]), (0, -0.002, gloss), (0, h / 2 - 0.006, gloss), (0.004, h / 2, gloss)],
         cap_lo=matte, cap_hi=gloss, m=F("top", (0, 0, 0)), name="body")
    # the slab above is lofted along local Z of the top frame (= world +Y), outline in XZ
    fz = d / 2
    fm = lambda x, y: F("front", (x, y, fz))
    poly_on(fm(0.0, 0.008), pill(0.135, 0.0042, 12), 0.0002, M["dark"])
    for x in (0.1, 0.118):
        poly_on(fm(x, 0.008), rr(0.012, 0.005, 0.0015, 3), 0.0004, M["chrome"])
    for x in (-0.1, -0.085):
        poly_on(fm(x, -0.016), rr(0.012, 0.0055, 0.0008, 2), 0.0001, M["dark"])  # USB
    # the swirl moulded into the lid
    top = F("top", (0.03, h / 2, 0.02))
    pts = [(0.002 * t * math.cos(t), 0.002 * t * math.sin(t)) for t in [0.6 + 0.25 * i for i in range(48)]]
    line_on(top, pts, 0.0018, 0.0004, gloss)
    txt(F("top", (-0.08, h / 2, 0.1)), "NIMBUS  ORBIT 3", 0.006, gloss, depth=0.0003, bold=0.4, spacing=1.2)
    # back: a wall of vents, HDMI, LAN, the power socket
    bk = F("back", (0, 0, -d / 2))
    vents(bk @ lib.at(0.02, 0.002, 0), 22, 0.026, 0.0068, M["dark"], width=0.0035, depth=0.0001, vertical=True)
    for x, wd in ((-0.1, 0.016), (-0.075, 0.014), (-0.125, 0.012)):
        poly_on(bk @ lib.at(x, 0.0, 0), rr(wd, 0.007, 0.001, 2), 0.0002, M["dark"])
    poly_on(bk @ lib.at(0.12, 0.0, 0), rr(0.018, 0.012, 0.002, 3), 0.0002, M["dark"])
    # base: the sticker over the screw, feet
    bt = F("bottom", (0, -h / 2, 0))
    sk = bt @ lib.at(0.0, 0.0, 0)
    sticker(sk, 0.08, 0.04, M["paper"], M["black_ink"], ["NIMBUS ORBIT 3", "MODEL NB-3004A   320 GB", "S/N 03-27731845-2", "AC 220-240 V  50/60 Hz", "NIMBUS INTERACTIVE"], size=0.0026)
    seal = material_get(M, "seal", "#c9d2dc", metal=1.0, rough=0.18)
    poly_on(bt @ lib.at(0.06, -0.02, 0), circle(0.0045, 20), 0.0001, seal)
    for sx in (-1, 1):
        for sz in (-1, 1):
            disc(bt @ lib.at(sx * 0.12, sz * 0.12, 0), 0.008, -0.0002, 0.002, M["rubber"], n=20)


def console_kosmo(it: lib.Item) -> None:
    w, h, d = it.size
    M = setup(it)
    plastic = lib.material(it, "plastic", it.color, rough=0.6)
    darkp = lib.material(it, "darkp", "#3c3d40", rough=0.6)
    yellow = lib.material(it, "cart", "#e0b62a", rough=0.5)
    # body lofted up from the base; the top steps up at the back where the slot is
    slab(rr_shape(w, d, 0.008, 6), [(0.003, -h / 2, plastic), (0, -h / 2 + 0.003, plastic), (0, h / 2 - 0.004, plastic), (0.003, h / 2, plastic)], cap_lo=plastic, cap_hi=plastic, m=F("top", (0, 0, 0)), name="body")
    top = lambda x, z: F("top", (x, h / 2, z))
    # badge with the rocket over the O
    tb = top(-0.05, 0.03)
    txt(tb, "КОСМО", 0.011, darkp, depth=0.0006, bold=0.8, spacing=1.1)
    txt(tb, "JUNIOR", 0.0055, darkp, y=-0.01, depth=0.0005, bold=0.5, spacing=1.3)
    rocket = [(0, 0.0055), (0.0015, 0.002), (0.0015, -0.002), (0.003, -0.0035), (-0.003, -0.0035), (-0.0015, -0.002), (-0.0015, 0.002)]
    poly_on(tb @ lib.at(0.0115, 0.0125, 0), rocket, 0.0006, material_get(M, "red", "#c0312a", rough=0.5))
    # the cartridge slot behind the hotspot, with the cartridge standing in it
    slot_z0, slot_z1 = -0.048, -0.030
    poly_on(top(0.03, (slot_z0 + slot_z1) / 2), rr(0.095, slot_z1 - slot_z0, 0.002, 3), 0.0003, M["dark"])
    cz = -0.039
    cart = cab(0.088, 0.05, cz - 0.006, cz + 0.006, 0.003, yellow, bev=0.001, name="cart")
    lib.transform(cart, lib.at(0.03, h / 2 + 0.025 - 0.012, 0))
    lab = F("front", (0.03, h / 2 + 0.018, cz + 0.006))
    poly_on(lab, rr(0.07, 0.03, 0.001, 3), 0.0001, M["paper"])
    txt(lab, "9999 in 1", 0.0075, material_get(M, "red", "#c0312a", rough=0.5), y=0.004, z=0.0001, depth=0.00002, bold=0.8)
    txt(lab, "SUPER GAME", 0.0035, M["black_ink"], y=-0.007, z=0.0001, depth=0.00002, spacing=1.2)
    for i in range(6):
        poly_on(F("front", (0.03 - 0.035 + i * 0.014, h / 2 + 0.001, cz + 0.006)), rr(0.006, 0.006, 0.0005, 2), 0.0001, darkp)
    # power and reset
    for x, lab_, col in ((-0.075, "POWER", "#c0312a"), (-0.045, "RESET", "#3c3d40")):
        plate(top(x, -0.035), 0.018, 0.01, 0.004, material_get(M, f"b{lab_}", col, rough=0.5), r=0.002, bev=0.0008)
        txt(top(x, -0.024), lab_, 0.0026, darkp, depth=0.00005)
    # front: two pad sockets with the cables in them, one taped
    fz = d / 2
    for sx in (-1, 1):
        sm = F("front", (sx * 0.035, -0.01, fz))
        plate(sm, 0.02, 0.012, 0.001, darkp, r=0.002)
        disc(sm, 0.003, 0.001, 0.012, M["rubber"], n=12)
        disc(sm @ lib.at(0, 0, 0.012), 0.0025, 0.0, 0.03, M["rubber"], n=10)
        if sx > 0:
            tape = material_get(M, "tape", "#2c3e8c", rough=0.5)
            disc(sm @ lib.at(0, 0, 0.022), 0.0034, 0.0, 0.01, tape, n=12)
    txt(F("front", (0, -0.023, fz)), "1          2", 0.004, darkp, depth=0.0002)
    # base: the three-language sticker, screws, feet
    bt = F("bottom", (0, -h / 2, 0))
    sticker(bt, 0.06, 0.035, M["paper"], M["black_ink"], ["КОСМО JUNIOR", "Игровая приставка • TV game", "Телевизійна гра", "Serial No. KJ 0920318", "9 V DC  0.5 A"], size=0.0022)
    screws_on(bt, [(-0.085, 0.06), (0.085, 0.06), (-0.085, -0.06), (0.085, -0.06)], M["steel"], M["dark"], r=0.0022)
    for sx in (-1, 1):
        for sz in (-1, 1):
            disc(bt @ lib.at(sx * 0.07, sz * 0.045, 0), 0.006, -0.0002, 0.002, M["rubber"], n=16)


# ---------------------------------------------------------------------------
# Cameras and a lens


def lens_barrel(m: Matrix, M: dict, z0: float, z1: float, r: float, *, rings=(), glass_r: float | None = None, text_ring: str = "", text_mat=None, body=None):
    """A lens along the frame's +Z from z0 to z1: barrel, grip rings, a front ring, glass."""
    body = body or M["dark"]
    prof = [(r * 0.9, z0), (r, z0 + 0.001), (r, z1 - 0.002), (r - 0.001, z1)]
    o = lib.lathe(P._name("barrel"), [(0, z0)] + prof + [(0, z1)], body, segments=64, axis="z", cap=False)
    lib.auto_smooth(o, 40)
    P.place(o, m)
    for (a, b) in rings:
        g = lib.lathe(P._name("grip"), [(0, a), (r + 0.0008, a), (r + 0.0008, b), (0, b)], M["rubber"], segments=64, axis="z", cap=False)
        P.place(g, m)
        for k in range(36):
            t = 2 * math.pi * k / 36
            rb = lib.box(P._name("rib"), (0.0008, 0.0006, b - a - 0.001), M["rubber"], center=((r + 0.0011) * math.cos(t), (r + 0.0011) * math.sin(t), (a + b) / 2))
            P.place(rb, m)
    gr = glass_r or r * 0.72
    disc(m @ lib.at(0, 0, z1), gr + 0.0015, -0.0006, 0.00005, M["dark"], n=48)
    disc(m @ lib.at(0, 0, z1), gr, -0.003, -0.0008, material_get(M, "coated", "#1d2b33", metal=0.6, rough=0.04, ao=False), n=48, round_top=gr * 0.12)
    if text_ring:
        arc_on(m @ lib.at(0, 0, z1), text_ring, gr + (r - gr) * 0.55, (r - gr) * 0.42, text_mat or M["ink"], z=0.00005, start=math.pi / 2, spacing=0.75)


def nevka(it: lib.Item) -> None:
    w, h, d = it.size
    M = setup(it)
    plastic = lib.material(it, "plastic", it.color, rough=0.55)
    leather = lib.material(it, "leatherette", lib.shade(it.color, 0.8), rough=0.85)
    zb0, zb1 = -d / 2, 0.006
    cab(w, h, zb0, zb1, 0.006, plastic, bev=0.002, name="body")
    # leatherette band round the front
    poly_on(F("front", (0, -0.006, zb1)), rr(w - 0.01, h - 0.03, 0.002, 3), 0.0004, leather)
    lens_barrel(F("front", (0, -0.004, zb1)), M, 0.0, d / 2 - zb1, 0.0175, rings=((0.006, 0.016),), text_ring="Т-43  4/40  №8104722", body=plastic)
    # viewfinder window and the lightmeter ring top left
    fm = F("front", (0, 0, zb1))
    poly_on(fm @ lib.at(-0.038, 0.02, 0), rr(0.012, 0.009, 0.001, 2), 0.0005, M["glass"])
    poly_on(fm @ lib.at(0.038, 0.02, 0), rr(0.012, 0.009, 0.001, 2), 0.0005, M["glass"])
    # top: name moulded in, the cocking lever and frame counter, shutter button
    tp = lambda x, z: F("top", (x, h / 2, z))
    txt(tp(-0.02, -0.005), "НЕВКА-8М", 0.0065, plastic, depth=0.0004, bold=0.6, spacing=1.1)
    lev = tp(0.025, -0.012)
    disc(lev, 0.009, 0.0, 0.003, plastic, n=32)
    poly_on(lev @ lib.at(0, 0, 0.003), [(-0.002, 0), (0.002, 0), (0.0035, 0.018), (-0.0015, 0.019)], 0.0018, plastic, bevel=0.0004)
    disc(lev, 0.0045, 0.003, 0.0034, M["ink"], n=24)
    txt(lev @ lib.at(0, 0, 0.0034), "12", 0.0028, M["black_ink"], depth=0.00002)
    disc(tp(0.04, 0.0), 0.004, 0.0, 0.004, M["chrome"], n=20, round_top=0.001)
    disc(tp(-0.045, -0.01), 0.005, 0.0, 0.0025, plastic, n=24)  # rewind knob
    # back: the slide-off back on its rails
    bk = F("back", (0, 0, zb0))
    for sy in (-1, 1):
        line_on(bk, [(-w / 2 + 0.004, sy * (h / 2 - 0.006)), (w / 2 - 0.004, sy * (h / 2 - 0.006))], 0.0012, 0.0004, M["dark"])
    poly_on(bk @ lib.at(-0.03, 0.022, 0), rr(0.01, 0.007, 0.001, 2), 0.0006, M["glass"])
    txt(bk @ lib.at(0.015, -0.005, 0), "< ОТКРЫТО", 0.0035, plastic, depth=0.0003)
    disc(F("bottom", (0, -h / 2, -0.01)), 0.004, -0.0002, 0.0002, M["steel"], n=16)


def powerpix(it: lib.Item) -> None:
    w, h, d = it.size
    M = setup(it)
    body = lib.material(it, "body", it.color, metal=0.7, rough=0.35)
    darkb = lib.material(it, "darkb", "#2d2e30", rough=0.5)
    z0, z1 = -d / 2, 0.011
    cab(w, h, z0, z1, 0.008, body, bev=0.003, name="body")
    # the battery grip (left from the front)
    grip = cab(0.03, h - 0.006, z1 - 0.004, d / 2, 0.009, body, bev=0.004, name="grip")
    lib.transform(grip, lib.at(-0.034, -0.003, 0))
    lens_barrel(F("front", (0.016, 0.004, z1)), M, 0.0, d / 2 - z1, 0.0175, rings=(), glass_r=0.0085, text_ring="ZOOM LENS 4x  5.8-23.2 mm  1:2.6-5.5", body=body)
    disc(F("front", (0.016, 0.004, z1)), 0.022, -0.0002, 0.0012, body, n=48)
    fm = F("front", (0, 0, d / 2))
    txt(fm @ lib.at(-0.034, 0.02, 0), "KANON", 0.0052, M["chrome"], depth=0.0004, bold=0.8, spacing=1.05)
    txt(F("front", (-0.034, 0.012, d / 2)), "POWERPIX", 0.0022, M["black_ink"], depth=0.00002, spacing=1.1)
    txt(F("front", (-0.034, 0.008, d / 2)), "A560", 0.0022, M["black_ink"], depth=0.00002)
    poly_on(F("front", (0.036, 0.024, z1)), rr(0.009, 0.006, 0.001, 2), 0.0004, M["glass"])  # viewfinder
    poly_on(F("front", (0.04, 0.012, z1)), rr(0.012, 0.007, 0.001, 2), 0.0004, material_get(M, "flash", "#e8e6dc", rough=0.2, ao=False))
    # top: shutter with zoom ring, power button
    tp = F("top", (-0.03, h / 2, 0.0))
    disc(tp, 0.007, 0.0, 0.0015, M["chrome"], n=32)
    disc(tp, 0.0045, 0.0015, 0.003, body, n=24, round_top=0.0008)
    plate(F("top", (0.0, h / 2, 0.0)), 0.007, 0.004, 0.0012, darkb, r=0.0015, bev=0.0004)
    # back: the screen, buttons, a little viewfinder
    bk = F("back", (0, 0, z0))
    sc = bk @ lib.at(0.008, 0.0, 0)  # back frame: x mirrored, so +x here is −x in the item
    plate(sc, 0.05, 0.038, 0.0004, darkb, r=0.002)
    poly_on(sc, rr(0.046, 0.034, 0.001, 3), 0.0001, M["glass"], z=0.0004)
    for i, (bx, by) in enumerate(((-0.026, 0.012), (-0.026, 0.0), (-0.026, -0.012), (-0.038, 0.006), (-0.038, -0.006))):
        plate(bk @ lib.at(bx, by, 0), 0.006, 0.006, 0.001, darkb, r=0.003, bev=0.0004)
    poly_on(bk @ lib.at(-0.036, 0.024, 0), rr(0.008, 0.006, 0.001, 2), 0.0006, M["glass"])
    # base: serial plate, tripod socket, battery door
    bt = F("bottom", (0, -h / 2, 0))
    disc(bt @ lib.at(0.005, 0.0, 0), 0.004, -0.0002, 0.0001, M["steel"], n=20)
    disc(bt @ lib.at(0.005, 0.0, 0), 0.0028, 0.0001, 0.00012, M["dark"], n=16)
    sticker(bt @ lib.at(0.025, 0.0, 0), 0.024, 0.016, material_get(M, "plate", "#d7d8da", metal=0.8, rough=0.3), M["black_ink"], ["KANON INC.", "PC1210", "No. 2831047552"], size=0.0016)
    line_on(bt @ lib.at(-0.034, 0.0, 0), rr(0.026, 0.03, 0.002, 3), 0.0005, 0.0002, M["dark"], closed=True)


def d450(it: lib.Item) -> None:
    w, h, d = it.size
    M = setup(it)
    body = lib.material(it, "body", it.color, rough=0.62)
    grip_m = lib.material(it, "grip", "#151515", rough=0.85)
    zb0, zb1 = -d / 2, -0.012
    yb0, yb1 = -h / 2, 0.036
    zback = zb0 + 0.001
    b = cab(w, yb1 - yb0, zback, zb1, 0.012, body, bev=0.004, name="body")
    lib.transform(b, lib.at(0, (yb0 + yb1) / 2, 0))
    # prism hump up to the top of the size
    hump = slab(lambda i: [(-0.026 + i, 0.0), (0.026 - i, 0.0), (0.016 - i, h / 2 - yb1 - i), (-0.016 + i, h / 2 - yb1 - i)], [(0, -0.045, body), (0, -0.002, body)], cap_lo=body, cap_hi=body, m=F("front", (0, yb1 - 0.002, zb1)), name="hump")
    # grip (left from the front), deep
    g = cab(0.034, yb1 - yb0 - 0.004, zb1 - 0.01, zb1 + 0.012, 0.012, grip_m, bev=0.006, name="grip")
    lib.transform(g, lib.at(-w / 2 + 0.019, (yb0 + yb1) / 2 - 0.002, 0))
    # lens: mount ring, then the kit zoom to the front of the size
    lm = F("front", (0, -0.008, zb1))
    disc(lm, 0.031, 0.0, 0.004, M["chrome"], n=64)
    lens_barrel(lm, M, 0.004, d / 2 - zb1, 0.034, rings=((0.03, 0.05), (0.068, 0.078)), glass_r=0.026, text_ring="KANON ZOOM LENS EF-S 18-55mm 1:3.5-5.6 IS  ø58mm")
    sw = F("nx", (-0.0342, -0.008, zb1 + 0.018))
    plate(sw, 0.012, 0.008, 0.0012, M["dark"], r=0.001)
    txt(sw, "STABILIZER", 0.0012, M["ink"], y=0.003, z=0.0012, depth=0.00001)
    txt(F("front", (0.0, yb1 + 0.006, zb1 - 0.002)), "KANON", 0.006, M["chrome"], depth=0.0003, bold=0.8, spacing=1.05)
    txt(F("front", (0.045, yb1 - 0.008, zb1)), "D450", 0.0045, M["ink"], depth=0.00002)
    # top: mode dial (right from the front) reaching the top of the size, shutter, hot shoe
    md = F("top", (0.038, yb1, -0.05))
    slab(circle_shape(0.012, 48), [(0, -0.001, body), (0, h / 2 - yb1 - 0.0006, body), (0.0006, h / 2 - yb1, body)], cap_lo=body, cap_hi=body, m=md)
    for k in range(48):
        t = 2 * math.pi * k / 48
        line_on(md, [(0.0122 * math.cos(t), 0.0122 * math.sin(t)), (0.0125 * math.cos(t), 0.0125 * math.sin(t))], 0.0006, 0.0003, body, z=0.008)
    for k, lab in enumerate(("P", "Tv", "Av", "M", "AUTO")):
        t = math.pi / 2 + k * 0.6
        txt(md, lab, 0.0022, M["ink"], x=0.008 * math.cos(t), y=0.008 * math.sin(t), z=h / 2 - yb1, depth=0.00002)
    disc(F("top", (-0.045, yb1, -0.02)), 0.006, 0.0, 0.004, body, n=24, round_top=0.001)
    plate(F("top", (0.0, h / 2 - 0.002, -0.035)), 0.02, 0.018, 0.0012, M["steel"], r=0.001)
    # back: screen, the soft eyecup, buttons
    bk = F("back", (0, 0, zback))
    sc = bk @ lib.at(0.01, -0.008, 0)
    plate(sc, 0.066, 0.05, 0.0004, M["dark"], r=0.003)
    poly_on(sc, rr(0.06, 0.045, 0.001, 3), 0.0001, M["glass"], z=0.0004)
    ey = F("back", (0, 0.03, zback))
    plate(ey, 0.04, 0.026, 0.006, M["rubber"], r=0.008, bev=0.002)
    poly_on(ey, rr(0.022, 0.016, 0.002, 3), 0.0002, M["glass"], z=0.006)
    for by in (0.012, 0.0, -0.012, -0.024):
        plate(bk @ lib.at(-0.035, by - 0.008, 0), 0.008, 0.006, 0.0015, M["dark"], r=0.002, bev=0.0005)
    disc(bk @ lib.at(-0.048, -0.012, 0), 0.007, 0.0, 0.0015, M["dark"], n=32)
    # base: serial label, tripod socket, screws
    bt = F("bottom", (0, yb0, 0))
    disc(bt @ lib.at(0.0, -0.035, 0), 0.006, -0.0002, 0.0002, M["steel"], n=24)
    disc(bt @ lib.at(0.0, -0.035, 0), 0.0035, 0.0002, 0.00022, M["dark"], n=16)
    sticker(bt @ lib.at(0.02, -0.05, 0), 0.04, 0.012, material_get(M, "label", "#202022", rough=0.5), M["ink"], ["KANON D450   DS126181", "No. 0820712394"], size=0.002)
    screws_on(bt, [(0.045, -0.04), (-0.035, -0.06)], M["steel"], M["dark"], r=0.0012)


def zoom_lens(it: lib.Item) -> None:
    w, h, d = it.size
    M = setup(it)
    body = lib.material(it, "body", it.color, rough=0.55)
    r = w / 2
    z0, z1 = -d / 2, d / 2
    prof = [(0, z0), (0.024, z0), (0.024, z0 + 0.003), (0.028, z0 + 0.004), (0.031, z0 + 0.012), (r - 0.002, z0 + 0.02), (r - 0.002, z1 - 0.01), (r, z1 - 0.006), (r, z1), (0.03, z1), (0, z1)]
    o = lib.lathe("barrel", prof, body, segments=72, axis="z", cap=False)
    lib.auto_smooth(o, 40)
    # metal mount and its contacts
    mm = F("back", (0, 0, z0))
    for k in range(3):
        a = math.radians(30 + k * 120)
        poly_on(mm, [(0.019 * math.cos(a + s), 0.019 * math.sin(a + s)) for s in [-0.4 + 0.05 * i for i in range(17)]] + [(0.024 * math.cos(a + s), 0.024 * math.sin(a + s)) for s in [0.4 - 0.05 * i for i in range(17)]], 0.0012, M["chrome"])
    disc(mm, 0.024, -0.0001, 0.0004, M["chrome"], n=72)
    disc(mm, 0.018, -0.0002, 0.0002, M["dark"], n=48)
    for k in range(7):
        a = math.radians(-60 + k * 8)
        disc(mm @ lib.at(0.0205 * math.cos(a), 0.0205 * math.sin(a), 0), 0.0006, 0.0004, 0.0008, material_get(M, "gold", "#d6b25a", metal=1.0, rough=0.25), n=10)
    screws_on(mm, [(0.0215 * math.cos(math.radians(a)), 0.0215 * math.sin(math.radians(a))) for a in (100, 220, 340)], M["chrome"], M["dark"], r=0.0007)
    disc(mm, 0.012, -0.0002, -0.0001, M["glass"], n=32)
    # zoom ring (rubber, ribbed) with the scale, the focus ring at the front
    for (a, b) in ((0.0, 0.034), (z1 - 0.03, z1 - 0.012)):
        g = lib.lathe(P._name("grip"), [(0, a), (r + 0.0006, a), (r + 0.0006, b), (0, b)], M["rubber"], segments=72, axis="z", cap=False)
        for k in range(48):
            t = 2 * math.pi * k / 48
            lib.box(P._name("rib"), (0.0012, 0.0012, b - a - 0.002), M["rubber"], center=((r + 0.0009) * math.cos(t), (r + 0.0009) * math.sin(t), (a + b) / 2))
    for k, lab in enumerate(("75", "100", "135", "200", "300")):
        txt(F("top", (-0.016 + k * 0.008, r - 0.0019, -0.006)), lab, 0.0022, M["ink"], depth=0.00002)
    # AF/MF switch on the left
    sw = F("nx", (-(r - 0.002), 0.0, -0.032))
    plate(sw, 0.016, 0.01, 0.0018, M["dark"], r=0.001)
    plate(sw @ lib.at(-0.003, 0, 0.0018), 0.006, 0.004, 0.0012, body, r=0.001)
    txt(sw @ lib.at(0, 0, 0.0018), "AF     MF", 0.0018, M["ink"], y=-0.0035, depth=0.00002)
    txt(F("nx", (-(r - 0.002), 0.0, -0.012)), "KANON LENS EF 75-300mm 1:4-5.6", 0.0019, M["ink"], depth=0.00002)
    # front: filter thread ring, glass, the name ring
    lens_barrel(F("front", (0, 0, z1 - 0.0015)), M, -0.0005, 0.0015, r - 0.003, glass_r=0.026, text_ring="KANON ZOOM LENS EF 75-300mm 1:4-5.6  ø58mm", body=body)


def tablet(it: lib.Item) -> None:
    w, h, d = it.size
    M = setup(it)
    alu = lib.material(it, "alu", it.color, metal=0.85, rough=0.4)
    r = 0.012
    body = slab(rr_shape(w, h, r, 10), [(0.004, -d / 2, alu), (0.0016, -d / 2 + 0.0012, alu), (0.0004, -d / 2 + 0.003, alu), (0, 0.0, alu), (0, d / 2 - 0.0012, alu)], cap_lo=alu, cap_hi=alu, smooth=40)
    front = slab(rr_shape(w, h, r, 10), [(0.0003, d / 2 - 0.0012, M["glass"]), (0.0003, d / 2 - 0.0002, M["glass"]), (0.0006, d / 2, M["glass"])], cap_lo=M["glass"], cap_hi=M["glass"])
    fm = F("front", (0, 0, d / 2))
    cut(front, [pocket(circle_shape(0.0058, 40), 0.0004, M["dark"], fm @ lib.at(0, -h / 2 + 0.0105, 0))])
    disc(fm @ lib.at(0, -h / 2 + 0.0105, 0), 0.0053, -0.0004, -0.00008, M["glass"], n=40)
    line_on(fm @ lib.at(0, -h / 2 + 0.0105, 0), rr(0.003, 0.003, 0.0007, 4), 0.00016, 0.00001, M["ink"], z=-0.00008, closed=True)
    disc(fm @ lib.at(0, h / 2 - 0.0095, 0), 0.0011, -0.00002, 0.00002, M["dark"], n=16)
    # back: fruit logo, '16 GB', the small print with the serial
    bm = F("back", (0, 0, -d / 2))
    with thick_print():
        P.mangosteen_logo(bm @ lib.at(0, 0.01, 0), M["chrome"], scale=1.8)
    txt(bm, "Pad", 0.007, M["chrome"], y=-0.03, depth=0.00002, bold=0.5)
    txt(bm, "Designed by Mangosteen in Mostograd   16 GB", 0.0018, M["black_ink"], y=-0.088, depth=0.00001)
    txt(bm, "Model MG-1395   Serial DMPH 4KL7 DFHW", 0.0018, M["black_ink"], y=-0.092, depth=0.00001)
    P.camera(F("back", (-(w / 2 - 0.009), h / 2 - 0.009, -d / 2)) @ lib.at(0, 0, 0), M["chrome"], M["dark"], M["glass"], r=0.0022, proud=0.0002)
    # buttons on the +X edge, port and speaker at the bottom
    for y, ln in ((0.075, 0.022), (0.098, 0.009)):
        slab(lambda i, ln=ln: pill(ln - 2 * i, 0.0028 - 2 * i, 8), [(0, -0.0003, alu), (0, 0.0003, alu), (0.0003, 0.00045, alu)], cap_lo=alu, cap_hi=alu, m=F("px", (w / 2 - 0.0004, y, -0.0005)))
    bt = F("bottom", (0, -h / 2, -0.0005))
    ends = [pocket(lambda i: rr(0.021, 0.0024, 0.0005, 4), 0.003, M["dark"], bt)]
    ends += holes(bt, [(0.035 + i * 0.0022, 0) for i in range(14)], 0.0006, 0.0015, M["dark"], 10)
    cut(body, ends)
    slab(rr_shape(0.0172, 0.0006, 0.0002, 2), [(0, -0.003, M["dark"]), (0, -0.0007, M["dark"])], cap_lo=M["dark"], cap_hi=M["dark"], m=bt)
    slab(lambda i: pill(0.0095 - 2 * i, 0.0024 - 2 * i, 8), [(0, -0.0003, M["dark"]), (0, 0.0003, M["dark"])], cap_lo=M["dark"], cap_hi=M["dark"], m=F("top", (w / 2 - 0.03, h / 2 - 0.0004, -0.0005)))


def tune_player(it: lib.Item) -> None:
    w, h, d = it.size
    M = setup(it)
    front_m = lib.material(it, "front", it.color, metal=0.7, rough=0.35)
    mirror = lib.material(it, "mirror", "#d9dbde", metal=1.0, rough=0.14)
    r = 0.008
    slab(rr_shape(w, h, r, 10), [(0.0025, -d / 2, mirror), (0.0008, -d / 2 + 0.0015, mirror), (0, -d / 2 + 0.004, mirror), (0, 0.0, mirror), (0.0002, 0.0002, M["dark"]), (0, 0.0004, front_m), (0, d / 2 - 0.0008, front_m), (0.0006, d / 2, front_m)],
         cap_lo=mirror, cap_hi=front_m, smooth=40)
    fz = d / 2
    sc = F("front", (0, 0.026, fz))
    poly_on(sc, rr(0.054, 0.042, 0.001, 3), 0.0001, M["glass"])
    poly_on(sc, rr(0.048, 0.036, 0.0005, 2), 0.00002, material_get(M, "lcd", "#0d1418", rough=0.1, ao=False), z=0.0001)
    wh = F("front", (0, -0.024, fz))
    wheel = material_get(M, "wheel", lib.shade(it.color, 1.3), rough=0.45)
    disc(wh, 0.0195, -0.0002, 0.0001, wheel, n=72)
    disc(wh, 0.0078, -0.0002, 0.0003, front_m, n=48, round_top=0.0002)
    for lab, (x, y) in (("MENU", (0, 0.0135)), (">>|", (0.0135, 0)), ("|<<", (-0.0135, 0)), ("> II", (0, -0.0135))):
        txt(wh, lab, 0.0024, M["ink"], x=x, y=y, z=0.0001, depth=0.00001, bold=0.3)
    # back: logo, the engraving
    bm = F("back", (0, 0, -d / 2))
    with thick_print():
        P.mangosteen_logo(bm @ lib.at(0, 0.018, 0), M["black_ink"], scale=1.1)
    txt(bm, "Tune", 0.006, M["black_ink"], y=-0.004, depth=0.00001, bold=0.5)
    txt(bm, "160GB", 0.0028, M["black_ink"], y=-0.014, depth=0.00001)
    txt(bm, "Designed by Mangosteen in Mostograd", 0.0013, M["black_ink"], y=-0.034, depth=0.00001)
    txt(bm, "Model MG-1238   Serial 8K023ZQ7YMV", 0.0013, M["black_ink"], y=-0.037, depth=0.00001)
    # bottom dock and top: headphone socket, hold switch
    bt = F("bottom", (0, -h / 2, 0.0015))
    poly_on(bt, rr(0.021, 0.0026, 0.0005, 4), 0.0002, M["dark"])
    tp = F("top", (0, h / 2, 0.0015))
    disc(tp @ lib.at(0.016, 0, 0), 0.0022, -0.0002, 0.0001, M["dark"], n=20)
    poly_on(tp @ lib.at(-0.018, 0, 0), rr(0.008, 0.0025, 0.0008, 3), 0.0001, M["dark"])
    plate(tp @ lib.at(-0.0195, 0, 0), 0.003, 0.0018, 0.0006, front_m, r=0.0005, z=0.0001)


def car_stereo(it: lib.Item) -> None:
    w, h, d = it.size
    M = setup(it)
    chassis = lib.material(it, "chassis", "#7b7d80", metal=1.0, rough=0.5)
    panel = lib.material(it, "panel", it.color, rough=0.45)
    pt = 0.018
    cab(w - 0.004, h - 0.001, -d / 2, d / 2 - pt, 0.001, chassis, bev=0.0005, name="chassis")
    # the detachable panel
    pz0 = d / 2 - pt
    pnl = cab(w, h, pz0, d / 2, 0.006, panel, bev=0.003, name="panel")
    fm = lambda x, y: F("front", (x, y, d / 2))
    disp = fm(0.02, 0.006)
    plate(disp, 0.075, 0.02, 0.0004, M["glass"], r=0.002)
    amber = material_get(M, "lcd", "#f0a93a", rough=0.4, ao=False, emissive="#6a3f0a")
    txt(disp, "FM1  101.7", 0.007, amber, z=0.0004, depth=0.00002, font="DejaVuSansMono.woff2")
    poly_on(fm(0.02, 0.019), pill(0.07, 0.0024, 12), 0.0002, M["dark"])  # disc slot
    knob(fm(-0.06, 0.0), 0.013, 0.008, M["chrome"], cap=panel)
    txt(fm(-0.06, -0.019), "VOL • PUSH SEL", 0.0022, M["ink"], depth=0.00002)
    keyrow(fm(0.02, -0.015), 6, 0.011, 0.006, 0.002, M["dark"], t=0.0018, labels=("1", "2", "3", "4", "5", "6"), ink=M["ink"], size=0.0028)
    plate(fm(0.075, 0.006), 0.012, 0.022, 0.002, M["dark"], r=0.002, bev=0.0005)
    txt(fm(-0.06, 0.018), "SEVERIN", 0.0045, M["ink"], depth=0.00002, bold=0.6, spacing=1.2)
    txt(fm(0.065, -0.021), "CDX-410  MP3", 0.0024, M["ink"], depth=0.00002)
    plate(fm(-0.083, 0.0), 0.006, 0.02, 0.0015, M["chrome"], r=0.001)  # release
    # top: the sticker; sides: the mounting holes
    tp = F("top", (0.03, h / 2 - 0.0005, -0.03))
    sticker(tp, 0.07, 0.04, M["paper"], M["black_ink"], ["SEVERIN  CDX-410", "12 V DC  4 x 45 W", "SERIAL No. CX 4100 87214", "CAUTION: CLASS 1 LASER PRODUCT"], size=0.0026)
    for sx, face in ((1, "px"), (-1, "nx")):
        for k in range(5):
            o = 0.03 * (k - 2)
            disc(F(face, (sx * (w / 2 - 0.002), 0.0, o - 0.03)), 0.0022, -0.0002, 0.0001, M["dark"], n=12)
    # back: ISO block with the wires, aerial socket
    bk = F("back", (0, 0, -d / 2))
    for x in (-0.03, 0.0):
        plate(bk @ lib.at(x, 0.0, 0), 0.026, 0.014, 0.012, M["dark"], r=0.001)
        for k in range(4):
            for row in (-1, 1):
                col = ("#d02a1f", "#e8c520", "#2a2a2a", "#3b6fd0")[k]
                disc(bk @ lib.at(x - 0.009 + k * 0.006, row * 0.003, 0.012), 0.0011, 0.0, 0.02, material_get(M, f"wire{k}", col, rough=0.6), n=8)
    disc(bk @ lib.at(0.06, 0.006, 0), 0.0035, 0.0, 0.015, M["chrome"], n=16)
    disc(bk @ lib.at(0.06, 0.006, 0), 0.0012, 0.015, 0.0152, M["dark"], n=12)


def dashcam(it: lib.Item) -> None:
    w, h, d = it.size
    M = setup(it)
    body = lib.material(it, "body", it.color, rough=0.5)
    z0, z1 = -d / 2, d / 2 - 0.006
    cab(w, h - 0.006, z0, z1, 0.008, body, bev=0.002, name="body")
    lp = F("front", (0.012, 0.004, z1))
    lens_barrel(lp, M, 0.0, 0.006, 0.0125, glass_r=0.0068, text_ring="Severin DOZOR HD 1080  WIDE 170°", body=body)
    disc(F("front", (-0.018, 0.012, z1)), 0.002, -0.0001, 0.0003, material_get(M, "ir", "#3a0b0b", rough=0.1, ao=False), n=16)
    txt(F("front", (-0.018, -0.012, z1)), "DOZOR", 0.0035, M["ink"], depth=0.00002, bold=0.5, spacing=1.1)
    bk = F("back", (0, 0, z0))
    plate(bk, 0.05, 0.034, 0.0004, M["dark"], r=0.002)
    poly_on(bk, rr(0.046, 0.03, 0.001, 3), 0.0001, M["glass"], z=0.0004)
    for k in range(4):
        plate(F("bottom", (-0.015 + k * 0.01, -(h - 0.006) / 2, -0.004)), 0.006, 0.004, 0.0012, M["dark"], r=0.001, bev=0.0003)
    holes_m = F("nx", (-w / 2, 0.0, 0.0))
    for k in range(6):
        disc(holes_m @ lib.at(-0.008 + k * 0.0032, 0.004, 0), 0.0007, -0.0002, 0.00005, M["dark"], n=8)
    # memory card slot on +X
    poly_on(F("px", (w / 2, -0.006, 0.0)), rr(0.003, 0.0125, 0.0005, 2), 0.0002, M["dark"])
    txt(F("px", (w / 2, 0.006, 0.0)), "microSD", 0.0018, M["ink"], depth=0.00002)
    # mount rail on top with the sucker arm
    tp = F("top", (0, (h - 0.006) / 2, 0.0))
    plate(tp, 0.022, 0.014, 0.003, M["dark"], r=0.002)
    disc(F("top", (0, h / 2 - 0.0005, 0.0)), 0.0035, -0.0028, 0.0005, M["dark"], n=16)


# ---------------------------------------------------------------------------
# Gold in odd shapes


def crown(it, gold, cement, x, y, *, r=0.0043, top=0.0052, bottom=-0.0055, rot=0.0, seed=0):
    rnd = random.Random(seed)
    prof = [(r * 0.86, bottom), (r * 0.95, bottom + 0.0006), (r, bottom + 0.004), (r * 0.98, top - 0.0022), (r * 0.82, top - 0.0008), (r * 0.5, top - 0.0003), (0, top - 0.0004)]
    o = lib.lathe(P._name("crown"), [(0, bottom + 0.0012)] + prof, gold, segments=48, axis="z", cap=False)
    o.data.transform(Matrix.Diagonal((1.0, 0.9, 1.0, 1.0)))
    lib.auto_smooth(o, 45)
    lib.transform(o, lib.at(x, y, 0) @ lib.rot("z", rot))
    for k in range(4):
        a = rot + math.pi / 4 + k * math.pi / 2
        cx, cy = x + math.cos(a) * r * 0.42, y + math.sin(a) * r * 0.38
        cu = lib.lathe(P._name("cusp"), [(0, top - 0.0016), (r * 0.36, top - 0.0016), (r * 0.3, top - 0.0006), (r * 0.15, top - 0.00015 - rnd.uniform(0, 0.0002)), (0, top - 0.0001 - rnd.uniform(0, 0.0002))], gold, segments=20, axis="z", cap=False)
        lib.transform(cu, lib.at(cx, cy, 0))
    # the open underside: a thin gold lip round grey cement with scratched initials
    disc(Matrix.Translation((x, y, bottom)) @ lib.rot("x", math.pi), r * 0.8, -0.0003, 0.0002, cement, n=32)


def dental_crowns(it: lib.Item) -> None:
    M = setup(it)
    gold = lib.material(it, "gold", it.color, metal=1.0, rough=0.24)
    cement = lib.material(it, "cement", "#8f8c84", rough=0.85)
    crown(it, gold, cement, -0.01, 0.0035, seed=1)
    crown(it, gold, cement, -0.0118, -0.006, r=0.0038, top=0.0045, rot=0.4, seed=2)
    crown(it, gold, cement, 0.0035, -0.001, top=0.0045, seed=3)
    crown(it, gold, cement, 0.0115, -0.001, top=0.0045, seed=4)
    # the solder seam joining the bridge
    seam = lib.lathe("seam", [(0, -0.003), (0.0016, -0.003), (0.0018, 0.0), (0.0014, 0.0036), (0, 0.0038)], gold, segments=24, axis="z", cap=False)
    seam.data.transform(Matrix.Diagonal((1.0, 1.4, 1.0, 1.0)))
    lib.transform(seam, lib.at(0.0075, -0.001, 0))
    ink = material_get(M, "scratch", "#5d5a52", rough=0.8, ao=False)
    txt(Matrix.Translation((-0.01, 0.0035, -0.0058)) @ lib.rot("y", math.pi), "ВП", 0.0018, ink, depth=0.00002)


def gold_bar(it: lib.Item) -> None:
    w, h, d = it.size
    M = setup(it)
    gold = lib.material(it, "gold", it.color, metal=1.0, rough=0.18)
    card = lib.material(it, "card", "#e9e2cc", rough=0.6)
    blister = lib.material(it, "blister", "#f2f4f5", rough=0.03, alpha=0.25, ao=False)
    ct = 0.0008
    cab(w, h, -d / 2, -d / 2 + ct, 0.004, card, bev=0.0002, name="card")
    cz = -d / 2 + ct
    fm = F("front", (0, 0, cz))
    # printed card front
    navy = material_get(M, "navy", "#1f2f5a", rough=0.5, ao=False)
    poly_on(fm @ lib.at(0, 0.034, 0), rr(w - 0.006, 0.012, 0.001, 2), 0.00002, navy)
    txt(fm, "МОСТОГРАДСКИЙ ЗАВОД ДРАГМЕТАЛЛОВ", 0.0022, M["ink"], y=0.034, z=0.00002, depth=0.00001, bold=0.3)
    txt(fm, "ЗОЛОТО  999,9", 0.0042, navy, y=-0.012, depth=0.00002, bold=0.6)
    txt(fm, "5 г", 0.0058, navy, y=-0.021, depth=0.00002, bold=0.6)
    txt(fm, "№ АБ 041772", 0.0028, navy, y=-0.03, depth=0.00002, font="DejaVuSansMono.woff2")
    # the bar, stamped, in its blister
    bx, by = 0.0, 0.012
    bar_w, bar_h, bar_t = 0.0095, 0.0155, 0.0016
    bar = cab(bar_w, bar_h, cz, cz + bar_t, 0.0008, gold, bev=0.0003, name="bar")
    lib.transform(bar, lib.at(bx, by, 0))
    bm = F("front", (bx, by, cz + bar_t))
    txt(bm, "5 g", 0.0024, gold, y=0.0045, depth=0.00006, bold=0.5)
    txt(bm, "999.9", 0.0018, gold, y=0.0012, depth=0.00006, bold=0.4)
    arc = [(0.0028 * math.cos(t), -0.0022 + 0.0018 * math.sin(t)) for t in [math.pi * i / 10 for i in range(11)]]
    line_on(bm, arc, 0.00025, 0.00005, gold)
    line_on(bm, [(-0.0032, -0.0022), (0.0032, -0.0022)], 0.00025, 0.00005, gold)
    txt(bm, "АБ 041772", 0.0011, gold, y=-0.0055, depth=0.00005, font="DejaVuSansMono.woff2")
    bl = slab(lambda i: rr(bar_w + 0.004 - 2 * i, bar_h + 0.004 - 2 * i, 0.002, 4), [(0, 0.0, blister), (0, d / 2 - cz - 0.0006, blister), (0.0012, d / 2 - cz, blister)], cap_lo=blister, cap_hi=blister, m=F("front", (bx, by, cz)), name="blister")
    # back of the card: the serial again, the text
    bk = F("back", (0, 0, -d / 2))
    for i, line in enumerate(("Слиток золота аффинированного", "Проба 999,9   Масса 5 г", "Серийный номер АБ 041772", "Не вскрывать блистер")):
        txt(bk, line, 0.0024, navy, y=-0.008 - i * 0.004, depth=0.00002)


# ---------------------------------------------------------------------------


def setup(it: lib.Item) -> dict:
    global AO_DISTANCE, PRINT
    s = it.size
    PRINT = max(0.00002, max(s) * 0.00018)
    AO_DISTANCE = max(0.0006, min(0.012, sorted(s)[1] * 0.06))
    it.ao_size = 1024
    M = mats(it)
    M["_it"] = it
    M["glass_clear"] = lib.material(it, "glass_clear", "#dfe6e8", rough=0.04, alpha=0.2, ao=False)
    return M


BUILDERS = {
    "deck_rubezh_302": deck_rubezh,
    "deck_nakashima_cx7": deck_nakashima,
    "vhs_tosaki_vr80": vhs_tosaki,
    "turntable_rubezh_ep101": turntable,
    "console_nimbus_orbit3": console_nimbus,
    "console_kosmo_junior": console_kosmo,
    "camera_nevka_8m": nevka,
    "camera_kanon_powerpix": powerpix,
    "camera_kanon_d450": d450,
    "lens_kanon_zoom": zoom_lens,
    "tablet_mangosteen_pad2": tablet,
    "player_mangosteen_tune": tune_player,
    "carstereo_severin_cdx": car_stereo,
    "dashcam_severin_dozor": dashcam,
    "gold_dental_crowns_900": dental_crowns,
    "gold_bar_5g_999": gold_bar,
}


def build(it: lib.Item) -> None:
    P._n[0] = 0
    if not hasattr(it, "size"):
        it.size = tuple(it.model.get("size", (0.1, 0.1, 0.1)))
    fn = BUILDERS.get(it.id)
    if fn is None:
        from kinds import box_c  # M6 items wave C

        fn = box_c.BUILDERS.get(it.id)
    if fn is None:
        from kinds import box_d  # 1.4: binoculars, barometer, calculator

        fn = box_d.BUILDERS.get(it.id)
    if fn is None:
        raise KeyError(f"box.py has no builder for {it.id}")
    fn(it)
