/* 뱀 사다리 테스트 (tests/engine.test.js가 이 파일을 불러서 { } 블록 안에서 돌림) */
const TT=SL._test;
const eq=(a,b,m)=>{if(a!==b)fail('snakes '+m+': '+a+' != '+b)};
const pass=ms=>{for(let k=0;k<ms/50;k++){NOW+=50;engineTick()}};
const setup=(n,bots,over,blv)=>{
  hostNew(false,'t','t');H.cfg={...cfgFor('snakes'),game:'snakes',...(over||{})};
  H.members=[];for(let i=0;i<n;i++)H.members.push(bots&&i>=bots?{name:'b'+i,bot:true,conn:null,host:false,lv:blv||0}:{name:'p'+i,bot:false,conn:i?{}:null,host:i===0,cid:i?'c'+i:''});
  hostStart();pass(H.dealMs+200);
};
const act=(s,a)=>SL.engine.act(s,a);
const CF=(o)=>TT.eff({sz:2,sn:1,ld:1,len:3,...(o||{})},4);

/* 판 번호: 아래 줄 왼쪽 → 오른쪽, 다음 줄 오른쪽 → 왼쪽 */
eq(TT.rowOf(1,10),0,'row 1');eq(TT.colOf(1,10),0,'col 1');eq(TT.colOf(10,10),9,'col 10');eq(TT.colOf(11,10),9,'col 11 zigzag');eq(TT.colOf(20,10),0,'col 20');eq(TT.rowOf(100,10),9,'row 100');
for(let c=1;c<=100;c++)eq(TT.cellAt(TT.rowOf(c,10),TT.colOf(c,10),10),c,'cellAt '+c);
/* 설정 → 실제 값: 칸에 비해 많으면 줄임 */
{const e=TT.eff({sz:0,sn:5,ld:5,len:9},4);eq(e.N,6,'6x6');eq(e.sn+e.ld<=2,true,'cap 6x6 4p');eq(e.len,5,'len cap N-1')}
{const e=TT.eff({sz:3,sn:5,ld:5,len:3,dc:1,exact:1},2);eq(e.N,12,'12x12');eq(e.sn+e.ld,10,'12x12 2p fits 10');eq(e.dn,2,'two dice');eq(e.exact,1,'exact')}
/* 설치 규칙 */
{const cf=CF();
  eq(TT.okPut([],cf,'s',45,25),true,'snake down 2 rows');eq(TT.okPut([],cf,'s',25,45),false,'snake must go down');
  eq(TT.okPut([],cf,'l',25,45),true,'ladder up');eq(TT.okPut([],cf,'l',5,8),false,'same row');
  eq(TT.okPut([],cf,'s',55,15),false,'too far (4 rows)');eq(TT.okPut([],cf,'s',45,15),true,'3 rows ok');
  eq(TT.okPut([],cf,'l',1,15),false,'no start cell');eq(TT.okPut([],cf,'s',100,85),false,'no goal cell');
  const it=[{k:'s',a:45,b:25,o:0}];eq(TT.okPut(it,cf,'l',25,40),false,'used end');eq(TT.okPut(it,cf,'l',26,45),false,'used end 2');eq(TT.okPut(it,cf,'l',26,40),true,'free ends');
  eq(TT.endsFor([],cf,'l',5).every(b=>TT.rowOf(b,10)>=1&&TT.rowOf(b,10)<=3),true,'ends rows');eq(TT.endsFor([],cf,'s',5).length,0,'no snake from bottom');
}
/* 걷기: 정확히 도착이면 되돌아옴 */
{const cf=CF(),it=[{k:'l',a:4,b:26,o:0},{k:'s',a:30,b:12,o:1}];
  let w=TT.walk(it,cf,1,3);eq(w.path.join(),'2,3,4','path');eq(w.to,26,'ladder up');eq(w.via.k,'l','via ladder');
  w=TT.walk(it,cf,26,4);eq(w.to,12,'snake down');
  w=TT.walk([],cf,98,5);eq(w.to,100,'not exact stops at goal');eq(w.path.join(),'99,100','stops');
  w=TT.walk([],{...cf,exact:1},98,5);eq(w.to,97,'exact bounce');eq(w.path.join(),'99,100,99,98,97','bounce path');
  w=TT.walk([],{...cf,exact:1},96,4);eq(w.to,100,'exact hit');
}
/* 시작: 설치 단계, 모두에게 차례(받는 사람마다) */
setup(3);{eq(H.sl.ph,'setup','setup first');eq(H.sl.pos.join(),'1,1,1','all on 1');eq(H.sl.left[0].join(),'1,1','stock');
  eq(snapFor(1).t,1,'setup turn per receiver');eq(snapFor(2).t,2,'setup turn per receiver 2');
  act(1,{t:'put',k:'s',a:25,b:45});eq(H.sl.items.length,0,'bad snake');
  act(1,{t:'put',k:'s',a:45,b:25});eq(H.sl.items.length,1,'snake placed');eq(H.sl.left[1].join(),'0,1','stock down');
  act(2,{t:'put',k:'l',a:25,b:40});eq(H.sl.items.length,1,'first come: end taken');
  act(1,{t:'put',k:'s',a:66,b:46});eq(H.sl.items.length,1,'no more snakes');
  act(1,{t:'del',c:25});eq(H.sl.items.length,0,'take back');eq(H.sl.left[1].join(),'1,1','stock back');
  act(2,{t:'del',c:45});eq(H.sl.items.length,0,'cannot take others');
  act(0,{t:'put',k:'s',a:45,b:25});act(0,{t:'put',k:'l',a:3,b:22});act(1,{t:'put',k:'s',a:66,b:47});act(1,{t:'put',k:'l',a:6,b:35});
  act(2,{t:'put',k:'s',a:88,b:72});eq(snapFor(2).t,2,'still my turn');act(1,{t:'del',c:66});act(1,{t:'put',k:'s',a:66,b:47});
  act(2,{t:'put',k:'l',a:8,b:33});eq(H.sl.items.length,6,'all placed');eq(snapFor(0).t,undefined,'no turn when all done');eq(H.sl.ph,'setup','short wait');
  pass(TT.GO_WAIT+100);eq(H.sl.ph,'play','play');eq(H.turn,H.sl.first,'first player rolls');
  const t=H.turn;act((t+1)%3,{t:'roll'});eq(H.sl.mv,null,'not your turn');
  act(t,{t:'shake',on:1});eq(H.sl.shk[t],1,'shaking');act(t,{t:'roll'});eq(!!H.sl.mv,true,'rolling');eq(H.sl.mv.d.length,1,'one die');
  const m=H.sl.mv;eq(H.sl.pos[t],1,'pos waits for animation');act(t,{t:'roll'});eq(H.sl.mv.id,m.id,'no double roll');
  eq(snapFor(0).dl,0,'no timer while moving');pass(m.ms+100);eq(H.sl.pos[t],m.to,'moved');eq(H.turn,(t+1)%3,'next turn');}
