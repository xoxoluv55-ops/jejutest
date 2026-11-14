// NERVE RUNNER - entry point and app state machine.
// Like Neon Racer's GameBootstrap (MIT), the whole game is created from code when ANY scene
// starts, so there is no serialized scene wiring that can go stale between editor and device.
using System.Collections.Generic;
using System.IO;
using NeonRacer;
using NerveRunner.Core;
using UnityEngine;
using UnityEngine.EventSystems;
#if ENABLE_INPUT_SYSTEM
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.UI;
#endif

namespace NerveRunner
{
    public static class NerveRunnerBootstrap
    {
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void Boot()
        {
            if (Object.FindFirstObjectByType<GameRoot>() == null)
                new GameObject("NERVE RUNNER").AddComponent<GameRoot>();
        }
    }

    public class GameRoot : MonoBehaviour
    {
        QuestionBank bank;
        CodexEntry[] codex;
        readonly Dictionary<string, StoryBeat> story = new Dictionary<string, StoryBeat>();
        readonly Dictionary<string, CodexEntry> codexById = new Dictionary<string, CodexEntry>();
        SaveData save;
        TrackGraph graph;
        TrackView trackView;
        StarVisual star;
        Camera cam;
        ChaseCamera chase;
        GameUI ui;
        RaceController race;
        bool inMenu = true;

        string SavePath { get { return Path.Combine(Application.persistentDataPath, "nerverunner_save.json"); } }

        void Start()
        {
            Application.targetFrameRate = 60;
            UnityEngine.Screen.sleepTimeout = SleepTimeout.NeverSleep;
            UnityEngine.Screen.autorotateToPortrait = false;
            UnityEngine.Screen.autorotateToPortraitUpsideDown = false;
            UnityEngine.Screen.autorotateToLandscapeLeft = true;
            UnityEngine.Screen.autorotateToLandscapeRight = true;
            UnityEngine.Screen.orientation = ScreenOrientation.AutoRotation;

            LoadContent();
            LoadSave();

            // ---- camera / light / atmosphere ----
            cam = Camera.main;
            if (cam == null)
            {
                var cg = new GameObject("Main Camera");
                cg.tag = "MainCamera";
                cam = cg.AddComponent<Camera>();
                cg.AddComponent<AudioListener>();
            }
            chase = cam.gameObject.AddComponent<ChaseCamera>();
            chase.cam = cam;
            NeuralBackdrop.ApplyAtmosphere(cam);
            RenderQuality.EnableAntiAliasing(cam);
            RenderQuality.SetupPostFx();
            RenderQuality.ApplyMobileBudget(cam, 520f);
            if (FindFirstObjectByType<Light>() == null)
            {
                var lg = new GameObject("Key Light");
                var l = lg.AddComponent<Light>();
                l.type = LightType.Directional; l.color = Pal.Hex(0xB9A8FF); l.intensity = 0.7f;
                l.shadows = LightShadows.None;
                lg.transform.rotation = Quaternion.Euler(50f, -30f, 0f);
            }

            // ---- input for UI ----
            if (FindFirstObjectByType<EventSystem>() == null)
            {
                var es = new GameObject("EventSystem");
                es.AddComponent<EventSystem>();
#if ENABLE_INPUT_SYSTEM
                es.AddComponent<InputSystemUIInputModule>();
#else
                es.AddComponent<StandaloneInputModule>();
#endif
            }

            GameAudio.Init(transform);
            GameAudio.Apply(save.sfxOn, save.musicOn);

            // ---- world ----
            graph = Chapter1Layout.Build(bank);
            NeuralBackdrop.Build(transform, graph, 2089);
            BuildTrackView();
            star = StarVisual.Create(transform);

            // ---- UI ----
            ui = new GameUI { save = save, bank = bank, codex = codex };
            ui.onStartStage = StartStage;
            ui.onSaveChanged = () => { GameAudio.Apply(save.sfxOn, save.musicOn); WriteSave(); };
            ui.onQuit = ShowTitle;
            ui.onResume = () => { };
            ui.onRestart = StartStage;
            ui.Build(transform);
            ShowTitle();
        }

        void BuildTrackView()
        {
            if (trackView != null) Destroy(trackView.gameObject);
            var tv = new GameObject("TrackView");
            tv.transform.SetParent(transform, false);
            trackView = tv.AddComponent<TrackView>();
            trackView.Build(graph, bank);
        }

        //================== CONTENT / SAVE ==================\\
        void LoadContent()
        {
            var qa = Resources.Load<TextAsset>("NerveRunner/questions_ch1");
            var ca = Resources.Load<TextAsset>("NerveRunner/codex_ch1");
            var sa = Resources.Load<TextAsset>("NerveRunner/story_ch1");
            var qf = qa != null ? JsonUtility.FromJson<QuestionFile>(qa.text) : null;
            bank = new QuestionBank(qf != null && qf.questions != null ? qf.questions : new Question[0]);
            foreach (var err in bank.Validate()) Debug.LogError("[NerveRunner] question data: " + err);
            var cf = ca != null ? JsonUtility.FromJson<CodexFile>(ca.text) : null;
            codex = cf != null && cf.entries != null ? cf.entries : new CodexEntry[0];
            foreach (var e in codex) codexById[e.id] = e;
            var sf = sa != null ? JsonUtility.FromJson<StoryFile>(sa.text) : null;
            if (sf != null && sf.beats != null) foreach (var b in sf.beats) story[b.id] = b;
        }

