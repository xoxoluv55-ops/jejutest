"""Muscle length / moment arm estimates from the posed model (APPROXIMATION, not validated against measurement).
Length of an element = mean over straight fibre lines from EVERY origin-contact vertex to the insertion site
(instead of one origin centroid, which underestimates the length of broad origins such as brachialis).
Moment arm = -dL/dtheta (mm/rad) by central differences."""
import sys, os, math; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from model import TARGET
from motion import Elem, pose_elbow, pose_shoulder, apply, WRAP, rot_angle
from atts import site
from model import contact
from build import ELEM

def fibres(e):
    ob = ELEM[e.fid][0]; ob = ob if isinstance(ob, list) else [ob]
    P = np.concatenate([contact(e.fid, b, 2.5)[0] for b in ob])
    return P

def length(e, P0, pose_fn, th):
    P = pose_fn(th); TO, TI = P[e.oseg], P[e.iseg]
    I1 = apply(TI, e.I[None])[0]
    if e.fid in WRAP and e.iseg == 'fore':
        a = rot_angle(P['arm'][0], TI[0]); I1 = apply(P['arm'], (e.I + e.a0 * WRAP[e.fid] * a)[None])[0]
    O1 = apply(TO, P0)
    return np.linalg.norm(O1 - I1, axis=1).mean()

def table(muscles, pose_fn, angles, sub=None):
    out = {}
    for m in muscles:
        es = [Elem(m, f) for f in TARGET[m] if (sub is None or f in sub.get(m, TARGET[m]))]
        rows = []
        for th in angles:
            L0 = sum(length(e, fibres(e), pose_fn, 0) for e in es) / len(es)
            L = sum(length(e, fibres(e), pose_fn, th) for e in es) / len(es)
            h = 2.0
            dL = (sum(length(e, fibres(e), pose_fn, th + h) for e in es) - sum(length(e, fibres(e), pose_fn, max(0, th - h)) for e in es)) / len(es)
            ma = -dL / math.radians(h + min(h, th))
            rows.append((th, L0, L, L / L0 - 1, ma))
        out[m] = rows
    return out

if __name__ == '__main__':
    for name, fn, angs, ms, sub in [('elbow', pose_elbow, [0, 45, 90, 140], ['biceps', 'brachialis', 'brachioradialis', 'triceps'], None),
                                    ('shoulder', pose_shoulder, [0, 45, 90], ['deltoid', 'supraspinatus', 'pecmajor'], {'deltoid': ['FJ1467']})]:
        t = table(ms, fn, angs, sub)
        for m, rows in t.items():
            print(name, m, ' '.join(f'{th}deg L={L:.0f}mm ({d*100:+.0f}%) MA={ma:.0f}mm' for th, L0, L, d, ma in rows))
