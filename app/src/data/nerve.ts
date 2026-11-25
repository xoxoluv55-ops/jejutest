// CHAPTER 5 — 신경 배선실 (NERVE WIRING LAB): peripheral nerves of the upper and lower limb.
// Art: tools/anatomy3d/ch5_art.py — Z-Anatomy models (CC BY-SA 4.0, derived from BodyParts3D © DBCLS), RIGHT limbs.
// Views (frame units = mm, public/assets/ch5/nerve.json): aant / apost = upper limb + brachial plexus from the front / back,
// lant / lpost = lower limb from the front / back. Front views: the limb's lateral side is on the viewer's LEFT.
import { G } from '../game/state';

export type NerveId = 'musculocutaneous' | 'axillary' | 'radial' | 'median' | 'ulnar' | 'femoral' | 'sciatic' | 'fibular';
export const CORES: NerveId[] = ['musculocutaneous', 'femoral', 'axillary', 'radial', 'median', 'ulnar', 'sciatic', 'fibular'];
export const NERVE_CREDIT = '3D 신경 모델: Z-Anatomy (CC BY-SA 4.0) · BodyParts3D © DBCLS 기반';
export type View5 = 'aant' | 'apost' | 'lant' | 'lpost';

export interface NerveDef { ko: string; en: string; view: View5; roots: string; from: string; course: string; motor: string; sensory: string; injury: string }
export const NERVE: Record<NerveId, NerveDef> = {
  musculocutaneous: { ko: '근육피부신경', en: 'Musculocutaneous n.', view: 'aant', roots: 'C5–C7', from: '팔신경얼기 가쪽다발',
    course: '부리위팔근을 뚫고 위팔두갈래근과 위팔근 사이로 내려가, 팔꿈치 가쪽에서 피부로 나온다(가쪽아래팔피부신경).',
    motor: '위팔 앞칸: 부리위팔근 · 위팔두갈래근 · 위팔근 (팔꿈치 굽힘)', sensory: '아래팔 가쪽 피부',
    injury: '팔꿈치 굽힘·뒤침 약화, 아래팔 가쪽 감각 저하. 위팔두갈래근 반사(C5–C6)가 약해진다.' },
  axillary: { ko: '겨드랑신경', en: 'Axillary n.', view: 'apost', roots: 'C5–C6', from: '팔신경얼기 뒤다발',
    course: '네모공간을 지나 위팔뼈 수술목을 뒤에서 감아 돈다.',
    motor: '어깨세모근 · 작은원근', sensory: '어깨 가쪽 아래 피부 ("견장" 부위)',
    injury: '위팔뼈 수술목 골절·어깨 탈구 → 어깨 벌림 약화(어깨세모근), 어깨 가쪽 감각 소실.' },
  radial: { ko: '노신경', en: 'Radial n.', view: 'apost', roots: 'C5–T1', from: '팔신경얼기 뒤다발',
    course: '위팔뼈 몸통 뒤의 노신경고랑을 나선형으로 돌아 팔꿈치 가쪽 앞으로 나온 뒤 얕은가지·깊은가지로 나뉜다.',
    motor: '위팔세갈래근 · 위팔노근 · 손목·손가락 폄근 (뒤칸)', sensory: '손등 노쪽(엄지 쪽) 피부',
    injury: '위팔뼈 몸통 중간 골절 → 손목 처짐(wrist drop): 손목과 손가락을 펴지 못한다.' },
  median: { ko: '정중신경', en: 'Median n.', view: 'aant', roots: 'C5–T1', from: '가쪽다발 + 안쪽다발 (두 뿌리)',
    course: '위팔 안쪽을 위팔동맥과 함께 내려가 아래팔 한가운데를 지나, 손목굴(굽힘근지지띠 아래)로 손바닥에 들어간다.',
    motor: '아래팔 굽힘근 대부분 · 엄지두덩근(맞섬) · 1·2 벌레근', sensory: '손바닥 쪽 엄지 ~ 넷째손가락 노쪽 절반',
    injury: '손목굴 증후군 → 엄지~넷째손가락 반쪽 저림, 엄지두덩 위축(맞섬 약화).' },
  ulnar: { ko: '자신경', en: 'Ulnar n.', view: 'aant', roots: 'C8–T1', from: '팔신경얼기 안쪽다발',
    course: '위팔 안쪽으로 내려가 안쪽위관절융기 뒤(팔꿈치 "찌릿한 곳")를 지나 아래팔 자쪽으로 손에 들어간다.',
    motor: '자쪽손목굽힘근 · 깊은손가락굽힘근 자쪽 절반 · 손의 작은 근육 대부분(뼈사이근 등)', sensory: '새끼손가락 · 넷째손가락 자쪽 절반',
    injury: '안쪽위관절융기 부근 손상 → 갈퀴손(넷째·새끼손가락), 새끼손가락 쪽 저림, 손가락 벌림·모음 약화.' },
  femoral: { ko: '넙다리신경', en: 'Femoral n.', view: 'lant', roots: 'L2–L4', from: '허리신경얼기',
    course: '큰허리근 가쪽을 따라 내려와 샅고랑인대 아래(넙다리동맥 가쪽)로 넙다리 앞에 나온다. 피부가지 두렁신경은 다리 안쪽까지 간다.',
    motor: '넙다리네갈래근 · 넙다리빗근 · 엉덩근 · 두덩근 (무릎 폄)', sensory: '넙다리 앞 · 종아리 안쪽(두렁신경)',
    injury: '무릎 폄 약화, 무릎반사(L2–L4) 소실, 넙다리 앞 감각 저하.' },
  sciatic: { ko: '궁둥신경', en: 'Sciatic n.', view: 'lpost', roots: 'L4–S3', from: '엉치신경얼기',
    course: '큰궁둥구멍(궁둥구멍근 아래)으로 골반을 나와 넙다리 뒤를 내려가고, 무릎 위에서 정강신경과 온종아리신경으로 갈라진다.',
    motor: '뒤넙다리근(넙다리두갈래근·반힘줄근·반막근) · 큰모음근 일부 + 두 가지로 무릎 아래 모든 근육', sensory: '두 가지를 통해 종아리·발 대부분',
    injury: '볼기 주사·고관절 탈구 손상 → 무릎 굽힘 약화와 무릎 아래 전체 마비.' },
  fibular: { ko: '온종아리신경', en: 'Common fibular n.', view: 'lpost', roots: 'L4–S2', from: '궁둥신경 (가쪽 가지)',
    course: '오금 가쪽으로 나와 종아리뼈 목을 바깥에서 감아 돈 뒤 얕은·깊은종아리신경으로 나뉜다. 피부 바로 아래라 다치기 쉽다.',
    motor: '종아리 앞칸(발등굽힘)·가쪽칸(가쪽번짐) 근육', sensory: '종아리 가쪽 · 발등',
    injury: '종아리뼈 목 골절·깁스 압박·다리 꼬기 → 발처짐(foot drop): 발을 들지 못해 발끝이 끌린다.' },
};

