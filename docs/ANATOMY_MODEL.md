# CH2 해부 모델 검증 보고서

모든 수치는 `tools/anatomy3d/` 스크립트가 BodyParts3D 메시에서 직접 계산한 값입니다.
- 근육·뼈: BodyParts3D 4.0, © DBCLS, **CC BY 4.0**
- 광배근: BodyParts3D 3.0 (2011, 같은 원본 인체), © DBCLS, **CC BY-SA 2.1 JP** → 이 메시로 만든 그림(`mus_*_latissimus`, `mus_vis_latissimus`, `motion/shoulder_l*`)은 같은 조건(CC BY-SA 2.1 JP)으로 배포되며 별도 파일·별도 출처 표기로 분리했습니다.

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
긴뼈: 뼈 주축 기준 위치(0 = 근위 끝, 1 = 원위 끝)와 면(앞·뒤·외측·내측; 성분이 가장 큰 면의 70% 이상인 면은 함께 인정, 예: 앞내측).
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

처음 판정에서는 관절오목 중심을 "위팔뼈머리 중심에서 가장 가까운 한 점"으로 잡아 관절위결절이 기준 밖(+29 mm)으로 나왔습니다. 관절오목 면 전체의 중심으로 고친 뒤 관절위결절은 관절오목 위 테두리보다 1.9 mm 위로, 교과서 위치와 일치합니다. 자뼈거친면은 앞면·내측 성분이 같아(앞내측) 앞면으로 인정했습니다.

## 2c. 광배근 (`latissimus.py`)

BodyParts3D 4.0에는 광배근이 없어, 같은 원본 인체로 만든 3.0의 `FMA13358 right latissimus dorsi`를 사용했습니다. 두 버전의 뼈가 약 1 cm 어긋나 있어, 광배근이 붙는 뼈(위팔뼈, 어깨뼈, 7–12번 갈비뼈, T7–T12 척추뼈) 14개로 강체 ICP 정합을 했습니다.

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
- 위팔뼈 접촉 = 결절사이고랑 바닥: 큰원근 정지(안쪽 입술)와 큰가슴근 정지(바깥 입술) 사이 0.56 지점 → `grooveFloor`
- 척추 접촉: T7–T11 가시돌기, 허리·엉치 부위 → `thoracolumbar`; 아래 갈비뼈, 어깨뼈 아래각 접촉도 교과서 기시와 일치
- 앞면 해부도에서 보이는 부분: 모델의 앞쪽 가슴벽이 완전하지 않아(갈비뼈 사이 틈) 등쪽 광배근이 비쳐 보이므로, 갈비우리보다 바깥쪽(뒤겨드랑 주름)만 표시합니다.
- 정합 잔차 중앙값 2.4 mm(버전 간 메시 재작성 차이 포함)는 근육 형태 오차로 남습니다.

## 3. Muscle length in the posed frames (relative to rest) — model approximation, not shown as numbers in the game

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

길이 = 기시 접촉 정점 **전부**에서 정지점까지 직선 근섬유의 평균 길이(이전 방식은 기시를 한 점(중심)으로 잡아 넓은 기시를 가진 위팔근의 길이를 짧게 재서 −51%가 나왔음 → 수정 후 −37%).
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
- 근육 16개 요소(광배근 포함)가 모두 교과서의 기시 뼈·정지 뼈에 실제로 닿아 있습니다.
- 퍼즐 부착점 21곳이 모두 교과서상의 부착 부위(뼈의 높이·면, 어깨뼈 관절오목 기준 위치)에 있습니다.
- 운동 프레임에서 근육 길이 변화의 방향이 모두 해부학적으로 맞습니다(굽힘: 위팔두갈래근·위팔근·위팔노근 짧아짐, 위팔세갈래근 길어짐 / 벌림: 어깨세모근 중간섬유·가시위근 짧아짐, 큰가슴근·광배근 길어짐, 위팔근 변화 없음).

## 5. 한계
- 근육 변형은 유한요소·근육 역학 시뮬레이션이 아니라 "측정한 기시·정지 사이 직선 경로 + 부피 보존 + 건 길이 고정" 근사입니다(게임 화면에 표시).
- 근육 배 두께: 근섬유 평균 길이 기준 부피 보존으로 계산하고 ±25 %로 제한(이전: 기시 중심점 기준이라 위팔근이 최대 약 2배까지 굵어짐 → 수정). ±25 %는 초음파 연구에서 보고되는 수축 시 근육 두께 변화(대략 10–30 %)에 맞춘 상한이며, 개별 근육별 검증값은 아닙니다.
- 위팔근 모멘트팔은 문헌보다 작고, 위팔세갈래근 경로는 모멘트팔 15 mm로 가정했습니다.
- 어깨 벌림은 어깨뼈:위팔 1:3 리듬, 위팔뼈 바깥돌림 생략. 모델 안정 자세가 약 9° 벌려져 있어 90° 프레임의 팔이 수평보다 조금 높습니다.
- 실제 iPad 실기 테스트(성능·터치)는 하지 않았습니다. 성능 수치는 검증되지 않았습니다.

## 6. 운동학 단순화 (게임 화면에 "⚠ 단순화" 문구로 표시)

**팔꿈치 굽힘 (0–140°, 외측면)**
| 실제 운동 | 이 모델 |
|---|---|
| 굽힘축이 각도에 따라 조금씩 이동 | 고정축(위팔뼈 위·아래 관절융기 선, 도르래·작은머리 곡률 중심) |
| 전완 엎침·뒤침이 함께 일어날 수 있음, 위팔두갈래근 모멘트팔이 뒤침 여부에 따라 달라짐 | 해부학적 자세의 뒤침(회외) 고정 |
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

따라서 운동 재현 화면은 "어느 근육이 짧아지고 길어지는가"(주동근·길항근)를 보여 주기 위한 도식이며, 관절 운동 자체의 정확한 재현이 아닙니다.
