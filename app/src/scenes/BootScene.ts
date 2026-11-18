import Phaser from 'phaser';
import { BaseScene } from './Base';
import { View } from '../core/view';
import { buildEnvironment, USER_ART } from '../art/env';
import { makeBoneTexture, makeXrayTexture, drawTorsoHolo, DENSITY } from '../art/bones';
import { BONES, BoneId, FRAME } from '../data/anatomy';
import { T, C } from '../ui/widgets';

export const BOT_COLORS = ['red', 'blue', 'yellow', 'violet'] as const;
export const BOT_HEX: Record<string, number> = { red: 0xff3d5a, blue: 0x4fa8ff, yellow: 0xffc23d, violet: 0xb07bff };

export class BootScene extends BaseScene {
  constructor() { super('Boot'); }
  private bar!: Phaser.GameObjects.Graphics;
  private status!: Phaser.GameObjects.Text;

  preload() {
    this.initView();
    document.getElementById('boot')?.remove();
    const { W, H } = View;
    this.add.rectangle(W / 2, H / 2, W, H, 0x04060b);
    T(this, W / 2, H / 2 - 60, 'BODY LAB', 44, '#ff3d5a', { display: true, weight: '900' }).setOrigin(0.5);
    this.status = T(this, W / 2, H / 2 + 46, '시설 시스템 부팅 중…', 18, C.dim).setOrigin(0.5);
    this.bar = this.add.graphics();
    this.load.on('progress', (v: number) => this.drawBar(v * 0.7));
    for (const c of BOT_COLORS) { this.load.image(`hero_${c}`, `assets/atlas/hero_${c}.png`); this.load.image(`full_${c}`, `assets/atlas/full_${c}.png`); }
    this.load.image('holo_body', 'assets/cut/holo_body.png');
    this.load.atlas('env', 'assets/atlas/env.png', 'assets/atlas/env.json');
    this.load.image('title_bg', 'assets/art/title_bg.jpg');
    // Optional hand-made art overrides (see docs/ASSETS.md)
    this.load.json('art_manifest', 'assets/art/manifest.json');
  }

  drawBar(v: number) {
    const { W, H } = View; const w = 420;
    this.bar.clear();
    this.bar.lineStyle(1.5, C.cyan, 0.6); this.bar.strokeRect(W / 2 - w / 2, H / 2, w, 10);
    this.bar.fillStyle(C.cyan, 0.9); this.bar.fillRect(W / 2 - w / 2 + 2, H / 2 + 2, (w - 4) * v, 6);
  }

  async create() {
    const man = this.cache.json.get('art_manifest') as string[] | undefined;
    if (Array.isArray(man) && man.length) {
      for (const k of man) { this.load.image(k, `assets/art/${k}.png`); USER_ART.add(k); }
      await new Promise<void>(r => { this.load.once('complete', () => r()); this.load.start(); });
    }
    this.status.setText('구조 데이터 렌더링…');
    try { await Promise.race([Promise.all([document.fonts.load('700 20px Orbitron'), document.fonts.load('900 20px Orbitron'), document.fonts.load('600 20px Rajdhani'), document.fonts.load('700 20px Rajdhani')]), new Promise(r => setTimeout(r, 2500))]); } catch { /* ignore */ }
    await this.nextFrame();
    buildEnvironment(this); this.drawBar(0.82); await this.nextFrame();
    for (const id of Object.keys(BONES) as BoneId[]) { makeBoneTexture(this, id, 'bone'); makeBoneTexture(this, id, 'holo'); makeBoneTexture(this, id, 'ghost'); }
    this.drawBar(0.94); await this.nextFrame();
    makeXrayTexture(this);
    if (!this.textures.exists('torso_holo')) {
      const cv = document.createElement('canvas'); cv.width = FRAME.w * DENSITY; cv.height = FRAME.h * DENSITY;
      const ctx = cv.getContext('2d')!; ctx.scale(DENSITY, DENSITY); drawTorsoHolo(ctx); this.textures.addCanvas('torso_holo', cv);
    }
    for (const k of this.textures.getTextureKeys()) { const t = this.textures.get(k); t.setFilter(Phaser.Textures.FilterMode.LINEAR); }
    this.drawBar(1);
    this.time.delayedCall(150, () => this.scene.start('Title'));
  }
  nextFrame() { return new Promise<void>(r => requestAnimationFrame(() => r())); }
  layout() { /* boot: ignore */ }
}
