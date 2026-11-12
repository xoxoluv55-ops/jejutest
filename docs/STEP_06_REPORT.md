# STEP 06 보고서 — Muscle Knowledge System을 실제 전투 루프에 연결

목표: **전투 → 게이지 → Muscle Skill → 근육 문제 → 선택 → LINK! → 판정 → 기술 변화 → 실제 공격**이 Play Mode에서 눈으로 확인될 것.

## 1. 현재 구현 조사 결과 (§18)

| 질문 | 수정 전 | 원인 / 조치 |
|---|---|---|
| 1. Fighter input과 연결? | 연결됨 (Special → `StartMove("special")` → `OnMoveStarted` → `TryBegin`) | 유지 |
| 2. Trigger 조건? | Special 버튼 + 게이지 100 (얼티밋 300) | 유지. 게이지 1칸이 차면 **"MUSCLE SKILL READY ▶ I · RB"** 안내 + 콜아웃 + 아나운서 추가 |
| 3. Special Gauge 연결? | 연결됨. 다만 타격당 8이라 1칸이 늦고, 1칸 도달 안내가 없었음 | 타격당 11로 상향, 1칸 도달 시 알림 |
| 4. 문제 UI가 Runtime에 생성? | 생성됨. **단, 문제가 Jin 스페셜 1개뿐** — Ray를 쓰거나 얼티밋을 쓰면 문제가 아예 안 나옴 | 캐릭터별 문제 Pool (Jin 4개, Ray 3개) |
| 5. Select → Battle에서 MuscleSkillSystem 생성? | 생성됨 (`GameModeManager.BuildSystems`) | 유지 |
| 6. UI가 다른 Canvas 뒤에 가려지는가? | **가려짐** — HUD 안에 있어서 나중에 만든 터치 버튼·일시정지 버튼이 위에 그려짐 | 열릴 때 캔버스 최상단으로 이동 |
| 7. TimeScale 이후 input? | 정상 (unscaled time, 선택자의 입력은 MuscleSkillSystem만 읽음) | 유지. 터치 컨트롤은 열려 있는 동안 비활성 |
| 8. 판정 후 Attack State 복귀? | 정상 (MoveHeld 해제 → 기술 발동) | 유지 |

## 2. 구현한 것

**MUSCLE LINK CHALLENGE UI (전면 재작성)**
- 상단: `MUSCLE LINK CHALLENGE` 플레이트, 동작명 크게(`SHOULDER ABDUCTION` + `어깨관절 벌림`), 질문 "이 동작의 주요 근육 2개를 선택하세요."
- 카드 4장(330×390, iPad 약 180pt): **실제 캐릭터 몸의 3D anatomy render**(해당 근육만 홀로그램으로 빛나고 몸은 어두운 x-ray), 한글 + English, 키 표시, 선택 glow·순번, hover/tap 확대
- 신경 문제는 신경 아이콘 카드
- `LINK!` 버튼: 필요한 개수를 고르면 금색으로 펄스. 키보드 I / 패드 RB / 탭·클릭
- 배경 전투는 0.2배속으로 계속 진행되고, 선택 중인 캐릭터는 무적·정지. 답변 시간 4.5초(학습 단계 +1.5초)

**판정과 효과 (§6, §13)**
| 결과 | 조건 | 효과 |
|---|---|---|
| PERFECT MUSCLE LINK! | 정답 모두 + 오답 없음 | 데미지 +35%, 콤보 +1타(짝힘 +2타, 연장타는 40%), 게이지 +35, 회복 프레임 -8, 근육 홀로그램 + 에너지 집중, 아나운서 |
| PARTIAL LINK | 1개 이상 정답 | 스킬 발동, 데미지 -15%, 연장 없음 |
| MUSCLE LINK FAILED | 정답 없음 / 시간 초과 | 약한 버전으로 발동(데미지 -40%) — 전투는 끊기지 않음 |

- 판정 후 **정답 근육이 캐릭터 몸 위에서 빛나고, 이름표가 선으로 해당 위치를 가리킵니다**(§7). 실패해도 "정답 · ○○" 이름표가 나와 학습이 됩니다.
- 문제 유형별 결과 이름: 짝힘 → `FORCE COUPLE COMBO!`, 신경 → `NEURAL COUNTER!`.

