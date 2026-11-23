import Phaser from 'phaser';
import { PuzzleBase } from '../puzzles/PuzzleBase';
import { View } from '../../core/view';
import { Audio } from '../../core/audio';
import { G, Bus } from '../../game/state';
import { T, C, drawPanel, Button } from '../../ui/widgets';
import { clueText } from '../../data/escape';

export type Overlay = { c: Phaser.GameObjects.Container; x: number; y: number; w: number; h: number };

/**
 * Shared machinery of the escape-room close-up views (v0.7+): header tools (hint, notebook), modal overlays,
 * clues (G.run.clues, kept on death), graded hints, and the "specimen recovered" card.
 * The world is paused while a view is open, so investigating is always safe.
 */
export abstract class InvestBase extends PuzzleBase {
  kind = '';
  layer?: Phaser.GameObjects.Container;
  hintLv = 0;
  /** clue ids this scene's notebook lists (in order) */
  abstract clueIds: string[];
  abstract build(kind: string): void;
  /** graded hints for the current state, most useful first */
  abstract hints(): string[];
  /** optional picture copy in the notebook (photo, poster, log) — draws into the given box */
  notebookVisual(_o: Overlay, _x: number, _y: number, _w: number, _h: number): boolean { return false; }

  get adv() { return G.run.difficulty === 'adv'; }
  has(id: string) { return G.run.clues.includes(id); }

  create(data: { kind: string }) {
    this.initView();
    this.kind = data.kind; this.hintLv = 0; this.layer = undefined;
    this.build(this.kind);
    const hx = this.px + this.pw - (this.compact ? 250 : 360), hy = this.py + this.hdr / 2;
    new Button(this, hx, hy, '힌트', () => this.hint(), { w: this.compact ? 96 : 110, h: this.compact ? 36 : 42, icon: 'info', size: 16 }).setDepth(60);
    new Button(this, hx + (this.compact ? 108 : 126), hy, '기록장', () => this.notebook(), { w: this.compact ? 110 : 126, h: this.compact ? 36 : 42, icon: 'book', size: 16 }).setDepth(60);
  }

  addClue(id: string, toast: string) {
    if (G.run.clues.includes(id)) return;
    G.run.clues.push(id); Audio.play('reveal');
    this.setFeedback(`📒 기록장에 저장: ${toast}`, 'ok');
    Bus.emit('mission');
  }

  glint(o: { x: number; y: number; displayWidth: number; displayHeight: number }, parent?: Phaser.GameObjects.Container) {
    const g = this.add.image(o.x + o.displayWidth * 0.3, o.y - o.displayHeight * 0.3, 'light').setTint(0xffffff).setBlendMode(Phaser.BlendModes.ADD).setScale(0.12).setAlpha(0);
    parent?.add(g);
    this.tweens.add({ targets: g, alpha: 0.9, scale: 0.2, duration: 500, yoyo: true, repeat: -1, repeatDelay: 1800, delay: Math.random() * 1500 });
    return g;
  }

