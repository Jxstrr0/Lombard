"""
Laptops: the Tosaki Orbita C40, a 14-inch 2013 student laptop (M4, The Student's Laptop).

Placeholder convention (src/render/items.ts): the laptop stands as its owner sees
it, lid open at 110°. Base 0.336 × 0.026 × 0.236 lying in the XZ plane (keyboard
up, +Y), its front edge at +Z, the hinge at the back (−Z); the lid rises from the
hinge and leans back, screen facing +Z (and a little up). The bounds are about
±0.168 × −0.119…0.122 × −0.150…0.157. The def sets `model.rest: "upright"`, so
the stage stands it on the counter this way up instead of laying it flat.

Frames: the base and lid are built flat in their own local frames (outline in XY,
thickness along local Z) and moved into place, like the phone slabs. Features on
a face use `frame(origin, u, v)`: local X along u, local Y along v, local Z = u × v
pointing out of the face, so text reads upright for someone looking at that face.

Hotspots the model is built round (item coordinates, see LAPTOP_HOTSPOTS below):
  screen on the display · keyboard on the D key · hinge on the barrel's right end ·
  ports on the left side between the DC socket and the VGA port · serial on the
  rating sticker under the base · battery on the battery label · logo on the lid back.

Reuses the phone slab / boolean / text helpers (kinds/phone.py).
"""

from __future__ import annotations

import math

import bmesh
import lib
from kinds import phone
from kinds.phone import circle_shape, crosshead, cut, disc, line_on, pill, pocket, poly_on, rr, rr_shape, slab
from mathutils import Matrix, Vector

AO_DISTANCE = 0.003
# Height of printed legends, stickers' print and the display over the surface under them. The
# pack quantizes positions to 14 bits over the item's 0.34 m: ~21 µm steps, so print any
# thinner than this would sink into the key caps it sits on.
PRINT = 0.00006

# Base
W, DP, TB = 0.336, 0.236, 0.026
R = 0.012
YB = -0.1175  # bottom of the base (rubber feet stand 1.5 mm below)
ZC = 0.0394  # centre of the base, front to back
SEAM = 0.0175  # bottom shell / top deck seam, height above the base bottom
# Hinge axis (item coordinates) and barrel radius
H = Vector((0.0, YB + TB - 0.003, ZC - DP / 2 + 0.0065))
RB = 0.0068
# Lid
PHI = math.radians(110)
LH, LT = 0.228, 0.0075
D = Vector((0.0, math.sin(PHI), math.cos(PHI)))  # up the lid, from the hinge
N = Vector((0.0, -math.cos(PHI), math.sin(PHI)))  # screen normal
LO = H + D * (LH / 2 + 0.001) + N * (LT / 2)  # lid centre on the screen face

# Keyboard (base-local: x right, y towards the hinge, z up from the base bottom)
U = 0.0185  # key pitch
KX0 = -7.5 * U
ROWS = [  # (y centre, key height, keys as (width in U, Latin legend, Cyrillic legend))
    (0.0600, 0.0095, [(1, "Esc", "")] + [(1, f"F{i}", "") for i in range(1, 13)] + [(1, "Ins", ""), (1, "Del", "")]),
    (0.0455, 0.0155, [(1, c, "") for c in "`1234567890-="] + [(2, "←", "")]),
    (0.0270, 0.0155, [(1.5, "Tab", "")] + [(1, a, b) for a, b in zip("QWERTYUIOP[]", "ЙЦУКЕНГШЩЗХЪ")] + [(1.5, "\\", "")]),
    (0.0085, 0.0155, [(1.75, "Caps", "")] + [(1, a, b) for a, b in zip("ASDFGHJKL;'", "ФЫВАПРОЛДЖЭ")] + [(2.25, "Enter", "")]),
    (-0.0100, 0.0155, [(2.25, "Shift", "")] + [(1, a, b) for a, b in zip("ZXCVBNM,./", "ЯЧСМИТЬБЮ.")] + [(2.75, "Shift", "")]),
    (-0.0285, 0.0155, [(1, "Ctrl", ""), (1, "Fn", ""), (1, "Start", ""), (1, "Alt", ""), (6, "", ""), (1, "Alt", ""), (1, "Ctrl", ""), (1, "←", ""), (1, "↕", ""), (1, "→", "")]),
]
# The keys a student wears shiny first (WASD, the home row's left hand, space, Enter, Backspace).
WORN = {"W", "A", "S", "D", "E", "N", "O", "", "Enter", "←"}


