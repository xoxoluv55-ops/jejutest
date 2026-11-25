"""CH5 nerve-lab art from the Z-Anatomy models (CC BY-SA 4.0; derived from BodyParts3D (c) DBCLS). See ch5_model.py.

Views (frame unit = 1 mm): aant / apost = right upper limb + brachial plexus from the front / back,
lant / lpost = right lower limb from the front / back (ch4_model AXES 'ant' / 'post').
Plates are composites of three renders: bones, muscles (laid over the bones at 50 % so the nerves read through them),
nerves (rendered with the bones as occluders, so a nerve behind a bone is hidden; nerves are drawn above the muscles).

Outputs (app/public/assets/ch5/):
  <v>_full.webp   bones + muscles (50 %) + nerves          <v>_rest.webp  bones + muscles, no nerves (assembly board)
  core_<id>.webp  one nerve (bone-occluded) in its view, cropped (assembly piece / inventory)
  hum_close, hand_close, knee_close  device close-ups (bones + nerves, muscles faint)
  scan.json       visible-nerve label grids of the 3 scanner plates;  nerve.json  views, rects, regions, measured points
usage: python3 ch5_art.py [--norender]
"""
import sys, os, json, subprocess
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from ch5_model import *
from build import enc
from post import load as pload, finish, id_map

HERE = os.path.dirname(os.path.abspath(__file__)); RENDER = os.path.join(HERE, 'render')
OUT = os.path.join(HERE, '..', '..', 'app', 'public', 'assets', 'ch5')
TMP = os.path.join(HERE, 'out', 'tmp_ch5'); os.makedirs(TMP, exist_ok=True); os.makedirs(OUT, exist_ok=True)
NORENDER = '--norender' in sys.argv
MUS_RED = [0.70, 0.17, 0.17]; BONE = [0.90, 0.86, 0.76]; NERVE = [1.0, 0.86, 0.30]

ARM_B = ['clavicle', 'scapula', 'humerus', 'radius', 'ulna', 'hand', 'cspine', 'ribs']
LEG_B = ['hip', 'sacrum', 'femur', 'patella', 'tibia', 'fibula', 'foot', 'lspine']
ARM_N = ['musculocutaneous', 'axillary', 'radial', 'median', 'ulnar', 'plexus']
LEG_N = ['femoral', 'obturator', 'sciatic', 'tibial', 'fibular']
ARM_M = [m for m in MUSCLES if m in ARM_MUS]; LEG_M = [m for m in MUSCLES if m in LEG_MUS]

def pts_of(names): return np.concatenate([raw(n)[0] for n in names])
armP = pts_of(ARM_B + ['plexus']); legP = pts_of(LEG_B); legP = legP[legP[:, 2] > 40]
VIEWS = {'aant': View('ant', 1.0, armP, 14), 'apost': View('post', 1.0, armP, 14), 'lant': View('ant', 1.0, legP, 14), 'lpost': View('post', 1.0, legP, 14)}
for k, v in VIEWS.items(): print(k, v.W, v.H)
# nerves drawn on each view: only those lying on that side of the limb (a posterior nerve is not shown through the front view)
GROUP = {'aant': (ARM_B, ARM_M, ['plexus', 'musculocutaneous', 'median', 'ulnar', 'radial']), 'apost': (ARM_B, ARM_M, ['plexus', 'axillary', 'radial', 'ulnar']),
         'lant': (LEG_B, LEG_M, ['femoral', 'obturator', 'fibular']), 'lpost': (LEG_B, LEG_M, ['sciatic', 'tibial', 'fibular'])}
DENS = {'aant': 2, 'apost': 2, 'lant': 1.5, 'lpost': 1.5}

def entry(vw, n):
    V, F = smooth(n)
    if n in MUSCLES:
        c = V.mean(0); a = np.linalg.svd(V - c, full_matrices=False)[2][0]
        fib = np.tile(a, (len(V), 1)); kind, base = 0, MUS_RED
    else:
        fib = np.tile([0, 0, 1.0], (len(V), 1)); kind = 1; base = NERVE if n in NERVES else BONE
    return dict(name=n, kind=kind, base=base, tcol=[0.93, 0.89, 0.80], pos=enc(vw.to_render(V), '<f4'), fib=enc(vw.dir_render(fib), '<f4'),
                ten=enc(np.zeros(len(V)), '<f4'), idx=enc(F, '<u4'))

