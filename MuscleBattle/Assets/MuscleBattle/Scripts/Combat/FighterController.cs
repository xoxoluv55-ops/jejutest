using System.Collections.Generic;
using UnityEngine;

namespace MuscleBattle
{
    public enum FighterState
    {
        Intro, Idle, Walk, Guard, GuardStun, Dodge, Attack, Hit, Air, Knockdown, GetUp,
        Grabbed, Throwing, Victory, Lose, KO
    }

    /// <summary>
    /// One fighter. Simulation is a deterministic 60 Hz state machine driven by CombatManager.Tick;
    /// this class is the ONLY thing that moves the fighter transform (FighterRig only animates
    /// child bones), which avoids several systems fighting over the same Transform (§65).
    /// </summary>
    public sealed class FighterController : MonoBehaviour
    {
        public const float Gravity = 19f;
        public const float ArenaRadius = 8.5f;
        const int BufferFrames = 8;
        const int PerfectGuardWindow = 6;

        // wiring
        public FighterDefinition Def { get; private set; }
        public int Side { get; private set; }
        public FighterController Opponent { get; set; }
        public IInputSource InputSource { get; set; }
        public FighterRig Rig { get; private set; }
        public CombatManager Combat { get; private set; }

        // state
        public FighterState State { get; private set; } = FighterState.Idle;
        public int StateFrame { get; private set; }
        public MoveData CurrentMove { get; private set; }
        public int MoveFrame { get; private set; }
        public float Hp { get; set; }
        public float Meter { get; set; }             // 0..300 (3 bars)
        public bool Adrenaline { get; set; }
        public float Height { get; private set; }     // airborne height
        public int JuggleCount { get; private set; }
        public int Stun { get; private set; }
        public InputFrame LastInput { get; private set; }
        public Vector3 Position { get => _pos; set => _pos = value; }

        // per-move hit bookkeeping
        public int HitsDone { get; set; }
        public int LastHitFrame { get; set; } = -100;
        public bool MoveConnected { get; set; }
        public bool ArmorUsed { get; set; }

        // MUSCLE LINK (set by MuscleSkillSystem for the current special)
        public bool MoveHeld { get; set; }            // frozen in start-up while choosing muscles / link visualisation
        public float LinkDamageMul { get; set; } = 1f;
        public int LinkExtraHits { get; set; }
        public LinkResult LastLink { get; set; }
        public int MuscleLinks { get; set; }
        public int PerfectLinks { get; set; }

        // stats for the result screen
        public int MaxCombo { get; set; }
        public int CounterHits { get; set; }
        public int PerfectCounters { get; set; }
        public int PerfectGuards { get; set; }
        public int SpecialsLanded { get; set; }
        public readonly HashSet<string> MovesUsed = new HashSet<string>();
        public int RoundWins { get; set; }

        Vector3 _pos;
        Vector3 _knockVel;
        float _vertVel;
        Vector3 _facing = Vector3.forward;
        Buttons _buffer;
        int _bufferAge;
        int _lastGuardPress = -999;
        int _tick;
        Vector3 _dodgeDir;
        int _grabTimer;
        FighterController _grabVictim;
        bool _lockedFacing;

        public Vector3 Facing => _facing;
        public bool IsAirborne => State == FighterState.Air || Height > 0.02f;
        public bool IsDown => State == FighterState.Knockdown || State == FighterState.GetUp || State == FighterState.KO;
        public bool HpLow => Hp <= Def.MaxHp * 0.25f;
        public float HpRatio => Mathf.Clamp01(Hp / Def.MaxHp);

        public bool IsInvulnerable =>
            State == FighterState.Knockdown || State == FighterState.GetUp || State == FighterState.KO ||
            State == FighterState.Grabbed || State == FighterState.Throwing || State == FighterState.Intro ||
            State == FighterState.Victory || State == FighterState.Lose ||
            (State == FighterState.Dodge && StateFrame >= 2 && StateFrame <= 15) || MoveHeld;

        public bool IsActiveFrame => State == FighterState.Attack && CurrentMove != null &&
                                     MoveFrame >= CurrentMove.Startup && MoveFrame < CurrentMove.Startup + CurrentMove.Active;

        public bool IsInStartup => State == FighterState.Attack && CurrentMove != null && MoveFrame < CurrentMove.Startup;

