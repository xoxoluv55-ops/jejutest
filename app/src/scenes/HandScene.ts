import Phaser from 'phaser';
import { Audio, MusicMode } from '../core/audio';
import { unlock } from '../core/save';
import { G, Bus } from '../game/state';
import { MAP3 } from '../data/map3';
import { CARPALS, CARPAL, CarpalId, CARPAL_DEVICE } from '../data/hand';
import { preloadHandArt } from '../art/hand';
import { GameScene, Mission, InvItem } from './GameScene';
import { T } from '../ui/widgets';
import type { IconName } from '../ui/widgets';

const PRESS_TIME = 75;
const W2 = 2800;
const mx = (x: number) => W2 - x;   // positions are the CH2 wing mirrored (map3.ts)

/**
 * CHAPTER 3 — 손목·관절실 (WRIST & JOINT LAB).
 * Flow: intro → hand X-ray reader (J-02, LOCK 1) + recover the 8 carpals from 4 locked devices (2 each; clues in other rooms)
 * → carpal re-assembly (J-01, LOCK 2) → joint-test press over-pressure (release valve in J-04 within 75 s)
 * → joint test room opens → joint-type console (J-03, LOCK 3) → gate → lift → result.
 */
export class HandScene extends GameScene {
  constructor() { super('Game3'); }
  map = MAP3;
  pressLeft = 0;
  testDoor!: Phaser.GameObjects.Image; testDoorBlock!: Phaser.GameObjects.Zone;
  consoleGlow!: Phaser.GameObjects.Image;

  preload() { super.preload(); preloadHandArt(this.load, this.textures); }
  create(data?: { resume?: boolean }) { this.pressLeft = 0; super.create(data); }

  floorTint(floor: string) { return floor === 'floor_tile' ? 0x8fa6b8 : floor === 'floor_grate' ? 0x8e98a8 : 0x8396ac; }
  bgm(): MusicMode { return 'lab2'; }
  /** CH3 = cool steel-teal walls */
  wallTint() { return 0xb2d2dc; }

