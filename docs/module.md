# 게임 모듈 만들기

- 공통 코드는 `G`(지금 화면의 게임)와 `EG()`(방장 엔진이 돌리는 게임)를 통해 게임 모듈의 함수를 부릅니다.
- 게임 모듈이 갖출 것은 `games/gura.js`를 기준으로 보면 됩니다. 크게 세 가지입니다.
  - 카드: `cardHTML`, `drawFace`
  - 방 설정: `defaults`, `roomSet`, `ruleSet`(켜기·끄기 스위치. 선 플레이어처럼 고르는 것은 `pick:1`을 주면 선택·무작위 버튼 둘로 그려지고, 값 1 = 선택·0 = 무작위. 판자·2D 창이 `rbRuleItem`·`pickRowHTML`로 그림)
  - 엔진과 화면 훅: `engine.start/act/tick/snap`, `hud`, `handMarks`, `buttons` 등
  - 첫 차례 주사위가 필요한 게임: `G.firstPick=true`, `G.introMs=(again,rolls)=>시작 전 연출 ms + DicePick.totalFor(rolls) + 여유`. 방장이 `hostStart`에서 던질 횟수(`H.fp`, 다시 굴리기 면이 나오면 늘어남)를 정해 신호(`fp`)로 보내고, 게임의 `G.intro(t0,{total,again,rolls,seed})`가 `firstPick(주사위 시작 시각,{seats,first,rolls,seed})`를 만듭니다. 매 프레임 `m.apply(ctl.pose(now),크기,가운데x,바닥y,가운데z)`로 주사위(`m=DicePick.mesh(THREE,인원,자리 색 목록)`를 게임 장면에 넣어 둠)를 움직이고, `ctl.idx(now)`(켜질 자리: 멈추기 전 -1)로 이름표·고리를 켜고, `ctl.tick(now)`(닿는 소리, 멈추는 순간 한 번 true)가 true면 `fxSay(ctl.msg(),색)`으로 가운데에 안내합니다. 연출이 끝나거나 나갈 때 `m.dispose()`. 첫 차례는 엔진이 정하고 주사위는 그 자리 색이 위로 오도록 굴러갑니다. 쿼리도·야추다이스·포커 `G.intro` 참고. WebGL이 없으면 주사위 없이 `idx`만 씁니다. 방 설정에 `pickfirst` 선택·무작위 칸(`G.ruleSet`의 `{k:'pickfirst',pick:1,…}`)을 두고 선택으로 하면 방장이 이름표 메뉴의 [선]으로 선 플레이어를 고르고(`H.firstName`, 안 고르면 방장), 엔진은 `firstSeat(cnt)`로 그 자리를 첫 차례로 쓰며 시작 신호 `fp`는 -1(주사위 없이 그 자리만 알림).
  - 골라 쓰는 값: `maxHi`(최대 인원, 쿼리도 4), `maxOf(방 설정)`(규칙에 따라 달라지는 최대 인원, 있으면 `maxHi`보다 먼저 씀: `roomSetOf(게임, 방 설정)`이 부름, 알까기 오목 모드 2명), `fixCfg(방 설정, 앉은 수, strict)`(규칙·게임을 바꾼 뒤 방 설정을 상한에 맞춤, strict에서 못 맞추면 `null`로 거절), `minN`(시작 최소 인원: 숫자나 `cfg=>숫자`, 없으면 2. 블랙잭은 봇 딜러면 1), `no3D`(3D 테이블을 그리지 않음), `specNote`(관전 중 안내 문구), `noFast`(빠른 모드 없음: 로비·방 설정·칩에서 게임 모드를 숨김), `oneBotLv`(봇 난이도가 하나뿐: 대기실에서 봇 난이도 단추·메뉴를 숨김, 포커), `render3D(t,dt)`(공통 카메라 대신 자기 카메라로 T.scene을 그림), `introMs`·`intro(t0,{total,again,rolls,seed})`(카드가 없는 게임의 시작 연출: 방장이 그 시간만큼 제한 시간·봇을 멈추고, 화면은 intro가 그림. introMs는 숫자나 `(again,rolls)=>ms`(결과 화면에서 바로 시작이면 다른 길이, rolls는 첫 차례 주사위를 던질 횟수). 카드 게임은 `dealAnim`, 카드 나누기 뒤에 연출을 더 붙이려면 `dealExtra()`가 그 ms를 돌려줌(방장 엔진에서 불림, 그동안 제한 시간·봇 멈춤. 대부호의 계급 카드 교환)), `usesDbl`(예전 표시: '두 번 눌러 놓기'는 이제 메뉴·로비 설정에 언제나 보이고, 고른 자리를 다시 누르는 게임(쿼리도·오목)은 `dblTap`을 읽어 씀, 기본 켜기), `settingsHTML(c,{stepRow})`(방 설정의 게임 칸을 직접 그림: 대부호의 룰 레버), `panelAct(a)`(패널 버튼을 게임이 먼저 처리, 처리했으면 true), `nameTag(p,i)`(이름표·대기실 자리 이름 앞 표시), `overRank(p)`(결과 화면 순위 옆 글자), `waitExtra(isHost)`(대기실 요약 아래), `engine.waitSnap(s)`(대기실 상태에 게임별 값 추가)
- `G.intro`는 시작 연출뿐 아니라 게임 중 `beginDeal`을 부를 때마다(판마다 카드 나누기) 불립니다. 시작 연출만 그리려면 게임 상태로 거릅니다(포커는 `V.pk.ph==='intro'`일 때만).
- 카드가 없는 게임(쿼리도, 야추다이스)과 카드를 손패 대신 테이블에 펼치는 게임(블랙잭)도 공통 코드가 `hand`가 빈 사람을 끝난 사람으로 보므로, 게임 중에는 `hand`에 표시용 값 하나를 넣어 둡니다.
- 방의 게임 종류는 `H.cfg.game`에 들어 있습니다. 방장이 대기실의 방 설정에서 바꿀 수 있습니다.
- 새 게임을 추가하는 순서:
  1. `games/새게임.js`를 만듭니다.
  2. `index.html`의 `<script src>`(`core/` 앞, 게임 파일들 사이)와 `core/base.js`의 `GAME_IDS`에 추가합니다.
  3. 테스트에 대전을 추가합니다.
  4. 첫 차례를 뽑는 게임이면 위 `firstPick` 방식으로 주사위를 붙입니다 (값은 `lab.html`에서 같이 맞춤).
