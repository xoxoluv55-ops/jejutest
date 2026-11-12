using System.Collections.Generic;
using UnityEngine;

namespace MuscleBattle
{
    /// <summary>
    /// Procedural stylized fighter body + pose animation.
    ///
    /// This is the vertical-slice stand-in for a production Humanoid model: proportions, outfit
    /// colours, energy rim light and the muscle hologram overlays come from FighterDefinition,
    /// and the pose system is keyed on combat state / frame data so attacks read clearly.
    /// Combat never touches this class's bones - swapping to an Animator-driven Humanoid only
    /// requires another implementation of the same public surface.
    /// </summary>
    public sealed class FighterRig : MonoBehaviour
    {
        public enum J { Hips, Spine, Chest, Neck, Head, ShoulderL, ElbowL, HandL, ShoulderR, ElbowR, HandR, ThighL, KneeL, FootL, ThighR, KneeR, FootR }
        const int JointCount = 17;

        public FighterDefinition Def { get; private set; }
        public FighterController Fighter { get; private set; }
        public Transform HeadBone => _bones[(int)J.Head];
        public Transform ChestBone => _bones[(int)J.Chest];

        readonly Transform[] _bones = new Transform[JointCount];
        readonly Quaternion[] _current = new Quaternion[JointCount];
        float _hipY;
        Transform _visual;          // PrototypeVisual: primitive body + the pose-driver skeleton
        Transform _visualRoot;      // VisualRoot: production Humanoid model lives here
        HumanoidVisual _humanoid;
        public bool HasHumanoid => _humanoid != null;
        readonly List<Renderer> _bodyRenderers = new List<Renderer>();
        readonly Dictionary<MuscleGroup, List<Renderer>> _muscles = new Dictionary<MuscleGroup, List<Renderer>>();
        readonly List<Material> _muscleMats = new List<Material>();
        MaterialPropertyBlock _mpb;
        TrailRenderer[] _trails; // hands L/R, feet L/R
        Material _trailNormal, _trailFiber;
        Gradient _gradNormal, _gradFiber;
        int _trailStyle = -1;
        float _recoil;
        bool _stagger;
        float _flash;
        Color _flashColor = Color.white;
        MuscleGroup _glowMask;
        float _glowTime, _glowDuration;
        Color _glowColor;
        float _animTime;
        MoveData _move;

        // character select animation (§4, §19, §20)
        enum SelAction { None, ShoulderRoll, NeckStretch, Stretch, GloveAdjust, HandCrack, Guard, FistPound, Hop }
        bool _selectMode, _selectLocked;
        float _selLockPose;                 // > 0 while the lock-in pose is held
        SelAction _selAction, _selLast;
        float _selT, _selDur, _selNext;

        // ------------------------------------------------------------------
        // Build
        // ------------------------------------------------------------------
        public static FighterRig Build(Transform parent, FighterDefinition def, FighterController fighter)
        {
            var go = new GameObject("Rig_" + def.Id);
            go.transform.SetParent(parent, false);
            var rig = go.AddComponent<FighterRig>();
            rig.Def = def;
            rig.Fighter = fighter;
            rig.Construct();
            return rig;
        }

        void Construct()
        {
            _mpb = new MaterialPropertyBlock();
            _visual = new GameObject("PrototypeVisual").transform;
            _visual.SetParent(transform, false);
            _visual.localScale = Vector3.one * Def.Height;
            _visualRoot = new GameObject("VisualRoot").transform;
            _visualRoot.SetParent(transform, false);

            float b = Def.Bulk;
            var rim = Def.Energy.WithAlpha(0.85f);
            var skin = MBAssets.ToonMaterial(Def.Skin, rim, 2.6f, 0.35f);
            var top = MBAssets.ToonMaterial(Def.Top, rim, 3f, 0.2f);
            var accent = MBAssets.ToonMaterial(Def.TopAccent, rim, 3f, 0.3f, Def.TopAccent * 0.15f);
            var pants = MBAssets.ToonMaterial(Def.Pants, rim, 3f, 0.15f);
            var pantsAccent = MBAssets.ToonMaterial(Def.PantsAccent, rim, 3f, 0.3f, Def.PantsAccent * 0.15f);
            var hair = MBAssets.ToonMaterial(Def.Hair, rim, 2f, 0.6f);
            var shoes = MBAssets.ToonMaterial(Def.Shoes, rim, 3f, 0.5f);
            var sole = MBAssets.ToonMaterial(new Color(0.92f, 0.92f, 0.95f), rim, 3f, 0.2f);
            var gloves = MBAssets.ToonMaterial(Def.Gloves, rim, 3f, 0.6f);
            var dark = MBAssets.ToonMaterial(new Color(0.05f, 0.05f, 0.07f), rim, 4f, 0.8f);

            // skeleton
            var hips = Bone(J.Hips, _visual, new Vector3(0, 0.98f, 0));
            var spine = Bone(J.Spine, hips, new Vector3(0, 0.1f, 0));
            var chest = Bone(J.Chest, spine, new Vector3(0, 0.24f, 0));
            var neck = Bone(J.Neck, chest, new Vector3(0, 0.24f, 0));
            var head = Bone(J.Head, neck, new Vector3(0, 0.1f, 0));
            float sx = 0.2f + 0.04f * (b - 1);
            var shL = Bone(J.ShoulderL, chest, new Vector3(-sx, 0.17f, 0));
            var elL = Bone(J.ElbowL, shL, new Vector3(0, -0.29f, 0));
            var haL = Bone(J.HandL, elL, new Vector3(0, -0.27f, 0));
            var shR = Bone(J.ShoulderR, chest, new Vector3(sx, 0.17f, 0));
            var elR = Bone(J.ElbowR, shR, new Vector3(0, -0.29f, 0));
            var haR = Bone(J.HandR, elR, new Vector3(0, -0.27f, 0));
            var thL = Bone(J.ThighL, hips, new Vector3(-0.11f, -0.04f, 0));
            var knL = Bone(J.KneeL, thL, new Vector3(0, -0.45f, 0));
            var ftL = Bone(J.FootL, knL, new Vector3(0, -0.45f, 0));
            var thR = Bone(J.ThighR, hips, new Vector3(0.11f, -0.04f, 0));
            var knR = Bone(J.KneeR, thR, new Vector3(0, -0.45f, 0));
            var ftR = Bone(J.FootR, knR, new Vector3(0, -0.45f, 0));

            // torso
            Part(PrimitiveType.Sphere, hips, new Vector3(0, 0, 0), new Vector3(0.36f * Mathf.Lerp(1, b, 0.4f), 0.24f, 0.25f), pants);
            Part(PrimitiveType.Cylinder, hips, new Vector3(0, 0.07f, 0), new Vector3(0.36f * Mathf.Lerp(1, b, 0.4f), 0.025f, 0.26f), pantsAccent); // belt
            Part(PrimitiveType.Capsule, spine, new Vector3(0, 0.08f, 0), new Vector3(0.31f * Mathf.Lerp(1, b, 0.5f), 0.2f, 0.21f * Mathf.Lerp(1, b, 0.3f)), Def.SleevelessTop ? top : top);
            Part(PrimitiveType.Sphere, chest, new Vector3(0, 0.06f, 0), new Vector3(0.44f * b, 0.32f, 0.27f * Mathf.Lerp(1, b, 0.6f)), top);
            // jacket / tank details
            Part(PrimitiveType.Cube, chest, new Vector3(0, 0.0f, 0.13f * Mathf.Lerp(1, b, 0.6f)), new Vector3(0.025f, 0.3f, 0.02f), accent); // zip / centre stripe
            Part(PrimitiveType.Cube, chest, new Vector3(-0.17f * b, 0.02f, 0.1f), new Vector3(0.02f, 0.28f, 0.06f), accent).localRotation = Quaternion.Euler(0, 0, 8);
            Part(PrimitiveType.Cube, chest, new Vector3(0.17f * b, 0.02f, 0.1f), new Vector3(0.02f, 0.28f, 0.06f), accent).localRotation = Quaternion.Euler(0, 0, -8);
            if (!Def.SleevelessTop) Part(PrimitiveType.Cylinder, chest, new Vector3(0, 0.2f, 0), new Vector3(0.2f, 0.035f, 0.17f), top); // collar
            if (!string.IsNullOrEmpty(Def.ChestMark)) ChestText(chest, Def.ChestMark, new Vector3(-0.09f * b, 0.08f, 0.135f * Mathf.Lerp(1, b, 0.6f) + 0.005f));

            // neck & head
            Part(PrimitiveType.Capsule, neck, new Vector3(0, 0.03f, 0), new Vector3(0.11f * Mathf.Lerp(1, b, 0.6f), 0.08f, 0.11f * Mathf.Lerp(1, b, 0.6f)), skin);
            Part(PrimitiveType.Sphere, head, new Vector3(0, 0.1f, 0.0f), new Vector3(0.2f, 0.245f, 0.225f), skin);
            Part(PrimitiveType.Sphere, head, new Vector3(0, 0.02f, 0.03f), new Vector3(0.16f, 0.12f, 0.17f), skin); // jaw
            // eyes / brows (stylized, read well at fighting-game camera distance)
            Part(PrimitiveType.Cube, head, new Vector3(-0.05f, 0.11f, 0.105f), new Vector3(0.05f, 0.014f, 0.01f), dark).localRotation = Quaternion.Euler(0, 0, -8);
            Part(PrimitiveType.Cube, head, new Vector3(0.05f, 0.11f, 0.105f), new Vector3(0.05f, 0.014f, 0.01f), dark).localRotation = Quaternion.Euler(0, 0, 8);
            Part(PrimitiveType.Cube, head, new Vector3(-0.05f, 0.135f, 0.103f), new Vector3(0.055f, 0.012f, 0.012f), hair).localRotation = Quaternion.Euler(0, 0, -14);
            Part(PrimitiveType.Cube, head, new Vector3(0.05f, 0.135f, 0.103f), new Vector3(0.055f, 0.012f, 0.012f), hair).localRotation = Quaternion.Euler(0, 0, 14);
            BuildHair(head, hair);

            // arms
            BuildArm(shL, elL, haL, b, skin, top, gloves, accent, true);
            BuildArm(shR, elR, haR, b, skin, top, gloves, accent, false);

            // legs (baggy cargo pants with accent stripes + sneakers)
            foreach (var (th, kn, ft, side) in new[] { (thL, knL, ftL, -1f), (thR, knR, ftR, 1f) })
            {
                float lb = Mathf.Lerp(1, b, 0.5f);
                Part(PrimitiveType.Capsule, th, new Vector3(0, -0.22f, 0), new Vector3(0.17f * lb, 0.26f, 0.18f * lb), pants);
                Part(PrimitiveType.Cube, th, new Vector3(0.085f * side * lb, -0.22f, 0), new Vector3(0.012f, 0.4f, 0.05f), pantsAccent);
                Part(PrimitiveType.Cube, th, new Vector3(0.09f * side * lb, -0.28f, 0.0f), new Vector3(0.03f, 0.1f, 0.09f), pants); // cargo pocket
                Part(PrimitiveType.Capsule, kn, new Vector3(0, -0.22f, 0), new Vector3(0.15f * lb, 0.25f, 0.15f * lb), pants);
                Part(PrimitiveType.Cube, kn, new Vector3(0.075f * side * lb, -0.2f, 0), new Vector3(0.012f, 0.36f, 0.04f), pantsAccent);
                Part(PrimitiveType.Cylinder, kn, new Vector3(0, -0.42f, 0), new Vector3(0.13f, 0.03f, 0.13f), pantsAccent); // ankle cuff
                Part(PrimitiveType.Sphere, ft, new Vector3(0, -0.02f, 0.06f), new Vector3(0.12f, 0.1f, 0.27f), shoes);
                Part(PrimitiveType.Cube, ft, new Vector3(0, -0.065f, 0.06f), new Vector3(0.12f, 0.03f, 0.27f), sole);
                Part(PrimitiveType.Cube, ft, new Vector3(0, 0.0f, 0.1f), new Vector3(0.125f, 0.02f, 0.06f), accent); // shoe stripe
            }

            BuildMuscleOverlays(hips, spine, chest, neck, shL, elL, shR, elR, thL, knL, thR, knR, b);
            BuildTrails(haL, haR, ftL, ftR);

            for (int i = 0; i < JointCount; i++) _current[i] = Quaternion.identity;
            _hipY = 0;

            AttachHumanoid();
        }

