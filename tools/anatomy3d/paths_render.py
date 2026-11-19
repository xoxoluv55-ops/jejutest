"""Per-frame muscle lines of action (paths.py) projected into the motion-frame images -> <out>/<round>_paths.json
usage: python3 paths_render.py <outdir>
Projection constants must match motion_render.py (VIEWS below).
"""
import sys, os, json; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from paths import Path, joints_for, length
from motion import pose_elbow, pose_shoulder

VIEWS = {   # = motion_render.py
    'elbow': dict(SC=2.4, M=[[0, -1, 0], [0, 0, 1], [-1, 0, 0]], BOX=dict(u0=-45, u1=470, z0=760, z1=1500), ANG=list(range(0, 141, 10)), pose=pose_elbow),
    'shoulder': dict(SC=1.55, M=[[1, 0, 0], [0, 0, 1], [0, -1, 0]], BOX=dict(u0=-990, u1=60, z0=640, z1=1560), ANG=list(range(0, 91, 10)), pose=pose_shoulder),
}
# (muscle, element, drawn?) — the deep medial head of triceps counts for length but is not drawn (it lies on the
# bone, hidden by the lateral head in this view, and its path still touches bone near 60 deg; see report)
ELEMS = {
    'elbow': [('deltoid', 'FJ1467', True), ('biceps', 'FJ1478', True), ('biceps', 'FJ1512', True), ('brachialis', 'FJ1486', True),
              ('brachioradialis', 'FJ1487', True), ('triceps', 'FJ1479', True), ('triceps', 'FJ1477', True), ('triceps', 'FJ1480', False)],
    'shoulder': [('deltoid', 'FJ1467', True), ('deltoid', 'FJ1468', True), ('deltoid', 'FJ1513', True), ('supraspinatus', 'FJ1506', True),
                 ('pecmajor', 'FJ1447', True), ('pecmajor', 'FJ1464', True), ('pecmajor', 'FJ1446', True), ('latissimus', 'LAT3', True),
                 ('brachialis', 'FJ1486', True)],
}

# textbook direction of length change for the target movement (sign): agonists shorten, antagonists lengthen.
# A frame whose model path disagrees by more than 2 % is marked unreliable (null) and the game says so instead of
# showing a direction - e.g. supraspinatus past ~45 deg under this simplified shoulder kinematics.
EXPECT = {'elbow': {'biceps': -1, 'brachialis': -1, 'brachioradialis': -1, 'triceps': 1, 'deltoid': 0},
          'shoulder': {'deltoid': -1, 'supraspinatus': -1, 'pecmajor': 1, 'latissimus': 1, 'brachialis': 0}}

OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
for rk, v in VIEWS.items():
    M = np.array(v['M'], float); B = v['BOX']; SC = v['SC']
    def proj(P):
        q = np.asarray(P) @ M.T
        return np.stack([(q[:, 0] - B['u0']) * SC / 2, (B['z1'] - q[:, 1]) * SC / 2], 1)     # logical px (density 2)
    J = joints_for(rk)
    paths = [(m, f, d, Path(m, f)) for m, f, d in ELEMS[rk]]
    frames = []; L0 = {}
    for ang in v['ANG']:
        P = v['pose'](ang); fr = dict(angle=ang, paths=[], length={})
        lens = {}
        for m, f, d, p in paths:
            pts = p.pose(P, J); lens.setdefault(m, 0.0); lens[m] += length(pts)
            if d: fr['paths'].append(dict(m=m, fid=f, w=round(p.width * SC / 2 * 0.55, 1), pts=np.round(proj(pts), 1).tolist()))
        if ang == 0: L0 = dict(lens)
        fr['length'] = {}
        for m, l in lens.items():
            d = l / L0[m] - 1; ex = EXPECT[rk].get(m)
            bad = ex is not None and ex != 0 and ang >= 20 and d * ex < 0.01     # wrong sign or ~no change
            fr['length'][m] = None if bad else round(d, 3)
        frames.append(fr)
        print(rk, ang, fr['length'], flush=True)
    json.dump(dict(round=rk, method='rigid bones + measured centre lines, cylinder wrapping (tools/anatomy3d/paths.py)', frames=frames),
              open(os.path.join(OUT, f'{rk}_paths.json'), 'w'))
print('done')
