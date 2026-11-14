// Reused from Neon Racer (https://github.com/pinchasVaknin/neon-racer, commit 090f15b), MIT License,
// Copyright (c) 2026 Pinchas Vaknin. See LICENSE.txt in this folder.
// Status: copied UNMODIFIED.

using System;
using System.Collections.Generic;
using UnityEngine;

namespace NeonRacer
{
    // All sound is generated procedurally at runtime (no audio files needed).
    public class Sfx
    {
        public static Sfx I;
        public static bool SfxMuted;    // engine, screech, one-shots (clicks/coins/thuds...)
        public static bool MusicMuted;  // background music only
        static readonly List<Sfx> All = new List<Sfx>();

        AudioSource engine, screech, music, sfx;
        AudioClip cEngine, cScreech, cWhoosh, cThud, cBeep, cChime, cClick, cCoin, cMusic;
        bool ready;
        const int RATE = 44100;

        //================== SETUP ==================\\
        public void Init(Transform parent, bool withMusic = true)
        {
            try
            {
                engine = MakeSource(parent, "Engine", true, 0f);
                screech = MakeSource(parent, "Screech", true, 0f);
                if (withMusic) music = MakeSource(parent, "Music", true, 0.28f);
                sfx = MakeSource(parent, "Sfx", false, 0.9f);

                cEngine = Engine();
                cScreech = NoiseLoop(0.4f);
                cWhoosh = Whoosh();
                cThud = MakeThud();
                cBeep = Tone(820f, 0.12f, 0.5f);
                cChime = MakeChime();
                cClick = Tone(1300f, 0.04f, 0.4f);
                cCoin = MakeCoin();
                if (withMusic) cMusic = Music();

                engine.clip = cEngine; engine.Play();
                screech.clip = cScreech; screech.Play();
                if (music != null) { music.clip = cMusic; music.Play(); }
                ready = true;
                if (!All.Contains(this)) All.Add(this);
                ApplyMute();
            }
            catch (Exception e)
            {
                // Never silent: on a device this is the difference between "no audio" and
                // "no idea why there is no audio".
                ready = false;
                Debug.LogWarning("[Sfx] audio init failed, continuing muted: " + e.Message);
            }
        }

        AudioSource MakeSource(Transform parent, string name, bool loop, float vol)
        {
            var go = new GameObject("Sfx_" + name);
            if (parent != null) go.transform.SetParent(parent, false);
            var a = go.AddComponent<AudioSource>();
            a.loop = loop; a.volume = vol; a.playOnAwake = false; a.spatialBlend = 0f;
            return a;
        }

        AudioClip Build(string name, float seconds, Func<float, float> f)
        {
            int n = Mathf.Max(1, (int)(seconds * RATE));
            var data = new float[n];
            for (int i = 0; i < n; i++) data[i] = Mathf.Clamp(f(i / (float)RATE), -1f, 1f);
            var c = AudioClip.Create(name, n, 1, RATE, false);
            c.SetData(data, 0);
            return c;
        }

        static float Saw(float freq, float t) { float p = (t * freq) % 1f; return p * 2f - 1f; }

        //================== ONE-SHOT RELEASE ==================\\
        /// A one-shot MUST reach silence before its buffer ends. Cutting a wave mid-swing steps
        /// the speaker to zero in a single sample, and that step is exactly the click you hear on
        /// every button press - measured at 0.29 peak on the UI click before this existed.
        /// 12ms is short enough to be inaudible as a fade and long enough to kill the step.
        const float RELEASE = 0.012f;
        static float Release(float t, float secs)
        {
            return secs <= RELEASE ? 1f : Mathf.Clamp01((secs - t) / RELEASE);
        }

