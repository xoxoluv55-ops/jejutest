using System.Collections.Generic;
using UnityEngine;

namespace MuscleBattle
{
    /// <summary>
    /// All textures used by the vertical slice are generated here at startup (cached), so the
    /// project has zero external art dependencies and the download stays small for iPad.
    /// Resolution follows the active QualityProfile.
    /// </summary>
    public static class ProceduralTextures
    {
        static readonly Dictionary<string, Texture2D> Cache = new Dictionary<string, Texture2D>();

        static Texture2D Make(string key, int w, int h, System.Func<float, float, Color> f, bool mip = true, TextureWrapMode wrap = TextureWrapMode.Clamp)
        {
            if (Cache.TryGetValue(key, out var cached) && cached != null) return cached;
            var tex = new Texture2D(w, h, TextureFormat.RGBA32, mip) { name = "MB_" + key, wrapMode = wrap, filterMode = FilterMode.Bilinear };
            var px = new Color32[w * h];
            for (int y = 0; y < h; y++)
            for (int x = 0; x < w; x++)
                px[y * w + x] = f((x + 0.5f) / w, (y + 0.5f) / h);
            tex.SetPixels32(px);
            tex.Apply(mip, true); // non-readable after upload: halves memory (important on iPad)
            Cache[key] = tex;
            return tex;
        }

        static float Smooth(float e0, float e1, float x) => Mathf.SmoothStep(0, 1, Mathf.InverseLerp(e0, e1, x));

        // ---------------- particles ----------------
        public static Texture2D SoftGlow => Make("glow", 64, 64, (u, v) =>
        {
            float d = Vector2.Distance(new Vector2(u, v), new Vector2(0.5f, 0.5f)) * 2f;
            float a = Mathf.Exp(-d * d * 4.5f) * (1 - Smooth(0.85f, 1f, d));
            return new Color(1, 1, 1, a);
        });

        public static Texture2D Streak => Make("streak", 64, 16, (u, v) =>
        {
            float x = Mathf.Abs(u - 0.5f) * 2f;
            float y = Mathf.Abs(v - 0.5f) * 2f;
            float a = (1 - x * x) * Mathf.Exp(-y * y * 9f);
            return new Color(1, 1, 1, Mathf.Clamp01(a));
        });

        public static Texture2D Ring => Make("ring", 128, 128, (u, v) =>
        {
            float d = Vector2.Distance(new Vector2(u, v), new Vector2(0.5f, 0.5f)) * 2f;
            float a = Mathf.Exp(-Mathf.Pow((d - 0.85f) / 0.07f, 2)) + 0.25f * Mathf.Exp(-Mathf.Pow((d - 0.7f) / 0.15f, 2));
            return new Color(1, 1, 1, Mathf.Clamp01(a));
        });

        public static Texture2D Flare => Make("flare", 128, 128, (u, v) =>
        {
            float x = (u - 0.5f) * 2f, y = (v - 0.5f) * 2f;
            float core = Mathf.Exp(-(x * x + y * y) * 18f);
            float star = Mathf.Exp(-Mathf.Abs(x) * 30f) * (1 - Mathf.Abs(y)) + Mathf.Exp(-Mathf.Abs(y) * 30f) * (1 - Mathf.Abs(x));
            return new Color(1, 1, 1, Mathf.Clamp01(core + star * 0.8f));
        });

        /// <summary>Muscle fibre energy - long striations (master prompt §13: red/orange fiber energy).</summary>
        public static Texture2D Fiber => Make("fiber", 128, 128, (u, v) =>
        {
            float s = 0;
            for (int i = 1; i <= 3; i++) s += Mathf.Pow(Mathf.Abs(Mathf.Sin((u * 9 * i + Mathf.Sin(v * 6 + i) * 0.35f) * Mathf.PI)), 6f) / i;
            float edge = Mathf.Sin(v * Mathf.PI);
            return new Color(1, 1, 1, Mathf.Clamp01(s * edge * 1.2f));
        }, true, TextureWrapMode.Repeat);

