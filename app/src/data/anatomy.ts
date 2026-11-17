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
    id: 'scapula', ko: '견갑골', alt: '어깨뼈', en: 'Scapula', region: 'upper',
    prims: [
      P([[532, 150], [470, 168], [418, 184], [372, 212], [354, 236], [352, 292], [378, 330], [430, 420], [482, 526], [500, 520], [520, 400], [548, 196]], 18),
      Q(386, 196, 26, 344, 160, 26),  // acromion base
      Q(344, 160, 30, 330, 140, 30),  // acromion tip
      Q(414, 192, 20, 398, 166, 18),  // coracoid base (rising)
      Q(398, 166, 18, 370, 182, 14),  // coracoid hook (lateral)
      E(368, 184, 10, 8),
      E(347, 262, 11, 33),            // glenoid cavity rim
    ],
    info: '상지대(어깨띠)를 이루는 납작한 삼각형 뼈. 외측각의 관절와가 상완골두와 견갑상완관절을, 견봉이 쇄골과 견쇄관절을 만든다.',
    wrongSlot: '견갑골은 흉곽 뒤쪽 위에 위치하며, 바깥쪽 위의 관절와로 상완골두를 받칩니다.',
  },
  clavicle: {
    id: 'clavicle', ko: '쇄골', alt: '빗장뼈', en: 'Clavicle', region: 'upper',
    prims: [
      Q(612, 172, 30, 520, 160, 22),
      Q(520, 160, 22, 432, 150, 19),
      Q(432, 150, 19, 372, 140, 25),
      E(616, 175, 19, 18),
      E(366, 140, 17, 12),
    ],
    info: '몸통 골격과 상지를 직접 잇는 유일한 뼈. 안쪽 끝은 흉골과 흉쇄관절, 바깥쪽 끝은 견봉과 견쇄관절을 이룬다. 위에서 보면 S자 곡선.',
    wrongSlot: '쇄골은 흉골 위끝(흉골병)에서 어깨 꼭대기 견봉까지 수평으로 놓이는 뼈입니다.',
  },
  humerus: {
    id: 'humerus', ko: '상완골', alt: '위팔뼈', en: 'Humerus', region: 'upper',
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
    info: '상지에서 가장 긴 뼈. 근위부 상완골두는 안쪽·위·뒤를 향해 관절와와 만나고, 원위부 소두는 요골, 활차는 척골과 관절한다.',
    wrongSlot: '상완골은 견갑골 관절와 아래로 팔꿈치까지 이어지는 위팔의 긴뼈입니다.',
  },
  ulna: {
    id: 'ulna', ko: '척골', alt: '자뼈', en: 'Ulna', region: 'upper',
    prims: [
      Q(304, 786, 30, 322, 1000, 20),
      Q(322, 1000, 20, 330, 1168, 18),
      E(306, 760, 26, 24),            // olecranon / trochlear notch region
      E(298, 786, 17, 10),            // coronoid process
      E(331, 1178, 16, 14),           // ulnar head
      Q(334, 1184, 10, 340, 1206, 6), // ulnar styloid (medial)
    ],
    info: '전완의 안쪽(새끼손가락 쪽) 뼈. 근위부가 크고(주두·활차절흔) 원위부로 갈수록 가늘어진다. 상완골 활차와 위팔자관절(완척관절)을 이룬다.',
    wrongSlot: '척골은 해부학적 자세에서 전완의 안쪽(새끼손가락 쪽)에 있습니다. 근위부가 크고 원위부가 가늘어요.',
  },
  radius: {
    id: 'radius', ko: '요골', alt: '노뼈', en: 'Radius', region: 'upper',
    prims: [
      Q(250, 776, 17, 252, 804, 14),  // neck
      Q(252, 804, 16, 240, 1000, 22),
      Q(240, 1000, 22, 234, 1150, 38),
      E(262, 814, 9, 13),             // radial tuberosity (anteromedial)
      E(250, 768, 23, 10),            // radial head (disc)
      E(236, 1162, 31, 16),
      Q(214, 1166, 15, 204, 1192, 8), // radial styloid (lateral)
    ],
    info: '전완의 바깥쪽(엄지 쪽) 뼈. 근위부 요골두는 원반 모양으로 상완골 소두와, 원위부는 넓어져 손목뼈와 요골손목관절을 이룬다.',
    wrongSlot: '요골은 해부학적 자세에서 전완의 바깥쪽(엄지 쪽)에 있습니다. 원위부가 넓고 근위부(요골두)가 작아요.',
  },
  fibula: {
    id: 'fibula', ko: '비골', alt: '종아리뼈', en: 'Fibula', region: 'lower',
    prims: [
      Q(380, 160, 14, 384, 700, 12),
      Q(384, 700, 12, 380, 1050, 14),
      E(378, 150, 20, 18),            // fibular head
      E(380, 1080, 18, 36),           // lateral malleolus
    ],
    info: '하지(종아리)의 가늘고 긴 바깥쪽 뼈. 체중을 거의 지지하지 않으며, 원위부는 외측 복사(외과)를 이룬다. 상지 골격이 아니다!',
    wrongSlot: '비골(종아리뼈)은 하지의 뼈입니다. 상지 골격 조립에는 필요하지 않아요.',
  },
};

