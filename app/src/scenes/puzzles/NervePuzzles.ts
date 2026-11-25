import Phaser from 'phaser';
import { PuzzleBase } from './PuzzleBase';
import { Audio } from '../../core/audio';
import { G } from '../../game/state';
import { T, C, Button } from '../../ui/widgets';
import { NERVE, NerveId, CORES, NERVE_CREDIT, nerveName, SCAN_EN, SCAN_NOTE, scanQuestions5, cases5, SITE_KO, DECOY_NOTE, View5 } from '../../data/nerve';
import { nerveManifest, scan5, scanNear, fitRect, sp, regionAt5, Box } from '../../art/nerve';

const ACC = 0x7fd8ff;
const VIEW_KO: Record<string, string> = { aant: '팔 앞면 (가쪽 = 왼쪽)', apost: '팔 뒷면 (가쪽 = 오른쪽)', lant: '다리 앞면 (가쪽 = 왼쪽)', lpost: '다리 뒷면 (가쪽 = 오른쪽)' };
const VIEW_SHORT: Record<string, string> = { aant: '팔 앞면', apost: '팔 뒷면', lant: '다리 앞면', lpost: '다리 뒷면' };

/** lay plates of several views side by side, same mm scale, filling a box */
function plates(scene: PuzzleBase, keys: string[], x: number, y: number, w: number, h: number, gap = 18) {
  const m = nerveManifest(scene);
  // every plate gets the same screen height (the arm is shorter than the leg in mm, but would be tiny at a common scale)
  const R = keys.map(k => m.regions[k]);
  const sumA = R.reduce((s, r) => s + r.w / r.h, 0);
  const hh = Math.min(h, (w - gap * (keys.length - 1)) / sumA);
  const out: Record<string, Box> = {}; let cx = x + (w - (sumA * hh + gap * (keys.length - 1))) / 2;
  keys.forEach((k, i) => { const r = R[i]; const bw = r.w / r.h * hh; out[k] = fitRect(r, cx, y + (h - hh) / 2, bw, hh); cx += bw + gap; });
  return out;
}

// ====================================================================================== LOCK 1: nerve scanner
/** LOCK 1 — 신경 스캐너: find each requested nerve on the arm (front) and leg (front / back) plates.
 * Basic: three candidate nerves glow, numbered. Advanced: no candidates. Taps snap to the nearest visible nerve. */
