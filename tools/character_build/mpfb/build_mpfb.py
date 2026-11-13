"""MUSCLE BATTLE 2.0 fighter builder (MPFB2 / MakeHuman CC0 assets).
usage: python3 build_mpfb.py JIN|RAY <outdir>
Builds the body from MakeHuman targets, dresses it with garments modelled from the body surface
(real geometry, rigged through copied bone weights), bakes textures and exports a Mixamo-rigged FBX."""
import sys, os, math
sys.path.insert(0, '/tmp/mp')
from common import *
import specs
import bmesh
import numpy as np
from mathutils import Vector

CH = sys.argv[1]; OUT = sys.argv[2]; os.makedirs(OUT, exist_ok=True)
spec = getattr(specs, CH); ID = spec['name']

body = build(spec)
arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]

# drop mouth interior (closed mouth) to save triangles
for o in list(bpy.data.objects):
    if o.type == 'MESH' and ('teeth' in o.name or 'tongue' in o.name):
        bpy.data.objects.remove(o)

# ---- T-pose rest pose (Mixamo / Unity Humanoid convention) ----
RS = import_module(P + "rigservice").RigService
import json as _json
pose = _json.load(open('/tmp/mpfb2/src/mpfb/data/poses/mixamo_unity_fk/t-pose.json'))
for o in bpy.context.selected_objects: o.select_set(False)
bpy.context.view_layer.objects.active = arm; arm.select_set(True)
bpy.ops.object.mode_set(mode='POSE')
for pb in arm.pose.bones:
    pb.rotation_mode = 'XYZ'; pb.rotation_euler = (0, 0, 0); pb.location = (0, 0, 0)
for bn, r in pose['bone_rotations'].items():
    if bn in arm.pose.bones: arm.pose.bones[bn].rotation_euler = r
for bn, t in pose.get('bone_translations', {}).items():
    if bn in arm.pose.bones: arm.pose.bones[bn].location = t
bpy.ops.object.mode_set(mode='OBJECT')
bpy.context.view_layer.update()
RS.apply_pose_as_rest_pose(arm)
bpy.context.view_layer.objects.active = body
# ---- bake targets into the mesh and strip helper geometry ----
ES = import_module(P + "exportservice").ExportService
bpy.context.view_layer.objects.active = body
TS.bake_targets(body)
ES.bake_modifiers_remove_helpers(body, bake_masks=True)
body.vertex_groups.active_index = 0
print("BODY verts", len(body.data.vertices), "faces", len(body.data.polygons))

def obj_of(key):
    for o in bpy.data.objects:
        if o.type == 'MESH' and key in o.name: return o

# ---------------- helpers ----------------
def bone(nm): return arm.data.bones['mixamorig:' + nm]
def bpos(nm, tail=False):
    b = bone(nm); return arm.matrix_world @ (b.tail_local if tail else b.head_local)

me = body.data
co = np.array([body.matrix_world @ v.co for v in me.vertices])
me.calc_normals_split() if hasattr(me, 'calc_normals_split') else None
nrm = np.array([(body.matrix_world.to_3x3() @ v.normal).normalized() for v in me.vertices])
NV = len(me.vertices)
gidx = {g.name.replace('mixamorig:', ''): g.index for g in body.vertex_groups}
W = np.zeros((NV, len(body.vertex_groups)), np.float32)
for v in me.vertices:
    for g in v.groups: W[v.index, g.group] = g.weight

def w(*names):
    s = np.zeros(NV, np.float32)
    for n in names:
        for side in (['Left', 'Right'] if n.startswith('*') else ['']):
            k = n.replace('*', side)
            if k in gidx: s += W[:, gidx[k]]
    return s

def along(bname, side):
    """0..1 parameter of each vertex along a bone (head->tail)"""
    h = np.array(bpos(side + bname)); t = np.array(bpos(side + bname, True)); d = t - h
    return ((co - h) @ d) / (d @ d)