def frame(origin, u, v) -> Matrix:
    """Local X along u, local Y along v, local Z = u × v (out of the face), at origin."""
    u, v = Vector(u), Vector(v)
    n = u.cross(v)
    o = Vector(origin)
    return Matrix(((u.x, v.x, n.x, o.x), (u.y, v.y, n.y, o.y), (u.z, v.z, n.z, o.z), (0, 0, 0, 1)))


# Base-local → item: x → x, y → −z (back), z → y (up), origin at the bottom centre.
MB = frame((0, YB, ZC), (1, 0, 0), (0, 0, -1))
# Lid-local → item: x → x, y → up the lid, z → screen normal, origin at the screen-face centre.
ML = frame(LO, (1, 0, 0), D)


def base_at(x: float, y: float, z: float) -> Matrix:
    """A frame on the base's top deck (base-local point), local Z up."""
    return MB @ lib.at(x, y, z)


def under(x: float, z: float, dy: float = 0.0) -> Matrix:
    """A frame on the underside at item (x, z): local X = +X, local Y = +Z (front), facing down.
    Text reads upright when the laptop is tipped towards you to show its belly."""
    return frame((x, YB - dy, z), (1, 0, 0), (0, 0, 1))


def side(sign: int, z: float, y: float) -> Matrix:
    """A frame on the left (sign −1) or right (+1) side wall at item (z, y)."""
    if sign < 0:
        return frame((-W / 2, y, z), (0, 0, 1), (0, 1, 0))
    return frame((W / 2, y, z), (0, 0, -1), (0, 1, 0))


def front(x: float, y: float) -> Matrix:
    return frame((x, y, ZC + DP / 2), (1, 0, 0), (0, 1, 0))


def lid_back(x: float, y: float) -> Matrix:
    """A frame on the lid's back (lid-local x, y), facing away from the screen, reading from behind."""
    p = LO + D * y - N * LT + Vector((x, 0, 0))
    return frame(p, (-1, 0, 0), D)


def text_on(m: Matrix, body: str, size: float, mat, *, depth: float = 0.00006, **kw):
    """Lettering on a face. Printed legends (depth ≤ 0.1 mm) keep only their top faces:
    their side walls can't be seen, and dropping them saves about two thirds of the
    triangles (a keyboard and two stickers of text is most of this model otherwise)."""
    o = phone.text_on(m, body, size, mat, depth=depth, **kw)
    if depth <= 0.0001:
        n = Vector((m[0][2], m[1][2], m[2][2])).normalized()
        bm = bmesh.new()
        bm.from_mesh(o.data)
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if abs(f.normal.dot(n)) < 0.5], context="FACES")
        bm.to_mesh(o.data)
        bm.free()
    return o


# ---------------------------------------------------------------------------


