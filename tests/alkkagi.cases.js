/* 알까기 테스트 (tests/engine.test.js가 이 파일을 불러서 { } 블록 안에서 돌림)
   앞에서 정해져 있는 것: AK(=GAMES.alkkagi), fail(), hostNew·hostStart·engineTick·snapFor 등 공통 엔진 */
const T=AK._test,{SR,SH,TOP,BW}=T;
const eq=(a,b,m)=>{if(a!==b)fail('alkkagi '+m+': '+a+' != '+b)};
const ok=(c,m)=>{if(!c)fail('alkkagi '+m)};
const at=(x,z,s)=>({x,y:TOP+SH,z,s,o:0,g:0});
const maxY=(r,i)=>{const t=r.tr[i];if(!t)return TOP+SH;let m=-9;for(let k=1;k<t.length;k+=5)m=Math.max(m,t[k+1]/1000);return m};

/* 놓기 전 자리: 개수대로, 모두 판 밖 펠트 위, 겹치지 않음, 두 사람이 대칭 */
for(let n=1;n<=10;n++){
  const h=T.reserves(n);
  eq(h.length,2*n,'reserves count '+n);
  ok(h.every(q=>q.u&&Math.abs(q.z)>BW+SR&&Math.hypot(q.x,q.z)<3.15-SR),'reserves on felt '+n);
  for(let i=0;i<h.length;i++)for(let j=i+1;j<h.length;j++)if(Math.hypot(h[i].x-h[j].x,h[i].z-h[j].z)<2*SR+.01)fail('alkkagi reserves overlap n='+n);
  ok(h.slice(0,n).every(q=>q.z>0&&q.s===0)&&h.slice(n).every(q=>q.z<0&&q.s===1),'reserves sides '+n);
}
/* 물리: 가만히 있는 알은 그대로, 정면으로 치면 맞은 알이 앞으로, 판 끝에서 치면 떨어짐 */
{const st=[at(0,1,0),at(0,0,1),at(1.5,-1.5,1)];
 const r=T.simulate(st,{i:0,vx:0,vz:-4,p:.4});
 ok(r.fin[1].z<-.3,'target pushed '+r.fin[1].z.toFixed(2));
 ok(Math.abs(r.fin[2].x-1.5)<1e-9&&Math.abs(r.fin[2].z+1.5)<1e-9&&!r.tr[2],'resting stone untouched');
 ok(r.ev.some(e=>e[1]==='c'),'clack event');
 ok(r.fin.every(q=>!q.o),'gentle shot keeps all on board');
 ok(r.dur>0&&r.dur<9100,'duration '+r.dur);
 for(const q of r.fin)ok(Math.abs(q.y-(TOP+SH))<.003,'rest height '+q.y.toFixed(3));}
{const r=T.simulate([at(0,-1.4,0),at(0,-2.0,1)],{i:0,vx:0,vz:-9,p:.85});
 eq(r.fin[1].o,1,'knocked off edge');ok(r.fin[1].y<TOP,'fallen below board top');
 ok(r.of[1]>0&&r.of[1]<r.dur,'fall time recorded '+r.of[1]);ok(r.of[0]==null||r.fin[0].o,'no fall time for stone on board');}
{const r=T.simulate([at(0,0,0)],{i:0,vx:11,vz:0,p:1});eq(r.fin[0].o,1,'own stone flies off');}
/* 세게 부딪히면 자주 뜸, 살살 치면 거의 안 뜸 */
{let hi=0,lo=0;for(let k=0;k<40;k++){
   const a=T.simulate([at(0,1.3,0),at(0,0,1)],{i:0,vx:0,vz:-T.speedOf(1),p:1});if(maxY(a,1)>TOP+SH+.05||maxY(a,0)>TOP+SH+.05)hi++;
   const b=T.simulate([at(0,1.3,0),at(0,0,1)],{i:0,vx:0,vz:-T.speedOf(.3),p:.3});if(maxY(b,1)>TOP+SH+.05||maxY(b,0)>TOP+SH+.05)lo++}
 ok(hi>=30,'strong hits hop '+hi+'/40');ok(lo<=4,'gentle hits stay flat '+lo+'/40');}
/* 자취: 처음 장은 움직이기 전 자리, 마지막 장은 끝 자리 */
{const st=[at(.3,1,0),at(.3,0,1)],r=T.simulate(st,{i:0,vx:0,vz:-5,p:.5});
 for(const k in r.tr){const t=r.tr[k],i=+k,m=(t.length-1)/5;
   ok(Math.abs(t[1]/1000-st[i].x)<.002&&Math.abs(t[3]/1000-st[i].z)<.002,'track starts at rest '+i);
   ok(Math.abs(t[1+(m-1)*5]/1000-r.fin[i].x)<.002&&Math.abs(t[3+(m-1)*5]/1000-r.fin[i].z)<.002,'track ends at final '+i);
   ok(t[0]+m<=r.nf,'track within frames '+i)}}

