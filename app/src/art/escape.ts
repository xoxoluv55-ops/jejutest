// Code-drawn props for the v0.8 escape-room views (humerus cryo, radius bench/locker, ulna toolbox/panel,
// clavicle poster/safe) and their small world versions. Not illustrations: each key can be replaced by
// public/assets/art/<key>.png like the other painted art. Bones shown inside these props are the real model renders.
import Phaser from 'phaser';
import { paint, rng } from './env';

type Ctx = CanvasRenderingContext2D;
const lg = (c: Ctx, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) => { const g = c.createLinearGradient(x0, y0, x1, y1); stops.forEach(s => g.addColorStop(s[0], s[1])); return g; };
const rg = (c: Ctx, x: number, y: number, r0: number, r1: number, stops: [number, string][]) => { const g = c.createRadialGradient(x, y, r0, x, y, r1); stops.forEach(s => g.addColorStop(s[0], s[1])); return g; };
function rr(c: Ctx, x: number, y: number, w: number, h: number, r: number) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function metal(c: Ctx, x: number, y: number, w: number, h: number, seed: number) {
  c.fillStyle = lg(c, x, y, x, y + h, [[0, '#4a5566'], [0.5, '#3a4352'], [1, '#2a313d']]); c.fillRect(x, y, w, h);
  const r = rng(seed); c.strokeStyle = 'rgba(255,255,255,0.05)'; c.lineWidth = 1;
  for (let i = 0; i < 60; i++) { const yy = y + r() * h; c.beginPath(); c.moveTo(x, yy); c.lineTo(x + w, yy + (r() - 0.5) * 3); c.stroke(); }
}
function screws(c: Ctx, pts: [number, number][]) { for (const [x, y] of pts) { c.fillStyle = '#8a95a6'; c.beginPath(); c.arc(x, y, 5, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#2a313d'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x - 3, y); c.lineTo(x + 3, y); c.stroke(); } }

export function makeEscapeArt(scene: Phaser.Scene) {
  // ---- clipboard (temperature log paper is drawn as text by the scene) ----
  paint(scene, 'inv_clip', 620, 760, (c, w, h) => {
    c.fillStyle = 'rgba(0,0,0,0.4)'; rr(c, 12, 16, w - 12, h - 12, 18); c.fill();
    c.fillStyle = lg(c, 0, 0, w, h, [[0, '#7a5a3a'], [1, '#5a4028']]); rr(c, 0, 0, w - 12, h - 14, 18); c.fill();
    c.fillStyle = lg(c, 0, 60, 0, h, [[0, '#f6f2e6'], [1, '#e8e1cc']]); c.fillRect(28, 60, w - 68, h - 100);
    c.strokeStyle = 'rgba(80,110,160,0.18)'; c.lineWidth = 1; for (let y = 150; y < h - 50; y += 34) { c.beginPath(); c.moveTo(44, y); c.lineTo(w - 56, y); c.stroke(); }
    c.fillStyle = lg(c, 0, 10, 0, 70, [[0, '#d9dee6'], [1, '#8a94a3']]); rr(c, w / 2 - 110, 12, 220, 62, 12); c.fill();
    c.strokeStyle = '#4a5363'; c.lineWidth = 3; c.stroke();
  });
  // ---- radius bench: tools ----
  paint(scene, 'inv_bench', 1000, 560, (c, w, h) => {
    c.fillStyle = lg(c, 0, 0, 0, 130, [[0, '#141b26'], [1, '#1d2635']]); c.fillRect(0, 0, w, 130);
    c.fillStyle = lg(c, 0, 110, 0, 400, [[0, '#3c4656'], [1, '#556275']]);
    c.beginPath(); c.moveTo(60, 110); c.lineTo(w - 60, 110); c.lineTo(w - 10, 400); c.lineTo(10, 400); c.closePath(); c.fill();
    c.strokeStyle = '#1a2029'; c.lineWidth = 3; c.stroke();
    const r = rng(3); c.fillStyle = 'rgba(255,255,255,0.04)'; for (let i = 0; i < 400; i++) c.fillRect(40 + r() * (w - 80), 120 + r() * 270, 3, 1);
    metal(c, 10, 400, w - 20, h - 400, 4);
    for (const x of [60, 380, 700]) { c.strokeStyle = '#1a2029'; c.lineWidth = 3; rr(c, x, 420, 240, 120, 6); c.stroke(); c.fillStyle = '#9aa6b8'; rr(c, x + 95, 470, 50, 10, 5); c.fill(); }
  });
  paint(scene, 'inv_card', 380, 240, (c, w, h) => {
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(8, 10, w - 8, h - 8);
    c.fillStyle = lg(c, 0, 0, 0, h, [[0, '#f4f1e8'], [1, '#e4dfd0']]); c.fillRect(0, 0, w - 8, h - 10);
    c.fillStyle = '#c23a3a'; c.fillRect(0, 0, w - 8, 30);
    c.fillStyle = '#fff'; c.font = '700 16px sans-serif'; c.fillText('SPECIMEN CARD · S-03', 14, 21);
    c.strokeStyle = 'rgba(80,110,160,0.2)'; c.lineWidth = 1; for (let y = 64; y < h - 20; y += 28) { c.beginPath(); c.moveTo(14, y); c.lineTo(w - 22, y); c.stroke(); }
  });
  paint(scene, 'inv_pad', 360, 300, (c, w, h) => {
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(8, 10, w - 8, h - 8);
    c.fillStyle = '#fbf8ee'; c.fillRect(0, 0, w - 8, h - 10);
    c.fillStyle = '#3a6ea8'; c.fillRect(0, 0, w - 8, 18);
    c.fillStyle = '#c9ced8'; for (let x = 20; x < w - 20; x += 22) { c.beginPath(); c.arc(x, 9, 4, 0, Math.PI * 2); c.fill(); }
    c.strokeStyle = 'rgba(80,110,160,0.18)'; c.lineWidth = 1; for (let y = 50; y < h - 16; y += 26) { c.beginPath(); c.moveTo(10, y); c.lineTo(w - 18, y); c.stroke(); }
  });
  paint(scene, 'inv_uv', 240, 90, (c) => {
    c.fillStyle = 'rgba(0,0,0,0.3)'; rr(c, 8, 26, 228, 56, 20); c.fill();
    c.fillStyle = lg(c, 0, 20, 0, 70, [[0, '#4b4f60'], [1, '#22252f']]); rr(c, 60, 24, 172, 44, 18); c.fill();
    c.fillStyle = lg(c, 0, 10, 0, 80, [[0, '#6a6f86'], [1, '#2c2f3c']]); rr(c, 4, 10, 70, 70, 14); c.fill();
    c.fillStyle = rg(c, 40, 45, 2, 30, [[0, '#f3d9ff'], [0.5, '#b04dff'], [1, '#4a1a70']]); c.beginPath(); c.arc(40, 45, 26, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#c9a0ff'; c.font = '700 14px sans-serif'; c.fillText('UV 365', 120, 52);
  });
  paint(scene, 'inv_pencil', 260, 40, (c) => {
    c.fillStyle = '#f1c232'; c.fillRect(40, 10, 190, 20); c.fillStyle = '#d9a71c'; c.fillRect(40, 22, 190, 8);
    c.fillStyle = '#f0c9a8'; c.beginPath(); c.moveTo(40, 10); c.lineTo(6, 20); c.lineTo(40, 30); c.closePath(); c.fill();
    c.fillStyle = '#333'; c.beginPath(); c.moveTo(16, 17); c.lineTo(4, 20); c.lineTo(16, 23); c.closePath(); c.fill();
    c.fillStyle = '#c9ced8'; c.fillRect(230, 9, 14, 22); c.fillStyle = '#e88'; c.fillRect(244, 9, 12, 22);
  });
  paint(scene, 'inv_mag', 220, 220, (c) => {
    c.strokeStyle = '#2a2018'; c.lineWidth = 20; c.lineCap = 'round'; c.beginPath(); c.moveTo(150, 150); c.lineTo(205, 205); c.stroke();
    c.strokeStyle = '#7a5a3a'; c.lineWidth = 14; c.beginPath(); c.moveTo(150, 150); c.lineTo(205, 205); c.stroke();
    c.fillStyle = 'rgba(190,225,255,0.18)'; c.beginPath(); c.arc(92, 92, 72, 0, Math.PI * 2); c.fill();
    c.strokeStyle = lg(c, 0, 0, 180, 180, [[0, '#e8edf3'], [1, '#7f8a99']]); c.lineWidth = 12; c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.ellipse(66, 62, 22, 12, -0.7, 0, Math.PI * 2); c.fill();
  });
  // ---- locker: drawer front with frosted window (contents drawn by the scene) ----
  paint(scene, 'inv_ldrawer', 760, 170, (c, w, h) => {
    metal(c, 0, 0, w, h, 8); c.strokeStyle = '#151a22'; c.lineWidth = 4; c.strokeRect(2, 2, w - 4, h - 4);
    c.fillStyle = 'rgba(10,14,20,0.85)'; c.fillRect(110, 22, w - 220, h - 44);
    c.fillStyle = lg(c, 0, h / 2 - 12, 0, h / 2 + 12, [[0, '#c9d3df'], [1, '#6f7a8a']]); rr(c, w - 92, h / 2 - 34, 30, 68, 10); c.fill();
    screws(c, [[16, 16], [w - 16, 16], [16, h - 16], [w - 16, h - 16]]);
  });
  // ---- toolbox (closed lid / open interior) ----
  paint(scene, 'inv_toolbox', 760, 420, (c, w, h) => {
    c.fillStyle = 'rgba(0,0,0,0.4)'; rr(c, 14, 30, w - 14, h - 26, 16); c.fill();
    c.fillStyle = lg(c, 0, 0, 0, h, [[0, '#c0392b'], [1, '#7a2219']]); rr(c, 0, 120, w - 14, h - 136, 14); c.fill();
    c.fillStyle = lg(c, 0, 0, 0, 160, [[0, '#d65445'], [1, '#9c2d22']]); rr(c, 0, 20, w - 14, 120, 14); c.fill();
    c.strokeStyle = '#4a120c'; c.lineWidth = 4; rr(c, 0, 20, w - 14, h - 36, 14); c.stroke();
    c.fillStyle = '#d7dbe2'; rr(c, w / 2 - 110, 0, 220, 30, 12); c.fill(); c.fillStyle = '#7f8a99'; c.fillRect(w / 2 - 6, 120, 12, 40);
    c.fillStyle = '#fff'; c.font = '700 26px sans-serif'; c.textAlign = 'center'; c.fillText('J-03 · TOOLS', w / 2 - 7, 260);
  });
  paint(scene, 'inv_toolbox_in', 760, 420, (c, w, h) => {
    c.fillStyle = 'rgba(0,0,0,0.4)'; rr(c, 14, 30, w - 14, h - 26, 16); c.fill();
    c.fillStyle = lg(c, 0, 0, 0, h, [[0, '#9c2d22'], [1, '#6a1d15']]); rr(c, 0, 20, w - 14, h - 36, 14); c.fill();
    c.fillStyle = '#1b1414'; c.fillRect(24, 40, w - 62, h - 80);
    c.fillStyle = '#2a2222'; c.fillRect(24, h - 160, w - 62, 120);
  });
  paint(scene, 'inv_tray', 690, 200, (c, w, h) => {
    c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(8, 12, w - 8, h - 10);
    c.fillStyle = lg(c, 0, 0, 0, h, [[0, '#5b6574'], [1, '#353c48']]); c.fillRect(0, 0, w - 8, h - 12);
    c.strokeStyle = '#1c2129'; c.lineWidth = 3; c.strokeRect(1.5, 1.5, w - 11, h - 15);
    for (const x of [170, 340, 510]) { c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(x, 6, 4, h - 24); }
    c.fillStyle = '#9aa3b0'; for (const [x, y] of [[40, 60], [80, 120], [230, 80], [400, 110], [600, 70]] as [number, number][]) { c.fillRect(x, y, 70, 10); c.beginPath(); c.arc(x, y + 5, 10, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = '#e6e9ee'; rr(c, w - 40, h / 2 - 26, 20, 40, 6); c.fill();   // finger tab
  });
  paint(scene, 'inv_manual', 420, 300, (c, w, h) => {
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(8, 10, w - 8, h - 8);
    c.fillStyle = '#e9edf2'; c.fillRect(0, 0, w - 8, h - 10); c.fillStyle = '#2f6fb0'; c.fillRect(0, 0, w - 8, 44);
    c.fillStyle = '#fff'; c.font = '700 18px sans-serif'; c.fillText('L-06 CAGE · POWER', 16, 29);
    c.strokeStyle = 'rgba(0,0,0,0.12)'; for (let y = 70; y < h - 20; y += 24) { c.beginPath(); c.moveTo(16, y); c.lineTo(w - 30, y); c.stroke(); }
  });
  paint(scene, 'inv_fuse', 150, 60, (c) => {
    c.fillStyle = lg(c, 0, 10, 0, 50, [[0, '#f1f4f8'], [1, '#aab3c0']]); c.fillRect(0, 14, 26, 32); c.fillRect(124, 14, 26, 32);
    c.fillStyle = 'rgba(200,230,255,0.55)'; rr(c, 22, 8, 106, 44, 10); c.fill(); c.strokeStyle = '#7f8a99'; c.lineWidth = 2; c.stroke();
    c.strokeStyle = '#c9a64b'; c.lineWidth = 3; c.beginPath(); c.moveTo(26, 30); for (let i = 0; i < 9; i++) c.lineTo(36 + i * 10, i % 2 ? 22 : 38); c.lineTo(124, 30); c.stroke();
  });
  // ---- safe dial (numbers 0-39, 0 at the top, increasing clockwise) ----
  paint(scene, 'inv_dial', 420, 420, (c, w) => {
    const cx = w / 2, cy = w / 2;
    c.fillStyle = rg(c, cx - 40, cy - 40, 10, 210, [[0, '#e9edf2'], [0.7, '#9aa3b0'], [1, '#4a5363']]); c.beginPath(); c.arc(cx, cy, 200, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#1b2029'; c.beginPath(); c.arc(cx, cy, 186, 0, Math.PI * 2); c.fill();
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let i = 0; i < 40; i++) {
      const a = -Math.PI / 2 + i / 40 * Math.PI * 2, big = i % 5 === 0;
      c.strokeStyle = big ? '#f2f5f9' : '#8a95a6'; c.lineWidth = big ? 4 : 2;
      c.beginPath(); c.moveTo(cx + Math.cos(a) * 184, cy + Math.sin(a) * 184); c.lineTo(cx + Math.cos(a) * (big ? 160 : 170), cy + Math.sin(a) * (big ? 160 : 170)); c.stroke();
      if (i % 5 === 0) { c.fillStyle = '#f2f5f9'; c.font = '700 26px sans-serif'; c.fillText(String(i), cx + Math.cos(a) * 136, cy + Math.sin(a) * 136); }
      else { c.fillStyle = '#b8c2d0'; c.font = '600 15px sans-serif'; c.fillText(String(i), cx + Math.cos(a) * 142, cy + Math.sin(a) * 142); }
    }
    c.fillStyle = rg(c, cx - 20, cy - 20, 4, 90, [[0, '#cfd6e0'], [1, '#5a6372']]); c.beginPath(); c.arc(cx, cy, 82, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#3a4252'; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; c.beginPath(); c.arc(cx + Math.cos(a) * 70, cy + Math.sin(a) * 70, 7, 0, Math.PI * 2); c.fill(); }
  });
  // ---- world versions (origin bottom-centre, 3/4 top-down) ----
  paint(scene, 'w_clip', 50, 64, (c, w, h) => {
    c.fillStyle = '#6b4f33'; c.fillRect(4, 6, w - 8, h - 8); c.fillStyle = '#f4efe2'; c.fillRect(9, 14, w - 18, h - 22);
    c.fillStyle = '#9aa3b0'; c.fillRect(w / 2 - 10, 2, 20, 10);
    c.fillStyle = '#4a7ab8'; for (let y = 22; y < h - 12; y += 7) c.fillRect(13, y, w - 26 - (y % 3) * 4, 2);
  });
  paint(scene, 'w_poster', 100, 80, (c, w, h) => {
    c.fillStyle = '#e9e4d6'; c.fillRect(2, 2, w - 4, h - 4); c.strokeStyle = '#8a7a58'; c.lineWidth = 2; c.strokeRect(2, 2, w - 4, h - 4);
    c.fillStyle = '#16283a'; c.fillRect(8, 14, w - 16, h - 22); c.fillStyle = '#2a4a6a'; c.fillRect(8, 6, w - 16, 6);
    c.strokeStyle = '#e9e1cf'; c.lineWidth = 4; c.beginPath(); c.moveTo(22, 30); c.quadraticCurveTo(50, 20, 80, 30); c.stroke();
    c.fillStyle = '#e9e1cf'; c.beginPath(); c.moveTo(60, 32); c.lineTo(80, 40); c.lineTo(66, 66); c.closePath(); c.fill();
    c.fillStyle = '#ffd34d'; for (const [x, y] of [[24, 30], [80, 30], [62, 44]] as [number, number][]) { c.beginPath(); c.arc(x, y, 4, 0, Math.PI * 2); c.fill(); }
  });
  paint(scene, 'w_safe', 84, 84, (c, w, h) => {
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(6, 8, w - 6, h - 6);
    metal(c, 0, 0, w - 6, h - 8, 12); c.strokeStyle = '#151a22'; c.lineWidth = 3; c.strokeRect(1.5, 1.5, w - 9, h - 11);
    c.fillStyle = '#c9d3df'; c.beginPath(); c.arc(w / 2 - 3, h / 2 - 4, 18, 0, Math.PI * 2); c.fill(); c.fillStyle = '#2a313d'; c.beginPath(); c.arc(w / 2 - 3, h / 2 - 4, 8, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#c9a64b'; c.fillRect(w - 22, h / 2 - 14, 6, 20);
  });
  paint(scene, 'w_bench', 170, 110, (c, w, h) => {
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.ellipse(w / 2, h - 8, w / 2 - 6, 9, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = lg(c, 0, 12, 0, 54, [[0, '#556275'], [1, '#3c4656']]); c.beginPath(); c.moveTo(16, 12); c.lineTo(w - 16, 12); c.lineTo(w - 6, 54); c.lineTo(6, 54); c.closePath(); c.fill();
    metal(c, 6, 54, w - 12, h - 66, 5);
    c.fillStyle = '#f4f1e8'; c.fillRect(30, 22, 34, 22); c.fillStyle = '#c23a3a'; c.fillRect(30, 22, 34, 5);
    c.fillStyle = '#4b4f60'; c.fillRect(80, 30, 34, 10); c.fillStyle = '#b04dff'; c.beginPath(); c.arc(80, 35, 7, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fbf8ee'; c.fillRect(124, 20, 26, 22); c.fillStyle = '#3a6ea8'; c.fillRect(124, 20, 26, 4);
  });
  paint(scene, 'w_cryo', 90, 60, (c, w, h) => {
    metal(c, 0, 0, w, h, 14); c.strokeStyle = '#151a22'; c.lineWidth = 3; c.strokeRect(1.5, 1.5, w - 3, h - 3);
    c.fillStyle = '#0c1a24'; c.fillRect(10, 10, w - 20, 22); c.fillStyle = '#5fd2ff'; c.font = '700 14px sans-serif'; c.fillText('-18°', 18, 27);
    c.fillStyle = '#c9d3df'; for (const x of [20, 45, 70]) { c.beginPath(); c.arc(x, 45, 6, 0, Math.PI * 2); c.fill(); }
  });
}
