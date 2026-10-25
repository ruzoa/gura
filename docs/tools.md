# 테스트·테스트룸·앱 파일

> 원래 `CLAUDE.md` 파일 구조 표에 있던 자세한 설명입니다. 이 기능을 바꾸면 이 문서를 고칩니다.

## `tests/engine.test.js`

엔진 테스트 (`node tests/engine.test.js`). `tests/*.cases.js`(야추다이스는 `tests/yahtzee.cases.js`, 오목은 `tests/omok.cases.js`, 체스는 `tests/chess.cases.js`, 블랙잭은 `tests/blackjack.cases.js`, 포커는 `tests/poker.cases.js`, 알까기는 `tests/alkkagi.cases.js`), `tests/quoridor.fuzz.js`를 불러서 함께 돌림

## `roulette.js`

첫 차례 룰렛 순서 계산(순수 함수, 화면·소리 없음). `Roulette.plan(인원, 첫 차례, 옵션)` → 칸 넘김 시각 목록. 빠른 구간 칸 수는 매 판 무작위(`pickFast`), 감속은 빠른 간격에서 바로 같은 비율로 늘어 마지막 간격에 닿음. 값은 `Roulette.DEF` 한 곳(테스트룸에서 맞춘 값). `lead`(돌기 전 후보가 모두 켜진 시간)와 `fixed`(방장이 고른 선: 돌지 않음, `planFor(n,first,fast)`에서 fast<0)도 계산함. 쿼리도·알까기·포커(첫 딜러 버튼)에 연결됨

## `lab.html`

연출 테스트룸 (메인에 링크 없음, 배포 주소 `/gura/lab.html`, 위쪽 링크로 `lab-icon.html`과 오감). 첫 차례 룰렛: 인원·첫 차례·화면 비율, 슬라이더(빠른 칸 수 범위, 빠른 간격, 감속 비율, 마지막 간격, 앞 연출(후보), 멈춘 뒤 대기), [다시 보기], [값 복사]. 마지막 값은 `gura-lab-roulette`에 저장

## `lab-icon.html`

테스트룸 · 아이콘 찍기. 게임 속 탁자(툰 셰이딩·원목 상판·받침·펠트, `core/table3d.js`의 그림 코드를 옮겨 둠: 게임 쪽 탁자를 바꾸면 여기도 맞춤)를 들판에서 찍어 `icon-512.png`, `icon-192.png`, `apple-touch-icon-180.png`, `icon-maskable-512.png`(안드로이드 안전 영역에 맞게 0.8배), `og-image.png`(링크 미리보기 1200×630)로 저장. 안개는 카메라 거리에 맞춰 탁자 뒤 '안개 거리'만큼 떨어진 곳부터(망원에서도 탁자가 가려지지 않게, 기본 5, 100은 안개 없음). 방향·각도·크기·원근감·다리 길이(게임은 1)·윤곽선(게임은 1), 하늘(진짜 하늘: 위로 갈수록 짙은 파랑 그라데이션 + 흰 구름, 또는 게임 그대로 단색), 풀·나무·그림자·구름 그림자·펠트 켜고 끄기, 안전 영역 점선 원, 아이폰·안드로이드·작은 크기 미리보기. 값은 `gura-lab-icon`에 저장

## `tests/roulette.test.js`

룰렛 계산 테스트 (`node tests/roulette.test.js`). `tests/engine.test.js`도 `roulette.js`를 불러서 `hostStart`가 돌아가게 함

## `manifest.webmanifest`, `sw.js`, 아이콘

홈 화면 앱

