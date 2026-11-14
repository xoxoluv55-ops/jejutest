// NERVE RUNNER - all screens, built in code (no prefabs), iPad landscape first.
// Reference resolution 1600x1000, scaled to fit; every screen sits inside the device safe area.
using System;
using System.Collections.Generic;
using NerveRunner.Core;
using UnityEngine;
using UnityEngine.UI;

namespace NerveRunner
{
    public enum UIScreen { Title, StageSelect, Codex, WrongNotes, Settings, Hud, Result }

    public partial class GameUI
    {
        public Canvas canvas;
        RectTransform safe;
        readonly Dictionary<UIScreen, GameObject> screens = new Dictionary<UIScreen, GameObject>();

        // data + callbacks (set by GameRoot)
        public SaveData save;
        public QuestionBank bank;
        public CodexEntry[] codex;
        public Action onStartStage, onSaveChanged, onQuit, onResume, onRestart;

        public static readonly string[] ChapterTitles =
        {
            "뉴런과 신경신호", "척수와 반사", "감각 오름로·운동 내림로", "뇌줄기", "소뇌",
            "사이뇌", "대뇌", "12뇌신경", "임상 챌린지 (NULL)"
        };

        public void Build(Transform parent)
        {
            var go = new GameObject("UI", typeof(RectTransform));
            go.transform.SetParent(parent, false);
            canvas = go.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 10;
            var scaler = go.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1600f, 1000f);
            scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.MatchWidthOrHeight;
            scaler.matchWidthOrHeight = 0.5f;
            go.AddComponent<GraphicRaycaster>();

            safe = UIKit.Rect(go.transform, "SafeArea");
            UIKit.Fill(safe);
            ApplySafeArea();

            BuildTitle();
            BuildStageSelect();
            BuildCodex();
            BuildWrongNotes();
            BuildSettings();
            BuildHud();
            BuildResult();
            BuildMinigame();
            Show(UIScreen.Title);
        }

        Rect lastSafe;
        public void ApplySafeArea()
        {
            Rect r = UnityEngine.Screen.safeArea;
            if (r == lastSafe || UnityEngine.Screen.width <= 0) return;
            lastSafe = r;
            Vector2 min = r.position, max = r.position + r.size;
            min.x /= UnityEngine.Screen.width; min.y /= UnityEngine.Screen.height;
            max.x /= UnityEngine.Screen.width; max.y /= UnityEngine.Screen.height;
            safe.anchorMin = min; safe.anchorMax = max;
            safe.offsetMin = safe.offsetMax = Vector2.zero;
        }

        GameObject NewScreen(UIScreen s)
        {
            var rt = UIKit.Rect(safe, "Screen_" + s);
            UIKit.Fill(rt);
            screens[s] = rt.gameObject;
            return rt.gameObject;
        }

        public void Show(UIScreen s)
        {
            foreach (var kv in screens) kv.Value.SetActive(kv.Key == s);
            if (s == UIScreen.StageSelect) RefreshStageSelect();
            if (s == UIScreen.Codex) RefreshCodex();
            if (s == UIScreen.WrongNotes) { notePage = 0; RefreshNotes(); }
            if (s == UIScreen.Settings) RefreshSettings();
            if (s != UIScreen.Hud) { HidePause(); minigameRoot.SetActive(false); }
        }

        Text Title(Transform p, string text, string sub = null)
        {
            var t = UIKit.Label(p, text, 54, Pal.Text, TextAnchor.MiddleLeft, new Vector2(0f, 1f), new Vector2(1100f, 80f), new Vector2(60f, -30f));
            t.fontStyle = FontStyle.Bold;
            UIKit.Neon(t, Pal.Purple, 3f);
            if (sub != null) UIKit.Label(p, sub, 26, Pal.Dim, TextAnchor.MiddleLeft, new Vector2(0f, 1f), new Vector2(1100f, 40f), new Vector2(64f, -104f));
            return t;
        }

        void BackButton(Transform p)
        {
            UIKit.Button(p, "◀ 뒤로", Pal.A(Pal.Card, 0.95f), Pal.Text, 28, () => Show(UIScreen.Title),
                         new Vector2(1f, 1f), new Vector2(170f, 70f), new Vector2(-40f, -36f));
        }

