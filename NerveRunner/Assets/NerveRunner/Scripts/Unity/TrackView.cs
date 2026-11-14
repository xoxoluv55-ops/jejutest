// NERVE RUNNER - builds the visible track from the simulation's TrackGraph.
// Nothing here affects gameplay; collisions/choices are resolved in RunnerSim.
using System.Collections.Generic;
using NeonRacer;
using NerveRunner.Core;
using UnityEngine;
using UnityEngine.UI;

namespace NerveRunner
{
    public class TrackView : MonoBehaviour
    {
        TrackGraph graph;
        QuestionBank bank;
        Transform staticRoot, dynRoot;
        readonly Dictionary<TrackEvent, GameObject> evtObj = new Dictionary<TrackEvent, GameObject>();
        readonly Dictionary<TrackEvent, Image[]> gateLanes = new Dictionary<TrackEvent, Image[]>();
        readonly Dictionary<TrackSegment, Image[]> forkLanes = new Dictionary<TrackSegment, Image[]>();
        readonly List<Transform> spinning = new List<Transform>();
        readonly List<Transform> glitch = new List<Transform>();
        readonly Dictionary<Transform, float> flash = new Dictionary<Transform, float>();
        readonly List<Transform> flashKeys = new List<Transform>();
        GameObject bridge;
        TrackSegment cleft;
        Material ringHitMat;
        readonly List<SaltatoryTunnelView> tunnels = new List<SaltatoryTunnelView>();

        static readonly Color Line = Pal.Hex(0x37D8FF);

        /// Road/rail colour per chapter theme (CH.2-6, CH.8).
        public static bool ThemeColor(string theme, out Color c)
        {
            switch (theme)
            {
                case "spinal": c = Pal.Hex(0x6CFF8A); return true;
                case "tract": c = Pal.Hex(0xFF5CC8); return true;
                case "brainstem": c = Pal.Hex(0xFF7A3D); return true;
                case "cerebellum": c = Pal.Hex(0xFF8FD0); return true;
                case "diencephalon": c = Pal.Hex(0x7C9CFF); return true;
                case "cranial": c = Pal.Hex(0xFFD34D); return true;
            }
            c = Color.white; return false;
        }

        public static Color ZoneColor(ZoneKind z)
        {
            switch (z)
            {
                case ZoneKind.Myelin: return Pal.Gold;
                case ZoneKind.Damaged: return Pal.Red;
                case ZoneKind.Review: return Pal.Hex(0xFF8A3D);
                case ZoneKind.Shortcut: return Pal.Green;
                case ZoneKind.ForkApproach: return Pal.Pink;
                case ZoneKind.Synapse: return Pal.Purple;
                default: return Line;
            }
        }

        readonly List<Mesh> ownedMeshes = new List<Mesh>();
        static readonly Dictionary<string, Texture2D> roadTex = new Dictionary<string, Texture2D>();
        static Texture2D checker;

        void OnDestroy()
        {
            foreach (var m in ownedMeshes) if (m != null) Destroy(m);
            ownedMeshes.Clear();
        }

        BossArenaView boss;
        StageInfo stage;

        public void Build(TrackGraph g, QuestionBank qb, StageInfo stageInfo = null)
        {
            graph = g; bank = qb; stage = stageInfo;
            MeshKit.Sink = ownedMeshes;
            staticRoot = new GameObject("TrackStatic").transform; staticRoot.SetParent(transform, false);
            dynRoot = new GameObject("TrackDynamic").transform; dynRoot.SetParent(transform, false);
            ringHitMat = Mats.Emissive(Color.white, Pal.Cyan * 3f);

            foreach (var seg in g.segments) BuildSegment(seg);
            foreach (var seg in g.segments) foreach (var e in seg.events) BuildEvent(seg, e);
            foreach (var seg in g.segments) if (seg.fork != null) BuildForkSigns(seg);
            if (BossArenaView.IsArena(g)) { boss = new BossArenaView(); boss.Build(g, dynRoot); }

            // static batching: everything under staticRoot shares a handful of materials
            StaticBatchingUtility.Combine(staticRoot.gameObject);
            MeshKit.Sink = null;
        }

