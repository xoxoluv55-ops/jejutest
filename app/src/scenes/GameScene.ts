import Phaser from 'phaser';
import { View, viewEvents } from '../core/view';
import { Audio } from '../core/audio';
import { Save, unlock } from '../core/save';
import { G, Bus } from '../game/state';
import { Pad } from '../game/input';
import { Player } from '../game/Player';
import { Lighting } from '../game/Lighting';
import { ROOMS, PASSAGES, HWALLS, VWALLS, WALL_CAP, WALL_FACE, WORLD, LIGHTS } from '../data/map';
import { BONES, BoneId } from '../data/anatomy';
import { T } from '../ui/widgets';
import type { IconName } from '../ui/widgets';

export interface Interactable {
  id: string; x: number; y: number; r: number;
  label: () => string; icon?: IconName;
  hidden?: boolean;            // revealed by SCAN
  enabled?: () => boolean;
  locked?: () => string | null; // returns reason if locked
  act: () => void;
  marker?: Phaser.GameObjects.Image;
  gone?: boolean;
}

export interface Mission { text: string; done: boolean; active: boolean; tag?: string }

const BONE_SPOTS: Record<BoneId, { x: number; y: number; hidden?: boolean; via?: 'cabinet' | 'capsule' }> = {
  fibula: { x: 560, y: 1500 },
  scapula: { x: 420, y: 1262, hidden: true, via: 'cabinet' },
  clavicle: { x: 1630, y: 1330 },
  humerus: { x: 1040, y: 905, via: 'capsule' },
  ulna: { x: 1918, y: 1640, hidden: true },
  radius: { x: 1060, y: 2220 },
};

