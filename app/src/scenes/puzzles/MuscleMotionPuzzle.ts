import Phaser from 'phaser';
import { PuzzleBase } from './PuzzleBase';
import { View } from '../../core/view';
import { Audio } from '../../core/audio';
import { G } from '../../game/state';
import { MUSCLES, MuscleId, MOTION_ROUNDS, MotionRound, Role } from '../../data/muscles';
import { T, C, Button } from '../../ui/widgets';
import { MODEL_CREDIT, LAT_CREDIT } from '../../art/muscles';

interface Row { id: MuscleId; role: Role | null; segs: { role: Role; g: Phaser.GameObjects.Graphics; t: Phaser.GameObjects.Text; x: number; y: number; w: number; h: number }[]; name: Phaser.GameObjects.Text; mark: Phaser.GameObjects.Graphics }
type V = { x: number; y: number };
interface MotionPath { m: MuscleId; fid: string; w: number; pts: number[][] }
interface MotionFrame { angle: number; pivot: number[]; handle: number[]; length: Record<string, number | null>; paths: MotionPath[] }
interface MotionMeta { round: string; size: [number, number]; angles: number[]; frames: MotionFrame[]; rest: { labels: Record<string, number[]>; xray?: number[]; latx?: number[] } }

const ROLE_KO: Record<Role, string> = { agonist: '주동근', antagonist: '길항근', none: '관여 안 함' };

/**
 * CH2 PUZZLE 3 — 운동 재현. For a target movement, assign each muscle as agonist / antagonist / not involved,
 * then drive the joint through its range by dragging the limb. Agonists shorten (concentric) and antagonists lengthen.
 * Round 1: elbow flexion (lateral view). Round 2: shoulder abduction 0–90° (anterior view, deltoid + supraspinatus).
 */
export class MuscleMotionPuzzle extends PuzzleBase {
  constructor() { super('Motion'); }

  preload() {
    // model-rendered frames (loaded on first use)
    for (const rk of ['elbow', 'shoulder']) {
      if (!this.cache.json.exists(`mo_${rk}`)) this.load.json(`mo_${rk}`, `assets/ch2/motion/${rk}.json`);
    }
    this.load.once('filecomplete-json-mo_elbow', () => this.queueFrames('elbow'));
    this.load.once('filecomplete-json-mo_shoulder', () => this.queueFrames('shoulder'));
    if (this.cache.json.exists('mo_elbow')) { this.queueFrames('elbow'); this.queueFrames('shoulder'); }
  }
  queueFrames(rk: string) {
    const m = this.cache.json.get(`mo_${rk}`) as MotionMeta;
    const add = (k: string) => { if (!this.textures.exists(`mo_${rk}_${k}`)) this.load.image(`mo_${rk}_${k}`, `assets/ch2/motion/${rk}_${k}.webp`); };
    // n0/r0 = the real BodyParts3D muscle meshes, undeformed, at 0 deg; b<i> = bones only, moved rigidly per angle
    add('n0'); add('r0'); m.frames.forEach((_, i) => add(`b${i}`));
    if (m.rest.xray) add('x0'); if (m.rest.latx) add('l0');
  }
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
    this.imgA = this.imgB = this.xA = this.xB = this.lA = this.inset = undefined; this.readout = undefined; this.labels = [];
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
    // the role buttons were just rebuilt: without this a tap in the same frame as the round change was dropped
    this.flushInput();
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

