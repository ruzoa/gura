/* ===== 야추다이스 게임 모듈 =====
   공통 코드(index.html)가 GAMES.yahtzee의 함수를 불러서 이 게임의 규칙·봇·화면을 그림.
   주사위 5개, 한 차례에 최대 3번 굴리고, 13칸 점수판에 기록해서 총점으로 순위를 정함 (턴제, 최대 4명).
   칸 id: n1~n6(윗칸), three, four, full, small, large, yahtzee, chance(아랫칸). 점수판은 칸 순서(CATS)대로 배열로도 주고받음.
   손패(hand)는 카드가 아니라 '점수판 1장'을 뜻하는 표시: 공통 코드가 hand가 비면 끝난 사람으로 보기 때문에 게임 중에는 [0]으로 둠 */
(function(){
const G={id:'yahtzee',name:'야추다이스',short:'야추',lead:'주사위를 굴려 족보를 채우는 게임',brand:'야추',brandPx:62,maxHi:4};

/* ---------- 규칙 (방장 엔진과 화면이 같은 함수를 씀) ---------- */
const CATS=[
  {id:'n1',name:'1의 눈',rule:'1의 눈만 더합니다',up:true},
  {id:'n2',name:'2의 눈',rule:'2의 눈만 더합니다',up:true},
  {id:'n3',name:'3의 눈',rule:'3의 눈만 더합니다',up:true},
  {id:'n4',name:'4의 눈',rule:'4의 눈만 더합니다',up:true},
  {id:'n5',name:'5의 눈',rule:'5의 눈만 더합니다',up:true},
  {id:'n6',name:'6의 눈',rule:'6의 눈만 더합니다',up:true},
  {id:'three',name:'쓰리 카드',rule:'같은 눈 3개 이상이면 눈 전체 합',up:false},
  {id:'four',name:'포 카드',rule:'같은 눈 4개 이상이면 눈 전체 합',up:false},
  {id:'full',name:'풀하우스',rule:'같은 눈 3개 + 2개면 25점',up:false},
  {id:'small',name:'스몰 스트레이트',short:'S 스트레이트',rule:'4개 연속이면 30점',up:false},
  {id:'large',name:'라지 스트레이트',short:'L 스트레이트',rule:'5개 연속이면 40점',up:false},
  {id:'yahtzee',name:'야추',rule:'5개 모두 같은 눈이면 50점',up:false},
  {id:'chance',name:'찬스',rule:'조건 없이 눈 전체 합',up:false}
];
const byId={};CATS.forEach(c=>{byId[c.id]=c});
const PCOL=['#c53026','#2b65ca','#1f7a2e','#c9831a'];
const UPPER_BONUS=63,UPPER_PTS=35,YAHTZEE_BONUS=100;
const mkSc=()=>{const s={};CATS.forEach(c=>{s[c.id]=null});return s};
const counts=d=>{const c=[0,0,0,0,0,0,0];d.forEach(v=>{c[v]++});return c};
const sum=d=>d.reduce((a,b)=>a+b,0);
const isY=d=>d.length===5&&d[0]>0&&d.every(v=>v===d[0]);
function hasRun(d,len){
  const s=new Set(d);let best=0,cur=0;
  for(let i=1;i<=6;i++){if(s.has(i)){cur++;if(cur>best)best=cur}else cur=0}
  return best>=len;
}
/* 이 주사위로 칸 id에 기록하면 몇 점인가. joker: 야추를 50점으로 기록한 뒤 나온 추가 야추 (풀하우스·스트레이트를 정해진 점수로 쳐 줌) */
function calc(id,d,joker){
  const c=counts(d),mx=Math.max.apply(null,c.slice(1));
  if(id[0]==='n'){const n=+id[1];return n*c[n]}
  switch(id){
    case 'three':return mx>=3?sum(d):0;
    case 'four':return mx>=4?sum(d):0;
    case 'full':return (joker||(c.indexOf(3)>0&&c.indexOf(2)>0))?25:0;
    case 'small':return (joker||hasRun(d,4))?30:0;
    case 'large':return (joker||hasRun(d,5))?40:0;
    case 'yahtzee':return isY(d)?50:0;
    case 'chance':return sum(d);
  }
  return 0;
}
const jokerOf=(sc,d)=>isY(d)&&sc.yahtzee!==null;
/* 지금 기록할 수 있는 칸. 추가 야추(조커 규칙): 같은 눈의 윗칸이 비어 있으면 거기만, 아니면 빈 아랫칸 아무 곳, 아랫칸도 다 찼으면 빈 윗칸 아무 곳 */
function allowed(sc,d){
  const open=CATS.filter(c=>sc[c.id]===null).map(c=>c.id);
  if(jokerOf(sc,d)){
    const up='n'+d[0];
    if(open.indexOf(up)>=0)return [up];
    const low=open.filter(id=>id[0]!=='n');
    if(low.length)return low;
    return open;
  }
  return open;
}
function totals(sc,yb){
  let upper=0,lower=0;
  CATS.forEach(c=>{const v=sc[c.id];if(v!==null){if(c.up)upper+=v;else lower+=v}});
  const bonus=upper>=UPPER_BONUS?UPPER_PTS:0;
  return {upper,bonus,lower,yb:yb||0,total:upper+bonus+lower+(yb||0)};
}
const roundsOf=fast=>fast?7:13;

/* ---------- 봇 ---------- */
/* 주사위 5개의 눈 조합은 252가지. 남길 눈을 정하면 다시 굴렸을 때 어느 조합이 얼마의 확률로 나오는지 미리 셀 수 있음 */
const POW=[1,6,36,216,1296,7776];
const codeOf=d=>{let c=0;for(const v of d)c+=POW[v-1];return c};
const MS=[],MSI=new Map();
(function(){
  const d=[0,0,0,0,0];
  (function rec(k,mn){
    if(k===5){MSI.set(codeOf(d),MS.length);MS.push(d.slice());return}
    for(let v=mn;v<=6;v++){d[k]=v;rec(k+1,v)}
  })(0,1);
})();
const msIdx=d=>MSI.get(codeOf(d));
const RR=new Map();
function rerollDist(held){   // held: 오름차순으로 정렬된, 남길 눈들
  const key=held.join('');
  let r=RR.get(key);if(r)return r;
  const k=5-held.length,base=held.reduce((a,v)=>a+POW[v-1],0),N=Math.pow(6,k),acc=new Map();
  for(let t=0;t<N;t++){
    let x=t,c=base;
    for(let j=0;j<k;j++){c+=POW[x%6];x=(x/6)|0}
    acc.set(c,(acc.get(c)||0)+1);
  }
  const idx=[],p=[];
  for(const e of acc){idx.push(MSI.get(e[0]));p.push(e[1]/N)}
  r={idx:Int16Array.from(idx),p:Float64Array.from(p)};
  RR.set(key,r);return r;
}
/* 칸마다 '보통 이 정도는 나온다'는 점수. 기록한 점수가 이보다 높을수록 이득, 낮으면 손해로 쳐서 칸을 고름
   윗칸은 눈 3개씩(63점 보너스 기준)을 기준으로 두고, 보너스가 걸려 있어서 조금 더 크게 침 */
const BASE={three:21.7,four:13.1,full:22.6,small:29.5,large:32.7,yahtzee:16.9,chance:22};
const catVal=(id,pts)=>id[0]==='n'?1.4*(pts-3*(+id[1])):pts-BASE[id];
/* 이 주사위를 지금 기록한다면 가장 좋은 칸과 그 가치 (추가 야추 보너스 포함) */
function bestFor(sc,d){
  const joker=jokerOf(sc,d);
  let best=null,bv=-1e9;
  for(const id of allowed(sc,d)){
    const v=catVal(id,calc(id,d,joker));
    if(v>bv){bv=v;best=id}
  }
  if(isY(d)&&sc.yahtzee===50)bv+=YAHTZEE_BONUS;
  return {cat:best,val:bv};
}
/* 남길 눈의 서로 다른 조합 (같은 눈이 여러 개면 같은 조합) */
function holdsOf(d){
  const out=new Map();
  for(let m=0;m<32;m++){
    const h=[];for(let j=0;j<5;j++)if(m&(1<<j))h.push(d[j]);
    h.sort((a,b)=>a-b);
    const k=h.join('');if(!out.has(k))out.set(k,h);
  }
  return out;
}
/* W[조합 번호]가 '다시 굴린 뒤의 가치'일 때, 가장 좋은 남기기 */
function bestHold(d,W){
  let be=-1e9,bh=null;
  for(const h of holdsOf(d).values()){
    if(h.length===5)continue;
    const r=rerollDist(h);let e=0;
    for(let k=0;k<r.idx.length;k++)e+=r.p[k]*W[r.idx[k]];
    if(e>be){be=e;bh=h}
  }
  return {e:be,held:bh};
}
/* 남길 눈 목록에 맞게 실제 주사위 자리를 고름 */
function keepMask(dice,held){
  const need=held.slice(),mask=[false,false,false,false,false];
  dice.forEach((v,j)=>{const k=need.indexOf(v);if(k>=0){need.splice(k,1);mask[j]=true}});
  return mask;
}
function rawBest(sc,dice,al){
  const j=jokerOf(sc,dice);let best=al[0],bp=-1;
  for(const c of al){const p=calc(c,dice,j);if(p>bp){bp=p;best=c}}
  return best;
}
/* 쉬움: 가장 많이 나온 눈을 남기고, 마지막엔 점수가 가장 높은 칸 (가끔 엉뚱한 칸) */
function planEasy(sc,dice,left){
  const al=allowed(sc,dice);
  if(!al.length)return {};
  const c=counts(dice);let bv=1,bc=0;
  for(let v=1;v<=6;v++)if(c[v]>bc||(c[v]===bc&&v>bv)){bc=c[v];bv=v}
  if(left<=0||bc>=5){
    if(left<=0&&Math.random()<.18&&al.length>1)return {cat:al[Math.random()*al.length|0]};
    return {cat:rawBest(sc,dice,al)};
  }
  return {keep:dice.map(v=>v===bv)};
}
/* lv 0 쉬움, 1 보통(한 번 더 굴린 결과만 계산하고, 가끔 쉬움처럼 둠), 2 어려움(두 번 더 굴리는 것까지 계산)
   돌려주는 값: {keep: 남길 주사위 5칸} 또는 {cat: 기록할 칸} */
const LV1_SLIP=.5;   // 보통 봇이 쉬움처럼 두는 비율 (혼자 13칸을 채우면 평균 쉬움 약 145점, 보통 약 195점, 어려움 약 240점)
function plan(sc,dice,left,lv){
  if(!allowed(sc,dice).length)return {};
  if(lv<=0||(lv===1&&Math.random()<LV1_SLIP))return planEasy(sc,dice,left);
  const cur=bestFor(sc,dice);
  if(left<=0)return {cat:cur.cat};
  const V0=MS.map(d=>bestFor(sc,d).val);
  let W=V0;
  if(lv>=2&&left>=2)W=MS.map((d,k)=>Math.max(V0[k],bestHold(d,V0).e));
  const h=bestHold(dice,W);
  if(h.held&&h.e>cur.val+1e-9)return {keep:keepMask(dice,h.held)};
  return {cat:cur.cat};
}

/* ---------- 규칙 설명·방 설정 ---------- */
G.rulesHTML='<ol class="rules"><li><b>목표</b> : 주사위 5개로 13칸짜리 점수판을 채워서 <b>총점이 가장 높은 사람</b>이 승리합니다</li><li><b>내 차례</b> : 주사위를 최대 3번 굴립니다. 굴린 뒤 남길 주사위를 눌러 <b>고정</b>하면 나머지만 다시 굴립니다</li><li><b>기록</b> : 굴리기를 멈추고 아직 비어 있는 칸 하나에 점수를 기록합니다. 조건이 맞지 않으면 0점으로 기록할 수도 있습니다</li><li><b>윗칸</b> : 고른 눈(1~6)만 더합니다. 윗칸 소계가 63점 이상이면 <b>보너스 35점</b>을 받습니다 (눈마다 3개씩 모으면 63점)</li><li><b>아랫칸</b> : 쓰리 카드(같은 눈 3개 이상, 눈 전체 합) · 포 카드(4개 이상, 눈 전체 합) · 풀하우스(3개 + 2개, 25점) · 스몰 스트레이트(4개 연속, 30점) · 라지 스트레이트(5개 연속, 40점) · 야추(5개 모두 같은 눈, 50점) · 찬스(조건 없음, 눈 전체 합)</li><li><b>야추 보너스</b> : 야추를 50점으로 기록한 뒤 또 야추가 나오면 <b>100점</b>을 더 받습니다. 이때는 같은 눈의 윗칸이 비어 있으면 그 칸에 기록해야 하고, 윗칸이 차 있으면 빈 아랫칸 아무 곳에 기록합니다. 풀하우스와 스트레이트는 정해진 점수를 받습니다</li><li><b>빠른 모드</b> : 13칸 중 원하는 7칸만 채우는 7라운드로 끝냅니다</li><li><b>제한 시간</b> : 내 차례에 제한 시간이 지나면 남은 굴림과 기록을 알아서 처리합니다. 연결이 끊긴 사람은 봇이 대신 합니다</li><li><b>항복</b> : 항복하면 점수와 상관없이 가장 낮은 순위가 됩니다</li></ol>';
G.modeDesc=['13칸을 모두 채움','13칸 중 7칸만 채움 (7라운드)'];
G.defaults={max:4,turn:45};
G.roomSet=[
  {k:'turn',label:'제한 시간',unit:'초',lo:15,hi:180,step:5,desc:'내 차례에 제한 시간이 지나면 남은 굴림과 기록을 알아서 처리합니다. 연결이 끊긴 사람은 봇이 대신 합니다'}];
G.ruleSet=[];
G.cfgChips=c=>`<span class="chip">제한 시간 <b>${+c.turn||45}초</b></span>`;
G.cfgSum=c=>`제한 시간 ${+c.turn||45}초`;
G.roomSub=x=>`제한 시간 ${x.tn||45}초`;
G.pubExtra=c=>({tn:+c.turn||45});
G.cardInfo=(c,nowN)=>{
  const r=roundsOf(c.fast),n=Math.max(2,Math.min(4,nowN));
  return `<p class="cardinfo">지금 ${nowN}명이면 한 사람이 ${r}번씩, 모두 ${n*r}번 차례를 돕니다.${nowN>4?'<br>야추다이스는 최대 4명까지 할 수 있습니다.':''}</p>`;
};
G.rankTitle=()=>'';
G.finLabel=()=>'완료';
G.noEmotes=['gq'];
G.keys={yroll:'KeyC'};
G.keyActions=[{a:'yroll',n:'주사위 굴리기',d:'주사위를 굴립니다. 고정한 주사위는 그대로 둡니다'}];
/* 이 게임에는 카드가 없음 (공통 코드가 부르는 자리만 채움) */
G.cardHTML=()=>'';G.drawFace=()=>{};G.cmpCard=()=>0;G.labelOf=()=>'';

/* ---------- 방장 엔진 (규칙 처리) ---------- */
function nextP(i){
  const n=H.players.length,Y=H.y;
  for(let k=1;k<=n;k++){const j=(i+k)%n;if(!H.players[j].finished&&Y.done[j]<Y.rounds)return j}
  return -1;
}
function startTurn(i){
  const Y=H.y;
  if(i<0){endGame();return}
  H.turn=i;H.graceUntil=0;
  H.deadline=clock()+H.cfg.turn*1000;
  H.botActAt=H.players[i].bot?clock()+rand(900,1800):0;
  Y.dice=[0,0,0,0,0];Y.held=[false,false,false,false,false];Y.left=3;Y.rolled=false;Y.tn++;
  mark();
}
/* keep: 남길 주사위 5칸(true = 남김). 첫 굴림에는 모두 굴림 */
function doRoll(i,keep){
  const Y=H.y;
  if(Y.left<=0)return false;
  const k=Y.rolled?keep.slice(0,5).map(Boolean):[false,false,false,false,false];
  while(k.length<5)k.push(false);
  if(Y.rolled&&k.every(Boolean))return false;
  Y.held=k;
  for(let j=0;j<5;j++)if(!k[j])Y.dice[j]=1+(Math.random()*6|0);
  Y.left--;Y.rolled=true;Y.rl++;
  mark();return true;
}
function doScore(i,cat){
  const Y=H.y,p=H.players[i],d=Y.dice;
  if(!Y.rolled||typeof cat!=='string'||!CATS.some(c=>c.id===cat)||Y.sc[i][cat]!==null)return false;
  if(allowed(Y.sc[i],d).indexOf(cat)<0)return false;
  const pts=calc(cat,d,jokerOf(Y.sc[i],d));
  let note='';
  if(isY(d)&&Y.sc[i].yahtzee===50){Y.yb[i]+=YAHTZEE_BONUS;note=` (야추 보너스 +${YAHTZEE_BONUS})`}
  Y.sc[i][cat]=pts;Y.done[i]++;
  Y.lm={p:i,c:cat,pt:pts,d:d.slice()};
  H.seatNote[i]=`${byId[cat].name} ${pts}점`;
  addLog(`${p.name} ${byId[cat].name} ${pts}점${note}`);
  startTurn(nextP(i));
  return true;
}
const totalOf=i=>totals(H.y.sc[i],H.y.yb[i]).total;
/* 끝: 항복하지 않은 사람끼리 총점 순위 (같은 점수는 같은 순위), 항복한 사람은 그 아래 */
function endGame(){
  const act=H.players.map((p,i)=>i).filter(i=>!H.players[i].surrendered),tot=act.map(totalOf);
  act.forEach((i,k)=>{H.players[i].rank=1+tot.filter(t=>t>tot[k]).length});
  H.players.forEach(p=>{p.finished=true;p.hand=[]});
  const best=act.length?Math.max.apply(null,tot):0,win=act.filter((i,k)=>tot[k]===best);
  addLog(win.length===1?`게임 종료. ${H.players[win[0]].name} 우승! (${best}점)`:'게임 종료','sys');
  H.phase='over';mark();
  H.players.forEach((p,i)=>{if(p.bot&&Math.random()<.5)botEmote(i,'gg',800+Math.random()*1600)});
}
function doSurrender(i){
  if(H.phase!=='play'||i<0||H.players[i].finished)return;
  const p=H.players[i];
  p.hand=[];p.finished=true;p.surrendered=true;p.rank=H.rankBottom--;
  H.seatNote[i]='항복';
  addLog(`${p.name} 항복! ${p.rank}위`,'lie');
  if(H.players.filter(x=>!x.finished).length<=1){endGame();return}
  if(H.turn===i)startTurn(nextP(i));else mark();
}
/* 한 번 굴리거나 기록하는 봇의 한 동작 */
function botStep(i){
  const Y=H.y;
  if(!Y.rolled){doRoll(i,[]);H.botActAt=clock()+rand(900,1600);return}
  const pl=plan(Y.sc[i],Y.dice,Y.left,botLv(H.players[i]));
  if(pl.keep&&doRoll(i,pl.keep)){H.botActAt=clock()+rand(900,1600);return}
  const cat=pl.cat||bestFor(Y.sc[i],Y.dice).cat||allowed(Y.sc[i],Y.dice)[0];
  doScore(i,cat);
}
/* 제한 시간이 지났을 때: 남은 굴림과 기록을 한꺼번에 알아서 처리 */
function autoFinish(i){
  const Y=H.y;
  for(let g=0;g<6;g++){
    if(!Y.rolled){doRoll(i,[]);continue}
    const pl=plan(Y.sc[i],Y.dice,Y.left,1);
    if(pl.keep&&doRoll(i,pl.keep))continue;
    const cat=pl.cat||bestFor(Y.sc[i],Y.dice).cat||allowed(Y.sc[i],Y.dice)[0];
    if(doScore(i,cat))return;
  }
  const c=allowed(Y.sc[i],Y.dice)[0];if(c)doScore(i,c);
}
function timeout(){
  const i=H.turn,p=H.players[i];
  if(!p.bot)addLog(`${p.name} 시간 초과. 남은 굴림과 기록을 자동으로 처리합니다.`,'sys');
  autoFinish(i);
}
/* 테스트(tests/engine.test.js)에서 직접 부르는 내부 함수 */
G._test={CATS,calc,allowed,totals,jokerOf,plan,bestFor,doRoll,doScore,doSurrender,autoFinish,timeout,botStep,rerollDist,msIdx,MS,roundsOf,hasRun,counts,isY,mkSc,
  view:{turnHTML,diceHTML,rollHTML,boardHTML,hintText,preView:()=>G.preView(),overExtra:()=>G.overExtra(),setCat:c=>{yCat=c},getCat:()=>yCat,getHold:()=>yHold.slice(),setHold:h=>{yHold=h.slice()}}};
G.engine={
  /* 게임 시작: 공통 코드가 H.players를 만든 뒤 부름 */
  start(){
    const n=H.players.length,cnt=Math.max(2,Math.min(n,4)),rounds=roundsOf(H.cfg.fast);
    Object.assign(H,{phase:'play',log:[],seatNote:{},field:[],last:null,reveal:null,shouts:[],pending:null,rankNext:1,rankBottom:cnt,known:{}});
    const Y={n,cnt,rounds,sc:[],yb:[],done:[],dice:[0,0,0,0,0],held:[false,false,false,false,false],left:3,rolled:false,rl:0,tn:0,lm:null,first:0};
    H.players.forEach((p,i)=>{
      Y.sc.push(mkSc());Y.yb.push(0);
      if(i<cnt){Y.done.push(0);p.hand=[0]}
      else{Y.done.push(rounds);p.hand=[];p.finished=true;p.rank=i+1}   // 자리가 모자라면(5명 이상) 구경만 함 (보통은 최대 인원 4명이라 생기지 않음)
    });
    H.y=Y;
    const first=Math.random()*cnt|0;Y.first=first;
    addLog(`${cnt}명 게임 시작 (${rounds}라운드). ${H.players[first].name}부터 시작합니다.`,'sys');
    startTurn(first);
  },
  act(seat,a){
    if(a.t==='surrender'){doSurrender(seat);return}
    if(H.phase!=='play'||seat<0||H.turn!==seat)return;
    if(a.t==='roll'){
      doRoll(seat,Array.isArray(a.keep)?a.keep:[]);
    }else if(a.t==='score'){
      if(typeof a.cat!=='string')return;
      doScore(seat,a.cat);
    }
  },
  tick(t){
    if(H.phase!=='play')return;
    const cur=H.players[H.turn];
    if(t>=H.deadline)timeout();
    else if(cur.bot&&H.botActAt&&t>=H.botActAt&&!(cur.away&&t<cur.awayAt+AWAY_WAIT))botStep(H.turn);
  },
  snap(s,you,t){
    const Y=H.y;
    s.y={n:Y.n,cnt:Y.cnt,rd:Y.rounds,d:Y.dice.slice(),hd:Y.held.slice(),l:Y.left,r:Y.rolled?1:0,rl:Y.rl,tn:Y.tn,
      sc:Y.sc.map(o=>CATS.map(c=>o[c.id])),yb:Y.yb.slice(),dn:Y.done.slice(),
      lm:Y.lm?{p:Y.lm.p,c:Y.lm.c,pt:Y.lm.pt,d:Y.lm.d.slice()}:null,f0:Y.first};
    s.gr=0;s.dl=Math.max(0,Math.round(H.deadline-t));
  },
  restore(){},
  emoPhase:ph=>ph==='play'||ph==='over'
};

/* ---------- 화면 (모든 참가자) ---------- */
const PIPS={0:[],1:[5],2:[1,9],3:[1,5,9],4:[1,3,7,9],5:[1,3,5,7,9],6:[1,3,4,6,7,9]};
let yCat=null,yHold=[false,false,false,false,false],yLock={rl:-1,tn:-1,at:0},yMsg='',yMsgUntil=0,yMsgTimer=null,yTumbleUntil=0;
let elYz=null,elTurn=null,elDice=null,elRoll=null,elHint=null,elTbl=null,lastTurn='',lastDice='',lastRoll='',lastBoard='',lastHint='';
const scoreOf=i=>{const o={};if(V&&V.y&&V.y.sc[i])CATS.forEach((c,k)=>{o[c.id]=V.y.sc[i][k]});return o};
const myTurnNow=()=>!!(V&&V.y&&V.st==='play'&&myReady());
function say(txt){
  yMsg=txt;yMsgUntil=Date.now()+2400;drawHint();
  clearTimeout(yMsgTimer);yMsgTimer=setTimeout(drawHint,2500);
}
function canRoll(){
  if(!myTurnNow())return false;
  const Y=V.y;
  if(Y.l<=0)return false;
  if(yLock.rl===Y.rl&&yLock.tn===Y.tn&&Date.now()-yLock.at<1500)return false;
  return !Y.r||yHold.some(h=>!h);
}
function canScore(){
  if(!myTurnNow()||!V.y.r||!yCat)return false;
  if(yLock.tn===V.y.tn&&yLock.sc&&Date.now()-yLock.at<1500)return false;
  return true;
}
function rollNow(){
  if(!canRoll())return;
  const Y=V.y;
  yLock={rl:Y.rl,tn:Y.tn,at:Date.now()};
  sendAct({t:'roll',keep:Y.r?yHold.slice():[false,false,false,false,false]});
  yCat=null;drawAll();G.buttons();
}
function record(){
  if(!canScore())return;
  const me=myIdx();
  if(allowed(scoreOf(me),V.y.d).indexOf(yCat)<0)return;
  yLock={rl:V.y.rl,tn:V.y.tn,at:Date.now(),sc:1};
  sendAct({t:'score',cat:yCat});
  yCat=null;drawAll();G.buttons();
}
function toggleHold(i){
  if(!V||!V.y||V.st!=='play'||myIdx()<0||V.t!==myIdx())return;
  if(!V.y.r){say('먼저 주사위를 굴려야 합니다.');return}
  if(V.y.l<=0){say('굴림을 모두 썼습니다. 기록할 칸을 골라 주세요.');return}
  if(!myTurnNow())return;
  yHold[i]=!yHold[i];
  try{sfx('pick')}catch(e){}
  drawAll();G.buttons();
}
function pickCat(id){
  if(!myTurnNow())return;
  if(!V.y.r){say('먼저 주사위를 굴려야 합니다.');return}
  if(allowed(scoreOf(myIdx()),V.y.d).indexOf(id)<0)return;
  if(yCat===id){record();return}
  yCat=id;try{sfx('tick')}catch(e){}
  drawAll();G.buttons();
}
/* 화면에 그리는 글 */
function lastRec(){
  const L=V.y&&V.y.lm;
  return L&&V.ps[L.p]?` · 직전 ${V.ps[L.p].n} ${byId[L.c].name} ${L.pt}점`:'';
}
function hintText(me){
  if(Date.now()<yMsgUntil&&yMsg)return yMsg;
  if(!V||!V.y)return '';
  const Y=V.y,tp=V.ps[V.t];
  if(V.st==='over')return '게임이 끝났습니다.';
  if(me<0)return tp?`${tp.n} 차례입니다. 관전 중입니다.${lastRec()}`:'';
  const p=V.ps[me];
  if(p.f)return p.sr?'항복했습니다. 남은 판을 지켜봅니다.':'';
  if(V.t!==me)return tp?`${tp.n} 차례입니다.${lastRec()}`:'';
  if(!myTurnNow())return '내 차례입니다.';
  {const left=(V.deadAt-clock())/1000;if(left<=10&&left>0)return `${Math.ceil(left)}초 남았습니다. 제한 시간이 지나면 알아서 기록합니다.`}
  if(!Y.r)return '굴리기를 눌러 주사위를 굴립니다.';
  const sc=scoreOf(me);
  if(yCat){const c=byId[yCat];return `${c.name}: ${c.rule} → ${calc(yCat,Y.d,jokerOf(sc,Y.d))}점. 한 번 더 누르거나 [기록하기]를 누르면 기록합니다.`}
  if(jokerOf(sc,Y.d))return '추가 야추입니다. 조커 규칙에 따라 기록할 수 있는 칸이 정해져 있습니다.';
  return Y.l>0?'남길 주사위를 눌러 고정하고 다시 굴리거나, 점수판에서 칸을 골라 기록하세요.':'굴림을 모두 썼습니다. 기록할 칸을 골라 주세요.';
}
function turnHTML(){
  const Y=V.y;
  if(V.st==='over')return '<span class="yz-chip"><b>게임 끝</b></span>';
  const t=V.t,p=V.ps[t];if(!p)return '';
  const mine=t===myIdx();
  const pips=Array.from({length:3},(_,k)=>`<i class="pp${k<Y.l?' on':''}"></i>`).join('');
  return `<span class="yz-chip yz-who${mine?' me':''}" style="--pc:${PCOL[t%4]}"><i class="dot"></i><b>${mine?'내 차례':esc(p.n)+' 차례'}</b></span><span class="yz-chip">${Math.min(Y.dn[t]+1,Y.rd)}/${Y.rd}라운드</span><span class="yz-chip" role="img" aria-label="남은 굴림 ${Y.l}번"><span class="yz-pips">${pips}</span></span>`;
}
function diceHTML(){
  const Y=V.y,me=myIdx(),mineTurn=V.st==='play'&&V.t===me&&me>=0;
  const hd=mineTurn?yHold:Y.hd,can=myTurnNow()&&Y.r&&Y.l>0,tum=Date.now()<yTumbleUntil;
  return Y.d.map((v,i)=>{
    const held=!!(Y.r&&V.st==='play'&&hd[i]);
    const pips=Array.from({length:9},(_,k)=>`<i${PIPS[v].indexOf(k+1)>=0?' class="on"':''}></i>`).join('');
    return `<div class="slot"><button type="button" class="die ${v?'v'+v:'blank'}${held?' held':''}${tum&&Y.r&&!held?' tumble':''}${can?'':' ro'}" data-i="${i}" aria-pressed="${held}" aria-label="${v?v+' 주사위':'빈 주사위'}${held?', 고정됨':''}">${pips}</button><span class="tag${held?'':' off'}">고정</span></div>`;
  }).join('');
}
function rollHTML(){
  const Y=V.y,mine=myTurnNow();
  const main=Y.r?'다시 굴리기':'굴리기';
  const sub=V.st!=='play'?'':mine?(Y.l>0?`남은 ${Y.l}번`:'굴림 끝'):'상대 차례';
  return `<b>${main}</b><small>${sub}</small>`;
}
/* 점수판: 칸 × 사람. 내 칸은 지금 기록하면 몇 점인지 보여 주고 눌러서 고름 */
function boardHTML(){
  const Y=V.y,me=myIdx(),n=Y.cnt,ids=Array.from({length:n},(_,i)=>i);
  const SC=ids.map(scoreOf),T=ids.map(i=>totals(SC[i],Y.yb[i]));
  const mine=me>=0&&me<n&&myTurnNow()&&Y.r&&!V.ps[me].f;
  const ok=mine?allowed(SC[me],Y.d):[],joker=mine&&jokerOf(SC[me],Y.d);
  const head=`<thead><tr><th class="lb" scope="col">점수판</th>${ids.map(i=>{
    const p=V.ps[i],on=V.st==='play'&&V.t===i&&!p.f;
    return `<th class="pc${on?' on':''}${i===me?' me':''}${p.f&&p.sr?' out':''}" scope="col" style="--pc:${PCOL[i%4]}"><b>${esc(p.n)}${i===me?' (나)':''}</b><span class="tot">${p.f&&p.sr?'항복':T[i].total}</span>${on?'<span class="tb"><i></i></span>':''}</th>`;
  }).join('')}</tr></thead>`;
  const cell=(i,c)=>{
    const v=SC[i][c.id],m=i===me?' me':'';
    if(v!==null)return `<td class="c f${m}">${v}</td>`;
    if(i===me&&ok.indexOf(c.id)>=0){
      const pts=calc(c.id,Y.d,joker);
      return `<td class="c o me${pts?'':' z'}${yCat===c.id?' sel':''}" data-c="${c.id}" role="button" tabindex="0" aria-label="${c.name} ${pts}점으로 기록">${pts}</td>`;
    }
    return `<td class="c e${m}"></td>`;
  };
  const row=c=>`<tr class="${c.up?'up':'lo'}"><th class="lb" scope="row" title="${c.rule}">${c.short?`<span class="ln">${c.name}</span><span class="sn">${c.short}</span>`:c.name}</th>${ids.map(i=>cell(i,c)).join('')}</tr>`;
  const stat=(cls,label,f)=>`<tr class="${cls}"><th class="lb" scope="row">${label}</th>${ids.map(i=>`<td class="c${i===me?' me':''}">${f(i)}</td>`).join('')}</tr>`;
  const up=CATS.filter(c=>c.up).map(row).join(''),low=CATS.filter(c=>!c.up).map(row).join('');
  return head+'<tbody>'+up
    +stat('sum','윗칸 소계 <small class="ln">(63점이면 +35)</small>',i=>`${T[i].upper}`)
    +stat('sum','윗칸 보너스',i=>T[i].bonus?`+${T[i].bonus}`:'–')
    +low
    +stat('sum','야추 보너스',i=>T[i].yb?`+${T[i].yb}`:'–')
    +stat('tot','총점',i=>`${T[i].total}`)
    +'</tbody>';
}
function drawHint(){
  if(!elHint)return;
  const h=hintText(myIdx());
  if(h!==lastHint){elHint.textContent=h;lastHint=h}
}
function drawAll(){
  if(!elYz||!V||!V.y)return;
  const t=turnHTML();if(t!==lastTurn){elTurn.innerHTML=t;lastTurn=t}
  const d=diceHTML();if(d!==lastDice){elDice.innerHTML=d;lastDice=d}
  const r=rollHTML();if(r!==lastRoll){elRoll.innerHTML=r;lastRoll=r}
  elRoll.disabled=!canRoll();
  const b=boardHTML();if(b!==lastBoard){elTbl.innerHTML=b;lastBoard=b}
  drawHint();
}
/* 새 상태를 받았을 때 (그리기 전) */
G.preView=()=>{
  if(!V.y)return;
  const me=myIdx(),Y=V.y;
  if(!PV||!PV.y||PV.y.tn!==Y.tn||PV.st!==V.st){
    // 차례가 바뀌었거나 새 판이 시작됨: 고른 칸과 고정 표시를 처음으로
    yCat=null;yLock={rl:-1,tn:-1,at:0};
    yHold=me>=0&&V.t===me&&Y.r?Y.hd.slice():[false,false,false,false,false];
  }else if(PV.y.rl!==Y.rl){
    yCat=null;
    if(me>=0&&V.t===me)yHold=Y.hd.slice();
    if(V.st==='play')yTumbleUntil=Date.now()+520;
  }
  if(yCat&&me>=0&&allowed(scoreOf(me),Y.d).indexOf(yCat)<0)yCat=null;
};
G.postView=()=>{};
G.overExtra=()=>{
  if(!V||!V.y)return '';
  const Y=V.y,list=Array.from({length:Y.cnt},(_,i)=>i).sort((a,b)=>(V.ps[a].f-V.ps[b].f)||(a-b));
  const li=list.map(i=>{
    const T=totals(scoreOf(i),Y.yb[i]),p=V.ps[i];
    return `<li${i===myIdx()?' class="me"':''}><span class="n">${esc(p.n)}</span><b>${p.sr?'항복':T.total+'점'}</b><small>윗칸 ${T.upper}${T.bonus?` (+${T.bonus})`:''} · 아랫칸 ${T.lower}${T.yb?` · 야추 보너스 ${T.yb}`:''}</small></li>`;
  }).join('');
  return `<div class="yz-res"><div class="yz-res-h"><b>최종 점수</b></div><ul>${li}</ul></div>`;
};
G.logCue=()=>false;
G.cues=(v,pv)=>{
  if(!v.y||!pv.y)return;
  if(v.y.tn===pv.y.tn&&v.y.rl>pv.y.rl)sfx('pick');
  else if(v.y.lm&&(!pv.y.lm||v.y.lm.p!==pv.y.lm.p||v.y.dn[v.y.lm.p]!==pv.y.dn[v.y.lm.p]))sfx('play',1);
};
G.hud=inGame=>{
  if(!elYz)return;
  const on=!!(inGame&&V&&V.y);
  elYz.hidden=!on;
  $('#stage').classList.toggle('yz-over',!!(on&&V.st==='over'));   // 결과 창이 길어도 아래 버튼이 내 정보 칸에 가리지 않게
  if(!on){lastTurn='';lastDice='';lastRoll='';lastBoard='';lastHint='';return}
  drawAll();
};
G.handMarks=()=>{};
G.me=(i,h)=>{
  $('#numpick').hidden=true;
  const p=V.ps[i];if(!p||!V.y)return;
  if(p.f){if(!p.sr)$('#meSub').innerHTML=`<b>${+p.f}위</b>입니다.`;return}
  const T=totals(scoreOf(i),V.y.yb[i]);
  $('#meSub').innerHTML=`총점 <b>${T.total}</b>점 · <b>${V.y.dn[i]}</b>/${V.y.rd}칸`;
};
G.specNote='관전 중입니다. 모든 주사위와 점수가 보입니다.';
G.no3D=true;   // 3D 테이블을 쓰지 않음: 공통 코드가 그리기를 쉬어서 휴대폰 배터리를 아낌
G.buttons=()=>{
  const play=$('#btnPlay'),can=canScore();
  $('#btnPass').hidden=true;$('#btnGura').hidden=true;
  play.disabled=!can;play.classList.toggle('ready',can);
  if($('#playMain').textContent!=='기록하기')$('#playMain').textContent='기록하기';
  let sub=keyLabel(KEYS.play);
  if(yCat&&V&&V.y&&myIdx()>=0)sub=`${byId[yCat].name} ${calc(yCat,V.y.d,jokerOf(scoreOf(myIdx()),V.y.d))}점`;
  if($('#playSub').textContent!==sub)$('#playSub').textContent=sub;
  if(elRoll)elRoll.disabled=!canRoll();
};
G.live=()=>{
  if(!elYz||elYz.hidden||!V||!V.y||V.st!=='play')return;
  const bar=elTbl&&elTbl.querySelector('th.pc.on .tb i');
  if(bar){const left=Math.max(0,(V.deadAt-clock())/1000);bar.style.width=Math.min(100,left/(V.cfg.turn||45)*100)+'%'}
  if(V.t===myIdx())drawHint();   // 남은 시간 안내
};
G.play=record;
G.pass=()=>{};
G.keyPhase=st=>st==='play';
G.onKey=(act,e)=>{
  if(act==='yroll'){if(!e.repeat)rollNow();return true}
  return false;
};
G.field3D=()=>{};
/* 이 게임으로 바뀔 때 / 다른 게임으로 바뀔 때 */
G.enter=()=>{
  $('#stage').classList.add('yz');
  $('#btnPass').hidden=true;$('#btnGura').hidden=true;$('#numpick').hidden=true;
  yCat=null;
};
G.leave=()=>{
  $('#stage').classList.remove('yz','yz-over');
  $('#btnPass').hidden=false;
  if(elYz){elYz.hidden=true;lastTurn='';lastDice='';lastRoll='';lastBoard='';lastHint=''}
};
/* 처음 한 번: 주사위와 점수판 화면 만들기 */
G.init=()=>{
  const css=document.createElement('style');
  css.textContent=`
.stage.yz{background:radial-gradient(ellipse at 50% 30%,#4c9170 0%,var(--felt) 58%,var(--felt-dark) 100%)}
.stage.yz #cv,.stage.yz #dim{visibility:hidden}
.stage.yz .labels{visibility:hidden}
.stage.yz .nogl{display:none}
.stage.yz.yz-over .myplate,.stage.yz.yz-over .actions{display:none}
.specbar:not([hidden])~#yz .yz-top{margin-top:30px}
.stage.yz .actions{left:auto}
.stage.yz .myplate{max-width:calc(100% - 150px)}
#yz{position:absolute;inset:0;z-index:0;display:flex;flex-direction:column;gap:6px;padding:8px 10px 82px;pointer-events:none;min-height:0}
#yz[hidden]{display:none}
#yz .yz-top{min-height:34px;display:flex;flex-wrap:wrap;align-items:center;gap:6px;align-self:flex-start;max-width:calc(100% - 188px)}
#yz .yz-chip{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:12px;background:rgba(255,250,240,.92);border:1.5px solid var(--line-strong);font-size:13px;line-height:1.15;white-space:nowrap}
#yz .yz-who .dot{width:12px;height:12px;border-radius:50%;background:var(--pc);box-shadow:0 0 0 2px #fffaf0,0 0 0 3px var(--pc);flex:none}
#yz .yz-who.me{border-color:var(--mustard);box-shadow:0 0 0 2px var(--mustard)}
#yz .yz-who b{font-weight:600}
#yz .yz-pips{display:inline-flex;gap:4px}
#yz .yz-pips .pp{width:10px;height:10px;border-radius:50%;border:2px solid var(--line-strong);background:transparent}
#yz .yz-pips .pp.on{background:var(--mustard);border-color:var(--mustard-edge)}
#yz .yz-main{flex:1;min-height:0;display:flex;flex-direction:column;gap:8px}
#yz .yz-left{display:flex;flex-direction:column;gap:6px;flex:none}
#yz .yz-row{display:flex;align-items:stretch;gap:8px}
#yz .yz-dice{flex:1;min-width:0;display:flex;justify-content:center;gap:5px;padding:8px 8px 4px;border-radius:var(--r-md);background:rgba(20,50,35,.35);border:1.5px solid rgba(255,250,240,.18);pointer-events:auto}
#yz .slot{flex:1;min-width:0;max-width:66px;display:flex;flex-direction:column;align-items:center;gap:3px}
#yz .die{position:relative;width:100%;aspect-ratio:1;border:0;border-radius:17%;padding:13%;display:grid;grid-template:repeat(3,1fr)/repeat(3,1fr);background:linear-gradient(145deg,#fffdf6,#eadfc4);box-shadow:0 3px 0 #bfb292,0 7px 12px rgba(0,0,0,.3);cursor:pointer;transition:transform .12s ease,box-shadow .12s ease;touch-action:manipulation}
#yz .die i{place-self:center;width:84%;aspect-ratio:1;border-radius:50%;background:transparent}
#yz .die i.on{background:#2a2118}
#yz .die.v1 i.on{background:var(--gura);transform:scale(1.4)}
#yz .die.blank{background:transparent;box-shadow:none;border:2px dashed rgba(255,250,240,.4)}
#yz .die.ro{cursor:default}
#yz .die.held{transform:translateY(-5px);box-shadow:0 0 0 3px var(--mustard),0 9px 14px rgba(0,0,0,.35)}
#yz .die.tumble{animation:yzTumble .5s ease-out}
@keyframes yzTumble{0%{transform:rotate(-200deg) scale(.7) translateY(-10px);opacity:.3}60%{transform:rotate(14deg) scale(1.08)}100%{transform:none;opacity:1}}
#yz .tag{font-size:10.5px;font-weight:700;letter-spacing:.06em;color:var(--mustard);height:13px;line-height:13px}
#yz .tag.off{visibility:hidden}
#yz .yz-roll{flex:none;width:76px;border:2px solid var(--gura-edge);border-radius:14px;background:var(--gura);color:var(--gura-ink);box-shadow:0 4px 0 var(--gura-edge);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-family:var(--f-display);font-size:18px;line-height:1.1;padding:4px;word-break:keep-all;text-align:center;pointer-events:auto;cursor:pointer;touch-action:manipulation}
#yz .yz-roll b{font-weight:400}
#yz .yz-roll small{font-family:var(--f-body);font-size:11px;font-weight:600;opacity:.85;min-height:13px}
#yz .yz-roll:active:not(:disabled){transform:translateY(4px);box-shadow:none}
#yz .yz-roll:disabled{opacity:.45;box-shadow:0 2px 0 var(--gura-edge);cursor:not-allowed}
#yz .yz-hint{font-size:13px;line-height:1.35;color:#fffaf0;text-shadow:0 1px 2px rgba(0,0,0,.5);text-align:center;min-height:35px;padding:0 4px;text-wrap:pretty}
#yz .yz-card{flex:1;min-height:0;overflow:auto;-webkit-overflow-scrolling:touch;border-radius:var(--r-md);background:var(--paper);border:1.5px solid var(--line-strong);box-shadow:var(--sh-panel);pointer-events:auto}
#yz .yz-tbl{width:100%;border-collapse:separate;border-spacing:0;table-layout:fixed;font-size:12.5px;color:var(--ink)}
#yz .yz-tbl th.lb{width:104px;text-align:left;font-weight:500;padding:3px 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:var(--paper)}
#yz .yz-tbl th.lb small{font-size:10px;color:var(--muted)}
#yz .yz-tbl .sn{display:none}
@media (max-width:819px){#yz .yz-tbl .ln{display:none}#yz .yz-tbl .sn{display:inline}}
#yz .yz-tbl td.c{text-align:center;font-family:var(--f-num);font-size:13px;padding:3px 2px;height:26px;border-left:1px solid var(--line);border-top:1px solid var(--line)}
#yz .yz-tbl th.lb{border-top:1px solid var(--line)}
#yz .yz-tbl thead th{position:sticky;top:0;z-index:2;background:var(--well);border-top:0;border-bottom:1.5px solid var(--line-strong)}
#yz .yz-tbl thead th.pc{position:sticky;padding:4px 3px 6px;font-weight:500;text-align:center;overflow:hidden}
#yz .yz-tbl thead th.pc b{display:block;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border-bottom:3px solid var(--pc);padding-bottom:2px}
#yz .yz-tbl thead th.pc .tot{display:block;font-family:var(--f-num);font-size:12px;color:var(--muted);margin-top:2px}
#yz .yz-tbl thead th.pc.on{background:#fff0c8}
#yz .yz-tbl thead th.pc.out{opacity:.55}
#yz .yz-tbl thead th .tb{position:absolute;left:0;right:0;bottom:0;height:3px;background:rgba(0,0,0,.08)}
#yz .yz-tbl thead th .tb i{display:block;height:100%;width:100%;background:var(--pc)}
#yz .yz-tbl td.c.me{background:#fff6de}
#yz .yz-tbl td.c.f{font-weight:600}
#yz .yz-tbl td.c.o{color:var(--gura);font-weight:700;cursor:pointer;background:#fde9b5;touch-action:manipulation}
#yz .yz-tbl td.c.o.z{color:var(--muted);font-weight:500}
#yz .yz-tbl td.c.o.sel{background:var(--mustard);color:var(--ink);outline:2px solid var(--mustard-edge);outline-offset:-2px}
#yz .yz-tbl td.c.o:focus-visible{outline:2px solid var(--focus);outline-offset:-2px}
#yz .yz-tbl tr.sum th.lb,#yz .yz-tbl tr.sum td.c{background:var(--well);font-weight:600}
#yz .yz-tbl tr.tot th.lb,#yz .yz-tbl tr.tot td.c{background:var(--well);font-family:var(--f-display);font-size:16px;font-weight:400;height:32px}
#yz .yz-tbl tr.tot td.c{font-family:var(--f-num);font-weight:700}
@media (min-width:820px){
  #yz .yz-main{flex-direction:row;align-items:stretch;gap:14px}
  #yz .yz-left{width:min(330px,38%);justify-content:flex-start;gap:10px}
  #yz .yz-row{flex-direction:column}
  #yz .slot{max-width:none}
  #yz .yz-dice{padding:12px 10px 6px;gap:8px}
  #yz .yz-roll{width:auto;height:58px;flex-direction:row;gap:10px;font-size:21px}
  #yz .yz-hint{font-size:14px;text-align:left;padding:0 2px}
  #yz .yz-tbl th.lb{width:132px}
  #yz .yz-tbl{font-size:13.5px}
}
.yz-res{margin:4px 0 2px;text-align:left}
.yz-res-h{margin-bottom:6px}
.yz-res ul{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.yz-res li{display:grid;grid-template-columns:1fr auto;gap:0 10px;align-items:baseline;padding:8px 12px;border-radius:var(--r-sm);background:var(--well)}
.yz-res li.me{box-shadow:inset 0 0 0 2px var(--mustard)}
.yz-res li .n{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.yz-res li b{font-family:var(--f-num)}
.yz-res li small{grid-column:1/-1;font-size:12px;color:var(--muted)}
@media (max-width:520px){#yz .yz-chip{font-size:12px;padding:3px 8px}#yz{padding-bottom:76px}}
@media (prefers-reduced-motion:reduce){#yz .die.tumble{animation:none}}
`;
  document.head.appendChild(css);
  elYz=document.createElement('div');elYz.id='yz';elYz.hidden=true;
  elYz.innerHTML=`<div class="yz-top"></div><div class="yz-main"><div class="yz-left"><div class="yz-row"><div class="yz-dice" role="group" aria-label="주사위"></div><button type="button" class="yz-roll" disabled></button></div><div class="yz-hint" aria-live="polite"></div></div><div class="yz-card"><table class="yz-tbl" aria-label="점수판"></table></div></div>`;
  $('#stage').insertBefore(elYz,$('#fx'));
  elTurn=elYz.querySelector('.yz-top');elDice=elYz.querySelector('.yz-dice');elRoll=elYz.querySelector('.yz-roll');
  elHint=elYz.querySelector('.yz-hint');elTbl=elYz.querySelector('.yz-tbl');
  elDice.addEventListener('click',e=>{const b=e.target.closest('.die');if(b)toggleHold(+b.dataset.i)});
  elRoll.addEventListener('click',rollNow);
  elTbl.addEventListener('click',e=>{const c=e.target.closest('td[data-c]');if(c)pickCat(c.dataset.c)});
  elTbl.addEventListener('keydown',e=>{
    if(e.key!=='Enter'&&e.key!==' ')return;
    const c=e.target.closest&&e.target.closest('td[data-c]');if(!c)return;
    e.preventDefault();pickCat(c.dataset.c);
  });
};

(window.GAMES=window.GAMES||{}).yahtzee=G;
})();
