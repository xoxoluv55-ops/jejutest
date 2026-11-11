# MUSCLE BATTLE — Unity 3D 대전격투 (Vertical Slice v0.1)

> "싸우는 게 너무 재미있어서 계속 하다 보니 근육을 외우게 되는 게임"

디자인 기준 문서: [`../docs/MUSCLE_BATTLE_MASTER_PROMPT.md`](../docs/MUSCLE_BATTLE_MASTER_PROMPT.md) ·
비주얼 타깃: [`../docs/concept/`](../docs/concept) · 이번 단계 보고서: [`../docs/STEP_01_REPORT.md`](../docs/STEP_01_REPORT.md)

## 실행 방법

1. **Unity 6 (6000.x, 개발 기준 6000.6.7f1)** 로 `MuscleBattle/` 폴더를 프로젝트로 엽니다.
   (Built-in Render Pipeline + uGUI만 사용합니다. 2022.3 LTS에서 열 경우 `Packages/manifest.json`의 `com.unity.ugui`를 `1.0.0`으로 바꾸세요.)
2. 처음 열면 에디터 스크립트가 자동으로 `Assets/MuscleBattle/Scenes/MuscleBattle.unity`를 만들고 Build Settings / WebGL 설정을 적용합니다.
   (수동: 메뉴 **MUSCLE BATTLE → Setup Project**)
3. 그 씬을 열고 **Play**. 씬은 비어 있어도 됩니다 — `Bootstrap`이 카메라, 스테이지, UI, 전투 시스템을 런타임에 전부 생성합니다.

### 빌드

| 대상 | 메뉴 | 배치 모드 |
|---|---|---|
| iPad Safari (WebGL) | MUSCLE BATTLE → Build → WebGL (iPad Safari) | `-executeMethod MuscleBattle.EditorTools.MuscleBattleEditor.BuildWebGLBatch` |
| Windows PC | MUSCLE BATTLE → Build → Windows (PC) | `-executeMethod MuscleBattle.EditorTools.MuscleBattleEditor.BuildWindowsBatch` |

WebGL은 `Assets/WebGLTemplates/MuscleBattle` 템플릿을 사용합니다 (전체화면, 핀치/더블탭 줌·스크롤 차단,
iPad 렌더 해상도 DPR 1.5 상한, Gzip + decompression fallback → 어떤 정적 호스팅에서도 동작).

## 조작

| 동작 | 1P 키보드 | 2P 키보드 | 게임패드 | iPad 터치 |
|---|---|---|---|---|
| 이동 / 사이드스텝 | WASD (W/S = 화면 안/밖 사이드스텝) | 방향키 | 스틱 / D-pad | 왼쪽 가상 스틱 |
| 약 공격 | J | 1 또는 , | X / □ | 약 |
| 강 공격 | K | 2 또는 . | Y / △ | 강 |
| 킥 (뒤+킥 = 런처) | L | 3 또는 / | A / ✕ | 킥 |
| 가드 | Shift / H | 0 또는 RShift | LB / L1 | 가드 |
| 회피 | Space | Enter 또는 RCtrl | B / ○ | 회피 |
| 잡기 | U (또는 약+킥) | 4 또는 ; | X+A | 잡기 |
| 카운터 자세 | O (또는 가드+강) | 6 또는 P | LB+Y | 카운터 |
| 스페셜 (게이지 1칸) | I | 5 또는 ' | RB / R1 | 스페셜 |
| 얼티밋 (게이지 3칸) | I + K | 5 + 2 | RB + Y | 얼티밋 |
| 일시정지 | Esc | Backspace | Start | II 버튼 |

