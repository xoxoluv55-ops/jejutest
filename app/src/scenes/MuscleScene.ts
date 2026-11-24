import Phaser from 'phaser';
import { Audio, MusicMode } from '../core/audio';
import { unlock } from '../core/save';
import { G, Bus } from '../game/state';
import { MAP2 } from '../data/map2';
import { MUSCLES, MuscleId, LINK_BASIC, LINK_ADV } from '../data/muscles';
import { makeMuscleTexture } from '../art/muscles';
import { GameScene, Mission, InvItem } from './GameScene';
import { T } from '../ui/widgets';
import type { IconName } from '../ui/widgets';

// Where each muscle data core lies. via = inside a container; hidden = revealed by SCAN.
const CORE_SPOTS: Record<string, { x: number; y: number; hidden?: boolean; via?: 'locker' | 'capsule' }> = {
  deltoid: { x: 250, y: 1400 },
  biceps: { x: 640, y: 1010, via: 'locker' },
  brachialis: { x: 1850, y: 1610, hidden: true },
  triceps: { x: 1560, y: 2200 },
  coracobrachialis: { x: 1040, y: 905, via: 'capsule' },
  brachioradialis: { x: 1000, y: 2230, hidden: true },
};

const OVERLOAD_TIME = 75;
/** v0.10: where each core's device is (mission list) */
const CORE_WHERE: Partial<Record<MuscleId, string>> = {
  biceps: 'M-02 보관함 (노트 단서)', deltoid: 'M-02 라이트박스 (M-01 차트)', brachialis: 'M-01 해부대 (메모)', triceps: 'M-04 팔꿈치 모형 (매뉴얼)',
  coracobrachialis: 'M-02 보관함 안쪽 서랍', brachioradialis: 'M-04 팔꿈치 모형 2단계',
};

/**
 * CHAPTER 2 — 근육 연결실 (MUSCLE LINK LAB).
 * Flow: intro → muscle atlas (M-02, LOCK 1) + collect muscle data cores → origin/insertion link console (M-01, LOCK 2)
 * → stimulator overload event (discharge lever in M-04 within 75 s) → motion room opens → agonist/antagonist rig (M-03, LOCK 3)
 * → gate → lift → result.
 */
export class MuscleScene extends GameScene {
  constructor() { super('Game2'); }
  map = MAP2;
  overloadLeft = 0;
  motionDoor!: Phaser.GameObjects.Image; motionDoorBlock!: Phaser.GameObjects.Zone;
  locker!: Phaser.GameObjects.Image;
  coresInWorld: Record<string, Phaser.GameObjects.Container> = {};
  consoleGlow!: Phaser.GameObjects.Image;

  get needed(): MuscleId[] { return G.run.difficulty === 'adv' ? LINK_ADV : LINK_BASIC; }

  create(data?: { resume?: boolean }) { this.overloadLeft = 0; this.coresInWorld = {}; super.create(data); }

  floorTint(floor: string) { return floor === 'floor_tile' ? 0x9a8fae : floor === 'floor_grate' ? 0x8e94b0 : 0x86809e; }
  /** CH2 has its own exploration music (Dorian pulse) — CH1 uses 'ambient'. */
  bgm(): MusicMode { return 'lab2'; }

  /** CH2 = rose-steel clinical walls (CH1 walls are untinted grey-blue). */
  wallTint() { return 0xd9b2c4; }

  // ---------------- CH2 props ----------------
  // Dedicated CH2 art drops in through public/assets/ch2/props/manifest.json (texture key `ch2p_<key>`, see
  // docs/ASSETS.md). Until it is supplied, each prop is assembled from existing world art + the model-rendered muscles.
  ch2Has(key: string) { return this.textures.exists(`ch2p_${key}`); }
  ch2Image(key: string, x: number, y: number, h: number, col?: [number, number]) {
    const img = this.add.image(x, y, `ch2p_${key}`).setOrigin(0.5, 1);
    img.setScale(h / img.height).setDepth(y);
    if (col) this.solid(x - col[0] / 2, y - col[1], col[0], col[1]);
    return img;
  }

