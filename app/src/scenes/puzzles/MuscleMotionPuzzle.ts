import Phaser from 'phaser';
import { PuzzleBase } from './PuzzleBase';
import { View } from '../../core/view';
import { Audio } from '../../core/audio';
import { G } from '../../game/state';
import { MUSCLES, MuscleId, MOTION_ROUNDS, MotionRound, Role } from '../../data/muscles';
import { spindle, smoothLine, Pt } from '../../art/muscles';
import { T, C, Button } from '../../ui/widgets';

interface Row { id: MuscleId; role: Role | null; segs: { role: Role; g: Phaser.GameObjects.Graphics; t: Phaser.GameObjects.Text; x: number; y: number; w: number; h: number }[]; name: Phaser.GameObjects.Text; mark: Phaser.GameObjects.Graphics }
type V = { x: number; y: number };

const ROLE_KO: Record<Role, string> = { agonist: '주동근', antagonist: '길항근', none: '관여 안 함' };

/**
 * CH2 PUZZLE 3 — 운동 재현. For a target movement, assign each muscle as agonist / antagonist / not involved,
 * then drive the joint through its range by dragging the limb. Agonists shorten (concentric) and antagonists lengthen.
 * Round 1: elbow flexion (lateral view). Round 2: shoulder abduction 0–90° (anterior view, deltoid + supraspinatus).
 */
export class MuscleMotionPuzzle extends PuzzleBase {
  constructor() { super('Motion'); }
  round = 0;
  rows: Row[] = [];
  ui: Phaser.GameObjects.GameObject[] = [];
  g!: Phaser.GameObjects.Graphics;
  view = { x: 0, y: 0, w: 0, h: 0 };
  angle = 0;          // current joint angle (deg)
  stage: 'assign' | 'drive' | 'done' = 'assign';
  dragging = false;
  title!: Phaser.GameObjects.Text; sub!: Phaser.GameObjects.Text; angT!: Phaser.GameObjects.Text;
  cx0 = 0; cy0 = 0; cw = 0;

  create() {
    this.initView();
    this.round = 0; this.rows = []; this.ui = []; this.angle = 0; this.stage = 'assign'; this.dragging = false;
    this.frame('운동 재현 장치 · 주동근과 길항근', '목표 움직임에 맞게 근육의 역할을 지정한 뒤, 팔을 직접 끌어 움직임을 실행하세요.', C.pink);
    const { W, H } = View; const portrait = H > W;
    const areaW = portrait ? this.pw - 60 : this.pw * 0.5, areaH = portrait ? this.ph * 0.48 : this.ph - 180;
    this.view = { x: this.px + 30, y: this.py + 80, w: areaW, h: areaH };
    const pl = this.add.graphics(); pl.fillStyle(0x12060c, 0.75); pl.fillRoundedRect(this.view.x, this.view.y, areaW, areaH, 12);
    pl.lineStyle(1.5, C.pink, 0.35); pl.strokeRoundedRect(this.view.x, this.view.y, areaW, areaH, 12);
    this.g = this.add.graphics().setDepth(5);
    this.title = T(this, this.view.x + 18, this.view.y + 16, '', 20, C.white, { weight: '700' }).setDepth(6);
    this.sub = T(this, this.view.x + 18, this.view.y + 44, '', 14, '#ffb3c6').setDepth(6);
    this.angT = T(this, this.view.x + areaW - 18, this.view.y + 16, '', 22, C.amberS, { display: true, weight: '700' }).setOrigin(1, 0).setDepth(6);
    this.cx0 = portrait ? this.px + 30 : this.px + this.pw * 0.54 + 10; this.cy0 = portrait ? this.view.y + areaH + 24 : this.py + 96;
    this.cw = portrait ? this.pw - 60 : this.pw * 0.46 - 60;
    const hit = this.add.zone(this.view.x, this.view.y, areaW, areaH).setOrigin(0).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', (p: Phaser.Input.Pointer) => { if (this.stage === 'drive') { this.dragging = true; this.driveTo(p.worldX, p.worldY); } });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => { if (this.dragging && p.isDown) this.driveTo(p.worldX, p.worldY); });
    this.input.on('pointerup', () => { this.dragging = false; });
    this.startRound(0);
  }