z = co[:, 2]; x = co[:, 0]; y = co[:, 1]
hips = bpos('Hips'); spine2 = bpos('Spine2'); neck = bpos('Neck'); head = bpos('Head')
ankle = bpos('LeftFoot'); knee = bpos('LeftLeg')
print("landmarks hips", hips.z, "spine2", spine2.z, "neck", neck.z, "knee", knee.z, "ankle", ankle.z)
armw = w('*Arm', '*ForeArm', '*Hand') + sum(w('*Hand' + f + i) for f in ['Index', 'Middle', 'Ring', 'Pinky', 'Thumb'] for i in '123')
handw = w('*Hand') + sum(w('*Hand' + f + '1') for f in ['Index', 'Middle', 'Ring', 'Pinky', 'Thumb'])
fingerw = sum(w('*Hand' + f + i) for f in ['Index', 'Middle', 'Ring', 'Pinky', 'Thumb'] for i in '23')

def shell(name, mask, offset, solid=0.0, keep_body=False, smooth=0):
    """Duplicate body faces whose verts are all in mask, push them out along the normal by offset[v]."""
    ob = body.copy(); ob.data = SRC.copy(); ob.name = f"{ID}_{name}"
    bpy.context.collection.objects.link(ob)
    for sl in ob.material_slots: sl.link = 'DATA'
    bm = bmesh.new(); bm.from_mesh(ob.data); bm.verts.ensure_lookup_table()
    kill = [f for f in bm.faces if not all(mask[v.index] for v in f.verts)]
    bmesh.ops.delete(bm, geom=kill, context='FACES')
    loose = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=loose, context='VERTS')
    # remember original index through a layer
    bm.to_mesh(ob.data); bm.free()
    m = ob.data
    # map: shell vertex -> original index by position match (copy preserved order minus deleted)
    keep = np.where(mask)[0]
    orig = np.array([i for i in range(NV) if mask[i]])
    # vertices without faces were removed; rebuild mapping via nearest positions
    from mathutils.kdtree import KDTree
    kd = KDTree(NV)
    for i, c in enumerate(me.vertices): kd.insert(c.co, i)
    kd.balance()
    oi = np.array([kd.find(v.co)[1] for v in m.vertices])
    inv = ob.matrix_world.inverted().to_3x3()
    for v, i in zip(m.vertices, oi):
        v.co = v.co + inv @ Vector(nrm[i] * offset[i])
    for _ in range(smooth):
        bpy.context.view_layer.objects.active = ob
        sm = ob.modifiers.new('s', 'SMOOTH'); sm.factor = 0.5; sm.iterations = 2
        ob.modifiers.move(len(ob.modifiers) - 1, 0)
        bpy.ops.object.modifier_apply(modifier=sm.name)
    ob['solid'] = solid
    if False:
        so = ob.modifiers.new('solid', 'SOLIDIFY'); so.thickness = solid; so.offset = -1; so.use_rim = True
        ob.modifiers.move(len(ob.modifiers) - 1, 0)
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.modifier_apply(modifier=so.name)
    ob['orig'] = oi.tolist()
    return ob, oi

def paint(ob, oi, colfn):
    """vertex colors from a function of original-vertex index arrays"""
    m = ob.data
    cols = colfn(oi)  # (n,3)
    # solidify adds verts: map extras to nearest shell vertex colour
    attr = m.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    n0 = len(oi)
    for v in m.vertices:
        c = cols[v.index] if v.index < n0 else cols[v.index % n0]
        attr.data[v.index].color = (c[0], c[1], c[2], 1)

def boundary_dist(ob, rings=3):
    """per-vertex ring distance from open boundary (0=on boundary, rings=far)"""
    bm = bmesh.new(); bm.from_mesh(ob.data); bm.verts.ensure_lookup_table()
    d = np.full(len(bm.verts), rings, np.int32)
    front = [v for v in bm.verts if v.is_boundary]
    for r in range(rings):
        nxt = []
        for v in front:
            if d[v.index] > r:
                d[v.index] = r
                nxt += [e.other_vert(v) for e in v.link_edges]
        front = nxt
    bm.free(); return d

HIDE = np.zeros(NV, bool)
def delete_body(mask):
    global HIDE; HIDE |= mask
def apply_hide():
    bm = bmesh.new(); bm.from_mesh(body.data)
    mask = HIDE
    kill = [f for f in bm.faces if all(mask[v.index] for v in f.verts)]
    bmesh.ops.delete(bm, geom=kill, context='FACES')
    bm.to_mesh(body.data); bm.free()

