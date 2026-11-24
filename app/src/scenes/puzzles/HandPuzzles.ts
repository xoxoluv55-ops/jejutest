import Phaser from 'phaser';
import { PuzzleBase } from './PuzzleBase';
import { Audio } from '../../core/audio';
import { G } from '../../game/state';
import { T, C } from '../../ui/widgets';
import { CARPAL, CARPALS, CarpalId, PROXIMAL, xrayTargets, neededJoints, JointDef, JointType, JTYPE_KO, JTYPE_AXES, JTYPE_SHAPE, HAND_CREDIT } from '../../data/hand';
import { handManifest, layerDist } from '../../art/hand';
import { boneModel, bonePoint, DENSITY } from '../../art/bones';

const ACC = 0x7fd8ff;
type Box = { q: number; bx: number; by: number; ox: number; oy: number; w: number; h: number };
function fitRect(r: { x: number; y: number; w: number; h: number }, x: number, y: number, w: number, h: number): Box {
  const q = Math.min(w / r.w, h / r.h); const bx = x + (w - r.w * q) / 2, by = y + (h - r.h * q) / 2;
  return { q, bx, by, ox: bx - r.x * q, oy: by - r.y * q, w: r.w * q, h: r.h * q };
}

// ====================================================================================== LOCK 1: hand X-ray
/** LOCK 1 — 손 X선 판독: find each named carpal on a simulated PA radiograph of the hand (computed from the model). */
export class HandXrayPuzzle extends PuzzleBase {
  constructor() { super('HXray'); }
  create() {
    this.initView();
    const adv = G.run.difficulty === 'adv', m = handManifest(this);
    this.frame('손 X선 판독기 · J-02', adv ? '판독 요청에 맞는 손목뼈를 영상에서 누르세요.' : '판독 요청의 손목뼈를 영상에서 찾아 누르세요. 맞히면 윤곽이 표시됩니다.', ACC);
    const { cTop, cBot } = this;
    // film = the wrist area of the full-hand radiograph (density 2 over the whole hand frame)
    const R = m.wrist; const area = { x: this.px + 30, y: cTop, w: this.pw * 0.56, h: cBot - cTop };
    const b = fitRect(R, area.x + 16, area.y + 16, area.w - 32, area.h - 32);
    const lb = this.add.graphics(); lb.fillStyle(0xbfe6ff, 0.08); lb.fillRoundedRect(b.bx - 16, b.by - 16, b.w + 32, b.h + 32, 10);
    lb.lineStyle(2, 0x9fd8ff, 0.5); lb.strokeRoundedRect(b.bx - 16, b.by - 16, b.w + 32, b.h + 32, 10);
    this.add.image(b.ox, b.oy, 'ch3_xray_hand').setOrigin(0).setScale(b.q / 2).setCrop(R.x * 2, R.y * 2, R.w * 2, R.h * 2);
    T(this, b.bx + 12, b.by + 8, 'R', 30, '#f2f5f9', { weight: '900' });
    T(this, b.bx + b.w - 8, b.by + b.h - 6, '모의 방사선 영상 · 3D 뼈 모델로 계산 · 실제 환자 영상 아님', 12, '#c9d6e6', { fine: true, weight: '700', backgroundColor: '#000000aa', padding: { x: 5, y: 2 } }).setOrigin(1, 1);
    T(this, b.bx + b.w - 8, b.by + 8, 'PA · 손바닥 쪽에서 본 방향 (엄지 = 오른쪽)', 12, '#c9d6e6', { fine: true, backgroundColor: '#000000aa', padding: { x: 5, y: 2 } }).setOrigin(1, 0);
    const targets = xrayTargets();
    const rx = area.x + area.w + 30, rw = this.px + this.pw - 30 - rx;
    T(this, rx, cTop + 4, '판독 요청', 19, '#bfe6ff', { weight: '700' });
    const reqT = T(this, rx, cTop + 40, '', 22, C.white, { weight: '800', wordWrap: { width: rw }, lineSpacing: 6 });
    const subT = T(this, rx, cTop + 110, '', 16, '#c3d3ee', { wordWrap: { width: rw }, lineSpacing: 5 });
    const prog = T(this, rx, cBot - 10, '', 16, C.dim).setOrigin(0, 1);
    let k = 0;
    const done: CarpalId[] = [];
    const ask = () => {
      const id = targets[k];
      const isCase = adv && k === targets.length - 1;
      reqT.setText(isCase ? '증례: 넘어지며 손을 짚은 뒤 해부학코담배갑(엄지 뿌리 손등 쪽 오목)을 누르면 아프다.' : `${k + 1}. ${CARPAL[id].ko}${adv ? '' : `  (${CARPAL[id].en})`}`);
      subT.setText(isCase ? '골절이 의심되는 뼈를 영상에서 누르세요.' : adv ? '' : `${CARPAL[id].row} · ${CARPAL[id].shape}`);
      prog.setText(`판독 ${done.length}/${targets.length}`);
    };
    (this as unknown as { __x: unknown }).__x = { at: (id: CarpalId) => { const p = m.points[id]!; return { x: b.ox + p[0] * b.q, y: b.oy + p[1] * b.q }; }, cur: () => targets[k] };
    const z = this.add.zone(b.bx, b.by, b.w, b.h).setOrigin(0).setInteractive({ useHandCursor: true });
    z.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (this.solved || k >= targets.length) return;
      const wp = this.lp(p); const fx = (wp.x - b.ox) / b.q, fy = (wp.y - b.oy) / b.q;
      // nearest carpal under the pointer (pisiform sits on the triquetrum: the nearer centre wins)
      let best: CarpalId | null = null, bd = 1e9;
      for (const c of CARPALS) { const d = layerDist(m, `car_${c}`, fx, fy); const dc = Math.hypot(m.points[c]![0] - fx, m.points[c]![1] - fy); const s = d < 4 ? dc : 1e9; if (s < bd) { bd = s; best = c; } }
      const want = targets[k];
      if (best !== want) {
        Audio.play('error'); this.mistake(); G.run.stats.hxray++;
        this.setFeedback(best ? (adv ? '아니다. 다시 보세요.' : `그건 ${CARPAL[best].ko}. ${CARPAL[want].ko}는 ${CARPAL[want].row}, ${CARPAL[want].shape}.`) : '손목뼈가 아닌 곳입니다. 손목뼈 위를 누르세요.', 'err');
        return;
      }
      Audio.play('snap'); done.push(want);
      const r = m.rects[`car_${want}`];
      const ol = this.add.image(b.ox + (r.x + r.w / 2) * b.q, b.oy + (r.y + r.h / 2) * b.q, `ch3_car_${want}`).setScale(b.q / 2).setTintFill(0x5fe0ff).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: ol, alpha: 0.24, duration: 250 });
      const p0 = m.points[want]!; T(this, b.ox + p0[0] * b.q, b.oy + p0[1] * b.q, CARPAL[want].ko, 13, '#ffffff', { weight: '800', backgroundColor: '#0a3050cc', padding: { x: 3, y: 1 } }).setOrigin(0.5);
      k++;
      if (k >= targets.length) {
        prog.setText(`판독 ${done.length}/${targets.length}`); reqT.setText('판독 완료'); subT.setText('');
        this.setFeedback(adv ? '손배뼈 — 해부학코담배갑 바닥을 이루는 뼈. 판독 완료!' : '판독 완료! 손목뼈 위치를 모두 확인했습니다.', 'ok');
        this.success('c_handxray', '손 PA 영상에서 손목뼈를 구별했습니다');
      } else { this.setFeedback(`${CARPAL[want].ko} 확인.`, 'ok'); ask(); }
    });
    ask();
    this.setFeedback(adv ? '이름만 보고 위치를 찾으세요. 콩알뼈는 세모뼈 위에 겹쳐 보입니다.' : '영상은 손바닥 쪽에서 본 방향입니다: 엄지가 오른쪽, 손가락이 위쪽.', 'info');
  }
}