/* ---------- 엔진 ---------- */
const mkRoom=(over,names=['가','나'],keepPlace)=>{
  hostNew(false,'t','t');
  H.cfg={...cfgFor('alkkagi'),...over,game:'alkkagi'};
  H.members=names.map((n,i)=>({name:n,bot:false,conn:null,host:i===0}));
  hostStart();
  NOW+=10000;H.dealUntil=0;H.deadline=NOW+H.cfg.turn*1000;H.botActAt=0;   // 시작 연출 지나감
  if(!keepPlace)placeAll();
  return H;
};
/* 놓기를 끝냄: 차례인 사람이 봇처럼 놓을 자리를 골라 놓음 */
function placeAll(){for(let k=0;k<40&&H.ak.ph==='place';k++){const b=T.placePlan(H.ak,H.turn);AK.engine.act(H.turn,{t:'place',c:b[0],r:b[1]})}H.deadline=NOW+H.cfg.turn*1000;H.botActAt=0}
const roll=()=>{for(let k=0;k<80&&H.ak.ph==='roll'&&H.phase==='play';k++){NOW+=250;engineTick()}};
/* 놓기: 선부터 번갈아 내 쪽 반의 빈 줄 점에만. 다 놓으면 선이 먼저 튕김 */
{mkRoom({pickfirst:1,stones:3},undefined,true);
 const A=H.ak,C=(T.NL-1)/2;   // 가운데 줄 번호 (9)
 eq(A.ph,'place','starts with placing');eq(H.turn,0,'first places first');ok(A.st.every(q=>q.u),'all in reserve');
 {const s=snapFor(1);eq(s.t,0,'turn sent while placing');ok(s.dl>0,'deadline while placing');ok(s.ak.st.every(q=>q[6]===1),'unplaced flag sent')}
 AK.engine.act(0,{t:'shoot',i:0,a:0,p:.5});eq(A.cnt,0,'no shot while placing');
 AK.engine.act(1,{t:'place',c:9,r:4});eq(A.pc,0,'not your turn to place');
 AK.engine.act(0,{t:'place',c:9,r:4});eq(A.pc,0,'not on opponent half');
 AK.engine.act(0,{t:'place',c:9,r:C});eq(A.pc,0,'not on centre line');
 AK.engine.act(0,{t:'place',c:19,r:14});eq(A.pc,0,'not off grid');
 AK.engine.act(0,{t:'place',c:9.5,r:14});eq(A.pc,0,'not between lines');
 AK.engine.act(0,{t:'place',c:9,r:14});eq(A.pc,1,'placed');eq(H.turn,1,'then opponent');
 {const q=A.st[0];ok(!q.u&&Math.abs(q.x)<1e-9&&q.z>0&&Math.abs(q.y-(TOP+SH))<1e-9,'placed on board')}
 AK.engine.act(1,{t:'place',c:9,r:4});eq(A.pc,2,'opponent placed');eq(H.turn,0,'back to first');
 AK.engine.act(0,{t:'place',c:9,r:14});eq(A.pc,2,'occupied point refused');
 AK.engine.act(0,{t:'place',c:10,r:14});AK.engine.act(1,{t:'place',c:10,r:4});
 AK.engine.act(0,{t:'place',c:11,r:18});eq(A.ph,'place','last stone still to place');eq(H.turn,1,'second places last');
 AK.engine.act(1,{t:'place',c:0,r:0});
 eq(A.ph,'aim','shooting starts');eq(H.turn,0,'first shoots first');ok(A.st.every(q=>!q.u&&!q.o),'all on board');
 ok(A.st.slice(0,3).every(q=>q.z>0)&&A.st.slice(3).every(q=>q.z<0),'each on own half');}
/* 놓을 차례에 시간이 지나면 아무 자리에 대신 놓음 (차례를 넘기지 않음) */
{mkRoom({pickfirst:1,stones:2,turn:20},undefined,true);NOW+=20001;engineTick();
 eq(H.ak.pc,1,'timeout places');eq(H.turn,1,'then opponent');ok(H.ak.st[0].z>0&&!H.ak.st[0].u,'auto placed on own half');}
/* 봇 놓기 계획: 늘 놓을 수 있는 곳 */
{const A={st:T.reserves(10)};for(let k=0;k<20;k++)for(const s of [0,1]){const b=T.placePlan(A,s);ok(b&&T.canPlace(A,s,b[0],b[1]),'place plan valid');const i=A.st.findIndex(q=>q.s===s&&q.u);if(i>=0){const [x,z]=T.gridXZ(b[0],b[1]);A.st[i]={x,y:TOP+SH,z,s,o:0,g:0}}}}
/* 선 직접 고르기: 방장이 흑으로 먼저. 남의 차례·남의 알·잘못된 값은 무시 */
{mkRoom({pickfirst:1,stones:5});
 eq(H.ak.A,0,'host first');eq(H.ak.co.join(),'1,2','colours');eq(H.turn,0,'first turn');eq(H.ak.st.length,10,'stone count');
 AK.engine.act(1,{t:'shoot',i:5,a:Math.PI/2,p:.5});eq(H.ak.cnt,0,'not your turn');
 AK.engine.act(0,{t:'shoot',i:5,a:-Math.PI/2,p:.5});eq(H.ak.cnt,0,'not your stone');
 AK.engine.act(0,{t:'shoot',i:0,a:NaN,p:.5});eq(H.ak.cnt,0,'bad angle');
 AK.engine.act(0,{t:'aim',i:2,a:-1.5,p:.4,w:0});ok(H.ak.aim&&H.ak.aim.i===2&&H.ak.aim.s===0,'aim stored');
 eq(snapFor(1).ak.aim.p,.4,'aim visible to opponent');
 AK.engine.act(0,{t:'aim',i:-1});eq(H.ak.aim,null,'aim cleared');
 AK.engine.act(0,{t:'shoot',i:2,a:-Math.PI/2,p:.35});
 eq(H.ak.cnt,1,'shot made');eq(H.ak.ph,'roll','rolling');
 ok(!H.log.some(l=>/^1\. /.test(l[0])),'shot log waits for roll end');
 {const s=snapFor(1);ok(s.ak.sh&&s.ak.sh.tr&&s.ak.sh.dur>0,'track sent');ok(s.t==null,'no turn while rolling');eq(s.dl,0,'no deadline while rolling')}
 AK.engine.act(0,{t:'shoot',i:2,a:-Math.PI/2,p:.35});eq(H.ak.cnt,1,'no shot while rolling');
 roll();eq(H.ak.ph,'aim','roll ends');
 ok(H.log.some(l=>/^1\. /.test(l[0])),'shot log after roll');
 ok(H.turn===1||H.ak.next===0,'turn passes unless again');
 {NOW+=60000;const s=snapFor(0);ok(!s.ak.sh.tr,'old track dropped')}}
