import zipfile, numpy as np, re, os, functools

ZIP = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'isa.zip')
_z = None
_names = None

def z():
    global _z, _names
    if _z is None:
        _z = zipfile.ZipFile(ZIP)
        _names = {os.path.basename(n)[:-4]: n for n in _z.namelist() if n.endswith('.obj')}
    return _z

def has(fid):
    z(); return fid in _names

def all_ids():
    z(); return list(_names.keys())

@functools.lru_cache(maxsize=None)
def load(fid):
    """-> (V float64 (N,3), F int (M,3)). 'LAT3' = latissimus dorsi from BodyParts3D 3.0 (CC BY-SA 2.1 JP),
    registered onto the 4.0 skeleton by latissimus.py"""
    if fid == 'LAT3':
        d = np.load(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lat_v4.npz'))
        return d['V'].astype(float), d['F'].astype(np.int64)
    txt = z().read(_names[fid]).decode('latin1')
    V = []; F = []
    for line in txt.splitlines():
        if line.startswith('v '):
            p = line.split(); V.append((float(p[1]), float(p[2]), float(p[3])))
        elif line.startswith('f '):
            idx = [int(t.split('/')[0]) for t in line.split()[1:]]
            for k in range(1, len(idx) - 1):
                F.append((idx[0] - 1, idx[k] - 1, idx[k + 1] - 1))
    return np.array(V), np.array(F, dtype=np.int64)

def bbox(fid):
    """fast bbox without faces"""
    txt = z().read(_names[fid]).decode('latin1')
    vs = [l for l in txt.splitlines() if l.startswith('v ')]
    a = np.array([[float(t) for t in l.split()[1:4]] for l in vs])
    return a.min(0), a.max(0), a.mean(0)
