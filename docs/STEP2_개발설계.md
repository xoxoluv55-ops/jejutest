# STEP 2. NERVE RUNNER 개발 설계 (Neon Racer 기반)

## 1. 전체 구조

```
NerveRunner/Assets/
├─ NerveRunner/
│  ├─ Scripts/Core/      ← 순수 C# (Vector3/Mathf만 사용) — Unity 없이 테스트 가능
│  │   TrackModel.cs        트랙 그래프: 구간·갈림길·이벤트, 프레임 샘플링(위치/접선/곡률)
│  │   TrackPathBuilder.cs  재사용 트랙 모듈: 직선·코너·급커브·갈림길·게이트·수초·손상·시냅스·체크포인트·결승
│  │   Chapter1Layout.cs    CH.1 "뉴런 고속도로" 코스 (문제 데이터가 갈림길 형태를 결정)
│  │   RunnerSim.cs         STAR-01 이동: 자동 전진·조향·원심력·벽·점프·드리프트·부스트·이벤트 판정
│  │   AutoPilot.cs         테스트/데모용 자동 조종 (사람과 같은 규칙으로 플레이)
│  │   Learning.cs          문제·도감·스토리 데이터 모델, 학습 세션, 오답노트·저장 데이터
│  ├─ Scripts/Unity/     ← 화면 표현 (MonoBehaviour)
│  │   GameRoot.cs          부트스트랩 + 앱 상태 (타이틀/스테이지/레이스/결과), 저장
│  │   RaceController.cs    레이스 1회: 시뮬 스텝 → 이벤트 → 학습/뷰/오디오/HUD 연결
│  │   StarVisual.cs        STAR-01 (절차 메시, 표정, 궤도 링, 발광, 잔상)
│  │   TrackView.cs         도로·레일·수초 터널·게이트·표지판·링·NULL 블록·시냅스 다리
│  │   NeuralBackdrop.cs    신경망 배경(뉴런·가지돌기), 안개, 조명
│  │   ChaseCamera.cs       추적 카메라 (Neon Racer 각색)
│  │   RaceInput.cs         iPad 터치 버튼 + 키보드
│  │   GameUI*.cs           모든 화면 (메뉴·HUD·미니게임)
│  │   UIKit.cs, MeshKit.cs, GameAudio.cs
│  └─ Resources/NerveRunner/  questions_ch1.json · codex_ch1.json · story_ch1.json (코드와 분리된 학습 콘텐츠)
├─ ThirdParty/NeonRacer/  재사용 원본(MIT) + LICENSE
├─ Settings/              URP 파이프라인 에셋 (Neon Racer)
└─ Scenes/NerveRunner.unity  빈 씬 — 모든 것은 GameRoot가 코드로 생성
```

권장 시스템 이름과의 대응: PlayerController/DriftController/BoostController/SaltatoryConductionController → `RunnerSim`(하나의 결정적 시뮬레이션), StarVisualController → `StarVisual`, CameraController → `ChaseCamera`, TrackManager/TrackBranchController → `TrackModel`+`TrackPathBuilder`+`TrackView`, SynapseMinigameController → `GameUI.Minigame`, LearningEventManager → `RaceController`, QuestionDatabase → `QuestionBank`+JSON, StageManager → `GameRoot`, UIManager → `GameUI`, SaveManager → `GameRoot.LoadSave/WriteSave`+`SaveData`.

**왜 시뮬레이션과 화면을 나눴나:** 갈림길 선택·게이트 정답 판정·드리프트·충돌 같은 핵심 규칙이 Unity 없이도 결정적으로 실행·테스트되도록 하기 위함입니다. 같은 코드가 게임과 테스트에서 그대로 쓰입니다.

## 2. 별 캐릭터 교체 계획 (구현됨)
- 차량(박스+바퀴 조립) → **STAR-01**: 둥근 다섯 꼭짓점의 볼록한 별 메시(극좌표 반지름 함수 + 돔형 두께), 노란 발광 머티리얼, 검은 눈·하이라이트·볼터치·입, 뒷면의 청록 신경 "핏줄", 진주 3개가 도는 궤도 링, 점광원, 잔상(TrailRenderer).
- 동작은 Transform만 사용: 부유 흔들림, 좌우 기울기, 드리프트 요, 점프 시 한 바퀴 회전, 부스트 진동, 쇼케이스 회전.
- 표정 7종: 기본·집중·신남·놀람·아픔(오답)·치유·클리어 + 자동 눈 깜빡임.

## 3. 신경망 트랙 교체 계획 (구현됨)
- 도시·지형 → 짙은 남색 공간에 떠 있는 **신경섬유 도로**(네온 가장자리, 막 무늬 텍스처) + 배경 뉴런 60개.
- 구간 색: 일반=청록, 수초=금색, 손상=빨강, 지름길=초록, 복습=주황, 갈림길 접근=분홍, 시냅스=보라.

