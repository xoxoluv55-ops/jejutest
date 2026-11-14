// Headless verification of NERVE RUNNER Chapter 1 logic (track graph, physics, forks, gates,
// learning records). Run:  dotnet run --project Tools/SimTests
// This verifies the GAME LOGIC only - it does not render anything and does not replace a
// play test inside the Unity editor / on an iPad.
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using NerveRunner.Core;
using UnityEngine;

static class Program
{
    static int failures;
    static void Check(bool ok, string what)
    {
        Console.WriteLine((ok ? "  PASS " : "  FAIL ") + what);
        if (!ok) failures++;
    }

    static string Root()
    {
        var d = new DirectoryInfo(AppContext.BaseDirectory);
        while (d != null && !Directory.Exists(Path.Combine(d.FullName, "NerveRunner"))) d = d.Parent;
        return d.FullName;
    }

    static T Load<T>(string file)
    {
        var p = Path.Combine(Root(), "NerveRunner/Assets/NerveRunner/Resources/NerveRunner", file);
        return JsonSerializer.Deserialize<T>(File.ReadAllText(p), new JsonSerializerOptions { IncludeFields = true });
    }

    static int Main()
    {
        var qf = Load<QuestionFile>("questions_ch1.json");
        var cf = Load<CodexFile>("codex_ch1.json");
        var sf = Load<StoryFile>("story_ch1.json");
        var bank = new QuestionBank(qf.questions);

        Console.WriteLine("[1] Content");
        var errs = bank.Validate();
        foreach (var e in errs) Console.WriteLine("     " + e);
        Check(errs.Count == 0, $"question bank valid ({bank.all.Count} questions)");
        var codexIds = new HashSet<string>(cf.entries.Select(e => e.id));
        var missing = bank.all.SelectMany(q => q.structures ?? new string[0]).Where(s => !codexIds.Contains(s)).Distinct().ToList();
        Check(missing.Count == 0, "every question.structures id exists in codex " + string.Join(",", missing));
        var ids = new[] { Chapter1Layout.Q_HILLOCK, Chapter1Layout.Q_SALTATORY, Chapter1Layout.Q_GLIA, Chapter1Layout.Q_SYN_ORDER, Chapter1Layout.Q_SYN_EPSP }.Concat(Chapter1Layout.Q_AP);
        Check(ids.All(i => bank.Get(i) != null), "every question id used by the course exists");
        Check(sf.beats.Length >= 5, "story beats loaded");

        Console.WriteLine("[2] Track graph");
        var g = Chapter1Layout.Build(bank);
        Console.WriteLine($"     segments={g.segments.Count} shortest route={g.referenceLength:F0} m  par={g.parTime:F0} s");
        Check(g.segments.All(s => s.length > 10f), "all segments have length");
        // codex triggers reference existing codex entries
        var codexTriggers = g.AllEvents().Where(e => e.type == TrackEventType.Trigger && e.tag.StartsWith("codex:")).Select(e => e.tag.Substring(6)).ToList();
        Check(codexTriggers.All(codexIds.Contains), "codex triggers reference existing entries");
        var storyIds = new HashSet<string>(sf.beats.Select(b => b.id));
        var storyTriggers = g.AllEvents().Where(e => e.type == TrackEventType.Trigger && e.tag.StartsWith("story:")).Select(e => e.tag.Substring(6)).ToList();
        Check(storyTriggers.All(storyIds.Contains), "story triggers reference existing beats");

        float worstJoin = 0f;
        foreach (var s in g.segments)
        {
            for (int i = 0; i < s.next.Count; i++)
            {
                var n = s.next[i];
                Vector3 end = s.PointAt(s.length);
                Vector3 expected;
                if (s.fork != null) expected = end + s.RightAt(s.length) * s.nextStartOffset[i];
                else expected = end - n.RightAt(0f) * s.mergeOffset;
                worstJoin = Math.Max(worstJoin, (n.PointAt(0f) - expected).magnitude);
            }
        }
        Check(worstJoin < 0.75f, $"segment joins are continuous (worst gap {worstJoin:F2} m)");
        var forks = g.segments.Where(s => s.fork != null).ToList();
        Check(forks.Count == 2 && forks.All(f => f.next.Count == bank.Get(f.fork.questionId).options.Length), "forks have one branch per option");
        foreach (var f in forks)
        {
            var lens = f.next.Select(n => n.length).ToList();
            Console.WriteLine($"     fork {f.fork.questionId}: branch lengths {string.Join(" / ", lens.Select(l => l.ToString("F0")))} (correct lane {f.fork.correctLane})");
            Check(lens[f.fork.correctLane] < lens.Where((l, i) => i != f.fork.correctLane).Min(), $"correct branch is the shortcut ({f.fork.questionId})");
        }
        OverlapCheck(g);

        Console.WriteLine("[3] Play-through: autopilot, all answers correct");
        var r1 = Run(g, bank, (q, c, n) => c, true);
        Check(r1.finished, $"finished in {r1.time:F1} s race time (+ synapse minigame), distance {r1.distance:F0} m");
        Check(r1.wrong == 0 && r1.correct == 7, $"7/7 track questions correct (got {r1.correct} correct, {r1.wrong} wrong)");
        Check(r1.ringsHit >= r1.ringsTotal * 0.7f, $"saltatory rings chained {r1.ringsHit}/{r1.ringsTotal}, best chain {r1.ringBest}");
        Check(r1.obstacleHits <= 1, $"obstacles avoided (hits {r1.obstacleHits})");
        Check(r1.repair == 3, "myelin fully repaired");
        Check(r1.minigames == 1, "synapse minigame triggered exactly once");
        Check(r1.drifts > 3 && r1.turbos > 0, $"drifts used ({r1.drifts}), mini-turbos earned ({r1.turbos})");
        Check(r1.time + 35f > 150f && r1.time + 35f < 330f, "total play time within 3-5 min window incl. minigame/reading (~35 s)");
        Check(r1.codex == codexTriggers.Count, $"all codex triggers fired ({r1.codex}/{codexTriggers.Count})");

        Console.WriteLine("[4] Play-through: autopilot, all answers WRONG");
        var r2 = Run(g, bank, (q, c, n) => (c + 1) % n, true);
        Check(r2.finished, $"finished in {r2.time:F1} s");
        Check(r2.correct == 0 && r2.wrong == 7, $"all 7 recorded wrong (got {r2.wrong})");
        Check(r2.time > r1.time + 20f, $"wrong answers cost time (+{r2.time - r1.time:F1} s)");
        Check(r2.reviews == 2, "both forks routed into review branches");

        Console.WriteLine("[5] No input at all (must not soft-lock)");
        var r3 = Run(g, bank, null, false);
        Check(r3.finished && r3.time < 600f, $"finished in {r3.time:F1} s, wall hits {r3.wallHits}");
        Check(r3.time > r1.time + 30f, $"skilled driving is clearly faster than no input (+{r3.time - r1.time:F1} s)");

        Console.WriteLine("[6] Random input fuzz");
        var rng = new System.Random(1234);
        bool fuzzOk = true;
        for (int k = 0; k < 6; k++)
        {
            var r = Run(g, bank, null, false, rng);
            fuzzOk &= r.finished && !float.IsNaN(r.time) && r.time < 600f;
            Console.WriteLine($"     run {k}: {(r.finished ? "finished" : "STUCK")} {r.time:F1} s, correct {r.correct}/{r.correct + r.wrong}");
        }
        Check(fuzzOk, "all fuzz runs finish without NaN / soft-lock");

        Console.WriteLine("[7] Learning records / wrong-answer notes");
        var save = new SaveData();
        var ls = new LearningSession(bank);
        ls.Answer("ch1_ap_1", 0, 1f); ls.Answer("ch1_ap_2", 2, 2f); ls.Answer("ch1_fork_hillock", 1, 3f);
        int changed = ls.MergeInto(save, "2026-11-14");
        Check(changed == 2 && save.wrongNotes.Count == 2, "wrong answers saved to notes");
        Check(Math.Abs(ls.Accuracy - 1f / 3f) < 1e-4, "accuracy computed");
        var ls2 = new LearningSession(bank);
        ls2.Answer("ch1_ap_1", 1, 1f);
        ls2.MergeInto(save, "2026-11-15");
        var note = save.Note("ch1_ap_1");
        Check(note.resolved && note.retryCount == 1, "re-answering correctly resolves the note and counts the retry");
        Check(save.codexUnlocked.Contains("ap") && save.codexUnlocked.Contains("hillock"), "codex unlocked from answered questions");

        Console.WriteLine(failures == 0 ? "\nALL CHECKS PASSED" : $"\n{failures} CHECK(S) FAILED");
        return failures == 0 ? 0 : 1;
    }

