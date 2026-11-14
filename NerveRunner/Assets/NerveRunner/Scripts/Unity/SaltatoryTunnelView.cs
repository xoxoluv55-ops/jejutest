// NERVE RUNNER 2.0 - saltatory conduction tunnel (replaces the 1.0 gold hoops).
//
// What it shows (and how it maps to the real anatomy):
//   * MYELIN SHEATH  = each internode is a thick tube of wrapped membrane (lamellae texture) that
//     insulates the axon. Ends taper (paranodes) where the sheath meets the node.
//   * NODE OF RANVIER = the short gap between sheaths where the AXON MEMBRANE is exposed; studded
//     with voltage-gated Na+ channels (cyan) - this is where the action potential is regenerated.
//   * When STAR-01 passes a node ring: Na+ influx particles (ions flowing IN), the node flashes,
//     and a pulse ring races ahead through the next internode (fast passive spread under the
//     insulation) to the next node, where the AP will be regenerated again.
// Game exaggerations (stated in the in-game explanation): real nodes are ~1 um long and
// internodes ~0.2-2 mm; the signal does not "teleport" - it is regenerated node by node.
using System.Collections.Generic;
using NeonRacer;
using NerveRunner.Core;
using UnityEngine;

namespace NerveRunner
{
    public class SaltatoryTunnelView
    {
        const float R = 8.2f;          // inner radius of the myelin sheath (road fits inside)
        const float WALL = 0.5f;       // sheath thickness shown at the tube ends
        const float CY = 2.4f;         // axis height above the road centre
        const float NODE_GAP = 9f;     // exposed axon length at each node (exaggerated)
        const float AXON_R = 7.4f;     // exposed axon membrane radius at nodes
        const int SIDES = 36;

        class Node
        {
            public TrackEvent ev;
            public float s;
            public MeshRenderer band, studs;
            public float flash;
        }

        class Pulse { public Transform tr; public float s, end; public bool active; }

        TrackSegment seg;
        readonly List<Node> nodes = new List<Node>();
        readonly Dictionary<TrackEvent, Node> byEvent = new Dictionary<TrackEvent, Node>();
        readonly List<Pulse> pulses = new List<Pulse>();
        ParticleSystem ions;
        Material bandIdle, bandReady, bandFlash, studIdle, studFlash;
        float t;

        Vector3 Up(float s) { return Vector3.Cross(seg.TangentAt(s), seg.RightAt(s)).normalized; }
        Vector3 Axis(float s) { return seg.WorldPos(s, 0f, CY); }

