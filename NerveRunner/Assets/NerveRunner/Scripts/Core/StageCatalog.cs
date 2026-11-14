// NERVE RUNNER - list of playable stages. Each stage = a course builder (driven by its question
// data) + presentation settings. Adding a stage = a Layout class + JSON content + one entry here.
using System;
using System.Collections.Generic;

namespace NerveRunner.Core
{
    public class StageInfo
    {
        public string id;
        public int chapter;
        public string title;            // "뉴런과 신경신호"
        public string subtitle;         // shown on the stage card
        public string introStory;       // story beat shown as the blocking prologue
        public string gateTitle;        // banner title for gate questions
        public bool boss;               // NULL boss arena (boss HP = boss gates)
        public string[] goals;          // learning goals on the stage card
        public Func<QuestionBank, TrackGraph> build;
    }

    public static class StageCatalog
    {
        public static readonly StageInfo[] All =
        {
            new StageInfo
            {
                id = Chapter1Layout.StageId, chapter = 1, title = "뉴런과 신경신호", subtitle = "뉴런 고속도로",
                introStory = "prologue", gateTitle = "활동전위 게이트",
                goals = new[] { "뉴런의 구조", "활동전위", "도약전도", "시냅스 전달" },
                build = Chapter1Layout.Build,
            },
            new StageInfo
            {
                id = Chapter7Layout.StageId, chapter = 7, title = "대뇌", subtitle = "대뇌 도시",
                introStory = "ch7_intro", gateTitle = "대뇌 기능 게이트",
                goals = new[] { "대뇌엽의 위치", "일차운동·감각겉질", "청각·시각겉질", "언어 영역과 실어증" },
                build = Chapter7Layout.Build,
            },
            new StageInfo
            {
                id = Chapter9Layout.StageId, chapter = 9, title = "임상 챌린지 (NULL)", subtitle = "NULL 보스 아레나",
                introStory = "ch9_intro", gateTitle = "NULL 진단 게이트", boss = true,
                goals = new[] { "병변 위치 추론", "교차와 반대쪽 증상", "위·아래운동신경세포", "척수 반쪽 손상" },
                build = Chapter9Layout.Build,
            },
        };

        public static readonly string[] ContentSuffixes = { "ch1", "ch7", "ch9" };

        public static StageInfo Get(string id)
        {
            foreach (var s in All) if (s.id == id) return s;
            return null;
        }

        public static StageInfo ByChapter(int chapter)
        {
            foreach (var s in All) if (s.chapter == chapter) return s;
            return null;
        }
    }
}
