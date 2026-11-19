"""Render the motion-puzzle frames from the posed model.
usage: python3 motion_render.py elbow|shoulder <outdir> [--norender]
"""
import sys, os, json, math, subprocess, base64; sys.path.insert(0, os.path.dirname(__file__))
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from model import *
from build import CART
from motion import Elem, bone_elems, pose_elbow, pose_shoulder, apply, gh_centre, elbow_axis
from post import load, finish, save
from atts import compute as att_compute

HERE = os.path.dirname(os.path.abspath(__file__)); RENDER = os.path.join(HERE, 'render')
RND = sys.argv[1]; OUT = sys.argv[2]; os.makedirs(OUT, exist_ok=True)
TMP = os.path.join(HERE, 'out', 'tmp_' + RND); os.makedirs(TMP, exist_ok=True)

NAT = [0.70, 0.17, 0.17]; CTXC = [0.50, 0.36, 0.37]
ROLEC = {'agonist': [0.88, 0.20, 0.32], 'antagonist': [0.22, 0.45, 0.82], 'none': [0.50, 0.47, 0.49], 'assist': [0.80, 0.42, 0.44]}
TRUNK_CTX = {'serratus', 'intercostal', 'trapezius', 'pecminor', 'subclavius'}

if RND == 'elbow':
    ANG = list(range(0, 141, 10))
    ROLES = {'biceps': 'agonist', 'brachialis': 'agonist', 'triceps': 'antagonist', 'deltoid': 'none', 'brachioradialis': 'assist'}
    CARDS = ['biceps', 'brachialis', 'triceps', 'deltoid']
    MUS = ['deltoid', 'biceps', 'brachialis', 'triceps', 'brachioradialis', 'coracobrachialis', 'supraspinatus']
    # only the muscles that matter for this movement: forearm muscles would hide the biceps / brachialis insertions
    CTX = ['anconeus']
    BONESET = ['clavicle', 'scapula', 'humerus', 'radius', 'ulna', 'hand']
    # lateral view of the right limb: image x = anterior (-Y), image y-up = Z, depth = lateral (-X)
    SC = 2.4; M = np.array([[0, -1, 0], [0, 0, 1], [-1, 0, 0]], float)
    BOX = dict(u0=-45, u1=470, z0=760, z1=1500)          # u = -Y (mm), z (mm)
    pose = pose_elbow
else:
    ANG = list(range(0, 91, 10))
    ROLES = {'deltoid': 'agonist', 'supraspinatus': 'agonist', 'pecmajor': 'antagonist', 'brachialis': 'none'}
    CARDS = ['deltoid', 'supraspinatus', 'pecmajor', 'latissimus', 'brachialis']
    MUS = ['deltoid', 'pecmajor', 'biceps', 'brachialis', 'coracobrachialis', 'brachioradialis', 'triceps', 'supraspinatus']
    CTX = list(CONTEXT.keys())
    BONESET = list(BONES.keys())
    SC = 1.55; M = np.array([[1, 0, 0], [0, 0, 1], [0, -1, 0]], float)
    BOX = dict(u0=-990, u1=60, z0=640, z1=1560)          # u = X (mm)
    pose = pose_shoulder

W = int(round((BOX['u1'] - BOX['u0']) * SC)); H = int(round((BOX['z1'] - BOX['z0']) * SC))
W += W % 2; H += H % 2

def proj(P):
    """mm -> image px (x right, y down) + depth"""
    q = P @ M.T
    return np.stack([(q[:, 0] - BOX['u0']) * SC, (BOX['z1'] - q[:, 1]) * SC, q[:, 2] * SC], 1)

def enc(a, dt): return base64.b64encode(np.ascontiguousarray(a, dtype=dt).tobytes()).decode()
def entry(name, V, F, kind, base, ten=None, fib=None):
    P = proj(V); P = np.stack([P[:, 0], -P[:, 1], P[:, 2]], 1)
    fib = np.tile([0, 0, 1.0], (len(V), 1)) if fib is None else fib
    fr = fib @ M.T
    ten = np.zeros(len(V)) if ten is None else ten
    return dict(name=name, kind=kind, base=base, pos=enc(P, '<f4'), fib=enc(fr, '<f4'), ten=enc(ten, '<f4'), idx=enc(F, '<u4'))

