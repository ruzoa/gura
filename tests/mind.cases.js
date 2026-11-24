/* 더 마인드 테스트 (tests/engine.test.js가 이 파일을 불러서 { } 블록 안에서 돌림) */
const TT=MD._test;
const eq=(a,b,m)=>{if(a!==b)fail('mind '+m+': '+a+' != '+b)};
const pass=ms=>{for(let k=0;k<ms/50;k++){NOW+=50;engineTick()}};
const setup=(n,bots)=>{
  hostNew(false,'t','t');H.cfg={...cfgFor('mind'),game:'mind'};
  H.members=[];for(let i=0;i<n;i++)H.members.push(bots&&i>=bots?{name:'b'+i,bot:true,conn:null,host:false,lv:0}:{name:'p'+i,bot:false,conn:i?{}:null,host:i===0,cid:i?'c'+i:''});
  hostStart();pass(DEAL_MS+100);
};
const act=(s,a)=>MD.engine.act(s,a);
const holdAll=()=>{H.players.forEach((p,i)=>act(i,{t:'hold',on:true}));pass(TT.HOLD_MS+200)};
const setHands=(...L)=>{L.forEach((h,i)=>H.players[i].hand=h.slice())};
const put=(s,id)=>{act(s,{t:'up',id});act(s,{t:'put',id})};
/* 인원별 구성 */
for(const [n,lv] of [[2,12],[3,10],[4,8]]){setup(n);eq(H.md.top,lv,n+' top');eq(H.md.lives,n,n+' lives');eq(H.md.stars,1,n+' stars');eq(H.players.every(p=>p.hand.length===1),true,n+' deal');eq(H.md.ph,'focus',n+' focus')}
/* 모두 함께 눌러야 시작, 떼면 다시 */
setup(2);act(0,{t:'hold',on:true});pass(1000);eq(H.md.ph,'focus','one hold waits');
act(1,{t:'hold',on:true});pass(200);act(1,{t:'hold',on:false});pass(1000);eq(H.md.ph,'focus','release resets');
act(1,{t:'hold',on:true});pass(TT.HOLD_MS+200);eq(H.md.ph,'play','all hold starts');
/* 패 숨김 */
setup(2);holdAll();setHands([10,20],[30,40]);put(0,10);
{const s=snapFor(1),j=JSON.stringify(s.o);eq(s.t,undefined,'no turn');eq(s.ps[0].h===undefined||s.ps[0].h===null,true,'other hand hidden');if(j.includes('"my":10'))fail('mind raised id leaked')}
/* 올린 카드: 상대에게는 올렸다는 것만, 내려놓기, 올리지 않은 카드는 못 냄 */
setup(2);holdAll();setHands([10,20],[30,40]);
act(0,{t:'put',id:10});pass(300);eq(H.md.pile.length,0,'must raise first');
act(0,{t:'up',id:20});eq(snapFor(1).o.ups[0],1,'raise visible');eq(snapFor(1).o.my,-1,'other my empty');eq(snapFor(0).o.my,20,'own raised');
act(0,{t:'down'});eq(H.md.up[0],-1,'lower');
/* 순서대로 내면 통과, 다음 레벨은 카드가 늘어남 */
setup(2);holdAll();setHands([10],[30]);put(0,10);pass(200);eq(H.md.pile.length,1,'played');put(1,30);pass(200);eq(H.md.show.k,'clear','level clear');pass(TT.CLEAR_MS+200);eq(H.md.lv,2,'level 2');pass(DEAL_MS+100);eq(H.players[0].hand.length,2,'two cards');eq(H.md.lives,2,'no life lost');
/* 실수: 생명 -1, 작은 카드 모두 버림, 다시 집중 */
setup(3);holdAll();setHands([10,50],[20,60],[30]);put(2,30);pass(200);eq(H.md.lives,2,'miss life');eq(H.md.show.c.map(c=>c.v).join(),'10,20','miss list');eq(H.players[0].hand.join(),'50','lower gone');pass(TT.MISS_MS+200);eq(H.md.ph,'focus','miss refocus');eq(H.md.lv,1,'same level');
/* 내 손의 작은 카드도 버림 */
setup(2);holdAll();setHands([10,50],[60]);put(0,50);pass(200);eq(H.md.lives,1,'own lower miss');eq(H.players[0].hand.length,0,'own lower gone');
/* 실수로 패가 다 없어지면 통과 */
setup(2);holdAll();setHands([10],[50]);put(1,50);pass(200);eq(H.md.lives,1,'miss then');pass(TT.MISS_MS+200);eq(H.md.show&&H.md.show.k,'clear','miss clears level');
/* 생명이 없으면 끝 */
setup(2);holdAll();H.md.lives=1;setHands([10],[50,60]);put(1,50);pass(TT.MISS_MS+300);eq(H.phase,'over','out of lives');eq(H.md.res.why,'fail','fail why');eq(H.players[0].rank,1,'team rank');
/* 거의 동시: 뒤에 온 작은 카드도 숫자순으로 놓임 */
setup(2);holdAll();setHands([10],[30,40]);put(1,30);NOW+=TT.BATCH_MS-60;put(0,10);pass(250);eq(H.md.lives,2,'batch no miss');eq(H.md.pile.map(c=>c.v).join(),'10,30','batch order');
setup(2);holdAll();setHands([10],[30,40]);put(1,30);pass(400);eq(H.md.lives,1,'late is miss');
/* 표창: 모두 켜야 쓰고 끄면 안 씀, 각자 가장 낮은 카드 버림 */
setup(2);holdAll();setHands([10,70],[20,80]);act(0,{t:'star',on:true});pass(200);eq(H.md.stars,1,'one star waits');act(0,{t:'star',on:false});act(1,{t:'star',on:true});pass(200);eq(H.md.stars,1,'off cancels');
act(0,{t:'star',on:true});pass(200);eq(H.md.stars,0,'star used');eq(H.players[0].hand.join(),'70','star low');eq(H.md.show.k,'star','star show');pass(TT.MISS_MS+200);eq(H.md.ph,'focus','star refocus');eq(H.md.st.some(Boolean),false,'lamps off');
holdAll();act(0,{t:'star',on:true});eq(H.md.st[0],false,'no star no lamp');
/* 봇은 사람이 켜면 따라 켬 */
setup(2,1);pass(2500);act(0,{t:'hold',on:true});pass(TT.HOLD_MS+800);eq(H.md.ph,'play','bot holds');setHands([98,99],[97]);TT.plan();act(0,{t:'star',on:true});pass(3000);eq(H.md.st[1]||H.md.stars===0,true,'bot follows star');
/* 봇 3단계: 이름은 공통(쉬움·보통·어려움), 협력이라 쉬움이 잘하는 봇 */
eq(!!MD.oneBotLv,false,'levels shown');eq(botLvNames(MD).join(),'쉬움,보통,어려움','level names');
{const B=TT.BOT;eq(B.length,3,'three levels');
 if(!(B[0].hi-B[0].lo<B[1].hi-B[1].lo&&B[1].hi-B[1].lo<B[2].hi-B[2].lo))fail('mind noise order');
 if(!(B[0].fit>B[1].fit&&B[2].fit===0))fail('mind fit order');
 eq(JSON.stringify([B[2].min,B[2].base,B[2].lo,B[2].hi,B[2].add,B[2].lead]),JSON.stringify([900,0,.65,1.4,500,[500,1000]]),'hard = old bot');}