        public void Build(TrackSegment segment, Transform staticRoot, Transform dynRoot)
        {
            seg = segment;
            var nodeS = new List<float>();
            foreach (var e in seg.events) if (e.type == TrackEventType.NodeRing) nodeS.Add(e.s);

            // ---- myelin sheaths between the nodes ----
            var lam = NRMats.Lamellae(new Color(0.96f, 0.8f, 0.45f), new Color(1f, 0.97f, 0.75f));
            var innerMat = Mats.Building(lam, Vector2.one, new Color(1f, 0.8f, 0.45f), 0.34f);
            var outerMat = Mats.Building(lam, Vector2.one, new Color(1f, 0.75f, 0.35f), 0.6f);
            var paraMat = Mats.Emissive(Pal.Hex(0x7A5A10), Pal.Gold * 1.3f);
            var paraMesh = MeshKit.Track(MeshKit.Torus(R * 0.82f + WALL * 0.5f, 0.32f, 40, 6));
            float a = 4f;
            var cuts = new List<float>(nodeS);
            cuts.Add(seg.length + NODE_GAP * 0.5f - 4f);
            foreach (float n in cuts)
            {
                float b = n - NODE_GAP * 0.5f;
                if (b - a > 6f)
                {
                    var tube = new GameObject("MyelinSheath").transform;
                    tube.SetParent(staticRoot, false);
                    MeshKit.MeshObject(tube, "Inner", MeshKit.Track(Tube(a, b, R, true, true)), innerMat);
                    MeshKit.MeshObject(tube, "Outer", MeshKit.Track(Tube(a, b, R + WALL, false, true)), outerMat);
                    foreach (float e in new[] { a, b })
                    {
                        var para = MeshKit.MeshObject(tube, "Paranode", paraMesh, paraMat);
                        para.transform.position = Axis(e);
                        para.transform.rotation = Quaternion.LookRotation(seg.TangentAt(e), Up(e));
                    }
                }
                a = n + NODE_GAP * 0.5f;
            }

            // ---- nodes of Ranvier: exposed axon membrane + Na+ channel clusters (dynamic: they flash) ----
            bandIdle = Mats.Emissive(Pal.Hex(0x0E3A44), Pal.Cyan * 0.35f);
            bandReady = Mats.Emissive(Pal.Hex(0x14606E), Pal.Cyan * 0.9f);
            bandFlash = Mats.Emissive(Pal.Hex(0x9FFFF6), Pal.Cyan * 2.6f);
            studIdle = Mats.Emissive(Pal.Hex(0x1E8C96), Pal.Cyan * 1.2f);
            studFlash = Mats.Emissive(Color.white, Pal.Cyan * 3f);
            var studMesh = MeshKit.Track(StudRing());
            foreach (var e in seg.events)
            {
                if (e.type != TrackEventType.NodeRing) continue;
                var n = new Node { ev = e, s = e.s };
                var root = new GameObject("NodeOfRanvier_" + e.index).transform;
                root.SetParent(dynRoot, false);
                root.position = Axis(e.s);
                root.rotation = Quaternion.LookRotation(seg.TangentAt(e.s), Up(e.s));
                n.band = MeshKit.MeshObject(root, "AxonMembrane", MeshKit.Track(LocalTube(NODE_GAP, AXON_R)), bandIdle).GetComponent<MeshRenderer>();
                n.studs = MeshKit.MeshObject(root, "NaChannels", studMesh, studIdle).GetComponent<MeshRenderer>();
                nodes.Add(n);
                byEvent[e] = n;
            }

            // ---- teaching labels (first internode + first node) ----
            if (nodeS.Count > 0)
            {
                TrackView.Sign(staticRoot, seg, Mathf.Max(5f, nodeS[0] * 0.45f), -2.6f, 5.6f, 7.2f, 1.6f,
                               "말이집(수초): 축삭을 감싼 절연층\n→ 이 구간은 빠르게 수동 전도", Pal.Gold, 44);
                TrackView.Sign(staticRoot, seg, Mathf.Max(0f, nodeS[0] - 14f), 2.6f, 5.6f, 7.2f, 1.6f,
                               "랑비에 결절: Na+ 통로 밀집\n→ 활동전위가 여기서 재생성", Pal.Cyan, 44);
            }

            // ---- Na+ influx particles + pulse pool ----
            var addMat = NRMats.Additive(new Color(0.55f, 1f, 1f), NRMats.Dot);
            if (addMat != null)
            {
                var go = new GameObject("NaInflux");
                go.transform.SetParent(dynRoot, false);
                ions = go.AddComponent<ParticleSystem>();
                ions.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);
                var main = ions.main;
                main.playOnAwake = false; main.loop = true; main.simulationSpace = ParticleSystemSimulationSpace.World;
                main.maxParticles = Mathf.RoundToInt(160 * Gfx.Particles) + 20;
                var em = ions.emission; em.enabled = false;
                var sh = ions.shape; sh.enabled = false;
                var col = ions.colorOverLifetime; col.enabled = true;
                var g = new Gradient();
                g.SetKeys(new[] { new GradientColorKey(Color.white, 0f), new GradientColorKey(Color.white, 1f) },
                          new[] { new GradientAlphaKey(1f, 0f), new GradientAlphaKey(0f, 1f) });
                col.color = new ParticleSystem.MinMaxGradient(g);
                var r = go.GetComponent<ParticleSystemRenderer>();
                r.sharedMaterial = addMat; r.renderMode = ParticleSystemRenderMode.Stretch; r.velocityScale = 0.05f; r.lengthScale = 1f;
                r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                ions.Play();
            }
            var pulseMat = NRMats.Additive(new Color(0.6f, 1f, 1f, 1f), NRMats.Dot) ?? Mats.Emissive(Pal.Cyan, Pal.Cyan * 2f);
            var pulseMesh = MeshKit.Track(MeshKit.Torus(R * 0.86f, 0.22f, 48, 6));
            for (int i = 0; i < 4; i++)
            {
                var p = MeshKit.MeshObject(dynRoot, "APPulse", pulseMesh, pulseMat);
                p.SetActive(false);
                pulses.Add(new Pulse { tr = p.transform });
            }
        }

