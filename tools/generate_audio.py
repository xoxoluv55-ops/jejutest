#!/usr/bin/env python3
"""
MUSCLE BATTLE - offline audio generator.

Renders every placeholder-quality-but-shippable audio asset used by the
vertical slice into MuscleBattle/Assets/MuscleBattle/Resources/Audio:

  Announcer/  espeak-ng voice -> pitched down, compressed, reverb (arcade style)
  SFX/        layered synthesized impacts (several variations each, so the
              same sample is never repeated back to back)
  BGM/        original electronic/rock loops (menu, select, vs, battle,
              battle intensity layer, victory sting, result)

Everything is original and generated from code - no third party music/SFX.
Requirements: python3 + numpy, espeak-ng, sox, oggenc (vorbis-tools).

    python3 tools/generate_audio.py
    python3 tools/generate_audio.py --select-ui   # character select assets only
    python3 tools/generate_audio.py --muscle-link # Muscle Link announcer lines only
"""
import os
import subprocess
import tempfile
import wave

import numpy as np

SR = 44100
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..",
                    "MuscleBattle", "Assets", "MuscleBattle", "Resources", "Audio")
RNG = np.random.default_rng(7)


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------
def t_axis(dur):
    return np.arange(int(SR * dur)) / SR


def env_exp(dur, decay):
    return np.exp(-t_axis(dur) * decay)


def env_adsr(n, a=0.005, d=0.05, s=0.6, r=0.1):
    e = np.ones(n) * s
    na, nd, nr = int(a * SR), int(d * SR), int(r * SR)
    na = max(1, min(na, n))
    e[:na] = np.linspace(0, 1, na)
    nd = max(1, min(nd, n - na))
    e[na:na + nd] = np.linspace(1, s, nd)
    nr = max(1, min(nr, n))
    e[-nr:] *= np.linspace(1, 0, nr)
    return e


def noise(n):
    return RNG.uniform(-1, 1, n)


def lowpass(x, cutoff):
    # one pole low pass, cutoff may be an array (sweeps)
    cutoff = np.broadcast_to(np.asarray(cutoff, dtype=float), x.shape)
    a = 1.0 - np.exp(-2.0 * np.pi * cutoff / SR)
    y = np.zeros_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc += a[i] * (x[i] - acc)
        y[i] = acc
    return y


def lowpass_fast(x, cutoff):
    a = 1.0 - np.exp(-2.0 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc += a * (v - acc)
        y[i] = acc
    return y


def highpass(x, cutoff):
    return x - lowpass_fast(x, cutoff)


def sine_sweep(dur, f0, f1, curve=8.0):
    t = t_axis(dur)
    f = f1 + (f0 - f1) * np.exp(-t * curve)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph)


def saw(freq, n, detune=0.0):
    t = np.arange(n) / SR
    out = np.zeros(n)
    for d in (-detune, 0.0, detune) if detune else (0.0,):
        ph = (t * freq * (1 + d)) % 1.0
        out += 2 * ph - 1
    return out / (3 if detune else 1)


def square(freq, n, duty=0.5):
    t = np.arange(n) / SR
    return np.where((t * freq) % 1.0 < duty, 1.0, -1.0)


def soft_clip(x, drive=1.5):
    return np.tanh(x * drive) / np.tanh(drive)


def normalize(x, peak=0.89):
    m = np.max(np.abs(x)) or 1.0
    return x / m * peak


def stereo(x, width=0.0):
    if x.ndim == 2:
        return x
    if width <= 0:
        return np.stack([x, x], axis=1)
    d = int(SR * 0.011 * width)
    r = np.concatenate([np.zeros(d), x[:-d]]) if d > 0 else x
    return np.stack([x, r * 0.9 + x * 0.1], axis=1)


def write_wav(path, x):
    x = np.clip(x, -1, 1)
    if x.ndim == 1:
        x = stereo(x)
    data = (x * 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())


def write_ogg(name, x, sub, quality=5):
    os.makedirs(os.path.join(ROOT, sub), exist_ok=True)
    with tempfile.TemporaryDirectory() as td:
        wav = os.path.join(td, "a.wav")
        write_wav(wav, x)
        out = os.path.join(ROOT, sub, name + ".ogg")
        subprocess.run(["oggenc", "-Q", "-q", str(quality), "-o", out, wav], check=True)
    print("  ", sub + "/" + name + ".ogg", f"{len(x) / SR:.2f}s")


def simple_reverb(x, mix=0.25, decay=0.45):
    out = np.copy(x)
    for delay_ms, g in ((29, 0.6), (41, 0.5), (53, 0.42), (71, 0.33), (97, 0.25)):
        d = int(SR * delay_ms / 1000)
        tmp = np.zeros_like(x)
        tmp[d:] = x[:-d] * g * decay * 2
        out += tmp * mix
    return out


