// Chapter 2 — muscles of the shoulder & arm. Same frame as anatomy.ts:
// RIGHT upper limb, ANTERIOR view, viewer's left = lateral, sternum midline at x = 640.

export type AttId =
  | 'clavLat' | 'clavMed' | 'sternum' | 'acromion' | 'spine' | 'coracoid' | 'supraglenoid' | 'infraglenoid' | 'supraFossa'
  | 'greater' | 'groove' | 'grooveFloor' | 'deltTub' | 'humMed' | 'humAnt' | 'latSupra' | 'medEpi'
  | 'radTub' | 'ulnTub' | 'olecranon' | 'radStyloid' | 'thoracolumbar';

export interface Att { id: AttId; ko: string; en: string; x: number; y: number; posterior?: boolean; on: string }

/**
 * Attachment sites (frame coordinates). Measured on the BodyParts3D model (tools/anatomy3d/atts.py): centroid of the
 * muscle-mesh vertices touching the bone surface (<2.5 mm), projected into the anterior plate. Exceptions: medEpi =
 * most medial point of the distal humerus. grooveFloor / thoracolumbar = humeral and vertebral (T7–T11, lumbosacral)
 * contacts of the latissimus mesh from BodyParts3D 3.0 registered onto the 4.0 skeleton (tools/anatomy3d/latissimus.py).
 * Each site is also checked against its textbook landmark region (tools/anatomy3d/landmarks.py).
 * `posterior` = lies behind in this anterior view (drawn dashed).
 */
export const ATT: Record<AttId, Att> = {
  clavLat: { id: 'clavLat', ko: '쇄골 외측 1/3', en: 'Lateral third of clavicle', x: 431, y: 139, on: '삼각근(앞섬유)의 기시부입니다.' },
  clavMed: { id: 'clavMed', ko: '쇄골 내측 1/2', en: 'Medial half of clavicle', x: 527, y: 171, on: '대흉근 쇄골두의 기시부입니다.' },
  sternum: { id: 'sternum', ko: '흉골 · 늑연골', en: 'Sternum & costal cartilages', x: 585, y: 354, on: '대흉근 흉늑부의 기시부입니다.' },
  acromion: { id: 'acromion', ko: '견봉', en: 'Acromion', x: 363, y: 151, on: '삼각근(중간섬유)의 기시부입니다.' },
  spine: { id: 'spine', ko: '견갑극', en: 'Spine of scapula', x: 462, y: 207, posterior: true, on: '삼각근(뒤섬유)의 기시부입니다. 정면에서는 뒤쪽에 있어요.' },
  coracoid: { id: 'coracoid', ko: '오구돌기', en: 'Coracoid process', x: 402, y: 184, on: '상완이두근 단두·오훼완근·소흉근의 기시부입니다.' },
  supraglenoid: { id: 'supraglenoid', ko: '관절상결절', en: 'Supraglenoid tubercle', x: 399, y: 176, on: '상완이두근 장두의 기시부입니다(관절와 바로 위).' },
  infraglenoid: { id: 'infraglenoid', ko: '관절하결절', en: 'Infraglenoid tubercle', x: 389, y: 246, on: '상완삼두근 장두의 기시부입니다(관절와 바로 아래).' },
  supraFossa: { id: 'supraFossa', ko: '극상와', en: 'Supraspinous fossa', x: 486, y: 196, posterior: true, on: '극상근의 기시부입니다. 견갑극 위의 오목으로 뒤쪽에 있어요.' },
  greater: { id: 'greater', ko: '대결절', en: 'Greater tubercle', x: 322, y: 185, on: '극상근·극하근·소원근의 정지부입니다.' },
  groove: { id: 'groove', ko: '결절간구 외측순', en: 'Lateral lip of intertubercular groove', x: 321, y: 298, on: '대흉근의 정지부입니다.' },
  grooveFloor: { id: 'grooveFloor', ko: '결절간구 바닥', en: 'Floor of intertubercular groove', x: 340, y: 301, on: '광배근의 정지부입니다.' },
  deltTub: { id: 'deltTub', ko: '삼각근조면', en: 'Deltoid tuberosity', x: 285, y: 391, on: '삼각근의 정지부입니다(상완골 몸통 외측 중간).' },
  humMed: { id: 'humMed', ko: '상완골 몸통 내측 중간', en: 'Medial shaft of humerus (middle)', x: 313, y: 433, on: '오훼완근의 정지부입니다.' },
  humAnt: { id: 'humAnt', ko: '상완골 앞면 원위 1/2', en: 'Distal half of anterior humerus', x: 287, y: 527, on: '상완근의 기시부입니다.' },
  latSupra: { id: 'latSupra', ko: '외측과상능선', en: 'Lateral supracondylar ridge', x: 263, y: 542, on: '상완요골근의 기시부입니다.' },
  medEpi: { id: 'medEpi', ko: '내측상과', en: 'Medial epicondyle', x: 329, y: 666, on: '원회내근·전완 굴곡근(공통 굴곡건)의 기시부입니다.' },
  radTub: { id: 'radTub', ko: '요골조면', en: 'Radial tuberosity', x: 240, y: 742, on: '상완이두근의 정지부입니다.' },
  ulnTub: { id: 'ulnTub', ko: '척골조면 · 구상돌기', en: 'Ulnar tuberosity & coronoid', x: 270, y: 725, on: '상완근의 정지부입니다.' },
  olecranon: { id: 'olecranon', ko: '주두', en: 'Olecranon', x: 271, y: 679, posterior: true, on: '상완삼두근의 정지부입니다. 팔꿈치 뒤쪽 끝이에요.' },
  radStyloid: { id: 'radStyloid', ko: '요골 경상돌기 기저부', en: 'Base of radial styloid', x: 155, y: 1070, on: '상완요골근의 정지부입니다.' },
  thoracolumbar: { id: 'thoracolumbar', ko: '흉요근막 · 하위 흉추', en: 'Thoracolumbar fascia, T7–L5', x: 633, y: 719, posterior: true, on: '광배근의 기시부입니다.' },
};

