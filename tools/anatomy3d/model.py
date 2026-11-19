"""BodyParts3D (CC BY 4.0, (c) DBCLS) -> right shoulder/arm model in the game's anatomy frame.

BP3D axes: X- = body's right, Y- = anterior, Z+ = superior (mm).
Frame (anterior view, same as the CH2 plate): x = 640 + S*X (lateral = viewer's left), y = Y0 + S*(ZTOP - Z), depth d = -S*Y (toward viewer).
"""
import sys, os, numpy as np
from scipy.spatial import cKDTree
sys.path.insert(0, os.path.dirname(__file__))
from objio import load

S = 1.75; ZTOP = 1355.0; Y0 = 130.0
FRAME = (760, 1260)

TARGET = {
    'deltoid': ['FJ1468', 'FJ1467', 'FJ1513'],          # clavicular, acromial, spinal parts
    'pecmajor': ['FJ1447', 'FJ1464', 'FJ1446'],         # clavicular, sternocostal, abdominal parts
    'biceps': ['FJ1478', 'FJ1512'],                     # long head, short head
    'brachialis': ['FJ1486'],
    'coracobrachialis': ['FJ1488'],
    'brachioradialis': ['FJ1487'],
    'triceps': ['FJ1479', 'FJ1477', 'FJ1480'],          # long, lateral, medial heads
    'supraspinatus': ['FJ1506'],
}
CONTEXT = {
    'pecminor': ['FJ1456'], 'serratus': ['FJ1459'], 'subclavius': ['FJ1460'],
    'subscapularis': ['FJ1504'], 'teresmajor': ['FJ1507'], 'teresminor': ['FJ1508'], 'infraspinatus': ['FJ1500'],
    'trapezius': ['FJ1521', 'FJ1554', 'FJ1520'],
    'intercostal': ['FJ1451', 'FJ1455'],
    'pronator': ['FJ1474', 'FJ1516'], 'fcr': ['FJ1496'], 'pl': ['FJ1502'], 'fds': ['FJ1499', 'FJ1475'], 'fcu': ['FJ1473', 'FJ1518'],
    'ecrl': ['FJ1490'], 'ecrb': ['FJ1489'], 'supinator': ['FJ1505'], 'anconeus': ['FJ1485'], 'ecu': ['FJ1472', 'FJ1517'],
    'edm': ['FJ1491'], 'ed': ['FJ1492'], 'apl': ['FJ1484'], 'epb': ['FJ1494'], 'epl': ['FJ1495'], 'fpl': ['FJ1498'], 'fdp': ['FJ1497'], 'pq': ['FJ1503'],
    'thenar': ['FJ1483', 'FJ1501', 'FJ1514', 'FJ1481', 'FJ1515'],
}
BONES = {
    'clavicle': ['FJ3362'], 'scapula': ['FJ3384'], 'humerus': ['FJ3368'], 'radius': ['FJ3349'], 'ulna': ['FJ3391'],
    'sternum': ['FJ3290', 'FJ3178'],
    'ribs': ['FJ3334', 'FJ3336', 'FJ3338', 'FJ3340', 'FJ3342', 'FJ3344', 'FJ3346', 'FJ3347', 'FJ3348', 'FJ3330', 'FJ3331', 'FJ3332'],
    'cartilage': ['FJ3333', 'FJ3335', 'FJ3337', 'FJ3339', 'FJ3341', 'FJ3343', 'FJ3345'],
    'hand': ['FJ3350', 'FJ3352', 'FJ3354', 'FJ3356', 'FJ3358', 'FJ3361', 'FJ3367', 'FJ3374', 'FJ3382', 'FJ3383', 'FJ3388', 'FJ3389', 'FJ3390',
             'FJ3322', 'FJ3323', 'FJ3325', 'FJ3326', 'FJ3327', 'FJ3303', 'FJ3304', 'FJ3306', 'FJ3292', 'FJ3193', 'FJ3194', 'FJ3196', 'FJ3197', 'FJ3198'],
}

def to_frame(P):
    P = np.asarray(P, float)
    return np.stack([640 + S * P[..., 0], Y0 + S * (ZTOP - P[..., 2]), -S * P[..., 1]], -1)

# ---------------- geometry helpers ----------------
def merge(fids):
    Vs, Fs, o = [], [], 0
    for f in fids:
        V, F = load(f); Vs.append(V); Fs.append(F + o); o += len(V)
    return np.concatenate(Vs), np.concatenate(Fs)

def weld(V, F, tol=1e-4):
    key = np.round(V / tol).astype(np.int64)
    _, idx, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
    return V[idx], inv.reshape(-1)[F]

def subdivide(V, F):
    """1:4 midpoint subdivision"""
    E = np.concatenate([F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]])
    Es = np.sort(E, 1)
    uniq, inv = np.unique(Es, axis=0, return_inverse=True)
    mids = (V[uniq[:, 0]] + V[uniq[:, 1]]) / 2
    n = len(V); m = len(F)
    a = inv[:m] + n; b = inv[m:2 * m] + n; c = inv[2 * m:] + n
    NF = np.concatenate([np.stack([F[:, 0], a, c], 1), np.stack([a, F[:, 1], b], 1), np.stack([c, b, F[:, 2]], 1), np.stack([a, b, c], 1)])
    return np.concatenate([V, mids]), NF

def taubin(V, F, it=6, lam=0.5, mu=-0.53):
    n = len(V)
    E = np.concatenate([F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]]); E = np.concatenate([E, E[:, ::-1]])
    E = np.unique(E, axis=0)
    deg = np.bincount(E[:, 0], minlength=n).astype(float); deg[deg == 0] = 1
    V = V.copy()
    for _ in range(it):
        for f in (lam, mu):
            acc = np.zeros_like(V); np.add.at(acc, E[:, 0], V[E[:, 1]])
            V = V + f * (acc / deg[:, None] - V)
    return V

def smooth_mesh(fids, sub=True):
    V, F = merge(fids); V, F = weld(V, F)
    if sub: V, F = subdivide(V, F); V = taubin(V, F, 4)
    return V, F

def sample_surface(V, F, step=0.8):
    """dense points on triangles (for surface-distance queries)"""
    A = V[F[:, 0]]; B = V[F[:, 1]]; C = V[F[:, 2]]
    area = 0.5 * np.linalg.norm(np.cross(B - A, C - A), axis=1)
    k = np.maximum(1, np.ceil(area / (step * step))).astype(int)
    idx = np.repeat(np.arange(len(F)), k)
    r1 = np.random.default_rng(1).random(len(idx)); r2 = np.random.default_rng(2).random(len(idx))
    s = np.sqrt(r1)
    P = (1 - s)[:, None] * A[idx] + (s * (1 - r2))[:, None] * B[idx] + (s * r2)[:, None] * C[idx]
    return np.concatenate([P, V])

_bone_tree = {}
def bone_tree(name):
    if name not in _bone_tree:
        V, F = merge(BONES[name]); _bone_tree[name] = cKDTree(sample_surface(V, F))
    return _bone_tree[name]

def contact(fids, bone, thr=2.5):
    """vertices of a muscle element within thr mm of a bone surface"""
    V, F = merge(fids if isinstance(fids, list) else [fids])
    d, _ = bone_tree(bone).query(V)
    return V[d < thr], V, d
