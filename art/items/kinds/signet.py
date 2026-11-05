"""
Gold signet ring: a shank that thickens and widens into the shoulders, an oval
head with a flat face and a bevelled edge, two hand-cut initials and a border
line engraved into the face (boolean cuts, each letter at a slightly different
depth and tilt, as a hand engraver leaves them), 583 + assay star struck inside
the shank at the bottom.

Placeholder convention (src/render/items.ts): ring with the hole axis Z, inner
radius 0.0086, flat oval face on top at +Y (y ≈ 0.0122, 11.2 × 9.2 mm).
Hotspots: face (0, 0.0118, 0), inner (0, −0.0085, 0).
"""

from __future__ import annotations

import math
import random

import bmesh
import bpy
import lib
from kinds import _gold as G
from kinds import ring as R
from mathutils import Matrix, Vector

AO_DISTANCE = 0.0005

RI = 0.0086
TOP = 0.0122  # face height
FA, FB = 0.0056, 0.0046  # face half axes (x, z)
CH = 0.00035  # bevel round the face
BA, BB = 0.0043, 0.0034  # half axes where the head meets the shank
BOT_R = 0.0095  # head underside follows this circle (between the hole and the shank surface)
INITIALS = "Н.В"


def swell(th: float) -> float:
    """0 along the lower shank, rising to 1 under the head."""
    return max(0.0, (math.sin(th) - 0.15) / 0.85)