        void BuildSegment(TrackSegment seg)
        {
            Color zc = ZoneColor(seg.zone);
            if (CerebrumCityView.IsDistrict(seg.theme) && seg.zone == ZoneKind.Normal) zc = CerebrumCityView.DistrictColor(seg.theme);
            if (seg.theme == "boss" && seg.zone == ZoneKind.Normal) zc = Pal.Hex(0xFF4DA6);
            Color themed;
            if (seg.zone == ZoneKind.Normal && ThemeColor(seg.theme, out themed)) zc = themed;
            var root = new GameObject("Seg_" + seg.id + "_" + seg.name).transform;
            root.SetParent(staticRoot, false);
            float hw = seg.halfWidth;
            float yOff = seg.zone == ZoneKind.Review || seg.zone == ZoneKind.Shortcut ? 0.02f * (seg.id % 4) : 0f;

            if (seg.zone == ZoneKind.Synapse)
            {
                cleft = seg;
                BuildCleft(seg, root);
                return;
            }

            Texture2D rt;
            string texKey = seg.zone + "|" + (seg.zone == ZoneKind.Normal ? seg.theme : "");
            if (!roadTex.TryGetValue(texKey, out rt) || rt == null) { rt = MeshKit.RoadTexture(zc, Pal.Hex(0x120E36)); roadTex[texKey] = rt; }
            var roadMat = Mats.Building(rt, Vector2.one, Color.white, seg.zone == ZoneKind.Damaged ? 0.55f : 0.85f);
            MeshKit.MeshObject(root, "Road", MeshKit.Ribbon(seg, 0f, seg.length, -hw, hw, yOff, 2f * hw), roadMat);
            var railMat = Mats.Emissive(zc * 0.6f, zc * 1.5f);
            MeshKit.MeshObject(root, "RailL", MeshKit.Wall(seg, 0f, seg.length, -hw, yOff, 0.55f), railMat);
            MeshKit.MeshObject(root, "RailR", MeshKit.Wall(seg, 0f, seg.length, hw, yOff, 0.55f), railMat);
            // underside glow strip (nerve fibre)
            var under = Mats.Emissive(Pal.Hex(0x2A1F6E), Pal.Purple * 0.5f);
            MeshKit.MeshObject(root, "Fiber", MeshKit.Ribbon(seg, 0f, seg.length, -hw * 0.6f, hw * 0.6f, yOff - 0.8f, 10f, 4f), under);

            if (seg.zone == ZoneKind.Myelin)
            {
                var tv = new SaltatoryTunnelView();   // 2.0 (1.0: BuildMyelin gold hoops, kept below for reference)
                tv.Build(seg, root, dynRoot);
                tunnels.Add(tv);
            }
            if (seg.zone == ZoneKind.Damaged) BuildDamaged(seg, root);
            CerebrumCityView.Build(seg, root, seg.id * 17 + 3);   // CH.7 districts (no-op elsewhere)

            // zone name sign near the start of main segments
            if (seg.zone != ZoneKind.Review && seg.zone != ZoneKind.Shortcut && seg.length > 120f)
                Sign(root, seg, 30f, 0f, 7.2f, 14f, 2.2f, seg.name, zc, 90);
        }

        void BuildMyelin(TrackSegment seg, Transform root)
        {
            var hoop = MeshKit.Torus(7.2f, 0.22f, 28, 5);
            var hoopMat = Mats.Emissive(Pal.Hex(0x7A5A10), Pal.Gold * 0.9f);
            var nodePositions = new List<float>();
            foreach (var e in seg.events) if (e.type == TrackEventType.NodeRing) nodePositions.Add(e.s);
            for (float s = 10f; s < seg.length - 5f; s += 6f)
            {
                bool nearNode = false;
                foreach (var n in nodePositions) if (Mathf.Abs(n - s) < 7f) nearNode = true;
                if (nearNode) continue;   // gap = the node of Ranvier (bare axon)
                var go = MeshKit.MeshObject(root, "Myelin", hoop, hoopMat);
                go.transform.position = seg.WorldPos(s, 0f, 2.6f);
                go.transform.rotation = Quaternion.LookRotation(seg.TangentAt(s), Vector3.up);
            }
        }

