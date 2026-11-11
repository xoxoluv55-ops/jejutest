using System.Collections.Generic;
using UnityEngine;

namespace MuscleBattle
{
    /// <summary>
    /// Roster + frame data. Vertical slice = 2 fighters (master prompt §59):
    ///   Jin Hyun  - Sports Physical Therapist (fast, balanced)
    ///   Ray Castillo - Strength Coach (slow, heavy, armored special)
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

        public static FighterDefinition Get(string id)
        {
            foreach (var f in All) if (f.Id == id) return f;
            return All[0];
        }

        static List<FighterDefinition> Build() => new List<FighterDefinition> { JinHyun(), RayCastillo() };

        // ------------------------------------------------------------------
        static FighterDefinition JinHyun()
        {
            var d = new FighterDefinition
            {
                Id = "jin", NameEn = "JIN HYUN", NameKo = "진현", Level = 12, Difficulty = 2,
                RoleKo = "운동물리치료사", RoleEn = "Sports Physical Therapist",
                Quote = "\"움직임을 치료하고, 더 강하게 만든다!\"",
                IntroLine = "\"재활은 끝났다. 이제 실전이다!\"",
                WinLine = "\"또 한 번 이겼다! 다음엔 더 강한 상대를!\"",
                Style = FightStyle.Rehab,
                Power = 8, Speed = 7, Technique = 8, Reach = 7, Durability = 9,
                Specialties = new[] { "근골격 재활", "기능 회복", "운동처방" },
                MaxHp = 1000, WalkSpeed = 2.8f, BackSpeed = 2.2f, SidestepSpeed = 2.7f, DodgeDistance = 1.8f,
                Height = 1.0f, Bulk = 1.0f,
                Skin = new Color(0.96f, 0.80f, 0.68f), Hair = new Color(0.08f, 0.07f, 0.09f),
                Top = new Color(0.95f, 0.95f, 0.97f), TopAccent = new Color(0.85f, 0.08f, 0.14f),
                Pants = new Color(0.10f, 0.09f, 0.13f), PantsAccent = new Color(0.85f, 0.08f, 0.14f),
                Shoes = new Color(0.95f, 0.95f, 0.95f), Gloves = new Color(0.12f, 0.12f, 0.14f),
                Energy = Palette.Nerve, EnergyAlt = Palette.Mastery,
                HairStyle = HairStyle.ShortSpiky, ChestMark = "PT",
                ModelResourcePath = "Characters/jin", // VRoid VRM -> Resources/Characters/jin (see docs/CHARACTER_PIPELINE.md)
                SpecialName = "숄더 어브덕션 러시", SpecialNameEn = "Shoulder Abduction Rush",
                UltimateName = "스캐퓰러 포스 커플", UltimateNameEn = "Scapular Force Couple",
                SignatureMuscles = "삼각근 + 극상근 (Deltoid + Supraspinatus)",
            };

            d.Add(new MoveData { Id = "l1", DisplayName = "잽", Kind = MoveKind.Light, Pose = AttackPose.Jab, Limb = Limb.LeftHand,
                Startup = 6, Active = 2, Recovery = 9, Damage = 35, HitStun = 15, BlockStun = 9, Knockback = 0.35f, Reach = 0.95f,
                Lunge = 0.15f, ChainLight = "l2", ChainHeavy = "h1", ChainKick = "k1", Muscles = MuscleGroup.Triceps | MuscleGroup.Deltoid });
            d.Add(new MoveData { Id = "l2", DisplayName = "크로스", Kind = MoveKind.Light, Pose = AttackPose.Cross, Limb = Limb.RightHand,
                Startup = 7, Active = 3, Recovery = 11, Damage = 40, HitStun = 16, BlockStun = 9, Knockback = 0.4f, Reach = 1.05f,
                Lunge = 0.2f, ChainLight = "l3", ChainHeavy = "h1", ChainKick = "k1", Muscles = MuscleGroup.Pectoralis | MuscleGroup.Triceps });
            d.Add(new MoveData { Id = "l3", DisplayName = "훅", Kind = MoveKind.Light, Pose = AttackPose.Hook, Limb = Limb.LeftHand, Impact = ImpactTier.Medium,
                Startup = 10, Active = 3, Recovery = 16, Damage = 60, HitStun = 20, BlockStun = 11, Knockback = 1.0f, Reach = 1.0f,
                Lunge = 0.3f, ChainKick = "k2", Muscles = MuscleGroup.Pectoralis | MuscleGroup.Core });
            d.Add(new MoveData { Id = "h1", DisplayName = "파워 스트레이트", Kind = MoveKind.Heavy, Pose = AttackPose.Cross, Limb = Limb.RightHand,
                Impact = ImpactTier.Heavy, Sfx = SfxKind.Heavy,
                Startup = 13, Active = 4, Recovery = 20, Damage = 95, HitStun = 24, BlockStun = 14, Knockback = 1.7f, Reach = 1.15f,
                Lunge = 0.55f, MeterOnHit = 12, ChainKick = "k2", Muscles = MuscleGroup.Pectoralis | MuscleGroup.Triceps | MuscleGroup.Deltoid });
            d.Add(new MoveData { Id = "k1", DisplayName = "미들 킥", Kind = MoveKind.Kick, Pose = AttackPose.Roundhouse, Limb = Limb.RightFoot,
                Impact = ImpactTier.Medium, Sfx = SfxKind.Kick,
                Startup = 10, Active = 4, Recovery = 16, Damage = 65, HitStun = 19, BlockStun = 11, Knockback = 0.9f, Reach = 1.25f, HitHeight = 1.0f,
                Lunge = 0.25f, ChainKick = "k2", ChainHeavy = "h1", Muscles = MuscleGroup.Quadriceps | MuscleGroup.Gluteus });
            d.Add(new MoveData { Id = "k2", DisplayName = "런치 킥", Kind = MoveKind.Launcher, Pose = AttackPose.LaunchKick, Limb = Limb.RightFoot,
                Impact = ImpactTier.Heavy, Sfx = SfxKind.Kick,
                Startup = 12, Active = 4, Recovery = 17, Damage = 55, HitStun = 30, BlockStun = 12, Knockback = 0.5f, Launch = 6.8f, Reach = 1.0f, HitHeight = 1.2f,
                Lunge = 0.2f, MeterOnHit = 10, Muscles = MuscleGroup.Quadriceps | MuscleGroup.Gluteus | MuscleGroup.Core });
            d.Add(new MoveData { Id = "grab", DisplayName = "잡기", Kind = MoveKind.Grab, Pose = AttackPose.Grab, Limb = Limb.Body, Sfx = SfxKind.Grab,
                Startup = 8, Active = 3, Recovery = 28, Damage = 0, Reach = 0.85f, Radius = 0.5f, Unblockable = true });
            d.Add(new MoveData { Id = "throw", DisplayName = "PT 리커버리 스로우", Kind = MoveKind.Throw, Pose = AttackPose.Throw, Limb = Limb.Body,
                Impact = ImpactTier.Heavy, Sfx = SfxKind.Heavy, Damage = 130, Knockback = 2.2f, Knockdown = true, Unblockable = true, MeterOnHit = 15,
                Muscles = MuscleGroup.Latissimus | MuscleGroup.Biceps | MuscleGroup.Core });
            d.Add(new MoveData { Id = "counter", DisplayName = "카운터 자세", Kind = MoveKind.Counter, Pose = AttackPose.CounterPalm, Limb = Limb.Body,
                Startup = 2, Active = 18, Recovery = 22 });
            d.Add(new MoveData { Id = "counterStrike", DisplayName = "퍼펙트 카운터", Kind = MoveKind.CounterStrike, Pose = AttackPose.Uppercut, Limb = Limb.RightHand,
                Impact = ImpactTier.Heavy, Sfx = SfxKind.Heavy, Startup = 4, Active = 5, Recovery = 18, Lunge = 0.6f, Damage = 120, HitStun = 34, Knockback = 1.2f, Launch = 6.0f,
                Reach = 1.1f, Radius = 0.7f, MeterOnHit = 20, Muscles = MuscleGroup.Biceps | MuscleGroup.Deltoid });
            d.Add(new MoveData { Id = "special", DisplayName = d.SpecialName, Kind = MoveKind.Special, Pose = AttackPose.ShoulderRush, Limb = Limb.RightHand,
                Impact = ImpactTier.Heavy, Sfx = SfxKind.Heavy,
                Startup = 14, Active = 18, Recovery = 24, Damage = 48, HitStun = 22, BlockStun = 10, Knockback = 0.35f, Reach = 1.0f, Radius = 0.6f,
                Lunge = 3.0f, Hits = 4, HitInterval = 4, MeterCost = 100, MeterOnHit = 0, ChainSpecial = null,
                Muscles = MuscleGroup.Deltoid | MuscleGroup.Supraspinatus, MuscleCaption = "삼각근 + 극상근  ·  Deltoid + Supraspinatus" });
            d.Add(new MoveData { Id = "ultimate", DisplayName = d.UltimateName, Kind = MoveKind.Ultimate, Pose = AttackPose.UltimateBurst, Limb = Limb.RightHand,
                Impact = ImpactTier.Ultimate, Sfx = SfxKind.Heavy,
                Startup = 20, Active = 30, Recovery = 30, Damage = 52, HitStun = 40, BlockStun = 14, Knockback = 0.25f, Reach = 1.15f, Radius = 0.75f,
                Lunge = 2.4f, Hits = 6, HitInterval = 5, MeterCost = 300, MeterOnHit = 0, ChainSpecial = null,
                Muscles = MuscleGroup.Trapezius | MuscleGroup.SerratusAnterior | MuscleGroup.Deltoid,
                MuscleCaption = "상부·하부 승모근 + 전거근  ·  Trapezius + Serratus Anterior" });
            return d;
        }