        public bool IsBlocking =>
            (State == FighterState.Guard || State == FighterState.GuardStun ||
             ((State == FighterState.Idle || State == FighterState.Walk) && LastInput.IsHeld(Buttons.Guard)));

        public bool PerfectGuardTiming => _tick - _lastGuardPress <= PerfectGuardWindow;

        public bool CanAct => State == FighterState.Idle || State == FighterState.Walk || State == FighterState.Guard;

        public void Init(FighterDefinition def, int side, CombatManager combat, FighterRig rig)
        {
            Def = def;
            Side = side;
            Combat = combat;
            Rig = rig;
            ResetForRound(Vector3.zero, Vector3.forward);
        }

        public void ResetForRound(Vector3 pos, Vector3 facing)
        {
            Hp = Def.MaxHp;
            _pos = pos;
            _facing = facing;
            Height = 0;
            _vertVel = 0;
            _knockVel = Vector3.zero;
            JuggleCount = 0;
            Adrenaline = false;
            CurrentMove = null;
            MoveHeld = false;
            _buffer = Buttons.None;
            SetState(FighterState.Intro);
            ApplyTransform(true);
        }

        public void ResetMatchStats()
        {
            Meter = 0;
            MaxCombo = CounterHits = PerfectCounters = PerfectGuards = SpecialsLanded = RoundWins = 0;
            MuscleLinks = PerfectLinks = 0;
            MovesUsed.Clear();
        }

        public void SetState(FighterState s)
        {
            State = s;
            StateFrame = 0;
            if (s != FighterState.Attack) CurrentMove = null;
            if (s == FighterState.Idle || s == FighterState.Walk || s == FighterState.Guard) _lockedFacing = false;
        }

        // ------------------------------------------------------------------
        // Simulation
        // ------------------------------------------------------------------

        /// <summary>Input polled even during hit stop so presses are buffered (feels responsive).</summary>
        public void PollInput()
        {
            var input = InputSource != null ? InputSource.Poll(this, Opponent) : default;
            LastInput = input;
            if (input.Pressed != Buttons.None)
            {
                _buffer |= input.Pressed;
                _bufferAge = 0;
            }
            if (input.WasPressed(Buttons.Guard)) _lastGuardPress = _tick;
        }

        public void Tick()
        {
            _tick++;
            StateFrame++;
            if (_bufferAge++ > BufferFrames) _buffer = Buttons.None;
            var input = LastInput;

            switch (State)
            {
                case FighterState.Intro:
                case FighterState.Victory:
                case FighterState.Lose:
                    break;

                case FighterState.Idle:
                case FighterState.Walk:
                case FighterState.Guard:
                    if (!TryStartAction(input)) TickNeutral(input);
                    break;

                case FighterState.GuardStun:
                    if (--Stun <= 0) SetState(input.IsHeld(Buttons.Guard) ? FighterState.Guard : FighterState.Idle);
                    break;

                case FighterState.Dodge:
                    TickDodge();
                    break;

                case FighterState.Attack:
                    TickAttack(input);
                    break;

                case FighterState.Hit:
                    if (--Stun <= 0) SetState(FighterState.Idle);
                    break;

                case FighterState.Air:
                    break; // handled by vertical physics below

                case FighterState.Knockdown:
                    if (StateFrame > 36 && Hp > 0) SetState(FighterState.GetUp);
                    break;

                case FighterState.GetUp:
                    if (StateFrame > 22) SetState(FighterState.Idle);
                    break;

                case FighterState.Throwing:
                    TickThrow();
                    break;

                case FighterState.Grabbed:
                    // break window: press grab (or light+kick) early
                    if (StateFrame <= 9 && (input.WasPressed(Buttons.Grab)) && Opponent.State == FighterState.Throwing)
                        Combat.OnGrabBreak(Opponent, this);
                    break;

                case FighterState.KO:
                    break;
            }

            TickPhysics();
            if (!_lockedFacing && State != FighterState.Air && State != FighterState.Knockdown && State != FighterState.KO) FaceOpponent(0.35f);
            ApplyTransform(false);
        }

