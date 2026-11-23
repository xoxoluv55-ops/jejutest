import Phaser from 'phaser';
import { InvestBase, Overlay } from './InvestBase';
import { Audio } from '../../core/audio';
import { G } from '../../game/state';
import { T, C, Button } from '../../ui/widgets';
import { boneModel, bonePoint } from '../../art/bones';
import { posterNums, Joint, JOINTS, JOINT_KO, JOINT_RIDDLE, SAFE_ORDER, SAFE_DIRS, DIAL_N } from '../../data/escape';

/** poster window in the anatomy frame (frame units): right shoulder girdle, anterior */
const WIN = { x: 190, y: 70, w: 520, h: 380 };
/** badge offset from each joint (display px at poster scale 1), so the numbers never cover each other */
const BADGE: Record<Joint, [number, number]> = { sc: [34, -46], ac: [-56, -40], gh: [-70, 28], coracoid: [56, 40] };

/**
 * S-04 clavicle (L-06 wall safe).
 *  poster (J-03): an anatomy poster of the shoulder girdle, made from the real model (ribs/sternum, clavicle, scapula,
 *          humerus in their measured positions) with a two-digit number at four places; one corner is coming loose —
 *          peel it to find the dial rule written on the wall behind
 *  safe (L-06): brass plate = three joints described in words; rotary dial (drag around it, or step buttons):
 *          right to the 1st number, left to the 2nd, right to the 3rd, then pull the handle
 */
export class InvClavicleScene extends InvestBase {
  constructor() { super('InvClavicle'); }
  clueIds = ['poster', 'poster_wall', 'safe_plate'];

  build(kind: string) { if (kind === 'poster') this.buildPoster(); else this.buildSafe(); }

  /** draws the poster (model composite + numbered joints) into a container; returns its size */
  drawPoster(parent: Phaser.GameObjects.Container, x: number, y: number, w: number, numbers = true) {
    const q = w / WIN.w, h = WIN.h * q;
    const bg = this.add.graphics(); bg.fillStyle(0x0d1a2a, 1); bg.fillRect(x, y, w, h); parent.add(bg);
    const m = boneModel();
    const layer = (key: string, r: { x: number; y: number; w: number; h: number }, tint?: number) => {
      if (!this.textures.exists(key)) return;
      const x0 = Math.max(r.x, WIN.x), y0 = Math.max(r.y, WIN.y), x1 = Math.min(r.x + r.w, WIN.x + WIN.w), y1 = Math.min(r.y + r.h, WIN.y + WIN.h);
      if (x1 <= x0 || y1 <= y0) return;
      const im = this.add.image(x + (r.x - WIN.x) * q, y + (r.y - WIN.y) * q, key).setOrigin(0).setScale(q / 2);
      im.setCrop((x0 - r.x) * 2, (y0 - r.y) * 2, (x1 - x0) * 2, (y1 - y0) * 2);
      if (tint !== undefined) im.setTint(tint);
      parent.add(im);
    };
    layer('ch1_ctx', { x: 0, y: 0, w: 760, h: 1260 }, 0x9fb0c6);
    if (m) for (const b of ['scapula', 'humerus', 'clavicle']) layer(`bone_bone_${b}`, m.rects[b]);
    parent.add(T(this, x + 12, y + 8, 'SHOULDER GIRDLE · ANTERIOR (R)', 14, '#9fd2ff', { weight: '800', fine: true }));
    parent.add(T(this, x + 12, y + h - 8, 'BodyParts3D © DBCLS (CC BY 4.0)', 12, '#6f86a8', { fine: true }).setOrigin(0, 1));
    if (!numbers || !m) return { w, h, q };
    const nums = posterNums();
    const F = (bone: string, name: string) => { const p = bonePoint(bone, name)!; const r = m.rects[bone]; return [r.x + p[0] / 2, r.y + p[1] / 2]; };
    const at: Record<Joint, number[]> = {
      sc: F('clavicle', 'sternalEnd'), ac: F('clavicle', 'acromialEnd'),
      gh: [m.landmarks.glenoid[0] - 6, m.landmarks.glenoid[1]], coracoid: F('scapula', 'coracoid'),
    };
    const k = Math.max(0.7, Math.min(1.3, q / 1.4));
    for (const j of JOINTS) {
      const jx = x + (at[j][0] - WIN.x) * q, jy = y + (at[j][1] - WIN.y) * q;
      const bx = jx + BADGE[j][0] * k, by = jy + BADGE[j][1] * k;
      const g = this.add.graphics(); parent.add(g);
      g.lineStyle(2.5, 0xffd34d, 0.95); g.lineBetween(jx, jy, bx, by); g.fillStyle(0xffd34d, 1); g.fillCircle(jx, jy, 5);
      g.fillStyle(0x1a1405, 1); g.fillCircle(bx, by, 20 * k); g.lineStyle(3, 0xffd34d, 1); g.strokeCircle(bx, by, 20 * k);
      parent.add(T(this, bx, by, String(nums[j]).padStart(2, '0'), 18, '#ffe07a', { weight: '900' }).setOrigin(0.5));
    }
    return { w, h, q };
  }

