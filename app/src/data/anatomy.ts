import { MUSCLES, MuscleId } from './muscles';
import { CARPALS, CARPAL } from './hand';

// Anatomy content for Chapter 1. Geometry is the RIGHT upper limb in ANTERIOR view
// (anatomical position, palms forward). Viewer's LEFT = patient's LATERAL side.
// Frame: 760 x 1260 logical units. Sternum (midline) at x = 640.

export type Prim =
  | { t: 'e'; x: number; y: number; rx: number; ry: number; r?: number }
  | { t: 'q'; x1: number; y1: number; w1: number; x2: number; y2: number; w2: number }
  | { t: 'p'; pts: [number, number][]; rad?: number };

export interface BoneDef {
  id: BoneId;
  ko: string; alt: string; en: string;
  prims: Prim[];
  region: 'upper' | 'lower';
  info: string;          // shown when picked up / archive
  wrongSlot: string;     // feedback if placed in the wrong place
}

export type BoneId = 'clavicle' | 'scapula' | 'humerus' | 'radius' | 'ulna' | 'fibula';

const E = (x: number, y: number, rx: number, ry: number, r = 0): Prim => ({ t: 'e', x, y, rx, ry, r });
const Q = (x1: number, y1: number, w1: number, x2: number, y2: number, w2: number): Prim => ({ t: 'q', x1, y1, w1, x2, y2, w2 });
const P = (pts: [number, number][], rad = 14): Prim => ({ t: 'p', pts, rad });

export const FRAME = { w: 760, h: 1260 };