        void TickNeutral(InputFrame input)
        {
            if (input.IsHeld(Buttons.Guard))
            {
                if (State != FighterState.Guard) SetState(FighterState.Guard);
                return;
            }

            var toOpp = FlatDir(Opponent.Position - _pos);
            var lateral = Vector3.Cross(Vector3.up, toOpp); // sign is resolved against the camera below
            var cam = CameraManager.Instance;
            float screenSign = cam != null ? Mathf.Sign(Vector3.Dot(toOpp, cam.FlatRight) + 0.0001f) : (Side == 0 ? 1 : -1);
            float fwd = input.Move.x * screenSign;
            float latSign = cam != null ? Mathf.Sign(Vector3.Dot(lateral, cam.FlatForward) + 0.0001f) : 1f;
            float side = input.Move.y * latSign;

            if (Mathf.Abs(fwd) < 0.1f && Mathf.Abs(side) < 0.1f)
            {
                if (State != FighterState.Idle) SetState(FighterState.Idle);
                return;
            }
            if (State != FighterState.Walk) SetState(FighterState.Walk);

            float dt = CombatManager.TickDt;
            float speed = fwd >= 0 ? Def.WalkSpeed : Def.BackSpeed;
            float dist = Vector3.Distance(Flat(_pos), Flat(Opponent.Position));
            var delta = toOpp * fwd * speed * dt;
            if (Mathf.Abs(side) > 0.1f)
            {
                // orbit around the opponent (sidestep) keeping distance
                var orbit = lateral * side * Def.SidestepSpeed * dt;
                var p = Flat(_pos) + orbit - Flat(Opponent.Position);
                p = p.normalized * dist;
                delta += (p + Flat(Opponent.Position)) - Flat(_pos);
            }
            _pos += delta;
        }

        bool TryStartAction(InputFrame input)
        {
            var b = _buffer;
            if (b == Buttons.None) return false;

            // Ultimate: Special + Heavy with a full meter
            if ((b & Buttons.Special) != 0 && (input.IsHeld(Buttons.Heavy) || (b & Buttons.Heavy) != 0) && Meter >= 300)
                return StartMove("ultimate");
            if ((b & Buttons.Special) != 0)
            {
                if (Meter >= 100) return StartMove("special");
                Combat.OnNotEnoughMeter(this);
                ConsumeBuffer(Buttons.Special);
            }
            if ((b & Buttons.Counter) != 0) return StartMove("counter");
            if ((b & Buttons.Grab) != 0) return StartMove("grab");
            if ((b & Buttons.Dodge) != 0) { StartDodge(input); return true; }
            if ((b & Buttons.Heavy) != 0) return StartMove("h1");
            if ((b & Buttons.Kick) != 0)
            {
                // back + kick = launcher (Kick -> Launch -> Air combo, §24)
                return StartMove(IsHoldingBack(input) ? "k2" : "k1");
            }
            if ((b & Buttons.Light) != 0) return StartMove("l1");
            return false;
        }

        bool IsHoldingBack(InputFrame input)
        {
            var cam = CameraManager.Instance;
            var toOpp = FlatDir(Opponent.Position - _pos);
            float screenSign = cam != null ? Mathf.Sign(Vector3.Dot(toOpp, cam.FlatRight) + 0.0001f) : 1f;
            return input.Move.x * screenSign < -0.5f;
        }

        void ConsumeBuffer(Buttons b) { _buffer &= ~b; }

        public bool StartMove(string id)
        {
            var m = Def.Move(id);
            if (m == null) return false;
            if (m.MeterCost > 0 && Meter < m.MeterCost) return false;
            Meter -= m.MeterCost;
            _buffer = Buttons.None;
            SetState(FighterState.Attack);
            CurrentMove = m;
            MoveFrame = 0;
            HitsDone = 0;
            LastHitFrame = -100;
            MoveConnected = false;
            ArmorUsed = false;
            MoveHeld = false;
            LinkDamageMul = 1f;
            LinkExtraHits = 0;
            LastLink = LinkResult.None;
            FaceOpponent(1f);
            _lockedFacing = true;
            MovesUsed.Add(m.Id);
            Combat.OnMoveStarted(this, m);
            return true;
        }

