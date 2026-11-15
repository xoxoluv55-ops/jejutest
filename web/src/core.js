// NERVE RUNNER (web) - game rules ported 1:1 from the Unity project's pure-C# Core
// (NerveRunner/Assets/NerveRunner/Scripts/Core: TrackModel, TrackPathBuilder, Chapter1/7/9Layout,
// QuizCourseLayout, StageCatalog, RunnerSim, AutoPilot, Learning) and the adapted Neon Racer
// Catmull-Rom spline (MIT). Coordinates are Unity's (left-handed: right = (cos yaw, 0, -sin yaw));
// the renderer mirrors X so the picture is correct in three.js.
"use strict";
const NR = (function () {
  // ---------------- tiny vector helpers (plain objects, Unity convention) ----------------
  const V = (x, y, z) => ({ x, y, z });
  const add = (a, b) => V(a.x + b.x, a.y + b.y, a.z + b.z);
  const sub = (a, b) => V(a.x - b.x, a.y - b.y, a.z - b.z);
  const mul = (a, s) => V(a.x * s, a.y * s, a.z * s);
  const len = a => Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
  const norm = a => { const l = len(a); return l > 1e-5 ? mul(a, 1 / l) : V(0, 0, 0); };
  const lerpV = (a, b, t) => { t = clamp01(t); return V(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t); };
  const UP = V(0, 1, 0);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const clamp01 = v => clamp(v, 0, 1);
  const lerp = (a, b, t) => a + (b - a) * clamp01(t);
  const sign = v => v >= 0 ? 1 : -1;               // Unity Mathf.Sign(0) == 1
  const D2R = Math.PI / 180, R2D = 180 / Math.PI;
  const repeat = (t, l) => clamp(t - Math.floor(t / l) * l, 0, l);
  const deltaAngle = (c, t) => { let d = repeat(t - c, 360); if (d > 180) d -= 360; return d; };
  const moveTowards = (c, t, m) => Math.abs(t - c) <= m ? t : c + Math.sign(t - c) * m;

  // ---------------- Catmull-Rom (centripetal) with arc-length LUT ----------------
  class CatmullRom {
    constructor(pts, alpha = 0.5, lut = 2000, closed = false) {
      this.p = pts; this.n = pts.length; this.alpha = alpha; this.lutN = lut; this.closed = closed; this.buildLUT();
    }
    P(i) {
      const n = this.n, p = this.p;
      if (this.closed) { i = ((i % n) + n) % n; return p[i]; }
      if (i < 0) return sub(mul(p[0], 2), p[Math.min(1, n - 1)]);
      if (i >= n) return sub(mul(p[n - 1], 2), p[Math.max(0, n - 2)]);
      return p[i];
    }
    static seg(p0, p1, p2, p3, s, a) {
      const t0 = 0, t1 = t0 + Math.pow(Math.max(1e-5, len(sub(p1, p0))), a), t2 = t1 + Math.pow(Math.max(1e-5, len(sub(p2, p1))), a), t3 = t2 + Math.pow(Math.max(1e-5, len(sub(p3, p2))), a);
      const t = t1 + (t2 - t1) * s;
      const A1 = add(mul(p0, (t1 - t) / (t1 - t0)), mul(p1, (t - t0) / (t1 - t0)));
      const A2 = add(mul(p1, (t2 - t) / (t2 - t1)), mul(p2, (t - t1) / (t2 - t1)));
      const A3 = add(mul(p2, (t3 - t) / (t3 - t2)), mul(p3, (t - t2) / (t3 - t2)));
      const B1 = add(mul(A1, (t2 - t) / (t2 - t0)), mul(A2, (t - t0) / (t2 - t0)));
      const B2 = add(mul(A2, (t3 - t) / (t3 - t1)), mul(A3, (t - t1) / (t3 - t1)));
      return add(mul(B1, (t2 - t) / (t2 - t1)), mul(B2, (t - t1) / (t2 - t1)));
    }
    point(u) {
      const segs = this.closed ? this.n : this.n - 1;
      u = this.closed ? u - Math.floor(u) : clamp01(u);
      const f = u * segs; let i = Math.floor(f); if (i >= segs) i = segs - 1;
      return CatmullRom.seg(this.P(i - 1), this.P(i), this.P(i + 1), this.P(i + 2), f - i, this.alpha);
    }
    buildLUT() {
      const N = this.lutN, c = new Float64Array(N + 1); let prev = this.point(0), acc = 0;
      for (let i = 1; i <= N; i++) { const cur = this.point(i / N); acc += len(sub(cur, prev)); c[i] = acc; prev = cur; }
      this.cum = c; this.total = acc;
    }
    dToU(d) {
      d = clamp01(d); const target = d * this.total, c = this.cum; let lo = 0, hi = this.lutN;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (c[mid] < target) lo = mid + 1; else hi = mid; }
      const idx = clamp(lo, 1, this.lutN), sl = c[idx] - c[idx - 1], fr = sl > 1e-6 ? (target - c[idx - 1]) / sl : 0;
      return clamp01((idx - 1 + fr) / this.lutN);
    }
    pointAt(d) { return this.point(this.dToU(d)); }
  }

  // ---------------- Track model ----------------
  const ZONE = { Normal: 0, ForkApproach: 1, Shortcut: 2, Review: 3, Myelin: 4, Damaged: 5, Synapse: 6 };
  const EV = { Trigger: 0, Gate: 1, NodeRing: 2, Obstacle: 3, Orb: 4, RepairOrb: 5, Checkpoint: 6, Finish: 7, Epsp: 8, Ipsp: 9, JumpPad: 10, Mover: 11, Laser: 12, Sort: 13, Reflex: 14 };
  // web 2.5 tuning (Unity/C# parity = { width: 1, arcade: false }): wider roads, arcade drift
  const TUNE = { width: 1.45, arcade: true, gap: 560, gateTail: 220 };   // gap/gateTail: room for STAR-01 to finish talking between questions (Unity: 320 / 0)

  class Segment {
    constructor(id, name, zone, hw) { this.id = id; this.name = name; this.zone = zone; this.halfWidth = hw; this.next = []; this.events = []; this.mergeOffset = 0; this.fork = null; this.theme = null; }
    build(pts) {
      this.curve = new CatmullRom(pts, 0.5, Math.max(400, pts.length * 40), false);
      this.length = this.curve.total;
      const n = Math.max(2, Math.ceil(this.length) + 1);
      this.pos = new Array(n); this.tan = new Array(n); this.yaw = new Float64Array(n); this.curv = new Float64Array(n);
      for (let i = 0; i < n; i++) this.pos[i] = this.curve.pointAt(clamp01(i / this.length));
      for (let i = 0; i < n; i++) {
        let t = sub(this.pos[Math.min(n - 1, i + 1)], this.pos[Math.max(0, i - 1)]);
        if (t.x * t.x + t.y * t.y + t.z * t.z < 1e-8) t = i > 0 ? this.tan[i - 1] : V(0, 0, 1);
        this.tan[i] = norm(t); this.yaw[i] = Math.atan2(this.tan[i].x, this.tan[i].z);
      }
      for (let i = 0; i < n; i++) {
        const i0 = Math.max(0, i - 3), i1 = Math.min(n - 1, i + 3);
        this.curv[i] = deltaAngle(this.yaw[i0] * R2D, this.yaw[i1] * R2D) * D2R / Math.max(0.5, i1 - i0);
      }
    }
    idx(s) { const f = clamp(s, 0, this.length); let i0 = Math.min(this.pos.length - 2, Math.floor(f)); if (i0 < 0) i0 = 0; return [i0, clamp01(f - i0)]; }
    pointAt(s) { const [i, f] = this.idx(s); return lerpV(this.pos[i], this.pos[i + 1], f); }
    tangentAt(s) { const [i, f] = this.idx(s); return norm(lerpV(this.tan[i], this.tan[i + 1], f)); }
    curvatureAt(s) { const [i, f] = this.idx(s); return lerp(this.curv[i], this.curv[i + 1], f); }
    rightAt(s) { const t = this.tangentAt(s); let r = V(t.z, 0, -t.x); if (r.x * r.x + r.z * r.z < 1e-6) r = V(1, 0, 0); return norm(r); }
    worldPos(s, x, y) { return add(add(this.pointAt(s), mul(this.rightAt(s), x)), mul(UP, y)); }
    sortEvents() { this.events.sort((a, b) => a.s - b.s); }
  }

  class Graph {
    constructor() { this.segments = []; this.start = null; this.referenceLength = 0; this.parTime = 0; }
    add(name, zone, hw) { const s = new Segment(this.segments.length, name, zone, hw); this.segments.push(s); return s; }
    resetRuntime() { for (const s of this.segments) for (const e of s.events) e.consumed = false; }
    *allEvents() { for (const s of this.segments) for (const e of s.events) yield e; }
  }

  const mkEvent = (type, s, x, tag) => ({ type, s, x: x || 0, width: 2.4, height: 1.3, tag: tag || null, questionId: null, laneX: null, correctLane: -1, consumed: false, index: 0 });

  class Builder {
    constructor(start, yawDeg) { this.graph = new Graph(); this.pos = start; this.yaw = yawDeg * D2R; this.pts = [start]; this.polyLen = 0; this.pending = []; this.prevSeg = null; this.pendingMerge = null; this.pendingMergeOffsets = null; }
    get fwd() { return V(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
    get right() { return V(Math.cos(this.yaw), 0, -Math.sin(this.yaw)); }
    get distance() { return this.polyLen; }
    addPoint(p) { this.polyLen += len(sub(p, this.pts[this.pts.length - 1])); this.pts.push(p); }
    straight(L, rise = 0) {
      const n = Math.max(1, Math.ceil(L / 8)), f = this.fwd, p0 = this.pos;
      for (let i = 1; i <= n; i++) { const t = i / n; this.addPoint(add(add(p0, mul(f, L * t)), mul(UP, rise * (t * t * (3 - 2 * t))))); }
      this.pos = this.pts[this.pts.length - 1]; return this;
    }
    turn(angleDeg, radius, rise = 0) {
      const ang = Math.abs(angleDeg) * D2R, side = sign(angleDeg), arc = ang * radius, n = Math.max(2, Math.ceil(arc / 8));
      const center = add(this.pos, mul(this.right, radius * side)), p0 = this.pos, yaw0 = this.yaw;
      for (let i = 1; i <= n; i++) {
        const t = i / n, a = yaw0 + side * ang * t, rightA = V(Math.cos(a), 0, -Math.sin(a));
        const p = sub(center, mul(rightA, radius * side)); p.y = p0.y + rise * (t * t * (3 - 2 * t)); this.addPoint(p);
      }
      this.yaw = yaw0 + side * ang; this.pos = this.pts[this.pts.length - 1]; return this;
    }
    event(type, x = 0, tag = null, ahead = 0) { const e = mkEvent(type, this.polyLen + ahead, x, tag); this.pending.push(e); return e; }
    trigger(tag, ahead = 0) { this.event(EV.Trigger, 0, tag, ahead); return this; }
    eventAt(type, sFromNow, x, tag = null) { const e = mkEvent(type, this.polyLen + sFromNow, x, tag); this.pending.push(e); return e; }
    straightWith(L, count, make, rise = 0) { for (let i = 0; i < count; i++) make(i, L * (i + 1) / (count + 1)); return this.straight(L, rise); }
    cut(name, zone, hw, theme = null) {
      const W = TUNE.width, seg = this.graph.add(name, zone, hw * W); seg.theme = theme; seg.build(this.pts.slice());
      const scale = this.polyLen > 1e-3 ? seg.length / this.polyLen : 1;
      for (const e of this.pending) {
        e.s = clamp(e.s * scale, 0, seg.length); seg.events.push(e);
        if (W !== 1) { if (e.laneX) e.laneX = e.laneX.map(x => x * W); else e.x *= W; if (e.type === EV.Obstacle || e.type === EV.Mover || e.type === EV.JumpPad) e.width *= W; if (e.amp) e.amp *= W; if (e.lineAmp) e.lineAmp *= W; }
      }
      seg.sortEvents(); this.pending = [];
      if (!this.graph.start) this.graph.start = seg;
      if (this.pendingMerge) {
        this.pendingMerge.forEach((b, i) => { b.next.push(seg); b.mergeOffset = this.pendingMergeOffsets[i]; });
        this.pendingMerge = null; this.pendingMergeOffsets = null;
      } else if (this.prevSeg && this.prevSeg.next.length === 0) this.prevSeg.next.push(seg);
      this.prevSeg = seg; this.pts = [this.pos]; this.polyLen = 0; return seg;
    }
    // 4.0: risk/reward split without a question: lane 0 = safe (few orbs), lane 1 = risky (movers, lasers, many orbs)
    split(approach, length, bulge) {
      const laneX = laneXs(2, 9 * TUNE.width); approach.fork = { questionId: null, laneX, correctLane: -1, free: true, labels: ["안전 루트", "위험 루트 · 보상 ×3"] }; approach.nextStartOffset = laneX;
      const F = this.pos, f = this.fwd, r = this.right, M = add(F, mul(f, length)), branches = [], mergeOffsets = [];
      for (let i = 0; i < 2; i++) {
        const o = laneX[i], oEnd = o * 0.3; mergeOffsets.push(oEnd);
        const bp = [add(F, mul(r, o)), add(add(F, mul(f, 20)), mul(r, o))], n = Math.ceil((length - 40) / 8);
        for (let k = 1; k < n; k++) { const t = k / n, along = 20 + (length - 40) * t; bp.push(add(add(F, mul(f, along)), mul(r, lerp(o, oEnd, t) + sign(o) * bulge * Math.sin(Math.PI * t)))); }
        bp.push(add(sub(M, mul(f, 20)), mul(r, oEnd))); bp.push(add(M, mul(r, oEnd)));
        const seg = this.graph.add(i ? "위험 루트" : "안전 루트", ZONE.Normal, 6 * TUNE.width); seg.theme = approach.theme; seg.build(bp); seg.risk = i === 1;
        const L = seg.length, W = TUNE.width;
        if (i === 0) for (let k = 0; k < 4; k++) seg.events.push(mkEvent(EV.Orb, 60 + k * (L - 120) / 3, 0));
        else {
          for (let k = 0; k < 14; k++) seg.events.push(mkEvent(EV.Orb, 40 + k * (L - 80) / 13, 3.5 * W * Math.sin(k * 0.9)));
          [0.25, 0.45, 0.65, 0.82].forEach((u, k) => { const m = mkEvent(k % 2 ? EV.Laser : EV.Mover, L * u, 0); Object.assign(m, k % 2 ? { period: 1.7, on: 0.8, ph: k * 0.4 } : { amp: 4 * W, w: 1.9, ph: k, width: 3.2 * W, height: 1.4 }); seg.events.push(m); });
        }
        seg.sortEvents(); approach.next.push(seg); branches.push(seg);
      }
      this.pendingMerge = branches; this.pendingMergeOffsets = mergeOffsets; this.prevSeg = null; this.pos = M; this.pts = [this.pos]; this.polyLen = 0; return branches;
    }
    fork(approach, q, length, bulge, spacing) {
      const lanes = q.options.length, laneX = laneXs(lanes, spacing * TUNE.width);
      approach.fork = { questionId: q.id, laneX, correctLane: q.answer }; approach.nextStartOffset = laneX;
      const F = this.pos, f = this.fwd, r = this.right, M = add(F, mul(f, length));
      const branches = [], mergeOffsets = [];
      for (let i = 0; i < lanes; i++) {
        const correct = i === q.answer, o = laneX[i], oEnd = o * 0.3; mergeOffsets.push(oEnd);
        const bp = [add(F, mul(r, o)), add(add(F, mul(f, 20)), mul(r, o))];
        const n = Math.ceil((length - 40) / 8);
        for (let k = 1; k < n; k++) {
          const t = k / n, along = 20 + (length - 40) * t; let lat = lerp(o, oEnd, t), y = 0;
          { const env = Math.sin(Math.PI * t) * (correct ? 0.35 : 1); if (Math.abs(o) > 0.01) lat += sign(o) * bulge * env; else { y = bulge * 0.32 * env; lat += bulge * 0.30 * Math.sin(2 * Math.PI * t) * env; } }
          bp.push(add(add(add(F, mul(f, along)), mul(r, lat)), mul(UP, y)));
        }
        bp.push(add(sub(M, mul(f, 20)), mul(r, oEnd))); bp.push(add(M, mul(r, oEnd)));
        const seg = this.graph.add((correct ? "Shortcut_" : "Review_") + q.id + "_" + i, correct ? ZONE.Shortcut : ZONE.Review, 5 * TUNE.width);
        seg.build(bp);
        seg.events.push(mkEvent(EV.Trigger, 4, 0, (correct ? "forkok:" : "review:") + q.id));
        for (let k = 0; k < 5; k++) seg.events.push(mkEvent(EV.Orb, 30 + k * 32, 0));
        seg.sortEvents(); approach.next.push(seg); branches.push(seg);
      }
      this.pendingMerge = branches; this.pendingMergeOffsets = mergeOffsets; this.prevSeg = null;
      this.pos = M; this.pts = [this.pos]; this.polyLen = 0; return branches;
    }
  }

  function laneXs(lanes, spacing) { const x = []; for (let i = 0; i < lanes; i++) x.push((i - (lanes - 1) * 0.5) * spacing); return x; }
  function shortestLength(g) {
    const memo = new Map();
    const f = s => { if (memo.has(s)) return memo.get(s); let best = 0; if (s.next.length) { best = Infinity; for (const n of s.next) best = Math.min(best, f(n)); } const v = s.length + best; memo.set(s, v); return v; };
    return f(g.start);
  }

  // ---------------- 4.0 chapter missions ----------------
  // Rapid "sort" gates: drive into the lane that matches the prompt. Short labels, no slow motion.
  const SORT_SETS = {
    nuclei: [
      { prompt: "중간뇌 층 — 여기 있는 신경핵은?", lanes: ["III 눈돌림신경핵", "XII 혀밑신경핵", "VII 얼굴신경핵"], why: "눈돌림신경핵(III)·도르래신경핵(IV)은 중간뇌에 있어요." },
      { prompt: "중간뇌 층 — 여기 있는 신경핵은?", lanes: ["IV 도르래신경핵", "VI 갓돌림신경핵", "의문핵 (IX·X)"], why: "도르래신경핵(IV)은 중간뇌 아래 둔덕 높이에 있어요." },
      { prompt: "다리뇌 층 — 여기 있는 신경핵은?", lanes: ["VI 갓돌림신경핵", "III 눈돌림신경핵", "XII 혀밑신경핵"], why: "갓돌림신경핵(VI)은 다리뇌 바닥, 얼굴신경 무릎 근처에 있어요." },
      { prompt: "다리뇌 층 — 여기 있는 신경핵은?", lanes: ["VII 얼굴신경핵", "IV 도르래신경핵", "의문핵 (IX·X)"], why: "얼굴신경핵(VII)은 다리뇌 아래쪽에 있어요." },
      { prompt: "숨뇌 층 — 여기 있는 신경핵은?", lanes: ["XII 혀밑신경핵", "III 눈돌림신경핵", "VI 갓돌림신경핵"], why: "혀밑신경핵(XII)은 숨뇌 정중선 가까이에 있어요." },
      { prompt: "숨뇌 층 — 여기 있는 신경핵은?", lanes: ["의문핵 (IX·X)", "IV 도르래신경핵", "VII 얼굴신경핵"], why: "의문핵은 숨뇌에 있고 IX·X 운동섬유(삼킴·발성)를 내보내요." },
    ],
    relay: [
      { prompt: "망막에서 온 빛 신호 → 어느 시상핵?", lanes: ["가쪽무릎핵 LGN", "안쪽무릎핵 MGN", "배쪽뒤가쪽핵 VPL"], why: "시각 정보는 가쪽무릎핵(LGN)을 거쳐 일차시각겉질로 가요." },
      { prompt: "달팽이관에서 온 소리 신호 → 어느 시상핵?", lanes: ["안쪽무릎핵 MGN", "가쪽무릎핵 LGN", "배쪽가쪽핵 VL"], why: "청각은 안쪽무릎핵(MGN)을 거쳐 일차청각겉질로 가요." },
      { prompt: "손의 촉각·통증 신호 → 어느 시상핵?", lanes: ["배쪽뒤가쪽핵 VPL", "배쪽뒤안쪽핵 VPM", "안쪽무릎핵 MGN"], why: "몸통·팔다리 감각은 VPL, 얼굴 감각은 VPM으로 가요." },
      { prompt: "얼굴의 촉각(삼차신경) → 어느 시상핵?", lanes: ["배쪽뒤안쪽핵 VPM", "배쪽뒤가쪽핵 VPL", "가쪽무릎핵 LGN"], why: "얼굴 감각(삼차신경계)은 VPM에서 중계돼요." },
      { prompt: "소뇌에서 온 운동 조절 신호 → 어느 시상핵?", lanes: ["배쪽가쪽핵 VL", "안쪽무릎핵 MGN", "배쪽뒤안쪽핵 VPM"], why: "소뇌 출력은 배쪽가쪽핵(VL)을 거쳐 운동겉질로 가요." },
    ],
    cortex: [
      { prompt: "오른손을 움직여라!", lanes: ["일차운동겉질 (이마엽)", "일차시각겉질 (뒤통수엽)", "일차청각겉질 (관자엽)"], why: "수의운동 명령은 이마엽 중심앞이랑(일차운동겉질)에서 시작해요." },
      { prompt: "말을 만들어 내라!", lanes: ["브로카 영역 (이마엽)", "베르니케 영역 (관자엽)", "일차몸감각겉질 (마루엽)"], why: "말 산출(운동성 언어)은 브로카 영역이 담당해요." },
      { prompt: "들은 말을 이해하라!", lanes: ["베르니케 영역 (관자엽)", "브로카 영역 (이마엽)", "일차운동겉질 (이마엽)"], why: "언어 이해는 관자엽 베르니케 영역이 담당해요." },
      { prompt: "물체의 모양을 보라!", lanes: ["일차시각겉질 (뒤통수엽)", "일차청각겉질 (관자엽)", "브로카 영역 (이마엽)"], why: "시각 정보는 뒤통수엽 일차시각겉질로 들어와요." },
      { prompt: "손끝 감촉을 느껴라!", lanes: ["일차몸감각겉질 (마루엽)", "일차운동겉질 (이마엽)", "일차시각겉질 (뒤통수엽)"], why: "몸 감각은 마루엽 중심뒤이랑(일차몸감각겉질)에서 느껴요." },
      { prompt: "음악 소리를 들어라!", lanes: ["일차청각겉질 (관자엽)", "일차몸감각겉질 (마루엽)", "베르니케 영역 (관자엽)"], why: "소리는 관자엽 가로관자이랑의 일차청각겉질로 들어와요." },
    ],
    cranial: [
      { prompt: "눈을 바깥쪽으로 돌려라!", lanes: ["VI 갓돌림신경", "IV 도르래신경", "III 눈돌림신경"], why: "가쪽곧은근은 갓돌림신경(VI)이 지배해요." },
      { prompt: "눈을 안쪽 아래로 내려 봐!", lanes: ["IV 도르래신경", "VI 갓돌림신경", "VII 얼굴신경"], why: "위빗근(눈을 안쪽 아래로)은 도르래신경(IV)이 지배해요." },
      { prompt: "활짝 웃는 표정!", lanes: ["VII 얼굴신경", "V 삼차신경", "XII 혀밑신경"], why: "얼굴 표정근은 얼굴신경(VII)이 지배해요." },
      { prompt: "음식을 꼭꼭 씹어라!", lanes: ["V 삼차신경", "VII 얼굴신경", "IX 혀인두신경"], why: "씹기근육은 삼차신경(V) 아래턱신경이 지배해요." },
      { prompt: "혀를 쭉 내밀어!", lanes: ["XII 혀밑신경", "X 미주신경", "XI 더부신경"], why: "혀 근육은 혀밑신경(XII)이 지배해요." },
      { prompt: "어깨를 으쓱!", lanes: ["XI 더부신경", "XII 혀밑신경", "VII 얼굴신경"], why: "등세모근·목빗근은 더부신경(XI)이 지배해요." },
      { prompt: "동공을 작게!", lanes: ["III 눈돌림신경", "VI 갓돌림신경", "II 시각신경"], why: "동공 수축(부교감)은 눈돌림신경(III)을 타고 가요." },
    ],
    // tract crossing: lane 0 = left half of the CNS, lane 1 = right half
    dcml: [["왼다리 진동 감각이 척수로 들어왔다", 0], ["널판다발 따라 위로 (척수)", 0], ["숨뇌 아래쪽 (교차 전)", 0], ["숨뇌 위쪽 (안쪽섬유띠)", 1], ["시상 VPL", 1]],
    stt: [["왼손 통증이 척수 뒤뿔로", 0], ["척수 앞흰질맞교차 (1–2 분절 위)", 1], ["숨뇌 (앞가쪽계)", 1], ["시상 VPL", 1]],
    cst: [["오른쪽 일차운동겉질 (왼손을 움직이려면)", 1], ["속섬유막", 1], ["숨뇌 피라미드 (교차 전)", 1], ["숨뇌 아래 (피라미드 교차 후)", 0], ["척수 가쪽겉질척수로", 0]],
  };
  const CROSS_WHY = { dcml: "뒤기둥-안쪽섬유띠계는 같은 쪽으로 올라가 숨뇌에서 교차해요.", stt: "앞가쪽계는 척수에 들어온 뒤 1–2 분절 안에서 바로 교차해요.", cst: "가쪽겉질척수로는 숨뇌 피라미드 교차에서 반대쪽으로 넘어가요." };
  const shuffleLanes = item => { const n = item.lanes.length, perm = [...Array(n).keys()].sort(() => Math.random() - 0.5); return { labels: perm.map(k => item.lanes[k]), correct: perm.indexOf(0) }; };
  function sortRun(b, setName, gap) {
    const set = SORT_SETS[setName], cross = !!CROSS_WHY[setName];
    b.trigger("mission:" + (cross ? "cross:" : "sort:") + setName, 2);
    const items = cross ? set : set.slice().sort(() => Math.random() - 0.5).slice(0, 4);
    items.forEach((it, i) => {
      const e = b.eventAt(EV.Sort, 120 + i * gap, 0, cross ? "cross" : "sort");
      if (cross) { e.labels = ["왼쪽", "오른쪽"]; e.correctLane = it[1]; e.prompt = it[0]; e.why = CROSS_WHY[setName]; e.laneX = laneXs(2, 8); }
      else { const sh = shuffleLanes(it); e.labels = sh.labels; e.correctLane = sh.correct; e.prompt = it.prompt; e.why = it.why; e.laneX = laneXs(3, 5.5); }
      e.index = i; e.total = items.length;
    });
    return 120 + items.length * gap + 40;
  }

  // ---------------- 4.0 racing set pieces ----------------
  function piece(b, kind, theme, dir) {
    const W = TUNE.width;
    switch (kind) {
      case "sprint": {   // long straight with boost pads and orb lines
        [60, 210, 360].forEach(s => { const p = b.eventAt(EV.JumpPad, s, 0, "boost"); p.width = 6; });
        for (let k = 0; k < 10; k++) b.eventAt(EV.Orb, 30 + k * 45, 2.6 * Math.sin(k * 0.7));
        b.straight(480); return b.cut("고속 직선 구간", ZONE.Normal, 6, theme);
      }
      case "scurve": {
        b.trigger("hint:scurve", 0); for (let k = 0; k < 8; k++) b.eventAt(EV.Orb, 20 + k * 40, (k % 4 < 2 ? 1 : -1) * 2.8 * dir);
        b.turn(dir * 60, 85); b.turn(-dir * 120, 85); b.turn(dir * 60, 85); return b.cut("S자 커브", ZONE.Normal, 6, theme);
      }
      case "jumppads": {
        b.trigger("hint:jumppad", 0);
        [70, 250].forEach(s => { const p = b.eventAt(EV.JumpPad, s, 0, "jump"); p.width = 7; const o = b.eventAt(EV.Obstacle, s + 30, 0, "pulse"); o.width = 16; o.height = 1.2; });
        for (let k = 0; k < 6; k++) b.eventAt(EV.Orb, 140 + k * 14, 0);
        b.straight(400, 6); return b.cut("점프대 구간", ZONE.Normal, 6, theme);
      }
      case "movers": {
        b.trigger("hint:movers", 0);
        [70, 140, 210, 280].forEach((s, k) => { const m = b.eventAt(EV.Mover, s, 0, "mover"); Object.assign(m, { amp: 4.2, w: 1.6 + k * 0.25, ph: k * 1.3, width: 3.2, height: 1.4 }); b.eventAt(EV.Orb, s + 30, -2.5 * Math.sin(k)); });
        b.straight(360); b.turn(dir * 35, 150); return b.cut("움직이는 NULL 구간", ZONE.Normal, 6, theme);
      }
      case "lasers": {
        b.trigger("hint:lasers", 0);
        [70, 150, 230, 310].forEach((s, k) => { const l = b.eventAt(EV.Laser, s, 0, "laser"); Object.assign(l, { period: 1.8, on: 0.85, ph: k * 0.45 }); b.eventAt(EV.Orb, s + 35, 0); });
        b.straight(380); b.turn(-dir * 35, 150); return b.cut("레이저 장벽", ZONE.Normal, 6, theme);
      }
      case "narrow": {
        b.trigger("hint:narrow", 0); for (let k = 0; k < 8; k++) b.eventAt(EV.Orb, 30 + k * 32, 0);
        b.straight(150); b.turn(dir * 25, 220); b.straight(110); return b.cut("좁은 통로", ZONE.Normal, 3.2, theme);
      }
      case "dzone": {
        b.trigger("dzone:on", 20).trigger("hint:dzone", 5); b.straight(80); b.turn(dir * 150, 48); b.straight(60); b.turn(-dir * 100, 60); b.event(EV.Trigger, 0, "dzone:off", -10); b.straight(40);
        return b.cut("드리프트 충전 구간", ZONE.Normal, 6, theme);
      }
      case "rings": {   // myelinated stretch: Ranvier rings combo
        b.trigger("hint:rings", 0); b.straight(260); b.turn(dir * 35, 220); b.straight(220);
        const total = b.distance; let k = 0; for (let d = 45; d < total - 25; d += 42, k++) { const r = b.eventAt(EV.NodeRing, d - total, 3.0 * Math.sin(k * 0.85)); r.width = 2.6; r.index = k; }
        return b.cut("말이집 고속 구간 (결절 콤보)", ZONE.Myelin, 6, theme);
      }
      case "split": {
        b.trigger("hint:split", 0); b.straight(260); const ap = b.cut("갈래 길 — 안전 vs 위험", ZONE.ForkApproach, 9, theme); b.split(ap, 420, 60); return ap;
      }
      case "balance": {   // cerebellum: follow the glowing precision line while NULL makes STAR-01 sway
        const t = b.event(EV.Trigger, 0, "line:on", 15); t.lineAmp = 3.4; t.lineLen = 90;
        b.straight(120); b.turn(dir * 40, 160); b.straight(120); b.turn(-dir * 40, 160); b.straight(60); b.event(EV.Trigger, 0, "line:off", -12);
        return b.cut("소뇌 균형 라인", ZONE.Normal, 6, theme);
      }
      case "reflex": {   // spinal reflexes: react to the stimulus with the matching action
        b.trigger("mission:reflex", 2);
        const kinds = ["stretch", "flex", "crossed", "recip", "flex", "stretch"].sort(() => Math.random() - 0.5).slice(0, 5);
        kinds.forEach((k, i) => {
          const s = 150 + i * 170, side = Math.random() < 0.5 ? -1 : 1;
          const tr = b.eventAt(EV.Trigger, s - 62, 0, "reflex:" + k); tr.side = side;
          const r = b.eventAt(EV.Reflex, s, 0, k); r.side = side;
          if (k === "flex") { const o = b.eventAt(EV.Obstacle, s + 3, 0, "tack"); o.width = 16; o.height = 1.1; }
          if (k === "crossed") { const o = b.eventAt(EV.Obstacle, s + 3, side * 3.2, "tack"); o.width = 7; o.height = 1.1; }
        });
        b.straight(150 + kinds.length * 170 + 30); return b.cut("척수반사 긴급 미션", ZONE.Normal, 6, theme);
      }
    }
  }

  // EPSP / IPSP summation zone (web 2.5). excite: collect EPSPs fast enough to reach threshold
  // (temporal summation) -> action potential + turbo. inhibit: NULL over-excites the neuron, collect
  // IPSPs to keep the membrane below threshold until the end of the zone.
  function psps(b, kind, from, to) {
    const good = kind === "excite" ? EV.Epsp : EV.Ipsp, bad = kind === "excite" ? EV.Ipsp : EV.Epsp, lanes = [-3, 2.6, 0, -2.6, 3, -1.2];
    let c = 0;
    for (let s0 = from; s0 + 50 < to; s0 += 68, c++) {
      const x = lanes[c % lanes.length], bx = x > 0 ? -3.4 : 3.4;
      for (let k = 0; k < 4; k++) b.eventAt(good, s0 + k * 11, x + Math.sin(k * 1.7) * 0.5);
      for (let k = 0; k < 2; k++) b.eventAt(bad, s0 + 8 + k * 16, bx);
    }
  }
  function integrationZone(b, kind, name, theme, dir) {
    b.trigger("integ:" + kind, 2); psps(b, kind, 30, 400); b.eventAt(EV.Trigger, 405, 0, "integ:end");
    b.straight(190); b.turn(dir * 40, 160); b.straight(110);
    return b.cut(name, ZONE.Normal, 6, theme);
  }

  // ---------------- Course layouts (ported from Chapter1/7/9Layout.cs, QuizCourseLayout.cs) ----------------
  function chapter1(bank) {
    const b = new Builder(V(0, 0, 0), 0);
    b.trigger("story:prologue", 1).trigger("hint:steer", 30).trigger("codex:dendrite", 60);
    b.trigger("integ:excite", 70); psps(b, "excite", 95, 300); b.eventAt(EV.Trigger, 300, 0, "integ:end");
    b.straight(240); b.trigger("hint:corner", 0); b.turn(55, 140); b.straight(120); b.turn(-60, 110, 6);
    b.cut("가지돌기 (Dendrites)", ZONE.Normal, 6);
    b.trigger("codex:soma", 10).trigger("banner:soma", 10);
    b.straight(100); b.turn(70, 75); b.straightWith(60, 2, (i, s) => b.eventAt(EV.Orb, s, 0)); b.turn(-70, 75); b.straight(80);
    b.cut("세포체 (Soma)", ZONE.Normal, 6);
    piece(b, "sprint", null, 1);
    b.trigger("hint:drift", 0); b.straight(140); b.turn(160, 38); b.straight(160, -6); b.turn(-90, 60); b.straight(60);
    b.event(EV.Checkpoint, 0, "cp1"); b.straight(40); b.cut("드리프트 커브", ZONE.Normal, 6);
    const qH = bank.get("ch1_fork_hillock");
    b.trigger("forkq:" + qH.id, 0).trigger("codex:hillock", 0); b.straight(300);
    const fork1 = b.cut("축삭둔덕 갈림길", ZONE.ForkApproach, 9); b.fork(fork1, qH, 380, 165, 9);
    b.trigger("story:ap", 0).trigger("codex:ap", 0);
    const AP = ["ch1_ap_1", "ch1_ap_2", "ch1_ap_3", "ch1_ap_4"], GAP = TUNE.gap || 320;
    AP.forEach((id, g) => {
      const q = bank.get(id), s0 = 60 + g * GAP;
      b.eventAt(EV.Trigger, s0, 0, "gateq:" + id);
      const gate = b.eventAt(EV.Gate, s0 + 175, 0, "ap"); gate.questionId = id; gate.laneX = laneXs(q.options.length, 6); gate.correctLane = q.answer; gate.index = g;
    });
    b.straight(60 + AP.length * GAP); b.cut("활동전위 게이트", ZONE.Normal, 9);
    piece(b, "jumppads", null, -1);
    b.trigger("story:saltatory", 0).trigger("codex:myelin", 0).trigger("codex:ranvier", 30);
    b.straight(300); b.turn(40, 200); b.straight(300); b.turn(-50, 180, 8); b.straight(220);
    { const total = b.distance; let k = 0; for (let d = 45; d < total - 30; d += 55, k++) { const r = b.eventAt(EV.NodeRing, d - total, 3.2 * Math.sin(k * 0.9)); r.width = 2.6; r.index = k; } }
    b.cut("말이집 축삭 (도약전도)", ZONE.Myelin, 6);
    const qS = bank.get("ch1_fork_saltatory");
    b.trigger("forkq:" + qS.id, 0); b.straight(280); const fork2 = b.cut("도약전도 갈림길", ZONE.ForkApproach, 9); b.fork(fork2, qS, 400, 170, 6);
    b.trigger("story:damage", 0).trigger("codex:demyelination", 0);
    b.straight(250); b.turn(-45, 150); b.straight(330);
    {
      const total = b.distance, obsS = [70, 140, 200, 270, 330, 400, 460], obsX = [0, -3, 3, 0, -2.5, 2.5, 0];
      obsS.forEach((s, i) => { const o = b.eventAt(EV.Obstacle, s - total, obsX[i]); o.width = i % 3 === 0 ? 7.5 : 3.2; o.height = 1.3; });
      [110, 240, 370].forEach((s, i) => { b.eventAt(EV.RepairOrb, s - total, [3, -3, 3][i]).index = i; });
      const qG = bank.get("ch1_gate_glia");
      b.eventAt(EV.Trigger, 420 - total, 0, "gateq:" + qG.id);
      const gate = b.eventAt(EV.Gate, 540 - total, 0, "glia"); gate.questionId = qG.id; gate.laneX = laneXs(qG.options.length, 4); gate.correctLane = qG.answer;
    }
    b.cut("수초 손상 구간", ZONE.Damaged, 6);
    piece(b, "movers", null, 1);
    b.trigger("codex:terminal", 0).trigger("banner:terminal", 0);
    b.straight(120); b.turn(90, 70); b.straightWith(80, 3, (i, s) => b.eventAt(EV.Orb, s, 0)); b.turn(-120, 45); b.straight(100);
    b.event(EV.Checkpoint, 0, "cp2"); b.cut("축삭종말", ZONE.Normal, 6);
    b.trigger("codex:synapse", 0); b.straight(90); b.event(EV.Trigger, 0, "synapse:minigame", -45); b.cut("시냅스전 막", ZONE.Normal, 6);
    b.trigger("synapse:cross", 0); b.straight(50); b.cut("시냅스 틈새", ZONE.Synapse, 5);
    b.trigger("codex:postsynaptic", 0).trigger("story:final", 5);
    b.straightWith(300, 8, (i, s) => b.eventAt(EV.Orb, s, 2.8 * Math.sin(i * 1.1))); b.turn(50, 160); b.straight(250);
    b.event(EV.Finish, 0, "finish", -10); b.cut("시냅스후 뉴런", ZONE.Normal, 6);
    const g = b.graph; g.referenceLength = shortestLength(g); g.parTime = TUNE.arcade ? g.referenceLength / 41.5 : g.referenceLength / 38 + 15; return g;
  }

  function chapter7(bank) {
    const b = new Builder(V(0, 0, 0), 0);
    const gate = (id, at, tag, sp) => { const q = bank.get(id); b.eventAt(EV.Trigger, at, 0, "gateq:" + id); const g = b.eventAt(EV.Gate, at + 175, 0, tag); g.questionId = id; g.laneX = laneXs(q.options.length, sp); g.correctLane = q.answer; };
    b.trigger("story:ch7_intro", 1).trigger("codex:frontal", 20).trigger("hint:steer", 30);
    b.trigger("integ:excite", 40); psps(b, "excite", 60, 330); b.eventAt(EV.Trigger, 335, 0, "integ:end");
    b.straight(220, 4); b.turn(45, 150); b.straight(120, 6); b.turn(-50, 120);
    b.cut("이마엽 지구 (Frontal)", ZONE.Normal, 6, "frontal");
    { const L = sortRun(b, "cortex", 150); b.straight(L); b.cut("대뇌 기능 포털 미션", ZONE.Normal, 9, "frontal"); }
    b.trigger("codex:m1", 10).trigger("codex:broca", TUNE.gap || 300); const G7 = TUNE.gap || 300; gate("ch7_gate_m1", 40, "lobe", 6); gate("ch7_gate_broca", 40 + G7, "lobe", 6); b.straight(260 + G7, -4);
    b.cut("이마엽 · 운동/언어 게이트", ZONE.Normal, 9, "frontal");
    b.trigger("forkq:ch7_fork_s1", 0); b.straight(300); let f = b.cut("감각 정보 갈림길", ZONE.ForkApproach, 9, "frontal"); b.fork(f, bank.get("ch7_fork_s1"), 380, 150, 6);
    b.trigger("story:ch7_parietal", 0).trigger("codex:parietal", 0).trigger("codex:s1", 20);
    b.straightWith(160, 4, (i, s) => b.eventAt(EV.Orb, s, 0), 8); b.turn(60, 110); b.straight(80); b.turn(-70, 90);
    b.cut("마루엽 지구 (Parietal)", ZONE.Normal, 6, "parietal");
    gate("ch7_gate_neglect", 40, "lobe", 6); b.straight(280); b.cut("마루엽 · 공간 인식 게이트", ZONE.Normal, 9, "parietal");
    piece(b, "movers", "parietal", 1);
    b.trigger("forkq:ch7_fork_a1", 0); b.straight(300); f = b.cut("청각 정보 갈림길", ZONE.ForkApproach, 9, "parietal"); b.fork(f, bank.get("ch7_fork_a1"), 400, 160, 6);
    b.trigger("story:ch7_temporal", 0).trigger("codex:temporal", 0).trigger("codex:a1", 20);
    b.turn(-45, 160, -6); b.straightWith(140, 3, (i, s) => b.eventAt(EV.Orb, s, 2.6 * Math.sin(i * 1.3))); b.turn(80, 70); b.straight(60);
    b.cut("관자엽 지구 (Temporal)", ZONE.Normal, 6, "temporal");
    piece(b, "split", "temporal", -1);
    b.trigger("codex:wernicke", 10).trigger("codex:hippocampus", TUNE.gap || 300); gate("ch7_gate_wernicke", 40, "lobe", 6); gate("ch7_gate_hippocampus", 40 + G7, "lobe", 6); b.straight(260 + G7, 4);
    b.cut("관자엽 · 언어/기억 게이트", ZONE.Normal, 9, "temporal");
    b.trigger("forkq:ch7_fork_v1", 0); b.straight(300); f = b.cut("시각 정보 갈림길", ZONE.ForkApproach, 9, "temporal"); b.fork(f, bank.get("ch7_fork_v1"), 380, 150, 9);
    b.trigger("story:ch7_occipital", 0).trigger("codex:occipital", 0).trigger("codex:v1", 20);
    b.straightWith(260, 7, (i, s) => b.eventAt(EV.Orb, s, 2.8 * Math.sin(i * 1.1))); b.turn(-40, 170); b.straight(200);
    b.event(EV.Finish, 0, "finish", -10); b.cut("뒤통수엽 지구 (Occipital)", ZONE.Normal, 6, "occipital");
    const g = b.graph; g.referenceLength = shortestLength(g); g.parTime = TUNE.arcade ? g.referenceLength / 40.5 : g.referenceLength / 38 + 10; return g;
  }

  const CH9_BOSS = ["ch9_boss_cst", "ch9_boss_hemianopia", "ch9_boss_cerebellum", "ch9_boss_lmn", "ch9_boss_wernicke"];
  function chapter9(bank) {
    const R = 170, b = new Builder(V(R, 0, 0), 0), arc = (deg, rise) => b.turn(-deg, R, rise);
    b.trigger("story:ch9_intro", 1).trigger("codex:decussation", 40).trigger("hint:steer", 20);
    arc(60, 4); b.eventAt(EV.Orb, 20, -2); b.eventAt(EV.Orb, 60, 2); arc(50, 4); b.cut("NULL 아레나 외곽", ZONE.Normal, 7, "boss");
    CH9_BOSS.forEach((id, k) => {
      const q = bank.get(id);
      b.eventAt(EV.Trigger, 15, 0, "gateq:" + id);
      const g = b.eventAt(EV.Gate, 190, 0, "boss"); g.questionId = id; g.laneX = laneXs(q.options.length, 6); g.correctLane = q.answer; g.index = k;
      arc(75, 6); b.cut("NULL 진단 게이트 " + (k + 1), ZONE.Normal, 9, "boss");
      b.trigger("boss:attack", 5);
      for (let w = 0; w < 2; w++) {
        const o = w * 125, wave = b.eventAt(EV.Obstacle, 45 + o, 0, "pulse"); wave.width = 16; wave.height = 1.2;
        if (TUNE.arcade && w === 1) { const L = b.eventAt(EV.Laser, 95 + o, 0, "laser"); Object.assign(L, { period: 1.6, on: 0.8, ph: k * 0.3 }); }
        else if (TUNE.arcade) { const m = b.eventAt(EV.Mover, 95 + o, 0, "mover"); Object.assign(m, { amp: 4, w: 2.1, ph: k, width: 3.4, height: 1.4 }); }
        else { const blk = b.eventAt(EV.Obstacle, 95 + o, (k + w) % 2 === 0 ? -3 : 3, "glitch"); blk.width = 3.4; blk.height = 1.4; }
        b.eventAt(EV.Orb, 70 + o, 0); b.eventAt(EV.Orb, 118 + o, (k + w) % 2 === 0 ? 3 : -3);
      }
      arc(95, 6); b.cut("NULL 반격 구간", ZONE.Normal, 7, "boss");
    });
    b.trigger("forkq:ch9_final_brownsequard", 0).trigger("codex:brown_sequard", 0); arc(70, 2);
    const f = b.cut("최종 진단 갈림길", ZONE.ForkApproach, 9, "boss"); b.fork(f, bank.get("ch9_final_brownsequard"), 380, 140, 9);
    b.trigger("story:ch9_final", 0).trigger("integ:inhibit", 8); psps(b, "inhibit", 20, 225); b.eventAt(EV.Trigger, 232, 0, "integ:end"); b.straight(260);
    b.event(EV.Finish, 0, "finish", -10); b.cut("신경망 복구 탈출로", ZONE.Normal, 6, "boss");
    const g = b.graph; g.referenceLength = shortestLength(g); g.parTime = g.referenceLength / 38 + 10; return g;
  }

  function quizCourse(bank, theme, title, steps) {
    const b = new Builder(V(0, 0, 0), 0); let dir = 1, obs = 0;
    for (const raw of steps) {
      const c = raw.indexOf(":"), kind = c >= 0 ? raw.slice(0, c) : raw, arg = c >= 0 ? raw.slice(c + 1) : "";
      switch (kind) {
        case "story": case "codex": case "hint": b.trigger(raw, 5); break;
        case "warm": b.trigger("hint:steer", 30); b.straightWith(220, 6, (i, s) => b.eventAt(EV.Orb, s, i % 2 === 0 ? -2.5 : 2.5)); b.turn(dir * 45, 150); b.straight(120, 4); b.cut(title + " 진입로", ZONE.Normal, 6, theme); break;
        case "gate": {
          const q = bank.get(arg); b.eventAt(EV.Trigger, 40, 0, "gateq:" + q.id);
          const g = b.eventAt(EV.Gate, 215, 0, "quiz"); g.questionId = q.id; g.laneX = laneXs(q.options.length, q.options.length === 2 ? 9 : 6); g.correctLane = q.answer;
          b.straight(300 + (TUNE.gateTail || 0)); b.turn(dir * 35, 160); b.cut(q.topic + " 게이트", ZONE.Normal, 9, theme); break;
        }
        case "fork": { const q = bank.get(arg); b.trigger("forkq:" + q.id, 0); b.straight(300); const f = b.cut(q.topic + " 갈림길", ZONE.ForkApproach, 9, theme); b.fork(f, q, 380, 150, q.options.length === 2 ? 9 : 6); break; }
        case "hairpin": b.trigger("hint:drift", 0); b.straight(100); b.turn(dir * 140, 42); b.straight(150, -4); b.turn(-dir * 80, 70); b.straight(60); b.cut("드리프트 커브", ZONE.Normal, 6, theme); break;
        case "obstacles": {
          b.trigger("hint:jump", 0); const xs = [-3, 3, 0, 3, -3];
          xs.forEach((x, i) => { const full = i === 2, o = b.eventAt(EV.Obstacle, 60 + i * 55, x, full ? "pulse" : "glitch"); o.width = full ? 16 : 3.2; o.height = 1.3; b.eventAt(EV.Orb, 85 + i * 55, -x * 0.8); });
          b.straight(360); b.turn(dir * 40, 140); b.cut(obs++ === 0 ? "NULL 교란 구간" : "NULL 교란 구간 " + obs, ZONE.Normal, 6, theme); break;
        }
        case "sprint": case "scurve": case "jumppads": case "movers": case "lasers": case "narrow": case "dzone": case "rings": case "split": case "balance": case "reflex": piece(b, kind, theme, dir); break;
        case "sort": case "cross": { const L = sortRun(b, arg, kind === "cross" ? 125 : 150); b.straight(L); b.cut(kind === "cross" ? "신경 교차 드리프트" : "포털 미션", ZONE.Normal, 9, theme); break; }
        case "excite": case "inhibit": integrationZone(b, kind, kind === "excite" ? "EPSP 가중 구간" : "IPSP 억제 구간", theme, dir); break;
        case "orbs": b.straightWith(200, 6, (i, s) => b.eventAt(EV.Orb, s, 2.6 * Math.sin(i * 1.2))); b.turn(dir * 50, 130, 5); b.cut("신호 가속 구간", ZONE.Normal, 6, theme); break;
        case "finish": b.straightWith(260, 6, (i, s) => b.eventAt(EV.Orb, s, 2.4 * Math.sin(i * 1.4))); b.event(EV.Finish, 0, "finish", -10); b.cut(title + " 결승", ZONE.Normal, 6, theme); break;
      }
      if (kind !== "story" && kind !== "codex" && kind !== "hint") dir = -dir;
    }
    const g = b.graph; g.referenceLength = shortestLength(g); g.parTime = g.referenceLength / (TUNE.arcade ? 40.5 : 39.2); return g;
  }

  // ---------------- Stage catalog (StageCatalog.cs) ----------------
  const Q = (ch, theme, title, subtitle, goals, steps) => ({ id: "ch" + ch, chapter: ch, title, subtitle, introStory: "ch" + ch + "_intro", gateTitle: title + " 게이트", goals, boss: false, build: bank => quizCourse(bank, theme, subtitle, steps) });
  const STAGES = [
    { id: "ch1", chapter: 1, title: "뉴런과 신경신호", subtitle: "뉴런 고속도로", introStory: "prologue", gateTitle: "활동전위 게이트", goals: ["뉴런의 구조", "활동전위", "도약전도", "시냅스 전달"], boss: false, build: chapter1 },
    Q(2, "spinal", "척수와 반사", "척수 반사 회로", ["척수의 구조", "반사궁", "신장반사", "상호억제·굽힘반사"], ["story:ch2_intro", "codex:ventral_horn", "warm", "sprint", "fork:ch2_fork_horn", "reflex", "gate:ch2_gate_drg", "codex:stretch_reflex", "gate:ch2_gate_spindle", "jumppads", "hairpin", "gate:ch2_gate_monosyn", "codex:reflex_arc", "fork:ch2_fork_arc", "split", "codex:reciprocal_inhibition", "inhibit", "gate:ch2_gate_reciprocal", "reflex", "codex:flexor_reflex", "gate:ch2_gate_flexor", "story:ch2_final", "finish"]),
    Q(3, "tract", "감각 오름로·운동 내림로", "신경로 고속도로", ["뒤기둥-안쪽섬유띠계", "앞가쪽계", "겉질척수로", "교차 위치"], ["story:ch3_intro", "codex:dcml", "warm", "cross:dcml", "fork:ch3_fork_dcml", "gate:ch3_gate_dcml_cross", "codex:spinothalamic", "cross:stt", "gate:ch3_gate_stt_cross", "excite", "codex:spinocerebellar", "gate:ch3_gate_scb", "scurve", "codex:cst", "cross:cst", "fork:ch3_fork_cst", "gate:ch3_gate_cst_cross", "lasers", "codex:vestibulospinal", "gate:ch3_gate_vst", "story:ch3_final", "finish"]),
    Q(4, "brainstem", "뇌줄기", "뇌줄기 터널", ["중간뇌 구조", "다리뇌와 소뇌 연결", "숨뇌 생명 중추", "뇌줄기 뇌신경핵"], ["story:ch4_intro", "codex:midbrain", "warm", "excite", "sort:nuclei", "codex:substantia_nigra", "gate:ch4_gate_sn", "gate:ch4_gate_sc", "fork:ch4_fork_ic", "rings", "gate:ch4_gate_aqueduct", "gate:ch4_gate_cn_midbrain", "codex:pons", "movers", "fork:ch4_fork_pons", "sprint", "codex:medulla", "gate:ch4_gate_medulla", "story:ch4_final", "finish"]),
    Q(5, "cerebellum", "소뇌", "소뇌 균형 서킷", ["소뇌의 기능", "조롱박세포", "소뇌다리", "소뇌 증상"], ["story:ch5_intro", "codex:cerebellum", "warm", "balance", "gate:ch5_gate_function", "dzone", "codex:purkinje", "inhibit", "gate:ch5_gate_purkinje", "scurve", "codex:cerebellar_peduncles", "fork:ch5_fork_mcp", "gate:ch5_gate_scp", "balance", "narrow", "gate:ch5_gate_vermis", "dzone", "gate:ch5_gate_tremor", "story:ch5_final", "finish"]),
    Q(6, "diencephalon", "사이뇌", "사이뇌 중계 기지", ["시상 중계핵", "시상하부 항상성", "뇌하수체 조절", "솔방울샘"], ["story:ch6_intro", "codex:thalamus", "warm", "sort:relay", "fork:ch6_fork_thalamus", "gate:ch6_gate_vpl", "gate:ch6_gate_lgn", "excite", "split", "codex:hypothalamus", "fork:ch6_fork_hypothal", "lasers", "gate:ch6_gate_pituitary", "sprint", "codex:pineal", "gate:ch6_gate_pineal", "story:ch6_final", "finish"]),
    { id: "ch7", chapter: 7, title: "대뇌", subtitle: "대뇌 도시", introStory: "ch7_intro", gateTitle: "대뇌 기능 게이트", goals: ["대뇌엽의 위치", "일차운동·감각겉질", "청각·시각겉질", "언어 영역과 실어증"], boss: false, build: chapter7 },
    Q(8, "cranial", "12뇌신경", "12뇌신경 포털", ["눈 운동 신경", "얼굴의 신경", "감각·운동·혼합 분류", "아래 뇌신경"], ["story:ch8_intro", "codex:cn_overview", "warm", "excite", "sort:cranial", "gate:ch8_gate_sensory", "codex:cn_eye", "gate:ch8_gate_abducens", "rings", "gate:ch8_gate_trochlear", "jumppads", "codex:cn_face", "fork:ch8_fork_facial", "gate:ch8_gate_trigeminal", "narrow", "codex:cn_lower", "fork:ch8_fork_hypoglossal", "gate:ch8_gate_vagus", "gate:ch8_gate_accessory", "story:ch8_final", "finish"]),
    { id: "ch9", chapter: 9, title: "임상 챌린지 (NULL)", subtitle: "NULL 보스 아레나", introStory: "ch9_intro", gateTitle: "NULL 진단 게이트", goals: ["병변 위치 추론", "교차와 반대쪽 증상", "위·아래운동신경세포", "척수 반쪽 손상"], boss: true, build: chapter9 },
  ];

  // ---------------- RunnerSim (RunnerSim.cs) ----------------
  const SE = { Trigger: 0, GateResult: 1, ForkChosen: 2, RingHit: 3, RingMiss: 4, ObstacleHit: 5, ObstacleDodged: 6, OrbCollected: 7, RepairOrb: 8, WallHit: 9, Checkpoint: 10, Finish: 11, DriftStart: 12, DriftEnd: 13, BoostStart: 14, Jump: 15, Land: 16, EnterSegment: 17, Fire: 18, Psp: 19, Seizure: 20, MissionEnd: 21, Pad: 22, SortResult: 23, ReflexStart: 24, ReflexResult: 25, LineResult: 26, RingCombo: 27 };
  const TURBO_TIME = [0, 0.5, 0.9, 1.4], TURBO_ARCADE = [0, 0.9, 1.5, 2.3];
  const VM_REST = -70, VM_THRESH = -55;
  class Sim {
    constructor(g) {
      this.graph = g; this.baseTopSpeed = 40; this.accel = 16; this.boostAccel = 30; this.boostMultiplier = 1.4; this.turboMultiplier = 1.25;
      this.steerMax = 12; this.steerSensitivity = 1; this.grip = 0.3; this.driftGrip = 0.07; this.driftSteerMul = 1.4; this.jumpVelocity = 9.5; this.gravity = 26;
      if (TUNE.arcade) { this.steerMax = 14.5; this.driftSteerMul = 1.7; this.turboMultiplier = 1.32; this.jumpVelocity = 10.2; }
      this.events = []; this.reset();
    }
    reset() {
      this.graph.resetRuntime(); this.seg = this.graph.start; this.s = 0; this.x = 0; this.y = 0; this.vx = 0; this.vy = 0; this.speed = 0;
      this.grounded = true; this.finished = false; this.raceTime = 0; this.distance = 0; this.boostEnergy = 0.35; this.boosting = false; this.canFire = true; this.wasBoosting = false;
      this.drifting = false; this.driftDir = 0; this.driftTime = 0; this.driftCharge = 0; this.turboTimer = 0; this.penaltyTimer = 0; this.wallCooldown = 0;
      this.ringChain = 0; this.ringBest = 0; this.ringsHit = 0; this.ringsTotal = 0; this.repairCount = 0; this.coins = 0; this.wallHits = 0; this.obstacleHits = 0; this.curvature = 0; this.events.length = 0;
      this.driftZone = false; this.reflex = null; this.line = null; this.sorts = 0; this.sortsOk = 0; this.reflexOk = 0; this.reflexN = 0; this.superCombos = 0;
      this.vm = VM_REST; this.mission = null; this.missionFires = 0; this.missionSeizure = false; this.refractory = 0; this.fires = 0; this.epsps = 0; this.ipsps = 0;
    }
    get position() { return this.seg.worldPos(this.s, this.x, Sim.HOVER + this.y); }
    get forward() { return this.seg.tangentAt(this.s); }
    get right() { return this.seg.rightAt(this.s); }
    get speed01() { return clamp01(this.speed / (this.baseTopSpeed * this.boostMultiplier)); }
    get driftTier() { const t = this.driftTime; return TUNE.arcade ? (t >= 1.4 ? 3 : t >= 0.8 ? 2 : t >= 0.35 ? 1 : 0) : (t >= 2 ? 3 : t >= 1.1 ? 2 : t >= 0.45 ? 1 : 0); }
    get zoneFactor() { const z = this.seg.zone; return z === ZONE.Review ? 0.7 : z === ZONE.Damaged ? Math.min(1, 0.7 + 0.1 * this.repairCount) : 1; }
    get chainBonus() { return Math.min(0.6, this.ringChain * 0.08); }
    emit(type, src = null, lane = -1, correct = false, tier = 0, tag = null) { this.events.push({ type, src, seg: this.seg, lane, correct, tier, tag: tag || (src ? src.tag : null) }); }
    addEnergy(e) { this.boostEnergy = clamp01(this.boostEnergy + e); }
    addTurbo(s) { this.turboTimer = Math.max(this.turboTimer, s); }
    addPenalty(s) { this.penaltyTimer = Math.max(this.penaltyTimer, s); }
    applySynapseResult(ok) { if (ok) { this.addTurbo(1.6); this.addEnergy(0.3); } else this.addPenalty(1.0); }
    step(inp, dt) {
      if (this.finished || dt <= 0) return;
      this.raceTime += dt; this.curvature = this.seg.curvatureAt(this.s);
      const steer = clamp(inp.steer, -1, 1);
      this.stepDrift(steer, inp.drift, dt); this.stepBoost(inp.boost, dt);
      let top = this.baseTopSpeed * this.zoneFactor * (1 + this.chainBonus);
      if (this.boosting) top *= this.boostMultiplier; if (this.turboTimer > 0) top *= this.turboMultiplier; if (this.penaltyTimer > 0) top *= 0.65;
      if (this.speed < top) this.speed = Math.min(top, this.speed + ((this.boosting || this.turboTimer > 0) ? this.boostAccel : this.accel) * dt);
      else this.speed = Math.max(top, this.speed - 25 * dt);
      if (this.drifting && !TUNE.arcade) this.speed *= (1 - 0.06 * dt);
      this.stepMembrane(dt);
      if (this.reflex) { const R = this.reflex; if (inp.jump) R.j = true; if (inp.boost) R.b = true; if (inp.drift) R.d = true; }
      if (this.line) {   // cerebellum mission: NULL makes STAR-01 sway (ataxia); stay on the precision line
        const L = this.line; if (this.seg === L.seg) { L.total += dt; if (Math.abs(this.x - this.lineX()) < 1.7) L.inside += dt; }
        this.vx += (Math.sin(this.raceTime * 1.9) * 0.7 + Math.sin(this.raceTime * 0.73 + 1) * 0.6) * 9 * dt;
      }
      const g = this.drifting ? this.driftGrip : this.grip, push = -this.curvature * this.speed * this.speed * g;
      const sm = this.steerMax * this.steerSensitivity * (this.drifting ? this.driftSteerMul : 1) * (this.grounded ? 1 : 0.7);
      if (TUNE.arcade) {   // 3.0: lateral inertia - eases in, settles out, reverses a bit faster (no snapping)
        const target = steer * sm + push, reversing = target * this.vx < 0 && Math.abs(this.vx) > 1;
        const rate = reversing ? 10 : Math.abs(target) > Math.abs(this.vx) ? 7 : 9;
        this.vx += (target - this.vx) * (1 - Math.exp(-rate * dt));
      } else this.vx = moveTowards(this.vx, steer * sm + push, 60 * dt);
      this.x += this.vx * dt;
      const limit = this.seg.halfWidth - Sim.RADIUS;
      if (Math.abs(this.x) > limit) {
        const side = sign(this.x); this.x = side * limit;
        if (this.vx * side > 0) { if (this.wallCooldown <= 0 && Math.abs(this.vx) > 2) { this.speed *= 0.8; this.wallHits++; this.wallCooldown = 0.5; this.emit(SE.WallHit); if (this.drifting && TUNE.arcade) this.failDrift(); } this.vx = 0; }
        this.speed = Math.max(0, this.speed - 10 * dt);
      }
      if (this.wallCooldown > 0) this.wallCooldown -= dt;
      if (inp.jump && this.grounded) { this.vy = this.jumpVelocity; this.grounded = false; this.emit(SE.Jump); }
      if (!this.grounded) { this.vy -= this.gravity * (TUNE.arcade ? (this.vy > 0 ? 0.9 : 1.55) : 1) * dt; this.y += this.vy * dt;   /* 3.0: snappy fall */ if (this.y <= 0) { this.y = 0; this.vy = 0; this.grounded = true; this.emit(SE.Land); } }
      if (this.turboTimer > 0) this.turboTimer -= dt; if (this.penaltyTimer > 0) this.penaltyTimer -= dt;
      const ds = this.speed * dt; this.distance += ds; let prev = this.s; this.s += ds;
      for (;;) {
        this.processEvents(prev, Math.min(this.s, this.seg.length)); if (this.finished) return;
        if (this.s < this.seg.length) break;
        const overflow = this.s - this.seg.length;
        if (!this.transition()) { this.s = this.seg.length; this.finished = true; this.emit(SE.Finish); return; }
        this.s = overflow; prev = -0.001;
      }
    }
    stepDrift(steer, held, dt) {
      const can = this.speed > this.baseTopSpeed * 0.32;
      if (!this.drifting) { if (held && can && Math.abs(steer) > 0.15) { this.drifting = true; this.driftDir = steer > 0 ? 1 : -1; this.driftTime = 0; this.driftCharge = 0; this.emit(SE.DriftStart); } return; }
      if ((!held || !can) && TUNE.arcade && this.driftTier === 0 && this.driftTime > 0.25) { this.failDrift(); return; }
      if (!held || !can) {
        const tier = this.driftTier; this.drifting = false; if (tier > 0) this.addTurbo((TUNE.arcade ? TURBO_ARCADE : TURBO_TIME)[tier]); this.addEnergy(this.driftCharge);
        this.driftTime = 0; this.driftCharge = 0; this.emit(SE.DriftEnd, null, -1, tier > 0, tier); return;
      }
      const k = this.curvature, precision = sign(k) === this.driftDir ? clamp01(Math.abs(k) * (TUNE.arcade ? 90 : 60)) : 0;
      this.driftTime += dt * (TUNE.arcade ? 0.25 + 0.75 * precision : 0.35 + 0.65 * precision) * (this.driftZone ? 1.8 : 1);   // charges only when drifting INTO a corner
      this.driftPrecision = precision; this.driftCharge = Math.min(0.5, this.driftCharge + dt * 0.12 * (0.25 + 0.75 * precision));
    }
    lineX(s) { const L = this.line; if (!L) return 0; const u = ((s == null ? this.s : s) - L.s0) / L.len; return L.amp * Math.sin(u * Math.PI * 2); }
    hitBy(e, kind) {   // shared collision response (4.0: costs speed AND energy)
      this.obstacleHits++; this.speed *= kind === "laser" ? 0.7 : 0.6; this.addPenalty(kind === "laser" ? 0.8 : 1.0); this.boostEnergy = Math.max(0, this.boostEnergy - 0.12);
      if (this.drifting) { this.drifting = false; this.driftTime = 0; this.driftCharge = 0; } this.emit(SE.ObstacleHit, e, -1, false, 0, kind);
    }
    // membrane potential: leak to rest (temporal summation window ~2 s); NULL drive in inhibit zones
    stepMembrane(dt) {
      if (this.refractory > 0) this.refractory -= dt;
      if (this.mission === "inhibit") this.vm += 9 * dt;
      this.vm += (VM_REST - this.vm) * (1 - Math.exp(-dt / 2.2));
      if (this.vm >= VM_THRESH && this.refractory <= 0) {
        this.fires++;
        if (this.mission === "inhibit") { this.missionSeizure = true; this.addPenalty(1.6); this.emit(SE.Seizure); }
        else { this.missionFires++; this.addTurbo(2.0); this.addEnergy(0.35); this.emit(SE.Fire); }
        this.vm = -82; this.refractory = 0.9;
      }
    }
    // 3.0: a drift that never reached tier 1 (e.g. on a straight) or hit a wall costs speed
    failDrift() { this.drifting = false; this.speed *= 0.88; this.driftTime = 0; this.driftCharge = 0; this.emit(SE.DriftEnd, null, -1, false, 0, "fail"); }
    stepBoost(want, dt) {
      if (this.boostEnergy <= 0.001) this.canFire = false; else if (this.boostEnergy >= 0.2) this.canFire = true;
      const active = want && this.canFire && this.boostEnergy > 0;
      if (active) this.boostEnergy = Math.max(0, this.boostEnergy - 0.42 * dt);
      if (active && !this.wasBoosting) this.emit(SE.BoostStart);
      this.wasBoosting = active; this.boosting = active;
    }
    static nearest(laneX, x) { let best = 0, bd = Infinity; laneX.forEach((l, i) => { const d = Math.abs(l - x); if (d < bd) { bd = d; best = i; } }); return best; }
    transition() {
      const from = this.seg; if (!from.next.length) return false;
      if (from.next.length > 1 && from.fork) {
        const lane = Sim.nearest(from.fork.laneX, this.x); this.x -= from.nextStartOffset[lane]; this.seg = from.next[lane];
        this.emit(SE.ForkChosen, null, lane, from.fork.free ? true : lane === from.fork.correctLane, from.fork.free ? 1 : 0, from.fork.questionId);
      } else { this.x += from.mergeOffset; this.seg = from.next[0]; }
      if (this.seg.zone !== ZONE.Myelin && from.zone === ZONE.Myelin) this.ringChain = 0;
      const limit = this.seg.halfWidth - Sim.RADIUS; this.x = clamp(this.x, -limit, limit); this.emit(SE.EnterSegment); return true;
    }
    processEvents(from, to) {
      for (const e of this.seg.events) {
        if (e.consumed || e.s <= from || e.s > to) continue;
        e.consumed = true;
        switch (e.type) {
          case EV.Trigger:
            if (e.tag === "dzone:on") this.driftZone = true; else if (e.tag === "dzone:off") this.driftZone = false;
            else if (e.tag === "line:on") this.line = { seg: this.seg, s0: e.s, amp: e.lineAmp || 3, len: e.lineLen || 90, inside: 0, total: 0 };
            else if (e.tag === "line:off" && this.line) { const L = this.line, ratio = L.total > 0 ? L.inside / L.total : 0, ok = ratio >= 0.6; if (ok) { this.addTurbo(2.2); this.addEnergy(0.4); } this.emit(SE.LineResult, e, -1, ok, 0, ratio.toFixed(2)); this.line = null; }
            else if (e.tag && e.tag.startsWith("reflex:")) { this.reflex = { kind: e.tag.slice(7), side: e.side || 1, j: false, b: false, d: false }; this.emit(SE.ReflexStart, e, -1, true, 0, this.reflex.kind); }
            if (e.tag === "integ:excite" || e.tag === "integ:inhibit") { this.mission = e.tag.slice(6); this.missionFires = 0; this.missionSeizure = false; }
            else if (e.tag === "integ:end" && this.mission) {
              const ok = this.mission === "excite" ? this.missionFires > 0 : !this.missionSeizure;
              if (ok && this.mission === "inhibit") { this.addTurbo(1.6); this.addEnergy(0.3); }
              this.emit(SE.MissionEnd, e, -1, ok, 0, this.mission); this.mission = null;
            }
            this.emit(SE.Trigger, e); break;
          case EV.Epsp: case EV.Ipsp:
            if (Math.abs(this.x - e.x) < 2.0 && this.y < 2.6) {
              const ex = e.type === EV.Epsp; if (ex) this.epsps++; else this.ipsps++;
              if (this.refractory <= 0) this.vm += ex ? 7 : -7;   // refractory period: inputs have no effect
              this.emit(SE.Psp, e, -1, this.refractory <= 0, 0, ex ? "epsp" : "ipsp");
            }
            break;
          case EV.Checkpoint: this.emit(SE.Checkpoint, e); break;
          case EV.Finish: this.finished = true; this.emit(SE.Finish, e); return;
          case EV.Gate: { const lane = Sim.nearest(e.laneX, this.x), ok = lane === e.correctLane; if (ok) { this.addTurbo(0.8); this.addEnergy(0.15); if (e.tag === "glia") this.repairCount = Math.max(this.repairCount, 3); } else this.addPenalty(1.8); this.emit(SE.GateResult, e, lane, ok); break; }
          case EV.NodeRing: this.ringsTotal++; if (Math.abs(this.x - e.x) < e.width) {
              this.ringChain++; this.ringsHit++; this.ringBest = Math.max(this.ringBest, this.ringChain); this.addEnergy(0.03);
              const perfect = Math.abs(this.x - e.x) < 0.7; this.emit(SE.RingHit, e, -1, perfect, this.ringChain);
              if (TUNE.arcade) {   // 4.0 Ranvier combo: 3 = small boost, 5 = strong boost, 10 = super combo
                const c = this.ringChain;
                if (c === 3) { this.addTurbo(0.9); this.emit(SE.RingCombo, e, -1, true, 3); }
                else if (c === 5) { this.addTurbo(1.8); this.addEnergy(0.25); this.emit(SE.RingCombo, e, -1, true, 5); }
                else if (c > 0 && c % 10 === 0) { this.addTurbo(3.2); this.addEnergy(1); this.superCombos++; this.emit(SE.RingCombo, e, -1, true, 10); }
              }
            } else { this.ringChain = 0; this.emit(SE.RingMiss, e); } break;
          case EV.JumpPad: if (Math.abs(this.x - e.x) < e.width / 2 && this.y < 1) {
              if (e.tag === "boost") { this.addTurbo(1.3); this.addEnergy(0.06); }
              else { this.vy = 15.5; this.y = Math.max(this.y, 0.02); this.grounded = false; this.addTurbo(0.5); }
              this.emit(SE.Pad, e, -1, true, 0, e.tag);
            } break;
          case EV.Mover: { const mx = e.x + e.amp * Math.sin(this.raceTime * e.w + e.ph), ov = Math.abs(this.x - mx) < e.width / 2 + Sim.RADIUS * 0.8;
            if (ov && this.y < e.height) this.hitBy(e, "mover"); else this.emit(SE.ObstacleDodged, e, -1, this.y > 0.4, 0, ov ? "jump" : "dodge"); break; }
          case EV.Laser: { const on = ((this.raceTime + e.ph) % e.period) < e.on;
            if (on && this.y < 1.4) this.hitBy(e, "laser"); else this.emit(SE.ObstacleDodged, e, -1, this.y > 0.4, 0, on ? "jump" : "laser"); break; }
          case EV.Sort: { const lane = Sim.nearest(e.laneX, this.x), ok = lane === e.correctLane; this.sorts++;
            if (ok) { this.sortsOk++; this.addTurbo(0.7); this.addEnergy(0.1); } else { this.addPenalty(0.9); this.speed *= 0.85; }
            this.emit(SE.SortResult, e, lane, ok); break; }
          case EV.Reflex: { const R = this.reflex || { kind: e.tag, side: e.side, j: false, b: false, d: false }; let ok;
            if (R.kind === "stretch") ok = R.b; else if (R.kind === "flex") ok = R.j || this.y > 0.3;
            else if (R.kind === "crossed") ok = Math.sign(this.x) === -R.side && Math.abs(this.x) > 1.5; else ok = !R.j && !R.b && !R.d;
            this.reflexN++; if (ok) { this.reflexOk++; this.addTurbo(1.0); this.addEnergy(0.12); } else this.addPenalty(0.7);
            this.emit(SE.ReflexResult, e, -1, ok, 0, R.kind); this.reflex = null; break; }
          case EV.Obstacle: { const ov = Math.abs(this.x - e.x) < e.width * 0.5 + Sim.RADIUS * 0.8; if (ov && this.y < e.height) { this.hitBy(e, e.tag || "block"); } else this.emit(SE.ObstacleDodged, e, -1, this.y > 0.4, 0, ov ? "jump" : "dodge"); break; }
          case EV.Orb: if (Math.abs(this.x - e.x) < 1.9 && this.y < 2.6) { this.coins++; this.addEnergy(0.06); this.emit(SE.OrbCollected, e); } break;
          case EV.RepairOrb: if (Math.abs(this.x - e.x) < 2.3 && this.y < 2.6) { this.repairCount = Math.min(3, this.repairCount + 1); this.addEnergy(0.05); this.emit(SE.RepairOrb, e); } break;
        }
      }
    }
  }
  Sim.HOVER = 1.1; Sim.RADIUS = 0.9;

  // ---------------- AutoPilot (AutoPilot.cs) ----------------
  class AutoPilot {
    constructor() { this.chooseLane = (qid, correct, lanes) => correct; this.driftHeld = false; }
    think(sim) {
      const seg = sim.seg; let targetX = 0, have = false, jump = false; const look = Math.max(60, sim.speed * 2.2);
      if (seg.fork && seg.length - sim.s < 220) { targetX = seg.fork.free ? seg.fork.laneX[this.risky ? 1 : 0] : seg.fork.laneX[this.chooseLane(seg.fork.questionId, seg.fork.correctLane, seg.fork.laneX.length)]; have = true; }
      let boostReq = false, holdStill = false;
      if (sim.reflex) { const R = sim.reflex; if (R.kind === "stretch") boostReq = true; else if (R.kind === "crossed") { targetX = -R.side * 5; have = true; } else if (R.kind === "recip") holdStill = true; }
      if (sim.line && !have) { targetX = sim.lineX(sim.s + sim.speed * 0.25); have = true; }
      for (const e of seg.events) {
        if (have) break; if (e.consumed || e.s < sim.s) continue; const d = e.s - sim.s; if (d > look) break;
        if (e.type === EV.Gate) { targetX = e.laneX[this.chooseLane(e.questionId, e.correctLane, e.laneX.length)]; have = true; }
        else if (e.type === EV.NodeRing || e.type === EV.RepairOrb) { targetX = e.x; have = true; }
        else if (e.type === EV.Obstacle) { if (e.width >= seg.halfWidth) { if (d < sim.speed * 0.3 + 1) jump = true; } else { targetX = e.x + (e.x <= 0 ? 1 : -1) * (e.width * 0.5 + 2.2); have = true; } }
        else if (e.type === EV.Orb && d < 40) { targetX = e.x; have = true; }
        else if (e.type === EV.Sort && d < 220) { targetX = e.laneX[e.correctLane]; have = true; }
        else if (e.type === EV.JumpPad && d < 70) { targetX = e.x; have = true; }
        else if (e.type === EV.Mover && d < 70) { const t = d / Math.max(10, sim.speed), mx = e.x + e.amp * Math.sin((sim.raceTime + t) * e.w + e.ph); targetX = clamp(mx > 0 ? mx - e.width / 2 - 2.6 : mx + e.width / 2 + 2.6, -seg.halfWidth + 1.5, seg.halfWidth - 1.5); have = true; }
        else if (e.type === EV.Laser) { const t = d / Math.max(10, sim.speed); if (d < sim.speed * 0.32 + 1 && ((sim.raceTime + t + e.ph) % e.period) < e.on + 0.15) jump = true; }
        else if (e.type === EV.Reflex && e.tag === "flex" && d < sim.speed * 0.3 + 1) jump = true;
        else if (d < 50 && ((e.type === EV.Epsp && sim.mission !== "inhibit") || (e.type === EV.Ipsp && sim.mission === "inhibit"))) { targetX = e.x; have = true; }
      }
      const k = sim.curvature, push = -k * sim.speed * sim.speed * (sim.drifting ? sim.driftGrip : sim.grip);
      const sm = sim.steerMax * sim.steerSensitivity * (sim.drifting ? sim.driftSteerMul : 1);
      let steer = clamp(((have ? targetX - sim.x : -sim.x * 0.5) * 2.5 - push) / Math.max(1, sm), -1, 1);
      if (!this.driftHeld && Math.abs(k) > 0.014 && sim.speed > 18) this.driftHeld = true; else if (this.driftHeld && Math.abs(k) < 0.006) this.driftHeld = false;
      if (this.driftHeld && !sim.drifting && Math.abs(steer) < 0.2) steer = sign(k) * 0.3;
      if (holdStill) return { steer, jump: false, drift: false, boost: false };
      return { steer, jump, drift: this.driftHeld, boost: boostReq || (sim.boostEnergy > 0.45 && Math.abs(k) < 0.004) };
    }
  }

  // ---------------- Learning (Learning.cs) ----------------
  class Bank {
    constructor(qs) { this.byId = new Map(); this.all = []; for (const q of qs) if (q && q.id) { this.byId.set(q.id, q); this.all.push(q); } }
    get(id) { return this.byId.get(id) || null; }
  }
  const wrongExp = (q, i) => (q.wrongExplanations && q.wrongExplanations[i]) || "";
  class Session {
    constructor(bank) { this.bank = bank; this.answers = []; this.codexSeen = new Set(); }
    get correct() { return this.answers.filter(a => a.correct).length; }
    get total() { return this.answers.length; }
    get accuracy() { return this.total ? this.correct / this.total : 1; }
    answer(qid, chosen, time) { const q = this.bank.get(qid), ok = !!q && chosen === q.answer; this.answers.push({ questionId: qid, chosen, correct: ok, time }); if (q && q.structures) q.structures.forEach(s => this.codexSeen.add(s)); return ok; }
    mergeInto(save, date) {
      for (const a of this.answers) {
        let note = save.wrongNotes.find(n => n.questionId === a.questionId);
        if (!a.correct) { if (!note) { note = { questionId: a.questionId, chosen: 0, wrongCount: 0, retryCount: 0, resolved: false, lastDate: "" }; save.wrongNotes.push(note); } else note.retryCount++; note.chosen = a.chosen; note.wrongCount++; note.resolved = false; note.lastDate = date; }
        else if (note) { note.retryCount++; note.resolved = true; note.lastDate = date; }
      }
      for (const c of this.codexSeen) if (!save.codexUnlocked.includes(c)) save.codexUnlocked.push(c);
    }
  }

  return { TUNE, VM_REST, VM_THRESH, V, add, sub, mul, len, norm, clamp, clamp01, lerp, sign, ZONE, EV, SE, STAGES, Sim, AutoPilot, Bank, Session, wrongExp, laneXs, CH9_BOSS };
})();
if (typeof module !== "undefined") module.exports = NR;
