// Reused from Neon Racer (https://github.com/pinchasVaknin/neon-racer, commit 090f15b), MIT License,
// Copyright (c) 2026 Pinchas Vaknin. See LICENSE.txt in this folder.
// Status: copied UNMODIFIED.

using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace NeonRacer
{
    /// Creates materials that work in both the Built-in Render Pipeline and URP.
    ///
    /// EVERY material here is CACHED and shared. Procedural materials are never released by
    /// destroying the GameObjects that use them, so each track rebuild used to leave a full set
    /// of orphaned Materials behind (menu -> race -> menu ... climbing forever on a phone).
    /// Nothing in the project mutates a material it received - verified by grep - so sharing is
    /// safe, and identical requests now cost one dictionary lookup.
    public static class Mats
    {
        static bool _init;
        static bool _urp;
        static Shader _lit, _unlit;

        //================== SHADER PROPERTY IDS ==================\\
        // Resolved once. Names that a given pipeline does not have are silently ignored by
        // Unity, which is exactly why both the URP and Built-in spellings are always set.
        static readonly int ID_BaseColor = Shader.PropertyToID("_BaseColor");
        static readonly int ID_Color = Shader.PropertyToID("_Color");
        static readonly int ID_Metallic = Shader.PropertyToID("_Metallic");
        static readonly int ID_Smoothness = Shader.PropertyToID("_Smoothness");
        static readonly int ID_Glossiness = Shader.PropertyToID("_Glossiness");
        static readonly int ID_BaseMap = Shader.PropertyToID("_BaseMap");
        static readonly int ID_MainTex = Shader.PropertyToID("_MainTex");
        static readonly int ID_Cull = Shader.PropertyToID("_Cull");
        static readonly int ID_EmissionColor = Shader.PropertyToID("_EmissionColor");
        static readonly int ID_EmissionMap = Shader.PropertyToID("_EmissionMap");

        //================== CACHE ==================\\
        static readonly Dictionary<string, Material> cache = new Dictionary<string, Material>();

        // Keys are built from raw components on purpose. Color.ToString() rounds to three
        // decimals and its exact format is not part of Unity's contract, so leaning on it would
        // let two genuinely different paints collapse onto one cached material - every car in
        // the garage wearing the same shade, with nothing in the code to point at.
        static string K(Color c) { return c.r + "," + c.g + "," + c.b + "," + c.a; }
        static string K(Vector2 v) { return v.x + "," + v.y; }
        static string K(Texture t) { return t == null ? "0" : t.GetInstanceID().ToString(); }

        static Material Cached(string key, System.Func<Material> build)
        {
            Material m;
            if (cache.TryGetValue(key, out m) && m != null) return m;
            m = build();
            cache[key] = m;
            return m;
        }

        //================== PIPELINE DETECTION ==================\\
        static void Init()
        {
            if (_init) return;
            _lit = Shader.Find("Universal Render Pipeline/Lit");
            if (_lit != null) { _urp = true; }
            else { _lit = Shader.Find("Standard"); _urp = false; }
            _unlit = Shader.Find(_urp ? "Universal Render Pipeline/Unlit" : "Unlit/Color");
            if (_unlit == null) _unlit = Shader.Find("Sprites/Default");
            _init = true;
        }

        static void SetColor(Material m, Color c)
        {
            m.SetColor(ID_BaseColor, c);   // URP
            m.SetColor(ID_Color, c);       // Built-in
            m.color = c;
        }

        static void SetSmoothMetal(Material m, float metallic, float smooth)
        {
            m.SetFloat(ID_Metallic, metallic);
            m.SetFloat(ID_Smoothness, smooth);   // URP
            m.SetFloat(ID_Glossiness, smooth);   // Built-in Standard
        }

        static void SetTex(Material m, Texture tex, Vector2 tiling)
        {
            if (tex == null) return;
            m.SetTexture(ID_BaseMap, tex);  // URP
            m.SetTexture(ID_MainTex, tex);  // Built-in
            m.SetTextureScale("_BaseMap", tiling);
            m.SetTextureScale("_MainTex", tiling);
            m.mainTexture = tex;
            m.mainTextureScale = tiling;
        }

        //================== FACTORY METHODS ==================\\
        public static Material Lit(Color color, float metallic, float smooth)
        {
            return Cached("L|" + K(color) + "|" + metallic + "|" + smooth, () =>
            {
                Init();
                Material m = new Material(_lit);
                SetColor(m, color);
                SetSmoothMetal(m, metallic, smooth);
                return m;
            });
        }

        /// Untinted texture - the tinted overload with white is exactly the same material.
        public static Material Textured(Texture tex, Vector2 tiling, float metallic, float smooth, bool doubleSided)
        {
            return Textured(tex, tiling, metallic, smooth, doubleSided, Color.white);
        }

        // Textured + color tint (texture is multiplied by tint).
        public static Material Textured(Texture tex, Vector2 tiling, float metallic, float smooth, bool doubleSided, Color tint)
        {
            return Cached("T|" + K(tex) + "|" + K(tiling) + "|" + metallic + "|" + smooth + "|" + doubleSided + "|" + K(tint), () =>
            {
                Init();
                Material m = new Material(_lit);
                SetColor(m, tint);
                SetSmoothMetal(m, metallic, smooth);
                SetTex(m, tex, tiling);
                if (doubleSided) m.SetFloat(ID_Cull, (float)CullMode.Off); // URP Lit supports _Cull
                return m;
            });
        }

        public static Material Emissive(Color baseColor, Color emission)
        {
            return Cached("E|" + K(baseColor) + "|" + K(emission), () =>
            {
                Init();
                Material m = new Material(_lit);
                SetColor(m, baseColor);
                SetSmoothMetal(m, 0.2f, 0.4f);
                m.EnableKeyword("_EMISSION");
                m.SetColor(ID_EmissionColor, emission);
                m.globalIlluminationFlags = MaterialGlobalIlluminationFlags.RealtimeEmissive;
                return m;
            });
        }

        // Building material: base texture + emissive windows at night/sunset.
        public static Material Building(Texture tex, Vector2 tiling, Color emissionColor, float emissionIntensity)
        {
            return Cached("B|" + K(tex) + "|" + K(tiling) + "|" + K(emissionColor) + "|" + emissionIntensity, () =>
            {
                Init();
                Material m = new Material(_lit);
                SetColor(m, Color.white);
                SetSmoothMetal(m, 0.1f, 0.25f);
                SetTex(m, tex, tiling);
                if (emissionIntensity > 0f)
                {
                    m.EnableKeyword("_EMISSION");
                    m.SetColor(ID_EmissionColor, emissionColor * emissionIntensity);
                    m.SetTexture(ID_EmissionMap, tex);
                    m.globalIlluminationFlags = MaterialGlobalIlluminationFlags.RealtimeEmissive;
                }
                return m;
            });
        }

        public static Material Unlit(Color color)
        {
            return Cached("U|" + K(color), () =>
            {
                Init();
                Material m = new Material(_unlit);
                SetColor(m, color);
                return m;
            });
        }
    }
}
