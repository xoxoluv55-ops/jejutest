using UnityEngine;

namespace MuscleBattle
{
    /// <summary>
    /// Real planar reflection for the polished arena floor. Renders only the fighters layer
    /// (cheap: two characters) from a mirrored camera into a low-res texture the floor shader samples.
    /// Resolution follows the quality profile (Web/iPad renders at a third of the screen).
    /// </summary>
    public sealed class PlanarReflection : MonoBehaviour
    {
        public const int FighterLayer = 30;
        public float Strength = 0.35f;
        Material _mat;
        Camera _refl;
        RenderTexture _rt;
        static bool _rendering;

        void Start()
        {
            _mat = GetComponent<Renderer>().sharedMaterial;
            _mat.SetFloat("_Reflect", Strength);
        }

        void OnWillRenderObject()
        {
            var cam = Camera.current;
            if (_rendering || cam == null || CameraManager.Instance == null || cam != CameraManager.Instance.Cam) return;
            _rendering = true;
            try { RenderReflection(cam); }
            finally { _rendering = false; }
        }

        void RenderReflection(Camera cam)
        {
            var q = QualityProfile.Current;
            float scale = q != null && q.Tier == QualityTier.PcHigh ? 0.5f : 0.33f;
            int w = Mathf.Max(64, Mathf.Min(1024, (int)(cam.pixelWidth * scale)));
            int h = Mathf.Max(64, Mathf.Min(1024, (int)(cam.pixelHeight * scale)));
            if (_rt == null || _rt.width != w || _rt.height != h)
            {
                if (_rt != null) Destroy(_rt);
                _rt = new RenderTexture(w, h, 16, RenderTextureFormat.ARGB32) { name = "FloorReflection" };
                _mat.SetTexture("_ReflectionTex", _rt);
            }
            if (_refl == null)
            {
                var go = new GameObject("ReflectionCamera") { hideFlags = HideFlags.HideAndDontSave };
                _refl = go.AddComponent<Camera>();
                _refl.enabled = false;
            }
            _refl.CopyFrom(cam);
            _refl.clearFlags = CameraClearFlags.SolidColor;
            _refl.backgroundColor = new Color(0, 0, 0, 0);
            _refl.cullingMask = 1 << FighterLayer;
            _refl.targetTexture = _rt;
            _refl.allowMSAA = false;

            var pos = transform.position;
            var normal = Vector3.up;
            float d = -Vector3.Dot(normal, pos) - 0.02f;
            var plane = new Vector4(normal.x, normal.y, normal.z, d);
            var reflection = Reflect(plane);
            _refl.worldToCameraMatrix = cam.worldToCameraMatrix * reflection;
            var clip = CameraSpacePlane(_refl, pos, normal);
            _refl.projectionMatrix = cam.CalculateObliqueMatrix(clip);
            _refl.transform.position = reflection.MultiplyPoint(cam.transform.position);

            float shadow = QualitySettings.shadowDistance;
            QualitySettings.shadowDistance = 0; // no second shadow pass for the reflection
            GL.invertCulling = true;
            _refl.Render();
            GL.invertCulling = false;
            QualitySettings.shadowDistance = shadow;
        }

        static Vector4 CameraSpacePlane(Camera c, Vector3 pos, Vector3 normal)
        {
            var m = c.worldToCameraMatrix;
            var cpos = m.MultiplyPoint(pos + normal * 0.02f);
            var cnormal = m.MultiplyVector(normal).normalized;
            return new Vector4(cnormal.x, cnormal.y, cnormal.z, -Vector3.Dot(cpos, cnormal));
        }

        static Matrix4x4 Reflect(Vector4 p)
        {
            var m = new Matrix4x4();
            m.m00 = 1F - 2F * p[0] * p[0]; m.m01 = -2F * p[0] * p[1]; m.m02 = -2F * p[0] * p[2]; m.m03 = -2F * p[3] * p[0];
            m.m10 = -2F * p[1] * p[0]; m.m11 = 1F - 2F * p[1] * p[1]; m.m12 = -2F * p[1] * p[2]; m.m13 = -2F * p[3] * p[1];
            m.m20 = -2F * p[2] * p[0]; m.m21 = -2F * p[2] * p[1]; m.m22 = 1F - 2F * p[2] * p[2]; m.m23 = -2F * p[3] * p[2];
            m.m30 = 0F; m.m31 = 0F; m.m32 = 0F; m.m33 = 1F;
            return m;
        }

        void OnDestroy()
        {
            if (_rt != null) Destroy(_rt);
            if (_refl != null) Destroy(_refl.gameObject);
        }
    }

    /// <summary>
    /// Controlled bloom (PC High only - iPad keeps the additive glow sprites for performance).
    /// Threshold is high so only neon, sparks and flashes bloom; the characters stay crisp.
    /// </summary>
    [RequireComponent(typeof(Camera))]
    public sealed class BloomEffect : MonoBehaviour
    {
        public float Threshold = 0.82f;
        public float Knee = 0.35f;
        public float Intensity = 0.55f;
        public int Iterations = 4;
        Material _mat;
        readonly RenderTexture[] _chain = new RenderTexture[8];

        void OnEnable()
        {
            var shader = Shader.Find("Hidden/MuscleBattle/Bloom");
            if (shader == null || !shader.isSupported) { enabled = false; return; }
            _mat = new Material(shader) { hideFlags = HideFlags.HideAndDontSave };
        }

        void OnRenderImage(RenderTexture src, RenderTexture dst)
        {
            if (_mat == null || QualityProfile.Current == null || QualityProfile.Current.Tier != QualityTier.PcHigh)
            {
                Graphics.Blit(src, dst);
                return;
            }
            _mat.SetFloat("_Threshold", Threshold);
            _mat.SetFloat("_Knee", Knee);
            _mat.SetFloat("_Intensity", Intensity);
            int w = src.width / 2, h = src.height / 2;
            var cur = _chain[0] = RenderTexture.GetTemporary(w, h, 0, src.format);
            Graphics.Blit(src, cur, _mat, 0);
            int i = 1;
            for (; i < Iterations; i++)
            {
                w /= 2; h /= 2;
                if (h < 2) break;
                _chain[i] = RenderTexture.GetTemporary(w, h, 0, src.format);
                Graphics.Blit(cur, _chain[i], _mat, 1);
                cur = _chain[i];
            }
            for (i -= 2; i >= 0; i--)
            {
                Graphics.Blit(cur, _chain[i], _mat, 2);
                RenderTexture.ReleaseTemporary(cur);
                _chain[i + 1] = null;
                cur = _chain[i];
            }
            _mat.SetTexture("_SourceTex", src);
            Graphics.Blit(cur, dst, _mat, 3);
            RenderTexture.ReleaseTemporary(cur);
            _chain[0] = null;
        }
    }
}
