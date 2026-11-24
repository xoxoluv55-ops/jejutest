import Phaser from 'phaser';
import { PuzzleBase, distBone } from './PuzzleBase';
import { View } from '../../core/view';
import { Audio } from '../../core/audio';
import { G } from '../../game/state';
import { BONES, BoneId, UPPER_ORDER } from '../../data/anatomy';
import { boneBounds, boneAnchor, bonePoint, DENSITY } from '../../art/bones';
import { T, C, drawIcon, drawPanel, Button } from '../../ui/widgets';
import { BONE_QUIZ } from '../../data/boneQuiz';

interface Piece {
  id: BoneId; img: Phaser.GameObjects.Image; zone: Phaser.GameObjects.Zone; card: Phaser.GameObjects.Graphics;
  name: Phaser.GameObjects.Text; sub: Phaser.GameObjects.Text;
  mag?: [Phaser.GameObjects.Graphics, Phaser.GameObjects.Zone];
  rect: { x: number; y: number; w: number; h: number }; home: { x: number; y: number; s: number; a: number }; placed: boolean;
}

/** 팔이음뼈 (pectoral girdle) vs 자유팔뼈 (free upper limb) — the learning goal of this puzzle. */
const GIRDLE: BoneId[] = ['clavicle', 'scapula'];
const GROUP_COL = { girdle: 0xffc24d, free: 0x4fd8ff };
/** anterior view, back -> front: scapula, ulna, humerus, radius, clavicle */
const BONE_DEPTH: Record<string, number> = { scapula: 16, ulna: 18, humerus: 20, radius: 22, clavicle: 24, fibula: 20 };
/** landmark names for the close-up (keys = tools/anatomy3d/arm_points.py / scapula_points.py); joint = articular surface */
const LANDMARK_KO: Partial<Record<BoneId, Record<string, { ko: string; joint?: boolean }>>> = {
  humerus: { head: { ko: '위팔뼈머리', joint: true }, greaterTubercle: { ko: '큰결절' }, lateralEpicondyle: { ko: '가쪽위관절융기' }, medialEpicondyle: { ko: '안쪽위관절융기' } },
  radius: { head: { ko: '노뼈머리 (작은 원반)', joint: true }, tuberosity: { ko: '노뼈거친면' }, styloid: { ko: '노뼈붓돌기' } },
  ulna: { olecranon: { ko: '팔꿈치머리' }, coronoid: { ko: '갈고리돌기' }, head: { ko: '자뼈머리', joint: true }, styloid: { ko: '자뼈붓돌기' } },
  scapula: { acromion: { ko: '봉우리' }, coracoid: { ko: '부리돌기' }, glenoid: { ko: '관절오목', joint: true }, inferiorAngle: { ko: '아래각' } },
  clavicle: { sternalEnd: { ko: '복장끝 (복장뼈와)', joint: true }, acromialEnd: { ko: '봉우리끝 (어깨뼈와)', joint: true } },
  fibula: { head: { ko: '종아리뼈머리' }, malleolus: { ko: '가쪽복사' } },
};
const groupOf = (id: BoneId) => (GIRDLE.includes(id) ? 'girdle' : 'free') as 'girdle' | 'free';

/**
 * PUZZLE 1 — 팔뼈대 조립 (right upper limb skeleton, anterior view).
 * Goal: place the 팔이음뼈 (빗장뼈·어깨뼈) and the 자유팔뼈 (위팔뼈·노뼈·자뼈) in their anatomical positions.
 * Basic: the 5 arm bones only. Advanced: names hidden until placed + a 종아리뼈 decoy to discard
 * (a leg bone that looks like the forearm bones).
 * Input: drag a card onto the skeleton, or tap a card and then tap its place.
 */
export class AssemblyPuzzle extends PuzzleBase {
  constructor() { super('Assembly'); }
  fs = 0.6; fx = 0; fy = 0;
  pieces: Piece[] = [];
  bin: { x: number; y: number; w: number; h: number; g: Phaser.GameObjects.Graphics } | null = null;
  discarded = false;
  progressT!: Phaser.GameObjects.Text;
  ghosts: Partial<Record<BoneId, Phaser.GameObjects.Image>> = {};
  glows: Partial<Record<BoneId, Phaser.GameObjects.Image>> = {};
  hot!: Phaser.GameObjects.Graphics;          // bin highlight
  hotImg!: Phaser.GameObjects.Image;          // bone-shaped outline of the slot under the finger
  tags!: Phaser.GameObjects.Container;        // name tags of placed bones
  selected: Piece | null = null;
  fbBox = { x: 0, y: 0, w: 0, h: 0 };
  fbG!: Phaser.GameObjects.Graphics; fbT!: Phaser.GameObjects.Text;
  dragging: Piece | null = null;
  dragEndAt = 0;
  view = { x: 0, w: 0 };                       // visible skeleton panel (screen x range)

