import Phaser from 'phaser';
import { PuzzleBase } from './PuzzleBase';
import { View } from '../../core/view';
import { Audio } from '../../core/audio';
import { G } from '../../game/state';
import { LANDMARKS, XRAY_TARGETS, XRAY_DISTRACTORS_BASIC, XRAY_DISTRACTORS_ADV } from '../../data/anatomy';
import { makeXrayTexture, boneBounds, DENSITY } from '../../art/bones';
import { T, C, Button } from '../../ui/widgets';

interface Chip { id: string; c: Phaser.GameObjects.Container; home: { x: number; y: number }; done: boolean; bg: Phaser.GameObjects.Graphics; w: number }
interface Mark { id: string; n: number; x: number; y: number; sx: number; sy: number; filled: boolean; g: Phaser.GameObjects.Graphics }

/**
 * PUZZLE 3 — X-ray 판독. Label the numbered structures on an AP shoulder radiograph by dragging name chips.
 * Distractor labels belong to structures that are not visible on this film.
 */
export class XrayPuzzle extends PuzzleBase {
  constructor() { super('Xray'); }
  chips: Chip[] = []; marks: Mark[] = [];
  tags: { x: number; y: number; w: number; h: number }[] = [];
  film = { x: 0, y: 0, w: 0, h: 0 };
  overlay!: Phaser.GameObjects.Container; overlayOn = false;

  create() {
    this.initView();
    this.chips = []; this.marks = []; this.tags = []; this.overlayOn = false;
    const adv = G.run.difficulty === 'adv';
    this.frame('영상 판독기 · 어깨 AP 방사선 사진', '번호가 표시된 구조물에 알맞은 이름표를 끌어다 붙이세요. 이 영상에 보이지 않는 구조의 이름표도 섞여 있습니다.', C.cyan);
    const { W, H } = View; const portrait = H > W;
    const film = makeXrayTexture(this);
    const areaW = portrait ? this.pw - 60 : this.pw * 0.56, areaH = portrait ? this.ph * 0.55 : this.ph - 190;
    const s = Math.min(areaW / film.w, areaH / film.h);
    const fx = this.px + 30 + (areaW - film.w * s) / 2, fy = this.py + 80 + (areaH - film.h * s) / 2;
    // lightbox glow
    this.film = { x: fx, y: fy, w: film.w * s, h: film.h * s };
    const lb = this.add.graphics(); lb.fillStyle(0xbfe6ff, 0.08); lb.fillRoundedRect(fx - 16, fy - 16, film.w * s + 32, film.h * s + 32, 10);
    lb.lineStyle(2, 0x9fd8ff, 0.5); lb.strokeRoundedRect(fx - 16, fy - 16, film.w * s + 32, film.h * s + 32, 10);
    this.add.image(fx, fy, film.key).setOrigin(0).setScale(s / DENSITY);
    // real-bone overlay for comparison (basic mode)
    this.overlay = this.add.container(0, 0).setAlpha(0);
    const mask = this.make.graphics({}, false); mask.fillRect(fx, fy, film.w * s, film.h * s);
    for (const id of ['scapula', 'clavicle', 'humerus'] as const) {
      const b = boneBounds(id);
      this.overlay.add(this.add.image(fx + (b.cx - film.x) * s, fy + (b.cy - film.y) * s, `bone_bone_${id}`).setScale(s / DENSITY));
    }
    this.overlay.setMask(mask.createGeometryMask());
    // markers
    const order = Phaser.Utils.Array.Shuffle([...XRAY_TARGETS]) as string[];
    order.forEach((id, i) => {
      const L = LANDMARKS[id];
      const x = fx + (L.x - film.x) * s, y = fy + (L.y - film.y) * s;
      // short leader towards the side with free space (lateral structures -> left, others -> right/down)
      const leftSide = L.x < 300;
      const sx = x + (leftSide ? -54 : 54);
      const sy = y + (i % 2 ? 22 : -22);
      const g = this.add.graphics();
      const m: Mark = { id, n: i + 1, x, y, sx, sy, filled: false, g };
      this.marks.push(m);
      this.drawMark(m, false);
      T(this, x + 13, y - 13, String(i + 1), 16, '#ffe08a', { weight: '700' }).setOrigin(0.5).setShadow(0, 0, '#000', 4, true, true);
    });
    // chips
    const labels = Phaser.Utils.Array.Shuffle([...XRAY_TARGETS, ...(adv ? XRAY_DISTRACTORS_ADV : XRAY_DISTRACTORS_BASIC)]) as string[];
    const cx0 = portrait ? this.px + 30 : this.px + this.pw * 0.6 + 20, cy0 = portrait ? fy + film.h * s + 40 : this.py + 100;
    const cw = portrait ? this.pw - 60 : this.pw * 0.4 - 70;
    T(this, cx0, cy0 - 6, '이름표', 17, C.cyanS, { weight: '700' });
    const colN = portrait ? 4 : 2; const chW = (cw - (colN - 1) * 12) / colN;
    labels.forEach((id, i) => {
      const L = LANDMARKS[id];
      const x = cx0 + (i % colN) * (chW + 12) + chW / 2, y = cy0 + 40 + Math.floor(i / colN) * 66;
      const c = this.add.container(x, y);
      const bg = this.add.graphics();
      const t = T(this, 0, 0, adv ? L.en : `${L.ko}  ${L.en}`, adv ? 18 : 16, C.white, { weight: '700' }).setOrigin(0.5);
      const w = Math.min(chW, Math.max(t.width + 30, 120));
      c.add([bg, t]); c.setSize(w, 50);
      c.setInteractive({ draggable: true, useHandCursor: true });
      const chip: Chip = { id, c, home: { x, y }, done: false, bg, w };
      this.drawChip(chip, 'idle');
      this.chips.push(chip);
    });
    if (!adv) {
      const by = cy0 + 40 + Math.ceil(labels.length / colN) * 66 + 20;
      new Button(this, cx0 + Math.min(cw, 380) / 2, by, '실제 뼈 겹쳐 보기 (비교)', () => {
        this.overlayOn = !this.overlayOn; this.tweens.add({ targets: this.overlay, alpha: this.overlayOn ? 0.5 : 0, duration: 300 });
      }, { w: Math.min(cw, 380), h: 54, icon: 'eye', size: 18 });
    }
    this.setFeedback('영상의 R 표시는 환자의 오른쪽입니다. 정면(AP) 영상에서는 앞뒤 구조가 겹쳐 보인다는 점을 기억하세요.', 'info');

    this.input.on('dragstart', (_p: any, obj: Phaser.GameObjects.Container) => { const ch = this.chips.find(c => c.c === obj); if (!ch || ch.done || this.solved) return; obj.setDepth(100); this.drawChip(ch, 'drag'); Audio.play('click'); });
    this.input.on('drag', (_p: any, obj: Phaser.GameObjects.Container, x: number, y: number) => { const ch = this.chips.find(c => c.c === obj); if (!ch || ch.done || this.solved) return; obj.setPosition(x, y); this.hover(x, y); });
    this.input.on('dragend', (_p: any, obj: Phaser.GameObjects.Container) => { const ch = this.chips.find(c => c.c === obj); if (!ch || ch.done || this.solved) return; this.drop(ch); });
  }

