import Phaser from 'phaser';
import { InvestBase } from './InvestBase';
import { Audio } from '../../core/audio';
import { View } from '../../core/view';
import { G, Bus } from '../../game/state';
import { T, C, drawPanel, Button } from '../../ui/widgets';
import { CARPAL, CarpalId, PROXIMAL, DISTAL, HAND_CREDIT } from '../../data/hand';
import { handManifest, layerDist } from '../../art/hand';

type Box = { q: number; bx: number; by: number; ox: number; oy: number; w: number; h: number };
const ACC = 0x7fd8ff;

/**
 * CH3 escape-room views: every pair of carpal bones is locked in a device whose clue lies in another room.
 *  journal3 (J-02 desk)    -> vault3 (J-02):  put the two carpals that touch the radius onto its joint surface
 *  surgery (J-01 trolley)  -> tunnel (J-01):  pin the loose flexor retinaculum to its bony pillars
 *  manual3 (J-04 terminal) -> aligner (J-04): seat each metacarpal base on the carpal it articulates with
 *  poster3 (J-01 wall)     -> dial3 (J-02):   order the 8 carpal tiles in their two rows
 * Everything shown is the BodyParts3D model (palmar view of the right hand, fingers up, thumb on the right).
 */
export class InvHandScene extends InvestBase {
  constructor() { super('InvHand'); }
  clueIds = ['h_journal', 'h_surgery', 'h_manual', 'h_poster'];
  get got() { return G.run.items as string[]; }
  get m() { return handManifest(this); }
  state: Record<string, unknown> = {};

  build(kind: string) {
    this.state = {};
    const b: Record<string, () => void> = {
      journal3: () => this.buildJournal(), vault3: () => this.buildVault(), surgery: () => this.buildSurgery(), tunnel: () => this.buildTunnel(),
      manual3: () => this.buildManual(), aligner: () => this.buildAligner(), poster3: () => this.buildPoster(), dial3: () => this.buildDial(),
    };
    b[kind]?.();
  }

  // ---------------------------------------------------------------- helpers
  /** fit the wrist close-up (hand.json wrist rect, frame units) into a box */
  wristBox(x: number, y: number, w: number, h: number, view?: { x: number; y: number; w: number; h: number }): Box {
    const r = view ?? this.m.wrist; const q = Math.min(w / r.w, h / r.h);
    const bx = x + (w - r.w * q) / 2, by = y + (h - r.h * q) / 2;
    return { q, bx, by, ox: bx - r.x * q, oy: by - r.y * q, w: r.w * q, h: r.h * q };
  }
  S(b: Box, p: [number, number] | null | undefined) { const [fx, fy] = p ?? [0, 0]; return { x: b.ox + fx * b.q, y: b.oy + fy * b.q }; }
  /** clip a set of objects to a box */
  clipTo(b: Box, objs: Phaser.GameObjects.Image[]) { const g = this.make.graphics({}); g.fillStyle(0xffffff); g.fillRect(b.bx, b.by, b.w, b.h); const mk = g.createGeometryMask(); objs.forEach(o => o.setMask(mk)); return mk; }
  /** a cropped density-2 layer drawn at its true place in the frame */
  layerAt(key: string, b: Box) {
    const r = this.m.rects[key];
    return this.add.image(b.ox + (r.x + r.w / 2) * b.q, b.oy + (r.y + r.h / 2) * b.q, `ch3_${key}`).setScale(b.q / 2);
  }
  /** a box-sized wrist render (ch3_wrist_*) */
  wristImage(key: string, b: Box) { return this.add.image(b.bx, b.by, `ch3_${key}`).setOrigin(0).setScale(b.q / 2); }
  rightCol() { const rx = this.px + 30 + this.pw * 0.6 + 20; return { rx, rw: this.px + this.pw - 30 - rx }; }
  leftBox() { const { cTop, cBot } = this; return { x: this.px + 30, y: cTop, w: this.pw * 0.6, h: cBot - cTop }; }
  credit(x: number, y: number) { T(this, x, y, HAND_CREDIT, 12, '#8f9bb3', { fine: true }).setOrigin(0, 1).setDepth(5); }
  wrong(msg: string) { G.run.mistakes++; Audio.play('error'); this.cameras.main.shake(120, 0.003); this.setFeedback(msg, 'err'); }
  /** a draggable tile showing one layer, scaled to fit `size`; returns the image */
  tile(key: string, x: number, y: number, size: number) {
    const im = this.add.image(x, y, `ch3_${key}`); const s = Math.min(size / im.width, size / im.height, 1.4);
    im.setScale(s).setDepth(20).setInteractive({ useHandCursor: true, draggable: true });
    (im as unknown as { home: { x: number; y: number; s: number } }).home = { x, y, s };
    return im;
  }
  goHome(im: Phaser.GameObjects.Image) { const h = (im as unknown as { home: { x: number; y: number; s: number } }).home; this.tweens.add({ targets: im, x: h.x, y: h.y, scale: h.s, duration: 220, ease: 'Cubic.out' }); }

