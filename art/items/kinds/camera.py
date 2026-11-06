"""
Cameras: two 35 mm SLRs (Zenit-E and its TTL sibling, Kanon AE-2) and a screw-mount rangefinder (Weissler IIIc).
The M6 wave-B Kanon PowerPix, Kanon D450, Kanon zoom lens and Nevka 8M are box-kind (kinds/box.py).

Placeholder convention (src/render/items.ts): body 0.14 × 0.075 × 0.04, top plate
up to y ≈ 0.042, lens along +Z centred at y = −0.006 to z ≈ 0.064 (SLR) / 0.06
(rangefinder); an SLR prism hump rises to y ≈ 0.064; back −Z. As on the
placeholder, the shutter dial sits at +X and the rewind knob at −X.

Hotspots the models are built round:
  SLR   lens (0, −0.006, 0.066) on the front element · prism (0, 0.06, 0.012) on the
        nameplate · top (0.043, 0.0425, 0.004) on the top plate under the shutter dial ·
        back (0, −0.004, −0.0205) on the film door
  IIIc  lens (0, −0.006, 0.062) · top (−0.03, 0.0405, 0.004) on the engraving ·
        windows (0.042, 0.028, 0.0205) on the rangefinder window · back

The leatherette is real relief: a grid wrapped round the body with a random
grain pushed out of it (kinds/_optics.band). Each camera stays at 6 materials.
"""

from __future__ import annotations

import math

import lib
from kinds import _optics as op
from kinds import lens as lens_kind

AO_DISTANCE = 0.003

LENS_Y = -0.006
PLATE_TOP = 0.0422  # SLR top plate surface
HALF_W = 0.070
HALF_D = 0.0205


# ---------------------------------------------------------------------------
# Small parts


def knob(name: str, x: float, z: float, y0: float, h: float, r_valley: float, r_peak: float, n: int, mat, cap_mat=None, *, dome: float = 0.0004) -> float:
    """A knurled knob standing on a plate at height y0, with a slightly domed cap. Returns its top y."""
    k = op.knurl(name, r_valley, r_peak, 0.0, h, n, mat, chamfer=0.0004, top=0.4)
    lib.transform(k, lib.at(x, y0, z) @ lib.rot("x", -math.pi / 2))
    r = r_valley
    lib.lathe(f"{name}.cap", [(r, h - 0.0001), (r * 0.97, h + dome * 0.5), (r * 0.75, h + dome), (0, h + dome)], cap_mat or mat, segments=48, axis="y", center=(x, y0, z))
    return y0 + h + dome


def disc(name: str, x: float, z: float, y0: float, h: float, r: float, mat, *, chamfer: float = 0.0003, segments: int = 48) -> float:
    """A plain round plate/collar standing at y0. Returns its top y."""
    c = min(chamfer, h * 0.45)
    lib.lathe(name, [(0, 0), (r, 0), (r, h - c), (r - c, h), (0, h)], mat, segments=segments, axis="y", center=(x, y0, z))
    return y0 + h


def arm(name: str, p0, p1, w0: float, w1: float, y0: float, h: float, mat) -> None:
    """A flat tapered lever in plan from p0 to p1 (x, z)."""
    dx, dz = p1[0] - p0[0], p1[1] - p0[1]
    ln = math.hypot(dx, dz)
    nx, nz = -dz / ln, dx / ln
    pts = [(p0[0] + nx * w0 / 2, p0[1] + nz * w0 / 2), (p1[0] + nx * w1 / 2, p1[1] + nz * w1 / 2), (p1[0] - nx * w1 / 2, p1[1] - nz * w1 / 2), (p0[0] - nx * w0 / 2, p0[1] - nz * w0 / 2)]
    op.plan_poly(name, pts, y0, h, mat, bevel=0.0002)


def lug(name: str, side: int, y: float, mat) -> None:
    """A strap lug: a short post and a ring on the body end."""
    x = side * (HALF_W + 0.0004)
    lib.cylinder(f"{name}.post", 0.0016, 0.0024, mat, axis="x", center=(x + side * 0.0008, y, 0), segments=16)
    ring_prof = [(0.0029 + 0.0007 * math.cos(t), 0.0007 * math.sin(t)) for t in [2 * math.pi * i / 8 for i in range(9)]]
    lib.lathe(f"{name}.ring", ring_prof, mat, segments=20, axis="z", center=(x + side * 0.0036, y, 0), cap=False)


