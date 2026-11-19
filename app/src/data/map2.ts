// MUSCLE LINK LAB — Chapter 2 layout (same world units, wall heights and 3/4 view as Chapter 1).
import type { ChapterMap } from './map';

export const MAP2: ChapterMap = {
  WORLD: { x: 0, y: 200, w: 2800, h: 2300 },
  ROOMS: [
    { id: 'lift', name: '탈출 승강기', code: 'EXIT', x: 1220, y: 420, w: 280, h: 234, floor: 'floor_grate' },
    { id: 'mlab', name: '근육 연결실', code: 'M-01', x: 760, y: 800, w: 1200, h: 900, floor: 'floor_tile' },
    { id: 'mspec', name: '근육 표본실', code: 'M-02', x: 160, y: 850, w: 564, h: 600, floor: 'floor_lab' },
    { id: 'mmot', name: '운동 재현실', code: 'M-03', x: 1996, y: 1000, w: 644, h: 560, floor: 'floor_lab' },
    { id: 'mctl', name: '자극 제어실', code: 'M-04', x: 900, y: 1846, w: 800, h: 454, floor: 'floor_grate' },
  ],
  PASSAGES: [
    { x: 1290, y: 654, w: 140, h: 146, floor: 'floor_grate' },   // gate
    { x: 724, y: 1100, w: 36, h: 200, floor: 'floor_grate' },    // specimen room -> hub
    { x: 1960, y: 1180, w: 36, h: 160, floor: 'floor_grate' },   // hub -> motion room
    { x: 1240, y: 1700, w: 160, h: 146, floor: 'floor_grate' },  // hub -> stimulator control
  ],
  HWALLS: [
    { x: 1184, y: 274, w: 352, face: true },
    { x: 724, y: 654, w: 566, face: true }, { x: 1430, y: 654, w: 566, face: true },
    { x: 124, y: 704, w: 600, face: true }, { x: 124, y: 1450, w: 600, face: false },
    { x: 1996, y: 854, w: 680, face: true }, { x: 1996, y: 1560, w: 680, face: false },
    { x: 724, y: 1700, w: 516, face: true }, { x: 1400, y: 1700, w: 596, face: true },
    { x: 864, y: 2300, w: 872, face: false },
  ],
  VWALLS: [
    { x: 1184, y: 274, h: 380 }, { x: 1500, y: 274, h: 380 },
    { x: 724, y: 654, h: 446 }, { x: 724, y: 1300, h: 436 },     // hub west (gap 1100..1300)
    { x: 1960, y: 654, h: 526 }, { x: 1960, y: 1340, h: 396 },   // hub east (door 1180..1340)
    { x: 124, y: 704, h: 782 },
    { x: 2640, y: 854, h: 742 },
    { x: 864, y: 1700, h: 636 }, { x: 1700, y: 1700, h: 636 },
  ],
  LIGHTS: [
    { x: 1000, y: 1060, r: 420, color: 0xffc0d4, a: 0.45, room: 'mlab' },
    { x: 1360, y: 1000, r: 460, color: 0xffa8c0, a: 0.5, room: 'mlab' },
    { x: 1720, y: 1060, r: 420, color: 0xffc0d4, a: 0.45, flicker: true, room: 'mlab' },
    { x: 1000, y: 1480, r: 400, color: 0xdcd0ff, a: 0.4, room: 'mlab' },
    { x: 1720, y: 1480, r: 400, color: 0xdcd0ff, a: 0.4, room: 'mlab' },
    { x: 1360, y: 1240, r: 330, color: 0xff5c84, a: 0.55, pulse: 2.0, room: 'mlab' },
    { x: 330, y: 1060, r: 380, color: 0xffd8e2, a: 0.5, room: 'mspec' },
    { x: 560, y: 1290, r: 360, color: 0xff9fb6, a: 0.45, pulse: 1.6, room: 'mspec' },
    { x: 2220, y: 1180, r: 400, color: 0xffd0dc, a: 0.5, room: 'mmot' },
    { x: 2480, y: 1400, r: 360, color: 0xff7aa0, a: 0.5, pulse: 1.3, room: 'mmot' },
    { x: 1100, y: 2060, r: 380, color: 0xd7e6ff, a: 0.45, flicker: true, room: 'mctl' },
    { x: 1500, y: 2040, r: 380, color: 0xffa860, a: 0.5, pulse: 1.0, room: 'mctl' },
    { x: 1360, y: 540, r: 300, color: 0x3dffa2, a: 0.5, pulse: 1.0, room: 'lift' },
    { x: 1236, y: 820, r: 260, color: 0xff2040, a: 0.55, emergency: true, room: 'mlab' },
    { x: 1484, y: 820, r: 260, color: 0xff2040, a: 0.55, emergency: true, room: 'mlab' },
    { x: 700, y: 1200, r: 240, color: 0xff2040, a: 0.5, emergency: true, room: 'mspec' },
    { x: 1320, y: 1880, r: 240, color: 0xff2040, a: 0.5, emergency: true, room: 'mctl' },
  ],
  spawn: { x: 330, y: 1330 },
  gateX: 1360,
  lift: { x: 1360, y: 560 },
};
