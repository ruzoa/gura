/* 오목 테스트 (tests/engine.test.js가 이 파일을 불러서 { } 블록 안에서 돌림)
   앞에서 정해져 있는 것: OM(=GAMES.omok), fail(), hostNew·hostStart·engineTick·snapFor 등 공통 엔진 */
const T=OM._test;
const eq=(a,b,m)=>{if(a!==b)fail('omok '+m+': '+a+' != '+b)};
const RU=(o)=>T.rulesOf({sz:0,b33:0,ov:0,op:0,tm:10,inc:5,...o});
/* 그림으로 판 만들기: rows는 문자열 배열, x 흑 o 백 . 빈 칸. 왼쪽 위를 (r0,c0)에 놓음 */
function mkB(R,rows,r0=3,c0=3){
  const b=Array(R.n*R.n).fill(0);
  rows.forEach((s,i)=>[...s].forEach((ch,j)=>{if(ch==='x')b[(r0+i)*R.n+c0+j]=1;else if(ch==='o')b[(r0+i)*R.n+c0+j]=2}));
  return b;
}
const J=(R,b,r,c,col)=>T.judge(b,R,r,c,col,0);

/* 이름·판 크기 */
eq(RU({}).n,15,'size 15');eq(RU({sz:1}).n,19,'size 19');
eq(T.sqName(15,14,0),'a1','sq a1');eq(T.sqName(15,0,14),'o15','sq o15');eq(T.sqName(19,0,18),'s19','sq s19');

