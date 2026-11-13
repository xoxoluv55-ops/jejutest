using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace MuscleBattle
{
    /// <summary>
    /// MUSCLE LINK CHALLENGE overlay (concept-art style, never a grey popup).
    ///
    ///   MUSCLE LINK CHALLENGE                (slanted plate, who is choosing + Learn/Practice/Recall tag)
    ///   SHOULDER ABDUCTION  어깨관절 벌림      (big motion title)
    ///   이 동작의 주요 근육 2개를 선택하세요.
    ///   [card][card][card][card]             3D anatomy render of the fighter's own body with the muscle lit,
    ///                                        Korean + English name, button glyph, select glow, hover / tap effect
    ///   ============ timer ============
    ///              [ LINK! ]                 enabled once enough muscles are picked
    ///
    /// Lives on the top of the UI canvas while open (above touch controls / pause button) so nothing covers it.
    /// Cards are 330x390 reference px (~180pt on an iPad) - easy to hit with a thumb.
    /// </summary>
    public sealed class MuscleSelectUI : MonoBehaviour
    {
        const int Cards = 4;
        const float CardW = 330f, CardH = 390f, CardGap = 26f, CardsY = 360f;

        RectTransform _root, _panel, _resultRoot, _tutorialRoot;
        Transform _canvas;
        Text _header, _motionEn, _motionKo, _prompt, _tag, _who, _result, _resultSub, _tutorialText, _linkLabel, _linkSub;
        Image _timer, _timerBack, _linkBack, _linkEdge, _linkGlow, _tutorialBar, _shade;
        RectTransform _link;
        readonly RectTransform[] _cards = new RectTransform[Cards];
        readonly Image[] _cardBack = new Image[Cards];
        readonly Image[] _cardEdge = new Image[Cards];
        readonly Image[] _cardGlow = new Image[Cards];
        readonly RawImage[] _cardImage = new RawImage[Cards];
        readonly Image[] _cardNerve = new Image[Cards];
        readonly Text[] _cardKo = new Text[Cards];
        readonly Text[] _cardEn = new Text[Cards];
        readonly Text[] _cardKey = new Text[Cards];
        readonly Text[] _cardHint = new Text[Cards];
        readonly Text[] _cardMark = new Text[Cards];
        readonly bool[] _picked = new bool[Cards];
        readonly float[] _pickAnim = new float[Cards];
        readonly float[] _hover = new float[Cards];
        float _open, _linkNudge, _resultPunch;
        bool _cpu, _showingResult;
        int _need, _pickCount;
        Color _accent = Palette.Muscle;

        public bool IsOpen => _root != null && _root.gameObject.activeSelf;

        public static MuscleSelectUI Create(Transform parent)
        {
            var rt = UIKit.Node("MuscleLinkChallenge", parent);
            rt.Stretch();
            var ui = rt.gameObject.AddComponent<MuscleSelectUI>();
            ui._root = rt;
            var canvas = parent.GetComponentInParent<Canvas>();
            ui._canvas = canvas != null ? canvas.transform : parent;
            ui.Build();
            rt.gameObject.SetActive(false);
            return ui;
        }

        void Build()
        {
            // darkened lower area: the fight stays visible above, the cards read clearly
            _shade = UIKit.Img(_root, "Shade", UIKit.GradV, new Color(0.01f, 0.0f, 0.05f, 0.9f));
            _shade.rectTransform.anchorMin = Vector2.zero;
            _shade.rectTransform.anchorMax = new Vector2(1, 0);
            _shade.rectTransform.pivot = new Vector2(0.5f, 0);
            _shade.rectTransform.sizeDelta = new Vector2(0, 860);
            _shade.rectTransform.anchoredPosition = Vector2.zero;
            _shade.rectTransform.localScale = new Vector3(1, -1, 1);
            _shade.rectTransform.anchoredPosition = new Vector2(0, 860);

            // both fighters' illustrations frame the challenge (left Jin, right Ray)
            UIKit.Art(_root, "art_jin_quiz", new Vector2(0, 0), new Vector2(0, 0), new Vector2(-30, 0), 900);
            UIKit.Art(_root, "art_ray_quiz", new Vector2(1, 0), new Vector2(1, 0), new Vector2(30, 0), 900);
            _panel = UIKit.Node("Panel", _root).Place(new Vector2(0.5f, 0), new Vector2(0.5f, 0), Vector2.zero, new Vector2(1500, 820));

            // ---- header ----
            var plate = UIKit.Img(_panel, "HeaderPlate", UIKit.Para, new Color(0.45f, 0.04f, 0.14f, 0.95f));
            plate.rectTransform.Place(new Vector2(0.5f, 0), new Vector2(0.5f, 0.5f), new Vector2(0, 770), new Vector2(720, 62));
            var plateEdge = UIKit.Img(plate.rectTransform, "Edge", UIKit.ParaOutline, Palette.MuscleHot);
            plateEdge.rectTransform.Stretch(-2);
            var plateGlow = UIKit.Img(plate.rectTransform, "Glow", UIKit.Glow, Palette.Muscle.WithAlpha(0.45f));
            plateGlow.rectTransform.Stretch(-40);
            plateGlow.transform.SetAsFirstSibling();
            _header = UIKit.Label(plate.rectTransform, "MUSCLE LINK CHALLENGE", 36, Color.white, TextAnchor.MiddleCenter, true, true, true);
            _header.rectTransform.Stretch();
            _tag = UIKit.Label(_panel, "", 24, Palette.Gold, TextAnchor.MiddleLeft, true);
            _tag.rectTransform.Place(new Vector2(0, 0), new Vector2(0, 0.5f), new Vector2(40, 770), new Vector2(360, 34));
            _who = UIKit.Label(_panel, "", 24, Palette.Nerve, TextAnchor.MiddleRight, true);
            _who.rectTransform.Place(new Vector2(1, 0), new Vector2(1, 0.5f), new Vector2(-40, 770), new Vector2(360, 34));

            _motionEn = UIKit.Label(_panel, "", 70, Palette.Gold, TextAnchor.MiddleCenter, true, true, true);
            _motionEn.rectTransform.Place(new Vector2(0.5f, 0), new Vector2(0.5f, 0.5f), new Vector2(0, 690), new Vector2(1500, 84));
            _motionKo = UIKit.Label(_panel, "", 36, Color.white, TextAnchor.MiddleCenter, true);
            _motionKo.rectTransform.Place(new Vector2(0.5f, 0), new Vector2(0.5f, 0.5f), new Vector2(0, 628), new Vector2(1500, 46));
            _prompt = UIKit.Label(_panel, "", 32, Palette.Bone, TextAnchor.MiddleCenter, true);
            _prompt.rectTransform.Place(new Vector2(0.5f, 0), new Vector2(0.5f, 0.5f), new Vector2(0, 580), new Vector2(1500, 42));

            // ---- cards ----
            float total = Cards * CardW + (Cards - 1) * CardGap;
            for (int i = 0; i < Cards; i++)
            {
                float x = -total / 2f + CardW / 2f + i * (CardW + CardGap);
                var glow = UIKit.Img(_panel, "Glow" + i, UIKit.Glow, Palette.Gold.WithAlpha(0));
                glow.rectTransform.Place(new Vector2(0.5f, 0), new Vector2(0.5f, 0.5f), new Vector2(x, CardsY), new Vector2(CardW + 120, CardH + 120));
                _cardGlow[i] = glow;
                var back = UIKit.Img(_panel, "Card" + i, UIKit.Round, new Color(0.06f, 0.035f, 0.14f, 0.96f), true);
                _cards[i] = back.rectTransform.Place(new Vector2(0.5f, 0), new Vector2(0.5f, 0.5f), new Vector2(x, CardsY), new Vector2(CardW, CardH));
                _cardBack[i] = back;

                // anatomy render (rounded mask)
                var imgMask = UIKit.Node("ImageMask", _cards[i]).Place(new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0, -10), new Vector2(CardW - 20, 236));
                imgMask.gameObject.AddComponent<RectMask2D>();
                _cardImage[i] = UIKit.Raw(imgMask, "Anatomy", null);
                _cardImage[i].rectTransform.Place(new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(CardW - 20, CardW - 20));
                var imgEdge = UIKit.Img(imgMask, "Scan", UIKit.GradV, Palette.Nerve.WithAlpha(0.18f));
                imgEdge.rectTransform.Stretch();
                _cardNerve[i] = UIKit.Img(_cards[i], "Nerve", MBAssets.SpriteFrom(ProceduralTextures.Icon("bolt")), Palette.Nerve);
                _cardNerve[i].rectTransform.Place(new Vector2(0.5f, 1), new Vector2(0.5f, 0.5f), new Vector2(0, -128), new Vector2(150, 150));

                _cardEdge[i] = UIKit.Img(_cards[i], "Edge", UIKit.RoundOutline, Palette.Muscle.WithAlpha(0.7f));
                _cardEdge[i].rectTransform.Stretch(-3);

                var keyBg = UIKit.Img(_cards[i], "Key", UIKit.Circle, Palette.Muscle.WithAlpha(0.95f));
                keyBg.rectTransform.Place(new Vector2(0, 1), new Vector2(0.5f, 0.5f), new Vector2(40, -40), new Vector2(64, 64));
                _cardKey[i] = UIKit.Label(keyBg.rectTransform, "", 20, Color.white);
                _cardKey[i].lineSpacing = 0.85f;
                _cardKey[i].rectTransform.Stretch();
                _cardHint[i] = UIKit.Label(_cards[i], "", 26, Palette.Gold, TextAnchor.MiddleRight, true, true, true);
                _cardHint[i].rectTransform.Place(new Vector2(1, 1), new Vector2(1, 1), new Vector2(-14, -12), new Vector2(170, 36));
                _cardMark[i] = UIKit.Label(_cards[i], "", 24, Palette.Gold, TextAnchor.MiddleCenter, true, true, true);
                _cardMark[i].rectTransform.Place(new Vector2(0.5f, 1), new Vector2(0.5f, 0.5f), new Vector2(0, -232), new Vector2(CardW, 30));
                _cardKo[i] = UIKit.Label(_cards[i], "", 42, Color.white, TextAnchor.MiddleCenter, true, true);
                _cardKo[i].rectTransform.Place(new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0, 58), new Vector2(CardW - 10, 54));
                _cardEn[i] = UIKit.Label(_cards[i], "", 24, Palette.TextDim, TextAnchor.MiddleCenter, false);
                _cardEn[i].rectTransform.Place(new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0, 20), new Vector2(CardW - 10, 32));
            }

            // ---- timer ----
            _timerBack = UIKit.Img(_panel, "TimerBack", UIKit.Para, new Color(0.04f, 0.02f, 0.1f, 0.92f));
            _timerBack.rectTransform.Place(new Vector2(0.5f, 0), new Vector2(0.5f, 0.5f), new Vector2(0, 142), new Vector2(total, 16));
            _timer = UIKit.Img(_timerBack.rectTransform, "Timer", UIKit.Para, Palette.Nerve);
            _timer.rectTransform.Stretch(2);
            _timer.type = Image.Type.Filled;
            _timer.fillMethod = Image.FillMethod.Horizontal;

            // ---- LINK! ----
            _linkGlow = UIKit.Img(_panel, "LinkGlow", UIKit.Glow, Palette.Gold.WithAlpha(0));
            _linkGlow.rectTransform.Place(new Vector2(0.5f, 0), new Vector2(0.5f, 0.5f), new Vector2(0, 74), new Vector2(640, 220));
            _linkBack = UIKit.Img(_panel, "Link", UIKit.Para, new Color(0.2f, 0.1f, 0.05f, 0.95f), true);
            _link = _linkBack.rectTransform.Place(new Vector2(0.5f, 0), new Vector2(0.5f, 0.5f), new Vector2(0, 74), new Vector2(440, 104));
            _linkEdge = UIKit.Img(_link, "Edge", UIKit.ParaOutline, Palette.Gold);
            _linkEdge.rectTransform.Stretch(-3);
            _linkLabel = UIKit.Label(_link, "LINK!", 56, Color.white, TextAnchor.MiddleCenter, true, true, true);
            _linkLabel.rectTransform.Stretch();
            _linkLabel.rectTransform.offsetMin = new Vector2(0, 24);
            _linkSub = UIKit.Label(_link, "", 20, Palette.Bone, TextAnchor.MiddleCenter, false);
            _linkSub.rectTransform.Place(new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0, 10), new Vector2(430, 26));

            // ---- learn stage explanation ----
            _tutorialRoot = UIKit.Node("Tutorial", _panel).Place(new Vector2(0.5f, 0), new Vector2(0.5f, 0.5f), new Vector2(0, 74), new Vector2(1400, 112));
            var tb = UIKit.Img(_tutorialRoot, "Back", UIKit.Para, new Color(0.05f, 0.12f, 0.25f, 0.96f));
            tb.rectTransform.Stretch();
            var te = UIKit.Img(_tutorialRoot, "Edge", UIKit.ParaOutline, Palette.Nerve);
            te.rectTransform.Stretch(-2);
            _tutorialText = UIKit.Label(_tutorialRoot, "", 32, Color.white, TextAnchor.MiddleCenter, true);
            _tutorialText.horizontalOverflow = HorizontalWrapMode.Wrap;
            _tutorialText.rectTransform.Stretch(16);
            _tutorialText.rectTransform.offsetMin = new Vector2(30, 22);
            _tutorialBar = UIKit.Img(_tutorialRoot, "Bar", UIKit.White, Palette.Nerve);
            _tutorialBar.rectTransform.Place(new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0, 8), new Vector2(1300, 6));
            _tutorialBar.type = Image.Type.Filled;
            _tutorialBar.fillMethod = Image.FillMethod.Horizontal;

            // ---- result ----
            _resultRoot = UIKit.Node("Result", _panel).Place(new Vector2(0.5f, 0), new Vector2(0.5f, 0.5f), new Vector2(0, CardsY), new Vector2(1500, 190));
            var rb = UIKit.Img(_resultRoot, "Back", UIKit.Para, new Color(0.04f, 0.02f, 0.1f, 0.9f));
            rb.rectTransform.Stretch();
            _result = UIKit.Label(_resultRoot, "", 92, Palette.Gold, TextAnchor.MiddleCenter, true, true, true);
            _result.rectTransform.Stretch();
            _result.rectTransform.offsetMin = new Vector2(0, 46);
            _resultSub = UIKit.Label(_resultRoot, "", 30, Color.white, TextAnchor.MiddleCenter, true);
            _resultSub.rectTransform.Place(new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0, 16), new Vector2(1480, 40));
        }

        public RectTransform CardRect(int i) => i >= 0 && i < Cards && IsOpen && !_showingResult && _cards[i].gameObject.activeSelf ? _cards[i] : null;
        public RectTransform LinkRect => IsOpen && !_showingResult && !_cpu && _link.gameObject.activeSelf ? _link : null;

        public void Open(MuscleQuestion q, FighterController f, bool cpu, int stage, KnowledgeLevel level)
        {
            // move on top of everything on the canvas (touch controls, pause button, other HUD)
            if (_canvas != null && _root.parent != _canvas) _root.SetParent(_canvas, false);
            _root.gameObject.SetActive(true);
            _root.SetAsLastSibling();
            TouchControls.Suppressed = true;
            _cpu = cpu;
            _showingResult = false;
            _resultRoot.gameObject.SetActive(false);
            _open = 0;
            _need = q.CorrectCount;
            _pickCount = 0;
            _accent = f.Def.Energy;

            _header.text = q.Kind switch
            {
                QuestionKind.ForceCouple => "FORCE COUPLE CHALLENGE",
                QuestionKind.Innervation => "NEURAL CHALLENGE",
                _ => "MUSCLE LINK CHALLENGE",
            };
            _motionEn.text = q.MotionEn;
            _motionKo.text = q.MotionKo;
            _prompt.text = cpu ? "CPU가 고르는 중 — 정답을 같이 맞혀 보세요!" : q.PromptKo;
            _tag.text = cpu ? "OBSERVE" : stage == 0 ? "LEARN · 학습" : stage == 1 ? "PRACTICE · 힌트" : "RECALL · 기억";
            _who.text = (cpu ? "CPU  " : f.Side == 0 ? "1P  " : "2P  ") + f.Def.NameEn;
            _who.color = Palette.PlayerColor(f.Side);

            bool p2Keys = f.Side == 1 && GameModeManager.Instance != null && GameModeManager.Instance.IsTwoPlayer;
            bool touch = GameSettings.UseTouchControls;
            string[] keys = p2Keys ? new[] { "1\nX", "2\nY", "3\nA", "ENT\nB" } : new[] { "J\nX", "K\nY", "L\nA", "SPC\nB" };
            bool showImages = level == KnowledgeLevel.Rookie;
            int hintShown = 0;
            for (int i = 0; i < Cards; i++)
            {
                bool has = i < q.Options.Length;
                _cards[i].gameObject.SetActive(has);
                _cardGlow[i].gameObject.SetActive(has);
                if (!has) continue;
                var o = q.Options[i];
                _picked[i] = false;
                _pickAnim[i] = 0;
                _hover[i] = 0;
                _cardKo[i].text = o.Ko;
                _cardEn[i].text = o.En;
                _cardKey[i].text = cpu ? (i + 1).ToString() : touch && !p2Keys ? (i + 1).ToString() : keys[i];
                _cardKey[i].fontSize = cpu || (touch && !p2Keys) ? 30 : 20;

                // Rookie: 3D anatomy render of the fighter's own body with that muscle lit; nerves get a nerve icon
                bool nerve = o.Nerve || o.Group == MuscleGroup.None;
                _cardNerve[i].gameObject.SetActive(nerve && showImages);
                _cardImage[i].gameObject.SetActive(!nerve && showImages);
                if (!nerve && showImages) _cardImage[i].texture = PortraitStudio.GetAnatomy(f.Def, o.Group, Palette.MuscleHot);
                _cardKo[i].rectTransform.anchoredPosition = new Vector2(0, showImages ? 58 : 190);
                _cardEn[i].rectTransform.anchoredPosition = new Vector2(0, showImages ? 20 : 150);
                _cardKo[i].fontSize = showImages ? 42 : 50;

                bool hint = !cpu && o.Correct && (stage == 0 || (stage == 1 && hintShown++ == 0));
                _cardHint[i].text = hint ? (stage == 0 ? "★ 정답" : "★ 힌트") : "";
                _cardHint[i].color = Palette.Gold;
                _cardMark[i].text = "";
                _cardEdge[i].color = hint ? Palette.Gold.WithAlpha(0.9f) : _accent.WithAlpha(0.7f);
                _cardBack[i].color = new Color(0.06f, 0.035f, 0.14f, 0.96f);
                _cardGlow[i].SetAlpha(0);
                _cards[i].localScale = Vector3.one;
            }
            _link.gameObject.SetActive(!cpu);
            _linkGlow.gameObject.SetActive(!cpu);
            RefreshLink();
            _tutorialRoot.gameObject.SetActive(false);
            if (!cpu && stage == 0)
            {
                _tutorialText.text = "LEARN  ·  " + q.TutorialKo;
                _tutorialRoot.gameObject.SetActive(true);
            }
            SetTime(1f);
        }

        public void SetTutorial(float remaining)
        {
            bool on = remaining > 0;
            _tutorialRoot.gameObject.SetActive(on);
            _link.gameObject.SetActive(!on && !_cpu);
            _linkGlow.gameObject.SetActive(!on && !_cpu);
            if (on) _tutorialBar.fillAmount = Mathf.Clamp01(remaining / 1.8f);
        }

        public void SetTime(float t01)
        {
            _timer.fillAmount = Mathf.Clamp01(t01);
            _timer.color = t01 > 0.35f ? Palette.Nerve : Color.Lerp(Palette.HpDamage, Palette.Nerve, t01 / 0.35f);
        }

        public void SetPicks(List<int> picks, int need)
        {
            _need = need;
            _pickCount = picks.Count;
            for (int i = 0; i < Cards; i++)
            {
                bool now = picks.Contains(i);
                if (now && !_picked[i]) _pickAnim[i] = 1f;
                _picked[i] = now;
                int order = picks.IndexOf(i);
                _cardMark[i].text = now ? "SELECTED  " + (order + 1) : "";
                _cardBack[i].color = now ? new Color(0.32f, 0.08f, 0.3f, 0.97f) : new Color(0.06f, 0.035f, 0.14f, 0.96f);
            }
            RefreshLink();
        }

        void RefreshLink()
        {
            bool ready = _pickCount >= _need;
            _linkLabel.text = ready ? "LINK!" : "LINK  " + _pickCount + "/" + _need;
            _linkSub.text = GameSettings.UseTouchControls ? "탭하여 연결 · I · RB" : "I · RB · 클릭";
        }

        public void NudgeLink() => _linkNudge = 1f;

        public void ShowResult(LinkResult r, MuscleQuestion q, List<int> picks)
        {
            _showingResult = true;
            for (int i = 0; i < q.Options.Length && i < Cards; i++)
            {
                bool c = q.Options[i].Correct;
                bool p = picks.Contains(i);
                _cardEdge[i].color = c ? Palette.Gold : p ? Palette.HpDamage : Palette.TextDim.WithAlpha(0.3f);
                _cardHint[i].text = c ? "정답!" : p ? "오답" : "";
                _cardHint[i].color = c ? Palette.Gold : Palette.HpDamage;
                _cardGlow[i].color = (c ? Palette.Gold : Palette.HpDamage).WithAlpha(c ? 0.55f : p ? 0.35f : 0f);
            }
            _resultRoot.gameObject.SetActive(true);
            _resultRoot.SetAsLastSibling();
            _link.gameObject.SetActive(false);
            _linkGlow.gameObject.SetActive(false);
            (_result.text, _result.color, _resultSub.text) = r switch
            {
                LinkResult.Perfect or LinkResult.Link => (q.PerfectTitle, Palette.Gold,
                    q.ForceCouple ? "데미지 +35% · 콤보 +2타 · 게이지 회복 · 빠른 회복" : "데미지 +35% · 콤보 +1타 · 게이지 회복 · 빠른 회복"),
                LinkResult.Partial => ("PARTIAL LINK", Color.white, "스킬 발동 · 데미지 -15% · 콤보 연장 없음"),
                _ => ("MUSCLE LINK FAILED", Palette.TextDim, "약한 버전으로 발동 · 데미지 -40%"),
            };
            _resultPunch = 1f;
        }

        public void Close()
        {
            _root.gameObject.SetActive(false);
            TouchControls.Suppressed = false;
        }

        void Update()
        {
            if (!IsOpen) return;
            float dt = Time.unscaledDeltaTime;
            float t = Time.unscaledTime;
            _open = Mathf.MoveTowards(_open, 1, dt * 6f);
            float ease = 1f - Mathf.Pow(1f - _open, 3f);
            _panel.anchoredPosition = new Vector2(0, -(1f - ease) * 500f);
            _shade.SetAlpha(0.9f * ease);
            _header.rectTransform.parent.localScale = Vector3.one * (1f + Mathf.Sin(t * 4f) * 0.015f);

            for (int i = 0; i < Cards; i++)
            {
                if (!_cards[i].gameObject.activeSelf) continue;
                bool hover = !_cpu && !_showingResult && MenuInput.PointerHover(_cards[i]);
                _hover[i] = Mathf.MoveTowards(_hover[i], hover ? 1f : 0f, dt * 8f);
                _pickAnim[i] = Mathf.MoveTowards(_pickAnim[i], 0, dt * 4f);
                float picked = _picked[i] ? 1f : 0f;
                // cards deal in one after another
                float deal = Mathf.Clamp01(_open * 1.6f - i * 0.12f);
                _cards[i].anchoredPosition = new Vector2(_cards[i].anchoredPosition.x, CardsY - (1f - Mathf.SmoothStep(0, 1, deal)) * 220f);
                _cardGlow[i].rectTransform.anchoredPosition = _cards[i].anchoredPosition;
                _cards[i].localScale = Vector3.one * (1f + picked * 0.06f + _pickAnim[i] * 0.12f + _hover[i] * 0.04f);
                if (!_showingResult)
                {
                    _cardGlow[i].color = (picked > 0 ? Palette.Gold : _accent).WithAlpha(
                        picked * (0.5f + 0.15f * Mathf.Sin(t * 8f)) + _pickAnim[i] * 0.4f + _hover[i] * 0.25f);
                    if (_picked[i]) _cardEdge[i].color = Color.Lerp(Palette.Gold, Color.white, 0.3f + 0.3f * Mathf.Sin(t * 8f));
                    else if (string.IsNullOrEmpty(_cardHint[i].text)) _cardEdge[i].color = Color.Lerp(_accent.WithAlpha(0.7f), Color.white, _hover[i] * 0.6f);
                }
            }

            // LINK! button: dim until enough muscles are picked, then a pulsing gold "press me"
            if (_link.gameObject.activeSelf)
            {
                bool ready = _pickCount >= _need;
                float pulse = ready ? 0.5f + 0.5f * Mathf.Sin(t * 7f) : 0f;
                _linkNudge = Mathf.MoveTowards(_linkNudge, 0, dt * 3f);
                bool hover = MenuInput.PointerHover(_link);
                _link.localScale = Vector3.one * (1f + pulse * 0.06f + (hover ? 0.04f : 0f)) ;
                _link.anchoredPosition = new Vector2(Mathf.Sin(t * 60f) * 10f * _linkNudge, 74);
                _linkBack.color = ready ? Color.Lerp(new Color(0.55f, 0.25f, 0.02f, 0.97f), new Color(0.85f, 0.45f, 0.05f, 0.97f), pulse)
                                        : new Color(0.12f, 0.08f, 0.16f, 0.92f);
                _linkEdge.color = ready ? Color.Lerp(Palette.Gold, Color.white, pulse * 0.5f) : Palette.TextDim.WithAlpha(0.6f);
                _linkLabel.color = ready ? Color.white : Palette.TextDim;
                _linkGlow.color = Palette.Gold.WithAlpha(ready ? 0.35f + 0.3f * pulse : 0f);
            }

            if (_resultRoot.gameObject.activeSelf)
            {
                _resultPunch = Mathf.MoveTowards(_resultPunch, 0, dt * 4f);
                _resultRoot.localScale = Vector3.one * (1f + _resultPunch * _resultPunch * 0.4f);
            }
        }
    }
}
