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

/* ---------- 오목 모드 ---------- */
const gp=(c,r,s)=>{const [x,z]=T.gridXZ(c,r);return at(x,z,s)};
const bowl=s=>({x:0,y:.1,z:s?-2.6:2.6,s,o:0,g:0,u:1});
/* 판정: 반 칸 안의 가장 가까운 돌, 첫째 줄을 따라 가로 5목은 안 침(세로·대각선은 침), 6목도 침 */
{const five=(pts,s)=>T.omFive(T.omGrid(pts.map(([c,r])=>gp(c,r,s))),s);
 ok(five([[3,5],[4,5],[5,5],[6,5],[7,5]],0),'row five');
 ok(!five([[3,5],[4,5],[5,5],[6,5]],0),'four is not five');
 ok(!five([[3,18],[4,18],[5,18],[6,18],[7,18]],0),'edge row horizontal ignored');
 ok(!five([[3,0],[4,0],[5,0],[6,0],[7,0]],1),'far edge row horizontal ignored');
 ok(five([[4,14],[4,15],[4,16],[4,17],[4,18]],0),'vertical through edge row counts');
 ok(five([[0,18],[1,17],[2,16],[3,15],[4,14]],0),'diagonal through edge row counts');
 ok(five([[2,6],[3,6],[4,6],[5,6],[6,6],[7,6]],1),'six counts');
 {const g=T.omGrid([gp(3,5,0),gp(4,5,0),gp(5,5,0),gp(6,5,0)].concat([{...gp(7,5,0),x:gp(7,5,0).x+T.PITCH*.45}]));ok(T.omFive(g,0),'within half pitch counts')}
 {const g=T.omGrid([gp(3,5,0),gp(4,5,0),gp(5,5,0),gp(6,5,0)].concat([{...gp(7,5,0),x:gp(7,5,0).x+T.PITCH*.55}]));ok(!T.omFive(g,0),'beyond half pitch misses')}
 {const a=gp(7,5,1),b=gp(7,5,0);a.x+=T.PITCH*.3;b.x-=T.PITCH*.1;const g=T.omGrid([gp(3,5,0),gp(4,5,0),gp(5,5,0),gp(6,5,0),a,b]);ok(T.omFive(g,0),'nearest stone owns the point')}
 {const q=gp(5,5,0);q.o=1;eq(T.omGrid([q])[5*T.NL+5],0,'fallen stone ignored')}}
/* 주인 바꾸기: 떨어진 순서대로, 돌이 5개뿐이면 자기 통으로 */
{const st=[];for(let k=0;k<6;k++)st.push(gp(k,10,0));for(let k=0;k<14;k++)st.push(gp(k,4,1));
 st[0].o=st[1].o=st[2].o=1;st[6].o=1;
 const cv=T.omConv({st},{0:100,1:200,2:300,6:50});
 eq(JSON.stringify(cv),JSON.stringify([[6,0],[0,1],[1,1],[2,0]]),'conv order and floor');}
/* 엔진: 첫째 줄에만 놓고, 놓은 돌만 튕김 */
{mkRoom({pickfirst:1,omok:1},undefined,true);
 const A=H.ak;eq(A.om,1,'omok on');eq(A.st.length,2*T.OM_N,'ten each');ok(A.st.every(q=>q.u),'all in bowls');eq(A.ph,'place','place first');eq(H.turn,0,'black first');
 AK.engine.act(0,{t:'place',c:9,r:17});eq(A.pc,0,'not second row');
 AK.engine.act(0,{t:'place',c:9,r:0});eq(A.pc,0,'not opponent row');
 AK.engine.act(0,{t:'place',c:9,r:18});eq(A.pc,1,'placed on first row');eq(A.ph,'aim','then shoot');eq(H.turn,0,'same player shoots');
 const fx=A.fx;ok(fx>=0&&A.st[fx].s===0&&!A.st[fx].u,'fixed stone');eq(snapFor(1).ak.fx,fx,'fx sent');
 AK.engine.act(0,{t:'shoot',i:(fx+1)%T.OM_N,a:-Math.PI/2,p:.5});eq(A.cnt,0,'bowl stone cannot shoot');
 AK.engine.act(0,{t:'shoot',i:fx,a:-Math.PI/2,p:.3});eq(A.cnt,1,'shot');roll();
 eq(H.turn,1,'opponent next');eq(A.ph,'place','opponent places');
 AK.engine.act(1,{t:'place',c:9,r:18});eq(A.pc,1,'opponent not on my row');
 AK.engine.act(1,{t:'place',c:9,r:0});eq(A.pc,2,'opponent placed');
 NOW+=31000;engineTick();
 eq(H.turn,0,'timeout passes');ok(A.st.filter(q=>q.s===1&&q.u).length===T.OM_N,'timed-out stone back to bowl');eq(A.ph,'place','next places');
 NOW+=31000;engineTick();eq(H.turn,1,'timeout while placing passes');}
