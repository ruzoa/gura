# 게임 모음 (구라! · 대부호 · 쿼리도 · 야추다이스)

친구들과 브라우저에서 하는 온라인 게임 모음입니다 (카드게임은 3D 테이블, 쿼리도는 2D 보드, 야추다이스는 3D 테이블 위 주사위 트레이 + 2D 점수 종이). GitHub Pages로 배포하고 빌드 과정은 없습니다.

## 파일 구조

| 파일 | 내용 |
| --- | --- |
| `index.html` | 모든 게임이 같이 쓰는 공통 코드: 로비, 방(PeerJS), 재접속, 방장 이양, 관전, 강퇴, 이모티콘, 소리, 3D 테이블, 버튼 배치 |
| `games/gura.js` | 구라! 규칙 엔진, 봇, 카드 모양, 화면 표시 |
| `games/president.js` | 대부호 규칙 엔진, 봇, 카드 모양, 화면 표시 |
| `games/quoridor.js` | 쿼리도 규칙 엔진, 봇, 2D 보드 화면 (카드 없음, 최대 4명) |
| `games/yahtzee.js` | 야추다이스 규칙 엔진, 봇, 3D 컵·주사위(자체 물리, 눈은 방장이 정하고 그 눈으로 떨어지게 연출), 점수 종이 (카드 없음, 최대 4명, 빠른 모드 없음, 굴리기 키 `C`를 누르고 있다 떼기). WebGL이 없으면 2D 주사위 칸 |
| `tests/engine.test.js` | 엔진 테스트 (`node tests/engine.test.js`). `tests/*.cases.js`(야추다이스는 `tests/yahtzee.cases.js`), `tests/quoridor.fuzz.js`를 불러서 함께 돌림 |
| `manifest.webmanifest`, `sw.js`, 아이콘 | 홈 화면 앱 |

- 공통 코드는 `G`(지금 화면의 게임)와 `EG()`(방장 엔진이 돌리는 게임)를 통해 게임 모듈의 함수를 부릅니다.
- 게임 모듈이 갖출 것은 `games/gura.js`를 기준으로 보면 됩니다. 크게 세 가지입니다.
  - 카드: `cardHTML`, `drawFace`
  - 방 설정: `defaults`, `roomSet`, `ruleSet`
  - 엔진과 화면 훅: `engine.start/act/tick/snap`, `hud`, `handMarks`, `buttons` 등
  - 골라 쓰는 값: `maxHi`(최대 인원, 쿼리도 4), `no3D`(3D 테이블을 그리지 않음), `specNote`(관전 중 안내 문구), `noFast`(빠른 모드 없음: 로비·방 설정·칩에서 게임 모드를 숨김), `render3D(t,dt)`(공통 카메라 대신 자기 카메라로 T.scene을 그림)
- 카드가 없는 게임(쿼리도, 야추다이스)도 공통 코드가 `hand`가 빈 사람을 끝난 사람으로 보므로, 게임 중에는 `hand`에 표시용 값 하나를 넣어 둡니다.
- 방의 게임 종류는 `H.cfg.game`에 들어 있습니다. 방장이 대기실의 방 설정에서 바꿀 수 있습니다.
- 새 게임을 추가하는 순서:
  1. `games/새게임.js`를 만듭니다.
  2. `index.html`의 `<script src>`와 `GAME_IDS`에 추가합니다.
  3. 테스트에 대전을 추가합니다.

## 작업 규칙

- **고치는 범위**: 게임별 채팅은 자기 게임 파일만 고칩니다. 공통 코드(`index.html`)는 공통 작업에서만 고칩니다. 공통 코드를 바꾸면 모든 게임을 확인합니다.
- **작업 전**: 항상 최신 코드를 받습니다.
  ```
  git fetch origin main && git rebase origin/main
  ```
- **올리기 전**:
  - `node tests/engine.test.js`가 통과해야 합니다.
  - 화면을 바꿨으면 PC와 휴대폰 크기에서 확인합니다.
- **화면 문구**:
  - ~니다 체로 씁니다.
  - 같은 기능은 어디서나 같은 이름으로 부릅니다 (대기 시간, 제한 시간, 별카드, 관전 등).
- **저장 키**: localStorage 키는 `gura-` 로 시작합니다. 방 설정은 게임별로 저장합니다 (`gura-roomcfg`, `gura-roomcfg-president`, `gura-roomcfg-quoridor`, `gura-roomcfg-yahtzee`).
