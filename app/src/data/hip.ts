// CHAPTER 4 — 엉덩이·넙다리 근육실 (HIP & THIGH LAB): gluteal and thigh muscles, compartments, two-joint muscles.
// Art: tools/anatomy3d/ch4_art.py + ch4_section.py (BodyParts3D 4.0, CC BY 4.0) — RIGHT pelvis and lower limb.
// Views (frame units = mm, public/assets/ch4/hip.json): ant (lateral on the viewer's LEFT), post (lateral on the RIGHT),
// lat (anterior on the RIGHT), med (anterior on the LEFT).
import { G } from '../game/state';

export type CoreId = 'gmax' | 'gmed' | 'iliopsoas' | 'rf' | 'sartorius' | 'gracilis' | 'bf' | 'st';
export const CORES: CoreId[] = ['gmax', 'gmed', 'iliopsoas', 'rf', 'sartorius', 'gracilis', 'bf', 'st'];
export const HIP_CREDIT = '3D 해부 모델: BodyParts3D © DBCLS (CC BY 4.0)';

export interface CoreDef { ko: string; en: string; view: 'ant' | 'post'; region: string; origin: string; insertion: string; action: string; nerve: string; note: string; }
export const CORE: Record<CoreId, CoreDef> = {
  gmax: { ko: '큰볼기근', en: 'Gluteus maximus', view: 'post', region: '볼기 (표층)',
    origin: '엉덩뼈 뒷부분 · 엉치뼈·꼬리뼈 뒷면 · 엉치결절인대', insertion: '볼기근거친면 · 엉덩정강띠',
    action: '엉덩관절 폄(앉았다 일어나기·계단 오르기·달리기) · 가쪽돌림', nerve: '아래볼기신경 (L5–S2)',
    note: '몸에서 가장 큰 근육 중 하나. 천천히 걸을 때보다 일어서기·오르기처럼 힘이 필요할 때 크게 쓰인다.' },
  gmed: { ko: '중간볼기근', en: 'Gluteus medius', view: 'post', region: '볼기 (큰볼기근 아래)',
    origin: '엉덩뼈 바깥면 (앞·뒤볼기근선 사이)', insertion: '큰돌기 가쪽면',
    action: '엉덩관절 벌림 · 한 발로 설 때 반대쪽 골반이 처지지 않게 수평 유지', nerve: '위볼기신경 (L4–S1)',
    note: '임상: 마비·약화되면 그쪽 다리로 설 때 반대쪽 골반이 처진다(트렌델렌부르크 징후).' },
  iliopsoas: { ko: '엉덩허리근', en: 'Iliopsoas', view: 'ant', region: '엉덩관절 앞 (깊은 층)',
    origin: '큰허리근: T12–L5 척추뼈몸통·가로돌기 / 엉덩근: 엉덩뼈오목', insertion: '넙다리뼈 작은돌기',
    action: '엉덩관절 굽힘의 주작용근 (다리 들어 올리기, 누운 자세에서 상체 일으키기)', nerve: '큰허리근: 허리신경 앞가지(L1–L3) / 엉덩근: 넙다리신경',
    note: '큰허리근과 엉덩근이 합쳐져 한 힘줄로 작은돌기에 붙는다.' },
  rf: { ko: '넙다리곧은근', en: 'Rectus femoris', view: 'ant', region: '넙다리 앞칸',
    origin: '아래앞엉덩뼈가시 · 절구 위쪽 홈', insertion: '무릎뼈 → 무릎인대 → 정강뼈거친면',
    action: '무릎 폄 + 엉덩관절 굽힘 (두 관절을 지나는 넙다리네갈래근 갈래)', nerve: '넙다리신경 (L2–L4)',
    note: '넙다리네갈래근 4갈래 중 유일하게 엉덩관절도 지난다. 공을 차는 동작에서 함께 쓰인다.' },
  sartorius: { ko: '넙다리빗근', en: 'Sartorius', view: 'ant', region: '넙다리 앞칸 (표층, 비스듬히)',
    origin: '위앞엉덩뼈가시', insertion: '정강뼈 몸쪽 안쪽면 (거위발)',
    action: '엉덩관절 굽힘·벌림·가쪽돌림 + 무릎 굽힘 (책상다리 자세)', nerve: '넙다리신경 (L2–L3)',
    note: '몸에서 가장 긴 근육. 넙다리를 가쪽 위에서 안쪽 아래로 비스듬히 가로지른다.' },
  gracilis: { ko: '두덩정강근', en: 'Gracilis', view: 'ant', region: '넙다리 안쪽칸 (가장 안쪽)',
    origin: '두덩뼈몸통 · 두덩뼈아래가지', insertion: '정강뼈 몸쪽 안쪽면 (거위발)',
    action: '엉덩관절 모음 · 무릎 굽힘·안쪽돌림', nerve: '폐쇄신경 (L2–L3)',
    note: '모음근 무리 중 유일하게 무릎관절도 지난다. 가늘고 길어 다른 부위 재건에 떼어 쓰기도 한다.' },
  bf: { ko: '넙다리두갈래근', en: 'Biceps femoris', view: 'post', region: '넙다리 뒤칸 (가쪽)',
    origin: '긴갈래: 궁둥뼈결절 / 짧은갈래: 넙다리뼈 거친선', insertion: '종아리뼈머리',
    action: '무릎 굽힘 · (굽힌 무릎에서) 가쪽돌림 · 긴갈래: 엉덩관절 폄', nerve: '긴갈래: 정강신경 / 짧은갈래: 온종아리신경 (궁둥신경의 두 가지)',
    note: '임상: 단거리 달리기 중 가장 흔히 다치는 뒤넙다리근은 넙다리두갈래근 긴갈래다.' },
  st: { ko: '반힘줄근', en: 'Semitendinosus', view: 'post', region: '넙다리 뒤칸 (안쪽, 반막근 위)',
    origin: '궁둥뼈결절', insertion: '정강뼈 몸쪽 안쪽면 (거위발)',
    action: '무릎 굽힘·안쪽돌림 · 엉덩관절 폄', nerve: '정강신경 (궁둥신경)',
    note: '아래 절반이 긴 힘줄이라 "반힘줄"근. 반막근 위에 얹혀 있다.' },
};