def front_window(name: str, x: float, y: float, w: float, h: float, z: float, bezel, glass, dark) -> None:
    """A rangefinder/viewfinder window on a front face at z: dark backing, tinted glass, raised bezel."""
    r = min(w, h) * 0.32
    pts = [(x + px, y + py) for px, py in op.rrect(w / 2, h / 2, r, 4)]
    lib.polygon(f"{name}.back", pts, 0.00012, dark, z=z, base=False)
    lib.polygon(f"{name}.glass", pts, 0.0002, glass, z=z, base=False)
    outer = [(x + px, y + py) for px, py in op.rrect(w / 2 + 0.0004, h / 2 + 0.0004, r + 0.0004, 4)]
    lib.stroke(f"{name}.bezel", outer, 0.0008, 0.00045, bezel, z=z, closed=True, round_caps=False)


def back_window(name: str, x: float, y: float, w: float, h: float, z: float, depth: float, frame_mat, glass, dark) -> None:
    """An eyepiece on a back face at z (facing −Z): a raised frame with a dark window."""
    lib.box(f"{name}.frame", (w, h, depth), frame_mat, center=(x, y, z - depth / 2), bevel=min(0.0008, depth * 0.4))
    pts = [(x + px, y + py) for px, py in op.rrect(w / 2 - 0.0016, h / 2 - 0.0016, 0.001, 3)]
    lib.polygon(f"{name}.dark", pts, 0.00008, dark, z=z - depth, facing=-1, base=False)
    lib.polygon(f"{name}.glass", pts, 0.00016, glass, z=z - depth, facing=-1, base=False)


def tripod_socket(name: str, x: float, z: float, y: float, metal, dark) -> None:
    lib.lathe(f"{name}.ring", [(0.0038, 0), (0.0038, -0.0004), (0.0032, -0.0006), (0.0026, -0.0006), (0.0026, 0.0)], metal, segments=32, axis="y", center=(x, y, z), cap=False)
    lib.lathe(f"{name}.hole", [(0, -0.0002), (0.0026, -0.0002)], dark, segments=32, axis="y", center=(x, y, z), cap=False)


def place_lens(grab: op.Grab, z_shoulder_local: float, z_camera: float, sz: float = 1.0) -> None:
    grab.place(lib.at(0, LENS_Y, z_camera - z_shoulder_local * sz) @ op.scale(1, 1, sz))


# ---------------------------------------------------------------------------
# SLR body (Zenit-E, Kanon AE-2)


def slr_body(it: lib.Item, m: dict, *, plate, flange, leather_seed: int, grain: float, prism_pts, prism_bevel: float, flat: bool = False) -> None:
    op.band("leather", HALF_W - 0.0005, 0.0198, 0.004, -0.0345, 0.0336, m["leather"], spacing=0.0020, amp=grain, thick=0.0002, holes=[(0, LENS_Y, 0.0240)], seed=leather_seed, flat=flat)
    op.slab("top", HALF_W, HALF_D, 0.0045, op.round_prof(0.0330, PLATE_TOP, 0.0005, 0.0022), plate)
    op.slab("bottom", HALF_W, HALF_D, 0.0045, op.round_prof(-0.0368, -0.0340, 0.0016, 0.0003), plate)
    op.hull("prism", prism_pts, plate, bevel=prism_bevel)
    with op.Grab() as g:
        op.ring("flange", [(0.0205, 0.0190), (0.0262, 0.0190), (0.0262, 0.0218), (0.0256, 0.0225), (0.0212, 0.0225)], flange, segments=72)
    g.place(lib.at(0, LENS_Y, 0))
    for side in (-1, 1):
        lug(f"lug{side}", side, 0.025, m["chrome"])
    tripod_socket("tripod", 0.0, 0.0, -0.0368, m["chrome"], m["dark"])


def prism_pts(y_shoulder: float, y_back: float, y_top: float, z_front: float, z_back: float, z_top_front: float, z_top_back: float, w_base: float, w_top: float):
    pts = []
    for s in (-1, 1):
        pts += [
            (s * w_base, PLATE_TOP - 0.0007, z_front),
            (s * w_base, PLATE_TOP - 0.0007, z_back),
            (s * (w_base - 0.001), y_shoulder, z_front),
            (s * (w_base - 0.001), y_back, z_back),
            (s * w_top, y_top, z_top_front),
            (s * w_top, y_top, z_top_back),
        ]
    return pts


def slope_frame(y0: float, z0: float, y1: float, z1: float, t: float, lift: float = 0.0):
    """Frame on the prism's sloped front, `t` of the way up from (y0, z0) to (y1, z1)."""
    u = lib.Vector((0, y1 - y0, z1 - z0)).normalized()
    n = lib.Vector((0, -u.z, u.y))
    o = lib.Vector((0, y0 + (y1 - y0) * t, z0 + (z1 - z0) * t)) + n * lift
    return op.frame((1, 0, 0), u, n, o)