## 4. 레이싱 시스템 수정 (구현됨)
| 요소 | 규칙 |
|---|---|
| 자동 전진 | 최고 40 m/s(약 144 km/h), 구간·부스트·터보·패널티 배율 |
| 코너링 | 원심 밀림 = 곡률 × 속도² × 접지계수. 급커브(반경 38 m)는 드리프트 없이 벽에 닿기 쉬움 |
| 드리프트 | 버튼 유지 + 조향 → 접지계수 0.30→0.07, 조향 1.4배. 코너 방향 정확도에 따라 시간 누적 → 놓을 때 미니 터보 Lv1~3 + 에너지 |
| 부스터 | 에너지 소모(0.42/s), 1.4배 속도, FOV 확대, 발광 증가, 잔상 증가. 빈 탱크는 20% 재충전 전까지 잠김(원본 히스테리시스) |
| 점프 | NULL 블록(전폭) 회피 |
| 갈림길 | 끝 지점의 횡위치로 차선 결정 → 해당 구간으로 실제 진입. 정답=짧은 지름길+오브, 오답=긴 우회로(속도 0.7배)+해설 |
| 벽 | 충돌 시 속도 20% 감소, 긁힘 감속 |

## 5. 학습 시스템 연결 (구현됨)
| 코스 요소 | 학습 내용 | 게임 결과 |
|---|---|---|
| 가지돌기·세포체 구간 | 신호 수신, 가중 | 도감 등록 |
| 갈림길 1 (2지선다) | 방아쇠 영역 = 축삭둔덕 | 지름길 / 복습 구간 |
| 활동전위 게이트 ×4 (3지선다) | 탈분극(Na+ 유입) → 재분극(K+ 유출) → 과분극 → Na+-K+ 펌프 | 터보+에너지 / 감속 |
| 말이집 축삭 터널 | 랑비에 결절 링 연속 통과 = 결절마다 활동전위 재생성 → 연속 보너스 최대 +60% | 실제 도약전도를 "순간이동"으로 설명하지 않음 |
| 갈림길 2 (3지선다) | 활동전위 재생성 위치 = 랑비에 결절 | 지름길 / 복습 |
| 수초 손상 구간 | 탈수초 = 전도 지연(속도 0.7배), NULL 블록, 복구 오브 3개 | 오브마다 +10% 회복 |
| 복구 게이트 | CNS 수초 = 희소돌기아교세포 (슈반세포·별아교세포와 구별) | 정답 시 완전 복구 |
| 시냅스 미니게임 | 전달 5단계 순서 + EPSP/IPSP | 성공 시 전달물질 다리 + 가속 |
| 결과 화면 | 주제별 학습 완료/복습 필요 | 오답 자동 저장 |

문제 데이터 필드: ID, 챕터, 주제, 난이도(Rookie/Normal/Expert/Master), 학습 목표, 질문, 선택지, 정답, 해설, 선택지별 오답 해설, 관련 구조(도감 ID), 연결 트랙 분기, 참고 자료.
저장 데이터: 스테이지 기록(최고 기록·별·정답률·플레이/클리어 횟수), 오답노트(틀린 횟수·재도전 횟수·해결 여부·날짜), 주제별 숙련도, 도감, 설정.

## 6. UI 디자인 (구현됨)
타이틀 · 스테이지 선택(CH.1~9 카드, 2~9는 잠김) · 레이스 HUD · 갈림길/게이트 질문 배너 · 정답/오답 해설 패널 · 도약전도 연속 표시 · 시냅스 미니게임 · 결과 · 신경 도감 · 학습 노트(오답 다시 풀기) · 설정 · 일시정지.

## 7. iPad 지원
- 가로 전용 자동 회전, iPad 전용 대상 기기(`targetDevice: 1`), Safe Area 적용.
- CanvasScaler 1600×1000 기준 Match 0.5 → 4:3(iPad 기본)에서 실제 캔버스 폭 ≈ 1461 기준으로 모든 요소가 겹치지 않도록 배치.
- 터치 버튼: 좌/우 190 px, 부스터 200 px, 드리프트 160 px, 점프 150 px. 멀티터치(조향+부스터 동시) 지원, 손가락이 버튼을 벗어나면 해제(끼임 방지).
- 성능: 정적 배칭, 모바일 포스트프로세싱 OFF, renderScale ≤ 0.8, 원거리 520 m + 안개.

## 8. 단계별 구현 순서
1. ✅ 프로젝트 골격 + Neon Racer 설정/코드 재사용
2. ✅ 순수 C# 코어 + 헤드리스 테스트
3. ✅ 별 캐릭터·트랙·배경·카메라
4. ✅ HUD·메뉴·미니게임·저장
5. ✅ 컴파일 검증
6. ⏳ **Unity 6000.3에서 열어 플레이 테스트 → 수치 튜닝** (사용자 환경 필요)
7. ⏳ iPad 실기기 빌드 (Xcode)
8. ⏳ CH.2 이후 (척수와 반사 — 반사궁 숏컷 등)
