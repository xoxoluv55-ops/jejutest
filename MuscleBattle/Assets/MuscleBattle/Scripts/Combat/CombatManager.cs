using System;
using System.Collections;
using UnityEngine;

namespace MuscleBattle
{
    public enum MatchPhase { Idle, RoundIntro, Fighting, RoundEnd, MatchEnd }

    /// <summary>Result data handed to the result screen.</summary>
    public sealed class MatchResult
    {
        public FighterController Winner, Loser;
        public bool Draw;
        public int Rounds;
    }

    /// <summary>
    /// Owns the fixed 60 Hz combat simulation: input polling, hit stop, super freeze,
    /// hit detection, combo / damage scaling, meter, rounds, timer and KO flow.
    /// Every "juice" reaction (VFX, SFX, camera, UI, slow motion) is triggered from here so a
    /// single hit always fires Animation + VFX + SFX + Camera + UI together (§8).
    /// </summary>
    public sealed class CombatManager : MonoBehaviour
    {
        public const float TickDt = 1f / 60f;
        public static CombatManager Instance { get; private set; }

        public readonly FighterController[] Fighters = new FighterController[2];
        public MatchPhase Phase { get; private set; } = MatchPhase.Idle;
        public int RoundNumber { get; private set; }
        public float TimeLeft { get; private set; }
        public bool IsFinalRound { get; private set; }
        public bool Paused { get; set; }
        public event Action<MatchResult> MatchFinished;

        readonly ComboState[] _combo = { new ComboState(), new ComboState() };
        float _accumulator;
        int _hitStop;
        int _freeze;
        bool _koHandled;

        sealed class ComboState
        {
            public int Hits;
            public float Damage;
        }

        void Awake() { Instance = this; }

        public int ComboHits(int side) => _combo[side].Hits;

        public void Setup(FighterController a, FighterController b)
        {
            Fighters[0] = a;
            Fighters[1] = b;
            a.Opponent = b;
            b.Opponent = a;
        }

        public void StartMatch()
        {
            RoundNumber = 0;
            foreach (var f in Fighters) f.ResetMatchStats();
            StopAllCoroutines();
            StartCoroutine(RoundIntroRoutine());
        }

        public void Abort()
        {
            StopAllCoroutines();
            Phase = MatchPhase.Idle;
            TimeController.Instance?.Clear();
        }

        // ------------------------------------------------------------------
        // Round flow
        // ------------------------------------------------------------------
        IEnumerator RoundIntroRoutine()
        {
            RoundNumber++;
            Phase = MatchPhase.RoundIntro;
            _koHandled = false;
            _hitStop = 0;
            _freeze = 0;
            TimeLeft = GameSettings.RoundTime;
            _combo[0].Hits = _combo[1].Hits = 0;
            TimeController.Instance?.Clear();

            Fighters[0].ResetForRound(new Vector3(-1.7f, 0, 0), Vector3.right);
            Fighters[1].ResetForRound(new Vector3(1.7f, 0, 0), Vector3.left);
            CameraManager.Instance?.SnapToFighters();

            int need = GameSettings.RoundsToWin;
            IsFinalRound = Fighters[0].RoundWins == need - 1 && Fighters[1].RoundWins == need - 1;
            AudioManager.Instance?.SetFinalRoundLayer(IsFinalRound);
            if (RoundNumber == 1) AudioManager.Instance?.PlayBgm("battle", true);

            yield return new WaitForSeconds(0.5f);
            string roundText = IsFinalRound ? "FINAL ROUND" : "ROUND " + RoundNumber;
            Hud.Instance?.RoundBanner(roundText, IsFinalRound ? Palette.Muscle : Palette.Gold);
            AudioManager.Instance?.Announce(IsFinalRound ? "final_round" : RoundNumber == 1 ? "round1" : "round2");
            yield return new WaitForSeconds(1.35f);
            Hud.Instance?.FightBanner();
            AudioManager.Instance?.Announce("fight");
            AudioManager.Instance?.PlaySfx("heavy", 0.5f);
            CameraManager.Instance?.Shake(0.35f);
            foreach (var f in Fighters) f.SetState(FighterState.Idle);
            Phase = MatchPhase.Fighting;
        }