# --------------------------------------------------------------------------
# SFX
# --------------------------------------------------------------------------
def sfx_punch(v):
    dur = 0.32
    n = int(SR * dur)
    body = sine_sweep(dur, 190 + v * 25, 55, 22) * env_exp(dur, 14)
    snap = highpass(noise(n), 1800) * env_exp(dur, 70) * 0.8
    slap = lowpass_fast(noise(n), 3200) * env_exp(dur, 35) * 0.6
    x = body * 1.1 + snap + slap
    return normalize(soft_clip(x, 2.2), 0.9)


def sfx_kick(v):
    dur = 0.45
    n = int(SR * dur)
    body = sine_sweep(dur, 140 + v * 15, 38, 12) * env_exp(dur, 8)
    thud = lowpass_fast(noise(n), 900) * env_exp(dur, 18)
    crack = highpass(noise(n), 2500) * env_exp(dur, 55) * 0.7
    return normalize(soft_clip(body * 1.3 + thud + crack, 2.5), 0.92)


def sfx_heavy(v):
    dur = 0.75
    n = int(SR * dur)
    sub = sine_sweep(dur, 110 + v * 10, 32, 6) * env_exp(dur, 5)
    body = sine_sweep(dur, 260, 70, 18) * env_exp(dur, 11) * 0.6
    crunch = lowpass_fast(noise(n), 1600) * env_exp(dur, 9) * 0.8
    sizzle = highpass(noise(n), 4000) * env_exp(dur, 25) * 0.5
    x = simple_reverb(sub * 1.4 + body + crunch + sizzle, 0.2)
    return normalize(soft_clip(x, 3.0), 0.95)


def sfx_block(v):
    dur = 0.3
    n = int(SR * dur)
    t = t_axis(dur)
    ring = (np.sin(2 * np.pi * (880 + v * 60) * t) + 0.6 * np.sin(2 * np.pi * (1320 + v * 90) * t)) * env_exp(dur, 16)
    zap = sine_sweep(dur, 2400, 600, 30) * env_exp(dur, 30) * 0.5
    thump = sine_sweep(dur, 160, 60, 20) * env_exp(dur, 22) * 0.7
    fizz = highpass(noise(n), 5000) * env_exp(dur, 40) * 0.4
    return normalize(ring * 0.5 + zap + thump + fizz, 0.8)


def sfx_counter(v):
    dur = 0.9
    n = int(SR * dur)
    t = t_axis(dur)
    transient = highpass(noise(n), 3000) * env_exp(dur, 90)
    bell = sum(np.sin(2 * np.pi * f * t) * a for f, a in ((1568, 0.6), (2349, 0.4), (3136, 0.25))) * env_exp(dur, 5)
    boom = sine_sweep(dur, 220, 40, 9) * env_exp(dur, 6)
    x = simple_reverb(transient + bell * 0.6 + boom * 1.2, 0.35)
    return normalize(soft_clip(x, 1.8), 0.95)


def sfx_whoosh(v):
    dur = 0.28 + v * 0.04
    n = int(SR * dur)
    t = t_axis(dur)
    e = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 2
    cut = 600 + 4500 * np.sin(np.pi * t / dur)
    x = lowpass(noise(n), cut) * e
    return normalize(x, 0.6)


def sfx_land(v):
    dur = 0.4
    n = int(SR * dur)
    body = sine_sweep(dur, 120, 40, 14) * env_exp(dur, 12)
    dust = lowpass_fast(noise(n), 1200) * env_exp(dur, 14)
    return normalize(soft_clip(body + dust * 0.8, 2.0), 0.85)


def sfx_ko(v):
    dur = 2.4
    n = int(SR * dur)
    sub = sine_sweep(dur, 90, 28, 2.5) * env_exp(dur, 1.6)
    hit = lowpass_fast(noise(n), 2400) * env_exp(dur, 6)
    shimmer = highpass(noise(n), 6000) * env_exp(dur, 3) * 0.25
    t = t_axis(dur)
    chord = sum(np.sin(2 * np.pi * f * t) for f in (110, 164.8, 220, 277.2)) * env_exp(dur, 1.4) * 0.15
    x = simple_reverb(sub * 1.5 + hit + shimmer + chord, 0.4)
    return normalize(soft_clip(x, 2.5), 0.97)


def sfx_grab(v):
    dur = 0.35
    n = int(SR * dur)
    cloth = lowpass_fast(noise(n), 2200) * env_exp(dur, 20)
    thump = sine_sweep(dur, 150, 70, 15) * env_exp(dur, 16)
    return normalize(cloth + thump, 0.8)


