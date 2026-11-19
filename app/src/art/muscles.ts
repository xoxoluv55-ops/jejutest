import Phaser from 'phaser';
import type { MuscleId } from '../data/muscles';
import { DENSITY } from './bones';

/**
 * CH2 muscle art.
 *
 * Every muscle that exists in the BodyParts3D model (© DBCLS, CC BY 4.0) is a pre-rendered layer made from the real
 * 3D meshes (tools/anatomy3d): same frame as the plate (760×1260 logical units, right upper limb, anterior view,
 * lateral = viewer's left), density 2. Layers: `mus_real_<id>` (natural) and `mus_glow_<id>` (highlight).
 *
 * Latissimus dorsi is NOT part of BodyParts3D 4.0, so it alone is drawn as a clearly-marked schematic.
 */
/** Attribution required by CC BY 4.0 — shown wherever model renders appear. */
export const MODEL_CREDIT = '3D 해부 모델: BodyParts3D © DBCLS (CC BY 4.0)';

export const MODEL_MUSCLES: MuscleId[] = ['deltoid', 'pecmajor', 'biceps', 'brachialis', 'coracobrachialis', 'brachioradialis', 'triceps', 'supraspinatus'];
export const hasModel = (id: MuscleId) => MODEL_MUSCLES.includes(id);
const BASE = 'assets/ch2/';

export interface Rect { x: number; y: number; w: number; h: number }
export interface PlateManifest { frame: [number, number]; density: number; layers: Record<string, Rect>; labels: Record<string, { x: number; y: number; visible: number } | null> }

/** Called from Boot: the anatomy plates and per-muscle layers (~1.2 MB webp). */
export function preloadMuscleArt(load: Phaser.Loader.LoaderPlugin) {
  load.json('ch2_plates', BASE + 'plates.json');
  load.image('ch2_plate_full', BASE + 'plate_full.webp');
  load.image('ch2_plate_bones', BASE + 'plate_bones.webp');
  for (const id of MODEL_MUSCLES) {
    load.image(`mus_real_${id}`, `${BASE}mus_real_${id}.webp`);
    load.image(`mus_glow_${id}`, `${BASE}mus_glow_${id}.webp`);
  }
}

export function plateManifest(scene: Phaser.Scene): PlateManifest { return scene.cache.json.get('ch2_plates') as PlateManifest; }

/** Plate textures (frame-sized, density 2). 'full' = model with every muscle, 'bones' = skeleton only. */
export function plateKey(which: 'full' | 'bones') { return which === 'full' ? 'ch2_plate_full' : 'ch2_plate_bones'; }

/** A point inside the visible part of the muscle on the full plate (for numbered markers). */
export function labelPoint(scene: Phaser.Scene, id: MuscleId): [number, number] {
  const l = plateManifest(scene)?.labels[id];
  if (l) return [l.x, l.y];
  const s = SCHEMATIC[id]; return s ? s.label : [380, 400];
}

export type MuscleStyle = 'real' | 'ghost' | 'glow';

/** Texture for one muscle, cropped to its bounds, with its rect in frame coordinates. */
export function makeMuscleTexture(scene: Phaser.Scene, id: MuscleId, style: MuscleStyle = 'real'): { key: string; schematic: boolean } & Rect {
  if (hasModel(id)) {
    const r = plateManifest(scene).layers[id];
    return { key: style === 'glow' ? `mus_glow_${id}` : `mus_real_${id}`, schematic: false, ...r };
  }
  return { ...schematicTexture(scene, id, style), schematic: true };
}

// ---------------- schematic fallback (latissimus dorsi only: not in the 3D model) ----------------
export type Pt = [number, number];

export function smoothLine(pts: Pt[], n = 8): Pt[] {
  if (pts.length < 3) return pts;
  const out: Pt[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

function spindle(center: Pt[], widths: number[], n = 8): Pt[] {
  const c = smoothLine(center, n);
  const w = smoothLine(widths.map((v, i) => [i, v] as Pt), n).map(p => p[1]);
  const L: Pt[] = [], R: Pt[] = [];
  for (let i = 0; i < c.length; i++) {
    const a = c[Math.max(0, i - 1)], b = c[Math.min(c.length - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const h = Math.max(0.5, w[i] / 2);
    L.push([c[i][0] - dy * h, c[i][1] + dx * h]); R.push([c[i][0] + dy * h, c[i][1] - dx * h]);
  }
  return [...L, ...R.reverse()];
}

interface SPart { kind: 'belly' | 'tendon'; center: Pt[]; widths: number[] }
// Latissimus dorsi (posterior): thoracolumbar origin -> floor of the intertubercular groove (334,287 = midpoint of the
// measured pectoralis major and teres major insertions on the model humerus).
const SCHEMATIC: Partial<Record<MuscleId, { parts: SPart[]; label: Pt }>> = {
  latissimus: {
    parts: [
      { kind: 'belly', center: [[610, 830], [530, 650], [440, 470], [372, 340]], widths: [130, 110, 66, 26] },
      { kind: 'tendon', center: [[374, 344], [350, 306], [334, 287]], widths: [20, 14, 10] },
    ],
    label: [520, 640],
  },
};

function schematicTexture(scene: Phaser.Scene, id: MuscleId, style: MuscleStyle) {
  const sh = SCHEMATIC[id]!;
  const polys = sh.parts.map(p => ({ kind: p.kind, pts: spindle(p.center, p.widths) }));
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const p of polys) for (const [x, y] of p.pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const pad = 8; const r = { x: Math.floor(x0 - pad), y: Math.floor(y0 - pad), w: Math.ceil(x1 - x0 + pad * 2), h: Math.ceil(y1 - y0 + pad * 2) };
  const key = `mus_schem_${style}_${id}`;
  if (!scene.textures.exists(key)) {
    const c = document.createElement('canvas'); c.width = r.w * DENSITY; c.height = r.h * DENSITY;
    const ctx = c.getContext('2d')!; ctx.scale(DENSITY, DENSITY); ctx.translate(-r.x, -r.y);
    for (const p of polys) {
      const path = new Path2D(); path.moveTo(p.pts[0][0], p.pts[0][1]); for (const [x, y] of p.pts.slice(1)) path.lineTo(x, y); path.closePath();
      ctx.setLineDash([7, 6]); ctx.lineWidth = 2;
      ctx.strokeStyle = style === 'glow' ? 'rgba(255,170,195,0.95)' : p.kind === 'tendon' ? 'rgba(255,220,200,0.7)' : 'rgba(255,120,140,0.8)';
      ctx.fillStyle = style === 'glow' ? 'rgba(255,92,132,0.35)' : p.kind === 'tendon' ? 'rgba(255,230,210,0.10)' : 'rgba(255,90,120,0.14)';
      ctx.fill(path); ctx.stroke(path); ctx.setLineDash([]);
    }
    scene.textures.addCanvas(key, c);
  }
  return { key, ...r };
}
