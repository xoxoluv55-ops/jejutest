// Reused from Neon Racer (https://github.com/pinchasVaknin/neon-racer, commit 090f15b), MIT License,
// Copyright (c) 2026 Pinchas Vaknin. See LICENSE.txt in this folder.
// Status: MODIFIED for NERVE RUNNER -
//   * added OPEN-curve support (the original was closed-loop only). NERVE RUNNER tracks are a
//     graph of open segments (fork -> two branches -> merge), so every segment is an open spline.
//     Open curves are padded with mirrored phantom end points so the curve passes through
//     the first and last control point.
//   * GetTangentAt clamps instead of wrapping when the curve is open.
// The centripetal Catmull-Rom evaluation and the arc-length LUT are unchanged.
using System.Collections.Generic;
using UnityEngine;

namespace NeonRacer
{
    public class CatmullRomCurve
    {
        readonly List<Vector3> pts;
        readonly int n;
        readonly float alpha;          // 0.5 = centripetal
        readonly bool closed;

        float[] cumulative;            // arc-length LUT (cumulative distance)
        float totalLength;
        int lutSamples;

        public bool Closed { get { return closed; } }

        public CatmullRomCurve(List<Vector3> points, float alpha = 0.5f, int lutSamples = 2000, bool closed = true)
        {
            pts = points;
            n = points.Count;
            this.alpha = alpha;
            this.lutSamples = lutSamples;
            this.closed = closed;
            BuildLUT();
        }

        Vector3 P(int i)
        {
            if (closed)
            {
                i = ((i % n) + n) % n;
                return pts[i];
            }
            // open: mirror phantom points beyond both ends
            if (i < 0) return pts[0] * 2f - pts[Mathf.Min(1, n - 1)];
            if (i >= n) return pts[n - 1] * 2f - pts[Mathf.Max(0, n - 2)];
            return pts[i];
        }

        static Vector3 Segment(Vector3 p0, Vector3 p1, Vector3 p2, Vector3 p3, float s, float alpha)
        {
            float t0 = 0f;
            float t1 = t0 + Mathf.Pow(Mathf.Max(1e-5f, (p1 - p0).magnitude), alpha);
            float t2 = t1 + Mathf.Pow(Mathf.Max(1e-5f, (p2 - p1).magnitude), alpha);
            float t3 = t2 + Mathf.Pow(Mathf.Max(1e-5f, (p3 - p2).magnitude), alpha);
            float t = Mathf.Lerp(t1, t2, s);

            Vector3 a1 = (t1 - t) / (t1 - t0) * p0 + (t - t0) / (t1 - t0) * p1;
            Vector3 a2 = (t2 - t) / (t2 - t1) * p1 + (t - t1) / (t2 - t1) * p2;
            Vector3 a3 = (t3 - t) / (t3 - t2) * p2 + (t - t2) / (t3 - t2) * p3;
            Vector3 b1 = (t2 - t) / (t2 - t0) * a1 + (t - t0) / (t2 - t0) * a2;
            Vector3 b2 = (t3 - t) / (t3 - t1) * a2 + (t - t1) / (t3 - t1) * a3;
            Vector3 c = (t2 - t) / (t2 - t1) * b1 + (t - t1) / (t2 - t1) * b2;
            return c;
        }

        /// u in [0,1] - UNIFORM parameter, not arc-length.
        public Vector3 GetPoint(float u)
        {
            int segCount = closed ? n : n - 1;
            if (closed) u = u - Mathf.Floor(u);
            else u = Mathf.Clamp01(u);
            float f = u * segCount;
            int i = Mathf.FloorToInt(f);
            if (i >= segCount) i = segCount - 1;
            float s = f - i;
            return Segment(P(i - 1), P(i), P(i + 1), P(i + 2), s, alpha);
        }

        void BuildLUT()
        {
            cumulative = new float[lutSamples + 1];
            cumulative[0] = 0f;
            Vector3 prev = GetPoint(0f);
            float acc = 0f;
            for (int i = 1; i <= lutSamples; i++)
            {
                float u = (float)i / lutSamples;
                Vector3 cur = closed ? GetPoint(u % 1f) : GetPoint(u);
                acc += (cur - prev).magnitude;
                cumulative[i] = acc;
                prev = cur;
            }
            totalLength = acc;
        }

        public float GetLength() { return totalLength; }

        float DistanceToU(float d)
        {
            d = Mathf.Clamp01(d);
            float target = d * totalLength;
            int lo = 0, hi = lutSamples;
            while (lo < hi)
            {
                int mid = (lo + hi) >> 1;
                if (cumulative[mid] < target) lo = mid + 1; else hi = mid;
            }
            int idx = Mathf.Clamp(lo, 1, lutSamples);
            float segLen = cumulative[idx] - cumulative[idx - 1];
            float frac = segLen > 1e-6f ? (target - cumulative[idx - 1]) / segLen : 0f;
            float u = ((idx - 1) + frac) / lutSamples;
            return closed ? u % 1f : Mathf.Clamp01(u);
        }

        /// Point at normalized distance d in [0,1] along the curve.
        public Vector3 GetPointAt(float d) { return GetPoint(DistanceToU(d)); }

        /// Unit tangent at normalized distance d.
        public Vector3 GetTangentAt(float d)
        {
            float eps = 1e-3f;
            Vector3 a, b;
            if (closed) { a = GetPointAt((d - eps + 1f) % 1f); b = GetPointAt((d + eps) % 1f); }
            else
            {
                float d0 = Mathf.Clamp01(d - eps), d1 = Mathf.Clamp01(d + eps);
                if (d1 - d0 < 1e-5f) { d0 = Mathf.Max(0f, d1 - 2f * eps); }
                a = GetPointAt(d0); b = GetPointAt(d1);
            }
            Vector3 tan = b - a;
            if (tan.sqrMagnitude < 1e-9f) tan = Vector3.forward;
            return tan.normalized;
        }
    }
}