    class Result
    {
        public bool finished; public float time, distance;
        public int correct, wrong, ringsHit, ringsTotal, ringBest, obstacleHits, wallHits, repair, minigames, drifts, turbos, reviews, codex;
    }

    static Result Run(TrackGraph g, QuestionBank bank, Func<string, int, int, int> choose, bool bot, System.Random rng = null)
    {
        var sim = new RunnerSim(g);
        var ap = new AutoPilot();
        if (choose != null) ap.chooseLane = choose;
        var learn = new LearningSession(bank);
        var res = new Result();
        const float dt = 1f / 60f;
        float steerHold = 0f; int holdFrames = 0;
        for (int frame = 0; frame < 60 * 900 && !sim.finished; frame++)
        {
            RunnerInput inp;
            if (bot) inp = ap.Think(sim);
            else if (rng != null)
            {
                if (holdFrames-- <= 0) { steerHold = (float)(rng.NextDouble() * 2 - 1); holdFrames = rng.Next(10, 90); }
                inp = new RunnerInput { steer = steerHold, jump = rng.Next(120) == 0, drift = rng.Next(4) == 0, boost = rng.Next(3) == 0 };
            }
            else inp = new RunnerInput();
            sim.Step(inp, dt);
            foreach (var e in sim.events)
            {
                switch (e.type)
                {
                    case SimEventType.GateResult:
                    {
                        bool ok = learn.Answer(e.src.questionId, e.lane, sim.raceTime);
                        if (ok != e.correct) throw new Exception("gate correctness mismatch");
                        if (ok) res.correct++; else res.wrong++;
                        break;
                    }
                    case SimEventType.ForkChosen:
                    {
                        bool ok = learn.Answer(e.tag, e.lane, sim.raceTime);
                        if (ok != e.correct) throw new Exception("fork correctness mismatch");
                        if (ok) res.correct++; else { res.wrong++; res.reviews++; }
                        break;
                    }
                    case SimEventType.Trigger:
                        if (e.tag == "synapse:minigame") { res.minigames++; sim.ApplySynapseResult(true); }
                        if (e.tag.StartsWith("codex:")) res.codex++;
                        break;
                    case SimEventType.DriftStart: res.drifts++; break;
                    case SimEventType.DriftEnd: if (e.tier > 0) res.turbos++; break;
                }
                if (float.IsNaN(sim.x) || float.IsNaN(sim.speed)) throw new Exception("NaN in sim");
            }
            sim.events.Clear();
        }
        res.finished = sim.finished; res.time = sim.raceTime; res.distance = sim.distance;
        res.ringsHit = sim.ringsHit; res.ringsTotal = sim.ringsTotal; res.ringBest = sim.ringBest;
        res.obstacleHits = sim.obstacleHits; res.wallHits = sim.wallHits; res.repair = sim.repairCount;
        Console.WriteLine($"     time {res.time:F1}s  coins {sim.coins}  walls {sim.wallHits}  obstacles {sim.obstacleHits}  rings {sim.ringsHit}/{sim.ringsTotal}");
        return res;
    }

