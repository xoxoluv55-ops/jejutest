import Phaser from 'phaser';
import { Audio, MusicMode } from '../core/audio';
import { unlock } from '../core/save';
import { G, Bus } from '../game/state';
import { MAP5 } from '../data/map5';
import { CORES, NERVE, NerveId, CORE_DEVICE, PAIRS } from '../data/nerve';
import { preloadNerveArt } from '../art/nerve';
import { GameScene, Mission, InvItem } from './GameScene';
import { T } from '../ui/widgets';
import type { IconName } from '../ui/widgets';

const SURGE_TIME = 75;
const X = (x: number) => 2800 - x;   // map5 is the CH4 plan mirrored left-right

/**
 * CHAPTER 5 — 신경 배선실 (NERVE WIRING LAB). Floor plan: data/map5.ts (CH4 plan mirrored).
 * Flow: intro → nerve scanner (N-01, LOCK 1) + recover the 8 nerve cores from 4 locked devices (2 each; clues in other
 * rooms) → re-wire the nerves on the limb boards (N-01, LOCK 2) → power surge (reset the main breaker in N-04 within
 * 75 s) → conduction test room opens → lesion clinic (N-03, LOCK 3) → gate → lift.
 */
export class NerveScene extends GameScene {
  constructor() { super('Game5'); }
  map = MAP5;
  surgeLeft = 0;
  testDoor!: Phaser.GameObjects.Image; testDoorBlock!: Phaser.GameObjects.Zone;
  tableGlow!: Phaser.GameObjects.Image;

  preload() { super.preload(); preloadNerveArt(this.load, this.textures); }
  create(data?: { resume?: boolean }) { this.surgeLeft = 0; super.create(data); }

  floorTint(floor: string) { return floor === 'floor_tile' ? 0x98a8b8 : floor === 'floor_grate' ? 0x9098a4 : 0x96a0b0; }
  bgm(): MusicMode { return 'lab2'; }
  /** CH5 = cool slate-blue walls */
  wallTint() { return 0xb8c8dc; }

