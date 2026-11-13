using System.Collections.Generic;
using UnityEngine;

namespace MuscleBattle
{
    /// <summary>
    /// Roster + frame data. Vertical slice = 2 fighters (master prompt §59):
    ///   Jin Hyun     - POWER fighter (heavy, armoured, blue awakening, shoulder / scapula muscles)
    ///   Ray Castillo - SPEED fighter (fast kicks, long dodge, red / purple awakening, lower-limb muscles)
    /// Locked slots are shown in character select as the future roster.
    /// </summary>
    public static class CharacterDatabase
    {
        static List<FighterDefinition> _all;

        public static IReadOnlyList<FighterDefinition> All => _all ??= Build();

        /// <summary>Future roster shown as locked silhouettes (§25 character concepts).</summary>
        public static readonly (string ko, string en, FightStyle style)[] LockedRoster =
        {
            ("마야 카터", "Maya Carter · Athletic Trainer", FightStyle.Performance),
            ("뉴로 스페셜리스트", "Neuro Specialist", FightStyle.Neuro),
            ("매뉴얼 테라피", "Manual Therapy Fighter", FightStyle.Rehab),
            ("모빌리티 파이터", "Mobility Fighter", FightStyle.Mobility),
            ("아나토미 리서처", "Anatomy Researcher", FightStyle.Balance),
            ("애슬레틱 트레이너", "Athletic Trainer", FightStyle.Balance),
        };

        /// <summary>Unlock condition shown under each locked silhouette (same order as LockedRoster).</summary>
        static readonly string[] UnlockConditions =
        {
            "Arcade Stage 3 Clear",
            "Muscle Mastery Lv.5",
            "Perfect Counter ×30",
            "Muscle Link ×50",
            "Arcade All Clear",
            "VS 대전 10승",
        };

        static List<FighterDefinition> _locked;

        /// <summary>
        /// Locked roster as all-black silhouette fighters (same procedural rig, near-black materials, grey rim),
        /// so the select screen can show a mysterious 3D silhouette + portrait instead of a "?" card (§10).
        /// Never playable: <see cref="FighterDefinition.Locked"/> is true and they have no moves.
        /// </summary>
        public static IReadOnlyList<FighterDefinition> Locked => _locked ??= BuildLocked();

        static List<FighterDefinition> BuildLocked()
        {
            var list = new List<FighterDefinition>();
            // silhouette body types: (female, hair, height, bulk)
            var looks = new (bool female, HairStyle hair, float height, float bulk)[]
            {
                (true, HairStyle.Ponytail, 0.96f, 0.9f),
                (false, HairStyle.Buzz, 1.02f, 0.95f),
                (false, HairStyle.SlickBack, 1.0f, 1.15f),
                (true, HairStyle.Braids, 0.97f, 0.85f),
                (false, HairStyle.ShortSpiky, 1.03f, 0.9f),
                (false, HairStyle.Buzz, 1.05f, 1.25f),
            };
            var black = new Color(0.035f, 0.035f, 0.05f);
            var rim = new Color(0.42f, 0.42f, 0.5f);
            for (int i = 0; i < LockedRoster.Length; i++)
            {
                var l = looks[i % looks.Length];
                list.Add(new FighterDefinition
                {
                    Id = "locked_" + i, NameEn = "???", NameKo = "???", Locked = true,
                    RoleKo = LockedRoster[i].ko, RoleEn = LockedRoster[i].en, ShortRole = "LOCKED",
                    Style = LockedRoster[i].style, Personality = SelectPersonality.Calm,
                    UnlockCondition = UnlockConditions[i % UnlockConditions.Length],
                    Female = l.female, HairStyle = l.hair, Height = l.height, Bulk = l.bulk,
                    Skin = black, Hair = black, Top = black, TopAccent = black, Pants = black, PantsAccent = black,
                    Shoes = black, Gloves = black, Energy = rim, EnergyAlt = rim, ChestMark = "",
                    ModelResourcePath = "Characters/__locked_silhouette__", // never resolves to a model
                    Power = 0, Speed = 0, Technique = 0, Defense = 0, Knowledge = 0,
                });
            }
            return list;
        }

