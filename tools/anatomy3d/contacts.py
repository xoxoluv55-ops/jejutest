import sys; sys.path.insert(0,'.')
import numpy as np
from model import *
bones = ['clavicle','scapula','humerus','radius','ulna','sternum','cartilage','ribs']
for m, fids in TARGET.items():
    for f in fids:
        row = []
        for b in bones:
            P, V, d = contact(f, b, 2.5)
            if len(P): row.append(f"{b}:{len(P)}(z{P[:,2].min():.0f}..{P[:,2].max():.0f})")
        print(m, f, len(load(f)[0]), '|', '  '.join(row))
