"""CH1 bone art from the BodyParts3D 4.0 model (same anterior frame as the CH2 plates: 760x1260, right upper limb,
lateral = viewer's left; x = 640 + 1.75*X, y = 130 + 1.75*(1355 - Z)).

Outputs (app/public/assets/ch1/):
  bone_<id>.webp   one bone, cropped to its alpha bounds, density 2 (1 frame unit = 2 px)
  ctx.webp         context skeleton (sternum, ribs, costal cartilage, hand) for the hologram backdrop, full frame
  bones.json       { frame, density, rects: {id: {x,y,w,h}}, mask: {id: [[x,y],...]} (opaque sample points, frame
                   units, 6-unit grid, used for hit tests), landmarks: {head, glenoid, elbow, ...} }
The fibula (leg bone, advanced-mode decoy) is translated next to the forearm so it renders at the same scale.

usage: python3 ch1_bones.py [outdir]
"""
import sys, os, json, subprocess, base64
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np
from PIL import Image
from model import BONES, merge, weld, subdivide, taubin, to_frame
from build import mesh_entry

HERE = os.path.dirname(os.path.abspath(__file__)); RENDER = os.path.join(HERE, 'render')
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', '..', 'app', 'public', 'assets', 'ch1')
TMP = os.path.join(HERE, 'out', 'tmp_ch1'); os.makedirs(TMP, exist_ok=True); os.makedirs(OUT, exist_ok=True)
BONE = [0.90, 0.86, 0.76]
FIBULA = ['FJ3366']                       # right fibula
ARM = ['clavicle', 'scapula', 'humerus', 'radius', 'ulna']

def prep(fids, smooth=True):
    V, F = merge(fids); V, F = weld(V, F)
    if smooth: V, F = subdivide(V, F); V = taubin(V, F, 3)
    return V, F

meshes = []; geo = {}
for b in ARM:
    V, F = prep(BONES[b]); geo[b] = V; meshes.append(mesh_entry(f'bone:{b}', V, F, 1, BONE))
# fibula: move it (rigidly) so its top sits beside the radius head in the frame
Vf, Ff = prep(FIBULA)
rad = geo['radius']
shift = np.array([geo['humerus'][:, 0].mean() - Vf[:, 0].mean(), rad[:, 1].mean() - Vf[:, 1].mean(), rad[:, 2].max() + 20 - Vf[:, 2].max()])
Vf = Vf + shift; geo['fibula'] = Vf
meshes.append(mesh_entry('bone:fibula', Vf, Ff, 1, BONE))
CTX = ['sternum', 'ribs', 'cartilage', 'hand']
for g in CTX:
    V, F = prep(BONES[g], smooth=g not in ('ribs', 'hand')); meshes.append(mesh_entry(f'bone:{g}', V, F, 1, BONE))
scene = os.path.join(TMP, 'scene.json'); json.dump(dict(meshes=meshes), open(scene, 'w'))

VIEW = [0, 0, 760, 1260]; W, H = 1520, 2520
# fibula hangs below the frame bottom after the shift: give it a taller view
fy1 = float(to_frame(Vf)[:, 1].max()) + 20
jobs = [dict(name=b, size=[W * 2, H * 2], view=VIEW, meshes=[f'bone:{b}']) for b in ARM]
jobs.append(dict(name='fibula', size=[W * 2, int(2 * 2 * fy1)], view=[0, 0, 760, fy1], meshes=['bone:fibula']))
jobs.append(dict(name='ctx', size=[W, H], view=VIEW, meshes=[f'bone:{g}' for g in CTX]))
json.dump(jobs, open(os.path.join(TMP, 'jobs.json'), 'w'))
if '--norender' not in sys.argv:
    subprocess.run(['node', os.path.join(RENDER, 'render.cjs'), scene, os.path.join(TMP, 'jobs.json'), TMP], check=True)

man = dict(frame=[760, 1260], density=2, rects={}, mask={}, landmarks={}, source='BodyParts3D 4.0 (c) DBCLS, CC BY 4.0')
for b in ARM + ['fibula']:
    im = Image.open(os.path.join(TMP, b + '.png')).convert('RGBA')
    im = im.resize((im.width // 2, im.height // 2), Image.LANCZOS)        # 2x supersampled -> density 2
    a = np.asarray(im)[..., 3]
    ys, xs = np.nonzero(a > 8)
    x0, x1, y0, y1 = xs.min() - 4, xs.max() + 5, ys.min() - 4, ys.max() + 5
    crop = im.crop((x0, y0, x1, y1)); crop.save(os.path.join(OUT, f'bone_{b}.webp'), quality=92, method=6)
    man['rects'][b] = dict(x=round(x0 / 2, 1), y=round(y0 / 2, 1), w=round((x1 - x0) / 2, 1), h=round((y1 - y0) / 2, 1))
    # opaque sample points on a 6-unit grid (frame units) for hit tests
    A = a[y0:y1, x0:x1] > 128
    pts = [[round((x0 + x) / 2, 1), round((y0 + y) / 2, 1)] for y in range(0, A.shape[0], 12) for x in range(0, A.shape[1], 12) if A[y, x]]
    man['mask'][b] = pts
    print(b, man['rects'][b], len(pts), 'pts')
ctx = Image.open(os.path.join(TMP, 'ctx.png')).convert('RGBA'); ctx.save(os.path.join(OUT, 'ctx.webp'), quality=88, method=6)

# ---- landmarks measured on the meshes (frame coords) ----
def fr(p): q = to_frame(np.asarray(p, float)[None])[0]; return [round(float(q[0]), 1), round(float(q[1]), 1)]
hum = geo['humerus']; sca = geo['scapula']
top = hum[hum[:, 2] > hum[:, 2].max() - 45]                  # proximal 45 mm: humeral head + tubercles
# sphere fit (least squares) on the medial half of the top region = articular head
med = top[top[:, 0] > np.median(top[:, 0])]
A = np.c_[2 * med, np.ones(len(med))]; bb = (med ** 2).sum(1)
c = np.linalg.lstsq(A, bb, rcond=None)[0]; head = c[:3]; r = np.sqrt(c[3] + (head ** 2).sum())
d = np.linalg.norm(sca - head, axis=1); glen = sca[d < r + 6].mean(0)
low = hum[hum[:, 2] < hum[:, 2].min() + 25]; elbow = low.mean(0)
man['landmarks'] = dict(head=fr(head), glenoid=fr(glen), elbow=fr(elbow), headRadius=round(float(r) * 1.75, 1))
print('landmarks', man['landmarks'])
json.dump(man, open(os.path.join(OUT, 'bones.json'), 'w'))
lic = os.path.join(OUT, 'LICENSES.txt')
open(lic, 'w').write('CH1 bone images: rendered from BodyParts3D 4.0, (c) The Database Center for Life Science, CC BY 4.0\n'
                      'https://creativecommons.org/licenses/by/4.0/  (tools/anatomy3d/ch1_bones.py)\n')