        public static FighterDefinition Get(string id)
        {
            foreach (var f in All) if (f.Id == id) return f;
            return All[0];
        }

        static List<FighterDefinition> Build() => new List<FighterDefinition> { JinHyun(), RayCastillo() };

        // ------------------------------------------------------------------
        // JIN HYUN - POWER fighter (MUSCLE BATTLE 2.0): heavy, slow, armoured, blue muscle awakening.
        // Muscle theme: shoulder / scapula / upper body.
        // ------------------------------------------------------------------
        static FighterDefinition JinHyun()
        {
            var d = new FighterDefinition
            {
                Id = "jin", NameEn = "JIN HYUN", NameKo = "진현", Level = 12, Difficulty = 2,
                RoleKo = "근력형 파이터", RoleEn = "Power Fighter",
                Quote = "\"근육은 거짓말하지 않는다. 한 방이면 충분해.\"",
                IntroLine = "\"힘으로 끝낸다.\"",
                WinLine = "\"이게 진짜 근력이다!\"",
                Style = FightStyle.Power,
                Power = 10, Speed = 5, Technique = 7, Reach = 8, Durability = 9,
                Defense = 9, Knowledge = 8,
                Specialties = new[] { "어깨·견갑 근력", "슈퍼아머 돌진", "강타 카운터" },
                ShortRole = "POWER FIGHTER",
                Traits = new[]
                {
                    new IconLabel("Power", "bolt"),
                    new IconLabel("Super Armor", "shield"),
                    new IconLabel("Muscle Link", "link"),
                },
                SignatureSkills = new[]
                {
                    new IconLabel("Shoulder Abduction", "arc", "가시위근 · 어깨세모근"),
                    new IconLabel("Serratus Punch", "burst", "앞톱니근"),
                    new IconLabel("Latissimus Pull", "pull", "넓은등근"),
                },
                Personality = SelectPersonality.Power,
                ThemeSfx = "theme_jin", LockVoice = "jin_lock",
                MaxHp = 1100, WalkSpeed = 2.3f, BackSpeed = 1.9f, SidestepSpeed = 2.2f, DodgeDistance = 1.45f, BodyRadius = 0.48f,
                Height = 1.04f, Bulk = 1.32f,
                Skin = new Color(0.93f, 0.76f, 0.62f), Hair = new Color(0.06f, 0.06f, 0.08f),
                Top = new Color(0.09f, 0.11f, 0.18f), TopAccent = new Color(0.15f, 0.55f, 1.0f),
                Pants = new Color(0.08f, 0.09f, 0.13f), PantsAccent = new Color(0.15f, 0.55f, 1.0f),
                Shoes = new Color(0.1f, 0.12f, 0.18f), Gloves = new Color(0.08f, 0.1f, 0.16f),
                Energy = Palette.Nerve, EnergyAlt = Palette.NerveDeep,
                HairStyle = HairStyle.ShortSpiky, SleevelessTop = true, ChestMark = "JH",
                ModelResourcePath = "Characters/jin", // Mixamo / VRoid Humanoid -> Resources/Characters/jin (docs/CHARACTER_PIPELINE.md)
                SpecialName = "숄더 어브덕션 러시", SpecialNameEn = "Shoulder Abduction Rush",
                UltimateName = "스캐퓰러 포스 커플", UltimateNameEn = "Scapular Force Couple",
                SignatureMuscles = "어깨세모근 + 가시위근 (Deltoid + Supraspinatus)",
            };

            d.Add(new MoveData { Id = "l1", DisplayName = "헤비 잽", Kind = MoveKind.Light, Pose = AttackPose.Jab, Limb = Limb.LeftHand,
                Startup = 8, Active = 3, Recovery = 11, Damage = 45, HitStun = 16, BlockStun = 10, Knockback = 0.45f, Reach = 1.05f,
                Lunge = 0.12f, ChainLight = "l2", ChainHeavy = "h1", ChainKick = "k1", Muscles = MuscleGroup.Triceps | MuscleGroup.Deltoid });
            d.Add(new MoveData { Id = "l2", DisplayName = "해머 훅", Kind = MoveKind.Light, Pose = AttackPose.Hook, Limb = Limb.RightHand, Impact = ImpactTier.Medium,
                Startup = 9, Active = 3, Recovery = 13, Damage = 52, HitStun = 17, BlockStun = 10, Knockback = 0.55f, Reach = 1.05f,
                Lunge = 0.18f, ChainLight = "l3", ChainHeavy = "h1", Muscles = MuscleGroup.Pectoralis | MuscleGroup.Latissimus });
            d.Add(new MoveData { Id = "l3", DisplayName = "파워 어퍼", Kind = MoveKind.Light, Pose = AttackPose.Uppercut, Limb = Limb.LeftHand, Impact = ImpactTier.Heavy,
                Startup = 12, Active = 4, Recovery = 18, Damage = 75, HitStun = 22, BlockStun = 12, Knockback = 1.2f, Reach = 1.0f,
                Lunge = 0.25f, Muscles = MuscleGroup.Biceps | MuscleGroup.Deltoid | MuscleGroup.Quadriceps });
            d.Add(new MoveData { Id = "h1", DisplayName = "스트렝스 스매시", Kind = MoveKind.Heavy, Pose = AttackPose.Slam, Limb = Limb.RightHand,
                Impact = ImpactTier.Heavy, Sfx = SfxKind.Heavy,
                Startup = 16, Active = 5, Recovery = 24, Damage = 125, HitStun = 26, BlockStun = 16, Knockback = 2.0f, Reach = 1.2f, Radius = 0.55f,
                Lunge = 0.5f, MeterOnHit = 14, Muscles = MuscleGroup.Latissimus | MuscleGroup.Triceps | MuscleGroup.Core });
            d.Add(new MoveData { Id = "k1", DisplayName = "프론트 킥", Kind = MoveKind.Kick, Pose = AttackPose.FrontKick, Limb = Limb.RightFoot,
                Impact = ImpactTier.Medium, Sfx = SfxKind.Kick,
                Startup = 13, Active = 4, Recovery = 18, Damage = 80, HitStun = 20, BlockStun = 12, Knockback = 1.3f, Reach = 1.35f, HitHeight = 1.0f,
                Lunge = 0.2f, ChainKick = "k2", Muscles = MuscleGroup.Quadriceps | MuscleGroup.Gluteus });
            d.Add(new MoveData { Id = "k2", DisplayName = "스쿼트 런처", Kind = MoveKind.Launcher, Pose = AttackPose.LaunchKick, Limb = Limb.RightFoot,
                Impact = ImpactTier.Heavy, Sfx = SfxKind.Kick,
                Startup = 15, Active = 4, Recovery = 20, Damage = 70, HitStun = 30, BlockStun = 13, Knockback = 0.5f, Launch = 6.2f, Reach = 1.0f,
                Lunge = 0.15f, MeterOnHit = 12, Muscles = MuscleGroup.Quadriceps | MuscleGroup.Gluteus | MuscleGroup.Hamstrings });
            d.Add(new MoveData { Id = "grab", DisplayName = "잡기", Kind = MoveKind.Grab, Pose = AttackPose.Grab, Limb = Limb.Body, Sfx = SfxKind.Grab,
                Startup = 9, Active = 3, Recovery = 30, Damage = 0, Reach = 0.95f, Radius = 0.55f, Unblockable = true });
            d.Add(new MoveData { Id = "throw", DisplayName = "파워 클린 스로우", Kind = MoveKind.Throw, Pose = AttackPose.Throw, Limb = Limb.Body,
                Impact = ImpactTier.Heavy, Sfx = SfxKind.Heavy, Damage = 160, Knockback = 2.5f, Knockdown = true, Unblockable = true, MeterOnHit = 15,
                Muscles = MuscleGroup.Trapezius | MuscleGroup.Gluteus | MuscleGroup.Quadriceps });
            d.Add(new MoveData { Id = "counter", DisplayName = "카운터 자세", Kind = MoveKind.Counter, Pose = AttackPose.CounterPalm, Limb = Limb.Body,
                Startup = 3, Active = 16, Recovery = 24 });
            d.Add(new MoveData { Id = "counterStrike", DisplayName = "퍼펙트 카운터", Kind = MoveKind.CounterStrike, Pose = AttackPose.Slam, Limb = Limb.RightHand,
                Impact = ImpactTier.Heavy, Sfx = SfxKind.Heavy, Startup = 5, Active = 5, Recovery = 20, Lunge = 0.6f, Damage = 140, HitStun = 30, Knockback = 2.4f, Knockdown = true,
                Reach = 1.1f, Radius = 0.7f, MeterOnHit = 20, Muscles = MuscleGroup.Latissimus | MuscleGroup.Core });
            d.Add(new MoveData { Id = "special", DisplayName = d.SpecialName, Kind = MoveKind.Special, Pose = AttackPose.ShoulderRush, Limb = Limb.RightHand,
                Impact = ImpactTier.Heavy, Sfx = SfxKind.Heavy,
                Startup = 16, Active = 14, Recovery = 26, Damage = 62, HitStun = 24, BlockStun = 12, Knockback = 0.5f, Reach = 1.05f, Radius = 0.65f,
                Lunge = 2.6f, Hits = 3, HitInterval = 5, Armor = true, MeterCost = 100, MeterOnHit = 0, ChainSpecial = null,
                Muscles = MuscleGroup.Deltoid | MuscleGroup.Supraspinatus, MuscleCaption = "어깨세모근 + 가시위근  ·  Deltoid + Supraspinatus" });
            d.Add(new MoveData { Id = "ultimate", DisplayName = d.UltimateName, Kind = MoveKind.Ultimate, Pose = AttackPose.UltimateBurst, Limb = Limb.RightHand,
                Impact = ImpactTier.Ultimate, Sfx = SfxKind.Heavy,
                Startup = 22, Active = 26, Recovery = 32, Damage = 66, HitStun = 40, BlockStun = 16, Knockback = 0.3f, Reach = 1.2f, Radius = 0.8f,
                Lunge = 2.0f, Hits = 5, HitInterval = 6, MeterCost = 300, MeterOnHit = 0, ChainSpecial = null,
                Muscles = MuscleGroup.Trapezius | MuscleGroup.SerratusAnterior | MuscleGroup.Deltoid,
                MuscleCaption = "등세모근 위·아래부분 + 앞톱니근  ·  Trapezius + Serratus Anterior" });
            return d;
        }

