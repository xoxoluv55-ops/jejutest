import Phaser from 'phaser';
import { InvestBase, Overlay } from './InvestBase';
import { Audio } from '../../core/audio';
import { G } from '../../game/state';
import { T, C, Button } from '../../ui/widgets';
import { bonePoint } from '../../art/bones';
import { cryo, CRYO_KO, CRYO_DESC, CRYO_MIN, CRYO_MAX, CRYO_STEP, CryoZone } from '../../data/escape';

const ZCOL: Record<string, number> = { A: 0x4fd8ff, B: 0xffc24d, C: 0xff7ad9 };
const LETTERS = ['A', 'B', 'C'];

/**
 * S-02 humerus (V-05 specimen vault): the cryo capsule only thaws with the right settings.
 *  - clipboard by the vault door: memo sheet (the rule) over the temperature log (lift the top sheet)
 *  - cooling unit on the capsule: three zone sliders (A/B/C, each wired to a region of the real humerus model),
 *    set them to the log's last 'normal' day, pull the thaw lever, open the capsule, take the specimen
 */
export class InvHumerusScene extends InvestBase {
  constructor() { super('InvHumerus'); }
  clueIds = ['cryolog'];
  vals: Record<CryoZone, number> = { head: CRYO_MIN, shaft: CRYO_MIN, condyle: CRYO_MIN };
  thawed = false;
  bezel?: Phaser.GameObjects.NineSlice;

  build(kind: string) {
    this.thawed = false;
    this.vals = { head: CRYO_MIN, shaft: CRYO_MIN, condyle: CRYO_MIN };
    if (kind === 'cryolog') this.buildLog(); else this.buildUnit();
  }

