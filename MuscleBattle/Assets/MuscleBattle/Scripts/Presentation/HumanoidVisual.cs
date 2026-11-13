using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Animations;
using UnityEngine.Playables;

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
        /// <param name="animate">false for off-screen portrait / anatomy renders (no clip playback)</param>
        public static HumanoidVisual TryCreate(Transform visualRoot, Transform rigRoot, FighterDefinition def, Transform[] driverBones, bool animate = true)
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
            animator.enabled = false; // bones are driven by the retarget until clips take over
            animator.applyRootMotion = false;
            animator.cullingMode = AnimatorCullingMode.AlwaysAnimate;

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
            hv.PrepareMaterials();
            if (animate) hv.LoadClips(path + "_anims");
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

        /// <summary>
        /// Hit flash + character rim light + X-RAY (MToon / Standard / most toon shaders expose these).
        /// X-RAY darkens the albedo so the muscle holograms on top read like an anatomy scan.
        /// </summary>
        public void SetFlash(Color c, float amount, float xray = 0f)
        {
            _mpb.Clear();
            _mpb.SetColor("_EmissionColor", c * amount + (xray > 0 ? _rim * (0.12f * xray) : Color.black));
            _mpb.SetColor("_RimColor", _rim * 0.55f);
            _mpb.SetFloat("_Flash", amount);
            _mpb.SetColor("_FlashColor", c);
            if (xray > 0) _mpb.SetColor("_Color", Color.Lerp(Color.white, new Color(0.12f, 0.14f, 0.24f), xray));
            foreach (var r in _renderers)
                if (r != null && !(r is ParticleSystemRenderer) && !(r is TrailRenderer) && !(r is LineRenderer)) r.SetPropertyBlock(_mpb);
        }

        /// <summary>Instance materials once so hit flash (emission) works on Standard / Mixamo materials.</summary>
        void PrepareMaterials()
        {
            foreach (var r in _renderers)
            {
                if (r == null || r is ParticleSystemRenderer || r is TrailRenderer || r is LineRenderer) continue;
                foreach (var m in r.materials)
                {
                    if (m == null || !m.HasProperty("_EmissionColor")) continue;
                    m.EnableKeyword("_EMISSION");
                    m.globalIlluminationFlags = MaterialGlobalIlluminationFlags.None;
                    m.SetColor("_EmissionColor", Color.black);
                }
            }
        }

        // ------------------------------------------------------------------
        // Real animation clips (Mixamo / any Humanoid clip), played with the Playables API so it works in
        // WebGL builds without AnimatorController assets. Clips live in Resources/Characters/{id}_anims/
        // and are named by key (file name = clip name, set by the editor importer):
        //   idle, select_idle, intro, walk_forward, walk_backward, strafe_left, strafe_right, guard, dodge,
        //   hit, hit_heavy, knockdown, getup, grabbed, throw, victory, defeat,
        //   attacks by move id (l1 l2 l3 h1 k1 k2 counter counterStrike special ultimate)
        //   or by pose (jab cross hook uppercut frontkick roundhouse launchkick slam shoulderrush ultimateburst grab)
        // Frame data stays authoritative: attack clips are scrubbed so the clip's impact (~42%) lands on the
        // move's first active frame. A state without a clip falls back to the procedural retarget.
        // ------------------------------------------------------------------
        PlayableGraph _graph;
        AnimationMixerPlayable _mixer;
        readonly List<AnimationClipPlayable> _plays = new List<AnimationClipPlayable>();
        readonly List<AnimationClip> _clips = new List<AnimationClip>();
        readonly Dictionary<string, int> _clipIndex = new Dictionary<string, int>();
        float[] _weights;
        int _active = -1;
        Vector3 _lastPos;
        bool _hasLastPos;
        public bool HasClips => _plays.Count > 0;
        public int ClipCount => _plays.Count;
        public const float ImpactPoint = 0.42f;

        void LoadClips(string resourcePath)
        {
            var clips = Resources.LoadAll<AnimationClip>(resourcePath);
            foreach (var c in clips)
            {
                if (c == null || c.name.StartsWith("__preview")) continue;
                string key = c.name.ToLowerInvariant();
                if (_clipIndex.ContainsKey(key)) continue;
                _clipIndex[key] = _clips.Count;
                _clips.Add(c);
            }
            if (_clips.Count == 0) return;
            _graph = PlayableGraph.Create("MuscleBattle_" + name);
            _graph.SetTimeUpdateMode(DirectorUpdateMode.GameTime);
            var output = AnimationPlayableOutput.Create(_graph, "Anim", _animator);
            _mixer = AnimationMixerPlayable.Create(_graph, _clips.Count);
            output.SetSourcePlayable(_mixer);
            _weights = new float[_clips.Count];
            for (int i = 0; i < _clips.Count; i++)
            {
                var p = AnimationClipPlayable.Create(_graph, _clips[i]);
                p.SetApplyFootIK(true);
                _graph.Connect(p, 0, _mixer, i);
                _mixer.SetInputWeight(i, 0f);
                _plays.Add(p);
            }
            _graph.Play();
            Debug.Log($"[MuscleBattle] {name}: {_clips.Count} animation clips from Resources/{resourcePath}");
        }

        void OnDestroy()
        {
            if (_graph.IsValid()) _graph.Destroy();
        }

        int Find(params string[] keys)
        {
            foreach (var k in keys)
                if (k != null && _clipIndex.TryGetValue(k.ToLowerInvariant(), out int i)) return i;
            return -1;
        }

        static float AttackPhase(FighterController f, MoveData m)
        {
            int fr = f.MoveFrame;
            if (fr < m.Startup) return ImpactPoint * fr / Mathf.Max(1, m.Startup);
            float rest = (fr - m.Startup) / (float)Mathf.Max(1, m.Active + m.Recovery);
            return ImpactPoint + (1f - ImpactPoint) * Mathf.Clamp01(rest);
        }

        /// <summary>
        /// Pick + time the clip for the fighter's current state. Returns false when no clip covers the
        /// state (the procedural retarget then poses the model this frame).
        /// </summary>
        public bool Drive(FighterController f, float dt, bool selectScreen)
        {
            if (!HasClips || f == null)
            {
                if (_animator != null && _animator.enabled) _animator.enabled = false;
                return false;
            }
            // local velocity for locomotion clips
            var pos = f.transform.position;
            var vel = _hasLastPos && dt > 0 ? (pos - _lastPos) / dt : Vector3.zero;
            _lastPos = pos;
            _hasLastPos = true;
            var local = Quaternion.Inverse(f.transform.rotation) * vel;

            int idx = -1;
            float t01 = -1f;      // < 0 = free-running clip
            float fade = 0.15f;
            switch (f.State)
            {
                case FighterState.Intro:
                    idx = selectScreen ? Find("select_idle") : Find("intro", "idle");
                    break;
                case FighterState.Idle:
                    idx = Find("idle");
                    break;
                case FighterState.Walk:
                    if (Mathf.Abs(local.x) > Mathf.Abs(local.z) * 1.2f) idx = Find(local.x > 0 ? "strafe_right" : "strafe_left", "walk_forward");
                    else idx = Find(local.z >= 0 ? "walk_forward" : "walk_backward", "walk_forward");
                    break;
                case FighterState.Guard:
                case FighterState.GuardStun:
                    idx = Find("guard", "idle");
                    break;
                case FighterState.Dodge:
                    idx = Find("dodge");
                    t01 = Mathf.Clamp01(f.StateFrame / 20f);
                    fade = 0.06f;
                    break;
                case FighterState.Attack:
                {
                    var m = f.CurrentMove;
                    if (m == null) break;
                    idx = Find(m.Id, m.Pose.ToString(), m.Kind == MoveKind.Grab ? "grab" : null);
                    t01 = AttackPhase(f, m);
                    fade = 0.05f;
                    break;
                }
                case FighterState.Hit:
                    idx = f.Stun > 22 ? Find("hit_heavy", "hit") : Find("hit", "hit_heavy");
                    t01 = Mathf.Clamp01(f.StateFrame / (float)Mathf.Max(1, f.StateFrame + f.Stun));
                    fade = 0.04f;
                    break;
                case FighterState.Air:
                    idx = Find("knockdown");
                    t01 = Mathf.Clamp01(f.StateFrame / 50f) * 0.5f;
                    fade = 0.06f;
                    break;
                case FighterState.Knockdown:
                case FighterState.KO:
                    idx = Find("knockdown");
                    t01 = Mathf.Clamp01(f.StateFrame / 45f);
                    fade = 0.06f;
                    break;
                case FighterState.GetUp:
                    idx = Find("getup");
                    t01 = Mathf.Clamp01(f.StateFrame / 20f);
                    fade = 0.05f;
                    break;
                case FighterState.Grabbed:
                    idx = Find("grabbed", "hit");
                    t01 = 0.3f;
                    break;
                case FighterState.Throwing:
                    idx = Find("throw");
                    t01 = Mathf.Clamp01(f.StateFrame / 22f);
                    fade = 0.05f;
                    break;
                case FighterState.Victory:
                    idx = Find("victory");
                    break;
                case FighterState.Lose:
                    idx = Find("defeat");
                    break;
            }
            if (idx < 0)
            {
                if (_animator.enabled) _animator.enabled = false; // procedural retarget for this state
                _active = -1;
                return false;
            }

            bool wasEnabled = _animator.enabled;
            if (!wasEnabled) _animator.enabled = true;
            var play = _plays[idx];
            var clip = _clips[idx];
            if (idx != _active)
            {
                if (t01 < 0) play.SetTime(0);
                _active = idx;
            }
            if (t01 >= 0)
            {
                play.SetSpeed(0);
                play.SetTime(t01 * clip.length);
            }
            else
            {
                play.SetSpeed(1);
                if (!clip.isLooping && play.GetTime() >= clip.length) { play.SetTime(clip.length - 0.01f); play.SetSpeed(0); }
            }

            // crossfade
            float total = 0;
            for (int i = 0; i < _weights.Length; i++)
            {
                _weights[i] = Mathf.MoveTowards(_weights[i], i == idx ? 1f : 0f, dt / Mathf.Max(0.01f, fade));
                total += _weights[i];
            }
            for (int i = 0; i < _weights.Length; i++) _mixer.SetInputWeight(i, total > 0 ? _weights[i] / total : (i == idx ? 1f : 0f));
            // the animator evaluates before LateUpdate: on the frame it switches on, keep the retarget pose
            return wasEnabled;
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