/** which device releases which pair */
export const CORE_DEVICE: Record<NerveId, string> = {
  musculocutaneous: 'N-02 반사 검사대', femoral: 'N-02 반사 검사대',
  axillary: 'N-04 골절 판독기', radial: 'N-04 골절 판독기',
  median: 'N-05 감각 지도 패널', ulnar: 'N-05 감각 지도 패널',
  sciatic: 'N-05 다리 배선 추적기', fibular: 'N-05 다리 배선 추적기',
};
export const PAIRS: [NerveId, NerveId][] = [['musculocutaneous', 'femoral'], ['axillary', 'radial'], ['median', 'ulnar'], ['sciatic', 'fibular']];

// ---------------- LOCK 1 scanner ----------------
export const SCAN_KO: Record<string, string> = { plexus: '팔신경얼기', obturator: '폐쇄신경', tibial: '정강신경' };
export const SCAN_EN: Record<string, string> = { plexus: 'Brachial plexus', obturator: 'Obturator n.', tibial: 'Tibial n.' };
for (const [k, v] of Object.entries(NERVE)) SCAN_EN[k] = v.en;
export const nerveName = (id: string) => (NERVE as Record<string, NerveDef>)[id]?.ko ?? SCAN_KO[id] ?? id;
export const SCAN_NOTE: Record<string, string> = {
  plexus: 'C5–T1 뿌리 → 줄기 → 갈래 → 다발 → 가지. 빗장뼈 아래를 지나 겨드랑이로 간다.',
  obturator: 'L2–L4. 폐쇄구멍을 지나 넙다리 안쪽칸(모음근)을 지배한다.',
  tibial: '궁둥신경의 안쪽 가지. 오금 한가운데를 지나 종아리 뒤칸과 발바닥을 지배한다.',
};
export interface ScanQ5 { id: string; view: 'aant' | 'lant' | 'lpost'; hint: string; cands: string[]; case?: string }
export function scanQuestions5(): ScanQ5[] {
  const sh = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  if (G.run.difficulty !== 'adv') return [
    { id: 'median', view: 'aant', hint: '위팔 안쪽을 내려와 아래팔 한가운데를 지나 손바닥(엄지 쪽 손가락들)으로 가는 신경', cands: sh(['median', 'ulnar', 'radial']) },
    { id: 'ulnar', view: 'aant', hint: '팔꿈치 안쪽(안쪽위관절융기 뒤)을 지나 새끼손가락 쪽으로 가는 신경', cands: sh(['ulnar', 'median', 'musculocutaneous']) },
    { id: 'musculocutaneous', view: 'aant', hint: '위팔 앞쪽 근육들 사이를 비스듬히 내려와 팔꿈치 가쪽에서 끝나는 짧은 신경', cands: sh(['musculocutaneous', 'median', 'radial']) },
    { id: 'femoral', view: 'lant', hint: '골반 앞(샅고랑인대 아래)에서 나와 넙다리 앞쪽으로 부채처럼 퍼지는 신경', cands: sh(['femoral', 'obturator', 'fibular']) },
    { id: 'sciatic', view: 'lpost', hint: '볼기에서 넙다리 뒤 한가운데를 내려가는 몸에서 가장 굵은 신경', cands: sh(['sciatic', 'tibial', 'fibular']) },
  ];
  return [
    { id: 'median', view: 'aant', hint: '', cands: [] }, { id: 'radial', view: 'aant', hint: '', cands: [] }, { id: 'plexus', view: 'aant', hint: '', cands: [] },
    { id: 'femoral', view: 'lant', hint: '', cands: [] }, { id: 'obturator', view: 'lant', hint: '', cands: [] },
    { id: 'tibial', view: 'lpost', hint: '', cands: [] }, { id: 'fibular', view: 'lpost', hint: '', cands: [] },
    { id: 'ulnar', view: 'aant', hint: '', cands: [], case: '증례: 팔꿈치 안쪽을 책상에 부딪친 뒤 새끼손가락과 넷째손가락 반쪽이 저리다. 다친 신경은?' },
  ];
}

