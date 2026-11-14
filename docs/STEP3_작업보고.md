# STEP 3. CHAPTER 1 "뉴런 고속도로" 첫 플레이 가능 버전 — 작업 보고

> 브랜치: `claude/nerve-runner-racing-game-wkgzek` · 기반: Neon Racer (MIT, 커밋 `090f15b`)

## 0. 먼저 알려드릴 점 (검증 범위)

이 작업 환경은 **Unity 에디터와 iPad가 없는 클라우드 Linux 컨테이너**입니다. 그래서 검증을 다음 세 단계로 나누어 표시합니다.

| 표시 | 의미 |
|---|---|
| ✅ 로직 검증 | 헤드리스 테스트(`Tools/SimTests`)에서 같은 게임 코드로 실제 실행해 통과 |
| ✅ 컴파일 | Unity 참조 어셈블리 + uGUI로 모든 스크립트 컴파일 성공 (`Tools/CompileCheck`) |
| ⚠ Unity 미확인 | 화면 표현·터치·성능은 **Unity 6000.3 / iPad에서 아직 실행해 보지 않음** |

"코드가 작성되었다"와 "게임이 Unity에서 정상 실행된다"는 다른 상태이며, 후자는 아직 확인되지 않았습니다. 아래 체크리스트(§6)로 확인해 주시면 다음 단계에서 수정하겠습니다.

## 1. 이번 단계에서 구현한 기능

| PART 10 완료 기준 | 구현 | 로직 검증 | Unity/iPad |
|---|---|---|---|
| 별이 정상적으로 이동 | 자동 전진, 좌우 조향, 부유 | ✅ 7개 실행 모두 완주 | ⚠ |
| 코너링 | 원심 밀림 + 벽 충돌 감속 | ✅ 무입력 시 벽 18회 충돌 / 자동조종 0회 | ⚠ |
| 드리프트 | 미니터보 Lv1~3, 정확도 기반 충전 | ✅ 드리프트 8회, 터보 6회 | ⚠ |
| 점프·부스터 | 점프로 NULL 블록 회피, 부스터 히스테리시스 | ✅ 장애물 0회 충돌(자동조종) | ⚠ |
| 갈림길에서 선택한 경로로 실제 이동 | 끝 지점 횡위치 → 해당 분기 구간 진입 | ✅ 오답 시 두 갈림길 모두 복습 구간으로 진입 | ⚠ |
| 정답/오답에 따라 결과가 달라짐 | 지름길·터보 vs 우회·감속 | ✅ 전부 오답 시 +22.6초 | ⚠ |
| 도약전도 부스터 | 랑비에 결절 링 연속 통과 → 최대 +60% | ✅ 19/19 연속 | ⚠ |
| 시냅스 미니게임 | 전달 5단계 순서 + EPSP/IPSP | ✅ 정확히 1회 발동 (UI 조작은 ⚠) | ⚠ |
| 스테이지를 끝까지 완료 | 결승 → GOAL 연출 → 결과 | ✅ | ⚠ |
| 결과 화면에 기록·학습 성과 | 기록/목표/정답률/에너지/결절/주제별 학습 완료·복습 | 데이터 ✅ | ⚠ |
| 오답노트 저장 | JSON 저장, 다시 풀기, 해결/재도전 횟수 | ✅ | ⚠ (파일 쓰기 경로) |
| iPad 터치 조작 | 멀티터치 HoldButton, Safe Area, 4:3 배치 | — | ⚠ **실기기 필수 확인** |

### 스테이지 흐름 (PART 10 순서 대응)
타이틀 → 게임 시작 → 프롤로그 대사 → STAR-01 등장(정면 쇼케이스·카운트다운) → **가지돌기** 워밍업 코너 → **세포체** S자 → 급커브(드리프트 안내) → **축삭둔덕 갈림길**(2지선다) → **활동전위 게이트 ×4**(3지선다) → **말이집 축삭 도약전도 터널**(랑비에 결절 19개) → **도약전도 갈림길**(3지선다) → **수초 손상 구간**(NULL 블록 7개, 복구 오브 3개, 희소돌기아교세포 게이트) → **축삭종말** 급커브 → **시냅스 미니게임** → 전달물질 다리 → **시냅스후 뉴런 최종 질주** → GOAL → 결과 → 오답노트 저장.