export const UPPER_ORDER: BoneId[] = ['clavicle', 'scapula', 'humerus', 'radius', 'ulna'];

// Landmarks (frame coordinates) used by the X-ray reading and alignment puzzles.
export interface Landmark { id: string; ko: string; en: string; x: number; y: number; where: string; }
export const LANDMARKS: Record<string, Landmark> = {
  acromion: { id: 'acromion', ko: '견봉', en: 'Acromion', x: 334, y: 146, where: '견갑극이 바깥쪽으로 이어진 어깨 꼭대기 돌기. 쇄골과 견쇄관절(AC joint)을 이룹니다.' },
  coracoid: { id: 'coracoid', ko: '오구돌기', en: 'Coracoid process', x: 372, y: 182, where: '쇄골 아래, 관절와 안쪽 앞으로 갈고리처럼 튀어나온 돌기. 소흉근·오훼완근·상완이두근 단두가 부착합니다.' },
  glenoid: { id: 'glenoid', ko: '관절와', en: 'Glenoid cavity', x: 348, y: 270, where: '견갑골 외측각의 얕은 오목. 상완골두와 견갑상완관절을 이룹니다.' },
  head: { id: 'head', ko: '상완골두', en: 'Humeral head', x: 314, y: 258, where: '상완골 근위부의 반구형 관절면. 안쪽·위·뒤를 향합니다.' },
  greater: { id: 'greater', ko: '대결절', en: 'Greater tubercle', x: 266, y: 248, where: '상완골두 바깥쪽의 큰 돌출부. 극상근·극하근·소원근이 부착합니다.' },
  lesser: { id: 'lesser', ko: '소결절', en: 'Lesser tubercle', x: 323, y: 302, where: '상완골 근위부 앞쪽의 작은 돌출부. 견갑하근이 부착합니다.' },
  olecranon: { id: 'olecranon', ko: '주두', en: 'Olecranon', x: 306, y: 752, where: '척골 근위부 뒤쪽, 팔꿈치 끝을 이루는 돌기. 상완삼두근이 부착합니다. 어깨 영상에는 보이지 않아요.' },
  radialHead: { id: 'radialHead', ko: '요골두', en: 'Radial head', x: 250, y: 768, where: '요골 근위부의 원반 모양 머리. 팔꿉관절에서 상완골 소두와 만납니다. 어깨 영상에는 보이지 않아요.' },
};

export const XRAY_TARGETS = ['acromion', 'coracoid', 'glenoid', 'head', 'greater'];
export const XRAY_DISTRACTORS_BASIC = ['lesser', 'olecranon'];
export const XRAY_DISTRACTORS_ADV = ['lesser', 'olecranon', 'radialHead'];

// Joint-alignment puzzle feedback.
export const ALIGN_HINTS: Record<'humerus' | 'ulna' | 'radius', { flip: string; mirror: string }> = {
  humerus: {
    flip: '상완골이 뒤집혀 있습니다. 둥근 상완골두는 위쪽에서 견갑골 관절와와 만나야 해요.',
    mirror: '상완골의 좌우가 반대입니다. 상완골두는 안쪽(몸 중심)을 향하고, 대결절은 바깥쪽에 있습니다. 내측상과가 외측상과보다 크게 돌출돼요.',
  },
  ulna: {
    flip: '척골이 뒤집혀 있습니다. 크고 두꺼운 근위부(주두·활차절흔)가 위에서 상완골 활차를 감싸야 해요.',
    mirror: '척골의 좌우가 반대입니다. 척골 경상돌기는 새끼손가락 쪽(안쪽)으로, 구상돌기는 요골 쪽(바깥쪽)으로 향합니다.',
  },
  radius: {
    flip: '요골이 뒤집혀 있습니다. 작은 원반형 요골두는 위에서 상완골 소두와 만나고, 넓은 원위부가 손목 쪽이에요.',
    mirror: '요골의 좌우가 반대입니다. 요골 경상돌기는 엄지 쪽(바깥쪽)으로 돌출되고, 요골조면은 안쪽 앞을 향해요.',
  },
};

