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
            Quiz(2, "spinal", "척수와 반사", "척수 반사 회로", new[] { "척수의 구조", "반사궁", "신장반사", "상호억제·굽힘반사" },
                 new[] { "story:ch2_intro", "codex:ventral_horn", "warm", "fork:ch2_fork_horn", "gate:ch2_gate_drg", "codex:stretch_reflex", "gate:ch2_gate_spindle", "hairpin", "gate:ch2_gate_monosyn", "codex:reflex_arc", "fork:ch2_fork_arc", "obstacles", "codex:reciprocal_inhibition", "gate:ch2_gate_reciprocal", "codex:flexor_reflex", "gate:ch2_gate_flexor", "story:ch2_final", "finish" }),
            Quiz(3, "tract", "감각 오름로·운동 내림로", "신경로 고속도로", new[] { "뒤기둥-안쪽섬유띠계", "앞가쪽계", "겉질척수로", "교차 위치" },
                 new[] { "story:ch3_intro", "codex:dcml", "warm", "fork:ch3_fork_dcml", "gate:ch3_gate_dcml_cross", "codex:spinothalamic", "gate:ch3_gate_stt_cross", "orbs", "codex:spinocerebellar", "gate:ch3_gate_scb", "hairpin", "codex:cst", "fork:ch3_fork_cst", "gate:ch3_gate_cst_cross", "obstacles", "codex:vestibulospinal", "gate:ch3_gate_vst", "story:ch3_final", "finish" }),
            Quiz(4, "brainstem", "뇌줄기", "뇌줄기 터널", new[] { "중간뇌 구조", "다리뇌와 소뇌 연결", "숨뇌 생명 중추", "뇌줄기 뇌신경핵" },
                 new[] { "story:ch4_intro", "codex:midbrain", "warm", "codex:substantia_nigra", "gate:ch4_gate_sn", "gate:ch4_gate_sc", "fork:ch4_fork_ic", "hairpin", "gate:ch4_gate_aqueduct", "gate:ch4_gate_cn_midbrain", "codex:pons", "fork:ch4_fork_pons", "obstacles", "codex:medulla", "gate:ch4_gate_medulla", "story:ch4_final", "finish" }),
            Quiz(5, "cerebellum", "소뇌", "소뇌 균형 서킷", new[] { "소뇌의 기능", "조롱박세포", "소뇌다리", "소뇌 증상" },
                 new[] { "story:ch5_intro", "codex:cerebellum", "warm", "gate:ch5_gate_function", "hairpin", "codex:purkinje", "gate:ch5_gate_purkinje", "codex:cerebellar_peduncles", "fork:ch5_fork_mcp", "gate:ch5_gate_scp", "hairpin", "obstacles", "gate:ch5_gate_vermis", "gate:ch5_gate_tremor", "story:ch5_final", "finish" }),
            Quiz(6, "diencephalon", "사이뇌", "사이뇌 중계 기지", new[] { "시상 중계핵", "시상하부 항상성", "뇌하수체 조절", "솔방울샘" },
                 new[] { "story:ch6_intro", "codex:thalamus", "warm", "fork:ch6_fork_thalamus", "gate:ch6_gate_vpl", "gate:ch6_gate_lgn", "orbs", "codex:hypothalamus", "fork:ch6_fork_hypothal", "hairpin", "gate:ch6_gate_pituitary", "obstacles", "codex:pineal", "gate:ch6_gate_pineal", "story:ch6_final", "finish" }),
            new StageInfo
            {
                id = Chapter7Layout.StageId, chapter = 7, title = "대뇌", subtitle = "대뇌 도시",
                introStory = "ch7_intro", gateTitle = "대뇌 기능 게이트",
                goals = new[] { "대뇌엽의 위치", "일차운동·감각겉질", "청각·시각겉질", "언어 영역과 실어증" },
                build = Chapter7Layout.Build,
            },
            Quiz(8, "cranial", "12뇌신경", "12뇌신경 포털", new[] { "눈 운동 신경", "얼굴의 신경", "감각·운동·혼합 분류", "아래 뇌신경" },
                 new[] { "story:ch8_intro", "codex:cn_overview", "warm", "gate:ch8_gate_sensory", "codex:cn_eye", "gate:ch8_gate_abducens", "gate:ch8_gate_trochlear", "hairpin", "codex:cn_face", "fork:ch8_fork_facial", "gate:ch8_gate_trigeminal", "obstacles", "codex:cn_lower", "fork:ch8_fork_hypoglossal", "gate:ch8_gate_vagus", "gate:ch8_gate_accessory", "story:ch8_final", "finish" }),
            new StageInfo
            {
                id = Chapter9Layout.StageId, chapter = 9, title = "임상 챌린지 (NULL)", subtitle = "NULL 보스 아레나",
                introStory = "ch9_intro", gateTitle = "NULL 진단 게이트", boss = true,
                goals = new[] { "병변 위치 추론", "교차와 반대쪽 증상", "위·아래운동신경세포", "척수 반쪽 손상" },
                build = Chapter9Layout.Build,
            },
        };

        public static readonly string[] ContentSuffixes = { "ch1", "ch2", "ch3", "ch4", "ch5", "ch6", "ch7", "ch8", "ch9" };

        /// A "learn & race" chapter built by QuizCourseLayout from a list of steps.
        static StageInfo Quiz(int ch, string theme, string title, string subtitle, string[] goals, string[] steps)
        {
            return new StageInfo
            {
                id = "ch" + ch, chapter = ch, title = title, subtitle = subtitle,
                introStory = "ch" + ch + "_intro", gateTitle = title + " 게이트", goals = goals,
                build = bank => QuizCourseLayout.Build(bank, theme, subtitle, steps),
            };
        }

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
