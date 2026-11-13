using System.Collections.Generic;
using UnityEngine;

namespace MuscleBattle
{
    /// <summary>
    /// MUSCLE LINK CHALLENGE - the core loop of MUSCLE BATTLE:
    ///   fight -> Special gauge (1 bar) -> Muscle Skill (Special button) -> muscle question
    ///   -> player picks -> LINK! -> judged -> skill changes -> the real attack fires.
    ///
    /// While the question is open the world runs at ~0.2x (combat never fully stops), the selecting
    /// fighter is invulnerable and frozen in its start-up pose, and its input is read ONLY here
    /// (cards: Light / Heavy / Kick / Dodge or tap, LINK!: Special or tap) so nothing leaks into movement.
    ///
    ///   PERFECT (all correct, nothing wrong) -> damage x1.35, +1 hit (force couple +2), gauge +35, faster recovery
    ///   PARTIAL (at least one correct)       -> damage x0.85, no extension
    ///   FAILED  (nothing correct / time out)  -> weak version x0.6, the attack still fires
    ///
    /// Learn -> Practice -> Recall per question (PlayerPrefs): first time the answer is explained and
    /// marked before choosing, second time one hint, after that no hints. A match never repeats a
    /// question until the fighter's pool is used up (Shoulder Abduction always opens Jin's pool).
    /// </summary>
    public sealed class MuscleSkillSystem : MonoBehaviour
    {
        public static MuscleSkillSystem Instance { get; private set; }
        public static readonly Buttons[] CardButtons = { Buttons.Light, Buttons.Heavy, Buttons.Kick, Buttons.Dodge };
        public const Buttons LinkButton = Buttons.Special;
        const float WorldSlowScale = 0.2f;

        public bool Active => _selector != null;
        public FighterController Selector => _selector;
        public MuscleQuestion Current => _q;

        FighterController _selector;
        MoveData _move;
        MuscleQuestion _q;
        bool _cpu;
        int _stage;
        float _elapsed, _limit, _tutorial;
        readonly List<int> _picks = new List<int>();
        float _cpuNextAction;
        float _resultTimer;
        LinkResult _result;
        readonly Dictionary<string, Queue<string>> _matchPools = new Dictionary<string, Queue<string>>();

        void Awake() { Instance = this; }

        /// <summary>Render the anatomy cards of a fighter's question pools ahead of time (during the round intro).</summary>
        public static void Prewarm(FighterDefinition def)
        {
            if (def == null || GameSettings.Knowledge != KnowledgeLevel.Rookie) return;
            foreach (bool ult in new[] { false, true })
                foreach (var id in MuscleSkillDatabase.Pool(def.Id, ult))
                {
                    var q = MuscleSkillDatabase.Get(id);
                    if (q == null) continue;
                    foreach (var o in q.Options)
                        if (!o.Nerve && o.Group != MuscleGroup.None) PortraitStudio.GetAnatomy(def, o.Group, Palette.MuscleHot);
                }
        }

        /// <summary>New match: question pools restart (Shoulder Abduction first again).</summary>
        public void ResetMatch() => _matchPools.Clear();

        MuscleQuestion NextQuestion(FighterController f, bool ultimate)
        {
            var pool = MuscleSkillDatabase.Pool(f.Def.Id, ultimate);
            if (pool.Length == 0) return null;
            string key = f.Side + ":" + f.Def.Id + (ultimate ? ":ult" : ":sp");
            if (!_matchPools.TryGetValue(key, out var queue) || queue.Count == 0)
            {
                // first entry stays first the very first time, the rest is shuffled; refills are fully shuffled
                bool first = !_matchPools.ContainsKey(key);
                var list = new List<string>(pool);
                int start = first ? 1 : 0;
                for (int i = list.Count - 1; i > start; i--)
                {
                    int j = Random.Range(start, i + 1);
                    (list[i], list[j]) = (list[j], list[i]);
                }
                queue = new Queue<string>(list);
                _matchPools[key] = queue;
            }
            return MuscleSkillDatabase.Get(queue.Dequeue());
        }

