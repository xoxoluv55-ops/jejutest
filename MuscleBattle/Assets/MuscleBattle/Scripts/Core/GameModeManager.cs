using System.Collections;
using UnityEngine;

namespace MuscleBattle
{
    public enum GameFlow { Boot, Title, Select, Vs, Fight, Result }

    /// <summary>
    /// Top level flow (§57): Title -> Character Select -> VS -> Fight -> KO -> Victory -> Result.
    /// Builds every runtime system, so an EMPTY scene + Play is enough to run the vertical slice
    /// (see Bootstrap). MUSCLE BATTLE is fully separate from the old MyoForge flow (§63).
    /// </summary>
    public sealed class GameModeManager : MonoBehaviour
    {
        public static GameModeManager Instance { get; private set; }

        public GameFlow Flow { get; private set; } = GameFlow.Boot;
        public bool IsTwoPlayer { get; private set; }
        public FighterDefinition P1Def { get; private set; }
        public FighterDefinition P2Def { get; private set; }

        readonly FighterController[] _fighters = new FighterController[2];
        CombatManager _combat;
        Canvas _canvas;
        Hud _hud;
        TouchControls _touch;
        TitleScreen _title;
        SettingsPanel _settings;
        CharacterSelectScreen _select;
        VsScreen _vs;
        ResultScreen _result;
        PauseMenu _pause;
        MBButton _pauseButton;
        bool _paused;
        bool _transitioning;

        void Awake()
        {
            if (Instance != null && Instance != this) { Destroy(gameObject); return; }
            Instance = this;
            DontDestroyOnLoad(gameObject);
            GameSettings.Load();
            QualityProfile.Detect();
            Input.multiTouchEnabled = true;
            Screen.sleepTimeout = SleepTimeout.NeverSleep;
        }

        void Start()
        {
            BuildSystems();
            StartCoroutine(BootRoutine());
        }

        void BuildSystems()
        {
            // camera
            var existing = Camera.main;
            if (existing != null) existing.gameObject.SetActive(false); // the default scene camera is replaced
            var camGo = new GameObject("Main Camera") { tag = "MainCamera" };
            camGo.transform.SetParent(transform, false);
            camGo.AddComponent<Camera>();
            camGo.AddComponent<AudioListener>();
            camGo.AddComponent<CameraManager>();
            foreach (var l in FindObjectsByType<Light>(FindObjectsSortMode.None))
                if (l.type == LightType.Directional && l.transform.parent == null) l.gameObject.SetActive(false);

            Add<TimeController>("Time");
            Add<AudioManager>("Audio");
            Add<VFXManager>("VFX");
            var stage = Add<StageManager>("Stage");
            stage.Build();
            _combat = Add<CombatManager>("Combat");
            Add<MuscleSkillSystem>("MuscleSkill");
            _combat.MatchFinished += OnMatchFinished;

            // UI
            _canvas = UIKit.CreateCanvas("UI", 10, transform);
            _hud = Hud.Create(_canvas.transform, _combat);
            _touch = TouchControls.Create(_canvas.transform);
            _pauseButton = MBButton.Create(_canvas.transform, "II", null, Palette.TextDim, new Vector2(0.5f, 1), new Vector2(0, -250), new Vector2(110, 70), 34);
            _pauseButton.OnClick = () => SetPaused(true);
            _settings = SettingsPanel.Create(_canvas.transform);
            _title = TitleScreen.Create(_canvas.transform, _settings);
            _select = CharacterSelectScreen.Create(_canvas.transform);
            _vs = VsScreen.Create(_canvas.transform);
            _result = ResultScreen.Create(_canvas.transform);
            _pause = PauseMenu.Create(_canvas.transform);
            _settings.transform.SetAsLastSibling();
            ScreenTransition.Create(_canvas.transform);
            HideAllScreens();
        }

        T Add<T>(string name) where T : Component
        {
            var go = new GameObject(name);
            go.transform.SetParent(transform, false);
            return go.AddComponent<T>();
        }

        IEnumerator BootRoutine()
        {
            yield return null;
            // title backdrop: both fighters posing in the arena
            P1Def = CharacterDatabase.All[0];
            P2Def = CharacterDatabase.All[Mathf.Min(1, CharacterDatabase.All.Count - 1)];
            SpawnPreview(0, P1Def);
            SpawnPreview(1, P2Def);
            Flow = GameFlow.Title;
            _title.Show();
        }

        void HideAllScreens()
        {
            _hud.Show(false);
            _touch.Show(false);
            _pauseButton.gameObject.SetActive(false);
            _title.Hide();
            _select.Hide();
            _vs.Hide();
            _result.Hide();
            _pause.Hide();
        }

        // ------------------------------------------------------------------
        // Fighters
        // ------------------------------------------------------------------
        public FighterController PreviewFighter(int side) => _fighters[side];

        public FighterController SpawnPreview(int side, FighterDefinition def)
        {
            var f = SpawnFighter(side, def);
            f.ResetForRound(new Vector3(side == 0 ? -1.3f : 1.3f, 0, 0), side == 0 ? new Vector3(0.35f, 0, -1).normalized : new Vector3(-0.35f, 0, -1).normalized);
            return f;
        }

        FighterController SpawnFighter(int side, FighterDefinition def)
        {
            if (_fighters[side] != null)
            {
                if (_fighters[side].Def == def) return _fighters[side];
                VFXManager.Instance?.SetAura(_fighters[side], false);
                Destroy(_fighters[side].gameObject);
            }
            var go = new GameObject(side == 0 ? "Fighter_P1" : "Fighter_P2");
            go.transform.SetParent(transform, false);
            var f = go.AddComponent<FighterController>();
            var rig = FighterRig.Build(go.transform, def, f);
            f.Init(def, side, _combat, rig);
            _fighters[side] = f;
            if (_fighters[1 - side] != null)
            {
                f.Opponent = _fighters[1 - side];
                _fighters[1 - side].Opponent = f;
            }
            return f;
        }

