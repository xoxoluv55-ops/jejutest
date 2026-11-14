// NERVE RUNNER - CHAPTER 1 "뉴런 고속도로" (Neuron Highway) course.
// The course follows the path of a signal through one neuron:
//   dendrites -> soma -> axon hillock (fork) -> action potential gates (initial segment)
//   -> myelinated axon (saltatory tunnel) -> fork (where is the AP regenerated?)
//   -> demyelinated zone (NULL damage, repair mission, glia gate) -> axon terminal
//   -> synapse minigame -> postsynaptic final sprint -> finish.
// Fork / gate geometry is driven by the question data (number of options, answer index).
using System.Collections.Generic;
using UnityEngine;

namespace NerveRunner.Core
{
    public static class Chapter1Layout
    {
        public const string StageId = "ch1";

        // question ids referenced by the course (content lives in questions_ch1.json)
        public const string Q_HILLOCK = "ch1_fork_hillock";
        public static readonly string[] Q_AP = { "ch1_ap_1", "ch1_ap_2", "ch1_ap_3", "ch1_ap_4" };
        public const string Q_SALTATORY = "ch1_fork_saltatory";
        public const string Q_GLIA = "ch1_gate_glia";
        public const string Q_SYN_ORDER = "ch1_syn_order";
        public const string Q_SYN_EPSP = "ch1_syn_epsp";

