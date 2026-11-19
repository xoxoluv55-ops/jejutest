// BODY LAB — Chapter 1 layout (world units). 3/4 top-down: horizontal walls show a cap + a front face.
export const WALL_CAP = 36;
export const WALL_FACE = 110;
export const WORLD = { x: 0, y: 200, w: 2800, h: 2300 };

export interface Room { id: string; name: string; code: string; x: number; y: number; w: number; h: number; floor: 'floor_lab' | 'floor_grate' | 'floor_tile'; }
export const ROOMS: Room[] = [
  { id: 'lift', name: '탈출 승강기', code: 'EXIT', x: 1220, y: 420, w: 280, h: 234, floor: 'floor_grate' },
  { id: 'lab', name: '골격 복구실', code: 'A-01', x: 760, y: 800, w: 1200, h: 900, floor: 'floor_lab' },
  { id: 'corr', name: '격리 통로', code: 'B-02', x: 160, y: 1250, w: 600, h: 300, floor: 'floor_grate' },
  { id: 'joint', name: '관절 보정실', code: 'J-03', x: 900, y: 1846, w: 800, h: 454, floor: 'floor_tile' },
  { id: 'xray', name: '영상 판독실', code: 'X-04', x: 1996, y: 800, w: 644, h: 500, floor: 'floor_tile' },
];
// connecting floor strips through doorways
export const PASSAGES = [
  { x: 1290, y: 654, w: 140, h: 146, floor: 'floor_grate' as const },  // gate
  { x: 724, y: 1250, w: 36, h: 300, floor: 'floor_grate' as const },   // corridor -> lab
  { x: 1240, y: 1700, w: 160, h: 146, floor: 'floor_grate' as const }, // lab -> joint bay
  { x: 1960, y: 980, w: 36, h: 160, floor: 'floor_grate' as const },   // lab -> x-ray
];

/** Horizontal wall: cap at y..y+CAP, optional face below it. */
export interface HWall { x: number; y: number; w: number; face: boolean; }
/** Vertical wall: cap strip x..x+CAP, y..y+h. */
export interface VWall { x: number; y: number; h: number; }

export const HWALLS: HWall[] = [
  // lift
  { x: 1184, y: 274, w: 352, face: true },
  // lab north (gate gap 1290..1430)
  { x: 724, y: 654, w: 566, face: true }, { x: 1430, y: 654, w: 566, face: true },
  // x-ray north
  { x: 1996, y: 654, w: 680, face: true },
  // x-ray south (void below)
  { x: 1996, y: 1300, w: 680, face: false },
  // corridor north + south
  { x: 124, y: 1104, w: 600, face: true }, { x: 124, y: 1550, w: 600, face: false },
  // lab south (door gap 1240..1400)
  { x: 724, y: 1700, w: 516, face: true }, { x: 1400, y: 1700, w: 596, face: true },
  // joint bay south
  { x: 864, y: 2300, w: 872, face: false },
];
export const VWALLS: VWall[] = [
  { x: 1184, y: 274, h: 380 }, { x: 1500, y: 274, h: 380 },
  { x: 724, y: 654, h: 596 }, { x: 724, y: 1550, h: 186 },     // lab west (gap 1250..1550)
  { x: 1960, y: 654, h: 326 }, { x: 1960, y: 1140, h: 596 },   // lab east (door gap 980..1140)
  { x: 2640, y: 654, h: 682 },
  { x: 124, y: 1104, h: 482 },
  { x: 864, y: 1700, h: 636 }, { x: 1700, y: 1700, h: 636 },
];

export interface LightDef { x: number; y: number; r: number; color: number; a: number; flicker?: boolean; pulse?: number; emergency?: boolean; room: string; }
export const LIGHTS: LightDef[] = [
  { x: 1000, y: 1060, r: 420, color: 0x9fd2ff, a: 0.5, room: 'lab' },
  { x: 1360, y: 1000, r: 460, color: 0x7fd0ff, a: 0.5, room: 'lab' },
  { x: 1720, y: 1060, r: 420, color: 0x9fd2ff, a: 0.5, flicker: true, room: 'lab' },
  { x: 1000, y: 1480, r: 400, color: 0x9fd2ff, a: 0.45, room: 'lab' },
  { x: 1720, y: 1480, r: 400, color: 0x9fd2ff, a: 0.45, room: 'lab' },
  { x: 1360, y: 1200, r: 320, color: 0x3fd4ff, a: 0.6, pulse: 2.2, room: 'lab' },
  { x: 300, y: 1400, r: 360, color: 0xbfd8ff, a: 0.45, flicker: true, room: 'corr' },
  { x: 620, y: 1400, r: 320, color: 0xbfd8ff, a: 0.4, room: 'corr' },
  { x: 1500, y: 2020, r: 380, color: 0xb07bff, a: 0.55, pulse: 1.4, room: 'joint' },
  { x: 1100, y: 2060, r: 380, color: 0xd7e6ff, a: 0.45, flicker: true, room: 'joint' },
  { x: 2320, y: 960, r: 420, color: 0xcfe6ff, a: 0.55, room: 'xray' },
  { x: 2300, y: 1180, r: 320, color: 0x9fd2ff, a: 0.35, room: 'xray' },
  { x: 1360, y: 540, r: 300, color: 0x3dffa2, a: 0.5, pulse: 1.0, room: 'lift' },
  // emergency beacons (stay on during blackout)
  { x: 1236, y: 820, r: 260, color: 0xff2040, a: 0.55, emergency: true, room: 'lab' },
  { x: 1484, y: 820, r: 260, color: 0xff2040, a: 0.55, emergency: true, room: 'lab' },
  { x: 760, y: 1400, r: 240, color: 0xff2040, a: 0.5, emergency: true, room: 'corr' },
  { x: 1320, y: 1880, r: 240, color: 0xff2040, a: 0.5, emergency: true, room: 'joint' },
];

export interface ChapterMap {
  WORLD: { x: number; y: number; w: number; h: number };
  ROOMS: Room[]; PASSAGES: { x: number; y: number; w: number; h: number; floor: Room['floor'] }[];
  HWALLS: HWall[]; VWALLS: VWall[]; LIGHTS: LightDef[];
  spawn: { x: number; y: number };
  gateX: number;                    // exit gate centre on the hub north wall (y = 654)
  lift: { x: number; y: number };   // lift trigger
}
export const MAP1: ChapterMap = { WORLD, ROOMS, PASSAGES, HWALLS, VWALLS, LIGHTS, spawn: { x: 300, y: 1420 }, gateX: 1360, lift: { x: 1360, y: 560 } };
