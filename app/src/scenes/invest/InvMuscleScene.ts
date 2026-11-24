import Phaser from 'phaser';
import { InvestBase, Overlay } from './InvestBase';
import { Audio } from '../../core/audio';
import { G } from '../../game/state';
import { T, C } from '../../ui/widgets';
import { ATT, AttId, MUSCLES, MuscleId } from '../../data/muscles';
import { plateManifest } from '../../art/muscles';
import { deltSeq, Fibre, FIBRE_KO, FIBRE_ORIGIN, FIBRE_MOVE, Move, MOVE_KO, MOVE_DESC } from '../../data/escape';

type Win = { x: number; y: number; w: number; h: number };
interface MoFrame { angle: number; pivot: number[]; handle: number[]; paths: { m: string; pts: number[][] }[] }
interface MoMeta { size: number[]; angles: number[]; frames: MoFrame[] }

const FOUND_TEXT: Partial<Record<MuscleId, string>> = {
  biceps: '위팔두갈래근은 두 갈래로 일어난다: 긴갈래는 관절위결절, 짧은갈래는 부리돌기. 노뼈거친면에 닿아 팔꿈치를 굽히고 아래팔을 강하게 뒤친다. 근육피부신경.',
  coracobrachialis: '부리위팔근은 부리돌기에서 일어나 위팔뼈 몸통 안쪽 중간에 닿는다. 어깨 굽힘·모음을 돕는다. 근육피부신경이 이 근육을 뚫고 지나간다.',
  deltoid: '어깨세모근은 빗장뼈 가쪽 1/3(앞섬유) · 봉우리(중간섬유) · 어깨뼈가시(뒤섬유)에서 일어나 어깨세모근거친면에 닿는다. 중간섬유가 벌림, 앞섬유가 굽힘, 뒤섬유가 폄을 맡는다. 겨드랑신경.',
  brachialis: '위팔근은 위팔두갈래근 아래(깊은 층)에서 위팔뼈 앞면 먼쪽 1/2에서 일어나 자뼈거친면·갈고리돌기에 닿는다. 아래팔이 엎침이든 뒤침이든 팔꿈치를 굽히는 주작용근이다.',
  triceps: '위팔세갈래근은 긴갈래(관절아래결절)와 가쪽·안쪽갈래(위팔뼈 뒷면)로 일어나 팔꿈치머리에 닿는다. 팔꿈치를 펴는 주작용근. 노신경.',
  brachioradialis: '위팔노근은 위팔뼈 가쪽관절융기위능선에서 일어나 노뼈 붓돌기 기저부에 닿는다. 아래팔이 중립(엄지가 위)일 때 팔꿈치 굽힘에 가장 강하게 작용한다. 노신경.',
};

/**
 * CH2 escape-room views (v0.10): every muscle data core is behind a device whose clue lies in another room.
 *  notes (M-02 desk) -> locker2 (M-02): two keys into the biceps origins on a skeleton plate (adv: + coracobrachialis key)
 *  chart (M-01 wall) -> lightbox (M-02): press the movement button of each deltoid fibre in the plate's order
 *  memo (M-01 trolley) -> dissect (M-01 table): peel the biceps layer, press the brachialis insertion
 *  manual2 (M-04 terminal) -> rig (M-04): extend the elbow model, hook the cable on the triceps insertion
 *                                         (adv: then 90 deg + brachioradialis insertion)
 */
export class InvMuscleScene extends InvestBase {
  constructor() { super('InvMuscle'); }
  clueIds = ['m_notes', 'm_chart', 'm_memo', 'm_manual'];
  get got() { return G.run.items as string[]; }

  preload() {
    super.preload();
    const k = (this.sys.settings.data as { kind?: string } | undefined)?.kind;
    if (k === 'rig') {
      if (!this.cache.json.exists('mo_elbow')) this.load.json('mo_elbow', 'assets/ch2/motion/elbow.json');
      for (let i = 0; i <= 14; i++) if (!this.textures.exists(`mo_elbow_b${i}`)) this.load.image(`mo_elbow_b${i}`, `assets/ch2/motion/elbow_b${i}.webp`);
    }
  }

  build(kind: string) {
    const m: Record<string, () => void> = {
      notes: () => this.buildNotes(), locker2: () => this.buildLocker(), chart: () => this.buildChart(), lightbox: () => this.buildLightbox(),
      memo: () => this.buildMemo(), dissect: () => this.buildDissect(), manual2: () => this.buildManual(), rig: () => this.buildRig(),
    };
    m[kind]?.();
  }

  /** a cropped window of a frame-sized CH2 plate (or one muscle layer) drawn at scale q with its top-left at (bx, by) */
  plateLayer(key: string, r: Win, W: Win, bx: number, by: number, q: number, parent?: Phaser.GameObjects.Container) {
    const x0 = Math.max(r.x, W.x), y0 = Math.max(r.y, W.y), x1 = Math.min(r.x + r.w, W.x + W.w), y1 = Math.min(r.y + r.h, W.y + W.h);
    if (x1 <= x0 || y1 <= y0 || !this.textures.exists(key)) return null;
    const im = this.add.image(bx + (r.x - W.x) * q, by + (r.y - W.y) * q, key).setOrigin(0).setScale(q / 2);
    im.setCrop((x0 - r.x) * 2, (y0 - r.y) * 2, (x1 - x0) * 2, (y1 - y0) * 2);
    parent?.add(im);
    return im;
  }
  /** fit a frame window into a box; returns scale and top-left */
  fitWin(W: Win, x: number, y: number, w: number, h: number) { const q = Math.min(w / W.w, h / W.h); return { q, bx: x + (w - W.w * q) / 2, by: y + (h - W.h * q) / 2 }; }
  P(a: AttId, W: Win, f: { q: number; bx: number; by: number }) { return { x: f.bx + (ATT[a].x - W.x) * f.q, y: f.by + (ATT[a].y - W.y) * f.q }; }
  rightCol() { const rx = this.px + 30 + this.pw * 0.62 + 20; return { rx, rw: this.px + this.pw - 30 - rx }; }
  foundCore(id: MuscleId) { this.found(id, `근육 데이터 코어 회수 · ${MUSCLES[id].ko} ${MUSCLES[id].en}`, FOUND_TEXT[id] ?? '', `mus_real_${id}`); }

