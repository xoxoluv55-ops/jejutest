import Phaser from 'phaser';
import { InvestBase } from './InvestBase';
import { Audio } from '../../core/audio';
import { View } from '../../core/view';
import { G, Bus } from '../../game/state';
import { T, C, Button } from '../../ui/widgets';
import { CORE, CoreId, HIP_CREDIT, THIGH, Comp, COMP_KO, COMP_NERVE, COMP_COL, fridgeSpecimens, RIG_ACT, RIG_KO, RIG_KNEE0 } from '../../data/hip';
import { hipManifest, fitRect, sp, layerAt, regionAt, Box, Rig } from '../../art/hip';

const ACC = 0xffb870;

/**
 * CH4 escape-room views: every pair of muscle cores is locked in a device whose clue lies in another room.
 *  rehab4 (H-05 trolley)  -> gtable (H-02):  peel the gluteus maximus off, press the gluteus medius insertion
 *  rx4 (H-02 desk)        -> rig4 (H-04):    hip/knee rig — pick the muscle cable that makes the asked movement
 *  knee4 (H-01 trolley)   -> pes4 (H-05):    hang the three pes anserinus tendons in their front-to-back order
 *  chart4 (H-04 wall)     -> fridge4 (H-05): sort thigh muscle specimens into the drawers of their nerves
 * Everything shown is the BodyParts3D model (right pelvis and lower limb).
 */
export class InvHipScene extends InvestBase {
  constructor() { super('InvHip'); }
  clueIds = ['k_rehab', 'k_rx', 'k_knee', 'k_chart'];
  get got() { return G.run.items as string[]; }
  get m() { return hipManifest(this); }

  build(kind: string) {
    const b: Record<string, () => void> = {
      rehab4: () => this.buildRehab(), gtable: () => this.buildGlute(), rx4: () => this.buildRx(), rig4: () => this.buildRig(),
      knee4: () => this.buildKnee(), pes4: () => this.buildPes(), chart4: () => this.buildChart(), fridge4: () => this.buildFridge(),
    };
    b[kind]?.();
  }

  // ---------------------------------------------------------------- helpers
  rightCol(frac = 0.58) { const rx = this.px + 30 + this.pw * frac + 20; return { rx, rw: this.px + this.pw - 30 - rx }; }
  leftBox(frac = 0.58) { const { cTop, cBot } = this; return { x: this.px + 30, y: cTop, w: this.pw * frac, h: cBot - cTop }; }
  credit(x: number, y: number) { T(this, x, y, HIP_CREDIT, 12, '#a89c8a', { fine: true }).setOrigin(0, 1).setDepth(30); }
  wrong(msg: string) { G.run.mistakes++; Audio.play('error'); this.cameras.main.shake(120, 0.003); this.setFeedback(msg, 'err'); }
  empty(msg = '장치는 비어 있습니다. 근육 코어는 이미 회수했습니다.') { this.setFeedback(msg, 'info'); }
  clip(b: { bx: number; by: number; w: number; h: number }, objs: Phaser.GameObjects.GameObject[]) {
    const g = this.make.graphics({}); g.fillStyle(0xffffff); g.fillRect(b.bx, b.by, b.w, b.h); const mk = g.createGeometryMask();
    objs.forEach(o => (o as unknown as Phaser.GameObjects.Components.Mask).setMask(mk)); return mk;
  }
  /** paper sheet with a title and body (left), optional picture (right) */
  paper(title: string, body: string) {
    const { cTop, cBot } = this;
    const h = cBot - cTop - 10, w = Math.min(h * 0.86, this.pw * 0.52);
    const x = this.px + 40, y = cTop + 5;
    this.add.image(x + w / 2, y + h / 2, 'inv_paper').setDisplaySize(w, h).setAngle(-1.2);
    T(this, x + w * 0.1, y + h * 0.08, title, 17, '#2b2418', { ink: true, weight: '700', wordWrap: { width: w * 0.8 } });
    const t = T(this, x + w * 0.1, y + h * 0.18, body, 15, '#2b2418', { ink: true, weight: '600', wordWrap: { width: w * 0.8 }, lineSpacing: 6 });
    for (const s of [14, 13]) { if (t.height <= h * 0.76) break; t.setFontSize(s).setLineSpacing(3); }
    return { x, y, w, h };
  }

