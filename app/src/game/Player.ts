import Phaser from 'phaser';
import { Audio } from '../core/audio';
import { BOT_HEX } from '../scenes/BootScene';

type Facing = 'front' | 'side' | 'back';

/**
 * Test-unit avatar. One hi-res cut-out per facing (front / side / back) animated with a lightweight
 * 2D rig: hover bob, lean into motion, squash & stretch, acceleration/deceleration, thruster glow.
 * States: idle, move, run, interact, carry, scan, damage, victory.
 */
export class Player {
  scene: Phaser.Scene;
  root: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  jet: Phaser.GameObjects.Image;
  aura: Phaser.GameObjects.Image;
  carry: Phaser.GameObjects.Image;
  phys: Phaser.GameObjects.Zone;
  pb: Phaser.Physics.Arcade.Body;
  color: string;
  facing: Facing = 'front';
  flip = false;
  vx = 0; vy = 0;
  t = 0;
  action: null | { kind: 'interact' | 'scan' | 'damage' | 'victory'; t: number; dur: number; dx?: number; dy?: number } = null;
  stun = 0;
  frozen = false;
  private stepAcc = 0;
  private stepFrame = 1;
  private trail: Phaser.GameObjects.Particles.ParticleEmitter;
  private baseScale = 0.42;
  private hasWalk: Record<Facing, boolean> = { front: false, side: false, back: false };