const lvSet=(...L)=>L.forEach((v,k)=>{H.players[k+1].lv=v});
/* 기다리는 시간: 단계마다 식 안 */
for(const lv of [0,1,2]){const B=TT.BOT[lv];
  for(let r=0;r<40;r++){setup(2,1);lvSet(lv);holdAll();setHands([99],[30]);TT.plan();
    const b=H.md.bp[1],w=b.at-NOW,base=Math.max(B.min,B.base+31*TT.TEMPO);
    if(w<base*B.lo-1||w>base*B.hi+B.add+1)fail('mind wait lv'+lv+' '+w);
    if(b.upAt>b.at||b.at-b.upAt>B.lead[1]+1)fail('mind lead lv'+lv)}}
/* 공개된 정보만: 같은 무작위 값이면 사람 패를 바꿔도 봇 계획이 같음 */
{const R=Math.random;
 for(const lv of [0,1,2]){
  const plans=[];
  for(const hh of [[5,6],[60,70]]){setup(2,1);lvSet(lv);holdAll();setHands(hh,[40,90]);let k=0;Math.random=()=>((k++*0.37)%1);TT.plan();const b=H.md.bp[1];plans.push(JSON.stringify([b.id,b.at-NOW,b.upAt-NOW]));Math.random=R}
  eq(plans[0],plans[1],'public only lv'+lv)}
 Math.random=R}
