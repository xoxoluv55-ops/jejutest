using UnityEngine;
using UnityEngine.UI;

namespace MuscleBattle
{
    /// <summary>Base for full-screen UI states.</summary>
    public abstract class ScreenBase : MonoBehaviour
    {
        protected RectTransform Root;
        public bool Visible => Root != null && Root.gameObject.activeSelf;

        protected void InitRoot(Transform canvas, string name)
        {
            Root = UIKit.Node(name, canvas);
            Root.Stretch();
        }

        public virtual void Show() => Root.gameObject.SetActive(true);
        public virtual void Hide() => Root.gameObject.SetActive(false);

        protected static void ControlsBar(RectTransform parent, string text)
        {
            var bar = UIKit.Img(parent, "ControlsBar", UIKit.GradH, new Color(0.02f, 0.01f, 0.06f, 0.8f));
            bar.rectTransform.anchorMin = new Vector2(0, 0);
            bar.rectTransform.anchorMax = new Vector2(1, 0);
            bar.rectTransform.pivot = new Vector2(0.5f, 0);
            bar.rectTransform.sizeDelta = new Vector2(0, 54);
            bar.rectTransform.anchoredPosition = Vector2.zero;
            var t = UIKit.Label(bar.rectTransform, text, 22, Palette.TextDim, TextAnchor.MiddleLeft, false);
            t.rectTransform.Stretch();
            t.rectTransform.offsetMin = new Vector2(40, 0);
        }
    }

    // ======================================================================
    // TITLE
    // ======================================================================
    public sealed class TitleScreen : ScreenBase
    {
        Text _press;
        RectTransform _menu;
        RectTransform _logo;
        readonly MenuNavigator _nav = new MenuNavigator();
        bool _started;
        float _t;
        SettingsPanel _settings;

        public static TitleScreen Create(Transform canvas, SettingsPanel settings)
        {
            var go = new GameObject("TitleScreen");
            go.transform.SetParent(canvas, false);
            var s = go.AddComponent<TitleScreen>();
            s._settings = settings;
            s.Build(canvas);
            return s;
        }

        void Build(Transform canvas)
        {
            InitRoot(canvas, "Title");
            var vignette = UIKit.Img(Root, "Vignette", UIKit.GradV, new Color(0.02f, 0.0f, 0.08f, 0.85f));
            vignette.rectTransform.Stretch();
            vignette.rectTransform.localScale = new Vector3(1, -1, 1);

            // key art: Jin (left) and Ray (right), cut out from the concept illustration
            UIKit.Art(Root, "art_jin_menu", new Vector2(0, 0), new Vector2(0, 0), new Vector2(-40, 60), 860);
            UIKit.Art(Root, "art_ray_menu", new Vector2(1, 0), new Vector2(1, 0), new Vector2(60, 60), 820);

            _logo = UIKit.Node("Logo", Root).Place(new Vector2(0.5f, 0.68f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(1500, 360));
            var glow = UIKit.Img(_logo, "Glow", UIKit.Glow, Palette.Muscle.WithAlpha(0.55f));
            glow.rectTransform.Stretch(-120);
            var slash = UIKit.Img(_logo, "Slash", UIKit.Para, new Color(0.55f, 0.03f, 0.1f, 0.85f));
            slash.rectTransform.Place(new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0, -8), new Vector2(1500, 120));
            var title = UIKit.Label(_logo, "MUSCLE BATTLE", 190, Color.white, TextAnchor.MiddleCenter, true, true, true);
            title.rectTransform.Stretch();
            title.rectTransform.offsetMin = new Vector2(0, 60);
            var sub = UIKit.Label(_logo, "A R C A D E   F I G H T I N G   G A M E", 34, Palette.Bone);
            sub.rectTransform.Place(new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0, 40), new Vector2(1200, 50));
            var tag = UIKit.Label(Root, "싸우다 보면 근육을 외우게 되는 3D 대전격투게임", 34, Palette.Nerve);
            tag.rectTransform.Place(new Vector2(0.5f, 0.68f), new Vector2(0.5f, 1), new Vector2(0, -190), new Vector2(1400, 50));

