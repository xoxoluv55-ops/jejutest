import Phaser from 'phaser';
import { PuzzleBase } from './PuzzleBase';
import { View } from '../../core/view';
import { Audio } from '../../core/audio';
import { G } from '../../game/state';
import { MUSCLES, MuscleId, ATLAS_TARGETS, ATLAS_DECOYS_BASIC, ATLAS_DECOYS_ADV } from '../../data/muscles';
import { plateKey, makeMuscleTexture, labelPoint, MODEL_CREDIT } from '../../art/muscles';
import { DENSITY } from '../../art/bones';
import { T, C, Button } from '../../ui/widgets';

interface Chip { id: MuscleId; c: Phaser.GameObjects.Container; home: { x: number; y: number }; done: boolean; bg: Phaser.GameObjects.Graphics; w: number }
interface Mark { id: MuscleId; n: number; x: number; y: number; filled: boolean; g: Phaser.GameObjects.Graphics; glow: Phaser.GameObjects.Image }

/**
 * CH2 PUZZLE 1 — 근육 지도 판독 (name ↔ location). Six superficial anterior shoulder/arm muscles are numbered on an
 * anatomical plate; drag the correct name onto each number. Decoy names are posterior muscles not visible from the front.
 */
export class MuscleAtlasPuzzle extends PuzzleBase {
  constructor() { super('Atlas'); }
  chips: Chip[] = []; marks: Mark[] = [];
  s = 0.6; fx = 0; fy = 0;
  hiOn = false;

