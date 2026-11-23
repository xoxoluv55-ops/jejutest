// Renders anatomical bones from primitive geometry into canvases (bone / x-ray / hologram styles).
import Phaser from 'phaser';
import { BONES, BoneId, Prim, DETAILS } from '../data/anatomy';

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

// ---------------------------------------------------------------- real bone model (v0.7)
// CH1 bones are rendered from the BodyParts3D 4.0 model (tools/anatomy3d/ch1_bones.py -> assets/ch1/): one image per
// bone in the same 760x1260 anterior frame, their rects, opaque sample points for hit tests and measured landmarks.
// The primitive drawings below remain only as a fallback and for the stylised X-ray film (X-04), whose markers were
// laid out on them.
export interface BoneModel {
  rects: Record<string, { x: number; y: number; w: number; h: number }>;
  mask: Record<string, [number, number][]>;
  landmarks: { head: [number, number]; glenoid: [number, number]; elbow: [number, number]; headRadius: number };
}
let MODEL: BoneModel | null = null;
export function setBoneModel(m: BoneModel | null) { MODEL = m && m.rects ? m : null; }
export function boneModel() { return MODEL; }
/** landmarks measured on the model (frame coords), or null when the model is not loaded */
export function modelLandmarks() {
  if (!MODEL) return null;
  const L = MODEL.landmarks;
  return { head: { x: L.head[0], y: L.head[1] }, glenoid: { x: L.glenoid[0], y: L.glenoid[1] }, elbow: { x: L.elbow[0], y: L.elbow[1] } };
}
/** signed-ish distance (frame units) from (x, y) to the bone's opaque area; 0 inside */
export function modelBoneDist(id: BoneId, x: number, y: number): number | null {
  const pts = MODEL?.mask[id]; if (!pts || !pts.length) return null;
  let d = 1e9; for (const [px, py] of pts) { const q = Math.hypot(px - x, py - y); if (q < d) d = q; }
  return Math.max(0, d - 4.5);
}

/** a point on the bone itself (the mask point closest to its rect centre): bbox centres of diagonal bones like the
 * clavicle can fall on a neighbouring bone */
export function boneAnchor(id: BoneId): { x: number; y: number } {
  const b = boneBounds(id), pts = MODEL?.mask[id];
  if (!pts || !pts.length) return { x: b.cx, y: b.cy };
  let best = pts[0], bd = 1e9;
  for (const p of pts) { const d = Math.hypot(p[0] - b.cx, p[1] - b.cy); if (d < bd) { bd = d; best = p; } }
  return { x: best[0], y: best[1] };
}

export function boneBounds(id: BoneId, pad = 14) {
  const r = MODEL?.rects[id];
  if (r) return { x: r.x, y: r.y, w: r.w, h: r.h, cx: r.x + r.w / 2, cy: r.y + r.h / 2 };
  return primBoneBounds(id, pad);
}

export function primBoneBounds(id: BoneId, pad = 14) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const p of BONES[id].prims) { const b = primBounds(p); x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]); }
  x0 = Math.floor(x0 - pad); y0 = Math.floor(y0 - pad); x1 = Math.ceil(x1 + pad); y1 = Math.ceil(y1 + pad);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