def leg_angle():
    ang = np.full(NV, np.pi)
    for sd, sg in (('Left', 1), ('Right', -1)):
        legv = (w(sd + 'UpLeg', sd + 'Leg', sd + 'Foot') > 0.5) & (np.sign(co[:, 0]) == sg)
        zs = co[legv, 2]; bins = np.arange(zs.min(), zs.max() + 0.02, 0.02)
        cxs = []; cys = []
        for z0 in bins:
            m = legv & (np.abs(co[:, 2] - z0) < 0.015)
            if m.sum() < 4: cxs.append(np.nan); cys.append(np.nan); continue
            pts = co[m]; cxs.append((pts[:, 0].min() + pts[:, 0].max()) / 2); cys.append((pts[:, 1].min() + pts[:, 1].max()) / 2)
        cxs = np.array(cxs); cys = np.array(cys); ok = ~np.isnan(cxs)
        cx = np.interp(co[:, 2], bins[ok], cxs[ok]); cy = np.interp(co[:, 2], bins[ok], cys[ok])
        th = np.arctan2(co[:, 1] - cy, (co[:, 0] - cx) * sg)
        sel = np.sign(co[:, 0]) == sg
        ang[sel] = th[sel]
    return ang
LEGANG = leg_angle()
def leg_ang_of(ob):
    from mathutils.kdtree import KDTree
    kd = KDTree(NV)
    for i, c in enumerate(co): kd.insert(Vector(c), i)
    kd.balance()
    return np.array([abs(LEGANG[kd.find(ob.matrix_world @ v.co)[1]]) for v in ob.data.vertices])
def armhole(r):
    m = np.zeros(NV, bool)
    for sd in ('Left', 'Right'):
        p = np.array(bpos(sd + 'Arm')); m |= np.linalg.norm(co - p, axis=1) < r
    return m
