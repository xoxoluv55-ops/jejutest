# 캐릭터 파이프라인 — VRoid Studio → MUSCLE BATTLE

게임 로직은 그대로 두고 **캐릭터 겉모습(Visual)만 교체**하는 구조입니다.

```
FighterRoot
  FighterController      ← 상태머신 · 체력 · 게이지 (그대로)
  CharacterIdentity      ← 누구인지 (데이터)
  Rig_{id}  (FighterRig) ← 프레임 데이터로 포즈를 계산하는 보이지 않는 "포즈 드라이버" 스켈레톤
    PrototypeVisual      ← 지금의 도형 캐릭터 (모델이 있으면 자동으로 숨김)
    VisualRoot
      Model_{id}         ← VRoid 모델 (Humanoid)
```

- **리타깃 방식**
  - 게임이 시작될 때 드라이버 스켈레톤과 모델을 둘 다 T-포즈로 놓고, 뼈마다 회전 차이를 측정합니다.
  - 그 뒤 매 프레임 드라이버의 포즈를 모델 뼈에 그대로 복사합니다.
  - 그래서 VRoid · Mixamo · 에셋스토어 등 **T-포즈 Humanoid라면 어떤 모델이든** 동작합니다.
- **모델에 자동 적용되는 것**
  - 손가락을 주먹으로 말기
  - 키를 게임 판정 크기에 맞추기
  - 근육 홀로그램 · 공격 트레일을 모델의 뼈에 다시 붙이기
  - 피격 플래시 + 캐릭터별 림 색상
- 모델 파일이 없으면 지금의 도형 캐릭터가 그대로 나옵니다. 그래서 언제든 테스트할 수 있습니다.

## 1. UniVRM 설치 (최초 1회)

1. https://github.com/vrm-c/UniVRM/releases 에서 최신 `UniVRM-0.xxx.x_xxxx.unitypackage`를 받습니다.
   - **VRM 0.x용** 패키지입니다. 이름에 `VRM-`(VRM 1.0용)이 아니라 `UniVRM-`으로 시작하는 파일이에요.
2. Unity 메뉴에서 **Assets → Import Package → Custom Package…** → 받은 파일 → **Import**를 누릅니다.

## 2. VRoid Studio에서 캐릭터 만들기

컨셉 이미지 기준으로 만듭니다. 특정 상용 게임 캐릭터를 따라 하지 않습니다.

| 파일 이름 | 캐릭터 | 핵심 디자인 |
|---|---|---|
| `jin` | 진현 · 운동물리치료사 (남) | 검은 짧은 스파이크 머리, 날카로운 눈매. **흰색 스포츠 재킷 + 빨강/검정 라인** (가슴 "PT"), 검은 카고 팬츠 + 빨간 옆선, 흰 운동화, 손가락 없는 장갑. 대표색: 빨강/흰색 |
| `ray` | 레이 카스티요 · 스트렝스 코치 (남) | 키 크고 어깨·가슴 넓게(체형 슬라이더 최대), 금발 올백, 진한 눈썹. **검은 민소매 + 노란 라인**, 검정/노랑 팬츠, 검은 운동화. 대표색: 검정/노랑 |

- 옷은 피부가 뚫고 나오지 않게 **몸에 맞는 의상 템플릿**을 쓰세요. 미리보기에서 팔을 들어 보고 클리핑을 확인합니다.
- 체형은 둘이 확실히 다르게 만들어 주세요. 진현은 균형형, 레이는 크고 넓게.

**내보내기**: 카메라/내보내기 → **VRM 내보내기** → 버전 **VRM 0.0**을 선택합니다.
- 폴리곤 줄이기: 머리카락 / 의상 감소를 **적당히** 켭니다. iPad 성능을 위해서예요.
- 텍스처 아틀라스: **2048**을 권장합니다.

## 3. Unity에 넣기

1. 내보낸 파일 이름을 **`jin.vrm`**, **`ray.vrm`**으로 정합니다.
2. `Assets/MuscleBattle/Resources/Characters/` 폴더에 드래그합니다. 폴더가 없으면 메뉴 **MUSCLE BATTLE → Characters → Check Character Models**를 한 번 누르면 생깁니다.
3. UniVRM이 자동으로 변환해서 `jin.prefab`(또는 jin.vrm 자체)와 텍스처 / 머티리얼 폴더를 만듭니다.
4. 메뉴 **MUSCLE BATTLE → Characters → Check Character Models**를 누릅니다. Console에 `OK - Humanoid model`이 나오면 성공입니다.
5. **Play** → 캐릭터 선택 · 전투 · 결과 화면이 모두 새 모델로 바뀝니다.

## 4. 확인할 것 (스크린샷 부탁)

- 서 있는 자세 / 가드 / 펀치 / 킥에서 팔다리 방향이 자연스러운지
  - 혹시 팔이 뒤로 꺾이면 알려 주세요. 보정값 문제입니다.
- 주먹 쥔 손가락
- 쓰러짐 / 일어남에서 몸이 바닥을 뚫지 않는지
- 근육 홀로그램(스페셜)이 어깨 위치에 나오는지
- 머리카락 흔들림 (VRM SpringBone)

## 한계 (정직하게)

- **애니메이션**: 지금은 절차적 포즈를 모델에 입히는 방식이라 동작은 지금과 같습니다. 모델이 예뻐져도 움직임 품질은 그대로입니다.
  - 진짜 애니메이션 클립(Mixamo 등 Humanoid 클립)을 받으면 Animator 경로를 추가합니다. 이때도 전투 코드는 바꾸지 않습니다.
- **근육질 표현**: VRoid는 근육질 체형 표현이 약합니다. 레이처럼 큰 체형은 어깨 · 가슴 폭과 의상 볼륨으로 최대한 표현하세요.
- **팔 비틀림**: 손목 · 손바닥 방향 같은 미세한 비틀림은 모델에 따라 조정이 필요할 수 있습니다.

## 2.0 업데이트 — 현재 파이프라인 (Humanoid FBX + 클립 폴더)
- 모델: `Resources/Characters/{id}.fbx` (Humanoid). 텍스처: `Resources/Characters/Textures/` (머티리얼 이름 M_{Id}_Body/Hair/Eyes로 자동 연결).
- 클립: `Resources/Characters/{id}_anims/{키}.fbx` — 파일 이름이 키 (idle, walk_forward, guard, hit, knockdown, getup, victory, 기술 id 또는 자세 이름 등, `HumanoidVisual.cs` 참고).
- `Editor/MixamoImporter.cs`가 Humanoid 설정, 반복 여부, 압축을 자동 처리. 메뉴: MUSCLE BATTLE ▸ Characters ▸ Reimport Character Assets.
- Mixamo 파일도 같은 규칙으로 넣으면 됨 (FBX for Unity, In Place).
