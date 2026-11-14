// NERVE RUNNER - thin static facade over Neon Racer's procedural audio engine (Sfx, MIT).
// All sounds are synthesised at runtime - there are no audio files in the project.
using NeonRacer;
using UnityEngine;

namespace NerveRunner
{
    public static class GameAudio
    {
        static Sfx sfx;

        public static void Init(Transform parent)
        {
            if (sfx != null) return;
            sfx = new Sfx();
            sfx.Init(parent, true);
            Sfx.I = sfx;
        }

        public static void Apply(bool sfxOn, bool musicOn) { Sfx.SetSfxMuted(!sfxOn); Sfx.SetMusicMuted(!musicOn); }

        public static void Click() { if (sfx != null) sfx.Click(); }
        public static void Chime() { if (sfx != null) sfx.Chime(); }
        public static void Coin() { if (sfx != null) sfx.Coin(); }
        public static void Thud() { if (sfx != null) sfx.Thud(); }
        public static void Beep() { if (sfx != null) sfx.Beep(); }
        public static void Whoosh() { if (sfx != null) sfx.Whoosh2(); }
        /// The "engine" loop doubles as STAR-01's electric hum.
        public static void Hum(float speed01, bool boosting) { if (sfx != null) sfx.SetEngine(speed01, boosting); }
        public static void Screech(float i) { if (sfx != null) sfx.SetScreech(i); }
        public static void StopLoops() { if (sfx != null) sfx.StopLoops(); }
    }
}
