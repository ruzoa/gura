/* 장기 테스트 (tests/engine.test.js가 이 파일을 불러서 { } 블록 안에서 돌림)
   앞에서 정해져 있는 것: JG(=GAMES.janggi), fail(), hostNew·hostStart·engineTick·snapFor 등 공통 엔진 */
const T=JG._test;
T.setBotScale(.3);   // 봇 탐색 양을 줄여 테스트를 빠르게
const eq=(a,b,m)=>{if(a!==b)fail('janggi '+m+': '+a+' != '+b)};
const {IX,ZOL,SA,SANG,MA,PO,CHA,JANG,PASS}=T;
/* 국면 만들기: [x,y,종류,색] 목록 + 둘 차례 */
const P=(list,side)=>{const p=T.newPos();for(const [x,y,t,c] of list){p.b[IX(x,y)]=t|(c<<3);if(t===JANG)p.k[c]=IX(x,y)}p.side=side||0;T.rehash(p);return p};
const tos=(p,x,y)=>T.legal(p,true).filter(m=>(m&127)===IX(x,y)).map(m=>{const t=(m>>7)&127;return (t%9)+','+((t/9)|0)}).sort().join(' ');
const K=[[4,1,JANG,0],[3,8,JANG,1]];   // 마주 보지 않는 두 장

/* 처음 국면: 초가 둘 수 있는 수 (손으로 센 값: 졸 13, 차 4, 사 4, 장 6, 포 0, 마 2+1, 상 0+1, 쉬기 1) */
eq(T.legal(T.startPos([0,0])).length,32,'start moves 마상마상');
eq(T.score(T.startPos([0,0]),0),72,'start score');eq(T.judgeCol(T.startPos([1,2])),1,'dum gives han the win at equal material');
/* 포: 하나를 넘어서만, 포는 넘지도 잡지도 못함 */
eq(tos(P([...K,[0,4,PO,0]]),0,4),'','po needs a screen');
eq(tos(P([...K,[0,4,PO,0],[0,6,ZOL,0],[0,8,CHA,1]]),0,4),'0,7 0,8','po jumps one and captures');
eq(tos(P([...K,[0,4,PO,0],[0,6,PO,1],[0,8,CHA,1]]),0,4),'','po cannot jump po');
eq(tos(P([...K,[0,4,PO,0],[0,5,ZOL,0],[0,7,PO,1]]),0,4),'0,6','po cannot capture po');
eq(tos(P([[5,1,JANG,0],[4,9,JANG,1],[3,0,PO,0],[4,1,SA,0]]),3,0),'5,2','po jumps palace diagonal');
eq(tos(P([[5,1,JANG,0],[4,9,JANG,1],[3,0,PO,0]]),3,0),'','po needs a screen on the diagonal');
/* 마·상: 멱 */
eq(tos(P([...K,[4,4,MA,0]]),4,4),'2,3 2,5 3,2 3,6 5,2 5,6 6,3 6,5','ma open');
eq(tos(P([...K,[4,4,MA,0],[4,5,ZOL,1]]),4,4),'2,3 2,5 3,2 5,2 6,3 6,5','ma blocked forward');
eq(tos(P([...K,[4,4,SANG,0]]),4,4),'1,2 1,6 2,1 2,7 6,1 6,7 7,2 7,6','sang open');
eq(tos(P([...K,[4,4,SANG,0],[5,6,ZOL,1]]),4,4),'1,2 1,6 2,1 2,7 6,1 7,2 7,6','sang blocked at second step');
/* 차·졸·장·사: 궁성 대각선은 선 위로만 */
eq(tos(P([[4,0,JANG,0],[4,9,JANG,1],[4,1,SA,0],[3,7,CHA,0]]),3,7),'0,7 1,7 2,7 3,0 3,1 3,2 3,3 3,4 3,5 3,6 3,8 3,9 4,7 4,8 5,7 5,9 6,7 7,7 8,7','cha palace diagonal');
eq(tos(P([[4,0,JANG,0],[4,9,JANG,1],[4,1,SA,0],[3,8,CHA,0]]),3,8).includes('4,9'),false,'no diagonal from a palace side point');
eq(tos(P([...K,[2,5,ZOL,0]]),2,5),'1,5 2,6 3,5','zol forward and sideways');
eq(tos(P([[4,1,JANG,0],[5,9,JANG,1],[3,7,ZOL,0]]),3,7),'2,7 3,8 4,7 4,8','zol palace diagonal forward');
eq(tos(P([[4,1,JANG,0],[5,7,JANG,1],[4,8,ZOL,0]]),4,8),'3,8 3,9 4,9 5,8 5,9','zol from palace centre');
eq(tos(P([[3,2,JANG,0],[5,9,JANG,1]]),3,2),'3,1 4,1 4,2','jang stays in palace');
eq(tos(P([[4,1,JANG,0],[5,9,JANG,1],[3,1,SA,0]]),3,1),'3,0 3,2','sa side point: no diagonal');
/* 장군: 풀지 않는 수는 못 두고, 장군이면 쉬지 못함 */
{const p=P([[4,1,JANG,0],[3,8,JANG,1],[4,6,CHA,1],[0,0,CHA,0]]);
 eq(T.inCheck(p),true,'check by cha');
 eq(T.legal(p).includes(PASS),false,'no pass in check');
 eq(T.legal(p).every(m=>{T.make(p,m);const ok=!T.attacked(p,p.k[0],1);T.unmake(p);return ok}),true,'moves resolve check');}
