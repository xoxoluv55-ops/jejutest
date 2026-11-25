import Phaser from 'phaser';
import { PuzzleBase } from './PuzzleBase';
import { Audio } from '../../core/audio';
import { G } from '../../game/state';
import { T, C, Button } from '../../ui/widgets';
import { CORE, CORES, CoreId, HIP_CREDIT, THIGH, SECTION_EXTRA, COMP_COL, COMP_KO, COMP_NERVE, sectionTargets, SECTION_CASE, GAIT, gaitCards, Role4, RIG_KO } from '../../data/hip';
import { hipManifest, sectionManifest, sectionLabel, fitRect, regionAt, Rig } from '../../art/hip';

const ACC = 0xffb870;
const nameOf = (id: string) => THIGH[id]?.ko ?? SECTION_EXTRA[id] ?? id;
const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');

// ====================================================================================== LOCK 1: cross-section
const WHERE: Record<string, string> = {
  rf: '앞칸 한가운데 맨 앞, 중간넓은근 위에 얹힌 근육',
  vl: '가쪽(왼쪽)을 덮는 가장 큰 근육',
  vi: '넙다리뼈 앞을 바로 감싸는 근육',
  vm: '앞칸 안쪽(오른쪽) 아래',
  sartorius: '앞 안쪽(오른쪽 위)의 가늘고 납작한 띠 모양 근육',
  gracilis: '안쪽칸 가장 안쪽(오른쪽 가장자리)의 가는 근육',
  am: '안쪽칸 뒤쪽의 큰 근육',
  al: '안쪽칸 앞쪽',
  bfl: '뒤칸 가쪽(왼쪽 아래)의 큰 근육',
  sm: '뒤칸 안쪽(오른쪽 아래), 반힘줄근 아래',
  st: '뒤칸 안쪽, 반막근 위',
};
/** LOCK 1 — 넙다리 단면 판독: find each named muscle on a cross-section computed from the model. */
export class HipSectionPuzzle extends PuzzleBase {
  constructor() { super('HSection'); }
  create() {
    this.initView();
    const adv = G.run.difficulty === 'adv', s = sectionManifest(this);
    this.frame('넙다리 단면 판독기 · H-01', adv ? '판독 요청에 맞는 근육을 단면에서 누르세요.' : '판독 요청의 근육을 단면에서 찾아 누르세요. 앞 = 위, 가쪽 = 왼쪽입니다.', ACC);
    const { cTop, cBot } = this;
    const area = { x: this.px + 30, y: cTop, w: this.pw * 0.56, h: cBot - cTop };
    const img = this.add.image(0, 0, 'ch4_section');
    const q = Math.min((area.w - 120) / img.width, (area.h - 70) / img.height);
    img.setScale(q).setPosition(area.x + area.w / 2, area.y + area.h / 2);
    const x0 = img.x - img.displayWidth / 2, y0 = img.y - img.displayHeight / 2, k = q * s.pxPerMm;
    const bg = this.add.graphics().setDepth(-1); bg.fillStyle(0x0b0806, 1); bg.fillRoundedRect(x0 - 26, y0 - 26, img.displayWidth + 52, img.displayHeight + 52, 10);
    bg.lineStyle(2, 0xffc890, 0.5); bg.strokeRoundedRect(x0 - 26, y0 - 26, img.displayWidth + 52, img.displayHeight + 52, 10);
    const lab = { weight: '800', backgroundColor: '#000000aa', padding: { x: 4, y: 1 } } as const;
    T(this, img.x, y0 - 24, '앞 (A)', 14, '#ffe0c0', lab).setOrigin(0.5, 0.5);
    T(this, img.x, y0 + img.displayHeight + 24, '뒤 (P)', 14, '#ffe0c0', lab).setOrigin(0.5, 0.5);
    T(this, x0 - 30, img.y, '가쪽', 14, '#ffe0c0', lab).setOrigin(1, 0.5);
    T(this, x0 + img.displayWidth + 30, img.y, '안쪽', 14, '#ffe0c0', lab).setOrigin(0, 0.5);
    T(this, x0 - 14, y0 - 14, 'R', 26, '#f2f5f9', { weight: '900' });
    T(this, area.x + 4, cBot, HIP_CREDIT, 11, '#a89c8a', { fine: true }).setOrigin(0, 1);
    const targets = sectionTargets();
    const rx = area.x + area.w + 26, rw = this.px + this.pw - 30 - rx;
    T(this, rx, cTop + 4, '판독 요청', 19, '#ffd6a0', { weight: '700' });
    const reqT = T(this, rx, cTop + 40, '', 22, C.white, { weight: '800', wordWrap: { width: rw }, lineSpacing: 6 });
    const subT = T(this, rx, cTop + 120, '', 16, '#e3dccf', { wordWrap: { width: rw }, lineSpacing: 5 });
    const prog = T(this, rx, cBot - 10, '', 16, C.dim).setOrigin(0, 1);
    T(this, rx, cBot - 40, `모의 단면 — 3D 모델을 높이 ${s.z} mm(넙다리 중간)에서 자른 면. 피부·지방·혈관·신경은 모델에 없어 생략. 실제 환자 영상이 아닙니다.`, 12, '#b8ad9c', { fine: true, wordWrap: { width: rw }, lineSpacing: 2 }).setOrigin(0, 1);
    let i = 0;
    const isCase = () => adv && i === targets.length - 1;
    const ask = () => {
      const id = targets[i];
      reqT.setText(isCase() ? SECTION_CASE : `${i + 1}. ${nameOf(id)}${adv ? '' : `  (${THIGH[id].en})`}`);
      subT.setText(isCase() ? '그 근육을 단면에서 누르세요.' : adv ? '' : `${COMP_KO[THIGH[id].comp]} · ${WHERE[id] ?? ''}`);
      prog.setText(`판독 ${i}/${targets.length}`);
      reqT.setFontSize(isCase() ? 17 : 22);
    };
    const at = (id: string) => { const c = s.centre[id]; return { x: x0 + c.x * k, y: y0 + c.y * k }; };
    (this as unknown as { __s: unknown }).__s = { at, cur: () => targets[i] };
    const z = this.add.zone(x0, y0, img.displayWidth, img.displayHeight).setOrigin(0).setInteractive({ useHandCursor: true });
    z.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (this.solved || i >= targets.length) return;
      const wp = this.lp(p); const id = sectionLabel(s, (wp.x - x0) / k, (wp.y - y0) / k);
      const want = targets[i];
      if (id !== want) {
        Audio.play('error'); this.mistake(); G.run.stats.sect++;
        this.setFeedback(!id ? '근육이 없는 곳입니다. 단면의 근육 위를 누르세요.' : adv ? `${nameOf(id)}이다. 다시 보세요.` : `그건 ${nameOf(id)}. ${nameOf(want)}: ${WHERE[want]}.`, 'err');
        return;
      }
      Audio.play('snap');
      const c = at(want), comp = THIGH[want].comp;
      const ring = this.add.circle(c.x, c.y, 12, COMP_COL[comp], 0.5).setStrokeStyle(3, COMP_COL[comp]);
      this.tweens.add({ targets: ring, scale: 2.4, alpha: 0, duration: 600, onComplete: () => ring.destroy() });
      T(this, c.x, c.y, nameOf(want).replace('넙다리두갈래근 ', '두갈래 '), 12, '#0b0806', { weight: '800', backgroundColor: hex(COMP_COL[comp]) + 'dd', padding: { x: 3, y: 1 } }).setOrigin(0.5).setDepth(6);
      const was = isCase(); i++;
      if (i >= targets.length) {
        prog.setText(`판독 ${i}/${targets.length}`); reqT.setFontSize(22).setText('판독 완료'); subT.setText('');
        // show every muscle with its compartment colour
        for (const [m, cc] of Object.entries(s.centre)) {
          const t = THIGH[m]; if (!t || targets.includes(m) || cc.area < 20) continue;
          T(this, x0 + cc.x * k, y0 + cc.y * k, t.ko.replace('넙다리두갈래근 ', '두갈래 '), 11, '#0b0806', { weight: '700', backgroundColor: hex(COMP_COL[t.comp]) + '99', padding: { x: 2, y: 0 } }).setOrigin(0.5).setDepth(6);
        }
        subT.setText(`파랑 = 앞칸 (${COMP_NERVE.ant})\n초록 = 안쪽칸 (${COMP_NERVE.med})\n주황 = 뒤칸 (${COMP_NERVE.post})`);
        this.setFeedback(was ? '넙다리두갈래근 긴갈래 — 달리기 중 가장 흔히 다치는 뒤넙다리근. 판독 완료!' : '판독 완료! 넙다리의 세 칸이 표시됩니다.', 'ok');
        this.success('c_section', '넙다리 단면에서 근육과 세 칸을 구별했습니다', 2200);
      } else { this.setFeedback(`${nameOf(want)} 확인 — ${COMP_KO[comp]}.`, 'ok'); ask(); }
    });
    ask();
    this.setFeedback(adv ? '오른쪽 넙다리 중간 높이, 아래에서 본 단면입니다 (CT와 같은 방향).' : '아래(발 쪽)에서 본 오른쪽 넙다리 단면: 앞이 위, 가쪽이 왼쪽입니다. 가운데 흰 고리가 넙다리뼈.', 'info');
  }
}