// ---------------- LOCK 3 lesion clinic ----------------
export interface Case5 { id: string; title: string; story: string; nerve: NerveId; opts: NerveId[]; site?: { view: View5; key: string; region: string; decoys: string[] }; why: string }
export const SITE_KO: Record<string, string> = {
  axNeck: '위팔뼈 수술목', radGroove: '위팔뼈 몸통 중간(노신경고랑)', ulnEpi: '안쪽위관절융기 뒤', carpal: '손목굴', fibNeck: '종아리뼈 목',
  sciSplit: '무릎 위 넙다리 뒤(궁둥신경이 갈라지는 곳)', femInguinal: '샅고랑인대 아래', latEpi: '가쪽위관절융기', humHead: '위팔뼈머리', olecranon: '팔꿈치머리',
  tibTub: '정강뼈거친면', medMall: '안쪽복사', ischTub: '궁둥뼈결절', patLig: '무릎인대',
};
export function cases5(): Case5[] {
  const all: Case5[] = [
    { id: 'wrist', title: '손목 처짐', story: '위팔뼈 몸통 중간 골절 뒤, 손목과 손가락을 펴지 못하고 손이 아래로 처진다. 손등 엄지 쪽이 저리다.',
      nerve: 'radial', opts: ['radial', 'median', 'ulnar', 'axillary'], site: { view: 'apost', key: 'radGroove', region: 'hum', decoys: ['axNeck', 'ulnEpi'] },
      why: '노신경은 위팔뼈 몸통 뒤의 노신경고랑에 바로 붙어 돈다(모델에서 측정한 접촉 구간: 위팔뼈 중간 높이). 몸통 골절에서 가장 잘 다친다 → 손목·손가락 폄근 마비.' },
    { id: 'claw', title: '갈퀴손', story: '팔꿈치 안쪽을 세게 부딪친 뒤 넷째·새끼손가락이 굽은 채 펴지지 않고(갈퀴손), 새끼손가락 쪽이 저리다.',
      nerve: 'ulnar', opts: ['ulnar', 'median', 'radial', 'musculocutaneous'], site: { view: 'apost', key: 'ulnEpi', region: 'hum', decoys: ['radGroove', 'latEpi'] },
      why: '자신경은 안쪽위관절융기 바로 뒤를 지난다(모델 측정: 뼈와 3 mm 이내). 손의 작은 근육 대부분을 지배하므로 갈퀴손이 생긴다.' },
    { id: 'carpal', title: '손목굴 증후군', story: '밤마다 엄지·검지·가운뎃손가락이 저리고, 엄지두덩이 얇아져 엄지를 다른 손가락에 맞대기 어렵다.',
      nerve: 'median', opts: ['median', 'ulnar', 'radial', 'musculocutaneous'], site: { view: 'aant', key: 'carpal', region: 'hand', decoys: ['tip1', 'tip5'] },
      why: '정중신경은 굽힘근지지띠 아래 손목굴을 지나 손바닥으로 들어간다. 이곳에서 눌리면 엄지~넷째 반쪽 감각과 엄지 맞섬이 약해진다.' },
    { id: 'foot', title: '발처짐', story: '무릎 바로 아래 바깥쪽에 깁스를 오래 한 뒤 발을 들지 못해 걸을 때 발끝이 끌리고, 발등이 저리다.',
      nerve: 'fibular', opts: ['fibular', 'sciatic', 'femoral', 'radial'], site: { view: 'lpost', key: 'fibNeck', region: 'knee', decoys: ['sciSplit', 'tibTub'] },
      why: '온종아리신경은 종아리뼈 목을 바깥에서 감아 돈다(모델 측정: 뼈와 접촉). 피부 바로 아래라 골절·깁스 압박에 약하다 → 발등굽힘근 마비.' },
    { id: 'deltoid', title: '어깨 벌림 약화', story: '어깨 탈구를 맞춘 뒤 팔을 옆으로 들기 어렵고, 어깨 가쪽 아래 피부의 감각이 없다.',
      nerve: 'axillary', opts: ['axillary', 'radial', 'musculocutaneous', 'median'], site: { view: 'apost', key: 'axNeck', region: 'hum', decoys: ['radGroove', 'humHead'] },
      why: '겨드랑신경은 위팔뼈 수술목을 뒤에서 감아 돈다. 탈구·수술목 골절에서 다쳐 어깨세모근이 마비된다.' },
    { id: 'knee', title: '무릎 폄 약화', story: '골반 수술 뒤 계단을 오를 때 무릎이 꺾이고, 무릎반사가 나오지 않는다. 넙다리 앞이 저리다.',
      nerve: 'femoral', opts: ['femoral', 'sciatic', 'fibular', 'musculocutaneous'], site: { view: 'lant', key: 'femInguinal', region: 'full', decoys: ['patLig', 'tibTub'] },
      why: '넙다리신경(L2–L4)은 샅고랑인대 아래로 넙다리 앞에 나와 넙다리네갈래근을 지배한다 → 무릎 폄과 무릎반사.' },
  ];
  return G.run.difficulty === 'adv' ? all : all.slice(0, 4);
}

