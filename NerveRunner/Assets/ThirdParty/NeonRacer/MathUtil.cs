// Reused from Neon Racer (https://github.com/pinchasVaknin/neon-racer, commit 090f15b), MIT License,
// Copyright (c) 2026 Pinchas Vaknin. See LICENSE.txt in this folder.
// Status: copied UNMODIFIED.

using UnityEngine;

namespace NeonRacer
{
    public static class MathUtil
    {
        /// Move a toward b by at most maxDelta (same behaviour as the legacy Approach()).
        public static float Approach(float a, float b, float maxDelta)
        {
            if (a < b) return Mathf.Min(a + maxDelta, b);
            return Mathf.Max(a - maxDelta, b);
        }
    }
}