def cut(ob, pco, pno, region=None):
    """bisect ob by plane; delete faces on the +normal side (optionally only those whose centre passes region(c))"""
    bm = bmesh.new(); bm.from_mesh(ob.data)
    geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
    bmesh.ops.bisect_plane(bm, geom=geom, plane_co=Vector(pco), plane_no=Vector(pno), clear_inner=False, clear_outer=False)
    n = Vector(pno).normalized(); p = Vector(pco)
    kill = [f for f in bm.faces if (f.calc_center_median() - p).dot(n) > 1e-5 and (region is None or region(f.calc_center_median()))]
    bmesh.ops.delete(bm, geom=kill, context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.to_mesh(ob.data); bm.free()

def solidify(ob, t):
    so = ob.modifiers.new('solid', 'SOLIDIFY'); so.thickness = t; so.offset = -1; so.use_rim = True
    ob.modifiers.move(len(ob.modifiers) - 1, 0)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.modifier_apply(modifier=so.name)
garments = []
SRC = body.data.copy()
flare = np.clip((knee.z - z) / (knee.z - ankle.z), 0, 1)
legzone = (armw < 0.03) & (z < spine2.z)

def fattr(ob, name, vals):
    at = ob.data.attributes.new(name, 'FLOAT', 'POINT'); n0 = len(vals)
    for v in ob.data.vertices: at.data[v.index].value = float(vals[v.index % n0])

def ringd(ob, rings=4):
    """euclidean distance (m) from each vertex to the open boundary"""
    from mathutils.kdtree import KDTree
    bm = bmesh.new(); bm.from_mesh(ob.data)
    pts = []
    for e in bm.edges:
        if e.is_boundary:
            a, b = e.verts[0].co, e.verts[1].co
            for t in np.linspace(0, 1, 6): pts.append(a.lerp(b, t))
    bm.free()
    kd = KDTree(len(pts))
    for i, p in enumerate(pts): kd.insert(p, i)
    kd.balance()
    return np.array([kd.find(v.co)[2] for v in ob.data.vertices], np.float32)

def G(ob, part, base, layers, rough=0.7, solid=0.0):
    print('GARMENT', part, len(ob.data.vertices), len(ob.data.polygons))
    """layers: list of (attr_name, values, lo, hi, color) -> color where lo<=value<=hi"""
    paint(ob, list(range(len(ob.data.vertices))), lambda o: np.tile(base, (len(o), 1)))
    for k, (nm, vals, lo, hi, col) in enumerate(layers): fattr(ob, nm, vals)
    if solid > 0: solidify(ob, solid)
    garments.append((ob, part, rough, layers))

if ID == 'Jin':
    NAVY = np.array([0.012, 0.022, 0.10]); BLUE = np.array([0.02, 0.13, 0.65]); WHITE = np.array([0.75, 0.78, 0.82])
    BLACK = np.array([0.011, 0.011, 0.014])
    waist = hips.z + 0.10
    pm = legzone & (z > ankle.z + 0.02) & (z < waist + 0.03)
    off = 0.016 + 0.045 * flare ** 1.4 + 0.01 * np.clip((z - knee.z) / 0.3, 0, 1)
    pants, oi = shell('Pants', pm, off, smooth=1)
    cut(pants, (0, 0, waist), (0, 0, 1)); cut(pants, (0, 0, ankle.z + 0.04), (0, 0, -1))
    oi = oi[:0]; LA = None
    la = leg_ang_of(pants)
    G(pants, 'Pants', BLACK, [('ang', la, 0, 0.26, BLUE), ('ang2', la, 0, 0.09, WHITE)], 0.85)
    belt, oi = shell('Belt', legzone & (z > waist - 0.06) & (z < waist + 0.005), np.full(NV, 0.03))
    G(belt, 'Belt', BLACK * 1.2, [('bz', np.abs(co[oi, 2] - (waist - 0.028)), 0, 0.007, BLUE)], 0.6)
    delete_body(pm & (z > ankle.z + 0.06) & (z < waist - 0.03))
    vm = (armw < 0.5) & (z > waist - 0.05) & (z < neck.z + 0.06) & (w('Head') < 0.05)
    hood = np.clip((z - (neck.z - 0.10)) / 0.13, 0, 1) * np.clip((y + 0.01) / 0.06, 0, 1)
    vest, oi = shell('Vest', vm, 0.013 + 0.055 * hood, smooth=2)
    sh = bpos('LeftArm')
    cut(vest, (0, 0, waist - 0.01), (0, 0, -1))
    for sg in (1, -1):
        p1 = Vector((sg * 0.03, 0, neck.z - 0.01)); p2 = Vector((sg * 0.105, 0, waist)); d = p2 - p1
        nn = Vector((d.z, 0, -d.x)) * sg
        if nn.x * sg > 0: nn = -nn
        cut(vest, p1, nn, lambda c, sg=sg: c.y < -0.035 and c.x * sg > -0.002)
        cut(vest, (sg * (sh.x - 0.035), 0, sh.z), (sg * 1.0, 0, 0.45))
    cut(vest, (0, 0, neck.z - 0.015), (0, 0, 1), lambda c: c.y < -0.02)
    rd = ringd(vest)
    oi = np.zeros(len(vest.data.vertices), int)
    G(vest, 'Vest', NAVY, [('rd', rd, -1, 0.009, WHITE), ('rd2', rd, 0.009, 0.02, BLUE)], 0.75, solid=0.005)
    gm = (handw > 0.55) & (fingerw < 0.3)
    fa = (w('*ForeArm') > 0.5) & (np.where(x > 0, along('ForeArm', 'Left'), along('ForeArm', 'Right')) > 0.78)
    gloves, oi = shell('Gloves', gm | fa, np.full(NV, 0.008), smooth=1)
    G(gloves, 'Gloves', BLACK * 1.3, [('wr', w('*ForeArm')[oi], 0.45, 9, BLUE)], 0.5)
    delete_body(gm & (handw > 0.75))
else:
    BLACK = np.array([0.011, 0.01, 0.012]); RED = np.array([0.55, 0.012, 0.018])
    waist = hips.z + 0.04
    pm = legzone & (z > ankle.z + 0.02) & (z < waist + 0.03)
    off = 0.009 + 0.035 * flare ** 1.6
    pants, oi = shell('Pants', pm, off, smooth=1)
    cut(pants, (0, 0, waist), (0, 0, 1)); cut(pants, (0, 0, ankle.z + 0.035), (0, 0, -1))
    G(pants, 'Pants', BLACK, [('ang', leg_ang_of(pants), 0, 0.16, RED)], 0.7)
    delete_body(pm & (z > ankle.z + 0.05) & (z < waist - 0.02))
    nip = W[:, [g.index for g in body.vertex_groups if g.name == 'nipple'][0]] > 0.5 if 'nipple' in [g.name for g in body.vertex_groups] else None
    bz = co[nip, 2].mean() if nip is not None and nip.any() else bpos('Spine2').z + 0.12
    print('BUST z', bz)
    chest = Vector((0, 0, bz))
    tm = (armw < 0.5) & (z > chest.z - 0.12) & (z < chest.z + 0.16) & (w('Head') < 0.05)
    top, oi = shell('Top', tm, np.full(NV, 0.007), smooth=1)
    sh = bpos('LeftArm')
    cut(top, (0, 0, chest.z - 0.085), (0, 0, -1))
    cut(top, (0, 0, chest.z + 0.075), (0, 0.25, 1))
    for sg in (1, -1):
        cut(top, (sg * (sh.x - 0.03), 0, sh.z), (sg * 1.0, 0, 0.35))
    rd = ringd(top)
    nx = np.array([abs(v.normal.x) for v in top.data.vertices])
    G(top, 'Top', BLACK, [('sd', nx, 0.62, 9, RED), ('rd', rd, -1, 0.008, RED)], 0.7, solid=0.003)
    delete_body(tm & (z > chest.z - 0.07) & (z < chest.z + 0.055) & (np.abs(x) < sh.x - 0.06))
    gm = (handw > 0.55) & (fingerw < 0.3)
    gloves, oi = shell('Gloves', gm, np.full(NV, 0.006), smooth=1)
    G(gloves, 'Gloves', BLACK * 1.4, [('kn', -nrm[oi, 1], 0.45, 9, RED)], 0.5)
    delete_body(gm & (handw > 0.75))
    bands = np.zeros(NV, bool)
    for sd in ['Left', 'Right']:
        sgn = 1 if sd == 'Left' else -1
        a1 = along('Arm', sd); a2 = along('ForeArm', sd)
        bands |= (np.sign(x) == sgn) & (((w(sd + 'Arm') > 0.5) & (a1 > 0.6) & (a1 < 0.72)) | ((w(sd + 'ForeArm') > 0.5) & (a2 > 0.55) & (a2 < 0.72)))
    band, oi = shell('Bands', bands, np.full(NV, 0.006))
    G(band, 'Bands', RED, [('rd', ringd(band), -1, 0.005, np.array([0.02, 0.02, 0.025]))], 0.5)

apply_hide()
# ---------------- textures ----------------
TEX = f"{OUT}/Textures"; os.makedirs(TEX, exist_ok=True)
s = bpy.context.scene; s.render.engine = 'CYCLES'; s.cycles.device = 'CPU'; s.cycles.samples = 16

def bake_img(ob, size, nodefn, fill=0.0):
    img = bpy.data.images.new("tmpbake", size, size, alpha=False, float_buffer=True)
    img.pixels[:] = np.full(size * size * 4, fill, np.float32)
    mat = bpy.data.materials.new("bk"); mat.use_nodes = True
    nt = mat.node_tree; nt.nodes.clear()
    em = nt.nodes.new('ShaderNodeEmission'); nodefn(nt, em.inputs['Color'])
    out = nt.nodes.new('ShaderNodeOutputMaterial'); nt.links.new(em.outputs[0], out.inputs[0])
    ti = nt.nodes.new('ShaderNodeTexImage'); ti.image = img; nt.nodes.active = ti
    ob.data.materials.clear(); ob.data.materials.append(mat)
    for o in bpy.context.selected_objects: o.select_set(False)
    ob.select_set(True); bpy.context.view_layer.objects.active = ob
    s.render.bake.margin = 6
    bpy.ops.object.bake(type='EMIT')
    a = np.array(img.pixels[:], np.float32).reshape(size, size, 4)[:, :, :3]
    bpy.data.images.remove(img); bpy.data.materials.remove(mat)
    return a

def smart_uv(ob):
    for o in bpy.context.selected_objects: o.select_set(False)
    ob.select_set(True); bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.004)
    bpy.ops.object.mode_set(mode='OBJECT')

