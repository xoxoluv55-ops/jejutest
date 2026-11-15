// NERVE RUNNER - web/iPad edition. Same rules and content as the Unity project (core.js is a 1:1 port
// of the pure-C# Core); this file is the view: three.js world, STAR-01, DOM UI, touch, WebAudio music,
// speechSynthesis voice, slow-motion thinking time and localStorage saves.
"use strict";
(function () {
  const C = window.NR_CONTENT, $ = s => document.querySelector(s), $$ = s => Array.from(document.querySelectorAll(s));
  const bank = new NR.Bank(C.questions), codexById = new Map(C.codex.map(c => [c.id, c]));
  const HASH = location.hash || "", AUTO = /auto/.test(HASH), WARP = (HASH.match(/warp=(\d+)/) || [])[1] | 0 || 1;

  //================== SAVE ==================
  const SAVE_KEY = "nerverunner_web_v1";
  const save = Object.assign({ voiceOn: true, musicOn: true, sfxOn: true, thinkSlow: 0.4, quality: "auto", showHints: true, best: {}, wrongNotes: [], codexUnlocked: [], lastStage: "ch1", storySeen: {}, plays: 0 }, (() => { try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch (e) { return {}; } })());
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

  //================== VOICE (StarVoice.cs port: device ko-KR speech) ==================
  const Voice = {
    ok: "speechSynthesis" in window, voice: null, until: 0, star: false,
    pick() { if (!this.ok) return; const vs = speechSynthesis.getVoices(); this.voice = vs.find(v => /^ko/i.test(v.lang) && /yuna|유나|sora|google/i.test(v.name)) || vs.find(v => /^ko/i.test(v.lang)) || null; },
    unlock() { if (!this.ok || this.unlocked) return; this.unlocked = true; try { const u = new SpeechSynthesisUtterance(" "); u.volume = 0; speechSynthesis.speak(u); } catch (e) { } },
    clean(t) {
      let s = String(t).replace(/<[^>]+>/g, "");
      [["Na+-K+", "나트륨 칼륨"], ["3Na+", "나트륨 이온 3개"], ["2K+", "칼륨 이온 2개"], ["Na+", "나트륨 이온"], ["K+", "칼륨 이온"], ["Ca2+", "칼슘 이온"], ["Cl-", "염화 이온"], ["-70mV", "마이너스 70 밀리볼트"], ["-55mV", "마이너스 55 밀리볼트"], ["+30mV", "플러스 30 밀리볼트"], ["mV", " 밀리볼트"], ["μm", " 마이크로미터"], ["mm", " 밀리미터"], ["→", ", "], ["·", ", "], ["/", ", "], ["~", "에서 "], ["(", ", "], [")", ", "], ["\n", ". "]].forEach(([a, b]) => { s = s.split(a).join(b); });
      const R = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
      s = s.replace(/(^|[^A-Za-z])(XII|XI|X|IX|VIII|VII|VI|V|IV|III|II|I)(?=\s?[가-힣])/g, (m, p, r) => p + (R.indexOf(r) + 1) + "번 ");
      return s.replace(/\s+/g, " ").trim();
    },
    say(text, isStar = true) {
      if (!save.voiceOn || !text) return; const s = this.clean(text); if (!s) return;
      this.star = isStar; this.until = performance.now() / 1000 + Math.min(14, Math.max(0.8, 0.4 + s.length * 0.09));
      if (!this.ok) return;
      try {
        speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(s); u.lang = "ko-KR"; if (this.voice) u.voice = this.voice;
        u.rate = 1.08; u.pitch = isStar ? 1.45 : 1.0; u.onend = () => { this.until = 0; }; speechSynthesis.speak(u);
      } catch (e) { }
    },
    stop() { this.until = 0; if (this.ok) try { speechSynthesis.cancel(); } catch (e) { } },
    get talking() { return performance.now() / 1000 < this.until; },
  };
  if (Voice.ok) { Voice.pick(); speechSynthesis.onvoiceschanged = () => Voice.pick(); }
  const firstTouch = () => { Snd.unlock(); Voice.unlock(); };
  window.addEventListener("pointerdown", firstTouch, { capture: true });
  window.addEventListener("keydown", firstTouch, { capture: true });

  //================== THREE SETUP ==================
  const canvas = $("#gl"), dprCap = () => save.quality === "low" ? 1 : save.quality === "high" ? 2 : Math.min(devicePixelRatio || 1, 1.6);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(dprCap());
  const scene = new THREE.Scene(), BG = new THREE.Color(0x0B0A24);
  scene.background = BG; scene.fog = new THREE.Fog(0x0B0A24, 70, 380);
  const camera = new THREE.PerspectiveCamera(62, 1, 0.2, 1400);
  scene.add(new THREE.HemisphereLight(0xC9B8FF, 0x2A1640, 1.4));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(-0.4, 0.8, -0.5); scene.add(sun);
  function resize() {
    const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h;
    camera.updateProjectionMatrix(); $("#rotate").classList.toggle("need", h > w);
  }
  addEventListener("resize", resize); resize();

  // Unity (left-handed) -> three (right-handed): mirror X
  const M = v => new THREE.Vector3(-v.x, v.y, v.z);
  const col = h => new THREE.Color(h);
  const ZCOL = { 0: 0x37D8FF, 1: 0xFF5CC8, 2: 0x5CFF9D, 3: 0xFF8A3D, 4: 0xFFB627, 5: 0xFF4D6D, 6: 0x9B5CFF };
  const THEME = { spinal: 0x6CFF8A, tract: 0xFF5CC8, brainstem: 0xFF7A3D, cerebellum: 0xFF8FD0, diencephalon: 0x7C9CFF, cranial: 0xFFD34D, frontal: 0x4D8DFF, parietal: 0x5CFF9D, temporal: 0xFFB627, occipital: 0xFF5CC8, boss: 0xFF4DA6 };
  const segColor = seg => seg.zone === NR.ZONE.Normal && THEME[seg.theme] ? THEME[seg.theme] : ZCOL[seg.zone];

  const fogU = { fogColor: { value: BG }, fogNear: { value: 70 }, fogFar: { value: 380 } };
  const roadMat = new THREE.ShaderMaterial({
    uniforms: Object.assign({ uTime: { value: 0 } }, fogU), side: THREE.DoubleSide,
    vertexShader: `attribute vec3 color;varying vec2 vUv;varying vec3 vCol;varying float vD;void main(){vUv=uv;vCol=color;vec4 mv=modelViewMatrix*vec4(position,1.);vD=-mv.z;gl_Position=projectionMatrix*mv;}`,
    fragmentShader: `uniform float uTime;uniform vec3 fogColor;uniform float fogNear,fogFar;varying vec2 vUv;varying vec3 vCol;varying float vD;
      void main(){float u=abs(vUv.x);vec3 c=vec3(.07,.055,.17)+vCol*.05;
       float edge=smoothstep(.84,.98,u);c+=vCol*edge*1.25;
       float dash=step(u,.025)*step(fract(vUv.y/9.),.5);c+=vec3(.9,.9,1.)*dash*.35;
       float pulse=smoothstep(.85,1.,fract(vUv.y/24.-uTime*.6));c+=vCol*pulse*(1.-u)*.22;
       float hex=smoothstep(.93,1.,abs(sin(vUv.y*.5+vUv.x*3.))*abs(sin(vUv.x*9.)));c+=vCol*hex*.10;
       float f=smoothstep(fogNear,fogFar,vD);gl_FragColor=vec4(mix(c,fogColor,f),1.);}`,
  });
  const glowMat = (c, op = 0.85) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: true });

  //================== LABEL TEXTURES ==================
  function labelTex(lines, opts = {}) {
    const W = opts.w || 512, H = opts.h || 256, c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d");
    x.fillStyle = opts.bg || "rgba(20,15,56,0.92)"; const r = 36; x.beginPath(); x.roundRect ? x.roundRect(6, 6, W - 12, H - 12, r) : x.rect(6, 6, W - 12, H - 12); x.fill();
    x.lineWidth = 10; x.strokeStyle = opts.border || "#FF5CC8"; x.stroke();
    x.textAlign = "center"; x.textBaseline = "middle"; let y = opts.big ? H * 0.36 : H / 2 - (lines.length - 1) * 30;
    lines.forEach((l, i) => {
      const big = opts.big && i === 0; x.fillStyle = big ? (opts.bigColor || "#2EE6D6") : "#F2F0FF";
      let size = big ? 120 : 52; x.font = `${big ? "" : "bold "}${size}px Jua, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`;
      while (x.measureText(l).width > W - 50 && size > 22) { size -= 2; x.font = `bold ${size}px Jua, "Apple SD Gothic Neo", sans-serif`; }
      x.fillText(l, W / 2, y); y += big ? H * 0.38 : 62;
    });
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }
  const short = (s, n = 16) => s.length > n ? s.slice(0, n - 1) + "…" : s;

  //================== WORLD ==================
  let world = null;
  function disposeWorld() {
    if (!world) return; scene.remove(world.root);
    world.root.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material !== roadMat) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); } });
    world = null;
  }

  function ribbon(seg, s0, s1, step, fn) { // fn(s) -> [left vec3 (unity), right vec3]; returns BufferGeometry with uv(u=-1..1, v=s)
    const pos = [], uv = [], idx = []; let k = 0;
    for (let s = s0; ; s = Math.min(s1, s + step)) {
      const [a, b] = fn(s), A = M(a), B = M(b); pos.push(A.x, A.y, A.z, B.x, B.y, B.z); uv.push(-1, s, 1, s);
      if (k > 0) { const i = k * 2; idx.push(i - 2, i - 1, i, i - 1, i + 1, i); } k++;
      if (s >= s1) break;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); return g;
  }
  function paint(g, c) { const n = g.attributes.position.count, a = new Float32Array(n * 3), cc = col(c); for (let i = 0; i < n; i++) { a[i * 3] = cc.r; a[i * 3 + 1] = cc.g; a[i * 3 + 2] = cc.b; } g.setAttribute("color", new THREE.BufferAttribute(a, 3)); return g; }

  function frameAt(seg, s, x = 0, y = 0) { // three-space position + quaternion facing along the road
    const p = M(seg.worldPos(s, x, y)), f = M(seg.tangentAt(s)), up = new THREE.Vector3(0, 1, 0);
    const z = f.clone().negate(), xa = new THREE.Vector3().crossVectors(up, z).normalize(), ya = new THREE.Vector3().crossVectors(z, xa);
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xa, ya, z)); return { p, q, f };
  }

  function buildWorld(stage, graph) {
    disposeWorld();
    const root = new THREE.Group(); scene.add(root);
    const W = { root, graph, stage, orbs: [], rings: [], obstacles: [], gates: [], forkSigns: new Map(), animated: [], bounds: new THREE.Box3() };
    const geomByCol = new Map();
    for (const seg of graph.segments) {
      const c = segColor(seg), hw = seg.halfWidth, yo = (seg.zone === NR.ZONE.Review || seg.zone === NR.ZONE.Shortcut) ? 0.02 * (seg.id % 4) : 0;
      const road = paint(ribbon(seg, 0, seg.length, 2, s => [seg.worldPos(s, -hw, yo), seg.worldPos(s, hw, yo)]), c);
      const m = new THREE.Mesh(road, roadMat); root.add(m); road.computeBoundingBox(); W.bounds.union(road.boundingBox);
      for (const side of [-1, 1]) {
        const rail = ribbon(seg, 0, seg.length, 3, s => [seg.worldPos(s, side * (hw + 0.1), yo), seg.worldPos(s, side * (hw + 0.1), yo + 0.55)]);
        if (!geomByCol.has(c)) geomByCol.set(c, []); geomByCol.get(c).push(rail);
      }
      if (seg.zone === NR.ZONE.Myelin || seg.zone === NR.ZONE.Damaged) buildSheath(W, seg);
      if (seg.zone === NR.ZONE.Synapse) buildCleft(W, seg);
      if (seg.fork) buildForkSigns(W, seg);
      for (const e of seg.events) buildEvent(W, seg, e);
    }
    for (const [c, list] of geomByCol) for (const g of list) root.add(new THREE.Mesh(g, glowMat(c, 0.9)));
    buildOrbs(W); buildBackdrop(W, stage);
    world = W; return W;
  }

  function buildSheath(W, seg) {
    const hw = seg.halfWidth, R = hw + 1.4, dmg = seg.zone === NR.ZONE.Damaged;
    const nodes = seg.events.filter(e => e.type === NR.EV.NodeRing).map(e => e.s);
    const cuts = nodes.length ? nodes : (() => { const a = []; for (let s = 40; s < seg.length - 20; s += 55) a.push(s); return a; })();
    const sheathMat = new THREE.MeshLambertMaterial({ color: dmg ? 0x8a3048 : 0xFFD98A, emissive: dmg ? 0x300010 : 0x5a3a08, transparent: true, opacity: dmg ? 0.5 : 0.42, side: THREE.DoubleSide, depthWrite: false });
    const nodeMat = glowMat(dmg ? 0xFF4D6D : 0x2EE6D6, 0.9);
    let prev = 2, k = 0;
    for (const sN of cuts.concat([seg.length - 2])) {
      const a = prev + 3.5, b = sN - 3.5; prev = sN; k++;
      if (b - a > 6) {
        const A0 = dmg ? (k % 3) * 0.6 : 0, A1 = dmg ? Math.PI - ((k + 1) % 3) * 0.6 : Math.PI; const n = 16, pos = [], idx = []; let rows = 0;
        for (let s = a; ; s = Math.min(b, s + 3)) {
          for (let i = 0; i <= n; i++) { const t = A0 + (A1 - A0) * i / n, v = M(seg.worldPos(s, -Math.cos(t) * R, Math.sin(t) * R * 0.9 - 0.3)); pos.push(v.x, v.y, v.z); }
          if (rows > 0) for (let i = 0; i < n; i++) { const r0 = (rows - 1) * (n + 1) + i, r1 = rows * (n + 1) + i; idx.push(r0, r1, r0 + 1, r0 + 1, r1, r1 + 1); }
          rows++; if (s >= b) break;
        }
        const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
        W.root.add(new THREE.Mesh(g, sheathMat));
      }
      if (sN < seg.length - 3) { // node of Ranvier: glowing band around the bare axon
        const fr = frameAt(seg, sN, 0, -0.3), ring = new THREE.Mesh(new THREE.TorusGeometry(R, 0.18, 6, 40, Math.PI), nodeMat);
        ring.position.copy(fr.p); ring.quaternion.copy(fr.q); W.root.add(ring);
      }
    }
  }
  function buildCleft(W, seg) {
    const g = new THREE.BufferGeometry(), n = 260, p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const v = M(seg.worldPos(Math.random() * seg.length, (Math.random() * 2 - 1) * 10, Math.random() * 7 - 1)); p.set([v.x, v.y, v.z], i * 3); }
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    W.root.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xFF5CC8, size: 0.5, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })));
  }

  function panel(tex, w, h) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, fog: false })); return m; }
  function placeFacing(obj, seg, s, x, y) { const fr = frameAt(seg, s, x, y); obj.position.copy(fr.p); obj.quaternion.copy(fr.q); return obj; }
  const LETTER = i => String.fromCharCode(65 + i);

  function buildForkSigns(W, seg) {
    const q = bank.get(seg.fork.questionId), signs = [];
    seg.fork.laneX.forEach((lx, i) => {
      const tex = labelTex([LETTER(i), short(q.options[i], 14)], { big: true, border: "#FF5CC8" });
      const p = panel(tex, 4.6, 2.3); placeFacing(p, seg, seg.length - 18, lx, 4.2); W.root.add(p); signs.push(p);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.15, 3.2, 0.15), glowMat(0xFF5CC8)); placeFacing(post, seg, seg.length - 18, lx, 1.5); W.root.add(post);
    });
    // lane dividers on the last 140 m
    const lx = seg.fork.laneX; for (let i = 0; i < lx.length - 1; i++) {
      const mid = (lx[i] + lx[i + 1]) / 2, g = ribbon(seg, Math.max(0, seg.length - 140), seg.length, 3, s => [seg.worldPos(s, mid - 0.12, 0.03), seg.worldPos(s, mid + 0.12, 0.03)]);
      W.root.add(new THREE.Mesh(g, glowMat(0xFF5CC8, 0.8)));
    }
    W.forkSigns.set(seg.fork.questionId, { seg, signs, q });
  }

  function buildEvent(W, seg, e) {
    const E = NR.EV;
    if (e.type === E.Gate) {
      const q = bank.get(e.questionId), boss = e.tag === "boss", gc = boss ? 0xFF4DA6 : e.tag === "glia" ? 0x5CFF9D : 0x9B5CFF;
      const hw = seg.halfWidth, grp = new THREE.Group(), mat = glowMat(gc);
      const post = (x) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.4, 6, 0.4), mat); m.position.set(x, 3, 0); grp.add(m); };
      post(-(hw + 0.3)); post(hw + 0.3); const beam = new THREE.Mesh(new THREE.BoxGeometry(2 * hw + 1, 0.4, 0.4), mat); beam.position.y = 6; grp.add(beam);
      placeFacing(grp, seg, e.s, 0, 0); W.root.add(grp);
      const signs = [];
      e.laneX.forEach((lx, i) => {
        const p = panel(labelTex([LETTER(i), short(q ? q.options[i] : "", 14)], { big: true, border: boss ? "#FF4DA6" : "#9B5CFF" }), Math.min(5.4, Math.abs(e.laneX[1] - e.laneX[0]) * 0.92), 2.6);
        placeFacing(p, seg, e.s - 0.4, lx, 4.2); W.root.add(p); signs.push(p);
      });
      for (let i = 0; i < e.laneX.length - 1; i++) {
        const mid = (e.laneX[i] + e.laneX[i + 1]) / 2, g = ribbon(seg, Math.max(0, e.s - 90), e.s, 3, s => [seg.worldPos(s, mid - 0.12, 0.03), seg.worldPos(s, mid + 0.12, 0.03)]);
        W.root.add(new THREE.Mesh(g, glowMat(gc, 0.8)));
      }
      W.gates.push({ e, signs, grp });
    } else if (e.type === E.NodeRing) {
      const m = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.16, 8, 32), glowMat(0x2EE6D6)); placeFacing(m, seg, e.s, e.x, NR.Sim.HOVER); W.root.add(m); W.rings.push({ e, m });
    } else if (e.type === E.Obstacle) {
      const pulse = e.width >= seg.halfWidth, w = Math.min(e.width, seg.halfWidth * 2);
      const m = pulse ? new THREE.Mesh(new THREE.BoxGeometry(w, e.height * 0.8, 0.5), glowMat(0xFF4D6D, 0.75))
        : new THREE.Mesh(new THREE.BoxGeometry(e.width, e.height + 0.4, 1.4), new THREE.MeshLambertMaterial({ color: 0x3a0a20, emissive: 0xC0204a }));
      placeFacing(m, seg, e.s, e.x, pulse ? e.height * 0.4 : (e.height + 0.4) / 2); W.root.add(m); W.obstacles.push({ e, m, pulse });
      if (!pulse) { const w2 = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({ color: 0xFF9AB0 })); m.add(w2); }
    } else if (e.type === E.Finish || e.type === E.Checkpoint) {
      const fin = e.type === E.Finish, hw = seg.halfWidth, grp = new THREE.Group(), mat = glowMat(fin ? 0xFFD34D : 0x9B5CFF);
      for (const x of [-(hw + 0.3), hw + 0.3]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7, 0.5), mat); m.position.set(x, 3.5, 0); grp.add(m); }
      const top = fin ? panel(labelTex(["GOAL"], { w: 512, h: 128, border: "#FFD34D", bg: "rgba(40,20,70,.95)" }), 2 * hw + 1, 2) : new THREE.Mesh(new THREE.BoxGeometry(2 * hw + 1, 0.4, 0.4), mat);
      top.position.y = 7; grp.add(top); placeFacing(grp, seg, e.s, 0, 0); W.root.add(grp);
    }
  }

  function buildOrbs(W) {
    const list = []; for (const seg of W.graph.segments) for (const e of seg.events) if (e.type === NR.EV.Orb || e.type === NR.EV.RepairOrb) list.push({ seg, e });
    const mk = (filter, geo, color) => {
      const items = list.filter(filter); if (!items.length) return;
      const im = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color }), items.length); W.root.add(im);
      items.forEach((it, i) => { it.p = M(it.seg.worldPos(it.e.s, it.e.x, NR.Sim.HOVER + 0.2)); it.i = i; it.im = im; });
      W.orbs.push({ im, items });
    };
    mk(it => it.e.type === NR.EV.Orb, new THREE.OctahedronGeometry(0.5), 0xFFE27A);
    mk(it => it.e.type === NR.EV.RepairOrb, new THREE.IcosahedronGeometry(0.75), 0x5CFF9D);
  }

  function buildBackdrop(W, stage) {
    const b = W.bounds, c = new THREE.Vector3(), size = new THREE.Vector3(); b.getCenter(c); b.getSize(size);
    const R = Math.max(size.x, size.z) * 0.6 + 400;
    const n = 1400, pos = new Float32Array(n * 3), cols = new Float32Array(n * 3), pal = [0x2EE6D6, 0x9B5CFF, 0xFF5CC8, 0xFFD34D, 0x4D8DFF].map(col);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = R * (0.35 + 0.65 * Math.sqrt(Math.random())), y = -60 + Math.random() * 260;
      pos.set([c.x + Math.cos(a) * r, y, c.z + Math.sin(a) * r], i * 3); const k = pal[i % pal.length]; cols.set([k.r, k.g, k.b], i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.BufferAttribute(cols, 3));
    W.root.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 2.2, vertexColors: true, transparent: true, opacity: 0.8, fog: false, depthWrite: false, blending: THREE.AdditiveBlending })));
    // floating neurons (soma + dendrite spokes) along the course, tinted by stage
    const tint = THEME[(W.graph.segments.find(s => s.theme) || {}).theme] || 0x9B5CFF, somaMat = new THREE.MeshLambertMaterial({ color: tint, emissive: tint, emissiveIntensity: 0.35 }), dendMat = glowMat(tint, 0.35);
    const somaGeo = new THREE.SphereGeometry(1, 12, 10), dendGeo = new THREE.CylinderGeometry(0.12, 0.3, 1, 5);
    const segs = W.graph.segments;
    for (let i = 0; i < 46; i++) {
      const seg = segs[(Math.random() * segs.length) | 0], s = Math.random() * seg.length, side = Math.random() < 0.5 ? -1 : 1;
      const p = M(seg.worldPos(s, side * (seg.halfWidth + 18 + Math.random() * 60), -20 + Math.random() * 50)), r = 2 + Math.random() * 3.5;
      const grp = new THREE.Group(); grp.position.copy(p); const so = new THREE.Mesh(somaGeo, somaMat); so.scale.setScalar(r); grp.add(so);
      for (let k = 0; k < 6; k++) { const d = new THREE.Mesh(dendGeo, dendMat), L = r * (2.5 + Math.random() * 3); d.scale.set(r * 0.6, L, r * 0.6); const dir = new THREE.Vector3().randomDirection(); d.position.copy(dir.clone().multiplyScalar(L / 2 + r * 0.6)); d.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); grp.add(d); }
      W.root.add(grp); W.animated.push(grp);
    }
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
  function hint(text, sec = 5) { if (!save.showHints) return; const h = $("#h-hint"); h.textContent = text; h.style.display = "block"; hintT = sec; if (!$("#qpanel").classList.contains("on") && !$("#apanel").classList.contains("on")) Voice.say(text, true); }
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
    Voice.say(l.text, l.speaker === "STAR-01");
    if (AUTO) setTimeout(() => { if (dialogLines === l_ref) nextDialog(); }, 150);
    const l_ref = dialogLines;
  }
  $("#dialog").addEventListener("pointerup", () => nextDialog());

  function questionLanes(q, n) { return n === 2 ? ["◀ 왼쪽", "오른쪽 ▶"] : n === 3 ? ["◀ 왼쪽", "가운데", "오른쪽 ▶"] : Array.from({ length: n }, (_, i) => "차선 " + (i + 1)); }
  function showQuestion(q, title) {
    if (!q) return; show("#apanel", false); answerT = 0;
    $("#q-title").textContent = title; $("#q-tag").textContent = "[" + q.topic + " · " + q.difficulty + "]"; $("#q-text").textContent = q.question;
    const lanes = questionLanes(q, q.options.length);
    $("#q-opts").innerHTML = q.options.map((o, i) => `<div class="opt" data-i="${i}"><span class="lane">${lanes[i]}</span><span class="k">${LETTER(i)}</span>${esc(o)}</div>`).join("");
    show("#qpanel", true);
    Voice.say(q.question + " " + q.options.map((o, i) => LETTER(i) + ". " + o + ".").join(" "), true);
  }
  function showAnswer(q, chosen, correct, extra, sec) {
    show("#qpanel", false); if (!q) return; const p = $("#apanel");
    p.classList.toggle("bad", !correct); $("#a-title").textContent = (correct ? "정답!  " : "오답…  정답은 ") + LETTER(q.answer) + ". " + q.options[q.answer];
    const wrong = correct ? "" : NR.wrongExp(q, chosen); $("#a-wrong").textContent = wrong; $("#a-wrong").style.display = wrong ? "block" : "none";
    $("#a-text").textContent = q.explanation; $("#a-extra").textContent = extra || "";
    show("#apanel", true); answerT = sec;
    Voice.say((correct ? "정답이야! " : "아쉬워! 정답은 " + q.options[q.answer] + "이야. " + wrong + " ") + q.explanation, true);
  }
  $("#a-close").addEventListener("pointerup", () => { show("#apanel", false); answerT = 0; Voice.stop(); });

  function tickUi(dt) {
    if (toastT > 0) { toastT -= dt; if (toastT <= 0.4) $("#h-toast").style.opacity = Math.max(0, toastT / 0.4); }
    if (hintT > 0) { hintT -= dt; if (hintT <= 0) $("#h-hint").style.display = "none"; }
    if (answerT > 0) { answerT -= dt; if (answerT <= 0) show("#apanel", false); }
    if (storyT > 0) storyT -= dt;
    if (storyT <= 0) {
      const box = $("#h-story");
      if (storyQ.length) {
        const l = storyQ.shift(); box.querySelector("b").textContent = l.speaker; box.querySelector("span").textContent = l.text; box.style.display = "block"; $("#h-hint").style.display = "none";
        const voice = save.voiceOn && !$("#qpanel").classList.contains("on"); if (voice) Voice.say(l.text, l.speaker === "STAR-01");
        storyT = NR.clamp(1.6 + l.text.length * (voice ? 0.1 : 0.07), 3.5, 9);
      } else box.style.display = "none";
    }
    Snd.setDuck(Voice.talking ? 0.45 : 1);
  }

  //================== RACE ==================
  let race = null;
  function startStage(id) {
    const stage = NR.STAGES.find(s => s.id === id) || NR.STAGES[0]; save.lastStage = stage.id; persist();
    const graph = stage.build(bank); buildWorld(stage, graph);
    const sim = new NR.Sim(graph), learn = new NR.Session(bank), forkSegByQ = new Map();
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
  function findGate(qid) { for (const seg of race.graph.segments) for (const e of seg.events) if (e.type === NR.EV.Gate && e.questionId === qid) return e.laneX; return null; }

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
      const wantSlow = r.pending && !r.auto ? NR.clamp(save.thinkSlow, 0.2, 1) : 1;
      r.timeScale += NR.clamp(wantSlow - r.timeScale, -dt * 2.5, dt * 2.5);
      $("#h-slow").style.display = r.timeScale < 0.97 && !$("#qpanel").classList.contains("on") ? "block" : "none";
      let sdt = dt * r.timeScale * (r.auto ? WARP : 1);
      const n = Math.max(1, Math.ceil(sdt / (1 / 120) - 1e-4)), h = sdt / n;
      for (let i = 0; i < n && r.phase === "run"; i++) { sim.step(inp, h); inp.jump = false; handleEvents(); }
      if (r.pending && r.pendingLanes) { const lane = NR.Sim.nearest(r.pendingLanes, sim.x); $$("#q-opts .opt").forEach((o, i) => o.classList.toggle("cur", i === lane)); }
    } else if (r.phase === "finish") {
      r.finishT += dt; if (r.finishT > 3.2) { r.phase = "done"; showResult(); }
    }
    const running = r.phase === "run";
    poseStar(sim, dt, CAM.showcase > 0);
    follow(sim, dt, running);
    // HUD
    const prog = r.graph.referenceLength > 0 ? NR.clamp01(sim.distance / r.graph.referenceLength) : 0, pf = r.phase === "finish" || r.phase === "done" ? 1 : prog;
    $("#h-prog").style.width = (pf * 100) + "%"; $("#h-star").style.left = (pf * 100) + "%";
    $("#h-time").textContent = fmt(sim.raceTime); $("#h-score").textContent = r.learn.correct + "/" + r.learn.total; $("#h-coins").textContent = sim.coins;
    $("#h-energy").style.width = (sim.boostEnergy * 100) + "%";
    Snd.setHum(running ? sim.speed01 : 0, running && sim.boosting);
  }

  function handleEvents() { const sim = race.sim; for (const e of sim.events) handle(e); sim.events.length = 0; }
  function feedback(ok) { if (ok) { Snd.chime(); setExpr("Correct", 2); SV.spinVel = 540; } else { Snd.thud(); setExpr("Wrong", 2.2); CAM.shake = 0.5; } }
  function markSigns(signs, lane, correctLane) { signs.forEach((p, i) => p.material.color.setHex(i === correctLane ? 0xB8FFD0 : i === lane ? 0xFF8A9A : 0x666688)); }
  function bossAnswer(ok) {
    const r = race; if (!r.bossMax) return;
    if (ok) { r.bossHp = Math.max(0, r.bossHp - 1); updateBoss(); toast(r.bossHp === 0 ? "NULL 보호막 붕괴!" : "정확한 진단! NULL 보호막 " + r.bossHp + "/" + r.bossMax, "#2EE6D6", 1.8); }
    else toast("오진! NULL이 반격합니다", "#FF4D6D", 1.6);
  }
  function handle(e) {
    const r = race, sim = r.sim, S = NR.SE;
    switch (e.type) {
      case S.Trigger: trigger(e.tag); break;
      case S.GateResult: {
        const q = bank.get(e.src.questionId); r.learn.answer(e.src.questionId, e.lane, sim.raceTime);
        const g = world.gates.find(g => g.e === e.src); if (g) markSigns(g.signs, e.lane, e.src.correctLane);
        feedback(e.correct); let extra = null;
        if (e.src.tag === "glia" && e.correct) { extra = "희소돌기아교세포가 수초를 재생했습니다. 전도 속도 회복!"; toast("수초 복구 완료!", "#5CFF9D"); }
        else if (e.src.tag === "ap") extra = "활동전위 단계 " + (e.src.index + 1) + "/4";
        if (e.src.tag === "boss") bossAnswer(e.correct);
        showAnswer(q, e.lane, e.correct, extra, e.correct ? 7 : 11); r.pending = null; r.pendingLanes = null; break;
      }
      case S.ForkChosen: {
        const q = bank.get(e.tag); r.learn.answer(e.tag, e.lane, sim.raceTime);
        const fs = world.forkSigns.get(e.tag); if (fs) markSigns(fs.signs, e.lane, fs.seg.fork.correctLane);
        if (r.stage.boss) bossAnswer(e.correct); feedback(e.correct);
        showAnswer(q, e.lane, e.correct, e.correct ? "정답 경로: 지름길 + 신호 에너지 보너스!" : "복습 구간에 진입했습니다. 해설을 읽으며 천천히 이동하세요.", e.correct ? 7 : 12);
        if (!e.correct) toast("복습 구간 - 속도 저하", "#FF8A3D", 2); r.pending = null; r.pendingLanes = null; break;
      }
      case S.RingHit: { const ri = world.rings.find(x => x.e === e.src); if (ri) { ri.m.material = glowMat(0xffffff); ri.hit = 1; } Snd.coin(); if (sim.ringChain >= 2) toast("도약전도 x" + sim.ringChain + "  +" + Math.round(sim.chainBonus * 100) + "%", "#FFB627", 0.9); break; }
      case S.RingMiss: { const ri = world.rings.find(x => x.e === e.src); if (ri) ri.m.material = glowMat(0x553355, 0.5); if (sim.ringsTotal > 1) toast("결절을 놓쳤어요 - 연속 끊김", "#B4AEDB", 0.9); break; }
      case S.ObstacleHit: CAM.shake = 0.9; SV.shake = 0.4; setExpr("Hurt", 1.2); Snd.thud(); toast("NULL 충돌! 전도 지연", "#FF4D6D", 1.2); break;
      case S.OrbCollected: case S.RepairOrb: {
        for (const grp of world.orbs) { const it = grp.items.find(x => x.e === e.src); if (it) { it.gone = true; break; } }
        if (e.type === S.OrbCollected) Snd.coin(); else { Snd.chime(); setExpr("Joy", 1); toast("수초 복구 " + sim.repairCount + "/3", "#5CFF9D", 1.4); } break;
      }
      case S.WallHit: CAM.shake = 0.35; Snd.thud(); setExpr("Surprise", 0.6); break;
      case S.DriftEnd: if (e.tier > 0) { Snd.whoosh(); toast("미니 터보 Lv." + e.tier, ["", "#4D8DFF", "#FFB627", "#FF5CC8"][e.tier], 0.9); setExpr("Joy", 0.8); } break;
      case S.BoostStart: Snd.whoosh(); setExpr("Joy", 1); break;
      case S.Jump: Snd.beep(); break;
      case S.Checkpoint: toast("체크포인트", "#9B5CFF", 1); break;
      case S.EnterSegment: setSection(sim.seg.zone === NR.ZONE.Review ? "복습 구간" : sim.seg.zone === NR.ZONE.Shortcut ? "지름길" : sim.seg.name); break;
      case S.Finish: finish(); break;
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
      case "banner": toast(arg === "soma" ? "세포체 - 입력 신호의 가중(통합)" : "축삭종말 접근 - 시냅스 소포 준비", "#2EE6D6", 2.2); break;
      case "codex": r.learn.codexSeen.add(arg); { const ce = codexById.get(arg); if (ce && !save.codexUnlocked.includes(arg)) toast("신경 도감 등록: " + ce.name, "#2EE6D6", 1.8); } break;
      case "forkq": r.pending = arg; r.pendingLanes = r.forkSegByQ.get(arg) ? r.forkSegByQ.get(arg).fork.laneX : null; showQuestion(bank.get(arg), "갈림길! 정답 경로로 들어가세요" + thinkTag); Snd.beep(); break;
      case "gateq": r.pending = arg; r.pendingLanes = findGate(arg); showQuestion(bank.get(arg), (arg === "ch1_gate_glia" ? "수초 복구 게이트" : r.stage.gateTitle) + thinkTag); Snd.beep(); break;
      case "boss": if (arg === "attack") { toast("NULL 반격! 파동은 점프!", "#FF4D6D", 1.4); CAM.shake = 0.4; } break;
      case "synapse": if (arg === "minigame") openMinigame(); else if (arg === "cross") toast("신경전달물질 다리 통과!", "#FF5CC8", 1.5); break;
    }
  }
  function finish() {
    const r = race; r.phase = "finish"; r.finishT = 0; show("#touch", false); show("#qpanel", false); countdown("GOAL!"); Snd.chime();
    setBase("Victory"); setExpr("Victory", 99); SV.victory = true; CAM.showcase = 3.2; Voice.say("골인! 신경 신호 전달 성공!", true);
  }

  //================== SYNAPSE MINIGAME (GameUI.Minigame.cs) ==================
  function openMinigame() {
    const r = race; r.phase = "mini"; show("#touch", false); show("#qpanel", false); setExpr("Surprise", 1.5);
    const qo = bank.get("ch1_syn_order"), qe = bank.get("ch1_syn_epsp");
    const done = (success, mistakes, epsp) => { r.learn.answer(qo.id, mistakes === 0 ? qo.answer : 1, r.sim.raceTime); r.learn.answer(qe.id, epsp, r.sim.raceTime); closeMinigame(success); };
    if (r.auto) { done(true, 0, qe.answer); return; }
    show("#mini", true); let next = 0, mistakes = 0;
    const order = qo.options.map((_, i) => i).sort(() => Math.random() - 0.5);
    $("#mg-prompt").textContent = qo.question; Voice.say(qo.question, true);
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
        $("#mg-prompt").textContent = qe.question; Voice.say(qe.question + " " + qe.options.map((o, i) => LETTER(i) + ". " + o).join(". "), true);
        btns.innerHTML = qe.options.map((o, i) => `<button data-i="${i}"><b>${LETTER(i)}</b>. ${esc(o)}</button>`).join("");
        btns.querySelectorAll("button").forEach(b => b.addEventListener("pointerup", () => {
          const ch = +b.dataset.i, ok = ch === qe.answer, success = mistakes <= 1 && ok;
          $("#mg-fb").textContent = (ok ? "정답! " : "오답… 정답은 " + qe.options[qe.answer] + ". ") + qe.explanation; Voice.say((ok ? "정답이야! " : "아쉬워! ") + qe.explanation, true);
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
    const today = new Date().toISOString().slice(0, 10); L.mergeInto(save, today); save.plays++;
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
    Voice.say(acc === 100 ? "완벽해! 모든 문제를 맞혔어!" : "완주했어! 틀린 문제는 오답 노트에서 다시 보자!", true);
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
      ["배경 음악", "", "musicOn", [[true, "켜기"], [false, "끄기"]]],
      ["효과음", "", "sfxOn", [[true, "켜기"], [false, "끄기"]]],
      ["문제 생각 시간", "문제가 뜨면 레이스가 느려져요 (기록 손해 없음)", "thinkSlow", [[0.25, "아주 느리게"], [0.4, "느리게"], [0.6, "조금"], [1, "끄기"]]],
      ["도움말 힌트", "", "showHints", [[true, "켜기"], [false, "끄기"]]],
      ["그래픽 품질", "버벅이면 '가볍게'", "quality", [["low", "가볍게"], ["auto", "자동"], ["high", "선명"]]],
    ];
    el.innerHTML = rows.map(([t, d, k, opts]) => `<div class="set"><div>${t}${d ? `<small>${d}</small>` : ""}</div><div class="opts">${opts.map(([v, l]) => `<button data-k="${k}" data-v='${JSON.stringify(v)}' class="${save[k] === v ? "on" : ""}">${l}</button>`).join("")}</div></div>`).join("") + (compact ? "" : `<div class="set"><div>기록 초기화<small>최고 기록·도감·오답 노트를 지워요</small></div><div class="opts"><button data-reset="1">초기화</button></div></div>`);
    el.querySelectorAll("[data-k]").forEach(b => b.addEventListener("click", () => {
      const k = b.dataset.k, v = JSON.parse(b.dataset.v); save[k] = v; persist();
      if (k === "musicOn") Snd.setMusic(v); if (k === "sfxOn" && Snd.sfx) Snd.sfx.gain.value = v ? 0.5 : 0;
      if (k === "quality") renderer.setPixelRatio(dprCap()), resize();
      if (k === "voiceOn" && v) Voice.say("안녕! 내가 읽어 줄게!", true); if (k === "voiceOn" && !v) Voice.stop();
      renderSettings(el, compact);
    }));
    const rs = el.querySelector("[data-reset]"); if (rs) rs.addEventListener("click", () => { if (confirm("기록을 모두 지울까요?")) { save.best = {}; save.wrongNotes = []; save.codexUnlocked = []; persist(); renderSettings(el, compact); } });
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

  //================== LOOP ==================
  let last = performance.now(), tAll = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000); last = now; tAll += dt; roadMat.uniforms.uTime.value = tAll;
    if (race) tickRace(dt); else tickMenu(dt);
    if (world) {
      for (const g of world.orbs) { const m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, tAll * 2.5, 0.4)), one = new THREE.Vector3(1, 1, 1), zero = new THREE.Vector3(0, 0, 0); for (const it of g.items) { m4.compose(it.p, q, it.gone ? zero : one); g.im.setMatrixAt(it.i, m4); } g.im.instanceMatrix.needsUpdate = true; }
      for (const o of world.obstacles) if (o.pulse) o.m.material.opacity = 0.5 + 0.35 * Math.sin(tAll * 8);
      for (const a of world.animated) a.rotation.y += dt * 0.1;
    }
    renderer.render(scene, camera);
  }

  // boot
  window.NR_APP = { startStage, get race() { return race; }, save };
  function boot() {
    if (boot.done) return; boot.done = true;
    renderStages(); menuScene(); screen("title");
    $("#loading").classList.add("off");
    Snd.want = "menu";
    requestAnimationFrame(frame);
    const m = HASH.match(/stage=(ch\d)/); if (AUTO || m) setTimeout(() => startStage(m ? m[1] : "ch1"), 300);
  }
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(boot); setTimeout(boot, 2500);
})();
