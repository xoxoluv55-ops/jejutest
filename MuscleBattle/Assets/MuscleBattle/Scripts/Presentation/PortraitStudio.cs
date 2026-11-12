using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace MuscleBattle
{
    /// <summary>
    /// Renders character portraits (HUD corners, select screen, VS, cut-ins) from the real 3D
    /// fighter (prototype or Humanoid model) into RenderTextures.
    ///
    /// Get() returns the texture immediately (cleared to a dark tint) and renders it over the next
    /// frames with a normal enabled camera on an isolated layer - the earlier one-shot Camera.Render()
    /// at startup produced empty portraits on some setups (DX12).
    /// </summary>
    public static class PortraitStudio
    {
        public const int Layer = 31;
        static readonly Dictionary<string, RenderTexture> Cache = new Dictionary<string, RenderTexture>();
        static Runner _runner;
        static int _slot;

        sealed class Runner : MonoBehaviour { }

        public static RenderTexture Get(FighterDefinition def, bool closeUp = true)
        {
            string key = def.Id + (closeUp ? "_face" : "_body");
            if (Cache.TryGetValue(key, out var rt) && rt != null) return rt;

            int size = QualityProfile.Current != null && QualityProfile.Current.Tier == QualityTier.PcHigh ? 512 : 256;
            rt = new RenderTexture(size, closeUp ? size : size * 2, 16, RenderTextureFormat.ARGB32) { name = "Portrait_" + key };
            rt.Create();
            var bg = Background(def);
            var prev = RenderTexture.active;
            RenderTexture.active = rt;
            GL.Clear(true, true, bg);
            RenderTexture.active = prev;
            Cache[key] = rt;

            if (_runner == null)
            {
                var go = new GameObject("PortraitStudioRunner");
                Object.DontDestroyOnLoad(go);
                _runner = go.AddComponent<Runner>();
            }
            _runner.StartCoroutine(Render(def, closeUp, rt, _slot++));
            return rt;
        }

        static Color Background(FighterDefinition def) => Color.Lerp(def.Energy, new Color(0.05f, 0.02f, 0.12f), 0.5f);

        static IEnumerator Render(FighterDefinition def, bool closeUp, RenderTexture rt, int slot)
        {
            var studio = new GameObject("PortraitStudio");
            studio.transform.position = new Vector3(slot * 12f, -200, 0);
            var holder = new GameObject("Fighter").transform;
            holder.SetParent(studio.transform, false);
            // face the stage key light: the character shader is lit by the main directional light only,
            // so a fighter turned away from it renders as a dark silhouette
            var key = StageManager.Instance != null ? StageManager.Instance.KeyLight : null;
            var toLight = key != null ? -key.transform.forward : Vector3.back;
            toLight.y = 0;
            if (toLight.sqrMagnitude < 0.01f) toLight = Vector3.back;
            toLight.Normalize();
            holder.rotation = Quaternion.LookRotation(toLight, Vector3.up);
            var rig = FighterRig.Build(holder, def, null);
            rig.PoseForPortrait(closeUp);

            var camGo = new GameObject("PortraitCam");
            camGo.transform.SetParent(studio.transform, false);
            var cam = camGo.AddComponent<Camera>();
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = Background(def);
            cam.fieldOfView = closeUp ? 24f : 30f;
            cam.nearClipPlane = 0.05f;
            cam.farClipPlane = 20f;
            cam.cullingMask = 1 << Layer;
            cam.targetTexture = rt;
            cam.depth = -50;
            cam.allowHDR = false;

            var head = rig.HeadBone != null ? rig.HeadBone.position + Vector3.up * 0.06f * def.Height : studio.transform.position + Vector3.up * 1.62f * def.Height;
            var target = closeUp ? head : studio.transform.position + new Vector3(0, 1.05f * def.Height, 0);
            var side = Vector3.Cross(Vector3.up, toLight);
            camGo.transform.position = target + toLight * (closeUp ? 1.3f : 4.4f) + side * (closeUp ? 0.32f : 0.6f) + Vector3.up * (closeUp ? 0.02f : 0.1f);
            camGo.transform.LookAt(target);

            var keyLight = new GameObject("Key").AddComponent<Light>();
            keyLight.transform.SetParent(studio.transform, false);
            keyLight.type = LightType.Directional;
            keyLight.transform.rotation = Quaternion.Euler(20, 25, 0);
            keyLight.intensity = 0.9f;
            keyLight.cullingMask = 1 << Layer;
            var rim = new GameObject("Rim").AddComponent<Light>();
            rim.transform.SetParent(studio.transform, false);
            rim.type = LightType.Directional;
            rim.transform.rotation = Quaternion.Euler(10, 150, 0);
            rim.color = def.Energy;
            rim.intensity = 1.2f;
            rim.cullingMask = 1 << Layer;

            foreach (var t in studio.GetComponentsInChildren<Transform>(true)) t.gameObject.layer = Layer;

            // let the model's own scripts (spring bones) settle, render with the normal pipeline
            yield return null;
            rig.PoseForPortrait(closeUp);
            yield return null;
            yield return new WaitForEndOfFrame();
            cam.Render(); // explicit render as well (some setups skip offscreen cameras on the first frames)

            // read back, force opaque alpha (UI would otherwise show nothing if the pipeline left alpha at 0),
            // and log what we captured so a blank portrait can be diagnosed from the Console
            var prev = RenderTexture.active;
            RenderTexture.active = rt;
            var tex = new Texture2D(rt.width, rt.height, TextureFormat.RGBA32, false);
            tex.ReadPixels(new Rect(0, 0, rt.width, rt.height), 0, 0);
            RenderTexture.active = prev;
            var px = tex.GetPixels32();
            long sum = 0;
            int differ = 0;
            var bg = (Color32)Background(def);
            for (int i = 0; i < px.Length; i++)
            {
                px[i].a = 255;
                sum += px[i].r + px[i].g + px[i].b;
                if (Mathf.Abs(px[i].r - bg.r) + Mathf.Abs(px[i].g - bg.g) + Mathf.Abs(px[i].b - bg.b) > 30) differ++;
            }
            tex.SetPixels32(px);
            tex.Apply(false);
            Graphics.Blit(tex, rt);
            float avg = sum / (3f * px.Length);
            float coverage = differ / (float)px.Length;
            if (coverage < 0.02f)
                Debug.LogWarning($"[MuscleBattle] Portrait '{def.Id}' looks empty (avg {avg:0}, figure {coverage:P0}). Camera at {camGo.transform.position}, head {head}.");
            else
                Debug.Log($"[MuscleBattle] Portrait '{def.Id}' rendered (figure covers {coverage:P0}).");
            Object.Destroy(tex);

            cam.enabled = false;
            Object.Destroy(studio);
        }
    }
}
