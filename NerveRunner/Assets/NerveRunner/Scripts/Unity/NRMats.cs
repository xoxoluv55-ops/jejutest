// NERVE RUNNER 2.0 - premium materials + generated effect textures, with SAFE FALLBACK.
// Custom shaders (NerveRunner/ToonRim, NerveRunner/FX) are used only when Unity reports them as
// present and supported; otherwise everything falls back to the original URP/Lit materials
// (Neon Racer's Mats), so a shader problem can never break the game. Graphics quality "Low"
// also forces the fallback path.
using System.Collections.Generic;
using NeonRacer;
using UnityEngine;
using UnityEngine.Rendering;

namespace NerveRunner
{
    public enum GfxLevel { Low = 0, Medium = 1, High = 2 }

    public static class Gfx
    {
        public static GfxLevel Level = GfxLevel.High;
        /// Multiplier for particle counts.
        public static float Particles { get { return Level == GfxLevel.Low ? 0.3f : Level == GfxLevel.Medium ? 0.65f : 1f; } }
        public static bool Fancy { get { return Level != GfxLevel.Low; } }
        public static float CameraShake = 1f;

        /// PERF (2.1): High only on desktop GPUs with >= 4 GB VRAM; everything else starts on Medium.
        public static GfxLevel AutoLevel()
        {
            if (Application.isMobilePlatform) return GfxLevel.Medium;
            return SystemInfo.graphicsMemorySize >= 4000 ? GfxLevel.High : GfxLevel.Medium;
        }
        /// Decorative props (backdrop neurons, city buildings) disappear beyond this distance.
        public static float PropCullDistance { get { return Level == GfxLevel.Low ? 180f : Level == GfxLevel.Medium ? 280f : 420f; } }
        public static int BackdropNeurons { get { return Level == GfxLevel.Low ? 18 : Level == GfxLevel.Medium ? 36 : 60; } }
        public const int PropsLayer = 8;   // unnamed user layer used only for distance culling
        public static bool ShowPerf;
    }

    public static class NRMats
    {
        static bool init;
        static Shader toon, fx;
        static readonly Dictionary<string, Material> cache = new Dictionary<string, Material>();

        static readonly int ID_Base = Shader.PropertyToID("_BaseColor");
        static readonly int ID_Shade = Shader.PropertyToID("_ShadeColor");
        static readonly int ID_Rim = Shader.PropertyToID("_RimColor");
        static readonly int ID_RimPow = Shader.PropertyToID("_RimPower");
        static readonly int ID_High = Shader.PropertyToID("_HighlightColor");
        static readonly int ID_Gloss = Shader.PropertyToID("_Gloss");
        static readonly int ID_Emis = Shader.PropertyToID("_EmissionColor");
        static readonly int ID_Map = Shader.PropertyToID("_BaseMap");
        static readonly int ID_Src = Shader.PropertyToID("_SrcBlend");
        static readonly int ID_Dst = Shader.PropertyToID("_DstBlend");

        static void Init()
        {
            if (init) return;
            init = true;
            toon = Shader.Find("NerveRunner/ToonRim");
            fx = Shader.Find("NerveRunner/FX");
            if (toon != null && !toon.isSupported) toon = null;
            if (fx != null && !fx.isSupported) fx = null;
            if (toon == null) Debug.LogWarning("[NerveRunner] ToonRim shader unavailable - using URP/Lit fallback");
            if (fx == null) Debug.LogWarning("[NerveRunner] FX shader unavailable - transparent effects disabled");
        }

        public static bool ToonOK { get { Init(); return toon != null && Gfx.Fancy; } }
        public static bool FxOK { get { Init(); return fx != null; } }

        static string K(Color c) { return c.r + "," + c.g + "," + c.b + "," + c.a; }

        /// Cartoon body material (two-tone + rim + highlight + emission). Fallback: URP/Lit emissive.
        public static Material Toon(Color baseC, Color shade, Color rim, float rimPower, Color emission, float gloss = 60f)
        {
            if (!ToonOK) return Mats.Emissive(baseC, emission + baseC * 0.25f);
            string key = "T|" + K(baseC) + K(shade) + K(rim) + rimPower + K(emission) + gloss;
            Material m;
            if (cache.TryGetValue(key, out m) && m != null) return m;
            m = new Material(toon);
            m.SetColor(ID_Base, baseC); m.SetColor(ID_Shade, shade); m.SetColor(ID_Rim, rim);
            m.SetFloat(ID_RimPow, rimPower); m.SetColor(ID_High, Color.white); m.SetFloat(ID_Gloss, gloss);
            m.SetColor(ID_Emis, emission);
            cache[key] = m;
            return m;
        }

        /// Additive (light) effect. Returns null when the FX shader is unavailable - callers skip the effect.
        public static Material Additive(Color c, Texture tex) { return Fx(c, tex, true); }
        /// Alpha-blended effect (blob shadow). Null when unavailable.
        public static Material AlphaBlend(Color c, Texture tex) { return Fx(c, tex, false); }

