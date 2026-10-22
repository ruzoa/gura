/* 체스 테스트 (tests/engine.test.js가 이 파일을 불러서 { } 블록 안에서 돌림)
   앞에서 정해져 있는 것: CH(=GAMES.chess), fail(), hostNew·hostStart·engineTick·snapFor 등 공통 엔진 */
const T=CH._test;
const eq=(a,b,m)=>{if(a!==b)fail('chess '+m+': '+a+' != '+b)};

/* 수 생성: perft (알려진 국면에서 깊이별 수의 개수가 정답과 같은지) */
for(const [fen,ns] of [
  [T.START,[20,400,8902,197281]],
  ['r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',[48,2039,97862]],   // 캐슬링·앙파상·프로모션이 섞인 국면
  ['8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',[14,191,2812,43238]],                           // 앙파상 핀
  ['r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1',[6,264,9467]],
  ['rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8',[44,1486,62379]],
  ['r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10',[46,2079,89890]]]){
  const p=T.fromFEN(fen);
  ns.forEach((n,i)=>eq(T.perft(p,i+1),n,'perft '+fen.slice(0,20)+' d'+(i+1)));
  eq(T.toFEN(p),fen,'fen round trip');
}
/* 기보 표기 */
{const S=(fen,u)=>{const p=T.fromFEN(fen);return T.san(p,T.fromUci(p,u))};
 eq(S(T.START,'g1f3'),'Nf3','san knight');
 eq(S('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1','e1g1'),'O-O','san short castle');
 eq(S('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1','e1c1'),'O-O-O','san long castle');
 eq(S('4k3/P7/8/8/8/8/8/4K3 w - - 0 1','a7a8q'),'a8=Q+','san promotion check');
 eq(S('4k3/P7/8/8/8/8/8/4K3 w - - 0 1','a7a8n'),'a8=N','san under-promotion');
 eq(S('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2','e5d6'),'exd6','san en passant');
 eq(S('4k3/8/8/8/8/8/4K3/R6R w - - 0 1','a1d1'),'Rad1','san file disambiguation');
 eq(S('4k3/8/8/R7/8/8/8/R3K3 w - - 0 1','a1a3'),'R1a3','san rank disambiguation');
 eq(S('6k1/5ppp/8/8/8/8/8/3R2K1 w - - 0 1','d1d8'),'Rd8#','san mate');}
/* 끝 판정 */
{const E=(fen,rep)=>T.endOf(T.fromFEN(fen),rep||1);
 eq(E('6k1/5ppp/8/8/8/8/8/3R2K1 w - - 0 1'),'','not over');
 eq(E('3R2k1/5ppp/8/8/8/8/8/6K1 b - - 0 1'),'mate','checkmate');
 eq(E('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'),'stale','stalemate');
 eq(E('4k3/8/8/8/8/8/8/4K3 w - - 0 1'),'dead','K v K');
 eq(E('4k3/8/8/8/8/8/8/2B1K3 w - - 0 1'),'dead','KB v K');
 eq(E('4k3/8/8/8/8/8/8/1N2K3 w - - 0 1'),'dead','KN v K');
 eq(E('2b1k3/8/8/8/8/8/8/2B1K3 w - - 0 1'),'','KB v KB opposite colours can mate');
 eq(E('3bk3/8/8/8/8/8/8/2B1K3 w - - 0 1'),'dead','KB v KB same colour');
 eq(E('4k3/8/8/8/8/8/8/1NN1K3 w - - 0 1'),'','KNN v K is not dead');
 eq(E('4k3/8/8/8/8/8/8/R3K3 w - - 100 80'),'fifty','fifty-move rule');
 eq(E('4k3/8/8/8/8/8/8/R3K3 w - - 99 80'),'','not yet fifty');
 eq(E('6k1/5ppp/8/8/8/8/8/3R2K1 w - - 0 1',3),'rep','threefold');}
/* 반복: 나이트를 두 번 왔다 갔다 하면 시작 국면이 세 번 */
{const r=T.replay(['g1f3','g8f6','f3g1','f6g8','g1f3','g8f6','f3g1','f6g8']);
 eq(Math.max(...Object.values(r.reps)),3,'repetition count');}
/* 앙파상을 할 수 없으면 두 칸 나간 폰의 국면도 같은 국면 */
{const a=T.fromFEN('4k3/8/8/8/4P3/8/8/4K3 b - e3 0 1'),b=T.fromFEN('4k3/8/8/8/4P3/8/8/4K3 b - - 0 1');eq(T.repKey(a),T.repKey(b),'ep ignored when impossible');}
/* 시간 초과일 때 상대가 체크메이트를 할 수 없으면 무승부 */
eq(T.cantMate(T.fromFEN('4k3/8/8/8/8/8/8/1N2K3 w - - 0 1'),0),true,'cantMate knight');
eq(T.cantMate(T.fromFEN('4k3/8/8/8/8/8/P7/4K3 w - - 0 1'),0),false,'pawn can mate');
/* 봇: 한 수로 체크메이트가 되면 둠 */
for(const lv of [1,2])eq(T.toUci(T.botPick(T.fromFEN('6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1'),lv,{})),'d1d8','bot mate in one lv'+lv);

