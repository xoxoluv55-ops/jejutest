import Phaser from 'phaser';
import { InvestBase } from './InvestBase';
import { Audio } from '../../core/audio';
import { G } from '../../game/state';
import { T, C } from '../../ui/widgets';
import { lockerOrder, DrawerBone } from '../../data/escape';
import { BONES } from '../../data/anatomy';

/** coverage grid: marks which cells of a rectangle a tool has passed over */
class Cover {
  hit: boolean[]; constructor(public x: number, public y: number, public w: number, public h: number, public nx = 8, public ny = 5) { this.hit = new Array(nx * ny).fill(false); }
  mark(px: number, py: number, r: number) {
    for (let j = 0; j < this.ny; j++) for (let i = 0; i < this.nx; i++) {
      const cx = this.x + (i + 0.5) * this.w / this.nx, cy = this.y + (j + 0.5) * this.h / this.ny;
      if (Math.hypot(cx - px, cy - py) < r) this.hit[j * this.nx + i] = true;
    }
  }
  get frac() { return this.hit.filter(Boolean).length / this.hit.length; }
}

/**
 * S-03 radius (S-07 locked storage, behind the keycard door).
 *  bench: a blank-looking specimen card (UV lamp reveals invisible ink), a notepad with indentations (rub the pencil
 *         across it to read the impression), and a magnifier to take along
 *  locker: three drawers behind frosted glass — look through the magnifier, pick the real radius by its shape
 *          (small disc-shaped head proximally, wide distal end), pull the drawer, take it. The others are replicas.
 */
export class InvRadiusScene extends InvestBase {
  constructor() { super('InvRadius'); }
  clueIds = ['rubbing', 'uvcard', 'magnifier'];
  lockUntil = 0;

  build(kind: string) {
    this.lockUntil = 0;
    if (kind === 'bench') this.buildBench(); else this.buildLocker();
  }