        void Update()
        {
            if (Paused || (Phase != MatchPhase.Fighting && Phase != MatchPhase.RoundEnd)) return;
            _accumulator += Time.deltaTime;
            int guard = 0;
            while (_accumulator >= TickDt && guard++ < 5)
            {
                _accumulator -= TickDt;
                Step();
            }
            if (guard >= 5) _accumulator = 0;
        }

        void Step()
        {
            bool fighting = Phase == MatchPhase.Fighting;
            if (fighting) foreach (var f in Fighters) f.PollInput();

            if (_hitStop > 0) { _hitStop--; return; }
            if (_freeze > 0) { _freeze--; return; }

            foreach (var f in Fighters) f.Tick();
            if (!fighting) return;

            ResolveHits(Fighters[0], Fighters[1]);
            ResolveHits(Fighters[1], Fighters[0]);

            for (int i = 0; i < 2; i++)
            {
                var d = Fighters[1 - i];
                if (_combo[i].Hits > 0 && !(d.State == FighterState.Hit || d.State == FighterState.Air || d.State == FighterState.Grabbed))
                {
                    _combo[i].Hits = 0;
                    _combo[i].Damage = 0;
                    Hud.Instance?.ComboEnded(i);
                }
            }

            TimeLeft -= TickDt;
            if (TimeLeft <= 0 && Phase == MatchPhase.Fighting)
            {
                TimeLeft = 0;
                StartCoroutine(TimeUpRoutine());
            }
        }

        // ------------------------------------------------------------------
        // Hit detection
        // ------------------------------------------------------------------
        void ResolveHits(FighterController a, FighterController d)
        {
            if (!a.IsActiveFrame || d.IsInvulnerable) return;
            var m = a.CurrentMove;
            if (m.Kind == MoveKind.Counter) return;
            if (m.Hits <= 1 && a.MoveConnected) return;
            if (m.Hits > 1 && (a.HitsDone >= m.Hits || a.MoveFrame - a.LastHitFrame < m.HitInterval)) return;

            var center = a.HitboxCenter(m);
            float bottom = d.Height + (d.IsDown ? 0f : 0.15f);
            float top = d.Height + (d.IsDown ? 0.45f : 1.85f * d.Def.Height);
            float dist = DistancePointSegment(center, new Vector3(d.Position.x, bottom, d.Position.z), new Vector3(d.Position.x, top, d.Position.z));
            if (dist > m.Radius + d.Def.BodyRadius) return;

            var contact = Vector3.Lerp(center, d.ChestPosition, 0.45f);
            contact.y = Mathf.Clamp(center.y, bottom + 0.2f, top - 0.1f);
            var push = FighterController.FlatDir(d.Position - a.Position);

            // grabs
            if (m.Kind == MoveKind.Grab)
            {
                if (d.IsAirborne) return;
                a.MoveConnected = true;
                a.BeginThrow(d);
                AudioManager.Instance?.PlayVariant("grab", contact);
                Hud.Instance?.Callout(a.Side, "GRAB!", Palette.Gold);
                return;
            }

            // perfect counter stance (§22)
            if (d.State == FighterState.Attack && d.CurrentMove.Kind == MoveKind.Counter && d.IsActiveFrame &&
                m.Kind != MoveKind.Ultimate && !m.Unblockable)
            {
                a.MoveConnected = true;
                PerfectCounter(d, a, contact);
                return;
            }

            bool facing = Vector3.Dot(d.Facing, -push) > 0.1f;
            bool blocking = d.IsBlocking && facing && !m.Unblockable && !d.IsAirborne;
            a.MoveConnected = true;
            a.HitsDone++;
            a.LastHitFrame = a.MoveFrame;

            if (blocking)
            {
                bool perfect = d.PerfectGuardTiming && m.Kind != MoveKind.Ultimate;
                d.ApplyBlock(m, push, perfect);
                a.Recoil(-push, perfect ? 3.5f : 1.5f);
                AddMeter(a, m.MeterOnBlock);
                AddMeter(d, perfect ? 12 : 2);
                _hitStop = perfect ? 8 : 4;
                VFXManager.Instance?.GuardSpark(contact, -push, perfect);
                AudioManager.Instance?.PlayVariant("block", contact);
                CameraManager.Instance?.Shake(perfect ? 0.25f : 0.12f);
                if (perfect)
                {
                    d.PerfectGuards++;
                    Hud.Instance?.Callout(d.Side, "PERFECT GUARD", Palette.Nerve);
                    AudioManager.Instance?.PlaySfx("counter", 0.55f);
                }
                return;
            }

            // super armor (Strength Coach special)
            if (d.State == FighterState.Attack && d.CurrentMove.Armor && d.IsInStartup && !d.ArmorUsed)
            {
                d.ArmorUsed = true;
                float armored = m.Damage * 0.6f;
                d.Hp = Mathf.Max(1, d.Hp - armored);
                _hitStop = 6;
                d.Rig?.Flash(Palette.MuscleHot, 0.15f);
                VFXManager.Instance?.HitSpark(contact, push, Palette.MuscleHot, ImpactTier.Medium);
                AudioManager.Instance?.PlayVariant("block", contact);
                Hud.Instance?.Callout(d.Side, "ARMOR", Palette.MuscleHot);
                return;
            }

            bool counterHit = d.IsInStartup && d.CurrentMove.IsStrike;
            ApplyDamage(a, d, m, contact, push, counterHit);
        }