/* 한 번 더: 상대 알을 떨어뜨리고 튕긴 알이 남으면 같은 사람, 아니면 상대 (규칙을 끄면 늘 상대) */
for(const ag of [1,0])for(let rep=0;rep<6;rep++){
  mkRoom({pickfirst:1,stones:2,again:ag});
  const A=H.ak;A.st=[at(-1,1.2,0),at(1,1.2,0),at(0,-1.0,1),at(1.5,-1.5,1)];
  const before=A.st.filter(q=>q.s===1&&!q.o).length;
  AK.engine.act(0,{t:'shoot',i:1,a:Math.atan2(-1.0-1.2,0-1),p:.62});
  const kn=before-A.st.filter(q=>q.s===1&&!q.o).length,stay=!A.st[1].o;
  roll();
  if(H.phase==='play')eq(H.turn,ag&&kn>0&&stay?0:1,'again rule ag='+ag+' kn='+kn+' stay='+stay);
}
/* 마지막 상대 알을 떨어뜨리면 승리, 둘 다 다 떨어지면 무승부 */
{mkRoom({pickfirst:1,stones:1});
 const A=H.ak;A.st=[at(0,-1.4,0),at(0,-2.0,1)];
 AK.engine.act(0,{t:'shoot',i:0,a:-Math.PI/2,p:.4});roll();
 if(A.st[1].o&&!A.st[0].o){eq(H.phase,'over','win over');eq(A.res.w,0,'winner');eq(H.players[0].rank,1,'rank winner');eq(H.players[1].rank,2,'rank loser')}
 else fail('alkkagi setup for win did not knock off '+JSON.stringify(A.st.map(q=>q.o)));}
{mkRoom({pickfirst:1,stones:1});
 const A=H.ak;A.st=[at(0,-1.9,0),at(1.9,1.9,1)];A.st[1].o=1;A.st[1].y=0.08;A.st[1].x=2.8;   // 상대 알은 이미 떨어졌다고 치고 내 알도 떨어뜨림
 AK.engine.act(0,{t:'shoot',i:0,a:-Math.PI/2,p:.5});roll();
 eq(H.phase,'over','both gone over');eq(A.res.w,-1,'draw');}
/* 항복, 시간 초과는 차례를 넘김 */
{mkRoom({pickfirst:1});AK.engine.act(1,{t:'surrender'});eq(H.phase,'over','surrender');eq(H.ak.res.w,0,'surrender winner');}
{mkRoom({pickfirst:1,turn:20});NOW+=20001;engineTick();eq(H.turn,1,'timeout passes turn');eq(H.phase,'play','timeout not over');}
/* 바로 시작하면 진 사람이 먼저 */
{mkRoom({pickfirst:1});AK.engine.act(0,{t:'surrender'});eq(H.ak.res.w,1,'p1 wins');hostStart();eq(H.ak.A,0,'loser first on rematch');eq(H.ak.co.join(),'1,2','loser black');}
/* 봇: 계획은 남은 내 알 중에서, 힘은 범위 안 */
{const A={st:T.reserves(5)};for(const s of [0,1])for(let k=0;k<5;k++){const b=T.placePlan(A,s),[x,z]=T.gridXZ(b[0],b[1]);A.st[A.st.findIndex(q=>q.s===s&&q.u)]={x,y:TOP+SH,z,s,o:0,g:0}}
 for(let k=0;k<50;k++){const b=T.botPlan(A,1);ok(b&&A.st[b.i].s===1&&b.p>=.3&&b.p<=1&&Number.isFinite(b.a),'bot plan')}
 A.st.forEach(q=>{if(q.s===1)q.o=1});eq(T.botPlan(A,1),null,'bot with no stones');}

/* 보통·어려움 봇: 후보는 내 알에서, 판 끝 상대 알을 정면으로 치는 수는 점수가 좋음 */
{const A={st:[at(0,.4,0),at(0,-1.9,1),at(2,2,1)]},c=T.shotCands(A,0,2);
 ok(c.length>0&&c.every(q=>q.i===0&&q.p>=.3&&q.p<=1),'cands from own stone');
 ok(T.shotScore(A,0,{i:0,a:-Math.PI/2,p:.9})>=10,'straight hit scores');}

/* ---------- 3~4명 ---------- */
/* 놓기 전 자리: 사람마다 자기 쪽 펠트에 한 줄, 겹치지 않음 */
for(const np of [3,4])for(let n=1;n<=10;n++){
  const h=T.reserves(n,np);
  eq(h.length,np*n,'reserves count np='+np+' n='+n);
  ok(h.every(q=>q.u&&Math.hypot(q.x,q.z)<3.15-SR&&Math.max(Math.abs(q.x),Math.abs(q.z))>BW+SR*.9),'reserves on felt np='+np+' n='+n);
  for(let s=0;s<np;s++){const [sx,sz]=T.sideOfSeat(s,np);ok(h.slice(s*n,s*n+n).every(q=>q.s===s&&q.x*sx+q.z*sz>BW),'reserves side seat '+s+' np='+np)}
  for(let a=0;a<h.length;a++)for(let b=a+1;b<h.length;b++)if(Math.hypot(h[a].x-h[b].x,h[a].z-h[b].z)<2*SR+.01)fail('alkkagi reserves overlap np='+np+' n='+n);
}
/* 내 쪽: 두 명이면 위아래, 세·네 명이면 아래(0)부터 시계 방향 */
eq(JSON.stringify([0,1].map(s=>T.sideOfSeat(s,2))),'[[0,1],[0,-1]]','2p sides');
eq(JSON.stringify([0,1,2,3].map(s=>T.sideOfSeat(s,4))),'[[0,1],[-1,0],[0,-1],[1,0]]','4p sides');
/* 놓을 수 있는 점: 3~4명은 내 쪽 삼각형(대각선 제외), 2명은 내 쪽 반(가운데 줄 제외) */
{const C=(T.NL-1)/2,A3={np:3,st:[]},A2={np:2,st:[]};
 ok(T.canPlace(A3,0,9,14),'3p bottom wedge');ok(!T.canPlace(A3,0,4,14),'3p diagonal excluded');ok(!T.canPlace(A3,0,0,10),'3p outside wedge');
 ok(T.canPlace(A3,1,2,9),'3p left wedge');ok(!T.canPlace(A3,1,16,9),'3p left seat not on right');ok(T.canPlace(A3,2,9,3),'3p top wedge');
 ok(T.canPlace(A2,0,0,10),'2p bottom half wide');ok(!T.canPlace(A2,0,0,C),'2p centre line');ok(!T.canPlace(A2,0,9,4),'2p not opponent half');ok(T.canPlace(A2,1,9,4),'2p top half');
 A2.st=[{x:T.gridXZ(9,14)[0],y:TOP+SH,z:T.gridXZ(9,14)[1],s:0,o:0,g:0}];ok(!T.canPlace(A2,0,9,14),'occupied point');}