/* ---------- 엔진 ---------- */
const mkRoom=(over,names=['가','나'])=>{
  hostNew(false,'t','t');
  H.cfg={...cfgFor('chess'),...over,game:'chess'};
  H.members=names.map((n,i)=>({name:n,bot:false,conn:null,host:i===0}));
  hostStart();
  NOW+=10000;H.c.since=NOW;   // 시작 연출 지나감 (연출 동안 시계는 멈춤)
  return H;
};
const mv=(i,u)=>CH.engine.act(i,{t:'mv',u});
/* 선 직접 고르기: 방장이 백. 남의 차례·잘못된 수는 무시 */
{mkRoom({pickfirst:1,tm:3,inc:2});
 eq(H.c.A,0,'host is white');eq(H.c.co.join(),'0,1','colours');eq(H.turn,0,'white to move');
 mv(1,'e7e5');eq(H.c.mv.length,0,'not your turn');
 mv(0,'e2e5');eq(H.c.mv.length,0,'illegal move ignored');
 mv(0,'e2e4');eq(H.c.mv.join(),'e2e4','move made');eq(H.turn,1,'turn passes');eq(H.c.sn[0],'e4','san stored');
 eq(H.c.rem[0],180000+2000,'increment after move');
 const s=snapFor(1);eq(s.c.fen.split(' ')[1],'b','snap fen side');eq(s.dl,180000,'deadline is black clock');}
/* 잡은 기물·체크·체크메이트 (바보의 메이트) */
{mkRoom({pickfirst:1});
 for(const [i,u] of [[0,'f2f3'],[1,'e7e5'],[0,'g2g4'],[1,'d8h4']])mv(i,u);
 eq(H.phase,'over','fool mate over');eq(H.c.res.w,1,'black wins');eq(H.c.res.why,'mate','by mate');eq(H.players[1].rank,1,'rank winner');eq(H.c.chk,1,'check flag');}
{mkRoom({pickfirst:1});
 for(const [i,u] of [[0,'e2e4'],[1,'d7d5'],[0,'e4d5']])mv(i,u);
 eq(H.c.cp[0].join(),'1','white captured a pawn');}
/* 무승부 제안: 상대가 받으면 무승부, 그냥 두면 없던 일, 다시 누르면 거둠 */
{mkRoom({pickfirst:1});
 CH.engine.act(0,{t:'draw'});eq(H.c.dr,0,'offer');
 mv(0,'e2e4');eq(H.c.dr,0,'offer stays when offerer moves');
 mv(1,'e7e5');eq(H.c.dr,-1,'moving declines');
 CH.engine.act(1,{t:'draw'});CH.engine.act(1,{t:'draw'});eq(H.c.dr,-1,'withdraw');
 CH.engine.act(1,{t:'draw'});CH.engine.act(0,{t:'draw'});eq(H.phase,'over','accepted');eq(H.c.res.w,-1,'draw');eq(H.c.res.why,'agree','by agreement');}
/* 시계: 시간 초과 패배, 상대에게 메이트할 기물이 없으면 무승부 */
{mkRoom({pickfirst:1,tm:1,inc:0});
 NOW+=60001;engineTick();eq(H.phase,'over','flag');eq(H.c.res.w,1,'black wins on time');eq(H.players[0].surrendered,'time','time flag');}
/* 항복 */
{mkRoom({pickfirst:1});CH.engine.act(1,{t:'surrender'});eq(H.c.res.w,0,'surrender');}
/* 바로 시작하면 색을 바꿈 */
{mkRoom({pickfirst:1});CH.engine.act(1,{t:'surrender'});
 hostStart();eq(H.c.co.join(),'1,0','colours swap on rematch');eq(H.turn,1,'new white moves first');}
/* 3번 반복은 저절로 무승부 */
{mkRoom({pickfirst:1});
 for(let k=0;k<2;k++)for(const [i,u] of [[0,'g1f3'],[1,'g8f6'],[0,'f3g1'],[1,'f6g8']])mv(i,u);
 eq(H.phase,'over','repetition ends');eq(H.c.res.why,'rep','why rep');}
/* 기보 (PGN) */
{mkRoom({pickfirst:1});for(const [i,u] of [[0,'f2f3'],[1,'e7e5'],[0,'g2g4'],[1,'d8h4']])mv(i,u);
 const pg=T.recordText({c:snapFor(0).c,ps:snapFor(0).ps,st:'over'});
 if(!pg.includes('1. f3 e5 2. g4 Qh4# 0-1'))fail('chess pgn '+pg);
 if(!pg.includes('[White "가"]'))fail('chess pgn white');}

/* 봇끼리 끝까지 (기보를 처음부터 다시 두어 모든 수가 규칙에 맞는지) */
function playOutC(over,lvs){
  hostNew(false,'t','t');
  H.cfg={...cfgFor('chess'),...over,game:'chess'};
  H.members=[0,1].map(i=>({name:'b'+i,bot:true,conn:null,host:i===0,lv:lvs[i%lvs.length]}));
  hostStart();
  let ticks=0,guard=0;
  while(H.phase!=='over'&&guard++<20000){NOW+=250;engineTick();ticks++}
  if(H.phase!=='over'){fail('chess stuck '+H.c.mv.length);return ticks}
  const ranks=H.players.map(p=>p.rank).join();
  if(ranks!=='1,2'&&ranks!=='2,1'&&ranks!=='1,1')fail('chess ranks '+ranks);
  const r=T.replay(H.c.mv);if(T.toFEN(r.p)!==H.c.fen)fail('chess replay mismatch');
  return ticks;
}
globalThis.playOutC=playOutC;
