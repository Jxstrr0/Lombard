"""
Books (M6): closed hardbacks lying flat, cover +Z, spine at −X, size `model.size`
[w, h, d] centred on the origin (src/render/items.ts buildBook).

- The Mostizdat encyclopedia is shown as a stack of three of its thirty volumes
  (each d / 3 thick): red cloth, gilt bands and the volume number on the spine,
  the gilt title on the top cover, a tram-ticket bookmark in the middle one.
- Lunin's "The Drawbridge" is one slim hardback in a paper dust jacket: the
  drawbridge print faded, the jacket chipped at the top of the spine, the cloth
  spine with its silver stamping showing through the chip.

A volume is a page block, two boards with a little square overhang, and a
rounded spine. The fore-edge (+X) stays within a millimetre of the size so the
`pages` / `flyleaf` hotspots sit on it.
"""

from __future__ import annotations

import math

import lib
from kinds import phone as P
from mathutils import Matrix

AO_DISTANCE = 0.003

F, rr, circle = P.F, P.rr, P.circle

# Print must stand a few Draco steps proud (14-bit positions over the longest side).
PRINT = 0.00005


def poly_on(m: Matrix, pts, depth: float, mat, *, z: float = 0.0, bevel: float = 0.0):
    return P.poly_on(m, pts, max(depth, PRINT), mat, z=z, bevel=bevel)


def line_on(m: Matrix, pts, width: float, depth: float, mat, *, z: float = 0.0, closed: bool = False):
    return P.line_on(m, pts, width, max(depth, PRINT), mat, z=z, closed=closed)


def txt(m: Matrix, body: str, size: float, mat, *, x: float = 0.0, y: float = 0.0, z: float = 0.0, depth: float = 0.00003, rot: float = 0.0, bold: float = 0.0, spacing: float = 1.0):
    o = lib.text(P._name("txt"), body, size, max(depth, PRINT), mat, pos=(x, y, z), rot_z=rot, facing=1, bold=bold, spacing=spacing)
    return P.place(o, m)


def volume(it: lib.Item, w: float, h: float, z0: float, z1: float, cloth, pages, *, board: float = 0.0025, square: float = 0.0012, name: str = "vol") -> None:
    t = z1 - z0
    # page block, with faint page lines on the fore-edge
    pb = lib.box(f"{name}.pages", (w - 0.004 - square, h - 2 * square, t - 2 * board + 0.0004), pages, center=(0.002 - square / 2 + 0.0002, 0, (z0 + z1) / 2), bevel=0.0004, bevel_segments=2)
    lib.auto_smooth(pb, 40)
    for zc in (z0 + board / 2, z1 - board / 2):
        b = lib.box(f"{name}.board", (w - 0.002, h, board), cloth, center=(0.001, 0, zc), bevel=0.0007, bevel_segments=2)
        lib.auto_smooth(b, 40)
    sp = lib.cylinder(f"{name}.spine", t / 2, h, cloth, axis="y", segments=24)
    sp.data.transform(Matrix.Diagonal((0.22, 1.0, 1.0, 1.0)))
    lib.transform(sp, lib.at(-w / 2 + t / 2 * 0.22, 0, (z0 + z1) / 2))
    fe = F("px", (w / 2 - square + 0.0006, 0, (z0 + z1) / 2))
    edge = lib.material(it, "edge", "#d8ccaf", rough=0.95, ao=False)
    for k in range(-3, 4):
        line_on(fe, [(-h / 2 + 0.004, k * (t - 2 * board) / 8), (h / 2 - 0.004, k * (t - 2 * board) / 8)], 0.0003, 0.00002, edge)


def encyclopedia(it: lib.Item) -> None:
    w, h, d = it.size
    cloth = lib.material(it, "cloth", it.color, rough=0.75)
    pages = lib.material(it, "pages", "#ece2c8", rough=0.9)
    gilt = lib.material(it, "gilt", "#c9a24a", metal=1.0, rough=0.35)
    ticket = lib.material(it, "ticket", "#d9c27a", rough=0.85)
    ink = lib.material(it, "ink", "#3a3328", rough=0.7, ao=False)
    t = d / 3
    for i in range(3):
        z0 = -d / 2 + i * t
        volume(it, w, h, z0 + 0.0003, z0 + t - 0.0003, cloth, pages, name=f"vol{i}")
        # spine: gilt bands, the series name, the volume number (top of the stack is volume 1)
        sm = F("nx", (-w / 2 - 0.0002, 0, z0 + t / 2))
        for x in (-0.09, -0.084, 0.084, 0.09):
            line_on(sm, [(x, -t * 0.32), (x, t * 0.32)], 0.0012, 0.0001, gilt)
        txt(sm, "БОЛЬШАЯ ЭНЦИКЛОПЕДИЯ", 0.0072, gilt, x=0.02, depth=0.0001, bold=0.4, spacing=1.05)
        txt(sm, str(3 - i), 0.016, gilt, x=-0.055, depth=0.0001, bold=0.8, rot=-math.pi / 2)
        txt(sm, "МОСТИЗДАТ", 0.0045, gilt, x=-0.075, depth=0.0001, spacing=1.1)
    # top cover: a gilt frame, the title, the imprint
    cm = F("front", (0.001, 0, d / 2 - 0.0003))
    line_on(cm, rr(w - 0.02, h - 0.02, 0.004, 4), 0.0012, 0.00008, gilt, closed=True)
    txt(cm, "БОЛЬШАЯ", 0.011, gilt, y=0.06, depth=0.00008, bold=0.6, spacing=1.2)
    txt(cm, "ЭНЦИКЛОПЕДИЯ", 0.011, gilt, y=0.042, depth=0.00008, bold=0.6, spacing=1.1)
    txt(cm, "1", 0.024, gilt, y=0.0, depth=0.00008, bold=0.8)
    poly_on(cm @ lib.at(0, -0.07, 0), lib.star_points(5, 0.007, 0.0028), 0.00008, gilt)
    txt(cm, "МОСТИЗДАТ • 1970", 0.0055, gilt, y=-0.095, depth=0.00008, spacing=1.15)
    # a tram ticket for a bookmark, out of the top of the middle volume
    lib.box("ticket", (0.025, 0.04, 0.0003), ticket, center=(0.02, h / 2 + 0.008, 0.0))
    tm = F("front", (0.02, h / 2 + 0.018, 0.00016))
    txt(tm, "ТРАМВАЙ", 0.0032, ink, depth=0.00001, bold=0.4)
    txt(tm, "№ 418 207", 0.0028, ink, y=-0.006, depth=0.00001)


