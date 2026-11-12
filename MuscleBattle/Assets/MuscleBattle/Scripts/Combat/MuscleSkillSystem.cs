using System.Collections.Generic;
using UnityEngine;

namespace MuscleBattle
{
    /// <summary>
    /// MUSCLE LINK (§9, §10, §11, §18, §21): when a special / ultimate starts, the fighter charges while
    /// the world runs in slow motion (combat never fully stops) and the player picks the muscles for the
    /// motion with the same 4 attack buttons (Light / Heavy / Kick / Dodge) or by tapping the cards.
    ///   all correct + fast  -> PERFECT MUSCLE LINK (damage x1.5, +1 hit on specials, meter refund)
    ///   all correct          -> MUSCLE LINK (damage x1.25)
    ///   some correct         -> base skill
    ///   wrong / time out     -> WEAK LINK (damage x0.6)
    /// Learn -> Practice -> Recall: first time the answer is shown, second time one hint, then none.
    /// </summary>
    public sealed class MuscleSkillSystem : MonoBehaviour
    {
        public static MuscleSkillSystem Instance { get; private set; }
        public static readonly Buttons[] CardButtons = { Buttons.Light, Buttons.Heavy, Buttons.Kick, Buttons.Dodge };

        public bool Active => _selector != null;
        public FighterController Selector => _selector;

        FighterController _selector;
        MoveData _move;
        MuscleQuestion _q;
        bool _cpu;
        float _elapsed, _limit;
        readonly List<int> _picks = new List<int>();
        float _cpuNextPick;
        float _resultTimer;
        LinkResult _result;
        int _hintLevel;

        void Awake() { Instance = this; }

        public static int HintLevel(MuscleQuestion q) => Mathf.Clamp(PlayerPrefs.GetInt("mb.q." + q.Id + ".seen", 0), 0, 2);

        public bool TryBegin(FighterController f, MoveData m)
        {
            var q = MuscleSkillDatabase.For(f.Def.Id, m.Kind == MoveKind.Ultimate);
            if (q == null || Active) return false;
            _selector = f;
            _move = m;
            _q = q;
            _cpu = f.InputSource is CpuInputSource;
            _picks.Clear();
            _elapsed = 0;
            _result = LinkResult.None;
            _resultTimer = 0;
            _hintLevel = _cpu ? 2 : HintLevel(q);
            _limit = (q.ForceCouple ? 5f : 4f) + (_hintLevel == 0 ? 2f : 0f);
            _cpuNextPick = Random.Range(0.7f, 1.2f);
            f.MoveHeld = true;

            TimeController.Instance?.Clear();
            TimeController.Instance?.SlowMotion(0.25f, 30f);
            AudioManager.Instance?.PlaySfx("link_charge", 0.9f);
            AudioManager.Instance?.DuckMusic(0.5f, _limit);
            VFXManager.Instance?.SuperFlash(f, f.Def.Energy, false);
            CameraManager.Instance?.Focus(f, _limit, 0.75f);
            Hud.Instance?.MuscleSelect.Open(q, f, _cpu, _hintLevel, _limit);
            return true;
        }

        void Update()
        {
            if (!Active) return;
            var combat = CombatManager.Instance;
            if (combat == null || combat.Paused) return;
            if (combat.Phase != MatchPhase.Fighting) { Cancel(); return; }
            float dt = Time.unscaledDeltaTime;
            var ui = Hud.Instance?.MuscleSelect;

            if (_result != LinkResult.None)
            {
                _resultTimer -= dt;
                if (_resultTimer <= 0) Release();
                return;
            }

            _elapsed += dt;
            ui?.SetTime(1f - _elapsed / _limit);

            if (_cpu)
            {
                if (_elapsed >= _cpuNextPick) CpuPick();
            }
            else
            {
                // read the selector's own devices directly every frame (sim ticks are slowed)
                var input = _selector.InputSource.Poll(_selector, _selector.Opponent);
                for (int i = 0; i < CardButtons.Length && i < _q.Options.Length; i++)
                    if (input.WasPressed(CardButtons[i])) Pick(i);
                if (ui != null)
                    for (int i = 0; i < _q.Options.Length; i++)
                        if (MenuInput.PointerDownOver(ui.CardRect(i))) Pick(i);
            }

            if (_result == LinkResult.None && (_picks.Count >= _q.CorrectCount || _elapsed >= _limit)) Evaluate();
        }

