// Procedurally painted art for the stealth / survival systems (guard drone, supply crate, keycard, laser emitter,
// checkpoint pad). Same pipeline as env.ts: painted at DENSITY x logical size, 3/4 top-down view, origin bottom-centre.
// These are code-drawn, not illustrated assets: each key can be replaced by public/assets/art/<key>.png (USER_ART).
import Phaser from 'phaser';
import { paint } from './env';

type Ctx = CanvasRenderingContext2D;
const lg = (c: Ctx, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) => { const g = c.createLinearGradient(x0, y0, x1, y1); stops.forEach(s => g.addColorStop(s[0], s[1])); return g; };
const rg = (c: Ctx, x: number, y: number, r0: number, r1: number, stops: [number, string][]) => { const g = c.createRadialGradient(x, y, r0, x, y, r1); stops.forEach(s => g.addColorStop(s[0], s[1])); return g; };
function rr(c: Ctx, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}

export function makeStealthArt(scene: Phaser.Scene) {
  // ---- security drone (hovering), 104 x 92, eye drawn separately so it can look around ----
  paint(scene, 'guard_body', 104, 92, (c, w) => {
    const cx = w / 2;
    // side thruster pods
    for (const s of [-1, 1]) {
      const px = cx + s * 40;
      c.fillStyle = lg(c, px - 10, 0, px + 10, 0, [[0, '#2a3242'], [0.5, '#596579'], [1, '#1f2532']]);
      rr(c, px - 10, 34, 20, 30, 8); c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 1.5; c.stroke();
      c.fillStyle = rg(c, px, 64, 0, 9, [[0, 'rgba(255,120,80,0.95)'], [1, 'rgba(255,60,40,0)']]);
      c.beginPath(); c.arc(px, 64, 9, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ffb36b'; c.fillRect(px - 6, 37, 12, 3);
    }
    // main hull: squat ellipsoid with lit top
    c.fillStyle = lg(c, 0, 18, 0, 78, [[0, '#8b98ad'], [0.35, '#4c566a'], [0.75, '#272d3a'], [1, '#161a23']]);
    c.beginPath(); c.ellipse(cx, 48, 34, 30, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#0c0f15'; c.lineWidth = 2; c.stroke();
    // rim light
    c.strokeStyle = 'rgba(180,215,255,0.55)'; c.lineWidth = 2; c.beginPath(); c.ellipse(cx, 48, 33, 29, 0, Math.PI * 1.08, Math.PI * 1.75); c.stroke();
    // armour seams + hazard band
    c.strokeStyle = 'rgba(0,0,0,0.55)'; c.lineWidth = 1.4;
    c.beginPath(); c.ellipse(cx, 50, 34, 9, 0, 0, Math.PI); c.stroke();
    c.beginPath(); c.moveTo(cx - 12, 20); c.lineTo(cx - 16, 44); c.moveTo(cx + 12, 20); c.lineTo(cx + 16, 44); c.stroke();
    c.save(); c.beginPath(); c.ellipse(cx, 58, 34, 22, 0, 0.15, Math.PI - 0.15); c.ellipse(cx, 52, 30, 16, 0, Math.PI - 0.15, 0.15, true); c.closePath(); c.clip();
    for (let i = -8; i < 10; i++) { c.fillStyle = i % 2 ? '#e8b021' : '#191c22'; c.beginPath(); c.moveTo(cx + i * 8, 50); c.lineTo(cx + i * 8 + 8, 50); c.lineTo(cx + i * 8 + 2, 82); c.lineTo(cx + i * 8 - 6, 82); c.closePath(); c.fill(); }
    c.restore();
    // visor housing (dark band where the eye moves)
    c.fillStyle = lg(c, 0, 34, 0, 52, [[0, '#06080c'], [1, '#131924']]);
    c.beginPath(); c.ellipse(cx, 42, 27, 9, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(255,80,90,0.35)'; c.lineWidth = 1.2; c.stroke();
    // dome + antenna
    c.fillStyle = lg(c, cx - 14, 8, cx + 14, 26, [[0, '#c6d2e3'], [1, '#4d586c']]);
    c.beginPath(); c.ellipse(cx, 22, 15, 8, 0, Math.PI, 0); c.fill();
    c.strokeStyle = '#2a3140'; c.lineWidth = 2; c.beginPath(); c.moveTo(cx + 6, 15); c.lineTo(cx + 12, 2); c.stroke();
    c.fillStyle = '#ff4d5e'; c.beginPath(); c.arc(cx + 12, 3, 2.6, 0, Math.PI * 2); c.fill();
    // specular
    c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.ellipse(cx - 14, 30, 8, 3.5, -0.5, 0, Math.PI * 2); c.fill();
    // ID stencil
    c.fillStyle = 'rgba(230,240,255,0.65)'; c.font = '700 7px sans-serif'; c.textAlign = 'center'; c.fillText('SEC-07', cx, 72);
  });
  paint(scene, 'guard_eye', 30, 30, (c) => {
    c.fillStyle = rg(c, 15, 15, 0, 15, [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,0.95)'], [0.45, 'rgba(255,255,255,0.45)'], [1, 'rgba(255,255,255,0)']]);
    c.fillRect(0, 0, 30, 30);
  });
  // ---- supply crate (closed / open), 84 x 70 ----
  const crate = (open: boolean) => (c: Ctx, w: number, h: number) => {
    const x = 6, y = open ? 26 : 18, bw = w - 12, bh = h - y - 4;
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.ellipse(w / 2, h - 4, bw / 2 + 4, 6, 0, 0, Math.PI * 2); c.fill();
    // body (front face + top)
    c.fillStyle = lg(c, 0, y + 12, 0, y + bh, [[0, '#3d5a4c'], [1, '#22362d']]); rr(c, x, y + 12, bw, bh - 12, 4); c.fill();
    c.strokeStyle = '#0d1611'; c.lineWidth = 2; c.stroke();
    // reinforcement ribs
    c.fillStyle = '#4f7462'; for (const rx of [x + 6, x + bw - 14]) c.fillRect(rx, y + 14, 8, bh - 16);
    c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 1; for (const rx of [x + 6, x + bw - 14]) c.strokeRect(rx, y + 14, 8, bh - 16);
    // white cross badge
    const mx = w / 2, my = y + 12 + (bh - 12) / 2;
    c.fillStyle = '#e9f5ee'; rr(c, mx - 12, my - 12, 24, 24, 4); c.fill();
    c.fillStyle = '#d63a4a'; c.fillRect(mx - 3, my - 9, 6, 18); c.fillRect(mx - 9, my - 3, 18, 6);
    if (!open) {
      c.fillStyle = lg(c, 0, y, 0, y + 14, [[0, '#6f9c86'], [1, '#456b59']]); rr(c, x - 2, y, bw + 4, 14, 4); c.fill();
      c.strokeStyle = '#0d1611'; c.lineWidth = 2; c.stroke();
      c.fillStyle = '#ffc94d'; c.fillRect(mx - 7, y + 3, 14, 6); // latch light
    } else {
      // lid flipped up behind + glow from inside
      c.fillStyle = lg(c, 0, 2, 0, 24, [[0, '#456b59'], [1, '#6f9c86']]); rr(c, x + 4, 2, bw - 8, 22, 4); c.fill();
      c.strokeStyle = '#0d1611'; c.lineWidth = 2; c.stroke();
      c.fillStyle = '#0b120e'; rr(c, x + 2, y + 6, bw - 4, 10, 3); c.fill();
      c.fillStyle = rg(c, mx, y + 10, 0, 30, [[0, 'rgba(160,255,200,0.6)'], [1, 'rgba(160,255,200,0)']]); c.fillRect(0, 0, w, y + 24);
    }
  };
  paint(scene, 'crate_closed', 84, 70, crate(false));
  paint(scene, 'crate_open', 84, 70, crate(true));
  // ---- keycard, 44 x 30 ----
  paint(scene, 'keycard', 44, 30, (c) => {
    c.fillStyle = lg(c, 0, 0, 44, 30, [[0, '#ffd66b'], [1, '#d18a1c']]); rr(c, 2, 3, 40, 25, 4); c.fill();
    c.strokeStyle = '#5a3a08'; c.lineWidth = 1.5; c.stroke();
    c.fillStyle = '#2b2f38'; c.fillRect(2, 8, 40, 5);
    c.fillStyle = '#f7f1dc'; rr(c, 6, 16, 12, 9, 2); c.fill();
    c.fillStyle = '#5a3a08'; c.font = '700 7px sans-serif'; c.fillText('S-07', 21, 24);
  });
  // ---- laser emitter (wall node), 26 x 34 ----
  paint(scene, 'laser_node', 26, 34, (c) => {
    c.fillStyle = lg(c, 0, 0, 26, 0, [[0, '#1d2230'], [0.5, '#5d6a82'], [1, '#1d2230']]); rr(c, 3, 2, 20, 30, 5); c.fill();
    c.strokeStyle = '#0a0d14'; c.lineWidth = 1.5; c.stroke();
    c.fillStyle = rg(c, 13, 13, 0, 8, [[0, '#fff'], [0.4, '#ff4d6a'], [1, 'rgba(255,40,70,0)']]); c.beginPath(); c.arc(13, 13, 8, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#f0b429'; c.fillRect(6, 25, 14, 3);
  });
  // ---- checkpoint pad (floor), 120 x 54 ----
  paint(scene, 'cp_pad', 120, 54, (c, w, h) => {
    c.fillStyle = 'rgba(10,30,40,0.85)'; c.beginPath(); c.ellipse(w / 2, h / 2, w / 2 - 2, h / 2 - 2, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(120,220,255,0.9)'; c.lineWidth = 2.5; c.stroke();
    c.strokeStyle = 'rgba(120,220,255,0.45)'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(w / 2, h / 2, w / 2 - 14, h / 2 - 9, 0, 0, Math.PI * 2); c.stroke();
    c.fillStyle = 'rgba(160,235,255,0.9)'; c.font = '700 10px sans-serif'; c.textAlign = 'center'; c.fillText('SAVE', w / 2, h / 2 + 4);
  });
}
