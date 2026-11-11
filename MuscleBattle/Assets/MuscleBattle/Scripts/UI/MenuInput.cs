using UnityEngine;
using UnityEngine.UI;

namespace MuscleBattle
{
    /// <summary>
    /// Menu input for every device: keyboard, gamepads (legacy input), mouse and touch.
    /// player: 0 = P1 devices, 1 = P2 devices, -1 = any device.
    /// </summary>
    public static class MenuInput
    {
        static readonly Vector2Int[] PadPrev = new Vector2Int[2];
        static readonly Vector2Int[] PadNow = new Vector2Int[2];
        static readonly float[] RepeatTimer = new float[2];
        static int _frame = -1;
        static bool _axesOk = true;

        /// <summary>Call once per frame before screens read input.</summary>
        public static void Update()
        {
            if (_frame == Time.frameCount) return;
            _frame = Time.frameCount;
            for (int p = 0; p < 2; p++)
            {
                PadPrev[p] = PadNow[p];
                PadNow[p] = ReadPadDir(p + 1);
                if (PadNow[p] != Vector2Int.zero && PadNow[p] == PadPrev[p]) RepeatTimer[p] += Time.unscaledDeltaTime;
                else RepeatTimer[p] = 0;
            }
        }

        static Vector2Int ReadPadDir(int pad)
        {
            float x = 0, y = 0;
            if (_axesOk)
            {
                try
                {
                    x = Input.GetAxisRaw($"J{pad}_X") + Input.GetAxisRaw($"J{pad}_DX");
                    y = Input.GetAxisRaw($"J{pad}_Y") + Input.GetAxisRaw($"J{pad}_DY");
                }
                catch (System.ArgumentException) { _axesOk = false; }
            }
            var b = (int)KeyCode.Joystick1Button0 + (pad - 1) * 20;
            if (Input.GetKey((KeyCode)(b + 12))) y = 1;
            if (Input.GetKey((KeyCode)(b + 13))) y = -1;
            if (Input.GetKey((KeyCode)(b + 14))) x = -1;
            if (Input.GetKey((KeyCode)(b + 15))) x = 1;
            return new Vector2Int(Mathf.Abs(x) > 0.5f ? (int)Mathf.Sign(x) : 0, Mathf.Abs(y) > 0.5f ? (int)Mathf.Sign(y) : 0);
        }

        static bool Down(params KeyCode[] keys)
        {
            foreach (var k in keys) if (Input.GetKeyDown(k)) return true;
            return false;
        }

        static bool PadButton(int player, int button)
        {
            if (player < 0) return PadButton(0, button) || PadButton(1, button);
            return Input.GetKeyDown((KeyCode)((int)KeyCode.Joystick1Button0 + player * 20 + button));
        }

        public static Vector2Int Nav(int player)
        {
            Update(); // idempotent per frame, so script execution order never matters
            if (player < 0)
            {
                var a = Nav(0);
                return a != Vector2Int.zero ? a : Nav(1);
            }
            var v = Vector2Int.zero;
            if (player == 0)
            {
                if (Down(KeyCode.A)) v.x = -1;
                if (Down(KeyCode.D)) v.x = 1;
                if (Down(KeyCode.W)) v.y = 1;
                if (Down(KeyCode.S)) v.y = -1;
            }
            if (player == 1 || GameModeManager.Instance == null || !GameModeManager.Instance.IsTwoPlayer)
            {
                if (Down(KeyCode.LeftArrow)) v.x = -1;
                if (Down(KeyCode.RightArrow)) v.x = 1;
                if (Down(KeyCode.UpArrow)) v.y = 1;
                if (Down(KeyCode.DownArrow)) v.y = -1;
            }
            var pad = PadNow[player];
            bool fresh = pad != PadPrev[player];
            bool repeat = RepeatTimer[player] > 0.35f && Mathf.Repeat(RepeatTimer[player], 0.12f) < Time.unscaledDeltaTime;
            if (pad != Vector2Int.zero && (fresh || repeat)) v = pad;
            return v;
        }

        public static bool Confirm(int player)
        {
            bool p1 = Down(KeyCode.J, KeyCode.Space, KeyCode.Return) || PadButton(0, 0);
            bool p2 = Down(KeyCode.Keypad1, KeyCode.KeypadEnter, KeyCode.Comma) || PadButton(1, 0);
            if (GameModeManager.Instance == null || !GameModeManager.Instance.IsTwoPlayer) p1 |= Down(KeyCode.Keypad1, KeyCode.KeypadEnter);
            return player switch { 0 => p1, 1 => p2, _ => p1 || p2 };
        }

        public static bool Back(int player)
        {
            bool p1 = Down(KeyCode.K, KeyCode.Escape) || PadButton(0, 1);
            bool p2 = Down(KeyCode.Keypad2, KeyCode.Backspace, KeyCode.Period) || PadButton(1, 1);
            return player switch { 0 => p1, 1 => p2, _ => p1 || p2 };
        }

        public static bool Random(int player) => player switch
        {
            0 => Down(KeyCode.L) || PadButton(0, 3),
            1 => Down(KeyCode.Keypad3, KeyCode.Slash) || PadButton(1, 3),
            _ => Down(KeyCode.L, KeyCode.Keypad3) || PadButton(-1, 3),
        };

        public static bool Pause() => Down(KeyCode.Escape, KeyCode.Backspace) || PadButton(-1, 7) || PadButton(-1, 9);

        public static bool AnyStart() =>
            Input.anyKeyDown || Input.GetMouseButtonDown(0) || Input.touchCount > 0;

