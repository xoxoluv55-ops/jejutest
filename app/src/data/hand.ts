// CHAPTER 3 — 손목·관절실 (WRIST & JOINT LAB): carpal bones, hand skeleton, synovial joint types.
// Art: tools/anatomy3d/ch3_hand.py (BodyParts3D 4.0, CC BY 4.0) — palmar view of the RIGHT hand, fingers up,
// thumb (lateral) on the viewer's RIGHT. Frame units (4 per mm) = public/assets/ch3/hand.json.
import { G } from '../game/state';

export type CarpalId = 'scaphoid' | 'lunate' | 'triquetrum' | 'pisiform' | 'trapezium' | 'trapezoid' | 'capitate' | 'hamate';
/** lateral (thumb side) -> medial, proximal row then distal row */
export const CARPALS: CarpalId[] = ['scaphoid', 'lunate', 'triquetrum', 'pisiform', 'trapezium', 'trapezoid', 'capitate', 'hamate'];
export const PROXIMAL: CarpalId[] = ['scaphoid', 'lunate', 'triquetrum', 'pisiform'];
export const DISTAL: CarpalId[] = ['trapezium', 'trapezoid', 'capitate', 'hamate'];

export interface CarpalDef { ko: string; en: string; row: '몸쪽 줄' | '먼쪽 줄'; shape: string; info: string; }
export const CARPAL: Record<CarpalId, CarpalDef> = {
  scaphoid: { ko: '손배뼈', en: 'Scaphoid', row: '몸쪽 줄', shape: '배 모양, 엄지 쪽에서 가장 큰 몸쪽 줄 뼈',
    info: '몸쪽 줄 가쪽(엄지 쪽). 노뼈와 손목관절을 이루는 주된 뼈다.\n임상: 손을 짚고 넘어질 때 가장 흔히 골절되는 손목뼈. 해부학코담배갑(엄지 뿌리 손등 쪽 오목)을 누를 때 아프면 의심한다. 혈액이 먼쪽에서 들어오므로 허리 골절 뒤 몸쪽 조각이 괴사하기 쉽다.' },
  lunate: { ko: '반달뼈', en: 'Lunate', row: '몸쪽 줄', shape: '반달 모양',
    info: '몸쪽 줄 가운데. 노뼈와 관절하며, 아래(먼쪽)로 알머리뼈를 받친다.\n임상: 가장 흔히 탈구되는 손목뼈. 앞쪽으로 빠지면 손목굴의 정중신경을 누를 수 있다.' },
  triquetrum: { ko: '세모뼈', en: 'Triquetrum', row: '몸쪽 줄', shape: '피라미드 모양',
    info: '몸쪽 줄 안쪽(새끼 쪽). 손바닥 면에 콩알뼈가 얹힌다. 자뼈와는 직접 닿지 않고 관절원판(삼각섬유연골)을 사이에 둔다.' },
  pisiform: { ko: '콩알뼈', en: 'Pisiform', row: '몸쪽 줄', shape: '완두콩 모양, 가장 작은 손목뼈',
    info: '세모뼈의 손바닥 면에 얹힌 종자뼈(자쪽손목굽힘근 힘줄 속). 손바닥 아래 안쪽에서 만져진다.\n굽힘근지지띠의 안쪽 부착부 중 하나.' },
  trapezium: { ko: '큰마름뼈', en: 'Trapezium', row: '먼쪽 줄', shape: '안장 모양 관절면',
    info: '먼쪽 줄 가쪽. 첫째 손허리뼈와 안장관절(엄지 손목손허리관절)을 이루어 엄지의 맞섬을 가능하게 한다.\n결절은 굽힘근지지띠의 가쪽 부착부.' },
  trapezoid: { ko: '작은마름뼈', en: 'Trapezoid', row: '먼쪽 줄', shape: '쐐기 모양, 작다',
    info: '먼쪽 줄에서 큰마름뼈와 알머리뼈 사이. 둘째 손허리뼈(검지)의 바닥을 받친다.' },
  capitate: { ko: '알머리뼈', en: 'Capitate', row: '먼쪽 줄', shape: '가장 큰 손목뼈, 둥근 머리',
    info: '손목 한가운데의 가장 큰 손목뼈. 셋째 손허리뼈(가운데손가락)와 관절하고, 머리는 반달뼈·손배뼈의 오목에 들어간다(손목중간관절).' },
  hamate: { ko: '갈고리뼈', en: 'Hamate', row: '먼쪽 줄', shape: '손바닥 쪽으로 갈고리가 튀어나옴',
    info: '먼쪽 줄 안쪽. 넷째·다섯째 손허리뼈와 관절한다. 갈고리(hook)는 굽힘근지지띠의 안쪽 부착부이자 자신경관(Guyon관)의 가쪽 벽.' },
};