  // ------------------------------------------------------------------ clipboard
  buildLog() {
    this.frame('냉각 기록지 · V-05', '클립보드의 종이를 넘겨 보세요. 맨 위 메모 아래에 기록표가 있습니다.', C.amber);
    const { cTop, cBot } = this;
    const cp = this.compact;
    const k = Math.min((cBot - cTop) / 760, (this.pw * 0.62) / 620);
    const bx = this.px + 30 + (this.pw * 0.62 - 620 * k) / 2, by = cTop + (cBot - cTop - 760 * k) / 2;
    // paper area: the clipboard sheet on tall screens; a full-height landscape sheet on short (phone) screens
    const paper = cp ? { x: this.px + 20, y: cTop, w: this.pw * 0.64 - 20, h: cBot - cTop } : { x: bx + 28 * k, y: by + 60 * k, w: 552 * k, h: 660 * k };
    if (cp) { const pg = this.add.graphics(); pg.fillStyle(0x6b4f33, 1); pg.fillRoundedRect(paper.x - 6, paper.y - 6, paper.w + 12, paper.h + 12, 8); this.add.image(paper.x, paper.y, 'inv_paper').setOrigin(0).setDisplaySize(paper.w, paper.h); }
    else this.add.image(bx, by, 'inv_clip').setOrigin(0).setScale(k * 0.5);
    const px = paper.x + (cp ? 14 : 16 * k), py = paper.y + (cp ? 8 : 20 * k), pw = paper.w - (cp ? 28 : 32 * k);
    const d = cryo();
    // sheet 2: the table (under the memo)
    const sheet2 = this.add.container(0, 0);
    sheet2.add(T(this, px, py, '표본 S-02 (위팔뼈) 냉각 캡슐 — 일일 기록', 18, '#1d2a40', { ink: true, weight: '800' }));
    const cols = [0, 0.2, 0.39, 0.58, 0.79].map(f => px + f * pw);
    const heads = ['날짜', '머리', '몸통', '관절융기', '판정'];
    const ty = py + (cp ? 30 : 50 * k);
    heads.forEach((h, i) => sheet2.add(T(this, cols[i], ty, h, 16, '#3a4a68', { ink: true, weight: '800' })));
    const g = this.add.graphics(); sheet2.add(g); g.lineStyle(2, 0x3a4a68, 0.6); g.lineBetween(px, ty + 24, px + pw, ty + 24);
    const rowH = cp ? Math.min(46, (paper.h - (ty - paper.y) - 60) / 4) : Math.max(46, 62 * k);
    d.rows.forEach((r, i) => {
      const y = ty + (cp ? 32 : 44) + i * rowH;
      sheet2.add(T(this, cols[0], y, r.date, 17, '#22324a', { ink: true, weight: '700' }));
      sheet2.add(T(this, cols[1], y, `${r.t.head}°`, 19, '#1a2436', { ink: true, weight: '800' }));
      sheet2.add(T(this, cols[2], y, `${r.t.shaft}°`, 19, '#1a2436', { ink: true, weight: '800' }));
      sheet2.add(T(this, cols[3], y, `${r.t.condyle}°`, 19, '#1a2436', { ink: true, weight: '800' }));
      const st = T(this, cols[4], y - 2, r.status.split(' — ')[0], 17, r.ok ? '#1f7a3a' : '#b02a2a', { ink: true, weight: '900' }).setAngle(-6);
      const sg = this.add.graphics(); sg.lineStyle(2.5, r.ok ? 0x1f7a3a : 0xb02a2a, 0.8); sg.strokeRoundedRect(st.x - 6, st.y - 4, st.width + 12, st.height + 8, 6); sheet2.add([sg, st]);
      if (!r.ok && !cp) sheet2.add(T(this, cols[4], y + 22, r.status.split(' — ')[1] ?? '', 13, '#b02a2a', { ink: true, weight: '700', fine: true }));
      g.lineStyle(1, 0x3a4a68, 0.25); g.lineBetween(px, y + rowH - 10, px + pw, y + rowH - 10);
    });
    sheet2.add(T(this, px, ty + (cp ? 32 : 44) + 4 * rowH + (cp ? 0 : 6), '단위 °C · 구역: 위팔뼈머리 / 위팔뼈몸통 / 위팔뼈관절융기', 14, '#4a5a78', { ink: true, weight: '700', fine: true }));
    // sheet 1: the memo on top, lifted by its corner
    const s1 = this.add.container(0, 0);
    const sh = this.add.image(paper.x, paper.y, 'inv_paper').setOrigin(0).setDisplaySize(paper.w, paper.h); s1.add(sh);
    const shd = this.add.graphics(); shd.fillStyle(0x000000, 0.18); shd.fillRect(paper.x + 4, paper.y + paper.h, paper.w, 5); s1.add(shd);
    s1.add(T(this, px, py + (cp ? 2 : 10), '유지보수 메모 — 한 박사', cp ? 18 : 20, '#3a2a14', { ink: true, weight: '800' }));
    s1.add(T(this, px, py + (cp ? 34 : 54), 'S-02 캡슐 해동 절차\n\n1. 아래 기록표에서 마지막으로 \'정상\' 판정을 받은 날을 찾는다.\n2. 그날의 세 구역 온도를 냉각 장치에 그대로 입력한다.\n3. 해동 레버를 내린다.\n\n설정이 하나라도 틀리면 캡슐은 열리지 않는다. (표본 보호)', 17, '#3a2a14', { ink: true, weight: '600', wordWrap: { width: pw - 10 }, lineSpacing: cp ? 2 : 6 }).setFontSize(cp ? 15 : 17));
    const cx = paper.x + paper.w, cy = paper.y + paper.h;
    const corner = this.add.graphics(); s1.add(corner);
    corner.fillStyle(0xe6dcbc, 1); corner.fillTriangle(cx, cy - 46, cx, cy, cx - 46, cy); corner.lineStyle(1.5, 0x8a7a58, 1); corner.strokeTriangle(cx, cy - 46, cx, cy, cx - 46, cy);
    const tip = this.tip(cx - 150, cy - 24, '모서리를 눌러 넘기기 ▸', s1, 16);
    let lifted = false;
    const lift = () => {
      Audio.play('type');
      lifted = !lifted;
      this.tweens.add({ targets: s1, y: lifted ? -(paper.h + 80) : 0, alpha: lifted ? 0 : 1, duration: 380, ease: 'Cubic.inOut' });
      if (lifted) { this.addClue('cryolog', '냉각 기록표 — 해동은 마지막 \'정상\' 날의 설정'); flip.setText('메모 다시 덮기'); }
      else flip.setText('종이 넘기기');
    };
    const z = this.add.zone(cx - 110, cy - 110, 130, 130).setOrigin(0).setInteractive({ useHandCursor: true, draggable: true });
    z.on('pointerup', lift); this.dragDelta(z, (dx, dy) => { if (!lifted && dy < -40) lift(); });
    void tip;
    // right column
    const rx = this.px + 30 + this.pw * 0.62 + 20, rw = this.px + this.pw - 30 - rx;
    T(this, rx, cTop + 10, '기록지', 19, C.amberS, { weight: '700' });
    T(this, rx, cTop + 42, '캡슐 옆 문가에 걸려 있던 클립보드. 맨 위에는 메모, 그 아래에 매일의 온도 기록표가 끼워져 있다.', 16, '#d3def3', { wordWrap: { width: rw }, lineSpacing: 6 });
    const flip = new Button(this, rx + Math.min(rw, 240) / 2, cBot - 30, '종이 넘기기', lift, { w: Math.min(rw, 240), h: 52, icon: 'book', size: 18 });
    this.setFeedback('메모를 읽고, 종이를 넘겨 기록표를 확인하세요.', 'info');
  }

