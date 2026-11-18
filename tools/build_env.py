"""Pack environment cut-outs (tools/cut_env.py output) into one atlas with a single shared world scale.
World scale: 1 sheet pixel = 0.75 world units for props/decor (so the test unit, 86 units tall, matches the
sheet's proportions); doors/gate and the recovery bed get explicit factors. Texture density = 2 px / unit.
Frames are pivoted bottom-centre. Output: app/public/assets/atlas/env.png + env.json
Usage: python3 -I tools/build_env.py <cutdir> [<cutdir2> ...]
"""
import os, sys, json
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRCS = sys.argv[1:]; SRC = SRCS[0]; UP = 3; DENS = 2
OUT = os.path.join(ROOT, 'app', 'public', 'assets', 'atlas')
BASE = 0.75
FACTOR = {'p_holobed': 1.6, 'p_capsule_broken': 1.0, 'p_locker_closed': 1.05, 'p_locker_open': 1.05, 'p_joint_rig': 1.0, 'd_side_closed': 1.45, 'd_panel': 1.4, 'd_gate_lock': 1.45, 'd_gate_open': 1.45, 'd_door_closed': 1.3, 'd_door_1': 1.55, 'd_door_2': 1.55, 'd_door_3': 1.55,
          'p_capsule_holo': 0.8, 'p_capsule_empty': 0.95, 'x_beacon': 0.45, 'x_camera': 0.45, 'x_lamp': 0.5, 'x_cone': 0.7}
items = []
SKIP = {'p_organ_shelf'}
seen = {}
for d in SRCS:
    for f in sorted(os.listdir(d)):
        if f.endswith('.png') and f[0] in 'pdx' and f[:-4] not in SKIP: seen[f[:-4]] = os.path.join(d, f)
for k, path in sorted(seen.items()):
    im = Image.open(path).convert('RGBA')
    world = FACTOR.get(k, BASE) / UP          # world units per cut pixel
    px = world * DENS
    im = im.resize((max(1, round(im.width * px)), max(1, round(im.height * px))), Image.LANCZOS)
    items.append((k, im))
# floor plates (opaque squares from the tile row) used as hazard / vent / lift decals, 92 world units wide
for k, src in [('t_hazard', 'f_hazard'), ('t_grate', 'f_grate'), ('t_glow', 'f_glow')]:
    im = Image.open(os.path.join(SRC, src + '.png')).convert('RGBA')
    im = im.crop((3, 3, im.width - 3, im.height - 3)).resize((184, 184), Image.LANCZOS)
    items.append((k, im))
items.sort(key=lambda t: -t[1].height)
W = 2048; x = y = rowh = 0; placed = []
for k, im in items:
    if x + im.width > W: x = 0; y += rowh + 2; rowh = 0
    placed.append((k, im, x, y)); x += im.width + 2; rowh = max(rowh, im.height)
H = 1 << (y + rowh - 1).bit_length()
atlas = Image.new('RGBA', (W, H), (0, 0, 0, 0)); frames = {}
for k, im, px_, py in placed:
    atlas.alpha_composite(im, (px_, py))
    frames[k] = {'frame': {'x': px_, 'y': py, 'w': im.width, 'h': im.height}, 'rotated': False, 'trimmed': False,
                 'spriteSourceSize': {'x': 0, 'y': 0, 'w': im.width, 'h': im.height}, 'sourceSize': {'w': im.width, 'h': im.height},
                 'pivot': {'x': 0.5, 'y': 1}}
atlas.save(os.path.join(OUT, 'env.png'), optimize=True)
json.dump({'frames': frames, 'meta': {'image': 'env.png', 'size': {'w': W, 'h': H}, 'scale': 1}}, open(os.path.join(OUT, 'env.json'), 'w'))
print('env atlas', atlas.size, len(frames))
