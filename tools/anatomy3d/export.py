"""Copy the rendered CH2 art into the game: plates/layers as-is, motion frames cropped to the union of their
content (same crop for every frame of a round, coordinates in the json shifted accordingly).
usage: python3 export.py <render out dir> <app/public/assets/ch2>
"""
import sys, os, json, shutil
import numpy as np
from PIL import Image

SRC, DST = sys.argv[1], sys.argv[2]
os.makedirs(os.path.join(DST, 'motion'), exist_ok=True)
for f in os.listdir(os.path.join(SRC, 'plates')):
    shutil.copy(os.path.join(SRC, 'plates', f), os.path.join(DST, f))

for rk in ['elbow', 'shoulder']:
    md = os.path.join(SRC, 'motion'); meta = json.load(open(os.path.join(md, rk + '.json')))
    names = ['n0'] + [f'r{i}' for i in range(len(meta['frames']))]
    ims = {n: Image.open(os.path.join(md, f'{rk}_{n}.webp')).convert('RGBA') for n in names}
    a = np.zeros(ims['n0'].size[::-1], bool)
    for im in ims.values(): a |= np.asarray(im)[..., 3] > 8
    ys, xs = np.where(a); pad = 24
    W, H = ims['n0'].size
    x0, y0 = max(0, xs.min() - pad), max(0, ys.min() - pad); x1, y1 = min(W, xs.max() + pad), min(H, ys.max() + pad)
    x0 -= x0 % 2; y0 -= y0 % 2; x1 += x1 % 2; y1 += y1 % 2
    for n, im in ims.items(): im.crop((x0, y0, x1, y1)).save(os.path.join(DST, 'motion', f'{rk}_{n}.webp'), quality=88, method=6)
    ox, oy = x0 / 2, y0 / 2
    sh = lambda p: [round(p[0] - ox, 1), round(p[1] - oy, 1)]
    for i, fr in enumerate(meta['frames']):
        fr['pivot'] = sh(fr['pivot']); fr['handle'] = sh(fr['handle'])
        if 'lat' in fr: fr['lat'] = [sh(p) for p in fr['lat']]
        if 'labels' in fr: fr['labels'] = {k: sh(v) for k, v in fr['labels'].items()}
        if 'xray' in fr:
            r = fr['xray']; fr['xray'] = [round(r[0] - ox, 1), round(r[1] - oy, 1), r[2], r[3]]
            shutil.copy(os.path.join(md, f'{rk}_x{i}.webp'), os.path.join(DST, 'motion', f'{rk}_x{i}.webp'))
    meta['size'] = [(x1 - x0) // 2, (y1 - y0) // 2]
    json.dump(meta, open(os.path.join(DST, 'motion', rk + '.json'), 'w'), indent=1)
    print(rk, 'crop', (x0, y0, x1, y1), 'size', meta['size'])
tot = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(DST) for f in fs)
print('total', tot // 1024, 'KB')