        //================== CLIP GENERATORS ==================\\
        AudioClip Engine()
        {
            var rnd = new System.Random(7);
            return Build("engine", 0.5f, t =>
            {
                float v = 0.5f * Saw(70f, t) + 0.3f * Mathf.Sin(2 * Mathf.PI * 140f * t) + 0.18f * Mathf.Sin(2 * Mathf.PI * 47f * t);
                v += 0.08f * ((float)rnd.NextDouble() * 2 - 1);
                return v * 0.5f;
            });
        }
        AudioClip NoiseLoop(float secs)
        {
            var rnd = new System.Random(11);
            return Build("screech", secs, t =>
            {
                float n = (float)rnd.NextDouble() * 2 - 1;
                // 27.5Hz over a 0.4s loop = exactly 11 cycles, so the tremolo meets itself at
                // the seam. 28Hz left it 20% into a cycle and stepped the level on every wrap.
                float env = 0.6f + 0.4f * Mathf.Sin(2 * Mathf.PI * 27.5f * t);
                return n * env * 0.5f;
            });
        }
        AudioClip Whoosh()
        {
            var rnd = new System.Random(3);
            return Build("whoosh", 0.5f, t =>
            {
                float n = (float)rnd.NextDouble() * 2 - 1;
                float env = Mathf.Sin(Mathf.PI * Mathf.Clamp01(t / 0.5f));
                return n * env * 0.6f * Release(t, 0.5f);
            });
        }
        AudioClip MakeThud() { return Build("thud", 0.25f, t => Mathf.Sin(2 * Mathf.PI * 90f * t) * Mathf.Exp(-t * 18f) * Release(t, 0.25f)); }
        AudioClip Tone(float freq, float secs, float amp) { return Build("tone", secs, t => Mathf.Sin(2 * Mathf.PI * freq * t) * Mathf.Exp(-t * 8f) * amp * Release(t, secs)); }
        AudioClip MakeChime()
        {
            return Build("chime", 0.5f, t =>
            {
                float env = Mathf.Exp(-t * 5f);
                return (Mathf.Sin(2 * Mathf.PI * 880f * t) + 0.6f * Mathf.Sin(2 * Mathf.PI * 1320f * t)) * env * 0.32f * Release(t, 0.5f);
            });
        }
        AudioClip MakeCoin()
        {
            return Build("coin", 0.18f, t =>
            {
                float freq = 900f + 1600f * Mathf.Clamp01(t / 0.18f);
                return Mathf.Sin(2 * Mathf.PI * freq * t) * Mathf.Exp(-t * 9f) * 0.5f * Release(t, 0.18f);
            });
        }
        /// Build at a custom sample rate. Music renders at 22.05kHz: half the memory and half the
        /// generation time of 44.1k, and nothing in a synth loop needs the octave above 11kHz.
        AudioClip BuildRate(string name, float seconds, int rate, Func<float, int, float> f)
        {
            int n = Mathf.Max(1, (int)(seconds * rate));
            var data = new float[n];
            for (int i = 0; i < n; i++) data[i] = Mathf.Clamp(f(i / (float)rate, i), -1f, 1f);
            var c = AudioClip.Create(name, n, 1, rate, false);
            c.SetData(data, 0);
            return c;
        }