        void TickAttack(InputFrame input)
        {
            var m = CurrentMove;
            if (MoveHeld) return; // charging a Muscle Skill: hold the start-up pose
            MoveFrame++;

            // lunge during startup + active
            int travelFrames = m.Startup + m.Active;
            if (m.Lunge > 0 && MoveFrame <= travelFrames)
            {
                float step = m.Lunge / travelFrames;
                float dist = Vector3.Distance(Flat(_pos), Flat(Opponent.Position));
                float minDist = Def.BodyRadius + Opponent.Def.BodyRadius + 0.15f;
                if (dist - step > minDist || m.Kind == MoveKind.Special || m.Kind == MoveKind.Ultimate)
                    _pos += _facing * step;
            }

            // cancel window: once the move connected (hit or block), allow chain routes
            if (MoveConnected && MoveFrame >= m.Startup + 1)
            {
                string next = null;
                if ((_buffer & Buttons.Special) != 0 && m.ChainSpecial != null)
                {
                    if (input.IsHeld(Buttons.Heavy) && Meter >= 300) next = "ultimate";
                    else if (Meter >= 100) next = m.ChainSpecial;
                }
                else if ((_buffer & Buttons.Light) != 0) next = m.ChainLight;
                else if ((_buffer & Buttons.Heavy) != 0) next = m.ChainHeavy;
                else if ((_buffer & Buttons.Kick) != 0) next = m.ChainKick;
                if (next != null && StartMove(next)) return;
            }

            if (m.Kind == MoveKind.Counter && MoveFrame == m.Startup) Combat.OnCounterStance(this);

            if (MoveFrame >= m.Total)
            {
                SetState(input.IsHeld(Buttons.Guard) ? FighterState.Guard : FighterState.Idle);
            }
        }

        void StartDodge(InputFrame input)
        {
            _buffer = Buttons.None;
            var toOpp = FlatDir(Opponent.Position - _pos);
            var lateral = Vector3.Cross(Vector3.up, toOpp);
            var cam = CameraManager.Instance;
            float latSign = cam != null ? Mathf.Sign(Vector3.Dot(lateral, cam.FlatForward) + 0.0001f) : 1f;
            // up/down picks the side; neutral dodge = sidestep into the screen (classic 3D evasion)
            float dirSign = Mathf.Abs(input.Move.y) > 0.2f ? Mathf.Sign(input.Move.y) * latSign : latSign;
            _dodgeDir = lateral * dirSign;
            SetState(FighterState.Dodge);
            MovesUsed.Add("dodge");
            Combat.OnDodge(this);
        }

        void TickDodge()
        {
            const int frames = 20;
            if (StateFrame <= 14)
            {
                float dist = Vector3.Distance(Flat(_pos), Flat(Opponent.Position));
                var p = Flat(_pos) + _dodgeDir * (Def.DodgeDistance / 14f) - Flat(Opponent.Position);
                _pos = Flat(Opponent.Position) + p.normalized * dist;
            }
            if (StateFrame >= frames) SetState(FighterState.Idle);
        }

        // ------------------------------------------------------------------
        // Being hit / blocking
        // ------------------------------------------------------------------
        public void ApplyHit(MoveData m, Vector3 pushDir, float damage, bool launch)
        {
            Hp = Mathf.Max(0, Hp - damage);
            _lockedFacing = false;
            _knockVel = pushDir * (m.Knockback * 7f);

            if (launch || IsAirborne)
            {
                JuggleCount++;
                float up = m.Launch > 0 ? m.Launch : 3.6f;
                up *= Mathf.Max(0.35f, 1f - 0.12f * (JuggleCount - 1));
                _vertVel = up;
                if (Height < 0.05f) Height = 0.05f;
                SetState(FighterState.Air);
            }
            else if (m.Knockdown)
            {
                _vertVel = 4f;
                Height = 0.05f;
                JuggleCount = 99; // no follow ups on hard knockdown
                SetState(FighterState.Air);
            }
            else
            {
                SetState(FighterState.Hit);
                Stun = m.HitStun;
            }
            if (Hp <= 0)
            {
                _vertVel = Mathf.Max(_vertVel, 5.5f);
                _knockVel = pushDir * 6f;
                Height = Mathf.Max(Height, 0.05f);
                SetState(FighterState.Air);
            }
        }

        public void ApplyBlock(MoveData m, Vector3 pushDir, bool perfect)
        {
            SetState(FighterState.GuardStun);
            Stun = perfect ? Mathf.Max(2, m.BlockStun - 6) : m.BlockStun;
            _knockVel = pushDir * (m.Knockback * (perfect ? 2.5f : 4.5f));
            if (!perfect && (m.Kind == MoveKind.Special || m.Kind == MoveKind.Ultimate))
                Hp = Mathf.Max(1, Hp - m.Damage * 0.12f); // chip damage, never lethal
        }

        public void Recoil(Vector3 pushDir, float strength)
        {
            _knockVel += pushDir * strength;
        }

