// Renders anatomical bones from primitive geometry into canvases (bone / x-ray / hologram styles).
import Phaser from 'phaser';
import { BONES, BoneId, Prim } from '../data/anatomy';

export const DENSITY = 2; // texture pixels per logical unit

function primPath(p: Prim): Path2D {
  const path = new Path2D();
  if (p.t === 'e') {
    path.ellipse(p.x, p.y, p.rx, p.ry, p.r || 0, 0, Math.PI * 2);
  } else if (p.t === 'q') {
    const th = Math.atan2(p.y2 - p.y1, p.x2 - p.x1);
    const nx = -Math.sin(th), ny = Math.cos(th);
    const r1 = p.w1 / 2, r2 = p.w2 / 2;
    path.moveTo(p.x1 + nx * r1, p.y1 + ny * r1);
    path.lineTo(p.x2 + nx * r2, p.y2 + ny * r2);
    path.arc(p.x2, p.y2, r2, th + Math.PI / 2, th - Math.PI / 2, true);
    path.lineTo(p.x1 - nx * r1, p.y1 - ny * r1);
    path.arc(p.x1, p.y1, r1, th - Math.PI / 2, th + Math.PI / 2, true);
    path.closePath();
  } else {
    const pts = p.pts; const n = pts.length; const rad = p.rad ?? 12;
    const mid = (a: [number, number], b: [number, number]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const s = mid(pts[n - 1], pts[0]);
    path.moveTo(s[0], s[1]);
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      const m = mid(a, b);
      path.arcTo(a[0], a[1], m[0], m[1], rad);
    }
    path.closePath();
  }
  return path;
}

function primBounds(p: Prim) {
  if (p.t === 'e') { const r = Math.max(p.rx, p.ry); return [p.x - r, p.y - r, p.x + r, p.y + r]; }
  if (p.t === 'q') { const r = Math.max(p.w1, p.w2) / 2; return [Math.min(p.x1, p.x2) - r, Math.min(p.y1, p.y2) - r, Math.max(p.x1, p.x2) + r, Math.max(p.y1, p.y2) + r]; }
  const xs = p.pts.map(q => q[0]), ys = p.pts.map(q => q[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

export function boneBounds(id: BoneId, pad = 14) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const p of BONES[id].prims) { const b = primBounds(p); x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]); }
  x0 = Math.floor(x0 - pad); y0 = Math.floor(y0 - pad); x1 = Math.ceil(x1 + pad); y1 = Math.ceil(y1 + pad);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