        // ---------------- pointer (mouse / touch) ----------------
        /// <summary>Returns true when a pointer was pressed this frame over the rect.</summary>
        public static bool PointerDownOver(RectTransform rt)
        {
            for (int i = 0; i < Input.touchCount; i++)
            {
                var t = Input.GetTouch(i);
                if (t.phase == TouchPhase.Began && Contains(rt, t.position)) return true;
            }
            if (Input.touchCount == 0 && Input.GetMouseButtonDown(0) && Contains(rt, Input.mousePosition)) return true;
            return false;
        }

        public static bool PointerHover(RectTransform rt) =>
            Input.touchCount == 0 && Input.mousePresent && Contains(rt, Input.mousePosition);

        public static bool Contains(RectTransform rt, Vector2 screenPos) =>
            rt != null && rt.gameObject.activeInHierarchy && RectTransformUtility.RectangleContainsScreenPoint(rt, screenPos, null);
    }

    /// <summary>Menu button with hover/focus/press animation and SFX (§37 UI click sounds).</summary>
    public sealed class MBButton : MonoBehaviour
    {
        public RectTransform Rect { get; private set; }
        public Text Label { get; private set; }
        public Text SubLabel { get; private set; }
        public Image Background { get; private set; }
        public Image Edge { get; private set; }
        public System.Action OnClick;
        public bool Focused { get; private set; }
        public bool Interactable = true;
        Color _accent;
        float _press;
        float _focusAnim;

        public static MBButton Create(Transform parent, string text, string sub, Color accent, Vector2 anchor, Vector2 pos, Vector2 size, int fontSize = 34)
        {
            var bg = UIKit.Img(parent, "Button_" + text, UIKit.Para, Palette.Panel.WithAlpha(0.9f), true);
            bg.rectTransform.Place(anchor, new Vector2(0.5f, 0.5f), pos, size);
            var b = bg.gameObject.AddComponent<MBButton>();
            b.Rect = bg.rectTransform;
            b.Background = bg;
            b._accent = accent;
            b.Edge = UIKit.Img(bg.rectTransform, "Edge", UIKit.ParaOutline, accent.WithAlpha(0.7f));
            b.Edge.rectTransform.Stretch(-3);
            b.Label = UIKit.Label(bg.rectTransform, text, fontSize, Color.white);
            b.Label.rectTransform.Stretch();
            if (!string.IsNullOrEmpty(sub))
            {
                b.Label.rectTransform.offsetMin = new Vector2(0, size.y * 0.22f);
                b.SubLabel = UIKit.Label(bg.rectTransform, sub, Mathf.RoundToInt(fontSize * 0.5f), Palette.TextDim, TextAnchor.MiddleCenter, false);
                b.SubLabel.rectTransform.Stretch();
                b.SubLabel.rectTransform.offsetMax = new Vector2(0, -size.y * 0.55f);
            }
            return b;
        }

        public void SetFocus(bool on, bool sound = true)
        {
            if (on && !Focused && sound) AudioManager.Instance?.PlaySfx("ui_hover", 0.6f);
            Focused = on;
        }

        public void Click()
        {
            if (!Interactable)
            {
                AudioManager.Instance?.PlaySfx("ui_wrong", 0.6f);
                return;
            }
            _press = 1f;
            AudioManager.Instance?.PlaySfx("ui_confirm", 0.8f);
            OnClick?.Invoke();
        }

        void Update()
        {
            float dt = Time.unscaledDeltaTime;
            _press = Mathf.MoveTowards(_press, 0, dt * 5f);
            _focusAnim = Mathf.MoveTowards(_focusAnim, Focused ? 1 : 0, dt * 8f);
            float pulse = Focused ? 0.5f + 0.5f * Mathf.Sin(Time.unscaledTime * 6f) : 0;
            Background.color = Color.Lerp(Palette.Panel.WithAlpha(0.9f), Color.Lerp(_accent, Color.black, 0.45f).WithAlpha(0.95f), _focusAnim);
            Edge.color = Color.Lerp(_accent.WithAlpha(0.55f), Color.Lerp(_accent, Color.white, 0.4f + pulse * 0.3f), _focusAnim);
            float s = 1f + _focusAnim * 0.06f - _press * 0.08f;
            Rect.localScale = new Vector3(s, s, 1);
            Label.color = Interactable ? Color.white : Palette.TextDim.WithAlpha(0.6f);
        }
    }

    /// <summary>Keyboard / pad / pointer navigation over a list of buttons.</summary>
    public sealed class MenuNavigator
    {
        readonly System.Collections.Generic.List<MBButton> _buttons = new System.Collections.Generic.List<MBButton>();
        public int Index { get; private set; }
        public bool Horizontal;
        public int Player = -1;

        public void Add(MBButton b) => _buttons.Add(b);
        public void Clear() { _buttons.Clear(); Index = 0; }

        public void Focus(int i, bool sound = false)
        {
            if (_buttons.Count == 0) return;
            Index = (i % _buttons.Count + _buttons.Count) % _buttons.Count;
            for (int k = 0; k < _buttons.Count; k++) _buttons[k].SetFocus(k == Index, sound);
        }

        /// <summary>Returns true if a button was activated this frame.</summary>
        public bool Update()
        {
            if (_buttons.Count == 0) return false;
            var nav = MenuInput.Nav(Player);
            int step = Horizontal ? nav.x : -nav.y;
            if (step != 0) Focus(Index + step, true);

            for (int k = 0; k < _buttons.Count; k++)
            {
                var b = _buttons[k];
                if (MenuInput.PointerHover(b.Rect) && Index != k) Focus(k, true);
                if (MenuInput.PointerDownOver(b.Rect))
                {
                    Focus(k);
                    b.Click();
                    return true;
                }
            }
            if (MenuInput.Confirm(Player))
            {
                _buttons[Index].Click();
                return true;
            }
            return false;
        }
    }
}