def zenit(it: lib.Item, ttl: bool = False) -> None:
    """Zenit-E, or (ttl) the Zenit-TTL: same body, a through-the-lens meter instead of the selenium cell."""
    chrome = lib.material(it, "chrome", it.color, metal=1.0, rough=0.38)
    m = {
        "chrome": chrome,
        "leather": lib.material(it, "leather", "#1b1a19", rough=0.55),
        "black": lib.material(it, "black", "#161616", metal=0.1, rough=0.42),
        "white": lib.material(it, "white", "#e9e6dc", rough=0.55, ao=False),
        "glass": lib.material(it, "glass", "#a8742c", metal=0.7, rough=0.05, alpha=0.3, ao=False),
        "dark": lib.material(it, "dark", "#050505", rough=0.65, ao=False),
    }
    y_sh, y_top, zf, ztf = 0.0500, 0.0640, 0.0215, 0.0095
    slr_body(it, m, plate=chrome, flange=chrome, leather_seed=7, grain=0.00030, prism_pts=prism_pts(y_sh, 0.0520, y_top, zf, -0.0165, ztf, -0.0070, 0.0215, 0.0135), prism_bevel=0.0012)

    # Nameplate: black panel on the prism slope, raised chrome letters
    panel = lib.polygon("nameplate", op.rrect(0.0142, 0.0041, 0.0008, 3), 0.0002, m["black"], base=False)
    lib.transform(panel, slope_frame(y_sh, zf, y_top, ztf, 0.56))
    t = lib.text("nameplate.text", "ЗЕНИТ-TTL" if ttl else "ЗЕНИТ-Е", 0.0046 if ttl else 0.0056, 0.0003, chrome, pos=(0, 0, 0), bold=1.2)
    lib.transform(t, slope_frame(y_sh, zf, y_top, ztf, 0.56, lift=0.0002))
    if not ttl:
        # Selenium meter cell: honeycomb of little lenses under the nameplate
        cell = op.rrect(0.0125, 0.0026, 0.0008, 3)
        lib.polygon("cell.back", [(x, y + 0.0455) for x, y in cell], 0.00015, m["dark"], z=zf, base=False)
        beads = [(-0.0114 + i * 0.0019 + (0.00095 if j % 2 else 0), 0.0438 + j * 0.0017) for j in range(3) for i in range(12 if j % 2 else 13)]
        lib.dots("cell.lenses", beads, 0.00085, 0.00035, m["glass"], z=zf + 0.00015, segments=6)
    else:
        # TTL: a plain black band where the cell was, and the meter switch by the lens mount
        lib.polygon("ttl.band", [(x, y + 0.0455) for x, y in op.rrect(0.0125, 0.0026, 0.0008, 3)], 0.00012, m["black"], z=zf, base=False)
        lib.box("ttl.switch", (0.0036, 0.0072, 0.0016), m["black"], center=(-0.026, 0.004, 0.0213), bevel=0.0004)
    # Eyepiece on the prism back, cold shoe on top
    back_window("eyepiece", 0.0, 0.0462, 0.017, 0.0095, -0.0165, 0.0028, m["black"], m["glass"], m["dark"])
    for s in (-1, 1):
        op.plan_poly(f"shoe.{s}", [(s * 0.0072, -0.0055), (s * 0.0098, -0.0055), (s * 0.0098, 0.0075), (s * 0.0072, 0.0075)], y_top - 0.0003, 0.0013, chrome, bevel=0.0002)

    # Shutter speed dial, advance lever and frame counter (+X)
    sx = 0.046
    top = knob("speed", sx, 0.0, PLATE_TOP - 0.0002, 0.0040, 0.0089, 0.0095, 36, chrome, dome=0.0002)
    for i, s in enumerate(["В", "30", "60", "125", "250", "500"]):
        op.dial_text(f"speed.{i}", s, sx, top, 0.0, 0.0071, math.radians(20 + 45 * i), 0.0014, 0.00005, m["black"], bold=1.2)
    a = math.radians(-58)
    tip = (sx + math.sin(a) * 0.026, -math.cos(a) * 0.026)
    disc("lever.hub", sx, 0.0, top, 0.0013, 0.0046, chrome)
    arm("lever.arm", (sx, 0.0), tip, 0.0050, 0.0034, top + 0.0001, 0.0011, chrome)
    lib.cylinder("lever.tip", 0.0021, 0.0042, m["black"], axis="y", center=(tip[0], top + 0.0006, tip[1]), segments=16, bevel=0.0006)
    disc("counter", sx, 0.0, top + 0.0013, 0.0009, 0.0033, m["black"])
    # Release button, serial and factory badge on the top plate
    disc("release.collar", 0.0305, -0.0062, PLATE_TOP, 0.0018, 0.0036, chrome)
    disc("release.button", 0.0305, -0.0062, PLATE_TOP + 0.0018, 0.0020, 0.0021, chrome)
    op.top_text("serial", "84137290" if ttl else "76054123", 0.0455, PLATE_TOP, 0.0146, 0.0019, 0.00005, m["black"], bold=1.0)
    bx, bz = 0.0300, 0.0128
    tri = [(bx - 0.0026, bz + 0.0018), (bx + 0.0026, bz + 0.0018), (bx, bz - 0.0026)]
    lib.transform(lib.stroke("badge", [(x, -z) for x, z in tri], 0.0005, 0.00006, m["black"], closed=True), lib.at(0, PLATE_TOP, 0) @ lib.rot("x", -math.pi / 2))
    lib.transform(lib.stroke("badge.ray", [(bx - 0.0034, -(bz + 0.0004)), (bx + 0.0034, -(bz - 0.0010))], 0.0004, 0.00007, m["black"]), lib.at(0, PLATE_TOP, 0) @ lib.rot("x", -math.pi / 2))

    # Rewind knob over the exposure calculator ring (−X)
    rx = -0.0500
    ring_top = disc("calc", rx, 0.0, PLATE_TOP - 0.0002, 0.0017, 0.0118, chrome, chamfer=0.0005)
    for i in range(24):
        a = 2 * math.pi * i / 24
        op.dial_text(f"calc.{i}", "|", rx, ring_top, 0.0, 0.0102, a, 0.0011 if i % 3 else 0.0016, 0.00004, m["black"])
    knob("rewind", rx, 0.0, ring_top, 0.0072, 0.0080, 0.0086, 40, chrome)

    # Front: self-timer lever and flash socket
    lib.cylinder("timer.hub", 0.0032, 0.0016, chrome, axis="z", center=(0.040, 0.016, 0.0205), segments=24, bevel=0.0004)
    lever = lib.polygon("timer.lever", [(0.0395, 0.0175), (0.0420, 0.0168), (0.0352, 0.0045), (0.0330, 0.0055)], 0.0013, m["black"], z=0.0205, bevel=0.0003)
    lib.cylinder("sync", 0.0019, 0.0034, chrome, axis="z", center=(-0.040, 0.019, 0.0213), segments=20, bevel=0.0004)
    # Back: the door seams at the ends of the back
    for s in (-1, 1):
        lib.stroke(f"seam.{s}", [(s * 0.0625, -0.0330), (s * 0.0625, 0.0325)], 0.0006, 0.0003, m["dark"], z=-0.0200, facing=-1, round_caps=False)
    # Bottom: the back lock key
    disc("lock.dish", -0.046, 0.0, -0.0376, 0.0008, 0.0062, chrome)
    lib.box("lock.key", (0.0095, 0.0008, 0.0022), chrome, center=(-0.046, -0.0380, 0.0), bevel=0.0003)

    # Lens: Helios-44-2, chrome "zebra" rings that match the body
    with op.Grab() as g:
        lens_kind.helios(
            {"barrel": m["black"], "paint": m["white"], "chrome": chrome, "ink": m["black"], "glass": m["glass"], "dark": m["dark"]},
            zebra=True,
            rear=False,
            serial="8512096" if ttl else "7614207",
        )
    place_lens(g, lens_kind.SHOULDER, 0.0225, 0.933)


