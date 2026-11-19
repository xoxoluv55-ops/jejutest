"""Check every attachment site against its TEXTBOOK REGION on the bone (not just distance to a bone surface).

Long bones: position along the bone (0 = proximal end, 1 = distal end, from the bone's principal axis) and the
surface it lies on (anterior / posterior / lateral / medial, from the offset to the bone axis in the horizontal
plane; BP3D axes: anterior = -Y, lateral (right limb) = -X). Clavicle: fraction from the sternal (0) to the acromial
end (1). Scapula: position relative to the glenoid centre (scapula surface point nearest the fitted humeral-head
centre). Criteria are the usual textbook descriptions (Gray's Anatomy / Moore, Clinically Oriented Anatomy).
"""
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from model import merge, BONES
from atts import compute
from motion import gh_centre, btree

A = {k: v[0] for k, v in compute().items()}

def long_bone(name):
    V, F = merge(BONES[name]); c = V.mean(0)
    u = np.linalg.svd(V - c, full_matrices=False)[2][0]
    if u[2] < 0: u = -u                       # u points proximally (up)
    t = (V - c) @ u
    return c, u, t.max(), t.min()

def along(name, p):
    c, u, tp, td = long_bone(name); t = (p - c) @ u
    return (tp - t) / (tp - td)

def surface(name, p):
    c, u, tp, td = long_bone(name); t = (p - c) @ u
    V, F = merge(BONES[name]); near = V[np.abs((V - c) @ u - t) < 6]
    ctr = near.mean(0) if len(near) > 5 else c + u * t
    d = p - ctr; d = d - u * (d @ u)
    side = {'anterior': -d[1], 'posterior': d[1], 'lateral': -d[0], 'medial': d[0]}
    best = max(side, key=side.get)
    # surfaces whose component is >= 70% of the dominant one (e.g. 'anteromedial' counts as anterior and medial)
    near_sides = {k for k, v in side.items() if v >= 0.7 * side[best] and v > 0}
    return best, near_sides, np.linalg.norm(d[:2])

def clav_frac(p):
    V, F = merge(BONES['clavicle']); x0, x1 = V[:, 0].max(), V[:, 0].min()   # sternal end (medial, +X) -> acromial end (-X)
    return (x0 - p[0]) / (x0 - x1)

LONG = {  # site: (bone, (s_min, s_max), allowed surfaces, textbook description)
    'greater': ('humerus', (0.0, 0.12), {'lateral', 'anterior', 'posterior'}, 'proximal humerus, lateral (greater tubercle)'),
    'groove': ('humerus', (0.05, 0.30), {'anterior', 'lateral'}, 'lateral lip of the intertubercular sulcus, proximal anterior humerus'),
    'grooveFloor': ('humerus', (0.05, 0.30), {'anterior', 'medial'}, 'floor of the intertubercular sulcus (between the lips)'),
    'deltTub': ('humerus', (0.28, 0.55), {'lateral'}, 'deltoid tuberosity, lateral surface at mid-shaft'),
    'humMed': ('humerus', (0.30, 0.60), {'medial', 'anterior'}, 'medial border/surface at mid-shaft (coracobrachialis)'),
    'humAnt': ('humerus', (0.45, 0.95), {'anterior'}, 'anterior surface, distal half (brachialis)'),
    'latSupra': ('humerus', (0.60, 0.92), {'lateral'}, 'lateral supracondylar ridge, distal third'),
    'medEpi': ('humerus', (0.85, 1.0), {'medial'}, 'medial epicondyle'),
    'radTub': ('radius', (0.04, 0.25), {'anterior', 'medial'}, 'radial tuberosity, proximal anteromedial radius'),
    'radStyloid': ('radius', (0.80, 1.0), {'lateral', 'anterior'}, 'base of the radial styloid, distal lateral radius'),
    'ulnTub': ('ulna', (0.03, 0.22), {'anterior'}, 'ulnar tuberosity / coronoid, proximal anterior ulna'),
    'olecranon': ('ulna', (0.0, 0.12), {'posterior', 'lateral', 'medial'}, 'olecranon, proximal posterior ulna'),
}

def main():
    rows = []
    for k, (b, (s0, s1), sides, desc) in LONG.items():
        p = A[k]; s = along(b, p); sd, ns, off = surface(b, p)
        ok = s0 <= s <= s1 and bool(ns & sides)
        rows.append((k, desc, f'{b} {s:.2f} of length · {"+".join(sorted(ns))}', f'{s0:.2f}–{s1:.2f} · {"/".join(sorted(sides))}', ok))
    for k, (lo, hi, desc) in {'clavLat': (0.62, 1.0, 'lateral third of the clavicle'), 'clavMed': (0.0, 0.52, 'medial half of the clavicle')}.items():
        f = clav_frac(A[k]); rows.append((k, desc, f'clavicle {f:.2f} from sternal end', f'{lo:.2f}–{hi:.2f}', lo <= f <= hi))
    # scapula, relative to the glenoid centre = centroid of the glenoid face (scapula surface within 6 mm of the
    # humeral-head sphere); rim = top/bottom of that face
    hh = gh_centre(); Vh, _ = merge(BONES['humerus']); top = Vh[Vh[:, 2] > Vh[:, 2].max() - 50]
    R = np.median(np.linalg.norm(top - hh, axis=1)); S = btree('scapula').data
    face = S[np.linalg.norm(S - hh, axis=1) < R + 6]; G = face.mean(0); rt, rb = face[:, 2].max() - G[2], face[:, 2].min() - G[2]
    print(f'glenoid face: height {face[:, 2].max() - face[:, 2].min():.1f} mm (rim +{rt:.1f} / {rb:.1f} mm from centre)\n')
    rel = lambda k: A[k] - G
    def fmt(v): return f'sup {v[2]:+.0f} · ant {-v[1]:+.0f} · med {v[0]:+.0f} mm'
    sc = {
        'supraglenoid': ('just above the glenoid rim', lambda v: rt - 3 < v[2] < rt + 10),
        'infraglenoid': ('just below the glenoid rim', lambda v: rb - 15 < v[2] < rb + 3),
        'coracoid': ('anterior, superior and medial to the glenoid', lambda v: -v[1] > 10 and v[2] > 0 and v[0] > 0),
        'acromion': ('above the glenoid / humeral head', lambda v: v[2] > 10),
        'spine': ('posterior to the glenoid, medial to the acromion', lambda v: v[1] > 10 and A['spine'][0] > A['acromion'][0]),
        'supraFossa': ('posterior, above the spine, medial', lambda v: v[1] > 0 and A['supraFossa'][2] > A['spine'][2] and v[0] > 15),
    }
    for k, (desc, fn) in sc.items():
        v = rel(k); rows.append((k, desc, 'scapula: ' + fmt(v), 'relative to glenoid centre', bool(fn(v))))
    # sternum / costal cartilages
    p = A['sternum']; ds = btree('sternum').query(p[None])[0][0]; dc = btree('cartilage').query(p[None])[0][0]
    rows.append(('sternum', 'anterior sternum / costal cartilages 1–6', f'{ds:.1f} mm to sternum, {dc:.1f} mm to cartilage', '< 6 mm', min(ds, dc) < 6))
    print('| site | textbook region | measured on the model | criterion | result |')
    print('|---|---|---|---|---|')
    for k, desc, meas, crit, ok in rows: print(f'| {k} | {desc} | {meas} | {crit} | {"✅" if ok else "❌"} |')
    print(f'\n{sum(r[4] for r in rows)}/{len(rows)} sites inside their textbook region.')

if __name__ == '__main__':
    main()
