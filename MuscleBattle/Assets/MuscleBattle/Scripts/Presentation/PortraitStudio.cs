using System.Collections.Generic;
using UnityEngine;

namespace MuscleBattle
{
    /// <summary>
    /// Renders character portraits (HUD corners, select screen, VS, cut-ins) from the real 3D
    /// fighter into RenderTextures, so portraits always match the in-game model.
    /// A temporary rig is posed far below the arena with its own camera, rendered once, destroyed.
    /// </summary>
    public static class PortraitStudio
    {
        static readonly Dictionary<string, RenderTexture> Cache = new Dictionary<string, RenderTexture>();

        public static RenderTexture Get(FighterDefinition def, bool closeUp = true)
        {
            string key = def.Id + (closeUp ? "_face" : "_body");
            if (Cache.TryGetValue(key, out var rt) && rt != null) return rt;

            int size = QualityProfile.Current != null && QualityProfile.Current.Tier == QualityTier.PcHigh ? 512 : 256;
            rt = new RenderTexture(closeUp ? size : size, closeUp ? size : size * 2, 16, RenderTextureFormat.ARGB32) { name = "Portrait_" + key };
            rt.Create();

            var studio = new GameObject("PortraitStudio");
            studio.transform.position = new Vector3(0, -200, 0);
            var holder = new GameObject("Fighter").transform;
            holder.SetParent(studio.transform, false);
            holder.rotation = Quaternion.Euler(0, 180, 0); // face the camera (-Z)
            var rig = FighterRig.Build(holder, def, null);
            rig.PoseForPortrait(closeUp);

            var camGo = new GameObject("PortraitCam");
            camGo.transform.SetParent(studio.transform, false);
            var cam = camGo.AddComponent<Camera>();
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = Color.Lerp(def.Energy, Color.black, 0.78f);
            cam.fieldOfView = closeUp ? 24f : 30f;
            cam.nearClipPlane = 0.05f;
            cam.farClipPlane = 20f;
            cam.targetTexture = rt;
            cam.enabled = false;

            float h = def.Height;
            var target = studio.transform.position + new Vector3(0, (closeUp ? 1.62f : 1.05f) * h, 0);
            camGo.transform.position = target + new Vector3(closeUp ? -0.35f : -0.6f, closeUp ? 0.02f : 0.1f, closeUp ? -1.35f : -4.4f);
            camGo.transform.LookAt(target);

            // key + rim light for the shot
            var key1 = new GameObject("Key").AddComponent<Light>();
            key1.transform.SetParent(studio.transform, false);
            key1.type = LightType.Directional;
            key1.transform.rotation = Quaternion.Euler(25, 20, 0);
            key1.intensity = 0.6f;
            key1.cullingMask = ~0;

            bool fog = RenderSettings.fog;
            RenderSettings.fog = false;
            cam.Render();
            RenderSettings.fog = fog;

            Object.DestroyImmediate(studio);
            Cache[key] = rt;
            return rt;
        }
    }
}