/** which device releases which pair (every run, both levels) */
export const CORE_DEVICE: Record<CoreId, string> = {
  gmax: 'H-02 볼기 해부대', gmed: 'H-02 볼기 해부대',
  iliopsoas: 'H-04 운동 시험대', rf: 'H-04 운동 시험대',
  sartorius: 'H-05 거위발 고정기', gracilis: 'H-05 거위발 고정기',
  bf: 'H-05 신경 구획 냉장고', st: 'H-05 신경 구획 냉장고',
};
export const PAIRS: [CoreId, CoreId][] = [['gmax', 'gmed'], ['iliopsoas', 'rf'], ['sartorius', 'gracilis'], ['bf', 'st']];

// ---------------- other thigh muscles (specimens, section) ----------------
export type Comp = 'ant' | 'med' | 'post';
export const COMP_KO: Record<Comp, string> = { ant: '앞칸', med: '안쪽칸', post: '뒤칸' };
export const COMP_NERVE: Record<Comp, string> = { ant: '넙다리신경', med: '폐쇄신경', post: '궁둥신경' };
export const COMP_COL: Record<Comp, number> = { ant: 0x4fb8ff, med: 0x7dffa8, post: 0xffb347 };
export interface ThighMuscle { ko: string; en: string; comp: Comp; note?: string }
export const THIGH: Record<string, ThighMuscle> = {
  sartorius: { ko: '넙다리빗근', en: 'Sartorius', comp: 'ant' },
  rf: { ko: '넙다리곧은근', en: 'Rectus femoris', comp: 'ant' },
  vl: { ko: '가쪽넓은근', en: 'Vastus lateralis', comp: 'ant' },
  vm: { ko: '안쪽넓은근', en: 'Vastus medialis', comp: 'ant' },
  vi: { ko: '중간넓은근', en: 'Vastus intermedius', comp: 'ant' },
  al: { ko: '긴모음근', en: 'Adductor longus', comp: 'med' },
  ab: { ko: '짧은모음근', en: 'Adductor brevis', comp: 'med' },
  am: { ko: '큰모음근', en: 'Adductor magnus', comp: 'med', note: '모음근 부분은 폐쇄신경, 뒤쪽 "뒤넙다리근 부분"은 궁둥신경(정강신경 쪽)이 지배한다.' },
  gracilis: { ko: '두덩정강근', en: 'Gracilis', comp: 'med' },
  bfl: { ko: '넙다리두갈래근 긴갈래', en: 'Biceps femoris, long head', comp: 'post' },
  bfs: { ko: '넙다리두갈래근 짧은갈래', en: 'Biceps femoris, short head', comp: 'post', note: '궁둥신경의 온종아리신경 쪽 가지가 지배한다.' },
  st: { ko: '반힘줄근', en: 'Semitendinosus', comp: 'post' },
  sm: { ko: '반막근', en: 'Semimembranosus', comp: 'post' },
};

