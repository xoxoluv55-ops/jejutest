import Phaser from 'phaser';
import { InvestBase } from './InvestBase';
import { Audio } from '../../core/audio';
import { View } from '../../core/view';
import { G, Bus } from '../../game/state';
import { T, C, Button } from '../../ui/widgets';
import { NERVE, NerveId, NERVE_CREDIT, REFLEX, REFLEX_OPTS, DECOY_NOTE, ZONES } from '../../data/nerve';
import { nerveManifest, fitRect, sp, regionAt5, Box } from '../../art/nerve';

const ACC = 0x7fd8ff;
const MED = 0x4fa8ff, ULN = 0x5dffa0;

/**
 * CH5 escape-room views: each pair of nerve cores is locked in a device whose clue lies in another room.
 *  neuro5 (N-05 trolley) -> reflex5 (N-02): tap the tendon with the reflex hammer, then name nerve + spinal segments
 *  xray5 (N-02 desk)     -> hum5 (N-04):    mark where each fracture injures a nerve on the humerus (back view)
 *  carpal5 (N-01 trolley)-> hand5 (N-05):   paint the palmar sensory map of the median and ulnar nerves
 *  gait5 (N-04 wall)     -> leg5 (N-05):    mark where the sciatic nerve divides, then the foot-drop lesion
 * Everything shown is rendered from the Z-Anatomy models (right limbs); landmark points are measured on them.
 */
export class InvNerveScene extends InvestBase {
  constructor() { super('InvNerve'); }
  clueIds = ['k_neuro', 'k_xray', 'k_carpal', 'k_gait'];
  get got() { return G.run.items as string[]; }
  get m() { return nerveManifest(this); }

  build(kind: string) {
    const b: Record<string, () => void> = {
      neuro5: () => this.buildNeuro(), reflex5: () => this.buildReflex(), xray5: () => this.buildXrayNote(), hum5: () => this.buildHum(),
      carpal5: () => this.buildCarpal(), hand5: () => this.buildHand(), gait5: () => this.buildGait(), leg5: () => this.buildLeg(),
    };
    b[kind]?.();
  }

