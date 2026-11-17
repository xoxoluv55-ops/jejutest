// Procedurally painted environment art for BODY LAB (3/4 top-down view).
// Every texture is painted at DENSITY x logical size so it stays sharp on Retina displays.
// Any texture here can be replaced by a hand-made image: drop a PNG with the same key into
// public/assets/art/<key>.png and list it in USER_ART (see BootScene).
import Phaser from 'phaser';
import { DENSITY } from './bones';

type Ctx = CanvasRenderingContext2D;

export function rng(seed: number) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

/** Keys replaced by hand-made images (public/assets/art/<key>.png, listed in manifest.json). */
export const USER_ART = new Set<string>();
const TILE_KEYS = new Set(['floor_lab', 'floor_grate', 'floor_tile', 'wall_face', 'wall_top']);

export function paint(scene: Phaser.Scene, key: string, w: number, h: number, fn: (c: Ctx, w: number, h: number) => void) {
  if (scene.textures.exists(key)) {
    if (USER_ART.has(key)) fitUserArt(scene, key, w, h);
    return;
  }
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(w * DENSITY); cv.height = Math.ceil(h * DENSITY);
  const c = cv.getContext('2d')!;
  c.scale(DENSITY, DENSITY);
  fn(c, w, h);
  scene.textures.addCanvas(key, cv);
}

/** Resample a user-supplied image to the size the game expects (tiles: cover, props: contain + bottom-centre). */
function fitUserArt(scene: Phaser.Scene, key: string, w: number, h: number) {
  USER_ART.delete(key);
  const src = scene.textures.get(key).getSourceImage() as HTMLImageElement;
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(w * DENSITY); cv.height = Math.ceil(h * DENSITY);
  const c = cv.getContext('2d')!;
  c.imageSmoothingQuality = 'high';
  const sw = src.width, sh = src.height;
  const k = TILE_KEYS.has(key) ? Math.max(cv.width / sw, cv.height / sh) : Math.min(cv.width / sw, cv.height / sh);
  const dw = sw * k, dh = sh * k;
  const dx = (cv.width - dw) / 2, dy = TILE_KEYS.has(key) ? (cv.height - dh) / 2 : cv.height - dh;
  c.drawImage(src, dx, dy, dw, dh);
  scene.textures.remove(key);
  scene.textures.addCanvas(key, cv);
}

const lg = (c: Ctx, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) => { const g = c.createLinearGradient(x0, y0, x1, y1); stops.forEach(s => g.addColorStop(s[0], s[1])); return g; };
const rg = (c: Ctx, x: number, y: number, r0: number, r1: number, stops: [number, string][]) => { const g = c.createRadialGradient(x, y, r0, x, y, r1); stops.forEach(s => g.addColorStop(s[0], s[1])); return g; };

function rr(c: Ctx, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
function grain(c: Ctx, w: number, h: number, n: number, a: number, seed = 1) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) { const v = r() < 0.5 ? 0 : 255; c.fillStyle = `rgba(${v},${v},${v},${r() * a})`; c.fillRect(r() * w, r() * h, 1 + r() * 1.5, 1 + r() * 1.5); }
}
function scratches(c: Ctx, w: number, h: number, n: number, seed = 2) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    c.strokeStyle = `rgba(170,190,220,${0.03 + r() * 0.07})`; c.lineWidth = 0.6;
    const x = r() * w, y = r() * h, a = r() * Math.PI, l = 6 + r() * 40;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke();
  }
}
function grime(c: Ctx, w: number, h: number, n: number, seed = 3, col = '0,0,0') {
  const r = rng(seed);
  for (let i = 0; i < n; i++) { const x = r() * w, y = r() * h, s = 10 + r() * 50; c.fillStyle = rg(c, x, y, 0, s, [[0, `rgba(${col},${0.12 + r() * 0.15})`], [1, `rgba(${col},0)`]]); c.fillRect(x - s, y - s, s * 2, s * 2); }
}
function bolt(c: Ctx, x: number, y: number, r = 2.2) {
  c.fillStyle = rg(c, x - r * 0.3, y - r * 0.3, 0, r * 1.4, [[0, '#8796b3'], [1, '#1b2232']]);
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
}
function screen(c: Ctx, x: number, y: number, w: number, h: number, hue: 'cyan' | 'red' | 'violet' | 'green', seed: number, broken = false) {
  const col = { cyan: ['#06202e', '#3fd4ff', '64,212,255'], red: ['#2a060c', '#ff3d55', '255,61,85'], violet: ['#170a2c', '#a66bff', '166,107,255'], green: ['#062016', '#3dffa2', '61,255,162'] }[hue];
  c.fillStyle = '#05070b'; rr(c, x - 1.5, y - 1.5, w + 3, h + 3, 2); c.fill();
  c.fillStyle = lg(c, x, y, x, y + h, [[0, col[0]], [1, '#020306']]); c.fillRect(x, y, w, h);
  const r = rng(seed);
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
  c.strokeStyle = col[1]; c.lineWidth = 1; c.globalAlpha = 0.85;
  const kind = Math.floor(r() * 3);
  if (kind === 0) { // waveform
    c.beginPath(); for (let i = 0; i <= w; i += 2) { const v = Math.sin(i * 0.25 + r() * 0.4) * h * 0.18 + (i % 26 < 3 ? -h * 0.3 : 0); i ? c.lineTo(x + i, y + h / 2 + v) : c.moveTo(x, y + h / 2 + v); } c.stroke();
  } else if (kind === 1) { // bars
    for (let i = 0; i < w / 5; i++) { const bh = r() * h * 0.7; c.fillStyle = `rgba(${col[2]},0.6)`; c.fillRect(x + 2 + i * 5, y + h - 2 - bh, 3, bh); }
  } else { // text lines
    for (let i = 0; i < h / 5; i++) { c.fillStyle = `rgba(${col[2]},${0.3 + r() * 0.5})`; c.fillRect(x + 3, y + 3 + i * 5, r() * (w - 6), 1.6); }
  }
  c.globalAlpha = 1;
  c.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < h; i += 2) c.fillRect(x, y + i, w, 0.7);
  c.fillStyle = lg(c, x, y, x + w, y + h, [[0, 'rgba(255,255,255,0.12)'], [0.4, 'rgba(255,255,255,0)']]); c.fillRect(x, y, w, h);
  if (broken) {
    c.strokeStyle = 'rgba(220,240,255,0.7)'; c.lineWidth = 0.7;
    const cx = x + w * (0.3 + r() * 0.4), cy = y + h * (0.3 + r() * 0.4);
    for (let i = 0; i < 7; i++) { const a = r() * Math.PI * 2; let px = cx, py = cy; c.beginPath(); c.moveTo(px, py); for (let j = 0; j < 3; j++) { px += Math.cos(a + (r() - 0.5)) * w * 0.2; py += Math.sin(a + (r() - 0.5)) * h * 0.2; c.lineTo(px, py); } c.stroke(); }
    c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(x, y + h * 0.6, w, h * 0.4);
  }
  c.restore();
  c.fillStyle = `rgba(${col[2]},0.10)`; c.fillRect(x - 4, y - 4, w + 8, h + 8);
}

