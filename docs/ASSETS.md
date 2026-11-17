# 이미지 요청 목록 — CH1 배경·소품 (v2)

캐릭터 시트처럼 **한 장에 여러 에셋을 모은 시트**로 주시면 자동 슬라이스 → 누끼 → 크기 통일 → 아틀라스로 적용합니다.

## 공통 규칙 (원근·조명·크기 통일용)
- **시점**: 탑다운 3/4 시점 (위에서 약 55° 내려다봄). 모든 소품을 같은 각도로.
- **조명**: 왼쪽 위에서 오는 차가운 청백색 주광 + 아래쪽 붉은 비상등 반사.
- **크기 기준**: 시트 한쪽에 지금 캐릭터(실험체 로봇, 정면)를 작게 함께 그려 크기 비교 → 캡슐은 캐릭터 키의 약 1.6배, 콘솔은 허리 높이.
- **배경**: 소품 사이 간격을 넉넉히, **단색 배경**(#00FF00 초록 또는 순수 흰색). 바닥 그림자 X, 글자·라벨 X.
- 픽셀아트 X, 3D 렌더 X — 캐릭터 시트와 같은 고품질 2D 일러스트.

## 시트 1 — 연구실 소품 (가장 중요)
> Asset sheet of sci-fi medical research lab props for a 2D top-down 3/4 view game, same camera angle (~55° from above) for every prop, cool blue-white key light from the upper left, soft red emergency rim light, high quality 2D game illustration matching a cute chibi astronaut robot character, props separated with generous spacing on a **plain pure green (#00FF00) background**, no text, no labels, no floor shadows.
> Props: 1) cylindrical cryo capsule with glass tube, intact, 2) same capsule with shattered glass, 3) control console desk with two angled blue monitors, 4) same console with red error screens, 5) surgical table with overhead lamp arm, 6) round holographic projection table (top empty), 7) mechanical joint-calibration rig with robotic arm joint and violet glow, 8) wall-mounted X-ray lightbox with films and a small desk, 9) wall breaker panel with yellow-black hazard stripes, 10) specimen locker closed, 11) specimen locker open and empty, 12) metal supply crate, 13) server rack with blinking LEDs, 14) specimen jar with floating organ, 15) data terminal on a pedestal

## 시트 2 — 바닥·벽 타일
> Seamless tileable textures for a top-down sci-fi lab game, viewed straight from above, each texture in its own square, plain green background between them, no text:
> 1) dark navy metal floor plates with bolts and subtle scratches, 2) dark metal grating corridor floor with faint blue under-glow, 3) dark teal medical floor tiles, 4) lab wall front face strip (wide, horizontally seamless) with panels, vents and a cyan light line at the top, 5) wall top cap texture

## 시트 3 — 대형 오브젝트
> 1) heavy blast door exit gate face (front view, two sliding leaves, hazard stripes, three lock lights above), 2) the same gate open, 3) sliding side door, 4) elevator floor pad with green glow ring

## 타이틀 배경 (1장)
> Key art background of an underground body research lab "BODY LAB": central glass capsule with a glowing blue-red anatomical hologram human, red rotating emergency lights, fog, consoles on both sides, cinematic lighting, **no characters, no text**, 16:10 landscape.

---
### 적용 방식
보내 주시면: 슬라이스 → 누끼 → 위 기준(캐릭터 키 86 단위)으로 크기 정규화 → `app/public/assets/art/`에 키 이름으로 저장 → `manifest.json` 등록. 게임은 해당 키의 절차적 텍스처 대신 이미지를 자동으로 사용합니다.
