// CH1 exploration zone (v0.5): where each bone is and how it is obtained, guard patrols, lasers, crates, checkpoints.
// World units (see map.ts). Rooms: B-02 corridor (start), V-05 specimen vault (stealth), S-07 storage (keycard),
// L-06 laser corridor (lasers + alarm escape), A-01 hub, J-03 joint bay, X-04 x-ray room.
import type { BoneId } from './anatomy';
import type { GuardCfg, LaserCfg, V2 } from '../game/Stealth';
import type { Difficulty } from '../game/state';

/** How a bone is obtained. */
export type Getter =
  | 'scan'      // hidden locker, only visible after a SCAN pulse (B-02)
  | 'stealth'   // specimen capsule inside the guarded vault (V-05)
  | 'keycard'   // behind the S-07 door; the keycard lies in the vault
  | 'laser'     // inside the laser corridor (L-06)
  | 'alarm';    // taking it trips the alarm: leave L-06 before the shutter closes

export const BONE_GET: Record<BoneId, { x: number; y: number; get: Getter }> = {
  scapula: { x: 420, y: 1262, get: 'scan' },
  humerus: { x: 440, y: 560, get: 'stealth' },
  radius: { x: 650, y: 2090, get: 'keycard' },
  fibula: { x: 790, y: 2230, get: 'keycard' },     // advanced only (decoy leg bone)
  clavicle: { x: 2150, y: 2075, get: 'laser' },
  ulna: { x: 2560, y: 2075, get: 'alarm' },
};

export const KEYCARD_AT: V2 = { x: 660, y: 640 };
export const KEY_DOOR = { x: 864, y: 2080, w: 36, h: 140, panel: { x: 935, y: 2150 } };
export const GALLERY_EXIT_X = 1700;   // west wall of L-06: x < this = out of the corridor

export interface DiffCfg {
  guardSpeed: number; guardChase: number; range: number; fov: number; susRate: number;
  laserMul: number; alarmTime: number; finalTime: number; crates: number; hints: boolean;
  /** v0.5.1 tuning (played on iPad: too hard) */
  laserHit: number;      // beam hit half-width (world units)
  alertDelay: number;    // "!" pause before a drone starts chasing (reaction time)
  catchStun: number;     // drone pauses this long after catching you (time to get away)
  susDecay: number;      // suspicion drain per second out of sight
  hazardScale: number;   // spark / steam damage radius multiplier
}
export const DIFF: Record<Difficulty, DiffCfg> = {
  // v0.5.1: much easier — slower/shorter-sighted drones, slow lasers with a thinner hit zone, long timers
  basic: { guardSpeed: 58, guardChase: 115, range: 185, fov: 56, susRate: 0.5, laserMul: 0.5, alarmTime: 45, finalTime: 130, crates: 5, hints: true,
    laserHit: 10, alertDelay: 1.0, catchStun: 3.0, susDecay: 0.8, hazardScale: 0.7 },
  adv: { guardSpeed: 82, guardChase: 160, range: 245, fov: 68, susRate: 0.95, laserMul: 0.85, alarmTime: 28, finalTime: 80, crates: 4, hints: false,
    laserHit: 12, alertDelay: 0.7, catchStun: 2.2, susDecay: 0.6, hazardScale: 0.85 },
};

export function vaultGuards(d: Difficulty): Omit<GuardCfg, 'speed' | 'chase' | 'range' | 'fov' | 'susRate'>[] {
  const g: Omit<GuardCfg, 'speed' | 'chase' | 'range' | 'fov' | 'susRate'>[] = [
    // loop between the rack row and the crate rows
    { name: 'SEC-07', path: [{ x: 230, y: 630 }, { x: 650, y: 630 }, { x: 650, y: 800 }, { x: 230, y: 800 }], wait: 1.1 },
  ];
  if (d === 'adv') g.push({ name: 'SEC-09', path: [{ x: 380, y: 1050 }, { x: 380, y: 820 }, { x: 560, y: 820 }, { x: 560, y: 1050 }], wait: 0.7 });
  return g;
}
/** advanced only: a drone sweeping the hub during the final escape */
export const FINAL_GUARD = { name: 'SEC-11', path: [{ x: 1000, y: 1160 }, { x: 1720, y: 1160 }], wait: 0.8 };