def shank(mat) -> object:
    steps = 180
    bm = bmesh.new()
    rings = []
    for s in range(steps):
        th = -math.pi / 2 + 2 * math.pi * s / steps
        k = swell(th)
        ro0 = 0.0099 + 0.0019 * k**1.5
        hw = 0.0018 + 0.0025 * k**2
        prof = R.band_profile(
            ri=lambda z: RI - 0.0001 * (1 - min(abs(z) / hw, 1) ** 2),
            ro=lambda z, ro0=ro0, hw=hw: ro0 - (0.00045 + 0.0006 * k) * min(abs(z) / hw, 1) ** 2,
            hw=hw,
            er=0.00035 + 0.0002 * k,
            n_face=10,
            n_corner=4,
        )[:-1]
        rings.append([bm.verts.new((r * math.cos(th), r * math.sin(th), z)) for r, z in prof])
    n = len(rings[0])
    for s in range(steps):
        A, B = rings[s], rings[(s + 1) % steps]
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((A[i], A[j], B[j], B[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        f.smooth = True
    o = lib.mesh_object("shank", bm, mat)
    lib.auto_smooth(o, 60)
    return o


def head(mat) -> object:
    """Closed oval head: underside along a circle, flanks curving out to the face, bevelled edge."""
    seg = 96
    bm = bmesh.new()

    def oval(a, b, y_fn, i):
        t = 2 * math.pi * i / seg
        x, z = a * math.cos(t), b * math.sin(t)
        return (x, y_fn(x), z)

    levels = []
    # underside ring → flanks (slightly concave) → edge → bevel → face
    for f in (0.0, 0.25, 0.5, 0.75, 1.0):
        a = BA + (FA - BA) * f**1.6
        b = BB + (FB - BB) * f**1.6
        levels.append((a, b, lambda x, f=f, a=a: (1 - f) * math.sqrt(max(BOT_R**2 - x * x, 0)) + f * (TOP - CH)))
    for k in range(1, 4):
        a_ = math.pi / 2 * k / 3
        da = CH * (1 - math.cos(a_))
        levels.append((FA - da, FB - da, lambda x, a_=a_: TOP - CH + CH * math.sin(a_)))
    rings = [[bm.verts.new(oval(a, b, fn, i)) for i in range(seg)] for a, b, fn in levels]
    for A, B in zip(rings, rings[1:]):
        for i in range(seg):
            j = (i + 1) % seg
            bm.faces.new((A[i], A[j], B[j], B[i]))
    # flat face: concentric rings so the engraving cuts have vertices to work with
    face_rings = []
    for f in (0.8, 0.55, 0.3):
        a = (FA - CH) * f
        b = (FB - CH) * f
        face_rings.append([bm.verts.new((a * math.cos(2 * math.pi * i / seg), TOP, b * math.sin(2 * math.pi * i / seg))) for i in range(seg)])
    prev = rings[-1]
    for ring in face_rings:
        for i in range(seg):
            j = (i + 1) % seg
            bm.faces.new((prev[i], prev[j], ring[j], ring[i]))
        prev = ring
    c = bm.verts.new((0, TOP, 0))
    for i in range(seg):
        bm.faces.new((prev[i], prev[(i + 1) % seg], c))
    cb = bm.verts.new((0, BOT_R, 0))
    for i in range(seg):
        bm.faces.new((rings[0][(i + 1) % seg], rings[0][i], cb))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = lib.mesh_object("head", bm, mat)
    lib.auto_smooth(o, 35)
    return o


def to_face(depth: float, tilt_x: float = 0.0, tilt_z: float = 0.0) -> Matrix:
    """Flat XY relief (up +y, out +z) → lying on the face, reading from above with
    its top towards the back (−Z), sunk `depth` below the face."""
    return lib.at(0, TOP - depth, 0) @ lib.rot("x", tilt_x) @ lib.rot("z", tilt_z) @ lib.rot("x", -math.pi / 2)


def engraving_cutters(it: lib.Item, mat) -> object:
    rnd = random.Random(it.id)
    cutters = []
    # initials, each cut by hand: a little deeper or shallower, a little tilted
    size = 0.0036
    xs = [-0.0022, 0.0, 0.0022] if len(INITIALS) == 3 else [0.0]
    for i, ch in enumerate(INITIALS):
        x = xs[i] if i < len(xs) else 0.0
        cs = size * (1.1 if ch == "." else 1.0)
        o = lib.text(f"cut.{i}", ch, cs, 0.0008, mat, pos=(x, -0.0003 if ch == "." else 0.0, 0), bold=1.4, base=True, font_name="DejaVuSansMono.woff2")
        # italic slant, engraver's script
        o.data.transform(Matrix(((1, 0.22, 0, 0), (0, 1, 0, 0), (0, 0, 1, 0), (0, 0, 0, 1))))
        depth = 0.00011 + rnd.uniform(-0.00003, 0.00003)
        lib.transform(o, to_face(depth, rnd.uniform(-0.035, 0.035), rnd.uniform(-0.03, 0.03)))
        cutters.append(o)
    # border line round the face, inset from the bevel
    bm = bmesh.new()
    seg, w = 96, 0.00014
    a0, b0 = FA - CH - 0.00055, FB - CH - 0.00055
    rings = []
    for (da, y) in ((-w, -0.00008), (w, -0.00008), (w, 0.0004), (-w, 0.0004)):
        rings.append([bm.verts.new((((a0 + da) * math.cos(2 * math.pi * i / seg)), TOP + y, (b0 + da) * math.sin(2 * math.pi * i / seg))) for i in range(seg)])
    for k in range(4):
        A, B = rings[k], rings[(k + 1) % 4]
        for i in range(seg):
            j = (i + 1) % seg
            bm.faces.new((A[i], A[j], B[j], B[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    cutters.append(lib.mesh_object("cut.border", bm, mat))
    # join the cutters into one operand
    with bpy.context.temp_override(active_object=cutters[0], selected_editable_objects=cutters, object=cutters[0]):
        bpy.ops.object.join()
    return cutters[0]


def face_scratches(mat, n: int, seed: int) -> None:
    rnd = random.Random(seed)
    for k in range(n):
        x0, z0 = rnd.uniform(-FA * 0.7, FA * 0.7), rnd.uniform(-FB * 0.7, FB * 0.7)
        ln = rnd.uniform(0.0008, 0.0028)
        ang = rnd.uniform(0, math.pi)
        pts = [(x0 + (i / 3 - 0.5) * ln * math.cos(ang), z0 + (i / 3 - 0.5) * ln * math.sin(ang) + 0.00003 * (i % 2)) for i in range(4)]
        if any((p[0] / (FA - CH)) ** 2 + (p[1] / (FB - CH)) ** 2 > 0.95 or (abs(p[0]) < 0.0036 and abs(p[1]) < 0.0024) for p in pts):
            continue
        o = lib.stroke(f"fscratch.{k}", pts, rnd.uniform(0.00001, 0.000016), 0.000003, mat, round_caps=False)
        # stroke is in XY; lay it on the face (x → x, y → z)
        lib.transform(o, lib.at(0, TOP - 0.000002, 0) @ lib.rot("x", -math.pi / 2))


def build(it: lib.Item) -> None:
    it.ao_size = 1024
    gold = G.gold(it, 0.16)
    cut = lib.material(it, "engraved", lib.shade(it.color, 0.9), metal=1.0, rough=0.4)
    stamp = G.stamp_mat(it)
    satin = G.satin(it)

    shank(gold)
    hd = head(gold)
    cutter = engraving_cutters(it, cut)
    mod = hd.modifiers.new("engrave", "BOOLEAN")
    mod.operation = "DIFFERENCE"
    mod.solver = "EXACT"
    mod.object = cutter
    mod.use_self = True
    mod.use_hole_tolerant = True
    mod.material_mode = "TRANSFER"
    lib.apply_modifiers(hd)
    bpy.data.objects.remove(cutter)
    lib.auto_smooth(hd, 35)

    face_scratches(satin, 14, 583)

    # 583 + star inside the shank at the bottom, reading from the hole (up = +Z)
    hm = G.hallmark("hm", "583", "star", stamp, digit=0.00055)
    G.wrap_cylinder(hm, lambda z: RI - 0.0001 * (1 - min(abs(z) / 0.0018, 1) ** 2) + 0.000004, -math.pi / 2, inward=True)
