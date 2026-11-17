import Phaser from 'phaser';
import { PuzzleBase, distBone } from './PuzzleBase';
import { View } from '../../core/view';
import { Audio } from '../../core/audio';
import { G } from '../../game/state';
import { BONES, BoneId, FRAME, UPPER_ORDER } from '../../data/anatomy';
import { boneBounds, DENSITY } from '../../art/bones';
import { T, C, drawIcon } from '../../ui/widgets';

interface Piece { id: BoneId; img: Phaser.GameObjects.Image; home: { x: number; y: number; s: number }; placed: boolean; label: Phaser.GameObjects.Text; card: Phaser.GameObjects.Graphics }

/**
 * PUZZLE 1 — 상지 골격 조립 (right upper limb, anterior view).
 * Drag each recovered specimen onto its anatomical position. Detect & discard the contaminated specimen (fibula).
 */
export class AssemblyPuzzle extends PuzzleBase {
  constructor() { super('Assembly'); }
  fs = 0.6; fx = 0; fy = 0;
  pieces: Piece[] = [];
  bin!: { x: number; y: number; w: number; h: number; g: Phaser.GameObjects.Graphics };
  discarded = false;
  progressT!: Phaser.GameObjects.Text;
  ghosts: Partial<Record<BoneId, Phaser.GameObjects.Image>> = {};
  nodes: Partial<Record<BoneId, Phaser.GameObjects.Image>> = {};

