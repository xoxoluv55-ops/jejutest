"""CH5 peripheral nerves: Z-Anatomy models (CC BY-SA 4.0, derived from BodyParts3D (c) DBCLS).
Meshes come from render/fbxdump.mjs dumps (ch5/za.py). They are converted to the BodyParts3D frame used by CH4
(mm, X- = body's right, Y- = anterior, Z+ = superior), so ch4_model.View / AXES are reused.
RIGHT side only ('...r' meshes)."""
import sys, os, functools, collections
sys.path.insert(0, os.path.dirname(__file__)); sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'ch5'))
import numpy as np
from scipy.spatial import cKDTree
from model import weld, subdivide, taubin, sample_surface
from ch4_model import View, AXES, sphere_fit
import za

def conv(V): return np.stack([V[:, 0] * 10, -V[:, 2] * 10, V[:, 1] * 10], 1)

_sk = za.lib('skeletal')[0]; _nv = za.lib('nerv')[0]; _mu = za.lib('muscular')[0]
def _kids(idx, root):
    ch = collections.defaultdict(list)
    for n, m in idx.items(): ch[m['parent']].append(n)
    out, st = [], [root]
    while st:
        n = st.pop(); out.append(n); st += ch.get(n, [])
    return [n for n in out if idx[n]['nv'] > 40]          # 36-vertex meshes are label pins

UL = [n for n, m in _sk.items() if m['parent'] == 'Bones_of_free_part_of_upper_limbg' and n.endswith('r')]
HAND = [n for n in UL if n not in ('Humerusr', 'Radiusr', 'Ulnar')]
BONES = {
    'clavicle': ['Clavicler'], 'scapula': ['Scapular'], 'humerus': ['Humerusr'], 'radius': ['Radiusr'], 'ulna': ['Ulnar'], 'hand': HAND,
    'hip': ['Hip_boner'], 'sacrum': ['Sacrum'], 'femur': ['Femurr'], 'patella': ['Patellar'], 'tibia': ['Tibiar'], 'fibula': ['Fibular'],
    'foot': [n for n, m in _sk.items() if m['parent'] in ('Tarsal_bonesg', 'Metatarsal_bonesg', 'Phalanges_of_footg') and n.endswith('r')],
    'cspine': ['Vertebra_C4', 'Vertebra_C5', 'Vertebra_C6', 'Vertebra_C7', 'Vertebra_T1', 'Vertebra_T2'],
    'lspine': ['Vertebra_L1', 'Vertebra_L2', 'Vertebra_L3', 'Vertebra_L4', 'Vertebra_L5'],
    'ribs': [n for n, m in _sk.items() if m['parent'] in ('True_ribsg',) and n.endswith('r')][:3],
}
NERVES = {
    'musculocutaneous': _kids(_nv, 'Musculocutaneous_nerver'), 'axillary': _kids(_nv, 'Axillary_nerver'),
    'radial': _kids(_nv, 'Radial_nerver'), 'median': _kids(_nv, 'Median_nerver'), 'ulnar': _kids(_nv, 'Ulnar_nerver'),
    'femoral': _kids(_nv, 'Femoral_nerver'), 'obturator': _kids(_nv, 'Obturator_nerver'),
    'sciatic': ['Sciatic_nerver'], 'tibial': _kids(_nv, 'Tibial_nerver'), 'fibular': _kids(_nv, 'Common_fibular_nerver'),
    'plexus': [n for n in _nv if n.endswith('r') and 'brachial_plexus' in n and _nv[n]['nv'] > 40],
}
ARM_MUS = ['Brachialis_muscler', 'Short_head_of_biceps_brachiir', 'Long_head_of_biceps_brachiir', 'Coracobrachialis_muscler', 'Pronator_quadratusr',
           'Flexor_digitorum_profundusr', 'Flexor_pollicis_longusr', 'Humeral_head_of_flexor_carpi_ulnarisr', 'Humero-ulnar_head_of_flexor_digitorum_superficialisr',
           'Radial_head_of_flexor_digitorum_superficialisr', 'Palmaris_longus_muscler', 'Superficial_head_of_pronator_teresr', 'Ulnar_head_of_flexor_carpi_ulnarisr',
           'Flexor_carpi_radialisr', 'Deep_head_of_pronator_teresr', 'Anconeus_muscler', 'Extensor_digiti_minimir', 'Extensor_carpi_radialis_brevisr',
           'Brachioradialis_muscler', 'Extensor_carpi_radialis_longusr', 'Extensor_digitorumr', 'Ulnar_head_of_extensor_carpi_ulnarisr',
           'Humeral_head_of_extensor_carpi_ulnarisr', 'Extensor_pollicis_longusr', 'Extensor_pollicis_brevisr', 'Abductor_pollicis_longusr', 'Extensor_indicisr',
           'Supinatorr', 'Supraspinatus_muscler', 'Subscapularis_muscler', 'Infraspinatus_muscler', 'Teres_minor_muscler', 'Clavicular_part_of_deltoid_muscler',
           'Scapular_spinal_part_of_deltoid_muscler', 'Acromial_part_of_deltoid_muscler', 'Teres_major_muscler', 'Long_head_of_triceps_brachiir',
           'Lateral_head_of_triceps_brachiir', 'Medial_head_of_triceps_brachiir', 'Opponens_pollicis_muscler', 'Abductor_pollicis_brevisr',
           'Superficial_head_of_flexor_pollicis_brevisr', 'Abductor_digiti_minimi_of_handr', 'Flexor_digiti_minimi_of_handr', 'Opponens_digiti_minimi_muscle_of_handr']