  // ---------------------------------------------------------------- helpers
  rightCol(frac = 0.56) { const rx = this.px + 30 + this.pw * frac + 20; return { rx, rw: this.px + this.pw - 30 - rx }; }
  leftBox(frac = 0.56) { const { cTop, cBot } = this; return { x: this.px + 30, y: cTop, w: this.pw * frac, h: cBot - cTop }; }
  credit(x: number, y: number) { T(this, x, y, NERVE_CREDIT, 12, '#9fb4c8', { fine: true }).setOrigin(0, 1).setDepth(30); }
  wrong(msg: string) { G.run.mistakes++; Audio.play('error'); this.cameras.main.shake(120, 0.003); this.setFeedback(msg, 'err'); }
  empty(msg = '장치는 비어 있습니다. 신경 코어는 이미 회수했습니다.') { this.setFeedback(msg, 'info'); }
  clip(b: { bx: number; by: number; w: number; h: number }, objs: Phaser.GameObjects.GameObject[]) {
    const g = this.make.graphics({}); g.fillStyle(0xffffff); g.fillRect(b.bx, b.by, b.w, b.h); const mk = g.createGeometryMask();
    objs.forEach(o => (o as unknown as Phaser.GameObjects.Components.Mask).setMask(mk)); return mk;
  }
  caption(b: Box, text: string) { T(this, b.bx + 8, b.by + 6, text, 13, '#d8f0ff', { weight: '700', backgroundColor: '#060a10cc', padding: { x: 4, y: 2 } }).setDepth(30); }
  /** device panel on the left with a model close-up */
  panel(region: string, frac = 0.56) {
    const L = this.leftBox(frac);
    this.add.nineslice(L.x + L.w / 2, L.y + L.h / 2, 'inv_jbox', undefined, L.w, L.h, 48, 48, 48, 48);
    const b = fitRect(this.m.regions[region], L.x + 26, L.y + 22, L.w - 52, L.h - 44);
    const bg = this.add.graphics(); bg.fillStyle(0x060a10, 1); bg.fillRect(b.bx, b.by, b.w, b.h);
    regionAt5(this, this.m, region, b);
    this.credit(b.bx + 6, b.by + b.h - 4);
    return b;
  }
  paper(title: string, body: string) {
    const { cTop, cBot } = this;
    const h = cBot - cTop - 10, w = Math.min(h * 0.86, this.pw * 0.52);
    const x = this.px + 40, y = cTop + 5;
    this.add.image(x + w / 2, y + h / 2, 'inv_paper').setDisplaySize(w, h).setAngle(-1.2);
    T(this, x + w * 0.1, y + h * 0.08, title, 17, '#1c2430', { ink: true, weight: '700', wordWrap: { width: w * 0.8 } });
    const t = T(this, x + w * 0.1, y + h * 0.18, body, 15, '#1c2430', { ink: true, weight: '600', wordWrap: { width: w * 0.8 }, lineSpacing: 6 });
    for (const s of [14, 13]) { if (t.height <= h * 0.76) break; t.setFontSize(s).setLineSpacing(3); }
  }
  attach(region: string, note: string, crop?: { y0: number; y1: number }) {
    const { rx, rw } = this.rightCol(0.55);
    const r = this.m.regions[region];
    const rr = crop ? { x: r.x, y: r.y + r.h * crop.y0, w: r.w, h: r.h * (crop.y1 - crop.y0) } : r;
    const b = fitRect(rr, rx, this.cTop + 10, rw, this.cBot - this.cTop - 50);
    const im = regionAt5(this, this.m, region, b); this.clip(b, [im]);
    T(this, rx, b.by + b.h + 8, note, 13, C.dim, { wordWrap: { width: rw } });
  }
  /** lettered markers on measured landmarks of a view */
  markers(b: Box, view: string, ids: string[], onTap: (id: string) => void) {
    const out: Record<string, { x: number; y: number }> = {};
    const objs: Phaser.GameObjects.GameObject[] = [];
    ids.forEach((id, i) => {
      const p = sp(b, this.m.points[view][id]); out[id] = p;
      const c = this.add.circle(p.x, p.y, 17, 0x7fd8ff, 0.22).setStrokeStyle(3, 0xbfeaff, 1).setDepth(40).setInteractive({ useHandCursor: true });
      const t = T(this, p.x, p.y, String.fromCharCode(65 + i), 15, '#ffffff', { weight: '900' }).setOrigin(0.5).setDepth(41);
      t.setStroke('#06121c', 4);
      this.tweens.add({ targets: c, scale: 1.15, duration: 600, yoyo: true, repeat: -1 });
      c.on('pointerup', () => onTap(id));
      objs.push(c, t);
    });
    (this as unknown as { __marks: unknown }).__marks = out;
    return { pos: out, destroy: () => objs.forEach(o => o.destroy()) };
  }
  ring(p: { x: number; y: number }, col = 0x3dffa2) {
    const r = this.add.circle(p.x, p.y, 10, col, 0.4).setStrokeStyle(3, col).setDepth(42);
    this.tweens.add({ targets: r, scale: 3, alpha: 0, duration: 700, onComplete: () => r.destroy() });
  }

  foundPair(ids: NerveId[], title: string, body: string) {
    this.solved = true; Audio.play('pickup'); this.closeLayer();
    const { W, H } = View;
    const burst = this.add.image(W / 2, H / 2, 'light').setTint(0xc8f0ff).setBlendMode(Phaser.BlendModes.ADD).setScale(0.3).setAlpha(0.9).setDepth(240);
    const sps = ids.map((id, i) => {
      const s = this.add.image(W / 2 + (i - (ids.length - 1) / 2) * W * 0.2, H / 2 + 30, `ch5_core_${id}`).setDepth(241).setAlpha(0);
      const fs = Math.min(W * 0.17 / s.width, H * 0.6 / s.height, 1.2); s.setScale(fs * 0.5);
      this.tweens.add({ targets: s, y: H / 2, scale: fs, alpha: 1, duration: 280, ease: 'Back.out', delay: i * 80 });
      return s;
    });
    this.tweens.add({ targets: burst, scale: 2.6, alpha: 0, duration: 650, ease: 'Cubic.out' });
    this.cameras.main.flash(160, 200, 240, 255);
    this.time.delayedCall(700, () => {
      sps.forEach(s => s.destroy()); burst.destroy();
      Audio.play('success');
      const o = this.overlay(title, 920, 580, C.green);
      const left = Math.min(330, o.w * 0.36);
      ids.forEach((id, i) => {
        const cx = o.x + 30 + (i + 0.5) * left / ids.length, cy = o.y + 50 + (o.h - 110) / 2;
        const im = this.add.image(cx, cy, `ch5_core_${id}`); o.c.add(im);
        im.setScale(Math.min((left / ids.length - 16) / im.width, (o.h - 150) / im.height, 1));
        o.c.add(T(this, cx, o.y + o.h - 52, NERVE[id].ko, 15, '#d8f0ff', { weight: '700' }).setOrigin(0.5));
      });
      const tx = o.x + 50 + left, tw = o.w - left - 80;
      o.c.add(T(this, tx, o.y + 76, '해부학 도감에 등록되었습니다', 19, C.greenS, { weight: '700' }));
      const bt = T(this, tx, o.y + 112, body, 16, '#dfe8f0', { wordWrap: { width: tw }, lineSpacing: 5 }); o.c.add(bt);
      for (const sz of [15, 14, 13]) { if (bt.y + bt.height < o.y + o.h - 80) break; bt.setFontSize(sz).setLineSpacing(3); }
      o.c.add(new Button(this, o.x + o.w - 130, o.y + o.h - 40, '계속', () => { Bus.emit('investigate:found', ids.join('+')); this.scene.stop(); }, { w: 200, h: 50, icon: 'check', accent: C.green, primary: true }));
    });
  }

