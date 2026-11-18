"""Make seamless floor/wall textures from the environment sheet tiles (tools/cut_env.py output).
1) trim the rounded border, 2) flatten baked-in lighting (divide by a heavy blur), 3) cross-fade opposite edges,
4) repeat into a block that matches the game's texture aspect. Writes app/public/assets/art/<key>.png + manifest.json
Usage: python3 -I tools/build_tiles.py <cutdir>
"""
import os, sys, json
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = sys.argv[1]; SRC2 = sys.argv[2] if len(sys.argv) > 2 else None; OUT = os.path.join(ROOT, 'app', 'public', 'assets', 'art'); os.makedirs(OUT, exist_ok=True)

def prep(name, inset=3):
    d = SRC2 if (SRC2 and os.path.exists(os.path.join(SRC2, name + '.png'))) else SRC
    im = Image.open(os.path.join(d, name + '.png')).convert('RGB')
    im = im.crop((inset, inset, im.width - inset, im.height - inset))
    im = im.resize((im.width * 2, im.height * 2), Image.LANCZOS)
    a = np.array(im).astype(np.float32)
    low = np.array(im.filter(ImageFilter.GaussianBlur(im.width / 7))).astype(np.float32)
    mean = a.reshape(-1, 3).mean(0)
    a = np.clip(a / np.maximum(low, 8) * mean, 0, 255)          # remove lighting gradient
    return a

def seamless(a, band=6, axes=(0, 1)):
    a = a.copy()
    for ax in axes:
        n = a.shape[ax]
        for i in range(band):
            t = 0.5 * (1 - i / band)
            sl1 = [slice(None)] * 3; sl2 = [slice(None)] * 3
            sl1[ax] = i; sl2[ax] = n - 1 - i
            e1, e2 = a[tuple(sl1)].copy(), a[tuple(sl2)].copy()
            a[tuple(sl1)] = e1 * (1 - t) + e2 * t
            a[tuple(sl2)] = e2 * (1 - t) + e1 * t
    return a

def block(a, nx, ny):
    return np.tile(a, (ny, nx, 1))

def save(key, a, size):
    im = Image.fromarray(a.astype(np.uint8)).resize(size, Image.LANCZOS)
    im.save(os.path.join(OUT, key + '.png'), optimize=True); print(key, im.size)

# floors: 256x256 world units at density 2 -> 512px, 4x4 plates (64 units each)
V2 = SRC2 is not None
save('floor_lab', block(seamless(prep('f2_metal' if V2 else 'f_plate')), 2 if V2 else 4, 2 if V2 else 4), (512, 512))
save('floor_grate', block(seamless(prep('f2_grate' if V2 else 'f_grate')), 3 if V2 else 4, 3 if V2 else 4), (512, 512))
save('floor_tile', block(seamless(prep('f_diamond')), 4, 4), (512, 512))
# wall face: 256x110 world units -> 512x220px, 2 modules across, only horizontal seam matters
if V2:
    a, b = seamless(prep('w2_base'), axes=(1,)), seamless(prep('w2_console'), axes=(1,))
    h = min(a.shape[0], b.shape[0]); save('wall_face', np.concatenate([a[:h], b[:h]], axis=1), (512, 220))
else:
    save('wall_face', block(seamless(prep('w_blue'), axes=(1,)), 2, 1), (512, 220))
json.dump(['floor_lab', 'floor_grate', 'floor_tile', 'wall_face'], open(os.path.join(OUT, 'manifest.json'), 'w'))
