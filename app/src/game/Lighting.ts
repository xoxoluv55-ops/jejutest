import Phaser from 'phaser';
import { LightDef } from '../data/map';

/**
 * 2D lighting: a darkness RenderTexture following the camera, with soft lights erased out of it,
 * plus additive coloured glows placed in the world. Cheap enough for iPad at 60 FPS.
 */
export class Lighting {
  scene: Phaser.Scene;
  rt!: Phaser.GameObjects.RenderTexture;
  stamp: Phaser.GameObjects.Image;
  lights: (LightDef & { glow: Phaser.GameObjects.Image; on: boolean; cur: number; seed: number })[] = [];
  extra: { x: number; y: number; r: number; a: number }[] = [];
  ambient = 0.62;
  ambientTarget = 0.62;
  blackout = false;
  t = 0;
  private scale = 0.5; // RT resolution relative to logical units

  constructor(scene: Phaser.Scene, defs: LightDef[]) {
    this.scene = scene;
    this.stamp = scene.make.image({ key: 'light', add: false });
    for (const d of defs) {
      const glow = scene.add.image(d.x, d.y, 'light').setTint(d.color).setBlendMode(Phaser.BlendModes.ADD)
        .setScale(d.r / 128 * 0.9).setAlpha(d.a * 0.55).setDepth(5000);
      this.lights.push({ ...d, glow, on: true, cur: d.a, seed: Math.random() * 100 });
    }
    this.makeRT();
  }

  makeRT() {
    const cam = this.scene.cameras.main;
    const w = Math.ceil(cam.width / cam.zoom * this.scale) + 8, h = Math.ceil(cam.height / cam.zoom * this.scale) + 8;
    this.rt?.destroy();
    this.rt = this.scene.add.renderTexture(0, 0, w, h).setOrigin(0).setScale(1 / this.scale).setDepth(9000);
  }

  setBlackout(on: boolean) {
    this.blackout = on;
    this.ambientTarget = on ? 0.94 : 0.62;
    for (const l of this.lights) l.on = !on || !!l.emergency || l.room === 'lift';
  }

  update(dt: number, px: number, py: number, playerRadius: number) {
    this.t += dt;
    this.ambient += (this.ambientTarget - this.ambient) * Math.min(1, dt * 3);
    const cam = this.scene.cameras.main;
    const v = cam.worldView;
    const ox = v.x - 8, oy = v.y - 8;
    this.rt.setPosition(ox, oy);
    this.rt.clear();
    this.rt.fill(0x02030a, this.ambient);
    const s = this.scale;
    const stamp = (x: number, y: number, r: number, a: number) => {
      if (x + r < v.x || x - r > v.right || y + r < v.y || y - r > v.bottom) return;
      this.stamp.setScale(r / 128 * s).setAlpha(a);
      this.rt.erase(this.stamp, (x - ox) * s, (y - oy) * s);
    };
    for (const l of this.lights) {
      let a = l.on ? l.a : 0;
      if (l.on && l.flicker) { const n = Math.sin(this.t * 13 + l.seed) + Math.sin(this.t * 31 + l.seed * 2); if (n > 1.55) a *= 0.25; }
      if (l.on && l.pulse) a *= 0.75 + 0.25 * Math.sin(this.t * l.pulse * 2 + l.seed);
      if (l.emergency) a *= this.blackout ? 0.55 + 0.45 * Math.max(0, Math.sin(this.t * 4 + l.seed)) : 0.35 + 0.25 * Math.max(0, Math.sin(this.t * 3 + l.seed));
      l.cur += (a - l.cur) * Math.min(1, dt * 12);
      l.glow.setAlpha(l.cur * (l.emergency ? 0.9 : 0.55));
      stamp(l.x, l.y, l.r, Math.min(1, l.cur * 1.5));
    }
    // player torch (stronger in blackout)
    stamp(px, py - 30, playerRadius, this.blackout ? 0.95 : 0.6);
    for (const e of this.extra) stamp(e.x, e.y, e.r, e.a);
  }

  resize() { this.makeRT(); }
}
