"""Post-processing for model renders: fibre texture by line-integral convolution along the rendered fibre-direction
field, tendon sheen, and thin boundary lines between structures (illustration style)."""
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

def load(p): return np.asarray(Image.open(p).convert('RGBA')).astype(np.float32) / 255.0

def id_map(idimg, palette):
    """palette: {name: (r,g,b)} -> int label per pixel (0 = empty, k = index+1), nearest colour (AA edges)."""
    names = list(palette.keys())
    cols = np.array([palette[n] for n in names], np.float32) / 255.0
    rgb = idimg[..., :3]; a = idimg[..., 3]
    best = np.zeros(rgb.shape[:2], np.int32); bd = np.full(rgb.shape[:2], 1e9, np.float32)
    for k, c in enumerate(cols):
        d = ((rgb - c) ** 2).sum(-1)
        m = d < bd; bd[m] = d[m]; best[m] = k + 1
    best[a < 0.5] = 0
    return best, names

def lic(dirf, mask, lab, length=16, sigma=0.8, seed=0):
    """streamline-integrated noise. dirf: (H,W,2) unit vectors in image coords (x right, y down)."""
    H, W = mask.shape
    rng = np.random.default_rng(seed)
    noise = ndi.gaussian_filter(rng.random((H, W)).astype(np.float32), sigma)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    acc = noise.copy(); wsum = np.ones_like(noise)
    for sgn in (1, -1):
        px, py = xx.copy(), yy.copy()
        alive = np.ones((H, W), bool)
        for s in range(length):
            dx = ndi.map_coordinates(dirf[..., 0], [py, px], order=1, mode='nearest')
            dy = ndi.map_coordinates(dirf[..., 1], [py, px], order=1, mode='nearest')
            px = px + sgn * dx; py = py + sgn * dy
            l2 = ndi.map_coordinates(lab.astype(np.float32), [py, px], order=0, mode='nearest')
            alive &= (l2 == lab)
            v = ndi.map_coordinates(noise, [py, px], order=1, mode='nearest')
            w = alive * (1.0 - s / length)
            acc += v * w; wsum += w
    out = acc / wsum
    m = mask
    if m.any():
        mu, sd = out[m].mean(), out[m].std() + 1e-6
        out = np.clip((out - mu) / (2.2 * sd) * 0.5 + 0.5, 0, 1)
    return out

def finish(color2x, dirimg, idimg, palette, muscle_names, outline=True, seed=0):
    """color2x: supersampled colour render (2x). dirimg/idimg at final res. Returns RGBA float image."""
    H, W = dirimg.shape[:2]
    col = np.asarray(Image.fromarray((color2x * 255).astype(np.uint8)).resize((W, H), Image.LANCZOS)).astype(np.float32) / 255.0
    lab, names = id_map(idimg, palette)
    mus_ids = [i + 1 for i, n in enumerate(names) if n in muscle_names]
    mmask = np.isin(lab, mus_ids)
    d = dirimg[..., :2] * 2 - 1
    dirf = np.stack([d[..., 0], -d[..., 1]], -1)             # render y-up -> image y-down
    nrm = np.linalg.norm(dirf, axis=-1, keepdims=True); dirf = dirf / np.maximum(nrm, 1e-4)
    ten = dirimg[..., 2]
    fine = lic(dirf, mmask, lab, length=22, sigma=0.65, seed=seed)
    bund = lic(dirf, mmask, lab, length=34, sigma=1.6, seed=seed + 7)
    t = np.clip((ten - 0.35) / 0.4, 0, 1)
    k_mus = (0.74 + 0.38 * fine) * (0.92 + 0.14 * bund)
    k_ten = 0.95 + 0.08 * fine
    k = np.where(mmask, k_mus * (1 - t) + k_ten * t, 1.0)
    rgb = col[..., :3] * k[..., None]
    # thin dark furrows between fascicle bundles
    furrow = np.clip((0.22 - bund) / 0.22, 0, 1) * (1 - t)
    rgb *= (1 - 0.22 * furrow * mmask)[..., None]
    if outline:
        e = np.zeros((H, W), bool)
        labf = ndi.median_filter(lab, size=3)
        for sh in [(0, 1), (1, 0)]:
            a = labf; b = np.roll(labf, sh, (0, 1))
            e |= (a != b) & ((a > 0) | (b > 0))
        e = ndi.binary_opening(ndi.binary_dilation(e, iterations=1), structure=np.ones((2, 2))) | e
        e = ndi.binary_dilation(e, iterations=1) & (lab > 0)
        lb, n = ndi.label(e); sz = ndi.sum(e, lb, range(1, n + 1)); e = np.isin(lb, 1 + np.where(sz >= 12)[0])
        rgb = np.where(e[..., None], rgb * 0.45, rgb)
    a = col[..., 3]
    return np.concatenate([np.clip(rgb, 0, 1), a[..., None]], -1), lab, names

def save(img, path, q=90):
    im = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8), 'RGBA')
    if path.endswith('.webp'): im.save(path, quality=q, method=6)
    else: im.save(path)
    return im