  // ---------------- CH3 props ----------------
  /** glass case with a model-rendered hand skeleton */
  handCase(x: number, y: number, key = 'ch3_hand_full') {
    const cap = this.prop('capsule', x, y, { col: [96, 36] });
    const ch = cap.displayHeight, cw = cap.displayWidth;
    const fl = this.add.graphics().setDepth(y + 0.3);
    const gw = cw * 0.64, gt = y - ch * 0.80, gb = y - ch * 0.24;
    fl.fillGradientStyle(0x0c2a3a, 0x0c2a3a, 0x061520, 0x061520, 0.94, 0.94, 0.96, 0.96); fl.fillRoundedRect(x - gw / 2, gt, gw, gb - gt, 10);
    fl.lineStyle(1.5, 0x9fe0ff, 0.35); fl.strokeRoundedRect(x - gw / 2, gt, gw, gb - gt, 10);
    const m = this.add.image(x, (gt + gb) / 2, key);
    m.setScale(Math.min((gb - gt - 10) / m.height, (gw - 10) / m.width)).setDepth(y + 0.5);
    const glow = this.add.image(x, (gt + gb) / 2, 'light').setScale(0.35, 0.5).setTint(0x5fd0ff).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.3).setDepth(y + 0.4);
    this.tweens.add({ targets: glow, alpha: 0.12, duration: 1700 + Math.random() * 600, yoyo: true, repeat: -1 });
    return m;
  }
  /** wall screen showing the simulated hand radiograph */
  xrayPanel(x: number, wallY: number) {
    const fy = wallY + 42;
    const frame = this.add.graphics().setDepth(wallY + 146);
    frame.fillStyle(0x04080c, 0.9); frame.fillRoundedRect(x - 34, fy, 68, 100, 6);
    frame.lineStyle(1.5, 0x7fd8ff, 0.8); frame.strokeRoundedRect(x - 34, fy, 68, 100, 6);
    const img = this.add.image(x, fy + 50, 'ch3_xray_hand').setDepth(wallY + 146.5).setAlpha(0.95);
    img.setScale(94 / img.height);
    const scan = this.add.rectangle(x, fy + 4, 64, 3, 0x9fe0ff, 0.5).setDepth(wallY + 147).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: scan, y: fy + 96, duration: 2400, repeat: -1 });
  }

  decals() {
    this.add.image(mx(1000), 1500, 'puddle').setDepth(-950);
    this.add.image(mx(1150), 1640, 'cables').setDepth(-940).setAlpha(0.9);
    this.add.image(mx(480), 1380, 'cables').setDepth(-940).setAlpha(0.8).setAngle(6);
    this.add.image(mx(1360), 790, 'decal_hazard').setDepth(-940).setScale(0.9, 0.7);
    this.add.image(mx(1320), 1860, 'decal_hazard').setDepth(-940).setScale(0.8, 0.6);
    const tag = T(this, mx(1360), 1610, 'WRIST & JOINT LAB · J-01', 22, '#7fd8ff', { display: true }).setOrigin(0.5).setDepth(-930).setAlpha(0.35);
    tag.setShadow(0, 0, '#3aa8ff', 10, true, true);
  }

  buildContent() {
    const env = this.textures.exists('env');
    this.buildGate();
    // ---- J-01 hub ----
    this.handCase(mx(900), 905); this.handCase(mx(1680), 905, 'ch3_wrist_full');
    this.xrayPanel(mx(1260), 654); this.xrayPanel(mx(1460), 654);
    if (env) {
      this.prop('x_fan', mx(1110), 776, { depth: 799 }); this.prop('x_glass', mx(1600), 772, { depth: 799 }); this.prop('x_pipes', mx(1860), 790, { depth: 799 });
      this.prop('x_grill', mx(300), 826, { depth: 849 }); this.prop('x_glass', mx(560), 822, { depth: 849 });
      this.prop('x_pipes', mx(2200), 990, { depth: 999 }); this.prop('x_fan', mx(2480), 976, { depth: 999 });
      this.prop('x_grill', mx(1180), 1822, { depth: 1845 }); this.prop('x_pipes', mx(1600), 1836, { depth: 1845 });
      this.prop('p_iv', mx(1790), 1235, {}); this.prop('p_stretcher', mx(1080), 1480, { col: [80, 26] });
      this.prop('x_plant', mx(1930), 930, { col: [50, 20] }); this.prop('x_cone', mx(1880), 1420, {}); this.prop('x_sign', mx(800), 1640, {});
      this.prop('x_barrels', mx(1660), 1950, { col: [60, 24] }); this.prop('x_cone', mx(1225), 2125, {});
      this.prop('p_wheelchair', mx(2560), 1500, { col: [50, 22] }); this.prop('x_barrier', mx(2560), 1100, { col: [100, 20] });
      this.prop('p_plantcrate', mx(200), 960, { col: [44, 20] }); this.prop('x_barrels', mx(200), 1440, { col: [60, 24] });
      const cam = this.add.image(mx(1520), 716, 'env', 'x_camera').setScale(0.5).setDepth(800).setFlipX(true);
      this.tweens.add({ targets: cam, angle: { from: -18, to: 18 }, duration: 3000, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.prop('t_glow', mx(1360), 600, { depth: -930, scale: 1.3 });
    }
    this.prop('jar', mx(1180), 880, { col: [36, 20] }); this.prop('jar', mx(1222), 884, { col: [36, 20] }); this.prop('jar', mx(1540), 882, { col: [36, 20] });
    this.prop('rack', mx(790), 905, { col: [60, 30] });
    this.prop('crate', mx(1860), 1690, { col: [70, 40] }); this.prop('crate', mx(1930), 1690, { col: [70, 40] });
    // LOCK 2: carpal re-assembly table (centre)
    this.prop('holo_table', mx(1360), 1300, { col: [230, 80] });
    this.consoleGlow = this.add.image(mx(1360), 1165, 'light').setScale(0.9, 1.5).setTint(0x5fd0ff).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.3).setDepth(1301);
    this.tweens.add({ targets: this.consoleGlow, alpha: 0.12, duration: 1400, yoyo: true, repeat: -1 });
    T(this, mx(1360), 1330, 'CARPAL REASSEMBLY', 12, '#9fe0ff', { display: true }).setOrigin(0.5).setDepth(1302).setAlpha(0.85);
    this.addInter({
      id: 'hasm', x: mx(1360), y: 1300, r: 150, icon: 'bone',
      label: () => G.run.flags.carpus ? '손목뼈 재조립대 (복구 완료)' : '손목뼈 재조립대',
      locked: () => G.run.flags.carpus ? '이미 손목을 재조립했습니다.'
        : !G.run.flags.hxray ? '손 영상 데이터가 없습니다. 먼저 손목 표본실(J-02)의 손 X선 판독기를 해결하세요.'
        : G.run.items.length < CARPALS.length ? `손목뼈가 부족합니다 (${G.run.items.length}/8). 잠긴 장치들을 조사하세요.` : null,
      act: () => this.openPuzzle('HAssembly'),
    });
    // ---- J-02 wrist specimen room ----
    this.prop('xray_box', mx(400), 990, { col: [210, 40] });
    this.addInter({
      id: 'hxray', x: mx(400), y: 1000, r: 140, icon: 'eye',
      label: () => G.run.flags.hxray ? '손 X선 판독기 (판독 완료)' : '손 X선 판독기',
      locked: () => G.run.flags.hxray ? '이미 판독을 마쳤습니다.' : null,
      act: () => this.openPuzzle('HXray'),
    });
    this.prop('rack', mx(210), 1000, { col: [60, 30] });
    this.handCase(mx(260), 1250, 'ch3_xray_hand'); this.handCase(mx(560), 1250);
    this.xrayPanel(mx(440), 704);
    // ---- J-04 hydraulic control ----
    this.prop('breaker', mx(1060), 1870, { col: [80, 24] });
    this.prop('rack', mx(940), 1858, { col: [60, 30] }); this.prop('console_red', mx(1500), 1900, { col: [130, 40] });
    this.prop('p_techbox', mx(1260), 1900, { col: [70, 26] }); this.prop('p_techbox', mx(1620), 2150, { col: [70, 26] });
    this.addInter({
      id: 'valve', x: mx(1060), y: 1880, r: 110, icon: 'bolt',
      label: () => G.run.flags.released ? '유압 감압 밸브 (안정화됨)' : '유압 감압 밸브',
      locked: () => G.run.flags.released ? '이미 감압을 마쳤습니다.' : !G.run.flags.press ? '유압 계통: 정상 압력. 지금은 조작할 필요가 없습니다.' : null,
      act: () => this.releaseValve(),
    });
    // ---- J-03 joint test room ----
    if (env && this.textures.get('env').has('p_joint_rig')) this.prop('p_joint_rig', mx(2320), 1250, { col: [180, 60] }); else this.prop('joint_rig', mx(2320), 1250, { col: [180, 60] });
    this.prop('rack', mx(2580), 1000, { col: [60, 30] }); this.prop('p_techbox', mx(2100), 1000, { col: [70, 26] });
    this.handCase(mx(2100), 1420); this.handCase(mx(2540), 1300, 'ch3_wrist_full');
    this.xrayPanel(mx(2420), 854);
    this.addInter({
      id: 'hjoint', x: mx(2320), y: 1250, r: 140, icon: 'rotate',
      label: () => G.run.flags.joints ? '관절 시험 콘솔 (판정 완료)' : '관절 시험 콘솔',
      locked: () => G.run.flags.joints ? '이미 관절 판정을 마쳤습니다.' : null,
      act: () => this.openPuzzle('HJoint'),
    });
    // test-room door (sealed until the press is released)
    const dx = mx(1978);
    this.testDoor = this.textures.exists('env') && this.textures.get('env').has('d_side_closed')
      ? this.add.image(dx, 1342, 'env', 'd_side_closed').setOrigin(0.5, 1).setScale(0.5).setDepth(1342).setFlipX(true)
      : this.add.image(dx, 1340, 'door_v').setOrigin(0.5, 1).setScale(0.5, 0.5 * 160 / 180).setDepth(1340);
    this.testDoorBlock = this.solid(mx(1960) - 36, 1180, 36, 160);
    this.addInter({
      id: 'tdoor', x: mx(1930), y: 1260, r: 90, icon: 'lock',
      enabled: () => !G.run.flags.released,
      label: () => '관절 시험실 출입문',
      locked: () => G.run.flags.press ? '프레스 과압으로 문이 잠겨 있습니다. 유압 제어실(J-04)에서 감압하세요.' : '격벽 잠금 상태. 손목 재조립이 끝나야 시험 설비가 가동됩니다.',
      act: () => { /* locked only */ },
    });
    this.addInter({
      id: 'gate', x: this.map.gateX, y: 840, r: 130, icon: 'lock',
      enabled: () => !G.run.flags.gate,
      label: () => '탈출 게이트 · 관절 인증',
      locked: () => { const f = G.run.flags; const n = [f.hxray, f.carpus, f.joints].filter(Boolean).length; return n < 3 ? `게이트 잠금 ${n}/3 해제됨. 손 X선 판독 · 손목뼈 재조립 · 관절 판정을 모두 완료해야 합니다.` : null; },
      act: () => this.openGate(),
    });
    // research logs
    const logs: [string, number, number, string][] = [['log_7', mx(560), 1000, '관절실 운영 단말기'], ['log_8', mx(1620), 2250, '유압 제어 매뉴얼']];
    for (const [id, x, y, name] of logs) { this.prop('terminal', x, y, { col: [40, 20] }); if (id === 'log_8') continue; this.addInter({ id, x, y, r: 85, icon: 'info', label: () => name, act: () => this.readLog(id) }); }
    this.buildEscape3();
    // hazards: permanent ones in J-04 / J-02 and press-only bursts across the hub
    this.addHazard('steam', mx(1150), 2170, 66, 3.6, 1.1, 1.1);
    this.addHazard('steam', mx(1360), 2200, 62, 2.8, 0.8, 0.4);
    this.addHazard('steam', mx(560), 1390, 64, 4.4, 1.2, 0.5);
    const ov = () => !!G.run.flags.press && !G.run.flags.released;
    this.addHazard('steam', mx(1120), 1500, 66, 2.2, 0.8, 0.0, ov);
    this.addHazard('steam', mx(1600), 1500, 66, 2.2, 0.8, 1.1, ov);
    this.addHazard('steam', mx(1320), 1760, 60, 1.9, 0.7, 0.6, ov);
  }

  /** clue objects + devices (InvHandScene): each device holds 2 carpals; its clue is in another spot */
  buildEscape3() {
    const has = (c: string) => G.run.clues.includes(c), got = (c: CarpalId) => G.run.items.includes(c);
    const spot = (id: string, kind: string, x: number, y: number, r: number, label: () => string, todo: () => boolean, glint: [number, number]) => {
      this.addInter({ id, x, y, r, icon: 'eye', label, act: () => this.openInvestigate(kind) });
      this.escSpots.push({ x, y, todo });
      const g = this.add.image(glint[0], glint[1], 'light').setTint(0xc8f0ff).setBlendMode(Phaser.BlendModes.ADD).setScale(0.08).setAlpha(0).setDepth(5100);
      this.tweens.add({ targets: g, alpha: 0.9, scale: 0.16, duration: 450, yoyo: true, repeat: -1, repeatDelay: 2200, delay: Math.random() * 1500 });
    };
    // J-02: journal (desk) -> radiocarpal vault; order dial (clue: J-01 poster)
    this.add.image(mx(330), 1150, 'w_desk').setOrigin(0.5, 1).setScale(0.5).setDepth(1150); this.solid(mx(330) - 80, 1150 - 42, 160, 42);
    spot('inv3_journal', 'journal3', mx(330), 1175, 90, () => '관절 정비 일지 조사', () => !got('scaphoid') && !has('h_journal'), [mx(300), 1090]);
    this.prop('cabinet', mx(640), 1010, { col: [86, 30] });
    spot('inv3_vault', 'vault3', mx(640), 1050, 85, () => got('scaphoid') ? '관절면 금고 (비어 있음)' : '관절면 금고 조사', () => !got('scaphoid') && has('h_journal'), [mx(640), 930]);
    this.prop('p_techbox', mx(470), 1430, { col: [90, 26] });
    spot('inv3_dial', 'dial3', mx(470), 1440, 85, () => got('triquetrum') ? '순서 원판 (비어 있음)' : '손목뼈 순서 원판 조사', () => !got('triquetrum') && has('h_poster'), [mx(470), 1340]);
    // J-01: poster (wall), surgery record (trolley), tunnel fixture (dissection table)
    this.add.image(mx(1000), 792, 'w_poster').setOrigin(0.5, 1).setScale(0.62).setDepth(800);
    spot('inv3_poster', 'poster3', mx(1000), 850, 80, () => '손목뼈 배열 포스터 조사', () => !got('triquetrum') && !has('h_poster'), [mx(1020), 750]);
    this.prop('p_trolley', mx(1560), 1460, { col: [60, 24] });
    spot('inv3_surgery', 'surgery', mx(1560), 1490, 75, () => '수술 기록지 조사', () => !got('pisiform') && !has('h_surgery'), [mx(1560), 1400]);
    this.prop('optable', mx(1700), 1300, { col: [170, 50] });
    spot('inv3_tunnel', 'tunnel', mx(1700), 1340, 95, () => got('pisiform') ? '손목굴 고정기 (비어 있음)' : '손목굴 고정기 조사', () => !got('pisiform') && has('h_surgery'), [mx(1700), 1240]);
    // J-04: manual (terminal) -> metacarpal aligner
    spot('inv3_manual', 'manual3', mx(1620), 2250, 85, () => '손가락 축 정렬기 매뉴얼', () => !got('trapezium') && !has('h_manual'), [mx(1620), 2180]);
    this.prop('joint_rig', mx(1440), 2060, { col: [110, 30] });
    spot('inv3_aligner', 'aligner', mx(1440), 2095, 90, () => got('trapezium') ? '손가락 축 정렬기 (비어 있음)' : '손가락 축 정렬기 조사', () => !got('trapezium') && has('h_manual'), [mx(1440), 1960]);
  }

  /** a carpal pair taken in an investigation view ('a+b') */
  onInvestigateFound(id: string) {
    this.scene.resume(); this.scene.wake('HUD'); this.busy = false; this.player.frozen = false;
    const ids = id.split('+') as CarpalId[];
    ids.forEach((c, i) => this.time.delayedCall(i * 350, () => this.pickCarpal(c)));
  }

  pickCarpal(id: CarpalId) {
    const run = G.run; if (run.items.includes(id)) return;
    run.items.push(id); unlock(`car_${id}`);
    Audio.play('pickup'); this.player.burst(0x7fd8ff, 22);
    Bus.emit('pickup', id);
    this.toast(`${CARPAL[id].ko} (${CARPAL[id].en}) 회수 — ${run.items.length}/8`, 'ok');
    Bus.emit('mission');
    if (run.items.length === CARPALS.length) this.time.delayedCall(900, () => this.ai(G.run.flags.hxray ? '손목뼈 8개 회수 완료. 관절 연구실(J-01)의 재조립대로 이동하십시오.' : '손목뼈 8개 회수 완료. 손목 표본실(J-02)에서 손 X선 판독을 먼저 마치십시오.', 'ok'));
  }

  // ---------------- story ----------------
  intro() {
    this.busy = true; this.player.frozen = true;
    Audio.alarm(true);
    this.tweens.add({ targets: this.redWash, fillAlpha: 0.1, duration: 700, yoyo: true, repeat: 3 });
    this.cameras.main.shake(500, 0.003);
    const seq: [number, () => void][] = [
      [600, () => { Audio.play('glitch'); this.ai('하부 연구동 B1 도착. 손목·관절 데이터 손상 감지.', 'warn', 3200); }],
      [3800, () => this.ai('손목뼈 표본 8개가 네 장치에 두 개씩 잠겨 있습니다. 각 장치의 해제 방법은 다른 곳의 문서에 있습니다.', 'ai', 4200)],
      [8200, () => { this.ai('손 X선 판독(J-02) → 손목뼈 재조립(J-01) → 관절 판정(J-03). 반짝이는 물건은 조사할 수 있습니다.', 'ai', 5200); Audio.alarm(false); }],
      [10000, () => {
        this.busy = false; this.player.frozen = false; G.run.flags.intro = true; Bus.emit('mission');
        this.toast('CHAPTER 3 · 손목·관절실', 'info');
        Audio.setMusic(this.bgm());
      }],
    ];
    for (const [t, fn] of seq) this.time.delayedCall(t, fn);
  }

  missions(): Mission[] {
    const f = G.run.flags, n = G.run.items.length;
    const list: Mission[] = [{ text: '손 X선 판독 · J-02', done: !!f.hxray, active: !f.hxray, tag: 'LOCK 1' }];
    const pairs: CarpalId[][] = [['scaphoid', 'lunate'], ['pisiform', 'hamate'], ['trapezium', 'trapezoid'], ['triquetrum', 'capitate']];
    for (const [a, b] of pairs) {
      const has = G.run.items.includes(a);
      list.push({ text: has ? `${CARPAL[a].ko}·${CARPAL[b].ko} 회수` : `${CARPAL[a].ko}·${CARPAL[b].ko} · ${CARPAL_DEVICE[a]}`, done: has, active: !has });
    }
    list.push({ text: '손목뼈 재조립 · J-01', done: !!f.carpus, active: !!f.hxray && n >= 8 && !f.carpus, tag: 'LOCK 2' });
    if (f.press || f.released) list.push({ text: '프레스 감압 · J-04', done: !!f.released, active: !!f.press && !f.released });
    list.push({ text: '관절 유형 판정 · J-03', done: !!f.joints, active: !!f.released && !f.joints, tag: 'LOCK 3' });
    list.push({ text: '게이트 개방 · 승강기 탑승', done: !!f.escaped, active: !!(f.hxray && f.carpus && f.joints) && !f.escaped });
    return list;
  }

  objective(): { x: number; y: number } | null {
    const f = G.run.flags;
    if (!f.hxray) return { x: mx(400), y: 1000 };
    if (G.run.items.length < CARPALS.length) {
      let best: { x: number; y: number } | null = null, bd = 1e9;
      for (const e of this.escSpots) { if (!e.todo()) continue; const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y); if (d < bd) { bd = d; best = e; } }
      return best;
    }
    if (!f.carpus) return { x: mx(1360), y: 1300 };
    if (f.press && !f.released) return { x: mx(1060), y: 1880 };
    if (!f.joints) return { x: mx(2320), y: 1250 };
    if (!f.gate) return { x: this.map.gateX, y: 840 };
    if (!f.escaped) return { x: this.map.lift.x, y: 540 };
    return null;
  }

  onPuzzleDone(id: string) {
    const f = G.run.flags;
    this.scene.resume(); this.scene.wake('HUD'); this.busy = false; this.player.frozen = false;
    const learn = (c: string) => { unlock(c); if (!G.run.learned.includes(c)) G.run.learned.push(c); };
    if (id === 'HXray') {
      f.hxray = true; learn('c_handxray'); this.setLock(0);
      this.ai(G.run.items.length < CARPALS.length ? '손 영상 판독 완료. 게이트 잠금 1 해제. 남은 손목뼈를 회수하십시오.' : '손 영상 판독 완료. 게이트 잠금 1 해제. 재조립대(J-01)로 이동하십시오.', 'ok', 4400);
    } else if (id === 'HAssembly') {
      f.carpus = true; learn('c_carpal'); this.setLock(1);
      this.consoleGlow.setTint(0x3dffa2);
      this.time.delayedCall(1600, () => this.startPress());
    } else if (id === 'HJoint') {
      f.joints = true; learn('c_joint'); this.setLock(2);
      this.ai('관절 판정 완료. 게이트 잠금 3 해제.', 'ok');
    }
    Bus.emit('mission');
    if (f.hxray && f.carpus && f.joints && !f.gate) this.time.delayedCall(2600, () => { this.ai('손목·관절 시스템 복구 완료. 탈출 게이트에서 관절 인증을 실행하십시오.', 'ok', 5000); Audio.play('unlock'); });
  }

  applyResume() {
    const f = G.run.flags;
    f.intro = true; this.busy = false; this.player.frozen = false;
    if (G.run.cp) this.player.pb.reset(G.run.cp.x, G.run.cp.y);
    if (f.hxray) this.setLockQuiet(0);
    if (f.carpus) this.setLockQuiet(1);
    if (f.joints) this.setLockQuiet(2);
    if (f.released) this.openDoorInstant(this.testDoor, this.testDoorBlock, 150);
    if (f.gate) this.openGateInstant();
    Audio.setMusic(this.bgm());
    if (f.press && !f.released) this.time.delayedCall(800, () => this.startPress());
    this.cameras.main.fadeIn(600, 0, 0, 0);
    this.toast('저장된 지점에서 이어합니다', 'info');
    Bus.emit('mission');
  }

  startPress() {
    const f = G.run.flags; f.press = true;
    Audio.play('powerdown'); Audio.alarm(true); Audio.setMusic('tension');
    this.cameras.main.shake(800, 0.006);
    this.pressLeft = PRESS_TIME;
    this.ai('경고: 재조립된 손목으로 관절 시험 프레스 가동 — 유압 과압! 바닥 배관에서 증기 분출 중.', 'warn', 3800);
    this.time.delayedCall(4000, () => this.ai(`${PRESS_TIME}초 내 감압 필요. 유압 제어실(J-04)의 감압 밸브를 돌리십시오.`, 'warn', 4800));
    Bus.emit('mission'); Bus.emit('blackout', true);
  }

  releaseValve() {
    if (this.busy) return;
    this.busy = true; this.player.frozen = true;
    this.player.play('interact', 0, -1);
    Bus.emit('channel', { label: '감압 밸브 돌리는 중…', dur: 1800 });
    let n = 0;
    const ev = this.time.addEvent({ delay: 300, repeat: 5, callback: () => { n++; Audio.play('hold'); this.steam.emitParticleAt(mx(1060) + Phaser.Math.Between(-20, 20), 1830, 4); if (n === 6) ev.remove(); } });
    this.time.delayedCall(1900, () => {
      const f = G.run.flags; f.released = true; f.press = false;
      this.busy = false; this.player.frozen = false;
      Audio.play('powerup'); Audio.alarm(false); Audio.setMusic(this.bgm()); Audio.heartbeat(false);
      this.pressLeft = 0; this.redWash.fillAlpha = 0;
      this.time.delayedCall(900, () => {
        Audio.play('door');
        this.tweens.add({ targets: this.testDoor, y: this.testDoor.y - 150, alpha: 0.2, duration: 1100, ease: 'Cubic.inOut' });
        (this.testDoorBlock.body as Phaser.Physics.Arcade.StaticBody).enable = false;
      });
      this.ai('유압 안정화. 관절 시험실(J-03) 출입문 개방.', 'ok', 4400);
      Bus.emit('mission'); Bus.emit('blackout', false);
    });
  }

  tickChapter(dt: number) {
    const f = G.run.flags;
    if (f.press && !f.released && !this.busy) {
      const prev = this.pressLeft;
      this.pressLeft -= dt;
      if (prev > 20 && this.pressLeft <= 20) { Audio.heartbeat(true, 1.4); this.ai('과압 한계 20초!', 'warn', 2500); }
      if (this.pressLeft <= 0) {
        this.pressLeft = PRESS_TIME; G.run.mistakes++;
        Audio.heartbeat(false); Audio.play('glitch');
        this.cameras.main.flash(400, 255, 140, 30);
        this.ai('감압 실패 — 비상 릴리프가 작동했습니다. 과압 타이머 재설정.', 'warn', 4200);
      }
      Bus.emit('timer', this.pressLeft);
    }
    if (f.press && !f.released) this.redWash.fillAlpha = 0.04 + 0.05 * Math.max(0, Math.sin(this.time.now / 1000 * 5));
  }

  lightRadius() { return 300; }
  timerLabel() { return '과압 한계'; }
  chapterName() { return '손목·관절실'; }
  locksOpen() { const f = G.run.flags; return [f.hxray, f.carpus, f.joints].filter(Boolean).length; }
  floorName() { return 'BODY LAB · B1'; }
  roomLocked(id: string) { const f = G.run.flags; return (id === 'jtest' && !f.released) || (id === 'lift' && !f.gate); }

  invTitle() { return '손목뼈 표본'; }
  invTotal() { return CARPALS.length; }
  invIcon(): IconName { return 'bone'; }
  invItems(): InvItem[] {
    return G.run.items.map(id => {
      const c = CARPAL[id as CarpalId];
      return { id, tex: `ch3_car_${id}`, title: c.ko, en: c.en, info: `${c.row} · ${c.shape}\n${c.info}`, tag: '분류: 손목뼈' };
    });
  }
}