  // ================================================================== A: reflex bench (musculocutaneous + femoral)
  buildNeuro() {
    this.frame('신경학 검사 기록지 · N-05', '카트 위에 놓인 검사 기록지입니다.', ACC);
    this.paper('신경학 검사 · 심부건반사', this.adv
      ? '· 반사 2종을 검사할 것\n  ① 팔꿈치 앞, 굵은 굽힘근의 힘줄\n  ② 무릎뼈 아래의 힘줄\n\n· 각 반사의 지배 신경과 척수 분절을\n  N-02 반사 검사대에 기록할 것'
      : '· ① 위팔두갈래근 반사\n  팔꿈치 앞의 위팔두갈래근 힘줄을 두드린다\n  → 근육피부신경 · C5–C6\n\n· ② 무릎 반사\n  무릎뼈 아래 무릎인대를 두드린다\n  → 넙다리신경 · L2–L4\n\n· N-02 반사 검사대에 순서대로 입력할 것');
    this.attach('pknee_close', '첨부: 오른쪽 무릎 앞면 (가쪽 = 왼쪽) · 신경은 노란색');
    this.addClue('k_neuro', '신경학 검사 기록지 — 반사 2종의 신경·분절');
  }

  buildReflex() {
    this.frame('반사 검사대 · N-02', '반사 망치로 힘줄을 두드리고, 반사를 전달하는 신경과 척수 분절을 고르세요.', ACC);
    if (this.got.includes('musculocutaneous')) { this.empty(); return; }
    const { rx, rw } = this.rightCol();
    const stepT = T(this, rx, this.cTop + 6, '', 19, '#bfeaff', { weight: '700', wordWrap: { width: rw } });
    const subT = T(this, rx, this.cTop + 40, '', 16, '#dfe8f0', { wordWrap: { width: rw }, lineSpacing: 5 });
    let k = 0, phase: 'tap' | 'pick' = 'tap';
    let objs: Phaser.GameObjects.GameObject[] = [];
    let mk: { destroy: () => void } | null = null;
    const clear = () => { objs.forEach(o => o.destroy()); objs = []; mk?.destroy(); mk = null; };
    const stage = () => {
      clear(); phase = 'tap';
      const R = REFLEX[k];
      const b = this.panel(R.region === 'elbow' ? 'elbow_close' : 'pknee_close');
      this.caption(b, R.region === 'elbow' ? '오른쪽 팔꿈치 · 앞에서 본 모습 (가쪽 = 왼쪽)' : '오른쪽 무릎 · 앞에서 본 모습 (가쪽 = 왼쪽)');
      const view = R.region === 'elbow' ? 'aant' : 'lant';
      stepT.setText(`${k + 1} / 2 · ${this.adv ? (k === 0 ? '팔꿈치 반사' : '무릎 반사') : R.ko}`);
      subT.setText(this.adv ? '반사를 볼 힘줄을 A–C 중에서 눌러 두드리세요.' : k === 0 ? '팔꿈치 앞 한가운데의 위팔두갈래근 힘줄을 눌러 두드리세요.' : '무릎뼈 바로 아래의 무릎인대를 눌러 두드리세요.');
      const ids = Phaser.Utils.Array.Shuffle([R.key, ...R.decoys]);
      mk = this.markers(b, view, ids, id => tap(id, b, view));
    };
    const tap = (id: string, b: Box, view: string) => {
      if (this.solved || phase !== 'tap') return;
      const R = REFLEX[k];
      if (id !== R.key) { this.wrong(DECOY_NOTE[id] ?? '반사를 보는 힘줄이 아니다.'); return; }
      phase = 'pick'; mk?.destroy(); mk = null;
      const p = sp(b, this.m.points[view][id]);
      // hammer swing + reflex jolt
      const hm = this.add.container(p.x + 60, p.y - 70).setDepth(50);
      const g = this.add.graphics(); g.fillStyle(0x8a6a48, 1); g.fillRoundedRect(-4, -4, 70, 8, 3); g.fillStyle(0xd8dde4, 1); g.fillRoundedRect(-14, -14, 20, 28, 6); g.lineStyle(2, 0x2a3440, 1); g.strokeRoundedRect(-14, -14, 20, 28, 6);
      hm.add(g); hm.setAngle(-40); objs.push(hm);
      this.tweens.add({ targets: hm, x: p.x + 14, y: p.y - 4, angle: 10, duration: 220, ease: 'Cubic.in', onComplete: () => {
        Audio.play('snap'); this.ring(p, 0xffe066); this.cameras.main.shake(140, 0.004);
        this.tweens.add({ targets: hm, x: p.x + 60, y: p.y - 70, angle: -40, duration: 300 });
        this.setFeedback(R.id === 'biceps' ? '힘줄이 늘어나자 위팔두갈래근이 반사적으로 짧게 수축했다 (팔꿈치가 살짝 굽는다).' : '무릎인대가 늘어나자 넙다리네갈래근이 반사적으로 수축했다 (종아리가 앞으로 튄다).', 'ok');
        pickNerve();
      } });
    };
    const pickNerve = () => {
      const R = REFLEX[k];
      stepT.setText(`${k + 1} / 2 · ${R.ko}`);
      subT.setText('이 반사를 전달하는 신경과 척수 분절은?');
      let opts = REFLEX_OPTS[R.id].map(([n, r]) => ({ n: n as NerveId, r }));
      if (this.adv) {
        const [ok, b2, c2] = opts;
        opts = [ok, { n: ok.n, r: c2.r }, { n: b2.n, r: ok.r }, c2];   // the right nerve with the wrong segment, and vice versa
      }
      opts = Phaser.Utils.Array.Shuffle(opts);
      const top = this.cTop + 110, bh = Math.min(56, (this.cBot - top - 20) / opts.length - 12);
      opts.forEach((o, i) => {
        const bt = new Button(this, rx + rw / 2, top + bh / 2 + i * (bh + 12), `${NERVE[o.n].ko} · ${o.r}`, () => choose(o.n, o.r), { w: rw, h: bh, size: 17 });
        objs.push(bt);
      });
      (this as unknown as { __reflex: unknown }).__reflex = { k, phase, opts };
    };
    const choose = (n: NerveId, r: string) => {
      if (this.solved || phase !== 'pick') return;
      const R = REFLEX[k];
      if (n !== R.nerve || r !== R.roots) {
        this.wrong(this.adv ? (n === R.nerve ? '신경은 맞다. 척수 분절이 다르다.' : r === R.roots ? '분절은 맞다. 신경이 다르다.' : '신경도 분절도 맞지 않는다.')
          : `${NERVE[n].ko}(${r})은(는) 이 반사가 아니다. ${R.ko}: ${NERVE[R.nerve].ko}, ${R.roots}.`);
        return;
      }
      Audio.play('snap'); phase = 'tap';
      this.setFeedback(`${R.ko} = ${NERVE[R.nerve].ko} · ${R.roots}. 기록 완료.`, 'ok');
      k++;
      if (k >= REFLEX.length) {
        this.time.delayedCall(900, () => { Audio.play('door'); this.foundPair(['musculocutaneous', 'femoral'], '신경 코어 회수 · 근육피부신경 · 넙다리신경',
          '심부건반사: 힘줄을 두드려 근육을 갑자기 늘이면 근방추 → 감각신경 → 척수 → 운동신경 → 같은 근육 수축의 반사궁이 돈다.\n\n근육피부신경(C5–C7): 팔신경얼기 가쪽다발. 부리위팔근을 뚫고 위팔두갈래근·위팔근을 지배 → 위팔두갈래근 반사(C5–C6).\n\n넙다리신경(L2–L4): 허리신경얼기. 샅고랑인대 아래로 넙다리 앞에 나와 넙다리네갈래근을 지배 → 무릎 반사(L2–L4).'); });
      } else this.time.delayedCall(1000, stage);
    };
    stage();
    this.setFeedback(this.has('k_neuro') ? '기록지대로: 힘줄을 두드린 뒤 신경과 분절을 고르세요.' : '어느 힘줄, 어느 신경일까? 감각 검사실(N-05) 카트 위의 검사 기록지에 단서가 있을지도.', 'info');
  }

