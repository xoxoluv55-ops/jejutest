# STEP 05 보고서 — Character Select 전면 리디자인

목표: "캐릭터를 고르는 순간부터 게임이 시작된 느낌". 화면의 주인공을 UI에서 캐릭터로 바꿨습니다.
기존 흐름(1P vs CPU / 2P, 키보드·패드·마우스·터치, 확정/취소, 라운드·시간·난이도 설정, VS → 전투)은 그대로 유지했습니다.

## Before 문제

| 문제 | 원인 |
|---|---|
| 중앙 캐릭터가 작음 | 카메라가 5.6m 뒤에서 촬영, 캐릭터가 화면 높이의 약 40% |
| 좌우 패널이 크고 글씨가 많음 | 560×470 패널 2개에 이름·레벨·역할·대사·전문분야·기술·능력치를 20~24px로 모두 표시 |
| UI가 캐릭터보다 눈에 띔 | 패널이 캐릭터 위쪽을 덮고, 중앙 하단은 큰 카드 8장이 차지 |
| 잠긴 캐릭터가 `?` | 단색 카드 + `?` + COMING SOON |
| 매치 설정이 항상 노출 | 라운드·시간·CPU 버튼이 화면 하단에 상시 표시 |

## 변경한 Layout

```
┌ BACK ──────────── CHARACTER SELECT ──────────── ⚙ MATCH SETTINGS ┐
│ [P1] LOCKED IN                    파이터를 선택하세요       [CPU] │
│ POWER ■■■■■■■■□□ 8                                    ...  스탯 │
│ SPEED ...          (3D P1)      VS ⚡⚡     (3D CPU)              │
│ SPECIALTY ⓘDETAILS  큰 캐릭터    에너지 충돌    큰 캐릭터          │
│ ◎Mobility ◎Counter ◎Link                                         │
│ SIGNATURE SKILLS                                                  │
│ ↻ Shoulder Abduction             [START BATTLE]                   │
│ JIN HYUN (큰 이름, 다리 위)                       RAY CASTILLO    │
│ 진현 · SPORTS PT                ◀ 초상화 캐러셀 ▶     레이 · ...   │
│ [스테이지 미리보기]                                   키 안내     │
└───────────────────────────────────────────────────────────────────┘
```

- **좌/우 35~40%**: P1 / CPU(2P) 캐릭터. 정보는 화면 가장자리 400px 컬럼에만 두어 캐릭터를 덮지 않습니다.
- **중앙**: 큰 `VS`(220px). 두 캐릭터 색 에너지가 양쪽에서 흘러들어와 부딪히고, 전기/근섬유 아크가 튑니다.
- **하단 중앙**: 가로 초상화 캐러셀(스와이프 가능)과 그 위의 `START BATTLE` 버튼.
- **좌하단**: 작은 애니메이션 스테이지 미리보기. 탭하면 설정 overlay가 열립니다.
- **숨긴 것**: 라운드·시간·CPU 난이도 → `MATCH SETTINGS` overlay. 긴 설명(대사·전문분야·대표 근육·스페셜·얼티밋·난이도) → `DETAILS` overlay.
- **능력치**: POWER · SPEED · TECHNIQUE · DEFENSE · KNOWLEDGE 막대 5개. 캐릭터를 바꾸면 차오르며 바뀝니다.
- **전문 분야**: 아이콘 3개(Jin: Mobility · Counter · Muscle Link / Ray: Power · Super Armor · Grab).
- **대표 기술 3개 + 아이콘**: Jin: Shoulder Abduction · Serratus Punch · Quadriceps Drive / Ray: Glute Max Smash · Latissimus Pull · Hamstring Counter. 기술명 아래에 한글 근육명을 작게 표시합니다.
- **배지**: P1 = 빨강, 2P = 파랑, CPU = 회색(중립).
- **잠긴 캐릭터 6명**: `?` 대신 검은 3D 실루엣 + 자물쇠 + 해금 조건(예: `Arcade Stage 3 Clear`, `Muscle Mastery Lv.5`)을 표시합니다. 커서를 올리면 무대 위에 실루엣 캐릭터가 서고, 왼쪽 컬럼에 큰 글씨로 해금 조건이 나옵니다. 확정하려 하면 거부음이 나고 카드가 흔들립니다.
- **배경**: 선택 화면에서만 선형 안개로 아레나 뒤쪽을 어둡게 가라앉힙니다(가짜 피사계 심도, iPad 비용 거의 없음). 캐릭터 발밑에는 플레이어 색 스포트 글로우를 깝니다. 화면을 나가면 원래 안개 설정으로 복원합니다.

