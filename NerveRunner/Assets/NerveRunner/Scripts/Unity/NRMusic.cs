// NERVE RUNNER 2.3 - procedural background music (no audio files).
// Two loops in the same style as Neon Racer's synth engine (Sfx.Music, MIT), re-scored for a
// cute, bright game:
//   Menu  - 92 BPM, F-G-Em-Am, soft pads + music-box arpeggio + gentle kick.
//   Race  - 132 BPM, C-Am-F-G, chiptune square lead melody, driving bass, kick/snare/hat.
// Every layer is a function of time, the loop is an exact number of bars, so it loops seamlessly.
using System;
using UnityEngine;

namespace NerveRunner
{
    public static class NRMusic
    {
        const int RATE = 22050;
        const float TAU = Mathf.PI * 2f;

        static float N(int midi) { return 440f * Mathf.Pow(2f, (midi - 69) / 12f); }

        static float Noise(int i)
        {
            float x = Mathf.Sin(i * 127.1f) * 43758.547f;
            return (x - Mathf.Floor(x)) * 2f - 1f;
        }

        static float Square(float f, float t, float duty = 0.5f) { return Mathf.Repeat(f * t, 1f) < duty ? 1f : -1f; }
        static float Tri(float f, float t) { float p = Mathf.Repeat(f * t, 1f); return 4f * Mathf.Abs(p - 0.5f) - 1f; }

        static AudioClip Render(string name, float seconds, Func<float, int, float> f)
        {
            int n = Mathf.Max(1, (int)(seconds * RATE));
            var d = new float[n];
            for (int i = 0; i < n; i++)
            {
                float m = f(i / (float)RATE, i);
                float edge = Mathf.Min(1f, Mathf.Min(i, n - 1 - i) / 220f);   // 10 ms fade at the loop seam (no click)
                d[i] = m * (27f + m * m) / (27f + 9f * m * m) * edge;    // soft saturation (Pade tanh)
            }
            var c = AudioClip.Create(name, n, 1, RATE, false);
            c.SetData(d, 0);
            return c;
        }

        /// Calm, dreamy menu loop.
        public static AudioClip Menu()
        {
            const float bpm = 92f;
            float spb = 60f / bpm, bar = spb * 4f;
            const int bars = 8;
            // F  G  Em  Am  F  G  Em  Am   (chord tones, midi)
            int[][] ch = {
                new[] { 53, 57, 60, 64 }, new[] { 55, 59, 62, 65 }, new[] { 52, 55, 59, 62 }, new[] { 57, 60, 64, 67 },
                new[] { 53, 57, 60, 64 }, new[] { 55, 59, 62, 67 }, new[] { 52, 55, 59, 64 }, new[] { 57, 60, 64, 69 } };
            int[] arp = { 0, 1, 2, 3, 2, 1, 2, 3 };
            return Render("nr_menu", bar * bars, (t, i) =>
            {
                int b = ((int)(t / bar)) % bars;
                float tb = t - Mathf.Floor(t / spb) * spb;
                float tInBar = t - Mathf.Floor(t / bar) * bar;
                // pads
                float env = Mathf.Clamp01(tInBar / 0.6f) * Mathf.Clamp01((bar - tInBar) / 0.5f);
                float pad = 0f;
                for (int k = 0; k < 4; k++) pad += Mathf.Sin(TAU * N(ch[b][k]) * t) + 0.4f * Mathf.Sin(TAU * N(ch[b][k]) * 1.003f * t);
                pad *= env * 0.035f;
                // music-box arpeggio (8ths, one octave up)
                float t8 = spb * 0.5f; int e = (int)(t / t8); float lt = t - e * t8;
                float af = N(ch[b][arp[e % 8]] + 12);
                float box = (Mathf.Sin(TAU * af * t) + 0.3f * Mathf.Sin(TAU * af * 2f * t)) * Mathf.Exp(-lt * 7f) * 0.12f;
                // soft kick on 1 and 3, bass root
                int beat = ((int)(t / spb)) % 4;
                float kick = (beat % 2 == 0 && tb < 0.12f) ? Mathf.Sin(TAU * (60f * tb + 2f * (1f - Mathf.Exp(-30f * tb)))) * Mathf.Exp(-tb * 20f) * 0.5f : 0f;
                float bass = Tri(N(ch[b][0] - 12), t) * 0.13f * (0.6f + 0.4f * Mathf.Exp(-tb * 3f));
                return (pad + box + kick + bass) * 0.9f;
            });
        }

