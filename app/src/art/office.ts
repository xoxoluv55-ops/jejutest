// Procedurally painted props for the escape-room investigation views (v0.7): research desk, journal, mug, sticky
// note, drawer interior with a false bottom, specimen case, photo frame (front/back) and their small world versions.
// Code-drawn (not illustrated) — each key can be replaced by public/assets/art/<key>.png like the other painted art.
// The specimen inside the photo and the case is NOT drawn here: the scenes overlay the real bone model render.
import Phaser from 'phaser';
import { paint, rng } from './env';

type Ctx = CanvasRenderingContext2D;
const lg = (c: Ctx, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) => { const g = c.createLinearGradient(x0, y0, x1, y1); stops.forEach(s => g.addColorStop(s[0], s[1])); return g; };
const rg = (c: Ctx, x: number, y: number, r0: number, r1: number, stops: [number, string][]) => { const g = c.createRadialGradient(x, y, r0, x, y, r1); stops.forEach(s => g.addColorStop(s[0], s[1])); return g; };
function rr(c: Ctx, x: number, y: number, w: number, h: number, r: number) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function grain(c: Ctx, x: number, y: number, w: number, h: number, seed: number, col: string, n = 70) {
  const r = rng(seed); c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.strokeStyle = col; c.lineWidth = 1;
  for (let i = 0; i < n; i++) { const yy = y + r() * h; c.globalAlpha = 0.15 + r() * 0.25; c.beginPath(); c.moveTo(x, yy); for (let k = 1; k <= 8; k++) c.lineTo(x + w * k / 8, yy + (r() - 0.5) * 6); c.stroke(); }
  c.restore();
}