eq(T.inCheck(P([[4,1,JANG,0],[3,8,JANG,1],[4,7,PO,1],[4,4,ZOL,0]])),true,'check by po over a screen');
eq(T.inCheck(P([[4,1,JANG,0],[3,8,JANG,1],[4,7,PO,1]])),false,'po without screen gives no check');
eq(T.inCheck(P([[4,1,JANG,0],[3,8,JANG,1],[5,3,MA,1]])),true,'check by ma');
eq(T.inCheck(P([[4,1,JANG,0],[3,8,JANG,1],[5,3,MA,1],[5,2,ZOL,0]])),false,'ma check blocked');
eq(T.inCheck(P([[4,1,JANG,0],[3,8,JANG,1],[6,4,SANG,1]])),true,'check by sang');
eq(T.inCheck(P([[4,1,JANG,0],[3,8,JANG,1],[3,2,ZOL,1]])),true,'check by byeong diagonal in palace');
eq(T.inCheck(P([[4,1,JANG,0],[3,8,JANG,1],[3,0,ZOL,1]])),false,'byeong cannot attack backward diagonal');
eq(T.inCheck(P([[4,1,JANG,0],[3,8,JANG,1],[5,2,CHA,1]])),true,'check by cha on palace diagonal');
/* 외통 */
{const p=P([[4,1,JANG,0],[4,9,JANG,1],[3,9,SANG,1],[5,9,SANG,1],[4,7,CHA,0],[0,8,CHA,0]],1);
 eq(T.legal(p).length,0,'checkmate: no moves');eq(T.inCheck(p),true,'checkmate: in check');}
/* 빅장 */
eq(T.facing(P([[4,1,JANG,0],[4,8,JANG,1]])),true,'facing');
eq(T.facing(P([[4,1,JANG,0],[4,8,JANG,1],[4,5,ZOL,0]])),false,'not facing with a piece between');
/* 수 글자 */
eq(T.fromU(T.startPos([0,0]),T.toU(PASS)),PASS,'pass round trip');