        /// <summary>
        /// Swap the visual to a production Humanoid model if one exists for this fighter
        /// (Resources/Characters/{id}). Game logic is untouched: the primitive skeleton keeps driving poses.
        /// </summary>
        void AttachHumanoid()
        {
            _humanoid = HumanoidVisual.TryCreate(_visualRoot, transform, Def, _bones);
            if (_humanoid == null) return;

            ApplyTPose();
            _humanoid.Calibrate();

            // move muscle holograms + trails onto the model's bones, re-centred on the model's joints
            foreach (var list in _muscles.Values)
                foreach (var r in list) Rehome(r.transform);
            foreach (var t in _trails) Rehome(t.transform);

            foreach (var r in _visual.GetComponentsInChildren<Renderer>(true)) r.enabled = false; // hide PrototypeVisual
            for (int i = 0; i < JointCount; i++) _bones[i].localRotation = _current[i] = Quaternion.identity;
            _bones[(int)J.Hips].localPosition = new Vector3(0, 0.98f, 0);
        }

        void Rehome(Transform t)
        {
            int idx = System.Array.IndexOf(_bones, t.parent);
            var target = _humanoid.Bone(idx);
            if (target == null) return;
            t.position += target.position - t.parent.position;
            t.SetParent(target, true);
        }

        /// <summary>Driver skeleton in T-pose (arms out, palms down) for retarget calibration.</summary>
        void ApplyTPose()
        {
            for (int i = 0; i < JointCount; i++) _bones[i].localRotation = Quaternion.identity;
            _bones[(int)J.ShoulderL].localRotation = Quaternion.Euler(0, 0, -90);
            _bones[(int)J.ShoulderR].localRotation = Quaternion.Euler(0, 0, 90);
            _bones[(int)J.Hips].localPosition = new Vector3(0, 0.98f, 0);
        }

        Transform Bone(J j, Transform parent, Vector3 localPos)
        {
            var t = new GameObject(j.ToString()).transform;
            t.SetParent(parent, false);
            t.localPosition = localPos;
            _bones[(int)j] = t;
            return t;
        }

        Transform Part(PrimitiveType type, Transform parent, Vector3 pos, Vector3 scale, Material mat)
        {
            var go = GameObject.CreatePrimitive(type);
            Destroy(go.GetComponent<Collider>());
            go.transform.SetParent(parent, false);
            go.transform.localPosition = pos;
            go.transform.localScale = scale;
            var r = go.GetComponent<Renderer>();
            r.sharedMaterial = mat;
            r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.On;
            r.receiveShadows = true;
            _bodyRenderers.Add(r);
            return go.transform;
        }

        void BuildArm(Transform sh, Transform el, Transform ha, float b, Material skin, Material top, Material gloves, Material accent, bool left)
        {
            var upper = Def.SleevelessTop ? skin : top;
            Part(PrimitiveType.Sphere, sh, new Vector3(0, -0.02f, 0), Vector3.one * 0.16f * b, upper); // deltoid cap
            Part(PrimitiveType.Capsule, sh, new Vector3(0, -0.15f, 0), new Vector3(0.115f * b, 0.17f, 0.12f * b), Def.SleevelessTop ? skin : top);
            if (!Def.SleevelessTop)
            {
                Part(PrimitiveType.Capsule, sh, new Vector3(0, -0.24f, 0), new Vector3(0.1f * b, 0.06f, 0.1f * b), skin); // biceps peeking out of sleeve
                Part(PrimitiveType.Cylinder, sh, new Vector3(0, -0.2f, 0), new Vector3(0.13f * b, 0.02f, 0.13f * b), accent); // sleeve cuff
            }
            Part(PrimitiveType.Capsule, el, new Vector3(0, -0.13f, 0), new Vector3(0.1f * b, 0.16f, 0.1f * b), skin);
            Part(PrimitiveType.Cylinder, el, new Vector3(0, -0.22f, 0), new Vector3(0.095f * b, 0.03f, 0.095f * b), accent); // wrist wrap
            var fist = Part(PrimitiveType.Sphere, ha, new Vector3(0, -0.03f, 0.0f), new Vector3(0.12f, 0.12f, 0.13f) * Mathf.Lerp(1, b, 0.4f), gloves);
            fist.name = left ? "FistL" : "FistR";
        }