/** Generic 3/4 box: top face (depth d) above a front face (height h). Origin top-left. */
function box(c: Ctx, x: number, y: number, w: number, d: number, h: number, top: [string, string], front: [string, string], edge = 'rgba(160,190,230,0.35)') {
  // shadow
  c.fillStyle = 'rgba(0,0,0,0.45)'; rr(c, x - 3, y + 6, w + 6, d + h + 4, 6); c.fill();
  c.fillStyle = lg(c, x, y + d, x, y + d + h, [[0, front[0]], [1, front[1]]]); rr(c, x, y + d - 4, w, h + 4, 4); c.fill();
  c.fillStyle = lg(c, x, y, x + w * 0.3, y + d, [[0, top[0]], [1, top[1]]]); rr(c, x, y, w, d, 4); c.fill();
  c.strokeStyle = edge; c.lineWidth = 1; c.beginPath(); c.moveTo(x + 3, y + d - 0.5); c.lineTo(x + w - 3, y + d - 0.5); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.08)'; c.beginPath(); c.moveTo(x + 4, y + 1); c.lineTo(x + w - 4, y + 1); c.stroke();
}

function hazard(c: Ctx, x: number, y: number, w: number, h: number, alpha = 0.8) {
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
  c.fillStyle = `rgba(20,16,10,${alpha})`; c.fillRect(x, y, w, h);
  c.fillStyle = `rgba(230,170,40,${alpha * 0.85})`;
  for (let i = -h; i < w + h; i += 16) { c.beginPath(); c.moveTo(x + i, y + h); c.lineTo(x + i + 8, y + h); c.lineTo(x + i + 8 + h, y); c.lineTo(x + i + h, y); c.closePath(); c.fill(); }
  c.restore();
}

