// NERVE RUNNER - SYNAPSE GATE minigame (plays while the race is frozen at the axon terminal).
// Phase 1: tap the 5 steps of chemical synaptic transmission in order (shuffled buttons).
// Phase 2: EPSP vs IPSP question.  Success = at most 1 ordering mistake AND phase 2 correct.
// Both answers are recorded in the LearningSession (and therefore in the wrong-answer notes).
using System;
using System.Collections.Generic;
using NerveRunner.Core;
using UnityEngine;
using UnityEngine.UI;

namespace NerveRunner
{
    public partial class GameUI
    {
        GameObject minigameRoot;
        Text mgTitle, mgPrompt, mgFeedback;
        Text[] mgSlots;
        Button[] mgStepBtns = new Button[5];
        Button[] mgQBtns = new Button[2];
        Button mgContinue;
        Image[] mgVesicles;
        Image mgCa;
        Question qOrder, qEpsp;
        int[] mgShuffle;
        int mgNext, mgMistakes, mgFirstWrong;
        bool mgEpspOk;
        Action<bool, int, int> mgDone;   // (success, order mistakes, epsp chosen)
        float mgAnim;

        void BuildMinigame()
        {
            var bg = UIKit.Panel(safe, Pal.A(Pal.Hex(0x07051A), 0.9f), false);
            UIKit.Fill(bg.rectTransform);
            minigameRoot = bg.gameObject;
            var p = bg.transform;

            mgTitle = UIKit.Label(p, "시냅스 게이트", 56, Pal.Pink, TextAnchor.MiddleCenter, new Vector2(0.5f, 1f), new Vector2(900f, 80f), new Vector2(0f, -24f));
            mgTitle.fontStyle = FontStyle.Bold;
            UIKit.Neon(mgTitle, Pal.Purple, 4f);
            mgPrompt = UIKit.FitLabel(p, "", 32, 20, Pal.Text);
            UIKit.Place(mgPrompt.rectTransform, new Vector2(0.5f, 1f), new Vector2(1300f, 60f), new Vector2(0f, -106f));

            // ---- illustration: presynaptic terminal, vesicles, cleft, receptors ----
            var ill = UIKit.Panel(p, Pal.A(Pal.Hex(0x16103F), 0.95f), new Vector2(0f, 0.5f), new Vector2(470f, 600f), new Vector2(40f, -40f));
            ill.rectTransform.pivot = new Vector2(0f, 0.5f);
            UIKit.Neon(ill, Pal.Purple, 2f);
            var pre = UIKit.Panel(ill.transform, Pal.Hex(0x6A3FD0), new Vector2(0.5f, 1f), new Vector2(380f, 300f), new Vector2(0f, -30f));
            pre.sprite = UIKit.Circle;
            UIKit.Label(pre.transform, "시냅스전 말단", 26, Pal.Text, TextAnchor.UpperCenter, new Vector2(0.5f, 1f), new Vector2(300f, 40f), new Vector2(0f, -40f));
            mgVesicles = new Image[7];
            for (int i = 0; i < mgVesicles.Length; i++)
            {
                var v = UIKit.Panel(pre.transform, Pal.Pink, new Vector2(0.5f, 0.5f), new Vector2(44f, 44f), new Vector2(-130f + i * 44f, -30f + (i % 2) * 40f));
                v.sprite = UIKit.Circle; mgVesicles[i] = v;
            }
            mgCa = UIKit.Panel(pre.transform, Pal.Green, new Vector2(0.5f, 0f), new Vector2(60f, 60f), new Vector2(-120f, -10f));
            mgCa.sprite = UIKit.Circle;
            UIKit.Label(mgCa.transform, "Ca2+", 18, Pal.Dark, TextAnchor.MiddleCenter, new Vector2(0.5f, 0.5f), new Vector2(60f, 60f), Vector2.zero).rectTransform.pivot = new Vector2(0.5f, 0.5f);
            UIKit.Label(ill.transform, "시냅스틈새", 24, Pal.Dim, TextAnchor.MiddleCenter, new Vector2(0.5f, 0.5f), new Vector2(300f, 40f), new Vector2(0f, -110f)).rectTransform.pivot = new Vector2(0.5f, 0.5f);
            var post = UIKit.Panel(ill.transform, Pal.Hex(0x2C6FD0), new Vector2(0.5f, 0f), new Vector2(400f, 110f), new Vector2(0f, 26f));
            UIKit.Label(post.transform, "시냅스후막 (수용체)", 24, Pal.Text, TextAnchor.MiddleCenter, new Vector2(0.5f, 0.5f), new Vector2(380f, 40f), new Vector2(0f, -20f)).rectTransform.pivot = new Vector2(0.5f, 0.5f);
            for (int i = 0; i < 5; i++)
                UIKit.Panel(post.transform, Pal.Cyan, new Vector2(0.5f, 1f), new Vector2(26f, 34f), new Vector2(-140f + i * 70f, 18f));

            // ---- order slots ----
            mgSlots = new Text[5];
            for (int i = 0; i < 5; i++)
            {
                var slot = UIKit.Panel(p, Pal.A(Pal.Card, 0.9f), new Vector2(0.5f, 1f), new Vector2(820f, 58f), new Vector2(240f, -180f - i * 64f));
                mgSlots[i] = UIKit.FitLabel(slot.transform, "", 26, 16, Pal.Dim, TextAnchor.MiddleLeft);
                UIKit.Fill(mgSlots[i].rectTransform, 14f);
            }
            // ---- step buttons (2 rows) ----
            for (int i = 0; i < 5; i++)
            {
                int idx = i;
                int col = i % 3, row = i / 3;
                mgStepBtns[i] = UIKit.Button(p, "", Pal.Hex(0x3A2C8C), Pal.Text, 26, () => TapStep(idx),
                                             new Vector2(0.5f, 0f), new Vector2(268f, 100f), new Vector2(240f + (col - 1) * 278f - (row == 1 ? -139f : 0f), 170f - row * 110f));
            }
            for (int i = 0; i < 2; i++)
            {
                int idx = i;
                mgQBtns[i] = UIKit.Button(p, "", Pal.Hex(0x3A2C8C), Pal.Text, 32, () => AnswerEpsp(idx),
                                          new Vector2(0.5f, 0f), new Vector2(400f, 120f), new Vector2(240f + (i == 0 ? -210f : 210f), 120f));
            }
            mgFeedback = UIKit.FitLabel(p, "", 28, 18, Pal.Yellow);
            UIKit.Place(mgFeedback.rectTransform, new Vector2(0.5f, 0f), new Vector2(860f, 150f), new Vector2(240f, 270f));
            mgContinue = UIKit.Button(p, "다음 구간 ▶", Pal.Yellow, Pal.Dark, 34, FinishMinigame, new Vector2(0.5f, 0f), new Vector2(340f, 90f), new Vector2(240f, 60f));
            minigameRoot.SetActive(false);
        }