def bake_garment(ob, part, rough, layers, size=1024):
    smart_uv(ob)
    def colnode(nt, sock):
        ca = nt.nodes.new('ShaderNodeVertexColor'); ca.layer_name = 'Col'; nt.links.new(ca.outputs['Color'], sock)
    col = bake_img(ob, size, colnode)
    for nm, vals, lo, hi, c in layers:
        def an(nt, sock, nm=nm):
            at = nt.nodes.new('ShaderNodeAttribute'); at.attribute_name = nm; nt.links.new(at.outputs['Fac'], sock)
        v = bake_img(ob, size, an, fill=-99.0)[:, :, 0]
        m = ((v >= lo) & (v <= hi)).astype(np.float32)
        col = col * (1 - m[:, :, None]) + np.array(c)[None, None, :] * m[:, :, None]
    # fabric weave + soft AO-like darkening at seams kept simple
    rng = np.random.default_rng(1)
    weave = 0.93 + 0.07 * rng.random((size, size))
    col = col * weave[:, :, None]
    srgb = np.where(col <= 0.0031308, col * 12.92, 1.055 * np.power(np.clip(col, 0, None), 1 / 2.4) - 0.055)
    from PIL import Image as PI
    fname = f"T_{ID}_{part}"
    PI.fromarray((np.clip(srgb[::-1], 0, 1) * 255).astype(np.uint8)).save(f"{TEX}/{fname}.png")
    mat = bpy.data.materials.new(f"M_{ID}_{part}"); mat.use_nodes = True
    nt = mat.node_tree
    bs = nt.nodes.get('Principled BSDF'); bs.inputs['Roughness'].default_value = rough
    ti = nt.nodes.new('ShaderNodeTexImage'); nt.links.new(ti.outputs['Color'], bs.inputs['Base Color'])
    ob.data.materials.clear(); ob.data.materials.append(mat)

