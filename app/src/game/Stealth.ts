import Phaser from 'phaser';
import { Audio } from '../core/audio';

export type V2 = { x: number; y: number };
type Rect = Phaser.Geom.Rectangle;

// ---------------------------------------------------------------- geometry
/** Does segment a-b cross rectangle r? (Liang–Barsky) */
export function segHitsRect(ax: number, ay: number, bx: number, by: number, r: Rect): boolean {
  let t0 = 0, t1 = 1; const dx = bx - ax, dy = by - ay;
  const p = [-dx, dx, -dy, dy], q = [ax - r.x, r.right - ax, ay - r.y, r.bottom - ay];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return false; continue; }
    const t = q[i] / p[i];
    if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
  }
  return true;
}
/** Distance along a ray (unit dir) to the first rectangle, capped at max. */
export function rayCast(ox: number, oy: number, dx: number, dy: number, max: number, rects: Rect[]): number {
  let best = max;
  for (const r of rects) {
    let t0 = 0, t1 = best;
    const p = [-dx, dx, -dy, dy], q = [ox - r.x, r.right - ox, oy - r.y, r.bottom - oy];
    let ok = true;
    for (let i = 0; i < 4 && ok; i++) {
      if (p[i] === 0) { if (q[i] < 0) ok = false; continue; }
      const t = q[i] / p[i];
      if (p[i] < 0) { if (t > t1) ok = false; else if (t > t0) t0 = t; } else { if (t < t0) ok = false; else if (t < t1) t1 = t; }
    }
    if (ok && t0 < best) best = Math.max(0, t0);
  }
  return best;
}
export function clearLine(a: V2, b: V2, rects: Rect[]) { for (const r of rects) if (segHitsRect(a.x, a.y, b.x, b.y, r)) return false; return true; }
export function distToSeg(px: number, py: number, a: V2, b: V2) {
  const vx = b.x - a.x, vy = b.y - a.y, L2 = vx * vx + vy * vy || 1;
  const t = Phaser.Math.Clamp(((px - a.x) * vx + (py - a.y) * vy) / L2, 0, 1);
  return Math.hypot(px - (a.x + vx * t), py - (a.y + vy * t));
}
const angDiff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

// ---------------------------------------------------------------- guard drone
export type GState = 'patrol' | 'suspicious' | 'alert' | 'chase' | 'search' | 'return';
export interface GuardCfg { path: V2[]; wait?: number; speed: number; chase: number; range: number; fov: number; susRate: number; name?: string; alertDelay?: number; catchStun?: number; susDecay?: number }
/** What the guard needs from the world each frame. */
export interface GuardWorld { px: number; py: number; hidden: boolean; blockers: Rect[]; onCatch: (g: Guard) => void; onState: (g: Guard, s: GState) => void }

const STATE_COL: Record<GState, number> = { patrol: 0x4fd8ff, suspicious: 0xffc24d, alert: 0xff3d5a, chase: 0xff3d5a, search: 0xff9a3d, return: 0x4fd8ff };

/**
 * Security drone: patrol -> suspicious -> alert(detected) -> chase -> search -> return -> patrol.
 * Sees the player inside a cone (range, field of view) unless a wall/prop blocks the line of sight or the player is
 * hidden in a locker. Suspicion fills while the player stays in view (faster when close) and drains when out of view.
 */
export class Guard {
  scene: Phaser.Scene; cfg: GuardCfg;
  x: number; y: number; dir = 0;
  state: GState = 'patrol';
  wp = 1; waitT = 0; sus = 0; stateT = 0; stun = 0;
  last: V2 = { x: 0, y: 0 }; seeing = false; lookBase = 0;
  root: Phaser.GameObjects.Container; body: Phaser.GameObjects.Image; eye: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image; cone: Phaser.GameObjects.Graphics; mark: Phaser.GameObjects.Text; meter: Phaser.GameObjects.Graphics;
  private hoverT = Math.random() * 10;