        void BuildDamaged(TrackSegment seg, Transform root)
        {
            var hoop = MeshKit.Torus(7.2f, 0.16f, 20, 4);
            var mat = Mats.Emissive(Pal.Hex(0x3A0A16), Pal.Red * 0.8f);
            var rnd = new System.Random(seg.id * 31);
            for (float s = 15f; s < seg.length - 5f; s += 22f)
            {
                var go = MeshKit.MeshObject(root, "BrokenMyelin", hoop, mat);
                go.transform.position = seg.WorldPos(s, (float)(rnd.NextDouble() - 0.5) * 3f, 2.2f + (float)rnd.NextDouble());
                go.transform.rotation = Quaternion.LookRotation(seg.TangentAt(s), Vector3.up) *
                                        Quaternion.Euler((float)rnd.NextDouble() * 50f - 25f, (float)rnd.NextDouble() * 60f - 30f, 0f);
                go.transform.localScale = new Vector3(1f, 0.6f + (float)rnd.NextDouble() * 0.5f, 1f);
            }
        }

        /// Synapse station (2.0, concept art 3): presynaptic terminal bulb with vesicle clusters and
        /// Ca2+ channels on the LEFT, postsynaptic membrane with receptors on the RIGHT, and
        /// neurotransmitter dots arcing across the cleft that the road crosses.
        void BuildCleft(TrackSegment seg, Transform root)
        {
            float L = seg.length;
            Quaternion q0 = Quaternion.LookRotation(seg.TangentAt(0f), Vector3.up);
            var bulbMat = NRMats.Toon(Pal.Hex(0x8A5CE0), Pal.Hex(0x3B1B7A), Pal.Hex(0xFF9AE6), 2.2f, Pal.Hex(0x2A0E50));
            var vesMat = NRMats.Toon(Pal.Hex(0xFF8FD0), Pal.Hex(0xC23F8E), Color.white, 2f, Pal.Hex(0x601040));
            var caMat = Mats.Emissive(Pal.Hex(0x2E9A50), Pal.Green * 1.6f);
            var postMat = NRMats.Toon(Pal.Hex(0x6E4CC8), Pal.Hex(0x2A1A6A), Pal.Hex(0x9AD8FF), 2.4f, Pal.Hex(0x180A40));
            var recMat = Mats.Emissive(Pal.Hex(0x1E8C96), Pal.Cyan * 1.6f);
            var boundMat = Mats.Emissive(Pal.Hex(0xFF8FD0), Pal.Pink * 2f);
            var ntMat = Mats.Emissive(Pal.Hex(0xFF9AE6), Pal.Pink * 1.8f);

            // presynaptic terminal bulb (left)
            var bulb = new GameObject("PresynapticTerminal").transform;
            bulb.SetParent(root, false);
            bulb.position = seg.WorldPos(2f, -16f, 4f);
            bulb.rotation = q0;
            MeshKit.Prim(PrimitiveType.Sphere, bulb, Vector3.zero, new Vector3(18f, 16f, 22f), bulbMat, "Bulb");
            var rnd = new System.Random(11);
            for (int c = 0; c < 6; c++)
            {
                // vesicle clusters on the side facing the cleft (+x local)
                Vector3 cc = new Vector3(8.2f, -4f + (c % 3) * 4f, -6f + (c / 3) * 8f);
                for (int k = 0; k < 7; k++)
                    MeshKit.Prim(PrimitiveType.Sphere, bulb, cc + new Vector3((float)rnd.NextDouble() * 0.6f, (float)rnd.NextDouble() * 2f - 1f, (float)rnd.NextDouble() * 2f - 1f) * 1.1f,
                                 Vector3.one * 0.9f, vesMat, "Vesicle");
            }
            for (int c = 0; c < 2; c++)
            {
                // voltage-gated Ca2+ channel pairs on top + a chain of entering Ca2+ ions
                Vector3 top = new Vector3(2f + c * 3f, 7.6f, -3f + c * 6f);
                MeshKit.Prim(PrimitiveType.Cylinder, bulb, top + new Vector3(-0.5f, 0f, 0f), new Vector3(0.7f, 1.2f, 0.7f), caMat, "CaChannel");
                MeshKit.Prim(PrimitiveType.Cylinder, bulb, top + new Vector3(0.5f, 0f, 0f), new Vector3(0.7f, 1.2f, 0.7f), caMat, "CaChannel");
                for (int k = 1; k <= 6; k++)
                    MeshKit.Prim(PrimitiveType.Sphere, bulb, top + new Vector3(Mathf.Sin(k) * 0.6f, k * 1.4f, -k * 0.6f), Vector3.one * 0.55f, caMat, "Ca2+");
            }

            // postsynaptic membrane (right) with receptors facing the cleft
            var post = new GameObject("PostsynapticMembrane").transform;
            post.SetParent(root, false);
            post.position = seg.WorldPos(L * 0.5f, 16f, -3f);
            post.rotation = Quaternion.LookRotation(seg.TangentAt(L * 0.5f), Vector3.up);
            var ridge = MeshKit.Prim(PrimitiveType.Capsule, post, Vector3.zero, new Vector3(12f, (L + 40f) * 0.5f, 9f), postMat, "Membrane");
            ridge.transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
            int nRec = 8;
            for (int i = 0; i < nRec; i++)
            {
                float z = Mathf.Lerp(-L * 0.5f - 10f, L * 0.5f + 10f, i / (float)(nRec - 1));
                var rec = new GameObject("Receptor").transform;
                rec.SetParent(post, false);
                rec.localPosition = new Vector3(-4.5f, 4.2f, z);
                rec.localRotation = Quaternion.Euler(0f, 0f, 35f);   // leaning toward the cleft
                var m = i % 3 == 1 ? boundMat : recMat;               // some receptors already bound (pink)
                MeshKit.Prim(PrimitiveType.Cylinder, rec, new Vector3(0f, 0.8f, 0f), new Vector3(0.45f, 0.8f, 0.45f), recMat, "Stem");
                var a1 = MeshKit.Prim(PrimitiveType.Cube, rec, new Vector3(-0.45f, 2.1f, 0f), new Vector3(0.45f, 1.4f, 0.45f), m, "Arm");
                a1.transform.localRotation = Quaternion.Euler(0f, 0f, 28f);
                var a2 = MeshKit.Prim(PrimitiveType.Cube, rec, new Vector3(0.45f, 2.1f, 0f), new Vector3(0.45f, 1.4f, 0.45f), m, "Arm");
                a2.transform.localRotation = Quaternion.Euler(0f, 0f, -28f);
            }

            // neurotransmitter dots arcing from the bulb over the road to the receptors
            for (int arc = 0; arc < 3; arc++)
            {
                float s0 = L * (0.15f + arc * 0.3f);
                for (int k = 0; k <= 12; k++)
                {
                    float u = k / 12f;
                    float x = Mathf.Lerp(-8f, 11f, u);
                    float y = 2.5f + Mathf.Sin(u * Mathf.PI) * (6f + arc);
                    var d = MeshKit.Prim(PrimitiveType.Sphere, dynRoot, Vector3.zero, Vector3.one * (0.35f + 0.15f * Mathf.Sin(u * 9f)), ntMat, "Neurotransmitter");
                    d.transform.position = seg.WorldPos(s0 + u * 4f, x, y);
                    spinning.Add(d.transform);
                }
            }
            Sign(root, seg, 0f, 0f, 9f, 13f, 1.9f, "시냅스 정거장 · 시냅스 틈새", Pal.Purple, 80);
            Sign(root, seg, 0f, -9f, 13f, 9f, 1.6f, "← 시냅스전 말단 (소포 · Ca2+)", Pal.Pink, 50);
            Sign(root, seg, L * 0.6f, 9f, 9.5f, 9f, 1.6f, "시냅스후막 · 수용체 →", Pal.Cyan, 50);
        }

