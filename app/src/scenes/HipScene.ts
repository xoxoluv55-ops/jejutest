import Phaser from 'phaser';
import { Audio, MusicMode } from '../core/audio';
import { unlock } from '../core/save';
import { G, Bus } from '../game/state';
import { MAP4 } from '../data/map4';
import { CORES, CORE, CoreId, CORE_DEVICE, PAIRS } from '../data/hip';
import { preloadHipArt } from '../art/hip';
import { GameScene, Mission, InvItem } from './GameScene';
import { T } from '../ui/widgets';
import type { IconName } from '../ui/widgets';

const LOAD_TIME = 75;

/**
 * CHAPTER 4 — 엉덩이·넙다리 근육실 (HIP & THIGH LAB). New floor plan (data/map4.ts).
 * Flow: intro → thigh cross-section reader (H-01, LOCK 1) + recover the 8 muscle cores from 4 locked devices
 * (2 each; clues in other rooms) → muscle re-assembly on the skeleton (H-01, LOCK 2) → load-test treadmill overload
 * (emergency stop in H-04 within 75 s) → gait test room opens → agonist/antagonist rig (H-03, LOCK 3) → gate → lift.
 */
export class HipScene extends GameScene {
  constructor() { super('Game4'); }
  map = MAP4;
  loadLeft = 0;
  testDoor!: Phaser.GameObjects.Image; testDoorBlock!: Phaser.GameObjects.Zone;
  tableGlow!: Phaser.GameObjects.Image;

  preload() { super.preload(); preloadHipArt(this.load, this.textures); }
  create(data?: { resume?: boolean }) { this.loadLeft = 0; super.create(data); }

  floorTint(floor: string) { return floor === 'floor_tile' ? 0xb0a490 : floor === 'floor_grate' ? 0x9c9a98 : 0xa89a8c; }
  bgm(): MusicMode { return 'lab2'; }
  /** CH4 = warm sandstone walls */
  wallTint() { return 0xe2cdb4; }