  constructor(scene: Phaser.Scene, x: number, y: number, color: string) {
    this.scene = scene; this.color = color;
    this.root = scene.add.container(x, y);
    this.shadow = scene.add.image(0, 2, 'shadow').setScale(1.15, 1.1).setAlpha(0.85);
    this.jet = scene.add.image(0, -2, 'light').setScale(0.22, 0.09).setTint(0x5fd0ff).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.6);
    this.aura = scene.add.image(0, -44, 'light').setScale(0.6).setTint(BOT_HEX[color]).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.14);
    this.body = scene.add.image(0, 0, `bot_s_${color}_front`).setOrigin(0.5, 1).setScale(this.baseScale);
    this.carry = scene.add.image(0, -112, 'bone_holo_humerus').setScale(0.07).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.root.add([this.shadow, this.jet, this.aura, this.body, this.carry]);
    for (const f of ['front', 'side', 'back'] as Facing[]) this.hasWalk[f] = scene.textures.exists(`bot_s_${color}_${f}_walk1`) && scene.textures.exists(`bot_s_${color}_${f}_walk2`);
    this.phys = scene.add.zone(x, y - 10, 34, 24);
    scene.physics.add.existing(this.phys);
    this.pb = this.phys.body as Phaser.Physics.Arcade.Body;
    this.pb.setCircle(15, 2, -3);
    this.pb.setCollideWorldBounds(true);
    this.trail = scene.add.particles(0, 0, 'dot', {
      lifespan: 420, speed: { min: 10, max: 40 }, scale: { start: 0.35, end: 0 }, alpha: { start: 0.5, end: 0 },
      tint: [0x5fd0ff, BOT_HEX[color]], blendMode: 'ADD', emitting: false, frequency: 30,
    });
  }

  get x() { return this.root.x; }
  get y() { return this.root.y; }

  setCarry(key: string | null) {
    if (!key) { this.carry.setVisible(false); return; }
    this.carry.setTexture(key).setVisible(true);
    const s = 46 / Math.max(this.carry.width, this.carry.height) * 2; this.carry.setScale(s);
  }

  play(kind: 'interact' | 'scan' | 'damage' | 'victory', dx = 0, dy = 0) {
    const dur = { interact: 420, scan: 900, damage: 520, victory: 99999 }[kind];
    this.action = { kind, t: 0, dur, dx, dy };
    if (kind === 'damage') {
      this.stun = 0.45;
      const len = Math.hypot(dx, dy) || 1;
      this.vx = dx / len * 520; this.vy = dy / len * 520;
      this.body.setTintFill(0xff3355);
      this.scene.time.delayedCall(90, () => this.body.clearTint());
      this.scene.time.delayedCall(180, () => this.body.setTintFill(0xff3355));
      this.scene.time.delayedCall(260, () => this.body.clearTint());
    }
    if (kind === 'interact' && (dx || dy)) this.face(dx, dy);
  }

  private face(dx: number, dy: number) {
    let f: Facing; let flip = this.flip;
    if (Math.abs(dx) > Math.abs(dy) * 0.7) { f = 'side'; flip = dx > 0; } else f = dy < 0 ? 'back' : 'front';
    if (f !== this.facing || flip !== this.flip) {
      this.facing = f; this.flip = flip;
      this.body.setTexture(`bot_s_${this.color}_${f}`);
      this.body.setFlipX(f === 'side' && flip);
    }
  }

  update(dt: number, ix: number, iy: number, run: boolean) {
    this.t += dt;
    if (this.frozen) { ix = 0; iy = 0; }
    if (this.stun > 0) { this.stun -= dt; ix = 0; iy = 0; }
    const mag = Math.min(1, Math.hypot(ix, iy));
    const speed = run ? 380 : 250;
    const tx = mag > 0.05 ? ix / Math.max(1e-6, Math.hypot(ix, iy)) * mag * speed : 0;
    const ty = mag > 0.05 ? iy / Math.max(1e-6, Math.hypot(ix, iy)) * mag * speed : 0;
    const accel = mag > 0.05 ? 11 : 9;
    const k = 1 - Math.exp(-accel * dt);
    if (this.stun <= 0) { this.vx += (tx - this.vx) * k; this.vy += (ty - this.vy) * k; } else { this.vx *= 0.9; this.vy *= 0.9; }
    if (Math.abs(this.vx) < 2) this.vx = 0; if (Math.abs(this.vy) < 2) this.vy = 0;
    this.pb.setVelocity(this.vx, this.vy);

    const sp = Math.hypot(this.vx, this.vy);
    if (sp > 30 && mag > 0.05) this.face(this.vx, this.vy);
    const moving = sp > 30;
    const running = sp > 300;

    // --- procedural rig ---
    let bob = 0, tilt = 0, sx = 1, sy = 1, lift = 0, spin = 0;
    if (moving) {
      const f = running ? 15 : 11;
      const ph = this.t * f;
      bob = -Math.abs(Math.sin(ph)) * (running ? 9 : 6);
      sy = 1 + Math.sin(ph * 2) * 0.03; sx = 1 - Math.sin(ph * 2) * 0.025;
      tilt = Phaser.Math.Clamp(this.vx / 380, -1, 1) * (running ? 0.16 : 0.09);
      if (this.facing !== 'side') tilt += Math.sin(ph) * 0.04;
      this.stepAcc += dt * f / Math.PI;
      if (this.stepAcc >= 1) { this.stepAcc = 0; Audio.play('step'); this.stepFrame = this.stepFrame === 1 ? 2 : 1; }
      if (this.hasWalk[this.facing]) this.body.setTexture(`bot_s_${this.color}_${this.facing}_walk${this.stepFrame}`);
    } else {
      if (this.hasWalk[this.facing] && this.body.texture.key !== `bot_s_${this.color}_${this.facing}`) this.body.setTexture(`bot_s_${this.color}_${this.facing}`);
      bob = Math.sin(this.t * 2.4) * 2.5 - 3;
      sy = 1 + Math.sin(this.t * 2.4) * 0.012;
      tilt = Math.sin(this.t * 1.3) * 0.015;
    }
    // accel lean (velocity change)
    tilt += Phaser.Math.Clamp((this.vx - (this as any)._pvx || 0) * 0.0006, -0.06, 0.06);
    (this as any)._pvx = this.vx;

    const a = this.action;
    if (a) {
      a.t += dt * 1000;
      const p = Math.min(1, a.t / a.dur);
      if (a.kind === 'interact') { const s = Math.sin(p * Math.PI); sy *= 1 - s * 0.1; sx *= 1 + s * 0.08; tilt += (a.dx ?? 0) > 0 ? s * 0.12 : (a.dx ?? 0) < 0 ? -s * 0.12 : 0; }
      if (a.kind === 'scan') { const s = Math.sin(p * Math.PI); lift = s * 16; spin = p < 1 ? Math.sin(p * Math.PI * 2) * 0.12 : 0; sx *= 1 + s * 0.05; }
      if (a.kind === 'damage') { tilt += Math.sin(p * Math.PI * 6) * 0.2 * (1 - p); }
      if (a.kind === 'victory') { const ph = (a.t / 1000) * 5; lift = Math.abs(Math.sin(ph)) * 34; sy *= 1 + Math.sin(ph * 2) * 0.06; spin = Math.sin(ph * 0.5) * 0.18; }
      if (p >= 1 && a.kind !== 'victory') this.action = null;
    }

    this.body.y = bob - lift;
    this.body.rotation = tilt + spin;
    this.body.setScale(this.baseScale * sx, this.baseScale * sy);
    const hover = (bob - lift) / -40;
    this.shadow.setScale(1.15 * (1 - hover * 0.35), 1.1 * (1 - hover * 0.35)).setAlpha(0.85 - hover * 0.3);
    this.jet.setAlpha(moving ? (running ? 0.95 : 0.7) : 0.45 + Math.sin(this.t * 8) * 0.05).setScale(running ? 0.34 : 0.24, 0.1);
    this.carry.y = -112 + Math.sin(this.t * 3) * 4 + this.body.y; this.carry.rotation += dt * 0.8;
    this.aura.y = -44 + this.body.y;

    // sync visual to physics body
    this.root.setPosition(this.phys.x, this.phys.y + 10);
    this.root.setDepth(this.root.y);
    this.trail.setDepth(this.root.y - 1);
    if (running) this.trail.emitParticleAt(this.root.x + Phaser.Math.Between(-8, 8), this.root.y - 6, 1);
  }

  burst(color = 0x5fd0ff, n = 18) { this.trail.setParticleTint(color); this.trail.emitParticleAt(this.root.x, this.root.y - 40, n); this.trail.setParticleTint(0x5fd0ff); }
  destroy() { this.root.destroy(); this.phys.destroy(); this.trail.destroy(); }
}