    /// Two unrelated pieces of road must not pass through each other.
    static void OverlapCheck(TrackGraph g)
    {
        var related = new HashSet<(int, int)>();
        foreach (var s in g.segments)
        {
            related.Add((s.id, s.id));
            foreach (var n in s.next) { related.Add((s.id, n.id)); related.Add((n.id, s.id)); foreach (var m in n.next) { related.Add((s.id, m.id)); related.Add((m.id, s.id)); } }
            foreach (var a in s.next) foreach (var b in s.next) related.Add((a.id, b.id));
        }
        float worst = float.MaxValue; string where = "";
        foreach (var a in g.segments)
            foreach (var b in g.segments)
            {
                if (a.id >= b.id || related.Contains((a.id, b.id))) continue;
                for (float sa = 0; sa < a.length; sa += 6f)
                {
                    var pa = a.PointAt(sa);
                    for (float sb = 0; sb < b.length; sb += 6f)
                    {
                        var pb = b.PointAt(sb);
                        if (Math.Abs(pa.y - pb.y) > 8f) continue;
                        float d = (float)Math.Sqrt((pa.x - pb.x) * (pa.x - pb.x) + (pa.z - pb.z) * (pa.z - pb.z));
                        if (d < worst) { worst = d; where = $"{a.name}@{sa:F0} vs {b.name}@{sb:F0}"; }
                    }
                }
            }
        Check(worst > 22f, $"no overlapping roads (closest unrelated approach {worst:F0} m: {where})");
    }
}
