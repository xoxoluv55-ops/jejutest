// NERVE RUNNER - CH.9 NULL boss arena (concept art ⑦).
// NULL is NOT a creature: it is a corrupted error signal - a dark core of fractured violet
// circuit shards with a red "glitching heartbeat", inside a hexagon-faceted shield, circled by
// rotating neural-circuit rings above a dark pit. Correct diagnoses crack the shield (BossHit);
// wrong answers and counter-attack sections fire purple pulse waves (BossAttack).
using System.Collections.Generic;
using NeonRacer;
using NerveRunner.Core;
using UnityEngine;

namespace NerveRunner
{
    public class BossArenaView
    {
        Transform root, core, shield, heart;
        readonly List<Transform> rings = new List<Transform>();
        readonly List<Transform> shards = new List<Transform>();
        readonly List<Vector3> shardAxis = new List<Vector3>();
        Material shieldMat, heartMat, heartCalm, coreMat, coreRepaired;
        Transform[] waves = new Transform[3];
        float[] waveT = { -1f, -1f, -1f };
        float t, hitFlash, shieldTarget = 1f, shieldScale = 1f;
        int hp = 1, maxHp = 1;
        Vector3 center;

        public static bool IsArena(TrackGraph g)
        {
            foreach (var s in g.segments) if (s.theme == "boss") return true;
            return false;
        }

        public void Build(TrackGraph g, Transform parent)
        {
            // centre: arena origin at the mean height of the spiral
            float y = 0f; int n = 0;
            foreach (var s in g.segments)
                if (s.theme == "boss") for (float d = 0; d < s.length; d += 20f) { y += s.PointAt(d).y; n++; }
            center = new Vector3(0f, n > 0 ? y / n + 8f : 20f, 0f);

            root = new GameObject("NULL_Arena").transform;
            root.SetParent(parent, false);
            root.position = center;

            // dark pit + circuit spokes far below
            var pitMat = Mats.Emissive(Pal.Hex(0x0A0418), Pal.Hex(0x3A0A30) * 0.6f);
            var pit = MeshKit.Prim(PrimitiveType.Cylinder, root, new Vector3(0f, -center.y - 30f, 0f), new Vector3(300f, 0.5f, 300f), pitMat, "Pit");
            var spokeMat = Mats.Emissive(Pal.Hex(0x3A1060), Pal.Hex(0xB04DFF) * 1.2f);
            for (int i = 0; i < 16; i++)
            {
                float a = i / 16f * 360f;
                var sp = MeshKit.Prim(PrimitiveType.Cube, root, Vector3.zero, new Vector3(0.6f, 0.4f, 140f), spokeMat, "CircuitSpoke");
                sp.transform.localRotation = Quaternion.Euler(0f, a, 0f);
                sp.transform.localPosition = Quaternion.Euler(0f, a, 0f) * new Vector3(0f, -center.y - 29f, 75f);
            }

            // core
            coreMat = NRMats.Toon(Pal.Hex(0x2A0E46), Pal.Hex(0x0A0418), Pal.Hex(0xFF3D8A), 1.6f, Pal.Hex(0x30061E));
            coreRepaired = NRMats.Toon(Pal.Hex(0x9AF6FF), Pal.Hex(0x3AA6C8), Color.white, 1.6f, Pal.Hex(0x1E6F7A));
            core = MeshKit.Prim(PrimitiveType.Sphere, root, Vector3.zero, Vector3.one * 18f, coreMat, "NULL_Core").transform;
            heartMat = Mats.Emissive(Pal.Hex(0xFF2050), Pal.Hex(0xFF2050) * 3f);
            heartCalm = Mats.Emissive(Pal.Hex(0x9FFFF6), Pal.Cyan * 2f);
            heart = MeshKit.Prim(PrimitiveType.Sphere, root, Vector3.zero, Vector3.one * 6f, heartMat, "GlitchHeart").transform;
            var rnd = new System.Random(9);
            var shardMat = NRMats.Toon(Pal.Hex(0x6A2CC8), Pal.Hex(0x1A0838), Pal.Hex(0xFF4DA6), 1.4f, Pal.Hex(0x40107A));
            for (int i = 0; i < 26; i++)
            {
                var sh = MeshKit.Prim(PrimitiveType.Cube, root, Random3(rnd) * (11f + (float)rnd.NextDouble() * 9f),
                                      new Vector3(1f + (float)rnd.NextDouble() * 3f, 0.4f + (float)rnd.NextDouble(), 2f + (float)rnd.NextDouble() * 4f), shardMat, "Shard");
                sh.transform.localRotation = Quaternion.Euler((float)rnd.NextDouble() * 360f, (float)rnd.NextDouble() * 360f, 0f);
                shards.Add(sh.transform);
                shardAxis.Add(Random3(rnd));
            }

            // shield (hexagon-faceted sphere look: low-poly sphere + additive glow)
            shieldMat = NRMats.Additive(new Color(0.75f, 0.3f, 1f, 0.35f), NRMats.Ring) ?? Mats.Emissive(Pal.Hex(0x40107A), Pal.Purple);
            shield = MeshKit.MeshObject(root, "HexShield", MeshKit.Track(LowPolySphere(1f, 2)), shieldMat).transform;
            shield.localScale = Vector3.one * 30f;

            // rotating neural circuit rings
            var ringMat = Mats.Emissive(Pal.Hex(0x4A1A8A), Pal.Hex(0xC07CFF) * 1.6f);
            float[] radii = { 36f, 44f, 52f };
            for (int i = 0; i < radii.Length; i++)
            {
                var r = MeshKit.MeshObject(root, "CircuitRing", MeshKit.Track(MeshKit.Torus(radii[i], 0.35f, 72, 5)), ringMat).transform;
                r.localRotation = Quaternion.Euler(70f + i * 12f, i * 40f, 0f);
                rings.Add(r);
            }

            // attack pulse waves (pooled)
            var waveMat = NRMats.Additive(new Color(0.85f, 0.35f, 1f, 1f), NRMats.Dot) ?? Mats.Emissive(Pal.Purple, Pal.Purple * 2f);
            var waveMesh = MeshKit.Track(MeshKit.Torus(1f, 0.012f, 96, 4));
            for (int i = 0; i < waves.Length; i++)
            {
                var w = MeshKit.MeshObject(root, "NullPulse", waveMesh, waveMat);
                w.transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
                w.SetActive(false);
                waves[i] = w.transform;
            }
        }

