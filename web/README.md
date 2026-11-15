# NERVE RUNNER - 웹(iPad) 버전

Unity 프로젝트와 **같은 게임 규칙·같은 문제/도감/스토리 데이터**를 브라우저에서 돌리는 버전입니다.
iPad Safari에서 링크(또는 `index.html`)를 열면 바로 플레이할 수 있습니다. 설치·빌드가 필요 없습니다.

## 구성
| 파일 | 내용 |
|---|---|
| `src/core.js` | Unity `Scripts/Core`(순수 C#)의 1:1 JavaScript 포팅: Catmull-Rom 트랙, TrackPathBuilder, CH.1/7/9 전용 코스 + 퀴즈 코스(CH.2–6, 8), StageCatalog, RunnerSim 물리, AutoPilot, 학습 기록 |
| `src/star.js` | STAR-01 3D 모델 (Tools/VisualPreview의 PuffyStar·표정·ToonRim 포팅) |
| `src/app.js` | three.js 화면, 카메라, UI, 터치 버튼, 배경음악(NRMusic 포팅, WebAudio), 별 음성(기기 한국어 TTS), 슬로모션 생각 시간, 저장(localStorage) |
| `src/body.html`, `src/style.css` | 화면 구성 |
| `build.py` | 위 파일 + `NerveRunner/Assets/NerveRunner/Resources/NerveRunner/*.json`을 하나로 묶어 `index.html`(단독 실행용)과 `dist/nerve_runner.html`(Artifact용)을 만듦 |
| `test/sim_test.js` | Node로 9개 스테이지 자동 주행 → C# SimTests 결과와 비교 |
| `test/pw_test.js` | Playwright로 iPad 화면 크기 스모크 테스트·스크린샷 |

```bash
python3 web/build.py          # 묶기
node web/test/sim_test.js     # 규칙 검증 (C# 테스트와 같은 숫자가 나와야 함)
```

## 조작 (iPad)
- 왼쪽 아래 ◀ ▶ : 조향 · 오른쪽 아래 : 드리프트 / 부스트 / 점프 (여러 손가락 동시 입력 가능)
- 키보드: ←→/AD 조향, Space 점프, Z·↓ 드리프트, Shift·X 부스트, Esc 일시정지
- 문제가 뜨면 레이스가 슬로모션이 되고(설정에서 조절), 지금 내 차선의 보기가 노란 테두리로 표시됩니다.

## 검증 결과 (Node, 자동 주행, 1/60 s 스텝)
C# `Tools/SimTests`와 비교 - 모든 스테이지 완주, 정답/오답/무입력 결과가 사실상 동일 (부동소수 차이 0.1 s 이내):

| 스테이지 | 전부 정답 | 전부 오답 | 무입력 | PAR |
|---|---|---|---|---|
| CH.1 | 176.3 s (C# 176.2) 7/7 | 198.9 s | 215.5 s | 212 s |
| CH.2 | 124.5 s 7/7 | 145.8 s | 131.6 s | 128 s |
| CH.7 | 138.2 s 8/8 | 164.7 s | 162.2 s | 157 s |
| CH.9 | 91.1 s 6/6 | 103.9 s | 115.6 s | 107 s |

## Unity 버전과 다른 점 (정직하게)
- 그래픽은 three.js로 **단순화**했습니다: 도로/레일/수초 터널/게이트/오브/배경 뉴런은 있지만, Unity의 대뇌 도시 건물·보스 아레나 NULL 본체·파티클 효과 일부는 없습니다.
- 별 음성은 iPad에 내장된 한국어 음성(Safari speechSynthesis)을 씁니다. 첫 화면을 한 번 터치해야 소리와 음성이 켜집니다(iOS 정책). 무음 모드 스위치가 켜져 있으면 음악이 안 들릴 수 있습니다.
- three.js r160은 `cdn.jsdelivr.net`에서 받으므로 **처음 열 때 인터넷이 필요**합니다.
- 실제 iPad 기기에서의 프레임레이트는 아직 확인하지 못했습니다(헤드리스 브라우저에서만 테스트). 버벅이면 설정 → 그래픽 품질 → '가볍게'.