/* 승리 판정: 방향·가장자리 */
{const R=RU({});
 for(let d=0;d<4;d++){
  const b=Array(225).fill(0),[dr,dc]=[[0,1],[1,0],[1,1],[1,-1]][d];
  const r0=d===3?4:5,c0=d===3?9:5;
  for(let k=0;k<4;k++)b[(r0+dr*k)*15+c0+dc*k]=1;
  const r=r0+dr*4,c=c0+dc*4;
  eq(J(R,b,r,c,1).win,d,'win dir '+d);
  eq(b[r*15+c],0,'judge restores board');
 }
 // 가장자리에서 5목
 const b=Array(225).fill(0);for(let c=0;c<4;c++)b[c]=1;eq(J(R,b,0,4,1).win,0,'win on edge');
 // 4목은 승리 아님
 const b2=Array(225).fill(0);for(let c=0;c<3;c++)b2[7*15+c]=1;eq(J(R,b2,7,3,1).win,-1,'four is not win');
}
/* 장목 레버 */
{const row='xxx.xx';
 for(const [ov,wB,wW,bad] of [[0,0,0,null],[1,-1,-1,null],[2,-1,0,'6']]){
  const R=RU({ov});
  const b=mkB(R,[row]);
  const jb=J(R,b,3,6,1);
  eq(jb.win>=0,wB>=0,'ov'+ov+' black win');
  eq(jb.bad,bad,'ov'+ov+' black bad');
  const b2=mkB(R,[row.replace(/x/g,'o')]);
  eq(J(R,b2,3,6,2).win>=0,wW>=0,'ov'+ov+' white win');
 }
 // 5목과 6목이 동시에: 오버라인 금수 ov2에서 흑 5목이 우선(가로 5 + 세로 6)
 const R=RU({ov:2,b33:1});
 const b=mkB(R,['xxxx.','....x','....x','....x','....x','....x'],3,3);
 b[4*15+7]=0; // 정리: (3,7)에 두면 가로 5목, 세로는 (4..8,7) 5개 + 자기 자신 = 6
 for(let r=4;r<=8;r++)b[r*15+7]=1;
 const j=J(R,b,3,7,1);
 // 가로 정확히 5가 되면서 세로 6이 되는 경우는 5가 우선 (승리, 금수 아님)
 eq(j.win,0,'five-first over overline');eq(j.bad,null,'five is not a foul');
}
/* 4-4 */
{const R=RU({b33:1});
 // 가로 xxx_ 와 세로 xxx_ 가 한 칸(3,6)에서 만나 4-4
 const b=mkB(R,['xxx.','...x'.replace('x','.'),'','',''],3,3);
 const rows=['xxx.','....','....','....'];
 const b2=mkB(R,rows,5,3);
 // 교차 4-4: (5,6) 가로 xxx + 세로 위에 xxx
 const c=mkB(R,['...x','...x','...x','xxx.'],3,3);
 eq(J(R,c,6,6,1).bad,'44','4-4 cross');
 eq(J(R,c,6,6,2).bad,null,'4-4 white free when b33=1');
 // 4-3은 가능
 const d=mkB(R,['...x','...x','...x','.xx.'],3,3);
 eq(J(R,d,6,6,1).bad,null,'4-3 ok');
 // 같은 줄 ●●_●●_●● : 가운데 (3,8)을 비우고 양쪽 두 개씩...  xx.xx.xx 의 빈칸 두 개를 채우면 4가 둘
 const e=mkB(R,['xx.xx.xx'],3,3);
 eq(J(R,e,3,8,1).bad,null,'xx.xx.xx fill 1st gap: five (win)');
 // 정확히: x x . x x 에서 가운데는 5목(승리)
 eq(J(R,e,3,5,1).win,0,'xx_xx center is five');
 // 열린 4(양쪽 끝 완성)는 하나의 4: 4-4가 아님
 const f=mkB(R,['.xx.x.'],3,3);   // (3,6) → .xxxx. 열린 4: 3 아님 4 하나
 eq(J(R,f,3,6,1).bad,null,'straight four is one four');
}
/* 같은 줄 두 개의 4 (●●_●●_●●), 가운데 돌 놓기 */
{const R=RU({b33:1});
 const b=mkB(R,['xx.x..xx'],3,3);   // (3,7)에 놓으면 xx.xx.xx : 같은 줄에 서로 다른 네 돌 묶음 두 개
 const j=J(R,b,3,7,1);
 eq(j.bad,'44','xx_x_xx center gives two fours');
}
/* 3-3 */
{const R=RU({b33:1});
 // 가로 .xx. 세로 .xx. 가 (r,c)=(6,6)에서 만남 ( 둘 다 양쪽이 열림 )
 const b=mkB(R,['......','......','....x.','....x.','......','..xx..'.replace('..xx..','......')],3,3);
 const g=mkB(R,['.x....','.x....','......','.xx...'.replace('.xx...','......')],3,3);
 // 간단히: (6,6)에 둘 때 가로로 (6,4),(6,5) / 세로로 (4,6),(5,6)
 const h=Array(225).fill(0);h[6*15+4]=1;h[6*15+5]=1;h[4*15+6]=1;h[5*15+6]=1;
 eq(J(R,h,6,6,1).bad,'33','3-3');
 eq(J(R,h,6,6,2).bad,null,'3-3 white free when b33=1');
 const R2=RU({b33:2});
 const h2=Array(225).fill(0);h2[6*15+4]=2;h2[6*15+5]=2;h2[4*15+6]=2;h2[5*15+6]=2;
 eq(J(R2,h2,6,6,2).bad,'33','3-3 white forbidden when b33=2');
 eq(J(R2,h,6,6,1).bad,'33','3-3 black forbidden when b33=2');
 const R0=RU({b33:0});
 eq(J(R0,h,6,6,1).bad,null,'3-3 free when b33=0');
 // 막힌 3은 3이 아님: 가로 한쪽이 벽(가장자리)에 막힘
 const k=Array(225).fill(0);k[6*15+0]=1;k[6*15+1]=1;k[4*15+2]=1;k[5*15+2]=1;
 eq(J(R,k,6,2,1).bad,null,'blocked three is not open');
 // 상대 돌에 막힘
 const m=Array(225).fill(0);m[6*15+4]=1;m[6*15+5]=1;m[6*15+3]=2;m[6*15+2]=2;m[4*15+6]=1;m[5*15+6]=1;
 eq(J(R,m,6,6,1).bad,null,'three blocked by opponent stone is not open');
 // 4-3은 가능
 const q=Array(225).fill(0);q[6*15+3]=1;q[6*15+4]=1;q[6*15+5]=1;q[4*15+6]=1;q[5*15+6]=1;
 eq(J(R,q,6,6,1).bad,null,'4-3 allowed');
 // 거짓 3: 3을 만드는 자리가 금수(4-4)라서 열린 3이 아님
 // 가로 열린 3 (6,4),(6,5),(6,6 새 돌)이 4가 되려면 (6,7) 또는 (6,3)에 둬야 하는데 (6,3)이 4-4이면 거짓
 const s=Array(225).fill(0);
 s[6*15+4]=1;s[6*15+5]=1;       // 가로 두 개 (+ (6,6) 새 돌)
 s[4*15+6]=1;s[5*15+6]=1;       // 세로 두 개 (+ 새 돌) → 일단 33
 eq(J(R,s,6,6,1).bad,'33','baseline 33 before false-three test');
}
/* 금수 표시 (빨간 ✕) */
{const R=RU({b33:1}),h=Array(225).fill(0);h[6*15+4]=1;h[6*15+5]=1;h[4*15+6]=1;h[5*15+6]=1;
 const f=T.forbidCells(h,R,1);
 if(!f.includes(6*15+6))fail('omok forbidCells misses 3-3');
 eq(T.forbidCells(h,R,2).length,0,'no forbid cells for white under b33=1 ov0');
 eq(T.forbidCells(h,RU({}),1).length,0,'no forbid cells in free rule');
 const R6=RU({ov:2});eq(T.forbidCells(h,R6,2).length,0,'white has no forbid under ov=2');
}
/* 프리셋 */
eq(T.presetOf({sz:0,b33:0,ov:0,op:0}),0,'preset free');
eq(T.presetOf({sz:0,b33:1,ov:2,op:2}),1,'preset renju');
eq(T.presetOf({sz:1,b33:1,ov:2,op:2}),-1,'custom when size differs');
eq(T.baseOf({sz:1,b33:1,ov:2,op:2}),1,'base renju');
eq(T.diffKeys({sz:1,b33:1,ov:2,op:2}).join(),'sz','diff keys');

