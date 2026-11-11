using System.Collections;
using UnityEngine;
using UnityEngine.UI;

namespace MuscleBattle
{
    // ======================================================================
    // VS SCREEN (§30)
    // ======================================================================
    public sealed class VsScreen : ScreenBase
    {
        RectTransform _left, _right, _vs;
        RawImage _leftPortrait, _rightPortrait;
        Text _leftName, _rightName, _leftQuote, _rightQuote, _stage;
        float _t;
        bool _done;
        System.Action _onDone;

        public static VsScreen Create(Transform canvas)
        {
            var go = new GameObject("VsScreen");
            go.transform.SetParent(canvas, false);
            var s = go.AddComponent<VsScreen>();
            s.Build(canvas);
            s.Hide();
            return s;
        }

        void Build(Transform canvas)
        {
            InitRoot(canvas, "VS");
            var bg = UIKit.Img(Root, "Bg", UIKit.White, new Color(0.03f, 0.01f, 0.08f, 0.94f));
            bg.rectTransform.Stretch();
            _left = Half(true, out _leftPortrait, out _leftName, out _leftQuote);
            _right = Half(false, out _rightPortrait, out _rightName, out _rightQuote);

            _vs = UIKit.Node("VS", Root).Place(new Vector2(0.5f, 0.55f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(500, 400));
            var glow = UIKit.Img(_vs, "Glow", UIKit.Glow, Palette.Gold.WithAlpha(0.6f));
            glow.rectTransform.Stretch(-80);
            var vs = UIKit.Label(_vs, "VS", 280, Palette.Gold, TextAnchor.MiddleCenter, true, true, true);
            vs.rectTransform.Stretch();

            _stage = UIKit.Label(Root, "", 34, Palette.Bone);
            _stage.rectTransform.Place(new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0, 60), new Vector2(1200, 50));
        }

        RectTransform Half(bool left, out RawImage portrait, out Text name, out Text quote)
        {
            var color = left ? Palette.P1 : Palette.P2;
            var half = UIKit.Node(left ? "Left" : "Right", Root);
            half.anchorMin = new Vector2(left ? 0 : 0.5f, 0);
            half.anchorMax = new Vector2(left ? 0.5f : 1, 1);
            half.offsetMin = half.offsetMax = Vector2.zero;
            var tint = UIKit.Img(half, "Tint", UIKit.GradH, color.WithAlpha(0.55f));
            tint.rectTransform.Stretch();
            if (left) tint.rectTransform.localScale = new Vector3(-1, 1, 1);
            var fiber = UIKit.Img(half, "Fiber", MBAssets.SpriteFrom(ProceduralTextures.Fiber), color.WithAlpha(0.15f));
            fiber.rectTransform.Stretch();
            var mask = UIKit.Node("Mask", half);
            mask.Stretch(0);
            mask.gameObject.AddComponent<RectMask2D>();
            portrait = UIKit.Raw(mask, "Portrait", null);
            portrait.rectTransform.Place(new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(left ? -40 : 40, 60), new Vector2(760, 760));
            var tag = UIKit.Img(half, "Tag", UIKit.Para, color);
            tag.rectTransform.Place(new Vector2(left ? 0 : 1, 1), new Vector2(left ? 0 : 1, 1), new Vector2(left ? 40 : -40, -40), new Vector2(140, 60));
            var tt = UIKit.Label(tag.rectTransform, left ? "1P" : "2P", 38, Color.white);
            tt.rectTransform.Stretch();
            name = UIKit.Label(half, "", 96, Color.white, left ? TextAnchor.MiddleLeft : TextAnchor.MiddleRight, true, true, true);
            name.rectTransform.Place(new Vector2(left ? 0 : 1, 0), new Vector2(left ? 0 : 1, 0), new Vector2(left ? 60 : -60, 210), new Vector2(900, 120));
            quote = UIKit.Label(half, "", 32, Palette.TextDim, left ? TextAnchor.MiddleLeft : TextAnchor.MiddleRight, false);
            quote.rectTransform.Place(new Vector2(left ? 0 : 1, 0), new Vector2(left ? 0 : 1, 0), new Vector2(left ? 64 : -64, 150), new Vector2(900, 50));
            return half;
        }

