// NERVE RUNNER - one race of CHAPTER 1: steps the RunnerSim, routes its events to the
// learning session, views, audio and HUD, and runs the intro / countdown / minigame / finish flow.
using System;
using System.Collections.Generic;
using NerveRunner.Core;
using UnityEngine;

namespace NerveRunner
{
    public class RaceController : MonoBehaviour
    {
        enum Phase { Intro, Countdown, Running, Minigame, Finishing, Done }

        public RunnerSim sim;
        public LearningSession learn;
        TrackGraph graph;
        TrackView view;
        StarVisual star;
        ChaseCamera chase;
        GameUI ui;
        QuestionBank bank;
        Dictionary<string, StoryBeat> story;
        Dictionary<string, CodexEntry> codex;
        SaveData save;
        readonly Dictionary<string, TrackSegment> forkSegByQ = new Dictionary<string, TrackSegment>();
        AutoPilot autopilot;

        Phase phase;
        float phaseT, acc, finishT;
        int countdownShown;
        string pendingQuestion;
        public Action<RaceController> onFinished;

        const float STEP = 1f / 120f;

        public void Setup(TrackGraph g, TrackView v, StarVisual s, ChaseCamera c, GameUI u, QuestionBank qb,
                          Dictionary<string, StoryBeat> st, Dictionary<string, CodexEntry> cx, SaveData sd)
        {
            graph = g; view = v; star = s; chase = c; ui = u; bank = qb; story = st; codex = cx; save = sd;
            foreach (var seg in g.segments) if (seg.fork != null) forkSegByQ[seg.fork.questionId] = seg;
            sim = new RunnerSim(g);
            sim.steerSensitivity = save.steerSensitivity;
            learn = new LearningSession(bank);
        }

        public void Begin(bool showPrologue)
        {
            ui.ResetHud();
            ui.Show(UIScreen.Hud);
            ui.SetTouchVisible(false);
            ui.SetSection(graph.start.name);
            star.ResetState();
            star.SetExpression(Expression.Normal, 0f);
            star.SetBase(Expression.Focus);
            Pose(0f);
            chase.Showcase(999f);
            phase = Phase.Intro; phaseT = 0f;
            StoryBeat pro;
            if (showPrologue && story.TryGetValue("prologue", out pro)) ui.ShowDialog(pro.lines, StartCountdown);
            else StartCountdown();
        }

        void StartCountdown()
        {
            save.storySeen = true;
            phase = Phase.Countdown; phaseT = 0f; countdownShown = 4;
            chase.Showcase(2.6f);
            star.SetExpression(Expression.Joy, 2f);
            star.Twirl(720f);
            ui.SetTouchVisible(true);
        }

        public void SetAutopilot(bool on) { autopilot = on ? new AutoPilot() : null; }
        public bool Autopilot { get { return autopilot != null; } }

        void Update()
        {
            float dt = Mathf.Min(Time.deltaTime, 0.05f);
            ui.Tick(dt);
            ui.TickMinigame(dt);
            if (ui.Paused) { GameAudio.Hum(0f, false); GameAudio.Screech(0f); return; }
            if (ui.input.PausePressed() && phase == Phase.Running) { ui.ShowPause(); return; }

            switch (phase)
            {
                case Phase.Intro:
                    Pose(dt);
                    break;
                case Phase.Countdown:
                {
                    phaseT += dt;
                    int n = 3 - Mathf.FloorToInt(phaseT - 0.6f);
                    if (phaseT >= 0.6f && n != countdownShown && n >= 1 && n <= 3) { countdownShown = n; ui.Countdown(n.ToString()); GameAudio.Beep(); }
                    if (phaseT >= 3.6f)
                    {
                        ui.Countdown("GO!"); GameAudio.Chime();
                        phase = Phase.Running; phaseT = 0f;
                        if (save.showHints) ui.Hint("◀ ▶ 버튼으로 조향! 코너에서는 바깥쪽으로 밀려나요.", 5f);
                    }
                    Pose(dt);
                    break;
                }
                case Phase.Running:
                {
                    phaseT += dt;
                    if (phaseT > 0.8f && phaseT < 1f) ui.Countdown("");
                    RunnerInput inp = autopilot != null ? autopilot.Think(sim) : ui.input.Read(dt);
                    acc += dt;
                    while (acc >= STEP && phase == Phase.Running)
                    {
                        acc -= STEP;
                        sim.Step(inp, STEP);
                        inp.jump = false;
                        HandleEvents();
                    }
                    Pose(dt);
                    break;
                }
                case Phase.Minigame:
                    Pose(dt);
                    break;
                case Phase.Finishing:
                    finishT += dt;
                    Pose(dt);
                    if (finishT > 3.2f) { phase = Phase.Done; if (onFinished != null) onFinished(this); }
                    break;
            }
            float progress = graph.referenceLength > 0f ? sim.distance / graph.referenceLength : 0f;
            ui.UpdateHud(sim, learn, phase == Phase.Done || phase == Phase.Finishing ? 1f : progress);
            bool running = phase == Phase.Running;
            GameAudio.Hum(running ? sim.Speed01 : 0f, running && sim.Boosting);
            GameAudio.Screech(running && sim.Drifting ? 0.25f + 0.1f * sim.DriftTierNow : 0f);
        }