def drawbridge(it: lib.Item) -> None:
    w, h, d = it.size
    cloth = lib.material(it, "cloth", "#3c4a3e", rough=0.75)
    pages = lib.material(it, "pages", "#e8dcbf", rough=0.9)
    jacket = lib.material(it, "jacket", "#dcd5c3", rough=0.8)
    faded = lib.material(it, "faded", it.color, rough=0.8)
    print_m = lib.material(it, "print", "#6c7f95", rough=0.8)
    silver = lib.material(it, "silver", "#a9aaa6", metal=1.0, rough=0.45)
    ink = lib.material(it, "ink", "#2a2a2a", rough=0.7, ao=False)
    jt = 0.0004
    volume(it, w, h, -d / 2 + jt, d / 2 - jt, cloth, pages, board=0.0022, name="book")
    # jacket over the front and back boards
    for zc, face in ((d / 2 - jt / 2, "front"), (-d / 2 + jt / 2, "back")):
        lib.box(f"jacket.{face}", (w - 0.002, h, jt), jacket, center=(0.001, 0, zc), bevel=0.00015, bevel_segments=1)
    # the jacket over the spine, chipped away at the top (cloth and silver showing)
    chip = 0.035
    lib.box("jacket.spine", (jt * 2, h - chip, d), jacket, center=(-w / 2 - jt * 0.5, -chip / 2, 0), bevel=0.00015, bevel_segments=1)
    sm = F("nx", (-w / 2 - jt * 1.6, 0, 0))
    txt(sm, "А. ЛУНИН", 0.0045, print_m, x=-0.03, depth=0.00002, bold=0.4)
    txt(sm, "РАЗВОДНОЙ МОСТ", 0.005, ink, x=0.02, depth=0.00002, bold=0.6)
    # silver stamping on the cloth, in the chip
    cm_ = F("nx", (-w / 2 - 0.0001, 0, 0))
    txt(cm_, "ЛУНИН", 0.0042, silver, x=h / 2 - chip / 2, depth=0.00008, bold=0.4)
    # front of the jacket: the faded drawbridge, title, author
    fm = F("front", (0.001, 0, d / 2))
    poly_on(fm, rr(w - 0.008, h - 0.008, 0.001, 3), 0.00002, faded)
    for s in (-1, 1):
        poly_on(fm @ lib.at(s * 0.035, -0.03, 0), [(-0.008, -0.025), (0.008, -0.025), (0.008, 0.02), (0, 0.03), (-0.008, 0.02)], 0.00002, print_m, z=0.00002)
        poly_on(fm @ lib.at(s * 0.027, -0.045, 0), [(0, 0.0), (0, 0.006), (-s * 0.026, 0.05), (-s * 0.03, 0.046)][:: s], 0.00002, print_m, z=0.00002)
    for k in range(3):
        line_on(fm, [(-0.055 + 0.01 * i, -0.065 - k * 0.006 + (0.0015 if i % 2 else -0.0015)) for i in range(12)], 0.0009, 0.00002, print_m, z=0.00004)
    txt(fm, "АРКАДИЙ ЛУНИН", 0.0062, ink, y=0.075, z=0.00002, spacing=1.15, bold=0.3)
    txt(fm, "РАЗВОДНОЙ", 0.011, ink, y=0.05, z=0.00002, bold=0.7, spacing=1.1)
    txt(fm, "МОСТ", 0.011, ink, y=0.034, z=0.00002, bold=0.7, spacing=1.1)
    txt(fm, "МОСТИЗДАТ  1962", 0.0042, ink, y=-0.09, z=0.00002, spacing=1.2)
    # back of the jacket: the colophon block and the price
    bm = F("back", (0.001, 0, -d / 2))
    for i, line in enumerate(("Лунин А. Разводной мост: Роман.", "Мостиздат, 1962. — 312 с.", "Подписано к печати 14.III.1962", "Тираж 15 000 экз.", "Цена 92 коп.")):
        txt(bm, line, 0.0036, ink, y=-0.03 - i * 0.0065, depth=0.00002)


BUILDERS = {"books_mostizdat_encyclopedia": encyclopedia, "book_lunin_drawbridge": drawbridge}


def build(it: lib.Item) -> None:
    global PRINT
    it.ao_size = 1024
    P._n[0] = 0
    it.size = tuple(it.model["size"])
    PRINT = max(0.00002, max(it.size) * 0.00018)
    BUILDERS[it.id](it)
