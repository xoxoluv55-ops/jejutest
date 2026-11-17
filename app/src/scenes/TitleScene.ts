import Phaser from 'phaser';
import { BaseScene } from './Base';
import { View } from '../core/view';
import { Audio } from '../core/audio';
import { Save, persist } from '../core/save';
import { T, C, Button, drawPanel, drawIcon } from '../ui/widgets';
import { BOT_COLORS, BOT_HEX } from './BootScene';
import { G, newRun, Difficulty } from '../game/state';

let entered = false;

export class TitleScene extends BaseScene {
  constructor() { super('Title'); }
  private ecg!: Phaser.GameObjects.Graphics;
  private ecgT = 0;
  private ecgW = 520;
  private modal?: Phaser.GameObjects.Container;

  create() {
    this.initView();
    const { W, H } = View;
    this.cameras.main.fadeIn(600, 0, 0, 0);
    // ---------- backdrop: lab wall + floor ----------
    const wallH = H * 0.56;
    const hasBg = this.textures.exists('title_bg');
    if (hasBg) {
      const bg = this.add.image(W / 2, H / 2, 'title_bg');
      bg.setScale(Math.max(W / bg.width, H / bg.height));
    } else {
      this.add.rectangle(W / 2, H / 2, W, H, 0x04060b);
      const wall = this.add.tileSprite(0, 0, W, wallH, 'wall_face').setOrigin(0).setTileScale(wallH / 220);
      wall.setAlpha(0.9);
      const floor = this.add.tileSprite(0, wallH, W, H - wallH, 'floor_lab').setOrigin(0).setTileScale(0.42);
      floor.setTint(0x9fb0d0);
      this.add.rectangle(0, wallH - 4, W, 12, 0x000000, 0.7).setOrigin(0);
      // monitors on the wall
      const mon = [[0.1, 0.18], [0.27, 0.12], [0.73, 0.12], [0.9, 0.2]];
      for (const [fx, fy] of mon) this.add.image(W * fx, H * fy, 'monitor_wall').setScale(0.42).setAlpha(0.8);
      // central capsule with hologram body (key art)
      const cx = W * 0.5, baseY = wallH + H * 0.16;
      this.add.image(cx, baseY + 10, 'light').setScale(3.2, 1.1).setTint(0x2a8cff).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.6);
      const envOk = this.textures.exists('env');
      const cap = envOk ? this.add.image(cx, baseY, 'env', 'p_capsule_holo').setOrigin(0.5, 1).setScale(1.55) : this.add.image(cx, baseY, 'capsule').setOrigin(0.5, 1).setScale(1.65);
      const holo = this.add.image(cx, baseY - (envOk ? 95 : 70), 'holo_body').setOrigin(0.5, 1).setScale(0.62).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.95);
      if (envOk) holo.setVisible(false);
      this.tweens.add({ targets: holo, alpha: 0.65, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.tweens.add({ targets: holo, y: holo.y - 6, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      cap.setDepth(1); holo.setDepth(2);
      this.add.image(cx, baseY - 150, 'light').setScale(2.2).setTint(0x3fbaff).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.35).setDepth(2);
      // side consoles
      (envOk ? this.add.image(W * 0.2, baseY + 40, 'env', 'p_console').setScale(1.0) : this.add.image(W * 0.2, baseY + 40, 'console_red').setScale(1.2)).setOrigin(0.5, 1).setDepth(3);
      (envOk ? this.add.image(W * 0.8, baseY + 40, 'env', 'p_techbox').setScale(1.0) : this.add.image(W * 0.8, baseY + 40, 'console').setScale(1.2)).setOrigin(0.5, 1).setDepth(3);
      (envOk ? this.add.image(W * 0.05, baseY + 30, 'env', 'p_rack').setScale(1.0) : this.add.image(W * 0.05, baseY + 30, 'rack').setScale(1.3)).setOrigin(0.5, 1).setDepth(3);
      (envOk ? this.add.image(W * 0.95, baseY + 30, 'env', 'p_fridge').setScale(1.0) : this.add.image(W * 0.95, baseY + 30, 'rack').setScale(1.3)).setOrigin(0.5, 1).setDepth(3);
    }
    // ---------- red emergency beacons ----------
    for (const fx of [0.14, 0.86]) {
      const bx = W * fx, by = H * 0.04;
      const beam = this.add.image(bx, by, 'beam').setOrigin(0, 0.5).setScale(4, 2.4).setTint(0xff2040).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.32).setDepth(8);
      this.tweens.add({ targets: beam, angle: 360, duration: 2600, repeat: -1 });
      this.add.image(bx, by, 'dot').setScale(1.4).setTint(0xff3355).setBlendMode(Phaser.BlendModes.ADD).setDepth(9);
    }
    const redWash = this.add.rectangle(W / 2, H / 2, W, H, 0xff1030, 0).setBlendMode(Phaser.BlendModes.ADD).setDepth(9);
    this.tweens.add({ targets: redWash, fillAlpha: 0.08, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    // fog + dust
    this.add.particles(0, 0, 'smoke', {
      x: { min: -100, max: W + 100 }, y: { min: H * 0.6, max: H }, lifespan: 9000, speedX: { min: -12, max: 12 }, speedY: { min: -6, max: 2 },
      scale: { start: 2.2, end: 3.6 }, alpha: { start: 0, end: 0, ease: (t: number) => Math.sin(t * Math.PI) * 0.35 } as any, frequency: 380, tint: 0x6fa0ff,
    }).setDepth(7);
    this.add.particles(0, 0, 'dot', {
      x: { min: 0, max: W }, y: { min: 0, max: H }, lifespan: 7000, speedX: { min: -6, max: 6 }, speedY: { min: -10, max: -2 },
      scale: { min: 0.05, max: 0.14 }, alpha: { start: 0.0, end: 0.0, ease: (t: number) => Math.sin(t * Math.PI) * 0.8 } as any, frequency: 90, blendMode: 'ADD', tint: 0xbfe6ff,
    }).setDepth(10);
    // ---------- the four test units ----------
    const order = ['blue', 'red', 'yellow', 'violet'];
    const fy = H * 0.92;
    const portrait = H > W;
    const groupX = portrait ? W * 0.5 : W * 0.3;
    order.forEach((c, i) => {
      const lead = c === Save.color;
      const sc = (lead ? 0.5 : 0.36) * (portrait ? 0.9 : 1);
      const x = groupX + (i - 1.5) * (portrait ? 150 : 150) + (lead ? 0 : 0);
      const y = fy - (lead ? 0 : 40);
      this.add.image(x, y + 6, 'shadow').setScale(lead ? 2.4 : 1.8).setAlpha(0.8).setDepth(11 + i);
      const b = this.add.image(x, y, `full_${c}`).setOrigin(0.5, 1).setScale(sc * 0.95).setDepth(lead ? 20 : 12 + i);
      this.tweens.add({ targets: b, y: y - 6, scaleY: sc * 1.015, duration: 1100 + i * 120, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: i * 200 });
      this.add.image(x, y - b.displayHeight * 0.62, 'light').setScale(0.5).setTint(BOT_HEX[c]).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.18).setDepth(11);
    });
    // vignette
    this.add.image(W / 2, H / 2, 'vignette').setDisplaySize(W * 1.1, H * 1.1).setDepth(30);

    // ---------- logo ----------
    const lx = portrait ? W / 2 : W * 0.06, ly = portrait ? H * 0.1 : H * 0.12;
    const ox = portrait ? 0.5 : 0;
    const l1 = T(this, lx, ly, 'ANATOMY', portrait ? 84 : 96, '#ffffff', { display: true, weight: '900' }).setOrigin(ox, 0).setDepth(40);
    l1.setShadow(0, 0, '#ff2d4a', 26, true, true); l1.setStroke('#ff2d4a', 3);
    const l2 = T(this, lx + (portrait ? 0 : 54), ly + (portrait ? 84 : 98), 'ESCAPE', portrait ? 84 : 96, '#ffffff', { display: true, weight: '900' }).setOrigin(ox, 0).setDepth(40);
    l2.setShadow(0, 0, '#ff2d4a', 26, true, true); l2.setStroke('#ff2d4a', 3);
    const sub = T(this, lx + (portrait ? 0 : 60), ly + (portrait ? 186 : 214), '— 해부학 탈출 프로젝트 —', 24, '#ffd2d8', { weight: '700' }).setOrigin(ox, 0).setDepth(40);
    sub.setShadow(0, 0, '#ff2d4a', 10, true, true);
    this.ecg = this.add.graphics().setDepth(41);
    this.ecgW = portrait ? 520 : Math.max(120, Math.min(520, W * 0.62 - (l2.x + l2.width + 16)));
    this.ecg.setPosition(portrait ? W / 2 - 260 : l2.x + l2.width + 16, portrait ? ly + 168 : l2.y + l2.height * 0.5);
    // glitch flicker on the logo
    this.time.addEvent({ delay: 2800, loop: true, callback: () => {
      const dx = Phaser.Math.Between(-8, 8);
      l1.x += dx; l2.setAlpha(0.6); this.time.delayedCall(70, () => { l1.x -= dx; l2.setAlpha(1); });
    } });

    // LOCKDOWN plate
    const lockC = this.add.container(portrait ? W / 2 : lx + 260, portrait ? H * 0.36 : ly + 300).setDepth(40);
    const lg = this.add.graphics();
    drawPanel(lg, -170, -34, 340, 68, { accent: C.red, fill: 0x22040a, alpha: 0.85 });
    lg.fillStyle(C.red, 1); lg.fillTriangle(-140, 16, -116, 16, -128, -10);
    lg.fillStyle(0x22040a, 1); lg.fillRect(-129.5, 0, 3, 8); lg.fillRect(-129.5, 10, 3, 3);
    lockC.add(lg);
    lockC.add(T(this, -100, -16, 'LOCKDOWN', 26, '#ff5d74', { display: true, weight: '900' }).setOrigin(0, 0.5));
    lockC.add(T(this, -100, 14, 'SYSTEM ERROR · 격벽 봉쇄됨', 15, '#ff9aa9', { weight: '700' }).setOrigin(0, 0.5));
    this.tweens.add({ targets: lockC, alpha: 0.55, duration: 600, yoyo: true, repeat: -1, ease: 'Stepped', easeParams: [2] });

    // ---------- menu ----------
    const mx = portrait ? W / 2 : W * 0.8, my = portrait ? H * 0.5 : H * 0.38;
    const items: [string, string, any, () => void, number?][] = [
      ['GAME START', '게임 시작 · CHAPTER 1', 'play', () => this.openStart(), C.red],
      ['MULTIPLAYER', '협동 플레이 (1~4인)', 'users', () => this.scene.launch('Info', { mode: 'multi', from: 'Title' })],
      ['ANATOMY ARCHIVE', '해부학 도감', 'book', () => { this.scene.start('Archive', { from: 'Title' }); }],
      ['SETTINGS', '설정', 'gear', () => this.scene.launch('Info', { mode: 'settings', from: 'Title' })],
    ];
    items.forEach(([t, s, icon, fn, acc], i) => {
      const b = new Button(this, mx, my + i * 84, t, fn, { w: 380, h: 70, icon, sub: s, accent: acc ?? C.cyan, display: true, size: 21, primary: i === 0 });
      b.setDepth(50); b.setAlpha(0); b.x += 40;
      this.tweens.add({ targets: b, alpha: 1, x: mx, duration: 500, delay: 300 + i * 90, ease: 'Cubic.out' });
    });
    T(this, W - 18, H - 14, 'PHASE 1 DEMO · v0.1', 13, '#55647f').setOrigin(1, 1).setDepth(50);
    if (Save.clears) T(this, 18, H - 14, `CLEAR ×${Save.clears}${Save.bestTime ? ` · BEST ${fmt(Save.bestTime)}` : ''}`, 14, C.greenS, { weight: '700' }).setOrigin(0, 1).setDepth(50);

    if (!entered) this.enterGate(); else this.startAudio();
  }

  startAudio() { Audio.unlock(); Audio.startAmbient(); Audio.setMusic('title'); }

  enterGate() {
    const { W, H } = View;
    const c = this.add.container(0, 0).setDepth(200);
    const bg = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.72).setInteractive();
    c.add(bg);
    const t = T(this, W / 2, H * 0.62, '화면을 터치하여 연구시설에 진입', 26, '#e8f1ff', { weight: '700' }).setOrigin(0.5);
    const t2 = T(this, W / 2, H * 0.62 + 38, 'TAP TO ENTER BODY LAB', 15, C.dim, { display: true }).setOrigin(0.5);
    c.add([t, t2]);
    this.tweens.add({ targets: t, alpha: 0.4, duration: 900, yoyo: true, repeat: -1 });
    const go = () => { if (entered) return; entered = true; this.startAudio(); Audio.play('glitch'); this.tweens.add({ targets: c, alpha: 0, duration: 400, onComplete: () => c.destroy() }); };
    bg.once('pointerup', go);
    this.input.keyboard?.once('keydown', go);
  }

