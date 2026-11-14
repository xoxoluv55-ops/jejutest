// NERVE RUNNER - chase camera.
// ADAPTED from Neon Racer's CameraRig "Chase" mode (MIT, https://github.com/pinchasVaknin/neon-racer):
// same exponential-smoothing follow and speed-driven FOV. Changes: follows a 3D forward vector
// (the track can climb), adds a boost FOV kick, impact shake, and a "showcase" mode that swings
// in front of STAR-01 so the player sees its face at the start and at the finish.
using UnityEngine;

namespace NerveRunner
{
    public class ChaseCamera : MonoBehaviour
    {
        public Camera cam;

        const float DIST = 7.5f, HEIGHT = 3.2f, LOOK_AHEAD = 9f, LOOK_H = 1.1f;
        const float STIFFNESS = 0.0006f;          // lower = snappier (Neon Racer: 0.0009)
        const float FOV_BASE = 62f, FOV_SPEED_GAIN = 14f, FOV_BOOST = 10f;

        bool snap = true;
        float shake, boostKick;
        float showcase;           // >0: front view
        Vector3 smoothFwd = Vector3.forward;

        public void Snap() { snap = true; }
        public void Shake(float amount) { shake = Mathf.Max(shake, amount); }
        public void Showcase(float seconds) { showcase = seconds; snap = true; }
        public bool InShowcase { get { return showcase > 0f; } }

        public void Follow(Vector3 pos, Vector3 fwd, float speed01, bool boosting, float dt)
        {
            if (cam == null) return;
            fwd.y *= 0.5f;
            if (fwd.sqrMagnitude < 1e-4f) fwd = Vector3.forward;
            fwd.Normalize();
            smoothFwd = snap ? fwd : Vector3.Slerp(smoothFwd, fwd, 1f - Mathf.Pow(0.02f, dt));

            boostKick = Mathf.MoveTowards(boostKick, boosting ? 1f : 0f, dt * 3f);
            Vector3 target, look;
            if (showcase > 0f)
            {
                showcase -= dt;
                float a = Mathf.Clamp01(showcase / 2.5f);
                Vector3 side = Vector3.Cross(Vector3.up, smoothFwd).normalized;
                target = pos + smoothFwd * (4.2f + 1.5f * a) + side * (1.6f * a) + Vector3.up * 0.9f;
                look = pos + Vector3.up * 0.2f;
                if (showcase <= 0f) snap = false;
            }
            else
            {
                float dist = DIST + 1.8f * boostKick;
                target = pos - smoothFwd * dist + Vector3.up * HEIGHT;
                look = pos + smoothFwd * LOOK_AHEAD + Vector3.up * LOOK_H;
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
            cam.fieldOfView = showcase > 0f ? 50f : FOV_BASE + FOV_SPEED_GAIN * speed01 + FOV_BOOST * boostKick;
        }
    }
}