        void BuildHair(Transform head, Material hair)
        {
            switch (Def.HairStyle)
            {
                case HairStyle.ShortSpiky:
                    Part(PrimitiveType.Sphere, head, new Vector3(0, 0.15f, -0.015f), new Vector3(0.215f, 0.2f, 0.235f), hair);
                    for (int i = 0; i < 9; i++)
                    {
                        float a = (i / 8f - 0.5f) * 2.4f;
                        var s = Part(PrimitiveType.Capsule, head, new Vector3(Mathf.Sin(a) * 0.08f, 0.24f, -0.03f + Mathf.Cos(a) * 0.04f), new Vector3(0.05f, 0.08f, 0.05f), hair);
                        s.localRotation = Quaternion.Euler(-35 + (i % 3) * 15, 0, -a * 30f);
                    }
                    // fringe
                    for (int i = 0; i < 4; i++)
                    {
                        var f = Part(PrimitiveType.Capsule, head, new Vector3(-0.06f + i * 0.04f, 0.19f, 0.09f), new Vector3(0.035f, 0.06f, 0.03f), hair);
                        f.localRotation = Quaternion.Euler(35, 0, -15 + i * 10);
                    }
                    break;
                case HairStyle.SlickBack:
                    Part(PrimitiveType.Sphere, head, new Vector3(0, 0.16f, -0.03f), new Vector3(0.215f, 0.18f, 0.25f), hair);
                    Part(PrimitiveType.Capsule, head, new Vector3(0, 0.22f, -0.04f), new Vector3(0.12f, 0.1f, 0.2f), hair).localRotation = Quaternion.Euler(80, 0, 0);
                    break;
                case HairStyle.Ponytail:
                case HairStyle.Braids:
                    Part(PrimitiveType.Sphere, head, new Vector3(0, 0.15f, -0.02f), new Vector3(0.22f, 0.21f, 0.24f), hair);
                    Part(PrimitiveType.Capsule, head, new Vector3(0, 0.1f, -0.2f), new Vector3(0.07f, 0.16f, 0.07f), hair).localRotation = Quaternion.Euler(-30, 0, 0);
                    break;
                default:
                    Part(PrimitiveType.Sphere, head, new Vector3(0, 0.14f, -0.01f), new Vector3(0.205f, 0.2f, 0.23f), hair);
                    break;
            }
        }

        void ChestText(Transform chest, string text, Vector3 pos)
        {
            var go = new GameObject("ChestMark");
            go.transform.SetParent(chest, false);
            go.transform.localPosition = pos;
            go.transform.localRotation = Quaternion.Euler(0, 180, 0); // TextMesh faces -Z; turn it to face out of the chest
            var tm = go.AddComponent<TextMesh>();
            tm.font = MBAssets.FontHeavy;
            tm.text = text;
            tm.fontSize = 64;
            tm.characterSize = 0.012f;
            tm.anchor = TextAnchor.MiddleCenter;
            tm.color = Def.TopAccent;
            var mr = go.GetComponent<MeshRenderer>();
            mr.sharedMaterial = MBAssets.Text3D(tm.font);
        }

        // ------------------------------------------------------------------
        // Muscle hologram overlays (§12, §13)
        // ------------------------------------------------------------------
        void BuildMuscleOverlays(Transform hips, Transform spine, Transform chest, Transform neck, Transform shL, Transform elL, Transform shR, Transform elR,
            Transform thL, Transform knL, Transform thR, Transform knR, float b)
        {
            float cz = 0.135f * Mathf.Lerp(1, b, 0.6f);
            Overlay(MuscleGroup.Deltoid, shL, new Vector3(0, -0.03f, 0), Vector3.one * 0.19f * b);
            Overlay(MuscleGroup.Deltoid, shR, new Vector3(0, -0.03f, 0), Vector3.one * 0.19f * b);
            Overlay(MuscleGroup.Supraspinatus, chest, new Vector3(-0.12f * b, 0.17f, -0.06f), new Vector3(0.14f, 0.05f, 0.06f));
            Overlay(MuscleGroup.Supraspinatus, chest, new Vector3(0.12f * b, 0.17f, -0.06f), new Vector3(0.14f, 0.05f, 0.06f));
            Overlay(MuscleGroup.Pectoralis, chest, new Vector3(-0.09f * b, 0.06f, cz - 0.04f), new Vector3(0.17f * b, 0.13f, 0.08f));
            Overlay(MuscleGroup.Pectoralis, chest, new Vector3(0.09f * b, 0.06f, cz - 0.04f), new Vector3(0.17f * b, 0.13f, 0.08f));
            Overlay(MuscleGroup.Trapezius, chest, new Vector3(0, 0.2f, -0.05f), new Vector3(0.3f * b, 0.1f, 0.12f));
            Overlay(MuscleGroup.Trapezius, chest, new Vector3(0, 0.02f, -0.11f), new Vector3(0.2f * b, 0.22f, 0.06f));
            Overlay(MuscleGroup.Latissimus, chest, new Vector3(-0.15f * b, -0.07f, -0.05f), new Vector3(0.1f, 0.24f, 0.16f));
            Overlay(MuscleGroup.Latissimus, chest, new Vector3(0.15f * b, -0.07f, -0.05f), new Vector3(0.1f, 0.24f, 0.16f));
            Overlay(MuscleGroup.SerratusAnterior, chest, new Vector3(-0.17f * b, -0.03f, 0.05f), new Vector3(0.06f, 0.16f, 0.1f));
            Overlay(MuscleGroup.SerratusAnterior, chest, new Vector3(0.17f * b, -0.03f, 0.05f), new Vector3(0.06f, 0.16f, 0.1f));
            Overlay(MuscleGroup.Core, spine, new Vector3(0, 0.08f, 0.06f), new Vector3(0.24f * b, 0.3f, 0.14f));
            Overlay(MuscleGroup.Biceps, shL, new Vector3(0, -0.16f, 0.04f), new Vector3(0.1f * b, 0.2f, 0.09f * b));
            Overlay(MuscleGroup.Biceps, shR, new Vector3(0, -0.16f, 0.04f), new Vector3(0.1f * b, 0.2f, 0.09f * b));
            Overlay(MuscleGroup.Triceps, shL, new Vector3(0, -0.15f, -0.04f), new Vector3(0.1f * b, 0.22f, 0.09f * b));
            Overlay(MuscleGroup.Triceps, shR, new Vector3(0, -0.15f, -0.04f), new Vector3(0.1f * b, 0.22f, 0.09f * b));
            Overlay(MuscleGroup.Gluteus, hips, new Vector3(-0.08f, -0.03f, -0.08f), new Vector3(0.17f, 0.18f, 0.14f));
            Overlay(MuscleGroup.Gluteus, hips, new Vector3(0.08f, -0.03f, -0.08f), new Vector3(0.17f, 0.18f, 0.14f));
            Overlay(MuscleGroup.Quadriceps, thL, new Vector3(0, -0.2f, 0.04f), new Vector3(0.15f, 0.36f, 0.13f));
            Overlay(MuscleGroup.Quadriceps, thR, new Vector3(0, -0.2f, 0.04f), new Vector3(0.15f, 0.36f, 0.13f));
            Overlay(MuscleGroup.Hamstrings, thL, new Vector3(0, -0.22f, -0.05f), new Vector3(0.14f, 0.34f, 0.11f));
            Overlay(MuscleGroup.Hamstrings, thR, new Vector3(0, -0.22f, -0.05f), new Vector3(0.14f, 0.34f, 0.11f));
            Overlay(MuscleGroup.Gastrocnemius, knL, new Vector3(0, -0.14f, -0.04f), new Vector3(0.12f, 0.2f, 0.1f));
            Overlay(MuscleGroup.Gastrocnemius, knR, new Vector3(0, -0.14f, -0.04f), new Vector3(0.12f, 0.2f, 0.1f));
        }

        void Overlay(MuscleGroup group, Transform parent, Vector3 pos, Vector3 scale)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            Destroy(go.GetComponent<Collider>());
            go.name = "Muscle_" + group;
            go.transform.SetParent(parent, false);
            go.transform.localPosition = pos;
            go.transform.localScale = scale * 1.08f;
            var r = go.GetComponent<Renderer>();
            var mat = MBAssets.HologramMaterial(Palette.Muscle, 0f, ProceduralTextures.Fiber, 90f);
            mat.mainTextureScale = new Vector2(2, 1);
            r.sharedMaterial = mat;
            r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            r.receiveShadows = false;
            r.enabled = false;
            _muscleMats.Add(mat);
            if (!_muscles.TryGetValue(group, out var list)) _muscles[group] = list = new List<Renderer>();
            list.Add(r);
        }

