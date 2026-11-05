"""
Phones: Mangosteen m5 / m4S (fruit-logo phones), Galaxia Stella 4 / Nota 3
(removable back cover; the Nota has a stylus), Severin K1 push-button phone.

Placeholder convention (src/render/items.ts): a 0.06 × 0.125 × 0.008 slab centred
on the origin, screen +Z, back −Z (logo, camera at +X / top), bottom edge −Y
(port, screws, grilles), SIM tray on the +X edge. Every def is built at that size;
`model.scale` (0.85 for the Severin) sizes it at runtime, hotspots included.

The body is a rounded-rectangle "slab": outlines inset ring by ring along Z, so a
single list of (inset, z, material) rings gives chamfers, soap-bar curves, seams
and ribbed rims. Ports, grilles and grooves are boolean cuts whose walls take the
dark material. Features on a face are built flat in a local frame (`F`) and moved
onto it, so the same code places a button on a side or a lens on the back.

The screens are off: dark, glossy glass. Branch on `item.d["id"]`.
"""

from __future__ import annotations

import math
from typing import Callable, Sequence

import bmesh
import bpy
import lib
from mathutils import Matrix

W, H, D = 0.06, 0.125, 0.008
HW, HH, HD = W / 2, H / 2, D / 2
AO_DISTANCE = 0.0015

Shape = Callable[[float], list]


# ---------------------------------------------------------------------------
# Outlines


def rr(w: float, h: float, r: float, seg: int = 8, cx: float = 0.0, cy: float = 0.0) -> list[tuple[float, float]]:
    """Rounded rectangle, counter-clockwise; a radius at half the short side makes a pill."""
    if r >= min(w, h) / 2 - 1e-6:
        return pill(w, h, seg * 2, cx, cy)
    r = max(r, 1e-5)
    pts = []
    for x, y, a0 in ((w / 2 - r, -h / 2 + r, -90), (w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180)):
        for i in range(seg + 1):
            a = math.radians(a0 + 90 * i / seg)
            pts.append((cx + x + r * math.cos(a), cy + y + r * math.sin(a)))
    return pts


def pill(w: float, h: float, seg: int = 16, cx: float = 0.0, cy: float = 0.0) -> list[tuple[float, float]]:
    if abs(w - h) < 1e-6:
        return circle(w / 2, seg * 2, cx, cy)
    pts = []
    if w > h:
        r, o = h / 2, (w - h) / 2
        for side, a0 in ((1, -90), (-1, 90)):
            for i in range(seg + 1):
                a = math.radians(a0 + 180 * i / seg)
                pts.append((cx + side * o + r * math.cos(a), cy + r * math.sin(a)))
    else:
        r, o = w / 2, (h - w) / 2
        for side, a0 in ((-1, 180), (1, 0)):
            for i in range(seg + 1):
                a = math.radians(a0 + 180 * i / seg)
                pts.append((cx + r * math.cos(a), cy + side * o + r * math.sin(a)))
    return pts


def circle(r: float, n: int = 24, cx: float = 0.0, cy: float = 0.0) -> list[tuple[float, float]]:
    return [(cx + r * math.cos(2 * math.pi * i / n), cy + r * math.sin(2 * math.pi * i / n)) for i in range(n)]


def rr_shape(w: float, h: float, r: float, seg: int = 8) -> Shape:
    return lambda inset: rr(w - 2 * inset, h - 2 * inset, max(r - inset, 1e-4), seg)


def circle_shape(r: float, n: int = 24) -> Shape:
    return lambda inset: circle(r - inset, n)


# ---------------------------------------------------------------------------
# Frames: local XY on a face, local +Z outward

BASIS = {
    "front": ((1, 0, 0), (0, 1, 0), (0, 0, 1)),
    "back": ((-1, 0, 0), (0, 1, 0), (0, 0, -1)),
    "bottom": ((1, 0, 0), (0, 0, 1), (0, -1, 0)),
    "top": ((1, 0, 0), (0, 0, -1), (0, 1, 0)),
    "px": ((0, 1, 0), (0, 0, 1), (1, 0, 0)),
    "nx": ((0, 1, 0), (0, 0, -1), (-1, 0, 0)),
}


def F(face: str, pos: Sequence[float], spin: float = 0.0) -> Matrix:
    u, v, n = BASIS[face]
    m = Matrix(((u[0], v[0], n[0], pos[0]), (u[1], v[1], n[1], pos[1]), (u[2], v[2], n[2], pos[2]), (0, 0, 0, 1)))
    return m @ lib.rot("z", spin) if spin else m


# ---------------------------------------------------------------------------
# Geometry


_n = [0]


def _name(kind: str) -> str:
    _n[0] += 1
    return f"{kind}.{_n[0]}"


def slab(shape: Shape, rings: Sequence[tuple], *, cap_lo, cap_hi, m: Matrix | None = None, smooth: float = 35, name: str = "slab") -> bpy.types.Object:
    """Loft an outline through `rings` = [(inset, z, material of the band below), ...] (z rising)."""
    mats: list = []

    def idx(mat) -> int:
        if mat not in mats:
            mats.append(mat)
        return mats.index(mat)

    bm = bmesh.new()
    vr = [[bm.verts.new((x, y, z)) for x, y in shape(inset)] for inset, z, *_ in rings]
    n = len(vr[0])
    for k in range(1, len(vr)):
        a, b = vr[k - 1], vr[k]
        mi = idx(rings[k][2])
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((a[i], a[j], b[j], b[i])).material_index = mi
    bm.faces.new(list(reversed(vr[0]))).material_index = idx(cap_lo)
    bm.faces.new(vr[-1]).material_index = idx(cap_hi)
    obj = lib.mesh_object(_name(name), bm, mats[0])
    for mt in mats[1:]:
        obj.data.materials.append(mt)
    if m is not None:
        obj.data.transform(m)
    lib.auto_smooth(obj, smooth)
    return obj