  /** Compact label on the film, nudged so tags never overlap and stay inside the film. */
  placeTag(m: Mark, text: string) {
    const t = T(this, 0, 0, text, 13, '#eafff4', { weight: '700' }).setOrigin(0, 0.5).setDepth(20);
    const w = t.width + 16, h = 24;
    const left = m.sx < m.x;
    let x = left ? m.sx - w : m.sx, y = m.sy - h / 2;
    x = Phaser.Math.Clamp(x, this.film.x + 4, this.film.x + this.film.w - w - 4);
    for (let k = 0; k < 20 && this.tags.some(r => !(x + w < r.x || x > r.x + r.w || y + h < r.y || y > r.y + r.h)); k++) y += (m.sy > m.y ? 1 : -1) * (h + 4);
    y = Phaser.Math.Clamp(y, this.film.y + 4, this.film.y + this.film.h - h - 4);
    this.tags.push({ x, y, w, h });
    const g = this.add.graphics().setDepth(19);
    g.lineStyle(1.5, C.green, 0.9); g.lineBetween(m.x, m.y, left ? x + w : x, y + h / 2);
    g.fillStyle(0x062a1c, 0.92); g.fillRoundedRect(x, y, w, h, 6); g.lineStyle(1.5, C.green, 1); g.strokeRoundedRect(x, y, w, h, 6);
    t.setPosition(x + 8, y + h / 2);
    g.setAlpha(0); t.setAlpha(0); this.tweens.add({ targets: [g, t], alpha: 1, duration: 200 });
  }