        void LoadSave()
        {
            save = null;
            try { if (File.Exists(SavePath)) save = JsonUtility.FromJson<SaveData>(File.ReadAllText(SavePath)); }
            catch (System.Exception e) { Debug.LogWarning("[NerveRunner] save unreadable, starting fresh: " + e.Message); }
            if (save == null) save = new SaveData();
        }

        void WriteSave()
        {
            try { File.WriteAllText(SavePath, JsonUtility.ToJson(save, true)); }
            catch (System.Exception e) { Debug.LogWarning("[NerveRunner] save failed: " + e.Message); }
        }

        //================== FLOW ==================\\
        void ShowTitle()
        {
            if (race != null) { Destroy(race); race = null; }
            inMenu = true;
            GameAudio.StopLoops();
            star.SetBase(Expression.Normal);
            star.SetExpression(Expression.Joy, 1.5f);
            chase.Showcase(1e6f);
            ui.Show(UIScreen.Title);
        }

        void StartStage()
        {
            if (race != null) { Destroy(race); race = null; }
            if (bank.Get(Chapter1Layout.Q_HILLOCK) == null) { Debug.LogError("[NerveRunner] question data missing - cannot start CH.1"); return; }
            BuildTrackView();
            inMenu = false;
            race = gameObject.AddComponent<RaceController>();
            race.Setup(graph, trackView, star, chase, ui, bank, story, codexById, save);
            race.onFinished = OnRaceFinished;
            var rec = save.Stage(Chapter1Layout.StageId);
            rec.plays++;
            race.Begin(!save.storySeen || rec.clears == 0);
        }

        void OnRaceFinished(RaceController r)
        {
            var sim = r.sim; var learn = r.learn;
            var rec = save.Stage(Chapter1Layout.StageId);
            int stars = 1 + (learn.Accuracy >= 0.8f ? 1 : 0) + (sim.raceTime <= graph.parTime ? 1 : 0);
            bool newBest = rec.bestTime < 0f || sim.raceTime < rec.bestTime;
            if (newBest) rec.bestTime = sim.raceTime;
            rec.bestStars = Mathf.Max(rec.bestStars, stars);
            rec.bestAccuracy = Mathf.Max(rec.bestAccuracy, learn.Accuracy);
            rec.clears++;
            save.totalCoins += sim.coins;
            int wrongSaved = learn.Wrong().Count;
            learn.MergeInto(save, System.DateTime.Now.ToString("yyyy-MM-dd HH:mm"));
            WriteSave();

            // learning checklist per topic
            var learned = new List<string>(); var review = new List<string>();
            var topics = new Dictionary<string, bool>();
            foreach (var a in learn.answers)
            {
                var q = bank.Get(a.questionId);
                if (q == null) continue;
                bool ok;
                topics[q.topic] = (topics.TryGetValue(q.topic, out ok) ? ok : true) && a.correct;
            }
            foreach (var kv in topics) (kv.Value ? learned : review).Add(kv.Key);

            ui.ShowResult(new GameUI.ResultInfo
            {
                time = sim.raceTime, par = graph.parTime, accuracy = learn.Accuracy, stars = stars, coins = sim.coins,
                correct = learn.Correct, total = learn.Total, ringsHit = sim.ringsHit, ringsTotal = sim.ringsTotal,
                ringBest = sim.ringBest, wrongSaved = wrongSaved, newBest = newBest, learned = learned, toReview = review
            });
            GameAudio.StopLoops();
        }

        void Update()
        {
            float dt = Mathf.Min(Time.deltaTime, 0.05f);
            if (inMenu && star != null)
            {
                ui.Tick(dt);
                var p = graph.start.WorldPos(12f, 0f, RunnerSim.HOVER + 0.6f);
                star.transform.position = p;
                star.transform.rotation = Quaternion.LookRotation(graph.start.TangentAt(12f), Vector3.up);
                star.Idle(dt);
                // menu camera: in front of STAR-01, slightly to the right, so the logo sits left
                Vector3 f = graph.start.TangentAt(12f), r = graph.start.RightAt(12f);
                cam.transform.position = Vector3.Lerp(cam.transform.position, p + f * 6.5f - r * 2.2f + Vector3.up * 0.6f, 1f - Mathf.Pow(0.05f, dt));
                cam.transform.LookAt(p - r * 2.0f + Vector3.up * 0.3f);
                cam.fieldOfView = 50f;
            }
#if UNITY_EDITOR && ENABLE_INPUT_SYSTEM
            // Editor-only test aid: F2 toggles the autopilot, which plays the stage by the rules.
            var k = Keyboard.current;
            if (k != null && k.f2Key.wasPressedThisFrame && race != null)
            {
                race.SetAutopilot(!race.Autopilot);
                Debug.Log("[NerveRunner] autopilot " + (race.Autopilot ? "ON" : "OFF"));
            }
#endif
        }

        void OnApplicationPause(bool paused)
        {
            if (paused) { WriteSave(); if (race != null && ui != null && !inMenu && !ui.MinigameOpen) ui.ShowPause(); }
        }
    }
}
