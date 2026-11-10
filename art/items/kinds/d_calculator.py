"""
calculator_priboy_pm61: a 1986 programmable pocket calculator, the Priboy PM-61
(ПРИБОЙ ПМ-61), by a fictional Soviet electronics works.

It rests flat, face (+Z) up, the display end at +Y. Everything is drawn in a local
frame with the back on z = 0 and the plan centred on the origin; `build` ends by
moving the lot so its bounding box is centred on the origin.

The case is one moulding lofted across X from a side profile: a flat keyboard
deck, a short ramp up to a thicker display hood, every edge rounded. The hood
holds a recessed window (green tinted glass over a twelve-place vacuum-
fluorescent display drawn segment by segment) and the brand strip. On the deck:
the power and angle-mode slide switches, then 30 keys in six rows of five
(orange F, blue K, grey programming and operation keys, dark digit keys, red Cx)
with their legends and, printed on the deck above them, the yellow F and blue K
second functions. Back: battery door with its grip ribs, four rubber feet and
the rating label. A 9 V mains-adapter socket sits on the top edge.
"""

from __future__ import annotations

import math

import lib
from kinds import box as B
from kinds import box_c as C
from kinds import phone as P
from mathutils import Vector

F, disc, rr = P.F, P.disc, P.rr
line_on, poly_on, plate = C.line_on, C.poly_on, B.plate

W, H = 0.078, 0.167
ZK = 0.0250  # keyboard deck
ZD = 0.0325  # display hood
Y_RAMP0, Y_RAMP1 = 0.0255, 0.0320  # ramp from the deck up to the hood
INK = 0.00005  # print height: a few Draco steps over 17 cm

WIN_Y, WIN_W, WIN_H, WIN_D = 0.0600, 0.0660, 0.0215, 0.0040  # display window (pocket)
KEY_W, KEY_H, KEY_T = 0.0104, 0.0076, 0.0030
PITCH_X, PITCH_Y = 0.0138, 0.0134
ROW0_Y = -0.0060  # centre of the top key row


# ---------------------------------------------------------------------------
# Helpers


def fillet(pts, radii, seg=5):
    """A closed polygon with each corner rounded to its radius (0 = sharp)."""
    out = []
    n = len(pts)
    for i in range(n):
        p, a, c = Vector(pts[i]), Vector(pts[i - 1]), Vector(pts[(i + 1) % n])
        r = radii[i]
        if r <= 0:
            out.append(tuple(p))
            continue
        u, v = (a - p).normalized(), (c - p).normalized()
        th = math.acos(max(-1.0, min(1.0, u.dot(v))))
        d = r / math.tan(th / 2)
        t1, t2 = p + u * d, p + v * d
        ctr = p + (u + v).normalized() * (r / math.sin(th / 2))
        a1 = math.atan2(t1.y - ctr.y, t1.x - ctr.x)
        a2 = math.atan2(t2.y - ctr.y, t2.x - ctr.x)
        da = (a2 - a1 + math.pi) % (2 * math.pi) - math.pi
        for k in range(seg + 1):
            ang = a1 + da * k / seg
            out.append((ctr.x + r * math.cos(ang), ctr.y + r * math.sin(ang)))
    return out


def txt(m, body, size, mat, **kw):
    """Printed lettering, top faces only: walls 50 µm high are never seen, and
    dropping them saves about two thirds of the text triangles (see laptop.py)."""
    import bmesh

    o = B.txt(m, body, size, mat, **kw)
    n = Vector((m[0][2], m[1][2], m[2][2])).normalized()
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if abs(f.normal.dot(n)) < 0.5], context="FACES")
    bm.to_mesh(o.data)
    bm.free()
    return o