        public bool MinigameOpen { get { return minigameRoot.activeSelf; } }

        public void OpenMinigame(Question order, Question epsp, Action<bool, int, int> done)
        {
            qOrder = order; qEpsp = epsp; mgDone = done;
            mgNext = 0; mgMistakes = 0; mgFirstWrong = -1; mgEpspOk = false; mgAnim = 0f;
            var idx = new List<int> { 0, 1, 2, 3, 4 };
            var rnd = new System.Random(Environment.TickCount);
            for (int i = idx.Count - 1; i > 0; i--) { int j = rnd.Next(i + 1); int t = idx[i]; idx[i] = idx[j]; idx[j] = t; }
            mgShuffle = idx.ToArray();
            for (int i = 0; i < 5; i++)
            {
                mgSlots[i].text = (i + 1) + ".  ?";
                mgSlots[i].color = Pal.Dim;
                mgStepBtns[i].gameObject.SetActive(true);
                mgStepBtns[i].interactable = true;
                mgStepBtns[i].targetGraphic.color = Pal.Hex(0x3A2C8C);
                UIKit.ButtonText(mgStepBtns[i]).text = order.options[mgShuffle[i]];
            }
            foreach (var b in mgQBtns) b.gameObject.SetActive(false);
            mgContinue.gameObject.SetActive(false);
            mgPrompt.text = "1단계: " + order.question;
            mgFeedback.text = "";
            foreach (var v in mgVesicles) v.rectTransform.anchoredPosition = new Vector2(v.rectTransform.anchoredPosition.x, -30f);
            mgCa.gameObject.SetActive(false);
            minigameRoot.SetActive(true);
            minigameRoot.transform.SetAsLastSibling();
        }