        public void Open(FighterDefinition a, FighterDefinition b, bool p2IsCpu, System.Action onDone)
        {
            Show();
            Root.SetAsLastSibling();
            _onDone = onDone;
            _done = false;
            _t = 0;
            _leftPortrait.texture = PortraitStudio.Get(a);
            _rightPortrait.texture = PortraitStudio.Get(b);
            _leftName.text = a.NameKo + "  <size=40>" + a.NameEn + "</size>";
            _rightName.text = "<size=40>" + b.NameEn + "</size>  " + b.NameKo;
            _leftQuote.text = a.IntroLine;
            _rightQuote.text = b.IntroLine;
            _right.Find("Tag").GetComponentInChildren<Text>().text = p2IsCpu ? "CPU" : "2P";
            _stage.text = "STAGE  ·  " + StageManager.StageNameKo + "  ·  " + StageManager.StageNameEn;
            AudioManager.Instance?.PlayBgm("vs", false, 0.2f);
            AudioManager.Instance?.PlaySfx("ui_lock");
        }

        void Update()
        {
            if (!Visible || _done) return;
            _t += Time.unscaledDeltaTime;
            float slide = Mathf.SmoothStep(0, 1, Mathf.Clamp01(_t / 0.35f));
            _left.anchoredPosition = new Vector2(Mathf.Lerp(-1000, 0, slide), 0);
            _right.anchoredPosition = new Vector2(Mathf.Lerp(1000, 0, slide), 0);
            float vsIn = Mathf.Clamp01((_t - 0.3f) / 0.2f);
            float shake = _t > 0.3f && _t < 0.6f ? (0.6f - _t) * 40f : 0f;
            _vs.localScale = Vector3.one * Mathf.Lerp(3f, 1f, vsIn) * (1f + Mathf.Sin(_t * 8f) * 0.02f);
            _vs.anchoredPosition = new Vector2(Random.Range(-shake, shake), Random.Range(-shake, shake));
            if (_t > 0.3f && _t - Time.unscaledDeltaTime <= 0.3f)
            {
                AudioManager.Instance?.PlaySfx("heavy", 1f);
                CameraManager.Instance?.Shake(0.4f);
            }
            if (_t > 3.6f || (_t > 1f && (MenuInput.Confirm(-1) || Input.touchCount > 0 && Input.GetTouch(0).phase == TouchPhase.Began)))
            {
                _done = true;
                _onDone?.Invoke();
            }
        }
    }

    // ======================================================================
    // RESULT SCREEN (§47, concept image 1)
    // ======================================================================
    public sealed class ResultScreen : ScreenBase
    {
        Text _victory, _victorySub, _quote, _total, _ko, _mission;
        RectTransform _scorePanel;
        readonly Text[] _lines = new Text[6];
        readonly Text[] _values = new Text[6];
        Text _stats;
        readonly MenuNavigator _nav = new MenuNavigator();
        Coroutine _co;

        public static ResultScreen Create(Transform canvas)
        {
            var go = new GameObject("ResultScreen");
            go.transform.SetParent(canvas, false);
            var s = go.AddComponent<ResultScreen>();
            s.Build(canvas);
            s.Hide();
            return s;
        }

        void Build(Transform canvas)
        {
            InitRoot(canvas, "Result");
            var shade = UIKit.Img(Root, "Shade", UIKit.GradV, new Color(0.02f, 0, 0.06f, 0.55f));
            shade.rectTransform.Stretch();
            shade.rectTransform.localScale = new Vector3(1, -1, 1);

            var header = UIKit.Label(Root, "MUSCLE BATTLE", 54, Color.white, TextAnchor.MiddleCenter, true, true, true);
            header.rectTransform.Place(new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0, -12), new Vector2(800, 70));
            var res = UIKit.Label(Root, "RESULT", 64, Palette.Bone, TextAnchor.MiddleCenter, true, true, true);
            res.rectTransform.Place(new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0, -80), new Vector2(600, 80));

