"""Normalise sliced frames (tools/cut_sheet.py output) and pack one texture atlas per bot colour.
- Same character scale everywhere: every frame is scaled so the helmet width == HEAD px.
- Same anchor everywhere: helmet centre at x = AX, feet at y = CELL_H - PAD.
Outputs app/public/assets/atlas/bot_<color>.png + .json (Phaser JSON-hash) and hero images.
Usage: python3 -I tools/build_atlas.py <frames_dir>
"""
import os, sys, json
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = sys.argv[1]
OUT = os.path.join(ROOT, 'app', 'public', 'assets', 'atlas')
os.makedirs(OUT, exist_ok=True)
HEAD, CELL_W, CELL_H, AX, PAD = 92, 200, 200, 100, 6
WIDE_W = 300  # interact frames (holo tablet in front)

meta = json.load(open(os.path.join(SRC, 'meta.json')))
ANIMS = {  # name -> (section, frame indices)
    'front': ('base', [0]), 'back': ('bwalk', [0]),
    'fwalk': ('fwalk', list(range(8))), 'bwalk': ('bwalk', list(range(8))),   # tools/cut_walk.py
    'idle': ('idle', [0, 1, 2, 3]), 'walk': ('walk', list(range(8))), 'run': ('run', list(range(8))),
    'interact': ('interact', [0, 1, 2, 3]), 'scan': ('scan', [0, 1, 2, 3, 4]),
    'hit': ('hit', [0, 1, 2]), 'victory': ('victory', [0, 1, 2, 3, 4]),
}

def head_metrics(im, xfrac=1.0):
    a = np.array(im)[..., 3] > 40
    a[:, int(a.shape[1] * xfrac):] = False
    ys = np.nonzero(a.any(axis=1))[0]; top, bot = ys.min(), ys.max()
    band = a[top: top + int((bot - top) * 0.38)]
    xs = np.nonzero(band.any(axis=0))[0]
    return xs.min(), xs.max(), bot

def hue_shift(img, target, also_yellow):
    arr = np.array(img).astype(np.float32) / 255.0
    rgb = arr[..., :3]; mx = rgb.max(2); mn = rgb.min(2); d = mx - mn
    s = np.where(mx > 0, d / np.maximum(mx, 1e-6), 0)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    h = np.zeros_like(mx); m = d > 1e-6
    rc = (mx == r) & m; gc = (mx == g) & m & ~rc; bc = m & ~rc & ~gc
    h[rc] = ((g - b)[rc] / d[rc]) % 6; h[gc] = (b - r)[gc] / d[gc] + 2; h[bc] = (r - g)[bc] / d[bc] + 4
    h /= 6
    sel = (s > 0.3) & ((h < 0.07) | (h > 0.92))
    if also_yellow: sel |= (s > 0.35) & (h >= 0.07) & (h < 0.18)
    if target is None and not also_yellow: return img
    t = 0.0 if target is None else target
    h2 = np.where(sel, t, h); v = mx
    i = np.floor(h2 * 6).astype(int) % 6; f = h2 * 6 - np.floor(h2 * 6)
    p = v * (1 - s); q = v * (1 - f * s); tt = v * (1 - (1 - f) * s)
    out = np.zeros_like(rgb)
    for k, (x, y, z) in enumerate([(v, tt, p), (q, v, p), (p, v, tt), (p, q, v), (tt, p, v), (v, p, q)]):
        mk = i == k; out[..., 0][mk] = x[mk]; out[..., 1][mk] = y[mk]; out[..., 2][mk] = z[mk]
    arr[..., :3] = out
    return Image.fromarray((arr * 255).astype(np.uint8))

# 1) normalise frames
cells = []  # (key, Image)
for anim, (sec, idxs) in ANIMS.items():
    srcs = [Image.open(os.path.join(SRC, f'{sec}_{i}.png')) for i in idxs]
    xf = 0.5 if anim == 'interact' else 1.0
    hw = np.median([head_metrics(s, xf)[1] - head_metrics(s, xf)[0] for s in srcs])
    k = HEAD / hw
    cw = WIDE_W if anim == 'interact' else CELL_W
    for n, s in enumerate(srcs):
        im = s.resize((max(1, round(s.width * k)), max(1, round(s.height * k))), Image.LANCZOS)
        x0, x1, bot = head_metrics(im, xf)
        hc = (x0 + x1) / 2
        cell = Image.new('RGBA', (cw, CELL_H), (0, 0, 0, 0))
        ox = round(AX - hc); oy = round(CELL_H - PAD - bot)
        cell.alpha_composite(im, (max(0, ox), max(0, oy)), (max(0, -ox), max(0, -oy)))
        cells.append((f'{anim}_{n}', cell))

# (front/back walking used a cut-out leg rig before; replaced by real 8-frame cycles fwalk/bwalk)
print('frames', len(cells))

# 2) pack (shelf packer, rows of equal height)
ATW = 2048
def pack(color, target, also_yellow):
    x = y = 0; placed = []
    for key, c in cells:
        if x + c.width > ATW: x = 0; y += CELL_H + 2
        placed.append((key, c, x, y)); x += c.width + 2
    H = y + CELL_H
    H2 = 1 << (H - 1).bit_length()
    atlas = Image.new('RGBA', (ATW, H2), (0, 0, 0, 0))
    frames = {}
    for key, c, px, py in placed:
        atlas.alpha_composite(hue_shift(c, target, also_yellow), (px, py))
        frames[key] = {'frame': {'x': px, 'y': py, 'w': c.width, 'h': CELL_H}, 'rotated': False, 'trimmed': False,
                       'spriteSourceSize': {'x': 0, 'y': 0, 'w': c.width, 'h': CELL_H}, 'sourceSize': {'w': c.width, 'h': CELL_H},
                       'pivot': {'x': AX / c.width, 'y': (CELL_H - PAD) / CELL_H}}
    atlas.save(os.path.join(OUT, f'bot_{color}.png'), optimize=True)
    json.dump({'frames': frames, 'meta': {'image': f'bot_{color}.png', 'size': {'w': ATW, 'h': H2}, 'scale': 1}}, open(os.path.join(OUT, f'bot_{color}.json'), 'w'))
    print(color, atlas.size)

for color, target, yel in [('red', None, True), ('blue', 0.58, True), ('yellow', 0.13, False), ('violet', 0.76, True)]:
    pack(color, target, yel)

# 3) hero portraits (title / results) in 4 colours, 520px tall
hero = Image.open(os.path.join(SRC, 'hero_0.png'))
hero = hero.resize((round(hero.width * 520 / hero.height), 520), Image.LANCZOS)
for color, target, yel in [('red', None, True), ('blue', 0.58, True), ('yellow', 0.13, False), ('violet', 0.76, True)]:
    hue_shift(hero, target, yel).save(os.path.join(OUT, f'hero_{color}.png'), optimize=True)
anims = {a: len(i[1]) for a, i in ANIMS.items()}
json.dump({'anims': anims, 'cellH': CELL_H, 'head': HEAD}, open(os.path.join(OUT, 'anims.json'), 'w'))

# 4) full-body front pose (title line-up), 440px tall
full = Image.open(os.path.join(SRC, 'base_0.png'))
full = full.resize((round(full.width * 440 / full.height), 440), Image.LANCZOS)
for color, target, yel in [('red', None, True), ('blue', 0.58, True), ('yellow', 0.13, False), ('violet', 0.76, True)]:
    hue_shift(full, target, yel).save(os.path.join(OUT, f'full_{color}.png'), optimize=True)