- 최단 경로 7,482 m, 학습 문항 9개(트랙 7 + 미니게임 2), 도감 15항목(코스에서 10개 등록 + 문항 연관 등록).
- 자동조종 기준 레이스 시간 176초(+미니게임·대사 약 30~60초) → **목표 3~5분 범위**. 목표(★3) 시간 212초.
- 코스 지도: [`docs/ch1_course_map.svg`](ch1_course_map.svg)

## 2. 재사용한 GitHub 코드
[`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md)에 파일별로 정리했습니다. 요약: Neon Racer의 프로젝트 설정·URP 에셋, `CatmullRomCurve`(열린 곡선 추가), `Mats`, `Sfx`, `MathUtil`, `NeonColor`는 직접 사용, `DriftSystem`/`BoostSystem`/`CameraRig`/`TrackBuilder.Ribbon`/`EnvironmentController`/`UIManager`/`GameBootstrap`은 로직·방식을 각색.

## 3. 새로 작성한 코드
| 파일 | 역할 |
|---|---|
| `Scripts/Core/TrackModel.cs` | 트랙 그래프·이벤트·프레임 샘플링 |
| `Scripts/Core/TrackPathBuilder.cs` | 재사용 트랙 모듈 빌더 (직선/코너/갈림길/간극) |
| `Scripts/Core/Chapter1Layout.cs` | CH.1 코스 데이터 |
| `Scripts/Core/RunnerSim.cs` | 별 이동·판정 시뮬레이션 |
| `Scripts/Core/AutoPilot.cs` | 자동 조종 (테스트·에디터 F2) |
| `Scripts/Core/Learning.cs` | 문제·도감·스토리·학습 세션·저장 데이터 |
| `Scripts/Unity/*.cs` (12개) | 별 캐릭터, 트랙/배경 표현, 카메라, 입력, 모든 UI, 미니게임, 레이스 흐름, 부트스트랩, 저장 |
| `Resources/NerveRunner/*.json` | 문제은행 · 도감 · 스토리 (코드와 분리) |
| `Resources/NerveRunner/VariantKeep_*.mat` | 빌드 시 셰이더 변형(발광) 보존용 |
| `Tools/SimTests` | 헤드리스 로직 테스트 + 코스 지도 생성 |
| `Tools/CompileCheck` | Unity 없이 C# 컴파일 검증 |

## 4. 변경한 파일 (기존 저장소 기준)
- 추가: `NerveRunner/`(Unity 프로젝트 전체), `Tools/`, `docs/`, `THIRD_PARTY_NOTICES.md`, `.gitignore`
- 수정: `README.md`
- 유지: 기존 `index.html`은 건드리지 않았습니다.
- 복사 후 수정한 Neon Racer 설정: `ProjectSettings.asset`(제품명, 회사명, 번들 ID `com.nerverunner.edu`, iOS 대상 iPad 전용, cloudProjectId 제거), `EditorBuildSettings.asset`(빌드 씬 교체, 입력 액션 참조 제거), `Packages/manifest.json`(협업·멀티플레이어 센터·비주얼 스크립팅·Android Logcat·AI Navigation 제거).

## 5. 테스트 결과 (실제 출력 요약)
```
$ dotnet run --project Tools/SimTests
[1] Content            PASS 9 questions valid, codex/story references OK
[2] Track graph        segments=17 shortest route=7482 m par=212 s
                       PASS joins continuous (worst 0.25 m), forks = 1 branch/option,
                       PASS correct branch is shortcut (380 vs 531 m / 400 vs 553 m), no overlapping roads (min 140 m)
[3] Autopilot correct  176.2 s, 7/7 correct, rings 19/19, obstacles 0, repaired 3/3, minigame x1, drifts 8, turbos 6
[4] Autopilot wrong    198.9 s, 0/7, both forks -> review branches (+22.6 s)
[5] No input           215.6 s, finishes (no soft-lock), slower than par
[6] Random fuzz x6     all finish, no NaN
[7] Learning records   wrong notes saved, retry resolves, codex unlock
ALL CHECKS PASSED

$ Tools/CompileCheck/setup_refs.sh && dotnet build Tools/CompileCheck            -> Build succeeded (Input System + editor path)
$ dotnet build Tools/CompileCheck -p:Legacy=true                                  -> Build succeeded (legacy input path)
```
- STAR-01 메시 형태는 같은 수식을 three.js로 옮겨 렌더해 비례를 조정했습니다 → [`docs/star01_mesh_preview_threejs.png`](star01_mesh_preview_threejs.png) (**Unity 렌더 화면이 아닌 형태 확인용 미리보기**).

## 6. 확인된 문제·위험 및 Unity에서 확인할 항목

컴파일 검증은 Unity **2021.3** 참조 DLL 기준이며(Unity 6용 공개 참조 패키지가 없음), Input System·URP는 실제 소스와 이름을 대조한 스텁을 사용했습니다. Unity 6000.3에서 처음 열 때 다음을 확인해 주세요.

1. `NerveRunner` 폴더를 **Unity 6000.3.11f1 이상**으로 열기 → 콘솔 오류 0개인지
2. `Assets/Scenes/NerveRunner.unity`에서 Play → 타이틀에 별과 한글이 보이는지 (한글이 □로 나오면 OS 폰트 문제)
3. 게임 시작 → 프롤로그 → 카운트다운 → 주행. **에디터에서 F2** = 자동조종으로 끝까지 진행 확인
4. 발광 머티리얼이 보이는지(빌드에서 검게/평면으로 보이면 셰이더 변형 문제), 안개·배경 뉴런
5. 갈림길 표지판 글자가 읽히는지, 게이트 차선 색이 정답/오답으로 바뀌는지
6. 시냅스 미니게임 버튼 터치 → 다리 생성 → 결승 → 결과 → 학습 노트에 오답 표시
7. iPad 빌드(File ▸ Build Profiles ▸ iOS → Xcode): 가로 고정, 좌/우+부스터 동시 터치, Safe Area, 60fps 근처인지

알려진 제한:
- 수치(속도 40 m/s, 원심계수 0.30, 드리프트 0.07 등)는 헤드리스 테스트 기준으로 맞췄을 뿐 **실제 손맛은 플레이 테스트 후 조정이 필요**합니다.
- 화면 갈림길 해설은 다음 질문이 나오면 가려집니다(오답 해설은 결과 화면·학습 노트에서 다시 볼 수 있음).
- `Na⁺`처럼 위첨자 대신 `Na+`, `Ca2+`로 표기(OS 폰트 글리프 누락 위험 회피).
- 씬·머티리얼 YAML을 직접 작성했기 때문에 Unity가 첫 실행 때 재직렬화(파일 변경)할 수 있습니다. 정상입니다.

## 7. 아직 구현하지 않은 기능
- CH.2~9 (스테이지 선택 화면에 잠김 카드로만 표시)
- 컬러 커스터마이징(기본/에너지/업적/치유), 능력 효과(보호막·회복) 아이템
- 3D 신경 도감(현재 텍스트 도감), 랭킹, 2랩 구성
- 난이도 선택(Rookie~Master 데이터 필드는 있음, 출제 필터는 미구현)
- 실제 효과음 디자인(현재 Neon Racer의 합성음 재사용), 파티클 전기 스파크

## 8. 다음 단계
1. 사용자: Unity 6000.3에서 §6 체크리스트 실행 → 콘솔 오류/스크린샷 공유
2. 결과에 맞춰 버그 수정·수치 튜닝 (조향감, 카메라, UI 크기)
3. iPad 실기기 성능 측정 후 배경 오브젝트 수·렌더 스케일 조정
4. CH.2 "척수와 반사" — 반사궁 숏컷(감각수용기→감각신경→척수→운동신경→효과기 순서 갈림길), 신장반사·굽힘반사·상호억제
