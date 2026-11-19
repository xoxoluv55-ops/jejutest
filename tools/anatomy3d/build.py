"""Build the render scene (meshes + per-vertex tendon/fibre attributes) for the CH2 anatomy plates.

usage: python3 build.py anterior <out_scene.json>
"""
import sys, os, json, base64; sys.path.insert(0, os.path.dirname(__file__))
import numpy as np
from model import *
from atts import site

MUS_RED = [0.70, 0.17, 0.17]
CTX_RED = [0.60, 0.22, 0.22]
BONE = [0.92, 0.87, 0.76]
CART = [0.78, 0.85, 0.87]

# element -> (origin bones, origin selector, insertion bones, insertion selector)
ELEM = {
    'FJ1468': ('clavicle', None, 'humerus', ('z', 'low', 0.25)),
    'FJ1467': ('scapula', None, 'humerus', ('z', 'low', 0.25)),
    'FJ1513': ('scapula', None, 'humerus', ('z', 'low', 0.25)),
    'FJ1447': ('clavicle', None, 'humerus', None),
    'FJ1464': (['sternum', 'cartilage'], None, 'humerus', None),
    'FJ1446': ('cartilage', None, 'humerus', None),
    'FJ1478': ('scapula', None, 'radius', None),
    'FJ1512': ('scapula', None, ('FJ1478', 'radius'), None),
    'FJ1486': ('humerus', None, 'ulna', None),
    'FJ1488': ('scapula', None, 'humerus', None),
    'FJ1487': ('humerus', None, 'radius', ('z', 'low', 0.5)),
    'FJ1479': ('scapula', None, 'ulna', None),
    'FJ1477': ('humerus', None, 'ulna', None),
    'FJ1480': ('humerus', None, 'ulna', None),
    'FJ1506': ('scapula', None, 'humerus', None),
    'LAT3': ('ribs', None, 'humerus', None),          # latissimus dorsi (release 3.0 mesh, CC BY-SA 2.1 JP)
}

def ends(fid, V):
    """(O, I) in mm for an element: measured contacts for targets, principal-axis extremes for context muscles."""
    if fid in ELEM:
        ob, osel, ib, isel = ELEM[fid]
        O, _ = site(fid, ob, osel)
        I, _ = site(ib[0], ib[1]) if isinstance(ib, tuple) else site(fid, ib, isel)
        return O, I
    c = V.mean(0); u, s, vt = np.linalg.svd(V - c, full_matrices=False); a = vt[0]
    t = (V - c) @ a
    O, I = c + a * t.max(), c + a * t.min()
    if O[2] < I[2]: O, I = I, O            # origin = proximal (higher)
    return O, I

# fleshy (non-tendinous) origins: brachialis, lateral & medial heads of triceps
FLESHY_O = {'FJ1486', 'FJ1477', 'FJ1480'}

def attributes(V, O, I, fleshy_origin=False):
    """per-vertex tendon factor (thin cross-sections near the ends) and fibre direction."""
    ax = I - O; L = np.linalg.norm(ax); a = ax / L
    t = (V - O) @ a / L
    nb = 48; lo, hi = t.min(), t.max()
    b = np.clip(((t - lo) / (hi - lo + 1e-9) * nb).astype(int), 0, nb - 1)
    r = np.zeros(nb)
    for k in range(nb):
        P = V[b == k]
        if len(P) < 3: r[k] = np.nan; continue
        Q = P - P.mean(0); Q = Q - np.outer(Q @ a, a)
        r[k] = np.sqrt((Q ** 2).sum(1).mean())
    r = np.where(np.isnan(r), np.nanmin(r), r)
    r = np.convolve(np.pad(r, 2, mode='edge'), np.ones(5) / 5, mode='valid')
    rr = r / r.max()
    tb = np.clip((0.34 - rr) / 0.14, 0, 1)
    tn = (np.arange(nb) + 0.5) / nb
    endw = np.clip((np.abs(tn - 0.5) - 0.18) / 0.12, 0, 1)          # tendons only toward the ends
    if fleshy_origin:
        endw = np.where(tn < 0.5, 0, endw)                          # t grows from origin toward insertion
    ten = (tb * endw)[b]
    toI = I - V; dI = np.linalg.norm(toI, axis=1, keepdims=True)
    w = np.clip(dI / (0.3 * L), 0, 1)
    f = toI / np.maximum(dI, 1e-6) * w + a * (1 - w)
    f = np.where(ten[:, None] > 0.5, a, f)
    f /= np.linalg.norm(f, axis=1, keepdims=True)
    # fibre coordinate: every point on one straight fibre toward the insertion shares the same direction from I,
    # so noise sampled on that direction (scaled to arc length) draws streaks exactly along the fascicles.
    return ten, f, t

def enc(a, dt): return base64.b64encode(np.ascontiguousarray(a, dtype=dt).tobytes()).decode()

def mesh_entry(name, V, F, kind, base, ten=None, fib=None):
    P = to_frame(V)
    P = np.stack([P[:, 0], -P[:, 1], P[:, 2]], 1)          # render space: y up
    if fib is None: fib = np.tile([0, 0, 1.0], (len(V), 1))
    fr = np.stack([fib[:, 0], fib[:, 2], -fib[:, 1]], 1)  # direction: X->x, Z->y(up), -Y->z
    if ten is None: ten = np.zeros(len(V))
    return dict(name=name, kind=kind, base=base, pos=enc(P, '<f4'), fib=enc(fr, '<f4'), ten=enc(ten, '<f4'), idx=enc(F, '<u4'))

def muscle_meshes(groups, base, sub=True, keep=None):
    out = []; info = {}
    for gname, fids in groups.items():
        for fid in fids:
            V, F = merge([fid]); V, F = weld(V, F)
            O, I = ends(fid, V)
            if sub: V, F = subdivide(V, F); V = taubin(V, F, 4)
            ten, fib, t = attributes(V, O, I, fid in FLESHY_O)
            out.append(mesh_entry(f'{gname}:{fid}', V, F, 0 if base is MUS_RED else 2, base, ten, fib))
            info[fid] = dict(O=O.tolist(), I=I.tolist())
    return out, info

def bone_meshes():
    out = []
    for g, fids in BONES.items():
        V, F = merge(fids); V, F = weld(V, F)
        if g not in ('ribs', 'hand'): V, F = subdivide(V, F); V = taubin(V, F, 3)
        out.append(mesh_entry(f'bone:{g}', V, F, 1, CART if g == 'cartilage' else BONE))
    return out

if __name__ == '__main__':
    outp = sys.argv[2]
    tm, tinfo = muscle_meshes(TARGET, MUS_RED)
    cm, cinfo = muscle_meshes(CONTEXT, CTX_RED, sub=True)
    bm = bone_meshes()
    json.dump(dict(meshes=tm + cm + bm), open(outp, 'w'))
    json.dump(dict(target=tinfo, context=cinfo), open(outp.replace('.json', '_ends.json'), 'w'))
    print('meshes', len(tm), len(cm), len(bm), 'size', os.path.getsize(outp) // 1024, 'KB')
