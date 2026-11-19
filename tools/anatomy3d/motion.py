"""Pose the BodyParts3D right upper limb for the CH2 motion puzzle.

Bones move rigidly by segment. Every muscle element is re-shaped between its MEASURED origin and insertion
(attachments stay glued to their bones): the belly follows the new origin->insertion line, tendons keep their
length, the belly shortens/lengthens and its cross-section scales by sqrt(L0/L1) (constant volume).

usage: python3 motion.py elbow|shoulder <out_scene_prefix>
"""
import sys, os, json, math; sys.path.insert(0, os.path.dirname(__file__))
import numpy as np
from scipy.spatial import cKDTree
from model import *
from build import ELEM, ends, attributes, mesh_entry, MUS_RED, CTX_RED, BONE, CART, FLESHY_O
from atts import site

SEG_OF_BONE = {'sternum': 'trunk', 'ribs': 'trunk', 'cartilage': 'trunk', 'clavicle': 'girdle', 'scapula': 'girdle',
               'humerus': 'arm', 'radius': 'fore', 'ulna': 'fore', 'hand': 'fore'}

def rot(axis, ang):
    a = np.asarray(axis, float); a = a / np.linalg.norm(a)
    K = np.array([[0, -a[2], a[1]], [a[2], 0, -a[0]], [-a[1], a[0], 0]])
    return np.eye(3) + math.sin(ang) * K + (1 - math.cos(ang)) * K @ K

def rigid(R, c):            # rotation R about centre c -> (R, t) with x' = R x + t
    return (R, c - R @ c)
I3 = (np.eye(3), np.zeros(3))
def apply(T, X): return X @ T[0].T + T[1]
def compose(A, B):          # A after B
    return (A[0] @ B[0], A[0] @ B[1] + A[1])

def min_rot(a, b):
    v = np.cross(a, b); s = np.linalg.norm(v); c = float(np.dot(a, b))
    if s < 1e-8: return np.eye(3)
    return rot(v / s, math.atan2(s, c))

# ---------- joint geometry measured on the bones ----------
def elbow_axis():
    V, F = merge(BONES['humerus'])
    d = V[V[:, 2] < V[:, 2].min() + 45]
    lat = d[np.argmin(d[:, 0])]; med = d[np.argmax(d[:, 0])]       # epicondyles
    art = V[V[:, 2] < V[:, 2].min() + 14]                            # articular end (trochlea + capitulum)
    c = art.mean(0); c[2] += 9.0                                     # centre of the trochlear/capitular curvature
    return c, (med - lat) / np.linalg.norm(med - lat)

def gh_centre():
    V, F = merge(BONES['humerus'])
    top = V[V[:, 2] > V[:, 2].max() - 50]
    # humeral head: points on the medial side of the proximal end -> sphere fit
    A = np.c_[2 * top, np.ones(len(top))]; b = (top ** 2).sum(1)
    sol = np.linalg.lstsq(A, b, rcond=None)[0]
    return sol[:3]

def sc_joint():
    V, F = merge(BONES['clavicle']); return V[np.argmax(V[:, 0])]

def pose_elbow(theta_deg):
    c, ax = elbow_axis()
    R = rot(ax, math.radians(theta_deg))
    # choose sign so that flexion brings the hand anteriorly (BP3D: anterior = -Y)
    hand = np.array(merge(BONES['hand'])[0].mean(0))
    if apply(rigid(R, c), hand[None])[0][1] > hand[1]: R = rot(ax, -math.radians(theta_deg))
    return {'trunk': I3, 'girdle': I3, 'arm': I3, 'fore': rigid(R, c)}

def pose_shoulder(theta_deg):
    # scapulohumeral rhythm ~ 1:3 (girdle : glenohumeral) -> 90 deg = ~22 deg girdle + ~68 deg GH
    sc = sc_joint(); gh = gh_centre()
    g = math.radians(theta_deg) * 0.25; h = math.radians(theta_deg) * 0.75
    def ab(ang):          # abduction = rotation about the AP axis that lifts the arm laterally (toward -X)
        Rr = rot([0, 1, 0], ang)
        test = apply(rigid(Rr, gh), np.array([[gh[0], gh[1], gh[2] - 100]]))[0]
        return Rr if test[0] < gh[0] else rot([0, 1, 0], -ang)
    Tg = rigid(ab(g), sc)
    gh2 = apply(Tg, gh[None])[0]
    Ta = compose(rigid(ab(h), gh2), Tg)
    return {'trunk': I3, 'girdle': Tg, 'arm': Ta, 'fore': Ta}

# ---------- muscle element deformation ----------
_trees = {}
def btree(b):
    if b not in _trees:
        V, F = merge(BONES[b]); _trees[b] = cKDTree(sample_surface(V, F))
    return _trees[b]

