using UnityEngine;

namespace MuscleBattle
{
    public enum QualityTier { PcHigh, WebIPad }

    /// <summary>
    /// Two quality profiles (master prompt §3). Web/iPad keeps every key hit effect
    /// but scales particle counts, trails, shadows and texture sizes down.
    /// </summary>
    public sealed class QualityProfile
    {
        public QualityTier Tier;
        public float ParticleScale;     // multiplier for burst counts
        public int MaxParticlesPerSystem;
        public float TrailTime;
        public float ShadowDistance;
        public bool SoftShadows;
        public int ProceduralTextureSize;
        public int AmbientMotes;
        public bool StageLightShafts;
        public int TargetFrameRate;
        public float RenderScale;       // reserved for URP upgrade path

        public static QualityProfile Current { get; private set; }

        public static bool IsWeb => Application.platform == RuntimePlatform.WebGLPlayer;

        /// <summary>
        /// iPadOS Safari reports itself as desktop Mac, so isMobilePlatform alone is not enough:
        /// touch support is the reliable signal.
        /// </summary>
        public static bool IsTouchDevice => Application.isMobilePlatform || Input.touchSupported;

        public static QualityProfile Detect()
        {
            var saved = PlayerPrefs.GetInt("mb.quality", -1);
            var tier = saved >= 0 ? (QualityTier)saved : (IsWeb || Application.isMobilePlatform ? QualityTier.WebIPad : QualityTier.PcHigh);
            return Apply(tier);
        }

        public static QualityProfile Apply(QualityTier tier)
        {
            var q = tier == QualityTier.PcHigh
                ? new QualityProfile
                {
                    Tier = tier, ParticleScale = 1f, MaxParticlesPerSystem = 220, TrailTime = 0.22f,
                    ShadowDistance = 40f, SoftShadows = true, ProceduralTextureSize = 1024, AmbientMotes = 140,
                    StageLightShafts = true, TargetFrameRate = -1, RenderScale = 1f
                }
                : new QualityProfile
                {
                    Tier = tier, ParticleScale = 0.55f, MaxParticlesPerSystem = 90, TrailTime = 0.12f,
                    ShadowDistance = 18f, SoftShadows = false, ProceduralTextureSize = 512, AmbientMotes = 40,
                    StageLightShafts = true, TargetFrameRate = 60, RenderScale = 0.85f
                };

            QualitySettings.shadowDistance = q.ShadowDistance;
            QualitySettings.shadows = q.SoftShadows ? ShadowQuality.All : ShadowQuality.HardOnly;
            QualitySettings.shadowCascades = q.SoftShadows ? 2 : 1;
            QualitySettings.shadowResolution = q.SoftShadows ? ShadowResolution.High : ShadowResolution.Medium;
            QualitySettings.antiAliasing = q.Tier == QualityTier.PcHigh ? 4 : 2;
            QualitySettings.vSyncCount = q.Tier == QualityTier.PcHigh ? 1 : 0;
            Application.targetFrameRate = q.TargetFrameRate;
            Current = q;
            return q;
        }

        public static void Save(QualityTier tier)
        {
            PlayerPrefs.SetInt("mb.quality", (int)tier);
            PlayerPrefs.Save();
        }
    }
}
