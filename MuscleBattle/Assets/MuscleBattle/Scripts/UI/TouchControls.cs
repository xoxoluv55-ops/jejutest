using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace MuscleBattle
{
    /// <summary>
    /// iPad touch controls (§54, §55): floating virtual stick on the left half, large well spaced
    /// action buttons on the right. Every finger is tracked by fingerId and owned by exactly one
    /// control, so pressing a button never moves the stick (and vice versa).
    /// Mouse emulates a single touch in the editor / desktop browser for testing.
    /// </summary>
    public sealed class TouchControls : MonoBehaviour
    {
        public Vector2 Move { get; private set; }
        public Buttons Held { get; private set; }

        sealed class Btn
        {
            public Buttons Value;
            public RectTransform Rect;
            public Image Fill, Ring, Glow;
            public Text Label;
            public Color Color;
            public float Press;
            public int Finger = -1;
            public bool NeedsMeter;
            public int MeterLevel;
        }

        RectTransform _root, _stickBase, _stickKnob, _stickZone;
        Image _stickBaseImg;
        int _stickFinger = -1;
        Vector2 _stickOrigin;
        readonly List<Btn> _buttons = new List<Btn>();
        const int MouseFinger = 999;
        Canvas _canvas;
        FighterController _owner;

        public static TouchControls Create(Transform canvas)
        {
            var rt = UIKit.Node("TouchControls", canvas);
            rt.Stretch();
            var tc = rt.gameObject.AddComponent<TouchControls>();
            tc._root = rt;
            tc._canvas = canvas.GetComponentInParent<Canvas>();
            tc.Build();
            return tc;
        }

        public void SetOwner(FighterController f) => _owner = f;

        public void Show(bool on)
        {
            _root.gameObject.SetActive(on);
            if (!on) { Move = Vector2.zero; Held = Buttons.None; _stickFinger = -1; foreach (var b in _buttons) b.Finger = -1; }
        }

        void Build()
        {
            // stick zone = left 45% of the screen, lower 75%
            _stickZone = UIKit.Node("StickZone", _root);
            _stickZone.anchorMin = new Vector2(0, 0);
            _stickZone.anchorMax = new Vector2(0.45f, 0.72f);
            _stickZone.offsetMin = _stickZone.offsetMax = Vector2.zero;

            _stickBaseImg = UIKit.Img(_root, "StickBase", UIKit.CircleOutline, Palette.Nerve.WithAlpha(0.55f));
            _stickBase = _stickBaseImg.rectTransform.Place(Vector2.zero, new Vector2(0.5f, 0.5f), new Vector2(260, 250), new Vector2(300, 300));
            var inner = UIKit.Img(_stickBase, "Inner", UIKit.Circle, new Color(0.05f, 0.05f, 0.15f, 0.35f));
            inner.rectTransform.Stretch(10);
            for (int i = 0; i < 4; i++)
            {
                var arrow = UIKit.Label(_stickBase, i switch { 0 => "▲", 1 => "▶", 2 => "▼", _ => "◀" }, 28, Palette.Nerve.WithAlpha(0.7f), TextAnchor.MiddleCenter, true, false);
                float a = i * Mathf.PI / 2f;
                arrow.rectTransform.Place(new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(Mathf.Sin(a), Mathf.Cos(a)) * 118f, new Vector2(40, 40));
            }
            var knob = UIKit.Img(_stickBase, "Knob", UIKit.Circle, Palette.Nerve.WithAlpha(0.85f));
            _stickKnob = knob.rectTransform.Place(new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(130, 130));
            var knobGlow = UIKit.Img(_stickKnob, "Glow", UIKit.Glow, Palette.Nerve.WithAlpha(0.5f));
            knobGlow.rectTransform.Stretch(-30);
            knobGlow.transform.SetAsFirstSibling();

            // right cluster: big attack buttons in an arc + utility row (sizes in 1080p reference units,
            // ~85pt on an iPad - well above the 44pt minimum)
            var a1 = new Vector2(1, 0);
            AddButton(Buttons.Light, "LIGHT", "약", a1, new Vector2(-470, 150), 160, Palette.Nerve);
            AddButton(Buttons.Heavy, "HEAVY", "강", a1, new Vector2(-290, 270), 160, Palette.Muscle);
            AddButton(Buttons.Kick, "KICK", "킥", a1, new Vector2(-130, 150), 160, Palette.MuscleHot);
            AddButton(Buttons.Guard, "GUARD", "가드", a1, new Vector2(-620, 70), 130, Palette.NerveDeep);
            AddButton(Buttons.Dodge, "DODGE", "회피", a1, new Vector2(-560, 300), 120, Palette.Mastery);
            AddButton(Buttons.Grab, "GRAB", "잡기", a1, new Vector2(-120, 380), 120, Palette.Gold);
            AddButton(Buttons.Counter, "COUNTER", "카운터", a1, new Vector2(-300, 470), 120, Palette.Bone);
            var sp = AddButton(Buttons.Special, "SPECIAL", "스페셜", a1, new Vector2(-470, 470), 130, Palette.MasteryPink);
            sp.NeedsMeter = true; sp.MeterLevel = 1;
            var ult = AddButton(Buttons.Special | Buttons.Heavy, "ULTIMATE", "얼티밋", a1, new Vector2(-120, 590), 130, Palette.Gold);
            ult.NeedsMeter = true; ult.MeterLevel = 3;
        }

        Btn AddButton(Buttons value, string en, string ko, Vector2 anchor, Vector2 pos, float size, Color color)
        {
            var b = new Btn { Value = value, Color = color };
            var glow = UIKit.Img(_root, en + "_Glow", UIKit.Glow, color.WithAlpha(0f));
            glow.rectTransform.Place(anchor, new Vector2(0.5f, 0.5f), pos, Vector2.one * size * 1.6f);
            b.Glow = glow;
            var fill = UIKit.Img(_root, en, UIKit.Circle, new Color(0.05f, 0.04f, 0.14f, 0.55f));
            b.Rect = fill.rectTransform.Place(anchor, new Vector2(0.5f, 0.5f), pos, Vector2.one * size);
            b.Fill = fill;
            b.Ring = UIKit.Img(b.Rect, "Ring", UIKit.CircleOutline, color.WithAlpha(0.9f));
            b.Ring.rectTransform.Stretch(-3);
            b.Label = UIKit.Label(b.Rect, ko, Mathf.RoundToInt(size * 0.22f), Color.white);
            b.Label.rectTransform.Stretch();
            b.Label.rectTransform.offsetMin = new Vector2(0, size * 0.12f);
            var enT = UIKit.Label(b.Rect, en, Mathf.RoundToInt(size * 0.12f), color, TextAnchor.MiddleCenter, true, true);
            enT.rectTransform.Stretch();
            enT.rectTransform.offsetMax = new Vector2(0, -size * 0.45f);
            _buttons.Add(b);
            return b;
        }

        void Update()
        {
            if (!_root.gameObject.activeInHierarchy) return;
            float dt = Time.unscaledDeltaTime;

            // gather pointers (touches, or the mouse as finger 999 when there are no touches)
            var pointers = new List<(int id, Vector2 pos, TouchPhase phase)>(Input.touchCount + 1);
            for (int i = 0; i < Input.touchCount; i++)
            {
                var t = Input.GetTouch(i);
                pointers.Add((t.fingerId, t.position, t.phase));
            }
            if (Input.touchCount == 0 && Input.mousePresent)
            {
                if (Input.GetMouseButtonDown(0)) pointers.Add((MouseFinger, Input.mousePosition, TouchPhase.Began));
                else if (Input.GetMouseButton(0)) pointers.Add((MouseFinger, Input.mousePosition, TouchPhase.Moved));
                else if (Input.GetMouseButtonUp(0)) pointers.Add((MouseFinger, Input.mousePosition, TouchPhase.Ended));
            }

            foreach (var p in pointers)
            {
                bool ended = p.phase == TouchPhase.Ended || p.phase == TouchPhase.Canceled;
                if (p.phase == TouchPhase.Began)
                {
                    var hit = HitButton(p.pos);
                    if (hit != null)
                    {
                        hit.Finger = p.id;
                        hit.Press = 1f;
                        AudioManager.Instance?.PlaySfx("ui_tick", 0.35f);
                    }
                    else if (_stickFinger < 0 && MenuInput.Contains(_stickZone, p.pos))
                    {
                        _stickFinger = p.id;
                        _stickOrigin = p.pos;
                        PlaceStickAt(p.pos);
                    }
                }
                if (p.id == _stickFinger)
                {
                    if (ended)
                    {
                        _stickFinger = -1;
                        Move = Vector2.zero;
                        _stickKnob.anchoredPosition = Vector2.zero;
                    }
                    else
                    {
                        float scale = _canvas != null ? _canvas.scaleFactor : 1f;
                        var delta = (p.pos - _stickOrigin) / scale;
                        var clamped = Vector2.ClampMagnitude(delta, 110f);
                        _stickKnob.anchoredPosition = clamped;
                        var v = clamped / 110f;
                        Move = new Vector2(Mathf.Abs(v.x) > 0.35f ? Mathf.Sign(v.x) : 0, Mathf.Abs(v.y) > 0.45f ? Mathf.Sign(v.y) : 0);
                    }
                }
                foreach (var b in _buttons)
                    if (b.Finger == p.id && ended) b.Finger = -1;
            }

            // a finger can disappear without an Ended event (app switch): release anything stale
            if (Input.touchCount == 0 && !Input.GetMouseButton(0))
            {
                foreach (var b in _buttons) b.Finger = -1;
                if (_stickFinger >= 0) { _stickFinger = -1; Move = Vector2.zero; _stickKnob.anchoredPosition = Vector2.zero; }
            }

            var held = Buttons.None;
            foreach (var b in _buttons)
            {
                bool down = b.Finger >= 0;
                if (down) held |= b.Value;
                b.Press = Mathf.MoveTowards(b.Press, down ? 1f : 0f, dt * 10f);
                b.Rect.localScale = Vector3.one * (1f - b.Press * 0.1f);
                bool ready = !b.NeedsMeter || (_owner != null && _owner.Meter >= b.MeterLevel * 100f);
                float pulse = ready && b.NeedsMeter ? 0.35f + 0.25f * Mathf.Sin(Time.unscaledTime * 6f) : 0f;
                b.Fill.color = Color.Lerp(new Color(0.05f, 0.04f, 0.14f, ready ? 0.55f : 0.3f), b.Color.WithAlpha(0.75f), b.Press);
                b.Glow.SetAlpha(b.Press * 0.6f + pulse);
                b.Ring.SetAlpha(ready ? 0.9f : 0.35f);
                b.Label.SetAlpha(ready ? 1f : 0.45f);
            }
            Held = held;
            _stickBaseImg.SetAlpha(_stickFinger >= 0 ? 0.8f : 0.45f);
        }

        Btn HitButton(Vector2 screenPos)
        {
            Btn best = null;
            float bestD = float.MaxValue;
            foreach (var b in _buttons)
            {
                // generous radial hit area (+15%) so near-misses still register
                RectTransformUtility.ScreenPointToLocalPointInRectangle(b.Rect, screenPos, null, out var local);
                float r = b.Rect.rect.width * 0.5f * 1.15f;
                float d = local.magnitude;
                if (d <= r && d < bestD) { best = b; bestD = d; }
            }
            return best;
        }

        void PlaceStickAt(Vector2 screenPos)
        {
            RectTransformUtility.ScreenPointToLocalPointInRectangle(_root, screenPos, null, out var local);
            var size = _root.rect.size;
            _stickBase.anchoredPosition = local + size * 0.5f;
            _stickKnob.anchoredPosition = Vector2.zero;
        }
    }
}