def pocket(shape: Shape, depth: float, mat, m: Matrix, out: float = 0.0015) -> bpy.types.Object:
    """Cutter: the outline from `depth` under the face to `out` above it."""
    return slab(shape, [(0, -depth, mat), (0, out, mat)], cap_lo=mat, cap_hi=mat, m=m, name="cut")


def _boolean(target: bpy.types.Object, cutter: bpy.types.Object, solver: str) -> bpy.types.Mesh:
    mod = target.modifiers.new("cut", "BOOLEAN")
    mod.operation = "DIFFERENCE"
    mod.solver = solver
    mod.object = cutter
    mod.material_mode = "TRANSFER"
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(target.evaluated_get(dg), depsgraph=dg)
    target.modifiers.remove(mod)
    return me


def cut(target: bpy.types.Object, cutters: list, smooth: float = 35) -> None:
    """Boolean-subtract the cutters from target; the new walls take the cutters' material.

    Manifold solver first (robust on these closed meshes), exact as the fallback; a
    result that comes back empty or unchanged is rejected."""
    if not cutters:
        return
    for c in cutters:
        if c.data.users > 1:
            c.data = c.data.copy()
    if len(cutters) > 1:
        with bpy.context.temp_override(active_object=cutters[0], selected_editable_objects=cutters, object=cutters[0]):
            bpy.ops.object.join()
    c = cutters[0]
    before = len(target.data.polygons)
    for solver in ("MANIFOLD", "EXACT"):
        me = _boolean(target, c, solver)
        if len(me.polygons) > before // 2 and len(me.polygons) != before:
            old = target.data
            target.data = me
            bpy.data.meshes.remove(old)
            break
        bpy.data.meshes.remove(me)
    else:
        print(f"[items] warning: cut on {target.name} failed")
    bpy.data.objects.remove(c)
    lib.auto_smooth(target, smooth)


def place(objs, m: Matrix):
    lib.transform(objs, m)
    return objs


def text_on(m: Matrix, body: str, size: float, mat, *, x: float = 0.0, y: float = 0.0, depth: float = 0.00002, bold: float = 0.0, spacing: float = 1.0, align: str = "CENTER", base: bool = False):
    o = lib.text(_name("txt"), body, size, depth, mat, pos=(x, y, 0), facing=1, bold=bold, spacing=spacing, align=align, base=base)
    return place(o, m)


def poly_on(m: Matrix, pts, depth: float, mat, *, z: float = 0.0, bevel: float = 0.0):
    return place(lib.polygon(_name("poly"), pts, depth, mat, z=z, facing=1, base=False, bevel=bevel), m)


def line_on(m: Matrix, pts, width: float, depth: float, mat, *, z: float = 0.0, closed: bool = False):
    return place(lib.stroke(_name("line"), pts, width, depth, mat, z=z, facing=1, closed=closed), m)


def disc(m: Matrix, r: float, z0: float, z1: float, mat, *, n: int = 24, round_top: float = 0.0, cap=None):
    rings = [(0, z0, mat), (0, z1 - round_top, mat)]
    if round_top:
        rings.append((round_top, z1, mat))
    return slab(circle_shape(r, n), rings, cap_lo=mat, cap_hi=cap or mat, m=m)


def pentalobe(m: Matrix, head, dark, r: float = 0.00062):
    """A five-lobed screw head: a flat disc with a lobed recess."""
    disc(m, r, -0.0001, 0.00003, head, n=20)
    lobes = [(r * 0.62 * (0.72 + 0.28 * math.cos(5 * a)) * math.cos(a), r * 0.62 * (0.72 + 0.28 * math.cos(5 * a)) * math.sin(a)) for a in [2 * math.pi * i / 30 for i in range(30)]]
    poly_on(m, lobes, 0.000012, dark, z=0.00003)


def crosshead(m: Matrix, head, dark, r: float = 0.0009):
    disc(m, r, -0.0001, 0.00008, head, n=20, round_top=0.00004)
    for a in (0.3, 0.3 + math.pi / 2):
        c, s = math.cos(a) * r * 0.6, math.sin(a) * r * 0.6
        line_on(m, [(-c, -s), (c, s)], r * 0.22, 0.000012, dark, z=0.00008)


def holes(m: Matrix, centres, r: float, depth: float, dark, n: int = 12) -> list:
    return [pocket(circle_shape(r, n), depth, dark, m @ lib.at(x, y, 0)) for x, y in centres]


def camera(m: Matrix, ring, dark, glass, *, r: float = 0.0034, proud: float = 0.0005, rim: float = 0.0004):
    """Rear camera: a metal ring standing proud, a dark ring inside, the glass lens in the middle."""
    slab(circle_shape(r, 40), [(0, -0.0002, ring), (0, proud - 0.0001, ring), (0.00012, proud, ring)], cap_lo=ring, cap_hi=ring, m=m)
    disc(m, r - rim, proud, proud + 0.00002, dark, n=40)
    disc(m, (r - rim) * 0.58, proud + 0.00002, proud + 0.00006, glass, n=32)
    disc(m, (r - rim) * 0.22, proud + 0.00006, proud + 0.00008, dark, n=20)


