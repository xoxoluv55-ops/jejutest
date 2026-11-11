using UnityEngine;

namespace MuscleBattle
{
    /// <summary>
    /// Zero-setup entry point: when any scene loads and no GameModeManager exists, one is created.
    /// Open the project, open (or create) Assets/MuscleBattle/Scenes/MuscleBattle.unity and press Play.
    /// To disable (e.g. in another game's scenes) add the scripting define MUSCLEBATTLE_NO_AUTOBOOT.
    /// </summary>
    public static class Bootstrap
    {
#if !MUSCLEBATTLE_NO_AUTOBOOT
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void Boot()
        {
            if (Object.FindFirstObjectByType<GameModeManager>() != null) return;
            new GameObject("MUSCLE BATTLE").AddComponent<GameModeManager>();
        }
#endif
    }
}