LEG_MUS = ['Gluteus_medius_muscler', 'Tensor_fasciae_lataer', 'Gluteus_maximus_muscler', 'Gluteus_minimus_muscler', 'Piriformis_muscler', 'Superior_gemellus_muscler',
           'Inferior_gemellus_muscler', 'Obturator_internusr', 'Quadratus_femoris_muscler', 'Adductor_brevisr', 'Gracilis_muscler', 'Adductor_longusr', 'Pectineus_muscler',
           'Adductor_magnusr', 'Semitendinosus_muscler', 'Short_head_of_biceps_femorisr', 'Semimembranosus_muscler', 'Long_head_of_biceps_femorisr',
           'Vastus_lateralis_muscler', 'Vastus_medialis_muscler', 'Sartorius_muscler', 'Rectus_femoris_muscler', 'Vastus_intermedius_muscler', 'Psoas_majorr',
           'Iliacus_muscler', 'Lateral_head_of_gastrocnemiusr', 'Medial_head_of_gastrocnemiusr', 'Soleus_muscler', 'Tibialis_anterior_muscler',
           'Extensor_digitorum_longusr', 'Fibularis_longus_muscler', 'Fibularis_brevis_muscler', 'Popliteus_muscler']
MUSCLES = {m: [m] for m in ARM_MUS + LEG_MUS if m in _mu}
LIB = {**{k: ('skeletal', v) for k, v in BONES.items()}, **{k: ('nerv', v) for k, v in NERVES.items()}, **{k: ('muscular', v) for k, v in MUSCLES.items()}}

@functools.lru_cache(maxsize=None)
def raw(name):
    sysn, parts = LIB[name]; Vs, Fs, o = [], [], 0
    for p in parts:
        V, F = za.mesh(sysn, p); Vs.append(conv(V)); Fs.append(F.astype(np.int64) + o); o += len(V)
    V, F = np.concatenate(Vs), np.concatenate(Fs)
    return weld(V, F, 1e-3)

@functools.lru_cache(maxsize=None)
def smooth(name):
    V, F = raw(name)
    if name in NERVES or len(F) > 60000: return V, F
    return V, F

@functools.lru_cache(maxsize=None)
def tree(name): return cKDTree(sample_surface(*raw(name), step=0.8))

def closest(a, b):
    """closest approach between meshes a and b: (point on a, distance mm)"""
    V = raw(a)[0]; d, _ = tree(b).query(V); i = int(np.argmin(d)); return V[i], float(d[i])
