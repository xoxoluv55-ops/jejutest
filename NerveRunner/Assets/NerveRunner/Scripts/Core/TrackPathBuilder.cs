// NERVE RUNNER - modular track builder ("turtle" that lays down track pieces).
// Reusable track modules (PART 9): Straight, Turn (gentle / hairpin), Fork (2-3 way, question
// driven), wide gate road, myelin tunnel, damaged zone, synapse cleft, checkpoint, finish.
// Pure C#: produces a TrackGraph of open Catmull-Rom segments, no Unity objects.
using System.Collections.Generic;
using UnityEngine;

namespace NerveRunner.Core
{
    public class TrackPathBuilder
    {
        public readonly TrackGraph graph = new TrackGraph();

        const float POINT_STEP = 8f;

        Vector3 pos;
        float yaw;                                     // radians, clockwise from +Z
        readonly List<Vector3> pts = new List<Vector3>();
        float polyLen;                                 // polyline length of the open segment
        readonly List<TrackEvent> pending = new List<TrackEvent>();

        TrackSegment prevSeg;                          // last finished main-line segment
        List<TrackSegment> pendingMerge;               // branches waiting for the next segment
        float[] pendingMergeOffsets;

        public Vector3 Position { get { return pos; } }
        public float Yaw { get { return yaw; } }
        public float Distance { get { return polyLen; } }   // distance into current segment

        Vector3 Fwd { get { return new Vector3(Mathf.Sin(yaw), 0f, Mathf.Cos(yaw)); } }
        Vector3 Right { get { return new Vector3(Mathf.Cos(yaw), 0f, -Mathf.Sin(yaw)); } }

        public TrackPathBuilder(Vector3 start, float yawDeg)
        {
            pos = start; yaw = yawDeg * Mathf.Deg2Rad;
            pts.Add(pos);
        }

        void AddPoint(Vector3 p)
        {
            polyLen += (p - pts[pts.Count - 1]).magnitude;
            pts.Add(p);
        }

        //================== PIECES ==================\\
        public TrackPathBuilder Straight(float len, float rise = 0f)
        {
            int n = Mathf.Max(1, Mathf.CeilToInt(len / POINT_STEP));
            Vector3 f = Fwd;
            Vector3 p0 = pos;
            for (int i = 1; i <= n; i++)
            {
                float t = i / (float)n;
                // smoothstep the rise so slopes blend into the neighbours
                float y = rise * (t * t * (3f - 2f * t));
                AddPoint(p0 + f * (len * t) + Vector3.up * y);
            }
            pos = pts[pts.Count - 1];
            return this;
        }

        /// angleDeg > 0 turns RIGHT. Arc of the given radius.
        public TrackPathBuilder Turn(float angleDeg, float radius, float rise = 0f)
        {
            float ang = Mathf.Abs(angleDeg) * Mathf.Deg2Rad;
            float side = Mathf.Sign(angleDeg);
            float arc = ang * radius;
            int n = Mathf.Max(2, Mathf.CeilToInt(arc / POINT_STEP));
            Vector3 center = pos + Right * (radius * side);
            Vector3 p0 = pos;
            float yaw0 = yaw;
            for (int i = 1; i <= n; i++)
            {
                float t = i / (float)n;
                float a = yaw0 + side * ang * t;
                // point on circle: start offset from centre is -Right*side*radius
                Vector3 rightA = new Vector3(Mathf.Cos(a), 0f, -Mathf.Sin(a));
                Vector3 p = center - rightA * (radius * side);
                p.y = p0.y + rise * (t * t * (3f - 2f * t));
                AddPoint(p);
            }
            yaw = yaw0 + side * ang;
            pos = pts[pts.Count - 1];
            return this;
        }

        //================== EVENTS ==================\\
        public TrackEvent Event(TrackEventType type, float x = 0f, string tag = null, float ahead = 0f)
        {
            var e = new TrackEvent { type = type, s = polyLen + ahead, x = x, tag = tag };
            pending.Add(e);
            return e;
        }

        public TrackPathBuilder Trigger(string tag, float ahead = 0f) { Event(TrackEventType.Trigger, 0f, tag, ahead); return this; }

        /// Lays a straight with evenly spaced events produced by `make(i, sLocal)`.
        public TrackPathBuilder StraightWith(float len, int count, System.Action<int, float> make, float rise = 0f)
        {
            float startLen = polyLen;
            for (int i = 0; i < count; i++)
            {
                float local = len * (i + 1) / (count + 1);
                make(i, local);
            }
            Straight(len, rise);
            return this;
        }

        public TrackEvent EventAt(TrackEventType type, float sFromNow, float x, string tag = null)
        {
            var e = new TrackEvent { type = type, s = polyLen + sFromNow, x = x, tag = tag };
            pending.Add(e);
            return e;
        }