  // ================================================================== biceps (+ coracobrachialis)
  buildNotes() {
    this.frame('해부 실습 노트 · M-02', '노트를 넘겨 보세요.', C.pink);
    const { cTop, cBot } = this;
    const k = Math.min((this.pw - 60) / 700, (cBot - cTop) / 460);
    const bx = this.px + this.pw / 2 - 350 * k, by = cTop + (cBot - cTop - 460 * k) / 2;
    this.add.image(bx, by, 'inv_journal_open').setOrigin(0).setScale(k * 0.5);
    const pw = 300 * k, lx = bx + 34 * k, rx = bx + 372 * k, ty = by + 40 * k;
    const ink = { ink: true, weight: '600', wordWrap: { width: pw }, lineSpacing: 6 } as const;
    T(this, lx, ty, '실습 7 · 위팔의 앞칸 근육\n\n위팔두갈래근은 이름 그대로 "두 갈래". 두 머리가 어깨뼈의 서로 다른 곳에서 일어나 하나로 합쳐진다.\n\n보관함 S-B2는 두 갈래가 일어나는 두 곳에 열쇠를 꽂아야 열린다.', 16, '#2b2418', ink);
    const right = this.adv ? '긴갈래 열쇠 → 관절위결절\n짧은갈래 열쇠 → 부리돌기\n\n(심화) 부리위팔근 열쇠 → 그 근육이 닿는 곳'
      : '긴갈래 열쇠 → 관절위결절\n  (관절오목 바로 위의 작은 결절)\n\n짧은갈래 열쇠 → 부리돌기\n  (앞으로 튀어나온 갈고리)\n\n두 열쇠를 꽂고 돌린다.';
    T(this, rx, ty, right, 16, '#2b2418', ink);
    this.addClue('m_notes', '해부 실습 노트 — 위팔두갈래근 두 갈래의 이는곳');
  }

