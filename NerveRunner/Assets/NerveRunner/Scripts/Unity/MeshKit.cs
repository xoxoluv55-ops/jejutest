// NERVE RUNNER - procedural meshes (no imported models): puffy star, torus, track ribbons.
// The ribbon generator follows Neon Racer's TrackBuilder.Ribbon (MIT) - a strip of quads
// sampled along a spline - extended with a vertical wall variant and a road-relative frame.
using System.Collections.Generic;
using NerveRunner.Core;
using UnityEngine;

namespace NerveRunner
{
    public static class MeshKit
    {
        /// When set, every generated mesh is added here so its owner can Destroy() it later
        /// (track rebuilds on "retry" would otherwise leak meshes on the iPad).
        public static List<Mesh> Sink;
        static Mesh Own(Mesh m) { if (Sink != null) Sink.Add(m); return m; }
        /// Registers a mesh built elsewhere with the current Sink (no-op if already registered).
        public static Mesh Track(Mesh m) { if (Sink != null && m != null && !Sink.Contains(m)) Sink.Add(m); return m; }

        /// Fixes triangle winding so each triangle faces `desired` (front face = cross(b-a, c-a)).
        static void Tri(List<int> tris, List<Vector3> v, int a, int b, int c, Vector3 desired)
        {
            Vector3 n = Vector3.Cross(v[b] - v[a], v[c] - v[a]);
            if (Vector3.Dot(n, desired) >= 0f) { tris.Add(a); tris.Add(b); tris.Add(c); }
            else { tris.Add(a); tris.Add(c); tris.Add(b); }
        }

        /// Star outline radius at angle t (radians); tip 0 points to +Y.
        public static float StarRadius(float t, float rOut, float rIn)
        {
            float c = 0.5f + 0.5f * Mathf.Cos(5f * (t - Mathf.PI * 0.5f));
            return rIn + (rOut - rIn) * Mathf.Pow(c, 1.15f);   // low exponent = chubby, rounded arms
        }

        /// Rounded, puffy five-pointed star. Front (face) side is +Z, thickness along Z.
        public static Mesh PuffyStar(float rOut = 1f, float rIn = 0.64f, float thick = 0.46f, int ang = 120, int rings = 10)
        {
            var v = new List<Vector3>();
            var tris = new List<int>();
            for (int side = 0; side < 2; side++)
            {
                float sz = side == 0 ? 1f : -1f;
                int baseIdx = v.Count;
                v.Add(new Vector3(0f, 0f, sz * thick));
                for (int r = 1; r <= rings; r++)
                {
                    float f = r / (float)rings;
                    float h = Mathf.Sqrt(Mathf.Max(0f, 1f - Mathf.Pow(f, 2.4f)));
                    for (int i = 0; i < ang; i++)
                    {
                        float t = i / (float)ang * Mathf.PI * 2f;
                        float rad = StarRadius(t, rOut, rIn) * f;
                        v.Add(new Vector3(Mathf.Cos(t) * rad, Mathf.Sin(t) * rad, sz * thick * h));
                    }
                }
                Vector3 want = new Vector3(0f, 0f, sz);
                for (int i = 0; i < ang; i++)
                {
                    int i1 = (i + 1) % ang;
                    Tri(tris, v, baseIdx, baseIdx + 1 + i, baseIdx + 1 + i1, want);
                }
                for (int r = 1; r < rings; r++)
                {
                    int r0 = baseIdx + 1 + (r - 1) * ang, r1 = baseIdx + 1 + r * ang;
                    for (int i = 0; i < ang; i++)
                    {
                        int i1 = (i + 1) % ang;
                        // outward-ish normal for winding check
                        Vector3 mid = (v[r0 + i] + v[r1 + i1]) * 0.5f;
                        Vector3 w = new Vector3(mid.x * 0.3f, mid.y * 0.3f, sz);
                        Tri(tris, v, r0 + i, r1 + i, r1 + i1, w);
                        Tri(tris, v, r0 + i, r1 + i1, r0 + i1, w);
                    }
                }
            }
            var m = Own(new Mesh { name = "PuffyStar" });
            m.SetVertices(v); m.SetTriangles(tris, 0);
            m.RecalculateNormals(); m.RecalculateBounds();
            return m;
        }