        static Vector3 Random3(System.Random r)
        {
            var v = new Vector3((float)r.NextDouble() * 2f - 1f, (float)r.NextDouble() * 2f - 1f, (float)r.NextDouble() * 2f - 1f);
            return v.sqrMagnitude < 1e-4f ? Vector3.up : v.normalized;
        }

        /// Faceted (flat-shaded) icosphere - reads as a hexagon/triangle energy shield.
        static Mesh LowPolySphere(float r, int subdiv)
        {
            float tt = (1f + Mathf.Sqrt(5f)) / 2f;
            var v = new List<Vector3> {
                new Vector3(-1, tt, 0), new Vector3(1, tt, 0), new Vector3(-1, -tt, 0), new Vector3(1, -tt, 0),
                new Vector3(0, -1, tt), new Vector3(0, 1, tt), new Vector3(0, -1, -tt), new Vector3(0, 1, -tt),
                new Vector3(tt, 0, -1), new Vector3(tt, 0, 1), new Vector3(-tt, 0, -1), new Vector3(-tt, 0, 1) };
            var f = new List<int> { 0,11,5, 0,5,1, 0,1,7, 0,7,10, 0,10,11, 1,5,9, 5,11,4, 11,10,2, 10,7,6, 7,1,8,
                                    3,9,4, 3,4,2, 3,2,6, 3,6,8, 3,8,9, 4,9,5, 2,4,11, 6,2,10, 8,6,7, 9,8,1 };
            for (int i = 0; i < v.Count; i++) v[i] = v[i].normalized * r;
            for (int s = 0; s < subdiv; s++)
            {
                var nf = new List<int>();
                for (int i = 0; i < f.Count; i += 3)
                {
                    int a = f[i], b = f[i + 1], c = f[i + 2];
                    int ab = v.Count; v.Add(((v[a] + v[b]) * 0.5f).normalized * r);
                    int bc = v.Count; v.Add(((v[b] + v[c]) * 0.5f).normalized * r);
                    int ca = v.Count; v.Add(((v[c] + v[a]) * 0.5f).normalized * r);
                    nf.AddRange(new[] { a, ab, ca, b, bc, ab, c, ca, bc, ab, bc, ca });
                }
                f = nf;
            }
            // flat shading: unique vertices per triangle; uv = facet-local for the ring texture
            var fv = new List<Vector3>(); var fu = new List<Vector2>(); var ft = new List<int>();
            for (int i = 0; i < f.Count; i += 3)
            {
                fv.Add(v[f[i]]); fv.Add(v[f[i + 1]]); fv.Add(v[f[i + 2]]);
                fu.Add(new Vector2(0.5f, 1f)); fu.Add(new Vector2(0f, 0f)); fu.Add(new Vector2(1f, 0f));
                ft.Add(i); ft.Add(i + 1); ft.Add(i + 2);
            }
            var m = new Mesh { name = "HexShield" };
            m.SetVertices(fv); m.SetUVs(0, fu); m.SetTriangles(ft, 0);
            m.RecalculateNormals(); m.RecalculateBounds();
            return m;
        }