## 캐릭터 Model 크기

- 카메라: 5.6m → **2.85m**, 높이 1.0m에서 살짝 올려다보는 hero shot입니다.
- 캐릭터가 화면 높이의 약 **85%**(머리 ~ 정강이/발목)를 차지합니다. 이전에는 약 40%였습니다.
- 캐릭터 위치는 화면 비율에 맞춰 자동 계산해 화면 폭의 **32% / 68%** 지점에 섭니다. 16:9에서는 ±0.66m, iPad 4:3에서는 ±0.5m입니다. 창 크기가 바뀌면 다시 계산합니다.

## Font 크기 (1920 기준 해상도)

| 요소 | 이전 | 이후 |
|---|---|---|
| 화면 타이틀 | 44 | 56 |
| 캐릭터 이름 | 60 (한글) | **84** (영문, 굵게) |
| 이름 아래 보조 | 24 | 30 |
| VS | 54 (헤더) | **220** |
| 능력치 이름 / 수치 | 20 / 20 | 22 / 26 |
| 대표 기술 | 21 | 27 |
| START 버튼 | 48 | 48 + 보조 24 |
| 최소 글자 | 14 (COMING SOON) | 17 (잠금 카드 해금 조건, 2줄) |

배경 위 회색 글씨는 쓰지 않습니다. 보조 텍스트는 밝은 라벤더(0.78/0.80/0.95)를 쓰고, 정보 컬럼 뒤에는 어두운 가장자리 그라데이션을 깔았습니다.

## iPad Touch

- 초상화 카드: 128×128(선택 시 1.28배). iPad에서 약 60pt 이상으로, 애플 권장 최소 44pt보다 큽니다.
- **캐러셀 스와이프**: 드래그로 스크롤하고, 놓으면 관성으로 미끄러지다가 2.5초 뒤 현재 커서로 자동 정렬됩니다. 16px 이상 움직이면 탭이 아니라 드래그로 처리합니다.
- **탭 1회 = 선택, 같은 카드 다시 탭 = 확정**입니다. PC에서는 마우스를 올리면 선택되고 클릭하면 확정됩니다.
- 화면 터치용 `BACK` 버튼을 추가했습니다(이전에는 터치로 타이틀에 돌아갈 방법이 없었음).
- 버튼은 모두 64px 이상이고, 작은 버튼 여러 개를 붙여 두지 않았습니다. 키보드 안내 줄은 터치 기기에서 숨깁니다.

## Character Lock-in 연출

| 순간 | Animation | Sound | VFX | UI Motion | Camera |
|---|---|---|---|---|---|
| 커서 이동 / Hover | 캐릭터 교체 + 시그니처 동작(Jin: 가볍게 뛰는 가드, Ray: 주먹으로 손바닥 치기) | tick + 부드러운 whoosh, 0.22초 머무르면 캐릭터 테마 사운드 | 에너지 퍼프 | 카드 확대 + bounce + glow, 정보 컬럼 slide-in, 능력치 막대 차오름 | 해당 쪽으로 살짝 drift |
| LOCK IN | 강한 포즈 1.35초(Jin: 주먹 하늘로, Ray: 더블 바이셉스) → 준비 가드 | 잠금음 + 묵직한 임팩트 + 보이스(Jin "Ready. Let's move!", Ray "Time to lift.") | 대표색 에너지 기둥 + 바닥 링 + 플래시 | 이름 1.3배 펀치 + 금색, 대표색 배너 스윕, `LOCKED IN` 도장 | 해당 캐릭터 쪽으로 push + 흔들림 |
| 확정 후 BGM | — | 1명 확정: BGM에 레이어 추가 / 2명 확정: 텐션 레이어(스네어 빌드 + 라이저) | VS 에너지 강해짐 | START 버튼 활성 + 에너지 펄스 | — |

**Idle variation(§19, §20)**: 2.6~5.2초 간격으로 무작위로 재생하고, 같은 동작이 연속으로 나오지 않습니다.
- Jin(Sports PT, 자신감): 통통 튀는 스탠스 + 어깨 롤 / 목 스트레칭 / 글러브 고치기 / 손 꺾기 / 가드 / 기지개
- Ray(Strength Coach): 팔짱 + 주먹 치기 / 목 스트레칭 / 손 꺾기
- Neuro는 차분한 정적 자세, Mobility는 스트레칭 위주입니다(추후 캐릭터용으로 준비).
- 팔짱 포즈는 FK 미리보기로 확인해서, Ray의 큰 가슴(Bulk 1.35)에 팔이 박히지 않게 맞췄습니다.

