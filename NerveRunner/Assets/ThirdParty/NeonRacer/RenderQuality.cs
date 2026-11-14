// Reused from Neon Racer (https://github.com/pinchasVaknin/neon-racer, commit 090f15b), MIT License,
// Copyright (c) 2026 Pinchas Vaknin. See LICENSE.txt in this folder.
// Status: ADAPTED from Runtime/World/EnvironmentController.cs - the theme/track specific parts
// were removed; kept: per-camera URP anti-aliasing, desktop-only bloom volume, and the mobile
// render budget (render scale cap, shadow distance, far plane, fog pulled in). The mobile
// "post-processing off" rule is Neon Racer's device-tested fix for a white screen on phones
// whose pipeline asset runs with HDR off.
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace NeonRacer
{
    public static class RenderQuality
    {
        const float RENDER_SCALE_CAP = 0.8f;   // iPad: retina panel, 0.8 keeps it sharp but cheap
        const float MOBILE_URP_SHADOWS = 30f;

        /// NERVE RUNNER 2.1 (PERF): level 0 Low = no AA, no post, render scale 0.75;
        /// 1 Medium = FXAA, no post; 2 High = SMAA (desktop) + bloom.
        public static void ApplyLevel(Camera cam, int level)
        {
            if (cam == null) return;
            try
            {
                var data = cam.GetUniversalAdditionalCameraData();
                if (data != null)
                {
                    data.antialiasing = level == 0 ? AntialiasingMode.None
                                      : (level == 1 || Application.isMobilePlatform) ? AntialiasingMode.FastApproximateAntialiasing
                                      : AntialiasingMode.SubpixelMorphologicalAntiAliasing;
                    data.antialiasingQuality = level >= 2 ? AntialiasingQuality.High : AntialiasingQuality.Medium;
                    data.renderPostProcessing = level >= 2 && !Application.isMobilePlatform;
                }
                var urp = GraphicsSettings.currentRenderPipeline as UniversalRenderPipelineAsset;
                if (urp != null && level == 0 && Application.isMobilePlatform) urp.renderScale = Mathf.Min(urp.renderScale, 0.75f);
            }
            catch { }
            if (level >= 2) SetupPostFx();
            else if (postFx != null) postFx.gameObject.SetActive(false);
            if (level >= 2 && postFx != null) postFx.gameObject.SetActive(true);
        }

        public static void EnableAntiAliasing(Camera cam)
        {
            if (cam == null) return;
            try
            {
                var data = cam.GetUniversalAdditionalCameraData();
                if (data != null)
                {
                    bool mobile = Application.isMobilePlatform;
                    data.antialiasing = mobile ? AntialiasingMode.FastApproximateAntialiasing
                                               : AntialiasingMode.SubpixelMorphologicalAntiAliasing;
                    data.antialiasingQuality = AntialiasingQuality.High;
                    data.renderPostProcessing = !mobile;   // bloom is desktop-only
                }
            }
            catch { }
        }

        static Volume postFx;

        public static void SetupPostFx()
        {
            if (postFx != null || Application.isMobilePlatform) return;
            try
            {
                GameObject go = new GameObject("PostFX (Neon Glow)");
                Object.DontDestroyOnLoad(go);
                postFx = go.AddComponent<Volume>();
                postFx.isGlobal = true;
                postFx.priority = 10f;
                VolumeProfile prof = ScriptableObject.CreateInstance<VolumeProfile>();
                Bloom bloom = prof.Add<Bloom>();
                bloom.threshold.Override(0.9f);
                bloom.intensity.Override(1.1f);
                bloom.scatter.Override(0.65f);
                Vignette vig = prof.Add<Vignette>();
                vig.intensity.Override(0.25f);
                vig.smoothness.Override(0.4f);
                postFx.profile = prof;
            }
            catch { }
        }

        public static void ApplyMobileBudget(Camera cam, float farPlane)
        {
            if (!Application.isMobilePlatform) return;
            QualitySettings.pixelLightCount = 2;
            try
            {
                var urp = GraphicsSettings.currentRenderPipeline as UniversalRenderPipelineAsset;
                if (urp != null)
                {
                    urp.shadowDistance = MOBILE_URP_SHADOWS;
                    urp.renderScale = Mathf.Min(urp.renderScale, RENDER_SCALE_CAP);
                }
            }
            catch { }
            if (cam != null)
            {
                cam.farClipPlane = farPlane;
                RenderSettings.fogEndDistance = Mathf.Min(RenderSettings.fogEndDistance, farPlane * 0.96f);
                RenderSettings.fogStartDistance = Mathf.Min(RenderSettings.fogStartDistance, RenderSettings.fogEndDistance * 0.45f);
            }
        }
    }
}
