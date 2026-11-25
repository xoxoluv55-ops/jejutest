"""CH4 mid-thigh cross-section, computed from the BodyParts3D 4.0 meshes (CC BY 4.0, (c) DBCLS).

The right thigh is cut by the horizontal plane z = Z0 (axial). Orientation follows the radiological convention
(viewed from the feet): anterior UP, the patient's right on the viewer's LEFT, so the lateral side of the right thigh
is on the LEFT and the medial side on the RIGHT.
Each mesh is intersected with the plane and filled with the even-odd rule (scanlines over the intersection segments).
Bone: the model has no marrow cavity, so the femur is drawn as a 5 mm cortical band around a marrow fill (stylised).
Skin, fat, vessels and nerves are not in the muscle/bone model and are not drawn.

Outputs: app/public/assets/ch4/section.webp (+ section.json: names, label grid (RLE), centroids, mm scale).
"""
import sys, os, json
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
from ch4_model import *

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'app', 'public', 'assets', 'ch4')
Z0 = float(sys.argv[1]) if len(sys.argv) > 1 else 590.0
R = 6.0                                   # px per mm
X0, X1, Y0, Y1 = -172.0, 0.0, -165.0, -15.0
W, H = int((X1 - X0) * R), int((Y1 - Y0) * R)

def segments(V, F, z):
    P = V[F]; d = P[:, :, 2] - z
    s = np.sign(d); s[s == 0] = 1e-9
    cross = ~((s > 0).all(1) | (s < 0).all(1))
    out = []
    for tri, dd in zip(P[cross], d[cross]):
        pts = []
        for a, b in ((0, 1), (1, 2), (2, 0)):
            if (dd[a] > 0) != (dd[b] > 0):
                t = dd[a] / (dd[a] - dd[b]); pts.append(tri[a] + t * (tri[b] - tri[a]))
        if len(pts) == 2: out.append((pts[0][:2], pts[1][:2]))
    return out

def fill(segs):
    """even-odd scanline fill in pixel space: x = (X - X0) * R, y = (Y - Y0) * R (anterior = small y = up)"""
    m = np.zeros((H, W), bool)
    if not segs: return m
    A = np.array([[(p[0] - X0) * R, (p[1] - Y0) * R, (q[0] - X0) * R, (q[1] - Y0) * R] for p, q in segs])
    for y in range(H):
        yc = y + 0.5
        ya, yb = A[:, 1], A[:, 3]
        hit = ((ya <= yc) & (yb > yc)) | ((yb <= yc) & (ya > yc))
        if not hit.any(): continue
        B = A[hit]; t = (yc - B[:, 1]) / (B[:, 3] - B[:, 1]); xs = np.sort(B[:, 0] + t * (B[:, 2] - B[:, 0]))
        for i in range(0, len(xs) - 1, 2):
            a, b = int(np.ceil(xs[i] - 0.5)), int(np.floor(xs[i + 1] - 0.5))
            if b >= a: m[y, max(a, 0):min(b + 1, W)] = True
    return m

names = [n for n in list(MUSCLES) + list(FASCIA) + ['femur']]
masks = {}
for n in names:
    V, F = raw(n)
    if V[:, 2].min() > Z0 or V[:, 2].max() < Z0: continue
    m = fill(segments(V, F, Z0))
    if m.sum() > 20: masks[n] = m
print('Z0', Z0, {k: round(v.sum() / R / R) for k, v in masks.items()}, 'mm2')

# overlapping fills (mesh interpenetration): the smaller structure wins, so a muscle enclosed by a bigger one keeps its area
order = sorted([n for n in masks if n != 'femur'], key=lambda n: masks[n].sum()) + ['femur']
lab = np.zeros((H, W), np.int16); keys = ['']
for n in order:
    if n not in masks: continue
    keys.append(n); lab[masks[n] & (lab == 0) if n not in ('femur',) else masks[n]] = len(keys) - 1

# ---------- image ----------
rng = np.random.default_rng(3)
img = np.zeros((H, W, 3), np.float32); img[:] = (0.035, 0.05, 0.07)
noise = ndi.gaussian_filter(rng.random((H, W)).astype(np.float32), 1.2)
fasc = ndi.gaussian_filter(rng.random((H, W)).astype(np.float32), 4.0)
mus = np.isin(lab, [i for i, k in enumerate(keys) if k in MUSCLES])
col_m = np.array([0.66, 0.20, 0.19])
img[mus] = col_m * (0.82 + 0.35 * (noise[mus, None] - 0.5) + 0.25 * (fasc[mus, None] - 0.5))
it = lab == keys.index('itt') if 'itt' in keys else np.zeros_like(mus)
img[it] = (0.86, 0.84, 0.78)
if 'femur' in keys:
    fm = lab == keys.index('femur')
    inner = ndi.binary_erosion(fm, iterations=int(5 * R))
    img[fm] = (0.95, 0.92, 0.84); img[inner] = (0.80, 0.62, 0.36) * (0.9 + 0.2 * noise[inner, None])
# boundaries between structures
edge = np.zeros((H, W), bool)
for sh in ((0, 1), (1, 0)):
    b = np.roll(lab, sh, (0, 1)); edge |= (lab != b)
edge = ndi.binary_dilation(edge, iterations=1)
img[edge] = img[edge] * 0.35
alpha = (lab > 0) | ndi.binary_dilation(lab > 0, iterations=3)
rgba = np.concatenate([np.clip(img, 0, 1), alpha[..., None].astype(np.float32)], -1)
Image.fromarray((rgba * 255).astype(np.uint8), 'RGBA').save(os.path.join(OUT, 'section.webp'), quality=92, method=6)

# ---------- label grid (2 px per mm) + centroids ----------
g = lab[::3, ::3]
flat = g.ravel(); rle = []; i = 0
while i < len(flat):
    j = i
    while j < len(flat) and flat[j] == flat[i]: j += 1
    rle.append([int(flat[i]), j - i]); i = j
cent = {}
for k, n in enumerate(keys):
    if not n: continue
    m = lab == k
    if m.sum() < 20: continue
    dt = ndi.distance_transform_edt(m); y, x = np.unravel_index(np.argmax(dt), dt.shape)
    cent[n] = dict(x=round(x / R, 1), y=round(y / R, 1), area=round(float(m.sum()) / R / R))
json.dump(dict(z=Z0, pxPerMm=R, w=W, h=H, mm=[X0, Y0], names=keys, grid=dict(w=g.shape[1], h=g.shape[0], step=3, rle=rle), centre=cent,
               orient='axial, viewed from below: anterior up, lateral (patient right) on the left'),
          open(os.path.join(OUT, 'section.json'), 'w'))
print('section', W, H, 'labels', keys)
