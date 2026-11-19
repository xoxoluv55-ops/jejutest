import Phaser from 'phaser';
import { BaseScene } from '../Base';
import { View } from '../../core/view';
import { Audio } from '../../core/audio';
import { Bus, G } from '../../game/state';
import { ARCHIVE, BoneId, Prim, BONES } from '../../data/anatomy';
import { T, C, drawPanel, Button, RoundButton } from '../../ui/widgets';

/** Full-screen puzzle terminal with header, close button, feedback line and success/concept card. */
export class PuzzleBase extends BaseScene {
  px = 0; py = 0; pw = 0; ph = 0;
  feedback!: Phaser.GameObjects.Text;
  fbBg!: Phaser.GameObjects.Graphics;
  solved = false;
  root!: Phaser.GameObjects.Container;

  frame(title: string, sub: string, accent = C.cyan) {
    const { W, H } = View;
    this.solved = false;
    // Phaser reuses the scene instance when a puzzle is reopened: drop objects cached from the previous session
    // (they were destroyed on shutdown; writing to them crashed the second visit).
    this.fbBg = undefined as unknown as Phaser.GameObjects.Graphics; this.feedback = undefined as unknown as Phaser.GameObjects.Text;
    // New interactive objects only become hit-testable at the input plugin's next preUpdate; flush once create() is
    // done so a tap in the very first frame is not lost.
    this.events.once('create', () => this.flushInput());
    this.add.rectangle(W / 2, H / 2, W, H, 0x010207, 0.9).setInteractive();
    // subtle grid
    const grid = this.add.graphics(); grid.lineStyle(1, accent, 0.05);
    for (let x = 0; x < W; x += 40) grid.lineBetween(x, 0, x, H);
    for (let y = 0; y < H; y += 40) grid.lineBetween(0, y, W, y);
    const m = 16;
    this.px = m; this.py = m; this.pw = W - m * 2; this.ph = H - m * 2;
    const g = this.add.graphics(); drawPanel(g, this.px, this.py, this.pw, this.ph, { accent, header: 64, alpha: 0.82 });
    T(this, this.px + 30, this.py + 22, title, 24, C.white, { weight: '700' }).setOrigin(0, 0.5);
    T(this, this.px + 30, this.py + 47, sub, 15, '#9fb3d6').setOrigin(0, 0.5);
    const close = new RoundButton(this, this.px + this.pw - 40, this.py + 32, 22, 'close', () => this.exit(), accent);
    close.setActive2(true);
    T(this, this.px + this.pw - 72, this.py + 32, '나가기', 14, C.dim).setOrigin(1, 0.5);
    this.root = this.add.container(0, 0);
    this.cameras.main.fadeIn(250, 0, 0, 0);
    this.input.keyboard?.on('keydown-ESC', () => this.exit());
  }

  /** Make interactive objects created this frame tappable immediately (Phaser queues them until the next frame). */
  flushInput() { (this.input as unknown as { preUpdate(): void }).preUpdate(); }

  /** feedback banner at bottom of the panel */
  setFeedback(text: string, kind: 'info' | 'ok' | 'err' | 'warn' = 'info', x?: number, w?: number) {
    const col = { info: C.cyan, ok: C.green, err: C.red, warn: C.amber }[kind];
    const fx = x ?? this.px + 30, fw = w ?? this.pw - 60;
    const fy = this.py + this.ph - 74;
    if (!this.fbBg) { this.fbBg = this.add.graphics().setDepth(50); this.feedback = T(this, 0, 0, '', 17, C.white, { weight: '600', wordWrap: { width: fw - 50 }, lineSpacing: 4 }).setOrigin(0, 0.5).setDepth(51); }
    this.fbBg.clear();
    this.fbBg.fillStyle(0x050810, 0.92); this.fbBg.fillRoundedRect(fx, fy, fw, 58, 8);
    this.fbBg.lineStyle(1.5, col, 0.9); this.fbBg.strokeRoundedRect(fx, fy, fw, 58, 8);
    this.fbBg.fillStyle(col, 1); this.fbBg.fillRect(fx + 8, fy + 10, 3, 38);
    this.feedback.setPosition(fx + 24, fy + 29).setText(text).setWordWrapWidth(fw - 50);
    if (kind === 'err') { this.tweens.add({ targets: [this.fbBg, this.feedback], x: '+=6', duration: 50, yoyo: true, repeat: 3 }); }
  }