        public static Texture2D Smoke => Make("smoke", 64, 64, (u, v) =>
        {
            float d = Vector2.Distance(new Vector2(u, v), new Vector2(0.5f, 0.5f)) * 2f;
            float n = Mathf.PerlinNoise(u * 5f, v * 5f) * 0.6f + Mathf.PerlinNoise(u * 11f + 3, v * 11f) * 0.4f;
            return new Color(1, 1, 1, Mathf.Clamp01((1 - d) * n * 1.4f));
        });

        // ---------------- UI ----------------
        public static Texture2D RoundRect => Make("roundrect", 64, 64, (u, v) =>
        {
            float r = 0.25f;
            float x = Mathf.Max(Mathf.Abs(u - 0.5f) - (0.5f - r), 0), y = Mathf.Max(Mathf.Abs(v - 0.5f) - (0.5f - r), 0);
            float d = Mathf.Sqrt(x * x + y * y) / r;
            return new Color(1, 1, 1, 1 - Smooth(0.85f, 1f, d));
        }, false);

        public static Texture2D RoundRectOutline => Make("roundrect_o", 64, 64, (u, v) =>
        {
            float r = 0.25f;
            float x = Mathf.Max(Mathf.Abs(u - 0.5f) - (0.5f - r), 0), y = Mathf.Max(Mathf.Abs(v - 0.5f) - (0.5f - r), 0);
            float d = Mathf.Sqrt(x * x + y * y) / r;
            float a = (1 - Smooth(0.85f, 1f, d)) * Smooth(0.55f, 0.75f, d);
            return new Color(1, 1, 1, a);
        }, false);

        public static Texture2D Circle => Make("circle", 128, 128, (u, v) =>
        {
            float d = Vector2.Distance(new Vector2(u, v), new Vector2(0.5f, 0.5f)) * 2f;
            return new Color(1, 1, 1, 1 - Smooth(0.94f, 1f, d));
        }, false);

        public static Texture2D CircleOutline => Make("circle_o", 128, 128, (u, v) =>
        {
            float d = Vector2.Distance(new Vector2(u, v), new Vector2(0.5f, 0.5f)) * 2f;
            return new Color(1, 1, 1, (1 - Smooth(0.94f, 1f, d)) * Smooth(0.82f, 0.88f, d));
        }, false);

        public static Texture2D GradientH => Make("grad_h", 128, 4, (u, v) => new Color(1, 1, 1, u), false);
        public static Texture2D GradientV => Make("grad_v", 4, 128, (u, v) => new Color(1, 1, 1, v), false);
        public static Texture2D White => Make("white", 4, 4, (u, v) => Color.white, false);

        /// <summary>Bar fill with a bright top highlight - used by HP / meter bars.</summary>
        public static Texture2D BarFill => Make("barfill", 4, 32, (u, v) =>
        {
            float hl = Mathf.Lerp(0.78f, 1f, Smooth(0.45f, 0.8f, v)) + 0.25f * Smooth(0.75f, 0.9f, v) * (1 - Smooth(0.9f, 1f, v));
            return new Color(hl, hl, hl, 1);
        }, false);

        /// <summary>Slanted bar shape (the concept art's angled HP / meter frames).</summary>
        public static Texture2D Parallelogram => Make("para", 256, 32, (u, v) =>
        {
            const float skew = 0.06f;
            float left = skew * (1 - v), right = 1 - skew * v;
            float a = Smooth(left - 0.004f, left + 0.004f, u) * (1 - Smooth(right - 0.004f, right + 0.004f, u));
            return new Color(1, 1, 1, a);
        }, false);

        public static Texture2D ParallelogramOutline => Make("para_o", 256, 32, (u, v) =>
        {
            const float skew = 0.06f;
            float left = skew * (1 - v), right = 1 - skew * v;
            float inside = Smooth(left - 0.004f, left + 0.004f, u) * (1 - Smooth(right - 0.004f, right + 0.004f, u));
            float edge = Mathf.Max(1 - Smooth(0.0f, 0.012f, Mathf.Min(Mathf.Abs(u - left), Mathf.Abs(u - right))),
                                   (v < 0.12f || v > 0.88f) ? 1f : 0f);
            return new Color(1, 1, 1, inside * edge);
        }, false);