  // ---------------- CH5 props ----------------
  /** glass case with a model-rendered nerve plate */
  plateCase(x: number, y: number, key = 'ch5_aant_full') {
    const cap = this.prop('capsule', x, y, { col: [96, 36] });
    const ch = cap.displayHeight, cw = cap.displayWidth;
    const fl = this.add.graphics().setDepth(y + 0.3);
    const gw = cw * 0.64, gt = y - ch * 0.82, gb = y - ch * 0.22;
    fl.fillGradientStyle(0x0a1622, 0x0a1622, 0x050a10, 0x050a10, 0.94, 0.94, 0.96, 0.96); fl.fillRoundedRect(x - gw / 2, gt, gw, gb - gt, 10);
    fl.lineStyle(1.5, 0xbfeaff, 0.35); fl.strokeRoundedRect(x - gw / 2, gt, gw, gb - gt, 10);
    const m = this.add.image(x, (gt + gb) / 2, key);
    m.setScale(Math.min((gb - gt - 8) / m.height, (gw - 8) / m.width)).setDepth(y + 0.5);
    const glow = this.add.image(x, (gt + gb) / 2, 'light').setScale(0.35, 0.5).setTint(0x9fd8ff).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.28).setDepth(y + 0.4);
    this.tweens.add({ targets: glow, alpha: 0.1, duration: 1700 + Math.random() * 600, yoyo: true, repeat: -1 });
    return m;
  }
  /** wall screen with a nerve close-up and a travelling "signal" line */
  wallScreen(x: number, wallY: number, key: string) {
    const fy = wallY + 42;
    const frame = this.add.graphics().setDepth(wallY + 146);
    frame.fillStyle(0x04080c, 0.92); frame.fillRoundedRect(x - 44, fy, 88, 80, 6);
    frame.lineStyle(1.5, 0x9fd8ff, 0.8); frame.strokeRoundedRect(x - 44, fy, 88, 80, 6);
    const img = this.add.image(x, fy + 40, key).setDepth(wallY + 146.5).setAlpha(0.95);
    img.setScale(Math.min(74 / img.height, 82 / img.width));
    const scan = this.add.rectangle(x, fy + 4, 84, 3, 0xffe066, 0.5).setDepth(wallY + 147).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: scan, y: fy + 76, duration: 2200, repeat: -1 });
  }

  decals() {
    this.add.image(X(1180), 1480, 'puddle').setDepth(-950);
    this.add.image(X(1100), 1640, 'cables').setDepth(-940).setAlpha(0.9);
    this.add.image(X(1640), 1640, 'cables').setDepth(-940).setAlpha(0.8).setAngle(6);
    this.add.image(X(560), 1300, 'cables').setDepth(-940).setAlpha(0.8).setAngle(-8);
    this.add.image(X(1360), 790, 'decal_hazard').setDepth(-940).setScale(0.9, 0.7);
    this.add.image(X(950), 1980, 'decal_hazard').setDepth(-940).setScale(0.8, 0.6);
    this.add.image(X(1800), 2000, 'puddle').setDepth(-950).setScale(0.8);
    const tag = T(this, 1440, 1530, 'NERVE WIRING LAB · N-01', 22, '#bfeaff', { display: true }).setOrigin(0.5).setDepth(-930).setAlpha(0.35);
    tag.setShadow(0, 0, '#3ab0ff', 10, true, true);
  }

  buildContent() {
    const env = this.textures.exists('env');
    this.buildGate();
    // ---- N-01 hub ----
    this.plateCase(X(990), 905, 'ch5_lpost_full'); this.plateCase(X(1730), 905, 'ch5_aant_full');
    this.wallScreen(X(1150), 654, 'ch5_hand_close'); this.wallScreen(X(1570), 654, 'ch5_hum_close');
    if (env) {
      this.prop('x_fan', X(1060), 776, { depth: 799 }); this.prop('x_glass', X(1640), 772, { depth: 799 }); this.prop('x_pipes', X(1250), 790, { depth: 799 });
      this.prop('x_grill', X(300), 826, { depth: 849 }); this.prop('x_glass', X(620), 822, { depth: 849 });
      this.prop('x_pipes', X(2100), 940, { depth: 949 }); this.prop('x_fan', X(2480), 926, { depth: 949 });
      this.prop('x_grill', X(760), 1682, { depth: 1705 }); this.prop('x_pipes', X(1900), 1690, { depth: 1705 });
      this.prop('p_iv', X(1760), 1240, {}); this.prop('p_stretcher', X(1700), 1500, { col: [80, 26] });
      this.prop('x_plant', X(930), 1500, { col: [50, 20] }); this.prop('x_cone', X(1500), 1520, {}); this.prop('x_sign', X(220), 1500, {});
      this.prop('x_barrels', X(2140), 2220, { col: [60, 24] }); this.prop('x_cone', X(1250), 2200, {});
      this.prop('p_wheelchair', X(2560), 1500, { col: [50, 22] }); this.prop('x_barrier', X(2560), 1080, { col: [100, 20] });
      this.prop('p_plantcrate', X(200), 960, { col: [44, 20] });
      const cam = this.add.image(X(1480), 716, 'env', 'x_camera').setScale(0.5).setDepth(800);
      this.tweens.add({ targets: cam, angle: { from: -18, to: 18 }, duration: 3000, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.prop('t_glow', 1440, 600, { depth: -930, scale: 1.3 });
    }
    this.prop('jar', X(1180), 880, { col: [36, 20] }); this.prop('jar', X(1222), 884, { col: [36, 20] }); this.prop('jar', X(1540), 882, { col: [36, 20] });
    this.prop('crate', X(2120), 1830, { col: [70, 40] }); this.prop('crate', X(2120), 1900, { col: [70, 40] });
    // LOCK 1: nerve scanner (hub, east)
    this.prop('xray_box', X(1090), 1080, { col: [210, 40] });
    this.addInter({
      id: 'nscan', x: X(1090), y: 1090, r: 140, icon: 'eye',
      label: () => G.run.flags.scan ? '신경 스캐너 (스캔 완료)' : '신경 스캐너',
      locked: () => G.run.flags.scan ? '이미 스캔을 마쳤습니다.' : null,
      act: () => this.openPuzzle('NScan'),
    });
    // LOCK 2: re-wiring table (centre)
    this.prop('holo_table', 1360, 1300, { col: [230, 80] });
    this.tableGlow = this.add.image(1360, 1165, 'light').setScale(0.9, 1.5).setTint(0x7fd8ff).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.3).setDepth(1301);
    this.tweens.add({ targets: this.tableGlow, alpha: 0.12, duration: 1400, yoyo: true, repeat: -1 });
    T(this, 1360, 1330, 'NERVE REWIRING', 12, '#d8f0ff', { display: true }).setOrigin(0.5).setDepth(1302).setAlpha(0.85);
    this.addInter({
      id: 'nwire', x: 1360, y: 1300, r: 150, icon: 'bolt',
      label: () => G.run.flags.wire ? '신경 재배선대 (복구 완료)' : '신경 재배선대',
      locked: () => G.run.flags.wire ? '이미 재배선했습니다.'
        : !G.run.flags.scan ? '신경 경로 기준 데이터가 없습니다. 먼저 신경 스캐너(N-01 동쪽)를 해결하세요.'
        : G.run.items.length < CORES.length ? `신경 코어가 부족합니다 (${G.run.items.length}/8). 잠긴 장치들을 조사하세요.` : null,
      act: () => this.openPuzzle('NWire'),
    });
    // ---- N-02 reflex room (east) ----
    this.plateCase(X(260), 1000, 'ch5_apost_full'); this.plateCase(X(760), 1000, 'ch5_lant_full');
    this.wallScreen(X(470), 704, 'ch5_elbow_close');
    this.prop('rack', X(600), 1000, { col: [60, 30] });
    // ---- N-04 power control (south-east) ----
    this.prop('breaker', X(760), 1790, { col: [80, 24] });
    this.prop('rack', X(650), 1780, { col: [60, 30] }); this.prop('console_red', X(900), 1800, { col: [130, 40] });
    this.prop('p_techbox', X(1220), 2200, { col: [70, 26] });
    this.addInter({
      id: 'breaker5', x: X(760), y: 1800, r: 110, icon: 'bolt',
      label: () => G.run.flags.reset ? '주 차단기 (복구됨)' : '주 차단기 리셋 레버',
      locked: () => G.run.flags.reset ? '이미 복구했습니다.' : !G.run.flags.surge ? '배전 상태: 정상. 지금은 조작할 필요가 없습니다.' : null,
      act: () => this.resetBreaker(),
    });
    // ---- N-03 conduction test room (west, sealed) ----
    this.prop('console_red', X(2250), 1250, { col: [130, 40] });
    this.prop('rack', X(2580), 1000, { col: [60, 30] }); this.prop('p_techbox', X(2000), 1020, { col: [70, 26] });
    this.plateCase(X(2080), 1440, 'ch5_aant_full'); this.plateCase(X(2520), 1300, 'ch5_lant_full');
    this.wallScreen(X(2420), 804, 'ch5_knee_close');
    this.addInter({
      id: 'ncase', x: X(2250), y: 1250, r: 140, icon: 'eye',
      label: () => G.run.flags.lesion ? '손상 진단 콘솔 (진단 완료)' : '손상 진단 콘솔',
      locked: () => G.run.flags.lesion ? '이미 진단을 마쳤습니다.' : null,
      act: () => this.openPuzzle('NCase'),
    });
    // conduction room door (sealed until the breaker is reset)
    this.testDoor = this.textures.exists('env') && this.textures.get('env').has('d_side_closed')
      ? this.add.image(X(1838), 1342, 'env', 'd_side_closed').setOrigin(0.5, 1).setScale(0.5).setDepth(1342)
      : this.add.image(X(1838), 1340, 'door_v').setOrigin(0.5, 1).setScale(0.5, 0.5 * 160 / 180).setDepth(1340);
    this.testDoorBlock = this.solid(X(1820) - 36, 1180, 36, 160);
    this.addInter({
      id: 'tdoor5', x: X(1780), y: 1260, r: 90, icon: 'lock',
      enabled: () => !G.run.flags.reset,
      label: () => '전도 시험실 출입문',
      locked: () => G.run.flags.surge ? '과전류로 문이 잠겨 있습니다. 배전 제어실(N-04)에서 주 차단기를 리셋하세요.' : '격벽 잠금 상태. 신경 재배선이 끝나야 전도 시험 설비가 가동됩니다.',
      act: () => { /* locked only */ },
    });
    this.addInter({
      id: 'gate', x: this.map.gateX, y: 840, r: 130, icon: 'lock',
      enabled: () => !G.run.flags.gate,
      label: () => '탈출 게이트 · 신경 전도 인증',
      locked: () => { const f = G.run.flags; const n = [f.scan, f.wire, f.lesion].filter(Boolean).length; return n < 3 ? `게이트 잠금 ${n}/3 해제됨. 신경 스캐너 · 신경 재배선 · 손상 진단을 모두 완료해야 합니다.` : null; },
      act: () => this.openGate(),
    });
    const logs: [string, number, number, string][] = [['log_11', X(640), 1480, '반사 검사실 운영 단말기'], ['log_12', X(1140), 1790, '배전 매뉴얼']];
    for (const [id, x, y, name] of logs) { this.prop('terminal', x, y, { col: [40, 20] }); this.addInter({ id, x, y, r: 80, icon: 'info', label: () => name, act: () => this.readLog(id) }); }
    this.buildEscape5();
    this.addHazard('steam', X(1900), 2050, 60, 3.8, 1.1, 0.8);
    this.addHazard('steam', X(400), 1260, 60, 4.4, 1.2, 0.5);
    const ov = () => !!G.run.flags.surge && !G.run.flags.reset;
    this.addHazard('spark', X(1200), 1480, 64, 2.2, 0.8, 0.0, ov);
    this.addHazard('spark', X(1640), 1420, 64, 2.4, 0.8, 1.1, ov);
    this.addHazard('spark', X(1080), 1640, 60, 1.9, 0.7, 0.6, ov);
    this.addHazard('spark', X(1000), 2000, 60, 2.1, 0.7, 1.3, ov);
  }

  /** clue objects + devices (InvNerveScene): each device holds 2 cores; its clue is in another room */
  buildEscape5() {
    const has = (c: string) => G.run.clues.includes(c), got = (c: NerveId) => G.run.items.includes(c);
    const spot = (id: string, kind: string, x: number, y: number, r: number, label: () => string, todo: () => boolean, glint: [number, number]) => {
      this.addInter({ id, x, y, r, icon: 'eye', label, act: () => this.openInvestigate(kind) });
      this.escSpots.push({ x, y, todo });
      const g = this.add.image(glint[0], glint[1], 'light').setTint(0xd8f0ff).setBlendMode(Phaser.BlendModes.ADD).setScale(0.08).setAlpha(0);
      g.setDepth(5100);
      this.tweens.add({ targets: g, alpha: 0.9, scale: 0.16, duration: 450, yoyo: true, repeat: -1, repeatDelay: 2200, delay: Math.random() * 1500 });
    };
    // N-02: reflex bench (clue in N-05) + X-ray request on the desk (-> N-04 fracture reader)
    this.prop('optable', X(460), 1180, { col: [170, 50] });
    spot('inv5_reflex', 'reflex5', X(460), 1220, 95, () => got('musculocutaneous') ? '반사 검사대 (비어 있음)' : '반사 검사대 조사', () => !got('musculocutaneous') && has('k_neuro'), [X(460), 1100]);
    this.add.image(X(720), 1450, 'w_desk').setOrigin(0.5, 1).setScale(0.5).setDepth(1450); this.solid(X(720) - 80, 1450 - 42, 160, 42);
    spot('inv5_xray', 'xray5', X(720), 1475, 90, () => 'X-ray 판독 의뢰서 조사', () => !got('axillary') && !has('k_xray'), [X(700), 1390]);
    // N-01: carpal tunnel record on the trolley (-> N-05 sensory map)
    this.prop('p_trolley', X(1660), 1440, { col: [60, 24] });
    spot('inv5_carpal', 'carpal5', X(1660), 1470, 75, () => '손목굴 진료 기록 조사', () => !got('median') && !has('k_carpal'), [X(1660), 1380]);
    // N-04: fracture reader + gait analysis sheet on the wall (-> N-05 leg tracer)
    this.prop('xray_box', X(1060), 2090, { col: [150, 30] });
    spot('inv5_hum', 'hum5', X(1060), 2120, 95, () => got('axillary') ? '골절 판독기 (비어 있음)' : '골절 판독기 조사', () => !got('axillary') && has('k_xray'), [X(1060), 1990]);
    this.add.image(X(1000), 1700, 'w_poster').setOrigin(0.5, 1).setScale(0.62).setDepth(1706);
    spot('inv5_gait', 'gait5', X(1000), 1760, 80, () => '보행 분석 기록 조사', () => !got('sciatic') && !has('k_gait'), [X(1020), 1660]);
    // N-05: sensory map panel, leg wiring tracer, neuro exam record
    this.prop('p_techbox', X(1560), 2130, { col: [90, 26] });
    spot('inv5_hand', 'hand5', X(1560), 2150, 90, () => got('median') ? '감각 지도 패널 (비어 있음)' : '감각 지도 패널 조사', () => !got('median') && has('k_carpal'), [X(1560), 2050]);
    this.prop('console_red', X(1900), 1830, { col: [130, 40] });
    spot('inv5_leg', 'leg5', X(1900), 1860, 95, () => got('sciatic') ? '다리 배선 추적기 (비어 있음)' : '다리 배선 추적기 조사', () => !got('sciatic') && has('k_gait'), [X(1900), 1730]);
    this.prop('p_trolley', X(1720), 2180, { col: [60, 24] });
    spot('inv5_neuro', 'neuro5', X(1720), 2210, 75, () => '신경학 검사 기록지 조사', () => !got('musculocutaneous') && !has('k_neuro'), [X(1720), 2120]);
  }

  onInvestigateFound(id: string) {
    this.scene.resume(); this.scene.wake('HUD'); this.busy = false; this.player.frozen = false;
    const ids = id.split('+') as NerveId[];
    ids.forEach((c, i) => this.time.delayedCall(i * 350, () => this.pickCore(c)));
  }

  pickCore(id: NerveId) {
    const run = G.run; if (run.items.includes(id)) return;
    run.items.push(id); unlock(`nerve_${id}`);
    Audio.play('pickup'); this.player.burst(0x9fd8ff, 22);
    Bus.emit('pickup', id);
    this.toast(`${NERVE[id].ko} (${NERVE[id].en}) 코어 회수 — ${run.items.length}/8`, 'ok');
    Bus.emit('mission');
    if (run.items.length === CORES.length) this.time.delayedCall(900, () => this.ai(G.run.flags.scan ? '신경 코어 8개 회수 완료. 신경 배선실(N-01) 중앙의 재배선대로 이동하십시오.' : '신경 코어 8개 회수 완료. 신경 배선실(N-01)의 신경 스캐너를 먼저 마치십시오.', 'ok'));
  }

  // ---------------- story ----------------
  intro() {
    this.busy = true; this.player.frozen = true;
    Audio.alarm(true);
    this.tweens.add({ targets: this.redWash, fillAlpha: 0.1, duration: 700, yoyo: true, repeat: 3 });
    this.cameras.main.shake(500, 0.003);
    const seq: [number, () => void][] = [
      [600, () => { Audio.play('glitch'); this.ai('최하층 B1 도착. 말초신경 배선 데이터 손상 감지.', 'warn', 3200); }],
      [3800, () => this.ai('팔과 다리의 신경 코어 8개가 네 장치에 두 개씩 잠겨 있습니다. 각 장치의 해제 방법은 다른 방의 문서에 있습니다.', 'ai', 4400)],
      [8400, () => { this.ai('신경 스캐너(N-01) → 신경 재배선(N-01) → 손상 진단(N-03). 반짝이는 물건은 조사할 수 있습니다.', 'ai', 5200); Audio.alarm(false); }],
      [10200, () => {
        this.busy = false; this.player.frozen = false; G.run.flags.intro = true; Bus.emit('mission');
        this.toast('CHAPTER 5 · 신경 배선실', 'info');
        Audio.setMusic(this.bgm());
      }],
    ];
    for (const [t, fn] of seq) this.time.delayedCall(t, fn);
  }

  missions(): Mission[] {
    const f = G.run.flags, n = G.run.items.length;
    const list: Mission[] = [{ text: '신경 스캐너 · N-01', done: !!f.scan, active: !f.scan, tag: 'LOCK 1' }];
    for (const [a, b] of PAIRS) {
      const has = G.run.items.includes(a);
      list.push({ text: has ? `${NERVE[a].ko}·${NERVE[b].ko} 회수` : `${NERVE[a].ko}·${NERVE[b].ko} · ${CORE_DEVICE[a]}`, done: has, active: !has });
    }
    list.push({ text: '신경 재배선 · N-01', done: !!f.wire, active: !!f.scan && n >= 8 && !f.wire, tag: 'LOCK 2' });
    if (f.surge || f.reset) list.push({ text: '주 차단기 리셋 · N-04', done: !!f.reset, active: !!f.surge && !f.reset });
    list.push({ text: '손상 진단 · N-03', done: !!f.lesion, active: !!f.reset && !f.lesion, tag: 'LOCK 3' });
    list.push({ text: '게이트 개방 · 승강기 탑승', done: !!f.escaped, active: !!(f.scan && f.wire && f.lesion) && !f.escaped });
    return list;
  }

  objective(): { x: number; y: number } | null {
    const f = G.run.flags;
    if (!f.scan) return { x: X(1090), y: 1090 };
    if (G.run.items.length < CORES.length) {
      let best: { x: number; y: number } | null = null, bd = 1e9;
      for (const e of this.escSpots) { if (!e.todo()) continue; const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y); if (d < bd) { bd = d; best = e; } }
      return best;
    }
    if (!f.wire) return { x: 1360, y: 1300 };
    if (f.surge && !f.reset) return { x: X(760), y: 1800 };
    if (!f.lesion) return { x: X(2250), y: 1250 };
    if (!f.gate) return { x: this.map.gateX, y: 840 };
    if (!f.escaped) return { x: this.map.lift.x, y: 540 };
    return null;
  }

  onPuzzleDone(id: string) {
    const f = G.run.flags;
    this.scene.resume(); this.scene.wake('HUD'); this.busy = false; this.player.frozen = false;
    const learn = (c: string) => { unlock(c); if (!G.run.learned.includes(c)) G.run.learned.push(c); };
    if (id === 'NScan') {
      f.scan = true; learn('c_nscan'); this.setLock(0);
      this.ai(G.run.items.length < CORES.length ? '신경 스캔 완료. 게이트 잠금 1 해제. 남은 신경 코어를 회수하십시오.' : '신경 스캔 완료. 게이트 잠금 1 해제. 재배선대(N-01 중앙)로 이동하십시오.', 'ok', 4400);
    } else if (id === 'NWire') {
      f.wire = true; learn('c_nwire'); this.setLock(1);
      this.tableGlow.setTint(0x3dffa2);
      this.time.delayedCall(1600, () => this.startSurge());
    } else if (id === 'NCase') {
      f.lesion = true; learn('c_nlesion'); this.setLock(2);
      this.ai('손상 진단 완료. 게이트 잠금 3 해제.', 'ok');
    }
    Bus.emit('mission');
    if (f.scan && f.wire && f.lesion && !f.gate) this.time.delayedCall(2600, () => { this.ai('말초신경 배선 복구 완료. 탈출 게이트에서 신경 전도 인증을 실행하십시오.', 'ok', 5000); Audio.play('unlock'); });
  }

  applyResume() {
    const f = G.run.flags;
    f.intro = true; this.busy = false; this.player.frozen = false;
    if (G.run.cp) this.player.pb.reset(G.run.cp.x, G.run.cp.y);
    if (f.scan) this.setLockQuiet(0);
    if (f.wire) this.setLockQuiet(1);
    if (f.lesion) this.setLockQuiet(2);
    if (f.reset) this.openDoorInstant(this.testDoor, this.testDoorBlock, 150);
    if (f.gate) this.openGateInstant();
    Audio.setMusic(this.bgm());
    if (f.surge && !f.reset) this.time.delayedCall(800, () => this.startSurge());
    this.cameras.main.fadeIn(600, 0, 0, 0);
    this.toast('저장된 지점에서 이어합니다', 'info');
    Bus.emit('mission');
  }

  startSurge() {
    const f = G.run.flags; f.surge = true;
    Audio.play('powerdown'); Audio.alarm(true); Audio.setMusic('tension');
    this.cameras.main.shake(800, 0.006);
    this.surgeLeft = SURGE_TIME;
    this.ai('경고: 재배선된 신경 회로에 시험 전류 투입 — 과전류! 바닥 배선에서 스파크 발생.', 'warn', 3800);
    this.time.delayedCall(4000, () => this.ai(`${SURGE_TIME}초 내 복구 필요. 배전 제어실(N-04)의 주 차단기를 리셋하십시오.`, 'warn', 4800));
    Bus.emit('mission'); Bus.emit('blackout', true);
  }

  resetBreaker() {
    if (this.busy) return;
    this.busy = true; this.player.frozen = true;
    this.player.play('interact', 0, -1);
    Bus.emit('channel', { label: '차단기 레버 내리는 중…', dur: 1600 });
    let n = 0;
    const ev = this.time.addEvent({ delay: 300, repeat: 4, callback: () => { n++; Audio.play('hold'); this.sparks.emitParticleAt(X(760) + Phaser.Math.Between(-20, 20), 1740, 3); if (n === 5) ev.remove(); } });
    this.time.delayedCall(1700, () => {
      const f = G.run.flags; f.reset = true; f.surge = false;
      this.busy = false; this.player.frozen = false;
      Audio.play('powerup'); Audio.alarm(false); Audio.setMusic(this.bgm()); Audio.heartbeat(false);
      this.surgeLeft = 0; this.redWash.fillAlpha = 0;
      this.time.delayedCall(900, () => {
        Audio.play('door');
        this.tweens.add({ targets: this.testDoor, y: this.testDoor.y - 150, alpha: 0.2, duration: 1100, ease: 'Cubic.inOut' });
        (this.testDoorBlock.body as Phaser.Physics.Arcade.StaticBody).enable = false;
      });
      this.ai('주 차단기 복구. 전도 시험실(N-03) 출입문 개방.', 'ok', 4400);
      Bus.emit('mission'); Bus.emit('blackout', false);
    });
  }

  tickChapter(dt: number) {
    const f = G.run.flags;
    if (f.surge && !f.reset && !this.busy) {
      const prev = this.surgeLeft;
      this.surgeLeft -= dt;
      if (prev > 20 && this.surgeLeft <= 20) { Audio.heartbeat(true, 1.4); this.ai('배선 과열 한계 20초!', 'warn', 2500); }
      if (this.surgeLeft <= 0) {
        this.surgeLeft = SURGE_TIME; G.run.mistakes++;
        Audio.heartbeat(false); Audio.play('glitch');
        this.cameras.main.flash(400, 140, 200, 255);
        this.ai('복구 실패 — 보조 퓨즈가 한 번 끊겼다 다시 붙었습니다. 과전류 타이머 재설정.', 'warn', 4200);
      }
      Bus.emit('timer', this.surgeLeft);
    }
    if (f.surge && !f.reset) this.redWash.fillAlpha = 0.04 + 0.05 * Math.max(0, Math.sin(this.time.now / 1000 * 5));
  }

  lightRadius() { return 300; }
  timerLabel() { return '과전류 한계'; }
  chapterName() { return '신경 배선실'; }
  locksOpen() { const f = G.run.flags; return [f.scan, f.wire, f.lesion].filter(Boolean).length; }
  floorName() { return 'BODY LAB · B1'; }
  roomLocked(id: string) { const f = G.run.flags; return (id === 'ntest' && !f.reset) || (id === 'lift' && !f.gate); }

  invTitle() { return '신경 코어'; }
  invTotal() { return CORES.length; }
  invIcon(): IconName { return 'bolt'; }
  invItems(): InvItem[] {
    return G.run.items.map(id => {
      const c = NERVE[id as NerveId];
      return { id, tex: `ch5_core_${id}`, title: c.ko, en: c.en, info: `뿌리: ${c.roots} (${c.from})\n운동: ${c.motor}\n감각: ${c.sensory}`, tag: `경로: ${c.course.slice(0, 40)}…` };
    });
  }
}
