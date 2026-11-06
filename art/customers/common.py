"""Helpers for art/customers/build.py (scene work runs inside headless Blender).

The texture paint-out helpers (`paint`, `ring_median`) are plain numpy, so they
can also be tried outside Blender on a PIL image array.
"""

from __future__ import annotations

import math
import os
import shutil
import subprocess

import numpy as np

try:
    import bpy
    from mathutils import Matrix, Vector
except ImportError:  # paint helpers only
    bpy = None


# ---------------------------------------------------------------- scene ----

def activate(o):
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o


def apply_transforms(objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.context.view_layer.update()


def apply_all_modifiers(o):
    activate(o)
    for m in list(o.modifiers):
        try:
            bpy.ops.object.modifier_apply(modifier=m.name)
        except Exception as ex:  # disabled modifiers etc.
            print('modifier apply failed', o.name, m.name, ex)
            o.modifiers.remove(m)


def tri_count(objs):
    dg = bpy.context.evaluated_depsgraph_get()
    total = 0
    for o in objs:
        e = o.evaluated_get(dg)
        m = e.to_mesh()
        total += sum(len(p.vertices) - 2 for p in m.polygons)
        e.to_mesh_clear()
    return total


def world_bounds(objs):
    dg = bpy.context.evaluated_depsgraph_get()
    lo = np.full(3, np.inf)
    hi = np.full(3, -np.inf)
    for o in objs:
        e = o.evaluated_get(dg)
        m = e.to_mesh()
        co = np.empty(len(m.vertices) * 3)
        m.vertices.foreach_get('co', co)
        co = co.reshape(-1, 3)
        mw = np.array(e.matrix_world)
        co = co @ mw[:3, :3].T + mw[:3, 3]
        lo = np.minimum(lo, co.min(0))
        hi = np.maximum(hi, co.max(0))
        e.to_mesh_clear()
    return Vector(lo), Vector(hi)


# ------------------------------------------------------------- textures ----

def load_rgba(path):
    """Image file -> float32 array (h, w, 4), top row first, values 0..1 as stored."""
    img = bpy.data.images.load(path)
    w, h = img.size
    a = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(a)
    bpy.data.images.remove(img)
    return a.reshape(h, w, 4)[::-1].copy()


def save_image(arr, dst, max_px, fmt, quality=82):
    """Float array (h, w, 4), top row first -> resized JPEG or PNG file. Returns (w, h)."""
    h, w = arr.shape[:2]
    img = bpy.data.images.new('tmp_save', w, h, alpha=True)
    img.pixels.foreach_set(np.ascontiguousarray(arr[::-1]).ravel())
    s = min(1.0, max_px / max(w, h))
    nw, nh = max(1, round(w * s)), max(1, round(h * s))
    if (nw, nh) != (w, h):
        img.scale(nw, nh)
    sc = bpy.context.scene
    st = sc.render.image_settings
    st.quality = quality
    if fmt == 'JPEG':
        st.file_format = 'JPEG'
        st.color_mode = 'RGB'
    else:
        st.file_format = 'PNG'
        st.color_mode = 'RGBA'
        st.color_depth = '8'
        st.compression = 90
    img.save_render(dst, scene=sc)
    bpy.data.images.remove(img)
    return nw, nh


def png8_mask(path, cutoff):
    """Binary alpha (what glTF MASK shows anyway) + a 255-colour palette: a much
    smaller PNG with the same look under alpha test. Needs ImageMagick; without
    it the PNG stays 32-bit (bigger, same look)."""
    exe = shutil.which('magick') or shutil.which('convert')
    if not exe:
        print('[customers] ImageMagick not found: hair PNG left as RGBA')
        return path
    tmp = path + '.tmp.png'
    subprocess.run([exe, path, '-channel', 'A', '-threshold', '%d%%' % int(cutoff * 100), '+channel',
                    '-colors', '255', '-strip', '-define', 'png:exclude-chunk=date,time,text,ztxt,itxt,chrm,phys', 'PNG8:' + tmp],
                   check=True, env={**os.environ, 'MAGICK_THREAD_LIMIT': '1'})  # threaded quantising isn't reproducible
    os.replace(tmp, path)
    return path


def ring_median(arr, box, width=4):
    """Median colour of a `width`-pixel ring just outside box (x0, y0, x1, y1)."""
    x0, y0, x1, y1 = box
    h, w = arr.shape[:2]
    X0, Y0, X1, Y1 = max(0, x0 - width), max(0, y0 - width), min(w, x1 + width), min(h, y1 + width)
    m = np.zeros((h, w), bool)
    m[Y0:Y1, X0:X1] = True
    m[y0:y1, x0:x1] = False
    return np.median(arr[m], axis=0)


def _feather_mask(shape, box, feather):
    """1 inside box, ramping to 0 over `feather` pixels outside it."""
    h, w = shape
    x0, y0, x1, y1 = box
    ys = np.arange(h)[:, None] + 0.5
    xs = np.arange(w)[None, :] + 0.5
    dx = np.maximum(np.maximum(x0 - xs, xs - x1), 0)
    dy = np.maximum(np.maximum(y0 - ys, ys - y1), 0)
    d = np.sqrt(dx * dx + dy * dy)
    if feather <= 0:
        return (d == 0).astype(np.float32)
    return np.clip(1 - d / feather, 0, 1).astype(np.float32)


def _lum(a):
    return 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]