def sfx_launch(v):
    dur = 0.6
    n = int(SR * dur)
    t = t_axis(dur)
    f = 150 + 900 * (t / dur) ** 1.5
    rise = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / dur)
    x = np.zeros(n)
    imp = sfx_punch(v)
    x[:len(imp)] += imp
    wh = sfx_whoosh(2)
    x[:len(wh)] += wh * 0.6
    x += rise * 0.35
    return normalize(x, 0.9)


def sfx_special(v):
    dur = 1.3
    n = int(SR * dur)
    t = t_axis(dur)
    f = 200 + 1400 * (t / dur) ** 2
    sweep = np.sin(2 * np.pi * np.cumsum(f) / SR) * (t / dur)
    sh = highpass(noise(n), 3000) * (t / dur) ** 2 * 0.4
    zap = square(55, n, 0.3) * env_exp(dur, 3) * 0.1
    boom = np.zeros(n)
    bi = int(SR * 1.0)
    b = sfx_heavy(0)
    boom[bi:] = b[: n - bi]
    x = simple_reverb(sweep * 0.5 + sh + zap + boom, 0.3)
    return normalize(soft_clip(x, 1.5), 0.95)


def sfx_meter_full(v):
    dur = 0.7
    t = t_axis(dur)
    x = np.zeros(len(t))
    for i, f in enumerate((523.25, 659.25, 783.99, 1046.5)):
        s = int(SR * 0.06 * i)
        seg = t[: len(t) - s]
        x[s:] += np.sin(2 * np.pi * f * seg) * np.exp(-seg * 6) * 0.5
    x += highpass(noise(len(t)), 5000) * env_exp(dur, 8) * 0.15
    return normalize(simple_reverb(x, 0.3), 0.75)


def ui_tone(freqs, dur, decay, gain=0.6, noise_amt=0.0, sweep=None):
    t = t_axis(dur)
    x = np.zeros(len(t))
    for f in freqs:
        if sweep:
            fr = f * (1 + sweep * t / dur)
            x += np.sin(2 * np.pi * np.cumsum(fr) / SR)
        else:
            x += np.sin(2 * np.pi * f * t)
    x = x / len(freqs) * np.exp(-t * decay)
    if noise_amt:
        x += highpass(noise(len(t)), 4000) * np.exp(-t * decay * 3) * noise_amt
    return normalize(x, gain)


def sfx_knockdown(v):
    # body hitting the floor: heavy low thud + cloth slap + small bounce
    dur = 0.7
    n = int(SR * dur)
    thud = sine_sweep(dur, 95, 35, 10) * env_exp(dur, 7)
    slap = lowpass_fast(noise(n), 1800) * env_exp(dur, 22)
    x = thud * 1.4 + slap * 0.8
    b = int(SR * 0.16)
    bounce = sine_sweep(dur, 80, 40, 14)[: n - b] * env_exp(dur, 16)[: n - b] * 0.5
    x[b:] += bounce
    return normalize(soft_clip(x, 2.2), 0.92)


def sfx_link_charge(v):
    # muscle-skill start: rising fibre-energy shimmer
    dur = 0.9
    n = int(SR * dur)
    t = t_axis(dur)
    f = 180 + 900 * (t / dur) ** 1.6
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.5 * np.sin(2 * np.pi * np.cumsum(f * 1.5) / SR)
    shimmer = highpass(noise(n), 5000) * (t / dur) ** 2 * 0.5
    x = (tone * 0.4 + shimmer) * np.sin(np.pi * np.clip(t / dur, 0, 1) * 0.5)
    return normalize(simple_reverb(x, 0.3), 0.7)


def sfx_link_success(v):
    # MUSCLE LINK: bright major chord stab + sub boom + sparkle
    dur = 1.1
    t = t_axis(dur)
    chord = sum(np.sin(2 * np.pi * f * t) for f in (523.25, 659.25, 783.99, 1046.5)) * np.exp(-t * 4) * 0.25
    boom = sine_sweep(dur, 120, 45, 8) * env_exp(dur, 6)
    sparkle = highpass(noise(len(t)), 6000) * np.exp(-t * 7) * 0.3
    return normalize(simple_reverb(chord + boom + sparkle, 0.35), 0.9)


def sfx_link_fail(v):
    dur = 0.6
    t = t_axis(dur)
    x = (np.sin(2 * np.pi * 110 * t) + np.sin(2 * np.pi * 103.8 * t)) * np.exp(-t * 6) * 0.5
    x += lowpass_fast(noise(len(t)), 600) * np.exp(-t * 10) * 0.4
    return normalize(x, 0.7)


