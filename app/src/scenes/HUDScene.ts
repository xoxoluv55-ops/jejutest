import Phaser from 'phaser';
import { BaseScene } from './Base';
import { View } from '../core/view';
import { Audio } from '../core/audio';
import { G, Bus } from '../game/state';
import { Pad } from '../game/input';
import { ROOMS, PASSAGES } from '../data/map';
import { BONES, BoneId } from '../data/anatomy';
import { T, C, drawPanel, drawIcon, RoundButton, Button, IconName } from '../ui/widgets';
import type { GameScene, Mission } from './GameScene';

export class HUDScene extends BaseScene {
  constructor() { super('HUD'); }
  game2!: GameScene;
  missionC!: Phaser.GameObjects.Container;
  mapG!: Phaser.GameObjects.Graphics; mapDot!: Phaser.GameObjects.Graphics;
  mapRect = { x: 0, y: 0, w: 230, h: 170, s: 0.08, ox: 0, oy: 0 };
  invC!: Phaser.GameObjects.Container;
  btnAct!: RoundButton; btnScan!: RoundButton; btnBag!: RoundButton; btnMap!: RoundButton; btnPause!: RoundButton;
  promptT!: Phaser.GameObjects.Text; promptBg!: Phaser.GameObjects.Graphics;
  joyBase!: Phaser.GameObjects.Graphics; joyKnob!: Phaser.GameObjects.Graphics; joyId = -1; joyO = { x: 0, y: 0 };
  aiC?: Phaser.GameObjects.Container; aiTimer?: Phaser.Time.TimerEvent;
  toasts: Phaser.GameObjects.Container[] = [];
  timerT!: Phaser.GameObjects.Text;
  arrow!: Phaser.GameObjects.Graphics;
  scanCdG!: Phaser.GameObjects.Graphics;
  overlay?: Phaser.GameObjects.Container;
  lastTick: any = null;
  hidden = false;

  create() {
    this.initView();
    this.game2 = this.scene.get('Game') as GameScene;
    this.toasts = []; this.overlay = undefined; this.aiC = undefined; this.joyId = -1; this.hidden = false;
    this.build();
    const on = (ev: string, fn: (...a: any[]) => void) => { Bus.on(ev, fn, this); this.events.once('shutdown', () => Bus.off(ev, fn, this)); };
    on('mission', () => this.drawMissions());
    on('prompt', (p: any) => this.setPrompt(p));
    on('toast', (t: any) => this.toast(t.text, t.kind));
    on('ai', (a: any) => this.ai(a.text, a.kind, a.dur));
    on('pickup', () => this.drawInventory(true));
    on('timer', (s: number) => { this.timerT.setVisible(true).setText(`비상 전력  ${String(Math.max(0, Math.ceil(s))).padStart(2, '0')}s`); this.timerT.setColor(s < 20 ? '#ff5d74' : '#ffc24d'); });
    on('blackout', (v: boolean) => { if (!v) this.timerT.setVisible(false); });
    on('channel', (c: any) => this.channel(c.label, c.dur));
    on('tick', (t: any) => { this.lastTick = t; });
    on('ui:inventory', () => this.openInventory());
    on('ui:map', () => this.openMap());
    on('ui:pause', () => this.openPause());
    on('hud:hide', () => { this.hidden = true; this.tweens.add({ targets: this.children.list, alpha: 0, duration: 500 }); });
    on('scanned', () => { this.scanCd = 1.4; });
    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.input.on('pointerupoutside', this.onUp, this);
  }
  scanCd = 0;
  missionW = 390; missionH = 250;

  layout() {
    // rebuild everything at the new size, keep state
    this.children.removeAll(true); this.toasts = []; this.overlay = undefined; this.aiC = undefined;
    this.build();
  }

