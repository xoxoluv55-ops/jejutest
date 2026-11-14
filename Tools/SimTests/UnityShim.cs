// Minimal stand-in for the parts of UnityEngine the Core folder uses (Vector3 + Mathf), so the
// simulation can be tested with plain .NET. Semantics follow Unity's documented behaviour
// (notably Mathf.Sign(0) == 1 and DeltaAngle in degrees).
using System;
namespace UnityEngine
{
    public struct Vector3
    {
        public float x, y, z;
        public Vector3(float x, float y, float z) { this.x = x; this.y = y; this.z = z; }
        public static Vector3 zero => new Vector3(0, 0, 0);
        public static Vector3 up => new Vector3(0, 1, 0);
        public static Vector3 forward => new Vector3(0, 0, 1);
        public static Vector3 right => new Vector3(1, 0, 0);
        public float sqrMagnitude => x * x + y * y + z * z;
        public float magnitude => (float)Math.Sqrt(sqrMagnitude);
        public Vector3 normalized { get { float m = magnitude; return m > 1e-5f ? this / m : zero; } }
        public static Vector3 operator +(Vector3 a, Vector3 b) => new Vector3(a.x + b.x, a.y + b.y, a.z + b.z);
        public static Vector3 operator -(Vector3 a, Vector3 b) => new Vector3(a.x - b.x, a.y - b.y, a.z - b.z);
        public static Vector3 operator -(Vector3 a) => new Vector3(-a.x, -a.y, -a.z);
        public static Vector3 operator *(Vector3 a, float d) => new Vector3(a.x * d, a.y * d, a.z * d);
        public static Vector3 operator *(float d, Vector3 a) => a * d;
        public static Vector3 operator /(Vector3 a, float d) => new Vector3(a.x / d, a.y / d, a.z / d);
        public static Vector3 Lerp(Vector3 a, Vector3 b, float t) { t = Mathf.Clamp01(t); return a + (b - a) * t; }
        public static float Distance(Vector3 a, Vector3 b) => (a - b).magnitude;
        public override string ToString() => $"({x:F1}, {y:F1}, {z:F1})";
    }
    public static class Mathf
    {
        public const float PI = (float)Math.PI;
        public const float Deg2Rad = PI / 180f, Rad2Deg = 180f / PI;
        public static float Pow(float a, float b) => (float)Math.Pow(a, b);
        public static float Sqrt(float a) => (float)Math.Sqrt(a);
        public static float Sin(float a) => (float)Math.Sin(a);
        public static float Cos(float a) => (float)Math.Cos(a);
        public static float Atan2(float y, float x) => (float)Math.Atan2(y, x);
        public static float Abs(float a) => Math.Abs(a);
        public static float Sign(float a) => a >= 0f ? 1f : -1f;
        public static float Max(float a, float b) => a > b ? a : b;
        public static float Min(float a, float b) => a < b ? a : b;
        public static int Max(int a, int b) => a > b ? a : b;
        public static int Min(int a, int b) => a < b ? a : b;
        public static float Clamp(float v, float a, float b) => v < a ? a : v > b ? b : v;
        public static int Clamp(int v, int a, int b) => v < a ? a : v > b ? b : v;
        public static float Clamp01(float v) => Clamp(v, 0f, 1f);
        public static float Lerp(float a, float b, float t) => a + (b - a) * Clamp01(t);
        public static float Floor(float a) => (float)Math.Floor(a);
        public static int FloorToInt(float a) => (int)Math.Floor(a);
        public static int CeilToInt(float a) => (int)Math.Ceiling(a);
        public static float Repeat(float t, float l) => Clamp(t - Floor(t / l) * l, 0f, l);
        public static float DeltaAngle(float cur, float target) { float d = Repeat(target - cur, 360f); if (d > 180f) d -= 360f; return d; }
        public static float MoveTowards(float c, float t, float m) => Math.Abs(t - c) <= m ? t : c + Math.Sign(t - c) * m;
    }
}
