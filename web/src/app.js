// NERVE RUNNER - web/iPad edition. Same rules and content as the Unity project (core.js is a 1:1 port
// of the pure-C# Core); this file is the view: three.js world, STAR-01, DOM UI, touch, WebAudio music,
// speechSynthesis voice, slow-motion thinking time and localStorage saves.
"use strict";
window.NR_MAIN = function () {
  const C = window.NR_CONTENT, $ = s => document.querySelector(s), $$ = s => Array.from(document.querySelectorAll(s));
  const bank = new NR.Bank(C.questions), codexById = new Map(C.codex.map(c => [c.id, c]));
  const HASH = location.hash || "", AUTO = /auto/.test(HASH), WARP = (HASH.match(/warp=(\d+)/) || [])[1] | 0 || 1;

  //================== SAVE ==================
  const SAVE_KEY = "nerverunner_web_v1";
  const save = Object.assign({ voiceRate: 1.08, voicePitch: 1.0, voiceURI: "", voiceOn: true, musicOn: true, sfxOn: true, thinkSlow: 0.4, quality: "auto", showHints: true, best: {}, wrongNotes: [], codexUnlocked: [], lastStage: "ch1", storySeen: {}, plays: 0 }, (() => { try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch (e) { return {}; } })());
  if (!(save.v >= 3)) { save.thinkSlow = 0.75; save.v = 3; }      // 2.5: slow motion was too slow
  if (!(save.v >= 4)) { save.voicePitch = 1.0; save.voiceRate = 1.08; save.v = 4; }   // 2.6: raised pitch sounded synthetic
  const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { } };

  //================== AUDIO (NRMusic.cs port + simple SFX) ==================
  const Snd = {
    ctx: null, master: null, music: null, sfx: null, bufs: {}, cur: null, curName: null, hum: null, humGain: null, duck: 1,
    unlock() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
        this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
        this.music = this.ctx.createGain(); this.music.gain.value = save.musicOn ? 0.55 : 0; this.music.connect(this.master);
        this.sfx = this.ctx.createGain(); this.sfx.gain.value = save.sfxOn ? 0.5 : 0; this.sfx.connect(this.master);
        const o = this.ctx.createOscillator(), f = this.ctx.createBiquadFilter(); o.type = "sawtooth"; o.frequency.value = 70; f.type = "lowpass"; f.frequency.value = 500;
        this.humGain = this.ctx.createGain(); this.humGain.gain.value = 0; o.connect(f); f.connect(this.humGain); this.humGain.connect(this.sfx); o.start(); this.hum = o;
      }
      if (this.ctx.state !== "running") this.ctx.resume();
      if (this.want) this.play(this.want);
    },
    render(name, seconds, fn) {
      const R = 22050, n = Math.max(1, (seconds * R) | 0), b = this.ctx.createBuffer(1, n, R), d = b.getChannelData(0);
      for (let i = 0; i < n; i++) { const m = fn(i / R, i), e = Math.min(1, Math.min(i, n - 1 - i) / 220); d[i] = m * (27 + m * m) / (27 + 9 * m * m) * e; }
      return b;
    },
    buf(name) {
      if (this.bufs[name]) return this.bufs[name];
      const TAU = Math.PI * 2, N = m => 440 * Math.pow(2, (m - 69) / 12), rep = (t, l) => t - Math.floor(t / l) * l;
      const Sq = (f, t, d = 0.5) => rep(f * t, 1) < d ? 1 : -1, Tri = (f, t) => 4 * Math.abs(rep(f * t, 1) - 0.5) - 1;
      const Noise = i => { const x = Math.sin(i * 127.1) * 43758.547; return (x - Math.floor(x)) * 2 - 1; };
      let b;
      if (name === "menu") {
        const spb = 60 / 92, bar = spb * 4, ch = [[53, 57, 60, 64], [55, 59, 62, 65], [52, 55, 59, 62], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 67], [52, 55, 59, 64], [57, 60, 64, 69]], arp = [0, 1, 2, 3, 2, 1, 2, 3];
        b = this.render(name, bar * 8, t => {
          const bi = ((t / bar) | 0) % 8, tb = t - Math.floor(t / spb) * spb, tib = t - Math.floor(t / bar) * bar;
          const env = Math.min(1, Math.max(0, tib / 0.6)) * Math.min(1, Math.max(0, (bar - tib) / 0.5)); let pad = 0;
          for (let k = 0; k < 4; k++) { const f = N(ch[bi][k]); pad += Math.sin(TAU * f * t) + 0.4 * Math.sin(TAU * f * 1.003 * t); }
          pad *= env * 0.035; const t8 = spb * 0.5, e = (t / t8) | 0, lt = t - e * t8, af = N(ch[bi][arp[e % 8]] + 12);
          const box = (Math.sin(TAU * af * t) + 0.3 * Math.sin(TAU * af * 2 * t)) * Math.exp(-lt * 7) * 0.12, beat = ((t / spb) | 0) % 4;
          const kick = (beat % 2 === 0 && tb < 0.12) ? Math.sin(TAU * (60 * tb + 2 * (1 - Math.exp(-30 * tb)))) * Math.exp(-tb * 20) * 0.5 : 0;
          const bass = Tri(N(ch[bi][0] - 12), t) * 0.13 * (0.6 + 0.4 * Math.exp(-tb * 3));
          return (pad + box + kick + bass) * 0.9;
        });
      } else {
        const spb = 60 / 132, bar = spb * 4, root = [48, 45, 41, 43, 48, 45, 41, 43], ch = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62], [60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]];
        const mel = [[72, -1, 76, -1, 79, -1, 76, 77, 79, -1, 84, -1, 81, -1, 79, -1], [76, -1, 72, -1, 69, -1, 72, 74, 76, -1, 72, -1, 69, -1, -1, -1], [77, -1, 81, -1, 84, -1, 81, -1, 79, 77, 76, -1, 74, -1, 72, -1], [74, -1, 79, -1, 83, -1, 79, -1, 86, -1, 83, -1, 79, -1, -1, -1], [84, -1, 79, -1, 76, -1, 79, 81, 84, -1, 88, -1, 84, -1, 79, -1], [81, -1, 76, -1, 72, -1, 76, -1, 79, -1, 76, 74, 72, -1, -1, -1], [77, -1, 76, 77, 81, -1, 79, -1, 77, -1, 76, -1, 74, -1, 72, -1], [74, -1, 76, -1, 79, -1, 83, -1, 84, -1, -1, -1, 79, -1, 83, -1]];
        b = this.render(name, bar * 8, (t, i) => {
          const bi = ((t / bar) | 0) % 8, tb = t - Math.floor(t / spb) * spb, beat = ((t / spb) | 0) % 4, t16 = spb * 0.25, s16 = (t / t16) | 0, l16 = t - s16 * t16;
          const kick = tb < 0.13 ? Math.sin(TAU * ((150 / 28) * (1 - Math.exp(-28 * tb)) + 42 * tb)) * Math.exp(-tb * 22) * 0.85 : 0;
          const snare = ((beat === 1 || beat === 3) && tb < 0.16) ? Noise(i) * Math.exp(-tb * 24) * 0.35 + Math.sin(TAU * 200 * tb) * Math.exp(-tb * 40) * 0.18 : 0;
          const hat = (Noise(i) - Noise(i - 1)) * 0.5 * Math.exp(-l16 * 120) * (s16 % 2 === 1 ? 0.22 : 0.1);
          const t8 = spb * 0.5, e = (t / t8) | 0, l8 = t - e * t8, bass = Sq(N(root[bi] + (e % 2 === 1 ? 12 : 0)), t) * Math.exp(-l8 * 6) * 0.12;
          let stab = 0; if (e % 2 === 1) for (const c of ch[bi]) stab += Sq(N(c), t, 0.25); stab *= Math.exp(-l8 * 14) * 0.035;
          const note = mel[bi][s16 % 16]; let lead = 0;
          if (note > 0) lead = Sq(N(note) * (1 + 0.004 * Math.sin(TAU * 6 * t)), t, 0.125) * Math.exp(-l16 * 5) * 0.11;
          const duck = 0.6 + 0.4 * Math.min(1, tb / 0.25);
          return (kick + snare + hat + duck * (bass + stab + lead)) * 0.8;
        });
      }
      return (this.bufs[name] = b);
    },
    play(name) {
      this.want = name; if (!this.ctx || this.ctx.state !== "running" || this.curName === name) return;
      const old = this.cur, t = this.ctx.currentTime;
      if (old) { old.g.gain.setTargetAtTime(0, t, 0.3); old.s.stop(t + 1.5); }
      const s = this.ctx.createBufferSource(), g = this.ctx.createGain(); s.buffer = this.buf(name); s.loop = true; g.gain.value = 0; g.gain.setTargetAtTime(1, t, 0.3);
      s.connect(g); g.connect(this.music); s.start(); this.cur = { s, g }; this.curName = name;
    },
    setMusic(on) { if (this.music) this.music.gain.value = on ? 0.55 * this.duck : 0; },
    setDuck(d) { if (Math.abs(d - this.duck) < 0.01 || !this.music) return; this.duck = d; if (save.musicOn) this.music.gain.setTargetAtTime(0.55 * d, this.ctx.currentTime, 0.15); },
    tone(type, f0, f1, dur, vol) {
      if (!this.ctx || !save.sfxOn) return; const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g); g.connect(this.sfx); o.start(t); o.stop(t + dur + 0.02);
    },
    beep() { this.tone("square", 880, 880, 0.12, 0.18); },
    coin() { this.tone("square", 1320, 1980, 0.09, 0.12); },
    chime() { this.tone("triangle", 880, 1760, 0.35, 0.3); setTimeout(() => this.tone("triangle", 1320, 2640, 0.3, 0.2), 90); },
    thud() { this.tone("sine", 180, 40, 0.3, 0.5); },
    whoosh() { this.tone("sawtooth", 200, 900, 0.35, 0.12); },
    setHum(v, boost) { if (this.humGain) { this.humGain.gain.setTargetAtTime(v * 0.09, this.ctx.currentTime, 0.1); this.hum.frequency.setTargetAtTime(60 + v * 90 + (boost ? 40 : 0), this.ctx.currentTime, 0.1); } },
  };

  //================== VOICE: device Korean TTS, best voice first, natural phrasing, queued ==================
  // Instagram-style neural voices need a cloud TTS service; here we use the best voice installed on
  // the device (iPad: "유나/Yuna (프리미엄·향상됨)" etc.) and speak in short natural sentences.
  const Voice = {
    ok: "speechSynthesis" in window, list: [], voice: null, q: [], cur: null, star: true, timer: 0,
    rank(v) {
      const n = v.name; let s = 0;
      if (/premium|프리미엄/i.test(n)) s += 60; if (/enhanced|향상|고품질|neural|natural|online/i.test(n)) s += 45; if (/google/i.test(n)) s += 30;
      if (/yuna|유나/i.test(n)) s += 12; if (/sora|소라|jian|지안|suhyun|수현|minsu|민수|heami|sunhi|선희/i.test(n)) s += 8;
      if (/compact|eloquence|grandma|grandpa|rocko|shelley|sandy|reed|flo|eddy|할머니|할아버지/i.test(n)) s -= 40; return s;
    },
    pick() {
      if (!this.ok) return; this.list = speechSynthesis.getVoices().filter(v => /^ko/i.test(v.lang)).sort((a, b) => this.rank(b) - this.rank(a));
      this.voice = this.list.find(v => v.voiceURI === save.voiceURI) || this.list[0] || null;
    },
    unlock() { if (!this.ok || this.unlocked) return; this.unlocked = true; try { const u = new SpeechSynthesisUtterance(" "); u.volume = 0; speechSynthesis.speak(u); } catch (e) { } },
    clean(t) {
      let s = String(t).replace(/<[^>]+>/g, "").replace(/\s*\([A-Za-z0-9 ,.'\-+/&]+\)/g, "");
      [["STAR-01", "스타 제로원"], ["NULL", "널"], ["Na+-K+", "나트륨 칼륨"], ["3Na+", "나트륨 이온 세 개"], ["2K+", "칼륨 이온 두 개"], ["Na+", "나트륨 이온"], ["K+", "칼륨 이온"], ["Ca2+", "칼슘 이온"], ["Cl-", "염소 이온"], ["-70mV", "마이너스 70 밀리볼트"], ["-55mV", "마이너스 55 밀리볼트"], ["+30mV", "플러스 30 밀리볼트"], ["mV", " 밀리볼트"], ["μm", " 마이크로미터"], ["mm", " 밀리미터"], ["→", ", 그다음 "], ["·", ", "], ["/", ", "], ["~", "에서 "], ["(", ", "], [")", ", "], ["\n", ". "], ["...", ". "], ["…", ". "]].forEach(([a, b]) => { s = s.split(a).join(b); });
      const R = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
      s = s.replace(/(^|[^A-Za-z])(XII|XI|X|IX|VIII|VII|VI|V|IV|III|II|I)(?=\s?[가-힣])/g, (m, p, r) => p + (R.indexOf(r) + 1) + "번 ");
      return s.replace(/\s*,\s*([,.!?])/g, "$1").replace(/\s+/g, " ").trim();
    },
    chunks(s) {   // short sentences sound far more natural than one long utterance (and iOS cuts long ones)
      const out = []; for (let part of s.match(/[^.!?。]+[.!?。]?/g) || [s]) { part = part.trim(); if (!part) continue;
        while (part.length > 110) { const k = part.lastIndexOf(",", 100); const cut = k > 30 ? k + 1 : 100; out.push(part.slice(0, cut)); part = part.slice(cut).trim(); }
        if (part) out.push(part); }
      return out;
    },
    // mode: "replace" (stop what is being said), "queue" (after it), "idle" (only if silent)
    say(text, o = {}) {
      if (!save.voiceOn || !text) return false; const mode = o.mode || "replace";
      if (mode === "idle" && this.talking) return false;
      if (mode === "replace") this.stop();
      if (mode === "polite") this.q.length = 0;   // let the sentence being spoken finish, drop the rest, then talk
      for (const c of this.chunks(this.clean(text))) this.q.push({ text: c, star: o.star !== false, tag: o.tag || null });
      if (!this.cur) this.next(); return true;
    },
    next() {
      clearTimeout(this.timer); const c = this.q.shift(); this.cur = c || null; if (!c) return;
      this.star = c.star; const est = 0.6 + c.text.length * 0.2 / (save.voiceRate || 1); c.end = performance.now() / 1000 + est;
      const done = () => { if (this.cur === c) { this.cur = null; setTimeout(() => { if (!this.cur) this.next(); }, 140); } };
      this.timer = setTimeout(done, (est + 2.5) * 1000);     // fallback: some engines never fire onend
      if (!this.ok) return;
      try {
        const u = new SpeechSynthesisUtterance(c.text); u.lang = "ko-KR"; if (this.voice) u.voice = this.voice;
        u.rate = save.voiceRate || 1.05; u.pitch = c.star ? (save.voicePitch || 1.0) : 0.92; u.onend = done; u.onerror = done; speechSynthesis.speak(u);
      } catch (e) { }
    },
    stop() { this.q.length = 0; this.cur = null; clearTimeout(this.timer); if (this.ok) try { speechSynthesis.cancel(); } catch (e) { } },
    get talking() { return !!this.cur || this.q.length > 0; },
    has(tag) { return (this.cur && this.cur.tag === tag) || this.q.some(c => c.tag === tag); },
    remaining(tag) { const now = performance.now() / 1000; let t = this.cur && (!tag || this.cur.tag === tag) ? Math.max(0, this.cur.end - now) : 0; for (const c of this.q) if (!tag || c.tag === tag) t += 0.6 + c.text.length * 0.2 / (save.voiceRate || 1); return t; },
  };
  if (Voice.ok) { Voice.pick(); speechSynthesis.onvoiceschanged = () => Voice.pick(); }
  const pickOne = a => a[(Math.random() * a.length) | 0];
  const hasBatchim = w => { const c = w.trim().replace(/[^가-힣]+$/, "").slice(-1).charCodeAt(0); return c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 !== 0; };
  const optSpeech = o => Voice.clean(o).replace(/[,.\s]+$/, "");
  const firstTouch = () => { Snd.unlock(); Voice.unlock(); };
  window.addEventListener("pointerdown", firstTouch, { capture: true });
  window.addEventListener("keydown", firstTouch, { capture: true });

  //================== THREE SETUP ==================
  // quality: "auto" = phones/tablets start without bloom; an FPS watchdog steps down if frames get slow
  const TOUCH = matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
  let autoLevel = TOUCH ? "mid" : "high";
  const qEff = () => save.quality === "auto" ? autoLevel : save.quality;
  const canvas = $("#gl"), dprCap = () => { const q = qEff(), d = devicePixelRatio || 1; return q === "low" ? 1 : q === "mid" ? Math.min(d, 1.3) : Math.min(d, 1.75); };
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(dprCap());
  const scene = new THREE.Scene(), BG = new THREE.Color(0x0A0724);
  scene.background = BG; scene.fog = new THREE.Fog(0x0A0724, 40, 340);
  const camera = new THREE.PerspectiveCamera(62, 1, 0.2, 1400);
  scene.add(new THREE.HemisphereLight(0xC9B8FF, 0x2A1640, 1.4));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(-0.4, 0.8, -0.5); scene.add(sun);
  let composer = null;
  function resize() {
    const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h;
    if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); }
    camera.updateProjectionMatrix(); $("#rotate").classList.toggle("need", h > w);
  }
  addEventListener("resize", resize); resize();

  const { M, frameAt, LANE, HEXS } = NRW; const LETTER = i => String.fromCharCode(65 + i);
  let world = null;
  function buildWorld(stage, graph) { if (world) world.dispose(scene); world = NRW.build(scene, stage, graph, race || stage ? qbank : bank, qEff()); return world; }

  // bloom post-processing (skipped on "가볍게")
  function setupPost() {
    const PP = window.THREE_PP; composer = null; if (!PP || qEff() !== "high") { resize(); return; }
    try { composer = new PP.EffectComposer(renderer); composer.addPass(new PP.RenderPass(scene, camera)); composer.addPass(new PP.UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.6, 0.4, 0.86)); composer.addPass(new PP.OutputPass()); } catch (e) { composer = null; }
    resize();
  }

  //================== STAR ==================
  const star = buildStar(); scene.add(star.root);
  const trail = []; { const tm = addMat(0xFFD34D, 0.28); for (let i = 0; i < 12; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), tm); scene.add(m); trail.push(m); } }
  const SV = { t: 0, expr: "Normal", base: "Normal", exprT: 0, spin: 0, spinVel: 0, squash: 0, squashVel: 0, wasGround: true, shake: 0, lastV: -1, lean: 0, victory: false, hist: [] };
  function setExpr(e, sec) { SV.expr = e; SV.exprT = sec; }
  function setBase(e) { SV.base = e; }
  function poseStar(sim, dt, showcase) {
    SV.t += dt; const t = SV.t;
    const fr = frameAt(sim.seg, sim.s, sim.x, NR.Sim.HOVER + sim.y); star.root.position.copy(fr.p);
    // star faces the camera (face on +z, root looks back along -forward)
    star.root.quaternion.copy(fr.q);
    let roll = NR.clamp(-sim.vx * 2.2, -28, 28), yaw = sim.drifting ? sim.driftDir * 28 : 0, pitch = NR.clamp(-sim.vy * 2, -20, 20), bob = sim.grounded ? Math.sin(t * 3.2) * 0.09 : 0;
    if (SV.lastV < 0) SV.lastV = sim.speed01; const acc = (sim.speed01 - SV.lastV) / Math.max(1e-4, dt); SV.lastV = sim.speed01;
    SV.lean += (NR.clamp(acc * 25, -6, 12) - SV.lean) * (1 - Math.exp(-6 * dt)); pitch += SV.lean;
    if (!sim.grounded) SV.spin += 520 * dt; else { const tgt = Math.round(SV.spin / 360) * 360; SV.spin += NR.clamp(tgt - SV.spin, -900 * dt, 900 * dt); }
    if (SV.spinVel > 0) { SV.spin += SV.spinVel * dt; SV.spinVel = Math.max(0, SV.spinVel - 700 * dt); }
    const boosting = sim.boosting || sim.turboTimer > 0, wob = boosting ? Math.sin(t * 30) * 4 : 0;
    if (sim.drifting) yaw += Math.sin(t * 18) * (3 + 2 * sim.driftTier);
    if (!sim.grounded && SV.wasGround) SV.squashVel += 5; if (sim.grounded && !SV.wasGround) SV.squashVel -= 7; SV.wasGround = sim.grounded;
    SV.squashVel += (-SV.squash * 160 - SV.squashVel * 12) * dt; SV.squash = NR.clamp(SV.squash + SV.squashVel * dt, -0.35, 0.35);
    star.body.scale.set((1 - SV.squash * 0.5) * 1.25, (1 + SV.squash) * 1.25, (1 + (boosting ? 0.06 : 0)) * 1.25);
    if (SV.victory) { bob = Math.abs(Math.sin(t * 5)) * 0.55; roll += Math.sin(t * 5) * 12; }
    let sx = 0, sy = 0; if (SV.shake > 0) { SV.shake -= dt; sx = (Math.random() - 0.5) * 0.16; sy = (Math.random() - 0.5) * 0.16; }
    SV.face = (SV.face || 0) + NR.clamp((showcase ? 180 : 0) - (SV.face || 0), -400 * dt, 400 * dt);
    if (showcase) { yaw = Math.sin(t * 0.8) * 18; pitch = 0; }
    yaw += SV.face;
    star.body.position.set(sx, bob + sy, 0);
    const D = Math.PI / 180; star.body.rotation.set(-pitch * D, yaw * D, -(roll + SV.spin + wob) * D, "YXZ");
    star.orbit.rotation.z += dt * (1.2 + sim.speed01 * 3); star.orbit2.rotation.z -= dt * 0.8;
    star.halo.material.opacity = 0.35 + 0.25 * (boosting ? 1 : 0) + 0.05 * Math.sin(t * 4);
    star.bodyMat.uniforms.E.value.setHex(boosting ? 0x4a3a10 : 0x2e2510);
    // expression
    if (SV.exprT > 0) SV.exprT -= dt; let ex = SV.exprT > 0 ? SV.expr : SV.base;
    if (Voice.talking && Voice.star && (ex === "Normal" || ex === "Focus")) ex = Math.sin(t * 22) > 0 ? "Talk" : "Normal";
    for (const k in star.faces) star.faces[k].visible = k === ex;
    // trail
    SV.hist.unshift(star.root.position.clone()); if (SV.hist.length > 40) SV.hist.pop();
    trail.forEach((m, i) => { const h = SV.hist[Math.min(SV.hist.length - 1, i * 3 + 2)]; if (!h) return; m.position.copy(h); m.quaternion.copy(camera.quaternion); const k = 1 - i / trail.length; m.position.y -= 0.25; m.scale.setScalar((0.35 + 0.9 * sim.speed01) * k + 0.05); m.visible = sim.speed > 8 && !showcase; });
  }

  //================== CAMERA (ChaseCamera.cs port) ==================
  const CAM = { fwd: null, look: 0, roll: 0, kick: 0, showcase: 0, shake: 0, pos: new THREE.Vector3(), snap: true };
  function follow(sim, dt, running) {
    const U = sim.forward, f = M(U); f.y *= 0.5; f.normalize();
    if (!CAM.fwd || CAM.snap) CAM.fwd = f.clone(); else CAM.fwd.lerp(f, 1 - Math.pow(0.02, dt)).normalize();
    const side = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), CAM.fwd).normalize(); // three: up x fwd = left-of-travel; mirror => screen right
    const boosting = sim.boosting || sim.turboTimer > 0; CAM.kick += NR.clamp((boosting ? 1 : 0) - CAM.kick, -dt * 3, dt * 3);
    const want = running ? NR.clamp(sim.curvature * 110 * NR.lerp(0.4, 1, sim.speed01), -2.6, 2.6) : 0;
    CAM.look += (want - CAM.look) * (1 - Math.exp(-3 * dt)); CAM.roll += ((sim.drifting ? -sim.driftDir * 4 : 0) - CAM.roll) * (1 - Math.exp(-4 * dt));
    const pos = M(sim.position), anchor = pos.clone(); anchor.y -= Math.max(0, sim.y) * 0.5;
    let target, look; const bossScale = world && world.stage.boss ? 1.15 : 1;
    // corner look: Unity side vector is +right; in three the mirrored right = -side
    const right = side.clone().negate();
    if (CAM.showcase > 0) {
      CAM.showcase -= dt; const a = NR.clamp01(CAM.showcase / 2.5);
      target = pos.clone().addScaledVector(CAM.fwd, 4.2 + 1.5 * a).addScaledVector(right, 1.6 * a); target.y += 0.9; look = pos.clone(); look.y += 0.2;
      CAM.fwd.copy(f);
    } else {
      const dist = (6.4 + 1.8 * CAM.kick) * bossScale;
      target = anchor.clone().addScaledVector(CAM.fwd, -dist).addScaledVector(right, -CAM.look * 0.35); target.y += 2.6 * bossScale;
      look = anchor.clone().addScaledVector(CAM.fwd, 8.5).addScaledVector(right, CAM.look); look.y += 1.0;
    }
    if (CAM.snap) { CAM.pos.copy(target); CAM.snap = false; } else CAM.pos.lerp(target, 1 - Math.pow(0.0006, dt));
    camera.position.copy(CAM.pos);
    if (CAM.shake > 0) { CAM.shake = Math.max(0, CAM.shake - dt * 2.5); camera.position.x += (Math.random() - 0.5) * CAM.shake; camera.position.y += (Math.random() - 0.5) * CAM.shake; }
    camera.up.set(0, 1, 0); camera.lookAt(look);
    if (CAM.showcase <= 0 && Math.abs(CAM.roll) > 0.01) camera.rotateZ(CAM.roll * Math.PI / 180);
    const fov = CAM.showcase > 0 ? 50 : 62 + 14 * sim.speed01 + 10 * CAM.kick; if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = fov; camera.updateProjectionMatrix(); }
  }

  //================== INPUT (RaceInput.cs port) ==================
  const held = { left: 0, right: 0, drift: 0, boost: 0 }, keys = {}; let jumpPress = false, steerSm = 0;
  $$(".tb").forEach(b => {
    const k = b.dataset.k, ids = new Set();
    const down = ev => { ev.preventDefault(); ids.add(ev.pointerId); try { b.setPointerCapture(ev.pointerId); } catch (e) { } b.classList.add("down"); if (k === "jump") jumpPress = true; else held[k] = 1; };
    const up = ev => { ids.delete(ev.pointerId); if (!ids.size) { b.classList.remove("down"); if (k !== "jump") held[k] = 0; } };
    b.addEventListener("pointerdown", down); b.addEventListener("pointerup", up); b.addEventListener("pointercancel", up); b.addEventListener("lostpointercapture", up);
    b.addEventListener("contextmenu", e => e.preventDefault());
  });
  addEventListener("keydown", e => { keys[e.code] = true; if (["Space", "ArrowUp", "KeyW"].includes(e.code) && !e.repeat) jumpPress = true; if ((e.code === "Escape" || e.code === "KeyP") && race && race.phase === "run") pauseRace(); if (e.code === "Space") e.preventDefault(); });
  addEventListener("keyup", e => { keys[e.code] = false; });
  addEventListener("blur", () => { for (const k in held) held[k] = 0; for (const k in keys) keys[k] = false; });
  function readInput(dt) {
    let steer = 0; if (held.left || keys.ArrowLeft || keys.KeyA) steer -= 1; if (held.right || keys.ArrowRight || keys.KeyD) steer += 1;
    const drift = !!(held.drift || keys.KeyZ || keys.ControlLeft || keys.ArrowDown || keys.KeyS), boost = !!(held.boost || keys.ShiftLeft || keys.KeyX);
    steer = NR.clamp(steer, -1, 1); const r = dt * (steer === 0 ? 10 : 6); steerSm += NR.clamp(steer - steerSm, -r, r);
    const j = jumpPress; jumpPress = false; return { steer: steerSm, jump: j, drift, boost };
  }

  //================== UI HELPERS ==================
  const show = (sel, on) => $(sel).classList.toggle("on", !!on);
  function screen(name) { $$(".screen").forEach(s => s.classList.toggle("on", s.id === "scr-" + name)); }
  let toastT = 0, hintT = 0, answerT = 0, storyT = 0; const storyQ = [];
  function toast(text, color = "#F2F0FF", sec = 1.6) { const t = $("#h-toast"); t.textContent = text; t.style.color = color; t.style.opacity = 1; toastT = sec; }
  function hint(text, sec = 5) { if (!save.showHints) return; const h = $("#h-hint"); h.textContent = text; h.style.display = "block"; hintT = sec; Voice.say(text, { mode: "idle" }); }
  function countdown(t) { $("#h-count").textContent = t; }
  function fmt(t) { const m = Math.floor(t / 60), s = t - m * 60; return m + ":" + (s < 10 ? "0" : "") + s.toFixed(1); }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  let dialogLines = null, dialogIdx = 0, dialogDone = null;
  function showDialog(lines, done) { dialogLines = lines; dialogIdx = -1; dialogDone = done; show("#dialog", true); nextDialog(); }
  function nextDialog() {
    dialogIdx++;
    if (!dialogLines || dialogIdx >= dialogLines.length) { Voice.stop(); show("#dialog", false); const d = dialogDone; dialogDone = null; if (d) d(); return; }
    const l = dialogLines[dialogIdx]; $("#d-speaker").textContent = l.speaker; $("#d-text").textContent = l.text; $("#d-face").textContent = l.speaker === "STAR-01" ? "★" : l.speaker === "NULL" ? "⚠" : "◆";
    $("#d-face").style.color = l.speaker === "NULL" ? "#FF4D6D" : "#FFD34D";
    Voice.say(l.text, { star: l.speaker === "STAR-01" });
    if (AUTO) setTimeout(() => { if (dialogLines === l_ref) nextDialog(); }, 150);
    const l_ref = dialogLines;
  }
  $("#dialog").addEventListener("pointerup", () => nextDialog());

  function questionLanes(q, n) { return n === 2 ? ["◀ 왼쪽", "오른쪽 ▶"] : n === 3 ? ["◀ 왼쪽", "가운데", "오른쪽 ▶"] : Array.from({ length: n }, (_, i) => "차선 " + (i + 1)); }
  const LANE_WORD = n => n === 2 ? ["왼쪽", "오른쪽"] : n === 3 ? ["왼쪽", "가운데", "오른쪽"] : Array.from({ length: n }, (_, i) => (i + 1) + "번");
  function questionSpeech(q) {
    const w = LANE_WORD(q.options.length);
    return pickOne(["자, 문제!", "문제 나간다!", "이번 문제야.", "잘 들어 봐!"]) + " " + q.question + " " +
      q.options.map((o, i) => w[i] + (hasBatchim(w[i]) ? "은 " : "는 ") + optSpeech(o)).join(", ") + ". " + pickOne(["어느 쪽일까?", "골라 봐!", "어디로 갈래?", "정답 쪽으로 가 보자!"]);
  }
  // while racing STAR-01 says the key sentence only; the full explanation is one tap away (🔊 해설 듣기)
  const firstSentence = t => { const ss = String(t).match(/[^.!?]+[.!?]?/g) || [String(t)]; let out = ss[0].trim(); if (out.length < 30 && ss[1]) out += " " + ss[1].trim(); return out; };
  function answerSpeech(q, chosen, correct) {
    const ans = optSpeech(q.options[q.answer]), wrong = correct ? "" : NR.wrongExp(q, chosen);
    if (correct) return pickOne(["딩동댕! 맞았어!", "정답! 잘했어!", "맞아, 역시!", "좋아, 정답이야!"]) + " " + firstSentence(q.explanation);
    return pickOne(["앗, 아깝다!", "아쉽다!", "음, 이건 틀렸어."]) + " 정답은 " + ans + (hasBatchim(ans) ? "이야. " : "야. ") + firstSentence(wrong || q.explanation);
  }
  let lastAnswer = null;
  function showQuestion(q, title) {
    if (!q) return; show("#apanel", false); answerT = 0;
    $("#q-title").textContent = title; $("#q-tag").textContent = "[" + q.topic + " · " + q.difficulty + "]"; $("#q-text").textContent = q.question;
    const lanes = questionLanes(q, q.options.length);
    $("#q-opts").innerHTML = q.options.map((o, i) => `<div class="opt" data-i="${i}" style="border-left:8px solid ${HEXS(LANE[i % 4])}"><span class="lane">${lanes[i]}</span><span class="k" style="color:${HEXS(LANE[i % 4])}">${LETTER(i)}</span>${esc(o)}</div>`).join("");
    show("#qpanel", true);
    Voice.say(questionSpeech(q), { tag: "q", mode: "polite" });
  }
  function showAnswer(q, chosen, correct, extra, sec) {
    show("#qpanel", false); if (!q) return; const p = $("#apanel");
    p.classList.toggle("bad", !correct); $("#a-title").textContent = (correct ? "정답!  " : "오답…  정답은 ") + LETTER(q.answer) + ". " + q.options[q.answer];
    const wrong = correct ? "" : NR.wrongExp(q, chosen); $("#a-wrong").textContent = wrong; $("#a-wrong").style.display = wrong ? "block" : "none";
    $("#a-text").textContent = q.explanation; $("#a-extra").textContent = extra || "";
    p.classList.remove("full"); $("#a-more").textContent = "자세히 ▾"; show("#apanel", true); answerT = Math.min(sec, 6); lastAnswer = { q, chosen, correct };
    Voice.say(answerSpeech(q, chosen, correct), { tag: "exp", mode: "polite" });   // never cut mid-sentence; the next question waits
  }
  $("#a-close").addEventListener("pointerup", () => { show("#apanel", false); answerT = 0; Voice.stop(); });
  $("#a-more").addEventListener("pointerup", () => { const p = $("#apanel"), f = !p.classList.contains("full"); p.classList.toggle("full", f); $("#a-more").textContent = f ? "접기 ▴" : "자세히 ▾"; answerT = Math.max(answerT, f ? 12 : 4); });
  $("#a-listen").addEventListener("pointerup", () => { if (!lastAnswer) return; const { q, chosen, correct } = lastAnswer, w = correct ? "" : NR.wrongExp(q, chosen); Voice.say((w ? w + " " : "") + q.explanation, { tag: "exp" }); answerT = Math.max(answerT, 6); });

  let storyWait = 0;
  function tickUi(dt) {
    Snd.setDuck(Voice.talking ? 0.4 : 1);
    if (toastT > 0) { toastT -= dt; if (toastT <= 0.4) $("#h-toast").style.opacity = Math.max(0, toastT / 0.4); }
    if (hintT > 0) { hintT -= dt; if (hintT <= 0) $("#h-hint").style.display = "none"; }
    // the answer panel stays until its time is up AND STAR-01 has finished explaining
    if (answerT > 0) answerT -= dt; else if ($("#apanel").classList.contains("on") && !Voice.has("exp")) show("#apanel", false);
    if (storyT > 0) storyT -= dt;
    if (storyT <= 0) {
      const box = $("#h-story");
      if (storyQ.length) {
        // story lines wait for STAR-01 to finish talking (max 12 s), then are read aloud
        storyWait += dt; if (save.voiceOn && Voice.talking && storyWait < 12) return;
        storyWait = 0; const l = storyQ.shift(); box.querySelector("b").textContent = l.speaker; box.querySelector("span").textContent = l.text; box.style.display = "block"; $("#h-hint").style.display = "none";
        const voice = Voice.say(l.text, { mode: "idle", star: l.speaker === "STAR-01" });
        storyT = NR.clamp(1.6 + l.text.length * (voice ? 0.1 : 0.07), 3.5, 9);
      } else box.style.display = "none";
    }
  }

  //================== RACE ==================
  let race = null;
  // 2.6: answer options are shuffled every run (the data has most answers in A / the same lane)
  let qbank = bank;
  function shuffledBank() {
    return new NR.Bank(C.questions.map(q => {
      if (/syn_order/.test(q.id) || !q.options || q.options.length < 2) return q;
      const n = q.options.length, perm = [...Array(n).keys()];
      for (let i = n - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [perm[i], perm[j]] = [perm[j], perm[i]]; }
      const w = q.wrongExplanations || [];
      return Object.assign({}, q, { options: perm.map(k => q.options[k]), answer: perm.indexOf(q.answer), wrongExplanations: perm.map(k => w[k] || ""), perm });
    }));
  }
  function startStage(id) {
    qbank = shuffledBank();
    const stage = NR.STAGES.find(s => s.id === id) || NR.STAGES[0]; save.lastStage = stage.id; persist();
    const graph = stage.build(qbank); buildWorld(stage, graph);
    const sim = new NR.Sim(graph), learn = new NR.Session(qbank), forkSegByQ = new Map();
    for (const seg of graph.segments) if (seg.fork) forkSegByQ.set(seg.fork.questionId, seg);
    let bossMax = 0; if (stage.boss) { for (const e of graph.allEvents()) if (e.type === NR.EV.Gate && e.tag === "boss") bossMax++; for (const s of graph.segments) if (s.fork) bossMax++; }
    race = { stage, graph, sim, learn, forkSegByQ, phase: "intro", t: 0, cd: 4, timeScale: 1, pending: null, pendingLanes: null, bossMax, bossHp: bossMax, finishT: 0, auto: AUTO ? new NR.AutoPilot() : null, paused: false, lastSection: "" };
    screen(""); show("#hud", true); show("#touch", false); show("#qpanel", false); show("#apanel", false); show("#result", false); show("#pause", false);
    $("#h-boss").classList.toggle("on", stage.boss); updateBoss();
    setSection(graph.start.name); countdown(""); storyQ.length = 0; storyT = 0; $("#h-story").style.display = "none"; $("#h-hint").style.display = "none";
    SV.victory = false; SV.spin = 0; SV.hist.length = 0; setBase("Focus"); setExpr("Normal", 0); CAM.snap = true; CAM.showcase = 999;
    Snd.play("race");
    const intro = C.story[stage.introStory];
    if (intro && !(AUTO && WARP > 1)) showDialog(intro, startCountdown); else startCountdown();
  }
  function startCountdown() {
    if (!race) return; race.phase = "count"; race.t = 0; race.cd = 4; CAM.showcase = 2.6; setExpr("Joy", 2); SV.spinVel = 720; show("#touch", !race.auto);
  }
  function setSection(n) { if (race && race.lastSection === n) return; if (race) race.lastSection = n; $("#h-section").textContent = n; }
  function updateBoss() { if (!race || !race.bossMax) return; $("#h-boss-fill").style.width = (100 * race.bossHp / race.bossMax) + "%"; }
  function findGate(qid) { for (const seg of race.graph.segments) for (const e of seg.events) if (e.type === NR.EV.Gate && e.questionId === qid) return { seg, e }; return null; }
  // a new question waits until STAR-01 has finished the previous explanation; the race slows down
  // just enough that there is still time to read the question before the gate / fork
  function ask(id, title, lanes, decision) {
    const r = race; r.pending = id; r.pendingLanes = lanes; r.decision = decision; r.queued = null;
    if (!r.auto && save.voiceOn && Voice.has("exp")) { r.queued = { id, title }; return; }
    showQuestion(qbank.get(id), title); Snd.beep();
  }
  function distToDecision() { const r = race, d = r.decision; if (!d || d.seg !== r.sim.seg) return 999; return Math.max(0, d.s - r.sim.s); }

  function pauseRace() { if (!race || race.phase !== "run") return; race.paused = true; Voice.stop(); renderSettings($("#pause-settings"), true); show("#pause", true); }
  function resumeRace() { if (!race) return; race.paused = false; show("#pause", false); }

  function tickRace(rdt) {
    const r = race, sim = r.sim; let dt = Math.min(rdt, 0.05);
    tickUi(dt);
    if (r.paused) { Snd.setHum(0, false); return; }
    if (r.phase === "count") {
      r.t += dt; const n = 3 - Math.floor(r.t - 0.6);
      if (r.t >= 0.6 && n !== r.cd && n >= 1 && n <= 3) { r.cd = n; countdown(String(n)); Snd.beep(); }
      if (r.t >= 3.6) { countdown("GO!"); Snd.chime(); r.phase = "run"; r.t = 0; hint(r.auto ? "AUTO 데모 주행 중" : "◀ ▶ 버튼으로 조향! 코너에서는 바깥쪽으로 밀려나요.", 5); }
    } else if (r.phase === "run") {
      r.t += dt; if (r.t > 0.8 && r.t < 1.2) countdown("");
      const inp = r.auto ? r.auto.think(sim) : readInput(dt);
      if (r.queued && (!Voice.has("exp") || distToDecision() < 110)) { const qd = r.queued; r.queued = null; showQuestion(qbank.get(qd.id), qd.title); Snd.beep(); }
      let wantSlow = 1;
      if (r.pending && !r.auto) {
        const base = NR.clamp(save.thinkSlow, 0.2, 1), D = distToDecision(), v = Math.max(12, sim.speed);
        const need = r.queued ? Voice.remaining("exp") + 6 : save.voiceOn ? Voice.remaining("q") + 1.5 : 0;   // seconds of talking/reading still needed
        wantSlow = need > 0 && D < 900 ? NR.clamp(D / (v * need), Math.min(base, 0.5), base) : base;
      }
      r.timeScale += NR.clamp(wantSlow - r.timeScale, -dt * 2.5, dt * 2.5);
      $("#h-slow").style.display = r.timeScale < 0.97 && !$("#qpanel").classList.contains("on") ? "block" : "none"; $("#h-slow").textContent = r.queued ? "해설 듣는 중 · 슬로모션" : "생각 시간 · 슬로모션";
      let sdt = dt * r.timeScale * (r.auto ? WARP : 1);
      const n = Math.max(1, Math.ceil(sdt / (1 / 120) - 1e-4)), h = sdt / n;
      for (let i = 0; i < n && r.phase === "run"; i++) { sim.step(inp, h); inp.jump = false; handleEvents(); }
      updateLane();
    } else if (r.phase === "finish") {
      r.finishT += dt; if (r.finishT > 3.2) { r.phase = "done"; showResult(); }
    }
    const running = r.phase === "run";
    poseStar(sim, dt, CAM.showcase > 0);
    follow(sim, dt, running);
    // HUD
    const prog = r.graph.referenceLength > 0 ? NR.clamp01(sim.distance / r.graph.referenceLength) : 0, pf = r.phase === "finish" || r.phase === "done" ? 1 : prog;
    setStyle("#h-prog", "width", (pf * 100).toFixed(1) + "%"); setStyle("#h-star", "left", (pf * 100).toFixed(1) + "%");
    setText("#h-time", fmt(sim.raceTime)); setText("#h-score", r.learn.correct + "/" + r.learn.total); setText("#h-coins", sim.coins);
    setStyle("#h-energy", "width", (sim.boostEnergy * 100).toFixed(0) + "%");
    updateVm(dt);
    Snd.setHum(running ? sim.speed01 : 0, running && sim.boosting);
  }

  // DOM writes only when something changed (cheaper on phones)
  const domCache = new Map();
  function setText(sel, v) { v = String(v); if (domCache.get(sel) !== v) { domCache.set(sel, v); $(sel).textContent = v; } }
  function setStyle(sel, k, v) { const key = sel + k; if (domCache.get(key) !== v) { domCache.set(key, v); $(sel).style[k] = v; } }
  let laneShown = -2;
  function updateLane() {
    const r = race, pill = $("#h-lane");
    if (!r.pending || !r.pendingLanes) { if (laneShown !== -2) { pill.style.display = "none"; laneShown = -2; $$("#q-opts .opt").forEach(o => o.classList.remove("cur")); } return; }
    const lane = NR.Sim.nearest(r.pendingLanes, r.sim.x); if (lane === laneShown) return; laneShown = lane;
    const q = qbank.get(r.pending), c = HEXS(LANE[lane % 4]);
    pill.style.display = "block"; pill.style.borderColor = c; pill.innerHTML = `지금 <span style="color:${c}">${LETTER(lane)}</span> ${q ? esc(q.options[lane].length > 14 ? q.options[lane].slice(0, 13) + "…" : q.options[lane]) : ""}`;
    $$("#q-opts .opt").forEach((o, i) => o.classList.toggle("cur", i === lane));
  }
  // membrane-potential meter (shown in EPSP / IPSP zones)
  let vmHold = 0;
  function updateVm(dt) {
    const sim = race.sim, el = $("#h-vm");
    if (sim.mission) vmHold = 3; else vmHold -= dt;
    const on = vmHold > 0; if (el.classList.contains("on") !== on) el.classList.toggle("on", on); if (!on) return;
    const v = sim.vm, pct = NR.clamp01((v + 90) / 130) * 100;
    setStyle("#h-vm-fill", "height", pct.toFixed(0) + "%"); setText("#h-vm-val", Math.round(v) + " mV");
    setStyle("#h-vm-fill", "background", v >= -58 ? "linear-gradient(0deg,#FFB627,#FF4D6D)" : v > -70 ? "linear-gradient(0deg,#5C9CFF,#5CFF9D)" : "linear-gradient(0deg,#3A4DFF,#5C9CFF)");
    setText("#h-vm-goal", sim.mission === "excite" ? "역치 -55까지 올려!" : sim.mission === "inhibit" ? "-55 아래로 지켜!" : "");
  }
  function pulseVm(cls) { const el = $("#h-vm"); el.classList.remove("fire", "seize"); void el.offsetWidth; el.classList.add(cls); setTimeout(() => el.classList.remove(cls), 900); }

  function handleEvents() { const sim = race.sim; for (const e of sim.events) handle(e); sim.events.length = 0; }
  function feedback(ok) { if (ok) { Snd.chime(); setExpr("Correct", 2); SV.spinVel = 540; } else { Snd.thud(); setExpr("Wrong", 2.2); CAM.shake = 0.5; } }
  function bossAnswer(ok) {
    const r = race; if (!r.bossMax) return;
    if (ok) { r.bossHp = Math.max(0, r.bossHp - 1); updateBoss(); world.bossHit(r.bossHp, r.bossMax); toast(r.bossHp === 0 ? "NULL 보호막 붕괴!" : "정확한 진단! NULL 보호막 " + r.bossHp + "/" + r.bossMax, "#2EE6D6", 1.8); }
    else { toast("오진! NULL이 반격합니다", "#FF4D6D", 1.6); world.bossAttack(); }
  }
  function handle(e) {
    const r = race, sim = r.sim, S = NR.SE;
    switch (e.type) {
      case S.Trigger: trigger(e.tag); break;
      case S.GateResult: {
        const q = qbank.get(e.src.questionId); r.learn.answer(e.src.questionId, e.lane, sim.raceTime);
        world.gateResult(e.src, e.lane);
        feedback(e.correct); let extra = null;
        if (e.src.tag === "glia" && e.correct) { extra = "희소돌기아교세포가 수초를 재생했습니다. 전도 속도 회복!"; toast("수초 복구 완료!", "#5CFF9D"); }
        else if (e.src.tag === "ap") extra = "활동전위 단계 " + (e.src.index + 1) + "/4";
        if (e.src.tag === "boss") bossAnswer(e.correct);
        showAnswer(q, e.lane, e.correct, extra, e.correct ? 7 : 11); r.pending = null; r.pendingLanes = null; r.queued = null; break;
      }
      case S.ForkChosen: {
        const q = qbank.get(e.tag); r.learn.answer(e.tag, e.lane, sim.raceTime);
        world.forkResult(e.tag, e.lane);
        if (r.stage.boss) bossAnswer(e.correct); feedback(e.correct);
        showAnswer(q, e.lane, e.correct, e.correct ? "정답 경로: 지름길 + 신호 에너지 보너스!" : "복습 구간에 진입했습니다. 해설을 읽으며 천천히 이동하세요.", e.correct ? 7 : 12);
        if (!e.correct) toast("복습 구간 - 속도 저하", "#FF8A3D", 2); r.pending = null; r.pendingLanes = null; r.queued = null; break;
      }
      case S.RingHit: { world.ringHit(e.src, true); Snd.coin(); if (sim.ringChain >= 2) toast("도약전도 x" + sim.ringChain + "  +" + Math.round(sim.chainBonus * 100) + "%", "#FFB627", 0.9); break; }
      case S.RingMiss: { world.ringHit(e.src, false); if (sim.ringsTotal > 1) toast("결절을 놓쳤어요 - 연속 끊김", "#B4AEDB", 0.9); break; }
      case S.ObstacleHit: CAM.shake = 0.9; SV.shake = 0.4; setExpr("Hurt", 1.2); Snd.thud(); toast("NULL 충돌! 전도 지연", "#FF4D6D", 1.2); break;
      case S.OrbCollected: case S.RepairOrb: {
        world.collect(e.src);
        if (e.type === S.OrbCollected) Snd.coin(); else { Snd.chime(); setExpr("Joy", 1); toast("수초 복구 " + sim.repairCount + "/3", "#5CFF9D", 1.4); } break;
      }
      case S.WallHit: CAM.shake = 0.35; Snd.thud(); setExpr("Surprise", 0.6); break;
      case S.DriftEnd: if (e.tier > 0) { Snd.whoosh(); toast("미니 터보 Lv." + e.tier, ["", "#4D8DFF", "#FFB627", "#FF5CC8"][e.tier], 0.9); setExpr("Joy", 0.8); } break;
      case S.BoostStart: Snd.whoosh(); setExpr("Joy", 1); break;
      case S.Jump: Snd.beep(); break;
      case S.Checkpoint: toast("체크포인트", "#9B5CFF", 1); break;
      case S.EnterSegment: setSection(sim.seg.zone === NR.ZONE.Review ? "복습 구간" : sim.seg.zone === NR.ZONE.Shortcut ? "지름길" : sim.seg.name); break;
      case S.Finish: finish(); break;
      case S.Psp: {
        world.pspCollect(e.src); const ex = e.tag === "epsp";
        if (!e.correct) { toast("불응기! 지금은 반응이 없어요", "#B4AEDB", 0.8); break; }
        Snd.tone("triangle", ex ? 660 : 520, ex ? 990 : 300, 0.12, 0.2);
        toast(ex ? "EPSP +7 mV" : "IPSP −7 mV", ex ? "#5CFF9D" : "#5C9CFF", 0.6); break;
      }
      case S.Fire:
        Snd.chime(); Snd.whoosh(); CAM.shake = 0.5; SV.spinVel = 720; setExpr("Joy", 1.5); NRW.U.uFire.value = 1; pulseVm("fire");
        toast("⚡ 역치 도달! 활동전위 발화!", "#FFD34D", 1.6); Voice.say(pickOne(["발화! 활동전위다!", "역치 넘었다! 슝!", "좋아, 발화 성공!"]), { mode: "idle" }); break;
      case S.Seizure:
        Snd.thud(); CAM.shake = 0.8; setExpr("Hurt", 1.2); NRW.U.uSeize.value = 1; pulseVm("seize");
        toast("과흥분! 발작 위험 — IPSP로 진정시켜!", "#FF4D6D", 1.6); Voice.say("앗, 과흥분이야! 파란 IPSP를 모아 줘!", { mode: "idle" }); break;
      case S.MissionEnd: {
        const ex = e.tag === "excite";
        if (e.correct) { toast(ex ? "EPSP 가중 성공! 발화 " + sim.missionFires + "회" : "과흥분 억제 성공! 보너스 가속", "#5CFF9D", 2); Voice.say(ex ? "시간적 가중 성공! EPSP가 모여서 발화했어!" : "잘했어! IPSP가 막전위를 낮춰서 과흥분을 막았어!", { mode: "idle" }); }
        else { toast(ex ? "역치에 못 미쳤어요 — EPSP를 더 빨리 연달아!" : "억제 실패 — 과흥분이 일어났어요", "#FF8A3D", 2); Voice.say(ex ? "아깝다! EPSP를 더 빠르게 연달아 모아야 역치까지 가." : "과흥분이 일어났어. IPSP를 더 모아 보자!", { mode: "idle" }); }
        break;
      }
    }
  }
  function trigger(tag) {
    const r = race, c = tag.indexOf(":"), kind = c >= 0 ? tag.slice(0, c) : tag, arg = c >= 0 ? tag.slice(c + 1) : "";
    const thinkTag = save.thinkSlow < 0.99 ? "  · 생각 시간: 슬로모션" : "";
    switch (kind) {
      case "story": if (arg !== r.stage.introStory && C.story[arg]) storyQ.push(...C.story[arg]); break;
      case "hint":
        if (arg === "corner") hint("코너 진입! 안쪽으로 조향해 벽에 부딪히지 않게 하세요.", 4);
        else if (arg === "jump") hint("NULL 교란 구간! 큰 파동은 [점프], 작은 블록은 피하세요.", 4);
        else if (arg === "drift") hint("급커브! [드리프트]를 누른 채 커브 방향으로 조향 → 놓으면 미니 터보!", 6);
        break;
      case "integ":
        if (arg === "excite") hint("EPSP 가중 구간! 초록 ＋ 를 연달아 먹으면 막전위가 올라가 역치(-55 mV)에서 발화 → 가속! 파랑 − 는 피하기", 6);
        else if (arg === "inhibit") hint("IPSP 억제 구간! NULL이 막전위를 계속 올려요. 파랑 − 를 먹어서 역치 아래로 지키기! 초록 ＋ 는 피하기", 6);
        if (arg === "excite" || arg === "inhibit") Voice.say(arg === "excite" ? "EPSP 구간이야! 초록 플러스를 연달아 모으면 역치까지 올라가서 발화해!" : "NULL 때문에 뉴런이 과흥분 중이야! 파란 마이너스를 모아서 진정시켜 줘!", { mode: Voice.has("exp") ? "queue" : "replace" });
        break;
      case "banner": toast(arg === "soma" ? "세포체 - 입력 신호의 가중(통합)" : "축삭종말 접근 - 시냅스 소포 준비", "#2EE6D6", 2.2); break;
      case "codex": r.learn.codexSeen.add(arg); { const ce = codexById.get(arg); if (ce && !save.codexUnlocked.includes(arg)) toast("신경 도감 등록: " + ce.name, "#2EE6D6", 1.8); } break;
      case "forkq": { const fs = r.forkSegByQ.get(arg); ask(arg, "갈림길! 정답 경로로 들어가세요" + thinkTag, fs ? fs.fork.laneX : null, fs ? { seg: fs, s: fs.length } : null); break; }
      case "gateq": { const g = findGate(arg); ask(arg, (arg === "ch1_gate_glia" ? "수초 복구 게이트" : r.stage.gateTitle) + thinkTag, g ? g.e.laneX : null, g ? { seg: g.seg, s: g.e.s } : null); break; }
      case "boss": if (arg === "attack") { world.bossAttack(); toast("NULL 반격! 파동은 점프!", "#FF4D6D", 1.4); CAM.shake = 0.4; } break;
      case "synapse": if (arg === "minigame") openMinigame(); else if (arg === "cross") toast("신경전달물질 다리 통과!", "#FF5CC8", 1.5); break;
    }
  }
  function finish() {
    const r = race; r.phase = "finish"; r.finishT = 0; show("#touch", false); show("#qpanel", false); countdown("GOAL!"); Snd.chime();
    setBase("Victory"); setExpr("Victory", 99); SV.victory = true; CAM.showcase = 3.2; Voice.say(pickOne(["골인! 신호 전달 성공!", "도착! 우리가 해냈어!", "골인! 신경 신호 무사히 도착!"]));
  }

  //================== SYNAPSE MINIGAME (GameUI.Minigame.cs) ==================
  function openMinigame() {
    const r = race; r.phase = "mini"; show("#touch", false); show("#qpanel", false); setExpr("Surprise", 1.5);
    const qo = qbank.get("ch1_syn_order"), qe = qbank.get("ch1_syn_epsp");
    const done = (success, mistakes, epsp) => { r.learn.answer(qo.id, mistakes === 0 ? qo.answer : 1, r.sim.raceTime); r.learn.answer(qe.id, epsp, r.sim.raceTime); closeMinigame(success); };
    if (r.auto) { done(true, 0, qe.answer); return; }
    show("#mini", true); let next = 0, mistakes = 0;
    const order = qo.options.map((_, i) => i).sort(() => Math.random() - 0.5);
    $("#mg-prompt").textContent = qo.question; Voice.say("시냅스 게이트야! " + qo.question + " 순서대로 눌러 줘.");
    $("#mg-slots").innerHTML = qo.options.map((_, i) => `<li>${i + 1}. ?</li>`).join("");
    $("#mg-ves").innerHTML = "<i></i>".repeat(7); $("#mg-ca").style.opacity = 0.3; $("#mg-fb").textContent = "";
    const btns = $("#mg-btns"); btns.innerHTML = order.map(i => `<button data-i="${i}">${esc(qo.options[i])}</button>`).join("");
    btns.querySelectorAll("button").forEach(b => b.addEventListener("pointerup", () => {
      const i = +b.dataset.i; if (next >= 5) return;
      if (i === next) {
        b.classList.add("gone"); const li = $("#mg-slots").children[next]; li.textContent = (next + 1) + ". " + qo.options[i]; li.classList.add("done"); Snd.coin();
        if (next === 1) $("#mg-ca").style.opacity = 1; if (next === 2) $$("#mg-ves i").forEach(v => v.style.transform = "translateY(60px) scale(.6)");
        next++; if (next === 5) phase2();
      } else { mistakes++; b.classList.remove("no"); void b.offsetWidth; b.classList.add("no"); Snd.thud(); $("#mg-fb").textContent = "순서가 달라요! 다음 단계를 다시 생각해 보세요. (실수 " + mistakes + ")"; }
    }));
    function phase2() {
      $("#mg-fb").textContent = "전달 순서 완성! " + (mistakes === 0 ? "완벽해요!" : "실수 " + mistakes + "회"); Snd.chime();
      setTimeout(() => {
        $("#mg-prompt").textContent = qe.question; Voice.say("좋아, 마지막 문제! " + qe.question + " " + qe.options.map(o => optSpeech(o)).join(", 아니면 ") + "?");
        btns.innerHTML = qe.options.map((o, i) => `<button data-i="${i}"><b>${LETTER(i)}</b>. ${esc(o)}</button>`).join("");
        btns.querySelectorAll("button").forEach(b => b.addEventListener("pointerup", () => {
          const ch = +b.dataset.i, ok = ch === qe.answer, success = mistakes <= 1 && ok;
          $("#mg-fb").textContent = (ok ? "정답! " : "오답… 정답은 " + qe.options[qe.answer] + ". ") + qe.explanation; Voice.say((ok ? "딩동댕! " : "아깝다! ") + qe.explanation);
          btns.innerHTML = `<button class="primary" id="mg-go">${success ? "시냅스 연결 성공! 계속 달리기 ▶" : "계속 달리기 ▶"}</button>`;
          $("#mg-go").addEventListener("pointerup", () => { show("#mini", false); done(success, mistakes, ch); });
        }));
      }, 900);
    }
  }
  function closeMinigame(success) {
    const r = race; r.sim.applySynapseResult(success); show("#touch", !r.auto); steerSm = 0; for (const k in held) held[k] = 0;
    setExpr(success ? "Joy" : "Hurt", 1.5); toast(success ? "시냅스 연결 성공! 가속!" : "시냅스 연결 불안정", success ? "#5CFF9D" : "#FF4D6D", 1.6); r.phase = "run";
  }

  //================== RESULT ==================
  function showResult() {
    const r = race, sim = r.sim, L = r.learn, par = r.graph.parTime, t = sim.raceTime;
    const today = new Date().toISOString().slice(0, 10); for (const a of L.answers) { const q = qbank.get(a.questionId); if (q && q.perm) { a.chosen = q.perm[a.chosen]; a.mapped = true; } }
    L.mergeInto(save, today); save.plays++;
    const b = save.best[r.stage.id], isBest = !b || t < b.time; if (isBest) save.best[r.stage.id] = { time: t, acc: L.accuracy };
    persist();
    const acc = Math.round(L.accuracy * 100), grade = acc === 100 && t <= par ? "S" : acc >= 80 && t <= par * 1.1 ? "A" : acc >= 60 ? "B" : "C";
    $("#r-title").textContent = r.stage.boss ? (r.bossHp === 0 ? "NULL 격파! 신경망 복구" : "NULL 진단 완료") : "STAGE CLEAR!";
    $("#r-grade").textContent = `CH.${r.stage.chapter} ${r.stage.title} · 등급 ${grade}` + (isBest ? " · 최고 기록!" : "");
    const st = [["기록", fmt(t)], ["목표(PAR)", fmt(par)], ["정답률", acc + "% (" + L.correct + "/" + L.total + ")"], ["오브", sim.coins], ["미니 터보", "-"], ["벽 충돌", sim.wallHits]];
    if (sim.ringsTotal) st[4] = ["도약전도 결절", sim.ringsHit + "/" + sim.ringsTotal]; else st[4] = ["NULL 충돌", sim.obstacleHits];
    $("#r-stats").innerHTML = st.map(([a, b]) => `<div>${a}<b>${b}</b></div>`).join("");
    const wrong = L.answers.filter(a => !a.correct).map(a => bank.get(a.questionId)).filter(Boolean);
    $("#r-wrong").innerHTML = wrong.length ? `<div class="grade">복습할 문제 ${wrong.length}개 (오답 노트에 저장됨)</div>` + wrong.map(q => `<div class="entry"><b>${esc(q.question)}</b><br><span class="ok">정답: ${esc(q.options[q.answer])}</span><br>${esc(q.explanation)}</div>`).join("") : `<div class="grade">모든 문제를 맞혔어요! 완벽한 신호 전달 ★</div>`;
    const idx = NR.STAGES.indexOf(r.stage); $("#result [data-act=next]").style.display = idx < NR.STAGES.length - 1 ? "" : "none";
    show("#hud", false); show("#result", true); Snd.play("menu");
    Voice.say(acc === 100 ? "완벽해! 문제를 전부 맞혔어!" : "완주 성공! 틀린 문제는 오답 노트에서 같이 다시 보자.");
    window.__nrResult = { stage: r.stage.id, time: t, correct: L.correct, total: L.total, coins: sim.coins };
  }

  //================== MENUS ==================
  function renderStages() {
    $("#stage-grid").innerHTML = NR.STAGES.map(s => {
      const b = save.best[s.id];
      return `<button class="stage${s.boss ? " boss" : ""}" data-stage="${s.id}"><span class="ch">CHAPTER ${s.chapter}${s.boss ? " · BOSS" : ""}</span><span class="tt">${esc(s.title)}</span><span class="st">${esc(s.subtitle)}</span><span class="goals">${s.goals.map(esc).join(" · ")}</span><span class="best">${b ? "최고 " + fmt(b.time) + " · 정답률 " + Math.round(b.acc * 100) + "%" : "도전 전"}</span></button>`;
    }).join("");
    $$("#stage-grid .stage").forEach(b => b.addEventListener("click", () => startStage(b.dataset.stage)));
  }
  let codexMode = "codex", codexCh = 0;
  function renderCodex() {
    $("#codex-h").textContent = codexMode === "codex" ? "신경 도감" : "오답 노트";
    const tabs = [["codex", "📘 도감"], ["notes", "📝 오답 노트"]].map(([m, l]) => `<button data-mode="${m}" class="${codexMode === m ? "on" : ""}">${l}</button>`).join("") + (codexMode === "codex" ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(c => `<button data-ch="${c}" class="${codexCh === c ? "on" : ""}">${c ? "CH." + c : "전체"}</button>`).join("") : "");
    $("#codex-tabs").innerHTML = tabs;
    $$("#codex-tabs [data-mode]").forEach(b => b.addEventListener("click", () => { codexMode = b.dataset.mode; renderCodex(); }));
    $$("#codex-tabs [data-ch]").forEach(b => b.addEventListener("click", () => { codexCh = +b.dataset.ch; renderCodex(); }));
    let html;
    if (codexMode === "codex") {
      const list = C.codex.filter(c => !codexCh || c.chapter === codexCh), got = list.filter(c => save.codexUnlocked.includes(c.id)).length;
      html = `<div class="meta">달리면서 만난 구조가 등록돼요 · ${got}/${list.length}</div>` + list.map(c => {
        const on = save.codexUnlocked.includes(c.id);
        return `<div class="entry${on ? "" : " locked"}"><b>${on ? esc(c.name) : "???"}</b><span class="en">${on ? esc(c.english || "") : ""}</span> <span class="meta">CH.${c.chapter} · ${esc(c.category || "")}</span><br>${on ? esc(c.description) : "아직 만나지 않은 구조예요."}${on && c.gameLink ? `<br><span class="meta">🎮 ${esc(c.gameLink)}</span>` : ""}</div>`;
      }).join("");
    } else {
      const notes = save.wrongNotes.slice().sort((a, b) => (a.resolved - b.resolved) || (b.wrongCount - a.wrongCount));
      html = notes.length ? notes.map(n => {
        const q = bank.get(n.questionId); if (!q) return "";
        const w = NR.wrongExp(q, n.chosen);
        return `<div class="entry"><span class="meta">CH.${q.chapter} · ${esc(q.topic)} · 틀린 횟수 ${n.wrongCount} · ${n.resolved ? '<span class="ok">다시 맞힘 ✔</span>' : '<span class="bad">복습 필요</span>'}</span><br><b>${esc(q.question)}</b><br><span class="bad">내 답: ${esc(q.options[n.chosen] || "-")}</span> · <span class="ok">정답: ${esc(q.options[q.answer])}</span><br>${w ? esc(w) + "<br>" : ""}${esc(q.explanation)}</div>`;
      }).join("") : `<div class="entry">아직 틀린 문제가 없어요. 달리면서 틀린 문제가 여기 모여요.</div>`;
    }
    $("#codex-list").innerHTML = html;
  }
  function renderSettings(el, compact) {
    const rows = [
      ["별 음성 안내", "STAR-01이 문제·해설을 읽어 줘요" + (Voice.ok ? "" : " (이 브라우저는 미지원)"), "voiceOn", [[true, "켜기"], [false, "끄기"]]],
      ["목소리 톤", "", "voicePitch", [[0.95, "차분하게"], [1.0, "자연스럽게"], [1.15, "밝게"]]],
      ["말 속도", "", "voiceRate", [[0.95, "천천히"], [1.08, "보통"], [1.2, "빠르게"]]],
      ["배경 음악", "", "musicOn", [[true, "켜기"], [false, "끄기"]]],
      ["효과음", "", "sfxOn", [[true, "켜기"], [false, "끄기"]]],
      ["문제 생각 시간", "문제가 뜨면 레이스가 조금 느려져요 (기록 손해 없음)", "thinkSlow", [[0.5, "느리게"], [0.75, "조금"], [1, "끄기"]]],
      ["도움말 힌트", "", "showHints", [[true, "켜기"], [false, "끄기"]]],
      ["그래픽 품질", "버벅이면 '가볍게'", "quality", [["low", "가볍게"], ["auto", "자동"], ["high", "선명"]]],
    ];
    el.innerHTML = rows.map(([t, d, k, opts]) => `<div class="set"><div>${t}${d ? `<small>${d}</small>` : ""}</div><div class="opts">${opts.map(([v, l]) => `<button data-k="${k}" data-v='${JSON.stringify(v)}' class="${save[k] === v ? "on" : ""}">${l}</button>`).join("")}</div></div>`).join("") + (compact ? "" : voiceRow()) + (compact ? "" : `<div class="set"><div>기록 초기화<small>최고 기록·도감·오답 노트를 지워요</small></div><div class="opts"><button data-reset="1">초기화</button></div></div>`);
    el.querySelectorAll("[data-k]").forEach(b => b.addEventListener("click", () => {
      const k = b.dataset.k, v = JSON.parse(b.dataset.v); save[k] = v; persist();
      if (k === "musicOn") Snd.setMusic(v); if (k === "sfxOn" && Snd.sfx) Snd.sfx.gain.value = v ? 0.5 : 0;
      if (k === "quality") { autoLevel = TOUCH ? "mid" : "high"; renderer.setPixelRatio(dprCap()); setupPost(); resize(); if (!race) { if (world) world.dispose(scene); world = null; menuScene(); } }
      if ((k === "voiceOn" && v) || k === "voicePitch" || k === "voiceRate") Voice.say("안녕! 나는 스타 제로원이야. 이렇게 읽어 줄게!"); if (k === "voiceOn" && !v) Voice.stop();
      renderSettings(el, compact);
    }));
    const vs = el.querySelector("#voice-sel"); if (vs) vs.addEventListener("change", () => { save.voiceURI = vs.value; persist(); Voice.pick(); Voice.say("안녕! 이 목소리 어때?"); });
    const vp = el.querySelector("#voice-try"); if (vp) vp.addEventListener("click", () => Voice.say("안녕! 나는 스타 제로원! 같이 신경계를 달려 보자!"));
    const rs = el.querySelector("[data-reset]"); if (rs) rs.addEventListener("click", () => { if (confirm("기록을 모두 지울까요?")) { save.best = {}; save.wrongNotes = []; save.codexUnlocked = []; persist(); renderSettings(el, compact); } });
  }
  function voiceRow() {
    Voice.pick(); const L = Voice.list;
    const opts = L.length ? L.map(v => `<option value="${esc(v.voiceURI)}"${Voice.voice && v.voiceURI === Voice.voice.voiceURI ? " selected" : ""}>${esc(v.name)}</option>`).join("") : `<option>한국어 음성을 찾지 못했어요</option>`;
    return `<div class="set voice-set"><div>STAR-01 목소리<small>iPad에서 더 자연스러운 목소리: 설정 › 손쉬운 사용 › 읽기 및 말하기 › 음성 › 한국어 › '유나(프리미엄)' 또는 '향상됨' 음성을 내려받은 뒤 여기서 고르세요.</small></div><div class="opts"><select id="voice-sel">${opts}</select><button id="voice-try">▶ 들어보기</button></div></div>`;
  }
  function goTitle() { race = null; Voice.stop(); show("#hud", false); show("#touch", false); show("#result", false); show("#pause", false); show("#qpanel", false); show("#apanel", false); show("#mini", false); show("#dialog", false); screen("title"); menuScene(); Snd.play("menu"); }
  document.addEventListener("click", ev => {
    const b = ev.target.closest("[data-act]"); if (!b) return; const a = b.dataset.act;
    if (a === "play") startStage(save.lastStage || "ch1");
    else if (a === "stages") { show("#result", false); show("#pause", false); race = null; Voice.stop(); show("#hud", false); show("#touch", false); show("#qpanel", false); show("#apanel", false); renderStages(); screen("stages"); menuScene(); Snd.play("menu"); }
    else if (a === "codex" || a === "notes") { codexMode = a; renderCodex(); screen("codex"); }
    else if (a === "settings") { renderSettings($("#settings-list")); screen("settings"); }
    else if (a === "title") goTitle();
    else if (a === "resume") resumeRace();
    else if (a === "retry") { const id = race ? race.stage.id : save.lastStage; show("#pause", false); startStage(id); }
    else if (a === "quit") { show("#pause", false); race = null; renderStages(); screen("stages"); show("#hud", false); show("#touch", false); show("#qpanel", false); show("#apanel", false); Voice.stop(); menuScene(); Snd.play("menu"); }
    else if (a === "next") { const i = NR.STAGES.findIndex(s => s.id === (race ? race.stage.id : save.lastStage)); startStage(NR.STAGES[Math.min(NR.STAGES.length - 1, i + 1)].id); }
  });
  $("#b-pause").addEventListener("click", pauseRace);
  document.addEventListener("visibilitychange", () => { if (document.hidden) { if (race && race.phase === "run") pauseRace(); Voice.stop(); if (Snd.ctx) Snd.ctx.suspend(); } else if (Snd.ctx) Snd.ctx.resume(); });

  // title scene: STAR-01 floating in front of the backdrop
  let menuSim = null;
  function menuScene() {
    if (!world || world.stage.id !== "ch1") buildWorld(NR.STAGES[0], NR.STAGES[0].build(bank));
    menuSim = new NR.Sim(world.graph); menuSim.s = 30; menuSim.speed = 0;
  }
  function tickMenu(dt) {
    const sim = menuSim; if (!sim) return; SV.t += dt;
    const fr = frameAt(sim.seg, 12, 0, 2.2); star.root.position.copy(fr.p); star.root.quaternion.copy(fr.q).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));
    star.body.position.set(0, Math.sin(SV.t * 1.6) * 0.15, 0); star.body.rotation.set(0, Math.sin(SV.t * 0.8) * 0.3, Math.sin(SV.t * 1.3) * 0.1, "YXZ");
    star.body.scale.setScalar(1.25); star.orbit.rotation.z += dt; star.orbit2.rotation.z -= dt * 0.7;
    let ex = Voice.talking && Voice.star ? (Math.sin(SV.t * 22) > 0 ? "Talk" : "Normal") : (Math.sin(SV.t * 0.5) > 0.85 ? "Joy" : "Normal");
    for (const k in star.faces) star.faces[k].visible = k === ex; trail.forEach(m => m.visible = false);
    // star sits on the left third, menu on the right
    const f = M(sim.seg.tangentAt(12)), right = new THREE.Vector3(-f.z, 0, f.x);
    const camPos = fr.p.clone().addScaledVector(f, 7.5).addScaledVector(right, -3.2); camPos.y += 0.6; camera.position.copy(camPos);
    camera.lookAt(fr.p.clone().addScaledVector(right, -3.2)); if (camera.fov !== 50) { camera.fov = 50; camera.updateProjectionMatrix(); }
  }

  // FPS watchdog: if the race runs below ~42 fps for 2 s, drop bloom, then resolution
  let fpsAcc = 0, fpsN = 0, fpsCool = 3;
  function watchFps(dt) {
    if (!race || race.phase !== "run" || race.paused || save.quality !== "auto") { fpsAcc = fpsN = 0; return; }
    if (fpsCool > 0) { fpsCool -= dt; return; }
    fpsAcc += dt; fpsN++; if (fpsAcc < 2) return;
    const avg = fpsAcc / fpsN; fpsAcc = fpsN = 0;
    if (avg > 1 / 42 && autoLevel !== "low") { autoLevel = autoLevel === "high" ? "mid" : "low"; renderer.setPixelRatio(dprCap()); setupPost(); fpsCool = 3; toast("부드럽게 달리도록 화질을 자동으로 낮췄어요", "#B4AEDB", 1.6); }
  }

  //================== LOOP ==================
  let last = performance.now(), tAll = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000); last = now; tAll += dt; NRW.U.uTime.value = tAll;
    watchFps(dt);
    NRW.U.uFire.value = Math.max(0, NRW.U.uFire.value - dt * 1.2); NRW.U.uSeize.value = Math.max(0, NRW.U.uSeize.value - dt * 1.5);
    if (race) tickRace(dt); else tickMenu(dt);
    NRW.U.uStar.value.copy(star.root.position);
    if (world) world.update(dt, tAll, race ? race.sim : null);
    if (composer) composer.render(); else renderer.render(scene, camera);
  }

  // boot
  window.NR_APP = { startStage, get race() { return race; }, save, cam: CAM, mini: () => openMinigame() };
  function boot() {
    if (boot.done) return; boot.done = true;
    setupPost(); renderStages(); menuScene(); screen("title");
    $("#loading").classList.add("off");
    Snd.want = "menu";
    requestAnimationFrame(frame);
    const m = HASH.match(/stage=(ch\d)/); if (AUTO || m) setTimeout(() => startStage(m ? m[1] : "ch1"), 300);
  }
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(boot); setTimeout(boot, 2500);
};