export class NerveScanPuzzle extends PuzzleBase {
  constructor() { super('NScan'); }
  create() {
    this.initView();
    const adv = G.run.difficulty === 'adv', m = nerveManifest(this), sc = scan5(this);
    this.frame('신경 스캐너 · N-01', adv ? '요청한 신경을 그림에서 찾아 누르세요.' : '요청한 신경을 빛나는 후보 3개 중에서 골라 누르세요.', ACC);
    const { cTop, cBot } = this;
    const qs = scanQuestions5();
    const VS = ['aant', 'lant', 'lpost'] as const;
    const B = plates(this, VS.map(v => `${v}_full`), this.px + 24, cTop + 22, this.pw * 0.62, cBot - cTop - 30);
    const boards: Record<string, Box> = {}; VS.forEach(v => boards[v] = B[`${v}_full`]);
    const frameG: Record<string, Phaser.GameObjects.Graphics> = {};
    for (const v of VS) {
      const b = boards[v];
      const g = this.add.graphics(); g.fillStyle(0x060a10, 1); g.fillRoundedRect(b.bx - 5, b.by - 5, b.w + 10, b.h + 10, 8);
      regionAt5(this, m, `${v}_full`, b);
      frameG[v] = this.add.graphics().setDepth(8);
      T(this, b.bx + b.w / 2, cTop + 2, VIEW_SHORT[v], 14, '#bfeaff', { weight: '700' }).setOrigin(0.5, 0);
    }
    T(this, this.px + 26, cBot, NERVE_CREDIT, 11, '#9fb4c8', { fine: true }).setOrigin(0, 1).setDepth(40);
    const rx = this.px + this.pw * 0.62 + 44, rw = this.px + this.pw - 30 - rx;
    T(this, rx, cTop + 4, '스캔 요청', 19, '#bfeaff', { weight: '700' });
    const reqT = T(this, rx, cTop + 40, '', 22, C.white, { weight: '800', wordWrap: { width: rw }, lineSpacing: 6 });
    const subT = T(this, rx, cTop + 140, '', 16, '#dfe8f0', { wordWrap: { width: rw }, lineSpacing: 5 });
    const prog = T(this, rx, cBot - 10, '', 16, C.dim).setOrigin(0, 1);
    const at = (v: string, id: string) => { const c = sc.views[v].nerves[id]; const b = boards[v]; return { x: b.ox + c.x * b.q, y: b.oy + c.y * b.q }; };
    let i = 0, glow: Phaser.GameObjects.GameObject[] = [];
    const CC = [0x4fc8ff, 0xffd24a, 0xff6ad5];
    const ask = () => {
      glow.forEach(o => o.destroy()); glow = [];
      const Q = qs[i];
      reqT.setFontSize(Q.case ? 17 : 22).setText(Q.case ?? `${i + 1}. ${nerveName(Q.id)}${adv ? '' : `  (${SCAN_EN[Q.id] ?? ''})`}`);
      subT.setText(Q.case ? '그 신경을 그림에서 누르세요.' : adv ? '' : `${VIEW_SHORT[Q.view]} 그림 · ${Q.hint}`);
      prog.setText(`스캔 ${i}/${qs.length}`);
      for (const v of VS) { const b = boards[v], g = frameG[v]; g.clear(); if (!adv && v === Q.view) { g.lineStyle(3, 0xbfeaff, 0.9); g.strokeRoundedRect(b.bx - 5, b.by - 5, b.w + 10, b.h + 10, 8); } }
      const placed: { x: number; y: number }[] = [];
      if (!adv) Q.cands.forEach((id, n) => {
        const info = sc.views[Q.view].nerves[id]; if (!info) return;
        const r = info.rect, b = boards[Q.view], dn = sc.views[Q.view].density;
        const gl = this.add.image(b.ox + (r.x + r.w / 2) * b.q, b.oy + (r.y + r.h / 2) * b.q, `ch5_vis_${Q.view}_${id}`).setScale(b.q / dn).setTint(CC[n]).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.45).setDepth(6);
        this.tweens.add({ targets: gl, alpha: 0.85, duration: 700, yoyo: true, repeat: -1, delay: n * 230 });
        // badge on the anchor farthest from the badges already placed (nerves run side by side)
        const b2 = boards[Q.view];
        const opts = (info.anchors ?? [[info.x, info.y]]).map(([ax, ay]) => ({ x: b2.ox + ax * b2.q, y: b2.oy + ay * b2.q }));
        const score = (q: { x: number; y: number }) => placed.length ? Math.min(...placed.map(o => Math.hypot(o.x - q.x, o.y - q.y))) : -Math.abs(q.y - (b2.by + b2.h / 2)) * 0.01;
        const p = opts.reduce((best, q) => score(q) > score(best) ? q : best, opts[Math.floor(opts.length / 2)]);
        placed.push(p);
        const badge = this.add.circle(p.x, p.y, 13, CC[n], 0.95).setStrokeStyle(2.5, 0x060a10).setDepth(7);
        const t = T(this, p.x, p.y, String(n + 1), 15, '#ffffff', { weight: '900' }).setOrigin(0.5).setDepth(8).setStroke('#060a10', 4);
        glow.push(gl, badge, t);
      });
    };
    (this as unknown as { __s: unknown }).__s = { at: (id: string) => at(qs[i]?.view ?? 'aant', id), cur: () => qs[i]?.id, cands: () => qs[i]?.cands, view: () => qs[i]?.view };
    for (const v of VS) {
      const b = boards[v];
      const z = this.add.zone(b.bx, b.by, b.w, b.h).setOrigin(0).setInteractive({ useHandCursor: true });
      z.on('pointerup', (p: Phaser.Input.Pointer) => {
        if (this.solved || i >= qs.length) return;
        const wp = this.lp(p), Q = qs[i];
        const id = scanNear(sc, v, (wp.x - b.ox) / b.q, (wp.y - b.oy) / b.q, 8 / Math.max(0.3, b.q));
        if (v !== Q.view || id !== Q.id) {
          if (!adv && v === Q.view && id && !Q.cands.includes(id)) { this.setFeedback('빛나는 후보 1·2·3 중에서 고르세요.', 'warn'); return; }
          if (!id) { this.setFeedback('신경(노란 선)이 아닌 곳입니다. 노란 선 위를 누르세요.', 'warn'); return; }
          Audio.play('error'); this.mistake(); G.run.stats.scan = (G.run.stats.scan ?? 0) + 1;
          this.setFeedback(adv ? `${nerveName(id)}이다. 다시 보세요.` : `그건 ${nerveName(id)}. ${nerveName(Q.id)}: ${Q.hint}.`, 'err');
          return;
        }
        Audio.play('snap');
        const c = at(v, Q.id);
        const ring = this.add.circle(c.x, c.y, 12, 0x3dffa2, 0.5).setStrokeStyle(3, 0x3dffa2).setDepth(9);
        this.tweens.add({ targets: ring, scale: 2.4, alpha: 0, duration: 600, onComplete: () => ring.destroy() });
        const lt = T(this, c.x, c.y, nerveName(Q.id), 12, '#0b0806', { weight: '800', backgroundColor: '#ffe066dd', padding: { x: 3, y: 1 } }).setOrigin(0.5).setDepth(10);
        lt.x = Phaser.Math.Clamp(lt.x, b.bx + lt.width / 2 + 2, b.bx + b.w - lt.width / 2 - 2);
        const n = (NERVE as Record<string, { roots: string; motor: string }>)[Q.id];
        const msg = `${nerveName(Q.id)} 확인 — ${n ? `${n.roots} · ${n.motor}` : SCAN_NOTE[Q.id] ?? ''}`;
        i++;
        if (i >= qs.length) {
          glow.forEach(o => o.destroy()); glow = [];
          prog.setText(`스캔 ${i}/${qs.length}`); reqT.setFontSize(22).setText('스캔 완료');
          subT.setText('팔: 팔신경얼기(C5–T1) → 근육피부·겨드랑·노·정중·자신경\n다리: 허리신경얼기 → 넙다리·폐쇄신경 / 엉치신경얼기 → 궁둥신경 → 정강·온종아리신경');
          this.setFeedback(Q.case ? '자신경 — 안쪽위관절융기 뒤를 지난다("찌릿한 곳"). 스캔 완료!' : '스캔 완료! 팔다리의 주요 신경 위치를 확인했습니다.', 'ok');
          this.success('c_nscan', '팔다리의 주요 말초신경 경로를 찾았습니다', 2000);
        } else { this.setFeedback(msg, 'ok'); ask(); }
      });
    }
    ask();
    this.setFeedback(adv ? '오른팔·오른다리입니다. 앞면은 가쪽이 왼쪽, 뒷면은 가쪽이 오른쪽.' : '노란 선이 신경입니다(근육은 반투명). 빛나는 후보 중 하나를 누르세요.', 'info');
  }
}

