# STEP 1. GitHub 오픈소스 후보 조사 및 코드 분석

> 조사일: 2026-11-14 · 방법: 각 저장소를 `git clone --depth 1`로 받아 LICENSE, `ProjectVersion.txt`, `Packages/manifest.json`, 씬, C# 소스, 에셋 폴더를 직접 확인했습니다.

## ⚠ 실행 테스트에 관한 사실

이 작업은 **Unity 에디터가 설치되지 않은 클라우드 Linux 컨테이너**에서 진행했습니다. 따라서 **어느 후보도 Unity에서 직접 실행해 보지 못했습니다.** 아래 표의 "실제 실행 테스트" 칸은 모두 정적 분석 결과입니다. 그 대신 NERVE RUNNER 결과물에는 다음 두 가지 검증을 적용했습니다(STEP 3 보고서 참조).

1. Unity 참조 어셈블리 + uGUI 소스로 **모든 런타임 스크립트를 컴파일 검증**
2. 게임 로직(트랙·물리·갈림길·학습 기록)을 **헤드리스 시뮬레이션으로 처음부터 끝까지 자동 플레이 테스트**

## 1. 후보별 검증 결과

| 항목 | A. Neon Racer | B. PolyRace | C. Unity Endless Runner | D. Street Racing |
|---|---|---|---|---|
| URL | github.com/pinchasVaknin/neon-racer | github.com/vthem/PolyRace | github.com/sunsided/unity-endless-runner | github.com/lucscout/street-racing-unity |
| 라이선스 (LICENSE 파일) | MIT (2026 Pinchas Vaknin) | MIT (2022 Vincent Themereau) | MIT (2020 Markus Mayer, 2019 Penny de Byl) | MIT (2021 Lucas Coutinho) |
| 외부 에셋 | 코드 외 에셋 없음. 단 `Assets/Cars_3D/` FBX 4종은 **MIT 미적용 제3자 에셋**(원작자 명시) | DOTween(별도 라이선스), LibNoise.Unity(**LGPL**), 레이서 모델(Buryat Sky)·음악(Gabe Castro)은 크레딧만 있고 재사용 조건 불명 | Udemy 강좌 에셋, SpaceSkies Free, Detonator, Standard Assets 포함 — 재배포 조건 불명 | Asset Store 팩(Cartoon Car - Vehicle Pack, Low Poly Road Pack) 원본 포함 — **Asset Store EULA상 재배포 불가** |
| Unity 버전 | **6000.3.11f1 (Unity 6)** | 2020.3.25f1 | 2019.3.0b1 (베타) | 2020.3.25f1 |
| 렌더 파이프라인 | **URP 17.3** (PC/Mobile 에셋 분리) | Built-in | Built-in | URP 10.7 |
| 언어 / 규모 | C#, 70개 파일 ≈ 9,800줄 | C#, 406개 파일 (외부 라이브러리 포함) | C#, 19개 | C#, 20개 |
| 프로젝트 구조 | Runtime(Core/Data/Vehicle/World/Input/State/Services) + Scripts(팩토리) + Editor. **빈 씬에서도 코드가 전부 생성** | Scripts + Resources 프리팹/에셋, `.blend` 9개(Blender 3.0 필요) | Project/Scenes·Scripts + 강좌 에셋 | Programming-Theory 하위 폴더에 프로젝트 |
| 실행 가능한 씬 | `GameScene.unity` (또는 아무 빈 씬) | `Main_Scene.unity` | `Menu.unity`, `ScrollingWorld.unity` | `Menu Scene`, `Game Scene` |
| 주요 기능 | 스플라인 트랙 생성, 드리프트(미니터보 3단), N2O 부스트, 추적 카메라, 터치 컨트롤, 절차적 사운드, 모바일 렌더 예산 | 호버크래프트, 절차적 지형 트랙, 실드 | 자동 질주, 타일 풀링, 점프, 마법 발사 | 타임어택, 기록, 휠콜라이더 차량 |
| 알려진 버그 | README에 명시된 것 없음 (`HANDOFF.md`에 과거 씬-직렬화 문제와 해결 기록) | 온라인 기능 제거됨 | **README 명시: 다중 점프, 점프로 사망 애니메이션 취소** | 명시 없음 |
| iPad 지원 가능성 | 높음 (Android 빌드 경험, 터치 UI, 모바일 품질 분기 코드 존재. iOS 빌드는 미언급) | 낮음~중간 (모바일 대응 없음) | 낮음 | 중간 (WebGL 빌드만) |
| 코드 재사용 난이도 | 낮음~중간 (차량 의존 부분 분리 필요) | 높음 (Unity 6 업그레이드 + Blender 의존 + Built-in→URP) | 높음 (2019 베타 + 인간형 애니메이션) | 중간 (그러나 에셋 사용 불가) |
| 최근 유지보수 | 2026-09-03 | 2025-02-03 | 2020-02-21 | 2025-02-21 |
| 실제 실행 테스트 | **미실행** (정적 분석) | **미실행** | **미실행** | **미실행** |

