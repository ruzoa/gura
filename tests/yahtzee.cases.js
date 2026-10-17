/* 야추다이스 테스트 (tests/engine.test.js가 이 파일을 불러서 { } 블록 안에서 돌림)
   앞에서 정해져 있는 것: Y(=GAMES.yahtzee), calc·allowed·totals 등(_test), fail(), hostNew·hostStart·engineTick 등 공통 엔진 */
const {CATS,calc,allowed,totals,jokerOf,plan,bestFor,isY,mkSc,view}=Y._test;
const eq=(a,b,m)=>{if(a!==b)fail('yahtzee '+m+': '+a+' != '+b)};
const same=(a,b,m)=>{if(JSON.stringify(a)!==JSON.stringify(b))fail('yahtzee '+m+': '+JSON.stringify(a)+' != '+JSON.stringify(b))};

/* 점수 계산 */
eq(calc('full',[2,2,3,3,3],false),25,'full house');
eq(calc('full',[4,4,4,4,4],false),0,'five of a kind is not full house');
eq(calc('full',[4,4,4,4,4],true),25,'joker full house');
eq(calc('full',[2,2,3,3,4],false),0,'two pair is not full house');
eq(calc('small',[1,2,3,4,6],false),30,'small straight');
eq(calc('small',[3,3,4,5,6],false),30,'small straight with pair');
eq(calc('small',[1,2,3,5,6],false),0,'no small straight');
eq(calc('large',[2,3,4,5,6],false),40,'large straight');
eq(calc('large',[1,2,3,4,6],false),0,'no large straight');
eq(calc('large',[1,1,1,1,1],true),40,'joker large straight');
eq(calc('three',[3,3,3,1,2],false),12,'three of a kind');
eq(calc('three',[3,3,1,1,2],false),0,'no three of a kind');
eq(calc('four',[5,5,5,5,1],false),21,'four of a kind');
eq(calc('four',[5,5,5,1,1],false),0,'no four of a kind');
eq(calc('three',[5,5,5,5,5],false),25,'five counts as three of a kind');
eq(calc('yahtzee',[6,6,6,6,6],false),50,'yahtzee');
eq(calc('yahtzee',[6,6,6,6,5],false),0,'not yahtzee');
eq(calc('n4',[4,4,1,4,2],false),12,'upper fours');
eq(calc('n1',[2,3,4,5,6],false),0,'upper ones none');
eq(calc('chance',[1,2,3,4,5],false),15,'chance');
if(isY([0,0,0,0,0]))fail('yahtzee blank dice are not a yahtzee');

/* 윗칸 보너스·합계 */
{const sc=mkSc();[3,6,9,12,15,18].forEach((v,k)=>{sc['n'+(k+1)]=v});
 let t=totals(sc,0);eq(t.upper,63,'upper 63');eq(t.bonus,35,'bonus at 63');eq(t.total,98,'total with bonus');
 sc.n1=2;t=totals(sc,0);eq(t.bonus,0,'no bonus at 62');
 sc.chance=20;sc.yahtzee=50;t=totals(sc,100);eq(t.lower,70,'lower sum');eq(t.total,62+70+100,'total with yahtzee bonus')}

/* 조커 규칙 (추가 야추) */
{const sc=mkSc();
 eq(allowed(sc,[3,3,3,3,3]).length,13,'first yahtzee: all boxes open');
 sc.yahtzee=50;
 same(allowed(sc,[3,3,3,3,3]),['n3'],'joker forces matching upper box');
 sc.n3=9;
 const a=allowed(sc,[3,3,3,3,3]);
 if(a.some(x=>x[0]==='n')||a.length!==6)fail('yahtzee joker lower boxes '+a);
 CATS.filter(c=>!c.up).forEach(c=>{sc[c.id]=0});
 const b=allowed(sc,[3,3,3,3,3]);
 if(b.some(x=>x==='n3')||b.length!==5||b.some(x=>x[0]!=='n'))fail('yahtzee joker upper fallback '+b);
 const sc2=mkSc();sc2.yahtzee=0;
 eq(jokerOf(sc2,[2,2,2,2,2]),true,'joker applies even after scratching yahtzee')}

