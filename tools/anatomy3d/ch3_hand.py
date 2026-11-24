"""CH3 hand & wrist art from BodyParts3D 4.0 (CC BY 4.0, (c) DBCLS).

View: PALMAR view of the RIGHT hand, fingers UP (atlas / PA radiograph convention), so the thumb (lateral) is on
the viewer's RIGHT. The hand frame is measured on the meshes: distal axis = carpus centroid -> metacarpal heads,
palmar normal = plane fit of carpals + metacarpals (pisiform side = palmar), lateral = thumb side.
Frame units: 4 per mm, origin at the top-left of the view. Every layer is rendered with the same camera, so layers
stack exactly.

Outputs (app/public/assets/ch3/):
  hand_full.webp           all hand bones + distal radius/ulna (density 1 = frame units)
  hand_rest.webp           the same without the 8 carpals (assembly background)
  car_<id>.webp            one carpal, cropped, density 2
  mc_<n>.webp              metacarpal n (1..5), cropped, density 2
  radul.webp               distal radius + ulna only, cropped, density 2
  retinac.webp             flexor retinaculum (ligament), cropped, density 2
  dec_<id>.webp            advanced decoys: navicular, cuboid of the foot (same scale, own crop)
  hand.json                frame, rects, masks, measured landmarks (frame units)
usage: python3 ch3_hand.py [--norender]
"""
import sys, os, json, subprocess
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np
from PIL import Image
from scipy.spatial import cKDTree
from model import merge, weld, subdivide, taubin, sample_surface
from build import enc

HERE = os.path.dirname(os.path.abspath(__file__)); RENDER = os.path.join(HERE, 'render')
OUT = os.path.join(HERE, '..', '..', 'app', 'public', 'assets', 'ch3')
TMP = os.path.join(HERE, 'out', 'tmp_ch3'); os.makedirs(TMP, exist_ok=True); os.makedirs(OUT, exist_ok=True)
BONE = [0.90, 0.86, 0.76]; LIG = [0.78, 0.84, 0.92]

CARPALS = {'scaphoid': 'FJ3383', 'lunate': 'FJ3374', 'triquetrum': 'FJ3390', 'pisiform': 'FJ3382',
           'trapezium': 'FJ3388', 'trapezoid': 'FJ3389', 'capitate': 'FJ3361', 'hamate': 'FJ3367'}
MC = {1: 'FJ3350', 2: 'FJ3352', 3: 'FJ3354', 4: 'FJ3356', 5: 'FJ3358'}
PH = {1: ['FJ3327', 'FJ3198'], 2: ['FJ3322', 'FJ3303', 'FJ3193'], 3: ['FJ3325', 'FJ3306', 'FJ3196'],
      4: ['FJ3326', 'FJ3292', 'FJ3197'], 5: ['FJ3323', 'FJ3304', 'FJ3194']}
RADIUS, ULNA, RETIN = 'FJ3349', 'FJ3391', 'FJ1471'
DECOYS = {'navicular': 'FJ3308', 'cuboid': 'FJ3364'}
K = 4.0                                    # frame units per mm

def prep(fids, smooth=True):
    V, F = merge(fids); V, F = weld(V, F)
    if smooth: V, F = subdivide(V, F); V = taubin(V, F, 3)
    return V, F

raw = {}
for k, f in CARPALS.items(): raw[k] = prep([f])
for n, f in MC.items(): raw[f'mc{n}'] = prep([f])
for n, fs in PH.items():
    for j, f in enumerate(fs): raw[f'ph{n}_{j}'] = prep([f])
raw['radius'] = prep([RADIUS]); raw['ulna'] = prep([ULNA]); raw['retinac'] = prep([RETIN])
for k, f in DECOYS.items(): raw[k] = prep([f])

# ---- hand frame measured on the meshes ----
cen = {k: v[0].mean(0) for k, v in raw.items()}
carp = np.array([cen[k] for k in CARPALS]); mcs = np.array([cen[f'mc{n}'] for n in range(2, 6)])
O = cen['capitate']
d = mcs.mean(0) - carp.mean(0); d /= np.linalg.norm(d)                       # distal
pts = np.concatenate([carp, mcs]); pts = pts - pts.mean(0)
n = np.linalg.svd(pts)[2][2]                                                  # plane normal
if np.dot(cen['pisiform'] - cen['triquetrum'], n) < 0: n = -n                # palmar
n -= d * np.dot(n, d); n /= np.linalg.norm(n)
lat = np.cross(d, n)
if np.dot(cen['mc1'] - O, lat) < 0: lat = -lat                               # thumb side
# screen: x = +lateral (thumb on the right), y = -distal (fingers up), depth = palmar (toward viewer)
def proj(P):
    Q = np.asarray(P, float) - O
    return np.stack([Q @ lat * K, -(Q @ d) * K, Q @ n * K], -1)

