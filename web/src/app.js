// NERVE RUNNER - web/iPad edition. Same rules and content as the Unity project (core.js is a 1:1 port
// of the pure-C# Core); this file is the view: three.js world, STAR-01, DOM UI, touch, WebAudio music,
// speechSynthesis voice, slow-motion thinking time and localStorage saves.
"use strict";
window.NR_MAIN = function () {
  const C = window.NR_CONTENT, $ = s => document.querySelector(s), $$ = s => Array.from(document.querySelectorAll(s));
  C.questions.push({ id: "tut_q", chapter: 0, topic: "연습", difficulty: "연습", question: "연습 문제: 다른 뉴런의 신호를 처음 받아들이는 곳은?", options: ["가지돌기", "축삭종말"], answer: 0, explanation: "가지돌기는 다른 뉴런에서 오는 신호를 받는 입구예요. 신호는 가지돌기 → 세포체 → 축삭 → 축삭종말 순서로 흘러가요.", wrongExplanations: ["", "축삭종말은 신호를 다음 뉴런으로 내보내는 출구예요."], structures: [] });
  C.story.tutorial_intro = [
    { speaker: "STAR-01", text: "안녕! 나는 STAR-01, 뉴런을 타고 달리는 신경 신호야. 본격적으로 달리기 전에 연습부터 해 보자!" },
    { speaker: "STAR-01", text: "나는 저절로 앞으로 달려. 너는 좌우로 방향만 잡아 주면 돼. 길 위의 노란 오브를 모으면 신호 에너지가 차." },
    { speaker: "STAR-01", text: "오른쪽 아래 버튼은 점프, 드리프트, 부스트야. 하나씩 차례대로 알려 줄게." },
    { speaker: "STAR-01", text: "마지막엔 문제가 나와. 정답 보기가 있는 차선으로 들어가면 돼. 그럼 출발!" }];
  const bank = new NR.Bank(C.questions), codexById = new Map(C.codex.map(c => [c.id, c]));
  const HASH = location.hash || "", AUTO = /auto/.test(HASH), WARP = (HASH.match(/warp=(\d+)/) || [])[1] | 0 || 1;

  //================== SAVE ==================
  const SAVE_KEY = "nerverunner_web_v1";
  const save = Object.assign({ voiceRate: 1.08, voicePitch: 1.0, voiceURI: "", voiceOn: true, musicOn: true, sfxOn: true, thinkSlow: 0.4, quality: "auto", showHints: true, best: {}, wrongNotes: [], codexUnlocked: [], lastStage: "ch1", storySeen: {}, plays: 0 }, (() => { try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch (e) { return {}; } })());
  if (!(save.v >= 3)) { save.thinkSlow = 0.75; save.v = 3; }      // 2.5: slow motion was too slow
  if (save.musicVol == null) save.musicVol = save.musicOn === false ? 0 : 0.7;
  if (save.sfxVol == null) save.sfxVol = save.sfxOn === false ? 0 : 0.8;
  if (!(save.v >= 4)) { save.voicePitch = 1.0; save.voiceRate = 1.08; save.v = 4; }   // 2.6: raised pitch sounded synthetic
  const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { } };

  //================== AUDIO (NRMusic.cs port + simple SFX) ==================
  const Snd = {
    ctx: null, master: null, music: null, sfx: null, bufs: {}, cur: null, curName: null, hum: null, humGain: null, duck: 1,
    unlock() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
        this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
        this.ctx.onstatechange = () => { if (this.ctx.state === "running" && this.want) this.play(this.want); };
        this.music = this.ctx.createGain(); this.music.gain.value = 0.75 * save.musicVol; this.music.connect(this.master);
        this.sfx = this.ctx.createGain(); this.sfx.gain.value = 0.65 * save.sfxVol; this.sfx.connect(this.master);
        const o = this.ctx.createOscillator(), f = this.ctx.createBiquadFilter(); o.type = "sawtooth"; o.frequency.value = 70; f.type = "lowpass"; f.frequency.value = 500;
        this.humGain = this.ctx.createGain(); this.humGain.gain.value = 0; o.connect(f); f.connect(this.humGain); this.humGain.connect(this.sfx); o.start(); this.hum = o;
        // 3.0: looping noise beds - drift screech (band-pass) and boost roar (low-pass); levels follow the game state
        const nb = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        const loop = (type, freq, q) => { const src = this.ctx.createBufferSource(), fl = this.ctx.createBiquadFilter(), g = this.ctx.createGain(); src.buffer = nb; src.loop = true; fl.type = type; fl.frequency.value = freq; fl.Q.value = q; g.gain.value = 0; src.connect(fl); fl.connect(g); g.connect(this.sfx); src.start(); return { g, fl }; };
        this.driftN = loop("bandpass", 2600, 4); this.boostN = loop("lowpass", 700, 0.7);
      }
      // iOS: resume() is asynchronous - music must start AFTER the context is running (it used to be skipped)
      if (this.ctx.state !== "running") { const p = this.ctx.resume(); if (p && p.then) p.then(() => { if (this.want) this.play(this.want); }).catch(() => {}); }
      if (!this.silentEl) {   // iPhone silent switch mutes Web Audio unless the page plays as "media"
        try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) { }
        try { const a = new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA="); a.setAttribute("playsinline", ""); a.loop = true; a.volume = 0.01; const pr = a.play(); if (pr && pr.catch) pr.catch(() => {}); this.silentEl = a; } catch (e) { this.silentEl = true; }
      }
      if (this.want) this.play(this.want);
      if (!this.pre) { this.pre = true; setTimeout(() => { try { this.buf("race"); this.buf("menu"); } catch (e) { } }, 400); }   // render loops while on the menu, not at race start
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
    setMusic() { if (this.music) this.music.gain.value = 0.75 * save.musicVol * this.duck; },
    setSfx() { if (this.sfx) this.sfx.gain.value = 0.65 * save.sfxVol; },
    setDuck(d) { if (Math.abs(d - this.duck) < 0.01 || !this.music) return; this.duck = d; this.music.gain.setTargetAtTime(0.75 * save.musicVol * d, this.ctx.currentTime, 0.15); },
    setLoops(drift, tier, boost) {
      if (!this.driftN) return; const t = this.ctx.currentTime;
      this.driftN.g.gain.setTargetAtTime(drift ? 0.05 + 0.03 * tier : 0, t, 0.05); this.driftN.fl.frequency.setTargetAtTime(2200 + tier * 500, t, 0.1);
      this.boostN.g.gain.setTargetAtTime(boost ? 0.22 : 0, t, boost ? 0.04 : 0.25);
    },
    last: {},
    once(key, gap) { const now = performance.now(); if (now - (this.last[key] || 0) < gap) return false; this.last[key] = now; return true; },   // no stacked duplicates
    land() { if (this.once("land", 120)) this.tone("sine", 140, 60, 0.12, 0.35); },
    jump() { if (this.once("jump", 80)) this.tone("square", 420, 900, 0.14, 0.12); },
    driftOk(tier) { [0, 1, 2].slice(0, tier).forEach((k, i) => setTimeout(() => this.tone("triangle", 700 + 220 * i, 1400 + 300 * i, 0.16, 0.25), i * 70)); this.whoosh(); },
    driftFail() { this.tone("sawtooth", 320, 110, 0.25, 0.18); },
    boostStart() { this.tone("sawtooth", 150, 1200, 0.45, 0.2); },
    fire() { this.tone("square", 220, 1760, 0.3, 0.22); setTimeout(() => this.tone("triangle", 1760, 2640, 0.25, 0.2), 80); },
    hit() { this.tone("sine", 200, 45, 0.35, 0.55); this.tone("square", 90, 50, 0.15, 0.15); },
    combo(n) { if (this.once("combo", 60)) this.tone("triangle", 520 + Math.min(n, 30) * 40, 1040 + Math.min(n, 30) * 60, 0.09, 0.14); },
    tone(type, f0, f1, dur, vol) {
      if (!this.ctx || !(save.sfxVol > 0)) return; const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g); g.connect(this.sfx); o.start(t); o.stop(t + dur + 0.02);
    },
    beep() { this.tone("square", 880, 880, 0.12, 0.18); },
    coin() { if (!this.once("coin", 50)) return; this.tone("square", 1320, 1980, 0.09, 0.12); },
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
      // a voice the player picked wins; otherwise the best-ranked one (a newly downloaded Premium voice takes over automatically)
      const chosen = save.voiceChosen && this.list.find(v => v.voiceURI === save.voiceURI);
      this.voice = chosen || this.list[0] || null;
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
      if (this.ok && (!this.voice || !this.list.length)) this.pick();   // iOS sometimes lists voices only after the first speech
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
  window.addEventListener("touchend", firstTouch, { capture: true }); window.addEventListener("click", firstTouch, { capture: true });   // iOS counts these as user gestures for audio
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
  function buildWorld(stage, graph) {
    if (world) world.dispose(scene); world = NRW.build(scene, stage, graph, qbank, qEff());
    // 4.0: shorter view distance on phones/tablets -> fewer chunks drawn (fog hides the cut)
    const far = qEff() === "high" ? 340 : qEff() === "mid" ? 250 : 190; scene.fog.far = far; NRW.U.fogFar.value = far; camera.far = Math.max(600, far * 3); camera.updateProjectionMatrix();
    return world;
  }

  // bloom post-processing (skipped on "가볍게")
  function setupPost() {
    const PP = window.THREE_PP; composer = null; if (!PP || qEff() !== "high") { resize(); return; }
    try { composer = new PP.EffectComposer(renderer); composer.addPass(new PP.RenderPass(scene, camera)); composer.addPass(new PP.UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.6, 0.4, 0.86)); composer.addPass(new PP.OutputPass()); } catch (e) { composer = null; }
    resize();
  }

  //================== STAR ==================
  const star = buildStar(); scene.add(star.root);
  scene.add(camera); const fx = createFX(scene, camera);   // camera in the scene so speed lines (its children) render
  const trail = []; { const tm = addMat(0xFFD34D, 0.28); for (let i = 0; i < 12; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), tm); scene.add(m); trail.push(m); } }
  const SV = { t: 0, expr: "Normal", base: "Normal", exprT: 0, spin: 0, spinVel: 0, squash: 0, squashVel: 0, wasGround: true, shake: 0, lastV: -1, lean: 0, victory: false, hist: [], bend: 0, flash: 0, hop: 0, headShake: 0, roll: 0 };
  // 3.0 reactions
  function starHit() { SV.squashVel -= 9; SV.flash = 1; SV.shake = 0.25; }
  function starCorrect() { SV.hop = 1; SV.spinVel = 540; }
  function starWrong() { SV.headShake = 0.9; }
  function setExpr(e, sec) { SV.expr = e; SV.exprT = sec; }
  function setBase(e) { SV.base = e; }
  const FR1 = { p: new THREE.Vector3(), q: new THREE.Quaternion(), f: new THREE.Vector3() }, FR2 = { p: new THREE.Vector3(), q: new THREE.Quaternion(), f: new THREE.Vector3() };
  const FXS = { ground: null, groundQ: null, fwd: null, height: 0, falling: false, drifting: false, tier: 0, speed01: 0, boost: false, visible: true };
  function poseStar(sim, dt, showcase) {
    SV.t += dt; const t = SV.t;
    const fr = NRW.frameAtInto(sim.seg, sim.s, sim.x, NR.Sim.HOVER + sim.y, FR1); star.root.position.copy(fr.p);
    // star faces the camera (face on +z, root looks back along -forward)
    star.root.quaternion.copy(fr.q);
    // lean into steering (smoothed), drift yaw, pitch with vertical speed, forward lean with speed
    SV.roll += (NR.clamp(-sim.vx * 2.4, -30, 30) - SV.roll) * (1 - Math.exp(-10 * dt));
    let roll = SV.roll, yaw = sim.drifting ? sim.driftDir * (30 + 6 * sim.driftTier) : 0, pitch = NR.clamp(-sim.vy * 2, -20, 20) + 7 * sim.speed01, bob = sim.grounded ? Math.sin(t * 3.2) * 0.09 : 0;
    if (SV.hop > 0) { SV.hop = Math.max(0, SV.hop - dt * 1.8); bob += Math.sin((1 - SV.hop) * Math.PI) * 0.9; }
    if (SV.headShake > 0) { SV.headShake = Math.max(0, SV.headShake - dt); yaw += Math.sin(t * 26) * 22 * SV.headShake; }
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
    SV.bend += ((boosting ? 1 : 0) - SV.bend) * (1 - Math.exp(-(boosting ? 8 : 4) * dt)); star.bodyMat.uniforms.uBend.value = SV.bend * (0.8 + 0.2 * Math.sin(t * 20));
    SV.flash = Math.max(0, SV.flash - dt * 5); star.bodyMat.uniforms.uFlash.value = SV.flash;
    // expression
    if (SV.exprT > 0) SV.exprT -= dt; let ex = SV.exprT > 0 ? SV.expr : SV.base;
    if (Voice.talking && Voice.star && (ex === "Normal" || ex === "Focus")) ex = Math.sin(t * 22) > 0 ? "Talk" : "Normal";
    for (const k in star.faces) star.faces[k].visible = k === ex;
    // trail
    if (SV.hist.length < 40) SV.hist.unshift(star.root.position.clone()); else { const v = SV.hist.pop(); v.copy(star.root.position); SV.hist.unshift(v); }
    trail.forEach((m, i) => { const h = SV.hist[Math.min(SV.hist.length - 1, i * 3 + 2)]; if (!h) return; m.position.copy(h); m.quaternion.copy(camera.quaternion); const k = 1 - i / trail.length; m.position.y -= 0.25; m.scale.setScalar((0.35 + 0.9 * sim.speed01) * k + 0.05); m.visible = sim.speed > 8 && !showcase; });
    const gf = NRW.frameAtInto(sim.seg, sim.s, sim.x, 0.02, FR2);
    FXS.ground = gf.p; FXS.groundQ = gf.q; FXS.fwd = gf.f; FXS.height = sim.y; FXS.falling = sim.vy < 0; FXS.drifting = sim.drifting && !showcase; FXS.tier = sim.driftTier; FXS.speed01 = showcase ? 0 : sim.speed01; FXS.boost = boosting && !showcase;
    fx.update(dt, FXS);
    Snd.setLoops(sim.drifting && !showcase, sim.driftTier, boosting && !showcase && race && race.phase === "run");
  }

  //================== 4.6 ITEMS / COLLAPSE / EVOLUTION ==================
  // Neurotransmitter items are EDUCATIONAL ANALOGIES - real effects depend on receptors and circuits.
  const ITEMS = {
    glu: { icon: "🟢", name: "글루탐산", col: "#5CFF9D", get: "흥분성 전달물질", use: "글루탐산! 막전위 +12 mV · 가속 (흥분성 시냅스 비유)" },
    gaba: { icon: "🔵", name: "GABA", col: "#5C9CFF", get: "억제성 전달물질", use: "GABA 보호막 4초 · 막전위 −12 mV (억제·안정화 비유)" },
    ach: { icon: "🟡", name: "아세틸콜린", col: "#FFD34D", get: "신경근접합부 전달물질", use: "아세틸콜린! 근육 수축 슈퍼 점프 (신경근접합부 비유)" },
    dopa: { icon: "🟣", name: "도파민", col: "#C79CFF", get: "보상 회로 관련", use: "도파민! 6초간 점수 ×2 (보상 학습 비유 — 실제 작용은 수용체·회로에 따라 달라요)" },
  };
  function updateItemUi() {
    const it = race && race.sim.item, b = document.querySelector('.tb[data-k="item"]'); if (!b) return;
    $("#item-ico").textContent = it ? ITEMS[it].icon : "·"; $("#item-name").textContent = it ? ITEMS[it].name : "아이템"; b.classList.toggle("has", !!it);
  }
  let collapseWall = null; const FRC = { p: new THREE.Vector3(), q: new THREE.Quaternion(), f: new THREE.Vector3() };
  function tickCollapse() {
    const sim = race.sim, C = sim.collapse;
    if (!collapseWall) { collapseWall = new THREE.Mesh(new THREE.CircleGeometry(12, 40), new THREE.MeshBasicMaterial({ color: 0xFF1F4B, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); scene.add(collapseWall); }
    if (!C) { collapseWall.visible = false; return; }
    const gap = sim.progress - C.p, sW = sim.s - gap / (sim.seg.progScale || 1);
    collapseWall.visible = sW > 0; if (sW > 0) { NRW.frameAtInto(sim.seg, sW, 0, 4, FRC); collapseWall.position.copy(FRC.p); collapseWall.quaternion.copy(FRC.q); collapseWall.material.opacity = 0.35 + 0.25 * Math.sin(performance.now() / 90); }
    setStyle("#h-collapse-fill", "width", Math.max(0, Math.min(100, 100 - gap)).toFixed(0) + "%"); setText("#h-collapse-m", Math.max(0, Math.round(gap)) + "m");
    const danger = gap < 28; if ($("#app").classList.contains("danger") !== danger) $("#app").classList.toggle("danger", danger);
  }
  // evolution: mastery XP (clears with >= 80% accuracy, perfect runs, rival wins, survival)
  const FORMS = [
    { name: "Rookie Star", need: 0, B: 0xFFD34D, S: 0xF29B38, R: 0xFFF3C4, trail: 0xFFD34D, desc: "기본 STAR-01" },
    { name: "Spark Star", need: 2, B: 0xFFB04D, S: 0xFF5C4D, R: 0xFFE0C0, trail: 0xFF7A3D, desc: "불꽃 꼬리 · 주황 스파크" },
    { name: "Pulse Star", need: 5, B: 0x7CF5FF, S: 0x2E8CE6, R: 0xE8FFFF, trail: 0x2EE6D6, desc: "청록 펄스 · 집중한 표정" },
    { name: "Nova Star", need: 9, B: 0xD9A8FF, S: 0x8A4DFF, R: 0xFFF0FF, trail: 0xC79CFF, desc: "보라 노바 · 반짝이는 눈" },
    { name: "Synapse Master", need: 14, B: 0xFFF4D6, S: 0xFFB627, R: 0xFFFFFF, trail: 0xFFFFFF, desc: "황금빛 · 모든 신경 경로의 달인" },
  ];
  const formLevel = () => { const xp = save.xp || 0; let l = 0; FORMS.forEach((f, i) => { if (xp >= f.need) l = i; }); return l; };
  function applySkin() {
    const i = Math.min(save.skin == null ? formLevel() : save.skin, formLevel()), F = FORMS[i], u = star.bodyMat.uniforms;
    u.B.value.setHex(F.B); u.S.value.setHex(F.S); u.R.value.setHex(F.R); if (trail[0]) trail[0].material.color.setHex(F.trail); star.halo.material.color.setHex(F.trail);
    SV.form = i;
  }
  function renderEvo() {
    const lv = formLevel(), xp = save.xp || 0, next = FORMS[lv + 1];
    $("#evo-info").textContent = `숙련 XP ${xp} · 현재 형태 ${FORMS[lv].name}` + (next ? ` · 다음 진화(${next.name})까지 ${next.need - xp} XP` : " · 최종 형태!") + "  — 정답률 80% 이상 클리어 +1, 만점 +1, 라이벌 1위 +1, 서바이벌 60초 이상 +1";
    $("#evo-list").innerHTML = FORMS.map((F, i) => `<div class="evo${i > lv ? " locked" : ""}${(save.skin == null ? lv : save.skin) === i ? " cur" : ""}"><div class="sw" style="background:linear-gradient(90deg,#${F.B.toString(16).padStart(6, "0")},#${F.S.toString(16).padStart(6, "0")})"></div><b>${i + 1}. ${F.name}</b><small>${F.desc}<br>필요 XP ${F.need}</small>${i <= lv ? `<button data-skin="${i}">${(save.skin == null ? lv : save.skin) === i ? "사용 중" : "이 모습 사용"}</button>` : "<small>🔒 잠김</small>"}</div>`).join("");
    $$("#evo-list [data-skin]").forEach(b => b.addEventListener("click", () => { save.skin = +b.dataset.skin; persist(); applySkin(); renderEvo(); }));
  }

  //================== 4.5 RIVALS / GHOST ==================
  // Three AI racers run their OWN simulation on the same track (real driving, real overtakes).
  const RIVALS = [
    { name: "GLUTA", color: 0xFF5C4D, top: 41.5, ai: { accuracy: 0.7, noise: 0.25, boostAt: 0.2 }, desc: "공격형 고속 주행" },
    { name: "GABA", color: 0x5C9CFF, top: 39.2, ai: { accuracy: 0.88, noise: 0.08, drift: false, boostAt: 0.8 }, desc: "안정형 방어 주행" },
    { name: "AXON", color: 0x5CFF9D, top: 40.6, ai: { accuracy: 0.8, noise: 0.15 }, desc: "균형형 기술 주행" },
  ];
  let _starGeo = null;
  function makeMiniStar(color, ghost) {
    if (!_starGeo) _starGeo = puffy(RI, TH, 1.15);
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const mat = ghost ? new THREE.MeshBasicMaterial({ color: 0xE8F6FF, transparent: true, opacity: 0.35, depthWrite: false }) : toonMat(color, new THREE.Color(color).multiplyScalar(0.55).getHex(), 0xffffff, 2.2, 0x101010);
    body.add(new THREE.Mesh(_starGeo, mat)); body.scale.setScalar(1.1);
    if (!ghost) {
      for (const sx of [-1, 1]) { const e = sph([sx * 0.22, 0.12, 0.43], [0.13, 0.2, 0.08], std(0x1A1033, 0, 0.1)); body.add(e); }
      const lab = new THREE.Sprite(new THREE.SpriteMaterial({ map: NRW.labelTex([RIVALS.find(r => r.color === color).name], { w: 256, h: 96, border: "#" + color.toString(16).padStart(6, "0"), bg: "rgba(10,10,30,.8)" }), depthWrite: false, fog: false }));
      lab.scale.set(2.6, 1, 1); lab.position.y = 1.9; root.add(lab);
    }
    root.visible = false; scene.add(root); return { root, body };
  }
  const FRR = { p: new THREE.Vector3(), q: new THREE.Quaternion(), f: new THREE.Vector3() };
  function poseMini(m, seg, s, x, y, t, spin) {
    NRW.frameAtInto(seg, s, x, NR.Sim.HOVER + y, FRR); m.root.position.copy(FRR.p); m.root.quaternion.copy(FRR.q);
    m.body.position.y = Math.sin(t * 3.4) * 0.08; m.body.rotation.z = spin;
  }

  //================== CAMERA (ChaseCamera.cs port) ==================
  const CAM = { fwd: null, look: 0, roll: 0, kick: 0, showcase: 0, shake: 0, pos: new THREE.Vector3(), snap: true };
  const CS = { f: new THREE.Vector3(), pos: new THREE.Vector3(), anchor: new THREE.Vector3(), side: new THREE.Vector3(), right: new THREE.Vector3(), target: new THREE.Vector3(), look: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), upT: new THREE.Vector3(0, 1, 0), upS: new THREE.Vector3(0, 1, 0), bossP: new THREE.Vector3(0, 26, 0) };
  function follow(sim, dt, running) {
    const U = sim.forward, f = CS.f.set(-U.x, U.y * 0.5, U.z).normalize();
    if (!CAM.fwd) CAM.fwd = f.clone(); if (CAM.snap) CAM.fwd.copy(f); else CAM.fwd.lerp(f, 1 - Math.pow(0.02, dt)).normalize();
    const uw = sim.seg.roll ? sim.seg.upAt(sim.s) : null; CS.upT.set(uw ? -uw.x : 0, uw ? uw.y : 1, uw ? uw.z : 0);
    CS.upS.lerp(CS.upT, 1 - Math.pow(0.002, dt)).normalize(); const UPV = CS.upS;   // smoothed "up" (rotates through the corkscrew)
    const side = CS.side.crossVectors(UPV, CAM.fwd).normalize(); // three: up x fwd = left-of-travel; mirror => screen right
    const boosting = sim.boosting || sim.turboTimer > 0; CAM.kick += NR.clamp((boosting ? 1 : 0) - CAM.kick, -dt * 3, dt * 3);
    const want = running ? NR.clamp(sim.curvature * 110 * NR.lerp(0.4, 1, sim.speed01), -2.6, 2.6) : 0;
    CAM.look += (want - CAM.look) * (1 - Math.exp(-3 * dt)); CAM.roll += ((sim.drifting ? -sim.driftDir * 4 : 0) - CAM.roll) * (1 - Math.exp(-4 * dt));
    const P = sim.position, pos = CS.pos.set(-P.x, P.y, P.z), anchor = CS.anchor.copy(pos); anchor.addScaledVector(UPV, -Math.max(0, sim.y) * 0.5);
    let target, look; const bossScale = world && world.stage.boss ? 1.15 : 1;
    // corner look: Unity side vector is +right; in three the mirrored right = -side
    const right = CS.right.copy(side).negate();
    if (CAM.showcase > 0) {
      CAM.showcase -= dt; const a = NR.clamp01(CAM.showcase / 2.5);
      target = CS.target.copy(pos).addScaledVector(CAM.fwd, 4.2 + 1.5 * a).addScaledVector(right, 1.6 * a); target.addScaledVector(UPV, 0.9); look = CS.look.copy(pos).addScaledVector(UPV, 0.2);
      CAM.fwd.copy(f);
    } else {
      const dist = (6.4 + 1.8 * CAM.kick) * bossScale;
      target = CS.target.copy(anchor).addScaledVector(CAM.fwd, -dist).addScaledVector(right, -CAM.look * 0.35); target.addScaledVector(UPV, 2.6 * bossScale);
      look = CS.look.copy(anchor).addScaledVector(CAM.fwd, 8.5).addScaledVector(right, CAM.look).addScaledVector(UPV, 1.0);
      if (CAM.bossLook > 0) { CAM.bossLook -= dt; const k = Math.min(1, CAM.bossLook) * 0.65; look.lerp(CS.bossP, k); }
    }
    if (CAM.snap) { CAM.pos.copy(target); CAM.snap = false; } else CAM.pos.lerp(target, 1 - Math.pow(0.0006, dt));
    camera.position.copy(CAM.pos);
    if (CAM.shake > 0) { CAM.shake = Math.min(0.4, Math.max(0, CAM.shake - dt * 5)); camera.position.x += (Math.random() - 0.5) * CAM.shake; camera.position.y += (Math.random() - 0.5) * CAM.shake; }
    camera.up.copy(UPV); camera.lookAt(look);
    if (CAM.showcase <= 0 && Math.abs(CAM.roll) > 0.01) camera.rotateZ(CAM.roll * Math.PI / 180);
    CAM.kickPunch = Math.max(0, (CAM.kickPunch || 0) - dt * 2.5); const fov = CAM.showcase > 0 ? 50 : 62 + 14 * sim.speed01 + 10 * CAM.kick + 6 * CAM.kickPunch; if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = fov; camera.updateProjectionMatrix(); }
  }

  //================== INPUT (RaceInput.cs port) ==================
  const held = { left: 0, right: 0, drift: 0, boost: 0 }, keys = {}; let jumpPress = false, itemPress = false, steerSm = 0;
  $$(".tb").forEach(b => {
    const k = b.dataset.k, ids = new Set();
    const down = ev => { ev.preventDefault(); ids.add(ev.pointerId); try { b.setPointerCapture(ev.pointerId); } catch (e) { } b.classList.add("down"); if (k === "jump") jumpPress = true; else if (k === "item") itemPress = true; else held[k] = 1; };
    const up = ev => { ids.delete(ev.pointerId); if (!ids.size) { b.classList.remove("down"); if (k !== "jump") held[k] = 0; } };
    b.addEventListener("pointerdown", down); b.addEventListener("pointerup", up); b.addEventListener("pointercancel", up); b.addEventListener("lostpointercapture", up);
    b.addEventListener("contextmenu", e => e.preventDefault());
  });
  addEventListener("keydown", e => { keys[e.code] = true; if (["Space", "ArrowUp", "KeyW"].includes(e.code) && !e.repeat) jumpPress = true; if ((e.code === "Escape" || e.code === "KeyP") && race && race.phase === "run") pauseRace(); if (e.code === "Space") e.preventDefault(); });
  addEventListener("keyup", e => { keys[e.code] = false; });
  addEventListener("blur", () => { for (const k in held) held[k] = 0; for (const k in keys) keys[k] = false; });
  // 4.7: half-screen tap steering (chosen in the control picker): hold the left/right half of the screen
  const tapHeld = { left: new Set(), right: new Set() };
  $$("#tapzone .tz").forEach(z => {
    const side = z.dataset.side;
    z.addEventListener("pointerdown", ev => { ev.preventDefault(); tapHeld[side].add(ev.pointerId); try { z.setPointerCapture(ev.pointerId); } catch (e) { } z.classList.add("down"); });
    const up = ev => { tapHeld[side].delete(ev.pointerId); if (!tapHeld[side].size) z.classList.remove("down"); };
    z.addEventListener("pointerup", up); z.addEventListener("pointercancel", up); z.addEventListener("lostpointercapture", up);
  });
  function applyControlMode() { $("#touch").classList.toggle("tapmode", save.controlMode === "tap"); }
  function readInput(dt) {
    let steer = 0; if (held.left || tapHeld.left.size || keys.ArrowLeft || keys.KeyA) steer -= 1; if (held.right || tapHeld.right.size || keys.ArrowRight || keys.KeyD) steer += 1;
    const drift = !!(held.drift || keys.KeyZ || keys.ControlLeft || keys.ArrowDown || keys.KeyS), boost = !!(held.boost || keys.ShiftLeft || keys.KeyX);
    steer = NR.clamp(steer, -1, 1); const r = dt * (steer === 0 ? 10 : 6); steerSm += NR.clamp(steer - steerSm, -r, r);
    const j = jumpPress; jumpPress = false; const it = itemPress || keys.KeyE; itemPress = false; return { steer: steerSm, jump: j, drift, boost, item: it };
  }

  //================== UI HELPERS ==================
  const show = (sel, on) => $(sel).classList.toggle("on", !!on);
  function screen(name) { $$(".screen").forEach(s => s.classList.toggle("on", s.id === "scr-" + name)); }
  let toastT = 0, hintT = 0, answerT = 0, storyT = 0; const storyQ = [];
  function toast(text, color = "#F2F0FF", sec = 1.6) { const t = $("#h-toast"); t.textContent = text; t.style.color = color; t.style.opacity = 1; toastT = sec; }
  function hint(text, sec = 5, speech) { if (!save.showHints) return; const h = $("#h-hint"); h.textContent = text; h.style.display = "block"; hintT = sec; Voice.say(speech || text, { mode: "idle" }); }
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
    // question only - answer options are on screen, not read aloud
    return pickOne(["자, 문제!", "문제 나간다!", "이번 문제야.", "잘 들어 봐!"]) + " " + q.question;
  }
  // while racing STAR-01 says the key sentence only; the full explanation is one tap away (🔊 해설 듣기)
  const firstSentence = t => { const ss = String(t).match(/[^.!?]+[.!?]?/g) || [String(t)]; let out = ss[0].trim(); if (out.length < 30 && ss[1]) out += " " + ss[1].trim(); return out; };
  function answerSpeech(q, chosen, correct) {
    const ans = optSpeech(q.options[q.answer]), wrong = correct ? "" : NR.wrongExp(q, chosen);
    if (correct) return pickOne(["딩동댕! 맞았어!", "정답! 잘했어!", "맞아, 역시!", "좋아, 정답이야!"]) + " " + firstSentence(q.explanation);
    return pickOne(["앗, 아깝다!", "아쉽다!", "음, 이건 틀렸어."]) + " " + firstSentence(q.explanation);   // key point only, no option names
  }
  let lastAnswer = null;
  function showQuestion(q, title) {
    if (!q) return; show("#apanel", false); answerT = 0;
    $("#q-title").textContent = title; $("#q-tag").textContent = "[" + q.topic + " · " + q.difficulty + "]"; $("#q-text").textContent = q.question;
    const lanes = questionLanes(q, q.options.length);
    $("#q-opts").innerHTML = q.options.map((o, i) => `<div class="opt" data-i="${i}" style="border-left:8px solid ${HEXS(LANE[i % 4])}"><span class="lane">${lanes[i]}</span><span class="k" style="color:${HEXS(LANE[i % 4])}">${LETTER(i)}</span>${esc(o)}</div>`).join("");
    show("#qpanel", true);
    if (!race || race.mode === "story") Voice.say(questionSpeech(q), { tag: "q", mode: "polite" });
  }
  function showAnswer(q, chosen, correct, extra, sec) {
    show("#qpanel", false); if (!q) return; const p = $("#apanel");
    p.classList.toggle("bad", !correct); $("#a-title").textContent = (correct ? "정답!  " : "오답…  정답은 ") + LETTER(q.answer) + ". " + q.options[q.answer];
    const wrong = correct ? "" : NR.wrongExp(q, chosen); $("#a-wrong").textContent = wrong; $("#a-wrong").style.display = wrong ? "block" : "none";
    $("#a-text").textContent = q.explanation; $("#a-extra").textContent = extra || "";
    p.classList.remove("full"); $("#a-more").textContent = "자세히 ▾"; show("#apanel", true); answerT = Math.min(sec, 6); lastAnswer = { q, chosen, correct };
    if (!race || race.mode === "story") Voice.say(answerSpeech(q, chosen, correct), { tag: "exp", mode: "polite" }); else answerT = 2.5;   // never cut mid-sentence; the next question waits
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
  // 4.0 P0: build the stage behind a "preparing" screen, then pre-compile every shader and upload every
  // texture BEFORE the intro/countdown. (iOS otherwise compiles them the first time an object comes into
  // view - that is the hitch when the camera swings behind STAR-01 during "3, 2, 1".)
  function startStage(id, mode) {
    mode = id === "tutorial" ? "story" : mode || (id === "survival" ? "survival" : (save.mode || "story"));
    const ld = $("#loading"); ld.innerHTML = "<div>구간 준비 중…</div>"; ld.classList.remove("off"); race = null;
    setTimeout(() => { try { buildStage(id, mode); } finally { ld.classList.add("off"); } }, 30);
  }
  function warmUp() {
    try {
      world.root.traverse(o => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of ms) if (m.map) renderer.initTexture(m.map); });
      renderer.compile(scene, camera); if (composer) composer.render(); else renderer.render(scene, camera);
    } catch (e) { }
  }
  let rivalMeshes = null, ghostMesh = null;
  function buildStage(id, mode) {
    qbank = shuffledBank();
    const stage = id === "survival" ? NR.SURVIVAL : id === "tutorial" ? NR.TUTORIAL : (NR.STAGES.find(s => s.id === id) || NR.STAGES[0]); if (id !== "survival" && id !== "tutorial") save.lastStage = stage.id; persist();
    NR.STATE.plastic = ((save.plastic || {})[stage.id]) || 0;   // neuroplasticity shortcut state for this chapter
    const graph = stage.build(qbank); buildWorld(stage, graph);
    const sim = new NR.Sim(graph), learn = new NR.Session(qbank), forkSegByQ = new Map();
    for (const seg of graph.segments) if (seg.fork) forkSegByQ.set(seg.fork.questionId, seg);
    let bossMax = 0; if (stage.boss && !graph.bossMax) { for (const e of graph.allEvents()) if (e.type === NR.EV.Gate && e.tag === "boss") bossMax++; for (const s of graph.segments) if (s.fork) bossMax++; }
    race = { stage, graph, sim, learn, forkSegByQ, phase: "intro", t: 0, cd: 4, timeScale: 1, pending: null, pendingLanes: null, bossMax, bossHp: bossMax, finishT: 0, auto: AUTO ? new NR.AutoPilot() : null, paused: false, lastSection: "", combo: 0, comboT: 0, maxCombo: 0, score: 0, lastOrb: -9, mode: mode || "story" };
    if (graph.bossMax) { race.bossMax = graph.bossMax; race.bossHp = graph.bossMax; }
    race.tut = stage.id === "tutorial" ? { step: null, done: true } : null; $("#tut").classList.remove("on"); applyControlMode();
    setupMode(race); $("#h-collapse").classList.remove("on"); $("#app").classList.remove("danger"); updateItemUi();
    $("#h-combo").classList.remove("on"); fx.hide(); $("#mission").classList.remove("on"); $("#reflex").classList.remove("on"); miEvent = null; miResT = 0;
    screen(""); show("#hud", true); show("#touch", false); show("#qpanel", false); show("#apanel", false); show("#result", false); show("#pause", false);
    $("#h-boss").classList.toggle("on", stage.boss); updateBoss();
    setSection(graph.start.name); countdown(""); storyQ.length = 0; storyT = 0; $("#h-story").style.display = "none"; $("#h-hint").style.display = "none";
    SV.victory = false; SV.spin = 0; SV.hist.length = 0; setBase("Focus"); setExpr("Normal", 0); CAM.snap = true; CAM.showcase = 999;
    poseStar(sim, 0.016, true); follow(sim, 0.016, false); warmUp();
    Snd.play("race");
    const intro = C.story[stage.introStory];
    if (intro && race.mode === "story" && !(AUTO && WARP > 1)) showDialog(intro, startCountdown); else startCountdown();
  }
  // ---- 4.5 mode setup / per-frame / finish ----
  function setupMode(r) {
    if (!rivalMeshes) { rivalMeshes = RIVALS.map(d => makeMiniStar(d.color, false)); ghostMesh = makeMiniStar(0xffffff, true); }
    rivalMeshes.forEach(m => m.root.visible = false); ghostMesh.root.visible = false; $("#h-rank").classList.remove("on");
    if (r.mode === "rival") {
      r.rivals = RIVALS.map((d, i) => { const sim = new NR.Sim(r.graph, { own: true }); sim.baseTopSpeed = d.top; sim.x = [-3, 3, 0][i]; return { d, sim, ap: new NR.AutoPilot(d.ai), mesh: rivalMeshes[i], time: 0 }; });
      r.rivals.forEach(v => v.mesh.root.visible = true); $("#h-rank").classList.add("on"); r.bumpT = 0;
    }
    if (r.mode === "time") {
      const best = (save.ta || {})[r.stage.id]; r.splitsAt = [0.25, 0.5, 0.75]; r.splits = []; r.ghostRec = []; r.ghostT = 0; r.bestTA = best || null;
      if (best && best.ghost && best.ghost.length) { r.ghost = best.ghost; ghostMesh.root.visible = true; }
      $("#h-rank").classList.add("on");
    }
    if (r.mode === "survival") { r.sim.boostEnergy = 1; r.life = 100; $("#h-rank").classList.add("on"); }
  }
  const segById = id => race.graph.segments[id];
  function tickMode(dt) {
    const r = race, sim = r.sim, total = r.graph.referenceLength;
    r.hudT = (r.hudT || 0) - dt; const hud = r.hudT <= 0; if (hud) r.hudT = 0.25;   // rank board 4x per second
    if (r.mode === "rival") {
      const me = sim.progress, rows = [{ name: "STAR-01", p: sim.finished ? Infinity : me, me: true, col: "#FFD34D", fin: sim.finished ? sim.raceTime : 0 }];
      for (const v of r.rivals) {
        if (!v.sim.finished) { const gap = v.sim.progress - me; v.sim.speedScale = NR.clamp(1 - gap / 5000, 0.94, 1.06); }   // gentle rubber band keeps it a race
        poseMini(v.mesh, v.sim.seg, v.sim.s, v.sim.x, v.sim.y, r.sim.raceTime + v.d.top, v.sim.y > 0.2 ? v.sim.raceTime * 9 : 0);
        rows.push({ name: v.d.name, p: v.sim.finished ? Infinity : v.sim.progress, col: "#" + v.d.color.toString(16).padStart(6, "0"), fin: v.time });
        // light body-checks when side by side
        if (r.phase === "run" && v.sim.seg === sim.seg && Math.abs(v.sim.s - sim.s) < 2.4 && Math.abs(v.sim.x - sim.x) < 1.9) {
          const d = Math.sign(sim.x - v.sim.x) || 1; sim.vx += d * 7; v.sim.vx -= d * 7; if (r.bumpT <= 0) { Snd.thud(); toast(v.d.name + " 몸싸움!", "#FF8A3D", 0.8); r.bumpT = 1.2; }
        }
      }
      r.bumpT -= dt;
      rows.sort((a, b) => (a.fin && b.fin) ? a.fin - b.fin : b.p - a.p || 0); const pos = rows.findIndex(x => x.me) + 1; r.position = pos;
      if (hud) $("#h-rank").innerHTML = `<b>${pos}위 / 4</b>` + rows.map(x => `<div class="row${x.me ? " me" : ""}"><span><i class="tag" style="background:${x.col}"></i>${x.name}</span><span>${x.me ? "" : isFinite(x.p) ? ((x.p - me) >= 0 ? "+" : "") + Math.round(x.p - me) + "m" : "골인"}</span></div>`).join("");
    } else if (r.mode === "time") {
      if (r.phase === "run") {
        r.ghostT += dt; if (r.ghostT >= 0.1) { r.ghostT = 0; r.ghostRec.push(sim.seg.id, Math.round(sim.s * 10) / 10, Math.round(sim.x * 100) / 100, Math.round(sim.y * 100) / 100); }
        const k = r.splits.length; if (k < r.splitsAt.length && sim.progress >= r.splitsAt[k] * total) {
          r.splits.push(sim.raceTime); const b = r.bestTA && r.bestTA.splits ? r.bestTA.splits[k] : null, d = b ? sim.raceTime - b : null;
          toast(`구간 ${k + 1}: ${fmt(sim.raceTime)}` + (d == null ? "" : `  (${d <= 0 ? "−" : "+"}${Math.abs(d).toFixed(1)})`), d == null ? "#F2F0FF" : d <= 0 ? "#5CFF9D" : "#FF6D8D", 1.6);
        }
      }
      if (r.ghost) {   // replay the best run
        const i = Math.floor(sim.raceTime / 0.1) * 4, g = r.ghost;
        if (i + 3 < g.length) { const seg = segById(g[i]); if (seg) { poseMini(ghostMesh, seg, Math.min(g[i + 1], seg.length), g[i + 2], g[i + 3], sim.raceTime, 0); ghostMesh.root.visible = true; } } else ghostMesh.root.visible = false;
      }
      const best = r.bestTA ? r.bestTA.time : null;
      if (hud) $("#h-rank").innerHTML = `<b>⏱ 타임어택</b><div class="row"><span>최고 기록</span><span>${best ? fmt(best) : "-"}</span></div><div class="row"><span>구간</span><span>${r.splits.length}/${r.splitsAt.length + 1}</span></div>`;
    } else if (r.mode === "survival") {
      const prog = NR.clamp01(sim.progress / total);
      sim.speedScale = 1 + 0.4 * prog;   // faster and faster
      if (r.phase === "run") { r.life = Math.max(0, r.life - dt * (0.9 + 1.4 * prog)); if (r.life <= 0) { survivalOver(); return; } }
      if (hud) $("#h-rank").innerHTML = `<b>∞ 서바이벌</b><div class="row"><span>생존</span><span>${fmt(sim.raceTime)}</span></div><div class="row"><span>속도</span><span>×${sim.speedScale.toFixed(2)}</span></div><div class="row"><span>❤ 생명력</span><span style="color:${r.life < 30 ? "#FF4D6D" : "#5CFF9D"}">${Math.round(r.life)}</span></div>`;
    }
  }
  function survivalOver() {
    const r = race; r.phase = "finish"; r.finishT = 0; r.survivalDead = true; show("#touch", false); countdown("생명력 0"); Snd.thud(); setExpr("Hurt", 99); CAM.showcase = 3.2;
    Voice.say("생명력이 다 떨어졌어… 오브를 모으고 충돌을 피하면 더 오래 달릴 수 있어!");
  }
  function startCountdown() {
    if (!race) return; race.phase = "count"; race.t = 0; race.cd = 4; race.cdStart = performance.now(); CAM.showcase = 2.6; setExpr("Joy", 2); SV.spinVel = 720; show("#touch", !race.auto);
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
      r.t = (performance.now() - r.cdStart) / 1000; const n = 3 - Math.floor(r.t - 0.6);   // 4.0: wall clock, a slow frame can't stretch it
      if (r.t >= 0.6 && n !== r.cd && n >= 1 && n <= 3) { r.cd = n; countdown(String(n)); Snd.beep(); }
      if (r.t >= 3.6) { countdown("GO!"); Snd.chime(); r.phase = "run"; r.t = 0; hint(r.auto ? "AUTO 데모 주행 중" : (save.controlMode === "tap" ? "화면 왼쪽/오른쪽 절반을 눌러서 조향!" : "◀ ▶ 버튼으로 조향!") + " 코너에서는 드리프트를 누른 채 꺾으면 터보 충전.", 5, r.auto ? "" : (r.tut ? "" : "자, 출발!")); }
    } else if (r.phase === "run") {
      r.t += dt; if (r.t > 0.8 && r.t < 1.2) countdown("");
      const inp = r.auto ? r.auto.think(sim) : readInput(dt);
      if (r.queued && (!Voice.has("exp") || distToDecision() < 110)) { const qd = r.queued; r.queued = null; showQuestion(qbank.get(qd.id), qd.title); Snd.beep(); }
      let wantSlow = 1; if (r.tut && r.tut.step && !r.tut.done && !r.auto) wantSlow = 0.6;
      if (r.pending && !r.auto && r.mode === "story") {
        const base = NR.clamp(save.thinkSlow, 0.2, 1), D = distToDecision(), v = Math.max(12, sim.speed);
        const need = r.queued ? Voice.remaining("exp") + 6 : save.voiceOn ? Voice.remaining("q") + 1.5 : 0;   // seconds of talking/reading still needed
        wantSlow = need > 0 && D < 900 ? NR.clamp(D / (v * need), Math.min(base, 0.5), base) : base;
      }
      r.timeScale += NR.clamp(wantSlow - r.timeScale, -dt * 2.5, dt * 2.5);
      $("#h-slow").style.display = r.timeScale < 0.97 && !$("#qpanel").classList.contains("on") ? "block" : "none"; $("#h-slow").textContent = r.queued ? "해설 듣는 중 · 슬로모션" : "생각 시간 · 슬로모션";
      let sdt = dt * r.timeScale * (r.auto ? WARP : 1);
      const n = Math.max(1, Math.ceil(sdt / (1 / 120) - 1e-4)), h = sdt / n;
      for (let i = 0; i < n && r.phase === "run"; i++) {
        sim.step(inp, h); inp.jump = false; handleEvents();
        if (r.rivals) for (const v of r.rivals) if (!v.sim.finished) { v.sim.step(v.ap.think(v.sim), h); v.sim.events.length = 0; if (v.sim.finished) { v.time = v.sim.raceTime; toast(v.d.name + " 골인!", "#B4AEDB", 1); } }
      }
      updateLane(); updateMission(); fadeNearGate();
    } else if (r.phase === "finish") {
      r.finishT += dt;
      if (r.rivals) for (const v of r.rivals) if (!v.sim.finished) { v.sim.step(v.ap.think(v.sim), Math.min(dt, 0.05)); v.sim.events.length = 0; if (v.sim.finished) v.time = v.sim.raceTime; }
      if (r.finishT > 3.2) { r.phase = "done"; showResult(); }
    }
    const running = r.phase === "run";
    poseStar(sim, dt, CAM.showcase > 0);
    follow(sim, dt, running);
    // HUD
    const prog = r.graph.referenceLength > 0 ? NR.clamp01(sim.distance / r.graph.referenceLength) : 0, pf = r.phase === "finish" || r.phase === "done" ? 1 : prog;
    setStyle("#h-prog", "width", (pf * 100).toFixed(1) + "%"); setStyle("#h-star", "left", (pf * 100).toFixed(1) + "%");
    setText("#h-time", fmt(sim.raceTime)); setText("#h-score", r.learn.correct + "/" + r.learn.total);
    setStyle("#h-energy", "width", (sim.boostEnergy * 100).toFixed(0) + "%");
    updateVm(dt); tickCombo(dt); tickTut(); tickCollapse(); if (r.mode !== "story") tickMode(dt);
    Snd.setHum(running ? sim.speed01 : 0, running && sim.boosting);
  }

  // DOM writes only when something changed (cheaper on phones)
  const domCache = new Map();
  function setText(sel, v) { v = String(v); if (domCache.get(sel) !== v) { domCache.set(sel, v); $(sel).textContent = v; } }
  function setStyle(sel, k, v) { const key = sel + k; if (domCache.get(key) !== v) { domCache.set(key, v); if (k.startsWith("--")) $(sel).style.setProperty(k, v); else $(sel).style[k] = v; } }
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

  //================== 3.0 COMBO & SCORE ==================
  // chained actions (dodge, jump-over, drift turbo, orb streak, node hit, correct answer, AP fire) grow the
  // combo; the multiplier scales points. A hit, wall, wrong answer, failed drift or 4 s of nothing ends it.
  const COMBO_WINDOW = 4;
  function comboAdd(n, pts, label) {
    const r = race; r.combo += n; r.comboT = COMBO_WINDOW; r.maxCombo = Math.max(r.maxCombo, r.combo);
    const mult = comboMult(); r.score += Math.round(pts * mult * (r.sim.dopamine > 0 ? 2 : 1));
    const el = $("#h-combo"); el.classList.add("on"); setText("#h-combo-n", r.combo); setText("#h-combo-x", "×" + mult.toFixed(1) + (label ? " " + label : ""));
    el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop"); Snd.combo(r.combo);
  }
  const comboMult = () => 1 + Math.min(3, Math.floor((race.combo || 0) / 5) * 0.5);
  function comboBreak() { const r = race; if (r.combo >= 5) toast("콤보 끊김 (" + r.combo + ")", "#B4AEDB", 0.8); r.combo = 0; r.comboT = 0; $("#h-combo").classList.remove("on"); }
  function tickCombo(dt) {
    const r = race; if (r.comboT > 0) { r.comboT -= dt; setStyle("#h-combo-t", "width", Math.max(0, r.comboT / COMBO_WINDOW * 100).toFixed(0) + "%"); if (r.comboT <= 0) comboBreak(); }
    setText("#h-score2", r.score);
  }

  // ---------- 4.7 tutorial ----------
  function tutSteps() {
    const tap = save.controlMode === "tap";
    return {
      left: ["⬅", "왼쪽으로 가 보기", tap ? "화면 왼쪽 절반을 누르고 있으면 왼쪽으로 가요. 왼쪽의 노란 오브를 모아 보세요!" : "왼쪽 아래 ◀ 버튼을 누르고 있으면 왼쪽으로 가요. 왼쪽의 노란 오브를 모아 보세요!", tap ? "tz-left" : "left"],
      right: ["➡", "이번엔 오른쪽!", tap ? "화면 오른쪽 절반을 누르고 있어 보세요. 손을 떼면 그 자리에서 똑바로 달려요." : "▶ 버튼을 누르고 있어 보세요. 손을 떼면 그 자리에서 똑바로 달려요.", tap ? "tz-right" : "right"],
      jump: ["⤒", "점프로 넘기", "빨간 파동이 다가오면 오른쪽 아래 [점프]! 공중에 뜬 동안은 부딪히지 않아요.", "jump"],
      drift: ["↯", "드리프트로 코너 돌기", "급커브예요! [드리프트]를 누른 채 커브 쪽으로 꺾고, 커브를 빠져나오면 손을 떼세요. 불꽃 색이 바뀔수록 강한 미니 터보!", "drift"],
      boost: ["⚡", "부스트", "[부스트]를 누르면 화면 아래 파란 '신호 에너지'를 써서 빨라져요. 에너지는 오브와 드리프트로 채워요.", "boost"],
      gate: ["🅰", "정답 게이트", "문제가 나오면 정답 보기가 있는 차선으로 들어가요. 화면 아래 '지금 A …'가 지금 내 차선이에요. 문제가 뜨는 동안은 조금 느려져요.", null],
      end: ["🏁", "연습 끝!", "잘했어요! 이제 진짜 신경계를 달려 봐요. 결승선까지 쭉!", null],
    };
  }
  function tutStart(key) {
    const r = race; if (!r.tut) return; const S = tutSteps()[key]; if (!S) return;
    r.tut.step = key; r.tut.done = key === "end"; r.tut.t = 0;
    const el = $("#tut"); el.classList.remove("done"); el.classList.add("on"); $("#tut-ico").textContent = S[0]; $("#tut-title").textContent = S[1]; $("#tut-desc").textContent = S[2];
    $("#h-hint").style.display = "none"; tutCue(S[3]); Voice.say(S[2], { mode: "replace" });
    if (key === "end") setTimeout(() => { if (race && race.tut) $("#tut").classList.remove("on"); }, 5000);
  }
  function tutCue(btn) {
    $$(".tb.cue,.tz.cue").forEach(b => b.classList.remove("cue")); if (!btn) return;
    const el = btn.startsWith("tz-") ? document.querySelector(`.tz[data-side="${btn.slice(3)}"]`) : document.querySelector(`.tb[data-k="${btn}"]`); if (el) el.classList.add("cue");
  }
  function tutDone(key) {
    const r = race; if (!r || !r.tut || r.tut.step !== key || r.tut.done) return;
    r.tut.done = true; tutCue(null); const el = $("#tut"); el.classList.add("done"); $("#tut-title").textContent = "✔ 잘했어요!"; Snd.chime();
    Voice.say(pickOne(["잘했어!", "좋아, 완벽해!", "바로 그거야!"]), { mode: "replace" }); setTimeout(() => { if (race && race.tut && race.tut.step === key) el.classList.remove("on"); }, 1400);
  }
  function tickTut() {
    const r = race, T = r.tut; if (!T || !T.step || T.done) return; const sim = r.sim;
    if (T.step === "left" && sim.x < -2) tutDone("left");
    else if (T.step === "right" && sim.x > 2) tutDone("right");
  }

  // ---------- 4.0 mission UI ----------
  let miEvent = null, miResT = 0;
  function nextSort() {
    const sim = race.sim; for (const e of sim.seg.events) { if (e.type !== NR.EV.Sort || e.consumed || e.s < sim.s) continue; return e.s - sim.s < 230 ? e : null; } return null;
  }
  function updateMission() {
    const el = $("#mission"), sim = race.sim;
    const low = $("#qpanel").classList.contains("on") || $("#apanel").classList.contains("on"); if (el.classList.contains("low") !== low) el.classList.toggle("low", low);
    if (miResT > 0) { miResT -= 1 / 60; return; }
    const e = nextSort();
    if (e !== miEvent && miEvent !== "line") {
      miEvent = e; el.classList.remove("res", "bad");
      if (!e) { el.classList.remove("on"); }
      else {
        el.classList.add("on"); $("#mi-prompt").textContent = (e.tag === "cross" ? "🧭 " : "🎯 ") + e.prompt + (e.total ? `  (${e.index + 1}/${e.total})` : "");
        $("#mi-lanes").innerHTML = e.labels.map((l, i) => `<div style="border-color:${HEXS(LANE[i % 4])}">${e.tag === "cross" ? (i ? "오른쪽 ▶" : "◀ 왼쪽") : esc(l)}</div>`).join("");
      }
    }
    if (miEvent && miEvent !== "line" && sim.seg.events.includes(miEvent)) { const lane = NR.Sim.nearest(miEvent.laneX, sim.x); $$("#mi-lanes div").forEach((d, i) => d.classList.toggle("cur", i === lane)); }
    if (sim.line) { el.classList.add("on"); el.classList.remove("res", "bad"); const L = sim.line, pct = L.total > 0 ? Math.round(L.inside / L.total * 100) : 100; setText("#mi-prompt", `⚖ 소뇌 균형 라인 — 선 위 ${pct}% (목표 60%)`); if (miEvent !== "line") $("#mi-lanes").innerHTML = ""; miEvent = "line"; domCache.delete("#mi-prompt"); }
    else if (miEvent === "line") { miEvent = null; el.classList.remove("on"); }
  }
  function missionFlash(ok, text) { const el = $("#mission"); el.classList.add("on"); el.classList.toggle("res", ok); el.classList.toggle("bad", !ok); $("#mi-prompt").textContent = text; $("#mi-lanes").innerHTML = ""; miEvent = null; miResT = 1.6; }
  const REFLEX = {
    stretch: { icon: "🔨", name: "신장반사!", act: "⚡ 부스트!", btn: "boost", why: "근방추가 늘어나면 Ia 감각신경 → α운동신경세포 → 같은 근육 수축 (단일시냅스 반사)" },
    flex: { icon: "📌", name: "굽힘(회피)반사!", act: "⤒ 점프!", btn: "jump", why: "통각 → 척수 사이신경세포 → 굽힘근 수축으로 다리를 들어 올리고 폄근은 억제" },
    crossed: { icon: "📌", name: "교차폄반사!", act: "", btn: null, why: "자극받은 다리는 굽히고, 반대쪽 다리는 펴서 체중을 받쳐요 (척수에서 교차)" },
    recip: { icon: "✋", name: "상호억제!", act: "아무것도 누르지 마!", btn: null, why: "작용근이 수축할 때 억제성 사이신경세포가 길항근을 이완시켜요" },
  };
  let rfTimer = 0;
  function showReflex(kind, side) {
    const R = REFLEX[kind]; if (!R) return; const el = $("#reflex");
    $("#rf-icon").textContent = R.icon; $("#rf-name").textContent = R.name; $("#rf-act").textContent = kind === "crossed" ? (side > 0 ? "◀ 왼쪽으로 피해!" : "오른쪽으로 피해! ▶") : R.act;
    el.classList.remove("cue"); el.classList.add("on"); Snd.tone("square", 1200, 1500, 0.12, 0.25);
    clearTimeout(rfTimer); rfTimer = setTimeout(() => { el.classList.add("cue"); if (R.btn) { const b = document.querySelector(`.tb[data-k="${R.btn}"]`); if (b) b.classList.add("cue"); } }, 380);   // name first, action cue a moment later
  }
  function endReflex(kind, ok) {
    const R = REFLEX[kind]; clearTimeout(rfTimer); $("#reflex").classList.remove("on", "cue"); $$(".tb.cue").forEach(b => b.classList.remove("cue"));
    if (!R) return;
    if (ok) { Snd.fire(); comboAdd(2, 250, "반사"); fx.burst(star.root.position, "correct"); missionFlash(true, "✔ " + R.name.replace("!", "") + " — " + R.why); }
    else { Snd.thud(); comboBreak(); starWrong(); missionFlash(false, "✘ " + R.name.replace("!", "") + " — " + R.why); }
  }

  // 4.3: when the gate/fork is close, the question box fades so the lanes are fully visible
  function fadeNearGate() {
    const r = race; let op = "1";
    // only the box background/border fades (via --bf); the text keeps full opacity
    if (r.pending && $("#qpanel").classList.contains("on")) { const d = distToDecision(); if (d < 130) op = Math.max(0, Math.min(1, (d - 40) / 90)).toFixed(2); }
    setStyle("#qpanel", "--bf", op);
    const e = typeof miEvent === "object" && miEvent ? miEvent : null; let mo = "1";
    if (e && r.sim.seg.events.includes(e)) { const d = e.s - r.sim.s; if (d < 90) mo = Math.max(0.25, Math.min(1, (d - 20) / 70)).toFixed(2); }
    setStyle("#mission", "--bf", mo);
  }
  function handleEvents() { const sim = race.sim; for (const e of sim.events) handle(e); sim.events.length = 0; }
  function feedback(ok) { if (ok) { Snd.chime(); setExpr("Correct", 2); starCorrect(); fx.burst(star.root.position, "correct"); } else { Snd.thud(); setExpr("Wrong", 2.2); starWrong(); CAM.shake = 0.15; } }
  function bossAnswer(ok) {
    const r = race; if (!r.bossMax) return;
    if (r.graph.bossMax) {   // 4.6: a diagnosis does not hurt NULL by itself - it exposes (or keeps shut) the weak point
      if (ok) { toast("정확한 진단! NULL 약점 노출 — 노란 링을 통과해 공격!", "#FFD34D", 2); world.bossHit(r.bossHp, r.bossMax); }
      else { toast("오진! 약점이 닫힌 채 NULL이 반격합니다", "#FF4D6D", 1.8); world.bossAttack(); CAM.shake = 0.2; }
      return;
    }
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
        if (e.src.tag === "boss") bossAnswer(e.correct); if (e.correct && e.src.questionId) world.showWeak(e.src.questionId);
        if (e.correct) comboAdd(2, 300, "정답"); else comboBreak(); tutDone("gate");
        showAnswer(q, e.lane, e.correct, extra, e.correct ? 7 : 11); r.pending = null; r.pendingLanes = null; r.queued = null; break;
      }
      case S.ForkChosen: {
        if (!e.tag && sim.seg.prog0 != null && race.graph.segments.find(g => g.next.includes(sim.seg) && g.fork && g.fork.kind === "plastic")) {
          const ap = race.graph.segments.find(g => g.next.includes(sim.seg)); if (e.lane === 1) toast(ap.fork.open ? "가소성 지름길! 강화된 연결로 빠르게" : "아직 잠겨 있어요 — 반복 학습으로 강화하세요", ap.fork.open ? "#5CFF9D" : "#B98CFF", 1.8); break;
        }
        if (!e.tag) {   // 4.0 risk/reward split (no question)
          if (e.lane === 1) { toast("위험 루트! 레이저·NULL 블록 · 오브 ×3", "#FF4D6D", 1.6); comboAdd(1, 100, "도전"); } else toast("안전 루트", "#5CFF9D", 1.2);
          break;
        }
        const q = qbank.get(e.tag); r.learn.answer(e.tag, e.lane, sim.raceTime);
        world.forkResult(e.tag, e.lane);
        if (r.stage.boss) bossAnswer(e.correct); if (e.correct) world.showWeak(e.tag); feedback(e.correct); if (e.correct) comboAdd(2, 300, "정답"); else comboBreak();
        showAnswer(q, e.lane, e.correct, e.correct ? "정답 경로: 지름길 + 신호 에너지 보너스!" : "복습 구간에 진입했습니다. 해설을 읽으며 천천히 이동하세요.", e.correct ? 7 : 12);
        if (!e.correct) toast("복습 구간 - 속도 저하", "#FF8A3D", 2); r.pending = null; r.pendingLanes = null; r.queued = null; break;
      }
      case S.RingHit: { world.ringHit(e.src, true); Snd.coin(); comboAdd(1, e.correct ? 120 : 60, e.correct ? "PERFECT" : ""); if (e.correct) toast("정중앙 PERFECT! 결절에서 활동전위 재생성", "#9CFFEA", 0.7); fx.burst(star.root.position, "land"); if (sim.ringChain >= 2) toast("도약전도 x" + sim.ringChain + "  +" + Math.round(sim.chainBonus * 100) + "%", "#FFB627", 0.9); break; }
      case S.RingMiss: { world.ringHit(e.src, false); if (sim.ringsTotal > 1) toast("결절을 놓쳤어요 - 연속 끊김", "#B4AEDB", 0.9); break; }
      case S.ObstacleHit: CAM.shake = 0.35; starHit(); comboBreak(); if (r.mode === "survival") { r.life = Math.max(0, r.life - 18); toast("생명력 −18", "#FF4D6D", 0.9); } fx.burst(star.root.position, "hit"); setExpr("Hurt", 1.2); Snd.thud(); toast("NULL 충돌! 전도 지연", "#FF4D6D", 1.2); break;
      case S.OrbCollected: case S.RepairOrb: {
        world.collect(e.src);
        if (e.type === S.OrbCollected && r.mode === "survival") r.life = Math.min(100, r.life + 4);
        if (e.type === S.OrbCollected) { Snd.coin(); const streak = sim.raceTime - r.lastOrb < 1.4; r.lastOrb = sim.raceTime; comboAdd(streak ? 1 : 0, 25); } else { Snd.chime(); setExpr("Joy", 1); toast("수초 복구 " + sim.repairCount + "/3", "#5CFF9D", 1.4); } break;
      }
      case S.WallHit: CAM.shake = 0.15; SV.squashVel -= 3; comboBreak(); Snd.thud(); setExpr("Surprise", 0.6); break;
      case S.DriftEnd:
        if (e.tier > 0) { tutDone("drift"); Snd.driftOk(e.tier); toast("드리프트 성공! 미니 터보 Lv." + e.tier, ["", "#4D8DFF", "#FFB627", "#FF5CC8"][e.tier], 1); setExpr("Joy", 0.8); fx.burst(star.root.position, "drift", e.tier); comboAdd(1, 80 * e.tier, "드리프트"); }
        else if (e.tag === "fail") { Snd.driftFail(); toast("드리프트 실패 — 코너에서 꺾어야 충전돼요", "#B4AEDB", 1.2); fx.burst(star.root.position, "fail"); comboBreak(); }
        break;
      case S.ObstacleDodged: if (e.tag === "jump" || e.correct) { comboAdd(1, 100, "점프 회피"); } else comboAdd(1, 50, "회피"); break;
      case S.Land: Snd.land(); SV.squashVel -= 4; fx.burst(star.root.position, "land"); break;
      case S.BoostStart: tutDone("boost"); Snd.boostStart(); setExpr("Joy", 1); CAM.kickPunch = 1; break;
      case S.Jump: Snd.jump(); tutDone("jump"); break;
      case S.Checkpoint: toast("체크포인트", "#9B5CFF", 1); break;
      case S.EnterSegment: setSection(sim.seg.zone === NR.ZONE.Review ? "복습 구간" : sim.seg.zone === NR.ZONE.Shortcut ? "지름길" : sim.seg.name); break;
      case S.Finish: finish(); break;
      // ---------- 4.6 special courses, items, boss ----------
      case S.LoopResult:
        if (e.correct) { toast("360° 루프 성공! 가속", "#5CFF9D", 1.4); Snd.fire(); comboAdd(2, 250, "루프"); fx.burst(star.root.position, "drift", 3); }
        else { toast("속도 부족 — 루프에서 미끄러졌어요 (최고 속도로 진입!)", "#FF8A3D", 1.8); Snd.driftFail(); comboBreak(); }
        break;
      case S.Collapse: toast("붕괴에 휘말렸어요! 속도 저하", "#FF4D6D", 1.4); Snd.hit(); CAM.shake = 0.3; starHit(); comboBreak(); break;
      case S.CollapseResult:
        $("#h-collapse").classList.remove("on"); $("#app").classList.remove("danger");
        if (e.correct) { toast("붕괴 탈출 성공! 탈수초가 퍼지기 전에 신호 전달", "#5CFF9D", 2); Snd.fire(); comboAdd(2, 300, "탈출"); Voice.say("탈출 성공! 수초가 무너지면 전도가 느려지니까, 신호가 붕괴보다 빨라야 해!", { mode: "idle" }); }
        else { toast("탈출했지만 " + e.tier + "번 휘말렸어요", "#FF8A3D", 2); }
        break;
      case S.ItemGet: Snd.coin(); Snd.tone("triangle", 600, 1500, 0.2, 0.2); toast(ITEMS[e.tag].icon + " " + ITEMS[e.tag].name + " 획득! — " + ITEMS[e.tag].get, "#E8D8FF", 2); world.itemTaken(e.src); updateItemUi(); break;
      case S.ItemUse: { const I = ITEMS[e.tag]; toast(I.icon + " " + I.use, I.col, 2.2); Snd.fire(); fx.burst(star.root.position, "fire"); if (e.tag === "dopa") { NRW.U.uFire.value = 0.6; } updateItemUi(); break; }
      case S.ShieldBlock: toast("🔵 GABA 보호막이 충돌을 막았어요!", "#5C9CFF", 1.4); Snd.chime(); break;
      case S.BossHit: {
        world.weakHit(e.src); race.bossHp = sim.bossHp; updateBoss(); world.bossHit(sim.bossHp, race.bossMax);
        Snd.fire(); fx.burst(star.root.position, "fire"); CAM.shake = 0.3; NRW.U.uFire.value = 1; comboAdd(3, 400 * e.tier, "약점");
        toast(e.tag === "core" ? (e.tier >= 3 ? "💥 NULL 코어 직격! (부스트 ×3)" : "코어 타격 (부스트 상태면 3배!)") : "NULL 약점 타격! 체력 " + sim.bossHp + "/" + race.bossMax, "#FFD34D", 1.8);
        if (sim.bossHp === 0) { Voice.say("해냈어! NULL의 체력이 0이야! 신경망이 다시 깨어나고 있어!", { mode: "replace" }); toast("NULL 소멸! 신경망 복구!", "#5CFF9D", 3); }
        break;
      }
      // ---------- 4.0 racing pieces & chapter missions ----------
      case S.Pad: if (e.tag === "boost") { Snd.boostStart(); toast("부스트 패드!", "#FFD34D", 0.7); } else { Snd.tone("square", 300, 1400, 0.3, 0.2); toast("점프대!", "#2EE6D6", 0.7); SV.squashVel += 6; } comboAdd(1, 50); fx.burst(star.root.position, "land"); break;
      case S.RingCombo: {
        const t = e.tier, msg = t === 10 ? "결절 10연속 — SUPER COMBO!!" : t === 5 ? "결절 5연속 — 강력 부스트!" : "결절 3연속 — 부스트!";
        toast(msg, t === 10 ? "#FF5CC8" : "#FFD34D", 1.5); Snd.fire(); fx.burst(star.root.position, t === 10 ? "fire" : "drift", t === 10 ? 3 : 2); NRW.U.uFire.value = t === 10 ? 1 : 0.5; comboAdd(t === 10 ? 5 : 2, t * 60, "도약전도");
        if (t === 10) Voice.say("슈퍼 콤보! 결절마다 활동전위가 다시 만들어져서 신호가 껑충껑충 뛰고 있어!", { mode: "idle" });
        break;
      }
      case S.SortResult: {
        const ok = e.correct, src = e.src; world.sortResult(src, e.lane);
        if (ok) { Snd.chime(); comboAdd(1, 200, src.tag === "cross" ? "교차" : "포털"); fx.burst(star.root.position, "correct"); } else { Snd.thud(); comboBreak(); starWrong(); }
        missionFlash(ok, (ok ? "✔ " : "✘ ") + src.why); break;
      }
      case S.ReflexStart: showReflex(e.tag, e.src.side); break;
      case S.ReflexResult: endReflex(e.tag, e.correct); break;
      case S.LineResult: {
        const pct = Math.round(parseFloat(e.tag) * 100);
        if (e.correct) { toast("균형 유지 " + pct + "% — 소뇌 보정 성공! 가속", "#5CFF9D", 2); Snd.fire(); comboAdd(2, 300, "균형"); Voice.say("잘했어! 소뇌는 이렇게 동작 오차를 계속 고쳐 줘.", { mode: "idle" }); }
        else { toast("균형 유지 " + pct + "% — 60% 이상이면 성공", "#FF8A3D", 2); comboBreak(); }
        break;
      }
      case S.Psp: {
        world.pspCollect(e.src); const ex = e.tag === "epsp"; if (e.correct && ((ex && sim.mission !== "inhibit") || (!ex && sim.mission === "inhibit"))) comboAdd(1, 30);
        if (!e.correct) { toast("불응기! 지금은 반응이 없어요", "#B4AEDB", 0.8); break; }
        Snd.tone("triangle", ex ? 660 : 520, ex ? 990 : 300, 0.12, 0.2);
        toast(ex ? "EPSP +7 mV" : "IPSP −7 mV", ex ? "#5CFF9D" : "#5C9CFF", 0.6); break;
      }
      case S.Fire:
        Snd.fire(); fx.burst(star.root.position, "fire"); comboAdd(2, 250, "발화"); CAM.shake = 0.2; SV.spinVel = 720; setExpr("Joy", 1.5); NRW.U.uFire.value = 1; pulseVm("fire");
        toast("⚡ 역치 도달! 활동전위 발화!", "#FFD34D", 1.6); Voice.say(pickOne(["발화! 활동전위다!", "역치 넘었다! 슝!", "좋아, 발화 성공!"]), { mode: "idle" }); break;
      case S.Seizure:
        Snd.hit(); CAM.shake = 0.3; starHit(); comboBreak(); setExpr("Hurt", 1.2); NRW.U.uSeize.value = 1; pulseVm("seize");
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
      case "story": if (r.mode === "story" && arg !== r.stage.introStory && C.story[arg]) storyQ.push(...C.story[arg]); break;
      case "hint":
        if (arg === "corner") hint("코너 진입! 안쪽으로 조향해 벽에 부딪히지 않게 하세요.", 4);
        else if (arg === "jump") hint("NULL 교란 구간! 큰 파동은 [점프], 작은 블록은 피하세요.", 4);
        else if (arg === "loop") hint("360° 루프! 최고 속도로 들어가야 벽을 타고 한 바퀴 돌 수 있어요. 부스트를 아껴 두세요.", 4);
        else if (arg === "warp") hint("시냅스 워프 포털! 전달 순서를 맞히면 다음 구간으로 워프 가속.", 4);
        else if (arg === "plastic") hint("신경가소성 갈림길! 같은 챕터를 정답률 80% 이상으로 3번 클리어하면 지름길이 열려요. (자주 쓰는 연결이 강해지는 '장기강화'의 비유)", 6);
        else if (arg === "core") hint("NULL 코어! 부스트나 미니 터보 상태로 노란 링을 통과하면 3배 대미지.", 4);
        else if (arg === "scurve") hint("S자 커브! 리듬 타고 좌우로 — 오브 라인을 따라가요.", 3);
        else if (arg === "jumppad") hint("점프대! 가운데로 올라타면 높이 날아 장애물을 넘어요.", 3);
        else if (arg === "movers") hint("움직이는 NULL 블록! 좌우로 오가니 빈틈을 노려요.", 3);
        else if (arg === "lasers") hint("레이저 장벽! 빨간 빛이 켜져 있을 땐 점프로 넘거나 꺼질 때 통과.", 4);
        else if (arg === "narrow") hint("좁은 통로! 벽에 부딪히면 콤보가 끊겨요.", 3);
        else if (arg === "dzone") hint("드리프트 충전 구간! 여기선 드리프트 충전이 1.8배 빨라요.", 4);
        else if (arg === "rings") hint("말이집 구간! 결절(링)을 3·5·10연속 통과하면 부스트 — 정중앙이면 PERFECT!", 4);
        else if (arg === "split") hint("갈래 길! 왼쪽은 안전, 오른쪽은 위험하지만 오브 3배.", 4);
        else if (arg === "drift") hint("급커브! [드리프트]를 누른 채 커브 방향으로 조향 → 놓으면 미니 터보!", 6);
        break;
      case "loop": if (arg === "check") toast("360° 루프! 벽을 타고 한 바퀴", "#9CFFEA", 1.2); break;
      case "collapse": if (arg === "on") { $("#h-collapse").classList.add("on"); hint("축삭 붕괴가 뒤에서 쫓아와요! 충돌하면 붙잡혀요 — 초록 복구 오브로 버티며 탈출!", 5); Voice.say("뒤에서 축삭이 무너지고 있어! 멈추지 말고 달려!", { mode: "queue" }); } break;
      case "boss":
        if (/^phase[123]$/.test(arg)) {
          const P = { phase1: ["PHASE 1", "신호 교란 — 레이저와 블록을 피하며 에너지 확보"], phase2: ["PHASE 2", "진단 → 약점 노출 → 노란 링으로 공격"], phase3: ["PHASE 3", "최종 패턴 — 마지막 진단 후 부스트로 코어 돌파"] }[arg];
          const el = $("#h-phase"); el.innerHTML = P[0] + "<small>" + P[1] + "</small>"; el.style.display = "block"; setTimeout(() => el.style.display = "none", 2600);
          CAM.bossLook = 1.6; Snd.tone("sawtooth", 120, 60, 0.8, 0.3); Voice.say({ phase1: "NULL이 신호를 흩뜨리고 있어! 피하면서 에너지를 모으자!", phase2: "증상을 보고 정확히 진단해야 약점이 열려!", phase3: "마지막이야! 진단하고, 부스트로 코어를 뚫자!" }[arg], { mode: "queue" });
        } else if (arg.startsWith("counter:")) { const id = arg.slice(8); if (!race.sim.gateOk[id]) { world.bossAttack(); toast("NULL 반격! 레이저 주의", "#FF4D6D", 1.4); } }
        break;
      case "tut": tutStart(arg); break;
      case "mini": openChapterMini(arg); break;
      case "mission":
        if (arg.startsWith("sort:")) { const t = { nuclei: "뇌줄기 신경핵 탐험! 지금 층에 있는 신경핵 차선으로!", relay: "시상 중계 미션! 감각 신호를 맞는 중계핵으로 보내!", cortex: "대뇌 기능 포털! 명령에 맞는 겉질 영역으로!", cranial: "12뇌신경 포털! 동작에 맞는 뇌신경으로!" }[arg.slice(5)]; hint(t, 4); Voice.say(t, { mode: "queue" }); }
        else if (arg.startsWith("cross:")) { const t = { dcml: "왼다리 진동 감각을 실어 나르자! 뒤기둥-안쪽섬유띠계는 어디서 교차할까?", stt: "왼손 통증 신호! 앞가쪽계는 언제 건너갈까?", cst: "왼손을 움직이는 명령! 겉질척수로는 어디서 교차할까?" }[arg.slice(6)]; hint(t + " 층마다 맞는 쪽 차선으로 드리프트!", 5); Voice.say(t, { mode: "queue" }); }
        else if (arg === "reflex") { hint("척수반사 긴급 미션! 자극이 보이면 바로 반응 — 신장=부스트, 굽힘=점프, 교차폄=반대쪽으로, 상호억제=아무것도 누르지 않기. (실제 반사는 수십 ms로 훨씬 빨라요)", 6); Voice.say("척수반사 미션이야! 자극이 나오면 바로 반응해!", { mode: "queue" }); }
        break;
      case "line": if (arg === "on") { hint("소뇌 균형 라인! NULL이 몸을 흔들어요(운동실조 흉내). 빛나는 선 위에 머물러 오차를 보정하세요.", 5); Voice.say("빛나는 선을 따라가! 흔들려도 소뇌처럼 바로바로 고쳐 줘!", { mode: "idle" }); } break;
      case "dzone": if (arg === "on") toast("드리프트 충전 ×1.8", "#FFB627", 1.2); break;
      case "integ":
        if (arg === "excite") hint("EPSP 가중 구간! 초록 ＋ 를 연달아 먹으면 막전위가 올라가 역치(-55 mV)에서 발화 → 가속! 파랑 − 는 피하기", 6);
        else if (arg === "inhibit") hint("IPSP 억제 구간! NULL이 막전위를 계속 올려요. 파랑 − 를 먹어서 역치 아래로 지키기! 초록 ＋ 는 피하기", 6);
        if (arg === "excite" || arg === "inhibit") Voice.say(arg === "excite" ? "EPSP 구간이야! 초록 플러스를 연달아 모으면 역치까지 올라가서 발화해!" : "NULL 때문에 뉴런이 과흥분 중이야! 파란 마이너스를 모아서 진정시켜 줘!", { mode: "queue" });
        break;
      case "banner": toast(arg === "soma" ? "세포체 - 입력 신호의 가중(통합)" : "축삭종말 접근 - 시냅스 소포 준비", "#2EE6D6", 2.2); break;
      case "codex": r.learn.codexSeen.add(arg); { const ce = codexById.get(arg); if (ce && !save.codexUnlocked.includes(arg)) toast("신경 도감 등록: " + ce.name, "#2EE6D6", 1.8); } break;
      case "forkq": { const fs = r.forkSegByQ.get(arg); ask(arg, "갈림길! 정답 경로로 들어가세요" + thinkTag, fs ? fs.fork.laneX : null, fs ? { seg: fs, s: fs.length } : null); break; }
      case "gateq": { const g = findGate(arg); ask(arg, (arg === "ch1_gate_glia" ? "수초 복구 게이트" : r.stage.gateTitle) + thinkTag, g ? g.e.laneX : null, g ? { seg: g.seg, s: g.e.s } : null); break; }
      case "boss": if (arg === "attack") { world.bossAttack(); toast("NULL 반격! 파동은 점프!", "#FF4D6D", 1.4); CAM.shake = 0.2; } break;
      case "synapse": if (arg === "warp") openMinigame("warp"); else if (arg === "minigame") openMinigame(); else if (arg === "cross") toast("신경전달물질 다리 통과!", "#FF5CC8", 1.5); break;
    }
  }
  function finish() {
    const r = race; r.phase = "finish"; r.finishT = 0; show("#touch", false); show("#qpanel", false); countdown("GOAL!"); Snd.chime();
    setBase("Victory"); setExpr("Victory", 99); SV.victory = true; CAM.showcase = 3.2; Voice.say(pickOne(["골인! 신호 전달 성공!", "도착! 우리가 해냈어!", "골인! 신경 신호 무사히 도착!"]));
  }

  //================== SYNAPSE MINIGAME (GameUI.Minigame.cs) ==================
  function openMinigame(kind) {
    const r = race; r.phase = "mini"; show("#touch", false); show("#qpanel", false); show("#apanel", false); setExpr("Surprise", 1.5); const warp = kind === "warp";
    $("#mission").classList.remove("on"); $("#reflex").classList.remove("on"); miResT = 0; miEvent = null; $("#h-hint").style.display = "none"; $("#h-story").style.display = "none";   // nothing on top of the minigame
    $("#mini h2").textContent = warp ? "시냅스 워프 포털" : "시냅스 게이트";
    const qo = qbank.get("ch1_syn_order"), qe = qbank.get("ch1_syn_epsp");
    const done = (success, mistakes, epsp) => { r.learn.answer(qo.id, mistakes === 0 ? qo.answer : 1, r.sim.raceTime); r.learn.answer(qe.id, epsp, r.sim.raceTime); closeMinigame(success); };
    const warpDone = ok => { show("#mini", false); r.sim.addTurbo(ok ? 3 : 0.8); r.sim.addEnergy(ok ? 0.4 : 0); CAM.kickPunch = 1.6; NRW.U.uFire.value = 1; show("#touch", !r.auto); steerSm = 0; for (const k in held) held[k] = 0;
      toast(ok ? "🌀 시냅스 워프! 전달 성공 — 초가속" : "워프 불안정 — 약한 가속", ok ? "#FF5CC8" : "#B4AEDB", 2); if (ok) { Snd.fire(); comboAdd(3, 400, "워프"); } r.phase = "run"; };
    if (r.auto) { if (warp) warpDone(true); else done(true, 0, qe.answer); return; }
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
        next++; if (next === 5) { if (warp) { $("#mg-fb").textContent = "전달 완료! " + (mistakes === 0 ? "완벽해요!" : "실수 " + mistakes + "회"); Snd.chime(); setTimeout(() => warpDone(mistakes <= 1), 700); } else phase2(); }
      } else { mistakes++; b.classList.remove("no"); void b.offsetWidth; b.classList.add("no"); Snd.thud(); $("#mg-fb").textContent = "순서가 달라요! 다음 단계를 다시 생각해 보세요. (실수 " + mistakes + ")"; }
    }));
    function phase2() {
      $("#mg-fb").textContent = "전달 순서 완성! " + (mistakes === 0 ? "완벽해요!" : "실수 " + mistakes + "회"); Snd.chime();
      setTimeout(() => {
        $("#mg-prompt").textContent = qe.question; Voice.say("좋아, 마지막 문제! " + qe.question);
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

  // 4.8 chapter minigames (own screens; the race pauses)
  const minis = createMinis({ Snd, say: t => Voice.say(t, { mode: "replace" }) });
  function openChapterMini(kind) {
    const r = race; r.phase = "mini"; show("#touch", false); show("#qpanel", false); show("#apanel", false);
    $("#mission").classList.remove("on"); $("#reflex").classList.remove("on"); miResT = 0; miEvent = null; $("#h-hint").style.display = "none"; $("#h-story").style.display = "none";
    const done = (pass, ok, n) => {
      r.sim.addTurbo(pass ? 2.8 : 0.8); if (pass) r.sim.addEnergy(0.4); CAM.kickPunch = pass ? 1.4 : 0;
      if (pass) { comboAdd(3, 300 + 100 * ok, "미니게임"); Snd.fire(); NRW.U.uFire.value = 1; toast("미션 성공! 터보 가속", "#5CFF9D", 1.8); } else toast("미션 종료 — 다시 달려요", "#B4AEDB", 1.4);
      r.minis = (r.minis || 0) + 1; r.minisOk = (r.minisOk || 0) + (pass ? 1 : 0);
      show("#touch", !r.auto); steerSm = 0; for (const k in held) held[k] = 0; r.phase = "run";
    };
    if (r.auto) { done(true, 1, 1); return; }
    $("#app").classList.add("in-mini");
    minis.open(kind, (...args) => { $("#app").classList.remove("in-mini"); done(...args); });
  }

  //================== RESULT ==================
  function showResult() {
    const r = race, sim = r.sim, L = r.learn, par = r.graph.parTime, t = sim.raceTime;
    if (r.stage.id === "tutorial") {   // practice only: nothing goes to records or wrong-answer notes
      save.tutDone = true; persist(); $("#tut").classList.remove("on"); show("#apanel", false); show("#qpanel", false);
      $("#r-title").textContent = "🎓 튜토리얼 완료!"; $("#r-grade").textContent = "조작을 모두 익혔어요. 이제 CH.1 뉴런 고속도로로 출발!";
      $("#r-stats").innerHTML = [["기록", fmt(t)], ["오브", sim.coins], ["점수", r.score]].map(([a, b]) => `<div>${a}<b>${b}</b></div>`).join("");
      $("#r-wrong").innerHTML = `<div class="entry"><b>정리</b><br>• 좌우: ${save.controlMode === "tap" ? "화면 왼쪽/오른쪽 절반 누르기" : "◀ ▶ 버튼"} (설정에서 바꿀 수 있어요)<br>• 점프: 빨간 파동 넘기 · 드리프트: 코너에서 누른 채 꺾고 떼면 터보 · 부스트: 에너지로 가속<br>• 문제: 정답 보기의 차선으로 들어가기</div>`;
      $("#result [data-act=next]").style.display = ""; $("#result [data-act=next]").textContent = "CH.1 시작 ▶"; r.tutNext = true;
      show("#hud", false); show("#result", true); Snd.play("menu"); Voice.say("연습 끝! 이제 진짜 신경계로 출발하자!");
      window.__nrResult = { stage: "tutorial", time: t, correct: L.correct, total: L.total }; return;
    }
    $("#result [data-act=next]").textContent = "다음 스테이지 ▶";
    const today = new Date().toISOString().slice(0, 10); for (const a of L.answers) { const q = qbank.get(a.questionId); if (q && q.perm) { a.chosen = q.perm[a.chosen]; a.mapped = true; } }
    L.mergeInto(save, today); save.plays++;
    const b = save.best[r.stage.id], isBest = !b || t < b.time; if (isBest) save.best[r.stage.id] = { time: t, acc: L.accuracy, score: r.score };
    if (!save.bestScore) save.bestScore = {}; if (!(save.bestScore[r.stage.id] >= r.score)) save.bestScore[r.stage.id] = r.score;
    persist();
    const acc = Math.round(L.accuracy * 100), grade = acc === 100 && t <= par ? "S" : acc >= 80 && t <= par * 1.1 ? "A" : acc >= 60 ? "B" : "C";
    $("#r-title").textContent = r.stage.boss ? (r.bossHp === 0 ? "NULL 격파! 신경망 복구" : "NULL 진단 완료") : "STAGE CLEAR!";
    $("#r-grade").textContent = `CH.${r.stage.chapter} ${r.stage.title} · 등급 ${grade}` + (isBest ? " · 최고 기록!" : "");
    const st = [["기록", fmt(t)], ["목표(PAR)", fmt(par)], ["정답률", acc + "% (" + L.correct + "/" + L.total + ")"], ["점수", r.score], ["최대 콤보", r.maxCombo], ["오브", sim.coins], ["벽 충돌", sim.wallHits]];
    if (L.total === 0) { const drop = new Set(["정답률", "목표(PAR)"]); for (let k = st.length - 1; k >= 0; k--) if (drop.has(st[k][0])) st.splice(k, 1); }
    if (r.minis) st.push(["미니게임", r.minisOk + "/" + r.minis]);
    st.push(sim.ringsTotal ? ["도약전도 결절", sim.ringsHit + "/" + sim.ringsTotal] : ["NULL 충돌", sim.obstacleHits]);
    $("#r-stats").innerHTML = st.map(([a, b]) => `<div>${a}<b>${b}</b></div>`).join("");
    const wrong = L.answers.filter(a => !a.correct).map(a => bank.get(a.questionId)).filter(Boolean);
    $("#r-wrong").innerHTML = L.total === 0 ? "" : wrong.length ? `<div class="grade">복습할 문제 ${wrong.length}개 (오답 노트에 저장됨)</div>` + wrong.map(q => `<div class="entry"><b>${esc(q.question)}</b><br><span class="ok">정답: ${esc(q.options[q.answer])}</span><br>${esc(q.explanation)}</div>`).join("") : `<div class="grade">모든 문제를 맞혔어요! 완벽한 신호 전달 ★</div>`;
    const idx = NR.STAGES.indexOf(r.stage); $("#result [data-act=next]").style.display = idx >= 0 && idx < NR.STAGES.length - 1 ? "" : "none";
    modeResult(r, t);
    // 4.6 mastery: plasticity strength, XP, evolution
    const prevForm = formLevel(); let xpGain = 0, plasticMsg = "";
    if (r.mode !== "survival" && L.accuracy >= 0.8) {
      xpGain++; if (L.accuracy === 1) xpGain++; if (r.mode === "rival" && r.position === 1) xpGain++;
      const pl = save.plastic || (save.plastic = {}), before = pl[r.stage.id] || 0; pl[r.stage.id] = Math.min(3, before + 1);
      plasticMsg = pl[r.stage.id] >= 3 ? (before < 3 ? "🧠 신경가소성 지름길 개방! 다음 주행부터 열려 있어요." : "") : `🧠 신경가소성 강화 ${pl[r.stage.id]}/3 — 3이 되면 이 챕터의 지름길이 열려요.`;
    }
    if (r.mode === "survival" && sim.raceTime >= 60) xpGain++;
    save.xp = (save.xp || 0) + xpGain; persist();
    const newForm = formLevel(), evoMsg = newForm > prevForm ? `⭐ 진화! STAR-01이 ${FORMS[newForm].name}(으)로 진화했어요!` : "";
    if (xpGain || plasticMsg || evoMsg) $("#r-wrong").insertAdjacentHTML("afterbegin", `<div class="entry">${xpGain ? `숙련 XP +${xpGain} (총 ${save.xp})` : ""}${plasticMsg ? "<br>" + plasticMsg : ""}${evoMsg ? "<br><b>" + evoMsg + "</b>" : ""}</div>`);
    if (evoMsg) { if (save.skin == null || save.skin === prevForm) { save.skin = newForm; persist(); } applySkin(); setTimeout(() => Voice.say("우와, 진화했어! 이제 나는 " + FORMS[newForm].name + "야!", { mode: "queue" }), 1500); }
    if (r.graph.bossMax) { $("#r-title").textContent = sim.bossHp === 0 ? "🏆 NULL 소멸! 신경망 복구 완료" : `NULL 도주… (남은 체력 ${sim.bossHp}/${r.bossMax})`; }
    show("#hud", false); show("#result", true); Snd.play("menu"); $("#mission").classList.remove("on"); $("#reflex").classList.remove("on");
    Voice.say(acc === 100 ? "완벽해! 문제를 전부 맞혔어!" : "완주 성공! 틀린 문제는 오답 노트에서 같이 다시 보자.");
    window.__nrResult = { stage: r.stage.id, mode: r.mode, position: r.position, time: t, correct: L.correct, total: L.total, coins: sim.coins, score: r.score, maxCombo: r.maxCombo };
  }

  function modeResult(r, t) {
    const sim = r.sim, extra = [];
    if (r.mode === "rival") {
      const rows = [{ name: "STAR-01", t, me: true }].concat(r.rivals.map(v => ({ name: v.d.name, t: v.sim.finished ? v.time : sim.raceTime + Math.max(0, r.graph.referenceLength - v.sim.progress) / Math.max(20, v.sim.speed) })));
      rows.sort((a, b) => a.t - b.t); const pos = rows.findIndex(x => x.me) + 1;
      if (!save.rivalBest) save.rivalBest = {}; if (!(save.rivalBest[r.stage.id] <= pos)) save.rivalBest[r.stage.id] = pos; persist();
      $("#r-title").textContent = pos === 1 ? "🏆 1위! 라이벌 격파" : pos + "위로 골인";
      $("#r-wrong").insertAdjacentHTML("afterbegin", `<div class="entry"><b>최종 순위</b><br>${rows.map((x, i) => `${i + 1}. ${x.me ? "<b>STAR-01 (나)</b>" : x.name} — ${fmt(x.t)}`).join("<br>")}</div>`);
      window.__nrResult && (window.__nrResult.position = pos);
    } else if (r.mode === "time") {
      const ta = save.ta || (save.ta = {}), old = ta[r.stage.id], isBest = !old || t < old.time;
      if (isBest) { ta[r.stage.id] = { time: t, splits: r.splits.slice(), ghost: r.ghostRec.slice(0, 40000) }; try { persist(); } catch (e) { } }
      $("#r-title").textContent = isBest ? "⏱ 새 최고 기록!" : "⏱ 타임어택 완주";
      $("#r-wrong").insertAdjacentHTML("afterbegin", `<div class="entry"><b>기록 ${fmt(t)}</b>${old ? ` (이전 최고 ${fmt(old.time)}, ${t - old.time <= 0 ? "−" : "+"}${Math.abs(t - old.time).toFixed(1)}초)` : ""}<br>구간: ${r.splits.map((x, i) => `${i + 1}구간 ${fmt(x)}`).join(" · ")}${isBest ? "<br>다음 도전부터 이 기록이 고스트로 함께 달려요." : ""}</div>`);
    } else if (r.mode === "survival") {
      const sv = save.survival, isBest = !sv || sim.raceTime > sv.time; if (isBest) { save.survival = { time: sim.raceTime, score: r.score }; persist(); }
      $("#r-title").textContent = r.survivalDead ? "∞ 서바이벌 종료" : "∞ 서바이벌 완주!";
      $("#r-grade").textContent = `생존 ${fmt(sim.raceTime)} · 진행 ${Math.round(NR.clamp01(sim.progress / r.graph.referenceLength) * 100)}%` + (isBest ? " · 최고 기록!" : "");
    }
  }

  //================== MENUS ==================
  const MODES = [["story", "📖 스토리", "대화·해설과 함께 배우며 달리기"], ["rival", "🏁 라이벌 레이스", "GLUTA·GABA·AXON과 실제로 경주해 1등을 노려요 (대화 없음, 해설 짧게)"], ["time", "⏱ 타임어택", "구간 기록과 내 최고 기록 고스트에 도전 (슬로모션·긴 해설 없음)"]];
  function renderStages() {
    const mode = save.mode || "story";
    $("#mode-tabs").innerHTML = MODES.map(([m, l]) => `<button data-mode="${m}" class="${mode === m ? "on" : ""}">${l}</button>`).join("");
    $("#mode-desc").textContent = MODES.find(x => x[0] === mode)[2];
    $$("#mode-tabs [data-mode]").forEach(b => b.addEventListener("click", () => { save.mode = b.dataset.mode; persist(); renderStages(); }));
    const ta = save.ta || {}, rb = save.rivalBest || {}, sv = save.survival;
    $("#stage-grid").innerHTML = NR.STAGES.map(s => {
      const b = save.best[s.id];
      const best = mode === "time" ? (ta[s.id] ? "타임어택 " + fmt(ta[s.id].time) + (ta[s.id].ghost ? " · 고스트 있음" : "") : "기록 없음")
        : mode === "rival" ? (rb[s.id] ? "최고 순위 " + rb[s.id] + "위" : "도전 전")
        : (b ? "최고 " + fmt(b.time) + " · 정답률 " + Math.round(b.acc * 100) + "%" : "도전 전");
      return `<button class="stage${s.boss ? " boss" : ""}" data-stage="${s.id}"><span class="ch">CHAPTER ${s.chapter}${s.boss ? " · BOSS" : ""}</span><span class="tt">${esc(s.title)}</span><span class="st">${esc(s.subtitle)}</span><span class="goals">${s.goals.map(esc).join(" · ")}</span><span class="best">${best}</span></button>`;
    }).join("") + `<button class="stage survival" data-stage="survival"><span class="ch">EXTRA · 서바이벌</span><span class="tt">끝없는 신경 질주</span><span class="st">점점 빨라지는 코스 · 생명력이 0이 되면 끝</span><span class="goals">생명력은 시간이 갈수록 줄고 충돌하면 −18 · 오브로 +4 회복 (부스트 에너지와 별개)</span><span class="best">${sv ? "최고 생존 " + fmt(sv.time) + " · " + sv.score + "점" : "도전 전"}</span></button>`;
    $$("#stage-grid .stage").forEach(b => b.addEventListener("click", () => startStage(b.dataset.stage, b.dataset.stage === "survival" ? "survival" : (save.mode || "story"))));
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
      ["배경 음악 음량", "", "musicVol", [[0, "끔"], [0.35, "작게"], [0.7, "보통"], [1, "크게"]]],
      ["효과음 음량", "", "sfxVol", [[0, "끔"], [0.4, "작게"], [0.8, "보통"], [1, "크게"]]],
      ["좌우 조작", "", "controlMode", [["buttons", "◀ ▶ 버튼"], ["tap", "화면 반 터치"]]],
      ["문제 생각 시간", "문제가 뜨면 레이스가 조금 느려져요 (기록 손해 없음)", "thinkSlow", [[0.5, "느리게"], [0.75, "조금"], [1, "끄기"]]],
      ["도움말 힌트", "", "showHints", [[true, "켜기"], [false, "끄기"]]],
      ["그래픽 품질", "버벅이면 '가볍게'", "quality", [["low", "가볍게"], ["auto", "자동"], ["high", "선명"]]],
      ["프레임 제한", "끊기면 30 FPS로 고정 (조작은 그대로 빠르게)", "fpsCap", [[0, "제한 없음"], [30, "30 FPS 안정"]]],
      ["성능 표시", "FPS·프레임 시간·드로우콜 표시", "showPerf", [[false, "끄기"], [true, "켜기"]]],
    ];
    el.innerHTML = (compact ? "" : voiceRow()) + rows.map(([t, d, k, opts]) => `<div class="set"><div>${t}${d ? `<small>${d}</small>` : ""}</div><div class="opts">${opts.map(([v, l]) => `<button data-k="${k}" data-v='${JSON.stringify(v)}' class="${save[k] === v ? "on" : ""}">${l}</button>`).join("")}</div></div>`).join("") + (compact ? "" : `<div class="set"><div>기록 초기화<small>최고 기록·도감·오답 노트를 지워요</small></div><div class="opts"><button data-reset="1">초기화</button></div></div>`);
    el.querySelectorAll("[data-k]").forEach(b => b.addEventListener("click", () => {
      const k = b.dataset.k, v = JSON.parse(b.dataset.v); save[k] = v; persist();
      if (k === "controlMode") applyControlMode(); if (k === "musicVol") Snd.setMusic(); if (k === "sfxVol") { Snd.setSfx(); Snd.coin(); }
      if (k === "quality") { autoLevel = TOUCH ? "mid" : "high"; renderer.setPixelRatio(dprCap()); setupPost(); resize(); if (!race) { if (world) world.dispose(scene); world = null; menuScene(); } }
      if ((k === "voiceOn" && v) || k === "voicePitch" || k === "voiceRate") Voice.say("안녕! 나는 스타 제로원이야. 이렇게 읽어 줄게!"); if (k === "voiceOn" && !v) Voice.stop();
      renderSettings(el, compact);
    }));
    const vs = el.querySelector("#voice-sel"); if (vs) vs.addEventListener("change", () => { save.voiceURI = vs.value; save.voiceChosen = true; persist(); Voice.pick(); Voice.say("안녕! 이 목소리 어때?"); });
    const vp = el.querySelector("#voice-try"); if (vp) vp.addEventListener("click", () => Voice.say("안녕! 나는 스타 제로원! 같이 신경계를 달려 보자!"));
    const rs = el.querySelector("[data-reset]"); if (rs) rs.addEventListener("click", () => { if (confirm("기록을 모두 지울까요?")) { save.best = {}; save.wrongNotes = []; save.codexUnlocked = []; persist(); renderSettings(el, compact); } });
  }
  function voiceRow() {
    Voice.pick(); const L = Voice.list;
    if (!L.length && Voice.ok) setTimeout(() => { Voice.pick(); if (Voice.list.length && document.querySelector("#voice-sel")) renderSettings(document.querySelector("#voice-sel").closest(".settings"), false); }, 800);
    const opts = L.length ? L.map(v => `<option value="${esc(v.voiceURI)}"${Voice.voice && v.voiceURI === Voice.voice.voiceURI ? " selected" : ""}>${esc(v.name)}</option>`).join("") : `<option>한국어 음성을 찾지 못했어요</option>`;
    return `<div class="set voice-set"><div>STAR-01 목소리<small>지금: <b>${esc(Voice.voice ? Voice.voice.name : "기기 기본 음성")}</b>${Voice.voice && /premium|프리미엄|enhanced|향상/i.test(Voice.voice.name) ? " ✓" : ""}<br>iPad에서 더 자연스러운 목소리: 설정 › 손쉬운 사용 › 읽기 및 말하기 › 음성 › 한국어 › '지안·유나(프리미엄)' 같은 프리미엄 음성을 내려받으면 자동으로 골라져요. 목록에 없으면 Safari에서 열어 보세요.</small></div><div class="opts"><select id="voice-sel">${opts}</select><button id="voice-try">▶ 들어보기</button></div></div>`;
  }
  function hideRacers() { if (rivalMeshes) rivalMeshes.forEach(m => m.root.visible = false); if (ghostMesh) ghostMesh.root.visible = false; }
  function goTitle() { hideRacers(); race = null; Voice.stop(); show("#hud", false); show("#touch", false); show("#result", false); show("#pause", false); show("#qpanel", false); show("#apanel", false); show("#mini", false); show("#dialog", false); screen("title"); menuScene(); Snd.play("menu"); }
  document.addEventListener("click", ev => {
    const b = ev.target.closest("[data-act]"); if (!b) return; const a = b.dataset.act;
    if (a === "play") { if (!save.tutDone) { screen("controls"); } else startStage(save.lastStage || "ch1"); }
    else if (a === "tutorial") screen("controls");
    else if (a === "ctl-buttons" || a === "ctl-tap") { save.controlMode = a === "ctl-tap" ? "tap" : "buttons"; persist(); applyControlMode(); startStage("tutorial", "story"); }
    else if (a === "stages") { hideRacers(); show("#result", false); show("#pause", false); race = null; Voice.stop(); show("#hud", false); show("#touch", false); show("#qpanel", false); show("#apanel", false); renderStages(); screen("stages"); menuScene(); Snd.play("menu"); }
    else if (a === "evo") { renderEvo(); screen("evo"); }
    else if (a === "story") { screen("story"); save.loreSeen = true; persist(); }
    else if (a === "codex" || a === "notes") { codexMode = a; renderCodex(); screen("codex"); }
    else if (a === "settings") { renderSettings($("#settings-list")); screen("settings"); }
    else if (a === "title") goTitle();
    else if (a === "resume") resumeRace();
    else if (a === "retry") { const id = race ? race.stage.id : save.lastStage, m = race ? race.mode : undefined; show("#pause", false); startStage(id, m); }
    else if (a === "quit") { hideRacers(); show("#pause", false); race = null; renderStages(); screen("stages"); show("#hud", false); show("#touch", false); show("#qpanel", false); show("#apanel", false); Voice.stop(); menuScene(); Snd.play("menu"); }
    else if (a === "next" && race && race.tutNext) startStage("ch1", "story");
    else if (a === "next") { const i = NR.STAGES.findIndex(s => s.id === (race ? race.stage.id : save.lastStage)); startStage(NR.STAGES[Math.min(NR.STAGES.length - 1, i + 1)].id, race ? race.mode : undefined); }
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
    for (const k in star.faces) star.faces[k].visible = k === ex; trail.forEach(m => m.visible = false); fx.hide(); Snd.setLoops(false, 0, false);
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
    if (race) tickRace(dt); else tickMenu(dt);        // input + simulation every display frame
    // 4.0: optional 30 FPS render cap (steadier on weak devices); simulation/input are not capped
    renderAcc += dt; if (save.fpsCap === 30 && renderAcc < 1 / 30 - 0.004) return;
    const rdt = renderAcc; renderAcc = 0;
    NRW.U.uStar.value.copy(star.root.position);
    if (world) world.update(rdt, tAll, race ? race.sim : null);
    const t0 = performance.now();
    if (composer) composer.render(); else renderer.render(scene, camera);
    perfSample(rdt, performance.now() - t0);
  }
  // performance overlay (설정 › 성능 표시): fps, frame time, draw calls, triangles, GPU objects, JS heap
  let renderAcc = 0; const PF = { n: 0, acc: 0, max: 0, rms: 0, t: 0 };
  function perfSample(dt, renderMs) {
    if (!save.showPerf) { if (PF.on) { $("#perf").style.display = "none"; PF.on = false; } return; }
    PF.on = true; PF.n++; PF.acc += dt; PF.max = Math.max(PF.max, dt); PF.rms += renderMs; PF.t += dt;
    if (PF.t < 0.5) return;
    const i = renderer.info, mem = performance.memory, el = $("#perf"); el.style.display = "block";
    el.textContent = `${Math.round(PF.n / PF.acc)} fps · 평균 ${(PF.acc / PF.n * 1000).toFixed(1)} ms · 최대 ${(PF.max * 1000).toFixed(0)} ms · 렌더 ${(PF.rms / PF.n).toFixed(1)} ms\n드로우콜 ${i.render.calls} · 삼각형 ${(i.render.triangles / 1000).toFixed(0)}k · 지오메트리 ${i.memory.geometries} · 텍스처 ${i.memory.textures} · 셰이더 ${i.programs ? i.programs.length : "-"}${mem ? " · JS " + (mem.usedJSHeapSize / 1048576).toFixed(0) + " MB" : ""} · 화질 ${qEff()} · DPR ${renderer.getPixelRatio().toFixed(2)}`;
    PF.n = PF.acc = PF.max = PF.rms = PF.t = 0;
  }

  // boot
  window.NR_APP = { cmini: k => openChapterMini(k), snd: Snd, startStage, get race() { return race; }, save, cam: CAM, mini: () => openMinigame() };
  function boot() {
    if (boot.done) return; boot.done = true;
    setupPost(); applySkin(); renderStages(); menuScene(); screen(save.loreSeen || AUTO ? "title" : "story"); if (!save.loreSeen) { save.loreSeen = true; persist(); }
    $("#loading").classList.add("off");
    Snd.want = "menu";
    requestAnimationFrame(frame);
    const m = HASH.match(/stage=(ch\d|survival|tutorial)/), mm = HASH.match(/mode=(\w+)/); if (AUTO || m) setTimeout(() => startStage(m ? m[1] : "ch1", mm ? mm[1] : undefined), 300);
  }
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(boot); setTimeout(boot, 2500);
};