        void ApplyDamage(FighterController a, FighterController d, MoveData m, Vector3 contact, Vector3 push, bool counterHit)
        {
            var combo = _combo[a.Side];
            bool continuing = d.State == FighterState.Hit || d.State == FighterState.Air || d.State == FighterState.Grabbed;
            if (!continuing) { combo.Hits = 0; combo.Damage = 0; }
            combo.Hits++;

            float scale = combo.Hits <= 2 ? 1f : Mathf.Max(m.Kind == MoveKind.Ultimate ? 0.6f : 0.35f, 1f - 0.1f * (combo.Hits - 2));
            float damage = m.Damage * scale * d.Def.DamageTaken * (counterHit ? 1.25f : 1f);
            bool launch = m.Launch > 0 || (d.IsAirborne && d.JuggleCount < 99);
            bool lastHitOfMulti = m.Hits > 1 && a.HitsDone >= m.Hits;
            var hitMove = m;
            if (lastHitOfMulti && m.Kind != MoveKind.Throw)
            {
                // the final hit of a rush sends the opponent flying
                hitMove = m.Clone();
                hitMove.Knockback = 2.2f;
                hitMove.Knockdown = true;
                hitMove.Launch = m.Kind == MoveKind.Ultimate ? 7.5f : 0;
                launch = hitMove.Launch > 0;
            }
            d.ApplyHit(hitMove, push, damage, launch);
            combo.Damage += damage;
            a.MaxCombo = Mathf.Max(a.MaxCombo, combo.Hits);
            if (counterHit) a.CounterHits++;
            if (m.Kind == MoveKind.Special || m.Kind == MoveKind.Ultimate) a.SpecialsLanded++;

            float gainMul = a.Adrenaline ? 1.5f : 1f;
            AddMeter(a, m.MeterOnHit * gainMul);
            AddMeter(d, damage * 0.05f * (d.Adrenaline ? 1.5f : 1f));

            // ---- juice ----
            var tier = counterHit && m.Impact < ImpactTier.Heavy ? m.Impact + 1 : m.Impact;
            _hitStop = HitStopFrames(tier) + (counterHit ? 3 : 0);
            Color sparkColor = m.Kind == MoveKind.Ultimate || m.Kind == MoveKind.Special ? a.Def.Energy : Palette.Muscle;
            VFXManager.Instance?.HitSpark(contact, push, sparkColor, tier);
            if (tier >= ImpactTier.Heavy) VFXManager.Instance?.Shockwave(contact, sparkColor);
            d.Rig?.Flash(Color.white, 0.09f);
            AudioManager.Instance?.PlayImpact(m.Sfx, tier, contact);
            CameraManager.Instance?.Shake(ShakeFor(tier) * (counterHit ? 1.3f : 1f));
            if (tier >= ImpactTier.Heavy) CameraManager.Instance?.Punch(tier == ImpactTier.Ultimate ? 0.12f : 0.06f);
            StageManager.Instance?.ImpactPulse(tier);

            if (counterHit)
            {
                Hud.Instance?.Callout(a.Side, "COUNTER!", Palette.Gold);
                AudioManager.Instance?.Announce("counter");
            }
            if (launch && m.Launch > 0) Hud.Instance?.Callout(a.Side, "LAUNCH!", Palette.Nerve);
            if (combo.Hits >= 2) Hud.Instance?.Combo(a.Side, combo.Hits, combo.Damage);

            CheckAdrenaline(d);
            if (d.Hp <= 0 && !_koHandled) StartCoroutine(KoRoutine(a, d, m));
        }

