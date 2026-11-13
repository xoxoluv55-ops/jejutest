using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace MuscleBattle.EditorTools
{
    /// <summary>
    /// One-time project setup + build menu.
    ///  - creates Assets/MuscleBattle/Scenes/MuscleBattle.unity (empty: Bootstrap builds the game at runtime)
    ///  - registers it in Build Settings, applies Player / WebGL settings tuned for iPad Safari
    ///  - MUSCLE BATTLE menu: open scene, build WebGL (iPad), build Windows (PC)
    /// </summary>
    [InitializeOnLoad]
    public static class MuscleBattleEditor
    {
        const string ScenePath = "Assets/MuscleBattle/Scenes/MuscleBattle.unity";
        const string SetupKey = "MuscleBattle.SetupDone.v1";

        static MuscleBattleEditor()
        {
            EditorApplication.delayCall += () =>
            {
                if (!File.Exists(ScenePath) || !EditorPrefs.GetBool(SetupKey + Application.dataPath, false))
                    Setup(false);
            };
        }

        [MenuItem("MUSCLE BATTLE/Setup Project (scene + build settings)", priority = 0)]
        public static void SetupMenu() => Setup(true);

        static void Setup(bool openScene)
        {
            if (!File.Exists(ScenePath))
            {
                Directory.CreateDirectory(Path.GetDirectoryName(ScenePath));
                // an unsaved "Untitled" scene can't host an additive scene: replace it instead (it is empty here,
                // Bootstrap builds the game at runtime)
                bool untitled = string.IsNullOrEmpty(UnityEngine.SceneManagement.SceneManager.GetActiveScene().path);
                var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, untitled ? NewSceneMode.Single : NewSceneMode.Additive);
                EditorSceneManager.SaveScene(scene, ScenePath);
                if (!untitled) EditorSceneManager.CloseScene(scene, true);
                AssetDatabase.Refresh();
            }

            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };

            PlayerSettings.companyName = "MuscleBattle";
            PlayerSettings.productName = "MUSCLE BATTLE";
            PlayerSettings.defaultInterfaceOrientation = UIOrientation.LandscapeLeft;
            PlayerSettings.runInBackground = true;

            // WebGL / iPad Safari
            PlayerSettings.WebGL.template = "PROJECT:MuscleBattle";
            PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Gzip; // Brotli needs https + server config
            PlayerSettings.WebGL.decompressionFallback = true;                      // works on any static host
            PlayerSettings.WebGL.dataCaching = true;
            PlayerSettings.WebGL.exceptionSupport = WebGLExceptionSupport.ExplicitlyThrownExceptionsOnly;

            EditorPrefs.SetBool(SetupKey + Application.dataPath, true);
            Debug.Log("[MuscleBattle] Project setup complete. Open " + ScenePath + " and press Play.");
            if (openScene) OpenScene();
        }

        [MenuItem("MUSCLE BATTLE/Open Vertical Slice Scene", priority = 1)]
        public static void OpenScene()
        {
            if (EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo())
                EditorSceneManager.OpenScene(ScenePath, OpenSceneMode.Single);
        }

        [MenuItem("MUSCLE BATTLE/Characters/Check Character Models", priority = 10)]
        public static void CheckModels()
        {
            Directory.CreateDirectory("Assets/MuscleBattle/Resources/Characters");
            AssetDatabase.Refresh();
            foreach (var def in CharacterDatabase.All)
            {
                string path = string.IsNullOrEmpty(def.ModelResourcePath) ? "Characters/" + def.Id : def.ModelResourcePath;
                var go = Resources.Load<GameObject>(path);
                if (go == null)
                {
                    Debug.LogWarning($"[MuscleBattle] {def.NameEn}: no model at Resources/{path} -> prototype visual. Put {def.Id}.vrm (or a Humanoid prefab named {def.Id}) in Assets/MuscleBattle/Resources/Characters/.");
                    continue;
                }
                var anim = go.GetComponentInChildren<Animator>();
                bool ok = anim != null && anim.avatar != null && anim.avatar.isHuman;
                if (ok) Debug.Log($"[MuscleBattle] {def.NameEn}: OK - Humanoid model '{go.name}' will replace the prototype visual.");
                else Debug.LogError($"[MuscleBattle] {def.NameEn}: '{go.name}' found but it has no Humanoid Avatar (set Rig > Animation Type = Humanoid, or import the .vrm with UniVRM).");
            }
        }

        [MenuItem("MUSCLE BATTLE/Build/WebGL (iPad Safari)", priority = 20)]
        public static void BuildWebGL() => Build(BuildTarget.WebGL, "Builds/WebGL");

        [MenuItem("MUSCLE BATTLE/Build/Windows (PC)", priority = 21)]
        public static void BuildWindows() => Build(BuildTarget.StandaloneWindows64, "Builds/Windows/MuscleBattle.exe");

        /// <summary>Command line: Unity -batchmode -quit -projectPath . -executeMethod MuscleBattle.EditorTools.MuscleBattleEditor.BuildWebGLBatch</summary>
        public static void BuildWebGLBatch() => ExitWith(Build(BuildTarget.WebGL, "Builds/WebGL"));
        public static void BuildWindowsBatch() => ExitWith(Build(BuildTarget.StandaloneWindows64, "Builds/Windows/MuscleBattle.exe"));

        /// <summary>CI: a failed build must fail the job (non-zero exit code).</summary>
        static void ExitWith(bool ok)
        {
            if (Application.isBatchMode) EditorApplication.Exit(ok ? 0 : 1);
        }

        static bool Build(BuildTarget target, string path)
        {
            Setup(false);
            var options = new BuildPlayerOptions
            {
                scenes = new[] { ScenePath },
                locationPathName = path,
                target = target,
                options = BuildOptions.None,
            };
            var report = BuildPipeline.BuildPlayer(options);
            Debug.Log($"[MuscleBattle] Build {target}: {report.summary.result}, {report.summary.totalSize / (1024f * 1024f):0.0} MB, " +
                      $"{report.summary.totalErrors} errors, {report.summary.totalWarnings} warnings -> {path}");
            return report.summary.result == UnityEditor.Build.Reporting.BuildResult.Succeeded;
        }
    }
}
