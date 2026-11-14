# NERVE RUNNER 2.0 — 외부 AI 도구 사용 계획과 프롬프트

## 접근 확인 결과 (2026-11-14)

| 도구 | 상태 | 이번 작업에서 |
|---|---|---|
| **Pollo AI** | ✅ 이 세션에 연결됨. 무료 플랜, **잔여 20 크레딧**. 이미지 1장 약 **2 크레딧**(Seedream 5.0 Lite / Pollo Image v2 / Nano Banana 2 Lite 견적 기준) | **아직 생성하지 않음** — 유료 크레딧을 쓰므로 사용자 승인 대기 |
| **Meshy AI** | ❌ 이 작업 환경에서 meshy.ai 접속 불가(네트워크 차단), API 키 없음 | 사용하지 않음. 아래 프롬프트 제공 |
| **Blender** | ⚠ apt로 설치는 가능(4.0.2)하지만 가져올 외부 모델이 없어 불필요 | 사용하지 않음 |
| **Unity Asset Store** | ❌ 접속 불가 + 로그인 필요 | 다운로드·구매하지 않음 |

이번 PHASE 1의 모든 그래픽은 **Unity C# 코드와 직접 작성한 URP 셰이더 2개**로 만들었습니다. 외부 AI 도구로 만든 결과물은 프로젝트에 없습니다.

## A. Pollo AI — 콘셉트 아트 제안 (승인 필요)

목적은 PHASE 2~4의 **디자인 방향 확인용 레퍼런스**입니다. 게임 그래픽은 계속 Unity에서 구현합니다.

| # | 이미지 | 크레딧 |
|---|---|---|
| 1 | STAR-01 2.0 캐릭터 시트 (정면·측면·후면 + 표정 7종) | 2 |
| 2 | 도약전도 터널 인게임 콘셉트 | 2 |
| 3 | 시냅스 정거장 콘셉트 | 2 |
| 4 | 대뇌 도시 콘셉트 (4개 엽 구역) | 2 |
| 5 | NULL 보스 아레나 콘셉트 | 2 |
| | **합계** | **10 / 20** |

영상(등장·클리어 컷신)은 이미지보다 크레딧이 훨씬 많이 들어 현재 잔액으로는 어렵습니다. 필요하면 요금을 먼저 견적내 드리겠습니다.

### 프롬프트 (영문, 공통 스타일 문구 포함)
공통: `cute Nintendo-style 3D character + sleek sci-fi neon racing + inside the human nervous system, deep navy/purple background, cyan neural glow, warm yellow hero, clean readable composition, game concept art, no text`

1. **STAR-01 sheet** — `character turnaround sheet of STAR-01: a chubby rounded five-pointed yellow star with soft jelly-like glossy surface, big glossy black eyes with two white highlights, tiny mouth, pink blush, thin lavender energy ring with three pearls orbiting the lower body, faint cyan nerve veins on the back; front, side, back views; expression row: neutral, joy (^ ^ eyes), surprise, focused (determined brows), crash (> < eyes), correct (sparkle eyes), wrong (worried brows, small tear)`
2. **Saltatory tunnel** — `racing game screenshot concept, chase camera behind STAR-01 inside a giant myelinated axon: golden tube walls made of tightly wrapped membrane layers (myelin sheath), short gaps where the bare axon membrane is exposed (nodes of Ranvier) as teal bands studded with glowing cyan sodium channels, a bright pulse ring racing ahead to the next node, neon road on the axon axis`
3. **Synapse station** — `presynaptic terminal bulb with glowing vesicles fusing and releasing neurotransmitter particles across a synaptic cleft to receptor-studded postsynaptic membrane, STAR-01 jumping across a bridge of neurotransmitter light`
4. **Cerebrum city** — `futuristic city built on the cerebral cortex, four districts with distinct moods: frontal lobe (planning, orange), parietal lobe (sensation, teal), temporal lobe (hearing/memory, purple), occipital lobe (vision, blue), glowing gyri as highways`
5. **NULL boss arena** — `giant corrupted neural network core, purple error energy and red warning glitches, rotating neural circuit rings, hexagonal shield around a glitchy dark entity made of broken signal code (not humanoid), STAR-01 facing it`

## B. Meshy AI — 3D 모델 프롬프트 (사용자 측에서 사용 시)
권장 출력: **GLB 또는 FBX**, 1~5k 삼각형(모바일), PBR(Base Color/Emission) 텍스처 1024².

| 대상 | 프롬프트 | Unity 적용 |
|---|---|---|
| 거대한 뉴런 (배경) | `stylized giant neuron, smooth soma with 6 branching dendrites and one long axon, low-poly friendly, clean topology, emissive purple-cyan` | `Assets/NerveRunner/Models/`에 넣고 `NeuralBackdrop`의 절차 뉴런 대신 인스턴스화 (LOD Group 권장) |
| 시냅스 구조 | `presynaptic bouton with visible vesicles and postsynaptic membrane with receptors, stylized, game asset` | `TrackView.BuildCleft`의 막 구(sphere) 대체 |
| NULL 보스 | `abstract glitch entity made of fractured neon circuit shards orbiting a dark core, not humanoid, game boss` | PHASE 4 |

**STAR-01은 외부 모델로 바꾸지 않을 것을 권장합니다.** 코드 메시는 얼굴 장식이 표면 곡면에 정확히 붙고, 표정·찌그러짐 애니메이션과 바로 연동되며, 폴리곤 수를 조절할 수 있기 때문입니다.

### Unity 임포트 체크리스트
1. Scale Factor 1, "Convert Units" 확인. 피벗은 바닥 중앙(배경)·중심(보스).
2. Materials: Extract Materials → URP/Lit (또는 `NerveRunner/ToonRim`)으로 교체.
3. Read/Write OFF(정적 배칭할 경우 ON), Mesh Compression Medium.
4. 노멀이 뒤집혀 보이면 Normals: Calculate, 구멍·뒤틀림은 Blender에서 Remesh/Decimate 후 재수출.
5. 라이선스: Meshy 결과물의 상업적 사용 조건(요금제별)을 확인하고 `THIRD_PARTY_NOTICES.md`에 기록.
