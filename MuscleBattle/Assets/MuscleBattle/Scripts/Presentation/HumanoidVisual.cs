using System.Collections.Generic;
using UnityEngine;

namespace MuscleBattle
{
    /// <summary>
    /// Production character visual: any Unity Humanoid model in T-pose (VRoid Studio VRM imported with
    /// UniVRM, Mixamo, Asset Store...). Found at Resources/{FighterDefinition.ModelResourcePath}.
    ///
    /// The procedural FighterRig skeleton stays the invisible pose driver (frame-data driven poses), and
    /// this class retargets it every frame: at load both skeletons are put in T-pose and a per-bone
    /// rotation offset is measured, then model.rotation = driver.rotation * offset. This works for any
    /// bone axis convention, so models can be swapped without touching combat code.
    /// (When real animation clips arrive, an Animator path can replace the retarget without changing
    /// FighterController / CombatManager.)
    /// </summary>
    public sealed class HumanoidVisual : MonoBehaviour
    {
        public const float TargetHeight = 1.82f; // metres at FighterDefinition.Height = 1

        static readonly HumanBodyBones[] Map =
        {
            HumanBodyBones.Hips, HumanBodyBones.Spine, HumanBodyBones.Chest, HumanBodyBones.Neck, HumanBodyBones.Head,
            HumanBodyBones.LeftUpperArm, HumanBodyBones.LeftLowerArm, HumanBodyBones.LeftHand,
            HumanBodyBones.RightUpperArm, HumanBodyBones.RightLowerArm, HumanBodyBones.RightHand,
            HumanBodyBones.LeftUpperLeg, HumanBodyBones.LeftLowerLeg, HumanBodyBones.LeftFoot,
            HumanBodyBones.RightUpperLeg, HumanBodyBones.RightLowerLeg, HumanBodyBones.RightFoot,
        }; // same order as FighterRig.J

        Transform[] _driver;
        readonly Transform[] _target = new Transform[Map.Length];
        readonly Quaternion[] _offset = new Quaternion[Map.Length];
        Vector3 _hipsDelta;      // model hips - driver hips at calibration, in rig space
        Transform _rigRoot;
        Animator _animator;
        readonly List<Renderer> _renderers = new List<Renderer>();
        MaterialPropertyBlock _mpb;
        Color _rim;

        public Transform Bone(int driverIndex) => driverIndex >= 0 && driverIndex < _target.Length ? _target[driverIndex] : null;

        /// <summary>Loads and calibrates the model, or returns null (prototype visual stays).</summary>
        public static HumanoidVisual TryCreate(Transform visualRoot, Transform rigRoot, FighterDefinition def, Transform[] driverBones)
        {
            string path = string.IsNullOrEmpty(def.ModelResourcePath) ? "Characters/" + def.Id : def.ModelResourcePath;
            var prefab = Resources.Load<GameObject>(path);
            if (prefab == null) return null;

            var inst = Instantiate(prefab, visualRoot, false);
            inst.name = "Model_" + def.Id;
            inst.transform.localPosition = Vector3.zero;
            inst.transform.localRotation = Quaternion.identity;
            var animator = inst.GetComponentInChildren<Animator>();
            if (animator == null || !animator.isHuman || animator.avatar == null)
            {
                Debug.LogWarning($"[MuscleBattle] '{path}' is not a Humanoid model (needs an Animator with a Humanoid Avatar). Using the prototype visual.");
                Destroy(inst);
                return null;
            }

            var hv = inst.AddComponent<HumanoidVisual>();
            hv._animator = animator;
            hv._driver = driverBones;
            hv._rigRoot = rigRoot;
            hv._mpb = new MaterialPropertyBlock();
            hv._rim = def.Energy;
            for (int i = 0; i < Map.Length; i++)
            {
                hv._target[i] = animator.GetBoneTransform(Map[i]);
                if (hv._target[i] == null && Map[i] == HumanBodyBones.Chest) hv._target[i] = animator.GetBoneTransform(HumanBodyBones.UpperChest);
            }
            if (hv._target[0] == null || hv._target[5] == null || hv._target[8] == null)
            {
                Debug.LogWarning($"[MuscleBattle] '{path}' is missing core humanoid bones. Using the prototype visual.");
                Destroy(inst);
                return null;
            }
            animator.enabled = false; // bones are driven by the retarget (no clip blending yet)
            animator.applyRootMotion = false;

            // fit height: the model is resized so visuals match the gameplay hurtbox
            inst.GetComponentsInChildren(true, hv._renderers);
            var b = new Bounds();
            bool any = false;
            foreach (var r in hv._renderers)
            {
                if (r is ParticleSystemRenderer || r is TrailRenderer || r is LineRenderer) continue;
                if (!any) { b = r.bounds; any = true; }
                else b.Encapsulate(r.bounds);
                r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.On;
            }
            if (any && b.size.y > 0.1f)
                inst.transform.localScale *= TargetHeight * def.Height / b.size.y;
            return hv;
        }

