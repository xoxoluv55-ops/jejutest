"""Attachment sites measured on the model: centroid of muscle vertices touching the bone surface (<2.5 mm)."""
import sys, os; sys.path.insert(0, os.path.dirname(__file__))
import numpy as np
from model import *

def pick(P, sel):
    if sel is None or len(P) == 0: return P
    ax, side, frac = sel          # e.g. ('z','low',0.35): keep the lowest 35% of the contact range along z
    i = {'x': 0, 'y': 1, 'z': 2}[ax]
    lo, hi = P[:, i].min(), P[:, i].max(); r = hi - lo
    return P[P[:, i] <= lo + r * frac] if side == 'low' else P[P[:, i] >= hi - r * frac]

def site(fids, bone, sel=None, thr=2.5):
    fids = fids if isinstance(fids, list) else [fids]
    bones = bone if isinstance(bone, list) else [bone]
    pts = []
    for f in fids:
        for b in bones:
            P, _, _ = contact(f, b, thr); pts.append(P)
    P = pick(np.concatenate(pts), sel)
    return P.mean(0), len(P)

# id: (muscle elements, bone, selector, expected landmark text)
DEF = {
    'clavLat': ('FJ1468', 'clavicle', None),
    'acromion': ('FJ1467', 'scapula', None),
    'spine': ('FJ1513', 'scapula', None),
    'deltTub': (['FJ1468', 'FJ1467', 'FJ1513'], 'humerus', ('z', 'low', 0.25)),
    'clavMed': ('FJ1447', 'clavicle', None),
    'sternum': ('FJ1464', ['sternum', 'cartilage'], None),
    'groove': (['FJ1447', 'FJ1464', 'FJ1446'], 'humerus', None),
    'coracoid': (['FJ1512', 'FJ1488'], 'scapula', None),
    'supraglenoid': ('FJ1478', 'scapula', None),
    'infraglenoid': ('FJ1479', 'scapula', None),
    'supraFossa': ('FJ1506', 'scapula', None),
    'greater': ('FJ1506', 'humerus', None),
    'humMed': ('FJ1488', 'humerus', None),
    'humAnt': ('FJ1486', 'humerus', None),
    'ulnTub': ('FJ1486', 'ulna', None),
    'radTub': ('FJ1478', 'radius', None),
    'latSupra': ('FJ1487', 'humerus', None),
    'radStyloid': ('FJ1487', 'radius', ('z', 'low', 0.5)),
    'olecranon': (['FJ1479', 'FJ1477', 'FJ1480'], 'ulna', None),
}

def compute():
    out = {}
    for k, (f, b, sel) in DEF.items():
        p, n = site(f, b, sel); out[k] = (p, n)
    # medial epicondyle: most medial point of the distal humerus
    V, F = merge(BONES['humerus']); d = V[V[:, 2] < V[:, 2].min() + 60]
    out['medEpi'] = (d[np.argmax(d[:, 0])], 1)
    # latissimus dorsi is NOT in BodyParts3D 4.0: its insertion (floor of the intertubercular groove) lies between
    # the pectoralis major (lateral lip) and teres major (medial lip) insertions -> midpoint of those two measured sites
    tm, _ = site('FJ1507', 'humerus')
    out['grooveFloor'] = ((out['groove'][0] + tm) / 2, 0)
    out['teresMajorIns'] = (tm, 0)
    # thoracolumbar fascia / T7-L5 spinous processes: posterior midline, lower thoracic level (schematic, posterior)
    out['thoracolumbar'] = (np.array([-8.0, 40.0, 1040.0]), 0)
    return out

if __name__ == '__main__':
    A = compute()
    for k, (p, n) in A.items():
        fx, fy, fd = to_frame(p)
        print(f"{k:14s} n={n:4d}  mm=({p[0]:7.1f},{p[1]:7.1f},{p[2]:7.1f})  frame=({fx:6.1f},{fy:6.1f}) depth={fd:6.1f}")
