# CH2 해부 모델 검증 보고서

모든 수치는 `tools/anatomy3d/verify.py`가 BodyParts3D 4.0 메시(© DBCLS, CC BY 4.0)에서 직접 계산한 값입니다.

## 1. Muscle ↔ bone contacts measured on the model (vertices within 2.5 mm of the bone surface)

| element | structure | touches (vertex count) | textbook origin → insertion | result |
|---|---|---|---|---|
| FJ1468 | deltoid · clavicular part | clavicle 1791, scapula 6, humerus 90 | clavicle → humerus | ✅ |
| FJ1467 | deltoid · acromial part | scapula 221, humerus 164 | scapula → humerus | ✅ |
| FJ1513 | deltoid · spinal part | scapula 761, humerus 202 | scapula → humerus | ✅ |
| FJ1447 | pectoralis major · clavicular head | clavicle 460, humerus 121 | clavicle → humerus | ✅ |
| FJ1464 | pectoralis major · sternocostal head | clavicle 34, humerus 96, sternum 595, cartilage 636, ribs 150 | sternum/cartilage → humerus | ✅ |
| FJ1446 | pectoralis major · abdominal part | humerus 33, cartilage 230 | cartilage → humerus | ✅ |
| FJ1478 | biceps brachii · long head | scapula 35, humerus 192, radius 44 | scapula → radius | ✅ |
| FJ1512 | biceps brachii · short head | scapula 147, humerus 131 | scapula → common tendon (joins the long-head tendon to the radial tuberosity) | ✅ |
| FJ1486 | brachialis | humerus 440, radius 25, ulna 162 | humerus → ulna | ✅ |
| FJ1488 | coracobrachialis | scapula 56, humerus 150 | scapula → humerus | ✅ |
| FJ1487 | brachioradialis | humerus 153, radius 486 | humerus → radius | ✅ |
| FJ1479 | triceps · long head | scapula 181, humerus 5, ulna 139 | scapula → ulna | ✅ |
| FJ1477 | triceps · lateral head | humerus 213, ulna 148 | humerus → ulna | ✅ |
| FJ1480 | triceps · medial head | humerus 319, ulna 85 | humerus → ulna | ✅ |
| FJ1506 | supraspinatus | scapula 339, humerus 351 | scapula → humerus | ✅ |

## 2. Attachment sites used by the puzzles (frame = anterior plate, logical units)

| site | frame x, y | depth | lies on | distance to bone surface (mm) |
|---|---|---|---|---|
| clavLat | 431, 139 | 146 | clavicle | 4.1 |
| acromion | 363, 150 | 113 | scapula | 2.3 |
| spine | 462, 207 | 32 | scapula | 0.4 |
| deltTub | 285, 391 | 131 | humerus | 1.4 |
| clavMed | 527, 171 | 225 | clavicle | 3.7 |
| sternum | 585, 354 | 329 | sternum | 3.0 |
| groove | 321, 298 | 150 | humerus | 0.9 |
| coracoid | 402, 184 | 179 | scapula | 0.3 |
| supraglenoid | 399, 176 | 123 | scapula | 0.3 |
| infraglenoid | 388, 246 | 98 | scapula | 1.2 |
| supraFossa | 486, 196 | 44 | scapula | 4.8 |
| greater | 322, 185 | 152 | humerus | 2.0 |
| humMed | 313, 433 | 124 | humerus | 0.6 |
| humAnt | 287, 527 | 129 | humerus | 0.4 |
| ulnTub | 270, 725 | 130 | ulna | 1.3 |
| radTub | 240, 742 | 148 | radius | 0.6 |
| latSupra | 263, 542 | 106 | humerus | 2.1 |
| radStyloid | 155, 1070 | 207 | radius | 0.9 |
| olecranon | 271, 679 | 87 | ulna | 3.3 |
| medEpi | 329, 666 | 120 | humerus | 0.0 |
| grooveFloor | 334, 287 | 141 | humerus | 3.9 |

## 3. Muscle length in the posed frames (relative to rest)

**elbow**