/** LOCK 1 muscle scanner: names of the muscles on the front / back plates */
const SCAN_KO: Record<string, string> = { tfl: '넙다리근막긴장근', pectineus: '두덩근', psoas: '큰허리근', iliacus: '엉덩근', gmax: '큰볼기근', gmed: '중간볼기근', itt: '엉덩정강띠' };
export const SCAN_EN: Record<string, string> = { tfl: 'Tensor fasciae latae', pectineus: 'Pectineus', psoas: 'Psoas major', iliacus: 'Iliacus', gmax: 'Gluteus maximus', gmed: 'Gluteus medius', itt: 'Iliotibial tract' };
for (const [k, v] of Object.entries(THIGH)) SCAN_EN[k] ??= v.en;
export const scanName = (id: string) => THIGH[id]?.ko ?? SCAN_KO[id] ?? id;
export const SCAN_COMP: Record<string, Comp | undefined> = Object.fromEntries(Object.entries(THIGH).map(([k, v]) => [k, v.comp]));
export interface ScanQ { id: string; view: 'ant' | 'post'; hint: string; cands: string[]; case?: string }
/** basic: 5 questions, each with 3 glowing candidates; adv: 8 without candidates, the last is a case */
export function scanQuestions(): ScanQ[] {
  const sh = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  if (G.run.difficulty !== 'adv') return [
    { id: 'sartorius', view: 'ant', hint: '위앞엉덩뼈가시에서 안쪽 아래로 비스듬히 가로지르는 가장 긴 띠 모양 근육', cands: sh(['sartorius', 'rf', 'vm']) },
    { id: 'rf', view: 'ant', hint: '넙다리 앞 한가운데를 곧게 내려가 무릎뼈로 가는 근육', cands: sh(['rf', 'vl', 'sartorius']) },
    { id: 'al', view: 'ant', hint: '두덩뼈에서 넙다리 안쪽 위로 퍼지는 삼각형 모음근', cands: sh(['al', 'gracilis', 'pectineus']) },
    { id: 'gmax', view: 'post', hint: '볼기 전체를 덮는 가장 크고 두꺼운 근육', cands: sh(['gmax', 'gmed', 'itt']) },
    { id: 'bfl', view: 'post', hint: '넙다리 뒤쪽 가쪽(그림의 오른쪽)으로 내려가는 뒤넙다리근', cands: sh(['bfl', 'st', 'sm']) },
  ];
  return [
    { id: 'rf', view: 'ant', hint: '', cands: [] }, { id: 'vl', view: 'ant', hint: '', cands: [] }, { id: 'gracilis', view: 'ant', hint: '', cands: [] },
    { id: 'tfl', view: 'ant', hint: '', cands: [] }, { id: 'st', view: 'post', hint: '', cands: [] }, { id: 'sm', view: 'post', hint: '', cands: [] },
    { id: 'bfl', view: 'post', hint: '', cands: [] },
    { id: 'gmed', view: 'post', hint: '', cands: [], case: '증례: 오른다리로 한 발 서기를 하면 왼쪽 골반이 처진다(트렌델렌부르크 징후). 약해진 근육은?' },
  ];
}