  constructor(scene: Phaser.Scene, cfg: GuardCfg) {
    this.scene = scene; this.cfg = cfg;
    const p0 = cfg.path[0]; this.x = p0.x; this.y = p0.y;
    const p1 = cfg.path[1 % cfg.path.length]; this.dir = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    this.cone = scene.add.graphics().setDepth(-880);
    this.shadow = scene.add.image(0, 0, 'shadow').setScale(1.3, 0.9).setAlpha(0.7);
    this.glow = scene.add.image(0, -50, 'light').setScale(0.55).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.35);
    this.body = scene.add.image(0, -18, 'guard_body').setOrigin(0.5, 1).setScale(0.5);
    this.eye = scene.add.image(0, -40, 'guard_eye').setScale(0.42).setBlendMode(Phaser.BlendModes.ADD);
    this.mark = scene.add.text(0, -88, '', { fontFamily: 'sans-serif', fontSize: '30px', fontStyle: '900', color: '#ffc24d', stroke: '#000', strokeThickness: 5 }).setOrigin(0.5);
    this.meter = scene.add.graphics();
    this.root = scene.add.container(this.x, this.y, [this.shadow, this.glow, this.body, this.eye, this.meter, this.mark]);
    this.reset();
  }

  /** back to the start of the patrol (respawn / checkpoint) */
  reset() {
    const p0 = this.cfg.path[0]; this.x = p0.x; this.y = p0.y; this.wp = 1 % this.cfg.path.length; this.waitT = 0;
    this.sus = 0; this.stun = 0; this.setState('patrol', true);
  }

  setState(s: GState, silent = false) {
    if (this.state === s) return;
    this.state = s; this.stateT = 0;
    this.mark.setText(s === 'suspicious' ? '?' : s === 'alert' || s === 'chase' ? '!' : s === 'search' ? '?' : '').setColor(s === 'suspicious' || s === 'search' ? '#ffc24d' : '#ff3d5a');
    if (s === 'alert') { this.scene.tweens.add({ targets: this.mark, scale: { from: 1.8, to: 1 }, duration: 260, ease: 'Back.out' }); }
    if (s === 'search') this.lookBase = this.dir;
    if (!silent) (this.scene as any).onGuardState?.(this, s);
  }

  canSee(w: GuardWorld) {
    if (w.hidden) return false;
    const dx = w.px - this.x, dy = (w.py - 20) - (this.y - 20), d = Math.hypot(dx, dy);
    if (d < 46) return true;                                    // bumped into it
    const range = this.state === 'chase' || this.state === 'search' ? this.cfg.range * 1.25 : this.cfg.range;
    if (d > range) return false;
    if (Math.abs(angDiff(Math.atan2(dy, dx), this.dir)) > (this.cfg.fov * Math.PI / 180) / 2) return false;
    return clearLine({ x: this.x, y: this.y - 20 }, { x: w.px, y: w.py - 20 }, w.blockers);
  }

  private moveTo(tx: number, ty: number, speed: number, dt: number, blockers: Rect[]) {
    const dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy);
    if (d < 2) return true;
    const step = Math.min(d, speed * dt);
    const want = Math.atan2(dy, dx);
    this.dir += angDiff(want, this.dir) * Math.min(1, dt * 8);
    let nx = this.x + dx / d * step, ny = this.y + dy / d * step;
    // keep a 22-unit body clear of walls / props (push out of overlapping rectangles)
    for (const r of blockers) {
      const cx = Phaser.Math.Clamp(nx, r.x, r.right), cy = Phaser.Math.Clamp(ny - 12, r.y, r.bottom);
      const ox = nx - cx, oy = (ny - 12) - cy, o = Math.hypot(ox, oy);
      if (o < 22) { if (o < 0.01) { nx = this.x; ny = this.y; } else { nx = cx + ox / o * 22; ny = cy + oy / o * 22 + 12; } }
    }
    this.x = nx; this.y = ny;
    return d <= step + 0.5;
  }

  update(dt: number, w: GuardWorld) {
    this.stateT += dt; this.hoverT += dt;
    const see = this.canSee(w); this.seeing = see;
    if (see) this.last = { x: w.px, y: w.py };
    const path = this.cfg.path;
    if (this.stun > 0) { this.stun -= dt; }
    else switch (this.state) {
      case 'patrol': case 'return': {
        if (see) { this.setState('suspicious'); break; }
        const target = this.state === 'return' ? this.nearestWp() : path[this.wp];
        if (this.waitT > 0) { this.waitT -= dt; this.dir += Math.sin(this.hoverT * 1.3) * dt * 0.9; break; }
        if (this.moveTo(target.x, target.y, this.cfg.speed, dt, w.blockers)) {
          if (this.state === 'return') { this.wp = path.indexOf(target); this.setState('patrol'); }
          this.wp = (this.wp + 1) % path.length; this.waitT = this.cfg.wait ?? 1.2;
        }
        break;
      }
      case 'suspicious': {
        // stop and turn towards the disturbance; suspicion fills faster up close
        const a = Math.atan2(this.last.y - this.y, this.last.x - this.x);
        this.dir += angDiff(a, this.dir) * Math.min(1, dt * 3);
        if (see) { const d = Math.hypot(w.px - this.x, w.py - this.y); this.sus += dt * this.cfg.susRate * (d < this.cfg.range * 0.5 ? 2.2 : 1); }
        else { this.sus -= dt * (this.cfg.susDecay ?? 0.45); if (this.stateT > 1.2) this.moveTo(this.last.x, this.last.y, this.cfg.speed * 0.6, dt, w.blockers); }
        if (this.sus >= 1) { this.sus = 1; this.setState('alert'); Audio.play('alert'); }
        else if (this.sus <= 0) { this.sus = 0; this.setState('return'); }
        break;
      }
      case 'alert':
        this.dir += angDiff(Math.atan2(w.py - this.y, w.px - this.x), this.dir) * Math.min(1, dt * 10);
        if (this.stateT > (this.cfg.alertDelay ?? 0.55)) this.setState('chase');
        break;
      case 'chase': {
        const reached = this.moveTo(this.last.x, this.last.y, this.cfg.chase, dt, w.blockers);
        if (see && Math.hypot(w.px - this.x, w.py - this.y) < 40) { w.onCatch(this); this.stun = this.cfg.catchStun ?? 1.4; this.setState('search'); break; }
        if (!see && (reached || this.stateT > 6)) this.setState('search');
        if (see) this.stateT = Math.min(this.stateT, 3);
        break;
      }
      case 'search':
        // look left and right around the last known position
        this.dir = this.lookBase + Math.sin(this.stateT * 2.2) * 1.3;
        if (see && this.stun <= 0) { this.sus = 0.7; this.setState('suspicious'); break; }
        if (this.stateT > 4) { this.sus = 0; this.setState('return'); }
        break;
    }
    if (this.state === 'patrol' || this.state === 'return') this.sus = Math.max(0, this.sus - dt * 0.5);
    this.draw(w);
  }

  nearestWp() { let b = this.cfg.path[0], bd = 1e9; for (const p of this.cfg.path) { const d = Math.hypot(p.x - this.x, p.y - this.y); if (d < bd) { bd = d; b = p; } } return b; }

  draw(w: GuardWorld) {
    const col = STATE_COL[this.state];
    const bob = Math.sin(this.hoverT * 3) * 3;
    this.root.setPosition(this.x, this.y).setDepth(this.y);
    this.body.y = -18 + bob; this.glow.y = -50 + bob;
    this.eye.setPosition(Math.cos(this.dir) * 14, -42 + bob + Math.sin(this.dir) * 3).setTint(col).setAlpha(this.stun > 0 ? 0.3 + 0.3 * Math.sin(this.hoverT * 30) : 1);
    this.glow.setTint(col);
    this.mark.y = -96 + bob;
    this.meter.clear();
    if (this.state === 'suspicious' && this.sus > 0) {
      this.meter.fillStyle(0x000000, 0.7); this.meter.fillRoundedRect(-24, -74 + bob, 48, 7, 3);
      this.meter.fillStyle(0xffc24d, 1); this.meter.fillRoundedRect(-24, -74 + bob, 48 * this.sus, 7, 3);
    }
    // vision cone, clipped by walls / props (what the drone can actually see)
    const g = this.cone; g.clear();
    if (this.stun > 0) return;
    const range = this.state === 'chase' || this.state === 'search' ? this.cfg.range * 1.25 : this.cfg.range;
    const half = this.cfg.fov * Math.PI / 360, n = 18, ox = this.x, oy = this.y - 20;
    const pts: number[] = [ox, oy];
    for (let i = 0; i <= n; i++) {
      const a = this.dir - half + (2 * half) * i / n, dx = Math.cos(a), dy = Math.sin(a);
      const d = rayCast(ox, oy, dx, dy, range, w.blockers);
      pts.push(ox + dx * d, oy + dy * d);
    }
    const alpha = this.state === 'patrol' || this.state === 'return' ? 0.16 : 0.28;
    g.fillStyle(col, alpha); g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); g.fillPath();
    g.lineStyle(2, col, alpha + 0.3); g.strokePath();
  }

  destroy() { this.root.destroy(); this.cone.destroy(); }
}

