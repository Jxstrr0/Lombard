"""
A pair of gold drop earrings with English locks: a domed shield with a milgrain
border, the hinged ear lever behind it (583 + assay star struck on the back of the
shield), a teardrop wire frame hanging from a jump eye, and a clear round
brilliant held by four claws in a basket.

Placeholder convention (src/render/items.ts): the pair side by side along X,
centres at x = ±0.009, ≈ 0.03 tall, fronts +Z. Hotspots: lock_left (−0.009, 0.012, 0),
lock_right (0.009, 0.012, 0), stones (−0.009, −0.008, 0.002).
"""

from __future__ import annotations

import math

import bmesh
import lib
from kinds import _gold as G
from mathutils import Vector

AO_DISTANCE = 0.0006

PLATE_Y = 0.0118  # centre of the lock shield
PA, PB = 0.0019, 0.0029  # shield half axes (x, y)
STONE_Y = -0.008
STONE_R = 0.0021
GIRDLE_Z = 0.0008
FRAME_R = 0.0029  # wire frame round the stone
TIP_Y = 0.0076  # top of the teardrop frame
EYE_Y = PLATE_Y - PB - 0.0002  # the lock's eye, under the shield


def shield(cx: float, gold, stamp) -> None:
    """Domed oval shield of the lock, milgrain round the front, stamp on the back."""
    prof = [(0, -0.00035), (1.0, -0.00035), (1.0, -0.0001), (0.97, 0.00012), (0.85, 0.00028), (0.6, 0.0004), (0.3, 0.00046), (0, 0.00048)]
    prof = [(r * PB, z) for r, z in prof]
    o = lib.lathe("shield", prof, gold, segments=40, axis="z", cap=False)
    o.data.transform(lib.at(cx, PLATE_Y, 0) @ __import__("mathutils").Matrix.Diagonal((PA / PB, 1, 1, 1)))
    lib.auto_smooth(o, 50)
    # milgrain: tiny beads just inside the edge, on the sloping front
    n = 30
    pts = [(cx + PA * 0.86 * math.cos(2 * math.pi * i / n), PLATE_Y + PB * 0.86 * math.sin(2 * math.pi * i / n)) for i in range(n)]
    lib.dots("milgrain", pts, 0.00016, 0.00012, gold, z=0.00012)
    # a small raised four-petal flower in the middle
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2
        c = (cx + 0.0006 * math.cos(a), PLATE_Y + 0.0009 * math.sin(a))
        petal = [(c[0] + 0.00045 * math.cos(t) * math.cos(a) - 0.00022 * math.sin(t) * math.sin(a), c[1] + 0.00045 * math.cos(t) * math.sin(a) * 1.4 + 0.00022 * math.sin(t) * math.cos(a)) for t in [2 * math.pi * i / 12 for i in range(12)]]
        lib.polygon(f"petal.{k}", petal, 0.0001, gold, z=0.0004, bevel=0.00003, base=False)
    lib.dots("centre", [(cx, PLATE_Y)], 0.00022, 0.00018, gold, z=0.00044)
    # 583 + star on the back, reading from behind (rotated π about Y)
    hm = G.hallmark("hm", "583", "star", stamp, digit=0.00042)
    # beside the lever, which covers the middle of the back, reading upwards
    G.place(hm, lib.at(cx + 0.00095, PLATE_Y, -0.00035) @ lib.rot("y", math.pi) @ lib.rot("z", math.pi / 2))


def lever(cx: float, gold) -> None:
    """The hinged ear lever of the English lock, swung shut into its catch."""
    pts = [(0.0091, -0.0006), (0.0080, -0.0021), (0.0088, -0.0039), (0.0118, -0.0047), (0.0148, -0.0038), (0.0160, -0.0019), (0.0153, -0.0007)]
    path = G.catmull([(cx, y, z) for y, z in pts], 6)
    G.tube("lever", path, 0.0003, gold, sides=8, up=(1, 0, 0))
    lib.cylinder("hinge", 0.00042, 0.0013, gold, segments=16, axis="x", center=(cx, 0.0091, -0.00065), bevel=0.0001)
    lib.box("catch", (0.0012, 0.0009, 0.0007), gold, center=(cx, 0.0149, -0.00062), bevel=0.0002)


