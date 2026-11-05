"""
Gold cross pendant: flared arms with rounded edges and ball terminals, a raised
border line and a beaded rosette on the front, 585 and a maker's mark struck on the
back of the crossbar, and a soldered eye, jump ring and bail on top (the bail worn
bright where the chain ran).

Placeholder convention (src/render/items.ts): a cross ≈ 0.019 × 0.035 in XY, bail
on top at +Y (≈ 0.018), face +Z, 1.8 mm thick. Hotspots: bail (0, 0.0185, 0),
front (0, 0, 0.0011), back (0, 0.006, −0.0011).
"""

from __future__ import annotations

import math

import bmesh
import lib
from kinds import _gold as G
from mathutils import Matrix

AO_DISTANCE = 0.0006

T = 0.0009  # half thickness
YC = 0.006  # crossbar centre
TOP, BOT, SIDE = 0.0130, -0.0170, 0.0095  # arm ends
WC, WE = 0.0019, 0.0023  # arm half widths at the crossing and at the ends
MAKER = "МЮЗ"


def outline(i: float = 0.0) -> list[tuple[float, float]]:
    """Cross outline, counter-clockwise, inset by i."""
    wc, we = WC - i, WE - i
    top, bot, side = TOP - i, BOT + i, SIDE - i
    return [
        (we, bot), (wc, YC - wc),
        (side, YC - we), (side, YC + we),
        (wc, YC + wc), (we, top),
        (-we, top), (-wc, YC + wc),
        (-side, YC + we), (-side, YC - we),
        (-wc, YC - wc), (-we, bot),
    ]


def build(it: lib.Item) -> None:
    it.ao_size = 1024
    gold = G.gold(it, 0.15)
    bright = lib.material(it, "bright", lib.shade(it.color, 1.03), metal=1.0, rough=0.06)
    stamp = G.stamp_mat(it)

    # body: an exact prism (lib.polygon jitters the height, which would bury the relief)
    bm = bmesh.new()
    lib.prism(bm, outline(), -T, 2 * T)
    body = lib.mesh_object("cross", bm, gold)
    lib.add_bevel(body, 0.00038, 2)

    # ball terminals on the four arm ends
    for x, y in ((0, TOP + 0.0004), (0, BOT - 0.0004), (SIDE + 0.0004, YC), (-SIDE - 0.0004, YC)):
        G.sphere("ball", 0.00125, gold, (x, y, 0), seg=20, rings=10, scale=(1, 1, 0.78))

    # front: a raised, bevelled inner panel, a border line round it, a beaded
    # rosette and a glory of rays at the crossing
    panel = lib.polygon("panel", outline(0.0009), 0.00012, gold, z=T - 0.00002, bevel=0.00006, base=False)
    lib.auto_smooth(panel, 50)
    lib.stroke("border", outline(0.00052), 0.00012, 0.00006, gold, z=T - 0.00002, closed=True)
    zf = T + 0.0001
    lib.dots("rosette", lib.ring_points(10, 0.00105, (0, YC)), 0.00017, 0.00012, gold, z=zf)
    lib.dots("boss", [(0, YC)], 0.00055, 0.00028, gold, z=zf, segments=16)
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2
        lib.stroke(f"ray.{k}", [(0.0014 * math.cos(a), YC + 0.0014 * math.sin(a)), (0.0026 * math.cos(a), YC + 0.0026 * math.sin(a))], 0.00016, 0.00008, gold, z=zf - 0.00002)
        for sgn in (-1, 1):
            b = a + sgn * 0.3
            lib.stroke(f"ray.{k}.{sgn}", [(0.0014 * math.cos(b), YC + 0.0014 * math.sin(b)), (0.0021 * math.cos(b), YC + 0.0021 * math.sin(b))], 0.0001, 0.00006, gold, z=zf - 0.00002)
    # small beads down the arms of the panel
    for x, y in [(0, YC + 0.0026 + 0.0011 * k) for k in range(4)] + [(0, YC - 0.0026 - 0.0011 * k) for k in range(13)] + [(sx * (0.0026 + 0.0011 * k), YC) for k in range(5) for sx in (-1, 1)]:
        lib.dots("bead", [(x, y)], 0.00024, 0.00014, gold, z=zf)

    # back of the crossbar: 585 and the maker's mark, reading from behind
    hm = G.hallmark("hm", "585", MAKER, stamp, digit=0.00052)
    G.place(hm, lib.at(0, YC, -T + 0.00001) @ lib.rot("y", math.pi))

    # the prayer down the back of the upright, letter under letter
    words = ["СПАСИ", "И", "СОХРАНИ"]
    y = YC - WC - 0.0011
    for wi, w in enumerate(words):
        for ch in w:
            lib.text(f"pray.{y:.4f}", ch, 0.00098, 0.00006, stamp, pos=(0, y, -T + 0.00001), facing=-1, bold=0.8)
            y -= 0.00118
        y -= 0.00035
    # eye soldered on the top ball, jump ring through it, bail on the jump ring
    G.torus("eye", 0.0006, 0.00025, gold, lib.at(0, TOP + 0.0004 + 0.00145, 0) @ lib.rot("y", math.pi / 2), seg=16, sides=8)
    G.torus("jump", 0.0008, 0.00028, gold, lib.at(0, 0.0158, 0), seg=20, sides=8)
    bm = bmesh.new()
    G.oval_into(bm, lib.at(0, 0.0175, 0) @ lib.rot("y", math.pi / 2) @ Matrix.Diagonal((1, 1, 1, 1)), 0.0011, 0.0013, 0.00045, seg=28, sides=10, sz=1.0)
    for f in bm.faces:
        f.smooth = True
    lib.mesh_object("bail", bm, bright)
