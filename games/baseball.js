/* ===== 숫자야구 게임 모듈 =====
   공통 코드(index.html)가 GAMES.baseball의 함수를 불러서 이 게임의 규칙·봇·화면을 그림.
   숫자가 겹치지 않는 3~5자리 비밀 숫자를 추리함(0은 맨 앞도 가능). 자리까지 맞으면 S, 숫자만 맞으면 B, 하나도 없으면 OUT.
   게임 모드 md: 0 혼자(10번 안에 찾기) · 1 맞대결(2명, 서로의 비밀 숫자를 동시 공격) · 2 경주(2~6명, 정해진 숫자를 번갈아 부르고 결과 공유, 버저로 언제든 정답 도전 · 틀리면 사망)
   화면은 앉은 카메라 그대로: 대기실 디스플레이가 앞으로 나오며 넓어져 플립 판이 되고, 대기실 자판이 들어간 틈에서 큰 6×2 자판과 램프가 올라옴. 지난 기록은 맞은편으로 깔리는 영수증.
   손패(hand)는 카드가 아니라 표시용 [0] (공통 코드가 hand가 비면 끝난 사람으로 봄) */
(function(){
const G={id:'baseball',name:'숫자야구',short:'야구',lead:'숫자와 자리를 추리해 먼저 찾기',brand:'숫자야구',brandPx:48,maxHi:6,noFast:true,rcOwn:true};   // rcOwn: 공통 영수증 프린터는 기록만 받고 종이는 이 게임이 판 옆에 길게 그림
const MD_NAME=['혼자','맞대결','경주'],MD_MAX=[1,2,6];
const mdOf=c=>{const m=Math.round(+(c&&c.md));return m>=0&&m<=2?m:1};
const lenOf=c=>{const n=Math.round(+(c&&c.len));return n>=3&&n<=5?n:4};
Object.defineProperty(G,'firstPick',{get(){return !!(H&&mdOf(H.cfg)===2)}});   // 경주만 첫 차례 주사위
G.minN=c=>mdOf(c)?2:1;
G.maxOf=c=>MD_MAX[mdOf(c)];
/* 규칙을 바꾼 뒤 방 설정을 맞춤: 모드마다 최대 인원. strict면 앉은 사람이 넘칠 때 못 바꾸게 null, 아니면 경주로 */
G.fixCfg=(c,n,strict)=>{
  const hi=MD_MAX[mdOf(c)];
  if(n>hi){if(strict)return null;return {...c,md:2,max:Math.min(6,Math.max(+c.max||2,n))}}
  const mx=+c.max||hi;return mx>hi?{...c,max:hi}:mdOf(c)&&mx<2?{...c,max:2}:c;
};

/* ---------- 규칙 (방장 엔진과 화면이 같은 함수를 씀) ---------- */
const SOLO_MAX=10,VS_MAX=20,BUZZ_MS=10000,RV_MS=1650,WIN_RV=2300,SHORT_RV=900;   // 혼자 기회, 맞대결 최대 턴, 버저 입력 시간, 결과 공개 시간(플립이 다 넘어갈 때까지)
const HOLD_MS=300,HOST_LAG=120;   // 버저를 누르고 있어야 하는 시간, 방장 버저 지연(방장 브라우저가 엔진이라 유리한 만큼)
const SEAT_C=['#c53026','#2b65ca','#1f7a2e','#c9831a','#7d3fa8','#12a3a3'];
const validNum=(v,L)=>typeof v==='string'&&v.length===L&&/^[0-9]+$/.test(v)&&new Set(v).size===L;
function score(sec,g){let S=0,B=0;for(let i=0;i<g.length;i++){if(sec[i]===g[i])S++;else if(sec.includes(g[i]))B++}return {S,B}}
const resText=(S,B)=>!S&&!B?'OUT':[S?S+'S':'',B?B+'B':''].filter(Boolean).join(' ');
function randNum(L,rnd){const r=rnd||Math.random,d=[...'0123456789'];let o='';for(let i=0;i<L;i++){const k=(r()*d.length)|0;o+=d.splice(k,1)[0]}return o}
const CAND={};
function allNums(L){   // 나올 수 있는 모든 수 (3자리 720 · 4자리 5040 · 5자리 30240)
  if(CAND[L])return CAND[L];
  const out=[],go=(s,used)=>{if(s.length===L){out.push(s);return}for(let d=0;d<10;d++)if(!(used>>d&1))go(s+d,used|1<<d)};
  go('',0);return CAND[L]=out;
}
const fits=(c,r)=>{const q=score(c,r.g);return q.S===r.S&&q.B===r.B};
/* 봇이 아는 기록에 맞는 후보. 저장(H)에 넣지 않고 기록에서 다시 만들 수 있게 따로 둠(방장 이양·저장 크기) */
const PC={};
function poolFor(view,rows){
  const O=H.nb,k=view,gk=H.code+':'+O.gn;let c=PC[k];
  if(!c||c.gk!==gk||c.n>rows.length){c=PC[k]={gk,n:0,a:allNums(O.L)}}
  if(c.n<rows.length){const add=rows.slice(c.n);c.a=c.a.filter(x=>add.every(r=>fits(x,r)));c.n=rows.length}
  return c.a;
}
/* 봇의 수: 쉬움은 가끔 정보를 놓침, 보통은 후보 중 무작위, 어려움은 남는 후보가 가장 적어지는 수 */
function botNum(lv,pool,L,used,rnd){
  const r=rnd||Math.random;
  const any=()=>{for(let k=0;k<40;k++){const v=randNum(L,r);if(!used.has(v))return v}return pool[0]||randNum(L,r)};
  if(!pool.length)return any();
  if(lv===0&&r()<.3)return any();
  if(lv<2||pool.length<=2)return pool[(r()*pool.length)|0];
  const smp=(a,n)=>{if(a.length<=n)return a;const o=[];for(let i=0;i<n;i++)o.push(a[(r()*a.length)|0]);return o};
  const tries=smp(pool,32),ref=smp(pool,220);let best=tries[0],bv=1e9;
  for(const c of tries){const m={};let w=0;for(const x of ref){const q=score(x,c),k=q.S*10+q.B;m[k]=(m[k]||0)+1;if(m[k]>w)w=m[k]}if(w<bv){bv=w;best=c}}
  return best;
}

/* ---------- 규칙 설명·방 설정 ---------- */
G.rulesHTML='<ol class="rules"><li><b>숫자</b> : 비밀 숫자는 3~5자리이고 숫자가 겹치지 않습니다. 0은 맨 앞에도 올 수 있습니다</li><li><b>판정</b> : 숫자와 자리가 모두 맞으면 <b>S</b>(스트라이크), 숫자만 맞으면 <b>B</b>(볼), 하나도 없으면 <b>OUT</b>입니다. 자릿수만큼 S가 나오면 찾은 것입니다</li><li><b>혼자</b> : 정해진 숫자를 10번 안에 찾습니다. 시간제한은 없습니다</li><li><b>맞대결</b> : 두 사람이 각자 비밀 숫자를 정하고 매 턴 동시에 숫자를 부릅니다. 먼저 찾으면 승리, 같은 턴에 둘 다 찾으면 무승부입니다. 시간이 지나면 그 턴을 건너뜁니다. 20턴 안에 못 찾아도 무승부입니다</li><li><b>경주</b> : 정해진 숫자를 한 명씩 부르고 결과는 모두 함께 봅니다. 자기 차례에 맞히면 승리합니다. 이미 나온 수는 다시 부를 수 없습니다</li><li><b>버저</b> : 경주에서는 결과가 다 나온 뒤라면 언제든 빨간 버저를 꾹 눌러 정답에 도전할 수 있습니다. 게임이 멈추고 10초 안에 숫자를 넣습니다. 맞히면 승리, 틀리거나 시간을 넘기면 사망이고 틀린 수의 결과도 모두에게 공개됩니다. 마지막 한 명이 남으면 승리합니다</li><li><b>램프</b> : 자판 위 숫자 램프를 누르면 꺼지고 다시 누르면 켜집니다. 내 화면에서만 보이는 메모입니다</li><li><b>기록</b> : 지난 기록은 영수증에 찍힙니다. 영수증을 누르면 전체 기록이 펼쳐집니다</li><li><b>키보드</b> : 숫자키로 입력, Shift+숫자로 램프, Backspace로 지우기, Enter로 부르기, Space를 누르고 있으면 버저입니다</li></ol>';
G.modeDesc=['',''];
G.defaults={max:2,turn:45,len:4,md:1};
G.roomSet=[
  {k:'md',label:'게임 모드',unit:'',lo:0,hi:2,step:1,lever:1,desc:'혼자: 10번 안에 찾습니다. 맞대결: 서로의 비밀 숫자를 동시에 공격합니다(2명). 경주: 같은 숫자를 번갈아 부르며 먼저 찾습니다(2~6명)'},
  {k:'len',label:'자릿수',unit:'자리',lo:3,hi:5,step:1,lever:1,desc:'찾을 숫자의 자릿수입니다'},
  {k:'turn',label:'제한 시간',unit:'초',lo:15,hi:120,step:5,lever:1,desc:'시간이 지나면 차례를 건너뜁니다 (혼자는 시간제한 없음)'}];
G.ruleSet=[];
G.modeLabel=c=>MD_NAME[mdOf(c)];
G.boardSet=c=>{
  const md=mdOf(c),rs=roomSetOf(G,c),num=k=>({kind:'num',...rs.find(x=>x.k===k),v:+(c[k]??G.defaults[k]),diff:false});
  return [{kind:'choice',k:'md',label:'게임 모드',opts:MD_NAME,desc:rs.find(x=>x.k==='md').desc,v:md,diff:md!==1,act:o=>'nb:md:'+o},num('len'),...(md?[num('turn')]:[])];
};
G.settingsHTML=(c,{stepRow})=>{
  const md=mdOf(c),rs=roomSetOf(G,c),row=k=>{const d=rs.find(x=>x.k===k);return d?stepRow(d):''};
  return `<div class="rs-grid">${[...(md?['max']:[]),'spec'].map(row).join('')}</div><div class="rs-seg"><div class="rs-h"><b>게임 모드</b><small>${rs.find(x=>x.k==='md').desc}</small></div><div class="segrow" role="radiogroup" aria-label="게임 모드">${MD_NAME.map((t,v)=>`<button class="btn ${md===v?'btn-play':'btn-sub'}" type="button" role="radio" aria-checked="${md===v}" data-act="nb:md:${v}">${t}</button>`).join('')}</div></div><div class="rs-grid">${(md?['len','turn']:['len']).map(row).join('')}</div>`;
};
G.panelAct=a=>{
  if(!a.startsWith('nb:'))return false;
  if(!(mode==='host'&&H&&H.phase==='wait'))return true;
  const p=a.split(':'),v=+p[2];
  if(p[1]!=='md'||!(v>=0&&v<=2&&Number.isInteger(v)))return true;
  if(mdOf(H.cfg)===v){lastPanelHtml='';mark();return true}
  const nc=G.fixCfg({...H.cfg,md:v,max:MD_MAX[v]},H.members.length,true);
  if(!nc){sfx('no');lastPanelHtml='';mark();return true}
  H.cfg=nc;saveRoomCfg(H.cfg);sfx('tick');lastPanelHtml='';mark();return true;
};
G.cfgChips=c=>`<span class="chip"><b>${MD_NAME[mdOf(c)]}</b></span><span class="chip"><b>${lenOf(c)}자리</b></span>${mdOf(c)?`<span class="chip">제한 시간 <b>${+c.turn||45}초</b></span>`:''}`;
G.cfgSum=c=>`${MD_NAME[mdOf(c)]} · ${lenOf(c)}자리${mdOf(c)?` · 제한 시간 ${+c.turn||45}초`:''}`;
G.roomSub=()=>'1~6명 숫자 게임';
G.pubExtra=()=>({});
G.cardInfo=c=>`<p class="cardinfo">${['혼자 하는 게임입니다.','두 명이 하는 게임입니다.','두~여섯 명이 하는 게임입니다.'][mdOf(c)]}</p>`;
G.rankTitle=()=>'';
G.finLabel=()=>'';
G.noEmotes=[];
G.keys={};
G.keyActions=[];
G.cardHTML=()=>'';G.drawFace=()=>{};G.cmpCard=()=>0;G.labelOf=()=>'';

/* ---------- 방장 엔진 ----------
   H.nb: md, L(자릿수), ph(set 비밀 정하기 · guess 부르기 · buzz 버저 입력 · rv 결과 공개 · done), sec(정답), secs(맞대결 각자 비밀), rec(기록), alive, pg(맞대결 이번 턴에 낸 수)
   rec 한 줄: {n 번호, s 자리, g 부른 수(시간 초과면 null), S, B, x 버저 도전이면 1} */
const realBot=p=>!!p&&p.bot&&!awayHuman(p);
const turnMs=()=>(+H.cfg.turn||45)*1000;
const rowsKnown=()=>H.nb.rec.filter(r=>r.g);
const usedBy=seat=>new Set(H.nb.rec.filter(r=>r.g&&(H.nb.md===2||r.s===seat)).map(r=>r.g));
const aliveN=()=>H.nb.alive.filter(Boolean).length;
function nextAlive(from){const n=H.players.length;for(let k=1;k<=n;k++){const i=(from+k)%n;if(H.nb.alive[i])return i}return from}
function pushRow(s,g,x){
  const O=H.nb,q=g?score(O.md===1?O.secs[1-s]:O.sec,g):{S:0,B:0},n=O.md===1?O.round:O.rec.length+1;
  O.rec.push({n,s,g:g||null,S:q.S,B:q.B,x:x?1:0});
  const pl=H.players[s].name,res=g?`${g} ${resText(q.S,q.B)}`:'시간 초과';
  O.logQ.push([`${n} ${O.md?pl+' ':''}${x?'버저 ':''}${res}`,q.S===O.L?'fin':x&&g?'lie':g?'':'sys']);
  return q.S===O.L;
}
function reveal(ms){const O=H.nb;O.ph='rv';O.rvUntil=clock()+ms;H.deadline=0;H.botActAt=0;mark()}
function flushLog(){const O=H.nb;for(const l of O.logQ)addLog(l[0],l[1]);O.logQ=[]}
function finish(w,why){
  const O=H.nb;flushLog();
  O.res={w,why:why||''};O.ph='done';
  const P=H.players;
  if(O.md===0){const p=P[0];p.finished=true;p.rank=1;p.hand=[];if(why==='surrender')p.surrendered=true;addLog(w===0?`찾았습니다! (${O.rec.length}번)`:`정답 ${O.sec}`,w===0?'fin':'sys')}
  else if(w<0){P.forEach(p=>{p.finished=true;p.rank=1;p.hand=[]});addLog('무승부입니다.','sys')}
  else{
    let rk=1;P[w].rank=rk++;
    P.forEach((p,i)=>{if(i!==w&&O.alive[i])p.rank=rk++});
    for(const i of O.dead.slice().reverse())if(i!==w)P[i].rank=rk++;
    P.forEach(p=>{p.finished=true;p.hand=[]});
    if(O.md===1&&(why==='surrender'||why==='desert'))P[1-w].surrendered=true;
    const lose=O.md===1?P[1-w]:null;
    addLog(why==='surrender'||why==='desert'?`${lose?lose.name+' '+(why==='desert'?'탈주':'항복')+'! ':''}${P[w].name} 승리`:`${P[w].name} 승리!`,'fin');
  }
  H.phase='over';H.botActAt=0;H.deadline=0;mark();
  P.forEach((p,i)=>{if(p.bot&&O.md&&Math.random()<.4)botEmote(i,'gg',800+Math.random()*1600)});
}
/* 혼자 */
function soloCall(v){
  const O=H.nb,hit=pushRow(0,v,0);if(hit)O.win=0;
  reveal(hit?WIN_RV:RV_MS);
}
/* 맞대결 */
function vsRound(){
  const O=H.nb,t=clock();O.ph='guess';O.pg=[null,null];H.turn=0;H.deadline=t+turnMs();
  H.players.forEach((p,i)=>{O.botAt[i]=realBot(p)?t+rand(1400,3600):0});mark();
}
function vsSet(seat,v){
  const O=H.nb;if(O.ph!=='set'||O.secs[seat]||!validNum(v,O.L))return;
  O.secs[seat]=v;
  if(O.secs[0]&&O.secs[1])vsRound();else{H.turn=1-seat;mark()}
}
function vsResolve(){
  const O=H.nb;O.round++;
  const hit=[0,1].filter(i=>pushRow(i,O.pg[i],0));
  O.win=hit.length===2?-2:hit.length?hit[0]:-1;
  O.idle=O.pg[0]||O.pg[1]?0:O.idle+1;
  reveal(hit.length?WIN_RV:RV_MS);
}
function vsGuess(seat,v){
  const O=H.nb;if(O.ph!=='guess'||O.pg[seat]||!validNum(v,O.L)||usedBy(seat).has(v))return;
  O.pg[seat]=v;
  if(O.pg[0]&&O.pg[1])vsResolve();else{H.turn=1-seat;mark()}
}
function vsTimeout(){
  const O=H.nb;
  if(O.ph==='set'){for(const i of [0,1])if(!O.secs[i])O.secs[i]=randNum(O.L);vsRound();return}
  vsResolve();
}
/* 경주 */
function schedBuzz(){
  const O=H.nb,t=clock(),pool=poolFor('race',rowsKnown());
  H.players.forEach((p,i)=>{
    O.bzAt[i]=0;
    if(!O.alive[i]||!realBot(p))return;
    if(pool.length===1)O.bzAt[i]=t+rand(2000,4000)+(p.lv===0?1200:0);   // 사람이 먼저 누를 틈을 줌
    else if(p.lv===0&&pool.length<=3&&Math.random()<.15)O.bzAt[i]=t+rand(2000,4500);   // 쉬움 봇의 도박
  });
}
function raceTurn(seat,rest){
  const O=H.nb,t=clock(),p=H.players[seat];
  O.ph='guess';H.turn=seat;H.deadline=t+(rest||turnMs());H.botActAt=realBot(p)?t+rand(1200,2800):0;
  schedBuzz();mark();
}
function raceCall(seat,v){
  const O=H.nb;if(O.ph!=='guess'||H.turn!==seat||!O.alive[seat]||!validNum(v,O.L)||usedBy(seat).has(v))return;
  O.idle=0;const hit=pushRow(seat,v,0);if(hit)O.win=seat;
  reveal(hit?WIN_RV:RV_MS);
}
function raceBuzz(seat){
  const O=H.nb;if(O.ph!=='guess'||!O.alive[seat])return;
  const t=clock(),p=H.players[seat];
  O.bz={s:seat,rest:Math.max(1000,H.deadline-t),turn:H.turn};O.ph='buzz';H.turn=seat;H.deadline=t+BUZZ_MS;
  H.botActAt=realBot(p)?t+rand(1100,2200):0;O.bzAt=O.bzAt.map(()=>0);mark();
}
function kill(seat){const O=H.nb;if(!O.alive[seat])return;O.alive[seat]=false;O.dead.push(seat);H.players[seat].finished=true;if(H.turn===seat&&aliveN())H.turn=nextAlive(seat)}
function raceAnswer(seat,v){
  const O=H.nb;if(O.ph!=='buzz'||!O.bz||O.bz.s!==seat||!validNum(v,O.L)||usedBy(seat).has(v))return;
  const hit=pushRow(seat,v,1);
  if(hit)O.win=seat;else kill(seat);
  reveal(hit?WIN_RV:RV_MS);
}
function raceResume(){
  const O=H.nb,b=O.bz;O.bz=null;
  if(aliveN()<=1){finish(O.alive.indexOf(true),'last');return}
  if(b&&O.alive[b.turn])raceTurn(b.turn,b.rest);else raceTurn(b?nextAlive(b.turn):nextAlive(H.turn));
}
function afterReveal(){
  const O=H.nb;flushLog();
  if(O.md===0){
    if(O.win===0)finish(0,'');else if(O.rec.length>=SOLO_MAX)finish(-1,'fail');else{O.ph='guess';mark()}
  }else if(O.md===1){
    if(O.win===-2)finish(-1,'both');else if(O.win>=0)finish(O.win,'');
    else if(O.round>=VS_MAX||O.idle>=3)finish(-1,O.idle>=3?'idle':'max');else vsRound();
  }else{
    if(O.win>=0)finish(O.win,'');
    else if(O.bz||aliveN()<=1)raceResume();
    else{const c=H.turn;raceTurn(nextAlive(c))}
  }
}
function doSurrender(seat){
  const O=H.nb;if(H.phase!=='play'||!O||!H.players[seat]||H.players[seat].finished)return;
  const why=H.players[seat].deserter?'desert':'surrender';
  if(O.md===0){finish(-1,'surrender');return}
  if(O.md===1){finish(1-seat,why);return}
  H.players[seat].surrendered=true;
  addLog(`${H.players[seat].name} ${why==='desert'?'탈주':'항복'}`,'lie');
  const turn=H.turn===seat&&O.ph==='guess',own=O.bz&&O.bz.s===seat&&O.ph==='buzz';
  kill(seat);
  if(O.ph==='rv')return;   // 공개가 끝날 때 이어서 처리
  if(aliveN()<=1){finish(O.alive.indexOf(true),'last');return}
  if(own){raceResume();return}
  if(O.bz&&O.bz.turn===seat)return;   // 버저가 끝나면 다음 사람으로
  if(turn)raceTurn(H.turn);else mark();
}
function botTick(t){
  const O=H.nb;
  if(O.md===1){
    H.players.forEach((p,i)=>{
      if(!realBot(p)||!O.botAt[i]||t<O.botAt[i]||(p.away&&t<p.awayAt+AWAY_WAIT))return;
      O.botAt[i]=0;
      if(O.ph==='set')vsSet(i,randNum(O.L));
      else if(O.ph==='guess'&&!O.pg[i])vsGuess(i,botNum(p.lv??1,poolFor('s'+i,O.rec.filter(r=>r.s===i&&r.g)),O.L,usedBy(i)));
    });
    return;
  }
  if(O.ph==='guess')for(let i=0;i<H.players.length;i++){
    const p=H.players[i];
    if(O.bzAt[i]&&t>=O.bzAt[i]&&O.alive[i]&&realBot(p)&&!(p.away&&t<p.awayAt+AWAY_WAIT)&&H.turn!==i){O.bzAt[i]=0;raceBuzz(i);return}
  }
  const p=H.players[H.turn];
  if(H.botActAt&&t>=H.botActAt&&realBot(p)&&!(p.away&&t<p.awayAt+AWAY_WAIT)){
    H.botActAt=0;const pool=poolFor('race',rowsKnown());
    if(O.ph==='guess')raceCall(H.turn,botNum(p.lv??1,pool,O.L,usedBy(H.turn)));
    else if(O.ph==='buzz')raceAnswer(H.turn,pool[(Math.random()*pool.length)|0]||randNum(O.L));
  }
}
G._test={score,resText,validNum,randNum,allNums,botNum,doSurrender,RV_MS,WIN_RV,BUZZ_MS,SOLO_MAX,VS_MAX};
G.engine={
  start(){
    Object.assign(H,{phase:'play',log:[],seatNote:{},field:[],last:null,reveal:null,shouts:[],pending:null,rankNext:1,known:{}});
    const md=mdOf(H.cfg),L=lenOf(H.cfg),n=H.players.length,prev=H.nb;
    H.players.forEach(p=>{p.finished=false;p.rank=null;p.surrendered=false;p.hand=[0]});
    const first=md===2?(prev&&prev.md===2?(prev.first+1)%n:firstSeat(n)):0;   // 경주 다음 판은 선을 넘김
    H.nb={gn:((prev&&prev.gn)||0)+1,md,L,ph:md===1?'set':'guess',sec:md===1?'':randNum(L),secs:[null,null],rec:[],alive:H.players.map(()=>true),dead:[],first,bz:null,bzAt:H.players.map(()=>0),botAt:H.players.map(()=>0),pg:[null,null],round:0,idle:0,win:-1,rvUntil:0,logQ:[],res:null};
    H.turn=first;H.deadline=0;H.botActAt=0;
    if(md===1){const t=clock();H.deadline=t+turnMs();H.players.forEach((p,i)=>{if(p.bot)H.nb.botAt[i]=t+rand(1200,2600)})}
    if(md===2)raceTurn(first);else mark();
  },
  act(seat,a){
    if(a.t==='surrender'){doSurrender(seat);return}
    const O=H.nb;if(!O||H.phase!=='play'||seat<0||seat>=H.players.length||!H.players[seat]||H.players[seat].finished)return;
    if(O.md===0){if(a.t==='guess'&&O.ph==='guess'&&validNum(a.v,O.L)&&!usedBy(0).has(a.v))soloCall(a.v);return}
    if(O.md===1){if(a.t==='set')vsSet(seat,a.v);else if(a.t==='guess')vsGuess(seat,a.v);return}
    if(a.t==='guess')raceCall(seat,a.v);else if(a.t==='buzz')raceBuzz(seat);else if(a.t==='ans')raceAnswer(seat,a.v);
  },
  tick(t){
    const O=H.nb;if(!O||H.phase!=='play')return;
    if(O.ph==='rv'){if(t>=O.rvUntil)afterReveal();return}
    if(O.md===0)return;
    botTick(t);
    if(H.phase!=='play'||O.ph==='rv'||!H.deadline||t<H.deadline)return;
    if(O.md===1){vsTimeout();return}
    const p=H.players[H.turn];if(realBot(p))return;
    if(O.ph==='buzz'){const s=O.bz.s;pushRow(s,null,1);kill(s);reveal(SHORT_RV);return}
    O.idle++;O.logQ.push([`${p.name} 시간 초과`,'sys']);flushLog();
    if(O.idle>=aliveN()*3){finish(-1,'idle');return}
    raceTurn(nextAlive(H.turn));
  },
  snap(s,you,t){
    const O=H.nb,over=H.phase==='over',seat=you>=0&&you<H.players.length;
    const o={gn:O.gn,md:O.md,L:O.L,ph:O.ph,rec:O.rec,alive:O.alive.slice(),first:O.first,bz:O.ph==='buzz'&&O.bz?O.bz.s:-1,res:O.res?{...O.res}:null,left:SOLO_MAX-O.rec.length};
    if(O.md===1){
      o.dn=O.ph==='set'?O.secs.map(Boolean):O.ph==='guess'?O.pg.map(Boolean):[true,true];
      if(seat){o.my=O.secs[you];o.mg=O.pg[you]}
    }
    if(over)o.sec=O.md===1?O.secs.slice():O.sec;
    s.o=o;s.gr=0;
    const live=H.phase==='play'&&O.ph!=='rv'&&!!H.deadline;
    s.dl=live?Math.max(0,Math.round(H.deadline-t)):0;
    if(H.phase==='play'){
      if(O.ph==='rv')delete s.t;
      else if(O.md===1){if(seat&&you<2&&!o.dn[you])s.t=you;else if(o.dn[0]&&o.dn[1])delete s.t}
    }
  },
  restore(ms){const O=H.nb;if(!O)return;if(O.rvUntil)O.rvUntil+=ms;O.botAt=O.botAt.map(v=>v?v+ms:0);O.bzAt=O.bzAt.map(v=>v?v+ms:0)},
  emoPhase:ph=>ph==='play'||ph==='over'
};
/* 기록 글 (결과 창) */
function recordText(v){
  const o=v.o,name=i=>v.ps[i]?v.ps[i].n:'?',L=['숫자야구 기록'];
  (o.rec||[]).forEach(r=>L.push(`${r.n}  ${o.md?name(r.s)+'  ':''}${r.x?'버저 ':''}${r.g?r.g+'  '+resText(r.S,r.B):'시간 초과'}`));
  if(o.sec)L.push(`정답: ${o.md===1?o.sec.map((x,i)=>name(i)+' '+x).join(' · '):o.sec}`);
  return L.join('\n');
}

/* ---------- 화면 공통 상태 ---------- */
let buf='',sent='',sentAt=0,lampOff=new Set(),lampKey='',secHide=false;
let elNb=null,elBar=null,elHint=null,el2d=null,lastBar='',lastHint='',last2d='',curG=0;
const LAMPS=['1','2','3','4','5','6','7','8','9','0'],KEYROW=['1','2','3','4','5','del','6','7','8','9','0','enter'];
const meIdx=()=>{const m=myIdx();return m>=0&&V&&V.ps&&m<V.ps.length?m:-1};
const nm=i=>V.ps[i]?V.ps[i].n:'?';
const isAlive=i=>!!(V&&V.o&&V.o.alive[i]);
/* 지금 자판으로 넣을 수 있는가 */
function canType(){
  if(!V||!V.o||V.st!=='play'||dealingV()||introWait())return false;
  const o=V.o,me=meIdx();if(me<0||!isAlive(me))return false;
  if(o.md===0)return o.ph==='guess';
  if(o.md===1)return (o.ph==='set'||o.ph==='guess')&&!o.dn[me]&&!sent;
  return (o.ph==='guess'&&V.t===me&&!sent)||(o.ph==='buzz'&&o.bz===me&&!sent);
}
const buzzOpen=()=>!!(V&&V.o&&V.st==='play'&&V.o.md===2&&V.o.ph==='guess'&&meIdx()>=0&&isAlive(meIdx())&&!dealingV()&&!introWait()&&!sent);
function usedNums(){const o=V.o,me=meIdx();return new Set(o.rec.filter(r=>r.g&&(o.md===2||r.s===me)).map(r=>r.g))}
const sndNo=()=>sfx('no');
function sndKey(){tone(1250,.022,{type:'triangle',vol:.05});hiss(.016,{freq:3400,q:3,vol:.05})}
function sndLamp(on){tone(on?1900:1100,.03,{type:'square',vol:.018})}
function sndBuzz(){tone(165,.34,{type:'sawtooth',vol:.09});tone(174,.34,{type:'square',vol:.05})}
function sndOut(){tone(140,.14,{type:'triangle',vol:.14});hiss(.06,{freq:600,vol:.08})}
function sndHit(){tone(980,.05,{type:'triangle',vol:.06})}
function sndHomer(){tone(150,.1,{type:'triangle',vol:.2});hiss(.1,{freq:2600,q:1,vol:.2});[660,880,1100,1320,1760].forEach((f,i)=>tone(f,.2,{type:'sine',vol:.09,at:.12+i*.1}));hiss(1.2,{freq:1400,q:.5,vol:.07,at:.25})}
function sndFail(){[392,330,262].forEach((f,i)=>tone(f,.28,{type:'triangle',vol:.1,at:i*.2}))}
/* 램프 메모: 내 화면에서만, 재접속해도 그 판 동안 유지 */
function lampLoad(){
  if(!V||!V.o)return;const k=(V.code||'')+':'+V.o.gn;if(k===lampKey)return;lampKey=k;
  let off=[];try{const s=JSON.parse(store('gura-nb-lamp')||'null');if(s&&s.k===k)off=[...String(s.off||'')]}catch(e){}
  lampOff=new Set(off);Nb.keysDirty=true;
}
function lampToggle(d){
  if(!V||!V.o)return;
  if(lampOff.has(d))lampOff.delete(d);else lampOff.add(d);
  sndLamp(!lampOff.has(d));
  try{store('gura-nb-lamp',JSON.stringify({k:lampKey,off:[...lampOff].join('')}))}catch(e){}
  Nb.keysDirty=true;drawAll();
}
function press(k){
  Nb.down[k]=clock();
  if(!canType()){sndNo();return}
  const L=V.o.L;
  if(k==='del'){if(buf){buf=buf.slice(0,-1);sndKey()}else sndNo();boardSync();drawAll();return}
  if(k==='enter'){submit();return}
  if(buf.length>=L||buf.includes(k)){sndNo();Nb.deny=clock();return}
  buf+=k;sndKey();boardSync();drawAll();
}
function submit(){
  const o=V.o;
  if(buf.length<o.L){sndNo();return}
  if(o.ph!=='set'&&usedNums().has(buf)){sndNo();Nb.deny=clock();return}
  const v=buf,a=o.ph==='set'?{t:'set',v}:o.ph==='buzz'?{t:'ans',v}:{t:'guess',v};
  sent=v;sentAt=clock();buf='';sendAct(a);sfx('key');boardSync();drawAll();
}
function rollSecret(){
  if(!canType()||V.o.ph!=='set'){sndNo();return}
  buf=randNum(V.o.L);tone(420,.05,{type:'triangle',vol:.08});hiss(.1,{freq:1800,vol:.08});boardSync();drawAll();
}
function buzzGo(){
  if(!buzzOpen()){sndNo();return}
  const go=()=>sendAct({t:'buzz'});
  if(mode==='host')setTimeout(go,HOST_LAG);else go();
}
function holdStart(){if(Nb.holdAt)return;if(!buzzOpen()){sndNo();return}Nb.holdAt=clock();sfx('key')}
function holdEnd(){Nb.holdAt=0}
function sideTap(){
  const o=V&&V.o;if(!o)return;
  if(o.md===1&&o.ph==='set'){rollSecret();return}
  if(o.md===1&&o.my){secHide=!secHide;sndLamp(!secHide);sideDraw();drawAll()}
}
/* 이름 칸: 자리 색 점 · 이름 · 냈음 표시 · 남은 초 */
function chipHTML(i){
  const me=meIdx(),o=V.o,p=V.ps[i];if(!p)return '';
  const on=V.st==='play'&&V.t===i&&!introWait()&&o.ph!=='rv';
  const dead=!isAlive(i)&&o.md===2;
  const st=V.st==='over'?(o.md===0?(o.res&&o.res.w===0?'성공':'실패'):o.res&&o.res.w<0?'무승부':p.f===1?'승리':(p.sr===3?'탈주':p.sr?'항복':'패배')):'';
  const done=o.md===1&&V.st==='play'&&o.dn&&o.dn[i]&&o.ph!=='rv';
  return `<div class="nb-p${on?' on':''}${i===me?' me':''}${dead?' dead':''}"><i class="dot" style="background:${SEAT_C[i]}"></i><b>${esc(p.n)}${i===me?' (나)':''}</b>${done?'<span class="ok">●</span>':''}<span class="w" data-ct="${i}"></span>${st?`<span class="st">${st}</span>`:''}</div>`;
}
function hintText(){
  if(!V||!V.o)return '';const o=V.o;
  if(V.st==='over'){
    const r=o.res;if(!r)return '게임이 끝났습니다.';
    if(o.md===0)return r.w===0?`찾았습니다! (${o.rec.length}번)`:r.why==='surrender'?`항복 · 정답 ${o.sec}`:`실패 · 정답 ${o.sec}`;
    if(r.w<0)return `무승부입니다.${o.md===2?` 정답 ${o.sec}`:''}`;
    const sc=o.md===1?(meIdx()>=0&&meIdx()<2?` · 상대 숫자 ${o.sec[1-meIdx()]}`:` · ${o.sec.join(' ')}`):r.why?` · 정답 ${o.sec}`:'';
    return `${nm(r.w)} 승리${r.why==='surrender'?' (항복)':r.why==='desert'?' (탈주)':''}${sc}`;
  }
  if(o.ph==='set')return introWait()?'':'비밀 숫자 정하기';
  if(o.ph==='buzz')return `${nm(o.bz)} 정답 입력`;
  return '';
}
function drawHint(){if(!elHint)return;const h=hintText();if(h!==lastHint){elHint.textContent=h;lastHint=h}}
/* ----- 2D (WebGL이 없을 때) ----- */
function html2d(){
  const o=V.o,me=meIdx();
  const rows=o.rec.map(r=>`<li><i class="dot" style="background:${SEAT_C[r.s]}"></i><b>${r.n}</b> ${r.x?'버저 ':''}${r.g?`${r.g} <em>${resText(r.S,r.B)}</em>`:'시간 초과'}</li>`).join('');
  const d=boardWant();
  const side=o.md===2?`<button type="button" class="nb-buzz${buzzOpen()?'':' off'}" data-b="1" aria-label="버저"></button>`:o.md===1?(o.ph==='set'?'<button type="button" class="nb-side" data-s="1">주사위</button>':o.my?`<button type="button" class="nb-side" data-s="1">${secHide?'••••':o.my}</button>`:''):`<span class="nb-side">${Math.max(0,o.left)}</span>`;
  const lamps=LAMPS.map(k=>`<button type="button" class="nb-lamp${lampOff.has(k)?' off':''}" data-l="${k}">${k}</button>`).join('');
  const keys=KEYROW.map(k=>`<button type="button" class="nb-key" data-k="${k}">${k==='del'?'←':k==='enter'?'↵':k}</button>`).join('');
  return `<ol class="nb-list">${rows}</ol><div class="nb-dsp"><span class="nb-num">${esc(d.d.padEnd(o.L,'·'))}</span><span class="nb-res">${esc(d.r)}</span>${side}</div><div class="nb-lamps">${lamps}</div><div class="nb-keys">${keys}</div>`;
}
function drawAll(){
  if(!elNb||!V||!V.o)return;
  const top=V.ps.map((_,i)=>chipHTML(i)).join('');if(top!==lastBar){elBar.innerHTML=top;lastBar=top}
  if(!Nb.on){const h=html2d();if(h!==last2d){el2d.innerHTML=h;last2d=h;const l=el2d.querySelector('.nb-list');if(l)l.scrollTop=l.scrollHeight}}
  drawHint();
}
/* 플립 판에 지금 보일 내용 {d: 숫자 칸, r: 결과 칸, s: 불릴 자리 색 점, spin: 숫자 칸이 돎} */
function boardWant(){
  const o=V.o,me=meIdx(),rec=o.rec,lastOf=s=>{for(let i=rec.length-1;i>=0;i--)if((s<0||rec[i].s===s)&&rec[i].g)return rec[i];return null};
  const of=r=>r?{d:r.g,r:resText(r.S,r.B),s:r.s}:{d:'',r:'',s:-1};
  if(V.st==='over'){
    const r=o.res;
    if(o.md===1){if(me>=0&&me<2&&r&&r.w!==me&&o.sec)return {d:o.sec[1-me],r:'',s:1-me};return of(lastOf(me>=0?me:-1))}
    const l=lastOf(-1);return l&&l.S===o.L?of(l):{d:o.sec||'',r:'',s:-1};
  }
  if(o.ph==='buzz'&&o.bz!==me)return {d:'',r:'',s:o.bz,spin:1};
  if(buf&&canType())return {d:buf,r:'',s:me};
  if(sent)return {d:sent,r:'',s:me};
  if(o.mg)return {d:o.mg,r:'',s:me};
  if(o.ph==='set')return {d:'',r:'',s:-1};
  return of(o.md===1?lastOf(me>=0?me:-1):lastOf(-1));
}

/* ---------- 3D: 앉은 카메라(모든 게임과 같음) 그대로, 내 쪽 탁자 위 장치 ----------
   앞에서 뒤로: 자판 두 줄(나무 띠) · 램프 줄 · 경첩으로 세운 플립 판과 옆 칸(또는 버저) · 그 뒤 맞은편으로 깔리는 영수증.
   시작할 때 공통 디스플레이(폭 1.5 · 깊이 .5, 경첩 z 3.9) 자리에서 넘겨받아 앞으로 나오며 넓어짐. 크기는 모든 기기에서 같음 */
const PW=3,ROW=.4,RMAX=12,PH=ROW*RMAX,SLOT_Z=1.3;       // 영수증: 폭, 줄 깊이, 줄 수, 길이, 틈 자리
const BW=2.62,BD=1,BX=-.42,HZ=2.84,BA=2.2,BTH=.07;      // 플립 판: 폭, 높이, 가운데 x, 경첩 z, 열린 각도, 두께
const SW=.76,SX=1.32,ZX=1.24,ZZ=2.42;                                   // 옆 칸: 폭, 가운데 x
const KW=.51,KH=.58,KZ=4.05,LMW=.324,LMH=.5,LMZ=3.2;     // 키 간격·깊이, 자판 가운데 z, 램프 간격·깊이, 램프 줄 z
const Nb={on:false,built:false,fail:false,root:null,dirty:true,gn:-1,down:{},holdAt:0,deny:0,keysDirty:true,rows:0,printAt:0,flaps:[],feedAt:-1e9,lastBz:-1,winAt:0,seen:0,sideK:'',boardK:'',outAt:0,morph:1,rise:1};
const ease=k=>k<=0?0:k>=1?1:k*k*(3-2*k);
const dropY=(x,h)=>x>=1?0:x<.68?h*(1-(x/.68)*(x/.68)):h*.13*Math.sin(Math.PI*(x-.68)/.32);
const BCW=1024,BCH=392,SCW=298,SCH=392;
function woodFill(g,w,h,base,dark){g.fillStyle=base;g.fillRect(0,0,w,h);g.strokeStyle=dark;g.globalAlpha=.16;for(let i=0;i<34;i++){g.lineWidth=1+(i%3);g.beginPath();const y=(i*53)%h;g.moveTo(0,y);g.bezierCurveTo(w*.3,y+7,w*.6,y-7,w,y+2);g.stroke()}g.globalAlpha=1}
function keyCanvas(k,lamp,lit){
  const c=document.createElement('canvas');c.width=lamp?76:128;c.height=lamp?104:128;const g=c.getContext('2d'),w=c.width,h=c.height;
  if(lamp){
    const gr=g.createLinearGradient(0,0,0,h);gr.addColorStop(0,lit?'#ffd989':'#3b3029');gr.addColorStop(1,lit?'#f4a93a':'#2a221d');g.fillStyle=gr;g.fillRect(0,0,w,h);
    g.fillStyle=lit?'#3b2410':'#6f6054';g.font='700 56px "IBM Plex Mono", monospace';g.textAlign='center';g.textBaseline='middle';g.fillText(k,w/2,h/2+3);
  }else{
    g.fillStyle=k==='enter'?'#f4e3bc':k==='del'?'#e6d6ba':'#fbf3e4';g.fillRect(0,0,w,h);
    g.strokeStyle='#3b2a1f';g.fillStyle='#3b2a1f';g.lineCap='round';g.lineJoin='round';
    if(k==='enter'){g.lineWidth=10;g.beginPath();g.moveTo(94,28);g.lineTo(94,78);g.lineTo(42,78);g.stroke();g.beginPath();g.moveTo(24,78);g.lineTo(50,56);g.lineTo(50,100);g.closePath();g.fill()}
    else if(k==='del'){g.lineWidth=9;g.beginPath();g.moveTo(44,30);g.lineTo(108,30);g.lineTo(108,98);g.lineTo(44,98);g.lineTo(16,64);g.closePath();g.stroke();g.beginPath();g.moveTo(60,48);g.lineTo(92,80);g.moveTo(92,48);g.lineTo(60,80);g.stroke()}
    else{g.font='700 78px "IBM Plex Mono", monospace';g.textAlign='center';g.textBaseline='middle';g.fillText(k,w/2,h/2+5)}
  }
  const t=new THREE.CanvasTexture(c);t.anisotropy=4;return t;
}
function nbBuild(){
  if(Nb.built||Nb.fail)return Nb.built;
  if(!T.ok||typeof THREE==='undefined'){Nb.fail=true;return false}
  try{
    const root=new THREE.Group();root.visible=false;
    const clipY=[new THREE.Plane(new THREE.Vector3(0,1,0),-.001)];   // 탁자 윗면 아래는 안 보임 (틈에서 올라오는 물건)
    const clipAll=g=>g.traverse(o=>{if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{m.clippingPlanes=clipY})});
    const wood=toon({color:0x6e4526}),back=toon({color:0x7a4a28,rim:.1}),dark=toon({color:0x2b1d14,rim:0});
    /* 세운 판 하나: 공통 디스플레이처럼 경첩(pivot)에서 패널이 들림. 화면은 패널 아랫면 */
    const panel=(w,cv,cw,ch)=>{
      cv.width=cw;cv.height=ch;const tx=new THREE.CanvasTexture(cv);tx.anisotropy=8;
      const pivot=new THREE.Group(),sc=new THREE.Group(),p=new THREE.Group();pivot.add(sc);sc.add(p);p.position.z=BD/2;
      const box=new THREE.Mesh(new THREE.BoxGeometry(w,BTH,BD),[wood,wood,back,dark,wood,wood]);box.position.y=-BTH/2;box.castShadow=true;p.add(box);hull(new THREE.BoxGeometry(w+.035,BTH+.03,BD+.035),box,p);
      const scr=new THREE.Mesh(new THREE.PlaneGeometry(w*.97,BD*.95),new THREE.MeshBasicMaterial({map:tx}));scr.rotation.x=Math.PI/2;scr.position.y=-BTH-.002;p.add(scr);
      return {pivot,sc,tx,scr,box};
    };
    const bc=document.createElement('canvas'),P=panel(BW,bc,BCW,BCH);root.add(P.pivot);Nb.bc=bc;Nb.bt=P.tx;Nb.gB=P.pivot;Nb.bSc=P.sc;
    const sc=document.createElement('canvas'),Q=panel(SW,sc,SCW,SCH);root.add(Q.pivot);Nb.sc=sc;Nb.st=Q.tx;Nb.gS=Q.pivot;Nb.sMesh=Q.scr;Q.scr.userData.hit={t:'side'};Q.box.userData.hit={t:'side'};clipAll(Q.pivot);
    // 버저 (경주)
    const gZ=new THREE.Group(),base=new THREE.Mesh(new THREE.CylinderGeometry(.36,.4,.14,32),toon({color:0x3a302a,rim:.2}));base.position.y=.07;base.castShadow=true;gZ.add(base);hull(new THREE.CylinderGeometry(.38,.42,.16,32),base,gZ);
    const domeM=toon({color:0xd8382a,rim:.35}),dome=new THREE.Mesh(new THREE.SphereGeometry(.3,28,14,0,Math.PI*2,0,Math.PI/2),domeM);dome.scale.y=.8;dome.position.y=.14;dome.castShadow=true;gZ.add(dome);hull(new THREE.SphereGeometry(.315,28,14,0,Math.PI*2,0,Math.PI/2),dome,gZ);
    const ring=new THREE.Mesh(new THREE.RingGeometry(.31,.37,48,1),new THREE.MeshBasicMaterial({color:0xffd24a}));ring.rotation.x=-Math.PI/2;ring.position.y=.145;ring.geometry.setDrawRange(0,0);gZ.add(ring);
    base.userData.hit=dome.userData.hit={t:'buzz'};root.add(gZ);clipAll(gZ);Nb.gZ=gZ;Nb.dome=dome;Nb.domeM=domeM;Nb.ringM=ring;
    const zHole=new THREE.Mesh(new THREE.CircleGeometry(.44,36),new THREE.MeshBasicMaterial({color:0x15100c}));zHole.rotation.x=-Math.PI/2;root.add(zHole);Nb.zHole=zHole;
    // 자판과 램프가 올라오는 틈
    const slit=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({color:0x15100c}));slit.rotation.x=-Math.PI/2;root.add(slit);Nb.slit=slit;
    const gK=new THREE.Group(),ks=toon({color:0xd9c7a8,rim:.2}),lside=toon({color:0x3b3029,rim:.1}),kw=KW-.045;Nb.keys=[];Nb.lamps=[];
    KEYROW.forEach((k,i)=>{
      const top=new THREE.MeshBasicMaterial({map:keyCanvas(k)}),c=i%6,r=i<6?0:1;
      const m=new THREE.Mesh(new THREE.BoxGeometry(kw,.2,KH-.05),[ks,ks,top,ks,ks,ks]);m.position.set((c-2.5)*KW,.0,KZ+(r-.5)*KH);m.castShadow=true;gK.add(m);hull(new THREE.BoxGeometry(kw+.022,.22,KH-.028),m,gK);
      m.userData.hit={t:'key',k};Nb.keys.push({k,m,top});
    });
    LAMPS.forEach((k,i)=>{
      const on=new THREE.MeshBasicMaterial({map:keyCanvas(k,true,true)}),off=keyCanvas(k,true,false),lw=LMW-.03;
      const m=new THREE.Mesh(new THREE.BoxGeometry(lw,.16,LMH),[lside,lside,on,lside,lside,lside]);m.position.set((i-4.5)*LMW,0,LMZ);m.castShadow=true;gK.add(m);hull(new THREE.BoxGeometry(lw+.02,.18,LMH+.02),m,gK);
      m.userData.hit={t:'lamp',k};Nb.lamps.push({k,m,on,onT:on.map,offT:off});
    });
    clipAll(gK);root.add(gK);Nb.gK=gK;
    // 영수증: 디스플레이 뒤 틈에서 나와 맞은편으로 깔림 (아래가 최신 줄)
    const pc=document.createElement('canvas');pc.width=680;pc.height=54*(RMAX+1);const ptx=new THREE.CanvasTexture(pc);ptx.anisotropy=8;
    const gP=new THREE.Group(),brass=toon({color:0xb8925a,rim:.3}),slot=new THREE.Mesh(new THREE.BoxGeometry(PW+.16,.05,.13),brass);slot.position.set(0,.03,.03);slot.castShadow=true;gP.add(slot);hull(new THREE.BoxGeometry(PW+.19,.07,.16),slot,gP);
    const sheet=new THREE.Group();gP.add(sheet);
    const geo=new THREE.PlaneGeometry(PW,PH);geo.translate(0,PH/2,0);
    const paper=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({map:ptx}));paper.rotation.x=-Math.PI/2;paper.position.y=.03;paper.userData.hit={t:'paper'};sheet.add(paper);
    const ig=new THREE.PlaneGeometry(PW+.05,PH+.03);ig.translate(0,PH/2,0);
    const ink=new THREE.Mesh(ig,new THREE.MeshBasicMaterial({color:GFX_INK}));ink.rotation.x=-Math.PI/2;ink.position.y=.025;sheet.add(ink);
    gP.position.set(0,0,SLOT_Z);root.add(gP);Nb.gP=gP;Nb.sheet=sheet;Nb.pc=pc;Nb.pt=ptx;
    Nb.hitObjs=[...Nb.keys.map(k=>k.m),...Nb.lamps.map(l=>l.m),base,dome,Q.scr,paper];
    T.scene.add(root);Nb.root=root;Nb.built=true;pose(1,1);
  }catch(e){Nb.fail=true;try{console.warn('숫자야구 3D 준비 실패',e)}catch(_){}}
  return Nb.built;
}
/* 장치 모습: morph 0 = 공통 디스플레이 자리·크기 → 1 = 게임 플립 판, rise 0 = 탁자 속 → 1 = 자판·램프·옆 칸·버저가 다 올라옴 */
function pose(morph,rise){
  Nb.morph=morph;Nb.rise=rise;
  const mix=(a,b)=>a+(b-a)*morph,race=!!(V&&V.o&&V.o.md===2);
  Nb.gB.position.set(mix(0,BX),.004,mix(3.9,HZ));Nb.gB.rotation.x=-mix(2.05,BA);Nb.bSc.scale.set(mix(1.5/BW,1),1,mix(.5/BD,1));
  const up=smooth(clamp01((rise-.35)/.65)),op=smooth(clamp01(rise/.35));   // 틈이 먼저 열리고 올라옴
  Nb.slit.visible=op>.01;Nb.slit.scale.set(Math.max(.001,op*(LMW*10+.06)),KZ+KH-LMZ+LMH/2+.06,1);Nb.slit.position.set(0,.008,(KZ+KH+LMZ-LMH/2)/2);
  Nb.gK.visible=up>.01;Nb.gK.position.y=-.14+.2*up-(1-up)*.1;
  Nb.gS.visible=!race&&up>.01;Nb.gS.position.set(SX,-(1-up)*1.1+.004,HZ);Nb.gS.rotation.x=-BA;
  Nb.zHole.visible=race&&op>.01;Nb.zHole.scale.setScalar(Math.max(.001,op));Nb.zHole.position.set(ZX,.018,ZZ);
  Nb.gZ.visible=race&&up>.01;Nb.gZ.position.set(ZX,-(1-up)*.5,ZZ);
  Nb.gP.visible=rise>.5;
  
}
/* 플립 칸 */
function flapsReset(){
  const o=V.o,n=o.L+5;Nb.flaps=[...Array(n)].map(()=>({ch:' ',to:' ',until:0,next:0,mid:0}));Nb.dot=-1;Nb.boardK='';
}
function setFlap(i,ch,at,dur){const f=Nb.flaps[i];if(!f||f.to===ch&&f.until<1e12)return;f.to=ch;f.until=at+dur}
/* 내용이 바뀌면 칸마다 차례로 넘어감: 입력은 바로, 결과는 한 칸씩 탁탁 */
function boardSync(){
  if(!Nb.on||!V||!V.o||!Nb.flaps.length)return;
  const o=V.o,w=boardWant(),L=o.L,t=clock(),key=JSON.stringify(w);
  if(key===Nb.boardK)return;Nb.boardK=key;
  const typing=!!(buf&&w.d===buf)||(!buf&&w.d===''&&!w.spin)||(sent&&w.d===sent);
  for(let i=0;i<L;i++){
    if(w.spin){Nb.flaps[i].to=' ';Nb.flaps[i].until=1e12;continue}
    const ch=w.d[i]||' ';
    if(Nb.flaps[i].until>=1e12)Nb.flaps[i].until=0;
    setFlap(i,ch,t,typing?80:90+i*70);
  }
  const rs=w.r.padEnd(5,' ');
  for(let i=0;i<5;i++)setFlap(L+i,rs[i],t,w.r?360+L*40+i*190:60);
  Nb.dot=w.s;
}
function boardStep(t){
  let busy=false,draw=false;
  for(const f of Nb.flaps){
    if(t<f.until){busy=true;if(t>=f.next){f.next=t+55;f.ch='0123456789SBOUT'[Math.random()*15|0];f.mid=1;draw=true;if(!Nb.fsnd||t-Nb.fsnd>80){Nb.fsnd=t;sfx('flap')}}}
    else if(f.ch!==f.to||f.mid){f.ch=f.to;f.mid=0;draw=true}
  }
  const hk=(buf.length===(V&&V.o&&V.o.L)&&canType())?1:0;
  if(draw||Nb.drawn!==Nb.dot+'|'+hk){Nb.drawn=Nb.dot+'|'+hk;boardDraw()}
  return busy;
}
function flapCell(g,x,y,w,h,c,mid,lit){
  g.fillStyle='#231a13';rr(g,x,y,w,h,12);g.fill();g.fillStyle='#35281e';rr(g,x,y,w,h/2,12);g.fill();g.fillRect(x,y+h/2-12,w,12);
  g.fillStyle='rgba(0,0,0,.6)';g.fillRect(x,y+h/2-2,w,4);
  if(c!==' '){g.save();g.beginPath();g.rect(x,y,w,h);g.clip();g.fillStyle=lit||'#f6ecd8';g.font=`700 ${Math.round(Math.min(h*.68,w*1.42))}px "IBM Plex Mono", monospace`;g.textAlign='center';g.textBaseline='middle';
    g.translate(x+w/2,y+h/2+4);if(mid){g.globalAlpha=.85;g.scale(1,.84)}g.fillText(c,0,0);g.restore()}
  g.fillStyle='#3a2c22';g.fillRect(x-3,y+h/2-8,5,16);g.fillRect(x+w-2,y+h/2-8,5,16);
}
function boardDraw(){
  const o=V&&V.o;if(!o||!Nb.bc)return;
  const g=Nb.bc.getContext('2d'),L=o.L,gap=8,mid=28,cw=Math.floor((BCW-96-mid)/(L+5))-gap,tw=(L+5)*(cw+gap)-gap+mid,x0=(BCW-tw)/2+14,h=296,y=(BCH-h)/2;
  woodFill(g,BCW,BCH,'#a97240','#54301a');
  g.fillStyle='#120c08';rr(g,20,26,BCW-40,BCH-52,20);g.fill();
  Nb.flaps.forEach((f,i)=>{const x=x0+i*(cw+gap)+(i>=L?mid:0);flapCell(g,x,y,cw,h,f.ch,f.mid,i>=L&&(f.to==='S'||/[0-9]/.test(f.to))?'#ffd989':'')});
  if(Nb.dot>=0){g.fillStyle=SEAT_C[Nb.dot]||'#888';g.beginPath();g.arc(x0-20,BCH/2,12,0,7);g.fill();g.strokeStyle='#f6ecd8';g.lineWidth=4;g.stroke()}
  Nb.bt.needsUpdate=true;
}
function sideDraw(){
  const o=V&&V.o;if(!o||!Nb.sc)return;
  const set=o.md===1&&o.ph==='set'&&V.st==='play',txt=o.md===0?String(Math.max(0,o.left)):o.md===1&&o.my?(secHide?'•'.repeat(o.L):o.my):'';
  const key=[o.md,set,txt,secHide].join('|');if(key===Nb.sideK)return;Nb.sideK=key;
  const g=Nb.sc.getContext('2d'),w=SCW,h=SCH;
  woodFill(g,w,h,'#a97240','#54301a');g.fillStyle='#120c08';rr(g,14,26,w-28,h-52,18);g.fill();
  if(set){g.fillStyle='#fffaf0';rr(g,w/2-74,h/2-74,148,148,26);g.fill();g.fillStyle='#cc3a2e';for(const [a,b] of [[-40,-40],[40,-40],[0,0],[-40,40],[40,40]]){g.beginPath();g.arc(w/2+a,h/2+b,14,0,7);g.fill()}}
  else if(o.md===0){const s=txt.padStart(2,' ');flapCell(g,w/2-98,70,92,250,s[0],0,'#ffd989');flapCell(g,w/2+6,70,92,250,s[1],0,'#ffd989')}
  else if(o.md===1&&txt){const n=txt.length,cw=Math.min(46,(w-54)/n-4),x0=(w-n*(cw+4)+4)/2;[...txt].forEach((c,i)=>flapCell(g,x0+i*(cw+4),66,cw,150,c,0));
    g.strokeStyle='#f6ecd8';g.lineWidth=7;g.lineCap='round';g.beginPath();g.ellipse(w/2,282,42,23,0,0,7);g.stroke();g.beginPath();g.arc(w/2,282,10,0,7);g.stroke();
    if(secHide){g.beginPath();g.moveTo(w/2-44,314);g.lineTo(w/2+44,250);g.stroke()}}
  Nb.st.needsUpdate=true;
}
/* 영수증 그림: 아래가 최신 줄. 맞대결은 한 턴이 한 줄(왼쪽 내 것, 오른쪽 상대) */
function paperRows(n){
  const o=V.o,rec=o.rec.slice(0,n);
  if(o.md!==1)return rec.map(r=>({n:r.n,a:r}));
  const m=new Map();for(const r of rec){if(!m.has(r.n))m.set(r.n,{n:r.n,c:{}});m.get(r.n).c[r.s]=r}
  return [...m.values()];
}
function paperDraw(){
  const o=V&&V.o;if(!o||!Nb.pc)return;
  const g=Nb.pc.getContext('2d'),W=Nb.pc.width,Hc=Nb.pc.height,rh=54,rows=paperRows(Nb.seen),me=meIdx(),a=me>=0?me:0;
  g.fillStyle='#fbfaf4';g.fillRect(0,0,W,Hc);
  const line=rows.slice(-RMAX);
  const mono=(s,x,y,b)=>{g.font=`${b?800:600} 34px ui-monospace,"IBM Plex Mono",monospace`;g.fillText(s,x,y)};
  const dot=(x,y,c)=>{g.fillStyle=c;g.beginPath();g.arc(x,y,11,0,7);g.fill()};
  g.textBaseline='middle';g.textAlign='left';
  line.forEach((r,k)=>{
    const y=Hc-(line.length-k)*rh+rh/2+1;
    if(k%2===0){g.fillStyle='rgba(120,96,60,.08)';g.fillRect(0,y-rh/2,W,rh)}
    g.fillStyle='rgba(44,38,32,.55)';g.textAlign='right';mono(String(r.n),60,y);g.textAlign='left';
    const cell=(q,x)=>{if(!q){return}dot(x+12,y,SEAT_C[q.s]);g.fillStyle=q.x&&q.S!==o.L?'#b0271c':'#2c2620';
      if(!q.g){mono('시간 초과',x+36,y);return}
      mono(q.g,x+36,y,q.S===o.L);mono(resText(q.S,q.B).replace(' ',''),x+36+22*(o.L+1),y,q.S===o.L)};
    if(o.md===1){cell(r.c[a],72);cell(r.c[1-a],372)}
    else{const q=r.a;cell(q,84);if(q.x){g.fillStyle='#b0271c';mono(q.S===o.L?'버저 성공':'버저',W-(q.S===o.L?196:100),y,1)}}
  });
  Nb.pt.needsUpdate=true;
}
function paperStep(t){
  const o=V.o,tot=o.rec.length;
  if(Nb.seen<tot&&t>=Nb.printAt){
    const was=paperRows(Nb.seen).length;Nb.seen=tot;
    if(paperRows(tot).length>was){Nb.feedAt=t;sfx('rcPrint',1)}
    paperDraw();
  }
  const n=paperRows(Nb.seen).length,fp=ease((t-Nb.feedAt)/280),show=Math.min(n,RMAX),len=show-(n<=RMAX?1-fp:0),off=(1-fp)/(RMAX+1);
  Nb.sheet.visible=len>.001;
  if(len>.001){Nb.sheet.scale.z=1;Nb.sheet.children.forEach(m=>{m.scale.y=len/RMAX});Nb.pt.repeat.set(1,len/(RMAX+1));Nb.pt.offset.set(0,off)}
  return fp<1;
}
/* 새 상태 → 화면 */
function nbSync(){
  if(!V||!V.o)return;
  const o=V.o;
  lampLoad();
  if(o.gn!==curG){curG=o.gn;buf='';sent='';Nb.seen=0;Nb.printAt=0;Nb.lastBz=-1;Nb.winAt=0;Nb.sideK='';Nb.deadSeen=0;Nb.resSeen=0;Nb.keysDirty=true;if(Nb.on){flapsReset();paperDraw()}}
  if(!Nb.on)return;
  if(!Nb.flaps.length)flapsReset();
  const t=clock();
  if(o.rec.length>Nb.resSeen){   // 새 결과: 공개가 끝날 때 찍힘
    const r=o.rec[o.rec.length-1],me=meIdx(),mine=o.md===1?(o.rec.slice(Nb.resSeen).find(x=>x.s===me)||r):r;
    const first=!Nb.resSeen&&o.rec.length>1;
    Nb.printAt=first?0:t+RV_MS-120;
    if(!first){
      const dur=360+o.L*40+resText(mine.S,mine.B).length*190;
      if(mine.g&&mine.S===o.L)setTimeout(()=>{sndHomer();const n=clock();Nb.flaps.forEach((f,i)=>{f.until=n+300+i*70})},dur);   // 다 맞히면 판 전체가 촤르륵
      else if(mine.g&&!mine.S&&!mine.B)setTimeout(sndOut,dur);
      else if(mine.g)setTimeout(sndHit,dur);
      if(r.x&&r.S!==o.L&&V.ps[r.s])setTimeout(()=>fxSay(`${V.ps[r.s].n} 사망`,'#b0271c'),dur);
    }
    Nb.resSeen=o.rec.length;
  }
  if(o.bz>=0&&Nb.lastBz<0){sndBuzz();fxSay(`${nm(o.bz)} 버저!`,SEAT_C[o.bz])}
  Nb.lastBz=o.bz;
  if(sent&&(clock()-sentAt>600||o.rec.some(r=>r.g===sent)||o.mg===sent))sent='';
  if(!canType()&&o.ph!=='set'&&o.ph!=='guess'&&o.ph!=='buzz')buf='';
  if(V.st==='over'&&o.md===0&&o.res&&o.res.w!==0&&!Nb.winAt){Nb.winAt=t;setTimeout(sndFail,300)}
  boardSync();sideDraw();
}
function nbRender(t){
  if(!Nb.on||!T.ok)return;
  if(IN.on3d)introStep(t);
  boardStep(t);paperStep(t);
  const o=V&&V.o,on=canType();
  if(Nb.keysDirty){Nb.keysDirty=false;for(const L of Nb.lamps){const d=lampOff.has(L.k);if(L.on.map!==(d?L.offT:L.onT)){L.on.map=d?L.offT:L.onT;L.on.needsUpdate=true}L.m.position.y=d?-.03:0}}
  for(const K of Nb.keys){
    const e=t-(Nb.down[K.k]||-1e9);K.m.position.y=e<130?-Math.sin(Math.PI*e/130)*.065:0;
    let c=on?1:.82;
    if(/[0-9]/.test(K.k)&&lampOff.has(K.k))c*=.62;
    if(K.k==='enter'&&on&&o&&buf.length===o.L){const p=.5+.5*Math.sin(t/170);K.top.color.setRGB(1,.86+.14*(1-p),.55+.45*(1-p))}
    else K.top.color.setScalar(c);
  }
  if(Nb.gZ.visible){
    const open=buzzOpen(),me=meIdx(),dead=me>=0&&o&&!isAlive(me);
    let prog=0;
    if(Nb.holdAt){if(!open)Nb.holdAt=0;else{prog=Math.min(1,(t-Nb.holdAt)/HOLD_MS);if(prog>=1){Nb.holdAt=0;prog=0;buzzGo()}}}
    Nb.ringM.geometry.setDrawRange(0,Math.floor(prog*48)*6);
    Nb.dome.position.y=.14-(prog>0?.07:0);
    Nb.domeM.color.setHex(dead?0x4a4038:open?0xd8382a:0x7a2a22);
  }
  T.timerBg.visible=T.timerArc.visible=false;
  T.r.render(T.scene,T.cam);
}
function sideShow(){
  if(!Nb.built||!V||!V.o)return;
  pose(Nb.morph,Nb.rise);
}