  // ------------------------------------------------------------------ poster
  buildPoster() {
    this.frame('J-03 해부도 포스터', '포스터를 관찰하세요. 귀퉁이가 들떠 있습니다.', C.violet);
    const { cTop, cBot } = this;
    const maxW = this.pw * 0.64, maxH = cBot - cTop - 20;
    const w = Math.min(maxW, maxH * WIN.w / WIN.h), h = w * WIN.h / WIN.w;
    const x = this.px + 30 + (maxW - w) / 2, y = cTop + (cBot - cTop - h) / 2;
    // wall behind (seen when the corner is peeled): the dial rule
    const wall = this.add.container(0, 0);
    const s = h * 0.5;
    const wg = this.add.graphics(); wg.fillStyle(0x3a4352, 1); wg.fillRect(x + w - s, y + h - s, s, s); wall.add(wg);
    wall.add(T(this, x + w - s * 0.32, y + h - s * 0.3, '다이얼\nR → L → R', Math.max(15, s * 0.11), '#f2f5f9', { weight: '900', align: 'center', lineSpacing: 2 }).setOrigin(0.5).setAngle(-8).setShadow(0, 0, '#000', 4, true, true));
    const poster = this.add.container(0, 0);
    const frameG = this.add.graphics(); frameG.fillStyle(0xe9e4d6, 1); frameG.fillRect(x - 10, y - 10, w + 20, h + 20); poster.add(frameG);
    this.drawPoster(poster, x, y, w);
    // the loose corner: a mask hides the poster's corner once peeled
    const cornerMaskG = this.make.graphics({}, false);
    const fold = this.add.graphics();
    const corner = this.add.graphics();
    const drawCorner = () => { corner.clear(); corner.fillStyle(0xd9d2bd, 1); corner.fillTriangle(x + w + 10, y + h + 10 - 50, x + w + 10, y + h + 10, x + w + 10 - 50, y + h + 10); corner.lineStyle(2, 0x8a7a58, 1); corner.strokeTriangle(x + w + 10, y + h - 40, x + w + 10, y + h + 10, x + w - 40, y + h + 10); };
    drawCorner();
    let peeled = false;
    const peel = () => {
      if (peeled) return; peeled = true; Audio.play('open'); corner.clear();
      // keep everything but the corner triangle
      cornerMaskG.fillStyle(0xffffff); cornerMaskG.beginPath();
      cornerMaskG.moveTo(x - 12, y - 12); cornerMaskG.lineTo(x + w + 12, y - 12); cornerMaskG.lineTo(x + w + 12, y + h - s); cornerMaskG.lineTo(x + w - s, y + h + 12); cornerMaskG.lineTo(x - 12, y + h + 12); cornerMaskG.closePath(); cornerMaskG.fillPath();
      poster.setMask(cornerMaskG.createGeometryMask());
      fold.fillStyle(0xcfc6ae, 1); fold.fillTriangle(x + w - s, y + h + 10, x + w + 10, y + h - s, x + w - s * 0.55, y + h - s * 0.55);
      fold.lineStyle(2, 0x8a7a58, 1); fold.strokeTriangle(x + w - s, y + h + 10, x + w + 10, y + h - s, x + w - s * 0.55, y + h - s * 0.55);
      this.addClue('poster_wall', '포스터 뒤 벽 — 다이얼 R → L → R');
    };
    const cz = this.add.zone(x + w - 110, y + h - 110, 140, 140).setOrigin(0).setInteractive({ useHandCursor: true, draggable: true });
    this.dragDelta(cz, (dx, dy) => { if (dx < -30 && dy < -30) peel(); });
    cz.on('pointerup', (p: Phaser.Input.Pointer) => { if (p.getDistance() < 8) peel(); });
    this.tip(x + w - 120, y + h - 24, '들뜬 귀퉁이 ◤', undefined, 15);
    this.addClue('poster', '어깨 해부도 — 관절마다 번호');
    // right column
    const rx = this.px + 30 + maxW + 20, rw = this.px + this.pw - 30 - rx;
    T(this, rx, cTop + 10, '포스터 관찰', 19, C.violetS, { weight: '700' });
    T(this, rx, cTop + 42, '몸 앞에서 본 오른쪽 어깨 부위 해부도. 네 곳에 두 자리 번호가 적혀 있다. 이름표는 없다.\n\n화면 왼쪽 = 가쪽(어깨 바깥쪽)\n화면 오른쪽 = 안쪽(복장뼈 쪽)', 16, '#d3def3', { wordWrap: { width: rw }, lineSpacing: 6 });
    new Button(this, rx + Math.min(rw, 240) / 2, cBot - 30, '귀퉁이 떼어 보기', peel, { w: Math.min(rw, 240), h: 52, icon: 'hand', size: 17 });
    this.setFeedback('번호는 관절 자리에 붙어 있다. 무엇을 여는 번호일까?', 'info');
  }

