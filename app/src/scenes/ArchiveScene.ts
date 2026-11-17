import Phaser from 'phaser';
import { BaseScene } from './Base';
import { View } from '../core/view';
import { Audio } from '../core/audio';
import { Save } from '../core/save';
import { ARCHIVE, ArchiveEntry } from '../data/anatomy';
import { T, C, drawPanel, Button } from '../ui/widgets';

/** ANATOMY ARCHIVE — bones, concepts and logs unlocked while playing (persisted in localStorage). */
export class ArchiveScene extends BaseScene {
  constructor() { super('Archive'); }
  from = 'Title';
  sel?: string;
  detail!: Phaser.GameObjects.Container;

  create(data: { from: string; sel?: string }) {
    this.from = data.from; this.sel = data.sel;
    this.initView();
    const { W, H } = View;
    this.add.rectangle(W / 2, H / 2, W, H, 0x03050b, this.from === 'Game' ? 0.94 : 1).setInteractive();
    const g = this.add.graphics(); drawPanel(g, 16, 16, W - 32, H - 32, { accent: C.cyan, header: 64 });
    T(this, 46, 48, 'ANATOMY ARCHIVE', 26, C.white, { display: true, weight: '900' }).setOrigin(0, 0.5);
    T(this, 46 + 380, 48, `해부학 도감 · ${Save.archive.length}/${ARCHIVE.length} 해금`, 18, C.cyanS, { weight: '700' }).setOrigin(0, 0.5);
    new Button(this, W - 150, 48, '돌아가기', () => this.back(), { w: 200, h: 50, icon: 'back' });
    this.input.keyboard?.on('keydown-ESC', () => this.back());
    const listW = Math.min(420, W * 0.36);
    const cats: ArchiveEntry['cat'][] = ['뼈', '개념', '기록'];
    let y = 100;
    for (const cat of cats) {
      T(this, 46, y, cat === '뼈' ? '골격 표본' : cat === '개념' ? '핵심 개념' : '시설 기록', 16, C.amberS, { weight: '700' });
      y += 28;
      for (const e of ARCHIVE.filter(a => a.cat === cat)) {
        const open = Save.archive.includes(e.id);
        const bg = this.add.graphics();
        const on = this.sel === e.id;
        bg.fillStyle(on ? C.cyan : 0x0a1222, on ? 0.2 : 0.85); bg.fillRoundedRect(40, y, listW, 44, 8);
        bg.lineStyle(1, on ? C.cyan : C.line, 1); bg.strokeRoundedRect(40, y, listW, 44, 8);
        T(this, 58, y + 22, open ? e.title : '??? (미발견)', 17, open ? C.white : '#4d5a75', { weight: '700' }).setOrigin(0, 0.5);
        if (open) T(this, 40 + listW - 14, y + 22, e.en, 13, C.dim).setOrigin(1, 0.5);
        if (open) { const z = this.add.zone(40, y, listW, 44).setOrigin(0).setInteractive({ useHandCursor: true }); z.on('pointerup', () => { Audio.play('click'); this.scene.restart({ from: this.from, sel: e.id }); }); }
        y += 50;
      }
      y += 10;
    }
    const dx = 40 + listW + 30, dw = W - dx - 50;
    const e = ARCHIVE.find(a => a.id === this.sel && Save.archive.includes(a.id));
    if (!e) {
      T(this, dx + dw / 2, H / 2, Save.archive.length ? '왼쪽 목록에서 항목을 선택하세요.' : '아직 해금된 항목이 없습니다.\nBODY LAB을 탐험하며 표본과 기록을 수집하세요.', 20, C.dim, { align: 'center' }).setOrigin(0.5);
      return;
    }
    T(this, dx, 110, e.title, 34, C.white, { weight: '700' });
    T(this, dx, 158, e.en, 18, C.amberS, { display: true });
    let ty = 210;
    if (e.bone) {
      const im = this.add.image(dx + 130, 0, `bone_bone_${e.bone}`);
      const s = Math.min(240 / im.width, (H - 300) / im.height); im.setScale(s); im.setY(ty + im.displayHeight / 2);
      const holo = this.add.image(im.x, im.y, `bone_holo_${e.bone}`).setScale(s).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.3);
      this.tweens.add({ targets: holo, alpha: 0.05, duration: 1200, yoyo: true, repeat: -1 });
      T(this, dx + 290, ty, e.body, 18, '#d3def3', { wordWrap: { width: dw - 300 }, lineSpacing: 8 });
    } else {
      T(this, dx, ty, e.body, 19, '#d3def3', { wordWrap: { width: dw }, lineSpacing: 9 });
    }
  }

  back() {
    Audio.play('close');
    if (this.from === 'Game') {
      const game = this.scene.get('Game') as any; game.busy = false;
      this.scene.resume('Game'); this.scene.wake('HUD'); this.scene.stop();
    } else this.scene.start('Title');
  }
}