// ---------------------------------------------------------------- lasers
export interface LaserCfg {
  a: V2; b: V2;                       // base segment
  kind: 'blink' | 'sweepX' | 'sweepY';
  period: number; on?: number;        // seconds on per period (blink always; sweeps too when set = they go dark for the rest)
  amp?: number; phase?: number;
  group?: string;
}
/**
 * Security laser. 'blink' beams switch on for `on` seconds every `period` and flicker for 0.6 s before switching on
 * (warning). 'sweep' beams are always on and glide back and forth (amp) — cross behind them.
 */
export class Laser {
  scene: Phaser.Scene; cfg: LaserCfg; mul = 1; enabled = true; t = 0; hitR = 16;
  g: Phaser.GameObjects.Graphics; n1: Phaser.GameObjects.Image; n2: Phaser.GameObjects.Image;
  wasOn = false;
  constructor(scene: Phaser.Scene, cfg: LaserCfg) {
    this.scene = scene; this.cfg = cfg; this.t = cfg.phase ?? 0;
    this.g = scene.add.graphics().setDepth(7000).setBlendMode(Phaser.BlendModes.ADD);
    this.n1 = scene.add.image(cfg.a.x, cfg.a.y, 'laser_node').setScale(0.6).setDepth(7001);
    this.n2 = scene.add.image(cfg.b.x, cfg.b.y, 'laser_node').setScale(0.6).setDepth(7001);
  }
  seg(): [V2, V2] {
    const c = this.cfg; let ox = 0, oy = 0;
    if (c.kind !== 'blink') { const s = Math.sin(this.t * Math.PI * 2 / c.period) * (c.amp ?? 0); if (c.kind === 'sweepX') ox = s; else oy = s; }
    return [{ x: c.a.x + ox, y: c.a.y + oy }, { x: c.b.x + ox, y: c.b.y + oy }];
  }
  phase() { const c = this.cfg; return ((this.t % c.period) + c.period) % c.period; }
  on() { if (!this.enabled) return false; if (this.cfg.kind !== 'blink' && this.cfg.on === undefined) return true; return this.phase() < (this.cfg.on ?? 1); }
  warning() { return this.enabled && (this.cfg.kind === 'blink' || this.cfg.on !== undefined) && this.phase() > this.cfg.period - 0.6; }
  update(dt: number, near: boolean) {
    this.t += dt * this.mul;
    const [a, b] = this.seg(); const g = this.g; g.clear();
    this.n1.setPosition(a.x, a.y).setVisible(this.enabled); this.n2.setPosition(b.x, b.y).setVisible(this.enabled);
    if (!this.enabled) return;
    const on = this.on();
    if (on) {
      const f = 0.85 + 0.15 * Math.sin(this.t * 40);
      g.lineStyle(16, 0xff2050, 0.18 * f); g.lineBetween(a.x, a.y, b.x, b.y);
      g.lineStyle(7, 0xff3d6a, 0.55 * f); g.lineBetween(a.x, a.y, b.x, b.y);
      g.lineStyle(2.4, 0xffe6ee, 0.95); g.lineBetween(a.x, a.y, b.x, b.y);
      if (!this.wasOn && near) Audio.play('laser');
    } else if (this.warning()) {
      // pre-warning: thin dashed flicker along the beam path
      if (Math.sin(this.t * 50) > 0) { g.lineStyle(1.6, 0xffc24d, 0.8); const n = 14; for (let i = 0; i < n; i += 2) g.lineBetween(a.x + (b.x - a.x) * i / n, a.y + (b.y - a.y) * i / n, a.x + (b.x - a.x) * (i + 1) / n, a.y + (b.y - a.y) * (i + 1) / n); }
    } else { g.lineStyle(1, 0xff3d6a, 0.18); g.lineBetween(a.x, a.y, b.x, b.y); }
    this.wasOn = on;
  }
  hits(px: number, py: number) { if (!this.on()) return false; const [a, b] = this.seg(); return distToSeg(px, py - 18, a, b) < this.hitR; }
  destroy() { this.g.destroy(); this.n1.destroy(); this.n2.destroy(); }
}