def kanon_lens(m: dict) -> None:
    """KD 50 mm f/1.8 for the Kanon breech mount, lens-local: mount face z = 0, front +Z."""
    paint, white, chrome, glass, dark = m["paint"], m["white"], m["chrome"], m["glass"], m["dark"]
    op.knurl("breech", 0.0258, 0.0264, 0.0, 0.0045, 30, chrome, caps=(0.0212, 0.0236), top=0.55)
    op.knurl("aperture.grip", 0.0236, 0.0241, 0.0045, 0.0080, 48, paint, top=0.5, chamfer=0.0003)
    op.ring("aperture", [(0.0234, 0.0080), (0.0238, 0.0082), (0.0238, 0.0112), (0.0233, 0.0115)], paint)
    for i, s in enumerate(["16", "11", "8", "5.6", "4", "2.8", "1.8"]):
        op.cyl_text(f"stop.{i}", s, 0.0238, 0.0097, math.radians(-54 + 18 * i), 0.0016, 0.00005, white, bold=1.2)
    op.ring("dof", [(0.0232, 0.0115), (0.0232, 0.0140)], paint)
    op.tick("index", 0.0232, 0.0115, 0.0139, 0.0, 0.0004, 0.00005, white)
    for i, s in enumerate(["16", "8", "4", "4", "8", "16"]):
        a = math.radians((-1 if i < 3 else 1) * (6 + 6 * (2 - i if i < 3 else i - 3)))
        op.cyl_text(f"dofn.{i}", s, 0.0232, 0.0128, a, 0.0011, 0.00005, white)
    op.ring("focus.scale", [(0.0232, 0.0140), (0.0236, 0.0143), (0.0236, 0.0180), (0.0233, 0.0183)], paint)
    for i, s in enumerate(["∞", "10", "5", "3", "2", "1.5", "1", ".8", ".6"]):
        op.cyl_text(f"dist.{i}", s, 0.0236, 0.0161, math.radians(21 * i), 0.0018 if s == "∞" else 0.0015, 0.00005, white, bold=1.1)
    op.knurl("focus.grip", 0.0237, 0.0245, 0.0183, 0.0330, 44, m["leather"], caps=(0.0233, 0.0230), top=0.5, chamfer=0.0005)
    op.ring(
        "front",
        [(0.0230, 0.0330), (0.0232, 0.0334), (0.0228, 0.0418), (0.0226, 0.0428), (0.0211, 0.0428), (0.0208, 0.0421), (0.0152, 0.0420), (0.0140, 0.0417), (0.0134, 0.0410), (0.0132, 0.0388)],
        paint,
    )
    op.arc_text_k("name", "KANON LENS KD 50mm 1:1.8 S.C.", 0.0180, 0.0017, 0.00005, white, z=0.0420, start=math.pi / 2, spacing=0.66)
    op.flatten(lib.arc_text("made", "JAPAN", 0.0180, 0.0013, 0.00005, white, z=0.0420, start=-math.pi / 2, inward=True))
    op.cup("inside", [(0.0132, 0.0388), (0.0122, 0.0300), (0.0100, 0.0240), (0, 0.0230)], dark)
    op.dome("inner", 0.0110, 0.0300, 0.024, glass, segments=40, rings=4)
    op.dome("glass", 0.0136, 0.0428, 0.028, glass)