// ---------------- devices ----------------
/** D1 reflex bench: tendon tapped -> nerve + roots */
export interface Reflex { id: string; ko: string; region: 'elbow' | 'pknee'; key: string; nerve: NerveId; roots: string; decoys: string[] }
export const REFLEX: Reflex[] = [
  { id: 'biceps', ko: '위팔두갈래근 반사', region: 'elbow', key: 'bicepsTendon', nerve: 'musculocutaneous', roots: 'C5–C6', decoys: ['medEpi', 'latEpi'] },
  { id: 'patellar', ko: '무릎 반사', region: 'pknee', key: 'patLig', nerve: 'femoral', roots: 'L2–L4', decoys: ['tibTub', 'fibHead'] },
];
export const REFLEX_OPTS: Record<string, [string, string][]> = {
  biceps: [['musculocutaneous', 'C5–C6'], ['radial', 'C7'], ['ulnar', 'C8–T1']],
  patellar: [['femoral', 'L2–L4'], ['sciatic', 'L5–S1'], ['fibular', 'L4–S2']],
};
export const DECOY_NOTE: Record<string, string> = {
  medEpi: '안쪽위관절융기 — 반사를 보는 힘줄이 아니다. 바로 뒤로 자신경이 지난다("찌릿한 곳").',
  latEpi: '가쪽위관절융기 — 손목 폄근들의 공통 이는곳. 반사 검사 자리가 아니다.',
  tibTub: '정강뼈거친면 — 무릎인대가 닿는 뼈. 반사는 그 위 무릎인대(힘줄)를 두드린다.',
  fibHead: '종아리뼈머리 — 넙다리두갈래근이 닿는 곳. 바로 아래 목을 온종아리신경이 감아 돈다.',
  axNeck: '위팔뼈 수술목 — 겨드랑신경이 감아 도는 곳.', radGroove: '노신경고랑(위팔뼈 몸통 중간 뒤) — 노신경이 지나는 곳.',
  ulnEpi: '안쪽위관절융기 뒤 — 자신경이 지나는 곳.', humHead: '위팔뼈머리 — 관절면. 신경이 붙어 지나지 않는다.',
  sciSplit: '궁둥신경이 정강신경·온종아리신경으로 갈라지는 곳(무릎 위).', fibNeck: '종아리뼈 목 — 온종아리신경이 감아 도는 곳.',
  ischTub: '궁둥뼈결절 — 뒤넙다리근의 이는곳. 궁둥신경은 그 가쪽을 지난다.', carpal: '손목굴 — 정중신경이 지나는 곳.',
  tip1: '엄지 끝 — 신경이 눌리는 자리가 아니라 저림이 느껴지는 곳이다.', tip5: '새끼손가락 끝 — 자신경의 감각 영역.',
  patLig: '무릎인대 — 무릎반사를 보는 힘줄.', femInguinal: '샅고랑인대 아래 — 넙다리신경이 넙다리로 나오는 곳.',
};
/** D3 sensory map zones (palmar): finger tip point key + side offset (mm, + = toward the little finger) */
export interface Zone { id: string; ko: string; tip: string; dx: number; nerve: 'median' | 'ulnar' }
export const ZONES: Zone[] = [
  { id: 'z1', ko: '엄지', tip: 'tip1', dx: 0, nerve: 'median' }, { id: 'z2', ko: '집게손가락', tip: 'tip2', dx: 0, nerve: 'median' },
  { id: 'z3', ko: '가운뎃손가락', tip: 'tip3', dx: 0, nerve: 'median' }, { id: 'z4r', ko: '넷째손가락 엄지 쪽 절반', tip: 'tip4', dx: -4, nerve: 'median' },
  { id: 'z4u', ko: '넷째손가락 새끼 쪽 절반', tip: 'tip4', dx: 4, nerve: 'ulnar' }, { id: 'z5', ko: '새끼손가락', tip: 'tip5', dx: 0, nerve: 'ulnar' },
];