/* ---------- 엔진 ---------- */
const mkRoom=(over,names=['가','나'])=>{
  hostNew(false,'t','t');
  H.cfg={...cfgFor('janggi'),...over,game:'janggi'};
  H.members=names.map((n,i)=>({name:n,bot:false,conn:null,host:i===0}));
  hostStart();
  NOW+=5000;   // 시작 연출 지나감
  return H;
};
const act=(i,a)=>JG.engine.act(i,a);
const mv=(i,u)=>act(i,{t:'mv',u});
const U=(x0,y0,x1,y1)=>T.toU(IX(x0,y0)|(IX(x1,y1)<<7));
/* 상차림: 초가 먼저, 한이 그다음, 그 뒤 초가 첫 수 */
{mkRoom({pickfirst:1});
 eq(H.c.A,0,'host is cho');eq(H.c.ph,'set','setup phase');eq(H.turn,0,'cho sets up first');
 act(1,{t:'su',v:2});eq(H.c.su.join(),'-1,-1','han cannot set up first');
 mv(0,U(0,3,0,4));eq(H.c.mv.length,0,'no moves during setup');
 act(0,{t:'su',v:1});eq(H.c.su.join(),'1,-1','cho setup');eq(H.turn,1,'han sets up next');
 act(1,{t:'su',v:3});eq(H.c.ph,'play','play after both');eq(H.turn,0,'cho moves first');
 const p=T.replay(H.c.su,[]).p;eq(p.b[IX(6,9)],MA|8,'han setup 상마상마 from own left');eq(p.b[IX(1,9)],MA|8,'han right end ma');eq(p.b[IX(7,9)],SANG|8,'han left is x=7');eq(p.b[IX(7,0)],MA|0,'cho 마상상마 right end ma');
 mv(1,U(0,6,0,5));eq(H.c.mv.length,0,'not your turn');
 mv(0,U(0,3,0,5));eq(H.c.mv.length,0,'illegal ignored');
 mv(0,U(0,3,0,4));eq(H.c.mv.length,1,'move made');eq(H.turn,1,'turn passes');
 eq(H.c.rem[0],600000+10000,'increment after move');
 mv(1,'pp');eq(H.c.mv[1],'pp','pass');eq(H.turn,0,'pass gives turn');}
/* 상차림 시간이 지나면 마상마상 */
{mkRoom({pickfirst:1});NOW+=20001;engineTick();eq(H.c.su[0],0,'setup timeout default');eq(H.turn,1,'then han');}
/* 점수 계산 제안: 받으면 점수(덤 포함)로 승패 */
{mkRoom({pickfirst:1});act(0,{t:'su',v:0});act(1,{t:'su',v:0});
 act(0,{t:'offer'});eq(H.c.dr,0,'offer');act(1,{t:'offer'});eq(H.phase,'over','score accepted');eq(H.c.res.w,1,'han wins by dum');eq(H.c.res.why,'agree','why agree');}
/* 시간 초과 패배, 항복 */
{mkRoom({pickfirst:1,tm:1,inc:0});act(0,{t:'su',v:0});act(1,{t:'su',v:0});NOW+=60001;engineTick();eq(H.phase,'over','flag');eq(H.c.res.w,1,'han wins on time');}
{mkRoom({pickfirst:1});act(1,{t:'surrender'});eq(H.c.res.w,0,'surrender');
 hostStart();eq(H.c.co.join(),'1,0','sides swap on rematch');eq(H.turn,1,'new cho sets up first');}
/* 빅장: 응수한 뒤에도 마주 보면 무승부 (가운데 졸·병을 치워 두 장이 마주 보게) */
{mkRoom({pickfirst:1});act(0,{t:'su',v:0});act(1,{t:'su',v:0});
 for(const [i,u] of [[0,U(4,3,3,3)],[1,U(4,6,5,6)]])mv(i,u);
 eq(H.c.bik,1,'bikjang called');eq(H.phase,'play','still playing');
 mv(0,U(0,3,0,4));eq(H.phase,'over','bik not answered');eq(H.c.res.w,-1,'bik draw');eq(H.c.res.why,'bik','why bik');}
{mkRoom({pickfirst:1});act(0,{t:'su',v:0});act(1,{t:'su',v:0});
 for(const [i,u] of [[0,U(4,3,3,3)],[1,U(4,6,5,6)],[0,U(4,1,3,1)]])mv(i,u);
 eq(H.phase,'play','bik answered by moving jang');eq(H.c.bik,0,'facing gone');}