  /** recovered pair: both cores rise, then one record card; Continue hands both to the world */
  foundPair(ids: CoreId[], title: string, body: string) {
    this.solved = true; Audio.play('pickup'); this.closeLayer();
    const { W, H } = View;
    const burst = this.add.image(W / 2, H / 2, 'light').setTint(0xffd8a0).setBlendMode(Phaser.BlendModes.ADD).setScale(0.3).setAlpha(0.9).setDepth(240);
    const sps = ids.map((id, i) => {
      const s = this.add.image(W / 2 + (i - (ids.length - 1) / 2) * W * 0.2, H / 2 + 30, `ch4_core_${id}`).setDepth(241).setAlpha(0);
      const fs = Math.min(W * 0.17 / s.width, H * 0.6 / s.height, 1.2); s.setScale(fs * 0.5);
      this.tweens.add({ targets: s, y: H / 2, scale: fs, alpha: 1, duration: 280, ease: 'Back.out', delay: i * 80 });
      return s;
    });
    this.tweens.add({ targets: burst, scale: 2.6, alpha: 0, duration: 650, ease: 'Cubic.out' });
    this.cameras.main.flash(160, 255, 220, 170);
    this.time.delayedCall(700, () => {
      sps.forEach(s => s.destroy()); burst.destroy();
      Audio.play('success');
      const o = this.overlay(title, 920, 580, C.green);
      const left = Math.min(330, o.w * 0.36);
      ids.forEach((id, i) => {
        const cx = o.x + 30 + (i + 0.5) * left / ids.length, cy = o.y + 50 + (o.h - 110) / 2;
        const im = this.add.image(cx, cy, `ch4_core_${id}`); o.c.add(im);
        im.setScale(Math.min((left / ids.length - 16) / im.width, (o.h - 150) / im.height, 1));
        o.c.add(T(this, cx, o.y + o.h - 52, CORE[id].ko, 15, '#ffe0c0', { weight: '700' }).setOrigin(0.5));
      });
      const tx = o.x + 50 + left, tw = o.w - left - 80;
      o.c.add(T(this, tx, o.y + 76, '해부학 도감에 등록되었습니다', 19, C.greenS, { weight: '700' }));
      const bt = T(this, tx, o.y + 112, body, 16, '#e3dccf', { wordWrap: { width: tw }, lineSpacing: 5 }); o.c.add(bt);
      for (const sz of [15, 14, 13]) { if (bt.y + bt.height < o.y + o.h - 80) break; bt.setFontSize(sz).setLineSpacing(3); }
      o.c.add(new Button(this, o.x + o.w - 130, o.y + o.h - 40, '계속', () => { Bus.emit('investigate:found', ids.join('+')); this.scene.stop(); }, { w: 200, h: 50, icon: 'check', accent: C.green, primary: true }));
    });
  }

  /** numbered round markers on landmarks; returns their screen positions */
  markers(b: Box, view: string, ids: string[], onTap: (id: string) => void) {
    const out: Record<string, { x: number; y: number }> = {};
    const objs: Phaser.GameObjects.GameObject[] = [];
    ids.forEach((id, i) => {
      const p = sp(b, this.m.points[view][id]); out[id] = p;
      const c = this.add.circle(p.x, p.y, 17, 0xffb870, 0.25).setStrokeStyle(3, 0xffd6a0, 1).setDepth(40).setInteractive({ useHandCursor: true });
      const t = T(this, p.x, p.y, String.fromCharCode(65 + i), 15, '#ffffff', { weight: '900' }).setOrigin(0.5).setDepth(41);
      this.tweens.add({ targets: c, scale: 1.15, duration: 600, yoyo: true, repeat: -1 });
      c.on('pointerup', () => onTap(id));
      objs.push(c, t);
    });
    (this as unknown as { __marks: unknown }).__marks = out;
    return { pos: out, destroy: () => objs.forEach(o => o.destroy()) };
  }

  // ================================================================== A: gluteal table (gluteus maximus + medius)
  buildRehab() {
    this.frame('재활 기록지 · H-05', '카트 위에 놓인 재활 기록지입니다.', ACC);
    const p = this.paper('재활 기록 · 오른쪽 엉덩관절', this.adv
      ? '· 오른다리로 한 발 서기: 왼쪽 골반이 처짐 (트렌델렌부르크 징후 양성)\n· 계단 오르기·의자에서 일어서기: 힘이 약함\n\n· H-02 볼기 해부대 잠금 해제:\n  ① 겉층 근육의 닿는곳을 먼저 확인\n  ② 겉층을 걷어 낸 뒤\n  ③ 그 아래 근육의 닿는곳을 누를 것'
      : '· 오른다리로 한 발 서기: 왼쪽 골반이 처짐 (트렌델렌부르크 징후 양성)\n  → 오른쪽 중간볼기근(벌림근) 약화\n\n· 중간볼기근은 큰볼기근 아래(깊은 층)에 있다.\n  엉덩뼈 바깥면 → 넙다리뼈 큰돌기\n\n· H-02 볼기 해부대 잠금 해제:\n  큰볼기근을 끌어서 걷어 내고,\n  중간볼기근의 닿는곳(큰돌기)을 누를 것');
    const { rx, rw } = this.rightCol(0.55);
    const r = this.m.regions.glut_full;
    const b = fitRect(r, rx, this.cTop + 10, rw, this.cBot - this.cTop - 50);
    regionAt(this, this.m, 'glut_full', b);
    T(this, rx, b.by + b.h + 8, '첨부 사진: 오른쪽 볼기, 뒤에서 본 모습 (가쪽 = 오른쪽)', 13, C.dim, { wordWrap: { width: rw } });
    void p;
    this.addClue('k_rehab', '재활 기록지 — 큰볼기근 아래의 중간볼기근');
  }

