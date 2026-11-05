"""
Geometry helpers for the canal backdrop. Authors work in three.js coordinates
(metres, y up, x across the shop, z from the shop towards the far bank); the
conversion to Blender (z up) happens here, once.

Everything is accumulated into one bmesh per material, so the scene is a few
dozen objects however many railing bars and window frames there are.
"""

from __future__ import annotations

import math
from typing import Iterable, Sequence

import bmesh
import bpy
from mathutils import Matrix, Vector

# three.js (x, y, z) -> Blender (x, -z, y)
T = Matrix(((1, 0, 0), (0, 0, -1), (0, 1, 0)))

Vec3 = tuple[float, float, float]


def to_blender(p: Sequence[float]) -> Vector:
    return Vector((p[0], -p[2], p[1]))


def rot_y(a: float) -> Matrix:
    """Rotation about three.js +y (up)."""
    c, s = math.cos(a), math.sin(a)
    return Matrix(((c, 0, s), (0, 1, 0), (-s, 0, c)))


def rot_z(a: float) -> Matrix:
    """Rotation about three.js +z (towards the far bank)."""
    c, s = math.cos(a), math.sin(a)
    return Matrix(((c, -s, 0), (s, c, 0), (0, 0, 1)))


def rot_x(a: float) -> Matrix:
    c, s = math.cos(a), math.sin(a)
    return Matrix(((1, 0, 0), (0, c, -s), (0, s, c)))


IDENTITY = Matrix.Identity(3)

_BOX_FACES = ((0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3))


class Geo:
    """One bmesh per material name; `finish()` turns them into objects."""

    def __init__(self) -> None:
        self.bms: dict[str, bmesh.types.BMesh] = {}

    def bm(self, mat: str) -> bmesh.types.BMesh:
        if mat not in self.bms:
            self.bms[mat] = bmesh.new()
        return self.bms[mat]

    # --- primitives (three.js coordinates) -----------------------------------

    def box(self, mat: str, c: Vec3, s: Vec3, m: Matrix = IDENTITY) -> None:
        """Axis-aligned box of size s centred at c, optionally rotated by m (three.js frame)."""
        bm = self.bm(mat)
        hx, hy, hz = s[0] / 2, s[1] / 2, s[2] / 2
        cv = Vector(c)
        verts = []
        for dx in (-hx, hx):
            for dy in (-hy, hy):
                for dz in (-hz, hz):
                    p = cv + m @ Vector((dx, dy, dz))
                    verts.append(bm.verts.new(to_blender(p)))
        for f in _BOX_FACES:
            bm.faces.new([verts[i] for i in f])

    def span(self, mat: str, x0: float, x1: float, y0: float, y1: float, z0: float, z1: float) -> None:
        """Box from min/max corners (three.js)."""
        if x1 - x0 <= 1e-5 or y1 - y0 <= 1e-5 or z1 - z0 <= 1e-5:
            return
        self.box(mat, ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), (x1 - x0, y1 - y0, z1 - z0))

    def quad(self, mat: str, pts: Sequence[Vec3]) -> None:
        bm = self.bm(mat)
        bm.faces.new([bm.verts.new(to_blender(p)) for p in pts])

    def prism_x(self, mat: str, poly_zy: Sequence[tuple[float, float]], x0: float, x1: float) -> None:
        """Extrude a simple polygon given in the (z, y) plane along x from x0 to x1."""
        bm = self.bm(mat)
        a = [bm.verts.new(to_blender((x0, y, z))) for z, y in poly_zy]
        b = [bm.verts.new(to_blender((x1, y, z))) for z, y in poly_zy]
        bm.faces.new(a)
        bm.faces.new(list(reversed(b)))
        n = len(poly_zy)
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((a[i], a[j], b[j], b[i]))

    def prism_y(self, mat: str, poly_xz: Sequence[tuple[float, float]], y0: float, y1: float) -> None:
        """Extrude a simple polygon given in the (x, z) plane along y (up) from y0 to y1."""
        bm = self.bm(mat)
        a = [bm.verts.new(to_blender((x, y0, z))) for x, z in poly_xz]
        b = [bm.verts.new(to_blender((x, y1, z))) for x, z in poly_xz]
        bm.faces.new(a)
        bm.faces.new(list(reversed(b)))
        n = len(poly_xz)
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((a[i], a[j], b[j], b[i]))

    def cylinder(self, mat: str, c: Vec3, r: float, h: float, seg: int = 10, r_top: float | None = None, cap: bool = True) -> None:
        """Vertical (three.js y) cylinder or cone frustum; c is the bottom centre."""
        bm = self.bm(mat)
        rt = r if r_top is None else r_top
        bot, top = [], []
        for i in range(seg):
            a = 2 * math.pi * i / seg
            bot.append(bm.verts.new(to_blender((c[0] + r * math.cos(a), c[1], c[2] + r * math.sin(a)))))
            top.append(bm.verts.new(to_blender((c[0] + rt * math.cos(a), c[1] + h, c[2] + rt * math.sin(a)))))
        for i in range(seg):
            j = (i + 1) % seg
            bm.faces.new((bot[i], bot[j], top[j], top[i]))
        if cap:
            bm.faces.new(list(reversed(bot)))
            if rt > 1e-4:
                bm.faces.new(top)

    def lathe(self, mat: str, c: Vec3, profile: Sequence[tuple[float, float]], seg: int = 12) -> None:
        """Surface of revolution about a vertical axis at c; profile is (radius, height) bottom to top."""
        bm = self.bm(mat)
        rings = []
        for r, h in profile:
            ring = []
            for i in range(seg):
                a = 2 * math.pi * i / seg
                ring.append(bm.verts.new(to_blender((c[0] + r * math.cos(a), c[1] + h, c[2] + r * math.sin(a)))))
            rings.append(ring)
        for k in range(len(rings) - 1):
            for i in range(seg):
                j = (i + 1) % seg
                bm.faces.new((rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]))
        if profile[0][0] > 1e-4:
            bm.faces.new(list(reversed(rings[0])))
        if profile[-1][0] > 1e-4:
            bm.faces.new(rings[-1])

    def ring_xy(self, mat: str, c: Vec3, radius: float, thick: float, seg: int = 10) -> None:
        """A ring in a plane facing z (railing roundels), square section."""
        bm = self.bm(mat)
        ri, ro = radius - thick / 2, radius + thick / 2
        hz = thick / 2
        rows = []
        for i in range(seg):
            a = 2 * math.pi * i / seg
            ca, sa = math.cos(a), math.sin(a)
            rows.append(
                [
                    bm.verts.new(to_blender((c[0] + rr * ca, c[1] + rr * sa, c[2] + dz)))
                    for rr, dz in ((ri, -hz), (ro, -hz), (ro, hz), (ri, hz))
                ]
            )
        for i in range(seg):
            j = (i + 1) % seg
            for k in range(4):
                l = (k + 1) % 4
                bm.faces.new((rows[i][k], rows[j][k], rows[j][l], rows[i][l]))

    def ribbon_x(self, mat: str, curve_zy: Sequence[tuple[float, float]], width_dir: Sequence[tuple[float, float]], x0: float, x1: float) -> None:
        """A strip between curve_zy and curve_zy + width_dir (per point), extruded along x."""
        inner = list(curve_zy)
        outer = [(z + dz, y + dy) for (z, y), (dz, dy) in zip(curve_zy, width_dir)]
        for i in range(len(inner) - 1):
            poly = [inner[i], inner[i + 1], outer[i + 1], outer[i]]
            self.prism_x(mat, poly, x0, x1)

    def mesh(self, mat: str, verts: Iterable[Vec3], faces: Iterable[Sequence[int]]) -> None:
        bm = self.bm(mat)
        vs = [bm.verts.new(to_blender(v)) for v in verts]
        for f in faces:
            bm.faces.new([vs[i] for i in f])

    # --- output ----------------------------------------------------------------

    def finish(self, materials: dict[str, bpy.types.Material]) -> list[bpy.types.Object]:
        objs = []
        for name, bm in self.bms.items():
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
            me = bpy.data.meshes.new(name)
            bm.to_mesh(me)
            bm.free()
            me.materials.append(materials[name])
            ob = bpy.data.objects.new(name, me)
            bpy.context.scene.collection.objects.link(ob)
            objs.append(ob)
        self.bms.clear()
        return objs