        void AssignInputs()
        {
            int pads = GamepadInputSource.ConnectedCount();
            var touch = GameSettings.UseTouchControls ? new TouchInputSource(_touch) : null;
            if (IsTwoPlayer)
            {
                // Keyboard + Controller: with a single pad, the pad goes to P2 (§19)
                var p1Pad = pads >= 2 ? new GamepadInputSource(1) : null;
                var p2Pad = pads >= 2 ? new GamepadInputSource(2) : pads == 1 ? new GamepadInputSource(1) : null;
                _fighters[0].InputSource = Composite(KeyboardInputSource.PlayerOne(), p1Pad, touch);
                _fighters[1].InputSource = Composite(KeyboardInputSource.PlayerTwo(), p2Pad, null);
            }
            else
            {
                _fighters[0].InputSource = Composite(KeyboardInputSource.PlayerOne(), KeyboardInputSource.PlayerTwo(),
                    new GamepadInputSource(1), pads >= 2 ? new GamepadInputSource(2) : null, touch);
                _fighters[1].InputSource = new CpuInputSource(GameSettings.Difficulty);
            }
        }

        static IInputSource Composite(params IInputSource[] sources)
        {
            var list = new System.Collections.Generic.List<IInputSource>();
            foreach (var s in sources) if (s != null) list.Add(s);
            return new CompositeInputSource(list.ToArray());
        }

        // ------------------------------------------------------------------
        // Flow
        // ------------------------------------------------------------------
        void Transition(System.Action swap)
        {
            if (_transitioning) return;
            StartCoroutine(TransitionRoutine(swap));
        }

        IEnumerator TransitionRoutine(System.Action swap)
        {
            _transitioning = true;
            yield return ScreenTransition.Instance.Play(swap);
            _transitioning = false;
        }

        public void GoToTitle()
        {
            Transition(() =>
            {
                _combat.Abort();
                HideAllScreens();
                Flow = GameFlow.Title;
                SpawnPreview(0, P1Def ?? CharacterDatabase.All[0]);
                SpawnPreview(1, P2Def ?? CharacterDatabase.All[1]);
                _title.Show();
                _title.ShowMenuDirect();
                AudioManager.Instance?.PlayBgm("menu", true);
            });
        }

        public void GoToSelect(bool twoPlayer)
        {
            Transition(() =>
            {
                _combat.Abort();
                HideAllScreens();
                IsTwoPlayer = twoPlayer;
                Flow = GameFlow.Select;
                _select.Open(twoPlayer);
            });
        }

        public void GoToVs(FighterDefinition a, FighterDefinition b)
        {
            P1Def = a;
            P2Def = b;
            Transition(() =>
            {
                HideAllScreens();
                Flow = GameFlow.Vs;
                _vs.Open(a, b, !IsTwoPlayer, () => Transition(StartFight));
            });
        }

        public void Rematch() => Transition(StartFight);

        void StartFight()
        {
            HideAllScreens();
            Flow = GameFlow.Fight;
            var a = SpawnFighter(0, P1Def);
            var b = SpawnFighter(1, P2Def);
            _combat.Setup(a, b);
            AssignInputs();
            CameraManager.Instance.SetFighters(a, b);
            CameraManager.Instance.SnapToFighters();
            _hud.Configure(a, b, !IsTwoPlayer);
            _hud.SetPortraits(PortraitStudio.Get(P1Def), PortraitStudio.Get(P2Def));
            _hud.Show(true);
            bool touch = GameSettings.UseTouchControls;
            _touch.Show(touch);
            _touch.SetOwner(a);
            _pauseButton.gameObject.SetActive(touch);
            _combat.StartMatch();
        }

        void OnMatchFinished(MatchResult r)
        {
            bool lostToCpu = !IsTwoPlayer && r.Winner.Side == 1;
            int streak = PlayerPrefs.GetInt("mb.streak", 0);
            if (!IsTwoPlayer)
            {
                streak = lostToCpu ? 0 : streak + 1;
                PlayerPrefs.SetInt("mb.streak", streak);
                PlayerPrefs.Save();
            }
            Flow = GameFlow.Result;
            _hud.Show(false);
            _touch.Show(false);
            _pauseButton.gameObject.SetActive(false);
            _result.Open(r, lostToCpu, streak);
        }

        public void SetPaused(bool paused)
        {
            if (Flow != GameFlow.Fight) paused = false;
            _paused = paused;
            _combat.Paused = paused;
            if (TimeController.Instance != null) TimeController.Instance.Paused = paused;
            if (!paused) Time.timeScale = 1f;
            if (paused) { _pause.Show(); AudioManager.Instance?.PlaySfx("ui_back"); }
            else _pause.Hide();
            _touch.Show(!paused && Flow == GameFlow.Fight && GameSettings.UseTouchControls);
        }

        void Update()
        {
            MenuInput.Update();
            if (Flow == GameFlow.Fight && !_transitioning && _combat.Phase == MatchPhase.Fighting && MenuInput.Pause())
                SetPaused(!_paused);

            // keep the UI scaler sensible on 4:3 iPad vs 16:9 / 21:9 displays
            var scaler = _canvas != null ? _canvas.GetComponent<UnityEngine.UI.CanvasScaler>() : null;
            if (scaler != null) scaler.matchWidthOrHeight = (float)Screen.width / Mathf.Max(1, Screen.height) < 1.7f ? 0f : 1f;
        }
    }
}