  // ------------------------------------------------------------------ bench
  buildBench() {
    this.frame('S-07 작업대 조사', '도구를 끌어서 써 보세요. UV 램프·연필로 숨은 글씨를 찾을 수 있습니다.', C.violet);
    const { cTop, cBot } = this;
    const k = Math.min((this.pw - 40) / 1000, (cBot - cTop) / 560);
    const ox = this.px + this.pw / 2 - 500 * k, oy = cTop + (cBot - cTop - 560 * k) / 2;
    const P = (x: number, y: number) => ({ x: ox + x * k, y: oy + y * k });
    this.add.image(ox, oy, 'inv_bench').setOrigin(0).setScale(k * 0.5);
    // ---- specimen card + invisible ink ----
    const cp = P(270, 250), cw = 380 * k * 1.1, chh = 240 * k * 1.1;
    this.add.image(cp.x, cp.y, 'inv_card').setScale(k * 0.5 * 1.1);
    const cardRect = { x: cp.x - cw / 2 + 10, y: cp.y - chh / 2 + 34 * k, w: cw - 30, h: chh - 50 * k };
    const ink = this.adv ? 'S-03 = 오른쪽 노뼈\n보관장 세 칸 중 진짜는 하나.\n나머지 둘은 복제 모형.'
      : 'S-03 = 오른쪽 노뼈\n몸쪽 끝: 작은 원반 모양 머리\n먼쪽 끝: 넓게 퍼짐 (가쪽에 붓돌기)\n나머지 두 칸은 복제 모형';
    const uvText = T(this, cardRect.x + 6, cardRect.y + 4, ink, Math.max(15, 17 * k), '#efc8ff', { weight: '800', lineSpacing: 4, wordWrap: { width: cardRect.w - 10 } }).setShadow(0, 0, '#b04dff', 8, true, true);
    const uvMaskG = this.make.graphics({}, false);
    const uvMask = uvMaskG.createGeometryMask();
    // under UV light the card goes dark violet and the ink glows: a dark layer inside the beam, the ink on top
    const uvDark = this.add.rectangle(cardRect.x - 6, cardRect.y - 4, cardRect.w + 12, cardRect.h + 8, 0x16052a, 0.88).setOrigin(0).setMask(uvMask);
    uvText.setMask(uvMask); uvText.setDepth(1); uvDark.setDepth(0.5);
    const uvCover = new Cover(cardRect.x, cardRect.y, cardRect.w, cardRect.h, 8, 4);
    // ---- notepad + indentations ----
    const np = P(650, 250), nw = 360 * k, nh = 300 * k;
    this.add.image(np.x, np.y, 'inv_pad').setScale(k * 0.5);
    const padRect = { x: np.x - nw / 2 + 8, y: np.y - nh / 2 + 28 * k, w: nw - 26, h: nh - 44 * k };
    const graphite = this.add.graphics();
    const rubMaskG = this.make.graphics({}, false);
    const imprint = T(this, padRect.x + 10, padRect.y + 8, 'S-03 정보는 UV 잉크로\n카드에 적어 둠.\n보관장 유리가 흐리니\n돋보기를 챙길 것!', Math.max(15, 18 * k), '#f4f6fa', { weight: '800', lineSpacing: 6 });
    imprint.setMask(rubMaskG.createGeometryMask());
    const rubCover = new Cover(padRect.x, padRect.y, padRect.w, padRect.h, 8, 5);
    if (this.has('rubbing')) { graphite.fillStyle(0x50535a, 0.75); graphite.fillRect(padRect.x, padRect.y, padRect.w, padRect.h); rubMaskG.fillRect(padRect.x, padRect.y, padRect.w, padRect.h); }
    // ---- UV lamp (drag) ----
    const lampHome = P(440, 420);
    const beam = this.add.image(0, 0, 'light').setTint(0xa040ff).setBlendMode(Phaser.BlendModes.ADD).setScale(0.55).setAlpha(0);
    const lamp = this.add.image(lampHome.x, lampHome.y, 'inv_uv').setScale(k * 0.5 * 1.3).setInteractive({ useHandCursor: true, draggable: true });
    const R = 70 * Math.max(k, 0.8);
    const beamAt = () => ({ x: lamp.x - lamp.displayWidth * 0.33, y: lamp.y - 60 * Math.max(k, 0.8) });
    const drawUv = () => {
      const b = beamAt(); beam.setPosition(b.x, b.y).setAlpha(0.6);
      uvMaskG.clear(); uvMaskG.fillStyle(0xffffff); uvMaskG.fillCircle(b.x, b.y, R);
      uvCover.mark(b.x, b.y, R * 0.8);
      if (!this.has('uvcard') && uvCover.frac > 0.6) { this.addClue('uvcard', 'UV 카드 — S-03 노뼈의 특징'); Audio.play('reveal'); }
    };
    lamp.on('dragstart', () => { Audio.play('powerup'); });
    lamp.on('drag', (p: Phaser.Input.Pointer, x: number, y: number) => { lamp.setPosition(x, y); drawUv(); });
    lamp.on('dragend', () => { beam.setAlpha(0); uvMaskG.clear(); if (this.has('uvcard')) this.setFeedback('보이지 않는 잉크였다! UV 빛을 비추는 동안만 보인다. (기록장에 저장됨)', 'ok'); });
    lamp.on('pointerup', (p: Phaser.Input.Pointer) => { if (p.getDistance() < 8) this.setFeedback('UV 램프를 끌어서 물건 위에 비춰 보세요.', 'info'); });
    this.glint(lamp);
    // ---- pencil (drag across the notepad) ----
    const pencilHome = P(820, 430);
    const pencil = this.add.image(pencilHome.x, pencilHome.y, 'inv_pencil').setScale(k * 0.5 * 1.2).setAngle(-30).setInteractive({ useHandCursor: true, draggable: true });
    let last: { x: number; y: number } | null = null;
    pencil.on('drag', (p: Phaser.Input.Pointer, x: number, y: number) => {
      pencil.setPosition(x, y);
      const tipX = x - pencil.displayWidth * 0.42, tipY = y + pencil.displayWidth * 0.22;
      if (this.has('rubbing')) return;
      if (tipX < padRect.x || tipX > padRect.x + padRect.w || tipY < padRect.y || tipY > padRect.y + padRect.h) { last = null; return; }
      const from = last ?? { x: tipX, y: tipY };
      const n = Math.max(1, Math.ceil(Math.hypot(tipX - from.x, tipY - from.y) / 6));
      for (let i = 1; i <= n; i++) {
        const sx = from.x + (tipX - from.x) * i / n, sy = from.y + (tipY - from.y) * i / n;
        graphite.fillStyle(0x50535a, 0.35); graphite.fillCircle(sx, sy, 16);
        rubMaskG.fillStyle(0xffffff); rubMaskG.fillCircle(sx, sy, 16);
        rubCover.mark(sx, sy, 22);
      }
      last = { x: tipX, y: tipY };
      if (Math.random() < 0.15) Audio.play('type');
      if (rubCover.frac > 0.55) {
        graphite.fillStyle(0x50535a, 0.6); graphite.fillRect(padRect.x, padRect.y, padRect.w, padRect.h);
        rubMaskG.fillRect(padRect.x, padRect.y, padRect.w, padRect.h);
        this.addClue('rubbing', '메모장 자국 — UV 잉크, 돋보기');
      }
    });
    pencil.on('dragend', () => { last = null; });
    pencil.on('pointerup', (p: Phaser.Input.Pointer) => { if (p.getDistance() < 8) this.setFeedback('연필을 끌어서 메모장 위를 문질러 보세요. 눌린 자국이 드러납니다.', 'info'); });
    this.glint(pencil);
    // ---- magnifier (take it along) ----
    if (!this.has('magnifier')) {
      const mp = P(905, 200);
      const mag = this.add.image(mp.x, mp.y, 'inv_mag').setScale(k * 0.5 * 1.1).setInteractive({ useHandCursor: true });
      this.glint(mag);
      mag.once('pointerup', () => {
        Audio.play('pickup');
        this.tweens.add({ targets: mag, y: mag.y - 80, alpha: 0, scale: mag.scale * 1.3, duration: 450, onComplete: () => mag.destroy() });
        this.addClue('magnifier', '돋보기 — 흐린 유리 너머를 본다');
      });
    }
    // card / notepad taps: describe them
    this.add.zone(cp.x - cw / 2, cp.y - chh / 2, cw, chh).setOrigin(0).setInteractive().on('pointerup', (p: Phaser.Input.Pointer) => { if (p.getDistance() < 8) this.setFeedback(this.has('uvcard') ? '카드의 글씨는 UV 빛 아래에서만 보인다. (기록장에 저장됨)' : '표본 카드 S-03… 제목 말고는 아무것도 적혀 있지 않은 것 같다.', 'info'); });
    this.add.zone(padRect.x, padRect.y, padRect.w, padRect.h).setOrigin(0).setInteractive().on('pointerup', (p: Phaser.Input.Pointer) => { if (p.getDistance() < 8 && !this.has('rubbing')) this.setFeedback('빈 메모장. 비스듬히 보니 윗장에 쓴 글씨가 눌린 자국이 남아 있다.', 'info'); });
    lamp.setDepth(10); pencil.setDepth(10); beam.setDepth(9);
    this.setFeedback(G.run.bones.includes('radius') ? '표본 S-03은 이미 회수했습니다.' : '작업대 위를 살펴보세요. 연구원이 무언가를 숨겨 적어 둔 것 같습니다.', 'info');
  }