/* 반복 3회까지: 네 번째는 금수. 무제한이면 계속 */
{mkRoom({pickfirst:1});act(0,{t:'su',v:0});act(1,{t:'su',v:0});
 const loop=[[0,U(0,0,0,1)],[1,U(0,9,0,8)],[0,U(0,1,0,0)],[1,U(0,8,0,9)]];
 for(let k=0;k<2;k++)for(const [i,u] of loop)mv(i,u);
 for(const [i,u] of loop.slice(0,3))mv(i,u);
 const n=H.c.mv.length;mv(1,U(0,8,0,9));eq(H.c.mv.length,n,'4th repetition is forbidden');eq(H.phase,'play','game goes on');
 mv(1,U(8,9,8,8));eq(H.c.mv.length,n+1,'other move allowed');}
{mkRoom({pickfirst:1,rep:1});act(0,{t:'su',v:0});act(1,{t:'su',v:0});
 const loop=[[0,U(0,0,0,1)],[1,U(0,9,0,8)],[0,U(0,1,0,0)],[1,U(0,8,0,9)]];
 for(let k=0;k<4;k++)for(const [i,u] of loop)mv(i,u);
 eq(H.c.mv.length,16,'unlimited repetition');eq(H.phase,'play','no end by repetition');}
/* 반복: 양쪽 모두 30점 미만이면 네 번째도 두고 점수로 판정 */
{const p=P([[4,1,JANG,0],[3,8,JANG,1],[0,0,CHA,0],[8,9,CHA,1],[8,8,MA,1]]);
 const reps={},m=IX(0,0)|(IX(0,1)<<7);T.make(p,m);reps[T.repKey(p)]=3;T.unmake(p);
 eq(T.repState(p,m,reps,0),2,'low material repetition allowed');eq(T.repState(p,m,reps,1),0,'unlimited ignores repetition');
 const q=T.startPos([0,0]),r2={},m2=IX(0,0)|(IX(0,1)<<7);T.make(q,m2);r2[T.repKey(q)]=3;T.unmake(q);eq(T.repState(q,m2,r2,0),1,'full material repetition forbidden');}
/* 봇: 한 수로 외통이면 둠 */
{const p=P([[4,1,JANG,0],[4,9,JANG,1],[3,9,SANG,1],[5,9,SANG,1],[4,6,CHA,0],[0,8,CHA,0]]);
 let hit=0;for(let k=0;k<6;k++){const m=T.botPick(p,{},0);T.make(p,m);if(!T.legal(p).length)hit++;T.unmake(p)}
 eq(hit,6,'bot finds mate in one');}

/* 봇끼리 끝까지 (기보를 처음부터 다시 두어 모든 수가 규칙에 맞는지) */
function playOutJ(over){
  hostNew(false,'t','t');
  H.cfg={...cfgFor('janggi'),...over,game:'janggi'};
  H.members=[0,1].map(i=>({name:'b'+i,bot:true,conn:null,host:i===0,lv:0}));
  hostStart();
  let ticks=0,guard=0;
  while(H.phase!=='over'&&guard++<40000){NOW+=250;engineTick();ticks++}
  if(H.phase!=='over'){fail('janggi stuck '+H.c.mv.length);return ticks}
  const ranks=H.players.map(p=>p.rank).join();
  if(ranks!=='1,2'&&ranks!=='2,1'&&ranks!=='1,1')fail('janggi ranks '+ranks);
  const r=T.replay(H.c.su,H.c.mv);if(r.p.h1!==T.replay(H.c.su,H.c.mv.slice()).p.h1||H.c.mv.length&&!H.c.mv.every(u=>u==='pp'||u.length===4))fail('janggi replay');
  if(Object.values(r.reps).some(n=>n>4))fail('janggi repetition over limit');
  if(!over.rep&&Object.values(r.reps).some(n=>n>3)&&H.c.res.why!=='rep')fail('janggi 4th repetition without score end');
  globalThis.JGW=(globalThis.JGW||{});JGW[H.c.res.why]=(JGW[H.c.res.why]||0)+1;
  return ticks;
}
globalThis.playOutJ=playOutJ;