  // ------------------------------------------------------------------ cooling unit
  buildUnit() {
    this.frame('냉각 캡슐 S-02 · 제어 장치', '구역 슬라이더를 움직여 온도를 맞추고 해동 레버를 내리세요.', C.cyan);
    if (G.run.bones.includes('humerus')) { this.setFeedback('캡슐은 비어 있습니다. 표본은 이미 회수했습니다.', 'info'); return; }
    const { cTop, cBot } = this, d = cryo();
    const ch = cBot - cTop;
    // ---- capsule window with the frozen specimen (real humerus model) ----
    const capW = Math.min(this.pw * 0.36, ch * 0.62), capX = this.px + 30, capY = cTop;
    // capsule: cold interior (nine-slice) -> frozen specimen -> frost -> steel bezel with the window (nine-slice)
    this.add.nineslice(capX + capW / 2, capY + ch / 2, 'inv_capsule_back', undefined, capW, ch, 50, 50, 50, 50);
    const bone = this.add.image(capX + capW / 2, capY + ch / 2, 'bone_bone_humerus');
    const bs = Math.min((capW - 60) / bone.width, (ch - 60) / bone.height); bone.setScale(bs);
    const frost = this.add.image(capX + capW / 2, capY + ch / 2, 'inv_frost').setDisplaySize(capW - 40, ch - 40);
    this.bezel = this.add.nineslice(capX + capW / 2, capY + ch / 2, 'inv_capsule', undefined, capW, ch, 70, 70, 70, 70);
    const P = (name: string): [number, number] => { const p = bonePoint('humerus', name) ?? [bone.width / 2, bone.height / 2]; return [bone.x + (p[0] - bone.width / 2) * bs, bone.y + (p[1] - bone.height / 2) * bs]; };
    const le = P('lateralEpicondyle'), me = P('medialEpicondyle');
    const zonePt: Record<CryoZone, [number, number]> = { head: P('head'), shaft: P('shaft'), condyle: [(le[0] + me[0]) / 2, (le[1] + me[1]) / 2 - 10] };
    // ---- three sliders, wired (coloured leader + letter) to their zone on the bone ----
    const sx0 = capX + capW + 30, sw = this.px + this.pw - 30 - sx0;
    const leverW = Math.min(130, sw * 0.2);
    const colW = (sw - leverW - 20) / 3;
    const trackTop = cTop + 70, trackBot = cBot - 60;
    const steps = (CRYO_MAX - CRYO_MIN) / CRYO_STEP;
    const yOf = (v: number) => trackTop + (CRYO_MAX - v) / (CRYO_MAX - CRYO_MIN) * (trackBot - trackTop);
    const wires = this.add.graphics().setDepth(5);
    const readouts: Record<string, Phaser.GameObjects.Text> = {};
    d.dialOrder.forEach((zone, i) => {
      const L = LETTERS[i], col = ZCOL[L];
      const cx = sx0 + colW * i + colW / 2;
      // marker on the bone
      const [mx, my] = zonePt[zone];
      const mk = this.add.graphics().setDepth(6); mk.fillStyle(col, 1); mk.fillCircle(mx, my, 15); mk.lineStyle(3, 0x0b1018, 1); mk.strokeCircle(mx, my, 15);
      T(this, mx, my, L, 16, '#0b1018', { weight: '900', ink: true }).setOrigin(0.5).setDepth(7);
      wires.lineStyle(3, col, 0.55); wires.beginPath(); wires.moveTo(mx + 15, my); wires.lineTo(capX + capW + 6, my); wires.lineTo(cx, cTop + 20); wires.strokePath();
      // column header
      T(this, cx, cTop + 22, `구역 ${L}`, 19, '#ffffff', { weight: '800' }).setOrigin(0.5).setDepth(6);
      if (!this.adv) T(this, cx, cTop + 46, CRYO_DESC[zone].split(' (')[0], 13, '#9fb3d1', { weight: '600', fine: true, wordWrap: { width: colW - 8 }, align: 'center' }).setOrigin(0.5, 0).setMaxLines(2).setDepth(6);
      // track with tick marks
      const tg = this.add.graphics();
      this.add.nineslice(cx, (trackTop + trackBot) / 2, 'inv_track', undefined, 34, trackBot - trackTop + 30, 16, 16, 20, 20);
      tg.fillStyle(col, 0.9); tg.fillRect(cx - 17, trackTop - 22, 34, 4);
      for (let s = 0; s <= steps; s++) { const y = trackTop + s * (trackBot - trackTop) / steps; tg.lineStyle(2, 0x5a6a86, 1); tg.lineBetween(cx - 22, y, cx - 13, y); if (s % 3 === 0) T(this, cx - 26, y, `${CRYO_MAX - s * CRYO_STEP}`, 13, '#7f93b5', { fine: true }).setOrigin(1, 0.5); }
      const knob = this.add.container(cx, yOf(this.vals[zone]));
      knob.add(this.add.image(0, 0, 'inv_knob').setDisplaySize(68, 38).setTint(col));
      knob.setSize(80, 50).setInteractive({ useHandCursor: true, draggable: true });
      const ro = T(this, cx, trackBot + 28, '', 22, '#e8f6ff', { weight: '900', display: true }).setOrigin(0.5); readouts[zone] = ro;
      const set = (v: number) => {
        v = Phaser.Math.Clamp(Math.round(v / CRYO_STEP) * CRYO_STEP, CRYO_MIN, CRYO_MAX);
        if (v !== this.vals[zone]) Audio.play('click');
        this.vals[zone] = v; knob.y = yOf(v); ro.setText(`${v}°C`);
      };
      set(this.vals[zone]);
      knob.on('drag', (p: Phaser.Input.Pointer) => { const f = (p.worldY - trackTop) / (trackBot - trackTop); set(CRYO_MAX - f * (CRYO_MAX - CRYO_MIN)); });
      // tap the track to step towards the tap (fine control on small screens)
      const tz = this.add.zone(cx - 40, trackTop - 10, 80, trackBot - trackTop + 20).setOrigin(0).setInteractive({ useHandCursor: true });
      tz.on('pointerup', (p: Phaser.Input.Pointer) => { if (p.getDistance() > 8) return; set(this.vals[zone] + (p.worldY < knob.y ? CRYO_STEP : -CRYO_STEP)); });
      knob.setDepth(8);
    });
    // ---- thaw lever (drag down) ----
    const lx = this.px + this.pw - 30 - leverW / 2, lTop = cTop + 60, lBot = cBot - 40;
    this.add.nineslice(lx, (lTop + lBot) / 2, 'inv_track', undefined, 36, lBot - lTop, 16, 16, 20, 20);
    T(this, lx, cTop + 22, '해동 레버', 17, '#ff9aa8', { weight: '800' }).setOrigin(0.5);
    T(this, lx, lBot + 22, '아래로 ▼', 15, '#ff9aa8', { weight: '700' }).setOrigin(0.5);
    const handle = this.add.container(lx, lTop + 30);
    handle.add(this.add.image(0, 0, 'inv_lever_red').setDisplaySize(leverW - 8, 48));
    handle.setSize(leverW, 60).setInteractive({ useHandCursor: true, draggable: true });
    const springBack = () => this.tweens.add({ targets: handle, y: lTop + 30, duration: 300, ease: 'Back.out' });
    let pulled = false;
    handle.on('drag', (p: Phaser.Input.Pointer) => {
      if (this.thawed) return;
      handle.y = Phaser.Math.Clamp(p.worldY, lTop + 30, lBot - 30);
      if (!pulled && handle.y > lBot - 50) { pulled = true; this.pull(bone, frost, springBack); }
    });
    handle.on('dragend', () => { pulled = false; if (!this.thawed) springBack(); });
    handle.on('pointerup', (p: Phaser.Input.Pointer) => { if (p.getDistance() < 8 && !this.thawed) this.setFeedback('레버를 잡고 아래로 끌어 내리세요.', 'info'); });
    this.setFeedback(this.has('cryolog') ? '기록지의 설정을 구역 A·B·C에 맞추세요. 각 구역 선이 뼈의 어느 부분에 연결되어 있는지 보세요.'
      : '세 구역의 온도를 알아야 합니다. 보관동 문가의 기록지를 먼저 확인하세요.', 'info');
  }