/** D4 fridge specimens (spec_<id> images) */
export function fridgeSpecimens(): string[] {
  return G.run.difficulty === 'adv' ? ['rf', 'vl', 'vm', 'sartorius', 'al', 'ab', 'gracilis', 'bfl', 'bfs', 'st', 'sm'] : ['rf', 'vl', 'sartorius', 'al', 'gracilis', 'bfl', 'st', 'sm'];
}

// ---------------- rig: muscle actions (textbook; cable lengths in the model agree, tools/anatomy3d/ch4_art.py) ----------------
/** degrees: hip + = flexion, knee + = flexion (relative to the start pose), abd + = abduction */
export interface RigAction { hip?: number; knee?: number; abd?: number; text: string }
export const RIG_KNEE0 = 60;   // the rig starts with the knee bent 60° (leg hanging in the test frame)
export const RIG_ACT: Record<string, RigAction> = {
  iliopsoas: { hip: 35, text: '엉덩관절 앞(두덩뼈 위)을 지나 작은돌기에 붙는다 → 엉덩관절만 굽힌다. 무릎은 지나지 않는다.' },
  rf: { hip: 25, knee: -RIG_KNEE0, text: '엉덩관절 앞과 무릎 앞을 모두 지난다 → 엉덩관절 굽힘 + 무릎 폄을 함께 만든다(두관절근).' },
  gmax: { hip: -15, text: '엉덩관절 뒤를 지난다 → 엉덩관절 폄. 무릎에는 직접 작용하지 않는다.' },
  bf: { hip: -10, knee: 30, text: '궁둥뼈결절에서 엉덩관절 뒤, 무릎 뒤를 지난다 → 엉덩관절 폄 + 무릎 굽힘.' },
  st: { hip: -10, knee: 30, text: '궁둥뼈결절에서 엉덩관절 뒤, 무릎 뒤를 지난다 → 엉덩관절 폄 + 무릎 굽힘.' },
  vl: { knee: -RIG_KNEE0, text: '넙다리뼈에서 시작해 무릎 앞만 지난다 → 무릎 폄. 엉덩관절은 지나지 않는다.' },
  gmed: { abd: 20, text: '엉덩뼈 바깥면에서 큰돌기로, 엉덩관절 위·가쪽을 지난다 → 벌림.' },
  al: { abd: -12, text: '두덩뼈에서 넙다리뼈 거친선으로, 엉덩관절 안쪽을 지난다 → 모음.' },
  gracilis: { abd: -12, text: '두덩뼈에서 정강뼈 안쪽으로, 엉덩관절 안쪽을 지난다 → 모음 (+ 무릎 굽힘).' },
};
export const RIG_KO: Record<string, string> = { iliopsoas: '엉덩허리근', rf: '넙다리곧은근', gmax: '큰볼기근', bf: '넙다리두갈래근', st: '반힘줄근', vl: '가쪽넓은근', gmed: '중간볼기근', al: '긴모음근', gracilis: '두덩정강근' };