def mangosteen_logo(m: Matrix, mat, scale: float = 1.0):
    """A round fruit with a four-sepal crown and a short stem. Flush-inlaid: almost no height."""
    s = scale
    poly_on(m, [(x * 1.04, y) for x, y in circle(0.0058 * s, 48, 0, -0.0013 * s)], 0.00002, mat)
    base = (0, 0.0040 * s)
    for k, ang in enumerate((-0.98, -0.33, 0.33, 0.98)):
        dx, dy = math.sin(ang), math.cos(ang)
        cx, cy = base[0] + dx * 0.0021 * s, base[1] + dy * 0.0021 * s
        leaf = []
        for i in range(20):
            t = 2 * math.pi * i / 20
            lx, ly = 0.0011 * s * math.cos(t), 0.0024 * s * math.sin(t)
            leaf.append((cx + lx * math.cos(ang) + ly * math.sin(ang), cy - lx * math.sin(ang) + ly * math.cos(ang)))
        poly_on(m, leaf, 0.00002, mat)
    poly_on(m, [(-0.0003 * s, 0.0040 * s), (0.0003 * s, 0.0040 * s), (0.0004 * s, 0.0068 * s), (-0.0002 * s, 0.0068 * s)], 0.00002, mat)


# ---------------------------------------------------------------------------
# Mangosteen m5 and m4S