def kanon(it: lib.Item) -> None:
    paint = lib.material(it, "paint", it.color, metal=0.1, rough=0.32)
    m = {
        "paint": paint,
        "leather": lib.material(it, "leather", "#1d1d1d", rough=0.58),
        "chrome": lib.material(it, "chrome", "#c8c8c4", metal=1.0, rough=0.22),
        "white": lib.material(it, "white", "#eeece4", rough=0.5, ao=False),
        "glass": lib.material(it, "glass", "#6a5aa0", metal=0.7, rough=0.05, alpha=0.3, ao=False),
        "dark": lib.material(it, "dark", "#050505", rough=0.65, ao=False),
    }
    y_sh, y_top, zf, ztf = 0.0490, 0.0635, 0.0205, 0.0090
    slr_body(it, m, plate=paint, flange=paint, leather_seed=11, grain=0.00021, prism_pts=prism_pts(y_sh, 0.0520, y_top, zf, -0.0160, ztf, -0.0060, 0.0215, 0.0150), prism_bevel=0.0008)
    white, chrome = m["white"], m["chrome"]

    # Prism: KANON in white paint fill, hot shoe on top, eyepiece behind
    size = 0.0068
    t = lib.text("nameplate", "ANON", size, 0.00005, white, pos=(0, 0, 0), bold=0.5, spacing=1.1, align="LEFT")
    op.flatten(t)
    xs = [v.co.x for v in t.data.vertices]
    ys = [v.co.y for v in t.data.vertices]
    cap = max(ys) - min(ys)
    k_w = cap * 0.70 + size * 0.11  # the K and the gap after it
    shift = -(k_w + max(xs)) / 2
    lib.transform(t, lib.at(shift + k_w, 0, 0))
    ks = op.letter_k("nameplate.k", size, 0.00005, white, h=cap, weight=0.15)
    lib.transform(ks, lib.at(shift + cap * 0.33, (max(ys) + min(ys)) / 2, 0))
    lib.transform([t] + ks, slope_frame(y_sh, zf, y_top, ztf, 0.55))
    op.plan_poly("shoe.base", [(x, z + 0.0012) for x, z in op.rrect(0.0095, 0.0072, 0.0008, 2)], y_top - 0.0003, 0.0009, chrome)
    for s in (-1, 1):
        op.plan_poly(f"shoe.rail.{s}", [(s * 0.0072, -0.0058), (s * 0.0100, -0.0058), (s * 0.0100, 0.0082), (s * 0.0072, 0.0082)], y_top + 0.0005, 0.0013, paint, bevel=0.0002)
    disc("shoe.contact", 0.0, 0.0012, y_top + 0.0005, 0.0003, 0.0016, chrome, segments=20)
    back_window("eyepiece", 0.0, 0.0462, 0.018, 0.0105, -0.0160, 0.0030, paint, m["glass"], m["dark"])

    # Shutter speed dial over the advance lever, release in front (+X)
    sx = 0.046
    a = math.radians(-62)
    tip = (sx + math.sin(a) * 0.027, -math.cos(a) * 0.027)
    disc("lever.hub", sx, 0.0, PLATE_TOP - 0.0001, 0.0013, 0.0060, chrome)
    arm("lever.arm", (sx, 0.0), tip, 0.0052, 0.0036, PLATE_TOP, 0.0012, chrome)
    lib.box("lever.tip", (0.0048, 0.0030, 0.0062), paint, center=(tip[0], PLATE_TOP + 0.0009, tip[1]), bevel=0.0009)
    top = knob("speed", sx, 0.0, PLATE_TOP + 0.0012, 0.0042, 0.0090, 0.0096, 40, paint, dome=0.0002)
    for i, s in enumerate(["1000", "500", "250", "125", "60", "30", "15", "8", "B"]):
        op.dial_text(f"speed.{i}", s, sx, top, 0.0, 0.0071, math.radians(-100 + 34 * i), 0.0012, 0.00005, white, bold=1.2)
    disc("speed.hub", sx, 0.0, top, 0.0008, 0.0038, chrome)
    disc("release.collar", 0.0315, 0.0120, PLATE_TOP, 0.0016, 0.0042, chrome)
    disc("release.button", 0.0315, 0.0120, PLATE_TOP + 0.0016, 0.0018, 0.0029, paint)
    # Rewind crank over the film-speed dial (−X)
    rx = -0.0500
    ring_top = disc("iso", rx, 0.0, PLATE_TOP - 0.0002, 0.0019, 0.0112, paint, chamfer=0.0005)
    for i, s in enumerate(["25", "50", "100", "200", "400"]):
        op.dial_text(f"iso.{i}", s, rx, ring_top, 0.0, 0.0097, math.radians(150 + 30 * i), 0.0011, 0.00005, white)
    ktop = knob("rewind", rx, 0.0, ring_top, 0.0052, 0.0082, 0.0088, 36, paint)
    arm("crank", (rx, 0.0), (rx + 0.0105, -0.0035), 0.0034, 0.0026, ktop, 0.0010, chrome)
    lib.cylinder("crank.knob", 0.0017, 0.0040, paint, axis="y", center=(rx + 0.0105, ktop + 0.0030, -0.0035), segments=16, bevel=0.0005)
    # Model name on the top-plate front, serial stamped on its back
    op.flatten(lib.text("model", "AE-2", 0.0044, 0.00005, white, pos=(-0.0450, 0.0372, HALF_D), bold=1.8))
    serial = lib.text("serial", "583106", 0.0027, 0.00005, white, pos=(0, 0, 0), bold=1.0)
    op.flatten(serial)
    lib.transform(serial, lib.at(0.0380, 0.0372, -HALF_D) @ lib.rot("y", math.pi))
    # Front: self-timer lever, stop-down button
    lib.cylinder("timer.hub", 0.0034, 0.0016, chrome, axis="z", center=(0.040, 0.0165, 0.0205), segments=24, bevel=0.0004)
    lib.polygon("timer.lever", [(0.0392, 0.0178), (0.0418, 0.0172), (0.0360, 0.0035), (0.0336, 0.0044)], 0.0016, paint, z=0.0205, bevel=0.0004)
    lib.cylinder("stopdown", 0.0024, 0.0030, chrome, axis="z", center=(-0.034, 0.0150, 0.0212), segments=20, bevel=0.0005)
    # Back door: hinge, memo holder, seams
    lib.cylinder("hinge", 0.0013, 0.060, paint, axis="y", center=(-0.0640, 0.0, -0.0204), segments=16)
    memo = [(x - 0.010, y - 0.002) for x, y in op.rrect(0.0205, 0.0135, 0.0015, 3)]
    lib.stroke("memo", memo, 0.0016, 0.0008, paint, z=-0.0200, facing=-1, closed=True, round_caps=False)
    for s in (-1, 1):
        lib.stroke(f"seam.{s}", [(s * 0.0610, -0.0330), (s * 0.0610, 0.0325)], 0.0006, 0.0003, m["dark"], z=-0.0200, facing=-1, round_caps=False)
    disc("rewind.button", 0.040, 0.0, -0.0376, 0.0008, 0.0030, chrome)

    with op.Grab() as g:
        kanon_lens(m)
    place_lens(g, 0.0, 0.0225)


