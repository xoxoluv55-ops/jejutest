import Phaser from 'phaser';
import { BaseScene } from './Base';
import { View } from '../core/view';
import { Audio } from '../core/audio';
import { Save, persist } from '../core/save';
import { G, newRun, startWorld } from '../game/state';
import { ARCHIVE } from '../data/anatomy';
import { T, C, drawPanel, Button } from '../ui/widgets';
import { fmt } from './TitleScene';

export class ResultScene extends BaseScene {
  constructor() { super('Result'); }
  private saved = false;
  create() {
    this.initView();
    const r = G.run;
    if (!this.saved) {
      this.saved = true;
      Save.clears++;
      if (!Save.cleared.includes(r.chapter)) Save.cleared.push(r.chapter);
      const key = String(r.chapter);
      if (!Save.best[key] || r.elapsed < Save.best[key]) Save.best[key] = r.elapsed;
      if (r.chapter === 1 && (!Save.bestTime || r.elapsed < Save.bestTime)) Save.bestTime = r.elapsed;
      persist();
    }
    Audio.setMusic('title');
    const { W, H } = View;
    this.cameras.main.fadeIn(900, 255, 255, 255);
    this.add.rectangle(W / 2, H / 2, W, H, 0x03060c);
    this.add.image(W / 2, H * 0.3, 'light').setScale(6, 3).setTint(0x3dffa2).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.18);
    this.add.particles(0, 0, 'dot', { x: { min: 0, max: W }, y: H + 10, lifespan: 6000, speedY: { min: -120, max: -40 }, scale: { min: 0.05, max: 0.2 }, alpha: { start: 0.8, end: 0 }, tint: [0x3dffa2, 0x4fd8ff, 0xffffff], blendMode: 'ADD', frequency: 60 });
    const b = this.add.image(W * 0.18, H * 0.8, `full_${r.color}`).setOrigin(0.5, 1).setScale(0.85);
    this.tweens.add({ targets: b, y: b.y - 18, duration: 500, yoyo: true, repeat: -1, ease: 'Quad.out' });
    this.tweens.add({ targets: b, angle: { from: -6, to: 6 }, duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    const title = T(this, W / 2, 80, 'ESCAPE SUCCESS', 64, '#ffffff', { display: true, weight: '900' }).setOrigin(0.5);
    title.setShadow(0, 0, '#3dffa2', 24, true, true);
    const ch2 = r.chapter === 2;
    T(this, W / 2, 140, ch2 ? 'CHAPTER 2 · 근육 연결실 탈출 완료' : 'CHAPTER 1 · 골격 복구실 탈출 완료', 22, C.greenS, { weight: '700' }).setOrigin(0.5);
    const pw = Math.min(760, W * 0.58), px = Math.max(W * 0.36, W / 2 - pw / 2), py = 190, ph = H - 300;
    const g = this.add.graphics(); drawPanel(g, px, py, pw, ph, { accent: C.green, header: 52 });
    T(this, px + 28, py + 26, '연구 기록 · 결과 보고서', 20, C.white, { weight: '700' }).setOrigin(0, 0.5);
    const acc = (m: number) => Math.max(0, 100 - m * 12);
    const rows: [string, string][] = [
      ['소요 시간', `${fmt(r.elapsed)}${Save.best[String(r.chapter)] === r.elapsed ? '  ★ 최고 기록' : ''}`],
      ['난이도', r.difficulty === 'adv' ? '심화 · 응용' : '기초 · 1학년'],
      ...(ch2 ? [
        ['근육 지도 판독 오답', `${r.stats.atlas}회  (정확도 ${acc(r.stats.atlas)}%)`],
        ['기시·정지 연결 오답', `${r.stats.link}회  (정확도 ${acc(r.stats.link)}%)`],
        ['운동 재현 역할 오답', `${r.stats.motion}회  (정확도 ${acc(r.stats.motion)}%)`],
      ] as [string, string][] : [
        ['골격 조립 오답', `${r.stats.assembly}회  (정확도 ${acc(r.stats.assembly)}%)`],
        ['관절 정렬 재검증', `${r.stats.align}회  (정확도 ${acc(r.stats.align)}%)`],
        ['X-ray 판독 오답', `${r.stats.xray}회  (정확도 ${acc(r.stats.xray)}%)`],
      ] as [string, string][]),
      ['스캔 사용 / 연구 기록', `${r.scans}회 / ${r.logs.length}개 열람`],
    ];
    rows.forEach(([k, v], i) => {
      const y = py + 86 + i * 44;
      T(this, px + 34, y, k, 18, C.dim, { weight: '600' }).setOrigin(0, 0.5);
      T(this, px + pw - 34, y, v, 19, C.white, { weight: '700' }).setOrigin(1, 0.5);
    });
    const ly = py + 86 + rows.length * 44 + 16;
    T(this, px + 34, ly, '학습한 핵심 개념', 17, C.amberS, { weight: '700' });
    r.learned.forEach((id, i) => { const e = ARCHIVE.find(a => a.id === id); if (e) T(this, px + 34, ly + 34 + i * 30, `◆ ${e.title} — ${e.en}`, 17, '#d3def3'); });
    const weak: [string, string][] = ch2
      ? [['atlas', '어깨·위팔 표층 근육의 위치'], ['link', '근육의 기시와 정지(부착 위치)'], ['motion', '주동근·길항근과 관절을 지나는 위치']]
      : [['assembly', '상지 골격의 위치 관계(요골=외측, 척골=내측)'], ['align', '관절면의 방향(근위/원위, 내측/외측 지표)'], ['xray', '어깨 방사선 영상의 지표 구조']];
    const worst = weak.filter(([k]) => r.stats[k] >= 2).map(([, s]) => s);
    if (worst.length) T(this, px + 34, py + ph - 40, `복습 추천: ${worst.join(', ')}`, 15, C.redS, { wordWrap: { width: pw - 68 } }).setOrigin(0, 0.5);
    const by = H - 56;
    const retry = () => { G.run = newRun(r.difficulty, r.color, r.chapter); this.saved = false; startWorld(this.scene); };
    const toTitle = () => { this.saved = false; this.scene.start('Title'); };
    if (!ch2) {
      const bw = Math.min(220, (W - 80) / 4 - 12), sp = bw + 14;
      new Button(this, W / 2 - sp * 1.5, by, '다시 하기', retry, { w: bw, h: 58, icon: 'retry' });
      new Button(this, W / 2 - sp * 0.5, by, '해부학 도감', () => this.scene.start('Archive', { from: 'Title' }), { w: bw, h: 58, icon: 'book' });
      new Button(this, W / 2 + sp * 0.5, by, '타이틀로', toTitle, { w: bw, h: 58, icon: 'back' });
      new Button(this, W / 2 + sp * 1.5, by, 'CHAPTER 2 ▶', () => { G.run = newRun(r.difficulty, r.color, 2); this.saved = false; startWorld(this.scene); }, { w: bw, h: 58, icon: 'play', accent: C.green, primary: true });
    } else {
      new Button(this, W / 2 - 250, by, '다시 하기', retry, { w: 220, h: 58, icon: 'retry' });
      new Button(this, W / 2, by, '해부학 도감', () => this.scene.start('Archive', { from: 'Title' }), { w: 240, h: 58, icon: 'book' });
      new Button(this, W / 2 + 250, by, '타이틀로', toTitle, { w: 220, h: 58, icon: 'back', accent: C.green, primary: true });
    }
    T(this, W / 2, H - 14, ch2 ? 'NEXT · CHAPTER 3 신경회로실 — 개발 예정' : '근육 연결실(CHAPTER 2)이 열렸습니다', 13, '#55647f').setOrigin(0.5, 1);
  }
}