        void PerfectCounter(FighterController defender, FighterController attacker, Vector3 contact)
        {
            defender.PerfectCounters++;
            attacker.ForceStun(42);
            defender.StartMove("counterStrike");
            _hitStop = 14;
            TimeController.Instance?.SlowMotion(0.3f, 0.75f);
            CameraManager.Instance?.Focus(defender, 0.8f, 0.55f);
            CameraManager.Instance?.Shake(0.4f);
            VFXManager.Instance?.CounterFlash(contact);
            VFXManager.Instance?.ScreenFlash(Palette.Bone, 0.35f);
            AudioManager.Instance?.PlaySfx("counter", 1f);
            AudioManager.Instance?.Announce("counter");
            Hud.Instance?.Callout(defender.Side, "PERFECT COUNTER", Palette.Gold, true);
            AddMeter(defender, 25);
        }

        public void OnThrowImpact(FighterController a, FighterController d, MoveData m)
        {
            if (d.State != FighterState.Grabbed) return;
            var push = FighterController.FlatDir(d.Position - a.Position);
            a.MoveConnected = true;
            ApplyDamage(a, d, m, d.ChestPosition, push, false);
            VFXManager.Instance?.Dust(d.Position);
            a.Rig?.GlowMuscles(m.Muscles, 0.6f, Palette.Muscle);
        }

        public void OnGrabBreak(FighterController thrower, FighterController victim)
        {
            thrower.CancelThrow();
            victim.SetState(FighterState.Idle);
            var push = FighterController.FlatDir(victim.Position - thrower.Position);
            victim.Recoil(push, 5f);
            thrower.Recoil(-push, 5f);
            _hitStop = 6;
            VFXManager.Instance?.GuardSpark(Vector3.Lerp(thrower.ChestPosition, victim.ChestPosition, 0.5f), push, true);
            AudioManager.Instance?.PlayVariant("block", victim.ChestPosition);
            Hud.Instance?.Callout(victim.Side, "GRAB BREAK", Palette.Nerve);
        }

