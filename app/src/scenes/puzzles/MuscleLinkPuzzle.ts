import Phaser from 'phaser';
import { PuzzleBase } from './PuzzleBase';
import { View } from '../../core/view';
import { Audio } from '../../core/audio';
import { G } from '../../game/state';
import { MUSCLES, MuscleId, ATT, AttId, LINK_BASIC, LINK_ADV, LINK_NODES } from '../../data/muscles';
import { plateKey, makeMuscleTexture, MODEL_CREDIT } from '../../art/muscles';
import { DENSITY } from '../../art/bones';
import { T, C, drawIcon } from '../../ui/widgets';

interface Node { id: AttId; x: number; y: number; px: number; py: number; g: Phaser.GameObjects.Graphics; t?: Phaser.GameObjects.Text }   // (x,y) = tap marker, (px,py) = true site
interface Item { id: MuscleId; done: boolean; bg: Phaser.GameObjects.Graphics; t: Phaser.GameObjects.Text; st: Phaser.GameObjects.Text; x: number; y: number; w: number; h: number }

// Callout direction for each site (unit-ish vector, screen space): crowded sites (e.g. coracoid process and
// supraglenoid tubercle lie 8 units apart in the anterior projection) get a tap marker pushed out along this
// direction with a leader line to the true site.
const CALLOUT: Partial<Record<AttId, [number, number]>> = {
  acromion: [-0.6, -1], clavLat: [0.5, -1], coracoid: [1, 0.15], supraglenoid: [0.7, -0.8], greater: [-1, -0.4], infraglenoid: [1, 0.5],
  deltTub: [-1, 0], humMed: [1, 0], humAnt: [1, -0.2], latSupra: [-1, 0], medEpi: [1, 0.1], olecranon: [1, 0.6], ulnTub: [1, 0.4], radTub: [-1, 0.3], radStyloid: [-0.4, 1],
};

// draw order of the model layers, deep -> superficial (matches the depth order on the full plate)
const LAYER: Record<MuscleId, number> = { supraspinatus: 0, triceps: 1, brachialis: 2, coracobrachialis: 3, brachioradialis: 4, biceps: 5, deltoid: 6, pecmajor: 7, latissimus: 0 };

/**
 * CH2 PUZZLE 2 — 기시·정지 연결. Choose a muscle, tap its origin(s) (proximal, fixed) and then its insertion (distal, moving)
 * on the skeleton. Correct links rebuild the muscle on the plate; wrong taps explain what really attaches there.
 */
export class MuscleLinkPuzzle extends PuzzleBase {
  constructor() { super('Link'); }
  s = 0.6; fx = 0; fy = 0;
  nodes: Node[] = []; items: Item[] = [];
  sel: Item | null = null;
  picked: AttId[] = [];
  phase: 'origin' | 'insertion' = 'origin';
  stepT!: Phaser.GameObjects.Text;
  stub!: Phaser.GameObjects.Graphics;