        //================== GAMEPLAY HOOKS ==================\\
        public void Hit(int newHp, int max)
        {
            hp = newHp; maxHp = Mathf.Max(1, max);
            hitFlash = 0.5f;
            shieldTarget = (float)hp / maxHp;
            if (hp <= 0)
            {
                core.GetComponent<MeshRenderer>().sharedMaterial = coreRepaired;
                heart.GetComponent<MeshRenderer>().sharedMaterial = heartCalm;
            }
        }

        public void Attack()
        {
            if (hp <= 0) return;
            for (int i = 0; i < waves.Length; i++)
                if (waveT[i] < 0f) { waveT[i] = 0f; waves[i].gameObject.SetActive(true); return; }
        }

        public void Tick(float dt)
        {
            if (root == null) return;
            t += dt;
            bool alive = hp > 0;
            // glitching heartbeat
            float beat = alive ? 1f + Mathf.Pow(Mathf.Abs(Mathf.Sin(t * 3.2f)), 8f) * 0.35f : 1f + Mathf.Sin(t * 1.5f) * 0.05f;
            heart.localScale = Vector3.one * 6f * beat * (hitFlash > 0f ? 1.4f : 1f);
            core.localRotation = Quaternion.Euler(0f, t * 12f, 0f);
            if (alive && Mathf.Repeat(t, 2.3f) < 0.08f) core.localPosition = Random.insideUnitSphere * 0.8f;   // glitch jitter
            else core.localPosition = Vector3.zero;
            for (int i = 0; i < shards.Count; i++)
            {
                shards[i].RotateAround(root.position, shardAxis[i], (alive ? 18f : 4f) * dt);
                if (hitFlash > 0f) shards[i].position += (shards[i].position - root.position).normalized * dt * 6f;
            }
            for (int i = 0; i < rings.Count; i++) rings[i].Rotate(0f, 0f, (i % 2 == 0 ? 20f : -14f) * dt, Space.Self);
            shieldScale = Mathf.MoveTowards(shieldScale, shieldTarget, dt * 0.8f);
            shield.localScale = Vector3.one * 30f * Mathf.Max(0.001f, shieldScale);
            shield.gameObject.SetActive(shieldScale > 0.02f);
            shield.Rotate(0f, 8f * dt, 0f, Space.Self);
            if (hitFlash > 0f) hitFlash -= dt;
            for (int i = 0; i < waves.Length; i++)
            {
                if (waveT[i] < 0f) continue;
                waveT[i] += dt;
                float k = waveT[i] / 1.4f;
                if (k >= 1f) { waveT[i] = -1f; waves[i].gameObject.SetActive(false); continue; }
                waves[i].localScale = Vector3.one * Mathf.Lerp(20f, 230f, k);
            }
        }
    }
}