  create() {
    this.initView();
    this.chips = []; this.marks = []; this.hiOn = false;
    const adv = G.run.difficulty === 'adv';
    this.frame('근육 표본실 · 근육 지도 판독', '번호가 붙은 근육에 알맞은 이름표를 끌어다 놓으세요. 앞에서는 보이지 않는 근육의 이름도 섞여 있습니다.', C.pink);
    const { W, H } = View; const portrait = H > W;
    // crop to the region that holds the muscles (frame x 140..700, y 110..1110)
    const crop = { x: 140, y: 110, w: 560, h: 1000 };
    const areaW = portrait ? this.pw - 60 : this.pw * 0.5, areaH = portrait ? this.ph * 0.56 : this.ph - 180;
    this.s = Math.min(areaW / crop.w, areaH / crop.h);
    this.fx = this.px + 30 + (areaW - crop.w * this.s) / 2 - crop.x * this.s;
    this.fy = this.py + 78 + (areaH - crop.h * this.s) / 2 - crop.y * this.s;
    const pl = this.add.graphics();
    pl.fillStyle(0x12060c, 0.75); pl.fillRoundedRect(this.fx + crop.x * this.s - 12, this.fy + crop.y * this.s - 12, crop.w * this.s + 24, crop.h * this.s + 24, 12);
    pl.lineStyle(1.5, C.pink, 0.35); pl.strokeRoundedRect(this.fx + crop.x * this.s - 12, this.fy + crop.y * this.s - 12, crop.w * this.s + 24, crop.h * this.s + 24, 12);
    // plate rendered from the BodyParts3D model (all muscles, true depth order)
    const img = this.add.image(this.fx, this.fy, plateKey('full')).setOrigin(0).setScale(this.s / DENSITY);
    const mask = this.make.graphics({}, false); mask.fillRect(this.fx + crop.x * this.s, this.fy + crop.y * this.s, crop.w * this.s, crop.h * this.s);
    img.setMask(mask.createGeometryMask());
    T(this, this.fx + crop.x * this.s + 8, this.fy + crop.y * this.s + 6, '오른팔 · 앞면 (Anterior)', 14, C.pinkS, { weight: '700' });
    T(this, this.fx + (crop.x + crop.w) * this.s, this.fy + (crop.y + crop.h) * this.s + 16, MODEL_CREDIT, 11, '#8f7f88').setOrigin(1, 0.5);
    T(this, this.fx + crop.x * this.s + 8, this.fy + (crop.y + crop.h) * this.s - 24, '← 외측', 13, '#ffb3c6', { weight: '700' });
    T(this, this.fx + (crop.x + crop.w) * this.s - 8, this.fy + (crop.y + crop.h) * this.s - 24, '내측 →', 13, '#ffb3c6', { weight: '700' }).setOrigin(1, 0);
    // numbered markers (random numbering)
    const ids = Phaser.Utils.Array.Shuffle([...ATLAS_TARGETS]) as MuscleId[];
    ids.forEach((id, i) => {
      const [lx, ly] = labelPoint(this, id);   // inside the muscle's visible region on the plate
      const x = this.fx + lx * this.s, y = this.fy + ly * this.s;
      const mt = makeMuscleTexture(this, id, 'glow');
      // whole-muscle highlight layer (also shows the parts hidden under superficial muscles)
      const glow = this.add.image(this.fx + (mt.x + mt.w / 2) * this.s, this.fy + (mt.y + mt.h / 2) * this.s, mt.key).setScale(this.s / DENSITY).setAlpha(0).setDepth(3);
      const g = this.add.graphics().setDepth(5);
      const m: Mark = { id, n: i + 1, x, y, filled: false, g, glow };
      this.marks.push(m); this.drawMark(m, false);
      T(this, x, y, String(i + 1), 16, '#1a0610', { weight: '800' }).setOrigin(0.5).setDepth(6);
    });
    // name chips
    const labels = Phaser.Utils.Array.Shuffle([...ATLAS_TARGETS, ...(adv ? ATLAS_DECOYS_ADV : ATLAS_DECOYS_BASIC)]) as MuscleId[];
    const cx0 = portrait ? this.px + 30 : this.px + this.pw * 0.54 + 10, cy0 = portrait ? this.fy + (crop.y + crop.h) * this.s + 40 : this.py + 100;
    const cw = portrait ? this.pw - 60 : this.pw * 0.46 - 60;
    T(this, cx0, cy0 - 6, '이름표', 17, C.pinkS, { weight: '700' });
    const colN = portrait ? 3 : 2; const chW = (cw - (colN - 1) * 12) / colN;
    labels.forEach((id, i) => {
      const M = MUSCLES[id];
      const x = cx0 + (i % colN) * (chW + 12) + chW / 2, y = cy0 + 40 + Math.floor(i / colN) * 66;
      const c = this.add.container(x, y).setDepth(30);
      const bg = this.add.graphics();
      const t = T(this, 0, 0, adv ? M.en : `${M.ko}  ${M.en}`, adv ? 18 : 16, C.white, { weight: '700' }).setOrigin(0.5);
      const w = Math.min(chW, Math.max(t.width + 30, 120));
      if (t.width > w - 16) t.setScale((w - 16) / t.width);
      c.add([bg, t]); c.setSize(w, 50);
      c.setInteractive({ draggable: true, useHandCursor: true });
      const chip: Chip = { id, c, home: { x, y }, done: false, bg, w };
      this.drawChip(chip, 'idle'); this.chips.push(chip);
    });
    const by = cy0 + 40 + Math.ceil(labels.length / colN) * 66 + 16;
    const guide = adv
      ? '단서: 근섬유의 방향과 부착 위치(어느 뼈에서 어느 뼈로)를 확인하세요.'
      : '단서\n• 삼각근은 어깨를 덮는 세모꼴, 대흉근은 가슴에서 부채꼴로 모입니다.\n• 상완이두근은 위팔 앞 가운데, 상완근은 그 아래 깊은 곳에서 양옆으로 보입니다.\n• 상완요골근은 전완 바깥쪽(엄지 쪽) 위를 따라 내려갑니다.';
    if (!adv) {
      new Button(this, cx0 + Math.min(cw, 380) / 2, by, '근육 전체 모양 강조', () => this.toggleHi(), { w: Math.min(cw, 380), h: 52, icon: 'eye', size: 17, accent: C.pink });
      T(this, cx0, by + 44, guide, 15, '#e3cfd8', { wordWrap: { width: cw }, lineSpacing: 6 });
    } else T(this, cx0, by, guide, 15, '#e3cfd8', { wordWrap: { width: cw }, lineSpacing: 6 });
    this.setFeedback('근육 지도 데이터가 손상되었습니다. 각 번호의 근육 이름을 복원하세요.', 'info');

    this.input.on('dragstart', (_p: any, obj: Phaser.GameObjects.Container) => { const ch = this.chips.find(c => c.c === obj); if (!ch || ch.done || this.solved) return; obj.setDepth(100); this.drawChip(ch, 'drag'); Audio.play('click'); });
    this.input.on('drag', (_p: any, obj: Phaser.GameObjects.Container, x: number, y: number) => { const ch = this.chips.find(c => c.c === obj); if (!ch || ch.done || this.solved) return; obj.setPosition(x, y); this.hover(x, y); });
    this.input.on('dragend', (_p: any, obj: Phaser.GameObjects.Container) => { const ch = this.chips.find(c => c.c === obj); if (!ch || ch.done || this.solved) return; obj.setDepth(30); this.drop(ch); });
  }

  toggleHi() {
    this.hiOn = !this.hiOn;
    for (const m of this.marks) if (!m.filled) this.tweens.add({ targets: m.glow, alpha: this.hiOn ? 0.45 : 0, duration: 250 });
  }