  mistake() { G.run.mistakes++; }

  exit() {
    if (this.solved) return;
    Audio.play('close');
    Bus.emit('puzzle:closed');
    this.scene.stop();
  }

  success(conceptId: string, headline: string, delay = 1400) {
    this.solved = true;
    Audio.play('success');
    this.cameras.main.flash(300, 80, 255, 180);
    this.time.delayedCall(delay, () => this.conceptCard(conceptId, headline));
  }

  conceptCard(conceptId: string, headline: string) {
    const { W, H } = View;
    const e = ARCHIVE.find(a => a.id === conceptId)!;
    const c = this.add.container(0, 0).setDepth(200);
    c.add(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6).setInteractive());
    const w = Math.min(860, W - 60), h = Math.min(560, H - 60), x = W / 2 - w / 2, y = H / 2 - h / 2;
    const g = this.add.graphics(); drawPanel(g, x, y, w, h, { accent: C.green, header: 60 }); c.add(g);
    c.add(T(this, x + 30, y + 30, '구조 복구 성공 · 개념 정리', 22, C.greenS, { weight: '700' }).setOrigin(0, 0.5));
    c.add(T(this, x + 30, y + 92, headline, 24, C.white, { weight: '700', wordWrap: { width: w - 60 } }));
    c.add(T(this, x + 30, y + 140, `${e.title}  ·  ${e.en}`, 17, C.amberS, { weight: '700' }));
    c.add(T(this, x + 30, y + 176, e.body, 17, '#d3def3', { wordWrap: { width: w - 60 }, lineSpacing: 7 }));
    c.add(T(this, x + 30, y + h - 44, '📖 해부학 도감에 등록되었습니다', 15, C.dim).setOrigin(0, 0.5));
    c.add(new Button(this, x + w - 140, y + h - 44, '계속', () => {
      Bus.emit('puzzle:done', this.scene.key);
      this.scene.stop();
    }, { w: 220, h: 58, accent: C.green, primary: true, icon: 'check' }));
    c.setAlpha(0); this.tweens.add({ targets: c, alpha: 1, duration: 300 });
  }

  layout() { /* puzzles keep their layout; camera refit handled by BaseScene */ }
}

// ---------------- geometry helpers for hit-testing bones ----------------
function distPrim(p: Prim, x: number, y: number): number {
  if (p.t === 'e') {
    const c = Math.cos(-(p.r || 0)), s = Math.sin(-(p.r || 0));
    const dx = x - p.x, dy = y - p.y; const lx = dx * c - dy * s, ly = dx * s + dy * c;
    const k = Math.hypot(lx / p.rx, ly / p.ry);
    return (k - 1) * Math.min(p.rx, p.ry);
  }
  if (p.t === 'q') {
    const vx = p.x2 - p.x1, vy = p.y2 - p.y1; const L2 = vx * vx + vy * vy;
    const t = Math.max(0, Math.min(1, ((x - p.x1) * vx + (y - p.y1) * vy) / L2));
    const cx = p.x1 + vx * t, cy = p.y1 + vy * t; const r = (p.w1 + (p.w2 - p.w1) * t) / 2;
    return Math.hypot(x - cx, y - cy) - r;
  }
  // polygon: negative inside
  const pts = p.pts; let inside = false, md = 1e9;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    const vx = xj - xi, vy = yj - yi; const L2 = vx * vx + vy * vy;
    const t = Math.max(0, Math.min(1, ((x - xi) * vx + (y - yi) * vy) / L2));
    md = Math.min(md, Math.hypot(x - (xi + vx * t), y - (yi + vy * t)));
  }
  return inside ? -md : md;
}
export function distBone(id: BoneId, x: number, y: number) {
  let d = 1e9; for (const p of BONES[id].prims) d = Math.min(d, distPrim(p, x, y)); return d;
}