export const BONES: Record<BoneId, BoneDef> = {
  scapula: {
    id: 'scapula', ko: '어깨뼈', alt: '어깨뼈', en: 'Scapula', region: 'upper',
    prims: [
      P([[532, 150], [470, 168], [452, 172], [445, 182], [436, 179], [418, 184], [372, 212], [354, 236], [352, 292], [378, 330], [430, 420], [482, 526], [500, 520], [520, 400], [548, 196]], 7),
      Q(386, 196, 26, 344, 160, 26),  // acromion base
      Q(344, 160, 30, 330, 140, 30),  // acromion tip
      Q(414, 192, 20, 398, 166, 18),  // coracoid base (rising)
      Q(398, 166, 18, 370, 182, 14),  // coracoid hook (lateral)
      E(368, 184, 10, 8),
      E(347, 262, 11, 33),            // glenoid cavity rim
    ],
    info: '팔이음뼈(어깨띠)를 이루는 납작한 삼각형 뼈. 가쪽각의 관절오목이 위팔뼈머리와 오목위팔관절을, 봉우리가 빗장뼈와 봉우리빗장관절을 만든다.',
    wrongSlot: '어깨뼈는 가슴우리 뒤쪽 위에 위치하며, 가쪽 위의 관절오목으로 위팔뼈머리를 받칩니다.',
  },
  clavicle: {
    id: 'clavicle', ko: '빗장뼈', alt: '빗장뼈', en: 'Clavicle', region: 'upper',
    prims: [
      Q(612, 172, 30, 520, 160, 22),
      Q(520, 160, 22, 432, 150, 19),
      Q(432, 150, 19, 372, 140, 25),
      E(616, 175, 19, 18),
      E(366, 140, 17, 12),
    ],
    info: '몸통 뼈대와 팔을 직접 잇는 유일한 뼈. 안쪽 끝은 복장뼈와 복장빗장관절, 가쪽 끝은 봉우리와 봉우리빗장관절을 이룬다. 위에서 보면 S자 곡선.',
    wrongSlot: '빗장뼈는 복장뼈 위끝(복장뼈자루)에서 어깨 꼭대기 봉우리까지 수평으로 놓이는 뼈입니다.',
  },
  humerus: {
    id: 'humerus', ko: '위팔뼈', alt: '위팔뼈', en: 'Humerus', region: 'upper',
    prims: [
      Q(300, 300, 56, 290, 430, 34),
      Q(290, 430, 34, 282, 640, 31),
      E(270, 445, 8, 28),             // deltoid tuberosity (lateral)
      E(278, 250, 25, 27),            // greater tubercle (lateral)
      E(312, 262, 35, 37),            // head (faces medially into glenoid)
      E(323, 302, 11, 12),            // lesser tubercle (anterior)
      Q(282, 640, 31, 284, 690, 70),
      E(284, 708, 60, 24),
      E(226, 704, 14, 17),            // lateral epicondyle
      E(347, 698, 21, 18),            // medial epicondyle (more prominent)
      E(250, 737, 18, 15),            // capitulum (lateral)
      E(301, 740, 27, 15),            // trochlea (medial)
    ],
    info: '팔에서 가장 긴 뼈. 몸쪽부분 위팔뼈머리는 안쪽·위·뒤를 향해 관절오목과 만나고, 먼쪽부분 작은머리는 노뼈, 도르래는 자뼈와 관절한다.',
    wrongSlot: '위팔뼈는 어깨뼈 관절오목 아래로 팔꿈치까지 이어지는 위팔의 긴뼈입니다.',
  },
  ulna: {
    id: 'ulna', ko: '자뼈', alt: '자뼈', en: 'Ulna', region: 'upper',
    prims: [
      Q(304, 786, 30, 322, 1000, 20),
      Q(322, 1000, 20, 330, 1168, 18),
      E(306, 760, 26, 24),            // olecranon / trochlear notch region
      E(298, 786, 17, 10),            // coronoid process
      E(331, 1178, 16, 14),           // ulnar head
      Q(334, 1184, 10, 340, 1206, 6), // ulnar styloid (medial)
    ],
    info: '아래팔의 안쪽(새끼손가락 쪽) 뼈. 몸쪽부분이 크고(팔꿈치머리·도르래패임) 먼쪽부분으로 갈수록 가늘어진다. 위팔뼈 도르래와 위팔자관절을 이룬다.',
    wrongSlot: '자뼈는 해부학적 자세에서 아래팔의 안쪽(새끼손가락 쪽)에 있습니다. 몸쪽부분이 크고 먼쪽부분이 가늘어요.',
  },
  radius: {
    id: 'radius', ko: '노뼈', alt: '노뼈', en: 'Radius', region: 'upper',
    prims: [
      Q(250, 776, 17, 252, 804, 14),  // neck
      Q(252, 804, 16, 240, 1000, 22),
      Q(240, 1000, 22, 234, 1150, 38),
      E(262, 814, 9, 13),             // radial tuberosity (anteromedial)
      E(250, 768, 23, 10),            // radial head (disc)
      E(236, 1162, 31, 16),
      Q(214, 1166, 15, 204, 1192, 8), // radial styloid (lateral)
    ],
    info: '아래팔의 가쪽(엄지 쪽) 뼈. 몸쪽부분 노뼈머리는 원반 모양으로 위팔뼈 작은머리와, 먼쪽부분은 넓어져 손목뼈와 노손목관절을 이룬다.',
    wrongSlot: '노뼈는 해부학적 자세에서 아래팔의 가쪽(엄지 쪽)에 있습니다. 먼쪽부분이 넓고 몸쪽부분(노뼈머리)이 작아요.',
  },
  fibula: {
    id: 'fibula', ko: '종아리뼈', alt: '종아리뼈', en: 'Fibula', region: 'lower',
    prims: [
      Q(380, 160, 14, 384, 700, 12),
      Q(384, 700, 12, 380, 1050, 14),
      E(378, 150, 20, 18),            // fibular head
      E(380, 1080, 18, 36),           // lateral malleolus
    ],
    info: '다리(종아리)의 가늘고 긴 가쪽 뼈. 체중을 거의 지지하지 않으며, 먼쪽부분은 가쪽복사를 이룬다. 팔 뼈대가 아니다!',
    wrongSlot: '종아리뼈는 다리의 뼈입니다. 팔 뼈대 조립에는 필요하지 않아요.',
  },
};

// Surface detail for the illustrated bones (frame coords): ridges/borders (lines) and fossae (shaded ellipses).
export interface BoneDetail { lines: [number, number][][]; shades: [number, number, number, number, number?][] }
export const DETAILS: Record<BoneId, BoneDetail> = {
  scapula: {
    lines: [[[518, 236], [470, 250], [420, 272]], [[512, 318], [466, 322], [420, 334]], [[500, 400], [470, 396], [440, 392]], [[372, 322], [430, 420], [478, 512]], [[362, 226], [356, 262], [364, 300]]],
    shades: [[460, 340, 46, 120, -0.25], [347, 262, 7, 25]],
  },
  clavicle: { lines: [[[560, 176], [500, 168], [446, 160]]], shades: [[392, 150, 14, 6]] },
  humerus: {
    lines: [[[300, 228], [287, 262], [298, 296]], [[304, 284], [300, 330], [294, 384]], [[270, 322], [316, 324]], [[268, 424], [266, 468]], [[300, 600], [322, 650], [340, 688]], [[270, 600], [250, 650], [230, 690]], [[301, 728], [301, 752]]],
    shades: [[296, 694, 13, 9], [254, 696, 9, 7]],
  },
  ulna: { lines: [[[292, 806], [312, 1000], [322, 1160]]], shades: [[306, 762, 14, 15], [284, 784, 5, 8]] },
  radius: { lines: [[[240, 780], [262, 780]], [[262, 832], [258, 1000], [252, 1140]]], shades: [[262, 1160, 5, 8]] },
  fibula: { lines: [[[372, 176], [388, 176]], [[386, 220], [390, 700], [384, 1030]]], shades: [] },
};

