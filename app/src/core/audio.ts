// Procedural sound design with the Web Audio API — no audio files needed.
// Ambient drone + generative music bus + one-shot SFX. iOS requires unlock() on a user gesture.
import { Save } from './save';

type Bus = 'sfx' | 'music';
/** 0.1 s of silence (8 kHz, 8-bit mono) for the iOS playback-session trick */
const SILENT_WAV = 'data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YSADAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==';
export type MusicMode = 'none' | 'ambient' | 'lab2' | 'tension' | 'title' | 'chase';

class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  music!: GainNode;
  sfx!: GainNode;
  private noiseBuf!: AudioBuffer;
  private droneNodes: AudioNode[] = [];
  private alarmTimer: number | null = null;
  private musicTimer: number | null = null;
  private musicMode: MusicMode = 'none';
  /** how many times each sound / music mode has been triggered (QA instrumentation, read by tests) */
  played: Record<string, number> = {};
  private heartbeatTimer: number | null = null;

  private silentEl: HTMLAudioElement | null = null;

  /**
   * iOS Safari routes Web Audio through the "ambient" audio session, which the ring/silent switch (or Control Centre
   * silent mode) mutes. Ask for the "playback" session so game audio plays like a video would:
   * - iOS 17+ / Safari 16.4+: navigator.audioSession.type = 'playback'
   * - older iOS: a looping, silent <audio> element started in the same gesture switches the session to playback.
   */
  private requestPlaybackSession() {
    try { const as = (navigator as any).audioSession; if (as && as.type !== 'playback') as.type = 'playback'; } catch { /* not supported */ }
    if (!this.silentEl) {
      const el = document.createElement('audio');
      el.setAttribute('playsinline', ''); el.setAttribute('x-webkit-airplay', 'deny'); el.loop = true; el.preload = 'auto';
      el.src = SILENT_WAV;
      this.silentEl = el;
    }
    if (this.silentEl.paused) this.silentEl.play().catch(() => { /* needs a gesture; retried on the next one */ });
  }

  unlock() {
    this.requestPlaybackSession();
    if (!this.ctx) {
      const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      if (!AC) return;
      this.ctx = new AC();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      comp.connect(this.ctx.destination);
      this.master = this.ctx.createGain(); this.master.connect(comp);
      this.music = this.ctx.createGain(); this.music.connect(this.master);
      this.sfx = this.ctx.createGain(); this.sfx.connect(this.master);
      const len = this.ctx.sampleRate * 2;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.applyVolumes();
    }
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => { /* retried on the next gesture */ });
    // classic iOS unlock: start a 1-sample silent buffer inside the gesture
    if (!this.primed) {
      try { const b = this.ctx.createBuffer(1, 1, 22050); const src = this.ctx.createBufferSource(); src.buffer = b; src.connect(this.ctx.destination); src.start(0); this.primed = true; } catch { /* ignore */ }
    }
  }
  private primed = false;

  applyVolumes() {
    if (!this.ctx) return;
    const s = Save.settings;
    this.master.gain.value = s.muted ? 0 : s.master;
    this.music.gain.value = s.music * 0.55;
    this.sfx.gain.value = s.sfxOn ? s.sfx : 0;
  }

  private get t() { return this.ctx!.currentTime; }
  private bus(b: Bus) { return b === 'music' ? this.music : this.sfx; }

  private osc(type: OscillatorType, f: number, start: number, dur: number, vol: number, bus: Bus = 'sfx', fEnd?: number, attack = 0.005) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, start);
    if (fEnd) o.frequency.exponentialRampToValueAtTime(Math.max(1, fEnd), start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g); g.connect(this.bus(bus));
    o.start(start); o.stop(start + dur + 0.05);
  }

  private noise(start: number, dur: number, vol: number, filt: BiquadFilterType, f: number, q = 1, bus: Bus = 'sfx', fEnd?: number) {
    if (!this.ctx) return;
    const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const bq = this.ctx.createBiquadFilter(); bq.type = filt; bq.frequency.setValueAtTime(f, start); bq.Q.value = q;
    if (fEnd) bq.frequency.exponentialRampToValueAtTime(fEnd, start + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(bq); bq.connect(g); g.connect(this.bus(bus));
    src.start(start, Math.random()); src.stop(start + dur + 0.05);
  }

  // ---------- SFX ----------
  play(name: string) {
    this.played[name] = (this.played[name] ?? 0) + 1;
    if (!this.ctx) return;
    const t = this.t;
    switch (name) {
      case 'click': this.osc('triangle', 1400, t, 0.06, 0.12, 'sfx', 900); break;
      case 'hover': this.osc('sine', 2200, t, 0.04, 0.04); break;
      case 'open': this.osc('sine', 520, t, 0.18, 0.12, 'sfx', 1040); this.osc('sine', 780, t + 0.06, 0.2, 0.08, 'sfx', 1560); break;
      case 'close': this.osc('sine', 900, t, 0.15, 0.1, 'sfx', 420); break;
      case 'pickup':
        [660, 880, 1320].forEach((f, i) => this.osc('sine', f, t + i * 0.06, 0.35, 0.14));
        this.noise(t, 0.3, 0.05, 'highpass', 6000); break;
      case 'scan':
        this.osc('sawtooth', 180, t, 0.9, 0.05, 'sfx', 1600, 0.05);
        this.osc('sine', 1200, t + 0.1, 0.8, 0.05, 'sfx', 300);
        this.noise(t, 0.9, 0.04, 'bandpass', 800, 4, 'sfx', 5000); break;
      case 'reveal': [988, 1318, 1976].forEach((f, i) => this.osc('triangle', f, t + i * 0.05, 0.4, 0.08)); break;
      case 'snap': this.osc('square', 220, t, 0.08, 0.1, 'sfx', 110); this.osc('sine', 1760, t, 0.18, 0.1); this.noise(t, 0.06, 0.15, 'highpass', 3000); break;
      case 'error':
        this.osc('square', 140, t, 0.16, 0.12); this.osc('square', 147, t, 0.16, 0.1);
        this.osc('square', 110, t + 0.18, 0.22, 0.12); this.osc('square', 116, t + 0.18, 0.22, 0.1); break;
      case 'success':
        [523, 659, 784, 1047].forEach((f, i) => { this.osc('triangle', f, t + i * 0.09, 0.6, 0.12); this.osc('sine', f * 2, t + i * 0.09, 0.4, 0.04); });
        break;
      case 'unlock':
        this.noise(t, 0.5, 0.2, 'lowpass', 2000, 1, 'sfx', 200);
        this.osc('sine', 60, t, 0.6, 0.35, 'sfx', 40);
        [392, 523, 659].forEach((f, i) => this.osc('triangle', f, t + 0.25 + i * 0.12, 0.7, 0.1)); break;
      case 'door':
        this.noise(t, 1.2, 0.18, 'bandpass', 600, 0.7, 'sfx', 180);
        this.osc('sawtooth', 70, t, 1.1, 0.08, 'sfx', 45, 0.1);
        this.noise(t + 1.0, 0.25, 0.25, 'lowpass', 900); break;
      case 'zap':
        for (let i = 0; i < 5; i++) this.noise(t + i * 0.04 + Math.random() * 0.02, 0.05, 0.25, 'highpass', 2500 + Math.random() * 3000);
        this.osc('sawtooth', 90, t, 0.25, 0.15, 'sfx', 60); break;
      case 'hurt': this.osc('square', 320, t, 0.25, 0.12, 'sfx', 80); this.noise(t, 0.2, 0.12, 'bandpass', 1500, 2); break;
      case 'steam': this.noise(t, 1.3, 0.12, 'highpass', 1800, 0.5, 'sfx', 3500); break;
      case 'powerdown':
        this.osc('sawtooth', 220, t, 1.6, 0.18, 'sfx', 30, 0.01);
        this.noise(t, 1.2, 0.2, 'lowpass', 3000, 1, 'sfx', 80);
        this.osc('sine', 50, t + 0.1, 1.5, 0.3, 'sfx', 25); break;
      case 'powerup':
        this.osc('sawtooth', 40, t, 1.6, 0.12, 'sfx', 240, 0.2);
        this.osc('sine', 80, t, 1.8, 0.15, 'sfx', 480, 0.3);
        [523, 784, 1047].forEach((f, i) => this.osc('triangle', f, t + 1.3 + i * 0.08, 0.5, 0.08)); break;
      case 'step': this.noise(t, 0.05, 0.03, 'bandpass', 1800 + Math.random() * 400, 3); break;
      case 'type': this.osc('square', 1800 + Math.random() * 600, t, 0.025, 0.025); break;
      case 'glitch':
        for (let i = 0; i < 6; i++) this.osc('square', 200 + Math.random() * 2000, t + i * 0.03, 0.03, 0.06);
        break;
      case 'rotate': this.osc('triangle', 600, t, 0.12, 0.08, 'sfx', 900); this.noise(t, 0.1, 0.05, 'bandpass', 2400, 3); break;
      case 'victory':
        [392, 523, 659, 784, 1047, 1319].forEach((f, i) => { this.osc('triangle', f, t + i * 0.11, 0.9, 0.11); this.osc('sine', f / 2, t + i * 0.11, 0.9, 0.06); });
        this.noise(t + 0.6, 2.0, 0.05, 'highpass', 7000); break;
      case 'beep': this.osc('sine', 1046, t, 0.12, 0.08); break;
      // stealth / survival (v0.5)
      case 'alert': this.osc('square', 660, t, 0.12, 0.09, 'sfx', 990); this.osc('square', 990, t + 0.12, 0.22, 0.09, 'sfx', 1320); this.noise(t, 0.15, 0.06, 'bandpass', 2500, 4); break;
      case 'laser': this.osc('sawtooth', 1800, t, 0.18, 0.025, 'sfx', 900); break;
      case 'heal': [523, 659, 784, 1046].forEach((f, i) => this.osc('sine', f, t + i * 0.07, 0.3, 0.07)); break;
      case 'shield': this.osc('triangle', 300, t, 0.4, 0.09, 'sfx', 900); this.noise(t, 0.35, 0.05, 'bandpass', 1200, 6, 'sfx', 4000); break;
      case 'shieldbreak': this.noise(t, 0.35, 0.14, 'highpass', 2000, 1, 'sfx', 7000); this.osc('triangle', 900, t, 0.3, 0.08, 'sfx', 200); break;
      case 'card': this.osc('sine', 1318, t, 0.08, 0.07); this.osc('sine', 1760, t + 0.08, 0.14, 0.07); break;
      case 'checkpoint': [392, 523, 659].forEach((f, i) => this.osc('triangle', f, t + i * 0.09, 0.35, 0.06)); break;
      case 'respawn': this.osc('sine', 200, t, 0.8, 0.1, 'sfx', 800); this.noise(t, 0.6, 0.05, 'bandpass', 600, 2, 'sfx', 3000); break;
      case 'shutter': this.noise(t, 0.6, 0.18, 'lowpass', 900, 1, 'sfx', 200); this.osc('square', 90, t + 0.5, 0.2, 0.12, 'sfx', 50); break;
      case 'ai': this.osc('sine', 740, t, 0.12, 0.07); this.osc('sine', 988, t + 0.1, 0.18, 0.07); break;
      case 'hold': this.osc('sine', 300, t, 0.1, 0.05, 'sfx', 340); break;
    }
  }

  // ---------- Ambient + music ----------
  startAmbient() {
    if (!this.ctx || this.droneNodes.length) return;
    const t = this.t;
    const mk = (f: number, type: OscillatorType, vol: number) => {
      const o = this.ctx!.createOscillator(); o.type = type; o.frequency.value = f;
      const g = this.ctx!.createGain(); g.gain.value = 0; g.gain.linearRampToValueAtTime(vol, t + 3);
      const lp = this.ctx!.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
      const lfo = this.ctx!.createOscillator(); lfo.frequency.value = 0.05 + Math.random() * 0.08;
      const lg = this.ctx!.createGain(); lg.gain.value = 140; lfo.connect(lg); lg.connect(lp.frequency);
      o.connect(lp); lp.connect(g); g.connect(this.music); o.start(); lfo.start();
      this.droneNodes.push(o, lfo, g);
    };
    mk(41.2, 'sawtooth', 0.12); mk(61.7, 'sawtooth', 0.06); mk(82.4, 'triangle', 0.05); mk(41.6, 'sawtooth', 0.08);
    // air handling hiss
    const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 0.6;
    const g = this.ctx.createGain(); g.gain.value = 0; g.gain.linearRampToValueAtTime(0.035, t + 3);
    src.connect(bp); bp.connect(g); g.connect(this.music); src.start();
    this.droneNodes.push(src, g);
  }
  stopAmbient() {
    for (const n of this.droneNodes) { try { (n as any).stop?.(); } catch { /* */ } try { n.disconnect(); } catch { /* */ } }
    this.droneNodes = [];
  }

  setMusic(mode: MusicMode) {
    this.played['music:' + mode] = (this.played['music:' + mode] ?? 0) + 1;
    if (!this.ctx || mode === this.musicMode) return;
    this.musicMode = mode;
    if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
    if (mode === 'none') return;
    if (mode === 'lab2') { this.lab2Music(); return; }
    if (mode === 'chase') { this.chaseMusic(); return; }
    // Minor-key generative arpeggio / pulse.
    const scale = [0, 3, 5, 7, 10, 12, 15];
    const root = mode === 'tension' ? 55 : 49;
    let step = 0;
    const bpm = mode === 'tension' ? 128 : mode === 'title' ? 84 : 70;
    const iv = 60 / bpm / 2;
    this.musicTimer = window.setInterval(() => {
      if (!this.ctx) return;
      const t = this.t + 0.05;
      if (mode === 'tension') {
        this.osc('sawtooth', root, t, 0.18, 0.06, 'music', root * 0.98);
        if (step % 2 === 0) this.noise(t, 0.04, 0.05, 'highpass', 8000, 1, 'music');
        if (step % 8 === 0) this.osc('sine', 55, t, 0.4, 0.25, 'music', 35);
        if (step % 4 === 2) this.osc('triangle', root * 4 * Math.pow(2, scale[(step / 2) % 5] / 12), t, 0.25, 0.03, 'music');
      } else {
        if (step % 2 === 0 && Math.random() < 0.75) {
          const n = scale[Math.floor(Math.random() * scale.length)];
          const f = root * 4 * Math.pow(2, n / 12);
          this.osc('sine', f, t, 1.8, 0.03, 'music', undefined, 0.04);
          this.osc('triangle', f * 2.005, t, 1.2, 0.012, 'music', undefined, 0.04);
        }
        if (step % 16 === 0) this.osc('sine', root, t, 3.5, 0.08, 'music', undefined, 0.8);
        if (mode === 'title' && step % 8 === 4) this.noise(t, 0.6, 0.02, 'bandpass', 3000, 8, 'music');
      }
      step++;
    }, iv * 1000);
  }

  /** Pursuit / alarm: 150 BPM, driving octave bass, off-beat stabs and a rising siren sweep every 4 bars. */
  private chaseMusic() {
    const root = 46.25;   // F#1
    const iv = 60 / 150 / 2;
    let step = 0;
    this.musicTimer = window.setInterval(() => {
      if (!this.ctx) return;
      const t = this.t + 0.05;
      const bar = Math.floor(step / 8) % 4, pat = [0, 0, 3, 5][bar];
      const f = root * Math.pow(2, pat / 12) * (step % 2 ? 2 : 1);
      this.osc('sawtooth', f, t, 0.13, 0.07, 'music', f * 0.97);
      if (step % 4 === 0) { this.osc('sine', 60, t, 0.18, 0.28, 'music', 38); }
      if (step % 4 === 2) this.noise(t, 0.08, 0.07, 'bandpass', 2200, 1.5, 'music');
      if (step % 2 === 1) this.noise(t, 0.03, 0.035, 'highpass', 9000, 1, 'music');
      if (step % 8 === 3 || step % 8 === 6) this.osc('square', root * 8 * Math.pow(2, (pat + 7) / 12), t, 0.09, 0.025, 'music');
      if (step % 32 === 0) this.osc('triangle', 600, t, 1.6, 0.03, 'music', 1400, 0.4);
      step++;
    }, iv * 1000);
  }

  /** CH2 (근육 연결실): Dorian, slower pulse, low "muscle twitch" thump + breathy pad — distinct from CH1's minor arpeggio. */
  private lab2Music() {
    const scale = [0, 2, 3, 7, 9, 12, 14];
    const root = 58.27;   // Bb1
    const iv = 60 / 76 / 2;
    let step = 0;
    this.musicTimer = window.setInterval(() => {
      if (!this.ctx) return;
      const t = this.t + 0.05;
      if (step % 4 === 0) { this.osc('sine', root, t, 0.22, 0.16, 'music', root * 0.7); this.osc('sine', root * 1.5, t + 0.12, 0.18, 0.08, 'music', root); }
      if (step % 3 === 1 && Math.random() < 0.8) {
        const n = scale[(step * 5 + Math.floor(Math.random() * 3)) % scale.length];
        this.osc('triangle', root * 8 * Math.pow(2, n / 12), t, 0.35, 0.022, 'music', undefined, 0.01);
      }
      if (step % 16 === 8) this.noise(t, 2.4, 0.018, 'bandpass', 900, 3, 'music', 400);
      if (step % 32 === 0) this.osc('sawtooth', root * 2, t, 4.0, 0.02, 'music', root * 2.02, 1.2);
      step++;
    }, iv * 1000);
  }

  /** iOS Safari can suspend/interrupt the context (lock screen, call, tab switch): resume on the next gesture. */
  resumeIfNeeded() { if (this.ctx && this.ctx.state !== 'running') this.ctx.resume().catch(() => { /* needs a gesture */ }); }

  alarm(on: boolean) {
    if (this.alarmTimer) { clearInterval(this.alarmTimer); this.alarmTimer = null; }
    if (!on || !this.ctx) return;
    const blip = () => { const t = this.t; this.osc('square', 880, t, 0.35, 0.05, 'sfx', 660, 0.02); this.osc('square', 660, t + 0.4, 0.35, 0.05, 'sfx', 880, 0.02); };
    blip();
    this.alarmTimer = window.setInterval(blip, 1600);
  }

  heartbeat(on: boolean, rate = 1) {
    if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
    if (!on || !this.ctx) return;
    this.heartbeatTimer = window.setInterval(() => {
      const t = this.t; this.osc('sine', 60, t, 0.15, 0.3, 'sfx', 40); this.osc('sine', 55, t + 0.18, 0.15, 0.22, 'sfx', 38);
    }, 900 / rate);
  }
}

export const Audio = new AudioEngine();
