# MUSCLE BATTLE — 마스터 요구사항 (통합본)

> 이 문서는 사용자가 제공한 MUSCLE BATTLE 마스터 프롬프트(§1–§70)를 저장소 안의 **단일 기준 문서**로 옮긴 것입니다.
> 이후 모든 작업은 이 문서와 `docs/concept/` 컨셉 이미지를 기준으로 합니다.
> **컨셉 이미지의 시각적 분위기가 최우선 Visual Reference** — 캐릭터 선택, 실제 전투, 필살기, K.O./결과 화면이 같은 게임의 서로 다른 화면처럼 일관돼야 한다.

## 최종 목표

"원래도 재미있는 3D 대전격투게임인데, 근육·해부학·운동학 지식을 잘 알수록 더 강력하게 싸울 수 있는 게임".
보는 사람이 "교육게임치고 괜찮네"가 아니라 "이거 그냥 게임 자체가 재밌어 보이는데 근육 공부까지 되네?"라고 느껴야 한다.

**한 문장**: "근육을 외우기 위한 게임"이 아니라, "싸우는 게 너무 재미있어서 계속 하다 보니 근육을 외우게 되는 게임".

## 역할
게임 디렉터 · 시니어 Unity 개발자 · Technical Artist · Combat Designer.

## 1. 비주얼 타깃 (§1, §32, §53, §58)
- 고품질 3D 캐릭터, 강한 실루엣, 스포츠/의료/미래형 아레나, 화려한 VFX, 근육/해부학 홀로그램, 네온 에너지, 강한 타격감.
- HUD: 대형 HP 바, 초상화, 타이머, 콤보 카운터, 스페셜 게이지, 기술명, 근육 선택 UI.
- 화면: Character Select, VS, 전투, 필살기, K.O., Victory, Result.
- 이미지를 배경으로 쓰는 게 아니라 실제 Unity 3D 화면으로 구현.
- 캐릭터가 잘 보이는 밝고 선명한 조명 우선. 화려함 ≠ 난잡함: 평상시 깔끔, Counter/Skill/Force Couple/Ultimate/KO에서 집중.

## 2. 플랫폼 (§2, §3, §56, §67)
- **PC (Windows)**: 높은 품질, 키보드, 게임패드. **iPad (Safari WebGL)**: 터치, 안정 프레임, 큰 UI.
- iPad 지원은 처음부터 핵심 요구사항. 모든 시스템은 Mouse/Keyboard/Gamepad/Touch 고려.
- Quality Profile 분리 — PC High(풀 VFX, 그림자, 블룸, SSAO, 트레일, 반사) / Web-iPad(파티클·그림자 거리·트레일 감소, 경량 포스트). iPad가 "싸구려 버전"처럼 보이면 안 됨.
- Safari WebGL 실제 테스트: 로딩, 메모리, 프레임, 터치, 오디오, 셰이더, VFX, UI 스케일. 미지원 기능은 대체 경로 먼저.
- 주요 기능마다 PC High와 Web/iPad 둘 다 테스트. iPad에서 망가지면 완료 아님.

## 3. 장르와 모드 (§4, §17, §19)
- 3D 1 vs 1 아케이드 격투. 1P vs CPU, 2P Local VS, Arcade, Training, Challenge. 향후 Online/Ranked/Tournament 확장 가능 구조.
- Arcade 스테이지 예: Upper Limb Rookie → Shoulder Fighter → Lower Limb Fighter → Neuro Fighter → Force Couple Master → Full Body Master.
- 2P: Controller+Controller, Keyboard+Controller, 향후 iPad 2P 검토. 공부 때문에 흐름이 오래 멈추면 안 됨.

## 4. 핵심 디자인 원칙 (§5, §62)
- 문제→정답→공격만 반복하는 퀴즈게임 금지. 기본 격투 자체가 재미있어야 한다.
- 근육 지식은 Skill 강화 · Combo · Counter · Buff · Ultimate · Finisher에 연결.
- 테스트 1: "근육 문제가 하나도 없어도 이 전투가 재미있는가?" NO → Combat 재설계.
- 테스트 2: "Muscle Skill 때문에 전투가 더 재미있어졌는가?" NO → 교육 시스템 재설계.