  /** dims the view and returns a fresh overlay container with a close button */
  overlay(title: string, w: number, h: number, accent = C.amber): Overlay {
    this.layer?.destroy();
    const { W, H } = View;
    const c = this.add.container(0, 0).setDepth(200); this.layer = c;
    c.add(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.66).setInteractive());
    w = Math.min(w, W - 30); h = Math.min(h, H - (this.compact ? 12 : 40));
    const x = W / 2 - w / 2, y = H / 2 - h / 2;
    const g = this.add.graphics(); drawPanel(g, x, y, w, h, { accent, header: 50 }); c.add(g);
    c.add(T(this, x + 24, y + 25, title, 20, C.white, { weight: '700' }).setOrigin(0, 0.5));
    c.add(new Button(this, x + w - 80, y + 25, '닫기', () => this.closeLayer(), { w: 120, h: 38, icon: 'close', size: 16 }));
    c.setAlpha(0); this.tweens.add({ targets: c, alpha: 1, duration: 150 });
    this.flushInput();
    return { c, x, y, w, h };
  }
  closeLayer() { if (!this.layer) return; const c = this.layer; this.layer = undefined; Audio.play('close'); this.tweens.add({ targets: c, alpha: 0, duration: 120, onComplete: () => c.destroy() }); }

  notebook() {
    Audio.play('open');
    const o = this.overlay('기록장 · 찾은 단서', 980, 640, C.cyan);
    const lines = this.clueIds.filter(id => this.has(id)).map(clueText).filter((s): s is string => !!s);
    const x = o.x + 30, y = o.y + 70, w = o.w - 60, h = o.h - 90;
    const vx = o.x + o.w * 0.58, vw = o.w * 0.4 - 20;
    const hasVis = this.notebookVisual(o, vx, y, vw, h - 10);
    const tw = hasVis ? vx - x - 20 : w;
    if (!lines.length) { o.c.add(T(this, x, y, '이 장치와 관련해 기록한 단서가 아직 없습니다.\n주변 물건을 조사해 보세요.', 17, C.dim, { wordWrap: { width: tw }, lineSpacing: 6 })); return; }
    const tt = T(this, x, y, lines.join('\n\n'), 16, '#d3def3', { wordWrap: { width: tw }, lineSpacing: 5 }); o.c.add(tt);
    for (const sz of [15, 14]) { if (tt.height <= h) break; tt.setFontSize(sz).setLineSpacing(3); }
  }

  hint() {
    const H = this.hints();
    if (!H.length) { this.setFeedback('이 화면에서 더 할 일은 없습니다.', 'info'); return; }
    const lv = Math.min(this.hintLv, H.length - 1);
    this.hintLv++; G.run.hintsUsed++;
    Audio.play('ai');
    this.setFeedback(`힌트 ${lv + 1}/${H.length}: ${H[lv]}`, 'warn');
  }

  /** "specimen recovered" card; Continue hands the bone to the world (pickup + archive + world change) */
  found(id: string, title: string, body: string, tex = `bone_bone_${id}`) {
    this.solved = true;
    Audio.play('success');
    this.closeLayer();
    const o = this.overlay(title, 880, 540, C.green);
    const left = Math.min(320, o.w * 0.36);
    const im = this.add.image(o.x + 30 + left / 2, o.y + 50 + (o.h - 50) / 2, tex); o.c.add(im);
    im.setScale(Math.min((left - 20) / im.width, (o.h - 90) / im.height));
    const tx = o.x + 50 + left, tw = o.w - left - 80;
    o.c.add(T(this, tx, o.y + 76, '해부학 도감에 등록되었습니다', 19, C.greenS, { weight: '700' }));
    const bt = T(this, tx, o.y + 114, body, 17, '#d3def3', { wordWrap: { width: tw }, lineSpacing: 6 }); o.c.add(bt);
    for (const sz of [16, 15]) { if (bt.y + bt.height < o.y + o.h - 80) break; bt.setFontSize(sz).setLineSpacing(3); }
    o.c.add(new Button(this, o.x + o.w - 130, o.y + o.h - 40, '계속', () => { Bus.emit('investigate:found', id); this.scene.stop(); }, { w: 200, h: 50, icon: 'check', accent: C.green, primary: true }));
  }

  /** puzzle solved without a specimen in hand (the world changes instead) */
  done(key: string, msg: string) {
    this.solved = true;
    Audio.play('success'); this.cameras.main.flash(250, 80, 255, 180);
    this.setFeedback(msg, 'ok');
    this.time.delayedCall(1500, () => { Bus.emit('investigate:done', key); this.scene.stop(); });
  }

  /** a big pill-shaped instruction label inside a view */
  tip(x: number, y: number, s: string, parent?: Phaser.GameObjects.Container, size = 17) {
    const t = T(this, x, y, s, size, '#ffe0a0', { weight: '700', align: 'center', lineSpacing: 4 }).setOrigin(0.5);
    parent?.add(t);
    return t;
  }

  /** straight-line drag helper: calls back with the pointer delta since drag start */
  dragDelta(o: Phaser.GameObjects.GameObject, cb: (dx: number, dy: number, p: Phaser.Input.Pointer) => void, end?: (p: Phaser.Input.Pointer) => void) {
    let sx = 0, sy = 0;
    o.on('dragstart', (p: Phaser.Input.Pointer) => { sx = p.worldX; sy = p.worldY; });
    o.on('drag', (p: Phaser.Input.Pointer) => cb(p.worldX - sx, p.worldY - sy, p));
    if (end) o.on('dragend', end);
  }
}