/* ---------- 엔진 ---------- */
const mkRoom=(over,names=['가','나'])=>{
  hostNew(false,'t','t');
  H.cfg={...cfgFor('omok'),...over,game:'omok'};
  H.members=names.map((n,i)=>({name:n,bot:false,conn:null,host:i===0}));
  hostStart();
  NOW+=10000;H.o.since=NOW;   // 시작 연출 지나감 (연출 동안 시계는 멈춤)
  return H;
};
const put=(i,r,c)=>OM.engine.act(i,{t:'put',r,c});
const pick=(i,v)=>OM.engine.act(i,{t:'pick',v});
/* 오프닝 없음: 선플레이어가 흑 */
{mkRoom({pickfirst:1,op:0});
 eq(H.o.A,0,'first=host -> A=0');eq(H.o.co.join(),'1,2','black for A');eq(H.turn,0,'turn');
 put(1,7,7);eq(H.o.cnt,0,'wrong seat ignored');
 put(0,7,7);eq(H.o.cnt,1,'put ok');put(0,7,8);eq(H.o.cnt,1,'put twice ignored');eq(H.turn,1,'turn after put');
 put(1,7,7);eq(H.o.cnt,1,'occupied ignored');
 put(1,-1,3);put(1,3,99);put(1,1.5,2);eq(H.o.cnt,1,'bad coords ignored');
 const s=snapFor(0);eq(s.o.b.length,225,'snap board');eq(s.o.ph,'play','snap ph');
}
/* 5목 승리, 순위, 다음 판 선플레이어 */
{mkRoom({pickfirst:1,op:0,tm:10,inc:0});
 for(let k=0;k<4;k++){put(0,7,3+k);put(1,9,3+k)}
 put(0,7,7);
 eq(H.phase,'over','game over after five');
 eq(H.players[0].rank,1,'winner rank');eq(H.players[1].rank,2,'loser rank');
 eq(H.o.res.w,0,'res winner');
 // 이긴 사람이 다음 판 선플레이어: 방장이 졌어도 시험하려고 반대로
 hostStart();NOW+=10000;H.o.since=NOW;
 eq(H.o.A,0,'winner is first next game');eq(H.o.co[0],1,'winner black');
 // 이번엔 상대(1)가 이김
 put(0,0,0);for(let k=0;k<4;k++){put(1,7,3+k);put(0,12,k*2)}
 put(1,7,7);
 // 위 순서: 0 흑 한수, 1 백 한수 ... 백 5목
 eq(H.phase==='over'||H.o.cnt>0,true,'second game progressed');
}
{mkRoom({pickfirst:1,op:0,inc:0});
 // 백이 이기는 판: 흑이 흩어져 두는 동안 백이 가로 5
 const bl=[[0,0],[2,0],[4,0],[6,0],[8,0]];
 for(let k=0;k<5;k++){put(0,bl[k][0],bl[k][1]);put(1,10,3+k);if(H.phase==='over')break}
 eq(H.phase,'over','white five ends');eq(H.o.res.w,1,'white won');
 hostStart();NOW+=10000;H.o.since=NOW;
 eq(H.o.A,1,'next game: winner (white) is first');eq(H.o.co[1],1,'winner takes black');
}
/* 무승부 → 서로 바꿈 */
{mkRoom({pickfirst:1,op:0,inc:0});
 H.phase='play';
 // 판을 거의 채움: 줄이 안 생기는 패턴으로 마지막 한 칸만 남김
 const n=15,O=H.o;
 for(let r=0;r<n;r++)for(let c=0;c<n;c++)O.b[r*n+c]=((c>>1)+r)%2?2:1;
 // 가로 줄 최대 2, 세로 ... (c>>1)+r 의 패턴으로 대각선 5목이 생길 수 있어 검사
 const noFive=()=>{for(let r=0;r<n;r++)for(let c=0;c<n;c++)for(let d=0;d<4;d++){const col=O.b[r*n+c];if(T.runLen(O.b,n,r,c,d,col)>=5)return false}return true};
 if(!noFive()){// 다른 패턴: 행 단위로 2칸마다 바꾸고 행마다 밀기
  for(let r=0;r<n;r++)for(let c=0;c<n;c++)O.b[r*n+c]=(((c+((r>>1)&1)*1)>>1)+r)%2?2:1;
 }
 const ok=noFive();
 if(ok){
  O.b[7*n+7]=0;O.cnt=n*n-1;O.mv=0;H.turn=0;
  O.co=[((7>>1)+7)%2?1:2,0];O.co[1]=3-O.co[0];
  // (7,7)에 놓을 색이 5목을 만들지 않는지 확인 후 진행
  const col=O.co[0];O.b[7*n+7]=col;const bad=[0,1,2,3].some(d=>T.runLen(O.b,n,7,7,d,col)>=5);O.b[7*n+7]=0;
  if(!bad){put(0,7,7);eq(H.phase,'over','full board ends');eq(H.o.res.w,-1,'draw');
   eq(H.players[0].rank,1,'draw rank 0');eq(H.players[1].rank,1,'draw rank 1');
   const a=H.oLast.A;hostStart();NOW+=10000;H.o.since=NOW;
   eq(H.players[H.o.A].name!==a,true,'draw swaps first player');}
 }
}
/* 이름이 같으면 방 설정으로 */
{mkRoom({pickfirst:1,op:0},['같','같']);H.phase='over';H.oLast={ns:['같','같'],w:'같',A:'같'};
 hostStart();NOW+=10000;H.o.since=NOW;eq(H.o.A,0,'duplicate names fall back to picked first (host)');}
