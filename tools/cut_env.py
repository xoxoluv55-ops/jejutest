"""Cut individual assets out of an environment sheet. Usage: python3 -I tools/cut_env.py <outdir> [v2]
(v1 = docs/concept/concept_env.png, v2 = docs/concept/concept_env2.png)
Each box is background-removed with rembg (largest object kept), trimmed and saved as PNG with alpha.
Usage: python3 -I tools/cut_env.py <outdir>
"""
import os, sys
import numpy as np
from PIL import Image
from rembg import remove, new_session
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V2 = len(sys.argv) > 2 and sys.argv[2] == 'v2'
SHEET = Image.open(os.path.join(ROOT, 'docs', 'concept', 'concept_env2.png' if V2 else 'concept_env.png')).convert('RGB')
OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
sess = new_session('isnet-general-use')
UP = 3

BOXES = {
    # props (original sheet coordinates)
    'p_capsule_holo': (6, 362, 132, 562), 'p_capsule_empty': (140, 368, 232, 522), 'p_console': (242, 390, 438, 502),
    'p_optable': (443, 352, 614, 522), 'p_xray': (626, 378, 784, 522), 'p_rack': (798, 380, 895, 517),
    'p_techbox': (904, 383, 1037, 514), 'p_fridge': (1046, 383, 1160, 517), 'p_holobed': (13, 562, 188, 637),
    'p_terminal': (188, 543, 317, 639), 'p_breaker': (321, 533, 424, 639), 'p_locker': (428, 541, 517, 639),
    'p_crates': (518, 566, 664, 639), 'p_tubes': (668, 558, 748, 639), 'p_trolley': (750, 543, 844, 639),
    'p_iv': (848, 538, 897, 639), 'p_wheelchair': (898, 548, 977, 639), 'p_stretcher': (983, 563, 1084, 639),
    'p_plantcrate': (1088, 563, 1152, 639),
    # doors / gate
    'd_door_closed': (1183, 358, 1332, 452), 'd_door_1': (1180, 455, 1279, 537), 'd_door_2': (1303, 455, 1402, 537),
    'd_door_3': (1423, 455, 1524, 537), 'd_gate_lock': (1185, 550, 1345, 647), 'd_gate_open': (1373, 550, 1532, 647),
    # decor
    'x_pipes': (498, 690, 627, 802), 'x_fan': (638, 698, 720, 777), 'x_grill': (731, 698, 812, 777),
    'x_lamp': (823, 693, 897, 772), 'x_beacon': (906, 698, 964, 770), 'x_camera': (973, 698, 1054, 772),
    'x_barrier': (498, 793, 642, 867), 'x_barrels': (648, 793, 737, 872), 'x_cone': (738, 798, 782, 870),
    'x_sign': (788, 793, 852, 870), 'x_plant': (858, 798, 942, 872), 'x_glass': (946, 793, 1052, 864),
}
# square tiles: cut without rembg (they are opaque)
TILES = {
    'f_plate': (17, 697, 99, 773), 'f_grate': (108, 697, 189, 773), 'f_diamond': (198, 697, 279, 773),
    'f_hazard': (288, 697, 369, 773), 'f_glow': (378, 697, 461, 773),
    'w_slot': (14, 787, 95, 856), 'w_blue': (104, 787, 185, 856), 'w_red': (192, 787, 275, 856),
    'w_pipes': (286, 787, 369, 856), 'w_vent': (380, 787, 461, 856),
    'title_strip': (10, 896, 650, 1018),
}

if V2:
    BOXES = {
        'p_capsule_broken': (514, 748, 654, 894), 'x_console_broken': (662, 762, 803, 864), 'x_floor_hole': (808, 766, 974, 868),
        'p_locker_closed': (531, 899, 644, 1014), 'p_locker_open': (659, 899, 774, 1014), 'p_joint_rig': (786, 876, 949, 1014),
        'd_side_closed': (1274, 578, 1322, 689), 'd_panel': (1184, 578, 1254, 689), 'p_organ_shelf': (846, 466, 958, 562),
    }
    TILES = {
        'f2_metal': (20, 760, 126, 860), 'f2_grate': (140, 760, 246, 860), 'f2_hazard': (260, 760, 366, 860), 'f2_damaged': (380, 760, 486, 860),
        'w2_base': (20, 900, 126, 988), 'w2_pipes': (140, 900, 246, 988), 'w2_vent': (260, 900, 366, 988), 'w2_console': (380, 900, 486, 988),
        'title_bg_src': (994, 754, 1528, 1010),
    }
for name, box in BOXES.items():
    c = SHEET.crop(box)
    big = c.resize((c.width * UP, c.height * UP), Image.LANCZOS)
    cut = np.array(remove(big, session=sess)).astype(np.float32)
    a = cut[..., 3] > 50
    lab, k = ndimage.label(a)
    if k > 1:
        sz = ndimage.sum(a, lab, range(1, k + 1)); keep = sz >= sz.max() * 0.08
        mask = np.isin(lab, np.nonzero(keep)[0] + 1)
        mask = ndimage.binary_dilation(mask, iterations=2)
        cut[..., 3] = np.where(mask, cut[..., 3], 0)
    # white fringe -> fade
    rgb = cut[..., :3]; wht = (rgb.min(axis=2) > 236) & (cut[..., 3] < 250)
    cut[..., 3][wht] *= 0.3
    im = Image.fromarray(cut.astype(np.uint8)); im = im.crop(im.getbbox())
    im.save(os.path.join(OUT, name + '.png'))
    print(name, im.size)
for name, box in TILES.items():
    SHEET.crop(box).save(os.path.join(OUT, name + '.png'))