        /// Called after the synapse minigame. success = solid bright bridge.
        public void BuildBridge(bool success)
        {
            if (cleft == null || bridge != null) return;
            MeshKit.Sink = ownedMeshes;
            bridge = new GameObject("TransmitterBridge");
            bridge.transform.SetParent(dynRoot, false);
            Color c = success ? Pal.Cyan : Pal.Hex(0x8A7AB8);
            var mat = Mats.Emissive(c * 0.6f, c * (success ? 1.6f : 0.6f));
            MeshKit.MeshObject(bridge.transform, "Deck", MeshKit.Ribbon(cleft, 0f, cleft.length, -cleft.halfWidth, cleft.halfWidth, 0f, 6f), mat);
            var orb = Mats.Emissive(Color.white, c * 2f);
            for (float s = 1.5f; s < cleft.length; s += 3f)
                foreach (float x in new[] { -cleft.halfWidth, cleft.halfWidth })
                {
                    var o = MeshKit.Prim(PrimitiveType.Sphere, bridge.transform, Vector3.zero, Vector3.one * 0.6f, orb, "BridgeOrb");
                    o.transform.position = cleft.WorldPos(s, x, 0.3f);
                }
            MeshKit.Sink = null;
        }

        void BuildEvent(TrackSegment seg, TrackEvent e)
        {
            Vector3 tan = seg.TangentAt(e.s);
            Quaternion q = Quaternion.LookRotation(tan, Vector3.up);
            switch (e.type)
            {
                case TrackEventType.Orb:
                {
                    var o = MeshKit.Prim(PrimitiveType.Sphere, dynRoot, Vector3.zero, Vector3.one * 0.7f, Mats.Emissive(Pal.Cyan, Pal.Cyan * 1.8f), "Orb");
                    o.transform.position = seg.WorldPos(e.s, e.x, RunnerSim.HOVER);
                    evtObj[e] = o; spinning.Add(o.transform);
                    break;
                }
                case TrackEventType.RepairOrb:
                {
                    var o = MeshKit.Prim(PrimitiveType.Sphere, dynRoot, Vector3.zero, Vector3.one * 1.1f, Mats.Emissive(Pal.Green, Pal.Green * 1.8f), "RepairOrb");
                    o.transform.position = seg.WorldPos(e.s, e.x, RunnerSim.HOVER + 0.3f);
                    var ring = MeshKit.MeshObject(o.transform, "Ring", MeshKit.Torus(1.0f, 0.06f, 24, 5), Mats.Emissive(Color.white, Pal.Green * 2f));
                    ring.transform.localScale = Vector3.one * 0.9f;
                    evtObj[e] = o; spinning.Add(o.transform);
                    break;
                }
                case TrackEventType.NodeRing:
                {
                    var o = MeshKit.MeshObject(dynRoot, "NodeOfRanvier", MeshKit.Torus(e.width, 0.14f, 36, 6), Mats.Emissive(Pal.Hex(0x1E6F7A), Pal.Cyan * 2.2f));
                    o.transform.position = seg.WorldPos(e.s, e.x, RunnerSim.HOVER);
                    o.transform.rotation = q;
                    var discMat = NRMats.Additive(new Color(0.4f, 1f, 1f, 0.5f), NRMats.Ring);   // 2.0: target glow inside the ring
                    if (discMat != null) MeshKit.Prim(PrimitiveType.Quad, o.transform, Vector3.zero, Vector3.one * (e.width * 2.6f), discMat, "RingGlow");
                    evtObj[e] = o;
                    break;
                }
                case TrackEventType.Obstacle:
                {
                    var o = MeshKit.Prim(PrimitiveType.Cube, dynRoot, Vector3.zero, new Vector3(e.width, e.height, 1.4f), Mats.Emissive(Pal.Hex(0x4A0612), Pal.Red * 1.6f), "NULL");
                    o.transform.position = seg.WorldPos(e.s, e.x, e.height * 0.5f);
                    o.transform.rotation = q;
                    var lbl = Sign(o.transform, null, 0f, 0f, 0f, 3f, 0.8f, "NULL", Pal.Red, 70, false);
                    lbl.transform.localPosition = new Vector3(0f, 0.9f, -0.75f);
                    lbl.transform.localRotation = Quaternion.identity;
                    lbl.transform.localScale = new Vector3(0.01f / e.width, 0.01f / e.height, 0.01f);
                    evtObj[e] = o; glitch.Add(o.transform);
                    break;
                }
                case TrackEventType.Gate:
                    BuildGate(seg, e, q);
                    break;
                case TrackEventType.Checkpoint:
                case TrackEventType.Finish:
                {
                    bool fin = e.type == TrackEventType.Finish;
                    Color c = fin ? Pal.Yellow : Pal.Purple;
                    var hoop = MeshKit.MeshObject(staticRoot, fin ? "Finish" : "Checkpoint", MeshKit.Torus(seg.halfWidth + 1.2f, 0.3f, 40, 6), Mats.Emissive(c * 0.5f, c * 1.8f));
                    hoop.transform.position = seg.WorldPos(e.s, 0f, 0.4f);
                    hoop.transform.rotation = q;
                    if (fin)
                    {
                        MeshKit.MeshObject(staticRoot, "FinishLine", MeshKit.Ribbon(seg, e.s - 1.5f, e.s + 1.5f, -seg.halfWidth, seg.halfWidth, 0.06f, 3f, 1f),
                                           Mats.Textured(checker != null ? checker : (checker = MeshKit.Checker()), new Vector2(1f, 1f), 0f, 0.3f, true));
                        Sign(staticRoot, seg, e.s, 0f, seg.halfWidth + 3.4f, 12f, 2.4f, "GOAL - 신호 전달 완료", Pal.Yellow, 100);
                    }
                    break;
                }
            }
        }

