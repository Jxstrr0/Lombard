"""
Order of the Red Star: a silver five-pointed star with faceted red enamel rays,
a silver centre medallion (a soldier in a greatcoat with his rifle, the legend
round the band, СССР below), and a thick screw post with a big round nut behind.

Placeholder convention (src/render/items.ts): star r 0.025 in XY (inner radius
0.0105), face +Z, front of the medallion at z ≈ 0.0033, back of the star at
z ≈ −0.002, screw post behind to z ≈ −0.012, nut r ≈ 0.0145 around z = −0.0095.
"""

from __future__ import annotations

import math

import lib
from kinds import _award as aw

R_OUT, R_IN = 0.025, 0.0105
BACK, SILVER_TOP = -0.0018, 0.0007
MED_R = 0.0095
BAND_Z, FIELD_Z = 0.0028, 0.0027
NUT_Z0, NUT_Z1, NUT_R = -0.0087, -0.0103, 0.0135
POST_END = -0.0114

AO_DISTANCE = 0.0015

LEGEND = "ПРОЛЕТАРИИ ВСЕХ СТРАН, СОЕДИНЯЙТЕСЬ!"


def star(it: lib.Item, silver, enamel) -> object:
    outline = lib.star_points(5, R_OUT, R_IN)
    base = lib.polygon("star", outline, SILVER_TOP - BACK, silver, z=BACK, facing=1, bevel=0.00025)
    lib.auto_smooth(base, 40)
    inset = aw.offset_polygon(outline, 0.00055)
    r_out = math.hypot(*inset[0])
    r_in = math.hypot(*inset[1])
    # a few tiny chips off the ray tips (ray 0 is the top one, then anticlockwise)
    chips = {0: (0.08, 0.045), 2: (0.04, 0.075), 3: (0.025, 0.045)}
    aw.faceted_star("enamel", enamel, r_out=r_out, r_in=r_in, z_base=SILVER_TOP - 0.0003, z_edge=SILVER_TOP + 0.00022, z_tip=SILVER_TOP + 0.0006, z_apex=0.0027, chips=chips)
    return base


def medallion(it: lib.Item, silver, relief, oxide) -> None:
    """Silver centre: a raised rim, the band with the legend, a bead ring, and the
    darker inner field with the soldier."""
    prof = [
        (0.0071, 0.0012),
        (MED_R - 0.0002, 0.0012),
        (MED_R, 0.0014),
        (MED_R, 0.0029),
        (MED_R - 0.00015, 0.00312),
        (MED_R - 0.0005, 0.00312),
        (MED_R - 0.00065, BAND_Z),
        (0.0071, BAND_Z),
        (0.0069, 0.00302),
        (0.0067, 0.00302),
        (0.0066, FIELD_Z + 0.00005),
        (0.0066, 0.0012),
        (0.0071, 0.0012),
    ]
    ring = lib.lathe("medallion", prof, silver, segments=96, axis="z", cap=False)
    lib.auto_smooth(ring, 35)
    inner = lib.lathe("medallion.field", [(0, 0.0012), (0.00665, 0.0012), (0.00665, FIELD_Z), (0.0033, FIELD_Z), (0, FIELD_Z)], oxide, segments=72, axis="z", cap=False)
    lib.auto_smooth(inner, 35)

    band = aw.Face(1, relief, BAND_Z, MED_R, relief=0.00026)
    band.arc(LEGEND, 0.0079, 0.00135, start=math.pi / 2 + 0.06, spacing=0.8)
    band.arc("СССР", 0.0079, 0.0016, start=-math.pi / 2, inward=True, spacing=0.85)

    f = aw.Face(1, relief, FIELD_Z, MED_R, relief=0.00036)
    soldier(f)