  // ---------------- CH4 props ----------------
  /** glass case with a model-rendered hip & thigh plate */
  plateCase(x: number, y: number, key = 'ch4_ant_full') {
    const cap = this.prop('capsule', x, y, { col: [96, 36] });
    const ch = cap.displayHeight, cw = cap.displayWidth;
    const fl = this.add.graphics().setDepth(y + 0.3);
    const gw = cw * 0.64, gt = y - ch * 0.82, gb = y - ch * 0.22;
    fl.fillGradientStyle(0x2a1a0c, 0x2a1a0c, 0x140c06, 0x140c06, 0.94, 0.94, 0.96, 0.96); fl.fillRoundedRect(x - gw / 2, gt, gw, gb - gt, 10);
    fl.lineStyle(1.5, 0xffd6a0, 0.35); fl.strokeRoundedRect(x - gw / 2, gt, gw, gb - gt, 10);
    const m = this.add.image(x, (gt + gb) / 2, key);
    m.setScale(Math.min((gb - gt - 8) / m.height, (gw - 8) / m.width)).setDepth(y + 0.5);
    const glow = this.add.image(x, (gt + gb) / 2, 'light').setScale(0.35, 0.5).setTint(0xffb870).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.28).setDepth(y + 0.4);
    this.tweens.add({ targets: glow, alpha: 0.1, duration: 1700 + Math.random() * 600, yoyo: true, repeat: -1 });
    return m;
  }
  /** wall screen showing the computed thigh cross-section */
  sectionPanel(x: number, wallY: number) {
    const fy = wallY + 42;
    const frame = this.add.graphics().setDepth(wallY + 146);
    frame.fillStyle(0x06080a, 0.92); frame.fillRoundedRect(x - 44, fy, 88, 80, 6);
    frame.lineStyle(1.5, 0xffc890, 0.8); frame.strokeRoundedRect(x - 44, fy, 88, 80, 6);
    const img = this.add.image(x, fy + 40, 'ch4_section').setDepth(wallY + 146.5).setAlpha(0.95);
    img.setScale(Math.min(74 / img.height, 82 / img.width));
    const scan = this.add.rectangle(x, fy + 4, 84, 3, 0xffd8a0, 0.5).setDepth(wallY + 147).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: scan, y: fy + 76, duration: 2600, repeat: -1 });
  }

  decals() {
    this.add.image(1180, 1480, 'puddle').setDepth(-950);
    this.add.image(1100, 1640, 'cables').setDepth(-940).setAlpha(0.9);
    this.add.image(1640, 1640, 'cables').setDepth(-940).setAlpha(0.8).setAngle(-6);
    this.add.image(560, 1300, 'cables').setDepth(-940).setAlpha(0.8).setAngle(8);
    this.add.image(1360, 790, 'decal_hazard').setDepth(-940).setScale(0.9, 0.7);
    this.add.image(950, 1980, 'decal_hazard').setDepth(-940).setScale(0.8, 0.6);
    this.add.image(1800, 2000, 'puddle').setDepth(-950).setScale(0.8);
    const tag = T(this, 1360, 1530, 'HIP & THIGH LAB · H-01', 22, '#ffc890', { display: true }).setOrigin(0.5).setDepth(-930).setAlpha(0.35);
    tag.setShadow(0, 0, '#ff8a3a', 10, true, true);
  }

  buildContent() {
    const env = this.textures.exists('env');
    this.buildGate();
    // ---- H-01 hub ----
    this.plateCase(990, 905); this.plateCase(1730, 905, 'ch4_post_full');
    this.sectionPanel(1150, 654); this.sectionPanel(1570, 654);
    if (env) {
      this.prop('x_fan', 1060, 776, { depth: 799 }); this.prop('x_glass', 1640, 772, { depth: 799 }); this.prop('x_pipes', 1250, 790, { depth: 799 });
      this.prop('x_grill', 300, 826, { depth: 849 }); this.prop('x_glass', 620, 822, { depth: 849 });
      this.prop('x_pipes', 2100, 940, { depth: 949 }); this.prop('x_fan', 2480, 926, { depth: 949 });
      this.prop('x_grill', 760, 1682, { depth: 1705 }); this.prop('x_pipes', 1900, 1690, { depth: 1705 });
      this.prop('p_iv', 1760, 1240, {}); this.prop('p_stretcher', 1700, 1500, { col: [80, 26] });
      this.prop('x_plant', 930, 1500, { col: [50, 20] }); this.prop('x_cone', 1500, 1520, {}); this.prop('x_sign', 220, 1500, {});
      this.prop('x_barrels', 2140, 2220, { col: [60, 24] }); this.prop('x_cone', 1250, 2200, {});
      this.prop('p_wheelchair', 2560, 1500, { col: [50, 22] }); this.prop('x_barrier', 2560, 1080, { col: [100, 20] });
      this.prop('p_plantcrate', 200, 960, { col: [44, 20] });
      const cam = this.add.image(1480, 716, 'env', 'x_camera').setScale(0.5).setDepth(800);
      this.tweens.add({ targets: cam, angle: { from: -18, to: 18 }, duration: 3000, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.prop('t_glow', 1360, 600, { depth: -930, scale: 1.3 });
    }
    this.prop('jar', 1180, 880, { col: [36, 20] }); this.prop('jar', 1222, 884, { col: [36, 20] }); this.prop('jar', 1540, 882, { col: [36, 20] });
    this.prop('crate', 2120, 1830, { col: [70, 40] }); this.prop('crate', 2120, 1900, { col: [70, 40] });
    // LOCK 1: cross-section reader (hub, west)
    this.prop('xray_box', 1090, 1080, { col: [210, 40] });
    this.addInter({
      id: 'hsect', x: 1090, y: 1090, r: 140, icon: 'eye',
      label: () => G.run.flags.section ? '하지 근육 스캐너 (스캔 완료)' : '하지 근육 스캐너',
      locked: () => G.run.flags.section ? '이미 판독을 마쳤습니다.' : null,
      act: () => this.openPuzzle('HSection'),
    });
    // LOCK 2: muscle re-assembly table (centre)
    this.prop('holo_table', 1440, 1300, { col: [230, 80] });
    this.tableGlow = this.add.image(1440, 1165, 'light').setScale(0.9, 1.5).setTint(0xffa860).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.3).setDepth(1301);
    this.tweens.add({ targets: this.tableGlow, alpha: 0.12, duration: 1400, yoyo: true, repeat: -1 });
    T(this, 1440, 1330, 'MUSCLE REASSEMBLY', 12, '#ffd8a0', { display: true }).setOrigin(0.5).setDepth(1302).setAlpha(0.85);
    this.addInter({
      id: 'hasm4', x: 1440, y: 1300, r: 150, icon: 'bone',
      label: () => G.run.flags.muscles ? '근육 재배치대 (복구 완료)' : '근육 재배치대',
      locked: () => G.run.flags.muscles ? '이미 근육을 재배치했습니다.'
        : !G.run.flags.section ? '근육 배치 기준 데이터가 없습니다. 먼저 하지 근육 스캐너(H-01 서쪽)를 해결하세요.'
        : G.run.items.length < CORES.length ? `근육 코어가 부족합니다 (${G.run.items.length}/8). 잠긴 장치들을 조사하세요.` : null,
      act: () => this.openPuzzle('HMuscles'),
    });
    // ---- H-02 gluteal dissection room ----
    this.plateCase(260, 1000, 'ch4_post_full'); this.plateCase(760, 1000);
    this.sectionPanel(470, 704);
    this.prop('rack', 600, 1000, { col: [60, 30] });
    // ---- H-04 load control ----
    this.prop('breaker', 760, 1790, { col: [80, 24] });
    this.prop('rack', 650, 1780, { col: [60, 30] }); this.prop('console_red', 900, 1800, { col: [130, 40] });
    this.prop('p_techbox', 1220, 2200, { col: [70, 26] });
    this.addInter({
      id: 'estop', x: 760, y: 1800, r: 110, icon: 'bolt',
      label: () => G.run.flags.stopped ? '트레드밀 비상 정지 (정지됨)' : '트레드밀 비상 정지 스위치',
      locked: () => G.run.flags.stopped ? '이미 정지시켰습니다.' : !G.run.flags.load ? '하중 시험 장비: 대기 상태. 지금은 조작할 필요가 없습니다.' : null,
      act: () => this.emergencyStop(),
    });
    // ---- H-03 gait test room ----
    this.prop('p_joint_rig', 2250, 1250, { col: [180, 60] });
    this.prop('rack', 2580, 1000, { col: [60, 30] }); this.prop('p_techbox', 2000, 1020, { col: [70, 26] });
    this.plateCase(2080, 1440); this.plateCase(2520, 1300, 'ch4_post_full');
    this.sectionPanel(2420, 804);
    this.addInter({
      id: 'hgait', x: 2250, y: 1250, r: 140, icon: 'rotate',
      label: () => G.run.flags.gait ? '보행 재현 콘솔 (판정 완료)' : '보행 재현 콘솔',
      locked: () => G.run.flags.gait ? '이미 판정을 마쳤습니다.' : null,
      act: () => this.openPuzzle('HGait'),
    });
    // test-room door (sealed until the treadmill is stopped)
    this.testDoor = this.textures.exists('env') && this.textures.get('env').has('d_side_closed')
      ? this.add.image(1838, 1342, 'env', 'd_side_closed').setOrigin(0.5, 1).setScale(0.5).setDepth(1342)
      : this.add.image(1838, 1340, 'door_v').setOrigin(0.5, 1).setScale(0.5, 0.5 * 160 / 180).setDepth(1340);
    this.testDoorBlock = this.solid(1820, 1180, 36, 160);
    this.addInter({
      id: 'tdoor4', x: 1780, y: 1260, r: 90, icon: 'lock',
      enabled: () => !G.run.flags.stopped,
      label: () => '보행 시험실 출입문',
      locked: () => G.run.flags.load ? '트레드밀 과부하로 문이 잠겨 있습니다. 하중 제어실(H-04)에서 비상 정지하세요.' : '격벽 잠금 상태. 근육 재배치가 끝나야 보행 시험 설비가 가동됩니다.',
      act: () => { /* locked only */ },
    });
    this.addInter({
      id: 'gate', x: this.map.gateX, y: 840, r: 130, icon: 'lock',
      enabled: () => !G.run.flags.gate,
      label: () => '탈출 게이트 · 보행 인증',
      locked: () => { const f = G.run.flags; const n = [f.section, f.muscles, f.gait].filter(Boolean).length; return n < 3 ? `게이트 잠금 ${n}/3 해제됨. 근육 스캐너 · 근육 재배치 · 보행 재현을 모두 완료해야 합니다.` : null; },
      act: () => this.openGate(),
    });
    // research logs
    const logs: [string, number, number, string][] = [['log_9', 640, 1480, '해부실 운영 단말기'], ['log_10', 1140, 1790, '하중 시험 매뉴얼']];
    for (const [id, x, y, name] of logs) { this.prop('terminal', x, y, { col: [40, 20] }); this.addInter({ id, x, y, r: 80, icon: 'info', label: () => name, act: () => this.readLog(id) }); }
    this.buildEscape4();
    // hazards: permanent steam in the cold room, load-test sparks during the overload only
    this.addHazard('steam', 1900, 2050, 60, 3.8, 1.1, 0.8);
    this.addHazard('steam', 400, 1260, 60, 4.4, 1.2, 0.5);
    const ov = () => !!G.run.flags.load && !G.run.flags.stopped;
    this.addHazard('spark', 1200, 1480, 64, 2.2, 0.8, 0.0, ov);
    this.addHazard('spark', 1640, 1420, 64, 2.4, 0.8, 1.1, ov);
    this.addHazard('spark', 1080, 1640, 60, 1.9, 0.7, 0.6, ov);
    this.addHazard('spark', 1000, 2000, 60, 2.1, 0.7, 1.3, ov);
  }

  /** clue objects + devices (InvHipScene): each device holds 2 cores; its clue is in another room */
  buildEscape4() {
    const has = (c: string) => G.run.clues.includes(c), got = (c: CoreId) => G.run.items.includes(c);
    const spot = (id: string, kind: string, x: number, y: number, r: number, label: () => string, todo: () => boolean, glint: [number, number]) => {
      this.addInter({ id, x, y, r, icon: 'eye', label, act: () => this.openInvestigate(kind) });
      this.escSpots.push({ x, y, todo });
      const g = this.add.image(glint[0], glint[1], 'light').setTint(0xffe8c8).setBlendMode(Phaser.BlendModes.ADD).setScale(0.08).setAlpha(0);
      g.setDepth(5100);
      this.tweens.add({ targets: g, alpha: 0.9, scale: 0.16, duration: 450, yoyo: true, repeat: -1, repeatDelay: 2200, delay: Math.random() * 1500 });
    };
    // H-02: gluteal dissection table (clue in H-05) + exercise prescription on the desk (-> H-04 rig)
    this.prop('optable', 460, 1180, { col: [170, 50] });
    spot('inv4_glut', 'gtable', 460, 1220, 95, () => got('gmax') ? '볼기 해부대 (비어 있음)' : '볼기 해부대 조사', () => !got('gmax') && has('k_rehab'), [460, 1100]);
    this.add.image(720, 1450, 'w_desk').setOrigin(0.5, 1).setScale(0.5).setDepth(1450); this.solid(720 - 80, 1450 - 42, 160, 42);
    spot('inv4_rx', 'rx4', 720, 1475, 90, () => '운동 처방전 조사', () => !got('iliopsoas') && !has('k_rx'), [700, 1390]);
    // H-01: knee surgery record on the trolley (-> H-05 pes fixture)
    this.prop('p_trolley', 1660, 1440, { col: [60, 24] });
    spot('inv4_knee', 'knee4', 1660, 1470, 75, () => '무릎 수술 기록 조사', () => !got('sartorius') && !has('k_knee'), [1660, 1380]);
    // H-04: hip-knee rig + innervation chart on the wall (-> H-05 fridge)
    this.prop('joint_rig', 1060, 2090, { col: [110, 30] });
    spot('inv4_rig', 'rig4', 1060, 2120, 95, () => got('iliopsoas') ? '엉덩·무릎 운동 시험대 (비어 있음)' : '엉덩·무릎 운동 시험대 조사', () => !got('iliopsoas') && has('k_rx'), [1060, 1990]);
    this.add.image(1000, 1700, 'w_poster').setOrigin(0.5, 1).setScale(0.62).setDepth(1706);
    spot('inv4_chart', 'chart4', 1000, 1760, 80, () => '신경 지배 차트 조사', () => !got('bf') && !has('k_chart'), [1020, 1660]);
    // H-05: pes anserinus fixture, nerve compartment fridge, rehab record
    this.prop('p_techbox', 1560, 2130, { col: [90, 26] });
    spot('inv4_pes', 'pes4', 1560, 2150, 90, () => got('sartorius') ? '거위발 고정기 (비어 있음)' : '거위발 고정기 조사', () => !got('sartorius') && has('k_knee'), [1560, 2050]);
    if (this.textures.exists('env') && this.textures.get('env').has('p_fridge')) this.prop('p_fridge', 1900, 1830, { col: [110, 36] }); else this.prop('cabinet', 1900, 1830, { col: [86, 30] });
    spot('inv4_fridge', 'fridge4', 1900, 1860, 95, () => got('bf') ? '신경 구획 냉장고 (비어 있음)' : '신경 구획 냉장고 조사', () => !got('bf') && has('k_chart'), [1900, 1730]);
    this.prop('p_trolley', 1720, 2180, { col: [60, 24] });
    spot('inv4_rehab', 'rehab4', 1720, 2210, 75, () => '재활 기록지 조사', () => !got('gmax') && !has('k_rehab'), [1720, 2120]);
  }

  /** a core pair taken in an investigation view ('a+b') */
  onInvestigateFound(id: string) {
    this.scene.resume(); this.scene.wake('HUD'); this.busy = false; this.player.frozen = false;
    const ids = id.split('+') as CoreId[];
    ids.forEach((c, i) => this.time.delayedCall(i * 350, () => this.pickCore(c)));
  }

  pickCore(id: CoreId) {
    const run = G.run; if (run.items.includes(id)) return;
    run.items.push(id); unlock(`hipm_${id}`);
    Audio.play('pickup'); this.player.burst(0xffb870, 22);
    Bus.emit('pickup', id);
    this.toast(`${CORE[id].ko} (${CORE[id].en}) 코어 회수 — ${run.items.length}/8`, 'ok');
    Bus.emit('mission');
    if (run.items.length === CORES.length) this.time.delayedCall(900, () => this.ai(G.run.flags.section ? '근육 코어 8개 회수 완료. 하지 근육실(H-01) 중앙의 재배치대로 이동하십시오.' : '근육 코어 8개 회수 완료. 하지 근육실(H-01)의 근육 스캐너를 먼저 마치십시오.', 'ok'));
  }

  // ---------------- story ----------------
  intro() {
    this.busy = true; this.player.frozen = true;
    Audio.alarm(true);
    this.tweens.add({ targets: this.redWash, fillAlpha: 0.1, duration: 700, yoyo: true, repeat: 3 });
    this.cameras.main.shake(500, 0.003);
    const seq: [number, () => void][] = [
      [600, () => { Audio.play('glitch'); this.ai('하부 연구동 B2 도착. 하지 근육 데이터 손상 감지.', 'warn', 3200); }],
      [3800, () => this.ai('엉덩이·넙다리 근육 코어 8개가 네 장치에 두 개씩 잠겨 있습니다. 각 장치의 해제 방법은 다른 방의 문서에 있습니다.', 'ai', 4400)],
      [8400, () => { this.ai('근육 스캐너(H-01) → 근육 재배치(H-01) → 보행 재현(H-03). 반짝이는 물건은 조사할 수 있습니다.', 'ai', 5200); Audio.alarm(false); }],
      [10200, () => {
        this.busy = false; this.player.frozen = false; G.run.flags.intro = true; Bus.emit('mission');
        this.toast('CHAPTER 4 · 엉덩이·넙다리 근육실', 'info');
        Audio.setMusic(this.bgm());
      }],
    ];
    for (const [t, fn] of seq) this.time.delayedCall(t, fn);
  }

  missions(): Mission[] {
    const f = G.run.flags, n = G.run.items.length;
    const list: Mission[] = [{ text: '하지 근육 스캐너 · H-01', done: !!f.section, active: !f.section, tag: 'LOCK 1' }];
    for (const [a, b] of PAIRS) {
      const has = G.run.items.includes(a);
      list.push({ text: has ? `${CORE[a].ko}·${CORE[b].ko} 회수` : `${CORE[a].ko}·${CORE[b].ko} · ${CORE_DEVICE[a]}`, done: has, active: !has });
    }
    list.push({ text: '근육 재배치 · H-01', done: !!f.muscles, active: !!f.section && n >= 8 && !f.muscles, tag: 'LOCK 2' });
    if (f.load || f.stopped) list.push({ text: '트레드밀 비상 정지 · H-04', done: !!f.stopped, active: !!f.load && !f.stopped });
    list.push({ text: '보행 재현 · H-03', done: !!f.gait, active: !!f.stopped && !f.gait, tag: 'LOCK 3' });
    list.push({ text: '게이트 개방 · 승강기 탑승', done: !!f.escaped, active: !!(f.section && f.muscles && f.gait) && !f.escaped });
    return list;
  }

  objective(): { x: number; y: number } | null {
    const f = G.run.flags;
    if (!f.section) return { x: 1090, y: 1090 };
    if (G.run.items.length < CORES.length) {
      let best: { x: number; y: number } | null = null, bd = 1e9;
      for (const e of this.escSpots) { if (!e.todo()) continue; const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y); if (d < bd) { bd = d; best = e; } }
      return best;
    }
    if (!f.muscles) return { x: 1440, y: 1300 };
    if (f.load && !f.stopped) return { x: 760, y: 1800 };
    if (!f.gait) return { x: 2250, y: 1250 };
    if (!f.gate) return { x: this.map.gateX, y: 840 };
    if (!f.escaped) return { x: this.map.lift.x, y: 540 };
    return null;
  }

  onPuzzleDone(id: string) {
    const f = G.run.flags;
    this.scene.resume(); this.scene.wake('HUD'); this.busy = false; this.player.frozen = false;
    const learn = (c: string) => { unlock(c); if (!G.run.learned.includes(c)) G.run.learned.push(c); };
    if (id === 'HSection') {
      f.section = true; learn('c_section'); this.setLock(0);
      this.ai(G.run.items.length < CORES.length ? '근육 스캔 완료. 게이트 잠금 1 해제. 남은 근육 코어를 회수하십시오.' : '근육 스캔 완료. 게이트 잠금 1 해제. 재배치대(H-01 중앙)로 이동하십시오.', 'ok', 4400);
    } else if (id === 'HMuscles') {
      f.muscles = true; learn('c_hipmus'); this.setLock(1);
      this.tableGlow.setTint(0x3dffa2);
      this.time.delayedCall(1600, () => this.startLoad());
    } else if (id === 'HGait') {
      f.gait = true; learn('c_twojoint'); this.setLock(2);
      this.ai('보행 재현 완료. 게이트 잠금 3 해제.', 'ok');
    }
    Bus.emit('mission');
    if (f.section && f.muscles && f.gait && !f.gate) this.time.delayedCall(2600, () => { this.ai('하지 근육 시스템 복구 완료. 탈출 게이트에서 보행 인증을 실행하십시오.', 'ok', 5000); Audio.play('unlock'); });
  }

  applyResume() {
    const f = G.run.flags;
    f.intro = true; this.busy = false; this.player.frozen = false;
    if (G.run.cp) this.player.pb.reset(G.run.cp.x, G.run.cp.y);
    if (f.section) this.setLockQuiet(0);
    if (f.muscles) this.setLockQuiet(1);
    if (f.gait) this.setLockQuiet(2);
    if (f.stopped) this.openDoorInstant(this.testDoor, this.testDoorBlock, 150);
    if (f.gate) this.openGateInstant();
    Audio.setMusic(this.bgm());
    if (f.load && !f.stopped) this.time.delayedCall(800, () => this.startLoad());
    this.cameras.main.fadeIn(600, 0, 0, 0);
    this.toast('저장된 지점에서 이어합니다', 'info');
    Bus.emit('mission');
  }

  startLoad() {
    const f = G.run.flags; f.load = true;
    Audio.play('powerdown'); Audio.alarm(true); Audio.setMusic('tension');
    this.cameras.main.shake(800, 0.006);
    this.loadLeft = LOAD_TIME;
    this.ai('경고: 재배치된 근육으로 하중 시험 트레드밀 자동 가동 — 모터 과부하! 바닥 배선에서 스파크 발생.', 'warn', 3800);
    this.time.delayedCall(4000, () => this.ai(`${LOAD_TIME}초 내 정지 필요. 하중 제어실(H-04)의 비상 정지 스위치를 누르십시오.`, 'warn', 4800));
    Bus.emit('mission'); Bus.emit('blackout', true);
  }

  emergencyStop() {
    if (this.busy) return;
    this.busy = true; this.player.frozen = true;
    this.player.play('interact', 0, -1);
    Bus.emit('channel', { label: '비상 정지 덮개 여는 중…', dur: 1600 });
    let n = 0;
    const ev = this.time.addEvent({ delay: 300, repeat: 4, callback: () => { n++; Audio.play('hold'); this.sparks.emitParticleAt(760 + Phaser.Math.Between(-20, 20), 1740, 3); if (n === 5) ev.remove(); } });
    this.time.delayedCall(1700, () => {
      const f = G.run.flags; f.stopped = true; f.load = false;
      this.busy = false; this.player.frozen = false;
      Audio.play('powerup'); Audio.alarm(false); Audio.setMusic(this.bgm()); Audio.heartbeat(false);
      this.loadLeft = 0; this.redWash.fillAlpha = 0;
      this.time.delayedCall(900, () => {
        Audio.play('door');
        this.tweens.add({ targets: this.testDoor, y: this.testDoor.y - 150, alpha: 0.2, duration: 1100, ease: 'Cubic.inOut' });
        (this.testDoorBlock.body as Phaser.Physics.Arcade.StaticBody).enable = false;
      });
      this.ai('트레드밀 정지. 보행 시험실(H-03) 출입문 개방.', 'ok', 4400);
      Bus.emit('mission'); Bus.emit('blackout', false);
    });
  }

  tickChapter(dt: number) {
    const f = G.run.flags;
    if (f.load && !f.stopped && !this.busy) {
      const prev = this.loadLeft;
      this.loadLeft -= dt;
      if (prev > 20 && this.loadLeft <= 20) { Audio.heartbeat(true, 1.4); this.ai('모터 과열 한계 20초!', 'warn', 2500); }
      if (this.loadLeft <= 0) {
        this.loadLeft = LOAD_TIME; G.run.mistakes++;
        Audio.heartbeat(false); Audio.play('glitch');
        this.cameras.main.flash(400, 255, 140, 30);
        this.ai('정지 실패 — 차단기가 한 번 떨어졌다 다시 붙었습니다. 과부하 타이머 재설정.', 'warn', 4200);
      }
      Bus.emit('timer', this.loadLeft);
    }
    if (f.load && !f.stopped) this.redWash.fillAlpha = 0.04 + 0.05 * Math.max(0, Math.sin(this.time.now / 1000 * 5));
  }

  lightRadius() { return 300; }
  timerLabel() { return '과부하 한계'; }
  chapterName() { return '엉덩이·넙다리 근육실'; }
  locksOpen() { const f = G.run.flags; return [f.section, f.muscles, f.gait].filter(Boolean).length; }
  floorName() { return 'BODY LAB · B2'; }
  roomLocked(id: string) { const f = G.run.flags; return (id === 'htest' && !f.stopped) || (id === 'lift' && !f.gate); }

  invTitle() { return '근육 코어'; }
  invTotal() { return CORES.length; }
  invIcon(): IconName { return 'bolt'; }
  invItems(): InvItem[] {
    return G.run.items.map(id => {
      const c = CORE[id as CoreId];
      return { id, tex: `ch4_core_${id}`, title: c.ko, en: c.en, info: `이는곳: ${c.origin}\n닿는곳: ${c.insertion}\n작용: ${c.action}`, tag: `부위: ${c.region}` };
    });
  }
}