def stone(cx: float, mat) -> None:
    """A round brilliant (simplified facets: table, 8/16 crown, 8 pavilion mains)."""
    R = STONE_R
    bm = bmesh.new()
    c = Vector((cx, STONE_Y, 0))

    def ring(n, r, z, ph=0.0):
        return [bm.verts.new(c + Vector((r * math.cos(ph + 2 * math.pi * i / n), r * math.sin(ph + 2 * math.pi * i / n), z))) for i in range(n)]

    table = ring(8, R * 0.56, GIRDLE_Z + R * 0.33)
    crown = ring(8, R * 0.82, GIRDLE_Z + R * 0.17, math.pi / 8)
    g_top = ring(16, R, GIRDLE_Z + R * 0.02)
    g_bot = ring(16, R, GIRDLE_Z - R * 0.02)
    pav = ring(8, R * 0.45, GIRDLE_Z - R * 0.55, math.pi / 8)
    culet = bm.verts.new(c + Vector((0, 0, GIRDLE_Z - R * 0.86)))
    bm.faces.new(table)
    for i in range(8):
        j = (i + 1) % 8
        bm.faces.new((table[i], crown[i], table[j]))  # star facets
        bm.faces.new((table[i], crown[(i - 1) % 8], crown[i]))  # kites (split)
    for i in range(8):
        j = (i + 1) % 8
        a, b_, cc = g_top[2 * i], g_top[2 * i + 1], g_top[(2 * i + 2) % 16]
        bm.faces.new((crown[(i - 1) % 8], a, crown[i]))
        bm.faces.new((crown[i], a, b_))
        bm.faces.new((crown[i], b_, cc))
    for i in range(16):
        j = (i + 1) % 16
        bm.faces.new((g_top[i], g_bot[i], g_bot[j], g_top[j]))
    for i in range(8):
        a, b_, cc = g_bot[2 * i], g_bot[2 * i + 1], g_bot[(2 * i + 2) % 16]
        bm.faces.new((pav[(i - 1) % 8], a, pav[i]))
        bm.faces.new((pav[i], a, b_))
        bm.faces.new((pav[i], b_, cc))
        bm.faces.new((pav[i], pav[(i + 1) % 8], culet))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        f.smooth = False
    lib.mesh_object("stone", bm, mat)


def setting(cx: float, gold) -> None:
    """Basket under the stone, four claws over its crown, bridges out to the frame."""
    c = Vector((cx, STONE_Y, 0))
    G.torus("collet", STONE_R * 0.98, 0.00017, gold, lib.at(cx, STONE_Y, GIRDLE_Z - 0.00022), seg=32, sides=6)
    G.torus("basket", STONE_R * 0.62, 0.00016, gold, lib.at(cx, STONE_Y, GIRDLE_Z - 0.0011), seg=24, sides=6)
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2
        d = Vector((math.cos(a), math.sin(a), 0))
        pts = [
            c + d * STONE_R * 0.62 + Vector((0, 0, GIRDLE_Z - 0.0011)),
            c + d * STONE_R * 0.9 + Vector((0, 0, GIRDLE_Z - 0.0005)),
            c + d * STONE_R * 1.06 + Vector((0, 0, GIRDLE_Z + 0.0001)),
            c + d * STONE_R * 0.98 + Vector((0, 0, GIRDLE_Z + 0.00048)),
            c + d * STONE_R * 0.84 + Vector((0, 0, GIRDLE_Z + 0.00062)),
        ]
        G.tube(f"claw.{k}", G.catmull(pts, 4), lambda t: 0.00026 - 0.00006 * t, gold, sides=6)
        G.sphere(f"claw.tip.{k}", 0.00021, gold, c + d * STONE_R * 0.84 + Vector((0, 0, GIRDLE_Z + 0.0006)), seg=8, rings=4, scale=(1, 1, 0.7))
    # bridges from the collet to the frame (left, right, bottom)
    for a in (0.0, math.pi, -math.pi / 2):
        d = Vector((math.cos(a), math.sin(a), 0))
        G.tube(f"bridge.{a:.1f}", [c + d * STONE_R * 0.95 + Vector((0, 0, GIRDLE_Z - 0.0003)), c + d * FRAME_R + Vector((0, 0, 0))], 0.00018, gold, sides=6)


