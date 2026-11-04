/* ===== 보난자 게임 모듈 =====
   3~5명. 콩을 심고 거래하고 수확해 코인을 가장 많이 모으는 카드 게임. 규칙은 AMIGO 현행 규칙서 기본 게임 기준.
   카드 id 0~103 = 콩 8종 104장. 손패 순서는 절대 바꾸지 않음(맨 앞이 다음에 심을 카드, 새 카드는 맨 뒤).
   단계 ph: p1(손패 심기) → trade(카드 2장 공개·거래) → p3(모두 임시 구역 심기, 동시) → 뽑기 3장 → 다음 사람. done은 끝.
   거래: 제안(offer)을 보내면 제안자의 수락, 받는 쪽이 수락하면 그 자리에서 교환. 제안 내용은 바꿀 수 없고 다시 보내면 새 제안(수락도 처음부터).
   받는 쪽에는 콩 종류만 보냄: 손패 카드 id·위치는 제안자에게만 있음(snap 참고). 거래로 받은 카드는 임시 구역으로 가고 다시 거래할 수 없음 */
(function(){
const G={id:'bohnanza',name:'보난자',short:'보난자',lead:'콩을 심고 거래해 코인을 모으는 카드 게임',dealAnim:true,maxHi:5,minN:3,noFast:true,oneBotLv:true,emptyHandOk:true};

/* ---------- 규칙 값 ---------- */
/* m: 1·2·3·4코인에 필요한 장수 (0이면 그 코인 칸 없음) */
const BEANS=[
  {n:'파랑콩',c:20,m:[4,6,8,10],col:'#3f7fc4'},{n:'고추콩',c:18,m:[3,6,8,9],col:'#d0502e'},{n:'구린콩',c:16,m:[3,5,7,8],col:'#8a7a2f'},{n:'초록콩',c:14,m:[3,5,6,7],col:'#4f9a4a'},
  {n:'메주콩',c:12,m:[2,4,6,7],col:'#c79a3a'},{n:'눈콩',c:10,m:[2,4,5,6],col:'#6f6a7c'},{n:'붉은콩',c:8,m:[2,3,4,5],col:'#b0304a'},{n:'강낭콩',c:6,m:[0,2,3,0],col:'#9a5a8e'}];
const TYPE=[];BEANS.forEach((b,t)=>{for(let k=0;k<b.c;k++)TYPE.push(t)});
const typ=id=>TYPE[id];
const coinsFor=(t,n)=>{let c=0;BEANS[t].m.forEach((x,k)=>{if(x&&n>=x)c=k+1});return c};
/* 다음 코인까지: {at:필요 장수, c:그때 코인} / 더 없으면 null */
const nextStep=(t,n)=>{const m=BEANS[t].m;for(let k=0;k<4;k++)if(m[k]&&n<m[k])return {at:m[k],c:k+1};return null};
const HAND0=5,DRAW=3,TURN_UP=2,LAST_RUN=3,LOCK_MS=1000,MAX_WANT=8;
const FIELD3=3;   // 세 번째 밭 값 (예전 판 규칙, 설정으로 켬)

/* ---------- 카드 ---------- */
const beanSvg=c=>`<svg viewBox="0 0 60 44" aria-hidden="true"><path d="M8 26C4 12 18 3 32 6c9 2 12 8 17 8 7 0 9 9 3 16-8 10-38 13-44-4z" fill="${c}" stroke="#3b2a1f" stroke-width="2"/><ellipse cx="22" cy="15" rx="7" ry="3" fill="#fff" opacity=".4" transform="rotate(-18 22 15)"/><circle cx="24" cy="25" r="2.2" fill="#3b2a1f"/><circle cx="37" cy="23" r="2.2" fill="#3b2a1f"/><path d="M27 31c3 2 6 2 8-.5" fill="none" stroke="#3b2a1f" stroke-width="2" stroke-linecap="round"/></svg>`;
const meterTxt=t=>BEANS[t].m.map(x=>x||'-').join(' ');
Object.assign(G,{labelOf:id=>BEANS[typ(id)].n,cmpCard:(a,b)=>typ(a)-typ(b)||a-b});
G.cardHTML=(id,extra)=>{const t=typ(id),b=BEANS[t];return `<button type="button" class="card bn-c ${extra||''}" data-id="${id}" style="--rc:${b.col}" aria-label="${b.n}"><span class="bn-nm">${b.n}</span><span class="bn-be">${beanSvg(b.col)}</span><span class="bn-mt">${meterTxt(t)}</span></button>`};
G.drawFace=function(g,w,h,id){
  const t=typ(id),b=BEANS[t],k=w/60;
  g.clearRect(0,0,w,h);g.save();rr(g,0,0,w,h,8*k);g.clip();g.fillStyle='#fffcf5';g.fillRect(0,0,w,h);g.fillStyle=b.col;g.fillRect(0,0,w,20*k);g.restore();
  g.strokeStyle='#e3d4bb';g.lineWidth=k;rr(g,k/2,k/2,w-k,h-k,8*k);g.stroke();
  g.fillStyle='#fffcf5';g.textAlign='center';g.textBaseline='middle';g.font=`700 ${11.5*k}px "Jua",sans-serif`;g.fillText(b.n,w/2,10.5*k);
  /* 콩 얼굴 */
  g.save();g.translate(w/2,47*k);g.fillStyle=b.col;g.strokeStyle='#3b2a1f';g.lineWidth=1.6*k;g.beginPath();
  g.moveTo(-21*k,5*k);g.bezierCurveTo(-25*k,-10*k,-11*k,-18*k,3*k,-15*k);g.bezierCurveTo(12*k,-13*k,15*k,-7*k,20*k,-7*k);g.bezierCurveTo(27*k,-7*k,29*k,2*k,23*k,9*k);g.bezierCurveTo(15*k,19*k,-15*k,22*k,-21*k,5*k);g.closePath();g.fill();g.stroke();
  g.fillStyle='#3b2a1f';for(const x of [-6,8]){g.beginPath();g.arc(x*k,3*k,2.2*k,0,7);g.fill()}
  g.lineCap='round';g.beginPath();g.moveTo(-2*k,10*k);g.quadraticCurveTo(2*k,13*k,5*k,9.5*k);g.stroke();g.restore();
  g.fillStyle='#3b2a1f';g.font=`700 ${9.5*k}px "IBM Plex Mono",monospace`;g.fillText(meterTxt(t),w/2,76*k);
};

/* ---------- 규칙 설명·방 설정 ---------- */
G.rulesHTML='<ol class="rules"><li><b>목표</b> : 콩을 심고 수확해 코인을 가장 많이 모읍니다. 3명은 밭 3개, 4~5명은 밭 2개로 시작합니다</li><li><b>손패</b> : 처음 5장을 받습니다. 손패 순서는 바꿀 수 없습니다. 왼쪽 맨 앞 카드가 다음에 심을 카드이고 새 카드는 맨 뒤로 들어갑니다</li><li><b>1. 손패 심기</b> : 맨 앞 카드를 꼭 심고, 다음 카드도 심을 수 있습니다. 밭을 눌러 심습니다. 한 밭에는 한 종류만 심습니다</li><li><b>2. 공개와 거래</b> : 더미에서 2장을 공개합니다. 차례인 사람은 공개 카드와 손패로, 다른 사람은 손패로 차례인 사람과 거래합니다. 다른 사람끼리는 거래할 수 없고 밭의 카드는 거래할 수 없습니다. 주기만 하는 기증도 됩니다</li><li><b>제안과 수락</b> : 제안을 보내고 상대가 수락하면 바로 교환합니다. 상대는 콩 종류만 볼 수 있고 손패 몇 번째 카드인지는 알 수 없습니다. 제안을 바꾸면 수락은 처음부터 다시 받습니다. 같은 콩이 여러 장이면 손패에서 줄 카드를 먼저 누르고 수락합니다(누르지 않으면 맨 뒤 카드부터 줍니다)</li><li><b>임시 구역</b> : 거래로 받은 카드와 남은 공개 카드는 밭 앞 임시 구역에 놓입니다. 손패로 가져올 수 없고 다시 거래할 수 없습니다</li><li><b>3. 임시 구역 심기</b> : 거래가 끝나면 모두 임시 구역의 카드를 원하는 순서로 전부 심습니다. 카드를 누른 뒤 밭을 누릅니다</li><li><b>4. 뽑기</b> : 차례인 사람이 3장을 뽑아 손패 맨 뒤에 넣습니다</li><li><b>수확</b> : 언제든 내 밭을 두 번 눌러 수확합니다. 밭 전체를 수확하고 장수에 맞는 코인을 얻습니다. 밭 아래 표시는 지금 장수/다음 코인까지 필요한 장수입니다</li><li><b>새싹 보호법</b> : 2장 이상인 밭이 있으면 1장뿐인 밭은 수확할 수 없습니다</li><li><b>끝</b> : 더미가 세 번째로 떨어지면 끝납니다. 뽑기 중이면 바로, 공개 중이면 심기까지 마치고 끝납니다. 남은 밭을 모두 수확하고 코인이 많은 사람이 이깁니다. 같으면 첫 차례 사람에게서 시계 방향으로 가장 먼 사람이 이깁니다</li></ol>';
G.modeDesc=['콩을 심고 거래하기','콩을 심고 거래하기'];
G.defaults={max:5,turn:20,tt:45,buy3:0};
G.roomSet=[
  {k:'turn',label:'심기 제한 시간',unit:'초',lo:10,hi:60,step:5,desc:'손패 심기와 임시 구역 심기의 제한 시간입니다. 지나면 자동으로 심습니다'},
  {k:'tt',label:'거래 제한 시간',unit:'초',lo:20,hi:180,step:5,desc:'거래 단계의 제한 시간입니다. 지나면 거래가 끝납니다'}];
G.ruleSet=[{k:'buy3',label:'세 번째 밭 사기',desc:'예전 판 규칙: 4~5명일 때 3코인으로 세 번째 밭을 살 수 있습니다. 현행 규칙서 기본 게임에는 없습니다'}];
G.fixCfg=(c,n,strict)=>{const r={...c};if(!(+r.max>=3))r.max=3;return r};
G.cfgChips=c=>`<span class="chip">심기 <b>${+c.turn||20}초</b></span><span class="chip">거래 <b>${+c.tt||45}초</b></span>`;
G.cfgSum=c=>`심기 ${+c.turn||20}초 · 거래 ${+c.tt||45}초${+c.buy3?' · 세 번째 밭 사기':''}`;
G.roomSub=()=>'3~5명 거래 카드 게임';
G.pubExtra=()=>({});
G.cardInfo=()=>'<p class="cardinfo">3명은 밭 3개, 4~5명은 밭 2개로 시작합니다.</p>';
G.rankTitle=()=>'';
G.finLabel=()=>'';
G.noEmotes=[];
G.keys={};G.keyActions=[];

/* ---------- 방장 엔진 ---------- */
const realBot=p=>!!p&&p.bot&&!p.away;
const live=()=>H.players.map((p,i)=>i).filter(i=>!H.players[i].finished);
const turnMs=()=>(+H.cfg.turn||20)*1000;
const tradeMs=()=>(+H.cfg.tt||45)*1000;
const fieldsOf=s=>H.bn.fd[s];
function canHarvest(s,f){
  const a=fieldsOf(s);if(!a[f]||!a[f].length)return false;
  return !(a[f].length===1&&a.some((x,k)=>k!==f&&x.length>1));   // 새싹 보호법
}
function harvest(s,f){
  const O=H.bn,a=fieldsOf(s),L=a[f],t=typ(L[0]),c=coinsFor(t,L.length);
  a[f]=[];O.coin[s].push(...L.slice(0,c));O.disc.push(...L.slice(c));
  O.hs++;addLog(`${H.players[s].name} ${BEANS[t].n} ${L.length}장 수확 (${c}코인)`,'sys');
}
const fits=(s,f,id)=>{const L=fieldsOf(s)[f];return !!L&&(!L.length||typ(L[0])===typ(id))};
/* 자동으로 심을 밭: 같은 콩 → 빈 밭 → 코인이 가장 많이 나오는 밭을 수확 */
function autoField(s,id){
  const a=fieldsOf(s);
  let f=a.findIndex(L=>L.length&&typ(L[0])===typ(id));if(f>=0)return f;
  f=a.findIndex(L=>!L.length);if(f>=0)return f;
  let best=-1,bv=-1;a.forEach((L,k)=>{if(!canHarvest(s,k))return;const v=coinsFor(typ(L[0]),L.length)*100-L.length;if(best<0||v>bv){best=k;bv=v}});
  harvest(s,best);return best;
}
/* 더미에서 한 장. 비면 그때 섞음. 세 번째로 떨어지면 O.last=1 */
function draw1(){
  const O=H.bn;
  if(!O.deck.length){
    if(O.last)return null;
    if(!O.disc.length){O.last=1;return null}
    O.deck=shuffle(O.disc);O.disc=[];addLog('버린 카드를 섞습니다.','sys');
  }
  const id=O.deck.pop();
  if(!O.deck.length){O.runs++;if(O.runs>=LAST_RUN)O.last=1}
  return id;
}
function nextSeat(i){const n=H.players.length;for(let k=1;k<=n;k++){const j=(i+k)%n;if(!H.players[j].finished)return j}return -1}
const wake=(s,a,b)=>{H.bn.bt[s]=clock()+rand(a,b)};
function startTurn(s){
  const O=H.bn;O.act=s;H.turn=s;O.ph='p1';O.pl=0;H.deadline=clock()+turnMs();wake(s,700,1300);
  if(!H.players[s].hand.length){beginTrade();return}
  mark();
}
function beginTrade(){
  const O=H.bn,t=clock();
  O.ph='trade';O.up=[];O.of=[];O.tried={};O.asked={};
  for(let k=0;k<TURN_UP;k++){const id=draw1();if(id==null)break;O.up.push(id)}
  H.turn=O.act;H.deadline=t+tradeMs();O.t0=t;
  const human=H.players.some(p=>!p.bot);
  O.botEnd=t+(human?rand(8000,12000):rand(1500,2500));
  H.players.forEach((p,i)=>{if(realBot(p))wake(i,900,2000)});
  if(!O.up.length){endTrade();return}
  mark();
}
function endTrade(){
  const O=H.bn;
  O.tmp[O.act].push(...O.up);O.up=[];O.of=[];O.ph='p3';H.deadline=clock()+turnMs();
  H.players.forEach((p,i)=>{if(realBot(p))wake(i,600,1100)});
  checkP3();
}
function checkP3(){
  const O=H.bn,k=H.players.findIndex((p,i)=>!p.finished&&O.tmp[i].length);
  if(k>=0){H.turn=k;mark();return}
  afterPlant();
}
function afterPlant(){
  const O=H.bn,s=O.act;
  if(O.last){finish();return}
  if(!H.players[s].finished)for(let k=0;k<DRAW;k++){const id=draw1();if(id==null)break;H.players[s].hand.push(id);if(O.last)break}
  if(O.last){finish();return}
  startTurn(nextSeat(s));
}
function finish(){
  const O=H.bn,L=live(),n=H.players.length,dist=i=>(i-O.first+n)%n;
  for(const s of L)fieldsOf(s).forEach((x,f)=>{if(x.length)harvest(s,f)});
  L.sort((a,b)=>O.coin[b].length-O.coin[a].length||dist(b)-dist(a));
  L.forEach((s,k)=>{const p=H.players[s];p.finished=true;p.rank=k+1});
  O.ph='done';O.of=[];O.up=[];H.phase='over';H.deadline=0;
  addLog(`${H.players[L[0]].name} 승리 (${O.coin[L[0]].length}코인)`,'fin');mark();
}
function doSurrender(s){
  const O=H.bn,p=H.players[s];
  if(H.phase!=='play'||p.finished)return;
  p.finished=true;p.surrendered=true;p.rank=H.rankBottom--;
  O.disc.push(...p.hand,...O.tmp[s]);p.hand=[];O.tmp[s]=[];
  fieldsOf(s).forEach((L,f,a)=>{O.disc.push(...L);a[f]=[]});
  O.of=O.of.filter(x=>x.from!==s&&x.to!==s);
  addLog(`${p.name} ${p.deserter?'탈주':'항복'}!`,'lie');
  if(live().length<2){O.last=1;finish();return}
  if(O.act===s){
    if(O.ph==='p1')startTurn(nextSeat(s));
    else if(O.ph==='trade'){O.disc.push(...O.up);O.up=[];O.of=[];O.ph='p3';H.deadline=clock()+turnMs();checkP3()}
    else checkP3();
  }else if(O.ph==='p3')checkP3();
  mark();
}
/* 거래 */
const isInt=x=>Number.isInteger(x);
const uniq=a=>new Set(a).size===a.length;
function offer(s,a){
  const O=H.bn,to=a.to,P=H.players;
  if(O.ph!=='trade'||!isInt(to)||to===s||!P[to]||P[to].finished)return;
  if(s!==O.act&&to!==O.act)return;   // 차례인 사람과만
  const hand=Array.isArray(a.hand)?a.hand:[],gf=Array.isArray(a.gf)?a.gf:[],want=Array.isArray(a.want)?a.want:[],wf=Array.isArray(a.wf)?a.wf:[];
  if(!hand.length&&!gf.length&&!want.length&&!wf.length)return;
  if(![hand,gf,want,wf].every(L=>L.every(isInt))||want.length>MAX_WANT||!uniq(hand)||!uniq(gf)||!uniq(wf))return;
  if(!hand.every(id=>P[s].hand.includes(id))||!want.every(t=>t>=0&&t<BEANS.length))return;
  if(gf.length&&(s!==O.act||!gf.every(id=>O.up.includes(id))))return;
  if(wf.length&&(to!==O.act||!wf.every(id=>O.up.includes(id))))return;
  O.of=O.of.filter(x=>!(x.from===s&&x.to===to));   // 같은 상대에게 다시 보내면 새 제안 (앞의 수락은 없던 일)
  O.oid++;O.of.push({id:O.oid,from:s,to,hand:hand.slice(),gf:gf.slice(),want:want.slice(),wf:wf.slice(),at:clock()});
  if(realBot(P[to])&&clock()+500>O.bt[to])wake(to,800,1500);
  mark();
}
function valid(x){
  const O=H.bn,P=H.players;
  return x.hand.every(id=>P[x.from].hand.includes(id))&&x.gf.every(id=>O.up.includes(id))&&x.wf.every(id=>O.up.includes(id));
}
function accept(s,a){
  const O=H.bn,x=O.of.find(q=>q.id===a.id);
  if(O.ph!=='trade'||!x||x.to!==s||clock()<x.at+LOCK_MS)return false;
  if(!valid(x)){O.of=O.of.filter(q=>q!==x);mark();return false}
  const pick=Array.isArray(a.pick)?a.pick:[],me=H.players[s],he=H.players[x.from];
  if(pick.length!==x.want.length||!pick.every(isInt)||!uniq(pick)||!pick.every(id=>me.hand.includes(id)))return false;
  const need=x.want.slice().sort().join(),got=pick.map(typ).sort().join();if(need!==got)return false;
  const out=(p,ids)=>{p.hand=p.hand.filter(id=>!ids.includes(id))};
  out(he,x.hand);out(me,pick);O.up=O.up.filter(id=>!x.gf.includes(id)&&!x.wf.includes(id));
  const toMe=[...x.hand,...x.gf],toHe=[...pick,...x.wf];
  O.tmp[s].push(...toMe);O.tmp[x.from].push(...toHe);
  O.of=O.of.filter(q=>q!==x&&valid(q));O.ts++;
  const nm=L=>L.length?L.map(id=>BEANS[typ(id)].n).join(', '):'없음';
  addLog(`${he.name} → ${me.name}: ${nm(toMe)} / ${me.name} → ${he.name}: ${nm(toHe)}`,'sys');
  mark();return true;
}
/* 봇(쉬움): 내 밭에 맞으면 좋고, 안 맞으면 내주고 싶음 */
function fit(s,t){
  const a=fieldsOf(s);let L=a.find(x=>x.length&&typ(x[0])===t);if(L)return 3+L.length;
  return a.some(x=>!x.length)?1:-2;
}
function rearPick(s,want){
  const h=H.players[s].hand,out=[];
  for(const t of want){let k=-1;for(let j=h.length-1;j>=0;j--)if(typ(h[j])===t&&!out.includes(h[j])){k=h[j];break}if(k<0)return null;out.push(k)}
  return out;
}
function botAnswer(s,x){
  const O=H.bn,pick=rearPick(s,x.want);
  if(!pick||!valid(x)){O.of=O.of.filter(q=>q!==x);mark();return}
  const front=H.players[s].hand.slice(0,2),gain=[...x.hand,...x.gf].reduce((v,id)=>v+fit(s,typ(id)),0);
  const loss=pick.reduce((v,id)=>v+(fit(s,typ(id))>=3?3:front.includes(id)?-1:0),0)+x.wf.length;
  if(gain-loss>=0&&accept(s,{id:x.id,pick}))return;
  O.of=O.of.filter(q=>q!==x);mark();
}
function botTrade(t){
  const O=H.bn,P=H.players;
  P.forEach((p,i)=>{
    if(O.ph!=='trade'||!realBot(p)||p.finished||t<O.bt[i])return;
    const inc=O.of.find(x=>x.to===i&&t>=x.at+LOCK_MS);
    if(inc){botAnswer(i,inc);wake(i,700,1300);return}
    wake(i,900,1600);
    O.of=O.of.filter(x=>!(x.from===i&&t>=x.at+7000));
    if(i===O.act){
      for(const id of O.up){
        if(fit(i,typ(id))>-2)continue;
        const j=P.findIndex((q,k)=>k!==i&&!q.finished&&!O.tried[id+':'+k]&&fit(k,typ(id))>=1);
        if(j>=0){O.tried[id+':'+j]=1;offer(i,{to:j,gf:[id]});return}
      }
      if(t>=O.botEnd&&!O.of.some(x=>x.to===i))endTrade();
      return;
    }
    if(O.asked[i])return;O.asked[i]=1;
    const id=O.up.find(v=>fit(i,typ(v))>=3&&fit(O.act,typ(v))<3);if(id==null)return;
    const junk=P[i].hand.slice(2).filter(v=>fit(i,typ(v))<=-2).slice(-1);
    offer(i,{to:O.act,hand:junk,wf:[id]});
  });
}
function botP1(t){
  const O=H.bn,s=O.act,p=H.players[s];
  if(!realBot(p)||t<O.bt[s])return;
  const id=p.hand[0];
  if(O.pl===0){const f=autoField(s,id);plantHand(s,f);wake(s,600,1100);return}
  const f=fieldsOf(s).findIndex((L,k)=>L.length&&fits(s,k,id));
  const e=f>=0?f:fieldsOf(s).findIndex(L=>!L.length);
  if(e>=0)plantHand(s,e);else beginTrade();
}
function plantHand(s,f){
  const O=H.bn,p=H.players[s];
  O.fd[s][f].push(p.hand.shift());O.pl++;
  if(O.pl>=2||!p.hand.length)beginTrade();else mark();
}
function plantTmp(s,id,f){const O=H.bn;O.tmp[s]=O.tmp[s].filter(v=>v!==id);O.fd[s][f].push(id)}
G._test={BEANS,TYPE,coinsFor,nextStep,canHarvest,LOCK_MS,turnMs,tradeMs};
G.engine={
  start(){
    Object.assign(H,{phase:'play',log:[],seatNote:{},field:[],last:null,reveal:null,shouts:[],pending:null,rankNext:1,rankBottom:H.players.length,known:{},turn:0,botActAt:0,deadline:0});
    const n=H.players.length,deck=shuffle(TYPE.map((_,i)=>i));
    H.players.forEach(p=>{p.finished=false;p.rank=null;p.surrendered=false;p.hand=deck.splice(0,HAND0)});
    const first=Math.floor(Math.random()*n),nf=n===3?3:2;
    H.bn={gn:((H.bn&&H.bn.gn)||0)+1,ph:'p1',act:first,first,pl:0,deck,disc:[],up:[],of:[],oid:0,ts:0,hs:0,runs:0,last:0,t0:0,botEnd:0,tried:{},asked:{},
      fd:H.players.map(()=>Array.from({length:nf},()=>[])),tmp:H.players.map(()=>[]),coin:H.players.map(()=>[]),bt:H.players.map(()=>0)};
    addLog(`${H.players[first].name}부터 시작합니다.`,'sys');
    startTurn(first);
  },
  act(s,a){
    const O=H.bn;
    if(!O||H.phase!=='play'||s<0||s>=H.players.length||H.players[s].finished)return;
    if(a.t==='surrender'){doSurrender(s);return}
    const p=H.players[s],f=a.f;
    if(a.t==='harvest'){if(isInt(f)&&canHarvest(s,f)){harvest(s,f);mark()}return}
    if(a.t==='buy'){if(+H.cfg.buy3&&H.players.length>3&&O.fd[s].length<3&&O.coin[s].length>=FIELD3){O.disc.push(...O.coin[s].splice(0,FIELD3));O.fd[s].push([]);addLog(`${p.name} 세 번째 밭`,'sys');mark()}return}
    if(O.ph==='p1'){
      if(s!==O.act)return;
      if(a.t==='plant'&&isInt(f)&&p.hand.length&&O.pl<2&&fits(s,f,p.hand[0]))plantHand(s,f);
      else if(a.t==='skip'&&O.pl>=1)beginTrade();
      return;
    }
    if(O.ph==='p3'){
      if(a.t==='tplant'&&isInt(a.id)&&O.tmp[s].includes(a.id)&&isInt(f)&&fits(s,f,a.id)){plantTmp(s,a.id,f);checkP3()}
      return;
    }
    if(O.ph!=='trade')return;
    if(a.t==='offer'){offer(s,a);return}
    if(a.t==='accept'){accept(s,a);return}
    if(a.t==='reject'){const n=O.of.length;O.of=O.of.filter(x=>!(x.id===a.id&&x.to===s));if(O.of.length!==n)mark();return}
    if(a.t==='cancel'){const n=O.of.length;O.of=O.of.filter(x=>!(x.id===a.id&&x.from===s));if(O.of.length!==n)mark();return}
    if(a.t==='end'&&s===O.act)endTrade();
  },
  tick(t){
    const O=H.bn;if(!O||H.phase!=='play')return;
    if(O.ph==='p1'){
      if(t>=H.deadline){const s=O.act,p=H.players[s];if(O.pl===0&&p.hand.length)plantHand(s,autoField(s,p.hand[0]));if(O.ph==='p1')beginTrade();return}
      botP1(t);
    }else if(O.ph==='trade'){
      if(t>=H.deadline){endTrade();return}
      botTrade(t);
    }else if(O.ph==='p3'){
      const auto=t>=H.deadline;let ch=false;
      H.players.forEach((p,i)=>{
        if(p.finished||!O.tmp[i].length)return;
        if(auto){while(O.tmp[i].length){const id=O.tmp[i][0];plantTmp(i,id,autoField(i,id))}ch=true}
        else if(realBot(p)&&t>=O.bt[i]){const id=O.tmp[i].slice().sort((a,b)=>fit(i,typ(b))-fit(i,typ(a)))[0];plantTmp(i,id,autoField(i,id));wake(i,400,800);ch=true}
      });
      if(ch)checkP3();
    }
  },
  snap(s,you,t){
    const O=H.bn,seat=you>=0&&you<H.players.length;
    /* 제안은 당사자에게만. 받는 쪽에는 콩 종류만: 손패 카드 id·위치는 제안자에게만 */
    const of=O.of.filter(x=>x.from===you||x.to===you).map(x=>{
      const o={id:x.id,f:x.from,to:x.to,g:[...x.hand,...x.gf].map(typ).sort(),gf:x.gf.slice(),w:x.want.slice().sort(),wf:x.wf.slice(),lk:Math.max(0,x.at+LOCK_MS-t)};
      if(x.from===you)o.mh=x.hand.slice();return o});
    s.o={gn:O.gn,ph:O.ph,act:O.act,first:O.first,pl:O.pl,fd:O.fd.map(a=>a.map(L=>L.slice())),tmp:O.tmp.map(L=>L.slice()),cn:O.coin.map(L=>L.length),up:O.up.slice(),
      dk:O.deck.length,ds:O.disc.length,dt:O.disc.length?O.disc[O.disc.length-1]:-1,runs:Math.min(LAST_RUN,O.runs+1),ts:O.ts,hs:O.hs,of,dl:H.deadline?Math.max(0,H.deadline-t):0};
    s.ps.forEach((p,i)=>{p.cn=O.coin[i].length});
    s.gr=0;s.dl=s.o.dl;
    if(H.phase==='play'){
      if(O.ph==='p3'){if(seat&&O.tmp[you].length)s.t=you;else if(!O.tmp.some(L=>L.length))delete s.t}
    }
  },
  restore(ms){
    const O=H.bn;if(!O)return;
    if(O.bt)O.bt=O.bt.map(x=>x+ms);if(O.botEnd)O.botEnd+=ms;if(O.of)O.of.forEach(x=>{x.at+=ms});
  },
  emoPhase:()=>true
};

/* ---------- 화면: 조작 ---------- */
let elBox=null,elSt=null,elPan=null,el2d=null,lastPan='',last2d='',tmpSel=-1,arm=-1,armAt=0;
const C={open:false,to:-1,gf:[],want:[],wf:[]};   // 쓰고 있는 제안 (줄 손패는 공통 sel)
const lockAt=new Map();   // 제안 id → 수락할 수 있는 시각
const currentG=()=>typeof GAMES!=='undefined'&&V&&V.cfg&&GAMES[V.cfg.game]?GAMES[V.cfg.game]:null;
const iSeat=()=>{const i=myIdx();return i>=0&&V&&V.ps&&i<V.ps.length&&!V.ps[i].f};
const inPlay=()=>!!(V&&V.o&&V.st==='play'&&iSeat()&&!dealingV());
const inTrade=()=>inPlay()&&V.o.ph==='trade';
const isAct=()=>inPlay()&&V.o.act===myIdx();
const clearC=()=>{C.to=-1;C.gf=[];C.want=[];C.wf=[]};
const canH=(i,f)=>{const a=V.o.fd[i],L=a[f];return !!L&&L.length>0&&!(L.length===1&&a.some((x,k)=>k!==f&&x.length>1))};
function plantTarget(){
  if(!inPlay())return -1;
  const o=V.o,h=myHand();
  if(o.ph==='p1')return isAct()&&o.pl<2&&h.length?h[0]:-1;
  if(o.ph==='p3'){const L=o.tmp[myIdx()];return L.includes(tmpSel)?tmpSel:L.length?L[0]:-1}
  return -1;
}
const accepts=(L,id)=>!L.length||typ(L[0])===typ(id);
function refresh(){if(M.on&&V)G.field3D(V,null,myIdx());drawPan();draw2d()}
function tapField(f){
  if(!inPlay()){sfx('no');return}
  const o=V.o,i=myIdx(),L=o.fd[i][f],id=plantTarget();
  if(!L){sfx('no');return}
  if(id>=0&&accepts(L,id)){sendAct(o.ph==='p1'?{t:'plant',f}:{t:'tplant',id,f});if(id===tmpSel)tmpSel=-1;arm=-1;refresh();return}
  if(!L.length||!canH(i,f)){arm=-1;sfx('no');refresh();return}
  if(arm===f){arm=-1;sendAct({t:'harvest',f})}else{arm=f;armAt=clock();sfx('pick')}
  refresh();
}
function tapTemp(id){
  if(!inPlay()||V.o.ph!=='p3'){sfx('no');return}
  tmpSel=tmpSel===id?-1:id;sfx('pick');refresh();
}
function tapUp(id){
  if(!inTrade()){sfx('no');return}
  const L=isAct()?C.gf:C.wf,k=L.indexOf(id);k<0?L.push(id):L.splice(k,1);
  C.open=true;sfx('pick');refresh();
}
function sendOffer(){
  if(!inTrade()){sfx('no');return}
  const o=V.o,to=isAct()?C.to:o.act,hand=[...sel].filter(id=>myHand().includes(id));
  if(to<0||to===myIdx()||(!hand.length&&!C.gf.length&&!C.want.length&&!C.wf.length)){sfx('no');return}
  sendAct({t:'offer',to,hand,gf:C.gf.slice(),want:C.want.slice(),wf:C.wf.slice()});
  sel.clear();clearC();C.open=false;renderMe();refresh();
}
/* 수락할 때 줄 카드: 눌러 둔 카드부터, 없으면 맨 뒤 카드부터 (받는 쪽만 아는 선택) */
function pickFor(of){
  const h=myHand(),out=[];
  for(const t of of.w){
    let id=[...sel].find(v=>typ(v)===t&&h.includes(v)&&!out.includes(v));
    if(id==null)for(let j=h.length-1;j>=0;j--)if(typ(h[j])===t&&!out.includes(h[j])){id=h[j];break}
    if(id==null)return null;
    out.push(id);
  }
  return out;
}
function acceptOf(id){
  const of=V.o.of.find(x=>x.id===id);if(!of||clock()<(lockAt.get(id)||0)){sfx('no');return}
  const pick=pickFor(of);if(!pick){sfx('no');return}
  sendAct({t:'accept',id,pick});sel.clear();renderMe();
}
function counterOf(id){
  const of=V.o.of.find(x=>x.id===id);if(!of)return;
  clearC();sel.clear();
  const pick=pickFor(of)||[];pick.forEach(v=>sel.add(v));
  C.gf=of.wf.slice();C.wf=of.gf.slice();C.to=of.f;
  const left=of.g.slice();of.gf.forEach(v=>{const k=left.indexOf(typ(v));if(k>=0)left.splice(k,1)});C.want=left;
  C.open=true;renderMe();refresh();
}
G.handMarks=(i,h,hand)=>{
  if(!inTrade()&&sel.size)sel.clear();
  const o=V&&V.o,on=!!(o&&o.ph==='p1'&&isAct());
  [...hand.children].forEach((el,k)=>{el.classList.toggle('sel',sel.has(+el.dataset.id));el.classList.toggle('bn-f1',k===0&&on&&o.pl<2)});
  drawPan();
};
G.me=()=>{$('#numpick').hidden=true};
G.play=()=>{
  if(!inTrade()){sfx('no');return}
  C.open=!C.open;drawPan();
};
G.pass=()=>{
  const o=V&&V.o;if(!o){return}
  if(o.ph==='p1'&&isAct()&&o.pl>=1)sendAct({t:'skip'});
  else if(o.ph==='trade'&&isAct())sendAct({t:'end'});
  else sfx('no');
};
G.keyPhase=st=>st==='play';
G.onKey=()=>false;
G.preView=()=>{
  const o=V.o;if(!o)return;
  if(o.ph!=='trade'){clearC();C.open=false}
  else{C.gf=C.gf.filter(id=>o.up.includes(id));C.wf=C.wf.filter(id=>o.up.includes(id))}
  const i=myIdx();if(i<0||!o.tmp[i]||!o.tmp[i].includes(tmpSel))tmpSel=-1;
  const t=clock();for(const x of o.of||[])if(!lockAt.has(x.id))lockAt.set(x.id,t+x.lk);
};
G.postView=()=>{};
G.buttons=()=>{
  const pb=$('#btnPlay'),ps=$('#btnPass'),o=V&&V.o;
  $('#btnGura').hidden=true;
  const tr=inTrade(),p1=!!(o&&o.ph==='p1'&&isAct());
  const was=pb.hidden+':'+ps.hidden;
  pb.hidden=!tr;pb.disabled=!tr;pb.classList.toggle('ready',tr&&C.open);
  if(tr){if($('#playMain').textContent!=='거래')$('#playMain').textContent='거래';const sub=keyLabel(KEYS.play);if($('#playSub').textContent!==sub)$('#playSub').textContent=sub}
  const showP=p1||(tr&&isAct());ps.hidden=!showP;ps.disabled=!(tr||(p1&&o.pl>=1));
  const t=tr?'거래 끝':'넘기기';if(ps.firstChild.nodeValue!==t)ps.firstChild.nodeValue=t;
  if(was!==pb.hidden+':'+ps.hidden)requestAnimationFrame(layoutFan);   // 버튼 수가 바뀌면 손패 자리를 다시 맞춤
};
G.logCue=()=>false;
G.cues=(v,pv)=>{
  const a=v.o,b=pv&&pv.o;if(!a||!b||a.gn!==b.gn)return;
  const cnt=x=>x.fd.reduce((n,s)=>n+s.reduce((m,L)=>m+L.length,0),0);
  if(cnt(a)>cnt(b))sfx('play',1);
  if(a.hs>b.hs){tone(880,.09,{type:'triangle',vol:.1});tone(1320,.12,{type:'triangle',vol:.09,at:.08})}
  if(a.ts>b.ts){tone(520,.08,{type:'sine',vol:.1});tone(780,.1,{type:'sine',vol:.1,at:.08})}
  const i=myIdx(),inc=x=>(x.of||[]).filter(q=>q.to===i).length;
  if(inc(a)>inc(b))tone(660,.08,{type:'triangle',vol:.1});
};

/* ---------- 3D: 공통 앉은 카메라 위의 카드 ----------
   자리마다 사람 쪽에서 중심을 향해: 밭(겹쳐 쌓음) · 밭 아래 배지 · 왼쪽 코인 · 밭 앞 임시 구역. 가운데 줄: 더미 · 공개 카드 · 버린 카드 */
const R_F=2.6,R_B=3.56,R_T=1.62,FW=.8,CS=.8,TS=.62,PX=.42,PZ=-.62,UZ=.42,MAX_COIN=24;
const CW=.62*1.2*CS,CH=.9*1.2*CS;   // 밭 카드 크기 (공통 카드 .62×.9 × T.cardK 1.2 × CS)
const M={on:false,built:false,fail:false,root:null,cards:new Map(),where:new Map(),seats:[],deck:null,labels:[],info:null,ray:null,gn:0,raf:0,hb:null,vp:null};
const posOf=(i,r,t,y)=>{const a=seatAngle(i),s=Math.sin(a),c=Math.cos(a);return new THREE.Vector3(s*r+c*t,y||0,c*r-s*t)};
const fieldTan=(f,nf)=>(f-(nf-1)/2)*FW;
const coinTan=nf=>-(nf/2)*FW-.42;
/* 탁자 위 글자는 2D 표: 3D 자리를 따라가고 늘 똑바로, 어느 화면에서나 같은 크기 (step이 자리를 옮김) */
function label(cls){const el=document.createElement('div');el.className='bn-lb '+cls;el.hidden=true;M.lbBox.appendChild(el);M.labels.push(el);return el}
function setLabel(el,at,html){
  el.hidden=false;el._p=at;
  if(el._h!==html){el._h=html;el.innerHTML=html}
}
const COIN='<i class="bn-co"></i>';
/* 밭 아래 작은 배지: 지금/다음(코인) · 수확 준비 · 새싹 보호 */
function badgeOf(i,f){
  const L=V.o.fd[i][f];if(!L||!L.length)return null;
  const t=typ(L[0]),n=L.length,nx=nextStep(t,n);
  return {n,at:nx?nx.at:0,c:nx?nx.c:0,now:coinsFor(t,n),lock:!canH(i,f),arm:i===myIdx()&&arm===f};
}
const badgeHTML=b=>b.arm?`수확 ${COIN}${b.now}`:`${b.at?`${b.n}/${b.at} ${COIN}${b.c}`:`${b.n} MAX`}${b.lock?'<u>✕</u>':''}`;
/* 코인 3D: 다섯 개씩 쌓고 옆으로 */
const coinBase=(i,nf)=>i===myIdx()?{r:R_B+.42,t:-.3,lt:-.72}:{r:R_F+.1,t:coinTan(nf),lt:coinTan(nf)};
function coinAt(i,nf,k){const b=coinBase(i,nf);return posOf(i,b.r,b.t+Math.floor(k/5)*.3,.035+(k%5)*.056)}
function slotTex(col){return canvasTex(132,190,(g,w,h)=>{g.clearRect(0,0,w,h);g.strokeStyle=col;g.lineWidth=5;g.setLineDash([14,10]);rr(g,6,6,w-12,h-12,14);g.stroke()})}
function build(){
  if(M.built||M.fail)return M.built;
  if(!T.ok||typeof THREE==='undefined'){M.fail=true;return false}
  try{
    const root=new THREE.Group();root.visible=false;T.scene.add(root);M.root=root;
    const gS=new THREE.PlaneGeometry(CW+.08,CH+.08);
    M.sN=new THREE.MeshBasicMaterial({map:slotTex('rgba(255,250,240,.55)'),transparent:true,depthWrite:false});
    M.sH=new THREE.MeshBasicMaterial({map:slotTex('#ffd24a'),transparent:true,depthWrite:false});
    const gC=new THREE.CylinderGeometry(.13,.13,.05,28),cT=toon({color:0xf0c24a}),cE=toon({color:0xb98a22}),ink=new THREE.MeshBasicMaterial({color:GFX_INK,side:THREE.BackSide}),gI=new THREE.CylinderGeometry(.145,.145,.06,28);
    for(let i=0;i<5;i++){
      const s={slots:[],badges:[],coins:[],lb:label('bn-cn'),shown:0,to:0,at:0};
      for(let f=0;f<3;f++){
        const o=new THREE.Mesh(gS,M.sN);o.rotation.x=-Math.PI/2;o.position.y=.022;o.visible=false;root.add(o);s.slots.push(o);
        s.badges.push(label('bn-bd'));
      }
      for(let k=0;k<MAX_COIN;k++){const c=new THREE.Mesh(gC,[cE,cT,cT]);c.castShadow=true;c.add(new THREE.Mesh(gI,ink));c.visible=false;root.add(c);s.coins.push(c)}
      M.seats.push(s);
    }
    M.info=label('bn-if');
    M.hb=new THREE.Vector3();
    M.ray=new THREE.Raycaster();M.built=true;
  }catch(e){M.fail=true;try{console.warn('보난자 3D 준비 실패',e)}catch(_){}}
  return M.built;
}
function placeCard(id,p,rx,ry,s,from){
  let g=M.cards.get(id);
  if(!g){const f=from||p;g=makeCard(f,rx,ry,s);g.children[0].material=faceMat(id);M.cards.set(id,g)}
  const u=g.userData;u.p.copy(p);u.rx=rx;u.ry=ry;u.s=s;return g;
}
G.field3D=(v,pv,me)=>{
  const o=v.o;if(!o||!T.ok||!M.built||!M.on)return;
  if(v.st==='wait')return;
  if(M.gn!==o.gn){clearCards();M.gn=o.gn}
  const seen=new Set(),where=new Map(),gain=M.seats.map((S,i)=>i<v.ps.length?Math.max(0,o.cn[i]-S.to):0),n=v.ps.length,target=plantTarget(),deal=!!T.deal;
  const handFrom=i=>{const f=i===me?nearMe():seatPos(i,3.85);f.y=.5;return f};
  const deckAt=new THREE.Vector3(-PX,.5,PZ);
  M.labels.forEach(el=>{el.hidden=true});
  M.seats.forEach((S,i)=>{
    const on=i<n&&!deal;
    S.slots.forEach(o2=>{o2.visible=false});
    if(!on){S.coins.forEach(c=>{c.visible=false});return}
    const a=seatAngle(i),F=o.fd[i],nf=F.length;
    {const b=coinBase(i,nf);if(S.to!==o.cn[i]){const up=o.cn[i]>S.to;S.to=o.cn[i];S.at=clock()+(up?420:0)}setLabel(S.lb,posOf(i,i===me?b.r:b.r+.32,i===me?b.lt:b.lt,.05),`${COIN}${S.shown}`)}
    S.coins.forEach((c,k)=>{c.position.copy(coinAt(i,nf,k))});
    F.forEach((L,f)=>{
      const tan=fieldTan(f,nf),sl=S.slots[f];
      sl.position.copy(posOf(i,R_F,tan,.022));sl.rotation.set(-Math.PI/2,0,a);sl.visible=true;
      sl.material=i===me&&target>=0&&accepts(L,target)?M.sH:M.sN;
      L.forEach((id,c)=>{const q=Math.min(c,9),p=posOf(i,R_F+q*.05,tan,.03+c*.006);seen.add(id);where.set(id,i);placeCard(id,p,-Math.PI/2,a,CS,handFrom(i))});
      const b=badgeOf(i,f);
      if(b){setLabel(S.badges[f],posOf(i,R_B,tan,.03),badgeHTML(b));S.badges[f].classList.toggle('arm',!!b.arm)}
    });
    if(+v.cfg.buy3&&n>3&&nf<3&&i===me&&v.st==='play'){const sl=S.slots[2];sl.position.copy(posOf(i,R_F,fieldTan(nf,nf)+.05,.022));sl.rotation.set(-Math.PI/2,0,a);sl.visible=true;sl.material=o.cn[i]>=FIELD3?M.sH:M.sN}
    const Tp=o.tmp[i];
    Tp.forEach((id,k)=>{const lift=i===me&&id===tmpSel?.22:0,p=posOf(i,R_T-lift*.3,(k-(Tp.length-1)/2)*.4,.05+k*.008+lift);seen.add(id);where.set(id,i);placeCard(id,p,-Math.PI/2,a,TS,deckAt)});
  });
  o.up.forEach((id,k)=>{
    const lift=C.gf.includes(id)||C.wf.includes(id)?.2:0,p=new THREE.Vector3((k-(o.up.length-1)/2)*.84,.05+lift,UZ);seen.add(id);placeCard(id,p,-Math.PI/2,0,.8,deckAt);
  });
  if(o.dt>=0){seen.add(o.dt);placeCard(o.dt,new THREE.Vector3(PX,.03,PZ),-Math.PI/2,0,.55,new THREE.Vector3(PX,.4,PZ))}
  for(const [id,g] of M.cards)if(!seen.has(id)){
    const u=g.userData,s=M.where.get(id);
    if(s!=null&&gain[s]>0){gain[s]--;const q=coinAt(s,o.fd[s].length,Math.min(MAX_COIN-1,M.seats[s].to-1-gain[s]));u.p.copy(q);u.p.y+=.06;u.rx=Math.PI/2;u.s=.3}   // 코인이 되는 카드: 뒤집혀 코인 더미로
    else{u.p.set(PX,.2,PZ);u.s=.4}
    u.die=true;M.cards.delete(id);
  }
  M.where=where;
  if(!M.deck){M.deck=makeCard(new THREE.Vector3(-PX,.04,PZ),Math.PI/2,0,.55)}
  M.deck.visible=!deal&&o.dk>0;
  if(!deal)setLabel(M.info,new THREE.Vector3(0,.03,PZ-.5),`더미 ${o.dk} · ${o.runs}/3회`);
};
/* 매 프레임: 표를 3D 자리로, 코인을 카드가 닿은 뒤에 (시작 시각과의 차이로), 펠트는 이 게임 동안 숨김 */
function hideFelt(on){if(!T.felt)return;T.felt.mat.visible=!on;if(T.felt.ink)T.felt.ink.visible=!on}
function step(){
  M.raf=0;if(!M.on||!V||!V.o)return;
  M.raf=requestAnimationFrame(step);
  hideFelt(true);
  const now=clock(),r=$('#cv').getBoundingClientRect(),st=$('#stage').getBoundingClientRect(),v=M.hb;
  for(const el of M.labels){
    if(el.hidden||!el._p)continue;
    v.copy(el._p).project(T.cam);
    const x=Math.round(r.left-st.left+(v.x+1)/2*r.width),y=Math.round(r.top-st.top+(1-v.y)/2*r.height),k=x+','+y;
    if(el._k!==k){el._k=k;el.style.transform=`translate(${x}px,${y}px) translate(-50%,-50%)`}
  }
  M.seats.forEach(S=>{
    if(S.shown===S.to||now<S.at)return;
    S.shown=S.to;S.coins.forEach((c,k)=>{c.visible=k<S.shown});S.lb._h='';if(V)S.lb.innerHTML=`${COIN}${S.shown}`;
  });
}
function clearCards(){M.where.clear();for(const S of M.seats){S.shown=S.to=0;S.coins.forEach(c=>{c.visible=false})}for(const el of M.labels)el.hidden=true;for(const g of M.cards.values())killCard(g);M.cards.clear();if(M.deck){killCard(M.deck);M.deck=null}}
function tablePoint(e){
  const r=$('#cv').getBoundingClientRect();if(!r.width)return null;
  M.ray.setFromCamera({x:(e.clientX-r.left)/r.width*2-1,y:-(e.clientY-r.top)/r.height*2+1},T.cam);
  const a=M.ray.ray,k=-a.origin.y/a.direction.y;return {x:a.origin.x+a.direction.x*k,z:a.origin.z+a.direction.z*k};
}
function tableClick(e){
  if(currentG()!==G||!M.on||!V||!V.o||V.st!=='play')return;
  if(clock()-(VW.movedAt||-1e9)<400)return;   // 고개를 돌리려고 끈 것은 누르기가 아님
  const P=tablePoint(e),o=V.o,me=myIdx();if(!P)return;
  const up=o.up.findIndex((id,k)=>Math.abs(P.x-(k-(o.up.length-1)/2)*.84)<.4&&Math.abs(P.z-UZ)<.5);
  if(up>=0){tapUp(o.up[up]);return}
  if(!iSeat())return;
  const Tp=o.tmp[me],open=C.open;
  for(let k=Tp.length-1;k>=0;k--){const p=posOf(me,R_T,(k-(Tp.length-1)/2)*.4);if(Math.abs(P.x-p.x)<.26&&Math.abs(P.z-p.z)<.42){tapTemp(Tp[k]);return}}
  const nf=o.fd[me].length;
  for(let f=0;f<nf;f++){const p=posOf(me,R_F+.2,fieldTan(f,nf));if(Math.abs(P.x-p.x)<.4&&Math.abs(P.z-p.z)<.75){tapField(f);return}}
  if(+V.cfg.buy3&&V.ps.length>3&&nf<3){const p=posOf(me,R_F,fieldTan(nf,nf)+.05);if(Math.abs(P.x-p.x)<.4&&Math.abs(P.z-p.z)<.6){if(o.cn[me]>=FIELD3)sendAct({t:'buy'});else sfx('no');return}}
  if(open){C.open=false;refresh()}   // 빈 곳을 누르면 거래 창을 닫음
}

/* ---------- 2D 칸: 단계·거래 (3D 위) + WebGL이 없을 때의 밭 ---------- */
const chip=(t,n)=>`<span class="bn-chip" style="--c:${BEANS[t].col}">${BEANS[t].n}${n>1?'×'+n:''}</span>`;
function chips(L){const m=new Map();for(const t of L)m.set(t,(m.get(t)||0)+1);return m.size?[...m].map(([t,n])=>chip(t,n)).join(''):'<span class="bn-none"></span>'}
/* 언제나 왼쪽 = 내가 줄 것, 오른쪽 = 내가 받을 것 */
const swapLine=(give,get)=>`<span class="bn-sw">${chips(give)}</span><span class="bn-ar">→</span><span class="bn-sw">${chips(get)}</span>`;
const phText=o=>o.ph==='p1'?`심기 ${Math.min(2,o.pl+1)}/2`:o.ph==='trade'?'거래':o.ph==='p3'?'임시 구역 심기':'';
function drawPan(){
  if(!elPan||!V||!V.o)return;
  const o=V.o,me=myIdx(),tr=inTrade();
  if(!tr){if(lastPan){elPan.innerHTML='';lastPan=''}return}
  const P=V.ps,H2=[...sel].filter(id=>myHand().includes(id)),act=isAct();
  const ofHTML=o.of.map(x=>{
    const mine=x.f===me,other=mine?x.to:x.f,wants=[...x.w,...x.wf.map(typ)],get=mine?wants:x.g,give=mine?x.g:wants;
    const can=mine||!!pickFor(x);
    return `<div class="bn-of" data-o="${x.id}"><b>${esc(P[other].n)}</b>${swapLine(give,get)}<span class="bn-sp"></span>${mine?`<button type="button" data-k="cancel" data-o="${x.id}">취소</button>`:`<button type="button" class="bn-ok" data-k="accept" data-o="${x.id}"${can?'':' disabled'}>수락</button><button type="button" data-k="counter" data-o="${x.id}">다시 제안</button><button type="button" data-k="reject" data-o="${x.id}">거절</button>`}</div>`}).join('');
  let comp='';
  if(C.open){
    const pick=act?P.map((p,i)=>i===me||p.f?'':`<button type="button" class="bn-to${C.to===i?' on':''}" data-to="${i}">${esc(p.n)}</button>`).join(''):`<b class="bn-who">${esc(P[o.act].n)}</b>`;
    const grid=BEANS.map((b,t)=>`<button type="button" class="bn-bean" data-w="${t}" aria-label="${b.n}">${beanSvg(b.col)}<span>${b.n}</span></button>`).join('');
    const giveL=[...H2.map(typ),...C.gf.map(typ)],getL=[...C.want,...C.wf.map(typ)];
    comp=`<div class="bn-tr"><div class="bn-r bn-tabs">${pick}<span class="bn-sp"></span><button type="button" class="bn-x" data-k="close" aria-label="닫기">✕</button></div><div class="bn-r bn-line">${swapLine(giveL,getL)}</div><div class="bn-g">${grid}</div><div class="bn-r bn-e"><button type="button" data-k="clear">비우기</button>${C.want.length?'<button type="button" data-k="unwant">하나 빼기</button>':''}<span class="bn-sp"></span><button type="button" class="bn-ok" data-k="send">제안</button></div></div>`;
  }
  const h=ofHTML+comp;
  if(h!==lastPan){elPan.innerHTML=h;lastPan=h;lockTick()}
}
function lockTick(){
  if(!elPan)return;const t=clock();
  elPan.querySelectorAll('[data-k="accept"]').forEach(b=>{const id=+b.dataset.o,lk=t<(lockAt.get(id)||0);b.classList.toggle('lk',lk)});
}
const fieldTxt=(i,f)=>{const L=V.o.fd[i][f];if(!L.length)return '빈 밭';const b=badgeOf(i,f),nm=BEANS[typ(L[0])].n;return b.arm?`${nm} 수확 ${b.now}코인`:`${nm} ${b.n}${b.at?`/${b.at} (${b.c}코인)`:' MAX'}${b.lock?' ✕':''}`};
function draw2d(){
  if(!el2d||!V||!V.o)return;
  if(M.on){if(last2d){el2d.innerHTML='';last2d=''}return}
  const o=V.o,me=myIdx(),target=plantTarget();
  const rows=V.ps.map((p,i)=>`<div class="bn-p${o.act===i?' on':''}"><b>${esc(p.n)}</b><span class="bn-l">${o.cn[i]}코인</span>${o.fd[i].map((L,f)=>i===me?`<button type="button" class="bn-fd${target>=0&&accepts(L,target)?' hi':''}" data-f="${f}">${fieldTxt(i,f)}</button>`:`<span class="bn-fd">${fieldTxt(i,f)}</span>`).join('')}${o.tmp[i].map(id=>i===me?`<button type="button" class="bn-pick${id===tmpSel?' on':''}" data-t="${id}">${chip(typ(id),1)}</button>`:chip(typ(id),1)).join('')}${i===me&&+V.cfg.buy3&&V.ps.length>3&&o.fd[i].length<3?'<button type="button" class="bn-fd" data-k="buy">밭 사기</button>':''}</div>`).join('');
  const up=o.up.length?`<div class="bn-p"><span class="bn-l">공개</span>${o.up.map(id=>`<button type="button" class="bn-pick" data-u="${id}">${chip(typ(id),1)}</button>`).join('')}</div>`:'';
  const h=`<div class="bn-p"><span class="bn-l">더미 ${o.dk} · ${o.runs}/3회</span></div>${up}${rows}`;
  if(h!==last2d){el2d.innerHTML=h;last2d=h}
}
G.hud=inGame=>{
  if(!elBox)return;
  const on=!!(inGame&&V&&V.o);
  elBox.hidden=!on;
  const d3=on&&build();
  if(d3!==M.on){M.on=d3;if(M.root)M.root.visible=d3;$('#stage').classList.toggle('bn3d',d3);if(d3){hideFelt(true);if(!M.raf)M.raf=requestAnimationFrame(step)}else{hideFelt(false);clearCards()}}
  if(M.lbBox)M.lbBox.hidden=!d3;
  $('#stage').classList.toggle('bng',on);
  $('#stage').classList.toggle('bn2d',on&&!d3);
  if(!on)return;
  drawPan();draw2d();
};
G.live=()=>{
  if(!elSt||!V||!V.o)return;
  const o=V.o,t=phText(o),sec=V.st==='play'&&!dealingV()?Math.ceil(Math.max(0,(V.deadAt-clock())/1000)):0,txt=t&&sec?`${t} ${sec}`:t;
  if(elSt.textContent!==txt)elSt.textContent=txt;
  lockTick();
  if(arm>=0&&clock()-armAt>3000){arm=-1;refresh()}
};
G.overRank=p=>{const t=p.sr===3?'탈주':p.sr?'항복':`${+p.cn||0}코인`;return `<span class="left">${t}</span>`};
G.enter=()=>{$('#btnGura').hidden=true};
G.leave=()=>{
  clearCards();M.gn=0;clearC();C.open=false;tmpSel=-1;arm=-1;lockAt.clear();lastPan='';last2d='';
  if(elBox)elBox.hidden=true;if(elPan)elPan.innerHTML='';if(el2d)el2d.innerHTML='';
  if(M.root)M.root.visible=false;M.on=false;hideFelt(false);if(M.lbBox)M.lbBox.hidden=true;
  $('#stage').classList.remove('bng','bn3d','bn2d');
  $('#btnPlay').hidden=false;$('#btnPlay').disabled=false;
  $('#btnPass').hidden=false;$('#btnPass').disabled=false;$('#btnPass').firstChild.nodeValue='패스';
};
G.holoPiece=mkM=>{
  const g=new THREE.Group(),m=mkM(0xffffff),a=new THREE.Mesh(new THREE.SphereGeometry(.17,20,14),m),b=new THREE.Mesh(new THREE.SphereGeometry(.17,20,14),m);
  a.position.set(-.11,.02,0);a.scale.set(1.15,.85,.8);b.position.set(.12,-.03,0);b.scale.set(1.05,.8,.8);g.add(a,b);g.rotation.z=.25;return g;
};
G.init=()=>{
  const css=document.createElement('style');
  css.textContent=`
.bn-box{position:absolute;inset:0;pointer-events:none;z-index:7}
.bn-box[hidden]{display:none}
.bn-st{position:absolute;top:8px;left:50%;transform:translateX(-50%);padding:3px 12px;border-radius:999px;background:rgba(47,32,22,.78);color:#fff6e4;font:600 13px "Jua","IBM Plex Mono",sans-serif;white-space:nowrap}
.bn-st:empty{visibility:hidden}
.bn-pan{position:absolute;left:50%;transform:translateX(-50%);top:56px;width:min(440px,calc(100% - 16px));display:flex;flex-direction:column;gap:4px}
.bn-lbs{position:absolute;inset:0;pointer-events:none;z-index:2;overflow:hidden}
.bn-lbs[hidden]{display:none}
.bn-lb{position:absolute;left:0;top:0;display:flex;align-items:center;justify-content:center;gap:2px;padding:1px 7px;border-radius:999px;background:rgba(47,32,22,.84);color:#fff6e4;font:600 12px "IBM Plex Mono","Jua",monospace;white-space:nowrap;text-align:center}
.bn-lb[hidden]{display:none}
.bn-lb.arm{background:#b5321e}
.bn-lb u{text-decoration:none;color:#ff8a7a;margin-left:3px}
.bn-if{font-family:"Jua",sans-serif;font-size:11.5px;background:rgba(47,32,22,.66)}
.bn-co{display:inline-block;width:.85em;height:.85em;margin:0 1px;border-radius:50%;background:#f0c24a;border:1.5px solid #8a5f14;box-sizing:border-box}
.bn-of,.bn-tr,.bn-p{pointer-events:auto;background:rgba(255,250,240,.96);border:1px solid var(--line-strong);border-radius:10px;padding:5px 7px;color:#3b2a1f;font-size:13px}
.bn-of{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:5px}
.bn-tr{display:flex;flex-direction:column;gap:6px;padding:7px 8px}
.bn-sw{display:inline-flex;flex-wrap:wrap;justify-content:center;gap:3px;min-width:58px}
.bn-ar{font-weight:700;color:#7a6650}
.bn-line{justify-content:center;gap:8px;min-height:30px;padding:3px;border-radius:8px;background:rgba(59,42,31,.07)}
.bn-tabs .bn-who{padding:2px 4px}
.bn-box button.bn-x{border:none;background:none;padding:2px 6px;color:#7a6650}
.bn-box button.bn-bean{display:flex;flex-direction:column;align-items:center;gap:0;padding:3px 0 2px;border:none;background:none;min-width:0}
.bn-box button.bn-bean:active{background:rgba(59,42,31,.1)}
.bn-bean svg{width:30px;height:22px;display:block}
.bn-bean span{font-size:10px;line-height:1.2;color:#3b2a1f;white-space:nowrap}
.bn-r{display:flex;flex-wrap:wrap;align-items:center;gap:4px;min-height:24px}
.bn-g{display:grid;grid-template-columns:repeat(8,1fr);gap:1px}
.bn-sp{flex:1}
.bn-l{font-size:11.5px;color:#7a6650}
.bn-none{display:inline-block;width:46px;height:19px;border:1.5px dashed #b6a58f;border-radius:7px;box-sizing:border-box}
.bn-chip{display:inline-block;padding:1px 6px;border-radius:8px;background:var(--c);color:#fff;font-size:12px;font-weight:600;white-space:nowrap}
.bn-box button{font:inherit;font-size:12.5px;padding:3px 8px;border-radius:8px;border:1px solid var(--line-strong);background:#fff;color:#3b2a1f;cursor:pointer}
.bn-box button:disabled{opacity:.45}
.bn-box button.lk{opacity:.5}
.bn-box .bn-ok{background:#2e7d4f;border-color:#2e7d4f;color:#fff}
.bn-box .bn-to.on,.bn-box .bn-pick.on{outline:2px solid #e0a020}
.bn-box .bn-pick{padding:1px;background:none;border:none;line-height:1.3}
@media(max-width:699px){.stage.bng #actions{transform:translateY(64px)}.stage.bng #actions button{min-height:0;height:36px;padding:0 10px;font-size:15px}.stage.bng #actions button small{display:none}}
.stage.bng .card.bn-c{overflow:hidden}
.stage.bng .card.bn-c .bn-nm{position:absolute;left:0;right:0;top:0;padding:2px 0;background:var(--rc);color:#fffcf5;font:600 11px "Jua",sans-serif;text-align:left;padding-left:5px;white-space:nowrap}
.stage.bng .card.bn-c .bn-be{position:absolute;left:7px;right:7px;top:27px;pointer-events:none}
.stage.bng .card.bn-c .bn-be svg{display:block;width:100%}
.stage.bng .card.bn-c .bn-mt{position:absolute;left:0;right:0;bottom:4px;text-align:center;font:600 10px "IBM Plex Mono",monospace;color:#3b2a1f}
.stage.bng .card.bn-c.bn-f1{outline:3px solid #2e9d5f;outline-offset:-1px}
.bn-2d{position:absolute;left:8px;right:8px;top:66px;display:flex;flex-direction:column;gap:4px;max-height:calc(100% - 300px);overflow:auto;pointer-events:auto}
.bn-p{display:flex;flex-wrap:wrap;align-items:center;gap:5px}
.bn-p.on{border-color:#c98a1e;box-shadow:0 0 0 1px #c98a1e}
.bn-fd{padding:2px 7px;border-radius:7px;background:rgba(59,42,31,.1);font-size:12.5px}
.bn-box button.bn-fd.hi{outline:2px solid #e0a020}
`;
  document.head.appendChild(css);
  elBox=document.createElement('div');elBox.className='bn-box';elBox.hidden=true;elBox.innerHTML='<div class="bn-st"></div><div class="bn-2d"></div><div class="bn-pan"></div>';
  $('#stage').appendChild(elBox);
  M.lbBox=document.createElement('div');M.lbBox.className='bn-lbs';M.lbBox.hidden=true;$('#stage').appendChild(M.lbBox);
  elSt=elBox.querySelector('.bn-st');elPan=elBox.querySelector('.bn-pan');el2d=elBox.querySelector('.bn-2d');
  $('#cv').addEventListener('click',tableClick);
  elBox.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b||!V||!V.o)return;
    const d=b.dataset,k=d.k,id=+d.o;
    if(d.f!=null)tapField(+d.f);
    else if(d.t!=null)tapTemp(+d.t);
    else if(d.u!=null)tapUp(+d.u);
    else if(d.to!=null){C.to=+d.to;sfx('pick');drawPan()}
    else if(d.w!=null){if(C.want.length<MAX_WANT){C.want.push(+d.w);sfx('pick');drawPan()}else sfx('no')}
    else if(k==='close'){C.open=false;drawPan()}
    else if(k==='send')sendOffer();
    else if(k==='clear'){clearC();sel.clear();renderMe();refresh()}
    else if(k==='unwant'){C.want.pop();drawPan()}
    else if(k==='accept')acceptOf(id);
    else if(k==='reject')sendAct({t:'reject',id});
    else if(k==='cancel')sendAct({t:'cancel',id});
    else if(k==='counter')counterOf(id);
    else if(k==='buy')sendAct({t:'buy'});
  });
};
(window.GAMES=window.GAMES||{}).bohnanza=G;
})();
