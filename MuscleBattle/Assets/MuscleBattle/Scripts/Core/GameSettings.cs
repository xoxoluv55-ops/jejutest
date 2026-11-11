using UnityEngine;

namespace MuscleBattle
{
    public enum CpuDifficulty { Easy, Normal, Hard }

    /// <summary>Player facing settings, persisted with PlayerPrefs.</summary>
    public static class GameSettings
    {
        public static float CameraShake = 1f;     // 0..1.5 (master prompt §41: adjustable)
        public static float MusicVolume = 0.7f;
        public static float SfxVolume = 1f;
        public static float VoiceVolume = 1f;
        public static int RoundsToWin = 2;        // 3R
        public static int RoundTime = 60;
        public static CpuDifficulty Difficulty = CpuDifficulty.Normal;
        public static bool ForceTouchControls;

        public static void Load()
        {
            CameraShake = PlayerPrefs.GetFloat("mb.shake", 1f);
            MusicVolume = PlayerPrefs.GetFloat("mb.music", 0.7f);
            SfxVolume = PlayerPrefs.GetFloat("mb.sfx", 1f);
            VoiceVolume = PlayerPrefs.GetFloat("mb.voice", 1f);
            RoundTime = PlayerPrefs.GetInt("mb.time", 60);
            RoundsToWin = PlayerPrefs.GetInt("mb.rounds", 2);
            Difficulty = (CpuDifficulty)PlayerPrefs.GetInt("mb.cpu", 1);
            ForceTouchControls = PlayerPrefs.GetInt("mb.touch", 0) == 1;
        }

        public static void Save()
        {
            PlayerPrefs.SetFloat("mb.shake", CameraShake);
            PlayerPrefs.SetFloat("mb.music", MusicVolume);
            PlayerPrefs.SetFloat("mb.sfx", SfxVolume);
            PlayerPrefs.SetFloat("mb.voice", VoiceVolume);
            PlayerPrefs.SetInt("mb.time", RoundTime);
            PlayerPrefs.SetInt("mb.rounds", RoundsToWin);
            PlayerPrefs.SetInt("mb.cpu", (int)Difficulty);
            PlayerPrefs.SetInt("mb.touch", ForceTouchControls ? 1 : 0);
            PlayerPrefs.Save();
        }

        public static bool UseTouchControls => ForceTouchControls || QualityProfile.IsTouchDevice;
    }
}