// ---------------- manifest ----------------
export type Pt = [number, number];
export interface NRect { view: string; x: number; y: number; w: number; h: number; density: number }
export interface NerveManifest {
  views: Record<string, { K: number; W: number; H: number }>;
  rects: Record<string, NRect>; regions: Record<string, NRect>;
  points: Record<string, Record<string, Pt>>;
  digits: Record<string, Record<string, number>>;
}
export interface Scan5 { views: Record<string, { density: number; names: string[]; grid: { w: number; h: number; step: number; rle: [number, number][] }; nerves: Record<string, { x: number; y: number; area: number; anchors?: [number, number][]; rect: { x: number; y: number; w: number; h: number } }> }> }

export function nerveClue(id: string): string | null {
  const a = G.run.difficulty === 'adv';
  switch (id) {
    case 'k_neuro': return a ? '🩺 신경학 검사 기록지: "반사 2종 — 팔꿈치 앞 힘줄, 무릎 앞 힘줄. 각 반사의 신경과 척수 분절을 기록할 것."'
      : '🩺 신경학 검사 기록지: "N-02 반사 검사대 — ① 팔꿈치 앞의 위팔두갈래근 힘줄을 두드린다 → 근육피부신경, C5–C6. ② 무릎뼈 아래 무릎인대를 두드린다 → 넙다리신경, L2–L4."';
    case 'k_xray': return a ? '🩻 X-ray 판독 의뢰서: "골절 2건 — 어깨 탈구 동반 위팔뼈 위쪽 골절, 손목 처짐 동반 몸통 중간 골절. 각 골절선 옆 신경을 표시할 것."'
      : '🩻 X-ray 판독 의뢰서: "N-04 판독기 — ① 위팔뼈 수술목 골절(어깨 탈구): 수술목을 감아 도는 겨드랑신경. ② 몸통 중간 골절 + 손목 처짐: 몸통 뒤 노신경고랑의 노신경."';
    case 'k_carpal': return a ? '📝 손목굴 증후군 진료 기록: "환자 손바닥 저림 범위를 감각 지도에 그대로 옮길 것. 나머지는 다른 신경 영역."'
      : '📝 손목굴 증후군 진료 기록: "저림 = 엄지·검지·가운뎃손가락·넷째손가락 엄지 쪽 절반(정중신경, 3½개). 넷째 새끼 쪽 절반과 새끼손가락은 자신경(1½개). N-05 감각 지도 패널에 칠할 것."';
    case 'k_gait': return a ? '🦶 보행 분석 기록: "발처짐 환자. 다리 배선 추적기에서 궁둥신경의 갈림점과 발처짐 손상 자리를 차례로 표시."'
      : '🦶 보행 분석 기록: "N-05 추적기 — ① 궁둥신경은 무릎 위 넙다리 뒤에서 정강신경·온종아리신경으로 갈라진다. ② 발처짐 = 종아리뼈 목을 감아 도는 온종아리신경 손상."';
  }
  return null;
}