export type MuscleId = 'deltoid' | 'pecmajor' | 'biceps' | 'brachialis' | 'coracobrachialis' | 'brachioradialis' | 'triceps' | 'supraspinatus' | 'latissimus';

export interface MuscleDef {
  id: MuscleId; ko: string; alt: string; en: string;
  origins: AttId[];           // all required in the link puzzle
  insertion: AttId;
  originText: string; insertionText: string;
  action: string; nerve: string;
  posterior?: boolean;        // not visible in the anterior view
}

export const MUSCLES: Record<MuscleId, MuscleDef> = {
  deltoid: {
    id: 'deltoid', ko: '삼각근', alt: '어깨세모근', en: 'Deltoid', origins: ['clavLat', 'acromion'], insertion: 'deltTub',
    originText: '쇄골 외측 1/3 · 견봉 · 견갑극', insertionText: '삼각근조면',
    action: '중간섬유: 어깨 외전(15° 이후 주동) · 앞섬유: 굴곡·내회전 · 뒤섬유: 신전·외회전', nerve: '액와신경 (C5–C6)',
  },
  pecmajor: {
    id: 'pecmajor', ko: '대흉근', alt: '큰가슴근', en: 'Pectoralis major', origins: ['clavMed', 'sternum'], insertion: 'groove',
    originText: '쇄골 내측 1/2 · 흉골 · 제1–6 늑연골', insertionText: '결절간구 외측순',
    action: '어깨 내전·내회전 · 쇄골두: 굴곡', nerve: '내측·외측 흉근신경 (C5–T1)',
  },
  biceps: {
    id: 'biceps', ko: '상완이두근', alt: '위팔두갈래근', en: 'Biceps brachii', origins: ['supraglenoid', 'coracoid'], insertion: 'radTub',
    originText: '장두: 관절상결절 · 단두: 오구돌기', insertionText: '요골조면 (+상완이두근건막)',
    action: '팔꿈치 굴곡 · 전완 회외(강력) · 어깨 굴곡 보조', nerve: '근피신경 (C5–C6)',
  },
  brachialis: {
    id: 'brachialis', ko: '상완근', alt: '위팔근', en: 'Brachialis', origins: ['humAnt'], insertion: 'ulnTub',
    originText: '상완골 앞면 원위 1/2', insertionText: '척골조면 · 구상돌기',
    action: '팔꿈치 굴곡의 주동근(전완 회내·회외와 무관하게 작용)', nerve: '근피신경 (+요골신경 일부)',
  },
  coracobrachialis: {
    id: 'coracobrachialis', ko: '오훼완근', alt: '부리위팔근', en: 'Coracobrachialis', origins: ['coracoid'], insertion: 'humMed',
    originText: '오구돌기', insertionText: '상완골 몸통 내측 중간',
    action: '어깨 굴곡·내전 보조', nerve: '근피신경 (C5–C7)',
  },
  brachioradialis: {
    id: 'brachioradialis', ko: '상완요골근', alt: '위팔노근', en: 'Brachioradialis', origins: ['latSupra'], insertion: 'radStyloid',
    originText: '상완골 외측과상능선', insertionText: '요골 경상돌기 기저부',
    action: '팔꿈치 굴곡(중립 자세에서 가장 강함)', nerve: '요골신경 (C5–C6)',
  },
  triceps: {
    id: 'triceps', ko: '상완삼두근', alt: '위팔세갈래근', en: 'Triceps brachii', origins: ['infraglenoid'], insertion: 'olecranon', posterior: true,
    originText: '장두: 관절하결절 · 외측두/내측두: 상완골 뒷면', insertionText: '주두',
    action: '팔꿈치 신전의 주동근 · 장두: 어깨 신전·내전 보조', nerve: '요골신경 (C6–C8)',
  },
  supraspinatus: {
    id: 'supraspinatus', ko: '극상근', alt: '가시위근', en: 'Supraspinatus', origins: ['supraFossa'], insertion: 'greater', posterior: true,
    originText: '극상와', insertionText: '대결절 위면',
    action: '어깨 외전 개시(0–15°) · 상완골두를 관절와에 고정(회전근개)', nerve: '견갑상신경 (C5)',
  },
  latissimus: {
    id: 'latissimus', ko: '광배근', alt: '넓은등근', en: 'Latissimus dorsi', origins: ['thoracolumbar'], insertion: 'grooveFloor', posterior: true,
    originText: 'T7–L5 극돌기 · 흉요근막 · 장골능 · 하위 늑골', insertionText: '결절간구 바닥',
    action: '어깨 신전·내전·내회전', nerve: '흉배신경 (C6–C8)',
  },
};