# decoys: move each foot bone next to the carpus (rigid shift, kept at its own size), facing roughly the same way
for k in DECOYS:
    V, F = raw[k]; raw[k] = (V - V.mean(0) + O, F)

allP = np.concatenate([proj(raw[k][0]) for k in raw if k not in DECOYS and k not in ('radius', 'ulna')])
x0, y0 = allP[:, 0].min() - 40, allP[:, 1].min() - 40
x1 = allP[:, 0].max() + 40
yr = proj(raw['radius'][0])[:, 1]
y1 = max(allP[:, 1].max(), 0) + 50 * K                                        # 50 mm of forearm below the carpus
def to_view(P): Q = proj(P); Q[:, 0] -= x0; Q[:, 1] -= y0; return Q
FW, FH = int(np.ceil(x1 - x0)), int(np.ceil(y1 - y0))
print('frame', FW, FH)

def entry(name, V, F, base):
    P = to_view(V); P = np.stack([P[:, 0], -P[:, 1], P[:, 2]], 1)
    z = np.zeros(len(V)); fib = np.tile([0, 0, 1.0], (len(V), 1))
    return dict(name=name, kind=1, base=base, pos=enc(P, '<f4'), fib=enc(fib, '<f4'), ten=enc(z, '<f4'), idx=enc(F, '<u4'))

meshes = [entry(k, V, F, LIG if k == 'retinac' else BONE) for k, (V, F) in raw.items()]
json.dump(dict(meshes=meshes), open(os.path.join(TMP, 'scene.json'), 'w'))

VIEW = [0, 0, FW, FH]
HAND = [k for k in raw if k not in DECOYS and k != 'retinac']
REST = [k for k in HAND if k not in CARPALS]
jobs = [dict(name='hand_full', size=[FW * 2, FH * 2], view=VIEW, meshes=HAND),
        dict(name='hand_rest', size=[FW * 2, FH * 2], view=VIEW, meshes=REST),
        dict(name='radul', size=[FW * 2, FH * 2], view=VIEW, meshes=['radius', 'ulna']),
        dict(name='retinac', size=[FW * 2, FH * 2], view=VIEW, meshes=['retinac'])]
cp = np.concatenate([to_view(raw[k][0]) for k in CARPALS])
WR = [float(cp[:, 0].min() - 22 * K), float(cp[:, 1].min() - 26 * K), float(cp[:, 0].max() + 22 * K), float(cp[:, 1].max() + 26 * K)]
WW, WH = int(WR[2] - WR[0]), int(WR[3] - WR[1])
jobs += [dict(name='wrist_full', size=[WW * 2, WH * 2], view=WR, meshes=HAND), dict(name='wrist_rest', size=[WW * 2, WH * 2], view=WR, meshes=REST),
         dict(name='wrist_carp', size=[WW * 2, WH * 2], view=WR, meshes=list(CARPALS) + ['radius', 'ulna']),
         dict(name='wrist_retinac', size=[WW * 2, WH * 2], view=WR, meshes=HAND + ['retinac'])]
jobs += [dict(name=f'car_{k}', size=[FW * 4, FH * 4], view=VIEW, meshes=[k]) for k in CARPALS]
jobs += [dict(name=f'mc_{i}', size=[FW * 4, FH * 4], view=VIEW, meshes=[f'mc{i}']) for i in MC]
jobs += [dict(name=f'dec_{k}', size=[FW * 4, FH * 4], view=VIEW, meshes=[k]) for k in DECOYS]
json.dump(jobs, open(os.path.join(TMP, 'jobs.json'), 'w'))
if '--norender' not in sys.argv:
    subprocess.run(['node', os.path.join(RENDER, 'render.cjs'), os.path.join(TMP, 'scene.json'), os.path.join(TMP, 'jobs.json'), TMP], check=True)

man = dict(frame=[FW, FH], unitsPerMm=K, view='palmar, right hand, fingers up, thumb (lateral) on the right',
           rects={}, mask={}, points={}, source='BodyParts3D 4.0 (c) DBCLS, CC BY 4.0')