### 추가 조사한 저장소 (GitHub 검색: kart / arcade racer / spline runner / hover racing)

| 저장소 | 결과 |
|---|---|
| Ishaan35/Unity3D-Mario-Kart-Racing-Game (★463) | **LICENSE 없음** + 타사 IP 재현 → 사용 불가 |
| ttayfunylmz/Chicky-Kart | MIT, Unity 2022.3, 262개 C#, Netcode 멀티플레이 + 바퀴 카트 물리, `3rdParty/` Asset Store 폴더 포함 → 별 캐릭터·싱글 학습 게임과 거리가 멀다 |
| PacktPublishing/Build-A-Multiplayer-Kart-Racing-Game… | MIT, C# 2개뿐인 강좌 보조 자료 → 게임 기반으로 부적합 |
| Team-on-gamejams/Hoverboard, pale-cinder/hover-racer-training 등 | 소규모/라이선스 없음/2018~2019 이후 정체 |

## 2. 가중치 평가 (10점 만점 × 가중치)

| 평가 항목 (가중치) | Neon Racer | PolyRace | Endless Runner | Street Racing | Chicky-Kart |
|---|---|---|---|---|---|
| 실제 실행 가능성 (25%) | 8 — Unity 6, 빈 씬 부팅, 의존 패키지 표준 | 4 — Blender 3.0 필수, 2020 버전 | 3 — 2019 베타 | 5 — URP 10, WebGL 빌드 존재 | 5 |
| 별 캐릭터 교체 용이성 (20%) | 8 — 차량도 코드로 조립, 모델 의존 없음 | 6 — 호버크래프트(바퀴 없음) | 5 — 애니메이션 인간형 | 4 — 휠콜라이더 | 4 |
| 곡선 트랙·갈림길 적합성 (20%) | 7 — Catmull-Rom 스플라인 + 교차(8자) 트랙. 단, 닫힌 루프만 지원 | 7 — 곡선 절차 지형 | 2 — 직선 타일 | 3 — 도로 프리팹 | 4 |
| Unity 6 · iPad 호환 (15%) | 9 | 3 | 2 | 4 | 5 |
| 코드 품질·유지보수 (10%) | 8 — 주석·리팩터 기록 풍부 | 6 | 4 — 작성자 스스로 품질 문제 언급 | 5 | 6 |
| 라이선스·에셋 안전성 (10%) | 9 — Cars_3D만 제외하면 깨끗 | 5 — LGPL·불명확 에셋 | 4 | 3 — 재배포 불가 에셋 | 5 |
| **가중 합계** | **8.05** | 5.15 | 3.25 | 4.05 | 4.70 |

## 3. 선정 결과: **Neon Racer** (pinchasVaknin/neon-racer)

### 선정 이유
1. **Unity 6000.3 + URP 17** — 요구사항(Unity 6, URP)과 버전이 일치해 업그레이드 위험이 없습니다.
2. **"모든 것을 코드로 생성"하는 구조** — 트랙·텍스처·머티리얼·UI·사운드가 런타임 생성이라, 차량을 별로, 도시를 신경망으로 바꾸는 작업이 에셋 교체가 아닌 코드 교체로 끝납니다. Unity 에디터 없이도 검증 가능한 범위가 넓다는 장점도 있습니다.
3. **카트라이더식 조작감 코드가 이미 검증됨** — 미니터보 3단 드리프트, 부스트 히스테리시스(연타 방지), 속도 연동 FOV 추적 카메라.
4. **모바일 대응 경험** — 터치 컨트롤, 모바일 렌더 예산, 모바일에서 포스트프로세싱을 끄는 "흰 화면" 해결책 등 실기기에서 얻은 노하우가 코드 주석에 남아 있습니다.
5. **MIT 라이선스이며 제3자 에셋이 명확히 분리**되어 있습니다(`Cars_3D`만 제외하면 됨).