// ====================================================================================== LOCK 2: re-wiring
/** LOCK 2 — 신경 재배선: drag the 8 recovered nerve cores onto the limb boards at their true course. */
export class NerveWirePuzzle extends PuzzleBase {
  constructor() { super('NWire'); }
  create() {
    this.initView();
    const adv = G.run.difficulty === 'adv', m = nerveManifest(this);
    this.frame('신경 재배선대 · N-01', adv ? '회수한 신경 코어를 네 판의 제자리에 놓으세요. 그림자 안내가 없습니다.' : '회수한 신경 코어를 끌어 제 판의 제자리에 놓으세요. 반투명 그림자가 자리입니다.', ACC);
    const { cTop, cBot } = this;
    const VS: View5[] = ['aant', 'apost', 'lant', 'lpost'];
    const B = plates(this, VS.map(v => `${v}_rest`), this.px + 20, cTop + 22, this.pw * 0.66, cBot - cTop - 30, 14);
    const boards: Record<string, Box> = {}; VS.forEach(v => boards[v] = B[`${v}_rest`]);
    for (const v of VS) {
      const b = boards[v];
      const g = this.add.graphics(); g.fillStyle(0x060a10, 1); g.fillRoundedRect(b.bx - 4, b.by - 4, b.w + 8, b.h + 8, 8);
      regionAt5(this, m, `${v}_rest`, b);
      T(this, b.bx + b.w / 2, cTop + 2, VIEW_SHORT[v], 13, '#bfeaff', { weight: '700' }).setOrigin(0.5, 0);
    }
    T(this, this.px + 22, cBot, NERVE_CREDIT, 11, '#9fb4c8', { fine: true }).setOrigin(0, 1).setDepth(40);
    const pos = (c: NerveId) => { const r = m.rects[`core_${c}`]; const b = boards[r.view]; return { x: b.ox + (r.x + r.w / 2) * b.q, y: b.oy + (r.y + r.h / 2) * b.q, s: b.q / r.density, view: r.view }; };
    if (!adv) for (const c of CORES) {
      const p = pos(c);
      const sh = this.add.image(p.x, p.y, `ch5_core_${c}`).setScale(p.s).setTintFill(0xbfeaff).setAlpha(0.5).setDepth(2);
      this.tweens.add({ targets: sh, alpha: 0.25, duration: 900, yoyo: true, repeat: -1 });
    }
    const rx = this.px + this.pw * 0.66 + 34, rw = this.px + this.pw - 30 - rx;
    T(this, rx, cTop + 2, '회수한 신경 코어', 18, '#bfeaff', { weight: '700' });
    const keys = Phaser.Utils.Array.Shuffle([...CORES]);
    const cols = 2, rows = Math.ceil(keys.length / cols), cell = Math.min(rw / cols, (cBot - cTop - 30) / rows);
    let placed = 0;
    const spots: Record<string, { x: number; y: number }> = {};
    for (const c of CORES) spots[c] = pos(c);
    (this as unknown as { __spots: unknown }).__spots = spots;
    keys.forEach((id, i) => {
      const hx = rx + cell * (i % cols) + cell / 2, hy = cTop + 30 + cell * Math.floor(i / cols) + cell / 2;
      const card = this.add.graphics().setDepth(18); card.fillStyle(0x0c1826, 0.95); card.fillRoundedRect(hx - cell / 2 + 4, hy - cell / 2 + 4, cell - 8, cell - 8, 8);
      card.lineStyle(1.5, 0x3a6a8a, 0.9); card.strokeRoundedRect(hx - cell / 2 + 4, hy - cell / 2 + 4, cell - 8, cell - 8, 8);
      const im = this.add.image(hx, hy - 6, `ch5_core_${id}`); const s0 = Math.min((cell - 16) / im.width, (cell - 34) / im.height, 1);
      im.setScale(s0).setDepth(20).setInteractive({ useHandCursor: true, draggable: true });
      T(this, hx, hy + cell / 2 - 4, NERVE[id].ko, 13, '#d8f0ff', { weight: '700', backgroundColor: '#060a10cc', padding: { x: 3, y: 0 } }).setOrigin(0.5, 1).setDepth(19);
      let set = false;
      const target = pos(id);
      const home = () => this.tweens.add({ targets: im, x: hx, y: hy - 6, scale: s0, duration: 220 });
      im.on('dragstart', () => { if (!set) { im.setDepth(30); this.tweens.add({ targets: im, scale: target.s, duration: 120 }); } });
      im.on('drag', (_p: Phaser.Input.Pointer, dx: number, dy: number) => { if (!set) im.setPosition(dx, dy); });
      im.on('dragend', () => {
        if (set) return;
        const onBoard = VS.find(v => { const b = boards[v]; return im.x > b.bx - 10 && im.x < b.bx + b.w + 10 && im.y > b.by && im.y < b.by + b.h; });
        if (!onBoard) { im.setDepth(20); home(); return; }
        const d = Math.hypot(target.x - im.x, target.y - im.y), tol = Math.max(36, boards[target.view].w * 0.3);
        if (onBoard === target.view && d < tol) {
          set = true; placed++; im.disableInteractive(); Audio.play('snap'); im.setDepth(5);
          this.tweens.add({ targets: im, x: target.x, y: target.y, scale: target.s, duration: 160 });
          if (placed === CORES.length) { this.setFeedback('신경 8개가 모두 제 경로에 연결됐다!', 'ok'); this.success('c_nwire', '팔다리의 주요 신경 8개를 제 경로에 다시 연결했습니다'); }
          else this.setFeedback(`${NERVE[id].ko} 연결 (${placed}/8) — ${NERVE[id].from}, ${NERVE[id].roots}`, 'ok');
          return;
        }
        im.setDepth(20); home(); Audio.play('error'); this.mistake(); G.run.stats.wire = (G.run.stats.wire ?? 0) + 1;
        this.setFeedback(adv ? '맞지 않는다.' : onBoard !== target.view ? `${NERVE[id].ko}은(는) ${VIEW_SHORT[target.view]} 판의 신경이다.` : `${NERVE[id].ko}의 경로가 아니다. ${NERVE[id].course}`, 'err');
      });
    });
    this.setFeedback(adv ? '오른팔(앞·뒤), 오른다리(앞·뒤). 앞면은 가쪽이 왼쪽입니다.' : '왼쪽부터 팔 앞면 · 팔 뒷면 · 다리 앞면 · 다리 뒷면. 코어를 그림자 위에 놓으세요.', 'info');
  }
}