        void BuildGate(TrackSegment seg, TrackEvent e, Quaternion q)
        {
            var qd = bank.Get(e.questionId);
            float hw = seg.halfWidth;
            var postMat = Mats.Emissive(Pal.Hex(0x1A1450), Pal.Purple * 1.4f);
            var root = new GameObject("Gate_" + e.questionId).transform;
            root.SetParent(dynRoot, false);
            root.position = seg.WorldPos(e.s, 0f, 0f);
            root.rotation = q;
            MeshKit.Prim(PrimitiveType.Cube, root, new Vector3(-hw - 0.3f, 3f, 0f), new Vector3(0.5f, 6f, 0.5f), postMat);
            MeshKit.Prim(PrimitiveType.Cube, root, new Vector3(hw + 0.3f, 3f, 0f), new Vector3(0.5f, 6f, 0.5f), postMat);
            MeshKit.Prim(PrimitiveType.Cube, root, new Vector3(0f, 6.2f, 0f), new Vector3(2f * hw + 1.2f, 0.4f, 0.5f), postMat);
            var imgs = new Image[e.laneX.Length];
            float laneW = e.laneX.Length > 1 ? Mathf.Abs(e.laneX[1] - e.laneX[0]) : 2f * hw;
            for (int i = 0; i < e.laneX.Length; i++)
            {
                // lane dividers on the road
                if (i > 0)
                {
                    float xd = (e.laneX[i - 1] + e.laneX[i]) * 0.5f;
                    MeshKit.Prim(PrimitiveType.Cube, root, new Vector3(xd, 2.9f, 0f), new Vector3(0.18f, 5.8f, 0.18f), postMat);
                }
                string label = (char)('A' + i) + "  " + (qd != null ? qd.options[i] : "?");
                var sign = Sign(root, null, 0f, 0f, 0f, laneW - 0.4f, 2.3f, label, Pal.Cyan, 46, false);
                sign.transform.localPosition = new Vector3(e.laneX[i], 4.3f, -0.3f);
                sign.transform.localRotation = Quaternion.identity;
                imgs[i] = sign.GetComponentInChildren<Image>();
            }
            gateLanes[e] = imgs;
            evtObj[e] = root.gameObject;
        }