def _blur1d(a, r, axis):
    """Box blur of radius r along an axis (edge-padded)."""
    if r <= 0:
        return a
    pad = [(0, 0)] * a.ndim
    pad[axis] = (r + 1, r)
    c = np.cumsum(np.pad(a, pad, mode='edge'), axis=axis, dtype=np.float64)
    n = a.shape[axis]
    hi = np.take(c, np.arange(2 * r + 1, 2 * r + 1 + n), axis=axis)
    lo = np.take(c, np.arange(0, n), axis=axis)
    return ((hi - lo) / (2 * r + 1)).astype(np.float32)


def _blur(a, r):
    return _blur1d(_blur1d(a, r, 0), r, 1)


def _coons(arr, box, depth=4, smooth=6):
    """Smooth fill of box interpolated from the pixels just outside its four edges."""
    x0, y0, x1, y1 = box
    L = _blur1d(arr[y0:y1, x0 - depth:x0, :3].mean(1), smooth, 0)  # (h, 3)
    R = _blur1d(arr[y0:y1, x1:x1 + depth, :3].mean(1), smooth, 0)
    T = _blur1d(arr[y0 - depth:y0, x0:x1, :3].mean(0), smooth, 0)  # (w, 3)
    B = _blur1d(arr[y1:y1 + depth, x0:x1, :3].mean(0), smooth, 0)
    h, w = y1 - y0, x1 - x0
    u = ((np.arange(w) + 0.5) / w)[None, :, None]
    v = ((np.arange(h) + 0.5) / h)[:, None, None]
    TL, TR, BL, BR = (L[0] + T[0]) / 2, (R[0] + T[-1]) / 2, (L[-1] + B[0]) / 2, (R[-1] + B[-1]) / 2
    return ((1 - u) * L[:, None] + u * R[:, None] + (1 - v) * T[None] + v * B[None]
            - ((1 - u) * (1 - v) * TL + u * (1 - v) * TR + (1 - u) * v * BL + u * v * BR))