  /** recovered pair: both specimens rise, then one record card; Continue hands both to the world */
  foundPair(ids: CarpalId[], title: string, body: string) {
    this.solved = true; Audio.play('pickup'); this.closeLayer();
    const { W, H } = View;
    const burst = this.add.image(W / 2, H / 2, 'light').setTint(0xa8e8ff).setBlendMode(Phaser.BlendModes.ADD).setScale(0.3).setAlpha(0.9).setDepth(240);
    const sps = ids.map((id, i) => {
      const sp = this.add.image(W / 2 + (i - (ids.length - 1) / 2) * W * 0.2, H / 2 + 30, `ch3_car_${id}`).setDepth(241).setAlpha(0);
      const fs = Math.min(W * 0.17 / sp.width, H * 0.4 / sp.height, 2.4); sp.setScale(fs * 0.5);
      this.tweens.add({ targets: sp, y: H / 2, scale: fs, alpha: 1, duration: 280, ease: 'Back.out', delay: i * 80 });
      return sp;
    });
    this.tweens.add({ targets: burst, scale: 2.6, alpha: 0, duration: 650, ease: 'Cubic.out' });
    this.cameras.main.flash(160, 160, 230, 255);
    this.time.delayedCall(700, () => {
      sps.forEach(s => s.destroy()); burst.destroy();
      Audio.play('success');
      const o = this.overlay(title, 900, 560, C.green);
      // which recovered bone is which: a wrist map with a coloured, numbered ring on each one, and the same
      // colour / number on its tile + name (friends could not tell the two recovered bones apart)
      const left = Math.min(360, o.w * 0.4);
      const COLS = [0xffc94a, 0x5fe0ff, 0xff7ab8], CSS = ['#ffc94a', '#5fe0ff', '#ff7ab8'];
      const mapH = (o.h - 110) * 0.5;
      const mb = this.wristBox(o.x + 30, o.y + 64, left, mapH);
      const mapBg = this.add.graphics(); mapBg.fillStyle(0x0b1626, 1); mapBg.fillRoundedRect(mb.bx - 6, mb.by - 6, mb.w + 12, mb.h + 12, 8); o.c.add(mapBg);
      o.c.add(this.wristImage('wrist_full', mb));
      const rings = this.add.graphics(); o.c.add(rings);
      // neighbouring bones sit close together: push each number tag outward from the group's centre, with a leader line
      const pts = ids.map(id => this.S(mb, this.m.points[id]));
      const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length, cy0 = pts.reduce((a, p) => a + p.y, 0) / pts.length;
      ids.forEach((_id, i) => {
        const p = pts[i]; let dx = p.x - cx, dy = p.y - cy0; const d = Math.hypot(dx, dy);
        if (d < 4) { dx = (i % 2 ? 1 : -1); dy = -0.6; } const n = Math.hypot(dx, dy); dx /= n; dy /= n;
        const lx = Phaser.Math.Clamp(p.x + dx * 44, mb.bx + 14, mb.bx + mb.w - 14), ly = Phaser.Math.Clamp(p.y + dy * 44, mb.by + 14, mb.by + mb.h - 14);
        rings.lineStyle(4, COLS[i % 3], 1); rings.strokeCircle(p.x, p.y, 11); rings.lineBetween(p.x + dx * 11, p.y + dy * 11, lx, ly);
        rings.fillStyle(COLS[i % 3], 1); rings.fillCircle(lx, ly, 13);
        o.c.add(T(this, lx, ly, String(i + 1), 17, '#0b1626', { weight: '900' }).setOrigin(0.5));
      });
      o.c.add(T(this, mb.bx + mb.w / 2, mb.by + mb.h + 6, '오른손 손바닥 쪽 · 엄지 = 오른쪽', 12, C.dim).setOrigin(0.5, 0));
      const rowTop = mb.by + mb.h + 28, rowH = (o.y + o.h - 70 - rowTop) / ids.length;
      ids.forEach((id, i) => {
        const cy = rowTop + (i + 0.5) * rowH;
        const dot = this.add.graphics(); dot.fillStyle(COLS[i % 3], 1); dot.fillCircle(o.x + 44, cy, 15); o.c.add(dot);
        o.c.add(T(this, o.x + 44, cy, String(i + 1), 19, '#0b1626', { weight: '900' }).setOrigin(0.5));
        const im = this.add.image(o.x + 100, cy, `ch3_car_${id}`); o.c.add(im);
        im.setScale(Math.min(80 / im.width, (rowH - 8) / im.height, 2));
        const prox = PROXIMAL.includes(id), row = prox ? PROXIMAL : DISTAL;
        o.c.add(T(this, o.x + 150, cy, `${CARPAL[id].ko} (${CARPAL[id].en})\n${prox ? '몸쪽 줄' : '먼쪽 줄'} · 엄지 쪽부터 ${row.indexOf(id) + 1}번째`, 15, CSS[i % 3], { weight: '700', lineSpacing: 2, wordWrap: { width: left - 120 } }).setOrigin(0, 0.5));
      });
      const tx = o.x + 50 + left, tw = o.w - left - 80;
      o.c.add(T(this, tx, o.y + 76, '해부학 도감에 등록되었습니다', 19, C.greenS, { weight: '700' }));
      const bt = T(this, tx, o.y + 112, body, 16, '#d3def3', { wordWrap: { width: tw }, lineSpacing: 5 }); o.c.add(bt);
      for (const sz of [15, 14]) { if (bt.y + bt.height < o.y + o.h - 80) break; bt.setFontSize(sz).setLineSpacing(3); }
      o.c.add(new Button(this, o.x + o.w - 130, o.y + o.h - 40, '계속', () => { Bus.emit('investigate:found', ids.join('+')); this.scene.stop(); }, { w: 200, h: 50, icon: 'check', accent: C.green, primary: true }));
    });
  }
  empty(msg = '장치는 비어 있습니다. 표본은 이미 회수했습니다.') { this.setFeedback(msg, 'info'); }

  /** an open-book page spread with text (lab journal) */
  bookPages(left: string, right: string) {
    const { cTop, cBot } = this;
    const k = Math.min((this.pw - 60) / 700, (cBot - cTop) / 460);
    const bx = this.px + this.pw / 2 - 350 * k, by = cTop + (cBot - cTop - 460 * k) / 2;
    this.add.image(bx, by, 'inv_journal_open').setOrigin(0).setScale(k * 0.5);
    const ink = { ink: true, weight: '600', wordWrap: { width: 300 * k }, lineSpacing: 6 } as const;
    const a = T(this, bx + 34 * k, by + 40 * k, left, 16, '#2b2418', ink), b = T(this, bx + 372 * k, by + 40 * k, right, 16, '#2b2418', ink);
    for (const t of [a, b]) for (const sz of [15, 14, 13]) { if (t.height <= 390 * k) break; t.setFontSize(sz).setLineSpacing(3); }
    return { bx, by, k };
  }

