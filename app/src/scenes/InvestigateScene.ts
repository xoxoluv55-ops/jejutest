import Phaser from 'phaser';
import { PuzzleBase } from './puzzles/PuzzleBase';
import { View } from '../core/view';
import { Audio } from '../core/audio';
import { G, Bus } from '../game/state';
import { T, C, drawPanel, Button } from '../ui/widgets';
import { boneModel } from '../art/bones';

type Kind = 'desk' | 'frame';
/** the four structures whose stickers make the drawer code, in the order the journal gives */
export const SCAP_ORDER = ['acromion', 'coracoid', 'glenoid', 'inferiorAngle'] as const;
const SCAP_KO: Record<string, string> = { acromion: '봉우리', coracoid: '부리돌기', glenoid: '관절오목', inferiorAngle: '아래각' };
const SCAP_DESC: Record<string, string> = {
  acromion: '어깨 꼭대기에서 빗장뼈와 만나는 바깥쪽 끝',
  coracoid: '앞쪽으로 갈고리처럼 튀어나온 돌기',
  glenoid: '위팔뼈머리를 받는 얕은 오목',
  inferiorAngle: '삼각형의 가장 아래 꼭짓점',
};
/** sticker offset from the measured landmark (image px) so the sticker sits on the structure, not over its edge */
const STICK_OFF: Record<string, [number, number]> = { acromion: [26, 8], coracoid: [14, -6], glenoid: [-6, 18], inferiorAngle: [-6, -30] };

/**
 * Escape-room investigation views (v0.7): the unit walks up to a real object in the lab and the scene switches to a
 * close-up where things are handled directly — open the journal and turn its page, lift the mug, read the note,
 * flip the photo frame, punch the drawer code, lift the false bottom, take the specimen. Clues go to the notebook
 * (G.run.clues, kept on death). Graded hints, unlimited retries, no damage while investigating (the world is paused).
 */
export class InvestigateScene extends PuzzleBase {
  constructor() { super('Investigate'); }
  kind: Kind = 'desk';
  layer!: Phaser.GameObjects.Container;       // current overlay (journal / keypad / notebook ...)
  hintLv = 0;
  // desk state
  mugLifted = false; drawerOpen = false; panelUp = false; taken = false;
  code = '';

  get adv() { return G.run.difficulty === 'adv'; }
  get solved4() { return G.run.flags.scapulaFound; }

  create(data: { kind: Kind }) {
    this.initView();
    this.kind = data.kind; this.hintLv = 0; this.code = '';
    this.mugLifted = false; this.panelUp = false; this.taken = false; this.drawerOpen = !!G.run.flags.drawerOpen;
    this.layer = undefined as unknown as Phaser.GameObjects.Container;
    if (this.kind === 'desk') this.buildDesk(); else this.buildFrame();
    // header tools: hint + notebook
    const hx = this.px + this.pw - (this.compact ? 250 : 360), hy = this.py + this.hdr / 2;
    new Button(this, hx, hy, '힌트', () => this.hint(), { w: this.compact ? 96 : 110, h: this.compact ? 36 : 42, icon: 'info', size: 16 }).setDepth(60);
    new Button(this, hx + (this.compact ? 108 : 126), hy, '기록장', () => this.notebook(), { w: this.compact ? 110 : 126, h: this.compact ? 36 : 42, icon: 'book', size: 16 }).setDepth(60);
  }

  addClue(id: string, toast: string) {
    if (G.run.clues.includes(id)) return;
    G.run.clues.push(id); Audio.play('reveal');
    this.setFeedback(`📒 기록장에 저장: ${toast}`, 'ok');
    Bus.emit('mission');
  }