def nearest_seg(P):
    best, bd = None, 1e9
    for b in BONES:
        d, _ = btree(b).query(P)
        if d < bd: bd, best = d, b
    return best

def elem_bones(fid, V, O, I):
    if fid in ELEM:
        ob, _, ib, _ = ELEM[fid]
        ob = ob if isinstance(ob, list) else [ob]
        ib = ['radius'] if isinstance(ib, tuple) else (ib if isinstance(ib, list) else [ib])
        return ob, ib
    return [nearest_seg(O)], [nearest_seg(I)]

# elements whose tendon wraps around the back of the elbow in flexion (moment arm in mm): the path lengthens by r*theta
WRAP = {'FJ1479': 15.0, 'FJ1477': 15.0, 'FJ1480': 15.0}

def rot_angle(Ra, Rb):
    Rr = Ra.T @ Rb; return math.acos(max(-1.0, min(1.0, (np.trace(Rr) - 1) / 2)))

class Elem:
    def __init__(self, gname, fid, sub=True):
        V, F = merge([fid]); V, F = weld(V, F)
        self.O, self.I = ends(fid, V)
        if sub: V, F = subdivide(V, F); V = taubin(V, F, 4)
        self.V, self.F, self.fid, self.g = V, F, fid, gname
        self.ten, self.fib, self.t = attributes(V, self.O, self.I, fid in FLESHY_O)
        ob, ib = elem_bones(fid, V, self.O, self.I)
        self.oseg, self.iseg = SEG_OF_BONE[ob[0]], SEG_OF_BONE[ib[0]]
        dO = np.min([btree(b).query(V)[0] for b in ob], 0)
        dI = np.min([btree(b).query(V)[0] for b in ib], 0)
        self.wo = np.exp(-(dO / 7.0) ** 2) * (self.t < 0.5)
        self.wi = np.exp(-(dI / 7.0) ** 2) * (self.t > 0.5)
        ax = self.I - self.O; self.L0 = np.linalg.norm(ax); self.a0 = ax / self.L0
        # belly fraction along the axis (tendons are inextensible)
        nb = 64; tb = np.clip(((self.t - 0) * nb).astype(int), 0, nb - 1)
        tenb = np.array([self.ten[tb == k].mean() if (tb == k).any() else 0 for k in range(nb)])
        belly = 1 - np.clip(tenb, 0, 1)
        self.cum = np.concatenate([[0], np.cumsum(belly)]) / max(belly.sum(), 1e-6)
        self.bfrac = belly.mean()

    def pose(self, P):
        TO, TI = P[self.oseg], P[self.iseg]
        V = self.V
        if self.oseg == self.iseg or (np.allclose(TO[0], TI[0]) and np.allclose(TO[1], TI[1])):
            return apply(TO, V), self.fib @ TO[0].T, 0.0
        O1, I1 = apply(TO, self.O[None])[0], apply(TI, self.I[None])[0]
        if self.fid in WRAP and self.iseg == 'fore':
            th = rot_angle(P['arm'][0], TI[0])
            I1 = apply(P['arm'], (self.I + self.a0 * WRAP[self.fid] * th)[None])[0]
        ax = I1 - O1; L1 = np.linalg.norm(ax); a1 = ax / L1
        R = min_rot(self.a0, a1)
        t = self.t
        d = V - self.O; along = d @ self.a0; r = d - np.outer(along, self.a0)
        tc = np.clip(t, 0, 1)
        cb = np.interp(tc, np.linspace(0, 1, len(self.cum)), self.cum)
        dL = L1 - self.L0
        s_new = t * self.L0 + dL * cb
        Lb0 = self.bfrac * self.L0; Lb1 = max(Lb0 + dL, 0.25 * Lb0)
        k = math.sqrt(Lb0 / Lb1)
        bell = np.sin(np.pi * tc) ** 0.7
        sc = 1 + (k - 1) * bell * (1 - np.clip(self.ten, 0, 1))
        m = O1 + np.outer(s_new, a1) + (r @ R.T) * sc[:, None]
        pO, pI = apply(TO, V), apply(TI, V)
        wo, wi = self.wo, self.wi
        ws = np.maximum(wo + wi, 1.0)
        out = (wo[:, None] * pO + wi[:, None] * pI + np.clip(1 - wo - wi, 0, 1)[:, None] * m) / ws[:, None]
        fib = self.fib @ R.T
        return out, fib, L1 / self.L0 - 1

def bone_elems():
    out = []
    for g, fids in BONES.items():
        V, F = merge(fids); V, F = weld(V, F)
        if g not in ('ribs', 'hand'): V, F = subdivide(V, F); V = taubin(V, F, 3)
        out.append((g, V, F))
    return out
