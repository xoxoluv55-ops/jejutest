import Phaser from 'phaser';
import { CORES, NerveManifest, Scan5 } from '../data/nerve';
import type { Box } from './hip';
export { fitRect, sp } from './hip';
export type { Box } from './hip';

const BASE = 'assets/ch5/';
/** CH5 art (Z-Anatomy renders), loaded by the CH5 world scene. Keys: ch5_<file>. */
export function preloadNerveArt(load: Phaser.Loader.LoaderPlugin, tex: Phaser.Textures.TextureManager) {
  const img = (k: string) => { if (!tex.exists(`ch5_${k}`)) load.image(`ch5_${k}`, `${BASE}${k}.webp`); };
  if (!load.cacheManager.json.exists('ch5_nerve')) load.json('ch5_nerve', BASE + 'nerve.json');
  if (!load.cacheManager.json.exists('ch5_scan')) load.json('ch5_scan', BASE + 'scan.json');
  for (const v of ['aant', 'apost', 'lant', 'lpost']) { img(`${v}_full`); img(`${v}_rest`); }
  for (const k of ['hum', 'hand', 'knee', 'elbow', 'pknee']) img(`${k}_close`);
  for (const c of CORES) img(`core_${c}`);
  for (const k of ['musculocutaneous', 'median', 'ulnar', 'radial', 'axillary', 'plexus']) img(`vis_aant_${k}`);
  for (const k of ['femoral', 'obturator', 'fibular']) img(`vis_lant_${k}`);
  for (const k of ['sciatic', 'tibial', 'fibular']) img(`vis_lpost_${k}`);
}
export function nerveManifest(scene: Phaser.Scene): NerveManifest { return scene.cache.json.get('ch5_nerve') as NerveManifest; }
export function scan5(scene: Phaser.Scene): Scan5 { return scene.cache.json.get('ch5_scan') as Scan5; }

const gridCache = new WeakMap<object, Int16Array>();
/** visible nerve at frame point (fx, fy) of a scanner plate ('' = none) */
export function scanNerve(s: Scan5, view: string, fx: number, fy: number): string {
  const v = s.views[view]; if (!v) return '';
  let g = gridCache.get(v);
  if (!g) { g = new Int16Array(v.grid.w * v.grid.h); let i = 0; for (const [val, n] of v.grid.rle) { g.fill(val, i, i + n); i += n; } gridCache.set(v, g); }
  const px = Math.floor(fx / v.grid.step), py = Math.floor(fy / v.grid.step);
  if (px < 0 || py < 0 || px >= v.grid.w || py >= v.grid.h) return '';
  return v.names[g[py * v.grid.w + px]] ?? '';
}
/** nearest visible nerve within r frame units (finger-friendly) */
export function scanNear(s: Scan5, view: string, fx: number, fy: number, r = 6): string {
  const c = scanNerve(s, view, fx, fy); if (c) return c;
  for (let d = 2; d <= r; d += 2) for (let a = 0; a < 8; a++) {
    const n = scanNerve(s, view, fx + Math.cos(a * Math.PI / 4) * d, fy + Math.sin(a * Math.PI / 4) * d); if (n) return n;
  }
  return '';
}
/** a cropped layer (rects: cores) drawn at its true place */
export function layerAt5(scene: Phaser.Scene, m: NerveManifest, key: string, b: Box) {
  const r = m.rects[key];
  return scene.add.image(b.ox + (r.x + r.w / 2) * b.q, b.oy + (r.y + r.h / 2) * b.q, `ch5_${key}`).setScale(b.q / r.density);
}
/** a region image (full plates / close-ups) at its frame position */
export function regionAt5(scene: Phaser.Scene, m: NerveManifest, key: string, b: Box) {
  const r = m.regions[key];
  return scene.add.image(b.ox + r.x * b.q, b.oy + r.y * b.q, `ch5_${key}`).setOrigin(0).setScale(b.q / r.density);
}