## 5. 전투 (§6, §7, §8, §21–§24, §40–§46)
- 기본 행동: 전진, 후퇴, 사이드스텝, 가드, 회피, 약/강 공격, 킥, 잡기, 카운터, 런치, 콤보, 스페셜, 얼티밋.
- Combat Feel: Hit Stop, Hit Flash, Hit Spark, Camera Shake, Knockback, Trail, Motion Blur, Impact Particle, Reaction, Screen Effect, Sound, Bass.
- Game Juice: 모든 주요 행동에 Animation+VFX+SFX+UI 동시 반응, 중요 공격은 Camera+Screen+Reaction까지. 목표 "버튼을 누르는 것 자체가 기분 좋은 게임".
- Perfect Timing: 정답 + 좋은 타이밍 → PERFECT MUSCLE LINK (지식 + 게임 실력 둘 다 중요).
- Counter: Perfect Counter = hit stop + slow motion + zoom + strong SFX + flash.
- Rage/Comeback: HP 25% 이하 ADRENALINE STATE (게이지 획득 증가). 자동 강화보다 실력·지식으로 역전.
- Combo: Light→Light→Heavy, Kick→Launch→Air Combo, Basic Combo→Muscle Skill→Force Couple Finisher.
- Hit Stop 등급별 상이(Light 짧게 … Ultimate cinematic pause). Camera Shake 강도별 + 설정 조절, 과도 금지.
- Slow Motion은 Perfect Counter, Muscle Clash, Force Couple, Final Hit, KO, Ultimate에만.
- Skill Cut-In: 기술명 + 캐릭터 클로즈업 + 근육 홀로그램 + VFX, 짧게.
- Ultimate 2–5초: cinematic camera, close-up, anatomy hologram, muscle fiber, neural effect, slow-mo, heavy impact, bass.
- Finisher: 마지막 체력에서 ANATOMY FINISHER, 캐릭터별 차별화. KO: hit stop → zoom → slow → impact → bass → K.O. → Victory pose. Muscle Skill KO = "ANATOMY FINISH!".

## 6. 근육 시스템 (§9–§16, §18, §20, §49–§51) — 2단계 이후
- Muscle Skill: 예) Shoulder Abduction → 후보 Supraspinatus/Deltoid/Teres Major/Latissimus. 정답(Supraspinatus+Deltoid) = PERFECT MUSCLE LINK(데미지↑, VFX 강화, 콤보 연장, 게이지↑). 부분 정답 = 기본 발동, 오답 = 약화. 전투가 완전히 멈추지 않게.
- Muscle Selection UI: 화면 중앙을 가리지 않는 radial/card/quick-select, 2–5초, PC 버튼/패드, iPad 큰 터치 버튼.
- Force Couple: 예) Scapular Upward Rotation = Upper Trapezius + Lower Trapezius + Serratus Anterior → 근육이 순서대로 빛나고 에너지 라인으로 연결 → 하나의 큰 공격.
- Muscle Visualization: 스킬 사용 시 해당 근육이 피부 위 홀로그램으로 (어깨→삼각근/극상근, 펀치→대흉근/삼두, 킥→대퇴사두/둔근).
- 시각 언어: Muscle = Red/Orange fiber, Nerve = Blue/Cyan impulse, Bone = White/Gold geometric hologram, Force Couple = multi-energy, Mastery = Purple/Gold. Skill/UI/Transition/Stage/Result 전체에 일관 적용.
- Origin/Insertion: 긴 객관식 금지. 3D Bone cut-in에서 기시→정지 위치 선택(전투 중 3–5초). 검증되지 않은 해부 좌표 임의 사용 금지.
- Innervation: 상대 Deltoid Skill에 Axillary Nerve 선택 → NEURAL COUNTER.
- Neuro Path(향후): Motor Cortex → Internal Capsule → Brainstem → Spinal Cord → Peripheral Nerve → Muscle 퍼즐.
- 학습 구조: Learn → Practice → Recall → Battle (첫 등장 안내, 두 번째 힌트, 세 번째 힌트 감소, 이후 전투).
- Knowledge Clash(2P): 동시 강기술 → MUSCLE CLASH 슬로모션 → 동시 선택 → 먼저 맞힌 쪽 Clash Attack.
- Mastery Lv1 Action → Lv2 Origin/Insertion → Lv3 Innervation → Lv4 Special Skill → Lv5 Ultimate. Skill Tree(예: Deltoid → Supraspinatus → Rotator Cuff → Scapular Force Couple). Anatomy Card 수집(3D model, O/I, Action, Innervation). Unlock: Fighter, Costume, Stage, Skill, Finisher, Card, Title.

