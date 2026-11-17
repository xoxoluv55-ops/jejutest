// Custom sci-fi UI kit (no default HTML buttons). Everything is drawn with Phaser Graphics + Text.
import Phaser from 'phaser';
import { textRes } from '../core/view';
import { Audio } from '../core/audio';

export const KO = '"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic","Nanum Gothic",system-ui,sans-serif';
export const F_UI = `Rajdhani,${KO}`;
export const F_DISPLAY = `Orbitron,${KO}`;

export const C = {
  cyan: 0x4fd8ff, cyanS: '#4fd8ff', red: 0xff2d4a, redS: '#ff3d5a', violet: 0xa66bff, violetS: '#b58cff',
  amber: 0xffb43a, amberS: '#ffc24d', green: 0x3dffa2, greenS: '#3dffa2', white: '#e8f1ff', dim: '#8ea3c4',
  panel: 0x070b14, panel2: 0x0d1424, line: 0x24324f,
};

export function T(scene: Phaser.Scene, x: number, y: number, text: string, size = 20, color = C.white, opts: Partial<Phaser.Types.GameObjects.Text.TextStyle> & { display?: boolean; weight?: string } = {}) {
  const { display, weight, ...rest } = opts;
  const t = scene.add.text(x, y, text, {
    fontFamily: display ? F_DISPLAY : F_UI,
    fontSize: `${size}px`, color, fontStyle: weight ?? '600',
    ...rest,
  });
  t.setResolution(textRes());
  return t;
}

/** Draw a chamfered sci-fi panel into a Graphics object (centered at 0,0 if centered). */
export function drawPanel(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, o: { accent?: number; fill?: number; alpha?: number; cut?: number; glow?: boolean; header?: number } = {}) {
  const accent = o.accent ?? C.cyan, cut = o.cut ?? 14;
  const pts = [x + cut, y, x + w, y, x + w, y + h - cut, x + w - cut, y + h, x, y + h, x, y + cut];
  const poly = (arr: number[]) => { const p: Phaser.Math.Vector2[] = []; for (let i = 0; i < arr.length; i += 2) p.push(new Phaser.Math.Vector2(arr[i], arr[i + 1])); return p; };
  if (o.glow !== false) { g.lineStyle(8, accent, 0.06); g.strokePoints(poly(pts), true); }
  g.fillStyle(o.fill ?? C.panel, o.alpha ?? 0.86); g.fillPoints(poly(pts), true);
  if (o.header) { g.fillStyle(accent, 0.12); g.fillRect(x + cut, y + 1, w - cut - 1, o.header); }
  g.lineStyle(1.5, accent, 0.55); g.strokePoints(poly(pts), true);
  // corner accents
  g.lineStyle(3, accent, 0.95);
  g.beginPath(); g.moveTo(x, y + cut + 18); g.lineTo(x, y + cut); g.lineTo(x + cut, y); g.lineTo(x + cut + 18, y); g.strokePath();
  g.beginPath(); g.moveTo(x + w, y + h - cut - 18); g.lineTo(x + w, y + h - cut); g.lineTo(x + w - cut, y + h); g.lineTo(x + w - cut - 18, y + h); g.strokePath();
  g.fillStyle(accent, 0.9); g.fillRect(x + w - 26, y + 6, 18, 3); g.fillRect(x + 8, y + h - 9, 10, 3);
}

export type IconName = 'hand' | 'scan' | 'bag' | 'map' | 'gear' | 'pause' | 'rotate' | 'flip' | 'check' | 'close' | 'play' | 'users' | 'book' | 'bone' | 'eye' | 'info' | 'bolt' | 'lock' | 'back' | 'retry';