  // ================================================================== A: radiocarpal vault (scaphoid + lunate)
  buildJournal() {
    this.frame('관절 정비 일지 · J-02', '책상 위에 펼쳐진 일지입니다.', ACC);
    this.bookPages('정비 기록 · 손목관절\n\n손목관절(노손목관절)은 노뼈 아래의 오목한 관절면과 손목뼈 몸쪽 줄의 볼록한 면이 만나는 타원관절이다.\n\n자뼈 아래에는 관절원판(삼각섬유연골)이 끼어 있어, 자뼈는 손목뼈에 직접 닿지 않는다.',
      this.adv ? 'J-02 관절면 금고:\n노뼈와 직접 맞닿는 손목뼈 두 개를 올려야 열린다.\n\n※ 표본 상자에 발의 뼈가 섞여 들어왔다. 옛 이름이 같아도 다른 뼈다.'
        : 'J-02 관절면 금고:\n노뼈 관절면에 맞닿는 두 뼈를 올리면 열린다.\n\n· 손배뼈 — 엄지 쪽, 길쭉한 배 모양\n· 반달뼈 — 가운데, 반달 모양\n\n세모뼈는 자뼈 쪽(관절원판 아래)이라 해당 없음.');
    this.addClue('h_journal', '관절 정비 일지 — 노뼈와 맞닿는 손목뼈');
  }

  buildVault() {
    this.frame('관절면 금고 · J-02', '손목뼈 표본을 끌어 노뼈 관절면 위의 알맞은 자리에 올리세요.', ACC);
    if (this.got.includes('scaphoid')) { this.empty(); return; }
    const L = this.leftBox();
    this.add.nineslice(L.x + L.w / 2, L.y + L.h / 2, 'inv_jbox', undefined, L.w, L.h, 48, 48, 48, 48);
    const WR = this.m.wrist, view = { x: WR.x, y: WR.y + WR.h * 0.3, w: WR.w, h: WR.h * 0.7 };
    const b = this.wristBox(L.x + 40, L.y + 30, L.w - 80, L.h - 60, view);
    const glass = this.add.graphics(); glass.fillStyle(0x0b1626, 1); glass.fillRect(b.bx, b.by, b.w, b.h);
    this.clipTo(b, [this.layerAt('radul', b)]);
    this.credit(b.bx + 6, b.by + b.h - 4);
    // three cradles above the radius/ulna: lateral facet, medial facet, over the ulnar disc
    const slots: { id: CarpalId; label: string }[] = [{ id: 'scaphoid', label: '노뼈 가쪽 면' }, { id: 'lunate', label: '노뼈 안쪽 면' }, { id: 'triquetrum', label: '자뼈 쪽 (관절원판)' }];
    const sp: Record<string, { x: number; y: number }> = {};
    const g = this.add.graphics().setDepth(4);
    for (const s of slots) {
      const p = this.S(b, this.m.points[s.id]); sp[s.id] = p;
      g.lineStyle(3, 0x7fd8ff, 0.9); g.strokeCircle(p.x, p.y, 26); g.fillStyle(0x7fd8ff, 0.12); g.fillCircle(p.x, p.y, 26);
      if (!this.adv) T(this, p.x, p.y + 32, s.label, 13, '#cfe8ff', { weight: '700', backgroundColor: '#0b1626cc', padding: { x: 4, y: 1 } }).setOrigin(0.5, 0).setDepth(5);
    }
    (this as unknown as { __slots: unknown }).__slots = sp;
    const { rx, rw } = this.rightCol();
    T(this, rx, this.cTop + 4, '표본 상자', 19, '#bfe6ff', { weight: '700' });
    const cands: string[] = ['car_scaphoid', 'car_lunate', 'car_triquetrum', 'car_capitate', ...(this.adv ? ['dec_navicular'] : [])];
    const order = Phaser.Utils.Array.Shuffle([...cands]);
    const cols = 2, cell = Math.min(rw / cols, 120);
    const placed: Record<string, boolean> = {};
    const tilesById: Record<string, Phaser.GameObjects.Image> = {};
    order.forEach((key, i) => {
      const x = rx + cell / 2 + (i % cols) * cell, y = this.cTop + 70 + Math.floor(i / cols) * (cell + 20);
      const im = this.tile(key, x, y, cell - 26); tilesById[key] = im;
      if (!this.adv && key.startsWith('car_')) T(this, x, y + cell / 2 - 6, CARPAL[key.slice(4) as CarpalId].ko, 14, '#cfe8ff', { weight: '700' }).setOrigin(0.5);
      if (!this.adv && key === 'dec_navicular') T(this, x, y + cell / 2 - 6, '?', 14, '#cfe8ff').setOrigin(0.5);
      im.on('drag', (_p: Phaser.Input.Pointer, dx: number, dy: number) => { if (!placed[key]) im.setPosition(dx, dy); });
      im.on('dragend', () => {
        if (placed[key]) return;
        const hit = slots.find(s => Math.hypot(sp[s.id].x - im.x, sp[s.id].y - im.y) < 46);
        if (!hit) { this.goHome(im); return; }
        if (key === 'dec_navicular') { this.goHome(im); this.wrong('발배뼈(navicular) — 발목의 뼈다. 손배뼈의 옛 이름이 "navicular"라 섞였다. 손목뼈가 아니다.'); return; }
        const id = key.slice(4) as CarpalId;
        if (hit.id === 'triquetrum') {
          this.goHome(im);
          this.wrong(id === 'triquetrum' ? '세모뼈 자리는 맞지만, 이 받침은 자뼈 위 관절원판이다. 금고는 노뼈와 직접 맞닿는 뼈만 받는다.' : '그 받침은 자뼈 쪽 관절원판 위다. 노뼈와 맞닿는 자리가 아니다.');
          return;
        }
        if (hit.id !== id) {
          this.goHome(im);
          this.wrong(this.adv ? '맞지 않는다.' : id === 'capitate' ? '알머리뼈는 먼쪽 줄 한가운데 뼈다. 노뼈와 닿지 않고 반달뼈·손배뼈 위에 얹힌다.' : id === 'triquetrum' ? '세모뼈는 몸쪽 줄 새끼 쪽 뼈로, 노뼈와 직접 닿지 않는다.' : `그 자리는 ${CARPAL[hit.id].ko}의 자리다.`);
          return;
        }
        placed[key] = true; im.disableInteractive(); Audio.play('snap');
        const r = this.m.rects[key], tx = b.ox + (r.x + r.w / 2) * b.q, ty = b.oy + (r.y + r.h / 2) * b.q;
        this.tweens.add({ targets: im, x: tx, y: ty, scale: b.q / 2, duration: 200, ease: 'Cubic.out' });
        if (placed.car_scaphoid && placed.car_lunate) {
          this.setFeedback('철컥— 두 뼈가 노뼈 관절면에 딱 맞았다. 금고가 열린다!', 'ok');
          this.time.delayedCall(700, () => { Audio.play('door'); this.foundPair(['scaphoid', 'lunate'], '손목뼈 회수 · 손배뼈 · 반달뼈',
            '노손목관절(타원관절)은 노뼈 아래 오목면과 손배뼈·반달뼈의 볼록면이 만든다. 세모뼈는 자뼈 머리와 관절원판(삼각섬유연골)을 사이에 둔다.\n\n손배뼈: 넘어지며 손을 짚을 때 가장 잘 부러지는 손목뼈(해부학코담배갑 압통).\n반달뼈: 가장 잘 탈구되는 손목뼈.'); });
        } else this.setFeedback(`${CARPAL[id].ko} — 딱 맞았다. 나머지 하나도 올리세요.`, 'ok');
      });
    });
    this.setFeedback(this.has('h_journal') ? '일지에 적힌 대로: 노뼈와 직접 맞닿는 손목뼈 두 개를 올리세요.' : '무엇을 올려야 할까? 같은 방 책상 위의 관절 정비 일지에 단서가 있을지도.', 'info');
  }