export function buildEnvironment(scene: Phaser.Scene) {
  // ---------------- FLOORS ----------------
  paint(scene, 'floor_lab', 256, 256, (c, w, h) => {
    c.fillStyle = '#0c1220'; c.fillRect(0, 0, w, h);
    const r = rng(7);
    for (let py = 0; py < 2; py++) for (let px = 0; px < 2; px++) {
      const x = px * 128, y = py * 128, tone = 14 + Math.floor(r() * 6);
      c.fillStyle = lg(c, x, y, x + 128, y + 128, [[0, `rgb(${tone + 6},${tone + 14},${tone + 30})`], [1, `rgb(${tone - 4},${tone + 2},${tone + 14})`]]);
      c.fillRect(x + 2, y + 2, 124, 124);
      c.strokeStyle = 'rgba(120,150,200,0.13)'; c.lineWidth = 1; c.strokeRect(x + 2.5, y + 2.5, 123, 123);
      c.strokeStyle = 'rgba(0,0,0,0.6)'; c.beginPath(); c.moveTo(x + 2, y + 126); c.lineTo(x + 126, y + 126); c.lineTo(x + 126, y + 2); c.stroke();
      // tread pattern on one plate
      if ((px + py) % 2 === 0) {
        c.fillStyle = 'rgba(140,170,220,0.05)';
        for (let ty = 10; ty < 120; ty += 14) for (let tx = 10; tx < 120; tx += 14) { c.save(); c.translate(x + tx, y + ty); c.rotate(((tx + ty) / 14) % 2 ? 0.8 : -0.8); c.fillRect(-4, -1, 8, 2); c.restore(); }
      }
      bolt(c, x + 9, y + 9); bolt(c, x + 119, y + 9); bolt(c, x + 9, y + 119); bolt(c, x + 119, y + 119);
    }
    scratches(c, w, h, 90, 11); grime(c, w, h, 10, 12); grain(c, w, h, 2200, 0.06, 13);
  });
  paint(scene, 'floor_grate', 256, 256, (c, w, h) => {
    c.fillStyle = '#04070c'; c.fillRect(0, 0, w, h);
    // under-glow
    c.fillStyle = rg(c, 128, 128, 0, 180, [[0, 'rgba(30,90,140,0.25)'], [1, 'rgba(0,0,0,0)']]); c.fillRect(0, 0, w, h);
    c.strokeStyle = '#1a2436'; c.lineWidth = 3;
    for (let i = -w; i < w * 2; i += 12) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + h, h); c.stroke(); c.beginPath(); c.moveTo(i + h, 0); c.lineTo(i, h); c.stroke(); }
    c.strokeStyle = 'rgba(120,150,190,0.12)'; c.lineWidth = 1;
    for (let i = -w; i < w * 2; i += 12) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + h, h); c.stroke(); }
    c.fillStyle = '#121a28'; c.fillRect(0, 0, w, 10); c.fillRect(0, 128 - 5, w, 10); c.fillRect(0, h - 10, w, 10);
    c.fillStyle = 'rgba(255,255,255,0.05)'; c.fillRect(0, 0, w, 1.5); c.fillRect(0, 123, w, 1.5);
    for (let x = 16; x < w; x += 64) { bolt(c, x, 5); bolt(c, x, 128); bolt(c, x, h - 5); }
    grime(c, w, h, 8, 21); grain(c, w, h, 1500, 0.05, 22);
  });
  paint(scene, 'floor_tile', 256, 256, (c, w, h) => {
    c.fillStyle = '#0a1418'; c.fillRect(0, 0, w, h);
    const r = rng(31);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const t = 22 + r() * 8;
      c.fillStyle = lg(c, x * 64, y * 64, x * 64 + 64, y * 64 + 64, [[0, `rgb(${t - 6},${t + 10},${t + 14})`], [1, `rgb(${t - 12},${t},${t + 4})`]]);
      c.fillRect(x * 64 + 1.5, y * 64 + 1.5, 61, 61);
      c.fillStyle = 'rgba(255,255,255,0.04)'; c.fillRect(x * 64 + 2, y * 64 + 2, 60, 2);
    }
    grime(c, w, h, 14, 32); scratches(c, w, h, 40, 33); grain(c, w, h, 2000, 0.05, 34);
  });

  // ---------------- WALLS ----------------
  paint(scene, 'wall_face', 256, 110, (c, w, h) => {
    c.fillStyle = lg(c, 0, 0, 0, h, [[0, '#1c2740'], [0.5, '#121a2c'], [1, '#090d17']]); c.fillRect(0, 0, w, h);
    const r = rng(41);
    for (let i = 0; i < 4; i++) {
      const x = i * 64;
      c.fillStyle = lg(c, x, 0, x + 64, 0, [[0, 'rgba(255,255,255,0.05)'], [0.5, 'rgba(255,255,255,0)'], [1, 'rgba(0,0,0,0.25)']]);
      c.fillRect(x + 3, 10, 58, h - 22);
      c.strokeStyle = 'rgba(0,0,0,0.6)'; c.strokeRect(x + 2.5, 9.5, 59, h - 21);
      c.strokeStyle = 'rgba(140,170,220,0.10)'; c.strokeRect(x + 3.5, 10.5, 57, h - 23);
      bolt(c, x + 8, 15, 1.6); bolt(c, x + 56, 15, 1.6); bolt(c, x + 8, h - 18, 1.6); bolt(c, x + 56, h - 18, 1.6);
      if (r() < 0.4) { // vent slats
        for (let s = 0; s < 6; s++) { c.fillStyle = '#05070c'; c.fillRect(x + 16, 30 + s * 7, 32, 3); c.fillStyle = 'rgba(160,190,230,0.12)'; c.fillRect(x + 16, 33 + s * 7, 32, 1); }
      }
    }
    // light strip
    c.fillStyle = '#0a1a26'; c.fillRect(0, 2, w, 5);
    c.fillStyle = 'rgba(80,210,255,0.85)'; c.fillRect(0, 3.5, w, 2);
    c.fillStyle = 'rgba(80,210,255,0.18)'; c.fillRect(0, 0, w, 10);
    // skirting
    c.fillStyle = '#05070b'; c.fillRect(0, h - 10, w, 10);
    hazard(c, 0, h - 9, w, 5, 0.55);
    grime(c, w, h, 6, 42); grain(c, w, h, 900, 0.05, 43);
  });
  paint(scene, 'wall_top', 64, 64, (c, w, h) => {
    c.fillStyle = '#1a2235'; c.fillRect(0, 0, w, h);
    c.fillStyle = lg(c, 0, 0, w, h, [[0, '#232e47'], [1, '#141b2b']]); c.fillRect(2, 2, w - 4, h - 4);
    c.strokeStyle = 'rgba(0,0,0,0.5)'; c.strokeRect(0.5, 0.5, w - 1, h - 1);
    grain(c, w, h, 300, 0.07, 44);
  });

  // ---------------- DOORS ----------------
  paint(scene, 'door_v', 44, 180, (c, w, h) => {
    c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(4, 6, w, h);
    c.fillStyle = lg(c, 0, 0, w, 0, [[0, '#2a3550'], [0.5, '#3a4868'], [1, '#1a2235']]); rr(c, 0, 0, w, h, 4); c.fill();
    for (let y = 12; y < h - 8; y += 20) { c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(6, y, w - 12, 3); }
    hazard(c, 6, h / 2 - 6, w - 12, 12, 0.9);
  });
  paint(scene, 'lock_red', 16, 16, (c) => { c.fillStyle = rg(c, 8, 8, 0, 8, [[0, '#fff'], [0.3, '#ff3355'], [1, 'rgba(255,40,70,0)']]); c.fillRect(0, 0, 16, 16); });
  paint(scene, 'lock_green', 16, 16, (c) => { c.fillStyle = rg(c, 8, 8, 0, 8, [[0, '#fff'], [0.3, '#3dffa2'], [1, 'rgba(61,255,162,0)']]); c.fillRect(0, 0, 16, 16); });

  // Blast gate (on the north wall face): frame + two leaves
  paint(scene, 'gate_frame', 320, 200, (c, w, h) => {
    c.fillStyle = lg(c, 0, 0, 0, h, [[0, '#1f2a44'], [1, '#0a0f1b']]); rr(c, 0, 0, w, h, 8); c.fill();
    c.fillStyle = '#04060a'; rr(c, 30, 46, w - 60, h - 52, 4); c.fill();
    hazard(c, 12, 14, w - 24, 14, 0.9);
    c.fillStyle = '#0b1220'; rr(c, w / 2 - 70, 30, 140, 14, 3); c.fill();
    c.fillStyle = 'rgba(255,60,90,0.9)'; c.font = '700 10px Orbitron, sans-serif'; c.textAlign = 'center'; c.fillText('EXIT · CORE ACCESS', w / 2, 41);
    bolt(c, 14, 40); bolt(c, w - 14, 40); bolt(c, 14, h - 12); bolt(c, w - 14, h - 12);
    grain(c, w, h, 800, 0.06, 51);
  });
  paint(scene, 'gate_leaf', 130, 148, (c, w, h) => {
    c.fillStyle = lg(c, 0, 0, w, 0, [[0, '#2b3753'], [0.6, '#3b4a6c'], [1, '#222c42']]); c.fillRect(0, 0, w, h);
    for (let y = 10; y < h; y += 24) { c.fillStyle = 'rgba(0,0,0,0.4)'; c.fillRect(6, y, w - 12, 4); c.fillStyle = 'rgba(255,255,255,0.06)'; c.fillRect(6, y + 4, w - 12, 1); }
    hazard(c, 0, h - 26, w, 18, 0.85);
    c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(w - 4, 0, 4, h);
    grain(c, w, h, 600, 0.06, 52);
  });

  // ---------------- PROPS (origin = bottom-centre when placed) ----------------
  paint(scene, 'capsule', 120, 190, (c, w, h) => {
    c.fillStyle = 'rgba(0,0,0,0.5)'; c.beginPath(); c.ellipse(w / 2, h - 18, 56, 18, 0, 0, Math.PI * 2); c.fill();
    // base
    c.fillStyle = lg(c, 0, h - 44, 0, h - 8, [[0, '#2c3955'], [1, '#0d1220']]); c.beginPath(); c.ellipse(w / 2, h - 26, 54, 20, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(60,200,255,0.9)'; c.fillRect(w / 2 - 22, h - 22, 44, 3);
    // glass cylinder
    c.fillStyle = lg(c, 10, 0, w - 10, 0, [[0, 'rgba(90,200,255,0.30)'], [0.2, 'rgba(90,200,255,0.08)'], [0.75, 'rgba(90,200,255,0.05)'], [1, 'rgba(90,200,255,0.28)']]);
    c.fillRect(14, 30, w - 28, h - 64);
    c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(22, 36, 5, h - 80);
    // top cap
    c.fillStyle = lg(c, 0, 10, 0, 40, [[0, '#34415f'], [1, '#141b2b']]); c.beginPath(); c.ellipse(w / 2, 30, 50, 16, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(80,210,255,0.8)'; c.lineWidth = 2; c.beginPath(); c.ellipse(w / 2, 32, 40, 11, 0, 0, Math.PI * 2); c.stroke();
  });
  paint(scene, 'capsule_broken', 120, 190, (c, w, h) => {
    c.fillStyle = 'rgba(0,0,0,0.5)'; c.beginPath(); c.ellipse(w / 2, h - 18, 56, 18, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = lg(c, 0, h - 44, 0, h - 8, [[0, '#2c3955'], [1, '#0d1220']]); c.beginPath(); c.ellipse(w / 2, h - 26, 54, 20, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,60,90,0.9)'; c.fillRect(w / 2 - 22, h - 22, 44, 3);
    // shattered glass shards
    const r = rng(61);
    c.fillStyle = 'rgba(120,210,255,0.22)';
    c.beginPath(); c.moveTo(14, h - 40); c.lineTo(14, 60); c.lineTo(30, 90); c.lineTo(22, 120); c.lineTo(36, 150); c.lineTo(30, h - 40); c.fill();
    c.beginPath(); c.moveTo(w - 14, h - 40); c.lineTo(w - 14, 80); c.lineTo(w - 34, 110); c.lineTo(w - 24, h - 40); c.fill();
    for (let i = 0; i < 18; i++) { c.fillStyle = `rgba(160,225,255,${0.2 + r() * 0.4})`; const x = 10 + r() * (w - 20), y = h - 16 - r() * 20; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 3 + r() * 5, y + 1); c.lineTo(x + 1, y + 3 + r() * 3); c.fill(); }
    c.fillStyle = lg(c, 0, 10, 0, 40, [[0, '#34415f'], [1, '#141b2b']]); c.beginPath(); c.ellipse(w / 2, 30, 50, 16, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(255,60,90,0.7)'; c.lineWidth = 2; c.beginPath(); c.ellipse(w / 2, 32, 40, 11, 0, 0, Math.PI * 2); c.stroke();
    // dripping fluid
    c.fillStyle = 'rgba(60,220,200,0.18)'; c.beginPath(); c.ellipse(w / 2 + 10, h - 8, 50, 8, 0, 0, Math.PI * 2); c.fill();
  });
  paint(scene, 'console', 150, 100, (c, w, h) => {
    box(c, 4, 18, w - 8, 44, 34, ['#2a3654', '#18203a'], ['#141b2d', '#080b13']);
    // angled screens on top
    screen(c, 14, 4, 54, 34, 'cyan', 71); screen(c, 80, 4, 54, 34, 'cyan', 72);
    // keyboard
    c.fillStyle = '#0b0f19'; rr(c, 24, 46, w - 48, 12, 2); c.fill();
    const r = rng(73); for (let i = 0; i < 20; i++) { c.fillStyle = r() < 0.15 ? 'rgba(80,210,255,0.8)' : 'rgba(150,170,210,0.25)'; c.fillRect(27 + (i % 10) * 9.6, 48 + Math.floor(i / 10) * 5, 7, 3); }
    c.fillStyle = 'rgba(80,210,255,0.6)'; c.fillRect(10, h - 22, 22, 2); c.fillStyle = 'rgba(255,60,90,0.8)'; c.fillRect(w - 26, h - 22, 10, 2);
  });
  paint(scene, 'console_red', 150, 100, (c, w, h) => {
    box(c, 4, 18, w - 8, 44, 34, ['#2a3654', '#18203a'], ['#141b2d', '#080b13']);
    screen(c, 14, 4, 54, 34, 'red', 74, true); screen(c, 80, 4, 54, 34, 'red', 75);
    c.fillStyle = '#0b0f19'; rr(c, 24, 46, w - 48, 12, 2); c.fill();
    c.fillStyle = 'rgba(255,60,90,0.8)'; c.fillRect(10, h - 22, 22, 2);
  });
  paint(scene, 'monitor_wall', 220, 80, (c, w, h) => {
    c.fillStyle = '#070a12'; rr(c, 0, 0, w, h, 4); c.fill();
    screen(c, 6, 6, 64, 40, 'cyan', 81); screen(c, 78, 6, 64, 40, 'red', 82, true); screen(c, 150, 6, 64, 40, 'cyan', 83);
    screen(c, 6, 52, 100, 22, 'violet', 84); screen(c, 114, 52, 100, 22, 'cyan', 85);
  });
  paint(scene, 'crate', 76, 76, (c, w, h) => {
    box(c, 3, 8, w - 6, 34, 30, ['#3a3420', '#2a2516'], ['#231e12', '#120f08'], 'rgba(255,200,90,0.25)');
    c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = 2; c.strokeRect(10, 12, w - 20, 26);
    c.beginPath(); c.moveTo(10, 12); c.lineTo(w - 10, 38); c.stroke();
    hazard(c, 6, 50, w - 12, 8, 0.8);
    c.fillStyle = 'rgba(255,255,255,0.5)'; c.font = '700 7px Rajdhani, sans-serif'; c.fillText('BL-SPEC', 12, 66);
  });
  paint(scene, 'cabinet', 96, 130, (c, w, h) => {
    box(c, 4, 6, w - 8, 18, 96, ['#2d3a58', '#1c2540'], ['#1a2238', '#0a0e18']);
    c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(w / 2, 26); c.lineTo(w / 2, h - 12); c.stroke();
    for (let y = 36; y < h - 20; y += 8) { c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(12, y, 26, 2); c.fillRect(w - 38, y, 26, 2); }
    c.fillStyle = 'rgba(255,60,90,0.9)'; c.fillRect(w / 2 - 10, 64, 6, 10); c.fillRect(w / 2 + 4, 64, 6, 10);
    c.fillStyle = 'rgba(255,255,255,0.4)'; c.font = '700 8px Rajdhani, sans-serif'; c.fillText('SPECIMEN', 14, 32);
  });
  paint(scene, 'cabinet_open', 96, 130, (c, w, h) => {
    box(c, 4, 6, w - 8, 18, 96, ['#2d3a58', '#1c2540'], ['#05070c', '#05070c']);
    c.fillStyle = '#1a2238'; c.fillRect(-2, 24, 10, 98); c.fillRect(w - 8, 24, 10, 98);
    for (let y = 46; y < h - 10; y += 30) { c.fillStyle = '#28324a'; c.fillRect(10, y, w - 20, 3); }
    c.fillStyle = 'rgba(80,210,255,0.12)'; c.fillRect(10, 26, w - 20, 92);
  });
  paint(scene, 'optable', 200, 120, (c, w, h) => {
    box(c, 10, 22, w - 20, 54, 26, ['#5a6a88', '#2e3a56'], ['#1a2238', '#0a0e18']);
    c.fillStyle = lg(c, 0, 26, 0, 72, [[0, '#9fb3d4'], [1, '#5f7194']]); rr(c, 20, 28, w - 40, 40, 10); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.3)'; c.beginPath(); c.moveTo(30, 31); c.lineTo(w - 30, 31); c.stroke();
    // straps + stains
    c.fillStyle = '#20283c'; c.fillRect(70, 26, 8, 44); c.fillRect(130, 26, 8, 44);
    c.fillStyle = 'rgba(120,20,30,0.35)'; c.beginPath(); c.ellipse(105, 52, 16, 6, 0.3, 0, Math.PI * 2); c.fill();
    // lamp arm
    c.strokeStyle = '#3a4868'; c.lineWidth = 4; c.beginPath(); c.moveTo(w - 16, 20); c.lineTo(w - 40, 2); c.lineTo(w - 90, 2); c.stroke();
    c.fillStyle = rg(c, w - 92, 6, 0, 16, [[0, 'rgba(220,240,255,0.95)'], [0.3, 'rgba(160,210,255,0.6)'], [1, 'rgba(160,210,255,0)']]); c.beginPath(); c.arc(w - 92, 6, 16, 0, Math.PI * 2); c.fill();
  });
  paint(scene, 'tray_fallen', 70, 40, (c) => {
    c.fillStyle = 'rgba(0,0,0,0.4)'; c.beginPath(); c.ellipse(35, 26, 32, 10, 0.1, 0, Math.PI * 2); c.fill();
    c.save(); c.translate(35, 20); c.rotate(0.25);
    c.fillStyle = lg(c, -28, -10, 28, 10, [[0, '#b8c6dc'], [1, '#6c7b96']]); rr(c, -28, -10, 56, 20, 3); c.fill();
    c.strokeStyle = '#3a4560'; c.strokeRect(-26, -8, 52, 16); c.restore();
    c.strokeStyle = '#c8d3e6'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(8, 34); c.lineTo(24, 30); c.stroke(); c.beginPath(); c.moveTo(50, 36); c.lineTo(64, 28); c.stroke();
  });
  paint(scene, 'holo_table', 260, 190, (c, w, h) => {
    c.fillStyle = 'rgba(0,0,0,0.5)'; c.beginPath(); c.ellipse(w / 2, h - 34, 124, 42, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = lg(c, 0, h - 90, 0, h - 20, [[0, '#2a3654'], [1, '#090d17']]); c.beginPath(); c.ellipse(w / 2, h - 52, 120, 40, 0, 0, Math.PI * 2); c.fill();
    c.fillRect(w / 2 - 120, h - 92, 240, 40);
    c.fillStyle = lg(c, 0, h - 130, 0, h - 60, [[0, '#3a4a70'], [1, '#1c2540']]); c.beginPath(); c.ellipse(w / 2, h - 92, 120, 40, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#060a12'; c.beginPath(); c.ellipse(w / 2, h - 92, 100, 32, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(80,210,255,0.85)'; c.lineWidth = 2;
    for (const rr2 of [96, 72, 44]) { c.beginPath(); c.ellipse(w / 2, h - 92, rr2, rr2 / 3.1, 0, 0, Math.PI * 2); c.stroke(); }
    c.fillStyle = rg(c, w / 2, h - 92, 0, 60, [[0, 'rgba(120,230,255,0.75)'], [1, 'rgba(80,210,255,0)']]); c.beginPath(); c.ellipse(w / 2, h - 92, 60, 20, 0, 0, Math.PI * 2); c.fill();
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; c.fillStyle = 'rgba(80,210,255,0.9)'; c.fillRect(w / 2 + Math.cos(a) * 110 - 2, h - 92 + Math.sin(a) * 35.5 - 1, 4, 2); }
    c.fillStyle = 'rgba(80,210,255,0.6)'; c.fillRect(w / 2 - 60, h - 64, 120, 2);
  });
  paint(scene, 'joint_rig', 210, 170, (c, w, h) => {
    box(c, 14, 70, w - 28, 50, 40, ['#2a3654', '#18203a'], ['#141b2d', '#080b13']);
    // two mechanical arms forming a "joint"
    c.lineCap = 'round';
    c.strokeStyle = '#4a5a80'; c.lineWidth = 14; c.beginPath(); c.moveTo(60, 92); c.lineTo(80, 30); c.stroke();
    c.strokeStyle = '#596b95'; c.lineWidth = 10; c.beginPath(); c.moveTo(80, 30); c.lineTo(150, 50); c.stroke();
    c.fillStyle = rg(c, 80, 30, 0, 16, [[0, '#d9f6ff'], [0.4, '#5ad8ff'], [1, 'rgba(90,216,255,0)']]); c.beginPath(); c.arc(80, 30, 16, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#2a3654'; c.beginPath(); c.arc(80, 30, 7, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(166,107,255,0.9)'; c.lineWidth = 2; c.beginPath(); c.arc(80, 30, 22, -0.4, 1.4); c.stroke();
    screen(c, 120, 80, 64, 30, 'violet', 91);
    hazard(c, 20, h - 20, w - 40, 8, 0.8);
  });
  paint(scene, 'xray_box', 230, 130, (c, w, h) => {
    box(c, 10, 80, w - 20, 26, 20, ['#2a3654', '#18203a'], ['#141b2d', '#080b13']);
    c.fillStyle = '#0a0e18'; rr(c, 10, 2, w - 20, 78, 4); c.fill();
    c.fillStyle = lg(c, 0, 6, 0, 76, [[0, 'rgba(200,230,255,0.95)'], [1, 'rgba(140,190,240,0.85)']]); c.fillRect(18, 8, w - 36, 66);
    // films
    c.fillStyle = 'rgba(10,16,24,0.88)'; c.fillRect(24, 12, 56, 58); c.fillRect(88, 12, 56, 58); c.fillRect(152, 12, 52, 58);
    c.strokeStyle = 'rgba(220,235,255,0.6)'; c.lineWidth = 2;
    c.beginPath(); c.arc(46, 30, 9, 0, Math.PI * 2); c.moveTo(48, 40); c.lineTo(44, 66); c.stroke();
    c.beginPath(); c.moveTo(100, 20); c.lineTo(132, 24); c.moveTo(110, 30); c.lineTo(126, 64); c.stroke();
    c.beginPath(); c.moveTo(168, 20); c.lineTo(168, 66); c.moveTo(186, 20); c.lineTo(184, 66); c.stroke();
  });
  paint(scene, 'breaker', 100, 120, (c, w, h) => {
    box(c, 6, 6, w - 12, 14, 86, ['#3a4560', '#232c42'], ['#1d2539', '#0b0f19']);
    hazard(c, 12, 24, w - 24, 8, 0.9);
    for (let i = 0; i < 4; i++) { c.fillStyle = '#05070c'; rr(c, 16 + i * 18, 40, 12, 32, 2); c.fill(); c.fillStyle = '#7d8aa8'; rr(c, 18 + i * 18, 56, 8, 14, 2); c.fill(); }
    c.fillStyle = 'rgba(255,200,60,0.95)'; c.font = '700 9px Orbitron, sans-serif'; c.fillText('⚡ AUX', 14, 88);
  });
  paint(scene, 'terminal', 70, 96, (c, w, h) => {
    c.fillStyle = 'rgba(0,0,0,0.45)'; c.beginPath(); c.ellipse(w / 2, h - 8, 26, 8, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = lg(c, 0, 30, 0, h, [[0, '#2a3654'], [1, '#0a0e18']]); rr(c, w / 2 - 12, 40, 24, h - 46, 3); c.fill();
    c.fillStyle = '#0a0e18'; rr(c, 6, 4, w - 12, 44, 4); c.fill();
    screen(c, 10, 8, w - 20, 34, 'green', 101);
  });
  paint(scene, 'rack', 76, 136, (c, w, h) => {
    box(c, 4, 4, w - 8, 16, 108, ['#252f48', '#151c2e'], ['#121828', '#06080e']);
    const r = rng(111);
    for (let y = 26; y < h - 14; y += 10) { c.fillStyle = '#0a0d16'; c.fillRect(10, y, w - 20, 7); for (let i = 0; i < 5; i++) { c.fillStyle = r() < 0.6 ? (r() < 0.5 ? 'rgba(80,210,255,0.9)' : 'rgba(61,255,162,0.8)') : 'rgba(255,60,90,0.8)'; c.fillRect(14 + i * 6, y + 2.5, 2.5, 2); } }
  });
  paint(scene, 'jar', 44, 70, (c, w, h) => {
    c.fillStyle = 'rgba(0,0,0,0.4)'; c.beginPath(); c.ellipse(w / 2, h - 5, 20, 6, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = lg(c, 4, 0, w - 4, 0, [[0, 'rgba(110,220,200,0.45)'], [0.5, 'rgba(70,170,160,0.25)'], [1, 'rgba(110,220,200,0.45)']]); rr(c, 4, 12, w - 8, h - 18, 8); c.fill();
    c.fillStyle = 'rgba(200,90,100,0.75)'; c.beginPath(); c.ellipse(w / 2, h / 2 + 6, 9, 13, 0.3, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#3a4560'; rr(c, 2, 4, w - 4, 10, 3); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(9, 18, 3, h - 30);
  });
  paint(scene, 'vent', 90, 90, (c, w, h) => {
    c.fillStyle = '#05080e'; rr(c, 4, 4, w - 8, h - 8, 6); c.fill();
    c.strokeStyle = '#2a3654'; c.lineWidth = 3; rr(c, 4, 4, w - 8, h - 8, 6); c.stroke();
    for (let y = 14; y < h - 10; y += 8) { c.fillStyle = '#1c2436'; c.fillRect(12, y, w - 24, 4); c.fillStyle = 'rgba(160,190,230,0.12)'; c.fillRect(12, y, w - 24, 1); }
    bolt(c, 10, 10); bolt(c, w - 10, 10); bolt(c, 10, h - 10); bolt(c, w - 10, h - 10);
  });
  paint(scene, 'spark_panel', 110, 110, (c, w, h) => {
    c.fillStyle = '#05070c'; c.beginPath(); c.moveTo(10, 20); c.lineTo(80, 6); c.lineTo(104, 60); c.lineTo(70, 104); c.lineTo(14, 90); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,170,60,0.5)'; c.lineWidth = 1.5; c.stroke();
    const cols = ['#ff3d55', '#3fd4ff', '#ffc23d', '#3dffa2'];
    for (let i = 0; i < 4; i++) { c.strokeStyle = cols[i]; c.lineWidth = 3; c.beginPath(); c.moveTo(20 + i * 6, 30); c.bezierCurveTo(40, 50 + i * 8, 60, 20 + i * 10, 84 - i * 4, 70); c.stroke(); }
    c.fillStyle = 'rgba(255,200,80,0.2)'; c.beginPath(); c.arc(60, 56, 30, 0, Math.PI * 2); c.fill();
    hazard(c, 0, 0, 30, 6, 0.8);
  });
  paint(scene, 'cables', 260, 70, (c) => {
    const r = rng(121);
    for (let i = 0; i < 5; i++) {
      c.strokeStyle = ['#0b0f18', '#1a2232', '#2a1018'][i % 3]; c.lineWidth = 4 + r() * 3; c.lineCap = 'round';
      c.beginPath(); c.moveTo(0, 10 + r() * 50); c.bezierCurveTo(80, r() * 70, 160, r() * 70, 260, 10 + r() * 50); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.06)'; c.lineWidth = 1; c.stroke();
    }
  });
  paint(scene, 'puddle', 160, 70, (c) => {
    c.fillStyle = rg(c, 80, 35, 0, 80, [[0, 'rgba(70,170,220,0.18)'], [0.7, 'rgba(70,170,220,0.08)'], [1, 'rgba(70,170,220,0)']]);
    c.beginPath(); c.ellipse(80, 35, 78, 30, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(160,220,255,0.18)'; c.beginPath(); c.ellipse(70, 30, 40, 12, 0, 0, Math.PI * 2); c.stroke();
  });
  paint(scene, 'decal_hazard', 220, 30, (c, w, h) => { hazard(c, 0, 0, w, h, 0.7); });
  paint(scene, 'decal_text', 300, 80, (c, w, h) => {
    c.fillStyle = 'rgba(255,255,255,0.10)'; c.font = '900 64px Orbitron, sans-serif'; c.textAlign = 'center'; c.fillText('A-01', w / 2, h - 12);
  });
  paint(scene, 'cam', 46, 40, (c) => {
    c.fillStyle = '#2a3654'; c.fillRect(18, 0, 8, 14);
    c.fillStyle = lg(c, 0, 10, 0, 34, [[0, '#4a5a80'], [1, '#1a2238']]); rr(c, 4, 12, 38, 20, 6); c.fill();
    c.fillStyle = '#05070c'; c.beginPath(); c.arc(12, 22, 6, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ff3355'; c.beginPath(); c.arc(36, 17, 2.2, 0, Math.PI * 2); c.fill();
  });
  paint(scene, 'pipes', 256, 40, (c, w) => {
    for (let i = 0; i < 3; i++) {
      const y = 6 + i * 12;
      c.fillStyle = lg(c, 0, y, 0, y + 9, [[0, '#4a5878'], [0.4, '#2c3752'], [1, '#121827']]); c.fillRect(0, y, w, 9);
      for (let x = 20; x < w; x += 80) { c.fillStyle = '#1a2235'; c.fillRect(x + i * 10, y - 1, 6, 11); }
    }
  });
  paint(scene, 'elevator_pad', 220, 140, (c, w, h) => {
    c.fillStyle = '#060a12'; rr(c, 0, 0, w, h, 10); c.fill();
    hazard(c, 0, 0, w, 12, 0.9); hazard(c, 0, h - 12, w, 12, 0.9);
    c.strokeStyle = 'rgba(61,255,162,0.8)'; c.lineWidth = 2; rr(c, 16, 22, w - 32, h - 44, 8); c.stroke();
    c.fillStyle = 'rgba(61,255,162,0.12)'; rr(c, 16, 22, w - 32, h - 44, 8); c.fill();
    c.fillStyle = 'rgba(61,255,162,0.9)'; c.font = '700 14px Orbitron, sans-serif'; c.textAlign = 'center'; c.fillText('LIFT', w / 2, h / 2 + 5);
  });

  // ---------------- LIGHT & FX ----------------
  paint(scene, 'light', 256, 256, (c) => { c.fillStyle = rg(c, 128, 128, 0, 128, [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,0.65)'], [0.6, 'rgba(255,255,255,0.18)'], [1, 'rgba(255,255,255,0)']]); c.fillRect(0, 0, 256, 256); });
  paint(scene, 'beam', 256, 128, (c) => {
    const g = c.createRadialGradient(0, 64, 0, 0, 64, 256); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.beginPath(); c.moveTo(0, 64); c.lineTo(256, 0); c.lineTo(256, 128); c.closePath(); c.fill();
  });
  paint(scene, 'dot', 32, 32, (c) => { c.fillStyle = rg(c, 16, 16, 0, 16, [[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,255,255,0.5)'], [1, 'rgba(255,255,255,0)']]); c.fillRect(0, 0, 32, 32); });
  paint(scene, 'spark', 16, 4, (c) => { c.fillStyle = lg(c, 0, 0, 16, 0, [[0, 'rgba(255,255,255,0)'], [1, 'rgba(255,255,255,1)']]); c.fillRect(0, 0, 16, 4); });
  paint(scene, 'smoke', 128, 128, (c) => {
    const r = rng(131);
    for (let i = 0; i < 9; i++) { const x = 34 + r() * 60, y = 34 + r() * 60, s = 20 + r() * 30; c.fillStyle = rg(c, x, y, 0, s, [[0, 'rgba(255,255,255,0.22)'], [1, 'rgba(255,255,255,0)']]); c.fillRect(0, 0, 128, 128); }
  });
  paint(scene, 'ring', 256, 256, (c) => {
    c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 4; c.shadowColor = '#fff'; c.shadowBlur = 12;
    c.beginPath(); c.arc(128, 128, 116, 0, Math.PI * 2); c.stroke();
  });
  paint(scene, 'shadow', 64, 24, (c) => { c.fillStyle = rg(c, 32, 12, 0, 32, [[0, 'rgba(0,0,0,0.65)'], [1, 'rgba(0,0,0,0)']]); c.save(); c.scale(1, 24 / 64); c.beginPath(); c.arc(32, 32, 32, 0, Math.PI * 2); c.restore(); c.fill(); });
  paint(scene, 'marker', 40, 40, (c) => {
    c.strokeStyle = 'rgba(255,255,255,0.95)'; c.lineWidth = 2.5; c.beginPath(); c.arc(20, 20, 14, 0, Math.PI * 2); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.95)'; c.beginPath(); c.arc(20, 20, 4, 0, Math.PI * 2); c.fill();
  });
  paint(scene, 'vignette', 512, 512, (c) => { c.fillStyle = rg(c, 256, 256, 120, 362, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.85)']]); c.fillRect(0, 0, 512, 512); });
  paint(scene, 'scanlines', 4, 4, (c) => { c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(0, 0, 4, 1); });
}
