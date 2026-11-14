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
            for (int tries = 0; tries < 900 && placed < 60; tries++)
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
            StaticBatchingUtility.Combine(root.gameObject);
            return root;
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