def mangosteen(it: lib.Item, m4s: bool) -> None:
    color = it.color
    if m4s:
        shell = lib.material(it, "steel", "#b9bcc0", metal=1.0, rough=0.22)
        back_mat = lib.material(it, "glass_white", color, rough=0.05, ao=False)
        polish = lib.material(it, "mirror", "#dfe1e4", metal=1.0, rough=0.06)
        ink = None
    else:
        shell = lib.material(it, "alu", color, metal=0.85, rough=0.42)
        back_mat = shell
        polish = lib.material(it, "polished", "#a9abb0", metal=1.0, rough=0.08)
        ink = lib.material(it, "ink", "#c9cacd", rough=0.5, ao=False)
    glass = lib.material(it, "glass", "#050607", rough=0.04, ao=False)
    dark = lib.material(it, "dark", "#121314", metal=0.3, rough=0.55)
    # printed lettering is clean, and its strokes are thinner than an AO texel: no AO
    ink = ink or lib.material(it, "print", "#2a2b2d", rough=0.5, ao=False)
    r = 0.0085
    shape = rr_shape(W, H, r, 10)

    if m4s:
        # stainless band; glass front and back sit in it
        band = slab(shape, [(0.0004, -0.0033, shell), (0, -0.003, shell), (0, 0.003, shell), (0.0004, 0.0033, shell)], cap_lo=shell, cap_hi=shell, smooth=40)
        slab(shape, [(0.0009, -0.004, back_mat), (0.0005, -0.0037, back_mat), (0.0005, -0.0031, back_mat)], cap_lo=back_mat, cap_hi=back_mat)
        front = slab(shape, [(0.0005, 0.0031, back_mat), (0.0005, 0.0037, back_mat), (0.0009, 0.004, back_mat)], cap_lo=back_mat, cap_hi=back_mat)
        fz = 0.004
        # black display under the white front glass
        poly_on(F("front", (0, 0.0005, fz)), rr(0.0505, 0.0790, 0.0004), 0.00001, glass)
    else:
        # aluminium unibody with diamond-cut chamfers
        band = slab(shape, [(0.0005, -0.004, polish), (0, -0.0035, polish), (0, 0.0028, shell), (0.0005, 0.0033, polish)], cap_lo=shell, cap_hi=shell, smooth=40)
        front = slab(shape, [(0.0006, 0.0031, glass), (0.0006, 0.0037, glass), (0.0009, 0.004, glass)], cap_lo=glass, cap_hi=glass)
        fz = 0.004
        # glass inlays at the top and bottom of the back
        top_inlay = [p for p in rr(W - 0.0014, H - 0.0014, r - 0.0007, 10) if p[1] > 0.047] + [(-(W - 0.0014) / 2, 0.047), ((W - 0.0014) / 2, 0.047)]
        for outline in (top_inlay, [(x, -y) for x, y in reversed(top_inlay)]):
            poly_on(F("back", (0, 0, -0.004)), [(-x, y) for x, y in outline], 0.00002, glass)

    # --- front: earpiece slot, front camera, home button
    fm = F("front", (0, 0, fz))
    front_cuts = [pocket(lambda i: pill(0.0098, 0.0013, 8), 0.0004, dark, fm @ lib.at(0, 0.0525, 0))]
    front_cuts.append(pocket(circle_shape(0.0056, 40), 0.0004, dark, fm @ lib.at(0, -0.0528, 0)))
    cut(front, front_cuts)
    cam_xy = (-0.0098, 0.0525) if m4s else (0, 0.0575)
    disc(F("front", (cam_xy[0], cam_xy[1], fz)), 0.0012, -0.00002, 0.000015, dark, n=20)
    disc(F("front", (cam_xy[0], cam_xy[1], fz)), 0.0006, 0.000015, 0.00003, glass, n=16)
    if not m4s:
        disc(F("front", (-0.0062, 0.0575, fz)), 0.0007, -0.00002, 0.00001, dark, n=16)  # proximity sensor window
    btn = F("front", (0, -0.0528, fz))
    btn_mat = back_mat if m4s else glass
    slab(circle_shape(0.0051, 40), [(0, -0.0004, btn_mat), (0, -0.00012, btn_mat), (0.0003, -0.00005, btn_mat)], cap_lo=btn_mat, cap_hi=btn_mat, m=btn)
    line_on(btn, rr(0.0029, 0.0029, 0.0007, 4), 0.00016, 0.00001, dark if m4s else ink, z=-0.00005, closed=True)

    # --- back: logo, camera, flash, wordmark and small print
    bz = -0.004
    bm_ = F("back", (0, 0.010, bz))
    mangosteen_logo(bm_, polish)
    camera(F("back", (0.0205, 0.0535, bz)), polish, dark, glass, r=0.0032 if m4s else 0.0034, proud=0.0002 if m4s else 0.0005)
    flash_x = 0.0118 if m4s else 0.0105
    disc(F("back", (flash_x, 0.0535, bz)), 0.0014, -0.00002, 0.00004, ink if not m4s else dark, n=24)
    disc(F("back", (flash_x, 0.0535, bz)), 0.00095, 0.00004, 0.00006, lib.material(it, "glass_white", "#e8e8e6", rough=0.05, ao=False) if m4s else polish, n=24)
    if not m4s:
        disc(F("back", (0.0155, 0.0535, bz)), 0.00035, -0.00002, 0.00003, dark, n=12)  # microphone
    tm = F("back", (0, 0, bz))
    text_on(tm, "Mangosteen", 0.0036, ink, y=-0.022, bold=0.5)
    model = "MG-1104" if m4s else "MG-1205"
    imei = "01 291 400 618 223" if m4s else "01 384 200 517 936"
    text_on(tm, "Designed by Mangosteen in Mostograd. Assembled in Mostograd", 0.00105, ink, y=-0.037)
    text_on(tm, f"Model {model}   IMEI {imei}", 0.00105, ink, y=-0.0393)

    # --- sides
    sz = -0.0004 if not m4s else 0.0
    mute = F("nx", (-HW, 0.046, sz))
    side_cuts = [pocket(lambda i: rr(0.0055 - 2 * i, 0.0021 - 2 * i, 0.0006), 0.0006, dark, mute)]
    vols = (0.034, 0.024) if m4s else (0.0345, 0.0245)
    for y in vols:
        slab(circle_shape(0.0029, 32), [(0, -0.0003, shell), (0, 0.0003, shell), (0.0004, 0.00045, shell)], cap_lo=shell, cap_hi=shell, m=F("nx", (-HW, y, sz)))
    slab(rr_shape(0.0026, 0.0012, 0.0004), [(0, -0.0006, shell), (0, -0.0001, shell)], cap_lo=shell, cap_hi=shell, m=mute @ lib.at(-0.0012, 0, 0))
    top = F("top", (0.017, HH, sz))
    slab(rr_shape(0.0095, 0.0024, 0.0012), [(0, -0.0003, shell), (0, 0.0003, shell), (0.0003, 0.00045, shell)], cap_lo=shell, cap_hi=shell, m=top)
    # SIM tray on +X: pocket, tray with eject hole and engraved serial; serial printed beside
    sy = it.hotspot("simtray").y if it.hotspot("simtray") else 0.010
    tray_m = F("px", (HW, sy, sz))
    side_cuts.append(pocket(lambda i: pill(0.0150, 0.0030, 8), 0.0006, dark, tray_m))
    serial = "C39H 7RKQ DTC1" if m4s else "F2LJ 9X4M DTTP"
    slab(lambda i: pill(0.0148 - 2 * i, 0.0028 - 2 * i, 8), [(0, -0.0006, shell), (0, -0.00002, shell)], cap_lo=shell, cap_hi=shell, m=tray_m)
    disc(tray_m @ lib.at(0.0052, 0, 0), 0.0004, -0.00002, 0.0, dark, n=12)
    text_on(tray_m, serial, 0.00052, ink, x=-0.0012, y=-0.00002, depth=0.000012)
    if m4s:
        text_on(F("px", (HW, sy + 0.0122, sz)), serial, 0.0005, ink, depth=0.00001)
        # antenna gaps in the band
        for x, y in ((-0.0215, HH), (0.0215, -HH), (-0.0215, -HH)):
            face = "top" if y > 0 else "bottom"
            poly_on(F(face, (x, y, 0)), rr(0.0006, 0.0058, 0.0001, 2), 0.00002, dark)
        poly_on(F("nx", (-HW, 0.054, 0)), rr(0.0006, 0.0058, 0.0001, 2), 0.00002, dark)

    # --- top: headphone jack on the m4S; m5 has it at the bottom
    if m4s:
        side_cuts += holes(F("top", (-0.018, HH, 0)), [(0, 0)], 0.0018, 0.004, dark, 24)

    # --- bottom: port, two five-lobed screws, speaker and microphone grilles
    bm = F("bottom", (0, -HH, sz))
    if m4s:
        side_cuts.append(pocket(lambda i: rr(0.0212, 0.0024, 0.0005, 4), 0.003, dark, bm))
        slab(rr_shape(0.0172, 0.0006, 0.0002, 2), [(0, -0.003, dark), (0, -0.0007, dark)], cap_lo=dark, cap_hi=dark, m=bm)  # connector tongue
        screws = (-0.0128, 0.0128)
        side_cuts += holes(bm, [(0.0162 + i * 0.0018, k) for i in range(5) for k in (-0.0004, 0.0004)], 0.0005, 0.0012, dark, 10)
        side_cuts += holes(bm, [(-0.0162 - i * 0.0018, k) for i in range(5) for k in (-0.0004, 0.0004)], 0.0005, 0.0012, dark, 10)
    else:
        side_cuts.append(pocket(lambda i: pill(0.0078, 0.0016, 8), 0.0025, dark, bm))
        screws = (-0.0058, 0.0058)
        side_cuts += holes(bm, [(0.0098 + i * 0.0019, 0) for i in range(6)], 0.0006, 0.0012, dark, 10)
        side_cuts += holes(bm, [(-0.0098 - i * 0.0019, 0) for i in range(3)], 0.0006, 0.0012, dark, 10)
        side_cuts += holes(bm, [(-0.0205, 0)], 0.0018, 0.004, dark, 24)  # headphone jack
    cut(band, side_cuts)
    for x in screws:
        pentalobe(F("bottom", (x, -HH, sz)), polish, dark)


# ---------------------------------------------------------------------------
# Galaxia Stella 4 and Nota 3


