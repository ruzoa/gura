/* index.html 공통 코드 · 게임 모듈 준비·첫 화면 시작(맨 마지막에 불러옴). 파일 순서는 index.html의 <script src> 순서 */
/* 게임 모듈 준비: 처음 한 번 이벤트 연결, 지금 게임이 아닌 것들의 화면 요소는 숨김 */
for(const id of GAME_IDS)GAMES[id].init();
for(const id of GAME_IDS)if(GAMES[id]!==G)GAMES[id].leave();
G.enter();
init3D();
frontStart();
requestAnimationFrame(frame);
render();
renderKeys();
if(noPeerLib()){setNote('#netNote','온라인 연결 라이브러리를 불러오지 못했습니다. 새로고침이 필요합니다.',true)}