        //================== MESHES ==================\\
        /// Tube along the segment from s=a to s=b. inner=true -> faces point at the axis (seen from inside).
        Mesh Tube(float a, float b, float radius, bool inner, bool taper)
        {
            int rings = Mathf.Max(2, Mathf.CeilToInt((b - a) / 2f) + 1);
            var v = new List<Vector3>(); var n = new List<Vector3>(); var uv = new List<Vector2>(); var tris = new List<int>();
            for (int i = 0; i < rings; i++)
            {
                float s = Mathf.Lerp(a, b, i / (float)(rings - 1));
                float d = Mathf.Min(s - a, b - s);
                float k = taper ? Mathf.Lerp(0.82f, 1f, Mathf.SmoothStep(0f, 1f, d / 5f)) : 1f;   // paranodal taper
                Vector3 c = Axis(s), r = seg.RightAt(s), u = Up(s);
                for (int j = 0; j <= SIDES; j++)
                {
                    float ang = j / (float)SIDES * Mathf.PI * 2f;
                    Vector3 dir = r * Mathf.Cos(ang) + u * Mathf.Sin(ang);
                    float rad = inner ? radius * k : (radius - WALL) * k + WALL;
                    v.Add(c + dir * rad);
                    n.Add(inner ? -dir : dir);
                    uv.Add(new Vector2(j / (float)SIDES * 3f, (s - a) / 7f));
                }
            }
            int row = SIDES + 1;
            for (int i = 0; i < rings - 1; i++)
                for (int j = 0; j < SIDES; j++)
                {
                    int i0 = i * row + j, i1 = i0 + 1, i2 = i0 + row, i3 = i2 + 1;
                    Quad(tris, v, i0, i1, i2, i3, n[i0]);
                }
            var m = new Mesh { name = inner ? "MyelinInner" : "MyelinOuter" };
            m.indexFormat = UnityEngine.Rendering.IndexFormat.UInt32;
            m.SetVertices(v); m.SetNormals(n); m.SetUVs(0, uv); m.SetTriangles(tris, 0);
            m.RecalculateBounds();
            return m;
        }

        static void Quad(List<int> tris, List<Vector3> v, int i0, int i1, int i2, int i3, Vector3 want)
        {
            Vector3 cr = Vector3.Cross(v[i2] - v[i0], v[i1] - v[i0]);
            if (Vector3.Dot(cr, want) >= 0f) { tris.Add(i0); tris.Add(i2); tris.Add(i1); tris.Add(i1); tris.Add(i2); tris.Add(i3); }
            else { tris.Add(i0); tris.Add(i1); tris.Add(i2); tris.Add(i1); tris.Add(i3); tris.Add(i2); }
        }

        /// Short local-space tube (axis = +Z), double-sided, for the exposed node membrane.
        static Mesh LocalTube(float length, float radius)
        {
            var v = new List<Vector3>(); var tris = new List<int>();
            for (int side = 0; side < 2; side++)
            {
                int b = v.Count;
                for (int i = 0; i < 2; i++)
                    for (int j = 0; j <= SIDES; j++)
                    {
                        float ang = j / (float)SIDES * Mathf.PI * 2f;
                        v.Add(new Vector3(Mathf.Cos(ang) * radius, Mathf.Sin(ang) * radius, (i - 0.5f) * length));
                    }
                int row = SIDES + 1;
                for (int j = 0; j < SIDES; j++)
                {
                    int i0 = b + j, i1 = i0 + 1, i2 = i0 + row, i3 = i2 + 1;
                    Vector3 mid = (v[i0] + v[i3]) * 0.5f; mid.z = 0f;
                    Quad(tris, v, i0, i1, i2, i3, side == 0 ? -mid : mid);
                }
            }
            var m = new Mesh { name = "NodeMembrane" };
            m.SetVertices(v); m.SetTriangles(tris, 0);
            m.RecalculateNormals(); m.RecalculateBounds();
            return m;
        }

