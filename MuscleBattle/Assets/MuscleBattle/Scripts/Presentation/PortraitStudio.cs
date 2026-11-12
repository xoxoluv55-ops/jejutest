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

        static Color Background(FighterDefinition def) => Color.Lerp(def.Energy, new Color(0.03f, 0.01f, 0.08f), 0.72f);

        static IEnumerator Render(FighterDefinition def, bool closeUp, RenderTexture rt, int slot)
        {
            var studio = new GameObject("PortraitStudio");
            studio.transform.position = new Vector3(slot * 12f, -200, 0);
            var holder = new GameObject("Fighter").transform;
            holder.SetParent(studio.transform, false);
            holder.rotation = Quaternion.Euler(0, 180, 0); // face the camera (-Z)
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
            camGo.transform.position = target + new Vector3(closeUp ? -0.32f : -0.6f, closeUp ? 0.02f : 0.1f, closeUp ? -1.3f : -4.4f);
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
            cam.enabled = false;
            Object.Destroy(studio);
        }
    }
}