  // ------------------------------------------------------------------ locker
  buildLocker() {
    this.frame('S-07 표본 보관장', '흐린 유리 너머의 표본을 관찰하고, 진짜 S-03(노뼈)이 든 서랍을 당겨 여세요.', C.violet);
    if (G.run.bones.includes('radius')) { this.setFeedback('S-03 서랍은 비어 있습니다. 표본은 이미 회수했습니다.', 'info'); return; }
    const { cTop, cBot } = this;
    const order = lockerOrder();
    const gap = 14, dh = Math.min(150, (cBot - cTop - gap * 2) / 3);
    const dw = Math.min(this.pw * 0.68, dh * 760 / 170 * 1.25);
    const dx = this.px + 30 + (this.pw * 0.68 - dw) / 2;
    const lensMaskG = this.make.graphics({}, false);
    const lensMask = lensMaskG.createGeometryMask();
    const clears: Phaser.GameObjects.Image[] = [];
    order.forEach((b, i) => {
      const y = cTop + i * (dh + gap);
      const drawer = this.add.container(dx, y);
      const front = this.add.image(0, 0, 'inv_ldrawer').setOrigin(0).setDisplaySize(dw, dh); drawer.add(front);
      // window: x 110/760 .. 650/760
      const wx = dw * 110 / 760, ww = dw * 540 / 760, wy = dh * 22 / 170, wh = dh * 126 / 170;
      const img = this.add.image(wx + ww / 2, wy + wh / 2, `bone_bone_${b}`).setAngle(-90);
      const s = Math.min((ww - 16) / img.height, (wh - 10) / img.width); img.setScale(s);
      const frosted = this.add.image(img.x, img.y, `bone_bone_${b}`).setAngle(-90).setScale(s).setAlpha(0.12); drawer.add(frosted);
      const fg = this.add.graphics(); fg.fillStyle(0xdfe8f2, 0.55); fg.fillRect(wx, wy, ww, wh); drawer.add(fg);
      img.setMask(lensMask); drawer.add(img); clears.push(img);
      drawer.add(T(this, dw * 50 / 760, dh / 2, 'ABC'[i], 34, '#e8f0ff', { display: true, weight: '900' }).setOrigin(0.5));
      // pull: drag the drawer left/right, or tap its handle
      const hz = this.add.zone(dx, y, dw, dh).setOrigin(0).setInteractive({ useHandCursor: true, draggable: true });
      let opened = false;
      const pull = () => { if (opened) return; opened = true; this.openDrawer(i, b, drawer, dw, dh, img, () => { opened = false; }); };
      this.dragDelta(hz, (ddx) => { if (Math.abs(ddx) > 60) pull(); });
      hz.on('pointerup', (p: Phaser.Input.Pointer) => {
        if (p.getDistance() > 8) return;
        const lx = (p.worldX - dx) / dw;
        if (lx > 0.84) pull(); else this.setFeedback(this.has('magnifier') ? '유리가 뿌옇다. 돋보기를 끌어 와서 들여다보세요. 서랍은 손잡이(오른쪽)를 잡고 당깁니다.' : '유리가 뿌옇게 흐려서 안이 잘 보이지 않는다. 확대해서 볼 도구가 있으면…', 'info');
      });
    });
    // magnifier lens (only if taken from the bench)
    const rx = this.px + 30 + this.pw * 0.68 + 24, rw = this.px + this.pw - 30 - rx;
    T(this, rx, cTop + 6, '관찰 메모', 19, C.violetS, { weight: '700' });
    const hintTxt = this.has('uvcard') ? (this.adv ? 'UV 카드: 진짜는 하나, 둘은 복제 모형.' : 'UV 카드: 몸쪽 끝 = 작은 원반 머리, 먼쪽 끝 = 넓게 퍼짐.') : '어느 서랍이 S-03인지 알려 주는 단서가 아직 없다.';
    T(this, rx, cTop + 38, `${hintTxt}\n\n표본은 모두 왼쪽이 몸쪽(위)이 되도록 눕혀 보관되어 있다.`, 16, '#d3def3', { wordWrap: { width: rw }, lineSpacing: 6 });
    if (this.has('magnifier')) {
      const lensR = Math.min(dh * 0.62, 95);
      const lens = this.add.container(rx + rw / 2, cBot - lensR - 20).setDepth(20);
      const lg = this.add.graphics(); lg.lineStyle(10, 0xc9d3df, 1); lg.strokeCircle(0, 0, lensR); lg.lineStyle(14, 0x7a5a3a, 1); lg.lineBetween(lensR * 0.72, lensR * 0.72, lensR * 1.3, lensR * 1.3); lens.add(lg);
      lens.setSize(lensR * 2.4, lensR * 2.4).setInteractive({ useHandCursor: true, draggable: true });
      const upd = () => { lensMaskG.clear(); lensMaskG.fillStyle(0xffffff); lensMaskG.fillCircle(lens.x, lens.y, lensR - 4); };
      upd();
      lens.on('drag', (_p: Phaser.Input.Pointer, x: number, y: number) => { lens.setPosition(x, y); upd(); });
      this.tip(lens.x, lens.y, '돋보기\n끌어서 보기', undefined, 15).setDepth(21);
      lens.once('dragstart', () => this.children.list.filter(o => o instanceof Phaser.GameObjects.Text && (o as Phaser.GameObjects.Text).text === '돋보기\n끌어서 보기').forEach(o => o.destroy()));
      void clears;
    }
    this.setFeedback(this.has('magnifier') ? '돋보기를 서랍 유리 위로 끌어 표본을 관찰하세요.' : '유리가 흐려 안이 잘 보이지 않습니다. 작업대에 쓸 만한 도구가 있을지도 모릅니다.', 'info');
  }

