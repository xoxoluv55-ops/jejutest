using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace MuscleBattle
{
    /// <summary>
    /// Character portraits (HUD corners, select screen, VS, cut-ins) rendered from the real 3D fighter.
    ///
    /// Get() immediately returns a plain Texture2D filled with the character colour (UI always shows
    /// a Texture2D), then a coroutine renders the fighter with an off-screen camera on an isolated layer,
    /// reads the pixels back and writes them into that same texture. Every UI element already holding
    /// the texture updates automatically.
    /// </summary>
    public static class PortraitStudio
    {
        public const int Layer = 31;
        static readonly Dictionary<string, Texture2D> Cache = new Dictionary<string, Texture2D>();
        static Runner _runner;
        static int _slot;

        sealed class Runner : MonoBehaviour { }

        /// <param name="minSize">Optional minimum resolution (e.g. 512 for the full-screen VS close-ups).</param>
        public static Texture2D Get(FighterDefinition def, bool closeUp = true, int minSize = 0)
        {
            int size = QualityProfile.Current != null && QualityProfile.Current.Tier == QualityTier.PcHigh ? 512 : 256;
            size = Mathf.Max(size, minSize);
            string key = def.Id + (closeUp ? "_face" : "_body") + "_" + size;
            if (Cache.TryGetValue(key, out var tex) && tex != null) return tex;

            int w = size, h = closeUp ? size : size * 2;
            tex = new Texture2D(w, h, TextureFormat.RGBA32, false) { name = "Portrait_" + key, wrapMode = TextureWrapMode.Clamp };
            var fill = new Color32[w * h];
            var bg = (Color32)Background(def);
            for (int i = 0; i < fill.Length; i++) fill[i] = bg;
            tex.SetPixels32(fill);
            tex.Apply(false);
            Cache[key] = tex;

            if (_runner == null)
            {
                var go = new GameObject("PortraitStudioRunner");
                Object.DontDestroyOnLoad(go);
                _runner = go.AddComponent<Runner>();
            }
            _runner.StartCoroutine(Render(def, closeUp, tex, _slot++));
            return tex;
        }

        static Color Background(FighterDefinition def) => Color.Lerp(def.Energy, new Color(0.05f, 0.02f, 0.12f), 0.5f);

        static Light FindKeyLight()
        {
            Light best = null;
            foreach (var l in Object.FindObjectsByType<Light>(FindObjectsSortMode.None))
                if (l.type == LightType.Directional && l.isActiveAndEnabled && l.gameObject.layer != Layer && (best == null || l.intensity > best.intensity))
                    best = l;
            return best;
        }

        static IEnumerator Render(FighterDefinition def, bool closeUp, Texture2D target, int slot)
        {
            yield return null; // let the stage build its lights first

            var studio = new GameObject("PortraitStudio");
            studio.transform.position = new Vector3(slot * 12f, -200, 0);

            // face the stage key light: the character shader is lit by the main directional light only,
            // so a fighter turned away from it renders as a dark silhouette
            var key = FindKeyLight();
            var toLight = key != null ? -key.transform.forward : Vector3.back;
            toLight.y = 0;
            if (toLight.sqrMagnitude < 0.01f) toLight = Vector3.back;
            toLight.Normalize();

            var holder = new GameObject("Fighter").transform;
            holder.SetParent(studio.transform, false);
            holder.rotation = Quaternion.LookRotation(toLight, Vector3.up);
            var rig = FighterRig.Build(holder, def, null);
            rig.PoseForPortrait(closeUp);

            var rt = new RenderTexture(target.width, target.height, 24, RenderTextureFormat.ARGB32) { name = "PortraitRT" };
            rt.Create();
            var camGo = new GameObject("PortraitCam");
            camGo.transform.SetParent(studio.transform, false);
            var cam = camGo.AddComponent<Camera>();
            cam.enabled = false;
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = Background(def);
            cam.fieldOfView = closeUp ? 24f : 30f;
            cam.nearClipPlane = 0.05f;
            cam.farClipPlane = 20f;
            cam.cullingMask = 1 << Layer;
            cam.targetTexture = rt;
            cam.allowHDR = false;
            cam.allowMSAA = false;

            var head = rig.HeadBone != null ? rig.HeadBone.position + Vector3.up * 0.06f * def.Height : studio.transform.position + Vector3.up * 1.62f * def.Height;
            var lookAt = closeUp ? head : studio.transform.position + new Vector3(0, 1.05f * def.Height, 0);
            var side = Vector3.Cross(Vector3.up, toLight);
            camGo.transform.position = lookAt + toLight * (closeUp ? 1.3f : 4.4f) + side * (closeUp ? 0.32f : 0.6f) + Vector3.up * (closeUp ? 0.02f : 0.1f);
            camGo.transform.LookAt(lookAt);

            foreach (var t in studio.GetComponentsInChildren<Transform>(true)) t.gameObject.layer = Layer;

            yield return null;
            rig.PoseForPortrait(closeUp);
            yield return new WaitForEndOfFrame();

            bool fog = RenderSettings.fog;
            RenderSettings.fog = false;
            cam.Render();
            RenderSettings.fog = fog;

            var prev = RenderTexture.active;
            RenderTexture.active = rt;
            target.ReadPixels(new Rect(0, 0, rt.width, rt.height), 0, 0, false);
            RenderTexture.active = prev;

            // force opaque + measure how much of the frame the fighter covers (diagnostics in the Console)
            var px = target.GetPixels32();
            var bg = (Color32)Background(def);
            int differ = 0;
            for (int i = 0; i < px.Length; i++)
            {
                px[i].a = 255;
                if (Mathf.Abs(px[i].r - bg.r) + Mathf.Abs(px[i].g - bg.g) + Mathf.Abs(px[i].b - bg.b) > 40) differ++;
            }
            target.SetPixels32(px);
            target.Apply(false);
            float coverage = differ / (float)px.Length;
            Debug.Log($"[MuscleBattle] Portrait v3 '{def.Id}' -> Texture2D, figure covers {coverage:P0}" + (coverage < 0.03f ? "  (EMPTY: check framing)" : ""));

            cam.targetTexture = null;
            rt.Release();
            Object.Destroy(rt);
            Object.Destroy(studio);
        }
    }
}