  create() {
    this.initView();
    this.nodes = []; this.items = []; this.sel = null; this.picked = []; this.phase = 'origin';
    const adv = G.run.difficulty === 'adv';
    this.frame('근육 연결 콘솔 · 기시와 정지', '근육을 고른 뒤 뼈 위의 기시(몸쪽 고정점) → 정지(움직이는 쪽) 순서로 눌러 근육을 다시 연결하세요.', C.pink);
    const { W, H } = View; const portrait = H > W;
    const crop = { x: 140, y: 110, w: 560, h: 1000 };
    const areaW = portrait ? this.pw - 60 : this.pw * 0.5, areaH = portrait ? this.ph * 0.56 : this.ph - 180;
    this.s = Math.min(areaW / crop.w, areaH / crop.h);
    this.fx = this.px + 30 + (areaW - crop.w * this.s) / 2 - crop.x * this.s;
    this.fy = this.py + 78 + (areaH - crop.h * this.s) / 2 - crop.y * this.s;
    const pl = this.add.graphics();
    const rx = this.fx + crop.x * this.s, ry = this.fy + crop.y * this.s, rw = crop.w * this.s, rh = crop.h * this.s;
    pl.fillStyle(0x12060c, 0.75); pl.fillRoundedRect(rx - 12, ry - 12, rw + 24, rh + 24, 12);
    pl.lineStyle(1.5, C.pink, 0.35); pl.strokeRoundedRect(rx - 12, ry - 12, rw + 24, rh + 24, 12);
    // skeleton plate rendered from the BodyParts3D model
    const img = this.add.image(this.fx, this.fy, plateKey('bones')).setOrigin(0).setScale(this.s / DENSITY);
    const mask = this.make.graphics({}, false); mask.fillRect(rx, ry, rw, rh); img.setMask(mask.createGeometryMask());
    T(this, rx + 8, ry + rh - 26, '오른팔 · 앞면  (점선 원 = 뒤쪽 구조)', 13, C.pinkS, { weight: '700' });
    T(this, rx + rw, ry + rh + 16, MODEL_CREDIT, 11, '#8f7f88').setOrigin(1, 0.5);
    this.stub = this.add.graphics().setDepth(15);
    // attachment nodes: true site (measured on the model) + tap marker; crowded sites are spread out as callouts
    for (const id of LINK_NODES) {
      const a = ATT[id];
      const px = this.fx + a.x * this.s, py = this.fy + a.y * this.s;
      this.nodes.push({ id, x: px, y: py, px, py, g: this.add.graphics().setDepth(20) });
    }
    this.layoutCallouts();
    for (const n of this.nodes) {
      const a = ATT[n.id];
      if (!adv) {
        const left = n.x < n.px - 2 || (Math.abs(n.x - n.px) <= 2 && a.x < 300);
        n.t = T(this, n.x + (left ? -12 : 12), n.y, a.ko, 12, '#ffd9e3', { weight: '700', backgroundColor: '#14070dcc', padding: { x: 4, y: 2 } }).setOrigin(left ? 1 : 0, 0.5).setDepth(21);
        if (left && n.t.x - n.t.width < rx - 8) n.t.setX(rx - 8 + n.t.width);
      }
      this.drawNode(n, 'idle');
    }
    const hit = this.add.zone(rx, ry, rw, rh).setOrigin(0).setInteractive();
    hit.on('pointerup', (p: Phaser.Input.Pointer) => this.tap(p.worldX, p.worldY));
    // muscle list
    const list = adv ? LINK_ADV : LINK_BASIC;
    const cx0 = portrait ? this.px + 30 : this.px + this.pw * 0.54 + 10, cy0 = portrait ? ry + rh + 30 : this.py + 96;
    const cw = portrait ? this.pw - 60 : this.pw * 0.46 - 60;
    T(this, cx0, cy0, '손상된 근육', 17, C.pinkS, { weight: '700' });
    const colN = portrait ? 2 : 1, iw = (cw - (colN - 1) * 12) / colN, ih = 58;
    list.forEach((id, i) => {
      const M = MUSCLES[id];
      const x = cx0 + (i % colN) * (iw + 12), y = cy0 + 32 + Math.floor(i / colN) * (ih + 10);
      const bg = this.add.graphics();
      const t = T(this, x + 16, y + 20, adv ? M.en : `${M.ko} · ${M.en}`, 18, C.white, { weight: '700' }).setOrigin(0, 0.5);
      const st = T(this, x + 16, y + 42, M.posterior ? '연결 대기 · 뒤쪽 근육(장두)' : '연결 대기', 13, C.dim).setOrigin(0, 0.5);
      const it: Item = { id, done: false, bg, t, st, x, y, w: iw, h: ih };
      this.drawItem(it);
      const z = this.add.zone(x, y, iw, ih).setOrigin(0).setInteractive({ useHandCursor: true });
      z.on('pointerup', () => this.select(it));
      this.items.push(it);
    });
    const ly = cy0 + 32 + Math.ceil(list.length / colN) * (ih + 10) + 10;
    this.stepT = T(this, cx0, ly, '', 19, C.amberS, { weight: '700', wordWrap: { width: cw } });
    T(this, cx0, ly + 64, '기시(Origin): 근육이 수축할 때 비교적 고정되는 몸쪽(근위) 부착부\n정지(Insertion): 수축할 때 끌려와 움직이는 먼쪽(원위) 부착부', 15, '#e3cfd8', { wordWrap: { width: cw }, lineSpacing: 6 });
    this.setFeedback('왼쪽 목록에서 근육을 하나 고르세요. 두 갈래(두 곳)에서 시작하는 근육도 있습니다.', 'info');
    this.select(this.items[0]);
  }

