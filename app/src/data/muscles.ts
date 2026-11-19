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
  clavLat: { id: 'clavLat', ko: '빗장뼈 가쪽 1/3', en: 'Lateral third of clavicle', x: 431, y: 139, on: '어깨세모근(앞섬유)의 이는곳입니다.' },
  clavMed: { id: 'clavMed', ko: '빗장뼈 안쪽 1/2', en: 'Medial half of clavicle', x: 527, y: 171, on: '큰가슴근 빗장부분의 이는곳입니다.' },
  sternum: { id: 'sternum', ko: '복장뼈 · 갈비연골', en: 'Sternum & costal cartilages', x: 585, y: 354, on: '큰가슴근 복장갈비부분의 이는곳입니다.' },
  acromion: { id: 'acromion', ko: '봉우리', en: 'Acromion', x: 363, y: 151, on: '어깨세모근(중간섬유)의 이는곳입니다.' },
  spine: { id: 'spine', ko: '어깨뼈가시', en: 'Spine of scapula', x: 462, y: 207, posterior: true, on: '어깨세모근(뒤섬유)의 이는곳입니다. 정면에서는 뒤쪽에 있어요.' },
  coracoid: { id: 'coracoid', ko: '부리돌기', en: 'Coracoid process', x: 402, y: 184, on: '위팔두갈래근 짧은갈래·부리위팔근·작은가슴근의 이는곳입니다.' },
  supraglenoid: { id: 'supraglenoid', ko: '관절위결절', en: 'Supraglenoid tubercle', x: 399, y: 176, on: '위팔두갈래근 긴갈래의 이는곳입니다(관절오목 바로 위).' },
  infraglenoid: { id: 'infraglenoid', ko: '관절아래결절', en: 'Infraglenoid tubercle', x: 389, y: 246, on: '위팔세갈래근 긴갈래의 이는곳입니다(관절오목 바로 아래).' },
  supraFossa: { id: 'supraFossa', ko: '가시위오목', en: 'Supraspinous fossa', x: 486, y: 196, posterior: true, on: '가시위근의 이는곳입니다. 어깨뼈가시 위의 오목으로 뒤쪽에 있어요.' },
  greater: { id: 'greater', ko: '큰결절', en: 'Greater tubercle', x: 322, y: 185, on: '가시위근·가시아래근·작은원근의 닿는곳입니다.' },
  groove: { id: 'groove', ko: '결절사이고랑 가쪽입술', en: 'Lateral lip of intertubercular groove', x: 321, y: 298, on: '큰가슴근의 닿는곳입니다.' },
  grooveFloor: { id: 'grooveFloor', ko: '결절사이고랑 바닥', en: 'Floor of intertubercular groove', x: 340, y: 301, on: '넓은등근의 닿는곳입니다.' },
  deltTub: { id: 'deltTub', ko: '어깨세모근거친면', en: 'Deltoid tuberosity', x: 285, y: 391, on: '어깨세모근의 닿는곳입니다(위팔뼈 몸통 가쪽 중간).' },
  humMed: { id: 'humMed', ko: '위팔뼈 몸통 안쪽 중간', en: 'Medial shaft of humerus (middle)', x: 313, y: 433, on: '부리위팔근의 닿는곳입니다.' },
  humAnt: { id: 'humAnt', ko: '위팔뼈 앞면 먼쪽 1/2', en: 'Distal half of anterior humerus', x: 287, y: 527, on: '위팔근의 이는곳입니다.' },
  latSupra: { id: 'latSupra', ko: '가쪽관절융기위능선', en: 'Lateral supracondylar ridge', x: 263, y: 542, on: '위팔노근의 이는곳입니다.' },
  medEpi: { id: 'medEpi', ko: '안쪽위관절융기', en: 'Medial epicondyle', x: 329, y: 666, on: '원엎침근·아래팔 굽힘근(공통 굽힘힘줄)의 이는곳입니다.' },
  radTub: { id: 'radTub', ko: '노뼈거친면', en: 'Radial tuberosity', x: 240, y: 742, on: '위팔두갈래근의 닿는곳입니다.' },
  ulnTub: { id: 'ulnTub', ko: '자뼈거친면 · 갈고리돌기', en: 'Ulnar tuberosity & coronoid', x: 270, y: 725, on: '위팔근의 닿는곳입니다.' },
  olecranon: { id: 'olecranon', ko: '팔꿈치머리', en: 'Olecranon', x: 271, y: 679, posterior: true, on: '위팔세갈래근의 닿는곳입니다. 팔꿈치 뒤쪽 끝이에요.' },
  radStyloid: { id: 'radStyloid', ko: '노뼈 붓돌기 기저부', en: 'Base of radial styloid', x: 155, y: 1070, on: '위팔노근의 닿는곳입니다.' },
  thoracolumbar: { id: 'thoracolumbar', ko: '등허리근막 · 하위 등뼈', en: 'Thoracolumbar fascia, T7–L5', x: 633, y: 719, posterior: true, on: '넓은등근의 이는곳입니다.' },
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
    id: 'deltoid', ko: '어깨세모근', alt: '어깨세모근', en: 'Deltoid', origins: ['clavLat', 'acromion'], insertion: 'deltTub',
    originText: '빗장뼈 가쪽 1/3 · 봉우리 · 어깨뼈가시', insertionText: '어깨세모근거친면',
    action: '중간섬유: 어깨 벌림(15° 이후 주동) · 앞섬유: 굽힘·안쪽돌림 · 뒤섬유: 폄·가쪽돌림', nerve: '겨드랑신경 (C5–C6)',
  },
  pecmajor: {
    id: 'pecmajor', ko: '큰가슴근', alt: '큰가슴근', en: 'Pectoralis major', origins: ['clavMed', 'sternum'], insertion: 'groove',
    originText: '빗장뼈 안쪽 1/2 · 복장뼈 · 제1–6 갈비연골', insertionText: '결절사이고랑 가쪽입술',
    action: '어깨 모음·안쪽돌림 · 빗장부분: 굽힘', nerve: '안쪽·가쪽 가슴근신경 (C5–T1)',
  },
  biceps: {
    id: 'biceps', ko: '위팔두갈래근', alt: '위팔두갈래근', en: 'Biceps brachii', origins: ['supraglenoid', 'coracoid'], insertion: 'radTub',
    originText: '긴갈래: 관절위결절 · 짧은갈래: 부리돌기', insertionText: '노뼈거친면 (+위팔두갈래근널힘줄)',
    action: '팔꿈치 굽힘 · 아래팔 뒤침(강력) · 어깨 굽힘 보조', nerve: '근육피부신경 (C5–C6)',
  },
  brachialis: {
    id: 'brachialis', ko: '위팔근', alt: '위팔근', en: 'Brachialis', origins: ['humAnt'], insertion: 'ulnTub',
    originText: '위팔뼈 앞면 먼쪽 1/2', insertionText: '자뼈거친면 · 갈고리돌기',
    action: '팔꿈치 굽힘의 주작용근(아래팔 엎침·뒤침과 무관하게 작용)', nerve: '근육피부신경 (+노신경 일부)',
  },
  coracobrachialis: {
    id: 'coracobrachialis', ko: '부리위팔근', alt: '부리위팔근', en: 'Coracobrachialis', origins: ['coracoid'], insertion: 'humMed',
    originText: '부리돌기', insertionText: '위팔뼈 몸통 안쪽 중간',
    action: '어깨 굽힘·모음 보조', nerve: '근육피부신경 (C5–C7)',
  },
  brachioradialis: {
    id: 'brachioradialis', ko: '위팔노근', alt: '위팔노근', en: 'Brachioradialis', origins: ['latSupra'], insertion: 'radStyloid',
    originText: '위팔뼈 가쪽관절융기위능선', insertionText: '노뼈 붓돌기 기저부',
    action: '팔꿈치 굽힘(중립 자세에서 가장 강함)', nerve: '노신경 (C5–C6)',
  },
  triceps: {
    id: 'triceps', ko: '위팔세갈래근', alt: '위팔세갈래근', en: 'Triceps brachii', origins: ['infraglenoid'], insertion: 'olecranon', posterior: true,
    originText: '긴갈래: 관절아래결절 · 가쪽갈래/안쪽갈래: 위팔뼈 뒷면', insertionText: '팔꿈치머리',
    action: '팔꿈치 폄의 주작용근 · 긴갈래: 어깨 폄·모음 보조', nerve: '노신경 (C6–C8)',
  },
  supraspinatus: {
    id: 'supraspinatus', ko: '가시위근', alt: '가시위근', en: 'Supraspinatus', origins: ['supraFossa'], insertion: 'greater', posterior: true,
    originText: '가시위오목', insertionText: '큰결절 위면',
    action: '어깨 벌림 개시(0–15°) · 위팔뼈머리를 관절오목에 고정(돌림근띠)', nerve: '어깨위신경 (C5)',
  },
  latissimus: {
    id: 'latissimus', ko: '넓은등근', alt: '넓은등근', en: 'Latissimus dorsi', origins: ['thoracolumbar'], insertion: 'grooveFloor', posterior: true,
    originText: 'T7–L5 가시돌기 · 등허리근막 · 엉덩뼈능선 · 하위 갈비뼈', insertionText: '결절사이고랑 바닥',
    action: '어깨 폄·모음·안쪽돌림', nerve: '가슴등신경 (C6–C8)',
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
    id: 'elbowFlex', ko: '팔꿈치 굽힘', en: 'Elbow flexion', joint: '팔꿉관절 (경첩관절)', plane: '시상면 · 안쪽가쪽축', range: 140,
    cards: ['biceps', 'brachialis', 'triceps', 'deltoid'],
    roles: { biceps: 'agonist', brachialis: 'agonist', triceps: 'antagonist' },
    why: {
      biceps: '위팔두갈래근은 팔꿉관절 앞을 지나 노뼈거친면에 붙으므로 수축하면 팔꿈치가 굽혀집니다 → 주작용근.',
      brachialis: '위팔근은 팔꿈치 굽힘의 주된 근육입니다(자뼈에 붙어 엎침·뒤침과 무관하게 작용) → 주작용근.',
      triceps: '위팔세갈래근은 팔꿉관절 뒤를 지나 팔꿈치머리에 붙어 팔꿈치를 폅니다. 굽힐 때는 이완하며 길어지는 대항근이에요.',
      deltoid: '어깨세모근은 어깨관절만 지나므로 팔꿈치 굽힘에는 관여하지 않습니다.',
    },
  },
  {
    id: 'shoulderAbd', ko: '어깨 벌림', en: 'Shoulder abduction (0–90°)', joint: '오목위팔관절 (절절구관절)', plane: '관상면 · 전후축', range: 90,
    cards: ['deltoid', 'supraspinatus', 'pecmajor', 'latissimus', 'brachialis'],
    roles: { deltoid: 'agonist', supraspinatus: 'agonist', pecmajor: 'antagonist', latissimus: 'antagonist' },
    why: {
      deltoid: '어깨세모근 중간섬유가 봉우리에서 어깨세모근거친면으로 당겨 팔을 옆으로 들어 올립니다 → 주작용근.',
      supraspinatus: '가시위근은 벌림을 시작하고(0–15°) 위팔뼈머리를 관절오목에 눌러 고정해, 어깨세모근이 위로만 당기는 것을 막습니다 → 주작용근(협력).',
      pecmajor: '큰가슴근은 팔을 몸쪽으로 모으는 모음근입니다. 벌림할 때는 이완하는 대항근이에요.',
      latissimus: '넓은등근은 강력한 모음·폄근입니다. 벌림의 대항근이에요.',
      brachialis: '위팔근은 팔꿉관절만 지나므로 어깨 운동에는 관여하지 않습니다.',
    },
  },
];