  get R(): MotionRound { return MOTION_ROUNDS[this.round]; }

  startRound(i: number) {
    this.round = i; this.angle = 0; this.stage = 'assign';
    for (const o of this.ui) o.destroy(); this.ui = []; this.rows = [];
    const R = this.R; const adv = G.run.difficulty === 'adv';
    this.title.setText(`ROUND ${i + 1}/${MOTION_ROUNDS.length} · ${R.ko} (${R.en})`);
    this.sub.setText(`${R.joint} · ${R.plane}`);
    const add = <O extends Phaser.GameObjects.GameObject>(o: O) => { this.ui.push(o); return o; };
    add(T(this, this.cx0, this.cy0, `목표: ${R.ko}`, 20, C.pinkS, { weight: '700' }));
    add(T(this, this.cx0, this.cy0 + 30, '각 근육의 역할을 고르세요', 14, C.dim));
    const rowH = 64, segW = (this.cw - 0) / 3;
    R.cards.forEach((id, k) => {
      const M = MUSCLES[id]; const y = this.cy0 + 62 + k * (rowH + 8);
      const name = add(T(this, this.cx0, y, adv ? M.en : `${M.ko} · ${M.en}`, 16, C.white, { weight: '700' }));
      const mark = add(this.add.graphics());
      const row: Row = { id, role: null, segs: [], name, mark };
      (['agonist', 'antagonist', 'none'] as Role[]).forEach((r, j) => {
        const x = this.cx0 + j * segW, sy = y + 24, w = segW - 6, h = 34;
        const g = add(this.add.graphics());
        const t = add(T(this, x + w / 2, sy + h / 2, ROLE_KO[r], 15, C.white, { weight: '700' }).setOrigin(0.5));
        const z = add(this.add.zone(x, sy, w, h).setOrigin(0).setInteractive({ useHandCursor: true }));
        z.on('pointerup', () => { if (this.stage !== 'assign') return; row.role = r; Audio.play('click'); this.drawRow(row); });
        row.segs.push({ role: r, g, t, x, y: sy, w, h });
      });
      this.drawRow(row); this.rows.push(row);
    });
    const by = this.cy0 + 62 + R.cards.length * (rowH + 8) + 16;
    add(new Button(this, this.cx0 + Math.min(this.cw, 400) / 2, by + 10, '근육 신호 전송 (검증)', () => this.verify(), { w: Math.min(this.cw, 400), h: 60, icon: 'bolt', accent: C.green, primary: true, size: 20 }));
    if (!adv) add(T(this, this.cx0, by + 54, R.id === 'elbowFlex'
      ? '단서: 관절의 앞을 지나는 근육은 굽히고, 뒤를 지나는 근육은 폅니다. 그 관절을 지나지 않는 근육은 관여하지 않아요.'
      : '단서: 팔을 옆으로 드는 근육(외전근)과, 팔을 몸쪽으로 모으는 근육(내전근)을 구별하세요.', 14, '#e3cfd8', { wordWrap: { width: this.cw }, lineSpacing: 5 }));
    this.setFeedback(`${R.ko}: 수축해서 움직임을 만드는 근육 = 주동근, 반대 작용을 하며 늘어나는 근육 = 길항근.`, 'info');
    this.redraw();
  }

  drawRow(row: Row) {
    for (const s of row.segs) {
      const on = row.role === s.role;
      const col = s.role === 'agonist' ? C.pink : s.role === 'antagonist' ? C.cyan : 0x8ea3c4;
      s.g.clear(); s.g.fillStyle(on ? col : 0x0a1222, on ? 0.85 : 0.95); s.g.fillRoundedRect(s.x, s.y, s.w, s.h, 7);
      s.g.lineStyle(on ? 2 : 1, on ? 0xffffff : col, on ? 0.9 : 0.6); s.g.strokeRoundedRect(s.x, s.y, s.w, s.h, 7);
      s.t.setColor(on ? '#0a0410' : C.white);
    }
  }

