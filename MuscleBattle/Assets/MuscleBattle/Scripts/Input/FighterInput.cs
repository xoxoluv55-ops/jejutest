using System;
using UnityEngine;

namespace MuscleBattle
{
    [Flags]
    public enum Buttons
    {
        None = 0,
        Light = 1 << 0,
        Heavy = 1 << 1,
        Kick = 1 << 2,
        Guard = 1 << 3,
        Dodge = 1 << 4,
        Grab = 1 << 5,
        Counter = 1 << 6,
        Special = 1 << 7,
        Start = 1 << 8,
    }

    /// <summary>
    /// One simulation tick worth of input. Move is SCREEN space (x = right, y = up / into screen);
    /// the fighter converts it to forward / sidestep relative to the opponent.
    /// </summary>
    public struct InputFrame
    {
        public Vector2 Move;
        public Buttons Held;
        public Buttons Pressed;

        public bool IsHeld(Buttons b) => (Held & b) != 0;
        public bool WasPressed(Buttons b) => (Pressed & b) != 0;
    }

    public interface IInputSource
    {
        string Label { get; }
        /// <summary>Called once per simulation tick (60 Hz).</summary>
        InputFrame Poll(FighterController self, FighterController opponent);
    }

    /// <summary>Turns raw "held" state into held + pressed edges and maps button chords.</summary>
    public abstract class RawInputSource : IInputSource
    {
        Buttons _prev;
        int _lightAt = -99, _kickAt = -99, _guardAt = -99, _heavyAt = -99, _tick;

        public abstract string Label { get; }
        protected abstract Vector2 ReadMove();
        protected abstract Buttons ReadHeld();

        public InputFrame Poll(FighterController self, FighterController opponent)
        {
            _tick++;
            var held = ReadHeld();
            var pressed = held & ~_prev;
            _prev = held;

            // chords for pads: Light+Kick = Grab, Guard+Heavy = Counter (3 frame leniency)
            if ((pressed & Buttons.Light) != 0) _lightAt = _tick;
            if ((pressed & Buttons.Kick) != 0) _kickAt = _tick;
            if ((pressed & Buttons.Guard) != 0) _guardAt = _tick;
            if ((pressed & Buttons.Heavy) != 0) _heavyAt = _tick;
            if (((pressed & (Buttons.Light | Buttons.Kick)) != 0) && Mathf.Abs(_lightAt - _kickAt) <= 3)
            {
                pressed |= Buttons.Grab;
                pressed &= ~(Buttons.Light | Buttons.Kick);
                _lightAt = _kickAt = -99;
            }
            if (((pressed & (Buttons.Guard | Buttons.Heavy)) != 0) && Mathf.Abs(_guardAt - _heavyAt) <= 3)
            {
                pressed |= Buttons.Counter;
                pressed &= ~Buttons.Heavy;
                _guardAt = _heavyAt = -99;
            }

            var mv = ReadMove();
            if (mv.sqrMagnitude > 1f) mv.Normalize();
            return new InputFrame { Move = mv, Held = held, Pressed = pressed };
        }
    }

    /// <summary>Keyboard layouts. P1 = WASD side, P2 = arrows / numpad side.</summary>
    public sealed class KeyboardInputSource : RawInputSource
    {
        readonly KeyCode[] _left, _right, _up, _down, _light, _heavy, _kick, _guard, _dodge, _grab, _counter, _special, _start;
        readonly string _label;
        public override string Label => _label;

        public static KeyboardInputSource PlayerOne() => new KeyboardInputSource("KEYBOARD (WASD)",
            new[] { KeyCode.A }, new[] { KeyCode.D }, new[] { KeyCode.W }, new[] { KeyCode.S },
            new[] { KeyCode.J }, new[] { KeyCode.K }, new[] { KeyCode.L }, new[] { KeyCode.LeftShift, KeyCode.H },
            new[] { KeyCode.Space }, new[] { KeyCode.U }, new[] { KeyCode.O }, new[] { KeyCode.I }, new[] { KeyCode.Escape });

        public static KeyboardInputSource PlayerTwo() => new KeyboardInputSource("KEYBOARD (ARROWS)",
            new[] { KeyCode.LeftArrow }, new[] { KeyCode.RightArrow }, new[] { KeyCode.UpArrow }, new[] { KeyCode.DownArrow },
            new[] { KeyCode.Keypad1, KeyCode.Comma }, new[] { KeyCode.Keypad2, KeyCode.Period }, new[] { KeyCode.Keypad3, KeyCode.Slash },
            new[] { KeyCode.Keypad0, KeyCode.RightShift }, new[] { KeyCode.KeypadEnter, KeyCode.RightControl },
            new[] { KeyCode.Keypad4, KeyCode.Semicolon }, new[] { KeyCode.Keypad6, KeyCode.P }, new[] { KeyCode.Keypad5, KeyCode.Quote },
            new[] { KeyCode.Backspace });

        KeyboardInputSource(string label, KeyCode[] l, KeyCode[] r, KeyCode[] u, KeyCode[] d, KeyCode[] light, KeyCode[] heavy, KeyCode[] kick,
            KeyCode[] guard, KeyCode[] dodge, KeyCode[] grab, KeyCode[] counter, KeyCode[] special, KeyCode[] start)
        {
            _label = label; _left = l; _right = r; _up = u; _down = d; _light = light; _heavy = heavy; _kick = kick;
            _guard = guard; _dodge = dodge; _grab = grab; _counter = counter; _special = special; _start = start;
        }

