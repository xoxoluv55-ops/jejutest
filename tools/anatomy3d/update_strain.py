"""Rewrite the per-frame muscle length change in the exported motion json with the fibre-mean metric (excursion.py).
The game only uses the SIGN (shortens / lengthens / unchanged); the numbers stay in the json for the report."""
import sys, os, json; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from model import TARGET
from motion import Elem, pose_elbow, pose_shoulder
from excursion import fibres, length
D = sys.argv[1]
for rk, fn, sub in [('elbow', pose_elbow, {}), ('shoulder', pose_shoulder, {'deltoid': ['FJ1467']})]:
    p = os.path.join(D, rk + '.json'); m = json.load(open(p))
    keys = list(m['frames'][0]['strain']) + (['latissimus'] if rk == 'shoulder' else [])
    src = dict(TARGET, latissimus=['LAT3'])
    es = {k: [Elem(k, f) for f in src[k] if f in sub.get(k, src[k])] for k in dict.fromkeys(keys)}
    fb = {k: [fibres(e) for e in v] for k, v in es.items()}
    for fr in m['frames']:
        for k, v in es.items():
            L0 = sum(length(e, P, fn, 0) for e, P in zip(v, fb[k])); L = sum(length(e, P, fn, fr['angle']) for e, P in zip(v, fb[k]))
            fr['strain'][k] = round(L / L0 - 1, 3)
    m['strain_note'] = 'approximation: mean straight fibre line from every origin-contact vertex to the insertion; not validated against measurement'
    json.dump(m, open(p, 'w'), indent=1)
    print(rk, [(f['angle'], f['strain']) for f in m['frames'][::3]])