  // ---------------- model frames ----------------
  // Every frame is a render of the BodyParts3D model posed at that joint angle (tools/anatomy3d/motion_render.py):
  // bones move rigidly, each muscle stays attached at its measured origin/insertion and its belly shortens+thickens
  // or lengthens+thins between them (constant volume, inextensible tendons). Colours: agonist red, antagonist blue.
  meta(): MotionMeta { return this.cache.json.get(this.R.id === 'elbowFlex' ? 'mo_elbow' : 'mo_shoulder') as MotionMeta; }
  rk() { return this.R.id === 'elbowFlex' ? 'elbow' : 'shoulder'; }
  fit() {
    const m = this.meta(), v = this.view;
    const top = 108, bot = 60;   // header + simplification notice / footer notice
    const sc = Math.min(v.w / m.size[0], (v.h - top - bot) / m.size[1]);
    return { sc, ox: v.x + (v.w - m.size[0] * sc) / 2, oy: v.y + top + (v.h - top - bot - m.size[1] * sc) / 2 };
  }
  toScreen(p: number[]): V { const f = this.fit(); return { x: f.ox + p[0] * f.sc, y: f.oy + p[1] * f.sc }; }
  /** fractional frame index for the current angle */
  fi() { const a = this.meta().angles; const st = a[1] - a[0]; return Phaser.Math.Clamp(this.angle / st, 0, a.length - 1); }
  lerpP(get: (fr: MotionFrame) => number[] | undefined): number[] | null {
    const fr = this.meta().frames, f = this.fi(), i = Math.floor(f), j = Math.min(i + 1, fr.length - 1), t = f - i;
    const a = get(fr[i]), b = get(fr[j]);
    if (!a && !b) return null; if (!a) return b!; if (!b) return a;
    return a.map((v, k) => v + (b[k] - v) * t);
  }
  pivot(): V { return this.toScreen(this.meta().frames[0].pivot); }
  /** joint angle at which the hand points from the pivot toward screen angle `deg` (0 = down) */
  handAngle(fr: MotionFrame) {
    const p = this.toScreen(this.meta().frames[0].pivot), h = this.toScreen(fr.handle);
    return this.R.id === 'elbowFlex' ? Phaser.Math.RadToDeg(Math.atan2(h.x - p.x, h.y - p.y)) : Phaser.Math.RadToDeg(Math.atan2(-(h.x - p.x), h.y - p.y));
  }

