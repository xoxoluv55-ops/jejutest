"""Z-Anatomy (CC BY-SA 4.0, derived from BodyParts3D) mesh access: dumps written by render/fbxdump.mjs.
Coordinates are converted to the BodyParts3D-like frame used elsewhere: mm, x = patient's left(+)/right(-)?? see frame()."""
import os, json, numpy as np
D = os.environ.get('ZA_DIR', '/tmp/claude-0/-home-user-jejutest/4e9bcd90-7cca-5e3d-a653-0b4e6dc5df0a/scratchpad/zadl')
_cache = {}
def lib(sys):
    if sys not in _cache:
        idx = json.load(open(os.path.join(D, sys + '.json'))); raw = open(os.path.join(D, sys + '.bin'), 'rb').read()
        _cache[sys] = ({m['name']: m for m in idx}, raw)
    return _cache[sys]
def names(sys): return list(lib(sys)[0])
def mesh(sys, name):
    idx, raw = lib(sys); m = idx[name]
    V = np.frombuffer(raw, np.float32, m['nv'] * 3, m['off']).reshape(-1, 3).astype(np.float64)
    I = np.frombuffer(raw, np.uint32, m['ni'], m['off'] + m['nv'] * 12) if m['ni'] else np.arange(m['nv'], dtype=np.uint32)
    return V, I.reshape(-1, 3)