/* 사람 박자 익히기: 쉬움 많이, 보통 조금, 어려움 안 함. 블라인드는 숫자가 안 보여 안 익힘 */
setup(4,1);lvSet(0,1,2);holdAll();setHands([20],[90],[95],[99]);TT.plan();
NOW+=450+21*200;put(0,20);pass(200);eq(H.md.pile.length,1,'fit played');
{const bt=H.md.bt;if(Math.abs(bt[1]-160)>1)fail('mind fit easy '+bt[1]);if(Math.abs(bt[2]-136)>1)fail('mind fit normal '+bt[2]);eq(bt[3],TT.TEMPO,'fit hard none')}
setup(2,1);lvSet(0);holdAll();setHands([3],[90]);TT.plan();NOW+=3000;put(0,3);pass(200);eq(H.md.bt[1],TT.TEMPO,'fit skips close numbers');
setup(2,1);lvSet(0);H.md.blind=1;holdAll();setHands([20],[90]);TT.plan();NOW+=450+21*200;put(0,20);pass(200);eq(H.md.bt[1],TT.TEMPO,'fit not in blind');
/* 사람이 카드를 올리면: 쉬움 봇은 확실히 작으면 서두르고 확실히 크면 기다림, 다른 단계는 그대로 */
{const at0=(lv,botId,lift)=>{setup(2,1);lvSet(lv);holdAll();setHands([50],[botId]);TT.plan();H.md.pt=NOW-3000;H.md.bp[1]={id:botId,at:NOW+(lift==='late'?5000:500),upAt:NOW+(lift==='late'?4000:400)};act(0,{t:'up',id:50});return H.md.bp[1]};
 let b=at0(0,12,'late');if(!(b.at<=NOW+350&&b.upAt<=NOW))fail('mind look hurry');
 b=at0(0,80,'soon');if(!(b.at>=NOW+1600&&b.at<=NOW+2000))fail('mind look wait '+(b.at-NOW));
 b=at0(0,30,'late');eq(b.at,NOW+5000,'mind look unsure keeps');
 for(const lv of [1,2]){b=at0(lv,12,'late');eq(b.at,NOW+5000,'look off lv'+lv)}
 setup(2,1);lvSet(0);H.md.blind=1;holdAll();setHands([50],[12]);TT.plan();H.md.pt=NOW-3000;H.md.bp[1]={id:12,at:NOW+5000,upAt:NOW+4000};act(0,{t:'up',id:50});eq(H.md.bp[1].at,NOW+5000,'look not in blind');}
