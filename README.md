# ANATOMY ESCAPE — 해부학 탈출 프로젝트

폐쇄된 지하 인체 연구시설 **BODY LAB**을 탐험하며 해부학 퍼즐을 풀고 탈출하는 2D 탑다운 미스터리 방탈출 게임입니다.
현재 버전은 **PHASE 1 플레이어블 데모 (CHAPTER 1 · 뼈대 복구실)** 입니다.

- iPad Safari 우선 (가상 조이스틱·터치 버튼), PC 브라우저 지원 (WASD / Shift 달리기 / E 조작 / Space 스캔 / Tab 인벤토리 / M 지도 / Esc 일시정지)
- 설계 문서: [`docs/DESIGN.md`](docs/DESIGN.md) · 이미지 요청 목록: [`docs/ASSETS.md`](docs/ASSETS.md)

## 플레이
저장소 루트의 `index.html`이 빌드된 게임입니다. GitHub Pages(브랜치 루트)로 바로 서비스할 수 있습니다.
로컬에서 볼 때는 정적 서버가 필요합니다: `npx serve .` 또는 `python3 -m http.server`.

## 개발
```bash
cd app
npm install
npm run dev      # 개발 서버 (같은 Wi-Fi의 iPad에서 http://<PC-IP>:5173 접속 가능)
npm run build    # 타입 검사 후 저장소 루트(index.html, game/, assets/)로 빌드
```

캐릭터 스프라이트는 `docs/concept/`의 콘셉트 이미지에서 `tools/cutout.py`로 누끼를 따서 만들었습니다.