  buildGlute() {
    this.frame('볼기 해부대 · H-02', this.adv ? '해부대의 지시에 따라 근육의 닿는곳을 누르세요.' : '겉층 근육을 끌어서 걷어 내고, 그 아래 근육의 닿는곳을 누르세요.', ACC);
    if (this.got.includes('gmax')) { this.empty(); return; }
    const L = this.leftBox(0.56);
    this.add.nineslice(L.x + L.w / 2, L.y + L.h / 2, 'inv_jbox', undefined, L.w, L.h, 48, 48, 48, 48);
    const r = this.m.regions.glut_full;
    const b = fitRect(r, L.x + 30, L.y + 24, L.w - 60, L.h - 48);
    const bg = this.add.graphics(); bg.fillStyle(0x140d08, 1); bg.fillRect(b.bx, b.by, b.w, b.h);
    regionAt(this, this.m, 'glut_nomax', b);
    const max = layerAt(this, this.m, 'glut_max', b).setDepth(10);
    this.clip(b, [max]);
    this.credit(b.bx + 6, b.by + b.h - 4);
    T(this, b.bx + 8, b.by + 6, '오른쪽 볼기 · 뒤에서 본 모습 (가쪽 = 오른쪽)', 13, '#ffe0c0', { weight: '700', backgroundColor: '#140d08cc', padding: { x: 4, y: 2 } }).setDepth(30);
    const { rx, rw } = this.rightCol(0.56);
    const step = T(this, rx, this.cTop + 8, '', 19, '#ffd6a0', { weight: '700', wordWrap: { width: rw } });
    const sub = T(this, rx, this.cTop + 70, '', 16, '#e3dccf', { wordWrap: { width: rw }, lineSpacing: 5 });
    const CAND = ['greaterT', 'gluteTub', 'ischTub', 'lesserT'];
    const WHY: Record<string, string> = {
      ischTub: '궁둥뼈결절 — 뒤넙다리근(넙다리두갈래근 긴갈래·반힘줄근·반막근)의 이는곳이다.',
      lesserT: '작은돌기 — 앞쪽의 엉덩허리근이 닿는 곳이다.',
    };
    let phase: 'maxIns' | 'peel' | 'medIns' = this.adv ? 'maxIns' : 'peel';
    let mk: { destroy: () => void } | null = null;
    const ask = () => {
      mk?.destroy(); mk = null;
      if (phase === 'maxIns') { step.setText('① 큰볼기근의 닿는곳은?'); sub.setText('표시된 A–D 중 하나를 누르세요.'); mk = this.markers(b, 'post', CAND, tap); }
      else if (phase === 'peel') { step.setText(this.adv ? '② 겉층을 걷어 내세요' : '① 큰볼기근을 걷어 내세요'); sub.setText('가장 바깥의 큰 근육(큰볼기근)을 끌어서 해부대 밖으로 치우세요.'); }
      else { step.setText(this.adv ? '③ 드러난 근육의 닿는곳은?' : '② 중간볼기근의 닿는곳은?'); sub.setText(this.adv ? '' : '큰볼기근 아래에서 드러난 부채꼴 근육이 중간볼기근입니다. A–D 중 닿는곳을 누르세요.'); mk = this.markers(b, 'post', CAND, tap); }
    };
    const tap = (id: string) => {
      if (this.solved) return;
      if (phase === 'maxIns') {
        if (id === 'gluteTub') { Audio.play('snap'); this.setFeedback('볼기근거친면 — 큰볼기근의 깊은 섬유가 여기에, 나머지는 엉덩정강띠로 이어진다. 이제 겉층을 걷어 낸다.', 'ok'); phase = 'peel'; ask(); }
        else this.wrong(id === 'greaterT' ? '큰돌기는 중간·작은볼기근이 닿는 곳이다. 큰볼기근은 그보다 아래쪽에 붙는다.' : WHY[id]);
        return;
      }
      if (id === 'greaterT') {
        Audio.play('snap'); mk?.destroy();
        const p = sp(b, this.m.points.post.greaterT);
        const ring = this.add.circle(p.x, p.y, 10, 0x3dffa2, 0.4).setStrokeStyle(3, 0x3dffa2).setDepth(42);
        this.tweens.add({ targets: ring, scale: 3, alpha: 0, duration: 700 });
        this.setFeedback('큰돌기 — 중간볼기근이 닿는 곳. 해부대 잠금이 풀린다!', 'ok');
        this.time.delayedCall(800, () => { Audio.play('door'); this.foundPair(['gmax', 'gmed'], '근육 코어 회수 · 큰볼기근 · 중간볼기근',
          '큰볼기근: 엉덩뼈 뒤·엉치뼈·꼬리뼈 → 볼기근거친면·엉덩정강띠. 엉덩관절 폄(일어서기, 계단 오르기)·가쪽돌림. 아래볼기신경.\n\n중간볼기근: 큰볼기근 아래 깊은 층. 엉덩뼈 바깥면 → 큰돌기. 엉덩관절 벌림, 한 발로 설 때 골반 수평 유지. 위볼기신경.\n\n임상: 중간볼기근이 약하면 그쪽 다리로 설 때 반대쪽 골반이 처진다(트렌델렌부르크 징후).'); });
      } else this.wrong(id === 'gluteTub' ? '볼기근거친면 — 방금 걷어 낸 큰볼기근이 닿는 곳이다.' : WHY[id]);
    };
    // peel: drag the gluteus maximus layer off the table
    max.setInteractive({ useHandCursor: true, draggable: true, pixelPerfect: true, alphaTolerance: 40 });
    const home = { x: max.x, y: max.y };
    max.on('drag', (_p: Phaser.Input.Pointer, dx: number, dy: number) => { if (phase === 'peel') max.setPosition(dx, dy); });
    max.on('dragend', () => {
      if (phase === 'maxIns') { this.setFeedback('먼저 큰볼기근의 닿는곳을 확인하세요(①).', 'warn'); return; }
      if (phase !== 'peel') return;
      if (Math.hypot(max.x - home.x, max.y - home.y) > b.w * 0.3) {
        phase = 'medIns'; Audio.play('rotate'); max.disableInteractive();
        this.tweens.add({ targets: max, x: b.bx + b.w + 400, alpha: 0, angle: 18, duration: 420, ease: 'Cubic.in', onComplete: () => max.destroy() });
        this.setFeedback('큰볼기근을 걷어 냈다. 그 아래 엉덩뼈 바깥면에서 부채꼴로 모이는 근육이 중간볼기근이다.', 'ok');
        ask();
      } else this.tweens.add({ targets: max, x: home.x, y: home.y, duration: 200 });
    });
    (this as unknown as { __glute: unknown }).__glute = { max: () => ({ x: max.x, y: max.y, w: b.w }), phase: () => phase };
    ask();
    this.setFeedback(this.has('k_rehab') ? '재활 기록지의 지시대로 진행하세요.' : '무엇을 해야 할까? 표본 냉장실(H-05) 카트 위의 재활 기록지에 단서가 있을지도.', 'info');
  }

