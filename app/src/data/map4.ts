// HIP & THIGH LAB — Chapter 4 layout. New floor plan (not a copy of CH2/CH3): a west dissection room, a sealed east
// test room and two south rooms joined to each other, so the south wing is a loop.
import type { ChapterMap } from './map';

export const MAP4: ChapterMap = {
  WORLD: { x: 0, y: 200, w: 2800, h: 2300 },
  ROOMS: [
    { id: 'lift', name: '탈출 승강기', code: 'EXIT', x: 1220, y: 420, w: 280, h: 234, floor: 'floor_grate' },
    { id: 'hlab', name: '하지 근육실', code: 'H-01', x: 900, y: 800, w: 920, h: 760, floor: 'floor_lab' },
    { id: 'hglut', name: '볼기 해부실', code: 'H-02', x: 160, y: 850, w: 704, h: 710, floor: 'floor_tile' },
    { id: 'htest', name: '보행 시험실', code: 'H-03', x: 1856, y: 950, w: 784, h: 610, floor: 'floor_tile' },
    { id: 'hctl', name: '하중 제어실', code: 'H-04', x: 600, y: 1706, w: 700, h: 554, floor: 'floor_grate' },
    { id: 'hcold', name: '표본 냉장실', code: 'H-05', x: 1336, y: 1706, w: 860, h: 554, floor: 'floor_tile' },
  ],
  PASSAGES: [
    { x: 1290, y: 654, w: 140, h: 146, floor: 'floor_grate' },   // gate
    { x: 864, y: 1100, w: 36, h: 200, floor: 'floor_grate' },    // hub -> gluteal room
    { x: 1820, y: 1180, w: 36, h: 160, floor: 'floor_grate' },   // hub -> test room (sealed)
    { x: 1000, y: 1560, w: 160, h: 146, floor: 'floor_grate' },  // hub -> load control
    { x: 1560, y: 1560, w: 160, h: 146, floor: 'floor_grate' },  // hub -> cold room
    { x: 1300, y: 1900, w: 36, h: 160, floor: 'floor_grate' },   // load control <-> cold room
  ],
  HWALLS: [
    { x: 1184, y: 274, w: 352, face: true },
    { x: 864, y: 654, w: 426, face: true }, { x: 1430, y: 654, w: 426, face: true },
    { x: 124, y: 704, w: 740, face: true },
    { x: 1820, y: 804, w: 856, face: true },
    { x: 124, y: 1560, w: 440, face: false },
    { x: 564, y: 1560, w: 436, face: true }, { x: 1160, y: 1560, w: 400, face: true }, { x: 1720, y: 1560, w: 512, face: true },
    { x: 2232, y: 1560, w: 444, face: false },
    { x: 564, y: 2260, w: 1668, face: false },
  ],
  VWALLS: [
    { x: 1184, y: 274, h: 380 }, { x: 1500, y: 274, h: 380 },
    { x: 124, y: 704, h: 892 },
    { x: 864, y: 654, h: 446 }, { x: 864, y: 1300, h: 296 },     // hub west (gap 1100..1300)
    { x: 1820, y: 654, h: 526 }, { x: 1820, y: 1340, h: 256 },   // hub east (door 1180..1340)
    { x: 2640, y: 804, h: 792 },
    { x: 564, y: 1560, h: 736 }, { x: 2196, y: 1560, h: 736 },
    { x: 1300, y: 1596, h: 304 }, { x: 1300, y: 2060, h: 236 },  // south rooms (door 1900..2060)
  ],
  LIGHTS: [
    { x: 1120, y: 1020, r: 420, color: 0xffd8a8, a: 0.45, room: 'hlab' },
    { x: 1360, y: 980, r: 440, color: 0xffc890, a: 0.5, room: 'hlab' },
    { x: 1620, y: 1040, r: 400, color: 0xffd8a8, a: 0.45, flicker: true, room: 'hlab' },
    { x: 1120, y: 1400, r: 380, color: 0xe8d8ff, a: 0.4, room: 'hlab' },
    { x: 1620, y: 1400, r: 380, color: 0xe8d8ff, a: 0.4, room: 'hlab' },
    { x: 1360, y: 1240, r: 320, color: 0xffa040, a: 0.55, pulse: 1.8, room: 'hlab' },
    { x: 360, y: 1060, r: 380, color: 0xffe0c8, a: 0.5, room: 'hglut' },
    { x: 600, y: 1360, r: 360, color: 0xffb890, a: 0.45, pulse: 1.5, room: 'hglut' },
    { x: 2100, y: 1150, r: 400, color: 0xfff0c0, a: 0.5, room: 'htest' },
    { x: 2420, y: 1380, r: 360, color: 0xffc060, a: 0.5, pulse: 1.2, room: 'htest' },
    { x: 820, y: 1960, r: 360, color: 0xd7e6ff, a: 0.45, flicker: true, room: 'hctl' },
    { x: 1120, y: 2080, r: 320, color: 0xffa860, a: 0.45, pulse: 1.0, room: 'hctl' },
    { x: 1600, y: 1950, r: 380, color: 0xbfe8ff, a: 0.5, room: 'hcold' },
    { x: 1980, y: 2050, r: 360, color: 0x9fdcff, a: 0.45, flicker: true, room: 'hcold' },
    { x: 1360, y: 540, r: 300, color: 0x3dffa2, a: 0.5, pulse: 1.0, room: 'lift' },
    { x: 1236, y: 820, r: 260, color: 0xff2040, a: 0.55, emergency: true, room: 'hlab' },
    { x: 1484, y: 820, r: 260, color: 0xff2040, a: 0.55, emergency: true, room: 'hlab' },
    { x: 840, y: 1200, r: 240, color: 0xff2040, a: 0.5, emergency: true, room: 'hglut' },
    { x: 1080, y: 1740, r: 240, color: 0xff2040, a: 0.5, emergency: true, room: 'hctl' },
    { x: 1640, y: 1740, r: 240, color: 0xff2040, a: 0.5, emergency: true, room: 'hcold' },
  ],
  spawn: { x: 420, y: 1380 },
  gateX: 1360,
  lift: { x: 1360, y: 560 },
};
