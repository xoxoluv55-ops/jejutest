"""Muscle lines of action for the motion puzzle (replaces the old mesh deformation, see deform_audit.py).

For every muscle element:
  * centre line at REST from the unmodified BodyParts3D mesh (cross-section centroids along origin->insertion),
    pinned to the measured origin and insertion;
  * every centre-line point is attached to ONE body segment (nearest bone, made monotone along the chain
    trunk < girdle < arm < fore), so each piece moves rigidly with its bone;
  * where consecutive points belong to different segments (the path crosses a joint) the gap is bridged by a straight
    line, unless that line would cut through the joint: then it wraps around a cylinder on the joint axis
    (elbow r = 14 mm, glenohumeral r = 26 mm) like the wrapping surfaces of OpenSim musculoskeletal models.
Nothing about the muscle shape is invented: the path is the measured centre line, moved rigidly piece by piece.
"""
import sys, os, math; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from model import merge, weld, TARGET
from motion import Elem, elbow_axis, gh_centre, apply, btree

ORDER = {'trunk': 0, 'girdle': 1, 'arm': 2, 'fore': 3}
SEG_OF = {'sternum': 'trunk', 'ribs': 'trunk', 'cartilage': 'trunk', 'clavicle': 'girdle', 'scapula': 'girdle',
          'humerus': 'arm', 'radius': 'fore', 'ulna': 'fore', 'hand': 'fore'}

CURVED = {'FJ1506'}     # supraspinatus: strongly curved (fossa -> under the acromion -> over the head)

def centreline(e, n=18):
    V = e.V; a = (e.I - e.O) / np.linalg.norm(e.I - e.O); t = (V - e.O) @ a
    lo, hi = max(t.min(), 0.0), min(t.max(), np.linalg.norm(e.I - e.O))
    edges = np.linspace(lo, hi, n + 1); pts = [e.O]
    for k in range(n):
        m = (t >= edges[k]) & (t < edges[k + 1]) & (e.ten < 0.9)
        if m.sum() > 3: pts.append(V[m].mean(0))
    pts.append(e.I)
    L = np.array(pts)
    # curved centre line: slices perpendicular to the straight O->I line put centroids outside curved muscles
    # (supraspinatus bends from the fossa under the acromion) - refine by assigning every vertex to its nearest
    # centre-line point and re-averaging (ends pinned to the measured attachments), with light smoothing
    from scipy.spatial import cKDTree
    Vm = V[e.ten < 0.9] if (e.ten < 0.9).sum() > 50 else V
    for _ in range(8 if e.fid in CURVED else 0):
        lab = cKDTree(L).query(Vm)[1]
        newL = L.copy()
        for k in range(1, len(L) - 1):
            m = lab == k
            if m.sum() > 3: newL[k] = Vm[m].mean(0)
        newL[1:-1] = 0.5 * newL[1:-1] + 0.25 * (newL[:-2] + newL[2:])
        L = newL
    width = float(np.median([np.linalg.norm(V[(t >= edges[k]) & (t < edges[k + 1])] - L[min(k + 1, len(L) - 1)], axis=1).mean()
                             for k in range(n) if ((t >= edges[k]) & (t < edges[k + 1])).sum() > 3])) * 2
    return L, width

_C0 = None
def _joint_planes():
    global _C0
    if _C0 is None: _C0 = (elbow_axis()[0], gh_centre())
    return _C0

def segments(L, e):
    """Segment of each centre-line point by anatomical plane (rest pose), NOT by nearest bone: a point belongs to the
    forearm only below the elbow axis, to the arm only lateral to the humeral-head centre. (Nearest-bone assignment
    put brachialis belly points that lie in front of the elbow on the ulna, and rotating them with the forearm made
    the path loop back.)"""
    ec, gh = _joint_planes()
    lo, hi = ORDER[e.oseg], ORDER[e.iseg]
    lab = []
    for p in L:
        k = lo
        if hi >= ORDER['arm'] and lo < ORDER['arm'] and p[0] < gh[0]: k = ORDER['arm']
        if lo >= ORDER['arm']: k = lo
        if hi == ORDER['fore'] and k >= ORDER['arm'] and p[2] < ec[2]: k = ORDER['fore']
        if hi == ORDER['fore'] and lo < ORDER['arm'] and p[2] < ec[2]: k = ORDER['fore']
        lab.append(min(max(k, lo), hi))
    lab[0], lab[-1] = lo, hi
    for i in range(1, len(lab)): lab[i] = max(lab[i], lab[i - 1])          # monotone along the chain
    inv = {v: k for k, v in ORDER.items()}
    return [inv[k] for k in lab]