def build(it: lib.Item) -> None:
    it.ao_size = 1024
    lid_col = it.color
    bottom = lib.material(it, "shell", "#2b2c2f", rough=0.7)
    deck = lib.material(it, "deck", "#8e9196", metal=0.35, rough=0.45)
    lid = lib.material(it, "lid", lid_col, metal=0.2, rough=0.22)
    keys = lib.material(it, "keys", "#1b1c1e", rough=0.75)
    gloss = lib.material(it, "gloss", "#141516", rough=0.16)  # bezel, hinge barrel, worn key caps
    dark = lib.material(it, "dark", "#0e0f10", metal=0.2, rough=0.6)
    glass = lib.material(it, "glass", "#06070a", rough=0.05, ao=False)
    metal = lib.material(it, "metal", "#c8cacd", metal=1.0, rough=0.25)
    # printed lettering is clean and thinner than an AO texel: no AO
    ink = lib.material(it, "ink", "#e9e9e6", rough=0.5, ao=False)
    ink_red = lib.material(it, "ink_red", "#d8573f", rough=0.5, ao=False)
    paper = lib.material(it, "paper", "#e6e3da", rough=0.8, ao=False)

    # --- base: dark bottom shell, a seam, the graphite top deck -----------------------
    shape = rr_shape(W, DP, R, 10)
    rings = [
        (0.004, 0.0, bottom), (0.0015, 0.0012, bottom), (0.0004, 0.003, bottom), (0, 0.0055, bottom), (0, SEAM, bottom),
        (0.0004, SEAM + 0.0003, dark), (0.0004, SEAM + 0.0009, dark), (0, SEAM + 0.0012, deck),
        (0, TB - 0.0012, deck), (0.0009, TB, deck),
    ]
    base = slab(shape, rings, cap_lo=bottom, cap_hi=deck, m=MB, smooth=40, name="base")

    top_cuts = []
    # keyboard well, touchpad, touchpad buttons, speaker strip
    top_cuts.append(pocket(lambda i: rr(15 * U + 0.0035, 0.1045, 0.002, 3), 0.002, keys, base_at(0, 0.0142, TB)))
    top_cuts.append(pocket(lambda i: rr(0.086, 0.047, 0.003, 4), 0.0007, deck, base_at(0, -0.0720, TB)))
    top_cuts.append(pocket(lambda i: rr(0.086, 0.0125, 0.002, 4), 0.0012, dark, base_at(0, -0.1035, TB)))
    top_cuts.append(pocket(lambda i: rr(0.190, 0.0075, 0.0025, 4), 0.0008, dark, base_at(0.005, 0.0830, TB)))
    # underside: battery bay, service hatch, vent slots
    bat_z, bat_d = ZC - DP / 2 + 0.034, 0.058
    top_cuts.append(pocket(lambda i: rr(0.246, bat_d + 0.0006, 0.004, 4), 0.0006, dark, under(0, bat_z)))
    top_cuts.append(pocket(lambda i: rr(0.124, 0.074, 0.004, 4), 0.0006, dark, under(0.035, 0.040)))
    top_cuts += [pocket(lambda i: rr(0.0035, 0.034, 0.0015, 3), 0.0025, dark, under(-0.150 + k * 0.0065, 0.010)) for k in range(7)]
    cut(base, top_cuts)

    # keys
    for y, kh, row in ROWS:
        acc = 0.0
        for w, lat, cyr in row:
            cx = KX0 + (acc + w / 2) * U
            acc += w
            kw = w * U - 0.003
            mat = gloss if (lat in WORN and y < 0.05) else keys
            if lat == "↕":  # up and down arrows: two half-height keys
                for dy, glyph in ((kh / 4 + 0.0002, "↑"), (-kh / 4 - 0.0002, "↓")):
                    km = base_at(cx, y + dy, TB)
                    slab(rr_shape(kw, kh / 2 - 0.0006, 0.0012, 3), [(0, -0.002, mat), (0, 0.0003, mat), (0.0004, 0.0006, mat)], cap_lo=mat, cap_hi=mat, m=km, smooth=40)
                    text_on(km @ lib.at(0, 0, 0.0006), glyph, 0.0028, ink, depth=PRINT)
                continue
            km = base_at(cx, y, TB)
            slab(rr_shape(kw, kh, 0.0014, 3), [(0, -0.002, mat), (0, 0.0003, mat), (0.0004, 0.0006, mat)], cap_lo=mat, cap_hi=mat, m=km, smooth=40)
            top = km @ lib.at(0, 0, 0.0006)
            if not lat:
                continue
            if len(lat) == 1 and cyr:
                text_on(top, lat, 0.0042, ink, x=-0.0036, y=0.0024, depth=PRINT, bold=0.3)
                text_on(top, cyr, 0.0036, ink_red, x=0.0034, y=-0.0030, depth=PRINT, bold=0.3)
            elif len(lat) == 1 or lat in ("←", "→"):
                text_on(top, lat, 0.0040 if lat.isalnum() else 0.0036, ink, depth=PRINT, bold=0.3)
            else:
                size = 0.0022 if kh < 0.012 else 0.0025
                text_on(top, lat, size, ink, x=-kw / 2 + 0.0016, y=-kh / 2 + 0.0026 if kh > 0.012 else 0, depth=PRINT, align="LEFT")

    # touchpad buttons: one bar with a hairline split
    bm = base_at(0, -0.1035, TB)
    slab(rr_shape(0.0845, 0.0115, 0.0018, 4), [(0, -0.0012, deck), (0, -0.0003, deck), (0.0004, -0.0001, deck)], cap_lo=deck, cap_hi=deck, m=bm)
    line_on(bm, [(0, -0.0055), (0, 0.0055)], 0.0004, PRINT, dark, z=-0.0001)
    # speaker strip slats
    for k in range(38):
        line_on(base_at(-0.0875 + k * 0.005, 0.0830, TB), [(0, -0.0034), (0, 0.0034)], 0.0021, 0.0006, deck, z=-0.0008)
    # power button and status lights by the hinge
    pm = base_at(0.128, 0.0830, TB)
    slab(circle_shape(0.0042, 32), [(0, -0.0006, gloss), (0, 0.0003, gloss), (0.0005, 0.0006, gloss)], cap_lo=gloss, cap_hi=gloss, m=pm)
    arc = [(0.0022 * math.cos(a), 0.0022 * math.sin(a)) for a in [math.radians(120 + 300 * i / 16) for i in range(17)]]
    line_on(pm, arc, 0.00045, PRINT, ink, z=0.0006)
    line_on(pm, [(0, 0.0004), (0, 0.0026)], 0.00045, PRINT, ink, z=0.0006)
    # spec sticker on the palm rest
    sm = base_at(0.098, -0.090, TB)
    poly_on(sm, rr(0.024, 0.017, 0.0012, 3), 0.00008, paper)
    text_on(sm @ lib.at(0, 0, 0.00008), "ORBITA", 0.0030, dark, y=0.0030, depth=PRINT, bold=0.6, spacing=1.15)
    text_on(sm @ lib.at(0, 0, 0.00008), "4GB · 500GB", 0.0020, dark, y=-0.0030, depth=PRINT)
    # model name above the keyboard, left
    text_on(base_at(-0.128, 0.0830, TB), "C40", 0.0034, metal, depth=PRINT, align="LEFT")

    # --- hinge barrel along the back edge -------------------------------------------------
    bw = W - 0.05
    lib.cylinder("barrel", RB, bw, gloss, segments=32, axis="x", center=tuple(H), bevel=0.0012)
    for sx in (-1, 1):  # the base's hinge cheeks either side of the barrel
        lib.cylinder("cheek", RB * 0.98, 0.012, deck, segments=32, axis="x", center=(sx * (bw / 2 + 0.0065), H.y, H.z), bevel=0.0015)

    # --- sides: ports -----------------------------------------------------------------------
    py = YB + 0.0105  # port centre height
    sc = []
    left = lambda z, dy=0.0: side(-1, z, py + dy)  # noqa: E731
    right = lambda z, dy=0.0: side(1, z, py + dy)  # noqa: E731
    sc += [pocket(lambda i: rr(0.022, 0.0022, 0.0009, 3), 0.004, dark, left(-0.058, k * 0.0034 - 0.0034)) for k in range(3)]  # vent
    sc.append(pocket(circle_shape(0.0029, 28), 0.009, dark, left(-0.0365)))  # DC in
    vga = [(-0.0078, 0.0036), (0.0078, 0.0036), (0.0066, -0.0036), (-0.0066, -0.0036)]
    sc.append(pocket(lambda i: vga, 0.006, dark, left(-0.010)))
    hdmi = [(-0.0070, 0.0024), (0.0070, 0.0024), (0.0070, -0.0006), (0.0052, -0.0024), (-0.0052, -0.0024), (-0.0070, -0.0006)]
    sc.append(pocket(lambda i: hdmi, 0.007, dark, left(0.0135)))
    sc.append(pocket(lambda i: rr(0.0124, 0.0049, 0.0004, 2), 0.008, dark, left(0.0345)))  # USB
    for z in (0.056, 0.066):
        sc.append(pocket(circle_shape(0.0019, 24), 0.009, dark, left(z)))  # headphone / mic
    # right: two USB ports, the DVD drive with eject button, lock slot
    sc.append(pocket(lambda i: rr(0.0124, 0.0049, 0.0004, 2), 0.008, dark, right(0.050)))
    sc.append(pocket(lambda i: rr(0.0124, 0.0049, 0.0004, 2), 0.008, dark, right(0.068)))
    sc.append(pocket(lambda i: rr(0.0062, 0.0030, 0.0006, 2), 0.004, dark, right(0.110)))
    # front edge: SD slot
    sc.append(pocket(lambda i: rr(0.026, 0.0022, 0.0008, 3), 0.008, dark, front(-0.090, YB + 0.0090)))
    cut(base, sc)
    # DC centre pin, port tongues, VGA screws
    slab(circle_shape(0.0008, 16), [(0, -0.009, metal), (0, -0.0012, metal)], cap_lo=metal, cap_hi=metal, m=left(-0.0365))
    for m_ in (left(0.0345, 0.0009), right(0.050, 0.0009), right(0.068, 0.0009)):
        slab(rr_shape(0.0112, 0.0017, 0.0003, 2), [(0, -0.008, ink), (0, -0.0015, ink)], cap_lo=ink, cap_hi=ink, m=m_)
    slab(rr_shape(0.0122, 0.0024, 0.0003, 2), [(0, -0.007, dark), (0, -0.0016, dark)], cap_lo=dark, cap_hi=dark, m=left(0.0135, 0.0005))
    slab(rr_shape(0.0128, 0.0050, 0.0012, 2), [(0, -0.006, ink), (0, -0.0016, ink)], cap_lo=ink, cap_hi=ink, m=left(-0.010))
    for dz in (-0.0122, 0.0122):
        disc(left(-0.010 + dz), 0.0011, -0.0004, 0.00005, metal, n=12)
    # DVD drive: a tray line round a slightly proud bezel, an eject button and its light
    dm = side(1, -0.020, py)
    poly_on(dm, rr(0.122, 0.0090, 0.001, 3), 0.0002, bottom)
    line_on(dm, rr(0.122, 0.0090, 0.001, 3), 0.0003, 0.0001, dark, closed=True, z=0.0001)
    slab(lambda i: pill(0.0080 - 2 * i, 0.0030 - 2 * i, 8), [(0, 0.0, bottom), (0, 0.0005, bottom), (0.0003, 0.0007, bottom)], cap_lo=bottom, cap_hi=bottom, m=dm @ lib.at(0.040, 0, 0))
    disc(dm @ lib.at(0.050, 0, 0), 0.0006, 0.0, 0.0003, ink, n=12)
    # front status lights
    for k in range(4):
        disc(front(0.060 + k * 0.007, YB + 0.0075), 0.0007, -0.0002, 0.0001, ink if k else ink_red, n=12)

    # --- underside: feet, battery, hatch, rating sticker ------------------------------------
    for x in (-0.142, 0.142):
        for z in (ZC - DP / 2 + 0.018, ZC + DP / 2 - 0.016):
            disc(under(x, z), 0.0058, -0.0004, 0.0015, dark, n=24, round_top=0.0005)
    # battery pack panel inside its bay, latches, label
    slab(lambda i: rr(0.2448 - 2 * i, bat_d - 0.0006 - 2 * i, 0.0035, 4), [(0, -0.0006, bottom), (0, -0.00006, bottom)], cap_lo=bottom, cap_hi=bottom, m=under(0, bat_z))
    for sx in (-1, 1):
        lm = under(sx * 0.104, bat_z - 0.018, 0.0)
        slab(rr_shape(0.010, 0.006, 0.0012, 3), [(0, -0.0001, deck), (0, 0.0004, deck)], cap_lo=deck, cap_hi=deck, m=lm)
        line_on(lm, [(-0.003, 0), (0.003, 0)], 0.0006, 0.0001, dark, z=0.0004)
    blm = under(0.040, bat_z - 0.002, -0.00006)
    poly_on(blm, rr(0.070, 0.032, 0.001, 3), 0.00008, paper)
    bt = blm @ lib.at(0, 0, 0.00008)
    for k, line in enumerate(["TOSAKI PA5024U", "10.8V 4400MAH 48WH"]):
        text_on(bt, line, 0.0034 if k == 0 else 0.0026, dark, x=-0.032, y=0.0075 - k * 0.0075, depth=PRINT, align="LEFT", bold=0.4 if k == 0 else 0.0)
    poly_on(bt, [(-0.032, -0.0125), (0.032, -0.0125), (0.032, -0.0095), (-0.032, -0.0095)], PRINT, ink_red)
    # service hatch panel and its two screws
    hm = under(0.035, 0.040)
    slab(lambda i: rr(0.1228 - 2 * i, 0.0728 - 2 * i, 0.0035, 4), [(0, -0.0006, bottom), (0, -0.00006, bottom)], cap_lo=bottom, cap_hi=bottom, m=hm)
    for sx in (-1, 1):
        crosshead(hm @ lib.at(sx * 0.052, 0.028, -0.00006), deck, dark, r=0.0021)
    text_on(hm @ lib.at(0, 0, -0.00006), "RAM HDD", 0.0026, deck, y=-0.028, depth=PRINT, spacing=1.2)
    # rating sticker with the serial and a barcode
    rm = under(-0.075, 0.100)
    poly_on(rm, rr(0.066, 0.040, 0.0012, 3), 0.0001, paper)
    rt = rm @ lib.at(0, 0, 0.0001)
    sticker = ["TOSAKI ORBITA C40-A", "MODEL PSC8EE", "S/N 3D127446Q", "DC IN 19V 3.42A"]
    for k, line in enumerate(sticker):
        text_on(rt, line, 0.0030 if k == 0 else 0.0024, dark, x=-0.031, y=0.0140 - k * 0.0062, depth=PRINT, align="LEFT", bold=0.4 if k in (0, 2) else 0.0)
    x = -0.031
    k = 0
    while x < 0.029:
        bw_ = 0.0003 if (k * 7) % 5 < 3 else 0.0006
        poly_on(rt, [(x, -0.0185), (x + bw_, -0.0185), (x + bw_, -0.0125), (x, -0.0125)], PRINT, dark)
        x += bw_ + (0.0004 if (k * 3) % 4 else 0.0007)
        k += 1
    text_on(under(0.0, 0.140), "TOSAKI", 0.0060, deck, depth=0.00012, bold=0.6, spacing=1.3)

    # --- lid ---------------------------------------------------------------------------------
    lshape = rr_shape(W - 0.001, LH, R, 10)
    lrings = [
        (0.0028, -LT, lid), (0.0010, -LT + 0.0008, lid), (0.0002, -LT + 0.0022, lid), (0, -LT + 0.0035, lid), (0, -0.0016, lid),
        (0.0003, -0.0014, dark), (0.0003, -0.0010, dark), (0, -0.0008, gloss), (0.0007, 0.0, gloss),
    ]
    slab(lshape, lrings, cap_lo=lid, cap_hi=gloss, m=ML, smooth=40, name="lid")
    # display (off: dark glass) a little above centre, the thick chin below it
    dmx = ML @ lib.at(0, 0.008, 0)
    poly_on(dmx, rr(0.3115, 0.1765, 0.0008, 3), PRINT, dark)
    poly_on(dmx, rr(0.3085, 0.1740, 0.0004, 3), PRINT, glass, z=PRINT)
    # webcam, bumpers, brand on the chin
    cm = ML @ lib.at(0, 0.1045, 0)
    disc(cm, 0.0021, -0.0001, PRINT, dark, n=24)
    disc(cm, 0.0009, PRINT, 2 * PRINT, glass, n=20)
    disc(ML @ lib.at(0.006, 0.1045, 0), 0.0005, -0.0001, PRINT, dark, n=12)
    for bx, by in ((-0.150, 0.104), (0.150, 0.104), (-0.150, -0.097), (0.150, -0.097)):
        disc(ML @ lib.at(bx, by, 0), 0.0016, -0.0001, 0.0004, dark, n=16, round_top=0.0002)
    text_on(ML @ lib.at(0, -0.0945, 0), "TOSAKI", 0.0055, ink, depth=PRINT, bold=0.5, spacing=1.35)
    text_on(ML @ lib.at(0.128, -0.0945, 0), "ORBITA", 0.0030, metal, depth=PRINT, spacing=1.2)
    # lid back: inlaid metal wordmark
    text_on(lid_back(0, 0.010), "TOSAKI", 0.0200, metal, depth=0.00015, bold=0.6, spacing=1.35)
    line_on(lid_back(0, 0.010), [(-0.040, -0.0095), (0.040, -0.0095)], 0.0006, 0.0001, metal)


# Hotspot positions this model is built round (item coordinates), for src/data/items/electronics.json.
def _hotspots() -> dict[str, tuple[float, float, float]]:
    def r(v):
        return tuple(round(c, 4) for c in v)

    d_key = KX0 + 4.25 * U
    return {
        "screen": r(ML @ Vector((0, 0.008, 2 * PRINT))),
        "keyboard": r(MB @ Vector((d_key, 0.0085, TB + 0.0006))),
        "hinge": r(H + Vector((0.120, RB * 0.7071, RB * 0.7071))),
        "ports": r(Vector((-W / 2, YB + 0.0105, -0.0235))),
        "serial": r(Vector((-0.075, YB - 0.0001, 0.100))),
        "battery": r(Vector((0.040, YB - 0.0001, ZC - DP / 2 + 0.032))),
        "logo": r(LO + D * 0.010 - N * (LT + 0.0001)),
    }


LAPTOP_HOTSPOTS = _hotspots()