        void BuildTrails(Transform haL, Transform haR, Transform ftL, Transform ftR)
        {
            var q = QualityProfile.Current;
            _trails = new TrailRenderer[4];
            var targets = new[] { haL, haR, ftL, ftR };
            _trailNormal = MBAssets.AdditiveMaterial(ProceduralTextures.Streak, Color.white, 2f);
            _trailFiber = MBAssets.AdditiveMaterial(ProceduralTextures.Fiber, Color.white, 2.4f);
            _trailFiber.mainTextureScale = new Vector2(4, 1);
            _gradNormal = new Gradient();
            _gradNormal.SetKeys(new[] { new GradientColorKey(Color.white, 0), new GradientColorKey(Def.Energy, 0.3f), new GradientColorKey(Def.EnergyAlt, 1) },
                new[] { new GradientAlphaKey(0.9f, 0), new GradientAlphaKey(0.5f, 0.5f), new GradientAlphaKey(0, 1) });
            // MUSCLE LINK trail: red/orange muscle-fibre energy (§13)
            _gradFiber = new Gradient();
            _gradFiber.SetKeys(new[] { new GradientColorKey(Palette.MuscleHot, 0), new GradientColorKey(Palette.Muscle, 0.5f), new GradientColorKey(new Color(0.5f, 0.05f, 0.05f), 1) },
                new[] { new GradientAlphaKey(1f, 0), new GradientAlphaKey(0.7f, 0.5f), new GradientAlphaKey(0, 1) });
            for (int i = 0; i < 4; i++)
            {
                var go = new GameObject("Trail" + i);
                go.transform.SetParent(targets[i], false);
                go.transform.localPosition = i < 2 ? new Vector3(0, -0.04f, 0) : new Vector3(0, -0.02f, 0.12f);
                var tr = go.AddComponent<TrailRenderer>();
                tr.time = q != null ? q.TrailTime : 0.2f;
                tr.minVertexDistance = 0.03f;
                tr.widthMultiplier = i < 2 ? 0.2f : 0.26f;
                tr.widthCurve = new AnimationCurve(new Keyframe(0, 1), new Keyframe(1, 0));
                tr.material = _trailNormal;
                tr.colorGradient = _gradNormal;
                tr.textureMode = LineTextureMode.Tile;
                tr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                tr.emitting = false;
                _trails[i] = tr;
            }
        }

        // ------------------------------------------------------------------
        // Public API used by combat / VFX
        // ------------------------------------------------------------------
        public void PlayMove(MoveData m)
        {
            _move = m;
        }

        /// <summary>Body recoil on hit: head snaps back, torso bends away; heavy hits stagger the legs.</summary>
        public void Recoil(ImpactTier tier, bool counter)
        {
            _recoil = tier switch { ImpactTier.Light => 0.45f, ImpactTier.Medium => 0.7f, _ => 1f } * (counter ? 1.2f : 1f);
            _stagger = tier >= ImpactTier.Heavy || counter;
        }

        public void Flash(Color c, float seconds)
        {
            _flashColor = c;
            _flash = Mathf.Max(_flash, seconds);
        }

        /// <summary>Light up muscle groups as anatomy holograms on the body.</summary>
        public void GlowMuscles(MuscleGroup mask, float seconds, Color color)
        {
            _glowMask = mask;
            _glowDuration = Mathf.Max(0.01f, seconds);
            _glowTime = seconds;
            _glowColor = color;
            foreach (var kv in _muscles)
            {
                bool on = (mask & kv.Key) != 0 && seconds > 0;
                foreach (var r in kv.Value) r.enabled = on;
            }
            foreach (var m in _muscleMats) m.SetColor("_Color", color);
        }

        // ------------------------------------------------------------------
        // Character select (§4 hover / lock-in, §19 idle variations, §20 personality)
        // ------------------------------------------------------------------
        /// <summary>While true and the fighter is in the Intro state, the rig plays the character select idle set.</summary>
        public bool SelectMode
        {
            get => _selectMode;
            set
            {
                _selectMode = value;
                _selectLocked = false;
                _selLockPose = 0;
                _selAction = SelAction.None;
                _selNext = Random.Range(1.5f, 3f);
            }
        }

        /// <summary>Cursor landed on this fighter: short signature move (Jin: bouncy guard, Ray: fist pound).</summary>
        public void SelectHover()
        {
            StartSelAction(Def.Personality switch
            {
                SelectPersonality.Power => SelAction.FistPound,
                SelectPersonality.Flexible => SelAction.Stretch,
                SelectPersonality.Calm => SelAction.NeckStretch,
                _ => SelAction.Hop,
            });
        }

        /// <summary>Strong lock-in pose for <paramref name="seconds"/>, then a ready-to-fight guard idle.</summary>
        public void SelectLockIn(float seconds)
        {
            _selectLocked = true;
            _selLockPose = seconds;
            _selAction = SelAction.None;
            _selNext = seconds + Random.Range(1.5f, 3f);
        }

        public void SelectUnlock()
        {
            _selectLocked = false;
            _selLockPose = 0;
            _selAction = SelAction.None;
            _selNext = Random.Range(1f, 2f);
        }

        void StartSelAction(SelAction a)
        {
            _selAction = a;
            _selLast = a;
            _selT = 0;
            _selDur = a switch
            {
                SelAction.Hop => 0.9f,
                SelAction.ShoulderRoll => 1.5f,
                SelAction.NeckStretch => 1.9f,
                SelAction.Stretch => 2.1f,
                SelAction.GloveAdjust => 1.7f,
                SelAction.HandCrack => 1.5f,
                SelAction.FistPound => 1.5f,
                SelAction.Guard => 1.8f,
                _ => 1f,
            };
        }

        void UpdateSelectTimers(float dt)
        {
            if (_selLockPose > 0) _selLockPose -= dt;
            if (_selAction != SelAction.None)
            {
                _selT += dt;
                if (_selT >= _selDur)
                {
                    _selAction = SelAction.None;
                    _selNext = Random.Range(2.6f, 5.2f); // not too often (§19)
                }
                return;
            }
            if (_selLockPose > 0) return;
            _selNext -= dt;
            if (_selNext > 0) return;
            // random variation, never the same one twice in a row
            var set = _selectLocked
                ? new[] { SelAction.Guard, SelAction.ShoulderRoll, SelAction.HandCrack }
                : Def.Personality switch
                {
                    SelectPersonality.Power => new[] { SelAction.FistPound, SelAction.NeckStretch, SelAction.HandCrack, SelAction.ShoulderRoll },
                    SelectPersonality.Calm => new[] { SelAction.NeckStretch, SelAction.ShoulderRoll },
                    SelectPersonality.Flexible => new[] { SelAction.Stretch, SelAction.NeckStretch, SelAction.ShoulderRoll },
                    _ => new[] { SelAction.ShoulderRoll, SelAction.NeckStretch, SelAction.GloveAdjust, SelAction.HandCrack, SelAction.Guard, SelAction.Stretch },
                };
            var pick = set[Random.Range(0, set.Length)];
            if (pick == _selLast && set.Length > 1) pick = set[(System.Array.IndexOf(set, pick) + 1) % set.Length];
            StartSelAction(pick);
        }

