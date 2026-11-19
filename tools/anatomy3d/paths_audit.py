"""Audit of the line-of-action paths (paths.py): length change and % of the path inside a bone, per angle."""
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from paths import Path, joints_for, length
from motion import pose_elbow, pose_shoulder, apply
from model import merge, weld, BONES
from deform_audit import winding
print('| round | element | ' + ' | '.join(['0°', '30°', '60°', '90°', '120°', '140°']) + ' |'); print('|---' * 8 + '|')
for rnd, fn, els, angs, bones in [
    ('elbow', pose_elbow, [('biceps', 'FJ1478'), ('biceps', 'FJ1512'), ('brachialis', 'FJ1486'), ('brachioradialis', 'FJ1487'), ('triceps', 'FJ1479'), ('triceps', 'FJ1477'), ('triceps', 'FJ1480')], [0, 30, 60, 90, 120, 140], {'humerus': 'arm', 'radius': 'fore', 'ulna': 'fore'}),
    ('shoulder', pose_shoulder, [('deltoid', 'FJ1467'), ('deltoid', 'FJ1468'), ('deltoid', 'FJ1513'), ('supraspinatus', 'FJ1506'), ('pecmajor', 'FJ1447'), ('pecmajor', 'FJ1464'), ('pecmajor', 'FJ1446'), ('latissimus', 'LAT3')], [0, 30, 60, 90], {'humerus': 'arm', 'scapula': 'girdle', 'clavicle': 'girdle'})]:
    J = joints_for(rnd); BN = {b: weld(*merge(BONES[b])) for b in bones}
    for g, f in els:
        p = Path(g, f); L0 = length(p.pose(fn(0), J)); row = []
        for a in angs:
            P = fn(a); pts = p.pose(P, J)
            dense = np.concatenate([np.linspace(pts[i], pts[i + 1], 6, endpoint=False) for i in range(len(pts) - 1)]); k = len(dense); dense = dense[int(k * .1):int(k * .9)]
            ins = np.zeros(len(dense), bool)
            for b, (V, F) in BN.items(): ins |= winding(dense, apply(P[bones[b]], V), F) > 0.5
            row.append(f'{length(pts) / L0 - 1:+.0%} / {ins.mean() * 100:.0f}%')
        row += [''] * (6 - len(row))
        print(f'| {rnd} | {g} {f} | ' + ' | '.join(row) + ' |')
