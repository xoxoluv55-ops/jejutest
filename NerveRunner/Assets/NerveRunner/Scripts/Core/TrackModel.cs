// NERVE RUNNER - track graph model (pure C#: only Vector3/Mathf, no MonoBehaviour).
// The race track is a directed graph of OPEN spline segments. A segment with more than one
// "next" segment is a fork: which child the star enters is decided by its lateral position
// when it reaches the end of the segment - i.e. the player has to physically steer into the
// branch they believe is correct.
using System.Collections.Generic;
using NeonRacer;
using UnityEngine;

namespace NerveRunner.Core
{
    public enum ZoneKind
    {
        Normal,
        ForkApproach,   // widened road in front of a fork, lane signs above
        Shortcut,       // correct branch of a fork
        Review,         // wrong branch: longer + slower, explanation shown
        Myelin,         // myelinated axon - nodes of Ranvier, saltatory conduction
        Damaged,        // demyelination zone (conduction block) until repaired
        Synapse,        // synaptic cleft crossing
    }

    public enum TrackEventType
    {
        Trigger,        // story / banner / codex unlock / minigame start, identified by `tag`
        Gate,           // multiple-choice lane gate on the same road (action potential order etc.)
        NodeRing,       // node of Ranvier ring - steer through it to chain saltatory boost
        Obstacle,       // NULL error block - steer around or jump over
        Orb,            // signal energy orb: boost energy + coin
        RepairOrb,      // myelin repair orb (damaged zone mission)
        Checkpoint,
        Finish,
    }

    public class TrackEvent
    {
        public TrackEventType type;
        public float s;                 // distance along owning segment
        public float x;                 // lateral position (rings, obstacles, orbs)
        public float width = 2.4f;      // obstacles: width; rings: radius
        public float height = 1.3f;     // obstacles: height (jump clears it)
        public string tag;              // trigger id / gate group id
        public string questionId;       // gates
        public float[] laneX;           // gates: lane centres (left -> right), lane i shows option i
        public int correctLane = -1;    // gates
        public bool consumed;           // runtime: already triggered/collected
        public int index;               // sequence index (rings, gates)

        public void Reset() { consumed = false; }
    }

    public class ForkInfo
    {
        public string questionId;
        public float[] laneX;           // lane centres in this segment's end frame (left -> right)
        public int correctLane;
    }

    public class TrackSegment
    {
        public int id;
        public string name;
        public CatmullRomCurve curve;
        public float length;
        public float halfWidth = 6f;
        public ZoneKind zone = ZoneKind.Normal;
        public string theme;                // visual theme tag (e.g. cerebrum district "frontal"), view-only

        // graph
        public readonly List<TrackSegment> next = new List<TrackSegment>();
        public float[] nextStartOffset;     // per child: lateral offset (this end frame) where child starts
        public float mergeOffset;           // for branches: lateral offset in next segment's start frame where this ends
        public ForkInfo fork;               // non-null when next.Count > 1
        public bool visualGapAtStart;       // synapse: road is not drawn for the cleft
        public float gapLength;

        public readonly List<TrackEvent> events = new List<TrackEvent>();

        // sampled frames, 1 sample per SAMPLE_STEP metres
        public const float SAMPLE_STEP = 1f;
        Vector3[] pos;
        Vector3[] tan;
        float[] yaw;      // radians, clockwise from +Z (turning right increases yaw)
        float[] curv;     // dyaw/ds (1/m): >0 = turning right

        public void Build(List<Vector3> controlPoints)
        {
            curve = new CatmullRomCurve(controlPoints, 0.5f, Mathf.Max(400, controlPoints.Count * 40), false);
            length = curve.GetLength();
            int n = Mathf.Max(2, Mathf.CeilToInt(length / SAMPLE_STEP) + 1);
            pos = new Vector3[n]; tan = new Vector3[n]; yaw = new float[n]; curv = new float[n];
            for (int i = 0; i < n; i++)
            {
                float d = Mathf.Clamp01(i * SAMPLE_STEP / length);
                pos[i] = curve.GetPointAt(d);
            }
            for (int i = 0; i < n; i++)
            {
                Vector3 a = pos[Mathf.Max(0, i - 1)], b = pos[Mathf.Min(n - 1, i + 1)];
                Vector3 t = b - a;
                if (t.sqrMagnitude < 1e-8f) t = i > 0 ? tan[i - 1] : Vector3.forward;
                tan[i] = t.normalized;
                yaw[i] = Mathf.Atan2(tan[i].x, tan[i].z);
            }
            for (int i = 0; i < n; i++)
            {
                int i0 = Mathf.Max(0, i - 3), i1 = Mathf.Min(n - 1, i + 3);
                float dy = Mathf.DeltaAngle(yaw[i0] * Mathf.Rad2Deg, yaw[i1] * Mathf.Rad2Deg) * Mathf.Deg2Rad;
                float ds = Mathf.Max(0.5f, (i1 - i0) * SAMPLE_STEP);
                curv[i] = dy / ds;
            }
        }

        float Idx(float s, out int i0)
        {
            float f = Mathf.Clamp(s, 0f, length) / SAMPLE_STEP;
            i0 = Mathf.Min(pos.Length - 2, Mathf.FloorToInt(f));
            if (i0 < 0) i0 = 0;
            return Mathf.Clamp01(f - i0);
        }

        public Vector3 PointAt(float s) { int i; float f = Idx(s, out i); return Vector3.Lerp(pos[i], pos[i + 1], f); }
        public Vector3 TangentAt(float s) { int i; float f = Idx(s, out i); return Vector3.Lerp(tan[i], tan[i + 1], f).normalized; }
        public float CurvatureAt(float s) { int i; float f = Idx(s, out i); return Mathf.Lerp(curv[i], curv[i + 1], f); }

        /// Horizontal right vector (track is banked-free; the star stays upright).
        public Vector3 RightAt(float s)
        {
            Vector3 t = TangentAt(s);
            Vector3 r = new Vector3(t.z, 0f, -t.x);
            if (r.sqrMagnitude < 1e-6f) r = Vector3.right;
            return r.normalized;
        }

        public Vector3 WorldPos(float s, float x, float y)
        {
            return PointAt(s) + RightAt(s) * x + Vector3.up * y;
        }

        public void SortEvents() { events.Sort((a, b) => a.s.CompareTo(b.s)); }
    }

    public class TrackGraph
    {
        public readonly List<TrackSegment> segments = new List<TrackSegment>();
        public TrackSegment start;
        public float referenceLength;     // shortest start->finish route, for progress %
        public float parTime;             // 3-star time target (seconds)

        public TrackSegment Add(string name, ZoneKind zone, float halfWidth)
        {
            var s = new TrackSegment { id = segments.Count, name = name, zone = zone, halfWidth = halfWidth };
            segments.Add(s);
            return s;
        }

        public void ResetRuntime()
        {
            for (int i = 0; i < segments.Count; i++)
                for (int j = 0; j < segments[i].events.Count; j++) segments[i].events[j].Reset();
        }

        public IEnumerable<TrackEvent> AllEvents()
        {
            for (int i = 0; i < segments.Count; i++)
                for (int j = 0; j < segments[i].events.Count; j++) yield return segments[i].events[j];
        }
    }
}