// ---------------- LOCK 3: motion rounds ----------------
export type Role4 = 'agonist' | 'antagonist' | 'none';
export interface GaitRound { id: string; ko: string; scene: string; plane: 'lat' | 'ant'; start: { hip: number; knee: number }; motion: RigAction; cards: string[]; adv: string[]; roles: Record<string, Role4>; why: Record<string, string> }
export const GAIT: GaitRound[] = [
  {
    id: 'kneeExt', ko: '무릎 폄', scene: '공 차기 — 굽혀 있던 무릎을 앞으로 편다', plane: 'lat', start: { hip: 0, knee: RIG_KNEE0 }, motion: { knee: -RIG_KNEE0, text: '' },
    cards: ['rf', 'bf', 'st', 'gmed'], adv: ['vl'],
    roles: { rf: 'agonist', vl: 'agonist', bf: 'antagonist', st: 'antagonist', gmed: 'none' },
    why: {
      rf: '넙다리곧은근은 무릎뼈를 거쳐 정강뼈거친면에 붙어 무릎 앞을 지난다 → 무릎 폄의 주작용근.',
      vl: '가쪽넓은근도 넙다리네갈래근의 한 갈래다. 무릎 앞을 지나 무릎을 편다 → 주작용근.',
      bf: '넙다리두갈래근은 무릎 뒤를 지나 무릎을 굽힌다. 무릎을 펼 때는 늘어나는 대항근.',
      st: '반힘줄근은 무릎 뒤를 지나 무릎을 굽힌다. 무릎을 펼 때는 늘어나는 대항근.',
      gmed: '중간볼기근은 엉덩관절만 지난다. 무릎 운동에는 관여하지 않는다.',
    },
  },
  {
    id: 'hipExt', ko: '엉덩관절 폄', scene: '의자에서 일어서기 — 굽혀 있던 엉덩관절을 편다', plane: 'lat', start: { hip: 45, knee: RIG_KNEE0 }, motion: { hip: -45, text: '' },
    cards: ['gmax', 'bf', 'iliopsoas', 'rf'], adv: ['st', 'vl'],
    roles: { gmax: 'agonist', bf: 'agonist', st: 'agonist', iliopsoas: 'antagonist', rf: 'antagonist', vl: 'none' },
    why: {
      gmax: '큰볼기근은 엉덩관절 뒤를 지나 볼기근거친면에 붙는다 → 엉덩관절 폄의 주작용근.',
      bf: '넙다리두갈래근 긴갈래는 궁둥뼈결절에서 엉덩관절 뒤를 지난다 → 엉덩관절 폄을 돕는다(주작용근 무리).',
      st: '반힘줄근도 궁둥뼈결절에서 엉덩관절 뒤를 지난다 → 엉덩관절 폄(주작용근 무리).',
      iliopsoas: '엉덩허리근은 엉덩관절 앞을 지나는 가장 강한 굽힘근이다. 폄에서는 늘어나는 대항근.',
      rf: '넙다리곧은근은 엉덩관절 앞을 지나 엉덩관절을 굽힌다. 폄에서는 대항근.',
      vl: '가쪽넓은근은 넙다리뼈에서 시작해 무릎만 지난다. 엉덩관절 운동에는 관여하지 않는다.',
    },
  },
  {
    id: 'hipAbd', ko: '엉덩관절 벌림', scene: '한 발 서기·옆으로 다리 들기 — 다리를 몸 바깥으로 벌린다', plane: 'ant', start: { hip: 0, knee: 0 }, motion: { abd: 20, text: '' },
    cards: ['gmed', 'al', 'vl'], adv: ['gracilis'],
    roles: { gmed: 'agonist', al: 'antagonist', gracilis: 'antagonist', vl: 'none' },
    why: {
      gmed: '중간볼기근은 엉덩뼈 바깥면에서 큰돌기로 엉덩관절 위·가쪽을 지난다 → 벌림의 주작용근.',
      al: '긴모음근은 두덩뼈에서 넙다리뼈 거친선으로 엉덩관절 안쪽을 지난다 → 모음근, 벌림의 대항근.',
      gracilis: '두덩정강근은 엉덩관절 안쪽을 지나는 모음근 → 벌림의 대항근.',
      vl: '가쪽넓은근은 엉덩관절을 지나지 않는다 → 관여하지 않음.',
    },
  },
];
export function gaitCards(r: GaitRound) { return G.run.difficulty === 'adv' ? [...r.cards, ...r.adv] : r.cards; }

