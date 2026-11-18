import Phaser from 'phaser';
import { Audio } from '../core/audio';
import { BOT_HEX } from '../scenes/BootScene';

type Facing = 'front' | 'side' | 'back';
type Act = 'interact' | 'scan' | 'damage' | 'victory';

/** Register frame animations for one bot colour (atlas `bot_<color>`, built by tools/build_atlas.py). */
export function ensureBotAnims(scene: Phaser.Scene, color: string) {
  const key = `bot_${color}`;
  const mk = (name: string, n: number, fps: number, repeat: number) => {
    const k = `${color}_${name}`;
    if (scene.anims.exists(k)) return;
    scene.anims.create({ key: k, frames: Array.from({ length: n }, (_, i) => ({ key, frame: `${name}_${i}` })), frameRate: fps, repeat });
  };
  mk('idle', 4, 5, -1); mk('walk', 8, 12, -1); mk('run', 8, 16, -1);
  mk('fwalk', 8, 11, -1); mk('bwalk', 8, 11, -1);
  mk('interact', 4, 10, 0); mk('scan', 5, 9, 0); mk('hit', 3, 9, 0); mk('victory', 5, 8, -1);
}

/**
 * Test-unit avatar driven by sprite-sheet animations (idle / walk / run / interact / scan / hit / victory)
 * plus light procedural polish: acceleration easing, lean, step bob, squash, shadow.
 * Side frames face right and are mirrored for left. Up/down movement uses dedicated 8-frame
 * front (fwalk) / back (bwalk) walk cycles; running plays the same cycles faster.
 */