        // ------------------------------------------------------------------
        // Events from fighters
        // ------------------------------------------------------------------
        public void OnMoveStarted(FighterController f, MoveData m)
        {
            AudioManager.Instance?.PlayVariant("whoosh", f.ChestPosition, m.Impact >= ImpactTier.Heavy ? 0.9f : 0.55f);
            f.Rig?.PlayMove(m);
            if (m.Muscles != MuscleGroup.None && m.Impact >= ImpactTier.Medium)
                f.Rig?.GlowMuscles(m.Muscles, (m.Startup + m.Active) * TickDt + 0.25f, m.Kind >= MoveKind.Special ? f.Def.Energy : Palette.Muscle);

            if (m.Kind == MoveKind.Special)
            {
                _freeze = 18;
                TimeController.Instance?.SlowMotion(0.55f, 0.45f);
                Hud.Instance?.SkillCutIn(f, m, false);
                VFXManager.Instance?.SuperFlash(f, f.Def.Energy, false);
                AudioManager.Instance?.PlaySfx("special", 0.9f);
                AudioManager.Instance?.Announce("special");
                CameraManager.Instance?.Focus(f, 0.55f, 0.65f);
            }
            else if (m.Kind == MoveKind.Ultimate)
            {
                _freeze = 50;
                TimeController.Instance?.SlowMotion(0.4f, 1.6f);
                Hud.Instance?.SkillCutIn(f, m, true);
                VFXManager.Instance?.SuperFlash(f, f.Def.Energy, true);
                AudioManager.Instance?.PlaySfx("special", 1f);
                AudioManager.Instance?.Announce("muscle_link");
                CameraManager.Instance?.Cinematic(f, 1.8f);
                StageManager.Instance?.ImpactPulse(ImpactTier.Ultimate);
            }
        }

        public void OnCounterStance(FighterController f)
        {
            VFXManager.Instance?.CounterStance(f);
        }

        public void OnDodge(FighterController f)
        {
            AudioManager.Instance?.PlayVariant("whoosh", f.ChestPosition, 0.7f);
            VFXManager.Instance?.Afterimage(f);
            VFXManager.Instance?.Dust(f.Position);
        }

        public void OnLanded(FighterController f)
        {
            AudioManager.Instance?.PlayVariant("land", f.Position);
            VFXManager.Instance?.Dust(f.Position);
            CameraManager.Instance?.Shake(0.18f);
        }

        public void OnWallSplat(FighterController f)
        {
            VFXManager.Instance?.Shockwave(f.ChestPosition, Palette.StageNeonA);
            CameraManager.Instance?.Shake(0.2f);
        }

        public void OnNotEnoughMeter(FighterController f)
        {
            Hud.Instance?.MeterDenied(f.Side);
            AudioManager.Instance?.PlaySfx("ui_wrong", 0.5f);
        }

        void AddMeter(FighterController f, float amount)
        {
            int before = Mathf.FloorToInt(f.Meter / 100f);
            f.Meter = Mathf.Min(300, f.Meter + amount);
            int after = Mathf.FloorToInt(f.Meter / 100f);
            if (after > before)
            {
                AudioManager.Instance?.PlaySfx("meter_full", 0.6f);
                Hud.Instance?.MeterLevelUp(f.Side, after);
            }
        }

        void CheckAdrenaline(FighterController f)
        {
            if (f.Adrenaline || !f.HpLow || f.Hp <= 0) return;
            f.Adrenaline = true; // §23: comeback = faster meter gain, not free damage
            Hud.Instance?.Callout(f.Side, "ADRENALINE STATE", Palette.Muscle, true);
            AudioManager.Instance?.Announce("adrenaline");
            VFXManager.Instance?.SetAura(f, true);
        }

        static int HitStopFrames(ImpactTier t) => t switch
        {
            ImpactTier.Light => 4,
            ImpactTier.Medium => 6,
            ImpactTier.Heavy => 9,
            _ => 12,
        };

        static float ShakeFor(ImpactTier t) => t switch
        {
            ImpactTier.Light => 0.07f,
            ImpactTier.Medium => 0.13f,
            ImpactTier.Heavy => 0.24f,
            _ => 0.35f,
        };

