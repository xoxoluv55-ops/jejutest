using System.Collections.Generic;
using UnityEngine;

namespace MuscleBattle
{
    /// <summary>
    /// Result of a Muscle Link challenge.
    ///   Perfect = every correct option and nothing wrong (PERFECT MUSCLE LINK / FORCE COUPLE COMBO / NEURAL COUNTER)
    ///   Partial = at least one correct option
    ///   Miss    = nothing correct / time out (MUSCLE LINK FAILED - the attack still fires, weak)
    /// Link is kept for save / replay compatibility and is treated like Perfect.
    /// </summary>
    public enum LinkResult { None, Perfect, Link, Partial, Miss }

    /// <summary>What a question asks (§8). OriginInsertion is reserved for Training / Advanced Battle.</summary>
    public enum QuestionKind { Action, ForceCouple, Innervation, OriginInsertion }

    /// <summary>Knowledge difficulty (§9). Rookie / Normal are used in battle now; Expert / Master are prepared for later modes.</summary>
    public enum KnowledgeLevel { Rookie, Normal, Expert, Master }

    public sealed class MuscleOption
    {
        public string Ko, En;
        public MuscleGroup Group;   // hologram overlay to light (None for nerves). Deep muscles use the nearest
                                    // overlay region (subscapularis -> anterior scapula / serratus area,
                                    // rhomboid -> under the trapezius, iliopsoas -> front of hip / core)
        public bool Correct;
        public bool Nerve;          // answer option is a nerve, not a muscle (card shows a nerve icon)
    }

    /// <summary>
    /// One muscle-knowledge prompt attached to a special / ultimate.
    /// Content follows the user's anatomy textbook first (same source as MyoForge scripts/fullbody/textbook/tb.tsv):
    /// textbook muscle names and action wording (위팔의 벌림, 종아리의 굽힘 ...), textbook innervation (no root levels).
    /// Exception: scapular upward rotation of serratus anterior is standard kinesiology (textbook: 어깨뼈의 내림(벌림),
    /// flagged for professor review in MyoForge ANATOMY_REVIEW_41 #8).
    /// </summary>
    public sealed class MuscleQuestion
    {
        public string Id;
        public QuestionKind Kind;
        public string MotionKo, MotionEn;        // title shown big ("어깨관절 벌림" / "SHOULDER ABDUCTION")
        public string PromptKo;                  // "이 동작의 주요 근육 2개를 선택하세요."
        public string TutorialKo;                // Learn stage: told BEFORE choosing (first encounter)
        public string Explanation;               // shown after the answer (short)
        public MuscleGroup ShowOnBody;           // what lights on the body after a correct answer (innervation: the muscle asked about)
        public MuscleOption[] Options;
        public float TimeLimit = 4.5f;           // seconds to answer (§3: 3-5 s), learn stage adds time

        public bool ForceCouple => Kind == QuestionKind.ForceCouple;

        public int CorrectCount
        {
            get
            {
                int n = 0;
                foreach (var o in Options) if (o.Correct) n++;
                return n;
            }
        }

        public MuscleGroup CorrectGroups
        {
            get
            {
                var g = ShowOnBody;
                foreach (var o in Options) if (o.Correct) g |= o.Group;
                return g;
            }
        }

        /// <summary>Big result banner for a perfect answer, by question kind.</summary>
        public string PerfectTitle => Kind switch
        {
            QuestionKind.ForceCouple => "FORCE COUPLE COMBO!",
            QuestionKind.Innervation => "NEURAL COUNTER!",
            _ => "PERFECT MUSCLE LINK!",
        };

        public string PerfectAnnouncer => Kind switch
        {
            QuestionKind.ForceCouple => "force_couple_combo",
            QuestionKind.Innervation => "neural_counter",
            _ => "perfect_muscle_link",
        };
    }

    /// <summary>
    /// Question pools per fighter skill (§11, §12): every fighter has a muscle theme,
    /// a match never repeats a question until the pool is used up.
    ///   Jin Hyun (shoulder / scapula / sports rehab): Shoulder Abduction (always first), External Rotation, Deltoid innervation
    ///                                                  ultimate: Scapular Upward Rotation force couple
    ///   Ray Castillo (strength / lower limb): Hip Extension, Knee Extension, Knee Flexion (hamstrings)
    ///                                          ultimate: Hip Extension
    /// </summary>
    public static class MuscleSkillDatabase
    {
        static Dictionary<string, MuscleQuestion> _byId;
        static Dictionary<string, string[]> _pools;

        static MuscleOption M(string ko, string en, MuscleGroup g, bool correct) =>
            new MuscleOption { Ko = ko, En = en, Group = g, Correct = correct };

        static MuscleOption N(string ko, string en, bool correct) =>
            new MuscleOption { Ko = ko, En = en, Group = MuscleGroup.None, Correct = correct, Nerve = true };

        public static MuscleQuestion Get(string id)
        {
            Ensure();
            return id != null && _byId.TryGetValue(id, out var q) ? q : null;
        }