        /// An actual synthwave loop instead of the old eight-beep sequence: 8 bars at 104 BPM in
        /// A minor (Am F C G / Am F Dm E), with kick + snare + hats, a driving eighth-note bass,
        /// warm detuned pads, and a 16th-note arpeggio with a dotted-eighth echo. Melodic layers
        /// duck after every kick (sidechain) for the classic pumping feel. Fully deterministic -
        /// identical on every run - and it loops seamlessly because 0.0s and 18.46s land on the
        /// same beat/bar/chord boundary.
        AudioClip Music()
        {
            const int rate = 22050;
            const float bpm = 104f;
            float spb = 60f / bpm;          // seconds per beat
            float barLen = spb * 4f;
            const int bars = 8;
            float total = barLen * bars;

            // chord tones (pads), one chord per bar:      Am        F         C         G         Am        F         Dm        E
            float[] c1 = { 220.00f, 174.61f, 261.63f, 196.00f, 220.00f, 174.61f, 220.00f, 164.81f };
            float[] c2 = { 261.63f, 220.00f, 329.63f, 246.94f, 261.63f, 220.00f, 293.66f, 207.65f };
            float[] c3 = { 329.63f, 261.63f, 392.00f, 293.66f, 329.63f, 261.63f, 349.23f, 246.94f };
            // bass roots, low but still audible on a phone speaker
            float[] bassF = { 110.00f, 87.31f, 130.81f, 98.00f, 110.00f, 87.31f, 73.42f, 82.41f };
            // arpeggio tones: chord over two octaves
            float[] a1 = { 220.00f, 174.61f, 261.63f, 196.00f, 220.00f, 174.61f, 146.83f, 164.81f };
            float[] a2 = { 261.63f, 220.00f, 329.63f, 246.94f, 261.63f, 220.00f, 174.61f, 207.65f };
            float[] a3 = { 329.63f, 261.63f, 392.00f, 293.66f, 329.63f, 261.63f, 220.00f, 246.94f };
            float[] a4 = { 440.00f, 349.23f, 523.25f, 392.00f, 440.00f, 349.23f, 293.66f, 329.63f };
            int[] arpPattern = { 0, 1, 2, 3, 2, 1 };   // up-and-down over the 16ths

            const float TAU = 2f * Mathf.PI;

            // deterministic per-sample noise (drums)
            Func<int, float> noise = i =>
            {
                float x = Mathf.Sin(i * 127.1f) * 43758.547f;
                return (x - Mathf.Floor(x)) * 2f - 1f;
            };

            // the arpeggio as a function of time, so the echo can re-evaluate it in the past
            Func<float, float> arpAt = t =>
            {
                if (t < 0f) t += total;                       // the echo tail wraps the loop
                int bar = ((int)(t / barLen)) % bars;
                float t16 = spb * 0.25f;
                int six = (int)(t / t16);
                float lt = t - six * t16;
                int idx = arpPattern[six % arpPattern.Length];
                float f = idx == 0 ? a1[bar] : idx == 1 ? a2[bar] : idx == 2 ? a3[bar] : a4[bar];
                float env = Mathf.Exp(-lt * 13f);
                // square-ish pluck: fundamental + soft odd harmonics
                float v = Mathf.Sin(TAU * f * t) + 0.33f * Mathf.Sin(TAU * f * 3f * t) + 0.18f * Mathf.Sin(TAU * f * 5f * t);
                return v * env;
            };

            return BuildRate("music", total, rate, (t, i) =>
            {
                int bar = ((int)(t / barLen)) % bars;
                float tb = t - Mathf.Floor(t / spb) * spb;            // time since last beat
                int beatInBar = ((int)(t / spb)) % 4;

                // ---- drums ----
                // kick: pitch-swept sine on every beat (phase = integral of the freq sweep)
                float kick = 0f;
                if (tb < 0.14f)
                {
                    float phase = TAU * ((145f / 26f) * (1f - Mathf.Exp(-26f * tb)) + 40f * tb);
                    kick = Mathf.Sin(phase) * Mathf.Exp(-tb * 24f) * 0.95f;
                }
                // snare on beats 2 & 4: noise burst + a little 190Hz body
                float snare = 0f;
                if ((beatInBar == 1 || beatInBar == 3) && tb < 0.18f)
                    snare = noise(i) * Mathf.Exp(-tb * 22f) * 0.42f + Mathf.Sin(TAU * 190f * tb) * Mathf.Exp(-tb * 40f) * 0.22f;
                // hats on every eighth, brighter offbeat; differentiated noise = high frequencies
                float t8 = spb * 0.5f;
                int eight = (int)(t / t8);
                float lt8 = t - eight * t8;
                float hat = (noise(i) - noise(i - 1)) * 0.5f * Mathf.Exp(-lt8 * 90f) * (eight % 2 == 1 ? 0.34f : 0.15f);

                // ---- bass: driving eighths with an octave pop on 3 & 6 ----
                float bf = bassF[bar] * ((eight % 8 == 3 || eight % 8 == 6) ? 2f : 1f);
                float bEnv = Mathf.Exp(-lt8 * 7f) * 0.9f + 0.1f;
                float bass = (Mathf.Sin(TAU * bf * t) + 0.5f * Mathf.Sin(TAU * bf * 2f * t) + 0.28f * Mathf.Sin(TAU * bf * 3f * t)) * bEnv * 0.24f;

                // ---- pads: the chord, softly detuned for width, breathing in per bar ----
                float tInBar = t - Mathf.Floor(t / barLen) * barLen;
                float pEnv = Mathf.Clamp01(tInBar / 0.35f) * Mathf.Clamp01((barLen - tInBar) / 0.3f);
                float pad = (Mathf.Sin(TAU * c1[bar] * t) + Mathf.Sin(TAU * c2[bar] * t) + Mathf.Sin(TAU * c3[bar] * t)
                           + Mathf.Sin(TAU * (c1[bar] + 0.9f) * t) + Mathf.Sin(TAU * (c3[bar] + 1.1f) * t)) * pEnv * 0.045f;

                // ---- arp + dotted-eighth echo ----
                float arp = arpAt(t) * 0.15f + arpAt(t - spb * 0.75f) * 0.075f;

                // ---- sidechain: melodic layers duck right after every kick ----
                float duck = Mathf.Lerp(0.5f, 1f, Mathf.Clamp01(tb / 0.3f));

                float mix = (kick + snare + hat + duck * (bass + pad + arp)) * 0.82f;
                // Soft saturation (Pade tanh): kick+snare landing together would hard-clip;
                // this rounds those peaks off musically instead - the classic synth "glue".
                return mix * (27f + mix * mix) / (27f + 9f * mix * mix);
            });
        }

