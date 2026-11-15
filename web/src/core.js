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
  const EV = { Trigger: 0, Gate: 1, NodeRing: 2, Obstacle: 3, Orb: 4, RepairOrb: 5, Checkpoint: 6, Finish: 7 };

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
      const seg = this.graph.add(name, zone, hw); seg.theme = theme; seg.build(this.pts.slice());
      const scale = this.polyLen > 1e-3 ? seg.length / this.polyLen : 1;
      for (const e of this.pending) { e.s = clamp(e.s * scale, 0, seg.length); seg.events.push(e); }
      seg.sortEvents(); this.pending = [];
      if (!this.graph.start) this.graph.start = seg;
      if (this.pendingMerge) {
        this.pendingMerge.forEach((b, i) => { b.next.push(seg); b.mergeOffset = this.pendingMergeOffsets[i]; });
        this.pendingMerge = null; this.pendingMergeOffsets = null;
      } else if (this.prevSeg && this.prevSeg.next.length === 0) this.prevSeg.next.push(seg);
      this.prevSeg = seg; this.pts = [this.pos]; this.polyLen = 0; return seg;
    }
    fork(approach, q, length, bulge, spacing) {
      const lanes = q.options.length, laneX = laneXs(lanes, spacing);
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
        const seg = this.graph.add((correct ? "Shortcut_" : "Review_") + q.id + "_" + i, correct ? ZONE.Shortcut : ZONE.Review, 5);
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

  // ---------------- Course layouts (ported from Chapter1/7/9Layout.cs, QuizCourseLayout.cs) ----------------
  function chapter1(bank) {
    const b = new Builder(V(0, 0, 0), 0);
    b.trigger("story:prologue", 1).trigger("hint:steer", 30).trigger("codex:dendrite", 60);
    b.straightWith(240, 6, (i, s) => b.eventAt(EV.Orb, s, i % 2 === 0 ? -2.5 : 2.5));
    b.trigger("hint:corner", 0); b.turn(55, 140); b.straight(120); b.turn(-60, 110, 6);
    b.cut("가지돌기 (Dendrites)", ZONE.Normal, 6);
    b.trigger("codex:soma", 10).trigger("banner:soma", 10);
    b.straight(100); b.turn(70, 75); b.straightWith(60, 2, (i, s) => b.eventAt(EV.Orb, s, 0)); b.turn(-70, 75); b.straight(80);
    b.cut("세포체 (Soma)", ZONE.Normal, 6);
    b.trigger("hint:drift", 0); b.straight(140); b.turn(160, 38); b.straight(160, -6); b.turn(-90, 60); b.straight(60);
    b.event(EV.Checkpoint, 0, "cp1"); b.straight(40); b.cut("드리프트 커브", ZONE.Normal, 6);
    const qH = bank.get("ch1_fork_hillock");
    b.trigger("forkq:" + qH.id, 0).trigger("codex:hillock", 0); b.straight(300);
    const fork1 = b.cut("축삭둔덕 갈림길", ZONE.ForkApproach, 9); b.fork(fork1, qH, 380, 165, 9);
    b.trigger("story:ap", 0).trigger("codex:ap", 0);
    const AP = ["ch1_ap_1", "ch1_ap_2", "ch1_ap_3", "ch1_ap_4"], GAP = 320;
    AP.forEach((id, g) => {
      const q = bank.get(id), s0 = 60 + g * GAP;
      b.eventAt(EV.Trigger, s0, 0, "gateq:" + id);
      const gate = b.eventAt(EV.Gate, s0 + 175, 0, "ap"); gate.questionId = id; gate.laneX = laneXs(q.options.length, 6); gate.correctLane = q.answer; gate.index = g;
    });
    b.straight(60 + AP.length * GAP); b.cut("활동전위 게이트", ZONE.Normal, 9);
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
    b.trigger("codex:terminal", 0).trigger("banner:terminal", 0);
    b.straight(120); b.turn(90, 70); b.straightWith(80, 3, (i, s) => b.eventAt(EV.Orb, s, 0)); b.turn(-120, 45); b.straight(100);
    b.event(EV.Checkpoint, 0, "cp2"); b.cut("축삭종말", ZONE.Normal, 6);
    b.trigger("codex:synapse", 0); b.straight(90); b.event(EV.Trigger, 0, "synapse:minigame", -45); b.cut("시냅스전 막", ZONE.Normal, 6);
    b.trigger("synapse:cross", 0); b.straight(50); b.cut("시냅스 틈새", ZONE.Synapse, 5);
    b.trigger("codex:postsynaptic", 0).trigger("story:final", 5);
    b.straightWith(300, 8, (i, s) => b.eventAt(EV.Orb, s, 2.8 * Math.sin(i * 1.1))); b.turn(50, 160); b.straight(250);
    b.event(EV.Finish, 0, "finish", -10); b.cut("시냅스후 뉴런", ZONE.Normal, 6);
    const g = b.graph; g.referenceLength = shortestLength(g); g.parTime = g.referenceLength / 38 + 15; return g;
  }

  function chapter7(bank) {
    const b = new Builder(V(0, 0, 0), 0);
    const gate = (id, at, tag, sp) => { const q = bank.get(id); b.eventAt(EV.Trigger, at, 0, "gateq:" + id); const g = b.eventAt(EV.Gate, at + 175, 0, tag); g.questionId = id; g.laneX = laneXs(q.options.length, sp); g.correctLane = q.answer; };
    b.trigger("story:ch7_intro", 1).trigger("codex:frontal", 20).trigger("hint:steer", 30);
    b.straightWith(220, 6, (i, s) => b.eventAt(EV.Orb, s, i % 2 === 0 ? -2.5 : 2.5), 4); b.turn(45, 150); b.straight(120, 6); b.turn(-50, 120);
    b.cut("이마엽 지구 (Frontal)", ZONE.Normal, 6, "frontal");
    b.trigger("codex:m1", 10).trigger("codex:broca", 300); gate("ch7_gate_m1", 40, "lobe", 6); gate("ch7_gate_broca", 340, "lobe", 6); b.straight(600, -4);
    b.cut("이마엽 · 운동/언어 게이트", ZONE.Normal, 9, "frontal");
    b.trigger("forkq:ch7_fork_s1", 0); b.straight(300); let f = b.cut("감각 정보 갈림길", ZONE.ForkApproach, 9, "frontal"); b.fork(f, bank.get("ch7_fork_s1"), 380, 150, 6);
    b.trigger("story:ch7_parietal", 0).trigger("codex:parietal", 0).trigger("codex:s1", 20);
    b.straightWith(160, 4, (i, s) => b.eventAt(EV.Orb, s, 0), 8); b.turn(60, 110); b.straight(80); b.turn(-70, 90);
    b.cut("마루엽 지구 (Parietal)", ZONE.Normal, 6, "parietal");
    gate("ch7_gate_neglect", 40, "lobe", 6); b.straight(280); b.cut("마루엽 · 공간 인식 게이트", ZONE.Normal, 9, "parietal");
    b.trigger("forkq:ch7_fork_a1", 0); b.straight(300); f = b.cut("청각 정보 갈림길", ZONE.ForkApproach, 9, "parietal"); b.fork(f, bank.get("ch7_fork_a1"), 400, 160, 6);
    b.trigger("story:ch7_temporal", 0).trigger("codex:temporal", 0).trigger("codex:a1", 20);
    b.turn(-45, 160, -6); b.straightWith(140, 3, (i, s) => b.eventAt(EV.Orb, s, 2.6 * Math.sin(i * 1.3))); b.turn(80, 70); b.straight(60);
    b.cut("관자엽 지구 (Temporal)", ZONE.Normal, 6, "temporal");
    b.trigger("codex:wernicke", 10).trigger("codex:hippocampus", 300); gate("ch7_gate_wernicke", 40, "lobe", 6); gate("ch7_gate_hippocampus", 340, "lobe", 6); b.straight(600, 4);
    b.cut("관자엽 · 언어/기억 게이트", ZONE.Normal, 9, "temporal");
    b.trigger("forkq:ch7_fork_v1", 0); b.straight(300); f = b.cut("시각 정보 갈림길", ZONE.ForkApproach, 9, "temporal"); b.fork(f, bank.get("ch7_fork_v1"), 380, 150, 9);
    b.trigger("story:ch7_occipital", 0).trigger("codex:occipital", 0).trigger("codex:v1", 20);
    b.straightWith(260, 7, (i, s) => b.eventAt(EV.Orb, s, 2.8 * Math.sin(i * 1.1))); b.turn(-40, 170); b.straight(200);
    b.event(EV.Finish, 0, "finish", -10); b.cut("뒤통수엽 지구 (Occipital)", ZONE.Normal, 6, "occipital");
    const g = b.graph; g.referenceLength = shortestLength(g); g.parTime = g.referenceLength / 38 + 10; return g;
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
        const blk = b.eventAt(EV.Obstacle, 95 + o, (k + w) % 2 === 0 ? -3 : 3, "glitch"); blk.width = 3.4; blk.height = 1.4;
        b.eventAt(EV.Orb, 70 + o, 0); b.eventAt(EV.Orb, 118 + o, (k + w) % 2 === 0 ? 3 : -3);
      }
      arc(95, 6); b.cut("NULL 반격 구간", ZONE.Normal, 7, "boss");
    });
    b.trigger("forkq:ch9_final_brownsequard", 0).trigger("codex:brown_sequard", 0); arc(70, 2);
    const f = b.cut("최종 진단 갈림길", ZONE.ForkApproach, 9, "boss"); b.fork(f, bank.get("ch9_final_brownsequard"), 380, 140, 9);
    b.trigger("story:ch9_final", 0); b.straightWith(260, 6, (i, s) => b.eventAt(EV.Orb, s, 2.5 * Math.sin(i * 1.2)));
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
          b.straight(300); b.turn(dir * 35, 160); b.cut(q.topic + " 게이트", ZONE.Normal, 9, theme); break;
        }
        case "fork": { const q = bank.get(arg); b.trigger("forkq:" + q.id, 0); b.straight(300); const f = b.cut(q.topic + " 갈림길", ZONE.ForkApproach, 9, theme); b.fork(f, q, 380, 150, q.options.length === 2 ? 9 : 6); break; }
        case "hairpin": b.trigger("hint:drift", 0); b.straight(100); b.turn(dir * 140, 42); b.straight(150, -4); b.turn(-dir * 80, 70); b.straight(60); b.cut("드리프트 커브", ZONE.Normal, 6, theme); break;
        case "obstacles": {
          b.trigger("hint:jump", 0); const xs = [-3, 3, 0, 3, -3];
          xs.forEach((x, i) => { const full = i === 2, o = b.eventAt(EV.Obstacle, 60 + i * 55, x, full ? "pulse" : "glitch"); o.width = full ? 16 : 3.2; o.height = 1.3; b.eventAt(EV.Orb, 85 + i * 55, -x * 0.8); });
          b.straight(360); b.turn(dir * 40, 140); b.cut(obs++ === 0 ? "NULL 교란 구간" : "NULL 교란 구간 " + obs, ZONE.Normal, 6, theme); break;
        }
        case "orbs": b.straightWith(200, 6, (i, s) => b.eventAt(EV.Orb, s, 2.6 * Math.sin(i * 1.2))); b.turn(dir * 50, 130, 5); b.cut("신호 가속 구간", ZONE.Normal, 6, theme); break;
        case "finish": b.straightWith(260, 6, (i, s) => b.eventAt(EV.Orb, s, 2.4 * Math.sin(i * 1.4))); b.event(EV.Finish, 0, "finish", -10); b.cut(title + " 결승", ZONE.Normal, 6, theme); break;
      }
      if (kind !== "story" && kind !== "codex" && kind !== "hint") dir = -dir;
    }
    const g = b.graph; g.referenceLength = shortestLength(g); g.parTime = g.referenceLength / 39.2; return g;
  }

  // ---------------- Stage catalog (StageCatalog.cs) ----------------
  const Q = (ch, theme, title, subtitle, goals, steps) => ({ id: "ch" + ch, chapter: ch, title, subtitle, introStory: "ch" + ch + "_intro", gateTitle: title + " 게이트", goals, boss: false, build: bank => quizCourse(bank, theme, subtitle, steps) });
  const STAGES = [
    { id: "ch1", chapter: 1, title: "뉴런과 신경신호", subtitle: "뉴런 고속도로", introStory: "prologue", gateTitle: "활동전위 게이트", goals: ["뉴런의 구조", "활동전위", "도약전도", "시냅스 전달"], boss: false, build: chapter1 },
    Q(2, "spinal", "척수와 반사", "척수 반사 회로", ["척수의 구조", "반사궁", "신장반사", "상호억제·굽힘반사"], ["story:ch2_intro", "codex:ventral_horn", "warm", "fork:ch2_fork_horn", "gate:ch2_gate_drg", "codex:stretch_reflex", "gate:ch2_gate_spindle", "hairpin", "gate:ch2_gate_monosyn", "codex:reflex_arc", "fork:ch2_fork_arc", "obstacles", "codex:reciprocal_inhibition", "gate:ch2_gate_reciprocal", "codex:flexor_reflex", "gate:ch2_gate_flexor", "story:ch2_final", "finish"]),
    Q(3, "tract", "감각 오름로·운동 내림로", "신경로 고속도로", ["뒤기둥-안쪽섬유띠계", "앞가쪽계", "겉질척수로", "교차 위치"], ["story:ch3_intro", "codex:dcml", "warm", "fork:ch3_fork_dcml", "gate:ch3_gate_dcml_cross", "codex:spinothalamic", "gate:ch3_gate_stt_cross", "orbs", "codex:spinocerebellar", "gate:ch3_gate_scb", "hairpin", "codex:cst", "fork:ch3_fork_cst", "gate:ch3_gate_cst_cross", "obstacles", "codex:vestibulospinal", "gate:ch3_gate_vst", "story:ch3_final", "finish"]),
    Q(4, "brainstem", "뇌줄기", "뇌줄기 터널", ["중간뇌 구조", "다리뇌와 소뇌 연결", "숨뇌 생명 중추", "뇌줄기 뇌신경핵"], ["story:ch4_intro", "codex:midbrain", "warm", "codex:substantia_nigra", "gate:ch4_gate_sn", "gate:ch4_gate_sc", "fork:ch4_fork_ic", "hairpin", "gate:ch4_gate_aqueduct", "gate:ch4_gate_cn_midbrain", "codex:pons", "fork:ch4_fork_pons", "obstacles", "codex:medulla", "gate:ch4_gate_medulla", "story:ch4_final", "finish"]),
    Q(5, "cerebellum", "소뇌", "소뇌 균형 서킷", ["소뇌의 기능", "조롱박세포", "소뇌다리", "소뇌 증상"], ["story:ch5_intro", "codex:cerebellum", "warm", "gate:ch5_gate_function", "hairpin", "codex:purkinje", "gate:ch5_gate_purkinje", "codex:cerebellar_peduncles", "fork:ch5_fork_mcp", "gate:ch5_gate_scp", "hairpin", "obstacles", "gate:ch5_gate_vermis", "gate:ch5_gate_tremor", "story:ch5_final", "finish"]),
    Q(6, "diencephalon", "사이뇌", "사이뇌 중계 기지", ["시상 중계핵", "시상하부 항상성", "뇌하수체 조절", "솔방울샘"], ["story:ch6_intro", "codex:thalamus", "warm", "fork:ch6_fork_thalamus", "gate:ch6_gate_vpl", "gate:ch6_gate_lgn", "orbs", "codex:hypothalamus", "fork:ch6_fork_hypothal", "hairpin", "gate:ch6_gate_pituitary", "obstacles", "codex:pineal", "gate:ch6_gate_pineal", "story:ch6_final", "finish"]),
    { id: "ch7", chapter: 7, title: "대뇌", subtitle: "대뇌 도시", introStory: "ch7_intro", gateTitle: "대뇌 기능 게이트", goals: ["대뇌엽의 위치", "일차운동·감각겉질", "청각·시각겉질", "언어 영역과 실어증"], boss: false, build: chapter7 },
    Q(8, "cranial", "12뇌신경", "12뇌신경 포털", ["눈 운동 신경", "얼굴의 신경", "감각·운동·혼합 분류", "아래 뇌신경"], ["story:ch8_intro", "codex:cn_overview", "warm", "gate:ch8_gate_sensory", "codex:cn_eye", "gate:ch8_gate_abducens", "gate:ch8_gate_trochlear", "hairpin", "codex:cn_face", "fork:ch8_fork_facial", "gate:ch8_gate_trigeminal", "obstacles", "codex:cn_lower", "fork:ch8_fork_hypoglossal", "gate:ch8_gate_vagus", "gate:ch8_gate_accessory", "story:ch8_final", "finish"]),
    { id: "ch9", chapter: 9, title: "임상 챌린지 (NULL)", subtitle: "NULL 보스 아레나", introStory: "ch9_intro", gateTitle: "NULL 진단 게이트", goals: ["병변 위치 추론", "교차와 반대쪽 증상", "위·아래운동신경세포", "척수 반쪽 손상"], boss: true, build: chapter9 },
  ];

  // ---------------- RunnerSim (RunnerSim.cs) ----------------
  const SE = { Trigger: 0, GateResult: 1, ForkChosen: 2, RingHit: 3, RingMiss: 4, ObstacleHit: 5, ObstacleDodged: 6, OrbCollected: 7, RepairOrb: 8, WallHit: 9, Checkpoint: 10, Finish: 11, DriftStart: 12, DriftEnd: 13, BoostStart: 14, Jump: 15, Land: 16, EnterSegment: 17 };
  const TURBO_TIME = [0, 0.5, 0.9, 1.4];
  class Sim {
    constructor(g) {
      this.graph = g; this.baseTopSpeed = 40; this.accel = 16; this.boostAccel = 30; this.boostMultiplier = 1.4; this.turboMultiplier = 1.25;
      this.steerMax = 12; this.steerSensitivity = 1; this.grip = 0.3; this.driftGrip = 0.07; this.driftSteerMul = 1.4; this.jumpVelocity = 9.5; this.gravity = 26;
      this.events = []; this.reset();
    }
    reset() {
      this.graph.resetRuntime(); this.seg = this.graph.start; this.s = 0; this.x = 0; this.y = 0; this.vx = 0; this.vy = 0; this.speed = 0;
      this.grounded = true; this.finished = false; this.raceTime = 0; this.distance = 0; this.boostEnergy = 0.35; this.boosting = false; this.canFire = true; this.wasBoosting = false;
      this.drifting = false; this.driftDir = 0; this.driftTime = 0; this.driftCharge = 0; this.turboTimer = 0; this.penaltyTimer = 0; this.wallCooldown = 0;
      this.ringChain = 0; this.ringBest = 0; this.ringsHit = 0; this.ringsTotal = 0; this.repairCount = 0; this.coins = 0; this.wallHits = 0; this.obstacleHits = 0; this.curvature = 0; this.events.length = 0;
    }
    get position() { return this.seg.worldPos(this.s, this.x, Sim.HOVER + this.y); }
    get forward() { return this.seg.tangentAt(this.s); }
    get right() { return this.seg.rightAt(this.s); }
    get speed01() { return clamp01(this.speed / (this.baseTopSpeed * this.boostMultiplier)); }
    get driftTier() { const t = this.driftTime; return t >= 2 ? 3 : t >= 1.1 ? 2 : t >= 0.45 ? 1 : 0; }
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
      if (this.drifting) this.speed *= (1 - 0.06 * dt);
      const g = this.drifting ? this.driftGrip : this.grip, push = -this.curvature * this.speed * this.speed * g;
      const sm = this.steerMax * this.steerSensitivity * (this.drifting ? this.driftSteerMul : 1) * (this.grounded ? 1 : 0.7);
      this.vx = moveTowards(this.vx, steer * sm + push, 60 * dt); this.x += this.vx * dt;
      const limit = this.seg.halfWidth - Sim.RADIUS;
      if (Math.abs(this.x) > limit) {
        const side = sign(this.x); this.x = side * limit;
        if (this.vx * side > 0) { if (this.wallCooldown <= 0 && Math.abs(this.vx) > 2) { this.speed *= 0.8; this.wallHits++; this.wallCooldown = 0.5; this.emit(SE.WallHit); } this.vx = 0; }
        this.speed = Math.max(0, this.speed - 10 * dt);
      }
      if (this.wallCooldown > 0) this.wallCooldown -= dt;
      if (inp.jump && this.grounded) { this.vy = this.jumpVelocity; this.grounded = false; this.emit(SE.Jump); }
      if (!this.grounded) { this.vy -= this.gravity * dt; this.y += this.vy * dt; if (this.y <= 0) { this.y = 0; this.vy = 0; this.grounded = true; this.emit(SE.Land); } }
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
      if (!held || !can) {
        const tier = this.driftTier; this.drifting = false; if (tier > 0) this.addTurbo(TURBO_TIME[tier]); this.addEnergy(this.driftCharge);
        this.driftTime = 0; this.driftCharge = 0; this.emit(SE.DriftEnd, null, -1, tier > 0, tier); return;
      }
      const k = this.curvature, precision = sign(k) === this.driftDir ? clamp01(Math.abs(k) * 60) : 0;
      this.driftTime += dt * (0.35 + 0.65 * precision); this.driftCharge = Math.min(0.5, this.driftCharge + dt * 0.12 * (0.25 + 0.75 * precision));
    }
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
        this.emit(SE.ForkChosen, null, lane, lane === from.fork.correctLane, 0, from.fork.questionId);
      } else { this.x += from.mergeOffset; this.seg = from.next[0]; }
      if (this.seg.zone !== ZONE.Myelin && from.zone === ZONE.Myelin) this.ringChain = 0;
      const limit = this.seg.halfWidth - Sim.RADIUS; this.x = clamp(this.x, -limit, limit); this.emit(SE.EnterSegment); return true;
    }
    processEvents(from, to) {
      for (const e of this.seg.events) {
        if (e.consumed || e.s <= from || e.s > to) continue;
        e.consumed = true;
        switch (e.type) {
          case EV.Trigger: this.emit(SE.Trigger, e); break;
          case EV.Checkpoint: this.emit(SE.Checkpoint, e); break;
          case EV.Finish: this.finished = true; this.emit(SE.Finish, e); return;
          case EV.Gate: { const lane = Sim.nearest(e.laneX, this.x), ok = lane === e.correctLane; if (ok) { this.addTurbo(0.8); this.addEnergy(0.15); if (e.tag === "glia") this.repairCount = Math.max(this.repairCount, 3); } else this.addPenalty(1.8); this.emit(SE.GateResult, e, lane, ok); break; }
          case EV.NodeRing: this.ringsTotal++; if (Math.abs(this.x - e.x) < e.width) { this.ringChain++; this.ringsHit++; this.ringBest = Math.max(this.ringBest, this.ringChain); this.addEnergy(0.03); this.emit(SE.RingHit, e); } else { this.ringChain = 0; this.emit(SE.RingMiss, e); } break;
          case EV.Obstacle: { const ov = Math.abs(this.x - e.x) < e.width * 0.5 + Sim.RADIUS * 0.8; if (ov && this.y < e.height) { this.obstacleHits++; this.speed *= 0.6; this.addPenalty(1.0); if (this.drifting) { this.drifting = false; this.driftTime = 0; this.driftCharge = 0; } this.emit(SE.ObstacleHit, e); } else this.emit(SE.ObstacleDodged, e); break; }
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
      if (seg.fork && seg.length - sim.s < 220) { targetX = seg.fork.laneX[this.chooseLane(seg.fork.questionId, seg.fork.correctLane, seg.fork.laneX.length)]; have = true; }
      for (const e of seg.events) {
        if (have) break; if (e.consumed || e.s < sim.s) continue; const d = e.s - sim.s; if (d > look) break;
        if (e.type === EV.Gate) { targetX = e.laneX[this.chooseLane(e.questionId, e.correctLane, e.laneX.length)]; have = true; }
        else if (e.type === EV.NodeRing || e.type === EV.RepairOrb) { targetX = e.x; have = true; }
        else if (e.type === EV.Obstacle) { if (e.width >= seg.halfWidth) { if (d < sim.speed * 0.3 + 1) jump = true; } else { targetX = e.x + (e.x <= 0 ? 1 : -1) * (e.width * 0.5 + 2.2); have = true; } }
        else if (e.type === EV.Orb && d < 40) { targetX = e.x; have = true; }
      }
      const k = sim.curvature, push = -k * sim.speed * sim.speed * (sim.drifting ? sim.driftGrip : sim.grip);
      const sm = sim.steerMax * sim.steerSensitivity * (sim.drifting ? sim.driftSteerMul : 1);
      let steer = clamp(((have ? targetX - sim.x : -sim.x * 0.5) * 2.5 - push) / Math.max(1, sm), -1, 1);
      if (!this.driftHeld && Math.abs(k) > 0.014 && sim.speed > 18) this.driftHeld = true; else if (this.driftHeld && Math.abs(k) < 0.006) this.driftHeld = false;
      if (this.driftHeld && !sim.drifting && Math.abs(steer) < 0.2) steer = sign(k) * 0.3;
      return { steer, jump, drift: this.driftHeld, boost: sim.boostEnergy > 0.45 && Math.abs(k) < 0.004 };
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

  return { V, add, sub, mul, len, norm, clamp, clamp01, lerp, sign, ZONE, EV, SE, STAGES, Sim, AutoPilot, Bank, Session, wrongExp, laneXs, CH9_BOSS };
})();
if (typeof module !== "undefined") module.exports = NR;