  /** Push markers that sit closer than `min` px apart outward along their callout direction (true sites stay put). */
  layoutCallouts() {
    const min = 30;
    const crowded = (n: Node) => this.nodes.some(o => o !== n && Math.hypot(o.px - n.px, o.py - n.py) < min);
    for (const n of this.nodes) {
      if (!crowded(n)) continue;
      const [dx, dy] = CALLOUT[n.id] ?? [n.px < this.fx + 330 * this.s ? -1 : 1, 0]; const l = Math.hypot(dx, dy) || 1;
      n.x = n.px + dx / l * 26; n.y = n.py + dy / l * 26;
    }
    for (let it = 0; it < 80; it++) {
      for (const a of this.nodes) for (const b of this.nodes) {
        if (a === b) continue;
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01;
        if (d < min) { const k = (min - d) / 2 / d; a.x -= dx * k; a.y -= dy * k; b.x += dx * k; b.y += dy * k; }
      }
    }
  }

  drawNode(n: Node, st: 'idle' | 'pick' | 'ok' | 'err') {
    const a = ATT[n.id]; const g = n.g; g.clear();
    // leader line + true-site dot when the marker is a callout
    if (Math.hypot(n.x - n.px, n.y - n.py) > 4) {
      g.lineStyle(1.2, 0xffd0dc, 0.7); g.lineBetween(n.px, n.py, n.x, n.y);
      g.fillStyle(0xffd0dc, 0.9); g.fillCircle(n.px, n.py, 2.2);
    }
    const col = { idle: 0xffd0dc, pick: 0xffe08a, ok: C.green, err: C.red }[st];
    if (st !== 'idle') { g.fillStyle(col, 0.22); g.fillCircle(n.x, n.y, 18); }
    if (a.posterior) { g.lineStyle(2, col, 1); for (let k = 0; k < 8; k++) { const a0 = k / 8 * Math.PI * 2; g.beginPath(); g.arc(n.x, n.y, 9, a0, a0 + 0.45); g.strokePath(); } }
    else { g.fillStyle(col, st === 'idle' ? 0.9 : 1); g.fillCircle(n.x, n.y, st === 'idle' ? 6 : 8); g.lineStyle(1.5, 0x1a0610, 1); g.strokeCircle(n.x, n.y, st === 'idle' ? 6 : 8); }
  }

  drawItem(it: Item) {
    const on = this.sel === it;
    const col = it.done ? C.green : on ? C.pink : C.line;
    it.bg.clear(); it.bg.fillStyle(it.done ? 0x08281c : on ? 0x2a0b16 : 0x0a1222, 0.95); it.bg.fillRoundedRect(it.x, it.y, it.w, it.h, 8);
    it.bg.lineStyle(on ? 2.2 : 1.2, col, 1); it.bg.strokeRoundedRect(it.x, it.y, it.w, it.h, 8);
    if (it.done) drawIcon(it.bg, 'check', it.x + it.w - 24, it.y + it.h / 2, 18, C.green);
  }

  select(it: Item) {
    if (this.solved || it.done) return;
    this.sel = it; this.picked = []; this.phase = 'origin'; this.stub.clear();
    for (const n of this.nodes) this.drawNode(n, 'idle');
    for (const o of this.items) this.drawItem(o);
    Audio.play('click');
    this.updateStep();
  }

  updateStep() {
    const it = this.sel; if (!it) { this.stepT.setText(''); return; }
    const M = MUSCLES[it.id];
    const adv = G.run.difficulty === 'adv';
    const name = adv ? M.en : M.ko;
    if (this.phase === 'origin') {
      const need = M.origins.length;
      this.stepT.setText(`${name}: 기시 지점을 누르세요  (${this.picked.length}/${need})${need > 1 ? `\n※ ${adv ? 'two origins' : '두 곳에서 시작하는 근육'}` : ''}`);
    } else this.stepT.setText(`${name}: 이제 정지 지점을 누르세요`);
  }

  nearest(x: number, y: number) {
    let best: Node | null = null, bd = 1e9;
    for (const n of this.nodes) { const d = Phaser.Math.Distance.Between(x, y, n.x, n.y); if (d < bd) { bd = d; best = n; } }
    return bd < 34 ? best : null;
  }