/* 네 명이 시계 방향으로 한 알씩 놓고, 다 놓으면 선부터 튕김 */
{mkRoom({max:4,stones:2,pickfirst:1,again:0},['가','나','다','라'],true);
 const A=H.ak;eq(A.np,4,'four players');eq(A.co.join(),'1,2,3,4','four colours');eq(H.turn,0,'first places first');
 const seq=[];
 for(let k=0;k<8&&A.ph==='place';k++){seq.push(H.turn);const b=T.placePlan(A,H.turn);AK.engine.act(H.turn,{t:'place',c:b[0],r:b[1]})}
 eq(seq.join(),'0,1,2,3,0,1,2,3','clockwise placing');eq(A.ph,'aim','shooting starts');eq(H.turn,0,'first shoots first');
 ok(A.st.every((q,i)=>!q.u&&T.ownPt(q.s,4,Math.round(q.x/T.PITCH+(T.NL-1)/2),Math.round(q.z/T.PITCH+(T.NL-1)/2))),'each stone in own wedge');
 eq(snapFor(1).ak.np,4,'np sent');}
/* 한 명씩 탈락: 마지막 순위부터, 탈락한 사람은 건너뜀, 한 명 남으면 승리 */
{mkRoom({max:4,stones:1,pickfirst:1,again:0},['가','나','다','라'],true);
 const A=H.ak;A.st=[at(0,-1.4,0),at(0,-2.0,1),at(2,2,2),at(-2,2,3)];A.ph='aim';H.turn=0;A.next=0;H.players.forEach(p=>p.hand=[0]);
 AK.engine.act(0,{t:'shoot',i:0,a:-Math.PI/2,p:.4});roll();
 ok(A.st[1].o&&!A.st[0].o,'second stone knocked off');
 eq(H.phase,'play','game goes on');eq(H.players[1].rank,4,'first out is last place');eq(H.players[1].finished,true,'out flag');eq(H.turn,2,'turn skips the one who is out');
 AK.engine.act(3,{t:'surrender'});eq(H.players[3].rank,3,'surrender rank');eq(H.phase,'play','still going');ok(A.st[3].o,'surrendered stone removed');eq(H.turn,2,'turn unchanged');
 AK.engine.act(2,{t:'surrender'});eq(H.phase,'over','last one standing');eq(A.res.w,0,'winner');
 eq(H.players.map(p=>p.rank).join(),'1,4,2,3','ranks');
 hostStart();eq(H.ak.A,1,'first out starts the rematch');}
/* 차례인 사람이 항복하면 차례는 다음 사람에게 */
{mkRoom({max:4,stones:1,pickfirst:1,again:0},['가','나','다','라'],true);
 const A=H.ak;A.st=[at(0,1.4,0),at(0,-1.4,1),at(2,2,2),at(-2,2,3)];A.ph='aim';H.turn=0;
 AK.engine.act(0,{t:'surrender'});eq(H.phase,'play','three left');eq(H.turn,1,'next player moves');eq(H.players[0].rank,4,'surrender is last place');}
/* 놓는 중에 항복하면 그 사람 건너뜀 */
{mkRoom({max:3,stones:2,pickfirst:1},['가','나','다'],true);
 const A=H.ak;AK.engine.act(0,{t:'place',c:9,r:14});eq(H.turn,1,'second places');AK.engine.act(1,{t:'surrender'});
 eq(H.turn,2,'third places after surrender');eq(H.phase,'play','going on');ok(!A.st.some(q=>q.s===1&&q.u),'unplaced stones removed');
 for(let k=0;k<9&&A.ph==='place';k++){const b=T.placePlan(A,H.turn);AK.engine.act(H.turn,{t:'place',c:b[0],r:b[1]})}
 eq(A.ph,'aim','shooting after placing');ok(H.turn===0||H.turn===2,'out player never moves');}
/* 두 사람이 한꺼번에 탈락하면 같은 순위 */
{mkRoom({max:3,stones:1,pickfirst:1,again:0},['가','나','다'],true);
 const A=H.ak;A.st=[at(0,0,0),{...at(3,0,1),o:1},{...at(3,3,2),o:1}];A.ph='aim';H.turn=0;
 AK.engine.act(0,{t:'shoot',i:0,a:0,p:.1});roll();
 eq(H.phase,'over','over');eq(H.players.map(p=>p.rank).join(),'1,2,2','tied ranks');eq(A.res.w,0,'winner');}
/* 남은 사람이 모두 한꺼번에 탈락하면 무승부 */
{mkRoom({max:3,stones:1,pickfirst:1,again:0},['가','나','다'],true);
 const A=H.ak;A.st=[at(0,-1.9,0),{...at(3,0,1),o:1},{...at(3,3,2),o:1}];A.ph='aim';H.turn=0;
 AK.engine.act(0,{t:'shoot',i:0,a:-Math.PI/2,p:.6});roll();
 eq(H.phase,'over','draw over');eq(A.res.w,-1,'draw');eq(H.players.map(p=>p.rank).join(),'1,1,1','all first in a draw');}