        /// <summary>Base personality idle, then the current variation blended on top.</summary>
        void SelectPose(Quaternion[] p, out float hipY, out float sharpness)
        {
            float t = _animTime;
            float breathe = Mathf.Sin(t * 2.4f);
            sharpness = 9f;

            if (_selLockPose > 0)
            {
                VictoryPose(p, breathe);
                hipY = 0f;
                sharpness = 11f;
                return;
            }

            // ---- base idle ----
            if (_selectLocked)
            {
                // locked in: tight guard, light bounce - ready to fight
                GuardBase(p, breathe);
                hipY = -0.11f + Mathf.Abs(Mathf.Sin(t * 4.2f)) * 0.025f;
            }
            else switch (Def.Personality)
            {
                case SelectPersonality.Power:
                    ArmsCrossed(p, breathe);
                    hipY = -0.01f + breathe * 0.006f;
                    break;
                case SelectPersonality.Calm:
                    Stance(p, breathe * 0.5f, false);
                    Set(p, J.ShoulderL, -32, 12, -8);
                    Set(p, J.ElbowL, -82, 0, 0);
                    Set(p, J.ShoulderR, -26, -12, 8);
                    Set(p, J.ElbowR, -78, 0, 0);
                    Set(p, J.Head, -2, -4, 0);
                    hipY = -0.04f + breathe * 0.004f;
                    break;
                case SelectPersonality.Flexible:
                    Stance(p, breathe, false);
                    p[(int)J.Spine] = p[(int)J.Spine] * Quaternion.Euler(0, 0, Mathf.Sin(t * 1.3f) * 4f);
                    hipY = -0.06f + breathe * 0.008f;
                    break;
                default:
                    // confident: on the balls of the feet, light bounce + shoulder sway
                    Stance(p, breathe, Def.Bulk > 1.2f);
                    p[(int)J.Chest] = p[(int)J.Chest] * Quaternion.Euler(0, Mathf.Sin(t * 2.3f) * 5f, Mathf.Sin(t * 4.6f) * 2f);
                    p[(int)J.Head] = p[(int)J.Head] * Quaternion.Euler(Mathf.Sin(t * 4.6f) * 2f, 0, 0);
                    hipY = -0.08f + Mathf.Abs(Mathf.Sin(t * 4.6f)) * 0.03f;
                    break;
            }

            if (_selAction == SelAction.None) return;

            // ---- variation, blended in/out ----
            float k = Mathf.Clamp01(_selT / _selDur);
            float w = Mathf.SmoothStep(0, 1, Mathf.Clamp01(_selT / 0.22f)) * Mathf.SmoothStep(0, 1, Mathf.Clamp01((_selDur - _selT) / 0.3f));
            var a = PoseB;
            for (int i = 0; i < JointCount; i++) a[i] = p[i];
            float actHip = hipY;
            switch (_selAction)
            {
                case SelAction.Hop:
                    GuardBase(a, breathe);
                    actHip = -0.1f + Mathf.Abs(Mathf.Sin(_selT * 10f)) * 0.07f;
                    break;
                case SelAction.Guard:
                    GuardBase(a, breathe);
                    a[(int)J.Chest] = a[(int)J.Chest] * Quaternion.Euler(0, Mathf.Sin(_selT * 6f) * 8f, 0);
                    actHip = -0.12f + Mathf.Abs(Mathf.Sin(_selT * 6f)) * 0.03f;
                    break;
                case SelAction.ShoulderRoll:
                {
                    float ph = _selT * Mathf.PI * 2f * 1.3f;
                    a[(int)J.ShoulderL] = a[(int)J.ShoulderL] * Quaternion.Euler(Mathf.Sin(ph) * 22f, 0, Mathf.Cos(ph) * 10f);
                    a[(int)J.ShoulderR] = a[(int)J.ShoulderR] * Quaternion.Euler(Mathf.Sin(ph + Mathf.PI) * 22f, 0, -Mathf.Cos(ph + Mathf.PI) * 10f);
                    a[(int)J.Chest] = a[(int)J.Chest] * Quaternion.Euler(Mathf.Sin(ph * 2f) * 3f, 0, 0);
                    break;
                }
                case SelAction.NeckStretch:
                {
                    float tilt = Mathf.Sin(k * Mathf.PI * 2f) * 28f;
                    a[(int)J.Neck] = a[(int)J.Neck] * Quaternion.Euler(0, 0, tilt * 0.5f);
                    a[(int)J.Head] = a[(int)J.Head] * Quaternion.Euler(4, 0, tilt);
                    break;
                }
                case SelAction.Stretch:
                {
                    float lean = Mathf.Sin(k * Mathf.PI * 2f) * 12f;
                    Set(a, J.ShoulderL, -172, 0, -10);
                    Set(a, J.ElbowL, -28, 0, 0);
                    Set(a, J.ShoulderR, -172, 0, 10);
                    Set(a, J.ElbowR, -28, 0, 0);
                    Set(a, J.Spine, -4, 0, lean);
                    Set(a, J.Chest, -8, 0, lean * 0.5f);
                    Set(a, J.Head, -10, 0, 0);
                    Set(a, J.ThighL, 0, 0, -8);
                    Set(a, J.ThighR, 0, 0, 8);
                    Set(a, J.KneeL, 0, 0, 0);
                    Set(a, J.KneeR, 0, 0, 0);
                    Set(a, J.Hips, 0, 0, 0);
                    actHip = 0.01f;
                    break;
                }
                case SelAction.GloveAdjust:
                    Set(a, J.ShoulderL, -62, 32, -4);
                    Set(a, J.ElbowL, -118, 0, 0);
                    Set(a, J.ShoulderR, -52, -40, 6);
                    Set(a, J.ElbowR, -100 + Mathf.Sin(_selT * 18f) * 9f, 0, 0);
                    Set(a, J.Head, 18, 4, 0);
                    a[(int)J.Chest] = a[(int)J.Chest] * Quaternion.Euler(6, 0, 0);
                    break;
                case SelAction.HandCrack:
                {
                    float pulse = Mathf.Max(0, Mathf.Sin(_selT * 12f)) * 4f;
                    Set(a, J.ShoulderL, -72, 40, 0);
                    Set(a, J.ElbowL, -92, 0, 0);
                    Set(a, J.ShoulderR, -72, -40, 0);
                    Set(a, J.ElbowR, -92, 0, 0);
                    Set(a, J.Head, 12, 0, 0);
                    a[(int)J.Chest] = a[(int)J.Chest] * Quaternion.Euler(pulse, 0, 0);
                    break;
                }
                case SelAction.FistPound:
                {
                    float hit = Mathf.Abs(Mathf.Sin(_selT * 7f));
                    Set(a, J.ShoulderL, -60, 38, 0);
                    Set(a, J.ElbowL, -92, 0, 0);
                    Set(a, J.ShoulderR, -48 - 18 * hit, -32, 5);
                    Set(a, J.ElbowR, -112 + 26 * hit, 0, 0);
                    Set(a, J.Chest, 4 + hit * 3f, 0, 0);
                    Set(a, J.Head, 6, 0, 0);
                    actHip = -0.04f;
                    break;
                }
            }
            Lerp(p, a, w, p);
            hipY = Mathf.Lerp(hipY, actHip, w);
            sharpness = Mathf.Max(sharpness, _selAction == SelAction.Hop || _selAction == SelAction.FistPound ? 16f : 10f);
        }

        void GuardBase(Quaternion[] p, float breathe)
        {
            Stance(p, breathe, Def.Bulk > 1.2f);
            Set(p, J.Chest, 14 + breathe, -8, 0);
            Set(p, J.Head, 6, -4, 0);
            Set(p, J.ShoulderL, -75, 18, -4);
            Set(p, J.ElbowL, -136, 0, 0);
            Set(p, J.ShoulderR, -70, -18, 6);
            Set(p, J.ElbowR, -136, 0, 0);
        }

        static void ArmsCrossed(Quaternion[] p, float breathe)
        {
            Clear(p);
            Set(p, J.Chest, -5 + breathe, 0, 0);
            Set(p, J.Head, -5, -6, 0);
            // forearms cross in front of the chest (checked with an FK preview for Bulk 1.35, no chest clipping)
            Set(p, J.ShoulderL, -32, 74, -24);
            Set(p, J.ElbowL, -74, 0, 0);
            Set(p, J.ShoulderR, -26, -72, 24);
            Set(p, J.ElbowR, -70, 0, 0);
            Set(p, J.ThighL, 0, 0, -9);
            Set(p, J.ThighR, 0, 0, 9);
        }

        /// <summary>Snap to a pose immediately (no LateUpdate needed) for portrait rendering.</summary>
        public void PoseForPortrait(bool closeUp)
        {
            if (closeUp) IntroPose(Pose);
            else VictoryPose(Pose, 0);
            for (int i = 0; i < JointCount; i++)
            {
                _current[i] = Pose[i];
                _bones[i].localRotation = Pose[i];
            }
            _bones[(int)J.Hips].localPosition = new Vector3(0, closeUp ? 0.93f : 0.98f, 0);
            _humanoid?.Apply();
        }

        /// <summary>World position of a muscle overlay (the one nearest <paramref name="near"/> when there are left/right copies).</summary>
        public Vector3 MuscleAnchor(MuscleGroup group, Vector3 near)
        {
            var best = ChestBone.position;
            float bestD = float.MaxValue;
            foreach (var kv in _muscles)
            {
                if ((kv.Key & group) == 0) continue;
                foreach (var r in kv.Value)
                {
                    float d = (r.transform.position - near).sqrMagnitude;
                    if (d < bestD) { bestD = d; best = r.transform.position; }
                }
            }
            return best;
        }

        public Transform LimbTransform(Limb limb)
        {
            int j = limb switch
            {
                Limb.LeftHand => (int)J.HandL,
                Limb.RightHand => (int)J.HandR,
                Limb.LeftFoot => (int)J.FootL,
                Limb.RightFoot => (int)J.FootR,
                _ => (int)J.Chest,
            };
            return (_humanoid != null ? _humanoid.Bone(j) : null) ?? _bones[j];
        }

        // ------------------------------------------------------------------
        // Animation
        // ------------------------------------------------------------------
        void LateUpdate()
        {
            if (Fighter == null) return;
            float dt = Time.deltaTime;
            _animTime += dt;
            if (_selectMode && Fighter.State == FighterState.Intro) UpdateSelectTimers(dt);

            var pose = TargetPose(out float hipY, out float sharp);
            float k = 1f - Mathf.Exp(-sharp * dt);
            for (int i = 0; i < JointCount; i++)
            {
                _current[i] = Quaternion.Slerp(_current[i], pose[i], k);
                _bones[i].localRotation = _current[i];
            }
            _hipY = Mathf.Lerp(_hipY, hipY, k);
            _bones[(int)J.Hips].localPosition = new Vector3(0, 0.98f + _hipY, 0);
            _humanoid?.Apply();

            UpdateTrails();
            UpdateFlashAndGlow(dt);
        }

