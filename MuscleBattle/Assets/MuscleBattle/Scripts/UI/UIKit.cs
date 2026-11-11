using UnityEngine;
using UnityEngine.UI;

namespace MuscleBattle
{
    /// <summary>
    /// Small uGUI factory so every screen is built from code with consistent MUSCLE BATTLE styling:
    /// big bold text with outlines (never small grey text, §53), slanted panels, neon edges.
    /// </summary>
    public static class UIKit
    {
        static Sprite _round, _roundO, _circle, _circleO, _para, _paraO, _gradH, _gradV, _glow, _white, _bar;
        public static Sprite Round => _round ??= MBAssets.SpriteFrom(ProceduralTextures.RoundRect, 16);
        public static Sprite RoundOutline => _roundO ??= MBAssets.SpriteFrom(ProceduralTextures.RoundRectOutline, 16);
        public static Sprite Circle => _circle ??= MBAssets.SpriteFrom(ProceduralTextures.Circle);
        public static Sprite CircleOutline => _circleO ??= MBAssets.SpriteFrom(ProceduralTextures.CircleOutline);
        public static Sprite Para => _para ??= MBAssets.SpriteFrom(ProceduralTextures.Parallelogram);
        public static Sprite ParaOutline => _paraO ??= MBAssets.SpriteFrom(ProceduralTextures.ParallelogramOutline);
        public static Sprite GradH => _gradH ??= MBAssets.SpriteFrom(ProceduralTextures.GradientH);
        public static Sprite GradV => _gradV ??= MBAssets.SpriteFrom(ProceduralTextures.GradientV);
        public static Sprite Glow => _glow ??= MBAssets.SpriteFrom(ProceduralTextures.SoftGlow);
        public static Sprite White => _white ??= MBAssets.SpriteFrom(ProceduralTextures.White);
        public static Sprite Bar => _bar ??= MBAssets.SpriteFrom(ProceduralTextures.BarFill);

        public static Canvas CreateCanvas(string name, int order, Transform parent = null)
        {
            var go = new GameObject(name);
            if (parent != null) go.transform.SetParent(parent, false);
            var canvas = go.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = order;
            var scaler = go.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1920, 1080);
            scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.MatchWidthOrHeight;
            scaler.matchWidthOrHeight = 1f;
            return canvas;
        }

        public static RectTransform Node(string name, Transform parent)
        {
            var go = new GameObject(name, typeof(RectTransform));
            var rt = (RectTransform)go.transform;
            rt.SetParent(parent, false);
            return rt;
        }

        /// <summary>Anchor at a single point (0..1), pivot, position offset and size.</summary>
        public static RectTransform Place(this RectTransform rt, Vector2 anchor, Vector2 pivot, Vector2 pos, Vector2 size)
        {
            rt.anchorMin = rt.anchorMax = anchor;
            rt.pivot = pivot;
            rt.anchoredPosition = pos;
            rt.sizeDelta = size;
            return rt;
        }

        public static RectTransform Stretch(this RectTransform rt, float inset = 0)
        {
            rt.anchorMin = Vector2.zero;
            rt.anchorMax = Vector2.one;
            rt.pivot = new Vector2(0.5f, 0.5f);
            rt.offsetMin = new Vector2(inset, inset);
            rt.offsetMax = new Vector2(-inset, -inset);
            return rt;
        }

        public static Image Img(Transform parent, string name, Sprite sprite, Color color, bool raycast = false)
        {
            var rt = Node(name, parent);
            var img = rt.gameObject.AddComponent<Image>();
            img.sprite = sprite;
            img.color = color;
            img.raycastTarget = raycast;
            if (sprite != null && sprite.border.sqrMagnitude > 0) img.type = Image.Type.Sliced;
            return img;
        }

        public static RawImage Raw(Transform parent, string name, Texture tex)
        {
            var rt = Node(name, parent);
            var img = rt.gameObject.AddComponent<RawImage>();
            img.texture = tex;
            img.raycastTarget = false;
            return img;
        }

        public static Text Label(Transform parent, string text, int size, Color color, TextAnchor align = TextAnchor.MiddleCenter,
            bool heavy = true, bool outline = true, bool italic = false)
        {
            var rt = Node("Text", parent);
            var t = rt.gameObject.AddComponent<Text>();
            t.font = heavy ? MBAssets.FontHeavy : MBAssets.FontBold;
            t.text = text;
            t.fontSize = size;
            t.color = color;
            t.alignment = align;
            t.horizontalOverflow = HorizontalWrapMode.Overflow;
            t.verticalOverflow = VerticalWrapMode.Overflow;
            t.raycastTarget = false;
            t.supportRichText = true;
            if (italic) t.fontStyle = FontStyle.Italic;
            if (outline)
            {
                var o = rt.gameObject.AddComponent<Outline>();
                o.effectColor = new Color(0.03f, 0.01f, 0.08f, 0.95f);
                o.effectDistance = new Vector2(Mathf.Max(1.5f, size * 0.05f), -Mathf.Max(1.5f, size * 0.05f));
                if (size >= 40)
                {
                    var sh = rt.gameObject.AddComponent<Shadow>();
                    sh.effectColor = new Color(0, 0, 0, 0.6f);
                    sh.effectDistance = new Vector2(size * 0.06f, -size * 0.08f);
                }
            }
            return t;
        }

        /// <summary>Glass panel with a neon edge (concept-art info panels).</summary>
        public static RectTransform Panel(Transform parent, string name, Color edge, float alpha = 0.82f)
        {
            var bg = Img(parent, name, Round, Palette.Panel.WithAlpha(alpha));
            var rt = bg.rectTransform;
            var line = Img(rt, "Edge", RoundOutline, edge);
            line.rectTransform.Stretch(-2);
            var top = Img(rt, "TopGlow", GradV, edge.WithAlpha(0.18f));
            top.rectTransform.anchorMin = new Vector2(0, 0.6f);
            top.rectTransform.anchorMax = Vector2.one;
            top.rectTransform.offsetMin = top.rectTransform.offsetMax = Vector2.zero;
            return rt;
        }

        /// <summary>Slanted header plate (e.g. "매치 결과").</summary>
        public static RectTransform SlantPlate(Transform parent, string text, int size, Color fill, Color textColor, Vector2 anchor, Vector2 pos, Vector2 dims)
        {
            var bg = Img(parent, "Plate", Para, fill);
            bg.rectTransform.Place(anchor, new Vector2(0.5f, 0.5f), pos, dims);
            var edge = Img(bg.rectTransform, "Edge", ParaOutline, Color.Lerp(fill, Color.white, 0.5f));
            edge.rectTransform.Stretch(-2);
            var t = Label(bg.rectTransform, text, size, textColor);
            t.rectTransform.Stretch();
            return bg.rectTransform;
        }

        public static void SetAlpha(this Graphic g, float a)
        {
            var c = g.color;
            c.a = a;
            g.color = c;
        }
    }
}