  build() {
    const { W, H } = View;
    const touch = this.sys.game.device.input.touch;
    // --- mission panel ---
    this.missionC = this.add.container(20, 20);
    this.drawMissions();
    // --- minimap ---
    const mw = 240, mh = 172;
    this.mapRect = { x: W - mw - 20, y: 20, w: mw, h: mh, s: 0, ox: 0, oy: 0 };
    const mg = this.add.graphics(); this.mapG = mg;
    drawPanel(mg, this.mapRect.x, this.mapRect.y, mw, mh, { accent: C.cyan, alpha: 0.75 });
    const bx0 = 120, by0 = 270, bw = 2700 - bx0, bh = 2340 - by0;
    const s = Math.min((mw - 24) / bw, (mh - 30) / bh);
    this.mapRect.s = s; this.mapRect.ox = this.mapRect.x + (mw - bw * s) / 2 - bx0 * s; this.mapRect.oy = this.mapRect.y + 22 + (mh - 26 - bh * s) / 2 - by0 * s;
    const R = this.mapRect;
    for (const r of [...ROOMS, ...PASSAGES]) { mg.fillStyle(0x16304a, 0.95); mg.fillRect(R.ox + r.x * s, R.oy + r.y * s, r.w * s, r.h * s); }
    for (const r of ROOMS) { mg.lineStyle(1, C.cyan, 0.5); mg.strokeRect(R.ox + r.x * s, R.oy + r.y * s, r.w * s, r.h * s); }
    T(this, R.x + 16, R.y + 12, 'BODY LAB · B4', 12, C.cyanS, { display: true }).setOrigin(0, 0.5);
    this.mapDot = this.add.graphics();
    const mz = this.add.zone(R.x, R.y, mw, mh).setOrigin(0).setInteractive({ useHandCursor: true });
    mz.on('pointerup', () => this.openMap());
    this.btnPause = new RoundButton(this, R.x - 40, R.y + 30, 24, 'pause', () => this.openPause(), C.cyan);
    this.btnPause.setActive2(true);
    // --- blackout timer ---
    this.timerT = T(this, W / 2, 34, '', 30, C.amberS, { display: true, weight: '900' }).setOrigin(0.5).setVisible(false);
    this.timerT.setShadow(0, 0, '#ff3355', 12, true, true);
    // --- action buttons ---
    const ax = W - 110, ay = H - 120;
    this.btnAct = new RoundButton(this, ax, ay, 66, 'hand', () => Bus.emit('input:interact'), C.cyan, touch ? '조작' : 'E · 조작');
    this.btnScan = new RoundButton(this, ax - 150, ay + 34, 44, 'scan', () => Bus.emit('input:scan'), C.violet, touch ? 'SCAN' : 'Space · SCAN');
    this.btnScan.setActive2(true);
    this.btnBag = new RoundButton(this, ax - 30, ay - 130, 34, 'bag', () => this.openInventory(), C.amber, touch ? '인벤토리' : 'Tab');
    this.btnMap = new RoundButton(this, ax - 120, ay - 98, 30, 'map', () => this.openMap(), C.cyan, touch ? '지도' : 'M');
    this.btnBag.setActive2(true); this.btnMap.setActive2(true);
    this.scanCdG = this.add.graphics();
    // prompt
    this.promptBg = this.add.graphics();
    this.promptT = T(this, ax, ay - 92, '', 18, C.white, { weight: '700' }).setOrigin(1, 0.5).setVisible(false);
    // --- inventory strip ---
    this.invC = this.add.container(W / 2, H - 48);
    this.drawInventory(false);
    // --- joystick ---
    this.joyBase = this.add.graphics().setVisible(false); this.joyKnob = this.add.graphics().setVisible(false);
    if (touch) {
      const hint = this.add.graphics(); hint.lineStyle(2, 0x6b7fa3, 0.25); hint.strokeCircle(150, H - 150, 80); hint.fillStyle(0x6b7fa3, 0.12); hint.fillCircle(150, H - 150, 34);
      this.tweens.add({ targets: hint, alpha: 0.4, duration: 1200, yoyo: true, repeat: -1 });
      hint.setName('joyhint');
    }
    // guidance arrow
    this.arrow = this.add.graphics();
  }

