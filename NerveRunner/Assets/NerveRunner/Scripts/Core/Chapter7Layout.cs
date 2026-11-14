// NERVE RUNNER - CHAPTER 7 "대뇌 도시" (Cerebrum City).
// The course tours the four lobes in anatomical order: frontal -> parietal -> temporal ->
// occipital. Each fork asks where a kind of information is processed; the CORRECT branch leads
// into the next district (the information reaches the right lobe). Gates inside each district
// test that lobe's functions and the classic aphasias.
using UnityEngine;

namespace NerveRunner.Core
{
    public static class Chapter7Layout
    {
        public const string StageId = "ch7";
        public const string Q_GATE_M1 = "ch7_gate_m1";
        public const string Q_GATE_BROCA = "ch7_gate_broca";
        public const string Q_FORK_S1 = "ch7_fork_s1";
        public const string Q_GATE_NEGLECT = "ch7_gate_neglect";
        public const string Q_FORK_A1 = "ch7_fork_a1";
        public const string Q_GATE_WERNICKE = "ch7_gate_wernicke";
        public const string Q_GATE_HIPPO = "ch7_gate_hippocampus";
        public const string Q_FORK_V1 = "ch7_fork_v1";

        static void Gate(TrackPathBuilder b, QuestionBank bank, string qid, float at, string tag, float spacing)
        {
            var q = bank.Get(qid);
            b.EventAt(TrackEventType.Trigger, at, 0f, "gateq:" + qid);
            var g = b.EventAt(TrackEventType.Gate, at + 175f, 0f, tag);
            g.questionId = qid;
            g.laneX = Chapter1Layout.LaneX(q.options.Length, spacing);
            g.correctLane = q.answer;
        }

        public static TrackGraph Build(QuestionBank bank)
        {
            var b = new TrackPathBuilder(Vector3.zero, 0f);

            //---------------- FRONTAL district (planning, motor, speech production) ----------------
            b.Trigger("story:ch7_intro", 1f).Trigger("codex:frontal", 20f).Trigger("hint:steer", 30f);
            b.StraightWith(220f, 6, (i, s) => b.EventAt(TrackEventType.Orb, s, i % 2 == 0 ? -2.5f : 2.5f), 4f);
            b.Turn(45f, 150f);
            b.Straight(120f, 6f);
            b.Turn(-50f, 120f);
            b.Cut("이마엽 지구 (Frontal)", ZoneKind.Normal, 6f, "frontal");

            b.Trigger("codex:m1", 10f).Trigger("codex:broca", 300f);
            Gate(b, bank, Q_GATE_M1, 40f, "lobe", 6f);
            Gate(b, bank, Q_GATE_BROCA, 340f, "lobe", 6f);
            b.Straight(600f, -4f);
            b.Cut("이마엽 · 운동/언어 게이트", ZoneKind.Normal, 9f, "frontal");

            b.Trigger("forkq:" + Q_FORK_S1, 0f);
            b.Straight(300f);
            var f1 = b.Cut("감각 정보 갈림길", ZoneKind.ForkApproach, 9f, "frontal");
            b.Fork(f1, bank.Get(Q_FORK_S1), 380f, 150f, 6f);

            //---------------- PARIETAL district (body sensation, space) ----------------
            b.Trigger("story:ch7_parietal", 0f).Trigger("codex:parietal", 0f).Trigger("codex:s1", 20f);
            b.StraightWith(160f, 4, (i, s) => b.EventAt(TrackEventType.Orb, s, 0f), 8f);
            b.Turn(60f, 110f);
            b.Straight(80f);
            b.Turn(-70f, 90f);
            b.Cut("마루엽 지구 (Parietal)", ZoneKind.Normal, 6f, "parietal");

            Gate(b, bank, Q_GATE_NEGLECT, 40f, "lobe", 6f);
            b.Straight(280f);
            b.Cut("마루엽 · 공간 인식 게이트", ZoneKind.Normal, 9f, "parietal");

            b.Trigger("forkq:" + Q_FORK_A1, 0f);
            b.Straight(300f);
            var f2 = b.Cut("청각 정보 갈림길", ZoneKind.ForkApproach, 9f, "parietal");
            b.Fork(f2, bank.Get(Q_FORK_A1), 400f, 160f, 6f);

            //---------------- TEMPORAL district (hearing, language comprehension, memory) ----------------
            b.Trigger("story:ch7_temporal", 0f).Trigger("codex:temporal", 0f).Trigger("codex:a1", 20f);
            b.Turn(-45f, 160f, -6f);
            b.StraightWith(140f, 3, (i, s) => b.EventAt(TrackEventType.Orb, s, 2.6f * Mathf.Sin(i * 1.3f)));
            b.Turn(80f, 70f);
            b.Straight(60f);
            b.Cut("관자엽 지구 (Temporal)", ZoneKind.Normal, 6f, "temporal");

            b.Trigger("codex:wernicke", 10f).Trigger("codex:hippocampus", 300f);
            Gate(b, bank, Q_GATE_WERNICKE, 40f, "lobe", 6f);
            Gate(b, bank, Q_GATE_HIPPO, 340f, "lobe", 6f);
            b.Straight(600f, 4f);
            b.Cut("관자엽 · 언어/기억 게이트", ZoneKind.Normal, 9f, "temporal");

            b.Trigger("forkq:" + Q_FORK_V1, 0f);
            b.Straight(300f);
            var f3 = b.Cut("시각 정보 갈림길", ZoneKind.ForkApproach, 9f, "temporal");
            b.Fork(f3, bank.Get(Q_FORK_V1), 380f, 150f, 9f);

            //---------------- OCCIPITAL district (vision) -> finish ----------------
            b.Trigger("story:ch7_occipital", 0f).Trigger("codex:occipital", 0f).Trigger("codex:v1", 20f);
            b.StraightWith(260f, 7, (i, s) => b.EventAt(TrackEventType.Orb, s, 2.8f * Mathf.Sin(i * 1.1f)));
            b.Turn(-40f, 170f);
            b.Straight(200f);
            b.Event(TrackEventType.Finish, 0f, "finish", -10f);
            b.Cut("뒤통수엽 지구 (Occipital)", ZoneKind.Normal, 6f, "occipital");

            var g = b.graph;
            g.referenceLength = Chapter1Layout.ShortestLength(g);
            g.parTime = g.referenceLength / 38f + 10f;
            return g;
        }
    }
}
