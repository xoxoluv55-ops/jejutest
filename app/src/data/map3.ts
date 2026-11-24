// WRIST & JOINT LAB — Chapter 3 layout: the Chapter 2 wing mirrored east-west (same wall/door rules), new rooms.
import type { ChapterMap } from './map';
import { MAP2 } from './map2';
import { WALL_CAP } from './map';

const W = 2800;
const NAMES: Record<string, { id: string; name: string; code: string; floor: 'floor_lab' | 'floor_grate' | 'floor_tile' }> = {
  lift: { id: 'lift', name: '탈출 승강기', code: 'EXIT', floor: 'floor_grate' },
  mlab: { id: 'jlab', name: '관절 연구실', code: 'J-01', floor: 'floor_lab' },
  mspec: { id: 'jspec', name: '손목 표본실', code: 'J-02', floor: 'floor_tile' },
  mmot: { id: 'jtest', name: '관절 시험실', code: 'J-03', floor: 'floor_tile' },
  mctl: { id: 'jctl', name: '유압 제어실', code: 'J-04', floor: 'floor_grate' },
};
const LIGHT_COL: Record<string, number> = { mlab: 0xbfe8ff, mspec: 0xd8f4ff, mmot: 0xffe2b0, mctl: 0xffc070, lift: 0x3dffa2 };

export const MAP3: ChapterMap = {
  WORLD: MAP2.WORLD,
  ROOMS: MAP2.ROOMS.map(r => ({ ...r, ...NAMES[r.id], x: W - r.x - r.w })),
  PASSAGES: MAP2.PASSAGES.map(p => ({ ...p, x: W - p.x - p.w })),
  HWALLS: MAP2.HWALLS.map(h => ({ ...h, x: W - h.x - h.w })),
  VWALLS: MAP2.VWALLS.map(v => ({ ...v, x: W - v.x - WALL_CAP })),
  LIGHTS: MAP2.LIGHTS.map(l => ({ ...l, x: W - l.x, color: l.emergency ? l.color : (LIGHT_COL[l.room ?? ''] ?? l.color), room: NAMES[l.room ?? '']?.id ?? l.room })),
  spawn: { x: W - MAP2.spawn.x, y: MAP2.spawn.y },
  gateX: W - MAP2.gateX,
  lift: { x: W - MAP2.lift.x, y: MAP2.lift.y },
};
