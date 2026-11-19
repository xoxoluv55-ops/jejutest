"""Verification report for the CH2 model art -> markdown on stdout.
1. For each muscle element: which bones its mesh actually touches (< 2.5 mm), vs. the textbook origin/insertion.
2. Each attachment site used by the puzzles: distance from the bone surface it should lie on.
3. Muscle length change in the posed motion frames (agonists must shorten, antagonists lengthen).
usage: python3 verify.py <motion json dir>
"""
import sys, os, json; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from model import TARGET, to_frame, merge, BONES
from model import contact
from atts import compute, DEF
from motion import btree

EXPECT = {   # element: (textbook origin bone(s), insertion bone)
    'FJ1468': ('deltoid · clavicular part', ['clavicle'], 'humerus'),
    'FJ1467': ('deltoid · acromial part', ['scapula'], 'humerus'),
    'FJ1513': ('deltoid · spinal part', ['scapula'], 'humerus'),
    'FJ1447': ('pectoralis major · clavicular head', ['clavicle'], 'humerus'),
    'FJ1464': ('pectoralis major · sternocostal head', ['sternum', 'cartilage'], 'humerus'),
    'FJ1446': ('pectoralis major · abdominal part', ['cartilage'], 'humerus'),
    'FJ1478': ('biceps brachii · long head', ['scapula'], 'radius'),
    'FJ1512': ('biceps brachii · short head', ['scapula'], None),
    'FJ1486': ('brachialis', ['humerus'], 'ulna'),
    'FJ1488': ('coracobrachialis', ['scapula'], 'humerus'),
    'FJ1487': ('brachioradialis', ['humerus'], 'radius'),
    'FJ1479': ('triceps · long head', ['scapula'], 'ulna'),
    'FJ1477': ('triceps · lateral head', ['humerus'], 'ulna'),
    'FJ1480': ('triceps · medial head', ['humerus'], 'ulna'),
    'FJ1506': ('supraspinatus', ['scapula'], 'humerus'),
    'LAT3': ('latissimus dorsi (BodyParts3D 3.0, registered)', ['ribs', 'scapula'], 'humerus'),
}
SITE_BONE = {'clavLat': 'clavicle', 'acromion': 'scapula', 'spine': 'scapula', 'deltTub': 'humerus', 'clavMed': 'clavicle',
             'sternum': 'sternum', 'groove': 'humerus', 'coracoid': 'scapula', 'supraglenoid': 'scapula', 'infraglenoid': 'scapula',
             'supraFossa': 'scapula', 'greater': 'humerus', 'humMed': 'humerus', 'humAnt': 'humerus', 'ulnTub': 'ulna', 'radTub': 'radius',
             'latSupra': 'humerus', 'radStyloid': 'radius', 'olecranon': 'ulna', 'medEpi': 'humerus', 'grooveFloor': 'humerus'}

print('## 1. Muscle ↔ bone contacts measured on the model (vertices within 2.5 mm of the bone surface)\n')
print('| element | structure | touches (vertex count) | textbook origin → insertion | result |')
print('|---|---|---|---|---|')
for fid, (name, ob, ib) in EXPECT.items():
    touch = {}
    for b in ['clavicle', 'scapula', 'humerus', 'radius', 'ulna', 'sternum', 'cartilage', 'ribs']:
        P, _, _ = contact(fid, b, 2.5)
        if len(P) >= 5: touch[b] = len(P)
    ok = all(b in touch for b in ob) and (ib is None or ib in touch)
    note = '' if ib else ' (joins the long-head tendon to the radial tuberosity)'
    print(f"| {fid} | {name} | {', '.join(f'{k} {v}' for k, v in touch.items())} | {'/'.join(ob)} → {ib or 'common tendon'}{note} | {'✅' if ok else '❌'} |")

print('\n## 2. Attachment sites used by the puzzles (frame = anterior plate, logical units)\n')
print('| site | frame x, y | depth | lies on | distance to bone surface (mm) |')
print('|---|---|---|---|---|')
A = compute()
for k, (p, n) in A.items():
    if k not in SITE_BONE: continue
    fx, fy, fd = to_frame(p)
    d = btree(SITE_BONE[k]).query(p[None])[0][0] if SITE_BONE[k] != 'sternum' else min(btree('sternum').query(p[None])[0][0], btree('cartilage').query(p[None])[0][0])
    print(f'| {k} | {fx:.0f}, {fy:.0f} | {fd:.0f} | {SITE_BONE[k]} | {d:.1f} |')

md = sys.argv[1] if len(sys.argv) > 1 else None
if md:
    print('\n## 3. Muscle length in the posed frames (relative to rest) — model approximation, not shown as numbers in the game\n')
    for rk in ['elbow', 'shoulder']:
        m = json.load(open(os.path.join(md, rk + '.json')))
        keys = list(m['frames'][0]['strain'].keys())
        print(f'**{rk}**\n')
        print('| angle | ' + ' | '.join(keys) + ' |'); print('|---' * (len(keys) + 1) + '|')
        for fr in m['frames']:
            print(f"| {fr['angle']}° | " + ' | '.join(f"{fr['strain'][k] * 100:+.0f}%" for k in keys) + ' |')
        print()
