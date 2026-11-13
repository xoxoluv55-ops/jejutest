using System.IO;
using UnityEditor;
using UnityEngine;

namespace MuscleBattle.EditorTools
{
    /// <summary>
    /// Auto-configures character assets dropped into Assets/MuscleBattle/Resources/Characters/.
    ///
    ///   Characters/jin.fbx, ray.fbx          → Humanoid rig, avatar created from the model, materials extracted
    ///   Characters/jin_anims/idle.fbx ...     → Humanoid clips (avatar copied from the character), the clip is
    ///                                           renamed to the file name (idle, walk_forward, l1, special ...),
    ///                                           looping set for locomotion / idle clips, root motion baked in place
    ///   any texture under Characters/         → max 1024 px, ASTC on WebGL / iOS (iPad memory budget)
    ///
    /// Mixamo download settings that match this importer:
    ///   character: FBX for Unity, T-pose, With Skin.  animations: FBX for Unity, Without Skin, 30 fps, In Place ON.
    /// </summary>
    public class MixamoImporter : AssetPostprocessor
    {
        const string Root = "Assets/MuscleBattle/Resources/Characters/";

        static readonly string[] Looping =
        {
            "idle", "select_idle", "walk_forward", "walk_backward", "strafe_left", "strafe_right", "guard", "victory",
        };

        static bool IsCharacterAsset(string path) => path.Replace('\\', '/').StartsWith(Root);

        static bool IsAnimFile(string path, out string characterId)
        {
            characterId = null;
            var dir = Path.GetDirectoryName(path)?.Replace('\\', '/');
            if (dir == null || !dir.EndsWith("_anims")) return false;
            characterId = Path.GetFileName(dir);
            characterId = characterId.Substring(0, characterId.Length - "_anims".Length);
            return true;
        }

        void OnPreprocessModel()
        {
            if (!IsCharacterAsset(assetPath)) return;
            var mi = (ModelImporter)assetImporter;
            mi.animationType = ModelImporterAnimationType.Human;
            mi.importCameras = false;
            mi.importLights = false;
            mi.importBlendShapes = false;
            mi.meshCompression = ModelImporterMeshCompression.Medium;
            mi.animationCompression = ModelImporterAnimationCompression.Optimal;
            mi.resampleCurves = true;

            if (IsAnimFile(assetPath, out var id))
            {
                // clips only: reuse the character's avatar so every clip retargets onto the same skeleton
                mi.importAnimation = true;
                mi.materialImportMode = ModelImporterMaterialImportMode.None;
                var charPath = Root + id + ".fbx";
                var avatar = AssetDatabase.LoadAssetAtPath<Avatar>(charPath);
                if (avatar != null)
                {
                    mi.avatarSetup = ModelImporterAvatarSetup.CopyFromOther;
                    mi.sourceAvatar = avatar;
                }
                else mi.avatarSetup = ModelImporterAvatarSetup.CreateFromThisModel;
            }
            else
            {
                mi.avatarSetup = ModelImporterAvatarSetup.CreateFromThisModel;
                mi.importAnimation = false;
                mi.materialImportMode = ModelImporterMaterialImportMode.ImportStandard;
                mi.materialLocation = ModelImporterMaterialLocation.InPrefab;
            }
        }

        void OnPreprocessAnimation()
        {
            if (!IsCharacterAsset(assetPath) || !IsAnimFile(assetPath, out _)) return;
            var mi = (ModelImporter)assetImporter;
            var key = Path.GetFileNameWithoutExtension(assetPath).ToLowerInvariant();
            var clips = mi.defaultClipAnimations;
            if (clips == null || clips.Length == 0) return;
            // Mixamo exports one take ("mixamo.com"); keep the first and name it after the file
            var c = clips[0];
            c.name = key;
            c.loopTime = System.Array.IndexOf(Looping, key) >= 0;
            c.loopPose = c.loopTime;
            c.lockRootRotation = true;
            c.lockRootHeightY = false;
            c.lockRootPositionXZ = true;
            c.keepOriginalOrientation = true;
            c.keepOriginalPositionY = true;
            c.keepOriginalPositionXZ = true;
            mi.clipAnimations = new[] { c };
        }

        void OnPreprocessTexture()
        {
            if (!IsCharacterAsset(assetPath)) return;
            var ti = (TextureImporter)assetImporter;
            ti.maxTextureSize = 2048;
            ti.mipmapEnabled = true;
            foreach (var platform in new[] { "WebGL", "iPhone" })
            {
                var s = ti.GetPlatformTextureSettings(platform);
                s.overridden = true;
                s.maxTextureSize = 1024;
                s.format = TextureImporterFormat.ASTC_6x6;
                s.compressionQuality = 50;
                ti.SetPlatformTextureSettings(s);
            }
        }

        void OnPostprocessModel(GameObject go)
        {
            if (!IsCharacterAsset(assetPath)) return;
            foreach (var r in go.GetComponentsInChildren<SkinnedMeshRenderer>(true))
            {
                r.quality = SkinQuality.Bone2;          // iPad: 2 bone weights is plenty at fighting-game distance
                r.updateWhenOffscreen = false;
                r.skinnedMotionVectors = false;
            }
        }

        [MenuItem("MUSCLE BATTLE/Characters/Reimport Character Assets (Mixamo)", priority = 11)]
        static void ReimportAll()
        {
            // character models first (avatars), then clips that copy those avatars
            var guids = AssetDatabase.FindAssets("t:Model", new[] { Root.TrimEnd('/') });
            foreach (var pass in new[] { false, true })
                foreach (var g in guids)
                {
                    var p = AssetDatabase.GUIDToAssetPath(g);
                    if (IsAnimFile(p, out _) == pass) AssetDatabase.ImportAsset(p, ImportAssetOptions.ForceUpdate);
                }
            Debug.Log($"[MuscleBattle] Reimported {guids.Length} character model/animation files.");
        }
    }
}
