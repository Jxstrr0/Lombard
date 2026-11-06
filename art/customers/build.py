"""
The customer cast (docs/04-ASSETS.md § Customers). Nobody opens the Blender UI.

    blender -b --factory-startup --python art/customers/build.py -- --rocketbox <dir> [--only id,id] [--preview]

For every cast member in src/data/customers/cast.json (id, source = avatar
folder in the Microsoft Rocketbox repo, gender m/f) this writes
public/assets/customers/<id>.glb: the avatar facing glTF +Z (Blender -Y; the
game turns it by pi), feet on the floor, pelvis over the origin, two looping
clips, `idle` then `walk` (in place, walking towards +Z), three materials
(body, head, hair or hat), normal maps dropped. It also writes the walk's
ground speed into cast.json as `walkSpeed` (m/s; move the customer at that
speed and the planted foot stays put). art/out/customers/<id>.json gets the
stats; --preview also renders <id>_waist.png (phone framing, 1.5 m),
<id>_full.png and two walk frames, <id>_walk_a.png and <id>_walk_b.png.

Sources (MIT, see ATTRIBUTION.md) are never committed. Point --rocketbox at
either a checkout of https://github.com/microsoft/Microsoft-Rocketbox or, much
smaller (the full repo is many GB), a blob-less clone:

    git clone --filter=blob:none --no-checkout https://github.com/microsoft/Microsoft-Rocketbox <dir>

Files missing from <dir> are read with `git show ROCKETBOX_COMMIT:<path>` (git
fetches just those blobs) into --cache. Per avatar that is
<source>/Export/<Name>.fbx (not the _facial one) and
<source>/Textures/<material>_color.tga for each material slot (see
TEXTURE_NAME for the exception); plus the idle
m_idle_breathe_01 (men) or f_idle_breathe_01 (women) from
Assets/Animations/all_animations_max_motextr_static/ and the walk
m_walk_neutral_01 or f_walk_neutral_01 from
Assets/Animations/all_animations_max_motextr_xy/ (the static set has no walks).

The idle is retargeted by copying world rotations bone for bone (avatars and
clips share the 3ds Max Biped names), baked, blended over its last frames into
the first so it loops, and its first frame is made the rest pose. The walk is
one stride (1.2 s) retargeted the same way (the clip's rig scaled by leg
length; every Rocketbox avatar has the clip rig's legs, so the scale is 1 and
the speed is one per gender), then the stride's straight-line travel is taken
off every bone so it walks in place (the hips keep their fore-aft surge), the
small leftover seam is spread over the cycle so the last frame equals the
first, and it is moved up or down so the soles meet the idle's floor (median
lowest vertex per frame). Channels that never leave the rest pose are not
keyed, so the glb leaves them out. Textures:
head JPEG 1024, body JPEG BODY_PX, hair (alpha) PNG8 at HAIR_PX alpha-tested
(MASK). PAINT_OUT blanks text, logos and real insignia per avatar before the
resize (rectangles in source texture pixels, top-left origin). Needs
ImageMagick (`convert`) for the PNG8 step; without it hair stays RGBA PNG.
Output is byte-for-byte reproducible. Geometry is Draco-compressed (about a
third smaller; the game's shared loader in src/render/loaders.ts decodes it);
--no-draco skips that for debugging.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import struct
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))
import common  # noqa: E402

try:
    import bpy
    from mathutils import Matrix, Quaternion, Vector
except ImportError:  # PAINT_OUT can be imported without Blender
    bpy = None

ROCKETBOX_COMMIT = '0943055db6ec570bcef9f2c8b41c9e5467c808f9'
ANIM_DIR = 'Assets/Animations/all_animations_max_motextr_static'
IDLE = {'m': 'm_idle_breathe_01', 'f': 'f_idle_breathe_01'}
FPS = 30
LOOP_BLEND = 12  # frames at the end of the idle blended into its first frame
# The walk: no walks in the static set, so it comes from the XY-root-motion set (one stride,
# hips travelling) and build.py takes the travel off. m_walk_neutral_01 / f_walk_neutral_01.
WALK_DIR = 'Assets/Animations/all_animations_max_motextr_xy'
WALK = {'m': 'm_walk_neutral_01', 'f': 'f_walk_neutral_01'}
WALK_PLANTED = 0.01  # m: an ankle within this of its lowest counts as planted (slide check)
REST_EPS = 1e-4  # a bone channel within this of the rest pose (m, quaternion xyz) for a whole clip is not keyed

# Triangle budget per customer (docs/04-ASSETS.md § Customers).
MAX_TRIS = 15_000
# Texture sizes (long side, px). Two customers are resident at once, so these
# come out of the scene's 60 MB decoded-texture budget: 1024 + 768 + 512 is
# about 9.7 MB per customer with mipmaps. Body 1024 and hair 1024 were tried and
# look the same at the counter (waist-up, 1.5 m, phone).
HEAD_PX = 1024
BODY_PX = 768
HAIR_PX = 512
HAT_PX = 1024
JPEG_QUALITY = 82
HAIR_CUTOFF = 0.3
# Per-avatar texture sizes that differ from the above.
TEX_PX: dict[str, dict[str, int]] = {}

# Material slot suffix -> how it ships. 'glasses' (alpha-tested frames, lenses
# fully cut) is packed under the hair texture so the avatar keeps 3 materials.
KINDS = {
    'body': dict(out='body', rough=0.8),
    'head': dict(out='head', rough=0.6),
    'hat': dict(out='hat', rough=0.7),
    'opacity': dict(out='hair', rough=0.7, mask=True),
    'glasses': dict(out='hair', rough=0.7, mask=True),
}

# Texture file per slot kind when it isn't <slot>_color.tga.
TEXTURE_NAME = {'glasses': '{slot}_opacity_color.tga'}

# Text, logos and real insignia painted out of the source textures (2048 px
# sources; see common.paint for the op format). Back pockets carry a stitched
# "R" monogram; shoes and labels carry the library's "fashion by Rocketbox"
# and made-up shoe brands; the navy cap badge has a crown over the anchor.
_DENIM = dict(mode='clone', feather=4)
PAINT_OUT: dict[str, dict[str, list[dict]]] = {
    'pilot_male_03': {'head': [
        dict(box=(313, 1275, 407, 1343), sample=(282, 1290, 306, 1320), feather=2),  # crown on the cap badge
    ]},
    'pilot_female_02': {'hat': [
        dict(box=(165, 138, 258, 204), sample=(122, 170, 148, 200), feather=2),  # crown on the cap badge
    ]},
    'male_adult_16': {'body': [
        dict(box=(876, 1084, 1186, 1504), dx=0, dy=-700, mode='heal', feather=6),  # t-shirt print (reads as a monogram)
        dict(box=(1004, 862, 1036, 894), dx=0, dy=-120, mode='heal', feather=3),  # its mark on the back collar
        dict(box=(142, 132, 237, 217), dx=0, dy=128, **_DENIM),  # pocket monogram, left
        dict(box=(1820, 150, 1932, 222), dx=0, dy=112, **_DENIM),  # pocket monogram, right
        dict(box=(518, 1598, 594, 1648), color=(222, 213, 203), lum=(85, 212), feather=1),  # sole brand
        dict(box=(1456, 1596, 1527, 1650), color=(222, 213, 203), lum=(85, 212), feather=1),
        dict(box=(660, 1840, 707, 1905), lum=(50, 255), side=((680, 1836), (707, 1908)), feather=1),  # shoe side brand + logo
        dict(box=(1340, 1846, 1386, 1912), lum=(50, 255), side=((1340, 1888), (1367, 1840)), feather=1),
    ]},
    'male_adult_18': {'body': [
        dict(box=(176, 80, 231, 104), sample=(152, 60, 175, 78), feather=2),  # belt label
        dict(box=(533, 1621, 570, 1645), color=(215, 221, 191), lum=(90, 212), feather=1),  # sole "ASD"
        dict(box=(1478, 1620, 1515, 1645), color=(215, 221, 191), lum=(90, 212), feather=1),
        dict(box=(568, 2002, 624, 2024), feather=2),  # heel labels
        dict(box=(1424, 2002, 1481, 2024), feather=2),
    ]},
    'female_adult_17': {'body': [
        dict(box=(1180, 1568, 1248, 1596), dx=0, dy=-40, mode='clone', feather=4),  # "fashion by Rocketbox"
    ]},
    'business_male_07': {'body': [
        dict(box=(148, 155, 250, 218), dx=0, dy=115, **_DENIM),  # pocket monogram, left
        dict(box=(1872, 148, 1962, 218), dx=0, dy=125, **_DENIM),  # pocket monogram, right
    ]},
}


def log(msg: str) -> None:
    print(f'[customers] {msg}', flush=True)


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument('--rocketbox', default=os.environ.get('ROCKETBOX', str(ROOT / 'art' / 'out' / 'customers' / 'rocketbox')),
                   help='Microsoft-Rocketbox checkout or blob-less clone')
    p.add_argument('--cache', default=str(ROOT / 'art' / 'out' / 'customers' / 'src'), help='where fetched sources go')
    p.add_argument('--work', default=str(ROOT / 'art' / 'out' / 'customers'), help='stats, textures, previews')
    p.add_argument('--out', default=str(ROOT / 'public' / 'assets' / 'customers'))
    p.add_argument('--cast', default=str(ROOT / 'src' / 'data' / 'customers' / 'cast.json'))
    p.add_argument('--only', default='', help='comma-separated cast ids')
    p.add_argument('--preview', action='store_true', help='also render <id>_waist.png and <id>_full.png')
    p.add_argument('--body-px', type=int, help='override BODY_PX (and TEX_PX) for every avatar, for comparisons')
    p.add_argument('--hair-px', type=int, help='override HAIR_PX (and TEX_PX) for every avatar, for comparisons')
    p.add_argument('--no-draco', dest='draco', action='store_false', help='skip Draco compression (the game loads Draco glbs; this is for debugging)')
    return p.parse_args(argv)


# ---------------------------------------------------------------- sources ----

def source_file(args, path: str) -> str:
    """Path inside the Rocketbox repo -> local file (from the checkout, else git show)."""
    local = Path(args.rocketbox) / path
    if local.is_file() and local.stat().st_size > 0:
        return str(local)
    cached = Path(args.cache) / path
    if cached.is_file() and cached.stat().st_size > 0:
        return str(cached)
    cached.parent.mkdir(parents=True, exist_ok=True)
    for attempt in range(5):  # blob fetches occasionally come back empty
        with open(cached, 'wb') as fh:
            r = subprocess.run(['git', '-C', args.rocketbox, 'show', f'{ROCKETBOX_COMMIT}:{path}'], stdout=fh)
        if r.returncode == 0 and cached.stat().st_size > 0:
            return str(cached)
        time.sleep(1 + attempt)
    cached.unlink(missing_ok=True)
    raise FileNotFoundError(f'{path}: not in {args.rocketbox} and git show failed')


# ------------------------------------------------------------------ build ----

def bone_head(arm, name):
    return arm.matrix_world @ arm.data.bones[name].head_local


def facing(arm):
    """Horizontal direction from the heels to the toes."""
    toes = (bone_head(arm, 'Bip01 L Toe0') + bone_head(arm, 'Bip01 R Toe0')) / 2
    feet = (bone_head(arm, 'Bip01 L Foot') + bone_head(arm, 'Bip01 R Foot')) / 2
    f = toes - feet
    f.z = 0
    return f.normalized()


def set_pose_from(arm, recf):
    """Pose bones so their armature-space matrices equal recf (parents first)."""
    for pb in arm.pose.bones:
        b = pb.bone
        if b.parent:
            rest_rel = b.parent.matrix_local.inverted() @ b.matrix_local
            pb.matrix_basis = rest_rel.inverted() @ recf[b.parent.name].inverted() @ recf[pb.name]
        else:
            pb.matrix_basis = b.matrix_local.inverted() @ recf[pb.name]


def leg_length(arm, bones) -> float:
    """Hip to ankle along the left leg, in world metres, from the rest pose."""
    mw = arm.matrix_world
    th, ca, ft = (mw @ bones[n].head_local for n in ('Bip01 L Thigh', 'Bip01 L Calf', 'Bip01 L Foot'))
    return (ca - th).length + (ft - ca).length


def bake_clip(args, arm, face_rot, path: str, label: str, stats: dict, scale: float = 1.0):
    """Retarget a Rocketbox clip onto arm: world rotations bone for bone, the pelvis's world
    location too (the clip's rig scaled by `scale` about the floor first, lined up pelvis on
    pelvis at its first frame). Returns (baked action, frames, {frame: {bone: armature-space
    matrix}}); the baked action stays assigned to arm."""
    sc = bpy.context.scene
    before = set(sc.objects)
    acts_before = set(bpy.data.actions)
    bpy.ops.import_scene.fbx(filepath=source_file(args, path))
    new = [o for o in sc.objects if o not in before]
    src = [o for o in new if o.type == 'ARMATURE'][0]
    act = src.animation_data.action
    f0, f1 = int(act.frame_range[0]), int(act.frame_range[1])
    src.matrix_world = face_rot @ src.matrix_world
    if scale != 1.0:
        src.matrix_world = Matrix.Scale(scale, 4) @ src.matrix_world
    sc.frame_set(f0)
    bpy.context.view_layer.update()
    sp = src.matrix_world @ src.pose.bones['Bip01 Pelvis'].head
    ap = arm.matrix_world @ arm.data.bones['Bip01 Pelvis'].head_local
    src.matrix_world = Matrix.Translation(ap - sp) @ src.matrix_world
    bpy.context.view_layer.update()

    common.activate(arm)
    bpy.ops.object.mode_set(mode='POSE')
    shared = [pb for pb in arm.pose.bones if pb.name in src.pose.bones]
    missing = [pb.name for pb in arm.pose.bones if pb.name not in src.pose.bones]
    if missing:
        stats['problems'].append(f'bones not in the {label} clip: {missing}')
    for pb in shared:
        c = pb.constraints.new('COPY_ROTATION')
        c.target, c.subtarget = src, pb.name
        c.target_space = c.owner_space = 'WORLD'
        if pb.name == 'Bip01 Pelvis':
            c2 = pb.constraints.new('COPY_LOCATION')
            c2.target, c2.subtarget = src, pb.name
            c2.target_space = c2.owner_space = 'WORLD'
    for pb in arm.pose.bones:
        pb.bone.select = True
    bpy.ops.nla.bake(frame_start=f0, frame_end=f1, only_selected=False, visual_keying=True,
                     clear_constraints=True, use_current_action=False, bake_types={'POSE'})
    bpy.ops.object.mode_set(mode='OBJECT')
    baked = arm.animation_data.action
    for o in new:
        bpy.data.objects.remove(o)
    for a in list(bpy.data.actions):
        if a != baked and a not in acts_before:
            bpy.data.actions.remove(a)

    # armature-space pose per frame
    frames = list(range(f0, f1 + 1))
    rec = {}
    for f in frames:
        sc.frame_set(f)
        rec[f] = {pb.name: pb.matrix.copy() for pb in arm.pose.bones}
    return baked, frames, rec


def make_walk(args, arm, face_rot, gender: str, stats: dict):
    """The walk, in place. The clip (root motion on the XY plane, one full stride, last frame
    = first frame one stride further on) is scaled by the avatar's leg length over the clip
    rig's so the planted foot stays planted at the avatar's own pace, retargeted like the
    idle, then the stride's average ground speed is taken off every bone (the hips keep their
    small fore-aft surge) and what is left of the seam is spread over the cycle. Returns
    (frames, rec) with rec[last] == rec[first]; stats get walk_speed in m/s."""
    path = f'{WALK_DIR}/{WALK[gender]}.max.fbx'
    sc = bpy.context.scene
    # leg length of the clip's rig, from its rest pose (import it once just to measure)
    before = set(sc.objects)
    acts_before = set(bpy.data.actions)
    bpy.ops.import_scene.fbx(filepath=source_file(args, path))
    new = [o for o in sc.objects if o not in before]
    src = [o for o in new if o.type == 'ARMATURE'][0]
    src_leg = leg_length(src, src.data.bones)
    for o in new:
        bpy.data.objects.remove(o)
    for a in list(bpy.data.actions):
        if a not in acts_before:
            bpy.data.actions.remove(a)
    leg = leg_length(arm, arm.data.bones)
    scale = leg / src_leg
    stats['walk_leg_m'] = [round(leg, 4), round(src_leg, 4)]
    stats['walk_scale'] = round(scale, 4)

    act, frames, rec = bake_clip(args, arm, face_rot, path, 'walk', stats, scale=scale)
    arm.animation_data.action = None
    bpy.data.actions.remove(act)
    w0, w1 = frames[0], frames[-1]
    n = w1 - w0

    # planted-foot check before the travel comes off: how far a foot drifts in one footfall
    # (a run of frames with the ankle down; the clip's ends are two footfalls a stride apart)
    slide = 0.0
    for foot in ('Bip01 L Foot', 'Bip01 R Foot'):
        ps = [rec[f][foot].to_translation() for f in frames]
        low = min(p.z for p in ps)
        run = []
        for p in ps + [None]:
            if p is not None and p.z < low + WALK_PLANTED:
                run.append(p)
                continue
            if run:
                slide = max(slide, max((a - b).xy.length for a in run for b in run))
            run = []
    stats['walk_planted_slide_m'] = round(slide, 4)

    # take the stride's travel off (straight line, first frame to last)
    travel = rec[w1]['Bip01 Pelvis'].to_translation() - rec[w0]['Bip01 Pelvis'].to_translation()
    travel.z = 0
    stats['walk_dir'] = [round(v, 3) for v in travel.normalized()]
    speed = travel.length / (n / FPS)
    stats['walk_speed'] = round(speed, 3)
    stats['walk_stride_m'] = round(travel.length, 3)
    for f in frames:
        T = Matrix.Translation(-travel * ((f - w0) / n))
        for b in rec[f]:
            rec[f][b] = T @ rec[f][b]

    # spread the remaining seam (last frame vs first) over the cycle, on each bone's pose
    # relative to its parent so bone lengths stay put
    seam_m = max((rec[w0][b].to_translation() - rec[w1][b].to_translation()).length for b in rec[w0])
    seam_r = max(rec[w0][b].to_quaternion().rotation_difference(rec[w1][b].to_quaternion()).angle for b in rec[w0])
    stats['walk_seam_before'] = {'m': round(seam_m, 4), 'deg': round(math.degrees(seam_r), 2)}
    bones = sorted(arm.data.bones, key=lambda b: len(b.parent_recursive))  # parents first
    parent = {b.name: b.parent.name if b.parent else None for b in bones}

    def local(pose):
        return {b: pose[p].inverted() @ pose[b] if p else pose[b].copy() for b, p in parent.items()}

    first, end = local(rec[w0]), local(rec[w1])
    err = {}
    for b in parent:
        dq = end[b].to_quaternion() @ first[b].to_quaternion().inverted()
        if dq.w < 0:  # the short way round
            dq.negate()
        err[b] = (end[b].to_translation() - first[b].to_translation(), dq)
    for f in frames[1:-1]:
        t = (f - w0) / n
        loc = local(rec[f])
        pose = {}
        for b in (b.name for b in bones):
            dt, dq = err[b]
            q = Quaternion().slerp(dq, t).inverted() @ loc[b].to_quaternion()
            L = Matrix.Translation(loc[b].to_translation() - dt * t) @ q.to_matrix().to_4x4()
            pose[b] = pose[parent[b]] @ L if parent[b] else L
        rec[f] = pose
    rec[w1] = {b: M.copy() for b, M in rec[w0].items()}
    stats['walk_seconds'] = round(n / FPS, 3)
    return frames, rec


def key_clip(arm, name: str, frames, rec):
    """Key rec (armature-space poses) as action `name`, from frame 1, relative to the current
    rest. A bone's location or rotation that never leaves the rest isn't keyed: the exporter
    (keep_anim_armature off) then leaves that channel out of the glb, which plays the same
    (three.js holds an unanimated bone at its rest) and saves the per-channel JSON."""
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    arm.animation_data.action = act
    basis = []
    for f in frames:
        set_pose_from(arm, rec[f])
        basis.append({pb.name: (pb.location.copy(), pb.rotation_quaternion.copy()) for pb in arm.pose.bones})
    moves_loc = {n for n in basis[0] if any(b[n][0].length > REST_EPS for b in basis)}
    moves_rot = {n for n in basis[0] if any(max(map(abs, b[n][1][1:])) > REST_EPS for b in basis)}
    for i, b in enumerate(basis):
        for pb in arm.pose.bones:
            loc, q = b[pb.name]
            if pb.name in moves_loc:
                pb.location = loc
                pb.keyframe_insert('location', frame=i + 1, group=pb.name)
            if pb.name in moves_rot:
                pb.rotation_quaternion = q
                pb.keyframe_insert('rotation_quaternion', frame=i + 1, group=pb.name)
    return act


def floor_walk(arm, mesh, rec, stats: dict) -> None:
    """Shift the walk up or down so its lowest point per frame (a sole on the ground) sits on
    z=0 like the idle's; median over the cycle. Spread goes to stats."""
    lows = []
    for f in sorted(rec):
        set_pose_from(arm, rec[f])
        bpy.context.view_layer.update()
        lows.append(common.world_bounds([mesh])[0].z)
    s = sorted(lows)
    dz = -s[len(s) // 2]
    T = Matrix.Translation(Vector((0, 0, dz)))
    for pose in rec.values():
        for b in pose:
            pose[b] = T @ pose[b]
    stats['walk_floor_shift_m'] = round(dz, 4)
    stats['walk_sole_z'] = [round(min(lows) + dz, 4), round(max(lows) + dz, 4)]


def build_one(args, member: dict) -> dict:
    cid, source, gender = member['id'], member['source'], member['gender']
    name = Path(source).name
    work = Path(args.work) / cid
    work.mkdir(parents=True, exist_ok=True)
    stats: dict = {'id': cid, 'source': source, 'problems': []}

    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.fps = FPS

    # ---- avatar: bake the FBX's 0.01 scale and -90 X into the data, toes to -Y
    bpy.ops.import_scene.fbx(filepath=source_file(args, f'{source}/Export/{name}.fbx'))
    arms = [o for o in sc.objects if o.type == 'ARMATURE']
    meshes = [o for o in sc.objects if o.type == 'MESH']
    assert len(arms) == 1 and len(meshes) == 1, (cid, 'expected one armature and one mesh', arms, meshes)
    arm, mesh = arms[0], meshes[0]
    for o in list(sc.objects):
        if o.type == 'EMPTY':
            bpy.data.objects.remove(o)
    for a in list(bpy.data.actions):
        bpy.data.actions.remove(a)
    arm.animation_data_clear()
    for pb in arm.pose.bones:
        pb.matrix_basis = Matrix()
    common.apply_transforms([arm, mesh])
    fwd = facing(arm)
    yaw = math.atan2(fwd.x, -fwd.y)
    face_rot = Matrix.Rotation(yaw, 4, 'Z')
    arm.matrix_world = face_rot @ arm.matrix_world
    common.apply_transforms([arm, mesh])
    stats['facing'] = [round(v, 3) for v in facing(arm)]

    # ---- idle: copy world rotations from the clip's rig, bake
    stats['bones'] = len(arm.pose.bones)
    baked, frames, rec = bake_clip(args, arm, face_rot, f'{ANIM_DIR}/{IDLE[gender]}.max.fbx', 'idle', stats)
    f0, f1 = frames[0], frames[-1]

    # ---- walk: the same retarget, scaled to the avatar's legs, then made in-place
    arm.animation_data.action = None
    for pb in arm.pose.bones:
        pb.matrix_basis = Matrix()
    walk_frames, walk_rec = make_walk(args, arm, face_rot, gender, stats)
    arm.animation_data.action = baked

    # ---- make the idle loop
    seam_m = max((rec[f0][n].to_translation() - rec[f1][n].to_translation()).length for n in rec[f0])
    seam_r = max(rec[f0][n].to_quaternion().rotation_difference(rec[f1][n].to_quaternion()).angle for n in rec[f0])
    stats['loop_seam_before'] = {'m': round(seam_m, 4), 'deg': round(math.degrees(seam_r), 2)}
    for i, f in enumerate(frames[-LOOP_BLEND:]):
        t = (i + 1) / LOOP_BLEND
        t = t * t * (3 - 2 * t)
        for n, M in rec[f].items():
            loc = M.to_translation().lerp(rec[f0][n].to_translation(), t)
            q = M.to_quaternion().slerp(rec[f0][n].to_quaternion(), t)
            rec[f][n] = Matrix.Translation(loc) @ q.to_matrix().to_4x4()

    # ---- first frame becomes the rest pose
    arm.animation_data.action = None
    for pb in arm.pose.bones:
        pb.matrix_basis = Matrix()
    bpy.context.view_layer.update()
    set_pose_from(arm, rec[f0])
    bpy.context.view_layer.update()
    common.apply_all_modifiers(mesh)
    common.activate(arm)
    bpy.ops.object.mode_set(mode='POSE')
    bpy.ops.pose.armature_apply(selected=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    mod = mesh.modifiers.new('Armature', 'ARMATURE')
    mod.object = arm

    # ---- feet on z=0, pelvis over the origin
    bpy.context.view_layer.update()
    mn, _ = common.world_bounds([mesh])
    pel = arm.data.bones['Bip01 Pelvis'].head_local
    shift = Vector((-pel.x, -pel.y, -mn.z))
    for r in (rec, walk_rec):
        for pose in r.values():
            for n in pose:
                pose[n] = Matrix.Translation(shift) @ pose[n]
    arm.location += shift
    common.apply_transforms([arm, mesh])

    # ---- the idle, relative to the new rest
    arm.animation_data_create()
    for pb in arm.pose.bones:
        pb.rotation_mode = 'QUATERNION'
    idle = key_clip(arm, 'idle', frames, rec)
    bpy.data.actions.remove(baked)
    stats['clip_seconds'] = round((f1 - f0) / FPS, 3)

    # ---- the walk: soles on the floor the idle stands on, then keyed like the idle
    floor_walk(arm, mesh, walk_rec, stats)
    key_clip(arm, 'walk', walk_frames, walk_rec)
    arm.animation_data.action = idle  # exported first; the game looks clips up by name
    for pb in arm.pose.bones:
        pb.matrix_basis = Matrix()
    sc.frame_start, sc.frame_end = 1, f1 - f0 + 1
    sc.frame_set(1)

    # ---- materials
    build_materials(args, cid, source, mesh, work, stats)
    mesh.name = cid
    arm.name = arm.data.name = cid + '_rig'

    # vertex colours and spare UV maps are unused by the materials; drop them from the glb
    for ca in list(mesh.data.color_attributes):
        mesh.data.color_attributes.remove(ca)
    keep = mesh.data.uv_layers.active.name
    for uvl in [u for u in mesh.data.uv_layers if u.name != keep]:
        stats.setdefault('notes', []).append(f'dropped extra UV map {uvl.name}')
        mesh.data.uv_layers.remove(uvl)

    mn, mx = common.world_bounds([mesh])
    stats['tris'] = common.tri_count([mesh])
    stats['height_m'] = round(mx.z, 3)
    stats['min_z'] = round(mn.z, 4)
    if stats['tris'] > MAX_TRIS:
        stats['problems'].append(f"{stats['tris']} triangles > {MAX_TRIS}")
    out = Path(args.out) / f'{cid}.glb'
    out.parent.mkdir(parents=True, exist_ok=True)
    common.export_glb(str(out), [arm, mesh], draco=args.draco)
    stats.update(glb_stats(out))
    return stats


PX_OVERRIDE: dict[str, int] = {}


def tex_px(cid: str, kind: str) -> int:
    px = dict(body=BODY_PX, head=HEAD_PX, hat=HAT_PX, hair=HAIR_PX)
    px.update(TEX_PX.get(cid, {}))
    px.update(PX_OVERRIDE)
    return px[kind]


def resized(arr, px):
    """Float RGBA array -> array whose long side is at most px (Blender's scaler)."""
    h, w = arr.shape[:2]
    s = min(1.0, px / max(w, h))
    return resized_to(arr, max(1, round(w * s)), max(1, round(h * s)))


def resized_to(arr, nw, nh):
    h, w = arr.shape[:2]
    if (nw, nh) == (w, h):
        return arr
    import numpy as np
    img = bpy.data.images.new('tmp_resize', w, h, alpha=True)
    img.pixels.foreach_set(np.ascontiguousarray(arr[::-1]).ravel())
    img.scale(nw, nh)
    a = np.empty(nw * nh * 4, dtype=np.float32)
    img.pixels.foreach_get(a)
    bpy.data.images.remove(img)
    return a.reshape(nh, nw, 4)[::-1].copy()


def build_materials(args, cid, source, mesh, work, stats):
    import numpy as np
    slots = [s.material.name for s in mesh.material_slots]
    stats['source_materials'] = slots
    kinds = []
    for n in slots:
        k = n.split('_', 1)[1] if '_' in n else n
        if k not in KINDS:
            raise ValueError(f'{cid}: material slot {n} has no rule in KINDS')
        kinds.append(k)
    texs = {}
    for n, k in zip(slots, kinds):
        tex = TEXTURE_NAME.get(k, '{slot}_color.tga').format(slot=n)
        arr = common.load_rgba(source_file(args, f'{source}/Textures/{tex}'))
        for op in PAINT_OUT.get(cid, {}).get(k, []):
            common.paint(arr, op)
        texs[k] = arr
    unused = set(PAINT_OUT.get(cid, {})) - set(kinds)
    if unused:
        stats['problems'].append(f'PAINT_OUT for missing textures {sorted(unused)}')

    # glasses under the hair: one alpha-tested texture, UVs squeezed to match
    if 'glasses' in texs and 'opacity' in texs:
        hp = tex_px(cid, 'hair')
        hair = resized(texs['opacity'], hp)
        gl = texs.pop('glasses')
        gl = resized_to(gl, hp, max(1, round(gl.shape[0] * hp / gl.shape[1])))
        H = hair.shape[0] + gl.shape[0]
        top = hair.shape[0] / H  # share of the atlas height the hair takes (top)
        texs['opacity'] = np.concatenate([hair, gl], axis=0)
        gi, hi = kinds.index('glasses'), kinds.index('opacity')
        uv = mesh.data.uv_layers.active.data
        rng = [9, -9]
        for p in mesh.data.polygons:
            for li in p.loop_indices:
                u, v = uv[li].uv
                if p.material_index == gi:
                    rng = [min(rng[0], u, v), max(rng[1], u, v)]
                    uv[li].uv = (u, v * (1 - top))
                elif p.material_index == hi:
                    rng = [min(rng[0], u, v), max(rng[1], u, v)]
                    uv[li].uv = (u, (1 - top) + v * top)
            if p.material_index == gi:
                p.material_index = hi
        if rng[0] < -1e-3 or rng[1] > 1 + 1e-3:
            stats['problems'].append(f'hair/glasses UVs outside 0..1 ({rng}); atlas may bleed')
        common.activate(mesh)
        mesh.active_material_index = gi
        bpy.ops.object.material_slot_remove()
        stats['atlas'] = 'glasses packed under the hair texture'

    mats, sizes = {}, {}
    for k, arr in texs.items():
        rule = KINDS[k]
        outk = rule['out']
        if rule.get('mask'):
            dst = str(work / f'{outk}.png')
            px = max(arr.shape[:2]) if 'atlas' in stats else tex_px(cid, 'hair')  # the atlas is already sized
            wh = common.save_image(arr, dst, px, 'PNG')
            common.png8_mask(dst, HAIR_CUTOFF)
            mats[k] = common.simple_material(outk, dst, alpha='MASK', rough=rule['rough'], cull=False, cutoff=HAIR_CUTOFF)
        else:
            dst = str(work / f'{outk}.jpg')
            wh = common.save_image(arr, dst, tex_px(cid, outk), 'JPEG', quality=JPEG_QUALITY)
            mats[k] = common.simple_material(outk, dst, rough=rule['rough'])
        sizes[outk] = list(wh)
    for s in mesh.material_slots:
        k = s.material.name.split('_', 1)[1]
        s.material = mats[k]
    stats['textures'] = sizes
    stats['materials'] = [s.material.name for s in mesh.material_slots]


def glb_stats(path: Path) -> dict:
    data = path.read_bytes()
    n = struct.unpack('<I', data[12:16])[0]
    j = json.loads(data[20:20 + n])
    tris = sum(j['accessors'][p['indices']]['count'] // 3 for m in j['meshes'] for p in m['primitives'])
    anims = []
    for a in j.get('animations', []):
        t = j['accessors'][a['samplers'][0]['input']]
        anims.append({'name': a.get('name'), 'seconds': round(t['max'][0] - t['min'][0], 3)})
    imgs = {i.get('name'): j['bufferViews'][i['bufferView']]['byteLength'] for i in j.get('images', [])}
    return {'glb_bytes': len(data), 'glb_tris': tris, 'glb_materials': [m['name'] for m in j['materials']],
            'animations': anims, 'image_bytes': imgs}


def preview(args, cid: str) -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = FPS
    bpy.ops.import_scene.gltf(filepath=str(Path(args.out) / f'{cid}.glb'))
    sc = bpy.context.scene
    meshes = [o for o in sc.objects if o.type == 'MESH']
    sc.frame_set(1)
    _, mx = common.world_bounds(meshes)
    work = Path(args.work)
    common.render_customer(str(work / f'{cid}_waist.png'), samples=32, eye=1.6, dist=1.5, target_z=mx.z - 0.42)
    common.render_customer(str(work / f'{cid}_full.png'), samples=12, eye=1.1, dist=3.6, target_z=0.9)

    # the walk from three-quarters on, over a floor: <id>_walk_a.png (clip start), _b (a quarter on)
    arm = [o for o in sc.objects if o.type == 'ARMATURE'][0]
    for t in arm.animation_data.nla_tracks:
        t.mute = True
    walk = bpy.data.actions['walk']
    arm.animation_data.action = walk
    if hasattr(arm.animation_data, 'action_slot') and walk.slots:
        arm.animation_data.action_slot = walk.slots[0]
    arm.rotation_mode = 'XYZ'
    arm.rotation_euler.z = math.radians(-65)
    bpy.ops.mesh.primitive_plane_add(size=6)
    floor = bpy.context.active_object
    fm = bpy.data.materials.new('floor')
    fm.use_nodes = True
    fm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.32, 0.3, 0.28, 1)
    floor.data.materials.append(fm)
    w0, w1 = walk.frame_range
    for tag, frac in (('a', 0.0), ('b', 0.25)):
        sc.frame_set(int(round(w0 + (w1 - w0) * frac)))
        common.render_customer(str(work / f'{cid}_walk_{tag}.png'), samples=12, eye=1.0, dist=3.6, target_z=0.85)


def write_walk_speeds(cast_path: Path, speeds: dict[str, float]) -> None:
    """Put each built avatar's walk ground speed (m/s) into cast.json as walkSpeed, last key,
    one object per line, so the game can move them at the pace their feet keep."""
    cast = json.loads(cast_path.read_text())
    for c in cast:
        if c['id'] in speeds:
            c['walkSpeed'] = speeds[c['id']]
    cast_path.write_text('[\n' + ',\n'.join('  ' + json.dumps(c, ensure_ascii=False) for c in cast) + '\n]\n')


def main() -> None:
    args = parse_args()
    cast = json.loads(Path(args.cast).read_text())
    if args.body_px:
        PX_OVERRIDE['body'] = args.body_px
    if args.hair_px:
        PX_OVERRIDE['hair'] = args.hair_px
    only = {s for s in args.only.split(',') if s}
    if only:
        unknown = only - {c['id'] for c in cast}
        if unknown:
            sys.exit(f'unknown cast ids: {sorted(unknown)}')
        cast = [c for c in cast if c['id'] in only]
    Path(args.work).mkdir(parents=True, exist_ok=True)
    failed = []
    speeds: dict[str, float] = {}
    for member in cast:
        t = time.time()
        try:
            stats = build_one(args, member)
        except Exception as ex:  # keep going; report at the end
            import traceback
            traceback.print_exc()
            failed.append(member['id'])
            log(f"{member['id']}: FAILED {ex}")
            continue
        (Path(args.work) / f"{member['id']}.json").write_text(json.dumps(stats, indent=1))
        speeds[member['id']] = stats['walk_speed']
        log(f"{member['id']}: {stats['glb_tris']} tris, {stats['glb_bytes'] // 1024} KB, "
            f"{stats['textures']}, idle {stats['clip_seconds']} s, {stats['height_m']} m, "
            f"seam {stats['loop_seam_before']}, walk {stats['walk_seconds']} s {stats['walk_speed']} m/s "
            f"x{stats['walk_scale']} seam {stats['walk_seam_before']} slide {stats['walk_planted_slide_m']} m "
            f"soles {stats['walk_sole_z']}, {time.time() - t:.0f} s"
            + (f" PROBLEMS {stats['problems']}" if stats['problems'] else ''))
        if args.preview:
            preview(args, member['id'])
    if speeds:
        write_walk_speeds(Path(args.cast), speeds)
    if failed:
        sys.exit(f'failed: {failed}')


if __name__ == '__main__':
    main()
