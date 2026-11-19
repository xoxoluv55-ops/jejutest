# anatomy3d — CH2 muscle art from a real 3D anatomy model

All muscle and bone art in Chapter 2 (근육 연결실) is rendered from **BodyParts3D 4.0**:
"BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International".
The game shows that credit next to every model render (`MODEL_CREDIT` in `app/src/art/muscles.ts`).

Nothing is drawn by hand or by an image generator: shapes, attachments, depth order, tendons and poses all come
from the model's meshes. **Latissimus dorsi is not in BodyParts3D 4.0**: it comes from release 3.0 (same source body,
CC BY-SA 2.1 JP), registered onto the 4.0 skeleton (`latissimus.py`), rendered only into separate files
(`lat_render.py`) with its own credit (`LAT_CREDIT`). See `app/public/assets/ch2/LICENSES.txt`.

## Pipeline

| step | file | what it does |
|---|---|---|
| download | `download.sh` | BodyParts3D IS-A OBJ archive (~143 MB) + element/name tables |
| meshes | `objio.py`, `model.py` | element IDs for the right shoulder/arm, frame projection (anterior plate: x = 640 + 1.75·X, y = 130 + 1.75·(1355 − Z)), weld, 1:4 subdivision + Taubin smoothing |
| attachments | `contacts.py`, `atts.py` | every muscle element is intersected with every bone surface (< 2.5 mm). Attachment sites = centroid of the touching vertices → `ATT` in `app/src/data/muscles.ts` |
| attributes | `build.py` | per-vertex tendon factor (thin cross-sections near the ends; fleshy origins excluded) and fibre direction (toward the insertion) |
| render | `render/index.html`, `render/render.cjs` | three.js in headless Chromium: colour pass (2× supersampled), screen-space fibre-direction pass, id pass |
| post | `post.py` | fibres by line-integral convolution along the rendered fibre field, tendon sheen, boundary lines |
| plates | `plates.py` | `plate_full`, `plate_bones`, `mus_real_<id>`, `mus_glow_<id>`, `plates.json` (layer rects, label points) |
| motion | `motion.py`, `motion_render.py --bones-only`, `paths.py`, `paths_render.py`, `export_motion.py` | rigid bone frames per 10°, muscle lines of action (measured centre lines, cylinder wrapping), real undeformed meshes at 0°. The earlier mesh deformation was withdrawn (`deform_audit.py`) |
| latissimus | `latissimus.py`, `lat_render.py` | 3.0 mesh → rigid ICP on 14 shared bones → layers, visible-part overlay, posed x-ray frames |
| export | `export.py`, `update_strain.py` | crops motion frames, copies everything to `app/public/assets/ch2/`, writes fibre-mean length change (sign used in game) |
| verify | `verify.py`, `landmarks.py`, `excursion.py` | contacts, textbook landmark regions, length / moment-arm estimates → `docs/ANATOMY_MODEL.md` |

### Motion model (v2)
Muscle meshes are NOT deformed. See docs/ANATOMY_MODEL.md §7 (old method audit, new path audit, alternatives).
* Bones move rigidly by segment. Elbow: rotation about the measured flexion axis (epicondyle line through the
  trochlea/capitulum centre). Shoulder: scapulohumeral rhythm 1 : 3 (girdle about the sternoclavicular joint,
  humerus about the fitted humeral-head centre).
* Each muscle element keeps its **measured origin and insertion glued to their bones**; the belly follows the new
  origin→insertion line, tendons keep their length, the belly cross-section scales by √(L₀/L₁) (constant volume).
* Triceps: its tendon wraps around the olecranon, so its path lengthens by r·θ (r = 15 mm moment arm).
* Deltoid in abduction: only the clavicular (assist) and acromial (prime mover) fibres shorten; the spinal fibres
  lengthen below ~90° and are shown as not involved.

## Run
```
./download.sh
(cd render && npm install)
python3 build.py anterior out/scene_ant.json
python3 plates.py out/plates
python3 motion_render.py elbow out/motion
python3 motion_render.py shoulder out/motion
# latissimus: save https://dbarchive.biosciencedbc.jp/data/bodyparts3d/20110915/BodyParts3D_3.0_obj_99.zip here as bp3.zip
python3 latissimus.py
python3 lat_render.py out
python3 export.py out ../../app/public/assets/ch2
python3 update_strain.py ../../app/public/assets/ch2/motion
python3 verify.py ../../app/public/assets/ch2/motion; python3 landmarks.py; python3 excursion.py
```
Python needs numpy, scipy, Pillow; rendering needs Node + Playwright's Chromium.
