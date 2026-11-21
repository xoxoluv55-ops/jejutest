import Phaser from 'phaser';
import { PuzzleBase } from './PuzzleBase';
import { View } from '../../core/view';
import { Audio } from '../../core/audio';
import { G } from '../../game/state';
import { BONES, ALIGN_HINTS, LANDMARKS, UPPER_ORDER } from '../../data/anatomy';
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
    const cp = this.compact;
    // show only the arm skeleton (union of its bones), so it fills the column instead of a mostly empty torso frame
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const id of UPPER_ORDER) { const bb = boneBounds(id); x0 = Math.min(x0, bb.x); y0 = Math.min(y0, bb.y); x1 = Math.max(x1, bb.x + bb.w); y1 = Math.max(y1, bb.y + bb.h); }
    const crop = { x: x0 - 70, y: y0 - 40, w: x1 - x0 + 110, h: y1 - y0 + 80 };
    const top = this.cTop, areaH = portrait ? this.ph * 0.58 : this.cBot - top, areaW = portrait ? this.pw - 40 : this.pw * 0.5;
    this.fs = Math.min(areaH / crop.h, areaW / crop.w);
    const vw = crop.w * this.fs, vh = crop.h * this.fs;
    const vx = this.px + 20 + (portrait ? (areaW - vw) / 2 : 0), vy = top + (areaH - vh) / 2;
    this.fx = vx - crop.x * this.fs; this.fy = vy - crop.y * this.fs;
    const plate = this.add.graphics();
    plate.fillStyle(0x0b0618, 0.7); plate.fillRoundedRect(vx - 6, vy - 6, vw + 12, vh + 12, 12);
    plate.lineStyle(1, C.violet, 0.3); plate.strokeRoundedRect(vx - 6, vy - 6, vw + 12, vh + 12, 12);
    const holo = this.add.image(this.fx, this.fy, 'torso_holo').setOrigin(0).setScale(this.fs / DENSITY).setAlpha(0.7);
    const mk = this.make.graphics({}, false); mk.fillRect(vx - 6, vy - 6, vw + 12, vh + 12); holo.setMask(mk.createGeometryMask());
    // axis legend (bottom-left of the plate) + side labels
    const ax = vx + vw - 70, ay = vy + vh - 14;   // medial-bottom corner is empty (the forearm lies laterally)
    const g = this.add.graphics(); g.lineStyle(2, C.violet, 0.8);
    g.lineBetween(ax, ay, ax, ay - 44); g.fillStyle(C.violet, 1); g.fillTriangle(ax - 6, ay - 40, ax + 6, ay - 40, ax, ay - 52);
    T(this, ax + 10, ay - 46, '몸쪽', 15, C.violetS, { weight: '700' }).setOrigin(0, 0.5);
    T(this, ax + 10, ay, '먼쪽', 15, C.violetS, { weight: '700' }).setOrigin(0, 0.5);
    T(this, vx + 6, vy + 4, '← 가쪽', 15, '#c8a8ff', { weight: '700' });
    T(this, vx + vw - 6, vy + 4, '안쪽 →', 15, '#c8a8ff', { weight: '700' }).setOrigin(1, 0);
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
    const cx0 = portrait ? this.px + 30 : vx + vw + (cp ? 36 : 60), cy0 = portrait ? vy + vh + 30 : top + (cp ? 2 : 10);
    const cw = portrait ? this.pw - 60 : this.px + this.pw - 30 - cx0;
    T(this, cx0, cy0, '선택한 뼈', 16, C.violetS, { weight: '700' });
    this.selT = T(this, cx0, cy0 + (cp ? 22 : 30), '— 뼈를 눌러 선택하세요 —', cp ? 20 : 24, C.white, { weight: '700' });
    const bw = Math.min(cw, cp ? 560 : 420);
    // compact (phone): the two operations side by side, then the check button, then the clues
    const L = cp ? { y1: 80, y3: 138, h: 48, hv: 52, gy: 172 } : { y1: 110, y3: 278, h: 62, hv: 70, gy: 340 };
    const hb = cp ? (bw - 10) / 2 : bw;
    const b1 = new Button(this, cx0 + hb / 2, cy0 + L.y1, '상하 180° 회전', () => this.op('flip'), { w: hb, h: L.h, icon: 'rotate', accent: C.violet, sound: 'rotate' });
    const b2 = new Button(this, cp ? cx0 + hb + 10 + hb / 2 : cx0 + bw / 2, cp ? cy0 + L.y1 : cy0 + 184, '좌우 반전 (거울상)', () => this.op('mirror'), { w: hb, h: L.h, icon: 'flip', accent: C.violet, sound: 'rotate' });
    const b3 = new Button(this, cx0 + bw / 2, cy0 + L.y3, '정렬 검증', () => this.verify(), { w: bw, h: L.hv, icon: 'check', accent: C.green, primary: true, size: cp ? 21 : 24 });
    void b1; void b2; void b3;
    const guide = adv
      ? '단서: 몸쪽/먼쪽의 크기 차이, 관절면(머리·절흔)의 방향, 돌기가 향하는 쪽(안쪽/가쪽)을 확인하세요.'
      : '단서\n• 위팔뼈머리(둥근 머리)는 위·안쪽에서 관절오목과 만납니다.\n• 자뼈는 몸쪽부분이 크고(팔꿈치머리), 노뼈는 먼쪽부분이 넓습니다.\n• 노뼈 붓돌기 = 엄지쪽(가쪽), 자뼈 붓돌기 = 새끼쪽(안쪽).';
    const gd = T(this, cx0, cy0 + L.gy, guide, cp ? 15 : 16, '#c9d6ee', { wordWrap: { width: cw }, lineSpacing: cp ? 2 : 6 });
    if (gd.y + gd.height > this.cBot) gd.setMaxLines(Math.max(2, Math.floor((this.cBot - gd.y) / 19)));
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
    this.selT.setText(G.run.difficulty === 'adv' ? `${b.en}` : `${b.ko} · ${b.en}`);
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
    this.setFeedback('관절면 정렬 완료! 오목위팔관절 벌림(abduction) 시연 중…', 'ok');
    // abduction demo around the humeral head (patient's right arm moves laterally = viewer's left)
    this.time.delayedCall(500, () => {
      Audio.play('rotate');
      this.tweens.add({ targets: this.arm, angle: 45, duration: 1400, ease: 'Sine.inOut', yoyo: true, hold: 500, onComplete: () => {
        this.success('c_gh', '위팔뼈머리는 안쪽·위·뒤를 향해 관절오목과 만난다', 300);
      } });
      const tag = T(this, this.arm.x - 200, this.arm.y + 40, '벌림 45° · 볼-소켓 관절', 18, C.violetS, { weight: '700' }).setAlpha(0);
      this.tweens.add({ targets: tag, alpha: 1, duration: 400, yoyo: true, hold: 1800 });
    });
  }
}
