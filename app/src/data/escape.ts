// CH1 escape-room puzzles (v0.8): per-run codes and the text each clue leaves in the notebook.
// Every code is random per run (kept in G.run.codes, created lazily so a run started by an older build still works).
import Phaser from 'phaser';
import { G } from '../game/state';
import { handClue } from './hand';
import { hipClue } from './hip';

const adv = () => G.run.difficulty === 'adv';
const shuffle = <T>(a: T[]) => Phaser.Utils.Array.Shuffle([...a]);

// ---------------------------------------------------------------- S-01 scapula (desk + photo frame)
export const SCAP_ORDER = ['acromion', 'coracoid', 'glenoid', 'inferiorAngle'] as const;
export const SCAP_KO: Record<string, string> = { acromion: '봉우리', coracoid: '부리돌기', glenoid: '관절오목', inferiorAngle: '아래각' };
export const SCAP_DESC: Record<string, string> = {
  acromion: '어깨 꼭대기에서 빗장뼈와 만나는 바깥쪽 끝',
  coracoid: '앞쪽으로 갈고리처럼 튀어나온 돌기',
  glenoid: '위팔뼈머리를 받는 얕은 오목',
  inferiorAngle: '삼각형의 가장 아래 꼭짓점',
};

// ---------------------------------------------------------------- S-02 humerus (cryo log + cooling unit)
export const CRYO_ZONES = ['head', 'shaft', 'condyle'] as const;
export type CryoZone = typeof CRYO_ZONES[number];
export const CRYO_KO: Record<CryoZone, string> = { head: '위팔뼈머리', shaft: '위팔뼈몸통', condyle: '위팔뼈관절융기' };
export const CRYO_DESC: Record<CryoZone, string> = {
  head: '몸쪽 끝의 둥근 머리 (어깨뼈 관절오목과 만난다)',
  shaft: '가운데의 긴 원통 부분',
  condyle: '먼쪽 끝의 넓은 부분 (팔꿈치 관절)',
};
export interface CryoRow { date: string; t: Record<CryoZone, number>; status: string; ok: boolean }
export interface CryoData { rows: CryoRow[]; answer: number; dialOrder: CryoZone[] }
export const CRYO_MIN = -24, CRYO_MAX = 0, CRYO_STEP = 2;
export function cryo(): CryoData {
  const c = G.run.codes;
  if (c.cryo) return JSON.parse(c.cryo);
  const temps = () => { const v = shuffle([-22, -20, -18, -16, -14, -12, -10, -8, -6]).slice(0, 3); return { head: v[0], shaft: v[1], condyle: v[2] }; };
  // the answer is the LAST row judged normal; an earlier normal row and later faulty rows make the rule matter
  const answer = Phaser.Math.Between(1, 2);
  const bad = shuffle(['경보 — 과냉각', '결빙 — 센서 오류', '경보 — 문 열림']);
  const rows: CryoRow[] = ['11월 1일', '11월 2일', '11월 3일', '11월 4일'].map((date, i) => {
    const ok = i === 0 || i === answer;
    return { date, t: temps(), ok, status: ok ? '정상' : bad.pop() ?? '경보' };
  });
  const d: CryoData = { rows, answer, dialOrder: shuffle([...CRYO_ZONES]) };
  c.cryo = JSON.stringify(d);
  return d;
}

// ---------------------------------------------------------------- S-03 radius (UV card, pencil rubbing, magnifier, locker)
export type DrawerBone = 'radius' | 'ulna' | 'fibula';
/** what lies in drawers A, B, C */
export function lockerOrder(): DrawerBone[] {
  const c = G.run.codes;
  if (!c.locker) c.locker = shuffle(['radius', 'ulna', 'fibula']).join(',');
  return c.locker.split(',') as DrawerBone[];
}

// ---------------------------------------------------------------- S-05 ulna (toolbox manual + fuse, cage circuit)
export const ULNA_POSTS = ['olecranon', 'coronoid', 'shaft', 'styloid'] as const;
export type UlnaPost = typeof ULNA_POSTS[number];
export const ULNA_KO: Record<UlnaPost, string> = { olecranon: '팔꿈치머리', coronoid: '갈고리돌기', shaft: '자뼈몸통', styloid: '자뼈붓돌기' };
export const ULNA_DESC: Record<UlnaPost, string> = {
  olecranon: '맨 위(몸쪽) 끝, 팔꿈치 뒤쪽으로 솟은 부분',
  coronoid: '도르래패임 아래쪽 앞으로 튀어나온 작은 돌기',
  shaft: '가운데의 가늘고 긴 부분',
  styloid: '맨 아래(먼쪽) 끝의 뾰족한 돌기',
};
/** jumper route through the four posts (random per run; the first and the last post differ from top-to-bottom order) */
export function ulnaRoute(): UlnaPost[] {
  const c = G.run.codes;
  if (!c.ulna) {
    let r: UlnaPost[];
    do r = shuffle([...ULNA_POSTS]); while (r.join() === ULNA_POSTS.join());
    c.ulna = r.join(',');
  }
  return c.ulna.split(',') as UlnaPost[];
}