/** Link puzzle sets. Decoy nodes are other real attachment sites (each has its own explanation). */
export const LINK_BASIC: MuscleId[] = ['deltoid', 'biceps', 'brachialis', 'triceps'];
export const LINK_ADV: MuscleId[] = ['deltoid', 'biceps', 'brachialis', 'triceps', 'coracobrachialis', 'brachioradialis'];
export const LINK_NODES: AttId[] = ['clavLat', 'acromion', 'coracoid', 'supraglenoid', 'infraglenoid', 'greater', 'deltTub', 'humMed', 'humAnt', 'latSupra', 'medEpi', 'olecranon', 'ulnTub', 'radTub', 'radStyloid'];

/** Atlas puzzle (name ↔ location): superficial anterior muscles + decoy names. */
export const ATLAS_TARGETS: MuscleId[] = ['deltoid', 'pecmajor', 'biceps', 'brachialis', 'coracobrachialis', 'brachioradialis'];
export const ATLAS_DECOYS_BASIC: MuscleId[] = ['triceps'];
export const ATLAS_DECOYS_ADV: MuscleId[] = ['triceps', 'supraspinatus', 'latissimus'];

// ---------------- Motion puzzle (agonist / antagonist) ----------------
export type Role = 'agonist' | 'antagonist' | 'none';
export interface MotionRound {
  id: 'elbowFlex' | 'shoulderAbd';
  ko: string; en: string; joint: string; plane: string;
  cards: MuscleId[];
  roles: Partial<Record<MuscleId, Role>>;   // missing = none
  why: Partial<Record<MuscleId, string>>;   // feedback when misassigned
  range: number;                            // degrees shown in the demo
}

export const MOTION_ROUNDS: MotionRound[] = [
  {
    id: 'elbowFlex', ko: '팔꿈치 굽힘', en: 'Elbow flexion', joint: '팔꿉관절 (경첩관절)', plane: '시상면 · 내외측축', range: 140,
    cards: ['biceps', 'brachialis', 'triceps', 'deltoid'],
    roles: { biceps: 'agonist', brachialis: 'agonist', triceps: 'antagonist' },
    why: {
      biceps: '상완이두근은 팔꿉관절 앞을 지나 요골조면에 붙으므로 수축하면 팔꿈치가 굽혀집니다 → 주동근.',
      brachialis: '상완근은 팔꿈치 굴곡의 주된 근육입니다(척골에 붙어 회내·회외와 무관하게 작용) → 주동근.',
      triceps: '상완삼두근은 팔꿉관절 뒤를 지나 주두에 붙어 팔꿈치를 폅니다. 굽힐 때는 이완하며 길어지는 길항근이에요.',
      deltoid: '삼각근은 어깨관절만 지나므로 팔꿈치 굽힘에는 관여하지 않습니다.',
    },
  },
  {
    id: 'shoulderAbd', ko: '어깨 벌림', en: 'Shoulder abduction (0–90°)', joint: '견갑상완관절 (구관절)', plane: '관상면 · 전후축', range: 90,
    cards: ['deltoid', 'supraspinatus', 'pecmajor', 'latissimus', 'brachialis'],
    roles: { deltoid: 'agonist', supraspinatus: 'agonist', pecmajor: 'antagonist', latissimus: 'antagonist' },
    why: {
      deltoid: '삼각근 중간섬유가 견봉에서 삼각근조면으로 당겨 팔을 옆으로 들어 올립니다 → 주동근.',
      supraspinatus: '극상근은 외전을 시작하고(0–15°) 상완골두를 관절와에 눌러 고정해, 삼각근이 위로만 당기는 것을 막습니다 → 주동근(협력).',
      pecmajor: '대흉근은 팔을 몸쪽으로 모으는 내전근입니다. 외전할 때는 이완하는 길항근이에요.',
      latissimus: '광배근은 강력한 내전·신전근입니다. 외전의 길항근이에요.',
      brachialis: '상완근은 팔꿉관절만 지나므로 어깨 운동에는 관여하지 않습니다.',
    },
  },
];