export class Player {
  scene: Phaser.Scene;
  root: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  aura: Phaser.GameObjects.Image;
  carry: Phaser.GameObjects.Image;
  phys: Phaser.GameObjects.Zone;
  pb: Phaser.Physics.Arcade.Body;
  color: string;
  facing: Facing = 'front';
  flip = false;
  vx = 0; vy = 0;
  t = 0;
  action: null | { kind: Act; t: number; dur: number; dx?: number; dy?: number } = null;
  stun = 0;
  frozen = false;
  private stepAcc = 0;
  private idleT = 0;
  private trail: Phaser.GameObjects.Particles.ParticleEmitter;
  private dust: Phaser.GameObjects.Particles.ParticleEmitter;
  private baseScale = 0.45;
  private cur = '';
  private pvx = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, color: string) {
    this.scene = scene; this.color = color;
    ensureBotAnims(scene, color);
    this.root = scene.add.container(x, y);
    this.shadow = scene.add.image(0, 0, 'shadow').setScale(1.1, 1.0).setAlpha(0.8);
    this.aura = scene.add.image(0, -44, 'light').setScale(0.6).setTint(BOT_HEX[color]).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.12);
    this.body = scene.add.sprite(0, 0, `bot_${color}`, 'front_0').setScale(this.baseScale);
    this.carry = scene.add.image(0, -112, 'bone_holo_humerus').setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.root.add([this.shadow, this.aura, this.body, this.carry]);
    this.phys = scene.add.zone(x, y - 10, 34, 24);
    scene.physics.add.existing(this.phys);
    this.pb = this.phys.body as Phaser.Physics.Arcade.Body;
    this.pb.setCircle(15, 2, -3);
    this.pb.setCollideWorldBounds(true);
    this.trail = scene.add.particles(0, 0, 'dot', {
      lifespan: 420, speed: { min: 10, max: 40 }, scale: { start: 0.35, end: 0 }, alpha: { start: 0.5, end: 0 },
      tint: [0x5fd0ff, BOT_HEX[color]], blendMode: 'ADD', emitting: false,
    });
    this.dust = scene.add.particles(0, 0, 'smoke', {
      lifespan: 500, speedX: { min: -30, max: 30 }, speedY: { min: -30, max: -8 }, scale: { start: 0.08, end: 0.22 },
      alpha: { start: 0.35, end: 0 }, tint: 0xb8c8e6, emitting: false,
    });
    this.setAnim('idle');
  }

  get x() { return this.root.x; }
  get y() { return this.root.y; }

  private setAnim(name: string) {
    if (this.cur === name) return;
    this.cur = name;
    if (name === 'front' || name === 'back') { this.body.stop(); this.body.setFrame(`${name}_0`); return; }
    this.body.play(`${this.color}_${name}`);
  }

  setCarry(key: string | null) {
    if (!key) { this.carry.setVisible(false); return; }
    this.carry.setTexture(key).setVisible(true);
    this.carry.setScale(46 / Math.max(this.carry.width, this.carry.height) * 2);
  }

  play(kind: Act, dx = 0, dy = 0) {
    const dur = { interact: 420, scan: 600, damage: 520, victory: 99999 }[kind];
    this.action = { kind, t: 0, dur, dx, dy };
    if (kind === 'interact' || kind === 'scan') {
      if (Math.abs(dx) > 1) this.flip = dx < 0;
      this.facing = 'side';
      this.cur = ''; this.setAnim(kind);
    }
    if (kind === 'damage') {
      this.stun = 0.45;
      const len = Math.hypot(dx, dy) || 1;
      this.vx = dx / len * 520; this.vy = dy / len * 520;
      this.cur = ''; this.setAnim('hit');
      this.body.setTintFill(0xff3355);
      this.scene.time.delayedCall(90, () => this.body.clearTint());
      this.scene.time.delayedCall(180, () => this.body.setTintFill(0xff3355));
      this.scene.time.delayedCall(260, () => this.body.clearTint());
    }
    if (kind === 'victory') { this.cur = ''; this.setAnim('victory'); }
  }

  update(dt: number, ix: number, iy: number, run: boolean) {
    this.t += dt;
    if (this.frozen) { ix = 0; iy = 0; }
    if (this.stun > 0) { this.stun -= dt; ix = 0; iy = 0; }
    const mag = Math.min(1, Math.hypot(ix, iy));
    const speed = run ? 380 : 250;
    const nlen = Math.max(1e-6, Math.hypot(ix, iy));
    const tx = mag > 0.05 ? ix / nlen * mag * speed : 0;
    const ty = mag > 0.05 ? iy / nlen * mag * speed : 0;
    const k = 1 - Math.exp(-(mag > 0.05 ? 11 : 9) * dt);
    if (this.stun <= 0) { this.vx += (tx - this.vx) * k; this.vy += (ty - this.vy) * k; } else { this.vx *= 0.9; this.vy *= 0.9; }
    if (Math.abs(this.vx) < 2) this.vx = 0;
    if (Math.abs(this.vy) < 2) this.vy = 0;
    this.pb.setVelocity(this.vx, this.vy);

    const sp = Math.hypot(this.vx, this.vy);
    const moving = sp > 30 && mag > 0.05;
    const running = sp > 300;
    const a = this.action;
    const busy = a && a.kind !== 'victory' ? true : false;

    // facing: favour side view (it has a real walk cycle) unless movement is mostly vertical
    if (moving && !busy) {
      if (Math.abs(this.vx) > Math.abs(this.vy) * 0.45) { this.facing = 'side'; this.flip = this.vx < 0; }
      else this.facing = this.vy < 0 ? 'back' : 'front';
    }

    let bob = 0, tilt = 0, sx = 1, sy = 1, lift = 0;
    if (a) {
      a.t += dt * 1000;
      const p = Math.min(1, a.t / a.dur);
      if (a.kind === 'scan') lift = Math.sin(p * Math.PI) * 8;
      if (a.kind === 'damage') tilt = Math.sin(p * Math.PI * 6) * 0.15 * (1 - p);
      if (a.kind === 'victory') { const ph = (a.t / 1000) * 5; lift = Math.abs(Math.sin(ph)) * 30; sy = 1 + Math.sin(ph * 2) * 0.05; }
      if (p >= 1 && a.kind !== 'victory') { this.action = null; this.cur = ''; }
    }
    if (!this.action) {
      if (moving) {
        this.idleT = 0;
        if (this.facing === 'side') {
          this.setAnim(running ? 'run' : 'walk');
          this.body.anims.timeScale = Phaser.Math.Clamp(sp / (running ? 380 : 250), 0.6, 1.2);
          tilt = (running ? 0.07 : 0.025) * (this.flip ? -1 : 1);
        } else {
          // front/back walk: dedicated 8-frame cycles (running = same cycle, faster)
          this.setAnim(this.facing === 'back' ? 'bwalk' : 'fwalk');
          this.body.anims.timeScale = Phaser.Math.Clamp(sp / 250, 0.6, 1.55);
        }
        this.stepAcc += dt * (running ? 15 : 11) / Math.PI;
        if (this.stepAcc >= 1) {
          this.stepAcc = 0; Audio.play('step');
          if (running) this.dust.emitParticleAt(this.root.x - (this.flip ? -12 : 12), this.root.y - 2, 1);
        }
      } else {
        this.idleT += dt;
        if (this.facing === 'back' && this.idleT < 1.2) this.setAnim('back');
        else { this.setAnim('idle'); this.facing = 'front'; }
        this.body.anims.timeScale = 1;
      }
    }
    // acceleration lean
    tilt += Phaser.Math.Clamp((this.vx - this.pvx) * 0.0005, -0.05, 0.05);
    this.pvx = this.vx;

    this.body.setFlipX(this.flip && (this.cur === 'walk' || this.cur === 'run' || this.cur === 'interact' || this.cur === 'scan'));
    this.body.y = bob - lift;
    this.body.rotation = tilt;
    this.body.setScale(this.baseScale * sx, this.baseScale * sy);
    const hover = (lift - bob) / 40;
    this.shadow.setScale(1.1 * (1 - hover * 0.3), 1.0 * (1 - hover * 0.3)).setAlpha(0.8 - hover * 0.3);
    this.carry.y = -112 + Math.sin(this.t * 3) * 4 + this.body.y; this.carry.rotation += dt * 0.8;
    this.aura.y = -44 + this.body.y;

    this.root.setPosition(this.phys.x, this.phys.y + 10);
    this.root.setDepth(this.root.y);
    this.trail.setDepth(this.root.y - 1); this.dust.setDepth(this.root.y - 2);
    if (running && this.facing === 'side') this.trail.emitParticleAt(this.root.x + Phaser.Math.Between(-8, 8), this.root.y - 30, 1);
  }

  burst(color = 0x5fd0ff, n = 18) { this.trail.setParticleTint(color); this.trail.emitParticleAt(this.root.x, this.root.y - 40, n); this.trail.setParticleTint(0x5fd0ff); }
  destroy() { this.root.destroy(); this.phys.destroy(); this.trail.destroy(); this.dust.destroy(); }
}