def soldier(f: aw.Face) -> None:
    """A Red Army man in greatcoat and budenovka, rifle with bayonet held across him."""
    k, ox, oy = 0.82, 128, 112

    def C(px, py):
        return f.C(ox + (px - ox) * k, oy + (py - oy) * k)

    def S(px):
        return f.S(px * k)

    h = f.h
    f.poly([C(106, 176), C(121, 176), C(121, 189), C(101, 189)], h=h * 0.9)  # boots
    f.poly([C(129, 176), C(144, 176), C(149, 189), C(129, 189)], h=h * 0.9)
    f.poly([C(111, 80), C(139, 80), C(145, 96), C(143, 120), C(152, 177), C(99, 177), C(107, 120), C(105, 96)], h=h)  # greatcoat
    f.poly(aw.ellipse(*C(125, 69), S(7), S(8.5), 16), h=h * 1.05)  # head
    f.poly([C(115, 64), C(135, 64), C(133, 55), C(126, 43), C(123, 43), C(117, 55)], h=h * 1.1)  # budenovka
    f.poly(lib.star_points(5, S(3.2), S(1.3), C(125, 56)), h=h * 1.18, bevel=0)  # its star
    f.line([C(107, 118), C(143, 118)], S(3.4), h=h * 1.12)  # belt
    for a, b in (((114, 124), (107, 173)), ((124, 123), (121, 174)), ((135, 123), (142, 173)), ((126, 84), (126, 114))):
        f.line([C(*a), C(*b)], S(2.0), h=h * 1.12)  # greatcoat folds, placket
    f.line([C(94, 162), C(161, 50)], S(4.2), h=h * 1.22)  # rifle
    f.poly([C(90, 160), C(98, 164), C(104, 152), C(96, 148)], h=h * 1.22)  # butt
    f.line([C(161, 50), C(169, 36)], S(1.6), h=h * 1.18)  # bayonet
    f.line([C(110, 86), C(106, 108), C(114, 130)], S(6), h=h * 1.15)  # arms on the rifle
    f.line([C(140, 86), C(149, 98), C(138, 92)], S(6), h=h * 1.15)
    # hammer and sickle under his feet
    cx, cy = f.C(128, 205)
    r = f.S(13)
    f.line([(cx + r * math.cos(a), cy + r * math.sin(a)) for a in [math.radians(d) for d in range(150, -70, -20)]], f.S(3.4), h=h * 0.85)
    f.line([f.C(118, 212), f.C(124, 206)], f.S(3), h=h * 0.85)  # sickle handle
    f.line([f.C(117, 194), f.C(139, 215)], f.S(3), h=h * 0.9)  # hammer handle
    f.poly([f.C(114, 190), f.C(122, 198), f.C(126, 194), f.C(118, 186)], h=h * 0.95)  # hammer head


def back(it: lib.Item, base, silver, relief) -> None:
    # number punched into the lower ray (lower left, seen from behind)
    a = math.radians(-54)
    rr = 0.0166
    num = f"№{aw.rng(it, 'serial').randint(100000, 2900000)}"
    aw.stamp(base, it, num, size=0.00125, x=rr * math.cos(a), y=rr * math.sin(a), z=BACK, facing=-1, depth=0.00012, rot=math.radians(54), uneven=1.0, spacing=0.64)
    aw.threaded_post("screw", 0.002, BACK, POST_END, silver, pitch=0.0006, depth=0.00016, worn=0.6)
    prof = [(0.0021, NUT_Z0), (NUT_R - 0.0004, NUT_Z0), (NUT_R, NUT_Z0 - 0.0003), (NUT_R, NUT_Z1 + 0.0003), (NUT_R - 0.0004, NUT_Z1), (0.0021, NUT_Z1), (0.0021, NUT_Z0)]
    nut = lib.lathe("nut", prof, silver, segments=72, axis="z", cap=False)
    lib.auto_smooth(nut, 35)
    f = aw.Face(-1, relief, -NUT_Z1, NUT_R, relief=0.00022)
    f.arc("МОНЕТНЫЙ ДВОР", 0.0101, 0.0019, start=math.pi / 2, spacing=0.74)
    f.line([(0.0121 * math.cos(t), 0.0121 * math.sin(t)) for t in [2 * math.pi * i / 64 for i in range(65)]], 0.0003, h=0.00016)  # raised rim
    f.line([(0.0032 * math.cos(t), 0.0032 * math.sin(t)) for t in [2 * math.pi * i / 40 for i in range(41)]], 0.00028, h=0.00014)


def build(it: lib.Item) -> None:
    it.ao_size = 1024
    enamel = lib.material(it, "enamel", lib.shade(it.color, 0.82), metal=0.0, rough=0.1, alpha=0.93)
    silver = lib.material(it, "silver", "#c9c9c4", metal=1.0, rough=0.34)
    relief = lib.material(it, "relief", "#dcdcd6", metal=1.0, rough=0.26)
    oxide = lib.material(it, "oxide", "#8e8d88", metal=1.0, rough=0.48)
    base = star(it, silver, enamel)
    medallion(it, silver, relief, oxide)
    back(it, base, silver, relief)