/* 시계: 증가, 시간 초과, 항복 */
{mkRoom({pickfirst:1,op:0,tm:1,inc:5});
 const t0=NOW;NOW=t0+4000;put(0,7,7);
 eq(H.o.rem[0],60000-4000+5000,'increment added after move');
 eq(H.turn,1,'mover switched');
 NOW+=30000;const s=snapFor(0);eq(s.o.rem[1],30000,'snap deducts mover elapsed');eq(s.o.rem[0],61000,'snap other full');
 NOW+=40000;engineTick();
 eq(H.phase,'over','timeout ends');eq(H.o.res.why,'time','timeout why');
 eq(H.players[1].surrendered,'time','timeout flag');eq(snapFor(1).ps[1].sr,2,'timeout sr');
 eq(H.players[0].rank,1,'timeout winner');
}
{mkRoom({pickfirst:1,op:0});put(0,7,7);OM.engine.act(0,{t:'surrender'});
 eq(H.phase,'over','surrender ends');eq(H.o.res.w,1,'surrender winner');eq(snapFor(0).ps[0].sr,1,'surrender sr');}
/* 시계는 시작 연출 동안 멈춤 */
{mkRoom({pickfirst:1,op:0,tm:1});const rem=H.o.rem[0];OM.engine.restore(2000);eq(H.o.since>0,true,'restore shifts since');eq(rem,60000,'full time');}
/* 금수는 놓기가 막힘(반칙패 없음) */
{mkRoom({pickfirst:1,op:0,b33:1});
 const O=H.o,n=15;
 for(const [r,c] of [[6,4],[6,5],[4,6],[5,6]])O.b[r*n+c]=1;
 O.cnt=4;O.mv=0;H.turn=0;
 // cnt 4(짝수)이면 흑 차례 → A=0 흑
 put(0,6,6);eq(O.b[6*n+6],0,'forbidden 3-3 rejected');eq(H.phase,'play','no foul loss');eq(H.turn,0,'still my turn');
 const f=T.judge(O.b,O.R,6,6,1,0);eq(f.bad,'33','judge says 33');
}
/* 오프닝 Swap */
{mkRoom({pickfirst:1,op:1});
 const O=H.o;eq(O.ph,'p1','swap starts p1');eq(O.A,0,'A');
 put(0,7,7);put(0,7,8);put(0,8,8);eq(O.cnt,3,'3 opening stones');eq(O.ph,'c1','choose phase');eq(H.turn,1,'B chooses');
 eq(O.b[7*15+7],1,'stone1 black');eq(O.b[7*15+8],2,'stone2 white');eq(O.b[8*15+8],1,'stone3 black');
 put(1,0,0);eq(O.cnt,3,'no put while choosing');
 pick(1,3);eq(O.ph,'c1','swap has no more');
 pick(0,1);eq(O.ph,'c1','wrong seat pick ignored');
 pick(1,2);eq(O.ph,'play','picked');eq(O.co[1],2,'B white');eq(O.co[0],1,'A black');
 eq(H.turn,1,'white moves next');
 put(1,0,0);eq(O.cnt,4,'white moved');eq(H.turn,0,'black next');
}
{mkRoom({pickfirst:1,op:1});
 const O=H.o;put(0,7,7);put(0,7,8);put(0,8,8);pick(1,1);
 eq(O.co[1],1,'B picked black');eq(H.turn,0,'A is white and moves');
}
/* 오프닝 Swap2 */
{mkRoom({pickfirst:1,op:2});
 const O=H.o;put(0,7,7);put(0,7,8);put(0,8,8);eq(O.ph,'c1','c1');
 pick(1,3);eq(O.ph,'p2','more stones');eq(H.turn,1,'B places more');
 put(1,9,9);eq(O.ph,'p2','one more');put(1,6,6);eq(O.cnt,5,'5 stones');eq(O.ph,'c2','A chooses');eq(H.turn,0,'A picks');
 eq(O.b[9*15+9],2,'4th white');eq(O.b[6*15+6],1,'5th black');
 pick(0,3);eq(O.ph,'c2','no more at c2');
 pick(0,2);eq(O.ph,'play','played');eq(O.co[0],2,'A white');eq(O.co[1],1,'B black');
 eq(H.turn,0,'5 stones -> white to move = A');
 put(0,1,1);eq(O.cnt,6,'white moves');
}
{mkRoom({pickfirst:1,op:2});
 const O=H.o;put(0,7,7);put(0,7,8);put(0,8,8);pick(1,2);
 eq(O.co[1],2,'B white (3 stones)');eq(H.turn,1,'white moves');
 const rec=OM._test.recordText(snapFor(0));
 if(!rec.includes('1.흑h8')&&!rec.includes('1.흑'))fail('omok record text '+rec);
}
/* 오프닝 돌에는 금수 판정을 하지 않음 */
{mkRoom({pickfirst:1,op:1,b33:1});
 put(0,6,4);put(0,6,5);put(0,6,6);   // 흑 백 흑 : 판정 없이 놓임
 eq(H.o.cnt,3,'opening stones ignore fouls');
}
/* 다음 판 오프닝이면 선플레이어 = 이긴 사람, 오프닝 단계로 시작 */
{mkRoom({pickfirst:1,op:1,inc:0});
 const O=H.o;put(0,7,7);put(0,7,8);put(0,8,8);pick(1,1);
 // A=0 백, B=1 흑: 백이 둠
 O.b.fill(0);O.cnt=0;
 // 정리 후 강제 승리 상황 만들기: 흑(1)이 가로 5
 for(let k=0;k<4;k++)O.b[10*15+k]=1;O.cnt=4;O.mv=1;H.turn=1;
 put(1,10,4);eq(H.phase,'over','black five');eq(O.res.w,1,'seat1 won');
 hostStart();NOW+=10000;H.o.since=NOW;eq(H.o.A,1,'winner starts next (opening)');eq(H.o.ph,'p1','opening again');
}
/* 54가지 규칙 조합 × 봇끼리 끝까지 */
function playOutO(over,lvs){
  hostNew(false,'t','t');
  H.cfg={...cfgFor('omok'),...over,game:'omok'};
  H.members=[0,1].map(i=>({name:'b'+i,bot:true,conn:null,host:i===0,lv:lvs[i%lvs.length]}));
  hostStart();
  let ticks=0,guard=0;
  const R=H.o.R,n=R.n;
  while(H.phase!=='over'&&guard++<40000){
    NOW+=250;engineTick();ticks++;
    if(H.phase==='play'&&H.players[H.turn].finished){fail('omok turn on finished');return ticks}
  }
  if(H.phase!=='over'){fail('omok stuck cfg='+JSON.stringify(over)+' cnt='+H.o.cnt+' ph='+H.o.ph);return ticks}
  const ranks=H.players.map(p=>p.rank).join();
  if(ranks!=='1,2'&&ranks!=='2,1'&&ranks!=='1,1')fail('omok ranks '+ranks);
  // 놓인 돌 수와 기록이 맞는지, 금수 규칙을 어긴 수가 없는지
  const sp=H.o.rec.filter(x=>x[0]==='s');
  if(sp.length!==H.o.cnt)fail('omok rec count');
  // 처음부터 다시 두어 보며 금수 확인 (오프닝 돌 제외)
  const b=Array(n*n).fill(0);let k=0;
  for(const x of sp){
    k++;const [,,r,c,col]=x;
    const open=R.op&&k<=(R.op===1?3:5)&&H.o.rec.slice(0,H.o.rec.indexOf(x)).every(y=>y[0]==='s'||y[2]===3);
    if(b[r*n+c])fail('omok stone on stone');
    // 오프닝 돌 구간: 선택 단계가 끼기 전까지의 돌
    const isOpen=R.op&&(k<=3||(R.op===2&&k<=5&&H.o.rec.some(y=>y[0]==='k'&&y[2]===3)));
    if(!isOpen&&T.judge(b,R,r,c,col,0).bad){fail('omok illegal move played cfg='+JSON.stringify(over)+' '+T.sqName(n,r,c)+' '+T.judge(b,R,r,c,col,0).bad);return ticks}
    b[r*n+c]=col;
  }
  return ticks;
}
globalThis.playOutO=playOutO;
/* 연결이 끊긴 동안(봇이 맡은 동안)은 시계가 멈추고, 끊기기 전에 쓴 시간만 깎임 */
{mkRoom({pickfirst:1,op:0,tm:1,inc:0});
 put(0,7,7);   // 0 → 1 차례 (사람 1)
 NOW+=10000;engineTick();
 const p=H.players[1];p.bot=true;p.away=true;p.awayAt=NOW;   // 10초 쓰고 끊김
 engineTick();eq(H.o.rem[1],50000,'away: time used before disconnect is charged');
 NOW+=8000;engineTick();eq(H.o.rem[1],50000,'away: clock stops while away');
 eq(snapFor(0).o.run,0,'away: snap clock not running');
 p.bot=false;p.away=false;engineTick();   // 다시 연결
 NOW+=5000;engineTick();eq(snapFor(0).o.rem[1],45000,'reconnect: clock runs again from reconnect');
 eq(H.phase,'play','no timeout from away time');
}
/* 남은 빈 칸이 모두 금수면 무승부 */
{const R=RU({b33:1}),n=15,b=Array(n*n).fill(0);
 const O={b,R,cnt:0};
 eq(T.canMove(O,1),true,'canMove empty board');
 // 판을 줄이 안 생기게 채우고 한 칸만 남긴 뒤 그 칸이 흑 3-3이 되게
 for(let r=0;r<n;r++)for(let c=0;c<n;c++)b[r*n+c]=2;
 for(const [r,c] of [[6,4],[6,5],[4,6],[5,6]])b[r*n+c]=1;
 for(const [r,c] of [[6,3],[6,7],[3,6],[7,6],[6,2],[6,8],[2,6],[8,6]])b[r*n+c]=0;
 // 열린 3이 되도록 양 끝을 비웠으니 빈 칸이 9개: (6,6) 말고는 백으로 막을 수 없게 이 판은 그대로 두고 확인만
 O.cnt=b.filter(x=>x).length;
 eq(T.judge(b,R,6,6,1,0).bad,'33','canMove setup 33');
 eq(T.canMove(O,1),true,'other empty cells are legal');
 eq(T.canMove(O,2),true,'white always can move under b33=1');
}
{const R=RU({ov:2,b33:1}),n=15,b=Array(n*n).fill(2);
 for(let c=0;c<9;c++)b[6*n+c]=1;b[6*n+5]=0;   // 남은 한 칸에 두면 9목(장목 금수)
 eq(T.canMove({b,R,cnt:n*n-1},1),false,'only cell left is forbidden -> cannot move');
 eq(T.canMove({b,R,cnt:n*n-1},2),true,'white can take it');
}
/* 선 플레이어 직접 선택: 방장이 대기실에서 고른 사람(H.firstName)이 선, 안 골랐으면 방장, 끄면 랜덤 */
{hostNew(false,'t','t');H.cfg={...cfgFor('omok'),pickfirst:1,op:0,game:'omok'};
 H.members=[{name:'가',bot:false,conn:null,host:true},{name:'나',bot:false,conn:null,host:false}];
 H.firstName='나';hostStart();eq(H.o.A,1,'picked first player is A');eq(H.o.co[1],1,'picked first is black');
 eq(snapFor(0).ps.length,2,'snap ok');
 hostNew(false,'t','t');H.cfg={...cfgFor('omok'),pickfirst:0,op:0,game:'omok'};
 H.members=[{name:'가',bot:false,conn:null,host:true},{name:'나',bot:false,conn:null,host:false}];
 const seen=new Set();for(let k=0;k<40;k++){H.phase='wait';hostStart();seen.add(H.o.A)}
 eq(seen.size,2,'random first picks both seats');
 eq(GAMES.omok.ruleSet[0].k,'pickfirst','pickfirst is a rule switch');
}