        /// <summary>Called by CombatManager when a special / ultimate starts. False = no question, the skill plays normally.</summary>
        public bool TryBegin(FighterController f, MoveData m)
        {
            if (Active) return false;
            var q = NextQuestion(f, m.Kind == MoveKind.Ultimate);
            if (q == null) return false;
            _selector = f;
            _move = m;
            _q = q;
            _cpu = f.InputSource is CpuInputSource;
            _picks.Clear();
            _elapsed = 0;
            _result = LinkResult.None;
            _resultTimer = 0;
            _stage = _cpu ? 2 : MuscleSkillDatabase.Stage(q);
            _tutorial = !_cpu && _stage == 0 ? 1.8f : 0f;          // Learn: read the explanation first
            _limit = q.TimeLimit + (_stage == 0 ? 1.5f : 0f) + (_cpu ? 0.5f : 0f);
            if (_debugLongTimer && !_cpu) _limit = 60f;
            _cpuNextAction = Random.Range(0.8f, 1.3f);
            f.MoveHeld = true;

            TimeController.Instance?.Clear();
            TimeController.Instance?.SlowMotion(WorldSlowScale, 60f);
            AudioManager.Instance?.PlaySfx("link_charge", 0.9f);
            AudioManager.Instance?.DuckMusic(0.45f, _limit + _tutorial);
            VFXManager.Instance?.SuperFlash(f, f.Def.Energy, false);
            CameraManager.Instance?.Focus(f, _limit + _tutorial + 1f, 0.8f);
            Hud.Instance?.MuscleSelect.Open(q, f, _cpu, _stage, GameSettings.Knowledge);
            return true;
        }

        void Update()
        {
            DebugKeys();
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

            // keep the selector's input source "in sync" every frame so presses are edges, never leaks
            var input = _selector.InputSource != null ? _selector.InputSource.Poll(_selector, _selector.Opponent) : default;

            if (_tutorial > 0)
            {
                _tutorial -= dt;
                ui?.SetTutorial(_tutorial);
                // tapping / pressing skips the explanation
                if (!_cpu && (input.Pressed != Buttons.None || Input.GetMouseButtonDown(0) || (Input.touchCount > 0 && Input.GetTouch(0).phase == TouchPhase.Began))) _tutorial = 0;
                if (_tutorial <= 0) ui?.SetTutorial(0);
                return;
            }

            _elapsed += dt;
            ui?.SetTime(1f - _elapsed / _limit);

            if (_cpu)
            {
                if (_elapsed >= _cpuNextAction)
                {
                    if (_picks.Count < _q.CorrectCount) CpuPick();
                    else { Evaluate(); return; }
                }
            }
            else
            {
                for (int i = 0; i < CardButtons.Length && i < _q.Options.Length; i++)
                    if (input.WasPressed(CardButtons[i])) Toggle(i);
                if (ui != null)
                {
                    for (int i = 0; i < _q.Options.Length; i++)
                        if (MenuInput.PointerDownOver(ui.CardRect(i))) Toggle(i);
                    if (MenuInput.PointerDownOver(ui.LinkRect)) Confirm();
                }
                if (input.WasPressed(LinkButton)) Confirm();
            }

            if (_result == LinkResult.None && _elapsed >= _limit) Evaluate();
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
            if (candidates.Count > 0) Toggle(candidates[Random.Range(0, candidates.Count)]);
            _cpuNextAction = _elapsed + Random.Range(0.4f, 0.75f);
        }

        void Toggle(int i)
        {
            if (_result != LinkResult.None || i < 0 || i >= _q.Options.Length) return;
            if (_picks.Contains(i))
            {
                _picks.Remove(i);
                AudioManager.Instance?.PlaySfx("ui_back", 0.5f, 1.2f);
            }
            else
            {
                if (_picks.Count >= _q.CorrectCount) _picks.RemoveAt(0); // keep the newest choices
                _picks.Add(i);
                AudioManager.Instance?.PlaySfx("ui_skill", 0.7f, 1f + _picks.Count * 0.08f);
            }
            Hud.Instance?.MuscleSelect.SetPicks(_picks, _q.CorrectCount);
            // the picked muscles light on the body right away (location learning)
            _selector.Rig?.GlowMuscles(PickedGroups(), 2.5f, _selector.Def.Energy);
        }