        public static Texture2D Scanlines => Make("scan", 4, 64, (u, v) => new Color(1, 1, 1, 0.5f + 0.5f * Mathf.Sin(v * Mathf.PI * 32f)), false, TextureWrapMode.Repeat);

        // ---------------- stage ----------------
        /// <summary>Floor: RGB = subtle polished base variation, A = neon glow mask (grid, rings, emblem).</summary>
        public static Texture2D Floor(int size) => Make("floor" + size, size, size, (u, v) =>
        {
            var p = new Vector2(u - 0.5f, v - 0.5f) * 2f; // -1..1, arena radius ~ 1
            float r = p.magnitude;
            float ang = Mathf.Atan2(p.y, p.x);

            // hex-ish grid
            var g = p * 14f;
            float gx = Mathf.Abs(Mathf.Repeat(g.x + Mathf.Repeat(Mathf.Floor(g.y), 2) * 0.5f, 1f) - 0.5f);
            float gy = Mathf.Abs(Mathf.Repeat(g.y, 1f) - 0.5f);
            float grid = Mathf.Max(1 - Smooth(0.0f, 0.04f, 0.5f - gx), 1 - Smooth(0.0f, 0.04f, 0.5f - gy)) * 0.12f;

            float ring(float rad, float w) => Mathf.Exp(-Mathf.Pow((r - rad) / w, 2));
            float glow = grid * (1 - Smooth(0.55f, 0.9f, r));
            glow += ring(0.62f, 0.006f) * 1.0f + ring(0.64f, 0.02f) * 0.25f;   // ring-out line
            glow += ring(0.24f, 0.004f) * 0.9f + ring(0.205f, 0.003f) * 0.6f;  // centre emblem rings
            // laurel-like ticks around the emblem
            float ticks = Mathf.Pow(Mathf.Abs(Mathf.Sin(ang * 18f)), 18f) * ring(0.225f, 0.012f) * (Mathf.Abs(Mathf.Sin(ang)) > 0.25f ? 1 : 0);
            glow += ticks * 0.9f;
            // radial spokes outside the ring
            glow += Mathf.Pow(Mathf.Abs(Mathf.Sin(ang * 12f)), 60f) * Smooth(0.66f, 0.7f, r) * (1 - Smooth(0.85f, 0.98f, r)) * 0.6f;
            // centre muscle silhouette: torso + arms flexed (abstract emblem)
            glow += Emblem(p / 0.19f) * 0.75f;

            float baseVar = 0.85f + 0.15f * Mathf.PerlinNoise(u * 20f, v * 20f);
            baseVar *= 1 - 0.25f * Smooth(0.7f, 1f, r);
            return new Color(baseVar, baseVar, baseVar * 1.05f, Mathf.Clamp01(glow));
        }, true, TextureWrapMode.Clamp);

        static float Emblem(Vector2 q)
        {
            // abstract "double biceps" figure made from distance fields
            float d = 10f;
            d = Mathf.Min(d, Ellipse(q - new Vector2(0, 0.38f), 0.16f, 0.18f));   // head
            d = Mathf.Min(d, Ellipse(q - new Vector2(0, -0.05f), 0.32f, 0.36f));  // torso
            d = Mathf.Min(d, Ellipse(q - new Vector2(-0.45f, 0.18f), 0.22f, 0.12f)); // upper arms
            d = Mathf.Min(d, Ellipse(q - new Vector2(0.45f, 0.18f), 0.22f, 0.12f));
            d = Mathf.Min(d, Ellipse(q - new Vector2(-0.62f, 0.42f), 0.1f, 0.2f));   // forearms up
            d = Mathf.Min(d, Ellipse(q - new Vector2(0.62f, 0.42f), 0.1f, 0.2f));
            float outline = Mathf.Exp(-Mathf.Pow(d / 0.03f, 2));
            return outline;
        }

