# iPad 자동 빌드 설정 (한 번만)

설정이 끝나면, 코드가 GitHub에 올라갈 때마다 자동으로 WebGL 빌드가 만들어집니다. 그 결과는 아래 주소에 올라갑니다.

**https://xoxoluv55-ops.github.io/jejutest/**

아이패드 사파리에서 이 주소를 열면 최신 버전을 플레이할 수 있습니다. 홈 화면에 추가하면 전체화면으로 쓸 수 있습니다.

- 빌드 한 번에 첫 회는 약 30~60분, 이후에는 약 15~25분 걸립니다.
- 진행 상황은 GitHub 저장소의 **Actions** 탭에서 볼 수 있습니다.

## 1. Unity 라이선스 파일 준비 (PC에서)

Unity Hub로 로그인한 PC에는 라이선스 파일이 이미 있습니다.

- Windows: `C:\ProgramData\Unity\Unity_lic.ulf`
  - `ProgramData`는 숨김 폴더입니다. 탐색기 주소창에 경로를 그대로 붙여 넣으세요.

이 파일을 메모장으로 열어 **내용 전체를 복사**합니다.

> 이 파일과 비밀번호는 절대 채팅에 붙여 넣지 마세요. 아래 GitHub Secrets 칸에만 넣습니다.

## 2. GitHub Secrets 등록

저장소 → **Settings → Secrets and variables → Actions → New repository secret**에서 3개를 추가합니다.

| 이름 | 값 |
|---|---|
| `UNITY_LICENSE` | 1번에서 복사한 `.ulf` 파일 내용 전체 |
| `UNITY_EMAIL` | Unity 계정 이메일 |
| `UNITY_PASSWORD` | Unity 계정 비밀번호 |

아이패드의 GitHub 웹(사파리)에서도 할 수 있습니다. 단, `.ulf` 파일 내용은 PC에서 복사해야 합니다.

## 3. GitHub Pages 켜기

저장소 → **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 바꿉니다.

## 4. 이 브랜치에서 배포 허용

저장소 → **Settings → Environments → github-pages → Deployment branches and tags**에서 다음 브랜치를 추가합니다.

- `claude/muscle-battle-master-prompt-to54tp`

환경이 아직 없다면, 3번까지 한 뒤 Actions를 한 번 실행하면 생깁니다.

## 5. 첫 실행

저장소 → **Actions → WebGL build (iPad) → Run workflow**를 누릅니다.

- 초록 체크가 뜨면 위 주소에서 플레이할 수 있습니다.
- 빨간 X가 뜨면 실패 화면을 캡처해서 보내 주세요.
  - 흔한 원인: Unity 6000.6.7f1용 빌드 이미지가 아직 없는 경우. 이때는 지원되는 Unity 6 버전으로 맞추겠습니다.