/* 엔진 도우미 */
const mk=(o,n,bots)=>{
  hostNew(false,'t','t');H.cfg={...cfgFor('yahtzee'),...o,game:'yahtzee'};
  H.members=Array.from({length:n||2},(_,i)=>({name:'p'+i,bot:!!bots,conn:null,host:i===0,lv:1}));
  hostStart();
};
const filled=i=>CATS.filter(c=>H.y.sc[i][c.id]!==null).length;

/* 설정 */
{const c=cfgFor('yahtzee');
 if(c.turn!==60||c.max!==4)fail('yahtzee cfg defaults '+JSON.stringify(c));
 if(roomSetOf(Y).find(d=>d.k==='max').hi!==4)fail('yahtzee max players');
 if(Y.cfgSum(c)===''||Y.cfgChips(c)==='')fail('yahtzee cfg text')}

/* 시작·규칙 위반 무시·굴림·고정·기록 */
{mk({},2);
 eq(H.y.rounds,13,'classic rounds');
 if(H.players.some(p=>p.hand.length!==1))fail('yahtzee hand marker');
 const t=H.turn,o=1-t;
 Y.engine.act(o,{t:'roll'});eq(H.y.rolled,false,'roll out of turn ignored');
 Y.engine.act(t,{t:'score',cat:'chance'});eq(H.y.sc[t].chance,null,'score before roll ignored');
 Y.engine.act(t,{t:'roll'});
 eq(H.y.rolled,true,'first roll');eq(H.y.left,2,'rolls left');eq(H.y.rl,1,'roll counter');
 if(H.y.dice.some(v=>!(v>=1&&v<=6)))fail('yahtzee dice range '+H.y.dice);
 H.y.dice=[1,2,3,4,5];
 Y.engine.act(t,{t:'roll',keep:[true,true,false,false,false]});
 eq(H.y.dice[0],1,'held die 0 stays');eq(H.y.dice[1],2,'held die 1 stays');eq(H.y.left,1,'rolls left after second');
 same(H.y.held,[true,true,false,false,false],'held mask');
 Y.engine.act(t,{t:'roll',keep:[true,true,true,true,true]});eq(H.y.left,1,'keeping all dice is not a roll');
 Y.engine.act(t,{t:'roll',keep:'abc'});eq(H.y.left,0,'bad keep rolls everything');
 Y.engine.act(t,{t:'roll'});eq(H.y.left,0,'no fourth roll');
 for(const bad of ['__proto__','constructor','','nope',7,null,{}]){Y.engine.act(t,{t:'score',cat:bad});if(H.turn!==t)fail('yahtzee bad category accepted '+String(bad))}
 H.y.dice=[2,2,3,4,6];
 Y.engine.act(t,{t:'score',cat:'chance'});
 eq(H.y.sc[t].chance,17,'chance recorded');eq(H.y.done[t],1,'turn counted');
 if(H.turn!==o)fail('yahtzee turn did not pass');
 eq(H.y.left,3,'new turn rolls');eq(H.y.rolled,false,'new turn not rolled');same(H.y.dice,[0,0,0,0,0],'new turn dice cleared');
 if(!H.log[0][0].includes('쓰리')&&!H.log[0][0].includes('찬스'))fail('yahtzee log '+H.log[0][0]);
 // 같은 칸에 두 번 기록할 수 없음
 H.y.sc[o].chance=5;Y.engine.act(o,{t:'roll'});Y.engine.act(o,{t:'score',cat:'chance'});eq(H.y.sc[o].chance,5,'filled box not overwritten');
 if(H.turn!==o)fail('yahtzee refilled box passed turn')}

/* 추가 야추 보너스: 야추 50점 뒤에 또 나오면 +100 */
{mk({},2);
 const t=H.turn;
 H.y.sc[t].yahtzee=50;H.y.rolled=true;H.y.left=2;H.y.dice=[4,4,4,4,4];
 Y.engine.act(t,{t:'score',cat:'n3'});eq(H.y.sc[t].n3,null,'joker must use matching upper box');
 Y.engine.act(t,{t:'score',cat:'n4'});
 eq(H.y.sc[t].n4,20,'joker upper score');eq(H.y.yb[t],100,'yahtzee bonus');
 // 야추를 0점으로 기록했다면 보너스 없음
 const u=H.turn;H.y.sc[u].yahtzee=0;H.y.rolled=true;H.y.dice=[5,5,5,5,5];Y.engine.act(u,{t:'score',cat:'n5'});eq(H.y.yb[u],0,'no bonus after scratching yahtzee');
 // 첫 야추를 야추 칸에 기록해도 보너스는 없음
 mk({},2);const w=H.turn;H.y.rolled=true;H.y.dice=[6,6,6,6,6];Y.engine.act(w,{t:'score',cat:'yahtzee'});eq(H.y.sc[w].yahtzee,50,'yahtzee scored');eq(H.y.yb[w],0,'first yahtzee has no bonus')}

