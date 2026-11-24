import Phaser from 'phaser';
import { BaseScene } from './Base';
import { View } from '../core/view';
import { Audio } from '../core/audio';
import { G, Bus, worldKey } from '../game/state';
import { saveRun } from '../core/save';
import { Pad } from '../game/input';

import { T, C, drawPanel, drawIcon, RoundButton, Button, IconName } from '../ui/widgets';
import type { GameScene, Mission } from './GameScene';
import { BONE_QUIZ } from '../data/boneQuiz';
import { BONES, BoneId } from '../data/anatomy';

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
    this.game2 = this.scene.get(worldKey()) as GameScene;
    this.toasts = []; this.overlay = undefined; this.aiC = undefined; this.joyId = -1; this.hidden = false;
    this.build();
    const on = (ev: string, fn: (...a: any[]) => void) => { Bus.on(ev, fn, this); this.events.once('shutdown', () => Bus.off(ev, fn, this)); };
    on('mission', () => this.drawMissions());
    on('prompt', (p: any) => this.setPrompt(p));
    on('toast', (t: any) => this.toast(t.text, t.kind));
    on('ai', (a: any) => this.ai(a.text, a.kind, a.dur));
    on('pickup', () => this.drawInventory(true));
    on('timer', (s: number, label?: string) => {
      if (s < 0) { this.timerT.setVisible(false); return; }
      this.timerT.setVisible(true).setText(`${label ?? this.game2.timerLabel()}  ${String(Math.max(0, Math.ceil(s))).padStart(2, '0')}s`); this.timerT.setColor(s < 20 ? '#ff5d74' : '#ffc24d');
    });
    on('hp', (k?: string) => this.drawHearts(k === 'hit'));
    on('ident', (id: BoneId) => this.openIdent(id));
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
  hpC?: Phaser.GameObjects.Container;
  threatG!: Phaser.GameObjects.Graphics;
  /** phone landscape (logical height ≈ 450–600): smaller minimap/buttons, mission panel folds to the active line */
  get tiny() { return View.H < 640; }
  missionOpen = false;

  layout() {
    // rebuild everything at the new size, keep state
    this.children.removeAll(true); this.toasts = []; this.overlay = undefined; this.aiC = undefined;
    this.build();
  }

  build() {
    const { W, H } = View;
    const touch = this.sys.game.device.input.touch;
    // --- mission panel ---
    const tn = this.tiny, mg0 = tn ? 10 : 20;
    this.missionC = this.add.container(mg0, mg0);
    this.hpC = this.add.container(mg0, mg0);
    this.drawMissions();
    // --- minimap ---
    const mw = tn ? 180 : 240, mh = tn ? 116 : 172;
    this.mapRect = { x: W - mw - mg0, y: mg0, w: mw, h: mh, s: 0, ox: 0, oy: 0 };
    const mg = this.add.graphics(); this.mapG = mg;
    drawPanel(mg, this.mapRect.x, this.mapRect.y, mw, mh, { accent: C.cyan, alpha: 0.75 });
    const bx0 = 120, by0 = 270, bw = 2700 - bx0, bh = 2340 - by0;
    const s = Math.min((mw - 24) / bw, (mh - 30) / bh);
    this.mapRect.s = s; this.mapRect.ox = this.mapRect.x + (mw - bw * s) / 2 - bx0 * s; this.mapRect.oy = this.mapRect.y + 22 + (mh - 26 - bh * s) / 2 - by0 * s;
    const R = this.mapRect;
    for (const r of [...this.game2.map.ROOMS, ...this.game2.map.PASSAGES]) { mg.fillStyle(0x16304a, 0.95); mg.fillRect(R.ox + r.x * s, R.oy + r.y * s, r.w * s, r.h * s); }
    for (const r of this.game2.map.ROOMS) { mg.lineStyle(1, C.cyan, 0.5); mg.strokeRect(R.ox + r.x * s, R.oy + r.y * s, r.w * s, r.h * s); }
    T(this, R.x + 16, R.y + 12, this.game2.floorName(), 12, C.cyanS, { display: true }).setOrigin(0, 0.5);
    this.mapDot = this.add.graphics();
    const mz = this.add.zone(R.x, R.y, mw, mh).setOrigin(0).setInteractive({ useHandCursor: true });
    this.tapOnly(mz, () => this.openMap());
    this.btnPause = new RoundButton(this, R.x - (tn ? 30 : 40), R.y + (tn ? 24 : 30), tn ? 22 : 26, 'pause', () => this.openPause(), C.cyan, '일시정지');
    this.btnPause.setActive2(true);
    // --- blackout timer ---
    this.timerT = T(this, W / 2, 34, '', 30, C.amberS, { display: true, weight: '900' }).setOrigin(0.5).setVisible(false);
    this.timerT.setShadow(0, 0, '#ff3355', 12, true, true);
    // --- action buttons ---
    const ax = W - (tn ? 84 : 110), ay = H - (tn ? 84 : 120);
    this.btnAct = new RoundButton(this, ax, ay, tn ? 52 : 66, 'hand', () => Bus.emit('input:interact'), C.cyan, touch ? '조작' : 'E · 조작');
    // v0.7: SCAN removed (things are found by investigating objects, not by a radar pulse)
    this.btnScan = new RoundButton(this, -999, -999, 1, 'scan', () => { /* removed */ }, C.violet).setVisible(false);
    this.btnBag = new RoundButton(this, ax - (tn ? 10 : 30), ay - (tn ? 104 : 130), tn ? 28 : 34, 'bag', () => this.openInventory(), C.amber, touch ? '인벤토리' : 'Tab');
    this.btnMap = new RoundButton(this, ax - (tn ? 96 : 120), ay - (tn ? 80 : 98), tn ? 26 : 30, 'map', () => this.openMap(), C.cyan, touch ? '지도' : 'M');
    this.btnBag.setActive2(true); this.btnMap.setActive2(true);
    this.scanCdG = this.add.graphics();
    // prompt
    this.promptBg = this.add.graphics();
    this.promptT = T(this, tn ? ax + 60 : ax, ay - (tn ? 150 : 92), '', tn ? 17 : 18, C.white, { weight: '700' }).setOrigin(1, 0.5).setVisible(false);
    // --- inventory strip ---
    this.invC = this.add.container(W / 2, H - (tn ? 34 : 48));
    this.drawInventory(false);
    // --- joystick ---
    this.joyBase = this.add.graphics().setVisible(false); this.joyKnob = this.add.graphics().setVisible(false);
    if (touch) {
      const hint = this.add.graphics(); hint.lineStyle(2, 0x6b7fa3, 0.25); const jx = tn ? 110 : 150, jy = H - (tn ? 110 : 150);
      hint.strokeCircle(jx, jy, tn ? 62 : 80); hint.fillStyle(0x6b7fa3, 0.12); hint.fillCircle(jx, jy, tn ? 26 : 34);
      this.tweens.add({ targets: hint, alpha: 0.4, duration: 1200, yoyo: true, repeat: -1 });
      hint.setName('joyhint');
    }
    // guidance arrow + off-screen threat warnings
    this.arrow = this.add.graphics();
    this.threatG = this.add.graphics();
  }

  // ------------------------------------------------------------ missions
  drawMissions() {
    const c = this.missionC; if (!c) return; c.removeAll(true);
    const ms: Mission[] = this.game2?.missions ? this.game2.missions() : [];
    const tn = this.tiny;
    const w = Math.min(390, View.W * 0.32), lh = tn ? 26 : 30;
    // phone: only the active mission unless the player taps the panel to unfold it
    const folded = !this.missionOpen;   // v0.5: folded on every screen (closer camera needs the space)
    const shown = folded ? ms.filter(m => m.active).slice(0, 1) : ms;
    const top = tn ? 54 : 62;
    const h = top + shown.length * lh + (tn ? 24 : 28);   // + a row for the fold toggle
    this.missionW = w; this.missionH = h;
    const g = this.add.graphics(); drawPanel(g, 0, 0, w, h, { accent: C.red, alpha: 0.78, header: 44 }); c.add(g);
    c.add(T(this, 18, 22, `CH.${G.run.chapter}`, 15, C.redS, { display: true, weight: '900' }).setOrigin(0, 0.5));
    c.add(T(this, 68, 22, `${this.game2.chapterName()} — 미션`, 18, C.white, { weight: '700' }).setOrigin(0, 0.5));
    const n = this.game2.locksOpen();
    for (let i = 0; i < 3; i++) { const lit = i < n; g.fillStyle(lit ? C.green : C.red, lit ? 1 : 0.6); g.fillCircle(w - 66 + i * 20, 22, 6); g.lineStyle(1, 0xffffff, 0.3); g.strokeCircle(w - 66 + i * 20, 22, 6); }
    {
      c.add(T(this, w - 16, h - 12, folded ? `▼ 미션 전체 보기 (${ms.length})` : '▲ 접기', 13, '#9fb0d0', { fine: true }).setOrigin(1, 0.5));
      const z = this.add.zone(0, 0, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
      this.tapOnly(z, () => { this.missionOpen = !this.missionOpen; Audio.play('click'); this.drawMissions(); });
      c.add(z);
    }
    shown.forEach((m, i) => {
      const y = top + i * lh;
      const col = m.done ? C.greenS : m.active ? C.white : '#61718f';
      g.lineStyle(1.6, m.done ? C.green : m.active ? C.cyan : 0x445270, 1); g.strokeRect(18, y - 8, 16, 16);
      if (m.done) drawIcon(g, 'check', 26, y, 15, C.green);
      else if (m.active) { g.fillStyle(C.cyan, 0.9); g.fillRect(22, y - 4, 8, 8); }
      const t = T(this, 44, y, m.text, tn ? 15 : 16, col, { weight: m.active ? '700' : '600' }).setOrigin(0, 0.5);
      if (m.done) t.setAlpha(0.7);
      c.add(t);
      if (m.tag) c.add(T(this, w - 16, y, m.tag, 11, m.done ? C.greenS : '#7d8bb0', { display: true }).setOrigin(1, 0.5));
    });
    this.drawHearts();
  }

  // ------------------------------------------------------------ hearts / shield / keycard (v0.5)
  drawHearts(hit = false) {
    const c = this.hpC; if (!c) return;
    c.removeAll(true);
    const r = G.run, tn = this.tiny, sz = tn ? 26 : 32, gap = tn ? 6 : 8;
    c.setPosition(this.missionC.x, this.missionC.y + this.missionH + (tn ? 6 : 10));
    const bg = this.add.graphics(); c.add(bg);
    const n = 3, extra = (r.shield ? 1 : 0) + (r.keycard ? 1 : 0);
    const w = 16 + (n + extra) * (sz + gap) + (extra ? 10 : 0);
    bg.fillStyle(0x050810, 0.72); bg.fillRoundedRect(0, 0, w, sz + 14, 10); bg.lineStyle(1.2, C.red, 0.5); bg.strokeRoundedRect(0, 0, w, sz + 14, 10);
    const heart = (x: number, y: number, full: boolean) => {
      const g = this.add.graphics(); const k = sz / 32;
      g.fillStyle(full ? 0xff3d5a : 0x2a3140, 1); g.lineStyle(2, full ? 0xffd0d8 : 0x4a5570, 1);
      g.fillCircle(x - 7 * k, y - 4 * k, 8.5 * k); g.fillCircle(x + 7 * k, y - 4 * k, 8.5 * k);
      g.fillTriangle(x - 15.5 * k, y - 1 * k, x + 15.5 * k, y - 1 * k, x, y + 14 * k);
      if (full) { g.fillStyle(0xffffff, 0.45); g.fillCircle(x - 9 * k, y - 7 * k, 3 * k); }
      return g;
    };
    for (let i = 0; i < n; i++) c.add(heart(8 + sz / 2 + i * (sz + gap) + 4, 7 + sz / 2, i < r.hp));
    let x = 8 + n * (sz + gap) + 14;
    if (r.shield) {
      const g = this.add.graphics(); const cx = x + sz / 2, cy = 7 + sz / 2;
      g.fillStyle(0x4fd8ff, 0.3); g.lineStyle(2.4, 0x9fe6ff, 1);
      g.beginPath(); g.moveTo(cx, cy - sz * 0.46); g.lineTo(cx + sz * 0.4, cy - sz * 0.28); g.lineTo(cx + sz * 0.32, cy + sz * 0.18); g.lineTo(cx, cy + sz * 0.46); g.lineTo(cx - sz * 0.32, cy + sz * 0.18); g.lineTo(cx - sz * 0.4, cy - sz * 0.28); g.closePath(); g.fillPath(); g.strokePath();
      c.add(g); x += sz + gap;
    }
    if (r.keycard) c.add(this.add.image(x + sz / 2, 7 + sz / 2, 'keycard').setScale(sz / 44 * 0.95));
    if (hit) { c.setScale(1.15); this.tweens.add({ targets: c, scale: 1, duration: 300, ease: 'Back.out' }); this.cameras.main.flash(90, 120, 0, 20); }
  }

  // ------------------------------------------------------------ inventory
  drawInventory(flash: boolean) {
    const c = this.invC; c.removeAll(true);
    const items = this.game2.invItems(); const n = this.game2.invTotal();
    const slot = this.tiny ? 46 : 64, gap = this.tiny ? 6 : 8;
    const w = n * slot + (n - 1) * gap + 24;
    const g = this.add.graphics(); drawPanel(g, -w / 2, -slot / 2 - 12, w, slot + 24, { accent: C.amber, alpha: 0.7, cut: 10 }); c.add(g);
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + 12 + i * (slot + gap) + slot / 2;
      const it = items[i];
      g.fillStyle(0x050810, 0.9); g.fillRoundedRect(x - slot / 2, -slot / 2, slot, slot, 6);
      g.lineStyle(1, it ? C.amber : 0x2a3654, it ? 0.8 : 1); g.strokeRoundedRect(x - slot / 2, -slot / 2, slot, slot, 6);
      if (it) {
        const im = this.add.image(x, 0, it.tex); const s = (slot - 10) / Math.max(im.width, im.height); im.setScale(s);
        if (it.angle) im.setAngle(it.angle);
        c.add(im);
        const z = this.add.zone(x, 0, slot, slot).setInteractive({ useHandCursor: true });
        z.on('pointerup', () => this.openInventory(it.id)); c.add(z);
        if (flash && i === items.length - 1) { im.setScale(s * 2); this.tweens.add({ targets: im, scale: s, duration: 400, ease: 'Back.out' }); }
      } else {
        drawIcon(g, this.game2.invIcon(), x, 0, 22, 0x2a3654);
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
    const c = this.add.container(W / 2, H * (this.tiny ? 0.62 : 0.72));
    const t = T(this, 0, 0, text, this.tiny ? 16 : 18, C.white, { weight: '700', align: 'center', wordWrap: { width: Math.min(720, W - 80) } }).setOrigin(0.5);
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
    const tn = this.tiny;
    const left = (tn ? 10 : 20) + this.missionW + 16, right = W - (tn ? 250 : 340);
    const wide = right - left >= 440;
    const w = wide ? Math.min(760, right - left) : Math.min(760, W - 40), h = tn ? 78 : 92;
    const y = wide ? (this.timerT.visible ? 70 : tn ? 10 : 20) : this.missionH + (tn ? 56 : 72);
    const ax = wide ? left + (right - left - w) / 2 : W / 2 - w / 2;
    const c = this.add.container(ax, y); this.aiC = c;
    const g = this.add.graphics(); drawPanel(g, 0, 0, w, h, { accent: col, alpha: 0.88 }); c.add(g);
    // AI "eye"
    g.fillStyle(col, 0.18); g.fillCircle(46, h / 2, 28); g.lineStyle(2, col, 1); g.strokeCircle(46, h / 2, 22); g.fillStyle(col, 1); g.fillCircle(46, h / 2, 8);
    c.add(T(this, 86, tn ? 16 : 20, kind === 'warn' ? 'MERIDIAN · WARNING' : 'MERIDIAN · 중앙 AI', 13, colS, { display: true }).setOrigin(0, 0.5));
    const t = T(this, 86, tn ? 46 : 54, '', tn ? 16 : 19, C.white, { weight: '700', wordWrap: { width: w - 110 }, lineSpacing: tn ? 0 : 2 }).setOrigin(0, 0.5); c.add(t);
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
    w = Math.min(w, W - 40); h = Math.min(h, H - (this.tiny ? 16 : 40));
    const x = W / 2 - w / 2, y = H / 2 - h / 2;
    const g = this.add.graphics(); drawPanel(g, x, y, w, h, { accent, header: 54 }); c.add(g);
    c.add(T(this, x + 28, y + 27, title, 21, C.white, { weight: '700' }).setOrigin(0, 0.5));
    const close = new RoundButton(this, x + w - 34, y + 27, 18, 'close', () => this.closeOverlay(), accent); close.setActive2(true); c.add(close);
    this.game2.busy = true; Pad.x = Pad.y = 0;
    c.setAlpha(0); this.tweens.add({ targets: c, alpha: 1, duration: 160 });
    Audio.play('open');
    return { c, x, y, w, h };
  }
  /** a tap that both started and ended on this object, not right after an overlay closed: closing a window with its
   *  X (which reacts on touch-down) must not let the finger's release open the minimap / mission panel underneath */
  overlayClosedAt = -1e9;
  tapOnly(o: Phaser.GameObjects.Zone, fn: () => void) {
    let armed = false;
    o.on('pointerdown', () => { armed = !this.overlay && this.time.now - this.overlayClosedAt > 300; });
    o.on('pointerout', () => { armed = false; });
    o.on('pointerup', (p: Phaser.Input.Pointer) => { const ok = armed && !this.overlay && p.getDistance() < 30; armed = false; if (ok) fn(); });
  }
  closeOverlay() { this.overlayClosedAt = this.time.now; if (!this.overlay) return; if (this.identId) { const id = this.identId; this.identId = null; Bus.emit('ident:cancel', id); } const c = this.overlay; this.overlay = undefined; this.game2.busy = false; Audio.play('close'); this.tweens.add({ targets: c, alpha: 0, duration: 140, onComplete: () => c.destroy() }); }

  // ------------------------------------------------------------ bone identification check (v0.6)
  identId: BoneId | null = null;
  /** options of the open identification check (also used by the automated tests) */
  identOpts: { ok: boolean; zone: Phaser.GameObjects.Zone }[] = [];
  /** The bone is only recovered after the player picks the feature that is true of it (wrong picks explain why). */
  openIdent(id: BoneId) {
    const adv = G.run.difficulty === 'adv', tn = this.tiny, b = BONES[id], q = BONE_QUIZ[id];
    const m = this.modal(adv ? '표본 식별 · 특징으로 판별하세요' : `표본 식별 · ${b.ko} ${b.en}`, 980, tn ? 600 : 560, C.cyan);
    this.identId = id;
    // bone picture on the left
    const im = this.add.image(m.x + 150, m.y + m.h / 2 + 20, `bone_bone_${id}`);
    im.setScale(Math.min(200 / im.width, (m.h - 140) / im.height)); m.c.add(im);
    const glow = this.add.image(im.x, im.y, `bone_holo_${id}`).setScale(im.scale).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.25); m.c.add(glow);
    this.tweens.add({ targets: glow, alpha: 0.08, duration: 900, yoyo: true, repeat: -1 });
    const tx = m.x + 300, tw = m.w - 330;
    const head = T(this, tx, m.y + (tn ? 62 : 74), adv ? '이 표본에 대해 옳은 설명은? (팔뼈대가 아닐 수도 있습니다)' : `${b.ko}의 특징으로 옳은 것은?`, tn ? 18 : 21, C.white, { weight: '700', wordWrap: { width: tw } });
    m.c.add(head);
    const opts = [{ text: q.correct, ok: true, is: '' }, ...(adv ? q.wrong : q.wrong.slice(0, 1)).map(w => ({ text: w.text, ok: false, is: w.is }))];
    Phaser.Utils.Array.Shuffle(opts);
    const fb = T(this, tx, 0, '', 16, C.white, { weight: '600', wordWrap: { width: tw }, lineSpacing: 3 }); m.c.add(fb);
    let y = head.y + head.height + (tn ? 12 : 18);
    const oh = tn ? 76 : 84, gap = tn ? 8 : 12;
    let done = false;
    this.identOpts = [];
    opts.forEach((o, i) => {
      const g = this.add.graphics(); m.c.add(g);
      const t = T(this, tx + 52, y + oh / 2, o.text, tn ? 16 : 17, C.white, { weight: '600', wordWrap: { width: tw - 70 }, lineSpacing: 2 }).setOrigin(0, 0.5); m.c.add(t);
      const badge = T(this, tx + 24, y + oh / 2, String.fromCharCode(65 + i), 20, C.cyanS, { weight: '800' }).setOrigin(0.5); m.c.add(badge);
      const yy = y;
      const draw = (st: 'idle' | 'ok' | 'bad') => {
        const col = st === 'ok' ? C.green : st === 'bad' ? C.red : C.cyan;
        g.clear(); g.fillStyle(st === 'ok' ? 0x08281c : st === 'bad' ? 0x2a0710 : 0x0a1222, 0.95); g.fillRoundedRect(tx, yy, tw, oh, 10);
        g.lineStyle(st === 'idle' ? 1.4 : 2.5, col, 1); g.strokeRoundedRect(tx, yy, tw, oh, 10);
      };
      draw('idle');
      const z = this.add.zone(tx, yy, tw, oh).setOrigin(0).setInteractive({ useHandCursor: true }); m.c.add(z);
      this.identOpts.push({ ok: o.ok, zone: z });
      z.on('pointerup', () => {
        if (done) return;
        if (o.ok) {
          done = true; draw('ok'); Audio.play('success');
          fb.setText(`정답 — ${b.ko} (${b.en})\n${q.why}`).setColor('#c9ffe4');
          this.time.delayedCall(1300, () => { this.identId = null; this.closeOverlay(); Bus.emit('ident:ok', id); });
        } else {
          draw('bad'); z.disableInteractive(); t.setAlpha(0.6); Audio.play('error'); G.run.mistakes++;
          fb.setText(`✗ 그것은 ${o.is}의 특징입니다. 다시 고르세요.${adv ? '' : `\n힌트: ${q.why}`}`).setColor('#ffd2d8');
          this.tweens.add({ targets: m.c, x: '+=8', duration: 50, yoyo: true, repeat: 3 });
        }
      });
      y += oh + gap;
    });
    fb.setY(y + 2);
  }

  openInventory(sel?: string) {
    if (this.overlay || this.game2.player?.frozen) return;
    const items = this.game2.invItems();
    const m = this.modal(`인벤토리 · ${this.game2.invTitle()} (${items.length}/${this.game2.invTotal()})`, 900, 560, C.amber);
    let cur = items.find(i => i.id === sel) ?? items[items.length - 1];
    const detail = this.add.container(0, 0); m.c.add(detail);
    const show = () => {
      detail.removeAll(true);
      if (!cur) { detail.add(T(this, m.x + m.w / 2, m.y + m.h / 2, '아직 회수한 표본이 없습니다.\nSCAN으로 숨겨진 표본을 찾아보세요.', 18, C.dim, { align: 'center' }).setOrigin(0.5)); return; }
      const gx = m.x + 300;
      const tn = this.tiny;
      const im = this.add.image(gx + 150, m.y + 54 + (m.h - 54) / 2, cur.tex); im.setScale(Math.min((m.h - 100) / im.height, 260 / im.width, 1.2)); detail.add(im);
      const tx = gx + 320;
      detail.add(T(this, tx, m.y + (tn ? 66 : 90), cur.title, tn ? 23 : 28, C.white, { weight: '700' }));
      detail.add(T(this, tx, m.y + (tn ? 98 : 130), cur.en, tn ? 16 : 18, C.amberS, { display: true }));
      const info = T(this, tx, m.y + (tn ? 126 : 170), cur.info, 17, '#c9d6ee', { wordWrap: { width: m.x + m.w - tx - 30 }, lineSpacing: tn ? 3 : 6 }); detail.add(info);
      for (const sz of [16, 15]) { if (info.y + info.height <= m.y + m.h - 64) break; info.setFontSize(sz); }
      detail.add(T(this, tx, m.y + m.h - (tn ? 30 : 50), cur.tag, 15, C.dim));
    };
    const rowH = Math.min(72, Math.floor((m.h - (this.tiny ? 74 : 100)) / Math.max(1, items.length)));
    items.forEach((it, i) => {
      const bx = m.x + 30, by = m.y + (this.tiny ? 64 : 76) + i * rowH;
      const g = this.add.graphics(); m.c.add(g);
      const on = it === cur;
      g.fillStyle(on ? C.amber : 0x0a1222, on ? 0.18 : 0.9); g.fillRoundedRect(bx, by, 240, rowH - 10, 8); g.lineStyle(1, on ? C.amber : C.line, 1); g.strokeRoundedRect(bx, by, 240, rowH - 10, 8);
      const im = this.add.image(bx + 34, by + (rowH - 10) / 2, it.tex); im.setScale((rowH - 20) / Math.max(im.width, im.height)); m.c.add(im);
      m.c.add(T(this, bx + 70, by + (rowH - 10) / 2, `${it.title.split(' (')[0]} · ${it.en}`, 15, C.white, { weight: '700' }).setOrigin(0, 0.5));
      const z = this.add.zone(bx, by, 240, rowH - 10).setOrigin(0).setInteractive({ useHandCursor: true }); m.c.add(z);
      z.on('pointerup', () => { this.closeOverlay(); this.time.delayedCall(150, () => this.openInventory(it.id)); });
    });
    show();
  }

  openMap() {
    if (this.overlay || this.game2.player?.frozen) return;
    const m = this.modal(`시설 지도 · ${this.game2.floorName()}`, 1100, 760);
    const bx0 = 100, by0 = 250, bw = 2720 - bx0, bh = 2360 - by0;
    const s = Math.min((m.w - 60) / bw, (m.h - 100) / bh);
    const ox = m.x + (m.w - bw * s) / 2 - bx0 * s, oy = m.y + 70 + (m.h - 90 - bh * s) / 2 - by0 * s;
    const g = this.add.graphics(); m.c.add(g);
    for (const r of [...this.game2.map.ROOMS, ...this.game2.map.PASSAGES]) { g.fillStyle(0x16304a, 1); g.fillRect(ox + r.x * s, oy + r.y * s, r.w * s, r.h * s); }
    for (const r of this.game2.map.ROOMS) {
      const locked = this.game2.roomLocked(r.id);
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

  /** world scene paused by the pause menu (time, tweens, drones, lasers all stop); play time excludes the pause */
  pausedAt = -1; busyBefore = false;
  pauseWorld() {
    if (this.pausedAt >= 0) return;
    this.busyBefore = this.game2.busy;
    this.pausedAt = this.game.loop.time;
    this.scene.pause(worldKey());
    Audio.heartbeat(false);
  }
  resumeWorld() {
    if (this.pausedAt < 0) return;
    G.run.startTime += this.game.loop.time - this.pausedAt;   // paused time is not play time
    this.pausedAt = -1;
    this.scene.resume(worldKey());
    this.game2.busy = this.busyBefore;
  }
  openPause() {
    if (this.overlay || this.identId) return;
    const m = this.modal('일시 정지', 520, 520);
    this.pauseWorld();
    const cx = m.x + m.w / 2;
    const items: [string, IconName, () => void, number][] = [
      ['계속하기', 'play', () => this.closePause(), C.cyan],
      ['해부학 도감', 'book', () => { this.closePause(); this.scene.launch('Archive', { from: 'Game' }); this.game2.busy = true; this.scene.pause(worldKey()); this.scene.sleep(); }, C.cyan],
      ['설정', 'gear', () => { this.closePause(); this.scene.launch('Info', { mode: 'settings', from: 'Game' }); }, C.cyan],
      ['저장하고 나가기', 'back', () => this.confirmQuit(), C.red],
    ];
    const bh = this.tiny ? 50 : 62, gap = this.tiny ? 60 : 78;
    items.forEach(([t, ic, fn, acc], i) => m.c.add(new Button(this, cx, m.y + (this.tiny ? 92 : 112) + i * gap, t, fn, { w: 360, h: bh, icon: ic, accent: acc })));
    const sec = Math.floor((this.game.loop.time - G.run.startTime - (this.pausedAt >= 0 ? this.game.loop.time - this.pausedAt : 0)) / 1000);
    const prog = G.run.chapter === 1 ? `뼈 ${G.run.bones.length}개 회수` : `코어 ${G.run.items.length}개 회수`;
    m.c.add(T(this, cx, m.y + m.h - 30, `플레이 ${Math.floor(sec / 60)}분 ${sec % 60}초 · ${prog} · 실수 ${G.run.mistakes}회`, 15, C.dim).setOrigin(0.5));
    // the modal's own close (X) button also resumes
    const x = m.c.list.find(o => o instanceof RoundButton) as RoundButton | undefined; if (x) x.onPress = () => this.closePause();
  }
  closePause() { this.closeOverlay(); this.resumeWorld(); }
  confirmQuit() {
    const m = this.modal('저장하고 나가기', 560, 360, C.red);
    const cx = m.x + m.w / 2;
    m.c.add(T(this, cx, m.y + 100, '지금까지의 진행(회수한 표본, 찾은 단서, 마지막 체크포인트)을\n저장하고 타이틀로 나갑니다.\n타이틀의 [이어하기]로 계속할 수 있습니다.', 17, '#d3def3', { align: 'center', lineSpacing: 6, wordWrap: { width: m.w - 50 } }).setOrigin(0.5, 0));
    const by = m.y + m.h - 52;
    m.c.add(new Button(this, cx - 130, by, '취소', () => { this.closeOverlay(); this.openPauseAgain(); }, { w: 220, h: 54, icon: 'back' }));
    m.c.add(new Button(this, cx + 130, by, '저장하고 나가기', () => this.saveAndQuit(), { w: 240, h: 54, icon: 'check', accent: C.red, primary: true }));
    const x = m.c.list.find(o => o instanceof RoundButton) as RoundButton | undefined; if (x) x.onPress = () => { this.closeOverlay(); this.openPauseAgain(); };
  }
  openPauseAgain() { this.time.delayedCall(170, () => { if (!this.overlay) this.openPause(); }); }   // the world stays paused meanwhile
  saveAndQuit() {
    const r = G.run;
    // play time up to the moment the pause started
    r.elapsed = ((this.pausedAt >= 0 ? this.pausedAt : this.game.loop.time) - r.startTime) / 1000;
    const ok = r.flags.intro && !r.flags.escaped ? saveRun(r) : false;
    this.closeOverlay(); this.pausedAt = -1;
    this.scene.resume(worldKey());
    Audio.alarm(false); Audio.heartbeat(false); Audio.setMusic('none');
    void ok;
    Bus.emit('game:quit');
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
    if (this.scanCd > 0 && this.btnScan.visible) { sg.lineStyle(4, C.violet, 0.9); sg.beginPath(); sg.arc(this.btnScan.x, this.btnScan.y, 50, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - this.scanCd / 1.4)); sg.strokePath(); }
    // off-screen threats (drones / lasers): red edge markers so the closer camera never hides an approaching danger
    const tg = this.threatG; tg.clear();
    if (t.threats && t.cam) {
      const v = t.cam; const { W, H } = View; const m = 46;
      for (const th of t.threats as { x: number; y: number; kind: string; hot: boolean }[]) {
        const sx = (th.x - v.x) / v.width * W, sy = (th.y - v.y) / v.height * H;
        if (sx > 0 && sx < W && sy > 0 && sy < H) continue;
        const x = Phaser.Math.Clamp(sx, m, W - m), y = Phaser.Math.Clamp(sy, m, H - m);
        const ang = Math.atan2(sy - y, sx - x);
        const col = th.kind === 'guard' ? (th.hot ? C.red : 0xffc24d) : (th.hot ? 0xff3d6a : 0xff9ab0);
        const pulse = th.hot ? 1 + 0.2 * Math.sin(now * 10) : 1;
        tg.fillStyle(0x000000, 0.55); tg.fillCircle(x, y, 18 * pulse);
        tg.lineStyle(2.5, col, 1); tg.strokeCircle(x, y, 18 * pulse);
        const p = (d: number, o: number) => ({ x: x + Math.cos(ang + o) * d, y: y + Math.sin(ang + o) * d });
        const p1 = p(30 * pulse, 0), p2 = p(19, 0.5), p3 = p(19, -0.5);
        tg.fillStyle(col, 1); tg.fillTriangle(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
        if (th.kind === 'guard') { tg.fillRect(x - 2, y - 9, 4, 11); tg.fillRect(x - 2, y + 5, 4, 4); }
        else { tg.lineStyle(3, col, 1); tg.lineBetween(x - 8, y + 6, x + 8, y - 6); }
      }
    }
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