        void CpuPick()
        {
            float acc = GameSettings.Difficulty switch { CpuDifficulty.Easy => 0.45f, CpuDifficulty.Normal => 0.72f, _ => 0.9f };
            var candidates = new List<int>();
            bool wantCorrect = Random.value < acc;
            for (int i = 0; i < _q.Options.Length; i++)
                if (!_picks.Contains(i) && _q.Options[i].Correct == wantCorrect) candidates.Add(i);
            if (candidates.Count == 0)
                for (int i = 0; i < _q.Options.Length; i++) if (!_picks.Contains(i)) candidates.Add(i);
            if (candidates.Count > 0) Pick(candidates[Random.Range(0, candidates.Count)]);
            _cpuNextPick = _elapsed + Random.Range(0.35f, 0.7f);
        }

        void Pick(int i)
        {
            if (_picks.Contains(i) || _result != LinkResult.None) return;
            _picks.Add(i);
            AudioManager.Instance?.PlaySfx("ui_skill", 0.7f, 1f + _picks.Count * 0.08f);
            Hud.Instance?.MuscleSelect.SetPicked(i);
            // light the picked muscle on the body right away - visual feedback + learning
            _selector.Rig?.GlowMuscles(PickedGroups(), 2f, _q.Options[i].Correct || _cpu ? _selector.Def.Energy : Palette.Muscle);
        }

        MuscleGroup PickedGroups()
        {
            var g = MuscleGroup.None;
            foreach (var p in _picks) g |= _q.Options[p].Group;
            return g;
        }

        void Evaluate()
        {
            int correct = 0, wrong = 0;
            foreach (var p in _picks)
                if (_q.Options[p].Correct) correct++;
                else wrong++;

            if (correct == _q.CorrectCount && wrong == 0)
                _result = _elapsed <= _q.PerfectWithin ? LinkResult.Perfect : LinkResult.Link;
            else if (correct > 0 && wrong <= 1)
                _result = LinkResult.Partial;
            else
                _result = LinkResult.Miss;

            var f = _selector;
            switch (_result)
            {
                case LinkResult.Perfect:
                    f.LinkDamageMul = 1.5f;
                    f.LinkExtraHits = _move.Kind == MoveKind.Special ? 1 : 0;
                    f.Meter = Mathf.Min(300, f.Meter + 30);
                    f.PerfectLinks++;
                    f.MuscleLinks++;
                    break;
                case LinkResult.Link:
                    f.LinkDamageMul = 1.25f;
                    f.MuscleLinks++;
                    break;
                case LinkResult.Partial:
                    f.LinkDamageMul = 1f;
                    break;
                default:
                    f.LinkDamageMul = 0.6f;
                    break;
            }
            f.LastLink = _result;

            if (!_cpu)
            {
                string key = "mb.q." + _q.Id;
                PlayerPrefs.SetInt(key + ".seen", PlayerPrefs.GetInt(key + ".seen", 0) + 1);
                if (_result == LinkResult.Perfect || _result == LinkResult.Link)
                    PlayerPrefs.SetInt(key + ".correct", PlayerPrefs.GetInt(key + ".correct", 0) + 1);
                PlayerPrefs.Save();
            }

            bool good = _result == LinkResult.Perfect || _result == LinkResult.Link;
            AudioManager.Instance?.PlaySfx(good ? "link_success" : _result == LinkResult.Partial ? "ui_confirm" : "link_fail", 0.9f);
            Hud.Instance?.MuscleSelect.ShowResult(_result, _q);
            Hud.Instance?.Commentary(_q.Explanation, 4.5f);
            _resultTimer = 0.75f;
        }

        void Release()
        {
            var f = _selector;
            var m = _move;
            var r = _result;
            var q = _q;
            _selector = null;
            Hud.Instance?.MuscleSelect.Close();
            TimeController.Instance?.Clear();
            f.MoveHeld = false;
            CombatManager.Instance?.OnMuscleSkillResolved(f, m, q, r);
        }

        public void Cancel()
        {
            if (_selector != null) _selector.MoveHeld = false;
            _selector = null;
            Hud.Instance?.MuscleSelect.Close();
        }
    }
}