        /// Upbeat, bright race loop (chiptune lead over synth drums).
        public static AudioClip Race()
        {
            const float bpm = 132f;
            float spb = 60f / bpm, bar = spb * 4f;
            const int bars = 8;
            // C  Am  F  G  C  Am  F  G
            int[] root = { 48, 45, 41, 43, 48, 45, 41, 43 };
            int[][] ch = {
                new[] { 60, 64, 67 }, new[] { 57, 60, 64 }, new[] { 53, 57, 60 }, new[] { 55, 59, 62 },
                new[] { 60, 64, 67 }, new[] { 57, 60, 64 }, new[] { 53, 57, 60 }, new[] { 55, 59, 62 } };
            // lead melody: 16ths per bar (-1 = rest), C major pentatonic, cheerful
            int[][] mel = {
                new[] { 72, -1, 76, -1, 79, -1, 76, 77, 79, -1, 84, -1, 81, -1, 79, -1 },
                new[] { 76, -1, 72, -1, 69, -1, 72, 74, 76, -1, 72, -1, 69, -1, -1, -1 },
                new[] { 77, -1, 81, -1, 84, -1, 81, -1, 79, 77, 76, -1, 74, -1, 72, -1 },
                new[] { 74, -1, 79, -1, 83, -1, 79, -1, 86, -1, 83, -1, 79, -1, -1, -1 },
                new[] { 84, -1, 79, -1, 76, -1, 79, 81, 84, -1, 88, -1, 84, -1, 79, -1 },
                new[] { 81, -1, 76, -1, 72, -1, 76, -1, 79, -1, 76, 74, 72, -1, -1, -1 },
                new[] { 77, -1, 76, 77, 81, -1, 79, -1, 77, -1, 76, -1, 74, -1, 72, -1 },
                new[] { 74, -1, 76, -1, 79, -1, 83, -1, 84, -1, -1, -1, 79, -1, 83, -1 } };
            return Render("nr_race", bar * bars, (t, i) =>
            {
                int b = ((int)(t / bar)) % bars;
                float tb = t - Mathf.Floor(t / spb) * spb;
                int beat = ((int)(t / spb)) % 4;
                float t16 = spb * 0.25f; int s16 = (int)(t / t16); float l16 = t - s16 * t16;
                // drums
                float kick = tb < 0.13f ? Mathf.Sin(TAU * ((150f / 28f) * (1f - Mathf.Exp(-28f * tb)) + 42f * tb)) * Mathf.Exp(-tb * 22f) * 0.85f : 0f;
                float snare = ((beat == 1 || beat == 3) && tb < 0.16f) ? Noise(i) * Mathf.Exp(-tb * 24f) * 0.35f + Mathf.Sin(TAU * 200f * tb) * Mathf.Exp(-tb * 40f) * 0.18f : 0f;
                float hat = (Noise(i) - Noise(i - 1)) * 0.5f * Mathf.Exp(-l16 * 120f) * (s16 % 2 == 1 ? 0.22f : 0.1f);
                // bass: 8ths, root + octave bounce
                float t8 = spb * 0.5f; int e = (int)(t / t8); float l8 = t - e * t8;
                float bf = N(root[b] + ((e % 2 == 1) ? 12 : 0));
                float bass = Square(bf, t, 0.5f) * Mathf.Exp(-l8 * 6f) * 0.12f;
                // chord stabs on off-beats (square, short)
                float stab = 0f;
                if (e % 2 == 1) foreach (int c in ch[b]) stab += Square(N(c), t, 0.25f);
                stab *= Mathf.Exp(-l8 * 14f) * 0.035f;
                // lead (12.5% duty square = classic cute chip lead) with a little vibrato
                int note = mel[b][s16 % 16];
                float lead = 0f;
                if (note > 0)
                {
                    float vib = 1f + 0.004f * Mathf.Sin(TAU * 6f * t);
                    lead = Square(N(note) * vib, t, 0.125f) * Mathf.Exp(-l16 * 5f) * 0.11f;
                }
                float duck = Mathf.Lerp(0.6f, 1f, Mathf.Clamp01(tb / 0.25f));   // sidechain feel
                return (kick + snare + hat + duck * (bass + stab + lead)) * 0.8f;
            });
        }
    }
}