  // ------------------------------------------------------------------ safe
  buildSafe() {
    this.frame('L-06 벽 금고', '다이얼을 돌려 세 숫자를 맞춘 뒤 손잡이를 당기세요.', C.amber);
    if (G.run.bones.includes('clavicle')) { this.setFeedback('금고는 비어 있습니다. 표본은 이미 회수했습니다.', 'info'); return; }
    const { cTop, cBot } = this;
    const ch = cBot - cTop;
    const sw = Math.min(this.pw * 0.5, ch * 1.05), sx = this.px + 30, sy = cTop;
    // safe body + door
    const body = this.add.graphics(); body.fillStyle(0x0b0f16, 1); body.fillRoundedRect(sx, sy, sw, ch, 14);
    const inside = this.add.image(sx + sw / 2, sy + ch / 2, 'bone_bone_clavicle'); inside.setScale(Math.min((sw - 80) / inside.width, (ch - 80) / inside.height) * 0.9).setAngle(-8);
    const door = this.add.container(sx, sy);
    const dg = this.add.graphics(); dg.fillStyle(0x3a4352, 1); dg.fillRoundedRect(0, 0, sw, ch, 14); dg.lineStyle(4, 0x1a2029, 1); dg.strokeRoundedRect(0, 0, sw, ch, 14);
    dg.lineStyle(2, 0x5a6577, 1); dg.strokeRoundedRect(14, 14, sw - 28, ch - 28, 10); door.add(dg);
    const D = Math.min(sw * 0.62, ch * 0.62);
    const dcx = sw * 0.44, dcy = ch * 0.5;
    const dial = this.add.image(dcx, dcy, 'inv_dial').setDisplaySize(D, D); door.add(dial);
    const ptr = this.add.graphics(); ptr.fillStyle(0xff4d5e, 1); ptr.fillTriangle(dcx - 12, dcy - D / 2 - 18, dcx + 12, dcy - D / 2 - 18, dcx, dcy - D / 2 + 4); door.add(ptr);
    // handle (drag down)
    const hx = sw - 46, hTop = ch * 0.3, hBot = ch * 0.7;
    const hgBase = this.add.graphics(); hgBase.fillStyle(0x1a2029, 1); hgBase.fillRoundedRect(hx - 12, hTop, 24, hBot - hTop, 12); door.add(hgBase);
    const handle = this.add.container(sx + hx, sy + hTop + 24).setDepth(10);
    const hg = this.add.graphics(); hg.fillStyle(0xc9a64b, 1); hg.fillRoundedRect(-22, -24, 44, 48, 10); hg.lineStyle(3, 0x4a3608, 1); hg.strokeRoundedRect(-22, -24, 44, 48, 10); handle.add(hg);
    handle.setSize(70, 70).setInteractive({ useHandCursor: true, draggable: true });
    door.add(T(this, hx, hBot + 20, '손잡이 ▼', 15, '#ffe0a0', { weight: '700' }).setOrigin(0.5));
    // ---- dial state ----
    const tick = Math.PI * 2 / DIAL_N;
    let theta = 0, dir = 0, ext = 0;
    const entries: { d: 'R' | 'L'; n: number }[] = [];
    const num = (t: number) => ((Math.round(-t / tick) % DIAL_N) + DIAL_N) % DIAL_N;
    const big = T(this, sx + dcx, sy + dcy, '0', 40, '#ffffff', { weight: '900' }).setOrigin(0.5).setDepth(5);
    const slots = T(this, sx + sw / 2, sy + ch - 30, '', 20, '#7fffb2', { weight: '800' }).setOrigin(0.5).setDepth(5);
    const showSlots = () => {
      const live = dir ? [{ d: dir > 0 ? 'R' : 'L', n: num(theta) }] : [];
      const all = [...entries, ...live].slice(-3);
      const parts = [0, 1, 2].map(i => all[i] ? `${all[i].d === 'R' ? '오른쪽' : '왼쪽'} ${String(all[i].n).padStart(2, '0')}` : '— —');
      slots.setText(parts.join('   ·   '));
    };
    let lastN = 0;
    const move = (d: number) => {
      if (Math.abs(d) < 1e-6) return;
      theta += d; dial.rotation = theta;
      const s = Math.sign(d);
      if (dir === 0) { dir = s; ext = theta; }
      else if (s === dir) ext = theta;
      else if (Math.abs(theta - ext) >= tick * 0.5) { entries.push({ d: dir > 0 ? 'R' : 'L', n: num(ext) }); if (entries.length > 6) entries.shift(); dir = s; ext = theta; }
      const n = num(theta); if (n !== lastN) { lastN = n; Audio.play('click'); }
      big.setText(String(n)); showSlots();
    };
    showSlots();
    const dz = this.add.zone(sx + dcx - D / 2, sy + dcy - D / 2, D, D).setOrigin(0).setInteractive({ useHandCursor: true, draggable: true });
    let aPrev = 0;
    const ang = (p: Phaser.Input.Pointer) => Math.atan2(p.worldY - (sy + dcy), p.worldX - (sx + dcx));
    dz.on('dragstart', (p: Phaser.Input.Pointer) => { aPrev = ang(p); });
    dz.on('drag', (p: Phaser.Input.Pointer) => { const a = ang(p); move(Phaser.Math.Angle.Wrap(a - aPrev)); aPrev = a; });
    // step buttons (fine control; each press is a real turn of the dial)
    const step = (n: number) => { const sgn = Math.sign(n); this.time.addEvent({ delay: 45, repeat: Math.abs(n) - 1, callback: () => move(sgn * tick) }); };
    // ---- brass plate + controls (right) ----
    const rx = sx + sw + 24, rw = this.px + this.pw - 30 - rx;
    const pg = this.add.graphics(); pg.fillStyle(0xc9a64b, 1); pg.fillRoundedRect(rx, cTop, rw, Math.min(ch * 0.5, 250), 10); pg.lineStyle(3, 0x6a5418, 1); pg.strokeRoundedRect(rx, cTop, rw, Math.min(ch * 0.5, 250), 10);
    const plate = SAFE_ORDER.map((j, i) => `${i + 1}. ${SAFE_DIRS[i] === 'R' ? '오른쪽' : '왼쪽'} — ${JOINT_RIDDLE[j]}${this.adv ? '' : `\n    (${JOINT_KO[j]})`}`).join('\n');
    const pt = T(this, rx + 16, cTop + 14, `S-04 보관 금고\n${plate}`, 16, '#2a1d05', { ink: true, weight: '800', wordWrap: { width: rw - 30 }, lineSpacing: 4 });
    for (const sz of [15, 14]) { if (pt.height <= Math.min(ch * 0.5, 250) - 20) break; pt.setFontSize(sz).setLineSpacing(2); }
    this.addClue('safe_plate', '금고 명판 — 세 관절의 순서');
    const by = cTop + Math.min(ch * 0.5, 250) + 40, bw = (rw - 30) / 4;
    ([['⟲5', -5], ['⟲1', -1], ['1⟳', 1], ['5⟳', 5]] as [string, number][]).forEach(([lb, n], i) =>
      new Button(this, rx + bw / 2 + i * (bw + 10), by, lb, () => step(n), { w: bw, h: 48, size: 19 }));
    T(this, rx, by + 34, '⟳ = 오른쪽(시계 방향) · ⟲ = 왼쪽', 14, '#9fb3d1', { fine: true });
    new Button(this, rx + rw / 2, by + 84, '입력 초기화', () => { entries.length = 0; dir = 0; Audio.play('click'); showSlots(); this.setFeedback('입력을 비웠습니다. 오른쪽으로 돌려 첫 번째 숫자부터 맞추세요.', 'info'); }, { w: Math.min(rw, 220), h: 44, icon: 'rotate', size: 16 });
    // ---- pull the handle ----
    let opened = false, busy = false;
    const pull = () => {
      if (opened || busy) return; busy = true;
      const all = [...entries, ...(dir ? [{ d: (dir > 0 ? 'R' : 'L') as 'R' | 'L', n: num(theta) }] : [])].slice(-3);
      const nums = posterNums();
      const want = SAFE_ORDER.map((j, i) => ({ d: SAFE_DIRS[i], n: nums[j] }));
      const bad = want.findIndex((w, i) => !all[i] || all[i].d !== w.d || all[i].n !== w.n);
      if (bad < 0 && all.length === 3) {
        opened = true; Audio.play('unlock'); handle.disableInteractive(); dz.disableInteractive();
        this.tweens.add({ targets: handle, y: sy + hBot - 24, duration: 200 });
        this.time.delayedCall(350, () => {
          Audio.play('door');
          this.tweens.add({ targets: door, scaleX: 0.08, duration: 700, ease: 'Cubic.inOut' });
          this.tweens.add({ targets: [handle, big, slots], alpha: 0, duration: 300 });
          this.setFeedback('철컥— 금고가 열렸다! 표본을 눌러 꺼내세요.', 'ok');
          inside.setInteractive({ useHandCursor: true });
          inside.once('pointerup', () => {
            Audio.play('pickup');
            this.tweens.add({ targets: inside, y: inside.y - 30, scale: inside.scale * 1.08, duration: 400, ease: 'Back.out' });
            this.time.delayedCall(450, () => this.found('clavicle', '표본 S-04 회수 · 빗장뼈 Clavicle',
              '빗장뼈는 S자로 휜 긴뼈로, 팔이음뼈의 앞쪽 부분. 안쪽 끝(복장끝)은 복장뼈와 복장빗장관절을 만들어 팔 전체를 몸통 뼈대에 잇는 유일한 관절이 되고, 가쪽 끝(봉우리끝)은 어깨뼈 봉우리와 봉우리빗장관절을 만든다.'));
          });
          this.flushInput();
        });
        return;
      }
      G.run.mistakes++; Audio.play('error'); this.cameras.main.shake(180, 0.004);
      this.tweens.add({ targets: handle, y: sy + hTop + 24, duration: 300, ease: 'Back.out', onComplete: () => { busy = false; } });
      const which = all.length < 3 ? `숫자가 ${all.length}개만 입력됐다. 방향을 바꿀 때마다 숫자가 하나씩 입력된다.`
        : this.adv ? '손잡이가 움직이지 않는다.' : `${bad + 1}번째 입력이 맞지 않는다 (${SAFE_DIRS[bad] === 'R' ? '오른쪽' : '왼쪽'}으로 돌려 맞춰야 함).`;
      this.setFeedback(`덜컥— 잠겨 있다. ${which} 입력을 초기화하고 다시 시도하세요.`, 'err');
      entries.length = 0; dir = 0; showSlots();
    };
    handle.on('drag', (p: Phaser.Input.Pointer) => { if (opened || busy) return; handle.y = Phaser.Math.Clamp(p.worldY, sy + hTop + 24, sy + hBot - 24); if (handle.y > sy + hBot - 40) pull(); });
    handle.on('dragend', () => { if (!opened && !busy) this.tweens.add({ targets: handle, y: sy + hTop + 24, duration: 200 }); });
    handle.on('pointerup', (p: Phaser.Input.Pointer) => { if (p.getDistance() < 8 && !opened) this.setFeedback('손잡이를 잡고 아래로 당기세요.', 'info'); });
    this.setFeedback(this.has('poster') ? '명판의 세 관절이 포스터의 어느 번호인지 찾으세요. 다이얼을 끌어 돌립니다.' : '명판의 세 관절에 해당하는 숫자가 필요하다. 근처 어딘가에 해부도가 있었던가?', 'info');
  }