// ====================================================================================== LOCK 2: muscle re-assembly
const ORDER_DEPTH: Record<CoreId, number> = { iliopsoas: 1, rf: 2, gracilis: 2, sartorius: 3, gmed: 1, gmax: 2, bf: 2, st: 2 };
/** LOCK 2 — 근육 재배치: drag the 8 recovered cores onto the skeleton boards (anterior and posterior views). */
export class HipMusclePuzzle extends PuzzleBase {
  constructor() { super('HMuscles'); }
  create() {
    this.initView();
    const adv = G.run.difficulty === 'adv', m = hipManifest(this);
    this.frame('근육 재배치대 · H-01', adv ? '회수한 근육 코어를 앞면·뒷면 골격의 제자리에 놓으세요. 다른 부위의 근육이 섞여 있습니다.' : '회수한 근육 코어를 끌어 앞면(왼쪽)·뒷면(오른쪽) 골격의 제자리에 놓으세요. 반투명 그림자가 자리입니다.', ACC);
    const { cTop, cBot } = this;
    const R = m.regions.ant_full;
    const bw = Math.min((this.pw * 0.6 - 20) / 2, (cBot - cTop - 26) * R.w / R.h);
    const boards: Record<'ant' | 'post', ReturnType<typeof fitRect>> = {
      ant: fitRect(R, this.px + 30, cTop + 22, bw, cBot - cTop - 26),
      post: fitRect(m.regions.post_full, this.px + 50 + bw, cTop + 22, bw, cBot - cTop - 26),
    };
    for (const v of ['ant', 'post'] as const) {
      const b = boards[v];
      const g = this.add.graphics(); g.fillStyle(0x140d08, 1); g.fillRoundedRect(b.bx - 6, b.by - 6, b.w + 12, b.h + 12, 8);
      regionAt(this, m, `${v}_rest`, b);
      T(this, b.bx + b.w / 2, cTop + 2, v === 'ant' ? '앞면 (가쪽 = 왼쪽)' : '뒷면 (가쪽 = 오른쪽)', 14, '#ffd6a0', { weight: '700' }).setOrigin(0.5, 0);
    }
    T(this, this.px + 32, cBot, HIP_CREDIT, 11, '#a89c8a', { fine: true }).setOrigin(0, 1).setDepth(40);
    const pos = (c: CoreId) => { const r = m.rects[`core_${c}`]; const b = boards[CORE[c].view]; return { x: b.ox + (r.x + r.w / 2) * b.q, y: b.oy + (r.y + r.h / 2) * b.q, s: b.q / r.density }; };
    if (!adv) for (const c of CORES) { const p = pos(c); this.add.image(p.x, p.y, `ch4_core_${c}`).setScale(p.s).setTintFill(0x8a5a3a).setAlpha(0.3).setDepth(ORDER_DEPTH[c]); }
    const rx = this.px + 70 + bw * 2, rw = this.px + this.pw - 30 - rx;
    T(this, rx, cTop + 2, '회수한 근육 코어', 18, '#ffd6a0', { weight: '700' });
    const keys: string[] = Phaser.Utils.Array.Shuffle([...CORES.map(c => `core_${c}`), ...(adv ? ['dec_biceps', 'dec_deltoid'] : [])]);
    const cols = 2, rows = Math.ceil(keys.length / cols), cell = Math.min(rw / cols, (cBot - cTop - 30) / rows);
    let placed = 0;
    const spots: Record<string, { x: number; y: number }> = {};
    for (const c of CORES) spots[c] = pos(c);
    (this as unknown as { __spots: unknown }).__spots = spots;
    keys.forEach((key, i) => {
      const hx = rx + cell * (i % cols) + cell / 2, hy = cTop + 30 + cell * Math.floor(i / cols) + cell / 2;
      const tex = key.startsWith('dec_') ? `mus_real_${key.slice(4)}` : `ch4_${key}`;
      const im = this.add.image(hx, hy - (adv ? 0 : 6), tex); const s0 = Math.min((cell - 16) / im.width, (cell - (adv ? 14 : 34)) / im.height, 1);
      im.setScale(s0).setDepth(20).setInteractive({ useHandCursor: true, draggable: true });
      if (!adv && key.startsWith('core_')) T(this, hx, hy + cell / 2 - 4, CORE[key.slice(5) as CoreId].ko, 13, '#ffe0c0', { weight: '700', backgroundColor: '#140d08cc', padding: { x: 3, y: 0 } }).setOrigin(0.5, 1).setDepth(19);
      let set = false;
      const home = () => this.tweens.add({ targets: im, x: hx, y: hy - (adv ? 0 : 6), scale: s0, duration: 220 });
      const target = key.startsWith('core_') ? pos(key.slice(5) as CoreId) : null;
      im.on('dragstart', () => { if (!set) { im.setDepth(30); if (target) this.tweens.add({ targets: im, scale: target.s, duration: 120 }); } });
      im.on('drag', (_p: Phaser.Input.Pointer, dx: number, dy: number) => { if (!set) im.setPosition(dx, dy); });
      im.on('dragend', () => {
        if (set) return;
        const onBoard = (['ant', 'post'] as const).find(v => { const b = boards[v]; return im.x > b.bx && im.x < b.bx + b.w && im.y > b.by && im.y < b.by + b.h; });
        if (!onBoard) { im.setDepth(20); home(); return; }
        if (key.startsWith('dec_')) {
          im.setDepth(20); home(); Audio.play('error'); this.mistake(); G.run.stats.mus++;
          this.setFeedback(key === 'dec_biceps' ? '위팔두갈래근 — 팔의 근육이다. 이름이 비슷한 넙다리두갈래근과 헷갈리지 말 것.' : '어깨세모근 — 어깨를 덮는 팔의 근육이다. 볼기 근육이 아니다.', 'err');
          return;
        }
        const id = key.slice(5) as CoreId, want = spots[id];
        const d = Math.hypot(want.x - im.x, want.y - im.y), tol = Math.max(40, boards.ant.w * 0.22);
        if (onBoard === CORE[id].view && d < tol) {
          set = true; placed++; im.disableInteractive(); Audio.play('snap'); im.setDepth(ORDER_DEPTH[id]);
          this.tweens.add({ targets: im, x: want.x, y: want.y, scale: target!.s, duration: 160 });
          if (placed === CORES.length) { this.setFeedback('근육 8개가 모두 골격 위 제자리에 붙었다!', 'ok'); this.success('c_hipmus', '엉덩이·넙다리 근육 8개를 제자리에 배치했습니다'); }
          else this.setFeedback(`${CORE[id].ko} 배치 (${placed}/8) — ${CORE[id].region}`, 'ok');
          return;
        }
        im.setDepth(20); home(); Audio.play('error'); this.mistake(); G.run.stats.mus++;
        this.setFeedback(adv ? '맞지 않는다.' : onBoard !== CORE[id].view ? `${CORE[id].ko}은(는) ${CORE[id].view === 'ant' ? '앞면' : '뒷면'}에서 보이는 근육이다.` : `${CORE[id].ko}의 자리가 아니다. ${CORE[id].region}.`, 'err');
      });
    });
    this.setFeedback(adv ? '오른쪽 골반과 넙다리. 앞면은 가쪽이 왼쪽, 뒷면은 가쪽이 오른쪽입니다.' : '왼쪽 판 = 앞에서 본 모습, 오른쪽 판 = 뒤에서 본 모습. 깊은 근육부터 놓으면 겹침이 자연스럽습니다.', 'info');
  }
}