/** which device releases which carpal pair (every run, both levels) */
export const CARPAL_DEVICE: Record<CarpalId, string> = {
  scaphoid: 'J-02 관절면 금고', lunate: 'J-02 관절면 금고',
  pisiform: 'J-01 손목굴 고정기', hamate: 'J-01 손목굴 고정기',
  trapezium: 'J-04 손가락 축 정렬기', trapezoid: 'J-04 손가락 축 정렬기',
  triquetrum: 'J-02 순서 원판', capitate: 'J-02 순서 원판',
};

// ---------------- joints (LOCK 3) ----------------
export type JointType = 'ball' | 'hinge' | 'pivot' | 'ellipsoid' | 'saddle' | 'plane';
export const JTYPE_KO: Record<JointType, string> = { ball: '절구관절', hinge: '경첩관절', pivot: '중쇠관절', ellipsoid: '타원관절', saddle: '안장관절', plane: '평면관절' };
export const JTYPE_EN: Record<JointType, string> = { ball: 'Ball-and-socket', hinge: 'Hinge', pivot: 'Pivot', ellipsoid: 'Ellipsoid (condyloid)', saddle: 'Saddle', plane: 'Plane' };
export const JTYPE_AXES: Record<JointType, string> = {
  ball: '3축 — 굽힘·폄, 벌림·모음, 안쪽·가쪽돌림 (+휘돌림)',
  hinge: '1축 — 굽힘·폄만',
  pivot: '1축 — 세로축 둘레 돌림만',
  ellipsoid: '2축 — 굽힘·폄, 벌림·모음 (돌림은 안 됨)',
  saddle: '2축 — 굽힘·폄, 벌림·모음 (+둘을 합친 맞섬)',
  plane: '축 없음 — 평평한 면끼리 조금씩 미끄러짐',
};
export const JTYPE_SHAPE: Record<JointType, string> = {
  ball: '공 모양 머리 + 오목한 소켓', hinge: '도르래 + 홈', pivot: '원통 + 고리', ellipsoid: '달걀 모양 볼록면 + 오목면', saddle: '두 안장이 직각으로 맞물림', plane: '거의 평평한 두 면',
};
export interface JointDef { id: string; ko: string; en: string; type: JointType; where: 'arm' | 'hand'; note: string; adv?: boolean; }
export const JOINTS: JointDef[] = [
  { id: 'shoulder', ko: '어깨관절 (오목위팔관절)', en: 'Glenohumeral', type: 'ball', where: 'arm', note: '위팔뼈머리(공)가 어깨뼈 관절오목(소켓)에 들어간다. 몸에서 가장 운동 범위가 넓은 관절.' },
  { id: 'elbow', ko: '위팔자관절 (팔꿈치)', en: 'Humero-ulnar', type: 'hinge', where: 'arm', note: '위팔뼈 도르래가 자뼈 도르래패임에 끼워져 굽힘·폄만 한다.' },
  { id: 'pruj', ko: '몸쪽 노자관절', en: 'Proximal radio-ulnar', type: 'pivot', where: 'arm', note: '노뼈머리가 자뼈의 노패임과 고리인대 안에서 돈다 → 엎침·뒤침.' },
  { id: 'wrist', ko: '노손목관절 (손목관절)', en: 'Radiocarpal', type: 'ellipsoid', where: 'hand', note: '노뼈 아래 오목면 + 손배뼈·반달뼈(·세모뼈)의 볼록면. 굽힘·폄과 노쪽·자쪽 치우침.' },
  { id: 'cmc1', ko: '엄지 손목손허리관절', en: 'Thumb CMC', type: 'saddle', where: 'hand', note: '큰마름뼈와 첫째 손허리뼈의 안장 모양 면이 맞물린다 → 맞섬(엄지를 다른 손가락에 대기).' },
  { id: 'intercarpal', ko: '손목뼈사이관절', en: 'Intercarpal', type: 'plane', where: 'hand', note: '이웃한 손목뼈끼리 평평한 면으로 조금씩 미끄러진다.' },
  { id: 'mcp', ko: '손허리손가락관절 (검지)', en: 'MCP (index)', type: 'ellipsoid', where: 'hand', adv: true, note: '손허리뼈 머리(볼록) + 첫마디뼈 바닥(오목). 굽힘·폄 + 벌림·모음.' },
  { id: 'pip', ko: '몸쪽 손가락뼈사이관절 (검지)', en: 'PIP (index)', type: 'hinge', where: 'hand', adv: true, note: '손가락뼈 사이 관절은 경첩관절: 굽힘·폄만 한다.' },
];
export function neededJoints() { return JOINTS.filter(j => !j.adv || G.run.difficulty === 'adv'); }

