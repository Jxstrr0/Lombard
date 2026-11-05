"""
Plain gold band (wedding ring): comfort-fit lathe profile, 583 + assay star struck
inside at the top, a faint resizing seam across the bottom, a few hairline scratches.

Placeholder convention (src/render/items.ts): band in the XY plane, hole axis Z,
outer radius ≈ 0.0101, inner 0.0086, 4.2 mm wide. Hotspots: inner (0, 0.0085, 0),
shank (0, −0.01, 0).
"""

from __future__ import annotations

import math

import bmesh
import lib
from kinds import _gold as G
from mathutils import Vector

AO_DISTANCE = 0.0004

RI = 0.0086  # inner radius at the band edges
RO = 0.0101  # outer radius at the crown of the dome
HW = 0.0021  # half width (along Z)
DOME_IN = 0.00012  # comfort-fit bulge of the inner face
DOME_OUT = 0.00042  # the outer face drops this much towards the edges
ER = 0.00035  # edge rounding


def r_in(z: float) -> float:
    t = min(abs(z) / HW, 1.0)
    return RI - DOME_IN * (1 - t * t)


def r_out(z: float) -> float:
    t = min(abs(z) / HW, 1.0)
    return RO - DOME_OUT * t * t


def band_profile(ri=r_in, ro=r_out, hw=HW, er=ER, n_face=14, n_corner=5) -> list[tuple[float, float]]:
    """Closed (radius, z) cross-section: outer face, top edge, inner face, bottom edge."""
    pts = []
    zc = hw - er
    for i in range(n_face + 1):  # outer face, −z → +z
        z = -zc + 2 * zc * i / n_face
        pts.append((ro(z), z))
    co = (ro(zc) - er, zc)
    ci = (ri(zc) + er, zc)
    for k in range(1, n_corner + 1):  # outer top corner
        a = math.pi / 2 * k / n_corner
        pts.append((co[0] + er * math.cos(a), co[1] + er * math.sin(a)))
    for k in range(0, n_corner + 1):  # inner top corner
        a = math.pi / 2 + math.pi / 2 * k / n_corner
        pts.append((ci[0] + er * math.cos(a), ci[1] + er * math.sin(a)))
    for i in range(1, n_face):  # inner face, +z → −z
        z = zc - 2 * zc * i / n_face
        pts.append((ri(z), z))
    ci = (ri(-zc) + er, -zc)
    co = (ro(-zc) - er, -zc)
    for k in range(0, n_corner + 1):
        a = math.pi + math.pi / 2 * k / n_corner
        pts.append((ci[0] + er * math.cos(a), ci[1] + er * math.sin(a)))
    for k in range(0, n_corner):
        a = 1.5 * math.pi + math.pi / 2 * k / n_corner
        pts.append((co[0] + er * math.cos(a), co[1] + er * math.sin(a)))
    pts.append(pts[0])
    return pts


def offset_loop(pts, d: float) -> list[tuple[float, float]]:
    """Offset a closed (r, z) loop outward (away from its centroid side) by d."""
    P = pts[:-1]
    n = len(P)
    cr = sum(p[0] for p in P) / n
    cz = sum(p[1] for p in P) / n
    out = []
    for i in range(n):
        a, b = P[i - 1], P[(i + 1) % n]
        tr, tz = b[0] - a[0], b[1] - a[1]
        ln = math.hypot(tr, tz) or 1e-9
        nr, nz = tz / ln, -tr / ln
        if (P[i][0] - cr) * nr + (P[i][1] - cz) * nz < 0:
            nr, nz = -nr, -nz
        out.append((P[i][0] + nr * d, P[i][1] + nz * d))
    out.append(out[0])
    return out


def sector(name: str, profile, a0: float, a1: float, steps: int, mat) -> object:
    """A partial lathe of a closed profile between angles a0…a1 (no end caps)."""
    bm = bmesh.new()
    rings = []
    P = profile[:-1]
    for s in range(steps + 1):
        a = a0 + (a1 - a0) * s / steps
        rings.append([bm.verts.new((r * math.cos(a), r * math.sin(a), z)) for r, z in P])
    n = len(P)
    for s in range(steps):
        A, B = rings[s], rings[s + 1]
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((A[i], A[j], B[j], B[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        f.smooth = True
    return lib.mesh_object(name, bm, mat)


def scratches(it: lib.Item, mat, radius, n: int, seed: int, *, zmax: float, avoid=None) -> None:
    """Hairline scratches on an outer cylindrical surface (wrapped flat strokes)."""
    import random

    rnd = random.Random(seed)
    for k in range(n):
        th = rnd.uniform(0, 2 * math.pi)
        if avoid and any(abs(math.atan2(math.sin(th - a), math.cos(th - a))) < w for a, w in avoid):
            continue
        z0 = rnd.uniform(-zmax, zmax)
        ln = rnd.uniform(0.0006, 0.0022)
        ang = rnd.uniform(-0.5, 0.5) + (0 if rnd.random() < 0.6 else math.pi / 2)
        pts = []
        for i in range(5):
            t = i / 4 - 0.5
            pts.append((t * ln * math.cos(ang), max(-zmax, min(zmax, z0 + t * ln * math.sin(ang) + 0.00004 * math.sin(i)))))
        o = lib.stroke(f"scratch.{k}", pts, rnd.uniform(0.000012, 0.00002), 0.000003, mat, round_caps=False)
        G.wrap_cylinder([o], lambda z: radius(z) - 0.0000015, th, inward=False)


def build(it: lib.Item) -> None:
    it.ao_size = 1024
    gold = G.gold(it, 0.12)
    stamp = G.stamp_mat(it)
    satin = G.satin(it)

    prof = band_profile()
    band = lib.lathe("band", prof, gold, segments=160, axis="z", cap=False)
    lib.auto_smooth(band, 60)

    # Resizing seam: a hair-thin strip, a few microns proud, right round the profile at −Y.
    d = 0.00004 / RO
    sector("seam", offset_loop(prof, 0.000003), -math.pi / 2 - d, -math.pi / 2 + d, 1, satin)

    # 583 + star, struck inside the band at the top, reading from the hole (up = +Z, the front).
    hm = G.hallmark("hm", "583", "star", stamp, digit=0.00058)
    G.wrap_cylinder(hm, lambda z: r_in(z) + 0.000004, math.pi / 2, inward=True)

    scratches(it, satin, r_out, 16, 583, zmax=HW * 0.75, avoid=[(-math.pi / 2, 0.08)])