export const UPPER_ORDER: BoneId[] = ['clavicle', 'scapula', 'humerus', 'radius', 'ulna'];

// Landmarks (frame coordinates) used by the X-ray reading and alignment puzzles.
export interface Landmark { id: string; ko: string; en: string; x: number; y: number; where: string; }
export const LANDMARKS: Record<string, Landmark> = {
  acromion: { id: 'acromion', ko: '봉우리', en: 'Acromion', x: 334, y: 146, where: '어깨뼈가시가 가쪽으로 이어진 어깨 꼭대기 돌기. 빗장뼈와 봉우리빗장관절(AC joint)을 이룹니다.' },
  coracoid: { id: 'coracoid', ko: '부리돌기', en: 'Coracoid process', x: 372, y: 182, where: '빗장뼈 아래, 관절오목 안쪽 앞으로 갈고리처럼 튀어나온 돌기. 작은가슴근·부리위팔근·위팔두갈래근 짧은갈래가 부착합니다.' },
  glenoid: { id: 'glenoid', ko: '관절오목', en: 'Glenoid cavity', x: 348, y: 270, where: '어깨뼈 가쪽각의 얕은 오목. 위팔뼈머리와 오목위팔관절을 이룹니다.' },
  head: { id: 'head', ko: '위팔뼈머리', en: 'Humeral head', x: 314, y: 258, where: '위팔뼈 몸쪽부분의 반구형 관절면. 안쪽·위·뒤를 향합니다.' },
  greater: { id: 'greater', ko: '큰결절', en: 'Greater tubercle', x: 266, y: 248, where: '위팔뼈머리 가쪽의 큰 돌출부. 가시위근·가시아래근·작은원근이 부착합니다.' },
  lesser: { id: 'lesser', ko: '작은결절', en: 'Lesser tubercle', x: 323, y: 302, where: '위팔뼈 몸쪽부분 앞쪽의 작은 돌출부. 어깨밑근이 부착합니다.' },
  olecranon: { id: 'olecranon', ko: '팔꿈치머리', en: 'Olecranon', x: 306, y: 752, where: '자뼈 몸쪽부분 뒤쪽, 팔꿈치 끝을 이루는 돌기. 위팔세갈래근이 부착합니다. 어깨 영상에는 보이지 않아요.' },
  radialHead: { id: 'radialHead', ko: '노뼈머리', en: 'Radial head', x: 250, y: 768, where: '노뼈 몸쪽부분의 원반 모양 머리. 팔꿉관절에서 위팔뼈 작은머리와 만납니다. 어깨 영상에는 보이지 않아요.' },
};

export const XRAY_TARGETS = ['acromion', 'coracoid', 'glenoid', 'head', 'greater'];
export const XRAY_DISTRACTORS_BASIC = ['lesser', 'olecranon'];
export const XRAY_DISTRACTORS_ADV = ['lesser', 'olecranon', 'radialHead'];

// Joint-alignment puzzle feedback.
export const ALIGN_HINTS: Record<'humerus' | 'ulna' | 'radius', { flip: string; mirror: string }> = {
  humerus: {
    flip: '위팔뼈가 뒤집혀 있습니다. 둥근 위팔뼈머리는 위쪽에서 어깨뼈 관절오목과 만나야 해요.',
    mirror: '위팔뼈의 좌우가 반대입니다. 위팔뼈머리는 안쪽(몸 중심)을 향하고, 큰결절은 가쪽에 있습니다. 안쪽위관절융기가 가쪽위관절융기보다 크게 돌출돼요.',
  },
  ulna: {
    flip: '자뼈가 뒤집혀 있습니다. 크고 두꺼운 몸쪽부분(팔꿈치머리·도르래패임)이 위에서 위팔뼈 도르래를 감싸야 해요.',
    mirror: '자뼈의 좌우가 반대입니다. 자뼈 붓돌기는 새끼손가락 쪽(안쪽)으로, 갈고리돌기는 노뼈 쪽(가쪽)으로 향합니다.',
  },
  radius: {
    flip: '노뼈가 뒤집혀 있습니다. 작은 원반형 노뼈머리는 위에서 위팔뼈 작은머리와 만나고, 넓은 먼쪽부분이 손목 쪽이에요.',
    mirror: '노뼈의 좌우가 반대입니다. 노뼈 붓돌기는 엄지 쪽(가쪽)으로 돌출되고, 노뼈거친면은 안쪽 앞을 향해요.',
  },
};

