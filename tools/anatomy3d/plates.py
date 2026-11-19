"""Render + post-process the anterior CH2 plates and per-muscle layers.
usage: python3 plates.py <outdir>
"""
import sys, os, json, subprocess; sys.path.insert(0, os.path.dirname(__file__))
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from post import load, finish, save, id_map
from model import TARGET

HERE = os.path.dirname(os.path.abspath(__file__)); RENDER = os.path.join(HERE, 'render')
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'out', 'plates')
os.makedirs(OUT, exist_ok=True)
SCENE = os.path.join(HERE, 'out', 'scene_ant.json')
names = [m['name'] for m in json.load(open(SCENE))['meshes']]
groups = sorted(set(n.split(':')[0] if not n.startswith('bone:') else n for n in names))
def gcol(k): return [20 + (k % 6) * 44, 20 + ((k // 6) % 6) * 44, 20 + (k // 36) * 44]
PAL = {g: gcol(i) for i, g in enumerate(groups)}
def grp(n): return n if n.startswith('bone:') else n.split(':')[0]
IDS = {n: PAL[grp(n)] for n in names}
MUSCLE_GROUPS = [g for g in groups if not g.startswith('bone:')]
VIEW = [0, 0, 760, 1260]; W, H = 1520, 2520
TMP = os.path.join(HERE, 'out', 'tmp_ant'); os.makedirs(TMP, exist_ok=True)

def jobset(name, meshes):
    return [dict(name=name + '_c', size=[W * 2, H * 2], view=VIEW, meshes=meshes),
            dict(name=name + '_d', size=[W, H], view=VIEW, meshes=meshes, mode='dir'),
            dict(name=name + '_i', size=[W, H], view=VIEW, meshes=meshes, mode='id', ids=IDS)]

bones = [n for n in names if n.startswith('bone:')]
jobs = []
jobs += jobset('full', names)
jobs += jobset('bones', bones)
for m in TARGET:
    jobs += jobset('m_' + m, [n for n in names if n.startswith(m + ':')])
json.dump(jobs, open(os.path.join(TMP, 'jobs.json'), 'w'))
if '--norender' not in sys.argv:
    subprocess.run(['node', os.path.join(RENDER, 'render.cjs'), SCENE, os.path.join(TMP, 'jobs.json'), TMP], check=True)

def proc(name, seed):
    c = load(os.path.join(TMP, name + '_c.png')); d = load(os.path.join(TMP, name + '_d.png')); i = load(os.path.join(TMP, name + '_i.png'))
    return finish(c, d, i, PAL, MUSCLE_GROUPS, seed=seed)

man = {'frame': [760, 1260], 'density': 2, 'layers': {}, 'labels': {}}
img, lab, lnames = proc('full', 1)
save(img, os.path.join(OUT, 'plate_full.webp'))
# visible region of each target in the full plate -> label anchor (deepest interior point)
for m in TARGET:
    k = lnames.index(m) + 1 if m in lnames else None
    vis = (lab == k)
    vis = ndi.binary_opening(vis, iterations=2)
    if vis.sum() < 50: man['labels'][m] = None; continue
    lbl, n = ndi.label(vis); sizes = ndi.sum(vis, lbl, range(1, n + 1)); big = lbl == (np.argmax(sizes) + 1)
    dt = ndi.distance_transform_edt(big); y, x = np.unravel_index(np.argmax(dt), dt.shape)
    man['labels'][m] = dict(x=round(x / 2, 1), y=round(y / 2, 1), visible=int(vis.sum()))
img, _, _ = proc('bones', 2)
save(img, os.path.join(OUT, 'plate_bones.webp'))
for j, m in enumerate(TARGET):
    img, lab, _ = proc('m_' + m, 10 + j)
    a = img[..., 3]
    ys, xs = np.where(a > 0.02)
    pad = 6
    x0, x1 = max(0, xs.min() - pad), min(W, xs.max() + pad); y0, y1 = max(0, ys.min() - pad), min(H, ys.max() + pad)
    x0 -= x0 % 2; y0 -= y0 % 2; x1 += x1 % 2; y1 += y1 % 2
    crop = img[y0:y1, x0:x1]
    save(crop, os.path.join(OUT, f'mus_real_{m}.webp'))
    # glow: luminance-preserving pink + soft outer halo
    lum = crop[..., :3].mean(-1, keepdims=True)
    pink = np.array([1.0, 0.36, 0.52]); white = np.array([1.0, 0.92, 0.95])
    g = pink * (0.35 + 0.9 * lum) + white * np.clip(lum - 0.55, 0, 1)
    halo = ndi.gaussian_filter(crop[..., 3], 5)
    ga = np.clip(np.maximum(crop[..., 3] * 0.85, halo * 0.9), 0, 1)
    edge = np.clip(halo - crop[..., 3], 0, 1)[..., None]
    g = g * (1 - edge) + pink * edge
    save(np.concatenate([np.clip(g, 0, 1), ga[..., None]], -1), os.path.join(OUT, f'mus_glow_{m}.webp'))
    man['layers'][m] = dict(x=x0 / 2, y=y0 / 2, w=(x1 - x0) / 2, h=(y1 - y0) / 2)
json.dump(man, open(os.path.join(OUT, 'plates.json'), 'w'), indent=1)
print(json.dumps(man, indent=1))