  nearest(x: number, y: number) {
    let best: Mark | null = null, bd = 1e9;
    for (const m of this.marks) { if (m.filled) continue; const d = Phaser.Math.Distance.Between(x, y, m.x, m.y); if (d < bd) { bd = d; best = m; } }
    return bd < 60 ? best : null;
  }
  hover(x: number, y: number) {
    const n = this.nearest(x, y);
    for (const m of this.marks) if (!m.filled) { this.drawMark(m, m === n); m.glow.setAlpha(m === n ? 0.55 : this.hiOn ? 0.45 : 0); }
  }

  drawMark(m: Mark, hot: boolean) {
    const g = m.g; g.clear();
    const col = m.filled ? C.green : hot ? 0xffe08a : 0xffd0dc;
    if (hot) { g.fillStyle(col, 0.25); g.fillCircle(m.x, m.y, 26); }
    g.fillStyle(col, 1); g.fillCircle(m.x, m.y, 14);
    g.lineStyle(2, 0x1a0610, 0.9); g.strokeCircle(m.x, m.y, 14);
  }

  drawChip(ch: Chip, st: 'idle' | 'drag' | 'ok' | 'err') {
    const col = { idle: C.pink, drag: 0xffe08a, ok: C.green, err: C.red }[st];
    const g = ch.bg; g.clear();
    g.fillStyle(st === 'ok' ? 0x08281c : 0x14070d, 0.95); g.fillRoundedRect(-ch.w / 2, -24, ch.w, 48, 10);
    g.lineStyle(st === 'idle' ? 1.4 : 2.2, col, 1); g.strokeRoundedRect(-ch.w / 2, -24, ch.w, 48, 10);
  }

  drop(ch: Chip) {
    const m = this.nearest(ch.c.x, ch.c.y);
    for (const mm of this.marks) if (!mm.filled) { this.drawMark(mm, false); mm.glow.setAlpha(this.hiOn ? 0.45 : 0); }
    const M = MUSCLES[ch.id];
    const adv = G.run.difficulty === 'adv';
    if (!m) { this.drawChip(ch, 'idle'); this.tweens.add({ targets: ch.c, x: ch.home.x, y: ch.home.y, duration: 250, ease: 'Cubic.out' }); return; }
    if (m.id === ch.id) {
      ch.done = true; m.filled = true; ch.c.disableInteractive();
      this.drawChip(ch, 'ok'); this.drawMark(m, false);
      m.glow.setAlpha(0.8); this.tweens.add({ targets: m.glow, alpha: 0, duration: 900 });
      this.tweens.add({ targets: ch.c, x: m.x, y: m.y, scale: 0.3, alpha: 0, duration: 200, ease: 'Cubic.in' });
      const tag = T(this, m.x + 20, m.y, adv ? M.en : M.ko, 14, '#eafff4', { weight: '700', backgroundColor: '#062a1ccc', padding: { x: 6, y: 3 } }).setOrigin(0, 0.5).setDepth(8);
      if (tag.x + tag.width > this.fx + 700 * this.s) tag.setOrigin(1, 0.5).setX(m.x - 20);
      Audio.play('snap');
      this.setFeedback(`${m.n}번 = ${M.ko} (${M.en}) ✓  기시: ${M.originText} → 정지: ${M.insertionText}`, 'ok');
      if (this.marks.every(x => x.filled)) this.finish();
      return;
    }
    Audio.play('error'); this.mistake(); G.run.stats.atlas++;
    this.drawChip(ch, 'err');
    this.tweens.add({ targets: ch.c, x: ch.home.x, y: ch.home.y, duration: 320, ease: 'Cubic.out', onComplete: () => this.drawChip(ch, 'idle') });
    const where = M.posterior ? `${M.ko}은(는) 몸의 뒤쪽에 있어 앞면 그림에는 보이지 않습니다 (${M.originText} → ${M.insertionText}).` : `${M.ko}: ${M.originText} → ${M.insertionText}.`;
    const hint = adv ? '' : `  힌트: ${m.n}번은 ${MUSCLES[m.id].insertionText}에 붙는 근육입니다.`;
    this.setFeedback(`${m.n}번은 ${adv ? M.en : M.ko}이(가) 아닙니다. ${where}${hint}`, 'err');
  }

  finish() {
    this.solved = true;
    for (const ch of this.chips) if (!ch.done) this.tweens.add({ targets: ch.c, alpha: 0.25, duration: 300 });
    this.setFeedback('근육 지도 복원 완료! 남은 이름표는 몸 뒤쪽에 있는 근육입니다.', 'ok');
    this.success('c_mmap', '어깨·위팔의 앞쪽 표층 근육과 그 위치를 구별한다', 1600);
  }
}