def paint(arr, op):
    """Paint one rectangle out of a texture, in place. arr: float (h, w, >=3), top row first,
    values 0..1. Coordinates are pixels of the ORIGINAL texture (as in an image editor).

    op = dict(box=(x0, y0, x1, y1), mode='fill' | 'clone' | 'heal' | 'grey', feather=px,
              sample=(x0, y0, x1, y1)  # fill: median colour of this area (default: a ring round box)
              color=(r, g, b)          # fill: explicit 0..255 colour instead
              dx=, dy=                 # clone: copy from box shifted by (dx, dy); heal: take only the
                                       # fine grain from there, shading from the box's surroundings
              lum=(lo, hi))            # only touch pixels whose 0..255 luminance is in [lo, hi];
                                       # fill colour then defaults to the box's other pixels
              side=((ax, ay), (bx, by))  # only touch pixels left of the line a->b
              level=, gain=, tint=(r, g, b), amount=,  # grey: recolour, not paint out (greying hair,
                                       # darkening a shirt): level + gain * luminance (0..1) times
                                       # tint (0..255, 255 = neutral), mixed over the original by
                                       # amount (1 = all of it)
              soft=(lo, hi))           # grey: full strength below 0..255 luminance lo, fading to
                                       # none at hi (hair into skin without a hard edge)
    """
    box = op['box']
    feather = op.get('feather', 3)
    x0, y0, x1, y1 = box
    h, w = arr.shape[:2]
    f = int(math.ceil(feather))
    X0, Y0, X1, Y1 = max(0, x0 - f), max(0, y0 - f), min(w, x1 + f), min(h, y1 + f)
    sub = arr[Y0:Y1, X0:X1, :3]
    m = _feather_mask(arr.shape[:2], box, feather)[Y0:Y1, X0:X1]
    if op.get('lum'):
        lo, hi = op['lum']
        L = _lum(sub) * 255
        m = m * ((L >= lo) & (L <= hi))
    if op.get('side'):  # keep to the left of the line a->b (image coords, y down)
        (ax, ay), (bx, by) = op['side']
        ys = np.arange(Y0, Y1)[:, None] + 0.5
        xs = np.arange(X0, X1)[None, :] + 0.5
        m = m * (((bx - ax) * (ys - ay) - (by - ay) * (xs - ax)) > 0)
    mode = op.get('mode', 'fill')
    if mode == 'clone':
        dx, dy = op['dx'], op['dy']
        src = arr[Y0 + dy:Y1 + dy, X0 + dx:X1 + dx, :3].copy()
        assert src.shape == sub.shape, ('clone source out of the texture', op)
    elif mode == 'heal':  # shading from the box's surroundings, cloth grain from (dx, dy)
        dx, dy = op['dx'], op['dy']
        r = op.get('grain', 12)
        grain = arr[Y0 + dy - r:Y1 + dy + r, X0 + dx - r:X1 + dx + r, :3]
        assert grain.shape[:2] == (Y1 - Y0 + 2 * r, X1 - X0 + 2 * r), ('heal source out of the texture', op)
        detail = (grain - _blur(grain, r))[r:-r, r:-r]
        src = np.clip(_coons(arr, (X0, Y0, X1, Y1)) + detail, 0, 1)
    elif mode == 'grey':
        L = _lum(sub)
        if op.get('soft'):
            lo, hi = op['soft']
            m = m * np.clip((hi / 255 - L) / ((hi - lo) / 255), 0, 1)
        g = op.get('level', 0.3) + op.get('gain', 1.0) * L
        tint = np.array(op.get('tint', (255, 255, 255)), np.float32) / 255
        a = op.get('amount', 1.0)
        src = np.clip(sub * (1 - a) + g[..., None] * tint * a, 0, 1)
    else:
        if 'color' in op:
            c = np.array(op['color'], np.float32) / 255
        elif 'sample' in op:
            sx0, sy0, sx1, sy1 = op['sample']
            c = np.median(arr[sy0:sy1, sx0:sx1, :3].reshape(-1, 3), axis=0)
        elif op.get('lum'):  # the pixels left alone inside the box are the background
            Lb = _lum(arr[y0:y1, x0:x1, :3]) * 255
            out = (Lb < lo) | (Lb > hi)
            c = np.median(arr[y0:y1, x0:x1, :3][out], axis=0)
        else:
            c = ring_median(arr[..., :3], box, width=max(3, f + 2))
        src = np.broadcast_to(c, sub.shape)
    sub[:] = sub * (1 - m[..., None]) + src * m[..., None]
    return arr