/* ---------- 시작 연출 (방장이 그동안 시간·봇을 멈춤) ----------
   0~.45초 대기실 자판이 틈으로 들어감(공통). .45~1.15초 디스플레이가 앞으로 나오며 넓어지고 플립이 촤르륵.
   .85~1.6초 틈이 열리고 큰 자판·램프·옆 칸(버저)이 올라옴. 경주는 1.75초부터 펠트 가운데서 첫 차례 주사위 */
const INTRO={ui:650,morph:[450,700],rise:[850,750],dice:1750,diceA:300,end:1700,endA:250};
const DIE=.56;
G.introMs=(again,rolls)=>Math.round(rolls?(again?INTRO.diceA:INTRO.dice)+DicePick.totalFor(rolls)+100:(again?INTRO.endA:INTRO.end));
const IN={on:false,on3d:false,t0:0,total:0,r:0,again:false,fromLobby:true,said:false,fp:null,die:null,thud:{}};
const introOn=()=>IN.on&&clock()<IN.t0+IN.total;
const introWait=()=>introOn()&&!IN.said;
G.intro=(t0,o)=>{
  if(!V||!V.o||!V.ps)return;
  const rolls=o&&o.rolls,seed=(o&&o.seed)||1,race=V.o.md===2;
  IN.on=true;IN.t0=t0;IN.said=false;IN.thud={};IN.fromLobby=!Nb.on;IN.again=!!(o&&o.again)&&!IN.fromLobby;
  IN.r=IN.again?INTRO.diceA:INTRO.dice;IN.total=(o&&o.total)||G.introMs(IN.again,rolls);
  if(IN.die){IN.die.dispose();IN.die=null}
  IN.fp=race&&rolls?firstPick(t0+IN.r,{seats:V.ps.map((_,i)=>i),first:V.o.first,rolls,seed}):null;
  IN.on3d=true;
  $('#stage').classList.add('nb-intro');if(elNb&&IN.fromLobby)elNb.classList.add('intro');
  lastBar='';
};
function introStep(now,force){
  if(!Nb.built||!V||!V.o)return false;
  const e=now-IN.t0,done=force||e>=IN.total;
  if(done)IN.on3d=false;
  if(IN.fromLobby&&!done){
    const m=smooth(clamp01((e-INTRO.morph[0])/INTRO.morph[1])),r=clamp01((e-INTRO.rise[0])/INTRO.rise[1]);
    pose(m,r);
    if(e>=INTRO.rise[0]&&!IN.thud.a){IN.thud.a=1;sfx('lid')}
    if(e>=INTRO.morph[0]&&!IN.thud.b){IN.thud.b=1;const n=now;Nb.flaps.forEach((f,i)=>{f.until=n+INTRO.morph[1]+i*40})}
  }else if(Nb.morph<1||Nb.rise<1)pose(1,1);
  if(IN.fp&&!IN.fp.fixed){
    if(!IN.die&&!done&&Nb.root){IN.die=DicePick.mesh(THREE,V.ps.length,SEAT_C);Nb.root.add(IN.die.g)}
    if(IN.die)IN.die.apply(done||e<IN.r?null:IN.fp.pose(now),DIE,0,.03,-.8);
  }
  if(done&&IN.die){IN.die.dispose();IN.die=null}
  return true;
}
function introEnd(){
  if(IN.on3d)introStep(clock(),true);
  if(IN.die){IN.die.dispose();IN.die=null}
  IN.on=false;IN.on3d=false;IN.said=true;
  $('#stage').classList.remove('nb-intro');if(elNb)elNb.classList.remove('intro');
}
function introTick(){
  if(!IN.on)return;
  const e=clock()-IN.t0;
  if(e>=INTRO.ui&&elNb&&elNb.classList.contains('intro'))elNb.classList.remove('intro');
  if(!IN.fp&&e>=IN.total){IN.said=true}
  if(IN.fp&&e>=IN.r&&IN.fp.tick(IN.t0+e)){IN.said=true;fxSay(IN.fp.msg(),SEAT_C[IN.fp.first]);lastBar=''}
  if(e>=IN.total){IN.on=false;IN.said=true;$('#stage').classList.remove('nb-intro');if(elNb)elNb.classList.remove('intro');lastBar='';lastHint=''}
  drawAll();
}
/* 누른 곳 → 탁자 위 물건 (실제 물건을 맞힘: 비스듬한 시점에서도 보이는 그대로) */
function hitAt(e){
  if(!Nb.on||!Nb.hitObjs)return null;
  const r=T.r.domElement.getBoundingClientRect();if(!r.width)return null;
  const ray=Nb.ray||(Nb.ray=new THREE.Raycaster());
  ray.setFromCamera({x:(e.clientX-r.left)/r.width*2-1,y:-(e.clientY-r.top)/r.height*2+1},T.cam);
  const objs=Nb.hitObjs.filter(o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true});
  const h=ray.intersectObjects(objs,false)[0];
  return h?h.object.userData.hit:null;
}
function onDown(e){
  const h=hitAt(e);if(!h||!V||!V.o)return;
  if(h.t==='buzz')holdStart();
  else if(h.t==='lamp')lampToggle(h.k);
  else if(h.t==='key')press(h.k);
  else if(h.t==='side')sideTap();
  else if(h.t==='paper'&&typeof rcptOpen==='function')rcptOpen();
}
/* 새 상태를 받았을 때 */
G.preView=()=>{};
G.postView=()=>{};
G.overDelay=()=>Nb.on?2800:0;
G.overExtra=()=>{
  if(!V||!V.o||!V.o.rec||!V.o.rec.length)return '';
  return `<div class="qd-rec"><div class="qd-rec-h"><b>기록</b></div><pre>${esc(recordText(V))}</pre></div>`;
};
G.logCue=()=>false;
G.cues=()=>{};
G.hud=inGame=>{
  if(!elNb)return;
  const on=!!(inGame&&V&&V.o);
  elNb.hidden=!on;
  $('#stage').classList.toggle('nb-over',!!(on&&V.st==='over'));
  const d3=on&&nbBuild();
  if(d3!==Nb.on){Nb.on=d3;if(d3){Nb.root.visible=true;Nb.outAt=0}else if(Nb.root&&Nb.root.visible){Nb.outAt=clock()}$('#stage').classList.toggle('nb3d',d3);last2d='';lastHint='';if(d3&&V&&V.o){curG=0}}
  $('#stage').classList.toggle('nb2d',on&&!d3);
  if(!on){lastBar='';lastHint='';last2d='';return}
  nbSync();sideShow();drawAll();
};
G.handMarks=()=>{};
G.me=()=>{$('#numpick').hidden=true};
G.overRank=p=>{
  const r=V&&V.o&&V.o.res,t=p.sr===3?'탈주':p.sr?'항복':r&&r.w<0&&V.o.md?'무승부':V&&V.o&&V.o.md===0?(r&&r.w===0?'성공':'실패'):'';
  return t?`<span class="left">${t}</span>`:'';
};
G.no3D=true;
G.ownBoard=true;   // 게임 중에는 공통 디스플레이를 이 게임의 플립 판이 넘겨받음
G.noView=true;     // 자판을 누르는 게임이라 고개 돌리기를 쓰지 않음
G.buttons=()=>{$('#btnPass').hidden=true;$('#btnGura').hidden=true};
G.live=()=>{
  if(IN.on)introTick();
  if(!V||!V.o||!elNb)return;
  elNb.querySelectorAll('[data-ct]').forEach(el=>{
    const i=+el.dataset.ct,o=V.o,run=V.st==='play'&&V.dl>0&&!introWait()&&(V.t===i||(o.md===1&&o.dn&&!o.dn[i]));
    const left=run?Math.max(0,V.deadAt-clock()):0,txt=run?String(Math.ceil(left/1000)):'';
    if(el.textContent!==txt)el.textContent=txt;
    const low=run&&left<=5000;if(el.parentNode.classList.contains('low')!==low)el.parentNode.classList.toggle('low',low);
  });
  if(sent&&clock()-sentAt>800){sent='';boardSync()}
  if(canType()&&V.o.ph==='buzz'&&!Nb.on)drawAll();
};
G.play=()=>{if(canType())submit()};
G.pass=()=>{};
G.keyPhase=st=>st==='play';
G.onKey=()=>false;
G.field3D=()=>{if(T.stacks)for(const arr of T.stacks.values())arr.forEach(c=>{c.visible=false})};
G.render3D=t=>{
  if(Nb.on){nbRender(t);return}
  if(Nb.outAt&&Nb.root){   // 대기실로 돌아갈 때: 자판이 들어가고 판이 디스플레이 자리로
    const e=t-Nb.outAt,k=clamp01(e/500);pose(1-smooth(k),1-k);
    if(k>=1){Nb.outAt=0;Nb.root.visible=false}
  }
  if(T.ok&&!$('#stage').classList.contains('nb2d'))T.r.render(T.scene,T.cam);
};
G.enter=()=>{
  $('#stage').classList.add('nbg');
  $('#btnPass').hidden=true;$('#btnGura').hidden=true;$('#numpick').hidden=true;
};
G.leave=()=>{
  introEnd();Nb.holdAt=0;
  $('#stage').classList.remove('nbg','nb-over','nb3d','nb2d');
  if(T.stacks)for(const arr of T.stacks.values())arr.forEach(c=>{c.visible=true});
  if(Nb.root)Nb.root.visible=false;Nb.outAt=0;Nb.on=false;curG=0;
  $('#btnPass').hidden=false;
  if(elNb){elNb.hidden=true;lastBar='';lastHint='';last2d=''}
};
/* 대기실 홀로그램의 대표 말: 야구공과 숫자 타일 */
G.holoPiece=mk=>{
  const g=new THREE.Group();
  const nt=canvasTex(128,184,(x,w,h)=>{x.fillStyle='#fff';x.fillRect(0,0,w,h);x.fillStyle='#3a3a3e';x.font='700 112px "IBM Plex Mono", monospace';x.textAlign='center';x.textBaseline='middle';x.fillText('7',w/2,h/2+6)});
  const bt=canvasTex(256,128,(x,w,h)=>{x.fillStyle='#fff';x.fillRect(0,0,w,h);x.strokeStyle='#d33';x.lineWidth=5;for(const c of [52,204]){x.beginPath();x.arc(c,64,58,-1.2,1.2);x.stroke()}});
  const a=new THREE.Mesh(new THREE.BoxGeometry(.3,.43,.06),[mk(0xf1ebde),mk(0xf1ebde),mk(0xf1ebde),mk(0xf1ebde),mk(0xffffff,nt),mk(0xf1ebde)]);a.position.set(-.13,.04,-.04);a.rotation.set(-.1,.3,.1);g.add(a);
  const b=new THREE.Mesh(new THREE.SphereGeometry(.19,22,16),mk(0xffffff,bt));b.position.set(.14,-.06,.05);b.rotation.set(.3,.6,.2);g.add(b);
  return g;
};
G.init=()=>{
  const css=document.createElement('style');
  css.textContent=`
.stage.nbg.nb2d #cv,.stage.nbg #dim{visibility:hidden}
.stage.nbg .actions,.stage.nbg #numpick{display:none}
.stage.nbg .labels{visibility:hidden}
.stage.nbg .nogl{display:none}
.stage.nb-intro .myplate{opacity:0;pointer-events:none}
.stage.nbg.nb-over .myplate{display:none}
.specbar:not([hidden])~#nb .nb-bar{margin-top:30px}
#nb{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 8px 0;pointer-events:none;min-height:0}
#nb[hidden]{display:none}
#nb .nb-bar{min-height:30px;display:flex;flex-wrap:wrap;justify-content:center;gap:4px 6px;max-width:calc(100% - 96px);transition:opacity .35s}
#nb.intro .nb-bar,#nb.intro .nb-row{opacity:0}
@media (max-width:699px){#nb .nb-bar{align-self:flex-start;justify-content:flex-start;max-width:calc(100% - 104px)}}
#nb .nb-p{position:relative;display:flex;align-items:center;gap:5px;padding:3px 9px 4px;border-radius:11px;background:rgba(255,250,240,.92);border:1.5px solid var(--line-strong,#cdb391);font-size:13px;line-height:1.15;white-space:nowrap;max-width:100%}
#nb .nb-p .dot{width:10px;height:10px;border-radius:50%;flex:none;display:inline-block}
#nb .nb-p b{font-weight:600;overflow:hidden;text-overflow:ellipsis;max-width:6.5em}
#nb .nb-p .ok{color:#1f7a2e;font-size:10px}
#nb .nb-p .w{font-family:var(--f-num,monospace);font-size:13px;font-weight:700;color:#5b4129;min-width:1.5em;text-align:right}
#nb .nb-p .w:empty{display:none}
#nb .nb-p.low .w{color:#c0281c;animation:nbBlink 1s steps(2,start) infinite}
@keyframes nbBlink{50%{opacity:.25}}
#nb .nb-p .st{font-size:12px;color:var(--muted,#7a6550)}
#nb .nb-p.on{border-color:#c08a17;box-shadow:0 0 0 2px #f2b632}
#nb .nb-p.dead{opacity:.5}
#nb .nb-p.dead b{text-decoration:line-through}
#nb .nb-row{height:24px;flex:none;display:flex;align-items:center;justify-content:center;width:100%;transition:opacity .35s}
#nb .nb-hint{font-size:13px;line-height:1.3;color:#5b4129;background:rgba(255,250,240,.9);border-radius:99px;padding:2px 12px;white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}
#nb .nb-hint:empty{visibility:hidden}
.stage.nb2d #nb .nb-bar{max-width:calc(100% - 156px)}
#nb .nb-2d{display:none;flex:1;min-height:0;width:min(100%,520px);flex-direction:column;gap:8px;padding-bottom:78px;pointer-events:auto}
.stage.nb2d #nb .nb-2d{display:flex}
#nb .nb-list{flex:1;min-height:0;overflow:auto;margin:0;padding:6px 10px;list-style:none;background:#fbfaf4;border:1.5px solid #4a3020;border-radius:6px;font:600 15px var(--f-num,monospace);color:#2c2620}
#nb .nb-list li{display:flex;align-items:center;gap:7px;line-height:1.6}
#nb .nb-list .dot{width:10px;height:10px;border-radius:50%;display:inline-block}
#nb .nb-list em{font-style:normal;margin-left:auto}
#nb .nb-dsp{display:flex;align-items:center;gap:10px;background:#2b1d14;color:#f6ecd8;border-radius:10px;padding:8px 12px;font:700 28px var(--f-num,monospace);min-height:58px}
#nb .nb-res{color:#ffd989;flex:1}
#nb .nb-side{background:#4a3627;color:#ffd989;border:0;border-radius:8px;padding:6px 10px;font:700 16px var(--f-num,monospace)}
#nb .nb-buzz{width:50px;height:50px;border-radius:50%;background:#d8382a;border:4px solid #3a302a;cursor:pointer;touch-action:none}
#nb .nb-buzz.off{background:#7a2a22}
#nb .nb-lamps{display:grid;grid-template-columns:repeat(10,1fr);gap:3px}
#nb .nb-lamp{height:46px;border:1px solid #4a3020;border-radius:4px;background:#f4a93a;color:#3b2410;font:700 17px var(--f-num,monospace);padding:0}
#nb .nb-lamp.off{background:#3b3029;color:#6f6054}
#nb .nb-keys{display:grid;grid-template-columns:repeat(6,1fr);gap:4px}
#nb .nb-key{height:54px;border:1.5px solid #4a3020;border-radius:6px;background:#fbf3e4;color:#3b2a1f;font:700 22px var(--f-num,monospace);padding:0}
`;
  document.head.appendChild(css);
  elNb=document.createElement('div');elNb.id='nb';elNb.hidden=true;
  elNb.innerHTML=`<div class="nb-bar"></div><div class="nb-row"><div class="nb-hint" aria-live="polite"></div></div><div class="nb-2d"></div>`;
  $('#stage').insertBefore(elNb,$('#fx'));
  elBar=elNb.querySelector('.nb-bar');elHint=elNb.querySelector('.nb-hint');el2d=elNb.querySelector('.nb-2d');
  el2d.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.k)press(b.dataset.k);else if(b.dataset.l)lampToggle(b.dataset.l);else if(b.dataset.s)sideTap()});
  el2d.addEventListener('pointerdown',e=>{if(e.target.closest('.nb-buzz'))holdStart2d()});
  document.addEventListener('pointerup',()=>{if(Nb.holdAt)holdEnd();clearTimeout(Nb.t2d)});
  document.addEventListener('pointercancel',()=>{if(Nb.holdAt)holdEnd();clearTimeout(Nb.t2d)});
  function holdStart2d(){if(!buzzOpen()){sndNo();return}sfx('key');clearTimeout(Nb.t2d);Nb.t2d=setTimeout(buzzGo,HOLD_MS)}
  /* 키보드: 숫자는 입력, Shift+숫자는 램프 */
  const keyOn=()=>elNb&&!elNb.hidden&&V&&V.o&&V.st==='play'&&$('#rcOv').hidden;
  document.addEventListener('keydown',e=>{
    if(!keyOn()||e.ctrlKey||e.metaKey||e.altKey||(e.target&&e.target.matches&&e.target.matches('input,textarea')))return;
    const m=/^(?:Digit|Numpad)([0-9])$/.exec(e.code);
    if(m){e.preventDefault();e.stopImmediatePropagation();if(e.repeat)return;if(e.shiftKey)lampToggle(m[1]);else press(m[1]);return}
    if(e.code==='Backspace'){e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)press('del');return}
    if(e.code==='Enter'||e.code==='NumpadEnter'){e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)press('enter');return}
    if(e.code==='Space'&&V.o.md===2){e.preventDefault();e.stopImmediatePropagation();if(!e.repeat){if(Nb.on)holdStart();else{clearTimeout(Nb.t2d);if(buzzOpen())Nb.t2d=setTimeout(buzzGo,HOLD_MS);else sndNo()}}}
  },true);
  document.addEventListener('keyup',e=>{if(e.code==='Space'){if(Nb.holdAt)holdEnd();clearTimeout(Nb.t2d)}});
  $('#cv').addEventListener('pointerdown',onDown);
};
G._nb={Nb,IN,introEnd,pose,get buf(){return buf},get lamps(){return [...lampOff]},press,lampToggle,hitAt};   // 화면 검사용

(window.GAMES=window.GAMES||{}).baseball=G;
})();