  verify() {
    if (this.stage !== 'assign') return;
    const R = this.R;
    const unset = this.rows.filter(r => !r.role);
    if (unset.length) { Audio.play('error'); this.setFeedback(`역할을 고르지 않은 근육이 ${unset.length}개 있습니다.`, 'warn'); return; }
    const wrong = this.rows.filter(r => r.role !== (R.roles[r.id] ?? 'none'));
    for (const r of this.rows) {
      r.mark.clear(); const ok = !wrong.includes(r);
      r.mark.fillStyle(ok ? C.green : C.red, 1); r.mark.fillCircle(this.cx0 + this.cw - 8, r.name.y + 10, 6);
    }
    if (wrong.length) {
      Audio.play('error'); this.mistake(); G.run.stats.motion++;
      const w = wrong[0];
      this.setFeedback(`역할 오류 ${wrong.length}개 — ${R.why[w.id] ?? ''}`, 'err');
      this.cameras.main.shake(120, 0.003);
      return;
    }
    Audio.play('snap');
    this.stage = 'drive';
    this.setFeedback(`신호 정상! 이제 ${R.id === 'elbowFlex' ? '손(전완 끝)' : '팔 끝'}을 끌어서 ${R.ko}을(를) ${R.range}°까지 실행하세요.`, 'ok');
    this.redraw();
  }

  // ---------------- geometry ----------------
  pivot(): V { const v = this.view; return this.R.id === 'elbowFlex' ? { x: v.x + v.w * 0.42, y: v.y + v.h * 0.56 } : { x: v.x + v.w * 0.64, y: v.y + v.h * 0.34 }; }
  len() { return Math.min(this.view.w, this.view.h) * (this.R.id === 'elbowFlex' ? 0.3 : 0.3); }

  driveTo(x: number, y: number) {
    const p = this.pivot(); const dx = x - p.x, dy = y - p.y;
    let a: number;
    if (this.R.id === 'elbowFlex') a = Phaser.Math.RadToDeg(Math.atan2(dx, dy));     // 0 = down, + = forward (anterior = right)
    else a = Phaser.Math.RadToDeg(Math.atan2(-dx, dy));                               // 0 = down, + = lateral (viewer's left)
    a = Phaser.Math.Clamp(a, 0, this.R.range);
    // limit jumps so the limb follows the finger smoothly
    this.angle += Phaser.Math.Clamp(a - this.angle, -12, 12);
    if (Math.random() < 0.15) Audio.play('hold');
    this.redraw();
    if (this.angle >= this.R.range - 2 && this.stage === 'drive') this.roundDone();
  }

  roundDone() {
    this.stage = 'done'; this.dragging = false; this.angle = this.R.range; this.redraw();
    Audio.play('success'); this.cameras.main.flash(200, 255, 120, 160);
    const R = this.R;
    const ag = Object.entries(R.roles).filter(([, r]) => r === 'agonist').map(([id]) => MUSCLES[id as MuscleId].ko).join(' + ');
    const an = Object.entries(R.roles).filter(([, r]) => r === 'antagonist').map(([id]) => MUSCLES[id as MuscleId].ko).join(' + ');
    this.setFeedback(`${R.ko} ${R.range}° 완료 ✓  주동근 ${ag}은(는) 짧아지며(구심성 수축), 길항근 ${an}은(는) 이완하며 길어집니다.`, 'ok');
    if (this.round + 1 < MOTION_ROUNDS.length) this.time.delayedCall(2600, () => this.startRound(this.round + 1));
    else this.time.delayedCall(1800, () => this.success('c_agonist', '주동근은 수축해 움직임을 만들고, 길항근은 이완하며 길어진다', 600));
  }

  // ---------------- drawing ----------------
  roleOf(id: MuscleId): Role { return this.stage === 'assign' ? 'none' : (this.R.roles[id] ?? 'none'); }