  // ================================================================== B: carpal tunnel (pisiform + hamate)
  buildSurgery() {
    this.frame('수술 기록지 · J-01 트롤리', '트롤리 위에 놓인 수술 기록지입니다.', ACC);
    const { cTop, cBot } = this;
    const h = cBot - cTop - 10, w = Math.min(h * 0.84, this.pw * 0.5);
    const x = this.px + 40, y = cTop + 5;
    this.add.image(x + w / 2, y + h / 2, 'inv_paper').setDisplaySize(w, h).setAngle(-1.5);
    T(this, x + w * 0.1, y + h * 0.08, '수술 기록 · 손목굴 감압술 (오른손)', 17, '#2b2418', { ink: true, weight: '700', wordWrap: { width: w * 0.8 } });
    T(this, x + w * 0.1, y + h * 0.17, this.adv
      ? '· 굽힘근지지띠 절개 후 재고정 예정.\n· 지지띠는 네 기둥(안쪽 둘, 가쪽 둘)에 붙는다.\n· 그 아래 통로로 손가락 굽힘근 힘줄과 정중신경이 지난다.\n\n· J-01 고정기: 네 고정핀을 모두 맞출 것.'
      : '· 굽힘근지지띠 = 손목굴의 "지붕".\n· 안쪽 끝 → 콩알뼈, 갈고리뼈의 갈고리\n· 가쪽 끝 → 손배뼈결절, 큰마름뼈결절\n· 그 아래 통로(손목굴)로 손가락 굽힘근 힘줄 9개와 정중신경이 지난다.\n\n· J-01 고정기: 안쪽 고정핀 두 개를 맞추면 열린다.', 15, '#2b2418', { ink: true, weight: '600', wordWrap: { width: w * 0.8 }, lineSpacing: 6 });
    const { rx, rw } = this.rightCol();
    const b = this.wristBox(rx - 10, cTop + 20, rw + 10, cBot - cTop - 60);
    this.wristImage('wrist_retinac', b);
    T(this, rx, b.by + b.h + 8, '첨부 사진: 오른손 손바닥 쪽 (엄지 = 오른쪽)', 13, C.dim);
    this.addClue('h_surgery', '수술 기록지 — 굽힘근지지띠의 부착부');
  }