        /// One merged mesh of Na+ channel studs around the node (1 draw call per node).
        static Mesh StudRing()
        {
            var tmp = GameObject.CreatePrimitive(PrimitiveType.Cube);   // 24 verts per stud (cylinder: 88)
            var cyl = tmp.GetComponent<MeshFilter>().sharedMesh;   // channel protein block
            var parts = new List<CombineInstance>();
            const int N = 22;
            for (int ring = 0; ring < 2; ring++)
                for (int i = 0; i < N; i++)
                {
                    float ang = (i + ring * 0.5f) / N * Mathf.PI * 2f;
                    Vector3 dir = new Vector3(Mathf.Cos(ang), Mathf.Sin(ang), 0f);
                    Vector3 pos = dir * (AXON_R - 0.25f) + new Vector3(0f, 0f, (ring - 0.5f) * 3.2f);
                    var mtx = Matrix4x4.TRS(pos, Quaternion.FromToRotation(Vector3.up, dir), new Vector3(0.42f, 0.5f, 0.42f));
                    parts.Add(new CombineInstance { mesh = cyl, transform = mtx });
                }
            var m = new Mesh { name = "NaChannelStuds" };
            m.CombineMeshes(parts.ToArray(), true, true);
            Object.Destroy(tmp);
            return m;
        }

        //================== RUNTIME ==================\\
        public void OnNode(TrackEvent e, bool hit)
        {
            Node n;
            if (!byEvent.TryGetValue(e, out n)) return;
            if (!hit) { n.band.sharedMaterial = bandIdle; return; }
            n.flash = 0.45f;
            n.band.sharedMaterial = bandFlash;
            n.studs.sharedMaterial = studFlash;

            // Na+ ions flow INTO the axon at the node
            if (ions != null)
            {
                Vector3 c = Axis(n.s), r = seg.RightAt(n.s), u = Up(n.s), f = seg.TangentAt(n.s);
                int count = Mathf.RoundToInt(40 * Gfx.Particles);
                for (int i = 0; i < count; i++)
                {
                    float ang = Random.value * Mathf.PI * 2f;
                    Vector3 dir = r * Mathf.Cos(ang) + u * Mathf.Sin(ang);
                    var p = new ParticleSystem.EmitParams
                    {
                        position = c + dir * (AXON_R - 0.2f) + f * Random.Range(-3f, 3f),
                        velocity = -dir * Random.Range(7f, 12f),
                        startColor = Color.Lerp(Pal.Cyan, Color.white, Random.value * 0.5f),
                        startSize = Random.Range(0.12f, 0.2f), startLifetime = Random.Range(0.35f, 0.55f), applyShapeToPosition = false,
                    };
                    ions.Emit(p, 1);
                }
            }

            // pulse races ahead to the next node (fast passive spread under the myelin)
            int idx = nodes.IndexOf(n);
            float end = idx + 1 < nodes.Count ? nodes[idx + 1].s : seg.length - 2f;
            foreach (var p in pulses)
            {
                if (p.active) continue;
                p.active = true; p.s = n.s; p.end = end;
                p.tr.gameObject.SetActive(true);
                break;
            }
        }

        public void Tick(float dt)
        {
            t += dt;
            // the next node not yet reached glows "ready" so the player can aim for it
            Node next = null;
            foreach (var n in nodes) if (!n.ev.consumed) { next = n; break; }
            foreach (var n in nodes)
            {
                if (n.flash > 0f)
                {
                    n.flash -= dt;
                    if (n.flash <= 0f) { n.band.sharedMaterial = n.ev.consumed ? bandIdle : bandIdle; n.studs.sharedMaterial = studIdle; }
                    continue;
                }
                bool ready = n == next && Mathf.Repeat(t * 2.5f, 1f) < 0.6f;
                var want = ready ? bandReady : bandIdle;
                if (n.band.sharedMaterial != want) n.band.sharedMaterial = want;
            }
            foreach (var p in pulses)
            {
                if (!p.active) continue;
                p.s += 160f * dt;
                if (p.s >= p.end) { p.active = false; p.tr.gameObject.SetActive(false); continue; }
                float k = Mathf.Clamp01((p.end - p.s) / 12f);   // shrink into the next node
                p.tr.position = Axis(p.s);
                p.tr.rotation = Quaternion.LookRotation(seg.TangentAt(p.s), Up(p.s));
                p.tr.localScale = Vector3.one * Mathf.Lerp(0.7f, 1f, k);
            }
        }
    }
}
