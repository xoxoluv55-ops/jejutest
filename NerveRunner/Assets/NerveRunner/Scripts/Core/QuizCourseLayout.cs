// NERVE RUNNER - data-driven course builder for the chapters that are mainly "learn & race"
// (CH.2 spinal cord, CH.3 tracts, CH.4 brainstem, CH.5 cerebellum, CH.6 diencephalon,
// CH.8 cranial nerves). A course is a list of steps; geometry alternates turn directions so
// the road zig-zags forward. Every step reuses the proven modules of TrackPathBuilder.
//   warm | gate:<qid> | fork:<qid> | hairpin | obstacles | orbs | finish
//   story:<id> | codex:<id> | hint:<id>   (triggers attached to the next piece)
using UnityEngine;

namespace NerveRunner.Core
{
    public static class QuizCourseLayout
    {
        public static TrackGraph Build(QuestionBank bank, string theme, string title, string[] steps)
        {
            var b = new TrackPathBuilder(Vector3.zero, 0f);
            float dir = 1f;
            int obstacleRuns = 0;
            foreach (var raw in steps)
            {
                int c = raw.IndexOf(':');
                string kind = c >= 0 ? raw.Substring(0, c) : raw;
                string arg = c >= 0 ? raw.Substring(c + 1) : "";
                switch (kind)
                {
                    case "story": case "codex": case "hint":
                        b.Trigger(raw, 5f);
                        break;

                    case "warm":
                        b.Trigger("hint:steer", 30f);
                        b.StraightWith(220f, 6, (i, s) => b.EventAt(TrackEventType.Orb, s, i % 2 == 0 ? -2.5f : 2.5f));
                        b.Turn(dir * 45f, 150f);
                        b.Straight(120f, 4f);
                        b.Cut(title + " 진입로", ZoneKind.Normal, 6f, theme);
                        break;

                    case "gate":
                    {
                        var q = bank.Get(arg);
                        b.EventAt(TrackEventType.Trigger, 40f, 0f, "gateq:" + q.id);
                        var g = b.EventAt(TrackEventType.Gate, 215f, 0f, "quiz");
                        g.questionId = q.id;
                        g.laneX = Chapter1Layout.LaneX(q.options.Length, q.options.Length == 2 ? 9f : 6f);
                        g.correctLane = q.answer;
                        b.Straight(300f);
                        b.Turn(dir * 35f, 160f);
                        b.Cut(q.topic + " 게이트", ZoneKind.Normal, 9f, theme);
                        break;
                    }

                    case "fork":
                    {
                        var q = bank.Get(arg);
                        b.Trigger("forkq:" + q.id, 0f);
                        b.Straight(300f);
                        var f = b.Cut(q.topic + " 갈림길", ZoneKind.ForkApproach, 9f, theme);
                        b.Fork(f, q, 380f, 150f, q.options.Length == 2 ? 9f : 6f);
                        break;
                    }

                    case "hairpin":
                        b.Trigger("hint:drift", 0f);
                        b.Straight(100f);
                        b.Turn(dir * 140f, 42f);
                        b.Straight(150f, -4f);
                        b.Turn(-dir * 80f, 70f);
                        b.Straight(60f);
                        b.Cut("드리프트 커브", ZoneKind.Normal, 6f, theme);
                        break;

                    case "obstacles":
                    {
                        b.Trigger("hint:jump", 0f);
                        float[] xs = { -3f, 3f, 0f, 3f, -3f };
                        for (int i = 0; i < xs.Length; i++)
                        {
                            bool full = i == 2;
                            var o = b.EventAt(TrackEventType.Obstacle, 60f + i * 55f, xs[i], full ? "pulse" : "glitch");
                            o.width = full ? 16f : 3.2f; o.height = 1.3f;
                            b.EventAt(TrackEventType.Orb, 85f + i * 55f, -xs[i] * 0.8f);
                        }
                        b.Straight(360f);
                        b.Turn(dir * 40f, 140f);
                        b.Cut(obstacleRuns++ == 0 ? "NULL 교란 구간" : "NULL 교란 구간 " + obstacleRuns, ZoneKind.Normal, 6f, theme);
                        break;
                    }

                    case "orbs":
                        b.StraightWith(200f, 6, (i, s) => b.EventAt(TrackEventType.Orb, s, 2.6f * Mathf.Sin(i * 1.2f)));
                        b.Turn(dir * 50f, 130f, 5f);
                        b.Cut("신호 가속 구간", ZoneKind.Normal, 6f, theme);
                        break;

                    case "finish":
                        b.StraightWith(260f, 6, (i, s) => b.EventAt(TrackEventType.Orb, s, 2.4f * Mathf.Sin(i * 1.4f)));
                        b.Event(TrackEventType.Finish, 0f, "finish", -10f);
                        b.Cut(title + " 결승", ZoneKind.Normal, 6f, theme);
                        break;
                }
                if (kind != "story" && kind != "codex" && kind != "hint") dir = -dir;
            }
            var g2 = b.graph;
            g2.referenceLength = Chapter1Layout.ShortestLength(g2);
            // 3rd-star target: a clean run with drifts/boosts beats it, coasting without input does not
            // (tuned with Tools/SimTests: clean ~40.4 m/s, no input ~38 m/s on these courses)
            g2.parTime = g2.referenceLength / 39.2f;
            return g2;
        }
    }
}