def text_mesh(geo: Geo, mat: str, body: str, origin: Vec3, size: float, font: bpy.types.VectorFont, depth: float = 0.02, align: str = "CENTER", max_width: float | None = None) -> float:
    """
    Text lying on a facade that faces the shop (three.js -z), reading left to
    right as seen from the shop, centred on origin (x, y = middle of the line).
    Returns the text width in metres.
    """
    cu = bpy.data.curves.new("txt", "FONT")
    cu.body = body
    cu.font = font
    cu.size = size
    cu.align_x = align
    cu.align_y = "CENTER"
    cu.extrude = depth / 2
    ob = bpy.data.objects.new("txt", cu)
    bpy.context.scene.collection.objects.link(ob)
    dg = bpy.context.evaluated_depsgraph_get()
    me = ob.evaluated_get(dg).to_mesh()
    xs = [v.co.x for v in me.vertices]
    width = (max(xs) - min(xs)) if xs else 0.0
    k = 1.0
    if max_width and width > max_width:
        k = max_width / width
    # local text X -> three -x (reads left to right from the shop), local Y -> three +y,
    # local Z (front) -> three -z (towards the shop)
    verts = [(origin[0] - v.co.x * k, origin[1] + v.co.y * k, origin[2] - v.co.z) for v in me.vertices]
    faces = [tuple(p.vertices) for p in me.polygons]
    geo.mesh(mat, verts, faces)
    ob.evaluated_get(dg).to_mesh_clear()
    bpy.data.objects.remove(ob)
    bpy.data.curves.remove(cu)
    return width * k