            _press = UIKit.Label(Root, QualityProfile.IsTouchDevice ? "화면을 터치하세요  ·  TAP TO START" : "PRESS ANY BUTTON  ·  아무 키나 누르세요", 44, Color.white);
            _press.rectTransform.Place(new Vector2(0.5f, 0.24f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(1400, 70));

            _menu = UIKit.Node("Menu", Root).Place(new Vector2(0.5f, 0.3f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(800, 420));
            var b1 = MBButton.Create(_menu, "아케이드  ·  1P VS CPU", "CPU 파이터와 대전", Palette.Muscle, new Vector2(0.5f, 1), new Vector2(0, -50), new Vector2(720, 96), 40);
            b1.OnClick = () => GameModeManager.Instance.GoToSelect(false);
            var b2 = MBButton.Create(_menu, "VS 대전  ·  2P LOCAL", "같은 화면에서 친구와 대결", Palette.P2, new Vector2(0.5f, 1), new Vector2(0, -160), new Vector2(720, 96), 40);
            b2.OnClick = () => GameModeManager.Instance.GoToSelect(true);
            var b3 = MBButton.Create(_menu, "트레이닝  ·  TRAINING LAB", "다음 단계에서 구현 예정", Palette.Mastery, new Vector2(0.5f, 1), new Vector2(0, -270), new Vector2(720, 96), 40);
            b3.Interactable = false;
            var b4 = MBButton.Create(_menu, "설정  ·  SETTINGS", null, Palette.TextDim, new Vector2(0.5f, 1), new Vector2(0, -370), new Vector2(720, 80), 34);
            b4.OnClick = () => _settings.Open();
            _nav.Add(b1);
            _nav.Add(b2);
            _nav.Add(b3);
            _nav.Add(b4);

            ControlsBar(Root, "이동  W A S D / 방향키 / 스틱      결정  J · Enter · Ⓐ      뒤로  K · Esc · Ⓑ      v0.1 Vertical Slice");
        }

        public override void Show()
        {
            base.Show();
            _started = false;
            _menu.gameObject.SetActive(false);
            _press.gameObject.SetActive(true);
            _t = 0;
        }

        public void ShowMenuDirect()
        {
            _started = true;
            _press.gameObject.SetActive(false);
            _menu.gameObject.SetActive(true);
            _nav.Focus(0);
        }

        void Update()
        {
            if (!Visible) return;
            _t += Time.unscaledDeltaTime;
            float pulse = 1f + Mathf.Sin(_t * 2.2f) * 0.015f;
            _logo.localScale = new Vector3(pulse, pulse, 1);

            // slow orbit around the posing fighters
            float a = _t * 0.12f;
            var look = new Vector3(0, 1.3f, 0);
            CameraManager.Instance?.SetFree(look + new Vector3(Mathf.Sin(a) * 6.5f, 0.6f, -Mathf.Cos(a) * 6.5f), look + Vector3.up * 0.6f, 40f);

            if (_settings.IsOpen) return;
            if (!_started)
            {
                _press.SetAlpha(0.45f + 0.55f * Mathf.Abs(Mathf.Sin(_t * 3f)));
                if (MenuInput.AnyStart() && _t > 0.3f)
                {
                    // first gesture also unlocks WebAudio in Safari
                    AudioManager.Instance?.PlaySfx("ui_confirm");
                    AudioManager.Instance?.Announce("title");
                    AudioManager.Instance?.PlayBgm("menu", true);
                    ShowMenuDirect();
                }
                return;
            }
            _nav.Update();
        }
    }

    // ======================================================================
    // SETTINGS
    // ======================================================================
    public sealed class SettingsPanel : ScreenBase
    {
        readonly MenuNavigator _nav = new MenuNavigator();
        MBButton _quality, _shake, _music, _sfx, _cpu, _time, _touch;
        public bool IsOpen => Visible;