        void BuildForkSigns(TrackSegment seg)
        {
            var q = bank.Get(seg.fork.questionId);
            float s = Mathf.Max(0f, seg.length - 60f);
            var imgs = new Image[seg.fork.laneX.Length];
            float laneW = seg.fork.laneX.Length > 1 ? Mathf.Abs(seg.fork.laneX[1] - seg.fork.laneX[0]) : 8f;
            var postMat = Mats.Emissive(Pal.Hex(0x1A1450), Pal.Pink * 1.2f);
            for (int i = 0; i < seg.fork.laneX.Length; i++)
            {
                string label = (char)('A' + i) + "  " + (q != null ? q.options[i] : "?");
                var sign = Sign(dynRoot, seg, s, seg.fork.laneX[i], 5.2f, laneW - 0.6f, 2.6f, label, Pal.Pink, 48);
                imgs[i] = sign.GetComponentInChildren<Image>();
                MeshKit.Prim(PrimitiveType.Cube, dynRoot, seg.WorldPos(s, seg.fork.laneX[i], 2f), new Vector3(0.25f, 4f, 0.25f), postMat);
            }
            // divider at the split point
            for (int i = 1; i < seg.fork.laneX.Length; i++)
            {
                float xd = (seg.fork.laneX[i - 1] + seg.fork.laneX[i]) * 0.5f;
                var d = MeshKit.Prim(PrimitiveType.Cube, staticRoot, Vector3.zero, new Vector3(0.6f, 1.2f, 30f), postMat, "ForkDivider");
                d.transform.position = seg.WorldPos(seg.length - 15f, xd, 0.6f);
                d.transform.rotation = Quaternion.LookRotation(seg.TangentAt(seg.length - 15f), Vector3.up);
            }
            forkLanes[seg] = imgs;
        }