/* 한 번 더(세 명): 쓴 사람이 탈락하지 않았다면 같은 사람 */
{mkRoom({max:3,stones:2,pickfirst:1,again:1},['가','나','다'],true);
 const A=H.ak;A.st=[at(0,-1.4,0),at(0,-2.0,1),at(2,2,2),at(0,1,0),at(-2,2,1),at(2,-2,2)];A.ph='aim';H.turn=0;
 AK.engine.act(0,{t:'shoot',i:0,a:-Math.PI/2,p:.4});roll();
 ok(A.st[1].o&&!A.st[0].o,'knocked');eq(H.turn,0,'again goes to same player');}
/* 시간 초과: 세 명이면 다음 사람 (탈락한 사람 건너뜀) */
{mkRoom({max:3,stones:1,pickfirst:1,turn:20},['가','나','다'],true);
 const A=H.ak;A.st=[at(0,1,0),at(0,-1,1),at(1,1,2)];A.ph='aim';H.turn=0;H.deadline=NOW+20000;
 H.players[1].finished=true;H.players[1].rank=3;A.st[1].o=1;
 NOW+=20001;engineTick();eq(H.turn,2,'timeout skips the one who is out');}
/* 방 설정: 오목 모드는 2명까지 */
{eq(AK.maxOf({omok:1}),2,'omok max 2');eq(AK.maxOf({omok:0}),4,'normal max 4');
 eq(roomSetOf(AK,{omok:1}).find(d=>d.k==='max').hi,2,'room set hi 2');eq(roomSetOf(AK,{omok:0}).find(d=>d.k==='max').hi,4,'room set hi 4');eq(roomSetOf(AK).find(d=>d.k==='max').hi,4,'room set default hi');
 eq(AK.fixCfg({omok:1,max:4},2,true).max,2,'omok clamps max');eq(AK.fixCfg({omok:1,max:2},3,true),null,'omok refused with 3 seated');
 eq(AK.fixCfg({omok:1,max:4},3,false).omok,0,'omok dropped when too many');eq(AK.fixCfg({omok:0,max:4},4,true).max,4,'normal untouched');}

/* ---------- 오목 모드 ---------- */
const gp=(c,r,s)=>{const [x,z]=T.gridXZ(c,r);return at(x,z,s)};
/* 판정: 반 칸 안의 가장 가까운 돌, 가로·세로·대각선 어디서나 (맨 끝 줄도), 6목도 침 */
{const five=(pts,s)=>T.omFive(T.omGrid(pts.map(([c,r])=>gp(c,r,s))),s);
 ok(five([[3,5],[4,5],[5,5],[6,5],[7,5]],0),'row five');
 ok(!five([[3,5],[4,5],[5,5],[6,5]],0),'four is not five');
 ok(five([[3,18],[4,18],[5,18],[6,18],[7,18]],0),'edge row horizontal counts');
 ok(five([[3,0],[4,0],[5,0],[6,0],[7,0]],1),'far edge row horizontal counts');
 ok(five([[4,14],[4,15],[4,16],[4,17],[4,18]],0),'vertical through edge row counts');
 ok(five([[0,18],[1,17],[2,16],[3,15],[4,14]],0),'diagonal through edge row counts');
 ok(five([[2,6],[3,6],[4,6],[5,6],[6,6],[7,6]],1),'six counts');
 {const g=T.omGrid([gp(3,5,0),gp(4,5,0),gp(5,5,0),gp(6,5,0)].concat([{...gp(7,5,0),x:gp(7,5,0).x+T.PITCH*.45}]));ok(T.omFive(g,0),'within half pitch counts')}
 {const g=T.omGrid([gp(3,5,0),gp(4,5,0),gp(5,5,0),gp(6,5,0)].concat([{...gp(7,5,0),x:gp(7,5,0).x+T.PITCH*.55}]));ok(!T.omFive(g,0),'beyond half pitch misses')}
 {const a=gp(7,5,1),b=gp(7,5,0);a.x+=T.PITCH*.3;b.x-=T.PITCH*.1;const g=T.omGrid([gp(3,5,0),gp(4,5,0),gp(5,5,0),gp(6,5,0),a,b]);ok(T.omFive(g,0),'nearest stone owns the point')}
 {const q=gp(5,5,0);q.o=1;eq(T.omGrid([q])[5*T.NL+5],0,'fallen stone ignored')}}
/* 엔진: 판 어디나 놓을 수 있고(겹치지 않게), 놓은 뒤 차례가 넘어감. 돌 수 제한 없음 */
{mkRoom({pickfirst:1,omok:1},undefined,true);
 const A=H.ak;eq(A.om,1,'omok on');eq(A.np,2,'omok two players');eq(A.st.length,0,'empty board');eq(A.ph,'aim','aim phase from the start');eq(H.turn,0,'black first');
 AK.engine.act(1,{t:'place',c:9,r:9});eq(A.st.length,0,'not your turn');
 AK.engine.act(0,{t:'place',c:19,r:9});eq(A.st.length,0,'not off grid');
 AK.engine.act(0,{t:'place',c:9.5,r:9});eq(A.st.length,0,'not between lines');
 AK.engine.act(0,{t:'place',c:9,r:9});eq(A.st.length,1,'placed anywhere');eq(H.turn,1,'turn passes after placing');
 {const q=A.st[0];ok(q.s===0&&!q.u&&Math.abs(q.x)<1e-9&&Math.abs(q.z)<1e-9&&Math.abs(q.y-(TOP+SH))<1e-9,'stone on the point')}
 AK.engine.act(1,{t:'place',c:9,r:9});eq(A.st.length,1,'cannot overlap');
 AK.engine.act(1,{t:'place',c:10,r:9});eq(A.st.length,2,'next point is fine');eq(H.turn,0,'back to black');
 AK.engine.act(0,{t:'place',c:0,r:0});AK.engine.act(1,{t:'place',c:18,r:0});AK.engine.act(0,{t:'place',c:0,r:18});eq(A.st.length,5,'corners and edges are fine');
 eq(snapFor(1).ak.st.length,5,'stones sent');eq(snapFor(1).ak.np,2,'np sent');
 for(let k=0;k<12;k++){const [c,r]=[k%9+2,3+Math.floor(k/9)*2];AK.engine.act(H.turn,{t:'place',c,r:r+7})}
 ok(A.st.length>12,'no stone limit '+A.st.length);}