        void Confirm()
        {
            if (_result != LinkResult.None) return;
            if (_picks.Count == 0)
            {
                AudioManager.Instance?.PlaySfx("ui_wrong", 0.5f);
                Hud.Instance?.MuscleSelect.NudgeLink();
                return;
            }
            Evaluate();
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

            if (correct == _q.CorrectCount && wrong == 0) _result = LinkResult.Perfect;
            else if (correct > 0) _result = LinkResult.Partial;
            else _result = LinkResult.Miss;

            var f = _selector;
            switch (_result)
            {
                case LinkResult.Perfect:
                    // knowledge = real power (§13)
                    f.LinkDamageMul = 1.35f;
                    f.LinkExtraHits = _q.ForceCouple ? 2 : 1;
                    f.RecoveryCut = 8;
                    f.Meter = Mathf.Min(300, f.Meter + 35);
                    f.PerfectLinks++;
                    f.MuscleLinks++;
                    break;
                case LinkResult.Partial:
                    f.LinkDamageMul = 0.85f;
                    f.LinkExtraHits = 0;
                    break;
                default:
                    f.LinkDamageMul = 0.6f;
                    f.LinkExtraHits = 0;
                    break;
            }
            f.LastLink = _result;
            if (!_cpu) MuscleSkillDatabase.RecordAnswer(_q, _result);

            AudioManager.Instance?.PlaySfx(_result == LinkResult.Perfect ? "link_success" : _result == LinkResult.Partial ? "ui_confirm" : "link_fail", 0.95f);
            Hud.Instance?.MuscleSelect.ShowResult(_result, _q, _picks);
            Hud.Instance?.Commentary(_q.Explanation, 5f);
            _resultTimer = 1.0f;
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

        static bool _debugLongTimer;

        /// <summary>
        /// Play-test helpers (Editor / development builds only):
        ///   F8 = P1 gauge full, F9 = P2 gauge full, F10 = toggle a 60 s answer window (to inspect the challenge UI),
        ///   F7 = P1 becomes CPU (CPU vs CPU animation pass).
        /// (F1 is avoided: in the Unity Editor it opens the help page and steals keyboard focus.)
        /// </summary>
        int _shotsLeft;
        float _shotTimer;

        static System.Collections.IEnumerator CaptureFrame(string file)
        {
            yield return new WaitForEndOfFrame();
            var tex = new Texture2D(Screen.width, Screen.height, TextureFormat.RGB24, false);
            tex.ReadPixels(new Rect(0, 0, Screen.width, Screen.height), 0, 0);
            tex.Apply();
            System.IO.File.WriteAllBytes(file, tex.EncodeToPNG());
            Destroy(tex);
            Debug.Log("[MuscleBattle] Capture " + file);
        }

        void DebugKeys()
        {
            if (!Application.isEditor && !Debug.isDebugBuild) return;
            if (Input.GetKeyDown(KeyCode.F10))
            {
                _debugLongTimer = !_debugLongTimer;
                if (Active) _limit = _debugLongTimer ? 60f : _q.TimeLimit;
                Hud.Instance?.Commentary(_debugLongTimer ? "DEBUG · 답변 시간 60초 (F10으로 해제)" : "DEBUG · 답변 시간 기본값", 2.5f);
                Debug.Log("[MuscleBattle] Debug: long answer window " + (_debugLongTimer ? "ON" : "OFF"));
            }
            // F6 = burst capture: a clean game-view PNG every 0.7 s (12 shots) into <project>/Captures
            if (Input.GetKeyDown(KeyCode.F6)) { _shotsLeft = 12; _shotTimer = 0f; }
            if (_shotsLeft > 0)
            {
                _shotTimer -= Time.unscaledDeltaTime;
                if (_shotTimer <= 0f)
                {
                    _shotTimer = 0.7f;
                    _shotsLeft--;
                    var dir = System.IO.Path.Combine(Application.dataPath, "..", "Captures");
                    System.IO.Directory.CreateDirectory(dir);
                    var file = System.IO.Path.Combine(dir, $"shot_{System.DateTime.Now:HHmmss_fff}.png");
                    StartCoroutine(CaptureFrame(file));
                }
            }
            var combat = CombatManager.Instance;
            if (combat == null || combat.Phase != MatchPhase.Fighting || combat.Fighters == null) return;
            if (Input.GetKeyDown(KeyCode.F7) && combat.Fighters[0] != null)
            {
                // CPU vs CPU demo: lets an animation pass run without keyboard input
                combat.Fighters[0].InputSource = new CpuInputSource(GameSettings.Difficulty, 7);
                // silent: keeps screenshots clean
                Debug.Log("[MuscleBattle] Debug: P1 switched to CPU");
            }
            for (int i = 0; i < 2; i++)
            {
                if (!Input.GetKeyDown(i == 0 ? KeyCode.F8 : KeyCode.F9) || combat.Fighters[i] == null) continue;
                combat.Fighters[i].Meter = 300;
                // silent: keeps screenshots clean
                Debug.Log($"[MuscleBattle] Debug: P{i + 1} gauge full");
            }
        }
    }
}