# ---------------------------------------------------------------------------
# Rangefinder (Weissler IIIc)


def weissler_lens(m: dict) -> None:
    """Collapsible 5 cm f/3.5, pulled out and locked, lens-local: mount face z = 0, front +Z."""
    chrome, ink, glass, dark = m["chrome"], m["black"], m["glass"], m["dark"]
    op.knurl("focus.grip", 0.0179, 0.0185, 0.0, 0.0028, 60, chrome, caps=(0.0170, 0.0179), top=0.45, chamfer=0.0003)
    op.ring("focus.scale", [(0.0179, 0.0028), (0.0182, 0.0030), (0.0182, 0.0082), (0.0182, 0.0086), (0.0126, 0.0090), (0.0112, 0.0096)], chrome)
    for i, s in enumerate(["∞", "20", "10", "5", "3", "2", "1,5", "1"]):
        op.cyl_text(f"dist.{i}", s, 0.0182, 0.0056, math.radians(-24 * i), 0.0017 if s == "∞" else 0.0014, 0.00005, ink, bold=1.2)
    # Focusing tab with the infinity lock, at the bottom
    lib.box("tab", (0.0042, 0.0075, 0.0034), chrome, center=(0, -0.0212, 0.0036), bevel=0.0007)
    lib.cylinder("tab.knob", 0.0021, 0.0060, ink, axis="z", center=(0, -0.0242, 0.0036), segments=16, bevel=0.0006)
    # Tube and front head
    op.ring("tube", [(0.0108, 0.0094), (0.0108, 0.0310)], chrome, segments=64)
    op.ring("head", [(0.0108, 0.0310), (0.0127, 0.0312), (0.0132, 0.0317), (0.0132, 0.0384), (0.0129, 0.0390), (0.0098, 0.0390), (0.0084, 0.0386), (0.0082, 0.0370)], chrome)
    for i, s in enumerate(["18", "12,5", "9", "6,3", "4,5", "3,5"]):
        op.cyl_text(f"stop.{i}", s, 0.0132, 0.0350, math.radians(-40 + 16 * i), 0.0011, 0.00005, ink)
    lib.box("aperture.tab", (0.0024, 0.0030, 0.0018), chrome, center=(0.0, 0.0144, 0.0336), bevel=0.0005)
    op.flatten(lib.arc_text("name", "WEISSLER ELMIT 1:3,5 F=5cm Nr. 531906", 0.0114, 0.0012, 0.00005, ink, z=0.0390, start=math.pi / 2, spacing=0.66))
    op.cup("inside", [(0.0082, 0.0370), (0.0075, 0.0330), (0.0050, 0.0300), (0, 0.0295)], dark)
    op.dome("inner", 0.0070, 0.0335, 0.016, glass, segments=32, rings=4)
    op.dome("glass", 0.0082, 0.0399, 0.020, glass, segments=48)