/* 빠른 모드 없음: 방 설정에 fast가 있어도 13라운드 */
{if(!Y.noFast)fail('yahtzee noFast flag');
 mk({fast:1},2);eq(H.y.rounds,13,'fast ignored');
 let guard=0;while(H.phase==='play'&&guard++<200){const t=H.turn;Y.engine.act(t,{t:'roll'});Y.engine.act(t,{t:'score',cat:allowed(H.y.sc[t],H.y.dice)[0]})}
 eq(H.phase,'over','game ends');
 if(filled(0)!==13||filled(1)!==13)fail('yahtzee filled '+filled(0)+','+filled(1))}

/* 컵 흔들기: 차례인 사람만, 굴리면 풀림, 흔든 주사위 표시가 스냅샷에 실림, 규칙에는 영향 없음 */
{mk({},2);
 const t=H.turn,o=1-t;
 Y.engine.act(o,{t:'shake'});eq(H.y.sh,0,'shake out of turn ignored');
 Y.engine.act(t,{t:'shake',keep:[true,true,true,true,true]});eq(H.y.sh,1,'first shake');same(H.y.shk,[false,false,false,false,false],'first shake throws all');
 let s={};Y.engine.snap(s,t,clock());eq(s.y.sh,1,'snap shake');
 Y.engine.act(t,{t:'roll'});eq(H.y.sh,0,'roll clears shake');eq(H.y.left,2,'roll after shake');
 Y.engine.act(t,{t:'shake',keep:[true,true,true,true,true]});eq(H.y.sh,0,'keeping all is not a shake');
 Y.engine.act(t,{t:'shake',keep:[true,false,false,false,false]});eq(H.y.sh,1,'second shake');same(H.y.shk,[true,false,false,false,false],'shake keep');
 // 흔드는 중에 시간이 지나면 흔든 대로 굴리고 기록
 const d0=H.y.dice[0];NOW=H.deadline+1;engineTick();
 if(H.turn===t)fail('yahtzee shake timeout did not pass turn');
 eq(H.y.sh,0,'new turn shake cleared')}

/* 봇은 흔든 뒤에 굴림 */
{mk({},2,true);
 const t=H.turn;H.players[t].bot=true;H.players[t].lv=2;H.botActAt=NOW;
 engineTick();eq(H.y.sh,1,'bot shakes first');eq(H.y.rolled,false,'bot not rolled yet');
 NOW=H.botActAt;engineTick();eq(H.y.rolled,true,'bot rolls after shaking');eq(H.y.sh,0,'bot shake cleared');
 if(H.botActAt-NOW<2700)fail('yahtzee bot waits for the roll animation')}

/* 제한 시간: 남은 굴림과 기록을 알아서 처리하고 차례가 넘어감 */
{mk({},3);
 const t=H.turn;NOW=H.deadline+1;engineTick();
 eq(filled(t),1,'timeout records one box');eq(H.y.done[t],1,'timeout counts the turn');
 if(H.turn===t||H.phase!=='play')fail('yahtzee turn after timeout');
 if(H.players[t].finished||H.players[t].surrendered)fail('yahtzee timeout must not eliminate');
 // 굴린 뒤 시간이 지나도 마찬가지
 const t2=H.turn;Y.engine.act(t2,{t:'roll'});NOW=H.deadline+1;engineTick();
 eq(filled(t2),1,'timeout after a roll');if(H.turn===t2)fail('yahtzee turn after timeout 2')}