  buildTunnel() {
    this.frame('손목굴 고정기 · J-01 해부대', '고정핀을 끌어 굽힘근지지띠가 붙는 뼈 돌기에 꽂으세요.', ACC);
    if (this.got.includes('pisiform')) { this.empty(); return; }
    const L = this.leftBox();
    const b = this.wristBox(L.x, L.y, L.w, L.h);
    const bg = this.add.graphics(); bg.fillStyle(0x0b1626, 1); bg.fillRoundedRect(b.bx - 8, b.by - 8, b.w + 16, b.h + 16, 10);
    this.wristImage('wrist_full', b);
    this.credit(b.bx + 6, b.by + b.h - 4);
    // the loose ligament hangs off its true place (it slides home when pinned)
    const lig = this.layerAt('retinac', b).setAlpha(0.55).setDepth(3);
    const home = { x: lig.x, y: lig.y };
    lig.setPosition(home.x + 10, home.y - b.h * 0.16).setAngle(-8);
    T(this, lig.x, lig.y - lig.displayHeight / 2 - 6, '느슨해진 굽힘근지지띠', 14, '#cfe8ff', { weight: '700' }).setOrigin(0.5, 1).setDepth(4);
    const pts: Record<string, { ko: string; side: 'med' | 'lat' | null; p: [number, number] | null }> = {
      pisiform: { ko: '콩알뼈', side: 'med', p: this.m.points.pisiform },
      hamate_hook: { ko: '갈고리뼈의 갈고리', side: 'med', p: this.m.points.hamate_hook },
      capitate: { ko: '알머리뼈', side: null, p: this.m.points.capitate },
      lunate: { ko: '반달뼈', side: null, p: this.m.points.lunate },
      scaphoid_tubercle: { ko: '손배뼈결절', side: 'lat', p: this.m.points.scaphoid_tubercle },
      trapezium_tubercle: { ko: '큰마름뼈결절', side: 'lat', p: this.m.points.trapezium_tubercle },
    };
    // pin sockets: small brass rings on the bony points (spread a little where two are close)
    const sock: Record<string, { x: number; y: number }> = {};
    const g = this.add.graphics().setDepth(6);
    for (const [k, v] of Object.entries(pts)) {
      const s = this.S(b, v.p); sock[k] = s;
      g.fillStyle(0x000000, 0.35); g.fillCircle(s.x, s.y, 13); g.lineStyle(3, 0xffd34d, 0.95); g.strokeCircle(s.x, s.y, 11);
    }
    (this as unknown as { __sock: unknown }).__sock = sock;
    const need = this.adv ? ['med', 'med', 'lat', 'lat'] as const : ['med', 'med'] as const;
    const { rx, rw } = this.rightCol();
    T(this, rx, this.cTop + 4, '고정핀', 19, '#bfe6ff', { weight: '700' });
    const used = new Set<string>(); let done = 0;
    need.forEach((side, i) => {
      const x = rx + rw / 2, y = this.cTop + 70 + i * 80;
      T(this, x, y + 26, side === 'med' ? '안쪽(새끼 쪽) 고정핀' : '가쪽(엄지 쪽) 고정핀', 15, '#cfe8ff', { weight: '700' }).setOrigin(0.5, 0);
      const pin = this.add.image(x, y, 'inv_knob').setDisplaySize(72, 40).setTint(side === 'med' ? 0xffffff : 0xffe0a0).setDepth(20).setInteractive({ useHandCursor: true, draggable: true });
      let set = false;
      pin.on('drag', (_p: Phaser.Input.Pointer, dx: number, dy: number) => { if (!set) pin.setPosition(dx, dy); });
      pin.on('dragend', () => {
        if (set) return;
        const hit = Object.keys(sock).map(k => ({ k, d: Math.hypot(sock[k].x - pin.x, sock[k].y - pin.y) })).filter(o => o.d < 30).sort((a, z) => a.d - z.d)[0]?.k;
        if (!hit || used.has(hit)) { this.tweens.add({ targets: pin, x, y, duration: 200 }); return; }
        const v = pts[hit];
        if (v.side !== side) {
          this.tweens.add({ targets: pin, x, y, duration: 240 });
          this.wrong(this.adv ? '핀이 미끄러진다. 지지띠가 붙는 곳이 아니다.'
            : v.side === null ? `${v.ko}는 손목굴의 바닥 쪽 뼈다. 지지띠는 손바닥 쪽으로 튀어나온 돌기에 붙는다.` : `${v.ko}는 ${v.side === 'med' ? '안쪽' : '가쪽'} 기둥이다. 이 핀은 ${side === 'med' ? '안쪽' : '가쪽'}용.`);
          return;
        }
        set = true; used.add(hit); pin.disableInteractive(); Audio.play('snap'); done++;
        this.tweens.add({ targets: pin, x: sock[hit].x, y: sock[hit].y, displayWidth: 44, displayHeight: 24, duration: 160 });
        if (done === need.length) {
          Audio.play('unlock');
          this.tweens.add({ targets: lig, x: home.x, y: home.y, angle: 0, alpha: 0.92, duration: 600, ease: 'Back.out' });
          this.setFeedback('굽힘근지지띠가 제자리에 고정됐다 — 손목굴 완성. 아래 칸이 열린다!', 'ok');
          this.time.delayedCall(1100, () => { Audio.play('door'); this.foundPair(['pisiform', 'hamate'], '손목뼈 회수 · 콩알뼈 · 갈고리뼈',
            '굽힘근지지띠는 안쪽으로 콩알뼈·갈고리뼈의 갈고리, 가쪽으로 손배뼈결절·큰마름뼈결절에 붙어 손목굴의 지붕이 된다. 손목굴로 손가락 굽힘근 힘줄 9개와 정중신경이 지난다(손목굴 증후군 = 정중신경 압박).\n\n콩알뼈는 자쪽손목굽힘근 힘줄 속 종자뼈, 갈고리뼈의 갈고리는 자신경이 지나는 Guyon관의 벽이기도 하다.'); });
        } else this.setFeedback(`${v.ko}에 고정. 나머지 핀도 꽂으세요.`, 'ok');
      });
    });
    this.setFeedback(this.has('h_surgery') ? '수술 기록지대로 지지띠가 붙는 뼈 돌기를 찾으세요. 노란 고리가 핀 자리 후보입니다.' : '지지띠는 어디에 붙을까? 이 방 트롤리 위의 수술 기록지를 확인해 보세요.', 'info');
  }

  // ================================================================== C: metacarpal aligner (trapezium + trapezoid)
  buildManual() {
    this.frame('손가락 축 정렬기 매뉴얼 · J-04', '단말기에 띄운 정비 매뉴얼입니다.', ACC);
    const { cTop, cBot } = this;
    const h = cBot - cTop - 10, w = Math.min(h * 1.4, this.pw * 0.56), x = this.px + 40, y = cTop + 5;
    this.add.image(x + w / 2, y + h / 2, 'inv_manual').setDisplaySize(w, h);
    T(this, x + w * 0.08, y + h * 0.1, '손가락 축 정렬기 · 점검 순서', 18, '#2b2418', { ink: true, weight: '700' });
    T(this, x + w * 0.08, y + h * 0.22, this.adv
      ? '1. 다섯 손허리뼈를 모두 꽂는다.\n2. 각 손허리뼈의 바닥은 그것과 관절하는 먼쪽 줄 손목뼈 위에.\n3. 엄지의 관절은 안장 모양이다.'
      : '1. 손허리뼈 다섯 개의 바닥을 먼쪽 줄 손목뼈에 꽂는다.\n   · 엄지(1) → 큰마름뼈 (안장관절)\n   · 검지(2) → 작은마름뼈\n   · 가운데(3) → 알머리뼈\n   · 넷째(4) · 새끼(5) → 갈고리뼈 (둘이 함께)\n2. 다섯 개가 모두 맞으면 하부 칸이 열린다.', 15, '#2b2418', { ink: true, weight: '600', wordWrap: { width: w * 0.84 }, lineSpacing: 6 });
    const { rx, rw } = this.rightCol();
    const im = this.add.image(rx + rw / 2, (cTop + cBot) / 2, 'ch3_hand_full'); im.setScale(Math.min(rw / im.width, (cBot - cTop - 20) / im.height));
    if (!this.adv) {
      const s = im.scale, ox = im.x - im.displayWidth / 2, oy = im.y - im.displayHeight / 2;
      for (let i = 1; i <= 5; i++) { const p = this.m.points[`mc${i}_head`]; if (!p) continue; T(this, ox + p[0] * s, oy + p[1] * s, String(i), 16, '#ffffff', { weight: '900', backgroundColor: '#204070', padding: { x: 4, y: 0 } }).setOrigin(0.5); }
    }
    this.addClue('h_manual', '손가락 축 정렬기 매뉴얼 — 손허리뼈와 손목뼈의 짝');
  }