export function makeOfficeArt(scene: Phaser.Scene) {
  // ---- desk top (seen from the front, slightly above) with the drawer + keypad at the bottom centre ----
  paint(scene, 'inv_desk', 1000, 560, (c, w, h) => {
    // wall behind
    c.fillStyle = lg(c, 0, 0, 0, 120, [[0, '#18212f'], [1, '#202b3c']]); c.fillRect(0, 0, w, 130);
    // desk top (trapezoid for perspective)
    c.fillStyle = lg(c, 0, 110, 0, 380, [[0, '#5c4330'], [1, '#7a5a3f']]);
    c.beginPath(); c.moveTo(70, 110); c.lineTo(w - 70, 110); c.lineTo(w - 10, 380); c.lineTo(10, 380); c.closePath(); c.fill();
    c.save(); c.beginPath(); c.moveTo(70, 110); c.lineTo(w - 70, 110); c.lineTo(w - 10, 380); c.lineTo(10, 380); c.closePath(); c.clip(); grain(c, 0, 110, w, 270, 7, '#3b2a1c', 90); c.restore();
    c.strokeStyle = '#2a1d12'; c.lineWidth = 3; c.beginPath(); c.moveTo(70, 110); c.lineTo(w - 70, 110); c.lineTo(w - 10, 380); c.lineTo(10, 380); c.closePath(); c.stroke();
    // front apron
    c.fillStyle = lg(c, 0, 380, 0, h, [[0, '#4a3524'], [1, '#2e2016']]); c.fillRect(10, 380, w - 20, h - 380);
    grain(c, 10, 380, w - 20, h - 380, 11, '#24180f', 40);
    // drawer front (centre)
    c.fillStyle = lg(c, 0, 398, 0, 540, [[0, '#6b4d35'], [1, '#4b3524']]); rr(c, 300, 398, 400, 140, 8); c.fill();
    c.strokeStyle = '#1e140c'; c.lineWidth = 3; c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(306, 402, 388, 6);
    // brass handle
    c.fillStyle = lg(c, 0, 452, 0, 470, [[0, '#f0cf7a'], [1, '#9a7428']]); rr(c, 440, 452, 120, 16, 8); c.fill();
    // side drawers (dummy)
    for (const x of [40, 720]) { c.fillStyle = lg(c, 0, 398, 0, 540, [[0, '#5e4430'], [1, '#3f2c1e']]); rr(c, x, 398, 240, 140, 8); c.fill(); c.strokeStyle = '#1e140c'; c.lineWidth = 3; c.stroke(); c.fillStyle = '#b08a3e'; rr(c, x + 95, 455, 50, 10, 5); c.fill(); }
    // desk lamp glow on the surface
    c.fillStyle = rg(c, 760, 200, 10, 260, [[0, 'rgba(255,220,150,0.22)'], [1, 'rgba(255,220,150,0)']]); c.fillRect(0, 100, w, 300);
  });
  // ---- journal closed / open ----
  paint(scene, 'inv_journal', 230, 290, (c, w, h) => {
    c.fillStyle = 'rgba(0,0,0,0.35)'; rr(c, 10, 14, w - 12, h - 12, 12); c.fill();
    c.fillStyle = lg(c, 0, 0, w, h, [[0, '#2f5a4a'], [1, '#1c3a30']]); rr(c, 2, 2, w - 14, h - 14, 10); c.fill();
    c.strokeStyle = '#0d1f18'; c.lineWidth = 2; c.stroke();
    c.fillStyle = '#e9e0c8'; c.fillRect(w - 16, 10, 6, h - 30);                      // page edges
    c.fillStyle = '#c9a64b'; c.fillRect(20, 2, 10, h - 14);                           // spine band
    c.strokeStyle = '#d9c27a'; c.lineWidth = 2; rr(c, 44, 40, w - 80, 70, 6); c.stroke();
    c.fillStyle = '#e9d9a6'; c.font = '700 22px serif'; c.textAlign = 'center'; c.fillText('LAB LOG', 44 + (w - 80) / 2, 74);
    c.font = '600 14px serif'; c.fillText('Dr. HAN · S-01', 44 + (w - 80) / 2, 98);
  });
  paint(scene, 'inv_journal_open', 700, 460, (c, w, h) => {
    c.fillStyle = 'rgba(0,0,0,0.4)'; rr(c, 8, 14, w - 8, h - 10, 14); c.fill();
    c.fillStyle = '#244a3d'; rr(c, 0, 4, w - 6, h - 12, 14); c.fill();
    for (const side of [0, 1]) {
      const x = side ? w / 2 : 16;
      c.fillStyle = lg(c, x, 0, x + w / 2 - 22, 0, side ? [[0, '#d6cdb4'], [0.08, '#f3ecda'], [1, '#efe6cf']] : [[0, '#efe6cf'], [0.92, '#f3ecda'], [1, '#d6cdb4']]);
      c.fillRect(x, 16, w / 2 - 22, h - 40);
      c.strokeStyle = 'rgba(80,110,160,0.22)'; c.lineWidth = 1;
      for (let y = 70; y < h - 40; y += 30) { c.beginPath(); c.moveTo(x + 20, y); c.lineTo(x + w / 2 - 40, y); c.stroke(); }
    }
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(w / 2 - 6, 16, 6, h - 40);
  });
  // ---- mug + sticky note ----
  paint(scene, 'inv_mug', 120, 130, (c) => {
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.ellipse(58, 118, 46, 10, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = lg(c, 14, 0, 96, 0, [[0, '#b9c7d8'], [0.5, '#f1f5fb'], [1, '#8d9cb0']]); c.fillRect(14, 28, 82, 86);
    c.beginPath(); c.ellipse(55, 114, 41, 9, 0, 0, Math.PI); c.fill();
    c.strokeStyle = '#7f8ea3'; c.lineWidth = 9; c.beginPath(); c.arc(100, 70, 20, -Math.PI / 2, Math.PI / 2); c.stroke();
    c.fillStyle = '#5a3a22'; c.beginPath(); c.ellipse(55, 28, 41, 10, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#cfd9e6'; c.lineWidth = 3; c.stroke();
    c.fillStyle = '#d63a4a'; c.font = '700 13px sans-serif'; c.textAlign = 'center'; c.fillText('BODY LAB', 55, 76);
  });
  paint(scene, 'inv_note', 170, 130, (c, w, h) => {
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(8, 10, w - 8, h - 8);
    c.fillStyle = lg(c, 0, 0, 0, h, [[0, '#ffe680'], [1, '#f5cf48']]); c.fillRect(0, 0, w - 8, h - 10);
    c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(0, 0, w - 8, 14);
  });
  // ---- drawer interior (open drawer box seen from above) + false bottom panel ----
  paint(scene, 'inv_drawer', 600, 330, (c, w, h) => {
    c.fillStyle = lg(c, 0, 0, 0, h, [[0, '#3a2a1c'], [1, '#2a1d12']]); c.fillRect(0, 0, w, h);
    c.fillStyle = lg(c, 0, 0, 0, h, [[0, '#1d140c'], [1, '#33241a']]); c.fillRect(22, 22, w - 44, h - 64);   // inner floor (hidden compartment below)
    c.strokeStyle = '#140d07'; c.lineWidth = 4; c.strokeRect(22, 22, w - 44, h - 64);
    c.fillStyle = lg(c, 0, h - 42, 0, h, [[0, '#6b4d35'], [1, '#4b3524']]); c.fillRect(0, h - 42, w, 42);   // drawer front lip
    c.fillStyle = '#b08a3e'; rr(c, w / 2 - 60, h - 28, 120, 12, 6); c.fill();
  });
  paint(scene, 'inv_panel', 556, 266, (c, w, h) => {
    c.fillStyle = lg(c, 0, 0, w, h, [[0, '#7a5a3f'], [1, '#5c4330']]); c.fillRect(0, 0, w, h);
    grain(c, 0, 0, w, h, 23, '#3b2a1c', 50);
    c.strokeStyle = '#2a1d12'; c.lineWidth = 3; c.strokeRect(1.5, 1.5, w - 3, h - 3);
    // finger notch at the right edge (the clue that it lifts)
    c.fillStyle = '#1a110a'; c.beginPath(); c.ellipse(w - 34, h / 2, 16, 26, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.08)'; c.beginPath(); c.ellipse(w - 34, h / 2 - 6, 10, 14, 0, 0, Math.PI * 2); c.fill();
  });
  paint(scene, 'inv_case', 380, 260, (c, w, h) => {
    c.fillStyle = 'rgba(0,0,0,0.4)'; rr(c, 8, 12, w - 8, h - 8, 12); c.fill();
    c.fillStyle = '#20262f'; rr(c, 0, 0, w - 8, h - 10, 12); c.fill();
    c.fillStyle = lg(c, 0, 0, 0, h, [[0, '#2b3442'], [1, '#161b23']]); rr(c, 12, 12, w - 32, h - 34, 8); c.fill();   // foam bed
    const r = rng(5); c.fillStyle = 'rgba(255,255,255,0.05)'; for (let i = 0; i < 260; i++) c.fillRect(14 + r() * (w - 36), 14 + r() * (h - 38), 2, 2);
    c.fillStyle = 'rgba(190,230,255,0.08)'; rr(c, 12, 12, w - 32, 30, 8); c.fill();                                // glass glare
    c.fillStyle = '#c9d3df'; c.font = '700 13px sans-serif'; c.fillText('SPECIMEN S-01 · SCAPULA (R)', 22, h - 18);
  });
  // ---- photo frame: front (photo area left transparent for the real model render) and back ----
  paint(scene, 'inv_frame', 520, 420, (c, w, h) => {
    c.fillStyle = 'rgba(0,0,0,0.4)'; rr(c, 10, 14, w - 10, h - 10, 6); c.fill();
    c.fillStyle = lg(c, 0, 0, w, h, [[0, '#8a6a46'], [0.5, '#6b4f33'], [1, '#4d3824']]); rr(c, 0, 0, w - 10, h - 12, 6); c.fill();
    c.fillStyle = '#efe9dc'; c.fillRect(28, 28, w - 66, h - 68);                       // mat
    c.fillStyle = '#0b1622'; c.fillRect(46, 46, w - 102, h - 104);                      // photo background
    c.fillStyle = rg(c, w / 2, h / 2, 10, 230, [[0, 'rgba(70,120,170,0.35)'], [1, 'rgba(0,0,0,0)']]); c.fillRect(46, 46, w - 102, h - 104);
    c.fillStyle = 'rgba(255,255,255,0.07)'; c.beginPath(); c.moveTo(46, 46); c.lineTo(200, 46); c.lineTo(46, 200); c.closePath(); c.fill();
  });
  paint(scene, 'inv_frame_back', 520, 420, (c, w, h) => {
    c.fillStyle = 'rgba(0,0,0,0.4)'; rr(c, 10, 14, w - 10, h - 10, 6); c.fill();
    c.fillStyle = lg(c, 0, 0, w, h, [[0, '#6b4f33'], [1, '#4d3824']]); rr(c, 0, 0, w - 10, h - 12, 6); c.fill();
    c.fillStyle = lg(c, 0, 0, w, h, [[0, '#cbb48a'], [1, '#b39a6e']]); c.fillRect(22, 22, w - 54, h - 56);   // cardboard
    const r = rng(9); c.fillStyle = 'rgba(80,60,30,0.12)'; for (let i = 0; i < 500; i++) c.fillRect(22 + r() * (w - 54), 22 + r() * (h - 56), 2, 1);
    c.fillStyle = '#8a7350'; for (const [x, y] of [[40, 40], [w - 52, 40], [40, h - 54], [w - 52, h - 54]] as [number, number][]) { c.fillRect(x - 6, y - 2, 12, 4); }
  });
  // ---- world versions (3/4 top-down, origin bottom-centre) ----
  paint(scene, 'w_desk', 190, 130, (c, w, h) => {
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.ellipse(w / 2, h - 8, w / 2 - 6, 9, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = lg(c, 0, 14, 0, 64, [[0, '#7a5a3f'], [1, '#5c4330']]); c.beginPath(); c.moveTo(18, 14); c.lineTo(w - 18, 14); c.lineTo(w - 6, 64); c.lineTo(6, 64); c.closePath(); c.fill();
    c.strokeStyle = '#2a1d12'; c.lineWidth = 2; c.stroke();
    c.fillStyle = lg(c, 0, 64, 0, h - 10, [[0, '#4a3524'], [1, '#2e2016']]); c.fillRect(6, 64, w - 12, h - 76);
    c.strokeStyle = '#1e140c'; c.strokeRect(w / 2 - 40, 72, 80, 36); c.fillStyle = '#c9a64b'; c.fillRect(w / 2 - 14, 88, 28, 5);
    c.fillStyle = '#2f5a4a'; c.save(); c.translate(56, 38); c.rotate(-0.25); c.fillRect(-22, -14, 44, 30); c.restore();    // journal
    c.fillStyle = '#dfe6ef'; c.fillRect(124, 22, 18, 20); c.fillStyle = '#5a3a22'; c.fillRect(124, 22, 18, 4);            // mug
    c.fillStyle = '#ffd34d'; c.fillRect(150, 44, 16, 12);
    c.fillStyle = '#3a4252'; c.fillRect(96, 10, 4, 26); c.fillStyle = '#ffe6a0'; c.beginPath(); c.ellipse(98, 10, 12, 6, 0, 0, Math.PI * 2); c.fill();   // lamp
  });
  paint(scene, 'w_frame', 56, 46, (c, w, h) => {
    c.fillStyle = '#6b4f33'; c.fillRect(0, 0, w, h); c.fillStyle = '#efe9dc'; c.fillRect(5, 5, w - 10, h - 10); c.fillStyle = '#16283a'; c.fillRect(9, 9, w - 18, h - 18);
    c.fillStyle = '#e9e1cf'; c.beginPath(); c.moveTo(22, 14); c.lineTo(38, 18); c.lineTo(30, 36); c.closePath(); c.fill();
  });
}