  // ================================================================== B: hip–knee rig (iliopsoas + rectus femoris)
  buildRx() {
    this.frame('운동 처방전 · H-02 책상', '책상 위의 운동 처방전입니다.', ACC);
    this.paper('운동 처방전 · 엉덩관절 굽힘근 재활', this.adv
      ? '· 1단계: 가장 강한 엉덩관절 굽힘근만 수축\n  (무릎은 그대로)\n\n· 2단계: 엉덩관절 굽힘과 무릎 폄을 함께 —\n  두 관절을 지나는 근육\n\n· H-04 운동 시험대에서 두 단계를 차례로 재현할 것'
      : '· 1단계: 다리 들어 올리기 (무릎은 그대로)\n  → 엉덩관절만 굽히는 근육 = 엉덩허리근\n    (허리뼈·엉덩뼈오목 → 작은돌기)\n\n· 2단계: 공 차기 (엉덩관절 굽힘 + 무릎 폄)\n  → 두 관절을 지나는 근육 = 넙다리곧은근\n    (아래앞엉덩뼈가시 → 무릎뼈 → 정강뼈거친면)\n\n· H-04 운동 시험대에서 두 단계를 차례로 재현할 것');
    const { rx, rw } = this.rightCol(0.55);
    const r = this.m.regions.ant_full;
    const b = fitRect({ x: r.x, y: r.y, w: r.w, h: r.h * 0.62 }, rx, this.cTop + 10, rw, this.cBot - this.cTop - 50);
    const im = regionAt(this, this.m, 'ant_full', b); this.clip(b, [im]);
    T(this, rx, b.by + b.h + 8, '첨부: 오른쪽 엉덩관절 앞면 (가쪽 = 왼쪽)', 13, C.dim, { wordWrap: { width: rw } });
    this.addClue('k_rx', '운동 처방전 — 엉덩관절 굽힘근 두 단계');
  }

  buildRig() {
    this.frame('엉덩·무릎 운동 시험대 · H-04', '근육 케이블을 골라 당기면 다리가 움직입니다. 단계마다 요구하는 움직임을 만드세요.', ACC);
    if (this.got.includes('iliopsoas')) { this.empty(); return; }
    const L = this.leftBox(0.55);
    this.add.nineslice(L.x + L.w / 2, L.y + L.h / 2, 'inv_jbox', undefined, L.w, L.h, 48, 48, 48, 48);
    const P = this.m.points.lat;
    const R = { x: P.hipC[0] - 480, y: P.hipC[1] - 330, w: 860, h: 1090 };
    const b = fitRect(R, L.x + 24, L.y + 20, L.w - 48, L.h - 40);
    const bg = this.add.graphics(); bg.fillStyle(0x140d08, 1); bg.fillRect(b.bx, b.by, b.w, b.h);
    const rc = this.add.container(0, 0); this.clip(b, [rc]);
    const rig = new Rig(this, this.m, 'lat', b, rc);
    rig.pose(0, RIG_KNEE0);
    this.credit(b.bx + 6, b.by + b.h - 4);
    T(this, b.bx + 8, b.by + 6, '오른다리 · 가쪽에서 본 모습 (앞 = 오른쪽)', 13, '#ffe0c0', { weight: '700', backgroundColor: '#140d08cc', padding: { x: 4, y: 2 } }).setDepth(30);
    const { rx, rw } = this.rightCol(0.55);
    const tasks = [
      { want: 'iliopsoas', ko: '1단계', text: this.adv ? '가장 강한 엉덩관절 굽힘근으로 다리를 들어 올리세요 (무릎은 그대로).' : '무릎은 그대로 두고, 엉덩관절만 굽혀 다리를 앞으로 들어 올리세요.' },
      { want: 'rf', ko: '2단계', text: '엉덩관절을 굽히면서 동시에 무릎을 펴세요.' },
    ];
    let k = 0, busy = false;
    const stepT = T(this, rx, this.cTop + 6, '', 19, '#ffd6a0', { weight: '700' });
    const taskT = T(this, rx, this.cTop + 36, '', 16, '#e3dccf', { wordWrap: { width: rw }, lineSpacing: 4 });
    const cards = ['iliopsoas', 'rf', 'gmax', 'bf', ...(this.adv ? ['vl', 'st'] : [])];
    const order = Phaser.Utils.Array.Shuffle([...cards]);
    const top = this.cTop + 120, ch = Math.min(56, (this.cBot - top - 10) / Math.ceil(order.length / 2) - 10), cw = (rw - 12) / 2;
    const btns: Record<string, Button> = {};
    const show = () => { stepT.setText(`${tasks[k].ko} / 2`); taskT.setText(tasks[k].text); };
    const pick = (id: string) => {
      if (busy || this.solved) return;
      busy = true; rig.cables = { [id]: 'hint' }; rig.draw();
      const a = RIG_ACT[id];
      Audio.play('hold');
      rig.animate({ hip: a.hip ?? 0, knee: RIG_KNEE0 + (a.knee ?? 0) }, 1100, () => {
        const ok = id === tasks[k].want;
        if (ok) {
          Audio.play('snap'); this.setFeedback(`${RIG_KO[id]} — ${a.text}`, 'ok');
          k++;
          this.time.delayedCall(1400, () => {
            if (k >= tasks.length) {
              this.setFeedback('두 단계 재현 완료 — 시험대 잠금이 풀린다!', 'ok');
              this.time.delayedCall(700, () => { Audio.play('door'); this.foundPair(['iliopsoas', 'rf'], '근육 코어 회수 · 엉덩허리근 · 넙다리곧은근',
                '엉덩허리근: 큰허리근(T12–L5)과 엉덩근(엉덩뼈오목)이 합쳐져 작은돌기에 붙는다. 엉덩관절 굽힘의 주작용근이며 무릎은 지나지 않는다.\n\n넙다리곧은근: 아래앞엉덩뼈가시 → 무릎뼈 → 무릎인대 → 정강뼈거친면. 넙다리네갈래근 중 유일하게 엉덩관절도 지나는 두관절근 → 엉덩관절 굽힘 + 무릎 폄 (공 차기).'); });
            } else { rig.animate({ hip: 0, knee: RIG_KNEE0 }, 700, () => { rig.cables = {}; rig.draw(); busy = false; show(); }); }
          });
        } else {
          G.run.mistakes++; Audio.play('error');
          const want = tasks[k].want;
          const why = this.adv ? `${RIG_KO[id]}: 요구한 움직임이 아니다.` : k === 0 && id === 'rf' ? '넙다리곧은근은 엉덩관절을 굽히지만 무릎도 편다. 1단계는 무릎을 그대로 두어야 한다.'
            : `${RIG_KO[id]} — ${a.text}`;
          this.setFeedback(`${why}${this.adv ? '' : want === 'rf' && id === 'iliopsoas' ? ' 2단계는 무릎도 펴져야 한다.' : ''}`, 'err');
          this.time.delayedCall(1200, () => rig.animate({ hip: 0, knee: RIG_KNEE0 }, 700, () => { rig.cables = {}; rig.draw(); busy = false; }));
        }
      });
    };
    order.forEach((id, i) => {
      const bx = rx + cw / 2 + (i % 2) * (cw + 12), by = top + ch / 2 + Math.floor(i / 2) * (ch + 10);
      btns[id] = new Button(this, bx, by, RIG_KO[id], () => pick(id), { w: cw, h: ch, size: 17 });
    });
    (this as unknown as { __rig: unknown }).__rig = { pick, busy: () => busy, k: () => k, rig };
    show();
    this.setFeedback(this.has('k_rx') ? '처방전의 두 단계를 차례로 재현하세요. 케이블 색: 빨강 = 짧아짐(수축), 파랑 점선 = 늘어남.' : '어떤 움직임을 만들어야 할까? 볼기 해부실(H-02) 책상의 운동 처방전을 확인해 보세요.', 'info');
  }