/* 연결이 끊긴 사람은 일정 시간 뒤 봇이 대신 둠 */
{mk({},2);
 const t=H.turn,p=H.players[t];p.bot=true;p.away=true;p.awayAt=NOW;H.botActAt=NOW;
 engineTick();eq(H.y.rolled,false,'away player waits before bot acts');
 NOW+=AWAY_WAIT+1;engineTick();eq(H.y.sh,1,'bot takes over after away wait (shakes)');
 NOW=H.botActAt;engineTick();eq(H.y.rolled,true,'bot rolls after away wait')}

/* 항복 */
{mk({},3);
 const t=H.turn;Y.engine.act(t,{t:'surrender'});
 const p=H.players[t];
 if(!p.finished||!p.surrendered||p.rank!==3||p.hand.length)fail('yahtzee surrender '+JSON.stringify([p.finished,p.surrendered,p.rank]));
 if(H.phase!=='play'||H.turn===t||H.players[H.turn].finished)fail('yahtzee turn after surrender');
 eq(snapFor(t).ps[t].sr,1,'surrender snap');
 const t2=H.turn;Y.engine.act(t2,{t:'surrender'});
 eq(H.phase,'over','game ends when one player is left');
 const ranks=H.players.map(x=>x.rank).sort();same(ranks,[1,2,3],'surrender ranks');
 eq(H.players.find(x=>!x.surrendered).rank,1,'survivor wins')}

/* 끝: 총점 순위, 같은 점수는 같은 순위 */
{const setup=()=>{mk({},2);CATS.forEach(c=>{if(c.id!=='chance')for(const i of [0,1])H.y.sc[i][c.id]=0});H.y.done=[12,12]};
 setup();
 let t=H.turn;H.y.rolled=true;H.y.dice=[4,4,4,4,4];Y.engine.act(t,{t:'score',cat:'chance'});
 let o=H.turn;if(o===t)fail('yahtzee last turns');
 H.y.rolled=true;H.y.dice=[4,4,4,4,4];Y.engine.act(o,{t:'score',cat:'chance'});
 eq(H.phase,'over','game over after last turns');
 same(H.players.map(p=>p.rank),[1,1],'tied ranks');
 setup();t=H.turn;o=1-t;
 H.y.rolled=true;H.y.dice=[1,1,1,1,1];Y.engine.act(t,{t:'score',cat:'chance'});
 H.y.rolled=true;H.y.dice=[5,5,5,5,5];Y.engine.act(H.turn,{t:'score',cat:'chance'});
 eq(H.players[o].rank,1,'higher total wins');eq(H.players[t].rank,2,'lower total second');
 eq(H.players.every(p=>p.finished&&p.hand.length===0),true,'everyone finished');
 const s=snapFor(0);eq(s.st,'over','snap over');
 if(!H.log[0][0].includes('우승'))fail('yahtzee end log '+H.log[0][0])}

/* 방장이 보내는 상태 */
{mk({},3);
 const s=snapFor(1);
 eq(s.y.sc.length,3,'snap scoreboards');eq(s.y.sc[0].length,13,'snap boxes');eq(s.y.d.length,5,'snap dice');
 eq(s.y.rd,13,'snap rounds');eq(s.gr,0,'snap grace');
 if(typeof s.dl!=='number'||s.dl<=0||s.dl>60000)fail('yahtzee snap deadline '+s.dl);
 if(s.ps.some(p=>p.c!==1))fail('yahtzee snap hand marker');
 eq(typeof JSON.stringify(s),'string','snap serializable');
 // 방장이 새로고침한 뒤에도 같은 상태로 이어짐
 const saved=JSON.parse(JSON.stringify(H));eq(saved.y.sc.length,3,'saved host state')}

/* 봇 판단 */
{const sc=mkSc();
 for(const lv of [0,1,2]){
   const p=plan(sc,[6,6,6,6,6],2,lv);eq(p.cat,'yahtzee','bot takes a yahtzee lv'+lv);
   const q=plan(sc,[2,3,4,5,6],2,lv);   // 보통은 가끔 쉬움처럼 두므로 어려움만 확실히 따짐
   if(lv===2&&q.cat!=='large')fail('yahtzee bot keeps large straight lv'+lv+' '+JSON.stringify(q));
   if(!q.cat&&!(q.keep&&q.keep.length===5))fail('yahtzee bot plan shape lv'+lv+' '+JSON.stringify(q));
   const r=plan(sc,[5,5,5,5,2],2,lv);
   if(!r.keep||r.keep.slice(0,4).some(x=>!x)||r.keep[4])fail('yahtzee bot keeps four fives lv'+lv+' '+JSON.stringify(r));
   const z=plan(sc,[1,2,4,5,6],0,lv);if(!z.cat||allowed(sc,[1,2,4,5,6]).indexOf(z.cat)<0)fail('yahtzee bot last roll lv'+lv+' '+JSON.stringify(z));
 }
 // 칸이 하나만 남으면 그 칸
 const one=mkSc();CATS.forEach(c=>{if(c.id!=='four')one[c.id]=0});
 for(const lv of [0,1,2])eq(plan(one,[1,1,2,3,4],0,lv).cat,'four','bot last box lv'+lv)}