        // ------------------------------------------------------------------
        // RAY CASTILLO - SPEED fighter (MUSCLE BATTLE 2.0): fast kicks, long dodge, red / purple awakening.
        // Muscle theme: lower limb (hip / knee).
        // ------------------------------------------------------------------
        static FighterDefinition RayCastillo()
        {
            var d = new FighterDefinition
            {
                Id = "ray", NameEn = "RAY CASTILLO", NameKo = "레이 카스티요", Level = 13, Difficulty = 3,
                RoleKo = "스피드형 파이터", RoleEn = "Speed Fighter",
                Quote = "\"보이기 전에 끝난다.\"",
                IntroLine = "\"따라올 수 있으면 따라와 봐.\"",
                WinLine = "\"너무 느려!\"",
                Style = FightStyle.Performance,
                Power = 6, Speed = 10, Technique = 9, Reach = 8, Durability = 6,
                Defense = 6, Knowledge = 8,
                Specialties = new[] { "하지 스피드", "연속 발차기", "회피 반격" },
                ShortRole = "SPEED FIGHTER",
                Traits = new[]
                {
                    new IconLabel("Speed", "chevron"),
                    new IconLabel("Kick Combo", "burst"),
                    new IconLabel("Evasion", "arc"),
                },
                SignatureSkills = new[]
                {
                    new IconLabel("Hamstring Whip", "arc", "넙다리두갈래근 · 큰볼기근"),
                    new IconLabel("Quadriceps Drive", "chevron", "넙다리곧은근 · 가쪽넓은근"),
                    new IconLabel("Glute Max Smash", "burst", "큰볼기근"),
                },
                Personality = SelectPersonality.Confident,
                ThemeSfx = "theme_ray", LockVoice = "ray_lock",
                MaxHp = 950, WalkSpeed = 3.1f, BackSpeed = 2.5f, SidestepSpeed = 3.0f, DodgeDistance = 2.1f, BodyRadius = 0.4f,
                Height = 1.0f, Bulk = 0.95f,
                Skin = new Color(0.84f, 0.64f, 0.5f), Hair = new Color(0.32f, 0.12f, 0.36f),
                Top = new Color(0.1f, 0.06f, 0.14f), TopAccent = new Color(1.0f, 0.18f, 0.32f),
                Pants = new Color(0.12f, 0.07f, 0.16f), PantsAccent = new Color(0.72f, 0.28f, 1.0f),
                Shoes = new Color(0.95f, 0.95f, 0.98f), Gloves = new Color(0.14f, 0.06f, 0.16f),
                Energy = Palette.MasteryPink, EnergyAlt = Palette.Muscle,
                HairStyle = HairStyle.SlickBack, ChestMark = "RC",
                ModelResourcePath = "Characters/ray",
                SpecialName = "햄스트링 윕 콤보", SpecialNameEn = "Hamstring Whip Combo",
                UltimateName = "쿼드 라이트닝", UltimateNameEn = "Quadriceps Lightning",
                SignatureMuscles = "큰볼기근 + 넙다리두갈래근 (Gluteus Maximus + Biceps Femoris)",
            };

            d.Add(new MoveData { Id = "l1", DisplayName = "잽", Kind = MoveKind.Light, Pose = AttackPose.Jab, Limb = Limb.LeftHand,
                Startup = 5, Active = 2, Recovery = 8, Damage = 30, HitStun = 15, BlockStun = 9, Knockback = 0.3f, Reach = 0.95f,
                Lunge = 0.18f, ChainLight = "l2", ChainHeavy = "h1", ChainKick = "k1", Muscles = MuscleGroup.Triceps | MuscleGroup.Deltoid });
            d.Add(new MoveData { Id = "l2", DisplayName = "크로스", Kind = MoveKind.Light, Pose = AttackPose.Cross, Limb = Limb.RightHand,
                Startup = 6, Active = 3, Recovery = 10, Damage = 36, HitStun = 16, BlockStun = 9, Knockback = 0.35f, Reach = 1.05f,
                Lunge = 0.22f, ChainLight = "l3", ChainKick = "k1", Muscles = MuscleGroup.Pectoralis | MuscleGroup.Triceps });
            d.Add(new MoveData { Id = "l3", DisplayName = "스핀 킥", Kind = MoveKind.Light, Pose = AttackPose.Roundhouse, Limb = Limb.RightFoot, Impact = ImpactTier.Medium, Sfx = SfxKind.Kick,
                Startup = 9, Active = 3, Recovery = 14, Damage = 58, HitStun = 20, BlockStun = 11, Knockback = 1.0f, Reach = 1.25f, HitHeight = 1.2f,
                Lunge = 0.3f, ChainKick = "k2", Muscles = MuscleGroup.Gluteus | MuscleGroup.Core });
            d.Add(new MoveData { Id = "h1", DisplayName = "니 드라이브", Kind = MoveKind.Heavy, Pose = AttackPose.FrontKick, Limb = Limb.RightFoot,
                Impact = ImpactTier.Heavy, Sfx = SfxKind.Kick,
                Startup = 11, Active = 4, Recovery = 18, Damage = 85, HitStun = 23, BlockStun = 13, Knockback = 1.6f, Reach = 1.1f,
                Lunge = 0.6f, MeterOnHit = 12, ChainKick = "k2", Muscles = MuscleGroup.Quadriceps | MuscleGroup.Gluteus });
            d.Add(new MoveData { Id = "k1", DisplayName = "미들 킥", Kind = MoveKind.Kick, Pose = AttackPose.Roundhouse, Limb = Limb.RightFoot,
                Impact = ImpactTier.Medium, Sfx = SfxKind.Kick,
                Startup = 8, Active = 4, Recovery = 14, Damage = 60, HitStun = 19, BlockStun = 11, Knockback = 0.9f, Reach = 1.3f, HitHeight = 1.0f,
                Lunge = 0.28f, ChainKick = "k2", ChainHeavy = "h1", Muscles = MuscleGroup.Quadriceps | MuscleGroup.Gluteus });
            d.Add(new MoveData { Id = "k2", DisplayName = "라이징 킥", Kind = MoveKind.Launcher, Pose = AttackPose.LaunchKick, Limb = Limb.RightFoot,
                Impact = ImpactTier.Heavy, Sfx = SfxKind.Kick,
                Startup = 11, Active = 4, Recovery = 16, Damage = 52, HitStun = 30, BlockStun = 12, Knockback = 0.5f, Launch = 7.0f, Reach = 1.05f, HitHeight = 1.2f,
                Lunge = 0.25f, MeterOnHit = 10, Muscles = MuscleGroup.Quadriceps | MuscleGroup.Gluteus | MuscleGroup.Core });
            d.Add(new MoveData { Id = "grab", DisplayName = "잡기", Kind = MoveKind.Grab, Pose = AttackPose.Grab, Limb = Limb.Body, Sfx = SfxKind.Grab,
                Startup = 7, Active = 3, Recovery = 26, Damage = 0, Reach = 0.85f, Radius = 0.5f, Unblockable = true });
            d.Add(new MoveData { Id = "throw", DisplayName = "스피드 스윕 스로우", Kind = MoveKind.Throw, Pose = AttackPose.Throw, Limb = Limb.Body,
                Impact = ImpactTier.Heavy, Sfx = SfxKind.Heavy, Damage = 115, Knockback = 2.2f, Knockdown = true, Unblockable = true, MeterOnHit = 15,
                Muscles = MuscleGroup.Hamstrings | MuscleGroup.Gluteus | MuscleGroup.Core });
            d.Add(new MoveData { Id = "counter", DisplayName = "카운터 자세", Kind = MoveKind.Counter, Pose = AttackPose.CounterPalm, Limb = Limb.Body,
                Startup = 2, Active = 18, Recovery = 20 });
            d.Add(new MoveData { Id = "counterStrike", DisplayName = "퍼펙트 카운터", Kind = MoveKind.CounterStrike, Pose = AttackPose.LaunchKick, Limb = Limb.RightFoot,
                Impact = ImpactTier.Heavy, Sfx = SfxKind.Kick, Startup = 4, Active = 5, Recovery = 16, Lunge = 0.6f, Damage = 110, HitStun = 34, Knockback = 1.0f, Launch = 6.5f,
                Reach = 1.1f, Radius = 0.7f, MeterOnHit = 20, Muscles = MuscleGroup.Quadriceps | MuscleGroup.Hamstrings });
            d.Add(new MoveData { Id = "special", DisplayName = d.SpecialName, Kind = MoveKind.Special, Pose = AttackPose.Roundhouse, Limb = Limb.RightFoot,
                Impact = ImpactTier.Heavy, Sfx = SfxKind.Kick,
                Startup = 12, Active = 20, Recovery = 22, Damage = 40, HitStun = 22, BlockStun = 10, Knockback = 0.3f, Reach = 1.25f, Radius = 0.65f,
                Lunge = 3.0f, Hits = 5, HitInterval = 4, MeterCost = 100, MeterOnHit = 0, ChainSpecial = null,
                Muscles = MuscleGroup.Gluteus | MuscleGroup.Hamstrings, MuscleCaption = "큰볼기근 + 넙다리두갈래근·반막근  ·  Gluteus Maximus + Hamstrings" });
            d.Add(new MoveData { Id = "ultimate", DisplayName = d.UltimateName, Kind = MoveKind.Ultimate, Pose = AttackPose.UltimateBurst, Limb = Limb.RightFoot,
                Impact = ImpactTier.Ultimate, Sfx = SfxKind.Kick,
                Startup = 18, Active = 32, Recovery = 26, Damage = 44, HitStun = 40, BlockStun = 14, Knockback = 0.25f, Reach = 1.2f, Radius = 0.75f,
                Lunge = 2.6f, Hits = 7, HitInterval = 4, MeterCost = 300, MeterOnHit = 0, ChainSpecial = null,
                Muscles = MuscleGroup.Quadriceps | MuscleGroup.Gluteus | MuscleGroup.Hamstrings,
                MuscleCaption = "넙다리곧은근·넓은근 + 큰볼기근 + 넙다리두갈래근" });
            return d;
        }
    }
}
