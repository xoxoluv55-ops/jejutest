// NERVE RUNNER - thin static facade over Neon Racer's procedural audio engine (Sfx, MIT) plus
// NERVE RUNNER's own background music (NRMusic: menu + race loops) and voice ducking.
// All sounds are synthesised at runtime - there are no audio files in the project.
using NeonRacer;
using UnityEngine;

namespace NerveRunner
{
    public static class GameAudio
    {
        static Sfx sfx;
        static AudioSource music;
        static AudioClip menuClip, raceClip;
        static bool musicOn = true;
        const float MUSIC_VOL = 0.42f, MUSIC_DUCKED = 0.16f;

        public static void Init(Transform parent)
        {
            if (sfx != null) return;
            sfx = new Sfx();
            sfx.Init(parent, false);          // effects only; music is NERVE RUNNER's own
            Sfx.I = sfx;
            Sfx.EngineVolume = 0.45f;         // 2.3: the hum used to bury the music
            var go = new GameObject("NR_Music");
            go.transform.SetParent(parent, false);
            music = go.AddComponent<AudioSource>();
            music.loop = true; music.playOnAwake = false; music.spatialBlend = 0f; music.volume = MUSIC_VOL;
        }

        public static void Apply(bool sfxOn, bool musicEnabled)
        {
            Sfx.SetSfxMuted(!sfxOn);
            musicOn = musicEnabled;
            if (music != null) music.mute = !musicEnabled;
        }

        public static void PlayMenuMusic() { Play(menuClip != null ? menuClip : (menuClip = NRMusic.Menu())); }
        public static void PlayRaceMusic() { Play(raceClip != null ? raceClip : (raceClip = NRMusic.Race())); }

        static void Play(AudioClip c)
        {
            if (music == null || c == null) return;
            if (music.clip == c && music.isPlaying) return;
            music.clip = c; music.time = 0f; music.Play();
            music.mute = !musicOn;
        }

        /// Called every frame: music ducks under STAR-01's voice.
        public static void Tick(float dt)
        {
            if (music == null) return;
            float target = StarVoice.Talking ? MUSIC_DUCKED : MUSIC_VOL;
            music.volume = Mathf.MoveTowards(music.volume, target, dt * 1.5f);
        }

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
