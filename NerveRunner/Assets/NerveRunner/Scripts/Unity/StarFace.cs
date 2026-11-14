// NERVE RUNNER 2.0 - STAR-01 face kit: expression shapes (happy ^ ^ eyes, > < eyes, sparkle
// eyes, brows, tears, mouths) generated as thin decal meshes that sit ON the curved surface of
// the puffy star, so they stay readable at an angle. Body-local units (before body scale).
using System.Collections.Generic;
using NeonRacer;
using UnityEngine;

namespace NerveRunner
{
    public static class StarFace
    {
        public const float R_IN = 0.64f, THICK = 0.46f;

        /// Height of the puffy star's front surface at body-local (x, y) - same formula as MeshKit.PuffyStar.
        public static float SurfaceZ(float x, float y)
        {
            float r = Mathf.Sqrt(x * x + y * y);
            float a = Mathf.Atan2(y, x);
            float rr = MeshKit.StarRadius(a, 1f, R_IN);
            float f = Mathf.Clamp01(r / Mathf.Max(0.01f, rr));
            return THICK * Mathf.Sqrt(Mathf.Max(0f, 1f - Mathf.Pow(f, 2.4f)));
        }

        static void Tri(List<int> tris, List<Vector3> v, int a, int b, int c)
        {
            Vector3 n = Vector3.Cross(v[b] - v[a], v[c] - v[a]);
            if (n.z >= 0f) { tris.Add(a); tris.Add(b); tris.Add(c); }
            else { tris.Add(a); tris.Add(c); tris.Add(b); }
        }

        static Vector3 OnSurface(Vector2 p, float lift) { return new Vector3(p.x, p.y, SurfaceZ(p.x, p.y) + lift); }

        static Mesh Finish(List<Vector3> v, List<int> t, string name)
        {
            var m = new Mesh { name = name };
            m.SetVertices(v); m.SetTriangles(t, 0);
            m.RecalculateNormals(); m.RecalculateBounds();
            return m;
        }

        /// Thick polyline with round caps.
        public static Mesh Stroke(List<Vector2> pts, float width, float lift = 0.012f, string name = "Stroke")
        {
            var v = new List<Vector3>(); var t = new List<int>();
            float hw = width * 0.5f;
            for (int i = 0; i < pts.Count; i++)
            {
                Vector2 a = pts[Mathf.Max(0, i - 1)], b = pts[Mathf.Min(pts.Count - 1, i + 1)];
                Vector2 d = (b - a).normalized;
                Vector2 n = new Vector2(-d.y, d.x) * hw;
                v.Add(OnSurface(pts[i] + n, lift));
                v.Add(OnSurface(pts[i] - n, lift));
                if (i > 0) { int k = i * 2; Tri(t, v, k - 2, k, k - 1); Tri(t, v, k - 1, k, k + 1); }
            }
            Cap(v, t, pts[0], hw, lift);
            Cap(v, t, pts[pts.Count - 1], hw, lift);
            return Finish(v, t, name);
        }

        static void Cap(List<Vector3> v, List<int> t, Vector2 c, float r, float lift)
        {
            int center = v.Count;
            v.Add(OnSurface(c, lift));
            const int N = 10;
            for (int i = 0; i <= N; i++)
            {
                float a = i / (float)N * Mathf.PI * 2f;
                v.Add(OnSurface(c + new Vector2(Mathf.Cos(a), Mathf.Sin(a)) * r, lift));
                if (i > 0) Tri(t, v, center, center + i, center + i + 1);
            }
        }

        /// Filled star-shaped polygon (fan from its centroid).
        public static Mesh Fill(List<Vector2> poly, float lift = 0.012f, string name = "Fill")
        {
            var v = new List<Vector3>(); var t = new List<int>();
            Vector2 c = Vector2.zero;
            foreach (var p in poly) c += p;
            c /= poly.Count;
            v.Add(OnSurface(c, lift));
            for (int i = 0; i < poly.Count; i++) v.Add(OnSurface(poly[i], lift));
            for (int i = 0; i < poly.Count; i++) Tri(t, v, 0, 1 + i, 1 + (i + 1) % poly.Count);
            return Finish(v, t, name);
        }

        //================== SHAPES ==================\\
        public static List<Vector2> Arc(Vector2 c, float rx, float ry, float a0Deg, float a1Deg, int n = 12)
        {
            var l = new List<Vector2>();
            for (int i = 0; i <= n; i++)
            {
                float a = Mathf.Lerp(a0Deg, a1Deg, i / (float)n) * Mathf.Deg2Rad;
                l.Add(c + new Vector2(Mathf.Cos(a) * rx, Mathf.Sin(a) * ry));
            }
            return l;
        }

        public static List<Vector2> Circle(Vector2 c, float rx, float ry, int n = 20) { var l = Arc(c, rx, ry, 0f, 360f, n); l.RemoveAt(l.Count - 1); return l; }

        public static List<Vector2> Twinkle(Vector2 c, float rOut, float rIn)
        {
            var l = new List<Vector2>();
            for (int i = 0; i < 8; i++)
            {
                float a = i * Mathf.PI / 4f + Mathf.PI / 2f;
                float r = i % 2 == 0 ? rOut : rIn;
                l.Add(c + new Vector2(Mathf.Cos(a), Mathf.Sin(a)) * r);
            }
            return l;
        }

        public static List<Vector2> Line(params Vector2[] p) { return new List<Vector2>(p); }

        public static List<Vector2> Wave(Vector2 c, float halfW, float amp, int n = 14)
        {
            var l = new List<Vector2>();
            for (int i = 0; i <= n; i++)
            {
                float u = i / (float)n;
                l.Add(c + new Vector2(Mathf.Lerp(-halfW, halfW, u), Mathf.Sin(u * Mathf.PI * 3f) * amp));
            }
            return l;
        }

        /// Open "D" mouth: flat top, round bottom.
        public static List<Vector2> OpenMouth(Vector2 c, float w, float h)
        {
            var l = new List<Vector2>();
            for (int i = 0; i <= 14; i++)
            {
                float a = Mathf.Lerp(180f, 360f, i / 14f) * Mathf.Deg2Rad;
                l.Add(c + new Vector2(Mathf.Cos(a) * w, Mathf.Sin(a) * h));
            }
            return l;
        }

        public static List<Vector2> Tear(Vector2 tip, float r)
        {
            var l = new List<Vector2> { tip };
            var c = tip + new Vector2(0f, -r * 1.6f);
            for (int i = 1; i < 12; i++)
            {
                float a = Mathf.Lerp(60f, -240f, i / 12f) * Mathf.Deg2Rad;
                l.Add(c + new Vector2(Mathf.Cos(a), Mathf.Sin(a)) * r);
            }
            return l;
        }
    }
}