        public static SettingsPanel Create(Transform canvas)
        {
            var go = new GameObject("Settings");
            go.transform.SetParent(canvas, false);
            var s = go.AddComponent<SettingsPanel>();
            s.Build(canvas);
            s.Hide();
            return s;
        }

        void Build(Transform canvas)
        {
            InitRoot(canvas, "SettingsPanel");
            var dim = UIKit.Img(Root, "Dim", UIKit.White, new Color(0, 0, 0, 0.6f), true);
            dim.rectTransform.Stretch();
            var panel = UIKit.Panel(Root, "Panel", Palette.Mastery);
            panel.Place(new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(900, 900));
            UIKit.SlantPlate(panel, "설정  ·  SETTINGS", 40, new Color(0.3f, 0.1f, 0.5f), Color.white, new Vector2(0.5f, 1), new Vector2(0, 0), new Vector2(560, 70));
            float y = -110;
            MBButton Row(System.Action click)
            {
                var b = MBButton.Create(panel, "", null, Palette.Nerve, new Vector2(0.5f, 1), new Vector2(0, y), new Vector2(760, 84), 32);
                b.OnClick = () => { click(); Refresh(); GameSettings.Save(); };
                _nav.Add(b);
                y -= 98;
                return b;
            }
            _quality = Row(() =>
            {
                var next = QualityProfile.Current.Tier == QualityTier.PcHigh ? QualityTier.WebIPad : QualityTier.PcHigh;
                QualityProfile.Apply(next);
                QualityProfile.Save(next);
            });
            _shake = Row(() => GameSettings.CameraShake = GameSettings.CameraShake >= 1.4f ? 0f : GameSettings.CameraShake + 0.5f);
            _music = Row(() => GameSettings.MusicVolume = GameSettings.MusicVolume >= 0.95f ? 0f : Mathf.Min(1f, GameSettings.MusicVolume + 0.25f));
            _sfx = Row(() => GameSettings.SfxVolume = GameSettings.SfxVolume >= 0.95f ? 0f : Mathf.Min(1f, GameSettings.SfxVolume + 0.25f));
            _cpu = Row(() => GameSettings.Difficulty = (CpuDifficulty)(((int)GameSettings.Difficulty + 1) % 3));
            _time = Row(() => GameSettings.RoundTime = GameSettings.RoundTime == 60 ? 99 : GameSettings.RoundTime == 99 ? 45 : 60);
            _touch = Row(() => GameSettings.ForceTouchControls = !GameSettings.ForceTouchControls);
            var close = MBButton.Create(panel, "닫기  ·  CLOSE", null, Palette.Muscle, new Vector2(0.5f, 0), new Vector2(0, 60), new Vector2(420, 80), 32);
            close.OnClick = Close;
            _nav.Add(close);
            Refresh();
        }

        void Refresh()
        {
            _quality.Label.text = "그래픽 품질 :  " + (QualityProfile.Current.Tier == QualityTier.PcHigh ? "PC HIGH" : "WEB / iPad");
            _shake.Label.text = "화면 흔들림 :  " + Mathf.RoundToInt(GameSettings.CameraShake * 100) + "%";
            _music.Label.text = "음악 볼륨 :  " + Mathf.RoundToInt(GameSettings.MusicVolume * 100) + "%";
            _sfx.Label.text = "효과음 볼륨 :  " + Mathf.RoundToInt(GameSettings.SfxVolume * 100) + "%";
            _cpu.Label.text = "CPU 난이도 :  " + GameSettings.Difficulty switch { CpuDifficulty.Easy => "쉬움", CpuDifficulty.Normal => "보통", _ => "어려움" };
            _time.Label.text = "제한 시간 :  " + GameSettings.RoundTime + "초";
            _touch.Label.text = "터치 컨트롤 :  " + (GameSettings.ForceTouchControls ? "항상 표시" : "자동 (터치 기기)");
        }