### 재사용할 코드·기능
| 기능 | 원본 | 재사용 방식 |
|---|---|---|
| 프로젝트 설정·URP 에셋 | ProjectSettings, Assets/Settings | 복사 (Lit/Unlit 셰이더 Always Included, 입력 처리 Both) |
| 스플라인 | `CatmullRomCurve` | 복사 + **열린 곡선 지원 추가**(갈림길 그래프용) |
| 머티리얼 팩토리 | `Mats` | 그대로 사용 (캐시, URP/Built-in 겸용) |
| 절차적 사운드·음악 | `Sfx` | 그대로 사용 (엔진음 → 별의 전기 험) |
| 드리프트 3단 미니터보, 부스트 히스테리시스 | `DriftSystem`, `BoostSystem` | 순수 C# 시뮬레이션으로 각색 |
| 추적 카메라 | `CameraRig` Chase | 각색 (3D 전방 벡터, 부스트 FOV, 쇼케이스 모드) |
| 리본 메시 생성 | `TrackBuilder.Ribbon` | 각색 (도로·레일·다리) |
| 코드 UI 레이아웃 헬퍼 | `UIManager` | 각색 (한글 표시 위해 TMP → UGUI Text + OS 폰트) |
| 런타임 부트스트랩 | `GameBootstrap` | 방식 재사용 |
| AA/블룸/모바일 예산 | `EnvironmentController` | 발췌·각색 |

### 삭제(미사용)할 기능
차량 모델·바퀴·서스펜션 표현(`CarFactory`, `CarVisuals`, `Cars_3D`), AI 라이벌, 계정/관리자, 상점·업그레이드·파츠, 고스트, 날씨, 일일 챌린지, 포토 모드, 도시·지형 생성, 미니맵.

### 수정할 기능
- 차량 물리(`CarController`: 헤딩·조향각 기반 자유 주행) → **트랙 상대 좌표(구간, 진행거리 s, 횡위치 x, 점프 높이 y) 시뮬레이션**. 자동 전진 + 원심력 + 벽 충돌. 갈림길에서 "실제로 조향해 들어간 차선"으로 경로가 결정되도록 하기 위함.
- 드리프트 충전: 속도 기반 → **"코너 방향으로 정확히 드리프트한 정도"** 기반.
- 부스트 자동 재충전 → **드리프트·에너지 오브·정답으로만 충전** (학습 연동).
- 닫힌 루프 트랙 → **갈림길/합류가 있는 열린 구간 그래프**.

### 새로 개발한 기능
STAR-01 절차적 별 캐릭터(표정 7종), 신경망 배경, 트랙 그래프·모듈 빌더, 질문 기반 갈림길·게이트, 도약전도 랑비에 결절 링, 수초 손상 구간·복구 미션, 시냅스 미니게임, 문제은행/도감/스토리 JSON, 학습 세션·오답노트·저장, 모든 화면(UI), 헤드리스 테스트·컴파일 검증 도구.

### 예상 기술적 위험
| 위험 | 대응 |
|---|---|
| 이 환경에서 Unity 실행 불가 → 시각·성능 확인 불가 | 컴파일 검증 + 로직 시뮬레이션으로 범위를 좁힘. **Unity 에디터·iPad 실기기 테스트는 사용자 측에서 필요** |
| 런타임 생성 머티리얼의 셰이더 변형(_EMISSION, 안개)이 빌드에서 제거될 수 있음 | `Resources`에 Lit+_EMISSION 머티리얼 에셋 포함, 씬 파일에 선형 안개 활성화 |
| 한글 폰트 | TMP 대신 OS 동적 폰트(Apple SD Gothic Neo). 위첨자 기호(⁺) 대신 `Na+`, `Ca2+` 표기 |
| iPad 성능 (발광 오브젝트 다수) | 정적 배칭, 모바일에서 포스트프로세싱 OFF, renderScale 0.8 상한, 원거리 클리핑 520 m |
| 수동 작성한 씬/머티리얼 YAML | 최소 구성으로 작성. 첫 실행 시 Unity가 재직렬화할 수 있음(정상) |

### 라이선스 준수 방법
- 원본 LICENSE를 `Assets/ThirdParty/NeonRacer/LICENSE.txt`로 보존하고, 재사용 파일마다 출처·커밋·수정 여부를 헤더 주석으로 표기했습니다.
- 루트 `THIRD_PARTY_NOTICES.md`에 파일별 대응표를 기록했습니다.
- MIT 적용 대상이 아닌 `Cars_3D` 모델은 복사하지 않았습니다.
- 원본 저장소는 수정하지 않았고, 커밋 해시(`090f15b`)로 기준 버전을 고정했습니다.
