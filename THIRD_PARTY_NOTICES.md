# Third-Party Notices — NERVE RUNNER

## 1. Neon Racer — MIT License

- 원본 저장소: https://github.com/pinchasVaknin/neon-racer
- 사용한 커밋: `090f15b90c24cddca58c92e3665cc4a8418ab7a2` (2026-09-03)
- 저작권: Copyright (c) 2026 Pinchas Vaknin (@pinchasVaknin)
- 라이선스 전문: [`NerveRunner/Assets/ThirdParty/NeonRacer/LICENSE.txt`](NerveRunner/Assets/ThirdParty/NeonRacer/LICENSE.txt)

| NERVE RUNNER 파일 | 원본 파일 | 상태 |
|---|---|---|
| `Assets/ThirdParty/NeonRacer/MaterialFactory.cs` | `Scripts/MaterialFactory.cs` | 수정 없이 복사 |
| `Assets/ThirdParty/NeonRacer/Sfx.cs` | `Scripts/Sfx.cs` | 수정 없이 복사 |
| `Assets/ThirdParty/NeonRacer/MathUtil.cs` | `Runtime/Core/MathUtil.cs` | 수정 없이 복사 |
| `Assets/ThirdParty/NeonRacer/NeonColor.cs` | `Runtime/Core/NeonColor.cs` | 수정 없이 복사 |
| `Assets/ThirdParty/NeonRacer/CatmullRomCurve.cs` | `Scripts/CatmullRomCurve.cs` | 수정 (열린 곡선 지원 추가) |
| `Assets/ThirdParty/NeonRacer/RenderQuality.cs` | `Runtime/World/EnvironmentController.cs` | 일부 발췌·수정 (AA, 블룸, 모바일 예산) |
| `Assets/NerveRunner/Scripts/Core/RunnerSim.cs` (드리프트 티어·부스트 히스테리시스 부분) | `Runtime/Vehicle/DriftSystem.cs`, `BoostSystem.cs` | 로직 각색 |
| `Assets/NerveRunner/Scripts/Unity/ChaseCamera.cs` | `Runtime/World/CameraRig.cs` (Chase 모드) | 로직 각색 |
| `Assets/NerveRunner/Scripts/Unity/MeshKit.cs` (Ribbon) | `Scripts/TrackBuilder.cs` (`Ribbon`) | 로직 각색 |
| `Assets/NerveRunner/Scripts/Unity/UIKit.cs` (레이아웃 헬퍼) | `Scripts/UIManager.cs` | 방식 각색 (TMP → UGUI Text) |
| `Assets/NerveRunner/Scripts/Unity/GameRoot.cs` (부트스트랩 방식) | `Runtime/Services/GameServices.cs` (`GameBootstrap`) | 방식 각색 |
| `NerveRunner/ProjectSettings/*`, `NerveRunner/Assets/Settings/*` (URP 파이프라인 에셋) | 동일 경로 | 복사 후 제품명·번들 ID·대상 기기·빌드 씬 수정 |

**사용하지 않은 것:** Neon Racer의 `Assets/Cars_3D/`(FBX 차량 모델)는 원작자가 README에서 MIT 적용 대상이 아닌 제3자 에셋이라고 밝히고 있어 **복사하지 않았습니다.** TextMesh Pro 폰트 에셋, 계정/상점/AI/고스트/날씨 코드도 사용하지 않았습니다.

## 2. 컴파일 검증 도구(게임 빌드에 포함되지 않음)

`Tools/CompileCheck/setup_refs.sh`는 검증 시점에만 다음을 내려받으며, 저장소에 커밋하지 않습니다(`.gitignore`).

- NuGet `UnityEngine.Modules` 2021.3.33 — Unity 참조 어셈블리
- https://github.com/Unity-Technologies/uGUI (branch `2018.4`) — Unity Companion License, 컴파일 검증용 `UnityEngine.UI.dll` 빌드에만 사용

## 3. 외부 아트·사운드·폰트 에셋

없음. 별 캐릭터, 트랙, 신경망 배경, 텍스처, UI 스프라이트, 효과음과 음악은 모두 실행 시 코드로 생성됩니다.
한글 폰트는 기기에 설치된 OS 폰트(iPad: Apple SD Gothic Neo)를 `Font.CreateDynamicFontFromOSFont`로 사용하며 폰트 파일을 포함하지 않습니다.

## 4. 비주얼 2.0 (PHASE 1)

- 새 셰이더(`NR_ToonRim`, `NR_FX`), 이펙트 텍스처, 터널·얼굴 메시는 모두 이 프로젝트에서 직접 작성했습니다. 외부 에셋과 AI 생성물은 없습니다.
- `Tools/VisualPreview/`의 디자인 미리보기는 [three.js](https://github.com/mrdoob/three.js) r160(MIT)을 CDN에서 불러옵니다. 저장소와 게임 빌드에는 포함되지 않습니다.
