import Phaser from 'phaser';
import type { MuscleId } from '../data/muscles';
import { FRAME, UPPER_ORDER } from '../data/anatomy';
import { DENSITY, drawBone, drawTorsoHolo } from './bones';

export type Pt = [number, number];

/** Catmull-Rom densified polyline. */
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

/** Closed spindle polygon around a centre line with a width per control point (fusiform muscle belly). */
export function spindle(center: Pt[], widths: number[], n = 8): Pt[] {
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

export interface Part { kind: 'belly' | 'tendon'; center?: Pt[]; widths?: number[]; poly?: Pt[] }
export interface Shape { parts: Part[]; converge?: Pt; label: Pt }

/** Anterior-view shapes (frame coordinates). Fibre direction: along the centre line, or converging on `converge`. */
export const SHAPES: Record<MuscleId, Shape> = {
  deltoid: {
    parts: [{ kind: 'belly', poly: smoothLine([[418, 156], [372, 140], [330, 132], [290, 150], [258, 190], [240, 240], [238, 300], [246, 360], [256, 410], [266, 452], [282, 418], [296, 370], [306, 322], [324, 276], [352, 228], [386, 188], [418, 156]], 4) }],
    converge: [266, 460], label: [280, 290],
  },
  pecmajor: {
    parts: [{ kind: 'belly', poly: smoothLine([[614, 170], [560, 172], [500, 170], [440, 176], [404, 194], [360, 246], [324, 300], [300, 336], [322, 352], [364, 362], [424, 394], [500, 438], [580, 452], [640, 446], [648, 320], [640, 200], [614, 170]], 4) }],
    converge: [298, 340], label: [520, 320],
  },
  coracobrachialis: {
    parts: [{ kind: 'belly', center: [[372, 192], [368, 300], [352, 400], [318, 470]], widths: [10, 30, 30, 8] }],
    label: [358, 392],
  },
  biceps: {
    parts: [
      { kind: 'tendon', center: [[344, 230], [318, 262], [302, 300], [312, 334]], widths: [6, 6, 6, 8] },          // long head tendon (groove)
      { kind: 'belly', center: [[370, 194], [354, 262], [332, 336]], widths: [8, 18, 26] },                          // short head
      { kind: 'belly', center: [[318, 320], [312, 420], [300, 540], [290, 660], [282, 722]], widths: [22, 48, 54, 40, 14] },
      { kind: 'tendon', center: [[282, 716], [272, 772], [260, 826]], widths: [12, 11, 10] },                       // to radial tuberosity
      { kind: 'tendon', center: [[288, 742], [322, 770], [354, 792]], widths: [7, 7, 5] },                          // bicipital aponeurosis
    ],
    label: [300, 540],
  },
  brachialis: {
    parts: [{ kind: 'belly', center: [[290, 500], [288, 600], [294, 700], [302, 790]], widths: [30, 82, 74, 22] }],
    label: [340, 652],
  },
  brachioradialis: {
    parts: [
      { kind: 'belly', center: [[236, 600], [226, 700], [228, 820], [226, 940]], widths: [18, 46, 40, 12] },
      { kind: 'tendon', center: [[226, 930], [222, 1040], [216, 1146]], widths: [10, 9, 8] },
    ],
    label: [222, 790],
  },
  triceps: {
    parts: [
      { kind: 'belly', center: [[354, 304], [348, 420], [338, 560], [328, 680]], widths: [12, 40, 46, 30] },
      { kind: 'tendon', center: [[328, 676], [326, 712], [324, 746]], widths: [24, 18, 12] },
    ],
    label: [346, 500],
  },
  supraspinatus: {
    parts: [
      { kind: 'belly', center: [[482, 188], [430, 188], [360, 196]], widths: [44, 40, 26] },
      { kind: 'tendon', center: [[364, 196], [310, 210], [266, 244]], widths: [16, 12, 10] },
    ],
    label: [440, 188],
  },
  latissimus: {
    parts: [
      { kind: 'belly', center: [[600, 900], [520, 700], [430, 520], [360, 400]], widths: [130, 110, 66, 26] },
      { kind: 'tendon', center: [[364, 404], [330, 366], [310, 342]], widths: [20, 14, 10] },
    ],
    converge: [310, 342], label: [520, 680],
  },
};

export type MuscleStyle = 'real' | 'ghost' | 'glow';

function pathOf(pts: Pt[]) { const p = new Path2D(); p.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]); p.closePath(); return p; }
function polyOf(part: Part): Pt[] { return part.poly ?? spindle(part.center!, part.widths!); }
function bbox(pts: Pt[]) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return { x0, y0, x1, y1 }; }