export function drawIcon(g: Phaser.GameObjects.Graphics, name: IconName, x: number, y: number, s: number, color = 0xffffff, alpha = 1) {
  const u = s / 24;
  g.lineStyle(2.2 * u, color, alpha); g.fillStyle(color, alpha);
  const L = (pts: number[]) => { g.beginPath(); g.moveTo(x + pts[0] * u, y + pts[1] * u); for (let i = 2; i < pts.length; i += 2) g.lineTo(x + pts[i] * u, y + pts[i + 1] * u); g.strokePath(); };
  switch (name) {
    case 'hand':
      for (let i = 0; i < 4; i++) { const fx = -6 + i * 4; g.fillRoundedRect(x + (fx - 1.4) * u, y + (-10 + (i === 0 || i === 3 ? 3 : 0)) * u, 2.8 * u, 12 * u, 1.4 * u); }
      g.fillRoundedRect(x - 8 * u, y - 1 * u, 15 * u, 10 * u, 4 * u);
      g.fillRoundedRect(x + 5 * u, y - 4 * u, 3 * u, 9 * u, 1.5 * u); break;
    case 'scan':
      g.strokeCircle(x, y, 9 * u); g.strokeCircle(x, y, 4 * u); L([-12, 0, -6, 0]); L([6, 0, 12, 0]); L([0, -12, 0, -6]); L([0, 6, 0, 12]); break;
    case 'bag':
      g.strokeRoundedRect(x - 9 * u, y - 5 * u, 18 * u, 15 * u, 3 * u); L([-4, -5, -4, -9, 4, -9, 4, -5]); L([-9, 1, 9, 1]); break;
    case 'map':
      L([-10, -7, -4, -10, 4, -7, 10, -10, 10, 7, 4, 10, -4, 7, -10, 10, -10, -7]); L([-4, -10, -4, 7]); L([4, -7, 4, 10]); break;
    case 'gear':
      g.strokeCircle(x, y, 6 * u); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; L([Math.cos(a) * 7, Math.sin(a) * 7, Math.cos(a) * 11, Math.sin(a) * 11]); } break;
    case 'pause': g.fillRect(x - 6 * u, y - 8 * u, 4 * u, 16 * u); g.fillRect(x + 2 * u, y - 8 * u, 4 * u, 16 * u); break;
    case 'play': g.fillTriangle(x - 5 * u, y - 9 * u, x - 5 * u, y + 9 * u, x + 9 * u, y); break;
    case 'rotate':
      g.beginPath(); g.arc(x, y, 8 * u, Phaser.Math.DegToRad(-60), Phaser.Math.DegToRad(220)); g.strokePath();
      g.fillTriangle(x + 4 * u, y - 12 * u, x + 10 * u, y - 5 * u, x + 1 * u, y - 4 * u); break;
    case 'flip':
      L([0, -11, 0, 11]); g.fillTriangle(x - 3 * u, y - 7 * u, x - 3 * u, y + 7 * u, x - 11 * u, y); g.lineStyle(2 * u, color, alpha);
      g.strokeTriangle(x + 3 * u, y - 7 * u, x + 3 * u, y + 7 * u, x + 11 * u, y); break;
    case 'check': L([-9, 0, -3, 7, 10, -7]); break;
    case 'close': L([-7, -7, 7, 7]); L([7, -7, -7, 7]); break;
    case 'back': L([4, -8, -4, 0, 4, 8]); break;
    case 'users': g.strokeCircle(x - 4 * u, y - 4 * u, 4 * u); g.strokeCircle(x + 6 * u, y - 3 * u, 3 * u); g.beginPath(); g.arc(x - 4 * u, y + 9 * u, 8 * u, Math.PI, 0); g.strokePath(); g.beginPath(); g.arc(x + 7 * u, y + 8 * u, 5 * u, Math.PI, 0); g.strokePath(); break;
    case 'book': L([0, -7, -10, -9, -10, 8, 0, 10, 10, 8, 10, -9, 0, -7, 0, 10]); break;
    case 'bone':
      L([-6, 6, 6, -6]); g.fillCircle(x - 8 * u, y + 5 * u, 3 * u); g.fillCircle(x - 5 * u, y + 8 * u, 3 * u); g.fillCircle(x + 8 * u, y - 5 * u, 3 * u); g.fillCircle(x + 5 * u, y - 8 * u, 3 * u); break;
    case 'eye': g.beginPath(); g.arc(x, y + 8 * u, 13 * u, Phaser.Math.DegToRad(-140), Phaser.Math.DegToRad(-40)); g.strokePath(); g.beginPath(); g.arc(x, y - 8 * u, 13 * u, Phaser.Math.DegToRad(40), Phaser.Math.DegToRad(140)); g.strokePath(); g.fillCircle(x, y, 3.5 * u); break;
    case 'info': g.strokeCircle(x, y, 10 * u); g.fillRect(x - 1.2 * u, y - 2 * u, 2.4 * u, 8 * u); g.fillCircle(x, y - 5.5 * u, 1.6 * u); break;
    case 'bolt': g.fillTriangle(x + 2 * u, y - 11 * u, x - 7 * u, y + 2 * u, x + 1 * u, y + 1 * u); g.fillTriangle(x - 2 * u, y + 11 * u, x + 7 * u, y - 2 * u, x - 1 * u, y - 1 * u); break;
    case 'lock': g.strokeRoundedRect(x - 7 * u, y - 2 * u, 14 * u, 11 * u, 2 * u); g.beginPath(); g.arc(x, y - 3 * u, 5 * u, Math.PI, 0); g.strokePath(); break;
    case 'retry': g.beginPath(); g.arc(x, y, 8 * u, Phaser.Math.DegToRad(30), Phaser.Math.DegToRad(330)); g.strokePath(); g.fillTriangle(x + 9 * u, y - 9 * u, x + 10 * u, y + 1 * u, x + 2 * u, y - 3 * u); break;
  }
}