        //================== RUNTIME CONTROL ==================\\
        public void SetEngine(float speed01, bool boosting)
        {
            if (!ready) return;
            engine.pitch = 0.55f + 1.7f * Mathf.Clamp01(speed01) + (boosting ? 0.35f : 0f);
            engine.volume = 0.16f + 0.34f * Mathf.Clamp01(speed01);
        }
        public void SetScreech(float intensity)
        {
            if (!ready) return;
            screech.volume = Mathf.Clamp01(intensity) * 0.5f;
            screech.pitch = 0.9f + 0.5f * Mathf.Clamp01(intensity);
        }
        void One(AudioClip c, float v) { if (ready && !SfxMuted && c != null) sfx.PlayOneShot(c, v); }
        public void Whoosh2() { One(cWhoosh, 0.7f); }
        public void Thud() { One(cThud, 0.85f); }
        public void Beep() { One(cBeep, 0.6f); }
        public void Chime() { One(cChime, 0.6f); }
        public void Coin() { One(cCoin, 0.6f); }
        public void Click() { One(cClick, 0.5f); }
        public void StopLoops() { if (ready) { engine.volume = 0f; screech.volume = 0f; } }

        // Mute is applied per AudioSource so SFX and music are independent, and a static registry
        // makes the toggles affect every Sfx instance (menu Sfx + the race AudioManager's Sfx).
        void ApplyMute()
        {
            if (!ready) return;
            if (engine != null) engine.mute = SfxMuted;
            if (screech != null) screech.mute = SfxMuted;
            if (sfx != null) sfx.mute = SfxMuted;
            if (music != null) music.mute = MusicMuted;
        }
        /// Leaving a dead instance in the registry means every later mute toggle walks
        /// destroyed AudioSources. Owners call this when they go away.
        public void Shutdown() { All.Remove(this); ready = false; }

        public static void SetSfxMuted(bool m) { SfxMuted = m; for (int i = 0; i < All.Count; i++) All[i].ApplyMute(); }
        public static void SetMusicMuted(bool m) { MusicMuted = m; for (int i = 0; i < All.Count; i++) All[i].ApplyMute(); }
    }
}
