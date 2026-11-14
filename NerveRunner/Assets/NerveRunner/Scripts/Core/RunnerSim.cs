// NERVE RUNNER - STAR-01 movement simulation (pure C#, deterministic, unit-testable).
//
// The star rides a track-relative frame (segment, s = distance along, x = lateral, y = jump
// height) instead of a car rigidbody: no wheels, suspension or engine - only the FEEL of
// kart racing is kept: auto-forward speed, cornering with centrifugal push, drift with
// mini-turbo tiers, boost with hysteresis, jumps and fork selection by steering.
//
// Drift tiers / speed scrub and the boost hysteresis latch are ADAPTED from Neon Racer
// (MIT, https://github.com/pinchasVaknin/neon-racer - DriftSystem.cs, BoostSystem.cs).
// Changes: drift is a pure class; charge depends on drift PRECISION (drifting in a real
// corner in the corner's direction) instead of raw speed; boost does not regenerate on its
// own - it is charged by drifts, energy orbs and correct answers.
using System.Collections.Generic;
using UnityEngine;

namespace NerveRunner.Core
{
    public struct RunnerInput
    {
        public float steer;      // -1..1
        public bool jump;        // pressed this step
        public bool drift;       // held
        public bool boost;       // held
    }

    public enum SimEventType
    {
        Trigger, GateResult, ForkChosen, RingHit, RingMiss, ObstacleHit, ObstacleDodged,
        OrbCollected, RepairOrb, WallHit, Checkpoint, Finish,
        DriftStart, DriftEnd, BoostStart, Jump, Land, EnterSegment,
    }

    public struct SimEvent
    {
        public SimEventType type;
        public TrackEvent src;
        public TrackSegment seg;
        public int lane;
        public bool correct;
        public int tier;
        public string tag;
    }

    public class RunnerSim
    {
        //================== TUNING ==================\\
        public float baseTopSpeed = 40f;       // m/s (~144 km/h)
        public float accel = 16f;
        public float boostAccel = 30f;
        public float boostMultiplier = 1.4f;
        public float turboMultiplier = 1.25f;
        public float steerMax = 12f;           // lateral m/s at full lock
        public float steerSensitivity = 1f;    // settings
        public float grip = 0.30f;             // centrifugal push factor (normal)
        public float driftGrip = 0.07f;        // centrifugal push factor while drifting
        public float driftSteerMul = 1.4f;
        public float jumpVelocity = 9.5f;
        public float gravity = 26f;
        public const float HOVER = 1.1f;       // star centre above the road
        public const float RADIUS = 0.9f;

        // drift (adapted from Neon Racer DriftSystem)
        const float DRIFT_ENTER_SPEED = 0.32f; // fraction of top speed
        const float TIER1 = 0.45f, TIER2 = 1.1f, TIER3 = 2.0f;
        static readonly float[] TURBO_TIME = { 0f, 0.5f, 0.9f, 1.4f };
        const float DRIFT_SCRUB = 0.06f;
        // boost (adapted from Neon Racer BoostSystem)
        const float BOOST_DRAIN = 0.42f;
        const float BOOST_REENGAGE = 0.2f;

        //================== STATE ==================\\
        public TrackGraph graph;
        public TrackSegment seg;
        public float s, x, y, vx, vy, speed;
        public bool grounded = true;
        public bool finished;
        public float raceTime;
        public float distance;                 // total distance travelled

        public float boostEnergy = 0.35f;      // 0..1
        public bool Boosting { get; private set; }
        bool canFire = true, wasBoosting;

        public bool Drifting { get; private set; }
        public int DriftDir { get; private set; }
        public float DriftTime { get { return driftTime; } }
        public int DriftTierNow { get { return driftTime >= TIER3 ? 3 : driftTime >= TIER2 ? 2 : driftTime >= TIER1 ? 1 : 0; } }
        float driftTime, driftCharge;

        public float turboTimer, penaltyTimer;
        float wallCooldown;
        public int ringChain, ringBest, ringsHit, ringsTotal;
        public int repairCount;
        public int coins;
        public int wallHits, obstacleHits;
        public float synapseBonusTimer;

        public float TargetSpeed { get; private set; }
        public float Curvature { get; private set; }

        public readonly List<SimEvent> events = new List<SimEvent>();

        public RunnerSim(TrackGraph g)
        {
            graph = g;
            Reset();
        }

        public void Reset()
        {
            graph.ResetRuntime();
            seg = graph.start; s = 0f; x = 0f; y = 0f; vx = 0f; vy = 0f; speed = 0f;
            grounded = true; finished = false; raceTime = 0f; distance = 0f;
            boostEnergy = 0.35f; Boosting = false; canFire = true; wasBoosting = false;
            Drifting = false; driftTime = 0f; driftCharge = 0f;
            turboTimer = 0f; penaltyTimer = 0f; wallCooldown = 0f;
            ringChain = 0; ringBest = 0; ringsHit = 0; ringsTotal = 0; repairCount = 0; coins = 0;
            wallHits = 0; obstacleHits = 0; synapseBonusTimer = 0f;
            events.Clear();
        }

