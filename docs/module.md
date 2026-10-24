# 게임 모듈 만들기

- 공통 코드는 `G`(지금 화면의 게임)와 `EG()`(방장 엔진이 돌리는 게임)를 통해 게임 모듈의 함수를 부릅니다.
- 게임 모듈이 갖출 것은 `games/gura.js`를 기준으로 보면 됩니다. 크게 세 가지입니다.
  - 카드: `cardHTML`, `drawFace`
  - 방 설정: `defaults`, `roomSet`, `ruleSet`
  - 엔진과 화면 훅: `engine.start/act/tick/snap`, `hud`, `handMarks`, `buttons` 등
  - 첫 차례 룰렛이 필요한 게임: `G.firstPick=true`, `G.introMs=(again,fast)=>시작 전 연출 ms + Roulette.plan(2,0,{fastCount:fast}).total + 여유`. 방장이 `hostStart`에서 빠른 칸 수(`H.fp`)를 정해 신호(`fp`)로 보내고, 게임의 `G.intro(t0,{total,again,fast})`가 `firstPick(룰렛 시작 시각,{seats,first,fast})`를 만들어 매 프레임 `ctl.idx(now)`(켜진 자리)와 `ctl.tick(now)`(틱 소리, 끝나는 순간 true → `ctl.msg()`를 안내로 표시)를 씁니다. 첫 차례는 엔진이 정하고 룰렛은 그 자리에서 멈추도록 돕니다. 쿼리도 `G.intro` 참고. 방 설정에 `pickfirst` 규칙 스위치(`G.ruleSet`)를 두면 방장이 대기실 목록의 [선] 버튼으로 선 플레이어를 고르고(`H.firstName`, 안 고르면 방장), 엔진은 `firstSeat(cnt)`로 그 자리를 첫 차례로 쓰며 시작 신호 `fp`는 -1(룰렛 없이 그 자리만 알림)
  - 골라 쓰는 값: `maxHi`(최대 인원, 쿼리도 4), `minN`(시작 최소 인원: 숫자나 `cfg=>숫자`, 없으면 2. 블랙잭은 봇 딜러면 1), `no3D`(3D 테이블을 그리지 않음), `specNote`(관전 중 안내 문구), `noFast`(빠른 모드 없음: 로비·방 설정·칩에서 게임 모드를 숨김), `render3D(t,dt)`(공통 카메라 대신 자기 카메라로 T.scene을 그림), `introMs`·`intro(t0,{total,again})`(카드가 없는 게임의 시작 연출: 방장이 그 시간만큼 제한 시간·봇을 멈추고, 화면은 intro가 그림. introMs는 숫자나 `again=>ms`(결과 화면에서 바로 시작이면 다른 길이). 카드 게임은 `dealAnim`, 카드 나누기 뒤에 연출을 더 붙이려면 `dealExtra()`가 그 ms를 돌려줌(방장 엔진에서 불림, 그동안 제한 시간·봇 멈춤. 대부호의 계급 카드 교환)), `usesDbl`(예전 표시: '두 번 눌러 놓기'는 이제 메뉴·로비 설정에 언제나 보이고, 고른 자리를 다시 누르는 게임(쿼리도·오목)은 `dblTap`을 읽어 씀, 기본 켜기), `settingsHTML(c,{stepRow})`(방 설정의 게임 칸을 직접 그림: 대부호의 룰 레버), `panelAct(a)`(패널 버튼을 게임이 먼저 처리, 처리했으면 true), `nameTag(p,i)`(이름표·대기실 자리 이름 앞 표시), `overRank(p)`(결과 화면 순위 옆 글자), `waitExtra(isHost)`(대기실 요약 아래), `engine.waitSnap(s)`(대기실 상태에 게임별 값 추가)
- 카드가 없는 게임(쿼리도, 야추다이스)과 카드를 손패 대신 테이블에 펼치는 게임(블랙잭)도 공통 코드가 `hand`가 빈 사람을 끝난 사람으로 보므로, 게임 중에는 `hand`에 표시용 값 하나를 넣어 둡니다.
- 방의 게임 종류는 `H.cfg.game`에 들어 있습니다. 방장이 대기실의 방 설정에서 바꿀 수 있습니다.
- 새 게임을 추가하는 순서:
  1. `games/새게임.js`를 만듭니다.
  2. `index.html`의 `<script src>`와 `GAME_IDS`에 추가합니다.
  3. 테스트에 대전을 추가합니다.
  4. 첫 차례를 뽑는 게임이면 위 `firstPick` 방식으로 룰렛을 붙입니다 (값은 `lab.html`에서 같이 맞춤).
