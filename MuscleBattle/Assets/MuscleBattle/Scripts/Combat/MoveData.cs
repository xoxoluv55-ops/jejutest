using System;

namespace MuscleBattle
{
    public enum MoveKind { Light, Heavy, Kick, Launcher, Grab, Counter, Special, Ultimate, AirFollowup, CounterStrike, Throw }
    public enum Limb { RightHand, LeftHand, RightFoot, LeftFoot, Body }
    public enum ImpactTier { Light, Medium, Heavy, Ultimate }
    public enum SfxKind { Punch, Kick, Heavy, Grab }

    /// <summary>Muscle groups that can glow on the fighter body (master prompt §12).</summary>
    [Flags]
    public enum MuscleGroup
    {
        None = 0,
        Deltoid = 1 << 0,
        Supraspinatus = 1 << 1,
        Pectoralis = 1 << 2,
        Triceps = 1 << 3,
        Biceps = 1 << 4,
        Trapezius = 1 << 5,
        Latissimus = 1 << 6,
        Core = 1 << 7,
        Gluteus = 1 << 8,
        Quadriceps = 1 << 9,
        Hamstrings = 1 << 10,
        Gastrocnemius = 1 << 11,
        SerratusAnterior = 1 << 12,
        Infraspinatus = 1 << 13,   // + teres minor (posterior rotator cuff, external rotation)
    }

    /// <summary>Animation keys understood by FighterRig.</summary>
    public enum AttackPose { Jab, Cross, Hook, Uppercut, FrontKick, Roundhouse, LaunchKick, Grab, Throw, CounterPalm, ShoulderRush, Slam, UltimateBurst }

    /// <summary>
    /// Frame data for one move (60 fps frames). Pure data: tuned in CharacterDatabase.
    /// </summary>
    [Serializable]
    public sealed class MoveData
    {
        public string Id;
        public string DisplayName;
        public MoveKind Kind;
        public AttackPose Pose;
        public Limb Limb = Limb.RightHand;
        public ImpactTier Impact = ImpactTier.Light;
        public SfxKind Sfx = SfxKind.Punch;

        public int Startup = 6;
        public int Active = 3;
        public int Recovery = 10;

        public float Damage = 40;
        public int HitStun = 14;
        public int BlockStun = 8;
        public float Knockback = 0.6f;     // metres pushed on hit
        public float Launch;               // vertical velocity on hit (m/s), > 0 launches
        public bool Knockdown;
        public bool Unblockable;           // grabs
        public bool Armor;                 // absorbs hits during startup (super armor)

        public float Reach = 1.0f;         // hitbox centre distance in front of the attacker
        public float HitHeight = 1.3f;     // hitbox centre height
        public float Radius = 0.45f;
        public float Lunge;                // forward travel during startup+active (m)

        public int Hits = 1;               // multi-hit (specials)
        public int HitInterval = 4;

        public float MeterOnHit = 11;   // tuned so the first Muscle Skill bar arrives within a normal round
        public float MeterOnBlock = 3;
        public float MeterCost;            // 100 = one bar

        public string ChainLight;          // cancel routes during the cancel window
        public string ChainHeavy;
        public string ChainKick;
        public string ChainSpecial = "special";

        public MuscleGroup Muscles = MuscleGroup.None;
        public string MuscleCaption;       // e.g. "Deltoid + Supraspinatus"

        public int Total => Startup + Active + Recovery;
        public bool IsStrike => Kind != MoveKind.Counter && Kind != MoveKind.Grab;

        public MoveData Clone() => (MoveData)MemberwiseClone();
    }
}