  create() {
    this.initView();
    this.pieces = []; this.discarded = false; this.ghosts = {}; this.nodes = {};
    const adv = G.run.difficulty === 'adv';
    this.frame('골격 복구 테이블 · 상지 골격 재조립', adv ? '오른쪽 상지, 앞면(전면) — 표본의 형태만 보고 제자리를 찾으세요. 오염 표본은 폐기함으로.' : '오른쪽 상지를 앞에서 본 모습입니다. 표본을 끌어 윤곽에 맞춰 놓으세요. 상지가 아닌 표본은 폐기함으로!');
    const { W, H } = View;
    const portrait = H > W;
    // ---- frame area (left) ----
    const areaW = portrait ? this.pw - 40 : this.pw * 0.56, areaH = portrait ? this.ph * 0.56 : this.ph - 190;
    this.fs = Math.min(areaH / FRAME.h, areaW / FRAME.w) * 0.98;
    this.fx = this.px + 20 + (areaW - FRAME.w * this.fs) / 2;
    this.fy = this.py + 76 + (areaH - FRAME.h * this.fs) / 2;
    // holo backdrop canvas
    const key = 'torso_holo';
    const plate = this.add.graphics();
    plate.fillStyle(0x03101c, 0.7); plate.fillRoundedRect(this.fx - 10, this.fy - 10, FRAME.w * this.fs + 20, FRAME.h * this.fs + 20, 12);
    plate.lineStyle(1, C.cyan, 0.25); plate.strokeRoundedRect(this.fx - 10, this.fy - 10, FRAME.w * this.fs + 20, FRAME.h * this.fs + 20, 12);
    this.add.image(this.fx, this.fy, key).setOrigin(0).setScale(this.fs / DENSITY).setAlpha(0.9);
    // orientation labels
    const lab = (x: number, y: number, s: string) => T(this, x, y, s, 13, '#6fb9d8', { weight: '700' }).setOrigin(0.5);
    lab(this.fx + 40 * this.fs, this.fy + 20, '← 외측 (Lateral)');
    lab(this.fx + 640 * this.fs, this.fy + 20, '정중선 (Midline)');
    lab(this.fx + 690 * this.fs, this.fy + FRAME.h * this.fs - 14, 'R · 전면');
    // slots
    for (const id of UPPER_ORDER) {
      const b = boneBounds(id);
      const cx = this.fx + b.cx * this.fs, cy = this.fy + b.cy * this.fs;
      if (!adv) {
        const gh = this.add.image(cx, cy, `bone_ghost_${id}`).setScale(this.fs / DENSITY);
        this.tweens.add({ targets: gh, alpha: 0.55, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        this.ghosts[id] = gh;
      }
      const node = this.add.image(cx, cy, 'ring').setScale(0.12).setTint(C.cyan).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.7);
      this.tweens.add({ targets: node, scale: 0.16, alpha: 0.3, duration: 900, yoyo: true, repeat: -1 });
      this.nodes[id] = node;
    }
    // ---- tray (right) ----
    const tx = portrait ? this.px + 30 : this.px + this.pw * 0.58, ty = portrait ? this.fy + FRAME.h * this.fs + 24 : this.py + 90;
    const tw = portrait ? this.pw - 60 : this.pw * 0.42 - 40;
    T(this, tx, ty, adv ? '회수한 표본 (미분류)' : '회수한 골격 표본', 18, C.cyanS, { weight: '700' });
    this.progressT = T(this, tx + tw, ty, '', 16, C.dim, { weight: '700' }).setOrigin(1, 0);
    const cols = portrait ? 6 : 3, gap = 12;
    const cw = (tw - gap * (cols - 1)) / cols, ch = portrait ? Math.min(170, cw * 1.4) : Math.min(190, (this.ph - 300) / 2 - gap);
    const ids = Phaser.Utils.Array.Shuffle([...G.run.bones]) as BoneId[];
    ids.forEach((id, i) => {
      const x = tx + (i % cols) * (cw + gap), y = ty + 34 + Math.floor(i / cols) * (ch + gap);
      const card = this.add.graphics();
      card.fillStyle(0x0a1222, 0.9); card.fillRoundedRect(x, y, cw, ch, 10); card.lineStyle(1.2, C.line, 1); card.strokeRoundedRect(x, y, cw, ch, 10);
      const img = this.add.image(x + cw / 2, y + ch / 2 - 10, `bone_bone_${id}`);
      const s = Math.min((cw - 20) / img.width, (ch - 44) / img.height);
      img.setScale(s);
      const label = T(this, x + cw / 2, y + ch - 16, adv ? `표본 #${i + 1}` : `${BONES[id].ko} · ${BONES[id].en}`, 14, C.white, { weight: '700' }).setOrigin(0.5);
      img.setInteractive({ useHandCursor: true, draggable: true, pixelPerfect: false });
      const p: Piece = { id, img, home: { x: img.x, y: img.y, s }, placed: false, label, card };
      this.pieces.push(p);
    });
    // ---- discard bin ----
    const by = ty + 34 + Math.ceil(ids.length / cols) * (ch + gap) + 4;
    const bw = Math.min(tw, 360), bh = 74;
    const bg = this.add.graphics();
    this.bin = { x: tx, y: by, w: bw, h: bh, g: bg };
    this.drawBin(false);
    T(this, tx + 70, by + bh / 2 - 10, '오염 표본 폐기함', 18, C.redS, { weight: '700' }).setOrigin(0, 0.5);
    T(this, tx + 70, by + bh / 2 + 14, '상지 골격이 아닌 표본을 여기에 버리세요', 13, C.dim).setOrigin(0, 0.5);
    this.updateProgress();
    this.setFeedback(adv ? '각 표본을 드래그해 해당 위치에 놓으세요. 위치를 표시한 링은 관절 기준점입니다.' : '표본을 드래그해서 같은 모양의 점선 윤곽에 놓으세요. 이름과 위치 관계(외측·내측)를 함께 기억하세요.', 'info', tx, Math.min(tw, this.pw - 60));
    // ---- drag logic ----
    this.input.on('dragstart', (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.Image) => {
      const pc = this.pieces.find(q => q.img === obj); if (!pc || pc.placed || this.solved) return;
      obj.setDepth(100);
      Audio.play('click');
      this.tweens.add({ targets: obj, scale: this.fs / DENSITY, duration: 160 });
      if (!adv) this.setFeedback(`${BONES[pc.id].ko} (${BONES[pc.id].alt}) · ${BONES[pc.id].en}`, 'info', tx, Math.min(tw, this.pw - 60));
    });
    this.input.on('drag', (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.Image, dx: number, dy: number) => {
      const pc = this.pieces.find(q => q.img === obj); if (!pc || pc.placed || this.solved) return;
      obj.setPosition(dx, dy);
      this.drawBin(this.inBin(dx, dy));
    });
    this.input.on('dragend', (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.Image) => {
      const pc = this.pieces.find(q => q.img === obj); if (!pc || pc.placed || this.solved) return;
      this.drawBin(false);
      this.drop(pc, tx, Math.min(tw, this.pw - 60));
    });
  }

  inBin(x: number, y: number) { const b = this.bin; return x > b.x - 20 && x < b.x + b.w + 20 && y > b.y - 30 && y < b.y + b.h + 30; }
  drawBin(hot: boolean) {
    const { x, y, w, h, g } = this.bin; g.clear();
    g.fillStyle(C.red, hot ? 0.25 : 0.08); g.fillRoundedRect(x, y, w, h, 10);
    g.lineStyle(hot ? 2.5 : 1.5, C.red, hot ? 1 : 0.6); g.strokeRoundedRect(x, y, w, h, 10);
    drawIcon(g, 'close', x + 36, y + h / 2, 26, C.red);
  }

  updateProgress() {
    const n = this.pieces.filter(p => p.placed && p.id !== 'fibula').length;
    this.progressT.setText(`조립 ${n}/5 · 폐기 ${this.discarded ? 1 : 0}/1`);
  }

  back(pc: Piece) {
    this.tweens.add({ targets: pc.img, x: pc.home.x, y: pc.home.y, scale: pc.home.s, duration: 300, ease: 'Cubic.out', onComplete: () => pc.img.setDepth(0) });
  }

  drop(pc: Piece, fbx: number, fbw: number) {
    const fx = (pc.img.x - this.fx) / this.fs, fy = (pc.img.y - this.fy) / this.fs;
    const b = BONES[pc.id];
    // discard bin
    if (this.inBin(pc.img.x, pc.img.y)) {
      if (pc.id === 'fibula') {
        pc.placed = true; this.discarded = true;
        Audio.play('snap');
        this.tweens.add({ targets: pc.img, scale: 0, alpha: 0, angle: 180, duration: 400, ease: 'Back.in' });
        pc.label.setText('폐기됨 · 비골(Fibula)').setColor(C.redS);
        this.setFeedback('정확합니다! ' + b.wrongSlot, 'ok', fbx, fbw);
        this.updateProgress(); this.check();
      } else {
        Audio.play('error'); this.mistake(); G.run.stats.assembly++;
        this.setFeedback(`${G.run.difficulty === 'adv' ? '이 표본' : b.ko}은(는) 상지 골격입니다. 폐기하면 안 돼요!`, 'err', fbx, fbw);
        this.back(pc);
      }
      return;
    }
    // own slot? (forgiving)
    if (pc.id !== 'fibula' && distBone(pc.id, fx, fy) < 34) {
      const bb = boneBounds(pc.id);
      pc.placed = true; pc.img.disableInteractive();
      this.tweens.add({ targets: pc.img, x: this.fx + bb.cx * this.fs, y: this.fy + bb.cy * this.fs, scale: this.fs / DENSITY, duration: 180, ease: 'Back.out' });
      Audio.play('snap');
      this.ghosts[pc.id]?.destroy(); this.nodes[pc.id]?.destroy();
      const flash = this.add.image(this.fx + bb.cx * this.fs, this.fy + bb.cy * this.fs, `bone_holo_${pc.id}`).setScale(this.fs / DENSITY).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: flash, alpha: 0, duration: 700, onComplete: () => flash.destroy() });
      pc.label.setText(`✓ ${b.ko} · ${b.en}`).setColor(C.greenS);
      this.setFeedback(`${b.ko}(${b.alt}) 장착 완료 — ${b.info}`, 'ok', fbx, fbw);
      this.updateProgress(); this.check();
      return;
    }
    // dropped on a different slot?
    let best: BoneId | null = null, bd = 1e9;
    for (const id of UPPER_ORDER) { if (id === pc.id) continue; const d = distBone(id, fx, fy); if (d < bd) { bd = d; best = id; } }
    if (best && bd < 22) {
      Audio.play('error'); this.mistake(); G.run.stats.assembly++;
      this.cameras.main.shake(120, 0.003);
      const where = G.run.difficulty === 'adv' ? '' : ` (그 자리는 ${BONES[best].ko} 자리입니다.)`;
      this.setFeedback(`${b.wrongSlot}${where}`, 'err', fbx, fbw);
      this.back(pc);
      return;
    }
    this.back(pc);
  }

  check() {
    const allPlaced = UPPER_ORDER.every(id => this.pieces.find(p => p.id === id)?.placed);
    if (!allPlaced || !this.discarded) return;
    this.solved = true;
    // glow sweep across assembled limb
    for (const id of UPPER_ORDER) {
      const bb = boneBounds(id);
      const h = this.add.image(this.fx + bb.cx * this.fs, this.fy + bb.cy * this.fs, `bone_holo_${id}`).setScale(this.fs / DENSITY).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
      this.tweens.add({ targets: h, alpha: 0.9, duration: 300, delay: UPPER_ORDER.indexOf(id) * 140, yoyo: true, hold: 300 });
    }
    this.setFeedback('상지 골격 재조립 완료! 흉쇄관절 → 견쇄관절 → 견갑상완관절 → 팔꿉관절로 이어지는 사슬이 복구되었습니다.', 'ok');
    this.success('c_girdle', '상지는 흉쇄관절로만 몸통 골격과 이어진다', 1800);
  }
}