/* 봇이 올린 카드는 다른 봇이 보지 않음 */
setup(3,1);lvSet(0,0);holdAll();setHands([95],[12],[80]);TT.plan();H.md.pt=NOW-3000;
H.md.bp[1]={id:12,at:NOW+2000,upAt:NOW};H.md.bp[2]={id:80,at:NOW+500,upAt:NOW+400};const at2=H.md.bp[2].at;NOW+=50;engineTick();eq(H.md.up[1],12,'bot lifted');eq(H.md.bp[2]&&H.md.bp[2].at,at2,'bots ignore bot lift');
/* 쉬움 봇은 생명이 1개면 한 레벨에 한 번 먼저 표창을 켜고, 그동안 카드를 내지 않음 */
setup(2,1);lvSet(0);holdAll();H.md.lives=1;setHands([50,60],[70,80]);TT.plan();pass(1200);
eq(H.md.st[1],true,'easy asks star');eq(H.md.bp[1],null,'asking holds cards');
pass(TT.ASK_MS);eq(H.md.st[1],false,'ask times out');if(!H.md.bp[1])fail('mind replans after ask');eq(H.md.stars,1,'star kept');
const asked=H.md.asked;pass(1500);eq(H.md.st[1],false,'asks once per level');eq(asked,1,'asked flag');
setup(2,1);lvSet(0);holdAll();H.md.lives=1;setHands([50,60],[70,80]);TT.plan();pass(1200);eq(H.md.st[1],true,'ask again');act(0,{t:'star',on:true});pass(200);eq(H.md.stars,0,'agree uses star');eq(H.players[1].hand.join(),'80','star dropped bot low');
for(const lv of [1,2]){setup(2,1);lvSet(lv);holdAll();H.md.lives=1;setHands([50,60],[70,80]);TT.plan();pass(1200);eq(H.md.st[1],false,'no ask lv'+lv)}
setup(2,1);lvSet(0);holdAll();setHands([50,60],[70,80]);TT.plan();pass(1200);eq(H.md.st[1],false,'no ask with 2 lives');
/* 봇이 먼저 켠 표창을 다른 봇이 따라 켬(봇끼리만) */
setup(3,0);H.players.forEach((p,i)=>{p.bot=true;p.conn=null;p.lv=i===1?0:2});H.md.lives=1;setHands([70,71],[72,73],[74,75]);
pass(2500);eq(H.md.ph,'play','bots start');pass(800+2700);eq(H.md.stars,0,'bots follow bot ask');eq(H.md.lives,1,'bots no miss');
/* 예전 상태(박자·표창 기다림 값 없음)에서도 봇이 냄 */
setup(2,1);holdAll();delete H.md.bt;delete H.md.ask;setHands([98],[5]);TT.plan();pass(3000);eq(H.players[1].hand.length,0,'old state bot plays');
/* 보상과 최대치 */
setup(2);H.md.lv=2;holdAll();setHands([10],[30]);put(0,10);pass(200);put(1,30);pass(200);eq(H.md.stars,2,'level 2 star');
setup(2);H.md.lv=3;H.md.lives=5;holdAll();setHands([10],[30]);put(0,10);pass(200);put(1,30);pass(200);eq(H.md.lives,5,'life cap');
/* 끝 레벨 → 블라인드: 숫자 숨김, 끝날 때 순서 확인 */
setup(2);H.md.lv=12;holdAll();setHands([10],[30]);put(0,10);pass(200);put(1,30);pass(TT.CLEAR_MS+400);eq(H.md.blind,1,'blind on');eq(H.md.lv,1,'blind level 1');pass(DEAL_MS+100);holdAll();
setHands([50],[20]);put(0,50);pass(200);eq(snapFor(1).o.pv,null,'blind hidden');eq(JSON.stringify(snapFor(1).o).includes('50'),false,'blind value hidden');eq(H.md.lives,2,'blind no live miss');put(1,20);pass(200);eq(H.md.lives,1,'blind check');eq(H.md.show.k,'blind','blind show');
setup(2);H.md.blind=1;H.md.won=1;H.md.lv=12;holdAll();setHands([10],[30]);put(0,10);pass(200);put(1,30);pass(TT.CLEAR_MS+400);eq(H.phase,'over','all done');eq(H.md.res.why,'win','win');
/* 항복 */
/* 탈주·나가기 길 (항복 버튼은 없음) */
setup(3);MD.engine.act(1,{t:'surrender'});eq(H.phase,'over','surrender ends');eq(H.players[1].rank,2,'quitter');eq(H.md.res.why,'surrender','why');
/* 봇끼리 끝까지: 인원별로 언제나 끝나고 카드가 틀어지지 않음 */
let mdMax=0;
for(let rep=0;rep<24;rep++){
  const n=2+rep%3;setup(n,1);H.players.forEach((p,i)=>{if(i)p.lv=(rep+i)%3});
  for(let k=0;k<20000&&H.phase==='play';k++){
    NOW+=100;
    if(H.md.ph==='focus')act(0,{t:'hold',on:true});
    if(H.md.ph==='play'&&H.players[0].hand.length&&H.md.q.length===0){const id=H.players[0].hand[0];if(id-Math.max(0,H.md.last)<8||Math.random()<.01)put(0,id)}
    engineTick();
    const seen=new Set();for(const p of H.players)for(const v of p.hand){if(seen.has(v))fail('mind duplicate card');seen.add(v)}
  }
  eq(H.phase,'over','bots finish n='+n);mdMax=Math.max(mdMax,H.md.lv);
}
if(!mdMax)fail('mind never reached a level');
