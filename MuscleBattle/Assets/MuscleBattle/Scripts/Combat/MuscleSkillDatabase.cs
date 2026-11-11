using System.Collections.Generic;

namespace MuscleBattle
{
    public enum LinkResult { None, Perfect, Link, Partial, Miss }

    public sealed class MuscleOption
    {
        public string Ko, En;
        public MuscleGroup Group;
        public bool Correct;
        public string Image; // key for ProceduralTextures.MuscleIcon
    }

    /// <summary>
    /// One muscle-knowledge prompt attached to a special / ultimate (§9, §11).
    /// Content is limited to standard textbook kinesiology (prime movers / force couples);
    /// no unverified anatomical coordinates are used (§14).
    /// </summary>
    public sealed class MuscleQuestion
    {
        public string Id;
        public string MotionKo, MotionEn;
        public bool ForceCouple;
        public MuscleOption[] Options;
        public string Explanation;
        public float PerfectWithin = 2.2f; // seconds: correct + fast = PERFECT timing (§21)

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
                var g = MuscleGroup.None;
                foreach (var o in Options) if (o.Correct) g |= o.Group;
                return g;
            }
        }
    }

    public static class MuscleSkillDatabase
    {
        static Dictionary<string, MuscleQuestion> _byKey;

        /// <summary>Question for a fighter's special (ultimate=false) or ultimate (ultimate=true).</summary>
        public static MuscleQuestion For(string fighterId, bool ultimate)
        {
            _byKey ??= Build();
            return _byKey.TryGetValue(fighterId + (ultimate ? ":ult" : ":sp"), out var q) ? q : null;
        }

        static MuscleOption O(string ko, string en, MuscleGroup g, bool correct, string image) =>
            new MuscleOption { Ko = ko, En = en, Group = g, Correct = correct, Image = image };

        /// <summary>
        /// Vertical slice: exactly ONE Muscle Skill (Shoulder Abduction on Jin's special).
        /// Next candidates are added one at a time only after this one is play-tested:
        /// Elbow Flexion, Elbow Extension, Hip Extension, Knee Extension, Ankle Dorsiflexion, Scapular Upward Rotation.
        /// </summary>
        static Dictionary<string, MuscleQuestion> Build() => new Dictionary<string, MuscleQuestion>
        {
            ["jin:sp"] = new MuscleQuestion
            {
                Id = "shoulder_abduction",
                MotionKo = "어깨 외전", MotionEn = "Shoulder Abduction",
                Options = new[]
                {
                    O("가시위근", "Supraspinatus", MuscleGroup.Supraspinatus, true, "supraspinatus"),
                    O("어깨세모근", "Deltoid", MuscleGroup.Deltoid, true, "deltoid"),
                    O("큰원근", "Teres Major", MuscleGroup.Latissimus, false, "teres_major"),
                    O("넓은등근", "Latissimus Dorsi", MuscleGroup.Latissimus, false, "latissimus"),
                },
                Explanation = "정답: 가시위근 + 어깨세모근 — 가시위근이 외전을 시작(초기 약 15°)하고 어깨세모근 중간섬유가 이어받습니다. 큰원근·넓은등근은 내전·신전 근육!",
            },
        };
    }
}
