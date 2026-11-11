using UnityEngine;

namespace MuscleBattle
{
    /// <summary>
    /// MUSCLE BATTLE visual language (master prompt §13).
    /// Muscle = red/orange fiber energy, Nerve = blue/cyan impulse,
    /// Bone = white/gold geometric hologram, Force Couple = multi-energy,
    /// Mastery = purple/gold accent. Every UI / VFX / stage colour comes from here.
    /// </summary>
    public static class Palette
    {
        // core energies
        public static readonly Color Muscle = new Color(1.00f, 0.32f, 0.12f);
        public static readonly Color MuscleHot = new Color(1.00f, 0.62f, 0.15f);
        public static readonly Color Nerve = new Color(0.20f, 0.85f, 1.00f);
        public static readonly Color NerveDeep = new Color(0.18f, 0.45f, 1.00f);
        public static readonly Color Bone = new Color(1.00f, 0.95f, 0.82f);
        public static readonly Color Gold = new Color(1.00f, 0.80f, 0.25f);
        public static readonly Color Mastery = new Color(0.66f, 0.30f, 1.00f);
        public static readonly Color MasteryPink = new Color(0.95f, 0.30f, 0.85f);

        // UI
        public static readonly Color Panel = new Color(0.05f, 0.04f, 0.14f, 0.82f);
        public static readonly Color PanelEdge = new Color(0.55f, 0.35f, 1.00f, 1f);
        public static readonly Color HpYellow = new Color(1.00f, 0.86f, 0.18f);
        public static readonly Color HpOrange = new Color(1.00f, 0.50f, 0.10f);
        public static readonly Color HpDamage = new Color(1.00f, 0.15f, 0.20f);
        public static readonly Color P1 = new Color(1.00f, 0.22f, 0.25f);
        public static readonly Color P2 = new Color(0.20f, 0.55f, 1.00f);
        public static readonly Color TextWhite = new Color(1f, 1f, 1f);
        public static readonly Color TextDim = new Color(0.78f, 0.80f, 0.95f);

        // stage
        public static readonly Color StageFloor = new Color(0.06f, 0.07f, 0.16f);
        public static readonly Color StageNeonA = new Color(0.55f, 0.30f, 1.00f);
        public static readonly Color StageNeonB = new Color(0.20f, 0.75f, 1.00f);
        public static readonly Color StageNeonC = new Color(1.00f, 0.25f, 0.55f);

        public static Color WithAlpha(this Color c, float a) { c.a = a; return c; }
        public static Color Hdr(this Color c, float intensity) => new Color(c.r * intensity, c.g * intensity, c.b * intensity, c.a);
        public static Color PlayerColor(int side) => side == 0 ? P1 : P2;
    }
}