/** LOCK 1 X-ray targets */
export function xrayTargets(): CarpalId[] {
  return G.run.difficulty === 'adv' ? ['hamate', 'lunate', 'trapezoid', 'pisiform', 'capitate', 'triquetrum', 'trapezium', 'scaphoid'] : ['scaphoid', 'capitate', 'hamate', 'lunate', 'pisiform'];
}

// ---------------- art manifest ----------------
export interface HandRect { x: number; y: number; w: number; h: number }
export interface HandManifest {
  frame: [number, number]; unitsPerMm: number;
  rects: Record<string, HandRect>; mask: Record<string, [number, number][]>; points: Record<string, [number, number] | null>;
  wrist: HandRect & { density: number };
}
export const HAND_CREDIT = '3D 해부 모델: BodyParts3D © DBCLS (CC BY 4.0)';

// ---------------- escape-room clues (notebook text) ----------------
export function handClue(id: string): string | null {
  const a = G.run.difficulty === 'adv';
  switch (id) {
    case 'h_journal': return a ? '📖 관절 정비 일지: "J-02 관절면 금고 — 노뼈의 손목 관절면에 실제로 맞닿는 손목뼈 두 개를 올려라. 옛 이름에 속지 말 것."'
      : '📖 관절 정비 일지: "J-02 관절면 금고 — 노뼈 아래 관절면에 맞닿는 손목뼈 두 개를 올리면 열린다: 손배뼈(엄지 쪽, 배 모양)와 반달뼈(가운데, 반달 모양). 자뼈 쪽은 관절원판이 막고 있어 뼈가 직접 닿지 않는다."';
    case 'h_surgery': return a ? '🩺 수술 기록지(손목굴 감압술): "굽힘근지지띠를 네 기둥에 다시 고정할 것 — 안쪽 둘, 가쪽 둘."'
      : '🩺 수술 기록지(손목굴 감압술): "굽힘근지지띠 안쪽 끝은 콩알뼈와 갈고리뼈의 갈고리에, 가쪽 끝은 손배뼈결절과 큰마름뼈결절에 붙는다. 고정기는 안쪽 두 기둥만 맞추면 열린다."';
    case 'h_manual': return a ? '🔧 손가락 축 정렬기 매뉴얼: "다섯 손허리뼈의 바닥을 각자 관절하는 손목뼈 위에 꽂을 것."'
      : '🔧 손가락 축 정렬기 매뉴얼: "손허리뼈 바닥을 맞는 손목뼈에 꽂는다. 엄지(1) → 큰마름뼈(안장관절), 검지(2) → 작은마름뼈, 가운데(3) → 알머리뼈. (넷째·다섯째는 갈고리뼈 — 심화 점검 때만)"';
    case 'h_poster': return a ? '🖼 손목뼈 배열 포스터: "몸쪽 줄과 먼쪽 줄, 각각 엄지 쪽부터 네 개."'
      : '🖼 손목뼈 배열 포스터 — 엄지 쪽(가쪽)부터:\n    몸쪽 줄: 손배뼈 → 반달뼈 → 세모뼈 → 콩알뼈\n    먼쪽 줄: 큰마름뼈 → 작은마름뼈 → 알머리뼈 → 갈고리뼈\n    (외우기: "배·달·세·콩 / 큰·작·알·갈")';
  }
  return null;
}
