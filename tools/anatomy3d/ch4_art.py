"""CH4 hip & thigh art from BodyParts3D 4.0 (CC BY 4.0, (c) DBCLS). See ch4_model.py for the views.

Outputs (app/public/assets/ch4/), density = image px per frame unit (frame unit = 1 mm):
  ant_full / post_full      every muscle + bones (density 2)
  ant_rest / post_rest      the same without the 8 core muscles; other muscles toned down (assembly background)
  core_<id>                 one core muscle in its view, hidden where bones / non-core muscles are in front, cropped
  glut_full / glut_nomax / glut_deep   gluteal close-up (post view): all, without gluteus maximus, without max + medius
  glut_max / glut_med       the peelable layers in the same close-up
  rig_pelvis / rig_femur / rig_leg      lateral-view bones for the hip/knee rig (density 2, cropped)
  aby_pelvis / aby_limb     anterior-view bones for the abduction rig
  knee_bones / pes_<id>     medial view of the knee (density 4) + the distal parts of sartorius, gracilis,
                            semitendinosus, semimembranosus
  spec_<id>                 specimen images for the compartment fridge (density 1)
  hip.json                  views, rects, measured landmarks (frame units of each view), rig centres
usage: python3 ch4_art.py [--norender]
"""
import sys, os, json, subprocess
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from ch4_model import *
from build import attributes, enc
from post import load as pload, finish

HERE = os.path.dirname(os.path.abspath(__file__)); RENDER = os.path.join(HERE, 'render')
OUT = os.path.join(HERE, '..', '..', 'app', 'public', 'assets', 'ch4')
TMP = os.path.join(HERE, 'out', 'tmp_ch4'); os.makedirs(TMP, exist_ok=True); os.makedirs(OUT, exist_ok=True)
NORENDER = '--norender' in sys.argv
MUS_RED = [0.70, 0.17, 0.17]; BONE = [0.90, 0.86, 0.76]; CART = [0.78, 0.85, 0.87]; FASC = [0.86, 0.84, 0.80]

CORE = {'iliopsoas': ['psoas', 'iliacus'], 'sartorius': ['sartorius'], 'rf': ['rf'], 'gracilis': ['gracilis'],
        'gmax': ['gmax'], 'gmed': ['gmed'], 'bf': ['bfl', 'bfs'], 'st': ['st']}
CORE_VIEW = {'iliopsoas': 'ant', 'sartorius': 'ant', 'rf': 'ant', 'gracilis': 'ant', 'gmax': 'post', 'gmed': 'post', 'bf': 'post', 'st': 'post'}
CORE_PARTS = [p for v in CORE.values() for p in v]
BONE_NAMES = list(BONES) + list(DISCS)
MUS_NAMES = list(MUSCLES) + list(FASCIA)

# measured ends for fibre directions: (origin bone(s), insertion bone); None = principal axis
ENDS = {'gmax': ('sacrum', 'femur'), 'gmed': ('hip', 'femur'), 'gmin': ('hip', 'femur'), 'piriformis': ('sacrum', 'femur'),
        'psoas': ('lumbar', 'femur'), 'iliacus': ('hip', 'femur'), 'sartorius': ('hip', 'tibia'), 'rf': ('hip', 'tibia'),
        'al': ('hip', 'femur'), 'gracilis': ('hip', 'tibia'), 'bfl': ('hip', 'fibula'), 'st': ('hip', 'tibia'), 'sm': ('hip', 'tibia'),
        'tfl': ('hip', None), 'obtint': ('hip', 'femur'), 'quadfem': ('hip', 'femur')}
FLESHY = {'vl', 'vm', 'vi', 'bfs', 'iliacus', 'gmax', 'gmed', 'gmin', 'am', 'ab'}

def muscle_ends(n, V):
    c = V.mean(0); a = np.linalg.svd(V - c, full_matrices=False)[2][0]; t = (V - c) @ a
    O, I = c + a * t.max(), c + a * t.min()
    if O[2] < I[2]: O, I = I, O
    ob, ib = ENDS.get(n, (None, None))
    if ob: S = contact(n, ob); O = S.mean(0) if S is not None else O
    if ib:
        S = contact(n, ib)
        if S is not None: I = S[S[:, 2] < S[:, 2].min() + 25].mean(0)
    return O, I

