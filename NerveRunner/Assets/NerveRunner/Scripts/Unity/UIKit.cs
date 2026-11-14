// NERVE RUNNER - code-built UGUI helpers.
// Layout helpers (Rect/Place/Fill/Panel/Label/Button) follow the approach of Neon Racer's
// UIManager (MIT, every screen built in C#, no prefabs), rewritten for legacy UGUI Text so
// Korean renders through a dynamic OS font (Neon Racer's TMP font is Latin-1 only).
using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace NerveRunner
{
    public static class Pal
    {
        public static readonly Color Bg = Hex(0x0B0A24);
        public static readonly Color Panel = new Color(0.08f, 0.06f, 0.22f, 0.90f);
        public static readonly Color Card = new Color(0.14f, 0.11f, 0.34f, 0.95f);
        public static readonly Color CardLocked = new Color(0.10f, 0.09f, 0.20f, 0.92f);
        public static readonly Color Cyan = Hex(0x2EE6D6);
        public static readonly Color Blue = Hex(0x4D8DFF);
        public static readonly Color Purple = Hex(0x9B5CFF);
        public static readonly Color Pink = Hex(0xFF5CC8);
        public static readonly Color Yellow = Hex(0xFFD34D);
        public static readonly Color Gold = Hex(0xFFB627);
        public static readonly Color Red = Hex(0xFF4D6D);
        public static readonly Color Green = Hex(0x5CFF9D);
        public static readonly Color Text = new Color(0.95f, 0.94f, 1f);
        public static readonly Color Dim = new Color(0.68f, 0.66f, 0.86f);
        public static readonly Color Dark = new Color(0.09f, 0.05f, 0.12f);

        public static Color Hex(int rgb) { return NeonRacer.NeonColor.Hex(rgb); }
        public static Color A(Color c, float a) { c.a = a; return c; }
    }

    public static class UIKit
    {
        static Font font;
        static Sprite rounded, circle, softGlow;

        /// Dynamic OS font with Korean glyphs. iPad: Apple SD Gothic Neo. Editor on Windows:
        /// Malgun Gothic. Falls back to Unity's built-in font (Latin only) if none is found.
        public static Font Font
        {
            get
            {
                if (font != null) return font;
                string[] names = { "Apple SD Gothic Neo", "AppleSDGothicNeo-Bold", "AppleSDGothicNeo-Regular",
                                   "Noto Sans CJK KR", "Noto Sans KR", "NanumGothic", "Malgun Gothic", "Arial Unicode MS", "Arial" };
                try { font = Font.CreateDynamicFontFromOSFont(names, 32); } catch (Exception) { font = null; }
                if (font == null) font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
                return font;
            }
        }

        //================== GENERATED SPRITES ==================\\
        public static Sprite Rounded
        {
            get
            {
                if (rounded == null) rounded = MakeRounded(64, 18);
                return rounded;
            }
        }

        public static Sprite Circle
        {
            get
            {
                if (circle == null) circle = MakeRounded(128, 64);
                return circle;
            }
        }

        public static Sprite Glow
        {
            get
            {
                if (softGlow == null)
                {
                    const int S = 64;
                    var tex = new Texture2D(S, S, TextureFormat.RGBA32, false);
                    tex.wrapMode = TextureWrapMode.Clamp;
                    var px = new Color32[S * S];
                    for (int y = 0; y < S; y++)
                        for (int x = 0; x < S; x++)
                        {
                            float dx = (x + 0.5f) / S * 2f - 1f, dy = (y + 0.5f) / S * 2f - 1f;
                            float d = Mathf.Sqrt(dx * dx + dy * dy);
                            float a = Mathf.Clamp01(1f - d); a = a * a;
                            px[y * S + x] = new Color32(255, 255, 255, (byte)(a * 255));
                        }
                    tex.SetPixels32(px); tex.Apply();
                    softGlow = Sprite.Create(tex, new Rect(0, 0, S, S), new Vector2(0.5f, 0.5f), 100f);
                }
                return softGlow;
            }
        }

        static Sprite MakeRounded(int size, int radius)
        {
            var tex = new Texture2D(size, size, TextureFormat.RGBA32, false);
            tex.wrapMode = TextureWrapMode.Clamp;
            tex.filterMode = FilterMode.Bilinear;
            var px = new Color32[size * size];
            for (int y = 0; y < size; y++)
                for (int x = 0; x < size; x++)
                {
                    float cx = Mathf.Clamp(x + 0.5f, radius, size - radius);
                    float cy = Mathf.Clamp(y + 0.5f, radius, size - radius);
                    float d = Mathf.Sqrt((x + 0.5f - cx) * (x + 0.5f - cx) + (y + 0.5f - cy) * (y + 0.5f - cy));
                    float a = Mathf.Clamp01(radius - d + 0.5f);
                    px[y * size + x] = new Color32(255, 255, 255, (byte)(a * 255));
                }
            tex.SetPixels32(px); tex.Apply();
            float b = Mathf.Min(radius, size / 2 - 1);
            return Sprite.Create(tex, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), 100f, 0, SpriteMeshType.FullRect, new Vector4(b, b, b, b));
        }

        //================== LAYOUT ==================\\
        public static RectTransform Rect(Transform parent, string name)
        {
            var go = new GameObject(name, typeof(RectTransform));
            go.transform.SetParent(parent, false);
            return (RectTransform)go.transform;
        }

        public static RectTransform Fill(RectTransform rt, float inset = 0f)
        {
            rt.anchorMin = Vector2.zero; rt.anchorMax = Vector2.one;
            rt.offsetMin = new Vector2(inset, inset); rt.offsetMax = new Vector2(-inset, -inset);
            return rt;
        }

        public static RectTransform Place(RectTransform rt, Vector2 anchor, Vector2 size, Vector2 pos)
        {
            rt.anchorMin = anchor; rt.anchorMax = anchor; rt.pivot = anchor;
            rt.sizeDelta = size; rt.anchoredPosition = pos;
            return rt;
        }

        public static Image Panel(Transform parent, Color c, bool roundedCorners = true)
        {
            var rt = Rect(parent, "Panel");
            var im = rt.gameObject.AddComponent<Image>();
            if (roundedCorners) { im.sprite = Rounded; im.type = Image.Type.Sliced; }
            im.color = c;
            return im;
        }

        public static Image Panel(Transform parent, Color c, Vector2 anchor, Vector2 size, Vector2 pos)
        {
            var im = Panel(parent, c);
            Place(im.rectTransform, anchor, size, pos);
            return im;
        }

        public static Outline Neon(Graphic g, Color c, float w = 2.5f)
        {
            var o = g.gameObject.AddComponent<Outline>();
            o.effectColor = c; o.effectDistance = new Vector2(w, -w); o.useGraphicAlpha = true;
            return o;
        }

        public static Text Label(Transform parent, string text, int size, Color color, TextAnchor align = TextAnchor.MiddleCenter)
        {
            var rt = Rect(parent, "Text");
            var t = rt.gameObject.AddComponent<Text>();
            t.font = Font; t.text = text; t.fontSize = size; t.color = color; t.alignment = align;
            t.supportRichText = true; t.raycastTarget = false;
            t.horizontalOverflow = HorizontalWrapMode.Wrap; t.verticalOverflow = VerticalWrapMode.Truncate;
            t.resizeTextForBestFit = false;
            return t;
        }

        public static Text Label(Transform parent, string text, int size, Color color, TextAnchor align, Vector2 anchor, Vector2 rectSize, Vector2 pos)
        {
            var t = Label(parent, text, size, color, align);
            Place(t.rectTransform, anchor, rectSize, pos);
            return t;
        }

        /// Text that shrinks to fit its box (long Korean option text on small buttons).
        public static Text FitLabel(Transform parent, string text, int maxSize, int minSize, Color color, TextAnchor align = TextAnchor.MiddleCenter)
        {
            var t = Label(parent, text, maxSize, color, align);
            t.resizeTextForBestFit = true; t.resizeTextMaxSize = maxSize; t.resizeTextMinSize = minSize;
            return t;
        }

        public static Button Button(Transform parent, string text, Color bg, Color fg, int fontSize, Action onClick)
        {
            var rt = Rect(parent, "Btn_" + text);
            var im = rt.gameObject.AddComponent<Image>();
            im.sprite = Rounded; im.type = Image.Type.Sliced; im.color = bg;
            var b = rt.gameObject.AddComponent<Button>();
            b.targetGraphic = im;
            var cb = b.colors;
            cb.highlightedColor = new Color(1.1f, 1.1f, 1.15f, 1f);
            cb.pressedColor = new Color(0.75f, 0.75f, 0.8f, 1f);
            cb.disabledColor = new Color(0.45f, 0.45f, 0.5f, 0.6f);
            b.colors = cb;
            var l = FitLabel(rt, text, fontSize, Mathf.Max(14, fontSize - 12), fg);
            Fill(l.rectTransform, 8f);
            if (onClick != null) b.onClick.AddListener(() => { GameAudio.Click(); onClick(); });
            return b;
        }

        public static Button Button(Transform parent, string text, Color bg, Color fg, int fontSize, Action onClick, Vector2 anchor, Vector2 size, Vector2 pos)
        {
            var b = Button(parent, text, bg, fg, fontSize, onClick);
            Place((RectTransform)b.transform, anchor, size, pos);
            return b;
        }

        public static Text ButtonText(Button b) { return b.GetComponentInChildren<Text>(); }

        /// 2.0 (concept art 5): glossy candy-coloured round button with a white pictogram and a
        /// small caption. Same HoldButton behaviour as before (multi-touch, slide-off release).
        public static HoldButton IconHold(Transform parent, Icon icon, Color color, string caption, Vector2 anchor, Vector2 size, Vector2 pos)
        {
            var rt = Rect(parent, "IconHold_" + icon);
            Place(rt, anchor, size, pos);
            var glow = Rect(rt, "Glow");
            Fill(glow, -size.x * 0.12f);
            var gi = glow.gameObject.AddComponent<Image>();
            gi.sprite = Glow; gi.color = Pal.A(color, 0.45f); gi.raycastTarget = false;
            var im = rt.gameObject.AddComponent<Image>();
            im.sprite = UIIcons.GlossyCircle; im.color = color;
            var hb = rt.gameObject.AddComponent<HoldButton>();
            hb.image = im; hb.baseColor = color;
            var ic = Rect(rt, "Icon");
            Place(ic, new Vector2(0.5f, 0.5f), size * 0.5f, new Vector2(0f, caption != null ? size.y * 0.04f : 0f));
            ic.pivot = new Vector2(0.5f, 0.5f);
            var ii = ic.gameObject.AddComponent<Image>();
            ii.sprite = UIIcons.Get(icon); ii.raycastTarget = false; ii.color = Color.white;
            if (caption != null)
            {
                var l = Label(rt, caption, Mathf.RoundToInt(size.y * 0.12f), Color.white);
                Place(l.rectTransform, new Vector2(0.5f, 0f), new Vector2(size.x, size.y * 0.2f), new Vector2(0f, size.y * 0.1f));
                Neon(l, Pal.A(Color.black, 0.6f), 1.5f);
                hb.label = l;
            }
            return hb;
        }

        public static Image IconImage(Transform parent, Icon icon, Color c, Vector2 anchor, Vector2 size, Vector2 pos)
        {
            var rt = Rect(parent, "Icon_" + icon);
            Place(rt, anchor, size, pos);
            var im = rt.gameObject.AddComponent<Image>();
            im.sprite = UIIcons.Get(icon); im.color = c; im.raycastTarget = false;
            return im;
        }

        public static HoldButton Hold(Transform parent, string text, Color bg, int fontSize, Vector2 anchor, Vector2 size, Vector2 pos, bool round = true)
        {
            var rt = Rect(parent, "Hold_" + text);
            Place(rt, anchor, size, pos);
            var im = rt.gameObject.AddComponent<Image>();
            im.sprite = round ? Circle : Rounded; im.type = Image.Type.Sliced; im.color = bg;
            Neon(im, Pal.A(Color.white, 0.35f), 2f);
            var hb = rt.gameObject.AddComponent<HoldButton>();
            hb.image = im; hb.baseColor = bg;
            var l = FitLabel(rt, text, fontSize, 16, Pal.Text);
            Fill(l.rectTransform, 6f);
            hb.label = l;
            return hb;
        }
    }

    /// Touch / mouse button that reports a continuous "held" state (multi-touch safe: UGUI
    /// delivers each finger as its own pointer, so steering + boost can be held together).
    public class HoldButton : MonoBehaviour, IPointerDownHandler, IPointerUpHandler, IPointerExitHandler
    {
        public Image image;
        public Text label;
        public Color baseColor;
        public bool Held { get { return pointers.Count > 0; } }
        public bool PressedThisFrame { get; private set; }
        public Action onDown;
        readonly HashSet<int> pointers = new HashSet<int>();
        int pressFrame = -1;

        public void OnPointerDown(PointerEventData e)
        {
            pointers.Add(e.pointerId);
            pressFrame = Time.frameCount;
            if (onDown != null) onDown();
        }
        public void OnPointerUp(PointerEventData e) { pointers.Remove(e.pointerId); }
        public void OnPointerExit(PointerEventData e)
        {
            // a finger that slides off the button releases it (prevents "stuck" steering)
            pointers.Remove(e.pointerId);
        }
        void OnDisable() { pointers.Clear(); }

        void LateUpdate()
        {
            PressedThisFrame = pressFrame == Time.frameCount;
            if (image != null) image.color = Held ? Color.Lerp(baseColor, Color.white, 0.35f) : baseColor;
            if (transform is RectTransform rt) rt.localScale = Vector3.one * (Held ? 0.93f : 1f);
        }

        public bool ConsumePress()
        {
            bool p = pressFrame >= Time.frameCount - 1 && pressFrame >= 0;
            if (p) pressFrame = -1;
            return p;
        }
    }
}