def galaxia(it: lib.Item, nota: bool) -> None:
    color = it.color
    if nota:
        cover = lib.material(it, "leather", color, rough=0.78)
        rim = lib.material(it, "rim", "#c9c2b4", metal=1.0, rough=0.25)
        bezel = lib.material(it, "bezel", lib.shade(color, 1.02), rough=0.06, ao=False)
        ink = lib.material(it, "ink", "#6f6a62", metal=0.7, rough=0.35, ao=False)
    else:
        cover = lib.material(it, "cover", color, rough=0.18)
        rim = lib.material(it, "rim", "#b7bcc4", metal=1.0, rough=0.18)
        bezel = lib.material(it, "bezel", lib.shade(color, 0.8), rough=0.05, ao=False)
        ink = lib.material(it, "ink", "#c9ced8", metal=0.5, rough=0.3, ao=False)
    glass = lib.material(it, "glass", "#050607", rough=0.04, ao=False)
    dark = lib.material(it, "dark", "#111214", metal=0.2, rough=0.6)
    r = 0.0065 if nota else 0.0095
    shape = rr_shape(W, H, r, 10)

    if nota:
        rings = [(0.0016, -0.004, cover), (0.0006, -0.0036, cover), (0.0002, -0.0030, cover), (0.0002, -0.0026, cover),
                 (0.0004, -0.00255, dark), (0.0004, -0.0024, dark), (0.00005, -0.00235, rim), (0, -0.0021, rim)]
        z = -0.0021
        # ribbed rim, like the pages of a book
        for k in range(5):
            rings += [(0, z + 0.0005, rim), (0.00016, z + 0.00065, rim), (0, z + 0.0008, rim)]
            z += 0.0008
        rings += [(0, 0.0026, rim), (0.0003, 0.0031, rim), (0.0006, 0.0033, rim)]
    else:
        rings = [(0.0032, -0.004, cover), (0.0016, -0.0037, cover), (0.0007, -0.0031, cover), (0.0003, -0.0025, cover), (0.00012, -0.0019, cover),
                 (0.0003, -0.00185, dark), (0.0003, -0.0017, dark), (0.00005, -0.00165, rim), (0, -0.0012, rim),
                 (0, 0.0026, rim), (0.0003, 0.0031, rim), (0.0006, 0.0033, rim)]
    body = slab(shape, rings, cap_lo=cover, cap_hi=rim, smooth=38)
    front = slab(shape, [(0.0008, 0.0030, bezel), (0.0008, 0.0037, bezel), (0.0012, 0.004, bezel)], cap_lo=bezel, cap_hi=bezel)
    fz = 0.004
    fm = F("front", (0, 0, fz))
    # display (off: black glass)
    disp_h = 0.1035 if nota else 0.0985
    poly_on(F("front", (0, 0.0012, fz)), rr(0.0556 if nota else 0.0545, disp_h, 0.0004), 0.00001, glass)
    # earpiece, brand, camera, sensors
    cut(front, [pocket(lambda i: pill(0.0090, 0.0010, 8), 0.0004, dark, fm @ lib.at(0, 0.0566 if nota else 0.0562, 0))])
    text_on(fm, "GALAXIA", 0.0019, ink, y=0.0595 if nota else 0.0594, spacing=1.25)
    disc(F("front", (0.0135, 0.0566, fz)), 0.0011, -0.00002, 0.000015, dark, n=20)
    disc(F("front", (0.0135, 0.0566, fz)), 0.0005, 0.000015, 0.00003, glass, n=16)
    for x in (-0.0105, -0.0135):
        disc(F("front", (x, 0.0566, fz)), 0.0007, -0.00002, 0.000012, dark, n=16)
    # home key and the two touch keys
    hy = -0.0575 if nota else -0.0568
    hk = F("front", (0, hy, fz))
    slab(lambda i: pill(0.0105 - 2 * i, 0.0030 - 2 * i, 10), [(0, -0.0002, rim), (0, 0.0001, rim), (0.0004, 0.00025, rim)], cap_lo=rim, cap_hi=rim, m=hk)
    line_on(F("front", (-0.0175, hy, fz)), rr(0.0026, 0.0019, 0.0002, 2), 0.00018, 0.00001, ink, closed=True)  # menu
    line_on(F("front", (-0.0175, hy, fz)), [(-0.0008, 0.0002), (0.0008, 0.0002)], 0.00016, 0.000012, ink)
    back_arrow = [(-0.0011, 0.0003), (0.0004, 0.0003), (0.001, -0.0002), (0.0004, -0.0007), (-0.0004, -0.0007)]
    line_on(F("front", (0.0175, hy, fz)), back_arrow, 0.00018, 0.00001, ink)
    line_on(F("front", (0.0175, hy, fz)), [(-0.0011, 0.0003), (-0.0006, 0.0008)], 0.00018, 0.000012, ink)
    line_on(F("front", (0.0175, hy, fz)), [(-0.0011, 0.0003), (-0.0006, -0.0002)], 0.00018, 0.000012, ink)

    # --- back: camera, flash, speaker, logo, small print, stitching (Nota)
    bz = -0.004
    cy = 0.0505 if nota else 0.051
    camera(F("back", (0, cy, bz)), rim, dark, glass, r=0.0042 if nota else 0.0038, proud=0.0006, rim=0.0007)
    disc(F("back", (0, cy - 0.0078, bz)), 0.0016, -0.00002, 0.00004, rim, n=24)
    disc(F("back", (0, cy - 0.0078, bz)), 0.0011, 0.00004, 0.00006, ink, n=24)
    bmx = F("back", (0, 0, bz))
    text_on(bmx, "GALAXIA", 0.0042, ink, y=0.010, spacing=1.3, bold=0.6)
    text_on(bmx, "Galaxia Electronics, Mostograd", 0.0011, ink, y=-0.050)
    text_on(bmx, "GX-N9005" if nota else "GX-I9505", 0.0011, ink, y=-0.0525)
    back_cuts = holes(F("back", (-0.019, -0.056, bz)), [(i * 0.0011, k * 0.0011) for i in range(-2, 3) for k in range(-1, 2)], 0.00032, 0.0006, dark, 8)
    if nota:
        stitch = rr(W - 0.0052, H - 0.0052, r - 0.0026, 10)
        # dashes along the outline
        per = []
        for a, b in zip(stitch, stitch[1:] + stitch[:1]):
            per.append((a, b, math.dist(a, b)))
        total = sum(p[2] for p in per)
        n = int(total / 0.0016)
        pos = []
        acc, k = 0.0, 0
        for a, b, ln in per:
            while k < n and k * total / n <= acc + ln:
                t = (k * total / n - acc) / ln if ln else 0
                pos.append(((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t), (b[0] - a[0]) / (ln or 1), (b[1] - a[1]) / (ln or 1)))
                k += 1
            acc += ln
        for (x, y), dx, dy in pos:
            # back face: local x = -item x
            line_on(F("back", (0, 0, bz)), [(-(x - dx * 0.0005), y - dy * 0.0005), (-(x + dx * 0.0005), y + dy * 0.0005)], 0.00026, 0.00005, ink)
    # pry notch for the cover at the top-left corner seam
    seam_z = -0.0024 if nota else -0.0018
    back_cuts.append(pocket(lambda i: rr(0.004, 0.0009, 0.0003, 3), 0.0005, dark, F("px", (HW, 0.052, seam_z))))
    cut(body, back_cuts)

    # --- sides and ends
    sz = 0.0004
    power = F("px", (HW, 0.030, sz))
    vol = F("nx", (-HW, 0.033, sz))
    for m_, ln in ((power, 0.010), (vol, 0.017)):
        slab(lambda i, ln=ln: pill(ln - 2 * i, 0.0018 - 2 * i, 8), [(0, -0.0004, rim), (0, 0.0003, rim), (0.0003, 0.0005, rim)], cap_lo=rim, cap_hi=rim, m=m_)
    ends = []
    tm = F("top", (0, HH, sz))
    ends += holes(tm @ lib.at(-0.017, 0, 0), [(0, 0)], 0.0018, 0.004, dark, 24)  # headphone jack
    ends += holes(tm, [(0.012, 0)], 0.0004, 0.0008, dark, 10)  # microphone
    bm = F("bottom", (0, -HH, sz))
    if nota:
        # micro-USB 3.0: the wide two-part port
        ends.append(pocket(lambda i: rr(0.0072, 0.0020, 0.0004, 4), 0.003, dark, bm @ lib.at(-0.0024, 0, 0)))
        ends.append(pocket(lambda i: rr(0.0050, 0.0020, 0.0004, 4), 0.003, dark, bm @ lib.at(0.0038, 0.00, 0)))
        ends += holes(bm, [(-0.0105, 0)], 0.00045, 0.0009, dark, 10)
        # stylus slot at the bottom-right corner (from the front)
        st = it.hotspot("stylus")
        sx = st.x if st else 0.022
        ends.append(pocket(lambda i: rr(0.0052, 0.0034, 0.0008, 4), 0.004, dark, F("bottom", (sx, -HH, 0))))
    else:
        ends.append(pocket(lambda i: rr(0.0072, 0.0024, 0.0005, 4), 0.003, dark, bm))
        ends += holes(bm, [(0.0105, 0)], 0.00045, 0.0009, dark, 10)
    ends += holes(F("top", (0.005, HH, sz)), [(0, 0)], 0.0007, 0.0006, dark, 12)  # IR window
    cut(body, ends)
    # micro-USB tongues
    if nota:
        slab(rr_shape(0.0058, 0.0005, 0.0002, 2), [(0, -0.003, dark), (0, -0.0008, dark)], cap_lo=dark, cap_hi=dark, m=bm @ lib.at(-0.0024, -0.0004, 0))
        st = it.hotspot("stylus")
        sx = st.x if st else 0.022
        sm = F("bottom", (sx, -HH, 0))
        # stylus end cap, flush with a hairline gap; the pen body runs up inside the slot
        slab(rr_shape(0.0049, 0.0031, 0.00075, 4), [(0, -0.004, rim), (0, -0.0001, cover), (0.0003, 0.00008, cover)], cap_lo=rim, cap_hi=cover, m=sm)
        line_on(sm, [(-0.0012, 0.00008), (0.0012, 0.00008)], 0.0003, 0.00003, rim, z=0.00006)
    else:
        slab(rr_shape(0.0056, 0.0006, 0.0002, 2), [(0, -0.003, dark), (0, -0.0008, dark)], cap_lo=dark, cap_hi=dark, m=bm @ lib.at(0, -0.0004, 0))