## 7. 캐릭터 (§25–§29)
- 예: Sports PT(빠른 균형형), Strength Coach(느리지만 강함), Manual Therapy(Grab/Counter), Neuro Specialist, Mobility Fighter(Dodge/Speed), Anatomy Researcher(Muscle Link 보너스), Athletic Trainer(Counter/Defense).
- 성별·얼굴·체형·헤어·피부톤·의상·실루엣 다양성. 여성 캐릭터도 제대로 된 스포츠웨어/전투복. Skin clipping 금지.
- 저해상도/이상한 얼굴, 반복 얼굴, 비정상 체형, 딱딱한 애니메이션 금지. 고품질 Humanoid rig 우선 검토.
- 애니메이션: Idle, Walk, Forward, Back, Sidestep, Guard, Dodge, Punch, Kick, Heavy, Grab, Counter, Hit, Knockdown, Get Up, Special, Ultimate, Victory, Lose. 발 미끄러짐/순간이동 금지.
- Character Select: Portrait, 3D Preview, Name, Specialty, Difficulty, Power/Speed/Technique/Defense, 대표 Muscle Skill, 호버 애니메이션, Lock-In(이펙트+사운드+포즈).
- VS Screen: 큰 얼굴 클로즈업, 중앙 VS, 양쪽 에너지, 대사, 스테이지 이름, 긴장감 상승 BGM.

## 8. 스테이지 (§31–§33)
Sports Rehab Arena, Anatomy Lab, Neuro Lab, Hydrotherapy Arena, Stadium Rehab Zone, University Training Hall, Futuristic Muscle Research Facility, Rooftop Training Arena.
polished floor, 미래형 의료 기술, 네온, 해부학 홀로그램, 근육 다이어그램, 대형 디스플레이, 동적 조명. 강한 공격 시 화면 흔들림·배경 조명 펄스·홀로그램 왜곡·먼지·바닥 임팩트(제한적으로).

## 9. 사운드 (§34–§39)
- BGM: Menu(스타일리시 일렉트로닉), Select(에너제틱), VS(긴장 상승), Battle(빠른 일렉트로닉+록+퍼커션), Final Round(추가 레이어), Victory(짧은 스팅), Result(밝지만 차분). 상용 게임 BGM 복제 금지.
- 캐릭터/스테이지 테마: Neuro=Electric synth, Strength=Heavy percussion, Sports=Fast drum+synth, Anatomy=Futuristic rhythmic.
- SFX: 공격마다 다른 소리(Punch/Kick/Guard/Counter/Launch/Landing/Ultimate layered). 동일 SFX 무한 반복 금지.
- UI: Hover tick, Confirm click, Back reverse low, Character Lock heavy, Skill Select energy, Correct bright, Wrong subtle low, Meter Full power cue.
- Announcer: ROUND 1, FIGHT!, COUNTER!, MUSCLE LINK!, PERFECT LINK!, FORCE COUPLE!, SPECIAL!, FINAL ROUND!, K.O.!, VICTORY!
- Character Voice: Attack/Hit/Counter/Special/KO/Victory 짧은 전투 보이스.