/* 튕기기: 내 돌만, 놓은 돌과 겹친 돌은 점을 가림 */
{mkRoom({pickfirst:1,omok:1},undefined,true);
 const A=H.ak;AK.engine.act(0,{t:'place',c:9,r:12});AK.engine.act(1,{t:'place',c:9,r:6});
 AK.engine.act(0,{t:'shoot',i:1,a:-Math.PI/2,p:.5});eq(A.cnt,2,'cannot shoot the opponent stone');
 AK.engine.act(0,{t:'shoot',i:0,a:-Math.PI/2,p:.3});eq(A.cnt,3,'shot own stone');eq(A.ph,'roll','rolling');
 AK.engine.act(0,{t:'place',c:5,r:5});eq(A.st.length,2,'no placing while rolling');
 roll();eq(A.ph,'aim','aim again');ok(H.turn===1||A.next===0,'turn passes');}
/* 놓아서 오목: 맨 끝 줄이어도 승리, 순위·줄 전송 */
{mkRoom({pickfirst:1,omok:1},undefined,true);
 const A=H.ak;A.st=[gp(3,18,0),gp(4,18,0),gp(5,18,0),gp(6,18,0),gp(3,5,1),gp(4,5,1),gp(5,5,1),gp(6,5,1)];
 AK.engine.act(0,{t:'place',c:7,r:18});
 eq(H.phase,'over','five by placing ends');eq(A.res.w,0,'placer wins');eq(A.res.ln.length,5,'line sent');eq(H.players.map(p=>p.rank).join(),'1,2','ranks');}
/* 떨어진 돌은 그냥 사라지고 주인이 바뀌지 않음, 상대 돌을 떨어뜨리면 한 번 더(설정) */
for(const ag of [1,0]){
  mkRoom({pickfirst:1,omok:1,again:ag},undefined,true);
  const A=H.ak;A.st=[at(0,-1.45,0),at(0,-2.05,1)];H.turn=0;
  AK.engine.act(0,{t:'shoot',i:0,a:-Math.PI/2,p:.4});roll();
  if(A.st[1].o&&!A.st[0].o){eq(A.st[1].s,1,'owner unchanged');eq(A.st.length,2,'no stones appear');eq(H.turn,ag?0:1,'omok again after knock ag='+ag)}
  else fail('alkkagi omok knock setup');
}
/* 상대가 만들어 준 오목도 승리, 동시 오목은 튕긴 사람 패배 */
{mkRoom({pickfirst:1,omok:1},undefined,true);
 const A=H.ak;A.st=[gp(9,16,0)];for(let k=0;k<5;k++)A.st.push(gp(2+k,7,1));
 H.turn=0;AK.engine.act(0,{t:'shoot',i:0,a:-Math.PI/2,p:.2});roll();
 eq(H.phase,'over','five ends');eq(A.res.w,1,'opponent five wins even on my shot');eq(A.res.ln.length,5,'line sent');}
{mkRoom({pickfirst:1,omok:1},undefined,true);
 const A=H.ak;A.st=[gp(9,16,0)];for(let k=0;k<5;k++)A.st.push(gp(2+k,7,1));for(let k=0;k<5;k++)A.st.push(gp(2+k,12,0));
 H.turn=0;AK.engine.act(0,{t:'shoot',i:0,a:-Math.PI/2,p:.2});roll();
 eq(A.res.w,1,'both fives: shooter loses');eq(A.res.why,'both','both reason');}
/* 시간 초과면 차례만 넘김 */
{mkRoom({pickfirst:1,omok:1,turn:20},undefined,true);
 const A=H.ak;AK.engine.act(0,{t:'place',c:9,r:9});NOW+=20001;engineTick();eq(H.turn,0,'timeout passes turn');eq(A.st.length,1,'nothing placed for them');}
/* 놓을 점이 없으면 무승부 */
{mkRoom({pickfirst:1,omok:1},undefined,true);
 const A=H.ak;eq(T.omFull(A),false,'empty board not full');
 A.st=[];for(let c=0;c<T.NL;c++)for(let r=0;r<T.NL;r++)A.st.push(gp(c,r,(c+r+((c>>1)+(r>>1)))&1));
 eq(T.omFull(A),true,'full board');}
/* 봇 계획: 놓기는 놓을 수 있는 곳, 후보는 내 돌과 놓기 */
{const A={om:1,np:2,st:[gp(4,10,0),gp(5,10,0),gp(6,10,0),gp(9,6,1)]};
 for(let k=0;k<10;k++){const b=T.omPlacePlan(A,0,null,1+(k%2));ok(b&&T.canPlace(A,0,b[0],b[1]),'omok place plan')}
 const t=T.omTargets(A,0,4);ok(t.some(q=>(q.c===3||q.c===7)&&q.r===10),'target extends line');
 const c=T.omCands(A,0,2);ok(c.length>0,'omok cands');
 ok(c.some(q=>q.pl),'cands include placing');ok(c.some(q=>q.i!=null),'cands include flicking');
 ok(c.every(q=>q.pl?T.canPlace(A,0,q.pl[0],q.pl[1]):(A.st[q.i].s===0&&q.p>=.1&&q.p<=1)),'cands valid');
 for(let k=0;k<30;k++){const b=T.botPlan(A,0);ok(b&&(b.pl?T.canPlace(A,0,b.pl[0],b.pl[1]):A.st[b.i].s===0&&b.p>=.1),'easy omok plan')}
 {const B={om:1,np:2,st:[gp(3,10,0),gp(4,10,0),gp(5,10,0),gp(6,10,0),gp(9,6,1),gp(9,5,1)]},win=q=>(q.c===2||q.c===7)&&q.r===10;
  ok(win(T.omTargets(B,0,1)[0]),'bot aims at its winning point');ok(win(T.omTargets(B,1,1)[0]),'bot aims at the blocking point');
  ok(T.omScore(B,0,{pl:[7,10]})>=1e6,'placing the fifth scores a sure win');
  eq(T.omThreats(B.st,T.omGrid(B.st),0),2,'open four has two winning points');eq(T.omThreats(B.st,T.omGrid(B.st),1),0,'no threat for the other side');
  {const C={om:1,np:2,st:B.st.slice(0,4).concat([gp(2,10,1),gp(12,3,1)])};   // 막힌 넷: 이기는 점 하나 (7,10). 백이 막지 않는 수는 크게 −
   ok(T.omScore(C,1,{pl:[7,10]})>T.omScore(C,1,{pl:[12,4]})+1e5,'blocking beats ignoring a four')}
  for(let k=0;k<5;k++){const p=T.omPlacePlan(B,0,null,2);ok(p&&(p[0]===2||p[0]===7)&&p[1]===10,'hard place plan wins')}}
 const sc=T.omScore(A,0,{pl:[7,10]});ok(sc>T.omScore(A,0,{pl:[16,2]}),'extending a three beats a far corner '+sc);}
