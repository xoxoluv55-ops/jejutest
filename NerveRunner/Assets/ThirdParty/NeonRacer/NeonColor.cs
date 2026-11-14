// Reused from Neon Racer (https://github.com/pinchasVaknin/neon-racer, commit 090f15b), MIT License,
// Copyright (c) 2026 Pinchas Vaknin. See LICENSE.txt in this folder.
// Status: copied UNMODIFIED.

using UnityEngine;

namespace NeonRacer
{
    /// Pure, stateless colour helpers. Replaces the old GameDB.Hex(int) so inline
    /// hex colours can be authored without any global singleton. No mutable state.
    public static class NeonColor
    {
        /// 0xRRGGBB -> opaque Color.
        public static Color Hex(int rgb)
        {
            float r = ((rgb >> 16) & 0xFF) / 255f;
            float g = ((rgb >> 8) & 0xFF) / 255f;
            float b = (rgb & 0xFF) / 255f;
            return new Color(r, g, b, 1f);
        }

        /// Color -> "RRGGBB" (no leading '#'), handy for TMP <color> rich-text tags.
        public static string ToHex(Color c)
        {
            int r = Mathf.Clamp(Mathf.RoundToInt(c.r * 255f), 0, 255);
            int g = Mathf.Clamp(Mathf.RoundToInt(c.g * 255f), 0, 255);
            int b = Mathf.Clamp(Mathf.RoundToInt(c.b * 255f), 0, 255);
            return r.ToString("X2") + g.ToString("X2") + b.ToString("X2");
        }
    }
}
