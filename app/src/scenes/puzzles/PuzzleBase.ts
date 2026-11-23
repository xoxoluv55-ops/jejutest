import Phaser from 'phaser';
import { BaseScene } from '../Base';
import { View } from '../../core/view';
import { Audio } from '../../core/audio';
import { Bus, G } from '../../game/state';
import { ARCHIVE, BoneId, Prim, BONES } from '../../data/anatomy';
import { T, C, drawPanel, Button, RoundButton } from '../../ui/widgets';
import { modelBoneDist } from '../../art/bones';

/** Full-screen puzzle terminal with header, close button, feedback line and success/concept card. */
export class PuzzleBase extends BaseScene {
  px = 0; py = 0; pw = 0; ph = 0;
  feedback!: Phaser.GameObjects.Text;
  fbBg!: Phaser.GameObjects.Graphics;
  solved = false;
  root!: Phaser.GameObjects.Container;
  /** short landscape screens (iPhone: logical height ≈ 450–600): thinner header, smaller banner, tighter margins */
  get compact() { return View.H < 640; }
  get hdr() { return this.compact ? 46 : 64; }
  get fbH() { return this.compact ? 48 : 58; }
  /** top of the banner and the usable content band between header and banner */
  get fbY() { return this.py + this.ph - this.fbH - (this.compact ? 8 : 16); }
  get cTop() { return this.py + this.hdr + (this.compact ? 8 : 14); }
  get cBot() { return this.fbY - (this.compact ? 8 : 14); }

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
    const m = this.compact ? 6 : 16;
    this.px = m; this.py = m; this.pw = W - m * 2; this.ph = H - m * 2;
    const g = this.add.graphics(); drawPanel(g, this.px, this.py, this.pw, this.ph, { accent, header: this.hdr, alpha: 0.82 });
    if (this.compact) {
      // one header row: title, then the instruction beside it (up to 2 lines), close button on the right
      const t = T(this, this.px + 20, this.py + this.hdr / 2, title, 21, C.white, { weight: '700' }).setOrigin(0, 0.5);
      const sx = t.x + t.width + 18, sw = this.px + this.pw - 64 - sx;
      if (sw > 240) T(this, sx, this.py + this.hdr / 2, sub, 15, '#c3d3ee', { wordWrap: { width: sw } }).setOrigin(0, 0.5).setMaxLines(2);
      new RoundButton(this, this.px + this.pw - 30, this.py + this.hdr / 2, 19, 'close', () => this.exit(), accent).setActive2(true);
    } else {
      T(this, this.px + 30, this.py + 22, title, 26, C.white, { weight: '700' }).setOrigin(0, 0.5);
      T(this, this.px + 30, this.py + 47, sub, 16, '#c3d3ee').setOrigin(0, 0.5);
      const close = new RoundButton(this, this.px + this.pw - 40, this.py + 32, 22, 'close', () => this.exit(), accent);
      close.setActive2(true);
      T(this, this.px + this.pw - 72, this.py + 32, '나가기', 16, C.dim).setOrigin(1, 0.5);
    }
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
    const fy = this.fbY, fh = this.fbH;
    if (!this.fbBg) { this.fbBg = this.add.graphics().setDepth(50); this.feedback = T(this, 0, 0, '', 18, C.white, { weight: '600', wordWrap: { width: fw - 50 }, lineSpacing: 4 }).setOrigin(0, 0.5).setDepth(51); }
    this.fbBg.clear();
    this.fbBg.fillStyle(0x050810, 0.95); this.fbBg.fillRoundedRect(fx, fy, fw, fh, 8);
    this.fbBg.lineStyle(1.5, col, 0.9); this.fbBg.strokeRoundedRect(fx, fy, fw, fh, 8);
    this.fbBg.fillStyle(col, 1); this.fbBg.fillRect(fx + 8, fy + 8, 3, fh - 16);
    this.feedback.setPosition(fx + 24, fy + fh / 2).setMaxLines(0).setText(text).setWordWrapWidth(fw - 50).setLineSpacing(this.compact ? 1 : 4);
    // keep long explanations inside the fixed-height banner (never spill over the puzzle content)
    for (const sz of [18, 17, 16, 15]) { this.feedback.setFontSize(sz); if (this.feedback.height <= fh - 4) break; }
    if (this.feedback.height > fh - 4) this.feedback.setMaxLines(Math.max(1, Math.floor((fh - 4) / 18)));
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
    const cp = this.compact;
    const w = Math.min(cp ? 980 : 860, W - 60), h = Math.min(560, H - (cp ? 16 : 60)), x = W / 2 - w / 2, y = H / 2 - h / 2;
    const hd = cp ? 46 : 60;
    const g = this.add.graphics(); drawPanel(g, x, y, w, h, { accent: C.green, header: hd }); c.add(g);
    c.add(T(this, x + 30, y + hd / 2, '구조 복구 성공 · 개념 정리', cp ? 19 : 22, C.greenS, { weight: '700' }).setOrigin(0, 0.5));
    // stacked from the top with measured heights, so it fits a short (phone) screen as well
    let ty = y + hd + (cp ? 12 : 30);
    const hl = T(this, x + 30, ty, headline, cp ? 20 : 24, C.white, { weight: '700', wordWrap: { width: w - 60 } }); c.add(hl); ty += hl.height + (cp ? 8 : 18);
    const tt = T(this, x + 30, ty, `${e.title}  ·  ${e.en}`, 17, C.amberS, { weight: '700' }); c.add(tt); ty += tt.height + (cp ? 6 : 14);
    const btnH = cp ? 46 : 58, footY = y + h - (cp ? 32 : 44);
    const body = T(this, x + 30, ty, e.body, cp ? 15 : 17, '#d3def3', { wordWrap: { width: w - 60 }, lineSpacing: cp ? 3 : 7 }); c.add(body);
    const room = footY - btnH / 2 - 8 - ty;
    for (const sz of [16, 15]) { if (body.height <= room) break; body.setFontSize(sz).setLineSpacing(2); }
    if (body.height > room) body.setMaxLines(Math.max(2, Math.floor(room / 19)));
    c.add(T(this, x + 30, footY, '📖 해부학 도감에 등록되었습니다', 15, C.dim).setOrigin(0, 0.5));
    c.add(new Button(this, x + w - 140, footY, '계속', () => {
      Bus.emit('puzzle:done', this.scene.key);
      this.scene.stop();
    }, { w: 220, h: btnH, accent: C.green, primary: true, icon: 'check' }));
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
  const m = modelBoneDist(id, x, y); if (m !== null) return m;   // real model: distance to its opaque area
  let d = 1e9; for (const p of BONES[id].prims) d = Math.min(d, distPrim(p, x, y)); return d;
}