  buildAligner() {
    this.frame('손가락 축 정렬기 · J-04', '손허리뼈를 끌어, 그 바닥이 관절하는 손목뼈 위 고리에 꽂으세요.', ACC);
    if (this.got.includes('trapezium')) { this.empty(); return; }
    const L = this.leftBox();
    const b = this.wristBox(L.x, L.y, L.w, L.h);
    const bg = this.add.graphics(); bg.fillStyle(0x0b1626, 1); bg.fillRoundedRect(b.bx - 8, b.by - 8, b.w + 16, b.h + 16, 10);
    this.wristImage('wrist_carp', b);
    // the metacarpals overhang the box: clip them to it
    const maskG = this.make.graphics({}); maskG.fillStyle(0xffffff); maskG.fillRect(b.bx - 8, b.by - 8, b.w + 16, b.h + 16);
    const clip = maskG.createGeometryMask();
    this.credit(b.bx + 6, b.by + b.h - 4);
    const targets: CarpalId[] = ['trapezium', 'trapezoid', 'capitate', 'hamate'];
    const tp: Record<string, { x: number; y: number }> = {};
    const g = this.add.graphics().setDepth(6);
    for (const t of targets) {
      const p = this.S(b, this.m.points[t]); tp[t] = p;
      g.lineStyle(3, 0x9fffd0, 0.9); g.strokeCircle(p.x, p.y, 15);
      if (!this.adv) T(this, p.x, p.y - 20, CARPAL[t].ko, 13, '#d8fff0', { weight: '700', backgroundColor: '#0b1626cc', padding: { x: 3, y: 1 } }).setOrigin(0.5, 1).setDepth(7);
    }
    (this as unknown as { __tp: unknown }).__tp = tp;
    const PART: Record<number, CarpalId> = { 1: 'trapezium', 2: 'trapezoid', 3: 'capitate', 4: 'hamate', 5: 'hamate' };
    const list = [1, 2, 3, 4, 5];   // all four rings are used: 4 and 5 both seat on the hamate
    const { rx, rw } = this.rightCol();
    T(this, rx, this.cTop + 4, '손허리뼈 (1 = 엄지)', 19, '#bfe6ff', { weight: '700' });
    const cw = rw / list.length; let done = 0;
    Phaser.Utils.Array.Shuffle([...list]).forEach((n, i) => {
      const x = rx + cw * (i + 0.5), y = this.cTop + 60 + (this.cBot - this.cTop - 80) * 0.4;
      const im = this.tile(`mc_${n}`, x, y, Math.min(cw - 8, 200) * 1.6);
      T(this, x, this.cTop + 40, String(n), 20, '#ffffff', { weight: '900' }).setOrigin(0.5);
      let set = false;
      im.on('drag', (_p: Phaser.Input.Pointer, dx: number, dy: number) => { if (!set) im.setPosition(dx, dy); });
      im.on('dragend', (p: Phaser.Input.Pointer) => {
        if (set) return;
        const hit = targets.find(t => Math.hypot(tp[t].x - p.worldX, tp[t].y - p.worldY) < 34);
        if (!hit) { this.goHome(im); return; }
        if (hit !== PART[n]) {
          this.goHome(im);
          this.wrong(this.adv ? '바닥이 맞물리지 않는다.' : `${n}번 손허리뼈의 바닥은 ${CARPAL[PART[n]].ko}와 관절한다.${n === 1 ? ' (엄지의 안장관절)' : ''}`);
          return;
        }
        set = true; im.disableInteractive(); Audio.play('snap'); done++;
        im.setMask(clip);
        const r = this.m.rects[`mc_${n}`];
        this.tweens.add({ targets: im, x: b.ox + (r.x + r.w / 2) * b.q, y: b.oy + (r.y + r.h / 2) * b.q, scale: b.q / 2, duration: 220, ease: 'Cubic.out' });
        if (done === list.length) {
          this.setFeedback('손가락 축 정렬 완료 — 하부 칸 잠금이 풀린다!', 'ok');
          this.time.delayedCall(900, () => { Audio.play('door'); this.foundPair(['trapezium', 'trapezoid'], '손목뼈 회수 · 큰마름뼈 · 작은마름뼈',
            '먼쪽 줄 손목뼈는 손허리뼈와 만난다: 엄지(1)–큰마름뼈, 검지(2)–작은마름뼈, 가운데(3)–알머리뼈, 넷째·다섯째–갈고리뼈.\n\n엄지 손목손허리관절은 안장관절이라 굽힘·폄, 벌림·모음에 더해 맞섬(엄지 끝을 다른 손가락에 대기)이 가능하다. 이 관절은 나이가 들며 관절염이 잘 생기는 곳이기도 하다.'); });
        } else this.setFeedback(`${n}번 손허리뼈 — ${CARPAL[hit].ko}에 맞물렸다.`, 'ok');
      });
    });
    this.setFeedback(this.has('h_manual') ? '매뉴얼의 짝대로 손허리뼈를 꽂으세요. 초록 고리 = 먼쪽 줄 손목뼈.' : '어느 뼈에 꽂아야 할까? 이 방 단말기의 정비 매뉴얼을 확인해 보세요.', 'info');
  }