function rng(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

/** Shade a primitive like a cylinder / sphere so bones read as 3D. */
function shadePrim(ctx: CanvasRenderingContext2D, p: Prim, path: Path2D, light: string, mid: string, dark: string) {
  let g: CanvasGradient;
  if (p.t === 'q') {
    const th = Math.atan2(p.y2 - p.y1, p.x2 - p.x1);
    const nx = -Math.sin(th), ny = Math.cos(th);
    const cx = (p.x1 + p.x2) / 2, cy = (p.y1 + p.y2) / 2, r = Math.max(p.w1, p.w2) / 2;
    g = ctx.createLinearGradient(cx + nx * r, cy + ny * r, cx - nx * r, cy - ny * r);
    g.addColorStop(0, dark); g.addColorStop(0.55, mid); g.addColorStop(0.78, light); g.addColorStop(1, dark);
  } else if (p.t === 'e') {
    const r = Math.max(p.rx, p.ry);
    g = ctx.createRadialGradient(p.x - p.rx * 0.35, p.y - p.ry * 0.4, r * 0.05, p.x, p.y, r * 1.05);
    g.addColorStop(0, light); g.addColorStop(0.55, mid); g.addColorStop(1, dark);
  } else {
    const b = primBounds(p);
    g = ctx.createLinearGradient(b[0], b[1], b[2], b[3]);
    g.addColorStop(0, light); g.addColorStop(0.5, mid); g.addColorStop(1, dark);
  }
  ctx.fillStyle = g; ctx.fill(path);
}

export type BoneStyle = 'bone' | 'xray' | 'holo' | 'ghost';

export function drawBone(ctx: CanvasRenderingContext2D, id: BoneId, style: BoneStyle) {
  const prims = BONES[id].prims;
  const paths = prims.map(primPath);
  ctx.save();
  ctx.lineJoin = 'round';
  if (style === 'bone') {
    // drop shadow + outline
    ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 5;
    ctx.fillStyle = '#2b2418';
    for (const p of paths) ctx.fill(p);
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#2b2418'; ctx.lineWidth = 5;
    for (const p of paths) ctx.stroke(p);
    for (let i = 0; i < prims.length; i++) shadePrim(ctx, prims[i], paths[i], '#fffaf0', '#e6d8bb', '#a8916a');
    // porous texture
    const r = rng(id.length * 977);
    const b = boneBounds(id, 0);
    ctx.save();
    const clip = new Path2D(); for (const p of paths) clip.addPath(p);
    ctx.clip(clip);
    for (let i = 0; i < (b.w * b.h) / 90; i++) {
      ctx.fillStyle = r() < 0.5 ? 'rgba(90,70,40,0.10)' : 'rgba(255,255,255,0.10)';
      ctx.beginPath(); ctx.arc(b.x + r() * b.w, b.y + r() * b.h, 0.6 + r() * 1.6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  } else {
    // Silhouette-based styles: union of all primitives, then a glowing "cortex" rim.
    const b = boneBounds(id, 24);
    const sil = document.createElement('canvas');
    const S = 2; sil.width = b.w * S; sil.height = b.h * S;
    const sc = sil.getContext('2d')!;
    sc.scale(S, S); sc.translate(-b.x, -b.y); sc.fillStyle = '#fff';
    for (const p of paths) sc.fill(p);
    const rim = document.createElement('canvas'); rim.width = sil.width; rim.height = sil.height;
    const rc = rim.getContext('2d')!;
    const col = style === 'xray' ? '225,238,255' : '120,225,255';
    rc.shadowColor = `rgba(${col},1)`; rc.shadowBlur = (style === 'xray' ? 7 : 9) * S;
    rc.drawImage(sil, 0, 0); rc.drawImage(sil, 0, 0);
    rc.shadowColor = 'transparent';
    rc.globalCompositeOperation = 'destination-out';
    // shrink interior a bit so a rim remains
    const inset = style === 'xray' ? 3.2 * S : 2.2 * S;
    rc.drawImage(sil, inset, inset, sil.width - inset * 2, sil.height - inset * 2);
    rc.globalCompositeOperation = 'source-in';
    rc.fillStyle = `rgba(${col},${style === 'ghost' ? 0.45 : 0.95})`; rc.fillRect(0, 0, rim.width, rim.height);
    const fill = document.createElement('canvas'); fill.width = sil.width; fill.height = sil.height;
    const fc = fill.getContext('2d')!;
    fc.drawImage(sil, 0, 0);
    fc.globalCompositeOperation = 'source-in';
    if (style === 'xray') {
      const g = fc.createLinearGradient(0, 0, fill.width, fill.height);
      g.addColorStop(0, 'rgba(200,215,230,0.42)'); g.addColorStop(1, 'rgba(150,170,190,0.30)');
      fc.fillStyle = g;
    } else fc.fillStyle = style === 'holo' ? 'rgba(70,190,255,0.22)' : 'rgba(60,170,255,0.08)';
    fc.fillRect(0, 0, fill.width, fill.height);
    ctx.globalCompositeOperation = style === 'xray' ? 'lighter' : 'source-over';
    ctx.drawImage(fill, b.x, b.y, b.w, b.h);
    ctx.drawImage(rim, b.x, b.y, b.w, b.h);
    if (style === 'holo') {
      // scanlines
      ctx.globalCompositeOperation = 'source-over';
      ctx.save(); const clip = new Path2D(); for (const p of paths) clip.addPath(p); ctx.clip(clip);
      ctx.fillStyle = 'rgba(160,240,255,0.10)';
      for (let y = b.y; y < b.y + b.h; y += 5) ctx.fillRect(b.x, y, b.w, 1.4);
      ctx.restore();
    }
  }
  ctx.restore();
}

/** Bone cropped to its own bounds -> texture `bone_<style>_<id>`. Returns frame-space bounds. */
export function makeBoneTexture(scene: Phaser.Scene, id: BoneId, style: BoneStyle) {
  const b = boneBounds(id);
  const key = `bone_${style}_${id}`;
  if (!scene.textures.exists(key)) {
    const c = document.createElement('canvas');
    c.width = b.w * DENSITY; c.height = b.h * DENSITY;
    const ctx = c.getContext('2d')!;
    ctx.scale(DENSITY, DENSITY); ctx.translate(-b.x, -b.y);
    drawBone(ctx, id, style);
    scene.textures.addCanvas(key, c);
  }
  return { key, ...b };
}

/** Hologram torso backdrop: sternum, ribs, spine silhouette, midline. Frame coordinates. */
export function drawTorsoHolo(ctx: CanvasRenderingContext2D, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = 'rgba(90,200,255,0.35)'; ctx.lineWidth = 2; ctx.shadowColor = 'rgba(70,190,255,0.7)'; ctx.shadowBlur = 8;
  // ribs (right side of body = viewer's left of midline)
  for (let i = 0; i < 9; i++) {
    const y = 210 + i * 34;
    ctx.beginPath();
    ctx.moveTo(636, y + 6);
    ctx.bezierCurveTo(560, y - 10 + i * 2, 450 + i * 3, y + 4 + i * 4, 420 + i * 6, y + 70 + i * 8);
    ctx.stroke();
  }
  // left half hint (faded)
  ctx.globalAlpha = alpha * 0.35;
  for (let i = 0; i < 9; i++) {
    const y = 210 + i * 34;
    ctx.beginPath(); ctx.moveTo(644, y + 6); ctx.bezierCurveTo(700, y - 6, 740, y + 10, 760, y + 40); ctx.stroke();
  }
  ctx.globalAlpha = alpha;
  // sternum
  ctx.fillStyle = 'rgba(80,200,255,0.18)'; ctx.strokeStyle = 'rgba(150,230,255,0.8)';
  const st = new Path2D();
  st.moveTo(622, 158); st.lineTo(658, 158); st.lineTo(664, 200); st.lineTo(652, 214); st.lineTo(656, 420); st.lineTo(640, 452); st.lineTo(624, 420); st.lineTo(628, 214); st.lineTo(616, 200); st.closePath();
  ctx.fill(st); ctx.stroke(st);
  // spine (behind)
  ctx.globalAlpha = alpha * 0.4;
  for (let i = 0; i < 16; i++) { ctx.strokeRect(630, 120 + i * 30, 20, 22); }
  ctx.restore();
}

/** Composite AP shoulder radiograph (frame region x 150..700, y 60..620). */
export function makeXrayTexture(scene: Phaser.Scene) {
  const key = 'xray_shoulder';
  const R = { x: 150, y: 70, w: 560, h: 560 };
  if (scene.textures.exists(key)) return { key, ...R };
  const c = document.createElement('canvas');
  c.width = R.w * DENSITY; c.height = R.h * DENSITY;
  const ctx = c.getContext('2d')!;
  ctx.scale(DENSITY, DENSITY);
  // film base
  const g = ctx.createRadialGradient(R.w * 0.5, R.h * 0.45, 40, R.w * 0.5, R.h * 0.5, R.w * 0.75);
  g.addColorStop(0, '#16202a'); g.addColorStop(1, '#030507');
  ctx.fillStyle = g; ctx.fillRect(0, 0, R.w, R.h);
  ctx.translate(-R.x, -R.y);
  // soft tissue
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const st = ctx.createRadialGradient(330, 330, 30, 330, 330, 300); st.addColorStop(0, 'rgba(90,110,130,0.18)'); st.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = st; ctx.beginPath(); ctx.ellipse(380, 360, 300, 260, 0, 0, Math.PI * 2); ctx.fill();
  // ribs
  ctx.strokeStyle = 'rgba(160,185,210,0.20)'; ctx.lineWidth = 9;
  for (let i = 0; i < 8; i++) { const y = 210 + i * 40; ctx.beginPath(); ctx.moveTo(700, y); ctx.bezierCurveTo(600, y - 18, 470 + i * 4, y, 430 + i * 6, y + 80); ctx.stroke(); }
  ctx.restore();
  ctx.save();
  // clip humerus to proximal half
  drawBone(ctx, 'scapula', 'xray');
  drawBone(ctx, 'clavicle', 'xray');
  ctx.beginPath(); ctx.rect(0, 0, 900, 600); ctx.clip();
  drawBone(ctx, 'humerus', 'xray');
  ctx.restore();
  ctx.translate(R.x, R.y);
  // film grain + scanlines
  const r = rng(42);
  for (let i = 0; i < 9000; i++) { ctx.fillStyle = `rgba(255,255,255,${r() * 0.05})`; ctx.fillRect(r() * R.w, r() * R.h, 1, 1); }
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  for (let y = 0; y < R.h; y += 3) ctx.fillRect(0, y, R.w, 1);
  // markers text on film
  ctx.fillStyle = 'rgba(220,235,255,0.75)'; ctx.font = '700 22px Rajdhani, sans-serif'; ctx.fillText('R', 22, 40);
  ctx.font = '500 12px Rajdhani, sans-serif'; ctx.fillText('BODY LAB · X-04 · AP SHOULDER', 22, R.h - 18);
  scene.textures.addCanvas(key, c);
  return { key, ...R };
}
