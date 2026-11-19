"""Audit of the (old) straight-line muscle deformation used for the motion frames.
For elbow flexion 0/30/60/90/120/140 deg and each elbow muscle element:
  stretch  = posed / rest edge length (p99, max)        -> abnormal stretching / tearing
  inside   = % of muscle vertices inside a posed bone   -> muscle passing through the joint / bone
  kink     = sharpest bend of the muscle centre line (deg, rest vs posed)
Inside test = generalized winding number against the bone triangle mesh (robust to concave shapes).
"""
import sys, os, json, math; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from model import merge, weld, BONES
from motion import Elem, pose_elbow, apply

def winding(P, V, F, chunk=400):
    A, B, C = V[F[:, 0]], V[F[:, 1]], V[F[:, 2]]
    w = np.zeros(len(P))
    for s in range(0, len(P), chunk):
        p = P[s:s + chunk, None, :]
        a, b, c = A[None] - p, B[None] - p, C[None] - p
        la, lb, lc = np.linalg.norm(a, axis=2), np.linalg.norm(b, axis=2), np.linalg.norm(c, axis=2)
        det = np.einsum('ijk,ijk->ij', a, np.cross(b, c))
        den = la * lb * lc + np.einsum('ijk,ijk->ij', a, b) * lc + np.einsum('ijk,ijk->ij', b, c) * la + np.einsum('ijk,ijk->ij', c, a) * lb
        w[s:s + chunk] = (2 * np.arctan2(det, den)).sum(1) / (4 * math.pi)
    return np.abs(w)

def centreline(V, O, I, n=20):
    a = (I - O) / np.linalg.norm(I - O); t = (V - O) @ a
    edges = np.linspace(t.min(), t.max(), n + 1); pts = []
    for k in range(n):
        m = (t >= edges[k]) & (t < edges[k + 1])
        if m.sum() > 3: pts.append(V[m].mean(0))
    return np.array(pts)

def max_bend(L):
    d = np.diff(L, axis=0); d /= np.linalg.norm(d, axis=1, keepdims=True)
    return float(np.degrees(np.arccos(np.clip((d[1:] * d[:-1]).sum(1), -1, 1))).max())

if __name__ == '__main__':
    BN = {b: weld(*merge(BONES[b])) for b in ['humerus', 'radius', 'ulna']}
    SEG = {'humerus': 'arm', 'radius': 'fore', 'ulna': 'fore'}
    els = [('biceps', 'FJ1478'), ('biceps', 'FJ1512'), ('brachialis', 'FJ1486'), ('brachioradialis', 'FJ1487'), ('triceps', 'FJ1479'), ('triceps', 'FJ1477'), ('triceps', 'FJ1480')]
    E = [Elem(m, f) for m, f in els]
    rest_edges = {}
    out = {}
    for e in E:
        F = e.F; rest_edges[e.fid] = np.linalg.norm(e.V[F[:, 0]] - e.V[F[:, 1]], axis=1)
    print('| angle | element | stretch p99 | stretch max | inside bone % | centre-line max bend (rest → posed) |')
    print('|---|---|---|---|---|---|')
    for ang in [0, 30, 60, 90, 120, 140]:
        P = pose_elbow(ang)
        for e in E:
            V, _, _ = e.pose(P)
            el = np.linalg.norm(V[e.F[:, 0]] - V[e.F[:, 1]], axis=1) / np.maximum(rest_edges[e.fid], 1e-6)
            inside = np.zeros(len(V), bool)
            for b, (BV, BF) in BN.items():
                inside |= winding(V, apply(P[SEG[b]], BV), BF) > 0.5
            # ignore vertices that are inside a bone already at rest (attachment overlap in the source data)
            if ang == 0: e.rest_inside = inside.copy()
            new_inside = inside & ~e.rest_inside
            kr = max_bend(centreline(e.V, e.O, e.I)); kp = max_bend(centreline(V, apply(P[e.oseg], e.O[None])[0], apply(P[e.iseg], e.I[None])[0]))
            out.setdefault(e.fid, []).append(dict(angle=ang, p99=float(np.percentile(el, 99)), max=float(el.max()), inside=float(new_inside.mean() * 100), bend=kp))
            print(f'| {ang}° | {e.g} {e.fid} | ×{np.percentile(el, 99):.2f} | ×{el.max():.2f} | {new_inside.mean() * 100:.1f} | {kr:.0f}° → {kp:.0f}° |')
    json.dump(out, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'deform_audit.json'), 'w'), indent=1)