        /// Flat star (for UI-like glow cards / decals).
        public static Mesh Torus(float radius, float tube, int seg = 40, int side = 8)
        {
            var v = new List<Vector3>();
            var tris = new List<int>();
            for (int i = 0; i <= seg; i++)
            {
                float a = i / (float)seg * Mathf.PI * 2f;
                Vector3 c = new Vector3(Mathf.Cos(a), Mathf.Sin(a), 0f) * radius;
                for (int j = 0; j <= side; j++)
                {
                    float b = j / (float)side * Mathf.PI * 2f;
                    Vector3 dir = new Vector3(Mathf.Cos(a) * Mathf.Cos(b), Mathf.Sin(a) * Mathf.Cos(b), Mathf.Sin(b));
                    v.Add(c + dir * tube);
                }
            }
            int row = side + 1;
            for (int i = 0; i < seg; i++)
                for (int j = 0; j < side; j++)
                {
                    int a0 = i * row + j, a1 = a0 + 1, b0 = a0 + row, b1 = b0 + 1;
                    Vector3 outward = v[a0] - new Vector3(Mathf.Cos(i / (float)seg * Mathf.PI * 2f), Mathf.Sin(i / (float)seg * Mathf.PI * 2f), 0f) * radius;
                    Tri(tris, v, a0, b0, b1, outward);
                    Tri(tris, v, a0, b1, a1, outward);
                }
            var m = Own(new Mesh { name = "Torus" });
            m.SetVertices(v); m.SetTriangles(tris, 0);
            m.RecalculateNormals(); m.RecalculateBounds();
            return m;
        }

        /// Flat strip between lateral offsets x0..x1 along a segment, from s0 to s1.
        /// UV: u across (0..1), v along (metres / vScale).
        public static Mesh Ribbon(TrackSegment seg, float s0, float s1, float x0, float x1, float y, float vScale, float step = 2f)
        {
            int n = Mathf.Max(1, Mathf.CeilToInt((s1 - s0) / step));
            var v = new Vector3[(n + 1) * 2];
            var uv = new Vector2[(n + 1) * 2];
            var nm = new Vector3[(n + 1) * 2];
            var tris = new int[n * 12];
            for (int i = 0; i <= n; i++)
            {
                float s = Mathf.Lerp(s0, s1, i / (float)n);
                Vector3 p = seg.PointAt(s), r = seg.RightAt(s);
                v[i * 2] = p + r * x0 + Vector3.up * y;
                v[i * 2 + 1] = p + r * x1 + Vector3.up * y;
                uv[i * 2] = new Vector2(0f, s / vScale);
                uv[i * 2 + 1] = new Vector2(1f, s / vScale);
                nm[i * 2] = Vector3.up; nm[i * 2 + 1] = Vector3.up;
            }
            // double-sided: both windings (the road is seen from above, but jumps/arches can
            // show it from the side)
            int t = 0;
            for (int i = 0; i < n; i++)
            {
                int a = i * 2;
                tris[t++] = a; tris[t++] = a + 2; tris[t++] = a + 1;
                tris[t++] = a + 1; tris[t++] = a + 2; tris[t++] = a + 3;
                tris[t++] = a; tris[t++] = a + 1; tris[t++] = a + 2;
                tris[t++] = a + 1; tris[t++] = a + 3; tris[t++] = a + 2;
            }
            var m = Own(new Mesh { name = "Ribbon" });
            m.vertices = v; m.uv = uv; m.normals = nm; m.triangles = tris;
            m.RecalculateBounds();
            return m;
        }

