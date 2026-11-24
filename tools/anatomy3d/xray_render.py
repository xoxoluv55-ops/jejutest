"""Simulated AP shoulder radiograph computed from the BodyParts3D 4.0 bone meshes (NOT a patient X-ray).

Each pixel = attenuation of a parallel ray through the bones (anterior -> posterior, orthographic):
  path length through a mesh = sum over the triangles it crosses of (front-face depth - back-face depth)
  bone density model: cortical shell (outer surface minus a surface offset 2.2 mm inward) = 1.0,
                      cancellous interior = 0.32  ->  bright cortical margins, darker medullary cavity
  intensity = 1 - exp(-mu * density-weighted path)  + faint soft-tissue envelope + film grain
Frame = the CH1 anterior frame (x = 640 + 1.75 X, y = 130 + 1.75 (1355 - Z)), cropped to WIN, density 2.
Outputs app/public/assets/ch1/xray.webp and adds {"xray": {"rect": WIN}} to bones.json.
"""
import sys, os, json
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np
from PIL import Image, ImageFilter
from model import BONES, merge, weld, subdivide, taubin, to_frame

OUTD = os.path.join(os.path.dirname(__file__), '..', '..', 'app', 'public', 'assets', 'ch1')
WIN = dict(x=190, y=60, w=500, h=500)
D = 2                                   # px per frame unit
W, H = WIN['w'] * D, WIN['h'] * D
S = 1.75                                # frame units per mm

def mesh(b, sub):
    V, F = merge(BONES[b]); V, F = weld(V, F)
    if sub: V, F = subdivide(V, F); V = taubin(V, F, 3)
    return V, F

def vnormals(V, F):
    n = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
    N = np.zeros_like(V); np.add.at(N, F[:, 0], n); np.add.at(N, F[:, 1], n); np.add.at(N, F[:, 2], n)
    return N / (np.linalg.norm(N, axis=1, keepdims=True) + 1e-12)

def thickness(V, F):
    """signed-depth accumulation: front faces add z, back faces subtract z (z towards the viewer)"""
    P = to_frame(V)
    X = (P[:, 0] - WIN['x']) * D; Y = (P[:, 1] - WIN['y']) * D; Z = P[:, 2] / S     # depth in mm
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
        # screen y points down, so a counter-clockwise (in screen) triangle faces the viewer when area < 0
        sgn = 1.0 if area[i] < 0 else -1.0
        acc[y0:y1 + 1, x0:x1 + 1][inside] += sgn * z[inside]
    return acc

def bone_density(b, sub=True, shell=2.2):
    V, F = mesh(b, sub)
    outer = thickness(V, F)
    Vi = V - vnormals(V, F) * shell
    inner = np.clip(thickness(Vi, F), 0, None)
    outer = np.abs(outer)
    inner = np.minimum(inner, outer)
    return (outer - inner) * 1.0 + inner * 0.32

dens = np.zeros((H, W))
WEIGHT = {'ribs': 0.5, 'sternum': 0.6}   # thin flat bones of the chest wall show fainter than the limb bones
for b, sub in [('humerus', True), ('scapula', True), ('clavicle', True), ('sternum', False), ('ribs', False)]:
    d = bone_density(b, sub, shell=1.4 if b == 'ribs' else 2.2) * WEIGHT.get(b, 1.0)
    print(b, 'max path', round(float(d.max()), 1))
    dens += d
# soft tissue: a smooth envelope around the bones (shoulder and chest wall), very faint
env = Image.fromarray((np.clip(dens, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(70))
soft = np.asarray(env, float) / 255
img = 1 - np.exp(-0.085 * dens)
img = 0.06 + 0.10 * np.clip(soft * 3, 0, 1) + 0.84 * img
rng = np.random.default_rng(7)
img += rng.normal(0, 0.018, img.shape)
img = np.clip(img, 0, 1)
im = Image.fromarray((img * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
im = Image.merge('RGB', (im.point(lambda v: v * 0.93), im.point(lambda v: v * 0.98), im))
im.save(os.path.join(OUTD, 'xray.webp'), quality=88, method=6)
man = json.load(open(os.path.join(OUTD, 'bones.json')))
man['xray'] = dict(rect=WIN, note='simulated radiograph computed from BodyParts3D 4.0 meshes (tools/anatomy3d/xray_render.py), not a patient image')
json.dump(man, open(os.path.join(OUTD, 'bones.json'), 'w'))
print('saved', im.size)