export interface ArchiveEntry { id: string; title: string; en: string; cat: '뼈' | '근육' | '개념' | '기록'; bone?: BoneId; muscle?: MuscleId; tex?: string; body: string; }
export const ARCHIVE: ArchiveEntry[] = [
  { id: 'bone_clavicle', title: '빗장뼈', en: 'Clavicle', cat: '뼈', bone: 'clavicle', body: BONES.clavicle.info + '\n\n임상: 낙상 시 가장 흔히 골절되는 뼈 중 하나로, 중간 1/3 부위 골절이 가장 많다.' },
  { id: 'bone_scapula', title: '어깨뼈', en: 'Scapula', cat: '뼈', bone: 'scapula', body: BONES.scapula.info + '\n\n주요 구조: 관절오목, 봉우리, 부리돌기, 어깨뼈가시, 상각·하각.' },
  { id: 'bone_humerus', title: '위팔뼈', en: 'Humerus', cat: '뼈', bone: 'humerus', body: BONES.humerus.info + '\n\n임상: 외과목(surgical neck) 골절 시 겨드랑신경, 중간 몸통 골절 시 노신경 손상에 주의.' },
  { id: 'bone_radius', title: '노뼈', en: 'Radius', cat: '뼈', bone: 'radius', body: BONES.radius.info + '\n\n임상: 먼쪽 노뼈 골절(Colles 골절)은 손을 짚고 넘어질 때 흔하다.' },
  { id: 'bone_ulna', title: '자뼈', en: 'Ulna', cat: '뼈', bone: 'ulna', body: BONES.ulna.info + '\n\n팔꿈치머리는 위팔세갈래근의 부착 부위로 팔꿈치 끝을 이룬다.' },
  { id: 'bone_fibula', title: '종아리뼈', en: 'Fibula', cat: '뼈', bone: 'fibula', body: BONES.fibula.info },
  { id: 'c_girdle', title: '팔이음뼈와 복장빗장관절', en: 'Shoulder girdle', cat: '개념', body: '팔이음뼈(어깨띠)는 빗장뼈와 어깨뼈로 구성된다. 팔은 복장빗장관절(SC joint)을 통해서만 몸통 뼈대와 뼈로 연결되며, 어깨뼈는 가슴우리 위를 미끄러지는 어깨가슴 "기능적 관절"로 움직인다.\n\n해부학적 자세(손바닥 앞)에서 노뼈는 엄지 쪽(가쪽), 자뼈는 새끼손가락 쪽(안쪽)에 놓인다.' },
  { id: 'c_gh', title: '오목위팔관절의 정렬', en: 'Glenohumeral joint', cat: '개념', body: '오목위팔관절은 볼-소켓형(절절구관절) 다축관절이다. 큰 위팔뼈머리가 얕은 관절오목과 만나므로 관절테두리·관절주머니·돌림근띠가 안정성을 보완한다.\n\n위팔뼈머리: 안쪽·위·뒤를 향함(후방경사).\n팔꿉: 위팔뼈 도르래–자뼈 도르래패임(위팔자관절), 작은머리–노뼈머리(위팔노관절).\n\n어깨 벌림 시 오목위팔관절과 어깨가슴관절은 대략 2:1 비율로 함께 움직인다(어깨위팔리듬).' },
  { id: 'c_xray', title: '어깨 AP 영상 판독', en: 'Shoulder AP radiograph', cat: '개념', body: '전후(AP) 영상에서 봉우리는 위팔뼈머리 위쪽, 부리돌기는 관절오목 안쪽 앞에 겹쳐 보인다. 큰결절은 위팔뼈머리 가쪽의 돌출부이고, 작은결절은 앞쪽에 있어 정면 영상에서 위팔뼈머리와 겹쳐 보인다.\n\n돌림근띠(SITS): 가시위근·가시아래근·작은원근 → 큰결절 / 어깨밑근 → 작은결절.' },
  { id: 'log_1', title: '연구일지 #031', en: 'Research log', cat: '기록', body: '피험 유닛 B-계열은 해부학 구조 데이터를 직접 "조립"하며 학습한다. 중앙 AI "MERIDIAN"에게 구조 복원 권한을 위임했다. — 책임연구원 H.' },
  { id: 'log_2', title: 'MERIDIAN 시스템 로그', en: 'AI log', cat: '기록', body: '[03:12:44] 구조 무결성 검사 실패.\n[03:12:45] 뼈대 데이터 손상률 71%.\n[03:12:45] 프로토콜 LOCKDOWN 실행. 복구 전까지 모든 격벽 봉쇄.\n[03:12:46] 인체 구조 복구가 필요합니다.' },
  { id: 'log_3', title: '피험체 프로토콜', en: 'Unit protocol', cat: '기록', body: '각 실험체는 SCAN 모듈로 숨겨진 구조 데이터를 탐지할 수 있다. 데이터는 실물 표본 형태로 저장되며, 복구 테이블에서 재조립해야 한다.\n\n주의: 오염된 표본(다른 부위의 뼈)이 섞여 있을 수 있음.' },
  // ---------------- CHAPTER 2 ----------------
  ...(Object.values(MUSCLES).map(m => ({
    id: `mus_${m.id}`, title: m.ko, en: m.en, cat: '근육' as const, muscle: m.id,
    body: `이는곳: ${m.originText}\n닿는곳: ${m.insertionText}\n작용: ${m.action}\n신경: ${m.nerve}`,
  }))),
  { id: 'c_mmap', title: '어깨·위팔의 표층 근육', en: 'Superficial muscles of the shoulder & arm', cat: '개념', body: '앞에서 보면 어깨세모근이 어깨를 덮고, 큰가슴근이 가슴에서 부채꼴로 모여 위팔뼈 결절사이고랑 가쪽입술에 붙는다. 두 근육 사이의 홈이 어깨세모가슴근고랑(deltopectoral groove)이다.\n\n위팔 앞쪽: 위팔두갈래근(표층) · 위팔근(깊은층) · 부리위팔근(위 안쪽).\n위팔 뒤쪽: 위팔세갈래근.\n아래팔 가쪽 위: 위팔노근.' },
  { id: 'c_origin', title: '이는곳과 닿는곳', en: 'Origin & insertion', cat: '개념', body: '이는곳(origin)은 근육이 수축할 때 비교적 고정되는 몸쪽 부착부, 닿는곳(insertion)은 끌려와 움직이는 먼쪽 부착부이다. 근육은 항상 닿는곳을 이는곳 쪽으로 당긴다.\n\n근육의 작용은 "어느 관절의 어느 쪽을 지나가는가"로 결정된다. 팔꿉관절 앞을 지나는 위팔두갈래근·위팔근은 굽힘, 뒤를 지나는 위팔세갈래근은 폄.\n\n위팔두갈래근은 두 갈래(긴갈래: 관절위결절, 짧은갈래: 부리돌기)에서 시작하는 이관절근으로, 어깨와 팔꿈치를 모두 지난다.' },
  { id: 'c_agonist', title: '주작용근과 대항근', en: 'Agonist & antagonist', cat: '개념', body: '주작용근(agonist)은 움직임을 직접 만드는 근육, 대항근(antagonist)은 반대 작용을 하는 근육으로 움직이는 동안 이완하며 길어진다(상호억제). 협동근(synergist)은 주작용근을 돕는다.\n\n팔꿈치 굽힘: 주작용근 위팔근·위팔두갈래근(+위팔노근) / 대항근 위팔세갈래근.\n어깨 벌림: 가시위근이 벌림을 시작(0–15°)하고 위팔뼈머리를 관절오목에 고정, 어깨세모근 중간섬유가 이어서 들어 올린다. 대항근은 큰가슴근·넓은등근(모음근).' },
  { id: 'log_4', title: '근육 연결실 운영 기록', en: 'Muscle lab log', cat: '기록', body: '근육 데이터는 "이는곳–닿는곳" 한 쌍으로 저장된다. 부착 좌표가 하나라도 어긋나면 해당 근육은 수축 신호를 받아도 관절을 움직이지 못한다. — 운영팀' },
  { id: 'log_5', title: 'MERIDIAN 시스템 로그 #2', en: 'AI log', cat: '기록', body: '[04:02:10] 뼈대 구조 복구 확인.\n[04:02:12] 근육 연결 데이터 손상률 64%.\n[04:02:13] 경고: 전기자극 장치가 근육 신호 없이 출력을 올리고 있음.\n[04:02:14] 근육 연결실 봉쇄 유지.' },
  { id: 'log_6', title: '자극 제어 매뉴얼', en: 'Stimulator manual', cat: '기록', body: '근육 연결이 복구되면 전기자극 장치가 재가동된다. 과부하가 발생하면 자극 제어실(M-04)의 방전 레버로 잔류 전하를 빼야 한다. 방전 전에는 운동 재현실 출입문이 열리지 않는다.' },
  // ---------------- CHAPTER 3 ----------------
  ...CARPALS.map(c => ({ id: `car_${c}`, title: CARPAL[c].ko, en: CARPAL[c].en, cat: '뼈' as const, tex: `ch3_car_${c}`, body: `${CARPAL[c].row} · ${CARPAL[c].shape}\n\n${CARPAL[c].info}` })),
  { id: 'c_carpal', title: '손목뼈 8개의 배열', en: 'Carpal bones', cat: '개념', body: '손목뼈는 두 줄로 4개씩 놓인다(엄지 쪽부터).\n몸쪽 줄: 손배뼈 · 반달뼈 · 세모뼈 · 콩알뼈\n먼쪽 줄: 큰마름뼈 · 작은마름뼈 · 알머리뼈 · 갈고리뼈\n\n노뼈는 손배뼈·반달뼈와 손목관절을 이루고, 자뼈는 관절원판을 사이에 두어 손목뼈에 직접 닿지 않는다.\n먼쪽 줄은 손허리뼈와 만난다: 엄지(1)–큰마름뼈(안장관절), 2–작은마름뼈, 3–알머리뼈, 4·5–갈고리뼈.\n\n손바닥 쪽에서 손목뼈는 오목한 고랑을 이루고, 그 위를 굽힘근지지띠(콩알뼈·갈고리뼈 갈고리 ↔ 손배뼈결절·큰마름뼈결절)가 덮어 손목굴을 만든다. 손목굴로 손가락 굽힘근 힘줄과 정중신경이 지난다.' },
  { id: 'c_handxray', title: '손 PA 영상 판독', en: 'Hand PA radiograph', cat: '개념', body: 'PA(뒤앞) 손 영상에서 손목뼈는 서로 겹쳐 보인다. 콩알뼈는 세모뼈 위에 겹쳐 둥글게 보이고, 갈고리뼈의 갈고리는 고리 모양의 진한 테두리로 보인다.\n알머리뼈는 가운데의 가장 큰 뼈, 손배뼈는 노뼈 붓돌기 바로 먼쪽의 길쭉한 뼈다.\n\n임상: 손을 짚고 넘어진 뒤 해부학코담배갑 압통 → 손배뼈 골절 의심. 첫 영상에서 안 보일 수 있어 손배뼈 전용 촬영이나 추적 검사를 한다.' },
  { id: 'c_joint', title: '윤활관절의 종류', en: 'Types of synovial joints', cat: '개념', body: '관절면의 모양이 움직임을 정한다.\n· 절구관절(3축): 어깨관절, 엉덩관절\n· 경첩관절(1축): 위팔자관절, 손가락뼈사이관절\n· 중쇠관절(1축, 돌림): 몸쪽 노자관절, 고리중쇠관절\n· 타원관절(2축): 노손목관절, 손허리손가락관절\n· 안장관절(2축 + 맞섬): 엄지 손목손허리관절\n· 평면관절(미끄러짐): 손목뼈사이관절, 봉우리빗장관절' },
  { id: 'log_7', title: '손목·관절실 운영 기록', en: 'Joint lab log', cat: '기록', body: '손목뼈 표본 8개를 네 장치에 두 개씩 나눠 보관했다. 각 장치의 해제 방법은 다른 방의 문서에 적어 두었다. — 관절팀' },
  { id: 'log_8', title: '유압 제어 매뉴얼', en: 'Hydraulic manual', cat: '기록', body: '손목뼈 재조립이 끝나면 관절 시험 프레스가 재가동된다. 압력이 치솟으면 유압 제어실(J-04)의 감압 밸브를 돌려야 한다. 감압 전에는 관절 시험실(J-03) 출입문이 열리지 않는다.' },
];