/* 봇 세기: 혼자 13칸을 채웠을 때 평균 (어려움 > 보통 > 쉬움) */
function soloGame(lv){
  const sc=mkSc();let yb=0;
  for(let r=0;r<13;r++){
    let dice=Array.from({length:5},()=>1+(Math.random()*6|0)),left=2;
    for(let g=0;g<4;g++){
      const pl=plan(sc,dice,left,lv);
      if(pl.keep&&left>0){dice=dice.map((v,i)=>pl.keep[i]?v:1+(Math.random()*6|0));left--;continue}
      const cat=pl.cat||allowed(sc,dice)[0];
      if(isY(dice)&&sc.yahtzee===50)yb+=100;
      sc[cat]=calc(cat,dice,jokerOf(sc,dice));break;
    }
  }
  return totals(sc,yb).total;
}
{const avg=(lv,n)=>{let s=0;for(let i=0;i<n;i++)s+=soloGame(lv);return s/n};
 const a0=avg(0,150),a1=avg(1,120),a2=avg(2,60);
 console.log('yahtzee bot averages (easy, normal, hard)',a0.toFixed(0),a1.toFixed(0),a2.toFixed(0));
 if(!(a1>a0+15))fail('yahtzee normal bot should beat easy '+a0+' '+a1);
 if(!(a2>a1+15))fail('yahtzee hard bot should beat normal '+a1+' '+a2);
 if(a2<190)fail('yahtzee hard bot too weak '+a2);
 if(a0>185)fail('yahtzee easy bot too strong '+a0)}

/* 화면을 만드는 함수 (DOM 없이 글만 확인) */
{
  globalThis.esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  globalThis.myIdx=()=>V&&V.ps&&Number.isInteger(V.you)&&V.you>=0&&V.you<V.ps.length?V.you:-1;
  globalThis.myReady=()=>{const i=myIdx();return !!(V&&V.st==='play'&&V.t===i&&i>=0&&V.ps[i]&&!V.ps[i].f&&V.ps[i].c>0)};
  mk({},3);
  const t=H.turn,o=(t+1)%3;
  const load=you=>{globalThis.PV=globalThis.V||null;globalThis.V={...snapFor(you),graceAt:0,deadAt:NOW+30000};view.preView()};
  globalThis.V=null;globalThis.PV=null;
  load(t);
  let bd=view.boardHTML();
  if(!bd.includes('p0')||!bd.includes('p1')||!bd.includes('p2'))fail('yahtzee board names');
  if(bd.includes('data-c='))fail('yahtzee board clickable before roll');
  if(!view.diceHTML().includes('blank'))fail('yahtzee blank dice before roll');
  if(!view.hintText(t).includes('굴리기'))fail('yahtzee hint before roll '+view.hintText(t));
  Y.engine.act(t,{t:'roll'});load(t);
  bd=view.boardHTML();
  eq((bd.match(/data-c=/g)||[]).length,13,'board shows 13 choices on my turn');
  if(!view.diceHTML().includes('class="die v'))fail('yahtzee dice faces');
  view.setCat('chance');
  if(!view.boardHTML().includes('sel'))fail('yahtzee selected box not marked');
  if(!view.hintText(t).includes('찬스'))fail('yahtzee hint with selection '+view.hintText(t));
  // 다른 사람 화면에서는 고를 수 없음
  load(o);
  if(view.boardHTML().includes('data-c='))fail('yahtzee other player can pick');
  if(!view.hintText(o).includes('차례'))fail('yahtzee hint other turn '+view.hintText(o));
  // 관전
  load(-1);
  if(view.boardHTML().includes('data-c='))fail('yahtzee spectator can pick');
  if(!view.hintText(-1).includes('관전'))fail('yahtzee spectator hint '+view.hintText(-1));
  // 끝난 판: 점수 요약
  H.phase='over';H.players.forEach((p,i)=>{p.rank=i+1;p.finished=true;p.hand=[]});load(0);
  const ex=view.overExtra();
  if(!ex.includes('최종 점수')||!ex.includes('p0')||!ex.includes('p2'))fail('yahtzee over summary');
  globalThis.V=null;globalThis.PV=null;
}