def weissler(it: lib.Item) -> None:
    chrome = lib.material(it, "chrome", it.color, metal=1.0, rough=0.26)
    m = {
        "chrome": chrome,
        "leather": lib.material(it, "vulcanite", "#161514", rough=0.55),
        "black": lib.material(it, "black", "#0e0e0e", rough=0.55),
        "glass": lib.material(it, "glass", "#b07a30", metal=0.6, rough=0.06, alpha=0.34, ao=False),
        "dark": lib.material(it, "dark", "#050505", rough=0.65, ao=False),
    }
    black, glass, dark = m["black"], m["glass"], m["dark"]
    top_y = 0.0400
    # Body: vulcanite band round the stadium-shaped body, chrome top housing and base plate
    op.band("vulcanite", HALF_W - 0.0003, 0.0198, 0.0198, -0.0290, 0.0228, m["leather"], spacing=0.0018, amp=0.00034, thick=0.0002, holes=[(0, LENS_Y, 0.0172)], seed=3)
    op.slab("top", HALF_W, HALF_D, HALF_D, op.round_prof(0.0222, top_y, 0.0004, 0.0018), chrome, nc=8)
    op.slab("base", HALF_W, HALF_D, HALF_D, op.round_prof(-0.0322, -0.0288, 0.0020, 0.0003), chrome, nc=8)
    with op.Grab() as g:
        op.ring("flange", [(0.0170, 0.0192), (0.0196, 0.0192), (0.0196, 0.0209), (0.0192, 0.0213), (0.0170, 0.0213)], chrome, segments=64)
    g.place(lib.at(0, LENS_Y, 0))

    # Front of the housing: rangefinder windows (narrow, pre-war), viewfinder window between
    front_window("rf.right", 0.0420, 0.0295, 0.0092, 0.0060, HALF_D, chrome, glass, dark)
    front_window("rf.left", -0.0120, 0.0295, 0.0076, 0.0060, HALF_D, chrome, glass, dark)
    front_window("vf", -0.0010, 0.0300, 0.0056, 0.0046, HALF_D, chrome, glass, dark)
    # Slow-speed dial and self-timer on the body front
    k = op.knurl("slow", 0.0058, 0.0063, 0.0, 0.0026, 30, chrome, caps=(None, 0.0), top=0.4)
    lib.transform(k, lib.at(0.0445, 0.0080, 0.0198))
    for i, s in enumerate(["1", "2", "4", "8", "15", "20"]):
        a = math.radians(90 - 50 * i)
        t = lib.text(f"slow.{i}", s, 0.0009, 0.00004, black, pos=(0, 0, 0))
        op.flatten(t)
        lib.transform(t, lib.at(0.0445 + 0.0042 * math.cos(a), 0.0080 + 0.0042 * math.sin(a), 0.0224) @ lib.rot("z", a - math.pi / 2))
    lib.cylinder("timer.hub", 0.0028, 0.0018, chrome, axis="z", center=(-0.0340, -0.0150, 0.0207), segments=20, bevel=0.0004)
    lib.polygon("timer.lever", [(-0.0345, -0.0135), (-0.0322, -0.0140), (-0.0262, -0.0035), (-0.0282, -0.0028)], 0.0013, chrome, z=0.0207, bevel=0.0003)

    # Top: rewind knob (−X), engraving, accessory shoe, shutter dial, release, winding knob (+X)
    knob("rewind", -0.0525, 0.0, top_y - 0.0002, 0.0074, 0.0082, 0.0088, 40, chrome)
    disc("rewind.collar", -0.0525, 0.0, top_y - 0.0002, 0.0012, 0.0094, chrome)
    ex = -0.0260
    op.top_text("eng.drp", "D.R.P.", ex, top_y, -0.0110, 0.0017, 0.00004, black)
    op.top_text("eng.script", "Weissler", ex, top_y, -0.0035, 0.0064, 0.00004, black, bold=0.8, shear=0.3)
    op.top_text("eng.maker", "Weissler & Sohn  Lahnberg", ex, top_y, 0.0050, 0.0017, 0.00004, black, shear=0.15)
    op.top_text("eng.serial", "No 412873", ex, top_y, 0.0120, 0.0021, 0.00004, black, bold=0.6)
    op.plan_poly("shoe.base", op.rrect(0.0090, 0.0086, 0.0006, 2), top_y - 0.0002, 0.0009, chrome)
    for s in (-1, 1):
        op.plan_poly(f"shoe.rail.{s}", [(s * 0.0064, -0.0086), (s * 0.0090, -0.0086), (s * 0.0090, 0.0086), (s * 0.0064, 0.0086)], top_y + 0.0007, 0.0014, chrome, bevel=0.0002)
    dtop = knob("speed", 0.0330, 0.0, top_y - 0.0002, 0.0034, 0.0068, 0.0073, 36, chrome, dome=0.0003)
    for i, s in enumerate(["1000", "500", "200", "100", "60", "40", "30", "20", "B"]):
        op.dial_text(f"speed.{i}", s, 0.0330, dtop - 0.0001, 0.0, 0.0050, math.radians(-120 + 30 * i), 0.0010, 0.00005, black)
    disc("speed.hub", 0.0330, 0.0, dtop - 0.0001, 0.0012, 0.0026, chrome)
    disc("release.collar", 0.0445, 0.0118, top_y - 0.0002, 0.0026, 0.0034, chrome)
    disc("release.button", 0.0445, 0.0118, top_y + 0.0024, 0.0018, 0.0018, chrome)
    wtop = knob("wind", 0.0548, -0.0015, top_y - 0.0002, 0.0076, 0.0080, 0.0086, 40, chrome, cap_mat=chrome, dome=0.0002)
    disc("counter", 0.0548, -0.0015, wtop, 0.0004, 0.0048, black)
    disc("counter.pin", 0.0548, -0.0015, wtop + 0.0004, 0.0006, 0.0012, chrome, segments=16)
    for side in (-1, 1):
        lug(f"lug{side}", side, 0.0150, chrome)

    # Back: viewfinder and rangefinder eyepieces with the dioptre lever below
    back_window("eye.vf", 0.0010, 0.0310, 0.0072, 0.0062, -HALF_D, 0.0012, black, glass, dark)
    back_window("eye.rf", 0.0120, 0.0310, 0.0072, 0.0062, -HALF_D, 0.0012, black, glass, dark)
    lib.box("dioptre", (0.0090, 0.0012, 0.0010), chrome, center=(0.0120, 0.0258, -HALF_D - 0.0005), bevel=0.0003)
    # Base plate: locking key and tripod socket
    disc("lock.dish", -0.0480, 0.0, -0.0330, 0.0008, 0.0068, chrome)
    lib.box("lock.key", (0.0110, 0.0010, 0.0026), chrome, center=(-0.0480, -0.0335, 0.0), bevel=0.0003)
    tripod_socket("tripod", 0.0420, 0.0, -0.0322, chrome, dark)

    with op.Grab() as g:
        weissler_lens(m)
    place_lens(g, 0.0, 0.0213)


def build(it: lib.Item) -> None:
    it.ao_size = 1024
    brand = it.d.get("brand", "").lower()
    if brand == "zenit":
        zenit(it, ttl="ttl" in it.id)
    elif brand == "kanon":
        kanon(it)
    elif brand == "weissler" or not any(h["id"] == "prism" for h in it.model.get("hotspots", [])):
        weissler(it)
    else:
        kanon(it)