        static bool Any(KeyCode[] keys)
        {
            foreach (var k in keys) if (Input.GetKey(k)) return true;
            return false;
        }

        protected override Vector2 ReadMove() =>
            new Vector2((Any(_right) ? 1 : 0) - (Any(_left) ? 1 : 0), (Any(_up) ? 1 : 0) - (Any(_down) ? 1 : 0));

        protected override Buttons ReadHeld()
        {
            var b = Buttons.None;
            if (Any(_light)) b |= Buttons.Light;
            if (Any(_heavy)) b |= Buttons.Heavy;
            if (Any(_kick)) b |= Buttons.Kick;
            if (Any(_guard)) b |= Buttons.Guard;
            if (Any(_dodge)) b |= Buttons.Dodge;
            if (Any(_grab)) b |= Buttons.Grab;
            if (Any(_counter)) b |= Buttons.Counter;
            if (Any(_special)) b |= Buttons.Special;
            if (Any(_start)) b |= Buttons.Start;
            return b;
        }
    }

    /// <summary>
    /// Gamepad through the legacy input manager (works on Windows and in WebGL via the browser
    /// Gamepad API "standard" mapping). Axes J{n}_X / J{n}_Y / J{n}_DX / J{n}_DY are defined in
    /// ProjectSettings/InputManager.asset. Layout: X light, Y heavy, A kick, B dodge,
    /// LB guard, RB special, X+A grab, LB+Y counter.
    /// </summary>
    public sealed class GamepadInputSource : RawInputSource
    {
        readonly int _pad; // 1-based
        readonly string _ax, _ay, _dx, _dy;
        static bool _axesMissing;
        public override string Label => "GAMEPAD " + _pad;

        public GamepadInputSource(int pad)
        {
            _pad = pad;
            _ax = $"J{pad}_X"; _ay = $"J{pad}_Y"; _dx = $"J{pad}_DX"; _dy = $"J{pad}_DY";
        }

        public static int ConnectedCount()
        {
            int n = 0;
            foreach (var name in Input.GetJoystickNames()) if (!string.IsNullOrEmpty(name)) n++;
            return n;
        }

        KeyCode Btn(int i) => (KeyCode)((int)KeyCode.Joystick1Button0 + (_pad - 1) * 20 + i);

        static float Axis(string name)
        {
            if (_axesMissing) return 0;
            try { return Input.GetAxisRaw(name); }
            catch (ArgumentException)
            {
                _axesMissing = true;
                Debug.LogWarning("[MuscleBattle] Gamepad axes missing from InputManager.asset - analog movement disabled.");
                return 0;
            }
        }

        protected override Vector2 ReadMove()
        {
            var v = new Vector2(Axis(_ax), Axis(_ay));
            var d = new Vector2(Axis(_dx), Axis(_dy));
            // WebGL standard mapping exposes the d-pad as buttons 12..15
            if (Input.GetKey(Btn(12))) d.y = 1;
            if (Input.GetKey(Btn(13))) d.y = -1;
            if (Input.GetKey(Btn(14))) d.x = -1;
            if (Input.GetKey(Btn(15))) d.x = 1;
            if (d.sqrMagnitude > v.sqrMagnitude) v = d;
            if (v.magnitude < 0.3f) return Vector2.zero;
            // digitalise to 8 directions - fighting games want crisp input
            return new Vector2(Mathf.Abs(v.x) > 0.4f ? Mathf.Sign(v.x) : 0, Mathf.Abs(v.y) > 0.5f ? Mathf.Sign(v.y) : 0);
        }

        protected override Buttons ReadHeld()
        {
            var b = Buttons.None;
            if (Input.GetKey(Btn(2))) b |= Buttons.Light;   // X / Square
            if (Input.GetKey(Btn(3))) b |= Buttons.Heavy;   // Y / Triangle
            if (Input.GetKey(Btn(0))) b |= Buttons.Kick;    // A / Cross
            if (Input.GetKey(Btn(1))) b |= Buttons.Dodge;   // B / Circle
            if (Input.GetKey(Btn(4))) b |= Buttons.Guard;   // LB / L1
            if (Input.GetKey(Btn(5))) b |= Buttons.Special; // RB / R1
            if (Input.GetKey(Btn(7)) || Input.GetKey(Btn(9))) b |= Buttons.Start;
            return b;
        }
    }

    /// <summary>Reads the on-screen touch controls (iPad).</summary>
    public sealed class TouchInputSource : RawInputSource
    {
        readonly TouchControls _controls;
        public TouchInputSource(TouchControls controls) { _controls = controls; }
        public override string Label => "TOUCH";
        protected override Vector2 ReadMove() => _controls != null ? _controls.Move : Vector2.zero;
        protected override Buttons ReadHeld() => _controls != null ? _controls.Held : Buttons.None;
    }

    /// <summary>Merges several sources (e.g. keyboard + pad for P1 in single player).</summary>
    public sealed class CompositeInputSource : IInputSource
    {
        readonly IInputSource[] _sources;
        public CompositeInputSource(params IInputSource[] sources) { _sources = sources; }
        public string Label => _sources.Length > 0 ? _sources[0].Label : "";

        public InputFrame Poll(FighterController self, FighterController opponent)
        {
            var result = new InputFrame();
            foreach (var s in _sources)
            {
                var f = s.Poll(self, opponent);
                result.Held |= f.Held;
                result.Pressed |= f.Pressed;
                if (f.Move.sqrMagnitude > result.Move.sqrMagnitude) result.Move = f.Move;
            }
            return result;
        }
    }
}