  driveTo(x: number, y: number) {
    const p = this.pivot(); const dx = x - p.x, dy = y - p.y;
    const fa = this.R.id === 'elbowFlex' ? Phaser.Math.RadToDeg(Math.atan2(dx, dy)) : Phaser.Math.RadToDeg(Math.atan2(-dx, dy));
    // invert the measured hand-angle curve of the rendered frames
    const m = this.meta(); const ha = m.frames.map(f => this.handAngle(f));
    let a = 0;
    if (fa <= ha[0]) a = 0; else if (fa >= ha[ha.length - 1]) a = m.angles[m.angles.length - 1];
    else for (let k = 0; k < ha.length - 1; k++) if (fa >= ha[k] && fa <= ha[k + 1]) { a = m.angles[k] + (m.angles[k + 1] - m.angles[k]) * (fa - ha[k]) / Math.max(1e-6, ha[k + 1] - ha[k]); break; }
    a = Phaser.Math.Clamp(a, 0, this.R.range);
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
  imgA?: Phaser.GameObjects.Image; imgB?: Phaser.GameObjects.Image; xA?: Phaser.GameObjects.Image; xB?: Phaser.GameObjects.Image; lA?: Phaser.GameObjects.Image;
  inset?: Phaser.GameObjects.Image;
  labels: Phaser.GameObjects.Text[] = [];
  readout?: Phaser.GameObjects.Text;

  ensureImages() {
    const mk = () => this.add.image(0, 0, '__DEFAULT').setOrigin(0).setDepth(4).setVisible(false);
    if (!this.imgA) { this.imgA = mk(); this.imgB = mk(); this.xA = mk().setDepth(4.5); this.xB = mk().setDepth(4.5); this.lA = mk().setDepth(4.4); this.inset = mk().setDepth(6.5); }
  }

  /** colour of a path: role of its muscle; deltoid parts other than the middle fibres and brachioradialis = assisting */
  pathColour(p: MotionPath): number {
    if (this.stage === 'assign') return 0xd06a7a;
    if (p.m === 'brachioradialis' || ((p.fid === 'FJ1468' || p.fid === 'FJ1513') && this.rk() === 'shoulder')) return 0xff9fb0;
    const r = this.roleOf(p.m);
    return r === 'agonist' ? 0xff4f7a : r === 'antagonist' ? 0x5fb8ff : 0x9a8f99;
  }

  redraw() {
    this.ensureImages();
    const g = this.g; g.clear();
    for (const t of this.labels) t.destroy(); this.labels = [];
    const m = this.meta(), f = this.fit(), rk = this.rk();
    const adv = G.run.difficulty === 'adv';
    const nm = (id: MuscleId) => adv ? MUSCLES[id].en : MUSCLES[id].ko;
    const live = this.stage !== 'assign';
    const i = Math.round(this.fi());
    // 0 deg: the real BodyParts3D muscles (undeformed). Moving: the bones (rigid, same model) + lines of action.
    // The muscle meshes are NOT deformed (the earlier straight-line mesh deformation stretched/tore the meshes and
    // pushed them through bone - see tools/anatomy3d/deform_audit.py).
    const restA = Phaser.Math.Clamp(1 - this.angle / 6, 0, 1);
    this.imgA!.setTexture(live ? `mo_${rk}_r0` : `mo_${rk}_n0`).setPosition(f.ox, f.oy).setScale(f.sc / 2).setVisible(restA > 0.01).setAlpha(restA);
    this.imgB!.setTexture(`mo_${rk}_b${i}`).setPosition(f.ox, f.oy).setScale(f.sc / 2).setVisible(restA < 0.99).setAlpha(1 - restA);
    const ov = (im: Phaser.GameObjects.Image, key: string, r: number[] | undefined, al: number) => {
      if (!r || al < 0.01) { im.setVisible(false); return; }
      im.setTexture(key).setPosition(f.ox + r[0] * f.sc, f.oy + r[1] * f.sc).setScale(f.sc / 2).setAlpha(al).setVisible(true);
    };
    ov(this.xA!, `mo_${rk}_x0`, m.rest.xray, (live ? 0.75 : 0.45) * restA);      // supraspinatus behind clavicle/acromion: x-ray
    ov(this.lA!, `mo_${rk}_l0`, m.rest.latx, (live ? 0.7 : 0.4) * restA);        // latissimus behind trunk/arm: x-ray
    this.xB!.setVisible(false);
    // lines of action (measured centre lines, rigid per bone, wrapped at the joint)
    const fr = m.frames[i];
    const moving = restA < 0.99;
    if (moving) {
      for (const p of fr.paths) {
        const pts = p.pts.map(q => this.toScreen(q)); const col = this.pathColour(p);
        const wpx = Math.max(4, p.w * f.sc);
        g.lineStyle(wpx, col, 0.42 * (1 - restA)); g.strokePoints(pts.map(q => new Phaser.Math.Vector2(q.x, q.y)), false);
        g.lineStyle(2, col, 0.95 * (1 - restA)); g.strokePoints(pts.map(q => new Phaser.Math.Vector2(q.x, q.y)), false);
        g.fillStyle(0xffffff, 0.9 * (1 - restA)); g.fillCircle(pts[0].x, pts[0].y, 3.5); g.fillCircle(pts[pts.length - 1].x, pts[pts.length - 1].y, 3.5);
      }
      // reference inset: the real (undeformed) muscles at 0 deg
      const iw = this.view.w * 0.22, ih = iw * m.size[1] / m.size[0];
      this.inset!.setTexture(live ? `mo_${rk}_r0` : `mo_${rk}_n0`).setOrigin(1, 0).setPosition(this.view.x + this.view.w - 12, this.view.y + 112).setDisplaySize(iw, ih).setAlpha(0.95 * (1 - restA)).setVisible(true);
      g.lineStyle(1, 0xffb3c6, 0.6 * (1 - restA)); g.strokeRect(this.view.x + this.view.w - 12 - iw, this.view.y + 112, iw, ih);
      this.labels.push(T(this, this.view.x + this.view.w - 12 - iw / 2, this.view.y + 116 + ih, '실제 근육 메시 (0°)', 11, '#ffb3c6').setOrigin(0.5, 0).setDepth(7).setAlpha(1 - restA));
    } else this.inset!.setVisible(false);
    // range arc + handle
    const P = this.pivot();
    const h = this.lerpP(q => q.handle)!; const H = this.toScreen(h);
    const r = Math.hypot(H.x - P.x, H.y - P.y);
    const a0 = this.handAngle(m.frames[0]), a1 = this.handAngle(m.frames[m.frames.length - 1]);
    const s0 = this.R.id === 'elbowFlex' ? Math.PI / 2 - Phaser.Math.DegToRad(a0) : Math.PI / 2 + Phaser.Math.DegToRad(a0);
    const s1 = this.R.id === 'elbowFlex' ? Math.PI / 2 - Phaser.Math.DegToRad(a1) : Math.PI / 2 + Phaser.Math.DegToRad(a1);
    g.lineStyle(2, C.amber, 0.35); g.beginPath(); g.arc(P.x, P.y, r, s0, s1, this.R.id === 'elbowFlex'); g.strokePath();
    g.fillStyle(0xffe08a, 0.9); g.fillCircle(P.x, P.y, 4);
    if (live) {
      // label anchors: on the real meshes at 0 deg, on the path (60 % along) while moving
      const cur: Record<string, number[]> = {};
      if (!moving) {
        Object.assign(cur, m.rest.labels);
        const xr = m.rest.xray, lx = m.rest.latx;
        if (xr && !cur.supraspinatus) cur.supraspinatus = [xr[0] + xr[2] * 0.55, xr[1] + xr[3] * 0.5];
        if (lx && !cur.latissimus) cur.latissimus = [lx[0] + lx[2] * 0.62, lx[1] + lx[3] * 0.72];
      } else for (const p of fr.paths) if (!cur[p.m] && (p.fid !== 'FJ1468' && p.fid !== 'FJ1513')) cur[p.m] = p.pts[Math.floor(p.pts.length * 0.6)];
      const items = Object.entries(cur).map(([id, p]) => {
        const sp = this.toScreen(p);
        const extra = id === 'brachioradialis' ? ' (보조 굴곡)' : (id === 'supraspinatus' || id === 'latissimus') && !moving ? ' (뒤쪽 · 투시)' : id === 'deltoid' && rk === 'shoulder' ? ' (중간섬유)' : '';
        return { id, sp, text: nm(id as MuscleId) + extra, role: (id === 'brachioradialis' ? 'agonist' : this.roleOf(id as MuscleId)) as Role };
      });
      const mx = items.reduce((a, b) => a + b.sp.x, 0) / Math.max(1, items.length);
      for (const side of [-1, 1]) {
        const grp = items.filter(it => (it.sp.x < mx ? -1 : 1) === side).sort((a, b) => a.sp.y - b.sp.y);
        let lastY = -1e9;
        for (const it of grp) {
          const ly = Math.max(it.sp.y, lastY + 22); lastY = ly;
          const t = T(this, it.sp.x + side * 70, ly, it.text, 13, it.role === 'agonist' ? '#ffd0dc' : it.role === 'antagonist' ? '#cfe8ff' : '#d8ccd4', { weight: '700', backgroundColor: '#0a0410cc', padding: { x: 4, y: 2 } }).setOrigin(side < 0 ? 1 : 0, 0.5).setDepth(7);
          if (side < 0 && t.x - t.width < this.view.x + 6) t.setX(this.view.x + 6 + t.width);
          if (side > 0 && t.x + t.width > this.view.x + this.view.w - 6) t.setX(this.view.x + this.view.w - 6 - t.width);
          this.labels.push(t);
          g.lineStyle(1, 0xffffff, 0.55); g.lineBetween(it.sp.x, it.sp.y, t.x, ly); g.fillStyle(0xffffff, 0.9); g.fillCircle(it.sp.x, it.sp.y, 2.5);
        }
      }
    }
    this.handle(H);
    // length read-out: DIRECTION only (path-length change of the line of action; not validated against measurement)
    const st = fr.length;
    const lines = this.R.cards.map(id => {
      const v = st[id];
      if (v === undefined) return `${nm(id)}  —`;
      // null = the simplified model's path disagrees with the textbook direction here -> say so instead of guessing
      if (v === null) return `${nm(id)}  · 모델 한계로 생략`;
      return `${nm(id)}  ${v <= -0.02 ? '▼ 짧아짐' : v >= 0.02 ? '▲ 길어짐' : '－ 변화 없음'}`;
    });
    if (!this.readout) this.readout = T(this, 0, 0, '', 13, '#e8dce2', { lineSpacing: 4, backgroundColor: '#0a0410cc', padding: { x: 8, y: 6 } }).setDepth(7);
    this.readout.setText(live ? `근육 길이 변화 (안정 자세 대비)\n${lines.join('\n')}` : '').setVisible(live).setPosition(this.view.x + 14, this.view.y + this.view.h - 44).setOrigin(0, 1);
    this.labels.push(T(this, this.view.x + 14, this.view.y + this.view.h - 10,
      '움직이는 동안 근육은 실제 모양이 아닌 작용선(측정한 기시→정지 경로)으로 표시 · 뼈는 3D 모델을 관절축으로 회전 · 근육 수축 모양을 재현한 것이 아님',
      11, '#c9a24a', { wordWrap: { width: this.view.w - 28 } }).setOrigin(0, 1).setDepth(7));
    this.labels.push(T(this, this.view.x + this.view.w - 12, this.view.y + this.view.h - 44, rk === 'shoulder' ? `${MODEL_CREDIT}\n${LAT_CREDIT}` : MODEL_CREDIT, 10, '#8f7f88', { align: 'right' }).setOrigin(1, 1).setDepth(7));
    this.labels.push(T(this, this.view.x + 18, this.view.y + 66, rk === 'elbow' ? '오른팔 외측면  ← 뒤 · 앞 →' : '오른쪽 어깨 앞면  ← 외측', 12, '#ffb3c6').setDepth(7));
    // kinematic simplifications, shown so the motion is not taken for the real joint motion (docs/ANATOMY_MODEL.md §6)
    this.labels.push(T(this, this.view.x + 18, this.view.y + 84, rk === 'elbow'
      ? '⚠ 단순화: 팔꿉관절 고정축 회전만 · 전완은 뒤침(회외) 자세 고정'
      : '⚠ 단순화 모델: 어깨뼈 회전을 1:3 비율로 근사 · 위팔뼈 가쪽돌림·빗장뼈 회전·관절면 미끄러짐 생략 → 실제 어깨 운동과 다릅니다',
      11, '#e8c070', { wordWrap: { width: this.view.w - 36 } }).setDepth(7));
    this.angT.setText(this.stage === 'assign' ? '' : `${Math.round(this.angle)}° / ${this.R.range}°`);
  }

  label(text: string, at: V, role: Role) {
    const t = T(this, at.x, at.y, text, 13, role === 'agonist' ? '#ffd0dc' : role === 'antagonist' ? '#cfe8ff' : '#d8ccd4', { weight: '700', backgroundColor: '#0a0410aa', padding: { x: 4, y: 2 } }).setOrigin(0.5).setDepth(7);
    this.labels.push(t);
  }

  handle(at: V) {
    const g = this.g;
    if (this.stage === 'drive') {
      const pulse = 0.5 + 0.5 * Math.sin(this.time.now / 180);
      g.fillStyle(0xffe08a, 0.25 + pulse * 0.2); g.fillCircle(at.x, at.y, 26);
      g.lineStyle(3, 0xffe08a, 1); g.strokeCircle(at.x, at.y, 16);
    }
    g.fillStyle(0xf2e8d6, 0.9); g.fillCircle(at.x, at.y, 8);
  }

  update() { if (this.stage === 'drive' && !this.dragging) this.redraw(); }
}