        void UpdateTrails()
        {
            bool active = Fighter.IsActiveFrame || (Fighter.State == FighterState.Attack && Fighter.CurrentMove != null &&
                                                     Fighter.MoveFrame >= Fighter.CurrentMove.Startup - 3 &&
                                                     Fighter.MoveFrame < Fighter.CurrentMove.Startup + Fighter.CurrentMove.Active + 2);
            var m = Fighter.CurrentMove;
            bool fiber = m != null && m.Kind >= MoveKind.Special &&
                         (Fighter.LastLink == LinkResult.Perfect || Fighter.LastLink == LinkResult.Link);
            // a different trail per attack type: punch = short arc, kick = longer arc, heavy = wide, muscle skill = fibre
            int style = m == null ? 0 : fiber ? 4 : m.Kind == MoveKind.Light ? 1 : (m.Kind == MoveKind.Kick || m.Kind == MoveKind.Launcher) ? 2 : 3;
            if (style != _trailStyle)
            {
                _trailStyle = style;
                float baseTime = QualityProfile.Current != null ? QualityProfile.Current.TrailTime : 0.2f;
                (float time, float width) = style switch
                {
                    1 => (0.45f, 0.6f),  // light punch: short thin arc
                    2 => (1.2f, 1.25f),  // kick: longer, wider arc
                    3 => (0.9f, 1.3f),   // heavy / special
                    4 => (1.8f, 1.8f),   // muscle link: fibre trail
                    _ => (0.6f, 0.8f),
                };
                for (int i = 0; i < 4; i++)
                {
                    _trails[i].material = fiber ? _trailFiber : _trailNormal;
                    _trails[i].colorGradient = fiber ? _gradFiber : _gradNormal;
                    _trails[i].widthMultiplier = (i < 2 ? 0.2f : 0.26f) * width;
                    _trails[i].time = baseTime * time;
                }
            }
            for (int i = 0; i < 4; i++)
            {
                bool on = false;
                if (active && m != null)
                {
                    on = m.Limb switch
                    {
                        Limb.LeftHand => i == 0,
                        Limb.RightHand => i == 1 || (m.Kind >= MoveKind.Special && i == 0),
                        Limb.LeftFoot => i == 2,
                        Limb.RightFoot => i == 3,
                        _ => i < 2,
                    };
                }
                if (Fighter.State == FighterState.Dodge) on = i < 2;
                _trails[i].emitting = on;
            }
        }

        void UpdateFlashAndGlow(float dt)
        {
            float flash = 0;
            if (_flash > 0)
            {
                _flash -= Time.unscaledDeltaTime;
                flash = Mathf.Clamp01(_flash / 0.08f) * 0.85f;
            }
            _mpb.SetFloat("_Flash", flash);
            _mpb.SetColor("_FlashColor", _flashColor);
            if (_humanoid != null) _humanoid.SetFlash(_flashColor, flash);
            else foreach (var r in _bodyRenderers) r.SetPropertyBlock(_mpb);

            if (_glowTime > 0)
            {
                _glowTime -= dt;
                float t = Mathf.Clamp01(_glowTime / _glowDuration);
                float alpha = Mathf.Sin(Mathf.Min(1f, (1 - t) * 6f) * Mathf.PI * 0.5f) * Mathf.Clamp01(t * 4f) * 1.6f;
                foreach (var m in _muscleMats) m.SetFloat("_Alpha", alpha);
                if (_glowTime <= 0) GlowMuscles(MuscleGroup.None, 0, _glowColor);
            }
        }

        // pose helpers ------------------------------------------------------
        static readonly Quaternion[] Pose = new Quaternion[JointCount];
        static readonly Quaternion[] PoseB = new Quaternion[JointCount];

        static void Set(Quaternion[] p, J j, float x, float y, float z) => p[(int)j] = Quaternion.Euler(x, y, z);

        static void Clear(Quaternion[] p)
        {
            for (int i = 0; i < JointCount; i++) p[i] = Quaternion.identity;
        }

        static void Stance(Quaternion[] p, float breathe, bool heavy)
        {
            Clear(p);
            Set(p, J.Hips, 0, 28, 0);
            Set(p, J.Spine, 6, -8, 0);
            Set(p, J.Chest, 6 + breathe * 2f, -14, 0);
            Set(p, J.Neck, -4, -4, 0);
            Set(p, J.Head, -6, -6, 0);
            Set(p, J.ShoulderL, -58, 10, -12);
            Set(p, J.ElbowL, -105, 0, 0);
            Set(p, J.ShoulderR, -42, -10, 14);
            Set(p, J.ElbowR, -125, 0, 0);
            Set(p, J.ThighL, -24, -28, -6);
            Set(p, J.KneeL, 32, 0, 0);
            Set(p, J.FootL, -8, 0, 0);
            Set(p, J.ThighR, 16, -28, 8);
            Set(p, J.KneeR, 30, 0, 0);
            Set(p, J.FootR, -40, 0, 0);
            if (heavy)
            {
                Set(p, J.ShoulderL, -50, 10, -22);
                Set(p, J.ShoulderR, -36, -10, 24);
            }
        }

        static void Lerp(Quaternion[] a, Quaternion[] b, float t, Quaternion[] outP)
        {
            for (int i = 0; i < JointCount; i++) outP[i] = Quaternion.Slerp(a[i], b[i], t);
        }

