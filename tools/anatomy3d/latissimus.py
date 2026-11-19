"""Latissimus dorsi for the CH2 art.

BodyParts3D 4.0 (CC BY 4.0) has no latissimus dorsi. Release 3.0 (2011, same source body) does:
FMA13358 'right latissimus dorsi', licensed CC BY-SA 2.1 JP ("BodyParts3D, Copyright (c) The Database Center for Life
Science licensed by CC Attribution-Share Alike 2.1 Japan"). Its bones are offset by ~1 cm from release 4.0, so the
muscle is registered onto the 4.0 skeleton with a rigid ICP fit of the bones it attaches to (humerus, lower ribs,
T7-L3 vertebrae, hip bone) + scapula. Every image derived from this mesh is CC BY-SA 2.1 JP and kept in separate files.

usage: python3 latissimus.py    (needs bp3.zip = BodyParts3D_3.0_obj_99.zip next to this file)
writes lat_v4.npz (vertices in 4.0 coordinates + faces) and prints the fit / contact report
"""
import sys, os, zipfile; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from scipy.spatial import cKDTree
from objio import load
HERE = os.path.dirname(os.path.abspath(__file__))
Z3 = zipfile.ZipFile(os.path.join(HERE, 'bp3.zip'))

def load3(fma):
    t = Z3.read('BodyParts3D_3.0_obj_99\\%s.obj' % fma).decode('latin1')
    V, F = [], []
    for l in t.splitlines():
        if l.startswith('v '): V.append([float(x) for x in l.split()[1:4]])
        elif l.startswith('f '):
            idx = [int(x.split('/')[0]) - 1 for x in l.split()[1:]]
            for k in range(1, len(idx) - 1): F.append([idx[0], idx[k], idx[k + 1]])
    return np.array(V), np.array(F)

# release 3.0 FMA id -> release 4.0 element id (same structure)
PAIRS = [('FMA23130', 'FJ3368'), ('FMA13395', 'FJ3384'), ('FMA8229', 'FJ3346'), ('FMA8283', 'FJ3347'), ('FMA8364', 'FJ3348'),
         ('FMA8445', 'FJ3330'), ('FMA8531', 'FJ3331'), ('FMA8533', 'FJ3332'), ('FMA9968', 'FJ3173'), ('FMA9991', 'FJ3174'),
         ('FMA10014', 'FJ3175'), ('FMA10037', 'FJ3154'), ('FMA10059', 'FJ3155'), ('FMA10081', 'FJ3156')]

def kabsch(P, Q):
    cp, cq = P.mean(0), Q.mean(0); H = (P - cp).T @ (Q - cq); U, S, Vt = np.linalg.svd(H)
    d = np.sign(np.linalg.det(Vt.T @ U.T)); D = np.diag([1, 1, d]); R = Vt.T @ D @ U.T
    return R, cq - R @ cp

def icp(src, dst, it=40):
    tree = cKDTree(dst); R, t = np.eye(3), dst.mean(0) - src.mean(0)
    for _ in range(it):
        X = src @ R.T + t; d, i = tree.query(X)
        keep = d < np.percentile(d, 90)
        R, t = kabsch(src[keep], dst[i[keep]])
    d, _ = tree.query(src @ R.T + t)
    return R, t, d

if __name__ == '__main__':
    src, dst, used = [], [], []
    for a, b in PAIRS:
        try: V3, _ = load3(a)
        except KeyError: continue
        V4, _ = load(b); src.append(V3); dst.append(V4); used.append(a)
    S, D = np.concatenate(src), np.concatenate(dst)
    d0 = cKDTree(D).query(S)[0]
    R, t, d = icp(S, D)
    ang = np.degrees(np.arccos(np.clip((np.trace(R) - 1) / 2, -1, 1)))
    print(f'fit on {len(used)} bones ({len(S)} pts): surface distance before {np.median(d0):.1f} mm median / after {np.median(d):.2f} mm median, 95% {np.percentile(d, 95):.2f} mm; rotation {ang:.2f} deg, shift {np.round(t, 1)}')
    for (a, b), V3 in zip([p for p in PAIRS if p[0] in used], src):
        V4, _ = load(b); dd = cKDTree(V4).query(V3 @ R.T + t)[0]
        print(f'  {a}->{b}: median {np.median(dd):.2f} mm')
    VL, FL = load3('FMA13358'); VL = VL @ R.T + t
    np.savez(os.path.join(HERE, 'lat_v4.npz'), V=VL, F=FL)
    # contacts with the 4.0 skeleton
    from model import contact, merge, BONES
    from motion import btree
    print('latissimus vertices', len(VL))
    for b in ['humerus', 'scapula', 'ribs']:
        dd = btree(b).query(VL)[0]; P = VL[dd < 2.5]
        print(f'  touches {b}: {len(P)} verts' + (f', z {P[:, 2].min():.0f}..{P[:, 2].max():.0f}' if len(P) else ''))
    # humeral insertion vs the groove between pectoralis major (lateral lip) and teres major (medial lip)
    dd = btree('humerus').query(VL)[0]; ins = VL[dd < 2.5].mean(0)
    from atts import site
    pm, _ = site(['FJ1447', 'FJ1464', 'FJ1446'], 'humerus'); tm, _ = site('FJ1507', 'humerus')
    print('  insertion', ins.round(1), ' pec major ins', pm.round(1), ' teres major ins', tm.round(1))
    ax = (pm - tm) / np.linalg.norm(pm - tm); f = (ins - tm) @ ax / np.linalg.norm(pm - tm)
    print(f'  insertion lies {f:.2f} of the way from the teres major (medial lip) to the pec major (lateral lip) insertion')
    np.save(os.path.join(HERE, 'lat_insertion.npy'), ins)
