using System.Collections.Generic;
using UnityEngine;

namespace MuscleBattle
{
    public enum HairStyle { ShortSpiky, SlickBack, Ponytail, Braids, Buzz }
    public enum FightStyle { Rehab, Performance, Mobility, Balance, Power, Neuro }

    /// <summary>How a fighter idles on the character select screen (§20): personality readable at a glance.</summary>
    public enum SelectPersonality { Confident, Power, Calm, Flexible }

    /// <summary>Short label + icon (character select chips / skill rows). Icon keys: see ProceduralTextures.Icon.</summary>
    public struct IconLabel
    {
        public string Label;
        public string Sub;
        public string Icon;
        public IconLabel(string label, string icon, string sub = null) { Label = label; Icon = icon; Sub = sub; }
    }

    /// <summary>
    /// Everything that defines a fighter: identity, look, stats and move list.
    /// A future high quality Humanoid model plugs in via <see cref="ModelResourcePath"/>
    /// without touching combat code.
    /// </summary>
    public sealed class FighterDefinition
    {
        public string Id;
        public string NameEn;
        public string NameKo;
        public string RoleKo;
        public string RoleEn;
        public string Quote;
        public string IntroLine;
        public string WinLine;
        public FightStyle Style;
        public int Level = 12;
        public int Difficulty = 2; // 1..5

        // stats 1..10 (character select)
        public int Power, Speed, Technique, Reach, Durability;
        public int Defense = 5, Knowledge = 5;  // character select stat bars: POWER / SPEED / TECHNIQUE / DEFENSE / KNOWLEDGE
        public string[] Specialties;

        // character select presentation (§5-§8, §19-§21)
        public string ShortRole;                 // "SPORTS PT"
        public IconLabel[] Traits;               // 3 specialty icons
        public IconLabel[] SignatureSkills;      // 3 representative skills
        public SelectPersonality Personality;
        public string ThemeSfx;                  // SFX played when the cursor lands on this fighter
        public string LockVoice;                 // Voice/ line on lock-in
        public string UnlockCondition;           // locked roster only
        public bool Locked;                      // locked roster only (silhouette, cannot be picked)

        // gameplay
        public float MaxHp = 1000;
        public float WalkSpeed = 2.6f;
        public float BackSpeed = 2.0f;
        public float SidestepSpeed = 2.4f;
        public float DodgeDistance = 1.6f;
        public float DamageTaken = 1f;
        public float BodyRadius = 0.42f;

        // look (procedural rig)
        public float Height = 1.0f;     // scale
        public float Bulk = 1.0f;       // muscle mass
        public Color Skin, Hair, Top, TopAccent, Pants, PantsAccent, Shoes, Gloves, Energy, EnergyAlt;
        public HairStyle HairStyle;
        public bool Female;
        public bool SleevelessTop;
        public string ChestMark;        // "PT", "SC"...

        /// <summary>Optional Resources path of a rigged Humanoid prefab (future art pass).</summary>
        public string ModelResourcePath;

        public readonly Dictionary<string, MoveData> Moves = new Dictionary<string, MoveData>();

        public string SpecialName;
        public string SpecialNameEn;
        public string UltimateName;
        public string UltimateNameEn;
        public string SignatureMuscles;

        public MoveData Move(string id) => id != null && Moves.TryGetValue(id, out var m) ? m : null;

        public void Add(MoveData m) { Moves[m.Id] = m; }
    }
}