# ---------------------------------------------------------------------------
# Severin K1


KEYS = [
    ("1", "o_o", ""), ("2", "ABC", "АБВГ"), ("3", "DEF", "ДЕЖЗ"),
    ("4", "GHI", "ИЙКЛ"), ("5", "JKL", "МНОП"), ("6", "MNO", "РСТУ"),
    ("7", "PQRS", "ФХЦЧ"), ("8", "TUV", "ШЩЪЫ"), ("9", "WXYZ", "ЬЭЮЯ"),
    ("*", "+", ""), ("0", "␣", ""), ("#", "⇧", ""),
]


STAMP = 0.0002  # depth of the panel the Severin's letters are stamped through (floors at 0.7 of it)


def stamped_panel(word: str, size: float, outline: list, offset: tuple, mat, m: Matrix) -> None:
    """A flat panel (outline, centred at `offset` from the text) STAMP thick, top at local z = 0,
    with `word` cut through it as holes; built as one filled 2D curve."""
    cu = bpy.data.curves.new(_name("stamp"), "FONT")
    cu.body = word
    cu.font = lib.font("DejaVuSansMono.woff2")  # static outlines; Inter's overlapping contours break an even-odd fill
    cu.size = size
    cu.align_x = "CENTER"
    cu.align_y = "CENTER"
    cu.space_character = 1.3
    cu.offset = size * 0.006
    cu.resolution_u = 3
    obj = bpy.data.objects.new(cu.name, cu)
    bpy.context.scene.collection.objects.link(obj)
    with bpy.context.temp_override(active_object=obj, selected_objects=[obj], selected_editable_objects=[obj], object=obj):
        bpy.ops.object.convert(target="CURVE")
    cv = obj.data
    spl = cv.splines.new("POLY")
    spl.points.add(len(outline) - 1)
    for p, (x, y) in zip(spl.points, outline):
        p.co = (x + offset[0], y + offset[1], 0, 1)
    spl.use_cyclic_u = True
    cv.dimensions = "2D"
    cv.fill_mode = "BOTH"
    cv.extrude = STAMP / 2
    cv.offset = 0
    obj.location = (0, 0, -STAMP / 2)
    out = lib.to_mesh(obj)
    lib.assign(out, mat)
    out.data.transform(m)
    out.data.shade_flat()