  // ================================================================== D: order dial (triquetrum + capitate)
  buildPoster() {
    this.frame('손목뼈 배열 포스터 · J-01 벽', '벽에 붙은 교육용 포스터입니다.', ACC);
    const { cTop, cBot } = this;
    const L = { x: this.px + 40, y: cTop + 10, w: this.pw * 0.55, h: cBot - cTop - 20 };
    const b = this.wristBox(L.x + 24, L.y + 24, L.w - 48, L.h - 48);
    const bg = this.add.graphics(); bg.fillStyle(0xe9e4d6, 1); bg.fillRect(b.bx - 14, b.by - 14, b.w + 28, b.h + 28); bg.fillStyle(0x0d1a2a, 1); bg.fillRect(b.bx, b.by, b.w, b.h);
    this.wristImage('wrist_full', b);
    this.add.nineslice(b.bx + b.w / 2, b.by + b.h / 2, 'inv_poster_frame', undefined, b.w + 44, b.h + 44, 30, 30, 30, 30);
    const NUDGE: Partial<Record<CarpalId, [number, number]>> = { pisiform: [-30, -6], triquetrum: [4, 16] };
    const tag = (id: CarpalId, i: number) => {
      const p0 = this.S(b, this.m.points[id]); const nd = NUDGE[id] ?? [0, 0]; const p = { x: p0.x + nd[0], y: p0.y + nd[1] }; const prox = PROXIMAL.includes(id);
      const t = T(this, p.x, p.y, this.adv ? String(i + 1) : CARPAL[id].ko, this.adv ? 15 : 13, '#ffffff', { weight: '800', backgroundColor: prox ? '#1d4f8acc' : '#7a4a10cc', padding: { x: 3, y: 1 } }).setOrigin(0.5);
      return t;
    };
    [...PROXIMAL, ...DISTAL].forEach((id, i) => tag(id, i % 4));
    const { rx, rw } = this.rightCol();
    T(this, rx, cTop + 8, '손목뼈 배열 · Carpal bones', 19, '#bfe6ff', { weight: '700' });
    T(this, rx, cTop + 44, this.adv
      ? '파랑 = 몸쪽 줄, 주황 = 먼쪽 줄.\n번호는 엄지 쪽(가쪽)부터 센 순서다.\n\n오른손 손바닥 쪽에서 본 모습: 엄지는 오른쪽.'
      : '엄지 쪽(가쪽)부터 —\n\n몸쪽 줄 (팔 쪽)\n 손배뼈 → 반달뼈 → 세모뼈 → 콩알뼈\n\n먼쪽 줄 (손가락 쪽)\n 큰마름뼈 → 작은마름뼈 → 알머리뼈 → 갈고리뼈\n\n외우기: "배·달·세·콩 / 큰·작·알·갈"\n(오른손 손바닥 쪽: 엄지는 오른쪽)', 16, '#d3def3', { wordWrap: { width: rw }, lineSpacing: 6 });
    this.addClue('h_poster', '손목뼈 배열 포스터 — 두 줄의 순서');
  }

  buildDial() {
    this.frame('순서 원판 · J-02', '타일 두 개를 차례로 누르면 자리가 바뀝니다. 두 줄을 올바른 순서로 맞추세요.', ACC);
    if (this.got.includes('triquetrum')) { this.empty(); return; }
    const { cTop, cBot } = this;
    const pw = Math.min(this.pw - 60, 900), ph = cBot - cTop;
    const x0 = this.px + (this.pw - pw) / 2;
    this.add.nineslice(x0 + pw / 2, cTop + ph / 2, 'inv_brass', undefined, pw, ph, 40, 40, 40, 40);
    const sideW = 150, gx = x0 + 30 + sideW, gw = pw - 60 - sideW * 2;
    const cell = Math.min(gw / 4, (ph - 110) / 2), rowY = [cTop + 70 + cell / 2, cTop + 70 + cell * 1.5 + 18];
    // display: distal row on top, proximal below (fingers up); thumb side on the RIGHT (palmar view of the right hand)
    const rows: CarpalId[][] = [DISTAL, PROXIMAL];
    const lab = { weight: '900', backgroundColor: '#1a1206e6', padding: { x: 6, y: 3 } } as const;
    T(this, gx + 4, cTop + 24, '◀ 새끼 쪽 (안쪽)', 16, '#ffe6b0', lab).setOrigin(0, 0);
    T(this, gx + gw - 4, cTop + 24, '엄지 쪽 (가쪽) ▶', 16, '#ffe6b0', lab).setOrigin(1, 0);
    rows.forEach((_r, ri) => T(this, x0 + 34, rowY[ri], ri === 0 ? '먼쪽 줄\n(손가락 쪽)' : '몸쪽 줄\n(팔 쪽)', 16, '#ffe6b0', { ...lab, lineSpacing: 2 }).setOrigin(0, 0.5));
    const slotPos = (ri: number, ci: number) => ({ x: gx + cell * (3 - ci) + cell / 2, y: rowY[ri] });   // ci 0 = thumb side (right)
    const want: CarpalId[] = [...DISTAL, ...PROXIMAL];
    let cur: CarpalId[];
    do { cur = Phaser.Utils.Array.Shuffle([...want]); } while (cur.filter((c, i) => c === want[i]).length > 2);
    const tiles: Record<string, Phaser.GameObjects.Container> = {};
    const lamps: Phaser.GameObjects.Arc[] = [];
    rows.forEach((_r, ri) => lamps.push(this.add.circle(x0 + pw - 40, rowY[ri], 13, 0x330a0a).setStrokeStyle(2, 0x1a1208)));
    const g = this.add.graphics();
    for (let i = 0; i < 8; i++) { const s = slotPos(Math.floor(i / 4), i % 4); g.fillStyle(0x1a1208, 0.55); g.fillRoundedRect(s.x - cell / 2 + 5, s.y - cell / 2 + 5, cell - 10, cell - 10, 10); }
    let sel: number | null = null;
    const place = (i: number, anim: boolean) => {
      const c = tiles[cur[i]]; const s = slotPos(Math.floor(i / 4), i % 4);
      if (anim) this.tweens.add({ targets: c, x: s.x, y: s.y, duration: 200, ease: 'Cubic.out' }); else c.setPosition(s.x, s.y);
    };
    const check = () => {
      const ok = [0, 1].map(ri => [0, 1, 2, 3].every(ci => cur[ri * 4 + ci] === want[ri * 4 + ci]));
      ok.forEach((o, ri) => lamps[ri].setFillStyle(o ? 0x3dffa2 : 0x330a0a));
      if (ok[0] && ok[1]) {
        Object.values(tiles).forEach(t => t.disableInteractive());
        Audio.play('unlock'); this.setFeedback('두 줄이 모두 맞았다 — 원판이 돌아가며 열린다!', 'ok');
        this.time.delayedCall(900, () => { Audio.play('door'); this.foundPair(['triquetrum', 'capitate'], '손목뼈 회수 · 세모뼈 · 알머리뼈',
          '몸쪽 줄(엄지 쪽부터): 손배뼈 · 반달뼈 · 세모뼈 · 콩알뼈\n먼쪽 줄: 큰마름뼈 · 작은마름뼈 · 알머리뼈 · 갈고리뼈\n\n알머리뼈는 가장 큰 손목뼈로 손목 한가운데에서 셋째 손허리뼈와 만나고, 머리는 반달뼈·손배뼈 오목에 들어간다(손목중간관절). 세모뼈의 손바닥 면에는 콩알뼈가 얹힌다.'); });
      } else if (!this.adv) {
        const n = cur.filter((c, i) => c === want[i]).length;
        this.setFeedback(`제자리에 맞은 타일 ${n}/8.${ok[0] || ok[1] ? ' 한 줄은 완성!' : ''}`, n >= 4 ? 'ok' : 'info');
      }
    };
    cur.forEach((id, i) => {
      const s = slotPos(Math.floor(i / 4), i % 4);
      const c = this.add.container(s.x, s.y).setDepth(10);
      const bgc = this.add.graphics(); bgc.fillStyle(0x0b1626, 1); bgc.fillRoundedRect(-cell / 2 + 8, -cell / 2 + 8, cell - 16, cell - 16, 8); bgc.lineStyle(2, 0x7fd8ff, 0.6); bgc.strokeRoundedRect(-cell / 2 + 8, -cell / 2 + 8, cell - 16, cell - 16, 8);
      const im = this.add.image(0, this.adv ? 0 : -8, `ch3_car_${id}`); im.setScale(Math.min((cell - 34) / im.width, (cell - (this.adv ? 34 : 50)) / im.height, 1.6));
      c.add([bgc, im]);
      if (!this.adv) c.add(T(this, 0, cell / 2 - 22, CARPAL[id].ko, 13, '#cfe8ff', { weight: '700' }).setOrigin(0.5));
      c.setSize(cell - 16, cell - 16).setInteractive({ useHandCursor: true });
      c.on('pointerup', () => {
        const i2 = cur.indexOf(id);
        if (sel === null) { sel = i2; bgc.lineStyle(4, 0xffd34d, 1); bgc.strokeRoundedRect(-cell / 2 + 8, -cell / 2 + 8, cell - 16, cell - 16, 8); Audio.play('click'); return; }
        const a = sel; sel = null;
        Object.values(tiles).forEach(t => { const gg = t.list[0] as Phaser.GameObjects.Graphics; gg.clear(); gg.fillStyle(0x0b1626, 1); gg.fillRoundedRect(-cell / 2 + 8, -cell / 2 + 8, cell - 16, cell - 16, 8); gg.lineStyle(2, 0x7fd8ff, 0.6); gg.strokeRoundedRect(-cell / 2 + 8, -cell / 2 + 8, cell - 16, cell - 16, 8); });
        if (a === i2) return;
        [cur[a], cur[i2]] = [cur[i2], cur[a]]; Audio.play('snap');
        place(a, true); place(i2, true); check();
      });
      tiles[id] = c;
    });
    (this as unknown as { __dial: unknown }).__dial = { cur, want, pos: (id: CarpalId) => { const i = cur.indexOf(id); return slotPos(Math.floor(i / 4), i % 4); } };
    // basic: a small reference of the real wrist for orientation
    if (!this.adv) {
      const ref = this.add.image(x0 + pw - 40 - (sideW - 50) / 2, cTop + ph - 36, 'ch3_wrist_full').setOrigin(0.5, 1); ref.setScale(Math.min((sideW - 50) / ref.width, (ph * 0.3) / ref.height));
    }
    check();
    this.setFeedback(this.has('h_poster') ? '포스터의 순서대로 맞추세요. 오른쪽 램프는 그 줄이 맞으면 켜집니다.' : '어떤 순서일까? 관절 연구실(J-01) 벽의 포스터에 단서가 있을지도.', 'info');
  }