  pull(bone: Phaser.GameObjects.Image, frost: Phaser.GameObjects.Image, springBack: () => void) {
    const d = cryo(), want = d.rows[d.answer].t;
    const wrong = (Object.keys(want) as CryoZone[]).filter(z => this.vals[z] !== want[z]);
    Audio.play('hold');
    if (!wrong.length) {
      this.thawed = true; Audio.play('unlock');
      this.setFeedback('해동 시작… 서리가 걷히고 캡슐 잠금이 풀렸다. 표본을 눌러 꺼내세요.', 'ok');
      this.tweens.add({ targets: frost, alpha: 0, duration: 900 });
      // the capsule lid lifts and the specimen comes forward
      if (this.bezel) { const hb = this.bezel; this.tweens.add({ targets: hb, y: hb.y - hb.height * 0.82, duration: 650, delay: 500, ease: 'Cubic.inOut', onStart: () => Audio.play('door') }); }
      this.tweens.add({ targets: bone, scale: bone.scale * 1.06, duration: 500, delay: 900, ease: 'Sine.out' });
      const glow = this.add.image(bone.x, bone.y, 'light').setTint(0x9fe6ff).setBlendMode(Phaser.BlendModes.ADD).setScale(1.4).setAlpha(0);
      this.tweens.add({ targets: glow, alpha: 0.5, duration: 900, yoyo: true, repeat: -1 });
      this.time.delayedCall(900, () => {
        bone.setInteractive({ useHandCursor: true });
        bone.once('pointerup', () => {
          Audio.play('pickup');
          this.tweens.add({ targets: bone, y: bone.y - 40, scale: bone.scale * 1.1, duration: 400, ease: 'Back.out' });
          this.time.delayedCall(500, () => this.found('humerus', '표본 S-02 회수 · 위팔뼈 Humerus',
            '위팔뼈는 위팔의 긴뼈(자유팔뼈). 몸쪽 끝의 둥근 위팔뼈머리가 어깨뼈 관절오목과 어깨관절을 만들고, 먼쪽 끝의 관절융기(도르래·작은머리)가 자뼈·노뼈와 팔꿉관절을 만든다. 가쪽·안쪽 위관절융기는 아래팔 근육이 붙는 자리다.'));
        });
        this.flushInput();
      });
      return;
    }
    G.run.mistakes++; Audio.play('error'); this.cameras.main.shake(200, 0.004);
    const same = d.rows.findIndex(r => (Object.keys(r.t) as CryoZone[]).every(z => r.t[z] === this.vals[z]));
    let msg = '삐— 설정 불일치. 캡슐이 열리지 않습니다.';
    if (same >= 0) msg = `이 설정은 ${d.rows[same].date} 기록과 같다 (${d.rows[same].status}). 그날이 마지막 '정상'이었을까?`;
    else if (!this.adv) msg += ` (${wrong.length}개 구역이 기록과 다름)`;
    this.setFeedback(msg, 'err');
    this.time.delayedCall(300, springBack);
  }

