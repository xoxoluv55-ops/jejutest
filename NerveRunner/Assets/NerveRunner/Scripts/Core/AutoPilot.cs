// NERVE RUNNER - simple autopilot. Used by the headless play-through tests (Tools/SimTests)
// and by the in-game "AUTO" demo toggle. It only produces RunnerInput - it plays by the same
// rules as a human (steers into lanes, drifts corners, jumps obstacles).
using UnityEngine;

namespace NerveRunner.Core
{
    public class AutoPilot
    {
        /// Decides which option the bot picks for a question (lane index). Default: correct.
        public System.Func<string, int, int, int> chooseLane = (qid, correct, lanes) => correct;
        public bool useDrift = true, useBoost = true;

        bool driftHeld;

        public RunnerInput Think(RunnerSim sim)
        {
            var seg = sim.seg;
            float targetX = 0f;
            bool haveTarget = false;
            bool jump = false;
            float look = Mathf.Max(60f, sim.speed * 2.2f);

            // fork at the end of this segment
            if (seg.fork != null && seg.length - sim.s < 220f)
            {
                int lane = chooseLane(seg.fork.questionId, seg.fork.correctLane, seg.fork.laneX.Length);
                targetX = seg.fork.laneX[lane]; haveTarget = true;
            }

            for (int i = 0; i < seg.events.Count && !haveTarget; i++)
            {
                var e = seg.events[i];
                if (e.consumed || e.s < sim.s) continue;
                float d = e.s - sim.s;
                if (d > look) break;
                switch (e.type)
                {
                    case TrackEventType.Gate:
                        targetX = e.laneX[chooseLane(e.questionId, e.correctLane, e.laneX.Length)]; haveTarget = true; break;
                    case TrackEventType.NodeRing:
                    case TrackEventType.RepairOrb:
                        targetX = e.x; haveTarget = true; break;
                    case TrackEventType.Obstacle:
                        if (e.width >= seg.halfWidth) { if (d < sim.speed * 0.3f + 1f) jump = true; }
                        else { targetX = e.x + (e.x <= 0f ? 1f : -1f) * (e.width * 0.5f + 2.2f); haveTarget = true; }
                        break;
                    case TrackEventType.Orb:
                        if (d < 40f) { targetX = e.x; haveTarget = true; }
                        break;
                }
            }

            float k = sim.Curvature;
            float push = -k * sim.speed * sim.speed * (sim.Drifting ? sim.driftGrip : sim.grip);
            float sm = sim.steerMax * sim.steerSensitivity * (sim.Drifting ? sim.driftSteerMul : 1f);
            float desiredVx = (haveTarget ? targetX - sim.x : -sim.x * 0.5f) * 2.5f;
            float steer = Mathf.Clamp((desiredVx - push) / Mathf.Max(1f, sm), -1f, 1f);

            if (useDrift)
            {
                if (!driftHeld && Mathf.Abs(k) > 0.014f && sim.speed > 18f) driftHeld = true;
                else if (driftHeld && Mathf.Abs(k) < 0.006f) driftHeld = false;
            }
            // drift needs a steer input in the corner direction to start
            if (driftHeld && !sim.Drifting && Mathf.Abs(steer) < 0.2f) steer = Mathf.Sign(k) * 0.3f;

            bool boost = useBoost && sim.boostEnergy > 0.45f && Mathf.Abs(k) < 0.004f;
            return new RunnerInput { steer = steer, jump = jump, drift = driftHeld, boost = boost };
        }
    }
}
