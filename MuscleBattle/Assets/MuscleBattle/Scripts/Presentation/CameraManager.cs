using UnityEngine;

namespace MuscleBattle
{
    /// <summary>
    /// Fighting game camera: keeps both fighters framed side-on, follows sidesteps without
    /// flipping, and layers shake (trauma based, user adjustable §41), zoom punches, focus shots
    /// (counter / KO) and the ultimate cinematic. Also used for menu / select / VS framing.
    /// </summary>
    public sealed class CameraManager : MonoBehaviour
    {
        public static CameraManager Instance { get; private set; }
        public Camera Cam { get; private set; }

        public Vector3 FlatRight { get; private set; } = Vector3.right;
        public Vector3 FlatForward { get; private set; } = Vector3.forward;

        public enum Mode { Fight, Free }
        public Mode CurrentMode = Mode.Free;

        FighterController _a, _b;
        Vector3 _side = Vector3.forward;   // camera looks along this
        Vector3 _pos, _look;
        float _fov = 34f;
        float _trauma;
        float _punch;
        FighterController _focus;
        float _focusTime, _focusDist = 1f;
        FighterController _cinematic;
        float _cinematicTime, _cinematicDuration;
        FighterController _victory;
        float _victoryTime;
        Vector3 _freePos, _freeLook;
        float _freeFov = 34f;

        void Awake()
        {
            Instance = this;
            Cam = GetComponent<Camera>();
            if (Cam == null) Cam = gameObject.AddComponent<Camera>();
            Cam.nearClipPlane = 0.1f;
            Cam.farClipPlane = 120f;
            Cam.fieldOfView = _fov;
            Cam.clearFlags = CameraClearFlags.SolidColor;
            Cam.backgroundColor = new Color(0.04f, 0.03f, 0.1f);
            Cam.allowHDR = false;   // built-in RP: LDR keeps WebGL fast
            Cam.allowMSAA = true;
            Cam.cullingMask = ~(1 << PortraitStudio.Layer); // portrait studio renders on its own layer
        }

        public void SetFighters(FighterController a, FighterController b)
        {
            _a = a;
            _b = b;
        }

        public void SnapToFighters()
        {
            CurrentMode = Mode.Fight;
            _side = Vector3.forward;
            _focus = null;
            _cinematic = null;
            _victory = null;
            ComputeFightTarget(out _pos, out _look, out _fov);
            Apply(0);
        }

        /// <summary>Static framing for menus / character select / VS.</summary>
        public void SetFree(Vector3 pos, Vector3 look, float fov, bool snap = false)
        {
            CurrentMode = Mode.Free;
            _freePos = pos;
            _freeLook = look;
            _freeFov = fov;
            _victory = null;
            if (snap) { _pos = pos; _look = look; _fov = fov; }
        }

        public void Shake(float amount) => _trauma = Mathf.Min(1f, _trauma + amount * GameSettings.CameraShake);
        public void Punch(float amount) => _punch = Mathf.Max(_punch, amount);

        public void Focus(FighterController f, float seconds, float distanceFactor)
        {
            _focus = f;
            _focusTime = seconds;
            _focusDist = distanceFactor;
        }

        public void Cinematic(FighterController f, float seconds)
        {
            _cinematic = f;
            _cinematicTime = _cinematicDuration = seconds;
        }

        public void VictoryShot(FighterController winner)
        {
            _victory = winner;
            _victoryTime = 0;
        }

        void ComputeFightTarget(out Vector3 pos, out Vector3 look, out float fov)
        {
            var pa = _a.transform.position;
            var pb = _b.transform.position;
            var d = FighterController.Flat(pb - pa);
            float sep = d.magnitude;
            if (sep > 0.05f)
            {
                var desired = Vector3.Cross(d / sep, Vector3.up); // camera forward so A is left, B right
                if (Vector3.Dot(desired, _side) < 0) desired = -desired; // never flip through the fighters
                _side = Vector3.Slerp(_side, desired, 0.08f).normalized;
            }
            var mid = (pa + pb) * 0.5f;
            float dist = Mathf.Clamp(3.4f + sep * 0.85f, 4.3f, 9.5f);
            float height = Mathf.Max(pa.y, pb.y) * 0.5f;
            look = new Vector3(mid.x, 1.05f + height, mid.z);
            pos = look - _side * dist + Vector3.up * (0.55f + dist * 0.05f);
            fov = 34f;
        }