  // ================================================================== B: fracture reader (axillary + radial)
  buildXrayNote() {
    this.frame('X-ray 판독 의뢰서 · N-02 책상', '책상 위의 판독 의뢰서입니다.', ACC);
    this.paper('판독 의뢰 · 오른쪽 위팔뼈 골절 2건', this.adv
      ? '· 1건: 어깨 탈구와 함께 생긴 위팔뼈 위쪽 골절\n  — 어깨를 옆으로 들지 못함\n\n· 2건: 위팔뼈 몸통 중간 골절\n  — 손목이 아래로 처짐\n\n· N-04 판독기: 골절마다 뼈에 붙어 지나는\n  신경의 자리를 표시할 것'
      : '· 1건: 어깨 탈구 + 위팔뼈 수술목 골절\n  → 수술목을 뒤에서 감아 도는 겨드랑신경\n    (어깨세모근 마비: 어깨 벌림 약화)\n\n· 2건: 위팔뼈 몸통 중간 골절 + 손목 처짐\n  → 몸통 뒤 노신경고랑의 노신경\n    (손목·손가락 폄근 마비)\n\n· N-04 판독기에 1건, 2건 순서로 표시할 것');
    this.attach('hum_close', '첨부: 오른쪽 위팔뼈, 뒤에서 본 모습 (가쪽 = 오른쪽) · 신경은 노란색');
    this.addClue('k_xray', 'X-ray 판독 의뢰서 — 수술목: 겨드랑신경, 몸통 중간: 노신경');
  }