def sfx_combo_rank(v):
    # GOOD / GREAT / AMAZING sting, rising with the rank
    base = (659.25, 783.99, 987.77)[v]
    dur = 0.5
    t = t_axis(dur)
    x = np.zeros(len(t))
    for i, k in enumerate((1, 1.25, 1.5, 2.0)[: 2 + v]):
        s = int(SR * 0.05 * i)
        seg = t[: len(t) - s]
        x[s:] += np.sin(2 * np.pi * base * k * seg) * np.exp(-seg * 8)
    return normalize(simple_reverb(x, 0.25), 0.6)


def build_sfx():
    print("SFX")
    for name, fn, count in (("punch", sfx_punch, 4), ("kick", sfx_kick, 3), ("heavy", sfx_heavy, 3),
                            ("block", sfx_block, 3), ("counter", sfx_counter, 1), ("whoosh", sfx_whoosh, 4),
                            ("land", sfx_land, 2), ("ko_boom", sfx_ko, 1), ("grab", sfx_grab, 2),
                            ("launch", sfx_launch, 2), ("special", sfx_special, 1),
                            ("meter_full", sfx_meter_full, 1)):
        for v in range(count):
            write_ogg(f"{name}_{v}", stereo(fn(v), 0.6), "SFX", 4)

    for name, fn, count in (("knockdown", sfx_knockdown, 2), ("link_charge", sfx_link_charge, 1),
                            ("link_success", sfx_link_success, 1), ("link_fail", sfx_link_fail, 1),
                            ("combo_rank", sfx_combo_rank, 3)):
        for v in range(count):
            write_ogg(f"{name}_{v}", stereo(fn(v), 0.6), "SFX", 4)
    write_ogg("ui_hover", ui_tone([2400], 0.06, 60, 0.35), "SFX", 4)
    write_ogg("ui_confirm", ui_tone([880, 1320], 0.22, 18, 0.6, 0.2, sweep=0.3), "SFX", 4)
    write_ogg("ui_back", ui_tone([440, 330], 0.22, 16, 0.5, sweep=-0.4), "SFX", 4)
    lock = sfx_heavy(1)[: int(SR * 0.5)] * 0.7
    lock[: int(SR * 0.4)] += ui_tone([1046.5, 1568], 0.4, 7, 0.4)
    write_ogg("ui_lock", stereo(normalize(lock, 0.9), 0.6), "SFX", 4)
    write_ogg("ui_skill", ui_tone([660, 990, 1320], 0.3, 10, 0.55, 0.3, sweep=0.6), "SFX", 4)
    write_ogg("ui_correct", ui_tone([1046.5, 1318.5, 1568], 0.45, 7, 0.6), "SFX", 4)
    write_ogg("ui_wrong", ui_tone([196, 185], 0.3, 9, 0.45), "SFX", 4)
    write_ogg("ui_tick", ui_tone([1800], 0.04, 90, 0.3), "SFX", 4)
    tr = sfx_whoosh(3)
    tr2 = np.zeros(int(SR * 0.6))
    tr2[: len(tr)] += tr
    tr2 += np.pad(sfx_block(2), (0, len(tr2) - len(sfx_block(2)))) * 0.4
    write_ogg("ui_transition", stereo(normalize(tr2, 0.7), 0.8), "SFX", 4)


# --------------------------------------------------------------------------
# BGM (original compositions)
# --------------------------------------------------------------------------
def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def drum_kick(n):
    d = n / SR
    return sine_sweep(d, 150, 45, 25) * env_exp(d, 9) * 1.0


def drum_snare(n):
    d = n / SR
    tone = sine_sweep(d, 260, 180, 30) * env_exp(d, 22) * 0.5
    nz = highpass(noise(n), 1500) * env_exp(d, 16) * 0.7
    return tone + nz


def drum_hat(n, open_=False):
    d = n / SR
    return highpass(noise(n), 7000) * env_exp(d, 10 if open_ else 45) * 0.35


class Track:
    def __init__(self, bpm, bars, beats_per_bar=4):
        self.bpm = bpm
        self.spb = 60.0 / bpm
        self.len = int(SR * self.spb * beats_per_bar * bars)
        self.buf = np.zeros(self.len)

    def at(self, beat):
        return int(beat * self.spb * SR)

    def add(self, beat, sig, gain=1.0):
        s = self.at(beat)
        if s >= self.len:
            return
        e = min(self.len, s + len(sig))
        self.buf[s:e] += sig[: e - s] * gain
        # wrap tail for seamless loop
        rest = len(sig) - (e - s)
        if rest > 0:
            self.buf[:rest] += sig[e - s:e - s + rest] * gain


_cache = {}


def cached(key, fn):
    if key not in _cache:
        _cache[key] = fn()
    return _cache[key]


def synth_bass(note, beats, spb, cutoff=900, drive=2.0):
    n = int(SR * spb * beats)
    f = midi(note)
    x = saw(f, n, 0.004) * 0.7 + square(f / 2, n, 0.5) * 0.3
    e = env_adsr(n, 0.003, 0.08, 0.7, 0.03)
    return soft_clip(lowpass_fast(x, cutoff) * e, drive)