  /** 근육 표본 캡슐: a glass capsule holding one muscle (the BodyParts3D layer of that muscle). */
  specimenCapsule(id: MuscleId, x: number, y: number) {
    if (this.ch2Has(`capsule_${id}`)) return this.ch2Image(`capsule_${id}`, x, y, 150, [96, 36]);
    if (this.ch2Has('capsule')) this.ch2Image('capsule', x, y, 150, [96, 36]);
    const cap = this.ch2Has('capsule') ? null : this.prop('capsule', x, y, { col: [96, 36] });
    const ch = cap ? cap.displayHeight : 150, cw = cap ? cap.displayWidth : 90;
    // preservation fluid fills the glass (hides the generic capsule's skeleton hologram), specimen floats in it
    const fl = this.add.graphics().setDepth(y + 0.3);
    const gw = cw * 0.64, gt = y - ch * 0.80, gb = y - ch * 0.24;
    fl.fillGradientStyle(0x5a1428, 0x5a1428, 0x2a0612, 0x2a0612, 0.92, 0.92, 0.95, 0.95); fl.fillRoundedRect(x - gw / 2, gt, gw, gb - gt, 10);
    fl.lineStyle(1.5, 0xffb3c6, 0.35); fl.strokeRoundedRect(x - gw / 2, gt, gw, gb - gt, 10);
    for (let k = 0; k < 4; k++) {
      const b = this.add.circle(x - gw * 0.3 + Math.random() * gw * 0.6, gb - 6, 1.6 + Math.random() * 1.5, 0xffd0dc, 0.5).setDepth(y + 0.6);
      this.tweens.add({ targets: b, y: gt + 8, alpha: 0, duration: 2600 + Math.random() * 2000, repeat: -1, delay: Math.random() * 2000 });
    }
    const mt = makeMuscleTexture(this, id, 'real');
    const m = this.add.image(x, (gt + gb) / 2, mt.key);
    m.setScale(Math.min((gb - gt - 12) / m.height, (gw - 12) / m.width)).setDepth(y + 0.5);
    const glow = this.add.image(x, (gt + gb) / 2, 'light').setScale(0.35, 0.5).setTint(0xff5c84).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.35).setDepth(y + 0.4);
    this.tweens.add({ targets: glow, alpha: 0.15, duration: 1600 + Math.random() * 600, yoyo: true, repeat: -1 });
    T(this, x, y + 10, MUSCLES[id].ko, 11, '#ffc2d2', { weight: '700', backgroundColor: '#14070dcc', padding: { x: 4, y: 1 } }).setOrigin(0.5, 0).setDepth(y + 1).setAlpha(0.9);
    return m;
  }

  /** 해부도 패널: wall-mounted holo screen showing the model plate. */
  anatomyPanel(x: number, wallY: number, which: 'full' | 'bones' = 'full') {
    if (this.ch2Has('anatomy_panel')) return this.ch2Image('anatomy_panel', x, wallY + 140, 96);
    const fy = wallY + 36 + 6;                     // top of the wall face
    const frame = this.add.graphics().setDepth(wallY + 146);
    frame.fillStyle(0x0a0410, 0.85); frame.fillRoundedRect(x - 40, fy, 80, 96, 6);
    frame.lineStyle(1.5, 0xff5c84, 0.8); frame.strokeRoundedRect(x - 40, fy, 80, 96, 6);
    const img = this.add.image(x, fy + 48, which === 'full' ? 'ch2_plate_full' : 'ch2_plate_bones').setDepth(wallY + 146.5).setAlpha(0.95);
    img.setScale(90 / img.height);
    const scan = this.add.rectangle(x, fy + 4, 76, 3, 0xff8fb0, 0.5).setDepth(wallY + 147).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: scan, y: fy + 92, duration: 2200, repeat: -1 });
    return img;
  }

  /** 전기자극 장치: stimulator unit with electrode leads (existing tech box + console art, live spark). */
  stimulator(x: number, y: number) {
    if (this.ch2Has('stimulator')) return this.ch2Image('stimulator', x, y, 120, [90, 30]);
    const box = this.prop('p_techbox', x, y, { col: [70, 26] });
    this.add.image(x + 40, y + 20, 'cables').setDepth(-940).setAlpha(0.9).setScale(0.6);
    const sp = this.add.image(x, y - 40, 'light').setScale(0.2).setTint(0x9fd8ff).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(y + 1);
    this.tweens.add({ targets: sp, alpha: { from: 0, to: 0.9 }, duration: 90, yoyo: true, repeat: -1, repeatDelay: 1400 + Math.random() * 1600 });
    return box;
  }

  /** 근수축 실험 장비: contraction test stand — rig + the model biceps hologram (no fake deformation). */
  contractionRig(id: MuscleId, x: number, y: number) {
    if (this.ch2Has('contraction_rig')) return this.ch2Image('contraction_rig', x, y, 150, [120, 40]);
    const rig = this.prop('p_trolley', x, y, { col: [60, 24] });
    const mt = makeMuscleTexture(this, id, 'glow');
    const h = this.add.image(x, y - 70, mt.key).setDepth(y + 1).setAlpha(0.75).setBlendMode(Phaser.BlendModes.ADD);
    h.setScale(60 / h.height);
    this.tweens.add({ targets: h, alpha: 0.35, duration: 1300, yoyo: true, repeat: -1 });
    return rig;
  }

  decals() {
    this.add.image(1000, 1500, 'puddle').setDepth(-950);
    this.add.image(1150, 1640, 'cables').setDepth(-940).setAlpha(0.9);
    this.add.image(480, 1380, 'cables').setDepth(-940).setAlpha(0.8).setAngle(-6);
    this.add.image(1360, 790, 'decal_hazard').setDepth(-940).setScale(0.9, 0.7);
    this.add.image(1320, 1860, 'decal_hazard').setDepth(-940).setScale(0.8, 0.6);
    this.add.image(2300, 1460, 'cables').setDepth(-940).setAngle(10).setAlpha(0.7);
    const tag = T(this, 1360, 1610, 'MUSCLE LINK LAB · M-01', 22, '#ff8fb0', { display: true }).setOrigin(0.5).setDepth(-930).setAlpha(0.35);
    tag.setShadow(0, 0, '#ff5c84', 10, true, true);
  }

  buildContent() {
    const env = this.textures.exists('env');
    this.buildGate();
    // ---- M-01 hub ----
    // specimen capsules (one muscle each, model-rendered) along the north wall of M-01
    (['deltoid', 'pecmajor', 'brachialis'] as MuscleId[]).forEach((id, k) => this.specimenCapsule(id, [900, 1680, 1820][k], 905));
    this.anatomyPanel(1260, 654); this.anatomyPanel(1460, 654, 'bones');
    this.prop('capsule_broken', 1040, 905, { col: [96, 36] });
    if (env) {
      this.prop('x_fan', 1110, 776, { depth: 799 }); this.prop('x_glass', 1600, 772, { depth: 799 }); this.prop('x_pipes', 1860, 790, { depth: 799 });
      this.prop('x_grill', 300, 826, { depth: 849 }); this.prop('x_glass', 560, 822, { depth: 849 });
      this.prop('x_pipes', 2200, 990, { depth: 999 }); this.prop('x_fan', 2480, 976, { depth: 999 });
      this.prop('x_grill', 1180, 1822, { depth: 1845 }); this.prop('x_pipes', 1600, 1836, { depth: 1845 });
      this.prop('p_iv', 1790, 1235, {}); this.prop('p_trolley', 1560, 1460, { col: [60, 24] }); this.prop('p_stretcher', 1080, 1480, { col: [80, 26] });
      this.prop('x_plant', 1930, 930, { col: [50, 20] }); this.prop('x_cone', 1880, 1420, {}); this.prop('x_sign', 800, 1640, {});
      this.prop('x_barrels', 1660, 1950, { col: [60, 24] }); this.prop('x_cone', 1225, 2125, {});
      this.prop('p_wheelchair', 2560, 1500, { col: [50, 22] }); this.prop('x_barrier', 2560, 1100, { col: [100, 20] });
      this.prop('p_plantcrate', 200, 960, { col: [44, 20] }); this.prop('x_barrels', 200, 1440, { col: [60, 24] });
      const cam = this.add.image(1520, 716, 'env', 'x_camera').setScale(0.5).setDepth(800);
      this.tweens.add({ targets: cam, angle: { from: -18, to: 18 }, duration: 3000, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }
    this.prop('console', 840, 1060, { col: [130, 40] });
    this.prop('optable', 1700, 1300, { col: [170, 50] });
    this.prop('jar', 1180, 880, { col: [36, 20] }); this.prop('jar', 1222, 884, { col: [36, 20] }); this.prop('jar', 1540, 882, { col: [36, 20] });
    this.prop('rack', 790, 905, { col: [60, 30] });
    this.prop('crate', 1860, 1690, { col: [70, 40] }); this.prop('crate', 1930, 1690, { col: [70, 40] });
    if (env) this.prop('t_glow', 1360, 600, { depth: -930, scale: 1.3 });
    // link console (centre)
    this.prop('holo_table', 1360, 1300, { col: [230, 80] });
    this.consoleGlow = this.add.image(1360, 1165, 'light').setScale(0.9, 1.5).setTint(0xff5c84).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.3).setDepth(1301);
    this.tweens.add({ targets: this.consoleGlow, alpha: 0.12, duration: 1400, yoyo: true, repeat: -1 });
    T(this, 1360, 1330, 'MUSCLE LINK CONSOLE', 12, '#ff9fb6', { display: true }).setOrigin(0.5).setDepth(1302).setAlpha(0.85);
    this.addInter({
      id: 'link', x: 1360, y: 1300, r: 150, icon: 'bone',
      label: () => G.run.flags.linked ? '근육 연결 콘솔 (복구 완료)' : '근육 연결 콘솔 · 이는곳과 닿는곳',
      locked: () => G.run.flags.linked ? '이미 연결을 복구했습니다.'
        : !G.run.flags.atlas ? '근육 지도 데이터가 없습니다. 먼저 근육 표본실(M-02)에서 근육 지도를 복원하세요.'
        : G.run.items.length < this.needed.length ? `근육 데이터 코어가 부족합니다 (${G.run.items.length}/${this.needed.length}). 연구실 곳곳의 장치를 조사하세요.` : null,
      act: () => this.openPuzzle('Link'),
    });
    // ---- M-02 specimen room ----
    this.prop('xray_box', 400, 990, { col: [210, 40] });
    this.addInter({
      id: 'atlas', x: 400, y: 1000, r: 140, icon: 'eye',
      label: () => G.run.flags.atlas ? '근육 지도 판독기 (복원 완료)' : '근육 지도 판독기',
      locked: () => G.run.flags.atlas ? '이미 복원한 근육 지도입니다.' : null,
      act: () => this.openPuzzle('Atlas'),
    });
    this.locker = this.prop('cabinet', 640, 1010, { col: [86, 30] });
    this.prop('rack', 210, 1000, { col: [60, 30] });
    this.specimenCapsule('supraspinatus', 260, 1250); this.specimenCapsule('triceps', 560, 1250);
    this.anatomyPanel(440, 704);
    // ---- M-04 stimulator control ----
    this.prop('breaker', 1060, 1870, { col: [80, 24] });
    this.prop('rack', 940, 1858, { col: [60, 30] }); this.prop('console_red', 1500, 1900, { col: [130, 40] });
    this.stimulator(1260, 1900); this.stimulator(1620, 2150);
    this.addInter({
      id: 'lever', x: 1060, y: 1880, r: 110, icon: 'bolt',
      label: () => G.run.flags.stabilized ? '전기자극 장치 (안정화됨)' : '전기자극 방전 레버',
      locked: () => G.run.flags.stabilized ? '이미 방전을 마쳤습니다.' : !G.run.flags.overload ? '전기자극 장치: 대기 상태. 지금은 조작할 필요가 없습니다.' : null,
      act: () => this.discharge(),
    });
    // ---- M-03 motion room ----
    this.prop('joint_rig', 2320, 1250, { col: [180, 60] });
    this.prop('rack', 2580, 1000, { col: [60, 30] }); this.prop('p_techbox', 2100, 1000, { col: [70, 26] });
    this.contractionRig('biceps', 2100, 1420); this.contractionRig('deltoid', 2540, 1300);
    this.anatomyPanel(2420, 854);
    this.addInter({
      id: 'motion', x: 2320, y: 1250, r: 140, icon: 'rotate',
      label: () => G.run.flags.motion ? '운동 재현 장치 (검증 완료)' : '운동 재현 장치',
      locked: () => G.run.flags.motion ? '이미 운동 재현을 마쳤습니다.' : null,
      act: () => this.openPuzzle('Motion'),
    });
    // motion room door (sealed until the stimulator is discharged)
    this.motionDoor = this.textures.exists('env') && this.textures.get('env').has('d_side_closed')
      ? this.add.image(1978, 1342, 'env', 'd_side_closed').setOrigin(0.5, 1).setScale(0.5).setDepth(1342)
      : this.add.image(1978, 1340, 'door_v').setOrigin(0.5, 1).setScale(0.5, 0.5 * 160 / 180).setDepth(1340);
    this.motionDoorBlock = this.solid(1960, 1180, 36, 160);
    this.addInter({
      id: 'mdoor', x: 1930, y: 1260, r: 90, icon: 'lock',
      enabled: () => !G.run.flags.stabilized,
      label: () => '운동 재현실 출입문',
      locked: () => G.run.flags.overload ? '전기자극 과부하로 문이 잠겨 있습니다. 자극 제어실(M-04)에서 방전하세요.' : '격벽 잠금 상태. 근육 연결이 복구되어야 전력이 공급됩니다.',
      act: () => { /* locked only */ },
    });
    this.addInter({
      id: 'gate', x: 1360, y: 840, r: 130, icon: 'lock',
      enabled: () => !G.run.flags.gate,
      label: () => '탈출 게이트 · 코어 인증',
      locked: () => { const f = G.run.flags; const n = [f.atlas, f.linked, f.motion].filter(Boolean).length; return n < 3 ? `게이트 잠금 ${n}/3 해제됨. 근육 지도 · 이는곳과 닿는곳 · 운동 재현을 모두 완료해야 합니다.` : null; },
      act: () => this.openGate(),
    });
    // research logs
    const logs: [string, number, number, string][] = [['log_4', 560, 1000, '근육 연결실 운영 단말기'], ['log_5', 1470, 912, 'MERIDIAN 로그 단말기'], ['log_6', 1620, 2250, '자극 제어 매뉴얼']];
    for (const [id, x, y, name] of logs) { this.prop('terminal', x, y, { col: [40, 20] }); if (id === 'log_6') continue; this.addInter({ id, x, y, r: 85, icon: 'info', label: () => name, act: () => this.readLog(id) }); }
    // v0.10: every data core is behind an escape-room device (buildEscape2)
    this.buildEscape2();
    // hazards: permanent ones in M-04/M-02 and overload-only arcs across the hub
    this.addHazard('steam', 1150, 2170, 66, 3.6, 1.1, 1.1);
    this.addHazard('spark', 1360, 2200, 62, 2.6, 0.7, 0.4);
    this.addHazard('steam', 560, 1390, 64, 4.4, 1.2, 0.5);
    const ov = () => !!G.run.flags.overload && !G.run.flags.stabilized;
    this.addHazard('spark', 1120, 1500, 66, 2.2, 0.8, 0.0, ov);
    this.addHazard('spark', 1600, 1500, 66, 2.2, 0.8, 1.1, ov);
    this.addHazard('spark', 1320, 1760, 60, 1.9, 0.7, 0.6, ov);
  }

  coreSprite(id: MuscleId, x: number, y: number) {
    const c = this.add.container(x, y).setDepth(y);
    const glow = this.add.image(0, -10, 'light').setScale(0.55).setTint(0xff5c84).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.5);
    const mt = makeMuscleTexture(this, id, 'real');
    const img = this.add.image(0, -16, mt.key);
    img.setScale(64 / Math.max(img.width, img.height));
    const ring = this.add.image(0, 0, 'ring').setScale(0.22, 0.08).setTint(0xff5c84).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.7);
    c.add([ring, glow, img]);
    this.tweens.add({ targets: img, y: -24, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.tweens.add({ targets: glow, alpha: 0.25, duration: 900, yoyo: true, repeat: -1 });
    this.coresInWorld[id] = c;
    return c;
  }

  /** v0.10: clue objects + devices (InvMuscleScene); each core sits behind a device whose clue is in another room */
  buildEscape2() {
    const has = (c: string) => G.run.clues.includes(c), got = (m: MuscleId) => G.run.items.includes(m);
    const adv = G.run.difficulty === 'adv';
    const spot = (id: string, kind: string, x: number, y: number, r: number, label: () => string, todo: () => boolean, glint: [number, number]) => {
      this.addInter({ id, x, y, r, icon: 'eye', label, act: () => this.openInvestigate(kind) });
      this.escSpots.push({ x, y, todo });
      const g = this.add.image(glint[0], glint[1], 'light').setTint(0xffd0e0).setBlendMode(Phaser.BlendModes.ADD).setScale(0.08).setAlpha(0).setDepth(5100);
      this.tweens.add({ targets: g, alpha: 0.9, scale: 0.16, duration: 450, yoyo: true, repeat: -1, repeatDelay: 2200, delay: Math.random() * 1500 });
    };
    // M-02: lab notes (desk) -> biceps locker (+ coracobrachialis in advanced); deltoid light box
    this.add.image(330, 1150, 'w_desk').setOrigin(0.5, 1).setScale(0.5).setDepth(1150); this.solid(330 - 80, 1150 - 42, 160, 42);
    spot('inv2_notes', 'notes', 330, 1175, 90, () => '해부 실습 노트 조사', () => !got('biceps') && !has('m_notes'), [300, 1090]);
    const lockerTodo = () => (!got('biceps') || (adv && !got('coracobrachialis')));
    spot('inv2_locker', 'locker2', 640, 1050, 85, () => lockerTodo() ? '표본 보관함 S-B2 조사' : '표본 보관함 (비어 있음)', () => lockerTodo() && has('m_notes'), [640, 930]);
    this.prop('xray_box', 470, 1430, { col: [90, 26] });
    spot('inv2_light', 'lightbox', 470, 1440, 85, () => got('deltoid') ? '라이트박스 (비어 있음)' : '표본 라이트박스 S-D1 조사', () => !got('deltoid') && has('m_chart'), [470, 1340]);
    // M-01 hub: movement chart (wall), memo (trolley), dissection table
    this.add.image(1000, 792, 'w_poster').setOrigin(0.5, 1).setScale(0.62).setDepth(800);
    spot('inv2_chart', 'chart', 1000, 850, 80, () => '어깨 움직임 차트 조사', () => !got('deltoid') && !has('m_chart'), [1020, 750]);
    spot('inv2_memo', 'memo', 1560, 1490, 75, () => '트롤리 위 메모 조사', () => !got('brachialis') && !has('m_memo'), [1560, 1400]);
    spot('inv2_dissect', 'dissect', 1700, 1340, 95, () => got('brachialis') ? '해부대 (숨은 칸 비어 있음)' : '해부대 조사', () => !got('brachialis') && has('m_memo'), [1700, 1240]);
    // M-04: rig manual (terminal) -> elbow rig (+ brachioradialis in advanced)
    spot('inv2_manual', 'manual2', 1620, 2250, 85, () => '팔꿈치 모형 정비 매뉴얼', () => !got('triceps') && !has('m_manual'), [1620, 2180]);
    const rigTodo = () => (!got('triceps') || (adv && !got('brachioradialis')));
    if (this.textures.exists('env') && this.textures.get('env').has('p_joint_rig')) this.prop('p_joint_rig', 1440, 2060, { col: [110, 30] }); else this.prop('joint_rig', 1440, 2060, { col: [110, 30] });
    spot('inv2_rig', 'rig', 1440, 2095, 90, () => rigTodo() ? '팔꿈치 운동 모형 조사' : '팔꿈치 운동 모형 (비어 있음)', () => rigTodo() && has('m_manual'), [1440, 1960]);
  }

  /** a core taken in an investigation view */
  onInvestigateFound(id: string) {
    this.scene.resume(); this.scene.wake('HUD'); this.busy = false; this.player.frozen = false;
    this.pickCore(id as MuscleId);
  }

  openBox(id: MuscleId, via: 'locker' | 'capsule') {
    const it = this.inter.find(i => i.id === `${via}_${id}`)!;
    this.player.play('interact', it.x - this.player.x, it.y - this.player.y);
    Audio.play('open');
    it.gone = true; it.marker?.setVisible(false);
    if (via === 'locker' && this.textures.exists('env') && this.textures.get('env').has('p_locker_open')) this.locker.setFrame('p_locker_open');
    this.toast(via === 'locker' ? '보관함 잠금 해제 — 근육 데이터 코어 발견!' : '캡슐 잔해 속에서 데이터 코어 발견!', 'ok');
    const s = CORE_SPOTS[id];
    const c = this.coreSprite(id, s.x, s.y + (via === 'locker' ? 50 : 60));
    c.setScale(0.2); this.tweens.add({ targets: c, scale: 1, duration: 400, ease: 'Back.out' });
    this.addInter({ id: `core_${id}`, x: c.x, y: c.y, r: 90, icon: 'hand', label: () => '근육 데이터 코어 회수', act: () => this.pickCore(id) });
  }

  pickCore(id: MuscleId) {
    const run = G.run; if (run.items.includes(id)) return;
    const it = this.inter.find(i => i.id === `core_${id}`); if (it) { it.gone = true; it.marker?.setVisible(false); }
    const c = this.coresInWorld[id];
    this.player.play('interact', (c?.x ?? 0) - this.player.x, (c?.y ?? 0) - this.player.y);
    if (c) this.tweens.add({ targets: c, x: this.player.x, y: this.player.y - 100, scale: 0.3, alpha: 0, duration: 380, ease: 'Cubic.in', onComplete: () => c.destroy() });
    run.items.push(id); unlock(`mus_${id}`);
    Audio.play('pickup'); this.player.burst(0xff5c84, 22);
    const M = MUSCLES[id];
    Bus.emit('pickup', id);
    this.toast(`${M.ko} (${M.en}) 데이터 코어 획득 — ${run.items.length}/${this.needed.length}`, 'ok');
    Bus.emit('mission');
    if (run.items.length === this.needed.length) this.time.delayedCall(900, () => this.ai(G.run.flags.atlas ? '모든 코어 회수. 근육 연결 콘솔(M-01)로 이동하십시오.' : '모든 코어 회수. 근육 표본실(M-02)에서 근육 지도를 먼저 복원하십시오.', 'ok'));
  }

  // ---------------- story ----------------
  intro() {
    this.busy = true; this.player.frozen = true;
    Audio.alarm(true);
    this.tweens.add({ targets: this.redWash, fillAlpha: 0.1, duration: 700, yoyo: true, repeat: 3 });
    this.cameras.main.shake(500, 0.003);
    const n = this.needed.length;
    const seq: [number, () => void][] = [
      [600, () => { Audio.play('glitch'); this.ai('하부 연구동 B2 도착. 근육 연결 시스템 오류 감지.', 'warn', 3200); }],
      [3800, () => this.ai('근육 연결 데이터 손상: 수축 신호가 관절까지 전달되지 않습니다.', 'ai', 3600)],
      [7600, () => { this.ai(`근육 지도(M-02)를 복원하고, 잠긴 장치 속 데이터 코어 ${n}개를 회수해 연결 콘솔(M-01)에서 이는곳과 닿는곳을 재연결하십시오. 반짝이는 물건은 조사할 수 있습니다.`, 'ai', 5600); Audio.alarm(false); }],
      [9400, () => {
        this.busy = false; this.player.frozen = false; G.run.flags.intro = true; Bus.emit('mission');
        this.toast('CHAPTER 2 · 근육 연결실', 'info');
        Audio.setMusic(this.bgm());
      }],
    ];
    for (const [t, fn] of seq) this.time.delayedCall(t, fn);
  }

  missions(): Mission[] {
    const f = G.run.flags, n = G.run.items.length, N = this.needed.length;
    const list: Mission[] = [
      { text: '근육 지도 판독 · M-02', done: !!f.atlas, active: !f.atlas, tag: 'LOCK 1' },
      ...this.needed.map(id => { const has = G.run.items.includes(id); return { text: has ? `${MUSCLES[id].ko} 코어 회수` : `${MUSCLES[id].ko} 코어 · ${CORE_WHERE[id]}`, done: has, active: !has }; }),
      { text: '이는곳·닿는곳 연결 · M-01', done: !!f.linked, active: !!f.atlas && n >= N && !f.linked, tag: 'LOCK 2' },
    ];
    if (f.overload || f.stabilized) list.push({ text: '자극 과부하 방전 · M-04', done: !!f.stabilized, active: !!f.overload && !f.stabilized });
    list.push({ text: '운동 재현 · M-03', done: !!f.motion, active: !!f.stabilized && !f.motion, tag: 'LOCK 3' });
    list.push({ text: '게이트 개방 · 승강기 탑승', done: !!f.escaped, active: !!(f.atlas && f.linked && f.motion) && !f.escaped });
    return list;
  }

  objective(): { x: number; y: number } | null {
    const f = G.run.flags;
    if (!f.atlas) return { x: 400, y: 1000 };
    if (G.run.items.length < this.needed.length) {
      let best: { x: number; y: number } | null = null, bd = 1e9;
      for (const e of this.escSpots) {
        if (!e.todo()) continue;
        const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y);
        if (d < bd) { bd = d; best = e; }
      }
      return best;
    }
    if (!f.linked) return { x: 1360, y: 1300 };
    if (f.overload && !f.stabilized) return { x: 1060, y: 1880 };
    if (!f.motion) return { x: 2320, y: 1250 };
    if (!f.gate) return { x: 1360, y: 840 };
    if (!f.escaped) return { x: 1360, y: 540 };
    return null;
  }

  onPuzzleDone(id: string) {
    const f = G.run.flags;
    this.scene.resume(); this.scene.wake('HUD'); this.busy = false; this.player.frozen = false;
    const learn = (c: string) => { unlock(c); if (!G.run.learned.includes(c)) G.run.learned.push(c); };
    if (id === 'Atlas') {
      f.atlas = true; learn('c_mmap'); this.setLock(0);
      this.ai(G.run.items.length < this.needed.length ? '근육 지도 복원. 게이트 잠금 1 해제. 남은 데이터 코어를 회수하십시오.' : '근육 지도 복원. 게이트 잠금 1 해제. 연결 콘솔(M-01)로 이동하십시오.', 'ok', 4400);
    } else if (id === 'Link') {
      f.linked = true; learn('c_origin'); this.setLock(1);
      this.consoleGlow.setTint(0x3dffa2);
      this.time.delayedCall(1600, () => this.startOverload());
    } else if (id === 'Motion') {
      f.motion = true; learn('c_agonist'); this.setLock(2);
      this.ai('운동 재현 검증 완료. 게이트 잠금 3 해제.', 'ok');
    }
    Bus.emit('mission');
    if (f.atlas && f.linked && f.motion && !f.gate) this.time.delayedCall(2600, () => { this.ai('근육 시스템 복구 완료. 탈출 게이트에서 코어 인증을 실행하십시오.', 'ok', 5000); Audio.play('unlock'); });
  }

  applyResume() {
    const f = G.run.flags;
    f.intro = true; this.busy = false; this.player.frozen = false;
    if (G.run.cp) this.player.pb.reset(G.run.cp.x, G.run.cp.y);
    if (f.atlas) this.setLockQuiet(0);
    if (f.linked) this.setLockQuiet(1);
    if (f.motion) this.setLockQuiet(2);
    if (f.stabilized) this.openDoorInstant(this.motionDoor, this.motionDoorBlock, 150);
    if (f.gate) this.openGateInstant();
    Audio.setMusic(this.bgm());
    if (f.overload && !f.stabilized) this.time.delayedCall(800, () => this.startOverload());
    this.cameras.main.fadeIn(600, 0, 0, 0);
    this.toast('저장된 지점에서 이어합니다', 'info');
    Bus.emit('mission');
  }

  startOverload() {
    const f = G.run.flags; f.overload = true;
    Audio.play('powerdown'); Audio.alarm(true); Audio.setMusic('tension');
    this.cameras.main.shake(800, 0.006);
    this.overloadLeft = OVERLOAD_TIME;
    this.ai('경고: 근육 신호 재연결 중 전기자극 장치 과부하. 바닥 전극 방전 중!', 'warn', 3800);
    this.time.delayedCall(4000, () => this.ai(`잔류 전하 ${OVERLOAD_TIME}초 내 방전 필요. 자극 제어실(M-04)의 방전 레버를 당기십시오.`, 'warn', 4800));
    Bus.emit('mission'); Bus.emit('blackout', true);
  }

  discharge() {
    if (this.busy) return;
    this.busy = true; this.player.frozen = true;
    this.player.play('interact', 0, -1);
    Bus.emit('channel', { label: '잔류 전하 방전 중…', dur: 1800 });
    let n = 0;
    const ev = this.time.addEvent({ delay: 300, repeat: 5, callback: () => { n++; Audio.play('hold'); this.sparks.emitParticleAt(1060 + Phaser.Math.Between(-20, 20), 1830, 4); if (n === 6) ev.remove(); } });
    this.time.delayedCall(1900, () => {
      const f = G.run.flags; f.stabilized = true; f.overload = false;
      this.busy = false; this.player.frozen = false;
      Audio.play('powerup'); Audio.alarm(false); Audio.setMusic(this.bgm()); Audio.heartbeat(false);
      this.overloadLeft = 0; this.redWash.fillAlpha = 0;
      this.time.delayedCall(900, () => {
        Audio.play('door');
        this.tweens.add({ targets: this.motionDoor, y: this.motionDoor.y - 150, alpha: 0.2, duration: 1100, ease: 'Cubic.inOut' });
        (this.motionDoorBlock.body as Phaser.Physics.Arcade.StaticBody).enable = false;
      });
      this.ai('전기자극 장치 안정화. 운동 재현실(M-03) 출입문 개방.', 'ok', 4400);
      Bus.emit('mission'); Bus.emit('blackout', false);
    });
  }

  tickChapter(dt: number) {
    const f = G.run.flags;
    if (f.overload && !f.stabilized && !this.busy) {
      const prev = this.overloadLeft;
      this.overloadLeft -= dt;
      if (prev > 20 && this.overloadLeft <= 20) { Audio.heartbeat(true, 1.4); this.ai('잔류 전하 20초!', 'warn', 2500); }
      if (this.overloadLeft <= 0) {
        this.overloadLeft = OVERLOAD_TIME; G.run.mistakes++;
        Audio.heartbeat(false); Audio.play('glitch');
        this.cameras.main.flash(400, 255, 30, 60);
        this.ai('방전 실패 — 예비 차단기가 작동했습니다. 잔류 전하 타이머 재설정.', 'warn', 4200);
      }
      Bus.emit('timer', this.overloadLeft);
    }
    if (f.overload && !f.stabilized) this.redWash.fillAlpha = 0.04 + 0.05 * Math.max(0, Math.sin(this.time.now / 1000 * 5));
  }

  lightRadius() { return 300; }
  timerLabel() { return '잔류 전하'; }
  chapterName() { return '근육 연결실'; }
  locksOpen() { const f = G.run.flags; return [f.atlas, f.linked, f.motion].filter(Boolean).length; }
  floorName() { return 'BODY LAB · B2'; }
  roomLocked(id: string) { const f = G.run.flags; return (id === 'mmot' && !f.stabilized) || (id === 'lift' && !f.gate); }

  invTitle() { return '근육 데이터 코어'; }
  invTotal() { return this.needed.length; }
  invIcon(): IconName { return 'bolt'; }
  invItems(): InvItem[] {
    return G.run.items.map(id => {
      const M = MUSCLES[id as MuscleId];
      return { id, tex: makeMuscleTexture(this, id as MuscleId, 'real').key, title: M.ko, en: M.en, info: `이는곳: ${M.originText}\n닿는곳: ${M.insertionText}\n작용: ${M.action}\n신경: ${M.nerve}`, tag: '분류: 어깨·위팔 근육' };
    });
  }
}