        Quaternion[] TargetPose(out float hipY, out float sharpness)
        {
            var f = Fighter;
            float breathe = Mathf.Sin(_animTime * 3.2f);
            bool heavyBuild = Def.Bulk > 1.2f;
            Stance(Pose, breathe, heavyBuild);
            hipY = -0.07f + breathe * 0.008f;
            sharpness = 18f;

            switch (f.State)
            {
                case FighterState.Intro when _selectMode:
                    SelectPose(Pose, out hipY, out sharpness);
                    break;
                case FighterState.Intro:
                    IntroPose(Pose);
                    hipY = 0;
                    sharpness = 6f;
                    break;
                case FighterState.Walk:
                {
                    float s = Mathf.Sin(_animTime * 9f);
                    Pose[(int)J.ThighL] = Pose[(int)J.ThighL] * Quaternion.Euler(s * 18f, 0, 0);
                    Pose[(int)J.ThighR] = Pose[(int)J.ThighR] * Quaternion.Euler(-s * 18f, 0, 0);
                    Pose[(int)J.KneeL] = Pose[(int)J.KneeL] * Quaternion.Euler(Mathf.Max(0, -s) * 30f, 0, 0);
                    Pose[(int)J.KneeR] = Pose[(int)J.KneeR] * Quaternion.Euler(Mathf.Max(0, s) * 30f, 0, 0);
                    hipY += Mathf.Abs(s) * 0.025f;
                    break;
                }
                case FighterState.Guard:
                case FighterState.GuardStun:
                    Set(Pose, J.Chest, 16, -6, 0);
                    Set(Pose, J.Head, 8, 0, 0);
                    Set(Pose, J.ShoulderL, -75, 18, -4);
                    Set(Pose, J.ElbowL, -138, 0, 0);
                    Set(Pose, J.ShoulderR, -72, -18, 6);
                    Set(Pose, J.ElbowR, -138, 0, 0);
                    hipY = -0.12f;
                    if (f.State == FighterState.GuardStun) { Set(Pose, J.Spine, -6, -8, 0); sharpness = 30f; }
                    break;
                case FighterState.Dodge:
                    Set(Pose, J.Spine, 10, -8, f.StateFrame < 10 ? 18 : 6);
                    Set(Pose, J.Chest, 18, -20, 0);
                    hipY = -0.2f;
                    sharpness = 26f;
                    break;
                case FighterState.Attack:
                    AttackPoseFor(f, out hipY, ref sharpness);
                    break;
                case FighterState.Hit:
                    Set(Pose, J.Spine, -18, 0, 8);
                    Set(Pose, J.Chest, -22, 10, 0);
                    Set(Pose, J.Head, -24, 8, 0);
                    Set(Pose, J.ShoulderL, -30, 0, -35);
                    Set(Pose, J.ElbowL, -60, 0, 0);
                    Set(Pose, J.ShoulderR, -20, 0, 30);
                    Set(Pose, J.ElbowR, -50, 0, 0);
                    hipY = -0.05f;
                    sharpness = 40f;
                    break;
                case FighterState.Air:
                case FighterState.KO when f.IsAirborne:
                    Set(Pose, J.Hips, -55, 0, 0);
                    Set(Pose, J.Spine, -20, 0, 0);
                    Set(Pose, J.Chest, -20, 0, 0);
                    Set(Pose, J.Head, -20, 0, 0);
                    Set(Pose, J.ShoulderL, -150, 0, -40);
                    Set(Pose, J.ElbowL, -20, 0, 0);
                    Set(Pose, J.ShoulderR, -140, 0, 40);
                    Set(Pose, J.ElbowR, -30, 0, 0);
                    Set(Pose, J.ThighL, -50, 0, -10);
                    Set(Pose, J.KneeL, 60, 0, 0);
                    Set(Pose, J.ThighR, -20, 0, 10);
                    Set(Pose, J.KneeR, 30, 0, 0);
                    hipY = 0.1f;
                    sharpness = 14f;
                    break;
                case FighterState.Knockdown:
                case FighterState.KO:
                    LyingPose(Pose);
                    hipY = -0.8f;
                    sharpness = 12f;
                    break;
                case FighterState.GetUp:
                {
                    LyingPose(PoseB);
                    float t = Mathf.Clamp01(f.StateFrame / 20f);
                    Lerp(PoseB, Pose, t, Pose);
                    hipY = Mathf.Lerp(-0.8f, -0.07f, t);
                    sharpness = 20f;
                    break;
                }
                case FighterState.Grabbed:
                    Set(Pose, J.Chest, -10, 0, 0);
                    Set(Pose, J.ShoulderL, -60, 0, -50);
                    Set(Pose, J.ShoulderR, -60, 0, 50);
                    Set(Pose, J.ElbowL, -40, 0, 0);
                    Set(Pose, J.ElbowR, -40, 0, 0);
                    hipY = 0.06f;
                    sharpness = 20f;
                    break;
                case FighterState.Throwing:
                {
                    float t = Mathf.Clamp01(f.StateFrame / 22f);
                    Set(Pose, J.Hips, 0, Mathf.Lerp(20, -40, t), 0);
                    Set(Pose, J.Chest, Mathf.Lerp(-10, 40, t), -10, 0);
                    Set(Pose, J.ShoulderL, Mathf.Lerp(-120, -60, t), 0, -10);
                    Set(Pose, J.ShoulderR, Mathf.Lerp(-120, -60, t), 0, 10);
                    Set(Pose, J.ElbowL, -40, 0, 0);
                    Set(Pose, J.ElbowR, -40, 0, 0);
                    hipY = Mathf.Lerp(-0.05f, -0.2f, t);
                    sharpness = 16f;
                    break;
                }
                case FighterState.Victory:
                    VictoryPose(Pose, breathe);
                    hipY = 0;
                    sharpness = 7f;
                    break;
                case FighterState.Lose:
                    Clear(Pose);
                    Set(Pose, J.Spine, 28, 0, 0);
                    Set(Pose, J.Chest, 25, 0, 0);
                    Set(Pose, J.Head, 30, 0, 0);
                    Set(Pose, J.ShoulderL, -70, 0, -10);
                    Set(Pose, J.ShoulderR, -70, 0, 10);
                    Set(Pose, J.ElbowL, -10, 0, 0);
                    Set(Pose, J.ElbowR, -10, 0, 0);
                    Set(Pose, J.ThighL, -95, 0, -6);
                    Set(Pose, J.KneeL, 100, 0, 0);
                    Set(Pose, J.ThighR, -10, 0, 6);
                    Set(Pose, J.KneeR, 100, 0, 0);
                    hipY = -0.5f;
                    sharpness = 5f;
                    break;
            }

            if (f.Adrenaline && f.State != FighterState.KO) hipY -= 0.02f;

            // additive hit recoil on top of the state pose
            if (_recoil > 0.01f && (f.State == FighterState.Hit || f.State == FighterState.GuardStun || f.State == FighterState.Air))
            {
                float r = _recoil;
                Pose[(int)J.Spine] = Pose[(int)J.Spine] * Quaternion.Euler(-14f * r, 0, 6f * r);
                Pose[(int)J.Chest] = Pose[(int)J.Chest] * Quaternion.Euler(-18f * r, 8f * r, 0);
                Pose[(int)J.Head] = Pose[(int)J.Head] * Quaternion.Euler(-26f * r, 10f * r, 0);
                if (_stagger)
                {
                    Pose[(int)J.KneeL] = Pose[(int)J.KneeL] * Quaternion.Euler(25f * r, 0, 0);
                    Pose[(int)J.KneeR] = Pose[(int)J.KneeR] * Quaternion.Euler(35f * r, 0, 0);
                    hipY -= 0.09f * r;
                }
                sharpness = Mathf.Max(sharpness, 45f);
            }
            _recoil = Mathf.MoveTowards(_recoil, 0, Time.deltaTime * (_stagger ? 1.6f : 3f));
            return Pose;
        }

        void AttackPoseFor(FighterController f, out float hipY, ref float sharpness)
        {
            var m = f.CurrentMove;
            hipY = -0.08f;
            if (m == null) return;
            int fr = f.MoveFrame;
            // phase 0..1 windup, 1..2 strike held, 2..3 recovery
            float phase;
            if (fr < m.Startup) phase = Mathf.Clamp01((float)fr / Mathf.Max(1, m.Startup));
            else if (fr < m.Startup + m.Active) phase = 1f + (float)(fr - m.Startup) / Mathf.Max(1, m.Active);
            else phase = 2f + Mathf.Clamp01((float)(fr - m.Startup - m.Active) / Mathf.Max(1, m.Recovery));

            var wind = PoseB;
            Stance(wind, 0, false);
            var strike = Pose; // reuse buffer: stance already in Pose; build strike on top
            BuildAttack(m.Pose, wind, strike, f, out float windHip, out float strikeHip);

            if (phase < 1f)
            {
                // anticipation then snap: hold windup for most of startup, last 30% snaps to strike
                float snap = Mathf.InverseLerp(0.65f, 1f, phase);
                if (snap <= 0) { CopyTo(wind, Pose); hipY = windHip; sharpness = 22f; }
                else { hipY = Mathf.Lerp(windHip, strikeHip, snap); sharpness = 60f; }
            }
            else if (phase < 2f)
            {
                hipY = strikeHip;
                sharpness = 60f;
            }
            else
            {
                float t = phase - 2f;
                Stance(PoseB, 0, false);
                Lerp(Pose, PoseB, Mathf.SmoothStep(0, 1, t), Pose);
                hipY = Mathf.Lerp(strikeHip, -0.07f, t);
                sharpness = 14f;
            }
        }

        static void CopyTo(Quaternion[] a, Quaternion[] b) { for (int i = 0; i < JointCount; i++) b[i] = a[i]; }