// ---------------------------------------------------------------- S-04 clavicle (poster + wall safe)
export const JOINTS = ['sc', 'ac', 'gh', 'coracoid'] as const;
export type Joint = typeof JOINTS[number];
export const JOINT_KO: Record<Joint, string> = { sc: '복장빗장관절', ac: '봉우리빗장관절', gh: '어깨관절(오목위팔관절)', coracoid: '부리돌기' };
/** the riddle on the safe's brass plate (the decoy 'coracoid' marker is not used) */
export const JOINT_RIDDLE: Record<Exclude<Joint, 'coracoid'>, string> = {
  sc: '팔 전체를 몸통 뼈대에 잇는 유일한 관절 — 빗장뼈 안쪽 끝',
  ac: '빗장뼈 가쪽 끝이 어깨뼈 봉우리와 만나는 관절',
  gh: '위팔뼈머리가 얕은 오목에 끼워지는 관절',
};
export const SAFE_ORDER: Exclude<Joint, 'coracoid'>[] = ['sc', 'ac', 'gh'];
export const SAFE_DIRS: ('R' | 'L')[] = ['R', 'L', 'R'];
export const DIAL_N = 40;
/** numbers printed at each poster marker (two digits, 0-39, at least 6 apart so a near miss is not accepted) */
export function posterNums(): Record<Joint, number> {
  const c = G.run.codes;
  if (!c.poster) {
    let v: number[];
    const far = (a: number[]) => a.every((x, i) => a.every((y, j) => i === j || Math.min(Math.abs(x - y), DIAL_N - Math.abs(x - y)) >= 6));
    do v = shuffle(Array.from({ length: 34 }, (_, i) => i + 4)).slice(0, 4); while (!far(v));
    c.poster = v.join(',');
  }
  const v = c.poster.split(',').map(Number);
  return { sc: v[0], ac: v[1], gh: v[2], coracoid: v[3] };
}

// ---------------------------------------------------------------- CH2 (v0.10) muscle data cores
export type Fibre = 'A' | 'M' | 'P';
export const FIBRE_KO: Record<Fibre, string> = { A: '앞섬유', M: '중간섬유', P: '뒤섬유' };
export const FIBRE_ORIGIN: Record<Fibre, string> = { A: '빗장뼈 가쪽 1/3', M: '봉우리', P: '어깨뼈가시' };
export type Move = 'flex' | 'abd' | 'ext';
export const MOVE_KO: Record<Move, string> = { flex: '굽힘', abd: '벌림', ext: '폄' };
export const MOVE_DESC: Record<Move, string> = { flex: '팔을 앞으로 들기', abd: '팔을 옆으로 들기', ext: '팔을 뒤로 젖히기' };
export const FIBRE_MOVE: Record<Fibre, Move> = { A: 'flex', M: 'abd', P: 'ext' };
/** deltoid lightbox: the fibre order printed on its plate (4 presses, every fibre at least once) */
export function deltSeq(): Fibre[] {
  const c = G.run.codes;
  if (!c.delt) { let v: Fibre[]; do v = [0, 1, 2, 3].map(() => (['A', 'M', 'P'] as Fibre[])[Phaser.Math.Between(0, 2)]); while (new Set(v).size < 3); c.delt = v.join(''); }
  return c.delt.split('') as Fibre[];
}