  buildLocker() {
    this.frame('표본 보관함 S-B2', '열쇠를 끌어 알맞은 열쇠구멍에 꽂고, 꽂은 열쇠를 눌러 돌리세요.', C.pink);
    const { cTop, cBot } = this;
    const adv = this.adv;
    const ch = cBot - cTop;
    const bxL = this.px + 30, bw = this.pw * 0.62;
    this.add.nineslice(bxL + bw / 2, cTop + ch / 2, 'inv_jbox', undefined, bw, ch, 48, 48, 48, 48);
    // skeleton plate behind the glass: right shoulder & arm (anterior)
    const W: Win = adv ? { x: 255, y: 120, w: 240, h: 340 } : { x: 290, y: 120, w: 200, h: 150 };
    const f = this.fitWin(W, bxL + 40, cTop + 30, bw - 80, ch - 60);
    const pm = plateManifest(this);
    this.plateLayer('ch2_plate_bones', { x: 0, y: 0, w: pm.frame[0], h: pm.frame[1] }, W, f.bx, f.by, f.q);
    const gl = this.add.graphics(); gl.fillStyle(0x9fd8ff, 0.06); gl.fillRect(f.bx, f.by, W.w * f.q, W.h * f.q); gl.lineStyle(2, 0x9fd8ff, 0.4); gl.strokeRect(f.bx, f.by, W.w * f.q, W.h * f.q);
    const holes: AttId[] = adv ? ['supraglenoid', 'coracoid', 'infraglenoid', 'greater', 'humMed', 'deltTub'] : ['supraglenoid', 'coracoid', 'infraglenoid', 'greater'];
    // each keyhole sits a little away from its landmark (a leader line points at the structure) so neighbours don't overlap
    const OFF: Partial<Record<AttId, [number, number]>> = { supraglenoid: [-50, -38], coracoid: [56, -30], infraglenoid: [-58, 30], greater: [-62, -6], humMed: [60, 10], deltTub: [-60, 0] };
    const hp: Record<string, { x: number; y: number }> = {};
    const lg = this.add.graphics();
    for (const a of holes) {
      const p = this.P(a, W, f), o = OFF[a] ?? [0, -40];
      const h = { x: p.x + o[0], y: p.y + o[1] }; hp[a] = h;
      lg.lineStyle(2.5, 0xc9a64b, 0.9); lg.lineBetween(p.x, p.y, h.x, h.y); lg.fillStyle(0xffd34d, 1); lg.fillCircle(p.x, p.y, 4);
      this.add.image(h.x, h.y, 'inv_keyhole').setDisplaySize(46, 46);
    }
    (this as unknown as { __holes: unknown }).__holes = hp;   // read by the automated tests
    // keys (in the tray on the right)
    const { rx, rw } = this.rightCol();
    T(this, rx, cTop + 4, '열쇠', 19, C.pinkS, { weight: '700' });
    const want: Record<string, AttId> = { long: 'supraglenoid', short: 'coracoid', ...(adv ? { cb: 'humMed' } : {}) };
    const label: Record<string, string> = { long: '위팔두갈래근 · 긴갈래', short: '위팔두갈래근 · 짧은갈래', cb: '부리위팔근 · 닿는곳' };
    const bicepsDone = this.got.includes('biceps');
    const keys = bicepsDone ? (adv && !this.got.includes('coracobrachialis') ? ['cb'] : []) : ['long', 'short'];
    if (!keys.length) { this.setFeedback('보관함은 비어 있습니다. 코어는 이미 회수했습니다.', 'info'); return; }
    const placed: Record<string, AttId | null> = {}; const turned: Record<string, boolean> = {};
    keys.forEach((kid, i) => {
      const home = { x: rx + rw / 2, y: cTop + 80 + i * 110 };
      T(this, home.x, home.y + 30, label[kid], 16, '#ffd8e2', { weight: '700' }).setOrigin(0.5, 0);
      const key = this.add.image(home.x, home.y, 'inv_key').setDisplaySize(150, 52).setInteractive({ useHandCursor: true, draggable: true }).setDepth(10);
      placed[kid] = null; turned[kid] = false;
      key.on('drag', (_p: Phaser.Input.Pointer, x: number, y: number) => { if (!placed[kid]) key.setPosition(x, y); });
      key.on('dragend', () => {
        if (placed[kid]) return;
        // the bit (right end of the key) goes into the hole
        const tip = { x: key.x + 60, y: key.y };
        const hit = holes.find(a => Math.hypot(hp[a].x - tip.x, hp[a].y - tip.y) < 40 || Math.hypot(hp[a].x - key.x, hp[a].y - key.y) < 40);
        if (!hit) { this.tweens.add({ targets: key, x: home.x, y: home.y, duration: 220 }); return; }
        if (Object.values(placed).includes(hit)) { this.tweens.add({ targets: key, x: home.x, y: home.y, duration: 220 }); return; }
        if (hit !== want[kid]) {
          G.run.mistakes++; Audio.play('error'); this.cameras.main.shake(120, 0.003);
          this.setFeedback(this.adv ? '열쇠가 들어가지 않는다. 다른 구멍이다.' : `열쇠가 들어가지 않는다. 그곳은 ${ATT[hit].ko}. 노트를 다시 확인하세요.`, 'err');
          this.tweens.add({ targets: key, x: home.x, y: home.y, duration: 260 }); return;
        }
        placed[kid] = hit; Audio.play('snap');
        this.tweens.add({ targets: key, x: hp[hit].x - 60, y: hp[hit].y, duration: 160 });
        this.setFeedback('딸깍— 열쇠가 끝까지 들어갔다. 열쇠를 눌러 돌리세요.', 'ok');
      });
      key.on('pointerup', (p: Phaser.Input.Pointer) => {
        if (!placed[kid] || turned[kid] || p.getDistance() > 10) return;
        turned[kid] = true; Audio.play('unlock');
        this.tweens.add({ targets: key, scaleY: key.scaleY * 0.35, duration: 220, ease: 'Sine.inOut' });
        if (keys.every(q => turned[q])) this.time.delayedCall(450, () => this.unlockLocker(keys.includes('cb') ? 'coracobrachialis' : 'biceps'));
        else this.setFeedback('한 열쇠를 돌렸다. 나머지 열쇠도 돌려야 열린다.', 'info');
      });
    });
    this.setFeedback(this.has('m_notes') ? '노트에 적힌 곳에 열쇠를 꽂으세요. 금빛 점이 열쇠구멍이 가리키는 구조입니다.' : '어느 구멍에 꽂아야 할까? 같은 방의 해부 실습 노트에 단서가 있을지도.', 'info');
  }
  unlockLocker(id: MuscleId) {
    Audio.play('door'); this.cameras.main.flash(160, 255, 140, 170);
    this.setFeedback(id === 'biceps' ? '보관함이 열렸다! 안쪽 칸의 코어를 누르세요.' : '안쪽 서랍이 열렸다! 코어를 누르세요.', 'ok');
    this.coreButton(id);
  }
  /** a glowing data core in the open compartment (right column): tap to take */
  coreButton(id: MuscleId) {
    const { rx, rw } = this.rightCol(), { cTop, cBot } = this;
    const c = this.add.container(rx + rw / 2, (cTop + cBot) / 2 + 40).setDepth(40);
    const g = this.add.graphics(); g.fillStyle(0x1a0a12, 1); g.fillRoundedRect(-rw / 2, -110, rw, 220, 14); g.lineStyle(2, 0xff7ad9, 0.9); g.strokeRoundedRect(-rw / 2, -110, rw, 220, 14); c.add(g);
    const im = this.add.image(0, -10, `mus_real_${id}`); im.setScale(Math.min((rw - 40) / im.width, 170 / im.height)); c.add(im);
    c.add(T(this, 0, 94, '코어를 눌러 회수', 15, '#ffd8e2', { weight: '700' }).setOrigin(0.5));
    c.setSize(rw, 220).setInteractive({ useHandCursor: true }); c.setScale(0.6).setAlpha(0);
    this.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 260, ease: 'Back.out' });
    c.once('pointerup', () => { Audio.play('pickup'); this.foundCore(id); });
    this.flushInput();
  }

  // ================================================================== deltoid
  buildChart() {
    this.frame('어깨 움직임 차트 · M-01', '벽에 붙은 교육용 차트입니다.', C.pink);
    const { cTop, cBot } = this;
    const W: Win = { x: 215, y: 95, w: 300, h: 340 };
    const maxW = this.pw * 0.6;
    const f = this.fitWin(W, this.px + 40, cTop + 18, maxW - 20, cBot - cTop - 36);
    const pm = plateManifest(this);
    const bg = this.add.graphics(); bg.fillStyle(0xe9e4d6, 1); bg.fillRect(f.bx - 14, f.by - 14, W.w * f.q + 28, W.h * f.q + 28); bg.fillStyle(0x0d1a2a, 1); bg.fillRect(f.bx, f.by, W.w * f.q, W.h * f.q);
    this.plateLayer('ch2_plate_bones', { x: 0, y: 0, w: pm.frame[0], h: pm.frame[1] }, W, f.bx, f.by, f.q);
    const d = this.plateLayer('mus_real_deltoid', pm.layers.deltoid, W, f.bx, f.by, f.q); d?.setAlpha(0.92);
    this.add.nineslice(f.bx + W.w * f.q / 2, f.by + W.h * f.q / 2, 'inv_poster_frame', undefined, W.w * f.q + 40, W.h * f.q + 40, 30, 30, 30, 30);
    const col: Record<Fibre, number> = { A: 0xffb04d, M: 0x5fd2ff, P: 0xc78bff };
    const at: Record<Fibre, AttId> = { A: 'clavLat', M: 'acromion', P: 'spine' };
    const off: Record<Fibre, [number, number]> = { A: [60, -40], M: [-70, -40], P: [70, 30] };
    const g = this.add.graphics();
    (['A', 'M', 'P'] as Fibre[]).forEach(fb => {
      const p = this.P(at[fb], W, f), bx = p.x + off[fb][0], by = p.y + off[fb][1];
      g.lineStyle(3, col[fb], 1); g.lineBetween(p.x, p.y, bx, by); g.fillStyle(col[fb], 1); g.fillCircle(p.x, p.y, 6);
      const t = T(this, bx, by, this.adv ? `${FIBRE_KO[fb]}\n${FIBRE_ORIGIN[fb]}` : `${FIBRE_KO[fb]} → ${MOVE_KO[FIBRE_MOVE[fb]]}\n${FIBRE_ORIGIN[fb]}`, 15, '#ffffff', { weight: '800', align: 'center', backgroundColor: '#0b1018dd', padding: { x: 6, y: 3 } }).setOrigin(0.5);
      t.setStroke('#' + col[fb].toString(16).padStart(6, '0'), 1);
    });
    const { rx, rw } = this.rightCol();
    T(this, rx, cTop + 8, '어깨세모근 · Deltoid', 19, C.pinkS, { weight: '700' });
    T(this, rx, cTop + 42, this.adv ? '세 부분의 섬유가 각각 다른 곳에서 일어나 위팔뼈 가쪽(어깨세모근거친면)에 함께 닿는다. 뒤섬유는 앞에서 보이지 않는 뒤쪽(어깨뼈가시)에 있다.'
      : '세 부분의 섬유가 각각 다른 곳에서 일어나 위팔뼈 가쪽(어깨세모근거친면)에 함께 닿는다.\n\n· 앞섬유 → 굽힘 (팔을 앞으로)\n· 중간섬유 → 벌림 (옆으로)\n· 뒤섬유 → 폄 (뒤로)', 16, '#d3def3', { wordWrap: { width: rw }, lineSpacing: 6 });
    this.addClue('m_chart', '어깨 움직임 차트 — 어깨세모근 세 섬유');
  }

  buildLightbox() {
    this.frame('표본 라이트박스 S-D1', '명판의 섬유 순서대로, 그 섬유가 일으키는 움직임 버튼을 누르세요.', C.pink);
    if (this.got.includes('deltoid')) { this.setFeedback('라이트박스 서랍은 비어 있습니다.', 'info'); return; }
    const { cTop, cBot } = this, ch = cBot - cTop;
    const bxL = this.px + 30, bw = this.pw * 0.5;
    // light box with the deltoid specimen
    const lb = this.add.graphics(); lb.fillStyle(0xdfefff, 1); lb.fillRoundedRect(bxL, cTop, bw, ch, 12); lb.fillStyle(0xffffff, 0.6); lb.fillRoundedRect(bxL + 14, cTop + 14, bw - 28, ch - 28, 8);
    const W: Win = { x: 215, y: 95, w: 300, h: 340 };
    const f = this.fitWin(W, bxL + 20, cTop + 20, bw - 40, ch - 40);
    const pm = plateManifest(this);
    this.plateLayer('ch2_plate_bones', { x: 0, y: 0, w: pm.frame[0], h: pm.frame[1] }, W, f.bx, f.by, f.q)?.setAlpha(0.55);
    this.plateLayer('mus_real_deltoid', pm.layers.deltoid, W, f.bx, f.by, f.q);
    this.add.nineslice(bxL + bw / 2, cTop + ch / 2, 'inv_jbox', undefined, bw, ch, 48, 48, 48, 48).setAlpha(0.35);
    // brass plate: the fibre order
    const seq = deltSeq();
    const rx = bxL + bw + 24, rw = this.px + this.pw - 30 - rx;
    const pH = Math.min(150, ch * 0.32);
    this.add.nineslice(rx + rw / 2, cTop + pH / 2, 'inv_brass', undefined, rw, pH, 24, 24, 24, 24);
    T(this, rx + rw / 2, cTop + 22, 'S-D1 개방 순서', 16, '#2a1d05', { ink: true, weight: '900' }).setOrigin(0.5, 0);
    T(this, rx + rw / 2, cTop + 52, seq.map(s => FIBRE_KO[s]).join('  →  '), 19, '#2a1d05', { ink: true, weight: '900', wordWrap: { width: rw - 30 }, align: 'center' }).setOrigin(0.5, 0);
    // lamps (progress) + three movement buttons
    const lamps = this.add.graphics();
    let pressed: Move[] = [];
    const drawLamps = (bad = false) => { lamps.clear(); for (let i = 0; i < seq.length; i++) { const x = rx + rw / 2 + (i - (seq.length - 1) / 2) * 34, y = cTop + pH + 26; lamps.fillStyle(bad ? 0xff3d5a : i < pressed.length ? 0x7fffb2 : 0x2a313d, 1); lamps.fillCircle(x, y, 10); lamps.lineStyle(2, 0x0b1018, 1); lamps.strokeCircle(x, y, 10); } };
    drawLamps();
    const moves: Move[] = ['flex', 'abd', 'ext'];
    const bTop = cTop + pH + 56, bH = cBot - bTop, bs = Math.min(92, bH * 0.5, (rw - 40) / 3);
    const tint: Record<Move, number> = { flex: 0xffb04d, abd: 0x5fd2ff, ext: 0xc78bff };
    moves.forEach((mv, i) => {
      const x = rx + rw / 2 + (i - 1) * (rw / 3), y = bTop + bs / 2 + 6;
      const b = this.add.image(x, y, 'inv_button').setDisplaySize(bs, bs).setTint(tint[mv]).setInteractive({ useHandCursor: true });
      T(this, x, y + bs / 2 + 8, MOVE_KO[mv], 18, '#ffffff', { weight: '800' }).setOrigin(0.5, 0);
      T(this, x, y + bs / 2 + 32, MOVE_DESC[mv], 13, '#9fb3d1', { fine: true, wordWrap: { width: rw / 3 - 6 }, align: 'center' }).setOrigin(0.5, 0);
      b.on('pointerdown', () => b.setDisplaySize(bs * 0.92, bs * 0.92));
      b.on('pointerout', () => b.setDisplaySize(bs, bs));
      b.on('pointerup', () => {
        b.setDisplaySize(bs, bs); Audio.play('click');
        pressed.push(mv); drawLamps();
        if (pressed.length < seq.length) return;
        const ok = seq.every((s, k) => FIBRE_MOVE[s] === pressed[k]);
        if (ok) {
          Audio.play('unlock'); this.setFeedback('철컥— 라이트박스 아래 서랍이 열렸다!', 'ok');
          this.time.delayedCall(400, () => this.coreButtonAt('deltoid', bxL + bw / 2, cBot - 120));
        } else {
          const bad = seq.findIndex((s, k) => FIBRE_MOVE[s] !== pressed[k]);
          G.run.mistakes++; Audio.play('error'); drawLamps(true);
          this.setFeedback(this.adv ? '삐— 순서가 맞지 않는다. 처음부터 다시.' : `삐— ${bad + 1}번째(${FIBRE_KO[seq[bad]]})가 틀렸다. ${FIBRE_KO[seq[bad]]}가 하는 움직임은? 처음부터 다시.`, 'err');
          this.time.delayedCall(700, () => { pressed = []; drawLamps(); });
        }
      });
    });
    this.setFeedback(this.has('m_chart') ? '차트에서 본 각 섬유의 움직임을 떠올리세요.' : '섬유마다 어떤 움직임을 일으키는지 알아야 한다. 근육 연결실 벽에 차트가 있었던가?', 'info');
  }
  coreButtonAt(id: MuscleId, x: number, y: number) {
    const c = this.add.container(x, y).setDepth(40);
    const g = this.add.graphics(); g.fillStyle(0x1a0a12, 0.96); g.fillRoundedRect(-150, -90, 300, 180, 14); g.lineStyle(2, 0xff7ad9, 0.9); g.strokeRoundedRect(-150, -90, 300, 180, 14); c.add(g);
    const im = this.add.image(0, -12, `mus_real_${id}`); im.setScale(Math.min(260 / im.width, 130 / im.height)); c.add(im);
    c.add(T(this, 0, 70, '코어를 눌러 회수', 15, '#ffd8e2', { weight: '700' }).setOrigin(0.5));
    c.setSize(300, 180).setInteractive({ useHandCursor: true }); c.setAlpha(0); c.y += 40;
    this.tweens.add({ targets: c, alpha: 1, y: y, duration: 320, ease: 'Cubic.out' });
    c.once('pointerup', () => { Audio.play('pickup'); this.foundCore(id); });
    this.flushInput();
  }

  // ================================================================== brachialis
  buildMemo() {
    this.frame('메모 · M-01 수술 트롤리', '트롤리에 붙어 있던 메모입니다.', C.pink);
    const { cTop, cBot } = this;
    const w = Math.min(560, this.pw - 80), h = Math.min(360, cBot - cTop - 20);
    const x = this.px + this.pw / 2 - w / 2, y = cTop + (cBot - cTop - h) / 2;
    const n = this.add.image(x + w / 2, y + h / 2, 'inv_paper').setDisplaySize(w, h).setAngle(-2).setScale(0.01);
    this.tweens.add({ targets: n, scaleX: w / n.width, scaleY: h / n.height, duration: 260, ease: 'Back.out' });
    T(this, x + 30, y + 30, this.adv ? 'S-BL 위팔근 코어\n\n겉층 근육 아래에 숨김.\n잠금 단추 = 위팔근의 닿는곳.\n\n— K' : 'S-BL 위팔근 코어\n\n위팔두갈래근 아래(깊은 층)에 숨겼다.\n해부대에서 겉층을 걷어 낼 것.\n\n잠금 단추 = 위팔근이 닿는 곳\n→ 아래팔 안쪽 뼈(자뼈)의 거친면\n\n— K', 19, '#2b2418', { ink: true, weight: '700', lineSpacing: 6, wordWrap: { width: w - 60 } }).setAngle(-2);
    this.addClue('m_memo', '메모 — 위팔근 코어는 깊은 층, 잠금 단추는 닿는곳');
  }

  buildDissect() {
    this.frame('해부대 · 위팔 앞칸', '겉층 근육을 옆으로 끌어 걷어 내고, 아래층을 관찰하세요.', C.pink);
    if (this.got.includes('brachialis')) { this.setFeedback('해부대의 숨은 칸은 비어 있습니다.', 'info'); return; }
    const { cTop, cBot } = this, ch = cBot - cTop;
    const bxL = this.px + 30, bw = this.pw * 0.62;
    this.add.image(bxL + bw / 2, cTop + ch / 2, 'inv_bench').setDisplaySize(bw, ch).setAlpha(0.9);
    const shade = this.add.graphics(); shade.fillStyle(0x0b1018, 0.86); shade.fillRoundedRect(bxL + 20, cTop + 16, bw - 40, ch - 32, 10); shade.lineStyle(2, 0x9aa3ad, 0.5); shade.strokeRoundedRect(bxL + 20, cTop + 16, bw - 40, ch - 32, 10);
    const W: Win = { x: 200, y: 300, w: 220, h: 480 };
    const f = this.fitWin(W, bxL + 30, cTop + 24, bw - 60, ch - 48);
    const pm = plateManifest(this);
    this.plateLayer('ch2_plate_bones', { x: 0, y: 0, w: pm.frame[0], h: pm.frame[1] }, W, f.bx, f.by, f.q);
    this.plateLayer('mus_real_brachialis', pm.layers.brachialis, W, f.bx, f.by, f.q);
    const bic = this.plateLayer('mus_real_biceps', pm.layers.biceps, W, f.bx, f.by, f.q)!;
    bic.setInteractive({ useHandCursor: true, draggable: true });
    const home = { x: bic.x, y: bic.y };
    let peeled = false;
    const peel = () => {
      if (peeled) return; peeled = true; Audio.play('open');
      bic.disableInteractive();
      this.tweens.add({ targets: bic, x: home.x + W.w * f.q * 0.75, angle: 12, alpha: 0.35, duration: 450, ease: 'Cubic.out' });
      this.setFeedback(this.adv ? '아래층 근육이 드러났다. 잠금 단추 중 하나를 누르세요.' : '위팔두갈래근 아래에서 위팔근이 드러났다. 위팔근이 닿는 곳의 단추를 누르세요.', 'ok');
      showButtons();
    };
    bic.on('drag', (_p: Phaser.Input.Pointer, x: number) => { if (!peeled) { bic.x = Math.max(home.x, x); if (bic.x - home.x > 60) peel(); } });
    bic.on('dragend', () => { if (!peeled) this.tweens.add({ targets: bic, x: home.x, duration: 200 }); });
    bic.on('pointerup', (p: Phaser.Input.Pointer) => { if (!peeled && p.getDistance() < 8) this.setFeedback('위팔두갈래근(겉층)을 잡고 옆으로 끌어 걷어 내세요.', 'info'); });
    const cand: AttId[] = this.adv ? ['ulnTub', 'radTub', 'medEpi', 'deltTub', 'humAnt'] : ['ulnTub', 'radTub', 'medEpi', 'deltTub'];
    const OFF: Partial<Record<AttId, [number, number]>> = { ulnTub: [60, 22], radTub: [-62, 26], medEpi: [62, -18], deltTub: [-62, 0], humAnt: [66, 0] };
    const pos: Record<string, { x: number; y: number }> = {};
    const showButtons = () => {
      const g = this.add.graphics().setDepth(20);
      cand.forEach(a => {
        const p = this.P(a, W, f), o = OFF[a]!, b = { x: p.x + o[0], y: p.y + o[1] }; pos[a] = b;
        g.lineStyle(2.5, 0xffd34d, 0.95); g.lineBetween(p.x, p.y, b.x, b.y); g.fillStyle(0xffd34d, 1); g.fillCircle(p.x, p.y, 4);
        const btn = this.add.image(b.x, b.y, 'inv_button').setDisplaySize(44, 44).setTint(0xff9fb0).setDepth(21).setInteractive({ useHandCursor: true });
        btn.on('pointerup', () => {
          Audio.play('click');
          if (a === 'ulnTub') { Audio.play('unlock'); this.setFeedback('철컥— 해부대 옆의 숨은 칸이 열렸다!', 'ok'); this.time.delayedCall(350, () => this.coreButton('brachialis')); }
          else { G.run.mistakes++; Audio.play('error'); this.setFeedback(this.adv ? '삐— 그곳이 아니다.' : `삐— 그곳은 ${ATT[a].ko}. ${a === 'radTub' ? '노뼈거친면에는 위팔두갈래근이 닿는다. 위팔근은 바로 옆 다른 뼈에 닿는다.' : '위팔근이 닿는 곳이 아니다.'}`, 'err'); }
        });
      });
      (this as unknown as { __btns: unknown }).__btns = pos;
      this.flushInput();
    };
    const { rx, rw } = this.rightCol();
    T(this, rx, cTop + 8, '해부대', 19, C.pinkS, { weight: '700' });
    T(this, rx, cTop + 42, '오른쪽 위팔을 앞에서 본 표본. 겉에 보이는 근육은 위팔두갈래근이다.\n\n그 아래에 무엇이 있을까?', 16, '#d3def3', { wordWrap: { width: rw }, lineSpacing: 6 });
    this.setFeedback(this.has('m_memo') ? '메모대로 겉층을 걷어 내세요.' : '이 해부대에 무언가 숨겨져 있다고 한다. 근처에 메모가 있었던가?', 'info');
  }

  // ================================================================== triceps (+ brachioradialis)
  buildManual() {
    this.frame('팔꿈치 모형 정비 매뉴얼 · M-04', '단말기 옆에 꽂혀 있던 정비 매뉴얼입니다.', C.pink);
    const { cTop, cBot } = this;
    const w = Math.min(640, this.pw - 80), h = Math.min(420, cBot - cTop - 10);
    const x = this.px + this.pw / 2 - w / 2, y = cTop + (cBot - cTop - h) / 2;
    const m = this.add.image(x + w / 2, y + h / 2, 'inv_paper').setDisplaySize(w, h);
    m.setScale(m.scaleX, 0.02); this.tweens.add({ targets: m, scaleY: h / m.height, duration: 280, ease: 'Back.out' });
    const head = this.add.graphics(); head.fillStyle(0x2f6fb0, 1); head.fillRect(x, y, w, 44);
    T(this, x + 18, y + 22, 'ELBOW RIG · 코어 고정핀 해제 절차', 18, '#ffffff', { weight: '800' }).setOrigin(0, 0.5);
    const body = this.adv
      ? 'S-T3: 팔꿈치를 완전히 편 상태에서, 팔꿈치를 펴는 근육의 닿는곳에 케이블을 건다.\n\nS-BR6(심화): 팔꿈치를 90° 굽힌 상태에서, 중립 자세(엄지가 위)에서 가장 강한 굽힘근의 닿는곳에 케이블을 건다.'
      : 'S-T3 위팔세갈래근 코어\n\n① 모형의 손(아래팔 끝)을 끌어 팔꿈치를 완전히 편다 (0°).\n② 케이블 고리를 팔꿈치를 펴는 근육(위팔세갈래근)의 닿는곳에 건다 → 팔꿈치 뒤쪽 끝, 팔꿈치머리.\n③ 고정핀이 빠지면 코어를 꺼낸다.';
    T(this, x + 24, y + 64, body, 17, '#2b2418', { ink: true, weight: '600', wordWrap: { width: w - 48 }, lineSpacing: 6 });
    this.addClue('m_manual', '팔꿈치 모형 매뉴얼 — 펴기 + 펴는 근육의 닿는곳');
  }

  buildRig() {
    this.frame('팔꿈치 운동 모형 · M-04', '손을 끌어 팔꿈치 각도를 바꾸고, 케이블 고리를 알맞은 고리에 거세요.', C.pink);
    const tDone = this.got.includes('triceps'), brDone = this.got.includes('brachioradialis');
    const stage: 'triceps' | 'brachioradialis' | null = !tDone ? 'triceps' : this.adv && !brDone ? 'brachioradialis' : null;
    if (!stage) { this.setFeedback('모형의 코어 칸은 모두 비어 있습니다.', 'info'); return; }
    const meta = this.cache.json.get('mo_elbow') as MoMeta | undefined;
    if (!meta) { this.setFeedback('모형 데이터를 불러오지 못했습니다. 나갔다가 다시 들어오세요.', 'err'); return; }
    const { cTop, cBot } = this, ch = cBot - cTop;
    const bxL = this.px + 30, bw = this.pw * 0.58;
    this.add.nineslice(bxL + bw / 2, cTop + ch / 2, 'inv_jbox', undefined, bw, ch, 48, 48, 48, 48);
    const sc = Math.min((bw - 60) / meta.size[0], (ch - 40) / meta.size[1]);
    const ox = bxL + (bw - meta.size[0] * sc) / 2, oy = cTop + (ch - meta.size[1] * sc) / 2;
    const S = (p: number[]) => ({ x: ox + p[0] * sc, y: oy + p[1] * sc });
    const img = this.add.image(ox, oy, 'mo_elbow_b9').setOrigin(0).setScale(sc / 2);
    let angle = stage === 'triceps' ? 90 : 0;
    const fi = () => Phaser.Math.Clamp(Math.round(angle / 10), 0, meta.frames.length - 1);
    const pivot = S(meta.frames[0].pivot);
    const handAng = (fr: MoFrame) => { const h = S(fr.handle); return Phaser.Math.RadToDeg(Math.atan2(h.x - pivot.x, h.y - pivot.y)); };
    const ha = meta.frames.map(handAng);
    const g = this.add.graphics().setDepth(5);
    const readout = T(this, bxL + bw - 24, cTop + 20, '', 22, '#ffe07a', { weight: '900' }).setOrigin(1, 0).setDepth(6);
    const ringIds: MuscleId[] = ['triceps', 'biceps', 'brachialis', 'brachioradialis'];
    const ringAt = (m: MuscleId) => { const fr = meta.frames[fi()]; const p = fr.paths.find(q => q.m === m); return p ? S(p.pts[p.pts.length - 1]) : null; };
    const OFF: Record<string, [number, number]> = { triceps: [-46, -10], biceps: [44, -24], brachialis: [46, 14], brachioradialis: [40, 20] };
    const ringPos = (m: MuscleId) => { const p = ringAt(m); if (!p) return null; const o = OFF[m]; return { lm: p, x: p.x + o[0], y: p.y + o[1] }; };
    let hooked: MuscleId | null = null;
    const winch = { x: bxL + 60, y: cTop + 50 };
    const draw = () => {
      img.setTexture(`mo_elbow_b${fi()}`);
      g.clear();
      for (const m of ringIds) {
        const r = ringPos(m); if (!r) continue;
        g.lineStyle(2, 0xc9a64b, 0.9); g.lineBetween(r.lm.x, r.lm.y, r.x, r.y); g.fillStyle(0xffd34d, 1); g.fillCircle(r.lm.x, r.lm.y, 3.5);
        g.lineStyle(5, hooked === m ? 0x7fffb2 : 0xd9dee6, 1); g.strokeCircle(r.x, r.y, 12); g.lineStyle(2, 0x2a313d, 1); g.strokeCircle(r.x, r.y, 15);
      }
      // cable from the winch to the hook
      const h = hook;
      g.lineStyle(4, 0x1b1f26, 1); g.lineBetween(winch.x, winch.y, h.x, h.y); g.lineStyle(2, 0xc9ced8, 1); g.lineBetween(winch.x, winch.y, h.x, h.y);
      g.fillStyle(0x3a4352, 1); g.fillCircle(winch.x, winch.y, 16); g.lineStyle(3, 0x9aa3ad, 1); g.strokeCircle(winch.x, winch.y, 16);
      const H = S(meta.frames[fi()].handle);
      g.fillStyle(0xffe07a, 0.25); g.fillCircle(H.x, H.y, 30); g.lineStyle(3, 0xffe07a, 0.9); g.strokeCircle(H.x, H.y, 24);
      readout.setText(`팔꿈치 ${angle}°`);
      handZone.setPosition(H.x - 40, H.y - 40);
      if (hooked) { const r = ringPos(hooked); if (r) hook.setPosition(r.x, r.y); }
    };
    // hand handle: drag around the elbow pivot
    const handZone = this.add.zone(0, 0, 80, 80).setOrigin(0).setInteractive({ useHandCursor: true, draggable: true }).setDepth(8);
    handZone.on('drag', (p: Phaser.Input.Pointer) => {
      if (hooked) return;
      const fa = Phaser.Math.RadToDeg(Math.atan2(p.worldX - pivot.x, p.worldY - pivot.y));
      let a = 0;
      if (fa <= ha[0]) a = 0; else if (fa >= ha[ha.length - 1]) a = meta.angles[meta.angles.length - 1];
      else for (let k = 0; k < ha.length - 1; k++) if (fa >= ha[k] && fa <= ha[k + 1]) { a = meta.angles[k] + (meta.angles[k + 1] - meta.angles[k]) * (fa - ha[k]) / Math.max(1e-6, ha[k + 1] - ha[k]); break; }
      const na = Math.round(Phaser.Math.Clamp(a, 0, 140) / 10) * 10;
      if (na !== angle) { angle = na; Audio.play('hold'); draw(); }
    });
    // cable hook (drag onto a ring)
    const hook = this.add.image(winch.x + 70, winch.y + 40, 'inv_plug').setDisplaySize(36, 36).setDepth(9).setInteractive({ useHandCursor: true, draggable: true });
    const hookHome = { x: hook.x, y: hook.y };
    hook.on('drag', (_p: Phaser.Input.Pointer, x: number, y: number) => { if (!hooked) { hook.setPosition(x, y); draw(); } });
    hook.on('dragend', () => {
      if (hooked) return;
      const hit = ringIds.find(m => { const r = ringPos(m); return r && Math.hypot(r.x - hook.x, r.y - hook.y) < 30; });
      if (!hit) { this.tweens.add({ targets: hook, x: hookHome.x, y: hookHome.y, duration: 220, onUpdate: draw }); return; }
      const needAngle = stage === 'triceps' ? angle <= 0 : angle >= 80 && angle <= 100;
      if (hit === stage && needAngle) {
        hooked = hit; Audio.play('snap'); draw();
        this.time.delayedCall(300, () => { Audio.play('unlock'); this.cameras.main.flash(160, 255, 140, 170); this.setFeedback('고정핀이 빠졌다! 코어를 꺼내세요.', 'ok'); this.coreButton(stage); });
        return;
      }
      G.run.mistakes++; Audio.play('error');
      const msg = hit !== stage
        ? (this.adv ? '케이블이 미끄러진다. 고정핀이 움직이지 않는다.' : `케이블이 미끄러진다. 그 고리는 ${MUSCLES[hit].ko}의 닿는곳이다.`)
        : (stage === 'triceps' ? '고리는 맞는데 팔꿈치가 아직 굽혀져 있다. 완전히 펴야(0°) 핀이 빠진다.' : '고리는 맞는데 각도가 다르다. 팔꿈치를 90°로 굽혀야 한다.');
      this.setFeedback(msg, 'err');
      this.tweens.add({ targets: hook, x: hookHome.x, y: hookHome.y, duration: 260, onUpdate: draw });
    });
    (this as unknown as { __rig: unknown }).__rig = { ringPos, setAngleForTest: (a: number) => { angle = a; draw(); }, hand: () => S(meta.frames[fi()].handle), handAt: (a: number) => S(meta.frames[Math.round(a / 10)].handle), pivot, get angle() { return angle; } };
    draw();
    const { rx, rw } = this.rightCol();
    T(this, rx + 30, cTop + 8, stage === 'triceps' ? '코어 S-T3' : '코어 S-BR6 (심화)', 19, C.pinkS, { weight: '700' });
    T(this, rx + 30, cTop + 42, '오른팔 팔꿈치 모형(뼈는 실제 3D 모델). 노란 원 = 손 손잡이, 은색 고리 = 근육이 닿는 곳의 케이블 고리.', 16, '#d3def3', { wordWrap: { width: rw - 30 }, lineSpacing: 6 });
    this.setFeedback(this.has('m_manual') ? (stage === 'triceps' ? '매뉴얼: 팔꿈치를 완전히 펴고, 펴는 근육의 닿는곳에 케이블.' : '매뉴얼: 90°로 굽히고, 중립 자세 굽힘근의 닿는곳에 케이블.') : '고정핀을 푸는 방법을 모른다. 이 방 어딘가에 정비 매뉴얼이 있을 것이다.', 'info');
  }

  // ================================================================== notebook + hints
  notebookVisual(_o: Overlay, _x: number, _y: number, _w: number, _h: number) { return false; }

  hints() {
    const H: string[] = [], adv = this.adv;
    switch (this.kind) {
      case 'locker2':
        if (!this.has('m_notes')) H.push('같은 방(M-02) 책상의 해부 실습 노트를 먼저 읽으세요.');
        H.push('열쇠의 끝(톱니)을 금빛 점이 가리키는 열쇠구멍에 끌어다 놓으세요. 꽂은 뒤 열쇠를 누르면 돌아갑니다.');
        H.push('관절위결절 = 관절오목 바로 위(위쪽), 부리돌기 = 그 안쪽 앞으로 튀어나온 갈고리. 관절아래결절은 위팔세갈래근 긴갈래 자리입니다.');
        if (adv) H.push('부리위팔근은 위팔뼈 몸통 안쪽 중간에 닿습니다.');
        else H.push('긴갈래 열쇠 → 관절오목 위쪽 구멍, 짧은갈래 열쇠 → 그 옆 앞쪽 갈고리 구멍.');
        break;
      case 'lightbox':
        if (!this.has('m_chart')) H.push('근육 연결실(M-01) 벽의 어깨 움직임 차트를 보세요.');
        H.push('앞섬유 = 굽힘(앞으로 들기), 중간섬유 = 벌림(옆으로 들기), 뒤섬유 = 폄(뒤로 젖히기).');
        if (!adv) H.push(`이번 명판: ${deltSeq().map(s => `${FIBRE_KO[s]}→${MOVE_KO[FIBRE_MOVE[s]]}`).join(', ')}.`);
        break;
      case 'dissect':
        if (!this.has('m_memo')) H.push('근육 연결실의 수술 트롤리에 붙은 메모를 읽으세요.');
        H.push('위팔두갈래근을 잡고 오른쪽으로 끌어 걷어 내세요.');
        H.push('위팔두갈래근은 노뼈거친면, 위팔근은 그 옆 자뼈거친면(갈고리돌기 아래)에 닿습니다.');
        break;
      case 'rig':
        if (!this.has('m_manual')) H.push('M-04 단말기 옆의 정비 매뉴얼을 읽으세요.');
        H.push('노란 원(손)을 끌어 각도를 바꿉니다. 팔꿈치를 완전히 펴면 0°.');
        H.push(this.got.includes('triceps') ? '위팔노근: 위팔뼈 가쪽에서 내려와 노뼈 아래 끝(붓돌기 쪽)에 닿습니다. 90°로 굽힌 뒤 그 고리에.' : '위팔세갈래근은 팔꿈치 뒤쪽 끝(팔꿈치머리)에 닿습니다. 팔꿈치 쪽, 뼈 뒤쪽 고리입니다.');
        break;
      default:
        H.push('필요한 단서를 다 읽었다면 해당 장치로 가세요.');
    }
    return H;
  }
}

