import Phaser from 'phaser';
import { View, viewEvents } from '../core/view';
import { Audio, MusicMode } from '../core/audio';
import { Save, unlock } from '../core/save';
import { G, Bus } from '../game/state';
import { Pad } from '../game/input';
import { Player } from '../game/Player';
import { Lighting } from '../game/Lighting';
import { WALL_CAP, WALL_FACE, MAP1, ChapterMap } from '../data/map';
import { BONES, BoneId, UPPER_ORDER } from '../data/anatomy';
import { boneBounds, DENSITY } from '../art/bones';
import { T } from '../ui/widgets';
import type { IconName } from '../ui/widgets';
import { Guard, Laser, GState } from '../game/Stealth';
import { INV_SCENE, EscSpot } from '../data/escapeWorld';
import { BONE_GET, KEYCARD_AT, KEY_DOOR, GALLERY_EXIT_X, DIFF, vaultGuards, FINAL_GUARD, GALLERY_LASERS, ALARM_LASERS, FINAL_LASERS, CHECKPOINTS, CRATE_SPOTS, HIDE_SPOTS, PICKUP_HINT } from '../data/zone1';

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

export interface InvItem { id: string; tex: string; title: string; en: string; info: string; tag: string; angle?: number }

export interface Mission { text: string; done: boolean; active: boolean; tag?: string }

// Prop sizes relative to the ~86-unit-tall test unit (one consistent world scale).
const PROP_SCALE: Record<string, number> = { capsule: 1.35, capsule_broken: 1.35, rack: 1.25, cabinet: 1.2, cabinet_open: 1.2, console: 1.15, console_red: 1.15, optable: 1.15, xray_box: 1.2, joint_rig: 1.2, breaker: 1.1, terminal: 1.1, jar: 1.1 };

// Procedural key -> illustrated asset (env atlas, built by tools/build_env.py from the environment sheet).
const ENV_MAP: Record<string, string> = {
  capsule: 'p_capsule_holo', capsule_broken: 'p_capsule_broken', console: 'p_console', console_red: 'p_techbox', optable: 'p_optable',
  jar: 'p_tubes', crate: 'p_crates', rack: 'p_rack', cabinet: 'p_locker_closed', cabinet_open: 'p_locker_open', holo_table: 'p_holobed',
  joint_rig: 'p_joint_rig', breaker: 'p_breaker', xray_box: 'p_xray', terminal: 'p_terminal',
};

/** Specimens to recover: basic = the 5 bones of the upper limb skeleton; advanced adds the fibula as a decoy
 * (telling a leg bone from the two forearm bones is a distinction worth practising). */
export function neededBones(): BoneId[] {
  const arm: BoneId[] = ['clavicle', 'scapula', 'humerus', 'radius', 'ulna'];
  return G.run.difficulty === 'adv' ? [...arm, 'fibula'] : arm;
}


export class GameScene extends Phaser.Scene {
  constructor(key = 'Game') { super(key); }
  map: ChapterMap = MAP1;
  /** world objects revealed by SCAN, keyed by interactable id */
  reveal: Record<string, Phaser.GameObjects.GameObject & { setVisible(v: boolean): any; alpha: number }> = {};
  player!: Player;
  light!: Lighting;
  walls!: Phaser.Physics.Arcade.StaticGroup;
  inter: Interactable[] = [];
  focus: Interactable | null = null;
  keys!: Record<string, Phaser.Input.Keyboard.Key>;
  hazards: { x: number; y: number; r: number; kind: 'spark' | 'steam'; period: number; on: number; phase: number; fx?: Phaser.GameObjects.Particles.ParticleEmitter; warned?: boolean; active?: boolean; only?: () => boolean }[] = [];
  gateL!: Phaser.GameObjects.Image; gateR!: Phaser.GameObjects.Image; gateOpenImg?: Phaser.GameObjects.Image;
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
  // ---- survival / stealth (v0.5) ----
  /** every solid rectangle (walls + props): blocks guard sight and lasers' line of sight */
  blockers: Phaser.Geom.Rectangle[] = [];
  guards: Guard[] = []; lasers: Laser[] = [];
  invuln = 0;
  hiding: { x: number; y: number; img: Phaser.GameObjects.Image } | null = null;
  hideSpots: { x: number; y: number; img: Phaser.GameObjects.Image }[] = [];
  pickups: { id: string; x: number; y: number; obj: Phaser.GameObjects.Container | Phaser.GameObjects.Image; take: () => void; hidden?: boolean; r?: number }[] = [];
  checkpoints: { id: string; x: number; y: number; name: string; pad: Phaser.GameObjects.Image; on: boolean }[] = [];
  /** timed event in progress: L-06 alarm escape or the final escape */
  escape: { kind: 'gallery' | 'final'; left: number; total: number } | null = null;
  keyDoor?: Phaser.GameObjects.Image; keyDoorBlock?: Phaser.GameObjects.Zone;
  vaultCapsule?: Phaser.GameObjects.Image;
  scanAmp = false;
  get D() { return DIFF[G.run.difficulty]; }

  preload() {
    const c = G.run.color;
    if (!this.textures.exists(`bot_${c}`)) this.load.atlas(`bot_${c}`, `assets/atlas/bot_${c}.png`, `assets/atlas/bot_${c}.json`);
  }

  create() {
    const run = G.run;
    run.startTime = this.time.now;
    this.inter = []; this.hazards = []; this.locks = []; this.holoSkel = []; this.bonesInWorld = {}; this.reveal = {};
    this.busy = false; this.cabinetOpen = false; this.capsuleOpen = false; this.blackoutLeft = 0; this.focus = null;
    this.blockers = []; this.guards = []; this.lasers = []; this.pickups = []; this.checkpoints = []; this.hideSpots = []; this.hiding = null; this.escape = null; this.invuln = 0; this.scanAmp = false;
    run.hp = run.hp > 0 ? run.hp : 3;
    const { WORLD } = this.map;
    this.physics.world.setBounds(WORLD.x, WORLD.y, WORLD.w, WORLD.h);
    this.cameras.main.setBackgroundColor('#020308');
    this.fitCam();
    viewEvents.on('resize', this.onResize);
    this.events.once('shutdown', () => { viewEvents.off('resize', this.onResize); Bus.removeAllListeners(); Audio.alarm(false); Audio.heartbeat(false); });

    this.walls = this.physics.add.staticGroup();
    this.buildFloors();
    this.buildWalls();
    this.initHazardFx();
    this.buildContent();
    this.buildFx();

    this.player = new Player(this, this.map.spawn.x, this.map.spawn.y, run.color);
    this.physics.add.collider(this.player.phys, this.walls);
    this.light = new Lighting(this, this.map.LIGHTS);
    this.cameras.main.startFollow(this.player.root, true, 0.09, 0.09, 0, 40);
    this.cameras.main.setBounds(WORLD.x - 200, WORLD.y - 200, WORLD.w + 400, WORLD.h + 400);

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT,E,SPACE,TAB,M,ESC,ENTER') as any;
    kb.addCapture('TAB,SPACE,UP,DOWN,LEFT,RIGHT');
    kb.on('keydown-E', () => this.tryInteract());
    kb.on('keydown-ENTER', () => this.tryInteract());
    kb.on('keydown-TAB', () => Bus.emit('ui:inventory'));
    kb.on('keydown-M', () => Bus.emit('ui:map'));
    kb.on('keydown-ESC', () => Bus.emit('ui:pause'));

    Bus.on('input:interact', () => this.tryInteract(), this);
    Bus.on('puzzle:done', (id: string) => this.onPuzzleDone(id), this);
    Bus.on('investigate:found', (id: string) => this.onInvestigateFound(id), this);
    Bus.on('investigate:done', (key: string) => this.onInvestigateDone(key), this);
    Bus.on('ident:ok', (id: BoneId) => this.onIdent(id, true), this);
    Bus.on('ident:cancel', (id: BoneId) => this.onIdent(id, false), this);
    Bus.on('puzzle:closed', () => { this.busy = false; this.player.frozen = false; this.scene.resume(); this.scene.wake('HUD'); }, this);
    Bus.on('game:quit', () => { this.scene.stop('HUD'); this.scene.start('Title'); }, this);

    this.scene.launch('HUD');
    this.cameras.main.fadeIn(1200, 0, 0, 0);
    this.intro();
  }

  fitCam() {
    const cam = this.cameras.main;
    cam.setSize(Math.round(View.cssW * View.dpr), Math.round(View.cssH * View.dpr));
    // v0.5: closer camera (≈1.6x the old 1.08 on iPad landscape) so the unit and hazards read clearly;
    // short phone screens get a little less so there is still room to see what is coming
    const z = 1.72 * Phaser.Math.Clamp(View.H / 740, 0.78, 1);
    cam.setZoom(View.k * z * (View.H > View.W ? 0.9 : 1));
    this.light?.resize();
  }

  // ---------------------------------------------------------------- world building
  /** Chapter content: props, doors, pickups, stations, hazards. */
  buildContent() {
    this.buildProps();
    this.buildDoors();
    this.buildBones();
    this.buildStations();
    this.buildHazards();
    this.buildZone();
    this.buildOffice();
    this.buildEscape();
  }

  floorTint(floor: string): number { return floor === 'floor_lab' ? 0x7c88a6 : floor === 'floor_grate' ? 0x8e98b4 : 0x9094b0; }

