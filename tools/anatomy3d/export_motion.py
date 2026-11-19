"""Motion-puzzle assets (v2): rigid-bone frames + line-of-action paths + the undeformed real-mesh frame at 0 deg.
usage: python3 export_motion.py <bones dir> <rest-mesh motion dir> <app/public/assets/ch2/motion>
  bones dir: <rk>_b<i>.webp, <rk>_bones.json (pivot/handle), <rk>_paths.json   (motion_render --bones-only, paths_render)
  rest dir : <rk>_n0.webp, <rk>_r0.webp, <rk>.json (labels at 0 deg), shoulder_x0 / shoulder_l0 (+ xray / latx rects)
All images share one crop per round (union of content), coordinates are shifted accordingly.
"""
import sys, os, json, glob
import numpy as np
from PIL import Image
BD, RD, DST = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(DST, exist_ok=True)
for f in glob.glob(os.path.join(DST, '*')): os.remove(f)
for rk in ['elbow', 'shoulder']:
    bm = json.load(open(os.path.join(BD, f'{rk}_bones.json'))); pm = json.load(open(os.path.join(BD, f'{rk}_paths.json')))
    rm = json.load(open(os.path.join(RD, f'{rk}.json')))
    n = len(bm['frames'])
    ims = {f'b{i}': Image.open(os.path.join(BD, f'{rk}_b{i}.webp')).convert('RGBA') for i in range(n)}
    ims['n0'] = Image.open(os.path.join(RD, f'{rk}_n0.webp')).convert('RGBA'); ims['r0'] = Image.open(os.path.join(RD, f'{rk}_r0.webp')).convert('RGBA')
    W, H = ims['b0'].size; assert ims['n0'].size == (W, H)
    a = np.zeros((H, W), bool)
    for im in ims.values(): a |= np.asarray(im)[..., 3] > 8
    ys, xs = np.where(a)
    pts = np.array([p for fr in pm['frames'] for pa in fr['paths'] for p in pa['pts']]) * 2
    x0 = int(max(0, min(xs.min(), pts[:, 0].min()) - 30)); y0 = int(max(0, min(ys.min(), pts[:, 1].min()) - 30))
    x1 = int(min(W, max(xs.max(), pts[:, 0].max()) + 30)); y1 = int(min(H, max(ys.max(), pts[:, 1].max()) + 30))
    x0 -= x0 % 2; y0 -= y0 % 2; x1 += x1 % 2; y1 += y1 % 2
    for k, im in ims.items(): im.crop((x0, y0, x1, y1)).save(os.path.join(DST, f'{rk}_{k}.webp'), quality=88, method=6)
    ox, oy = x0 / 2, y0 / 2
    sh = lambda p: [round(p[0] - ox, 1), round(p[1] - oy, 1)]
    meta = dict(round=rk, size=[(x1 - x0) // 2, (y1 - y0) // 2], angles=[f['angle'] for f in bm['frames']], method=pm['method'], frames=[])
    for bf, pf in zip(bm['frames'], pm['frames']):
        assert bf['angle'] == pf['angle']
        meta['frames'].append(dict(angle=bf['angle'], pivot=sh(bf['pivot']), handle=sh(bf['handle']), length=pf['length'],
                                   paths=[dict(m=p['m'], fid=p['fid'], w=p['w'], pts=[sh(q) for q in p['pts']]) for p in pf['paths']]))
    r0 = rm['frames'][0]
    rest = dict(labels={k: sh(v) for k, v in r0.get('labels', {}).items()})
    for key, img in (('xray', 'x0'), ('latx', 'l0')):
        if key in r0:
            r = r0[key]; rest[key] = [round(r[0] - ox, 1), round(r[1] - oy, 1), r[2], r[3]]
            Image.open(os.path.join(RD, f'{rk}_{img}.webp')).save(os.path.join(DST, f'{rk}_{img}.webp'), quality=88, method=6)
    meta['rest'] = rest
    json.dump(meta, open(os.path.join(DST, f'{rk}.json'), 'w'), indent=1)
    print(rk, 'crop', (x0, y0, x1, y1), 'size', meta['size'])
tot = sum(os.path.getsize(os.path.join(DST, f)) for f in os.listdir(DST))
print('motion total', tot // 1024, 'KB')