// ====================================================================================== LOCK 2: carpal assembly
/** LOCK 2 — 손목뼈 재조립: drag the 8 recovered carpals into the empty wrist (radius/ulna + metacarpals rendered). */
export class CarpalAssemblyPuzzle extends PuzzleBase {
  constructor() { super('HAssembly'); }
  create() {
    this.initView();
    const adv = G.run.difficulty === 'adv', m = handManifest(this);
    this.frame('손목뼈 재조립대 · J-01', adv ? '회수한 손목뼈를 제자리에 끼우세요. 발의 뼈가 섞여 있습니다.' : '회수한 손목뼈를 끌어 비어 있는 손목의 제자리에 끼우세요. 반투명 그림자가 자리입니다.', ACC);
    const { cTop, cBot } = this;
    const R = m.wrist; const area = { x: this.px + 30, y: cTop, w: this.pw * 0.6, h: cBot - cTop };
    const b = fitRect(R, area.x, area.y, area.w, area.h);
    const bg = this.add.graphics(); bg.fillStyle(0x0b1626, 1); bg.fillRoundedRect(b.bx - 8, b.by - 8, b.w + 16, b.h + 16, 10);
    this.add.image(b.bx, b.by, 'ch3_wrist_rest').setOrigin(0).setScale(b.q / 2);
    T(this, b.bx + 6, b.by + b.h - 4, HAND_CREDIT, 12, '#8f9bb3', { fine: true }).setOrigin(0, 1);
    const pos = (c: string) => { const r = m.rects[c]; return { x: b.ox + (r.x + r.w / 2) * b.q, y: b.oy + (r.y + r.h / 2) * b.q }; };
    // basic: translucent ghosts in place + row labels
    if (!adv) {
      for (const c of CARPALS) this.add.image(pos(`car_${c}`).x, pos(`car_${c}`).y, `ch3_car_${c}`).setScale(b.q / 2).setTintFill(0x3a6a9a).setAlpha(0.35);
      const py = (ids: CarpalId[]) => Math.max(...ids.map(i => pos(`car_${i}`).y));
      T(this, b.bx + 8, py(PROXIMAL) + 10, '몸쪽 줄', 14, '#9fd8ff', { weight: '700' });
      T(this, b.bx + 8, Math.min(...['trapezium', 'hamate'].map(i => pos(`car_${i}`).y)) - 40, '먼쪽 줄', 14, '#ffc98a', { weight: '700' });
    }
    // tray
    const rx = area.x + area.w + 26, rw = this.px + this.pw - 30 - rx;
    T(this, rx, cTop + 2, '회수한 손목뼈', 18, '#bfe6ff', { weight: '700' });
    const keys = Phaser.Utils.Array.Shuffle([...CARPALS.map(c => `car_${c}`), ...(adv ? ['dec_navicular', 'dec_cuboid'] : [])]);
    const cols = 2, rows = Math.ceil(keys.length / cols), cell = Math.min(rw / cols, (cBot - cTop - 30) / rows);
    let placed = 0;
    const spots: Record<string, { x: number; y: number }> = {};
    for (const c of CARPALS) spots[c] = pos(`car_${c}`);
    (this as unknown as { __spots: unknown }).__spots = spots;
    keys.forEach((key, i) => {
      const hx = rx + cell * (i % cols) + cell / 2, hy = cTop + 34 + cell * Math.floor(i / cols) + cell / 2;
      const im = this.add.image(hx, hy - (adv ? 0 : 8), `ch3_${key}`); const s0 = Math.min((cell - 20) / im.width, (cell - (adv ? 16 : 40)) / im.height, 1.3);
      im.setScale(s0).setDepth(20).setInteractive({ useHandCursor: true, draggable: true });
      if (!adv && key.startsWith('car_')) T(this, hx, hy + cell / 2 - 4, CARPAL[key.slice(4) as CarpalId].ko, 13, '#cfe8ff', { weight: '700', backgroundColor: '#0b1626cc', padding: { x: 3, y: 0 } }).setOrigin(0.5, 1).setDepth(19);
      let set = false;
      const home = () => this.tweens.add({ targets: im, x: hx, y: hy - (adv ? 0 : 8), scale: s0, duration: 220 });
      im.on('dragstart', () => { if (!set) this.tweens.add({ targets: im, scale: b.q / 2, duration: 120 }); });
      im.on('drag', (_p: Phaser.Input.Pointer, dx: number, dy: number) => { if (!set) im.setPosition(dx, dy); });
      im.on('dragend', () => {
        if (set) return;
        const inBox = im.x > b.bx && im.x < b.bx + b.w && im.y > b.by && im.y < b.by + b.h;
        if (!inBox) { home(); return; }
        if (key.startsWith('dec_')) { home(); Audio.play('error'); this.mistake(); G.run.stats.hasm++; this.setFeedback(key === 'dec_cuboid' ? '입방뼈(cuboid) — 발의 바깥쪽 발목뼈다. 손목뼈가 아니다.' : '발배뼈(navicular) — 발목뼈다. 손배뼈와 옛 이름이 같아 섞였다.', 'err'); return; }
        const id = key.slice(4) as CarpalId;
        const near = CARPALS.map(c => ({ c, d: Math.hypot(spots[c].x - im.x, spots[c].y - im.y) })).sort((a, z2) => a.d - z2.d)[0];
        const tol = Math.max(16, 7 * b.q);
        if (near.c === id && near.d < tol * 2.2) {
          set = true; placed++; im.disableInteractive(); Audio.play('snap');
          this.tweens.add({ targets: im, x: spots[id].x, y: spots[id].y, scale: b.q / 2, duration: 160 });
          if (placed === CARPALS.length) { this.setFeedback('손목뼈 8개가 모두 제자리에 맞물렸다!', 'ok'); this.success('c_carpal', '손목뼈 8개를 두 줄로 재조립했습니다'); }
          else this.setFeedback(`${CARPAL[id].ko} 고정 (${placed}/8)`, 'ok');
          return;
        }
        home(); Audio.play('error'); this.mistake(); G.run.stats.hasm++;
        this.setFeedback(adv ? '맞지 않는다.' : near.d < tol * 2.2 ? `그 자리는 ${CARPAL[near.c].ko}의 자리. ${CARPAL[id].ko}는 ${CARPAL[id].row}.` : `${CARPAL[id].ko}의 자리가 아니다. ${CARPAL[id].row}에서 찾아보세요.`, 'err');
      });
    });
    this.setFeedback(adv ? '오른손 손바닥 쪽(엄지 = 오른쪽). 아래가 노뼈·자뼈, 위가 손허리뼈.' : '아래가 팔(노뼈·자뼈), 위가 손가락 쪽. 엄지는 오른쪽입니다.', 'info');
  }
}