def synth_lead(note, beats, spb, cutoff=3500):
    n = int(SR * spb * beats)
    f = midi(note)
    x = saw(f, n, 0.007) + 0.4 * square(f * 2, n, 0.25)
    e = env_adsr(n, 0.004, 0.12, 0.5, 0.05)
    return lowpass_fast(x, cutoff) * e


def synth_pad(notes, beats, spb):
    n = int(SR * spb * beats)
    x = np.zeros(n)
    for nt in notes:
        x += saw(midi(nt), n, 0.01)
    x = lowpass_fast(x / len(notes), 1400)
    return x * env_adsr(n, 0.25, 0.3, 0.8, 0.3)


def guitar_chug(note, beats, spb):
    n = int(SR * spb * beats)
    f = midi(note)
    x = saw(f, n, 0.003) + saw(f * 1.5, n, 0.003) * 0.7  # power chord
    x = soft_clip(lowpass_fast(x, 2200) * 3.0, 3.5)
    return x * env_adsr(n, 0.002, 0.05, 0.6, 0.02) * 0.5


# chord progression shared by battle tracks: Am - F - C - G (original voicing / riffs)
PROG = [(57, [57, 60, 64]), (53, [53, 57, 60]), (48, [48, 52, 55]), (55, [55, 59, 62])]


def drums_pattern(tr, bars, style):
    for bar in range(bars):
        b0 = bar * 4
        nk = cached(("k",), lambda: drum_kick(int(SR * 0.35)))
        ns = cached(("s",), lambda: drum_snare(int(SR * 0.3)))
        nh = cached(("h",), lambda: drum_hat(int(SR * 0.08)))
        no = cached(("o",), lambda: drum_hat(int(SR * 0.3), True))
        if style == "four":
            for q in range(4):
                tr.add(b0 + q, nk, 0.95)
                tr.add(b0 + q + 0.5, no if q % 2 else nh, 0.6)
            tr.add(b0 + 1, ns, 0.7)
            tr.add(b0 + 3, ns, 0.7)
        elif style == "rock":
            for k in (0, 0.75, 2, 2.5):
                tr.add(b0 + k, nk, 1.0)
            tr.add(b0 + 1, ns, 0.9)
            tr.add(b0 + 3, ns, 0.9)
            if bar % 4 == 3:
                for s in (3.25, 3.5, 3.75):
                    tr.add(b0 + s, ns, 0.6)
            for e in range(8):
                tr.add(b0 + e * 0.5, nh, 0.55)
        elif style == "half":
            tr.add(b0, nk, 0.9)
            tr.add(b0 + 2, ns, 0.6)
            for e in range(8):
                tr.add(b0 + e * 0.5, nh, 0.35)


def master(x, drive=1.3):
    x = highpass(x, 25)
    return normalize(soft_clip(normalize(x, 1.0), drive), 0.88)


def bgm_battle():
    bpm, bars = 150, 16
    tr = Track(bpm, bars)
    drums_pattern(tr, bars, "rock")
    lead_riff = [69, 72, 76, 74, 72, 69, 67, 69]  # original A-minor riff
    for bar in range(bars):
        root, chord = PROG[bar % 4]
        for e in range(8):
            tr.add(bar * 4 + e * 0.5, synth_bass(root - 12 + (7 if e == 6 else 0), 0.5, tr.spb, 800), 0.55)
            tr.add(bar * 4 + e * 0.5, guitar_chug(root - 12, 0.45, tr.spb), 0.3 if e % 2 == 0 else 0.22)
        tr.add(bar * 4, synth_pad(chord, 4, tr.spb), 0.18)
        if bar >= 8:
            for i, nt in enumerate(lead_riff):
                shift = {0: 0, 1: -4, 2: -9, 3: -2}[bar % 4]
                tr.add(bar * 4 + i * 0.5, synth_lead(nt + shift, 0.45, tr.spb), 0.16)
    return master(tr.buf, 1.4), tr


def bgm_battle_layer():
    # extra intensity layer for FINAL ROUND, same tempo/length as battle track
    bpm, bars = 150, 16
    tr = Track(bpm, bars)
    arp = [0, 7, 12, 15, 12, 7, 3, 7]
    nh = drum_hat(int(SR * 0.06))
    for bar in range(bars):
        root, chord = PROG[bar % 4]
        for s in range(16):
            tr.add(bar * 4 + s * 0.25, synth_lead(root + 12 + arp[s % 8], 0.22, tr.spb, 5000), 0.13)
            tr.add(bar * 4 + s * 0.25, nh, 0.25)
    return master(tr.buf, 1.2)