        /// <summary>Fills windup + strike poses for an attack animation key.</summary>
        void BuildAttack(AttackPose key, Quaternion[] w, Quaternion[] s, FighterController f, out float windHip, out float strikeHip)
        {
            windHip = -0.1f;
            strikeHip = -0.08f;
            Stance(s, 0, false);
            switch (key)
            {
                case AttackPose.Jab:
                    Set(w, J.Chest, 8, -24, 0);
                    Set(s, J.Hips, 0, 18, 0);
                    Set(s, J.Chest, 4, 22, 0);
                    Set(s, J.ShoulderL, -92, 6, 0);
                    Set(s, J.ElbowL, -4, 0, 0);
                    break;
                case AttackPose.Cross:
                    Set(w, J.Chest, 10, -10, 0);
                    Set(w, J.ShoulderR, -40, -10, 20);
                    Set(s, J.Hips, 0, -6, 0);
                    Set(s, J.Chest, 6, -38, 0);
                    Set(s, J.ShoulderR, -94, -8, 0);
                    Set(s, J.ElbowR, -4, 0, 0);
                    Set(s, J.ThighR, 22, -10, 8);
                    Set(s, J.FootR, -60, 0, 0);
                    strikeHip = -0.1f;
                    break;
                case AttackPose.Hook:
                    Set(w, J.Chest, 10, -38, 0);
                    Set(w, J.ShoulderL, -30, 0, -80);
                    Set(w, J.ElbowL, -90, 0, 0);
                    Set(s, J.Hips, 0, 40, 0);
                    Set(s, J.Chest, 8, 42, 0);
                    Set(s, J.ShoulderL, -10, 10, -88);
                    Set(s, J.ElbowL, -92, 0, 0);
                    break;
                case AttackPose.Uppercut:
                    Set(w, J.Spine, 22, -10, 0);
                    Set(w, J.ShoulderR, -10, 0, 20);
                    Set(w, J.ElbowR, -100, 0, 0);
                    windHip = -0.25f;
                    Set(s, J.Spine, -14, -20, 0);
                    Set(s, J.Chest, -10, -24, 0);
                    Set(s, J.ShoulderR, -160, -10, 10);
                    Set(s, J.ElbowR, -50, 0, 0);
                    strikeHip = 0.02f;
                    break;
                case AttackPose.FrontKick:
                    Set(w, J.ThighR, -90, 0, 0);
                    Set(w, J.KneeR, 110, 0, 0);
                    Set(s, J.Hips, 0, 0, 0);
                    Set(s, J.Spine, -14, 0, 0);
                    Set(s, J.ThighR, -95, 0, 0);
                    Set(s, J.KneeR, 0, 0, 0);
                    Set(s, J.FootR, 30, 0, 0);
                    Set(s, J.ThighL, 0, 0, 0);
                    Set(s, J.KneeL, 10, 0, 0);
                    strikeHip = -0.02f;
                    break;
                case AttackPose.Roundhouse:
                    Set(w, J.Hips, 0, 40, 0);
                    Set(w, J.ThighR, -70, 0, 20);
                    Set(w, J.KneeR, 110, 0, 0);
                    Set(s, J.Hips, 0, -65, 0);
                    Set(s, J.Spine, 0, 10, -18);
                    Set(s, J.Chest, 0, 20, -8);
                    Set(s, J.ThighR, -5, 0, 82);
                    Set(s, J.KneeR, 8, 0, 0);
                    Set(s, J.ThighL, -5, 0, 0);
                    Set(s, J.KneeL, 8, 0, 0);
                    Set(s, J.FootL, 0, 0, 0);
                    strikeHip = 0f;
                    break;
                case AttackPose.LaunchKick:
                    Set(w, J.ThighR, -40, 0, 0);
                    Set(w, J.KneeR, 90, 0, 0);
                    windHip = -0.22f;
                    Set(s, J.Hips, 0, 0, 0);
                    Set(s, J.Spine, -22, 0, 0);
                    Set(s, J.Chest, -12, 0, 0);
                    Set(s, J.ThighR, -150, 0, 0);
                    Set(s, J.KneeR, 5, 0, 0);
                    Set(s, J.ThighL, 6, 0, 0);
                    Set(s, J.KneeL, 4, 0, 0);
                    Set(s, J.ShoulderL, -20, 0, -40);
                    Set(s, J.ShoulderR, -20, 0, 40);
                    strikeHip = 0.04f;
                    break;
                case AttackPose.Grab:
                    Set(w, J.ShoulderL, -60, 0, -40);
                    Set(w, J.ShoulderR, -60, 0, 40);
                    Set(s, J.Chest, 18, 0, 0);
                    Set(s, J.ShoulderL, -88, 18, 0);
                    Set(s, J.ElbowL, -25, 0, 0);
                    Set(s, J.ShoulderR, -88, -18, 0);
                    Set(s, J.ElbowR, -25, 0, 0);
                    strikeHip = -0.14f;
                    break;
                case AttackPose.Throw:
                    break;
                case AttackPose.CounterPalm:
                    Set(w, J.Chest, 10, 25, 0);
                    Set(s, J.Hips, 0, 35, 0);
                    Set(s, J.Chest, 6, 10, 0);
                    Set(s, J.ShoulderL, -95, 20, -10);
                    Set(s, J.ElbowL, -30, 0, 0);
                    Set(s, J.ShoulderR, -55, -20, 20);
                    Set(s, J.ElbowR, -100, 0, 0);
                    strikeHip = -0.18f;
                    break;
                case AttackPose.ShoulderRush:
                    // shoulder abduction: lead arm lifted sideways while charging (§9 Shoulder Abduction)
                    Set(w, J.Chest, 18, 30, 0);
                    Set(w, J.ShoulderR, 0, 0, 30);
                    Set(w, J.ElbowR, -40, 0, 0);
                    windHip = -0.2f;
                    Set(s, J.Hips, 0, -30, 0);
                    Set(s, J.Spine, 18, -10, 0);
                    Set(s, J.Chest, 12, -45, 0);
                    Set(s, J.ShoulderR, -20, 0, 92);
                    Set(s, J.ElbowR, 0, 0, 20);
                    Set(s, J.ShoulderL, -95, 0, -10);
                    Set(s, J.ElbowL, -10, 0, 0);
                    Set(s, J.ThighR, 30, -20, 6);
                    Set(s, J.KneeR, 20, 0, 0);
                    Set(s, J.ThighL, -50, -20, 0);
                    Set(s, J.KneeL, 60, 0, 0);
                    // alternate strikes during the rush
                    if (f.IsActiveFrame && (f.MoveFrame / 4) % 2 == 1)
                    {
                        Set(s, J.Chest, 10, 30, 0);
                        Set(s, J.ShoulderL, -92, 0, 0);
                        Set(s, J.ElbowL, -2, 0, 0);
                    }
                    strikeHip = -0.18f;
                    break;
                case AttackPose.Slam:
                    Set(w, J.Spine, -18, 0, 0);
                    Set(w, J.Chest, -15, 0, 0);
                    Set(w, J.ShoulderL, -175, 0, -10);
                    Set(w, J.ShoulderR, -175, 0, 10);
                    Set(w, J.ElbowL, -40, 0, 0);
                    Set(w, J.ElbowR, -40, 0, 0);
                    windHip = 0f;
                    Set(s, J.Spine, 30, 0, 0);
                    Set(s, J.Chest, 30, 0, 0);
                    Set(s, J.ShoulderL, -70, 12, -6);
                    Set(s, J.ShoulderR, -70, -12, 6);
                    Set(s, J.ElbowL, -10, 0, 0);
                    Set(s, J.ElbowR, -10, 0, 0);
                    Set(s, J.ThighL, -60, -20, 0);
                    Set(s, J.KneeL, 70, 0, 0);
                    strikeHip = -0.28f;
                    break;
                case AttackPose.UltimateBurst:
                    // windup: arms abducted wide, chest open (force couple charge)
                    Set(w, J.Spine, -16, 0, 0);
                    Set(w, J.Chest, -18, 0, 0);
                    Set(w, J.Head, -15, 0, 0);
                    Set(w, J.ShoulderL, -20, 0, -100);
                    Set(w, J.ShoulderR, -20, 0, 100);
                    Set(w, J.ElbowL, 0, 0, -30);
                    Set(w, J.ElbowR, 0, 0, 30);
                    windHip = -0.04f;
                    bool alt = (f.MoveFrame / 5) % 2 == 0;
                    Set(s, J.Hips, 0, alt ? 15 : -15, 0);
                    Set(s, J.Chest, 8, alt ? 30 : -38, 0);
                    Set(s, alt ? J.ShoulderL : J.ShoulderR, -93, 0, 0);
                    Set(s, alt ? J.ElbowL : J.ElbowR, -3, 0, 0);
                    strikeHip = -0.14f;
                    break;
            }
        }

        static void LyingPose(Quaternion[] p)
        {
            Clear(p);
            Set(p, J.Hips, -88, 0, 0);
            Set(p, J.Head, 10, 20, 0);
            Set(p, J.ShoulderL, -160, 0, -30);
            Set(p, J.ShoulderR, -10, 0, 50);
            Set(p, J.ElbowL, -20, 0, 0);
            Set(p, J.ElbowR, -30, 0, 0);
            Set(p, J.ThighL, -10, 0, -8);
            Set(p, J.ThighR, -30, 0, 10);
            Set(p, J.KneeR, 40, 0, 0);
        }

        void VictoryPose(Quaternion[] p, float breathe)
        {
            Clear(p);
            if (Def.Bulk > 1.2f)
            {
                // double biceps
                Set(p, J.Chest, -8 + breathe, 0, 0);
                Set(p, J.ShoulderL, 0, 0, -88);
                Set(p, J.ElbowL, 0, 0, -95);
                Set(p, J.ShoulderR, 0, 0, 88);
                Set(p, J.ElbowR, 0, 0, 95);
                Set(p, J.ThighL, 0, 0, -10);
                Set(p, J.ThighR, 0, 0, 10);
                Set(p, J.Head, -8, 0, 0);
            }
            else
            {
                // fist to the sky (concept image)
                Set(p, J.Hips, 0, 15, 0);
                Set(p, J.Spine, -6, 0, 0);
                Set(p, J.Chest, -10 + breathe, -10, 0);
                Set(p, J.Head, -22, 0, 0);
                Set(p, J.ShoulderR, -168, 0, -6);
                Set(p, J.ElbowR, -30, 0, 0);
                Set(p, J.ShoulderL, -20, 0, -55);
                Set(p, J.ElbowL, -120, 0, 0);
                Set(p, J.ThighL, -30, 0, -14);
                Set(p, J.KneeL, 35, 0, 0);
                Set(p, J.ThighR, 25, 0, 12);
                Set(p, J.KneeR, 5, 0, 0);
            }
        }

        void IntroPose(Quaternion[] p)
        {
            Stance(p, Mathf.Sin(_animTime * 3f), Def.Bulk > 1.2f);
            Set(p, J.Head, -2, -10, 0);
            Set(p, J.ShoulderR, -40, 0, 30);
            Set(p, J.ElbowR, -135, 0, 0);
            Set(p, J.ShoulderL, -70, 30, -10);
            Set(p, J.ElbowL, -110, 0, 0);
        }
    }
}
