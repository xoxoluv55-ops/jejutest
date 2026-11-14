// NERVE RUNNER - learning data model (pure C#). The question bank lives in JSON under
// Resources/NerveRunner/ and is parsed by Unity's JsonUtility (see QuestionLoader), so content
// can be edited without touching game code.
using System;
using System.Collections.Generic;

namespace NerveRunner.Core
{
    [Serializable]
    public class Question
    {
        public string id;
        public int chapter;
        public string topic;
        public string difficulty;          // Rookie | Normal | Expert | Master
        public string objective;           // learning objective
        public string question;
        public string[] options;
        public int answer;                 // index into options
        public string explanation;         // shown on correct and on wrong
        public string[] wrongExplanations; // per option (may be shorter than options / empty strings)
        public string[] structures;        // related codex ids
        public string branch;              // which track element uses this question
        public string reference;           // textbook / source note

        public string WrongExplanation(int chosen)
        {
            if (wrongExplanations != null && chosen >= 0 && chosen < wrongExplanations.Length &&
                !string.IsNullOrEmpty(wrongExplanations[chosen])) return wrongExplanations[chosen];
            return "";
        }
    }

    [Serializable]
    public class QuestionFile { public Question[] questions; }

    [Serializable]
    public class CodexEntry
    {
        public string id;
        public string name;
        public string english;
        public string category;
        public int chapter;
        public string description;
        public string gameLink;      // where it appears in the race
    }

    [Serializable]
    public class CodexFile { public CodexEntry[] entries; }

    [Serializable]
    public class StoryLine { public string speaker; public string text; }

    [Serializable]
    public class StoryBeat { public string id; public StoryLine[] lines; }

    [Serializable]
    public class StoryFile { public StoryBeat[] beats; }

    public class QuestionBank
    {
        readonly Dictionary<string, Question> byId = new Dictionary<string, Question>();
        public readonly List<Question> all = new List<Question>();

        public QuestionBank(IEnumerable<Question> qs)
        {
            foreach (var q in qs)
            {
                if (q == null || string.IsNullOrEmpty(q.id)) continue;
                byId[q.id] = q;
                all.Add(q);
            }
        }

        public Question Get(string id)
        {
            Question q;
            return id != null && byId.TryGetValue(id, out q) ? q : null;
        }

        /// Validation used by tests and at load: every question must have >=2 options and a
        /// valid answer index. Returns human-readable problems (empty = OK).
        public List<string> Validate()
        {
            var errs = new List<string>();
            foreach (var q in all)
            {
                if (q.options == null || q.options.Length < 2) errs.Add(q.id + ": needs >=2 options");
                else if (q.answer < 0 || q.answer >= q.options.Length) errs.Add(q.id + ": answer index out of range");
                if (string.IsNullOrEmpty(q.question)) errs.Add(q.id + ": empty question");
                if (string.IsNullOrEmpty(q.explanation)) errs.Add(q.id + ": empty explanation");
            }
            return errs;
        }
    }

    //================== SAVE DATA (JsonUtility-friendly) ==================\\
    [Serializable]
    public class WrongNote
    {
        public string questionId;
        public int chosen;
        public int wrongCount;
        public int retryCount;        // times answered again after being wrong
        public bool resolved;         // later answered correctly
        public string lastDate;
    }

    [Serializable]
    public class StageRecord
    {
        public string stageId;
        public float bestTime = -1f;
        public int bestStars;
        public float bestAccuracy;
        public int plays;
        public int clears;
    }

    [Serializable]
    public class TopicMastery { public string topic; public int correct; public int total; }

    [Serializable]
    public class SaveData
    {
        public int version = 1;
        public int totalCoins;
        public List<StageRecord> stages = new List<StageRecord>();
        public List<WrongNote> wrongNotes = new List<WrongNote>();
        public List<TopicMastery> mastery = new List<TopicMastery>();
        public List<string> codexUnlocked = new List<string>();
        public bool storySeen;
        public string lastStage = "ch1";
        // settings
        public bool sfxOn = true;
        public bool musicOn = true;
        public float steerSensitivity = 1f;
        public bool showHints = true;
        public int graphicsQuality = -1;     // -1 auto, 0 Low, 1 Medium, 2 High (2.0)
        public float cameraShake = 1f;       // 0 off, 0.5 weak, 1 normal (2.0)

        public StageRecord Stage(string id)
        {
            foreach (var s in stages) if (s.stageId == id) return s;
            var r = new StageRecord { stageId = id };
            stages.Add(r);
            return r;
        }

        public TopicMastery Topic(string t)
        {
            foreach (var m in mastery) if (m.topic == t) return m;
            var r = new TopicMastery { topic = t };
            mastery.Add(r);
            return r;
        }

        public WrongNote Note(string qid)
        {
            foreach (var n in wrongNotes) if (n.questionId == qid) return n;
            return null;
        }
    }

    /// One answer given during a run.
    public struct AnswerRecord
    {
        public string questionId;
        public int chosen;
        public bool correct;
        public float time;
    }

    /// Learning state of a single run, merged into SaveData on finish.
    public class LearningSession
    {
        public readonly QuestionBank bank;
        public readonly List<AnswerRecord> answers = new List<AnswerRecord>();
        public readonly HashSet<string> codexSeen = new HashSet<string>();

        public LearningSession(QuestionBank bank) { this.bank = bank; }

        public int Correct { get { int c = 0; foreach (var a in answers) if (a.correct) c++; return c; } }
        public int Total { get { return answers.Count; } }
        public float Accuracy { get { return answers.Count == 0 ? 1f : Correct / (float)answers.Count; } }

        /// Records an answer and returns whether it was correct.
        public bool Answer(string questionId, int chosen, float time)
        {
            var q = bank.Get(questionId);
            bool ok = q != null && chosen == q.answer;
            answers.Add(new AnswerRecord { questionId = questionId, chosen = chosen, correct = ok, time = time });
            if (q != null && q.structures != null) foreach (var s in q.structures) codexSeen.Add(s);
            return ok;
        }

        public List<AnswerRecord> Wrong()
        {
            var l = new List<AnswerRecord>();
            foreach (var a in answers) if (!a.correct) l.Add(a);
            return l;
        }

        /// Merge into persistent save. Returns the number of wrong notes added/updated.
        public int MergeInto(SaveData save, string date)
        {
            int changed = 0;
            foreach (var a in answers)
            {
                var q = bank.Get(a.questionId);
                if (q != null)
                {
                    var m = save.Topic(q.topic ?? "기타");
                    m.total++; if (a.correct) m.correct++;
                }
                var note = save.Note(a.questionId);
                if (!a.correct)
                {
                    if (note == null) { note = new WrongNote { questionId = a.questionId }; save.wrongNotes.Add(note); }
                    else note.retryCount++;
                    note.chosen = a.chosen; note.wrongCount++; note.resolved = false; note.lastDate = date;
                    changed++;
                }
                else if (note != null)
                {
                    note.retryCount++; note.resolved = true; note.lastDate = date;
                    changed++;
                }
            }
            foreach (var c in codexSeen) if (!save.codexUnlocked.Contains(c)) save.codexUnlocked.Add(c);
            return changed;
        }
    }
}
