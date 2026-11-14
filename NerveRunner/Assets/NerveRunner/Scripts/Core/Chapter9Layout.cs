// NERVE RUNNER - CHAPTER 9 "NULL 보스 아레나" (clinical reasoning boss).
// A rising spiral track circles the NULL core (at the origin). Every boss gate is a clinical
// vignette: steer into the lane with the correct LESION LOCATION to hit NULL's shield. NULL
// attacks with full-width pulse waves (jump) and glitch blocks (dodge). The last question is a
// fork: the correct diagnosis opens the escape shortcut out of the arena.
using UnityEngine;

namespace NerveRunner.Core
{
    public static class Chapter9Layout
    {
        public const string StageId = "ch9";
        public const float ARENA_R = 170f;
        public static readonly string[] Q_BOSS = { "ch9_boss_cst", "ch9_boss_hemianopia", "ch9_boss_cerebellum", "ch9_boss_lmn", "ch9_boss_wernicke" };
        public const string Q_FINAL = "ch9_final_brownsequard";

        /// left turn around the arena centre (origin)
        static void Arc(TrackPathBuilder b, float deg, float rise) { b.Turn(-deg, ARENA_R, rise); }

        public static TrackGraph Build(QuestionBank bank)
        {
            var b = new TrackPathBuilder(new Vector3(ARENA_R, 0f, 0f), 0f);

            b.Trigger("story:ch9_intro", 1f).Trigger("codex:decussation", 40f).Trigger("hint:steer", 20f);
            Arc(b, 60f, 4f);
            b.EventAt(TrackEventType.Orb, 20f, -2f); b.EventAt(TrackEventType.Orb, 60f, 2f);
            Arc(b, 50f, 4f);
            b.Cut("NULL 아레나 외곽", ZoneKind.Normal, 7f, "boss");

            for (int k = 0; k < Q_BOSS.Length; k++)
            {
                var q = bank.Get(Q_BOSS[k]);
                // ---- diagnosis gate (wide road) ----
                b.EventAt(TrackEventType.Trigger, 15f, 0f, "gateq:" + q.id);
                var g = b.EventAt(TrackEventType.Gate, 190f, 0f, "boss");
                g.questionId = q.id;
                g.laneX = Chapter1Layout.LaneX(q.options.Length, 6f);
                g.correctLane = q.answer;
                g.index = k;
                Arc(b, 75f, 6f);
                b.Cut("NULL 진단 게이트 " + (k + 1), ZoneKind.Normal, 9f, "boss");

                // ---- NULL counter-attack: pulse wave (jump) + glitch blocks (dodge) ----
                b.Trigger("boss:attack", 5f);
                for (int w = 0; w < 2; w++)
                {
                    float o = w * 125f;
                    var wave = b.EventAt(TrackEventType.Obstacle, 45f + o, 0f, "pulse");
                    wave.width = 16f; wave.height = 1.2f;
                    var blk = b.EventAt(TrackEventType.Obstacle, 95f + o, (k + w) % 2 == 0 ? -3f : 3f, "glitch");
                    blk.width = 3.4f; blk.height = 1.4f;
                    b.EventAt(TrackEventType.Orb, 70f + o, 0f);
                    b.EventAt(TrackEventType.Orb, 118f + o, (k + w) % 2 == 0 ? 3f : -3f);
                }
                Arc(b, 95f, 6f);
                b.Cut("NULL 반격 구간", ZoneKind.Normal, 7f, "boss");
            }

            // ---- final diagnosis: the correct branch is the escape shortcut ----
            b.Trigger("forkq:" + Q_FINAL, 0f).Trigger("codex:brown_sequard", 0f);
            Arc(b, 70f, 2f);
            var f = b.Cut("최종 진단 갈림길", ZoneKind.ForkApproach, 9f, "boss");
            b.Fork(f, bank.Get(Q_FINAL), 380f, 140f, 9f);

            b.Trigger("story:ch9_final", 0f);
            b.StraightWith(260f, 6, (i, s) => b.EventAt(TrackEventType.Orb, s, 2.5f * Mathf.Sin(i * 1.2f)));
            b.Event(TrackEventType.Finish, 0f, "finish", -10f);
            b.Cut("신경망 복구 탈출로", ZoneKind.Normal, 6f, "boss");

            var gr = b.graph;
            gr.referenceLength = Chapter1Layout.ShortestLength(gr);
            gr.parTime = gr.referenceLength / 38f + 10f;
            return gr;
        }

        public static int BossHp { get { return Q_BOSS.Length + 1; } }
    }
}