scenes = {v: {} for v in VIEWS}; jobs = {v: [] for v in VIEWS}; POST = {}
def add(view, name, meshes, rect=None, dens=None, occ=()):
    vw = VIEWS[view]; dens = dens or DENS[view]
    for m in list(meshes) + list(occ):
        if m not in scenes[view]: scenes[view][m] = entry(vw, m)
    r = rect or [0, 0, vw.W, vw.H]
    W, H = int(round((r[2] - r[0]) * dens)), int(round((r[3] - r[1]) * dens))
    ms = list(meshes) + list(occ)
    ids = {m: [20 + (k % 6) * 44, 20 + ((k // 6) % 6) * 44, 20 + (k // 36) * 44] for k, m in enumerate(ms)}
    base = dict(view=r, meshes=ms, occluders=list(occ))
    jobs[view] += [dict(name=name + '_c', size=[W * 2, H * 2], **base), dict(name=name + '_d', size=[W, H], mode='dir', **base),
                   dict(name=name + '_i', size=[W, H], mode='id', ids=ids, **base)]
    POST[name] = dict(view=view, rect=r, dens=dens, ids=ids, mus=[m for m in ms if m in MUSCLES and m not in occ])

def rect_z(view, zlo, zhi, names, pad=14):
    vw = VIEWS[view]; P = pts_of(names); P = P[(P[:, 2] > zlo) & (P[:, 2] < zhi)]; Q = vw.proj(P)
    return [float(max(0, Q[:, 0].min() - pad)), float(max(0, Q[:, 1].min() - pad)), float(min(vw.W, Q[:, 0].max() + pad)), float(min(vw.H, Q[:, 1].max() + pad))]

for v, (B, M, N) in GROUP.items():
    add(v, f'{v}_b', B); add(v, f'{v}_m', B + M); add(v, f'{v}_n', N, occ=B)
CORE = {'musculocutaneous': 'aant', 'median': 'aant', 'ulnar': 'aant', 'axillary': 'apost', 'radial': 'apost', 'femoral': 'lant', 'sciatic': 'lpost', 'fibular': 'lpost'}
for c, v in CORE.items():
    add(v, f'core_{c}', [c] + (['tibial'] if c == 'sciatic' else []), occ=GROUP[v][0])
# close-ups
CLOSE = {'hum': ('apost', 1040, 1430, ['humerus', 'scapula'], 2.5), 'hand': ('aant', 680, 900, ['hand', 'radius', 'ulna'], 3.0),
         'knee': ('lpost', 300, 1000, ['femur', 'tibia', 'fibula'], 2.0), 'elbow': ('aant', 1000, 1180, ['humerus', 'radius', 'ulna'], 3.0),
         'pknee': ('lant', 330, 500, ['femur', 'tibia', 'fibula', 'patella'], 3.0)}
for k, (v, zlo, zhi, nm, d) in CLOSE.items():
    r = rect_z(v, zlo, zhi, nm, 24); B, M, N = GROUP[v]
    add(v, f'{k}_b', B, r, d); add(v, f'{k}_m', B + M, r, d); add(v, f'{k}_n', N, r, d, occ=B)

for v in VIEWS:
    sf = os.path.join(TMP, f'scene_{v}.json'); jf = os.path.join(TMP, f'jobs_{v}.json')
    json.dump(dict(meshes=list(scenes[v].values())), open(sf, 'w')); json.dump(jobs[v], open(jf, 'w'))
    ONLY = os.environ.get('ONLY')
    if ONLY:
        import re; js = [j for j in jobs[v] if re.search(ONLY, j['name'])]
        if not js: continue
        json.dump(js, open(jf, 'w'))
    if not NORENDER: subprocess.run(['node', os.path.join(RENDER, 'render.cjs'), sf, jf, TMP], check=True)

# ---------------- post ----------------
man = dict(source='Z-Anatomy (CC BY-SA 4.0), derived from BodyParts3D (c) DBCLS', views={k: v.info() for k, v in VIEWS.items()}, rects={}, regions={}, points={})
def proc(name):
    p = POST[name]
    c = pload(os.path.join(TMP, name + '_c.png')); d = pload(os.path.join(TMP, name + '_d.png')); i = pload(os.path.join(TMP, name + '_i.png'))
    return finish(c, d, i, p['ids'], p['mus'], outline=True, seed=abs(hash(name)) % 97)
def over(top, bot, k=1.0):
    a = top[..., 3:4] * k; rgb = top[..., :3] * a + bot[..., :3] * bot[..., 3:4] * (1 - a)
    A = a + bot[..., 3:4] * (1 - a); return np.concatenate([rgb / np.maximum(A, 1e-4), A], -1)
def nerve_layer(img, lab, grow=1):
    """nerves are a few px wide at plate scale: widened by `grow` px (colour of the nearest nerve pixel, brightened),
    a thin dark rim and a soft glow so they read on bone and muscle alike (stylised for visibility)"""
    m = lab > 0
    if grow:
        _, (iy, ix) = ndi.distance_transform_edt(~m, return_indices=True)
        wide = ndi.binary_dilation(m, iterations=grow)
        out = img[iy, ix].copy(); out[~wide, 3] = 0; m = wide
    else: out = img.copy()
    rgb = out[..., :3]; out[..., :3] = np.clip(rgb * 1.25 + np.array([0.06, 0.04, 0.0]), 0, 1)
    rim = ndi.binary_dilation(m, iterations=1) & ~m
    out[rim] = [0.16, 0.10, 0.02, 0.7]
    glow = ndi.gaussian_filter(m.astype(np.float32), 2.5) * 0.45
    g = np.zeros_like(img); g[..., :3] = [1.0, 0.88, 0.35]; g[..., 3] = glow * ~ndi.binary_dilation(m, iterations=1)
    return over(out, g)
def composite(prefix, mus_alpha=0.45, nerves=True, grow=2):
    b, _, _ = proc(prefix + '_b'); m, mlab, mn = proc(prefix + '_m')
    mm = np.isin(mlab, [k + 1 for k, n in enumerate(mn) if n in MUSCLES])
    mus = m.copy(); mus[..., 3] = np.where(mm, m[..., 3] * mus_alpha, 0)
    out = over(mus, b)
    if not nerves: return out, None, None
    n, nlab, nn = proc(prefix + '_n')
    return over(nerve_layer(n, nlab, grow), out), nlab, nn
def save(name, img, q=90):
    Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8), 'RGBA').save(os.path.join(OUT, name + '.webp'), quality=q, method=6)
def region(name, src):
    p = POST[src]; r = p['rect']; man['regions'][name] = dict(view=p['view'], x=r[0], y=r[1], w=r[2] - r[0], h=r[3] - r[1], density=p['dens'])

SCAN = {}
for v in VIEWS:
    full, nlab, nn = composite(v); save(f'{v}_full', full); region(f'{v}_full', f'{v}_b')
    rest, _, _ = composite(v, nerves=False); save(f'{v}_rest', rest); region(f'{v}_rest', f'{v}_b')
    SCAN[v] = (nlab, nn)
for k in CLOSE:
    img, _, _ = composite(k, 0.35, grow=1); save(f'{k}_close', img, 92); region(f'{k}_close', f'{k}_b')
for c, v in CORE.items():
    img, lab, _ = proc(f'core_{c}'); img = nerve_layer(img, lab, 2)
    a = img[..., 3]; ys, xs = np.nonzero(a > 0.03); H, W = a.shape
    x0, x1, y0, y1 = max(0, xs.min() - 4), min(W, xs.max() + 5), max(0, ys.min() - 4), min(H, ys.max() + 5)
    save(f'core_{c}', img[y0:y1, x0:x1], 92); p = POST[f'core_{c}']; dn = p['dens']
    man['rects'][f'core_{c}'] = dict(view=v, x=round(x0 / dn, 1), y=round(y0 / dn, 1), w=round((x1 - x0) / dn, 1), h=round((y1 - y0) / dn, 1), density=dn)

# scanner label grids (visible nerve per pixel, every 2nd px of the plate image)
WANT = {'aant': ['musculocutaneous', 'median', 'ulnar', 'radial', 'axillary', 'plexus'], 'lant': ['femoral', 'obturator', 'fibular', 'tibial'],
        'lpost': ['sciatic', 'tibial', 'fibular']}
scan = {'views': {}}
for v, want in WANT.items():
    lab, names = SCAN[v]; dn = DENS[v]; keep = {}
    vis = np.zeros_like(lab)
    for m in want:
        if m not in names: continue
        msk = ndi.binary_dilation(lab == names.index(m) + 1, iterations=3)          # thin nerves: a finger-friendly hit band
        msk &= vis == 0
        if msk.sum() < 60: continue
        keep[m] = msk; vis[msk] = len(keep)
    g = vis[::2, ::2].ravel(); rle = []; i = 0
    while i < len(g):
        j = i
        while j < len(g) and g[j] == g[i]: j += 1
        rle.append([int(g[i]), j - i]); i = j
    info = {}
    for m, msk in keep.items():
        lb, n = ndi.label(msk); sz = ndi.sum(msk, lb, range(1, n + 1)); big = lb == (np.argmax(sz) + 1)
        ys, xs = np.nonzero(big); k = np.argmin(np.abs(ys - np.median(ys)) + np.abs(xs - np.median(xs)) * 0.2)
        ys2, xs2 = np.nonzero(msk)
        anc = []                                       # badge anchors along the nerve (10..90 % of its height), so badges can avoid each other
        for f in (0.12, 0.3, 0.5, 0.7, 0.88):
            yy = ys.min() + f * (ys.max() - ys.min()); j = np.argmin(np.abs(ys - yy) + 0.05 * np.abs(xs - np.median(xs)))
            anc.append([round(xs[j] / dn, 1), round(ys[j] / dn, 1)])
        info[m] = dict(x=round(xs[k] / dn, 1), y=round(ys[k] / dn, 1), area=int(msk.sum()), anchors=anc,
                       rect=dict(x=round(xs2.min() / dn, 1), y=round(ys2.min() / dn, 1), w=round((xs2.max() - xs2.min() + 1) / dn, 1), h=round((ys2.max() - ys2.min() + 1) / dn, 1)))
        a = np.zeros((ys2.max() - ys2.min() + 1, xs2.max() - xs2.min() + 1, 4), np.uint8); a[..., :3] = 255
        a[..., 3] = (ndi.gaussian_filter(msk[ys2.min():ys2.max() + 1, xs2.min():xs2.max() + 1].astype(float), 1.0) * 255).astype(np.uint8)
        Image.fromarray(a, 'RGBA').save(os.path.join(OUT, f'vis_{v}_{m}.webp'), quality=80, method=6)
    H, W = lab.shape
    scan['views'][v] = dict(density=dn, names=[''] + list(keep), grid=dict(w=(W + 1) // 2, h=(H + 1) // 2, step=2 / dn, rle=rle), nerves=info)
    print('scan', v, {m: v2['area'] for m, v2 in info.items()})
json.dump(scan, open(os.path.join(OUT, 'scan.json'), 'w'))

# ---------------- measured points ----------------
import za
def nv(part): return conv(za.mesh('nerv', part)[0])
def contact_pts(part, bone, thr):
    V = nv(part); d, _ = tree(bone).query(V); return V[d < thr]
hum = raw('humerus')[0]; tib = raw('tibia')[0]; pat = raw('patella')[0]; rad = raw('radius')[0]
sci = nv('Sciatic_nerver'); fem = nv('Femoral_nerver'); med = nv('Median_nerver')
handz = raw('hand')[0][:, 2].max()
bic = raw('Long_head_of_biceps_brachiir')[0] if 'Long_head_of_biceps_brachiir' in MUSCLES else None
def near(V, b, k=40):
    d, _ = tree(b).query(V); return V[np.argsort(d)[:k]].mean(0)
PTS = {
    'axNeck': contact_pts('Axillary_nerver', 'humerus', 7).mean(0),
    'radGroove': contact_pts('Radial_nerver', 'humerus', 3).mean(0),
    'ulnEpi': contact_pts('Ulnar_nerver', 'humerus', 4).mean(0),
    'fibNeck': contact_pts('Common_fibular_nerver', 'fibula', 4).mean(0),
    'sciSplit': sci[sci[:, 2] < sci[:, 2].min() + 6].mean(0),
    'carpal': med[np.abs(med[:, 2] - (handz - 12)) < 5].mean(0),
    'femInguinal': fem[fem[:, 2] > fem[:, 2].max() - 60].mean(0),
    'bicepsTendon': near(bic, 'radius') if bic is not None else None,
    'patLig': (pat[np.argmin(pat[:, 2])] + tib[np.argmin(np.where((tib[:, 2] > tib[:, 2].max() - 90), tib[:, 1], 1e9))]) / 2,
    'humHead': hum[np.argmax(hum[:, 2])], 'latEpi': hum[np.argmin(np.where(hum[:, 2] < hum[:, 2].min() + 40, hum[:, 0], 1e9))],
    'medEpi': hum[np.argmax(np.where(hum[:, 2] < hum[:, 2].min() + 40, hum[:, 0], -1e9))],
    'humMidLat': hum[np.argmin(np.where(np.abs(hum[:, 2] - (hum[:, 2].min() + hum[:, 2].max()) / 2) < 8, hum[:, 0], 1e9))],
    'olecranon': raw('ulna')[0][np.argmax(raw('ulna')[0][:, 2])], 'tibTub': tib[np.argmin(np.where((tib[:, 2] > tib[:, 2].max() - 90), tib[:, 1], 1e9))],
    'fibHead': raw('fibula')[0][np.argmax(raw('fibula')[0][:, 2])], 'medMall': tib[np.argmax(np.where(tib[:, 2] < tib[:, 2].min() + 30, tib[:, 0], -1e9))],
    'ischTub': raw('hip')[0][np.argmin(np.where(np.abs(raw('hip')[0][:, 0] + 60) < 40, raw('hip')[0][:, 2], 1e9))],
}
for k, p in PTS.items(): print(f'{k:12s}', None if p is None else np.round(p, 1))
for v, vw in VIEWS.items(): man['points'][v] = {k: vw.pt(p) for k, p in PTS.items() if p is not None}
# digit coverage: which nerve's proper palmar digital branches reach each finger tip (distal phalanx), measured
FINGERS = {1: 'Distal_phalanx_of_first_finger_of_handr', 2: 'Distal_phalanx_of_second_finger_of_handr', 3: 'Distal_phalanx_of_third_finger_of_handr',
           4: 'Distal_phalanx_of_fourth_finger_of_handr', 5: 'Distal_phalanx_of_fifth_finger_of_handr'}
dig = {'median': nv('Proper_palmar_digital_branches_of_median_nerver'), 'ulnar': nv('Proper_palmar_digital_branches_of_ulnar_nerver')}
cover = {}
for f, bn in FINGERS.items():
    P = conv(za.mesh('skeletal', bn)[0]); c = P.mean(0); ax = P[np.argmax(P[:, 2])] - P[np.argmin(P[:, 2])]
    t = cKDTree(P); res = {}
    for k, V in dig.items():
        d, _ = t.query(V); S = V[d < 8]; res[k] = int(len(S))
        if len(S): res[k + '_side'] = round(float(np.mean(S[:, 0] - c[0])), 1)    # + = toward the body midline side (thumb side in anatomical position is lateral = more negative X)
    cover[f] = res
print('digit cover', cover)
man['digits'] = cover
for f, bn in FINGERS.items():
    P = conv(za.mesh('skeletal', bn)[0]); man['points']['aant'][f'tip{f}'] = VIEWS['aant'].pt(P.mean(0))
json.dump(man, open(os.path.join(OUT, 'nerve.json'), 'w'))
open(os.path.join(OUT, 'LICENSES.txt'), 'w').write(
    'CH5 nerve images: rendered from the Z-Anatomy models, CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/)\n'
    'Z-Anatomy - The open source atlas of anatomy; derived from BodyParts3D, (c) The Database Center for Life Science\n'
    'These images are shared under CC BY-SA 4.0. (tools/anatomy3d/ch5_art.py)\n')
print('done')