  nearest(x: number, y: number) {
    let best: Mark | null = null, bd = 1e9;
    for (const m of this.marks) { if (m.filled) continue; const d = Math.min(Phaser.Math.Distance.Between(x, y, m.x, m.y), Phaser.Math.Distance.Between(x, y, m.sx, m.sy)); if (d < bd) { bd = d; best = m; } }
    return bd < 56 ? best : null;
  }
  hover(x: number, y: number) { const n = this.nearest(x, y); for (const m of this.marks) if (!m.filled) this.drawMark(m, m === n); }

  drawMark(m: Mark, hot: boolean) {
    const g = m.g; g.clear();
    const col = m.filled ? C.green : hot ? 0xffe08a : 0xffc24d;
    g.lineStyle(1.5, col, 0.8); g.lineBetween(m.x, m.y, m.sx, m.sy);
    g.lineStyle(2.5, col, 1); g.strokeCircle(m.x, m.y, hot ? 13 : 10); g.fillStyle(col, 1); g.fillCircle(m.x, m.y, 3.5);
    if (hot) { g.fillStyle(col, 0.2); g.fillCircle(m.x, m.y, 24); }
    g.fillStyle(col, 1); g.fillCircle(m.sx, m.sy, 4);
  }

  drawChip(ch: Chip, st: 'idle' | 'drag' | 'ok' | 'err') {
    const col = { idle: C.cyan, drag: 0xffe08a, ok: C.green, err: C.red }[st];
    const g = ch.bg; g.clear();
    g.fillStyle(st === 'ok' ? 0x08281c : 0x0a1222, 0.95); g.fillRoundedRect(-ch.w / 2, -24, ch.w, 48, 10);
    g.lineStyle(st === 'idle' ? 1.4 : 2.2, col, 1); g.strokeRoundedRect(-ch.w / 2, -24, ch.w, 48, 10);
  }

  drop(ch: Chip) {
    const m = this.nearest(ch.c.x, ch.c.y);
    for (const mm of this.marks) if (!mm.filled) this.drawMark(mm, false);
    const L = LANDMARKS[ch.id];
    const adv = G.run.difficulty === 'adv';
    if (!m) { this.drawChip(ch, 'idle'); this.tweens.add({ targets: ch.c, x: ch.home.x, y: ch.home.y, duration: 250, ease: 'Cubic.out' }); return; }
    if (m.id === ch.id) {
      ch.done = true; m.filled = true; ch.c.disableInteractive();
      this.drawChip(ch, 'ok'); this.drawMark(m, false);
      this.tweens.add({ targets: ch.c, x: m.x, y: m.y, scale: 0.3, alpha: 0, duration: 200, ease: 'Cubic.in' });
      this.placeTag(m, G.run.difficulty === 'adv' ? L.en : `${L.ko} ${L.en}`);
      Audio.play('snap');
      this.setFeedback(`${m.n}번 = ${L.ko} (${L.en}) ✓  ${L.where}`, 'ok');
      if (this.marks.every(x => x.filled)) this.finish();
      return;
    }
    Audio.play('error'); this.mistake(); G.run.stats.xray++;
    this.drawChip(ch, 'err');
    this.tweens.add({ targets: ch.c, x: ch.home.x, y: ch.home.y, duration: 320, ease: 'Cubic.out', onComplete: () => this.drawChip(ch, 'idle') });
    const T2 = LANDMARKS[m.id];
    this.setFeedback(adv ? `${m.n}번은 ${L.en}이(가) 아닙니다. ${L.en}: ${L.where}` : `${m.n}번은 ${L.ko}이(가) 아닙니다. ${L.ko}: ${L.where}  (힌트: ${m.n}번은 ${T2.where.split('.')[0]})`, 'err');
  }

  finish() {
    this.solved = true;
    for (const ch of this.chips) if (!ch.done) this.tweens.add({ targets: ch.c, alpha: 0.25, duration: 300 });
    this.setFeedback('판독 완료! 남은 이름표(소결절·주두 등)는 이 영상에서 번호로 표시되지 않은 구조입니다.', 'ok');
    this.success('c_xray', '어깨 AP 영상에서 견봉·오구돌기·관절와·상완골두·대결절을 구별한다', 1600);
  }
}