        //================== TITLE ==================\\
        void BuildTitle()
        {
            var p = NewScreen(UIScreen.Title).transform;
            var logo = UIKit.Label(p, "<i>NERVE RUNNER</i>", 120, Pal.Text, TextAnchor.MiddleLeft, new Vector2(0f, 1f), new Vector2(1200f, 150f), new Vector2(60f, -60f));
            logo.fontStyle = FontStyle.Bold;
            UIKit.Neon(logo, Pal.Purple, 5f);
            var sub = UIKit.Label(p, "신경계 학습 레이싱 · 신경계의 마지막 신호", 34, Pal.Yellow, TextAnchor.MiddleLeft, new Vector2(0f, 1f), new Vector2(1000f, 50f), new Vector2(70f, -210f));
            UIKit.Neon(sub, Pal.A(Color.black, 0.6f), 2f);

            string[] labels = { "▶  게임 시작", "스테이지 선택", "신경 도감", "학습 노트 (오답)", "설정" };
            Action[] acts = {
                () => { if (onStartStage != null) onStartStage(); },
                () => Show(UIScreen.StageSelect), () => Show(UIScreen.Codex), () => Show(UIScreen.WrongNotes), () => Show(UIScreen.Settings) };
            for (int i = 0; i < labels.Length; i++)
            {
                bool primary = i == 0;
                var b = UIKit.Button(p, labels[i], primary ? Pal.Yellow : Pal.Panel, primary ? Pal.Dark : Pal.Text, primary ? 40 : 32, acts[i],
                                     new Vector2(0f, 0f), new Vector2(primary ? 420f : 380f, primary ? 96f : 76f), new Vector2(70f, 470f - i * 92f - (primary ? 0f : 20f)));
                if (!primary) UIKit.Neon(b.targetGraphic, Pal.A(Pal.Purple, 0.8f), 2f);
            }
            UIKit.Label(p, "iPad 가로 화면 · 화면 버튼 / 키보드(←→ 조향, Space 점프, Z 드리프트, Shift 부스터)", 22, Pal.Dim,
                        TextAnchor.LowerLeft, new Vector2(0f, 0f), new Vector2(1300f, 40f), new Vector2(70f, 24f));
        }

        //================== STAGE SELECT ==================\\
        Text ch1Info;
        void BuildStageSelect()
        {
            var p = NewScreen(UIScreen.StageSelect).transform;
            Title(p, "스테이지 선택", "STAR-01의 여정 - 손상된 신경 경로를 순서대로 복구하세요");
            BackButton(p);
            for (int i = 0; i < 9; i++)
            {
                int col = i % 5, row = i / 5;
                var card = UIKit.Panel(p, i == 0 ? Pal.Card : Pal.CardLocked, new Vector2(0f, 1f), new Vector2(250f, 300f),
                                       new Vector2(60f + col * 262f, -170f - row * 330f));
                UIKit.Neon(card, i == 0 ? Pal.Yellow : Pal.A(Pal.Purple, 0.5f), 3f);
                UIKit.Label(card.transform, "CH." + (i + 1), 40, i == 0 ? Pal.Yellow : Pal.Dim, TextAnchor.UpperCenter, new Vector2(0.5f, 1f), new Vector2(230f, 56f), new Vector2(0f, -14f)).fontStyle = FontStyle.Bold;
                var name = UIKit.FitLabel(card.transform, ChapterTitles[i], 30, 18, Pal.Text);
                UIKit.Place(name.rectTransform, new Vector2(0.5f, 1f), new Vector2(226f, 90f), new Vector2(0f, -76f));
                if (i == 0)
                {
                    ch1Info = UIKit.Label(card.transform, "", 24, Pal.Dim, TextAnchor.MiddleCenter, new Vector2(0.5f, 0f), new Vector2(250f, 60f), new Vector2(0f, 96f));
                    UIKit.Button(card.transform, "출발!", Pal.Yellow, Pal.Dark, 32, () => { if (onStartStage != null) onStartStage(); },
                                 new Vector2(0.5f, 0f), new Vector2(200f, 70f), new Vector2(0f, 18f));
                }
                else
                {
                    UIKit.Label(card.transform, "잠김 · 개발 예정", 24, Pal.Dim, TextAnchor.MiddleCenter, new Vector2(0.5f, 0f), new Vector2(250f, 60f), new Vector2(0f, 40f));
                }
            }
        }

