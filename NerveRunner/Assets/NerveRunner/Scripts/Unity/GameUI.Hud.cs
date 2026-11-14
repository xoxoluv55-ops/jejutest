// NERVE RUNNER - race HUD: timer, progress, energy, question banner, answer/explanation panel,
// toasts, story dialogue, hints, countdown, pause menu and the iPad touch controls.
using System;
using System.Collections.Generic;
using NerveRunner.Core;
using UnityEngine;
using UnityEngine.UI;

namespace NerveRunner
{
    public partial class GameUI
    {
        public RaceInput input = new RaceInput();

        Text hudTime, hudSection, hudCoins, hudAcc, hudSpeed, hudDrift, hudCountdown;
        RectTransform progressFill, energyFill;
        Image energyFillImg;
        GameObject qBanner, answerPanel, storyBox, hintBox, pausePanel, dialogPanel, touchRoot;
        Text qTitle, qText, qOptions, answerTitle, answerText, storySpeaker, storyText, hintText, toastText, dialogSpeaker, dialogText;
        float answerTimer, toastTimer, storyTimer, hintTimer;
        readonly Queue<StoryLine> storyQueue = new Queue<StoryLine>();
        Action dialogDone;
        StoryLine[] dialogLines; int dialogIdx;

        void BuildHud()
        {
            var p = NewScreen(UIScreen.Hud).transform;

            // ---- top-left: time + section ----
            var tl = UIKit.Panel(p, Pal.A(Pal.Panel, 0.75f), new Vector2(0f, 1f), new Vector2(360f, 100f), new Vector2(24f, -20f));
            UIKit.IconImage(tl.transform, Icon.Clock, Pal.Cyan, new Vector2(0f, 1f), new Vector2(44f, 44f), new Vector2(14f, -10f));
            hudTime = UIKit.Label(tl.transform, "00:00.00", 44, Pal.Text, TextAnchor.MiddleLeft, new Vector2(0f, 1f), new Vector2(290f, 54f), new Vector2(64f, -4f));
            hudTime.fontStyle = FontStyle.Bold;
            hudSection = UIKit.FitLabel(tl.transform, "", 24, 16, Pal.Cyan, TextAnchor.MiddleLeft);
            UIKit.Place(hudSection.rectTransform, new Vector2(0f, 0f), new Vector2(330f, 40f), new Vector2(20f, 6f));

            // ---- progress bar ----
            var bar = UIKit.Panel(p, Pal.A(Color.white, 0.12f), new Vector2(0.5f, 1f), new Vector2(400f, 16f), new Vector2(0f, -30f));
            progressFill = UIKit.Panel(bar.transform, Pal.Cyan).rectTransform;
            progressFill.anchorMin = Vector2.zero; progressFill.anchorMax = new Vector2(0f, 1f); progressFill.pivot = new Vector2(0f, 0.5f);
            progressFill.offsetMin = Vector2.zero; progressFill.offsetMax = Vector2.zero;
            UIKit.Label(p, "START", 18, Pal.Dim, TextAnchor.MiddleRight, new Vector2(0.5f, 1f), new Vector2(100f, 30f), new Vector2(-260f, -22f));
            UIKit.Label(p, "GOAL", 18, Pal.Yellow, TextAnchor.MiddleLeft, new Vector2(0.5f, 1f), new Vector2(100f, 30f), new Vector2(260f, -22f));

            // ---- NULL shield bar (boss stage only) ----
            var bb = UIKit.Panel(p, Pal.A(Pal.Hex(0x2A0E46), 0.9f), new Vector2(0.5f, 1f), new Vector2(420f, 40f), new Vector2(0f, -56f));
            UIKit.Neon(bb, Pal.Hex(0xFF4DA6), 2f);
            bossBar = bb.gameObject;
            var bfill = UIKit.Panel(bb.transform, Pal.Hex(0xC04DFF));
            bossFill = bfill.rectTransform;
            bossFill.anchorMin = Vector2.zero; bossFill.anchorMax = Vector2.one; bossFill.pivot = new Vector2(0f, 0.5f);
            bossFill.offsetMin = new Vector2(4f, 4f); bossFill.offsetMax = new Vector2(-4f, -4f);
            bossLabel = UIKit.Label(bb.transform, "NULL 보호막", 20, Color.white, TextAnchor.MiddleCenter);
            UIKit.Fill(bossLabel.rectTransform);
            bossBar.SetActive(false);

            // ---- top-right: coins / accuracy / pause ----
            var tr = UIKit.Panel(p, Pal.A(Pal.Panel, 0.75f), new Vector2(1f, 1f), new Vector2(250f, 100f), new Vector2(-130f, -20f));
            UIKit.IconImage(tr.transform, Icon.Coin, Pal.Gold, new Vector2(0f, 1f), new Vector2(42f, 42f), new Vector2(14f, -8f));
            hudCoins = UIKit.Label(tr.transform, "0", 36, Pal.Yellow, TextAnchor.MiddleLeft, new Vector2(0f, 1f), new Vector2(180f, 50f), new Vector2(62f, -4f));
            hudAcc = UIKit.Label(tr.transform, "정답 0/0", 24, Pal.Text, TextAnchor.MiddleLeft, new Vector2(0f, 0f), new Vector2(220f, 40f), new Vector2(20f, 6f));
            var pauseBtn = UIKit.Button(p, "", Pal.A(Pal.Hex(0x5A4AA8), 0.9f), Pal.Text, 36, () => ShowPause(), new Vector2(1f, 1f), new Vector2(90f, 90f), new Vector2(-24f, -25f));
            ((Image)pauseBtn.targetGraphic).sprite = UIIcons.GlossyCircle;
            UIKit.IconImage(pauseBtn.transform, Icon.Pause, Color.white, new Vector2(0.5f, 0.5f), new Vector2(50f, 50f), Vector2.zero).rectTransform.pivot = new Vector2(0.5f, 0.5f);

            // ---- question banner ----
            var qb = UIKit.Panel(p, Pal.A(Pal.Hex(0x3A2C8C), 0.82f), new Vector2(0.5f, 1f), new Vector2(1060f, 196f), new Vector2(0f, -132f));
            UIKit.Neon(qb, Pal.A(Color.white, 0.55f), 3f);
            qBanner = qb.gameObject;
            qTitle = UIKit.Label(qb.transform, "", 24, Pal.Pink, TextAnchor.UpperLeft, new Vector2(0f, 1f), new Vector2(1020f, 34f), new Vector2(22f, -10f));
            qText = UIKit.FitLabel(qb.transform, "", 32, 22, Pal.Text, TextAnchor.UpperLeft);
            UIKit.Place(qText.rectTransform, new Vector2(0f, 1f), new Vector2(1020f, 84f), new Vector2(22f, -42f));
            qOptions = UIKit.FitLabel(qb.transform, "", 28, 18, Pal.Yellow, TextAnchor.MiddleCenter);
            UIKit.Place(qOptions.rectTransform, new Vector2(0.5f, 0f), new Vector2(1020f, 60f), new Vector2(0f, 6f));
            qBanner.SetActive(false);

            // ---- answer / explanation panel ----
            var ap = UIKit.Panel(p, Pal.A(Pal.Hex(0x0E0A2C), 0.94f), new Vector2(0.5f, 1f), new Vector2(1060f, 220f), new Vector2(0f, -132f));
            answerPanel = ap.gameObject;
            answerTitle = UIKit.Label(ap.transform, "", 40, Pal.Green, TextAnchor.UpperLeft, new Vector2(0f, 1f), new Vector2(1020f, 54f), new Vector2(22f, -10f));
            answerTitle.fontStyle = FontStyle.Bold;
            answerText = UIKit.FitLabel(ap.transform, "", 26, 18, Pal.Text, TextAnchor.UpperLeft);
            UIKit.Place(answerText.rectTransform, new Vector2(0f, 1f), new Vector2(1020f, 150f), new Vector2(22f, -64f));
            answerPanel.SetActive(false);

            // ---- toast ----
            toastText = UIKit.Label(p, "", 54, Pal.Yellow, TextAnchor.MiddleCenter, new Vector2(0.5f, 0.5f), new Vector2(1200f, 90f), new Vector2(0f, 140f));
            toastText.fontStyle = FontStyle.Bold;
            UIKit.Neon(toastText, Pal.A(Color.black, 0.8f), 3f);

            // ---- story box (non-blocking) ----
            var sb = UIKit.Panel(p, Pal.A(Pal.Hex(0x120B33), 0.9f), new Vector2(0.5f, 0f), new Vector2(600f, 120f), new Vector2(0f, 240f));
            UIKit.Neon(sb, Pal.Yellow, 2f);
            storyBox = sb.gameObject;
            storySpeaker = UIKit.Label(sb.transform, "", 22, Pal.Yellow, TextAnchor.UpperLeft, new Vector2(0f, 1f), new Vector2(560f, 30f), new Vector2(20f, -8f));
            storyText = UIKit.FitLabel(sb.transform, "", 26, 18, Pal.Text, TextAnchor.UpperLeft);
            UIKit.Place(storyText.rectTransform, new Vector2(0f, 1f), new Vector2(560f, 76f), new Vector2(20f, -38f));
            storyBox.SetActive(false);

            // ---- hint ----
            var hb = UIKit.Panel(p, Pal.A(Pal.Hex(0x0A2A33), 0.88f), new Vector2(0.5f, 0.5f), new Vector2(820f, 70f), new Vector2(0f, 40f));
            hintBox = hb.gameObject;
            hintText = UIKit.FitLabel(hb.transform, "", 26, 18, Pal.Cyan);
            UIKit.Fill(hintText.rectTransform, 10f);
            hintBox.SetActive(false);

            // ---- speed + energy ----
            var en = UIKit.Panel(p, Pal.A(Pal.Panel, 0.75f), new Vector2(0.5f, 0f), new Vector2(360f, 92f), new Vector2(0f, 30f));
            hudSpeed = UIKit.Label(en.transform, "0 km/h", 30, Pal.Text, TextAnchor.MiddleLeft, new Vector2(0f, 1f), new Vector2(200f, 44f), new Vector2(16f, -4f));
            hudDrift = UIKit.Label(en.transform, "", 24, Pal.Pink, TextAnchor.MiddleRight, new Vector2(1f, 1f), new Vector2(150f, 44f), new Vector2(-14f, -4f));
            var ebg = UIKit.Panel(en.transform, Pal.A(Color.white, 0.12f), new Vector2(0f, 0f), new Vector2(328f, 26f), new Vector2(16f, 12f));
            energyFillImg = UIKit.Panel(ebg.transform, Pal.Gold);
            energyFill = energyFillImg.rectTransform;
            energyFill.anchorMin = Vector2.zero; energyFill.anchorMax = new Vector2(0f, 1f); energyFill.pivot = new Vector2(0f, 0.5f);
            energyFill.offsetMin = Vector2.zero; energyFill.offsetMax = Vector2.zero;

            // ---- touch controls ----
            touchRoot = UIKit.Rect(p, "Touch").gameObject;
            UIKit.Fill((RectTransform)touchRoot.transform);
            // 2.0 (concept art 5): glossy round buttons - blue arrows, gold boost, purple drift, green jump
            Color blue = Pal.A(Pal.Hex(0x3C8CE6), 0.92f), gold = Pal.A(Pal.Hex(0xF2B01E), 0.95f);
            Color purple = Pal.A(Pal.Hex(0xA06CE8), 0.92f), green = Pal.A(Pal.Hex(0x3CC85A), 0.92f);
            input.left = UIKit.IconHold(touchRoot.transform, Icon.Left, blue, null, new Vector2(0f, 0f), new Vector2(180f, 180f), new Vector2(40f, 40f));
            input.right = UIKit.IconHold(touchRoot.transform, Icon.Right, blue, null, new Vector2(0f, 0f), new Vector2(180f, 180f), new Vector2(246f, 40f));
            input.boost = UIKit.IconHold(touchRoot.transform, Icon.Bolt, gold, "부스터", new Vector2(1f, 0f), new Vector2(190f, 190f), new Vector2(-34f, 34f));
            input.drift = UIKit.IconHold(touchRoot.transform, Icon.Drift, purple, "드리프트", new Vector2(1f, 0f), new Vector2(160f, 160f), new Vector2(-250f, 34f));
            input.jump = UIKit.IconHold(touchRoot.transform, Icon.Jump, green, "점프", new Vector2(1f, 0f), new Vector2(150f, 150f), new Vector2(-70f, 250f));

            // ---- countdown ----
            hudCountdown = UIKit.Label(p, "", 200, Pal.Yellow, TextAnchor.MiddleCenter, new Vector2(0.5f, 0.5f), new Vector2(800f, 260f), new Vector2(0f, 60f));
            hudCountdown.fontStyle = FontStyle.Bold;
            UIKit.Neon(hudCountdown, Pal.Purple, 6f);

            // ---- blocking dialogue (prologue) ----
            var dp = UIKit.Panel(p, Pal.A(Pal.Hex(0x0B0824), 0.95f), new Vector2(0.5f, 0f), new Vector2(1100f, 250f), new Vector2(0f, 60f));
            UIKit.Neon(dp, Pal.Yellow, 3f);
            dialogPanel = dp.gameObject;
            dialogSpeaker = UIKit.Label(dp.transform, "", 30, Pal.Yellow, TextAnchor.UpperLeft, new Vector2(0f, 1f), new Vector2(1040f, 40f), new Vector2(30f, -16f));
            dialogText = UIKit.Label(dp.transform, "", 34, Pal.Text, TextAnchor.UpperLeft, new Vector2(0f, 1f), new Vector2(1040f, 120f), new Vector2(30f, -62f));
            UIKit.Button(dp.transform, "다음 ▶", Pal.Yellow, Pal.Dark, 30, NextDialog, new Vector2(1f, 0f), new Vector2(200f, 66f), new Vector2(-24f, 18f));
            UIKit.Button(dp.transform, "건너뛰기", Pal.Card, Pal.Text, 26, () => { dialogIdx = 999; NextDialog(); }, new Vector2(1f, 0f), new Vector2(170f, 66f), new Vector2(-240f, 18f));
            dialogPanel.SetActive(false);

            // ---- pause ----
            var pp = UIKit.Panel(p, Pal.A(Color.black, 0.7f), false);
            UIKit.Fill(pp.rectTransform);
            pausePanel = pp.gameObject;
            var box = UIKit.Panel(pp.transform, Pal.Panel, new Vector2(0.5f, 0.5f), new Vector2(560f, 470f), new Vector2(0f, 0f));
            box.rectTransform.pivot = new Vector2(0.5f, 0.5f);
            UIKit.Neon(box, Pal.Purple, 3f);
            UIKit.Label(box.transform, "일시정지", 50, Pal.Text, TextAnchor.MiddleCenter, new Vector2(0.5f, 1f), new Vector2(500f, 80f), new Vector2(0f, -20f));
            UIKit.Button(box.transform, "계속하기", Pal.Yellow, Pal.Dark, 34, () => { HidePause(); if (onResume != null) onResume(); }, new Vector2(0.5f, 1f), new Vector2(400f, 84f), new Vector2(0f, -120f));
            UIKit.Button(box.transform, "처음부터 다시", Pal.Card, Pal.Text, 32, () => { HidePause(); if (onRestart != null) onRestart(); }, new Vector2(0.5f, 1f), new Vector2(400f, 84f), new Vector2(0f, -220f));
            UIKit.Button(box.transform, "메인 메뉴", Pal.Card, Pal.Text, 32, () => { HidePause(); if (onQuit != null) onQuit(); }, new Vector2(0.5f, 1f), new Vector2(400f, 84f), new Vector2(0f, -320f));
            pausePanel.SetActive(false);
        }