/* ---------- 장기 모드 ---------- */
/* 방 설정: 게임 모드 md(0 바둑·1 오목·2 장기), 예전 오목 스위치도 읽음. 오목·장기는 2명까지 */
{eq(T.mdOf({md:2}),2,'md jang');eq(T.mdOf({omok:1}),1,'legacy omok');eq(T.mdOf({md:0,omok:0}),0,'baduk');
 eq(AK.maxOf({md:2}),2,'jang max 2');eq(AK.fixCfg({md:2,max:4},2,true).max,2,'jang clamps max');eq(AK.fixCfg({md:2,max:2},3,true),null,'jang refused with 3 seated');
 eq(T.mdOf(AK.fixCfg({md:2,max:4},3,false)),0,'jang dropped when too many');}
/* 상차림: 한 쪽 16개(장 1), 모두 판 위, 서로 겹치지 않음, 1번 자리는 0번 자리를 판 가운데로 돌린 자리 */
{T.useBoard(1);const st=T.jgSetup();eq(st.length,32,'jang pieces');
 for(const s of [0,1]){eq(st.filter(q=>q.s===s).length,16,'per side '+s);eq(st.filter(q=>q.s===s&&q.t===7).length,1,'one jang '+s)}
 ok(st.every(q=>Math.abs(q.x)<T.BD.x-T.geomOf(q.t).r&&Math.abs(q.z)<T.BD.z-T.geomOf(q.t).r),'all on board');
 ok(st.slice(0,16).every(q=>q.z>0)&&st.slice(16).every(q=>q.z<0),'sides');
 for(let k=0;k<16;k++)ok(Math.abs(st[k].x+st[k+16].x)<1e-9&&Math.abs(st[k].z+st[k+16].z)<1e-9&&st[k].t===st[k+16].t,'point mirror '+k);
 for(let i=0;i<32;i++)for(let j=i+1;j<32;j++){const a=st[i],b=st[j];if(Math.hypot(a.x-b.x,a.z-b.z)<T.geomOf(a.t).r+T.geomOf(b.t).r+.02)fail('alkkagi jang overlap '+i+','+j)}
 ok(T.JM[7]>T.JM[4]&&T.JM[4]>T.JM[1]&&Math.abs(T.JM[4]-1)<1e-9,'mass order');
 ok(T.shotSpeed({t:7},.5)<T.shotSpeed({t:4},.5)&&T.shotSpeed({t:4},.5)<T.shotSpeed({t:1},.5),'heavier is slower');
 T.useBoard(0);}
/* 물리: 같은 힘이면 무거운 알이 덜 감, 무거운 알은 덜 밀림, 비껴 맞으면 돎(정면은 거의 안 돎) */
{T.useBoard(1);const P=(x,z,s,t)=>({x,y:TOP+T.geomOf(t).h,z,s,o:0,g:0,t,w:0}),shot=(st,i,a,p)=>{const v=T.shotSpeed(st[i],p);return T.simulate(st,{i,vx:Math.cos(a)*v,vz:Math.sin(a)*v,p},()=>.5)};
 {const a=shot([P(0,1.5,0,7)],0,-Math.PI/2,.35),b=shot([P(0,1.5,0,1)],0,-Math.PI/2,.35);ok(1.5-a.fin[0].z<1.5-b.fin[0].z,'jang travels less '+(1.5-a.fin[0].z).toFixed(2)+' < '+(1.5-b.fin[0].z).toFixed(2))}
 {const a=shot([P(0,1,0,4),P(0,.3,1,7)],0,-Math.PI/2,.3),b=shot([P(0,1,0,4),P(0,.3,1,1)],0,-Math.PI/2,.3);ok(.3-a.fin[1].z<.3-b.fin[1].z,'heavy target moves less')}
 {const r=shot([P(0,1,0,4),P(.25,0,1,4)],0,-Math.PI/2,.35);eq(r.k,6,'spin frames');ok(Math.abs(r.fin[1].w)>.05,'glancing hit spins '+r.fin[1].w);
  const h=shot([P(0,1,0,4),P(0,0,1,4)],0,-Math.PI/2,.35);ok(Math.abs(h.fin[1].w)<.05,'head-on barely spins '+h.fin[1].w)}
 /* 손가락 무게: 같은 당김이면 졸로 칠 때 차가 차로 칠 때보다 덜 밀림, 장·졸 속도 차이는 2배 안쪽 */
 {const a=shot([P(0,1,0,1),P(0,.2,1,6)],0,-Math.PI/2,.5),b=shot([P(0,1,0,6),P(0,.2,1,6)],0,-Math.PI/2,.5);ok(.2-a.fin[1].z<(.2-b.fin[1].z)*.75,'jol pushes cha less '+(.2-a.fin[1].z).toFixed(2)+' < '+(.2-b.fin[1].z).toFixed(2))}
 {const r=T.shotSpeed({t:1},.7)/T.shotSpeed({t:7},.7);ok(r>1.5&&r<2.1,'jol/jang speed ratio '+r.toFixed(2))}
 /* 반발: 같은 무게 정면이면 친 알이 조금 따라 들어감 (장기알 eJ: 친 알 속도/맞은 알 속도 = (1-e)/(1+e), 이동 거리비는 그 제곱) */
 {const g=T.geomOf(6),r=shot([P(0,1,0,6),P(0,.2,1,6)],0,-Math.PI/2,.5),ds=(1-r.fin[0].z)-(.8-2*g.r),dt=.2-r.fin[1].z,k=((1-T.PHY.eJ)/(1+T.PHY.eJ))**2;
  ok(ds/dt>k*.5&&ds/dt<k*2,'jang restitution follow-through '+(ds/dt).toFixed(3)+' ~ '+k.toFixed(3))}
 T.useBoard(0);}