| angle | deltoid | biceps | brachialis | triceps | brachioradialis | coracobrachialis | supraspinatus |
|---|---|---|---|---|---|---|---|
| 0° | +0% | +0% | +0% | +0% | +0% | +0% | +0% |
| 10° | +0% | -1% | -1% | +2% | -1% | +0% | +0% |
| 20° | +0% | -2% | -3% | +4% | -2% | +0% | +0% |
| 30° | +0% | -4% | -5% | +6% | -4% | +0% | +0% |
| 40° | +0% | -6% | -8% | +8% | -6% | +0% | +0% |
| 50° | +0% | -8% | -11% | +9% | -8% | +0% | +0% |
| 60° | +0% | -10% | -15% | +11% | -11% | +0% | +0% |
| 70° | +0% | -12% | -19% | +13% | -15% | +0% | +0% |
| 80° | +0% | -14% | -23% | +15% | -18% | +0% | +0% |
| 90° | +0% | -17% | -28% | +17% | -22% | +0% | +0% |
| 100° | +0% | -19% | -33% | +19% | -26% | +0% | +0% |
| 110° | +0% | -21% | -38% | +20% | -30% | +0% | +0% |
| 120° | +0% | -23% | -42% | +22% | -34% | +0% | +0% |
| 130° | +0% | -24% | -47% | +24% | -38% | +0% | +0% |
| 140° | +0% | -25% | -51% | +26% | -41% | +0% | +0% |

**shoulder**

| angle | deltoid | pecmajor | biceps | brachialis | coracobrachialis | brachioradialis | triceps | supraspinatus |
|---|---|---|---|---|---|---|---|---|
| 0° | +0% | +0% | +0% | +0% | +0% | +0% | +0% | +0% |
| 10° | -0% | +4% | +1% | +0% | +2% | +0% | +0% | -1% |
| 20° | -1% | +8% | +2% | +0% | +4% | +0% | +1% | -2% |
| 30° | -2% | +13% | +2% | +0% | +6% | +0% | +2% | -3% |
| 40° | -3% | +17% | +3% | +0% | +7% | +0% | +2% | -4% |
| 50° | -5% | +20% | +3% | +0% | +9% | +0% | +3% | -6% |
| 60° | -6% | +24% | +3% | +0% | +10% | +0% | +3% | -8% |
| 70° | -8% | +27% | +4% | +0% | +10% | +0% | +4% | -9% |
| 80° | -10% | +30% | +3% | +0% | +11% | +0% | +4% | -11% |
| 90° | -13% | +33% | +3% | +0% | +11% | +0% | +5% | -12% |


## 4. 판정 요약
- 근육 15개 요소(삼각근 3부, 대흉근 3부, 상완이두근 2두, 상완근, 오훼완근, 상완요골근, 상완삼두근 3두, 극상근)가 모두 교과서의 기시 뼈·정지 뼈에 실제로 닿아 있습니다.
- 퍼즐에 쓰는 부착점은 모두 해당 뼈 표면에서 5 mm 이내입니다(접촉 정점의 중심이라 근육 쪽으로 수 mm 떠 있음).
- 운동 프레임: 팔꿈치 굽힘에서 상완이두근·상완근·상완요골근은 단조롭게 짧아지고 상완삼두근은 단조롭게 길어집니다. 어깨 외전에서 삼각근 중간섬유·극상근은 짧아지고 대흉근은 길어지며, 상완근은 변화가 없습니다.

## 5. 한계 (그대로 밝혀 둠)
- **광배근은 BodyParts3D 4.0에 없습니다.** 정지점(결절간구 바닥)은 측정한 대흉근·대원근 정지점의 중간으로 정했고, 그림은 점선 도식/작용선으로만 표시합니다.
- 근육 변형은 유한요소 시뮬레이션이 아니라 "측정한 기시·정지 사이의 직선 경로 + 부피 보존 + 건 길이 고정" 모델입니다. 상완근 −51%(140°)는 실측 문헌(약 30–40%)보다 큽니다: 넓은 기시를 한 점(중심)으로 잡아 근육 길이를 짧게 재기 때문입니다.
- 상완삼두근은 주두를 감아 도는 경로를 모멘트팔 15 mm로 근사했습니다.
- 어깨 외전은 견갑상완 리듬 1:3, 상완골 외회전은 생략했습니다. 모델의 안정 자세가 이미 약 9° 외전되어 있어 90° 프레임에서 팔이 수평보다 조금 높습니다.
- 실제 iPad 실기 테스트는 아직 하지 않았습니다.
