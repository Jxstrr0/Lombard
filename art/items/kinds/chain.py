"""
Gold chains lying in a loose loop: a rope chain with a lobster clasp and a stamped
tag (or, M6 wave B, an anchor chain of alternating oval links
with the same clasp), or a Bismarck-weave bracelet with a box clasp (585 + maker's mark on the tongue).

Placeholder convention (src/render/items.ts): loose loop ≈ 0.05 across in XY,
clasp at −Y. Hotspots: clasp (0, −0.025, 0), links (0, 0.025, 0).

Links are real tori, all written into one bmesh (one draw call per material). The
rope chain is a run of tilted rings, each turned a little further round the axis
than the one before, which is how the rope's spiral ridges form; the Bismarck weave
is pairs of long, flattened oval links laid in a herringbone, each overlapping the
next three, faces squashed flat like the diamond-cut tops of the real thing.
"""

from __future__ import annotations

import math

import bmesh
import lib
from kinds import _gold as G
from mathutils import Matrix, Vector

AO_DISTANCE = 0.0006


def hash01(n: float) -> float:
    """Same jitter as the placeholder (src/render/items.ts hash01)."""
    x = math.sin(n * 127.1 + 311.7) * 43758.5453
    return x - math.floor(x)


def loop_points(samples: int = 24) -> list[Vector]:
    """The placeholder's loose loop (14 control points from −Y, counter-clockwise),
    with the bottom lowered to −0.0245 to make room for the clasp."""
    n = 14
    pts = []
    for i in range(n):
        a = -math.pi / 2 + i / n * math.pi * 2
        pinned = i in (0, n // 2)
        w = 1 if pinned else 1 + (hash01(i) - 0.5) * 0.14
        pts.append((math.cos(a) * 0.025 * w, math.sin(a) * 0.0245 * w, (hash01(i + 40) - 0.5) * 0.003 * (0 if pinned else 1)))
    return G.catmull(pts, samples, closed=True)


def resample(path: list[Vector], step: float, closed: bool = False) -> list[Vector]:
    """Points every `step` metres along a polyline."""
    pts = path + ([path[0]] if closed else [])
    out = [pts[0].copy()]
    carry = 0.0
    for a, b in zip(pts, pts[1:]):
        seg = (b - a).length
        d = step - carry
        while d <= seg:
            out.append(a.lerp(b, d / seg))
            d += step
        carry = seg - (d - step)
    return out


def open_run(x_right: float, x_left: float, step: float) -> list[Vector]:
    """The loop from where it crosses x = x_right (bottom right) round the top to
    x = x_left (bottom left), resampled every `step`."""
    p = loop_points()
    i0 = next(i for i, v in enumerate(p) if v.x >= x_right)
    i1 = max(i for i, v in enumerate(p) if v.x <= x_left and v.y < 0)
    run = p[i0 : i1 + 1]
    return resample(run, step)


def basis(t: Vector, n: Vector, b: Vector, o: Vector) -> Matrix:
    """Matrix whose local X, Y, Z are t, n, b, at o."""
    return Matrix(((t.x, n.x, b.x, o.x), (t.y, n.y, b.y, o.y), (t.z, n.z, b.z, o.z), (0, 0, 0, 1)))


def end_cap(name: str, at: Vector, direction: Vector, mat, *, r0: float, r1: float, length: float) -> None:
    """A tapered tube cap that receives the chain end (lathe along `direction`)."""
    prof = [(0, 0), (r0 * 0.9, 0), (r0, length * 0.15), (r0 * 0.95, length * 0.55), (r1, length * 0.92), (r1 * 0.8, length), (0, length)]
    o = lib.lathe(name, prof, mat, segments=24, axis="x", cap=False)
    lib.auto_smooth(o, 50)
    d = direction.normalized()
    q = Vector((1, 0, 0)).rotation_difference(d)
    lib.transform(o, lib.at(*at) @ q.to_matrix().to_4x4())


# ---------------------------------------------------------------------------
# Rope chain


def rope(it: lib.Item, gold, stamp, *, anchor: bool = False) -> None:
    x_end_r, x_end_l = 0.0016, -0.0066
    path = open_run(x_end_r, x_end_l, 0.00125 if anchor else 0.00044)
    fr = G.frames(path, closed=False)
    bm = bmesh.new()
    if anchor:
        # anchor (cable) chain: solid oval links, each turned at right angles to the next,
        # a little flattened like a worn, diamond-cut chain
        for i, (p, (t, n, b)) in enumerate(zip(path, fr)):
            u, v = (n, b) if i % 2 else (b, -n)
            m = Matrix(((t.x, u.x, v.x, p.x), (t.y, u.y, v.y, p.y), (t.z, u.z, v.z, p.z), (0, 0, 0, 1)))
            G.oval_into(bm, m, 0.00098, 0.00062, 0.00029, seg=14, sides=6, sz=0.85)
    else:
        tilt = math.radians(64)
        dphi = math.radians(57)
        R, r = 0.00088, 0.00027
        for i, (p, (t, n, b)) in enumerate(zip(path, fr)):
            phi = i * dphi
            d = n * math.cos(phi) + b * math.sin(phi)  # direction the ring leans towards
            nr = (t * math.cos(tilt) + d * math.sin(tilt)).normalized()  # ring plane normal
            u = d.cross(t).normalized()  # stays in the ring plane
            v = nr.cross(u).normalized()
            m = Matrix(((u.x, v.x, nr.x, p.x), (u.y, v.y, nr.y, p.y), (u.z, v.z, nr.z, p.z), (0, 0, 0, 1)))
            G.oval_into(bm, m, R, R * 1.12, r, seg=10, sides=5)
    for f in bm.faces:
        f.smooth = True
    lib.mesh_object("rope", bm, gold)

    # end caps
    a, b_ = path[0], path[-1]
    ta, tb = (path[1] - path[0]).normalized(), (path[-1] - path[-2]).normalized()
    end_cap("cap.r", a + ta * 0.0003, -ta, gold, r0=0.0011, r1=0.0005, length=0.0016)
    end_cap("cap.l", b_ - tb * 0.0003, tb, gold, r0=0.0011, r1=0.0005, length=0.0016)
    tip = a + ta * 0.0003 - ta * 0.0016
    G.torus("cap.r.eye", 0.00038, 0.00015, gold, lib.at(tip.x - 0.0003, tip.y, tip.z) @ lib.rot("x", math.pi / 2), seg=12, sides=6)

    y = (a.y + b_.y) / 2 - 0.0001
    # lobster clasp: a flattened teardrop body along X with a trigger on top and an eye at its tail
    xl = b_.x + tb.x * 0.0014  # left cap tip
    G.torus("lob.eye", 0.00045, 0.00017, gold, lib.at(xl - 0.0001, y, 0) @ lib.rot("x", math.pi / 2), seg=14, sides=6)
    body_len = 0.0042
    prof = []
    for k in range(13):
        s = k / 12
        prof.append((0.00082 * math.sin(math.pi * s**0.8) ** 0.9 + (0.00018 if 0 < k < 12 else 0), s * body_len))
    prof[0] = (0.0, 0.0)
    prof[-1] = (0.0, body_len)
    lob = lib.lathe("lob.body", prof, gold, segments=24, axis="x", cap=False)
    lob.data.transform(Matrix.Diagonal((1, 1, 0.55, 1)))
    lib.transform(lob, lib.at(xl + 0.00025, y, 0))
    lib.auto_smooth(lob, 60)
    lib.box("lob.trigger", (0.0016, 0.0005, 0.0007), gold, center=(xl + 0.0026, y + 0.0009, 0), bevel=0.00012)
    # hook closing on the jump ring
    jr_x = xl + 0.00025 + body_len + 0.00035
    G.torus("jump", 0.0009, 0.00026, gold, lib.at(jr_x, y, 0), seg=24, sides=7)
    # tag hanging from the jump ring, stamped 585 + assay star
    ring_c = Vector((jr_x, y - 0.001, 0.0))
    tag_c = Vector((jr_x, ring_c.y - 0.0004 - 0.0008, 0.0))
    tag = lib.box("tag", (0.003, 0.0017, 0.00034), gold, center=tag_c, bevel=0.00008)
    lib.auto_smooth(tag, 40)
    G.torus("tag.ring", 0.0004, 0.00014, gold, lib.at(*ring_c) @ lib.rot("y", math.pi / 2), seg=12, sides=5)
    hm = G.hallmark("hm", "585", "star", stamp, digit=0.0005)
    G.place(hm, lib.at(tag_c.x, tag_c.y - 0.0001, 0.00017))


# ---------------------------------------------------------------------------
# Bismarck bracelet


def bismarck(it: lib.Item, gold, stamp) -> None:
    x_end_r, x_end_l = 0.0034, -0.0059
    step = 0.00118
    path = open_run(x_end_r, x_end_l, step)
    fr = G.frames(path, closed=False)
    bm = bmesh.new()
    L, W = 0.0019, 0.00072  # half length / half width of a link's oval
    wire = 0.00042
    ang = math.radians(34)
    for i, (p, (t, n, b)) in enumerate(zip(path, fr)):
        for side in (-1, 1):
            # long axis leans across the band, alternate rows twist the other way
            ax = (t * math.cos(ang) + n * side * math.sin(ang)).normalized()
            tw = math.radians(28) * (1 if i % 2 else -1) * side
            perp = b.cross(ax).normalized()
            # twist the link about its long axis
            pv = perp * math.cos(tw) + b * math.sin(tw)
            nv = ax.cross(pv).normalized()
            c = p + n * side * 0.00105 + b * (0.00012 if (i + (side > 0)) % 2 else -0.00012)
            m = Matrix(((ax.x, pv.x, nv.x, c.x), (ax.y, pv.y, nv.y, c.y), (ax.z, pv.z, nv.z, c.z), (0, 0, 0, 1)))
            G.oval_into(bm, m, L, W, wire, seg=12, sides=5, sz=0.75)
    for f in bm.faces:
        f.smooth = True
    lib.mesh_object("weave", bm, gold)

    a, b_ = path[0], path[-1]
    y = (a.y + b_.y) / 2
    zt = 0.0013  # half thickness of the box
    # end pieces where the weave is soldered into the clasp
    lib.box("end.r", (0.0013, 0.0056, 0.0022), gold, center=(x_end_r - 0.00065, y, 0), bevel=0.0003)
    # box clasp body (left), engraved line round its top
    bx0, bx1 = x_end_l, -0.0005
    box = lib.box("box", (bx1 - bx0, 0.0058, 2 * zt), gold, center=((bx0 + bx1) / 2, y, 0), bevel=0.00035)
    lib.auto_smooth(box, 40)
    inset = 0.0006
    rect = [(bx0 + inset, y - 0.0029 + inset), (bx1 - inset, y - 0.0029 + inset), (bx1 - inset, y + 0.0029 - inset), (bx0 + inset, y + 0.0029 - inset)]
    lib.stroke("box.line", rect, 0.00012, 0.00003, stamp, z=zt, closed=True)
    # tongue between box and end piece: the folded spring plate, stamped
    tx0, tx1 = bx1 - 0.0002, x_end_r - 0.0013
    lib.box("tongue", (tx1 - tx0, 0.0042, 0.0006), gold, center=((tx0 + tx1) / 2, y, 0), bevel=0.0001)
    hm = G.hallmark("hm", "585", "МЮЗ", stamp, digit=0.00048)
    G.place(hm, lib.at((tx0 + tx1) / 2, y - 0.0002, 0.0003) @ lib.rot("z", math.pi / 2))


def build(it: lib.Item) -> None:
    it.ao_size = 1024
    gold = G.gold(it, 0.14)
    stamp = G.stamp_mat(it)
    if "bracelet" in it.id or "bismarck" in it.d.get("name", "").lower():
        bismarck(it, gold, stamp)
    else:
        rope(it, gold, stamp, anchor="anchor" in it.id)
