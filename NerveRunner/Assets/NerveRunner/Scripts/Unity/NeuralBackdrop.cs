// NERVE RUNNER - the "inside the nervous system" backdrop: dark navy/purple void, fog, and
// glowing neurons (soma + branching dendrites) scattered around the course. Static-batched.
using NeonRacer;
using NerveRunner.Core;
using UnityEngine;

namespace NerveRunner
{
    public static class NeuralBackdrop
    {
        public static readonly Color Fog = Pal.Hex(0x120B33);

        public static void ApplyAtmosphere(Camera cam)
        {
            RenderSettings.fog = true;
            RenderSettings.fogColor = Fog;
            RenderSettings.fogMode = FogMode.Linear;
            RenderSettings.fogStartDistance = 90f;
            RenderSettings.fogEndDistance = 520f;
            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = Pal.Hex(0x3B2A8A);
            RenderSettings.ambientEquatorColor = Pal.Hex(0x2A2066);
            RenderSettings.ambientGroundColor = Pal.Hex(0x0E0A26);
            RenderSettings.skybox = null;
            if (cam != null)
            {
                cam.clearFlags = CameraClearFlags.SolidColor;
                cam.backgroundColor = Fog;
                cam.farClipPlane = 560f;
                cam.nearClipPlane = 0.3f;
            }
        }

        public static Transform Build(Transform parent, TrackGraph g, int seed)
        {
            var root = new GameObject("NeuralBackdrop").transform;
            root.SetParent(parent, false);
            var rnd = new System.Random(seed);

            // course bounds
            Vector3 min = new Vector3(float.MaxValue, 0, float.MaxValue), max = new Vector3(float.MinValue, 0, float.MinValue);
            foreach (var s in g.segments)
                for (float d = 0; d < s.length; d += 20f)
                {
                    var p = s.PointAt(d);
                    min.x = Mathf.Min(min.x, p.x); min.z = Mathf.Min(min.z, p.z);
                    max.x = Mathf.Max(max.x, p.x); max.z = Mathf.Max(max.z, p.z);
                }
            min -= new Vector3(180f, 0, 180f); max += new Vector3(180f, 0, 180f);

            Color[] palette = { Pal.Hex(0x9B5CFF), Pal.Hex(0x4D8DFF), Pal.Hex(0xFF5CC8), Pal.Hex(0x2EE6D6) };
            int placed = 0;
            for (int tries = 0; tries < 900 && placed < Gfx.BackdropNeurons; tries++)
            {
                var pos = new Vector3(Mathf.Lerp(min.x, max.x, (float)rnd.NextDouble()),
                                      (float)rnd.NextDouble() * 90f - 45f,
                                      Mathf.Lerp(min.z, max.z, (float)rnd.NextDouble()));
                if (DistanceToTrack(g, pos) < 55f) continue;
                Color c = palette[rnd.Next(palette.Length)];
                Neuron(root, pos, c, rnd);
                placed++;
            }
            // floor of faint synaptic sparks far below
            var sparkMat = Mats.Emissive(Pal.Hex(0x221860), Pal.Hex(0x6E5CFF) * 0.8f);
            for (int i = 0; i < 160; i++)
            {
                var p = new Vector3(Mathf.Lerp(min.x, max.x, (float)rnd.NextDouble()), -60f - (float)rnd.NextDouble() * 40f, Mathf.Lerp(min.z, max.z, (float)rnd.NextDouble()));
                MeshKit.Prim(PrimitiveType.Cube, root, p, Vector3.one * (0.6f + (float)rnd.NextDouble() * 1.4f), sparkMat, "Spark");
            }
            SetLayer(root, Gfx.PropsLayer);
            StaticBatchingUtility.Combine(root.gameObject);
            return root;
        }