// ====================================================================================== LOCK 3: joint types
/** LOCK 3 — 관절 유형 판정: drag the type token onto each marked joint of the arm and the hand. */
export class JointPuzzle extends PuzzleBase {
  constructor() { super('HJoint'); }
  create() {
    this.initView();
    const adv = G.run.difficulty === 'adv', m = handManifest(this);
    this.frame('관절 시험 콘솔 · J-03', '관절 유형 칩을 끌어 번호가 붙은 관절에 놓으세요. 맞히면 그 관절의 운동축이 표시됩니다.', ACC);
    const { cTop, cBot } = this;
    const tokH = this.compact ? 44 : 54, tokY = cBot - tokH / 2;
    const top = cTop, bot = cBot - tokH - 14;
    const joints = neededJoints();
    // left: arm (CH1 bone renders, CH1 frame), right: hand (palmar, fingers up)
    const bm = boneModel() as any;
    const armW = { x: 170, y: 115, w: 380, h: 760 };
    const aw = this.pw * 0.27, hw = this.pw * 0.33;
    const A = fitRect(armW, this.px + 30, top, aw, bot - top);
    for (const id of ['clavicle', 'scapula', 'humerus', 'ulna', 'radius']) {
      const r = bm.rects[id]; if (!r || !this.textures.exists(`bone_bone_${id}`)) continue;
      const im = this.add.image(A.ox + r.x * A.q, A.oy + r.y * A.q, `bone_bone_${id}`).setOrigin(0).setScale(A.q / DENSITY);
      const cg = this.make.graphics({}); cg.fillStyle(0xffffff); cg.fillRect(A.bx, A.by, A.w, A.h); im.setMask(cg.createGeometryMask());
    }
    if (!this.compact) T(this, A.bx, A.by + A.h + 2, '오른팔 앞면', 13, C.dim);
    const H = m.frame; const handR = { x: 0, y: 0, w: H[0], h: H[1] * 0.86 };
    const Hb = fitRect(handR, this.px + 40 + aw, top, hw, bot - top);
    this.add.image(Hb.ox, Hb.oy, 'ch3_hand_full').setOrigin(0).setScale(Hb.q).setCrop(0, 0, handR.w, handR.h);
    if (!this.compact) T(this, Hb.bx, Hb.by + Hb.h + 2, '오른손 손바닥 쪽 (엄지 = 오른쪽)', 13, C.dim);
    const BP = (bone: string, name: string) => { const p = bonePoint(bone, name)!; const r = bm.rects[bone]; return { x: A.ox + (r.x + p[0] / 2) * A.q, y: A.oy + (r.y + p[1] / 2) * A.q }; };
    const HP = (k: string) => { const p = m.points[k]!; return { x: Hb.ox + p[0] * Hb.q, y: Hb.oy + p[1] * Hb.q }; };
    const mid = (a: { x: number; y: number }, c: { x: number; y: number }) => ({ x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 });
    const gl = bm.landmarks.glenoid, hd = bm.landmarks.head;
    const at: Record<string, { x: number; y: number }> = {
      shoulder: { x: A.ox + (gl[0] + hd[0]) / 2 * A.q, y: A.oy + (gl[1] + hd[1]) / 2 * A.q },
      elbow: mid(BP('ulna', 'coronoid'), { x: A.ox + bm.landmarks.elbow[0] * A.q, y: A.oy + bm.landmarks.elbow[1] * A.q }),
      pruj: BP('radius', 'head'),
      wrist: mid(HP('radius_scaphoid'), HP('radius_lunate')),
      cmc1: HP('mc1_trapezium'),
      intercarpal: HP('capitate_hamate'),
      mcp: HP('mcp2'), pip: HP('pip2'),
    };
    // info column
    const ix = Hb.bx + Hb.w + 24, iw = this.px + this.pw - 30 - ix;
    T(this, ix, top, '판정 목록', 18, '#bfe6ff', { weight: '700' });
    const rowsT: Record<string, Phaser.GameObjects.Text> = {};
    joints.forEach((j, i) => { rowsT[j.id] = T(this, ix, top + 34 + i * Math.min(46, (bot - top - 40) / joints.length), `${i + 1}. ${j.ko}`, 15, '#d3def3', { wordWrap: { width: iw }, lineSpacing: 2 }); });
    const marks: Record<string, { x: number; y: number; g: Phaser.GameObjects.Graphics; done: boolean; j: JointDef }> = {};
    // markers sit a little off the joint with a leader line where two joints are close
    const OFF: Record<string, [number, number]> = { elbow: [30, -6], pruj: [-30, 8], wrist: [0, 30], cmc1: [30, 10], intercarpal: [-30, -6], mcp: [26, 0], pip: [26, 0], shoulder: [0, 0] };
    joints.forEach((j, i) => {
      const p0 = at[j.id], o = OFF[j.id] ?? [0, 0]; const p = { x: p0.x + o[0], y: p0.y + o[1] };
      const ld = this.add.graphics().setDepth(7); ld.lineStyle(2, 0xffd34d, 0.9); ld.lineBetween(p0.x, p0.y, p.x, p.y); ld.fillStyle(0xffd34d, 1); ld.fillCircle(p0.x, p0.y, 3.5);
      const g = this.add.graphics().setDepth(8);
      g.fillStyle(0x0a1830, 0.85); g.fillCircle(p.x, p.y, 16); g.lineStyle(3, 0xffd34d, 1); g.strokeCircle(p.x, p.y, 16);
      T(this, p.x, p.y, String(i + 1), 15, '#ffffff', { weight: '900' }).setOrigin(0.5).setDepth(9);
      marks[j.id] = { x: p.x, y: p.y, g, done: false, j };
    });
    (this as unknown as { __marks: unknown }).__marks = marks;
    // tokens
    const types: JointType[] = ['ball', 'hinge', 'pivot', 'ellipsoid', 'saddle', 'plane'];
    const tw = (this.pw - 60 - 5 * 10) / 6;
    let left = joints.length;
    const tokPos: Record<string, { x: number; y: number }> = {};
    types.forEach((t, i) => {
      const x = this.px + 30 + i * (tw + 10) + tw / 2; tokPos[t] = { x, y: tokY };
      const c = this.add.container(x, tokY).setDepth(30);
      const g = this.add.graphics(); g.fillStyle(0x0b1a2e, 1); g.fillRoundedRect(-tw / 2, -tokH / 2, tw, tokH, 10); g.lineStyle(2, ACC, 0.9); g.strokeRoundedRect(-tw / 2, -tokH / 2, tw, tokH, 10);
      c.add(g); c.add(T(this, 0, adv ? 0 : -9, JTYPE_KO[t], 17, C.white, { weight: '800' }).setOrigin(0.5));
      if (!adv) c.add(T(this, 0, 13, JTYPE_SHAPE[t], 11, '#9fc3e6', { fine: true }).setOrigin(0.5));
      c.setSize(tw, tokH).setInteractive({ useHandCursor: true, draggable: true });
      c.on('drag', (_p: Phaser.Input.Pointer, dx: number, dy: number) => c.setPosition(dx, dy));
      c.on('dragend', () => {
        const hit = Object.values(marks).find(mk => !mk.done && Math.hypot(mk.x - c.x, mk.y - c.y) < 44);
        this.tweens.add({ targets: c, x, y: tokY, duration: 200 });
        if (!hit) return;
        if (hit.j.type !== t) {
          Audio.play('error'); this.mistake(); G.run.stats.joint++;
          this.setFeedback(adv ? `${hit.j.ko} — ${JTYPE_KO[t]}이 아니다.` : `${hit.j.ko} — ${JTYPE_KO[t]}이 아니다. 관절면 모양을 떠올려 보세요 (${JTYPE_KO[t]}: ${JTYPE_SHAPE[t]}).`, 'err');
          return;
        }
        hit.done = true; left--; Audio.play('snap');
        hit.g.clear(); hit.g.fillStyle(0x0d3a24, 0.95); hit.g.fillCircle(hit.x, hit.y, 16); hit.g.lineStyle(3, 0x3dffa2, 1); hit.g.strokeCircle(hit.x, hit.y, 16);
        rowsT[hit.j.id].setText(`${joints.indexOf(hit.j) + 1}. ${hit.j.ko} — ${JTYPE_KO[t]}`).setColor('#9fffd0');
        this.setFeedback(`${hit.j.ko} = ${JTYPE_KO[t]}. ${JTYPE_AXES[t]}. ${hit.j.note}`, 'ok');
        if (left === 0) this.success('c_joint', '관절면 모양으로 관절의 종류와 운동축을 판정했습니다', 2200);
      });
    });
    (this as unknown as { __tok: unknown }).__tok = tokPos;
    this.setFeedback(adv ? '8개 관절. 같은 유형이 두 번 나올 수 있습니다.' : '관절면의 모양을 떠올리세요. 칩 아래 작은 글씨가 모양 힌트입니다.', 'info');
  }
}
