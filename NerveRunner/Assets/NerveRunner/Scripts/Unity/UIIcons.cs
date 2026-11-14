// NERVE RUNNER 2.0 - generated UI icons and glossy round button art (concept art ⑤):
// glossy candy-like circles (tinted per button) + white pictograms: left/right arrows,
// lightning (boost), drift swirl, up arrow (jump), clock (timer), coin. No image files.
using System.Collections.Generic;
using UnityEngine;

namespace NerveRunner
{
    public enum Icon { Left, Right, Bolt, Drift, Jump, Clock, Coin, Pause }

    public static class UIIcons
    {
        static Sprite glossy;
        static readonly Dictionary<Icon, Sprite> cache = new Dictionary<Icon, Sprite>();
        const int S = 128;

        /// Grayscale glossy disc: darker bottom, rim, and a soft highlight on top. Tint with Image.color.
        public static Sprite GlossyCircle
        {
            get
            {
                if (glossy != null) return glossy;
                var t = new Texture2D(S, S, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp };
                var px = new Color[S * S];
                for (int y = 0; y < S; y++)
                    for (int x = 0; x < S; x++)
                    {
                        float u = (x + 0.5f) / S * 2f - 1f, v = (y + 0.5f) / S * 2f - 1f;
                        float d = Mathf.Sqrt(u * u + v * v);
                        float a = Mathf.Clamp01((1f - d) * S * 0.5f);                       // anti-aliased edge
                        float shade = Mathf.Lerp(0.62f, 1f, (v + 1f) * 0.5f);              // lighter at the top
                        float rim = Mathf.SmoothStep(0.86f, 0.98f, d) * 0.35f;              // darker rim
                        float hu = u / 0.62f, hv = (v - 0.45f) / 0.32f;                     // top highlight ellipse
                        float hl = Mathf.Clamp01(1f - (hu * hu + hv * hv)) * 0.55f;
                        float g = Mathf.Clamp01(shade - rim + hl);
                        px[y * S + x] = new Color(g, g, g, a);
                    }
                t.SetPixels(px); t.Apply();
                glossy = Sprite.Create(t, new Rect(0, 0, S, S), new Vector2(0.5f, 0.5f), 100f);
                return glossy;
            }
        }

