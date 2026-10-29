# 테스트·테스트룸·앱 파일

> 원래 `CLAUDE.md` 파일 구조 표에 있던 자세한 설명입니다. 이 기능을 바꾸면 이 문서를 고칩니다.

## `tests/engine.test.js`

엔진 테스트 (`node tests/engine.test.js`). `tests/*.cases.js`(야추다이스는 `tests/yahtzee.cases.js`, 오목은 `tests/omok.cases.js`, 체스는 `tests/chess.cases.js`, 블랙잭은 `tests/blackjack.cases.js`, 포커는 `tests/poker.cases.js`, 알까기는 `tests/alkkagi.cases.js`), `tests/quoridor.fuzz.js`를 불러서 함께 돌림

## `dicepick.js`

첫 차례 주사위: 모양·순서·자세 계산(순수 함수, 화면·소리 없음) + THREE 주사위 만들기(`DicePick.mesh`). `DicePick.plan(인원, 첫 차례, {rolls, seed, dur, durAgain, pause, wait})` → 굴림마다 목표 면·시작/끝 자리·회전·높이표·닿는 소리 시각(`impacts`), `poseAt(e)`(e ms 시점의 자세, 한 변 = 1인 단위, 바닥에 파고들지 않게 가장 낮은 꼭짓점으로 높이를 맞춤), `at(e)`(멈추기 전 -1). 면: 2·3·6명 6면체, 4·8명 8면체(색마다 면 수 같음, 이웃한 면은 다른 색), 5명 6면체·7명 8면체는 남는 한 면이 '다시 굴리기'(검은 면 + 빨간 ↻). `pickRolls(n)`은 방장이 던질 횟수를 뽑음(다시 굴림 확률 5명 1/6·7명 1/8, 최대 `MAXR`), `totalFor(rolls)`는 연출 길이(첫 굴림 + (횟수-1)×(쉼 + 다시 굴림) + 멈춘 뒤 안내), rolls<0은 방장이 고른 선(굴리지 않음). 값은 `DicePick.DEF` 한 곳(테스트룸에서 맞춘 값: 첫 굴림 1.8초, 다시 굴림 1.3초, 쉼 0.26초, 안내 1.1초). 자리 색 `DicePick.SEAT_COL`(8색). 쿼리도(보드 가운데)·야추다이스(펠트 가운데)·포커(탁자 가운데)에 연결됨. 같은 씨앗이면 모두 같은 굴림

## `lab.html`

연출 테스트룸 (메인에 링크 없음, 배포 주소 `/gura/lab.html`, 위쪽 링크로 `lab-icon.html`·`lab-hand.html`·`lab-poker.html`과 오감). 첫 차례 주사위: 실제 `dicepick.js`로 3D 주사위를 굴려 봄. 인원(2~8)·첫 차례·던진 횟수(자동 = 방장 뽑기, 1~3번)·카메라(앉은 눈 37°, 바로 위)·화면 비율, 슬라이더(첫 굴림 길이, 다시 굴림 길이, 굴림 사이 쉼, 멈춘 뒤 안내, 주사위 크기), 면 배치와 연출 길이 표시, [다시 보기], [값 복사]. 마지막 값은 `gura-lab-dice`에 저장

## `lab-poker.html`

테스트룸 · 포커 카메라. 고른 화면 크기(휴대폰 세로·작은 휴대폰·태블릿 세로·휴대폰 가로·PC)의 게임(`index.html`)을 iframe으로 줄여 보여 주고, 혼자(오프라인) 포커 탁자를 차려 고른 인원(2~8명, 나머지는 봇)으로 바로 시작. 각도·화각(초점 거리 mm, 클수록 망원)·거리·위아래(카메라를 화면 위아래로 옮김) 슬라이더는 `GAMES.poker.labCam`으로 바로 바뀜(세로 화면에만 씀). [값 복사]는 `PK_EL=…,PK_FL=…,PK_D=…,PK_Y=…`. 마지막 값은 `gura-lab-poker`에 저장  (포커 카메라가 공통 카메라와 같아지면서 `GAMES.poker.labCam`은 없어졌고 각도·화각 슬라이더는 더 쓰지 않음. 화면 크기별 미리 보기와 인원 고르기만 씀)

## `lab-icon.html`

테스트룸 · 아이콘 찍기. 게임 속 탁자(툰 셰이딩·원목 상판·받침·펠트, `core/table3d.js`의 그림 코드를 옮겨 둠: 게임 쪽 탁자를 바꾸면 여기도 맞춤)를 들판에서 찍어 `icon-512.png`, `icon-192.png`, `apple-touch-icon-180.png`, `icon-maskable-512.png`(안드로이드 안전 영역에 맞게 0.8배), `og-image.png`(링크 미리보기 1200×630)로 저장. 안개는 카메라 거리에 맞춰 탁자 뒤 '안개 거리'만큼 떨어진 곳부터(망원에서도 탁자가 가려지지 않게, 기본 5, 100은 안개 없음). 방향·각도·크기·원근감·다리 길이(게임은 1)·윤곽선(게임은 1), 하늘(진짜 하늘: 위로 갈수록 짙은 파랑 그라데이션 + 흰 구름, 또는 게임 그대로 단색), 풀·나무·그림자·구름 그림자·펠트 켜고 끄기, 안전 영역 점선 원, 아이폰·안드로이드·작은 크기 미리보기. 값은 `gura-lab-icon`에 저장

## `tests/dicepick.test.js`

주사위 계산 테스트 (`node tests/dicepick.test.js`): 인원별 면 수·주인, 모든 인원·첫 차례·씨앗에서 마지막에 위로 오는 면의 주인 = 첫 차례(중간 굴림은 다시 굴리기 면), 매 프레임 바닥 아래로 안 파고듦, 같은 씨앗이면 같은 자세, 던진 횟수 분포(평균 1/(1-p)), 연출 길이 식. `tests/engine.test.js`도 `dicepick.js`를 불러서 `hostStart`가 돌아가게 하고 야추·포커 신호(`fp`)와 연출 길이를 확인

## `manifest.webmanifest`, `sw.js`, 아이콘

홈 화면 앱