  // ================================================================== C: pes anserinus (sartorius + gracilis)
  buildKnee() {
    this.frame('무릎 수술 기록 · H-01 카트', '카트 위의 수술 기록입니다.', ACC);
    this.paper('수술 기록 · 오른쪽 무릎 안쪽', this.adv
      ? '· 거위발(pes anserinus) 힘줄 재고정\n· 정강뼈 몸쪽 안쪽면에 세 힘줄\n· 앞에서 뒤로: S · G · T\n\n· 거위발에 속하지 않는 힘줄은\n  고정기에 걸지 말 것 (H-05)'
      : '· 거위발(pes anserinus) 힘줄 재고정\n· 정강뼈 몸쪽 안쪽면, 세 힘줄이 앞에서 뒤로:\n\n  1. Sartorius 넙다리빗근 (앞칸 · 넙다리신경)\n  2. Gracilis 두덩정강근 (안쪽칸 · 폐쇄신경)\n  3. semiTendinosus 반힘줄근 (뒤칸 · 궁둥신경)\n\n  "Say Grace before Tea" — S·G·T\n\n· H-05 거위발 고정기에 이 순서로 걸 것');
    const { rx, rw } = this.rightCol(0.55);
    const r = this.m.regions.knee_bones;
    const b = fitRect(r, rx, this.cTop + 10, rw, this.cBot - this.cTop - 50);
    regionAt(this, this.m, 'knee_bones', b);
    for (const k of ['pes_st', 'pes_gracilis', 'pes_sartorius']) layerAt(this, this.m, k, b);
    T(this, rx, b.by + b.h + 8, '첨부: 오른쪽 무릎, 안쪽에서 본 모습 (앞 = 왼쪽)', 13, C.dim, { wordWrap: { width: rw } });
    this.addClue('k_knee', '무릎 수술 기록 — 거위발 S·G·T');
  }