def first_image(ob):
    for sl in ob.material_slots:
        for n in sl.material.node_tree.nodes:
            if n.type == 'TEX_IMAGE' and n.image: return n.image

def img_np(im):
    w_, h_ = im.size; return np.array(im.pixels[:], np.float32).reshape(h_, w_, 4)

def save_np(arr, path, alpha=True):
    from PIL import Image
    a = np.clip(arr[::-1] * 255, 0, 255).astype(np.uint8)
    Image.fromarray(a if alpha else a[:, :, :3]).save(path)

def resize(path, size):
    from PIL import Image
    im = Image.open(path); im.resize((size, size), Image.LANCZOS).save(path)

for ob, part, rough, layers in garments:
    bake_garment(ob, part, rough, layers)
    print('baked', part, len(ob.data.polygons))

# body: AO for muscle definition, warm Asian skin tone
skin = first_image(body)
skin_px = img_np(skin)
others = [o for o in bpy.data.objects if o.type == 'MESH' and o != body]
for o in others: o.hide_render = True
ao = bpy.data.images.new("ao", 2048, 2048, alpha=False)
mat = body.material_slots[0].material; nt = mat.node_tree
ti = nt.nodes.new('ShaderNodeTexImage'); ti.image = ao; nt.nodes.active = ti
for o in bpy.context.selected_objects: o.select_set(False)
body.select_set(True); bpy.context.view_layer.objects.active = body
s.cycles.samples = 48; s.world.light_settings.distance = 0.12 if hasattr(s.world, 'light_settings') else None
bpy.ops.object.bake(type='AO')
aop = img_np(ao)[:, :, :1]
if skin_px.shape[:2] != aop.shape[:2]:
    from PIL import Image
    aop = np.array(Image.fromarray((aop[:, :, 0] * 255).astype(np.uint8)).resize(skin_px.shape[1::-1]))[:, :, None] / 255.0
tone = np.array(spec.get('skintone', (1.0, 0.86, 0.74)))
out = skin_px.copy()
out[:, :, :3] = skin_px[:, :, :3] * tone * (0.52 + 0.48 * aop)
out[:, :, 3] = 1
save_np(out, f"{TEX}/T_{ID}_Body.png", alpha=False)
for o in others: o.hide_render = False

