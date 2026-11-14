// NERVE RUNNER - chase camera.
// ADAPTED from Neon Racer's CameraRig "Chase" mode (MIT, https://github.com/pinchasVaknin/neon-racer):
// same exponential-smoothing follow and speed-driven FOV. Changes: follows a 3D forward vector
// (the track can climb), adds a boost FOV kick, impact shake, and a "showcase" mode that swings
// in front of STAR-01 so the player sees its face at the start and at the finish.
// 2.0: closer framing (STAR-01 reads bigger), look-into-the-corner, drift roll, softened jump
// follow, shake strength from settings (Gfx.CameraShake), distanceScale hook for boss arenas.
using UnityEngine;

namespace NerveRunner
{
    public struct CamInput
    {
        public Vector3 pos, fwd;
        public float speed01, curvature, airHeight;
        public bool boosting;
        public int driftDir;      // 0 = not drifting
    }

    public class ChaseCamera : MonoBehaviour
    {
        public Camera cam;
        public float distanceScale = 1f;            // >1 pulls back (boss arena)

        const float DIST = 6.4f, HEIGHT = 2.6f, LOOK_AHEAD = 8.5f, LOOK_H = 1.0f;   // 1.0: 7.5 / 3.2 / 9 / 1.1
        const float STIFFNESS = 0.0006f;          // lower = snappier (Neon Racer: 0.0009)
        const float FOV_BASE = 62f, FOV_SPEED_GAIN = 14f, FOV_BOOST = 10f;

        bool snap = true;
        float shake, boostKick, cornerLook, roll;
        float showcase;           // >0: front view
        Vector3 smoothFwd = Vector3.forward;

        public void Snap() { snap = true; }
        public void Shake(float amount) { shake = Mathf.Max(shake, amount * Gfx.CameraShake); }
        public void Showcase(float seconds) { showcase = seconds; snap = true; }
        public bool InShowcase { get { return showcase > 0f; } }

        /// 1.0 signature, kept for callers that have no extra state.
        public void Follow(Vector3 pos, Vector3 fwd, float speed01, bool boosting, float dt)
        {
            Follow(new CamInput { pos = pos, fwd = fwd, speed01 = speed01, boosting = boosting }, dt);
        }

        public void Follow(CamInput c, float dt)
        {
            if (cam == null) return;
            Vector3 fwd = c.fwd;
            fwd.y *= 0.5f;
            if (fwd.sqrMagnitude < 1e-4f) fwd = Vector3.forward;
            fwd.Normalize();
            smoothFwd = snap ? fwd : Vector3.Slerp(smoothFwd, fwd, 1f - Mathf.Pow(0.02f, dt));
            Vector3 side = Vector3.Cross(Vector3.up, smoothFwd).normalized;

            boostKick = Mathf.MoveTowards(boostKick, c.boosting ? 1f : 0f, dt * 3f);
            // look into the corner (curvature > 0 = right turn), smoothed
            float wantLook = Mathf.Clamp(c.curvature * 110f * Mathf.Lerp(0.4f, 1f, c.speed01), -2.6f, 2.6f);
            cornerLook = Mathf.Lerp(cornerLook, wantLook, 1f - Mathf.Exp(-3f * dt));
            roll = Mathf.Lerp(roll, -c.driftDir * 4f, 1f - Mathf.Exp(-4f * dt));
            // on a jump the camera rises only half as much (keeps the road in view)
            Vector3 anchor = c.pos - Vector3.up * (Mathf.Max(0f, c.airHeight) * 0.5f);

            Vector3 target, look;
            if (showcase > 0f)
            {
                showcase -= dt;
                float a = Mathf.Clamp01(showcase / 2.5f);
                target = c.pos + smoothFwd * (4.2f + 1.5f * a) + side * (1.6f * a) + Vector3.up * 0.9f;
                look = c.pos + Vector3.up * 0.2f;
                if (showcase <= 0f) snap = false;
            }
            else
            {
                float dist = (DIST + 1.8f * boostKick) * distanceScale;
                target = anchor - smoothFwd * dist + Vector3.up * HEIGHT * distanceScale - side * cornerLook * 0.35f;
                look = anchor + smoothFwd * LOOK_AHEAD + Vector3.up * LOOK_H + side * cornerLook;
            }

            if (snap) { cam.transform.position = target; snap = false; }
            else
            {
                float a = 1f - Mathf.Pow(STIFFNESS, dt);
                cam.transform.position = Vector3.Lerp(cam.transform.position, target, a);
            }
            if (shake > 0f)
            {
                shake = Mathf.Max(0f, shake - dt * 2.5f);
                float t = Time.time * 40f;
                cam.transform.position += new Vector3(Mathf.PerlinNoise(t, 0f) - 0.5f, Mathf.PerlinNoise(0f, t) - 0.5f, 0f) * shake;
            }
            cam.transform.LookAt(look, Vector3.up);
            if (showcase <= 0f && Mathf.Abs(roll) > 0.01f) cam.transform.Rotate(0f, 0f, roll, Space.Self);
            cam.fieldOfView = showcase > 0f ? 50f : FOV_BASE + FOV_SPEED_GAIN * c.speed01 + FOV_BOOST * boostKick;
        }
    }
}