  buildPes() {
    this.frame('거위발 고정기 · H-05', '힘줄을 끌어 정강뼈 안쪽의 고정핀에 거세요. 앞(왼쪽)에서 뒤(오른쪽) 순서입니다.', ACC);
    if (this.got.includes('sartorius')) { this.empty(); return; }
    const L = this.leftBox(0.56);
    this.add.nineslice(L.x + L.w / 2, L.y + L.h / 2, 'inv_jbox', undefined, L.w, L.h, 48, 48, 48, 48);
    const r = this.m.regions.knee_bones;
    const b = fitRect(r, L.x + 30, L.y + 24, L.w - 60, L.h - 48);
    const bg = this.add.graphics(); bg.fillStyle(0x140d08, 1); bg.fillRect(b.bx, b.by, b.w, b.h);
    regionAt(this, this.m, 'knee_bones', b);
    this.credit(b.bx + 6, b.by + b.h - 4);
    T(this, b.bx + 8, b.by + 6, '오른쪽 무릎 · 안쪽에서 본 모습 (앞 = 왼쪽)', 13, '#ffe0c0', { weight: '700', backgroundColor: '#140d08cc', padding: { x: 4, y: 2 } }).setDepth(30);
    // pins: the three measured insertions lie within ~12 mm of each other, so the pins are spread along their
    // front-to-back line (order kept) and each tendon then settles at its true place
    const P = this.m.points.med;
    const pts = ['pes_sartorius', 'pes_gracilis', 'pes_st'].map(k => sp(b, P[k]));
    // pins in a row just above the insertions (front = left), kept inside the box
    const gap = Math.max(66, Math.abs(pts[2].x - pts[0].x));
    const cx = Phaser.Math.Clamp((pts[0].x + pts[1].x + pts[2].x) / 3, b.bx + gap + 30, b.bx + b.w - gap - 30);
    const cy = Phaser.Math.Clamp(Math.min(pts[0].y, pts[1].y, pts[2].y) - 46, b.by + 60, b.by + b.h - 60);
    const pins = [0, 1, 2].map(i => ({ x: cx + (i - 1) * gap, y: cy }));
    const lg = this.add.graphics().setDepth(19); lg.lineStyle(2, 0xffd6a0, 0.5);
    pins.forEach((p2, i) => lg.lineBetween(p2.x, p2.y + 20, pts[i].x, pts[i].y));
    const g = this.add.graphics().setDepth(20);
    pins.forEach((p, i) => {
      g.lineStyle(3, 0xffd6a0, 0.95); g.strokeCircle(p.x, p.y, 20); g.fillStyle(0xffb870, 0.18); g.fillCircle(p.x, p.y, 20);
      T(this, p.x, p.y, String(i + 1), 15, '#ffffff', { weight: '900' }).setOrigin(0.5).setDepth(21);
    });
    T(this, pins[0].x - 26, pins[0].y + 26, '앞', 14, '#ffe0c0', { weight: '700', backgroundColor: '#140d08cc', padding: { x: 3, y: 1 } }).setOrigin(1, 0).setDepth(21);
    T(this, pins[2].x + 26, pins[2].y + 26, '뒤', 14, '#ffe0c0', { weight: '700', backgroundColor: '#140d08cc', padding: { x: 3, y: 1 } }).setOrigin(0, 0).setDepth(21);
    (this as unknown as { __pins: unknown }).__pins = pins;
    const ORDER: Record<string, number> = { pes_sartorius: 0, pes_gracilis: 1, pes_st: 2 };
    const KO: Record<string, string> = { pes_sartorius: '넙다리빗근', pes_gracilis: '두덩정강근', pes_st: '반힘줄근', pes_sm: '반막근' };
    const { rx, rw } = this.rightCol(0.56);
    T(this, rx, this.cTop + 4, '힘줄 보관함', 19, '#ffd6a0', { weight: '700' });
    const keys = Phaser.Utils.Array.Shuffle(['pes_sartorius', 'pes_gracilis', 'pes_st', ...(this.adv ? ['pes_sm'] : [])]);
    const cw = rw / keys.length, chh = this.cBot - this.cTop - 70;
    let done = 0;
    keys.forEach((key, i) => {
      const hx = rx + cw * i + cw / 2, hy = this.cTop + 40 + chh / 2;
      const im = this.add.image(hx, hy, `ch4_${key}`); const s0 = Math.min((cw - 14) / im.width, (chh - 30) / im.height, 1);
      im.setScale(s0).setDepth(25).setInteractive({ useHandCursor: true, draggable: true });
      T(this, hx, this.cBot - 4, KO[key], 14, '#ffe0c0', { weight: '700', backgroundColor: '#140d08cc', padding: { x: 3, y: 1 } }).setOrigin(0.5, 1).setDepth(26);
      let set = false;
      const home = () => this.tweens.add({ targets: im, x: hx, y: hy, scale: s0, duration: 220 });
      im.on('drag', (_p: Phaser.Input.Pointer, x: number, y: number) => { if (!set) im.setPosition(x, y); });
      im.on('dragend', (p: Phaser.Input.Pointer) => {
        if (set) return;
        const q = this.lp(p);
        const hit = pins.findIndex(pp => Math.hypot(pp.x - q.x, pp.y - q.y) < 44);
        if (hit < 0) { home(); return; }
        if (key === 'pes_sm') { home(); this.wrong('반막근 — 궁둥뼈결절에서 내려와 정강뼈 안쪽관절융기 뒤쪽에 닿는다. 거위발에는 속하지 않는다.'); return; }
        if (hit !== ORDER[key]) { home(); this.wrong(this.adv ? '순서가 맞지 않는다.' : `${KO[key]}의 자리는 ${ORDER[key] + 1}번이다. 앞에서 뒤로 S·G·T.`); return; }
        set = true; done++; im.disableInteractive(); Audio.play('snap');
        const rr = this.m.rects[key];
        this.tweens.add({ targets: im, x: b.ox + (rr.x + rr.w / 2) * b.q, y: b.oy + (rr.y + rr.h / 2) * b.q, scale: b.q / rr.density, duration: 260, ease: 'Cubic.out' });
        im.setDepth(15 - ORDER[key]);
        if (done === 3) {
          this.setFeedback('세 힘줄이 거위발에 고정됐다. 고정기 잠금이 풀린다!', 'ok');
          this.time.delayedCall(900, () => { Audio.play('door'); this.foundPair(['sartorius', 'gracilis'], '근육 코어 회수 · 넙다리빗근 · 두덩정강근',
            '거위발: 정강뼈 몸쪽 안쪽면에 앞에서 뒤로 넙다리빗근(S)·두덩정강근(G)·반힘줄근(T)이 붙는다. 세 근육은 서로 다른 칸에서 와서(앞칸·안쪽칸·뒤칸) 서로 다른 신경(넙다리·폐쇄·궁둥신경)의 지배를 받는다.\n\n넙다리빗근: 위앞엉덩뼈가시에서 시작하는 몸에서 가장 긴 근육. 엉덩관절 굽힘·벌림·가쪽돌림 + 무릎 굽힘.\n두덩정강근: 두덩뼈 → 거위발. 모음근 중 유일하게 무릎을 지난다.'); });
        } else this.setFeedback(`${KO[key]} 고정 (${done}/3)`, 'ok');
      });
    });
    this.setFeedback(this.has('k_knee') ? '수술 기록의 순서대로 거세요. 1번 = 가장 앞.' : '어떤 순서일까? 하지 근육실(H-01) 카트 위의 무릎 수술 기록에 단서가 있을지도.', 'info');
  }

