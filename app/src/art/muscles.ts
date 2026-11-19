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
 * Latissimus dorsi is not in BodyParts3D 4.0; its mesh comes from BodyParts3D 3.0 (same source body, registered onto
 * the 4.0 skeleton, tools/anatomy3d/latissimus.py) and is licensed CC BY-SA 2.1 JP, so its images are separate files
 * (`mus_*_latissimus`, `mus_vis_latissimus`, motion `shoulder_l*`) with their own credit (LAT_CREDIT).
 */
/** Attribution required by CC BY 4.0 — shown wherever model renders appear. */
export const MODEL_CREDIT = '3D 해부 모델: BodyParts3D © DBCLS (CC BY 4.0)';
export const LAT_CREDIT = '넓은등근: BodyParts3D 3.0 © DBCLS (CC BY-SA 2.1 JP)';

export const MODEL_MUSCLES: MuscleId[] = ['deltoid', 'pecmajor', 'biceps', 'brachialis', 'coracobrachialis', 'brachioradialis', 'triceps', 'supraspinatus', 'latissimus'];
export const hasModel = (id: MuscleId) => MODEL_MUSCLES.includes(id);
const BASE = 'assets/ch2/';

export interface Rect { x: number; y: number; w: number; h: number }
export interface PlateManifest { frame: [number, number]; density: number; layers: Record<string, Rect>; overlays?: Record<string, Rect>; labels: Record<string, { x: number; y: number; visible: number } | null> }

/** Called from Boot: the anatomy plates and per-muscle layers (~1.2 MB webp). */
export function preloadMuscleArt(load: Phaser.Loader.LoaderPlugin) {
  load.json('ch2_plates', BASE + 'plates.json');
  load.image('ch2_plate_full', BASE + 'plate_full.webp');
  load.image('ch2_plate_bones', BASE + 'plate_bones.webp');
  for (const id of MODEL_MUSCLES) {
    load.image(`mus_real_${id}`, `${BASE}mus_real_${id}.webp`);
    load.image(`mus_glow_${id}`, `${BASE}mus_glow_${id}.webp`);
  }
  load.image('mus_vis_latissimus', BASE + 'mus_vis_latissimus.webp');   // part of the latissimus visible on the anterior plate
}

export function plateManifest(scene: Phaser.Scene): PlateManifest { return scene.cache.json.get('ch2_plates') as PlateManifest; }

/** Plate textures (frame-sized, density 2). 'full' = model with every muscle, 'bones' = skeleton only. */
export function plateKey(which: 'full' | 'bones') { return which === 'full' ? 'ch2_plate_full' : 'ch2_plate_bones'; }

/** A point inside the visible part of the muscle on the full plate (for numbered markers). */
export function labelPoint(scene: Phaser.Scene, id: MuscleId): [number, number] {
  const l = plateManifest(scene)?.labels[id];
  return l ? [l.x, l.y] : [380, 400];
}

export type MuscleStyle = 'real' | 'ghost' | 'glow';

/** Texture for one muscle, cropped to its bounds, with its rect in frame coordinates and its licence credit. */
export function makeMuscleTexture(scene: Phaser.Scene, id: MuscleId, style: MuscleStyle = 'real'): { key: string; credit: string } & Rect {
  const r = plateManifest(scene).layers[id];
  return { key: style === 'glow' ? `mus_glow_${id}` : `mus_real_${id}`, credit: creditFor(id), ...r };
}
export function creditFor(id: MuscleId) { return id === 'latissimus' ? LAT_CREDIT : MODEL_CREDIT; }

/** Adds the latissimus "visible part" overlay on top of a full-plate image placed at (fx, fy) with scale s. */
export function addPlateOverlays(scene: Phaser.Scene, fx: number, fy: number, s: number, depth = 0) {
  const o = plateManifest(scene).overlays?.latissimus;
  if (!o || !scene.textures.exists('mus_vis_latissimus')) return [];
  return [scene.add.image(fx + o.x * s, fy + o.y * s, 'mus_vis_latissimus').setOrigin(0).setScale(s / DENSITY).setDepth(depth)];
}