        void LateUpdate()
        {
            float dt = Time.unscaledDeltaTime;
            Vector3 tPos, tLook;
            float tFov;
            float follow = 8f;

            if (CurrentMode == Mode.Fight && _a != null && _b != null)
            {
                ComputeFightTarget(out tPos, out tLook, out tFov);

                if (_victory != null)
                {
                    _victoryTime += dt;
                    var f = _victory;
                    var front = f.Facing;
                    float orbit = Mathf.Sin(_victoryTime * 0.35f) * 0.6f;
                    var dir = Quaternion.Euler(0, orbit * 40f + 25f, 0) * front;
                    tLook = f.transform.position + Vector3.up * 1.35f;
                    tPos = tLook + dir * 3.0f + Vector3.up * -0.15f;
                    tFov = 38f;
                    follow = 3f;
                }
                else if (_cinematic != null && _cinematicTime > 0)
                {
                    _cinematicTime -= dt;
                    float t = 1f - _cinematicTime / _cinematicDuration;
                    var f = _cinematic;
                    var side = Vector3.Cross(Vector3.up, f.Facing);
                    float sweep = Mathf.Lerp(-55f, 30f, Mathf.SmoothStep(0, 1, t));
                    var dir = Quaternion.AngleAxis(sweep, Vector3.up) * (f.Facing + side * 0.4f).normalized;
                    tLook = f.transform.position + Vector3.up * 1.4f;
                    tPos = tLook + dir * Mathf.Lerp(1.6f, 2.6f, t) + Vector3.up * 0.1f;
                    tFov = Mathf.Lerp(30f, 42f, t);
                    follow = 10f;
                    if (_cinematicTime <= 0) _cinematic = null;
                }
                else if (_focus != null && _focusTime > 0)
                {
                    _focusTime -= dt;
                    var fp = _focus.transform.position + Vector3.up * 1.2f;
                    tLook = Vector3.Lerp(tLook, fp, 0.7f);
                    tPos = tLook + (tPos - tLook) * _focusDist;
                    follow = 9f;
                    if (_focusTime <= 0) _focus = null;
                }
            }
            else
            {
                tPos = _freePos;
                tLook = _freeLook;
                tFov = _freeFov;
                follow = 4f;
            }

            float k = 1f - Mathf.Exp(-follow * dt);
            _pos = Vector3.Lerp(_pos, tPos, k);
            _look = Vector3.Lerp(_look, tLook, k);
            _fov = Mathf.Lerp(_fov, tFov, k);
            Apply(dt);
        }

        void Apply(float dt)
        {
            // zoom punch
            _punch = Mathf.MoveTowards(_punch, 0, dt * 0.6f);
            var p = Vector3.Lerp(_pos, _look, _punch * 2.2f);

            // trauma shake (perlin, squared falloff)
            _trauma = Mathf.Max(0, _trauma - dt * 1.8f);
            float s = _trauma * _trauma;
            float time = Time.unscaledTime * 28f;
            var offset = new Vector3(Mathf.PerlinNoise(time, 0.1f) - 0.5f, Mathf.PerlinNoise(0.3f, time) - 0.5f, 0) * (0.5f * s);
            float roll = (Mathf.PerlinNoise(time, 7.7f) - 0.5f) * 6f * s;

            transform.position = p;
            var lookDir = _look - p;
            if (lookDir.sqrMagnitude < 1e-6f) lookDir = Vector3.forward; // first frame before any target: avoid zero-vector warning
            transform.rotation = Quaternion.LookRotation(lookDir.normalized, Vector3.up) * Quaternion.Euler(0, 0, roll);
            transform.position += transform.right * offset.x + transform.up * offset.y;
            Cam.fieldOfView = _fov;

            var r = transform.right; r.y = 0;
            FlatRight = r.sqrMagnitude > 0.001f ? r.normalized : Vector3.right;
            var f = transform.forward; f.y = 0;
            FlatForward = f.sqrMagnitude > 0.001f ? f.normalized : Vector3.forward;
        }
    }
}