        public Vector3 Position { get { return seg.WorldPos(s, x, HOVER + y); } }
        public Vector3 Forward { get { return seg.TangentAt(s); } }
        public Vector3 Right { get { return seg.RightAt(s); } }
        public float Speed01 { get { return Mathf.Clamp01(speed / (baseTopSpeed * boostMultiplier)); } }

        public float ZoneFactor
        {
            get
            {
                switch (seg.zone)
                {
                    case ZoneKind.Review: return 0.7f;
                    case ZoneKind.Damaged: return Mathf.Min(1f, 0.7f + 0.1f * repairCount);
                    default: return 1f;
                }
            }
        }

        public float ChainBonus { get { return Mathf.Min(0.6f, ringChain * 0.08f); } }

        void Emit(SimEventType t, TrackEvent src = null, int lane = -1, bool correct = false, int tier = 0, string tag = null)
        {
            events.Add(new SimEvent { type = t, src = src, seg = seg, lane = lane, correct = correct, tier = tier, tag = tag ?? (src != null ? src.tag : null) });
        }

        public void AddEnergy(float e) { boostEnergy = Mathf.Clamp01(boostEnergy + e); }
        public void AddTurbo(float secs) { turboTimer = Mathf.Max(turboTimer, secs); }
        public void AddPenalty(float secs) { penaltyTimer = Mathf.Max(penaltyTimer, secs); }

        /// Called by the game after the synapse minigame.
        public void ApplySynapseResult(bool success)
        {
            if (success) { AddTurbo(1.6f); AddEnergy(0.3f); synapseBonusTimer = 2f; }
            else AddPenalty(1.0f);
        }

        //================== STEP ==================\\
        public void Step(RunnerInput inp, float dt)
        {
            if (finished || dt <= 0f) return;
            raceTime += dt;
            Curvature = seg.CurvatureAt(s);
            float steer = Mathf.Clamp(inp.steer, -1f, 1f);

            StepDrift(steer, inp.drift, dt);
            StepBoost(inp.boost, dt);

            // ---- longitudinal ----
            float top = baseTopSpeed * ZoneFactor * (1f + ChainBonus);
            if (Boosting) top *= boostMultiplier;
            if (turboTimer > 0f) top *= turboMultiplier;
            if (penaltyTimer > 0f) top *= 0.65f;
            TargetSpeed = top;
            if (speed < top) speed = Mathf.Min(top, speed + ((Boosting || turboTimer > 0f) ? boostAccel : accel) * dt);
            else speed = Mathf.Max(top, speed - 25f * dt);
            if (Drifting) speed *= (1f - DRIFT_SCRUB * dt);

            // ---- lateral: steering vs centrifugal push ----
            float g = Drifting ? driftGrip : grip;
            float push = -Curvature * speed * speed * g;
            float sm = steerMax * steerSensitivity * (Drifting ? driftSteerMul : 1f) * (grounded ? 1f : 0.7f);
            float targetVx = steer * sm + push;
            vx = Mathf.MoveTowards(vx, targetVx, 60f * dt);
            x += vx * dt;

            float limit = seg.halfWidth - RADIUS;
            if (Mathf.Abs(x) > limit)
            {
                float side = Mathf.Sign(x);
                x = side * limit;
                if (vx * side > 0f)
                {
                    if (wallCooldown <= 0f && Mathf.Abs(vx) > 2f)
                    {
                        speed *= 0.8f; wallHits++; wallCooldown = 0.5f;
                        Emit(SimEventType.WallHit);
                    }
                    vx = 0f;
                }
                speed = Mathf.Max(0f, speed - 10f * dt);  // scraping
            }
            if (wallCooldown > 0f) wallCooldown -= dt;

            // ---- vertical ----
            if (inp.jump && grounded)
            {
                vy = jumpVelocity; grounded = false;
                Emit(SimEventType.Jump);
            }
            if (!grounded)
            {
                vy -= gravity * dt;
                y += vy * dt;
                if (y <= 0f) { y = 0f; vy = 0f; grounded = true; Emit(SimEventType.Land); }
            }

            if (turboTimer > 0f) turboTimer -= dt;
            if (penaltyTimer > 0f) penaltyTimer -= dt;
            if (synapseBonusTimer > 0f) synapseBonusTimer -= dt;

            // ---- advance along the graph ----
            float ds = speed * dt;
            distance += ds;
            float prev = s;
            s += ds;
            while (true)
            {
                ProcessEvents(prev, Mathf.Min(s, seg.length));
                if (finished) return;
                if (s < seg.length) break;
                float overflow = s - seg.length;
                if (!Transition()) { s = seg.length; finished = true; Emit(SimEventType.Finish); return; }
                s = overflow; prev = -0.001f;
            }
        }

