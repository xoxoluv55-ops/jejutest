"""CH4 muscle scanner (LOCK 1): which muscle is visible at each point of the full anterior / posterior plates.

Reads the id renders written by ch4_art.py (out/tmp_ch4/<view>_full_i.png, same camera and size as <view>_full.webp)
and exports, per view:
  scan.json            label grid (RLE, every 2nd plate pixel), name list, label anchor (deepest point of the
                       largest visible piece) and visible area of each muscle
  vis_<view>_<m>.webp  white silhouette of the VISIBLE part of muscle m (cropped; rect in scan.json, density 2) for
                       the candidate glow
usage: python3 ch4_labels.py   (after ch4_art.py)
"""
import sys, os, json
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from ch4_model import MUSCLES, FASCIA, BONES, DISCS
from post import load, id_map

HERE = os.path.dirname(os.path.abspath(__file__)); TMP = os.path.join(HERE, 'out', 'tmp_ch4')
OUT = os.path.join(HERE, '..', '..', 'app', 'public', 'assets', 'ch4')
BONE_NAMES = list(BONES) + list(DISCS); MUS_NAMES = list(MUSCLES) + list(FASCIA)
ms = BONE_NAMES + MUS_NAMES                       # same order as ch4_art.add() for <view>_full
ids = {m: [20 + (k % 6) * 44, 20 + ((k // 6) % 6) * 44, 20 + (k // 36) * 44] for k, m in enumerate(ms)}
WANT = {'ant': ['sartorius', 'rf', 'vl', 'vm', 'al', 'gracilis', 'tfl', 'pectineus', 'psoas', 'iliacus', 'gmed'],
        'post': ['gmax', 'gmed', 'bfl', 'bfs', 'st', 'sm', 'gracilis', 'am', 'vl', 'itt']}
out = {'density': 2, 'views': {}}
for view, want in WANT.items():
    img = load(os.path.join(TMP, f'{view}_full_i.png'))
    lab, names = id_map(img, ids)
    H, W = lab.shape
    keep = {}
    vis = np.zeros_like(lab)
    for m in want:
        k = names.index(m) + 1
        msk = ndi.binary_opening(lab == k, iterations=2)
        if msk.sum() < 200: continue
        keep[m] = msk; vis[msk] = len(keep)
    order = list(keep)
    g = vis[::2, ::2].ravel(); rle = []; i = 0
    while i < len(g):
        j = i
        while j < len(g) and g[j] == g[i]: j += 1
        rle.append([int(g[i]), j - i]); i = j
    info = {}
    for m, msk in keep.items():
        lb, n = ndi.label(msk); sz = ndi.sum(msk, lb, range(1, n + 1)); big = lb == (np.argmax(sz) + 1)
        dt = ndi.distance_transform_edt(big); y, x = np.unravel_index(np.argmax(dt), dt.shape)
        ys, xs = np.nonzero(msk); x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        a = np.zeros((y1 - y0, x1 - x0, 4), np.uint8); a[..., :3] = 255; a[..., 3] = (ndi.gaussian_filter(msk[y0:y1, x0:x1].astype(float), 1.0) * 255).astype(np.uint8)
        Image.fromarray(a, 'RGBA').save(os.path.join(OUT, f'vis_{view}_{m}.webp'), quality=80, method=6)
        info[m] = dict(x=round(x / 2, 1), y=round(y / 2, 1), area=int(msk.sum()), rect=dict(x=x0 / 2, y=y0 / 2, w=(x1 - x0) / 2, h=(y1 - y0) / 2))
    out['views'][view] = dict(w=W // 2, h=H // 2, names=[''] + order, grid=dict(w=(W + 1) // 2, h=(H + 1) // 2, step=1, rle=rle), muscles=info)
    print(view, {m: v['area'] for m, v in info.items()})
json.dump(out, open(os.path.join(OUT, 'scan.json'), 'w'))
