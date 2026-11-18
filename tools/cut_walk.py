"""Cut the dedicated front/back walk strips (docs/concept/walk_front.png, walk_back.png; 8 frames each)
into individual frames fwalk_<i>.png / bwalk_<i>.png in <frames_dir> (same dir as cut_sheet.py output).
Usage: python3 -I tools/cut_walk.py <frames_dir>
"""
import os, sys, json
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1]

def cut(path, prefix, n=8):
    src = Image.open(path).convert('RGB')
    # background = near-white region connected to the image border (the dark outline stops the fill,
    # so the white helmet stays). rembg is not used: it treats the white helmet as background.
    a = np.array(src).astype(np.float32)
    lum = a.mean(2); sat = a.max(2) - a.min(2)
    bgish = (lum > 228) & (sat < 22)
    lab0, _ = ndimage.label(bgish)
    border = set(np.unique(np.concatenate([lab0[0], lab0[-1], lab0[:, 0], lab0[:, -1]]))) - {0}
    bg = np.isin(lab0, list(border))
    rgba = np.dstack([a, np.where(bg, 0, 255).astype(np.float32)])
    mask = ndimage.binary_opening(~bg, iterations=2)
    lab, k = ndimage.label(mask)
    sizes = ndimage.sum(mask, lab, range(1, k + 1)); objs = ndimage.find_objects(lab)
    comps = [(objs[i], i + 1) for i in range(k) if sizes[i] >= sizes.max() * 0.25]
    comps.sort(key=lambda c: c[0][1].start)
    assert len(comps) == n, (prefix, len(comps))
    sizes_out = []
    for i, (sl, idx) in enumerate(comps):
        keep = lab == idx
        filled = ndimage.binary_fill_holes(keep)
        holes = filled & ~keep
        out = rgba.copy()
        out[..., 3] = np.where(ndimage.binary_dilation(filled, iterations=2), out[..., 3], 0)
        out[..., 3][holes] = 255
        out[..., 3][ndimage.binary_erosion(filled, iterations=5)] = 255
        # remove the white sheet halo left around the outline
        lum = out[..., :3].mean(axis=2)
        edge = filled & ~ndimage.binary_erosion(filled, iterations=2)
        out[..., 3][edge & (lum > 235)] = 0
        im = Image.fromarray(out.astype(np.uint8))
        im.putalpha(im.split()[3].filter(ImageFilter.GaussianBlur(0.6)))
        im = im.crop(im.getbbox())
        im.save(os.path.join(OUT, f'{prefix}_{i}.png')); sizes_out.append(im.size)
    print(prefix, sizes_out)

cut(os.path.join(ROOT, 'docs', 'concept', 'walk_front.png'), 'fwalk')
cut(os.path.join(ROOT, 'docs', 'concept', 'walk_back.png'), 'bwalk')
