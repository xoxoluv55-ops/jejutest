# 이미지 요청 목록 (생성해서 보내주시면 누끼 따서 적용합니다)

공통 규칙
- **배경은 단색**(순수 흰색 또는 #00FF00 초록) — 누끼 품질이 크게 올라갑니다.
- 그림자·바닥·텍스트·UI 없이 **대상만 1개**.
- 해상도는 최소 1024px. 스타일은 첨부한 콘셉트 아트와 동일한 고퀄리티 2D 일러스트(픽셀아트 X, 3D 렌더 X).
- 캐릭터는 지금 쓰고 있는 **흰 우주복 + 검은 바이저 + 흰 타원 눈 2개 + 빨간 헤드폰 + 가슴 빨간 십자** 디자인을 그대로 유지.

## 우선순위 1 — 캐릭터 걷기 프레임 (가장 효과 큼)
지금은 방향별 1장 + 코드 애니메이션(흔들림·기울기)이라 다리가 움직이지 않습니다.

| 파일 | 내용 |
|---|---|
| `bot_front_walk1`, `bot_front_walk2` | 정면, 왼발/오른발 내딛는 포즈 |
| `bot_side_walk1`, `bot_side_walk2` | 왼쪽을 보는 측면, 두 걸음 포즈 |
| `bot_back_walk1`, `bot_back_walk2` | 뒷모습, 두 걸음 포즈 |

프롬프트 예시:
> Cute chibi robot astronaut test subject, white spacesuit, glossy black visor with two white oval glowing eyes, red headphones, red medical cross on chest, small backpack, **side view facing left, mid-walk pose with left leg forward**, high quality 2D game character illustration, clean outlines, soft cel shading, full body, centered, **plain pure white background**, no shadow, no text

## 우선순위 2 — 캐릭터 동작 포즈 (정면)
`bot_interact`(한 손을 앞으로 뻗어 조작), `bot_scan`(손을 헬멧 옆에 대고 바이저가 빛남), `bot_hurt`(놀라서 움찔), `bot_victory`(두 팔 들고 점프)

## 우선순위 3 — 바닥·벽 텍스처 (탑다운, 이음매 없이 반복)
| 키 | 내용 | 비율 |
|---|---|---|
| `floor_lab` | 어두운 남색 금속 바닥판, 볼트·긁힘·약간의 오염, 정면 위에서 본 시점, seamless tileable | 1:1 |
| `floor_grate` | 어두운 금속 격자(그레이팅) 복도 바닥, 아래에서 희미한 청색 빛, seamless | 1:1 |
| `floor_tile` | 어두운 청록색 의료용 타일 바닥, seamless | 1:1 |
| `wall_face` | SF 연구시설 벽면 정면, 패널·환풍구·상단 청색 라인 조명, 가로로 이음매 없이 반복 | 약 2.3:1 |

## 우선순위 4 — 소품 (탑다운 3/4 시점, 콘셉트 아트 두 번째 이미지 가운데 게임 화면과 같은 각도)
| 키 | 내용 |
|---|---|
| `capsule` / `capsule_broken` | 원통형 냉동 캡슐(정상 / 유리 깨짐) |
| `console` / `console_red` | 모니터 2개 달린 제어 콘솔(청색 화면 / 붉은 오류 화면) |
| `optable` | 수술대 + 조명 암 |
| `holo_table` | 원형 홀로그램 투사 테이블(위는 비워 두기) |
| `joint_rig` | 기계식 관절 보정 장치(로봇 팔 관절) |
| `xray_box` | 벽걸이 X-ray 판독 라이트박스 + 책상 |
| `breaker` | 벽면 보조 전원 차단기 패널(노란 경고 줄무늬) |
| `cabinet` / `cabinet_open` | 표본 보관함(닫힘 / 열림) |
| `crate`, `rack` | 금속 상자, 서버 랙 |

## 우선순위 5 — 타이틀 배경
`title_bg` — 텍스트·캐릭터 없는 BODY LAB 내부 키아트(가운데 홀로그램 인체 캡슐, 붉은 경광등, 안개), 가로형 4:3 또는 16:10.

---
### 적용 방법(개발용)
누끼 처리 후 `app/public/assets/art/<키>.png`로 저장하고 `app/public/assets/art/manifest.json`에 키를 추가하면,
게임이 해당 키의 절차적 텍스처 대신 그 이미지를 자동으로 크기 맞춰 사용합니다.