/* 3D 연출용 물리: 트레이 밖으로 나가지 않고, 바닥에 놓이고, 방장이 정한 눈이 위로 오게 돌릴 수 있음 */
{const P=Y._test.phys;
 let seed=11;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647};
 const dir=[-.55,0,-.835],dl=Math.hypot(dir[0],dir[2]);dir[0]/=dl;dir[2]/=dl;
 let flat=0,tot=0,slow=0;
 for(let t=0;t<60;t++){
   const n=1+t%5,statics=[];for(let i=n;i<5;i++)statics.push(P.slotPos(i));
   const r=P.simThrow(P.throwStarts(n,[1.08,.86,-.46],dir,rnd),statics);
   if(r.dur>3.4)slow++;
   if(r.frames.length<2||r.frames[0].length!==n*7)fail('yahtzee sim frames');
   r.fin.forEach((q,i)=>{
     tot++;const p=r.pos[i];
     if(Math.hypot(p[0],p[2])>P.EDGE_R+.02)fail('yahtzee die left the felt '+p);
     if(p[1]<P.FLOOR+P.DH-.05)fail('yahtzee die sank '+p[1]);
     if(P.qrot(q,P.FACE_N[P.topFace(q)])[1]>.99)flat++;
     for(let want=1;want<=6;want++)if(P.topFace(P.qmul(q,P.preRot(q,want)))!==want)fail('yahtzee preRot '+want);
   });
 }
 if(flat<tot*.9)fail('yahtzee dice not lying flat '+flat+'/'+tot);
 if(slow)fail('yahtzee sim too long '+slow);
 for(let v=1;v<=6;v++){const q=P.restQ(v,[.3,.2,.1,.9]);if(P.topFace(q)!==v)fail('yahtzee restQ '+v)}
 // 칸 정렬: 눈이 작은 것부터, 같은 눈은 주사위 번호 순
 same(P.slotOrder([5,2,6,2,1]),[3,1,4,2,0],'slot order');same(P.slotOrder([3,3,3,3,3]),[0,1,2,3,4],'slot order ties')}

/* 봇끼리 끝까지: 인원·모드·난이도를 바꿔 가며, 점수판·순위가 맞는지 확인 */
function playOutY(n,over,lvs){
  mk(over,n,true);
  H.members.forEach((m,i)=>{m.lv=lvs[i%lvs.length]});
  H.players.forEach((p,i)=>{p.lv=lvs[i%lvs.length]});
  let ticks=0,guard=0;
  while(H.phase!=='over'&&guard++<60000){
    NOW+=250;engineTick();ticks++;
    if(H.phase==='play'&&H.players[H.turn].finished){fail('yahtzee turn on finished');return ticks}
    if(H.y.left<0||H.y.left>3){fail('yahtzee rolls left '+H.y.left);return ticks}
  }
  if(H.phase!=='over'){fail('yahtzee stuck n='+n+' cfg='+JSON.stringify(over));return ticks}
  const rounds=13;
  for(let i=0;i<n;i++){
    if(filled(i)!==rounds)fail('yahtzee filled '+filled(i)+' != '+rounds);
    if(H.y.done[i]!==rounds)fail('yahtzee turns '+H.y.done[i]+' != '+rounds);
  }
  const tot=H.players.map((p,i)=>totals(H.y.sc[i],H.y.yb[i]).total);
  H.players.forEach((p,i)=>{
    const r=1+tot.filter(x=>x>tot[i]).length;
    if(p.rank!==r)fail('yahtzee rank '+p.rank+' != '+r+' totals '+tot);
  });
  return ticks;
}
globalThis.playOutY=playOutY;