def frame(cx: float, gold) -> None:
    """Teardrop wire frame: tangent sides from the tip, round the stone at the bottom."""
    d = TIP_Y - STONE_Y
    th = math.asin(FRAME_R / d)
    pts = []
    tip = Vector((0, d))
    pr = Vector((FRAME_R * math.cos(th), FRAME_R * math.sin(th)))
    for k in range(1, 8):  # right side, tip → tangent point, bowed slightly outward
        t = k / 8
        p = tip.lerp(pr, t)
        p.x += 0.00035 * math.sin(math.pi * t)
        pts.append(p)
    for k in range(25):  # round the bottom
        a = th - (math.pi + 2 * th) * k / 24
        pts.append(Vector((FRAME_R * math.cos(a), FRAME_R * math.sin(a))))
    for k in range(7, 0, -1):
        t = k / 8
        p = tip.lerp(Vector((-pr.x, pr.y)), t)
        p.x -= 0.00035 * math.sin(math.pi * t)
        pts.append(p)
    pts.append(tip.copy())
    path = [Vector((cx + p.x, STONE_Y + p.y, 0)) for p in pts]
    G.tube("frame", path, 0.00038, gold, sides=8, closed=True)
    # polished leaf filling the narrow top of the drop: midrib and side veins raised
    def half_w(h: float) -> float:
        t = (h - pr.y) / (d - pr.y)
        return pr.x * (1 - t) + 0.00035 * math.sin(math.pi * t)

    h0, h1 = 0.0024, 0.0148
    right, left = [], []
    for k in range(13):
        h = h0 + (h1 - h0) * k / 12
        w = max(half_w(h) - 0.00062, 0.0) * math.sin(math.pi * k / 12) ** 0.6
        right.append((cx + w, STONE_Y + h))
        left.append((cx - w, STONE_Y + h))
    leaf = right + left[::-1][1:-1]
    lib.polygon("leaf", leaf, 0.0006, gold, z=-0.0003, bevel=0.00017)
    lib.stroke("vein", [(cx, STONE_Y + h0 + 0.0004), (cx, STONE_Y + h1 - 0.0006)], 0.00013, 0.00007, gold, z=0.0003)
    for k in range(5):
        h = h0 + 0.0016 + k * 0.0019
        w = max(half_w(h + 0.0012) - 0.0009, 0.0002)
        for sgn in (-1, 1):
            lib.stroke(f"vein.{k}.{sgn}", [(cx, STONE_Y + h), (cx + sgn * w, STONE_Y + h + 0.0012)], 0.0001, 0.00005, gold, z=0.00026)
    # eyes: the drop's (in the XY plane) through the lock's (across X)
    G.torus("eye.drop", 0.00048, 0.00016, gold, lib.at(cx, EYE_Y - 0.00048, 0), seg=16, sides=6)
    G.torus("eye.lock", 0.00048, 0.00016, gold, lib.at(cx, EYE_Y, 0) @ lib.rot("y", math.pi / 2), seg=16, sides=6)


def build(it: lib.Item) -> None:
    it.ao_size = 1024
    gold = G.gold(it, 0.12)
    stamp = G.stamp_mat(it)
    gem = lib.material(it, "stone", "#e6eefa", metal=0.5, rough=0.02, alpha=0.5, ao=False)
    for cx in (-0.009, 0.009):
        shield(cx, gold, stamp)
        lever(cx, gold)
        frame(cx, gold)
        setting(cx, gold)
        stone(cx, gem)
