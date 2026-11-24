"""Simulated PA hand/wrist radiograph computed from the BodyParts3D 4.0 bone meshes (NOT a patient X-ray).
Same method as xray_render.py (signed-depth thickness; cortical shell = 1.0, cancellous interior = 0.32), but in the
CH3 hand frame (hand.json 'xf': palmar view, fingers up, thumb on the right).
Output: app/public/assets/ch3/xray_hand.webp (density 2 over the whole hand frame) + hand.json 'xray'.
"""
import sys, os, json
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np
from PIL import Image, ImageFilter
from model import merge, weld, subdivide, taubin

OUTD = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'app', 'public', 'assets', 'ch3')
man = json.load(open(os.path.join(OUTD, 'hand.json')))
xf = man['xf']; O, LAT, DIS, NRM = (np.array(xf[k]) for k in ('O', 'lat', 'd', 'n')); K = xf['K']
FW, FH = man['frame']; D = 2; W, H = FW * D, FH * D
IDS = ['FJ3383', 'FJ3374', 'FJ3390', 'FJ3382', 'FJ3388', 'FJ3389', 'FJ3361', 'FJ3367',
       'FJ3350', 'FJ3352', 'FJ3354', 'FJ3356', 'FJ3358',
       'FJ3327', 'FJ3198', 'FJ3322', 'FJ3303', 'FJ3193', 'FJ3325', 'FJ3306', 'FJ3196', 'FJ3326', 'FJ3292', 'FJ3197', 'FJ3323', 'FJ3304', 'FJ3194',
       'FJ3349', 'FJ3391']

def proj(V):
    Q = V - O
    return np.stack([(Q @ LAT * K - xf['x0']) * D, (-(Q @ DIS) * K - xf['y0']) * D, Q @ NRM], -1)   # depth in mm

def vnormals(V, F):
    n = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
    N = np.zeros_like(V); np.add.at(N, F[:, 0], n); np.add.at(N, F[:, 1], n); np.add.at(N, F[:, 2], n)
    return N / (np.linalg.norm(N, axis=1, keepdims=True) + 1e-12)

def thickness(V, F):
    P = proj(V); X, Y, Z = P[:, 0], P[:, 1], P[:, 2]
    acc = np.zeros((H, W))
    a, b, c = F[:, 0], F[:, 1], F[:, 2]
    ax, ay, bx, by, cx, cy = X[a], Y[a], X[b], Y[b], X[c], Y[c]
    area = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay)
    for i in np.nonzero(np.abs(area) > 1e-9)[0]:
        x0 = max(int(np.floor(min(ax[i], bx[i], cx[i]))), 0); x1 = min(int(np.ceil(max(ax[i], bx[i], cx[i]))), W - 1)
        y0 = max(int(np.floor(min(ay[i], by[i], cy[i]))), 0); y1 = min(int(np.ceil(max(ay[i], by[i], cy[i]))), H - 1)
        if x1 < x0 or y1 < y0: continue
        gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        w0 = ((bx[i] - gx) * (cy[i] - gy) - (cx[i] - gx) * (by[i] - gy)) / area[i]
        w1 = ((cx[i] - gx) * (ay[i] - gy) - (ax[i] - gx) * (cy[i] - gy)) / area[i]
        w2 = 1 - w0 - w1
        inside = (w0 >= 0) & (w1 >= 0) & (w2 >= 0)
        if not inside.any(): continue
        z = w0 * Z[a[i]] + w1 * Z[b[i]] + w2 * Z[c[i]]
        acc[y0:y1 + 1, x0:x1 + 1][inside] += z[inside] * (1.0 if area[i] < 0 else -1.0)
    return np.abs(acc)

dens = np.zeros((H, W))
for fid in IDS:
    V, F = merge([fid]); V, F = weld(V, F); V, F = subdivide(V, F); V = taubin(V, F, 3)
    outer = thickness(V, F); inner = np.minimum(thickness(V - vnormals(V, F) * 1.6, F), outer)
    dens += (outer - inner) + inner * 0.32
    print(fid, round(float(dens.max()), 1))
env = Image.fromarray((np.clip(dens, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(28))
soft = np.asarray(env, float) / 255
img = 1 - np.exp(-0.11 * dens)
img = 0.05 + 0.13 * np.clip(soft * 2.5, 0, 1) + 0.82 * img
img += np.random.default_rng(7).normal(0, 0.016, img.shape)
im = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
im = Image.merge('RGB', (im.point(lambda v: v * 0.93), im.point(lambda v: v * 0.98), im))
im.save(os.path.join(OUTD, 'xray_hand.webp'), quality=86, method=6)
man['xray'] = dict(density=D, note='simulated radiograph computed from BodyParts3D 4.0 meshes (tools/anatomy3d/ch3_xray.py), not a patient image')
json.dump(man, open(os.path.join(OUTD, 'hand.json'), 'w'))
print('saved', im.size)
