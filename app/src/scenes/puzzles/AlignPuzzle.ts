import Phaser from 'phaser';
import { PuzzleBase } from './PuzzleBase';
import { View } from '../../core/view';
import { Audio } from '../../core/audio';
import { G } from '../../game/state';
import { BONES, FRAME, ALIGN_HINTS, LANDMARKS } from '../../data/anatomy';
import { boneBounds, DENSITY } from '../../art/bones';
import { T, C, Button } from '../../ui/widgets';

type Mov = 'humerus' | 'ulna' | 'radius';
interface MB { id: Mov; c: Phaser.GameObjects.Container; img: Phaser.GameObjects.Image; flip: boolean; mirror: boolean; ok: boolean; sel: Phaser.GameObjects.Image }

/**
 * PUZZLE 2 — 관절면 정렬. Humerus, ulna and radius are loaded upside-down and/or mirrored.
 * Use proximal/distal & medial/lateral landmarks to restore the correct articulation, then verify.
 */
export class AlignPuzzle extends PuzzleBase {
  constructor() { super('Align'); }
  fs = 0.6; fx = 0; fy = 0;
  mb: MB[] = [];
  selected: MB | null = null;
  selT!: Phaser.GameObjects.Text;
  arm!: Phaser.GameObjects.Container;
  busyAnim = false;