  buildHum() {
    this.frame('골절 판독기 · N-04', '골절마다, 그 자리에 뼈와 붙어 지나 함께 다치는 신경의 위치를 누르세요.', ACC);
    if (this.got.includes('axillary')) { this.empty(); return; }
    const b = this.panel('hum_close');
    this.caption(b, '오른쪽 위팔뼈 · 뒤에서 본 모습 (가쪽 = 오른쪽)');
    const { rx, rw } = this.rightCol();
    const stepT = T(this, rx, this.cTop + 6, '', 19, '#bfeaff', { weight: '700', wordWrap: { width: rw } });
    const subT = T(this, rx, this.cTop + 74, '', 16, '#dfe8f0', { wordWrap: { width: rw }, lineSpacing: 5 });
    const tasks = [
      { want: 'axNeck', nerve: 'axillary' as NerveId, ko: '① 어깨 탈구 + 위쪽 골절', sub: this.adv ? '' : '위팔뼈 수술목(머리 바로 아래의 잘록한 곳)을 뒤에서 감아 도는 신경의 자리.' },
      { want: 'radGroove', nerve: 'radial' as NerveId, ko: '② 몸통 중간 골절 + 손목 처짐', sub: this.adv ? '' : '위팔뼈 몸통 뒤를 비스듬히 감아 내려가는 신경(노신경고랑)의 자리.' },
    ];
    const ids = this.adv ? ['axNeck', 'radGroove', 'ulnEpi', 'humHead', 'latEpi'] : ['axNeck', 'radGroove', 'ulnEpi', 'humHead'];
    let k = 0;
    const show = () => { if (k >= tasks.length) return; stepT.setText(`${tasks[k].ko}`); subT.setText(tasks[k].sub); };
    const tap = (id: string) => {
      if (this.solved) return;
      if (id !== tasks[k].want) { this.wrong(this.adv ? '그 자리의 신경은 이 골절의 증상과 맞지 않는다.' : DECOY_NOTE[id] ?? '이 골절과 관계없는 자리다.'); return; }
      Audio.play('snap'); this.ring(mk.pos[id]);
      const n = NERVE[tasks[k].nerve];
      this.setFeedback(`${n.ko} — ${n.course}`, 'ok');
      k++;
      if (k >= tasks.length) {
        mk.destroy();
        this.time.delayedCall(1100, () => { Audio.play('door'); this.foundPair(['axillary', 'radial'], '신경 코어 회수 · 겨드랑신경 · 노신경',
          '겨드랑신경(C5–C6, 뒤다발): 네모공간을 지나 위팔뼈 수술목을 뒤에서 감아 돈다 → 어깨세모근·작은원근. 수술목 골절·어깨 탈구에서 다친다(어깨 벌림 약화, 어깨 가쪽 감각 소실).\n\n노신경(C5–T1, 뒤다발): 위팔뼈 몸통 뒤의 노신경고랑을 나선형으로 돈다 → 위팔세갈래근, 손목·손가락 폄근. 몸통 중간 골절에서 다친다(손목 처짐).\n\n모델 측정: 노신경은 위팔뼈 중간 높이 구간에서 뼈와 맞닿아 있다.'); });
      } else this.time.delayedCall(900, show);
    };
    const mk = this.markers(b, 'apost', ids, tap);
    show();
    this.setFeedback(this.has('k_xray') ? '의뢰서의 두 골절을 순서대로 표시하세요.' : '어떤 골절일까? 반사 검사실(N-02) 책상의 X-ray 판독 의뢰서를 확인해 보세요.', 'info');
  }