def crop(name, scale_in, dens, mask=False, full=False):
    im = Image.open(os.path.join(TMP, name + '.png')).convert('RGBA')
    f = scale_in // dens
    if f > 1: im = im.resize((im.width // f, im.height // f), Image.LANCZOS)
    if full:
        im.save(os.path.join(OUT, name + '.webp'), quality=90, method=6); return
    a = np.asarray(im)[..., 3]; ys, xs = np.nonzero(a > 8)
    bx0, bx1, by0, by1 = xs.min() - 3, xs.max() + 4, ys.min() - 3, ys.max() + 4
    im.crop((bx0, by0, bx1, by1)).save(os.path.join(OUT, name + '.webp'), quality=92, method=6)
    man['rects'][name] = dict(x=round(bx0 / dens, 1), y=round(by0 / dens, 1), w=round((bx1 - bx0) / dens, 1), h=round((by1 - by0) / dens, 1))
    if mask:
        A = a[by0:by1, bx0:bx1] > 128; st = 5 * dens
        man['mask'][name] = [[round((bx0 + x) / dens, 1), round((by0 + y) / dens, 1)] for y in range(0, A.shape[0], st) for x in range(0, A.shape[1], st) if A[y, x]]

for nm in ('hand_full', 'hand_rest'): crop(nm, 2, 1, full=True)
for nm in ('wrist_full', 'wrist_rest', 'wrist_carp', 'wrist_retinac'): crop(nm, 2, 2, full=True)
man['wrist'] = dict(x=round(WR[0], 1), y=round(WR[1], 1), w=WW, h=WH, density=2)
crop('radul', 2, 2); crop('retinac', 2, 2)
for k in CARPALS: crop(f'car_{k}', 4, 2, mask=True)
for i in MC: crop(f'mc_{i}', 4, 2, mask=True)
for k in DECOYS: crop(f'dec_{k}', 4, 2)

# ---- landmarks (frame units) ----
def fr(p): q = to_view(np.asarray(p, float)[None])[0]; return [round(float(q[0]), 1), round(float(q[1]), 1)]
P = man['points']
for k in CARPALS: P[k] = fr(cen[k])
for i in MC:
    V = raw[f'mc{i}'][0]; t = (V - O) @ d
    P[f'mc{i}_base'] = fr(V[t < t.min() + 6].mean(0)); P[f'mc{i}_head'] = fr(V[t > t.max() - 6].mean(0))
trees = {k: cKDTree(sample_surface(*raw[k], step=0.7)) for k in list(CARPALS) + ['radius', 'ulna', 'mc1', 'mc2', 'mc3', 'mc4', 'mc5', 'ph2_0', 'ph2_1', 'capitate']}
def contact(a, b, thr=2.0):
    V = raw[a][0]; dd, _ = trees[b].query(V)
    if dd.min() > 6: return None
    S = V[dd < max(thr, dd.min() + 1.5)]                      # cartilage is not modelled: allow the joint gap
    return S.mean(0) if len(S) > 3 else None
for c in ('scaphoid', 'lunate', 'triquetrum'):
    p = contact('radius', c, 2.5); P[f'radius_{c}'] = fr(p) if p is not None else None
    p = contact('ulna', c, 2.5); P[f'ulna_{c}'] = fr(p) if p is not None else None
for i in MC:
    for c in ('trapezium', 'trapezoid', 'capitate', 'hamate'):
        p = contact(f'mc{i}', c, 1.6); P[f'mc{i}_{c}'] = fr(p) if p is not None else None
# palmar prominences: most palmar vertices
def palmar(k, frac=0.15):
    V = raw[k][0]; t = (V - O) @ n; return V[t > np.quantile(t, 1 - frac)].mean(0)
p = contact('mc2', 'ph2_0', 1.6); P['mcp2'] = fr(p) if p is not None else None
p = contact('ph2_0', 'ph2_1', 1.6); P['pip2'] = fr(p) if p is not None else None
p = contact('hamate', 'capitate', 1.6); P['capitate_hamate'] = fr(p) if p is not None else None
p = contact('lunate', 'capitate', 1.6); P['lunate_capitate'] = fr(p) if p is not None else None
P['hamate_hook'] = fr(palmar('hamate', 0.08)); P['scaphoid_tubercle'] = fr(palmar('scaphoid', 0.08)); P['trapezium_tubercle'] = fr(palmar('trapezium', 0.08))
for c in ('pisiform', 'hamate', 'scaphoid', 'trapezium'):
    p = contact('retinac', c, 2.5); P[f'retinac_{c}'] = fr(p) if p is not None else None
P['radius_styloid'] = fr(raw['radius'][0][np.argmax((raw['radius'][0] - O) @ d)])
P['ulna_styloid'] = fr(raw['ulna'][0][np.argmax((raw['ulna'][0] - O) @ d)])
for k, v in P.items(): print(k, v)
man['xf'] = dict(O=O.tolist(), lat=lat.tolist(), d=d.tolist(), n=n.tolist(), x0=float(x0), y0=float(y0), K=K)
json.dump(man, open(os.path.join(OUT, 'hand.json'), 'w'))
open(os.path.join(OUT, 'LICENSES.txt'), 'w').write(
    'CH3 hand/wrist images: rendered from BodyParts3D 4.0, (c) The Database Center for Life Science, CC BY 4.0\n'
    'https://creativecommons.org/licenses/by/4.0/  (tools/anatomy3d/ch3_hand.py)\n')