# ------------------------------------------------------------ materials ----

def simple_material(name, base_path, alpha=None, rough=0.75, cull=True, cutoff=0.5):
    """Principled material the glTF exporter maps 1:1. alpha: None | 'MASK'."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Specular IOR Level'].default_value = 0.35
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = bpy.data.images.load(base_path)
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    if alpha == 'MASK':
        gt = nt.nodes.new('ShaderNodeMath')
        gt.operation = 'GREATER_THAN'
        gt.inputs[1].default_value = cutoff
        nt.links.new(tex.outputs['Alpha'], gt.inputs[0])
        nt.links.new(gt.outputs[0], bsdf.inputs['Alpha'])
        mat.blend_method = 'CLIP'
        if hasattr(mat, 'surface_render_method'):
            mat.surface_render_method = 'DITHERED'
    mat.use_backface_culling = cull
    return mat


# --------------------------------------------------------------- export ----

def export_glb(path, objs, draco=False):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    kw = dict(filepath=path, export_format='GLB', use_selection=True, export_yup=True,
              export_skins=True, export_animations=True, export_image_format='AUTO',
              export_apply=False, export_morph=False, export_texcoords=True, export_normals=True,
              export_tangents=False, export_materials='EXPORT', export_cameras=False, export_lights=False,
              export_animation_mode='ACTIONS', export_force_sampling=True, export_frame_step=1,
              export_optimize_animation_size=True, export_optimize_animation_keep_anim_armature=False,
              export_def_bones=True,
              export_anim_slide_to_zero=True)
    if draco:
        kw.update(export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6)
    bpy.ops.export_scene.gltf(**kw)


# --------------------------------------------------------------- render ----

def render_customer(out_png, samples=32, eye=1.6, dist=1.5, target_z=None, res=(600, 900), lens=37.0):
    """Character faces Blender -Y with feet at z=0; camera at (0, -dist, eye). Warm key, cool fill."""
    sc = bpy.context.scene
    for o in list(sc.objects):
        if o.type in ('CAMERA', 'LIGHT'):
            bpy.data.objects.remove(o)
    cam_loc = Vector((0.0, -dist, eye))
    target = Vector((0.0, 0.0, eye - 0.22 if target_z is None else target_z))
    cd = bpy.data.cameras.new('cam')
    cd.sensor_fit = 'VERTICAL'
    cd.sensor_height = 24.0
    cd.lens = lens
    co = bpy.data.objects.new('cam', cd)
    sc.collection.objects.link(co)
    co.location = cam_loc
    co.rotation_euler = (target - cam_loc).to_track_quat('-Z', 'Y').to_euler()
    sc.camera = co

    def area(name, loc, energy, size, kelvin=None, rgb=None):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy = energy
        ld.size = size
        if kelvin:
            ld.use_nodes = True
            nt = ld.node_tree
            bb = nt.nodes.new('ShaderNodeBlackbody')
            bb.inputs['Temperature'].default_value = kelvin
            nt.links.new(bb.outputs['Color'], nt.nodes['Emission'].inputs['Color'])
        if rgb:
            ld.color = rgb
        lo = bpy.data.objects.new(name, ld)
        sc.collection.objects.link(lo)
        lo.location = loc
        lo.rotation_euler = (Vector((0, 0, 1.35)) - loc).to_track_quat('-Z', 'Y').to_euler()

    area('key', Vector((1.3, -0.9, 2.0)), 120.0, 0.6, kelvin=2700)
    area('fill', Vector((-1.6, -1.4, 1.5)), 35.0, 2.0, rgb=(0.85, 0.9, 1.0))
    w = bpy.data.worlds.new('w')
    w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = (0.05, 0.045, 0.04, 1)
    sc.world = w
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = samples
    sc.cycles.device = 'CPU'
    sc.cycles.use_denoising = True
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGB'
    sc.view_settings.view_transform = 'AgX'
    sc.render.filepath = out_png
    bpy.ops.render.render(write_still=True)