        public bool Paused { get { return pausePanel != null && pausePanel.activeSelf; } }
        public bool DialogOpen { get { return dialogPanel != null && dialogPanel.activeSelf; } }
        public void ShowPause() { pausePanel.SetActive(true); pausePanel.transform.SetAsLastSibling(); }
        public void HidePause() { if (pausePanel != null) pausePanel.SetActive(false); }
        public void SetTouchVisible(bool v) { touchRoot.SetActive(v); }

        public void ResetHud()
        {
            qBanner.SetActive(false); answerPanel.SetActive(false); storyBox.SetActive(false); hintBox.SetActive(false);
            dialogPanel.SetActive(false); toastText.text = ""; hudCountdown.text = "";
            storyQueue.Clear(); answerTimer = toastTimer = storyTimer = hintTimer = 0f;
            input.Reset();
        }

        //================== LIVE VALUES ==================\\
        public void UpdateHud(RunnerSim sim, LearningSession learn, float progress01)
        {
            hudTime.text = FormatTime(sim.raceTime);
            hudCoins.text = sim.coins.ToString();
            hudAcc.text = "정답 " + learn.Correct + "/" + learn.Total;
            hudSpeed.text = Mathf.RoundToInt(sim.speed * 3.6f) + " km/h";
            progressFill.anchorMax = new Vector2(Mathf.Clamp01(progress01), 1f);
            energyFill.anchorMax = new Vector2(Mathf.Clamp01(sim.boostEnergy), 1f);
            energyFillImg.color = sim.Boosting ? Color.white : (sim.boostEnergy >= 0.2f ? Pal.Gold : Pal.A(Pal.Gold, 0.45f));
            int tier = sim.Drifting ? sim.DriftTierNow : 0;
            hudDrift.text = sim.Drifting ? (tier == 0 ? "드리프트" : "터보 Lv." + tier) : (sim.ringChain > 1 ? "도약 x" + sim.ringChain : "");
            hudDrift.color = sim.Drifting ? Pal.Pink : Pal.Gold;
        }

