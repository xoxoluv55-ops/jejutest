"""Measure landmarks on the ulna, humerus and clavicle meshes (BodyParts3D 4.0), in each bone's image px (density 2).
Frame: anterior view of the right arm, lateral = viewer's left (X- = lateral), Y- = anterior, Z = up.
  ulna:     olecranon = highest point; coronoid = most anterior point of the proximal 22 %;
            shaft = centroid of the 48-52 % band; styloid = lowest point; head = centroid of the distal 5-14 mm band
  humerus:  head = sphere fit (ch1_bones.py); greaterTubercle = most lateral point of the proximal 10 %;
            shaft = 50 % band centroid; lateralEpicondyle / medialEpicondyle = most lateral / medial point of the distal 12 %
  clavicle: sternalEnd = most medial point; acromialEnd = most lateral point
Appends {"points": {bone: {name: [x, y]}}} to app/public/assets/ch1/bones.json.
"""
import sys, os, json; sys.path.insert(0, os.path.dirname(__file__))
import numpy as np
from model import BONES, merge, weld, to_frame
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'app', 'public', 'assets', 'ch1', 'bones.json')
man = json.load(open(OUT))
def load(b): V, F = merge(BONES[b]); V, F = weld(V, F); return V
def band(V, a, b):
    z0, z1 = V[:, 2].min(), V[:, 2].max(); h = z1 - z0
    return V[(V[:, 2] >= z1 - b * h) & (V[:, 2] <= z1 - a * h)]
def img(b, p):
    r = man['rects'][b]; q = to_frame(np.asarray(p, float)[None])[0]
    return [round((float(q[0]) - r['x']) * 2, 1), round((float(q[1]) - r['y']) * 2, 1)]
pts = {}
def load_fib():
    # same rigid shift as ch1_bones.py (the fibula is rendered beside the forearm)
    Vf, _ = merge(['FJ3366']); Vf, _ = weld(Vf, _)
    rad = load('radius'); hum = load('humerus')
    shift = np.array([hum[:, 0].mean() - Vf[:, 0].mean(), rad[:, 1].mean() - Vf[:, 1].mean(), rad[:, 2].max() + 20 - Vf[:, 2].max()])
    return Vf + shift
U = load('ulna'); zmin = U[:, 2].min()
prox = band(U, 0, 0.22)
dist = U[(U[:, 2] > zmin + 5) & (U[:, 2] < zmin + 14)]
pts['ulna'] = dict(olecranon=img('ulna', U[np.argmax(U[:, 2])]), coronoid=img('ulna', prox[np.argmin(prox[:, 1])]),
                   shaft=img('ulna', band(U, 0.48, 0.52).mean(0)), head=img('ulna', dist.mean(0)), styloid=img('ulna', U[np.argmin(U[:, 2])]))
H = load('humerus')
top = band(H, 0, 0.10); low = band(H, 0.88, 1.0)
topH = H[H[:, 2] > H[:, 2].max() - 45]; med = topH[topH[:, 0] > np.median(topH[:, 0])]
A = np.c_[2 * med, np.ones(len(med))]; c = np.linalg.lstsq(A, (med ** 2).sum(1), rcond=None)[0]
pts['humerus'] = dict(head=img('humerus', c[:3]), greaterTubercle=img('humerus', top[np.argmin(top[:, 0])]),
                      shaft=img('humerus', band(H, 0.48, 0.52).mean(0)),
                      lateralEpicondyle=img('humerus', low[np.argmin(low[:, 0])]), medialEpicondyle=img('humerus', low[np.argmax(low[:, 0])]))
R_ = load('radius'); rz0, rz1 = R_[:, 2].min(), R_[:, 2].max(); rh = rz1 - rz0
tub = R_[(R_[:, 2] < rz1 - 0.10 * rh) & (R_[:, 2] > rz1 - 0.25 * rh)]
pts['radius'] = dict(head=img('radius', R_[R_[:, 2] > rz1 - 8].mean(0)), tuberosity=img('radius', tub[np.argmax(tub[:, 0])]),
                     shaft=img('radius', band(R_, 0.48, 0.52).mean(0)), styloid=img('radius', R_[np.argmin(R_[:, 2])]))
Fi = load_fib()
fz0, fz1 = Fi[:, 2].min(), Fi[:, 2].max()
pts['fibula'] = dict(head=img('fibula', Fi[Fi[:, 2] > fz1 - 10].mean(0)), shaft=img('fibula', band(Fi, 0.48, 0.52).mean(0)), malleolus=img('fibula', Fi[np.argmin(Fi[:, 2])]))
Cl = load('clavicle')
pts['clavicle'] = dict(sternalEnd=img('clavicle', Cl[np.argmax(Cl[:, 0])]), acromialEnd=img('clavicle', Cl[np.argmin(Cl[:, 0])]))
man['points'] = pts
json.dump(man, open(OUT, 'w'))
for b, p in pts.items(): print(b, p, 'img', man['rects'][b]['w'] * 2, man['rects'][b]['h'] * 2)