## 10. 화면 흐름 / UI (§47, §48, §53–§55, §57)
- Menu → Character Select → VS → Stage → Fight → KO → Victory → Result. 전환에 고유 효과(muscle fiber wipe, energy slash, anatomy hologram transition).
- HUD: HP bar, Portrait, Name, Timer, Special Meter, Combo Counter, Muscle Skill indicator. 작고 흐린 회색 글씨 금지.
- iPad: 왼쪽 가상 이동 패드, 오른쪽 Light/Heavy/Guard/Dodge/Special + Muscle Skill 전용 버튼, 충분한 간격. 누르면 visual press + haptic 느낌 + SFX + 즉시 액션. UI 터치가 카메라/이동 입력과 동시에 발생하지 않게.
- Victory: 승자 3D 캐릭터 + 포즈, Combo/Muscle Link/Perfect Counter/Mastery Gain. 긴 성적표 금지.
- Training Mode: 회색 테스트 공간 금지 — 미래형 Anatomy Training Lab(스켈레톤/근육 홀로그램, 콤보 표시, 데미지 그래프).

## 11. 아키텍처 / 성능 (§63–§66)
- 기존 MyoForge 병원 시뮬레이션 위에 덧붙이지 않음. 재사용은 muscle/anatomy data, fonts, 일부 input, 유용한 asset만. 별도 Scene + Game Flow + Combat Architecture.
- 시스템 분리: CombatManager, FighterController, FighterInput, FighterStateMachine, HealthSystem, ComboSystem, HitSystem, VFXManager, AudioManager, CameraManager, MuscleSkillSystem, KnowledgeChallengeSystem, UIManager, GameModeManager, CharacterDatabase, StageManager.
- 상태: Idle, Move, Attack, Guard, Dodge, Hit, Knockdown, GetUp, Grab, Special, Ultimate, Victory, KO. 여러 시스템이 동시에 Transform을 제어하지 않게.
- VFX Object Pooling, AudioSource Pool, 품질별 파티클 제한, UI 불필요한 Update 최소화, LOD, Occlusion/Batching.

## 12. 작업 순서 (§59–§61, §68)
1 프로젝트 분석 → 2 재사용 분류 → 3 별도 Scene → 4 Fighter 2명 → 5 Stage 1개 → 6 기본 Combat → 7 HP/KO → 8 Combat Camera →
9 VFX/SFX/BGM/Game Juice → 10 1P CPU → 11 2P Local → 12 Character Select → 13 VS → 14 Result → 15 첫 Muscle Skill(Shoulder Abduction 하나) →
16 Force Couple → 17 Training → 18 Progression. 한 번에 전부 구현하지 않음.
- 첫 Vertical Slice: Fighter A Sports PT + Fighter B Strength Coach, Futuristic Sports Rehabilitation Arena, Movement/Guard/Dodge/Light/Heavy/Kick/Combo/Counter/HP/Special/KO/Victory, 1P vs CPU, 2P Local.
- 첫 슬라이스부터 화려하게: polished stage, proper character, basic VFX, hit sparks, trails, BGM, attack SFX, UI SFX, announcer, combo text, KO, victory pose. 회색 큐브 금지.

## 13. 매 단계 보고 형식 (§69)
Implemented · Combat Test · Console(Error/Warning) · PC 결과 · Web/iPad 결과 · Visual Comparison(컨셉 대비 부족한 점) · Next Step(다음 하나).

## 14. 최종 품질 기준 (§70)
격투 자체가 재미 · 타격감 · 멋있는 캐릭터 · 화려한 화면 · 신나는 BGM · 기분 좋은 클릭음/UI · 2P 경쟁 · 근육을 알면 실제 이득 · 자연스러운 암기 · iPad에서 제대로 플레이.

## 절대 하지 말 것
HTML 기반 간단한 퀴즈게임으로 변경 · 병원 시뮬레이터 구조 재사용 · 회색 큐브 프로토타입 후 나중에 꾸미기 · 긴 공부 설명 · 전투 계속 정지 · 작은 글씨 · 작은 버튼 · 저품질 캐릭터 · 옷 clipping · 지루한 이동 · 긴 로딩 · 객관식만 반복 · 이펙트 없는 공격 · BGM 없는 전투 · 동일 SFX 무한 반복 · 특정 상용 격투게임의 캐릭터/UI/기술 복제.
