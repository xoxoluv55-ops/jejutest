using UnityEngine;

namespace MuscleBattle
{
    /// <summary>
    /// CPU fighter. Plays through the same InputFrame interface as a human (no cheating on
    /// frame data). Reaction chance / delay scale with difficulty.
    /// </summary>
    public sealed class CpuInputSource : IInputSource
    {
        readonly CpuDifficulty _difficulty;
        readonly System.Random _rng;
        int _thinkTimer;
        Vector2 _move;
        Buttons _held;
        Buttons _pendingPress;
        int _pressDelay;
        string[] _comboRoute;
        int _comboIndex;
        MoveData _reactedTo;
        int _reactedFrame = -1;
        int _guardHold;
        int _sidestepTimer;

        public string Label => "CPU";

        public CpuInputSource(CpuDifficulty difficulty, int seed = 0)
        {
            _difficulty = difficulty;
            _rng = new System.Random(seed == 0 ? System.Environment.TickCount : seed);
        }

        float ReactChance => _difficulty switch { CpuDifficulty.Easy => 0.12f, CpuDifficulty.Normal => 0.38f, _ => 0.65f };
        int ReactionDelay => _difficulty switch { CpuDifficulty.Easy => 16, CpuDifficulty.Normal => 10, _ => 6 };
        float Aggression => _difficulty switch { CpuDifficulty.Easy => 0.35f, CpuDifficulty.Normal => 0.55f, _ => 0.7f };

        float Rand() => (float)_rng.NextDouble();

        public InputFrame Poll(FighterController self, FighterController opp)
        {
            var frame = new InputFrame();
            if (self == null || opp == null) return frame;

            var cam = CameraManager.Instance;
            var toOpp = FighterController.FlatDir(opp.Position - self.Position);
            float fwdSign = cam != null ? Mathf.Sign(Vector3.Dot(toOpp, cam.FlatRight) + 0.0001f) : 1f;
            float dist = Vector3.Distance(FighterController.Flat(self.Position), FighterController.Flat(opp.Position));

            Buttons pressed = Buttons.None;

            // continue a combo route while the previous hit connected
            if (_comboRoute != null && self.State == FighterState.Attack && self.MoveConnected && _comboIndex < _comboRoute.Length)
            {
                if (self.MoveFrame >= self.CurrentMove.Startup + 1)
                {
                    pressed |= RouteButton(_comboRoute[_comboIndex++]);
                }
            }
            else if (self.State != FighterState.Attack)
            {
                _comboRoute = null;
            }

            // delayed press (reaction time)
            if (_pendingPress != Buttons.None && --_pressDelay <= 0)
            {
                pressed |= _pendingPress;
                _pendingPress = Buttons.None;
            }

            // defensive reaction to the opponent's attack startup
            if (opp.IsInStartup && opp.CurrentMove != _reactedTo && dist < 2.6f && self.CanAct)
            {
                _reactedTo = opp.CurrentMove;
                if (Rand() < ReactChance)
                {
                    float r = Rand();
                    if (opp.CurrentMove.Kind == MoveKind.Grab) { if (r < 0.6f) Queue(Buttons.Light, 2); }
                    else if (_difficulty == CpuDifficulty.Hard && r < 0.18f) Queue(Buttons.Counter, ReactionDelay / 2);
                    else if (r < 0.35f) Queue(Buttons.Dodge, ReactionDelay / 2);
                    else _guardHold = opp.CurrentMove.Total + 4;
                }
            }
            if (opp.State != FighterState.Attack) _reactedTo = null;

            if (_guardHold > 0)
            {
                _guardHold--;
                frame.Held |= Buttons.Guard;
            }

            if (--_thinkTimer <= 0 && self.CanAct && _guardHold <= 0)
            {
                Think(self, opp, dist);
            }

            // juggle opponents in the air
            if (opp.State == FighterState.Air && opp.JuggleCount < 4 && dist < 1.6f && self.CanAct && _difficulty != CpuDifficulty.Easy && Rand() < 0.2f)
                pressed |= Rand() < 0.6f ? Buttons.Light : Buttons.Kick;

            // punish whiffed recovery
            if (opp.State == FighterState.Attack && !opp.MoveConnected && opp.MoveFrame > opp.CurrentMove.Startup + opp.CurrentMove.Active &&
                dist < 1.8f && self.CanAct && _reactedFrame != opp.MoveFrame && Rand() < ReactChance * 0.25f)
            {
                _reactedFrame = opp.MoveFrame;
                StartRoute(new[] { "h", "k" });
                pressed |= Buttons.Light;
            }

            // movement
            var mv = _move;
            if (_sidestepTimer > 0) { _sidestepTimer--; }
            else if (Mathf.Abs(mv.y) > 0) mv.y = 0;
            frame.Move = new Vector2(mv.x * fwdSign, mv.y);
            frame.Held |= _held;
            frame.Pressed = pressed;
            frame.Held |= pressed;
            return frame;
        }

        void Think(FighterController self, FighterController opp, float dist)
        {
            _thinkTimer = 6 + _rng.Next(0, _difficulty == CpuDifficulty.Hard ? 6 : 14);
            _move = Vector2.zero;
            _held = Buttons.None;

            if (opp.IsDown) { _move.x = dist < 2.2f ? -0.6f : 0; return; }

            // ultimate / special when it is likely to land
            if (self.Meter >= 300 && dist < 2.4f && Rand() < 0.25f) { Queue(Buttons.Special | Buttons.Heavy, 1); _held = Buttons.Heavy; return; }
            if (self.Meter >= 100 && dist < 2.2f && Rand() < 0.08f + (self.HpLow ? 0.08f : 0)) { Queue(Buttons.Special, 1); return; }

            if (dist > 1.55f)
            {
                _move.x = Rand() < Aggression + 0.25f ? 1 : 0;
                if (Rand() < 0.12f) { _move.y = Rand() < 0.5f ? 1 : -1; _sidestepTimer = 14; }
                return;
            }

            float r = Rand();
            if (r > Aggression)
            {
                // defensive beat: guard, step back, or sidestep
                float d = Rand();
                if (d < 0.45f) { _held = Buttons.Guard; _thinkTimer += 10; }
                else if (d < 0.7f) _move.x = -1;
                else { _move.y = Rand() < 0.5f ? 1 : -1; _sidestepTimer = 16; }
                return;
            }

            float pick = Rand();
            if (opp.State == FighterState.Guard && pick < 0.35f) { Queue(Buttons.Grab, 1); return; }
            if (pick < 0.32f) { StartRoute(new[] { "l", "l", "k" }); Queue(Buttons.Light, 1); }
            else if (pick < 0.5f) { StartRoute(new[] { "l", "h" }); Queue(Buttons.Light, 1); }
            else if (pick < 0.65f) { StartRoute(new[] { "k" }); Queue(Buttons.Kick, 1); }
            else if (pick < 0.78f) { StartRoute(null); Queue(Buttons.Heavy, 1); }
            else if (pick < 0.88f) { StartRoute(new[] { "l", "l", "s" }); Queue(Buttons.Light, 1); }
            else { Queue(Buttons.Grab, 1); }
        }

        void StartRoute(string[] route)
        {
            _comboRoute = route;
            _comboIndex = 0;
        }

        Buttons RouteButton(string s) => s switch
        {
            "l" => Buttons.Light,
            "h" => Buttons.Heavy,
            "k" => Buttons.Kick,
            "s" => Buttons.Special,
            _ => Buttons.None,
        };

        void Queue(Buttons b, int delay)
        {
            _pendingPress = b;
            _pressDelay = Mathf.Max(1, delay);
        }
    }
}
