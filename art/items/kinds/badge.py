"""
Guards badge, wartime pattern: an oval wreath of gilt oak leaves, a red enamel star
at its heart on a field of fine rays, and a red enamel banner across the top
reading ГВАРДИЯ in gilt, hung from a staff. Plain darkened back with the maker's
stamp, a thick screw post and a large flat nut.

Placeholder convention (src/render/items.ts): oval wreath plate ≈ 0.036 × 0.04
centred at y = −0.003, front +Z (≈ 0.001–0.002), banner on top to y ≈ 0.021,
back at z ≈ −0.0014, screw post behind to z ≈ −0.011, nut r 0.011 at z ≈ −0.0078.
"""

from __future__ import annotations

import math

import lib
from kinds import _award as aw

CY = -0.003
BACK, FIELD = -0.0012, 0.0004
LEAF_H = 0.0011
STAR_C = (0.0, -0.0045)
NUT_Z0, NUT_Z1, NUT_R = -0.00705, -0.00855, 0.011
POST_END = -0.0104

AO_DISTANCE = 0.0012


def oak_leaf(cx: float, cy: float, length: float, width: float, ang: float, lobes: int = 3) -> list[tuple[float, float]]:
    """A lobed oak leaf, base at (cx, cy), pointing along `ang`."""
    n = 14
    right, left = [], []
    for k in range(n + 1):
        t = k / n
        w = width / 2 * (math.sin(math.pi * min(t * 1.08, 1)) ** 0.75) * (0.78 + 0.22 * math.cos(2 * math.pi * lobes * t))
        right.append((t * length, -w))
        left.append((t * length, w))
    pts = right + left[::-1][1:-1]
    ca, sa = math.cos(ang), math.sin(ang)
    return [(cx + x * ca - y * sa, cy + x * sa + y * ca) for x, y in pts]


def solid(name: str, pts, height: float, mat, bevel: float):
    """Wreath relief that overhangs the plate: struck through, so it has a back of its own."""
    z0 = BACK + 0.0001
    return lib.polygon(name, pts, FIELD + height - z0, mat, z=z0, facing=1, bevel=bevel, base=True)


def wreath(it: lib.Item, gilt) -> None:
    rx, ry = 0.0149, 0.0168
    r = aw.rng(it, "wreath")

    def P(th: float, off: float = 0.0):
        x, y = (rx + off) * math.cos(th), CY + (ry + off) * math.sin(th)
        return x, y

    for s in (-1, 1):
        # a branch from the bow at the bottom up the side to under the banner
        ths = [math.radians(270 + s * d) for d in range(6, 168, 4)]
        stem = [P(t) for t in ths]
        lib.stroke(f"stem.{s}", stem, 0.0006, LEAF_H * 0.45, gilt, z=FIELD)
        for k, th in enumerate(ths[1::3]):
            side = 1 if k % 2 == 0 else -1
            base = P(th, side * 0.0004)
            # tangent pointing up the branch
            tx, ty = -rx * math.sin(th) * s, ry * math.cos(th) * s
            tang = math.atan2(ty, tx)
            ang = tang + side * 0.62 * (1 if s > 0 else -1) * -1
            pts = oak_leaf(*base, 0.0058 + r.uniform(-0.0004, 0.0004), 0.0029, ang)
            solid(f"leaf.{s}.{k}", pts, LEAF_H * (1 + 0.04 * (k % 3)), gilt, 0.00012)
            # veins: a midrib and short side veins, standing crisp on the leaf
            top = FIELD + LEAF_H * (1 + 0.04 * (k % 3)) - 0.00004
            ca, sa = math.cos(ang), math.sin(ang)
            L = 0.0052
            lib.stroke(f"vein.{s}.{k}", [(base[0] + ca * 0.0004, base[1] + sa * 0.0004), (base[0] + ca * L, base[1] + sa * L)], 0.00022, 0.00014, gilt, z=top)
            for t, sd in ((0.35, 1), (0.5, -1), (0.62, 1), (0.75, -1)):
                bx, by = base[0] + ca * L * t, base[1] + sa * L * t
                vx, vy = ca * 0.6 - sa * sd * 0.8, sa * 0.6 + ca * sd * 0.8
                lib.stroke(f"vein.{s}.{k}.{t}", [(bx, by), (bx + vx * 0.0011, by + vy * 0.0011)], 0.00014, 0.0001, gilt, z=top)
        # acorns between the leaves
        for k, th in enumerate(ths[3::6]):
            ax, ay = P(th, 0.0014 if k % 2 else -0.0013)
            solid(f"acorn.{s}.{k}", aw.ellipse(ax, ay, 0.0008, 0.0011, 12, rot=th), LEAF_H * 1.08, gilt, 0.0002)
            solid(f"cup.{s}.{k}", aw.ellipse(ax - 0.0006 * math.cos(th), ay - 0.0006 * math.sin(th), 0.00085, 0.0006, 10, rot=th), LEAF_H * 1.14, gilt, 0.00015)
    # the bow tying the branches at the bottom
    bx, by = 0.0, CY - ry
    for s in (-1, 1):
        solid(f"bow.{s}", [(bx, by), (bx + s * 0.0028, by + 0.0012), (bx + s * 0.0032, by - 0.0006), (bx + s * 0.0012, by - 0.0004)], LEAF_H * 1.1, gilt, 0.00015)
        solid(f"tail.{s}", [(bx + s * 0.0004, by - 0.0003), (bx + s * 0.0016, by - 0.0003), (bx + s * 0.0026, by - 0.0032), (bx + s * 0.0016, by - 0.0028)], LEAF_H * 0.95, gilt, 0.00012)
    solid("bow.knot", aw.ellipse(bx, by, 0.0008, 0.0007, 12), LEAF_H * 1.2, gilt, 0.0002)


