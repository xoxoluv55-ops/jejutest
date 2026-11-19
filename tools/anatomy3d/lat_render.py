"""Latissimus dorsi images (CC BY-SA 2.1 JP — derived from BodyParts3D 3.0, see latissimus.py). Kept as separate
files so the CC BY 4.0 plates/frames stay unchanged:
  plates/mus_real_latissimus.webp, mus_glow_latissimus.webp  (whole muscle, anterior view)
  plates/mus_vis_latissimus.webp                              (only the part visible from the front, for the plate)
  motion/shoulder_l<i>.webp + 'latx' rects in shoulder.json   (posed muscle, x-ray overlay, antagonist colour)
usage: python3 lat_render.py <render out dir>   (expects <out>/plates and <out>/motion from plates.py / motion_render.py)
"""
import sys, os, json, subprocess, base64; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from scipy import ndimage as ndi
from model import *
from build import muscle_meshes, bone_meshes, MUS_RED, CTX_RED
from post import load as limg, finish, save
from motion import Elem, pose_shoulder, apply, bone_elems

HERE = os.path.dirname(os.path.abspath(__file__)); RENDER = os.path.join(HERE, 'render')
OUT = sys.argv[1]; TMP = os.path.join(OUT, 'tmp_lat'); os.makedirs(TMP, exist_ok=True)
def run(scene, jobs):
    sp, jp = os.path.join(TMP, 'scene.json'), os.path.join(TMP, 'jobs.json')
    json.dump(scene, open(sp, 'w')); json.dump(jobs, open(jp, 'w'))
    subprocess.run(['node', os.path.join(RENDER, 'render.cjs'), sp, jp, TMP], check=True)
def crop(img, pad=6):
    ys, xs = np.where(img[..., 3] > 0.02); H, W = img.shape[:2]
    x0, x1, y0, y1 = max(0, xs.min() - pad), min(W, xs.max() + pad), max(0, ys.min() - pad), min(H, ys.max() + pad)
    x0 -= x0 % 2; y0 -= y0 % 2; x1 += x1 % 2; y1 += y1 % 2
    return img[y0:y1, x0:x1], (int(x0), int(y0), int(x1), int(y1))
def glow(c):
    lum = c[..., :3].mean(-1, keepdims=True); pink = np.array([1.0, 0.36, 0.52]); white = np.array([1.0, 0.92, 0.95])
    g = pink * (0.35 + 0.9 * lum) + white * np.clip(lum - 0.55, 0, 1)
    halo = ndi.gaussian_filter(c[..., 3], 5); ga = np.clip(np.maximum(c[..., 3] * 0.85, halo * 0.9), 0, 1)
    e = np.clip(halo - c[..., 3], 0, 1)[..., None]; g = g * (1 - e) + pink * e
    return np.concatenate([np.clip(g, 0, 1), ga[..., None]], -1)