  notebookVisual(o: Overlay, x: number, y: number, w: number, h: number) {
    if (!this.has('poster')) return false;
    const c = this.add.container(0, 0); o.c.add(c);
    const pw = Math.min(w, h * WIN.w / WIN.h);
    this.drawPoster(c, x + (w - pw) / 2, y, pw);
    o.c.add(T(this, x + w / 2, y + pw * WIN.h / WIN.w + 18, '해부도 포스터 (사본)', 15, '#d9c08a', { weight: '700' }).setOrigin(0.5));
    return true;
  }

  hints() {
    const H: string[] = [];
    if (this.kind === 'poster') {
      if (!this.has('poster_wall')) H.push('포스터 오른쪽 아래 귀퉁이가 들떠 있습니다. 귀퉁이를 왼쪽 위로 끌어 떼어 보세요.');
      H.push('이 번호들은 L-06 레이저 통로의 벽 금고 다이얼에 쓰입니다. 금고 명판을 확인하세요.');
      return H;
    }
    if (!this.has('poster')) H.push('관절 보정실(J-03) 북쪽 벽의 해부도 포스터를 조사하세요. 관절마다 번호가 있습니다.');
    if (!this.has('poster_wall')) H.push('다이얼을 돌리는 방향 규칙이 포스터 뒤에 적혀 있습니다. (명판에도 방향이 있습니다)');
    H.push('복장빗장관절 = 빗장뼈 안쪽 끝(복장뼈 쪽, 화면 오른쪽) · 봉우리빗장관절 = 빗장뼈 가쪽 끝 · 어깨관절 = 위팔뼈머리와 관절오목 사이. 부리돌기 번호는 쓰이지 않습니다.');
    H.push('다이얼은 방향을 바꾸는 순간의 숫자가 입력됩니다: 오른쪽으로 돌려 첫 숫자에 맞추고 → 왼쪽으로 두 번째 → 오른쪽으로 세 번째 → 손잡이를 당기세요. 버튼으로 한 칸씩 돌릴 수도 있습니다.');
    if (!this.adv) { const n = posterNums(); H.push(`정답: 오른쪽 ${n.sc} → 왼쪽 ${n.ac} → 오른쪽 ${n.gh}.`); }
    return H;
  }
}