/** Gaussian-ish blur without ctx.filter (unsupported on older iPad Safari): draw via an offset shadow. */
export function blurred(src: HTMLCanvasElement, radius: number) {
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  const x = c.getContext('2d')!;
  const off = src.width + radius * 4;
  x.shadowColor = '#000'; x.shadowBlur = radius; x.shadowOffsetX = off;
  x.drawImage(src, -off, 0);
  // shadowColor is opaque black: keep the source colour by tinting through source-in of a colour copy
  return c;
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
    // Seamless illustrated bone: union silhouette + soft form shading + rim light + anatomical detail.
    const b = boneBounds(id, 24);
    const S = 2;
    const mk = () => { const c = document.createElement('canvas'); c.width = b.w * S; c.height = b.h * S; const x = c.getContext('2d')!; x.scale(S, S); x.translate(-b.x, -b.y); return { c, x }; };
    const sil = mk(); sil.x.fillStyle = '#fff'; for (const p of paths) sil.x.fill(p);
    const art = mk();
    const ax = art.x;
    // base colour, light from upper-left
    ax.drawImage(sil.c, b.x, b.y, b.w, b.h);
    ax.globalCompositeOperation = 'source-in';
    const g = ax.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h);
    g.addColorStop(0, '#fbf3e1'); g.addColorStop(0.55, '#e8d9b8'); g.addColorStop(1, '#c9b289');
    ax.fillStyle = g; ax.fillRect(b.x, b.y, b.w, b.h);
    // per-primitive volume (low alpha so seams vanish)
    ax.globalCompositeOperation = 'source-atop';
    ax.globalAlpha = 0.3;
    for (let i = 0; i < prims.length; i++) shadePrim(ax, prims[i], paths[i], '#fffaf0', 'rgba(232,216,184,0)', '#a88e64');
    ax.globalAlpha = 1;
    // fossae + ridges
    const d = DETAILS[id];
    for (const [x, y, rx, ry, r] of d.shades) {
      const gr = ax.createRadialGradient(x - rx * 0.3, y - ry * 0.3, 0, x, y, Math.max(rx, ry));
      gr.addColorStop(0, 'rgba(120,92,56,0.45)'); gr.addColorStop(1, 'rgba(120,92,56,0)');
      ax.fillStyle = gr; ax.beginPath(); ax.ellipse(x, y, rx, ry, r || 0, 0, Math.PI * 2); ax.fill();
    }
    ax.lineCap = 'round'; ax.lineJoin = 'round';
    for (const ln of d.lines) {
      const tr = () => { ax.beginPath(); ax.moveTo(ln[0][0], ln[0][1]); for (let i = 1; i < ln.length - 1; i++) { const mx = (ln[i][0] + ln[i + 1][0]) / 2, my = (ln[i][1] + ln[i + 1][1]) / 2; ax.quadraticCurveTo(ln[i][0], ln[i][1], mx, my); } ax.lineTo(ln[ln.length - 1][0], ln[ln.length - 1][1]); };
      tr(); ax.strokeStyle = 'rgba(255,250,236,0.55)'; ax.lineWidth = 2.6; ax.stroke();
      ax.save(); ax.translate(0.9, 0.9); tr(); ax.strokeStyle = 'rgba(110,84,50,0.42)'; ax.lineWidth = 1.4; ax.stroke(); ax.restore();
    }
    // porous micro texture
    const r = rng(id.length * 977);
    for (let i = 0; i < (b.w * b.h) / 70; i++) {
      ax.fillStyle = r() < 0.55 ? 'rgba(110,84,50,0.10)' : 'rgba(255,255,255,0.14)';
      ax.beginPath(); ax.arc(b.x + r() * b.w, b.y + r() * b.h, 0.5 + r() * 1.3, 0, Math.PI * 2); ax.fill();
    }
    // inner edge darkening (ambient occlusion at silhouette)
    const edge = mk();
    edge.x.setTransform(1, 0, 0, 1, 0, 0);
    edge.x.fillStyle = '#000'; edge.x.fillRect(0, 0, edge.c.width, edge.c.height);
    edge.x.globalCompositeOperation = 'destination-out';
    edge.x.drawImage(sil.c, 0, 0);
    const soft = blurred(edge.c, 5 * S);
    edge.x.globalCompositeOperation = 'copy'; edge.x.drawImage(soft, 0, 0);
    edge.x.globalCompositeOperation = 'destination-in'; edge.x.drawImage(sil.c, 0, 0);
    ax.save(); ax.setTransform(1, 0, 0, 1, 0, 0); ax.globalCompositeOperation = 'source-atop'; ax.globalAlpha = 0.35; ax.drawImage(edge.c, 0, 0);
    // rim light on the upper-left edge
    const rim = document.createElement('canvas'); rim.width = sil.c.width; rim.height = sil.c.height; const rx = rim.getContext('2d')!;
    rx.drawImage(sil.c, 0, 0); rx.globalCompositeOperation = 'destination-out'; rx.drawImage(sil.c, 3 * S, 3 * S);
    rx.globalCompositeOperation = 'source-in'; rx.fillStyle = '#fffdf6'; rx.fillRect(0, 0, rim.width, rim.height);
    ax.globalAlpha = 0.6; ax.drawImage(rim, 0, 0);
    ax.restore();
    // drop shadow + crisp outline, then the painted bone
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 5;
    const ol = document.createElement('canvas'); ol.width = sil.c.width; ol.height = sil.c.height; const ox = ol.getContext('2d')!;
    for (const [dx, dy] of [[-1.6, 0], [1.6, 0], [0, -1.6], [0, 1.6], [-1.1, -1.1], [1.1, 1.1], [-1.1, 1.1], [1.1, -1.1]]) ox.drawImage(sil.c, dx * S, dy * S);
    ox.globalCompositeOperation = 'source-in'; ox.fillStyle = '#3b2e1c'; ox.fillRect(0, 0, ol.width, ol.height);
    ctx.drawImage(ol, b.x, b.y, b.w, b.h);
    ctx.restore();
    ctx.drawImage(art.c, b.x, b.y, b.w, b.h);
  } else {
    // Silhouette-based styles (x-ray / hologram / ghost): soft fill + true inner rim (cortex).
    const b = boneBounds(id, 24);
    const S = 2;
    const sil = document.createElement('canvas'); sil.width = b.w * S; sil.height = b.h * S;
    const sc = sil.getContext('2d')!; sc.scale(S, S); sc.translate(-b.x, -b.y); sc.fillStyle = '#fff';
    for (const p of paths) sc.fill(p);
    const col = style === 'xray' ? '232,242,255' : '120,225,255';
    const rimW = style === 'xray' ? 3.2 : 2.4;
    const rim = document.createElement('canvas'); rim.width = sil.width; rim.height = sil.height;
    const rc = rim.getContext('2d')!;
    rc.drawImage(sil, 0, 0);
    rc.globalCompositeOperation = 'destination-out';
    const inner = blurred(sil, rimW * S); rc.drawImage(inner, 0, 0);
    rc.globalCompositeOperation = 'source-in';
    rc.fillStyle = `rgba(${col},${style === 'ghost' ? 0.5 : 1})`; rc.fillRect(0, 0, rim.width, rim.height);
    const fill = document.createElement('canvas'); fill.width = sil.width; fill.height = sil.height;
    const fc = fill.getContext('2d')!;
    fc.drawImage(sil, 0, 0);
    fc.globalCompositeOperation = 'source-in';
    if (style === 'xray') {
      const g = fc.createLinearGradient(0, 0, fill.width, fill.height);
      g.addColorStop(0, 'rgba(225,232,240,0.5)'); g.addColorStop(1, 'rgba(170,180,192,0.36)');
      fc.fillStyle = g; fc.fillRect(0, 0, fill.width, fill.height);
      // medullary canal: darker core along long-bone shafts
      fc.globalCompositeOperation = 'destination-out';
      fc.setTransform(S, 0, 0, S, -b.x * S, -b.y * S);
      fc.lineCap = 'round';
      for (const p of prims) if (p.t === 'q' && Math.hypot(p.x2 - p.x1, p.y2 - p.y1) > 60) {
        fc.strokeStyle = 'rgba(0,0,0,0.22)'; fc.lineWidth = Math.min(p.w1, p.w2) * 0.5;
        fc.beginPath(); fc.moveTo(p.x1, p.y1); fc.lineTo(p.x2, p.y2); fc.stroke();
      }
      // trabecular texture in the ends
      fc.globalCompositeOperation = 'source-atop';
      const r = rng(id.length * 131);
      for (const p of prims) if (p.t === 'e' && p.rx > 9) for (let i = 0; i < p.rx * p.ry / 6; i++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r());
        fc.fillStyle = `rgba(255,255,255,${0.05 + r() * 0.09})`;
        fc.fillRect(p.x + Math.cos(a) * d * p.rx, p.y + Math.sin(a) * d * p.ry, 1.2, 1.2);
      }
      fc.setTransform(1, 0, 0, 1, 0, 0);
    } else {
      fc.fillStyle = style === 'holo' ? 'rgba(70,190,255,0.22)' : 'rgba(60,170,255,0.08)';
      fc.fillRect(0, 0, fill.width, fill.height);
    }
    ctx.globalCompositeOperation = style === 'xray' ? 'lighter' : 'source-over';
    ctx.drawImage(fill, b.x, b.y, b.w, b.h);
    if (style !== 'xray') { ctx.save(); ctx.shadowColor = `rgba(${col},0.9)`; ctx.shadowBlur = 8; ctx.drawImage(rim, b.x, b.y, b.w, b.h); ctx.restore(); }
    else { ctx.drawImage(rim, b.x, b.y, b.w, b.h); ctx.drawImage(rim, b.x, b.y, b.w, b.h); }
    if (style === 'holo') {
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
  const src = `ch1m_${id}`;
  if (!scene.textures.exists(key) && MODEL?.rects[id] && scene.textures.exists(src)) {
    // real model image -> style variants (bone = as rendered; holo = cyan glass; xray = cold white; ghost = faint)
    const img = scene.textures.get(src).getSourceImage() as HTMLImageElement;
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    if (style !== 'bone') {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = style === 'holo' ? 'rgba(70,195,255,0.62)' : style === 'xray' ? 'rgba(228,240,255,0.55)' : 'rgba(120,225,255,0.55)';
      ctx.fillRect(0, 0, c.width, c.height);
      if (style === 'holo') { ctx.fillStyle = 'rgba(190,245,255,0.18)'; for (let y = 0; y < c.height; y += 10) ctx.fillRect(0, y, c.width, 3); }
      if (style === 'ghost') { ctx.globalCompositeOperation = 'destination-in'; ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, c.width, c.height); }
    }
    scene.textures.addCanvas(key, c);
    return { key, ...b };
  }
  return makePrimBoneTexture(scene, id, style, key, b);
}

/** primitive-drawn bone (fallback, and the X-ray film overlay which is aligned to the primitive drawing) */
export function makePrimBoneTexture(scene: Phaser.Scene, id: BoneId, style: BoneStyle, key = `bone_prim_${style}_${id}`, bb?: ReturnType<typeof boneBounds>) {
  const b = bb ?? primBoneBounds(id);
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
  // markers text on film
  ctx.fillStyle = 'rgba(220,235,255,0.75)'; ctx.font = '700 22px Rajdhani, sans-serif'; ctx.fillText('R', 22, 40);
  ctx.font = '500 12px Rajdhani, sans-serif'; ctx.fillText('BODY LAB · X-04 · AP SHOULDER', 22, R.h - 18);
  scene.textures.addCanvas(key, c);
  return { key, ...R };
}