  get adv() { return G.run.difficulty === 'adv'; }
  get decoys(): BoneId[] { return G.run.bones.filter(id => !UPPER_ORDER.includes(id)); }

  create() {
    this.initView();
    this.pieces = []; this.discarded = false; this.ghosts = {}; this.glows = {}; this.selected = null; this.dragging = null; this.bin = null;
    const adv = this.adv;
    this.frame('뼈대 복구 테이블 · 팔뼈대 조립',
      adv ? '오른쪽 팔뼈대(앞면). 이름이 가려진 표본의 모양만 보고 제자리에 놓고, 팔뼈가 아닌 표본은 폐기하세요.'
          : '오른쪽 팔뼈대를 앞에서 본 모습입니다. 표본 카드를 끌어 반투명한 뼈 자리에 놓거나, 카드를 누른 뒤 자리를 누르세요.');
    const { W, H } = View;
    const portrait = H > W;
    const cp = this.compact;   // short landscape (iPhone): one-line goal, shorter cards and banner
    const top = this.cTop, bottom = this.py + this.ph - (cp ? 8 : 14);

    // ---------------- skeleton (left): cropped to the upper-limb bones so it fills the column ----------------
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const id of UPPER_ORDER) { const b = boneBounds(id); x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h); }
    const crop = { x: x0 - 40, y: y0 - 30, w: x1 - x0 + 80, h: y1 - y0 + 60 };
    const maxW = portrait ? this.pw - 40 : this.pw * 0.46, areaH = portrait ? (bottom - top) * 0.5 : bottom - top;
    this.fs = Math.min(maxW / crop.w, areaH / crop.h);
    // the column is exactly as wide as the skeleton: no dead space, the rest goes to the cards
    const areaW = portrait ? maxW : crop.w * this.fs + 16;
    const areaX = this.px + 20, areaY = top;
    const shownW = crop.w * this.fs, shownH = crop.h * this.fs;
    const ox = areaX + (areaW - shownW) / 2, oy = areaY + (areaH - shownH) / 2;
    this.fx = ox - crop.x * this.fs; this.fy = oy - crop.y * this.fs;
    this.view = { x: ox, w: shownW };
    const plate = this.add.graphics();
    plate.fillStyle(0x03101c, 0.8); plate.fillRoundedRect(ox - 8, oy - 8, shownW + 16, shownH + 16, 12);
    plate.lineStyle(1.5, C.cyan, 0.35); plate.strokeRoundedRect(ox - 8, oy - 8, shownW + 16, shownH + 16, 12);
    const holo = this.add.image(this.fx, this.fy, this.textures.exists('ctx_holo') ? 'ctx_holo' : 'torso_holo').setOrigin(0).setScale(this.fs / DENSITY).setAlpha(0.32);
    const mask = this.make.graphics({}, false); mask.fillRect(ox - 8, oy - 8, shownW + 16, shownH + 16); holo.setMask(mask.createGeometryMask());
    const narrow = shownW < 300;   // narrow column: short direction labels so they do not overlap
    T(this, ox + 6, oy + 4, narrow ? '← 가쪽' : '← 가쪽 (Lateral)', 16, '#9fdcf5', { weight: '700' });
    T(this, ox + shownW - 6, oy + 4, narrow ? '안쪽 →' : '안쪽 (Medial) →', 16, '#9fdcf5', { weight: '700' }).setOrigin(1, 0);
    T(this, ox + shownW - 6, oy + shownH - 4, '오른쪽 · 앞면', 16, '#9fdcf5', { weight: '700' }).setOrigin(1, 1);
    // targets: the real bone model, translucent, with its silhouette outlined so the shape reads at a glance.
    // Placing the right specimen restores it opaque. basic: clearer fill + group-coloured outline (amber = 팔이음뼈,
    // cyan = 자유팔뼈); advanced: fainter fill + neutral outline (shape still legible, no colour hint).
    for (const id of UPPER_ORDER) {
      const b = boneBounds(id);
      const cx = this.fx + b.cx * this.fs, cy = this.fy + b.cy * this.fs;
      const gh = this.add.image(cx, cy, `bone_bone_${id}`).setScale(this.fs / DENSITY).setAlpha(adv ? 0.3 : 0.5).setTint(adv ? 0xb8c6da : 0xd8e2f0).setDepth(BONE_DEPTH[id] - 5);
      this.ghosts[id] = gh;
      if (this.textures.exists(`bone_line_${id}`)) {
        const ln = this.add.image(cx, cy, `bone_line_${id}`).setScale(this.fs / DENSITY).setTint(adv ? 0xdfe9f7 : GROUP_COL[groupOf(id)]).setAlpha(adv ? 0.55 : 0.9).setDepth(BONE_DEPTH[id] - 4);
        if (!adv) this.tweens.add({ targets: ln, alpha: 0.55, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        this.glows[id] = ln;
      }
    }
    this.hot = this.add.graphics().setDepth(40);
    this.hotImg = this.add.image(0, 0, '__WHITE').setVisible(false).setDepth(41).setBlendMode(Phaser.BlendModes.ADD);
    this.tags = this.add.container(0, 0).setDepth(45);
    // tap on the skeleton = place the selected card there
    const hit = this.add.zone(ox - 8, oy - 8, shownW + 16, shownH + 16).setOrigin(0).setInteractive();
    hit.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (this.dragging || p.getDistance() > 12 || this.time.now - this.dragEndAt < 250) return;   // the end of a drag is not a tap
      if (this.selected) { this.tryPlace(this.selected, p.worldX, p.worldY, false); return; }
      // nothing selected: tapping a restored bone opens its close-up
      const s = this.nearestSlot(p.worldX, p.worldY), pc = this.pieces.find(q => q.id === s.id);
      if (s.d < 12 && pc?.placed) this.zoom(pc, this.pieces.indexOf(pc));
    });

    // ---------------- right column: goal, cards, (bin), feedback ----------------
    const rx = portrait ? this.px + 20 : ox + shownW + (cp ? 22 : 36), rw = portrait ? this.pw - 40 : this.px + this.pw - 20 - rx;
    let y = portrait ? oy + shownH + 20 : top;
    // goal box: what is being assembled
    const goal = this.add.graphics();
    let gh: number;
    if (cp) {
      // compact: the header already says 팔뼈대 조립 -> just the two groups, coloured like the outlines
      const g1 = T(this, rx + 12, y + 6, '■ 팔이음뼈: 빗장뼈·어깨뼈 (몸통과 팔을 잇는 뼈)', 15, '#ffd98a', { weight: '700', wordWrap: { width: rw - 24 } });
      const g2 = T(this, rx + 12, g1.y + g1.height + 2, `■ 자유팔뼈: 위팔뼈·노뼈·자뼈 (손뼈 제외)${adv ? '   ※ 다리뼈 표본 1개 섞임 → 폐기' : ''}`, 15, '#9fe6ff', { weight: '700', wordWrap: { width: rw - 24 } });
      gh = g2.y + g2.height - y + 6;
    } else {
      const g1 = T(this, rx + 14, y + 10, '■ 팔이음뼈 — 빗장뼈·어깨뼈: 몸통과 팔을 잇는 뼈', 16, '#ffd98a', { weight: '700', wordWrap: { width: rw - 28 } });
      const g2 = T(this, rx + 14, g1.y + g1.height + 4, '■ 자유팔뼈 — 위팔뼈·노뼈·자뼈 (손뼈는 이번 조립에서 제외)', 16, '#9fe6ff', { weight: '700', wordWrap: { width: rw - 28 } });
      gh = g2.y + g2.height - y + 10;
    }
    goal.fillStyle(0x07121f, 0.92); goal.fillRoundedRect(rx, y, rw, gh, 10); goal.lineStyle(1.5, C.cyan, 0.5); goal.strokeRoundedRect(rx, y, rw, gh, 10);
    y += gh + (cp ? 6 : 12);
    this.progressT = T(this, rx, y, '', cp ? 16 : 18, C.white, { weight: '700' });
    y += cp ? 24 : 30;
    // feedback box reserved at the bottom of the column (never covers the cards)
    const fbH = cp ? 60 : Math.min(118, Math.max(92, (bottom - y) * 0.26));
    this.fbBox = { x: rx, y: bottom - fbH, w: rw, h: fbH };
    this.fbG = this.add.graphics().setDepth(50);
    this.fbT = T(this, rx + 20, bottom - fbH / 2, '', 18, C.white, { weight: '700', wordWrap: { width: rw - 36 }, lineSpacing: cp ? 0 : 4 }).setOrigin(0, 0.5).setDepth(51);
    // bin (advanced only)
    const binH = adv ? (cp ? 44 : 58) : 0;
    const gapY = cp ? 8 : 12;
    const cardsBottom = this.fbBox.y - gapY - (adv ? binH + gapY : 0);
    // specimen tray: every bone stands upright in its anatomical orientation (proximal up, lateral = left), at one
    // common scale close to the skeleton's, so a specimen is matched to its place by shape and size
    const ids = Phaser.Utils.Array.Shuffle([...G.run.bones]) as BoneId[];
    const gap = cp ? 6 : 10, labH = cp ? 24 : 46, mz = cp ? 36 : 44;
    const trayH = cardsBottom - y - labH;
    const dims = ids.map(id => { const b = boneBounds(id); return { w: b.w, h: b.h }; });
    let ts = Math.min((trayH - 16) / Math.max(...dims.map(d => d.h)), (rw - gap * (ids.length - 1) - ids.length * 16) / dims.reduce((a, d) => a + d.w, 0));
    ts = Math.min(ts, this.fs * 1.15);
    const minCol = cp ? 70 : 92;
    let widths = dims.map(d => Math.max(minCol, d.w * ts + 16));
    const extra = (rw - gap * (ids.length - 1) - widths.reduce((a, b) => a + b, 0)) / ids.length;
    widths = widths.map(w => w + Math.max(0, extra));
    let xx = rx;
    ids.forEach((id, i) => {
      const cw = widths[i], x = xx; xx += cw + gap;
      const ch = trayH + labH, cy = y;
      const card = this.add.graphics();
      const img = this.add.image(x + cw / 2, cy + 8 + (trayH - 8) / 2, `bone_bone_${id}`).setDepth(10);
      const s0 = ts / DENSITY; img.setScale(s0);
      const nm = adv ? `표본 ${i + 1}` : BONES[id].ko;
      const name = T(this, x + cw / 2, cy + ch - (cp ? 4 : 26), nm, cp ? 15 : 18, C.white, { weight: '700' }).setOrigin(0.5, 1);
      const sub = T(this, x + cw / 2, cy + ch - 6, cp ? '' : adv ? '?' : BONES[id].en, 15, '#c8d8f2', { weight: '600' }).setOrigin(0.5, 1);
      if (name.width > cw - 6) name.setFontSize(15);
      const zone = this.add.zone(x, cy, cw, ch).setOrigin(0).setInteractive({ useHandCursor: true, draggable: true });
      const p: Piece = { id, img, zone, card, name, sub, rect: { x, y: cy, w: cw, h: ch }, home: { x: img.x, y: img.y, s: s0, a: 0 }, placed: false };
      this.drawCard(p, 'idle');
      zone.on('pointerup', () => { if (!this.dragging) this.select(p); });
      // magnifier: look at the specimen up close (head, shaft, joint surfaces) before deciding
      const mx = x + cw - mz - 4, my = cy + 4;
      const mg = this.add.graphics().setDepth(12);
      mg.fillStyle(0x0a1a2c, 0.92); mg.fillRoundedRect(mx, my, mz, mz, 10); mg.lineStyle(1.5, C.cyan, 0.9); mg.strokeRoundedRect(mx, my, mz, mz, 10);
      mg.lineStyle(2.5, 0x9fe6ff, 1); mg.strokeCircle(mx + mz * 0.44, my + mz * 0.44, mz * 0.2); mg.lineBetween(mx + mz * 0.58, my + mz * 0.58, mx + mz * 0.78, my + mz * 0.78);
      const mzone = this.add.zone(mx - 6, my - 6, mz + 12, mz + 12).setOrigin(0).setInteractive({ useHandCursor: true }).setDepth(13);
      mzone.on('pointerup', () => { if (!this.dragging) this.zoom(p, i); });
      p.mag = [mg, mzone];
      this.pieces.push(p);
    });
    if (adv) {
      const by = cardsBottom + gapY;
      this.bin = { x: rx, y: by, w: rw, h: binH, g: this.add.graphics() };
      this.drawBin(false);
      if (cp) {
        const bt = T(this, rx + 64, by + binH / 2, '오염 표본 폐기함', 17, C.redS, { weight: '700' }).setOrigin(0, 0.5);
        T(this, bt.x + bt.width + 14, by + binH / 2, '팔뼈가 아닌 표본을 끌어 놓거나, 선택 후 누르세요', 15, '#ffc4cc').setOrigin(0, 0.5);
      } else {
        const bt = T(this, rx + 72, by + binH / 2, '폐기함', 19, C.redS, { weight: '700' }).setOrigin(0, 0.5);
        T(this, bt.x + bt.width + 16, by + binH / 2, '다리뼈 표본 1개가 섞여 있다 — 여기에 끌어 놓기', 16, '#ffc4cc', { weight: '600' }).setOrigin(0, 0.5);
      }
      const bz = this.add.zone(rx, by, rw, binH).setOrigin(0).setInteractive({ useHandCursor: true });
      bz.on('pointerup', () => { if (this.selected && !this.dragging) this.discard(this.selected); });
    }
    this.updateProgress();
    this.fb(adv ? '표본 카드를 끌어 제자리에 놓으세요. 카드를 누르면 선택되고, 자리를 누르면 배치됩니다.'
                : '노란빛 = 팔이음뼈, 파란빛 = 자유팔뼈. 카드를 끌어 같은 모양의 반투명 뼈에 놓으세요. 🔍로 크게 볼 수 있습니다.', 'info');

    // ---------------- drag ----------------
    this.input.on('dragstart', (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.Zone) => {
      const pc = this.pieces.find(q => q.zone === obj); if (!pc || pc.placed || this.solved) return;
      this.dragging = pc; this.select(pc, true);
      pc.img.setDepth(100);
      this.tweens.add({ targets: pc.img, scale: this.fs / DENSITY, angle: 0, duration: 140 });
    });
    this.input.on('drag', (p: Phaser.Input.Pointer) => {
      const pc = this.dragging; if (!pc || pc.placed || this.solved) return;
      // keep the bone above the fingertip so the finger does not hide it
      pc.img.setPosition(p.worldX, p.worldY - 46);
      this.showHot(p.worldX, p.worldY - 46);
    });
    this.input.on('dragend', (p: Phaser.Input.Pointer) => {
      this.dragEndAt = this.time.now; const pc = this.dragging; this.dragging = null; this.hot.clear(); this.hotImg.setVisible(false); if (this.bin) this.drawBin(false);
      if (!pc || pc.placed || this.solved) return;
      if (this.bin && this.inBin(p.worldX, p.worldY)) { this.discard(pc); return; }
      this.tryPlace(pc, p.worldX, p.worldY - 46, true);
    });
  }

  /** world position of a bone's slot centre (also used by the automated tests) */
  slotXY(id: BoneId): [number, number] { const a = boneAnchor(id); return [this.fx + a.x * this.fs, this.fy + a.y * this.fs]; }

  /** Close-up of one specimen: the real model large in the centre, with its orientation (basic: name + key features). */
  zoom(p: Piece, i: number) {
    if (this.solved) return;
    Audio.play('open');
    const { W, H } = View, adv = this.adv, b = BONES[p.id];
    const c = this.add.container(0, 0).setDepth(300);
    c.add(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.72).setInteractive());
    const pw = Math.min(980, W - 40), ph = H - (this.compact ? 16 : 60), px = W / 2 - pw / 2, py = H / 2 - ph / 2;
    const g = this.add.graphics(); drawPanel(g, px, py, pw, ph, { accent: C.cyan, header: 52 }); c.add(g);
    c.add(T(this, px + 26, py + 26, adv ? `표본 ${i + 1} · 확대 관찰` : `${b.ko} ${b.en} · 확대 관찰`, 21, C.white, { weight: '700' }).setOrigin(0, 0.5));
    // bone image: as large as the panel allows, anatomical orientation kept (proximal up, lateral = left)
    const img = this.add.image(px + 40 + (pw * 0.5 - 40) / 2, py + 52 + (ph - 52) / 2, `bone_bone_${p.id}`);
    const sc = Math.min((pw * 0.5 - 60 - (adv ? 0 : 230)) / img.width, (ph - 120) / img.height); img.setScale(sc); c.add(img);
    const ix = img.x - img.displayWidth / 2, iy = img.y - img.displayHeight / 2;
    // landmarks measured on the model: dot on the structure, leader line to a label beside the bone (basic only:
    // in advanced the student finds them; the dots alone show where to look)
    const LM = LANDMARK_KO[p.id] ?? {};
    const pts = Object.keys(LM).map(k => ({ k, pt: bonePoint(p.id, k) })).filter(q => q.pt) as { k: string; pt: [number, number] }[];
    const lg = this.add.graphics(); c.add(lg);
    const sides: Record<'L' | 'R', { y: number; k: string; x: number }[]> = { L: [], R: [] };
    for (const q of pts) {
      const x = ix + q.pt[0] * sc, y = iy + q.pt[1] * sc;
      const side = q.pt[0] < img.width / 2 ? 'L' : 'R';
      sides[side].push({ y, k: q.k, x });
    }
    for (const side of ['L', 'R'] as const) {
      const arr = sides[side].sort((a, b) => a.y - b.y);
      let last = -1e9;
      for (const q of arr) {
        const ly = Math.max(q.y, last + 30); last = ly;
        const lx = side === 'L' ? ix - 18 : ix + img.displayWidth + 18;
        const joint = LM[q.k].joint;
        if (!adv) { lg.lineStyle(2, joint ? 0x7fffb2 : 0xffd34d, 0.95); lg.lineBetween(q.x, q.y, lx, ly); }
        lg.fillStyle(joint ? 0x7fffb2 : 0xffd34d, 1); lg.fillCircle(q.x, q.y, 5); lg.lineStyle(2, 0x0b1018, 1); lg.strokeCircle(q.x, q.y, 5);
        if (!adv) c.add(T(this, lx + (side === 'L' ? -4 : 4), ly, LM[q.k].ko, 16, joint ? '#9fffc8' : '#ffe07a', { weight: '800', backgroundColor: '#04101cdd', padding: { x: 5, y: 2 } }).setOrigin(side === 'L' ? 1 : 0, 0.5));
      }
    }
    if (!adv && pts.length) { const ly = py + ph - 100; c.add(T(this, px + pw * 0.5 + 10, ly, '● 관절면 (다른 뼈와 만나는 곳)', 16, '#9fffc8', { weight: '700' })); c.add(T(this, px + pw * 0.5 + 10, ly + 24, '● 돌기 · 특징 구조', 16, '#ffe07a', { weight: '700' })); }
    const ar = this.add.graphics(); c.add(ar);
    ar.lineStyle(2, 0x9fdcf5, 0.8); ar.lineBetween(px + 30, py + 80, px + 30, py + ph - 40);
    ar.fillStyle(0x9fdcf5, 1); ar.fillTriangle(px + 24, py + 92, px + 36, py + 92, px + 30, py + 78);
    c.add(T(this, px + 40, py + 84, '몸쪽 (위)', 15, '#9fdcf5', { weight: '700' }));
    c.add(T(this, px + 40, py + ph - 46, '먼쪽 (아래)', 15, '#9fdcf5', { weight: '700' }).setOrigin(0, 0.5));
    c.add(T(this, ix, iy + img.displayHeight + 4, '← 가쪽', 15, '#9fdcf5', { weight: '700' }).setOrigin(0, 0));
    c.add(T(this, ix + img.displayWidth, iy + img.displayHeight + 4, '안쪽 →', 15, '#9fdcf5', { weight: '700' }).setOrigin(1, 0));
    // right column: what to look at
    const tx = px + pw * 0.5 + 10, tw = pw * 0.5 - 40;
    const lines = adv
      ? ['관찰 포인트', '· 몸쪽 끝과 먼쪽 끝 중 어느 쪽이 더 큰가?', '· 둥근 머리 / 움푹한 관절면 / 돌기가 어디에 있는가?', '· 팔뼈대의 뼈가 맞는가? (다리뼈가 섞여 있다)']
      : ['관찰 포인트', `· ${BONE_QUIZ[p.id].correct}`, `· ${b.info}`];
    let y = py + 76;
    lines.forEach((t, k) => { const tt = T(this, tx, y, t, k === 0 ? 19 : 16, k === 0 ? C.amberS : '#d3def3', { weight: k === 0 ? '700' : '600', wordWrap: { width: tw }, lineSpacing: 4 }); c.add(tt); y += tt.height + 12; });
    c.add(T(this, tx, py + ph - 34, '3D 해부 모델: BodyParts3D © DBCLS (CC BY 4.0)', 12, '#8fa0b8', { fine: true }).setOrigin(0, 0.5));
    const close = () => { Audio.play('close'); this.tweens.add({ targets: c, alpha: 0, duration: 140, onComplete: () => c.destroy() }); };
    c.add(new Button(this, px + pw - 110, py + ph - 40, '닫기', close, { w: 160, h: 48, icon: 'close' }));
    c.setAlpha(0); this.tweens.add({ targets: c, alpha: 1, duration: 160 });
    this.flushInput();
  }

  // ---------------- UI helpers ----------------
  drawCard(p: Piece, st: 'idle' | 'sel' | 'ok' | 'err' | 'gone') {
    const { x, y, w, h } = p.rect; const g = p.card; g.clear();
    const col = { idle: C.line, sel: 0xffe08a, ok: C.green, err: C.red, gone: 0x3a2030 }[st];
    g.fillStyle(st === 'ok' ? 0x082a1c : st === 'sel' ? 0x2a2208 : 0x0b1426, 0.95); g.fillRoundedRect(x, y, w, h, 12);
    g.lineStyle(st === 'idle' ? 1.5 : 3, col, 1); g.strokeRoundedRect(x, y, w, h, 12);
    if (st === 'ok') drawIcon(g, 'check', x + w - 20, y + 20, 20, C.green);
  }

  fb(text: string, kind: 'info' | 'ok' | 'err') {
    const { x, y, w, h } = this.fbBox;
    const col = { info: C.cyan, ok: C.green, err: C.red }[kind];
    const g = this.fbG; g.clear();
    g.fillStyle(kind === 'ok' ? 0x062a1a : kind === 'err' ? 0x2a0710 : 0x050c18, 0.97); g.fillRoundedRect(x, y, w, h, 10);
    g.lineStyle(2.5, col, 1); g.strokeRoundedRect(x, y, w, h, 10);
    g.fillStyle(col, 1); g.fillRect(x + 8, y + 12, 5, h - 24);
    this.fbT.setText(text).setColor(kind === 'ok' ? '#c9ffe4' : kind === 'err' ? '#ffd2d8' : C.white);
    // shrink the font if a long explanation would overflow the reserved box
    this.fbT.setMaxLines(0);
    for (const sz of [18, 17, 16, 15]) { this.fbT.setFontSize(sz); if (this.fbT.height <= h - 6) break; }
    if (this.fbT.height > h - 6) this.fbT.setMaxLines(Math.floor((h - 6) / 18));
    if (kind === 'err') this.tweens.add({ targets: [this.fbT], x: '+=6', duration: 50, yoyo: true, repeat: 3 });
  }
  // PuzzleBase calls setFeedback for its own messages; route them into the reserved box
  setFeedback(text: string, kind: 'info' | 'ok' | 'err' | 'warn' = 'info') { if (this.fbG) this.fb(text, kind === 'warn' ? 'info' : kind); }

  select(p: Piece, fromDrag = false) {
    if (p.placed || this.solved) return;
    if (this.selected && this.selected !== p) this.drawCard(this.selected, 'idle');
    this.selected = p; this.drawCard(p, 'sel');
    if (!fromDrag) { Audio.play('click'); this.fb(this.adv ? '표본을 선택했습니다. 이 뼈가 놓일 자리를 누르세요.' : `${BONES[p.id].ko} (${BONES[p.id].en}) 선택 — 왼쪽 그림에서 놓을 자리를 누르세요.`, 'info'); }
  }

  nearestSlot(x: number, y: number): { id: BoneId; d: number } {
    const fx = (x - this.fx) / this.fs, fy = (y - this.fy) / this.fs;
    let best: BoneId = UPPER_ORDER[0], bd = 1e9;
    for (const id of UPPER_ORDER) {
      const d = distBone(id, fx, fy);
      // where bones overlap (clavicle in front of the scapula, radius/ulna at the elbow) the one drawn in front owns the spot
      const tie = d <= 4 && bd <= 4;
      if (tie ? BONE_DEPTH[id] > BONE_DEPTH[best] : d < bd) { bd = Math.min(d, bd); best = id; if (!tie) bd = d; }
    }
    return { id: best, d: bd };
  }

  /** highlight the slot (or bin) under the finger while dragging */
  showHot(x: number, y: number) {
    this.hot.clear(); this.hotImg.setVisible(false);
    if (this.bin) this.drawBin(this.inBin(x, y + 46));
    const s = this.nearestSlot(x, y);
    if (s.d > 40 || this.pieces.find(q => q.id === s.id)?.placed || !this.textures.exists(`bone_line_${s.id}`)) return;
    const b = boneBounds(s.id);
    this.hotImg.setTexture(`bone_line_${s.id}`).setPosition(this.fx + b.cx * this.fs, this.fy + b.cy * this.fs).setScale(this.fs / DENSITY).setTint(0xffffff).setAlpha(1).setVisible(true);
  }

  inBin(x: number, y: number) { const b = this.bin; return !!b && x > b.x && x < b.x + b.w && y > b.y - 10 && y < b.y + b.h + 10; }
  drawBin(hotOn: boolean) {
    if (!this.bin) return; const { x, y, w, h, g } = this.bin; g.clear();
    g.fillStyle(C.red, hotOn ? 0.3 : 0.1); g.fillRoundedRect(x, y, w, h, 10);
    g.lineStyle(hotOn ? 3 : 2, C.red, hotOn ? 1 : 0.75); g.strokeRoundedRect(x, y, w, h, 10);
    drawIcon(g, 'close', x + 38, y + h / 2, 28, C.red);
  }

  updateProgress() {
    const n = this.pieces.filter(p => p.placed && UPPER_ORDER.includes(p.id)).length;
    this.progressT.setText(this.decoys.length ? `조립 ${n}/5   ·   폐기 ${this.discarded ? 1 : 0}/${this.decoys.length}` : `조립 ${n}/5`);
  }

  back(pc: Piece, err: boolean) {
    this.tweens.add({ targets: pc.img, x: pc.home.x, y: pc.home.y, scale: pc.home.s, angle: pc.home.a, duration: 260, ease: 'Cubic.out', onComplete: () => pc.img.setDepth(10) });
    if (err) {
      this.drawCard(pc, 'err');
      this.time.delayedCall(280, () => this.tweens.add({ targets: pc.img, x: pc.home.x + 8, duration: 55, yoyo: true, repeat: 3, onComplete: () => { pc.img.setX(pc.home.x); if (!pc.placed) this.drawCard(pc, this.selected === pc ? 'sel' : 'idle'); } }));
    }
  }

  // ---------------- game logic ----------------
  discard(pc: Piece) {
    if (pc.placed || this.solved) return;
    const b = BONES[pc.id];
    if (!UPPER_ORDER.includes(pc.id)) {
      pc.placed = true; this.discarded = true; this.selected = null; pc.zone.disableInteractive();
      Audio.play('snap');
      this.tweens.add({ targets: pc.img, scale: 0, alpha: 0, angle: 180, duration: 380, ease: 'Back.in' });
      this.drawCard(pc, 'gone'); pc.name.setText(`폐기 · ${b.ko}`).setColor(C.redS); pc.sub.setText(this.compact ? '' : b.en);
      this.fb(`정답! ${b.ko}(${b.en})는 다리(종아리)의 뼈입니다. 노뼈·자뼈와 달리 팔꿉관절을 이루지 않아 팔뼈대에는 쓰지 않아요.`, 'ok');
      this.updateProgress(); this.check();
      return;
    }
    Audio.play('error'); this.mistake(); G.run.stats.assembly++;
    this.fb(`${this.adv ? '이 표본' : b.ko}은(는) 팔뼈대의 뼈입니다. 폐기하면 안 돼요! (${groupOf(pc.id) === 'girdle' ? '팔이음뼈' : '자유팔뼈'})`, 'err');
    this.back(pc, true);
  }

  tryPlace(pc: Piece, x: number, y: number, dropped: boolean) {
    if (pc.placed || this.solved) return;
    const b = BONES[pc.id];
    const s = this.nearestSlot(x, y);
    const fx = (x - this.fx) / this.fs, fy = (y - this.fy) / this.fs;
    // correct slot (forgiving on touch)
    // correct only if the drop point is closest to this bone's own slot (radius and ulna lie side by side on the real
    // model, so "within 40 of its own bone" alone would accept a radius dropped on the ulna)
    const own = UPPER_ORDER.includes(pc.id) ? distBone(pc.id, fx, fy) : 1e9;
    if (own < 40 && (s.id === pc.id || (own <= s.d + 2 && !(s.d <= 4 && own <= 4)))) { this.place(pc); return; }
    if (s.d > 40) { if (dropped) this.back(pc, false); return; }          // dropped/tapped away from any bone
    if (this.pieces.find(q => q.id === s.id)?.placed) { this.fb(`그 자리에는 이미 ${BONES[s.id].ko}이(가) 놓여 있습니다.`, 'info'); if (dropped) this.back(pc, false); return; }
    Audio.play('error'); this.mistake(); G.run.stats.assembly++;
    this.cameras.main.shake(100, 0.002);
    if (!UPPER_ORDER.includes(pc.id)) this.fb(`이 표본은 팔뼈대 어디에도 맞지 않습니다. ${this.adv ? '다리뼈일까요? 폐기함을 확인하세요.' : ''}`, 'err');
    else this.fb(`${b.wrongSlot}${this.adv ? '' : `  (그 자리는 ${BONES[s.id].ko} 자리입니다.)`}`, 'err');
    this.back(pc, true);
  }

  place(pc: Piece) {
    const b = BONES[pc.id], bb = boneBounds(pc.id);
    pc.placed = true; this.selected = null; pc.zone.disableInteractive(); pc.mag?.forEach(o => o.destroy());
    const tx = this.fx + bb.cx * this.fs, ty = this.fy + bb.cy * this.fs;
    this.tweens.add({ targets: pc.img, x: tx, y: ty, scale: this.fs / DENSITY, angle: 0, duration: 180, ease: 'Back.out' });
    pc.img.setDepth(BONE_DEPTH[pc.id]);
    Audio.play('snap');
    this.ghosts[pc.id]?.destroy(); this.glows[pc.id]?.destroy();
    const flash = this.add.image(tx, ty, `bone_holo_${pc.id}`).setScale(this.fs / DENSITY).setBlendMode(Phaser.BlendModes.ADD).setDepth(30).setAlpha(0.5);
    this.tweens.add({ targets: flash, alpha: 0, duration: 700, onComplete: () => flash.destroy() });
    // name tag on the skeleton: where it went
    const col = groupOf(pc.id) === 'girdle' ? '#ffd98a' : '#9fe6ff';
    const tag = T(this, 0, 0, `✓ ${b.ko} ${b.en}`, 16, col, { weight: '700', backgroundColor: '#04101ccc', padding: { x: 6, y: 3 } });
    const lx = Math.min(Math.max(tx - tag.width / 2, this.view.x + 2), this.view.x + this.view.w - tag.width - 2);
    const an = boneAnchor(pc.id), dy = ({ radius: -0.22, ulna: 0.22 } as Partial<Record<BoneId, number>>)[pc.id] ?? 0;
    const lx2 = Math.min(Math.max(this.fx + an.x * this.fs - tag.width / 2, this.view.x + 2), this.view.x + this.view.w - tag.width - 2);
    tag.setPosition(lx2, this.fy + an.y * this.fs + dy * bb.h * this.fs - tag.height / 2); this.tags.add(tag); void lx;
    this.drawCard(pc, 'ok'); pc.name.setText(b.ko).setColor(C.greenS); pc.sub.setText(this.compact ? '' : `${b.en} · 배치 완료`).setColor('#a8f5cf'); if (this.compact) pc.name.setText(`✓ ${b.ko}`);
    this.fb(`${b.ko}(${b.en}) — ${groupOf(pc.id) === 'girdle' ? '팔이음뼈' : '자유팔뼈'}. ${b.info}`, 'ok');
    this.updateProgress(); this.check();
  }

  check() {
    const allPlaced = UPPER_ORDER.every(id => this.pieces.find(p => p.id === id)?.placed);
    if (!allPlaced || (this.decoys.length > 0 && !this.discarded)) return;
    this.solved = true;
    for (const id of UPPER_ORDER) {
      const bb = boneBounds(id);
      const h = this.add.image(this.fx + bb.cx * this.fs, this.fy + bb.cy * this.fs, `bone_holo_${id}`).setScale(this.fs / DENSITY).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(22);
      this.tweens.add({ targets: h, alpha: 0.45, duration: 300, delay: UPPER_ORDER.indexOf(id) * 140, yoyo: true, hold: 300 });
    }
    this.fb('팔뼈대 조립 완료! 팔이음뼈(빗장뼈·어깨뼈)와 자유팔뼈(위팔뼈·노뼈·자뼈)가 복장빗장관절 → 봉우리빗장관절 → 오목위팔관절 → 팔꿉관절로 이어집니다.', 'ok');
    this.success('c_girdle', '팔은 복장빗장관절로만 몸통 뼈대와 이어진다', 1800);
  }
}