def wrap(pa, pb, c, ax, r, n=10):
    """shortest path pa->pb that does not enter the cylinder (centre c, unit axis ax, radius r)."""
    u = np.cross(ax, [1, 0, 0] if abs(ax[0]) < 0.9 else [0, 1, 0]); u /= np.linalg.norm(u); v = np.cross(ax, u)
    def to2(p): d = p - c; return np.array([d @ u, d @ v]), d @ ax
    A, za = to2(pa); B, zb = to2(pb)
    r = min(r, 0.95 * np.linalg.norm(A), 0.95 * np.linalg.norm(B))     # attachment on the bone surface itself
    # closest approach of the 2-D chord to the axis
    AB = B - A; t = np.clip(-(A @ AB) / max(AB @ AB, 1e-9), 0, 1); dmin = np.linalg.norm(A + AB * t)
    if dmin >= r or np.linalg.norm(A) <= r or np.linalg.norm(B) <= r: return [pa, pb]
    def tangent(P, sgn):
        d = np.linalg.norm(P); ang = math.atan2(P[1], P[0]); off = math.acos(r / d)
        return ang + sgn * off
    # wrap on the side of the chord's closest point (the side the chord was pushed through)
    mid = A + AB * t; side = math.atan2(mid[1], mid[0])
    best = None
    for sa in (1, -1):
        for sb in (1, -1):
            ta, tb = tangent(A, sa), tangent(B, sb)
            da = (tb - ta + math.pi) % (2 * math.pi) - math.pi
            m = ta + da / 2
            if abs((m - side + math.pi) % (2 * math.pi) - math.pi) > math.pi / 2: continue
            Lp = math.sqrt(max(A @ A - r * r, 0)) + abs(da) * r + math.sqrt(max(B @ B - r * r, 0))
            if best is None or Lp < best[0]: best = (Lp, ta, da)
    if best is None: return [pa, pb]
    _, ta, da = best
    pts = [pa]
    for k in range(n + 1):
        a = ta + da * k / n; f = (k + 1) / (n + 2)
        pts.append(c + (r * math.cos(a)) * u + (r * math.sin(a)) * v + ax * (za + (zb - za) * f))
    pts.append(pb)
    return pts

# which elements wrap around which joint cylinder (and on which side, in the cylinder's 2-D frame direction):
# elbow flexors bowstring in front of the joint and do NOT wrap; the triceps tendon wraps around the olecranon /
# posterior trochlea; deltoid and supraspinatus run over the humeral head.
WRAPS = {'FJ1479': ('arm', 'fore'), 'FJ1477': ('arm', 'fore'), 'FJ1480': ('arm', 'fore'),
         'FJ1468': ('girdle', 'arm'), 'FJ1467': ('girdle', 'arm'), 'FJ1513': ('girdle', 'arm'), 'FJ1506': ('girdle', 'arm')}

# Interior centre-line points this close to a crossed joint's axis are soft tissue that folds around the joint:
# attaching them rigidly to either bone is invalid (it made paths loop through the joint), so they are dropped and the
# path bridges the joint region (straight, or wrapped where anatomically correct) - as via-point models do.
JOINT_CLEAR = {'elbow': 35.0, 'gh': 30.0}
DELTOID = {'FJ1468', 'FJ1467', 'FJ1513'}
TRICEPS = {'FJ1479', 'FJ1477', 'FJ1480'}
KEEP_ALL = {'FJ1506'}   # supraspinatus runs through the subacromial tunnel: keep its centre line through the joint      # belly drapes over the humeral head: clear 45 mm, wrap over the head

def _radial(p, c, ax):
    d = p - c; return float(np.linalg.norm(d - ax * (d @ ax)))

class Path:
    def __init__(self, g, fid):
        self.e = Elem(g, fid); self.g, self.fid = g, fid
        L, self.width = centreline(self.e)
        seg = segments(L, self.e)
        ec, eax = elbow_axis(); gh = gh_centre()
        if fid in KEEP_ALL:
            # supraspinatus: belly in the fossa and tendon under the acromion stay with the scapula; only the insertion
            # (greater tubercle) moves with the humerus and the tendon wraps over the humeral head
            seg = [s if i == 0 else 'girdle' for i, s in enumerate(seg)]; seg[-1] = 'arm'
        if fid in TRICEPS:
            # the triceps lies ON the posterior humerus down to the olecranon fossa: keep its whole centre line on the
            # arm, only the insertion (olecranon) moves with the ulna, and the tendon wraps posteriorly over the joint
            seg = [s if i == 0 else 'arm' for i, s in enumerate(seg)]; seg[-1] = 'fore'
        keep = []
        for i, (p, sg) in enumerate(zip(L, seg)):
            if fid in TRICEPS or fid in KEEP_ALL: keep.append(i); continue
            if i in (0, len(L) - 1): keep.append(i); continue
            crosses_elbow = seg[0] != 'fore' and seg[-1] == 'fore'
            crosses_gh = ORDER[seg[0]] < ORDER['arm'] <= ORDER[seg[-1]]
            if crosses_elbow and _radial(p, ec, eax) < JOINT_CLEAR['elbow']: continue
            if crosses_gh and np.linalg.norm(p - gh) < (45.0 if fid in DELTOID else JOINT_CLEAR['gh']): continue
            keep.append(i)
        self.L = L[keep]; self.seg = [seg[i] for i in keep]

    def pose(self, P, joints):
        pts = [apply(P[s], p[None])[0] for p, s in zip(self.L, self.seg)]
        out = [pts[0]]
        for i in range(1, len(pts)):
            a, b = self.seg[i - 1], self.seg[i]
            if a != b and (a, b) in joints and WRAPS.get(self.fid) == (a, b):
                c, ax, r = joints[(a, b)](P)
                out += wrap(out[-1], pts[i], c, ax, r)[1:]
            else: out.append(pts[i])
        return np.array(out)

def joints_for(round_):
    c0, ax0 = elbow_axis(); g0 = gh_centre()
    # elbow wrap cylinder r = 18 mm (posterior trochlea / olecranon), glenohumeral r = 26 mm (humeral head 22.5 mm + cuff)
    def elbow(P): return apply(P['arm'], c0[None])[0], P['arm'][0] @ ax0, 18.0
    def gh(P): return apply(P['girdle'], g0[None])[0], np.array([0.0, 1.0, 0.0]), 26.0
    return {('arm', 'fore'): elbow, ('girdle', 'arm'): gh, ('trunk', 'arm'): gh}

def length(pts): return float(np.linalg.norm(np.diff(pts, axis=0), axis=1).sum())
