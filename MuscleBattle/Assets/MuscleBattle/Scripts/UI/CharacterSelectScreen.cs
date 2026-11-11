using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace MuscleBattle
{
    /// <summary>
    /// Character select (§29) laid out like concept image 4: P1 / P2 info panels with specialty
    /// chips, signature skills and stat bars, live 3D fighters in the arena, roster grid with
    /// cursors, battle options and a big "VS 매치 시작" button. Lock-in = flash + heavy SFX + pose.
    /// </summary>
    public sealed class CharacterSelectScreen : ScreenBase
    {
        sealed class InfoPanel
        {
            public RectTransform Root;
            public Text NameKo, NameEn, Level, Role, Quote, Skills, Specialties, Tag, Locked;
            public Image[] StatFills = new Image[5];
            public Text[] StatValues = new Text[5];
        }

        sealed class Cell
        {
            public RectTransform Rect;
            public Image Frame, Glow;
            public RawImage Portrait;
            public FighterDefinition Def;
            public Text CursorTag;
        }

        readonly InfoPanel[] _info = { new InfoPanel(), new InfoPanel() };
        readonly List<Cell> _cells = new List<Cell>();
        readonly int[] _cursor = { 0, 1 };
        readonly bool[] _locked = new bool[2];
        bool _twoPlayer;
        int _activeChooser; // 1P mode: 0 = picking self, 1 = picking CPU
        Text _header, _prompt;
        MBButton _start, _rounds, _time, _cpu;
        readonly MenuNavigator _optionsNav = new MenuNavigator();
        float _lockFlash;
        Image _flash;
        readonly float[] _poseTimer = new float[2];

        public static CharacterSelectScreen Create(Transform canvas)
        {
            var go = new GameObject("CharacterSelect");
            go.transform.SetParent(canvas, false);
            var s = go.AddComponent<CharacterSelectScreen>();
            s.Build(canvas);
            s.Hide();
            return s;
        }

        void Build(Transform canvas)
        {
            InitRoot(canvas, "CharacterSelect");

            var top = UIKit.Img(Root, "TopShade", UIKit.GradV, new Color(0.02f, 0.0f, 0.08f, 0.8f));
            top.rectTransform.anchorMin = new Vector2(0, 0.75f);
            top.rectTransform.anchorMax = Vector2.one;
            top.rectTransform.offsetMin = top.rectTransform.offsetMax = Vector2.zero;
            var bottom = UIKit.Img(Root, "BottomShade", UIKit.GradV, new Color(0.02f, 0.0f, 0.08f, 0.92f));
            bottom.rectTransform.anchorMin = Vector2.zero;
            bottom.rectTransform.anchorMax = new Vector2(1, 0.42f);
            bottom.rectTransform.offsetMin = bottom.rectTransform.offsetMax = Vector2.zero;
            bottom.rectTransform.localScale = new Vector3(1, -1, 1);

            var title = UIKit.Label(Root, "캐릭터 선택", 44, Color.white, TextAnchor.UpperLeft);
            title.rectTransform.Place(new Vector2(0, 1), new Vector2(0, 1), new Vector2(40, -20), new Vector2(400, 50));
            var titleEn = UIKit.Label(Root, "CHARACTER SELECT", 20, Palette.TextDim, TextAnchor.UpperLeft, false);
            titleEn.rectTransform.Place(new Vector2(0, 1), new Vector2(0, 1), new Vector2(42, -70), new Vector2(400, 30));
            var logo = UIKit.Label(Root, "MUSCLE BATTLE", 70, Color.white, TextAnchor.MiddleCenter, true, true, true);
            logo.rectTransform.Place(new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0, -10), new Vector2(900, 90));
            var logoGlow = UIKit.Img(logo.rectTransform, "Glow", UIKit.Glow, Palette.Muscle.WithAlpha(0.45f));
            logoGlow.rectTransform.Stretch(-40);
            logoGlow.transform.SetAsFirstSibling();

            _header = UIKit.Label(Root, "1P  VS  CPU", 54, Palette.Gold, TextAnchor.MiddleCenter, true, true, true);
            _header.rectTransform.Place(new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0, -110), new Vector2(700, 70));
            _prompt = UIKit.Label(Root, "파이터를 선택하세요!", 34, Color.white);
            _prompt.rectTransform.Place(new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0, -180), new Vector2(900, 50));

            for (int i = 0; i < 2; i++) BuildInfo(i);
            BuildRoster();
            BuildOptions();

            _flash = UIKit.Img(Root, "LockFlash", UIKit.White, new Color(1, 1, 1, 0));
            _flash.rectTransform.Stretch();

            ControlsBar(Root, "이동  WASD / 방향키 / 스틱 / 터치      결정  J · Enter · Ⓐ      취소  K · Esc · Ⓑ      랜덤  L · Ⓨ");
        }

        void BuildInfo(int side)
        {
            var p = _info[side];
            bool left = side == 0;
            var accent = Palette.PlayerColor(side);
            var anchor = new Vector2(left ? 0 : 1, 1);
            p.Root = UIKit.Panel(Root, left ? "P1Info" : "P2Info", accent);
            p.Root.Place(anchor, anchor, new Vector2(left ? 20 : -20, -110), new Vector2(560, 470));

            var tagBg = UIKit.Img(p.Root, "Tag", UIKit.Para, accent);
            tagBg.rectTransform.Place(new Vector2(left ? 0 : 1, 1), new Vector2(left ? 0 : 1, 0.5f), new Vector2(left ? 20 : -20, 0), new Vector2(110, 44));
            p.Tag = UIKit.Label(tagBg.rectTransform, left ? "1P" : "2P", 30, Color.white);
            p.Tag.rectTransform.Stretch();

            var align = left ? TextAnchor.MiddleLeft : TextAnchor.MiddleRight;
            float sx = left ? 1 : -1;
            var a0 = new Vector2(left ? 0 : 1, 1);
            p.NameKo = UIKit.Label(p.Root, "", 60, Color.white, align);
            p.NameKo.rectTransform.Place(a0, a0, new Vector2(24 * sx, -60), new Vector2(330, 70));
            p.NameEn = UIKit.Label(p.Root, "", 24, Palette.TextDim, align, false);
            p.NameEn.rectTransform.Place(a0, a0, new Vector2(200 * sx, -70), new Vector2(330, 40));
            p.Level = UIKit.Label(p.Root, "", 26, Palette.Gold, left ? TextAnchor.MiddleRight : TextAnchor.MiddleLeft);
            p.Level.rectTransform.Place(new Vector2(left ? 1 : 0, 1), new Vector2(left ? 1 : 0, 1), new Vector2(-24 * sx, -70), new Vector2(120, 40));
            p.Role = UIKit.Label(p.Root, "", 24, Palette.Nerve, align);
            p.Role.rectTransform.Place(a0, a0, new Vector2(24 * sx, -118), new Vector2(520, 36));
            p.Quote = UIKit.Label(p.Root, "", 22, Color.white, align, false);
            p.Quote.rectTransform.Place(a0, a0, new Vector2(24 * sx, -156), new Vector2(520, 34));
            p.Specialties = UIKit.Label(p.Root, "", 22, Palette.Bone, align);
            p.Specialties.rectTransform.Place(a0, a0, new Vector2(24 * sx, -196), new Vector2(520, 34));

            var skillsHead = UIKit.Label(p.Root, "주요 기술", 22, Palette.Gold, align);
            skillsHead.rectTransform.Place(a0, a0, new Vector2(24 * sx, -238), new Vector2(240, 30));
            p.Skills = UIKit.Label(p.Root, "", 21, Color.white, align, false);
            p.Skills.lineSpacing = 1.35f;
            p.Skills.rectTransform.Place(a0, a0, new Vector2(24 * sx, -330), new Vector2(260, 150));

            var statHead = UIKit.Label(p.Root, "능력치", 22, Palette.Gold, align);
            statHead.rectTransform.Place(a0, a0, new Vector2(300 * sx, -238), new Vector2(240, 30));
            string[] names = { "파워", "스피드", "테크닉", "리치", "내구도" };
            for (int k = 0; k < 5; k++)
            {
                float y = -276 - k * 34;
                var n = UIKit.Label(p.Root, names[k], 20, Palette.TextDim, align, false);
                n.rectTransform.Place(a0, a0, new Vector2(300 * sx, y), new Vector2(90, 30));
                var back = UIKit.Img(p.Root, "StatBack", UIKit.Para, new Color(0.1f, 0.08f, 0.2f, 0.9f));
                back.rectTransform.Place(a0, a0, new Vector2(390 * sx, y), new Vector2(110, 18));
                back.rectTransform.pivot = new Vector2(left ? 0 : 1, 0.5f);
                var fill = UIKit.Img(back.rectTransform, "Fill", UIKit.Para, left ? Palette.Nerve : Palette.HpYellow);
                fill.rectTransform.Stretch(2);
                fill.type = Image.Type.Filled;
                fill.fillMethod = Image.FillMethod.Horizontal;
                fill.fillOrigin = left ? 0 : 1;
                p.StatFills[k] = fill;
                p.StatValues[k] = UIKit.Label(p.Root, "", 20, Color.white, align);
                p.StatValues[k].rectTransform.Place(a0, a0, new Vector2(510 * sx, y), new Vector2(40, 30));
            }

            p.Locked = UIKit.Label(p.Root, "LOCKED IN!", 40, Palette.Gold, TextAnchor.MiddleCenter, true, true, true);
            p.Locked.rectTransform.Place(new Vector2(0.5f, 0), new Vector2(0.5f, 1), new Vector2(0, -6), new Vector2(500, 60));
            p.Locked.gameObject.SetActive(false);
        }

        void BuildRoster()
        {
            var bar = UIKit.Node("Roster", Root).Place(new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0, 250), new Vector2(1500, 190));
            var filter = UIKit.Label(Root, "전투 스타일   전체 · 재활·치료형 · 퍼포먼스형 · 가동성·유연형 · 밸런스형 · 파워형", 22, Palette.TextDim, TextAnchor.MiddleCenter, false);
            filter.rectTransform.Place(new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0, 450), new Vector2(1400, 34));

            var roster = CharacterDatabase.All;
            int total = roster.Count + CharacterDatabase.LockedRoster.Length;
            float w = 165, gap = 14;
            float x0 = -(total * w + (total - 1) * gap) / 2f + w / 2f;
            for (int i = 0; i < total; i++)
            {
                var c = new Cell();
                bool playable = i < roster.Count;
                c.Def = playable ? roster[i] : null;
                var accent = playable ? Palette.Mastery : new Color(0.25f, 0.22f, 0.35f);
                c.Glow = UIKit.Img(bar, "Glow", UIKit.Glow, accent.WithAlpha(0));
                c.Glow.rectTransform.Place(new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(x0 + i * (w + gap), 0), new Vector2(w * 1.5f, 260));
                var frame = UIKit.Img(bar, "Cell", UIKit.Round, new Color(0.08f, 0.06f, 0.16f, 0.95f), true);
                c.Rect = frame.rectTransform.Place(new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(x0 + i * (w + gap), 0), new Vector2(w, 180));
                var mask = UIKit.Node("Mask", c.Rect);
                mask.Stretch(5);
                mask.gameObject.AddComponent<RectMask2D>();
                c.Portrait = UIKit.Raw(mask, "Portrait", playable ? PortraitStudio.Get(c.Def) : null);
                c.Portrait.rectTransform.Stretch();
                if (!playable)
                {
                    c.Portrait.color = new Color(0.12f, 0.1f, 0.22f);
                    var q = UIKit.Label(c.Rect, "?", 80, new Color(0.4f, 0.35f, 0.6f));
                    q.rectTransform.Stretch();
                    var nm = UIKit.Label(c.Rect, CharacterDatabase.LockedRoster[i - roster.Count].ko, 18, Palette.TextDim, TextAnchor.LowerCenter, false);
                    nm.rectTransform.Stretch(8);
                    var soon = UIKit.Label(c.Rect, "COMING SOON", 14, Palette.Mastery, TextAnchor.UpperCenter);
                    soon.rectTransform.Stretch(8);
                }
                else
                {
                    var nm = UIKit.Label(c.Rect, c.Def.NameKo, 22, Color.white, TextAnchor.LowerCenter);
                    nm.rectTransform.Stretch(8);
                }
                c.Frame = UIKit.Img(c.Rect, "Frame", UIKit.RoundOutline, accent.WithAlpha(0.6f));
                c.Frame.rectTransform.Stretch(-3);
                c.CursorTag = UIKit.Label(c.Rect, "", 30, Color.white, TextAnchor.MiddleCenter, true, true, true);
                c.CursorTag.rectTransform.Place(new Vector2(0.5f, 0), new Vector2(0.5f, 1), new Vector2(0, 10), new Vector2(160, 40));
                _cells.Add(c);
            }
        }

        void BuildOptions()
        {
            _start = MBButton.Create(Root, "VS 매치 시작", "BATTLE START", Palette.Muscle, new Vector2(0.5f, 0), new Vector2(0, 100), new Vector2(560, 110), 48);
            _start.OnClick = TryStart;
            _rounds = MBButton.Create(Root, "", null, Palette.Mastery, new Vector2(0, 0), new Vector2(260, 160), new Vector2(380, 64), 26);
            _rounds.OnClick = () => { GameSettings.RoundsToWin = GameSettings.RoundsToWin == 2 ? 3 : GameSettings.RoundsToWin == 3 ? 1 : 2; RefreshOptions(); };
            _time = MBButton.Create(Root, "", null, Palette.Mastery, new Vector2(0, 0), new Vector2(260, 88), new Vector2(380, 64), 26);
            _time.OnClick = () => { GameSettings.RoundTime = GameSettings.RoundTime == 60 ? 99 : GameSettings.RoundTime == 99 ? 45 : 60; RefreshOptions(); };
            _cpu = MBButton.Create(Root, "", null, Palette.Mastery, new Vector2(1, 0), new Vector2(-260, 124), new Vector2(380, 64), 26);
            _cpu.OnClick = () => { GameSettings.Difficulty = (CpuDifficulty)(((int)GameSettings.Difficulty + 1) % 3); RefreshOptions(); };
            var stage = UIKit.Label(Root, "STAGE  ·  " + StageManager.StageNameKo, 24, Palette.Bone);
            stage.rectTransform.Place(new Vector2(0, 0), new Vector2(0.5f, 0.5f), new Vector2(260, 226), new Vector2(420, 40));
            _optionsNav.Add(_start);
            _optionsNav.Add(_rounds);
            _optionsNav.Add(_time);
            _optionsNav.Add(_cpu);
            RefreshOptions();
        }

        void RefreshOptions()
        {
            _rounds.Label.text = "라운드 수 :  " + (GameSettings.RoundsToWin * 2 - 1) + "R";
            _time.Label.text = "제한 시간 :  " + GameSettings.RoundTime + "초";
            _cpu.Label.text = "CPU 난이도 :  " + GameSettings.Difficulty switch { CpuDifficulty.Easy => "쉬움", CpuDifficulty.Normal => "보통", _ => "어려움" };
            _cpu.gameObject.SetActive(!_twoPlayer);
            GameSettings.Save();
        }

        // ------------------------------------------------------------------
        public void Open(bool twoPlayer)
        {
            _twoPlayer = twoPlayer;
            _locked[0] = _locked[1] = false;
            _activeChooser = 0;
            _cursor[0] = 0;
            _cursor[1] = Mathf.Min(1, CharacterDatabase.All.Count - 1);
            _header.text = twoPlayer ? "1P  VS  2P" : "1P  VS  CPU";
            _info[1].Tag.text = twoPlayer ? "2P" : "CPU";
            Show();
            RefreshOptions();
            for (int i = 0; i < 2; i++) Preview(i);
            AudioManager.Instance?.PlayBgm("select", true);
            AudioManager.Instance?.Announce("choose");
            CameraManager.Instance?.SetFree(new Vector3(0, 1.55f, -5.6f), new Vector3(0, 1.25f, 0), 40f);
        }

        void Preview(int side)
        {
            var def = _cells[_cursor[side]].Def;
            if (def == null) return;
            GameModeManager.Instance.SpawnPreview(side, def);
            Fill(_info[side], def);
        }

        static void Fill(InfoPanel p, FighterDefinition d)
        {
            p.NameKo.text = d.NameKo;
            p.NameEn.text = d.NameEn;
            p.Level.text = "Lv." + d.Level;
            p.Role.text = d.RoleKo + "  (" + d.RoleEn + ")";
            p.Quote.text = d.Quote;
            p.Specialties.text = "전문 분야  ·  " + string.Join("  ·  ", d.Specialties);
            p.Skills.text = "▶ " + d.SpecialName + "\n▶ " + d.UltimateName + "\n▶ " + d.SignatureMuscles.Split('(')[0].Trim();
            int[] stats = { d.Power, d.Speed, d.Technique, d.Reach, d.Durability };
            for (int k = 0; k < 5; k++)
            {
                p.StatFills[k].fillAmount = stats[k] / 10f;
                p.StatValues[k].text = stats[k].ToString();
            }
        }

        bool BothLocked => _locked[0] && _locked[1];

        void Update()
        {
            if (!Visible) return;
            float dt = Time.unscaledDeltaTime;
            _lockFlash = Mathf.MoveTowards(_lockFlash, 0, dt * 3f);
            _flash.SetAlpha(_lockFlash * 0.5f);

            for (int s = 0; s < 2; s++)
            {
                if (_poseTimer[s] > 0)
                {
                    _poseTimer[s] -= dt;
                    if (_poseTimer[s] <= 0) GameModeManager.Instance.PreviewFighter(s)?.SetState(FighterState.Intro);
                }
            }

            if (BothLocked)
            {
                _prompt.text = "준비 완료!  VS 매치 시작";
                if (MenuInput.Back(-1)) { Unlock(1); return; }
                _optionsNav.Update();
                UpdateCells();
                return;
            }

            _prompt.text = _twoPlayer ? "파이터를 선택하세요!" : (_activeChooser == 0 ? "파이터를 선택하세요!" : "상대 CPU를 선택하세요!");

            if (_twoPlayer)
            {
                for (int s = 0; s < 2; s++) HandleChooser(s, s);
            }
            else
            {
                HandleChooser(_activeChooser, -1);
            }

            // pointer: tap a cell to move the active cursor, tap again to lock
            for (int i = 0; i < _cells.Count; i++)
            {
                if (!MenuInput.PointerDownOver(_cells[i].Rect)) continue;
                int side = _twoPlayer ? (_locked[0] ? 1 : 0) : _activeChooser;
                if (_cells[i].Def == null) { AudioManager.Instance?.PlaySfx("ui_wrong", 0.6f); break; }
                if (_cursor[side] == i) Lock(side);
                else Move(side, i);
                break;
            }

            if (MenuInput.Back(-1) && !_twoPlayer)
            {
                if (_activeChooser == 1 && _locked[0]) { _activeChooser = 0; Unlock(0); }
                else GameModeManager.Instance.GoToTitle();
            }
            else if (_twoPlayer)
            {
                for (int s = 0; s < 2; s++)
                    if (MenuInput.Back(s))
                    {
                        if (_locked[s]) Unlock(s);
                        else if (s == 0) GameModeManager.Instance.GoToTitle();
                    }
            }
            UpdateCells();
        }

        void HandleChooser(int side, int device)
        {
            if (_locked[side]) return;
            var nav = MenuInput.Nav(device);
            if (nav.x != 0)
            {
                int n = CharacterDatabase.All.Count; // only playable cells are navigable
                Move(side, ((_cursor[side] + nav.x) % n + n) % n);
            }
            if (MenuInput.Random(device)) Move(side, Random.Range(0, CharacterDatabase.All.Count));
            if (MenuInput.Confirm(device)) Lock(side);
        }

        void Move(int side, int index)
        {
            if (_cursor[side] == index) return;
            _cursor[side] = index;
            AudioManager.Instance?.PlaySfx("ui_hover", 0.7f);
            Preview(side);
        }

        void Lock(int side)
        {
            if (_locked[side]) return;
            _locked[side] = true;
            _lockFlash = 1f;
            _info[side].Locked.gameObject.SetActive(true);
            AudioManager.Instance?.PlaySfx("ui_lock");
            CameraManager.Instance?.Shake(0.25f);
            var f = GameModeManager.Instance.PreviewFighter(side);
            if (f != null)
            {
                f.SetState(FighterState.Victory);
                _poseTimer[side] = 1.6f;
                VFXManager.Instance?.SuperFlash(f, f.Def.Energy, false);
            }
            if (!_twoPlayer && side == 0) _activeChooser = 1;
            if (BothLocked) _optionsNav.Focus(0);
        }

        void Unlock(int side)
        {
            _locked[side] = false;
            _info[side].Locked.gameObject.SetActive(false);
            AudioManager.Instance?.PlaySfx("ui_back");
            if (!_twoPlayer) _activeChooser = side;
        }

        void TryStart()
        {
            if (!BothLocked) return;
            GameModeManager.Instance.GoToVs(_cells[_cursor[0]].Def, _cells[_cursor[1]].Def);
        }

        void UpdateCells()
        {
            float t = Time.unscaledTime;
            for (int i = 0; i < _cells.Count; i++)
            {
                var c = _cells[i];
                bool p1 = _cursor[0] == i, p2 = _cursor[1] == i && (_twoPlayer || _activeChooser == 1 || _locked[1]);
                Color col = p1 && p2 ? Palette.Mastery : p1 ? Palette.P1 : p2 ? Palette.P2 : new Color(0.35f, 0.3f, 0.55f, 0.6f);
                float pulse = (p1 || p2) ? 0.75f + 0.25f * Mathf.Sin(t * 6f) : 0.6f;
                c.Frame.color = col.WithAlpha(pulse);
                c.Glow.color = col.WithAlpha(p1 || p2 ? 0.35f : 0f);
                c.Rect.localScale = Vector3.one * ((p1 || p2) ? 1.06f : 1f);
                c.CursorTag.text = p1 && p2 ? "1P 2P" : p1 ? "1P" : p2 ? (_twoPlayer ? "2P" : "CPU") : "";
                c.CursorTag.color = col;
            }
        }
    }
}