export interface ButtonOpts { w?: number; h?: number; accent?: number; icon?: IconName; size?: number; sub?: string; disabled?: boolean; primary?: boolean; sound?: string; display?: boolean }

export class Button extends Phaser.GameObjects.Container {
  bg: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  subT?: Phaser.GameObjects.Text;
  w: number; h: number; o: ButtonOpts;
  private hover = false; private down = false;
  enabled = true;
  onClick: () => void;
  constructor(scene: Phaser.Scene, x: number, y: number, text: string, onClick: () => void, o: ButtonOpts = {}) {
    super(scene, x, y);
    this.o = o; this.w = o.w ?? 300; this.h = o.h ?? 58; this.onClick = onClick;
    this.bg = scene.add.graphics(); this.add(this.bg);
    const hasIcon = !!o.icon;
    this.label = T(scene, hasIcon ? -this.w / 2 + 58 : 0, o.sub ? -9 : 0, text, o.size ?? 22, C.white, { weight: '700', display: o.display });
    this.label.setOrigin(hasIcon ? 0 : 0.5, 0.5);
    this.add(this.label);
    if (o.sub) { this.subT = T(scene, this.label.x, 15, o.sub, 13, C.dim); this.subT.setOrigin(hasIcon ? 0 : 0.5, 0.5); this.add(this.subT); }
    this.setSize(this.w, this.h);
    this.setInteractive({ useHandCursor: true });
    this.on('pointerover', () => { if (!this.enabled) return; this.hover = true; this.redraw(); Audio.play('hover'); });
    this.on('pointerout', () => { this.hover = false; this.down = false; this.redraw(); });
    this.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => { ev?.stopPropagation?.(); if (!this.enabled) return; this.down = true; this.redraw(); });
    this.on('pointerup', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev?.stopPropagation?.();
      if (!this.enabled || !this.down) return; this.down = false; this.redraw();
      Audio.unlock(); Audio.play(o.sound ?? 'click');
      this.onClick();
    });
    if (o.disabled) this.setEnabled(false);
    this.redraw();
    scene.add.existing(this);
  }
  setEnabled(v: boolean) { this.enabled = v; this.setAlpha(v ? 1 : 0.42); this.redraw(); return this; }
  setText(s: string) { this.label.setText(s); return this; }
  redraw() {
    const g = this.bg; g.clear();
    const { w, h } = this; const a = this.o.accent ?? C.cyan; const cut = 12;
    const x = -w / 2, y = -h / 2;
    const pts = [x + cut, y, x + w, y, x + w, y + h - cut, x + w - cut, y + h, x, y + h, x, y + cut].reduce<Phaser.Math.Vector2[]>((acc, v, i, arr) => { if (i % 2 === 0) acc.push(new Phaser.Math.Vector2(v, arr[i + 1])); return acc; }, []);
    const hot = this.hover || this.down;
    if (hot) { g.lineStyle(10, a, 0.12); g.strokePoints(pts, true); }
    g.fillStyle(this.o.primary ? a : 0x0a1222, this.o.primary ? (this.down ? 0.55 : hot ? 0.42 : 0.3) : (this.down ? 0.98 : 0.86)); g.fillPoints(pts, true);
    if (!this.o.primary && hot) { g.fillStyle(a, 0.14); g.fillPoints(pts, true); }
    g.lineStyle(1.6, a, hot ? 1 : 0.6); g.strokePoints(pts, true);
    g.fillStyle(a, hot ? 1 : 0.7); g.fillRect(x + 4, y + h / 2 - 8, 3, 16);
    if (this.o.icon) drawIcon(g, this.o.icon, x + 32, 0, 24, hot ? 0xffffff : a);
    this.setScale(this.down ? 0.97 : 1);
  }
}