        void TapStep(int button)
        {
            int step = mgShuffle[button];
            if (step == mgNext)
            {
                mgSlots[mgNext].text = (mgNext + 1) + ".  " + qOrder.options[step];
                mgSlots[mgNext].color = Pal.Green;
                mgStepBtns[button].interactable = false;
                mgStepBtns[button].targetGraphic.color = Pal.Hex(0x13806F);
                mgNext++;
                GameAudio.Coin();
                if (mgNext == 2) mgCa.gameObject.SetActive(true);
                if (mgNext >= 5) StartEpspPhase();
            }
            else
            {
                mgMistakes++;
                if (mgFirstWrong < 0) mgFirstWrong = step;
                mgFeedback.text = "<color=#FF4D6D>순서가 달라요!</color> 지금은 " + (mgNext + 1) + "번째 단계예요. (" + StepHint(mgNext) + ")";
                GameAudio.Thud();
            }
        }

        static string StepHint(int i)
        {
            switch (i)
            {
                case 0: return "신호가 먼저 도착해야 해요";
                case 1: return "어떤 이온이 들어올까요?";
                case 2: return "Ca2+ 유입의 결과는?";
                case 3: return "방출된 물질이 이동해요";
                default: return "마지막은 시냅스후막!";
            }
        }

        void StartEpspPhase()
        {
            foreach (var b in mgStepBtns) b.gameObject.SetActive(false);
            mgPrompt.text = "2단계: " + qEpsp.question;
            mgFeedback.text = mgMistakes == 0 ? "<color=#5CFF9D>완벽한 순서!</color> 신경전달물질이 방출되었습니다." :
                                                "순서 완성 (실수 " + mgMistakes + "회). 신경전달물질이 방출되었습니다.";
            for (int i = 0; i < mgQBtns.Length; i++)
            {
                bool show = i < qEpsp.options.Length;
                mgQBtns[i].gameObject.SetActive(show);
                if (!show) continue;
                mgQBtns[i].interactable = true;
                mgQBtns[i].targetGraphic.color = Pal.Hex(0x3A2C8C);
                UIKit.ButtonText(mgQBtns[i]).text = qEpsp.options[i];
            }
            mgAnim = 1.2f;
        }

        int mgEpspChosen;
        void AnswerEpsp(int i)
        {
            mgEpspChosen = i;
            mgEpspOk = i == qEpsp.answer;
            for (int k = 0; k < mgQBtns.Length; k++)
            {
                mgQBtns[k].interactable = false;
                if (k < qEpsp.options.Length)
                    mgQBtns[k].targetGraphic.color = k == qEpsp.answer ? Pal.Hex(0x13806F) : (k == i ? Pal.Hex(0x8A1A33) : Pal.Hex(0x3A2C8C));
            }
            bool success = mgEpspOk && mgMistakes <= 1;
            string wrong = mgEpspOk ? "" : "<color=#FFB627>" + qEpsp.WrongExplanation(i) + "</color>\n";
            mgFeedback.text = (success ? "<color=#5CFF9D>시냅스 연결 성공! 전달물질 다리가 생성됩니다.</color>\n"
                                       : "<color=#FF4D6D>연결 불안정 - 다리는 생기지만 속도가 떨어져요.</color>\n") + wrong + qEpsp.explanation;
            if (mgEpspOk) GameAudio.Chime(); else GameAudio.Thud();
            mgContinue.gameObject.SetActive(true);
        }

        void FinishMinigame()
        {
            minigameRoot.SetActive(false);
            var d = mgDone; mgDone = null;
            if (d != null) d(mgEpspOk && mgMistakes <= 1, mgMistakes, mgEpspChosen);
        }

        /// vesicles drift down to the membrane during phase 2 (release animation)
        public void TickMinigame(float dt)
        {
            if (!minigameRoot.activeSelf || mgAnim <= 0f) return;
            mgAnim -= dt;
            float k = 1f - Mathf.Clamp01(mgAnim / 1.2f);
            for (int i = 0; i < mgVesicles.Length; i++)
            {
                var rt = mgVesicles[i].rectTransform;
                rt.anchoredPosition = new Vector2(rt.anchoredPosition.x, Mathf.Lerp(-30f + (i % 2) * 40f, -230f, k));
            }
        }
    }
}