// ====================================================================================== LOCK 3: lesion clinic
const REGION_KEY: Record<string, string> = { hum: 'hum_close', hand: 'hand_close', knee: 'knee_close', full: 'lant_full' };
/** LOCK 3 — 손상 진단: read the case, name the injured nerve, then mark where it was injured on the model. */
export class NerveCasePuzzle extends PuzzleBase {
  constructor() { super('NCase'); }
  create() {
    this.initView();
    const adv = G.run.difficulty === 'adv', m = nerveManifest(this);
    this.frame('손상 진단 콘솔 · N-03', '증례를 읽고 다친 신경을 고른 뒤, 모델에서 손상 자리를 표시하세요.', ACC);
    const { cTop, cBot } = this;
    const list = cases5();
    const lw = this.pw * 0.44, lx = this.px + 30;
    const titleT = T(this, lx, cTop + 6, '', 20, '#bfeaff', { weight: '800', wordWrap: { width: lw } });
    const storyT = T(this, lx, cTop + 44, '', 17, '#e8eef4', { wordWrap: { width: lw }, lineSpacing: 6 });
    const stepT = T(this, lx, cTop + 170, '', 16, '#ffe066', { weight: '700', wordWrap: { width: lw } });
    const bx = this.px + 50 + lw, bw = this.px + this.pw - 30 - bx;
    let k = 0, phase: 'nerve' | 'site' | 'wait' = 'nerve';
    let objs: Phaser.GameObjects.GameObject[] = [];
    const clear = () => { objs.forEach(o => o.destroy()); objs = []; };
    const showCase = () => {
      clear(); phase = 'nerve';
      const c = list[k];
      titleT.setText(`증례 ${k + 1}/${list.length} · ${adv ? '' : c.title}`.replace(/ · $/, ''));
      storyT.setText(c.story);
      stepT.setText('① 다친 신경은?');
      const opts = Phaser.Utils.Array.Shuffle([...c.opts]);
      const top = cTop + 206, bh = Math.min(54, (cBot - top - 10) / opts.length - 10);
      opts.forEach((n, i) => objs.push(new Button(this, lx + lw / 2, top + bh / 2 + i * (bh + 10), `${NERVE[n].ko}  (${NERVE[n].roots})`, () => pickNerve(n), { w: lw, h: bh, size: 17 })));
      // right: the plate where the site will be marked (shown dimmed until the nerve is named)
      const ph = T(this, bx + bw / 2, cTop + (cBot - cTop) / 2, '신경을 고르면\n손상 자리 표시 화면이 열립니다', 17, C.dim, { align: 'center' }).setOrigin(0.5);
      objs.push(ph);
      (this as unknown as { __c: unknown }).__c = { k, phase: () => phase, nerve: c.nerve, site: c.site?.key };
    };
    const pickNerve = (n: NerveId) => {
      if (this.solved || phase !== 'nerve') return;
      const c = list[k];
      if (n !== c.nerve) {
        Audio.play('error'); this.mistake(); G.run.stats.case = (G.run.stats.case ?? 0) + 1;
        this.setFeedback(adv ? `${NERVE[n].ko}의 손상 양상이 아니다.` : `${NERVE[n].ko}: ${NERVE[n].injury}`, 'err');
        return;
      }
      Audio.play('snap');
      this.setFeedback(`${NERVE[n].ko} — ${NERVE[n].motor}`, 'ok');
      if (!c.site) { next(); return; }
      phase = 'site'; clear();
      stepT.setText(`② ${NERVE[n].ko}이(가) 다친 자리를 표시하세요.`);
      const reg = REGION_KEY[c.site.region]; const r = m.regions[reg];
      const rr = c.site.region === 'full' ? { x: r.x, y: r.y, w: r.w, h: r.h * 0.6 } : r;
      const b = fitRect(rr, bx, cTop + 10, bw, cBot - cTop - 20);
      const bg = this.add.graphics(); bg.fillStyle(0x060a10, 1); bg.fillRect(b.bx, b.by, b.w, b.h); objs.push(bg);
      const im = regionAt5(this, m, reg, b); objs.push(im);
      const mk = this.make.graphics({}); mk.fillStyle(0xffffff); mk.fillRect(b.bx, b.by, b.w, b.h); im.setMask(mk.createGeometryMask());
      objs.push(T(this, b.bx + 6, b.by + 4, VIEW_KO[c.site.view], 13, '#d8f0ff', { weight: '700', backgroundColor: '#060a10cc', padding: { x: 4, y: 2 } }).setDepth(30));
      const ids = Phaser.Utils.Array.Shuffle([c.site.key, ...c.site.decoys]);
      const marks: Record<string, { x: number; y: number }> = {};
      ids.forEach((id, i) => {
        const p = sp(b, m.points[c.site!.view][id]); marks[id] = p;
        const ci = this.add.circle(p.x, p.y, 17, 0x7fd8ff, 0.22).setStrokeStyle(3, 0xbfeaff, 1).setDepth(40).setInteractive({ useHandCursor: true });
        const t = T(this, p.x, p.y, String.fromCharCode(65 + i), 15, '#ffffff', { weight: '900' }).setOrigin(0.5).setDepth(41).setStroke('#06121c', 4);
        this.tweens.add({ targets: ci, scale: 1.15, duration: 600, yoyo: true, repeat: -1 });
        ci.on('pointerup', () => pickSite(id));
        objs.push(ci, t);
        if (!adv) objs.push(T(this, p.x + 22, p.y, SITE_KO[id] ?? '', 12, '#d8f0ff', { weight: '700', backgroundColor: '#060a10cc', padding: { x: 3, y: 1 } }).setOrigin(0, 0.5).setDepth(41));
      });
      (this as unknown as { __marks: unknown }).__marks = marks;
    };
    const pickSite = (id: string) => {
      if (this.solved || phase !== 'site') return;
      const c = list[k];
      if (id !== c.site!.key) {
        Audio.play('error'); this.mistake(); G.run.stats.case = (G.run.stats.case ?? 0) + 1;
        this.setFeedback(adv ? '그 자리가 아니다.' : DECOY_NOTE[id] ?? '그 자리가 아니다.', 'err'); return;
      }
      Audio.play('snap');
      this.setFeedback(c.why, 'ok');
      next();
    };
    const next = () => {
      k++; phase = 'wait';   // ignore taps on the old case until the next one is shown
      if (k >= list.length) {
        clear(); titleT.setText('진단 완료'); storyT.setText('모든 증례의 손상 신경과 자리를 찾았습니다.'); stepT.setText('');
        this.success('c_nlesion', '말초신경 손상의 증상과 손상 자리를 연결했습니다', 2600);
      } else this.time.delayedCall(2200, showCase);
    };
    showCase();
    this.setFeedback(adv ? '증상(운동·감각)으로 신경을, 해부 경로로 자리를 찾으세요.' : '증상에 맞는 신경을 고르세요. 틀린 신경을 고르면 그 신경의 손상 양상을 알려 줍니다.', 'info');
  }
}
