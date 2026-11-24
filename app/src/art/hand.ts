import Phaser from 'phaser';
import { CARPALS, HandManifest } from '../data/hand';

const BASE = 'assets/ch3/';
/** CH3 art (≈0.9 MB webp), loaded by the CH3 world scene. Keys: ch3_<file>. */
export function preloadHandArt(load: Phaser.Loader.LoaderPlugin, tex: Phaser.Textures.TextureManager) {
  const img = (k: string) => { if (!tex.exists(`ch3_${k}`)) load.image(`ch3_${k}`, `${BASE}${k}.webp`); };
  load.json('ch3_hand', BASE + 'hand.json');
  for (const k of ['hand_full', 'hand_rest', 'wrist_full', 'wrist_rest', 'wrist_carp', 'wrist_retinac', 'radul', 'retinac', 'xray_hand', 'dec_navicular', 'dec_cuboid']) img(k);
  for (const c of CARPALS) img(`car_${c}`);
  for (let i = 1; i <= 5; i++) img(`mc_${i}`);
}
export function handManifest(scene: Phaser.Scene): HandManifest { return scene.cache.json.get('ch3_hand') as HandManifest; }

/** where frame point (fx, fy) lands when the frame-sized region `r` is drawn at screen (sx, sy) with scale s */
export function frameToScreen(fx: number, fy: number, r: { x: number; y: number }, sx: number, sy: number, s: number): [number, number] {
  return [sx + (fx - r.x) * s, sy + (fy - r.y) * s];
}

/** distance (frame units) from a point to the nearest opaque sample of a layer (negative-ish = inside) */
export function layerDist(m: HandManifest, key: string, fx: number, fy: number) {
  const pts = m.mask[key]; if (!pts) return 1e9;
  let d = 1e9; for (const [x, y] of pts) { const q = Math.hypot(x - fx, y - fy); if (q < d) d = q; }
  return d;
}

/** add a cropped layer (density 2) so that it sits at its frame position, given where the frame origin is and the scale */
export function placeLayer(scene: Phaser.Scene, m: HandManifest, key: string, ox: number, oy: number, s: number, parent?: Phaser.GameObjects.Container) {
  const r = m.rects[key];
  const im = scene.add.image(ox + (r.x + r.w / 2) * s, oy + (r.y + r.h / 2) * s, `ch3_${key}`).setScale(s / 2);
  parent?.add(im);
  return im;
}
