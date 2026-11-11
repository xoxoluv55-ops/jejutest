using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace MuscleBattle
{
    /// <summary>
    /// In-fight HUD modelled on the concept images: corner portraits, big slanted HP bars with
    /// damage trail, centre logo + timer + round pill, round pips, special meters, combo counter,
    /// callouts, skill cut-in, commentary bar, round / KO / victory banners and screen flash.
    /// </summary>
    public sealed class Hud : MonoBehaviour
    {
        public static Hud Instance { get; private set; }

        sealed class Side
        {
            public RectTransform Root;
            public RawImage Portrait;
            public Image PortraitFrame;
            public Text Name, Level, HpPercent;
            public Image HpFill, HpTrail, HpBack;
            public Image[] Meter = new Image[3];
            public Image[] MeterGlow = new Image[3];
            public Text MeterLabel;
            public Image[] Pips;
            public RectTransform ComboRoot;
            public Text ComboNumber, ComboText, ComboDamage;
            public float ComboTimer;
            public float ComboPunch;
            public float Trail = 1f;
            public float TrailDelay;
            public float LastHp = 1f;
            public RectTransform CalloutRoot;
            public float MeterDenied;
        }

        readonly Side[] _sides = { new Side(), new Side() };
        RectTransform _root;
        Text _timer, _roundPill, _banner, _bannerSub;
        RectTransform _bannerRoot;
        Image _bannerBack;
        Image _flash;
        float _flashA;
        RectTransform _cutIn;
        Text _cutInName, _cutInSub, _cutInMuscles;
        RawImage _cutInPortrait;
        Image _cutInBand;
        RectTransform _commentary;
        Text _commentaryText;
        float _commentaryTimer;
        Coroutine _bannerCo, _cutInCo;
        CombatManager _combat;
        readonly List<(Text t, float life, float max)> _callouts = new List<(Text, float, float)>();

        public static Hud Create(Transform canvas, CombatManager combat)
        {
            var rt = UIKit.Node("HUD", canvas);
            rt.Stretch();
            var hud = rt.gameObject.AddComponent<Hud>();
            hud._root = rt;
            hud._combat = combat;
            hud.Build();
            return hud;
        }

        void Awake() { Instance = this; }

        public void Show(bool on) => _root.gameObject.SetActive(on);

        public void SetPortraits(Texture p1, Texture p2)
        {
            _sides[0].Portrait.texture = p1;
            _sides[1].Portrait.texture = p2;
        }

        // ------------------------------------------------------------------
        // Build
        // ------------------------------------------------------------------
        void Build()
        {
            // top gradient so bars always read over bright stage lights
            var topShade = UIKit.Img(_root, "TopShade", UIKit.GradV, new Color(0.02f, 0.01f, 0.08f, 0.75f));
            topShade.rectTransform.anchorMin = new Vector2(0, 1);
            topShade.rectTransform.anchorMax = new Vector2(1, 1);
            topShade.rectTransform.pivot = new Vector2(0.5f, 1);
            topShade.rectTransform.sizeDelta = new Vector2(0, 230);
            topShade.rectTransform.localScale = new Vector3(1, -1, 1);
            topShade.rectTransform.anchoredPosition = new Vector2(0, -230);

            // logo + timer
            var logo = UIKit.Label(_root, "MUSCLE BATTLE", 44, Color.white, TextAnchor.MiddleCenter, true, true, true);
            logo.rectTransform.Place(new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0, -6), new Vector2(560, 56));
            logo.color = new Color(1f, 0.93f, 0.95f);
            var logoGlow = UIKit.Img(logo.rectTransform, "Glow", UIKit.Glow, Palette.Muscle.WithAlpha(0.5f));
            logoGlow.rectTransform.Stretch(-30);
            logoGlow.transform.SetAsFirstSibling();
            var sub = UIKit.Label(_root, "ARCADE FIGHTING GAME", 16, Palette.TextDim, TextAnchor.MiddleCenter, false);
            sub.rectTransform.Place(new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0, -58), new Vector2(400, 20));

            _timer = UIKit.Label(_root, "60", 92, Color.white);
            _timer.rectTransform.Place(new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0, -78), new Vector2(220, 100));
            var pill = UIKit.Img(_root, "RoundPill", UIKit.Round, new Color(0.35f, 0.02f, 0.08f, 0.92f));
            pill.rectTransform.Place(new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0, -184), new Vector2(230, 40));
            var pillEdge = UIKit.Img(pill.rectTransform, "Edge", UIKit.RoundOutline, Palette.Muscle);
            pillEdge.rectTransform.Stretch(-2);
            _roundPill = UIKit.Label(pill.rectTransform, "ROUND 1 / 3", 24, Color.white);
            _roundPill.rectTransform.Stretch();

            for (int i = 0; i < 2; i++) BuildSide(i);

            // centre banner
            _bannerRoot = UIKit.Node("Banner", _root).Place(new Vector2(0.5f, 0.58f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(1600, 300));
            _bannerBack = UIKit.Img(_bannerRoot, "Back", UIKit.Para, new Color(0.05f, 0.02f, 0.12f, 0.75f));
            _bannerBack.rectTransform.Place(new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0, -10), new Vector2(1900, 150));
            _banner = UIKit.Label(_bannerRoot, "", 150, Palette.Gold, TextAnchor.MiddleCenter, true, true, true);
            _banner.rectTransform.Stretch();
            _bannerSub = UIKit.Label(_bannerRoot, "", 40, Color.white);
            _bannerSub.rectTransform.Place(new Vector2(0.5f, 0), new Vector2(0.5f, 1), new Vector2(0, -10), new Vector2(1200, 60));
            _bannerRoot.gameObject.SetActive(false);

            // skill cut-in (§43)
            _cutIn = UIKit.Node("CutIn", _root).Place(new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0, 170), new Vector2(1100, 170));
            _cutInBand = UIKit.Img(_cutIn, "Band", UIKit.Para, new Color(0.08f, 0.03f, 0.2f, 0.92f));
            _cutInBand.rectTransform.Stretch();
            var cutEdge = UIKit.Img(_cutIn, "Edge", UIKit.ParaOutline, Palette.Mastery);
            cutEdge.rectTransform.Stretch(-3);
            var portraitMask = UIKit.Node("PortraitMask", _cutIn).Place(new Vector2(0, 0.5f), new Vector2(0, 0.5f), new Vector2(40, 0), new Vector2(200, 160));
            portraitMask.gameObject.AddComponent<RectMask2D>();
            _cutInPortrait = UIKit.Raw(portraitMask, "Portrait", null);
            _cutInPortrait.rectTransform.Stretch();
            var tag = UIKit.Label(_cutIn, "스페셜 기술 발동!", 24, Palette.Gold, TextAnchor.UpperLeft);
            tag.rectTransform.Place(new Vector2(0, 1), new Vector2(0, 1), new Vector2(270, -10), new Vector2(500, 30));
            _cutInName = UIKit.Label(_cutIn, "", 60, Color.white, TextAnchor.MiddleLeft, true, true, true);
            _cutInName.rectTransform.Place(new Vector2(0, 0.5f), new Vector2(0, 0.5f), new Vector2(262, 8), new Vector2(800, 70));
            _cutInSub = UIKit.Label(_cutIn, "", 24, Palette.TextDim, TextAnchor.MiddleLeft, false);
            _cutInSub.rectTransform.Place(new Vector2(0, 0), new Vector2(0, 0), new Vector2(270, 34), new Vector2(800, 30));
            _cutInMuscles = UIKit.Label(_cutIn, "", 24, Palette.MuscleHot, TextAnchor.MiddleLeft);
            _cutInMuscles.rectTransform.Place(new Vector2(0, 0), new Vector2(0, 0), new Vector2(270, 4), new Vector2(800, 30));
            _cutIn.gameObject.SetActive(false);

            // commentary bar (concept image 3)
            _commentary = UIKit.Panel(_root, "Commentary", Palette.NerveDeep, 0.85f);
            _commentary.Place(new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0, 28), new Vector2(980, 78));
            var mic = UIKit.Label(_commentary, "해설", 24, Palette.Nerve);
            mic.rectTransform.Place(new Vector2(0, 0.5f), new Vector2(0, 0.5f), new Vector2(20, 0), new Vector2(80, 40));
            _commentaryText = UIKit.Label(_commentary, "", 24, Color.white, TextAnchor.MiddleLeft, false);
            _commentaryText.rectTransform.Place(new Vector2(0, 0.5f), new Vector2(0, 0.5f), new Vector2(110, 0), new Vector2(850, 70));
            _commentary.gameObject.SetActive(false);

            _flash = UIKit.Img(_root, "Flash", UIKit.White, new Color(1, 1, 1, 0));
            _flash.rectTransform.Stretch();
        }

        void BuildSide(int i)
        {
            var s = _sides[i];
            bool left = i == 0;
            float dir = left ? 1 : -1;
            var anchor = new Vector2(left ? 0 : 1, 1);
            var accent = Palette.PlayerColor(i);

            s.Root = UIKit.Node(left ? "P1" : "P2", _root).Place(anchor, anchor, Vector2.zero, new Vector2(900, 220));

            // portrait
            s.PortraitFrame = UIKit.Img(s.Root, "PortraitFrame", UIKit.Round, accent.WithAlpha(0.9f));
            s.PortraitFrame.rectTransform.Place(anchor, anchor, new Vector2(16 * dir, -14), new Vector2(150, 150));
            var mask = UIKit.Node("Mask", s.PortraitFrame.rectTransform);
            mask.Stretch(5);
            mask.gameObject.AddComponent<RectMask2D>();
            s.Portrait = UIKit.Raw(mask, "Portrait", null);
            s.Portrait.rectTransform.Stretch();
            var tagBg = UIKit.Img(s.Root, "Tag", UIKit.Para, accent);
            tagBg.rectTransform.Place(anchor, anchor, new Vector2(10 * dir, -8), new Vector2(64, 34));
            var tagT = UIKit.Label(tagBg.rectTransform, left ? "P1" : "CPU", 22, Color.white);
            tagT.rectTransform.Stretch();
            if (!left) _p2Tag = tagT;

            // HP bar (mirrored container for P2 so the slant faces outward)
            var bar = UIKit.Node("HpBar", s.Root).Place(anchor, anchor, new Vector2(180 * dir, -40), new Vector2(660, 50));
            if (!left) bar.localScale = new Vector3(-1, 1, 1);
            s.HpBack = UIKit.Img(bar, "Back", UIKit.Para, new Color(0.05f, 0.02f, 0.1f, 0.9f));
            s.HpBack.rectTransform.Stretch(-4);
            s.HpTrail = UIKit.Img(bar, "Trail", UIKit.Para, Palette.HpDamage);
            s.HpTrail.rectTransform.Stretch();
            s.HpTrail.type = Image.Type.Filled;
            s.HpTrail.fillMethod = Image.FillMethod.Horizontal;
            s.HpTrail.fillOrigin = 1;
            s.HpFill = UIKit.Img(bar, "Fill", UIKit.Para, Palette.HpYellow);
            s.HpFill.rectTransform.Stretch();
            s.HpFill.type = Image.Type.Filled;
            s.HpFill.fillMethod = Image.FillMethod.Horizontal;
            s.HpFill.fillOrigin = 1; // drain toward the centre of the screen
            var shine = UIKit.Img(bar, "Shine", UIKit.GradV, new Color(1, 1, 1, 0.25f));
            shine.rectTransform.anchorMin = new Vector2(0, 0.5f);
            shine.rectTransform.anchorMax = Vector2.one;
            shine.rectTransform.offsetMin = shine.rectTransform.offsetMax = Vector2.zero;
            var edge = UIKit.Img(bar, "Edge", UIKit.ParaOutline, Color.Lerp(accent, Color.white, 0.3f));
            edge.rectTransform.Stretch(-4);

            // sub bar (blue / purple stripe from the concept art)
            var stripe = UIKit.Img(s.Root, "Stripe", UIKit.Para, Color.Lerp(Palette.NerveDeep, Palette.Mastery, 0.5f).WithAlpha(0.9f));
            stripe.rectTransform.Place(anchor, anchor, new Vector2(300 * dir, -96), new Vector2(420, 12));
            if (!left) stripe.rectTransform.localScale = new Vector3(-1, 1, 1);

            s.Name = UIKit.Label(s.Root, "", 30, Color.white, left ? TextAnchor.MiddleLeft : TextAnchor.MiddleRight);
            s.Name.rectTransform.Place(anchor, anchor, new Vector2(190 * dir, -112), new Vector2(420, 40));
            s.Level = UIKit.Label(s.Root, "", 22, Palette.TextDim, left ? TextAnchor.MiddleLeft : TextAnchor.MiddleRight, false);
            s.Level.rectTransform.Place(anchor, anchor, new Vector2(520 * dir, -112), new Vector2(140, 40));
            s.HpPercent = UIKit.Label(s.Root, "100%", 26, Color.white, left ? TextAnchor.MiddleRight : TextAnchor.MiddleLeft);
            s.HpPercent.rectTransform.Place(anchor, anchor, new Vector2(760 * dir, -112), new Vector2(120, 40));

            // round pips next to the timer
            s.Pips = new Image[3];
            for (int k = 0; k < 3; k++)
            {
                var pip = UIKit.Img(_root, "Pip", UIKit.Circle, new Color(0.1f, 0.05f, 0.15f, 0.9f));
                pip.rectTransform.Place(new Vector2(0.5f, 1), new Vector2(0.5f, 0.5f), new Vector2((150 + k * 34) * -dir, -128), new Vector2(26, 26));
                var ring = UIKit.Img(pip.rectTransform, "Ring", UIKit.CircleOutline, Palette.Gold);
                ring.rectTransform.Stretch(-2);
                s.Pips[k] = pip;
            }

            // special meter (bottom corners)
            var meterAnchor = new Vector2(left ? 0 : 1, 0);
            var mRoot = UIKit.Node("Meter", s.Root.parent).Place(meterAnchor, meterAnchor, new Vector2(30 * dir, 30), new Vector2(540, 90));
            var mLabel = UIKit.Label(mRoot, left ? "SPECIAL" : "EX MUSCLE", 30, left ? Palette.Nerve : Palette.MuscleHot, left ? TextAnchor.UpperLeft : TextAnchor.UpperRight, true, true, true);
            mLabel.rectTransform.Place(new Vector2(left ? 0 : 1, 1), new Vector2(left ? 0 : 1, 1), Vector2.zero, new Vector2(300, 36));
            s.MeterLabel = UIKit.Label(mRoot, "Lv.0", 48, Palette.Gold, left ? TextAnchor.LowerRight : TextAnchor.LowerLeft, true, true, true);
            s.MeterLabel.rectTransform.Place(new Vector2(left ? 1 : 0, 0), new Vector2(left ? 1 : 0, 0), new Vector2(0, -6), new Vector2(200, 60));
            for (int k = 0; k < 3; k++)
            {
                float x = (k * 112 + 6) * dir;
                var back = UIKit.Img(mRoot, "SegBack", UIKit.Para, new Color(0.05f, 0.03f, 0.12f, 0.9f));
                back.rectTransform.Place(new Vector2(left ? 0 : 1, 0), new Vector2(left ? 0 : 1, 0), new Vector2(x, 8), new Vector2(104, 30));
                var fill = UIKit.Img(back.rectTransform, "Fill", UIKit.Para, left ? Palette.Nerve : Palette.MuscleHot);
                fill.rectTransform.Stretch(3);
                fill.type = Image.Type.Filled;
                fill.fillMethod = Image.FillMethod.Horizontal;
                fill.fillOrigin = left ? 0 : 1;
                var glow = UIKit.Img(back.rectTransform, "Glow", UIKit.Glow, (left ? Palette.Nerve : Palette.MuscleHot).WithAlpha(0));
                glow.rectTransform.Stretch(-18);
                var segEdge = UIKit.Img(back.rectTransform, "Edge", UIKit.ParaOutline, Color.white.WithAlpha(0.5f));
                segEdge.rectTransform.Stretch(-2);
                s.Meter[k] = fill;
                s.MeterGlow[k] = glow;
            }

            // combo counter (concept image 2: "14 HIT COMBO!")
            var comboAnchor = new Vector2(left ? 0 : 1, 0.62f);
            s.ComboRoot = UIKit.Node("Combo", _root).Place(comboAnchor, new Vector2(left ? 0 : 1, 0.5f), new Vector2(40 * dir, 0), new Vector2(520, 200));
            s.ComboNumber = UIKit.Label(s.ComboRoot, "", 130, Palette.HpYellow, left ? TextAnchor.MiddleLeft : TextAnchor.MiddleRight, true, true, true);
            s.ComboNumber.rectTransform.Place(new Vector2(left ? 0 : 1, 0.5f), new Vector2(left ? 0 : 1, 0.5f), new Vector2(0, 20), new Vector2(220, 150));
            s.ComboText = UIKit.Label(s.ComboRoot, "HIT COMBO!", 46, Color.white, left ? TextAnchor.MiddleLeft : TextAnchor.MiddleRight, true, true, true);
            s.ComboText.rectTransform.Place(new Vector2(left ? 0 : 1, 0.5f), new Vector2(left ? 0 : 1, 0.5f), new Vector2(190 * dir, 14), new Vector2(330, 60));
            s.ComboDamage = UIKit.Label(s.ComboRoot, "", 32, Palette.MuscleHot, left ? TextAnchor.MiddleLeft : TextAnchor.MiddleRight);
            s.ComboDamage.rectTransform.Place(new Vector2(left ? 0 : 1, 0.5f), new Vector2(left ? 0 : 1, 0.5f), new Vector2(20 * dir, -66), new Vector2(480, 44));
            s.ComboRoot.gameObject.SetActive(false);

            s.CalloutRoot = UIKit.Node("Callouts", _root).Place(new Vector2(left ? 0 : 1, 0.45f), new Vector2(left ? 0 : 1, 0.5f), new Vector2(50 * dir, 0), new Vector2(600, 60));
        }

        Text _p2Tag;

        public void Configure(FighterController a, FighterController b, bool p2IsCpu)
        {
            var fs = new[] { a, b };
            for (int i = 0; i < 2; i++)
            {
                _sides[i].Name.text = fs[i].Def.NameEn;
                _sides[i].Level.text = "Lv." + fs[i].Def.Level;
                _sides[i].Trail = 1f;
                _sides[i].ComboRoot.gameObject.SetActive(false);
            }
            if (_p2Tag != null) _p2Tag.text = p2IsCpu ? "CPU" : "P2";
            int need = GameSettings.RoundsToWin;
            for (int i = 0; i < 2; i++)
                for (int k = 0; k < 3; k++)
                    _sides[i].Pips[k].gameObject.SetActive(k < need);
        }

        // ------------------------------------------------------------------
        // Per frame
        // ------------------------------------------------------------------
        void Update()
        {
            if (_combat == null || _combat.Fighters[0] == null) return;
            float dt = Time.unscaledDeltaTime;

            int t = Mathf.CeilToInt(_combat.TimeLeft);
            _timer.text = t.ToString();
            _timer.color = t <= 10 && _combat.Phase == MatchPhase.Fighting ? Color.Lerp(Color.white, Palette.HpDamage, 0.5f + 0.5f * Mathf.Sin(Time.unscaledTime * 10)) : Color.white;
            int totalRounds = GameSettings.RoundsToWin * 2 - 1;
            _roundPill.text = _combat.IsFinalRound ? "FINAL ROUND" : $"ROUND {_combat.RoundNumber} / {totalRounds}";

            for (int i = 0; i < 2; i++)
            {
                var s = _sides[i];
                var f = _combat.Fighters[i];
                float hp = f.HpRatio;
                if (hp < s.LastHp - 0.0001f) s.TrailDelay = 0.55f;
                s.LastHp = hp;
                s.HpFill.fillAmount = hp;
                if (s.TrailDelay > 0) s.TrailDelay -= dt;
                else s.Trail = Mathf.MoveTowards(s.Trail, hp, dt * 0.6f);
                if (s.Trail < hp) s.Trail = hp;
                s.HpTrail.fillAmount = s.Trail;
                var hpColor = hp > 0.5f ? Color.Lerp(Palette.HpOrange, Palette.HpYellow, (hp - 0.5f) * 2f) : Color.Lerp(Palette.HpDamage, Palette.HpOrange, hp * 2f);
                if (f.Adrenaline) hpColor = Color.Lerp(hpColor, Color.white, 0.25f + 0.25f * Mathf.Sin(Time.unscaledTime * 12f));
                s.HpFill.color = hpColor;
                s.HpPercent.text = Mathf.CeilToInt(hp * 100f) + "%";

                for (int k = 0; k < 3; k++)
                {
                    float seg = Mathf.Clamp01((f.Meter - k * 100f) / 100f);
                    s.Meter[k].fillAmount = seg;
                    float glow = seg >= 1f ? 0.45f + 0.25f * Mathf.Sin(Time.unscaledTime * 5f + k) : 0f;
                    s.MeterGlow[k].SetAlpha(glow);
                    s.Pips[k].color = k < f.RoundWins ? Palette.Gold : new Color(0.1f, 0.05f, 0.15f, 0.9f);
                }
                int lv = Mathf.FloorToInt(f.Meter / 100f);
                s.MeterLabel.text = lv >= 3 ? "Lv.3 MAX" : "Lv." + lv;
                if (s.MeterDenied > 0)
                {
                    s.MeterDenied -= dt;
                    s.MeterLabel.color = Color.Lerp(Palette.Gold, Palette.HpDamage, Mathf.PingPong(s.MeterDenied * 10f, 1f));
                }
                else s.MeterLabel.color = Palette.Gold;

                if (s.ComboRoot.gameObject.activeSelf)
                {
                    s.ComboPunch = Mathf.MoveTowards(s.ComboPunch, 0, dt * 4f);
                    s.ComboNumber.rectTransform.localScale = Vector3.one * (1f + s.ComboPunch * 0.35f);
                    if (s.ComboTimer > 0)
                    {
                        s.ComboTimer -= dt;
                        if (s.ComboTimer <= 0) s.ComboRoot.gameObject.SetActive(false);
                    }
                }
            }

            // callouts float up and fade
            for (int i = _callouts.Count - 1; i >= 0; i--)
            {
                var c = _callouts[i];
                c.life -= dt;
                if (c.life <= 0 || c.t == null)
                {
                    if (c.t != null) Destroy(c.t.gameObject);
                    _callouts.RemoveAt(i);
                    continue;
                }
                float k = 1f - c.life / c.max;
                c.t.rectTransform.anchoredPosition += new Vector2(0, dt * 40f);
                c.t.SetAlpha(Mathf.Clamp01(c.life * 3f));
                c.t.rectTransform.localScale = Vector3.one * (k < 0.1f ? Mathf.Lerp(1.5f, 1f, k / 0.1f) : 1f);
                _callouts[i] = c;
            }

            if (_flashA > 0)
            {
                _flashA = Mathf.MoveTowards(_flashA, 0, dt * 2.5f);
                _flash.SetAlpha(_flashA);
            }

            if (_commentaryTimer > 0)
            {
                _commentaryTimer -= dt;
                if (_commentaryTimer <= 0) _commentary.gameObject.SetActive(false);
            }
        }

        // ------------------------------------------------------------------
        // Events
        // ------------------------------------------------------------------
        public void Combo(int side, int hits, float damage)
        {
            var s = _sides[side];
            s.ComboRoot.gameObject.SetActive(true);
            s.ComboNumber.text = hits.ToString();
            s.ComboDamage.text = "총 데미지  " + Mathf.RoundToInt(damage);
            s.ComboPunch = 1f;
            s.ComboTimer = 0;
            if (hits == 5) Commentary(CommentaryCombo(side, hits));
            if (hits == 8) Commentary($"{Name(side)}! {hits}히트 콤보! 근육 연쇄가 멈추지 않습니다!");
        }

        public void ComboEnded(int side)
        {
            var s = _sides[side];
            if (s.ComboRoot.gameObject.activeSelf && s.ComboTimer <= 0) s.ComboTimer = 1.1f;
        }

        public void Callout(int side, string text, Color color, bool big = false)
        {
            var s = _sides[side];
            var t = UIKit.Label(s.CalloutRoot, text, big ? 58 : 44, color, side == 0 ? TextAnchor.MiddleLeft : TextAnchor.MiddleRight, true, true, true);
            t.rectTransform.Place(new Vector2(side == 0 ? 0 : 1, 0.5f), new Vector2(side == 0 ? 0 : 1, 0.5f), new Vector2(0, -_callouts.Count * 10f), new Vector2(700, 70));
            _callouts.Add((t, 1.2f, 1.2f));
        }

        public void MeterDenied(int side) => _sides[side].MeterDenied = 0.6f;

        public void MeterLevelUp(int side, int level)
        {
            if (level >= 3) Callout(side, "MAX POWER!", Palette.Gold);
        }

        public void ScreenFlash(Color c, float strength)
        {
            _flash.color = c.WithAlpha(strength);
            _flashA = strength;
        }

        public void Commentary(string text, float seconds = 3f)
        {
            _commentary.gameObject.SetActive(true);
            _commentaryText.text = text;
            _commentaryTimer = seconds;
        }

        string Name(int side) => _combat.Fighters[side].Def.NameKo;

        string CommentaryCombo(int side, int hits) =>
            $"{Name(side)}의 {hits}연속 콤보! 공격이 깔끔하게 이어집니다!";

        public void RoundBanner(string text, Color color)
        {
            if (_bannerCo != null) StopCoroutine(_bannerCo);
            _bannerCo = StartCoroutine(BannerRoutine(text, "", color, 1.3f, 1.4f));
        }

        public void FightBanner()
        {
            if (_bannerCo != null) StopCoroutine(_bannerCo);
            _bannerCo = StartCoroutine(BannerRoutine("FIGHT!", "", Palette.Muscle, 0.75f, 1.8f));
        }

        public void KoBanner(bool anatomyFinish)
        {
            if (_bannerCo != null) StopCoroutine(_bannerCo);
            _bannerCo = StartCoroutine(BannerRoutine("K.O.", anatomyFinish ? "ANATOMY FINISH!" : "", Palette.MuscleHot, 2.4f, 2.2f));
        }

        public void VictoryBanner(FighterController winner)
        {
            if (_bannerCo != null) StopCoroutine(_bannerCo);
            _bannerCo = StartCoroutine(BannerRoutine("VICTORY", winner.Def.NameEn + "  승리!", Palette.Gold, 3f, 1.3f));
            Commentary(winner.Def.WinLine, 3f);
        }

        IEnumerator BannerRoutine(string text, string sub, Color color, float hold, float startScale)
        {
            _bannerRoot.gameObject.SetActive(true);
            _banner.text = text;
            _banner.color = color;
            _bannerSub.text = sub;
            float t = 0;
            while (t < 0.18f)
            {
                t += Time.unscaledDeltaTime;
                float k = t / 0.18f;
                _bannerRoot.localScale = Vector3.one * Mathf.Lerp(startScale, 1f, k * k);
                _bannerBack.SetAlpha(0.75f * k);
                _banner.SetAlpha(k);
                yield return null;
            }
            _bannerRoot.localScale = Vector3.one;
            float shakeT = 0.25f;
            t = 0;
            while (t < hold)
            {
                t += Time.unscaledDeltaTime;
                float sh = Mathf.Max(0, shakeT - t) * 40f;
                _bannerRoot.anchoredPosition = new Vector2(Random.Range(-sh, sh), Random.Range(-sh, sh));
                _bannerSub.SetAlpha(Mathf.Clamp01((t - 0.2f) * 4f));
                yield return null;
            }
            t = 0;
            while (t < 0.2f)
            {
                t += Time.unscaledDeltaTime;
                float k = 1 - t / 0.2f;
                _banner.SetAlpha(k);
                _bannerSub.SetAlpha(k);
                _bannerBack.SetAlpha(0.75f * k);
                _bannerRoot.localScale = new Vector3(1 + (1 - k) * 0.3f, k, 1);
                yield return null;
            }
            _bannerRoot.gameObject.SetActive(false);
        }

        public void SkillCutIn(FighterController f, MoveData m, bool ultimate)
        {
            if (_cutInCo != null) StopCoroutine(_cutInCo);
            _cutInCo = StartCoroutine(CutInRoutine(f, m, ultimate));
            string en = ultimate ? f.Def.UltimateNameEn : f.Def.SpecialNameEn;
            Commentary(ultimate
                ? $"{f.Def.NameKo}의 얼티밋! {en} — {m.MuscleCaption}이(가) 하나로 연결됩니다!"
                : $"{f.Def.NameKo}! {en}! {m.MuscleCaption}의 힘으로 몰아붙입니다!", 3.2f);
        }

        IEnumerator CutInRoutine(FighterController f, MoveData m, bool ultimate)
        {
            _cutIn.gameObject.SetActive(true);
            _cutInPortrait.texture = _sides[f.Side].Portrait.texture;
            _cutInName.text = (ultimate ? f.Def.UltimateName : f.Def.SpecialName) + "!";
            _cutInName.color = ultimate ? Palette.Gold : Color.white;
            _cutInSub.text = "(" + (ultimate ? f.Def.UltimateNameEn : f.Def.SpecialNameEn) + ")";
            _cutInMuscles.text = "근육 활성화 ▶ " + m.MuscleCaption;
            _cutInBand.color = ultimate ? new Color(0.25f, 0.05f, 0.25f, 0.95f) : new Color(0.08f, 0.03f, 0.2f, 0.92f);
            float hold = ultimate ? 1.6f : 1.0f;
            float t = 0;
            float from = f.Side == 0 ? -1500 : 1500;
            while (t < 0.15f)
            {
                t += Time.unscaledDeltaTime;
                _cutIn.anchoredPosition = new Vector2(Mathf.Lerp(from, 0, Mathf.SmoothStep(0, 1, t / 0.15f)), 170);
                yield return null;
            }
            _cutIn.anchoredPosition = new Vector2(0, 170);
            yield return new WaitForSecondsRealtime(hold);
            t = 0;
            while (t < 0.15f)
            {
                t += Time.unscaledDeltaTime;
                _cutIn.anchoredPosition = new Vector2(Mathf.Lerp(0, -from, t / 0.15f), 170);
                yield return null;
            }
            _cutIn.gameObject.SetActive(false);
        }
    }
}