        // ------------------------------------------------------------------
        static FighterDefinition RayCastillo()
        {
            var d = new FighterDefinition
            {
                Id = "ray", NameEn = "RAY CASTILLO", NameKo = "레이 카스티요", Level = 13, Difficulty = 3,
                RoleKo = "스트렝스 코치", RoleEn = "Strength & Conditioning Coach",
                Quote = "\"무게는 거짓말하지 않는다!\"",
                IntroLine = "\"후방 사슬의 힘을 보여주지!\"",
                WinLine = "\"근력은 정직하다. 다음 세트!\"",
                Style = FightStyle.Power,
                Power = 10, Speed = 5, Technique = 6, Reach = 8, Durability = 9,
                Specialties = new[] { "근력 강화", "파워 리프팅", "후방 사슬" },
                MaxHp = 1100, WalkSpeed = 2.2f, BackSpeed = 1.8f, SidestepSpeed = 2.1f, DodgeDistance = 1.4f, BodyRadius = 0.5f,
                Height = 1.06f, Bulk = 1.35f,
                Skin = new Color(0.80f, 0.58f, 0.42f), Hair = new Color(0.95f, 0.82f, 0.45f),
                Top = new Color(0.10f, 0.10f, 0.12f), TopAccent = new Color(1.0f, 0.78f, 0.10f),
                Pants = new Color(0.12f, 0.12f, 0.14f), PantsAccent = new Color(1.0f, 0.78f, 0.10f),
                Shoes = new Color(0.12f, 0.12f, 0.12f), Gloves = new Color(0.10f, 0.10f, 0.10f),
                Energy = Palette.MuscleHot, EnergyAlt = Palette.Muscle,
                HairStyle = HairStyle.SlickBack, SleevelessTop = true, ChestMark = "SC",
                ModelResourcePath = "Characters/ray",
                SpecialName = "데드리프트 브레이커", SpecialNameEn = "Deadlift Breaker",
                UltimateName = "포스테리어 체인 슬램", UltimateNameEn = "Posterior Chain Slam",
                SignatureMuscles = "대둔근 + 햄스트링 (Gluteus Maximus + Hamstrings)",
            };

            d.Add(new MoveData { Id = "l1", DisplayName = "헤비 잽", Kind = MoveKind.Light, Pose = AttackPose.Jab, Limb = Limb.LeftHand,
                Startup = 8, Active = 3, Recovery = 11, Damage = 45, HitStun = 16, BlockStun = 10, Knockback = 0.45f, Reach = 1.05f,
                Lunge = 0.12f, ChainLight = "l2", ChainHeavy = "h1", ChainKick = "k1", Muscles = MuscleGroup.Triceps | MuscleGroup.Deltoid });
            d.Add(new MoveData { Id = "l2", DisplayName = "해머 훅", Kind = MoveKind.Light, Pose = AttackPose.Hook, Limb = Limb.RightHand, Impact = ImpactTier.Medium,
                Startup = 9, Active = 3, Recovery = 13, Damage = 52, HitStun = 17, BlockStun = 10, Knockback = 0.55f, Reach = 1.05f,
                Lunge = 0.18f, ChainLight = "l3", ChainHeavy = "h1", Muscles = MuscleGroup.Pectoralis | MuscleGroup.Latissimus });
            d.Add(new MoveData { Id = "l3", DisplayName = "바벨 어퍼", Kind = MoveKind.Light, Pose = AttackPose.Uppercut, Limb = Limb.LeftHand, Impact = ImpactTier.Heavy,
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
            d.Add(new MoveData { Id = "special", DisplayName = d.SpecialName, Kind = MoveKind.Special, Pose = AttackPose.Slam, Limb = Limb.RightHand,
                Impact = ImpactTier.Heavy, Sfx = SfxKind.Heavy,
                Startup = 18, Active = 5, Recovery = 26, Damage = 200, HitStun = 30, BlockStun = 18, Knockback = 2.6f, Knockdown = true, Reach = 1.25f, Radius = 0.7f,
                Lunge = 1.2f, Armor = true, MeterCost = 100, MeterOnHit = 0, ChainSpecial = null,
                Muscles = MuscleGroup.Gluteus | MuscleGroup.Hamstrings | MuscleGroup.Core,
                MuscleCaption = "대둔근 + 햄스트링  ·  Gluteus Maximus + Hamstrings" });
            d.Add(new MoveData { Id = "ultimate", DisplayName = d.UltimateName, Kind = MoveKind.Ultimate, Pose = AttackPose.UltimateBurst, Limb = Limb.RightHand,
                Impact = ImpactTier.Ultimate, Sfx = SfxKind.Heavy,
                Startup = 22, Active = 26, Recovery = 32, Damage = 70, HitStun = 40, BlockStun = 16, Knockback = 0.3f, Reach = 1.2f, Radius = 0.8f,
                Lunge = 1.8f, Hits = 5, HitInterval = 6, MeterCost = 300, MeterOnHit = 0, ChainSpecial = null,
                Muscles = MuscleGroup.Gluteus | MuscleGroup.Hamstrings | MuscleGroup.Latissimus | MuscleGroup.Trapezius,
                MuscleCaption = "후방 사슬 · 대둔근 + 햄스트링 + 광배근" });
            return d;
        }
    }
}
