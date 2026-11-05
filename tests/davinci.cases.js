/* 다빈치코드 테스트 (tests/engine.test.js가 이 파일을 불러서 { } 블록 안에서 돌림) */
const TT=DV._test,E=DV.engine,DV_GAMES=80;
const eq=(a,b,m)=>{if(a!==b)fail('davinci '+m+': '+a+' != '+b)};
const pass=ms=>{for(let k=0;k<ms/50;k++){NOW+=50;engineTick()}};
const setup=(n,bots,cfg)=>{
  hostNew(false,'t','t');H.cfg={...cfgFor('davinci'),game:'davinci',...cfg};
  H.members=[];for(let i=0;i<n;i++)H.members.push(bots&&i>=bots?{name:'b'+i,bot:true,conn:null,host:false,lv:0}:{name:'p'+i,bot:false,conn:i?{}:null,host:i===0,cid:i?'c'+i:''});
  hostStart();H.dealUntil=0;
};
const ID=(c,v)=>c*13+v,T_=(id,u,o)=>({u,id,o:o?1:0,w:[]});
/* 판을 정해 둠: 0번 차례 */
const board=(rks,pool)=>{const O=H.dv;O.rk=rks.map(r=>r.slice());O.pool=pool||[];H.players.forEach((p,i)=>{p.finished=false;p.rank=null;p.hand=[0]});E.tick;H.turn=0;O.held=null;O.g=null;O.res=null;O.ph=O.pool.length?'draw':'guess';H.deadline=NOW+30000};
const PT=(id,u)=>({u,id,x:0,z:0,r:0});
const guess=(s,t,u,v)=>{E.act(s,{t:'guess',s:t,u,v});pass(TT.SHOW_MS+50)};
/* 구성 */
for(const [n,k] of [[2,4],[3,4],[4,3]]){setup(n);eq(H.dv.rk.every(r=>r.length===k),true,n+' tiles');eq(H.dv.pool.length,26-n*k,n+' pool');eq(H.dv.rk.flat().some(t=>TT.valOf(t.id)===TT.JOKER),false,n+' no start joker')}
setup(2,0,{joker:0});eq(H.dv.pool.length,16,'no joker pool');eq(H.dv.pool.some(t=>TT.valOf(t.id)===TT.JOKER),false,'joker off');
/* 정렬: 같은 숫자는 흑이 왼쪽, 조커가 있으면 자리가 여럿 */
setup(2);{const r=H.dv.rk[0];for(let i=1;i<r.length;i++)if(TT.sortKey(r[i-1].id)>TT.sortKey(r[i].id))fail('davinci sorted')}
eq(TT.legalSlots([T_(ID(1,3),1)],ID(0,3)).join(),'0','black left');
eq(TT.legalSlots([T_(ID(0,3),1)],ID(1,3)).join(),'1','white right');
eq(TT.legalSlots([T_(ID(0,2),1),T_(ID(0,TT.JOKER),2),T_(ID(0,8),3)],ID(0,5)).join(),'1,2','slots around joker');
eq(TT.legalSlots([T_(ID(0,2),1)],ID(1,TT.JOKER)).join(),'0,1','joker anywhere');
/* 숨김: 남의 숨은 타일 값이 어디에도 없음 */
for(let k=0;k<20;k++){setup(3);const s=snapFor(1),o=s.o;
  o.rk.forEach((r,i)=>r.forEach(t=>{if(i!==1&&t.v!=null)fail('davinci hidden value')}));
  if(o.rk[1].some(t=>t.v==null))fail('davinci own value');
  if(o.pool.some(t=>'v' in t||'id' in t))fail('davinci pool leak');
  if(JSON.stringify(o).includes('"id"'))fail('davinci id leak');
  E.act(H.turn,{t:'draw',u:H.dv.pool[0].u});const q=snapFor((H.turn+1)%3).o;if(q.held.v!=null)fail('davinci held leak');const me=snapFor(H.turn).o;if(me.held.v==null)fail('davinci own held')}
