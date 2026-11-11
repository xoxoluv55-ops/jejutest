using UnityEngine;

namespace MuscleBattle
{
    /// <summary>
    /// Global slow motion (master prompt §42: only for perfect counter, clash, force couple,
    /// final hit, KO, ultimate). Hit stop is handled per-fight in CombatManager (frame based).
    /// </summary>
    public sealed class TimeController : MonoBehaviour
    {
        public static TimeController Instance { get; private set; }

        float _slowScale = 1f;
        float _slowRemaining;
        public bool Paused { get; set; }

        void Awake() { Instance = this; }

        /// <param name="scale">time scale while slowed (e.g. 0.25)</param>
        /// <param name="realSeconds">duration in unscaled seconds</param>
        public void SlowMotion(float scale, float realSeconds)
        {
            if (_slowRemaining > 0 && scale > _slowScale) return; // keep the stronger slow-mo
            _slowScale = scale;
            _slowRemaining = realSeconds;
        }

        public void Clear()
        {
            _slowRemaining = 0;
            Time.timeScale = 1f;
        }

        void Update()
        {
            if (Paused)
            {
                Time.timeScale = 0f;
                return;
            }
            if (_slowRemaining > 0)
            {
                _slowRemaining -= Time.unscaledDeltaTime;
                float target = _slowScale;
                // ease back to normal speed in the final 0.25s
                if (_slowRemaining < 0.25f) target = Mathf.Lerp(1f, _slowScale, _slowRemaining / 0.25f);
                Time.timeScale = target;
            }
            else if (!Mathf.Approximately(Time.timeScale, 1f))
            {
                Time.timeScale = 1f;
            }
        }
    }
}