        /// Vertical glowing wall at lateral offset x, height h (double-sided).
        public static Mesh Wall(TrackSegment seg, float s0, float s1, float x, float y0, float h, float step = 3f)
        {
            int n = Mathf.Max(1, Mathf.CeilToInt((s1 - s0) / step));
            var v = new Vector3[(n + 1) * 2];
            var nm = new Vector3[(n + 1) * 2];
            var tris = new int[n * 12];
            for (int i = 0; i <= n; i++)
            {
                float s = Mathf.Lerp(s0, s1, i / (float)n);
                Vector3 p = seg.PointAt(s) + seg.RightAt(s) * x;
                v[i * 2] = p + Vector3.up * y0;
                v[i * 2 + 1] = p + Vector3.up * (y0 + h);
                nm[i * 2] = nm[i * 2 + 1] = -seg.RightAt(s) * Mathf.Sign(x);
            }
            int t = 0;
            for (int i = 0; i < n; i++)
            {
                int a = i * 2;
                tris[t++] = a; tris[t++] = a + 1; tris[t++] = a + 2;
                tris[t++] = a + 1; tris[t++] = a + 3; tris[t++] = a + 2;
                tris[t++] = a; tris[t++] = a + 2; tris[t++] = a + 1;
                tris[t++] = a + 1; tris[t++] = a + 2; tris[t++] = a + 3;
            }
            var m = Own(new Mesh { name = "Wall" });
            m.vertices = v; m.normals = nm; m.triangles = tris;
            m.RecalculateBounds();
            return m;
        }

        public static GameObject MeshObject(Transform parent, string name, Mesh mesh, Material mat)
        {
            var g = new GameObject(name);
            g.transform.SetParent(parent, false);
            g.AddComponent<MeshFilter>().sharedMesh = mesh;
            var r = g.AddComponent<MeshRenderer>();
            r.sharedMaterial = mat;
            r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            r.receiveShadows = false;
            return g;
        }

        /// Primitive without collider (all gameplay collision is in the simulation).
        public static GameObject Prim(PrimitiveType type, Transform parent, Vector3 localPos, Vector3 scale, Material mat, string name = null)
        {
            var g = GameObject.CreatePrimitive(type);
            var col = g.GetComponent<Collider>();
            if (col != null) Object.Destroy(col);
            if (name != null) g.name = name;
            g.transform.SetParent(parent, false);
            g.transform.localPosition = localPos;
            g.transform.localScale = scale;
            var r = g.GetComponent<MeshRenderer>();
            r.sharedMaterial = mat;
            r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            r.receiveShadows = false;
            return g;
        }

        //================== TEXTURES ==================\\
        /// Dark road with neon edge lines, dashed centre and chevrons (emission map).
        public static Texture2D RoadTexture(Color line, Color baseCol)
        {
            const int W = 128, H = 128;
            var tex = new Texture2D(W, H, TextureFormat.RGBA32, true);
            tex.wrapMode = TextureWrapMode.Repeat;
            var px = new Color[W * H];
            for (int y = 0; y < H; y++)
                for (int x = 0; x < W; x++)
                {
                    float u = x / (float)W, vv = y / (float)H;
                    Color c = baseCol;
                    // hex-ish cell pattern (neural membrane)
                    float cell = Mathf.Abs(Mathf.Sin(u * 18f) * Mathf.Sin(vv * 9f));
                    c = Color.Lerp(c, line * 0.25f, cell > 0.97f ? 0.6f : 0f);
                    if (u < 0.035f || u > 0.965f) c = line;                                   // edges
                    else if (Mathf.Abs(u - 0.5f) < 0.012f && vv % 0.5f < 0.28f) c = line * 0.8f; // dashed centre
                    float chev = Mathf.Abs(vv - 0.25f - Mathf.Abs(u - 0.5f) * 0.35f);
                    if (chev < 0.018f && Mathf.Abs(u - 0.5f) > 0.1f && Mathf.Abs(u - 0.5f) < 0.4f) c = Color.Lerp(c, line, 0.55f);
                    c.a = 1f;
                    px[y * W + x] = c;
                }
            tex.SetPixels(px); tex.Apply(true);
            return tex;
        }

        public static Texture2D Checker()
        {
            var tex = new Texture2D(16, 4, TextureFormat.RGBA32, false);
            tex.filterMode = FilterMode.Point;
            for (int y = 0; y < 4; y++) for (int x = 0; x < 16; x++)
                    tex.SetPixel(x, y, ((x / 2 + y / 2) % 2 == 0) ? Color.white : new Color(0.1f, 0.05f, 0.2f));
            tex.Apply();
            return tex;
        }
    }
}