  create() {
    this.initView();
    this.mb = []; this.selected = null; this.busyAnim = false;
    const adv = G.run.difficulty === 'adv';
    this.frame('관절 보정 장치 · 관절면 정렬', '뼈를 눌러 선택하고 회전/반전으로 관절면을 맞춘 뒤 [정렬 검증]을 누르세요.', C.violet);
    const { W, H } = View; const portrait = H > W;
    const areaW = portrait ? this.pw - 40 : this.pw * 0.55, areaH = portrait ? this.ph * 0.58 : this.ph - 190;
    this.fs = Math.min(areaH / FRAME.h, areaW / FRAME.w);
    this.fx = this.px + 20 + (areaW - FRAME.w * this.fs) / 2;
    this.fy = this.py + 76 + (areaH - FRAME.h * this.fs) / 2;
    const plate = this.add.graphics();
    plate.fillStyle(0x0b0618, 0.7); plate.fillRoundedRect(this.fx - 10, this.fy - 10, FRAME.w * this.fs + 20, FRAME.h * this.fs + 20, 12);
    plate.lineStyle(1, C.violet, 0.3); plate.strokeRoundedRect(this.fx - 10, this.fy - 10, FRAME.w * this.fs + 20, FRAME.h * this.fs + 20, 12);
    this.add.image(this.fx, this.fy, 'torso_holo').setOrigin(0).setScale(this.fs / DENSITY).setAlpha(0.7);
    // axis legend
    const ax = this.fx + 30, ay = this.fy + FRAME.h * this.fs - 60;
    const g = this.add.graphics(); g.lineStyle(2, C.violet, 0.8);
    g.lineBetween(ax, ay, ax, ay - 50); g.fillStyle(C.violet, 1); g.fillTriangle(ax - 6, ay - 46, ax + 6, ay - 46, ax, ay - 58);
    T(this, ax + 10, ay - 52, '근위 (Proximal)', 12, C.violetS).setOrigin(0, 0.5);
    T(this, ax + 10, ay, '원위 (Distal)', 12, C.violetS).setOrigin(0, 0.5);
    T(this, this.fx + 40 * this.fs, this.fy + 20, '← 외측', 13, '#c8a8ff', { weight: '700' }).setOrigin(0.5);
    T(this, this.fx + 600 * this.fs, this.fy + 20, '내측 →', 13, '#c8a8ff', { weight: '700' }).setOrigin(0.5);
    // fixed bones
    for (const id of ['scapula', 'clavicle'] as const) { const b = boneBounds(id); this.add.image(this.fx + b.cx * this.fs, this.fy + b.cy * this.fs, `bone_bone_${id}`).setScale(this.fs / DENSITY); }
    // joint sockets (glow)
    const jp = [LANDMARKS.glenoid, { x: 276, y: 742 }];
    for (const j of jp) { const r = this.add.image(this.fx + j.x * this.fs, this.fy + j.y * this.fs, 'light').setScale(0.35).setTint(C.violet).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.6); this.tweens.add({ targets: r, alpha: 0.2, duration: 800, yoyo: true, repeat: -1 }); }
    // movable bones in an "arm" container pivoting at humeral head (for the demo)
    const pivot = { x: this.fx + LANDMARKS.head.x * this.fs, y: this.fy + LANDMARKS.head.y * this.fs };
    this.arm = this.add.container(pivot.x, pivot.y);
    const states: [boolean, boolean][] = Phaser.Utils.Array.Shuffle([[true, false], [false, true], [true, true]] as [boolean, boolean][]);
    (['humerus', 'ulna', 'radius'] as Mov[]).forEach((id, i) => {
      const b = boneBounds(id);
      const c = this.add.container(this.fx + b.cx * this.fs - pivot.x, this.fy + b.cy * this.fs - pivot.y);
      const sel = this.add.image(0, 0, `bone_holo_${id}`).setScale(this.fs / DENSITY * 1.04).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setTint(0xc8a8ff);
      const img = this.add.image(0, 0, `bone_bone_${id}`).setScale(this.fs / DENSITY);
      c.add([sel, img]);
      this.arm.add(c);
      const m: MB = { id, c, img, flip: states[i][0], mirror: states[i][1], ok: false, sel };
      this.apply(m, false);
      img.setInteractive({ useHandCursor: true, pixelPerfect: true, alphaTolerance: 10 });
      img.on('pointerup', () => this.select(m));
      this.mb.push(m);
    });
    // ---- controls (right) ----
    const cx0 = portrait ? this.px + 30 : this.px + this.pw * 0.58, cy0 = portrait ? this.fy + FRAME.h * this.fs + 30 : this.py + 100;
    const cw = portrait ? this.pw - 60 : this.pw * 0.42 - 40;
    T(this, cx0, cy0, '선택한 뼈', 16, C.violetS, { weight: '700' });
    this.selT = T(this, cx0, cy0 + 30, '— 뼈를 눌러 선택하세요 —', 24, C.white, { weight: '700' });
    const bw = Math.min(cw, 420);
    const b1 = new Button(this, cx0 + bw / 2, cy0 + 110, '상하 180° 회전', () => this.op('flip'), { w: bw, h: 62, icon: 'rotate', accent: C.violet, sound: 'rotate' });
    const b2 = new Button(this, cx0 + bw / 2, cy0 + 184, '좌우 반전 (거울상)', () => this.op('mirror'), { w: bw, h: 62, icon: 'flip', accent: C.violet, sound: 'rotate' });
    const b3 = new Button(this, cx0 + bw / 2, cy0 + 278, '정렬 검증', () => this.verify(), { w: bw, h: 70, icon: 'check', accent: C.green, primary: true, size: 24 });
    void b1; void b2; void b3;
    const guide = adv
      ? '단서: 근위/원위의 크기 차이, 관절면(머리·절흔)의 방향, 돌기가 향하는 쪽(내측/외측)을 확인하세요.'
      : '단서\n• 상완골두(둥근 머리)는 위·안쪽에서 관절와와 만납니다.\n• 척골은 근위부가 크고(주두), 요골은 원위부가 넓습니다.\n• 요골 경상돌기 = 엄지쪽(외측), 척골 경상돌기 = 새끼쪽(내측).';
    T(this, cx0, cy0 + 340, guide, 16, '#c9d6ee', { wordWrap: { width: cw }, lineSpacing: 6 });
    this.setFeedback('세 개의 뼈가 잘못 장착되어 있습니다. 하나씩 선택해서 바로잡으세요.', 'info');
    this.select(this.mb[0]);
  }

  apply(m: MB, anim = true) {
    const target = m.flip ? 180 : 0;
    m.img.setFlipX(m.mirror); m.sel.setFlipX(m.mirror);
    if (anim) this.tweens.add({ targets: m.c, angle: target, duration: 260, ease: 'Back.out' });
    else m.c.setAngle(target);
  }

  select(m: MB) {
    if (this.solved) return;
    this.selected = m;
    for (const o of this.mb) { this.tweens.killTweensOf(o.sel); o.sel.setAlpha(0); }
    this.tweens.add({ targets: m.sel, alpha: { from: 0.9, to: 0.35 }, duration: 700, yoyo: true, repeat: -1 });
    const b = BONES[m.id];
    this.selT.setText(G.run.difficulty === 'adv' ? `${b.en}` : `${b.ko} (${b.alt}) · ${b.en}`);
    Audio.play('click');
  }

  op(kind: 'flip' | 'mirror') {
    const m = this.selected; if (!m || this.solved || this.busyAnim) return;
    if (kind === 'flip') m.flip = !m.flip; else m.mirror = !m.mirror;
    if (kind === 'mirror') { this.tweens.add({ targets: m.img, scaleX: 0, duration: 110, yoyo: true, onYoyo: () => this.apply(m, false) }); }
    else this.apply(m);
  }

  verify() {
    if (this.solved || this.busyAnim) return;
    const wrong: string[] = [];
    for (const m of this.mb) {
      const ok = !m.flip && !m.mirror;
      m.ok = ok;
      const h = ALIGN_HINTS[m.id];
      if (!ok) {
        wrong.push(m.flip ? h.flip : h.mirror);
        m.img.setTint(0xff6a7f); this.time.delayedCall(500, () => m.img.clearTint());
        this.tweens.add({ targets: m.c, x: m.c.x + 5, duration: 50, yoyo: true, repeat: 3 });
      } else { m.img.setTint(0x9dffcf); this.time.delayedCall(500, () => m.img.clearTint()); }
    }
    if (wrong.length) {
      Audio.play('error'); this.mistake(); G.run.stats.align++;
      this.setFeedback(`정렬 오류 ${wrong.length}개 — ${wrong[0]}`, 'err');
      return;
    }
    this.solved = true; this.busyAnim = true;
    Audio.play('snap');
    this.setFeedback('관절면 정렬 완료! 견갑상완관절 외전(abduction) 시연 중…', 'ok');
    // abduction demo around the humeral head (patient's right arm moves laterally = viewer's left)
    this.time.delayedCall(500, () => {
      Audio.play('rotate');
      this.tweens.add({ targets: this.arm, angle: 60, duration: 1400, ease: 'Sine.inOut', yoyo: true, hold: 500, onComplete: () => {
        this.success('c_gh', '상완골두는 안쪽·위·뒤를 향해 관절와와 만난다', 300);
      } });
      const tag = T(this, this.arm.x - 200, this.arm.y + 40, '외전 60° · 볼-소켓 관절', 18, C.violetS, { weight: '700' }).setAlpha(0);
      this.tweens.add({ targets: tag, alpha: 1, duration: 400, yoyo: true, hold: 1800 });
    });
  }
}