  muscle(id: MuscleId, path: V[], baseW: number, rest: number) {
    // constant-volume look: shorter -> thicker. colour by role once verified.
    const L = path.reduce((s, p, i) => i ? s + Math.hypot(p.x - path[i - 1].x, p.y - path[i - 1].y) : 0, 0);
    const k = Phaser.Math.Clamp(rest / Math.max(1, L), 0.6, 1.8);
    const w = baseW * Math.sqrt(k);
    const role = this.roleOf(id);
    const live = this.stage !== 'assign';
    const col = !live ? 0xc0404c : role === 'agonist' ? 0xff4f7a : role === 'antagonist' ? 0x5fb8ff : 0x7a6d78;
    const alpha = !live ? 0.85 : role === 'none' ? 0.45 : 0.95;
    const n = path.length;
    const widths = path.map((_, i) => { const t = i / (n - 1); return Math.max(3, w * Math.sin(Math.PI * (0.12 + 0.76 * t))); });
    const poly = spindle(path.map(p => [p.x, p.y] as Pt), widths, 6);
    const g = this.g;
    g.fillStyle(col, alpha); g.fillPoints(poly.map(([x, y]) => new Phaser.Math.Vector2(x, y)), true);
    // fibres along the belly (direction of pull)
    const c = smoothLine(path.map(p => [p.x, p.y] as Pt), 6);
    g.lineStyle(1, 0xffffff, live && role !== 'none' ? 0.28 : 0.16);
    for (const k of [-0.28, 0, 0.28]) {
      const pts = c.map((q, i) => {
        const a = c[Math.max(0, i - 1)], b = c[Math.min(c.length - 1, i + 1)];
        let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
        const ww = w * Math.sin(Math.PI * (0.12 + 0.76 * i / (c.length - 1))) * k;
        return new Phaser.Math.Vector2(q[0] - dy * ww, q[1] + dx * ww);
      });
      g.strokePoints(pts.slice(2, -2), false);
    }
    g.lineStyle(1.5, 0x220008, 0.7); g.strokePoints(poly.map(([x, y]) => new Phaser.Math.Vector2(x, y)), true);
    // tendon ends
    g.lineStyle(3, 0xf0e6d2, 0.9); g.lineBetween(path[0].x, path[0].y, path[0].x + (path[1].x - path[0].x) * 0.15, path[0].y + (path[1].y - path[0].y) * 0.15);
    g.lineBetween(path[n - 1].x, path[n - 1].y, path[n - 1].x + (path[n - 2].x - path[n - 1].x) * 0.15, path[n - 1].y + (path[n - 2].y - path[n - 1].y) * 0.15);
    // label
    const mid = path[Math.floor(n / 2)];
    return { mid, role };
  }

  bone(a: V, b: V, w: number) {
    const g = this.g;
    g.lineStyle(w, 0xe9e0cc, 1); g.lineBetween(a.x, a.y, b.x, b.y);
    g.fillStyle(0xe9e0cc, 1); g.fillCircle(a.x, a.y, w * 0.62); g.fillCircle(b.x, b.y, w * 0.62);
    g.lineStyle(1.5, 0x5a5040, 0.6); g.strokeCircle(a.x, a.y, w * 0.62); g.strokeCircle(b.x, b.y, w * 0.62);
  }

  labels: Phaser.GameObjects.Text[] = [];
  label(text: string, at: V, role: Role) {
    const t = T(this, at.x, at.y, text, 13, role === 'agonist' ? '#ffd0dc' : role === 'antagonist' ? '#cfe8ff' : '#d8ccd4', { weight: '700', backgroundColor: '#0a0410aa', padding: { x: 4, y: 2 } }).setOrigin(0.5).setDepth(7);
    this.labels.push(t);
  }