/* 설치 시간이 지나면 남은 것은 아무 데나 */
setup(3,0,{sn:2,ld:2,stime:20});{act(0,{t:'put',k:'s',a:45,b:25});pass(20000+TT.GO_WAIT+300);eq(H.sl.ph,'play','auto after setup time');eq(H.sl.items.length,12,'auto filled');
  eq(H.sl.items.filter(it=>it.o===0).length,4,'kept mine + filled');
  const u=new Set();H.sl.items.forEach(it=>{u.add(it.a);u.add(it.b)});eq(u.size,24,'distinct ends');}
/* 뱀·사다리가 0개면 바로 굴리기 */
setup(2,0,{sn:0,ld:0});eq(H.sl.ph,'play','no setup');
/* 도착하면 승리, 나머지는 위치 순 */
setup(3,0,{sn:0,ld:0});{const t=H.turn;H.sl.pos=[1,1,1];H.sl.pos[t]=99;H.sl.pos[(t+1)%3]=50;H.sl.pos[(t+2)%3]=70;
  act(t,{t:'roll'});pass(H.sl.mv?H.sl.mv.ms+100:100);eq(H.phase,'over','over at goal');eq(H.players[t].rank,1,'winner');eq(H.players[(t+2)%3].rank,2,'second by position');eq(H.players[(t+1)%3].rank,3,'third');}