## VS transition

- `START BATTLE` → **에너지 러시 0.5초**: 두 색이 중앙으로 몰리며 VS가 커지고, 흰 플래시 + launch 사운드가 납니다. 이어서 기존 근섬유 슬래시 전환 → VS Screen.
- VS Screen: P1·P2 **얼굴 close-up**(512px로 별도 렌더해 iPad에서도 흐리지 않음), 이름, **대표 Skill**(예: `SIGNATURE · Shoulder Abduction (삼각근 · 극상근)`), 짧은 대사, Stage 이름을 보여 줍니다. CPU 배지는 회색입니다.
- **2.1초 후 자동으로 전투를 로드**합니다(이전 3.6초). 0.35초 이후부터는 탭 / 클릭 / Enter로 바로 건너뛸 수 있습니다.

## 오디오 (모두 코드로 생성한 오리지널)

`python3 tools/generate_audio.py --select-ui` 로 새 에셋만 생성합니다(기존 에셋은 건드리지 않음).
- `BGM/select_lock_layer.ogg`, `BGM/select_tension_layer.ogg`: select 루프와 길이·템포가 같아 샘플 단위로 동기화됩니다.
- `SFX/theme_jin.ogg`(밝게 상승하는 아르페지오), `SFX/theme_ray.ogg`(낮은 파워코드 + 서브 붐)
- `Voice/jin_lock.ogg`, `Voice/ray_lock.ogg`: espeak 합성 + 가공. 아나운서와 같은 수준의 임시 음성입니다.

## 변경 파일

- `UI/CharacterSelectScreen.cs` — 전면 재작성
- `Presentation/FighterRig.cs` — 선택 화면 전용 애니메이션 레이어(`SelectMode`, `SelectHover`, `SelectLockIn`, `SelectUnlock`). 전투 중 포즈에는 영향이 없습니다.
- `Combat/FighterDefinition.cs`, `Combat/CharacterDatabase.cs` — 선택 화면 데이터(DEFENSE/KNOWLEDGE, 전문 분야 아이콘, 대표 기술, 성격, 테마/보이스, 잠긴 캐릭터 실루엣 + 해금 조건)
- `Presentation/ProceduralTextures.cs` — 벡터 스타일 아이콘 10종(arc, shield, link, bolt, burst, chevron, pull, lock, gear, info)
- `Presentation/PortraitStudio.cs` — 해상도 지정 렌더(VS용 512px)
- `Presentation/VFXManager.cs` — `SelectHover`, `SelectLock`
- `Audio/AudioManager.cs` — select 레이어, `PlayVoice`. 전투 BGM 레이어 동작은 그대로입니다.
- `UI/VsAndResultScreens.cs` — VS 화면 개선
- `tools/generate_audio.py` + 새 오디오 6개

## 검증 / 한계 (정직하게)

- 이번 작업 환경에서는 Unity 참조 DLL을 받을 수 없었습니다. 그래서 **Roslyn 구문 검사(에러 0)와 API 수동 검토**만 했고, Unity 컴파일은 실행하지 못했습니다. Console 확인이 필요합니다.
- 포즈는 파이썬 FK 스틱 피겨로만 확인했습니다. 실제 화면에서 각도 미세 조정이 필요할 수 있습니다.
- 스테이지가 1개뿐이라 별도의 Stage Select 화면은 만들지 않았습니다. 스테이지 미리보기를 탭하면 설정 overlay에서 현재 스테이지를 보여 줍니다.
- 보이스는 TTS 임시 음성입니다. 성우 녹음으로 바꿀 때는 `Resources/Audio/Voice/jin_lock.ogg`처럼 같은 이름으로 교체하면 됩니다.

## 확인 부탁

1. 캐릭터가 화면 좌우에 크게(머리 ~ 정강이) 보이고, 정보 컬럼이 캐릭터를 가리지 않는지
2. 커서를 옮기면 캐릭터가 바뀌며 짧은 동작 + 테마 사운드가 나오는지
3. 확정 시 포즈·카메라 push·배너·보이스가 함께 나오는지
4. Ray가 팔짱을 낀 채 가끔 주먹을 치는지, Jin이 가볍게 몸을 푸는지
5. 잠긴 카드가 실루엣 + 자물쇠 + 해금 조건으로 보이는지
6. iPad에서 캐러셀 스와이프, 탭 선택 / 재탭 확정, BACK 버튼이 동작하는지
7. VS 화면이 약 2초 뒤 전투로 넘어가고, 탭하면 건너뛰는지
8. Unity Console 에러 0
