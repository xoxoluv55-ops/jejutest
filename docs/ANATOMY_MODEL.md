# CH2 해부 모델 검증 보고서

모든 수치는 `tools/anatomy3d/` 스크립트가 BodyParts3D 메시에서 직접 계산한 값입니다.
- 근육·뼈: BodyParts3D 4.0, © DBCLS, **CC BY 4.0**
- 넓은등근: BodyParts3D 3.0 (2011, 같은 원본 인체), © DBCLS, **CC BY-SA 2.1 JP** → 이 메시로 만든 그림(`mus_*_latissimus`, `mus_vis_latissimus`, `motion/shoulder_l*`)은 같은 조건(CC BY-SA 2.1 JP)으로 배포되며 별도 파일·별도 출처 표기로 분리했습니다.

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
| LAT3 | latissimus dorsi (BodyParts3D 3.0, registered) | scapula 306, humerus 828, ribs 938 | ribs/scapula → humerus | ✅ |

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


## 2b. 부착점이 교과서상의 부착 부위에 있는지 (`landmarks.py`)

뼈 표면에 가까운지만이 아니라, 각 부착점이 그 뼈의 **어느 높이·어느 면**에 있는지를 교과서 기술(Gray's Anatomy / Moore, Clinically Oriented Anatomy)과 비교했습니다.
긴뼈: 뼈 주축 기준 위치(0 = 몸쪽 끝, 1 = 먼쪽 끝)와 면(앞·뒤·가쪽·안쪽; 성분이 가장 큰 면의 70% 이상인 면은 함께 인정, 예: 앞안쪽).
빗장뼈: 복장 끝(0)→봉우리 끝(1). 어깨뼈: 관절오목 중심(위팔뼈머리 구에서 6 mm 이내의 어깨뼈 표면 = 관절오목 면의 중심) 기준.

glenoid face: height 33.7 mm (rim +19.7 / -13.9 mm from centre)

| site | textbook region | measured on the model | criterion | result |
|---|---|---|---|---|
| greater | proximal humerus, lateral (greater tubercle) | humerus 0.05 of length · lateral | 0.00–0.12 · anterior/lateral/posterior | ✅ |
| groove | lateral lip of the intertubercular sulcus, proximal anterior humerus | humerus 0.26 of length · anterior | 0.05–0.30 · anterior/lateral | ✅ |
| grooveFloor | floor of the intertubercular sulcus (between the lips) | humerus 0.23 of length · anterior+medial | 0.05–0.30 · anterior/medial | ✅ |
| deltTub | deltoid tuberosity, lateral surface at mid-shaft | humerus 0.44 of length · anterior+lateral | 0.28–0.55 · lateral | ✅ |
| humMed | medial border/surface at mid-shaft (coracobrachialis) | humerus 0.51 of length · medial | 0.30–0.60 · anterior/medial | ✅ |
| humAnt | anterior surface, distal half (brachialis) | humerus 0.69 of length · anterior | 0.45–0.95 · anterior | ✅ |
| latSupra | lateral supracondylar ridge, distal third | humerus 0.72 of length · lateral | 0.60–0.92 · lateral | ✅ |
| medEpi | medial epicondyle | humerus 0.93 of length · medial | 0.85–1.00 · medial | ✅ |
| radTub | radial tuberosity, proximal anteromedial radius | radius 0.13 of length · anterior+medial | 0.04–0.25 · anterior/medial | ✅ |
| radStyloid | base of the radial styloid, distal lateral radius | radius 0.95 of length · lateral | 0.80–1.00 · anterior/lateral | ✅ |
| ulnTub | ulnar tuberosity / coronoid, proximal anterior ulna | ulna 0.16 of length · anterior+medial | 0.03–0.22 · anterior | ✅ |
| olecranon | olecranon, proximal posterior ulna | ulna 0.04 of length · lateral+posterior | 0.00–0.12 · lateral/medial/posterior | ✅ |
| clavLat | lateral third of the clavicle | clavicle 0.81 from sternal end | 0.62–1.00 | ✅ |
| clavMed | medial half of the clavicle | clavicle 0.40 from sternal end | 0.00–0.52 | ✅ |
| supraglenoid | just above the glenoid rim | scapula: sup +22 · ant +5 · med +7 mm | relative to glenoid centre | ✅ |
| infraglenoid | just below the glenoid rim | scapula: sup -18 · ant -9 · med +1 mm | relative to glenoid centre | ✅ |
| coracoid | anterior, superior and medial to the glenoid | scapula: sup +17 · ant +37 · med +8 mm | relative to glenoid centre | ✅ |
| acromion | above the glenoid / humeral head | scapula: sup +36 · ant -1 · med -14 mm | relative to glenoid centre | ✅ |
| spine | posterior to the glenoid, medial to the acromion | scapula: sup +4 · ant -47 · med +43 mm | relative to glenoid centre | ✅ |
| supraFossa | posterior, above the spine, medial | scapula: sup +10 · ant -41 · med +57 mm | relative to glenoid centre | ✅ |
| sternum | anterior sternum / costal cartilages 1–6 | 10.4 mm to sternum, 3.0 mm to cartilage | < 6 mm | ✅ |

21/21 sites inside their textbook region.

처음 판정에서는 관절오목 중심을 "위팔뼈머리 중심에서 가장 가까운 한 점"으로 잡아 관절위결절이 기준 밖(+29 mm)으로 나왔습니다. 관절오목 면 전체의 중심으로 고친 뒤 관절위결절은 관절오목 위 테두리보다 1.9 mm 위로, 교과서 위치와 일치합니다. 자뼈거친면은 앞면·안쪽 성분이 같아(앞안쪽) 앞면으로 인정했습니다.

## 2c. 넓은등근 (`latissimus.py`)

BodyParts3D 4.0에는 넓은등근이 없어, 같은 원본 인체로 만든 3.0의 `FMA13358 right latissimus dorsi`를 사용했습니다. 두 버전의 뼈가 약 1 cm 어긋나 있어, 넓은등근이 붙는 뼈(위팔뼈, 어깨뼈, 7–12번 갈비뼈, T7–T12 척추뼈) 14개로 강체 ICP 정합을 했습니다.

```
fit on 14 bones (42188 pts): surface distance before 4.5 mm median / after 2.39 mm median, 95% 7.01 mm; rotation 1.07 deg, shift [-15.1  13.3 -15.4]
  FMA23130->FJ3368: median 3.12 mm
  FMA13395->FJ3384: median 2.24 mm
  FMA8229->FJ3346: median 2.69 mm
  FMA8283->FJ3347: median 2.97 mm
  FMA8364->FJ3348: median 3.04 mm
  FMA8445->FJ3330: median 2.86 mm
  FMA8531->FJ3331: median 2.76 mm
  FMA8533->FJ3332: median 4.03 mm
  FMA9968->FJ3173: median 2.36 mm
  FMA9991->FJ3174: median 2.45 mm
  FMA10014->FJ3175: median 2.14 mm
  FMA10037->FJ3154: median 1.64 mm
  FMA10059->FJ3155: median 1.01 mm
  FMA10081->FJ3156: median 1.61 mm
latissimus vertices 29667
  touches humerus: 828 verts, z 1238..1272
  touches scapula: 306 verts, z 1188..1226
  touches ribs: 938 verts, z 1016..1113
  insertion [-171.5  -78.9 1257.4]  pec major ins [-182.5  -85.6 1258.8]  teres major ins [-166.8  -76.  1271.4]
  insertion lies 0.56 of the way from the teres major (medial lip) to the pec major (lateral lip) insertion
```
- 위팔뼈 접촉 = 결절사이고랑 바닥: 큰원근 닿는곳(안쪽 입술)과 큰가슴근 닿는곳(가쪽 입술) 사이 0.56 지점 → `grooveFloor`
- 척추 접촉: T7–T11 가시돌기, 허리·엉치 부위 → `thoracolumbar`; 아래 갈비뼈, 어깨뼈 아래각 접촉도 교과서 이는곳과 일치
- 앞면 해부도에서 보이는 부분: 모델의 앞쪽 가슴벽이 완전하지 않아(갈비뼈 사이 틈) 등쪽 넓은등근이 비쳐 보이므로, 갈비우리보다 가쪽(뒤겨드랑 주름)만 표시합니다.
- 정합 잔차 중앙값 2.4 mm(버전 간 메시 재작성 차이 포함)는 근육 형태 오차로 남습니다.

## 3. Muscle length in the posed frames (relative to rest) — ⚠ 폐기된 메시 변형 방식 기준(참고용). 현재 게임의 길이 방향은 7.4 작용선 기준 — model approximation, not shown as numbers in the game

**elbow**

| angle | deltoid | biceps | brachialis | triceps | brachioradialis | coracobrachialis | supraspinatus |
|---|---|---|---|---|---|---|---|
| 0° | +0% | +0% | +0% | +0% | +0% | +0% | +0% |
| 10° | +0% | -1% | -1% | +2% | -1% | +0% | +0% |
| 20° | +0% | -2% | -2% | +3% | -2% | +0% | +0% |
| 30° | +0% | -4% | -4% | +4% | -4% | +0% | +0% |
| 40° | +0% | -6% | -6% | +6% | -6% | +0% | +0% |
| 50° | +0% | -8% | -9% | +8% | -8% | +0% | +0% |
| 60° | +0% | -10% | -12% | +9% | -11% | +0% | +0% |
| 70° | +0% | -12% | -15% | +11% | -14% | +0% | +0% |
| 80° | +0% | -14% | -18% | +12% | -18% | +0% | +0% |
| 90° | +0% | -17% | -22% | +14% | -22% | +0% | +0% |
| 100° | +0% | -19% | -25% | +15% | -26% | +0% | +0% |
| 110° | +0% | -21% | -28% | +17% | -30% | +0% | +0% |
| 120° | +0% | -23% | -32% | +18% | -34% | +0% | +0% |
| 130° | +0% | -24% | -34% | +20% | -37% | +0% | +0% |
| 140° | +0% | -25% | -37% | +21% | -40% | +0% | +0% |

**shoulder**

| angle | deltoid | pecmajor | biceps | brachialis | coracobrachialis | brachioradialis | triceps | supraspinatus | latissimus |
|---|---|---|---|---|---|---|---|---|---|
| 0° | +0% | +0% | +0% | +0% | +0% | +0% | +0% | +0% | +0% |
| 10° | -0% | +4% | +1% | +0% | +2% | -0% | +1% | -1% | +5% |
| 20° | -1% | +8% | +2% | -0% | +4% | +0% | +2% | -2% | +11% |
| 30° | -2% | +12% | +2% | -0% | +6% | +0% | +2% | -3% | +17% |
| 40° | -3% | +16% | +3% | +0% | +7% | +0% | +3% | -4% | +24% |
| 50° | -5% | +20% | +3% | +0% | +9% | +0% | +4% | -6% | +31% |
| 60° | -6% | +24% | +3% | +0% | +10% | +0% | +5% | -7% | +38% |
| 70° | -8% | +27% | +4% | +0% | +10% | +0% | +6% | -9% | +45% |
| 80° | -10% | +31% | +3% | +0% | +11% | +0% | +6% | -11% | +52% |
| 90° | -13% | +33% | +3% | +0% | +11% | +0% | +7% | -12% | +58% |


## 3b. 길이 변화·모멘트팔 (근사 모델, `excursion.py`)

길이 = 이는곳 접촉 정점 **전부**에서 닿는곳까지 직선 근섬유의 평균 길이(이전 방식은 이는곳을 한 점(중심)으로 잡아 넓은 이는곳을 가진 위팔근의 길이를 짧게 재서 −51%가 나왔음 → 수정 후 −37%).
모멘트팔 = −dL/dθ.

```
elbow biceps 0deg L=334mm (+0%) MA=16mm 45deg L=312mm (-7%) MA=39mm 90deg L=278mm (-17%) MA=43mm 140deg L=250mm (-25%) MA=15mm
elbow brachialis 0deg L=114mm (+0%) MA=5mm 45deg L=105mm (-8%) MA=17mm 90deg L=90mm (-22%) MA=22mm 140deg L=72mm (-37%) MA=15mm
elbow brachioradialis 0deg L=313mm (+0%) MA=8mm 45deg L=292mm (-7%) MA=46mm 90deg L=245mm (-22%) MA=70mm 140deg L=186mm (-40%) MA=53mm
elbow triceps 0deg L=170mm (+0%) MA=-15mm 45deg L=181mm (+7%) MA=-15mm 90deg L=193mm (+14%) MA=-15mm 140deg L=206mm (+21%) MA=-15mm
shoulder deltoid 0deg L=140mm (+0%) MA=2mm 45deg L=135mm (-4%) MA=12mm 90deg L=123mm (-13%) MA=19mm
shoulder supraspinatus 0deg L=114mm (+0%) MA=5mm 45deg L=108mm (-5%) MA=9mm 90deg L=100mm (-12%) MA=10mm
shoulder pecmajor 0deg L=191mm (+0%) MA=-45mm 45deg L=226mm (+18%) MA=-43mm 90deg L=255mm (+33%) MA=-29mm
```

참고 문헌 값(직접 대조 가능한 것만): 위팔노근 최대 모멘트팔 평균 7.7 cm (Murray, Buchanan & Delp 2000), 위팔두갈래근 4.17 cm · 위팔근 3.67 cm (Pan & Li 학회 초록, 다른 집단·방법).
→ 위팔노근(70 mm)·위팔두갈래근(43 mm)은 비슷하고, **위팔근(22 mm)은 문헌보다 작습니다.** 위팔세갈래근의 15 mm는 측정값이 아니라 감김 경로 모델에 넣은 값입니다.
**따라서 게임에서는 길이 변화의 % 숫자를 표시하지 않고 방향(짧아짐/길어짐/변화 없음)만 표시하며, "근사 모델 · 물리 시뮬레이션 아님"을 화면에 적었습니다.**

## 4. 판정 요약
- 근육 16개 요소(넓은등근 포함)가 모두 교과서의 이는곳 뼈·닿는곳 뼈에 실제로 닿아 있습니다.
- 퍼즐 부착점 21곳이 모두 교과서상의 부착 부위(뼈의 높이·면, 어깨뼈 관절오목 기준 위치)에 있습니다.
- 운동 프레임에서 근육 길이 변화의 방향이 모두 해부학적으로 맞습니다(굽힘: 위팔두갈래근·위팔근·위팔노근 짧아짐, 위팔세갈래근 길어짐 / 벌림: 어깨세모근 중간섬유·가시위근 짧아짐, 큰가슴근·넓은등근 길어짐, 위팔근 변화 없음).

## 5. 한계
- 운동 화면의 근육은 작용선(도식)이며 수축 형태를 재현하지 않습니다(게임 화면에 표시).
- 근육 메시 변형(두께 변화 포함)은 7장에 따라 폐기했습니다. 운동 화면은 원본 메시(0°)와 작용선만 표시합니다.
- 위팔근 모멘트팔은 문헌보다 작고, 위팔세갈래근 경로는 모멘트팔 15 mm로 가정했습니다.
- 어깨 벌림은 어깨뼈:위팔 1:3 리듬, 위팔뼈 바깥돌림 생략. 모델 안정 자세가 약 9° 벌려져 있어 90° 프레임의 팔이 수평보다 조금 높습니다.
- 실제 iPad 실기 테스트(성능·터치)는 하지 않았습니다. 성능 수치는 검증되지 않았습니다.

## 6. 운동학 단순화 (게임 화면에 "⚠ 단순화" 문구로 표시)

**팔꿈치 굽힘 (0–140°, 가쪽면)**
| 실제 운동 | 이 모델 |
|---|---|
| 굽힘축이 각도에 따라 조금씩 이동 | 고정축(위팔뼈 위·아래 관절융기 선, 도르래·작은머리 곡률 중심) |
| 아래팔 엎침·뒤침이 함께 일어날 수 있음, 위팔두갈래근 모멘트팔이 뒤침 여부에 따라 달라짐 | 해부학적 자세의 뒤침 고정 |
| 운반각(carrying angle) 변화 | 반영 안 함 |
| 근육끼리 눌리고 미끄러짐 | 직선 경로 근사, 140° 근처에서 위팔·아래팔 근육이 겹쳐 보일 수 있음 |

**어깨 벌림 (0–90°, 앞면)**
| 실제 운동 | 이 모델 |
|---|---|
| 어깨뼈 위쪽돌림(어깨뼈 면에 수직인 축) + 뒤기울임 + 가쪽돌림 | 복장빗장관절을 지나는 전후축 회전 하나로 근사, 위팔:어깨뼈 = 3:1(전체 각의 25 %) |
| 빗장뼈 올림·뒤쪽돌림, 봉우리빗장관절 운동 | 어깨뼈와 한 덩어리로 움직임 |
| 위팔뼈 가쪽돌림(큰결절이 봉우리 밑을 지나기 위해 필요) | 생략 |
| 위팔뼈머리의 아래쪽 미끄러짐·구름 | 생략(관절 중심 고정 회전) |
| 관상면이 아닌 어깨뼈 면(scaption)에서 들기 | 관상면 기준 |
| 모델 안정 자세가 이미 약 9° 벌려져 있음 | 90° 프레임의 팔이 수평보다 약간 높음 |

따라서 운동 재현 화면은 "어느 근육이 짧아지고 길어지는가"(주작용근·대항근)를 보여 주기 위한 도식이며, 관절 운동 자체의 정확한 재현이 아닙니다.


## 7. 운동 재현 방식 변경 (메시 변형 → 강체 뼈 + 근육 작용선)

### 7.1 무엇이 원본 메시이고 무엇이 코드로 만든 것인가
| 화면 | 내용 | 원본 여부 |
|---|---|---|
| 근육 지도·이는곳·닿는곳 퍼즐의 해부도, 근육 레이어 | BodyParts3D 메시 그대로(표시용 1:4 세분 + Taubin 평활만 적용, 형태·위치 불변) | **원본 메시** |
| 운동 재현 0° 화면 | 같은 원본 메시, 안정 자세 | **원본 메시** |
| 운동 재현 중 뼈 | 원본 뼈 메시를 관절축으로 **강체 회전**(모양 변화 없음) | 원본 메시 + 강체 이동 |
| 운동 재현 중 근육 | 원본 근육 메시의 **중심선**을 뼈별로 강체 이동한 "작용선"(띠) | 원본에서 계산한 도식 |
| (폐기) 이전 운동 프레임의 근육 | 직선 경로 모핑 + 뼈 근처 강체 혼합으로 **코드가 변형한 메시** | 코드로 변형 — 폐기 |

### 7.2 이전 방식(메시 변형) 점검 결과 — `deform_audit.py`
늘어남 = 변형 후/전 메시 모서리 길이 비율, 뼈 내부 % = 일반화 와인딩 수로 판정한 뼈 안쪽 정점 비율, 꺾임 = 중심선 최대 굽힘각.

| angle | element | stretch p99 | stretch max | inside bone % | centre-line max bend (rest → posed) |
|---|---|---|---|---|---|
| 0° | biceps FJ1478 | ×1.00 | ×1.00 | 0.0 | 47° → 47° |
| 0° | biceps FJ1512 | ×1.00 | ×1.00 | 0.0 | 34° → 34° |
| 0° | brachialis FJ1486 | ×1.00 | ×1.00 | 0.0 | 72° → 72° |
| 0° | brachioradialis FJ1487 | ×1.00 | ×1.00 | 0.0 | 30° → 30° |
| 0° | triceps FJ1479 | ×1.00 | ×1.00 | 0.0 | 56° → 56° |
| 0° | triceps FJ1477 | ×1.00 | ×1.00 | 0.0 | 74° → 74° |
| 0° | triceps FJ1480 | ×1.00 | ×1.00 | 0.0 | 70° → 70° |
| 30° | biceps FJ1478 | ×1.28 | ×2.09 | 0.0 | 47° → 47° |
| 30° | biceps FJ1512 | ×1.02 | ×1.04 | 0.0 | 34° → 35° |
| 30° | brachialis FJ1486 | ×1.29 | ×6.27 | 0.2 | 72° → 79° |
| 30° | brachioradialis FJ1487 | ×2.14 | ×4.17 | 0.0 | 30° → 31° |
| 30° | triceps FJ1479 | ×1.41 | ×1.62 | 0.0 | 56° → 54° |
| 30° | triceps FJ1477 | ×1.27 | ×2.33 | 0.6 | 74° → 61° |
| 30° | triceps FJ1480 | ×1.39 | ×5.49 | 4.6 | 70° → 64° |
| 60° | biceps FJ1478 | ×1.72 | ×3.16 | 0.0 | 47° → 49° |
| 60° | biceps FJ1512 | ×1.06 | ×1.08 | 0.0 | 34° → 40° |
| 60° | brachialis FJ1486 | ×1.87 | ×11.85 | 2.0 | 72° → 75° |
| 60° | brachioradialis FJ1487 | ×3.59 | ×7.16 | 0.0 | 30° → 55° |
| 60° | triceps FJ1479 | ×1.91 | ×2.34 | 0.0 | 56° → 54° |
| 60° | triceps FJ1477 | ×1.63 | ×3.68 | 0.7 | 74° → 43° |
| 60° | triceps FJ1480 | ×2.17 | ×9.98 | 5.3 | 70° → 56° |
| 90° | biceps FJ1478 | ×2.18 | ×4.09 | 0.0 | 47° → 52° |
| 90° | biceps FJ1512 | ×1.11 | ×1.21 | 0.0 | 34° → 58° |
| 90° | brachialis FJ1486 | ×2.59 | ×16.64 | 4.0 | 72° → 78° |
| 90° | brachioradialis FJ1487 | ×4.90 | ×9.68 | 0.2 | 30° → 55° |
| 90° | triceps FJ1479 | ×2.69 | ×3.55 | 0.0 | 56° → 68° |
| 90° | triceps FJ1477 | ×2.16 | ×5.04 | 0.9 | 74° → 48° |
| 90° | triceps FJ1480 | ×3.54 | ×14.47 | 5.0 | 70° → 57° |
| 120° | biceps FJ1478 | ×2.61 | ×4.76 | 0.8 | 47° → 55° |
| 120° | biceps FJ1512 | ×1.16 | ×1.36 | 9.8 | 34° → 56° |
| 120° | brachialis FJ1486 | ×3.27 | ×20.76 | 6.4 | 72° → 80° |
| 120° | brachioradialis FJ1487 | ×5.80 | ×11.35 | 0.4 | 30° → 56° |
| 120° | triceps FJ1479 | ×3.66 | ×5.46 | 0.0 | 56° → 74° |
| 120° | triceps FJ1477 | ×2.96 | ×6.40 | 1.1 | 74° → 70° |
| 120° | triceps FJ1480 | ×5.01 | ×18.96 | 4.1 | 70° → 68° |
| 140° | biceps FJ1478 | ×2.81 | ×5.02 | 6.2 | 47° → 56° |
| 140° | biceps FJ1512 | ×1.18 | ×1.44 | 19.3 | 34° → 60° |
| 140° | brachialis FJ1486 | ×3.60 | ×23.38 | 9.3 | 72° → 74° |
| 140° | brachioradialis FJ1487 | ×6.13 | ×11.98 | 0.9 | 30° → 50° |
| 140° | triceps FJ1479 | ×4.30 | ×6.76 | 0.0 | 56° → 48° |
| 140° | triceps FJ1477 | ×3.56 | ×7.31 | 1.1 | 74° → 115° |
| 140° | triceps FJ1480 | ×5.87 | ×21.94 | 3.6 | 70° → 89° |

→ 120–140°에서 모서리가 최대 ×20 이상 늘어나고(찢어짐), 위팔두갈래근 짧은갈래 19 %·위팔근 9 %가 뼈 속으로 들어가며, 위팔세갈래근 가쪽갈래 중심선이 115°까지 꺾였습니다. 사용자 지적(팔꿈치 주변 근육이 비정상적으로 늘어나고 꺾임)과 일치하므로 이 방식은 **폐기**했습니다.

### 7.3 새 방식 — `paths.py`
- 근육 메시는 **변형하지 않습니다.** 0°에서는 원본 메시를, 움직이는 동안에는 원본 메시 중심선(근육 단면 중심, 이는곳·닿는곳 고정)을 띠로 표시합니다.
- 중심선의 각 점은 해부학적 평면 기준으로 한 분절(어깨뼈/위팔/아래팔)에 붙어 강체로 움직입니다(팔꿈치 축 아래 = 아래팔, 위팔뼈머리 중심보다 가쪽 = 위팔).
- 관절 가까이(팔꿈치 축 35 mm, 위팔뼈머리 30 mm, 어깨세모근 45 mm 이내)의 점은 관절을 감싸는 연부조직이라 어느 뼈에도 강체로 붙일 수 없어 제외하고, 그 구간은 직선(굽힘근: 관절 앞으로 활시위처럼) 또는 원통 감김(위팔세갈래근 r = 18 mm, 어깨세모근·가시위근 r = 26 mm)으로 잇습니다 — OpenSim 근골격 모델의 via-point·wrapping 방식과 같은 개념.
- 위팔세갈래근·가시위근은 뼈 위에 놓인 근육이라 중심선 전체를 몸쪽 뼈에 두고 닿는곳만 먼쪽 뼈와 함께 움직입니다.

### 7.4 새 방식 점검 결과 — `paths_audit.py` (길이 변화 / 경로가 뼈 내부에 있는 비율)

| round | element | 0° | 30° | 60° | 90° | 120° | 140° |
|---|---|---|---|---|---|---|---|
| elbow | biceps FJ1478 | +0% / 0% | -3% / 0% | -8% / 0% | -14% / 0% | -20% / 0% | -22% / 0% |
| elbow | biceps FJ1512 | +0% / 0% | -3% / 0% | -8% / 0% | -13% / 0% | -18% / 0% | -19% / 0% |
| elbow | brachialis FJ1486 | +0% / 0% | -5% / 0% | -13% / 0% | -24% / 0% | -37% / 0% | -45% / 0% |
| elbow | brachioradialis FJ1487 | +0% / 0% | -3% / 0% | -7% / 0% | -13% / 0% | -20% / 0% | -24% / 0% |
| elbow | triceps FJ1479 | +0% / 0% | +4% / 0% | +8% / 0% | +12% / 0% | +15% / 0% | +18% / 0% |
| elbow | triceps FJ1477 | +0% / 0% | +6% / 0% | +11% / 0% | +17% / 0% | +22% / 0% | +26% / 0% |
| elbow | triceps FJ1480 | +0% / 1% | +9% / 35% | +17% / 11% | +26% / 2% | +34% / 0% | +40% / 0% |
| shoulder | deltoid FJ1467 | +0% / 0% | -6% / 0% | -13% / 0% | -20% / 0% |  |  |
| shoulder | deltoid FJ1468 | +0% / 0% | +3% / 0% | -1% / 0% | -5% / 0% |  |  |
| shoulder | deltoid FJ1513 | +0% / 0% | +1% / 0% | -3% / 0% | -6% / 0% |  |  |
| shoulder | supraspinatus FJ1506 | +0% / 3% | -2% / 8% | +2% / 13% | +9% / 52% |  |  |
| shoulder | pecmajor FJ1447 | +0% / 0% | +8% / 0% | +16% / 0% | +24% / 0% |  |  |
| shoulder | pecmajor FJ1464 | +0% / 0% | +15% / 0% | +34% / 0% | +54% / 0% |  |  |
| shoulder | pecmajor FJ1446 | +0% / 0% | +15% / 0% | +32% / 0% | +50% / 0% |  |  |
| shoulder | latissimus LAT3 | +0% / 0% | +15% / 0% | +31% / 0% | +48% / 0% |  |  |

- 화면에 그리는 경로는 모든 각도에서 뼈 내부 0 % (아래 두 예외 제외)이며, 길이 변화 방향이 해부학과 일치합니다(굽힘근 짧아짐, 위팔세갈래근 길어짐 / 어깨세모근 중간섬유 짧아짐, 큰가슴근·넓은등근 길어짐).
- **예외 1 — 위팔세갈래근 안쪽갈래(FJ1480)**: 뼈 위에 바로 놓인 깊은 근육이라 30–60°에서 경로 일부가 뼈를 지나 **화면에 그리지 않습니다**(가쪽면에서는 가쪽갈래에 가려 보이지 않음). 길이 방향 집계에는 포함합니다.
- **예외 2 — 가시위근 60–90°**: 이 단순화된 어깨 운동학(관상면 회전, 1:3 리듬, 위팔뼈 가쪽돌림 없음)에서는 가시위근 경로가 30° 이후 다시 길어지고 위팔뼈머리를 지나갑니다. 문헌상 가시위근은 이 범위에서도 벌림근이므로 **모델 한계**입니다. 해당 각도에서는 경로를 그리지 않고, 길이 표시는 "모델 한계로 생략"으로 나옵니다.

### 7.5 대안 검토
| 방식 | 형태 보존 | 해부학적 검증 가능성 | 판단 |
|---|---|---|---|
| 직선 모핑 + 강체 혼합(이전) | 실패(찢어짐·관통) | 없음 | 폐기 |
| 선형 블렌드 스키닝(LBS) | 관절에서 부피 손실·candy-wrapper | 없음 | 부적합 |
| ARAP 등 형태 보존 변형 | 국소 형태는 유지 | 충돌·수축 형태는 여전히 근거 없음 | 보류(검증 자료 필요) |
| 유한요소 근육 시뮬레이션(FEM, Ziva 등) | 가장 사실적 | 근육 물성·활성 데이터 필요, 실시간 불가 | 범위 밖 |
| **정적 원본 해부도 + 강체 뼈 + 작용선(현재)** | 원본 메시 그대로 | 부착점·길이 변화 방향 검증 가능 | **채택** |

학습자가 오해하지 않도록 운동 화면에 "움직이는 동안 근육은 실제 모양이 아닌 작용선으로 표시 · 근육 수축 모양을 재현한 것이 아님"을 표시합니다.