        public static Sprite Get(Icon icon)
        {
            Sprite sp;
            if (cache.TryGetValue(icon, out sp) && sp != null) return sp;
            var polys = new List<Vector2[]>();
            var strokes = new List<Vector2[]>();
            switch (icon)
            {
                case Icon.Left:  polys.Add(new[] { V(0.30f, 0.50f), V(0.66f, 0.26f), V(0.66f, 0.74f) }); break;
                case Icon.Right: polys.Add(new[] { V(0.70f, 0.50f), V(0.34f, 0.74f), V(0.34f, 0.26f) }); break;
                case Icon.Bolt:  polys.Add(new[] { V(0.56f, 0.88f), V(0.28f, 0.46f), V(0.47f, 0.46f), V(0.40f, 0.12f), V(0.72f, 0.56f), V(0.53f, 0.56f) }); break;
                case Icon.Jump:  polys.Add(new[] { V(0.50f, 0.84f), V(0.80f, 0.52f), V(0.60f, 0.52f), V(0.60f, 0.18f), V(0.40f, 0.18f), V(0.40f, 0.52f), V(0.20f, 0.52f) }); break;
                case Icon.Pause: polys.Add(new[] { V(0.32f, 0.22f), V(0.44f, 0.22f), V(0.44f, 0.78f), V(0.32f, 0.78f) });
                                 polys.Add(new[] { V(0.56f, 0.22f), V(0.68f, 0.22f), V(0.68f, 0.78f), V(0.56f, 0.78f) }); break;
                case Icon.Drift:
                    // two curved chevrons (skid marks / swirl)
                    strokes.Add(Arc(0.50f, 0.38f, 0.30f, 200f, 340f));
                    strokes.Add(Arc(0.50f, 0.60f, 0.22f, 200f, 340f));
                    polys.Add(new[] { V(0.80f, 0.40f), V(0.86f, 0.22f), V(0.68f, 0.28f) });
                    break;
                case Icon.Clock:
                    strokes.Add(Arc(0.5f, 0.5f, 0.34f, 0f, 360f));
                    strokes.Add(new[] { V(0.5f, 0.5f), V(0.5f, 0.74f) });
                    strokes.Add(new[] { V(0.5f, 0.5f), V(0.68f, 0.42f) });
                    break;
                case Icon.Coin:
                    strokes.Add(Arc(0.5f, 0.5f, 0.36f, 0f, 360f));
                    polys.Add(Star(0.5f, 0.5f, 0.24f, 0.1f));
                    break;
            }
            var t = new Texture2D(S, S, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp };
            var px = new Color[S * S];
            const int SS = 3;   // supersampling
            for (int y = 0; y < S; y++)
                for (int x = 0; x < S; x++)
                {
                    int hit = 0;
                    for (int sy = 0; sy < SS; sy++)
                        for (int sx = 0; sx < SS; sx++)
                        {
                            Vector2 p = new Vector2((x + (sx + 0.5f) / SS) / S, (y + (sy + 0.5f) / SS) / S);
                            bool inside = false;
                            foreach (var poly in polys) if (Inside(poly, p)) { inside = true; break; }
                            if (!inside) foreach (var st in strokes) if (NearStroke(st, p, 0.055f)) { inside = true; break; }
                            if (inside) hit++;
                        }
                    float a = hit / (float)(SS * SS);
                    px[y * S + x] = new Color(1f, 1f, 1f, a);
                }
            t.SetPixels(px); t.Apply();
            sp = Sprite.Create(t, new Rect(0, 0, S, S), new Vector2(0.5f, 0.5f), 100f);
            cache[icon] = sp;
            return sp;
        }

        static Vector2 V(float x, float y) { return new Vector2(x, y); }

        static Vector2[] Arc(float cx, float cy, float r, float a0, float a1)
        {
            int n = 24;
            var l = new Vector2[n + 1];
            for (int i = 0; i <= n; i++)
            {
                float a = Mathf.Lerp(a0, a1, i / (float)n) * Mathf.Deg2Rad;
                l[i] = new Vector2(cx + Mathf.Cos(a) * r, cy + Mathf.Sin(a) * r);
            }
            return l;
        }

        static Vector2[] Star(float cx, float cy, float ro, float ri)
        {
            var l = new Vector2[10];
            for (int i = 0; i < 10; i++)
            {
                float a = Mathf.PI / 2f + i * Mathf.PI / 5f;
                float r = i % 2 == 0 ? ro : ri;
                l[i] = new Vector2(cx + Mathf.Cos(a) * r, cy + Mathf.Sin(a) * r);
            }
            return l;
        }

        static bool Inside(Vector2[] poly, Vector2 p)
        {
            bool c = false;
            for (int i = 0, j = poly.Length - 1; i < poly.Length; j = i++)
                if (((poly[i].y > p.y) != (poly[j].y > p.y)) &&
                    (p.x < (poly[j].x - poly[i].x) * (p.y - poly[i].y) / (poly[j].y - poly[i].y) + poly[i].x)) c = !c;
            return c;
        }

        static bool NearStroke(Vector2[] st, Vector2 p, float w)
        {
            for (int i = 0; i < st.Length - 1; i++)
            {
                Vector2 a = st[i], b = st[i + 1], ab = b - a;
                float t = Mathf.Clamp01(Vector2.Dot(p - a, ab) / Mathf.Max(1e-6f, ab.sqrMagnitude));
                if ((a + ab * t - p).sqrMagnitude < w * w) return true;
            }
            return false;
        }
    }
}