def rays(it: lib.Item, gilt) -> None:
    """Fine raised rays on the field between the star and the wreath."""
    cx, cy = STAR_C
    for i in range(40):
        a = 2 * math.pi * i / 40 + 0.04
        r0 = 0.0042
        # stop short of the wreath's inner edge
        ex, ey = 0.0118 * math.cos(a), 0.0136 * math.sin(a)
        r1 = math.hypot(ex, ey + (CY - cy)) - 0.0006
        lib.stroke(f"ray.{i}", [(cx + r0 * math.cos(a), cy + r0 * math.sin(a)), (cx + r1 * math.cos(a), cy + r1 * math.sin(a))], 0.00022, 0.00012, gilt, z=FIELD, round_caps=False)


def star(it: lib.Item, gilt, enamel) -> None:
    outline = lib.star_points(5, 0.0078, 0.0032, STAR_C)
    lib.polygon("star", outline, 0.0008, gilt, z=FIELD - 0.0002, facing=1, bevel=0.00015)
    inset = aw.offset_polygon(outline, 0.00042)
    cx, cy = STAR_C
    r_out = math.hypot(inset[0][0] - cx, inset[0][1] - cy)
    r_in = math.hypot(inset[1][0] - cx, inset[1][1] - cy)
    aw.faceted_star("star.enamel", enamel, r_out=r_out, r_in=r_in, center=STAR_C, z_base=FIELD + 0.0004, z_edge=FIELD + 0.00072, z_tip=FIELD + 0.0009, z_apex=FIELD + 0.0017)


def _wave(x: float) -> float:
    return 0.00055 * math.sin(math.pi * (x + 0.002) / 0.011)


X0, X1 = -0.0150, 0.0158
YT, YB = 0.0207, 0.0119