**문제 Pool과 확장 구조 (§8, §11, §12)**
- Jin(어깨·견갑): 어깨관절 벌림(항상 첫 문제) · 어깨관절 가쪽돌림 · 어깨세모근 지배신경(겨드랑신경) / 얼티밋: 어깨뼈 위쪽돌림 짝힘(위·아래 등세모근 + 앞톱니근, 3개 선택)
- Ray(하지·근력): 엉덩관절 폄 · 무릎관절 폄 · 무릎관절 굽힘 / 얼티밋: 엉덩관절 폄 · 무릎관절 폄
- 한 판 안에서는 Pool을 다 쓸 때까지 같은 문제가 반복되지 않습니다.
- `QuestionKind`(Action / ForceCouple / Innervation / OriginInsertion)와 `KnowledgeLevel`(Rookie / Normal / Expert / Master) 구조를 준비했습니다. MATCH SETTINGS에 KNOWLEDGE(ROOKIE 그림+이름 / NORMAL 이름만)를 추가했습니다.

**Learn → Practice → Recall (§10)**: 첫 등장 = 설명 배너 + 정답 ★ 표시, 두 번째 = 힌트 1개, 세 번째부터 힌트 없음.
**Mastery 기록 (§16, §17 준비)**: 정답 근육별 정답 횟수를 저장합니다(`mb.muscle.<name>.correct`). 이후 도감·숙련도가 이 값을 씁니다.

## 3. Unity Play Mode 실제 테스트 (2026-11-13, Unity 6000.6.7f1, 사용자 PC)

| Test | 결과 | 확인한 것 |
|---|---|---|
| 1 전투 시작 | ✅ | 1P vs CPU, 2P 모두 시작 |
| 2 게이지 충전 | ✅ | 실제 타격으로 충전(CPU Ray가 먼저 1칸 → 스킬 사용), "MUSCLE SKILL READY ▶ I · RB" 표시. 시간 단축을 위해 디버그 키도 사용 |
| 3 Muscle Skill 버튼 | ✅ | I 키 → 챌린지 열림 |
| 4 근육 카드 4장 | ✅ | SHOULDER ABDUCTION, 3D 근육 렌더 카드, LEARN / PRACTICE / RECALL 단계 표시 |
| 5 가시위근 + 어깨세모근 선택 | ✅ | 마우스 클릭(탭과 같은 경로)과 키보드 둘 다. SELECTED 1·2, LINK! 활성화 |
| 6 PERFECT MUSCLE LINK | ✅ | 결과 배너 + 효과 문구, 정답 카드 표시 |
| 7 캐릭터 근육 hologram | ✅ | 어깨에 홀로그램, "어깨세모근 Deltoid" · "가시위근 Supraspinatus" 이름표가 선으로 위치를 가리킴 |
| 8 강화 공격 | ✅ | Shoulder Abduction Rush 5연타(4 + 1), 285 데미지, 다운 |
| 9 틀린 조합 → FAILED | ✅ | 신경 문제에서 오답 → MUSCLE LINK FAILED, 약한 공격 발동, "정답 · 겨드랑신경" 이름표 |
| 10 일반 전투 복귀 | ✅ | 바로 이동·공격 가능, 타이머 정상 |
| Console | ✅ | 런타임 에러 0 / 경고 0. 프로젝트를 열 때 나오는 에디터 씬 생성 메시지 1건은 기존 문제로, 게임 코드와 무관 |

테스트 중 발견해서 고친 것:
- PERFECT 연장타가 풀 데미지라서 단발 스페셜(Ray)이 사실상 2배가 됨 → 연장타 40%
- 3D 근육 카드가 과노출이라 빛나는 근육이 안 보임 → 몸을 어두운 x-ray로 렌더
- 에디터에서 F1(디버그 키)이 Unity 도움말을 열어 입력을 뺏음 → 디버그 키를 F8/F9로 변경

**플레이 테스트용 키 (Editor / Development 빌드 전용)**: F8 = P1 게이지 MAX, F9 = P2 게이지 MAX, F10 = 답변 시간 60초 토글(UI 확인용).

## 4. 아직 안 한 것 (다음 단계)

- **MUSCLE CLASH (§14, 2P 동시 스킬 대결)**: 지금은 한 명이 문제를 푸는 동안 상대의 스킬은 문제 없이 발동합니다.
- **Training Mode (§15)**, **Muscle Mastery 레벨 화면 (§16)**, **MUSCLE COLLECTION 도감 (§17)**: 저장 구조만 준비했습니다.
- Expert / Master 난이도, 기시·정지 문제.
- 균형: CPU(보통)가 게이지가 차자마자 스킬을 쓰고 정답률이 높아서 꽤 셉니다. 실제 플레이 후 조정이 필요합니다.