/** Round touch button (HUD). */
export class RoundButton extends Phaser.GameObjects.Container {
  g: Phaser.GameObjects.Graphics; r: number; icon: IconName; accent: number; label?: Phaser.GameObjects.Text;
  active = false; pressed = false; enabled = true;
  onPress: () => void;
  constructor(scene: Phaser.Scene, x: number, y: number, r: number, icon: IconName, onPress: () => void, accent = C.cyan, caption?: string) {
    super(scene, x, y);
    this.r = r; this.icon = icon; this.accent = accent; this.onPress = onPress;
    this.g = scene.add.graphics(); this.add(this.g);
    if (caption) { this.label = T(scene, 0, r + 12, caption, 13, C.dim, { weight: '700' }).setOrigin(0.5); this.add(this.label); }
    this.setSize(r * 2, r * 2);
    this.setInteractive(new Phaser.Geom.Circle(r, r, r), Phaser.Geom.Circle.Contains);
    this.on('pointerdown', (_p: any, _x: any, _y: any, ev: Phaser.Types.Input.EventData) => { ev?.stopPropagation?.(); if (!this.enabled) return; this.pressed = true; this.draw(); Audio.unlock(); this.onPress(); });
    this.on('pointerup', () => { this.pressed = false; this.draw(); });
    this.on('pointerout', () => { this.pressed = false; this.draw(); });
    this.draw(); scene.add.existing(this);
  }
  setActive2(v: boolean) { if (v !== this.active) { this.active = v; this.draw(); } return this; }
  draw() {
    const g = this.g; g.clear(); const r = this.r; const a = this.active ? this.accent : 0x6b7fa3;
    if (this.active) { g.fillStyle(this.accent, 0.12); g.fillCircle(0, 0, r + 10); }
    g.fillStyle(0x060a14, this.pressed ? 0.95 : 0.78); g.fillCircle(0, 0, r);
    g.lineStyle(2, a, this.active ? 1 : 0.6); g.strokeCircle(0, 0, r);
    g.lineStyle(1, a, 0.3); g.strokeCircle(0, 0, r - 7);
    drawIcon(g, this.icon, 0, 0, r * 0.95, this.active ? 0xffffff : a);
    this.setScale(this.pressed ? 0.92 : 1);
  }
}