        public static TrackGraph Build(QuestionBank bank)
        {
            var b = new TrackPathBuilder(Vector3.zero, 0f);

            //---------------- A. Dendrites: warm-up, gentle corners ----------------
            b.Trigger("story:prologue", 1f).Trigger("hint:steer", 30f).Trigger("codex:dendrite", 60f);
            b.StraightWith(240f, 6, (i, s) => b.EventAt(TrackEventType.Orb, s, i % 2 == 0 ? -2.5f : 2.5f));
            b.Trigger("hint:corner", 0f);
            b.Turn(55f, 140f);
            b.Straight(120f);
            b.Turn(-60f, 110f, 6f);
            b.Cut("가지돌기 (Dendrites)", ZoneKind.Normal, 6f);

            //---------------- B. Soma: S-curves ----------------
            b.Trigger("codex:soma", 10f).Trigger("banner:soma", 10f);
            b.Straight(100f);
            b.Turn(70f, 75f);
            b.StraightWith(60f, 2, (i, s) => b.EventAt(TrackEventType.Orb, s, 0f));
            b.Turn(-70f, 75f);
            b.Straight(80f);
            b.Cut("세포체 (Soma)", ZoneKind.Normal, 6f);

            //---------------- C. Hairpin: drift lesson ----------------
            b.Trigger("hint:drift", 0f);
            b.Straight(140f);
            b.Turn(160f, 38f);
            b.Straight(160f, -6f);
            b.Turn(-90f, 60f);
            b.Straight(60f);
            b.Event(TrackEventType.Checkpoint, 0f, "cp1");
            b.Straight(40f);
            b.Cut("드리프트 커브", ZoneKind.Normal, 6f);

            //---------------- E. Axon hillock fork ----------------
            var qH = bank.Get(Q_HILLOCK);
            b.Trigger("forkq:" + Q_HILLOCK, 0f).Trigger("codex:hillock", 0f);
            b.Straight(300f);
            var fork1 = b.Cut("축삭둔덕 갈림길", ZoneKind.ForkApproach, 9f);
            b.Fork(fork1, qH, 380f, 165f, 9f);

            //---------------- D. Action potential gates (initial segment) ----------------
            b.Trigger("story:ap", 0f).Trigger("codex:ap", 0f);
            const float GATE_GAP = 230f;
            for (int g = 0; g < Q_AP.Length; g++)
            {
                var q = bank.Get(Q_AP[g]);
                float s0 = 60f + g * GATE_GAP;
                b.EventAt(TrackEventType.Trigger, s0, 0f, "gateq:" + q.id);
                var gate = b.EventAt(TrackEventType.Gate, s0 + 150f, 0f, "ap");
                gate.questionId = q.id;
                gate.laneX = LaneX(q.options.Length, 6f);
                gate.correctLane = q.answer;
                gate.index = g;
            }
            b.Straight(60f + Q_AP.Length * GATE_GAP);
            b.Cut("활동전위 게이트", ZoneKind.Normal, 9f);

            //---------------- F. Myelinated axon: saltatory conduction tunnel ----------------
            b.Trigger("story:saltatory", 0f).Trigger("codex:myelin", 0f).Trigger("codex:ranvier", 30f);
            b.Straight(300f);
            b.Turn(40f, 200f);
            b.Straight(300f);
            b.Turn(-50f, 180f, 8f);
            b.Straight(220f);
            {
                float total = b.Distance;
                int k = 0;
                for (float d = 45f; d < total - 30f; d += 55f, k++)
                {
                    var ring = b.EventAt(TrackEventType.NodeRing, d - total, 3.2f * Mathf.Sin(k * 0.9f));
                    ring.width = 2.6f;    // ring radius
                    ring.index = k;
                }
            }
            b.Cut("말이집 축삭 (도약전도)", ZoneKind.Myelin, 6f);

            //---------------- G. Fork: where is the AP regenerated? ----------------
            var qS = bank.Get(Q_SALTATORY);
            b.Trigger("forkq:" + Q_SALTATORY, 0f);
            b.Straight(280f);
            var fork2 = b.Cut("도약전도 갈림길", ZoneKind.ForkApproach, 9f);
            b.Fork(fork2, qS, 400f, 170f, 6f);

            //---------------- H. Demyelinated zone (NULL damage) ----------------
            b.Trigger("story:damage", 0f).Trigger("codex:demyelination", 0f);
            b.Straight(250f);
            b.Turn(-45f, 150f);
            b.Straight(330f);
            {
                float total = b.Distance;
                float[] obsS = { 70f, 140f, 200f, 270f, 330f, 400f, 460f };
                float[] obsX = { 0f, -3f, 3f, 0f, -2.5f, 2.5f, 0f };
                for (int i = 0; i < obsS.Length; i++)
                {
                    var o = b.EventAt(TrackEventType.Obstacle, obsS[i] - total, obsX[i]);
                    o.width = i % 3 == 0 ? 7.5f : 3.2f;   // full-width blocks must be JUMPED
                    o.height = 1.3f;
                }
                float[] repS = { 110f, 240f, 370f };
                float[] repX = { 3f, -3f, 3f };
                for (int i = 0; i < repS.Length; i++) b.EventAt(TrackEventType.RepairOrb, repS[i] - total, repX[i]).index = i;
                var qG = bank.Get(Q_GLIA);
                b.EventAt(TrackEventType.Trigger, 420f - total, 0f, "gateq:" + qG.id);
                var gate = b.EventAt(TrackEventType.Gate, 540f - total, 0f, "glia");
                gate.questionId = qG.id;
                gate.laneX = LaneX(qG.options.Length, 4f);
                gate.correctLane = qG.answer;
            }
            b.Cut("수초 손상 구간", ZoneKind.Damaged, 6f);

            //---------------- I. Axon terminal corners ----------------
            b.Trigger("codex:terminal", 0f).Trigger("banner:terminal", 0f);
            b.Straight(120f);
            b.Turn(90f, 70f);
            b.StraightWith(80f, 3, (i, s) => b.EventAt(TrackEventType.Orb, s, 0f));
            b.Turn(-120f, 45f);
            b.Straight(100f);
            b.Event(TrackEventType.Checkpoint, 0f, "cp2");
            b.Cut("축삭종말", ZoneKind.Normal, 6f);

            //---------------- J. Synapse ----------------
            b.Trigger("codex:synapse", 0f);
            b.Straight(90f);
            b.Event(TrackEventType.Trigger, 0f, "synapse:minigame", -45f);
            b.Cut("시냅스전 막", ZoneKind.Normal, 6f);
            b.Trigger("synapse:cross", 0f);
            b.Straight(50f);
            b.Cut("시냅스 틈새", ZoneKind.Synapse, 5f);

            //---------------- K. Postsynaptic final sprint ----------------
            b.Trigger("codex:postsynaptic", 0f).Trigger("story:final", 5f);
            b.StraightWith(300f, 8, (i, s) => b.EventAt(TrackEventType.Orb, s, 2.8f * Mathf.Sin(i * 1.1f)));
            b.Turn(50f, 160f);
            b.Straight(250f);
            b.Event(TrackEventType.Finish, 0f, "finish", -10f);
            b.Cut("시냅스후 뉴런", ZoneKind.Normal, 6f);

            var g2 = b.graph;
            g2.referenceLength = ShortestLength(g2);
            // par = shortest route at a realistic average + minigame allowance
            g2.parTime = g2.referenceLength / 34f + 30f;
            return g2;
        }

        public static float[] LaneX(int lanes, float spacing)
        {
            var x = new float[lanes];
            for (int i = 0; i < lanes; i++) x[i] = (i - (lanes - 1) * 0.5f) * spacing;
            return x;
        }

        /// Length of the shortest start -> finish route (dynamic programming over the DAG).
        public static float ShortestLength(TrackGraph g)
        {
            var memo = new Dictionary<TrackSegment, float>();
            return Shortest(g.start, memo);
        }

        static float Shortest(TrackSegment s, Dictionary<TrackSegment, float> memo)
        {
            float v;
            if (memo.TryGetValue(s, out v)) return v;
            float best = 0f;
            if (s.next.Count > 0)
            {
                best = float.MaxValue;
                foreach (var n in s.next) best = Mathf.Min(best, Shortest(n, memo));
            }
            v = s.length + best;
            memo[s] = v;
            return v;
        }
    }
}
