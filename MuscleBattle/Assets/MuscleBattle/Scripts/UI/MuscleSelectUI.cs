using UnityEngine;
using UnityEngine.UI;

namespace MuscleBattle
{
    /// <summary>
    /// Muscle quick-select (§10): a row of 4 big cards in the lower-centre of the screen
    /// (no big centre panel, the fight stays visible). Each card: button glyph, small anatomy
    /// render, Korean + English name. Picked = glow + outline. Auto-confirms after 2 picks.
    /// Cards are ~150pt wide on an iPad, easy to tap.
    /// </summary>
    public sealed class MuscleSelectUI : MonoBehaviour
    {
        const int Cards = 4;
        RectTransform _root, _resultRoot;
        Text _title, _sub, _tag, _who, _result, _resultSub;
        Image _timer;
        readonly RectTransform[] _cards = new RectTransform[Cards];
        readonly Image[] _cardBack = new Image[Cards];
        readonly Image[] _cardEdge = new Image[Cards];
        readonly Image[] _cardGlow = new Image[Cards];
        readonly Image[] _cardIcon = new Image[Cards];
        readonly Text[] _cardKo = new Text[Cards];
        readonly Text[] _cardEn = new Text[Cards];
        readonly Text[] _cardKey = new Text[Cards];
        readonly Text[] _cardHint = new Text[Cards];
        readonly bool[] _picked = new bool[Cards];
        readonly float[] _pickAnim = new float[Cards];
        float _open;

        public bool IsOpen => _root.gameObject.activeSelf;

        public static MuscleSelectUI Create(Transform parent)
        {
            var rt = UIKit.Node("MuscleSelect", parent).Place(new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0, 128), new Vector2(1260, 330));
            var ui = rt.gameObject.AddComponent<MuscleSelectUI>();
            ui._root = rt;
            ui.Build();
            rt.gameObject.SetActive(false);
            return ui;
        }

        void Build()
        {
            // slim title strip above the cards
            var head = UIKit.Img(_root, "Head", UIKit.Para, new Color(0.42f, 0.04f, 0.16f, 0.92f));
            head.rectTransform.Place(new Vector2(0.5f, 1), new Vector2(0.5f, 1), Vector2.zero, new Vector2(820, 58));
            var headEdge = UIKit.Img(head.rectTransform, "Edge", UIKit.ParaOutline, Palette.MuscleHot);
            headEdge.rectTransform.Stretch(-2);
            _title = UIKit.Label(head.rectTransform, "", 34, Color.white, TextAnchor.MiddleCenter, true, true, true);
            _title.rectTransform.Stretch();
            _tag = UIKit.Label(_root, "", 22, Palette.Gold, TextAnchor.MiddleLeft);
            _tag.rectTransform.Place(new Vector2(0, 1), new Vector2(0, 1), new Vector2(10, -14), new Vector2(200, 30));
            _who = UIKit.Label(_root, "", 22, Palette.Nerve, TextAnchor.MiddleRight);
            _who.rectTransform.Place(new Vector2(1, 1), new Vector2(1, 1), new Vector2(-10, -14), new Vector2(240, 30));
            _sub = UIKit.Label(_root, "", 24, Palette.Bone);
            _sub.rectTransform.Place(new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0, -60), new Vector2(1000, 32));