  redraw() {
    const g = this.g; g.clear();
    for (const t of this.labels) t.destroy(); this.labels = [];
    const P = this.pivot(), L = this.len(), r = Phaser.Math.DegToRad(this.angle);
    const adv = G.run.difficulty === 'adv';
    const nm = (id: MuscleId) => adv ? MUSCLES[id].en : MUSCLES[id].ko;
    if (this.R.id === 'elbowFlex') {
      // lateral view of the right arm, anterior to the right. S = shoulder, E = elbow (pivot)
      const S = { x: P.x, y: P.y - L * 1.05 }, E = P;
      const u = { x: Math.sin(r), y: Math.cos(r) }, nrm = { x: Math.cos(r), y: -Math.sin(r) };
      const at = (t: number, o: number): V => ({ x: E.x + u.x * L * t + nrm.x * o, y: E.y + u.y * L * t + nrm.y * o });
      const H = at(1, 0);
      // torso outline + range arc
      g.lineStyle(2, 0x5a3a48, 0.6); g.strokeRoundedRect(S.x - 70, S.y - 40, 90, L * 1.6, 30);
      g.lineStyle(2, C.amber, 0.35); g.beginPath(); g.arc(E.x, E.y, L * 0.9, Math.PI / 2, Math.PI / 2 - Phaser.Math.DegToRad(this.R.range), true); g.strokePath();
      this.bone(S, E, 16); this.bone(E, H, 13);
      g.fillStyle(0xe9e0cc, 1); g.fillCircle(S.x, S.y, 18);
      // deltoid (shoulder only; never changes length here)
      const d = this.muscle('deltoid', [{ x: S.x - 18, y: S.y - 16 }, { x: S.x + 4, y: S.y + L * 0.2 }, { x: S.x + 6, y: S.y + L * 0.45 }], 30, L * 0.5);
      // brachialis (deep, anterior lower humerus -> ulnar tuberosity)
      const b2 = this.muscle('brachialis', [{ x: S.x + 6, y: S.y + L * 0.5 }, { x: S.x + 20, y: S.y + L * 0.82 }, at(0.1, 6)], 24, L * 0.62);
      // biceps (shoulder -> radial tuberosity)
      const b1 = this.muscle('biceps', [{ x: S.x + 12, y: S.y - 4 }, { x: S.x + 34, y: S.y + L * 0.45 }, { x: E.x + 26 + u.x * 6, y: E.y - L * 0.12 + u.y * 6 }, at(0.14, 10)], 30, L * 1.25);
      // triceps (posterior shoulder/humerus -> olecranon behind the elbow)
      const tr = this.muscle('triceps', [{ x: S.x - 14, y: S.y + 8 }, { x: S.x - 30, y: S.y + L * 0.5 }, at(-0.08, -16)], 32, L * 1.05);
      if (this.stage !== 'assign') {
        this.label(nm('biceps'), { x: S.x + 96, y: S.y + L * 0.3 }, b1.role); this.label(nm('brachialis'), { x: S.x + 96, y: S.y + L * 0.62 }, b2.role);
        g.lineStyle(1, 0xffd0dc, 0.5); g.lineBetween(S.x + 60, S.y + L * 0.3, b1.mid.x + 8, (b1.mid.y + S.y + L * 0.3) / 2); g.lineBetween(S.x + 66, S.y + L * 0.62, b2.mid.x + 6, b2.mid.y);
        this.label(nm('triceps'), { x: tr.mid.x - 58, y: tr.mid.y }, tr.role); this.label(nm('deltoid'), { x: d.mid.x - 50, y: d.mid.y - 30 }, d.role);
      }
      this.handle(H);
      this.labels.push(T(this, S.x - 60, S.y - 64, '← 뒤 (Posterior)', 12, '#ffb3c6').setDepth(7), T(this, S.x + 70, S.y - 64, '앞 (Anterior) →', 12, '#ffb3c6').setDepth(7));
    } else {
      // anterior view of the right shoulder: humerus swings laterally (viewer's left) in the coronal plane
      const S = P; const a = { x: -Math.sin(r), y: Math.cos(r) }, lat = { x: -Math.cos(r), y: -Math.sin(r) };
      const on = (t: number, o: number): V => ({ x: S.x + a.x * L * t + lat.x * o, y: S.y + a.y * L * t + lat.y * o });
      const Eb = on(1, 0), Hd = on(1.7, 0);
      // trunk (right half, anterior): ribcage outline, sternum, clavicle, scapula behind
      const tx = S.x + L * 0.95;                                   // midline
      g.lineStyle(2, 0x5a3a48, 0.7);
      for (let i = 0; i < 6; i++) { const y = S.y + 10 + i * L * 0.16; g.beginPath(); g.moveTo(tx, y); g.lineTo(S.x + L * 0.22 + i * 4, y + L * 0.12); g.strokePath(); }
      g.lineStyle(2, 0x5a3a48, 0.5); g.lineBetween(tx, S.y - 30, tx, S.y + L * 1.2);
      g.fillStyle(0xd8ccb4, 0.25); g.fillPoints([new Phaser.Math.Vector2(S.x + 8, S.y - 26), new Phaser.Math.Vector2(S.x + L * 0.55, S.y - 22), new Phaser.Math.Vector2(S.x + L * 0.4, S.y + L * 0.62), new Phaser.Math.Vector2(S.x + 10, S.y + 18)], true);
      g.lineStyle(10, 0xe9e0cc, 0.95); g.lineBetween(S.x - 6, S.y - 36, tx - 8, S.y - 24);   // clavicle
      g.lineStyle(2, C.amber, 0.35); g.beginPath(); g.arc(S.x, S.y, L * 1.2, Math.PI / 2, Math.PI / 2 + Phaser.Math.DegToRad(this.R.range)); g.strokePath();
      // muscles behind the arm first
      const lt = this.muscle('latissimus', [{ x: tx - 20, y: S.y + L * 1.25 }, { x: S.x + L * 0.35, y: S.y + L * 0.75 }, on(0.16, -6)], 24, L * 1.25);
      const pm = this.muscle('pecmajor', [{ x: tx - 12, y: S.y + L * 0.3 }, { x: S.x + L * 0.45, y: S.y + L * 0.22 }, on(0.18, -4)], 28, L * 0.9);
      this.bone(S, Eb, 16); this.bone(Eb, Hd, 12);
      g.fillStyle(0xe9e0cc, 1); g.fillCircle(S.x, S.y, 20); g.fillStyle(0xd8ccb4, 1); g.fillEllipse(S.x - 4, S.y - 34, 34, 14);   // humeral head, acromion
      const sp = this.muscle('supraspinatus', [{ x: S.x + L * 0.5, y: S.y - 14 }, { x: S.x + L * 0.22, y: S.y - 24 }, on(0.02, 20)], 16, L * 0.55);
      const dl = this.muscle('deltoid', [{ x: S.x - 2, y: S.y - 36 }, on(0.2, 22), on(0.45, 12)], 28, L * 0.62);
      const br = this.muscle('brachialis', [on(0.55, -6), on(0.8, -9), on(1.06, -5)], 14, L * 0.5);
      if (this.stage !== 'assign') {
        this.label(nm('deltoid'), { x: dl.mid.x - 40 * Math.cos(r), y: dl.mid.y - 40 * Math.sin(r) - 6 }, dl.role); this.label(nm('supraspinatus'), { x: sp.mid.x + 10, y: sp.mid.y - 22 }, sp.role);
        this.label(nm('pecmajor'), { x: pm.mid.x + 26, y: pm.mid.y - 16 }, pm.role); this.label(nm('latissimus'), { x: lt.mid.x + 34, y: lt.mid.y + 6 }, lt.role);
        this.label(nm('brachialis'), { x: br.mid.x + 30 * Math.cos(r), y: br.mid.y + 30 * Math.sin(r) + 14 }, br.role);
      }
      this.handle(Hd);
      this.labels.push(T(this, this.view.x + 18, this.view.y + this.view.h - 26, '← 외측 (Lateral)', 12, '#ffb3c6').setDepth(7));
    }
    this.angT.setText(this.stage === 'assign' ? '' : `${Math.round(this.angle)}° / ${this.R.range}°`);
  }

  handle(at: V) {
    const g = this.g;
    if (this.stage === 'drive') {
      const pulse = 0.5 + 0.5 * Math.sin(this.time.now / 180);
      g.fillStyle(0xffe08a, 0.25 + pulse * 0.2); g.fillCircle(at.x, at.y, 26);
      g.lineStyle(3, 0xffe08a, 1); g.strokeCircle(at.x, at.y, 16);
    }
    g.fillStyle(0xf2e8d6, 1); g.fillCircle(at.x, at.y, 10);
  }

  update() { if (this.stage === 'drive' && !this.dragging) this.redraw(); }
}