        public void Open()
        {
            Show();
            Root.SetAsLastSibling();
            Refresh();
            _nav.Focus(0);
        }

        public void Close()
        {
            GameSettings.Save();
            AudioManager.Instance?.PlaySfx("ui_back");
            Hide();
        }

        void Update()
        {
            if (!Visible) return;
            if (MenuInput.Back(-1)) { Close(); return; }
            _nav.Update();
        }
    }

    // ======================================================================
    // PAUSE
    // ======================================================================
    public sealed class PauseMenu : ScreenBase
    {
        readonly MenuNavigator _nav = new MenuNavigator();

        public static PauseMenu Create(Transform canvas)
        {
            var go = new GameObject("Pause");
            go.transform.SetParent(canvas, false);
            var p = go.AddComponent<PauseMenu>();
            p.Build(canvas);
            p.Hide();
            return p;
        }

        void Build(Transform canvas)
        {
            InitRoot(canvas, "PauseMenu");
            var dim = UIKit.Img(Root, "Dim", UIKit.White, new Color(0.02f, 0, 0.06f, 0.7f), true);
            dim.rectTransform.Stretch();
            UIKit.SlantPlate(Root, "PAUSE  ·  일시정지", 56, new Color(0.45f, 0.05f, 0.12f), Color.white, new Vector2(0.5f, 0.8f), Vector2.zero, new Vector2(700, 100));
            var resume = MBButton.Create(Root, "계속하기  ·  RESUME", null, Palette.Nerve, new Vector2(0.5f, 0.6f), Vector2.zero, new Vector2(640, 90), 36);
            resume.OnClick = () => GameModeManager.Instance.SetPaused(false);
            var select = MBButton.Create(Root, "캐릭터 선택", null, Palette.Mastery, new Vector2(0.5f, 0.6f), new Vector2(0, -110), new Vector2(640, 90), 36);
            select.OnClick = () => { GameModeManager.Instance.SetPaused(false); GameModeManager.Instance.GoToSelect(GameModeManager.Instance.IsTwoPlayer); };
            var title = MBButton.Create(Root, "메인 메뉴", null, Palette.TextDim, new Vector2(0.5f, 0.6f), new Vector2(0, -220), new Vector2(640, 90), 36);
            title.OnClick = () => { GameModeManager.Instance.SetPaused(false); GameModeManager.Instance.GoToTitle(); };
            _nav.Add(resume);
            _nav.Add(select);
            _nav.Add(title);

            var help = UIKit.Label(Root,
                "<b>1P 키보드</b>  이동 WASD · 약 J · 강 K · 킥 L · 가드 Shift/H · 회피 Space · 잡기 U · 카운터 O · 스페셜 I · 얼티밋 I+K\n" +
                "<b>2P 키보드</b>  방향키 · 약 1/, · 강 2/. · 킥 3// · 가드 0/RShift · 회피 Enter/RCtrl · 잡기 4/; · 카운터 6/P · 스페셜 5/'\n" +
                "<b>게임패드</b>  X 약 · Y 강 · A 킥 · B 회피 · LB 가드 · RB 스페셜 · X+A 잡기 · LB+Y 카운터 · RB+Y 얼티밋\n" +
                "<b>콤보</b>  약→약→약 / 약→강 / 킥→킥(런처)→공중 콤보 · 뒤+킥 = 런처 · 히트 중 스페셜 캔슬 가능",
                22, Palette.TextDim, TextAnchor.MiddleCenter, false);
            help.lineSpacing = 1.3f;
            help.rectTransform.Place(new Vector2(0.5f, 0.12f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(1700, 200));
        }

        public override void Show()
        {
            base.Show();
            Root.SetAsLastSibling();
            _nav.Focus(0);
        }

        void Update()
        {
            if (!Visible) return;
            _nav.Update();
        }
    }
}
