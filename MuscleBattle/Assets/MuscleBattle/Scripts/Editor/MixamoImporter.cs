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

            if (IsAnimFile(assetPath, out _))
            {
                // clips only. Each clip file gets its own avatar: Humanoid clips are stored in muscle space and
                // retarget onto any Humanoid character (copying the character avatar fails when the exporter
                // names the clip root after the file instead of "Armature").
                mi.importAnimation = true;
                mi.materialImportMode = ModelImporterMaterialImportMode.None;
                mi.avatarSetup = ModelImporterAvatarSetup.CreateFromThisModel;
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
            if (assetPath.Replace('\\', '/').StartsWith("Assets/MuscleBattle/Resources/UI/Art/"))
            {
                // cut-out illustrations: keep the real aspect (no power-of-two rescale), clean alpha edges
                var ui = (TextureImporter)assetImporter;
                ui.textureType = TextureImporterType.Default;
                ui.npotScale = TextureImporterNPOTScale.None;
                ui.mipmapEnabled = false;
                ui.alphaIsTransparency = true;
                ui.wrapMode = TextureWrapMode.Clamp;
                ui.maxTextureSize = 1024;
                return;
            }
            if (!IsCharacterAsset(assetPath)) return;
            var ti = (TextureImporter)assetImporter;
            ti.maxTextureSize = 2048;
            if (Path.GetFileName(assetPath).Contains("Normal")) ti.textureType = TextureImporterType.NormalMap;
            ti.mipmapEnabled = true;
            var file = Path.GetFileNameWithoutExtension(assetPath);
            bool cutout = file.EndsWith("_Hair") || file.EndsWith("_Brows") || file.EndsWith("_Lashes");
            ti.alphaSource = cutout ? TextureImporterAlphaSource.FromInput : TextureImporterAlphaSource.None;
            ti.alphaIsTransparency = cutout;
            foreach (var platform in new[] { "WebGL", "iPhone" })
            {
                var s = ti.GetPlatformTextureSettings(platform);
                s.overridden = true;
                s.maxTextureSize = file.EndsWith("_Body") ? 2048 : 1024; // skin carries the face: keep it sharp
                s.format = TextureImporterFormat.ASTC_6x6;
                s.compressionQuality = 50;
                ti.SetPlatformTextureSettings(s);
            }
        }

        void OnPostprocessMaterial(Material m)
        {
            if (!IsCharacterAsset(assetPath) || m.shader == null || m.shader.name != "Standard") return;
            AssignTextures(m);
            string kind = m.name.Substring(m.name.LastIndexOf('_') + 1);
            float gloss = kind switch { "Body" => 0.36f, "Eyes" => 0.85f, "Hair" => 0.42f, "Gloves" => 0.45f, "Belt" => 0.4f, "Bands" => 0.4f, _ => 0.18f };
            m.SetFloat("_Glossiness", gloss);
            m.SetFloat("_Metallic", 0f);
            if (kind == "Hair" || kind == "Brows" || kind == "Lashes")
            {
                // MakeHuman hair / brow / lash cards: alpha cutout (geometry is exported double-sided)
                m.SetFloat("_Mode", 1f);
                m.SetFloat("_Cutoff", kind == "Hair" ? 0.42f : 0.3f);
                m.SetInt("_SrcBlend", (int)UnityEngine.Rendering.BlendMode.One);
                m.SetInt("_DstBlend", (int)UnityEngine.Rendering.BlendMode.Zero);
                m.SetInt("_ZWrite", 1);
                m.EnableKeyword("_ALPHATEST_ON");
                m.DisableKeyword("_ALPHABLEND_ON");
                m.DisableKeyword("_ALPHAPREMULTIPLY_ON");
                m.renderQueue = (int)UnityEngine.Rendering.RenderQueue.AlphaTest;
            }
            else
            {
                m.SetFloat("_Mode", 0f);
                m.SetInt("_SrcBlend", (int)UnityEngine.Rendering.BlendMode.One);
                m.SetInt("_DstBlend", (int)UnityEngine.Rendering.BlendMode.Zero);
                m.SetInt("_ZWrite", 1);
                m.DisableKeyword("_ALPHATEST_ON");
                m.DisableKeyword("_ALPHABLEND_ON");
                m.DisableKeyword("_ALPHAPREMULTIPLY_ON");
                m.renderQueue = -1;
            }
        }

        /// <summary>
        /// Character textures live in Characters/Textures and are bound by material name:
        /// M_{Id}_Body → T_{Id}_Body + T_Fighter_Normal, M_{Id}_Hair / M_{Id}_Brows_Hair → T_{Id}_Hair (+ T_Hair_1_Normal),
        /// M_{Id}_Eyes → T_Eye_Brown. Missing files are skipped (Reimport Character Assets imports textures first).
        /// </summary>
        static void AssignTextures(Material m)
        {
            // MUSCLE BATTLE 2.0 MPFB fighters: every material M_{Id}_{Part} has a baked map T_{Id}_{Part}.png
            var parts = m.name.Split('_');
            if (parts.Length < 3 || parts[0] != "M") return;
            string id = parts[1];
            string kind = parts[parts.Length - 1];
            var tex = AssetDatabase.LoadAssetAtPath<Texture2D>(Root + "Textures/T_" + id + "_" + kind + ".png");
            if (tex == null) return;
            m.color = Color.white;
            m.SetTexture("_MainTex", tex);
            m.SetTexture("_BumpMap", null);
            m.DisableKeyword("_NORMALMAP");
        }

        void OnPostprocessModel(GameObject go)
        {
            if (!IsCharacterAsset(assetPath)) return;
            foreach (var r in go.GetComponentsInChildren<SkinnedMeshRenderer>(true))
            {
                r.quality = SkinQuality.Bone4;          // MPFB weights blend up to 4 bones (shoulders / hips deform badly with 2)
                r.updateWhenOffscreen = false;
                r.skinnedMotionVectors = false;
            }
        }

        [MenuItem("MUSCLE BATTLE/Characters/Reimport Character Assets (Mixamo)", priority = 11)]
        static void ReimportAll()
        {
            // textures first (materials bind them by name), then character models, then clips
            foreach (var t in AssetDatabase.FindAssets("t:Texture2D", new[] { Root + "Textures" }))
                AssetDatabase.ImportAsset(AssetDatabase.GUIDToAssetPath(t), ImportAssetOptions.ForceUpdate);
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