  // ------------------------------------------------------------------ desk
  buildDesk() {
    this.frame('연구원 책상 조사', '물건을 눌러 조사하세요. 일지를 펼치고, 물건을 들어 보고, 서랍을 확인하세요.', C.amber);
    const { cTop, cBot } = this;
    const k = Math.min((this.pw - 40) / 1000, (cBot - cTop) / 560);
    const ox = this.px + this.pw / 2 - 500 * k, oy = cTop + (cBot - cTop - 560 * k) / 2;
    const P = (x: number, y: number) => ({ x: ox + x * k, y: oy + y * k });
    this.add.image(ox, oy, 'inv_desk').setOrigin(0).setScale(k * 0.5);
    // journal
    const jp = P(250, 240);
    const journal = this.add.image(jp.x, jp.y, 'inv_journal').setScale(k * 0.5 * 1.1).setAngle(-8).setInteractive({ useHandCursor: true });
    journal.on('pointerup', () => this.openJournal());
    this.glint(journal);
    // sticky note under the mug, and the mug on top
    const np = P(720, 250);
    const note = this.add.image(np.x, np.y, 'inv_note').setScale(k * 0.5 * 1.1).setAngle(6).setInteractive({ useHandCursor: true });
    const noteT = T(this, np.x, np.y, '서랍\n4자리', 15, '#5a4210', { ink: true, weight: '800', align: 'center' }).setOrigin(0.5).setAngle(6);
    note.on('pointerup', () => { if (!this.mugLifted) return; this.openNote(); });
    void noteT;
    const mp = P(735, 225);
    const mug = this.add.image(mp.x, mp.y, 'inv_mug').setScale(k * 0.5 * 1.25).setInteractive({ useHandCursor: true, draggable: true });
    const liftMug = () => {
      if (this.mugLifted) return; this.mugLifted = true; Audio.play('pickup');
      this.tweens.add({ targets: mug, x: mp.x + 170 * k, y: mp.y - 30 * k, angle: 12, duration: 450, ease: 'Cubic.out' });
      this.setFeedback('머그잔 아래에 노란 메모지가 붙어 있었다. 메모를 눌러 읽어 보세요.', 'info');
    };
    mug.on('pointerup', liftMug); mug.on('drag', liftMug);
    // lamp
    const lp = P(780, 150);
    const lamp = this.add.image(lp.x, lp.y, 'light').setTint(0xffd08a).setBlendMode(Phaser.BlendModes.ADD).setScale(0.9 * k).setAlpha(0.35);
    this.tweens.add({ targets: lamp, alpha: 0.25, duration: 1600, yoyo: true, repeat: -1 });
    // the drawer (centre) with its keypad
    const dz = this.add.zone(ox + 300 * k, oy + 398 * k, 400 * k, 140 * k).setOrigin(0).setInteractive({ useHandCursor: true });
    const kpBox = P(500, 425);
    const kp = this.add.graphics();
    const drawKp = () => {
      kp.clear(); const w = 120 * k, h = 26 * k;
      kp.fillStyle(0x0c1118, 1); kp.fillRoundedRect(kpBox.x - w / 2, kpBox.y - h / 2, w, h, 4);
      kp.fillStyle(this.drawerOpen ? C.green : C.red, 1); kp.fillCircle(kpBox.x + w / 2 - 10 * k, kpBox.y, 4 * k);
    };
    drawKp();
    T(this, kpBox.x - 46 * k, kpBox.y, '▢▢▢▢', 14, '#7fdcff', { weight: '700' }).setOrigin(0, 0.5);
    dz.on('pointerup', () => { if (this.drawerOpen) this.openDrawer(); else this.keypad(() => { drawKp(); }); });
    this.drawerGlow = this.add.image(ox + 500 * k, oy + 468 * k, 'light').setTint(0xffc24d).setBlendMode(Phaser.BlendModes.ADD).setScale(1.2 * k, 0.5 * k).setAlpha(0);
    this.setFeedback(this.solved4 ? '이미 표본을 꺼낸 책상입니다. 단서는 기록장에서 다시 볼 수 있습니다.'
      : '책상 위를 살펴보세요. 연구원이 무언가를 숨겨 둔 것 같습니다.', 'info');
  }
  drawerGlow?: Phaser.GameObjects.Image;

  glint(o: Phaser.GameObjects.Image) {
    const g = this.add.image(o.x + o.displayWidth * 0.3, o.y - o.displayHeight * 0.3, 'light').setTint(0xffffff).setBlendMode(Phaser.BlendModes.ADD).setScale(0.12).setAlpha(0);
    this.tweens.add({ targets: g, alpha: 0.9, scale: 0.2, duration: 500, yoyo: true, repeat: -1, repeatDelay: 1800, delay: Math.random() * 1500 });
  }

