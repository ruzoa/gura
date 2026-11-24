/* ===== 보난자 게임 모듈 =====
   3~5명. 콩을 심고 거래하고 수확해 코인을 가장 많이 모으는 카드 게임. 규칙은 AMIGO 현행 규칙서 기본 게임 기준.
   카드 id 0~103 = 콩 8종 104장. 손패 순서는 절대 바꾸지 않음(맨 앞이 다음에 심을 카드, 새 카드는 맨 뒤).
   단계 ph: p1(손패 심기) → trade(카드 2장 공개·거래) → p3(모두 임시 구역 심기, 동시) → 뽑기 3장 → 다음 사람. done은 끝.
   거래: 제안(offer)을 보내면 제안자의 수락, 받는 쪽이 수락하면 그 자리에서 교환. 제안 내용은 바꿀 수 없고 다시 보내면 새 제안(수락도 처음부터).
   받는 쪽에는 콩 종류만 보냄: 손패 카드 id·위치는 제안자에게만 있음(snap 참고). 거래로 받은 카드는 임시 구역으로 가고 다시 거래할 수 없음 */
(function(){
const G={id:'bohnanza',name:'보난자',short:'보난자',lead:'콩을 심고 거래해 코인을 모으는 카드 게임',dealAnim:true,maxHi:5,minN:3,noFast:true,emptyHandOk:true,firstPick:true};

/* ---------- 규칙 값 ---------- */
/* m: 1·2·3·4코인에 필요한 장수 (0이면 그 코인 칸 없음) */
const BEANS=[
  {n:'완두콩',c:20,m:[4,6,8,10],col:'#4f9a4a'},{n:'메주콩',c:18,m:[3,6,8,9],col:'#c9a227'},{n:'검은콩',c:16,m:[3,5,7,8],col:'#33333b'},{n:'강낭콩',c:14,m:[3,5,6,7],col:'#8a3a78'},
  {n:'렌즈콩',c:12,m:[2,4,6,7],col:'#d9782a'},{n:'병아리콩',c:10,m:[2,4,5,6],col:'#d99a5f'},{n:'팥',c:8,m:[2,3,4,5],col:'#8e1f2e'},{n:'작두콩',c:6,m:[0,2,3,0],col:'#eab8bc',tx:'#5a2f2f'}];
const TYPE=[];BEANS.forEach((b,t)=>{for(let k=0;k<b.c;k++)TYPE.push(t)});
const typ=id=>TYPE[id];
const coinsFor=(t,n)=>{let c=0;BEANS[t].m.forEach((x,k)=>{if(x&&n>=x)c=k+1});return c};
/* 다음 코인까지: {at:필요 장수, c:그때 코인} / 더 없으면 null */
const nextStep=(t,n)=>{const m=BEANS[t].m;for(let k=0;k<4;k++)if(m[k]&&n<m[k])return {at:m[k],c:k+1};return null};
const DICE_LEAD=300,DICE_REST=800;   // 카드를 나눈 뒤 첫 차례 주사위
const HAND0=5,DRAW=3,TURN_UP=2,LAST_RUN=3,LOCK_MS=1000,MAX_WANT=8,MAX_OFFERS=6;
const FIELD3=3;   // 세 번째 밭 값 (예전 판 규칙, 설정으로 켬)

/* ---------- 카드 ---------- */
const INK='#3b2a1f';
/* 콩 그림은 여기 하나: 120×88 칸에 그림. 모양 하나 + 특징 하나, 웃는 얼굴은 공통. 손패·칩은 이 그림을 이미지로(beanImg), 탁자 카드는 그대로 씀 */
function drawBean(g,t){
  const paint=(fill,w)=>{g.fillStyle=fill;g.fill();g.strokeStyle=INK;g.lineWidth=w||2.4;g.stroke()};
  const ell=(x,y,a,b,r)=>{g.beginPath();g.ellipse(x,y,a,b,r||0,0,7)};
  const face=(x,y,k,c)=>{const q=k||1,col=c||INK;g.fillStyle=col;for(const d of [-8,8]){g.beginPath();g.arc(x+d*q,y,2.6*q,0,7);g.fill()}g.strokeStyle=col;g.lineWidth=2.2*q;g.lineCap='round';g.beginPath();g.moveTo(x-4*q,y+6*q);g.quadraticCurveTo(x,y+10*q,x+4*q,y+6*q);g.stroke()};
  const shine=(x,y,a,b,r)=>{g.fillStyle='rgba(255,255,255,.45)';ell(x,y,a,b,r);g.fill()};
  g.save();g.lineJoin='round';
  if(t===0){   // 완두콩: 열린 꼬투리에 세 알
    g.beginPath();g.moveTo(5,50);g.bezierCurveTo(30,14,90,8,115,36);g.bezierCurveTo(95,72,30,78,5,50);g.closePath();paint('#3f8a3a');
    g.beginPath();g.moveTo(16,49);g.bezierCurveTo(38,26,84,22,104,38);g.bezierCurveTo(86,60,36,66,16,49);g.closePath();paint('#2f6d2d',1.6);
    for(const [x,y,r] of [[36,48,11],[60,43,13.5],[84,38,11]]){ell(x,y,r,r);paint('#9bd872',2)}
    face(60,42,.72);
  }else if(t===1){   // 메주콩: 둥글고 통통, 볼
    ell(60,45,38,34);paint('#ecc94f');shine(46,26,12,6,-.4);
    g.fillStyle='rgba(232,120,110,.55)';for(const x of [37,83]){ell(x,52,7,4.5);g.fill()}
    face(60,45,1.15);
  }else if(t===2){   // 검은콩: 작고 윤기
    ell(60,46,30,29);paint('#25252c');shine(47,31,10,5.5,-.5);g.fillStyle='rgba(255,255,255,.8)';ell(76,30,2.6,2.6);g.fill();
    face(60,48,1,'#f5efe0');
  }else if(t===3){   // 강낭콩: 콩팥 모양, 얼룩
    g.beginPath();g.moveTo(14,50);g.bezierCurveTo(6,18,34,6,58,18);g.bezierCurveTo(68,23,76,22,86,14);g.bezierCurveTo(108,6,120,38,104,58);g.bezierCurveTo(84,84,24,84,14,50);g.closePath();paint('#a14a8e');
    g.fillStyle='#dfa9d4';for(const [x,y,a,b,r] of [[30,30,8,4,.5],[92,28,7,4,-.6],[24,56,5,3,.2],[100,50,5,3,-.3],[62,70,8,3,0],[42,18,4,2.5,-.3]]){ell(x,y,a,b,r);g.fill()}
    face(61,44,1);
  }else if(t===4){   // 렌즈콩: 납작한 볼록렌즈, 안경
    ell(60,46,52,26);paint('#ea8c3a');g.strokeStyle='rgba(255,255,255,.4)';g.lineWidth=3;ell(60,46,41,17);g.stroke();
    g.fillStyle=INK;for(const x of [46,74]){g.beginPath();g.arc(x,44,2.8,0,7);g.fill()}
    g.strokeStyle=INK;g.lineWidth=2.6;for(const x of [46,74]){ell(x,44,11,11);g.stroke()}
    g.beginPath();g.moveTo(57,44);g.lineTo(63,44);g.moveTo(35,43);g.lineTo(24,40);g.moveTo(85,43);g.lineTo(96,40);g.stroke();
    g.lineCap='round';g.beginPath();g.moveTo(55,59);g.quadraticCurveTo(60,63,65,59);g.stroke();
  }else if(t===5){   // 병아리콩: 끝이 뾰족, 부리와 깃
    g.strokeStyle=INK;g.lineWidth=2.6;g.lineCap='round';g.beginPath();g.moveTo(60,14);g.lineTo(52,3);g.moveTo(60,14);g.lineTo(60,1);g.moveTo(60,14);g.lineTo(68,3);g.stroke();
    g.beginPath();g.moveTo(60,8);g.bezierCurveTo(72,18,96,24,94,52);g.bezierCurveTo(92,78,28,78,26,52);g.bezierCurveTo(24,24,48,18,60,8);g.closePath();paint('#f2c49a');shine(44,34,8,5,-.5);
    g.fillStyle=INK;for(const x of [50,70]){g.beginPath();g.arc(x,44,2.8,0,7);g.fill()}
    g.beginPath();g.moveTo(53,51);g.lineTo(67,51);g.lineTo(60,60);g.closePath();paint('#f08a2a',2);
  }else if(t===6){   // 팥: 작고 길쭉, 흰 줄
    ell(60,46,36,23,-.18);paint('#9a2233');shine(44,34,9,4,-.4);
    g.strokeStyle='#f5e9da';g.lineWidth=4;g.lineCap='round';g.beginPath();g.moveTo(62,63);g.quadraticCurveTo(82,60,91,44);g.stroke();
    face(55,45,.95,'#f5e9da');
  }else{   // 작두콩: 칼처럼 휜 긴 꼬투리, 왕관
    g.beginPath();g.moveTo(4,70);g.bezierCurveTo(30,74,84,58,116,18);g.bezierCurveTo(112,50,70,86,16,84);g.quadraticCurveTo(6,80,4,70);g.closePath();paint('#f5ccce');
    g.strokeStyle='rgba(120,70,70,.5)';g.lineWidth=2;g.beginPath();g.moveTo(14,77);g.bezierCurveTo(50,78,88,62,110,30);g.stroke();
    face(60,69,.72);
    g.beginPath();g.moveTo(44,46);g.lineTo(42,18);g.lineTo(53,30);g.lineTo(60,12);g.lineTo(67,30);g.lineTo(78,18);g.lineTo(76,42);g.closePath();paint('#f0c24a',2.2);
    g.fillStyle='#c0392b';g.beginPath();g.arc(60,35,3,0,7);g.fill();
  }
  g.restore();
}
const beanUrl={};
function beanImg(t){
  if(!beanUrl[t]){const c=document.createElement('canvas');c.width=240;c.height=176;const g=c.getContext('2d');g.scale(2,2);drawBean(g,t);beanUrl[t]=c.toDataURL('image/png')}
  return `<img class="bn-bi" src="${beanUrl[t]}" alt="" draggable="false">`;
}
const meterTxt=t=>BEANS[t].m.map(x=>x||'-').join(' ');
Object.assign(G,{labelOf:id=>BEANS[typ(id)].n,cmpCard:(a,b)=>typ(a)-typ(b)||a-b});
G.cardHTML=(id,extra)=>{const t=typ(id),b=BEANS[t],nm=__(b.n);return `<button type="button" class="card bn-c ${extra||''}" data-id="${id}" data-nx="${__('다음 심기')}" style="--rc:${b.col};--tc:${b.tx||'#fffcf5'}" aria-label="${b.n}"><span class="bn-nm"${[...nm].length>7?' style="font-size:.78em;letter-spacing:-.02em"':''}>${nm}</span><span class="bn-be">${beanImg(t)}</span><span class="bn-mt">${meterTxt(t)}</span></button>`};
G.faceKey=id=>typ(id);   // 같은 콩은 3D 앞면 하나를 같이 씀 (카드마다 만들면 100장 넘게 쌓임)
G.drawFace=function(g,w,h,id){
  const t=typ(id),b=BEANS[t],k=w/60;
  g.clearRect(0,0,w,h);g.save();rr(g,0,0,w,h,8*k);g.clip();g.fillStyle='#fffcf5';g.fillRect(0,0,w,h);g.fillStyle=b.col;g.fillRect(0,0,w,20*k);g.restore();
  g.strokeStyle='#e3d4bb';g.lineWidth=k;rr(g,k/2,k/2,w-k,h-k,8*k);g.stroke();
  g.fillStyle=b.tx||'#fffcf5';g.textAlign='center';g.textBaseline='middle';const nm=__(b.n);let fs=11.5*k;g.font=`700 ${fs}px "Jua",sans-serif`;while(fs>7*k&&g.measureText(nm).width>w-6*k){fs-=.5*k;g.font=`700 ${fs}px "Jua",sans-serif`}g.fillText(nm,w/2,10.5*k);   // 번역한 이름이 길면 머리띠 안에 들어가게 줄임
  g.save();g.translate(3*k,26*k);g.scale(k*54/120,k*54/120);drawBean(g,t);g.restore();
  g.fillStyle='#3b2a1f';g.font=`700 ${9.5*k}px "IBM Plex Mono",monospace`;g.fillText(meterTxt(t),w/2,76*k);
};

/* ---------- 규칙 설명·방 설정 ---------- */
G.rulesHTML='<ol class="rules"><li><b>목표</b> : 콩을 수확해 코인을 가장 많이 모읍니다</li><li><b>손패</b> : 순서를 바꿀 수 없습니다. 맨 앞 카드부터 심고, 새 카드는 맨 뒤로 들어갑니다</li><li><b>1. 심기</b> : 맨 앞 카드를 꼭 심고, 한 장 더 심을 수 있습니다. 한 밭에는 한 종류만 심습니다</li><li><b>2. 거래</b> : 2장을 공개하고, 차례인 사람과 거래하거나 그냥 줄 수 있습니다</li><li><b>3. 또 심기</b> : 공개 카드와 거래로 받은 카드를 모두 심습니다</li><li><b>4. 뽑기</b> : 3장을 뽑아 손패 맨 뒤에 넣습니다</li><li><b>수확</b> : 언제든 밭을 두 번 눌러 수확합니다. 2장 이상인 밭이 있으면 1장뿐인 밭은 수확할 수 없습니다</li><li><b>끝</b> : 더미가 세 번째로 떨어지면 끝나고 코인이 많은 사람이 이깁니다</li></ol>';
G.modeDesc=['콩을 심고 거래하기','콩을 심고 거래하기'];
G.defaults={max:5,turn:20,tt:45,buy3:0,pickfirst:0};
G.roomSet=[
  {k:'turn',label:'심기 제한 시간',unit:'초',lo:10,hi:60,step:5,desc:'손패 심기와 임시 구역 심기의 제한 시간입니다. 지나면 자동으로 심습니다'},
  {k:'tt',label:'거래 제한 시간',unit:'초',lo:20,hi:180,step:5,desc:'거래 단계의 제한 시간입니다. 지나면 거래가 끝납니다'}];
G.ruleSet=[{k:'pickfirst',pick:1,label:'선 플레이어',desc:'선택: 방장이 대기실에서 먼저 시작할 사람을 고릅니다. 무작위: 카드를 나눈 뒤 주사위로 정합니다'},{k:'buy3',label:'세 번째 밭 사기',desc:'예전 판 규칙: 4~5명일 때 3코인으로 세 번째 밭을 살 수 있습니다. 현행 규칙서 기본 게임에는 없습니다'}];
G.fixCfg=(c,n,strict)=>{const r={...c};if(!(+r.max>=3))r.max=3;return r};
G.cfgChips=c=>`<span class="chip">심기 <b>${+c.turn||20}초</b></span><span class="chip">거래 <b>${+c.tt||45}초</b></span>`;
G.cfgSum=c=>`심기 ${+c.turn||20}초 · 거래 ${+c.tt||45}초 · 선 ${+c.pickfirst?'선택':'무작위'}${+c.buy3?' · 세 번째 밭 사기':''}`;
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
  O.ph='trade';O.up=[];O.of=[];O.tried={};O.asked={};O.ctr={};O.nask={};
  for(let k=0;k<TURN_UP;k++){const id=draw1();if(id==null)break;O.up.push(id)}
  H.turn=O.act;H.deadline=t+tradeMs();O.t0=t;
  const human=H.players.some(p=>!p.bot);
  O.botEnd=t+(human?rand(8000,12000):rand(2500,3500));
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
  const open=to===-1;   // 아무나: 차례인 사람만 보낼 수 있고 먼저 수락한 사람과 거래
  if(O.ph!=='trade'||!isInt(to)||to===s||(open?s!==O.act:(!P[to]||P[to].finished)))return;
  if(!open&&s!==O.act&&to!==O.act)return;   // 차례인 사람과만
  if(O.of.filter(x=>x.from===s).length>=MAX_OFFERS)return;
  const hand=Array.isArray(a.hand)?a.hand:[],gf=Array.isArray(a.gf)?a.gf:[],want=Array.isArray(a.want)?a.want:[],wf=Array.isArray(a.wf)?a.wf:[];
  if(!hand.length&&!gf.length&&!want.length&&!wf.length)return;
  if(![hand,gf,want,wf].every(L=>L.every(isInt))||want.length>MAX_WANT||!uniq(hand)||!uniq(gf)||!uniq(wf))return;
  if(!hand.every(id=>P[s].hand.includes(id))||!want.every(t=>t>=0&&t<BEANS.length))return;
  if(gf.length&&(s!==O.act||!gf.every(id=>O.up.includes(id))))return;
  if(wf.length&&(to!==O.act||!wf.every(id=>O.up.includes(id))))return;
  O.oid++;O.of.push({id:O.oid,from:s,to,hand:hand.slice(),gf:gf.slice(),want:want.slice(),wf:wf.slice(),at:clock(),rej:[]});   // 제안은 바뀌지 않음: 고치면 새 제안
  P.forEach((q,i)=>{if(i!==s&&(open||i===to)&&realBot(q)&&clock()+500>O.bt[i])wake(i,800,1500)});
  mark();
}
const forMe=(x,s)=>x.from!==s&&(x.to===s||(x.to===-1&&!x.rej.includes(s)));
/* 거절: 아무나 제안은 거절한 사람에게서만 사라지고 모두 거절하면 없어짐 */
function refuse(x,s){
  const O=H.bn;
  if(x.to===-1){x.rej.push(s);if(H.players.some((p,i)=>!p.finished&&forMe(x,i)))return}
  O.of=O.of.filter(q=>q!==x);
}
function valid(x){
  const O=H.bn,P=H.players;
  return x.hand.every(id=>P[x.from].hand.includes(id))&&x.gf.every(id=>O.up.includes(id))&&x.wf.every(id=>O.up.includes(id));
}
function accept(s,a){
  const O=H.bn,x=O.of.find(q=>q.id===a.id);
  if(O.ph!=='trade'||!x||!forMe(x,s)||clock()<x.at+LOCK_MS)return false;
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
/* 봇(쉬움): 내 밭에 맞으면 좋고, 안 맞으면 내주고 싶음 (보통·어려움은 아래 botTrade2 등) */
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
  if(!pick||!valid(x)){refuse(x,s);mark();return}
  const front=H.players[s].hand.slice(0,2),gain=[...x.hand,...x.gf].reduce((v,id)=>v+fit(s,typ(id)),0);
  const loss=pick.reduce((v,id)=>v+(fit(s,typ(id))>=3?3:front.includes(id)?-1:0),0)+x.wf.length;
  if(gain-loss>=0&&accept(s,{id:x.id,pick}))return;
  refuse(x,s);mark();
}
function botTrade(t){
  const O=H.bn,P=H.players;
  P.forEach((p,i)=>{
    if(O.ph!=='trade'||!realBot(p)||p.finished||t<O.bt[i])return;
    if(lvOf(i)>0){botTrade2(i,t);return}
    const inc=O.of.find(x=>forMe(x,i)&&t>=x.at+LOCK_MS);
    if(inc){botAnswer(i,inc);wake(i,700,1300);return}
    wake(i,900,1600);
    O.of=O.of.filter(x=>!(x.from===i&&t>=x.at+7000));
    if(i===O.act){
      for(const id of O.up){
        if(fit(i,typ(id))>-2)continue;
        const j=P.findIndex((q,k)=>k!==i&&!q.finished&&!O.tried[id+':'+k]&&fit(k,typ(id))>=1);
        if(j>=0){O.tried[id+':'+j]=1;offer(i,{to:j,gf:[id]});return}
      }
      if(t>=O.botEnd&&!O.of.some(x=>forMe(x,i)))endTrade();
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
  if(lvOf(s)>0){botP1v(s);return}
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

/* ---------- 봇 보통·어려움 ----------
   보는 것은 공개된 정보뿐: 밭·임시 구역·공개 카드·코인·제안에 적힌 콩 종류, 어려움은 지나간 카드(수확·버린 카드)까지 셈. 남의 손패와 더미 순서는 보지 않음.
   값 = 앞으로 심을 카드(임시 구역 → 손패 앞에서부터)를 차례로 심어 보며 밀려 수확한 코인 + 남은 밭의 값.
   밭의 값 = 지금 코인 + (다음 코인 - 지금 코인) × 모자란 장수를 채울 가능성.
   보통: 손패 앞 3장, 콩마다 전체 장수 비율로 가능성. 어려움: 손패 앞 2장 + 그 뒤 6장은 맞는 밭에 보탬, 안 보인 장수와 남은 차례로 가능성,
   1등을 돕는 만큼 깎고 더 까다롭게 수락, 손패 콩도 청함, 세 번째 밭 사기 */
const lvOf=s=>Math.min(2,botLv(H.players[s]));
function poisAtLeast(l,k){if(k<=0)return 1;let p=Math.exp(-l),c=p;for(let j=1;j<k;j++){p*=l/j;c+=p}return Math.max(0,1-c)}
/* 아직 안 보인 장수 (더미 + 남의 손패): 밭·임시 구역·코인·버린 카드·공개 카드·내 손패를 뺌 */
function unseen(s){
  const O=H.bn,u=BEANS.map(b=>b.c),see=id=>{u[typ(id)]--};
  O.fd.forEach(a=>a.forEach(L=>L.forEach(see)));O.tmp.forEach(L=>L.forEach(see));O.coin.forEach(L=>L.forEach(see));
  O.disc.forEach(see);O.up.forEach(see);H.players[s].hand.forEach(see);
  return u.map(x=>Math.max(0,x));
}
/* 한 사람에게 남은 차례 수 (어림): 더미 + 앞으로 섞일 카드 / 한 차례 5장 */
function turnsLeft(){
  const O=H.bn,n=Math.max(1,live().length);
  const inPlay=H.players.reduce((v,p,i)=>v+p.hand.length+O.tmp[i].length+O.fd[i].reduce((w,L)=>w+L.length,0),0)+O.up.length;
  const coins=O.coin.reduce((v,L)=>v+L.length,0),pile=Math.max(8,(TYPE.length-coins-inPlay)*.6);
  return (O.deck.length+Math.max(0,LAST_RUN-1-O.runs)*pile)/5/n;
}
/* 어려움 값: 봇끼리 대전으로 맞춤 (손패를 길게 내다볼수록 오히려 약해서 앞 2장 + 뒤 6장은 맞는 밭에 보탬만) */
const HARD={hz:2,tail:6,tw:.25,w1:.4,w0:.1,need:.1,buyTurns:5};
function brain(s){
  const lv=lvOf(s);
  if(lv>=2){const u=unseen(s),tot=Math.max(1,u.reduce((a,b)=>a+b,0)),tl=turnsLeft(),k=Math.min(tl,4)*4;return {s,lv,hz:HARD.hz,tail:HARD.tail,tw:HARD.tw,tl,reach:(t,m)=>poisAtLeast(u[t]/tot*k,m)}}
  return {s,lv,hz:3,tl:99,reach:(t,m)=>poisAtLeast(BEANS[t].c/TYPE.length*16,m)};
}
function fieldVal(B,t,n){
  if(!n)return 0;
  const cur=coinsFor(t,n),st=nextStep(t,n);
  return st?cur+(st.c-cur)*B.reach(t,st.at-n):cur;
}
/* 밭은 [콩, 장수] (빈 밭은 장수 0) */
const harvOk=(F,j)=>F[j][1]>0&&!(F[j][1]===1&&F.some((x,k)=>k!==j&&x[1]>1));
/* 임시 구역은 순서 자유: 밭에 맞는 콩 → 같은 콩이 많은 것 */
function orderNow(F,now){
  const cnt={};now.forEach(t=>{cnt[t]=(cnt[t]||0)+1});
  const on=t=>F.some(x=>x[1]&&x[0]===t)?0:1;
  return now.slice().sort((a,b)=>on(a)-on(b)||cnt[b]-cnt[a]||a-b);
}
function simVal(B,fd,now,hand){
  const F=fd.map(x=>x.slice()),seq=orderNow(F,now).concat(hand.slice(0,B.hz));let coins=0;
  for(let k=0;k<seq.length;k++){
    const t=seq[k];let f=F.findIndex(x=>x[1]&&x[0]===t);
    if(f<0)f=F.findIndex(x=>!x[1]);
    if(f<0){   // 밀려서 수확: 앞으로 들어올 같은 콩까지 셈해 덜 아픈 밭
      let bl=1e9,bc=-1;
      F.forEach((x,j)=>{if(!harvOk(F,j))return;let more=0;for(let q=k+1;q<seq.length;q++)if(seq[q]===x[0])more++;
        const c=coinsFor(x[0],x[1]),loss=fieldVal(B,x[0],x[1]+more)-c;if(loss<bl-1e-9||(loss<bl+1e-9&&c>bc)){bl=loss;bc=c;f=j}});
      coins+=coinsFor(F[f][0],F[f][1]);F[f]=[t,0];
    }
    F[f][0]=t;F[f][1]++;
  }
  const tail=B.tail?hand.slice(B.hz,B.hz+B.tail):[];
  return coins+F.reduce((v,x)=>{if(!x[1])return v;const v0=fieldVal(B,x[0],x[1]),more=tail.filter(t=>t===x[0]).length;return v+(more?v0+(fieldVal(B,x[0],x[1]+more)-v0)*B.tw:v0)},0);
}
const fdT=s=>H.bn.fd[s].map(L=>[L.length?typ(L[0]):-1,L.length]);
function nowT(s){const O=H.bn,a=O.tmp[s].map(typ);if(s===O.act&&O.ph==='trade')a.push(...O.up.map(typ));return a}
const handT=s=>H.players[s].hand.map(typ);
const dropT=(a,ts)=>{const r=a.slice();ts.forEach(t=>{const k=r.indexOf(t);if(k>=0)r.splice(k,1)});return r};
/* 바꾸면 늘어나는 값: add 임시 구역에 들어올 콩, rmUp 내줄 공개 카드 id, rmHand 내줄 손패 id */
function gainOf(B,s,add,rmUp,rmHand){
  const fd=fdT(s),now=nowT(s),hand=H.players[s].hand;
  const base=simVal(B,fd,now,hand.map(typ));
  const h2=rmHand&&rmHand.length?hand.filter(id=>!rmHand.includes(id)):hand;
  return simVal(B,fd,dropT(now,(rmUp||[]).map(typ)).concat(add||[]),h2.map(typ))-base;
}
/* 남이 얻는 값 (어림): 그 사람의 밭·임시 구역·(차례면) 공개 카드만, 손패는 모름 */
function oppGain(B,j,add,rm){
  const fd=fdT(j),now=nowT(j);
  return simVal(B,fd,dropT(now,rm||[]).concat(add),[])-simVal(B,fd,now,[]);
}
const scoreOf=j=>H.bn.coin[j].length+H.bn.fd[j].reduce((v,L)=>v+(L.length?coinsFor(typ(L[0]),L.length):0),0);
/* 어려움: 나보다 앞선 1등을 돕는 만큼 깎음 */
function wOf(B,j){
  if(B.lv<2)return 0;
  const sj=scoreOf(j),top=Math.max(...live().filter(k=>k!==B.s).map(scoreOf));
  return sj>=top&&sj>scoreOf(B.s)?HARD.w1:HARD.w0;
}
const needOf=B=>B.lv>=2?HARD.need:.02;
/* 줄 콩: 같은 콩이 여러 장이면 내주고 나서 값이 가장 좋은 카드 */
function bestPick(B,s,want,add,rmUp){
  const h=H.players[s].hand,out=[];
  for(const t of want){
    let best=-1,bv=-1e9;
    h.forEach(id=>{if(typ(id)!==t||out.includes(id))return;const v=gainOf(B,s,add,rmUp,[...out,id]);if(v>bv){bv=v;best=id}});
    if(best<0)return null;out.push(best);
  }
  return out;
}
/* 받으면 가장 좋은 콩 하나 (없으면 -1) */
function wantType(B,s){
  let best=-1,bv=.3;
  for(let t=0;t<BEANS.length;t++){const v=gainOf(B,s,[t],[],[]);if(v>bv){bv=v;best=t}}
  return best;
}
/* 제안 하나의 점수: 받을 것 getT(콩)·getUp(공개 카드 id), 줄 것 giveT(콩)·giveUp(공개 카드 id) */
function dealScore(B,s,j,getT,getUp,giveT,giveUp){
  const add=[...getT,...getUp.map(typ)],pick=bestPick(B,s,giveT,add,giveUp);if(!pick)return null;
  const my=gainOf(B,s,add,giveUp,pick);
  const th=B.lv>=2?oppGain(B,j,[...giveT,...giveUp.map(typ)],getUp.map(typ)):0;
  return {pick,my,sc:my-wOf(B,j)*th};
}
const offerScore=(B,s,x)=>dealScore(B,s,x.from,x.hand.map(typ),x.gf,x.want,x.wf);
/* 역제안: 거절한 제안에서 내 쪽 하나를 빼거나, 나에게 맞는 콩 하나를 더 받는 쪽으로. 두 사람 사이에 거래 단계마다 한 번 */
function counter(B,s,x){
  const O=H.bn,j=x.from,key=Math.min(s,j)+':'+Math.max(s,j);O.ctr=O.ctr||{};
  if(O.ctr[key]||!H.players[j]||H.players[j].finished)return;
  const getT=x.hand.map(typ),getUp=x.gf.slice(),giveT=x.want.slice(),giveUp=x.wf.slice(),C=[];
  giveT.forEach((_,k)=>C.push([getT,getUp,giveT.filter((_,q)=>q!==k),giveUp]));
  giveUp.forEach((_,k)=>C.push([getT,getUp,giveT,giveUp.filter((_,q)=>q!==k)]));
  const wt=wantType(B,s);if(wt>=0&&getT.length+1<=MAX_WANT)C.push([[...getT,wt],getUp,giveT,giveUp]);
  let best=null,bv=.15;
  for(const c of C){
    if(!c[0].length&&!c[1].length)continue;   // 받는 것이 없는 역제안은 안 함
    const gv=[...c[2],...c[3].map(typ)];if([...c[0],...c[1].map(typ)].some(t=>gv.includes(t)))continue;   // 같은 콩을 주고받는 제안은 안 함
    const r=dealScore(B,s,j,...c);if(r&&r.sc>bv){bv=r.sc;best={c,pick:r.pick}}
  }
  if(!best)return;
  O.ctr[key]=1;const [gT,gU,,vU]=best.c,iAct=s===O.act;
  offer(s,{to:j,hand:best.pick,gf:iAct?vU:[],want:gT,wf:iAct?[]:gU});
}
/* 받은 제안: 수락할 만한 것 중 가장 좋은 것, 없으면 가장 나쁜 것부터 거절(+역제안) */
function botAnswer2(B,s,t){
  const O=H.bn;
  O.of.filter(x=>forMe(x,s)&&!valid(x)).forEach(x=>refuse(x,s));
  const L=O.of.filter(x=>forMe(x,s)&&t>=x.at+LOCK_MS);if(!L.length)return false;
  const R=L.map(x=>({x,r:offerScore(B,s,x)})).sort((a,b)=>(b.r?b.r.sc:-1e9)-(a.r?a.r.sc:-1e9));
  const top=R[0];
  if(top.r&&top.r.sc>=needOf(B)&&accept(s,{id:top.x.id,pick:top.r.pick}))return true;
  const bad=R.filter(q=>!q.r||q.r.sc<needOf(B)).pop()||top;
  refuse(bad.x,s);counter(B,s,bad.x);mark();return true;
}
/* 차례인 봇: 손해인 카드(공개·손패)를 맞는 사람에게. 처음엔 원하는 콩을 같이 청하고, 거절되면 그냥 줌 */
function botActive2(B,i){
  const O=H.bn,J=[];
  const busy=id=>O.of.some(x=>x.from===i&&(x.gf.includes(id)||x.hand.includes(id)));
  O.up.forEach(id=>{if(busy(id))return;const g=gainOf(B,i,[],[id],[]);if(g>.15)J.push({id,up:1,g})});
  H.players[i].hand.forEach(id=>{if(busy(id))return;const g=gainOf(B,i,[],[],[id]);if(g>.15)J.push({id,up:0,g})});
  J.sort((a,b)=>b.g-a.g);
  const wt=J.length?wantType(B,i):-1;
  for(const c of J){
    const tt=typ(c.id),give=c.up?{gf:[c.id]}:{hand:[c.id]};
    const T=live().filter(j=>j!==i).map(j=>{const f=oppGain(B,j,[tt],[]);return {j,f,sc:c.g-wOf(B,j)*Math.max(0,f)}}).filter(q=>q.f>.05&&q.sc>.05).sort((a,b)=>b.sc-a.sc||b.f-a.f);
    for(const q of T){
      const k1=c.id+':'+q.j+':w',k0=c.id+':'+q.j;
      if(wt>=0&&wt!==tt&&!O.tried[k1]){O.tried[k1]=1;offer(i,{to:q.j,...give,want:[wt]});return true}
      if(!O.tried[k0]){O.tried[k0]=1;offer(i,{to:q.j,...give});return true}
    }
  }
  return false;
}
/* 차례가 아닌 봇: 공개 카드 청하기(대가 없이 또는 상대에게 맞는 손패로) → 차례인 사람 밭에 맞는 손해 손패 주기 → (어려움) 손패의 콩 청하기 */
function botAsk2(B,i){
  const O=H.bn,a=O.act,P=H.players;O.nask=O.nask||{};
  const lim=P[a]&&P[a].bot?(B.lv>=2?3:2):1;   // 사람에게는 한 번만
  if((O.nask[i]||0)>=lim||O.of.some(x=>x.from===i)||!P[a]||P[a].finished)return false;
  const w=wOf(B,a),C=[],hand=P[i].hand;
  const add=(o,my,th)=>{if(th>-.05&&my>.2)C.push({o,sc:my-w*Math.max(0,th),k:JSON.stringify(o)})};
  for(const u of O.up){
    if(gainOf(B,i,[typ(u)],[],[])<.3)continue;
    add({wf:[u]},gainOf(B,i,[typ(u)],[],[]),oppGain(B,a,[],[typ(u)]));
    for(const h of hand)if(typ(h)!==typ(u))add({wf:[u],hand:[h]},gainOf(B,i,[typ(u)],[],[h]),oppGain(B,a,[typ(h)],[typ(u)]));
  }
  for(const h of hand){const g=gainOf(B,i,[],[],[h]),f=oppGain(B,a,[typ(h)],[]);if(f>.05)add({hand:[h]},g,f)}
  if(B.lv>=2){const wt=wantType(B,i);if(wt>=0)for(const h of hand){if(typ(h)===wt)continue;const f=oppGain(B,a,[typ(h)],[]);if(f>.05)add({hand:[h],want:[wt]},gainOf(B,i,[wt],[],[h])*.6,f)}}
  C.sort((x,y)=>y.sc-x.sc);
  const c=C.find(q=>!O.tried['a'+i+q.k]);if(!c)return false;
  O.tried['a'+i+c.k]=1;O.nask[i]=(O.nask[i]||0)+1;offer(i,{to:a,...c.o});return true;
}
function botTrade2(i,t){
  const O=H.bn,P=H.players,B=brain(i);
  O.of=O.of.filter(x=>{if(x.from!==i||t<x.at+7000)return true;[...x.gf,...x.hand].forEach(id=>{O.tried[id+':'+x.to]=1});return false});   // 답이 없으면 그 사람에게는 그 카드를 다시 내밀지 않음
  if(botAnswer2(B,i,t)){wake(i,700,1300);return}
  wake(i,900,1600);
  if(i!==O.act){botAsk2(B,i);return}
  if(botActive2(B,i))return;
  const wait=O.of.some(x=>forMe(x,i)||(x.from===i&&(x.to<0||!P[x.to].bot||t<x.at+3000)));   // 사람에게 보낸 제안은 7초까지 기다림
  if(t>=O.botEnd&&!wait)endTrade();
}
/* 카드 하나를 심을 밭: 맞는 밭, 아니면 빈 밭·수확할 밭 중 남은 계획의 값이 가장 큰 곳 (빈 밭이 있어도 다 찬 밭을 수확할 수 있음) */
function spotFor(B,s,t,restNow,restHand){
  const fd=fdT(s);
  let f=fd.findIndex(x=>x[1]&&x[0]===t);
  if(f>=0){const F=fd.map(y=>y.slice());F[f][1]++;return {f,v:simVal(B,F,restNow,restHand),h:false}}
  let best=null;
  fd.forEach((x,j)=>{
    if(x[1]&&!harvOk(fd,j))return;
    const F=fd.map(y=>y.slice());F[j]=[t,1];
    const v=(x[1]?coinsFor(x[0],x[1]):0)+simVal(B,F,restNow,restHand)-(x[1]?0:.01);
    if(!best||v>best.v)best={f:j,v,h:x[1]>0};
  });
  return best;
}
function plantAt(s,r){if(r.h)harvest(s,r.f);return r.f}
/* 세 번째 밭: 어려움만, 남은 차례가 넉넉할 때 (봇끼리 대전에서 일찍 무작정 사면 오히려 손해였음) */
function maybeBuy(B,s){
  const O=H.bn;
  if(B.lv<2||!+H.cfg.buy3||H.players.length<=3||O.fd[s].length>=3||O.coin[s].length<FIELD3)return;
  if(B.tl>=HARD.buyTurns)G.engine.act(s,{t:'buy'});
}
function botP1v(s){
  const O=H.bn,p=H.players[s],B=brain(s);
  if(O.pl===0){
    maybeBuy(B,s);
    plantHand(s,plantAt(s,spotFor(B,s,typ(p.hand[0]),[],handT(s).slice(1))));wake(s,600,1100);return;
  }
  /* 둘째 장: 맞는 밭이면 심고, 빈 밭은 공개 카드 자리로 남김(빈 밭이 둘 이상이면 심음), 수확이 필요하면 안 심음 */
  const t=typ(p.hand[0]),fd=fdT(s);
  if(fd.some(x=>x[1]&&x[0]===t)||fd.filter(x=>!x[1]).length>=2)plantHand(s,plantAt(s,spotFor(B,s,t,[],handT(s).slice(1))));
  else beginTrade();
}
/* 임시 구역: 맞는 밭에 들어가는 카드부터, 아니면 콩마다 심어 보고 남은 계획의 값이 가장 큰 것 */
function botP3v(i){
  const O=H.bn,L=O.tmp[i],B=brain(i),now=L.map(typ),hand=handT(i);
  let best=null;
  for(const t of [...new Set(now)]){const r=spotFor(B,i,t,dropT(now,[t]),hand);if(r&&(!best||r.v>best.r.v))best={t,r}}
  const id=L.find(v=>typ(v)===best.t);plantTmp(i,id,plantAt(i,best.r));
}
G._test={BEANS,TYPE,coinsFor,nextStep,canHarvest,LOCK_MS,turnMs,tradeMs,HARD,simVal,brain,gainOf,offerScore,unseen,turnsLeft,botP1v,botP3v,lvOf};
/* 카드 나누기 뒤 주사위 시간: 공통 dealExtra (방장이 시간·봇을 멈춤) */
G.dealExtra=()=>H.bn?Math.round(DICE_LEAD+DicePick.totalFor(H.bn.rolls)+DICE_REST):0;
G.engine={
  start(){
    Object.assign(H,{phase:'play',log:[],seatNote:{},field:[],last:null,reveal:null,shouts:[],pending:null,rankNext:1,rankBottom:H.players.length,known:{},turn:0,botActAt:0,deadline:0});
    const n=H.players.length,deck=shuffle(TYPE.map((_,i)=>i));
    H.players.forEach(p=>{p.finished=false;p.rank=null;p.surrendered=false;p.hand=deck.splice(0,HAND0)});
    const first=firstSeat(n),nf=n===3?3:2;
    H.bn={gn:((H.bn&&H.bn.gn)||0)+1,rolls:+H.cfg.pickfirst?-1:DicePick.pickRolls(n),ph:'p1',act:first,first,pl:0,deck,disc:[],up:[],of:[],oid:0,ts:0,hs:0,runs:0,last:0,t0:0,botEnd:0,tried:{},asked:{},
      fd:H.players.map(()=>Array.from({length:nf},()=>[])),tmp:H.players.map(()=>[]),coin:H.players.map(()=>[]),bt:H.players.map(()=>0)};
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
    if(a.t==='reject'){const x=O.of.find(q=>q.id===a.id);if(x&&forMe(x,s)){refuse(x,s);mark()}return}
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
        else if(realBot(p)&&t>=O.bt[i]&&lvOf(i)>0){botP3v(i);wake(i,400,800);ch=true}
        else if(realBot(p)&&t>=O.bt[i]){const id=O.tmp[i].slice().sort((a,b)=>fit(i,typ(b))-fit(i,typ(a)))[0];plantTmp(i,id,autoField(i,id));wake(i,400,800);ch=true}
      });
      if(ch)checkP3();
    }
  },
  snap(s,you,t){
    const O=H.bn,seat=you>=0&&you<H.players.length;
    /* 제안은 당사자에게만. 받는 쪽에는 콩 종류만: 손패 카드 id·위치는 제안자에게만 */
    const of=O.of.filter(x=>x.from===you||(seat&&forMe(x,you))).map(x=>{
      const o={id:x.id,f:x.from,to:x.to,g:[...x.hand,...x.gf].map(typ).sort(),gf:x.gf.slice(),w:x.want.slice().sort(),wf:x.wf.slice(),lk:Math.max(0,x.at+LOCK_MS-t)};
      if(x.from===you)o.mh=x.hand.slice();return o});
    s.o={gn:O.gn,ph:O.ph,act:O.act,first:O.first,pl:O.pl,fd:O.fd.map(a=>a.map(L=>L.slice())),tmp:O.tmp.map(L=>L.slice()),cn:O.coin.map(L=>L.length),up:O.up.slice(),
      dk:O.deck.length,ds:O.disc.length,dt:O.disc.length?O.disc[O.disc.length-1]:-1,runs:Math.min(LAST_RUN,O.runs+1),ts:O.ts,hs:O.hs,of,dl:H.deadline?Math.max(0,H.deadline-t):0};
    s.ps.forEach((p,i)=>{p.cn=O.coin[i].length});
    s.gr=0;s.dl=s.o.dl;
    if(H.dealUntil>t){s.o.act=-1;s.o.dice={rolls:O.rolls,first:O.first,seed:H.dealId||1};delete s.t}   // 주사위가 멈출 때까지 첫 차례를 보이지 않음
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
let elBox=null,elZoom=null,elSt=null,elPan=null,el2d=null,lastPan='',last2d='',tmpSel=-1,arm=-1,armAt=0;
const C={open:false,to:-1,box:'',gf:[],want:[],wf:[]};   // 쓰고 있는 제안 (줄 손패는 공통 sel)
const lockAt=new Map();   // 제안 id → 수락할 수 있는 시각
const currentG=()=>typeof GAMES!=='undefined'&&V&&V.cfg&&GAMES[V.cfg.game]?GAMES[V.cfg.game]:null;
const iSeat=()=>{const i=myIdx();return i>=0&&V&&V.ps&&i<V.ps.length&&!V.ps[i].f};
const inPlay=()=>!!(V&&V.o&&V.st==='play'&&iSeat()&&!dealingV());
const inTrade=()=>inPlay()&&V.o.ph==='trade';
const isAct=()=>inPlay()&&V.o.act===myIdx();
const clearC=()=>{C.to=-1;C.box='';C.gf=[];C.want=[];C.wf=[]};
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
  if(to===myIdx()||(!hand.length&&!C.gf.length&&!C.want.length&&!C.wf.length)){sfx('no');return}
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
  [...hand.children].forEach((el,k)=>{el.classList.toggle('sel',sel.has(+el.dataset.id));el.classList.toggle('bn-f1',k===0)});
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
  diceStart();
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
  setBottom();
  if(was!==pb.hidden+':'+ps.hidden)requestAnimationFrame(layoutFan);   // 버튼 수가 바뀌면 손패 자리를 다시 맞춤
};
/* 손패를 꾹 누르면 큰 2D 카드 (바깥을 누르면 닫힘) */
const LP={timer:0,x:0,y:0,fired:false};
function zoomOpen(id){
  const t=typ(id),b=BEANS[t],rows=b.m.map((n,k)=>n?`<li><span>${n}장</span><b>${'<i class="bn-co"></i>'.repeat(k+1)}</b></li>`:'').join('');
  elZoom.innerHTML=`<div class="bn-zc" style="--rc:${b.col};--tc:${b.tx||'#fffcf5'}"><div class="bn-zn">${b.n}</div><div class="bn-zb">${beanImg(t)}</div><ul>${rows}</ul><p>${b.c}장</p></div>`;
  elZoom.hidden=false;sfx('tick');
}
function zoomClose(){if(elZoom&&!elZoom.hidden){elZoom.hidden=true;elZoom.innerHTML=''}}
const lpStop=()=>{clearTimeout(LP.timer);LP.timer=0};
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
const R_F=2.6,R_B=3.56,R_T=1.62,FW=.8,CS=.8,TS=.62,PX=.42,PZ=-.62,UZ=.42,MAX_COIN=24,R_ARC=4.36,ARC=1.1;
const CW=.62*1.2*CS,CH=.9*1.2*CS;   // 밭 카드 크기 (공통 카드 .62×.9 × T.cardK 1.2 × CS)
const M={on:false,built:false,fail:false,root:null,cards:new Map(),where:new Map(),seats:[],deck:null,labels:[],info:null,ray:null,gn:0,raf:0,hb:null,vp:null};
const posOf=(i,r,t,y)=>{const a=seatAngle(i),s=Math.sin(a),c=Math.cos(a);return new THREE.Vector3(s*r+c*t,y||0,c*r-s*t)};
const fw=i=>i===myIdx()?FW:FW+.24;   // 상대 밭은 조금 넓게: 내 화면 기준 카드 아래 표가 옆 밭 카드에 얹히지 않게
const fieldTan=(f,nf,i)=>(f-(nf-1)/2)*fw(i);
const coinTan=(nf,i)=>-(nf/2)*fw(i)-.34;
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
const coinBase=(i,nf)=>i===myIdx()?{r:R_B+.42,t:-.15}:{r:R_F-.3,t:coinTan(nf,i)};
/* 내 화면 기준 물건 바로 아래 (탁자 z가 클수록 화면 아래) */
function coinLabelAt(i,nf,n){const a=coinAt(i,nf,0),b=coinAt(i,nf,5*Math.max(0,Math.ceil(n/5)-1));return new THREE.Vector3((a.x+b.x)/2,.03,Math.max(a.z,b.z)+.24)}
function fieldLabelAt(i,tan,k){const a=seatAngle(i),c=.05*Math.min(Math.max(0,k-1),9),p=posOf(i,R_F+c/2,tan,.03);p.z+=Math.abs(Math.cos(a))*(CH+c)/2+Math.abs(Math.sin(a))*CW/2+.13;return p}
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
    M.arcM=new THREE.MeshBasicMaterial({color:0xffc83a,transparent:true,opacity:.8,depthWrite:false,side:THREE.DoubleSide});
    for(let i=0;i<5;i++){const o=new THREE.Mesh(new THREE.RingGeometry(R_ARC,R_ARC+.16,64,1,-Math.PI/2-ARC/2,ARC),M.arcM);o.position.y=.024;o.visible=false;o.rotation.order='YXZ';o.rotation.x=-Math.PI/2;root.add(o);M.seats[i].arc=o}
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
    S.arc.visible=on&&v.st==='play'&&(o.ph==='p3'?o.tmp[i].length>0:o.act===i);if(on)S.arc.rotation.y=seatAngle(i);
    if(!on){S.coins.forEach(c=>{c.visible=false});return}
    const a=seatAngle(i),F=o.fd[i],nf=F.length;
    {if(S.to!==o.cn[i]){const up=o.cn[i]>S.to;S.to=o.cn[i];S.at=clock()+(up?420:0)}setLabel(S.lb,coinLabelAt(i,nf,S.to),`${COIN}${S.shown}`)}
    S.coins.forEach((c,k)=>{c.position.copy(coinAt(i,nf,k))});
    F.forEach((L,f)=>{
      const tan=fieldTan(f,nf,i),sl=S.slots[f];
      sl.position.copy(posOf(i,R_F,tan,.022));sl.rotation.set(-Math.PI/2,0,a);sl.visible=true;
      sl.material=i===me&&target>=0&&accepts(L,target)?M.sH:M.sN;
      L.forEach((id,c)=>{const q=Math.min(c,9),p=posOf(i,R_F+q*.05,tan,.03+c*.006);seen.add(id);where.set(id,i);placeCard(id,p,-Math.PI/2,a,CS,handFrom(i))});
      const b=badgeOf(i,f);
      if(b){setLabel(S.badges[f],fieldLabelAt(i,tan,L.length),badgeHTML(b));S.badges[f].classList.toggle('arm',!!b.arm)}
    });
    if(+v.cfg.buy3&&n>3&&nf<3&&i===me&&v.st==='play'){const sl=S.slots[2];sl.position.copy(posOf(i,R_F,fieldTan(nf,nf,i)+.05,.022));sl.rotation.set(-Math.PI/2,0,a);sl.visible=true;sl.material=o.cn[i]>=FIELD3?M.sH:M.sN}
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
  if(!deal&&o.act>=0)setLabel(M.info,new THREE.Vector3(0,.03,PZ-.5),`더미 ${o.dk} · ${o.runs}/3회`);
};
/* 매 프레임: 표를 3D 자리로, 코인을 카드가 닿은 뒤에 (시작 시각과의 차이로), 펠트는 이 게임 동안 숨김 */
const FELT_MS=650;
function feltK(k){
  if(!T.felt)return;
  const m=T.felt.mat,i=T.felt.ink,a=Math.max(.001,k);m.visible=k>.002;m.scale.set(a,1,a);if(i){i.visible=k>.002;i.scale.set(a,a,1)}
}
/* 펠트는 가운데 점으로 줄어들며 사라지고, 게임을 떠나면 다시 펼쳐짐 (시작 시각과의 차이로) */
const FL={t0:-1e9,to:1};
function feltGo(to){FL.t0=clock();FL.to=to;if(!FL.raf)FL.raf=requestAnimationFrame(feltStep)}
function feltStep(){
  FL.raf=0;
  const e=Math.min(1,(clock()-FL.t0)/FELT_MS),q=e*e*(3-2*e);
  feltK(FL.to?q:1-q);
  if(e<1)FL.raf=requestAnimationFrame(feltStep);
}
function feltNow(){if(FL.raf){cancelAnimationFrame(FL.raf);FL.raf=0}FL.to=1;feltK(1)}
/* 첫 차례 주사위: 카드를 나눈 뒤. 결과는 방장이 정하고 모두 같은 굴림을 재생 */
const DC={gn:0,fp:null,die:null,said:false,end:0};
function diceStart(){
  const o=V&&V.o;if(!o||!o.dice||!V.dk||DC.gn===o.gn)return;
  DC.gn=o.gn;DC.said=false;
  const t0=V.dealAt-DICE_REST-DicePick.totalFor(o.dice.rolls);
  DC.end=V.dealAt;DC.fp=firstPick(t0,{seats:V.ps.map((_,i)=>i),first:o.dice.first,rolls:o.dice.rolls,seed:o.dice.seed});
}
function diceEnd(){if(DC.die){M.root.remove(DC.die.g);DC.die.dispose();DC.die=null}DC.fp=null}
function diceFrame(now){
  const fp=DC.fp;if(!fp)return;
  if(now>=DC.end){diceEnd();return}
  if(now<fp.t0)return;
  if(M.on&&!fp.fixed){
    if(!DC.die){DC.die=DicePick.mesh(THREE,V.ps.length,V.ps.map((_,i)=>DicePick.SEAT_COL[i%8]));M.root.add(DC.die.g)}
    DC.die.apply(fp.pose(now),.55,0,.02,0);
  }
  if(fp.tick(now)&&!DC.said){DC.said=true;fxSay(fp.msg(),DicePick.SEAT_COL[fp.first%8])}
}
function step(){
  M.raf=0;if(!M.on||!V||!V.o)return;
  M.raf=requestAnimationFrame(step);
  M.arcM.opacity=.62+.3*Math.sin(clock()/320);
  const now=clock(),r=$('#cv').getBoundingClientRect(),st=$('#stage').getBoundingClientRect(),v=M.hb;
  for(const el of M.labels){
    if(el.hidden||!el._p)continue;
    v.copy(el._p).project(T.cam);
    const x=Math.round(r.left-st.left+(v.x+1)/2*r.width),y=Math.round(r.top-st.top+(1-v.y)/2*r.height),k=x+','+y;
    if(el._k!==k){el._k=k;el.style.transform=`translate(${x}px,${y}px) translate(-50%,-50%)`}
  }
  diceFrame(now);
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
  for(let f=0;f<nf;f++){const p=posOf(me,R_F+.2,fieldTan(f,nf,me));if(Math.abs(P.x-p.x)<.4&&Math.abs(P.z-p.z)<.75){tapField(f);return}}
  if(+V.cfg.buy3&&V.ps.length>3&&nf<3){const p=posOf(me,R_F,fieldTan(nf,nf,me)+.05);if(Math.abs(P.x-p.x)<.4&&Math.abs(P.z-p.z)<.6){if(o.cn[me]>=FIELD3)sendAct({t:'buy'});else sfx('no');return}}
  if(open){C.open=false;refresh()}   // 빈 곳을 누르면 거래 창을 닫음
}

/* ---------- 2D 칸: 단계·거래 (3D 위) + WebGL이 없을 때의 밭 ---------- */
const chip=(t,n)=>`<span class="bn-chip" style="--c:${BEANS[t].col};--tc:${BEANS[t].tx||'#fff'}">${BEANS[t].n}${n>1?'×'+n:''}</span>`;
function chips(L){const m=new Map();for(const t of L)m.set(t,(m.get(t)||0)+1);return m.size?[...m].map(([t,n])=>chip(t,n)).join(''):'<span class="bn-none"></span>'}
/* 이름 옆의 콩 = 그 사람이 내놓는 콩. 왼쪽은 언제나 나 */
const swapLine=(other,give,get)=>`<span class="bn-sw"><b class="bn-w">나</b>${chips(give)}</span><span class="bn-ar">⇄</span><span class="bn-sw"><b class="bn-w">${esc(other)}</b>${chips(get)}</span>`;
const whoTurn=o=>{const p=V.ps[o.act];if(!p)return '';if(o.act===myIdx())return '내 턴';const n=[...p.n];return `${n.length>6?n.slice(0,6).join('')+'…':p.n} 턴`};
const phText=o=>{
  if(o.ph==='p3')return '모두 심기';
  if(o.act<0)return '';
  return o.ph==='p1'?`${whoTurn(o)} · 심기 ${Math.min(2,o.pl+1)}/2`:o.ph==='trade'?`${whoTurn(o)} · 거래`:'';
};
/* 박스 안 칩: 누르면 한 장씩 빠짐 */
function rmChips(k,L){
  const m=new Map();for(const t of L)m.set(t,(m.get(t)||0)+1);
  return m.size?[...m].map(([t,n])=>`<button type="button" class="bn-pick" data-rm="${k}:${t}">${chip(t,n)}</button>`).join(''):'<span class="bn-none"></span>';
}
const freeUp=t=>isAct()?V.o.up.find(id=>typ(id)===t&&!C.gf.includes(id)):undefined;
function freeHand(t){const h=myHand();for(let j=h.length-1;j>=0;j--)if(typ(h[j])===t&&!sel.has(h[j]))return h[j]}
const canGive=t=>freeUp(t)!=null||freeHand(t)!=null;
function tapBean(t){
  if(C.box==='you'){if(C.want.length<MAX_WANT){C.want.push(t);sfx('pick');drawPan()}else sfx('no');return}
  const u=freeUp(t);   // 공개 카드는 안 가져가면 내가 심어야 하므로 먼저
  if(u!=null){C.gf.push(u);sfx('pick');refresh();return}
  const c=freeHand(t);if(c==null){sfx('no');return}
  sel.add(c);sfx('pick');renderMe();
}
function rmChip(k,t){
  if(k==='me'){
    const h=[...sel].filter(id=>typ(id)===t);
    if(h.length)sel.delete(h[h.length-1]);else{const j=C.gf.findIndex(id=>typ(id)===t);if(j>=0)C.gf.splice(j,1)}
  }else{
    const j=C.want.lastIndexOf(t);if(j>=0)C.want.splice(j,1);else{const q=C.wf.findIndex(id=>typ(id)===t);if(q>=0)C.wf.splice(q,1)}
  }
  sfx('pick');C.box=k;renderMe();refresh();
}
function nextWho(){
  const P=V.ps,me=myIdx(),L=[-1,...P.map((p,i)=>i).filter(i=>i!==me&&!P[i].f)];
  C.to=L[(L.indexOf(C.to)+1)%L.length];sfx('pick');drawPan();
}
function drawPan(){
  if(!elPan||!V||!V.o)return;
  const o=V.o,me=myIdx(),tr=inTrade();
  if(!tr){if(lastPan){elPan.innerHTML='';lastPan=''}return}
  const P=V.ps,H2=[...sel].filter(id=>myHand().includes(id)),act=isAct();
  const ofHTML=o.of.map(x=>{
    const mine=x.f===me,other=mine?x.to:x.f,oname=other<0?'아무나':P[other].n,wants=[...x.w,...x.wf.map(typ)],get=mine?wants:x.g,give=mine?x.g:wants;
    const can=mine||!!pickFor(x);
    return `<div class="bn-of" data-o="${x.id}"><div class="bn-line">${swapLine(oname,give,get)}</div><span class="bn-sp"></span>${mine?`<button type="button" data-k="cancel" data-o="${x.id}">취소</button>`:`<button type="button" class="bn-ok" data-k="accept" data-o="${x.id}"${can?'':' disabled'}>수락</button><button type="button" data-k="counter" data-o="${x.id}">역제안</button><button type="button" data-k="reject" data-o="${x.id}">거절</button>`}</div>`}).join('');
  let comp='';
  if(C.open){
    const who=act?(C.to<0?'아무나':P[C.to].n):P[o.act].n;
    const box=(k,name,L,nameBtn)=>`<div class="bn-cell${C.box===k?' on':''}" data-b="${k}">${nameBtn}<span class="bn-sw">${rmChips(k,L)}</span></div>`;
    const grid=C.box?`<div class="bn-g">${BEANS.map((b,t)=>{const no=C.box==='me'&&!canGive(t);return `<button type="button" class="bn-bean${no?' no':''}" data-w="${t}" aria-label="${b.n}">${beanImg(t)}<span>${b.n}</span></button>`}).join('')}</div>`:'';
    comp=`<div class="bn-tr"><div class="bn-r bn-line">${box('me','나',[...H2.map(typ),...C.gf.map(typ)],'<b class="bn-w">나</b>')}<span class="bn-ar">⇄</span>${box('you',who,[...C.want,...C.wf.map(typ)],act?`<button type="button" class="bn-who" data-k="who">${esc(who)}</button>`:`<b class="bn-w">${esc(who)}</b>`)}<button type="button" class="bn-ok bn-send" data-k="send">제안</button></div>${grid}</div>`;
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
function setBottom(){
  if(!elPan)return;
  const st=$('#stage').getBoundingClientRect(),H1=[...$('#hand').children];
  let y=H1.length?Math.min(...H1.map(x=>x.getBoundingClientRect().top))-20:st.bottom-96;   // 20: 다음 심기 표시
  if(st.width<700)for(const b of [$('#btnPlay'),$('#btnPass')])if(!b.hidden)y=Math.min(y,b.getBoundingClientRect().top);
  elPan.style.setProperty('--bnb',Math.max(96,Math.round(st.bottom-y+6))+'px');
}
/* 왼쪽(맨 앞) 카드가 위로 */
G.afterFan=()=>{const L=[...$('#hand').children];L.forEach((c,i)=>{c.style.zIndex=L.length-i});setBottom()};
G.hud=inGame=>{
  if(!elBox)return;
  const on=!!(inGame&&V&&V.o);
  elBox.hidden=!on;
  const d3=on&&build();
  if(d3!==M.on){M.on=d3;if(M.root)M.root.visible=d3;$('#stage').classList.toggle('bn3d',d3);if(d3){feltGo(0);if(!M.raf)M.raf=requestAnimationFrame(step)}else{feltGo(1);clearCards();diceEnd()}}
  if(M.lbBox)M.lbBox.hidden=!d3;
  $('#stage').classList.toggle('bng',on);
  $('#stage').classList.toggle('bn2d',on&&!d3);
  if(!on)return;
  drawPan();draw2d();setBottom();
};
G.live=()=>{
  if(!elSt||!V||!V.o)return;
  const o=V.o,t=phText(o),sec=V.st==='play'&&!dealingV()?Math.ceil(Math.max(0,(V.deadAt-clock())/1000)):0,txt=t&&sec?`${t} · ${sec}`:t;
  if(elSt.textContent!==txt)elSt.textContent=txt;
  elSt.classList.toggle('my',V.st==='play'&&myIdx()>=0&&V.t===myIdx());
  lockTick();
  if(!M.on)diceFrame(clock());
  if(arm>=0&&clock()-armAt>3000){arm=-1;refresh()}
};
G.overRank=p=>{const t=p.sr===3?'탈주':p.sr?'항복':`${+p.cn||0}코인`;return `<span class="left">${t}</span>`};
G.enter=()=>{$('#btnGura').hidden=true};
G.leave=()=>{
  zoomClose();lpStop();clearCards();M.gn=0;clearC();C.open=false;tmpSel=-1;arm=-1;lockAt.clear();lastPan='';last2d='';
  if(elBox)elBox.hidden=true;if(elPan)elPan.innerHTML='';if(el2d)el2d.innerHTML='';
  if(M.root)M.root.visible=false;M.on=false;feltNow();diceEnd();DC.gn=0;if(M.lbBox)M.lbBox.hidden=true;
  $('#stage').classList.remove('bng','bn3d','bn2d');
  $('#btnPlay').hidden=false;$('#btnPlay').disabled=false;
  $('#btnPass').hidden=false;$('#btnPass').disabled=false;$('#btnPass').firstChild.nodeValue='패스';
};
/* 대기실 홀로그램의 대표 말: 강낭콩 카드와 거기서 튀어나온 강낭콩 (공통 frontHoloPiece가 재질 만드는 함수를 줌) */
G.holoPiece=mkM=>{
  const g=new THREE.Group(),KID=BEANS.findIndex(b=>b.n==='강낭콩'),id=TYPE.indexOf(KID);
  const c=holoCard(mkM,holoFace(G,id));c.position.set(-.06,-.04,0);c.rotation.z=.08;g.add(c);
  const geo=new THREE.SphereGeometry(.1,24,16),P=geo.attributes.position;   // 콩팥 모양: 길쭉한 알을 휘고 안쪽 가운데를 오목하게
  for(let k=0;k<P.count;k++){let x=P.getX(k)*1.55,y=P.getY(k)*.95,z=P.getZ(k)*.8;if(y>0)y*=1-.5*Math.exp(-x*x/.004);y+=1.6*x*x;P.setXYZ(k,x,y,z)}
  geo.computeVertexNormals();
  const b=new THREE.Mesh(geo,mkM(new THREE.Color(BEANS[KID].col).getHex()));b.rotation.z=.3;b.position.set(.2,.08,.1);g.add(b);
  return g;
};
G.init=()=>{
  const css=document.createElement('style');
  css.textContent=`
.bn-box{position:absolute;inset:0;pointer-events:none;z-index:7}
.bn-box[hidden]{display:none}
.bn-st{position:absolute;top:8px;left:50%;transform:translateX(-50%);padding:3px 12px;border-radius:999px;background:rgba(47,32,22,.78);color:#fff6e4;font:600 13px "Jua","IBM Plex Mono",sans-serif;white-space:nowrap}
.bn-st:empty{visibility:hidden}
.bn-pan{position:absolute;left:50%;transform:translateX(-50%);bottom:var(--bnb,150px);width:min(460px,calc(100% - 16px));max-height:calc(100% - var(--bnb,150px) - 44px);overflow:auto;display:flex;flex-direction:column;gap:4px}
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
.bn-sw{display:inline-flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:3px}
.bn-w{max-width:5.5em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bn-ar{font-weight:700;color:#7a6650}
.bn-line{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px;min-height:30px;padding:3px;border-radius:8px;background:rgba(59,42,31,.07)}
.bn-cell{display:flex;align-items:center;gap:4px;padding:4px 6px;border-radius:8px;border:2px solid transparent;cursor:pointer;min-height:26px}
.bn-cell.on{border-color:#e0a020;background:rgba(224,160,32,.14)}
.bn-box button.bn-who{padding:1px 7px;font-weight:700;background:rgba(59,42,31,.1);border-color:transparent}
.bn-bean{position:relative}
.bn-box button.bn-bean.no .bn-bi,.bn-box button.bn-bean.no span{opacity:.3}
.bn-box button.bn-bean.no::after{content:'✕';position:absolute;left:0;right:0;top:0;text-align:center;color:#c0392b;font:700 19px sans-serif}
.bn-box button.bn-send{margin-left:auto}
.bn-box button.bn-bean{display:flex;flex-direction:column;align-items:center;gap:0;padding:3px 0 2px;border:none;background:none;min-width:0}
.bn-box button.bn-bean:active{background:rgba(59,42,31,.1)}
.bn-bean .bn-bi{width:34px}
.bn-bean span{font-size:10px;line-height:1.2;color:#3b2a1f;white-space:nowrap}
.bn-r{display:flex;flex-wrap:wrap;align-items:center;gap:4px;min-height:24px}
.bn-g{display:grid;grid-template-columns:repeat(8,1fr);gap:1px}
.bn-sp{flex:1}
.bn-l{font-size:11.5px;color:#7a6650}
.bn-none{display:inline-block;width:46px;height:19px;border:1.5px dashed #b6a58f;border-radius:7px;box-sizing:border-box}
.bn-chip{display:inline-block;padding:1px 6px;border-radius:8px;background:var(--c);color:var(--tc,#fff);font-size:12px;font-weight:600;white-space:nowrap}
.bn-box button{font:inherit;font-size:12.5px;padding:3px 8px;border-radius:8px;border:1px solid var(--line-strong);background:#fff;color:#3b2a1f;cursor:pointer}
.bn-box button:disabled{opacity:.45}
.bn-box button.lk{opacity:.5}
.bn-box .bn-ok{background:#2e7d4f;border-color:#2e7d4f;color:#fff}
.bn-box .bn-to.on,.bn-box .bn-pick.on{outline:2px solid #e0a020}
.bn-box .bn-pick{padding:1px;background:none;border:none;line-height:1.3}
@media(max-width:699px){.stage.bng #actions{transform:translateY(40px)}.stage.bng #actions{justify-content:space-between}.stage.bng #actions button{flex:0 0 37%;min-width:0;min-height:0;height:36px;padding:0 6px;font-size:15px}.stage.bng #actions button small{display:none}}
.stage.bng #dim{display:none}
.bn-st.my{background:#e8ad24;color:#3b2a1f}
.bn-zoom{position:absolute;inset:0;z-index:30;display:flex;align-items:center;justify-content:center;background:rgba(28,18,10,.35);pointer-events:auto}
.bn-zoom[hidden]{display:none}
.bn-zc{width:min(230px,62vw);border-radius:16px;overflow:hidden;background:#fffcf5;border:2px solid #3b2a1f;color:#3b2a1f;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.4)}
.bn-zn{padding:8px 0;background:var(--rc);color:var(--tc,#fffcf5);font:600 22px "Jua",sans-serif}
.bn-zb{padding:12px 30px 4px}
.bn-zc ul{list-style:none;margin:6px 16px;padding:0}
.bn-zc li{display:flex;justify-content:space-between;align-items:center;padding:3px 4px;border-bottom:1px solid #e3d4bb;font:600 15px "IBM Plex Mono",monospace}
.bn-zc li b{display:flex;gap:2px;font-size:15px}
.bn-zc p{margin:4px 0 8px;font-size:12px;color:#7a6650}
.stage.bng .card.bn-c.bn-f1{outline:3px solid #2e9d5f;outline-offset:-1px}
.stage.bng .card.bn-c.bn-f1::before{content:attr(data-nx);position:absolute;left:50%;top:-21px;transform:translateX(-50%);color:#1f8a4c;font:700 12px "Jua",sans-serif;white-space:nowrap;pointer-events:none;text-shadow:0 0 3px #fff8e8,0 0 3px #fff8e8}
.stage.bng .card.bn-c .bn-nm{position:absolute;left:0;right:0;top:0;padding:2px 0;background:var(--rc);color:var(--tc,#fffcf5);font:600 11px "Jua",sans-serif;text-align:center;white-space:nowrap;border-radius:6px 6px 0 0}
.stage.bng .card.bn-c .bn-be{position:absolute;left:7px;right:7px;top:27px;pointer-events:none}
.bn-bi{display:block;width:100%;pointer-events:none;-webkit-user-drag:none}
.stage.bng .card.bn-c .bn-mt{position:absolute;left:0;right:0;bottom:4px;text-align:center;font:600 10px "IBM Plex Mono",monospace;color:#3b2a1f}
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
  elZoom=document.createElement('div');elZoom.className='bn-zoom';elZoom.hidden=true;$('#stage').appendChild(elZoom);
  elZoom.addEventListener('pointerdown',e=>{if(!e.target.closest('.bn-zc'))zoomClose()});
  const hd=$('#hand');
  hd.addEventListener('pointerdown',e=>{
    if(currentG()!==G||e.button)return;const c=e.target.closest('.card');if(!c)return;
    LP.x=e.clientX;LP.y=e.clientY;LP.fired=false;lpStop();LP.timer=setTimeout(()=>{LP.timer=0;LP.fired=true;zoomOpen(+c.dataset.id)},350);
  });
  hd.addEventListener('pointermove',e=>{if(LP.timer&&Math.hypot(e.clientX-LP.x,e.clientY-LP.y)>10)lpStop()});
  for(const k of ['pointerup','pointercancel','lostpointercapture'])hd.addEventListener(k,lpStop);
  hd.addEventListener('click',e=>{if(currentG()===G&&LP.fired){LP.fired=false;e.stopPropagation();e.preventDefault()}},true);   // 크게 본 뒤 손을 뗀 것은 고르기가 아님
  elBox.addEventListener('click',e=>{
    if(!V||!V.o)return;
    const b=e.target.closest('button');
    if(!b){const c=e.target.closest('[data-b]');if(c){C.box=C.box===c.dataset.b?'':c.dataset.b;sfx('pick');drawPan()}return}
    const d=b.dataset,k=d.k,id=+d.o;
    if(d.f!=null)tapField(+d.f);
    else if(d.t!=null)tapTemp(+d.t);
    else if(d.u!=null)tapUp(+d.u);
    else if(d.rm!=null){const [q,t]=d.rm.split(':');rmChip(q,+t)}
    else if(d.w!=null)tapBean(+d.w);
    else if(k==='who')nextWho();
    else if(k==='send')sendOffer();
    else if(k==='accept')acceptOf(id);
    else if(k==='reject')sendAct({t:'reject',id});
    else if(k==='cancel')sendAct({t:'cancel',id});
    else if(k==='counter')counterOf(id);
    else if(k==='buy')sendAct({t:'buy'});
  });
};
/* ===== 번역 (English·日本語) =====
   화면 문구는 한국어로 쓰고 여기에 [영어, 일본어]를 한 줄로 같이 더함(docs/i18n.md). 키는 화면에 나오는 글자 그대로(앞뒤 빈칸 없이), 바뀌는 값은 {0}·{1}.
   게임 방법은 rulesHTML을 통째로. 공통 사전(lang/*.js)에 있는 말은 넣지 않음 */
G.i18n=i18nGame({
'완두콩':['Pea','エンドウ豆'],
'메주콩':['Soybean','大豆'],
'검은콩':['Black bean','黒豆'],
'강낭콩':['Kidney bean','インゲン豆'],
'렌즈콩':['Lentil','レンズ豆'],
'병아리콩':['Chickpea','ひよこ豆'],
'팥':['Red bean','小豆'],
'작두콩':['Sword bean','なた豆'],
'콩을 심고 거래하기':['Plant and trade beans','豆を植えて取引する'],
'심기 제한 시간':['Planting time limit','植える制限時間'],
'손패 심기와 임시 구역 심기의 제한 시간입니다. 지나면 자동으로 심습니다':['Time limit for planting from your hand and from the holding area. When it runs out, cards are planted automatically','手札から植えるときと仮置き場から植えるときの制限時間です。過ぎると自動で植えます'],
'거래 제한 시간':['Trading time limit','取引の制限時間'],
'거래 단계의 제한 시간입니다. 지나면 거래가 끝납니다':['Time limit for the trading phase. Trading ends when it runs out','取引フェーズの制限時間です。過ぎると取引が終わります'],
'선택: 방장이 대기실에서 먼저 시작할 사람을 고릅니다. 무작위: 카드를 나눈 뒤 주사위로 정합니다':['Choose: the host picks who starts in the waiting room. Random: decided by dice after dealing','指定：ホストが待機室で最初の人を選びます。ランダム：カードを配ったあとサイコロで決めます'],
'세 번째 밭 사기':['Buy a third field','3つ目の畑を買う'],
'예전 판 규칙: 4~5명일 때 3코인으로 세 번째 밭을 살 수 있습니다. 현행 규칙서 기본 게임에는 없습니다':['Old edition rule: with 4–5 players you can buy a third field for 3 coins. Not in the base game of the current rulebook','旧版のルール：4〜5人のとき3コインで3つ目の畑を買えます。現行ルールの基本ゲームにはありません'],
'심기':['Plant','植える'],
'거래':['Trade','取引'],
'심기 {0}초 · 거래 {1}초 · 선 {2}':['Plant {0}s · Trade {1}s · First {2}','植える{0}秒 · 取引{1}秒 · 先手 {2}'],
'심기 {0}초 · 거래 {1}초 · 선 {2} · 세 번째 밭 사기':['Plant {0}s · Trade {1}s · First {2} · Buy a third field','植える{0}秒 · 取引{1}秒 · 先手 {2} · 3つ目の畑を買う'],
'· 세 번째 밭 사기':['· Buy a third field','· 3つ目の畑を買う'],
'3~5명 거래 카드 게임':['Trading card game for 3–5','3〜5人の取引カードゲーム'],
'3명은 밭 3개, 4~5명은 밭 2개로 시작합니다.':['3 players start with 3 fields; 4–5 players with 2.','3人は畑3つ、4〜5人は畑2つで始めます。'],
'{0} 완두콩 {#1}장 수확 ({#2}코인)':['{0} harvested {1} pea ({2} coins)','{0} エンドウ豆{1}枚を収穫（{2}コイン）'],
'{0} 메주콩 {#1}장 수확 ({#2}코인)':['{0} harvested {1} soybean ({2} coins)','{0} 大豆{1}枚を収穫（{2}コイン）'],
'{0} 검은콩 {#1}장 수확 ({#2}코인)':['{0} harvested {1} black bean ({2} coins)','{0} 黒豆{1}枚を収穫（{2}コイン）'],
'{0} 강낭콩 {#1}장 수확 ({#2}코인)':['{0} harvested {1} kidney bean ({2} coins)','{0} インゲン豆{1}枚を収穫（{2}コイン）'],
'{0} 렌즈콩 {#1}장 수확 ({#2}코인)':['{0} harvested {1} lentil ({2} coins)','{0} レンズ豆{1}枚を収穫（{2}コイン）'],
'{0} 병아리콩 {#1}장 수확 ({#2}코인)':['{0} harvested {1} chickpea ({2} coins)','{0} ひよこ豆{1}枚を収穫（{2}コイン）'],
'{0} 팥 {#1}장 수확 ({#2}코인)':['{0} harvested {1} red bean ({2} coins)','{0} 小豆{1}枚を収穫（{2}コイン）'],
'{0} 작두콩 {#1}장 수확 ({#2}코인)':['{0} harvested {1} sword bean ({2} coins)','{0} なた豆{1}枚を収穫（{2}コイン）'],
'{0} 승리 ({1}코인)':['{0} wins ({1} coins)','{0}の勝ち（{1}コイン）'],
'{0} 세 번째 밭':['{0} bought a third field','{0} 3つ目の畑'],
'거래 끝':['End trading','取引終了'],
'넘기기':['Pass','パス'],
'수확':['Harvest','収穫'],
'더미 {0} · {1}/3회':['Deck {0} · {1}/3','山札{0} · {1}/3回'],
'나':['Me','自分'],
'내 턴':['My turn','自分の番'],
'{0} 턴':['{0}\'s turn','{0}の番'],
'모두 심기':['Plant all','すべて植える'],
'{0} · 심기 {1}/2':['{0} · Plant {1}/2','{0} · 植える {1}/2'],
'{0} · 거래':['{0} · Trade','{0} · 取引'],
'아무나':['Anyone','誰でも'],
'수락':['Accept','承諾'],
'역제안':['Counter','逆提案'],
'거절':['Decline','断る'],
'제안':['Offer','提案'],
'빈 밭':['Empty field','空き畑'],
'{0} 수확 {1}코인':['{0} harvest {1} coins','{0} 収穫{1}コイン'],
'{0} {#1}/{#2} ({#3}코인)':['{0} {1}/{2} ({3} coins)','{0} {1}/{2}（{3}コイン）'],
'{0} {#1}/{#2} ({#3}코인) ✕':['{0} {1}/{2} ({3} coins) ✕','{0} {1}/{2}（{3}コイン） ✕'],
'{0} {#1} MAX':['{0} {1} MAX','{0} {1} MAX'],
'{0} {#1} MAX ✕':['{0} {1} MAX ✕','{0} {1} MAX ✕'],
'{0}코인':['{0} coins','{0}コイン'],
'밭 사기':['Buy field','畑を買う'],
'다음 심기':['Plant next','次に植える'],
'{0} · {#1}':['{0} · {1}','{0} · {1}']
},{
en:{rulesHTML:'<ol class="rules"><li><b>Goal</b> : Harvest beans and collect the most coins</li><li><b>Hand</b> : You can\'t change the order. Plant from the front card; new cards go to the back</li><li><b>1. Plant</b> : You must plant the front card and may plant one more. Each field holds only one kind of bean</li><li><b>2. Trade</b> : Reveal 2 cards; you can trade with the active player or just give cards away</li><li><b>3. Plant again</b> : Plant all revealed cards and cards received in trades</li><li><b>4. Draw</b> : Draw 3 cards and put them at the back of your hand</li><li><b>Harvest</b> : Tap a field twice to harvest at any time. If you have a field with 2 or more cards, you can\'t harvest a field with only 1</li><li><b>End</b> : The game ends when the deck runs out for the third time; the player with the most coins wins</li></ol>'},
ja:{rulesHTML:'<ol class="rules"><li><b>目標</b> : 豆を収穫してコインをいちばん多く集めます</li><li><b>手札</b> : 順番は変えられません。いちばん前のカードから植え、新しいカードはいちばん後ろに入ります</li><li><b>1. 植える</b> : いちばん前のカードは必ず植え、もう1枚植えてもかまいません。1つの畑には1種類だけ植えます</li><li><b>2. 取引</b> : 2枚をめくり、手番の人と取引したり、ただであげたりできます</li><li><b>3. また植える</b> : めくったカードと取引でもらったカードをすべて植えます</li><li><b>4. 引く</b> : 3枚引いて手札のいちばん後ろに入れます</li><li><b>収穫</b> : いつでも畑を2回押すと収穫します。2枚以上の畑があるときは、1枚だけの畑は収穫できません</li><li><b>終わり</b> : 山札が3回目になくなったら終わり、コインの多い人が勝ちです</li></ol>'}});
(window.GAMES=window.GAMES||{}).bohnanza=G;
})();