  openDrawer(i: number, b: DrawerBone, drawer: Phaser.GameObjects.Container, dw: number, _dh: number, clear: Phaser.GameObjects.Image, reset: () => void) {
    if (this.time.now < this.lockUntil) { Audio.play('error'); this.setFeedback('잠금장치가 재설정되는 중… 잠시 후 다시 시도하세요.', 'warn'); reset(); return; }
    Audio.play('door');
    clear.clearMask();
    this.tweens.add({ targets: drawer, x: drawer.x - dw * 0.18, duration: 380, ease: 'Cubic.out' });
    if (b === 'radius') {
      this.setFeedback(`서랍 ${'ABC'[i]}: 진짜 표본 S-03 — 표본을 눌러 꺼내세요.`, 'ok');
      const glow = this.add.image(drawer.x + clear.x - dw * 0.18, drawer.y + clear.y, 'light').setTint(0xd9a0ff).setBlendMode(Phaser.BlendModes.ADD).setScale(1.2).setAlpha(0.5);
      this.tweens.add({ targets: glow, alpha: 0.2, duration: 700, yoyo: true, repeat: -1 });
      const z = this.add.zone(drawer.x - dw * 0.18, drawer.y, dw, _dh).setOrigin(0).setInteractive({ useHandCursor: true }).setDepth(30);
      this.flushInput();
      z.once('pointerup', () => {
        Audio.play('pickup');
        this.tweens.add({ targets: drawer, alpha: 0.5, duration: 300 });
        this.time.delayedCall(350, () => this.found('radius', '표본 S-03 회수 · 노뼈 Radius',
          '노뼈는 아래팔의 가쪽(엄지 쪽) 긴뼈. 몸쪽 끝의 노뼈머리는 작은 원반 모양으로 위팔뼈 작은머리·자뼈 노패임과 관절하고, 먼쪽 끝은 넓게 퍼져 손목뼈와 손목관절을 만든다(가쪽 끝 = 노뼈붓돌기). 아래팔을 뒤칠 때·엎칠 때 자뼈 둘레를 돈다.'));
      });
      return;
    }
    G.run.mistakes++; Audio.play('error');
    const what = this.adv ? '복제 모형' : `복제 모형 (${BONES[b === 'ulna' ? 'ulna' : 'fibula'].ko})`;
    const why = this.adv ? '— S-03이 아니다.' : b === 'ulna' ? '— 몸쪽 끝이 크고 갈고리 모양(팔꿈치머리)이다. 노뼈가 아니다.' : '— 길고 가는 다리뼈다. 팔뼈가 아니다.';
    this.setFeedback(`서랍 ${'ABC'[i]}: ${what} ${why} 서랍이 다시 잠깁니다.`, 'err');
    this.lockUntil = this.time.now + 2000;
    this.time.delayedCall(1800, () => {
      this.tweens.add({ targets: drawer, x: drawer.x + dw * 0.18, duration: 300, ease: 'Cubic.in' });
      reset();
    });
  }

