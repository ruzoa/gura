# 게임 모음 (구라! · 대부호 · 쿼리도 · 야추다이스 · 오목)

친구들과 브라우저에서 하는 온라인 게임 모음입니다 (카드게임은 3D 테이블, 쿼리도는 3D 테이블 위 원목 보드를 바로 위에서 내려다봄, 야추다이스는 3D 테이블 위 주사위 트레이 + 2D 점수 종이, 오목은 3D 테이블 위 오목판 + 체스 시계). GitHub Pages로 배포하고 빌드 과정은 없습니다.

## 파일 구조

| 파일 | 내용 |
| --- | --- |
| `index.html` | 모든 게임이 같이 쓰는 공통 코드: 로비, 방(PeerJS), 재접속, 방장 이양, 관전, 강퇴, 이모티콘, 소리, 3D 테이블, 버튼 배치, 첫 차례 룰렛 실행부(`firstPick`) |
| `games/gura.js` | 구라! 규칙 엔진, 봇, 카드 모양, 화면 표시 |
| `games/president.js` | 대부호 규칙 엔진, 봇, 카드 모양, 화면 표시 |
| `games/quoridor.js` | 쿼리도 규칙 엔진, 봇, 공통 테이블 위 3D 보드(바로 위 90도 자기 카메라, 참가한 사람 앞에 보드와 떨어진 진갈색 보관함(홈 10개)에 벽을 세워 둠, 말 점프·벽 날아가기, 누르면 반투명 미리 보기 → [놓기]로 확정, 내 보관함의 벽을 눌러 고르면 살짝 올라오고 벽 모드, 개인 설정 '두 번 눌러 놓기'(`gura-dbltap`), 시작 연출: 로비 카메라→바로 위 카메라·보드 내려앉기와 칸 솟기·보관함과 벽 꽂기·말 떨어지며 목표 줄 긋기·첫 차례 룰렛(공통 `firstPick` + `roulette.js`: 마지막 말의 목표 줄이 끝난 뒤 0.5초 쉬고 → 모든 말에 후보 고리가 0.4초 켜지며 신호음 → 돌면서 느려져 멈춤. 빠른 칸 수가 판마다 달라 연출은 약 9~11초. 방 설정 '선 플레이어 직접 선택'을 켜면 방장이 대기실에서 선을 고르고 룰렛 없이 약 4초), 대기실은 공통 테이블). 벽 수는 공식 규칙(2명 10개, 4명 5개). WebGL이 없으면 2D 보드(SVG) (카드 없음, 최대 4명, 빠른 모드 없음) |
| `games/yahtzee.js` | 야추다이스 규칙 엔진, 봇, 3D 컵·주사위(자체 물리, 눈은 방장이 정하고 그 눈으로 떨어지게 연출, 떨어진 주사위를 누르면 앞쪽 고정 칸으로·다시 누르면 테이블로, 시작 연출: 로비 카메라→야추 카메라·펠트와 고정 칸·컵에 주사위 담기·첫 차례 룰렛 3.6초, 바로 시작은 테이블 그대로 주사위만 컵으로 모으고 룰렛 2.3초), 점수 종이 (카드 없음, 최대 4명, 빠른 모드 없음, 굴리기 키 `C`를 누르고 있다 떼기). WebGL이 없으면 2D 주사위 칸 |
| `games/omok.js` | 오목 규칙 엔진(순수 함수 `judge`·`scanFours` 등: 장목 3종, 3-3·4-4 3종, 5목 우선, 거짓 3), 오프닝(없음·Swap·Swap2), 체스 시계(총 시간+추가 시간, 시간 초과 패배), 봇, 방 설정 레버(자유·커스텀·렌주, 세부 설정 접기), 공통 테이블 위 3D 오목판과 체스 시계(바로 위 자기 카메라, 판 아래/옆에 시계, 누르면 반투명 미리 보기 → [놓기], 금수는 빨간 ✕, 이긴 줄 표시, 시작 연출 2.4초), 2D 판(SVG), 기보 복사 (최대 2명, 빠른 모드 없음, `tests/omok.cases.js`) |
| `tests/engine.test.js` | 엔진 테스트 (`node tests/engine.test.js`). `tests/*.cases.js`(야추다이스는 `tests/yahtzee.cases.js`, 오목은 `tests/omok.cases.js`), `tests/quoridor.fuzz.js`를 불러서 함께 돌림 |
| `roulette.js` | 첫 차례 룰렛 순서 계산(순수 함수, 화면·소리 없음). `Roulette.plan(인원, 첫 차례, 옵션)` → 칸 넘김 시각 목록. 빠른 구간 칸 수는 매 판 무작위(`pickFast`), 감속은 빠른 간격에서 바로 같은 비율로 늘어 마지막 간격에 닿음. 값은 `Roulette.DEF` 한 곳(테스트룸에서 맞춘 값). `lead`(돌기 전 후보가 모두 켜진 시간)와 `fixed`(방장이 고른 선: 돌지 않음, `planFor(n,first,fast)`에서 fast<0)도 계산함. 쿼리도에 연결됨, 나머지 게임은 아직 |
| `lab.html` | 연출 테스트룸 (메인에 링크 없음, 배포 주소 `/gura/lab.html`). 지금은 첫 차례 룰렛만: 인원·첫 차례·화면 비율, 슬라이더(빠른 칸 수 범위, 빠른 간격, 감속 비율, 마지막 간격, 앞 연출(후보), 멈춘 뒤 대기), [다시 보기], [값 복사]. 마지막 값은 `gura-lab-roulette`에 저장 |
| `tests/roulette.test.js` | 룰렛 계산 테스트 (`node tests/roulette.test.js`). `tests/engine.test.js`도 `roulette.js`를 불러서 `hostStart`가 돌아가게 함 |
| `manifest.webmanifest`, `sw.js`, 아이콘 | 홈 화면 앱 |