/** Draw one muscle in frame coordinates. Light comes from the upper left (same as all world art). */
export function drawMuscle(ctx: CanvasRenderingContext2D, id: MuscleId, style: MuscleStyle = 'real', alpha = 1) {
  const sh = SHAPES[id];
  ctx.save(); ctx.globalAlpha = alpha;
  for (const part of sh.parts) {
    const pts = polyOf(part); const path = pathOf(pts); const b = bbox(pts);
    if (style === 'ghost') {
      ctx.setLineDash([7, 6]); ctx.lineWidth = 2; ctx.strokeStyle = part.kind === 'tendon' ? 'rgba(255,220,200,0.7)' : 'rgba(255,120,140,0.8)';
      ctx.fillStyle = part.kind === 'tendon' ? 'rgba(255,230,210,0.10)' : 'rgba(255,90,120,0.12)'; ctx.fill(path); ctx.stroke(path); ctx.setLineDash([]);
      continue;
    }
    if (part.kind === 'tendon') {
      const g = ctx.createLinearGradient(b.x0, b.y0, b.x1, b.y1);
      g.addColorStop(0, style === 'glow' ? '#fff2f6' : '#f4ecdc'); g.addColorStop(1, style === 'glow' ? '#ffb3c6' : '#cfc2a8');
      ctx.fillStyle = g; ctx.fill(path);
      ctx.strokeStyle = 'rgba(70,50,30,0.55)'; ctx.lineWidth = 1.2; ctx.stroke(path);
      continue;
    }
    // belly: base gradient (lit upper-left), fibres, rim shade, highlight
    const g = ctx.createLinearGradient(b.x0, b.y0, b.x1, b.y1);
    if (style === 'glow') { g.addColorStop(0, '#ff9fb6'); g.addColorStop(0.5, '#ff5c84'); g.addColorStop(1, '#b8204e'); }
    else { g.addColorStop(0, '#d9616a'); g.addColorStop(0.45, '#b83a46'); g.addColorStop(1, '#7c1f2c'); }
    ctx.fillStyle = g; ctx.fill(path);
    ctx.save(); ctx.clip(path);
    // fibres
    ctx.strokeStyle = style === 'glow' ? 'rgba(255,230,240,0.28)' : 'rgba(255,190,190,0.22)'; ctx.lineWidth = 1.1;
    if (sh.converge) {
      const [cx, cy] = sh.converge;
      for (let i = 0; i < pts.length; i += 2) { ctx.beginPath(); ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(cx, cy); ctx.stroke(); }
    } else {
      const c = smoothLine(part.center!, 8);
      for (let k = -6; k <= 6; k++) {
        ctx.beginPath();
        c.forEach((p, i) => {
          const a = c[Math.max(0, i - 1)], q = c[Math.min(c.length - 1, i + 1)];
          let dx = q[0] - a[0], dy = q[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
          const x = p[0] - dy * k * 4.2, y = p[1] + dx * k * 4.2;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.stroke();
      }
    }
    // darker fibres for depth
    ctx.strokeStyle = 'rgba(60,0,10,0.18)'; ctx.lineWidth = 0.8;
    if (!sh.converge) {
      const c = smoothLine(part.center!, 8);
      for (let k = -5; k <= 5; k++) { ctx.beginPath(); c.forEach((p, i) => { const a = c[Math.max(0, i - 1)], q = c[Math.min(c.length - 1, i + 1)]; let dx = q[0] - a[0], dy = q[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l; const x = p[0] - dy * (k * 4.2 + 2), y = p[1] + dx * (k * 4.2 + 2); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }); ctx.stroke(); }
    }
    // rim shade (lower right) + highlight (upper left)
    ctx.lineWidth = 10; ctx.strokeStyle = 'rgba(40,0,8,0.35)';
    ctx.save(); ctx.translate(3, 3); ctx.stroke(path); ctx.restore();
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,220,220,0.18)';
    ctx.save(); ctx.translate(-2, -2); ctx.stroke(path); ctx.restore();
    ctx.restore();
    ctx.strokeStyle = style === 'glow' ? 'rgba(255,220,235,0.9)' : 'rgba(50,6,14,0.85)'; ctx.lineWidth = 1.6; ctx.stroke(path);
  }
  ctx.restore();
}

export function muscleBounds(id: MuscleId, pad = 8) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const part of SHAPES[id].parts) { const b = bbox(polyOf(part)); x0 = Math.min(x0, b.x0); y0 = Math.min(y0, b.y0); x1 = Math.max(x1, b.x1); y1 = Math.max(y1, b.y1); }
  return { x: Math.floor(x0 - pad), y: Math.floor(y0 - pad), w: Math.ceil(x1 - x0 + pad * 2), h: Math.ceil(y1 - y0 + pad * 2) };
}

/** Muscle cropped to its bounds -> texture `mus_<style>_<id>` (density 2). */
export function makeMuscleTexture(scene: Phaser.Scene, id: MuscleId, style: MuscleStyle = 'real') {
  const b = muscleBounds(id);
  const key = `mus_${style}_${id}`;
  if (!scene.textures.exists(key)) {
    const c = document.createElement('canvas'); c.width = b.w * DENSITY; c.height = b.h * DENSITY;
    const ctx = c.getContext('2d')!; ctx.scale(DENSITY, DENSITY); ctx.translate(-b.x, -b.y);
    drawMuscle(ctx, id, style);
    scene.textures.addCanvas(key, c);
  }
  return { key, ...b };
}

/** Full-frame anatomy plate: torso hologram + upper-limb bones (+ optional muscles in draw order). */
export function makePlateTexture(scene: Phaser.Scene, key: string, muscles: MuscleId[], boneAlpha = 1) {
  if (scene.textures.exists(key)) return key;
  const c = document.createElement('canvas'); c.width = FRAME.w * DENSITY; c.height = FRAME.h * DENSITY;
  const ctx = c.getContext('2d')!; ctx.scale(DENSITY, DENSITY);
  drawTorsoHolo(ctx, 0.55);
  ctx.save(); ctx.globalAlpha = boneAlpha; for (const id of UPPER_ORDER) drawBone(ctx, id, 'bone'); ctx.restore();
  for (const m of muscles) drawMuscle(ctx, m, 'real');
  scene.textures.addCanvas(key, c);
  return key;
}