            // victory plate (left)
            var plate = UIKit.Node("Victory", Root).Place(new Vector2(0, 0.62f), new Vector2(0, 0.5f), new Vector2(40, 0), new Vector2(520, 300));
            var laurel = UIKit.Img(plate, "Glow", UIKit.Glow, Palette.Gold.WithAlpha(0.45f));
            laurel.rectTransform.Stretch(-40);
            _victory = UIKit.Label(plate, "VICTORY", 110, Palette.Gold, TextAnchor.MiddleCenter, true, true, true);
            _victory.rectTransform.Stretch();
            _victory.rectTransform.offsetMin = new Vector2(0, 90);
            var subBg = UIKit.Img(plate, "SubBg", UIKit.Para, new Color(0.6f, 0.05f, 0.12f, 0.95f));
            subBg.rectTransform.Place(new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0, 40), new Vector2(380, 70));
            _victorySub = UIKit.Label(subBg.rectTransform, "승리!", 46, Color.white);
            _victorySub.rectTransform.Stretch();
            var bubble = UIKit.Panel(Root, "Quote", Palette.Mastery, 0.75f);
            bubble.Place(new Vector2(0, 0.85f), new Vector2(0, 0.5f), new Vector2(160, 0), new Vector2(520, 100));
            _quote = UIKit.Label(bubble, "", 26, Color.white, TextAnchor.MiddleCenter, false);
            _quote.rectTransform.Stretch(12);

            // K.O. + match result panel (centre)
            _ko = UIKit.Label(Root, "K.O.", 190, Palette.MuscleHot, TextAnchor.MiddleCenter, true, true, true);
            _ko.rectTransform.Place(new Vector2(0.5f, 0.74f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(900, 220));
            var koGlow = UIKit.Img(_ko.rectTransform, "Glow", UIKit.Glow, Palette.Muscle.WithAlpha(0.55f));
            koGlow.rectTransform.Stretch(-60);
            koGlow.transform.SetAsFirstSibling();

            _scorePanel = UIKit.Panel(Root, "Score", Palette.Mastery);
            _scorePanel.Place(new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0, -40), new Vector2(620, 440));
            UIKit.SlantPlate(_scorePanel, "매치 결과", 32, new Color(0.25f, 0.08f, 0.45f), Color.white, new Vector2(0.5f, 1), Vector2.zero, new Vector2(320, 56));
            for (int i = 0; i < 6; i++)
            {
                float y = -60 - i * 48;
                _lines[i] = UIKit.Label(_scorePanel, "", 26, Color.white, TextAnchor.MiddleLeft, false);
                _lines[i].rectTransform.Place(new Vector2(0, 1), new Vector2(0, 0.5f), new Vector2(34, y), new Vector2(400, 44));
                _values[i] = UIKit.Label(_scorePanel, "", 28, Palette.Bone, TextAnchor.MiddleRight);
                _values[i].rectTransform.Place(new Vector2(1, 1), new Vector2(1, 0.5f), new Vector2(-34, y), new Vector2(240, 44));
                var sep = UIKit.Img(_scorePanel, "Sep", UIKit.GradH, Palette.Mastery.WithAlpha(0.25f));
                sep.rectTransform.Place(new Vector2(0.5f, 1), new Vector2(0.5f, 0.5f), new Vector2(0, y - 24), new Vector2(560, 2));
            }
            var totalBg = UIKit.Img(_scorePanel, "TotalBg", UIKit.Para, new Color(0.35f, 0.12f, 0.02f, 0.95f));
            totalBg.rectTransform.Place(new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0, 20), new Vector2(580, 80));
            var totalEdge = UIKit.Img(totalBg.rectTransform, "Edge", UIKit.ParaOutline, Palette.MuscleHot);
            totalEdge.rectTransform.Stretch(-2);
            var totalLabel = UIKit.Label(totalBg.rectTransform, "총 획득 스코어", 30, Color.white, TextAnchor.MiddleLeft);
            totalLabel.rectTransform.Stretch();
            totalLabel.rectTransform.offsetMin = new Vector2(40, 0);
            _total = UIKit.Label(totalBg.rectTransform, "0 pt", 52, Palette.HpYellow, TextAnchor.MiddleRight, true, true, true);
            _total.rectTransform.Stretch();
            _total.rectTransform.offsetMax = new Vector2(-40, 0);

            // stats (right)
            var statPanel = UIKit.Panel(Root, "Stats", Palette.NerveDeep);
            statPanel.Place(new Vector2(1, 0.6f), new Vector2(1, 0.5f), new Vector2(-40, 0), new Vector2(460, 330));
            UIKit.SlantPlate(statPanel, "배틀 기록", 30, new Color(0.08f, 0.2f, 0.45f), Color.white, new Vector2(0.5f, 1), Vector2.zero, new Vector2(280, 52));
            _stats = UIKit.Label(statPanel, "", 26, Color.white, TextAnchor.UpperLeft, false);
            _stats.lineSpacing = 1.4f;
            _stats.rectTransform.Stretch(30);
            _stats.rectTransform.offsetMax = new Vector2(-30, -50);

            // challenge
            var mission = UIKit.Panel(Root, "Mission", Palette.Gold, 0.85f);
            mission.Place(new Vector2(1, 0), new Vector2(1, 0), new Vector2(-40, 150), new Vector2(560, 110));
            _mission = UIKit.Label(mission, "", 26, Color.white, TextAnchor.MiddleLeft);
            _mission.rectTransform.Stretch(20);

            // buttons
            var again = MBButton.Create(Root, "다시 대전", "REMATCH", Palette.Muscle, new Vector2(0.5f, 0), new Vector2(-330, 110), new Vector2(300, 100), 36);
            again.OnClick = () => GameModeManager.Instance.Rematch();
            var select = MBButton.Create(Root, "캐릭터 선택", "CHARACTER", Palette.Mastery, new Vector2(0.5f, 0), new Vector2(0, 110), new Vector2(300, 100), 36);
            select.OnClick = () => GameModeManager.Instance.GoToSelect(GameModeManager.Instance.IsTwoPlayer);
            var menu = MBButton.Create(Root, "메인 메뉴", "MAIN MENU", Palette.TextDim, new Vector2(0.5f, 0), new Vector2(330, 110), new Vector2(300, 100), 36);
            menu.OnClick = () => GameModeManager.Instance.GoToTitle();
            _nav.Horizontal = true;
            _nav.Add(again);
            _nav.Add(select);
            _nav.Add(menu);
            ControlsBar(Root, "이동  좌/우      결정  J · Enter · Ⓐ");
        }

        public void Open(MatchResult r, bool playerLostToCpu, int winStreak)
        {
            Show();
            Root.SetAsLastSibling();
            var w = r.Winner;
            _victory.text = playerLostToCpu ? "DEFEAT" : "VICTORY";
            _victory.color = playerLostToCpu ? Palette.TextDim : Palette.Gold;
            _victorySub.text = playerLostToCpu ? "패배... 다시 도전!" : w.Def.NameKo + " 승리!";
            _quote.text = w.Def.WinLine;
            _ko.text = "K.O.";

            int hpPct = Mathf.CeilToInt(w.HpRatio * 100f);
            var entries = new (string label, int value)[]
            {
                ("기본 승리 보너스", 3000),
                ($"남은 체력 보너스 ({hpPct}%)", hpPct * 10),
                ($"최대 콤보 보너스 ({w.MaxCombo} Hits)", w.MaxCombo * 100),
                ($"카운터 공격 ({w.CounterHits + w.PerfectCounters}회)", (w.CounterHits + w.PerfectCounters * 2) * 150),
                ($"퍼펙트 가드 ({w.PerfectGuards}회)", w.PerfectGuards * 100),
                ($"다양한 기술 사용 ({w.MovesUsed.Count}종)", w.MovesUsed.Count * 50),
            };
            _stats.text =
                $"승자  <color=#FFD040>{w.Def.NameEn}</color>\n" +
                $"라운드  {w.RoundWins} - {w.Opponent.RoundWins}\n" +
                $"스페셜 / 얼티밋 적중  {w.SpecialsLanded}\n" +
                $"퍼펙트 카운터  {w.PerfectCounters}\n" +
                $"최대 콤보  {w.MaxCombo} HIT";
            _mission.text = $"다음 도전 과제!  CPU 상대 3연승 ({Mathf.Min(3, winStreak)}/3)";
            if (_co != null) StopCoroutine(_co);
            _co = StartCoroutine(CountUp(entries));
            _nav.Focus(0);
            AudioManager.Instance?.PlayBgm("result", true, 1.2f);
        }

        IEnumerator CountUp((string label, int value)[] entries)
        {
            for (int i = 0; i < _lines.Length; i++) { _lines[i].text = ""; _values[i].text = ""; }
            _total.text = "0 pt";
            int total = 0;
            yield return new WaitForSecondsRealtime(0.4f);
            for (int i = 0; i < entries.Length && i < _lines.Length; i++)
            {
                _lines[i].text = entries[i].label;
                _values[i].text = "+" + entries[i].value.ToString("N0") + " pt";
                total += entries[i].value;
                AudioManager.Instance?.PlaySfx("ui_tick", 0.6f, 1f + i * 0.05f);
                yield return new WaitForSecondsRealtime(0.18f);
            }
            float t = 0;
            while (t < 0.8f)
            {
                t += Time.unscaledDeltaTime;
                _total.text = Mathf.RoundToInt(total * Mathf.SmoothStep(0, 1, t / 0.8f)).ToString("N0") + " pt";
                yield return null;
            }
            _total.text = total.ToString("N0") + " pt";
            AudioManager.Instance?.PlaySfx("ui_correct", 0.8f);
        }

        void Update()
        {
            if (!Visible) return;
            _ko.rectTransform.localScale = Vector3.one * (1f + Mathf.Sin(Time.unscaledTime * 3f) * 0.02f);
            _nav.Update();
        }
    }
}