        void Pose(float dt)
        {
            bool boosting = sim.Boosting || sim.turboTimer > 0f;
            bool rush = sim.ringChain >= 3 && sim.seg.zone == ZoneKind.Myelin;
            star.Pose(new StarPose
            {
                pos = sim.Position, ground = sim.seg.WorldPos(sim.s, sim.x, 0f), forward = sim.Forward, right = sim.Right,
                lateralVel = sim.vx, vy = sim.vy, speed01 = sim.Speed01, drifting = sim.Drifting, driftDir = sim.DriftDir,
                driftTier = sim.DriftTierNow, boosting = boosting, grounded = sim.grounded, rush = rush,
            }, dt);
            chase.Follow(new CamInput
            {
                pos = sim.Position, fwd = sim.Forward, speed01 = sim.Speed01, boosting = boosting || rush,
                curvature = phase == Phase.Running ? sim.Curvature : 0f, airHeight = sim.y,
                driftDir = sim.Drifting ? sim.DriftDir : 0,
            }, dt);
        }

        //================== EVENTS ==================\\
        void HandleEvents()
        {
            foreach (var e in sim.events) Handle(e);
            sim.events.Clear();
        }

        void Handle(SimEvent e)
        {
            switch (e.type)
            {
                case SimEventType.Trigger: Trigger(e.tag); break;

                case SimEventType.GateResult:
                {
                    var q = bank.Get(e.src.questionId);
                    learn.Answer(e.src.questionId, e.lane, sim.raceTime);
                    view.MarkGate(e.src, e.lane, e.correct);
                    Feedback(e.correct);
                    string extra = null;
                    if (e.src.tag == "glia" && e.correct) { extra = "희소돌기아교세포가 수초를 재생했습니다. 전도 속도 회복!"; ui.Toast("수초 복구 완료!", Pal.Green); }
                    else if (e.src.tag == "ap") extra = "활동전위 단계 " + (e.src.index + 1) + "/4";
                    ui.ShowAnswer(q, e.lane, e.correct, extra, e.correct ? 4.5f : 7f);
                    pendingQuestion = null;
                    break;
                }
                case SimEventType.ForkChosen:
                {
                    var q = bank.Get(e.tag);
                    learn.Answer(e.tag, e.lane, sim.raceTime);
                    TrackSegment fs;
                    if (forkSegByQ.TryGetValue(e.tag, out fs)) view.MarkFork(fs, e.lane, e.correct);
                    Feedback(e.correct);
                    ui.ShowAnswer(q, e.lane, e.correct,
                                  e.correct ? "정답 경로: 지름길 + 신호 에너지 보너스!" : "복습 구간에 진입했습니다. 해설을 읽으며 천천히 이동하세요.",
                                  e.correct ? 5f : 9f);
                    if (!e.correct) ui.Toast("복습 구간 - 속도 저하", Pal.Hex(0xFF8A3D), 2f);
                    pendingQuestion = null;
                    break;
                }
                case SimEventType.RingHit:
                    view.FlashRing(e.src, true);
                    star.Fx.Burst(FxBurst.Node, sim.Position, sim.Forward);
                    GameAudio.Coin();
                    if (sim.ringChain >= 2) ui.Toast("도약전도 x" + sim.ringChain + "  +" + Mathf.RoundToInt(sim.ChainBonus * 100f) + "%", Pal.Gold, 0.9f);
                    break;
                case SimEventType.RingMiss:
                    view.FlashRing(e.src, false);
                    if (sim.ringsTotal > 1) ui.Toast("결절을 놓쳤어요 - 연속 끊김", Pal.Dim, 0.9f);
                    break;
                case SimEventType.ObstacleHit:
                    view.HitObstacle(e.src);
                    chase.Shake(0.9f);
                    star.HitReaction();
                    GameAudio.Thud();
                    ui.Toast("NULL 충돌! 전도 지연", Pal.Red, 1.2f);
                    break;
                case SimEventType.OrbCollected:
                    view.Collect(e.src);
                    GameAudio.Coin();
                    break;
                case SimEventType.RepairOrb:
                    view.Collect(e.src);
                    GameAudio.Chime();
                    star.RepairReaction();
                    ui.Toast("수초 복구 " + sim.repairCount + "/3", Pal.Green, 1.4f);
                    break;
                case SimEventType.WallHit:
                    chase.Shake(0.35f);
                    GameAudio.Thud();
                    star.SetExpression(Expression.Surprise, 0.6f);
                    break;
                case SimEventType.DriftEnd:
                    if (e.tier > 0) { GameAudio.Whoosh(); ui.Toast("미니 터보 Lv." + e.tier, StarFx.TierColor[Mathf.Clamp(e.tier, 1, 3)], 0.9f); star.SetExpression(Expression.Joy, 0.8f); star.TurboReaction(e.tier); }
                    break;
                case SimEventType.BoostStart:
                    GameAudio.Whoosh();
                    star.SetExpression(Expression.Joy, 1f);
                    break;
                case SimEventType.Jump:
                    GameAudio.Beep();
                    break;
                case SimEventType.Checkpoint:
                    ui.Toast("체크포인트", Pal.Purple, 1f);
                    break;
                case SimEventType.EnterSegment:
                    if (sim.seg.zone != ZoneKind.Review && sim.seg.zone != ZoneKind.Shortcut) ui.SetSection(sim.seg.name);
                    else ui.SetSection(sim.seg.zone == ZoneKind.Review ? "복습 구간" : "지름길");
                    if (sim.seg.zone == ZoneKind.Damaged) star.SetBase(Expression.Focus);
                    break;
                case SimEventType.Finish:
                    Finish();
                    break;
            }
        }