export class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }
  player!: Player;
  light!: Lighting;
  walls!: Phaser.Physics.Arcade.StaticGroup;
  inter: Interactable[] = [];
  focus: Interactable | null = null;
  keys!: Record<string, Phaser.Input.Keyboard.Key>;
  hazards: { x: number; y: number; r: number; kind: 'spark' | 'steam'; period: number; on: number; phase: number; fx?: Phaser.GameObjects.Particles.ParticleEmitter; warned?: boolean; active?: boolean }[] = [];
  gateL!: Phaser.GameObjects.Image; gateR!: Phaser.GameObjects.Image;
  gateBlock!: Phaser.GameObjects.Zone;
  xrayDoor!: Phaser.GameObjects.Image; xrayDoorBlock!: Phaser.GameObjects.Zone;
  locks: Phaser.GameObjects.Image[] = [];
  dust!: Phaser.GameObjects.Particles.ParticleEmitter;
  dustZone = new Phaser.Geom.Rectangle(0, 0, 100, 100);
  sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  steam!: Phaser.GameObjects.Particles.ParticleEmitter;
  ringFx!: Phaser.GameObjects.Image;
  scanCd = 0;
  busy = false;              // cinematic / puzzle open
  blackoutLeft = 0;
  worldZoom = 1.08;
  bonesInWorld: Partial<Record<BoneId, Phaser.GameObjects.Container>> = {};
  cabinet!: Phaser.GameObjects.Image; capsuleB!: Phaser.GameObjects.Image;
  cabinetOpen = false; capsuleOpen = false;
  redWash!: Phaser.GameObjects.Rectangle;
  holoProj!: Phaser.GameObjects.Image;
  holoSkel: Phaser.GameObjects.Image[] = [];
  private onResize = () => this.fitCam();

  create() {
    const run = G.run;
    run.startTime = this.time.now;
    this.inter = []; this.hazards = []; this.locks = []; this.holoSkel = []; this.bonesInWorld = {};
    this.busy = false; this.cabinetOpen = false; this.capsuleOpen = false; this.blackoutLeft = 0; this.focus = null;
    this.physics.world.setBounds(WORLD.x, WORLD.y, WORLD.w, WORLD.h);
    this.cameras.main.setBackgroundColor('#020308');
    this.fitCam();
    viewEvents.on('resize', this.onResize);
    this.events.once('shutdown', () => { viewEvents.off('resize', this.onResize); Bus.removeAllListeners(); Audio.alarm(false); Audio.heartbeat(false); });

    this.walls = this.physics.add.staticGroup();
    this.buildFloors();
    this.buildWalls();
    this.buildProps();
    this.buildDoors();
    this.buildBones();
    this.buildStations();
    this.buildHazards();
    this.buildFx();

    this.player = new Player(this, 300, 1420, run.color);
    this.physics.add.collider(this.player.phys, this.walls);
    this.light = new Lighting(this, LIGHTS);
    this.cameras.main.startFollow(this.player.root, true, 0.12, 0.12, 0, 40);
    this.cameras.main.setBounds(WORLD.x - 200, WORLD.y - 200, WORLD.w + 400, WORLD.h + 400);

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT,E,SPACE,TAB,M,ESC,ENTER') as any;
    kb.addCapture('TAB,SPACE,UP,DOWN,LEFT,RIGHT');
    kb.on('keydown-E', () => this.tryInteract());
    kb.on('keydown-ENTER', () => this.tryInteract());
    kb.on('keydown-SPACE', () => this.scan());
    kb.on('keydown-TAB', () => Bus.emit('ui:inventory'));
    kb.on('keydown-M', () => Bus.emit('ui:map'));
    kb.on('keydown-ESC', () => Bus.emit('ui:pause'));

    Bus.on('input:interact', () => this.tryInteract(), this);
    Bus.on('input:scan', () => this.scan(), this);
    Bus.on('puzzle:done', (id: string) => this.onPuzzleDone(id), this);
    Bus.on('puzzle:closed', () => { this.busy = false; this.player.frozen = false; this.scene.resume(); this.scene.wake('HUD'); }, this);
    Bus.on('game:quit', () => { this.scene.stop('HUD'); this.scene.start('Title'); }, this);

    this.scene.launch('HUD');
    this.cameras.main.fadeIn(1200, 0, 0, 0);
    this.intro();
  }

  fitCam() {
    const cam = this.cameras.main;
    cam.setSize(Math.round(View.cssW * View.dpr), Math.round(View.cssH * View.dpr));
    cam.setZoom(View.k * this.worldZoom * (View.H > View.W ? 0.9 : 1));
    this.light?.resize();
  }

  // ---------------------------------------------------------------- world building
  buildFloors() {
    const all = [...ROOMS, ...PASSAGES];
    for (const r of all) {
      this.add.tileSprite(r.x, r.y, r.w, r.h, r.floor).setOrigin(0).setTileScale(0.5).setDepth(-1000);
    }
    // ambient occlusion strips under wall faces and along vertical walls
    const ao = this.add.graphics().setDepth(-900);
    for (const w of HWALLS) if (w.face) { ao.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.55, 0.55, 0, 0); ao.fillRect(w.x, w.y + WALL_CAP + WALL_FACE, w.w, 46); }
    for (const w of HWALLS) if (!w.face) { ao.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.5, 0.5); ao.fillRect(w.x, w.y - 40, w.w, 40); }
    for (const v of VWALLS) {
      ao.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0.45, 0, 0.45); ao.fillRect(v.x - 34, v.y, 34, v.h);
      ao.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.45, 0, 0.45, 0); ao.fillRect(v.x + WALL_CAP, v.y, 34, v.h);
    }
    // decals
    this.add.image(1360, 1560, 'decal_text').setDepth(-950).setAlpha(0.9);
    this.add.image(1000, 1500, 'puddle').setDepth(-950);
    this.add.image(2240, 1220, 'puddle').setDepth(-950).setScale(0.8);
    this.add.image(1150, 1640, 'cables').setDepth(-940).setAlpha(0.9);
    this.add.image(540, 1500, 'cables').setDepth(-940).setAlpha(0.8).setAngle(8);
    this.add.image(1360, 790, 'decal_hazard').setDepth(-940).setScale(0.9, 0.7);
    this.add.image(1320, 1860, 'decal_hazard').setDepth(-940).setScale(0.8, 0.6);
    this.add.image(2400, 1030, 'cables').setDepth(-940).setAngle(-12).setAlpha(0.7);
  }

  solid(x: number, y: number, w: number, h: number) {
    const z = this.add.zone(x + w / 2, y + h / 2, w, h);
    this.physics.add.existing(z, true);
    this.walls.add(z);
    return z;
  }

  buildWalls() {
    for (const w of HWALLS) {
      const bottom = w.y + WALL_CAP + (w.face ? WALL_FACE : 0);
      this.add.tileSprite(w.x, w.y, w.w, WALL_CAP, 'wall_top').setOrigin(0).setTileScale(0.5).setDepth(bottom);
      if (w.face) {
        this.add.tileSprite(w.x, w.y + WALL_CAP, w.w, WALL_FACE, 'wall_face').setOrigin(0).setTileScale(0.5).setDepth(bottom - 1);
        this.add.tileSprite(w.x, w.y + WALL_CAP - 14, w.w, 40, 'pipes').setOrigin(0).setTileScale(0.5).setDepth(bottom).setAlpha(0.85);
      }
      const g = this.add.graphics().setDepth(bottom);
      g.lineStyle(2, 0x5a6c96, 0.45); g.lineBetween(w.x, w.y + 1, w.x + w.w, w.y + 1);
      this.solid(w.x, w.y, w.w, bottom - w.y - 12);
    }
    for (const v of VWALLS) {
      for (let y = v.y; y < v.y + v.h; y += 60) {
        const h = Math.min(60, v.y + v.h - y);
        this.add.tileSprite(v.x, y, WALL_CAP, h, 'wall_top').setOrigin(0).setTileScale(0.5).setDepth(y + h);
      }
      const g = this.add.graphics().setDepth(v.y + v.h);
      g.lineStyle(2, 0x5a6c96, 0.4); g.lineBetween(v.x + 1, v.y, v.x + 1, v.y + v.h); g.lineBetween(v.x + WALL_CAP - 1, v.y, v.x + WALL_CAP - 1, v.y + v.h);
      this.solid(v.x, v.y, WALL_CAP, v.h);
    }
  }

  prop(key: string, x: number, y: number, o: { col?: [number, number]; scale?: number; depth?: number; flip?: boolean; alpha?: number } = {}) {
    const img = this.add.image(x, y, key).setOrigin(0.5, 1).setScale((o.scale ?? 1) * 0.5).setDepth(o.depth ?? y);
    if (o.flip) img.setFlipX(true);
    if (o.alpha !== undefined) img.setAlpha(o.alpha);
    if (o.col) this.solid(x - o.col[0] / 2, y - o.col[1], o.col[0], o.col[1]);
    return img;
  }

  buildProps() {
    // --- A-01 main lab ---
    for (const [x, key] of [[900, 'capsule'], [1680, 'capsule'], [1820, 'capsule']] as [number, string][]) {
      this.prop(key, x, 905, { col: [96, 36] });
      const h = this.add.image(x, 845, 'holo_body').setOrigin(0.5, 1).setScale(0.3).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.8).setDepth(906);
      this.tweens.add({ targets: h, alpha: 0.45, duration: 1300 + x % 500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }
    this.capsuleB = this.prop('capsule_broken', 1040, 905, { col: [96, 36] });
    this.add.image(1100, 760, 'monitor_wall').setScale(0.5).setDepth(799);
    this.add.image(1620, 760, 'monitor_wall').setScale(0.5).setDepth(799);
    this.add.image(2140, 760, 'monitor_wall').setScale(0.5).setDepth(799);
    this.prop('console', 840, 1060, { col: [130, 40] });
    this.prop('console_red', 1870, 1520, { col: [130, 40] });
    this.prop('optable', 1700, 1290, { col: [170, 50] });
    this.prop('tray_fallen', 1640, 1345, {});
    this.prop('jar', 1180, 880, { col: [36, 20] }); this.prop('jar', 1222, 884, { col: [36, 20] }); this.prop('jar', 1540, 882, { col: [36, 20] });
    this.prop('crate', 1860, 1690, { col: [70, 40] }); this.prop('crate', 1930, 1690, { col: [70, 40] }); this.prop('crate', 1880, 1615, { col: [70, 40] });
    this.prop('rack', 790, 905, { col: [60, 30] });
    this.prop('vent', 820, 1380, { depth: -930 });
    const cam = this.add.image(1520, 712, 'cam').setScale(0.6).setDepth(800);
    this.tweens.add({ targets: cam, angle: { from: -18, to: 18 }, duration: 3000, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    // --- B-02 corridor ---
    this.prop('rack', 210, 1262, { col: [60, 30] });
    this.cabinet = this.prop('cabinet', 420, 1270, { col: [86, 30] });
    this.prop('crate', 700, 1540, { col: [70, 40] });
    this.prop('vent', 260, 1500, { depth: -930 });
    // --- J-03 joint bay ---
    this.prop('rack', 940, 1858, { col: [60, 30] });
    this.prop('jar', 1620, 1870, { col: [36, 20] }); this.prop('jar', 1660, 1874, { col: [36, 20] });
    this.prop('crate', 1650, 2290, { col: [70, 40] });
    this.prop('vent', 960, 2230, { depth: -930 });
    // --- X-04 x-ray room ---
    this.prop('console', 2150, 1110, { col: [130, 40] });
    this.prop('rack', 2600, 870, { col: [60, 30] }); this.prop('rack', 2530, 870, { col: [60, 30] });
    this.prop('jar', 2060, 880, { col: [36, 20] });
    // --- lift ---
    this.add.image(1360, 540, 'elevator_pad').setScale(0.5).setDepth(-930);
  }

  buildDoors() {
    // Exit gate on lab north wall
    this.add.image(1360, 800, 'gate_frame').setOrigin(0.5, 1).setScale(0.5).setDepth(801);
    this.gateL = this.add.image(1360, 797, 'gate_leaf').setOrigin(1, 1).setScale(0.5).setDepth(800);
    this.gateR = this.add.image(1360, 797, 'gate_leaf').setOrigin(1, 1).setScale(0.5).setFlipX(true).setDepth(800);
    this.gateR.setOrigin(0, 1);
    this.gateBlock = this.solid(1290, 654, 140, 134);
    for (let i = 0; i < 3; i++) {
      const l = this.add.image(1320 + i * 40, 716, 'lock_red').setScale(1.1).setDepth(802).setBlendMode(Phaser.BlendModes.ADD);
      this.locks.push(l);
      this.tweens.add({ targets: l, alpha: 0.5, duration: 500, yoyo: true, repeat: -1, delay: i * 120 });
    }
    // X-ray room sliding door (locked until power restored)
    this.xrayDoor = this.add.image(1978, 1140, 'door_v').setOrigin(0.5, 1).setScale(0.5, 0.5 * 160 / 180).setDepth(1140);
    this.xrayDoorBlock = this.solid(1960, 980, 36, 160);
  }

  boneSprite(id: BoneId, x: number, y: number) {
    const c = this.add.container(x, y).setDepth(y);
    const glow = this.add.image(0, -10, 'light').setScale(0.55).setTint(0x4fd8ff).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.5);
    const tex = `bone_bone_${id}`;
    const img = this.add.image(0, -14, tex);
    const s = 70 / Math.max(img.width, img.height) * 2;
    img.setScale(s * 0.5).setAngle(id === 'clavicle' || id === 'scapula' ? -10 : 68);
    const ring = this.add.image(0, 0, 'ring').setScale(0.22, 0.08).setTint(0x4fd8ff).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.7);
    c.add([ring, glow, img]);
    this.tweens.add({ targets: img, y: -22, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.tweens.add({ targets: glow, alpha: 0.25, duration: 900, yoyo: true, repeat: -1 });
    return c;
  }

  buildBones() {
    (Object.keys(BONE_SPOTS) as BoneId[]).forEach(id => {
      const s = BONE_SPOTS[id];
      if (s.via) {
        this.addInter({
          id: `${s.via}_${id}`, x: s.x, y: s.y + (s.via === 'cabinet' ? 20 : 40), r: 95, hidden: s.hidden, icon: 'hand',
          label: () => s.via === 'cabinet' ? '보관함 열기' : '파손된 캡슐 조사',
          act: () => this.openContainer(id, s.via!),
        });
        return;
      }
      const c = this.boneSprite(id, s.x, s.y);
      if (s.hidden) c.setVisible(false).setAlpha(0);
      this.bonesInWorld[id] = c;
      this.addInter({ id: `bone_${id}`, x: s.x, y: s.y, r: 80, hidden: s.hidden, icon: 'hand', label: () => '골격 표본 회수', act: () => this.pickupBone(id) });
    });
  }

  buildStations() {
    // central assembly table
    this.prop('holo_table', 1360, 1300, { col: [230, 80] });
    this.holoProj = this.add.image(1360, 1165, 'light').setScale(0.9, 1.5).setTint(0x3fd4ff).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.35).setDepth(1301);
    this.tweens.add({ targets: this.holoProj, alpha: 0.18, duration: 1400, yoyo: true, repeat: -1 });
    const tag = T(this, 1360, 1330, 'STRUCTURE RECOVERY TABLE', 12, '#7fdcff', { display: true }).setOrigin(0.5).setDepth(1302).setAlpha(0.8);
    tag.setShadow(0, 0, '#3fd4ff', 8, true, true);
    this.addInter({
      id: 'assembly', x: 1360, y: 1300, r: 150, icon: 'bone',
      label: () => G.run.flags.assembled ? '골격 홀로그램 (복구 완료)' : '골격 복구 테이블',
      locked: () => G.run.flags.assembled ? '이미 복구한 구조입니다.' : G.run.bones.length < 6 ? `골격 표본이 부족합니다 (${G.run.bones.length}/6). 시설 곳곳을 탐색하고 SCAN을 사용하세요.` : null,
      act: () => this.openPuzzle('Assembly'),
    });
    // joint rig (J-03)
    this.prop('joint_rig', 1480, 2010, { col: [180, 60] });
    this.addInter({
      id: 'align', x: 1480, y: 2010, r: 140, icon: 'rotate',
      label: () => G.run.flags.aligned ? '관절 보정 장치 (정렬 완료)' : '관절 보정 장치',
      locked: () => G.run.flags.aligned ? '이미 정렬이 완료되었습니다.' : !G.run.flags.assembled ? '골격 데이터가 없습니다. 먼저 골격 복구 테이블에서 골격을 조립하세요.' : !G.run.flags.power ? '전력이 차단되어 있습니다. 차단기로 보조 전원을 복구하세요.' : null,
      act: () => this.openPuzzle('Align'),
    });
    // breaker (J-03 north wall)
    this.prop('breaker', 1060, 1870, { col: [80, 24] });
    this.addInter({
      id: 'breaker', x: 1060, y: 1880, r: 110, icon: 'bolt',
      label: () => G.run.flags.power ? '보조 전원 (가동 중)' : '보조 전원 차단기',
      locked: () => G.run.flags.power ? '보조 전원이 이미 가동 중입니다.' : !G.run.flags.blackout ? '차단기 상태: 정상. 지금은 조작할 필요가 없습니다.' : null,
      act: () => this.restorePower(),
    });
    // x-ray light box (X-04)
    this.prop('xray_box', 2320, 860, { col: [210, 40] });
    this.addInter({
      id: 'xray', x: 2320, y: 870, r: 140, icon: 'eye',
      label: () => G.run.flags.xray ? 'X-ray 판독기 (판독 완료)' : 'X-ray 판독기',
      locked: () => G.run.flags.xray ? '이미 판독을 완료했습니다.' : null,
      act: () => this.openPuzzle('Xray'),
    });
    // x-ray door panel (feedback when locked)
    this.addInter({
      id: 'xdoor', x: 1930, y: 1060, r: 90, icon: 'lock',
      enabled: () => !G.run.flags.power,
      label: () => '영상 판독실 출입문',
      locked: () => G.run.flags.blackout ? '전력이 없어 문이 열리지 않습니다. 보조 전원을 복구하세요.' : '격벽 잠금 상태. 골격 복구 이후 전력 재분배가 필요합니다.',
      act: () => { /* locked only */ },
    });
    // gate
    this.addInter({
      id: 'gate', x: 1360, y: 840, r: 130, icon: 'lock',
      enabled: () => !G.run.flags.gate,
      label: () => '탈출 게이트 · 코어 인증',
      locked: () => {
        const f = G.run.flags; const n = [f.assembled, f.aligned, f.xray].filter(Boolean).length;
        return n < 3 ? `게이트 잠금 ${n}/3 해제됨. 골격 조립 · 관절면 정렬 · X-ray 판독을 모두 완료해야 합니다.` : null;
      },
      act: () => this.openGate(),
    });
    // research logs
    const logs: [string, number, number, string][] = [['log_1', 620, 1268, '연구일지 단말기'], ['log_2', 1470, 912, 'MERIDIAN 로그 단말기'], ['log_3', 1620, 2250, '프로토콜 단말기']];
    for (const [id, x, y, name] of logs) {
      this.prop('terminal', x, y, { col: [40, 20] });
      this.addInter({ id, x, y, r: 85, icon: 'info', label: () => name, act: () => this.readLog(id) });
    }
  }

  buildHazards() {
    this.sparks = this.add.particles(0, 0, 'spark', {
      lifespan: { min: 200, max: 520 }, speed: { min: 120, max: 420 }, angle: { min: 200, max: 340 }, gravityY: 900,
      scale: { start: 0.9, end: 0.2 }, alpha: { start: 1, end: 0 }, rotate: { onEmit: (_p: any, _k: any, v: number) => v } as any,
      tint: [0xffe08a, 0xffb43a, 0xffffff, 0x8fe3ff], blendMode: 'ADD', emitting: false,
    }).setDepth(6000);
    // particles should rotate along velocity
    (this.sparks as any).ops.rotate.onUpdate = (p: any) => Math.atan2(p.velocityY, p.velocityX) * 180 / Math.PI;
    this.steam = this.add.particles(0, 0, 'smoke', {
      lifespan: 1300, speedY: { min: -120, max: -60 }, speedX: { min: -30, max: 30 }, scale: { start: 0.3, end: 1.4 },
      alpha: { start: 0.45, end: 0 }, tint: 0xcfe6ff, emitting: false,
    }).setDepth(6001);
    const add = (kind: 'spark' | 'steam', x: number, y: number, r: number, period: number, on: number, phase: number) => {
      if (kind === 'spark') this.prop('spark_panel', x, y + 30, { depth: -925 });
      this.hazards.push({ kind, x, y, r, period, on, phase });
    };
    add('spark', 470, 1405, 62, 2.8, 0.75, 0);
    add('spark', 1150, 2170, 66, 2.4, 0.7, 1.1);
    add('steam', 260, 1480, 70, 4.2, 1.2, 0.5);
    add('steam', 960, 2210, 70, 3.6, 1.1, 2.0);
    add('steam', 820, 1360, 64, 5.0, 1.2, 1.4);
  }

  buildFx() {
    this.dust = this.add.particles(0, 0, 'dot', {
      lifespan: 6000, speedX: { min: -8, max: 8 }, speedY: { min: -12, max: 4 }, scale: { min: 0.04, max: 0.12 },
      alpha: { start: 0, end: 0, ease: (t: number) => Math.sin(t * Math.PI) * 0.75 } as any,
      frequency: View.quality === 'high' ? 60 : 160, blendMode: 'ADD', tint: [0xbfe6ff, 0x9fb8ff],
      emitZone: { type: 'random', source: this.dustZone as any },
    }).setDepth(8500);
    this.ringFx = this.add.image(0, 0, 'ring').setBlendMode(Phaser.BlendModes.ADD).setVisible(false).setDepth(8600);
    const v = this.add.image(0, 0, 'vignette').setScrollFactor(0).setDepth(9500).setOrigin(0.5);
    const placeV = () => { const cam = this.cameras.main; v.setPosition(cam.width / 2, cam.height / 2); v.setDisplaySize(cam.width / cam.zoom * 1.15, cam.height / cam.zoom * 1.15); };
    placeV(); this.events.on('postupdate', placeV);
    this.redWash = this.add.rectangle(0, 0, 10, 10, 0xff1030, 0).setScrollFactor(0).setDepth(9400).setBlendMode(Phaser.BlendModes.ADD).setOrigin(0.5);
    this.events.on('postupdate', () => { const cam = this.cameras.main; this.redWash.setPosition(cam.width / 2, cam.height / 2).setSize(cam.width / cam.zoom * 1.2, cam.height / cam.zoom * 1.2); });
  }

  addInter(i: Interactable) {
    i.marker = this.add.image(i.x, i.y - 60, 'marker').setScale(0.5).setTint(0x4fd8ff).setBlendMode(Phaser.BlendModes.ADD).setDepth(8000).setAlpha(0);
    this.inter.push(i);
  }

  // ---------------------------------------------------------------- story & events
  ai(text: string, kind: 'ai' | 'warn' | 'ok' = 'ai', dur = 4200) { Bus.emit('ai', { text, kind, dur }); }
  toast(text: string, kind: 'info' | 'warn' | 'ok' | 'err' = 'info') { Bus.emit('toast', { text, kind }); }

  intro() {
    this.busy = true; this.player.frozen = true;
    Audio.alarm(true);
    this.tweens.add({ targets: this.redWash, fillAlpha: 0.12, duration: 700, yoyo: true, repeat: 5 });
    this.cameras.main.shake(600, 0.004);
    const seq: [number, () => void][] = [
      [600, () => { Audio.play('glitch'); this.ai('경고: 구조 무결성 손상. 프로토콜 LOCKDOWN 실행.', 'warn', 3200); }],
      [3800, () => this.ai('모든 격벽이 봉쇄되었습니다. 인체 구조 복구가 필요합니다.', 'ai', 3400)],
      [7400, () => { this.ai('손상된 골격 표본 6개 감지. 회수 후 복구 테이블(A-01)에서 재조립하십시오.', 'ai', 4200); Audio.alarm(false); }],
      [9000, () => {
        this.busy = false; this.player.frozen = false; G.run.flags.intro = true; Bus.emit('mission');
        this.toast(this.sys.game.device.input.touch ? '왼쪽 조이스틱으로 이동 · 오른쪽 버튼으로 조작/스캔' : '이동 WASD · 달리기 Shift · 상호작용 E · 스캔 Space', 'info');
        Audio.setMusic('ambient');
      }],
    ];
    for (const [t, fn] of seq) this.time.delayedCall(t, fn);
  }

  missions(): Mission[] {
    const f = G.run.flags, n = G.run.bones.length;
    const list: Mission[] = [
      { text: `골격 표본 회수 (${n}/6)`, done: n >= 6, active: n < 6 },
      { text: '골격 조립 · 복구 테이블', done: f.assembled, active: n >= 6 && !f.assembled, tag: 'LOCK 1' },
    ];
    if (f.blackout || f.power) list.push({ text: '보조 전원 복구 · 차단기', done: f.power, active: f.blackout && !f.power });
    list.push({ text: '관절면 정렬 · J-03', done: f.aligned, active: f.power && !f.aligned, tag: 'LOCK 2' });
    list.push({ text: 'X-ray 판독 · X-04', done: f.xray, active: f.power && !f.xray, tag: 'LOCK 3' });
    list.push({ text: '게이트 개방 · 승강기 탑승', done: f.escaped, active: f.assembled && f.aligned && f.xray && !f.escaped });
    return list;
  }

  /** Where the guidance arrow should point. */
  objective(): { x: number; y: number } | null {
    const f = G.run.flags;
    if (G.run.bones.length < 6) {
      // nearest remaining bone / container
      let best: { x: number; y: number } | null = null, bd = 1e9;
      for (const i of this.inter) {
        if (i.gone || !(i.id.startsWith('bone_') || i.id.startsWith('cabinet_') || i.id.startsWith('capsule_'))) continue;
        if (i.hidden && !Save.settings.hints) continue;
        const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, i.x, i.y);
        if (d < bd) { bd = d; best = i; }
      }
      return best;
    }
    if (!f.assembled) return { x: 1360, y: 1300 };
    if (f.blackout && !f.power) return { x: 1060, y: 1880 };
    if (!f.aligned) return { x: 1480, y: 2010 };
    if (!f.xray) return { x: 2320, y: 870 };
    if (!f.gate) return { x: 1360, y: 840 };
    if (!f.escaped) return { x: 1360, y: 540 };
    return null;
  }

  openContainer(id: BoneId, via: 'cabinet' | 'capsule') {
    const it = this.inter.find(i => i.id === `${via}_${id}`)!;
    this.player.play('interact', it.x - this.player.x, it.y - this.player.y);
    Audio.play('open');
    it.gone = true; it.marker?.setVisible(false);
    if (via === 'cabinet') { this.cabinet.setTexture('cabinet_open'); this.cabinetOpen = true; this.toast('보관함 잠금 해제 — 내부에서 표본 발견!', 'ok'); }
    else { this.capsuleOpen = true; this.toast('캡슐 잔해 속에서 표본 발견!', 'ok'); this.cameras.main.shake(150, 0.002); }
    const s = BONE_SPOTS[id];
    const c = this.boneSprite(id, s.x, s.y + (via === 'cabinet' ? 50 : 60));
    c.setScale(0.2); this.tweens.add({ targets: c, scale: 1, duration: 400, ease: 'Back.out' });
    this.bonesInWorld[id] = c;
    this.addInter({ id: `bone_${id}`, x: c.x, y: c.y, r: 90, icon: 'hand', label: () => '골격 표본 회수', act: () => this.pickupBone(id) });
  }

  pickupBone(id: BoneId) {
    const run = G.run; if (run.bones.includes(id)) return;
    const it = this.inter.find(i => i.id === `bone_${id}`); if (it) { it.gone = true; it.marker?.setVisible(false); }
    const c = this.bonesInWorld[id];
    this.player.play('interact', (c?.x ?? 0) - this.player.x, (c?.y ?? 0) - this.player.y);
    if (c) this.tweens.add({ targets: c, x: this.player.x, y: this.player.y - 100, scale: 0.3, alpha: 0, duration: 380, ease: 'Cubic.in', onComplete: () => c.destroy() });
    run.bones.push(id);
    unlock(`bone_${id}`);
    Audio.play('pickup');
    this.player.burst(0x4fd8ff, 22);
    this.player.setCarry(`bone_holo_${id}`);
    const b = BONES[id];
    Bus.emit('pickup', id);
    this.toast(`${b.ko} (${b.alt}) · ${b.en} 획득 — ${run.bones.length}/6`, 'ok');
    Bus.emit('mission');
    if (run.bones.length === 6) this.time.delayedCall(900, () => this.ai('모든 표본 회수 확인. 골격 복구 테이블(A-01)로 이동하십시오.', 'ok'));
  }

  readLog(id: string) {
    this.player.play('interact');
    Audio.play('beep');
    if (!G.run.logs.includes(id)) G.run.logs.push(id);
    unlock(id);
    this.scene.launch('Info', { mode: 'log', id, from: 'Game' });
  }

  openPuzzle(kind: 'Assembly' | 'Align' | 'Xray') {
    if (this.busy) return;
    this.busy = true; this.player.frozen = true;
    this.player.play('interact');
    Audio.play('open');
    Pad.x = Pad.y = 0; Pad.run = false;
    this.time.delayedCall(260, () => { this.scene.sleep('HUD'); this.scene.launch(kind); this.scene.pause(); });
  }

  onPuzzleDone(id: string) {
    const f = G.run.flags;
    this.scene.resume(); this.scene.wake('HUD'); this.busy = false; this.player.frozen = false;
    if (id === 'Assembly') {
      f.assembled = true; this.player.setCarry(null); unlock('c_girdle'); G.run.learned.push('c_girdle');
      this.setLock(0);
      this.showHoloSkeleton();
      this.time.delayedCall(1800, () => this.startBlackout());
    } else if (id === 'Align') {
      f.aligned = true; unlock('c_gh'); G.run.learned.push('c_gh'); this.setLock(1);
      this.ai('관절 정렬 데이터 동기화 완료. 게이트 잠금 2 해제.', 'ok');
    } else if (id === 'Xray') {
      f.xray = true; unlock('c_xray'); G.run.learned.push('c_xray'); this.setLock(2);
      this.ai('영상 판독 데이터 확인. 게이트 잠금 3 해제.', 'ok');
    }
    Bus.emit('mission');
    if (f.assembled && f.aligned && f.xray && !f.gate) this.time.delayedCall(2600, () => { this.ai('모든 구조 복구 완료. 탈출 게이트에서 코어 인증을 실행하십시오.', 'ok', 5000); Audio.play('unlock'); });
  }

  setLock(i: number) {
    const l = this.locks[i]; this.tweens.killTweensOf(l);
    l.setTexture('lock_green').setAlpha(1).setScale(2.4);
    this.tweens.add({ targets: l, scale: 1.2, duration: 500, ease: 'Back.out' });
    Audio.play('unlock');
  }

  showHoloSkeleton() {
    // Restored structure: hologram figure rises above the recovery table.
    const holo = this.add.image(1360, 1230, 'holo_body').setOrigin(0.5, 1).setScale(0.34).setBlendMode(Phaser.BlendModes.ADD).setDepth(1302).setAlpha(0);
    this.tweens.add({ targets: holo, alpha: 0.95, duration: 900 });
    this.tweens.add({ targets: holo, y: 1220, duration: 2000, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    const ring = this.add.image(1360, 1210, 'ring').setScale(0.6, 0.2).setTint(0x4fd8ff).setBlendMode(Phaser.BlendModes.ADD).setDepth(1302);
    this.tweens.add({ targets: ring, scaleX: 0.75, scaleY: 0.25, alpha: 0.4, duration: 1200, yoyo: true, repeat: -1 });
    this.holoSkel.push(holo, ring);
  }

  startBlackout() {
    const f = G.run.flags; f.blackout = true;
    Audio.play('powerdown'); Audio.alarm(true); Audio.setMusic('tension');
    this.cameras.main.shake(800, 0.006);
    this.light.setBlackout(true);
    this.holoProj.setVisible(false);
    this.blackoutLeft = 90;
    this.ai('경고: 골격 데이터 재기동 중 전력 과부하. 주 전원 차단.', 'warn', 3600);
    this.time.delayedCall(3800, () => this.ai('비상 전력 잔량 90초. 관절 보정실(J-03) 차단기로 보조 전원을 복구하십시오.', 'warn', 4800));
    Bus.emit('mission'); Bus.emit('blackout', true);
  }

  restorePower() {
    if (this.busy) return;
    this.busy = true; this.player.frozen = true;
    this.player.play('interact', 0, -1);
    Bus.emit('channel', { label: '보조 전원 재가동 중…', dur: 1800 });
    let n = 0;
    const ev = this.time.addEvent({ delay: 300, repeat: 5, callback: () => { n++; Audio.play('hold'); this.sparks.emitParticleAt(1060 + Phaser.Math.Between(-20, 20), 1830, 4); if (n === 6) ev.remove(); } });
    this.time.delayedCall(1900, () => {
      const f = G.run.flags; f.power = true; f.blackout = false;
      this.busy = false; this.player.frozen = false;
      this.light.setBlackout(false);
      this.holoProj.setVisible(true);
      Audio.play('powerup'); Audio.alarm(false); Audio.setMusic('ambient'); Audio.heartbeat(false);
      this.blackoutLeft = 0;
      // unlock x-ray door
      this.time.delayedCall(900, () => {
        Audio.play('door');
        this.tweens.add({ targets: this.xrayDoor, y: this.xrayDoor.y - 150, alpha: 0.2, duration: 1100, ease: 'Cubic.inOut' });
        (this.xrayDoorBlock.body as Phaser.Physics.Arcade.StaticBody).enable = false;
      });
      this.ai('보조 전원 가동. 관절 보정 장치와 영상 판독실이 활성화되었습니다.', 'ok', 4400);
      Bus.emit('mission'); Bus.emit('blackout', false);
    });
  }

  openGate() {
    const f = G.run.flags; if (f.gate) return;
    f.gate = true; this.busy = true; this.player.frozen = true;
    this.player.play('interact', 0, -1);
    Bus.emit('channel', { label: '코어 인증 중…', dur: 1500 });
    Audio.setMusic('none');
    this.time.delayedCall(1600, () => {
      Audio.play('unlock');
      this.cameras.main.stopFollow();
      this.cameras.main.pan(1360, 760, 900, 'Sine.inOut');
      this.locks.forEach((l, i) => this.time.delayedCall(i * 200, () => { l.setScale(2); this.tweens.add({ targets: l, scale: 1.2, duration: 300 }); Audio.play('beep'); }));
      this.time.delayedCall(1000, () => {
        Audio.play('door'); this.cameras.main.shake(1200, 0.005);
        this.tweens.add({ targets: this.gateL, x: 1360 - 70, duration: 1400, ease: 'Cubic.inOut' });
        this.tweens.add({ targets: this.gateR, x: 1360 + 70, duration: 1400, ease: 'Cubic.inOut' });
        this.steam.emitParticleAt(1300, 790, 12); this.steam.emitParticleAt(1420, 790, 12);
        const flood = this.add.image(1360, 700, 'light').setTint(0x3dffa2).setBlendMode(Phaser.BlendModes.ADD).setScale(0.2).setAlpha(0).setDepth(8700);
        this.tweens.add({ targets: flood, scale: 2.2, alpha: 0.6, duration: 1400 });
        this.light.extra.push({ x: 1360, y: 700, r: 300, a: 0.9 });
      });
      this.time.delayedCall(2600, () => {
        (this.gateBlock.body as Phaser.Physics.Arcade.StaticBody).enable = false;
        this.cameras.main.startFollow(this.player.root, true, 0.12, 0.12, 0, 40);
        this.busy = false; this.player.frozen = false;
        this.ai('게이트 개방. 승강기에 탑승하십시오.', 'ok');
        Bus.emit('mission');
        Audio.setMusic('ambient');
      });
    });
  }

  victory() {
    const f = G.run.flags; if (f.escaped) return;
    f.escaped = true; this.busy = true; this.player.frozen = true;
    G.run.elapsed = (this.time.now - G.run.startTime) / 1000;
    Bus.emit('mission'); Bus.emit('hud:hide');
    this.player.play('victory');
    Audio.play('victory');
    this.cameras.main.stopFollow();
    this.cameras.main.pan(1360, 520, 1200, 'Sine.inOut');
    this.cameras.main.zoomTo(this.cameras.main.zoom * 1.5, 1600, 'Sine.inOut');
    const beam = this.add.image(1360, 540, 'light').setTint(0x3dffa2).setBlendMode(Phaser.BlendModes.ADD).setScale(0.6, 3).setAlpha(0).setDepth(8800);
    this.tweens.add({ targets: beam, alpha: 0.9, duration: 1500, delay: 600 });
    for (let i = 0; i < 6; i++) this.time.delayedCall(400 + i * 280, () => this.player.burst([0x3dffa2, 0x4fd8ff, 0xffffff][i % 3], 26));
    this.time.delayedCall(2800, () => { this.tweens.add({ targets: this.player.root, y: this.player.root.y - 260, alpha: 0, duration: 1200, ease: 'Cubic.in' }); });
    this.time.delayedCall(3600, () => {
      this.cameras.main.fadeOut(900, 255, 255, 255);
      this.cameras.main.once('camerafadeoutcomplete', () => { this.scene.stop('HUD'); this.scene.start('Result'); });
    });
  }

  // ---------------------------------------------------------------- interaction / scan
  tryInteract() {
    if (this.busy || !G.run.flags.intro) return;
    const i = this.focus;
    if (!i) { this.toast('주변에 조작할 수 있는 대상이 없습니다.', 'info'); return; }
    const reason = i.locked?.();
    if (reason) { Audio.play('error'); this.player.play('interact', i.x - this.player.x, i.y - this.player.y); this.toast(reason, 'warn'); return; }
    i.act();
  }

  scan() {
    if (this.busy || !G.run.flags.intro || this.scanCd > 0) return;
    this.scanCd = 1.4; G.run.scans++;
    this.player.play('scan');
    Audio.play('scan');
    const px = this.player.x, py = this.player.y - 30;
    this.ringFx.setPosition(px, py).setVisible(true).setScale(0.1).setAlpha(1).setTint(0x4fd8ff);
    this.tweens.add({ targets: this.ringFx, scale: 3.2, alpha: 0, duration: 900, ease: 'Cubic.out', onComplete: () => this.ringFx.setVisible(false) });
    this.light.extra.push({ x: px, y: py, r: 400, a: 0.5 });
    this.time.delayedCall(450, () => this.light.extra.shift());
    Bus.emit('scanned');
    let found = 0;
    for (const i of this.inter) {
      if (i.gone) continue;
      const d = Phaser.Math.Distance.Between(px, py, i.x, i.y);
      if (d > 420) continue;
      if (i.hidden) {
        i.hidden = false; found++;
        this.time.delayedCall(d * 1.6, () => {
          Audio.play('reveal');
          const bone = Object.entries(this.bonesInWorld).find(([k]) => i.id === `bone_${k}`)?.[1];
          if (bone) { bone.setVisible(true); this.tweens.add({ targets: bone, alpha: 1, duration: 400 }); }
          const ping = this.add.image(i.x, i.y - 20, 'ring').setTint(0x3dffa2).setBlendMode(Phaser.BlendModes.ADD).setScale(0.05).setDepth(8600);
          this.tweens.add({ targets: ping, scale: 0.6, alpha: 0, duration: 700, onComplete: () => ping.destroy() });
        });
      } else if (i.marker) {
        this.time.delayedCall(d * 1.6, () => { i.marker!.setAlpha(1); this.tweens.add({ targets: i.marker, alpha: 0, duration: 1600, delay: 600 }); });
      }
    }
    this.time.delayedCall(700, () => this.toast(found ? `SCAN: 숨겨진 신호 ${found}개 탐지!` : 'SCAN: 주변에 숨겨진 신호 없음', found ? 'ok' : 'info'));
  }

  // ---------------------------------------------------------------- loop
  update(_t: number, dms: number) {
    const dt = Math.min(0.05, dms / 1000);
    const k = this.keys;
    let ix = Pad.x, iy = Pad.y;
    const kx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    const ky = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    if (kx || ky) { const l = Math.hypot(kx, ky); ix = kx / l; iy = ky / l; }
    const run = k.SHIFT.isDown || Pad.run;
    this.player.update(dt, this.busy ? 0 : ix, this.busy ? 0 : iy, run);
    this.scanCd = Math.max(0, this.scanCd - dt);

    // focus nearest interactable
    let best: Interactable | null = null, bd = 1e9;
    for (const i of this.inter) {
      if (i.gone || i.hidden || (i.enabled && !i.enabled())) { i.marker?.setAlpha(Math.min(i.marker.alpha, 0)); continue; }
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, i.x, i.y);
      if (d < i.r && d < bd) { bd = d; best = i; }
    }
    if (best !== this.focus) {
      if (this.focus?.marker) this.tweens.add({ targets: this.focus.marker, alpha: 0, duration: 150 });
      this.focus = best;
      if (best?.marker) { best.marker.setAlpha(1).setScale(0.8); this.tweens.add({ targets: best.marker, scale: 0.5, duration: 200 }); Audio.play('hover'); }
      Bus.emit('prompt', best ? { label: best.label(), icon: best.icon ?? 'hand', locked: !!best.locked?.() } : null);
    }
    if (this.focus?.marker) this.focus.marker.y = this.focus.y - 70 + Math.sin(this.time.now / 250) * 5;

    // hazards
    const T = this.time.now / 1000;
    for (const h of this.hazards) {
      const ph = ((T + h.phase) % h.period);
      const active = ph < h.on;
      const warn = ph > h.period - 0.5;
      const near = Phaser.Math.Distance.Between(this.player.x, this.player.y, h.x, h.y) < 700;
      if (h.kind === 'spark') {
        if (warn && near && Math.random() < 0.3) this.sparks.emitParticleAt(h.x + Phaser.Math.Between(-20, 20), h.y, 1);
        if (active && near && Math.random() < 0.8) this.sparks.emitParticleAt(h.x + Phaser.Math.Between(-30, 30), h.y + Phaser.Math.Between(-10, 10), 3);
        if (active && !h.active && near) Audio.play('zap');
      } else {
        if (active && near && Math.random() < 0.6) this.steam.emitParticleAt(h.x + Phaser.Math.Between(-20, 20), h.y, 1);
        if (active && !h.active && near) Audio.play('steam');
      }
      h.active = active;
      if (active && this.player.stun <= 0 && !this.busy) {
        const dx = this.player.x - h.x, dy = this.player.y - h.y;
        if (Math.hypot(dx, dy) < h.r) {
          this.player.play('damage', dx || 1, dy);
          Audio.play('hurt'); if (h.kind === 'spark') Audio.play('zap');
          this.cameras.main.shake(220, 0.006);
          this.cameras.main.flash(120, 255, 40, 70, false);
          G.run.mistakes++;
          this.toast(h.kind === 'spark' ? '전기 충격! 노출된 배선의 방전 주기를 피하세요.' : '고온 증기! 배출 주기를 확인하고 지나가세요.', 'err');
        }
      }
    }

    // blackout countdown
    if (G.run.flags.blackout && !G.run.flags.power && !this.busy) {
      const prev = this.blackoutLeft;
      this.blackoutLeft -= dt;
      if (prev > 20 && this.blackoutLeft <= 20) { Audio.heartbeat(true, 1.4); this.ai('비상 전력 잔량 20초!', 'warn', 2500); }
      if (this.blackoutLeft <= 0) {
        this.blackoutLeft = 90; G.run.mistakes++;
        Audio.heartbeat(false); Audio.play('glitch');
        this.cameras.main.flash(400, 255, 30, 60);
        this.ai('비상 전력 고갈 — 생명유지 예비 셀로 전환. 잔량 90초로 재설정.', 'warn', 4200);
      }
      Bus.emit('timer', this.blackoutLeft);
    }

    // lift trigger
    if (G.run.flags.gate && !G.run.flags.escaped && Phaser.Math.Distance.Between(this.player.x, this.player.y, 1360, 560) < 70) this.victory();

    // dust zone follows camera
    const v = this.cameras.main.worldView; this.dustZone.setTo(v.x, v.y, v.width, v.height);
    if (G.run.flags.blackout) this.redWash.fillAlpha = 0.05 + 0.05 * Math.max(0, Math.sin(T * 4));
    this.redWash.setVisible(this.redWash.fillAlpha > 0.003);
    this.light.update(dt, this.player.x, this.player.y, G.run.flags.blackout ? 260 : 300);
    Bus.emit('tick', { px: this.player.x, py: this.player.y, obj: Save.settings.hints ? this.objective() : null, cam: v });
  }
}