// ====================================================================================== LOCK 3: gait rig roles
const ROLE_KO: Record<Role4, string> = { agonist: '주작용근', antagonist: '대항근', none: '관여 안 함' };
/** LOCK 3 — 보행 재현: assign each muscle's role for a movement, then the rig plays it (cables shorten / lengthen). */
export class HipGaitPuzzle extends PuzzleBase {
  constructor() { super('HGait'); }
  create() {
    this.initView();
    const adv = G.run.difficulty === 'adv', m = hipManifest(this);
    this.frame('보행 재현 콘솔 · H-03', '움직임마다 각 근육의 역할을 정한 뒤 [재현]을 누르세요.', ACC);
    const { cTop, cBot } = this;
    const L = { x: this.px + 30, y: cTop, w: this.pw * 0.42, h: cBot - cTop };
    const rx = L.x + L.w + 24, rw = this.px + this.pw - 30 - rx;
    let r = 0;
    let objs: Phaser.GameObjects.GameObject[] = [];
    let rig: Rig | null = null;
    const head = T(this, rx, cTop + 2, '', 20, '#ffd6a0', { weight: '800' });
    const sceneT = T(this, rx, cTop + 32, '', 15, '#e3dccf', { wordWrap: { width: rw } });
    const build = () => {
      objs.forEach(o => o.destroy()); objs = []; for (const k in segs) delete segs[k];
      const R = GAIT[r];
      head.setText(`${r + 1}/${GAIT.length} · ${R.ko}`); sceneT.setText(R.scene);
      const P = m.points[R.plane];
      const box = R.plane === 'lat' ? { x: P.hipC[0] - 480, y: P.hipC[1] - 330, w: 860, h: 1090 } : { x: -250, y: 0, w: 540, h: 860 };
      const b = fitRect(box, L.x, L.y, L.w, L.h);
      const bg = this.add.graphics(); bg.fillStyle(0x140d08, 1); bg.fillRoundedRect(b.bx, b.by, b.w, b.h, 8); objs.push(bg);
      const c = this.add.container(0, 0); objs.push(c);
      const mg = this.make.graphics({}); mg.fillStyle(0xffffff); mg.fillRect(b.bx, b.by, b.w, b.h); c.setMask(mg.createGeometryMask());
      rig = new Rig(this, m, R.plane, b, c);
      if (R.plane === 'lat') rig.pose(R.start.hip, R.start.knee); else rig.pose(0, 0, 0);
      const cards = gaitCards(R);
      for (const id of cards) rig.cables[id] = 'idle';
      rig.draw();
      objs.push(T(this, b.bx + 8, b.by + 6, R.plane === 'lat' ? '가쪽에서 본 오른다리 (앞 = 오른쪽)' : '앞에서 본 오른다리 (가쪽 = 왼쪽)', 13, '#ffe0c0', { weight: '700', backgroundColor: '#140d08cc', padding: { x: 4, y: 2 } }).setDepth(30));
      objs.push(T(this, b.bx + 6, b.by + b.h - 4, HIP_CREDIT, 11, '#a89c8a', { fine: true }).setOrigin(0, 1).setDepth(30));
      // role rows
      const top = cTop + 70, rowH = Math.min(62, (cBot - top - 70) / cards.length);
      const choice: Record<string, Role4 | null> = {};
      const segW = (rw - 150) / 3;
      cards.forEach((id, i) => {
        choice[id] = null;
        const y = top + i * rowH + rowH / 2;
        objs.push(T(this, rx, y, RIG_KO[id], 17, C.white, { weight: '700' }).setOrigin(0, 0.5));
        (['agonist', 'antagonist', 'none'] as Role4[]).forEach((role, j) => {
          const bx = rx + 150 + j * segW + segW / 2;
          const btn = new Button(this, bx, y, ROLE_KO[role], () => {
            choice[id] = role; Audio.play('click');
            segs[id].forEach((s, jj) => { s.o.primary = jj === j; s.o.accent = jj === j ? (role === 'agonist' ? 0xff5a3c : role === 'antagonist' ? 0x5fb4ff : 0xb8a898) : undefined; s.redraw(); });
          }, { w: segW - 8, h: rowH - 12, size: 15 });
          objs.push(btn);
          (segs[id] ??= []).push(btn);
        });
      });
      const doGo = () => {
        if (this.solved || busy) return;
        const miss = cards.find(id => choice[id] === null);
        if (miss) { this.setFeedback(`${RIG_KO[miss]}의 역할을 정하세요.`, 'warn'); return; }
        const bad = cards.find(id => choice[id] !== R.roles[id]);
        if (bad) {
          Audio.play('error'); this.mistake(); G.run.stats.gait++;
          this.setFeedback(adv ? `${RIG_KO[bad]}의 역할이 틀렸다.` : R.why[bad], 'err');
          return;
        }
        busy = true; Audio.play('snap');
        this.setFeedback(`${R.ko}: 빨강 = 짧아지는 주작용근, 파랑 점선 = 늘어나는 대항근.`, 'ok');
        const to = R.plane === 'lat' ? { hip: R.start.hip + (R.motion.hip ?? 0), knee: R.start.knee + (R.motion.knee ?? 0) } : { abd: R.motion.abd ?? 0 };
        rig!.animate(to, 1500, () => this.time.delayedCall(1200, () => {
          busy = false; r++;
          if (r >= GAIT.length) {
            this.setFeedback('세 가지 움직임을 모두 재현했다! 보행 데이터 복구 완료.', 'ok');
            this.success('c_twojoint', '엉덩관절·무릎의 주작용근과 대항근을 구별했습니다');
          } else { build(); this.setFeedback('다음 움직임입니다.', 'info'); }
        }));
      };
      const go = new Button(this, rx + rw / 2, cBot - 28, '재현', doGo, { w: Math.min(260, rw), h: 50, icon: 'play', accent: C.green, primary: true });
      objs.push(go);
      (this as unknown as { __g: unknown }).__g = { round: () => r, set: (id: string, role: Role4) => { choice[id] = role; }, go: doGo, busy: () => busy, cards: () => cards };
    };
    let busy = false;
    const segs: Record<string, Button[]> = {};
    build();
    this.setFeedback('주작용근 = 그 움직임을 만드는 근육, 대항근 = 반대 작용을 하는 근육(늘어난다), 관여 안 함 = 그 관절을 지나지 않는 근육.', 'info');
    void CORES;
  }
}