ATTR = {}
def attrs(n):
    if n not in ATTR:
        V, F = smooth(n)
        if n in MUSCLES:
            O, I = muscle_ends(n, raw(n)[0]); ten, fib, _ = attributes(V, O, I, n in FLESHY)
        else:
            ten = np.ones(len(V)) if n in FASCIA else np.zeros(len(V)); fib = np.tile([0, 0, 1.0], (len(V), 1))
        ATTR[n] = (ten, fib)
    return ATTR[n]

def clipped(n, zmax=None, zmin=None):
    """mesh with faces outside a z band removed (cut ends for close-ups)"""
    V, F = smooth(n); keep = np.ones(len(F), bool)
    if zmax is not None: keep &= (V[F][:, :, 2] < zmax).all(1)
    if zmin is not None: keep &= (V[F][:, :, 2] > zmin).all(1)
    return V, F[keep]

def entry(vw, name, n, F=None):
    V, F0 = smooth(n); F = F0 if F is None else F
    ten, fib = attrs(n)
    kind = 1 if n in BONE_NAMES else 0
    base = CART if n in DISCS else BONE if n in BONES else FASC if n in FASCIA else MUS_RED
    return dict(name=name, kind=kind, base=base, tcol=[0.93, 0.89, 0.80], pos=enc(vw.to_render(V), '<f4'), fib=enc(vw.dir_render(fib), '<f4'),
                ten=enc(ten, '<f4'), idx=enc(F, '<u4'))

# ---------------- views ----------------
hc, hr = hip_centre(); kc, kcm, kcl, kr = knee_axis()
upper = np.concatenate([raw(n)[0] for n in MUS_NAMES + ['hip', 'sacrum', 'lumbar']])
upper = upper[upper[:, 2] > 250]
allb = np.concatenate([raw(n)[0] for n in BONE_NAMES])
VIEWS = {'ant': View('ant', 1.0, upper, 14), 'post': View('post', 1.0, upper, 14), 'lat': View('lat', 1.0, np.concatenate([allb, upper]), 14),
         'med': View('med', 1.0, np.concatenate([allb, upper]), 14)}
for v in VIEWS.values(): print(v.name, v.W, v.H)