# Seven-segment digits: segments a b c d e f g in a 1 x 2 cell (x 0..1, y 0..2).
SEGS = "abcdefg"
GLYPH = {
    "0": "abcdef", "1": "bc", "2": "abged", "3": "abgcd", "4": "fgbc", "5": "afgcd",
    "6": "afgedc", "7": "abc", "8": "abcdefg", "9": "abcdfg", "-": "g", " ": "",
}


def segment_poly(s, w, h, t, slant):
    """Outline of segment `s` of a w x h digit (stroke t), sheared by `slant`."""
    g = t * 0.18  # gap between segments
    ht = t / 2

    def hseg(y):
        x0, x1 = g + ht, w - g - ht
        return [(x0 - ht, y), (x0, y - ht), (x1, y - ht), (x1 + ht, y), (x1, y + ht), (x0, y + ht)]

    def vseg(x, y0, y1):
        y0, y1 = y0 + g + ht, y1 - g - ht
        return [(x, y0 - ht), (x + ht, y0), (x + ht, y1), (x, y1 + ht), (x - ht, y1), (x - ht, y0)]

    m = h / 2
    pts = {
        "a": hseg(h), "g": hseg(m), "d": hseg(0.0),
        "b": vseg(w, m, h), "c": vseg(w, 0.0, m), "f": vseg(0.0, m, h), "e": vseg(0.0, 0.0, m),
    }[s]
    return [(x + slant * y, y) for x, y in pts]


def flat_prisms(name, mat, m, polys, z, dz):
    """Many small flat prisms in one mesh (display segments)."""
    import bmesh

    bm = bmesh.new()
    for q in polys:
        lib.prism(bm, q, z, lib.jitter(dz), base=False)
    return P.place(lib.mesh_object(P._name(name), bm, mat), m)


# ---------------------------------------------------------------------------