        /// <summary>Call while the driver skeleton is in T-pose (FighterRig.ApplyTPose).</summary>
        public void Calibrate()
        {
            for (int i = 0; i < Map.Length; i++)
                if (_target[i] != null && _driver[i] != null)
                    _offset[i] = Quaternion.Inverse(_driver[i].rotation) * _target[i].rotation;
            _hipsDelta = Quaternion.Inverse(_rigRoot.rotation) * (_target[0].position - _driver[0].position);
            CurlFingers();
        }

        /// <summary>Copy the driver pose to the model (after FighterRig has posed its skeleton).</summary>
        public void Apply()
        {
            for (int i = 0; i < Map.Length; i++)
                if (_target[i] != null && _driver[i] != null)
                    _target[i].rotation = _driver[i].rotation * _offset[i];
            // hips height follows the driver (crouch, knockdown) so feet stay planted on the floor
            _target[0].position = _driver[0].position + _rigRoot.rotation * _hipsDelta;
        }

        /// <summary>Hit flash + character rim light (MToon / Standard / most toon shaders expose these).</summary>
        public void SetFlash(Color c, float amount)
        {
            _mpb.SetColor("_EmissionColor", c * amount);
            _mpb.SetColor("_RimColor", _rim * 0.55f);
            _mpb.SetFloat("_Flash", amount);
            _mpb.SetColor("_FlashColor", c);
            foreach (var r in _renderers)
                if (r != null && !(r is ParticleSystemRenderer) && !(r is TrailRenderer) && !(r is LineRenderer)) r.SetPropertyBlock(_mpb);
        }

        /// <summary>Fighters make fists: curl every finger toward the palm (palms face down in T-pose).</summary>
        void CurlFingers()
        {
            CurlSide(true);
            CurlSide(false);
        }

        void CurlSide(bool left)
        {
            var root = _rigRoot.rotation;
            var axis = root * (left ? Vector3.forward : Vector3.back);
            HumanBodyBones[][] fingers = left
                ? new[]
                {
                    new[] { HumanBodyBones.LeftIndexProximal, HumanBodyBones.LeftIndexIntermediate, HumanBodyBones.LeftIndexDistal },
                    new[] { HumanBodyBones.LeftMiddleProximal, HumanBodyBones.LeftMiddleIntermediate, HumanBodyBones.LeftMiddleDistal },
                    new[] { HumanBodyBones.LeftRingProximal, HumanBodyBones.LeftRingIntermediate, HumanBodyBones.LeftRingDistal },
                    new[] { HumanBodyBones.LeftLittleProximal, HumanBodyBones.LeftLittleIntermediate, HumanBodyBones.LeftLittleDistal },
                }
                : new[]
                {
                    new[] { HumanBodyBones.RightIndexProximal, HumanBodyBones.RightIndexIntermediate, HumanBodyBones.RightIndexDistal },
                    new[] { HumanBodyBones.RightMiddleProximal, HumanBodyBones.RightMiddleIntermediate, HumanBodyBones.RightMiddleDistal },
                    new[] { HumanBodyBones.RightRingProximal, HumanBodyBones.RightRingIntermediate, HumanBodyBones.RightRingDistal },
                    new[] { HumanBodyBones.RightLittleProximal, HumanBodyBones.RightLittleIntermediate, HumanBodyBones.RightLittleDistal },
                };
            float[] angles = { 75f, 85f, 55f };
            foreach (var chain in fingers)
                for (int k = 0; k < chain.Length; k++)
                {
                    var t = _animator.GetBoneTransform(chain[k]);
                    if (t != null) t.rotation = Quaternion.AngleAxis(angles[k], axis) * t.rotation;
                }
            // thumb folds across the fingers
            var thumb = _animator.GetBoneTransform(left ? HumanBodyBones.LeftThumbIntermediate : HumanBodyBones.RightThumbIntermediate);
            if (thumb != null) thumb.rotation = Quaternion.AngleAxis(40f, axis) * thumb.rotation;
        }
    }
}