        static float Ellipse(Vector2 p, float rx, float ry) => (new Vector2(p.x / rx, p.y / ry).magnitude - 1f) * Mathf.Min(rx, ry);

        /// <summary>Background wall: dark gradient with crowd/LED dots and horizontal light bands.</summary>
        public static Texture2D Wall(int size) => Make("wall" + size, size, size / 2, (u, v) =>
        {
            float baseC = Mathf.Lerp(0.05f, 0.16f, v);
            var rnd = Hash(Mathf.Floor(u * 260f), Mathf.Floor(v * 70f));
            float dots = (rnd > 0.82f && v < 0.55f && v > 0.08f) ? (0.4f + 0.6f * Hash(rnd, 3f)) : 0f;
            float cellX = Mathf.Repeat(u * 260f, 1f) - 0.5f, cellY = Mathf.Repeat(v * 70f, 1f) - 0.5f;
            dots *= Mathf.Exp(-(cellX * cellX + cellY * cellY) * 30f);
            float band = Mathf.Exp(-Mathf.Pow((v - 0.62f) / 0.01f, 2)) + Mathf.Exp(-Mathf.Pow((v - 0.07f) / 0.006f, 2)) * 0.8f;
            float panels = Mathf.Pow(Mathf.Abs(Mathf.Sin(u * Mathf.PI * 24f)), 80f) * Smooth(0.62f, 0.66f, v) * 0.5f;
            float hue = Hash(Mathf.Floor(u * 260f), 9f);
            var dotCol = hue < 0.4f ? Palette.StageNeonA : hue < 0.75f ? Palette.StageNeonB : Palette.StageNeonC;
            var c = new Color(baseC * 0.6f, baseC * 0.55f, baseC * 1.2f) + dotCol * dots + Palette.StageNeonA * band * 0.9f + Palette.StageNeonB * panels;
            c.a = 1;
            return c;
        }, true, TextureWrapMode.Repeat);

        /// <summary>Hologram display content: anatomical figure with highlighted muscles + UI frame.</summary>
        public static Texture2D AnatomyDisplay(int size, int variant) => Make("anat" + size + "_" + variant, size / 2, size / 2, (u, v) =>
        {
            var p = new Vector2((u - 0.5f) * 2f, (v - 0.5f) * 2f);
            float frame = (Mathf.Abs(p.x) > 0.94f || Mathf.Abs(p.y) > 0.94f) ? 0.8f : 0f;
            float corner = (Mathf.Abs(p.x) > 0.8f && Mathf.Abs(p.y) > 0.8f && (Mathf.Abs(p.x) > 0.96f || Mathf.Abs(p.y) > 0.96f)) ? 1f : 0f;
            float grid = (Mathf.Repeat(u * 20f, 1f) < 0.04f || Mathf.Repeat(v * 20f, 1f) < 0.04f) ? 0.08f : 0f;

            float body = 0, muscle = 0;
            if (variant == 0)
            {
                // full body figure
                var q = new Vector2(p.x / 0.55f, (p.y + 0.05f) / 0.85f);
                float d = Ellipse(q - new Vector2(0, 0.78f), 0.1f, 0.12f);
                d = Mathf.Min(d, Ellipse(q - new Vector2(0, 0.35f), 0.28f, 0.3f));
                d = Mathf.Min(d, Ellipse(q - new Vector2(0, -0.05f), 0.2f, 0.22f));
                d = Mathf.Min(d, Ellipse(q - new Vector2(-0.38f, 0.25f), 0.08f, 0.32f));
                d = Mathf.Min(d, Ellipse(q - new Vector2(0.38f, 0.25f), 0.08f, 0.32f));
                d = Mathf.Min(d, Ellipse(q - new Vector2(-0.13f, -0.55f), 0.1f, 0.42f));
                d = Mathf.Min(d, Ellipse(q - new Vector2(0.13f, -0.55f), 0.1f, 0.42f));
                body = Mathf.Exp(-Mathf.Pow(d / 0.012f, 2)) + (d < 0 ? 0.18f : 0);
                float ms = Ellipse(q - new Vector2(-0.3f, 0.5f), 0.1f, 0.08f); // deltoids
                ms = Mathf.Min(ms, Ellipse(q - new Vector2(0.3f, 0.5f), 0.1f, 0.08f));
                ms = Mathf.Min(ms, Ellipse(q - new Vector2(-0.11f, 0.42f), 0.1f, 0.07f)); // pecs
                ms = Mathf.Min(ms, Ellipse(q - new Vector2(0.11f, 0.42f), 0.1f, 0.07f));
                ms = Mathf.Min(ms, Ellipse(q - new Vector2(-0.13f, -0.38f), 0.08f, 0.2f)); // quads
                ms = Mathf.Min(ms, Ellipse(q - new Vector2(0.13f, -0.38f), 0.08f, 0.2f));
                muscle = ms < 0 ? 0.9f * (0.6f + 0.4f * Mathf.Abs(Mathf.Sin(p.x * 60f + p.y * 20f))) : 0f;
            }
            else
            {
                // shoulder close-up: humerus + deltoid fibres
                var q = p;
                float bone = Ellipse(q - new Vector2(0.1f, -0.1f), 0.1f, 0.55f);
                bone = Mathf.Min(bone, Ellipse(q - new Vector2(0.05f, 0.45f), 0.2f, 0.17f));
                body = Mathf.Exp(-Mathf.Pow(bone / 0.012f, 2)) + (bone < 0 ? 0.25f : 0);
                float delt = Ellipse(q - new Vector2(-0.05f, 0.3f), 0.42f, 0.38f);
                muscle = delt < 0 && bone > 0 ? 0.85f * (0.5f + 0.5f * Mathf.Abs(Mathf.Sin((p.x * 0.6f + p.y) * 40f))) : 0f;
            }

            var c = Palette.Nerve * (frame + corner + grid + body) + Palette.Muscle * muscle * 1.4f;
            c.a = Mathf.Clamp01(frame + corner + grid + body + muscle);
            return c;
        });

