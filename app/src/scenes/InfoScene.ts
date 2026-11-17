import Phaser from 'phaser';
import { BaseScene } from './Base';
import { View, viewEvents } from '../core/view';
import { Audio } from '../core/audio';
import { Save, persist } from '../core/save';
import { ARCHIVE } from '../data/anatomy';
import { T, C, drawPanel, Button, RoundButton } from '../ui/widgets';

/** Modal overlay: settings, multiplayer status, research logs. */
export class InfoScene extends BaseScene {
  constructor() { super('Info'); }
  data2!: { mode: 'settings' | 'multi' | 'log'; id?: string; from: string };

  create(data: { mode: 'settings' | 'multi' | 'log'; id?: string; from: string }) {
    this.data2 = data;
    this.initView();
    const game = data.from === 'Game' ? (this.scene.get('Game') as any) : null;
    if (game) { game.busy = true; if (game.player) game.player.frozen = true; this.scene.sleep('HUD'); }
    const { W, H } = View;
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.7).setInteractive();
    const w = Math.min(data.mode === 'log' ? 820 : 880, W - 40), h = Math.min(data.mode === 'settings' ? 620 : 560, H - 40);
    const x = W / 2 - w / 2, y = H / 2 - h / 2;
    const accent = data.mode === 'log' ? C.green : data.mode === 'multi' ? C.violet : C.cyan;
    const g = this.add.graphics(); drawPanel(g, x, y, w, h, { accent, header: 58 });
    const close = new RoundButton(this, x + w - 36, y + 29, 20, 'close', () => this.close(), accent); close.setActive2(true);
    this.input.keyboard?.on('keydown-ESC', () => this.close());
    if (data.mode === 'settings') this.settings(x, y, w, h);
    else if (data.mode === 'multi') this.multi(x, y, w, h);
    else this.log(x, y, w, h, data.id!);
    this.cameras.main.fadeIn(150, 0, 0, 0);
  }

  close() {
    Audio.play('close');
    if (this.data2.from === 'Game') {
      const game = this.scene.get('Game') as any;
      game.busy = false; if (game.player) game.player.frozen = false;
      this.scene.wake('HUD');
    }
    this.scene.stop();
  }

  layout() { this.scene.restart(this.data2); }

  settings(x: number, y: number, w: number, _h: number) {
    T(this, x + 30, y + 29, '설정', 22, C.white, { weight: '700' }).setOrigin(0, 0.5);
    const rows: [string, 'master' | 'music' | 'sfx'][] = [['전체 음량', 'master'], ['배경 음악', 'music'], ['효과음', 'sfx']];
    rows.forEach(([label, key], i) => {
      const ry = y + 110 + i * 84;
      T(this, x + 40, ry, label, 19, C.white, { weight: '700' }).setOrigin(0, 0.5);
      const sx = x + 240, sw = w - 340;
      const g = this.add.graphics();
      const val = T(this, x + w - 50, ry, '', 18, C.cyanS, { weight: '700' }).setOrigin(1, 0.5);
      const draw = () => {
        const v = Save.settings[key]; g.clear();
        g.fillStyle(0x0a1222, 1); g.fillRoundedRect(sx, ry - 6, sw, 12, 6);
        g.fillStyle(C.cyan, 0.9); g.fillRoundedRect(sx, ry - 6, Math.max(12, sw * v), 12, 6);
        g.fillStyle(0xffffff, 1); g.fillCircle(sx + sw * v, ry, 14); g.lineStyle(3, C.cyan, 1); g.strokeCircle(sx + sw * v, ry, 14);
        val.setText(`${Math.round(v * 100)}%`);
      };
      draw();
      const z = this.add.zone(sx - 20, ry - 30, sw + 40, 60).setOrigin(0).setInteractive({ useHandCursor: true });
      const set = (p: Phaser.Input.Pointer) => { const l = this.lp(p); Save.settings[key] = Phaser.Math.Clamp((l.x - sx) / sw, 0, 1); draw(); Audio.applyVolumes(); };
      z.on('pointerdown', (p: Phaser.Input.Pointer) => { Audio.unlock(); set(p); });
      z.on('pointermove', (p: Phaser.Input.Pointer) => { if (p.isDown) set(p); });
      z.on('pointerup', () => { persist(); Audio.play('beep'); });
    });
    const toggles: [string, string, () => string, () => void][] = [
      ['그래픽 품질', '낮음: 해상도·파티클 축소 (구형 iPad 권장)', () => Save.settings.quality === 'high' ? '높음' : '낮음', () => { Save.settings.quality = Save.settings.quality === 'high' ? 'low' : 'high'; persist(); viewEvents.emit('quality'); }],
      ['목표 안내 화살표', '다음 목표 방향 표시 및 숨은 표본 안내', () => Save.settings.hints ? '켜짐' : '꺼짐', () => { Save.settings.hints = !Save.settings.hints; persist(); }],
    ];
    toggles.forEach(([label, sub, get, fn], i) => {
      const ry = y + 360 + i * 90;
      T(this, x + 40, ry - 10, label, 19, C.white, { weight: '700' }).setOrigin(0, 0.5);
      T(this, x + 40, ry + 16, sub, 14, C.dim).setOrigin(0, 0.5);
      const b = new Button(this, x + w - 140, ry, get(), () => { fn(); b.setText(get()); }, { w: 180, h: 54 });
    });
  }

  multi(x: number, y: number, w: number, h: number) {
    T(this, x + 30, y + 29, '협동 플레이 (MULTIPLAYER)', 22, C.white, { weight: '700' }).setOrigin(0, 0.5);
    T(this, x + 40, y + 96, '현재 상태: 개발 예정 (PHASE 3)', 22, C.violetS, { weight: '700' });
    T(this, x + 40, y + 140,
      '이 데모(PHASE 1)는 솔로 플레이만 지원합니다. 가짜 플레이어나 시뮬레이션으로 협동을 흉내 내지 않고,\nSupabase Realtime(브로드캐스트·프레즌스)으로 다음 기능을 구현할 예정입니다. (설계: docs/MULTIPLAYER.md)', 17, '#c9d6ee', { wordWrap: { width: w - 80 }, lineSpacing: 6 });
    const items = ['방 만들기 · 입장 코드 발급 · 코드로 참가', '플레이어 색상 선택 · 준비 상태 · 호스트 시작', '최대 4인 위치 동기화 · 퍼즐 상태 즉시 공유', '역할 분담 협동 미션 (X-ray 분석 / 뼈 조립 / 관절 검증 / 보안 해제)'];
    items.forEach((s, i) => T(this, x + 56, y + 240 + i * 42, `◆  ${s}`, 18, C.white, { weight: '600' }));
    new Button(this, x + w / 2, y + h - 56, '확인', () => this.close(), { w: 240, h: 56, accent: C.violet, icon: 'check' });
  }

  log(x: number, y: number, w: number, h: number, id: string) {
    const e = ARCHIVE.find(a => a.id === id)!;
    T(this, x + 30, y + 29, `DATA TERMINAL · ${e.title}`, 21, C.white, { weight: '700' }).setOrigin(0, 0.5);
    const g = this.add.graphics(); g.fillStyle(0x03120b, 0.9); g.fillRoundedRect(x + 30, y + 80, w - 60, h - 180, 8); g.lineStyle(1, C.green, 0.4); g.strokeRoundedRect(x + 30, y + 80, w - 60, h - 180, 8);
    const t = T(this, x + 54, y + 104, '', 19, '#9dffcf', { wordWrap: { width: w - 110 }, lineSpacing: 8 });
    let i = 0;
    this.time.addEvent({ delay: 14, repeat: e.body.length - 1, callback: () => { i++; t.setText(e.body.slice(0, i) + (i < e.body.length ? '▌' : '')); if (i % 4 === 0) Audio.play('type'); } });
    T(this, x + 30, y + h - 56, '📖 도감에 기록되었습니다', 15, C.dim).setOrigin(0, 0.5);
    new Button(this, x + w - 140, y + h - 56, '닫기', () => this.close(), { w: 200, h: 56, accent: C.green, icon: 'check' });
  }
}
