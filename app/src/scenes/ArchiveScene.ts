import Phaser from 'phaser';
import { BaseScene } from './Base';
import { worldKey } from '../game/state';
import { View } from '../core/view';
import { Audio } from '../core/audio';
import { Save } from '../core/save';
import { ARCHIVE, ArchiveEntry } from '../data/anatomy';
import { T, C, drawPanel, Button } from '../ui/widgets';
import { makeMuscleTexture } from '../art/muscles';

/** ANATOMY ARCHIVE — bones, concepts and logs unlocked while playing (persisted in localStorage). */
export class ArchiveScene extends BaseScene {
  constructor() { super('Archive'); }
  from = 'Title';
  sel?: string;
  cat: ArchiveEntry['cat'] = '뼈';
  detail!: Phaser.GameObjects.Container;

  create(data: { from: string; sel?: string; cat?: ArchiveEntry['cat'] }) {
    this.from = data.from; this.sel = data.sel;
    this.cat = data.cat ?? (ARCHIVE.find(a => a.id === data.sel)?.cat ?? '뼈');
    this.initView();
    const { W, H } = View;
    this.add.rectangle(W / 2, H / 2, W, H, 0x03050b, this.from === 'Game' ? 0.94 : 1).setInteractive();
    const tn = H < 640;   // phone landscape: thinner header/tabs, list rows sized to the height
    const m = tn ? 6 : 16, hd = tn ? 48 : 64, hy = m + hd / 2;
    const g = this.add.graphics(); drawPanel(g, m, m, W - m * 2, H - m * 2, { accent: C.cyan, header: hd });
    const at = T(this, m + 30, hy, 'ANATOMY ARCHIVE', tn ? 21 : 26, C.white, { display: true, weight: '900' }).setOrigin(0, 0.5);
    T(this, at.x + at.width + 24, hy, `해부학 도감 · ${Save.archive.length}/${ARCHIVE.length} 해금`, tn ? 16 : 18, C.cyanS, { weight: '700' }).setOrigin(0, 0.5);
    new Button(this, W - (tn ? 120 : 150), hy, '돌아가기', () => this.back(), { w: tn ? 170 : 200, h: tn ? 40 : 50, icon: 'back' });
    const tabY = tn ? m + hd + 8 : 92, tabH = tn ? 40 : 46;
    this.input.keyboard?.on('keydown-ESC', () => this.back());
    const listW = Math.min(420, W * 0.36);
    const cats: ArchiveEntry['cat'][] = ['뼈', '근육', '신경', '개념', '기록'];
    const tw = (listW - 24) / 5;
    cats.forEach((cat, i) => {
      const x = 40 + i * (tw + 6), on = cat === this.cat;
      const n = ARCHIVE.filter(a => a.cat === cat && Save.archive.includes(a.id)).length, tot = ARCHIVE.filter(a => a.cat === cat).length;
      const bg = this.add.graphics(); bg.fillStyle(on ? C.amber : 0x0a1222, on ? 0.25 : 0.9); bg.fillRoundedRect(x, tabY, tw, tabH, 8);
      bg.lineStyle(1.2, on ? C.amber : C.line, 1); bg.strokeRoundedRect(x, tabY, tw, tabH, 8);
      T(this, x + tw / 2, tabY + (tn ? 12 : 14), cat, 16, on ? C.amberS : C.white, { weight: '700' }).setOrigin(0.5);
      T(this, x + tw / 2, tabY + tabH - (tn ? 9 : 11), `${n}/${tot}`, 12, C.dim, { fine: true }).setOrigin(0.5);
      const z = this.add.zone(x, tabY, tw, tabH).setOrigin(0).setInteractive({ useHandCursor: true });
      z.on('pointerup', () => { Audio.play('click'); this.scene.restart({ from: this.from, cat }); });
    });
    let y = tabY + tabH + (tn ? 8 : 18);
    const items = ARCHIVE.filter(a => a.cat === this.cat);
    const ih = Math.max(26, Math.min(44, Math.floor((H - (tn ? 16 : 40) - y) / items.length) - (tn ? 4 : 6)));
    for (const e of items) {
      const open = Save.archive.includes(e.id);
      const bg = this.add.graphics();
      const on = this.sel === e.id;
      bg.fillStyle(on ? C.cyan : 0x0a1222, on ? 0.2 : 0.85); bg.fillRoundedRect(40, y, listW, ih, 8);
      bg.lineStyle(1, on ? C.cyan : C.line, 1); bg.strokeRoundedRect(40, y, listW, ih, 8);
      T(this, 58, y + ih / 2, open ? e.title : '??? (미발견)', 17, open ? C.white : '#4d5a75', { weight: '700' }).setOrigin(0, 0.5);
      if (open) T(this, 40 + listW - 14, y + ih / 2, e.en, 13, C.dim).setOrigin(1, 0.5);
      if (open) { const z = this.add.zone(40, y, listW, ih).setOrigin(0).setInteractive({ useHandCursor: true }); z.on('pointerup', () => { Audio.play('click'); this.scene.restart({ from: this.from, sel: e.id, cat: this.cat }); }); }
      y += ih + (tn ? 4 : 6);
    }
    const dx = 40 + listW + 30, dw = W - dx - 50;
    const e = ARCHIVE.find(a => a.id === this.sel && Save.archive.includes(a.id));
    if (!e) {
      T(this, dx + dw / 2, H / 2, Save.archive.length ? '왼쪽 목록에서 항목을 선택하세요.' : '아직 해금된 항목이 없습니다.\nBODY LAB을 탐험하며 표본과 기록을 수집하세요.', 20, C.dim, { align: 'center' }).setOrigin(0.5);
      return;
    }
    const t0 = tn ? m + hd + 10 : 110;
    T(this, dx, t0, e.title, tn ? 26 : 34, C.white, { weight: '700' });
    T(this, dx, t0 + (tn ? 34 : 48), e.en, tn ? 16 : 18, C.amberS, { display: true });
    let ty = t0 + (tn ? 64 : 100);
    // long entries on a short screen: shrink the body text until it fits above the bottom edge
    const fitBody = (t: Phaser.GameObjects.Text) => { for (const sz of [18, 17, 16, 15]) { if (t.y + t.height <= H - m - 12) break; t.setFontSize(sz).setLineSpacing(4); } return t; };
    if (e.bone) {
      const im = this.add.image(dx + 130, 0, `bone_bone_${e.bone}`);
      const s = Math.min(240 / im.width, (H - ty - (tn ? 30 : 90)) / im.height); im.setScale(s); im.setY(ty + im.displayHeight / 2);
      const holo = this.add.image(im.x, im.y, `bone_holo_${e.bone}`).setScale(s).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.3);
      this.tweens.add({ targets: holo, alpha: 0.05, duration: 1200, yoyo: true, repeat: -1 });
      fitBody(T(this, dx + 290, ty, e.body, 18, '#d3def3', { wordWrap: { width: dw - 300 }, lineSpacing: 8 }));
    } else if (e.muscle) {
      const mt = makeMuscleTexture(this, e.muscle, 'real');
      const im = this.add.image(dx + 130, 0, mt.key);
      const s = Math.min(240 / im.width, (H - ty - (tn ? 50 : 90)) / im.height, 1); im.setScale(s); im.setY(ty + im.displayHeight / 2);
      T(this, dx + 130, im.y + im.displayHeight / 2 + 14, mt.credit, 12, '#a8949e', { align: 'center', wordWrap: { width: 250 }, fine: true }).setOrigin(0.5, 0);
      fitBody(T(this, dx + 290, ty, e.body, 18, '#d3def3', { wordWrap: { width: dw - 300 }, lineSpacing: 8 }));
    } else if (e.tex && this.textures.exists(e.tex)) {
      const im = this.add.image(dx + 130, 0, e.tex);
      const s = Math.min(200 / im.width, 200 / im.height, 2.2); im.setScale(s); im.setY(ty + 20 + im.displayHeight / 2);
      T(this, dx + 130, im.y + im.displayHeight / 2 + 14, '3D 해부 모델: BodyParts3D © DBCLS (CC BY 4.0)', 12, '#8f9bb3', { align: 'center', wordWrap: { width: 250 }, fine: true }).setOrigin(0.5, 0);
      fitBody(T(this, dx + 290, ty, e.body, 18, '#d3def3', { wordWrap: { width: dw - 300 }, lineSpacing: 8 }));
    } else {
      fitBody(T(this, dx, ty, e.body, 19, '#d3def3', { wordWrap: { width: dw }, lineSpacing: 9 }));
    }
  }

  back() {
    Audio.play('close');
    if (this.from === 'Game') {
      const game = this.scene.get(worldKey()) as any; game.busy = false;
      this.scene.resume(worldKey()); this.scene.wake('HUD'); this.scene.stop();
    } else this.scene.start('Title');
  }
}