        /// World-space sign board. If seg != null it is placed at (s, x, y) facing travel direction.
        public static Canvas Sign(Transform parent, TrackSegment seg, float s, float x, float y, float w, float h, string text, Color c, int fontPx, bool place = true)
        {
            var go = new GameObject("Sign", typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var cv = go.AddComponent<Canvas>();
            cv.renderMode = RenderMode.WorldSpace;
            var rt = (RectTransform)go.transform;
            rt.sizeDelta = new Vector2(w * 100f, h * 100f);
            rt.localScale = Vector3.one * 0.01f;
            if (seg != null && place)
            {
                rt.position = seg.WorldPos(s, x, y);
                rt.rotation = Quaternion.LookRotation(seg.TangentAt(s), Vector3.up);
            }
            var bg = UIKit.Panel(rt, Pal.A(Pal.Hex(0x0E0A2C), 0.88f));
            UIKit.Fill(bg.rectTransform);
            UIKit.Neon(bg, c, 4f);
            var t = UIKit.FitLabel(rt, text, fontPx, 20, Pal.Text);
            UIKit.Fill(t.rectTransform, 14f);
            return cv;
        }

        //================== RUNTIME FEEDBACK ==================\\
        public void BossHit(int hp, int max) { if (boss != null) boss.Hit(hp, max); }
        public void BossAttack() { if (boss != null) boss.Attack(); }

        public void Collect(TrackEvent e) { GameObject o; if (evtObj.TryGetValue(e, out o) && o != null) o.SetActive(false); }

        public void FlashRing(TrackEvent e, bool hit)
        {
            GameObject o;
            if (!evtObj.TryGetValue(e, out o) || o == null) return;
            if (hit) { o.GetComponent<MeshRenderer>().sharedMaterial = ringHitMat; flash[o.transform] = 0.35f; }
            else o.SetActive(false);
            foreach (var tv in tunnels) tv.OnNode(e, hit);
        }

        public void MarkGate(TrackEvent e, int lane, bool correct)
        {
            Image[] imgs;
            if (!gateLanes.TryGetValue(e, out imgs)) return;
            for (int i = 0; i < imgs.Length; i++)
            {
                if (imgs[i] == null) continue;
                if (i == e.correctLane) imgs[i].color = Pal.A(Pal.Hex(0x0F5A50), 0.95f);
                else if (i == lane) imgs[i].color = Pal.A(Pal.Hex(0x6A1024), 0.95f);
            }
        }

        public void MarkFork(TrackSegment seg, int lane, bool correct)
        {
            Image[] imgs;
            if (!forkLanes.TryGetValue(seg, out imgs)) return;
            for (int i = 0; i < imgs.Length; i++)
            {
                if (i == seg.fork.correctLane) imgs[i].color = Pal.A(Pal.Hex(0x0F5A50), 0.95f);
                else if (i == lane) imgs[i].color = Pal.A(Pal.Hex(0x6A1024), 0.95f);
            }
        }

        public void HitObstacle(TrackEvent e)
        {
            GameObject o;
            if (evtObj.TryGetValue(e, out o) && o != null) o.SetActive(false);   // NULL block shatters
        }

        void Update()
        {
            float dt = Time.deltaTime, t = Time.time;
            for (int i = 0; i < tunnels.Count; i++) tunnels[i].Tick(dt);
            if (boss != null) boss.Tick(dt);
            for (int i = 0; i < spinning.Count; i++)
                if (spinning[i] != null && spinning[i].gameObject.activeSelf)
                    spinning[i].Rotate(0f, 120f * dt, 40f * dt, Space.Self);
            for (int i = 0; i < glitch.Count; i++)
            {
                var g = glitch[i];
                if (g == null) continue;
                float n = Mathf.PerlinNoise(t * 6f, i * 1.7f);
                g.localScale = new Vector3(g.localScale.x, g.localScale.y, 1.2f + n * 0.5f);
            }
            if (flash.Count > 0)
            {
                // PERF: reuse one list (was a new List + Transform.name string every frame)
                flashKeys.Clear();
                flashKeys.AddRange(flash.Keys);
                for (int i = 0; i < flashKeys.Count; i++)
                {
                    var k = flashKeys[i];
                    if (k == null) { flash.Remove(k); continue; }
                    float v = flash[k] - dt;
                    k.localScale = Vector3.one * (1f + Mathf.Max(0f, v) * 1.2f);   // only node rings flash
                    if (v <= 0f) { flash.Remove(k); k.localScale = Vector3.one; } else flash[k] = v;
                }
            }
        }
    }
}