  // ================================================================== C: sensory map (median + ulnar)
  buildCarpal() {
    this.frame('손목굴 증후군 진료 기록 · N-01 카트', '카트 위의 진료 기록입니다.', ACC);
    this.paper('진료 기록 · 오른손 저림', this.adv
      ? '· 밤에 손이 저려서 깸, 털면 나아짐\n· 엄지두덩 위축, 엄지 맞섬 약화\n· 저림: 손바닥 쪽 엄지·검지·가운뎃손가락,\n  넷째손가락의 엄지 쪽 절반\n\n· N-05 감각 지도 패널: 눌린 신경의 영역과\n  나머지 신경의 영역을 나누어 칠할 것'
      : '· 진단: 손목굴 증후군 (정중신경 압박)\n\n· 정중신경 영역 (3½ 손가락)\n  엄지 · 집게 · 가운뎃손가락 · 넷째손가락 엄지 쪽 절반\n\n· 자신경 영역 (1½ 손가락)\n  넷째손가락 새끼 쪽 절반 · 새끼손가락\n\n· N-05 감각 지도 패널에 두 영역을 칠할 것');
    this.attach('hand_close', '첨부: 오른손 손바닥 쪽 (엄지 = 왼쪽) · 손가락 신경은 노란색');
    this.addClue('k_carpal', '손목굴 진료 기록 — 정중신경 3½, 자신경 1½');
  }

  buildHand() {
    this.frame('감각 지도 패널 · N-05', '붓(신경)을 고르고 손가락 구역을 눌러 칠한 뒤 검사를 실행하세요.', ACC);
    if (this.got.includes('median')) { this.empty(); return; }
    const b = this.panel('hand_close', 0.58);
    this.caption(b, '오른손 · 손바닥 쪽 (엄지 = 왼쪽)');
    const P = this.m.points.aant;
    const paint: Record<string, 'median' | 'ulnar' | ''> = {};
    let brush: 'median' | 'ulnar' = 'median';
    const dots: Record<string, Phaser.GameObjects.Arc> = {};
    const pos: Record<string, { x: number; y: number }> = {};
    for (const z of ZONES) {
      const p = sp(b, P[z.tip]); const q = { x: p.x + Math.sign(z.dx) * 15, y: p.y + 8 };
      pos[z.id] = q; paint[z.id] = '';
      const c = this.add.circle(q.x, q.y, z.dx ? 13 : 17, 0x0a1420, 0.55).setStrokeStyle(3, 0xffffff, 0.9).setDepth(40).setInteractive({ useHandCursor: true });
      c.on('pointerup', () => {
        if (this.solved || done) return;
        paint[z.id] = paint[z.id] === brush ? '' : brush; Audio.play('type');
        c.setFillStyle(paint[z.id] === 'median' ? MED : paint[z.id] === 'ulnar' ? ULN : 0x0a1420, paint[z.id] ? 0.85 : 0.55);
      });
      dots[z.id] = c;
    }
    const { rx, rw } = this.rightCol(0.58);
    T(this, rx, this.cTop + 6, '붓 선택', 19, '#bfeaff', { weight: '700' });
    const bm = new Button(this, rx + rw / 2, this.cTop + 64, '정중신경 (파랑)', () => setBrush('median'), { w: rw, h: 50, size: 17, accent: MED });
    const bu = new Button(this, rx + rw / 2, this.cTop + 124, '자신경 (초록)', () => setBrush('ulnar'), { w: rw, h: 50, size: 17, accent: ULN });
    const setBrush = (n: 'median' | 'ulnar') => { brush = n; bm.o.primary = n === 'median'; bu.o.primary = n === 'ulnar'; bm.redraw(); bu.redraw(); Audio.play('click'); };
    setBrush('median');
    T(this, rx, this.cTop + 166, '넷째손가락은 두 구역(엄지 쪽 · 새끼 쪽 절반)으로 나뉩니다.', 14, C.dim, { wordWrap: { width: rw } });
    let done = false;
    const run = () => {
      if (this.solved || done) return;
      const bad = ZONES.filter(z => paint[z.id] !== z.nerve);
      if (bad.some(z => !paint[z.id])) { this.setFeedback(`아직 칠하지 않은 구역이 ${bad.filter(z => !paint[z.id]).length}곳 있습니다.`, 'warn'); return; }
      if (bad.length) {
        this.wrong(this.adv ? `감각 지도가 맞지 않는다 (틀린 구역 ${bad.length}곳).` : `틀린 구역: ${bad.map(z => z.ko).join(', ')}. ${bad[0].nerve === 'median' ? '정중신경' : '자신경'} 영역이다.`);
        if (!this.adv) bad.forEach(z => this.tweens.add({ targets: dots[z.id], scale: 1.4, duration: 160, yoyo: true, repeat: 2 }));
        return;
      }
      done = true; Audio.play('snap'); Object.values(pos).forEach(p => this.ring(p, 0xbfeaff));
      this.setFeedback('감각 지도 일치 — 정중신경 3½, 자신경 1½. 패널 잠금이 풀린다!', 'ok');
      this.time.delayedCall(1000, () => { Audio.play('door'); this.foundPair(['median', 'ulnar'], '신경 코어 회수 · 정중신경 · 자신경',
        '정중신경(C5–T1, 가쪽·안쪽다발): 손목굴로 손바닥에 들어가 엄지두덩근을 지배하고, 엄지~넷째손가락 엄지 쪽 절반(3½)의 손바닥 감각을 맡는다. 손목굴 증후군에서 눌린다.\n\n자신경(C8–T1, 안쪽다발): 안쪽위관절융기 뒤를 지나 손의 작은 근육 대부분을 지배하고, 넷째손가락 새끼 쪽 절반과 새끼손가락(1½)의 감각을 맡는다.\n\n모델 확인: 넷째손가락 끝마디에는 두 신경의 손가락신경이 양쪽에서 닿는다.'); });
    };
    new Button(this, rx + rw / 2, this.cBot - 34, '검사 실행', run, { w: rw, h: 54, icon: 'check', accent: C.green, primary: true });
    (this as unknown as { __hand: unknown }).__hand = { pos, setBrush, run, paint };
    this.setFeedback(this.has('k_carpal') ? '진료 기록대로 정중신경 · 자신경 영역을 칠하세요.' : '어느 신경의 영역일까? 신경 배선실(N-01) 카트 위의 진료 기록에 단서가 있을지도.', 'info');
  }

