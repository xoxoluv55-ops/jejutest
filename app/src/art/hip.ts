import Phaser from 'phaser';
import { CORES, HipManifest, HipRect, SectionManifest } from '../data/hip';

const BASE = 'assets/ch4/';
/** CH4 art (≈1.6 MB webp), loaded by the CH4 world scene. Keys: ch4_<file>. */
export function preloadHipArt(load: Phaser.Loader.LoaderPlugin, tex: Phaser.Textures.TextureManager) {
  const img = (k: string) => { if (!tex.exists(`ch4_${k}`)) load.image(`ch4_${k}`, `${BASE}${k}.webp`); };
  load.json('ch4_hip', BASE + 'hip.json'); load.json('ch4_section', BASE + 'section.json');
  for (const k of ['ant_full', 'ant_rest', 'post_full', 'post_rest', 'glut_full', 'glut_nomax', 'glut_deep', 'glut_max', 'glut_med',
    'rig_pelvis', 'rig_femur', 'rig_leg', 'aby_pelvis', 'aby_limb', 'knee_bones', 'pes_sartorius', 'pes_gracilis', 'pes_st', 'pes_sm', 'section']) img(k);
  for (const c of CORES) img(`core_${c}`);
  for (const s of ['rf', 'vl', 'vm', 'sartorius', 'al', 'ab', 'gracilis', 'bfl', 'bfs', 'st', 'sm']) img(`spec_${s}`);
}
export function hipManifest(scene: Phaser.Scene): HipManifest { return scene.cache.json.get('ch4_hip') as HipManifest; }
export function sectionManifest(scene: Phaser.Scene): SectionManifest { return scene.cache.json.get('ch4_section') as SectionManifest; }

export type Box = { q: number; bx: number; by: number; ox: number; oy: number; w: number; h: number };
/** fit a frame-unit rect into a screen box (q = screen px per frame unit; ox/oy = screen position of frame origin) */
export function fitRect(r: { x: number; y: number; w: number; h: number }, x: number, y: number, w: number, h: number): Box {
  const q = Math.min(w / r.w, h / r.h); const bx = x + (w - r.w * q) / 2, by = y + (h - r.h * q) / 2;
  return { q, bx, by, ox: bx - r.x * q, oy: by - r.y * q, w: r.w * q, h: r.h * q };
}
export function sp(b: Box, p: [number, number] | undefined) { const [fx, fy] = p ?? [0, 0]; return { x: b.ox + fx * b.q, y: b.oy + fy * b.q }; }
/** a cropped layer (rects) drawn at its true place */
export function layerAt(scene: Phaser.Scene, m: HipManifest, key: string, b: Box) {
  const r = m.rects[key];
  return scene.add.image(b.ox + (r.x + r.w / 2) * b.q, b.oy + (r.y + r.h / 2) * b.q, `ch4_${key}`).setScale(b.q / r.density);
}
/** a region image (regions: full view frames, gluteal / knee close-ups) */
export function regionAt(scene: Phaser.Scene, m: HipManifest, key: string, b: Box) {
  const r = m.regions[key];
  return scene.add.image(b.ox + r.x * b.q, b.oy + r.y * b.q, `ch4_${key}`).setOrigin(0).setScale(b.q / r.density);
}
export function region(m: HipManifest, key: string): HipRect { return m.regions[key]; }

/** decode the section label grid (RLE) once per manifest */
const gridCache = new WeakMap<SectionManifest, Int16Array>();
export function sectionLabel(s: SectionManifest, mmX: number, mmY: number): string {
  let g = gridCache.get(s);
  if (!g) { g = new Int16Array(s.grid.w * s.grid.h); let i = 0; for (const [v, n] of s.grid.rle) { g.fill(v, i, i + n); i += n; } gridCache.set(s, g); }
  const px = Math.floor(mmX * s.pxPerMm / s.grid.step), py = Math.floor(mmY * s.pxPerMm / s.grid.step);
  if (px < 0 || py < 0 || px >= s.grid.w || py >= s.grid.h) return '';
  return s.names[g[py * s.grid.w + px]] ?? '';
}

// ====================================================================== rig
type CableStyle = 'idle' | 'pull' | 'stretch' | 'hint';
/**
 * Rigid-bone test rig drawn from the model layers. 'lat': pelvis fixed, femur rotates about the measured hip centre
 * (sphere fit of the femoral head), leg (tibia + fibula + patella) about the measured knee centre (condyle sphere fits);
 * flexion is in the image plane of the lateral view. 'ant': the whole limb rotates about the hip centre (abduction).
 * Cables are the measured muscle paths (hip.json rig: origin, wrap point, insertion), each point moving with its bone.
 */