/* 정확히 도착: 넘치면 되돌아옴 → 끝나지 않음 */
setup(2,0,{sn:0,ld:0,exact:1,dc:1});{const t=H.turn;H.sl.pos[t]=99;let tries=0;
  while(H.phase==='play'&&tries<40){const i=H.turn;act(i,{t:'roll'});const m=H.sl.mv;if(m&&m.from===99&&m.d[0]!==1)eq(m.to<100,true,'bounce no win');pass((m?m.ms:0)+100);tries++}
  eq(H.phase,'over','eventually finishes');}
/* 주사위 2개 */
setup(2,0,{sn:0,ld:0,dc:1});{const t=H.turn;act(t,{t:'roll'});eq(H.sl.mv.d.length,2,'two dice');eq(H.sl.mv.path.length,H.sl.mv.d[0]+H.sl.mv.d[1],'sum steps')}
/* 시간 초과: 저절로 굴림 */
setup(2,0,{sn:0,ld:0,turn:10});{const t=H.turn;pass(10200);eq(!!H.sl.mv||H.sl.pos[t]>1,true,'auto roll on timeout')}
/* 항복: 설치 중이면 남은 것 없음, 굴리는 중이면 다음 사람. 남은 한 사람은 승리 */
setup(3);{act(1,{t:'surrender'});eq(H.players[1].finished,true,'surrendered');eq(H.sl.left[1].join(),'0,0','no stock');eq(H.players[1].rank,3,'last rank');
  act(2,{t:'surrender'});eq(H.phase,'over','last one wins');eq(H.players[0].rank,1,'winner')}
setup(3,0,{sn:0,ld:0});{const t=H.turn;act(t,{t:'roll'});act(t,{t:'surrender'});eq(H.sl.mv,null,'move cancelled');eq(H.turn,(t+1)%3,'next player');eq(snapFor(0).sl.out[t],1,'out')}
/* 주사위 물리: 정해진 눈이 위로 (무늬를 미리 돌림), 판 안에서 멈춤 */
{let bad=0;for(let s=1;s<=30;s++){let a=s;const rnd=()=>{a=(a*16807)%2147483647;return a/2147483647};
  const r=TT.simThrow(TT.throwStarts(1+s%2,[0,.85,2.1],[0,0,-1],rnd));
  for(const p of r.pos)if(Math.abs(p[0])>2.5||Math.abs(p[2])>2.5)bad++;
  if(r.dur>2.7)bad++}
  eq(bad,0,'dice stay on board')}
/* 봇만으로 여러 판 (판 크기·개수·정확히 도착·주사위 수 조합) */
{let over=0,ticks=0;
  for(let rep=0;rep<24;rep++){
    setup(2+rep%3,1,{sz:rep%4,sn:1+rep%3,ld:1+(rep>>1)%3,len:1+rep%4,exact:rep%2,dc:(rep>>2)%2,stime:30},rep%3);
    for(let k=0;k<16000&&H.phase==='play';k++){NOW+=250;engineTick();ticks++;
      if(!H.players[0].bot&&H.sl.ph==='play'&&H.turn===0&&!H.sl.mv)act(0,{t:'roll'})}
    if(H.phase==='over')over++;else fail('snakes bot game did not finish rep '+rep);
    const u=new Set();for(const it of H.sl.items){if(u.has(it.a)||u.has(it.b))fail('snakes shared end');u.add(it.a);u.add(it.b)}
  }
  eq(over,24,'all bot games over');console.log('snakes bot games',over,'avg ticks',Math.round(ticks/24));}