// ---------------- manifest ----------------
export type Pt = [number, number];
export interface HipRect { view: string; x: number; y: number; w: number; h: number; density: number }
export interface HipManifest {
  views: Record<string, { K: number; W: number; H: number }>;
  rects: Record<string, HipRect>; regions: Record<string, HipRect>;
  points: Record<string, Record<string, Pt>>;
  rig: Record<string, Record<string, [string, number, number][]>>;
}
export interface ScanManifest { density: number; views: Record<'ant' | 'post', { w: number; h: number; names: string[]; grid: { w: number; h: number; step: number; rle: [number, number][] }; muscles: Record<string, { x: number; y: number; area: number; rect: { x: number; y: number; w: number; h: number } }> }> }
export interface SectionManifest { z: number; pxPerMm: number; w: number; h: number; names: string[]; grid: { w: number; h: number; step: number; rle: [number, number][] }; centre: Record<string, { x: number; y: number; area: number }> }

export function hipClue(id: string): string | null {
  const a = G.run.difficulty === 'adv';
  switch (id) {
    case 'k_rehab': return a ? '🩺 재활 기록지: "오른쪽 볼기 근육 손상. H-02 해부대 — 겉층 근육의 닿는곳을 먼저 확인하고, 걷어 낸 뒤 그 아래 근육의 닿는곳을 누른다."'
      : '🩺 재활 기록지: "오른다리로 서면 왼쪽 골반이 처진다(트렌델렌부르크 징후) → 오른쪽 중간볼기근 약화. 중간볼기근은 큰볼기근 아래(깊은 층)에 있고 큰돌기에 닿는다. H-02 해부대: 큰볼기근을 걷어 내고 중간볼기근의 닿는곳을 누를 것."';
    case 'k_rx': return a ? '📋 운동 처방전: "H-04 시험대 1단계 = 가장 강한 엉덩관절 굽힘근, 2단계 = 엉덩관절 굽힘과 무릎 폄을 함께 하는 근육."'
      : '📋 운동 처방전: "H-04 시험대 — 1단계: 무릎은 그대로 두고 엉덩관절만 굽히는 근육(엉덩허리근). 2단계: 엉덩관절을 굽히면서 무릎을 펴는 두관절근(넙다리곧은근)."';
    case 'k_knee': return a ? '📝 무릎 수술 기록: "거위발 재고정 — 앞에서 뒤로 S·G·T 순서. 거위발에 속하지 않는 힘줄은 고정기에 걸지 말 것."'
      : '📝 무릎 수술 기록: "거위발(정강뼈 몸쪽 안쪽면)에 세 힘줄이 앞에서 뒤로 붙는다: Sartorius 넙다리빗근 → Gracilis 두덩정강근 → semiTendinosus 반힘줄근 (S·G·T, \'Say Grace before Tea\'). H-05 고정기에 이 순서로 걸 것."';
    case 'k_chart': return a ? '🧭 신경 지배 차트: "넙다리의 세 칸 = 세 신경. H-05 냉장고는 칸마다 그 신경이 지배하는 근육만 받는다."'
      : '🧭 신경 지배 차트: "넙다리는 세 칸. 앞칸(넙다리네갈래근·넙다리빗근) = 넙다리신경 / 안쪽칸(모음근·두덩정강근) = 폐쇄신경 / 뒤칸(뒤넙다리근: 넙다리두갈래근·반힘줄근·반막근) = 궁둥신경."';
  }
  return null;
}