print('preparing elements', flush=True)
elems = [Elem(m, f) for m in MUS for f in TARGET[m]] + [Elem(c, f) for c in CTX for f in CONTEXT[c]]
bones = [b for b in bone_elems() if b[0] in BONESET]
BSEG = {'sternum': 'trunk', 'ribs': 'trunk', 'cartilage': 'trunk', 'clavicle': 'girdle', 'scapula': 'girdle', 'humerus': 'arm', 'radius': 'fore', 'ulna': 'fore', 'hand': 'fore'}

A = att_compute()
lat_ins = A['grooveFloor'][0]; lat_org = np.array([-118.0, -10.0, 1095.0])   # lateral ribcage / inferior angle region (posterior)

meshes = []; jobs = []; meta = {'round': RND, 'size': [W, H], 'density': 2, 'angles': ANG, 'frames': []}
groups = sorted(set(MUS) | set(CTX) | {'bone:' + b[0] for b in bones})
def gcol(k): return [20 + (k % 6) * 44, 20 + ((k // 6) % 6) * 44, 20 + (k // 36) * 44]
PAL = {g: gcol(i) for i, g in enumerate(groups)}

# per-element overrides: in abduction only the clavicular (assist) and acromial (prime mover) deltoid fibres shorten;
# the spinal (posterior) part lengthens below ~90 deg, so it is shown as not involved.
ELEM_ROLE = {'shoulder': {'FJ1468': 'assist', 'FJ1513': 'none'}}.get(RND, {})
def color_for(g, roles, fid=None):
    if g in MUS:
        if roles is None: return NAT
        if fid in ELEM_ROLE: return ROLEC[ELEM_ROLE[fid]]
        return ROLEC.get(ROLES.get(g, 'ctx'), CTXC)
    return CTXC

for fi, ang in enumerate(ANG):
    P = pose(ang)
    for e in elems:
        V, fib, strain = e.pose(P)
        for variant in (['n', 'r'] if fi == 0 else ['r']):
            base = color_for(e.g, None if variant == 'n' else ROLES, e.fid)
            meshes.append(entry(f'f{fi}{variant}:{e.g}:{e.fid}', V, e.F, 0 if e.g in MUS else 2, base, e.ten, fib))
    for (g, V, F) in bones:
        Vp = apply(P[BSEG[g]], V)
        meshes.append(entry(f'f{fi}b:bone:{g}', Vp, F, 1, CART if g == 'cartilage' else [0.92, 0.87, 0.76]))
    # anchors
    if RND == 'elbow':
        c, ax = elbow_axis(); piv = c
        wrist = np.array(merge(['FJ3383', 'FJ3374', 'FJ3390'])[0].mean(0))      # scaphoid, lunate, triquetral
        hnd = apply(P['fore'], wrist[None])[0]
    else:
        piv = gh_centre(); piv = apply(P['girdle'], piv[None])[0]
        wrist = np.array(merge(['FJ3383', 'FJ3374', 'FJ3390'])[0].mean(0)); hnd = apply(P['fore'], wrist[None])[0]
    fr = dict(angle=ang, pivot=proj(piv[None])[0][:2].round(1).tolist(), handle=proj(hnd[None])[0][:2].round(1).tolist())
    if RND == 'shoulder':
        li = apply(P['arm'], lat_ins[None])[0]
        fr['lat'] = [proj(lat_org[None])[0][:2].round(1).tolist(), proj(li[None])[0][:2].round(1).tolist()]
    # rest-relative muscle length change (for the read-out)
    fr['strain'] = {}
    for m in MUS:
        es = [e for e in elems if e.g == m]
        if RND == 'shoulder' and m == 'deltoid': es = [e for e in es if e.fid == 'FJ1467']     # middle fibres
        fr['strain'][m] = round(float(np.mean([e.pose(P)[2] for e in es])), 3)
    meta['frames'].append(fr)
    print('frame', fi, ang, fr['strain'], flush=True)

scene = os.path.join(TMP, 'scene.json')
json.dump(dict(meshes=meshes), open(scene, 'w'))
IDS = {}
for m in meshes:
    g = m['name'].split(':', 1)[1]; g = g if g.startswith('bone:') else g.split(':')[0]
    IDS[m['name']] = PAL[g]
VIEW = [0, 0, W, H]
for fi in range(len(ANG)):
    for variant in (['n', 'r'] if fi == 0 else ['r']):
        ms = [m['name'] for m in meshes if m['name'].startswith(f'f{fi}{variant}:') or m['name'].startswith(f'f{fi}b:')]
        nm = f'f{fi}{variant}'
        jobs += [dict(name=nm + '_c', size=[W * 2, H * 2], view=VIEW, meshes=ms),
                 dict(name=nm + '_d', size=[W, H], view=VIEW, meshes=ms, mode='dir'),
                 dict(name=nm + '_i', size=[W, H], view=VIEW, meshes=ms, mode='id', ids=IDS)]
    if RND == 'shoulder':   # supraspinatus alone (x-ray overlay: it lies behind the clavicle/acromion in this view)
        ms = [m['name'] for m in meshes if m['name'].startswith(f'f{fi}r:supraspinatus:')]
        jobs += [dict(name=f'f{fi}x_c', size=[W * 2, H * 2], view=VIEW, meshes=ms),
                 dict(name=f'f{fi}x_d', size=[W, H], view=VIEW, meshes=ms, mode='dir'),
                 dict(name=f'f{fi}x_i', size=[W, H], view=VIEW, meshes=ms, mode='id', ids=IDS)]
json.dump(jobs, open(os.path.join(TMP, 'jobs.json'), 'w'))
if '--norender' not in sys.argv:
    subprocess.run(['node', os.path.join(RENDER, 'render.cjs'), scene, os.path.join(TMP, 'jobs.json'), TMP], check=True)

MG = [g for g in groups if not g.startswith('bone:')]
def proc(nm, seed):
    return finish(load(os.path.join(TMP, nm + '_c.png')), load(os.path.join(TMP, nm + '_d.png')), load(os.path.join(TMP, nm + '_i.png')), PAL, MG, seed=seed)

for fi in range(len(ANG)):
    for variant in (['n', 'r'] if fi == 0 else ['r']):
        img, lab, names = proc(f'f{fi}{variant}', 3)       # same seed every frame -> no texture flicker
        save(img, os.path.join(OUT, f'{RND}_{variant}{fi}.webp'), q=88)
        if variant == 'r':
            labels = {}
            for m in CARDS + (['brachioradialis'] if RND == 'elbow' else []):
                if m not in names: continue
                k = names.index(m) + 1; vis = ndi.binary_opening(lab == k, iterations=2)
                if vis.sum() < 40: continue
                lb, n = ndi.label(vis); sz = ndi.sum(vis, lb, range(1, n + 1)); big = lb == (np.argmax(sz) + 1)
                dt = ndi.distance_transform_edt(big); y, x = np.unravel_index(np.argmax(dt), dt.shape)
                labels[m] = [round(x / 2, 1), round(y / 2, 1)]
            meta['frames'][fi]['labels'] = labels
    if RND == 'shoulder':
        img, lab, _ = proc(f'f{fi}x', 3)
        a = img[..., 3]; ys, xs = np.where(a > 0.02)
        x0, x1, y0, y1 = xs.min() - 4, xs.max() + 4, ys.min() - 4, ys.max() + 4
        x0 -= x0 % 2; y0 -= y0 % 2; x1 += x1 % 2; y1 += y1 % 2
        save(img[y0:y1, x0:x1], os.path.join(OUT, f'{RND}_x{fi}.webp'), q=88)
        meta['frames'][fi]['xray'] = [x0 / 2, y0 / 2, (x1 - x0) / 2, (y1 - y0) / 2]
for fr in meta['frames']:
    fr['pivot'] = [round(v / 2, 1) for v in fr['pivot']]; fr['handle'] = [round(v / 2, 1) for v in fr['handle']]
    if 'lat' in fr: fr['lat'] = [[round(v / 2, 1) for v in p] for p in fr['lat']]
meta['size'] = [W // 2, H // 2]
json.dump(meta, open(os.path.join(OUT, f'{RND}.json'), 'w'), indent=1)
print('done', RND)
