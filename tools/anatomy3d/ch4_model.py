"""CH4 hip & thigh model from BodyParts3D 4.0 (CC BY 4.0, (c) DBCLS): RIGHT pelvis + lower limb, muscles of the
gluteal region and thigh. Shared by ch4_art.py (renders) and ch4_section.py (cross-section).

BP3D axes: X- = body's right, Y- = anterior, Z+ = superior (mm).
Views (frame units = K per mm, y down):
  ant   anterior view: x = +X (body's right / lateral on the viewer's LEFT), depth toward viewer = -Y
  post  posterior view: x = -X (lateral on the viewer's RIGHT), depth = +Y
  lat   lateral view of the right limb: x = -Y (anterior on the viewer's RIGHT), depth = -X
  med   medial view: x = +Y (anterior on the viewer's LEFT), depth = +X
"""
import sys, os, functools
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np
from scipy.spatial import cKDTree
from model import merge, weld, subdivide, taubin, sample_surface

MUSCLES = {
    'gmax': ['FJ1418'], 'gmed': ['FJ1419'], 'gmin': ['FJ1420'], 'piriformis': ['FJ1428'],
    'gemsup': ['FJ1417'], 'geminf': ['FJ1416'], 'obtint': ['FJ1426'], 'obtext': ['FJ1425'], 'quadfem': ['FJ1432'],
    'psoas': ['FJ1431'], 'iliacus': ['FJ1422'], 'sartorius': ['FJ1434'], 'rf': ['FJ1433'],
    'vl': ['FJ1442'], 'vm': ['FJ1443'], 'vi': ['FJ1441'],
    'al': ['FJ1402'], 'ab': ['FJ1401'], 'am': ['FJ1403'], 'amin': ['FJ1404'], 'gracilis': ['FJ1421'], 'pectineus': ['FJ1427'],
    'tfl': ['FJ1438'], 'bfl': ['FJ1395'], 'bfs': ['FJ1444'], 'st': ['FJ1436'], 'sm': ['FJ1435'],
}
FASCIA = {'itt': ['FJ1423']}
BONES = {
    'hip': ['FJ3152'], 'sacrum': ['FJ3393'], 'femur': ['FJ3365'], 'patella': ['FJ3381'], 'tibia': ['FJ3387'], 'fibula': ['FJ3366'],
    'lumbar': ['FJ3156', 'FJ3157', 'FJ3159', 'FJ3162', 'FJ3165', 'FJ3168'],
}
DISCS = {'discs': ['FJ3212', 'FJ3214', 'FJ3215', 'FJ3216']}

@functools.lru_cache(maxsize=None)
def raw(name):
    fids = (MUSCLES.get(name) or FASCIA.get(name) or BONES.get(name) or DISCS.get(name))
    V, F = merge(fids); V, F = weld(V, F)
    return V, F

@functools.lru_cache(maxsize=None)
def smooth(name):
    V, F = raw(name)
    if name in ('lumbar', 'discs'): return V, F
    V, F = subdivide(V, F); V = taubin(V, F, 3 if name in BONES else 4)
    return V, F

@functools.lru_cache(maxsize=None)
def tree(name):
    return cKDTree(sample_surface(*raw(name), step=0.8))

def contact(m, b, thr=2.5):
    """vertices of mesh m within thr mm of bone b (cartilage is not modelled: allow min + 1.5 mm)"""
    V = raw(m)[0]; d, _ = tree(b).query(V)
    if d.min() > 8: return None
    S = V[d < max(thr, d.min() + 1.5)]
    return S if len(S) >= 3 else None

AXES = {
    'ant':  (np.array([1., 0, 0]), np.array([0, 0, -1.]), np.array([0, -1., 0])),
    'post': (np.array([-1., 0, 0]), np.array([0, 0, -1.]), np.array([0, 1., 0])),
    'lat':  (np.array([0, -1., 0]), np.array([0, 0, -1.]), np.array([-1., 0, 0])),
    'med':  (np.array([0, 1., 0]), np.array([0, 0, -1.]), np.array([1., 0, 0])),
}

class View:
    """orthographic projection: frame x/y (y down) in K units per mm, origin = top-left of bounds (mm) + pad"""
    def __init__(self, name, K, bounds_pts, pad_mm=12):
        self.name = name; self.K = K
        ex, ey, ez = AXES[name]; self.ex, self.ey, self.ez = ex, ey, ez
        P = np.asarray(bounds_pts, float)
        self.u0 = (P @ ex).min() - pad_mm; self.v0 = (P @ ey).min() - pad_mm
        self.W = int(np.ceil(((P @ ex).max() + pad_mm - self.u0) * K)); self.H = int(np.ceil(((P @ ey).max() + pad_mm - self.v0) * K))
    def proj(self, P):
        P = np.asarray(P, float)
        return np.stack([(P @ self.ex - self.u0) * self.K, (P @ self.ey - self.v0) * self.K, (P @ self.ez) * self.K], -1)
    def pt(self, p):
        q = self.proj(np.asarray(p, float)[None])[0]; return [round(float(q[0]), 1), round(float(q[1]), 1)]
    def to_render(self, P):
        Q = self.proj(P); return np.stack([Q[:, 0], -Q[:, 1], Q[:, 2]], 1)
    def dir_render(self, D):
        """direction vectors -> render space (x right, y up, z toward viewer)"""
        D = np.asarray(D, float)
        return np.stack([D @ self.ex, -(D @ self.ey), D @ self.ez], -1)
    def info(self):
        return dict(name=self.name, K=self.K, ex=self.ex.tolist(), ey=self.ey.tolist(), u0=float(self.u0), v0=float(self.v0), W=self.W, H=self.H)

def sphere_fit(P):
    A = np.c_[2 * P, np.ones(len(P))]; b = (P ** 2).sum(1)
    c, *_ = np.linalg.lstsq(A, b, rcond=None); r = np.sqrt(c[3] + (c[:3] ** 2).sum())
    return c[:3], r

def hip_centre():
    """femoral head: sphere fit of the femur vertices near the acetabulum"""
    V = raw('femur')[0]; d, _ = tree('hip').query(V)
    P = V[d < 4.0]
    c, r = sphere_fit(P)
    return c, r

def knee_axis():
    """knee flexion axis: sphere fits of the posterior-inferior surfaces of the two femoral condyles (r ~ 20 mm);
    centre = midpoint of the two sphere centres"""
    V = raw('femur')[0]; z0 = V[:, 2].min(); C = V[V[:, 2] < z0 + 45]
    xm = np.median(C[:, 0]); out = []
    for P in (C[C[:, 0] > xm], C[C[:, 0] <= xm]):
        Q = P[P[:, 1] > P[:, 1].mean() - 5]; out.append(sphere_fit(Q))
    (cm, rm), (cl, rl) = out
    return (cm + cl) / 2, cm, cl, (rm + rl) / 2