        /// <summary>Question ids for a fighter's special (ultimate=false) or ultimate. Empty = no Muscle Skill.</summary>
        public static string[] Pool(string fighterId, bool ultimate)
        {
            Ensure();
            return _pools.TryGetValue(fighterId + (ultimate ? ":ult" : ":sp"), out var p) ? p : System.Array.Empty<string>();
        }

        public static IEnumerable<MuscleQuestion> All
        {
            get
            {
                Ensure();
                return _byId.Values;
            }
        }

        static void Ensure()
        {
            if (_byId != null) return;
            _byId = new Dictionary<string, MuscleQuestion>();
            foreach (var q in Build()) _byId[q.Id] = q;
            _pools = new Dictionary<string, string[]>
            {
                // first entry = the question a fighter always opens a match with (vertical slice: Shoulder Abduction)
                ["jin:sp"] = new[] { "shoulder_abduction", "shoulder_external_rotation", "deltoid_innervation" },
                ["jin:ult"] = new[] { "scapular_upward_rotation" },
                ["ray:sp"] = new[] { "hip_extension", "knee_extension", "knee_flexion" },
                ["ray:ult"] = new[] { "hip_extension", "knee_extension" },
            };
        }

        static IEnumerable<MuscleQuestion> Build()
        {
            // ---------------- Jin Hyun: shoulder / scapula ----------------
            yield return new MuscleQuestion
            {
                Id = "shoulder_abduction", Kind = QuestionKind.Action,
                MotionKo = "어깨관절 벌림", MotionEn = "SHOULDER ABDUCTION",
                PromptKo = "이 동작의 주요 근육 2개를 선택하세요.",
                TutorialKo = "위팔의 벌림은 가시위근과 어깨세모근이 담당합니다.",
                Explanation = "가시위근·어깨세모근 = 위팔의 벌림. 큰원근은 모음·안쪽돌림, 넓은등근은 폄·모음·안쪽돌림!",
                Options = new[]
                {
                    M("가시위근", "Supraspinatus", MuscleGroup.Supraspinatus, true),
                    M("어깨세모근", "Deltoid", MuscleGroup.Deltoid, true),
                    M("큰원근", "Teres Major", MuscleGroup.TeresMajor, false),
                    M("넓은등근", "Latissimus Dorsi", MuscleGroup.Latissimus, false),
                },
            };
            yield return new MuscleQuestion
            {
                Id = "shoulder_external_rotation", Kind = QuestionKind.Action,
                MotionKo = "어깨관절 가쪽돌림", MotionEn = "SHOULDER EXTERNAL ROTATION",
                PromptKo = "이 동작의 주요 근육 2개를 선택하세요.",
                TutorialKo = "위팔의 가쪽돌림은 가시아래근과 작은원근이 담당합니다.",
                Explanation = "가시아래근 + 작은원근 = 위팔의 가쪽돌림. 어깨밑근은 안쪽돌림, 큰가슴근은 굽힘·모음·안쪽돌림!",
                Options = new[]
                {
                    M("가시아래근", "Infraspinatus", MuscleGroup.Infraspinatus, true),
                    M("작은원근", "Teres Minor", MuscleGroup.TeresMinor, true),
                    M("어깨밑근", "Subscapularis", MuscleGroup.Subscapularis, false),
                    M("큰가슴근", "Pectoralis Major", MuscleGroup.Pectoralis, false),
                },
            };
            yield return new MuscleQuestion
            {
                Id = "deltoid_innervation", Kind = QuestionKind.Innervation,
                MotionKo = "어깨세모근의 지배신경", MotionEn = "DELTOID INNERVATION",
                PromptKo = "어깨세모근을 지배하는 신경 1개를 선택하세요.",
                TutorialKo = "어깨세모근은 겨드랑신경이 지배합니다.",
                Explanation = "어깨세모근 = 겨드랑신경(작은원근도 겨드랑신경). 어깨위신경은 가시위근·가시아래근, 근육피부신경은 위팔두갈래근!",
                ShowOnBody = MuscleGroup.Deltoid,
                TimeLimit = 4f,
                Options = new[]
                {
                    N("겨드랑신경", "Axillary Nerve", true),
                    N("어깨위신경", "Suprascapular Nerve", false),
                    N("근육피부신경", "Musculocutaneous Nerve", false),
                    N("노신경", "Radial Nerve", false),
                },
            };
            yield return new MuscleQuestion
            {
                Id = "scapular_upward_rotation", Kind = QuestionKind.ForceCouple,
                MotionKo = "어깨뼈 위쪽돌림", MotionEn = "SCAPULAR UPWARD ROTATION",
                PromptKo = "짝힘(Force Couple)을 이루는 근육 3개를 선택하세요.",
                TutorialKo = "어깨뼈 위쪽돌림은 등세모근 위부분·아래부분과 앞톱니근의 짝힘입니다.",
                Explanation = "등세모근 위·아래부분 + 앞톱니근 = 위쪽돌림 짝힘. 큰마름근은 어깨뼈 모음·올림!",
                TimeLimit = 5.5f,
                Options = new[]
                {
                    M("등세모근 위부분", "Upper Trapezius", MuscleGroup.TrapeziusUpper, true),
                    M("등세모근 아래부분", "Lower Trapezius", MuscleGroup.TrapeziusLower, true),
                    M("앞톱니근", "Serratus Anterior", MuscleGroup.SerratusAnterior, true),
                    M("큰마름근", "Rhomboid Major", MuscleGroup.Rhomboid, false),
                },
            };

            // ---------------- Ray Castillo: strength / lower limb ----------------
            yield return new MuscleQuestion
            {
                Id = "hip_extension", Kind = QuestionKind.Action,
                MotionKo = "엉덩관절 폄", MotionEn = "HIP EXTENSION",
                PromptKo = "이 동작의 주요 근육 2개를 선택하세요.",
                TutorialKo = "넙적다리의 폄은 큰볼기근과 반막근·반힘줄근·넙다리두갈래근이 만듭니다.",
                Explanation = "큰볼기근 + 반막근 = 넙적다리의 폄(데드리프트의 힘). 큰허리근·넙다리곧은근은 넙적다리의 굽힘!",
                Options = new[]
                {
                    M("큰볼기근", "Gluteus Maximus", MuscleGroup.Gluteus, true),
                    M("반막근", "Semimembranosus", MuscleGroup.MedialHamstrings, true),
                    M("큰허리근", "Psoas Major", MuscleGroup.PsoasMajor, false),
                    M("넙다리곧은근", "Rectus Femoris", MuscleGroup.RectusFemoris, false),
                },
            };
            yield return new MuscleQuestion
            {
                Id = "knee_extension", Kind = QuestionKind.Action,
                MotionKo = "무릎관절 폄", MotionEn = "KNEE EXTENSION",
                PromptKo = "이 동작의 주요 근육 2개를 선택하세요.",
                TutorialKo = "종아리의 폄은 넙다리곧은근과 가쪽·안쪽·중간넓은근이 담당합니다.",
                Explanation = "넙다리곧은근 + 가쪽넓은근 = 종아리의 폄(넙다리신경). 넙다리두갈래근·장딴지근은 종아리의 굽힘!",
                Options = new[]
                {
                    M("넙다리곧은근", "Rectus Femoris", MuscleGroup.RectusFemoris, true),
                    M("가쪽넓은근", "Vastus Lateralis", MuscleGroup.VastusLateralis, true),
                    M("넙다리두갈래근", "Biceps Femoris", MuscleGroup.BicepsFemoris, false),
                    M("장딴지근", "Gastrocnemius", MuscleGroup.Gastrocnemius, false),
                },
            };
            yield return new MuscleQuestion
            {
                Id = "knee_flexion", Kind = QuestionKind.Action,
                MotionKo = "무릎관절 굽힘", MotionEn = "KNEE FLEXION",
                PromptKo = "이 동작의 주요 근육 2개를 선택하세요.",
                TutorialKo = "종아리의 굽힘은 넙다리두갈래근·반힘줄근·반막근이 담당합니다.",
                Explanation = "넙다리두갈래근 + 반힘줄근 = 종아리의 굽힘(궁둥신경). 넙다리곧은근은 종아리의 폄, 중간볼기근은 넙적다리의 벌림!",
                Options = new[]
                {
                    M("넙다리두갈래근", "Biceps Femoris", MuscleGroup.BicepsFemoris, true),
                    M("반힘줄근", "Semitendinosus", MuscleGroup.MedialHamstrings, true),
                    M("넙다리곧은근", "Rectus Femoris", MuscleGroup.RectusFemoris, false),
                    M("중간볼기근", "Gluteus Medius", MuscleGroup.GluteusMedius, false),
                },
            };
        }

