using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace MuscleBattle
{
    /// <summary>
    /// Character select, redesigned around the fighters ("이 캐릭터로 싸우고 싶다").
    ///
    ///   LEFT  : P1 fighter (big 3D hero shot) + compact info column at the screen edge
    ///   CENTER: VS clash (two energies colliding, electric fibres) + START BATTLE
    ///   RIGHT : CPU / 2P fighter, mirrored
    ///   BOTTOM: swipeable portrait carousel (locked fighters = silhouettes + unlock condition),
    ///           small animated stage preview, match settings hidden in an overlay.
    ///
    /// Every interaction answers with Animation + Sound + VFX + UI motion + Camera:
    ///   hover/cursor -> fighter swap, signature idle move, energy puff, theme sting, camera drift, card bounce
    ///   LOCK IN      -> strong pose, camera push, energy column, name punch + banner, impact SFX, voice line, BGM layer
    ///   START        -> energy rush transition -> VS screen
    ///
    /// Layout is in 1920x1080 reference units (iPad 4:3 = 1920x1440, top / bottom anchored groups keep their place).
    /// </summary>
    public sealed class CharacterSelectScreen : ScreenBase
    {
        // ---- layout ----
        const float ColumnX = 44f;           // info column margin from the screen edge
        const float ColumnW = 400f;
        const float CellSize = 128f, CellGap = 18f;
        const float CarouselW = 680f, CarouselH = 290f, CarouselY = 150f;
        const float NameY = 220f;            // big name baseline block, from the bottom edge
        const float CamDist = 2.85f;          // hero shot distance (fighters fill head -> shin)
        const float FighterScreenX = 0.36f;   // fighters centred at 32% / 68% of the screen width (NDC +-0.36)
        static readonly string[] StatNames = { "POWER", "SPEED", "TECHNIQUE", "DEFENSE", "KNOWLEDGE" };
        static readonly Color CpuBadge = new Color(0.55f, 0.57f, 0.66f);
        static readonly Color LockedGray = new Color(0.3f, 0.3f, 0.36f);

        sealed class Side
        {
            public int Index;
            public RectTransform Column;                 // edge column (stats / specialty / skills)
            public CanvasGroup ColumnGroup;
            public RectTransform InfoBlock, LockedBlock;
            public Image Badge;
            public Text BadgeText, LockStamp;
            public RectTransform NameBlock;
            public CanvasGroup NameGroup;
            public Text Name, Sub;
            public Image NameBanner;
            public readonly Image[] StatFill = new Image[5];
            public readonly Text[] StatValue = new Text[5];
            public readonly float[] StatShown = new float[5];
            public readonly float[] StatTarget = new float[5];
            public readonly Image[] TraitIcon = new Image[3];
            public readonly Image[] TraitRing = new Image[3];
            public readonly Text[] TraitText = new Text[3];
            public readonly Image[] SkillIcon = new Image[3];
            public readonly Text[] SkillText = new Text[3];
            public readonly Text[] SkillSub = new Text[3];
            public Text LockedTitle, LockedCondition;
            public MBButton Details;
            public float Slide = 1f, NamePunch, Banner, Stamp, Push, ThemeDelay = -1f;
            public GameObject FloorGlow;
            public Material FloorMat;
        }

        sealed class Cell
        {
            public RectTransform Rect;
            public Image Frame, Glow, Back, LockIcon;
            public RawImage Portrait;
            public Text Caption, TagP1, TagP2;
            public FighterDefinition Def;
            public float Scale = 1f, Bounce, Shake;
        }

        readonly Side[] _sides = { new Side { Index = 0 }, new Side { Index = 1 } };
        readonly List<FighterDefinition> _roster = new List<FighterDefinition>();
        readonly List<Cell> _cells = new List<Cell>();
        readonly int[] _cursor = { 0, 1 };
        readonly bool[] _locked = new bool[2];
        bool _twoPlayer;
        int _activeChooser; // 1P mode: 0 = picking self, 1 = picking CPU
        bool _starting;

        Text _title, _prompt;
        MBButton _start, _back, _settingsButton;
        Image _startGlow;
        RectTransform _vsGroup;
        Text _vsText;
        Image _vsGlowL, _vsGlowR, _vsCore;
        readonly List<Image> _bolts = new List<Image>();
        readonly List<Image> _streaks = new List<Image>();
        float _boltTimer, _vsPunch;
        Image _flash;
        Color _flashColor = Color.white;
        float _flashAmount;

        // carousel
        RectTransform _window, _content;
        float _scroll, _scrollVel, _manualScroll;
        bool _pointerDown, _dragging;
        Vector2 _pointerStart, _pointerLast;
        float _scrollAtPress;
        int _pressedCell = -1;
        Vector3 _lastMouse;

        // stage preview + overlays
        RectTransform _stageThumb;
        RawImage _stageFloor;
        Image _stageScan;
        RectTransform _settingsPanel, _detailsPanel;
        MBButton _rounds, _time, _cpu, _knowledge, _closeSettings;
        readonly MenuNavigator _settingsNav = new MenuNavigator();
        Text _detailsText, _detailsName;
        int _detailsSide = -1;
        Text _hint;

        // 3D framing
        float _fighterX = 0.9f, _hoverDrift, _camPush;
        int _camPushSide;
        bool _fogSaved;
        bool _savedFog;
        FogMode _savedFogMode;
        Color _savedFogColor;
        float _savedFogDensity, _savedFogStart, _savedFogEnd;

        public static CharacterSelectScreen Create(Transform canvas)
        {
            var go = new GameObject("CharacterSelect");
            go.transform.SetParent(canvas, false);
            var s = go.AddComponent<CharacterSelectScreen>();
            s.Build(canvas);
            s.Hide();
            return s;
        }

        // ==================================================================
        // Build
        // ==================================================================
        void Build(Transform canvas)
        {
            InitRoot(canvas, "CharacterSelect");
            foreach (var d in CharacterDatabase.All) _roster.Add(d);
            foreach (var d in CharacterDatabase.Locked) _roster.Add(d);

            // contrast shades: dark at the top / bottom / screen edges only - the fighters stay bright
            var top = UIKit.Img(Root, "TopShade", UIKit.GradV, new Color(0.01f, 0.0f, 0.05f, 0.75f));
            top.rectTransform.anchorMin = new Vector2(0, 0.82f);
            top.rectTransform.anchorMax = Vector2.one;
            top.rectTransform.offsetMin = top.rectTransform.offsetMax = Vector2.zero;
            var bottom = UIKit.Img(Root, "BottomShade", UIKit.GradV, new Color(0.01f, 0.0f, 0.05f, 0.85f));
            bottom.rectTransform.anchorMin = Vector2.zero;
            bottom.rectTransform.anchorMax = new Vector2(1, 0.3f);
            bottom.rectTransform.offsetMin = bottom.rectTransform.offsetMax = Vector2.zero;
            bottom.rectTransform.localScale = new Vector3(1, -1, 1);
            for (int i = 0; i < 2; i++)
            {
                var edge = UIKit.Img(Root, i == 0 ? "LeftShade" : "RightShade", UIKit.GradH, new Color(0.01f, 0.0f, 0.05f, 0.72f));
                edge.rectTransform.anchorMin = new Vector2(i == 0 ? 0 : 0.76f, 0);
                edge.rectTransform.anchorMax = new Vector2(i == 0 ? 0.24f : 1, 1);
                edge.rectTransform.offsetMin = edge.rectTransform.offsetMax = Vector2.zero;
                if (i == 0) edge.rectTransform.localScale = new Vector3(-1, 1, 1);
            }

            BuildVs();
            for (int i = 0; i < 2; i++) BuildSide(_sides[i]);
            BuildCarousel();
            BuildTopBar();
            BuildBottom();

            _flash = UIKit.Img(Root, "Flash", UIKit.White, new Color(1, 1, 1, 0));
            _flash.rectTransform.Stretch();

            BuildSettings();
            BuildDetails();
        }

        void BuildTopBar()
        {
            _title = UIKit.Label(Root, "CHARACTER SELECT", 56, Color.white, TextAnchor.MiddleCenter, true, true, true);
            _title.rectTransform.Place(new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0, -14), new Vector2(1000, 70));
            var glow = UIKit.Img(_title.rectTransform, "Glow", UIKit.Glow, Palette.Mastery.WithAlpha(0.35f));
            glow.rectTransform.Stretch(-30);
            glow.transform.SetAsFirstSibling();
            _prompt = UIKit.Label(Root, "", 30, Palette.Bone);
            _prompt.rectTransform.Place(new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0, -86), new Vector2(1000, 44));

            _back = MBButton.Create(Root, "BACK", null, Palette.TextDim, new Vector2(0, 1), new Vector2(ColumnX + 85, -50), new Vector2(170, 64), 30);
            _back.OnClick = BackToTitle;

            _settingsButton = MBButton.Create(Root, "      MATCH SETTINGS", null, Palette.Mastery, new Vector2(1, 1), new Vector2(-ColumnX - 175, -50), new Vector2(350, 64), 26);
            _settingsButton.OnClick = OpenSettings;
            var gear = UIKit.Img(_settingsButton.Rect, "Gear", IconSprite("gear"), Color.white);
            gear.rectTransform.Place(new Vector2(0, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(52, 0), new Vector2(38, 38));
        }

        // ------------------------------------------------------------------
        void BuildSide(Side s)
        {
            bool left = s.Index == 0;
            float dir = left ? 1 : -1;
            var edgeAnchor = new Vector2(left ? 0 : 1, 1);
            var align = left ? TextAnchor.MiddleLeft : TextAnchor.MiddleRight;
            var accent = Palette.PlayerColor(s.Index);

            // floor spot under the 3D fighter
            s.FloorGlow = GameObject.CreatePrimitive(PrimitiveType.Quad);
            s.FloorGlow.name = "SelectFloorGlow_" + s.Index;
            var col = s.FloorGlow.GetComponent<Collider>();
            if (col != null) Destroy(col);
            s.FloorMat = MBAssets.AdditiveMaterial(ProceduralTextures.SoftGlow, accent, 1.2f);
            var mr = s.FloorGlow.GetComponent<MeshRenderer>();
            mr.sharedMaterial = s.FloorMat;
            mr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            mr.receiveShadows = false;
            s.FloorGlow.transform.rotation = Quaternion.Euler(90, 0, 0);
            s.FloorGlow.transform.localScale = Vector3.one * 1.9f;
            s.FloorGlow.SetActive(false);

            // ---- badge (P1 / CPU / 2P) + LOCKED IN stamp ----
            s.Column = UIKit.Node(left ? "P1Column" : "P2Column", Root);
            s.Column.Place(edgeAnchor, new Vector2(left ? 0 : 1, 1), new Vector2(ColumnX * dir, -118), new Vector2(ColumnW, 600));
            s.ColumnGroup = s.Column.gameObject.AddComponent<CanvasGroup>();
            s.ColumnGroup.blocksRaycasts = false;
            var a0 = new Vector2(left ? 0 : 1, 1);
            s.Badge = UIKit.Img(s.Column, "Badge", UIKit.Para, accent);
            s.Badge.rectTransform.Place(a0, a0, Vector2.zero, new Vector2(128, 52));
            s.BadgeText = UIKit.Label(s.Badge.rectTransform, left ? "P1" : "CPU", 34, Color.white);
            s.BadgeText.rectTransform.Stretch();
            s.LockStamp = UIKit.Label(s.Column, "LOCKED IN", 34, Palette.Gold, align, true, true, true);
            s.LockStamp.rectTransform.Place(a0, new Vector2(left ? 0 : 1, 0.5f), new Vector2(146 * dir, -26), new Vector2(260, 50));
            s.LockStamp.gameObject.SetActive(false);

            // ---- info block (playable fighters) ----
            s.InfoBlock = UIKit.Node("Info", s.Column);
            s.InfoBlock.Place(a0, a0, new Vector2(0, -72), new Vector2(ColumnW, 560));
            for (int k = 0; k < 5; k++)
            {
                float y = -18 - k * 36;
                var n = UIKit.Label(s.InfoBlock, StatNames[k], 22, Palette.TextDim, align, true);
                n.rectTransform.Place(a0, new Vector2(left ? 0 : 1, 0.5f), new Vector2(0, y), new Vector2(170, 32));
                var back = UIKit.Img(s.InfoBlock, "StatBack", UIKit.Para, new Color(0.12f, 0.1f, 0.22f, 0.95f));
                back.rectTransform.Place(a0, new Vector2(left ? 0 : 1, 0.5f), new Vector2(170 * dir, y), new Vector2(170, 18));
                var fill = UIKit.Img(back.rectTransform, "Fill", UIKit.Para, accent);
                fill.rectTransform.Stretch(2);
                fill.type = Image.Type.Filled;
                fill.fillMethod = Image.FillMethod.Horizontal;
                fill.fillOrigin = left ? 0 : 1;
                fill.fillAmount = 0;
                s.StatFill[k] = fill;
                s.StatValue[k] = UIKit.Label(s.InfoBlock, "", 26, Color.white, left ? TextAnchor.MiddleRight : TextAnchor.MiddleLeft);
                s.StatValue[k].rectTransform.Place(a0, new Vector2(left ? 1 : 0, 0.5f), new Vector2(392 * dir, y), new Vector2(50, 32));
            }

            var spec = UIKit.Label(s.InfoBlock, "SPECIALTY", 20, Palette.Gold, align, true);
            spec.rectTransform.Place(a0, new Vector2(left ? 0 : 1, 0.5f), new Vector2(0, -212), new Vector2(200, 28));
            s.Details = MBButton.Create(s.InfoBlock, "      DETAILS", null, Palette.TextDim, a0, new Vector2(left ? 316 : -316, -212), new Vector2(168, 46), 20);
            s.Details.OnClick = () => ToggleDetails(s.Index);
            var info = UIKit.Img(s.Details.Rect, "Info", IconSprite("info"), Color.white);
            info.rectTransform.Place(new Vector2(0, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(34, 0), new Vector2(28, 28));
            for (int k = 0; k < 3; k++)
            {
                float x = (left ? 0 : -1) * 0 + (k * 133 + 64) * dir;
                s.TraitRing[k] = UIKit.Img(s.InfoBlock, "TraitRing", UIKit.Circle, new Color(0.08f, 0.06f, 0.18f, 0.95f));
                s.TraitRing[k].rectTransform.Place(a0, new Vector2(0.5f, 0.5f), new Vector2(x, -268), new Vector2(64, 64));
                var ringEdge = UIKit.Img(s.TraitRing[k].rectTransform, "Edge", UIKit.CircleOutline, accent.WithAlpha(0.9f));
                ringEdge.rectTransform.Stretch(-2);
                s.TraitIcon[k] = UIKit.Img(s.TraitRing[k].rectTransform, "Icon", null, Color.white);
                s.TraitIcon[k].rectTransform.Stretch(13);
                s.TraitText[k] = UIKit.Label(s.InfoBlock, "", 21, Color.white, TextAnchor.MiddleCenter, true);
                s.TraitText[k].rectTransform.Place(a0, new Vector2(0.5f, 0.5f), new Vector2(x, -318), new Vector2(150, 30));
            }

            var skills = UIKit.Label(s.InfoBlock, "SIGNATURE SKILLS", 20, Palette.Gold, align, true);
            skills.rectTransform.Place(a0, new Vector2(left ? 0 : 1, 0.5f), new Vector2(0, -360), new Vector2(300, 28));
            for (int k = 0; k < 3; k++)
            {
                float y = -404 - k * 50;
                s.SkillIcon[k] = UIKit.Img(s.InfoBlock, "SkillIcon", null, accent);
                s.SkillIcon[k].rectTransform.Place(a0, new Vector2(0.5f, 0.5f), new Vector2(20 * dir, y), new Vector2(40, 40));
                s.SkillText[k] = UIKit.Label(s.InfoBlock, "", 27, Color.white, align, true);
                s.SkillText[k].rectTransform.Place(a0, new Vector2(left ? 0 : 1, 0.5f), new Vector2(54 * dir, y + 6), new Vector2(350, 32));
                s.SkillSub[k] = UIKit.Label(s.InfoBlock, "", 18, Palette.TextDim, align, false);
                s.SkillSub[k].rectTransform.Place(a0, new Vector2(left ? 0 : 1, 0.5f), new Vector2(56 * dir, y - 17), new Vector2(350, 22));
            }

            // ---- locked silhouette block ----
            s.LockedBlock = UIKit.Node("Locked", s.Column);
            s.LockedBlock.Place(a0, a0, new Vector2(0, -72), new Vector2(ColumnW, 400));
            var lockIcon = UIKit.Img(s.LockedBlock, "Lock", IconSprite("lock"), Palette.TextDim);
            lockIcon.rectTransform.Place(a0, new Vector2(left ? 0 : 1, 1), new Vector2(0, -10), new Vector2(96, 96));
            s.LockedTitle = UIKit.Label(s.LockedBlock, "LOCKED", 48, Color.white, align, true, true, true);
            s.LockedTitle.rectTransform.Place(a0, new Vector2(left ? 0 : 1, 0.5f), new Vector2(0, -150), new Vector2(ColumnW, 60));
            var how = UIKit.Label(s.LockedBlock, "해금 조건  ·  UNLOCK", 22, Palette.TextDim, align, true);
            how.rectTransform.Place(a0, new Vector2(left ? 0 : 1, 0.5f), new Vector2(0, -204), new Vector2(ColumnW, 30));
            s.LockedCondition = UIKit.Label(s.LockedBlock, "", 34, Palette.Gold, align, true);
            s.LockedCondition.rectTransform.Place(a0, new Vector2(left ? 0 : 1, 0.5f), new Vector2(0, -246), new Vector2(ColumnW + 200, 44));
            s.LockedBlock.gameObject.SetActive(false);

            // ---- big name, low over the fighter's legs (fighting game style) ----
            var nameAnchor = new Vector2(left ? 0 : 1, 0);
            s.NameBlock = UIKit.Node(left ? "P1Name" : "P2Name", Root);
            s.NameBlock.Place(nameAnchor, new Vector2(left ? 0 : 1, 0), new Vector2(ColumnX * dir, NameY), new Vector2(900, 150));
            s.NameGroup = s.NameBlock.gameObject.AddComponent<CanvasGroup>();
            s.NameGroup.blocksRaycasts = false;
            s.NameBanner = UIKit.Img(s.NameBlock, "Banner", UIKit.Para, accent.WithAlpha(0.85f));
            s.NameBanner.rectTransform.Place(new Vector2(left ? 0 : 1, 0), new Vector2(left ? 0 : 1, 0), new Vector2(-30 * dir, 46), new Vector2(760, 96));
            s.NameBanner.type = Image.Type.Filled;
            s.NameBanner.fillMethod = Image.FillMethod.Horizontal;
            s.NameBanner.fillOrigin = left ? 0 : 1;
            s.NameBanner.fillAmount = 0;
            s.Name = UIKit.Label(s.NameBlock, "", 84, Color.white, left ? TextAnchor.LowerLeft : TextAnchor.LowerRight, true, true, true);
            s.Name.rectTransform.Place(new Vector2(left ? 0 : 1, 0), new Vector2(left ? 0 : 1, 0), new Vector2(0, 40), new Vector2(900, 110));
            s.Sub = UIKit.Label(s.NameBlock, "", 30, Palette.Bone, left ? TextAnchor.UpperLeft : TextAnchor.UpperRight, true);
            s.Sub.rectTransform.Place(new Vector2(left ? 0 : 1, 0), new Vector2(left ? 0 : 1, 1), new Vector2(6 * dir, 36), new Vector2(900, 40));
        }

        // ------------------------------------------------------------------
        void BuildVs()
        {
            _vsGroup = UIKit.Node("VsClash", Root).Place(new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0, 40), new Vector2(560, 360));
            _vsGlowL = UIKit.Img(_vsGroup, "GlowL", UIKit.Glow, Palette.P1.WithAlpha(0.5f));
            _vsGlowL.rectTransform.Place(new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(-110, 0), new Vector2(360, 380));
            _vsGlowR = UIKit.Img(_vsGroup, "GlowR", UIKit.Glow, Palette.P2.WithAlpha(0.5f));
            _vsGlowR.rectTransform.Place(new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(110, 0), new Vector2(360, 380));
            var streakSprite = UIKit.GradH;
            for (int i = 0; i < 10; i++)
            {
                bool l = i % 2 == 0;
                var st = UIKit.Img(_vsGroup, "Streak", streakSprite, (l ? Palette.P1 : Palette.P2).WithAlpha(0.8f));
                st.rectTransform.Place(new Vector2(0.5f, 0.5f), new Vector2(l ? 1 : 0, 0.5f), Vector2.zero, new Vector2(170, 5));
                if (!l) st.rectTransform.localScale = new Vector3(-1, 1, 1);
                _streaks.Add(st);
            }
            _vsCore = UIKit.Img(_vsGroup, "Core", UIKit.Glow, Color.white.WithAlpha(0.6f));
            _vsCore.rectTransform.Place(new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(230, 230));
            for (int i = 0; i < 14; i++)
            {
                var b = UIKit.Img(_vsGroup, "Bolt", UIKit.White, Color.white);
                b.rectTransform.anchorMin = b.rectTransform.anchorMax = new Vector2(0.5f, 0.5f);
                b.rectTransform.pivot = new Vector2(0, 0.5f);
                _bolts.Add(b);
            }
            _vsText = UIKit.Label(_vsGroup, "VS", 220, Palette.Gold, TextAnchor.MiddleCenter, true, true, true);
            _vsText.rectTransform.Stretch();
        }

        // ------------------------------------------------------------------
        void BuildCarousel()
        {
            _window = UIKit.Node("Carousel", Root).Place(new Vector2(0.5f, 0), new Vector2(0.5f, 0.5f), new Vector2(0, CarouselY), new Vector2(CarouselW, CarouselH));
            _window.gameObject.AddComponent<RectMask2D>();
            _content = UIKit.Node("Content", _window).Place(new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(10, 10));

            var portraitSprite = UIKit.Round;
            for (int i = 0; i < _roster.Count; i++)
            {
                var def = _roster[i];
                var c = new Cell { Def = def };
                var holder = UIKit.Node("Cell_" + def.Id, _content);
                holder.Place(new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(i * (CellSize + CellGap), 18), new Vector2(CellSize, CellSize));
                c.Rect = holder;
                var edge = def.Locked ? LockedGray : def.Energy;
                c.Glow = UIKit.Img(holder, "Glow", UIKit.Glow, edge.WithAlpha(0));
                c.Glow.rectTransform.Stretch(-46);
                c.Back = UIKit.Img(holder, "Back", portraitSprite, new Color(0.06f, 0.05f, 0.13f, 0.98f));
                c.Back.rectTransform.Stretch();
                var mask = UIKit.Node("Mask", holder);
                mask.Stretch(5);
                mask.gameObject.AddComponent<RectMask2D>();
                c.Portrait = UIKit.Raw(mask, "Portrait", PortraitStudio.Get(def));
                c.Portrait.rectTransform.Stretch();
                if (def.Locked)
                {
                    c.Portrait.color = new Color(0.75f, 0.75f, 0.8f);
                    c.LockIcon = UIKit.Img(holder, "Lock", IconSprite("lock"), new Color(0.85f, 0.85f, 0.92f, 0.95f));
                    c.LockIcon.rectTransform.Place(new Vector2(1, 0), new Vector2(1, 0), new Vector2(-8, 8), new Vector2(40, 40));
                }
                c.Frame = UIKit.Img(holder, "Frame", UIKit.RoundOutline, edge);
                c.Frame.rectTransform.Stretch(-3);
                c.TagP1 = Tag(holder, true);
                c.TagP2 = Tag(holder, false);
                c.Caption = UIKit.Label(holder, def.Locked ? def.UnlockCondition : def.NameEn, def.Locked ? 17 : 21,
                    def.Locked ? Palette.TextDim : Color.white, TextAnchor.UpperCenter, true);
                c.Caption.horizontalOverflow = HorizontalWrapMode.Wrap;
                c.Caption.lineSpacing = 0.9f;
                c.Caption.rectTransform.Place(new Vector2(0.5f, 0), new Vector2(0.5f, 1), new Vector2(0, -8), new Vector2(CellSize + CellGap - 6, 46));
                _cells.Add(c);
            }

            // edge fades hint that the strip scrolls
            for (int i = 0; i < 2; i++)
            {
                var fade = UIKit.Img(_window, "EdgeFade", UIKit.GradH, new Color(0.01f, 0.0f, 0.05f, 0.95f));
                fade.rectTransform.anchorMin = new Vector2(i == 0 ? 0 : 1, 0);
                fade.rectTransform.anchorMax = new Vector2(i == 0 ? 0 : 1, 1);
                fade.rectTransform.pivot = new Vector2(i == 0 ? 0 : 1, 0.5f);
                fade.rectTransform.sizeDelta = new Vector2(70, 0);
                fade.rectTransform.anchoredPosition = Vector2.zero;
                if (i == 0) fade.rectTransform.localScale = new Vector3(-1, 1, 1);
            }
        }

        static Text Tag(RectTransform cell, bool p1)
        {
            var t = UIKit.Label(cell, "", 22, Color.white, p1 ? TextAnchor.UpperLeft : TextAnchor.UpperRight, true);
            t.rectTransform.Place(new Vector2(p1 ? 0 : 1, 1), new Vector2(p1 ? 0 : 1, 1), new Vector2(p1 ? 8 : -8, -6), new Vector2(80, 28));
            return t;
        }

        // ------------------------------------------------------------------
        void BuildBottom()
        {
            // START BATTLE - big, bottom centre, only active once both fighters are locked
            _startGlow = UIKit.Img(Root, "StartGlow", UIKit.Glow, Palette.Muscle.WithAlpha(0));
            _startGlow.rectTransform.Place(new Vector2(0.5f, 0), new Vector2(0.5f, 0.5f), new Vector2(0, 360), new Vector2(760, 260));
            _start = MBButton.Create(Root, "START BATTLE", "두 파이터를 확정하세요", Palette.Muscle, new Vector2(0.5f, 0), new Vector2(0, 360), new Vector2(480, 116), 48);
            _start.OnClick = TryStart;

            // small animated stage preview, bottom left (tap -> stage / match settings)
            _stageThumb = UIKit.Node("StagePreview", Root).Place(new Vector2(0, 0), new Vector2(0, 0), new Vector2(ColumnX, 40), new Vector2(380, 96));
            var bg = UIKit.Img(_stageThumb, "Bg", UIKit.Round, new Color(0.05f, 0.04f, 0.12f, 0.92f), true);
            bg.rectTransform.Stretch();
            var edge = UIKit.Img(_stageThumb, "Edge", UIKit.RoundOutline, Palette.StageNeonB.WithAlpha(0.7f));
            edge.rectTransform.Stretch(-2);
            var thumb = UIKit.Node("Thumb", _stageThumb).Place(new Vector2(0, 0.5f), new Vector2(0, 0.5f), new Vector2(8, 0), new Vector2(136, 80));
            var thumbBg = UIKit.Img(thumb, "ThumbBg", UIKit.White, new Color(0.08f, 0.05f, 0.2f));
            thumbBg.rectTransform.Stretch();
            thumb.gameObject.AddComponent<RectMask2D>();
            _stageFloor = UIKit.Raw(thumb, "Floor", ProceduralTextures.Floor(128));
            _stageFloor.color = Palette.StageNeonB;
            _stageFloor.rectTransform.Place(new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0, -10), new Vector2(190, 190));
            _stageScan = UIKit.Img(thumb, "Scan", UIKit.GradV, Palette.StageNeonC.WithAlpha(0.45f));
            _stageScan.rectTransform.Place(new Vector2(0.5f, 0), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(136, 18));
            var stageLabel = UIKit.Label(_stageThumb, "STAGE", 18, Palette.TextDim, TextAnchor.UpperLeft, true);
            stageLabel.rectTransform.Place(new Vector2(0, 1), new Vector2(0, 1), new Vector2(158, -12), new Vector2(210, 24));
            var stageName = UIKit.Label(_stageThumb, StageManager.StageNameEn, 24, Color.white, TextAnchor.UpperLeft, true);
            stageName.rectTransform.Place(new Vector2(0, 1), new Vector2(0, 1), new Vector2(158, -38), new Vector2(230, 30));
            var stageKo = UIKit.Label(_stageThumb, StageManager.StageNameKo, 18, Palette.TextDim, TextAnchor.UpperLeft, false);
            stageKo.rectTransform.Place(new Vector2(0, 1), new Vector2(0, 1), new Vector2(158, -66), new Vector2(210, 24));

            // keyboard / pad hints (hidden on touch devices - nothing small on iPad)
            _hint = UIKit.Label(Root, "←→ 선택   J 확정   K 취소   L 랜덤", 20, Palette.TextDim, TextAnchor.LowerRight, false);
            _hint.rectTransform.Place(new Vector2(1, 0), new Vector2(1, 0), new Vector2(-ColumnX, 14), new Vector2(520, 28));
        }

        // ------------------------------------------------------------------
        void BuildSettings()
        {
            _settingsPanel = UIKit.Node("MatchSettings", Root);
            _settingsPanel.Stretch();
            var dim = UIKit.Img(_settingsPanel, "Dim", UIKit.White, new Color(0.01f, 0.0f, 0.04f, 0.72f), true);
            dim.rectTransform.Stretch();
            var panel = UIKit.Panel(_settingsPanel, "Panel", Palette.Mastery, 0.95f);
            panel.Place(new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(760, 710));
            var title = UIKit.Label(panel, "MATCH SETTINGS", 44, Color.white, TextAnchor.MiddleCenter, true, true, true);
            title.rectTransform.Place(new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0, -24), new Vector2(700, 56));

            var stageRow = UIKit.Img(panel, "Stage", UIKit.Para, new Color(0.1f, 0.25f, 0.45f, 0.9f));
            stageRow.rectTransform.Place(new Vector2(0.5f, 1), new Vector2(0.5f, 0.5f), new Vector2(0, -132), new Vector2(620, 70));
            var stageText = UIKit.Label(stageRow.rectTransform, "STAGE :  " + StageManager.StageNameEn + "  (선택됨)", 26, Color.white);
            stageText.rectTransform.Stretch();
            var more = UIKit.Label(panel, "다른 스테이지는 다음 업데이트에서 추가됩니다", 20, Palette.TextDim, TextAnchor.MiddleCenter, false);
            more.rectTransform.Place(new Vector2(0.5f, 1), new Vector2(0.5f, 0.5f), new Vector2(0, -184), new Vector2(620, 28));

            _rounds = MBButton.Create(panel, "", null, Palette.Mastery, new Vector2(0.5f, 1), new Vector2(0, -250), new Vector2(560, 72), 30);
            _rounds.OnClick = () => { GameSettings.RoundsToWin = GameSettings.RoundsToWin == 2 ? 3 : GameSettings.RoundsToWin == 3 ? 1 : 2; RefreshOptions(); };
            _time = MBButton.Create(panel, "", null, Palette.Mastery, new Vector2(0.5f, 1), new Vector2(0, -338), new Vector2(560, 72), 30);
            _time.OnClick = () => { GameSettings.RoundTime = GameSettings.RoundTime == 60 ? 99 : GameSettings.RoundTime == 99 ? 45 : 60; RefreshOptions(); };
            _cpu = MBButton.Create(panel, "", null, Palette.Mastery, new Vector2(0.5f, 1), new Vector2(0, -426), new Vector2(560, 72), 30);
            _cpu.OnClick = () => { GameSettings.Difficulty = (CpuDifficulty)(((int)GameSettings.Difficulty + 1) % 3); RefreshOptions(); };
            _knowledge = MBButton.Create(panel, "", null, Palette.Gold, new Vector2(0.5f, 1), new Vector2(0, -514), new Vector2(560, 72), 30);
            _knowledge.OnClick = () => { GameSettings.Knowledge = GameSettings.Knowledge == KnowledgeLevel.Rookie ? KnowledgeLevel.Normal : KnowledgeLevel.Rookie; RefreshOptions(); };
            _closeSettings = MBButton.Create(panel, "CLOSE", null, Palette.Muscle, new Vector2(0.5f, 0), new Vector2(0, 60), new Vector2(300, 76), 32);
            _closeSettings.OnClick = CloseSettings;
            _settingsPanel.gameObject.SetActive(false);
        }

        void RefreshOptions()
        {
            _rounds.Label.text = "ROUNDS :  " + (GameSettings.RoundsToWin * 2 - 1) + "R";
            _time.Label.text = "TIME :  " + GameSettings.RoundTime + "s";
            _cpu.Label.text = "CPU :  " + GameSettings.Difficulty switch { CpuDifficulty.Easy => "EASY", CpuDifficulty.Normal => "NORMAL", _ => "HARD" };
            _cpu.gameObject.SetActive(!_twoPlayer);
            _knowledge.Label.text = "KNOWLEDGE :  " + (GameSettings.Knowledge == KnowledgeLevel.Rookie ? "ROOKIE (그림+이름)" : "NORMAL (이름만)");
            GameSettings.Save();
        }

        void OpenSettings()
        {
            if (_starting) return;
            _settingsNav.Clear();
            _settingsNav.Add(_rounds);
            _settingsNav.Add(_time);
            if (!_twoPlayer) _settingsNav.Add(_cpu);
            _settingsNav.Add(_knowledge);
            _settingsNav.Add(_closeSettings);
            RefreshOptions();
            _settingsPanel.gameObject.SetActive(true);
            _settingsPanel.SetAsLastSibling();
            _settingsNav.Focus(0);
            AudioManager.Instance?.PlaySfx("ui_confirm", 0.6f);
        }

        void CloseSettings()
        {
            _settingsPanel.gameObject.SetActive(false);
            AudioManager.Instance?.PlaySfx("ui_back", 0.7f);
        }

        // ------------------------------------------------------------------
        void BuildDetails()
        {
            _detailsPanel = UIKit.Node("Details", Root);
            _detailsPanel.Stretch();
            var dim = UIKit.Img(_detailsPanel, "Dim", UIKit.White, new Color(0.01f, 0.0f, 0.04f, 0.6f), true);
            dim.rectTransform.Stretch();
            var panel = UIKit.Panel(_detailsPanel, "Panel", Palette.Mastery, 0.96f);
            panel.Place(new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(860, 560));
            _detailsName = UIKit.Label(panel, "", 56, Color.white, TextAnchor.UpperLeft, true, true, true);
            _detailsName.rectTransform.Place(new Vector2(0, 1), new Vector2(0, 1), new Vector2(44, -30), new Vector2(780, 70));
            _detailsText = UIKit.Label(panel, "", 27, Color.white, TextAnchor.UpperLeft, false);
            _detailsText.lineSpacing = 1.35f;
            _detailsText.horizontalOverflow = HorizontalWrapMode.Wrap;
            _detailsText.rectTransform.Place(new Vector2(0, 1), new Vector2(0, 1), new Vector2(44, -118), new Vector2(780, 400));
            var close = UIKit.Label(panel, "탭하거나 K · Esc 로 닫기", 20, Palette.TextDim, TextAnchor.LowerRight, false);
            close.rectTransform.Place(new Vector2(1, 0), new Vector2(1, 0), new Vector2(-30, 20), new Vector2(500, 28));
            _detailsPanel.gameObject.SetActive(false);
        }

        void ToggleDetails(int side)
        {
            if (_detailsPanel.gameObject.activeSelf) { CloseDetails(); return; }
            var d = _roster[_cursor[side]];
            if (d.Locked) return;
            _detailsSide = side;
            _detailsName.text = d.NameEn + "  <size=34><color=#C8CCF0>" + d.NameKo + "</color></size>";
            _detailsText.text =
                "<color=#FFCC40>" + d.RoleKo + "</color>  ·  " + d.RoleEn + "\n" +
                "<i>" + d.Quote + "</i>\n\n" +
                "<color=#FFCC40>전문 분야</color>   " + string.Join("  ·  ", d.Specialties) + "\n" +
                "<color=#FFCC40>대표 근육</color>   " + d.SignatureMuscles + "\n" +
                "<color=#FFCC40>스페셜</color>   " + d.SpecialName + "  (" + d.SpecialNameEn + ")\n" +
                "<color=#FFCC40>얼티밋</color>   " + d.UltimateName + "  (" + d.UltimateNameEn + ")\n" +
                "<color=#FFCC40>난이도</color>   " + new string('★', Mathf.Clamp(d.Difficulty, 1, 5)) + new string('☆', 5 - Mathf.Clamp(d.Difficulty, 1, 5));
            _detailsPanel.gameObject.SetActive(true);
            _detailsPanel.SetAsLastSibling();
            AudioManager.Instance?.PlaySfx("ui_confirm", 0.6f);
        }

        void CloseDetails()
        {
            _detailsPanel.gameObject.SetActive(false);
            _detailsSide = -1;
            AudioManager.Instance?.PlaySfx("ui_back", 0.6f);
        }

        // ==================================================================
        // Open / close
        // ==================================================================
        public void Open(bool twoPlayer)
        {
            _twoPlayer = twoPlayer;
            _starting = false;
            _locked[0] = _locked[1] = false;
            _activeChooser = 0;
            _cursor[0] = 0;
            _cursor[1] = Mathf.Min(1, CharacterDatabase.All.Count - 1);
            _sides[1].BadgeText.text = twoPlayer ? "2P" : "CPU";
            _sides[1].Badge.color = twoPlayer ? Palette.P2 : CpuBadge;
            _settingsPanel.gameObject.SetActive(false);
            _detailsPanel.gameObject.SetActive(false);
            _hint.gameObject.SetActive(!QualityProfile.IsTouchDevice);
            _lastMouse = Input.mousePosition;
            _flashAmount = 0;
            Show();
            RefreshOptions();

            SaveAndSetFog();
            UpdateFraming(true);
            for (int i = 0; i < 2; i++)
            {
                var s = _sides[i];
                s.LockStamp.gameObject.SetActive(false);
                s.NameBanner.fillAmount = 0;
                s.Banner = s.NamePunch = s.Stamp = s.Push = 0;
                s.ThemeDelay = -1f;
                s.FloorGlow.SetActive(true);
                Preview(i, false);
            }
            _scroll = TargetScroll();
            _scrollVel = 0;
            _manualScroll = 0;
            AudioManager.Instance?.PlayBgm("select", true);
            AudioManager.Instance?.SetSelectLayers(false, false);
            AudioManager.Instance?.Announce("choose");
        }

        public override void Hide()
        {
            base.Hide();
            RestoreFog();
            for (int i = 0; i < 2; i++)
            {
                if (_sides[i].FloorGlow != null) _sides[i].FloorGlow.SetActive(false);
                var f = GameModeManager.Instance != null ? GameModeManager.Instance.PreviewFighter(i) : null;
                if (f != null && f.Rig != null) f.Rig.SelectMode = false; // round intros use the normal Intro pose
            }
        }

        void SaveAndSetFog()
        {
            if (!_fogSaved)
            {
                _savedFog = RenderSettings.fog;
                _savedFogMode = RenderSettings.fogMode;
                _savedFogColor = RenderSettings.fogColor;
                _savedFogDensity = RenderSettings.fogDensity;
                _savedFogStart = RenderSettings.fogStartDistance;
                _savedFogEnd = RenderSettings.fogEndDistance;
                _fogSaved = true;
            }
            // cheap "depth of field": the arena behind the fighters sinks into a dark haze, fighters stay crisp
            RenderSettings.fog = true;
            RenderSettings.fogMode = FogMode.Linear;
            RenderSettings.fogColor = new Color(0.025f, 0.015f, 0.065f);
            RenderSettings.fogStartDistance = CamDist + 1.0f;
            RenderSettings.fogEndDistance = CamDist + 9.5f;
        }

        void RestoreFog()
        {
            if (!_fogSaved) return;
            RenderSettings.fog = _savedFog;
            RenderSettings.fogMode = _savedFogMode;
            RenderSettings.fogColor = _savedFogColor;
            RenderSettings.fogDensity = _savedFogDensity;
            RenderSettings.fogStartDistance = _savedFogStart;
            RenderSettings.fogEndDistance = _savedFogEnd;
            _fogSaved = false;
        }

        // ==================================================================
        // Fighters / info
        // ==================================================================
        void Preview(int side, bool react)
        {
            var def = _roster[_cursor[side]];
            var f = GameModeManager.Instance.SpawnPreview(side, def);
            PlaceFighter(side, f);
            if (f.Rig != null)
            {
                f.Rig.SelectMode = true;
                if (react) f.Rig.SelectHover();
            }
            if (react && !def.Locked) VFXManager.Instance?.SelectHover(f, def.Energy);
            Fill(_sides[side], def);
        }

        void PlaceFighter(int side, FighterController f)
        {
            if (f == null) return;
            float x = side == 0 ? -_fighterX : _fighterX;
            var facing = new Vector3(side == 0 ? 0.42f : -0.42f, 0, -1).normalized; // toward the camera, slightly to centre
            f.ResetForRound(new Vector3(x, 0, 0), facing);
            var s = _sides[side];
            if (s.FloorGlow != null) s.FloorGlow.transform.position = new Vector3(x, 0.03f, 0);
        }

        void Fill(Side s, FighterDefinition d)
        {
            s.Slide = 0;
            s.Name.text = d.Locked ? "???" : d.NameEn;
            s.Sub.text = d.Locked
                ? "UNKNOWN FIGHTER  ·  " + StyleName(d.Style)
                : d.NameKo + "  ·  " + (d.ShortRole ?? d.RoleEn);
            s.InfoBlock.gameObject.SetActive(!d.Locked);
            s.LockedBlock.gameObject.SetActive(d.Locked);
            s.Details.gameObject.SetActive(!d.Locked);
            var accent = s.Index == 0 ? Palette.P1 : Palette.P2;
            s.FloorMat.SetColor("_TintColor", d.Locked ? LockedGray : accent);
            if (s.FloorMat.HasProperty("_Color")) s.FloorMat.SetColor("_Color", d.Locked ? LockedGray : accent);
            if (d.Locked)
            {
                s.LockedCondition.text = d.UnlockCondition;
                return;
            }
            int[] stats = { d.Power, d.Speed, d.Technique, d.Defense, d.Knowledge };
            for (int k = 0; k < 5; k++)
            {
                s.StatTarget[k] = stats[k] / 10f;
                s.StatValue[k].text = stats[k].ToString();
            }
            for (int k = 0; k < 3; k++)
            {
                bool hasTrait = d.Traits != null && k < d.Traits.Length;
                s.TraitRing[k].gameObject.SetActive(hasTrait);
                s.TraitText[k].text = hasTrait ? d.Traits[k].Label : "";
                if (hasTrait) s.TraitIcon[k].sprite = IconSprite(d.Traits[k].Icon);

                bool hasSkill = d.SignatureSkills != null && k < d.SignatureSkills.Length;
                s.SkillIcon[k].gameObject.SetActive(hasSkill);
                s.SkillText[k].text = hasSkill ? d.SignatureSkills[k].Label : "";
                s.SkillSub[k].text = hasSkill ? d.SignatureSkills[k].Sub ?? "" : "";
                if (hasSkill)
                {
                    s.SkillIcon[k].sprite = IconSprite(d.SignatureSkills[k].Icon);
                    s.SkillIcon[k].color = d.Energy;
                }
            }
        }

        static readonly Dictionary<string, Sprite> IconCache = new Dictionary<string, Sprite>();

        static Sprite IconSprite(string key)
        {
            if (string.IsNullOrEmpty(key)) key = "burst";
            if (!IconCache.TryGetValue(key, out var sp) || sp == null)
            {
                sp = MBAssets.SpriteFrom(ProceduralTextures.Icon(key));
                IconCache[key] = sp;
            }
            return sp;
        }

        static string StyleName(FightStyle s) => s switch
        {
            FightStyle.Rehab => "REHAB TYPE",
            FightStyle.Performance => "PERFORMANCE TYPE",
            FightStyle.Mobility => "MOBILITY TYPE",
            FightStyle.Power => "POWER TYPE",
            FightStyle.Neuro => "NEURO TYPE",
            _ => "BALANCE TYPE",
        };

        // ==================================================================
        // Update
        // ==================================================================
        bool BothLocked => _locked[0] && _locked[1];

        void Update()
        {
            if (!Visible) return;
            float dt = Time.unscaledDeltaTime;
            float t = Time.unscaledTime;

            UpdateFraming(false);
            AnimateSides(dt);
            AnimateVs(dt, t);
            AnimateStage(t);
            AnimateCells(dt, t);
            UpdateStartButton(t);

            _flashAmount = Mathf.MoveTowards(_flashAmount, 0, dt * 2.6f);
            _flash.color = _flashColor.WithAlpha(_flashAmount * 0.45f);

            if (_starting) return;

            // overlays own the input while open
            if (_settingsPanel.gameObject.activeSelf)
            {
                if (MenuInput.Back(-1)) { CloseSettings(); return; }
                _settingsNav.Update();
                return;
            }
            if (_detailsPanel.gameObject.activeSelf)
            {
                if (MenuInput.Back(-1) || MenuInput.Confirm(-1) || PointerPressedAnywhere()) CloseDetails();
                return;
            }

            UpdatePrompt();
            UpdateButtons();
            UpdateCarouselPointer(dt);

            if (BothLocked)
            {
                if (MenuInput.Confirm(-1)) { _start.Click(); return; }
                if (_twoPlayer)
                {
                    for (int s = 0; s < 2; s++) if (MenuInput.Back(s)) { Unlock(s); return; }
                }
                else if (MenuInput.Back(-1)) { Unlock(1); return; }
                return;
            }

            if (_twoPlayer)
            {
                for (int s = 0; s < 2; s++) HandleChooser(s, s);
                for (int s = 0; s < 2; s++)
                    if (MenuInput.Back(s))
                    {
                        if (_locked[s]) Unlock(s);
                        else if (s == 0) BackToTitle();
                    }
            }
            else
            {
                HandleChooser(_activeChooser, -1);
                if (MenuInput.Back(-1))
                {
                    if (_activeChooser == 1 && _locked[0]) { _activeChooser = 0; Unlock(0); }
                    else BackToTitle();
                }
            }
        }

        void UpdatePrompt()
        {
            if (BothLocked) _prompt.text = "준비 완료!  START BATTLE";
            else if (_twoPlayer) _prompt.text = "파이터를 선택하세요";
            else _prompt.text = _activeChooser == 0 ? "파이터를 선택하세요" : "상대 CPU를 선택하세요";
        }

        void UpdateButtons()
        {
            foreach (var b in new[] { _back, _settingsButton, _sides[0].Details, _sides[1].Details })
            {
                if (b == null || !b.gameObject.activeInHierarchy) continue;
                b.SetFocus(MenuInput.PointerHover(b.Rect), true);
                if (MenuInput.PointerDownOver(b.Rect)) b.Click();
            }
            if (MenuInput.PointerDownOver(_stageThumb)) OpenSettings();
            if (MenuInput.PointerDownOver(_start.Rect)) _start.Click();
        }

        void HandleChooser(int side, int device)
        {
            if (_locked[side]) return;
            var nav = MenuInput.Nav(device);
            if (nav.x != 0)
            {
                int n = _roster.Count;
                Move(side, ((_cursor[side] + nav.x) % n + n) % n);
            }
            if (MenuInput.Random(device)) Move(side, Random.Range(0, CharacterDatabase.All.Count));
            if (MenuInput.Confirm(device)) Lock(side);
        }

        int PointerSide => _twoPlayer ? (_locked[0] ? 1 : 0) : _activeChooser;

        void Move(int side, int index)
        {
            if (_cursor[side] == index) return;
            _cursor[side] = index;
            _manualScroll = 0;
            var def = _roster[index];
            AudioManager.Instance?.PlaySfx("ui_tick", 0.7f);
            AudioManager.Instance?.PlayVariant("whoosh", Vector3.zero, 0.35f);
            _cells[index].Bounce = 1f;
            Preview(side, true);
            var s = _sides[side];
            s.ThemeDelay = def.Locked ? -1f : 0.22f; // theme sting once the cursor rests (no spam while scrolling)
            _hoverDrift = side == 0 ? -1f : 1f;
        }

        void Lock(int side)
        {
            if (_locked[side]) return;
            var def = _roster[_cursor[side]];
            if (def.Locked)
            {
                AudioManager.Instance?.PlaySfx("ui_wrong", 0.8f);
                _cells[_cursor[side]].Shake = 1f;
                CameraManager.Instance?.Shake(0.08f);
                return;
            }
            _locked[side] = true;
            var s = _sides[side];
            s.NamePunch = 1f;
            s.Banner = 0.001f;
            s.Stamp = 0.001f;
            s.LockStamp.gameObject.SetActive(true);
            s.ThemeDelay = -1f;
            _vsPunch = 1f;
            _flashColor = def.Energy;
            _flashAmount = 1f;

            AudioManager.Instance?.PlaySfx("ui_lock", 1f);
            AudioManager.Instance?.PlayVariant("heavy", Vector3.zero, 0.75f);
            StartCoroutine(VoiceAfter(def.LockVoice, 0.18f));
            AudioManager.Instance?.SetSelectLayers(_locked[0] || _locked[1], BothLocked);

            var f = GameModeManager.Instance.PreviewFighter(side);
            if (f != null)
            {
                f.Rig?.SelectLockIn(1.35f);
                VFXManager.Instance?.SelectLock(f, def.Energy);
            }
            _camPush = 1f;
            _camPushSide = side;
            CameraManager.Instance?.Shake(0.22f);
            CameraManager.Instance?.Punch(0.05f);

            if (!_twoPlayer && side == 0) _activeChooser = 1;
            if (BothLocked) _start.SetFocus(true);
        }

        IEnumerator VoiceAfter(string key, float delay)
        {
            yield return new WaitForSecondsRealtime(delay);
            AudioManager.Instance?.PlayVoice(key);
        }

        void Unlock(int side)
        {
            _locked[side] = false;
            var s = _sides[side];
            s.LockStamp.gameObject.SetActive(false);
            s.Banner = 0;
            s.NameBanner.fillAmount = 0;
            GameModeManager.Instance.PreviewFighter(side)?.Rig?.SelectUnlock();
            AudioManager.Instance?.PlaySfx("ui_back");
            AudioManager.Instance?.SetSelectLayers(_locked[0] || _locked[1], BothLocked);
            if (!_twoPlayer) _activeChooser = side;
            _start.SetFocus(false, false);
        }

        void BackToTitle()
        {
            if (_starting) return;
            GameModeManager.Instance.GoToTitle();
        }

        void TryStart()
        {
            if (!BothLocked || _starting) return;
            StartCoroutine(StartRoutine());
        }

        /// <summary>Energy rush: both colours flood the centre, white flash, then the VS screen.</summary>
        IEnumerator StartRoutine()
        {
            _starting = true;
            var a = _roster[_cursor[0]];
            var b = _roster[_cursor[1]];
            AudioManager.Instance?.PlayVariant("launch", Vector3.zero, 0.9f);
            AudioManager.Instance?.PlaySfx("special", 0.7f);
            for (int i = 0; i < 2; i++)
            {
                var f = GameModeManager.Instance.PreviewFighter(i);
                if (f != null) VFXManager.Instance?.SelectLock(f, (i == 0 ? a : b).Energy);
            }
            CameraManager.Instance?.Punch(0.12f);
            CameraManager.Instance?.Shake(0.3f);
            float t = 0;
            const float dur = 0.5f;
            while (t < dur)
            {
                t += Time.unscaledDeltaTime;
                float k = Mathf.Clamp01(t / dur);
                _vsGroup.localScale = Vector3.one * (1f + k * k * 2.2f);
                _vsGlowL.color = a.Energy.WithAlpha(0.6f + 0.4f * k);
                _vsGlowR.color = b.Energy.WithAlpha(0.6f + 0.4f * k);
                _flashColor = Color.white;
                _flashAmount = Mathf.Max(_flashAmount, k * k * 2.2f);
                yield return null;
            }
            _vsGroup.localScale = Vector3.one;
            GameModeManager.Instance.GoToVs(a, b);
        }

        // ==================================================================
        // Carousel pointer / swipe
        // ==================================================================
        float CanvasScale
        {
            get
            {
                var c = Root.GetComponentInParent<Canvas>();
                return c != null && c.scaleFactor > 0.001f ? c.scaleFactor : 1f;
            }
        }

        float ContentSpan => (_roster.Count - 1) * (CellSize + CellGap);

        float TargetScroll()
        {
            int focus = _cursor[Mathf.Clamp(PointerSide, 0, 1)];
            return ClampScroll(-focus * (CellSize + CellGap));
        }

        /// <summary>Content offset range: first cell centred .. last cell centred.</summary>
        float ClampScroll(float x) => Mathf.Clamp(x, -ContentSpan, 0f);

        bool PointerPressedAnywhere() => Input.GetMouseButtonDown(0) || (Input.touchCount > 0 && Input.GetTouch(0).phase == TouchPhase.Began);

        bool ReadPointer(out Vector2 pos, out bool down, out bool held, out bool up)
        {
            if (Input.touchCount > 0)
            {
                var tch = Input.GetTouch(0);
                pos = tch.position;
                down = tch.phase == TouchPhase.Began;
                up = tch.phase == TouchPhase.Ended || tch.phase == TouchPhase.Canceled;
                held = !up;
                return true;
            }
            pos = Input.mousePosition;
            down = Input.GetMouseButtonDown(0);
            up = Input.GetMouseButtonUp(0);
            held = Input.GetMouseButton(0);
            return Input.mousePresent;
        }

        void UpdateCarouselPointer(float dt)
        {
            bool any = ReadPointer(out var pos, out bool down, out bool held, out bool up);
            float scale = CanvasScale;

            if (any && down && MenuInput.Contains(_window, pos))
            {
                _pointerDown = true;
                _dragging = false;
                _pointerStart = _pointerLast = pos;
                _scrollAtPress = _scroll;
                _scrollVel = 0;
                _pressedCell = CellAt(pos);
            }

            if (_pointerDown)
            {
                if (held)
                {
                    float dx = (pos.x - _pointerStart.x) / scale;
                    if (!_dragging && Mathf.Abs(dx) > 16f) _dragging = true;
                    if (_dragging)
                    {
                        _scroll = _scrollAtPress + dx;
                        if (dt > 0) _scrollVel = Mathf.Lerp(_scrollVel, (pos.x - _pointerLast.x) / scale / dt, 0.5f);
                        _manualScroll = 2.5f;
                    }
                    _pointerLast = pos;
                }
                if (up || !held)
                {
                    if (!_dragging && _pressedCell >= 0 && CellAt(pos) == _pressedCell) TapCell(_pressedCell);
                    _pointerDown = false;
                    _dragging = false;
                    _pressedCell = -1;
                }
            }
            else if (Input.touchCount == 0 && Input.mousePresent)
            {
                // mouse hover over a portrait moves the cursor (§4)
                var mp = Input.mousePosition;
                if ((mp - _lastMouse).sqrMagnitude > 4f)
                {
                    int over = CellAt(mp);
                    int side = PointerSide;
                    if (over >= 0 && side >= 0 && side < 2 && !_locked[side]) Move(side, over);
                }
                _lastMouse = mp;
            }

            // scroll physics: inertia after a swipe, then ease back to the active cursor
            if (!_dragging)
            {
                if (Mathf.Abs(_scrollVel) > 5f)
                {
                    _scroll += _scrollVel * dt;
                    _scrollVel *= Mathf.Exp(-4f * dt);
                }
                _manualScroll -= dt;
                float target = _manualScroll > 0 ? ClampScroll(_scroll) : TargetScroll();
                _scroll = Mathf.Lerp(_scroll, target, 1f - Mathf.Exp(-(_manualScroll > 0 ? 12f : 9f) * dt));
            }
            _content.anchoredPosition = new Vector2(_scroll, 0);
        }

        int CellAt(Vector2 screenPos)
        {
            if (!MenuInput.Contains(_window, screenPos)) return -1;
            for (int i = 0; i < _cells.Count; i++)
                if (RectTransformUtility.RectangleContainsScreenPoint(_cells[i].Rect, screenPos, null)) return i;
            return -1;
        }

        void TapCell(int i)
        {
            int side = PointerSide;
            if (side < 0 || side > 1 || _locked[side]) return;
            if (_cursor[side] == i) Lock(side);
            else Move(side, i);
        }

        // ==================================================================
        // Animation
        // ==================================================================
        void UpdateFraming(bool snap)
        {
            float aspect = (float)Screen.width / Mathf.Max(1, Screen.height);
            float x = FighterScreenX * Mathf.Tan(20f * Mathf.Deg2Rad) * aspect * CamDist;
            x = Mathf.Clamp(x, 0.5f, 1.05f);
            if (snap || Mathf.Abs(x - _fighterX) > 0.01f)
            {
                _fighterX = x;
                for (int i = 0; i < 2; i++) PlaceFighter(i, GameModeManager.Instance != null ? GameModeManager.Instance.PreviewFighter(i) : null);
            }

            // hero shot: low camera looking slightly up; lock-in pushes toward that fighter, hover drifts
            float dt = Time.unscaledDeltaTime;
            _camPush = Mathf.MoveTowards(_camPush, 0, dt * 1.4f);
            _hoverDrift = Mathf.MoveTowards(_hoverDrift, 0, dt * 0.9f);
            float push = Mathf.Sin(Mathf.Clamp01(_camPush) * Mathf.PI * 0.5f);
            float pushX = (_camPushSide == 0 ? -1 : 1) * _fighterX * 0.35f * push;
            float drift = _hoverDrift * 0.12f;
            var pos = new Vector3(pushX + drift, 1.0f + 0.05f * push, -CamDist + 0.55f * push);
            var look = new Vector3(pushX * 1.1f + drift * 0.6f, 1.13f + 0.08f * push, 0);
            CameraManager.Instance?.SetFree(pos, look, 40f, snap);
        }

        void AnimateSides(float dt)
        {
            float t = Time.unscaledTime;
            for (int i = 0; i < 2; i++)
            {
                var s = _sides[i];
                float dir = i == 0 ? 1 : -1;
                // info slides in on every fighter change
                s.Slide = Mathf.MoveTowards(s.Slide, 1, dt * 4f);
                float e = 1f - Mathf.Pow(1f - s.Slide, 3f);
                s.ColumnGroup.alpha = Mathf.Lerp(0.2f, 1f, e);
                s.Column.anchoredPosition = new Vector2((ColumnX - (1 - e) * 60f) * dir, -118);
                s.NameGroup.alpha = Mathf.Lerp(0f, 1f, e);
                s.NameBlock.anchoredPosition = new Vector2((ColumnX - (1 - e) * 120f) * dir, NameY);

                // lock-in: name punch + banner sweep + stamp
                s.NamePunch = Mathf.MoveTowards(s.NamePunch, 0, dt * 2.2f);
                float punch = s.NamePunch * s.NamePunch;
                s.NameBlock.localScale = Vector3.one * (1f + punch * 0.3f);
                s.Name.color = Color.Lerp(Color.white, Palette.Gold, punch);
                if (_locked[i])
                {
                    s.Banner = Mathf.MoveTowards(s.Banner, 1f, dt * 5f);
                    s.NameBanner.fillAmount = 1f - Mathf.Pow(1f - s.Banner, 3f);
                    var c = _roster[_cursor[i]].Energy;
                    s.NameBanner.color = Color.Lerp(c, Color.black, 0.35f).WithAlpha(0.55f + 0.25f * Mathf.Abs(Mathf.Sin(t * 2.5f)));
                    s.Stamp = Mathf.MoveTowards(s.Stamp, 1f, dt * 6f);
                    s.LockStamp.rectTransform.localScale = Vector3.one * Mathf.Lerp(2.2f, 1f, s.Stamp);
                    s.LockStamp.color = Palette.Gold.WithAlpha(Mathf.Clamp01(s.Stamp * 2f));
                }

                // stat bars fill smoothly (UI motion)
                for (int k = 0; k < 5; k++)
                {
                    s.StatShown[k] = Mathf.Lerp(s.StatShown[k], s.StatTarget[k], 1f - Mathf.Exp(-10f * dt));
                    s.StatFill[k].fillAmount = s.StatShown[k];
                }

                // floor spot breathes, brighter once locked
                if (s.FloorMat != null && s.FloorGlow.activeSelf)
                {
                    float glow = (_locked[i] ? 1.9f : 1.0f) + Mathf.Sin(t * 3f + i) * 0.15f;
                    s.FloorMat.SetFloat("_Intensity", glow);
                }

                // character theme sting once the cursor rests on a fighter
                if (s.ThemeDelay > 0)
                {
                    s.ThemeDelay -= dt;
                    if (s.ThemeDelay <= 0)
                    {
                        var d = _roster[_cursor[i]];
                        if (!d.Locked && !string.IsNullOrEmpty(d.ThemeSfx)) AudioManager.Instance?.PlaySfx(d.ThemeSfx, 0.55f);
                    }
                }
            }
        }

        void AnimateVs(float dt, float t)
        {
            var c1 = _roster[_cursor[0]].Locked ? LockedGray : _roster[_cursor[0]].Energy;
            var c2 = _roster[_cursor[1]].Locked ? LockedGray : _roster[_cursor[1]].Energy;
            var p1 = Color.Lerp(Palette.P1, c1, 0.35f);
            var p2 = Color.Lerp(Palette.P2, c2, 0.35f);
            float ready = BothLocked ? 1f : (_locked[0] || _locked[1]) ? 0.5f : 0f;
            _vsPunch = Mathf.MoveTowards(_vsPunch, 0, dt * 2.5f);

            if (!_starting)
            {
                float pulseL = 1f + Mathf.Sin(t * 3.1f) * 0.06f + (_locked[0] ? 0.12f : 0f);
                float pulseR = 1f + Mathf.Sin(t * 3.1f + 1.7f) * 0.06f + (_locked[1] ? 0.12f : 0f);
                _vsGlowL.rectTransform.localScale = Vector3.one * pulseL;
                _vsGlowR.rectTransform.localScale = Vector3.one * pulseR;
                _vsGlowL.color = p1.WithAlpha(0.42f + 0.18f * ready);
                _vsGlowR.color = p2.WithAlpha(0.42f + 0.18f * ready);
                _vsGroup.localScale = Vector3.one * (1f + _vsPunch * 0.18f);
            }
            _vsCore.color = Color.white.WithAlpha(0.35f + 0.25f * ready + 0.2f * Mathf.Abs(Mathf.Sin(t * 9f)));
            _vsText.rectTransform.anchoredPosition = new Vector2(Random.Range(-1f, 1f), Random.Range(-1f, 1f)) * (1.5f + 6f * _vsPunch + 1.5f * ready);
            _vsText.color = Color.Lerp(Palette.Gold, Color.white, _vsPunch * 0.6f);

            // energy streaks flowing from each fighter into the centre
            for (int i = 0; i < _streaks.Count; i++)
            {
                bool l = i % 2 == 0;
                float speed = 0.9f + 0.6f * ready;
                float ph = Mathf.Repeat(t * speed + i * 0.37f, 1f);
                float x = Mathf.Lerp(330f, 20f, ph) * (l ? -1 : 1);
                float y = Mathf.Sin(i * 12.9898f) * 120f * (1f - ph * 0.8f);
                var st = _streaks[i];
                st.rectTransform.anchoredPosition = new Vector2(l ? x + 170f : x - 170f, y);
                st.color = (l ? p1 : p2).WithAlpha(Mathf.Sin(ph * Mathf.PI) * (0.55f + 0.35f * ready));
            }

            // electric muscle-fibre arcs between the two energies
            _boltTimer -= dt;
            if (_boltTimer <= 0)
            {
                _boltTimer = Mathf.Lerp(0.09f, 0.04f, ready);
                int perBolt = 7;
                for (int b = 0; b < 2; b++)
                {
                    var from = new Vector2(-170f, Random.Range(-60f, 60f));
                    var to = new Vector2(170f, Random.Range(-60f, 60f));
                    var prev = from;
                    for (int k = 1; k <= perBolt; k++)
                    {
                        float u = k / (float)perBolt;
                        var pt = k == perBolt ? to : Vector2.Lerp(from, to, u) + new Vector2(0, Random.Range(-38f, 38f));
                        var img = _bolts[b * perBolt + k - 1];
                        var d = pt - prev;
                        img.rectTransform.anchoredPosition = prev;
                        img.rectTransform.sizeDelta = new Vector2(d.magnitude, b == 0 ? 4f : 3f);
                        img.rectTransform.localRotation = Quaternion.Euler(0, 0, Mathf.Atan2(d.y, d.x) * Mathf.Rad2Deg);
                        img.color = Color.Lerp(u < 0.5f ? p1 : p2, Color.white, 0.55f).WithAlpha(Random.Range(0.35f, 0.9f) * (0.6f + 0.4f * ready));
                        prev = pt;
                    }
                }
            }
        }

        void AnimateStage(float t)
        {
            _stageFloor.rectTransform.localRotation = Quaternion.Euler(0, 0, t * 12f);
            _stageFloor.color = Color.Lerp(Palette.StageNeonB, Palette.StageNeonA, 0.5f + 0.5f * Mathf.Sin(t * 1.3f));
            _stageScan.rectTransform.anchoredPosition = new Vector2(0, Mathf.Repeat(t * 50f, 100f) - 10f);
        }

        void AnimateCells(float dt, float t)
        {
            for (int i = 0; i < _cells.Count; i++)
            {
                var c = _cells[i];
                bool p1 = _cursor[0] == i;
                bool p2 = _cursor[1] == i && (_twoPlayer || _activeChooser == 1 || _locked[1]);
                bool active = p1 || p2;
                bool lockedHere = (p1 && _locked[0]) || (p2 && _locked[1]);
                Color frame = p1 && p2 ? Palette.Gold : p1 ? Palette.P1 : p2 ? (_twoPlayer ? Palette.P2 : CpuBadge) : (c.Def.Locked ? LockedGray : c.Def.Energy);
                if (lockedHere) frame = Palette.Gold;
                float pulse = active ? 0.75f + 0.25f * Mathf.Sin(t * 7f) : 0.55f;
                c.Frame.color = frame.WithAlpha(pulse);
                c.Glow.color = frame.WithAlpha(active ? 0.45f + 0.15f * Mathf.Sin(t * 5f) : 0f);

                float target = active ? 1.28f : 1f;
                c.Scale = Mathf.Lerp(c.Scale, target, 1f - Mathf.Exp(-14f * dt));
                c.Bounce = Mathf.MoveTowards(c.Bounce, 0, dt * 2.2f);
                float bounce = Mathf.Sin(c.Bounce * Mathf.PI * 3f) * 0.09f * c.Bounce;
                c.Rect.localScale = Vector3.one * (c.Scale + bounce);
                c.Shake = Mathf.MoveTowards(c.Shake, 0, dt * 3f);
                float x = i * (CellSize + CellGap) + Mathf.Sin(t * 70f) * 10f * c.Shake;
                c.Rect.anchoredPosition = new Vector2(x, 18f + (active ? 8f : 0f));
                if (active) c.Rect.SetAsLastSibling();

                c.TagP1.text = p1 ? "P1" : "";
                c.TagP1.color = Palette.P1;
                c.TagP2.text = p2 ? (_twoPlayer ? "2P" : "CPU") : "";
                c.TagP2.color = _twoPlayer ? Palette.P2 : Color.white;
                c.Caption.color = active ? (c.Def.Locked ? Palette.Bone : Color.white) : (c.Def.Locked ? Palette.TextDim : new Color(0.85f, 0.87f, 1f));
                if (c.LockIcon != null) c.LockIcon.rectTransform.localScale = Vector3.one * (1f + (active ? 0.08f * Mathf.Sin(t * 6f) : 0f));
            }
        }

        void UpdateStartButton(float t)
        {
            bool ready = BothLocked;
            _start.Interactable = ready;
            if (!ready && _start.Focused) _start.SetFocus(false, false);
            if (_start.SubLabel != null) _start.SubLabel.text = ready ? "FIGHT!" : "두 파이터를 확정하세요";
            float pulse = ready ? 0.45f + 0.35f * Mathf.Abs(Mathf.Sin(t * 3.4f)) : 0f;
            _startGlow.color = Palette.Muscle.WithAlpha(pulse);
            _startGlow.rectTransform.localScale = Vector3.one * (1f + (ready ? 0.08f * Mathf.Sin(t * 3.4f) : 0f));
        }
    }
}