def banner(it: lib.Item, gilt, enamel) -> None:
    """A waving banner from the staff on the left, gilt edged, hand-filled red enamel."""
    n = 24
    top = [(X0 + (X1 - X0) * k / n, YT + _wave(X0 + (X1 - X0) * k / n)) for k in range(n + 1)]
    bot = [(X0 + (X1 - X0) * k / n - 0.0004 * k / n, YB + _wave(X0 + (X1 - X0) * k / n)) for k in range(n + 1)]
    bot[-1] = (X1 - 0.0016, bot[-1][1])  # the free end cut on a slant
    outline = top + bot[::-1]
    b = lib.polygon("banner", outline, 0.0014 - (BACK + 0.0002), gilt, z=BACK + 0.0002, facing=1, bevel=0.0002)
    lib.auto_smooth(b, 40)
    # hand-filled enamel: inset from the gilt edge, a little uneven
    r = aw.rng(it, "enamel")
    inset = aw.offset_polygon(outline, 0.00058)
    inset = [(x + r.uniform(-1, 1) * 0.00006, y + r.uniform(-1, 1) * 0.00006) for x, y in inset]
    lib.polygon("banner.enamel", inset, 0.0009, enamel, z=0.001, facing=1, bevel=0.00008, base=False)
    # gilt letters following the wave
    word = "ГВАРДИЯ"
    size = 0.0049
    step = 0.0035
    for i, ch in enumerate(word):
        x = (i - (len(word) - 1) / 2) * step + 0.0004
        ymid = (YT + YB) / 2 + _wave(x)
        slope = math.atan(0.00055 * math.pi / 0.011 * math.cos(math.pi * (x + 0.002) / 0.011))
        aw.text(f"banner.{i}", ch, size, 0.00034, gilt, pos=(x, ymid, 0.0019), rot_z=slope, facing=1, bold=2.5)
    # staff with a spear-point finial and a tassel
    sx = X0 - 0.0007
    lib.cylinder("staff", 0.00058, 0.0158, gilt, axis="y", center=(sx, 0.0142, 0.0004), segments=12, bevel=0.0002)
    lib.polygon("finial", [(sx, 0.0236), (sx + 0.0009, 0.0222), (sx, 0.0216), (sx - 0.0009, 0.0222)], 0.0013, gilt, z=-0.0003, facing=1, bevel=0.0002)
    lib.polygon("tassel", [(sx + 0.0006, 0.0196), (sx + 0.0016, 0.0188), (sx + 0.0019, 0.0166), (sx + 0.0009, 0.0168)], 0.0011, gilt, z=0.0005, facing=1, bevel=0.00015, base=False)


def build(it: lib.Item) -> None:
    it.ao_size = 1024
    color = it.color
    gilt = lib.material(it, "gilt", lib.shade(color, 1.04), metal=1.0, rough=0.28)
    field = lib.material(it, "field", lib.shade(color, 0.9), metal=1.0, rough=0.42)
    enamel = lib.material(it, "enamel", "#9c1c22", metal=0.0, rough=0.18)
    back = lib.material(it, "back", lib.shade(color, 0.6), metal=1.0, rough=0.55)

    plate = lib.polygon("plate", aw.ellipse(0, CY, 0.0165, 0.0186, 64), FIELD - BACK, field, z=BACK, facing=1, bevel=0.0003)
    lib.auto_smooth(plate, 40)
    wreath(it, gilt)
    rays(it, gilt)
    star(it, gilt, enamel)
    banner(it, gilt, enamel)

    # back: the maker's stamp punched beside the post, then everything facing back darkened
    aw.stamp(plate, it, "ММД", size=0.0022, x=0.0084, y=-0.0102, z=BACK, facing=-1, depth=0.00012, uneven=0.4, spacing=0.74)
    aw.back_material(plate, back)
    for o in lib.mesh_objects():
        if o.name in ("banner", "staff", "finial") or o.name.startswith(("leaf", "acorn", "cup", "bow", "tail")):
            aw.back_material(o, back)
    aw.threaded_post("screw", 0.0018, BACK, POST_END, back, pitch=0.0006, depth=0.00012, worn=0.8)
    prof = [(0.0019, NUT_Z0), (NUT_R - 0.0004, NUT_Z0), (NUT_R, NUT_Z0 - 0.0003), (NUT_R, NUT_Z1 + 0.0003), (NUT_R - 0.0004, NUT_Z1), (0.0019, NUT_Z1), (0.0019, NUT_Z0)]
    nut = lib.lathe("nut", prof, back, segments=64, axis="z", cap=False)
    lib.auto_smooth(nut, 35)