def bgm_tension_layer():
    bpm, bars = 150, 16
    tr = Track(bpm, bars)
    beat = sine_sweep(0.25, 70, 40, 18) * env_exp(0.25, 14)
    for bar in range(bars):
        for b in (0, 0.45, 2, 2.45):  # lub-dub heartbeat
            tr.add(bar * 4 + b, beat, 1.0 if b in (0, 2) else 0.7)
        root, _ = PROG[bar % 4]
        tr.add(bar * 4, synth_pad([root - 24, root - 12], 4, tr.spb), 0.35)
    return master(tr.buf, 1.3)


def bgm_menu():
    bpm, bars = 118, 16
    tr = Track(bpm, bars)
    drums_pattern(tr, bars, "four")
    for bar in range(bars):
        root, chord = PROG[(bar // 2) % 4]
        tr.add(bar * 4, synth_pad([c + 12 for c in chord], 4, tr.spb), 0.22)
        for e in range(8):
            tr.add(bar * 4 + e * 0.5, synth_bass(root - 12 + (12 if e % 2 else 0), 0.45, tr.spb, 600, 1.4), 0.45)
        if bar % 2 == 1:
            for i, nt in enumerate([76, 74, 72, 74]):
                tr.add(bar * 4 + i, synth_lead(nt, 0.9, tr.spb, 2500), 0.1)
    return master(tr.buf, 1.2)


def bgm_select():
    bpm, bars = 132, 16
    tr = Track(bpm, bars)
    drums_pattern(tr, bars, "four")
    arp = [0, 4, 7, 12, 7, 4, 0, 7]
    for bar in range(bars):
        root, chord = PROG[bar % 4]
        tr.add(bar * 4, synth_pad(chord, 4, tr.spb), 0.18)
        for e in range(8):
            tr.add(bar * 4 + e * 0.5, synth_bass(root - 12, 0.45, tr.spb, 900, 1.8), 0.5)
        for s in range(16):
            tr.add(bar * 4 + s * 0.25, synth_lead(chord[0] + 12 + arp[s % 8], 0.2, tr.spb, 4200), 0.1)
    return master(tr.buf, 1.3)


def bgm_select_lock_layer():
    # CHARACTER SELECT: added when one fighter is locked in (same tempo/length as the select loop)
    bpm, bars = 132, 16
    tr = Track(bpm, bars)
    clap = cached(("clap",), lambda: drum_snare(int(SR * 0.22)) * 0.8)
    for bar in range(bars):
        root, chord = PROG[bar % 4]
        for q in range(4):
            tr.add(bar * 4 + q + 0.5, synth_bass(root, 0.4, tr.spb, 1400, 2.4), 0.35)  # offbeat octave pulse
        tr.add(bar * 4 + 1, clap, 0.55)
        tr.add(bar * 4 + 3, clap, 0.55)
        for i, nt in enumerate([chord[2] + 12, chord[1] + 12, chord[0] + 12, chord[1] + 12]):
            tr.add(bar * 4 + i + 0.75, synth_lead(nt, 0.2, tr.spb, 5200), 0.12)
    return master(tr.buf, 1.2)


def bgm_select_tension_layer():
    # CHARACTER SELECT: both fighters locked - snare build + riser every 4 bars, driving 16th hats
    bpm, bars = 132, 16
    tr = Track(bpm, bars)
    ns = cached(("s",), lambda: drum_snare(int(SR * 0.3)))
    nh = cached(("h",), lambda: drum_hat(int(SR * 0.08)))
    seg = int(SR * tr.spb * 16)
    t = np.arange(seg) / SR
    f = 110 * 2 ** (t / t[-1] * 1.5)
    riser = np.sin(2 * np.pi * np.cumsum(f) / SR) * (t / t[-1]) ** 2 * 0.35
    riser += highpass(noise(seg), 3500) * (t / t[-1]) ** 3 * 0.25
    for block in range(bars // 4):
        b0 = block * 16
        for i in range(16):
            tr.add(b0 + 8 + i * 0.5, ns, 0.25 + i / 40)
        tr.add(b0, riser, 1.0)
        for s16 in range(64):
            tr.add(b0 + s16 * 0.25, nh, 0.3 if s16 % 2 else 0.18)
    return master(tr.buf, 1.3)


def theme_sting(fighter):
    # short per-character "theme" played when the cursor lands on a fighter
    spb = 60.0 / 132
    if fighter == "jin":
        # bright, quick, rising (nerve / cyan energy)
        tr = Track(132, 1)
        for i, nt in enumerate([69, 73, 76, 81, 85]):
            tr.add(i * 0.25, synth_lead(nt, 0.35, spb, 6000), 0.35)
        tr.add(1.0, synth_pad([69, 76, 81], 2.2, spb), 0.25)
        x = tr.buf
        x = np.concatenate([x, np.zeros(int(SR * 0.6))])
        x[: len(x)] += np.pad(ui_tone([1760, 2637], 0.5, 6, 0.15), (0, max(0, len(x) - int(SR * 0.5))))[: len(x)]
    else:
        # heavy, low power chord + sub boom (strength)
        n = int(SR * 1.3)
        x = np.zeros(n)
        chord = guitar_chug(40, 2.2, spb)[:n]
        x[: len(chord)] += chord * 1.4
        boom = sine_sweep(1.0, 90, 38, 10) * env_exp(1.0, 4)
        x[: len(boom)] += boom * 0.9
        x[: int(SR * 0.35)] += drum_kick(int(SR * 0.35)) * 0.8
    fade = int(SR * 0.25)
    x[-fade:] *= np.linspace(1, 0, fade)
    return normalize(simple_reverb(x, 0.25), 0.8)


def bgm_vs():
    # 4 bar rising tension, plays once (~7s)
    bpm, bars = 140, 4
    tr = Track(bpm, bars)
    nk = drum_kick(int(SR * 0.35))
    ns = drum_snare(int(SR * 0.25))
    for i in range(16):
        tr.add(i, nk, 0.9)
    for i in range(32):
        if i >= 16:
            tr.add(i * 0.5, ns, 0.3 + i / 64)
    for i in range(32, 64):
        tr.add(i * 0.25, ns, 0.25 + (i - 32) / 50)
    t = t_axis(tr.len / SR)
    f = 55 * 2 ** (t / (tr.len / SR) * 2)
    riser = saw(1, tr.len) * 0 + np.sin(2 * np.pi * np.cumsum(f) / SR) * (t / t[-1]) * 0.4
    sh = highpass(noise(tr.len), 4000) * (t / t[-1]) ** 3 * 0.3
    tr.buf += riser + sh
    tr.buf[: len(synth_pad([45, 48, 52], 16, tr.spb))] += synth_pad([45, 48, 52], 16, tr.spb)[: tr.len] * 0.3
    return master(tr.buf, 1.5)


def bgm_victory():
    bpm = 140
    tr = Track(bpm, 3)
    nk = drum_kick(int(SR * 0.35))
    ns = drum_snare(int(SR * 0.3))
    melody = [(0, 69, 0.5), (0.5, 72, 0.5), (1, 76, 0.5), (1.5, 81, 1.5), (3, 79, 0.5), (3.5, 81, 4)]
    for b, nt, d in melody:
        tr.add(b, synth_lead(nt, d, tr.spb, 4500), 0.3)
        tr.add(b, synth_lead(nt - 12, d, tr.spb, 2000), 0.2)
    for b in (0, 1, 1.5, 3, 3.5):
        tr.add(b, nk, 1.0)
        tr.add(b, ns, 0.7)
    tr.add(3.5, synth_pad([57, 61, 64, 69], 7, tr.spb), 0.4)
    tr.add(3.5, synth_bass(45, 7, tr.spb, 500), 0.5)
    x = tr.buf
    fade = int(SR * 1.5)
    x[-fade:] *= np.linspace(1, 0, fade)
    return master(simple_reverb(x, 0.3), 1.2)


def bgm_result():
    bpm, bars = 108, 8
    tr = Track(bpm, bars)
    drums_pattern(tr, bars, "half")
    prog = [(48, [60, 64, 67, 71]), (45, [57, 60, 64, 67]), (53, [57, 60, 65, 69]), (55, [59, 62, 65, 67])]
    for bar in range(bars):
        root, chord = prog[bar % 4]
        tr.add(bar * 4, synth_pad(chord, 4, tr.spb), 0.3)
        for q in range(4):
            tr.add(bar * 4 + q, synth_bass(root - 12, 0.9, tr.spb, 500, 1.2), 0.45)
        for i, nt in enumerate(chord):
            tr.add(bar * 4 + i * 0.75 + 1, synth_lead(nt + 12, 0.5, tr.spb, 3000), 0.07)
    return master(tr.buf, 1.1)


def build_bgm():
    print("BGM")
    battle, _ = bgm_battle()
    write_ogg("battle", stereo(battle, 0.5), "BGM", 4)
    write_ogg("battle_final_layer", stereo(bgm_battle_layer(), 1.0), "BGM", 4)
    write_ogg("battle_tension_layer", stereo(bgm_tension_layer(), 0.3), "BGM", 4)
    write_ogg("menu", stereo(bgm_menu(), 0.5), "BGM", 4)
    write_ogg("select", stereo(bgm_select(), 0.6), "BGM", 4)
    write_ogg("vs", stereo(bgm_vs(), 0.5), "BGM", 4)
    write_ogg("victory", stereo(bgm_victory(), 0.7), "BGM", 4)
    write_ogg("result", stereo(bgm_result(), 0.6), "BGM", 4)


# --------------------------------------------------------------------------
# Announcer
# --------------------------------------------------------------------------
ANNOUNCER = {
    "round1": "Round one!", "round2": "Round two!", "final_round": "Final round!",
    "fight": "Fight!", "ko": "K. O.!", "counter": "Counter!", "perfect": "Perfect!",
    "muscle_link": "Muscle link!", "perfect_link": "Perfect link!", "force_couple": "Force couple!",
    "special": "Special!", "victory": "Victory!", "time_up": "Time!", "draw": "Draw game!",
    "adrenaline": "Adrenaline!", "anatomy_finish": "Anatomy finish!",
    "choose": "Choose your fighter!", "title": "Muscle Battle!",
    # Muscle Link challenge results / prompt
    "perfect_muscle_link": "Perfect muscle link!", "force_couple_combo": "Force couple combo!",
    "neural_counter": "Neural counter!", "muscle_skill_ready": "Muscle skill ready!",
}


def build_announcer(only=None):
    print("Announcer")
    out_dir = os.path.join(ROOT, "Announcer")
    os.makedirs(out_dir, exist_ok=True)
    with tempfile.TemporaryDirectory() as td:
        for key, text in ANNOUNCER.items():
            if only and key not in only:
                continue
            raw = os.path.join(td, key + ".wav")
            proc = os.path.join(td, key + "_p.wav")
            subprocess.run(["espeak-ng", "-v", "en-us+m3", "-s", "125", "-p", "28", "-a", "160",
                            "-w", raw, text], check=True)
            subprocess.run(["sox", "-q", raw, "-r", str(SR), "-c", "2", proc, "gain", "-9", "pitch", "-380",
                            "bass", "+6", "treble", "+3",
                            "compand", "0.01,0.15", "-60,-60,-30,-12,-10,-4,0,-1", "-6",
                            "reverb", "35", "50", "60", "gain", "-n", "-1"], check=True)
            subprocess.run(["oggenc", "-Q", "-q", "5", "-o", os.path.join(out_dir, key + ".ogg"), proc], check=True)
            print("   Announcer/" + key + ".ogg")


# --------------------------------------------------------------------------
# Character select assets (theme stings, BGM layers, short fighter voice lines)
# --------------------------------------------------------------------------
VOICES = {
    # key: (text, espeak voice, speed, pitch, sox pitch cents)
    "jin_lock": ("Ready. Let's move!", "en-us+m1", "150", "52", "-120"),
    "ray_lock": ("Time to lift.", "en-us+m7", "118", "18", "-330"),
}


def build_select_ui():
    print("Character select")
    write_ogg("select_lock_layer", stereo(bgm_select_lock_layer(), 0.8), "BGM", 4)
    write_ogg("select_tension_layer", stereo(bgm_select_tension_layer(), 0.5), "BGM", 4)
    write_ogg("theme_jin", stereo(theme_sting("jin"), 0.7), "SFX", 4)
    write_ogg("theme_ray", stereo(theme_sting("ray"), 0.5), "SFX", 4)
    out_dir = os.path.join(ROOT, "Voice")
    os.makedirs(out_dir, exist_ok=True)
    with tempfile.TemporaryDirectory() as td:
        for key, (text, voice, speed, pitch, cents) in VOICES.items():
            raw = os.path.join(td, key + ".wav")
            proc = os.path.join(td, key + "_p.wav")
            subprocess.run(["espeak-ng", "-v", voice, "-s", speed, "-p", pitch, "-a", "170", "-w", raw, text], check=True)
            subprocess.run(["sox", "-q", raw, "-r", str(SR), "-c", "2", proc, "gain", "-8", "pitch", cents,
                            "bass", "+4", "treble", "+2",
                            "compand", "0.01,0.15", "-60,-60,-30,-12,-10,-4,0,-1", "-6",
                            "reverb", "18", "40", "40", "gain", "-n", "-1"], check=True)
            subprocess.run(["oggenc", "-Q", "-q", "5", "-o", os.path.join(out_dir, key + ".ogg"), proc], check=True)
            print("   Voice/" + key + ".ogg")


if __name__ == "__main__":
    import sys
    if "--muscle-link" in sys.argv:  # only the Muscle Link announcer lines
        build_announcer({"perfect_muscle_link", "force_couple_combo", "neural_counter", "muscle_skill_ready"})
        raise SystemExit(0)
    if "--select-ui" in sys.argv:  # only the character select additions (keeps every other asset untouched)
        build_select_ui()
        raise SystemExit(0)
    build_announcer()
    build_sfx()
    build_bgm()