  notebookVisual(o: Overlay, x: number, y: number, w: number, h: number) {
    if (!this.has('cryolog')) return false;
    const d = cryo();
    const g = this.add.graphics(); g.fillStyle(0xf6f2e6, 1); g.fillRoundedRect(x, y, w, Math.min(h, 300), 8); o.c.add(g);
    o.c.add(T(this, x + 14, y + 12, '기록표 (사본)', 16, '#1d2a40', { ink: true, weight: '800' }));
    const cols = [0, 0.26, 0.44, 0.62, 0.8].map(f => x + 14 + f * (w - 28));
    ['날짜', '머리', '몸통', '융기', '판정'].forEach((s, i) => o.c.add(T(this, cols[i], y + 46, s, 14, '#3a4a68', { ink: true, weight: '800', fine: true })));
    d.rows.forEach((r, i) => {
      const yy = y + 76 + i * 46;
      [r.date.replace('11월 ', '11/').replace('일', ''), `${r.t.head}°`, `${r.t.shaft}°`, `${r.t.condyle}°`].forEach((s, j) => o.c.add(T(this, cols[j], yy, s, 16, '#1a2436', { ink: true, weight: '700' })));
      o.c.add(T(this, cols[4], yy, r.ok ? '정상' : '이상', 16, r.ok ? '#1f7a3a' : '#b02a2a', { ink: true, weight: '900' }));
    });
    return true;
  }

  hints() {
    const H: string[] = [];
    const d = cryo();
    if (!this.has('cryolog')) H.push('보관동(V-05) 문가 벽의 클립보드를 조사하고, 맨 위 메모를 넘겨 기록표를 보세요.');
    H.push('메모: 마지막으로 \'정상\' 판정을 받은 날의 설정을 입력합니다. 기록표에서 \'정상\' 도장이 찍힌 날 중 가장 늦은 날을 찾으세요.');
    H.push('구역 A·B·C의 선이 뼈의 어디에 닿는지 보세요: 몸쪽 끝의 둥근 머리 = 위팔뼈머리, 가운데 = 몸통, 먼쪽 끝의 넓은 부분 = 관절융기.');
    if (!this.adv) {
      const r = d.rows[d.answer];
      H.push(`정답은 ${r.date} 기록입니다: 머리 ${r.t.head}° · 몸통 ${r.t.shaft}° · 관절융기 ${r.t.condyle}°. 슬라이더를 맞춘 뒤 레버를 끝까지 내리세요.`);
    }
    if (this.kind === 'cryolog') return H.slice(0, 2);
    return H;
  }
}
export { CRYO_KO };