  // ------------------------------------------------------------ missions
  drawMissions() {
    const c = this.missionC; if (!c) return; c.removeAll(true);
    const ms: Mission[] = this.game2?.missions ? this.game2.missions() : [];
    const w = Math.min(390, View.W * 0.32), lh = 30;
    const h = 62 + ms.length * lh + 12;
    this.missionW = w; this.missionH = h;
    const g = this.add.graphics(); drawPanel(g, 0, 0, w, h, { accent: C.red, alpha: 0.78, header: 44 }); c.add(g);
    c.add(T(this, 18, 22, 'CH.1', 15, C.redS, { display: true, weight: '900' }).setOrigin(0, 0.5));
    c.add(T(this, 68, 22, '골격 복구실 — 미션', 18, C.white, { weight: '700' }).setOrigin(0, 0.5));
    const f = G.run.flags; const n = [f.assembled, f.aligned, f.xray].filter(Boolean).length;
    for (let i = 0; i < 3; i++) { const lit = i < n; g.fillStyle(lit ? C.green : C.red, lit ? 1 : 0.6); g.fillCircle(w - 66 + i * 20, 22, 6); g.lineStyle(1, 0xffffff, 0.3); g.strokeCircle(w - 66 + i * 20, 22, 6); }
    ms.forEach((m, i) => {
      const y = 62 + i * lh;
      const col = m.done ? C.greenS : m.active ? C.white : '#61718f';
      g.lineStyle(1.6, m.done ? C.green : m.active ? C.cyan : 0x445270, 1); g.strokeRect(18, y - 8, 16, 16);
      if (m.done) drawIcon(g, 'check', 26, y, 15, C.green);
      else if (m.active) { g.fillStyle(C.cyan, 0.9); g.fillRect(22, y - 4, 8, 8); }
      const t = T(this, 44, y, m.text, 16, col, { weight: m.active ? '700' : '600' }).setOrigin(0, 0.5);
      if (m.done) t.setAlpha(0.7);
      c.add(t);
      if (m.tag) c.add(T(this, w - 16, y, m.tag, 11, m.done ? C.greenS : '#7d8bb0', { display: true }).setOrigin(1, 0.5));
    });
  }