# hair / brows / lashes / eyes -> dark tinted maps that keep the alpha
def tinted(obkey, part, rgb, detail, size, alpha=True):
    ob = obj_of(obkey); im = first_image(ob); px = img_np(im)
    lum = px[:, :, :3] @ np.array([0.3, 0.59, 0.11]); lum = lum / max(lum.max(), 1e-3)
    px[:, :, :3] = np.clip(np.array(rgb)[None, None, :] * ((1 - detail) + detail * 2 * lum[:, :, None]), 0, 1)
    save_np(px, f"{TEX}/T_{ID}_{part}.png", alpha)
    resize(f"{TEX}/T_{ID}_{part}.png", size)
    ob.name = f"{ID}_{part}"
    for sl in ob.material_slots: sl.material.name = f"M_{ID}_{part}"
hk = 'short02' if ID == 'Jin' else 'ponytail01'
tinted(hk, 'Hair', spec['haircolor'], 0.6, 1024)
tinted('eyebrow', 'Brows', (0.03, 0.025, 0.025), 0.3, 256)
tinted('eyelashes', 'Lashes', (0.02, 0.02, 0.02), 0.2, 256)
eo = obj_of('high-poly'); epx = img_np(first_image(eo))
rgb = epx[:, :, :3]; sat = rgb.max(2) - rgb.min(2); lum = rgb.mean(2, keepdims=True)
iris = np.clip((sat - 0.12) / 0.15, 0, 1)[:, :, None]
epx[:, :, :3] = rgb * (1 - iris) + iris * np.array([0.30, 0.19, 0.11]) * (0.4 + 1.4 * lum)
save_np(epx, f"{TEX}/T_{ID}_Eyes.png", alpha=False); resize(f"{TEX}/T_{ID}_Eyes.png", 512)
eo.name = f"{ID}_Eyes"
for sl in eo.material_slots: sl.material.name = f"M_{ID}_Eyes"
body.name = f"{ID}_Body"; body.material_slots[0].material.name = f"M_{ID}_Body"
resize(f"{TEX}/T_{ID}_Body.png", 2048)

for o in bpy.data.objects:
    if o.type != 'MESH': continue
    for sl in o.material_slots:
        part = sl.material.name.split('_', 2)[-1]
        f = f"{TEX}/T_{ID}_{part}.png"
        if not os.path.exists(f): print("NO TEX", f); continue
        im = bpy.data.images.load(f)
        for n in sl.material.node_tree.nodes:
            if n.type == 'TEX_IMAGE': n.image = im
for o in bpy.data.objects:
    if o.type == 'MESH' and any(o.name.endswith(k) for k in ('_Hair', '_Brows', '_Lashes')):
        bm = bmesh.new(); bm.from_mesh(o.data)
        dup = bmesh.ops.duplicate(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:])
        faces = [g for g in dup['geom'] if isinstance(g, bmesh.types.BMFace)]
        bmesh.ops.reverse_faces(bm, faces=faces)
        for v in [g for g in dup['geom'] if isinstance(g, bmesh.types.BMVert)]: v.co -= v.normal * 0.0004
        bm.to_mesh(o.data); bm.free()
# ---------------- export ----------------
for o in bpy.data.objects:
    if o.type == 'MESH':
        o.parent = arm
        for m in o.modifiers:
            if m.type == 'ARMATURE': m.object = arm
arm.name = ID
tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in bpy.data.objects if o.type == 'MESH')
print("TRIS", tris, [(o.name, len(o.data.polygons)) for o in bpy.data.objects if o.type == 'MESH'])
bpy.ops.wm.save_as_mainfile(filepath=f"{OUT}/{ID}.blend")
for o in bpy.data.objects: o.select_set(o.type in ('MESH', 'ARMATURE'))
bpy.ops.export_scene.fbx(filepath=f"{OUT}/{ID.lower()}.fbx", use_selection=True, add_leaf_bones=False,
                         path_mode='STRIP', embed_textures=False, mesh_smooth_type='FACE',
                         apply_scale_options='FBX_SCALE_UNITS', bake_anim=False, armature_nodetype='NULL',
                         object_types={'ARMATURE', 'MESH'})
print("EXPORTED")
