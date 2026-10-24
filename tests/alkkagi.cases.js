/* 알까기 테스트 (tests/engine.test.js가 이 파일을 불러서 { } 블록 안에서 돌림)
   앞에서 정해져 있는 것: AK(=GAMES.alkkagi), fail(), hostNew·hostStart·engineTick·snapFor 등 공통 엔진 */
const T=AK._test,{SR,SH,TOP,BW}=T;
const eq=(a,b,m)=>{if(a!==b)fail('alkkagi '+m+': '+a+' != '+b)};
const ok=(c,m)=>{if(!c)fail('alkkagi '+m)};
const at=(x,z,s)=>({x,y:TOP+SH,z,s,o:0,g:0});
const maxY=(r,i)=>{const t=r.tr[i];if(!t)return TOP+SH;let m=-9;for(let k=1;k<t.length;k+=5)m=Math.max(m,t[k+1]/1000);return m};

/* 처음 자리: 개수대로, 모두 판 위, 겹치지 않음, 두 사람이 대칭 */
for(let n=1;n<=10;n++){
  const h=T.homes(n);
  eq(h.length,2*n,'homes count '+n);
  ok(h.every(q=>Math.abs(q.x)<BW-SR&&Math.abs(q.z)<BW-SR),'homes on board '+n);
  for(let i=0;i<h.length;i++)for(let j=i+1;j<h.length;j++)if(Math.hypot(h[i].x-h[j].x,h[i].z-h[j].z)<2*SR+.01)fail('alkkagi homes overlap n='+n);
  ok(h.slice(0,n).every(q=>q.z>0&&q.s===0)&&h.slice(n).every(q=>q.z<0&&q.s===1),'homes sides '+n);
  ok(h.slice(0,n).every((q,k)=>Math.abs(q.x+h[n+k].x)<1e-9&&Math.abs(q.z+h[n+k].z)<1e-9),'homes mirrored '+n);
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
const mkRoom=(over,names=['가','나'])=>{
  hostNew(false,'t','t');
  H.cfg={...cfgFor('alkkagi'),...over,game:'alkkagi'};
  H.members=names.map((n,i)=>({name:n,bot:false,conn:null,host:i===0}));
  hostStart();
  NOW+=10000;H.dealUntil=0;H.deadline=NOW+H.cfg.turn*1000;H.botActAt=0;   // 시작 연출 지나감
  return H;
};
const roll=()=>{for(let k=0;k<80&&H.ak.ph==='roll'&&H.phase==='play';k++){NOW+=250;engineTick()}};
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
{const A={st:T.homes(5)};for(let k=0;k<50;k++){const b=T.botPlan(A,1);ok(b&&A.st[b.i].s===1&&b.p>=.3&&b.p<=1&&Number.isFinite(b.a),'bot plan')}
 A.st.forEach(q=>{if(q.s===1)q.o=1});eq(T.botPlan(A,1),null,'bot with no stones');}

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
  const al=[0,1].map(s=>H.ak.st.filter(q=>q.s===s&&!q.o).length);
  if(H.ak.res.w>=0&&al[1-H.ak.res.w]!==0)fail('alkkagi loser still has stones '+al);
  return ticks;
}
globalThis.playOutA=playOutA;