  /** dims the view and returns a fresh overlay container with a close button */
  overlay(title: string, w: number, h: number, accent = C.amber) {
    this.layer?.destroy();
    const { W, H } = View;
    const c = this.add.container(0, 0).setDepth(200); this.layer = c;
    c.add(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.66).setInteractive());
    w = Math.min(w, W - 30); h = Math.min(h, H - (this.compact ? 12 : 40));
    const x = W / 2 - w / 2, y = H / 2 - h / 2;
    const g = this.add.graphics(); drawPanel(g, x, y, w, h, { accent, header: 50 }); c.add(g);
    c.add(T(this, x + 24, y + 25, title, 20, C.white, { weight: '700' }).setOrigin(0, 0.5));
    c.add(new Button(this, x + w - 80, y + 25, '닫기', () => this.closeLayer(), { w: 120, h: 38, icon: 'close', size: 16 }));
    c.setAlpha(0); this.tweens.add({ targets: c, alpha: 1, duration: 150 });
    this.flushInput();
    return { c, x, y, w, h };
  }
  closeLayer() { if (!this.layer) return; const c = this.layer; this.layer = undefined as unknown as Phaser.GameObjects.Container; Audio.play('close'); this.tweens.add({ targets: c, alpha: 0, duration: 120, onComplete: () => c.destroy() }); }

  // ---- journal: two pages, turn with the page corner ----
  openJournal() {
    Audio.play('open');
    const o = this.overlay('연구 일지 — 한 박사', 820, 600);
    const k = Math.min((o.w - 60) / 700, (o.h - 120) / 460);
    const bx = o.x + o.w / 2 - 350 * k, by = o.y + 60;
    o.c.add(this.add.image(bx, by, 'inv_journal_open').setOrigin(0).setScale(k * 0.5));
    const pw = 300 * k, lx = bx + 34 * k, rx = bx + 372 * k, ty = by + 40 * k;
    const pages = this.journalPages();
    let page = 0;
    const left = T(this, lx, ty, '', 17, '#2b2418', { ink: true, weight: '600', wordWrap: { width: pw }, lineSpacing: 6 }); o.c.add(left);
    const right = T(this, rx, ty, '', 17, '#2b2418', { ink: true, weight: '600', wordWrap: { width: pw }, lineSpacing: 6 }); o.c.add(right);
    const pn = T(this, bx + 350 * k, by + 430 * k, '', 15, '#6a5c40', { ink: true, weight: '700' }).setOrigin(0.5); o.c.add(pn);
    const show = () => {
      left.setText(pages[page][0]); right.setText(pages[page][1]);
      for (const t of [left, right]) { t.setFontSize(17); if (t.height > 360 * k) t.setFontSize(16); if (t.height > 360 * k) t.setFontSize(15); }
      pn.setText(`${page * 2 + 1}–${page * 2 + 2} / ${pages.length * 2}`);
      if (page === pages.length - 1) this.addClue('journal', '일지 — 서랍 비밀번호를 만드는 순서');
    };
    // page corner to turn (a real gesture: tap or drag the corner)
    const corner = this.add.graphics(); o.c.add(corner);
    const cx = bx + 660 * k, cy = by + 410 * k;
    const drawCorner = () => { corner.clear(); corner.fillStyle(0xd6cdb4, 1); corner.fillTriangle(cx, cy - 36 * k, cx, cy, cx - 36 * k, cy); corner.lineStyle(1.5, 0x8a7a58, 1); corner.strokeTriangle(cx, cy - 36 * k, cx, cy, cx - 36 * k, cy); };
    drawCorner();
    const cz = this.add.zone(cx - 70, cy - 70, 90, 90).setOrigin(0).setInteractive({ useHandCursor: true, draggable: true }); o.c.add(cz);
    const turn = () => { page = (page + 1) % pages.length; Audio.play('type'); show(); };
    cz.on('pointerup', turn);
    o.c.add(T(this, cx - 80, cy + 8 * k, '모서리를 눌러 넘기기 ▸', 15, '#ffe0a0', { weight: '700' }).setOrigin(1, 0));
    show();
  }

  journalPages(): [string, string][] {
    const adv = this.adv;
    const order = SCAP_ORDER.map((id, i) => `${i + 1}. ${SCAP_KO[id]}${adv ? '' : ` — ${SCAP_DESC[id]}`}`).join('\n');
    return [
      ['11월 2일\n격리 조치 전에 표본 S-01(오른쪽 어깨뼈)을 책상 서랍 속에 숨겼다. 서랍은 4자리 비밀번호로 잠근다.\n\n기억이 나지 않으면 벽에 걸린 S-01 사진을 볼 것.',
        '11월 3일\n어깨뼈는 몸통과 팔을 잇는 팔이음뼈다. 갈비뼈 뒤쪽 위에 얹혀 있고, 몸통 뼈대와는 직접 관절하지 않는다.\n\n사진의 각 구조에 번호 스티커를 붙여 두었다.'],
      ['비밀번호 = 사진 속 스티커 번호를 아래 순서대로 읽은 것\n\n' + order,
        adv ? '(구조 이름만 적어 둔다. 모양으로 찾을 것.)' : '팁: 사진은 몸의 앞에서 본 오른쪽 어깨뼈다.\n화면 왼쪽 = 가쪽(어깨 바깥쪽).\n\n관절오목은 위팔뼈가 끼워지는 자리, 부리돌기는 그 위쪽 앞으로 튀어나온 갈고리다.'],
    ];
  }

  openNote() {
    Audio.play('click');
    const o = this.overlay('메모지', 520, 340);
    // fit the note inside the panel below its header (texture is 340x260 px)
    const ns = Math.min((o.h - 90) / 260, (o.w - 60) / 340);
    o.c.add(this.add.image(o.x + o.w / 2, o.y + 50 + (o.h - 50) / 2, 'inv_note').setScale(ns).setAngle(-3));
    o.c.add(T(this, o.x + o.w / 2, o.y + 50 + (o.h - 50) / 2 - 4, '서랍 — 숫자 4자리\n순서는 일지 마지막 장\n번호는 S-01 사진', 20, '#4a3608', { ink: true, weight: '800', align: 'center', lineSpacing: 6 }).setOrigin(0.5).setAngle(-3));
    this.addClue('note', '메모 — 숫자는 사진, 순서는 일지');
  }

  // ---- drawer keypad: real digits, unlimited retries ----
  keypad(onOpen: () => void) {
    Audio.play('open');
    const cp = this.compact;
    const o = this.overlay('서랍 잠금장치 · 4자리', cp ? 760 : 640, 600);
    // short (phone) screens: display + notebook on the left, keys on the right, so nothing overlaps the keys
    const cx = cp ? o.x + o.w * 0.27 : o.x + o.w / 2;
    const disp = this.add.graphics(); o.c.add(disp);
    const dt = T(this, cx, o.y + 104, '', 40, '#7fffb2', { display: true, weight: '900' }).setOrigin(0.5); o.c.add(dt);
    const msg = T(this, cx, o.y + 146, '', 16, '#ffd2d8', { weight: '700', wordWrap: { width: this.compact ? 300 : 560 }, align: 'center' }).setOrigin(0.5, 0); o.c.add(msg);
    const dw = cp ? 250 : 320;
    const draw = (col = 0x0c1a12) => { disp.clear(); disp.fillStyle(col, 1); disp.fillRoundedRect(cx - dw / 2, o.y + 70, dw, 66, 10); disp.lineStyle(2, C.green, 0.8); disp.strokeRoundedRect(cx - dw / 2, o.y + 70, dw, 66, 10); dt.setText(this.code.padEnd(4, '·').split('').join(' ')); };
    draw();
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '확인'];
    const bw = cp ? 92 : 96, bh = cp ? Math.min(60, (o.h - 80 - 3 * 8) / 4) : 64, gap = cp ? 8 : 12;
    const kx = cp ? o.x + o.w * 0.73 : cx;
    const gx = kx - (bw * 3 + gap * 2) / 2, gy = cp ? o.y + 62 : o.y + 170;
    keys.forEach((kk, i) => {
      const x = gx + (i % 3) * (bw + gap) + bw / 2, y = gy + Math.floor(i / 3) * (bh + gap) + bh / 2;
      o.c.add(new Button(this, x, y, kk, () => {
        if (kk === '⌫') { this.code = this.code.slice(0, -1); Audio.play('click'); }
        else if (kk === '확인') {
          if (this.code.length < 4) { msg.setText('4자리를 모두 입력하세요'); Audio.play('error'); }
          else if (this.code === G.run.codes.scapula) {
            Audio.play('unlock'); msg.setText('').setColor('#7fffb2'); draw(0x0f3a22);
            G.run.flags.drawerOpen = true; this.drawerOpen = true; onOpen();
            this.time.delayedCall(700, () => { this.closeLayer(); this.openDrawer(); });
          } else {
            Audio.play('error'); G.run.mistakes++; msg.setText('삐— 비밀번호가 틀렸습니다. 다시 시도하세요.');
            this.tweens.add({ targets: o.c, x: '+=8', duration: 50, yoyo: true, repeat: 3 }); this.code = ''; draw(0x3a0f14);
            this.time.delayedCall(400, () => draw());
            return;
          }
        } else if (this.code.length < 4) { this.code += kk; Audio.play('beep'); }
        draw();
      }, { w: bw, h: bh, size: 24 }));
    });
    o.c.add(new Button(this, cx, cp ? o.y + 200 : o.y + o.h - 34, '기록장 보기', () => this.notebook(), { w: 200, h: 44, icon: 'book', size: 16 }));
  }

  // ---- open drawer: looks empty; the floor is a false bottom you lift by its finger notch ----
  openDrawer() {
    if (this.solved4) { this.setFeedback('서랍은 비어 있습니다. 표본은 이미 꺼냈습니다.', 'info'); return; }
    Audio.play('door');
    const o = this.overlay('열린 서랍', 760, 600);
    const k = Math.min((o.w - 60) / 600, (o.h - 110) / 330);
    const dx = o.x + o.w / 2 - 300 * k, dy = o.y + 66;
    o.c.add(this.add.image(dx, dy, 'inv_drawer').setOrigin(0).setScale(k * 0.5));
    // specimen case under the false bottom (revealed when the panel is lifted)
    const casePos = { x: dx + 300 * k, y: dy + 145 * k };
    const cs = this.add.image(casePos.x, casePos.y, 'inv_case').setScale(k * 0.5 * 1.3); o.c.add(cs);
    const bm = boneModel();
    const sc = this.add.image(casePos.x - 10 * k, casePos.y - 8 * k, 'bone_bone_scapula'); o.c.add(sc);
    sc.setScale(Math.min(300 * k / sc.width, 190 * k / sc.height) * 0.95).setAngle(-90);
    void bm;
    const panel = this.add.image(dx + 22 * k, dy + 22 * k, 'inv_panel').setOrigin(0).setScale(k * 0.5).setInteractive({ useHandCursor: true, draggable: true }); o.c.add(panel);
    const tip = T(this, dx + 300 * k, dy + 140 * k, '서랍이 비어 있다…?\n바닥판 오른쪽의 홈을 잡고 위로 끌어 올려 보세요', 17, '#ffe0a0', { weight: '700', align: 'center', lineSpacing: 4 }).setOrigin(0.5); o.c.add(tip);
    const lift = () => {
      if (this.panelUp) return; this.panelUp = true; Audio.play('open'); tip.setVisible(false);
      this.tweens.add({ targets: panel, y: panel.y - 230 * k, x: panel.x + 40 * k, angle: -8, alpha: 0.0, duration: 600, ease: 'Cubic.out' });
      this.setFeedback('이중 바닥이다! 아래에 표본 케이스가 숨겨져 있었다. 케이스를 눌러 표본을 꺼내세요.', 'ok');
      const take = this.add.zone(casePos.x - 190 * k, casePos.y - 130 * k, 380 * k, 260 * k).setOrigin(0).setInteractive({ useHandCursor: true }); o.c.add(take);
      take.on('pointerup', () => this.takeSpecimen(sc));
      this.flushInput();
    };
    let startY = 0;
    panel.on('dragstart', (p: Phaser.Input.Pointer) => { startY = p.worldY; });
    panel.on('drag', (p: Phaser.Input.Pointer) => { if (startY - p.worldY > 40) lift(); });
    // tapping the notch also works (accessibility); tapping elsewhere on the panel just knocks on it
    panel.on('pointerup', (p: Phaser.Input.Pointer) => {
      const lxp = (p.worldX - panel.x) / (panel.displayWidth);
      if (lxp > 0.82) lift(); else if (!this.panelUp) { Audio.play('click'); this.setFeedback('똑똑… 바닥판 아래가 비어 있는 소리가 난다. 오른쪽 홈을 잡아 보세요.', 'info'); }
    });
  }

  takeSpecimen(img: Phaser.GameObjects.Image) {
    if (this.taken) return; this.taken = true;
    Audio.play('pickup');
    this.tweens.add({ targets: img, y: img.y - 60, scale: img.scale * 1.2, duration: 500, ease: 'Back.out' });
    G.run.flags.scapulaFound = true;
    this.time.delayedCall(700, () => {
      this.closeLayer();
      const o = this.overlay('표본 S-01 회수 · 어깨뼈 Scapula', 860, 520, C.green);
      const im = this.add.image(o.x + 190, o.y + o.h / 2 + 20, 'bone_bone_scapula'); im.setScale(Math.min(260 / im.width, (o.h - 120) / im.height)); o.c.add(im);
      const tx = o.x + 360, tw = o.w - 390;
      o.c.add(T(this, tx, o.y + 80, '해부학 도감에 등록되었습니다', 19, C.greenS, { weight: '700' }));
      o.c.add(T(this, tx, o.y + 120, '어깨뼈는 팔이음뼈(어깨띠)를 이루는 납작한 삼각형 뼈. 가쪽각의 관절오목이 위팔뼈머리와 오목위팔관절을, 봉우리가 빗장뼈와 봉우리빗장관절을 만든다. 몸통 뼈대와는 직접 관절하지 않는다.', 17, '#d3def3', { wordWrap: { width: tw }, lineSpacing: 6 }));
      o.c.add(new Button(this, o.x + o.w - 130, o.y + o.h - 40, '계속', () => { Bus.emit('investigate:found', 'scapula'); this.scene.stop(); }, { w: 200, h: 50, icon: 'check', accent: C.green, primary: true }));
    });
  }

  // ------------------------------------------------------------------ photo frame
  buildFrame() {
    this.frame('벽 액자 조사 · 표본 S-01 사진', '사진을 자세히 보세요. 액자는 뒤집어 볼 수도 있습니다.', C.amber);
    const { cTop, cBot } = this;
    const k = Math.min((this.pw * 0.62) / 520, (cBot - cTop - 10) / 420);
    const fx = this.px + 30 + (this.pw * 0.62 - 520 * k) / 2, fy = cTop + (cBot - cTop - 420 * k) / 2;
    const cont = this.add.container(fx + 260 * k, fy + 210 * k);
    const front = this.add.container(0, 0); const back = this.add.container(0, 0).setVisible(false);
    cont.add([front, back]);
    front.add(this.add.image(0, 0, 'inv_frame').setScale(k * 0.5));
    // the photo: the real scapula model render, anterior view, with numbered stickers on four structures
    const bm = boneModel() as any;
    const photo = this.add.image(-6 * k, -2 * k, 'bone_bone_scapula'); front.add(photo);
    const ps = Math.min(380 * k / photo.width, 270 * k / photo.height); photo.setScale(ps);
    const pts = bm?.scapulaPoints as Record<string, [number, number]> | undefined;
    const code = G.run.codes.scapula;
    // sticker numbers: the code digits for the four ordered structures (each a different digit)
    SCAP_ORDER.forEach((id, i) => {
      const pt = pts?.[id] ?? [photo.width / 2, photo.height / 2];
      const [ox, oy] = STICK_OFF[id];
      // texture px -> container coords (photo is centred; image px are at density 2 of a 0.5-scaled texture)
      const sx = photo.x + (pt[0] + ox - photo.width / 2) * ps, sy = photo.y + (pt[1] + oy - photo.height / 2) * ps;
      const g = this.add.graphics(); front.add(g);
      g.lineStyle(2, 0xffe08a, 0.9); g.lineBetween(photo.x + (pt[0] - photo.width / 2) * ps, photo.y + (pt[1] - photo.height / 2) * ps, sx, sy);
      g.fillStyle(0xfff3c4, 1); g.fillCircle(sx, sy, 13 * Math.max(1, k)); g.lineStyle(2, 0x8a6a1a, 1); g.strokeCircle(sx, sy, 13 * Math.max(1, k));
      front.add(T(this, sx, sy, code[i], 17, '#3a2a05', { ink: true, weight: '900' }).setOrigin(0.5));
    });
    front.add(T(this, 0, 190 * k, 'S-01 · RIGHT SCAPULA · ANTERIOR', 13, '#5a4a2a', { ink: true, weight: '700', fine: true }).setOrigin(0.5));
    // back: handwritten note
    back.add(this.add.image(0, 0, 'inv_frame_back').setScale(k * 0.5));
    back.add(T(this, 0, -20 * k, '숫자만 봐서는 모른다.\n순서는 내 일지 마지막 장에.\n\n— H.', 24, '#3a2a14', { ink: true, weight: '700', align: 'center', lineSpacing: 8 }).setOrigin(0.5).setAngle(-2));
    // flip interaction (tap the frame or the button)
    let flipped = false;
    const flip = () => {
      Audio.play('rotate');
      this.tweens.add({ targets: cont, scaleX: 0, duration: 160, ease: 'Sine.in', onComplete: () => {
        flipped = !flipped; front.setVisible(!flipped); back.setVisible(flipped);
        this.tweens.add({ targets: cont, scaleX: 1, duration: 160, ease: 'Sine.out' });
        if (flipped) this.addClue('frame_back', '액자 뒷면 — 순서는 일지에');
      } });
    };
    const hz = this.add.zone(fx, fy, 520 * k, 420 * k).setOrigin(0).setInteractive({ useHandCursor: true });
    hz.on('pointerup', flip);
    this.addClue('photo', 'S-01 사진 — 구조마다 붙은 번호 스티커');
    // right column
    const rx = this.px + 30 + this.pw * 0.62 + 20, rw = this.px + this.pw - 30 - rx;
    T(this, rx, cTop + 10, '사진 관찰', 19, C.amberS, { weight: '700' });
    T(this, rx, cTop + 42, '몸 앞에서 본 오른쪽 어깨뼈 표본 사진이다. 네 곳에 번호 스티커가 붙어 있다.\n\n화면 왼쪽 = 가쪽(어깨 바깥쪽)\n위 = 몸쪽(머리 쪽)', 16, '#d3def3', { wordWrap: { width: rw }, lineSpacing: 6 });
    new Button(this, rx + Math.min(rw, 240) / 2, cBot - 30, '액자 뒤집기', flip, { w: Math.min(rw, 240), h: 52, icon: 'rotate', size: 18 });
    this.setFeedback('사진에 번호가 붙어 있다. 어떤 순서로 읽어야 할까?', 'info');
  }

  // ------------------------------------------------------------------ notebook + hints
  notebook() {
    Audio.play('open');
    const o = this.overlay('기록장 · 찾은 단서', 960, 620, C.cyan);
    const cl = G.run.clues;
    let y = o.y + 70; const x = o.x + 30, w = o.w - 60;
    if (!cl.length) { o.c.add(T(this, x, y, '아직 기록한 단서가 없습니다.', 17, C.dim)); return; }
    const textLines: string[] = [];
    if (cl.includes('note')) textLines.push('📝 메모: 서랍 — 숫자 4자리. 숫자는 S-01 사진, 순서는 일지 마지막 장.');
    if (cl.includes('frame_back')) textLines.push('🖼 액자 뒷면: "숫자만 봐서는 모른다. 순서는 내 일지 마지막 장에."');
    if (cl.includes('journal')) textLines.push('📖 일지 마지막 장 — 순서:\n' + SCAP_ORDER.map((id, i) => `    ${i + 1}. ${SCAP_KO[id]}${this.adv ? '' : ` — ${SCAP_DESC[id]}`}`).join('\n'));
    const hasPhoto = cl.includes('photo');
    const tw = hasPhoto ? w * 0.56 : w;
    const tt = T(this, x, y, textLines.join('\n\n') || '(사진만 찾았습니다)', 16, '#d3def3', { wordWrap: { width: tw }, lineSpacing: 5 }); o.c.add(tt);
    for (const sz of [16, 15]) { if (tt.y + tt.height < o.y + o.h - 20) break; tt.setFontSize(sz); }
    if (hasPhoto) {
      // a copy of the photo (with its stickers) so the code can be read while standing at the keypad
      const px = o.x + o.w * 0.62, pw = o.w * 0.36, ph = o.h - 110;
      const g = this.add.graphics(); g.fillStyle(0x0b1622, 1); g.fillRoundedRect(px, y, pw, ph, 8); g.lineStyle(2, 0xd9c08a, 1); g.strokeRoundedRect(px, y, pw, ph, 8); o.c.add(g);
      const photo = this.add.image(px + pw / 2, y + ph / 2 - 8, 'bone_bone_scapula'); o.c.add(photo);
      const ps = Math.min((pw - 30) / photo.width, (ph - 40) / photo.height); photo.setScale(ps);
      const pts = (boneModel() as any)?.scapulaPoints as Record<string, [number, number]> | undefined;
      SCAP_ORDER.forEach((id, i) => {
        const pt = pts?.[id] ?? [photo.width / 2, photo.height / 2]; const [ox, oy] = STICK_OFF[id];
        const sx = photo.x + (pt[0] + ox - photo.width / 2) * ps, sy = photo.y + (pt[1] + oy - photo.height / 2) * ps;
        const sg = this.add.graphics(); sg.fillStyle(0xfff3c4, 1); sg.fillCircle(sx, sy, 12); sg.lineStyle(2, 0x8a6a1a, 1); sg.strokeCircle(sx, sy, 12); o.c.add(sg);
        o.c.add(T(this, sx, sy, G.run.codes.scapula[i], 16, '#3a2a05', { ink: true, weight: '900' }).setOrigin(0.5));
      });
      o.c.add(T(this, px + pw / 2, y + ph - 14, '사진 S-01 (사본)', 15, '#d9c08a', { weight: '700' }).setOrigin(0.5));
    }
  }

  hint() {
    const cl = G.run.clues, adv = this.adv;
    const H: string[] = [];
    if (!cl.includes('journal')) H.push('책상 위의 초록색 일지를 펼쳐 보세요. 마지막 장까지 넘겨야 합니다.');
    if (!cl.includes('photo')) H.push('통로 북쪽 벽에 걸린 액자를 조사하세요. 사진에 숫자가 붙어 있습니다.');
    H.push('비밀번호 = 사진 속 스티커 번호를 일지에 적힌 구조 순서대로 읽은 4자리입니다.');
    H.push('사진은 앞에서 본 오른쪽 어깨뼈: 봉우리=가장 위 왼쪽(가쪽) 끝 · 부리돌기=관절오목 위로 앞쪽에 튀어나온 갈고리 · 관절오목=왼쪽 가장자리의 얕은 오목 · 아래각=맨 아래 꼭짓점.');
    if (!adv) H.push(`앞의 두 자리는 ${G.run.codes.scapula.slice(0, 2)} 입니다.`);
    if (this.drawerOpen && !this.panelUp) H.unshift('서랍 바닥판 오른쪽의 홈을 잡고 위로 끌어 올리세요 (이중 바닥).');
    const lv = Math.min(this.hintLv, H.length - 1);
    this.hintLv++; G.run.hintsUsed++;
    Audio.play('ai');
    this.setFeedback(`힌트 ${lv + 1}/${H.length}: ${H[lv]}`, 'warn');
  }
}