  // ================================================================== D: leg wiring tracer (sciatic + common fibular)
  buildGait() {
    this.frame('보행 분석 기록 · N-04 벽', '벽에 붙은 보행 분석 기록입니다.', ACC);
    this.paper('보행 분석 · 오른다리 발처짐', this.adv
      ? '· 걸을 때 발끝이 끌려 무릎을 높이 든다\n  (steppage gait)\n· 발등 감각 저하\n· 병력: 무릎 아래 바깥쪽 깁스 3주\n\n· N-05 추적기: ① 신경 줄기가 둘로 갈라지는 곳\n  ② 이 환자의 손상 자리를 차례로 표시'
      : '· 걸을 때 발끝이 끌린다 → 발처짐(foot drop)\n· 발등이 저리다\n· 병력: 무릎 아래 바깥쪽 깁스 3주\n\n· 궁둥신경은 무릎 위(넙다리 뒤 아래쪽)에서\n  정강신경 + 온종아리신경으로 갈라진다\n· 온종아리신경은 종아리뼈 목을 바깥에서 감아\n  돈다 → 깁스·골절에 눌려 발처짐\n\n· N-05 추적기: ① 갈림점 ② 종아리뼈 목');
    this.attach('knee_close', '첨부: 오른다리 넙다리·무릎 뒷면 (가쪽 = 오른쪽) · 신경은 노란색');
    this.addClue('k_gait', '보행 분석 기록 — 갈림점, 종아리뼈 목');
  }