        void StepDrift(float steer, bool held, float dt)
        {
            bool canDrift = speed > baseTopSpeed * DRIFT_ENTER_SPEED;
            if (!Drifting)
            {
                if (held && canDrift && Mathf.Abs(steer) > 0.15f)
                {
                    Drifting = true; DriftDir = steer > 0f ? 1 : -1; driftTime = 0f; driftCharge = 0f;
                    Emit(SimEventType.DriftStart);
                }
                return;
            }
            if (!held || !canDrift)
            {
                int tier = DriftTierNow;
                Drifting = false;
                if (tier > 0) AddTurbo(TURBO_TIME[tier]);
                AddEnergy(driftCharge);
                driftTime = 0f; driftCharge = 0f;
                Emit(SimEventType.DriftEnd, null, -1, tier > 0, tier);
                return;
            }
            // precision: drifting INTO a real corner, in the corner's direction
            float k = Curvature;
            float precision = (Mathf.Sign(k) == DriftDir) ? Mathf.Clamp01(Mathf.Abs(k) * 60f) : 0f;
            driftTime += dt * (0.35f + 0.65f * precision);
            driftCharge = Mathf.Min(0.5f, driftCharge + dt * 0.12f * (0.25f + 0.75f * precision));
        }

        void StepBoost(bool want, float dt)
        {
            if (boostEnergy <= 0.001f) canFire = false;
            else if (boostEnergy >= BOOST_REENGAGE) canFire = true;
            bool active = want && canFire && boostEnergy > 0f;
            if (active) boostEnergy = Mathf.Max(0f, boostEnergy - BOOST_DRAIN * dt);
            if (active && !wasBoosting) Emit(SimEventType.BoostStart);
            wasBoosting = active;
            Boosting = active;
        }

        static int NearestLane(float[] laneX, float x)
        {
            int best = 0; float bd = float.MaxValue;
            for (int i = 0; i < laneX.Length; i++)
            {
                float d = Mathf.Abs(laneX[i] - x);
                if (d < bd) { bd = d; best = i; }
            }
            return best;
        }

        bool Transition()
        {
            if (seg.next.Count == 0) return false;
            TrackSegment from = seg;
            TrackSegment to;
            if (from.next.Count > 1 && from.fork != null)
            {
                int lane = NearestLane(from.fork.laneX, x);
                to = from.next[lane];
                x -= from.nextStartOffset[lane];
                seg = to;
                Emit(SimEventType.ForkChosen, null, lane, lane == from.fork.correctLane, 0, from.fork.questionId);
            }
            else
            {
                to = from.next[0];
                x += from.mergeOffset;
                seg = to;
            }
            if (seg.zone != ZoneKind.Myelin && from.zone == ZoneKind.Myelin) ringChain = 0;
            float limit = seg.halfWidth - RADIUS;
            x = Mathf.Clamp(x, -limit, limit);
            Emit(SimEventType.EnterSegment);
            return true;
        }

        void ProcessEvents(float from, float to)
        {
            var list = seg.events;
            for (int i = 0; i < list.Count; i++)
            {
                var e = list[i];
                if (e.consumed || e.s <= from || e.s > to) continue;
                e.consumed = true;
                switch (e.type)
                {
                    case TrackEventType.Trigger:
                        Emit(SimEventType.Trigger, e);
                        break;
                    case TrackEventType.Checkpoint:
                        Emit(SimEventType.Checkpoint, e);
                        break;
                    case TrackEventType.Finish:
                        finished = true;
                        Emit(SimEventType.Finish, e);
                        return;
                    case TrackEventType.Gate:
                    {
                        int lane = NearestLane(e.laneX, x);
                        bool ok = lane == e.correctLane;
                        if (ok) { AddTurbo(0.8f); AddEnergy(0.15f); if (e.tag == "glia") repairCount = Mathf.Max(repairCount, 3); }
                        else AddPenalty(1.8f);
                        Emit(SimEventType.GateResult, e, lane, ok);
                        break;
                    }
                    case TrackEventType.NodeRing:
                    {
                        ringsTotal++;
                        if (Mathf.Abs(x - e.x) < e.width)
                        {
                            ringChain++; ringsHit++; ringBest = Mathf.Max(ringBest, ringChain);
                            AddEnergy(0.03f);
                            Emit(SimEventType.RingHit, e);
                        }
                        else { ringChain = 0; Emit(SimEventType.RingMiss, e); }
                        break;
                    }
                    case TrackEventType.Obstacle:
                    {
                        bool overlap = Mathf.Abs(x - e.x) < e.width * 0.5f + RADIUS * 0.8f;
                        if (overlap && y < e.height)
                        {
                            obstacleHits++;
                            speed *= 0.6f; AddPenalty(1.0f);
                            if (Drifting) { Drifting = false; driftTime = 0f; driftCharge = 0f; }
                            Emit(SimEventType.ObstacleHit, e);
                        }
                        else Emit(SimEventType.ObstacleDodged, e);
                        break;
                    }
                    case TrackEventType.Orb:
                        if (Mathf.Abs(x - e.x) < 1.9f && y < 2.6f) { coins++; AddEnergy(0.06f); Emit(SimEventType.OrbCollected, e); }
                        else e.consumed = true;
                        break;
                    case TrackEventType.RepairOrb:
                        if (Mathf.Abs(x - e.x) < 2.3f && y < 2.6f) { repairCount = Mathf.Min(3, repairCount + 1); AddEnergy(0.05f); Emit(SimEventType.RepairOrb, e); }
                        break;
                }
            }
        }
    }
}