        public void SetSection(string name) { hudSection.text = name; }

        GameObject bossBar; RectTransform bossFill; Text bossLabel;
        public void SetBoss(int hp, int max)
        {
            bossBar.SetActive(max > 0);
            if (max <= 0) return;
            float k = Mathf.Clamp01(hp / (float)max);
            bossFill.anchorMax = new Vector2(Mathf.Max(0.001f, k), 1f);
            bossLabel.text = hp > 0 ? "NULL 보호막  " + hp + " / " + max : "NULL 보호막 붕괴!";
        }

        public void Tick(float dt)
        {
            ApplySafeArea();
            if (answerTimer > 0f) { answerTimer -= dt; if (answerTimer <= 0f) answerPanel.SetActive(false); }
            if (toastTimer > 0f)
            {
                toastTimer -= dt;
                var c = toastText.color; c.a = Mathf.Clamp01(toastTimer / 0.4f); toastText.color = c;
                if (toastTimer <= 0f) toastText.text = "";
            }
            if (hintTimer > 0f) { hintTimer -= dt; if (hintTimer <= 0f) hintBox.SetActive(false); }
            if (storyTimer > 0f) storyTimer -= dt;
            if (storyTimer <= 0f)
            {
                if (storyQueue.Count > 0)
                {
                    var l = storyQueue.Dequeue();
                    storySpeaker.text = l.speaker; storyText.text = l.text;
                    storyBox.SetActive(true);
                    storyTimer = Mathf.Clamp(1.6f + l.text.Length * 0.06f, 3f, 6f);
                }
                else storyBox.SetActive(false);
            }
        }