        // ------------------------------------------------------------------
        // Learn -> Practice -> Recall progress + muscle mastery records (§10, §16, §17)
        // ------------------------------------------------------------------
        /// <summary>0 = Learn (answer told first), 1 = Practice (one hint), 2 = Recall (no hint).</summary>
        public static int Stage(MuscleQuestion q) => Mathf.Clamp(PlayerPrefs.GetInt("mb.q." + q.Id + ".seen", 0), 0, 2);

        public static void RecordAnswer(MuscleQuestion q, LinkResult r)
        {
            string key = "mb.q." + q.Id;
            PlayerPrefs.SetInt(key + ".seen", PlayerPrefs.GetInt(key + ".seen", 0) + 1);
            if (r == LinkResult.Perfect || r == LinkResult.Link)
            {
                PlayerPrefs.SetInt(key + ".correct", PlayerPrefs.GetInt(key + ".correct", 0) + 1);
                // every correctly named muscle is "collected" (future MUSCLE COLLECTION / mastery levels)
                foreach (var o in q.Options)
                    if (o.Correct)
                    {
                        string m = "mb.muscle." + o.En.Replace(" ", "_").ToLowerInvariant();
                        PlayerPrefs.SetInt(m + ".correct", PlayerPrefs.GetInt(m + ".correct", 0) + 1);
                    }
            }
            PlayerPrefs.Save();
        }
    }
}
