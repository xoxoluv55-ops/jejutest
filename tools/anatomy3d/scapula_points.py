"""Measure four anterior-visible scapula landmarks on the BodyParts3D mesh, in scapula-image coords (density 2 px).
acromion = most lateral point of the top 12 % of the bone; coracoid = most anterior (Y-) point;
glenoid = centroid of the scapula surface facing the humeral head (same as ch1_bones.py); inferior angle = lowest point.
Appends {"scapulaPoints": {...}} to app/public/assets/ch1/bones.json.
"""
import sys, os, json; sys.path.insert(0, os.path.dirname(__file__))
import numpy as np
from model import BONES, merge, weld, to_frame
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'app', 'public', 'assets', 'ch1', 'bones.json')
man = json.load(open(OUT))
V, F = merge(BONES['scapula']); V, F = weld(V, F)
H, Fh = merge(BONES['humerus']); H, Fh = weld(H, Fh)
z0, z1 = V[:, 2].min(), V[:, 2].max()
top = V[V[:, 2] > z1 - 0.12 * (z1 - z0)]
acromion = top[np.argmin(top[:, 0])]                 # X- = right side = lateral (frame x smaller)
coracoid = V[np.argmin(V[:, 1])]                     # Y- = anterior
inf = V[np.argmin(V[:, 2])]
topH = H[H[:, 2] > H[:, 2].max() - 45]; med = topH[topH[:, 0] > np.median(topH[:, 0])]
A = np.c_[2 * med, np.ones(len(med))]; c = np.linalg.lstsq(A, (med ** 2).sum(1), rcond=None)[0]; head = c[:3]; r = np.sqrt(c[3] + (head ** 2).sum())
glen = V[np.linalg.norm(V - head, axis=1) < r + 6].mean(0)
rect = man['rects']['scapula']
def img(p):
    q = to_frame(np.asarray(p, float)[None])[0]
    return [round((float(q[0]) - rect['x']) * 2, 1), round((float(q[1]) - rect['y']) * 2, 1)]
pts = dict(acromion=img(acromion), coracoid=img(coracoid), glenoid=img(glen), inferiorAngle=img(inf))
man['scapulaPoints'] = pts
json.dump(man, open(OUT, 'w'))
print(pts, 'image size', rect['w'] * 2, rect['h'] * 2)