        void RefreshStageSelect()
        {
            var r = save.Stage(Chapter1Layout.StageId);
            string stars = new string('★', r.bestStars) + new string('☆', 3 - r.bestStars);
            ch1Info.text = stars + "\n" + (r.bestTime > 0f ? "최고 " + FormatTime(r.bestTime) : "기록 없음");
        }

        //================== CODEX ==================\\
        Text codexName, codexBody;
        Button[] codexBtns;
        void BuildCodex()
        {
            var p = NewScreen(UIScreen.Codex).transform;
            Title(p, "신경 도감", "레이스에서 만난 구조가 등록됩니다");
            BackButton(p);
            int n = codex != null ? codex.Length : 0;
            codexBtns = new Button[n];
            for (int i = 0; i < n; i++)
            {
                int idx = i;
                int col = i % 3, row = i / 3;
                codexBtns[i] = UIKit.Button(p, "", Pal.Card, Pal.Text, 26, () => ShowCodexEntry(idx),
                                            new Vector2(0f, 1f), new Vector2(220f, 66f), new Vector2(60f + col * 230f, -160f - row * 76f));
            }
            var detail = UIKit.Panel(p, Pal.Panel, new Vector2(1f, 1f), new Vector2(600f, 720f), new Vector2(-40f, -160f));
            UIKit.Neon(detail, Pal.Cyan, 2f);
            codexName = UIKit.Label(detail.transform, "", 44, Pal.Yellow, TextAnchor.UpperLeft, new Vector2(0f, 1f), new Vector2(540f, 130f), new Vector2(30f, -24f));
            codexBody = UIKit.Label(detail.transform, "", 30, Pal.Text, TextAnchor.UpperLeft, new Vector2(0f, 1f), new Vector2(540f, 540f), new Vector2(30f, -160f));
        }

        void RefreshCodex()
        {
            for (int i = 0; i < codexBtns.Length; i++)
            {
                bool open = save.codexUnlocked.Contains(codex[i].id);
                UIKit.ButtonText(codexBtns[i]).text = open ? codex[i].name : "???";
                codexBtns[i].targetGraphic.color = open ? Pal.Card : Pal.CardLocked;
            }
            codexName.text = "도감 " + save.codexUnlocked.Count + " / " + codexBtns.Length;
            codexBody.text = "항목을 선택하세요.\n\n아직 만나지 않은 구조는 ??? 로 표시됩니다. CHAPTER 1을 달리며 모두 등록해 보세요!";
        }

        void ShowCodexEntry(int i)
        {
            var e = codex[i];
            if (!save.codexUnlocked.Contains(e.id))
            {
                codexName.text = "???";
                codexBody.text = "아직 발견하지 못한 구조입니다.\n\n힌트: " + e.gameLink;
                return;
            }
            codexName.text = e.name + "\n<size=28><color=#B8B2E6>" + e.english + " · " + e.category + "</color></size>";
            codexBody.text = e.description + "\n\n<color=#2EE6D6>게임 속 위치:</color> " + e.gameLink;
        }

        //================== WRONG NOTES ==================\\
        int notePage;
        Text noteHeader, noteQ, noteMine, noteExplain, notePageLbl;
        Button[] noteRetry = new Button[3];
        Button notePrev, noteNext;
        void BuildWrongNotes()
        {
            var p = NewScreen(UIScreen.WrongNotes).transform;
            Title(p, "학습 노트 (오답노트)", "틀린 문제는 자동 저장됩니다. 다시 풀어서 해결하세요!");
            BackButton(p);
            var card = UIKit.Panel(p, Pal.Panel, new Vector2(0.5f, 0.5f), new Vector2(1280f, 700f), new Vector2(0f, -60f));
            card.rectTransform.pivot = new Vector2(0.5f, 0.5f);
            UIKit.Neon(card, Pal.Red, 2f);
            var c = card.transform;
            noteHeader = UIKit.Label(c, "", 26, Pal.Dim, TextAnchor.UpperLeft, new Vector2(0f, 1f), new Vector2(1240f, 40f), new Vector2(30f, -20f));
            noteQ = UIKit.Label(c, "", 36, Pal.Text, TextAnchor.UpperLeft, new Vector2(0f, 1f), new Vector2(1240f, 110f), new Vector2(30f, -66f));
            noteMine = UIKit.Label(c, "", 28, Pal.Red, TextAnchor.UpperLeft, new Vector2(0f, 1f), new Vector2(1240f, 44f), new Vector2(30f, -180f));
            for (int i = 0; i < 3; i++)
            {
                int idx = i;
                noteRetry[i] = UIKit.Button(c, "", Pal.Card, Pal.Text, 28, () => RetryNote(idx),
                                            new Vector2(0f, 1f), new Vector2(390f, 90f), new Vector2(30f + i * 410f, -236f));
            }
            noteExplain = UIKit.Label(c, "", 28, Pal.Text, TextAnchor.UpperLeft, new Vector2(0f, 1f), new Vector2(1240f, 300f), new Vector2(30f, -346f));
            notePrev = UIKit.Button(c, "◀ 이전", Pal.Card, Pal.Text, 28, () => { notePage--; RefreshNotes(); }, new Vector2(0f, 0f), new Vector2(180f, 64f), new Vector2(30f, 20f));
            noteNext = UIKit.Button(c, "다음 ▶", Pal.Card, Pal.Text, 28, () => { notePage++; RefreshNotes(); }, new Vector2(1f, 0f), new Vector2(180f, 64f), new Vector2(-30f, 20f));
            notePageLbl = UIKit.Label(c, "", 26, Pal.Dim, TextAnchor.MiddleCenter, new Vector2(0.5f, 0f), new Vector2(400f, 64f), new Vector2(-200f, 20f));
        }