export interface ArchiveEntry { id: string; title: string; en: string; cat: '뼈' | '개념' | '기록'; bone?: BoneId; body: string; }
export const ARCHIVE: ArchiveEntry[] = [
  { id: 'bone_clavicle', title: '쇄골 (빗장뼈)', en: 'Clavicle', cat: '뼈', bone: 'clavicle', body: BONES.clavicle.info + '\n\n임상: 낙상 시 가장 흔히 골절되는 뼈 중 하나로, 중간 1/3 부위 골절이 가장 많다.' },
  { id: 'bone_scapula', title: '견갑골 (어깨뼈)', en: 'Scapula', cat: '뼈', bone: 'scapula', body: BONES.scapula.info + '\n\n주요 구조: 관절와, 견봉, 오구돌기, 견갑극, 상각·하각.' },
  { id: 'bone_humerus', title: '상완골 (위팔뼈)', en: 'Humerus', cat: '뼈', bone: 'humerus', body: BONES.humerus.info + '\n\n임상: 외과목(surgical neck) 골절 시 액와신경, 중간 몸통 골절 시 요골신경 손상에 주의.' },
  { id: 'bone_radius', title: '요골 (노뼈)', en: 'Radius', cat: '뼈', bone: 'radius', body: BONES.radius.info + '\n\n임상: 원위 요골 골절(Colles 골절)은 손을 짚고 넘어질 때 흔하다.' },
  { id: 'bone_ulna', title: '척골 (자뼈)', en: 'Ulna', cat: '뼈', bone: 'ulna', body: BONES.ulna.info + '\n\n주두는 상완삼두근의 부착 부위로 팔꿈치 끝을 이룬다.' },
  { id: 'bone_fibula', title: '비골 (종아리뼈)', en: 'Fibula', cat: '뼈', bone: 'fibula', body: BONES.fibula.info },
  { id: 'c_girdle', title: '상지대와 흉쇄관절', en: 'Shoulder girdle', cat: '개념', body: '상지대(어깨띠)는 쇄골과 견갑골로 구성된다. 상지는 흉쇄관절(SC joint)을 통해서만 몸통 골격과 뼈로 연결되며, 견갑골은 흉곽 위를 미끄러지는 견갑흉곽 "기능적 관절"로 움직인다.\n\n해부학적 자세(손바닥 앞)에서 요골은 엄지 쪽(외측), 척골은 새끼손가락 쪽(내측)에 놓인다.' },
  { id: 'c_gh', title: '견갑상완관절의 정렬', en: 'Glenohumeral joint', cat: '개념', body: '견갑상완관절은 볼-소켓형(구관절) 다축관절이다. 큰 상완골두가 얕은 관절와와 만나므로 관절와순·관절낭·회전근개가 안정성을 보완한다.\n\n상완골두: 안쪽·위·뒤를 향함(후방경사).\n팔꿉: 상완골 활차–척골 활차절흔(완척관절), 소두–요골두(완요관절).\n\n어깨 외전 시 견갑상완관절과 견갑흉곽관절은 대략 2:1 비율로 함께 움직인다(견갑상완리듬).' },
  { id: 'c_xray', title: '어깨 AP 영상 판독', en: 'Shoulder AP radiograph', cat: '개념', body: '전후(AP) 영상에서 견봉은 상완골두 위쪽, 오구돌기는 관절와 안쪽 앞에 겹쳐 보인다. 대결절은 상완골두 외측의 돌출부이고, 소결절은 앞쪽에 있어 정면 영상에서 상완골두와 겹쳐 보인다.\n\n회전근개(SITS): 극상근·극하근·소원근 → 대결절 / 견갑하근 → 소결절.' },
  { id: 'log_1', title: '연구일지 #031', en: 'Research log', cat: '기록', body: '피험 유닛 B-계열은 해부학 구조 데이터를 직접 "조립"하며 학습한다. 중앙 AI "MERIDIAN"에게 구조 복원 권한을 위임했다. — 책임연구원 H.' },
  { id: 'log_2', title: 'MERIDIAN 시스템 로그', en: 'AI log', cat: '기록', body: '[03:12:44] 구조 무결성 검사 실패.\n[03:12:45] 골격 데이터 손상률 71%.\n[03:12:45] 프로토콜 LOCKDOWN 실행. 복구 전까지 모든 격벽 봉쇄.\n[03:12:46] 인체 구조 복구가 필요합니다.' },
  { id: 'log_3', title: '피험체 프로토콜', en: 'Unit protocol', cat: '기록', body: '각 실험체는 SCAN 모듈로 숨겨진 구조 데이터를 탐지할 수 있다. 데이터는 실물 표본 형태로 저장되며, 복구 테이블에서 재조립해야 한다.\n\n주의: 오염된 표본(다른 부위의 뼈)이 섞여 있을 수 있음.' },
];