- 공통 코드는 `G`(지금 화면의 게임)와 `EG()`(방장 엔진이 돌리는 게임)를 통해 게임 모듈의 함수를 부릅니다.
- 게임 모듈이 갖출 것은 `games/gura.js`를 기준으로 보면 됩니다. 크게 세 가지입니다.
  - 카드: `cardHTML`, `drawFace`
  - 방 설정: `defaults`, `roomSet`, `ruleSet`
  - 엔진과 화면 훅: `engine.start/act/tick/snap`, `hud`, `handMarks`, `buttons` 등
  - 첫 차례 룰렛이 필요한 게임: `G.firstPick=true`, `G.introMs=(again,fast)=>시작 전 연출 ms + Roulette.plan(2,0,{fastCount:fast}).total + 여유`. 방장이 `hostStart`에서 빠른 칸 수(`H.fp`)를 정해 신호(`fp`)로 보내고, 게임의 `G.intro(t0,{total,again,fast})`가 `firstPick(룰렛 시작 시각,{seats,first,fast})`를 만들어 매 프레임 `ctl.idx(now)`(켜진 자리)와 `ctl.tick(now)`(틱 소리, 끝나는 순간 true → `ctl.msg()`를 안내로 표시)를 씁니다. 첫 차례는 엔진이 정하고 룰렛은 그 자리에서 멈추도록 돕니다. 쿼리도 `G.intro` 참고. 방 설정에 `pickfirst` 규칙 스위치(`G.ruleSet`)를 두면 방장이 대기실 목록의 [선] 버튼으로 선 플레이어를 고르고(`H.firstName`, 안 고르면 방장), 엔진은 `firstSeat(cnt)`로 그 자리를 첫 차례로 쓰며 시작 신호 `fp`는 -1(룰렛 없이 그 자리만 알림)
  - 골라 쓰는 값: `maxHi`(최대 인원, 쿼리도 4), `no3D`(3D 테이블을 그리지 않음), `specNote`(관전 중 안내 문구), `noFast`(빠른 모드 없음: 로비·방 설정·칩에서 게임 모드를 숨김), `render3D(t,dt)`(공통 카메라 대신 자기 카메라로 T.scene을 그림), `introMs`·`intro(t0,{total,again})`(카드가 없는 게임의 시작 연출: 방장이 그 시간만큼 제한 시간·봇을 멈추고, 화면은 intro가 그림. introMs는 숫자나 `again=>ms`(결과 화면에서 바로 시작이면 다른 길이). 카드 게임은 `dealAnim`), `usesDbl`(게임 중 메뉴에 '두 번 눌러 놓기' 보임), `settingsHTML(c,{stepRow})`(방 설정의 게임 칸을 직접 그림: 대부호의 룰 레버), `panelAct(a)`(패널 버튼을 게임이 먼저 처리, 처리했으면 true), `nameTag(p,i)`(이름표·대기실 자리 이름 앞 표시), `overRank(p)`(결과 화면 순위 옆 글자), `waitExtra(isHost)`(대기실 요약 아래), `engine.waitSnap(s)`(대기실 상태에 게임별 값 추가)
- 카드가 없는 게임(쿼리도, 야추다이스)도 공통 코드가 `hand`가 빈 사람을 끝난 사람으로 보므로, 게임 중에는 `hand`에 표시용 값 하나를 넣어 둡니다.
- 방의 게임 종류는 `H.cfg.game`에 들어 있습니다. 방장이 대기실의 방 설정에서 바꿀 수 있습니다.
- 새 게임을 추가하는 순서:
  1. `games/새게임.js`를 만듭니다.
  2. `index.html`의 `<script src>`와 `GAME_IDS`에 추가합니다.
  3. 테스트에 대전을 추가합니다.
  4. 첫 차례를 뽑는 게임이면 위 `firstPick` 방식으로 룰렛을 붙입니다 (값은 `lab.html`에서 같이 맞춤).

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
- **저장 키**: localStorage 키는 `gura-` 로 시작합니다. 방 설정은 게임별로 저장합니다 (`gura-roomcfg`, `gura-roomcfg-president`, `gura-roomcfg-quoridor`, `gura-roomcfg-yahtzee`, `gura-roomcfg-omok`). 오목은 이 밖에 커스텀 규칙 기억(`gura-omok-custom`)과 세부 설정 펼침(`gura-omok-more`)도 저장합니다.
