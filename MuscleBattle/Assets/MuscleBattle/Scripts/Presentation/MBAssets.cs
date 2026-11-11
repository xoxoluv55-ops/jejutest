using System.Collections.Generic;
using UnityEngine;

namespace MuscleBattle
{
    /// <summary>
    /// Central place for runtime-created materials, fonts and textures so everything
    /// is cached (no per-hit allocations) and shaders have safe fallbacks.
    /// </summary>
    public static class MBAssets
    {
        static Shader _toon, _additive, _hologram, _floor;
        static Font _fontBold, _fontHeavy;
        static readonly Dictionary<string, Material> _mats = new Dictionary<string, Material>();

        public static Shader Toon => _toon ??= Find("MuscleBattle/Toon", "Standard");
        public static Shader Additive => _additive ??= Find("MuscleBattle/Additive", "Sprites/Default");
        public static Shader Hologram => _hologram ??= Find("MuscleBattle/Hologram", "Sprites/Default");
        public static Shader Floor => _floor ??= Find("MuscleBattle/Floor", "Standard");

        static Material _text3D;

        /// <summary>Depth-tested material for world-space TextMesh (chest logos, arena signs).</summary>
        public static Material Text3D(Font font)
        {
            if (_text3D != null) return _text3D;
            var shader = Shader.Find("MuscleBattle/Text3D");
            if (shader == null) return font.material;
            _text3D = new Material(shader) { mainTexture = font.material.mainTexture };
            Font.textureRebuilt += f => { if (f == font && _text3D != null) _text3D.mainTexture = f.material.mainTexture; };
            return _text3D;
        }

        /// <summary>NanumSquare ExtraBold - Korean + Latin, OFL licensed, bundled for WebGL (no OS fallback fonts there).</summary>
        public static Font FontHeavy => _fontHeavy ??= Resources.Load<Font>("Fonts/NanumSquareEB") ?? Font.CreateDynamicFontFromOSFont("Arial", 32);
        public static Font FontBold => _fontBold ??= Resources.Load<Font>("Fonts/NanumSquareB") ?? FontHeavy;

        static Shader Find(string name, string fallback)
        {
            var s = Shader.Find(name);
            if (s == null)
            {
                Debug.LogWarning($"[MuscleBattle] Shader '{name}' not found, using '{fallback}'.");
                s = Shader.Find(fallback);
            }
            return s;
        }

        public static Material ToonMaterial(Color color, Color rim, float rimPower = 3f, float gloss = 0.25f, Color? emission = null)
        {
            var m = new Material(Toon);
            m.SetColor("_Color", color);
            m.SetColor("_RimColor", rim);
            m.SetFloat("_RimPower", rimPower);
            m.SetFloat("_Gloss", gloss);
            m.SetColor("_Emission", emission ?? Color.black);
            m.SetColor("_ShadeColor", new Color(0.55f, 0.5f, 0.8f));
            if (m.HasProperty("_Glossiness")) m.SetFloat("_Glossiness", gloss); // Standard fallback
            if (emission.HasValue && m.HasProperty("_EmissionColor"))
            {
                m.EnableKeyword("_EMISSION");
                m.SetColor("_EmissionColor", emission.Value);
            }
            return m;
        }

        public static Material AdditiveMaterial(Texture tex, Color tint, float intensity = 1.5f)
        {
            var m = new Material(Additive) { mainTexture = tex };
            m.SetColor("_TintColor", tint);
            m.SetFloat("_Intensity", intensity);
            if (m.HasProperty("_Color")) m.SetColor("_Color", tint);
            return m;
        }

        /// <summary>Cached additive material keyed by texture name (shared by pooled particle systems).</summary>
        public static Material SharedAdditive(string key, Texture tex)
        {
            if (_mats.TryGetValue(key, out var m) && m != null) return m;
            m = AdditiveMaterial(tex, Color.white, 1.6f);
            _mats[key] = m;
            return m;
        }

        public static Material HologramMaterial(Color color, float alpha = 1f, Texture tex = null, float lineDensity = 60f)
        {
            var m = new Material(Hologram);
            if (tex != null) m.mainTexture = tex;
            m.SetColor("_Color", color);
            m.SetFloat("_Alpha", alpha);
            m.SetFloat("_LineDensity", lineDensity);
            return m;
        }

        public static Sprite SpriteFrom(Texture2D tex, float border = 0)
        {
            var b = border > 0 ? new Vector4(border, border, border, border) : Vector4.zero;
            return Sprite.Create(tex, new Rect(0, 0, tex.width, tex.height), new Vector2(0.5f, 0.5f), 100f, 0, SpriteMeshType.FullRect, b);
        }
    }
}