        //================== SEGMENTS ==================\\
        /// Finishes the current open polyline as a segment and links it to the previous one.
        public TrackSegment Cut(string name, ZoneKind zone, float halfWidth, string theme)
        {
            var seg = Cut(name, zone, halfWidth);
            seg.theme = theme;
            return seg;
        }

        public TrackSegment Cut(string name, ZoneKind zone, float halfWidth)
        {
            var seg = graph.Add(name, zone, halfWidth);
            seg.Build(new List<Vector3>(pts));
            float scale = polyLen > 1e-3f ? seg.length / polyLen : 1f;
            foreach (var e in pending) { e.s = Mathf.Clamp(e.s * scale, 0f, seg.length); seg.events.Add(e); }
            seg.SortEvents();
            pending.Clear();

            if (graph.start == null) graph.start = seg;
            if (pendingMerge != null)
            {
                for (int i = 0; i < pendingMerge.Count; i++)
                {
                    pendingMerge[i].next.Add(seg);
                    pendingMerge[i].mergeOffset = pendingMergeOffsets[i];
                }
                pendingMerge = null; pendingMergeOffsets = null;
            }
            else if (prevSeg != null && prevSeg.next.Count == 0)
            {
                prevSeg.next.Add(seg);
            }
            prevSeg = seg;

            pts.Clear(); pts.Add(pos); polyLen = 0f;
            return seg;
        }

        /// Fork at the END of the segment `approach` (which must just have been Cut).
        /// Lane i shows option i of `q`; the lane with q.answer is a short straight path,
        /// the others are longer, slower review loops. All lanes merge `length` metres ahead.
        public List<TrackSegment> Fork(TrackSegment approach, Question q, float length, float bulge, float laneSpacing)
        {
            int lanes = q.options.Length;
            var laneX = new float[lanes];
            for (int i = 0; i < lanes; i++) laneX[i] = (i - (lanes - 1) * 0.5f) * laneSpacing;

            approach.fork = new ForkInfo { questionId = q.id, laneX = laneX, correctLane = q.answer };
            approach.nextStartOffset = laneX;

            Vector3 F = pos, f = Fwd, r = Right;
            Vector3 M = F + f * length;
            var branches = new List<TrackSegment>();
            var mergeOffsets = new float[lanes];

            for (int i = 0; i < lanes; i++)
            {
                bool correct = i == q.answer;
                float o = laneX[i];
                float oEnd = o * 0.3f;
                mergeOffsets[i] = oEnd;
                var bp = new List<Vector3>();
                bp.Add(F + r * o);
                bp.Add(F + f * 20f + r * o);
                int n = Mathf.CeilToInt((length - 40f) / POINT_STEP);
                for (int k = 1; k < n; k++)
                {
                    float t = k / (float)n;
                    float along = 20f + (length - 40f) * t;
                    float lat = Mathf.Lerp(o, oEnd, t);
                    float y = 0f;
                    if (!correct)
                    {
                        float env = Mathf.Sin(Mathf.PI * t);
                        if (Mathf.Abs(o) > 0.01f) lat += Mathf.Sign(o) * bulge * env;     // side lane: bow outwards
                        else
                        {                                                               // middle lane: arch up + S-curves
                            y = bulge * 0.22f * env;
                            lat += bulge * 0.18f * Mathf.Sin(2f * Mathf.PI * t) * env;
                        }
                    }
                    bp.Add(F + f * along + r * lat + Vector3.up * y);
                }
                bp.Add(M - f * 20f + r * oEnd);
                bp.Add(M + r * oEnd);

                var seg = graph.Add((correct ? "Shortcut_" : "Review_") + q.id + "_" + i,
                                    correct ? ZoneKind.Shortcut : ZoneKind.Review, 5f);
                seg.Build(bp);
                seg.events.Add(new TrackEvent { type = TrackEventType.Trigger, s = 4f, tag = (correct ? "forkok:" : "review:") + q.id });
                if (correct)
                {
                    // reward: energy orbs down the shortcut
                    for (int k = 1; k <= 5; k++)
                        seg.events.Add(new TrackEvent { type = TrackEventType.Orb, s = seg.length * k / 6.5f, x = 0f });
                }
                seg.SortEvents();
                approach.next.Add(seg);
                branches.Add(seg);
            }

            pendingMerge = branches;
            pendingMergeOffsets = mergeOffsets;
            prevSeg = null;
            pos = M;
            pts.Clear(); pts.Add(pos); polyLen = 0f;
            return branches;
        }

        /// Synapse cleft: jumps the turtle forward by `gap` metres without road.
        public void Gap(float gap)
        {
            pos = pos + Fwd * gap;
            pts.Clear(); pts.Add(pos); polyLen = 0f;
        }
    }
}