        void Feedback(bool correct)
        {
            if (correct) { GameAudio.Chime(); star.AnswerReaction(true); }
            else { GameAudio.Thud(); star.AnswerReaction(false); chase.Shake(0.5f); }
        }

        void Trigger(string tag)
        {
            if (string.IsNullOrEmpty(tag)) return;
            int c = tag.IndexOf(':');
            string kind = c >= 0 ? tag.Substring(0, c) : tag;
            string arg = c >= 0 ? tag.Substring(c + 1) : "";
            switch (kind)
            {
                case "story":
                {
                    StoryBeat b;
                    if (arg != "prologue" && story.TryGetValue(arg, out b)) ui.QueueStory(b.lines);
                    break;
                }
                case "hint":
                    if (arg == "corner") ui.Hint("코너 진입! 안쪽으로 조향해 벽에 부딪히지 않게 하세요.", 4f);
                    else if (arg == "drift") ui.Hint("급커브! [드리프트]를 누른 채 커브 방향으로 조향 → 놓으면 미니 터보!", 6f);
                    break;
                case "banner":
                    if (arg == "soma") ui.Toast("세포체 - 입력 신호의 가중(통합)", Pal.Cyan, 2.2f);
                    else if (arg == "terminal") ui.Toast("축삭종말 접근 - 시냅스 소포 준비", Pal.Cyan, 2.2f);
                    break;
                case "codex":
                {
                    learn.codexSeen.Add(arg);
                    CodexEntry ce;
                    if (codex.TryGetValue(arg, out ce) && !save.codexUnlocked.Contains(arg))
                        ui.Toast("신경 도감 등록: " + ce.name, Pal.Cyan, 1.8f);
                    break;
                }
                case "forkq":
                    pendingQuestion = arg;
                    ui.ShowQuestion(bank.Get(arg), "갈림길! 정답이라고 생각하는 경로로 들어가세요");
                    GameAudio.Beep();
                    break;
                case "gateq":
                    pendingQuestion = arg;
                    ui.ShowQuestion(bank.Get(arg), arg == Chapter1Layout.Q_GLIA ? "수초 복구 게이트" : "활동전위 게이트");
                    GameAudio.Beep();
                    break;
                case "synapse":
                    if (arg == "minigame") OpenMinigame();
                    else if (arg == "cross") ui.Toast("신경전달물질 다리 통과!", Pal.Pink, 1.5f);
                    break;
            }
        }

        void OpenMinigame()
        {
            phase = Phase.Minigame;
            ui.SetTouchVisible(false);
            ui.HideQuestion();
            star.SetExpression(Expression.Surprise, 1.5f);
            var qo = bank.Get(Chapter1Layout.Q_SYN_ORDER);
            var qe = bank.Get(Chapter1Layout.Q_SYN_EPSP);
            if (autopilot != null)
            {
                // AUTO demo: answer correctly and continue
                learn.Answer(qo.id, 0, sim.raceTime); learn.Answer(qe.id, qe.answer, sim.raceTime);
                CloseMinigame(true);
                return;
            }
            ui.OpenMinigame(qo, qe, (success, mistakes, epsp) =>
            {
                // ordering is recorded as correct only when done without mistakes
                learn.Answer(qo.id, mistakes == 0 ? qo.answer : 1, sim.raceTime);
                learn.Answer(qe.id, epsp, sim.raceTime);
                CloseMinigame(success);
            });
        }

        void CloseMinigame(bool success)
        {
            sim.ApplySynapseResult(success);
            view.BuildBridge(success);
            ui.SetTouchVisible(true);
            ui.input.Reset();
            star.SetExpression(success ? Expression.Joy : Expression.Hurt, 1.5f);
            ui.Toast(success ? "시냅스 연결 성공! 가속!" : "시냅스 연결 불안정", success ? Pal.Green : Pal.Red, 1.6f);
            phase = Phase.Running; acc = 0f;
        }

        void Finish()
        {
            phase = Phase.Finishing; finishT = 0f;
            ui.SetTouchVisible(false);
            ui.HideQuestion();
            ui.Countdown("GOAL!");
            GameAudio.Chime();
            star.SetBase(Expression.Clear);
            star.SetVictory(true);
            chase.Showcase(3.2f);
        }

        void OnDisable() { GameAudio.Hum(0f, false); GameAudio.Screech(0f); }
    }
}
