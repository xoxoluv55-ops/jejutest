"""Slice the character asset sheet (docs/concept/concept_chars.png) into animation frames.
Each section is background-removed with rembg, split into frames by connected components,
cleaned (largest body only), aligned (feet on baseline, shared scale per animation) and saved.
Usage: python3 -I tools/cut_sheet.py <outdir>
"""
import os, sys, json
import numpy as np
from PIL import Image, ImageFilter
from rembg import remove, new_session
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHEET = Image.open(os.path.join(ROOT, 'docs', 'concept', 'concept_chars.png')).convert('RGB')
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'tmp_frames')
os.makedirs(OUT, exist_ok=True)
sess = new_session('isnet-general-use')
UP = 3

# (name, box, expected frame count)
SECTIONS = [
    ('base', (556, 62, 1112, 232), 4),
    ('idle', (342, 338, 706, 458), 4),
    ('walk', (728, 336, 1522, 458), 8),
    ('run', (20, 522, 832, 628), 8),
    ('interact', (858, 524, 1522, 628), 4),
    ('scan', (22, 690, 512, 800), 5),
    ('hit', (628, 690, 990, 800), 3),
    ('victory', (1008, 690, 1522, 800), 5),
    ('emote', (22, 866, 850, 962), 8),
    ('hero', (14, 196, 304, 482), 1),
]

def frames_of(name, box, n):
    crop = SHEET.crop(box)
    big = crop.resize((crop.width * UP, crop.height * UP), Image.LANCZOS)
    cut = np.array(remove(big, session=sess)).astype(np.float32)
    cut[..., :3] = np.array(big).astype(np.float32)   # keep original colours (visor blacks etc.)
    a = cut[..., 3]
    mask = a > 60
    mask = ndimage.binary_opening(mask, iterations=2)
    lab, k = ndimage.label(mask)
    if k == 0: return []
    sizes = ndimage.sum(mask, lab, range(1, k + 1))
    objs = ndimage.find_objects(lab)
    big_thr = sizes.max() * 0.25
    comps = [(objs[i], i + 1, sizes[i]) for i in range(k) if sizes[i] >= big_thr]
    comps.sort(key=lambda c: c[0][1].start)
    if len(comps) != n:
        print(f'  ! {name}: found {len(comps)} bodies, expected {n}')
    res = []
    for sl, idx, _ in comps:
        keep = lab == idx
        if name == 'run':
            # strip dust puff trailing at the lower-left of the body
            ys, xs = np.nonzero(keep)
            top = ys.min(); h = ys.max() - top
            head = keep[top: top + int(h * 0.45)]
            hx = np.nonzero(head.any(axis=0))[0]
            cutx = hx.min() - int((hx.max() - hx.min()) * 0.12)
            keep[:, :max(0, cutx)] = False
            lab2, k2 = ndimage.label(keep)
            if k2 > 1:
                sz = ndimage.sum(keep, lab2, range(1, k2 + 1)); keep = lab2 == (int(np.argmax(sz)) + 1)
        filled = ndimage.binary_fill_holes(keep)
        holes = filled & ~keep
        keep = ndimage.binary_dilation(filled, iterations=3)
        rgba = cut.copy()
        rgba[..., 3] = np.where(keep, rgba[..., 3], 0)
        rgba[..., 3][holes] = 255
        # interior of the body: solid (rembg sometimes thins the black visor)
        core = ndimage.binary_erosion(filled, iterations=6)
        rgba[..., 3][core] = 255
        if name in ('run', 'walk'):
            # speed lines / dust behind the head (sprite faces right; visor is on the right half)
            ys, xs = np.nonzero(rgba[..., 3] > 0)
            top, bot = ys.min(), ys.max(); h = bot - top
            head = rgba[top: top + int(h * 0.45), :, 3] > 0
            hx = np.nonzero(head.any(axis=0))[0]; hcx = (hx.min() + hx.max()) / 2; hw = hx.max() - hx.min()
            lum = rgba[..., :3].mean(axis=2)
            X = np.arange(rgba.shape[1])[None, :].repeat(rgba.shape[0], 0)
            Y0 = np.arange(rgba.shape[0])[:, None].repeat(rgba.shape[1], 1)
            rgba[..., 3][(lum < 70) & (X < hcx - hw * 0.15) & ~core] = 0
            rgba[..., 3][(lum < 60) & (Y0 > top + h * 0.9)] = 0
            Y = np.arange(rgba.shape[0])[:, None].repeat(rgba.shape[1], 1)
            rgba[..., 3][(Y > top + h * 0.72) & (X < hx.min() - hw * 0.02)] = 0
            m2 = rgba[..., 3] > 40
            lab3, k3 = ndimage.label(m2)
            if k3 > 1:
                sz = ndimage.sum(m2, lab3, range(1, k3 + 1)); big = lab3 == (int(np.argmax(sz)) + 1)
                rgba[..., 3][~ndimage.binary_dilation(big, iterations=2)] = 0
        # drop dark semi-transparent halo / floor shadow
        lum = rgba[..., :3].mean(axis=2)
        rgba[..., 3][(lum < 45) & (rgba[..., 3] < 230)] = 0
        im = Image.fromarray(rgba.astype(np.uint8))
        alpha = im.split()[3].filter(ImageFilter.GaussianBlur(0.6))
        im.putalpha(alpha)
        bb = im.getbbox()
        res.append(im.crop(bb))
    return res

meta = {}
for name, box, n in SECTIONS:
    fr = frames_of(name, box, n)
    print(name, len(fr), [f.size for f in fr])
    for i, f in enumerate(fr):
        f.save(os.path.join(OUT, f'{name}_{i}.png'))
    meta[name] = len(fr)
json.dump(meta, open(os.path.join(OUT, 'meta.json'), 'w'))