def handset(m: Matrix, mat, z: float, down: bool = False) -> None:
    """A little telephone handset icon (rotated and lowered for hang-up)."""
    pts = [(-0.0015 + 0.003 * i / 8, 0.0006 * math.sin(math.pi * i / 8)) for i in range(9)]
    if down:
        pts = [(x, -y - 0.0002) for x, y in pts]
    line_on(m, pts, 0.00045, 0.000015, mat, z=z)
    for x in (-0.0015, 0.0015):
        y0 = -0.0002 if down else 0.0
        line_on(m, [(x, y0), (x + (0.0003 if x < 0 else -0.0003), y0 + (-0.0005 if not down else 0.0005))], 0.0006, 0.000015, mat, z=z)


def severin(it: lib.Item) -> None:
    color = it.color
    body_m = lib.material(it, "plastic", color, rough=0.62)
    keys_m = lib.material(it, "keys", "#aeb3ba", metal=0.6, rough=0.38)
    dark = lib.material(it, "dark", "#0f1011", rough=0.5)
    glass = lib.material(it, "window", "#07080a", rough=0.05, ao=False)
    lcd = lib.material(it, "lcd", "#46523f", rough=0.22, ao=False)
    ink = lib.material(it, "ink", "#e6e7e2", rough=0.5, ao=False)
    r = 0.0115
    shape = rr_shape(W, H, r, 12)
    rings = [(0.0030, -0.004, body_m), (0.0012, -0.0035, body_m), (0.0003, -0.0025, body_m), (0, -0.0012, body_m),
             (0, 0.0009, body_m), (0.00025, 0.00095, dark), (0.00025, 0.00115, dark), (0, 0.0012, body_m),
             (0.0003, 0.0025, body_m), (0.0012, 0.0035, body_m), (0.0030, 0.004, body_m)]
    body = slab(shape, rings, cap_lo=body_m, cap_hi=body_m, smooth=38)
    fz, bz = 0.004, -0.004
    fm = F("front", (0, 0, fz))
    bmx = F("back", (0, 0, bz))
    cuts = []

    # --- front: earpiece, brand, screen window, soft keys, nav key, keypad, microphone
    cuts += holes(fm, [(x * 0.0016, 0.0515) for x in range(-3, 4)], 0.00042, 0.0006, dark, 10)
    text_on(fm, "SEVERIN", 0.0024, ink, y=0.0458, spacing=1.35, bold=0.5)
    win = F("front", (0, 0.0215, fz))
    slab(rr_shape(0.0410, 0.0375, 0.0035, 6), [(0, -0.0003, glass), (0, 0.00003, glass), (0.0003, 0.00006, glass)], cap_lo=glass, cap_hi=glass, m=win)
    poly_on(win, rr(0.0310, 0.0260, 0.0006, 3), 0.00001, lcd, z=0.00006)
    line_on(win, rr(0.0366, 0.0330, 0.0025, 6), 0.00025, 0.00001, ink, z=0.00006, closed=True)
    ny = -0.0055
    # soft keys with call / hang-up handsets
    for sx in (-1, 1):
        km = F("front", (sx * 0.0183, ny, fz))
        slab(rr_shape(0.0118, 0.0068, 0.0028, 6), [(0, -0.0002, keys_m), (0, 0.0005, keys_m), (0.0006, 0.0008, keys_m), (0.0014, 0.00088, keys_m)], cap_lo=keys_m, cap_hi=keys_m, m=km, smooth=40)
        handset(km, dark, 0.00088, down=sx > 0)
    nm = F("front", (0, ny, fz))
    slab(lambda i: pill(0.0150 - 2 * i, 0.0094 - 2 * i, 12), [(0, -0.0002, keys_m), (0, 0.0005, keys_m), (0.0006, 0.0009, keys_m), (0.0016, 0.001, keys_m)], cap_lo=keys_m, cap_hi=keys_m, m=nm, smooth=40)
    poly_on(nm, circle(0.0015, 24), 0.00002, dark, z=0.001)
    for a in range(4):
        ang = a * math.pi / 2
        c = (math.cos(ang) * 0.0040 * (1.35 if a % 2 == 0 else 1.0), math.sin(ang) * 0.0030)
        tri = [(c[0] + math.cos(ang) * 0.0006, c[1] + math.sin(ang) * 0.0006), (c[0] + math.cos(ang + 2.1) * 0.0005, c[1] + math.sin(ang + 2.1) * 0.0005), (c[0] + math.cos(ang - 2.1) * 0.0005, c[1] + math.sin(ang - 2.1) * 0.0005)]
        poly_on(nm, tri, 0.000015, dark, z=0.00095)
    for k, (digit, lat, cyr) in enumerate(KEYS):
        col, row = k % 3, k // 3
        x, y = (col - 1) * 0.0178, -0.0168 - row * 0.0102
        km = F("front", (x, y, fz))
        slab(rr_shape(0.0158, 0.0082, 0.0026, 6), [(0, -0.0002, keys_m), (0, 0.0004, keys_m), (0.0005, 0.0007, keys_m), (0.0012, 0.00078, keys_m)], cap_lo=keys_m, cap_hi=keys_m, m=km, smooth=40)
        z = 0.00078
        if digit in "*#" or not cyr:
            text_on(km @ lib.at(0, 0, z), digit, 0.0046, dark, x=-0.0020 if lat else 0, depth=0.000015)
            if lat in ("+",):
                text_on(km @ lib.at(0, 0, z), lat, 0.0026, dark, x=0.0028, depth=0.000015)
            elif lat == "o_o":
                for cx in (0.0019, 0.0037):
                    line_on(km @ lib.at(cx, 0.0002, z), circle(0.00055, 12), 0.0002, 0.000015, dark, closed=True)
                line_on(km @ lib.at(0, 0, z), [(0.0019, -0.00035), (0.0037, -0.00035)], 0.0002, 0.000015, dark)
            elif lat == "␣":
                line_on(km @ lib.at(0, 0, z), [(0.0018, 0.0004), (0.0018, -0.0002), (0.0040, -0.0002), (0.0040, 0.0004)], 0.0002, 0.000015, dark)
            elif lat == "⇧":
                line_on(km @ lib.at(0, 0, z), [(0.0022, -0.0001), (0.0029, 0.0007), (0.0036, -0.0001), (0.0032, -0.0001), (0.0032, -0.0007), (0.0026, -0.0007), (0.0026, -0.0001)], 0.00018, 0.000015, dark, closed=True)
            continue
        text_on(km @ lib.at(0, 0, z), digit, 0.0046, dark, x=-0.0030, depth=0.000015)
        text_on(km @ lib.at(0, 0, z), lat, 0.00145, dark, x=0.0024, y=0.00095, depth=0.000015, bold=0.3)
        text_on(km @ lib.at(0, 0, z), cyr, 0.00145, dark, x=0.0024, y=-0.00095, depth=0.000015, bold=0.3)
    cuts += holes(fm, [(0, -0.0572)], 0.00045, 0.0008, dark, 10)

    # --- back: battery cover groove and latch, stamped SEVERIN, speaker holes, body screws
    # battery cover: a separate panel sitting flush in a shallow pocket, so a hairline groove rings it
    cov_y, cov_h = -0.0145, 0.0880
    cov_m = F("back", (0, cov_y, bz))
    cuts.append(pocket(lambda i: rr(0.0504, cov_h + 0.0004, 0.0062, 6), 0.0004, dark, cov_m))
    # the cover's lower layer; its top is the floor of the stamped letters
    slab(lambda i: rr(0.0498 - 2 * i, cov_h - 0.0002 - 2 * i, 0.0059 - i, 6), [(0, -0.0004, body_m), (0, -STAMP * 0.7, body_m)], cap_lo=body_m, cap_hi=body_m, m=cov_m)
    # the upper layer: one curve fill of the cover outline with SEVERIN as holes, so the
    # wordmark is stamped (debossed) into the plastic with clean walls and no booleans
    stamped_panel("SEVERIN", 0.0056, rr(0.0498, cov_h - 0.0002, 0.0059, 6), (0, cov_y - 0.010), body_m, F("back", (0, 0.010, bz)))
    cuts += holes(F("back", (0, 0.0445, bz)), [(x * 0.0015, k * 0.0015) for x in range(-3, 4) for k in (-1, 0, 1) if abs(x) + abs(k) < 4], 0.0004, 0.0007, dark, 8)
    cut(body, cuts)
    # latch ridges at the bottom of the cover
    for k in range(5):
        line_on(F("back", (0, -0.051 + k * 0.0011, bz)), [(-0.0045 + k * 0.0004, 0), (0.0045 - k * 0.0004, 0)], 0.00042, 0.00018, body_m)
    text_on(F("back", (0, -0.0555, bz)), "OPEN", 0.0013, body_m, depth=0.00005, spacing=1.2)
    for sx in (-1, 1):
        crosshead(F("back", (sx * 0.0175, 0.0525, bz)), keys_m, dark)
    text_on(F("back", (0, 0.0345, bz)), "S/N 3521 0470 9918 27", 0.0010, body_m, depth=0.00003)

    # --- bottom: charger socket with centre pin, microphone, lanyard eyelet on top
    bm = F("bottom", (0, -HH, 0))
    ends = holes(bm, [(0, 0)], 0.0011, 0.003, dark, 24)
    ends += holes(bm, [(0.008, 0)], 0.0004, 0.0008, dark, 10)
    ends += holes(F("top", (0.016, HH, 0)), [(-0.0012, 0), (0.0012, 0)], 0.0006, 0.0025, dark, 12)
    cut(body, ends)
    slab(circle_shape(0.00035, 12), [(0, -0.003, ink), (0, -0.0005, ink)], cap_lo=ink, cap_hi=ink, m=bm)
    # side volume rocker on -X
    slab(lambda i: pill(0.0120 - 2 * i, 0.0024 - 2 * i, 8), [(0, -0.0004, keys_m), (0, 0.0002, keys_m), (0.0003, 0.0004, keys_m)], cap_lo=keys_m, cap_hi=keys_m, m=F("nx", (-HW, 0.026, 0)))


def build(it: lib.Item) -> None:
    it.ao_size = 1024
    _n[0] = 0
    pid = it.id
    if "mangosteen" in pid:
        mangosteen(it, m4s="m4s" in pid)
    elif "galaxia" in pid:
        galaxia(it, nota="nota" in pid)
    elif "severin" in pid:
        severin(it)
    else:
        mangosteen(it, m4s=False)