  openStart() {
    if (this.modal) return;
    const { W, H } = View;
    let diff: Difficulty = 'basic';
    let color = Save.color;
    const m = this.add.container(0, 0).setDepth(300);
    this.modal = m;
    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.7).setInteractive();
    m.add(dim);
    const pw = Math.min(980, W - 40), ph = 640;
    const px = W / 2 - pw / 2, py = H / 2 - ph / 2;
    const g = this.add.graphics(); drawPanel(g, px, py, pw, ph, { accent: C.cyan, header: 58 }); m.add(g);
    m.add(T(this, px + 34, py + 29, 'MISSION BRIEFING · CHAPTER 1 골격 복구실', 22, C.white, { weight: '700' }).setOrigin(0, 0.5));
    m.add(T(this, px + 34, py + 86, '난이도 선택', 18, C.cyanS, { weight: '700' }));
    const diffs: [Difficulty, string, string][] = [
      ['basic', '기초 · 1학년', '뼈 이름과 윤곽 가이드 표시, X-ray 라벨 한·영 병기'],
      ['adv', '심화 · 응용', '뼈 이름·윤곽 가이드 없음, 영문 라벨, 오답 보기 추가'],
    ];
    const dBtns: Phaser.GameObjects.Graphics[] = [];
    const dw = (pw - 34 * 2 - 20) / 2;
    diffs.forEach(([id, t, s], i) => {
      const x = px + 34 + i * (dw + 20), y = py + 118;
      const bg = this.add.graphics(); dBtns.push(bg); m.add(bg);
      const zone = this.add.zone(x, y, dw, 92).setOrigin(0).setInteractive({ useHandCursor: true });
      zone.on('pointerup', () => { diff = id; Audio.play('click'); redraw(); });
      m.add(zone);
      m.add(T(this, x + 22, y + 26, t, 22, C.white, { weight: '700' }).setOrigin(0, 0.5));
      m.add(T(this, x + 22, y + 62, s, 15, C.dim, { wordWrap: { width: dw - 40 } }).setOrigin(0, 0.5));
    });
    m.add(T(this, px + 34, py + 236, '실험체 색상', 18, C.cyanS, { weight: '700' }));
    const cBtns: { g: Phaser.GameObjects.Graphics; c: string; img: Phaser.GameObjects.Image }[] = [];
    const cw = Math.min(150, (pw - 68) / 4 - 10);
    BOT_COLORS.forEach((c, i) => {
      const x = px + 34 + i * (cw + 14), y = py + 268;
      const gg = this.add.graphics(); m.add(gg);
      const img = this.add.image(x + cw / 2, y + 166, `hero_${c}`).setOrigin(0.5, 1).setScale(Math.min((cw - 16) / 469, 150 / 520)); m.add(img);
      const z = this.add.zone(x, y, cw, 170).setOrigin(0).setInteractive({ useHandCursor: true });
      z.on('pointerup', () => { color = c; Audio.play('click'); redraw(); this.tweens.add({ targets: img, y: img.y - 14, duration: 140, yoyo: true, ease: 'Quad.out' }); });
      m.add(z);
      cBtns.push({ g: gg, c, img });
    });
    const story = T(this, px + 34 + 4 * (cw + 14) + 10, py + 268,
      '인체 구조를 연구하던 지하 시설 BODY LAB.\n중앙 AI의 오작동으로 모든 격벽이 봉쇄됐다.\n\n흩어진 골격 표본을 찾아 복구하고\n탈출 게이트의 잠금 3개를 해제하라.', 16, '#c9d6ee', { lineSpacing: 6, wordWrap: { width: Math.max(160, px + pw - (px + 34 + 4 * (cw + 14) + 10) - 30) } });
    m.add(story);
    const redraw = () => {
      dBtns.forEach((bg, i) => {
        const x = px + 34 + i * (dw + 20), y = py + 118; const on = diffs[i][0] === diff;
        bg.clear(); bg.fillStyle(on ? C.cyan : 0x0a1222, on ? 0.18 : 0.8); bg.fillRoundedRect(x, y, dw, 92, 8);
        bg.lineStyle(on ? 2.5 : 1.2, on ? C.cyan : C.line, 1); bg.strokeRoundedRect(x, y, dw, 92, 8);
        if (on) drawIcon(bg, 'check', x + dw - 30, y + 26, 22, C.cyan);
      });
      cBtns.forEach(({ g: gg, c }, i) => {
        const x = px + 34 + i * (cw + 14), y = py + 268; const on = c === color; const hx = BOT_HEX[c];
        gg.clear(); gg.fillStyle(hx, on ? 0.2 : 0.05); gg.fillRoundedRect(x, y, cw, 170, 10);
        gg.lineStyle(on ? 2.5 : 1, on ? hx : C.line, 1); gg.strokeRoundedRect(x, y, cw, 170, 10);
      });
    };
    redraw();
    const by = py + ph - 52;
    const start = new Button(this, px + pw - 170, by, '연구시설 진입', () => {
      Save.color = color; persist();
      G.run = newRun(diff, color);
      Audio.play('glitch'); Audio.setMusic('none');
      this.cameras.main.fadeOut(500, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => { this.scene.start('Game'); });
    }, { w: 280, h: 62, accent: C.red, primary: true, icon: 'play', size: 22 });
    const cancel = new Button(this, px + 150, by, '돌아가기', () => { m.destroy(); this.modal = undefined; }, { w: 220, h: 56, icon: 'back' });
    m.add([start, cancel]);
    m.setAlpha(0); this.tweens.add({ targets: m, alpha: 1, duration: 200 });
  }

  update(_t: number, dt: number) {
    // animated ECG trace beside the logo
    this.ecgT += dt / 1000;
    const g = this.ecg; g.clear();
    const w = this.ecgW, n = 130;
    const head = (this.ecgT * 0.45) % 1;
    for (let i = 0; i < n; i++) {
      const p = i / n; const x0 = p * w, x1 = (i + 1) / n * w;
      const v = (q: number) => { const ph = (q * 3) % 1; if (ph > 0.42 && ph < 0.46) return -34; if (ph > 0.46 && ph < 0.5) return 22; if (ph > 0.5 && ph < 0.53) return -8; return Math.sin(q * 40) * 1.5; };
      let age = head - p; if (age < 0) age += 1;
      const a = Math.max(0, 1 - age * 1.4);
      if (a <= 0.02) continue;
      g.lineStyle(3, 0xff2d4a, a); g.beginPath(); g.moveTo(x0, v(p)); g.lineTo(x1, v((i + 1) / n)); g.strokePath();
      g.lineStyle(9, 0xff2d4a, a * 0.15); g.beginPath(); g.moveTo(x0, v(p)); g.lineTo(x1, v((i + 1) / n)); g.strokePath();
    }
  }
}

export function fmt(s: number) { const m = Math.floor(s / 60), r = Math.floor(s % 60); return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`; }