        List<WrongNote> ActiveNotes()
        {
            var l = new List<WrongNote>();
            foreach (var n in save.wrongNotes) if (bank.Get(n.questionId) != null) l.Add(n);
            l.Sort((a, b) => a.resolved.CompareTo(b.resolved));
            return l;
        }

        void RefreshNotes()
        {
            var notes = ActiveNotes();
            bool any = notes.Count > 0;
            notePage = Mathf.Clamp(notePage, 0, Mathf.Max(0, notes.Count - 1));
            notePrev.gameObject.SetActive(any && notePage > 0);
            noteNext.gameObject.SetActive(any && notePage < notes.Count - 1);
            if (!any)
            {
                noteHeader.text = ""; noteMine.text = "";
                noteQ.text = "아직 저장된 오답이 없어요!";
                noteExplain.text = "레이스 중 갈림길·게이트·시냅스 미니게임에서 틀린 문제가 이곳에 자동으로 모입니다.";
                notePageLbl.text = "";
                foreach (var b in noteRetry) b.gameObject.SetActive(false);
                return;
            }
            var n = notes[notePage];
            var q = bank.Get(n.questionId);
            noteHeader.text = "[" + q.topic + " · " + q.difficulty + "]  틀린 횟수 " + n.wrongCount + " · 재도전 " + n.retryCount +
                              (n.resolved ? "  <color=#5CFF9D>○ 해결됨</color>" : "  <color=#FF4D6D>미해결</color>");
            noteQ.text = q.question;
            bool isOrder = q.id == Chapter1Layout.Q_SYN_ORDER;
            noteMine.text = isOrder ? "순서 맞추기에서 실수가 있었어요." : "내가 고른 답: " + SafeOpt(q, n.chosen);
            for (int i = 0; i < noteRetry.Length; i++)
            {
                bool show = !isOrder && i < q.options.Length;
                noteRetry[i].gameObject.SetActive(show);
                if (show)
                {
                    UIKit.ButtonText(noteRetry[i]).text = (char)('A' + i) + ". " + q.options[i];
                    noteRetry[i].targetGraphic.color = Pal.Card;
                    noteRetry[i].interactable = true;
                }
            }
            noteExplain.text = isOrder ? "<color=#2EE6D6>정답 순서:</color> " + string.Join(" → ", q.options) + "\n\n" + q.explanation
                                       : "다시 풀어 보세요! 선택하면 해설이 표시됩니다.";
            notePageLbl.text = (notePage + 1) + " / " + notes.Count;
        }

        static string SafeOpt(Question q, int i) { return i >= 0 && i < q.options.Length ? q.options[i] : "-"; }

