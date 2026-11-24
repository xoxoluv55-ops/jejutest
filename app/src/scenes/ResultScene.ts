import Phaser from 'phaser';
import { BaseScene } from './Base';
import { View } from '../core/view';
import { Audio } from '../core/audio';
import { Save, persist } from '../core/save';
import { G, newRun, startWorld } from '../game/state';
import { clearRun } from '../core/save';
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
      Save.clears++; clearRun();   // the chapter is finished: no run to continue
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
    const tiny = H < 640;   // phone landscape (≈450–600 logical): two-column report, smaller title, short buttons
    const b = this.add.image(tiny ? W * 0.11 : W * 0.18, tiny ? H * 0.86 : H * 0.8, `full_${r.color}`).setOrigin(0.5, 1).setScale(tiny ? 0.5 : 0.85);
    this.tweens.add({ targets: b, y: b.y - 18, duration: 500, yoyo: true, repeat: -1, ease: 'Quad.out' });
    this.tweens.add({ targets: b, angle: { from: -6, to: 6 }, duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    const compact = H < 820;   // iPad landscape (≈740 logical) — tighten the vertical rhythm so nothing overlaps the buttons
    const title = T(this, W / 2, tiny ? 30 : compact ? 54 : 80, 'ESCAPE SUCCESS', tiny ? 40 : 64, '#ffffff', { display: true, weight: '900' }).setOrigin(0.5);
    title.setShadow(0, 0, '#3dffa2', 24, true, true);
    const ch2 = r.chapter === 2;
    T(this, W / 2, tiny ? 62 : compact ? 102 : 140, ch2 ? 'CHAPTER 2 · 근육 연결실 탈출 완료' : 'CHAPTER 1 · 뼈대 복구실 탈출 완료', tiny ? 18 : 22, C.greenS, { weight: '700' }).setOrigin(0.5);
    const pw = tiny ? W * 0.76 : Math.min(760, W * 0.58), px = tiny ? W * 0.21 : Math.max(W * 0.36, W / 2 - pw / 2), py = tiny ? 80 : compact ? 128 : 190, ph = H - py - (tiny ? 62 : 96);
    const hd = tiny ? 40 : 52;
    const g = this.add.graphics(); drawPanel(g, px, py, pw, ph, { accent: C.green, header: hd });
    T(this, px + 28, py + hd / 2, '연구 기록 · 결과 보고서', tiny ? 18 : 20, C.white, { weight: '700' }).setOrigin(0, 0.5);
    const acc = (m: number) => Math.max(0, 100 - m * 12);
    const rows: [string, string][] = [
      ['소요 시간', `${fmt(r.elapsed)}${Save.best[String(r.chapter)] === r.elapsed ? '  ★ 최고 기록' : ''}`],
      ['난이도', r.difficulty === 'adv' ? '심화 · 응용' : '기초 · 1학년'],
      ...(ch2 ? [
        ['근육 지도 판독 오답', `${r.stats.atlas}회  (정확도 ${acc(r.stats.atlas)}%)`],
        ['이는곳·닿는곳 연결 오답', `${r.stats.link}회  (정확도 ${acc(r.stats.link)}%)`],
        ['운동 재현 역할 오답', `${r.stats.motion}회  (정확도 ${acc(r.stats.motion)}%)`],
      ] as [string, string][] : [
        ['뼈대 조립 오답', `${r.stats.assembly}회  (정확도 ${acc(r.stats.assembly)}%)`],
        ['관절 정렬 재검증', `${r.stats.align}회  (정확도 ${acc(r.stats.align)}%)`],
        ['X-ray 판독 오답', `${r.stats.xray}회  (정확도 ${acc(r.stats.xray)}%)`],
      ] as [string, string][]),
      ['스캔 사용 / 연구 기록', `${r.scans}회 / ${r.logs.length}개 열람`],
    ];
    const weak: [string, string][] = ch2
      ? [['atlas', '어깨·위팔 표층 근육의 위치'], ['link', '근육의 이는곳과 닿는곳(부착 위치)'], ['motion', '주작용근·대항근과 관절을 지나는 위치']]
      : [['assembly', '팔 뼈대의 위치 관계(노뼈=가쪽, 자뼈=안쪽)'], ['align', '관절면의 방향(몸쪽/먼쪽, 안쪽/가쪽 지표)'], ['xray', '어깨 방사선 영상의 지표 구조']];
    const worst = weak.filter(([k]) => r.stats[k] >= 2).map(([, s]) => s);
    if (tiny) {
      // left column: the numbers; right column: what was learned + what to review
      const colW = pw * 0.5 - 40, rx = px + pw * 0.5 + 10, rw = pw * 0.5 - 34;
      const step = Math.min(36, (ph - hd - 24) / rows.length);
      rows.forEach(([k, v], i) => {
        const y = py + hd + 18 + i * step;
        T(this, px + 24, y, k, 15, C.dim, { weight: '600' }).setOrigin(0, 0.5);
        T(this, px + 24 + colW, y, v, 16, C.white, { weight: '700' }).setOrigin(1, 0.5);
      });
      const lg = this.add.graphics(); lg.lineStyle(1, C.green, 0.3); lg.lineBetween(rx - 14, py + hd + 8, rx - 14, py + ph - 10);
      let y = py + hd + 8;
      y += T(this, rx, y, '학습한 핵심 개념', 16, C.amberS, { weight: '700' }).height + 6;
      for (const id of r.learned) { const e = ARCHIVE.find(a => a.id === id); if (e) y += T(this, rx, y, `◆ ${e.title} — ${e.en}`, 15, '#d3def3', { wordWrap: { width: rw } }).setMaxLines(2).height + 4; }
      if (worst.length) T(this, rx, Math.max(y + 6, py + ph - 52), `복습 추천: ${worst.join(', ')}`, 15, C.redS, { wordWrap: { width: rw } }).setMaxLines(2);
    } else {
      const lineH = 28, weakH = 34;
      const step = Math.max(32, Math.min(44, (ph - 86 - 16 - 34 - r.learned.length * lineH - weakH) / rows.length));
      rows.forEach(([k, v], i) => {
        const y = py + 80 + i * step;
        T(this, px + 34, y, k, 18, C.dim, { weight: '600' }).setOrigin(0, 0.5);
        T(this, px + pw - 34, y, v, 19, C.white, { weight: '700' }).setOrigin(1, 0.5);
      });
      const ly = py + 80 + rows.length * step;
      T(this, px + 34, ly, '학습한 핵심 개념', 17, C.amberS, { weight: '700' });
      r.learned.forEach((id, i) => { const e = ARCHIVE.find(a => a.id === id); if (e) T(this, px + 34, ly + 30 + i * lineH, `◆ ${e.title} — ${e.en}`, 17, '#d3def3', { wordWrap: { width: pw - 68 } }).setMaxLines(1); });
      if (worst.length) T(this, px + 34, py + ph - 22, `복습 추천: ${worst.join(', ')}`, 15, C.redS, { wordWrap: { width: pw - 68 } }).setOrigin(0, 0.5);
    }
    const by = tiny ? H - 30 : H - 56, bh = tiny ? 44 : 58;
    const retry = () => { G.run = newRun(r.difficulty, r.color, r.chapter); this.saved = false; startWorld(this.scene); };
    const toTitle = () => { this.saved = false; this.scene.start('Title'); };
    if (!ch2) {
      const bw = Math.min(220, (W - 80) / 4 - 12), sp = bw + 14;
      new Button(this, W / 2 - sp * 1.5, by, '다시 하기', retry, { w: bw, h: bh, icon: 'retry' });
      new Button(this, W / 2 - sp * 0.5, by, '해부학 도감', () => this.scene.start('Archive', { from: 'Title' }), { w: bw, h: bh, icon: 'book' });
      new Button(this, W / 2 + sp * 0.5, by, '타이틀로', toTitle, { w: bw, h: bh, icon: 'back' });
      new Button(this, W / 2 + sp * 1.5, by, 'CHAPTER 2 ▶', () => { G.run = newRun(r.difficulty, r.color, 2); this.saved = false; startWorld(this.scene); }, { w: bw, h: bh, icon: 'play', accent: C.green, primary: true });
    } else {
      new Button(this, W / 2 - 250, by, '다시 하기', retry, { w: 220, h: bh, icon: 'retry' });
      new Button(this, W / 2, by, '해부학 도감', () => this.scene.start('Archive', { from: 'Title' }), { w: 240, h: bh, icon: 'book' });
      new Button(this, W / 2 + 250, by, '타이틀로', toTitle, { w: 220, h: bh, icon: 'back', accent: C.green, primary: true });
    }
    if (!tiny) T(this, W / 2, H - 14, ch2 ? 'NEXT · CHAPTER 3 신경회로실 — 개발 예정' : '근육 연결실(CHAPTER 2)이 열렸습니다', 13, '#55647f').setOrigin(0.5, 1);
  }
}