setup(2);{const o=snapFor(-1).o;if(o.rk.flat().some(t=>t.v!=null))fail('davinci spectator')}
/* 차례가 아니면 못 함, 뽑기 전에는 추리 못 함 */
setup(2);board([[T_(ID(0,1),1),T_(ID(0,5),2)],[T_(ID(0,2),3),T_(ID(0,7),4)]],[PT(ID(1,4),9),PT(ID(1,6),10)]);
E.act(1,{t:'draw',u:9});eq(H.dv.pool.length,2,'not turn');E.act(0,{t:'guess',s:1,u:3,v:2});eq(H.dv.ph,'draw','draw first');
E.act(0,{t:'draw',u:99});eq(H.dv.held,null,'bad draw');
E.act(0,{t:'draw',u:9});eq(H.dv.held.u,9,'drew');eq(H.dv.ph,'guess','to guess');
E.act(0,{t:'guess',s:0,u:1,v:1});eq(H.dv.ph,'guess','no self guess');
/* 판정 전에는 결과가 없음 → 맞히면 공개·계속/멈춤, 멈추면 숨겨서 놓음 */
E.act(0,{t:'guess',s:1,u:3,v:2});eq(H.dv.ph,'show','show');eq(H.dv.rk[1][0].o,0,'not yet open');
pass(TT.SHOW_MS+50);eq(H.dv.ph,'res','res');eq(H.dv.rk[1][0].o,1,'opened');pass(TT.RES_MS+50);eq(H.dv.ph,'cont','cont');
E.act(0,{t:'cont',go:1});eq(H.dv.ph,'guess','continue');eq(H.dv.held.u,9,'still held');
guess(0,1,4,3);eq(H.dv.rk[1][1].o,0,'wrong stays');eq(H.dv.rk[1][1].w.join(),'3','wrong noted');pass(TT.RES_MS+50);
eq(H.dv.rk[0].find(t=>t.u===9).o,1,'wrong opens held');eq(H.turn,1,'next turn');eq(H.dv.rk[0].map(t=>t.u).join(),'1,9,2','held sorted');
/* 멈춤: 숨겨서 놓음 */
setup(2);board([[T_(ID(0,1),1)],[T_(ID(0,2),3),T_(ID(0,7),4)]],[PT(ID(1,4),9)]);
E.act(0,{t:'draw',u:9});guess(0,1,3,2);pass(TT.RES_MS+50);E.act(0,{t:'cont',go:0});eq(H.dv.rk[0].find(t=>t.u===9).o,0,'stop hidden');eq(H.turn,1,'stop next');
/* 조커 뽑으면 놓을 자리 고르기, 틀린 자리는 무시 */
setup(2);board([[T_(ID(0,1),1),T_(ID(0,5),2)],[T_(ID(0,2),3),T_(ID(0,7),4)]],[PT(ID(1,TT.JOKER),9)]);
E.act(0,{t:'draw',u:9});guess(0,1,3,9);pass(TT.RES_MS+50);eq(H.dv.ph,'place','joker place');
eq(snapFor(1).o.at,null,'slots private');E.act(0,{t:'place',at:9});eq(H.dv.ph,'place','bad slot');
E.act(0,{t:'place',at:1});eq(H.dv.rk[0][1].u,9,'joker placed');eq(H.dv.rk[0][1].o,1,'joker open');
/* 조커 맞히기 */
setup(2);board([[T_(ID(0,1),1)],[T_(ID(0,TT.JOKER),3),T_(ID(0,7),4)]],[PT(ID(1,4),9)]);E.act(0,{t:'draw',u:9});guess(0,1,3,TT.JOKER);eq(H.dv.rk[1][0].o,1,'joker guess');
/* 남은 패가 없으면 뽑기 없이 추리, 틀리면 내 타일 공개 */
setup(2);board([[T_(ID(0,1),1),T_(ID(0,5),2)],[T_(ID(0,2),3),T_(ID(0,7),4)]],[]);
eq(H.dv.ph,'guess','no pool');guess(0,1,3,9);pass(TT.RES_MS+50);eq(H.dv.ph,'reveal','reveal');E.act(0,{t:'reveal',u:2});eq(H.dv.rk[0][1].o,1,'revealed');eq(H.turn,1,'after reveal');
/* 숨은 타일이 하나면 저절로 공개 → 탈락 → 승리 */
setup(2);board([[T_(ID(0,1),1)],[T_(ID(0,2),3)]],[]);guess(0,1,3,9);pass(TT.RES_MS+50);eq(H.phase,'over','self out');eq(H.players[1].rank,1,'other wins');
/* 맞혀서 끝: 순위 */
setup(3);board([[T_(ID(0,1),1),T_(ID(0,9),5)],[T_(ID(0,2),3)],[T_(ID(0,3),4)]],[]);
guess(0,1,3,2);pass(TT.RES_MS+50);eq(H.players[1].rank,3,'first out third');eq(H.players[1].finished,true,'out');eq(H.dv.ph,'cont','go on');E.act(0,{t:'cont',go:1});
guess(0,2,4,3);pass(TT.RES_MS+50);eq(H.phase,'over','game over');eq(H.players[2].rank,2,'second');eq(H.players[0].rank,1,'winner');
{const o=snapFor(1).o;if(o.rk.flat().some(t=>t.v==null))fail('davinci over reveal')}
/* 시간 초과: 뽑기·추리 무작위, 계속 고르기는 멈춤 */
setup(2);board([[T_(ID(0,1),1)],[T_(ID(0,2),3),T_(ID(0,7),4)]],[PT(ID(1,4),9)]);pass(31000);if(!H.dv.held&&H.turn===0&&H.dv.ph==='draw')fail('davinci draw timeout');
setup(2);board([[T_(ID(0,1),1)],[T_(ID(0,2),3),T_(ID(0,7),4)]],[PT(ID(1,4),9)]);E.act(0,{t:'draw',u:9});guess(0,1,3,2);pass(TT.RES_MS+50);H.deadline=NOW+10;pass(100);eq(H.turn,1,'cont timeout stops');eq(H.dv.rk[0].find(t=>t.u===9).o,0,'timeout hidden');
/* 항복: 내 차례면 넘어감, 집은 타일은 패로 돌아감 */
setup(3);board([[T_(ID(0,1),1)],[T_(ID(0,2),3)],[T_(ID(0,3),4)]],[PT(ID(1,4),9)]);E.act(0,{t:'draw',u:9});E.act(0,{t:'surrender'});eq(H.players[0].finished,true,'surrender');eq(H.dv.pool.length,1,'held back');eq(H.turn,1,'turn moved');eq(H.dv.rk[0][0].o,1,'surrender open');
/* 추리 중 대상이 항복 */
setup(3);board([[T_(ID(0,1),1)],[T_(ID(0,2),3)],[T_(ID(0,3),4)]],[]);E.act(0,{t:'guess',s:1,u:3,v:2});E.act(1,{t:'surrender'});pass(TT.SHOW_MS+50);eq(H.dv.ph,'guess','target left');eq(H.turn,0,'guesser keeps');
/* 봇 대전: 타일 보존, 언제나 끝남 */
for(let g=0;g<DV_GAMES;g++){
  setup(2+g%3,1);H.players[0].bot=true;H.players[0].cid='';H.botActAt=NOW+1;
  for(let k=0;k<60000&&H.phase==='play';k++){NOW+=100;engineTick();
    const O=H.dv,n=O.rk.flat().length+O.pool.length+(O.held?1:0);if(n!==(H.cfg.joker?26:24)){fail('davinci tiles lost '+n);break}
    if(k%37===0)O.rk.forEach(r=>{const L=r.filter(t=>TT.valOf(t.id)!==TT.JOKER);for(let i=1;i<L.length;i++)if(TT.sortKey(L[i-1].id)>TT.sortKey(L[i].id))fail('davinci order')})}
  eq(H.phase,'over','bot game ends');
  eq(H.players.filter(p=>p.rank===1).length,1,'one winner');
}
/* 봇 난이도: 어려움은 남의 숨은 값 없이 추론함 (값을 바꿔도 같은 공개 정보면 판단 범위가 같음), 좁혀지면 정답 확률이 높음 */
setup(2);board([[T_(ID(0,0),1)],[T_(ID(0,3),3,1),T_(ID(0,4),4),T_(ID(0,5),5,1)]],[]);H.players[0].bot=true;H.players[0].lv=2;
{const g=TT.hardGuess(0);eq(g.u,4,'hard picks forced tile');eq(g.v,4,'hard reads neighbours');if(g.p<.45)fail('davinci hard p '+g.p)}
/* 단계별 대전 */
{const duel=(a,b,N)=>{let w=0,ms=0,mv=0;for(let g=0;g<N;g++){
    setup(2,1);const P=H.players,sw=g%2;P[0].bot=true;P[0].cid='';P[0].lv=sw?b:a;P[1].lv=sw?a:b;H.botActAt=NOW+1;
    for(let k=0;k<60000&&H.phase==='play';k++){NOW+=200;engineTick()}
    if(H.phase!=='over'){fail('davinci duel stuck');continue}
    if(P[sw?1:0].rank===1)w++}return w};
  const N=120,t0=Date.now(),ne=duel(1,0,N),he=duel(2,0,N),hn=duel(2,1,N);
  console.log('davinci normal/easy',ne,'hard/easy',he,'hard/normal',hn,'of',N,'ms',Date.now()-t0);
  if(ne<N*.55||he<N*.6||hn<N*.55)fail('davinci levels too close')}