  hints(): string[] {
    const a = this.adv;
    switch (this.kind) {
      case 'vault3': return ['노뼈 아래 관절면과 직접 맞닿는 몸쪽 줄 손목뼈 두 개를 찾으세요.', '자뼈 쪽 받침은 관절원판 위입니다 — 정답 자리가 아닙니다.', a ? '배 모양(엄지 쪽)과 반달 모양(가운데) 뼈입니다. 발배뼈는 함정.' : '손배뼈 → 노뼈 가쪽 면, 반달뼈 → 노뼈 안쪽 면.'];
      case 'tunnel': return ['굽힘근지지띠는 손바닥 쪽으로 튀어나온 뼈 돌기에 붙습니다.', '안쪽(새끼 쪽) 기둥은 동그란 작은 뼈와, 갈고리처럼 튀어나온 돌기입니다.', a ? '안쪽: 콩알뼈·갈고리뼈 갈고리 / 가쪽: 손배뼈결절·큰마름뼈결절' : '안쪽 핀 → 콩알뼈, 갈고리뼈의 갈고리.'];
      case 'aligner': return ['각 손허리뼈의 바닥(손목 쪽 끝)은 먼쪽 줄 손목뼈와 만납니다.', '엄지는 안장관절 — 먼쪽 줄 가장 엄지 쪽 뼈와 만납니다.', '1 → 큰마름뼈, 2 → 작은마름뼈, 3 → 알머리뼈, 4·5 → 갈고리뼈'];
      case 'dial3': return ['위 줄이 먼쪽 줄, 아래 줄이 몸쪽 줄입니다. 오른쪽이 엄지 쪽.', '알머리뼈(가장 큰 뼈)는 먼쪽 줄 가운데, 콩알뼈(가장 작은 뼈)는 몸쪽 줄 새끼 쪽 끝입니다.', '먼쪽 줄 오른쪽부터: 큰마름 · 작은마름 · 알머리 · 갈고리 / 몸쪽 줄 오른쪽부터: 손배 · 반달 · 세모 · 콩알'];
      default: return ['이 문서의 내용은 기록장에 저장되었습니다. 관련된 장치를 찾아가 보세요.'];
    }
  }
}
// silence unused (layerDist is used by the lock puzzles; drawPanel kept for parity with other views)
void layerDist; void drawPanel;