  // ------------------------------------------------------------ inventory
  drawInventory(flash: boolean) {
    const c = this.invC; c.removeAll(true);
    const ids: BoneId[] = G.run.bones;
    const slot = 64, gap = 8, n = 6;
    const w = n * slot + (n - 1) * gap + 24;
    const g = this.add.graphics(); drawPanel(g, -w / 2, -slot / 2 - 12, w, slot + 24, { accent: C.amber, alpha: 0.7, cut: 10 }); c.add(g);
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + 12 + i * (slot + gap) + slot / 2;
      g.fillStyle(0x050810, 0.9); g.fillRoundedRect(x - slot / 2, -slot / 2, slot, slot, 6);
      g.lineStyle(1, ids[i] ? C.amber : 0x2a3654, ids[i] ? 0.8 : 1); g.strokeRoundedRect(x - slot / 2, -slot / 2, slot, slot, 6);
      const id = ids[i];
      if (id) {
        const im = this.add.image(x, 0, `bone_bone_${id}`); const s = (slot - 10) / Math.max(im.width, im.height); im.setScale(s);
        if (BONES[id].prims.length && (id === 'humerus' || id === 'radius' || id === 'ulna' || id === 'fibula')) im.setAngle(35);
        c.add(im);
        const z = this.add.zone(x, 0, slot, slot).setInteractive({ useHandCursor: true });
        z.on('pointerup', () => this.openInventory(id)); c.add(z);
        if (flash && i === ids.length - 1) { im.setScale(s * 2); this.tweens.add({ targets: im, scale: s, duration: 400, ease: 'Back.out' }); }
      } else {
        drawIcon(g, 'bone', x, 0, 22, 0x2a3654);
      }
    }
  }

  // ------------------------------------------------------------ prompts / feedback
  setPrompt(p: { label: string; icon: IconName; locked: boolean } | null) {
    this.btnAct.setActive2(!!p);
    if (p) { this.btnAct.icon = p.icon; this.btnAct.accent = p.locked ? C.amber : C.cyan; this.btnAct.draw(); }
    else { this.btnAct.icon = 'hand'; this.btnAct.draw(); }
    const g = this.promptBg; g.clear();
    if (!p) { this.promptT.setVisible(false); return; }
    this.promptT.setText(p.label).setVisible(true);
    const w = this.promptT.width + 34, x = this.promptT.x - this.promptT.width - 20, y = this.promptT.y;
    g.fillStyle(0x060a14, 0.85); g.fillRoundedRect(x, y - 19, w, 38, 8);
    g.lineStyle(1.5, p.locked ? C.amber : C.cyan, 0.9); g.strokeRoundedRect(x, y - 19, w, 38, 8);
    if (p.locked) drawIcon(g, 'lock', x - 18, y, 18, C.amber);
  }

  toast(text: string, kind: 'info' | 'warn' | 'ok' | 'err' = 'info') {
    const { W, H } = View;
    const col = { info: C.cyan, warn: C.amber, ok: C.green, err: C.red }[kind];
    const c = this.add.container(W / 2, H * 0.72);
    const t = T(this, 0, 0, text, 18, C.white, { weight: '700', align: 'center', wordWrap: { width: Math.min(720, W - 80) } }).setOrigin(0.5);
    const g = this.add.graphics();
    const w = t.width + 50, h = t.height + 22;
    g.fillStyle(0x050810, 0.88); g.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
    g.lineStyle(1.6, col, 0.95); g.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
    g.fillStyle(col, 1); g.fillRect(-w / 2 + 8, -h / 2 + 8, 3, h - 16);
    c.add([g, t]);
    for (const o of this.toasts) this.tweens.add({ targets: o, y: o.y - (h + 10), duration: 200 });
    this.toasts.push(c);
    c.setAlpha(0).setScale(0.9);
    this.tweens.add({ targets: c, alpha: 1, scale: 1, duration: 180, ease: 'Back.out' });
    this.time.delayedCall(kind === 'warn' || kind === 'err' ? 3600 : 2600, () => this.tweens.add({ targets: c, alpha: 0, duration: 300, onComplete: () => { c.destroy(); this.toasts = this.toasts.filter(x => x !== c); } }));
    if (this.toasts.length > 3) { const o = this.toasts.shift()!; o.destroy(); }
  }

  ai(text: string, kind: 'ai' | 'warn' | 'ok', dur: number) {
    const { W } = View;
    this.aiC?.destroy(); this.aiTimer?.remove();
    const col = kind === 'warn' ? C.red : kind === 'ok' ? C.green : C.cyan;
    const colS = kind === 'warn' ? '#ff5d74' : kind === 'ok' ? C.greenS : C.cyanS;
    const left = 20 + this.missionW + 16, right = W - 340;
    const wide = right - left >= 480;
    const w = wide ? Math.min(760, right - left) : Math.min(760, W - 40), h = 92;
    const y = wide ? (this.timerT.visible ? 70 : 20) : this.missionH + 34;
    const ax = wide ? left + (right - left - w) / 2 : W / 2 - w / 2;
    const c = this.add.container(ax, y); this.aiC = c;
    const g = this.add.graphics(); drawPanel(g, 0, 0, w, h, { accent: col, alpha: 0.88 }); c.add(g);
    // AI "eye"
    g.fillStyle(col, 0.18); g.fillCircle(46, h / 2, 28); g.lineStyle(2, col, 1); g.strokeCircle(46, h / 2, 22); g.fillStyle(col, 1); g.fillCircle(46, h / 2, 8);
    c.add(T(this, 86, 20, kind === 'warn' ? 'MERIDIAN · WARNING' : 'MERIDIAN · 중앙 AI', 13, colS, { display: true }).setOrigin(0, 0.5));
    const t = T(this, 86, 54, '', 19, C.white, { weight: '700', wordWrap: { width: w - 110 } }).setOrigin(0, 0.5); c.add(t);
    Audio.play(kind === 'warn' ? 'error' : 'ai');
    let i = 0;
    this.aiTimer = this.time.addEvent({ delay: 26, repeat: text.length - 1, callback: () => { i++; t.setText(text.slice(0, i)); if (i % 3 === 0) Audio.play('type'); } });
    c.setAlpha(0); c.y -= 10;
    this.tweens.add({ targets: c, alpha: 1, y: y, duration: 220 });
    this.time.delayedCall(dur, () => { if (this.aiC === c) this.tweens.add({ targets: c, alpha: 0, duration: 300, onComplete: () => c.destroy() }); });
  }

  channel(label: string, dur: number) {
    const { W, H } = View;
    const c = this.add.container(W / 2, H * 0.6);
    const g = this.add.graphics(); c.add(g);
    const t = T(this, 0, -26, label, 18, C.white, { weight: '700' }).setOrigin(0.5); c.add(t);
    const o = { p: 0 };
    this.tweens.add({ targets: o, p: 1, duration: dur, onUpdate: () => { g.clear(); g.fillStyle(0x050810, 0.85); g.fillRoundedRect(-160, -8, 320, 16, 8); g.fillStyle(C.cyan, 1); g.fillRoundedRect(-157, -5, 314 * o.p, 10, 5); }, onComplete: () => this.tweens.add({ targets: c, alpha: 0, duration: 250, onComplete: () => c.destroy() }) });
  }

  // ------------------------------------------------------------ overlays
  modal(title: string, w: number, h: number, accent = C.cyan) {
    this.overlay?.destroy();
    const { W, H } = View;
    const c = this.add.container(0, 0).setDepth(100); this.overlay = c;
    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.65).setInteractive(); c.add(dim);
    w = Math.min(w, W - 40); h = Math.min(h, H - 40);
    const x = W / 2 - w / 2, y = H / 2 - h / 2;
    const g = this.add.graphics(); drawPanel(g, x, y, w, h, { accent, header: 54 }); c.add(g);
    c.add(T(this, x + 28, y + 27, title, 21, C.white, { weight: '700' }).setOrigin(0, 0.5));
    const close = new RoundButton(this, x + w - 34, y + 27, 18, 'close', () => this.closeOverlay(), accent); close.setActive2(true); c.add(close);
    this.game2.busy = true; Pad.x = Pad.y = 0;
    c.setAlpha(0); this.tweens.add({ targets: c, alpha: 1, duration: 160 });
    Audio.play('open');
    return { c, x, y, w, h };
  }
  closeOverlay() { if (!this.overlay) return; const c = this.overlay; this.overlay = undefined; this.game2.busy = false; Audio.play('close'); this.tweens.add({ targets: c, alpha: 0, duration: 140, onComplete: () => c.destroy() }); }

  openInventory(sel?: BoneId) {
    if (this.overlay || this.game2.player?.frozen) return;
    const ids = G.run.bones;
    const m = this.modal(`인벤토리 · 골격 표본 (${ids.length}/6)`, 900, 560, C.amber);
    let cur: BoneId | undefined = sel ?? ids[ids.length - 1];
    const detail = this.add.container(0, 0); m.c.add(detail);
    const show = () => {
      detail.removeAll(true);
      if (!cur) { detail.add(T(this, m.x + m.w / 2, m.y + m.h / 2, '아직 회수한 표본이 없습니다.\nSCAN으로 숨겨진 표본을 찾아보세요.', 18, C.dim, { align: 'center' }).setOrigin(0.5)); return; }
      const b = BONES[cur];
      const gx = m.x + 300;
      const im = this.add.image(gx + 150, m.y + 300, `bone_bone_${cur}`); im.setScale(Math.min(380 / im.height, 260 / im.width)); detail.add(im);
      const tx = gx + 320;
      detail.add(T(this, tx, m.y + 90, `${b.ko} (${b.alt})`, 28, C.white, { weight: '700' }));
      detail.add(T(this, tx, m.y + 130, b.en, 18, C.amberS, { display: true }));
      detail.add(T(this, tx, m.y + 170, b.info, 17, '#c9d6ee', { wordWrap: { width: m.x + m.w - tx - 30 }, lineSpacing: 6 }));
      detail.add(T(this, tx, m.y + m.h - 50, b.region === 'upper' ? '분류: 상지 골격' : '분류: 하지 골격', 15, C.dim));
    };
    ids.forEach((id, i) => {
      const bx = m.x + 30, by = m.y + 76 + i * 72;
      const g = this.add.graphics(); m.c.add(g);
      const on = id === cur;
      g.fillStyle(on ? C.amber : 0x0a1222, on ? 0.18 : 0.9); g.fillRoundedRect(bx, by, 240, 62, 8); g.lineStyle(1, on ? C.amber : C.line, 1); g.strokeRoundedRect(bx, by, 240, 62, 8);
      const im = this.add.image(bx + 34, by + 31, `bone_bone_${id}`); im.setScale(52 / Math.max(im.width, im.height)); m.c.add(im);
      m.c.add(T(this, bx + 70, by + 31, `${BONES[id].ko} · ${BONES[id].en}`, 16, C.white, { weight: '700' }).setOrigin(0, 0.5));
      const z = this.add.zone(bx, by, 240, 62).setOrigin(0).setInteractive({ useHandCursor: true }); m.c.add(z);
      z.on('pointerup', () => { this.closeOverlay(); this.time.delayedCall(150, () => this.openInventory(id)); });
    });
    show();
  }

  openMap() {
    if (this.overlay || this.game2.player?.frozen) return;
    const m = this.modal('시설 지도 · BODY LAB 지하 4층', 1100, 760);
    const bx0 = 100, by0 = 250, bw = 2720 - bx0, bh = 2360 - by0;
    const s = Math.min((m.w - 60) / bw, (m.h - 100) / bh);
    const ox = m.x + (m.w - bw * s) / 2 - bx0 * s, oy = m.y + 70 + (m.h - 90 - bh * s) / 2 - by0 * s;
    const g = this.add.graphics(); m.c.add(g);
    for (const r of [...ROOMS, ...PASSAGES]) { g.fillStyle(0x16304a, 1); g.fillRect(ox + r.x * s, oy + r.y * s, r.w * s, r.h * s); }
    const f = G.run.flags;
    for (const r of ROOMS) {
      const locked = (r.id === 'xray' && !f.power) || (r.id === 'lift' && !f.gate);
      g.lineStyle(2, locked ? C.red : C.cyan, 0.8); g.strokeRect(ox + r.x * s, oy + r.y * s, r.w * s, r.h * s);
      m.c.add(T(this, ox + (r.x + r.w / 2) * s, oy + (r.y + r.h / 2) * s - 10, r.code, 15, locked ? C.redS : C.cyanS, { display: true }).setOrigin(0.5));
      m.c.add(T(this, ox + (r.x + r.w / 2) * s, oy + (r.y + r.h / 2) * s + 12, r.name + (locked ? ' 🔒' : ''), 14, C.white).setOrigin(0.5));
    }
    const t = this.lastTick;
    if (t) {
      g.fillStyle(0xffffff, 1); g.fillCircle(ox + t.px * s, oy + t.py * s, 7); g.lineStyle(2, C.cyan, 1); g.strokeCircle(ox + t.px * s, oy + t.py * s, 12);
      if (t.obj) { g.lineStyle(2, C.amber, 1); g.strokeCircle(ox + t.obj.x * s, oy + t.obj.y * s, 10); g.fillStyle(C.amber, 1); g.fillCircle(ox + t.obj.x * s, oy + t.obj.y * s, 4); }
    }
    m.c.add(T(this, m.x + 28, m.y + m.h - 24, '○ 현재 위치    ◎ 다음 목표    붉은 테두리 = 잠긴 구역', 14, C.dim).setOrigin(0, 0.5));
  }

  openPause() {
    if (this.overlay || this.game2.player?.frozen) return;
    const m = this.modal('일시 정지', 520, 470);
    const cx = m.x + m.w / 2;
    const items: [string, IconName, () => void][] = [
      ['계속하기', 'play', () => this.closeOverlay()],
      ['해부학 도감', 'book', () => { this.closeOverlay(); this.scene.launch('Archive', { from: 'Game' }); this.game2.busy = true; this.scene.pause('Game'); this.scene.sleep(); }],
      ['설정', 'gear', () => { this.closeOverlay(); this.scene.launch('Info', { mode: 'settings', from: 'Game' }); }],
      ['타이틀로 나가기', 'back', () => { this.closeOverlay(); Audio.alarm(false); Audio.heartbeat(false); Audio.setMusic('none'); Bus.emit('game:quit'); }],
    ];
    items.forEach(([t, ic, fn], i) => m.c.add(new Button(this, cx, m.y + 110 + i * 80, t, fn, { w: 360, h: 62, icon: ic, accent: i === 3 ? C.red : C.cyan })));
    const sec = Math.floor((this.game2.time.now - G.run.startTime) / 1000);
    m.c.add(T(this, cx, m.y + m.h - 30, `경과 ${Math.floor(sec / 60)}분 ${sec % 60}초 · 스캔 ${G.run.scans}회 · 실수 ${G.run.mistakes}회`, 14, C.dim).setOrigin(0.5));
  }

  // ------------------------------------------------------------ joystick
  onDown(p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) {
    Audio.unlock();
    if (over.length || this.overlay || this.joyId !== -1) return;
    const l = this.lp(p);
    if (l.x > View.W * 0.55) return;
    this.joyId = p.id; this.joyO = { x: l.x, y: l.y };
    this.joyBase.setVisible(true); this.joyKnob.setVisible(true);
    (this.children.getByName('joyhint') as Phaser.GameObjects.Graphics | null)?.setVisible(false);
    this.drawJoy(l.x, l.y);
  }
  onMove(p: Phaser.Input.Pointer) {
    if (p.id !== this.joyId) return;
    const l = this.lp(p);
    let dx = l.x - this.joyO.x, dy = l.y - this.joyO.y;
    const R = 78; const d = Math.hypot(dx, dy);
    if (d > R * 1.6) { // let the base follow the finger
      this.joyO.x += dx * (1 - R * 1.6 / d); this.joyO.y += dy * (1 - R * 1.6 / d);
      dx = l.x - this.joyO.x; dy = l.y - this.joyO.y;
    }
    const m = Math.min(1, Math.hypot(dx, dy) / R);
    const a = Math.atan2(dy, dx);
    const dead = 0.12;
    const mm = m < dead ? 0 : (m - dead) / (1 - dead);
    Pad.x = Math.cos(a) * mm; Pad.y = Math.sin(a) * mm; Pad.run = Math.hypot(dx, dy) > R * 1.15; Pad.active = true;
    this.drawJoy(this.joyO.x + Math.cos(a) * Math.min(R, Math.hypot(dx, dy)), this.joyO.y + Math.sin(a) * Math.min(R, Math.hypot(dx, dy)));
  }
  onUp(p: Phaser.Input.Pointer) {
    if (p.id !== this.joyId) return;
    this.joyId = -1; Pad.x = Pad.y = 0; Pad.active = false; Pad.run = false;
    this.joyBase.setVisible(false); this.joyKnob.setVisible(false);
  }
  drawJoy(kx: number, ky: number) {
    const b = this.joyBase, k = this.joyKnob; b.clear(); k.clear();
    b.fillStyle(0x050810, 0.45); b.fillCircle(this.joyO.x, this.joyO.y, 82);
    b.lineStyle(2, Pad.run ? C.violet : C.cyan, 0.6); b.strokeCircle(this.joyO.x, this.joyO.y, 82);
    b.lineStyle(1, C.cyan, 0.25); b.strokeCircle(this.joyO.x, this.joyO.y, 82 * 1.15);
    k.fillStyle(Pad.run ? C.violet : C.cyan, 0.25); k.fillCircle(kx, ky, 40);
    k.fillStyle(0xdff6ff, 0.9); k.fillCircle(kx, ky, 26); k.lineStyle(2, Pad.run ? C.violet : C.cyan, 1); k.strokeCircle(kx, ky, 30);
  }

  // ------------------------------------------------------------ per-frame
  update(_t: number, dms: number) {
    if (this.hidden) return;
    const t = this.lastTick; if (!t) return;
    const R = this.mapRect;
    const g = this.mapDot; g.clear();
    const now = this.time.now / 1000;
    if (t.obj) { g.lineStyle(2, C.amber, 0.5 + 0.5 * Math.sin(now * 5)); g.strokeCircle(R.ox + t.obj.x * R.s, R.oy + t.obj.y * R.s, 6); }
    g.fillStyle(0xffffff, 1); g.fillCircle(R.ox + t.px * R.s, R.oy + t.py * R.s, 3.5);
    g.lineStyle(1.5, C.cyan, 0.8); g.strokeCircle(R.ox + t.px * R.s, R.oy + t.py * R.s, 6 + (now * 8) % 6);
    // scan cooldown ring
    this.scanCd = Math.max(0, this.scanCd - dms / 1000);
    const sg = this.scanCdG; sg.clear();
    if (this.scanCd > 0) { sg.lineStyle(4, C.violet, 0.9); sg.beginPath(); sg.arc(this.btnScan.x, this.btnScan.y, 50, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - this.scanCd / 1.4)); sg.strokePath(); }
    // objective arrow at screen edge
    const a = this.arrow; a.clear();
    if (t.obj && t.cam) {
      const v = t.cam; const { W, H } = View;
      const sx = (t.obj.x - v.x) / v.width * W, sy = (t.obj.y - v.y) / v.height * H;
      const m = 90;
      if (sx < m || sx > W - m || sy < m || sy > H - m) {
        const cx = W / 2, cy = H / 2; const ang = Math.atan2(sy - cy, sx - cx);
        const rx = W / 2 - m, ry = H / 2 - m;
        const k = Math.min(rx / Math.abs(Math.cos(ang) || 1e-6), ry / Math.abs(Math.sin(ang) || 1e-6));
        const x = cx + Math.cos(ang) * k, y = cy + Math.sin(ang) * k;
        const pulse = 1 + 0.12 * Math.sin(now * 6);
        a.fillStyle(C.amber, 0.18); a.fillCircle(x, y, 26 * pulse);
        a.fillStyle(C.amber, 0.95);
        const p = (d: number, o: number) => ({ x: x + Math.cos(ang + o) * d, y: y + Math.sin(ang + o) * d });
        const p1 = p(18 * pulse, 0), p2 = p(12, 2.4), p3 = p(12, -2.4);
        a.fillTriangle(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
      }
    }
  }
}
