import { makeStealthArt } from '../art/stealth';
import { makeOfficeArt } from '../art/office';
import { makeEscapeArt } from '../art/escape';
import { setPaintFilter } from '../art/env';
import Phaser from 'phaser';
import { BaseScene } from './Base';
import { View } from '../core/view';
import { buildEnvironment, USER_ART } from '../art/env';
import { makeBoneTexture, makePrimBoneTexture, makeBoneLine, setBoneModel, makeXrayTexture, drawTorsoHolo, DENSITY } from '../art/bones';
import { BONES, BoneId, FRAME } from '../data/anatomy';
import { T, C } from '../ui/widgets';
import { preloadMuscleArt } from '../art/muscles';

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
    // CH1 bones rendered from the BodyParts3D model (v0.7)
    this.load.json('ch1_bones', 'assets/ch1/bones.json');
    for (const id of ['clavicle', 'scapula', 'humerus', 'radius', 'ulna', 'fibula']) this.load.image(`ch1m_${id}`, `assets/ch1/bone_${id}.webp`);
    this.load.image('ch1_ctx', 'assets/ch1/ctx.webp');
    this.load.image('ch1_xray', 'assets/ch1/xray.webp');
    for (const c of ['gmax', 'gmed', 'iliopsoas', 'rf', 'sartorius', 'gracilis', 'bf', 'st']) this.load.image(`ch4_core_${c}`, `assets/ch4/core_${c}.webp`);   // CH4 archive + inventory
    for (const c of ['scaphoid', 'lunate', 'triquetrum', 'pisiform', 'trapezium', 'trapezoid', 'capitate', 'hamate']) this.load.image(`ch3_car_${c}`, `assets/ch3/car_${c}.webp`);   // CH3 archive + inventory   // simulated radiograph (tools/anatomy3d/xray_render.py)
    this.load.atlas('env', 'assets/atlas/env.png', 'assets/atlas/env.json');
    this.load.image('title_bg', 'assets/art/title_bg.jpg');
    preloadMuscleArt(this.load);   // CH2 anatomy plates rendered from the BodyParts3D model
    // Optional hand-made art overrides (see docs/ASSETS.md)
    this.load.json('art_manifest', 'assets/art/manifest.json');
    this.load.json('ch2_props', 'assets/ch2/props/manifest.json');   // dedicated CH2 prop art (optional, see docs/ASSETS.md)
  }

  drawBar(v: number) {
    const { W, H } = View; const w = 420;
    this.bar.clear();
    this.bar.lineStyle(1.5, C.cyan, 0.6); this.bar.strokeRect(W / 2 - w / 2, H / 2, w, 10);
    this.bar.fillStyle(C.cyan, 0.9); this.bar.fillRect(W / 2 - w / 2 + 2, H / 2 + 2, (w - 4) * v, 6);
  }

  async create() {
    const man = this.cache.json.get('art_manifest') as string[] | undefined;
    const p2 = this.cache.json.get('ch2_props') as string[] | undefined;
    if (Array.isArray(p2)) for (const k of p2) this.load.image(`ch2p_${k}`, `assets/ch2/props/${k}.png`);
    if ((Array.isArray(man) && man.length) || (Array.isArray(p2) && p2.length)) {
      for (const k of man ?? []) { this.load.image(k, `assets/art/${k}.png`); USER_ART.add(k); }
      await new Promise<void>(r => { this.load.once('complete', () => r()); this.load.start(); });
    }
    this.status.setText('구조 데이터 렌더링…');
    try { await Promise.race([Promise.all([document.fonts.load('700 20px Orbitron'), document.fonts.load('900 20px Orbitron'), document.fonts.load('600 20px Rajdhani'), document.fonts.load('700 20px Rajdhani')]), new Promise(r => setTimeout(r, 2500))]); } catch { /* ignore */ }
    await this.nextFrame();
    buildEnvironment(this); makeStealthArt(this); setPaintFilter(k => !k.startsWith('inv_')); makeOfficeArt(this); makeEscapeArt(this); setPaintFilter(null); this.drawBar(0.82); await this.nextFrame();
    setBoneModel(this.cache.json.get('ch1_bones') ?? null);
    for (const id of Object.keys(BONES) as BoneId[]) { makeBoneTexture(this, id, 'bone'); makeBoneTexture(this, id, 'holo'); makeBoneTexture(this, id, 'ghost'); makeBoneLine(this, id); makePrimBoneTexture(this, id, 'bone'); }
    if (this.textures.exists('ch1_ctx') && !this.textures.exists('ctx_holo')) {
      // model rib cage / sternum / hand as a cyan hologram backdrop (assembly + joint alignment)
      const img = this.textures.get('ch1_ctx').getSourceImage() as HTMLImageElement;
      const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;   // ctx.webp: full frame at density 2
      const c = cv.getContext('2d')!; c.drawImage(img, 0, 0, cv.width, cv.height);
      c.globalCompositeOperation = 'source-atop'; c.fillStyle = 'rgba(60,180,255,0.78)'; c.fillRect(0, 0, cv.width, cv.height);
      c.globalCompositeOperation = 'destination-in'; c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(0, 0, cv.width, cv.height);
      this.textures.addCanvas('ctx_holo', cv);
    }
    this.drawBar(0.94); await this.nextFrame();
    makeXrayTexture(this);
    if (!this.textures.exists('torso_holo')) {
      const cv = document.createElement('canvas'); cv.width = FRAME.w * DENSITY; cv.height = FRAME.h * DENSITY;
      const ctx = cv.getContext('2d')!; ctx.scale(DENSITY, DENSITY); drawTorsoHolo(ctx); this.textures.addCanvas('torso_holo', cv);
    }
    for (const k of this.textures.getTextureKeys()) { const t = this.textures.get(k); t.setFilter(Phaser.Textures.FilterMode.LINEAR); }
    this.drawBar(1);
    // start the title only if nothing else is running yet (a chapter started early must not get the title running behind it)
    this.time.delayedCall(150, () => { if (this.scene.manager.getScenes(true).some(s => s.scene.key !== 'Boot')) this.scene.stop(); else this.scene.start('Title'); });
  }
  nextFrame() { return new Promise<void>(r => requestAnimationFrame(() => r())); }
  layout() { /* boot: ignore */ }
}