  // ================================================================== D: nerve compartment fridge (biceps femoris + semitendinosus)
  buildChart() {
    this.frame('신경 지배 차트 · H-04 벽', '벽에 붙은 교육용 차트입니다.', ACC);
    const { cTop, cBot } = this;
    const L = { x: this.px + 40, y: cTop + 10, w: this.pw * 0.5, h: cBot - cTop - 20 };
    const s = this.add.image(0, 0, 'ch4_section'); const q = Math.min((L.w - 60) / s.width, (L.h - 60) / s.height);
    s.setScale(q).setPosition(L.x + L.w / 2, L.y + L.h / 2);
    const bg = this.add.graphics().setDepth(-1); bg.fillStyle(0xe9e4d6, 1); bg.fillRect(s.x - s.displayWidth / 2 - 14, s.y - s.displayHeight / 2 - 14, s.displayWidth + 28, s.displayHeight + 28);
    bg.fillStyle(0x0d0a08, 1); bg.fillRect(s.x - s.displayWidth / 2, s.y - s.displayHeight / 2, s.displayWidth, s.displayHeight);
    this.add.nineslice(s.x, s.y, 'inv_poster_frame', undefined, s.displayWidth + 44, s.displayHeight + 44, 30, 30, 30, 30);
    const sm = this.cache.json.get('ch4_section') as { pxPerMm: number; centre: Record<string, { x: number; y: number }> };
    const x0 = s.x - s.displayWidth / 2, y0 = s.y - s.displayHeight / 2, k = q * sm.pxPerMm;
    for (const [id, c] of Object.entries(sm.centre)) {
      const t = THIGH[id]; if (!t) continue;
      const col = '#' + COMP_COL[t.comp].toString(16).padStart(6, '0');
      T(this, x0 + c.x * k, y0 + c.y * k, this.adv ? COMP_KO[t.comp] : t.ko.replace('넙다리두갈래근 ', '두갈래 '), 12, '#0b0806', { weight: '800', backgroundColor: col + 'dd', padding: { x: 3, y: 1 } }).setOrigin(0.5);
    }
    const rx = L.x + L.w + 30, rw = this.px + this.pw - 30 - rx;
    T(this, rx, cTop + 8, '넙다리의 세 칸 · 세 신경', 19, '#ffd6a0', { weight: '700' });
    T(this, rx, cTop + 44, this.adv
      ? '오른쪽 넙다리 중간 높이 단면 (아래에서 본 방향: 앞 = 위, 가쪽 = 왼쪽).\n\n파랑 = 앞칸 → 넙다리신경\n초록 = 안쪽칸 → 폐쇄신경\n주황 = 뒤칸 → 궁둥신경\n\n※ 3D 모델 단면 · 피부·지방·혈관·신경은 생략'
      : '앞칸 (파랑) → 넙다리신경\n  넙다리네갈래근(곧은근·넓은근 셋), 넙다리빗근\n\n안쪽칸 (초록) → 폐쇄신경\n  긴·짧은·큰모음근, 두덩정강근\n\n뒤칸 (주황) → 궁둥신경\n  넙다리두갈래근, 반힘줄근, 반막근\n\n※ 3D 모델 단면 (앞 = 위, 가쪽 = 왼쪽) · 피부·지방·혈관·신경은 생략', 15, '#e3dccf', { wordWrap: { width: rw }, lineSpacing: 5 });
    this.addClue('k_chart', '신경 지배 차트 — 세 칸, 세 신경');
  }