        /// Title-screen brain silhouette (concept art 4): two glowing hemispheres covered in gyri
        /// rings, cerebellum and brain stem. Decorative only; shown behind STAR-01 on the title.
        public static Transform BuildBrain(Transform parent)
        {
            var root = new GameObject("TitleBrain").transform;
            root.SetParent(parent, false);
            var body = NRMats.Toon(Pal.Hex(0x3A2A8A), Pal.Hex(0x150E40), Pal.Hex(0xB98CFF), 1.8f, Pal.Hex(0x1A1050));
            var gyri = Mats.Emissive(Pal.Hex(0x4A3AA8), Pal.Hex(0x8C7CFF) * 1.3f);
            var rnd = new System.Random(4);
            var ringMesh = MeshKit.Torus(1f, 0.08f, 24, 4);
            foreach (float side in new[] { -1f, 1f })
            {
                Vector3 c = new Vector3(side * 9.5f, 0f, 0f);
                Vector3 sc = new Vector3(18f, 26f, 44f);
                MeshKit.Prim(PrimitiveType.Sphere, root, c, sc, body, "Hemisphere");
                for (int i = 0; i < 46; i++)
                {
                    Vector3 n = new Vector3((float)rnd.NextDouble() * 2f - 1f, (float)rnd.NextDouble() * 1.6f - 0.4f, (float)rnd.NextDouble() * 2f - 1f).normalized;
                    if (n.x * side < -0.2f) continue;                            // keep the gyri on the outer side
                    Vector3 pos = c + Vector3.Scale(n, sc * 0.5f) * 1.01f;
                    var g = MeshKit.MeshObject(root, "Gyrus", ringMesh, gyri);
                    g.transform.localPosition = pos;
                    g.transform.localRotation = Quaternion.LookRotation(n) * Quaternion.Euler(0f, 0f, (float)rnd.NextDouble() * 180f);
                    g.transform.localScale = new Vector3(3f + (float)rnd.NextDouble() * 4f, 1.2f + (float)rnd.NextDouble() * 1.5f, 1f);
                }
            }
            MeshKit.Prim(PrimitiveType.Sphere, root, new Vector3(0f, -10f, -18f), new Vector3(20f, 10f, 12f), body, "Cerebellum");
            MeshKit.Prim(PrimitiveType.Cylinder, root, new Vector3(0f, -16f, -10f), new Vector3(5f, 9f, 5f), body, "BrainStem");
            return root;
        }

        public static void SetLayer(Transform t, int layer)
        {
            t.gameObject.layer = layer;
            for (int i = 0; i < t.childCount; i++) SetLayer(t.GetChild(i), layer);
        }

        static float DistanceToTrack(TrackGraph g, Vector3 p)
        {
            float best = float.MaxValue;
            foreach (var s in g.segments)
                for (float d = 0; d < s.length; d += 25f)
                {
                    var q = s.PointAt(d);
                    float dist = (new Vector3(q.x - p.x, (q.y - p.y) * 0.5f, q.z - p.z)).magnitude;
                    if (dist < best) best = dist;
                }
            return best;
        }

        static void Neuron(Transform root, Vector3 pos, Color c, System.Random rnd)
        {
            var n = new GameObject("Neuron").transform;
            n.SetParent(root, false);
            n.position = pos;
            float size = 3f + (float)rnd.NextDouble() * 5f;
            var somaMat = Mats.Emissive(c * 0.35f, c * 1.6f);
            var dendMat = Mats.Emissive(c * 0.2f, c * 0.9f);
            MeshKit.Prim(PrimitiveType.Sphere, n, Vector3.zero, Vector3.one * size, somaMat, "Soma");
            int arms = 5 + rnd.Next(4);
            for (int a = 0; a < arms; a++)
            {
                Vector3 dir = new Vector3((float)rnd.NextDouble() * 2 - 1, (float)rnd.NextDouble() * 1.4f - 0.7f, (float)rnd.NextDouble() * 2 - 1).normalized;
                Branch(n, dir * size * 0.4f, dir, size * (2.2f + (float)rnd.NextDouble() * 2.5f), size * 0.16f, 1, dendMat, rnd);
            }
        }

        static void Branch(Transform parent, Vector3 start, Vector3 dir, float len, float thick, int depth, Material mat, System.Random rnd)
        {
            var b = MeshKit.Prim(PrimitiveType.Cylinder, parent, start + dir * len * 0.5f, new Vector3(thick, len * 0.5f, thick), mat, "Dendrite");
            b.transform.localRotation = Quaternion.FromToRotation(Vector3.up, dir);
            if (depth <= 0) return;
            Vector3 end = start + dir * len;
            for (int i = 0; i < 2; i++)
            {
                Vector3 nd = (dir + new Vector3((float)rnd.NextDouble() - 0.5f, (float)rnd.NextDouble() - 0.5f, (float)rnd.NextDouble() - 0.5f) * 1.3f).normalized;
                Branch(parent, end, nd, len * 0.6f, thick * 0.6f, depth - 1, mat, rnd);
            }
        }
    }
}