/* 엔진: 바로 튕기기(놓기 없음), 상태 전송에 종류·각도 */
{mkRoom({pickfirst:1,md:2},undefined,true);
 const A=H.ak;eq(A.jg,1,'jang on');eq(A.np,2,'jang two players');eq(A.st.length,32,'pieces');eq(A.ph,'aim','aim from the start');eq(H.turn,0,'cho first');eq(A.co[0],1,'first is cho');
 {const s=snapFor(1);eq(s.ak.jg,1,'jg sent');eq(s.ak.st[0].length,9,'type and angle sent');eq(s.ak.st[8][7],7,'jang type')}
 AK.engine.act(0,{t:'shoot',i:11,a:-Math.PI/2,p:.3});eq(A.cnt,1,'shot');roll();eq(A.ph,'aim','roll ends');ok(A.st.every(q=>q.t>0),'types kept');}
/* 장 떨어지면 패배: 상대 장을 떨어뜨리면 승리, 둘 다면 먼저 떨어진 쪽이 짐(같은 순간이면 튕긴 사람). 끄면 계속 */
for(const jl of [1,0]){mkRoom({pickfirst:1,md:2,jang:jl},undefined,true);
 const A=H.ak,g=T.geomOf;A.st=[{x:0,y:TOP+g(4).h,z:-1.5,s:0,o:0,g:0,t:4,w:0},{x:0,y:TOP+g(7).h,z:-2.15,s:1,o:0,g:0,t:7,w:0},{x:1.5,y:TOP+g(1).h,z:-1,s:1,o:0,g:0,t:1,w:0},{x:1.5,y:TOP+g(7).h,z:1.5,s:0,o:0,g:0,t:7,w:0}];
 AK.engine.act(0,{t:'shoot',i:0,a:-Math.PI/2,p:.45});
 if(!A.st[1].o){fail('alkkagi jang knock setup');continue}
 roll();
 if(jl){eq(H.phase,'over','jang down ends');eq(A.res.w,0,'jang knocker wins');eq(A.res.why,'jang','jang reason')}
 else{eq(H.phase,'play','jang rule off continues')}}
for(const [t0,t1,w] of [[100,200,1],[300,120,0],[150,150,1]]){mkRoom({pickfirst:1,md:2,jang:1},undefined,true);
 const A=H.ak;A.st.forEach(q=>{if(q.t===7){q.o=1;q.y=.05}});const k0=A.st.findIndex(q=>q.t===7&&q.s===0),k1=A.st.findIndex(q=>q.t===7&&q.s===1);
 A.sh={id:1,by:0,i:0,a:0,p:.5,of:{[k0]:t0,[k1]:t1},tr:{},nf:1,ev:[],dur:0,t0:NOW};A.ph='roll';A.until=NOW;A.next=1;engineTick();
 eq(H.phase,'over','both jang over');eq(A.res.w,w,'earlier jang loses '+t0+'/'+t1);}
/* 봇끼리 끝까지 */
function playOutA(over,lvs,np){
  np=np||2;
  hostNew(false,'t','t');
  H.cfg={...cfgFor('alkkagi'),...over,game:'alkkagi'};
  H.members=Array.from({length:np},(_,i)=>({name:'b'+i,bot:true,conn:null,host:i===0,lv:lvs[i%lvs.length]}));
  hostStart();
  let ticks=0,guard=0;
  while(H.phase!=='over'&&guard++<30000){NOW+=250;engineTick();ticks++;
    if(H.ak.st.some(q=>!Number.isFinite(q.x+q.y+q.z))){fail('alkkagi NaN position');break}}
  if(H.phase!=='over'){fail('alkkagi stuck shots='+H.ak.cnt+' np='+np);return ticks}
  const rk=H.players.map(p=>p.rank),w=H.ak.res.w;
  if(rk.some(r=>!Number.isInteger(r)||r<1||r>np))fail('alkkagi ranks '+rk);
  else if(w>=0&&(rk[w]!==1||rk.filter(r=>r===1).length!==1))fail('alkkagi winner rank '+rk+' w='+w);
  else if(w<0&&H.ak.res.why!=='full'&&rk.filter(r=>r===1).length<2)fail('alkkagi draw ranks '+rk);
  if(H.ak.om){   // 오목 모드: 이긴 사람은 오목을 가짐 (돌 수는 제한 없음, 떨어진 돌은 사라짐)
    if(w>=0&&!H.ak.res.why&&!T.omFive(T.omGrid(H.ak.st),w))fail('alkkagi omok winner without five');
    return ticks;
  }
  if(H.ak.res.why==='jang'){   // 장기 모드 장 떨어지면 패배: 진 쪽 장은 떨어짐
    if(!H.ak.st.some(q=>q.t===7&&q.s===1-w&&q.o))fail('alkkagi jang loser still has jang');
    return ticks;
  }
  const al=Array.from({length:np},(_,s)=>H.ak.st.filter(q=>q.s===s&&!q.o).length);
  if(w>=0&&al.some((n,s)=>s!==w&&n!==0))fail('alkkagi losers still have stones '+al);
  if(w>=0&&al[w]===0)fail('alkkagi winner has no stones');
  return ticks;
}
globalThis.playOutA=playOutA;