# ---------------- render jobs ----------------
scenes = {v: {} for v in VIEWS}
jobs = {v: [] for v in VIEWS}
POST = {}          # job name -> post-processing info
def add(view, name, meshes, rect=None, dens=2, occ=(), fibres=True, extra=None):
    vw = VIEWS[view]
    for m in meshes:
        if m not in scenes[view]: scenes[view][m] = entry(vw, m, m)
    for m in occ:
        if m not in scenes[view]: scenes[view][m] = entry(vw, m, m)
    if extra:
        for nm, (n, F) in extra.items(): scenes[view][nm] = entry(vw, nm, n, F)
        meshes = list(meshes) + list(extra)
    r = rect or [0, 0, vw.W, vw.H]
    W, H = int(round((r[2] - r[0]) * dens)), int(round((r[3] - r[1]) * dens))
    ms = list(meshes) + list(occ)
    ids = {m: [20 + (k % 6) * 44, 20 + ((k // 6) % 6) * 44, 20 + (k // 36) * 44] for k, m in enumerate(ms)}
    base = dict(view=r, meshes=ms, occluders=list(occ))
    jobs[view] += [dict(name=name + '_c', size=[W * 2, H * 2], **base), dict(name=name + '_d', size=[W, H], mode='dir', **base),
                   dict(name=name + '_i', size=[W, H], mode='id', ids=ids, **base)]
    POST[name] = dict(view=view, rect=r, dens=dens, ids=ids, mus=[m for m in ms if m not in BONE_NAMES and m not in occ], fibres=fibres)

nonc = [m for m in MUS_NAMES if m not in CORE_PARTS]
for v in ('ant', 'post'):
    add(v, f'{v}_full', BONE_NAMES + MUS_NAMES)
    add(v, f'{v}_rest', BONE_NAMES + nonc)
for c, parts in CORE.items():
    add(CORE_VIEW[c], f'core_{c}', parts, occ=BONE_NAMES + nonc)
# gluteal close-up (post view)
pv = VIEWS['post']
g0 = pv.proj(np.array([[5, 0, 1005], [-170, 0, 655]]))
GR = [float(g0[0, 0]), float(g0[0, 1]), float(g0[1, 0]), float(g0[1, 1])]
deep = [m for m in MUS_NAMES if m not in ('gmax', 'gmed')]
add('post', 'glut_full', BONE_NAMES + MUS_NAMES, GR, 3)
add('post', 'glut_nomax', BONE_NAMES + [m for m in MUS_NAMES if m != 'gmax'], GR, 3)
add('post', 'glut_deep', BONE_NAMES + deep, GR, 3)
add('post', 'glut_max', ['gmax'], GR, 3)
add('post', 'glut_med', ['gmed'], GR, 3, occ=BONE_NAMES + deep)
# lateral rig bones (no fibres)
for nm, ms in (('rig_pelvis', ['hip', 'sacrum', 'lumbar', 'discs']), ('rig_femur', ['femur']), ('rig_leg', ['tibia', 'fibula', 'patella'])):
    add('lat', nm, ms)
for nm, ms in (('aby_pelvis', ['hip', 'sacrum', 'lumbar', 'discs']), ('aby_limb', ['femur', 'patella', 'tibia', 'fibula'])):
    add('ant', nm, ms)
# medial knee close-up
mv = VIEWS['med']
k0 = mv.proj(np.array([[0, -145, 470], [0, -30, 262]]))
KR = [float(k0[0, 0]), float(k0[0, 1]), float(k0[1, 0]), float(k0[1, 1])]
add('med', 'knee_bones', ['femur', 'tibia', 'fibula', 'patella'], KR, 4)
for m in ('sartorius', 'gracilis', 'st', 'sm'):
    V, F = clipped(m, zmax=455)
    add('med', f'pes_{m}', [], KR, 4, extra={m + '_cut': (m, F)})
# specimens (natural view, isolated)
SPEC = {'rf': 'ant', 'vl': 'ant', 'vm': 'ant', 'sartorius': 'ant', 'al': 'ant', 'ab': 'ant', 'gracilis': 'ant', 'bfl': 'post', 'bfs': 'post', 'st': 'post', 'sm': 'post', 'pectineus': 'ant'}
for m, v in SPEC.items(): add(v, f'spec_{m}', [m], dens=1)

for v in VIEWS:
    if not jobs[v]: continue
    sf = os.path.join(TMP, f'scene_{v}.json'); jf = os.path.join(TMP, f'jobs_{v}.json')
    json.dump(dict(meshes=list(scenes[v].values())), open(sf, 'w')); json.dump(jobs[v], open(jf, 'w'))
    if not NORENDER: subprocess.run(['node', os.path.join(RENDER, 'render.cjs'), sf, jf, TMP], check=True)

# ---------------- post ----------------
man = dict(source='BodyParts3D 4.0 (c) DBCLS, CC BY 4.0', views={k: v.info() for k, v in VIEWS.items()}, rects={}, points={}, rig={}, regions={})

def proc(name):
    p = POST[name]
    c = pload(os.path.join(TMP, name + '_c.png')); d = pload(os.path.join(TMP, name + '_d.png')); i = pload(os.path.join(TMP, name + '_i.png'))
    img, lab, names = finish(c, d, i, p['ids'], p['mus'] if p['fibres'] else [], outline=True, seed=hash(name) % 97)
    return img, lab, names

def save_full(name, img):
    Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8), 'RGBA').save(os.path.join(OUT, name + '.webp'), quality=90, method=6)

def save_crop(name, img, key=None):
    p = POST[name]; a = img[..., 3]; ys, xs = np.nonzero(a > 0.03)
    H, W = a.shape; x0, x1 = max(0, xs.min() - 4), min(W, xs.max() + 5); y0, y1 = max(0, ys.min() - 4), min(H, ys.max() + 5)
    Image.fromarray((np.clip(img[y0:y1, x0:x1], 0, 1) * 255).astype(np.uint8), 'RGBA').save(os.path.join(OUT, (key or name) + '.webp'), quality=92, method=6)
    dn = p['dens']; r = p['rect']
    man['rects'][key or name] = dict(view=p['view'], x=round(r[0] + x0 / dn, 1), y=round(r[1] + y0 / dn, 1), w=round((x1 - x0) / dn, 1), h=round((y1 - y0) / dn, 1), density=dn)

def tone(img, lab, names, keep=()):
    """non-core muscles: desaturated and darker so the core muscles stand out on the assembly board"""
    m = np.isin(lab, [k + 1 for k, n in enumerate(names) if n in MUS_NAMES and n not in keep])
    rgb = img[..., :3]; g = rgb.mean(-1, keepdims=True)
    t = np.where(m[..., None], (rgb * 0.45 + g * 0.55) * 0.78 + np.array([0.04, 0.05, 0.07]), rgb)
    return np.concatenate([t, img[..., 3:]], -1)

if not NORENDER or True:
    for name, p in POST.items():
        img, lab, names = proc(name)
        if name.endswith('_rest'): img = tone(img, lab, names)
        if name.startswith(('ant_', 'post_')) or name.startswith('glut_') and name in ('glut_full', 'glut_nomax', 'glut_deep') or name == 'knee_bones':
            save_full(name, img)
            r = p['rect']; man['regions'][name] = dict(view=p['view'], x=r[0], y=r[1], w=r[2] - r[0], h=r[3] - r[1], density=p['dens'])
        else:
            save_crop(name, img)

# ---------------- landmarks ----------------
def cpt(m, b, low=None, high=None):
    S = contact(m, b)
    if S is None: return None
    if low: S = S[S[:, 2] < S[:, 2].min() + low]
    if high: S = S[S[:, 2] > S[:, 2].max() - high]
    return S.mean(0)
def centreline(m, z):
    V = raw(m)[0]; S = V[np.abs(V[:, 2] - z) < 6]
    return S.mean(0) if len(S) > 3 else None
femV = raw('femur')[0]; tibV = raw('tibia')[0]
PTS = {
    'hipC': hc, 'kneeC': kc,
    'asis': cpt('sartorius', 'hip'), 'aiis': cpt('rf', 'hip'), 'pubis': cpt('gracilis', 'hip'), 'alOrigin': cpt('al', 'hip'),
    'iliacFossa': cpt('iliacus', 'hip'), 'lumbar': cpt('psoas', 'lumbar'), 'lesserT': cpt('psoas', 'femur'),
    'greaterT': cpt('gmed', 'femur'), 'gmedOrigin': cpt('gmed', 'hip'), 'gluteTub': cpt('gmax', 'femur'),
    'gmaxOrigin': (cpt('gmax', 'sacrum') + cpt('gmax', 'hip')) / 2, 'ischTub': (cpt('bfl', 'hip') + cpt('st', 'hip') + cpt('sm', 'hip')) / 3,
    'fibHead': cpt('bfl', 'fibula'), 'tibTub': tibV[np.argmin(np.where((tibV[:, 2] > 300) & (tibV[:, 2] < 360), tibV[:, 1], 1e9))],
    'patella': raw('patella')[0].mean(0), 'alInsert': cpt('al', 'femur'), 'linea': cpt('bfs', 'femur'),
    'pes_sartorius': cpt('sartorius', 'tibia', low=15), 'pes_gracilis': cpt('gracilis', 'tibia', low=15), 'pes_st': cpt('st', 'tibia', low=15),
    'sm_tibia': cpt('sm', 'tibia', low=15), 'medEpi': femV[np.argmax(np.where(femV[:, 2] < 430, femV[:, 0], -1e9))],
    'latCondyle': femV[np.argmin(np.where(femV[:, 2] < 430, femV[:, 0], 1e9))],
    'piriformis': cpt('piriformis', 'femur'), 'itt': cpt('itt', 'tibia', low=15),
}
# muscle path points used by the rigs (each tagged with the segment it moves with)
def mid(m, z): return centreline(m, z)
PATH = {
    'iliopsoas': [('pelvis', PTS['lumbar']), ('pelvis', mid('psoas', hc[2] + 12)), ('femur', PTS['lesserT'])],
    'rf': [('pelvis', PTS['aiis']), ('leg', PTS['patella']), ('leg', PTS['tibTub'])],
    'sartorius': [('pelvis', PTS['asis']), ('femur', mid('sartorius', kc[2] + 20)), ('leg', PTS['pes_sartorius'])],
    'gracilis': [('pelvis', PTS['pubis']), ('femur', mid('gracilis', kc[2] + 20)), ('leg', PTS['pes_gracilis'])],
    'gmax': [('pelvis', PTS['gmaxOrigin']), ('femur', PTS['gluteTub'])],
    'bf': [('pelvis', PTS['ischTub']), ('femur', mid('bfl', kc[2] + 20)), ('leg', PTS['fibHead'])],
    'st': [('pelvis', PTS['ischTub']), ('femur', mid('st', kc[2] + 20)), ('leg', PTS['pes_st'])],
    'gmed': [('pelvis', PTS['gmedOrigin']), ('femur', PTS['greaterT'])],
    'al': [('pelvis', PTS['alOrigin']), ('femur', PTS['alInsert'])],
    'vl': [('femur', cpt('vl', 'femur')), ('leg', PTS['patella']), ('leg', PTS['tibTub'])],
}
for v, vw in VIEWS.items():
    man['points'][v] = {k: vw.pt(p) for k, p in PTS.items() if p is not None}
    man['rig'][v] = {m: [[s, *vw.pt(p)] for s, p in pts] for m, pts in PATH.items()}
man['hipRadius'] = round(float(hr), 1); man['kneeRadius'] = round(float(kr), 1)

# sagittal / frontal moment check (cable length change for a small rotation of the distal segment)
def rot2(p, c, a):
    s, co = np.sin(a), np.cos(a); d = p - c; return c + np.array([d[0] * co - d[1] * s, d[0] * s + d[1] * co])
def length(pts, ang, view):
    vw = VIEWS[view]; H = np.array(vw.pt(hc)); K = np.array(vw.pt(kc)); out = []
    for seg, p in pts:
        q = np.array(vw.pt(p))
        if seg in ('femur', 'leg'): q = rot2(q, H, ang[0])
        if seg == 'leg': q = rot2(q, rot2(K, H, ang[0]), ang[1])
        out.append(q)
    return sum(np.linalg.norm(out[i + 1] - out[i]) for i in range(len(out) - 1))
check = {}
for m, pts in PATH.items():
    L0 = length(pts, (0, 0), 'lat'); e = 0.05
    dh = (length(pts, (-e, 0), 'lat') - L0) / e     # lat view: hip flexion = negative screen rotation
    dk = (length(pts, (0, e), 'lat') - L0) / e      # knee flexion = positive screen rotation of the leg
    da = (length(pts, (e, 0), 'ant') - length(pts, (0, 0), 'ant')) / e   # ant view (lateral on the left): abduction = positive rotation
    check[m] = dict(hipFlex=round(dh, 1), kneeFlex=round(dk, 1), abd=round(da, 1))
    print(f'{m:10s} dL/d(hip flex) {dh:7.1f}  dL/d(knee flex) {dk:7.1f}  dL/d(abd) {da:7.1f}   (negative = shortens = muscle produces it)')
man['momentCheck'] = check
json.dump(man, open(os.path.join(OUT, 'hip.json'), 'w'))
open(os.path.join(OUT, 'LICENSES.txt'), 'w').write(
    'CH4 hip/thigh images: rendered from BodyParts3D 4.0, (c) The Database Center for Life Science, CC BY 4.0\n'
    'https://creativecommons.org/licenses/by/4.0/  (tools/anatomy3d/ch4_art.py, ch4_section.py)\n')
print('rects', len(man['rects']))