  buildFridge() {
    this.frame('신경 구획 냉장고 · H-05', '근육 표본을 끌어, 그 근육을 지배하는 신경의 서랍에 넣으세요. 모든 표본이 맞으면 잠금이 풀립니다.', ACC);
    if (this.got.includes('bf')) { this.empty(); return; }
    const { cTop, cBot } = this;
    const specs = Phaser.Utils.Array.Shuffle(fridgeSpecimens());
    // three drawers along the bottom, specimen rack along the top
    const drawH = Math.min(190, (cBot - cTop) * 0.42), dy = cBot - drawH;
    const comps: Comp[] = ['ant', 'med', 'post'];
    const dw = (this.pw - 80) / 3;
    const drawers = comps.map((c, i) => {
      const x = this.px + 30 + i * (dw + 10), cx = x + dw / 2;
      this.add.nineslice(cx, dy + drawH / 2, 'inv_jbox', undefined, dw, drawH, 48, 48, 48, 48);
      const col = '#' + COMP_COL[c].toString(16).padStart(6, '0');
      T(this, cx, dy + 14, COMP_NERVE[c], 19, col, { weight: '800', backgroundColor: '#0b0806e6', padding: { x: 8, y: 3 } }).setOrigin(0.5, 0);
      if (!this.adv) T(this, cx, dy + 50, `넙다리 ${COMP_KO[c]}`, 14, '#ffe8c8', { weight: '700', backgroundColor: '#0b0806cc', padding: { x: 5, y: 1 } }).setOrigin(0.5, 0);
      return { c, x, y: dy, w: dw, h: drawH, n: 0 };
    });
    const top = cTop + 6, rackH = dy - top - 16;
    const cw = (this.pw - 60) / specs.length;
    let left = specs.length;
    specs.forEach((id, i) => {
      const hx = this.px + 30 + cw * i + cw / 2, hy = top + rackH / 2 - 10;
      const im = this.add.image(hx, hy, `ch4_spec_${id}`); const s0 = Math.min((cw - 8) / im.width, (rackH - 34) / im.height, 0.9);
      im.setScale(s0).setDepth(25).setInteractive({ useHandCursor: true, draggable: true });
      const nm = T(this, hx, top + rackH - 4, THIGH[id].ko.replace('넙다리두갈래근 ', '두갈래\n'), 13, '#ffe0c0', { weight: '700', align: 'center', backgroundColor: '#140d08cc', padding: { x: 2, y: 1 } }).setOrigin(0.5, 1).setDepth(26);
      let set = false;
      const home = () => this.tweens.add({ targets: im, x: hx, y: hy, scale: s0, duration: 220 });
      im.on('drag', (_p: Phaser.Input.Pointer, x: number, y: number) => { if (!set) im.setPosition(x, y); });
      im.on('dragend', (p: Phaser.Input.Pointer) => {
        if (set) return;
        const q = this.lp(p);
        const d = drawers.find(dd => q.x > dd.x && q.x < dd.x + dd.w && q.y > dd.y - 30 && q.y < dd.y + dd.h);
        if (!d) { home(); return; }
        const t = THIGH[id];
        if (d.c !== t.comp) { home(); this.wrong(this.adv ? `${t.ko}: 그 신경의 근육이 아니다.` : `${t.ko}은(는) 넙다리 ${COMP_KO[t.comp]} 근육 → ${COMP_NERVE[t.comp]}.`); return; }
        set = true; left--; im.disableInteractive(); nm.destroy(); Audio.play('snap');
        const slot = d.n++; const per = 6, sx = d.x + 22 + (slot % per) * ((d.w - 44) / (per - 1)), sy = d.y + drawH * 0.66;
        this.tweens.add({ targets: im, x: sx, y: sy, scale: Math.min((drawH * 0.5) / im.height, (d.w / per) / im.width), duration: 240 });
        if (left === 0) {
          this.setFeedback('세 서랍이 모두 맞았다. 뒤칸 서랍이 열리며 코어가 나온다!', 'ok');
          this.time.delayedCall(900, () => { Audio.play('door'); this.foundPair(['bf', 'st'], '근육 코어 회수 · 넙다리두갈래근 · 반힘줄근',
            '뒤넙다리근(hamstrings): 넙다리두갈래근 긴갈래·반힘줄근·반막근은 모두 궁둥뼈결절에서 일어나 엉덩관절과 무릎관절 뒤를 지난다 → 엉덩관절 폄 + 무릎 굽힘. 궁둥신경(정강신경 쪽)이 지배한다.\n\n넙다리두갈래근: 가쪽으로 내려가 종아리뼈머리에 닿는다. 짧은갈래는 넙다리뼈 거친선에서 일어나 무릎만 지나고 온종아리신경 쪽 가지를 받는다.\n반힘줄근: 안쪽, 거위발의 T.'); });
        } else this.setFeedback(`${THIGH[id].ko} → ${COMP_NERVE[t.comp]}${t.note && !this.adv ? ` (${t.note})` : ''}`, 'ok');
      });
    });
    (this as unknown as { __fridge: unknown }).__fridge = { drawers: drawers.map(d => ({ c: d.c, x: d.x + d.w / 2, y: d.y + d.h / 2 })), left: () => left };
    this.setFeedback(this.has('k_chart') ? '차트대로: 앞칸 = 넙다리신경, 안쪽칸 = 폐쇄신경, 뒤칸 = 궁둥신경.' : '어느 서랍일까? 하중 제어실(H-04) 벽의 신경 지배 차트를 확인해 보세요.', 'info');
  }

  hints(): string[] {
    const a = this.adv;
    switch (this.kind) {
      case 'gtable': return ['재활 기록지는 표본 냉장실(H-05) 카트 위에 있습니다.', '가장 바깥의 큰 근육(큰볼기근)을 끌어서 치우면 그 아래 근육이 드러납니다.', ...(a ? ['큰볼기근은 넙다리뼈 뒤쪽 위의 거친 면(볼기근거친면)에 닿습니다.'] : []), '중간볼기근은 넙다리뼈 바깥 위쪽의 큰 돌출부, 큰돌기에 닿습니다.'];
      case 'rig4': return ['운동 처방전은 볼기 해부실(H-02) 책상 위에 있습니다.', '엉덩관절 앞을 지나는 근육은 엉덩관절을 굽히고, 무릎 앞을 지나는 근육은 무릎을 폅니다.', '1단계 = 엉덩허리근, 2단계 = 넙다리곧은근.'];
      case 'pes4': return ['무릎 수술 기록은 하지 근육실(H-01) 카트 위에 있습니다.', '거위발은 앞에서 뒤로 S·G·T입니다.', ...(a ? ['반막근은 거위발에 속하지 않습니다.'] : []), '1번 넙다리빗근, 2번 두덩정강근, 3번 반힘줄근.'];
      case 'fridge4': return ['신경 지배 차트는 하중 제어실(H-04) 벽에 있습니다.', '넙다리네갈래근·넙다리빗근 = 넙다리신경, 모음근·두덩정강근 = 폐쇄신경, 뒤넙다리근 = 궁둥신경.'];
      default: return ['단서를 기록장에 저장했습니다. 이 단서가 가리키는 장치를 찾아가세요.'];
    }
  }
}