**콤보 루트**: 약→약→약 · 약→강 · 약→약→킥 · 킥→킥(런처)→공중 콤보 · 히트한 기술은 스페셜로 캔슬 가능.
**방어 테크닉**: 피격 직전 가드 = PERFECT GUARD · 카운터 자세로 받아치기 = PERFECT COUNTER (슬로모션) ·
잡히는 순간 잡기 입력 = GRAB BREAK · 사이드스텝으로 직선 공격 회피 · 상대 기술 발동 중 맞추면 COUNTER 히트.
**역전 시스템**: 체력 25% 이하 ADRENALINE STATE — 공짜 데미지가 아니라 게이지 획득 1.5배.

## 구조 (§64 시스템 분리)

```
Assets/MuscleBattle/
  Scripts/
    Core/          Bootstrap, GameModeManager(흐름), GameSettings, QualityProfile(PC High / Web-iPad), TimeController(슬로모션), Palette(디자인 언어)
    Combat/        CombatManager(60Hz 틱·히트스톱·판정·콤보·라운드·KO), FighterController(상태머신), MoveData/FighterDefinition/CharacterDatabase(프레임 데이터)
    Input/         FighterInput(키보드·게임패드·터치·합성 소스), CpuInputSource(AI)
    Presentation/  FighterRig(절차적 캐릭터+포즈 애니메이션+근육 홀로그램), VFXManager(풀링 파티클), CameraManager, StageManager, PortraitStudio, ProceduralTextures, MBAssets
    Audio/         AudioManager(BGM 크로스페이드·파이널 라운드 레이어·SFX 풀·아나운서·더킹)
    UI/            Hud, TouchControls, CharacterSelectScreen, VsAndResultScreens, MenuScreens(Title/Settings/Pause), ScreenTransition, UIKit, MenuInput
    Editor/        MuscleBattleEditor (씬/빌드 설정, 빌드 메뉴)
  Resources/
    Audio/         BGM 7곡, SFX 40여 종(변형 포함), 아나운서 18종 — tools/generate_audio.py로 생성한 오리지널
    Fonts/         나눔스퀘어 B/EB (OFL) — WebGL에는 OS 폰트 폴백이 없으므로 한글 폰트를 번들
    Shaders/       Toon(림라이트·히트플래시), Floor(네온 바닥), Hologram(해부학 홀로그램), Additive(VFX), Text3D
```

* 전투 시뮬레이션은 고정 60Hz 프레임 데이터(Startup/Active/Recovery)로 동작하며, Transform을 움직이는 것은 `FighterController` 하나뿐입니다 (§65).
* 모든 타격은 Animation + VFX + SFX + Camera + Stage + UI가 한 지점(`CombatManager.ApplyDamage`)에서 동시에 반응합니다 (§8).
* 히트스톱/카메라 흔들림은 타격 등급(Light/Medium/Heavy/Ultimate)별로 다르며 흔들림 강도는 설정에서 조절 (§40, §41).
* 슬로모션은 퍼펙트 카운터·스페셜·얼티밋·KO에만 사용 (§42).

## 정직한 현재 상태 (무엇이 임시인가)

* **캐릭터 모델**: 고품질 Humanoid 모델 에셋이 아직 없어서, 의상/체형/헤어/림라이트를 반영한 **절차적 스타일라이즈드 바디**로 대체했습니다.
  컨셉 이미지 수준의 캐릭터 품질에는 미치지 못합니다. `FighterDefinition.ModelResourcePath`와 `FighterRig` 공개 API를 그대로 유지한 채
  리깅된 Humanoid + Animator로 교체하는 것이 다음 아트 단계입니다.
* **오디오**: 전부 코드로 합성한 오리지널 사운드(BGM/SFX)와 TTS 기반 아나운서입니다. 분위기·타이밍은 갖췄지만 상용 수준 믹싱/성우는 아닙니다.
* **포스트 프로세싱**: Built-in RP에서 블룸 대신 additive 글로우 스프라이트로 발광을 표현 (iPad 성능 우선). URP 전환 시 PC High 블룸 추가 예정.
* 이 저장소에는 원래 Unity 프로젝트/MyoForge가 없었기 때문에 재사용 데이터는 없었습니다 (보고서 참고).