  hints() {
    const H: string[] = [];
    if (this.kind === 'bench') {
      if (!this.has('rubbing')) H.push('메모장에 글씨가 눌린 자국이 있습니다. 연필을 끌어서 메모장 전체를 문질러 보세요.');
      if (!this.has('uvcard')) H.push('표본 카드는 비어 보이지만 UV 잉크로 쓰였습니다. UV 램프를 끌어 카드 위를 천천히 비추세요.');
      if (!this.has('magnifier')) H.push('오른쪽 위의 돋보기를 눌러 챙기세요. 보관장 유리가 흐립니다.');
      if (!H.length) H.push('단서는 다 모았습니다. 오른쪽 보관장으로 가서 서랍을 관찰하세요.');
      return H;
    }
    if (!this.has('magnifier')) H.push('작업대(왼쪽)에서 돋보기를 챙겨 오면 흐린 유리 너머가 보입니다.');
    if (!this.has('uvcard')) H.push('작업대의 표본 카드를 UV 램프로 비추면 S-03의 특징이 나옵니다.');
    H.push('세 표본을 비교하세요: 노뼈는 몸쪽(왼쪽) 끝의 머리가 작은 원반이고 먼쪽(오른쪽) 끝이 넓습니다. 자뼈는 반대로 몸쪽 끝이 크고 갈고리 모양, 종아리뼈는 가늘고 깁니다.');
    if (!this.adv) H.push(`S-03은 서랍 ${'ABC'[lockerOrder().indexOf('radius')]}에 있습니다. 서랍 오른쪽 손잡이를 잡고 당기세요.`);
    return H;
  }
}