        /// <summary>Banner texture: "MUSCLE BATTLE" style vertical banner with flexing emblem.</summary>
        public static Texture2D Banner(int size) => Make("banner" + size, size / 4, size / 2, (u, v) =>
        {
            var baseC = Color.Lerp(new Color(0.55f, 0.08f, 0.3f), new Color(0.85f, 0.15f, 0.4f), v);
            float edge = (u < 0.06f || u > 0.94f) ? 0.4f : 0f;
            float em = Emblem(new Vector2((u - 0.5f) * 2.4f, (v - 0.62f) * 2.4f * 2f)) * 0.9f;
            var c = baseC * (0.75f + edge) + Color.white * em * 0.8f;
            float cut = v < 0.08f ? (Mathf.Abs(u - 0.5f) * 2 > v / 0.08f ? 0 : 1) : 1; // swallow tail
            c.a = cut;
            return c;
        });

        // ---------------- anatomy card renders ----------------
        /// <summary>
        /// Small posterior view of the right shoulder with ONE muscle highlighted (red fibre energy),
        /// bone in white/gold, body outline in cyan - the MUSCLE BATTLE visual language (§13).
        /// Shapes are schematic (location teaching), not measured anatomical coordinates.
        /// </summary>
        public static Texture2D MuscleIcon(string key) => Make("muscle_" + key, 128, 128, (u, v) =>
        {
            bool Body(float x, float y)
            {
                float top = x < 0.18f ? 0.9f : Mathf.Lerp(0.88f, 0.74f, (x - 0.18f) / 0.54f);
                bool torso = x > 0.02f && x < 0.68f && y > 0.02f && y < top;
                bool neck = x > 0.04f && x < 0.2f && y < 0.98f;
                bool arm = SegDist(new Vector2(x, y), new Vector2(0.78f, 0.66f), new Vector2(0.84f, 0.06f)) < 0.105f;
                bool cap = Vector2.Distance(new Vector2(x, y), new Vector2(0.74f, 0.68f)) < 0.11f;
                return torso || neck || arm || cap;
            }
            var p = new Vector2(u, v);
            const float e = 1.5f / 128f;
            bool inside = Body(u, v);
            bool edge = inside != Body(u + e, v) || inside != Body(u - e, v) || inside != Body(u, v + e) || inside != Body(u, v - e);

            // scapula + spine of scapula + humerus (bone)
            var sup = new Vector2(0.28f, 0.74f); var inf = new Vector2(0.33f, 0.3f); var lat = new Vector2(0.68f, 0.64f);
            float bone = Mathf.Min(SegDist(p, sup, inf), Mathf.Min(SegDist(p, inf, lat), SegDist(p, lat, sup)));
            bone = Mathf.Min(bone, SegDist(p, new Vector2(0.3f, 0.66f), new Vector2(0.75f, 0.72f)));
            bone = Mathf.Min(bone, SegDist(p, new Vector2(0.79f, 0.62f), new Vector2(0.83f, 0.12f)));
            float boneA = 1f - Smooth(0.006f, 0.014f, bone);

            float m = 0; float angle = 0;
            switch (key)
            {
                case "supraspinatus": m = RotEllipse(p, new Vector2(0.5f, 0.715f), 0.21f, 0.04f, 8f); angle = 8f; break;
                case "deltoid": m = RotEllipse(p, new Vector2(0.775f, 0.6f), 0.105f, 0.18f, -6f); angle = 84f; break;
                case "teres_major": m = RotEllipse(p, new Vector2(0.6f, 0.44f), 0.21f, 0.055f, 18f); angle = 18f; break;
                case "latissimus": m = Mathf.Max(RotEllipse(p, new Vector2(0.38f, 0.22f), 0.33f, 0.17f, 22f), RotEllipse(p, new Vector2(0.68f, 0.44f), 0.14f, 0.04f, 35f)); angle = 28f; break;
            }
            float rad = angle * Mathf.Deg2Rad;
            float along = -Mathf.Sin(rad) * u + Mathf.Cos(rad) * v;
            float fiber = 0.65f + 0.35f * Mathf.Abs(Mathf.Sin(along * 140f));

            var c = new Color(0, 0, 0, 0);
            if (inside) c = new Color(Palette.Nerve.r * 0.25f, Palette.Nerve.g * 0.25f, Palette.Nerve.b * 0.35f, 0.55f);
            if (m > 0)
            {
                var mc = Color.Lerp(Palette.Muscle, Palette.MuscleHot, (1 - m) * 0.8f) * fiber;
                c = Color.Lerp(c, new Color(mc.r, mc.g, mc.b, 1f), Mathf.Clamp01(m * 4f));
            }
            if (boneA > 0) c = Color.Lerp(c, new Color(Palette.Bone.r, Palette.Bone.g * 0.95f, Palette.Bone.b * 0.8f, 1f), boneA * 0.85f);
            if (edge) c = new Color(Palette.Nerve.r, Palette.Nerve.g, Palette.Nerve.b, 1f);
            return c;
        });

        static float SegDist(Vector2 p, Vector2 a, Vector2 b)
        {
            var ab = b - a;
            float t = Mathf.Clamp01(Vector2.Dot(p - a, ab) / ab.sqrMagnitude);
            return Vector2.Distance(p, a + ab * t);
        }

        /// <summary>0 outside, rising to 1 at the centre of a rotated ellipse.</summary>
        static float RotEllipse(Vector2 p, Vector2 c, float rx, float ry, float deg)
        {
            float r = -deg * Mathf.Deg2Rad;
            var d = p - c;
            var q = new Vector2(d.x * Mathf.Cos(r) - d.y * Mathf.Sin(r), d.x * Mathf.Sin(r) + d.y * Mathf.Cos(r));
            float k = new Vector2(q.x / rx, q.y / ry).magnitude;
            return Mathf.Clamp01(1f - k);
        }

        static float Hash(float x, float y)
        {
            float h = Mathf.Sin(x * 127.1f + y * 311.7f) * 43758.5453f;
            return h - Mathf.Floor(h);
        }
    }
}