/* 떨어뜨린 상대 돌은 내 통으로 (연출이 끝난 뒤), 돌이 5개뿐이면 자기 통으로 */
for(const floor of [0,1]){
  mkRoom({pickfirst:1,omok:1},undefined,true);
  const A=H.ak;
  A.st=[gp(9,16,0),gp(9,4,1)];for(let k=0;k<9;k++)A.st.push(bowl(0));for(let k=0;k<(floor?4:9);k++)A.st.push(bowl(1));
  A.st[1]=at(0,-2.05,1);A.st[0]=at(0,-1.45,0);A.fx=0;A.ph='aim';H.turn=0;
  AK.engine.act(0,{t:'shoot',i:0,a:-Math.PI/2,p:.4});
  ok(A.st[1].o&&!A.st[1].u,'knocked stone waits on felt during roll');eq(A.st[1].s,1,'owner unchanged during roll');
  roll();
  if(!A.st[0].o){eq(A.st[1].u,1,'knocked stone to bowl');eq(A.st[1].s,floor?1:0,'owner after capture floor='+floor);eq(H.turn,0,'omok again after knock')}
  else fail('alkkagi omok capture setup');
}
/* 오목 판정: 상대가 만들어 준 오목도 승리, 동시 오목은 튕긴 사람 패배 */
{mkRoom({pickfirst:1,omok:1},undefined,true);
 const A=H.ak;A.st=[gp(9,18,0)];for(let k=0;k<5;k++)A.st.push(gp(2+k,7,1));for(let k=0;k<9;k++)A.st.push(bowl(0));for(let k=0;k<5;k++)A.st.push(bowl(1));
 A.fx=0;A.ph='aim';H.turn=0;AK.engine.act(0,{t:'shoot',i:0,a:-Math.PI/2,p:.2});roll();
 eq(H.phase,'over','five ends');eq(A.res.w,1,'opponent five wins even on my shot');eq(A.res.ln.length,5,'line sent');}
{mkRoom({pickfirst:1,omok:1},undefined,true);
 const A=H.ak;A.st=[gp(9,18,0)];for(let k=0;k<5;k++)A.st.push(gp(2+k,7,1));for(let k=0;k<5;k++)A.st.push(gp(2+k,12,0));for(let k=0;k<4;k++)A.st.push(bowl(0));for(let k=0;k<5;k++)A.st.push(bowl(1));
 A.fx=0;A.ph='aim';H.turn=0;AK.engine.act(0,{t:'shoot',i:0,a:-Math.PI/2,p:.2});roll();
 eq(A.res.w,1,'both fives: shooter loses');eq(A.res.why,'both','both reason');}
/* 통이 비면 판 위 내 돌 아무거나 */
{mkRoom({pickfirst:1,omok:1},undefined,true);
 const A=H.ak;A.st=[gp(3,15,0),gp(12,15,0),gp(5,3,1)];for(let k=0;k<17;k++)A.st.push(bowl(1));
 H.turn=1;A.fx=-1;A.ph='aim';AK.engine.act(1,{t:'shoot',i:2,a:Math.PI/2,p:.2});roll();
 eq(H.turn,0,'empty bowl player turn');eq(A.ph,'aim','no placing with empty bowl');eq(A.fx,-1,'any stone');
 AK.engine.act(0,{t:'shoot',i:1,a:-Math.PI/2,p:.2});eq(A.cnt,2,'board stone shot');}
/* 봇 계획: 놓기는 첫째 줄, 후보는 정해진 돌에서 */
{const A={om:1,fx:-1,st:[gp(4,10,0),gp(5,10,0),gp(6,10,0),gp(9,6,1)]};for(let k=0;k<8;k++)A.st.push(bowl(0));
 for(let k=0;k<10;k++){const b=T.omPlacePlan(A,0,null,1+(k%2));ok(b&&b[1]===18&&T.canPlace(A,0,b[0],b[1]),'omok place plan')}
 const t=T.omTargets(A,0,4);ok(t.some(q=>(q.c===3||q.c===7)&&q.r===10),'target extends line');
 A.st[0]=gp(9,18,0);A.fx=0;const c=T.omCands(A,0,2);ok(c.length&&c.every(q=>q.i===0&&q.p>=.1&&q.p<=1),'cands from fixed stone');
 for(let k=0;k<30;k++){const b=T.botPlan(A,0);ok(b&&b.i===0&&b.p>=.1,'easy omok plan')}}
/* 봇끼리 끝까지 */
function playOutA(over,lvs){
  hostNew(false,'t','t');
  H.cfg={...cfgFor('alkkagi'),...over,game:'alkkagi'};
  H.members=[0,1].map(i=>({name:'b'+i,bot:true,conn:null,host:i===0,lv:lvs[i%lvs.length]}));
  hostStart();
  let ticks=0,guard=0;
  while(H.phase!=='over'&&guard++<20000){NOW+=250;engineTick();ticks++;
    if(H.ak.st.some(q=>!Number.isFinite(q.x+q.y+q.z))){fail('alkkagi NaN position');break}}
  if(H.phase!=='over'){fail('alkkagi stuck shots='+H.ak.cnt);return ticks}
  const ranks=H.players.map(p=>p.rank).join();
  if(ranks!=='1,2'&&ranks!=='2,1'&&ranks!=='1,1')fail('alkkagi ranks '+ranks);
  if(H.ak.om){   // 오목 모드: 이긴 사람에게 오목 줄, 돌 수는 그대로 (한 사람 5개 이상)
    const own=[0,1].map(s=>H.ak.st.filter(q=>q.s===s).length);
    if(own[0]+own[1]!==2*T.OM_N||Math.min(...own)<T.OM_MIN)fail('alkkagi omok stones '+own);
    if(H.ak.res.w>=0&&!H.ak.res.why&&!T.omFive(T.omGrid(H.ak.st),H.ak.res.w))fail('alkkagi omok winner without five');
    return ticks;
  }
  const al=[0,1].map(s=>H.ak.st.filter(q=>q.s===s&&!q.o).length);
  if(H.ak.res.w>=0&&al[1-H.ak.res.w]!==0)fail('alkkagi loser still has stones '+al);
  return ticks;
}
globalThis.playOutA=playOutA;