export class Rig {
  hip = 0; knee = 0; abd = 0;
  femur!: Phaser.GameObjects.Container; leg?: Phaser.GameObjects.Container;
  g: Phaser.GameObjects.Graphics;
  cables: Record<string, CableStyle> = {};
  H: { x: number; y: number }; K: { x: number; y: number };
  constructor(public scene: Phaser.Scene, public m: HipManifest, public view: 'lat' | 'ant', public b: Box, parent?: Phaser.GameObjects.Container, depth = 5) {
    const P = m.points[view];
    this.H = sp(b, P.hipC); this.K = sp(b, P.kneeC);
    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => { parent?.add(o); return o; };
    const img = (key: string, ox: number, oy: number) => {
      const r = m.rects[key];
      return scene.add.image((r.x + r.w / 2) * b.q + b.ox - ox, (r.y + r.h / 2) * b.q + b.oy - oy, `ch4_${key}`).setScale(b.q / r.density);
    };
    if (view === 'lat') {
      this.femur = add(scene.add.container(this.H.x, this.H.y).setDepth(depth));
      this.leg = scene.add.container(this.K.x - this.H.x, this.K.y - this.H.y);
      this.leg.add(img('rig_leg', this.K.x, this.K.y));
      this.femur.add(this.leg);
      this.femur.add(img('rig_femur', this.H.x, this.H.y));
      add(img('rig_pelvis', 0, 0).setDepth(depth + 1));
    } else {
      this.femur = add(scene.add.container(this.H.x, this.H.y).setDepth(depth));
      this.femur.add(img('aby_limb', this.H.x, this.H.y));
      add(img('aby_pelvis', 0, 0).setDepth(depth + 1));
    }
    this.g = add(scene.add.graphics().setDepth(depth + 3));
    this.apply();
  }
  /** screen position of a rig point that moves with segment `seg` */
  at(seg: string, fx: number, fy: number) {
    const p = sp(this.b, [fx, fy]);
    if (seg === 'pelvis') return p;
    const rot = (q: { x: number; y: number }, c: { x: number; y: number }, a: number) => { const s = Math.sin(a), co = Math.cos(a), dx = q.x - c.x, dy = q.y - c.y; return { x: c.x + dx * co - dy * s, y: c.y + dx * s + dy * co }; };
    const D = Math.PI / 180;
    if (this.view === 'ant') return rot(p, this.H, this.abd * D);
    let q = p;
    if (seg === 'leg') q = rot(q, this.K, this.knee * D);
    return rot(q, this.H, -this.hip * D);
  }
  pathLen(id: string) {
    const pts = this.m.rig[this.view][id]; if (!pts) return 0;
    let L = 0, prev: { x: number; y: number } | null = null;
    for (const [s, x, y] of pts) { const q = this.at(s, x, y); if (prev) L += Math.hypot(q.x - prev.x, q.y - prev.y); prev = q; }
    return L;
  }
  pose(hip: number, knee: number, abd = 0) { this.hip = hip; this.knee = knee; this.abd = abd; this.apply(); }
  apply() {
    const D = Math.PI / 180;
    if (this.view === 'lat') { this.femur.rotation = -this.hip * D; this.leg!.rotation = this.knee * D; }
    else this.femur.rotation = this.abd * D;
    this.draw();
  }
  draw() {
    const g = this.g; g.clear();
    for (const [id, st] of Object.entries(this.cables)) {
      const pts = (this.m.rig[this.view][id] ?? []).map(([s, x, y]) => this.at(s, x, y));
      if (pts.length < 2) continue;
      const col = st === 'pull' ? 0xff5a3c : st === 'stretch' ? 0x5fb4ff : st === 'hint' ? 0xffe066 : 0xd8c8a8;
      const w = st === 'idle' ? 4 : 6;
      if (st === 'stretch') {
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i], z = pts[i + 1], L = Math.hypot(z.x - a.x, z.y - a.y), n = Math.max(1, Math.floor(L / 12));
          g.lineStyle(w, col, 0.95);
          for (let k = 0; k < n; k += 2) { const t0 = k / n, t1 = Math.min(1, (k + 1) / n); g.lineBetween(a.x + (z.x - a.x) * t0, a.y + (z.y - a.y) * t0, a.x + (z.x - a.x) * t1, a.y + (z.y - a.y) * t1); }
        }
      } else {
        if (st === 'pull') { g.lineStyle(w + 8, col, 0.25); g.strokePoints(pts as Phaser.Types.Math.Vector2Like[]); }
        g.lineStyle(w, col, 0.95); g.strokePoints(pts as Phaser.Types.Math.Vector2Like[]);
      }
      g.fillStyle(0x1a1208, 1); g.lineStyle(2, col, 1);
      for (const p of [pts[0], pts[pts.length - 1]]) { g.fillCircle(p.x, p.y, 6); g.strokeCircle(p.x, p.y, 6); }
    }
    // joint pivots
    g.lineStyle(2, 0xffffff, 0.7); g.strokeCircle(this.H.x, this.H.y, 7);
    if (this.view === 'lat') { const k = this.at('femur', ...(this.m.points.lat.kneeC as [number, number])); g.strokeCircle(k.x, k.y, 7); }
  }
  /** animate to a pose; cables shortening on the way are drawn as pulling, lengthening as stretched */
  animate(to: { hip?: number; knee?: number; abd?: number }, dur = 1100, done?: () => void) {
    const from = { hip: this.hip, knee: this.knee, abd: this.abd };
    const tgt = { hip: to.hip ?? this.hip, knee: to.knee ?? this.knee, abd: to.abd ?? this.abd };
    const ids = Object.keys(this.cables); const L0: Record<string, number> = {};
    for (const id of ids) L0[id] = this.pathLen(id);
    const o = { t: 0 };
    this.scene.tweens.add({
      targets: o, t: 1, duration: dur, ease: 'Sine.inOut',
      onUpdate: () => {
        this.hip = from.hip + (tgt.hip - from.hip) * o.t; this.knee = from.knee + (tgt.knee - from.knee) * o.t; this.abd = from.abd + (tgt.abd - from.abd) * o.t;
        for (const id of ids) { const d = this.pathLen(id) - L0[id]; this.cables[id] = d < -1 ? 'pull' : d > 1 ? 'stretch' : this.cables[id] === 'hint' ? 'hint' : 'idle'; }
        this.apply();
      },
      onComplete: () => done?.(),
    });
  }
}
