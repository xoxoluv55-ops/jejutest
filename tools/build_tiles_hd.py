"""Seamless textures from the dedicated high-res tile image docs/concept/tiles_hd.png
(3 panels: floor plates 3x3 / wall face / wall-top beam). Writes app/public/assets/art/<key>.png and adds
the keys to manifest.json. Other tiles (floor_grate, floor_tile) still come from tools/build_tiles.py.
Usage: python3 -I tools/build_tiles_hd.py
"""
import os, json
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'app', 'public', 'assets', 'art')
SHEET = Image.open(os.path.join(ROOT, 'docs', 'concept', 'tiles_hd.png')).convert('RGB')
PANELS = [(15, 14, 707, 709), (742, 14, 1433, 709), (1467, 14, 2159, 709)]  # measured panel bounds

def flatten(im, frac=5):
    a = np.array(im).astype(np.float32)
    low = np.array(im.filter(ImageFilter.GaussianBlur(im.width / frac))).astype(np.float32)
    mean = a.reshape(-1, 3).mean(0)
    return np.clip(a / np.maximum(low, 8) * mean, 0, 255)

def seamless(a, band, axes):
    a = a.copy()
    for ax in axes:
        n = a.shape[ax]
        for i in range(band):
            t = 0.5 * (1 - i / band)
            s1 = [slice(None)] * 3; s2 = [slice(None)] * 3; s1[ax] = i; s2[ax] = n - 1 - i
            e1, e2 = a[tuple(s1)].copy(), a[tuple(s2)].copy()
            a[tuple(s1)] = e1 * (1 - t) + e2 * t; a[tuple(s2)] = e2 * (1 - t) + e1 * t
    return a

def save(key, a, size):
    im = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).resize(size, Image.LANCZOS)
    im.save(os.path.join(OUT, key + '.png'), optimize=True); print(key, im.size)

# floor: 3x3 plates (one with a vent) = one 256-unit tile -> 512px (density 2)
fl = SHEET.crop(PANELS[0]).crop((4, 4, 688, 691))
save('floor_lab', seamless(flatten(fl), 8, (0, 1)), (512, 512))

# wall face: one module 128x110 units; two modules -> 512x220 (horizontal repeat only)
wf = SHEET.crop(PANELS[1]).crop((3, 3, 688, 692))
wa = seamless(flatten(wf, 4), 8, (1,))
mod = np.array(Image.fromarray(wa.astype(np.uint8)).resize((256, 220), Image.LANCZOS)).astype(np.float32)
save('wall_face', np.concatenate([mod, mod], axis=1), (512, 220))

# wall top: the beam band (bracket centre to bracket centre = one horizontal period), 36 units tall
cap = SHEET.crop(PANELS[2]).crop((112, 178, 580, 322))
ca = seamless(np.array(cap).astype(np.float32), 6, (1,))
w = round(ca.shape[1] * 72 / ca.shape[0])            # 72px tall = 36 units at density 2
save('wall_top', ca, (w, 72))
Image.open(os.path.join(OUT, 'wall_top.png')).rotate(-90, expand=True).save(os.path.join(OUT, 'wall_top_v.png'), optimize=True)
print('wall_top_v', Image.open(os.path.join(OUT, 'wall_top_v.png')).size)

# dedicated single-image floors (already tileable; light edge cross-fade only): plate -> joint/X-ray rooms, grate -> corridor
for key, name in [('floor_tile', 'floor_plate_hd'), ('floor_grate', 'floor_grate_hd')]:
    im = Image.open(os.path.join(ROOT, 'docs', 'concept', name + '.png')).convert('RGB')
    save(key, seamless(np.array(im).astype(np.float32), 4, (0, 1)), (512, 512))

# title background: standalone key art (1672x941 source)
Image.open(os.path.join(ROOT, 'docs', 'concept', 'title_hd.png')).convert('RGB').save(os.path.join(OUT, 'title_bg.jpg'), quality=90, optimize=True)
print('title_bg', Image.open(os.path.join(OUT, 'title_bg.jpg')).size)

mf = os.path.join(OUT, 'manifest.json'); keys = json.load(open(mf))
for k in ['floor_lab', 'floor_grate', 'floor_tile', 'wall_face', 'wall_top', 'wall_top_v']:
    if k not in keys: keys.append(k)
json.dump(keys, open(mf, 'w')); print(keys)