# ---------------- anterior plate layers ----------------
tm, _ = muscle_meshes(TARGET, MUS_RED); cm, _ = muscle_meshes(CONTEXT, CTX_RED); bm = bone_meshes()
lm, _ = muscle_meshes({'latissimus': ['LAT3']}, MUS_RED)
allm = tm + cm + bm + lm
names = [m['name'] for m in allm]
groups = sorted(set(n.split(':')[0] if not n.startswith('bone:') else n for n in names))
def gcol(k): return [20 + (k % 6) * 44, 20 + ((k // 6) % 6) * 44, 20 + (k // 36) * 44]
PAL = {g: gcol(i) for i, g in enumerate(groups)}
IDS = {n: PAL[n if n.startswith('bone:') else n.split(':')[0]] for n in names}
MG = [g for g in groups if not g.startswith('bone:')]
VIEW = [0, 0, 760, 1260]; W, H = 1520, 2520
js = lambda nm, ms: [dict(name=nm + '_c', size=[W * 2, H * 2], view=VIEW, meshes=ms), dict(name=nm + '_d', size=[W, H], view=VIEW, meshes=ms, mode='dir'),
                     dict(name=nm + '_i', size=[W, H], view=VIEW, meshes=ms, mode='id', ids=IDS)]
if '--skip-plate' not in sys.argv:
    run(dict(meshes=allm), js('full', names) + js('lat', [m['name'] for m in lm]))
proc = lambda nm, seed: finish(limg(os.path.join(TMP, nm + '_c.png')), limg(os.path.join(TMP, nm + '_d.png')), limg(os.path.join(TMP, nm + '_i.png')), PAL, MG, seed=seed)
man = json.load(open(os.path.join(OUT, 'plates', 'plates.json')))
img, lab, lnames = proc('full', 1)
k = lnames.index('latissimus') + 1; vis = lab == k
# The model's anterior trunk wall is incomplete (gaps between ribs, no abdominal muscles), so the latissimus on the
# BACK shows through it. Keep only the part lateral to the rib cage (posterior axillary fold), which is what is
# really visible from the front.
cage_ids = [lnames.index(g) + 1 for g in lnames if g in ('bone:ribs', 'bone:cartilage', 'bone:sternum', 'intercostal', 'serratus')]
cage = ndi.binary_closing(np.isin(lab, cage_ids), iterations=6)
left = np.full(cage.shape[0], cage.shape[1]); rows = np.where(cage.any(1))[0]
left[rows] = cage[rows].argmax(1)
xs = np.arange(cage.shape[1])[None, :]
vis &= xs < left[:, None] + 4
vimg = img.copy(); vimg[..., 3] *= vis
vc, (x0, y0, x1, y1) = crop(vimg)
save(vc, os.path.join(OUT, 'plates', 'mus_vis_latissimus.webp'))
man.setdefault('overlays', {})['latissimus'] = dict(x=x0 / 2, y=y0 / 2, w=(x1 - x0) / 2, h=(y1 - y0) / 2)
v2 = ndi.binary_opening(vis, iterations=2); lb, n = ndi.label(v2); sz = ndi.sum(v2, lb, range(1, n + 1)); big = lb == (np.argmax(sz) + 1)
dt = ndi.distance_transform_edt(big); yy, xx = np.unravel_index(np.argmax(dt), dt.shape)
man['labels']['latissimus'] = dict(x=round(xx / 2, 1), y=round(yy / 2, 1), visible=int(vis.sum()))
img, _, _ = proc('lat', 20)
lc, (x0, y0, x1, y1) = crop(img)
save(lc, os.path.join(OUT, 'plates', 'mus_real_latissimus.webp')); save(glow(lc), os.path.join(OUT, 'plates', 'mus_glow_latissimus.webp'))
man['layers']['latissimus'] = dict(x=x0 / 2, y=y0 / 2, w=(x1 - x0) / 2, h=(y1 - y0) / 2)
man['licenses'] = {'default': 'BodyParts3D 4.0, (c) DBCLS, CC BY 4.0', 'latissimus': 'BodyParts3D 3.0, (c) DBCLS, CC BY-SA 2.1 JP (mus_*_latissimus)'}
json.dump(man, open(os.path.join(OUT, 'plates', 'plates.json'), 'w'), indent=1)
print('plate layers done', man['layers']['latissimus'], man['labels']['latissimus'])

if '--skip-motion' in sys.argv: sys.exit(0)
# ---------------- shoulder abduction: posed latissimus, x-ray overlays ----------------
mj = os.path.join(OUT, 'motion', 'shoulder.json'); meta = json.load(open(mj))
SC = 1.55; M = np.array([[1, 0, 0], [0, 0, 1], [0, -1, 0]], float); BOX = dict(u0=-990, u1=60, z0=640, z1=1560)   # = motion_render.py shoulder
SW = int(round((BOX['u1'] - BOX['u0']) * SC)); SH = int(round((BOX['z1'] - BOX['z0']) * SC)); SW += SW % 2; SH += SH % 2
def proj(P):
    q = P @ M.T; return np.stack([(q[:, 0] - BOX['u0']) * SC, (BOX['z1'] - q[:, 1]) * SC, q[:, 2] * SC], 1)
def enc(a, dt): return base64.b64encode(np.ascontiguousarray(a, dtype=dt).tobytes()).decode()
e = Elem('latissimus', 'LAT3')
ANT = [0.22, 0.45, 0.82]
for fi, fr in enumerate(meta['frames']):
    V, fib, _ = e.pose(pose_shoulder(fr['angle']))
    P = proj(V); P = np.stack([P[:, 0], -P[:, 1], P[:, 2]], 1)
    mesh = dict(name='lat', kind=0, base=ANT, pos=enc(P, '<f4'), fib=enc(fib @ M.T, '<f4'), ten=enc(e.ten, '<f4'), idx=enc(e.F, '<u4'))
    view = [0, 0, SW, SH]
    run(dict(meshes=[mesh]), [dict(name='l_c', size=[SW * 2, SH * 2], view=view, meshes=['lat']), dict(name='l_d', size=[SW, SH], view=view, meshes=['lat'], mode='dir'),
                              dict(name='l_i', size=[SW, SH], view=view, meshes=['lat'], mode='id', ids={'lat': [200, 200, 200]})])
    img, _, _ = finish(limg(os.path.join(TMP, 'l_c.png')), limg(os.path.join(TMP, 'l_d.png')), limg(os.path.join(TMP, 'l_i.png')), {'lat': [200, 200, 200]}, ['lat'], seed=3)
    c, (x0, y0, x1, y1) = crop(img, 4)
    save(c, os.path.join(OUT, 'motion', f'shoulder_l{fi}.webp'), q=88)
    fr['latx'] = [x0 / 2, y0 / 2, (x1 - x0) / 2, (y1 - y0) / 2]
    print('frame', fi, fr['angle'], fr['latx'], flush=True)
meta['strain_lat_note'] = 'latissimus: BodyParts3D 3.0 mesh (CC BY-SA 2.1 JP) registered to 4.0'
json.dump(meta, open(mj, 'w'), indent=1)
print('done')