def build(it: lib.Item) -> None:
    M = B.setup(it)
    B.AO_DISTANCE = 0.0030
    it.ao_size = 1024
    body = lib.material(it, "case", it.color, rough=0.5)
    deck_m = lib.material(it, "deck", "#1b1a19", rough=0.55)
    alu = lib.material(it, "strip", "#bdbbb4", metal=0.85, rough=0.32)
    vfd_on = lib.material(it, "vfd_on", "#8dffc4", rough=0.4, ao=False, emissive="#3dff9a")
    vfd_off = lib.material(it, "vfd_off", "#10261d", rough=0.5, ao=False)
    vfd_on.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = 3.0
    vglass = lib.material(it, "vfd_glass", "#0e3a2b", rough=0.05, alpha=0.4, ao=False)
    k_dig = lib.material(it, "key_digit", "#2e2d2c", rough=0.45)
    k_op = lib.material(it, "key_op", "#77746e", rough=0.45)
    k_f = lib.material(it, "key_f", "#d77a22", rough=0.45)
    k_k = lib.material(it, "key_k", "#2f5fa8", rough=0.45)
    k_cx = lib.material(it, "key_cx", "#b4271f", rough=0.45)
    white = lib.material(it, "white_ink", "#ecebe5", rough=0.5, ao=False)
    yellow = lib.material(it, "yellow_ink", "#e3b23c", rough=0.5, ao=False)
    blue = lib.material(it, "blue_ink", "#6f9fe3", rough=0.5, ao=False)
    red = lib.material(it, "red_ink", "#c4372b", rough=0.5, ao=False)
    rubber = M["rubber"]
    dark, ink, paper, chrome = M["dark"], M["black_ink"], M["paper"], M["chrome"]

    # --- case: side profile (Y, Z) lofted across X, edges rounded by inset rings
    prof = [(-H / 2, 0.0), (H / 2, 0.0), (H / 2, ZD), (Y_RAMP1, ZD), (Y_RAMP0, ZK), (-H / 2, ZK)]
    prof = fillet(prof, [0.0025, 0.0025, 0.0045, 0.0030, 0.0030, 0.0025], seg=5)
    shape = C.outline(prof)
    r = 0.0022
    rings = []
    for k in range(5):
        a = math.pi / 2 * k / 4
        rings.append((r * (1 - math.sin(a)), -W / 2 + r * (1 - math.cos(a)), body))
    rings += [(i, -z, body) for i, z, _ in reversed(rings)]
    case = P.slab(shape, rings, cap_lo=body, cap_hi=body, m=F("px", (0, 0, 0)), smooth=40, name="case")

    # display window pocket in the hood
    wm = F("front", (0, WIN_Y, ZD))
    P.cut(case, [P.pocket(P.rr_shape(WIN_W, WIN_H, 0.0016, 4), WIN_D, dark, wm)])

    # --- the display: dark floor, twelve places of seven segments, tinted glass
    floor = F("front", (0, WIN_Y, ZD - WIN_D))
    poly_on(floor, rr(WIN_W - 0.004, WIN_H - 0.006, 0.001, 3), 0.0002, ink)
    dw, dh, st, sl = 0.0030, 0.0056, 0.00062, 0.10
    pitch = 0.0047
    shown = [" ", "8", "0", "3", "1", "4", "1", "5", "9", "-", "0", "7"]
    dots = {1}  # decimal point after the first mantissa digit
    on, off = [], []
    x0 = -pitch * (len(shown) - 1) / 2 - dw / 2
    for i, ch in enumerate(shown):
        ox = x0 + i * pitch + (0.0016 if i >= 9 else 0.0)  # exponent set apart
        lit = GLYPH[ch]
        for s in SEGS:
            pts = [(ox + x, y - dh / 2) for x, y in segment_poly(s, dw, dh, st, sl)]
            (on if s in lit else off).append(pts)
        d = 0.00038
        cx, cy = ox + dw + 0.00075, -dh / 2 + d
        (on if i in dots else off).append([(cx - d, cy - d), (cx + d, cy - d), (cx + d, cy + d), (cx - d, cy + d)])
    flat_prisms("vfd_on", vfd_on, floor, on, 0.0002, 0.00012)
    flat_prisms("vfd_off", vfd_off, floor, off, 0.0002, 0.00008)
    # a fine grid wire over each place, as the tube has
    for i in range(len(shown)):
        ox = x0 + i * pitch + (0.0016 if i >= 9 else 0.0) + dw / 2 + 0.0003
        line_on(floor, [(ox - 0.0024, dh / 2 + 0.0012), (ox + 0.0024, dh / 2 + 0.0012)], 0.00025, 0.0001, chrome, z=0.0002)
    gm = F("front", (0, WIN_Y, ZD - 0.0026))
    P.slab(P.rr_shape(WIN_W - 0.0002, WIN_H - 0.0002, 0.0015, 4), [(0, 0.0, vglass), (0, 0.0006, vglass)], cap_lo=vglass, cap_hi=vglass, m=gm, name="glass")

    # --- hood: brand strip under the window, a small line above it
    hm = F("front", (0, 0, ZD))
    sy = 0.0415
    plate(hm @ lib.at(0, sy, 0), WIN_W, 0.0068, 0.00025, alu, r=0.0008, bev=0.0001)
    sz = 0.00025 + 0.00003
    txt(hm, "ПРИБОЙ", 0.0048, ink, x=-0.031, y=sy, z=sz, depth=INK, bold=0.6, spacing=1.12, align="LEFT")
    txt(hm, "ПМ-61", 0.0048, red, x=0.031, y=sy, z=sz, depth=INK, bold=0.6, spacing=1.05, align="RIGHT")
    txt(hm, "программируемый", 0.0019, white, x=0.0, y=WIN_Y + WIN_H / 2 + 0.0034, depth=INK, spacing=1.1)

    # --- keyboard deck: a slightly darker inlay panel carries the print
    dm = F("front", (0, 0, ZK))
    deck_top = -0.0795, 0.0225
    poly_on(dm @ lib.at(0, (deck_top[0] + deck_top[1]) / 2, 0), rr(W - 0.0058, deck_top[1] - deck_top[0], 0.0018, 4), 0.00015, deck_m)
    DZ = 0.00015 + 0.00002  # deck print sits on the inlay

    # slide switches: dark track, ribbed slider, legends
    def slide(x, y, length, pos, labels):
        tm = dm @ lib.at(x, y, DZ)
        poly_on(tm, rr(length, 0.0030, 0.0010, 3), 0.00012, ink)
        sm = tm @ lib.at(pos, 0, 0.00012)
        plate(sm, 0.0040, 0.0038, 0.0014, k_op, r=0.0006, bev=0.0002)
        for k in (-1, 0, 1):
            line_on(sm, [(k * 0.0010, -0.0013), (k * 0.0010, 0.0013)], 0.00035, 0.00012, k_op, z=0.0014)
        for lx, word in labels:
            txt(tm, word, 0.0019, white, x=lx, y=0.0034, depth=INK, bold=0.2)

    slide(-0.0205, 0.0140, 0.0120, 0.0040, [(-0.0040, "ВЫКЛ"), (0.0045, "ВКЛ")])
    slide(0.0205, 0.0140, 0.0150, -0.0055, [(-0.0055, "Р"), (0.0, "ГРД"), (0.0055, "Г")])

    # keys: (legend, material, legend ink, F function, K function)
    O, D = k_op, k_dig
    rows = [
        [("F", k_f, ink, "", ""), ("ШГ→", O, ink, "x<0", ""), ("ШГ←", O, ink, "x=0", ""), ("В/О", O, ink, "x≥0", ""), ("С/П", O, ink, "x≠0", "")],
        [("K", k_k, white, "", ""), ("П→x", O, ink, "L0", ""), ("x→П", O, ink, "L1", ""), ("БП", O, ink, "L2", ""), ("ПП", O, ink, "L3", "")],
        [("7", D, white, "sin", "[x]"), ("8", D, white, "cos", "{x}"), ("9", D, white, "tg", "max"), ("−", O, ink, "√", ""), ("÷", O, ink, "1/x", "")],
        [("4", D, white, "arcsin", "|x|"), ("5", D, white, "arccos", "ЗН"), ("6", D, white, "arctg", ""), ("+", O, ink, "π", ""), ("×", O, ink, "x²", "")],
        [("1", D, white, "eˣ", ""), ("2", D, white, "lg", ""), ("3", D, white, "ln", ""), ("↔", O, ink, "xʸ", ""), ("В↑", O, ink, "Вx", "")],
        [("0", D, white, "10ˣ", "НОП"), (".", D, white, "○", ""), ("/−/", D, white, "АВТ", ""), ("ВП", D, white, "ПРГ", ""), ("Сx", k_cx, white, "CF", "")],
    ]
    for ri, row in enumerate(rows):
        y = ROW0_Y - ri * PITCH_Y
        for ci, (leg, mat, lc, fl, kl) in enumerate(row):
            x = (ci - 2) * PITCH_X
            km = dm @ lib.at(x, y, 0.00015)
            plate(km, KEY_W, KEY_H, KEY_T, mat, r=0.0011, bev=0.0006)
            size = 0.0044 if len(leg) == 1 else 0.0031
            txt(km, leg, size, lc, z=KEY_T, depth=INK, bold=0.45 if len(leg) == 1 else 0.3, spacing=1.0)
            ly = y + KEY_H / 2 + 0.0019
            if fl and kl:
                txt(dm, fl, 0.0019, yellow, x=x - 0.0050, y=ly, z=DZ, depth=INK, bold=0.15, align="LEFT")
                txt(dm, kl, 0.0019, blue, x=x + 0.0050, y=ly, z=DZ, depth=INK, bold=0.15, align="RIGHT")
            elif fl:
                txt(dm, fl, 0.0019, yellow, x=x, y=ly, z=DZ, depth=INK, bold=0.15)
    # --- DC socket on the top edge
    tm = F("top", (0.0200, H / 2, 0.0150))
    disc(tm, 0.0036, -0.0003, 0.0004, body, n=24, round_top=0.0002)
    disc(tm, 0.0024, 0.0004, 0.00046, ink, n=20)
    disc(tm, 0.0007, 0.00046, 0.0007, chrome, n=10)
    txt(F("top", (-0.0040, H / 2, 0.0150)), "=9В", 0.0026, white, depth=INK, bold=0.2)

    # --- back: battery door, ribs, feet, rating label
    bk = F("back", (0, 0, 0))
    door_y0, door_y1 = -0.0700, -0.0060
    dy = (door_y0 + door_y1) / 2
    line_on(bk, [(x, y) for x, y in rr(0.056, door_y1 - door_y0, 0.0025, 3, cy=dy)], 0.0004, INK, ink, closed=True)
    for k in range(6):
        yy = door_y0 + 0.0045 + k * 0.0016
        line_on(bk, [(-0.012, yy), (0.012, yy)], 0.0007, 0.00035, body)
    txt(bk, "▼ ОТКРЫТЬ", 0.0024, white, y=door_y0 + 0.0170, depth=INK, bold=0.2)
    txt(bk, "3 × 1,5 В", 0.0034, white, y=dy + 0.006, depth=INK, bold=0.3)
    for sx in (-1, 1):
        for fy in (-H / 2 + 0.0080, H / 2 - 0.0080):
            disc(bk @ lib.at(sx * (W / 2 - 0.0075), fy, 0), 0.0042, -0.0003, 0.0015, rubber, n=20, round_top=0.0005)
    lm = bk @ lib.at(0, 0.0230, 0)
    poly_on(lm, rr(0.052, 0.034, 0.0012, 3), 0.00008, paper)
    lz = 0.00008 + 0.00002
    lines = [("ПРИБОЙ ПМ-61", 0.0036, 0.6), ("микрокалькулятор", 0.0022, 0.0), ("№ 6104217", 0.0030, 0.3), ("1986 г.", 0.0028, 0.3), ("ЦЕНА 85 р.", 0.0030, 0.45), ("СДЕЛАНО В СССР", 0.0022, 0.2)]
    y = 0.0125
    for k, (body_s, size, bold) in enumerate(lines):
        txt(lm, body_s, size, ink, y=y, z=lz, depth=INK, bold=bold)
        y -= size * 1.55 + 0.0006
        if k == 0:  # a rule under the title
            line_on(lm, [(-0.022, y + 0.0016), (0.022, y + 0.0016)], 0.0003, INK, ink, z=lz)
    line_on(lm, [(x, y) for x, y in rr(0.049, 0.031, 0.0009, 3)], 0.00025, INK, ink, z=lz, closed=True)

    # --- centre the bounding box on the origin
    lo, hi = Vector((1e9,) * 3), Vector((-1e9,) * 3)
    objs = lib.mesh_objects()
    for o in objs:
        for v in o.data.vertices:
            p = o.matrix_world @ v.co
            lo, hi = Vector(map(min, lo, p)), Vector(map(max, hi, p))
    c = (lo + hi) / 2
    lib.transform(objs, lib.at(-c.x, -c.y, -c.z))
    print(f"[items] calculator bounds {tuple(round(x, 5) for x in hi - lo)} shift {tuple(round(-x, 5) for x in c)}", flush=True)
    print(f"[items] calculator hotspots: display (0, {WIN_Y - c.y:.4f}, {ZD - 0.0026 + 0.0006 - c.z:.4f})"
          f" keys (0, {ROW0_Y - PITCH_Y - c.y:.4f}, {ZK + 0.00015 + KEY_T - c.z:.4f}) label (0, {0.0230 - c.y:.4f}, {-0.00008 - c.z:.4f})", flush=True)