// ---------------------------------------------------------------- notebook text for every clue
/** one paragraph per clue id (null = not a text clue) */
export function clueText(id: string): string | null {
  const a = adv();
  switch (id) {
    case 'note': return '📝 메모: 서랍 — 숫자 4자리. 숫자는 S-01 사진, 순서는 일지 마지막 장.';
    case 'frame_back': return '🖼 액자 뒷면: "숫자만 봐서는 모른다. 순서는 내 일지 마지막 장에."';
    case 'journal': return '📖 일지 마지막 장 — 순서:\n' + SCAP_ORDER.map((id, i) => `    ${i + 1}. ${SCAP_KO[id]}${a ? '' : ` — ${SCAP_DESC[id]}`}`).join('\n');
    case 'photo': return '📷 S-01 사진: 어깨뼈의 네 구조에 번호 스티커 (사본은 책상·액자 화면의 기록장에)';
    case 'cryolog': {
      const d = cryo();
      return '🌡 V-05 냉각 기록지 — "해동: 마지막으로 \'정상\' 판정을 받은 날의 설정을 입력"\n' +
        d.rows.map(r => `    ${r.date}  머리 ${r.t.head}° · 몸통 ${r.t.shaft}° · 관절융기 ${r.t.condyle}°  [${r.status}]`).join('\n');
    }
    case 'rubbing': return '✏️ 메모장 자국: "S-03 정보는 UV 잉크로 카드에 적었다. 보관장 유리는 흐리니 돋보기를 챙길 것."';
    case 'uvcard': return a ? '🔦 UV 카드: "S-03 = 오른쪽 노뼈. 보관장 세 칸 중 진짜는 하나, 나머지는 복제 모형."'
      : '🔦 UV 카드: "S-03 = 오른쪽 노뼈. 몸쪽 끝은 작은 원반 모양 머리, 먼쪽 끝은 넓게 퍼짐(가쪽에 붓돌기). 나머지 두 칸은 복제 모형."';
    case 'magnifier': return '🔍 돋보기 — S-07 보관장의 흐린 유리 너머를 볼 수 있다.';
    case 'manual': {
      const r = ulnaRoute();
      return '📘 케이지 전원 복구 절차: ① 빈 소켓에 퓨즈 ② 점퍼선 — 전원 → ' + r.map(p => ULNA_KO[p]).join(' → ') + ' → 잠금장치 ③ 차단기 레버 올림' +
        (a ? '' : '\n' + r.map(p => `    · ${ULNA_KO[p]}: ${ULNA_DESC[p]}`).join('\n'));
    }
    case 'fuse': return '🔌 예비 퓨즈 (J-03 공구함에서 챙김)';
    case 'poster': return '🩻 J-03 해부도 포스터: 어깨 부위 관절마다 두 자리 번호 (사본은 금고·포스터 화면의 기록장에)';
    case 'poster_wall': return '🧱 포스터 뒤 벽 글씨: "금고 다이얼 — 오른쪽 → 왼쪽 → 오른쪽. 방향을 바꾸는 순간의 숫자가 입력된다."';
    case 'm_notes': return a ? '📓 해부 실습 노트: "S-B2 보관함 = 위팔두갈래근. 긴갈래 열쇠는 관절위결절, 짧은갈래 열쇠는 부리돌기에. (부리위팔근 열쇠는 그 근육이 닿는 곳에)"'
      : '📓 해부 실습 노트: "S-B2 보관함 = 위팔두갈래근(두 갈래). 긴갈래 열쇠 → 관절위결절(관절오목 바로 위의 작은 결절), 짧은갈래 열쇠 → 부리돌기(앞으로 튀어나온 갈고리)."';
    case 'm_chart': return a ? '📊 어깨 움직임 차트: 어깨세모근 앞섬유 = 빗장뼈 가쪽 1/3, 중간섬유 = 봉우리, 뒤섬유 = 어깨뼈가시에서 일어난다.'
      : '📊 어깨 움직임 차트: 어깨세모근 앞섬유 → 굽힘(팔을 앞으로), 중간섬유 → 벌림(옆으로), 뒤섬유 → 폄(뒤로).';
    case 'm_memo': return a ? '📝 메모: "S-BL 위팔근 코어 — 겉층 근육 아래. 잠금 단추 = 위팔근의 닿는곳."'
      : '📝 메모: "S-BL 위팔근 코어는 위팔두갈래근 아래(깊은 층)에 숨겼다. 잠금 단추 = 위팔근이 닿는 곳: 아래팔 안쪽 뼈(자뼈)의 거친면."';
    case 'm_manual': return a ? '🔧 팔꿈치 모형 정비 매뉴얼: "S-T3 고정핀 — 팔꿈치를 완전히 펴고, 팔꿈치를 펴는 근육의 닿는곳에 케이블. (S-BR6: 90°에서 중립 자세 굽힘근의 닿는곳)"'
      : '🔧 팔꿈치 모형 정비 매뉴얼: "S-T3 고정핀 — 팔꿈치를 완전히 편(0°) 상태에서, 팔꿈치를 펴는 근육(위팔세갈래근)의 닿는곳 = 팔꿈치 뒤쪽 끝(팔꿈치머리)에 케이블을 건다."';
    case 'safe_plate': return '🔐 금고 명판 — 순서:\n' + SAFE_ORDER.map((j, i) => `    ${i + 1}. (${SAFE_DIRS[i] === 'R' ? '오른쪽' : '왼쪽'}) ${JOINT_RIDDLE[j]}${a ? '' : ` → ${JOINT_KO[j]}`}`).join('\n');
  }
  return handClue(id) ?? hipClue(id);
}