  buildLeg() {
    this.frame('다리 배선 추적기 · N-05', '신경 줄기를 따라가며 요구하는 지점을 누르세요.', ACC);
    if (this.got.includes('sciatic')) { this.empty(); return; }
    const b = this.panel('knee_close', 0.5);
    this.caption(b, '오른다리 · 뒤에서 (가쪽 = 오른쪽)');
    const { rx, rw } = this.rightCol(0.5);
    const stepT = T(this, rx, this.cTop + 6, '', 19, '#bfeaff', { weight: '700', wordWrap: { width: rw } });
    const subT = T(this, rx, this.cTop + 74, '', 16, '#dfe8f0', { wordWrap: { width: rw }, lineSpacing: 5 });
    const tasks = [
      { want: 'sciSplit', ko: '① 궁둥신경이 두 가지로 갈라지는 곳', sub: this.adv ? '' : '넙다리 뒤 한가운데를 내려온 굵은 신경이 정강신경(안쪽)과 온종아리신경(가쪽)으로 나뉘는 지점.' },
      { want: 'fibNeck', ko: '② 발처짐 환자의 손상 자리', sub: this.adv ? '' : '온종아리신경이 종아리뼈 목을 바깥에서 감아 도는 곳.' },
    ];
    const ids = this.adv ? ['sciSplit', 'fibNeck', 'ischTub', 'fibHead'] : ['sciSplit', 'fibNeck', 'ischTub'];
    let k = 0;
    const show = () => { if (k >= tasks.length) return; stepT.setText(tasks[k].ko); subT.setText(tasks[k].sub); };
    const tap = (id: string) => {
      if (this.solved) return;
      if (id !== tasks[k].want) { this.wrong(this.adv && id === 'fibHead' ? '종아리뼈머리는 넙다리두갈래근이 닿는 곳. 신경은 그 바로 아래를 감는다.' : DECOY_NOTE[id] ?? '그 자리가 아니다.'); return; }
      Audio.play('snap'); this.ring(mk.pos[id]);
      this.setFeedback(k === 0 ? '갈림점 — 궁둥신경이 정강신경(오금 한가운데로)과 온종아리신경(가쪽으로)으로 나뉜다. 모델에서 무릎 위 약 11 cm.' : '종아리뼈 목 — 온종아리신경이 뼈에 바로 닿아 감아 돈다(모델 측정: 뼈와 접촉).', 'ok');
      k++;
      if (k >= tasks.length) {
        mk.destroy();
        this.time.delayedCall(1100, () => { Audio.play('door'); this.foundPair(['sciatic', 'fibular'], '신경 코어 회수 · 궁둥신경 · 온종아리신경',
          '궁둥신경(L4–S3, 엉치신경얼기): 몸에서 가장 굵은 신경. 궁둥구멍근 아래로 골반을 나와 넙다리 뒤를 내려가며 뒤넙다리근을 지배하고, 무릎 위에서 정강신경과 온종아리신경으로 갈라진다.\n\n온종아리신경(L4–S2): 종아리뼈 목을 바깥에서 감아 돈 뒤 얕은·깊은종아리신경으로 나뉜다 → 종아리 앞칸(발등굽힘)·가쪽칸. 피부 바로 아래라 골절·깁스·다리 꼬기에 눌려 발처짐이 생긴다.'); });
      } else this.time.delayedCall(900, show);
    };
    const mk = this.markers(b, 'lpost', ids, tap);
    show();
    this.setFeedback(this.has('k_gait') ? '기록대로 두 지점을 차례로 표시하세요.' : '어디를 표시해야 할까? 배전 제어실(N-04) 벽의 보행 분석 기록을 확인해 보세요.', 'info');
  }

  hints(): string[] {
    const a = this.adv;
    switch (this.kind) {
      case 'reflex5': return ['검사 기록지는 감각 검사실(N-05) 카트 위에 있습니다.', '팔꿈치는 위팔두갈래근 힘줄, 무릎은 무릎뼈 아래 무릎인대를 두드립니다.', ...(a ? ['위팔두갈래근 반사는 C5–C6, 무릎 반사는 L2–L4.'] : []), '근육피부신경 · C5–C6, 넙다리신경 · L2–L4.'];
      case 'hum5': return ['판독 의뢰서는 반사 검사실(N-02) 책상 위에 있습니다.', '겨드랑신경은 수술목, 노신경은 몸통 중간 뒤(노신경고랑)를 지납니다.'];
      case 'hand5': return ['진료 기록은 신경 배선실(N-01) 카트 위에 있습니다.', '정중신경: 엄지·집게·가운뎃손가락·넷째 엄지 쪽 절반. 자신경: 넷째 새끼 쪽 절반·새끼손가락.'];
      case 'leg5': return ['보행 분석 기록은 배전 제어실(N-04) 벽에 있습니다.', '궁둥신경은 무릎 위에서 갈라지고, 온종아리신경은 종아리뼈 목을 감아 돕니다.'];
      default: return ['단서를 기록장에 저장했습니다. 이 단서가 가리키는 장치를 찾아가세요.'];
    }
  }
}