        // ------------------------------------------------------------------
        // KO / time up
        // ------------------------------------------------------------------
        IEnumerator KoRoutine(FighterController winner, FighterController loser, MoveData finalMove)
        {
            _koHandled = true;
            Phase = MatchPhase.RoundEnd;
            bool anatomyFinish = finalMove.Kind == MoveKind.Special || finalMove.Kind == MoveKind.Ultimate;

            // final hit: hit stop -> zoom -> slow motion -> impact -> bass (§46)
            _hitStop = 22;
            VFXManager.Instance?.ScreenFlash(Color.white, 0.5f);
            VFXManager.Instance?.KoBurst(loser.ChestPosition, winner.Def.Energy);
            AudioManager.Instance?.PlaySfx("ko_boom", 1f);
            AudioManager.Instance?.DuckMusic(0.25f, 2.5f);
            CameraManager.Instance?.Focus(loser, 2.2f, 0.5f);
            CameraManager.Instance?.Shake(0.5f);
            TimeController.Instance?.SlowMotion(0.22f, 1.6f);
            yield return new WaitForSecondsRealtime(0.25f);
            Hud.Instance?.KoBanner(anatomyFinish);
            AudioManager.Instance?.Announce(anatomyFinish ? "anatomy_finish" : "ko");

            yield return new WaitForSecondsRealtime(2.2f);
            float t = 0;
            while ((loser.IsAirborne || loser.State == FighterState.Air) && t < 2f) { t += Time.unscaledDeltaTime; yield return null; }
            yield return new WaitForSecondsRealtime(0.3f);
            EndRound(winner);
        }

        IEnumerator TimeUpRoutine()
        {
            Phase = MatchPhase.RoundEnd;
            Hud.Instance?.RoundBanner("TIME UP", Palette.Gold);
            AudioManager.Instance?.Announce("time_up");
            yield return new WaitForSecondsRealtime(1.8f);
            var a = Fighters[0];
            var b = Fighters[1];
            if (Mathf.Abs(a.HpRatio - b.HpRatio) < 0.001f)
            {
                Hud.Instance?.RoundBanner("DRAW", Palette.TextDim);
                AudioManager.Instance?.Announce("draw");
                yield return new WaitForSecondsRealtime(1.5f);
                if (RoundNumber >= 5) EndRound(a); // safety valve
                else StartCoroutine(RoundIntroRoutine());
                yield break;
            }
            EndRound(a.HpRatio > b.HpRatio ? a : b);
        }

        void EndRound(FighterController winner)
        {
            var loser = winner.Opponent;
            winner.RoundWins++;
            winner.SetVictory(true);
            loser.SetVictory(false);
            VFXManager.Instance?.SetAura(winner, false);
            VFXManager.Instance?.SetAura(loser, false);
            Hud.Instance?.ComboEnded(0);
            Hud.Instance?.ComboEnded(1);

            if (winner.RoundWins >= GameSettings.RoundsToWin)
            {
                Phase = MatchPhase.MatchEnd;
                StartCoroutine(MatchEndRoutine(winner));
            }
            else
            {
                StartCoroutine(NextRoundRoutine(winner));
            }
        }

        IEnumerator NextRoundRoutine(FighterController winner)
        {
            CameraManager.Instance?.Focus(winner, 1.6f, 0.75f);
            yield return new WaitForSecondsRealtime(1.6f);
            yield return ScreenTransition.Instance != null ? ScreenTransition.Instance.Play(null) : null;
            StartCoroutine(RoundIntroRoutine());
        }

        IEnumerator MatchEndRoutine(FighterController winner)
        {
            AudioManager.Instance?.StopBgm(0.4f);
            AudioManager.Instance?.Announce("victory");
            AudioManager.Instance?.PlayBgm("victory", false);
            CameraManager.Instance?.VictoryShot(winner);
            Hud.Instance?.VictoryBanner(winner);
            VFXManager.Instance?.VictoryBurst(winner);
            yield return new WaitForSecondsRealtime(3.2f);
            MatchFinished?.Invoke(new MatchResult { Winner = winner, Loser = winner.Opponent, Rounds = RoundNumber });
        }

        static float DistancePointSegment(Vector3 p, Vector3 a, Vector3 b)
        {
            var ab = b - a;
            float t = Mathf.Clamp01(Vector3.Dot(p - a, ab) / Mathf.Max(1e-5f, ab.sqrMagnitude));
            return Vector3.Distance(p, a + ab * t);
        }
    }
}
