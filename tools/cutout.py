"""Cut out sprites from the concept sheets (docs/concept/*.png) into app/public/assets/cut/.
Run: python3 -I tools/cutout.py   (requires: pip install "rembg[cpu]" pillow numpy)
"""
import sys, os
from PIL import Image, ImageFilter
import numpy as np
from rembg import remove, new_session

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONCEPT = os.path.join(ROOT, 'docs', 'concept')
OUT = os.path.join(ROOT, 'app', 'public', 'assets', 'cut')
os.makedirs(OUT, exist_ok=True)
sess = new_session('isnet-general-use')
A = Image.open(os.path.join(CONCEPT, 'concept_a.png')).convert('RGB')

def cut(img, box, scale=3):
    c = img.crop(box)
    c = c.resize((c.width * scale, c.height * scale), Image.LANCZOS)
    out = remove(c, session=sess)
    arr = np.array(out).astype(np.float32)
    rgb, al = arr[..., :3], arr[..., 3]
    lum = rgb.mean(axis=2)
    # kill dark shadow halo (floor shadow / bg bleed) that is semi-transparent
    al[(lum < 55) & (al < 235)] = 0
    al[al < 24] = 0
    arr[..., 3] = al
    out = Image.fromarray(arr.astype(np.uint8))
    a = out.split()[3].filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.7))
    out.putalpha(a)
    bb = out.getbbox()
    return out.crop(bb)

def hue_variant(img, target_h, sat_mul=1.0):
    arr = np.array(img).astype(np.float32) / 255.0
    rgb = arr[..., :3]
    mx, mn = rgb.max(2), rgb.min(2)
    d = mx - mn
    s = np.where(mx > 0, d / np.maximum(mx, 1e-6), 0)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    h = np.zeros_like(mx)
    m = d > 1e-6
    rc = (mx == r) & m; gc = (mx == g) & m & ~rc; bc = m & ~rc & ~gc
    h[rc] = ((g - b)[rc] / d[rc]) % 6
    h[gc] = (b - r)[gc] / d[gc] + 2
    h[bc] = (r - g)[bc] / d[bc] + 4
    h = h / 6.0
    red = (s > 0.28) & ((h < 0.08) | (h > 0.9))
    h2 = np.where(red, target_h, h)
    s2 = np.where(red, np.clip(s * sat_mul, 0, 1), s)
    v = mx
    i = np.floor(h2 * 6).astype(int) % 6
    f = h2 * 6 - np.floor(h2 * 6)
    p = v * (1 - s2); q = v * (1 - f * s2); t = v * (1 - (1 - f) * s2)
    out = np.zeros_like(rgb)
    for k, (x, y, z) in enumerate([(v, t, p), (q, v, p), (p, v, t), (p, q, v), (t, p, v), (v, p, q)]):
        mk = i == k
        out[..., 0][mk] = x[mk]; out[..., 1][mk] = y[mk]; out[..., 2][mk] = z[mk]
    arr[..., :3] = out
    return Image.fromarray((arr * 255).astype(np.uint8))

views = {'front': (52, 452, 172, 608), 'side': (172, 452, 268, 608), 'back': (264, 452, 370, 608)}
COLORS = {'red': None, 'blue': 0.58, 'yellow': 0.13, 'violet': 0.76}
for name, box in views.items():
    base = cut(A, box)
    for cname, hue in COLORS.items():
        im = base if hue is None else hue_variant(base, hue, 1.1)
        im.save(os.path.join(OUT, f'bot_{cname}_{name}.png'))
    print(name, base.size)

# hologram anatomy figure from the central capsule
holo = cut(A, (1488, 40, 1580, 200), scale=3)
holo.save(os.path.join(OUT, 'holo_body.png'))
print('holo', holo.size)

# In-game sized copies (avoid minification shimmer without mipmaps): 200px tall
for f in os.listdir(OUT):
    if f.startswith('bot_') and not f.startswith('bot_s_'):
        im = Image.open(os.path.join(OUT, f))
        h = 200; w = round(im.width * h / im.height)
        im.resize((w, h), Image.LANCZOS).save(os.path.join(OUT, f.replace('bot_', 'bot_s_')))