export const GALLERY_LASERS: LaserCfg[] = [
  { kind: 'blink', a: { x: 1830, y: 1852 }, b: { x: 1830, y: 2296 }, period: 3.4, on: 1.5, phase: 0.4, group: 'gallery' },
  { kind: 'sweepY', a: { x: 1900, y: 2075 }, b: { x: 2066, y: 2075 }, amp: 190, period: 3.4, group: 'gallery' },
  { kind: 'sweepX', a: { x: 2250, y: 1852 }, b: { x: 2250, y: 2296 }, amp: 60, period: 2.8, group: 'gallery' },
  { kind: 'sweepX', a: { x: 2390, y: 1852 }, b: { x: 2390, y: 2296 }, amp: 60, period: 2.8, phase: 1.4, group: 'gallery' },
  { kind: 'blink', a: { x: 2460, y: 1960 }, b: { x: 2636, y: 1960 }, period: 2.8, on: 1.2, group: 'gallery' },
  { kind: 'blink', a: { x: 2460, y: 2190 }, b: { x: 2636, y: 2190 }, period: 2.8, on: 1.2, phase: 1.4, group: 'gallery' },
];
/** switched on when the ulna is taken (shutter laser at the exit) */
export const ALARM_LASERS: LaserCfg[] = [
  { kind: 'blink', a: { x: 1770, y: 1852 }, b: { x: 1770, y: 2296 }, period: 2.2, on: 0.9, group: 'alarm' },
];
/** switched on for the final escape (hub, in front of the gate) */
export const FINAL_LASERS: LaserCfg[] = [
  { kind: 'blink', a: { x: 1180, y: 990 }, b: { x: 1540, y: 990 }, period: 2.6, on: 1.2, group: 'final' },
  { kind: 'blink', a: { x: 1180, y: 1130 }, b: { x: 1540, y: 1130 }, period: 2.6, on: 1.2, phase: 1.3, group: 'final' },
];

export const CHECKPOINTS: { id: string; x: number; y: number; name: string }[] = [
  { id: 'b02', x: 300, y: 1440, name: '격리 통로 B-02' },
  { id: 'a01', x: 1360, y: 1520, name: '뼈대 복구실 A-01' },
  { id: 'j03', x: 1300, y: 1960, name: '관절 보정실 J-03' },
  { id: 'x04', x: 2090, y: 1070, name: '영상 판독실 X-04' },
];

export const CRATE_SPOTS: V2[] = [
  { x: 250, y: 1060 },   // vault (SW corner)
  { x: 1560, y: 2240 },  // J-03
  { x: 800, y: 1630 },   // A-01 (SW)
  { x: 640, y: 1480 },   // B-02
  { x: 2450, y: 1220 },  // X-04
];

/** lockers you can hide in (guards cannot see you inside unless they saw you get in) */
export const HIDE_SPOTS: V2[] = [{ x: 190, y: 720 }, { x: 690, y: 1010 }, { x: 1900, y: 1300 }];

/** Short anatomy line shown when a bone is recovered (basic shows the hint, advanced only the name). */
export const PICKUP_HINT: Record<BoneId, string> = {
  scapula: '팔이음뼈 — 등 위쪽의 납작한 삼각형 뼈. 관절오목이 위팔뼈머리를 받는다.',
  clavicle: '팔이음뼈 — 몸통 뼈대와 팔을 잇는 유일한 뼈(복장빗장관절).',
  humerus: '자유팔뼈 — 위팔의 긴뼈. 위쪽 머리는 어깨뼈와, 아래쪽은 노뼈·자뼈와 관절.',
  radius: '자유팔뼈 — 아래팔의 가쪽(엄지 쪽) 뼈. 먼쪽 끝이 넓다.',
  ulna: '자유팔뼈 — 아래팔의 안쪽(새끼 쪽) 뼈. 몸쪽 끝의 팔꿈치머리가 크다.',
  fibula: '다리의 뼈(종아리뼈) — 팔뼈대가 아니다. 노뼈·자뼈와 구별할 것.',
};