            for (int i = 0; i < Cards; i++)
            {
                float x = -465 + i * 310;
                var glow = UIKit.Img(_root, "Glow" + i, UIKit.Glow, Palette.Gold.WithAlpha(0));
                glow.rectTransform.Place(new Vector2(0.5f, 0), new Vector2(0.5f, 0.5f), new Vector2(x, 112), new Vector2(380, 300));
                _cardGlow[i] = glow;
                var back = UIKit.Img(_root, "Card" + i, UIKit.Round, new Color(0.07f, 0.04f, 0.16f, 0.9f), true);
                _cards[i] = back.rectTransform.Place(new Vector2(0.5f, 0), new Vector2(0.5f, 0.5f), new Vector2(x, 112), new Vector2(290, 220));
                _cardBack[i] = back;
                _cardEdge[i] = UIKit.Img(_cards[i], "Edge", UIKit.RoundOutline, Palette.Muscle.WithAlpha(0.6f));
                _cardEdge[i].rectTransform.Stretch(-3);
                _cardIcon[i] = UIKit.Img(_cards[i], "Anatomy", null, Color.white);
                _cardIcon[i].rectTransform.Place(new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0, -8), new Vector2(118, 118));
                _cardIcon[i].preserveAspect = true;
                var keyBg = UIKit.Img(_cards[i], "Key", UIKit.Circle, Palette.Muscle.WithAlpha(0.95f));
                keyBg.rectTransform.Place(new Vector2(0, 1), new Vector2(0.5f, 0.5f), new Vector2(34, -34), new Vector2(56, 56));
                _cardKey[i] = UIKit.Label(keyBg.rectTransform, "", 18, Color.white);
                _cardKey[i].lineSpacing = 0.85f;
                _cardKey[i].rectTransform.Stretch();
                _cardHint[i] = UIKit.Label(_cards[i], "", 20, Palette.Gold, TextAnchor.MiddleRight);
                _cardHint[i].rectTransform.Place(new Vector2(1, 1), new Vector2(1, 1), new Vector2(-12, -10), new Vector2(120, 28));
                _cardKo[i] = UIKit.Label(_cards[i], "", 38, Color.white);
                _cardKo[i].rectTransform.Place(new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0, 44), new Vector2(280, 48));
                _cardEn[i] = UIKit.Label(_cards[i], "", 20, Palette.TextDim, TextAnchor.MiddleCenter, false);
                _cardEn[i].rectTransform.Place(new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0, 14), new Vector2(280, 28));
            }

            var timerBack = UIKit.Img(_root, "TimerBack", UIKit.Para, new Color(0.04f, 0.02f, 0.1f, 0.9f));
            timerBack.rectTransform.Place(new Vector2(0.5f, 0), new Vector2(0.5f, 0.5f), new Vector2(0, -8), new Vector2(1220, 14));
            _timer = UIKit.Img(timerBack.rectTransform, "Timer", UIKit.Para, Palette.Nerve);
            _timer.rectTransform.Stretch(2);
            _timer.type = Image.Type.Filled;
            _timer.fillMethod = Image.FillMethod.Horizontal;

            _resultRoot = UIKit.Node("Result", _root).Place(new Vector2(0.5f, 0), new Vector2(0.5f, 0.5f), new Vector2(0, 112), new Vector2(1240, 150));
            var rb = UIKit.Img(_resultRoot, "Back", UIKit.Para, new Color(0.04f, 0.02f, 0.1f, 0.88f));
            rb.rectTransform.Stretch();
            _result = UIKit.Label(_resultRoot, "", 72, Palette.Gold, TextAnchor.MiddleCenter, true, true, true);
            _result.rectTransform.Stretch();
            _result.rectTransform.offsetMin = new Vector2(0, 30);
            _resultSub = UIKit.Label(_resultRoot, "", 26, Color.white);
            _resultSub.rectTransform.Place(new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0, 14), new Vector2(1200, 34));
        }

        static readonly System.Collections.Generic.Dictionary<string, Sprite> Icons = new System.Collections.Generic.Dictionary<string, Sprite>();

        static Sprite IconSprite(string key)
        {
            if (!Icons.TryGetValue(key, out var sp) || sp == null)
                Icons[key] = sp = MBAssets.SpriteFrom(ProceduralTextures.MuscleIcon(key));
            return sp;
        }

        public RectTransform CardRect(int i) => i >= 0 && i < Cards && IsOpen && _cards[i].gameObject.activeSelf ? _cards[i] : null;

        public void Open(MuscleQuestion q, FighterController f, bool cpu, int hintLevel, float limit)
        {
            _root.gameObject.SetActive(true);
            _root.SetAsLastSibling();
            TouchControls.Suppressed = true;
            _resultRoot.gameObject.SetActive(false);
            _open = 0;
            _title.text = "MUSCLE SKILL  ·  " + q.MotionKo + "  " + q.MotionEn;
            _sub.text = cpu ? "CPU가 근육을 고르는 중 — 정답을 같이 맞혀 보세요!" : $"이 동작의 주동근 {q.CorrectCount}개를 고르세요!";
            _tag.text = cpu ? "OBSERVE" : hintLevel == 0 ? "LEARN · 학습" : hintLevel == 1 ? "PRACTICE · 힌트" : "RECALL · 기억";
            _who.text = (cpu ? "CPU " : f.Side == 0 ? "1P " : "2P ") + f.Def.NameEn;
            _who.color = Palette.PlayerColor(f.Side);
            bool p2Keys = f.Side == 1 && GameModeManager.Instance != null && GameModeManager.Instance.IsTwoPlayer;
            string[] keys = p2Keys ? new[] { "1\nX", "2\nY", "3\nA", "ENT\nB" } : new[] { "J\nX", "K\nY", "L\nA", "SPC\nB" };
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
                _cardKo[i].text = o.Ko;
                _cardEn[i].text = o.En;
                _cardIcon[i].sprite = IconSprite(o.Image);
                _cardKey[i].text = cpu ? (i + 1).ToString() : keys[i];
                _cardKey[i].fontSize = cpu ? 28 : 18;
                bool hint = !cpu && o.Correct && (hintLevel == 0 || (hintLevel == 1 && hintShown++ == 0));
                _cardHint[i].text = hint ? (hintLevel == 0 ? "★ 정답" : "★ 힌트") : "";
                _cardHint[i].color = Palette.Gold;
                _cardEdge[i].color = hint ? Palette.Gold.WithAlpha(0.9f) : Palette.Muscle.WithAlpha(0.6f);
                _cardBack[i].color = new Color(0.07f, 0.04f, 0.16f, 0.9f);
                _cardGlow[i].SetAlpha(0);
                _cards[i].localScale = Vector3.one;
            }
            SetTime(1f);
        }

        public void SetTime(float t01)
        {
            _timer.fillAmount = Mathf.Clamp01(t01);
            _timer.color = t01 > 0.35f ? Palette.Nerve : Color.Lerp(Palette.HpDamage, Palette.Nerve, t01 / 0.35f);
        }

        public void SetPicked(int i)
        {
            if (i < 0 || i >= Cards) return;
            _picked[i] = true;
            _pickAnim[i] = 1f;
            _cardBack[i].color = new Color(0.3f, 0.08f, 0.32f, 0.95f);
            _cardEdge[i].color = Palette.Bone;
        }

        public void ShowResult(LinkResult r, MuscleQuestion q)
        {
            for (int i = 0; i < q.Options.Length && i < Cards; i++)
            {
                bool c = q.Options[i].Correct;
                _cardEdge[i].color = c ? Palette.Gold : _picked[i] ? Palette.HpDamage : Palette.TextDim.WithAlpha(0.3f);
                _cardHint[i].text = c ? "정답!" : _picked[i] ? "오답" : "";
                _cardHint[i].color = c ? Palette.Gold : Palette.HpDamage;
                _cardGlow[i].color = (c ? Palette.Gold : Palette.HpDamage).WithAlpha(c ? 0.5f : _picked[i] ? 0.35f : 0f);
            }
            _resultRoot.gameObject.SetActive(true);
            _resultRoot.SetAsLastSibling();
            (_result.text, _result.color, _resultSub.text) = r switch
            {
                LinkResult.Perfect => ("PERFECT MUSCLE LINK!", Palette.Gold, "데미지 ×1.5 · 콤보 +1타 · 게이지 회복"),
                LinkResult.Link => ("MUSCLE LINK!", Palette.Nerve, "데미지 ×1.25"),
                LinkResult.Partial => ("PARTIAL LINK", Color.white, "기본 스킬 발동"),
                _ => ("MUSCLE LINK FAILED", Palette.TextDim, "약한 스킬 · 데미지 ×0.6"),
            };
            _resultRoot.localScale = Vector3.one * 1.35f;
        }

        public void Close()
        {
            _root.gameObject.SetActive(false);
            TouchControls.Suppressed = false;
        }

        void Update()
        {
            float dt = Time.unscaledDeltaTime;
            _open = Mathf.MoveTowards(_open, 1, dt * 7f);
            float slide = 1f - Mathf.SmoothStep(0, 1, _open);
            for (int i = 0; i < Cards; i++)
            {
                if (!_cards[i].gameObject.activeSelf) continue;
                _pickAnim[i] = Mathf.MoveTowards(_pickAnim[i], 0, dt * 4f);
                float picked = _picked[i] ? 1f : 0f;
                _cards[i].anchoredPosition = new Vector2(_cards[i].anchoredPosition.x, 112 - slide * (260 + i * 40));
                _cards[i].localScale = Vector3.one * (1f + picked * 0.07f + _pickAnim[i] * 0.12f);
                if (!_resultRoot.gameObject.activeSelf)
                    _cardGlow[i].SetAlpha(picked * (0.45f + 0.15f * Mathf.Sin(Time.unscaledTime * 8f)) + _pickAnim[i] * 0.4f);
            }
            if (_resultRoot.gameObject.activeSelf)
                _resultRoot.localScale = Vector3.Lerp(_resultRoot.localScale, Vector3.one, dt * 14f);
        }
    }
}