        void RetryNote(int option)
        {
            var notes = ActiveNotes();
            if (notePage >= notes.Count) return;
            var n = notes[notePage];
            var q = bank.Get(n.questionId);
            bool ok = option == q.answer;
            n.retryCount++;
            if (ok) n.resolved = true; else { n.wrongCount++; n.chosen = option; }
            for (int i = 0; i < q.options.Length && i < noteRetry.Length; i++)
            {
                noteRetry[i].targetGraphic.color = i == q.answer ? Pal.Hex(0x13806F) : (i == option ? Pal.Hex(0x8A1A33) : Pal.Card);
                noteRetry[i].interactable = false;
            }
            string extra = ok ? "" : q.WrongExplanation(option);
            noteExplain.text = (ok ? "<color=#5CFF9D>정답!</color> " : "<color=#FF4D6D>아쉬워요.</color> ") + q.explanation +
                               (extra.Length > 0 ? "\n<color=#FFB627>오답 해설:</color> " + extra : "");
            if (ok) GameAudio.Chime(); else GameAudio.Thud();
            if (onSaveChanged != null) onSaveChanged();
        }

        //================== SETTINGS ==================\\
        Text sfxLbl, musicLbl, hintLbl, sensLbl, resetLbl;
        bool resetArmed;
        void BuildSettings()
        {
            var p = NewScreen(UIScreen.Settings).transform;
            Title(p, "설정");
            BackButton(p);
            float y = -190f;
            sfxLbl = SettingRow(p, "효과음", ref y, () => { save.sfxOn = !save.sfxOn; Changed(); });
            musicLbl = SettingRow(p, "배경음악", ref y, () => { save.musicOn = !save.musicOn; Changed(); });
            hintLbl = SettingRow(p, "조작 힌트 표시", ref y, () => { save.showHints = !save.showHints; Changed(); });
            sensLbl = SettingRow(p, "조향 감도", ref y, () =>
            {
                save.steerSensitivity = save.steerSensitivity >= 1.29f ? 0.7f : save.steerSensitivity + 0.15f;
                Changed();
            });
            resetLbl = SettingRow(p, "학습 기록 초기화", ref y, () =>
            {
                if (!resetArmed) { resetArmed = true; RefreshSettings(); return; }
                resetArmed = false;
                var keep = save;
                keep.stages.Clear(); keep.wrongNotes.Clear(); keep.mastery.Clear(); keep.codexUnlocked.Clear(); keep.totalCoins = 0; keep.storySeen = false;
                Changed();
            });
            UIKit.Label(p, "NERVE RUNNER v0.1 (CHAPTER 1 프로토타입)\n레이싱 기반 코드: Neon Racer by Pinchas Vaknin (MIT License)", 22, Pal.Dim,
                        TextAnchor.LowerLeft, new Vector2(0f, 0f), new Vector2(1200f, 80f), new Vector2(64f, 24f));
        }

        Text SettingRow(Transform p, string name, ref float y, Action toggle)
        {
            var row = UIKit.Panel(p, Pal.Panel, new Vector2(0f, 1f), new Vector2(900f, 90f), new Vector2(60f, y));
            UIKit.Label(row.transform, name, 32, Pal.Text, TextAnchor.MiddleLeft, new Vector2(0f, 0.5f), new Vector2(500f, 80f), new Vector2(30f, 0f)).rectTransform.pivot = new Vector2(0f, 0.5f);
            var b = UIKit.Button(row.transform, "", Pal.Card, Pal.Yellow, 30, toggle, new Vector2(1f, 0.5f), new Vector2(300f, 70f), new Vector2(-12f, 0f));
            ((RectTransform)b.transform).pivot = new Vector2(1f, 0.5f);
            y -= 106f;
            return UIKit.ButtonText(b);
        }

        void Changed() { if (onSaveChanged != null) onSaveChanged(); RefreshSettings(); }

        void RefreshSettings()
        {
            sfxLbl.text = save.sfxOn ? "켜짐" : "꺼짐";
            musicLbl.text = save.musicOn ? "켜짐" : "꺼짐";
            hintLbl.text = save.showHints ? "켜짐" : "꺼짐";
            sensLbl.text = "x" + save.steerSensitivity.ToString("0.00");
            resetLbl.text = resetArmed ? "한 번 더 눌러 확인" : "초기화";
        }