        public void ForceStun(int frames)
        {
            SetState(FighterState.Hit);
            Stun = frames;
        }

        public void BeginThrow(FighterController victim)
        {
            _grabVictim = victim;
            _grabTimer = 0;
            SetState(FighterState.Throwing);
            victim.SetState(FighterState.Grabbed);
            _lockedFacing = true;
        }

        public void CancelThrow()
        {
            _grabVictim = null;
            SetState(FighterState.Idle);
        }

        void TickThrow()
        {
            _grabTimer++;
            if (_grabVictim == null) { SetState(FighterState.Idle); return; }
            // hold the victim in front until the throw lands
            if (_grabVictim.State == FighterState.Grabbed)
            {
                var target = _pos + _facing * (Def.BodyRadius + _grabVictim.Def.BodyRadius + 0.05f);
                _grabVictim._pos = Vector3.Lerp(_grabVictim._pos, target, 0.35f);
            }
            if (_grabTimer == 22)
            {
                var throwMove = Def.Move("throw");
                Combat.OnThrowImpact(this, _grabVictim, throwMove);
            }
            if (_grabTimer >= 40)
            {
                _grabVictim = null;
                SetState(FighterState.Idle);
            }
        }

        // ------------------------------------------------------------------
        // Physics
        // ------------------------------------------------------------------
        void TickPhysics()
        {
            float dt = CombatManager.TickDt;

            // knockback with friction
            _pos += _knockVel * dt;
            float friction = IsAirborne ? 1.5f : 9f;
            _knockVel = Vector3.MoveTowards(_knockVel, Vector3.zero, friction * dt * Mathf.Max(1f, _knockVel.magnitude));

            if (State == FighterState.Air || Height > 0)
            {
                _vertVel -= Gravity * dt * (State == FighterState.Air && JuggleCount > 0 && JuggleCount < 99 ? 0.92f : 1f);
                Height += _vertVel * dt;
                if (Height <= 0)
                {
                    Height = 0;
                    _vertVel = 0;
                    if (State == FighterState.Air)
                    {
                        JuggleCount = 0;
                        Combat.OnLanded(this);
                        SetState(Hp <= 0 ? FighterState.KO : FighterState.Knockdown);
                    }
                }
            }

            // push boxes: fighters never overlap
            if (Opponent != null && !(State == FighterState.Throwing || State == FighterState.Grabbed))
            {
                var d = Flat(_pos) - Flat(Opponent.Position);
                float min = Def.BodyRadius + Opponent.Def.BodyRadius;
                float mag = d.magnitude;
                if (mag < min && !(IsAirborne || Opponent.IsAirborne))
                {
                    var n = mag > 0.001f ? d / mag : -_facing;
                    _pos += n * (min - mag) * 0.5f;
                }
            }

            // arena bounds (circular ring)
            var flat = Flat(_pos);
            if (flat.magnitude > ArenaRadius)
            {
                flat = flat.normalized * ArenaRadius;
                _pos = new Vector3(flat.x, _pos.y, flat.z);
                if (_knockVel.sqrMagnitude > 4f) Combat.OnWallSplat(this);
                _knockVel *= 0.2f;
            }
        }

        void FaceOpponent(float t)
        {
            if (Opponent == null) return;
            var dir = FlatDir(Opponent.Position - _pos);
            if (dir.sqrMagnitude < 0.001f) return;
            _facing = Vector3.Slerp(_facing, dir, t).normalized;
        }

        void ApplyTransform(bool snap)
        {
            transform.position = new Vector3(_pos.x, Height, _pos.z);
            transform.rotation = Quaternion.LookRotation(_facing, Vector3.up);
        }

        public void SetVictory(bool won)
        {
            _knockVel = Vector3.zero;
            if (Hp > 0 || won) SetState(won ? FighterState.Victory : FighterState.Lose);
        }

        public static Vector3 Flat(Vector3 v) => new Vector3(v.x, 0, v.z);
        public static Vector3 FlatDir(Vector3 v) { v.y = 0; return v.sqrMagnitude > 1e-6f ? v.normalized : Vector3.forward; }

        public Vector3 ChestPosition => new Vector3(_pos.x, Height + 1.25f * Def.Height, _pos.z);

        public Vector3 HitboxCenter(MoveData m) =>
            new Vector3(_pos.x, Height, _pos.z) + _facing * m.Reach + Vector3.up * m.HitHeight * Def.Height;
    }
}