        //================== POPUPS ==================\\
        public void ShowQuestion(Question q, string title)
        {
            if (q == null) return;
            answerPanel.SetActive(false); answerTimer = 0f;
            qTitle.text = title + "  <size=20><color=#B8B2E6>[" + q.topic + " · " + q.difficulty + "]</color></size>";
            qText.text = q.question;
            var parts = new List<string>();
            for (int i = 0; i < q.options.Length; i++) parts.Add("<color=#2EE6D6>" + (char)('A' + i) + "</color> " + q.options[i]);
            string arrows = q.options.Length == 2 ? "◀ 왼쪽          오른쪽 ▶" : "◀ 왼쪽     가운데     오른쪽 ▶";
            qOptions.text = string.Join("     ", parts.ToArray()) + "\n<size=20><color=#B8B2E6>" + arrows + " 차선으로 조향해 진입하세요</color></size>";
            qBanner.SetActive(true);
        }

        public void HideQuestion() { qBanner.SetActive(false); }

        public void ShowAnswer(Question q, int chosen, bool correct, string extraLine, float seconds)
        {
            HideQuestion();
            if (q == null) return;
            answerTitle.text = correct ? "정답!  " + q.options[q.answer] : "오답...  정답은 " + q.options[q.answer];
            answerTitle.color = correct ? Pal.Green : Pal.Red;
            string wrong = correct ? "" : q.WrongExplanation(chosen);
            answerText.text = (wrong.Length > 0 ? "<color=#FFB627>" + wrong + "</color>\n" : "") + q.explanation +
                              (string.IsNullOrEmpty(extraLine) ? "" : "\n<color=#B8B2E6>" + extraLine + "</color>");
            ((Image)answerPanel.GetComponent<Image>()).color = correct ? Pal.A(Pal.Hex(0x0B2A2A), 0.94f) : Pal.A(Pal.Hex(0x2A0B16), 0.94f);
            answerPanel.SetActive(true);
            answerTimer = seconds;
        }

        public void Toast(string text, Color c, float seconds = 1.6f)
        {
            toastText.text = text; c.a = 1f; toastText.color = c; toastTimer = seconds;
        }

        public void Hint(string text, float seconds = 5f)
        {
            if (!save.showHints) return;
            hintText.text = text; hintBox.SetActive(true); hintTimer = seconds;
        }

        public void QueueStory(StoryLine[] lines) { if (lines != null) foreach (var l in lines) storyQueue.Enqueue(l); }

        public void Countdown(string text) { hudCountdown.text = text; }

        public void ShowDialog(StoryLine[] lines, Action done)
        {
            dialogLines = lines; dialogIdx = -1; dialogDone = done;
            dialogPanel.SetActive(true);
            NextDialog();
        }

        void NextDialog()
        {
            dialogIdx++;
            if (dialogLines == null || dialogIdx >= dialogLines.Length)
            {
                dialogPanel.SetActive(false);
                var d = dialogDone; dialogDone = null;
                if (d != null) d();
                return;
            }
            dialogSpeaker.text = dialogLines[dialogIdx].speaker;
            dialogText.text = dialogLines[dialogIdx].text;
        }
    }
}