        //================== RESULT ==================\\
        Text resTitle, resStars, resStats, resLearn;
        void BuildResult()
        {
            var p = NewScreen(UIScreen.Result).transform;
            resTitle = UIKit.Label(p, "", 80, Pal.Yellow, TextAnchor.MiddleCenter, new Vector2(0.5f, 1f), new Vector2(1200f, 110f), new Vector2(0f, -30f));
            resTitle.fontStyle = FontStyle.Bold;
            UIKit.Neon(resTitle, Pal.Gold, 4f);
            resStars = UIKit.Label(p, "", 90, Pal.Yellow, TextAnchor.MiddleCenter, new Vector2(0.5f, 1f), new Vector2(600f, 110f), new Vector2(0f, -140f));
            var left = UIKit.Panel(p, Pal.Panel, new Vector2(0.5f, 1f), new Vector2(660f, 520f), new Vector2(-340f, -270f));
            UIKit.Neon(left, Pal.Cyan, 2f);
            resStats = UIKit.Label(left.transform, "", 30, Pal.Text, TextAnchor.UpperLeft, new Vector2(0f, 1f), new Vector2(600f, 480f), new Vector2(30f, -24f));
            var right = UIKit.Panel(p, Pal.Panel, new Vector2(0.5f, 1f), new Vector2(600f, 520f), new Vector2(330f, -270f));
            UIKit.Neon(right, Pal.Purple, 2f);
            resLearn = UIKit.Label(right.transform, "", 30, Pal.Text, TextAnchor.UpperLeft, new Vector2(0f, 1f), new Vector2(550f, 480f), new Vector2(26f, -24f));
            UIKit.Button(p, "다시 도전", Pal.Card, Pal.Text, 32, () => { if (onRestart != null) onRestart(); }, new Vector2(0.5f, 0f), new Vector2(300f, 86f), new Vector2(-330f, 40f));
            UIKit.Button(p, "오답노트", Pal.Card, Pal.Text, 32, () => Show(UIScreen.WrongNotes), new Vector2(0.5f, 0f), new Vector2(300f, 86f), new Vector2(0f, 40f));
            UIKit.Button(p, "메인 메뉴 ▶", Pal.Yellow, Pal.Dark, 32, () => { if (onQuit != null) onQuit(); }, new Vector2(0.5f, 0f), new Vector2(300f, 86f), new Vector2(330f, 40f));
        }

        public struct ResultInfo
        {
            public float time, par, accuracy; public int stars, coins, correct, total, ringsHit, ringsTotal, ringBest, wrongSaved;
            public bool newBest; public List<string> learned, toReview;
        }

        public void ShowResult(ResultInfo r)
        {
            Show(UIScreen.Result);
            resTitle.text = "CH.1 클리어!";
            resStars.text = new string('★', r.stars) + "<color=#4B4380>" + new string('★', 3 - r.stars) + "</color>";
            resStats.text =
                "<color=#2EE6D6>레이스 기록</color>   " + FormatTime(r.time) + (r.newBest ? "  <color=#FFD34D>NEW!</color>" : "") +
                "\n<size=24><color=#B8B2E6>목표 " + FormatTime(r.par) + "</color></size>" +
                "\n\n<color=#2EE6D6>정답률</color>   " + Mathf.RoundToInt(r.accuracy * 100f) + "%  (" + r.correct + "/" + r.total + ")" +
                "\n<color=#2EE6D6>획득 신호 에너지</color>   ★ +" + r.coins +
                "\n<color=#2EE6D6>랑비에 결절 통과</color>   " + r.ringsHit + "/" + r.ringsTotal + " (최대 연속 " + r.ringBest + ")" +
                "\n\n<size=24><color=#B8B2E6>★1 완주 · ★2 정답률 80% 이상 · ★3 목표 시간 이내</color></size>";
            var sb = new System.Text.StringBuilder();
            sb.Append("<color=#FFD34D>학습 완료!</color>\n");
            foreach (var l in r.learned) sb.Append("<color=#5CFF9D>○</color> ").Append(l).Append('\n');
            foreach (var l in r.toReview) sb.Append("<color=#FF4D6D>×</color> ").Append(l).Append(" <size=22>(복습 필요)</size>\n");
            if (r.wrongSaved > 0) sb.Append("\n<color=#FFB627>오답 ").Append(r.wrongSaved).Append("개가 학습 노트에 저장되었습니다.</color>");
            else sb.Append("\n<color=#5CFF9D>오답 없음 - 완벽해요!</color>");
            resLearn.text = sb.ToString();
        }

        public static string FormatTime(float t)
        {
            int m = (int)(t / 60f); float s = t - m * 60f;
            return m.ToString("00") + ":" + s.ToString("00.00");
        }
    }
}