  tap(x: number, y: number) {
    if (this.solved || !this.sel) return;
    const n = this.nearest(x, y); if (!n) return;
    const it = this.sel; const M = MUSCLES[it.id]; const A = ATT[n.id];
    const adv = G.run.difficulty === 'adv';
    const name = adv ? M.en : M.ko;
    if (this.phase === 'origin') {
      if (this.picked.includes(n.id)) return;
      if (M.origins.includes(n.id)) {
        this.picked.push(n.id); this.drawNode(n, 'pick'); Audio.play('snap');
        this.setFeedback(`✓ ${A.ko} — ${name}의 기시입니다.${M.origins.length > this.picked.length ? ' 나머지 기시도 찾으세요.' : ''}`, 'ok');
        if (this.picked.length === M.origins.length) this.phase = 'insertion';
        this.drawStub();
        this.updateStep(); return;
      }
      this.wrong(n, n.id === M.insertion
        ? `${A.ko}은(는) ${name}의 정지(움직이는 쪽)입니다. 기시(몸쪽 고정점)를 먼저 찾으세요.`
        : `${A.ko}은(는) ${name}의 기시가 아닙니다. ${A.on}${adv ? '' : `  힌트: ${name}의 기시는 ${M.originText}.`}`);
      return;
    }
    if (n.id === M.insertion) { this.connect(it, n); return; }
    this.wrong(n, M.origins.includes(n.id)
      ? `${A.ko}은(는) 이미 선택한 기시입니다. 근육이 끌어당기는 먼쪽 정지를 찾으세요.`
      : `${A.ko}은(는) ${name}의 정지가 아닙니다. ${A.on}${adv ? '' : `  힌트: ${name}의 정지는 ${M.insertionText}.`}`);
  }

  drawStub() {
    const g = this.stub; g.clear();
    g.lineStyle(3, 0xffe08a, 0.8);
    const pts = this.picked.map(id => this.nodes.find(n => n.id === id)!);
    if (pts.length > 1) for (let i = 1; i < pts.length; i++) g.lineBetween(pts[0].x, pts[0].y, pts[i].x, pts[i].y);
  }

  wrong(n: Node, msg: string) {
    Audio.play('error'); this.mistake(); G.run.stats.link++;
    this.drawNode(n, 'err'); this.time.delayedCall(600, () => this.drawNode(n, this.picked.includes(n.id) ? 'pick' : 'idle'));
    this.setFeedback(msg, 'err');
  }

  connect(it: Item, n: Node) {
    const M = MUSCLES[it.id];
    this.drawNode(n, 'ok'); for (const id of this.picked) this.drawNode(this.nodes.find(x => x.id === id)!, 'ok');
    this.stub.clear();
    Audio.play('success');
    // the muscle layer rendered from the model appears between its real attachments (posterior muscles = x-ray)
    const mt = makeMuscleTexture(this, it.id, 'real');
    const im = this.add.image(this.fx + (mt.x + mt.w / 2) * this.s, this.fy + (mt.y + mt.h / 2) * this.s, mt.key).setScale(this.s / DENSITY).setDepth(2 + LAYER[it.id]).setAlpha(0);
    this.tweens.add({ targets: im, alpha: M.posterior ? 0.55 : 0.97, duration: 500 });
    const gl = this.add.image(im.x, im.y, makeMuscleTexture(this, it.id, 'glow').key).setScale(this.s / DENSITY).setDepth(12).setAlpha(0.95);
    this.tweens.add({ targets: gl, alpha: 0, duration: 1300, delay: 500, onComplete: () => gl.destroy() });
    // pull signal: a pulse runs from each origin to the insertion (direction of pull)
    const ins = this.nodes.find(x => x.id === M.insertion)!;
    for (const id of M.origins) {
      const o = this.nodes.find(x => x.id === id)!;
      const dot = this.add.image(o.px, o.py, 'light').setScale(0.12).setTint(0xffe08a).setBlendMode(Phaser.BlendModes.ADD).setDepth(16);
      this.tweens.add({ targets: dot, x: ins.px, y: ins.py, duration: 650, repeat: 1, ease: 'Sine.inOut', onComplete: () => dot.destroy() });
    }
    it.done = true; it.st.setText(`기시 ${M.originText} → 정지 ${M.insertionText}`).setColor(C.greenS);
    this.setFeedback(`${M.ko} 연결 복구 ✓  작용: ${M.action}`, 'ok');
    this.sel = null; for (const o of this.items) this.drawItem(o);
    const next = this.items.find(o => !o.done);
    if (next) { this.time.delayedCall(700, () => { if (!this.solved) this.select(next); }); return; }
    this.solved = true; this.stepT.setText('모든 근육 연결 완료');
    this.time.delayedCall(800, () => this.success('c_origin', '근육은 기시(고정)에서 정지(움직임) 쪽으로 당긴다', 900));
  }
}