        static Material Fx(Color c, Texture tex, bool additive)
        {
            if (!FxOK) return null;
            string key = (additive ? "A|" : "B|") + K(c) + (tex != null ? tex.GetInstanceID() : 0);
            Material m;
            if (cache.TryGetValue(key, out m) && m != null) return m;
            m = new Material(fx);
            m.SetColor(ID_Base, c);
            if (tex != null) m.SetTexture(ID_Map, tex);
            // additive uses (SrcAlpha, One) so trail/particle alpha fades still apply (One,One would ignore alpha)
            m.SetFloat(ID_Src, (float)BlendMode.SrcAlpha);
            m.SetFloat(ID_Dst, additive ? (float)BlendMode.One : (float)BlendMode.OneMinusSrcAlpha);
            m.renderQueue = (int)RenderQueue.Transparent;
            cache[key] = m;
            return m;
        }

        //================== GENERATED TEXTURES ==================\\
        static Texture2D glow, dot, ring, shadow, streak, sparkle;

        /// Soft radial glow (halo, flashes).
        public static Texture2D Glow { get { return glow != null ? glow : (glow = Radial(64, (d) => { float a = Mathf.Clamp01(1f - d); return a * a * a; })); } }
        /// Small soft dot with a hot core (sparks, particles).
        public static Texture2D Dot { get { return dot != null ? dot : (dot = Radial(32, (d) => Mathf.Clamp01(1f - d) * Mathf.Clamp01(1f - d) + (d < 0.25f ? 0.5f : 0f))); } }
        /// Thin bright ring (pulse waves, node flashes).
        public static Texture2D Ring { get { return ring != null ? ring : (ring = Radial(64, (d) => Mathf.Exp(-Mathf.Pow((d - 0.8f) / 0.07f, 2f)))); } }
        /// Dark soft blob for the alpha-blended contact shadow.
        public static Texture2D Shadow { get { return shadow != null ? shadow : (shadow = Radial(32, (d) => Mathf.Clamp01(1f - d * d) * 0.85f)); } }
        /// 4-point twinkle (correct answer / victory sparkles).
        public static Texture2D Sparkle
        {
            get
            {
                if (sparkle != null) return sparkle;
                const int S = 48;
                sparkle = NewTex(S);
                var px = new Color[S * S];
                for (int y = 0; y < S; y++)
                    for (int x = 0; x < S; x++)
                    {
                        float dx = Mathf.Abs((x + 0.5f) / S * 2f - 1f), dy = Mathf.Abs((y + 0.5f) / S * 2f - 1f);
                        float a = Mathf.Clamp01(1f - (dx * 6f) - dy) + Mathf.Clamp01(1f - (dy * 6f) - dx);
                        a = Mathf.Clamp01(a) + Mathf.Clamp01(0.35f - Mathf.Sqrt(dx * dx + dy * dy)) * 2f;
                        px[y * S + x] = new Color(1f, 1f, 1f, Mathf.Clamp01(a));
                    }
                sparkle.SetPixels(px); sparkle.Apply();
                return sparkle;
            }
        }
        /// Horizontal streak (speed rays).
        public static Texture2D Streak
        {
            get
            {
                if (streak != null) return streak;
                const int W = 64, H = 16;
                streak = new Texture2D(W, H, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp };
                var px = new Color[W * H];
                for (int y = 0; y < H; y++)
                    for (int x = 0; x < W; x++)
                    {
                        float u = (x + 0.5f) / W, v = Mathf.Abs((y + 0.5f) / H * 2f - 1f);
                        float a = Mathf.Sin(u * Mathf.PI) * Mathf.Clamp01(1f - v * v);
                        px[y * W + x] = new Color(1f, 1f, 1f, a);
                    }
                streak.SetPixels(px); streak.Apply();
                return streak;
            }
        }

        static Texture2D NewTex(int s)
        {
            return new Texture2D(s, s, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Bilinear };
        }

        static Texture2D Radial(int s, System.Func<float, float> alpha)
        {
            var t = NewTex(s);
            var px = new Color[s * s];
            for (int y = 0; y < s; y++)
                for (int x = 0; x < s; x++)
                {
                    float dx = (x + 0.5f) / s * 2f - 1f, dy = (y + 0.5f) / s * 2f - 1f;
                    float d = Mathf.Sqrt(dx * dx + dy * dy);
                    float a = d >= 1f ? 0f : Mathf.Clamp01(alpha(d));
                    // additive effects read RGB, alpha-blend reads A: write both
                    px[y * s + x] = new Color(a, a, a, a);
                }
            t.SetPixels(px); t.Apply();
            return t;
        }

        /// Myelin lamellae: cream-gold wraps with fine spiral lines (u = around, v = along axon).
        public static Texture2D Lamellae(Color baseC, Color line)
        {
            const int W = 128, H = 64;
            var t = new Texture2D(W, H, TextureFormat.RGBA32, true) { wrapMode = TextureWrapMode.Repeat };
            var px = new Color[W * H];
            for (int y = 0; y < H; y++)
                for (int x = 0; x < W; x++)
                {
                    float u = x / (float)W, v = y / (float)H;
                    float spiral = Mathf.Repeat(u * 6f + v * 1f, 1f);           // wrapped membrane layers
                    float l = Mathf.Exp(-Mathf.Pow((spiral - 0.5f) / 0.05f, 2f));
                    float grain = Mathf.PerlinNoise(u * 24f, v * 12f) * 0.18f;
                    Color c = baseC * (0.86f + grain) + line * (l * 0.9f);   // 2.0b: crisper glowing wraps
                    c.a = 1f;
                    px[y * W + x] = c;
                }
            t.SetPixels(px); t.Apply(true);
            return t;
        }
    }
}