  buildFloors() {
    const { ROOMS, PASSAGES, HWALLS, VWALLS } = this.map;
    const all = [...ROOMS, ...PASSAGES];
    for (const r of all) {
      this.add.tileSprite(r.x, r.y, r.w, r.h, r.floor).setOrigin(0).setTileScale(0.5).setDepth(-1000).setTint(this.floorTint(r.floor));
    }
    // ambient occlusion strips under wall faces and along vertical walls
    const ao = this.add.graphics().setDepth(-900);
    for (const w of HWALLS) if (w.face) { ao.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.55, 0.55, 0, 0); ao.fillRect(w.x, w.y + WALL_CAP + WALL_FACE, w.w, 46); }
    for (const w of HWALLS) if (!w.face) { ao.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.5, 0.5); ao.fillRect(w.x, w.y - 40, w.w, 40); }
    for (const v of VWALLS) {
      ao.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0.45, 0, 0.45); ao.fillRect(v.x - 34, v.y, 34, v.h);
      ao.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.45, 0, 0.45, 0); ao.fillRect(v.x + WALL_CAP, v.y, 34, v.h);
    }
    this.decals();
  }

  decals() {
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
    this.blockers.push(new Phaser.Geom.Rectangle(x, y, w, h));
    return z;
  }

  buildWalls() {
    const { HWALLS, VWALLS } = this.map;
    for (const w of HWALLS) {
      const bottom = w.y + WALL_CAP + (w.face ? WALL_FACE : 0);
      this.add.tileSprite(w.x, w.y, w.w, WALL_CAP, 'wall_top').setOrigin(0).setTileScale(0.5).setDepth(bottom).setTint(this.wallTint());
      if (w.face) {
        this.add.tileSprite(w.x, w.y + WALL_CAP, w.w, WALL_FACE, 'wall_face').setOrigin(0).setTileScale(0.5).setDepth(bottom - 1).setTint(this.wallTint());
        this.add.tileSprite(w.x, w.y + WALL_CAP - 14, w.w, 40, 'pipes').setOrigin(0).setTileScale(0.5).setDepth(bottom).setAlpha(0.85);
      }
      const g = this.add.graphics().setDepth(bottom);
      g.lineStyle(2, 0x5a6c96, 0.45); g.lineBetween(w.x, w.y + 1, w.x + w.w, w.y + 1);
      this.solid(w.x, w.y, w.w, bottom - w.y - 12);
    }
    for (const v of VWALLS) {
      for (let y = v.y; y < v.y + v.h; y += 60) {
        const h = Math.min(60, v.y + v.h - y);
        this.add.tileSprite(v.x, y, WALL_CAP, h, 'wall_top_v').setOrigin(0).setTileScale(0.5).setTilePosition(0, (y - v.y) * 2).setDepth(y + h).setTint(this.wallTint());
      }
      const g = this.add.graphics().setDepth(v.y + v.h);
      g.lineStyle(2, 0x5a6c96, 0.4); g.lineBetween(v.x + 1, v.y, v.x + 1, v.y + v.h); g.lineBetween(v.x + WALL_CAP - 1, v.y, v.x + WALL_CAP - 1, v.y + v.h);
      this.solid(v.x, v.y, WALL_CAP, v.h);
    }
  }

  /** Chapter hook: background music mode while exploring. */
  bgm(): MusicMode { return 'ambient'; }

  /** Chapter hook: multiply tint for wall tiles (CH1 = untinted). */
  wallTint(): number { return 0xffffff; }

  prop(key: string, x: number, y: number, o: { col?: [number, number]; scale?: number; depth?: number; flip?: boolean; alpha?: number } = {}) {
    const envKey = ENV_MAP[key] ?? (key.startsWith('p_') || key.startsWith('x_') || key.startsWith('d_') ? key : null);
    if (envKey && this.textures.exists('env') && this.textures.get('env').has(envKey)) {
      // illustrated asset (already in world scale; atlas density 2)
      const img = this.add.image(x, y, 'env', envKey).setOrigin(0.5, 1).setScale(0.5 * (o.scale ?? 1)).setDepth(o.depth ?? y);
      if (o.flip) img.setFlipX(true);
      if (o.alpha !== undefined) img.setAlpha(o.alpha);
      if (o.col) { const cw = Math.min(img.displayWidth * 0.85, Math.max(o.col[0], img.displayWidth * 0.6)), ch = o.col[1]; this.solid(x - cw / 2, y - ch, cw, ch); }
      return img;
    }
    const sc = o.scale ?? PROP_SCALE[key] ?? 1;
    const img = this.add.image(x, y, key).setOrigin(0.5, 1).setScale(sc * 0.5).setDepth(o.depth ?? y);
    if (o.flip) img.setFlipX(true);
    if (o.alpha !== undefined) img.setAlpha(o.alpha);
    if (o.col) { const cw = o.col[0] * sc, ch = o.col[1] * Math.min(sc, 1.15); this.solid(x - cw / 2, y - ch, cw, ch); }
    return img;
  }

  buildProps() {
    // --- A-01 main lab ---
    for (const [x, key] of [[900, 'capsule'], [1680, 'capsule'], [1820, 'capsule']] as [number, string][]) {
      this.prop(key, x, 905, { col: [96, 36] });
      if (this.textures.exists('env')) continue;
      const h = this.add.image(x, 838, 'holo_body').setOrigin(0.5, 1).setScale(0.4).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.8).setDepth(906);
      this.tweens.add({ targets: h, alpha: 0.45, duration: 1300 + x % 500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }
    this.capsuleB = this.prop('capsule_broken', 1040, 905, { col: [96, 36] });
    if (this.textures.exists('env') && !this.textures.get('env').has('p_capsule_broken')) {
      // shattered glass + fault light over the empty capsule (fallback when no broken-capsule art)
      const b = this.capsuleB.getBounds(); const g = this.add.graphics().setDepth(906);
      const rr = new Phaser.Math.RandomDataGenerator(['caps']);
      g.lineStyle(1.4, 0xe6f6ff, 0.85);
      const cx = b.centerX + 4, cy = b.centerY;
      for (let i = 0; i < 9; i++) { let x = cx, y = cy; const a = rr.angle() * Math.PI / 180; g.beginPath(); g.moveTo(x, y); for (let j = 0; j < 3; j++) { x += Math.cos(a + rr.realInRange(-0.5, 0.5)) * b.width * 0.12; y += Math.sin(a + rr.realInRange(-0.5, 0.5)) * b.height * 0.1; g.lineTo(x, y); } g.strokePath(); }
      for (let i = 0; i < 14; i++) { g.fillStyle(0xbfe8ff, rr.realInRange(0.3, 0.7)); const x = b.centerX + rr.realInRange(-50, 50), y = b.bottom + rr.realInRange(2, 14); g.fillTriangle(x, y, x + rr.realInRange(3, 8), y + 1, x + 1, y + rr.realInRange(3, 6)); }
      const warn = this.add.image(b.centerX, b.top + 14, 'light').setTint(0xff2040).setBlendMode(Phaser.BlendModes.ADD).setScale(0.35).setDepth(907);
      this.tweens.add({ targets: warn, alpha: 0.2, duration: 500, yoyo: true, repeat: -1 });
    }
    if (this.textures.exists('env')) {
      // wall-mounted decor on the north wall faces
      this.prop('x_fan', 1110, 776, { depth: 799 }); this.prop('x_glass', 1600, 772, { depth: 799 });
      this.prop('x_pipes', 1860, 790, { depth: 799 }); this.prop('x_grill', 2140, 776, { depth: 799 }); this.prop('x_glass', 2470, 772, { depth: 799 });
      this.prop('x_fan', 300, 1226, { depth: 1249 });
      this.prop('x_grill', 1180, 1822, { depth: 1845 }); this.prop('x_pipes', 1600, 1836, { depth: 1845 });
      // floor decor (y-sorted, light collision)
      this.prop('p_trolley', 1560, 1450, { col: [60, 24] }); this.prop('p_iv', 1790, 1235, {});
      this.prop('p_stretcher', 1100, 1300, { col: [80, 26] }); this.prop('p_plantcrate', 785, 1680, { col: [44, 20] });
      this.prop('x_plant', 1930, 920, { col: [50, 20] });
      this.prop('p_wheelchair', 660, 1290, { col: [50, 22] }); this.prop('x_barrels', 180, 1545, { col: [60, 24] });
      this.prop('x_cone', 530, 1350, {}); this.prop('x_sign', 405, 1355, {});
      this.prop('x_cone', 1225, 2125, {}); this.prop('x_sign', 1090, 2110, {});
      this.prop('x_barrels', 1660, 1950, { col: [60, 24] }); this.prop('p_locker', 1640, 2300, { col: [60, 24] });
      this.prop('x_barrier', 2560, 1280, { col: [100, 20] }); this.prop('p_tubes', 2600, 1150, { col: [40, 20] });
      this.prop('p_techbox', 2580, 980, { col: [70, 26] });
      if (this.textures.get('env').has('x_console_broken')) this.prop('x_console_broken', 1880, 1250, { col: [90, 26] });
    } else {
      this.add.image(1100, 760, 'monitor_wall').setScale(0.5).setDepth(799);
      this.add.image(1620, 760, 'monitor_wall').setScale(0.5).setDepth(799);
      this.add.image(2140, 760, 'monitor_wall').setScale(0.5).setDepth(799);
    }
    this.prop('console', 840, 1060, { col: [130, 40] });
    this.prop('console_red', 1870, 1520, { col: [130, 40] });
    this.prop('optable', 1700, 1290, { col: [170, 50] });
    this.prop('tray_fallen', 1640, 1345, {});
    this.prop('jar', 1180, 880, { col: [36, 20] }); this.prop('jar', 1222, 884, { col: [36, 20] }); this.prop('jar', 1540, 882, { col: [36, 20] });
    this.prop('crate', 1860, 1690, { col: [70, 40] }); this.prop('crate', 1930, 1690, { col: [70, 40] }); this.prop('crate', 1880, 1615, { col: [70, 40] });
    this.prop('rack', 790, 905, { col: [60, 30] });
    const cam = this.textures.exists('env') ? this.add.image(1520, 716, 'env', 'x_camera').setScale(0.5).setDepth(800) : this.add.image(1520, 712, 'cam').setScale(0.6).setDepth(800);
    this.tweens.add({ targets: cam, angle: { from: -18, to: 18 }, duration: 3000, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    // --- B-02 corridor ---
    this.prop('rack', 210, 1262, { col: [60, 30] });
    this.prop('crate', 700, 1540, { col: [70, 40] });
    // --- J-03 joint bay ---
    this.prop('rack', 940, 1858, { col: [60, 30] });
    this.prop('jar', 1620, 1870, { col: [36, 20] }); this.prop('jar', 1660, 1874, { col: [36, 20] });
    this.prop('crate', 1650, 2290, { col: [70, 40] });
    // --- X-04 x-ray room ---
    this.prop('console', 2150, 1110, { col: [130, 40] });
    this.prop('rack', 2600, 870, { col: [60, 30] }); this.prop('rack', 2530, 870, { col: [60, 30] });
    this.prop('jar', 2060, 880, { col: [36, 20] });
    // --- lift ---
    if (this.textures.exists('env')) { this.prop('t_glow', 1360, 600, { depth: -930, scale: 1.3 }); } else this.add.image(1360, 540, 'elevator_pad').setScale(0.5).setDepth(-930);
  }

  /** Exit gate (LOCK shutter + 3 lock lights) on the hub north wall, at map.gateX. */
  buildGate() {
    const gx = this.map.gateX;
    const illus = this.textures.exists('env');
    if (illus) {
      // illustrated blast gate: LOCK shutter -> open (cross-fade during the opening cinematic)
      this.gateOpenImg = this.add.image(gx, 802, 'env', 'd_gate_open').setOrigin(0.5, 1).setScale(0.5).setDepth(801).setAlpha(0);
      this.gateL = this.add.image(gx, 802, 'env', 'd_gate_lock').setOrigin(0.5, 1).setScale(0.5).setDepth(802);
      this.gateR = this.gateL;
      this.prop('x_beacon', gx - 138, 742, { depth: 803 }); this.prop('x_beacon', gx + 138, 742, { depth: 803 });
    } else {
      this.add.image(gx, 800, 'gate_frame').setOrigin(0.5, 1).setScale(0.5).setDepth(801);
      this.gateL = this.add.image(gx, 797, 'gate_leaf').setOrigin(1, 1).setScale(0.5).setDepth(800);
      this.gateR = this.add.image(gx, 797, 'gate_leaf').setOrigin(1, 1).setScale(0.5).setFlipX(true).setDepth(800);
      this.gateR.setOrigin(0, 1);
    }
    this.gateBlock = this.solid(gx - 70, 654, 140, 134);
    for (let i = 0; i < 3; i++) {
      const l = this.add.image(gx - 40 + i * 40, illus ? 648 : 716, 'lock_red').setScale(1.1).setDepth(802).setBlendMode(Phaser.BlendModes.ADD);
      this.locks.push(l);
      this.tweens.add({ targets: l, alpha: 0.5, duration: 500, yoyo: true, repeat: -1, delay: i * 120 });
    }
  }

  buildDoors() {
    this.buildGate();
    // open service door between A-01 and J-03 (decorative frame around the doorway)
    if (this.textures.exists('env')) this.prop('d_door_3', 1320, 1846, { depth: 1700 });
    // X-ray room sliding door (locked until power restored)
    this.xrayDoor = this.textures.exists('env') && this.textures.get('env').has('d_side_closed')
      ? this.add.image(1978, 1142, 'env', 'd_side_closed').setOrigin(0.5, 1).setScale(0.5).setDepth(1142)
      : this.add.image(1978, 1140, 'door_v').setOrigin(0.5, 1).setScale(0.5, 0.5 * 160 / 180).setDepth(1140);
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

  /** v0.5: every bone has its own way in (scanner, stealth, keycard, lasers, alarm escape) — see data/zone1.ts */
  buildBones() {
    for (const id of neededBones()) {
      const g = BONE_GET[id];
      if (g.get === 'puzzle') continue;   // obtained in an investigation view (buildOffice / buildEscape)
      if (g.get === 'alarm' && !G.run.flags.ulnaCage) continue;   // v0.8: caged until its power is restored (buildEscape)
      if (g.get === 'scan') {
        // hidden locker in B-02: only a SCAN pulse reveals it
        this.addInter({
          id: `cabinet_${id}`, x: g.x, y: g.y + 20, r: 95, hidden: true, icon: 'hand',
          label: () => '숨겨진 보관함 열기', act: () => this.openContainer(id, 'cabinet'),
        });
      } else if (g.get === 'stealth') {
        // specimen capsule in the guarded vault: opening it makes noise -> nearby drones turn to look
        this.addInter({
          id: `capsule_${id}`, x: g.x, y: g.y + 40, r: 90, icon: 'hand',
          label: () => '표본 캡슐 개방 (소음 주의)', act: () => this.openVaultCapsule(id),
        });
      } else this.addPickup(id, g.x, g.y);
    }
  }

  /** a bone lying in the world: collected by walking into it (no button) */
  addPickup(id: BoneId, x: number, y: number) {
    const c = this.boneSprite(id, x, y);
    this.bonesInWorld[id] = c;
    this.pickups.push({ id: `bone_${id}`, x, y, obj: c, take: () => this.pickupBone(id) });
  }

  // ---------------------------------------------------------------- v0.5 exploration zone (CH1)
  buildZone() {
    const d = G.run.difficulty, D = this.D, env = this.textures.exists('env');
    // ---- V-05 specimen vault: cover rows + racks; the humerus capsule sits at the far (north) end ----
    this.vaultCapsule = this.prop('capsule', 440, 560, { col: [96, 36] });
    this.prop('rack', 240, 540, { col: [60, 30] }); this.prop('rack', 640, 540, { col: [60, 30] });
    this.prop('crate', 330, 720, { col: [70, 40] }); this.prop('crate', 560, 720, { col: [70, 40] });
    if (env) this.prop('x_barrels', 250, 905, { col: [60, 26] }); else this.prop('crate', 250, 905, { col: [70, 40] });
    this.prop('crate', 470, 900, { col: [70, 40] }); this.prop('crate', 650, 900, { col: [70, 40] });
    if (env) { this.prop('x_glass', 300, 392, { depth: 429 }); this.prop('x_camera', 620, 360, { depth: 429 }); this.prop('x_sign', 600, 1080, {}); }
    T(this, 440, 470, 'SPECIMEN VAULT · V-05', 12, '#9fd2ff', { display: true }).setOrigin(0.5).setDepth(5200).setAlpha(0.85);
    for (const cfg of vaultGuards(d)) this.guards.push(new Guard(this, { ...cfg, speed: D.guardSpeed, chase: D.guardChase, range: D.range, fov: D.fov, susRate: D.susRate, alertDelay: D.alertDelay, catchStun: D.catchStun, susDecay: D.susDecay }));
    // keycard on the floor by the NE rack (inside the patrol loop)
    if (!G.run.keycard) {
      const k = this.add.image(KEYCARD_AT.x, KEYCARD_AT.y, 'keycard').setScale(0.7).setDepth(KEYCARD_AT.y);
      const kg = this.add.image(KEYCARD_AT.x, KEYCARD_AT.y, 'light').setTint(0xffc24d).setBlendMode(Phaser.BlendModes.ADD).setScale(0.35).setAlpha(0.6).setDepth(KEYCARD_AT.y - 1);
      this.tweens.add({ targets: k, y: KEYCARD_AT.y - 8, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.tweens.add({ targets: kg, alpha: 0.2, duration: 700, yoyo: true, repeat: -1 });
      this.pickups.push({ id: 'keycard', x: KEYCARD_AT.x, y: KEYCARD_AT.y, obj: k, take: () => { kg.destroy(); this.takeKeycard(); } });
    }
    // ---- S-07 storage behind the keycard door ----
    // v0.8: the racks made way for the S-03 bench and specimen locker (buildEscape)
    if (env) this.prop('p_tubes', 600, 2290, { col: [40, 20] });
    this.addHazard('spark', 720, 2165, 60, 2.6, 0.9, 0.3);
    this.keyDoor = env && this.textures.get('env').has('d_side_closed')
      ? this.add.image(882, KEY_DOOR.y + KEY_DOOR.h + 2, 'env', 'd_side_closed').setOrigin(0.5, 1).setScale(0.5, 0.5 * 140 / 160).setDepth(KEY_DOOR.y + KEY_DOOR.h).setTint(0xffd08a)
      : this.add.image(882, KEY_DOOR.y + KEY_DOOR.h, 'door_v').setOrigin(0.5, 1).setScale(0.5, 0.5 * 140 / 180).setDepth(KEY_DOOR.y + KEY_DOOR.h);
    this.keyDoorBlock = this.solid(KEY_DOOR.x, KEY_DOOR.y, KEY_DOOR.w, KEY_DOOR.h);
    T(this, 930, KEY_DOOR.y - 14, 'S-07 · 카드키 필요', 12, '#ffd08a', { weight: '700' }).setOrigin(0.5).setDepth(3000);
    this.addInter({
      id: 'keydoor', x: KEY_DOOR.panel.x, y: KEY_DOOR.panel.y, r: 95, icon: 'lock',
      enabled: () => !!(this.keyDoorBlock?.body as Phaser.Physics.Arcade.StaticBody | undefined)?.enable,
      label: () => G.run.keycard ? '잠금 보관실 열기 (카드키)' : '잠금 보관실 S-07',
      locked: () => G.run.keycard ? null : '카드키가 필요합니다. 표본 보관동(V-05) 경비 구역 어딘가에 떨어져 있습니다.',
      act: () => this.openKeyDoor(),
    });
    // ---- L-06 laser corridor ----
    const mul = D.laserMul;
    for (const c of GALLERY_LASERS) { const l = new Laser(this, c); l.mul = mul; l.hitR = D.laserHit; this.lasers.push(l); }
    for (const c of ALARM_LASERS) { const l = new Laser(this, c); l.hitR = D.laserHit; l.enabled = false; this.lasers.push(l); }
    for (const c of FINAL_LASERS) { const l = new Laser(this, c); l.hitR = D.laserHit; l.enabled = false; this.lasers.push(l); }
    if (G.run.flags.ulnaCage) for (const c of [GALLERY_LASERS[3], GALLERY_LASERS[4], GALLERY_LASERS[5]]) { const l = this.lasers.find(q => q.cfg === c); if (l) l.enabled = false; }
    if (env) { this.prop('x_barrier', 2580, 2300, {}); this.prop('x_lamp', 1900, 1830, { depth: 1845 }); }
    T(this, 2190, 1880, 'LASER GRID · L-06', 12, '#ff9ab0', { display: true }).setOrigin(0.5).setDepth(5200).setAlpha(0.85);
    // pedestal under the ulna (alarm bait)
    const ped = this.add.graphics().setDepth(2070);
    ped.fillStyle(0x1a2232, 1); ped.fillEllipse(2560, 2086, 70, 22); ped.lineStyle(2, 0xff5d74, 0.8); ped.strokeEllipse(2560, 2086, 70, 22);
    // ---- supply crates, checkpoints, hiding lockers ----
    CRATE_SPOTS.slice(0, D.crates).forEach((p, i) => this.addCrate(p.x, p.y, i));
    for (const c of CHECKPOINTS) this.addCheckpoint(c.id, c.x, c.y, c.name);
    for (const h of HIDE_SPOTS) this.addHideSpot(h.x, h.y);
  }

  // ---------------------------------------------------------------- v0.7 escape-room investigation (CH1, B-02)
  officeShutter?: Phaser.GameObjects.Image; officeShutterBlock?: Phaser.GameObjects.Zone;
  /** research desk + photo frame in B-02, and the shutter to A-01 that opens when the scapula is recovered */
  buildOffice() {
    const desk = this.add.image(330, 1360, 'w_desk').setOrigin(0.5, 1).setScale(0.5).setDepth(1360);
    this.solid(330 - 80, 1360 - 42, 160, 42);
    this.add.image(420, 1214, 'w_frame').setScale(0.55).setDepth(1249);
    for (const [x, y, d] of [[300, 1300, 0], [420, 1196, 700]] as [number, number, number][]) {
      // a soft glint: these objects can be examined
      const g = this.add.image(x, y, 'light').setTint(0xfff0c0).setBlendMode(Phaser.BlendModes.ADD).setScale(0.08).setAlpha(0).setDepth(5100);
      this.tweens.add({ targets: g, alpha: 0.9, scale: 0.16, duration: 450, yoyo: true, repeat: -1, repeatDelay: 2200, delay: d });
    }
    void desk;
    this.addInter({ id: 'inv_desk', x: 330, y: 1385, r: 110, icon: 'eye', label: () => G.run.flags.scapulaFound ? '연구원 책상 (조사 완료)' : '연구원 책상 조사', act: () => this.openInvestigate('desk') });
    this.addInter({ id: 'inv_frame', x: 420, y: 1290, r: 85, icon: 'eye', label: () => '벽 액자 조사', act: () => this.openInvestigate('frame') });
    // shutter between B-02 and A-01
    if (!G.run.flags.scapulaFound) {
      const env = this.textures.exists('env') && this.textures.get('env').has('d_side_closed');
      this.officeShutter = (env ? this.add.image(742, 1552, 'env', 'd_side_closed') : this.add.image(742, 1550, 'door_v')).setOrigin(0.5, 1).setScale(0.5, 0.5 * 300 / 160).setDepth(1552).setTint(0xffb0b0);
      this.officeShutterBlock = this.solid(724, 1250, 36, 300);
      this.addInter({ id: 'b02_shutter', x: 690, y: 1400, r: 80, icon: 'lock', enabled: () => !G.run.flags.scapulaFound, label: () => 'A-01 격벽',
        locked: () => '격벽이 봉쇄되어 있습니다. 표본 S-01 보관대의 압력 센서가 해제되어야 열립니다. (표본을 찾으세요)', act: () => { /* locked */ } });
    }
  }

  // ---------------------------------------------------------------- v0.8 escape-room puzzles for the other four bones
  escSpots: EscSpot[] = [];
  cage?: { g: Phaser.GameObjects.Graphics; block: Phaser.GameObjects.Zone; light: Phaser.GameObjects.Image };
  /** clipboard + cryo capsule (V-05), bench + locker (S-07), toolbox + poster (J-03), safe + cage panel (L-06) */
  buildEscape() {
    const has = (c: string) => G.run.clues.includes(c), got = (b: BoneId) => G.run.bones.includes(b);
    const spot = (id: string, kind: string, x: number, y: number, r: number, label: () => string, todo: () => boolean, glint: [number, number], store = false) => {
      this.addInter({ id, x, y, r, icon: 'eye', label, act: () => this.openInvestigate(kind) });
      this.escSpots.push({ x, y, todo, store });
      const g = this.add.image(glint[0], glint[1], 'light').setTint(0xfff0c0).setBlendMode(Phaser.BlendModes.ADD).setScale(0.08).setAlpha(0).setDepth(5100);
      this.tweens.add({ targets: g, alpha: 0.9, scale: 0.16, duration: 450, yoyo: true, repeat: -1, repeatDelay: 2200, delay: Math.random() * 1500 });
    };
    // ---- S-02 humerus: clipboard by the vault door, cooling unit on the capsule ----
    const stand = this.add.graphics().setDepth(1060); stand.fillStyle(0x2a313d, 1); stand.fillRect(667, 1020, 6, 44); stand.fillStyle(0x1a2029, 1); stand.fillEllipse(670, 1064, 34, 10);
    this.add.image(670, 1030, 'w_clip').setOrigin(0.5, 1).setScale(0.6).setDepth(1061);
    spot('inv_cryolog', 'cryolog', 670, 1070, 75, () => '냉각 기록지 조사', () => !got('humerus') && !has('cryolog'), [680, 996]);
    this.add.image(440, 600, 'w_cryo').setScale(0.45).setDepth(601);
    spot('inv_cryo', 'cryo', 440, 620, 90, () => got('humerus') ? '냉각 캡슐 (비어 있음)' : '냉각 캡슐 제어 장치 조사', () => !got('humerus') && has('cryolog'), [470, 520]);
    // ---- S-03 radius: bench + locker in S-07 ----
    this.add.image(640, 2056, 'w_bench').setOrigin(0.5, 1).setScale(0.6).setDepth(2056); this.solid(640 - 48, 2056 - 30, 96, 30);
    spot('inv_bench', 'bench', 640, 2095, 75, () => 'S-07 작업대 조사', () => !got('radius') && !(has('uvcard') && has('magnifier')), [620, 2010], true);
    this.prop('p_locker', 800, 2050, { col: [56, 28] });
    spot('inv_locker', 'locker', 800, 2095, 75, () => got('radius') ? '표본 보관장 (S-03 회수함)' : '표본 보관장 조사', () => !got('radius') && has('uvcard') && has('magnifier'), [800, 1960], true);
    // ---- S-05 ulna: toolbox in J-03, cage + panel in L-06 ----
    this.prop('p_techbox', 990, 2280, { col: [60, 26] });
    spot('inv_toolbox', 'toolbox', 990, 2235, 80, () => '공구함 조사', () => !G.run.flags.ulnaCage && !(has('fuse') && has('manual')), [990, 2200]);
    this.prop('p_breaker', 2490, 1850, { depth: 1850 });   // outside the 2390 sweep band (2330..2450)
    spot('inv_panel', 'panel', 2490, 1895, 72, () => G.run.flags.ulnaCage ? '케이지 제어반 (전원 복구됨)' : '케이지 제어반 조사', () => !G.run.flags.ulnaCage && has('fuse') && has('manual'), [2490, 1790]);
    if (!G.run.flags.ulnaCage) {
      const g = this.add.graphics().setDepth(2125);
      g.lineStyle(3, 0x9aa6b8, 0.95);
      for (let x = 2500; x <= 2620; x += 12) g.lineBetween(x, 1985, x, 2120);
      g.lineStyle(6, 0x5a6577, 1); g.strokeRect(2500, 1985, 120, 135);
      g.fillStyle(0x0b1018, 0.35); g.fillRect(2500, 1985, 120, 135);
      const light = this.add.image(2560, 1980, 'light').setTint(0xff3d5a).setBlendMode(Phaser.BlendModes.ADD).setScale(0.18).setAlpha(0.8).setDepth(2126);
      this.tweens.add({ targets: light, alpha: 0.3, duration: 600, yoyo: true, repeat: -1 });
      const block = this.solid(2500, 1995, 120, 125);
      this.cage = { g, block, light };
      const inCage = this.add.image(2560, 2070, 'bone_holo_ulna').setScale(0.22).setAlpha(0.7).setDepth(2080);
      this.tweens.add({ targets: inCage, y: 2062, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      (this.cage as any).ghost = inCage;
      this.addInter({ id: 'ulna_cage', x: 2560, y: 2150, r: 70, icon: 'lock', enabled: () => !G.run.flags.ulnaCage, label: () => '잠긴 표본 케이지 S-05',
        locked: () => '정전으로 잠겨 있습니다. 북쪽 벽의 케이지 제어반에서 전원을 복구해야 합니다.', act: () => { /* locked */ } });
    }
    // ---- S-04 clavicle: poster in J-03, wall safe in L-06 ----
    this.add.image(1580, 1832, 'w_poster').setOrigin(0.5, 1).setScale(0.62).setDepth(1846);
    spot('inv_poster', 'poster', 1580, 1885, 72, () => '해부도 포스터 조사', () => !got('clavicle') && !has('poster'), [1600, 1790]);
    this.add.image(2150, 1834, 'w_safe').setOrigin(0.5, 1).setScale(0.62).setDepth(1846);
    spot('inv_safe', 'safe', 2150, 1885, 72, () => got('clavicle') ? '벽 금고 (비어 있음)' : '벽 금고 조사', () => !got('clavicle') && has('poster'), [2165, 1790]);
  }

  /** the lab reacts when a specimen leaves its puzzle */
  escapeWorldChange(id: string) {
    if (id === 'humerus') {
      // thawing vents a loud hiss: the vault drones turn to look
      if (this.vaultCapsule && this.textures.exists('env') && this.textures.get('env').has('p_capsule_empty')) this.vaultCapsule.setFrame('p_capsule_empty');
      Audio.play('steam'); this.cameras.main.shake(160, 0.003);
      for (const g of this.guards) if (g.cfg.path[0].x < 760 && g.state !== 'chase') { g.last = { x: 440, y: 640 }; g.sus = Math.max(g.sus, G.run.difficulty === 'adv' ? 0.7 : 0.4); g.setState('suspicious'); }
      this.time.delayedCall(700, () => this.ai('캡슐 해동음 감지 — 경비 드론이 소리 쪽으로 이동합니다. 엄폐하며 보관동을 빠져나가십시오.', 'warn', 3800));
    } else if (id === 'clavicle') {
      // the safe's alarm loop powered one of the sweeping beams
      const l = this.lasers.find(q => q.cfg === GALLERY_LASERS[2]);
      if (l) { l.enabled = false; this.time.delayedCall(600, () => this.ai('금고 보안 회로 해제 — L-06 레이저 1개가 정지했습니다.', 'ok', 3400)); }
    } else if (id === 'radius') this.time.delayedCall(600, () => this.ai('표본 S-03 회수 확인.', 'ok', 2400));
    Bus.emit('mission');
  }

  onInvestigateDone(key: string) {
    this.scene.resume(); this.scene.wake('HUD'); this.busy = false; this.player.frozen = false;
    if (key === 'ulnaCage' && this.cage) {
      const c = this.cage; this.cage = undefined;
      Audio.play('door'); this.cameras.main.shake(300, 0.004);
      this.tweens.add({ targets: c.g, y: -140, alpha: 0, duration: 1200, ease: 'Cubic.inOut', onComplete: () => c.g.destroy() });
      c.light.destroy(); (c as any).ghost?.destroy();
      (c.block.body as Phaser.Physics.Arcade.StaticBody).enable = false;
      this.blockers = this.blockers.filter(r => !(r.x === 2500 && r.y === 1995));
      const it = this.inter.find(i => i.id === 'ulna_cage'); if (it) { it.gone = true; it.marker?.setVisible(false); }
      // the cage power is rerouted from the corridor security loop: the beams around the cage go dark for good
      for (const cfg of [GALLERY_LASERS[3], GALLERY_LASERS[4], GALLERY_LASERS[5]]) { const l = this.lasers.find(q => q.cfg === cfg); if (l) l.enabled = false; }
      this.time.delayedCall(800, () => {
        this.addPickup('ulna', 2560, 2075);
        this.ai('케이지 개방 · 전원 우회로 케이지 주변 레이저 3개 정지. 자뼈를 집으면 보안 경보가 울립니다 — 서쪽 출구를 확인해 두십시오.', 'warn', 4600);
      });
    }
    Bus.emit('mission');
  }

  openInvestigate(kind: string) {
    if (this.busy) return;
    const key = INV_SCENE[kind] ?? 'Investigate';
    this.busy = true; this.player.frozen = true; Pad.x = Pad.y = 0; Pad.run = false;
    this.player.play('interact', 0, -1); Audio.play('open');
    this.time.delayedCall(220, () => { this.scene.sleep('HUD'); this.scene.launch(key, { kind }); this.scene.pause(); });
  }

  onInvestigateFound(id: string) {
    this.scene.resume(); this.scene.wake('HUD'); this.busy = false; this.player.frozen = false;
    if (id !== 'scapula') { this.pickupBone(id as BoneId); this.escapeWorldChange(id); return; }
    this.pickupBone('scapula');
    // the specimen left its pressure sensor -> the B-02 shutter opens (the lab changes)
    this.time.delayedCall(900, () => {
      if (!this.officeShutter || !this.officeShutterBlock) return;
      Audio.play('door'); this.cameras.main.shake(400, 0.004);
      this.tweens.add({ targets: this.officeShutter, y: this.officeShutter.y - 300, alpha: 0.1, duration: 1300, ease: 'Cubic.inOut' });
      (this.officeShutterBlock.body as Phaser.Physics.Arcade.StaticBody).enable = false;
      this.blockers = this.blockers.filter(r => !(r.x === 724 && r.y === 1250));
      this.ai('표본 S-01 이탈 감지 — 압력 센서 해제. 격리 통로 B-02 격벽 개방.', 'ok', 3800);
      this.time.delayedCall(4400, () => this.ai('남은 표본 4개도 연구실 곳곳에 잠겨 있습니다. 반짝이는 물건을 조사하십시오. 순서는 자유입니다.', 'ai', 4600));
      Bus.emit('mission');
    });
  }

  addCheckpoint(id: string, x: number, y: number, name: string) {
    const pad = this.add.image(x, y, 'cp_pad').setScale(0.6).setDepth(-905).setAlpha(0.55);
    const cp = { id, x, y, name, pad, on: false };
    this.checkpoints.push(cp);
    if (!G.run.cp && id === 'b02') this.activateCheckpoint(cp, true);
    else if (G.run.cp?.id === id) this.activateCheckpoint(cp, true);
  }
  activateCheckpoint(cp: GameScene['checkpoints'][number], silent = false) {
    for (const c of this.checkpoints) { c.on = c === cp; c.pad.setTint(c.on ? 0x3dffa2 : 0xffffff).setAlpha(c.on ? 0.95 : 0.55); }
    G.run.cp = { x: cp.x, y: cp.y, id: cp.id };
    if (silent) return;
    Audio.play('checkpoint');
    this.toast(`체크포인트 저장 — ${cp.name}`, 'ok');
    const ring = this.add.image(cp.x, cp.y, 'ring').setScale(0.1, 0.04).setTint(0x3dffa2).setBlendMode(Phaser.BlendModes.ADD).setDepth(-900);
    this.tweens.add({ targets: ring, scaleX: 0.9, scaleY: 0.35, alpha: 0, duration: 700, onComplete: () => ring.destroy() });
  }

  addCrate(x: number, y: number, i: number) {
    const img = this.add.image(x, y, 'crate_closed').setOrigin(0.5, 1).setScale(0.55).setDepth(y);
    this.solid(x - 20, y - 16, 40, 16);
    const it: Interactable = {
      id: `crate_${i}`, x, y: y + 10, r: 80, icon: 'bag', label: () => '보급 상자 열기',
      act: () => {
        it.gone = true; it.marker?.setVisible(false);
        img.setTexture('crate_open'); Audio.play('open');
        this.player.play('interact', x - this.player.x, y - this.player.y);
        // random contents (a heal when hurt is more likely; a heal at full health becomes a shield)
        const r = G.run, roll = Math.random();
        let kind: 'heal' | 'shield' | 'scan' = r.hp < 3 && roll < 0.55 ? 'heal' : roll < 0.7 ? 'shield' : 'scan';
        if (kind === 'heal' && r.hp >= 3) kind = 'shield';
        const icon = this.add.image(x, y - 40, kind === 'scan' ? 'ring' : 'light').setTint(kind === 'heal' ? 0xff5d74 : kind === 'shield' ? 0x4fd8ff : 0xb07bff).setBlendMode(Phaser.BlendModes.ADD).setScale(0.3).setDepth(y + 1);
        this.tweens.add({ targets: icon, y: y - 110, alpha: 0, duration: 900, onComplete: () => icon.destroy() });
        if (kind === 'heal') { r.hp = Math.min(3, r.hp + 1); Audio.play('heal'); this.toast('회복 앰플 — 하트 1개 회복', 'ok'); this.player.burst(0xff5d74, 18); }
        else if (kind === 'shield') { r.shield = 1; Audio.play('shield'); this.toast('일회용 보호막 — 다음 피해 1번을 막아 줍니다', 'ok'); this.player.burst(0x4fd8ff, 18); }
        else { this.scanAmp = true; Audio.play('reveal'); this.toast('스캐너 증폭기 — 다음 SCAN의 탐지 반경 2배', 'ok'); }
        Bus.emit('hp');
      },
    };
    this.addInter(it);
  }

  addHideSpot(x: number, y: number) {
    const env = this.textures.exists('env');
    const img = env ? this.add.image(x, y, 'env', 'p_locker_closed').setOrigin(0.5, 1).setScale(0.5).setDepth(y) : this.add.image(x, y, 'cabinet').setOrigin(0.5, 1).setScale(0.55).setDepth(y);
    this.solid(x - 24, y - 18, 48, 18);
    this.hideSpots.push({ x, y, img });
    this.addInter({ id: `hide_${x}_${y}`, x, y: y + 16, r: 70, icon: 'eye', enabled: () => !this.hiding, label: () => '사물함에 숨기', act: () => this.enterHide(x, y, img) });
  }
  enterHide(x: number, y: number, img: Phaser.GameObjects.Image) {
    // drones that are watching you right now see you get in
    if (this.guards.some(g => g.seeing && (g.state === 'chase' || g.state === 'alert'))) { Audio.play('error'); this.toast('추격 중에는 숨을 수 없습니다! 먼저 시야를 벗어나세요.', 'warn'); return; }
    this.hiding = { x, y, img };
    this.player.root.setAlpha(0.15); this.player.frozen = true;
    this.player.pb.reset(x, y + 24);
    Audio.play('close'); img.setTint(0x9fdcff);
    this.toast('숨는 중 — 움직이거나 조작 버튼을 누르면 나옵니다', 'info');
    Bus.emit('prompt', { label: '사물함에서 나오기', icon: 'eye', locked: false });
  }
  exitHide() {
    if (!this.hiding) return;
    this.hiding.img.clearTint(); this.hiding = null;
    this.player.root.setAlpha(1); this.player.frozen = false;
    Audio.play('open');
  }

  takeKeycard() {
    G.run.keycard = true; Audio.play('card');
    this.toast('카드키 S-07 획득 — 관절 보정실(J-03) 서쪽의 잠금 보관실을 열 수 있습니다', 'ok');
    Bus.emit('hp'); Bus.emit('mission');
  }
  openKeyDoor() {
    if (!this.keyDoor || !this.keyDoorBlock) return;
    this.player.play('interact', -1, 0);
    Audio.play('unlock');
    this.time.delayedCall(300, () => {
      Audio.play('door');
      this.tweens.add({ targets: this.keyDoor, y: this.keyDoor!.y - 130, alpha: 0.15, duration: 900, ease: 'Cubic.inOut' });
      (this.keyDoorBlock!.body as Phaser.Physics.Arcade.StaticBody).enable = false;
      this.blockers = this.blockers.filter(r => !(r.x === KEY_DOOR.x && r.y === KEY_DOOR.y));
      this.toast('S-07 잠금 해제 — 바닥 배선의 방전 주기를 보고 들어가세요', 'ok');
    });
  }

  openVaultCapsule(id: BoneId) {
    const it = this.inter.find(i => i.id === `capsule_${id}`)!;
    it.gone = true; it.marker?.setVisible(false);
    this.player.play('interact', 0, -1);
    Audio.play('open'); Audio.play('glitch');
    if (this.vaultCapsule && this.textures.exists('env') && this.textures.get('env').has('p_capsule_empty')) this.vaultCapsule.setFrame('p_capsule_empty');
    this.cameras.main.shake(160, 0.003);
    // security reacts: every drone in the vault turns towards the capsule with raised suspicion
    for (const g of this.guards) if (g.cfg.path[0].x < 760 && g.state !== 'chase') { g.last = { x: 440, y: 620 }; g.sus = Math.max(g.sus, G.run.difficulty === 'adv' ? 0.75 : 0.45); g.setState('suspicious'); }
    this.toast('캡슐 개방음 — 경비 드론이 소리를 들었습니다! 표본을 집고 엄폐하세요', 'warn');
    this.addPickup(id, 440, 610);
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
      label: () => G.run.flags.assembled ? '뼈대 홀로그램 (복구 완료)' : '뼈대 복구 테이블',
      locked: () => G.run.flags.assembled ? '이미 복구한 구조입니다.' : G.run.bones.length < neededBones().length ? `뼈대 표본이 부족합니다 (${G.run.bones.length}/${neededBones().length}). 시설 곳곳을 탐색하고 SCAN을 사용하세요.` : null,
      act: () => this.openPuzzle('Assembly'),
    });
    // joint rig (J-03)
    this.prop('joint_rig', 1480, 2010, { col: [180, 60] });
    if (this.textures.exists('env') && !this.textures.get('env').has('p_joint_rig')) {
      // holographic joint model rotating above the calibration unit
      const jg = this.add.graphics().setDepth(2011).setBlendMode(Phaser.BlendModes.ADD);
      this.time.addEvent({ delay: 33, loop: true, callback: () => {
        const t = this.time.now / 1000; jg.clear();
        const cx = 1480, cy = 1890;
        jg.lineStyle(2, 0xb07bff, 0.8); jg.strokeEllipse(cx, cy + 34, 120, 26);
        jg.fillStyle(0xc9a6ff, 0.75); jg.fillCircle(cx, cy, 13);
        const a = Math.sin(t * 1.6) * 0.9;
        jg.lineStyle(7, 0xc9a6ff, 0.65); jg.lineBetween(cx, cy - 6, cx, cy - 48); jg.lineBetween(cx, cy + 6, cx + Math.sin(a) * 46, cy + Math.cos(a) * 46);
        jg.lineStyle(2, 0xffffff, 0.5); jg.beginPath(); jg.arc(cx, cy, 24, Math.PI / 2 - 0.9, Math.PI / 2 + 0.9); jg.strokePath();
      } });
    }
    this.addInter({
      id: 'align', x: 1480, y: 2010, r: 140, icon: 'rotate',
      label: () => G.run.flags.aligned ? '관절 보정 장치 (정렬 완료)' : '관절 보정 장치',
      locked: () => G.run.flags.aligned ? '이미 정렬이 완료되었습니다.' : !G.run.flags.assembled ? '뼈대 데이터가 없습니다. 먼저 뼈대 복구 테이블에서 뼈대를 조립하세요.' : !G.run.flags.power ? '전력이 차단되어 있습니다. 차단기로 보조 전원을 복구하세요.' : null,
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
      label: () => '영상 판독실 출입문',
      enabled: () => !G.run.flags.aligned,
      locked: () => G.run.flags.blackout ? '전력이 없어 문이 열리지 않습니다. 보조 전원을 복구하세요.' : G.run.flags.power ? '문 구동부가 멈춰 있습니다. 관절 보정 장치(J-03)로 관절을 정렬하면 기계 팔이 문을 엽니다.' : '격벽 잠금 상태. 뼈대 복구 이후 전력 재분배가 필요합니다.',
      act: () => { /* locked only */ },
    });
    // gate
    this.addInter({
      id: 'gate', x: 1360, y: 840, r: 130, icon: 'lock',
      enabled: () => !G.run.flags.gate,
      label: () => '탈출 게이트 · 코어 인증',
      locked: () => {
        const f = G.run.flags; const n = [f.assembled, f.aligned, f.xray].filter(Boolean).length;
        return n < 3 ? `게이트 잠금 ${n}/3 해제됨. 뼈대 조립 · 관절면 정렬 · X-ray 판독을 모두 완료해야 합니다.` : null;
      },
      act: () => this.openGate(),
    });
    // research logs
    const logs: [string, number, number, string][] = [['log_1', 680, 1268, '연구일지 단말기'], ['log_2', 1470, 912, 'MERIDIAN 로그 단말기'], ['log_3', 1620, 2250, '프로토콜 단말기']];
    for (const [id, x, y, name] of logs) {
      this.prop('terminal', x, y, { col: [40, 20] });
      this.addInter({ id, x, y, r: 85, icon: 'info', label: () => name, act: () => this.readLog(id) });
    }
  }

  initHazardFx() {
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
  }

  addHazard(kind: 'spark' | 'steam', x: number, y: number, r: number, period: number, on: number, phase: number, only?: () => boolean) {
    if (kind === 'spark') {
      if (this.textures.exists('env') && this.textures.get('env').has('x_floor_hole')) this.prop('x_floor_hole', x, y + 40, { depth: -925 });
      else if (this.textures.exists('env')) { this.prop('t_hazard', x, y + 46, { depth: -925 }); this.add.image(x, y, 'spark_panel').setScale(0.32).setDepth(-924).setAlpha(0.9); }
      else this.prop('spark_panel', x, y + 30, { depth: -925 });
    } else if (this.textures.exists('env')) this.prop('t_grate', x, y + 46, { depth: -926 });
    this.hazards.push({ kind, x, y, r, period, on, phase, only });
  }

  buildHazards() {
    const add = this.addHazard.bind(this);
    add('spark', 1150, 2170, 66, 2.4, 0.7, 1.1);
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
      [7400, () => { this.ai(G.run.chapter === 1 ? '격리 통로 B-02 봉쇄. 한 박사가 표본 S-01을 이 통로 어딘가에 숨겼습니다. 책상과 벽을 조사하십시오.' : `손상된 뼈대 표본 ${neededBones().length}개 감지. 회수 후 복구 테이블(A-01)에서 재조립하십시오.`, 'ai', 4600); Audio.alarm(false); }],
      [9000, () => {
        this.busy = false; this.player.frozen = false; G.run.flags.intro = true; Bus.emit('mission');
        this.toast(this.sys.game.device.input.touch ? '왼쪽 조이스틱으로 이동 · 오른쪽 버튼으로 조사/조작' : '이동 WASD · 달리기 Shift · 조사/조작 E', 'info');
        Audio.setMusic(this.bgm());
        if (G.run.chapter === 1) this.time.delayedCall(2600, () => this.ai('반짝이는 물건은 조사할 수 있습니다. 다가가서 조작 버튼을 누르면 확대 화면으로 들어갑니다.', 'ai', 5200));
      }],
    ];
    for (const [t, fn] of seq) this.time.delayedCall(t, fn);
  }

  missions(): Mission[] {
    const f = G.run.flags, n = G.run.bones.length, N = neededBones().length;
    const list: Mission[] = [];
    list.push({ text: G.run.flags.scapulaFound ? '표본 S-01 (어깨뼈) 회수' : '표본 S-01 찾기 · B-02 책상과 액자 조사', done: !!f.scapulaFound, active: !f.scapulaFound });
    // v0.8: every specimen has its own escape-room puzzle (any order once B-02 is open)
    const B = G.run.bones, open = !!f.scapulaFound;
    const bone = (id: BoneId, name: string, where: string) => list.push({ text: B.includes(id) ? `${name} 회수` : `${name} · ${where}`, done: B.includes(id), active: open && !B.includes(id) });
    bone('humerus', '표본 S-02 (위팔뼈)', 'V-05 냉각 캡슐 — 기록지 확인');
    bone('radius', '표본 S-03 (노뼈)', 'S-07 작업대·보관장');
    if (!B.includes('radius') || G.run.keycard) list.push({ text: '카드키 확보 · V-05 경비 구역 (S-07 출입)', done: G.run.keycard, active: open && !G.run.keycard });
    bone('clavicle', '표본 S-04 (빗장뼈)', 'L-06 벽 금고 — J-03 해부도');
    bone('ulna', '표본 S-05 (자뼈)', f.ulnaCage ? 'L-06 케이지에서 회수' : 'L-06 케이지 전원 — J-03 공구함');
    if (G.run.difficulty === 'adv') bone('fibula', '미끼 표본 (종아리뼈)', 'S-07 바닥');
    void n; void N;
    if (this.escape?.kind === 'gallery') list.push({ text: 'L-06 셔터가 닫히기 전에 탈출!', done: false, active: true });
    list.push({ text: '뼈대 조립 · 복구 테이블', done: f.assembled, active: n >= N && !f.assembled, tag: 'LOCK 1' });
    if (f.blackout || f.power) list.push({ text: '보조 전원 복구 · 차단기', done: f.power, active: f.blackout && !f.power });
    list.push({ text: '관절면 정렬 · J-03', done: f.aligned, active: f.power && !f.aligned, tag: 'LOCK 2' });
    list.push({ text: 'X-ray 판독 · X-04', done: f.xray, active: f.aligned && !f.xray, tag: 'LOCK 3' });
    list.push({ text: f.xray ? '제한 시간 안에 게이트 → 승강기' : '게이트 개방 · 승강기 탑승', done: f.escaped, active: f.assembled && f.aligned && f.xray && !f.escaped });
    return list;
  }

  /** Where the guidance arrow should point. */
  objective(): { x: number; y: number } | null {
    const f = G.run.flags, p = this.player;
    if (this.escape?.kind === 'gallery') return { x: GALLERY_EXIT_X - 40, y: 2060 };
    if (!f.scapulaFound) return G.run.clues.includes('journal') && !G.run.clues.includes('photo') ? { x: 420, y: 1290 } : { x: 330, y: 1385 };
    if (G.run.bones.length < neededBones().length) {
      const doorShut = !!(this.keyDoorBlock?.body as Phaser.Physics.Arcade.StaticBody | undefined)?.enable;
      const B = G.run.bones;
      const cands: { x: number; y: number }[] = [];
      for (const k of this.pickups) if (!(k.id === 'bone_fibula' && doorShut)) cands.push(k);
      const needStore = !B.includes('radius') || (G.run.difficulty === 'adv' && !B.includes('fibula'));
      if (doorShut && G.run.keycard && needStore) cands.push(KEY_DOOR.panel);
      for (const e of this.escSpots) if (e.todo() && !(e.store && doorShut)) cands.push(e);
      let best: { x: number; y: number } | null = null, bd = 1e9;
      for (const c of cands) { const d = Math.hypot(p.x - c.x, p.y - c.y); if (d < bd) { bd = d; best = c; } }
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
    if (via === 'cabinet') { if (this.textures.exists('env') && this.textures.get('env').has('p_locker_open')) { this.cabinet.setFrame('p_locker_open'); this.cabinet.setOrigin(0.5, 1); } else if (this.textures.exists('env')) { this.cabinet.setTint(0x8fa6c8); this.add.image(this.cabinet.x, this.cabinet.y - 50, 'light').setTint(0x4fd8ff).setBlendMode(Phaser.BlendModes.ADD).setScale(0.6).setAlpha(0.5).setDepth(this.cabinet.depth + 1); } else this.cabinet.setTexture('cabinet_open'); this.cabinetOpen = true; this.toast('보관함 잠금 해제 — 내부에서 표본 발견!', 'ok'); }
    else { this.capsuleOpen = true; this.toast('캡슐 잔해 속에서 표본 발견!', 'ok'); this.cameras.main.shake(150, 0.002); }
    const s = BONE_GET[id];
    this.addPickup(id, s.x, s.y + (via === 'cabinet' ? 50 : 60));
    const c = this.bonesInWorld[id]!; c.setScale(0.2); this.tweens.add({ targets: c, scale: 1, duration: 400, ease: 'Back.out' });
  }

  pickupBone(id: BoneId) {
    const run = G.run; if (run.bones.includes(id)) return;
    this.pickups = this.pickups.filter(p => p.id !== `bone_${id}`);
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
    // anatomy is learned while playing: basic shows what the bone is, advanced only the name
    this.toast(`${b.ko} · ${b.en} 획득 — ${run.bones.length}/${neededBones().length}${this.D.hints ? `\n${PICKUP_HINT[id]}` : ''}`, 'ok');
    if (BONE_GET[id].get === 'alarm') this.time.delayedCall(250, () => this.startGalleryAlarm());
    Bus.emit('mission');
    if (run.bones.length === neededBones().length) this.time.delayedCall(900, () => this.ai('모든 표본 회수 확인. 뼈대 복구 테이블(A-01)로 이동하십시오.', 'ok'));
  }

  readLog(id: string) {
    this.player.play('interact');
    Audio.play('beep');
    if (!G.run.logs.includes(id)) G.run.logs.push(id);
    unlock(id);
    this.scene.launch('Info', { mode: 'log', id, from: 'Game' });
  }

  openPuzzle(kind: string) {
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
      // the recovered bones fly onto the table and lock into the arm skeleton, then the hologram rises
      this.restoreSkeletonOnTable(() => { this.showHoloSkeleton(); this.time.delayedCall(1400, () => this.startBlackout()); });
    } else if (id === 'Align') {
      f.aligned = true; unlock('c_gh'); G.run.learned.push('c_gh'); this.setLock(1);
      // the calibrated joint drives the rig's mechanical arm, which hauls the X-04 blast door open
      this.runJointRig();
    } else if (id === 'Xray') {
      f.xray = true; unlock('c_xray'); G.run.learned.push('c_xray'); this.setLock(2);
      this.ai('영상 판독 데이터 확인. 게이트 잠금 3 해제.', 'ok', 3000);
      this.light.extra.push({ x: 2320, y: 900, r: 380, a: 0.6 });
      this.time.delayedCall(3200, () => this.startFinalEscape());
    }
    Bus.emit('mission');
  }

  /** Assembly success: the recovered bones fly from the unit onto the recovery table and lock into the arm skeleton. */
  restoreSkeletonOnTable(done: () => void) {
    this.busy = true; this.player.frozen = true;
    const ids = UPPER_ORDER;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const id of ids) { const b = boneBounds(id); x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h); }
    // laid flat along the table top like a specimen: proximal (shoulder) end to the left, hand end to the right
    const L = 240, s = L / (y1 - y0), fcx = (x0 + x1) / 2, fcy = (y0 + y1) / 2, cx = 1360, cy = 1222;
    const to = (fx: number, fy: number) => ({ x: cx + (fy - fcy) * s, y: cy - (fx - fcx) * s * 0.75 });   // rotated -90°, table seen at 3/4 (x0.75 depth)
    this.cameras.main.stopFollow(); this.cameras.main.pan(1360, 1250, 600, 'Sine.easeInOut');
    const base = this.add.image(1360, 1225, 'ring').setScale(1.0, 0.28).setTint(0x4fd8ff).setBlendMode(Phaser.BlendModes.ADD).setDepth(1399).setAlpha(0.8);
    this.holoSkel.push(base);
    ids.forEach((id, k) => {
      const b = boneBounds(id);
      const img = this.add.image(this.player.x, this.player.y - 90, `bone_bone_${id}`).setScale(0.05).setDepth(1400).setAlpha(0.9);
      const tg = to(b.cx, b.cy);
      this.time.delayedCall(500 + k * 320, () => {
        this.tweens.add({ targets: img, x: tg.x, y: tg.y, scaleX: s / DENSITY * 0.75, scaleY: s / DENSITY, angle: -90, alpha: 1, duration: 520, ease: 'Cubic.out', onComplete: () => {
          Audio.play('snap');
          // contact shadow so the ivory bone reads against the glowing table
          const sh = this.add.image(img.x + 3, img.y + 4, `bone_bone_${id}`).setScale(img.scaleX, img.scaleY).setAngle(-90).setTintFill(0x02101c).setAlpha(0.55).setDepth(1399);
          this.holoSkel.push(sh); img.setTint(0xf0e2c4);
          const fl = this.add.image(img.x, img.y, `bone_holo_${id}`).setScale(s / DENSITY * 0.75, s / DENSITY).setAngle(-90).setBlendMode(Phaser.BlendModes.ADD).setDepth(1401);
          this.tweens.add({ targets: fl, alpha: 0, duration: 600, onComplete: () => fl.destroy() });
        } });
      });
      this.holoSkel.push(img);
    });
    this.time.delayedCall(500 + ids.length * 320 + 700, () => {
      Audio.play('success'); this.cameras.main.flash(250, 80, 220, 255);
      this.ai('팔뼈대 복구 완료: 빗장뼈·어깨뼈(팔이음뼈) → 위팔뼈 → 노뼈·자뼈. 게이트 잠금 1 해제.', 'ok', 3600);
      for (const l of this.light.lights) if (l.room === 'lab') l.cur = 1;
      this.time.delayedCall(900, () => {
        this.cameras.main.startFollow(this.player.root, true, 0.09, 0.09, 0, 40);
        this.busy = false; this.player.frozen = false; done();
      });
    });
  }

  /** Align success: the calibrated shoulder/elbow model on the J-03 rig moves (abduction, then elbow flexion) and its
   * winch hauls the X-04 blast door open. */
  runJointRig() {
    this.busy = true; this.player.frozen = true;
    const px = 1480, py = 1872;
    const arm = this.add.container(px, py).setDepth(2012);
    const hum = this.add.image(0, 0, 'bone_bone_humerus').setOrigin(0.5, 0.04);
    const hs = 92 / hum.height; hum.setScale(hs);
    const fore = this.add.container(0, hum.displayHeight * 0.93);
    const ul = this.add.image(0, 0, 'bone_bone_ulna').setOrigin(0.5, 0.03); ul.setScale(80 / ul.height);
    const ra = this.add.image(6, 6, 'bone_bone_radius').setOrigin(0.5, 0.03); ra.setScale(74 / ra.height);
    fore.add([ul, ra]); arm.add([hum, fore]);
    const joint = this.add.image(px, py, 'light').setTint(0xb07bff).setBlendMode(Phaser.BlendModes.ADD).setScale(0.3).setDepth(2013);
    this.cameras.main.stopFollow(); this.cameras.main.pan(px, py + 40, 500, 'Sine.easeInOut');
    Audio.play('powerup');
    this.time.delayedCall(500, () => {
      Audio.play('rotate'); this.ai('관절 정렬 완료 — 보정 장치 구동: 어깨 벌림 → 팔꿉 굽힘', 'ok', 3000);
      this.tweens.add({ targets: arm, angle: -70, duration: 1100, ease: 'Sine.inOut' });
      this.time.delayedCall(1200, () => { Audio.play('rotate'); this.tweens.add({ targets: fore, angle: -80, duration: 900, ease: 'Sine.inOut' }); });
    });
    // winch -> X-04 door
    this.time.delayedCall(2500, () => {
      this.cameras.main.pan(1978, 1060, 900, 'Sine.easeInOut');
      this.time.delayedCall(950, () => {
        Audio.play('door'); this.cameras.main.shake(400, 0.004);
        this.tweens.add({ targets: this.xrayDoor, y: this.xrayDoor.y - 150, alpha: 0.2, duration: 1100, ease: 'Cubic.inOut' });
        (this.xrayDoorBlock.body as Phaser.Physics.Arcade.StaticBody).enable = false;
        this.blockers = this.blockers.filter(r => !(r.x === 1960 && r.y === 980));
        this.ai('게이트 잠금 2 해제. 영상 판독실(X-04) 출입문 개방.', 'ok', 3400);
      });
      this.time.delayedCall(2400, () => {
        this.cameras.main.startFollow(this.player.root, true, 0.09, 0.09, 0, 40);
        this.busy = false; this.player.frozen = false;
        this.tweens.add({ targets: [arm, joint], alpha: 0.55, duration: 600 });
        Bus.emit('mission');
      });
    });
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
    this.ai('경고: 뼈대 데이터 재기동 중 전력 과부하. 주 전원 차단.', 'warn', 3600);
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
      Audio.play('powerup'); Audio.alarm(false); Audio.setMusic(this.bgm()); Audio.heartbeat(false);
      this.blackoutLeft = 0;
      this.ai('보조 전원 가동. 관절 보정 장치(J-03)가 활성화되었습니다. 관절을 정렬하면 장치가 X-04 출입문을 엽니다.', 'ok', 4800);
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
      const gx = this.map.gateX;
      this.cameras.main.pan(gx, 760, 900, 'Sine.easeInOut');
      this.locks.forEach((l, i) => this.time.delayedCall(i * 200, () => { l.setScale(2); this.tweens.add({ targets: l, scale: 1.2, duration: 300 }); Audio.play('beep'); }));
      this.time.delayedCall(1000, () => {
        Audio.play('door'); this.cameras.main.shake(1200, 0.005);
        if (this.gateOpenImg) {
          this.tweens.add({ targets: this.gateOpenImg, alpha: 1, duration: 1400, ease: 'Cubic.inOut' });
          this.tweens.add({ targets: this.gateL, alpha: 0, duration: 1400, ease: 'Cubic.inOut' });
        } else {
          this.tweens.add({ targets: this.gateL, x: gx - 70, duration: 1400, ease: 'Cubic.inOut' });
          this.tweens.add({ targets: this.gateR, x: gx + 70, duration: 1400, ease: 'Cubic.inOut' });
        }
        this.steam.emitParticleAt(gx - 60, 790, 12); this.steam.emitParticleAt(gx + 60, 790, 12);
        const flood = this.add.image(gx, 700, 'light').setTint(0x3dffa2).setBlendMode(Phaser.BlendModes.ADD).setScale(0.2).setAlpha(0).setDepth(8700);
        this.tweens.add({ targets: flood, scale: 2.2, alpha: 0.6, duration: 1400 });
        this.light.extra.push({ x: gx, y: 700, r: 300, a: 0.9 });
      });
      this.time.delayedCall(2600, () => {
        (this.gateBlock.body as Phaser.Physics.Arcade.StaticBody).enable = false;
        this.cameras.main.startFollow(this.player.root, true, 0.12, 0.12, 0, 40);
        this.busy = false; this.player.frozen = false;
        this.ai('게이트 개방. 승강기에 탑승하십시오.', 'ok');
        Bus.emit('mission');
        Audio.setMusic(this.bgm());
      });
    });
  }

  victory() {
    const f = G.run.flags; if (f.escaped) return;
    f.escaped = true; this.busy = true; this.player.frozen = true;
    if (this.escape) { this.escape = null; Audio.alarm(false); Audio.heartbeat(false); Bus.emit('timer', -1); this.redWash.fillAlpha = 0; }
    G.run.elapsed = (this.time.now - G.run.startTime) / 1000;
    Bus.emit('mission'); Bus.emit('hud:hide');
    this.player.play('victory');
    Audio.play('victory');
    this.cameras.main.stopFollow();
    const L = this.map.lift;
    this.cameras.main.pan(L.x, L.y - 40, 1200, 'Sine.easeInOut');
    this.cameras.main.zoomTo(this.cameras.main.zoom * 1.15, 1600, 'Sine.easeInOut');   // base camera is already close (v0.5)
    const beam = this.add.image(L.x, L.y - 20, 'light').setTint(0x3dffa2).setBlendMode(Phaser.BlendModes.ADD).setScale(0.6, 3).setAlpha(0).setDepth(8800);
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
    if (this.hiding) { this.exitHide(); return; }
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
    const amp = this.scanAmp; this.scanAmp = false;
    const R = amp ? 840 : 420;
    this.ringFx.setPosition(px, py).setVisible(true).setScale(0.1).setAlpha(1).setTint(amp ? 0xb07bff : 0x4fd8ff);
    this.tweens.add({ targets: this.ringFx, scale: amp ? 6.4 : 3.2, alpha: 0, duration: 900, ease: 'Cubic.out', onComplete: () => this.ringFx.setVisible(false) });
    this.light.extra.push({ x: px, y: py, r: 400, a: 0.5 });
    this.time.delayedCall(450, () => this.light.extra.shift());
    Bus.emit('scanned');
    let found = 0;
    for (const i of this.inter) {
      if (i.gone) continue;
      const d = Phaser.Math.Distance.Between(px, py, i.x, i.y);
      if (d > R) continue;
      if (i.hidden) {
        i.hidden = false; found++;
        this.time.delayedCall(d * 1.6, () => {
          Audio.play('reveal');
          const obj = this.reveal[i.id] ?? Object.entries(this.bonesInWorld).find(([k]) => i.id === `bone_${k}`)?.[1];
          if (obj) { obj.setVisible(true); this.tweens.add({ targets: obj, alpha: 1, duration: 400 }); }
          const ping = this.add.image(i.x, i.y - 20, 'ring').setTint(0x3dffa2).setBlendMode(Phaser.BlendModes.ADD).setScale(0.05).setDepth(8600);
          this.tweens.add({ targets: ping, scale: 0.6, alpha: 0, duration: 700, onComplete: () => ping.destroy() });
        });
      } else if (i.marker) {
        this.time.delayedCall(d * 1.6, () => { i.marker!.setAlpha(1); this.tweens.add({ targets: i.marker, alpha: 0, duration: 1600, delay: 600 }); });
      }
    }
    this.time.delayedCall(700, () => this.toast(found ? `SCAN: 숨겨진 신호 ${found}개 탐지!` : 'SCAN: 주변에 숨겨진 신호 없음', found ? 'ok' : 'info'));
  }

  // ---------------------------------------------------------------- damage / respawn (v0.5)
  /** One heart of damage (shield absorbs it). 1.5 s of invulnerability with blinking afterwards. */
  hurt(src: 'guard' | 'laser' | 'spark' | 'steam' | 'shutter', fx: number, fy: number) {
    if (this.invuln > 0 || this.busy || G.run.flags.escaped) return false;
    const r = G.run;
    const dx = this.player.x - fx || 1, dy = this.player.y - fy;
    if (this.hiding) this.exitHide();
    if (r.shield > 0) {
      r.shield = 0; this.invuln = 1.0;
      Audio.play('shieldbreak'); this.player.burst(0x4fd8ff, 26);
      this.cameras.main.shake(140, 0.004);
      this.toast('보호막이 피해를 막았습니다!', 'warn'); Bus.emit('hp');
      return true;
    }
    r.hp = Math.max(0, r.hp - 1); r.hits++; r.mistakes++;
    this.invuln = 1.5;
    this.player.play('damage', dx, dy);
    Audio.play('hurt'); if (src === 'laser' || src === 'spark') Audio.play('zap');
    this.cameras.main.shake(240, 0.008);
    this.cameras.main.flash(140, 255, 40, 70, false);
    Bus.emit('hp', 'hit');
    const why = { guard: '경비 드론에게 붙잡혔습니다!', laser: '레이저에 닿았습니다! 깜빡이는 경고선을 보고 지나가세요.', spark: '전기 충격! 노출된 배선의 방전 주기를 피하세요.', steam: '고온 증기! 배출 주기를 확인하고 지나가세요.', shutter: '보안 셔터가 닫혔습니다!' }[src];
    if (r.hp <= 0) { this.toast(`${why} — 하트 0`, 'err'); this.time.delayedCall(450, () => this.respawn()); }
    else this.toast(`${why}  (하트 ${r.hp}/3)`, 'err');
    return true;
  }

  /** Hearts gone (or a timed event failed): back to the last checkpoint. Bones, keycard and learning records stay. */
  respawn(reason = '시스템 재부팅 — 마지막 체크포인트로 복귀합니다') {
    if (this.busy) return;
    this.busy = true; this.player.frozen = true; Pad.x = Pad.y = 0;
    if (this.hiding) this.exitHide();
    Audio.play('respawn'); Audio.heartbeat(false);
    this.cameras.main.fadeOut(450, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      const cp = G.run.cp ?? { x: this.map.spawn.x, y: this.map.spawn.y, id: 'b02' };
      this.player.pb.reset(cp.x, cp.y - 10);
      this.player.vx = this.player.vy = 0; this.player.stun = 0;   // no knock-back carried over the teleport
      G.run.hp = 3; this.invuln = 2;
      for (const g of this.guards) g.reset();
      if (this.escape?.kind === 'gallery') this.endGalleryAlarm(false);
      if (this.escape?.kind === 'final') { this.escape.left = this.escape.total; }
      if (!this.escape) Audio.setMusic(G.run.flags.blackout ? 'tension' : this.bgm());
      this.cameras.main.fadeIn(500, 0, 0, 0);
      this.time.delayedCall(500, () => { this.busy = false; this.player.frozen = false; });
      this.toast(`${reason} (하트 3/3 · 획득한 뼈와 학습 기록은 유지)`, 'info');
      Bus.emit('hp'); Bus.emit('mission');
    });
  }

  /** guard state changes: chase music while any drone hunts the player */
  onGuardState(_g: Guard, s: GState) {
    if (s === 'alert') { this.toast('경비 드론에게 발각! 시야를 끊고 엄폐물이나 사물함으로 숨으세요', 'err'); this.cameras.main.shake(120, 0.003); }
    this.updateThreatMusic();
  }
  updateThreatMusic() {
    if (this.busy && !this.escape) return;
    const hunted = this.guards.some(g => g.state === 'alert' || g.state === 'chase');
    if (hunted || this.escape) Audio.setMusic('chase');
    else Audio.setMusic(G.run.flags.blackout ? 'tension' : this.bgm());
  }

  // ---------------------------------------------------------------- L-06 alarm escape
  startGalleryAlarm() {
    if (this.escape) return;
    const t = this.D.alarmTime;
    this.escape = { kind: 'gallery', left: t, total: t };
    Audio.alarm(true); Audio.setMusic('chase');
    for (const l of this.lasers) { if (l.cfg.group === 'gallery') l.mul = this.D.laserMul * 1.3; if (l.cfg.group === 'alarm') l.enabled = true; }
    this.cameras.main.shake(400, 0.006);
    this.ai(`보안 경보! 표본 이탈 감지 — L-06 격리 셔터가 ${t}초 뒤 닫힙니다. 서쪽 출구로 탈출하십시오.`, 'warn', 4200);
    Bus.emit('mission');
  }
  endGalleryAlarm(escaped: boolean) {
    this.escape = null; Audio.alarm(false); Bus.emit('timer', -1);
    for (const l of this.lasers) { if (l.cfg.group === 'gallery') l.mul = this.D.laserMul; if (l.cfg.group === 'alarm') l.enabled = false; }
    this.redWash.fillAlpha = 0;
    if (escaped) {
      Audio.play('shutter'); this.cameras.main.shake(300, 0.005);
      this.ai('격리 셔터 폐쇄 직전에 탈출 성공. 경보 해제.', 'ok', 3200);
      this.activateCheckpoint(this.checkpoints.find(c => c.id === 'j03')!, true);
    }
    this.updateThreatMusic(); Bus.emit('mission');
  }

  // ---------------------------------------------------------------- final escape (after the 3rd lock)
  startFinalEscape() {
    const t = this.D.finalTime;
    this.escape = { kind: 'final', left: t, total: t };
    Audio.alarm(true); Audio.setMusic('chase');
    this.light.setBlackout(false);
    for (const l of this.lasers) if (l.cfg.group === 'final') { l.enabled = true; l.mul = this.D.laserMul; }
    if (G.run.difficulty === 'adv') { const D = this.D; this.guards.push(new Guard(this, { ...FINAL_GUARD, speed: D.guardSpeed, chase: D.guardChase, range: D.range, fov: D.fov, susRate: D.susRate, alertDelay: D.alertDelay, catchStun: D.catchStun, susDecay: D.susDecay })); }
    this.ai(`보안 시스템 재가동! ${t}초 안에 탈출 게이트(A-01 북쪽)를 열고 승강기에 탑승하십시오.`, 'warn', 4600);
    Bus.emit('mission');
  }

  /** per-frame: survival systems shared by every chapter + CH1 zone systems */
  tickSurvival(dt: number) {
    const p = this.player, r = G.run;
    // invulnerability blink
    if (this.invuln > 0) { this.invuln -= dt; p.root.setAlpha(this.hiding ? 0.15 : (Math.floor(this.invuln * 12) % 2 ? 0.35 : 1)); if (this.invuln <= 0 && !this.hiding) p.root.setAlpha(1); }
    // leave the locker by moving
    if (this.hiding && (Math.hypot(Pad.x, Pad.y) > 0.4 || this.keys.W.isDown || this.keys.A.isDown || this.keys.S.isDown || this.keys.D.isDown || this.keys.UP.isDown || this.keys.DOWN.isDown || this.keys.LEFT.isDown || this.keys.RIGHT.isDown)) this.exitHide();
    // walk-in pickups
    if (this.identCd > 0) this.identCd -= dt;
    for (const k of [...this.pickups]) if (!this.busy && Math.hypot(p.x - k.x, p.y - k.y) < (k.r ?? 48)) {
      // v0.6: a bone is only recovered after the identification check (pick its true feature)
      if (k.id.startsWith('bone_')) { if (this.identCd <= 0) this.identify(k.id.slice(5) as BoneId); continue; }
      this.pickups = this.pickups.filter(q => q !== k); if (k.id === 'keycard') this.tweens.add({ targets: k.obj, y: (k.obj as any).y - 60, alpha: 0, duration: 300, onComplete: () => k.obj.destroy() }); k.take(); }
    // checkpoints
    for (const c of this.checkpoints) if (!c.on && Math.hypot(p.x - c.x, p.y - c.y) < 60) this.activateCheckpoint(c);
    // guards
    const world = { px: p.x, py: p.y, hidden: !!this.hiding, blockers: this.blockers, onCatch: (g: Guard) => this.hurt('guard', g.x, g.y), onState: () => { /* via onGuardState */ } };
    for (const g of this.guards) if (!this.busy) g.update(dt, world); else g.draw(world);
    // lasers
    for (const l of this.lasers) {
      const near = Math.hypot(p.x - l.cfg.a.x, p.y - l.cfg.a.y) < 900;
      l.update(this.busy ? 0 : dt, near);
      if (!this.busy && l.hits(p.x, p.y)) this.hurt('laser', p.x - 1, p.y + 30);
    }
    // timed escapes (paused during cinematics / puzzles)
    const e = this.escape;
    if (e && !this.busy) {
      const prev = e.left; e.left -= dt;
      this.redWash.fillAlpha = 0.07 + 0.07 * Math.max(0, Math.sin(this.time.now / 160));
      if (prev > 10 && e.left <= 10) { Audio.heartbeat(true, 1.6); }
      if (e.kind === 'gallery') {
        if (p.x < GALLERY_EXIT_X - 10) { Audio.heartbeat(false); this.endGalleryAlarm(true); }
        else if (e.left <= 0) {
          Audio.heartbeat(false); Audio.play('shutter');
          this.hurt('shutter', p.x + 1, p.y);
          if (r.hp > 0) this.respawn('격리 셔터에 갇혔습니다 — 체크포인트로 복귀');
        }
      } else if (e.left <= 0) {
        Audio.heartbeat(false); e.left = e.total;
        this.hurt('shutter', p.x + 1, p.y);
        if (r.hp > 0) this.respawn('탈출 시간 초과 — 체크포인트에서 다시 시도');
      }
      if (this.escape) Bus.emit('timer', Math.max(0, e.left), e.kind === 'gallery' ? '셔터 폐쇄' : '탈출 제한');
    }
  }

  identCd = 0;
  identify(id: BoneId) {
    this.busy = true; this.player.frozen = true; Pad.x = Pad.y = 0; Pad.run = false;
    this.player.play('scan');
    Audio.play('scan');
    Bus.emit('ident', id);
  }
  onIdent(id: BoneId, ok: boolean) {
    this.busy = false; this.player.frozen = false;
    if (ok) { const k = this.pickups.find(q => q.id === `bone_${id}`); if (k) { this.pickups = this.pickups.filter(q => q !== k); k.take(); } }
    else { this.identCd = 1.5; this.toast('표본 식별을 취소했습니다 — 다시 다가가면 식별 창이 열립니다', 'info'); }
  }

  /** threats for the HUD's off-screen warnings (drones, active lasers near the player) */
  threats() {
    const out: { x: number; y: number; kind: 'guard' | 'laser'; hot: boolean }[] = [];
    for (const g of this.guards) if (Math.hypot(g.x - this.player.x, g.y - this.player.y) < 1000) out.push({ x: g.x, y: g.y - 30, kind: 'guard', hot: g.state === 'chase' || g.state === 'alert' || g.state === 'suspicious' });
    for (const l of this.lasers) { if (!l.enabled) continue; const [a, b] = l.seg(); const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; if (Math.hypot(m.x - this.player.x, m.y - this.player.y) < 700) out.push({ ...m, kind: 'laser', hot: l.on() || l.warning() }); }
    return out;
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
      if (h.only && !h.only()) { h.active = false; continue; }
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
      if (active && !this.busy && Math.hypot(this.player.x - h.x, this.player.y - h.y) < h.r * this.D.hazardScale) this.hurt(h.kind, h.x, h.y);
    }

    this.tickSurvival(dt);
    this.tickChapter(dt);

    // lift trigger
    const L = this.map.lift;
    if (G.run.flags.gate && !G.run.flags.escaped && Phaser.Math.Distance.Between(this.player.x, this.player.y, L.x, L.y) < 70) this.victory();

    // dust zone follows camera
    const v = this.cameras.main.worldView; this.dustZone.setTo(v.x, v.y, v.width, v.height);
    this.redWash.setVisible(this.redWash.fillAlpha > 0.003);
    this.light.update(dt, this.player.x, this.player.y, this.lightRadius());
    Bus.emit('tick', { px: this.player.x, py: this.player.y, obj: Save.settings.hints ? this.objective() : null, cam: v, threats: this.threats() });
  }

  timerLabel() { return '비상 전력'; }
  chapterName() { return '뼈대 복구실'; }
  locksOpen() { const f = G.run.flags; return [f.assembled, f.aligned, f.xray].filter(Boolean).length; }
  floorName() { return 'BODY LAB · B4'; }

  // inventory shown by the HUD
  invTitle() { return '뼈대 표본'; }
  invTotal() { return neededBones().length; }
  invIcon(): IconName { return 'bone'; }
  invItems(): InvItem[] {
    return G.run.bones.map(id => { const b = BONES[id]; return { id, tex: `bone_bone_${id}`, title: b.ko, en: b.en, info: b.info, tag: b.region === 'upper' ? '분류: 팔 뼈대' : '분류: 다리 뼈대', angle: id === 'humerus' || id === 'radius' || id === 'ulna' || id === 'fibula' ? 35 : 0 }; });
  }

  /** Shown as locked on the full map. */
  roomLocked(id: string) { const f = G.run.flags; return (id === 'xray' && !f.aligned) || (id === 'store' && !G.run.keycard) || (id === 'lift' && !f.gate); }

  lightRadius(): number { return G.run.flags.blackout ? 260 : 300; }

  /** Chapter-specific per-frame logic (CH1: blackout countdown + red wash). */
  tickChapter(dt: number) {
    const T = this.time.now / 1000;
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
    if (G.run.flags.blackout) this.redWash.fillAlpha = 0.05 + 0.05 * Math.max(0, Math.sin(T * 4));
  }
}
