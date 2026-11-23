import Phaser from 'phaser';
import { InvestBase } from './InvestBase';
import { Audio } from '../../core/audio';
import { G } from '../../game/state';
import { T, C } from '../../ui/widgets';
import { bonePoint } from '../../art/bones';
import { ulnaRoute, ULNA_KO, ULNA_DESC, ULNA_POSTS, UlnaPost } from '../../data/escape';

/**
 * S-05 ulna (L-06 laser corridor): the specimen sits in a locked cage whose power is cut.
 *  toolbox (J-03): lift the lid, take the spare fuse, lift the tool tray -> the wiring manual underneath
 *  cage panel (L-06): seat the fuse, run the jumper wire from POWER through four terminals mounted on the real ulna
 *         model (olecranon, coronoid process, shaft, styloid process) in the manual's order, then raise the breaker.
 */
export class InvUlnaScene extends InvestBase {
  constructor() { super('InvUlna'); }
  clueIds = ['manual', 'fuse'];

  build(kind: string) { if (kind === 'toolbox') this.buildToolbox(); else this.buildPanel(); }

  // ------------------------------------------------------------------ toolbox
  buildToolbox() {
    this.frame('J-03 공구함 조사', '뚜껑을 열고 안을 살펴보세요. 칸막이 트레이는 들어 올릴 수 있습니다.', C.red);
    const { cTop, cBot } = this;
    const k = Math.min((this.pw * 0.66) / 760, (cBot - cTop) / 420);
    const bx = this.px + 30 + (this.pw * 0.66 - 760 * k) / 2, by = cTop + (cBot - cTop - 420 * k) / 2;
    const P = (x: number, y: number) => ({ x: bx + x * k, y: by + y * k });
    this.add.image(bx, by, 'inv_toolbox_in').setOrigin(0).setScale(k * 0.5);
    // bottom: the manual (hidden under the tray)
    const mp = P(330, 148);
    const manual = this.add.image(mp.x, mp.y, 'inv_manual').setScale(k * 0.5 * 0.62).setAngle(3).setInteractive({ useHandCursor: true });
    manual.on('pointerup', () => this.openManual());
    // tray with the fuse
    const tray = this.add.container(0, 0);
    const tp = P(24, 46);
    tray.add(this.add.image(tp.x, tp.y, 'inv_tray').setOrigin(0).setScale(k * 0.5 * 1.0));
    let fuse: Phaser.GameObjects.Image | undefined;
    if (!this.has('fuse')) {
      const fp = P(520, 150);
      fuse = this.add.image(fp.x, fp.y, 'inv_fuse').setScale(k * 0.5 * 1.3).setInteractive({ useHandCursor: true }); tray.add(fuse);
      fuse.once('pointerup', () => {
        Audio.play('pickup');
        this.tweens.add({ targets: fuse, y: fuse!.y - 90, alpha: 0, duration: 400 });
        this.addClue('fuse', '예비 퓨즈 — 케이지 제어반 소켓용');
      });
    }
    let trayUp = false;
    const trayZ = this.add.zone(tp.x, tp.y, 690 * k, 200 * k).setOrigin(0).setInteractive({ useHandCursor: true, draggable: true });
    const liftTray = () => {
      if (trayUp) return; trayUp = true; Audio.play('open');
      trayZ.disableInteractive();
      this.tweens.add({ targets: tray, y: -150 * k, x: 40 * k, alpha: 0.25, duration: 520, ease: 'Cubic.out' });
      this.setFeedback('트레이 아래에 접힌 설명서가 있다! 눌러서 읽어 보세요.', 'ok');
    };
    this.dragDelta(trayZ, (_dx, dy) => { if (dy < -40) liftTray(); });
    trayZ.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (p.getDistance() > 8) return;
      if (fuse?.active && fuse.alpha > 0.5 && fuse.getBounds().contains(p.worldX, p.worldY)) { fuse.emit('pointerup'); return; }
      const lx = (p.worldX - tp.x) / (690 * k);
      if (lx > 0.88) liftTray(); else this.setFeedback('공구가 든 칸막이 트레이. 오른쪽 손잡이를 잡고 위로 들어 올릴 수 있을 것 같다.', 'info');
    });
    // lid (closed) on top
    const lid = this.add.image(bx, by, 'inv_toolbox').setOrigin(0).setScale(k * 0.5).setInteractive({ useHandCursor: true, draggable: true });
    const openLid = () => {
      lid.disableInteractive(); Audio.play('door');
      this.tweens.add({ targets: lid, y: by - 380 * k, alpha: 0, duration: 520, ease: 'Cubic.in', onComplete: () => lid.destroy() });
      this.setFeedback('공구함이 열렸다. 공구 트레이에 퓨즈가 하나 끼워져 있다.', 'info');
      this.flushInput();
    };
    this.dragDelta(lid, (_dx, dy) => { if (dy < -40) openLid(); });
    lid.on('pointerup', (p: Phaser.Input.Pointer) => { if (p.getDistance() < 8) openLid(); });
    this.glint(lid);
    // right column
    const rx = this.px + 30 + this.pw * 0.66 + 20, rw = this.px + this.pw - 30 - rx;
    T(this, rx, cTop + 10, '공구함', 19, C.redS, { weight: '700' });
    T(this, rx, cTop + 42, '관절 보정실 구석의 빨간 공구함. 연구원들이 장비를 고칠 때 쓰던 것이다.', 16, '#d3def3', { wordWrap: { width: rw }, lineSpacing: 6 });
    this.setFeedback('뚜껑을 눌러 열거나 위로 끌어 올리세요.', 'info');
  }

  openManual() {
    Audio.play('open');
    const o = this.overlay('L-06 표본 케이지 · 전원 복구 절차', 820, this.adv ? 400 : 500, C.cyan);
    const r = ulnaRoute();
    const x = o.x + 34, w = o.w - 68;
    let y = o.y + 70;
    const add = (s: string, size = 18, col = '#d3def3', bold = '600') => { const t = T(this, x, y, s, size, col, { weight: bold, wordWrap: { width: w }, lineSpacing: 5 }); o.c.add(t); y += t.height + 12; return t; };
    add('보관 케이지 S-05 (자뼈)는 정전 시 자동으로 잠긴다. 다시 열려면:', 17, '#9fb3d1');
    add('① 제어반의 빈 소켓에 예비 퓨즈를 꽂는다.', 19, '#ffffff', '700');
    add('② 점퍼선을 아래 순서로 단자에 연결한다. 단자는 자뼈 표본 모형 위에 있다.', 19, '#ffffff', '700');
    add('전원 → ' + r.map(p => ULNA_KO[p]).join(' → ') + ' → 잠금장치', 21, C.amberS, '900');
    if (!this.adv) add(r.map(p => `· ${ULNA_KO[p]}: ${ULNA_DESC[p]}`).join('\n'), 16, '#c3d3ee');
    add('③ 차단기 레버를 올린다.', 19, '#ffffff', '700');
    this.addClue('manual', '케이지 전원 복구 절차 — 점퍼선 순서');
  }

  // ------------------------------------------------------------------ cage panel
  buildPanel() {
    this.frame('L-06 표본 케이지 · 제어반', '퓨즈를 꽂고, 점퍼선을 순서대로 연결한 뒤 차단기를 올리세요.', C.red);
    if (G.run.flags.ulnaCage) { this.setFeedback('케이지 전원은 이미 복구되었습니다.', 'info'); return; }
    const { cTop, cBot } = this;
    const ch = cBot - cTop;
    const g = this.add.graphics();
    const bx = this.px + 30, bw = this.pw - 60;
    g.fillStyle(0x1b2230, 1); g.fillRoundedRect(bx, cTop, bw, ch, 14); g.lineStyle(3, 0x3a4352, 1); g.strokeRoundedRect(bx, cTop, bw, ch, 14);
    // ---- schematic plate: the real ulna model with four terminals at its landmarks ----
    const plateW = Math.min(bw * 0.34, ch * 0.55), plateX = bx + bw * 0.36 - plateW / 2;
    g.fillStyle(0x0b1420, 1); g.fillRoundedRect(plateX, cTop + 14, plateW, ch - 28, 10); g.lineStyle(2, 0x4fd8ff, 0.4); g.strokeRoundedRect(plateX, cTop + 14, plateW, ch - 28, 10);
    const ul = this.add.image(plateX + plateW / 2, cTop + ch / 2, 'bone_bone_ulna');
    const us = Math.min((plateW - 30) / ul.width, (ch - 60) / ul.height); ul.setScale(us);
    T(this, plateX + 10, cTop + 22, 'S-05 · ULNA (R) · 앞면', 13, '#7fdcff', { fine: true, weight: '700' });
    const UP = (name: UlnaPost) => { const p = bonePoint('ulna', name) ?? [ul.width / 2, ul.height / 2]; return { x: ul.x + (p[0] - ul.width / 2) * us, y: ul.y + (p[1] - ul.height / 2) * us }; };
    // terminals sit just beside the landmark (a short leg points at the structure) so neighbouring posts don't overlap
    const OFF: Record<UlnaPost, [number, number]> = { olecranon: [34, -4], coronoid: [40, 22], shaft: [36, 0], styloid: [38, 6] };
    const posts: Record<string, { x: number; y: number }> = {};
    const pg = this.add.graphics().setDepth(4);
    for (const id of ULNA_POSTS) {
      const lm = UP(id), p = { x: lm.x + OFF[id][0], y: lm.y + OFF[id][1] };
      posts[id] = p;
      pg.lineStyle(3, 0xc9a64b, 1); pg.lineBetween(lm.x, lm.y, p.x, p.y); pg.fillStyle(0xc9a64b, 1); pg.fillCircle(lm.x, lm.y, 4);
      pg.fillStyle(0x2a2f38, 1); pg.fillCircle(p.x, p.y, 15); pg.lineStyle(4, 0xe0c070, 1); pg.strokeCircle(p.x, p.y, 15); pg.fillStyle(0xe0c070, 1); pg.fillCircle(p.x, p.y, 5);
    }
    // POWER (top-left) and LOCK (bottom-right) terminals
    const power = { x: bx + 70, y: cTop + 70 }, lock = { x: plateX + plateW + 70, y: cBot - 60 };
    (this as unknown as { __posts: unknown }).__posts = { ...posts, lock };   // read by the automated tests
    const tg = this.add.graphics().setDepth(4);
    const term = (p: { x: number; y: number }, col: number, label: string) => { tg.fillStyle(col, 1); tg.fillRoundedRect(p.x - 26, p.y - 18, 52, 36, 8); tg.lineStyle(3, 0x0b1018, 1); tg.strokeRoundedRect(p.x - 26, p.y - 18, 52, 36, 8); T(this, p.x, p.y + 32, label, 16, '#ffffff', { weight: '800' }).setOrigin(0.5); };
    term(power, 0xd84a5a, '전원'); term(lock, 0x3dffa2, '잠금장치');
    // ---- jumper wire ----
    const route = ulnaRoute();
    const laid: { x: number; y: number }[] = [power];
    let step = 0, wired = false;
    const wire = this.add.graphics().setDepth(6);
    const plug = this.add.container(power.x + 36, power.y).setDepth(8);
    const plugG = this.add.graphics(); plugG.fillStyle(0xffd34d, 1); plugG.fillRoundedRect(-14, -14, 28, 28, 7); plugG.lineStyle(3, 0x3a2a05, 1); plugG.strokeRoundedRect(-14, -14, 28, 28, 7); plug.add(plugG);
    plug.setSize(70, 70).setInteractive({ useHandCursor: true, draggable: true });
    const drawWire = (end?: { x: number; y: number }) => {
      wire.clear();
      const pts = end ? [...laid, end] : laid;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        const curve = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(a.x, a.y), new Phaser.Math.Vector2((a.x + b.x) / 2, Math.max(a.y, b.y) + 30), new Phaser.Math.Vector2(b.x, b.y));
        wire.lineStyle(9, 0x3a2a05, 1); curve.draw(wire, 24);
        wire.lineStyle(5, 0xffd34d, 1); curve.draw(wire, 24);
      }
    };
    const tipT = this.tip(power.x + 36, power.y - 36, '노란 플러그를 끌어\n단자에 연결', undefined, 15).setDepth(9);
    plug.on('dragstart', () => tipT.setVisible(false));
    plug.on('drag', (_p: Phaser.Input.Pointer, x: number, y: number) => { plug.setPosition(x, y); drawWire({ x, y }); });
    plug.on('dragend', () => {
      const end = laid[laid.length - 1];
      const near = (p: { x: number; y: number }) => Math.hypot(p.x - plug.x, p.y - plug.y) < 30;
      const hit = ULNA_POSTS.find(id => near(posts[id]));
      const back = () => { plug.setPosition(end.x + 36, end.y); drawWire(); };
      if (step < route.length && hit) {
        if (laid.includes(posts[hit])) { back(); return; }
        if (hit === route[step]) {
          laid.push(posts[hit]); step++; Audio.play('snap');
          plug.setPosition(posts[hit].x + 30, posts[hit].y); drawWire();
          this.setFeedback(`연결됨 (${step}/${route.length}). 다음 단자로 이어 가세요.`, 'ok');
        } else {
          G.run.mistakes++; Audio.play('zap'); this.cameras.main.shake(150, 0.004);
          const spark = this.add.image(posts[hit].x, posts[hit].y, 'light').setTint(0xffe07a).setBlendMode(Phaser.BlendModes.ADD).setScale(0.6).setDepth(9);
          this.tweens.add({ targets: spark, alpha: 0, scale: 1, duration: 400, onComplete: () => spark.destroy() });
          this.setFeedback(this.adv ? '파직! 순서가 맞지 않는 단자다. 선이 빠졌다.' : `파직! ${step + 1}번째 단자가 아니다. 설명서의 순서와 각 구조의 생김새를 다시 확인하세요.`, 'err');
          back();
        }
      } else if (step === route.length && near(lock)) {
        laid.push(lock); wired = true; Audio.play('snap'); plug.disableInteractive(); plug.setPosition(lock.x - 36, lock.y); drawWire();
        this.setFeedback('회로 연결 완료. 차단기 레버를 올리세요.', 'ok');
      } else back();
    });
    // ---- fuse socket + inventory fuse ----
    const sock = { x: bx + bw - 230, y: cTop + 90 };
    const sg = this.add.graphics(); sg.fillStyle(0x0b1018, 1); sg.fillRoundedRect(sock.x - 70, sock.y - 30, 140, 60, 8); sg.lineStyle(2, 0x7f8a99, 1); sg.strokeRoundedRect(sock.x - 70, sock.y - 30, 140, 60, 8);
    T(this, sock.x, sock.y + 44, '퓨즈 소켓', 15, '#c3d3ee', { weight: '700' }).setOrigin(0.5);
    const fuseIn = () => { const f = this.add.image(sock.x, sock.y, 'inv_fuse').setScale(0.5 * 0.85); return f; };
    if (G.run.flags.ulnaFuse) fuseIn();
    else if (this.has('fuse')) {
      const home = { x: bx + bw - 230, y: cBot - 70 };
      const bagT = T(this, home.x, home.y - 50, '가방: 예비 퓨즈', 15, '#ffe0a0', { weight: '700' }).setOrigin(0.5);
      const f = this.add.image(home.x, home.y, 'inv_fuse').setScale(0.5 * 1.1).setInteractive({ useHandCursor: true, draggable: true }).setDepth(10);
      this.glint(f);
      f.on('drag', (_p: Phaser.Input.Pointer, x: number, y: number) => f.setPosition(x, y));
      f.on('dragend', () => {
        if (Math.hypot(f.x - sock.x, f.y - sock.y) < 70) { f.destroy(); bagT.destroy(); fuseIn(); G.run.flags.ulnaFuse = true; Audio.play('snap'); this.setFeedback('퓨즈 장착 완료.', 'ok'); }
        else this.tweens.add({ targets: f, x: home.x, y: home.y, duration: 250 });
      });
      f.on('pointerup', (p: Phaser.Input.Pointer) => { if (p.getDistance() < 8) this.setFeedback('퓨즈를 끌어서 위의 빈 소켓에 꽂으세요.', 'info'); });
    } else T(this, sock.x, cBot - 80, '소켓이 비어 있다.\n예비 퓨즈가 필요하다.', 15, '#ff9aa8', { weight: '700', align: 'center' }).setOrigin(0.5);
    // ---- breaker lever (drag up) ----
    const lx = bx + bw - 70, lTop = cTop + 150, lBot = cBot - 30;
    const lgr = this.add.graphics(); lgr.fillStyle(0x0b1018, 1); lgr.fillRoundedRect(lx - 14, lTop, 28, lBot - lTop, 14); lgr.lineStyle(2, C.green, 0.6); lgr.strokeRoundedRect(lx - 14, lTop, 28, lBot - lTop, 14);
    T(this, lx, lTop - 20, '차단기 ▲', 16, C.greenS, { weight: '800' }).setOrigin(0.5);
    const handle = this.add.container(lx, lBot - 30).setDepth(8);
    const hg = this.add.graphics(); hg.fillStyle(0x3dffa2, 1); hg.fillRoundedRect(-40, -20, 80, 40, 12); hg.lineStyle(3, 0x0b2a1a, 1); hg.strokeRoundedRect(-40, -20, 80, 40, 12); handle.add(hg);
    handle.setSize(100, 60).setInteractive({ useHandCursor: true, draggable: true });
    let thrown = false;
    handle.on('drag', (p: Phaser.Input.Pointer) => {
      if (thrown) return;
      handle.y = Phaser.Math.Clamp(p.worldY, lTop + 30, lBot - 30);
      if (handle.y < lTop + 50) {
        thrown = true;
        const why = !G.run.flags.ulnaFuse ? '퓨즈 소켓이 비어 있다' : !wired ? '점퍼선 회로가 완성되지 않았다' : '';
        if (why) {
          Audio.play('error'); this.setFeedback(`딸깍… 전원이 들어오지 않는다: ${why}.`, 'err');
          this.tweens.add({ targets: handle, y: lBot - 30, duration: 300, ease: 'Back.out', onComplete: () => { thrown = false; } });
        } else {
          Audio.play('powerup'); this.cameras.main.flash(250, 120, 255, 160);
          wire.clear(); laid.forEach((_, i) => { if (i) { const a = laid[i - 1], b = laid[i]; const c = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(a.x, a.y), new Phaser.Math.Vector2((a.x + b.x) / 2, Math.max(a.y, b.y) + 30), new Phaser.Math.Vector2(b.x, b.y)); wire.lineStyle(9, 0x0b2a1a, 1); c.draw(wire, 24); wire.lineStyle(5, 0x3dffa2, 1); c.draw(wire, 24); } });
          G.run.flags.ulnaCage = true;
          this.done('ulnaCage', '전원 복구! 표본 케이지 S-05의 잠금이 풀렸다. (표본을 꺼내면 보안 경보가 울릴 수 있다)');
        }
      }
    });
    handle.on('dragend', () => { if (!thrown) this.tweens.add({ targets: handle, y: lBot - 30, duration: 250 }); });
    this.setFeedback(this.has('manual') ? '설명서의 순서대로: 퓨즈 → 점퍼선 → 차단기.' : '단자 연결 순서를 알 수 없다. 어딘가에 설명서가 있을지도 모른다.', 'info');
  }

  hints() {
    const H: string[] = [];
    if (this.kind === 'toolbox') {
      if (!this.has('fuse')) H.push('공구함 뚜껑을 열고, 트레이에 끼워진 퓨즈를 눌러 챙기세요.');
      if (!this.has('manual')) H.push('공구 트레이 오른쪽 손잡이를 잡고 위로 들어 올리면 아래에 설명서가 있습니다.');
      if (!H.length) H.push('필요한 것은 다 챙겼습니다. L-06 동쪽 끝의 케이지 제어반으로 가세요.');
      return H;
    }
    if (!this.has('fuse') || !this.has('manual')) H.push('관절 보정실(J-03) 남서쪽 구석의 공구함을 조사하세요. 퓨즈와 설명서가 있습니다.');
    if (this.has('fuse') && !G.run.flags.ulnaFuse) H.push('가방의 퓨즈를 끌어서 오른쪽 위 빈 소켓에 꽂으세요.');
    H.push('단자는 자뼈 모형의 네 구조 옆에 있습니다: 팔꿈치머리 = 맨 위 끝, 갈고리돌기 = 그 아래 앞쪽으로 튀어나온 작은 돌기, 몸통 = 가운데, 붓돌기 = 맨 아래 뾰족한 끝.');
    if (!this.adv) H.push('연결 순서: 전원 → ' + ulnaRoute().map(p => ULNA_KO[p]).join(' → ') + ' → 잠금장치. 노란 플러그를 끌어 하나씩 연결하세요.');
    H.push('선을 다 연결했으면 오른쪽 초록 차단기 손잡이를 위로 끌어 올리세요.');
    return H;
  }
}
