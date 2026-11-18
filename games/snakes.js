/* ===== 뱀 사다리 게임 모듈 =====
   공통 코드(index.html)가 GAMES.snakes의 함수를 불러서 이 게임의 규칙·봇·화면을 그림.
   2~4명. 게임 시작 전에 모두 동시에 뱀·사다리를 판에 설치(서로 보이게, 먼저 놓은 사람이 그 자리를 차지)하고,
   차례대로 컵을 흔들어 주사위를 던져 그 수만큼 말을 옮김. 사다리 아래에 서면 위로, 뱀 머리에 서면 꼬리로.
   내가 설치한 뱀·사다리도 나에게 똑같이 작용함(사용자가 정함, 2026-11-18). 마지막 칸에 먼저 닿은 사람이 승리.
   설정(사용자가 정함): 판 크기, 한 사람이 설치할 뱀·사다리 수, 최대 거리(줄), 정확히 도착. 주사위 수·설치 시간은 Claude가 더함.
   판 ph: setup(설치) → play(굴리기, 굴리면 mv 연출) → done */
(function(){
const G={id:'snakes',name:'뱀 사다리',short:'사다리',lead:'직접 설치한 뱀과 사다리로 겨루는 주사위 경주',maxHi:4,minN:2,noFast:true,firstPick:true,felt:false};

/* ---------- 규칙 값 ---------- */
const SIZES=[6,8,10,12];
const SEAT_C=['#c53026','#2b65ca','#1f7a2e','#c9831a'];   // 자리 색 (첫 차례 주사위 면과 같음)
/* 굴리기 연출 (ms, 굴린 때 기준): 컵을 기울여 주사위를 던짐(골라 걷기는 짧게) → 칸마다 한 걸음 → 사다리·뱀 → 끝 */
const MV={throw:2100,walk0:500,step:200,ladder:850,snake:1100,shield:700,end:450};
const mvLen=(n,via,nt,blk)=>(nt?MV.walk0:MV.throw)+n*MV.step+(via?(via.k==='l'?MV.ladder:MV.snake):0)+(blk?MV.shield:0)+MV.end;
const GO_WAIT=900;   // 모두 설치하면 잠깐 뒤 시작 (마지막으로 놓은 것이 보이게)
const SW_MS=800;     // 자리 바꾸기 연출
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
/* 능력 모드 (사용자가 정함, 2026-11-18: 능력은 게임 시작 때만 얻음)
   설치 능력(한 사람 1번, 내 뱀·사다리 하나에 붙임): 사거리(최대 거리 +2줄) · 면역(내 뱀이 나를 안 묾, 뱀만) · 전용(내 사다리는 나만 탐, 사다리만)
   게임 능력(설치 때 하나 고름, 한 판에 한 번, 내 차례에 굴리기 전): 자리 바꾸기 · 방패(처음 밟은 뱀 무시, 저절로) · 주사위 하나 더 · 골라 걷기(1~3) · 뱀 놓기 */
const XAB={rg:{n:'사거리',d:'최대 거리 +2줄'},im:{n:'면역',d:'내 뱀이 나를 물지 않음'},ex:{n:'전용',d:'내 사다리는 나만 탐'}};
const CARDS=['swap','shield','more','walk','snake'];
const CARD={swap:{n:'자리 바꾸기',d:'다른 사람과 말 자리를 바꿉니다. 맨 윗줄에 있는 사람과는 바꿀 수 없습니다'},
  shield:{n:'방패',d:'처음 밟은 뱀 하나를 무시합니다(저절로)'},
  more:{n:'주사위 하나 더',d:'이번 굴림에 주사위를 하나 더 던집니다'},
  walk:{n:'골라 걷기',d:'주사위 대신 1~3칸 중 골라 걷습니다'},
  snake:{n:'뱀 놓기',d:'빈 곳에 내 뱀을 하나 더 설치합니다'}};
/* 방 설정 → 실제로 쓰는 값. 판에 비해 뱀·사다리가 너무 많으면 줄임(끝점이 칸의 절반을 넘지 않게) */
function eff(c,n){
  const N=SIZES[clamp(Math.round(+c.sz),0,3)]||10;
  let sn=clamp(Math.round(+c.sn||0),0,5),ld=clamp(Math.round(+c.ld||0),0,5);
  const cap=Math.max(0,Math.floor((N*N-2)/(4*Math.max(2,n||2))));
  while(sn+ld>cap){if(sn>=ld&&sn>0)sn--;else ld--}
  return {N,L:N*N,sn,ld,len:clamp(Math.round(+c.len||3),1,N-1),exact:+c.exact?1:0,dn:+c.dc?2:1,ab:+c.ab?1:0};
}
const capOf=(c,n)=>{const N=SIZES[clamp(Math.round(+c.sz),0,3)]||10;return Math.max(0,Math.floor((N*N-2)/(4*Math.max(2,n||2))))};

/* ---------- 판 (방장 엔진과 화면이 같은 함수를 씀) ----------
   칸 1..N²: 아래 줄부터 지그재그(아래 줄 왼쪽 → 오른쪽, 다음 줄 오른쪽 → 왼쪽). 1이 출발, N²이 도착.
   뱀 {k:'s',a:머리,b:꼬리}, 사다리 {k:'l',a:아래,b:위}, x: 붙인 설치 능력(rg·im·ex). 끝점은 모두 서로 다른 칸이고 1·N²에는 놓을 수 없음 */
const rowOf=(c,N)=>Math.floor((c-1)/N);
const colOf=(c,N)=>{const r=rowOf(c,N),k=(c-1)%N;return r%2?N-1-k:k};
const cellAt=(r,col,N)=>r<0||r>=N||col<0||col>=N?0:r*N+(r%2?N-1-col:col)+1;
const usedSet=items=>{const s=new Set();for(const it of items){s.add(it.a);s.add(it.b)}return s};
const lenOf=(cf,x)=>x==='rg'?Math.min(cf.N-1,cf.len+2):cf.len;
const xOk=(k,x)=>!x||x==='rg'||(x==='im'&&k==='s')||(x==='ex'&&k==='l');
function okPut(items,cf,k,a,b,x){
  const L=cf.L,N=cf.N;
  if(!Number.isInteger(a)||!Number.isInteger(b)||a<2||b<2||a>=L||b>=L||a===b||!xOk(k,x))return false;
  const u=usedSet(items);if(u.has(a)||u.has(b))return false;
  const d=rowOf(a,N)-rowOf(b,N),len=lenOf(cf,x);   // 뱀은 머리가 위 줄, 사다리는 위 끝이 위 줄
  return k==='s'?d>=1&&d<=len:k==='l'?-d>=1&&-d<=len:false;
}
/* 이 끝에서 놓을 수 있는 다른 끝 */
function endsFor(items,cf,k,a,x){
  const out=[],N=cf.N,ra=rowOf(a,N),len=lenOf(cf,x);
  if(a<2||a>=cf.L||usedSet(items).has(a)||!xOk(k,x))return out;
  for(let d=1;d<=len;d++){const r=k==='s'?ra-d:ra+d;if(r<0||r>=N)break;for(let col=0;col<N;col++){const b=cellAt(r,col,N);if(okPut(items,cf,k,a,b,x))out.push(b)}}
  return out;
}
function allPairs(items,cf,k,x){const out=[];for(let a=2;a<cf.L;a++)for(const b of endsFor(items,cf,k,a,x))out.push([a,b]);return out}
/* 그 사람에게 작용하는 뱀·사다리인지: 면역 뱀은 놓은 사람을 안 묾, 전용 사다리는 놓은 사람만 탐 */
const acts=(it,seat)=>!(it.k==='s'&&it.x==='im'&&it.o===seat)&&!(it.k==='l'&&it.x==='ex'&&it.o!==seat);
/* 굴린 수만큼 걷기: 정확히 도착이면 넘친 만큼 되돌아옴, 아니면 도착에서 멈춤. 마지막 칸이 뱀 머리·사다리 아래면 옮겨 감.
   방패가 있으면 뱀을 한 번 막음(blk) */
function walk(items,cf,from,n,seat,shield){
  const path=[];let cur=from,dir=1;
  for(let k=0;k<n;k++){
    if(cur===cf.L){if(!cf.exact)break;dir=-1}
    cur+=dir;path.push(cur);
  }
  const it=items.find(x=>x.a===cur&&acts(x,seat==null?-1:seat));
  if(it&&it.k==='s'&&shield)return {path,via:null,blk:{k:it.k,a:it.a,b:it.b},to:cur};
  return {path,via:it?{k:it.k,a:it.a,b:it.b}:null,blk:null,to:it?it.b:cur};
}

G.cardHTML=()=>'';G.drawFace=()=>{};G.cmpCard=()=>0;G.labelOf=()=>'';   // 카드 없음 (hand는 표시용 값 하나)

/* ---------- 규칙 설명·방 설정 ---------- */
G.rulesHTML='<ol class="rules"><li><b>설치</b> : 게임을 시작하면 모두 함께 뱀과 사다리를 판에 설치합니다. 오른쪽 아래에서 뱀이나 사다리를 고르고, 판에서 한쪽 끝(뱀은 머리, 사다리는 아래)을 누른 뒤 초록으로 빛나는 칸 중 다른 쪽 끝을 누릅니다. 다른 사람이 놓는 것도 바로 보이고, 먼저 놓은 사람이 그 자리를 차지합니다. 내가 놓은 것의 끝을 다시 누르면 거둬들입니다</li><li><b>설치 규칙</b> : 뱀은 머리가 꼬리보다 위 줄, 사다리는 위 끝이 아래 끝보다 위 줄에 있어야 하고, 두 끝의 줄 차이는 최대 거리까지입니다. 출발·도착 칸과 이미 놓인 끝에는 놓을 수 없습니다. 설치 시간이 지나면 남은 것은 아무 자리에나 놓입니다</li><li><b>굴리기</b> : 차례가 되면 내 컵을 누르고 있으면 흔들리고, 떼면 주사위를 던집니다. 나온 수만큼 말이 앞으로 갑니다. 번호가 이어지는 칸끼리만 붙어 있고, 줄 끝에서 다리를 건너 다음 줄로 갑니다</li><li><b>뱀·사다리</b> : 사다리 아래 끝에 서면 위 끝으로 올라가고, 뱀 머리에 서면 꼬리로 미끄러져 내려갑니다. 내가 설치한 것도 똑같이 작용합니다</li><li><b>승리</b> : 마지막 칸에 먼저 닿은 사람이 승리합니다. 정확히 도착을 켜면 남은 칸보다 큰 수가 나왔을 때 넘친 만큼 되돌아옵니다</li><li><b>제한 시간</b> : 시간이 지나면 저절로 굴립니다</li><li><b>능력 모드</b> : 능력은 게임 시작 때만 얻습니다<ul><li><b>설치 능력</b>(한 번) : 설치할 때 내 뱀·사다리 하나에 붙입니다. <b>사거리</b> 최대 거리 +2줄 · <b>면역</b> 내 뱀이 나를 물지 않음(뱀만) · <b>전용</b> 내 사다리는 나만 탐(사다리만)</li><li><b>게임 능력</b>(한 판에 한 번) : 설치하는 동안 하나를 고르고, 내 차례에 굴리기 전에 씁니다. <b>자리 바꾸기</b> 다른 사람과 말 자리를 바꿈(맨 윗줄에 있는 사람과는 못 바꿈) · <b>방패</b> 처음 밟은 뱀 하나를 무시(저절로) · <b>주사위 하나 더</b> · <b>골라 걷기</b> 주사위 대신 1~3칸 · <b>뱀 놓기</b> 빈 곳에 내 뱀 하나를 더 설치. 고르지 않으면 무작위로 정해집니다</li></ul></li></ol>';
G.modeDesc=['마지막 칸에 먼저 닿으면 승리','마지막 칸에 먼저 닿으면 승리'];
G.defaults={max:4,turn:20,stime:60,sz:2,sn:1,ld:1,len:3,dc:0,ab:0,exact:0,pickfirst:0};
G.roomSet=[
  {k:'turn',label:'제한 시간',unit:'초',lo:10,hi:60,step:5,desc:'시간이 지나면 저절로 굴립니다'},
  {k:'stime',label:'설치 시간',unit:'초',lo:20,hi:120,step:10,lever:1,desc:'뱀·사다리를 설치하는 시간. 지나면 남은 것은 아무 자리에나 놓입니다'},
  {k:'sz',label:'판 크기',lo:0,hi:3,step:1,lever:1,desc:'판의 가로·세로 칸 수'},
  {k:'sn',label:'뱀',unit:'개',lo:0,hi:5,step:1,lever:1,desc:'한 사람이 설치하는 뱀 수'},
  {k:'ld',label:'사다리',unit:'개',lo:0,hi:5,step:1,lever:1,desc:'한 사람이 설치하는 사다리 수'},
  {k:'len',label:'최대 거리',unit:'줄',lo:1,hi:11,step:1,lever:1,desc:'뱀·사다리의 두 끝이 떨어질 수 있는 최대 줄 수'},
  {k:'dc',label:'주사위',lo:0,hi:1,step:1,lever:1,desc:'한 번에 던지는 주사위 수'},
  {k:'ab',label:'게임 모드',lo:0,hi:1,step:1,lever:1,desc:'클래식 · 능력'}];
G.ruleSet=[
  {k:'exact',label:'정확히 도착',desc:'마지막 칸에 딱 맞게 닿아야 합니다. 넘치면 넘친 만큼 되돌아옵니다'},
  {k:'pickfirst',pick:1,label:'선 플레이어',desc:'선택: 방장이 대기실에서 먼저 굴릴 사람을 고릅니다. 무작위: 주사위로 정합니다'}];
const ruleOf=k=>G.ruleSet.find(d=>d.k===k);
G.boardSet=c=>{
  const rs=roomSetOf(G,c),n=Math.max(2,+c.max||4),cap=capOf(c,n),e=eff(c,n);
  const num=(k,o)=>{const d=rs.find(x=>x.k===k);return {kind:'num',...d,v:+(c[k]??G.defaults[k]),diff:false,...(o||{})}};
  return [
    {kind:'choice',k:'ab',label:'게임 모드',opts:['클래식','능력'],desc:'클래식: 뱀·사다리만 · 능력: 설치 능력(사거리·면역·전용) 하나와 게임 능력(자리 바꾸기·방패·주사위 하나 더·골라 걷기·뱀 놓기) 하나를 씁니다',v:e.ab,diff:!!e.ab,act:o=>'sl:ab:'+o},
    {kind:'choice',k:'sz',label:'판 크기',opts:SIZES.map(s=>s+'×'+s),desc:'판의 가로·세로 칸 수',v:clamp(+c.sz,0,3),diff:+c.sz!==G.defaults.sz,act:o=>'sl:sz:'+o},
    num('sn',{v:e.sn,hi:Math.min(5,cap-e.ld)}),num('ld',{v:e.ld,hi:Math.min(5,cap-e.sn)}),
    num('len',{v:e.len,hi:e.N-1}),
    {kind:'choice',k:'dc',label:'주사위',opts:['1개','2개'],desc:'한 번에 던지는 주사위 수',v:+c.dc?1:0,diff:!!+c.dc,act:o=>'sl:dc:'+o},
    {kind:'tog',k:'exact',label:ruleOf('exact').label,desc:ruleOf('exact').desc,v:+c.exact?1:0,diff:!!+c.exact,act:()=>'tog:exact'},
    num('stime'),
    rbRuleItem(ruleOf('pickfirst'),c)];
};
/* 판자의 숫자 칸은 공통이 처리(setRoomCfg). 게임 모드·판 크기·주사위 플립과, 값이 실제 쓰는 값과 다르면 맞춰 둠 */
G.panelAct=a=>{
  if(!a.startsWith('sl:'))return false;
  if(!(mode==='host'&&H&&H.phase==='wait'))return true;
  const p=a.split(':'),v=+p[2];
  if(p[1]==='sz'&&v>=0&&v<=3)H.cfg={...H.cfg,sz:v};
  else if(p[1]==='dc')H.cfg={...H.cfg,dc:v?1:0};
  else if(p[1]==='ab')H.cfg={...H.cfg,ab:v?1:0};
  else return true;
  const e=eff(H.cfg,Math.max(2,+H.cfg.max||4));H.cfg={...H.cfg,sn:e.sn,ld:e.ld,len:e.len};
  saveRoomCfg(H.cfg);sfx('tick');lastPanelHtml='';mark();return true;
};
const cfgTxt=c=>{const e=eff(c,Math.max(2,+c.max||4));return `${e.ab?'능력 · ':''}${e.N}×${e.N} · 뱀 ${e.sn} · 사다리 ${e.ld} · 최대 ${e.len}줄${e.exact?' · 정확히 도착':''}${e.dn>1?' · 주사위 2개':''}`};
G.modeLabel=c=>{const e=eff(c,Math.max(2,+c.max||4));return `${e.ab?'능력 ':''}${e.N}×${e.N}`};
G.cfgChips=c=>{const e=eff(c,Math.max(2,+c.max||4));return `${e.ab?'<span class="chip"><b>능력</b></span>':''}<span class="chip">판 <b>${e.N}×${e.N}</b></span><span class="chip">뱀 <b>${e.sn}개</b></span><span class="chip">사다리 <b>${e.ld}개</b></span><span class="chip">최대 <b>${e.len}줄</b></span>${e.exact?'<span class="chip"><b>정확히 도착</b></span>':''}<span class="chip">제한 시간 <b>${+c.turn||20}초</b></span>`};
G.cfgSum=c=>`${cfgTxt(c)} · 설치 ${+c.stime||60}초 · 제한 시간 ${+c.turn||20}초 · 선 ${+c.pickfirst?'선택':'무작위'}`;
G.roomSub=()=>'2~4명 주사위 경주';
G.pubExtra=()=>({});
G.cardInfo=()=>'<p class="cardinfo">판 · 말 · 주사위 · 컵</p>';
G.rankTitle=()=>'';
G.finLabel=f=>f===1?'승리':f+'위';
G.noEmotes=[];
G.keys={};
G.keyActions=[];

/* ---------- 방장 엔진 ---------- */
const alive=()=>H.players.map((_,i)=>i).filter(i=>!H.players[i].finished);
function nextAlive(i){const n=H.players.length;for(let k=1;k<=n;k++){const j=(i+k)%n;if(!H.players[j].finished)return j}return -1}
const aliveOr=i=>H.players[i]&&!H.players[i].finished?i:nextAlive(i);
const pushEv=e=>{const O=H.sl;e.sn=++O.sq;O.ev.push(e);if(O.ev.length>14)O.ev.shift();return e};
const leftOf=i=>{const L=H.sl.left[i];return L?L[0]+L[1]:0};
const awayWait=(p,t)=>p.away&&t<p.awayAt+AWAY_WAIT;
/* 설치: 모두 동시에. 차례(H.turn)는 아직 남은 첫 사람, 시간은 설치 시간 */
function setupTurn(){const O=H.sl,i=H.players.findIndex((p,j)=>!p.finished&&(leftOf(j)>0||(O.cf.ab&&!O.card[j])));H.turn=i<0?aliveOr(0):i;H.deadline=O.sdl;H.botActAt=0}
function checkSetup(){
  const O=H.sl,done=alive().every(i=>leftOf(i)===0&&(!O.cf.ab||O.card[i]));   // 능력 모드는 게임 능력도 골라야 끝
  O.goAt=done?clock()+GO_WAIT:0;setupTurn();
}
function doPut(seat,k,a,b,x){
  const O=H.sl,L=O.left[seat],ki=k==='s'?0:1;x=x&&O.cf.ab&&XAB[x]&&O.tok[seat]>0?x:'';
  if(!L||L[ki]<=0||!okPut(O.items,O.cf,k,a,b,x))return false;
  const it={k,a,b,o:seat};if(x){it.x=x;O.tok[seat]--}
  O.items.push(it);L[ki]--;
  pushEv({k:'p',s:seat,it:{k,a,b,x}});checkSetup();mark();return true;
}
function doDel(seat,c){
  const O=H.sl,j=O.items.findIndex(it=>it.o===seat&&!it.g&&(it.a===c||it.b===c));if(j<0)return;
  const it=O.items[j];O.items.splice(j,1);O.left[seat][it.k==='s'?0:1]++;if(it.x)O.tok[seat]++;
  pushEv({k:'d',s:seat,it:{k:it.k,a:it.a,b:it.b}});checkSetup();mark();
}
/* 봇이 놓을 자리: 내가 놓은 것도 나에게 똑같이 작용하고 모두 1에서 출발하므로 자리로 얻는 이득이 없음 → 난이도와 상관없이 아무 데나
   (뱀 머리를 위쪽에 몰면 모두가 끝없이 미끄러져 판이 끝나지 않음: 봇 대전에서 확인) */
function botPick(seat,k,x){
  const O=H.sl,P=allPairs(O.items,O.cf,k,x);
  return P.length?P[Math.random()*P.length|0]:null;
}
function placeOne(seat,auto){
  const O=H.sl,L=O.left[seat];if(!L)return false;
  const order=L[0]&&L[1]?(Math.random()<.5?['s','l']:['l','s']):L[0]?['s']:['l'];
  for(const k of order){
    /* 봇은 능력 모드에서 설치 능력을 붙임(뱀이면 면역·사거리, 사다리면 전용·사거리) */
    let x='';if(!auto&&O.cf.ab&&O.tok[seat]>0&&Math.random()<.6)x=Math.random()<.5?'rg':k==='s'?'im':'ex';
    const pr=botPick(seat,k,x)||(x?botPick(seat,k,''):null);
    if(pr&&(doPut(seat,k,pr[0],pr[1],okPut(O.items,O.cf,k,pr[0],pr[1],x)?x:'')))return true;
    L[k==='s'?0:1]=0;   // 놓을 자리가 없음
  }
  checkSetup();mark();return false;
}
function autoFill(){
  const O=H.sl;
  for(const i of alive())while(leftOf(i)>0)if(!placeOne(i,true)&&leftOf(i)>0)O.left[i]=[0,0];
  if(O.cf.ab)alive().forEach(i=>{if(!O.card[i])O.card[i]=CARDS[Math.random()*CARDS.length|0]});   // 고르지 않은 게임 능력은 무작위
  checkSetup();mark();
}
function beginPlay(){
  const O=H.sl;O.ph='play';O.goAt=0;
  if(O.cf.ab)H.players.forEach((p,i)=>{if(!O.card[i])O.card[i]=CARDS[Math.random()*CARDS.length|0];O.shd[i]=O.card[i]==='shield'?1:0});
  addLog(`${H.players[aliveOr(O.first)].name}부터 굴립니다.`,'sys');
  pushEv({k:'go'});setTurn(aliveOr(O.first));
}
function setTurn(i){
  const O=H.sl;H.turn=i;H.deadline=clock()+(+H.cfg.turn||20)*1000;
  H.botActAt=H.players[i].bot?clock()+rand(1300,2200):0;O.shk=H.players.map(()=>0);mark();
}
/* 굴리기 (opt.n: 골라 걷기로 주사위 없이 n칸) */
function doRoll(seat,opt){
  const O=H.sl,cf=O.cf,d=[],nt=!!(opt&&opt.n);
  if(!nt){const dn=cf.dn+(O.more[seat]?1:0);O.more[seat]=0;for(let k=0;k<dn;k++)d.push(1+(Math.random()*6|0))}
  const n=nt?opt.n:d.reduce((a,b)=>a+b,0),w=walk(O.items,cf,O.pos[seat],n,seat,!!O.shd[seat]);
  if(w.blk){O.shd[seat]=0;O.used[seat]=1}
  O.mv={id:++O.rn,s:seat,d,nt:nt?n:0,from:O.pos[seat],path:w.path,via:w.via,blk:w.blk,to:w.to,seed:1+(Math.random()*1e9|0),t0:clock(),ms:mvLen(w.path.length,w.via,nt,w.blk)};
  O.shk[seat]=0;H.deadline=clock()+864e5;H.botActAt=0;H.seatNote={};
  const p=H.players[seat],end=w.path.length?w.path[w.path.length-1]:O.pos[seat];
  addLog(`${p.name} ${nt?'골라 걷기 '+n:d.join('+')+(d.length>1?'='+n:'')} → ${end}${w.via?(w.via.k==='l'?' 사다리 '+w.to:' 뱀 '+w.to):w.blk?' 방패':''}`,w.via?(w.via.k==='l'?'fin':'lie'):'');
  if(w.blk)pushEv({k:'a',s:seat,c:'shield'});
  pushEv({k:'r',s:seat,id:O.mv.id});mark();
}
/* 게임 능력 쓰기: 내 차례, 굴리기 전, 한 판에 한 번 */
function canAb(seat,c){const O=H.sl;return !!(O.cf.ab&&O.ph==='play'&&!O.mv&&H.turn===seat&&O.card[seat]===c&&!O.used[seat])}
const swapOk=(seat,j)=>{const O=H.sl;return j!==seat&&H.players[j]&&!H.players[j].finished&&rowOf(O.pos[j],O.cf.N)<O.cf.N-1&&O.pos[j]!==O.pos[seat]};
function doAb(seat,a){
  const O=H.sl,c=a.c;if(!canAb(seat,c)||c==='shield')return false;
  const nm=H.players[seat].name;
  if(c==='swap'){const j=a.j;if(!Number.isInteger(j)||!swapOk(seat,j))return false;
    const pa=O.pos[seat],pb=O.pos[j];O.pos[seat]=pb;O.pos[j]=pa;O.sw={a:seat,b:j,ca:pa,cb:pb,t0:clock(),id:(O.sw?O.sw.id:0)+1};
    addLog(`${nm} 자리 바꾸기 ↔ ${H.players[j].name}`,'sys');}
  else if(c==='more'){O.more[seat]=1;addLog(`${nm} 주사위 하나 더`,'sys')}
  else if(c==='walk'){const n=a.n;if(n!==1&&n!==2&&n!==3)return false;O.used[seat]=1;pushEv({k:'a',s:seat,c});doRoll(seat,{n});return true}
  else if(c==='snake'){if(!okPut(O.items,O.cf,'s',a.a,a.b,''))return false;O.items.push({k:'s',a:a.a,b:a.b,o:seat,g:1});addLog(`${nm} 뱀 놓기 ${a.a} → ${a.b}`,'sys')}
  else return false;
  O.used[seat]=1;pushEv({k:'a',s:seat,c,j:a.j});
  if(H.players[seat].bot)H.botActAt=Math.max(H.botActAt,clock()+(c==='swap'?SW_MS+600:900));
  mark();return true;
}
/* 봇의 게임 능력: 앞선 사람과 자리 바꾸기, 닿는 사다리·도착이면 골라 걷기, 멀면 주사위 하나 더, 앞선 사람 바로 앞에 뱀 놓기 */
function botAb(i){
  const O=H.sl,c=O.card[i],cf=O.cf,me=O.pos[i];if(!canAb(i,c))return false;
  if(c==='swap'){let best=-1,bd=Math.max(8,cf.L*.15);for(const j of alive())if(swapOk(i,j)&&O.pos[j]-me>=bd){bd=O.pos[j]-me;best=j}return best>=0&&doAb(i,{c,j:best})}
  if(c==='walk'){for(const n of [3,2,1]){const w=walk(O.items,cf,me,n,i,false);if((w.via&&w.via.k==='l')||w.to===cf.L)return doAb(i,{c,n})}return false}
  if(c==='more')return !cf.exact&&cf.L-me>12&&Math.random()<.3&&doAb(i,{c});
  if(c==='snake'){const lead=alive().filter(j=>j!==i&&O.pos[j]>me).sort((a,b)=>O.pos[b]-O.pos[a])[0];if(lead==null||Math.random()<.5)return false;
    for(let k=1;k<=6;k++){const a=O.pos[lead]+k,E=a<cf.L?endsFor(O.items,cf,'s',a,''):[];if(E.length)return doAb(i,{c,a,b:E[Math.random()*E.length|0]})}return false}
  return false;
}
function endMove(){
  const O=H.sl,m=O.mv;O.mv=null;O.last={...m};
  if(H.players[m.s].finished){setTurn(nextAlive(m.s));return}
  O.pos[m.s]=m.to;
  if(m.to===O.cf.L){finish(m.s);return}
  setTurn(nextAlive(m.s));
}
function finish(w){
  const O=H.sl;O.ph='done';
  const p=H.players[w];p.finished=true;p.rank=1;p.hand=[];addLog(`${p.name} 승리!`,'fin');
  const rest=alive().sort((a,b)=>O.pos[b]-O.pos[a]||((a-w+H.players.length)%H.players.length)-((b-w+H.players.length)%H.players.length));
  rest.forEach((i,k)=>{const q=H.players[i];q.finished=true;q.rank=k+2;q.hand=[]});
  H.phase='over';H.botActAt=0;H.deadline=0;H.turn=-1;mark();
  H.players.forEach((q,i)=>{if(q.bot&&Math.random()<.5)botEmote(i,'gg',800+Math.random()*1600)});
}
function retire(i){const O=H.sl,p=H.players[i];p.finished=true;p.hand=[];p.rank=O.rank--}
function doSurrender(seat){
  const O=H.sl,p=H.players[seat];
  if(H.phase!=='play'||!p||p.finished)return;
  p.surrendered=true;addLog(`${p.name} ${p.deserter?'탈주':'항복'}`,'lie');
  retire(seat);
  const L=alive();if(L.length===1){finish(L[0]);return}if(!L.length){H.phase='over';mark();return}
  if(O.ph==='setup'){O.left[seat]=[0,0];checkSetup();mark();return}
  if(O.mv&&O.mv.s===seat){O.mv=null;setTurn(nextAlive(seat));return}
  if(!O.mv&&H.turn===seat){setTurn(nextAlive(seat));return}
  mark();
}
G._test={eff,okPut,endsFor,allPairs,walk,rowOf,colOf,cellAt,mvLen,MV,GO_WAIT,botPick,CARDS,swapOk};
G.engine={
  start(){
    Object.assign(H,{phase:'play',log:[],seatNote:{},field:[],last:null,reveal:null,shouts:[],pending:null,rankNext:1,known:{},turn:0,botActAt:0,deadline:0});
    const n=H.players.length,cf=eff(H.cfg,n),z=()=>H.players.map(()=>0);
    H.players.forEach(p=>{p.finished=false;p.rank=null;p.surrendered=false;p.hand=[0]});
    const t=clock(),first=firstSeat(n);
    H.sl={gn:((H.sl&&H.sl.gn)||0)+1,rn:0,cf,ph:'setup',items:[],left:H.players.map(()=>[cf.sn,cf.ld]),pos:H.players.map(()=>1),mv:null,last:null,shk:z(),
      ev:[],sq:0,first,rank:n,sdl:t+(+H.cfg.stime||60)*1000,goAt:0,bt:H.players.map(p=>p.bot?t+rand(1200,2600):0),
      tok:H.players.map(()=>cf.ab?1:0),card:H.players.map(p=>cf.ab&&p.bot?CARDS[Math.random()*CARDS.length|0]:null),used:z(),shd:z(),more:z(),sw:null};
    addLog(`${n}명 시작. 뱀·사다리를 설치합니다.`,'sys');
    if(cf.sn+cf.ld===0&&!cf.ab){H.sl.left=H.players.map(()=>[0,0]);beginPlay()}
    else checkSetup();
  },
  act(seat,a){
    const O=H.sl;
    if(!O||H.phase!=='play'||seat<0||seat>=H.players.length)return;
    if(a.t==='surrender'){doSurrender(seat);return}
    if(dealing()||H.players[seat].finished)return;
    if(O.ph==='setup'){
      if(a.t==='put'&&(a.k==='s'||a.k==='l'))doPut(seat,a.k,a.a,a.b,a.x);
      else if(a.t==='del'&&Number.isInteger(a.c))doDel(seat,a.c);
      else if(a.t==='pick'&&O.cf.ab&&CARD[a.c]&&O.card[seat]!==a.c&&!O.goAt){O.card[seat]=a.c;checkSetup();mark()}
      return;
    }
    if(O.ph!=='play'||O.mv||H.turn!==seat)return;
    if(a.t==='shake'){const v=a.on?1:0;if(O.shk[seat]!==v){O.shk[seat]=v;mark()}}
    else if(a.t==='roll')doRoll(seat);
    else if(a.t==='ab')doAb(seat,a);
  },
  tick(t){
    const O=H.sl;if(!O||H.phase!=='play')return;
    if(O.ph==='setup'){
      if(O.goAt){if(t>=O.goAt)beginPlay();return}
      if(t>=O.sdl){autoFill();return}
      H.players.forEach((p,i)=>{if(!p.bot||p.finished||!O.bt[i]||t<O.bt[i]||leftOf(i)<=0||awayWait(p,t))return;placeOne(i,false);O.bt[i]=t+rand(1400,3000)});
      return;
    }
    if(O.ph!=='play')return;
    if(O.mv){if(t>=O.mv.t0+O.mv.ms)endMove();return}
    const i=H.turn,cur=H.players[i];if(!cur)return;
    if(t>=H.deadline){addLog(`${cur.name} 시간 초과`,'sys');doRoll(i);return}
    if(cur.bot&&H.botActAt&&!awayWait(cur,t)){
      if(t>=H.botActAt){if(O.cf.ab&&botAb(i))return;doRoll(i)}
      else if(t>=H.botActAt-900&&!O.shk[i]&&!(O.sw&&t<O.sw.t0+SW_MS)){O.shk[i]=1;mark()}
    }
  },
  snap(s,you,t){
    const O=H.sl,me=you>=0&&you<H.players.length;
    s.sl={gn:O.gn,ph:O.ph,cf:{...O.cf},items:O.items.map(x=>({...x})),left:O.left.map(x=>x.slice()),pos:O.pos.slice(),out:H.players.map(p=>p.finished?1:0),
      first:O.first,shk:O.shk.slice(),ev:O.ev.map(e=>({...e,it:e.it?{...e.it}:undefined})),sq:O.sq,
      mv:O.mv?{...O.mv,path:O.mv.path.slice(),d:O.mv.d.slice(),via:O.mv.via?{...O.mv.via}:null,blk:O.mv.blk?{...O.mv.blk}:null,el:Math.max(0,Math.round(t-O.mv.t0))}:null,
      last:O.last?{id:O.last.id,s:O.last.s,d:O.last.d.slice(),seed:O.last.seed,nt:O.last.nt}:null};
    if(O.cf.ab){   // 게임 능력은 쓰기 전까지 나만 봄
      Object.assign(s.sl,{tok:O.tok.slice(),used:O.used.slice(),cards:O.card.map((c,i)=>i===you||O.used[i]?c:null),shd:me?O.shd[you]:0,more:me?O.more[you]:0});
      if(O.sw)s.sl.sw={...O.sw,el:Math.max(0,Math.round(t-O.sw.t0))};
    }
    if(O.ph==='setup'){
      s.sl.go=O.goAt?1:0;
      s.dl=Math.max(0,Math.round(O.sdl-t));
      if(me&&!H.players[you].finished&&(leftOf(you)>0||(O.cf.ab&&!O.card[you]))&&!O.goAt)s.t=you;else delete s.t;
    }else{
      s.dl=O.mv||O.ph!=='play'?0:Math.max(0,Math.round(H.deadline-t));
      if(O.ph!=='play')delete s.t;
    }
    s.gr=0;
  },
  restore(ms){const O=H.sl;if(!O)return;O.sdl+=ms;if(O.goAt)O.goAt+=ms;if(O.bt)O.bt=O.bt.map(b=>b?b+ms:0);if(O.mv)O.mv.t0+=ms;if(O.sw)O.sw.t0+=ms},
  emoPhase:ph=>ph==='play'||ph==='over'
};

/* ---------- 화면: 공통 ---------- */
const O_=()=>V&&V.sl;
const nameOf=i=>V&&V.ps&&V.ps[i]?V.ps[i].n:'';
const iSeat=()=>{const i=myIdx(),o=O_();return i>=0&&V&&V.ps&&i<V.ps.length&&o&&!o.out[i]};
const canPlace=()=>{const o=O_();return !!(o&&V.st==='play'&&iSeat()&&o.ph==='setup'&&!o.go&&!dealingV())};
const myLeft=()=>{const o=O_(),i=myIdx();return o&&o.left[i]?o.left[i]:[0,0]};
const canRoll=()=>{const o=O_();return !!(o&&V.st==='play'&&iSeat()&&o.ph==='play'&&!o.mv&&V.t===myIdx()&&!dealingV())};
let elBox=null,elSet=null,elCup=null,elHit=null,el2d=null,elTag=null,elRoll=null,elCards=null,elAb=null;
const SEL={k:'s',a:0,x:'',gs:0,ab:''};   // k 뱀·사다리, a 고른 끝, x 붙일 설치 능력, gs 게임 중 뱀 놓기, ab 펼친 게임 능력(자리 바꾸기·골라 걷기)
/* 게임 능력을 지금 쓸 수 있는지 (내 차례, 굴리기 전, 아직 안 씀) */
const myCard=()=>{const o=O_(),i=myIdx();return o&&o.cf.ab&&o.cards&&i>=0?o.cards[i]:null};
const canAbV=c=>{const o=O_(),i=myIdx();return !!(o&&o.cf.ab&&canRoll()&&!HOLD.on&&myCard()===c&&!o.used[i])};
/* 판을 눌러 놓는 중인지: 설치 단계(setup) 또는 게임 중 뱀 놓기(snake) */
const placing=()=>canPlace()?'setup':SEL.gs&&canAbV('snake')?'snake':'';
const swapOkV=j=>{const o=O_(),i=myIdx();return j!==i&&!o.out[j]&&rowOf(o.pos[j],o.cf.N)<o.cf.N-1&&o.pos[j]!==o.pos[i]};
let lockAt=-1e9;
function send(a){if(clock()-lockAt<200)return false;lockAt=clock();sendAct(a);return true}
const PIPS={1:[5],2:[1,9],3:[1,5,9],4:[1,3,7,9],5:[1,3,5,7,9],6:[1,3,4,6,7,9]};
const dieSVG=v=>`<svg class="sl-d" viewBox="0 0 30 30" aria-label="${v}"><rect x="1.5" y="1.5" width="27" height="27" rx="6" fill="#fbf3e0" stroke="#4a3020" stroke-width="2"/>${(PIPS[v]||[]).map(k=>`<circle cx="${[8,15,22][(k-1)%3]}" cy="${[8,15,22][Math.floor((k-1)/3)]}" r="${v===1?4.2:2.8}" fill="${v===1?'#cc3a2e':'#2a2118'}"/>`).join('')}</svg>`;
const ICON={s:'<svg viewBox="0 0 40 40" class="sl-ic"><path d="M8 33c6 0 6-7 12-7s6 7 12 7M20 26c-6 0-8-5-4-9s9-3 9-9" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><circle cx="25" cy="7" r="4.5" fill="currentColor"/></svg>',
  l:'<svg viewBox="0 0 40 40" class="sl-ic"><path d="M12 4v32M28 4v32M12 10h16M12 18h16M12 26h16M12 34h16" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>'};
const CARD_IC={swap:'<svg viewBox="0 0 40 40" class="sl-ic"><path d="M8 14h22l-6-6M32 26H10l6 6" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  shield:'<svg viewBox="0 0 40 40" class="sl-ic"><path d="M20 4l13 5c0 14-5 22-13 27C12 31 7 23 7 9z" fill="currentColor"/></svg>',
  more:'<svg viewBox="0 0 40 40" class="sl-ic"><rect x="4" y="10" width="20" height="20" rx="4" fill="none" stroke="currentColor" stroke-width="3.5"/><circle cx="14" cy="20" r="2.6" fill="currentColor"/><path d="M31 13v14M24 20h14" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>',
  walk:'<svg viewBox="0 0 40 40" class="sl-ic"><circle cx="9" cy="28" r="4" fill="currentColor"/><circle cx="20" cy="20" r="4" fill="currentColor" opacity=".7"/><circle cx="31" cy="12" r="4" fill="currentColor" opacity=".45"/></svg>',
  snake:ICON.s};
const XIC={rg:'+2',im:'<svg viewBox="0 0 40 40" class="sl-ic"><path d="M20 4l13 5c0 14-5 22-13 27C12 31 7 23 7 9z" fill="currentColor"/></svg>',ex:'<svg viewBox="0 0 40 40" class="sl-ic"><path d="M13 18v-5a7 7 0 0 1 14 0v5" fill="none" stroke="currentColor" stroke-width="4"/><rect x="9" y="18" width="22" height="17" rx="3" fill="currentColor"/></svg>'};
G.handMarks=()=>{};
G.me=()=>{$('#numpick').hidden=true};
G.play=()=>{};
G.pass=()=>{};
G.keyPhase=st=>st==='play';
G.onKey=(act,e)=>{
  if(!O_()||V.cfg.game!=='snakes')return false;
  if(act==='yroll'){if(!e.repeat)holdStart('key');return true}   // 컵 키(야추다이스 굴리기 키와 같음): 누르는 동안 흔들고 떼면 던짐
  return false;
};
G.preView=()=>{};
G.buttons=()=>{$('#btnGura').hidden=true;$('#btnPlay').disabled=true;$('#btnPass').disabled=true};
G.logCue=()=>false;
G.cues=(v,pv)=>{
  const a=v.sl,b=pv&&pv.sl;if(!a||!b||a.gn!==b.gn)return;
  for(const e of a.ev)if(e.sn>b.sq){
    if(e.k==='p'){if(e.s!==myIdx())sfx('play',1)}
    else if(e.k==='d'){if(e.s!==myIdx())sfx('lift')}
    else if(e.k==='go')sfx('turn');
    else if(e.k==='a'&&e.c!=='shield'){sfx('special');fxSay(`${nameOf(e.s)} · ${CARD[e.c].n}`,SEAT_C[e.s%4])}   // 방패는 뱀에 닿는 순간 알림
  }
};
G.nameTag=()=>'';

/* ---------- 주사위 물리 (화면 연출용, THREE 없이 숫자만 씀) ----------
   야추다이스의 물리를 이 판에 맞게 옮김: 판 윗면이 바닥, 판 가장자리가 보이지 않는 벽(닿으면 멈춤).
   눈은 방장이 정하고, 물리는 던지는 모습만 만듦(떨어진 자세에서 위를 보는 면에 정해진 눈이 오도록 무늬를 미리 돌림).
   던지는 모습은 방장이 정한 씨앗(seed)으로 모두 같게 시작 */
const BW=5,BH=BW/2,BT=.1,GAP=.16;   // 판 폭, 반, 윗면 높이, 줄 사이 간격(칸 높이의 비율)
/* 판 깊이: 칸 N줄 + 줄 사이 간격 N-1개 (번호가 이어지는 칸끼리만 붙음: 줄 끝의 꺾이는 곳은 다리로 이음) */
let HD=BH,AX=BH-.04,AZ=BH-.04;   // 판 깊이의 반, 주사위가 넘지 못하는 판 가장자리(x·z)
function setGeo(N){const cs=BW/N;HD=(N*cs+(N-1)*cs*GAP)/2;AX=BH-.04;AZ=HD-.04}
setGeo(10);
const DS=.42,DH=DS/2,DRAD=.06,DIN=DH-DRAD,GRAV=-30;
const FACE_N={1:[0,1,0],6:[0,-1,0],2:[0,0,1],5:[0,0,-1],3:[1,0,0],4:[-1,0,0]};
const qmul=(a,b)=>[a[0]*b[3]+a[3]*b[0]+a[1]*b[2]-a[2]*b[1],a[1]*b[3]+a[3]*b[1]+a[2]*b[0]-a[0]*b[2],a[2]*b[3]+a[3]*b[2]+a[0]*b[1]-a[1]*b[0],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
function qrot(q,v){const x=q[0],y=q[1],z=q[2],w=q[3];const ix=w*v[0]+y*v[2]-z*v[1],iy=w*v[1]+z*v[0]-x*v[2],iz=w*v[2]+x*v[1]-y*v[0],iw=-x*v[0]-y*v[1]-z*v[2];return [ix*w+iw*-x+iy*-z-iz*-y,iy*w+iw*-y+iz*-x-ix*-z,iz*w+iw*-z+ix*-y-iy*-x]}
function qnorm(q){const l=Math.hypot(q[0],q[1],q[2],q[3])||1;return [q[0]/l,q[1]/l,q[2]/l,q[3]/l]}
function qFromUnit(a,b){let r=a[0]*b[0]+a[1]*b[1]+a[2]*b[2]+1,x,y,z;if(r<1e-6){r=0;if(Math.abs(a[0])>Math.abs(a[2])){x=-a[1];y=a[0];z=0}else{x=0;y=-a[2];z=a[1]}}else{x=a[1]*b[2]-a[2]*b[1];y=a[2]*b[0]-a[0]*b[2];z=a[0]*b[1]-a[1]*b[0]}return qnorm([x,y,z,r])}
function topFace(q){let best=1,by=-9;for(let v=1;v<=6;v++){const y=qrot(q,FACE_N[v])[1];if(y>by){by=y;best=v}}return best}
const preRot=(q,want)=>qFromUnit(FACE_N[want],FACE_N[topFace(q)]);
function mulberry(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
/* 던지기 시작: from(판 가장자리 안쪽, 던지는 사람 쪽)에서 dir(판 가운데 쪽)으로 */
function throwStarts(n,from,dir,rnd){
  const side=[-dir[2],0,dir[0]],out=[];
  for(let k=0;k<n;k++){
    const l=(k-(n-1)/2)*.32+(rnd()-.5)*.2,p=[from[0]+side[0]*l,from[1]+(rnd()-.5)*.1,from[2]+side[2]*l];
    const sp=2.4+rnd()*1.3,lat=(rnd()-.5)*1.2,v=[dir[0]*sp+side[0]*lat,.6+rnd()*1.2,dir[2]*sp+side[2]*lat];
    const wl=12+rnd()*12,wa=[rnd()-.5,rnd()-.5,rnd()-.5],wn=Math.hypot(...wa)||1;
    out.push({p,v,q:qnorm([rnd()-.5,rnd()-.5,rnd()-.5,rnd()-.5]),w:wa.map(x=>x/wn*wl),t0:k*.06});
  }
  return out;
}
function simThrow(starts){
  const n=starts.length,dt=1/240,INV=6/(DS*DS),MU=.45,RS=DH*1.06;
  const B=starts.map(s=>({p:s.p.slice(),v:s.v.slice(),q:qnorm(s.q),w:s.w.slice(),fl:false,calm:0,lastHit:-1,t0:+s.t0||0}));
  let step=0;const out=b=>step*dt<b.t0;
  const Cn=[];for(const a of [-1,1])for(const b of [-1,1])for(const c of [-1,1])Cn.push([a*DIN,b*DIN,c*DIN]);
  const frames=[],hits=[];
  const rec=()=>{const f=new Float32Array(n*7);B.forEach((b,i)=>{f.set([b.p[0],b.p[1],b.p[2],b.q[0],b.q[1],b.q[2],b.q[3]],i*7)});frames.push(f)};
  const contact=(b,r,nx,ny,nz,pen,e)=>{
    const vpx=b.v[0]+b.w[1]*r[2]-b.w[2]*r[1],vpy=b.v[1]+b.w[2]*r[0]-b.w[0]*r[2],vpz=b.v[2]+b.w[0]*r[1]-b.w[1]*r[0];
    const vn=vpx*nx+vpy*ny+vpz*nz;
    if(vn<0){
      const rnx=r[1]*nz-r[2]*ny,rny=r[2]*nx-r[0]*nz,rnz=r[0]*ny-r[1]*nx;
      const k=1+INV*(rnx*rnx+rny*rny+rnz*rnz),j=-(1+(vn<-1.4?e:0))*vn/k;
      b.v[0]+=nx*j;b.v[1]+=ny*j;b.v[2]+=nz*j;b.w[0]+=INV*j*rnx;b.w[1]+=INV*j*rny;b.w[2]+=INV*j*rnz;
      const ux=b.v[0]+b.w[1]*r[2]-b.w[2]*r[1],uy=b.v[1]+b.w[2]*r[0]-b.w[0]*r[2],uz=b.v[2]+b.w[0]*r[1]-b.w[1]*r[0];
      const un=ux*nx+uy*ny+uz*nz,tx=ux-nx*un,ty=uy-ny*un,tz=uz-nz*un,tl=Math.hypot(tx,ty,tz);
      if(tl>1e-6){const ex=tx/tl,ey=ty/tl,ez=tz/tl,rtx=r[1]*ez-r[2]*ey,rty=r[2]*ex-r[0]*ez,rtz=r[0]*ey-r[1]*ex;
        const jt=Math.min(tl/(1+INV*(rtx*rtx+rty*rty+rtz*rtz)),MU*j);
        b.v[0]-=ex*jt;b.v[1]-=ey*jt;b.v[2]-=ez*jt;b.w[0]-=INV*jt*rtx;b.w[1]-=INV*jt*rty;b.w[2]-=INV*jt*rtz}
      if(-vn>1.6&&step-b.lastHit>10){b.lastHit=step;hits.push([step*dt,-vn])}
    }
    const c=Math.min(pen,.05)*.5;b.p[0]+=nx*c;b.p[1]+=ny*c;b.p[2]+=nz*c;
  };
  rec();
  const MAXS=Math.round(2.6/dt);
  for(;step<MAXS;step++){
    for(const b of B){if(out(b))continue;
      b.v[1]+=GRAV*dt;const wd=b.fl?1-3.2*dt:1-.35*dt,vd=b.fl?1-1.4*dt:1-.04*dt;
      b.w[0]*=wd;b.w[1]*=wd;b.w[2]*=wd;b.v[0]*=vd;b.v[2]*=vd;
      b.p[0]+=b.v[0]*dt;b.p[1]+=b.v[1]*dt;b.p[2]+=b.v[2]*dt;
      const dq=qmul([b.w[0],b.w[1],b.w[2],0],b.q);b.q=qnorm([b.q[0]+dq[0]*.5*dt,b.q[1]+dq[1]*.5*dt,b.q[2]+dq[2]*.5*dt,b.q[3]+dq[3]*.5*dt]);b.fl=false}
    for(let it=0;it<3;it++){
      for(const b of B){if(out(b))continue;
        for(const c of Cn){const r=qrot(b.q,c),px=b.p[0]+r[0],py=b.p[1]+r[1],pz=b.p[2]+r[2];
          const pf=BT+DRAD-py;if(pf>0){b.fl=true;contact(b,r,0,1,0,pf,.32)}
          if(px+DRAD>AX)contact(b,r,-1,0,0,px+DRAD-AX,0);if(px-DRAD<-AX)contact(b,r,1,0,0,-AX-(px-DRAD),0);
          if(pz+DRAD>AZ)contact(b,r,0,0,-1,pz+DRAD-AZ,0);if(pz-DRAD<-AZ)contact(b,r,0,0,1,-AZ-(pz-DRAD),0)}}
      for(let i=0;i<n;i++){const a=B[i];if(out(a))continue;
        for(let j=i+1;j<n;j++){const o=B[j];if(out(o))continue;
          const dx=o.p[0]-a.p[0],dy=o.p[1]-a.p[1],dz=o.p[2]-a.p[2],d=Math.hypot(dx,dy,dz);if(d>=RS*2||d<1e-6)continue;
          const nx=dx/d,ny=dy/d,nz=dz/d,pen=RS*2-d,rv=(o.v[0]-a.v[0])*nx+(o.v[1]-a.v[1])*ny+(o.v[2]-a.v[2])*nz;
          if(rv<0){const jj=-1.35*rv/2;a.v[0]-=nx*jj;a.v[1]-=ny*jj;a.v[2]-=nz*jj;o.v[0]+=nx*jj;o.v[1]+=ny*jj;o.v[2]+=nz*jj;if(-rv>1.6&&step-a.lastHit>10){a.lastHit=step;hits.push([step*dt,-rv*.8])}}
          const m=pen/2;a.p[0]-=nx*m;a.p[1]-=ny*m;a.p[2]-=nz*m;o.p[0]+=nx*m;o.p[1]+=ny*m;o.p[2]+=nz*m}}
    }
    let all=true;for(const b of B){const calm=!out(b)&&b.fl&&Math.hypot(...b.v)<.08&&Math.hypot(...b.w)<.7;b.calm=calm?b.calm+1:0;if(b.calm<20)all=false}
    if(step%4===3)rec();
    if(all)break;
  }
  rec();
  /* 다 멈추지 않았으면 마지막에 가장 가까운 면으로 눕힘 (화면에서 짧게 이어 붙임) */
  return {frames,hits,fin:B.map(b=>b.q.slice()),pos:B.map(b=>b.p.slice()),dur:frames.length/60};
}
G._test.simThrow=simThrow;G._test.throwStarts=throwStarts;

/* ---------- 3D ----------
   판은 탁자 가운데 나무판(모든 사람에게 같은 방향: 1이 아래 왼쪽). 컵은 자리마다 판 가장자리 밖(나는 아래).
   카메라는 내 자리에서 비스듬히(58°) 내려다보며 판이 화면 가운데에 꽉 차게(자리를 정할 때만 계산) */
const S3={built:false,fail:false,on:false,root:null,cam:null,lay:'',d:12,board:null,top:null,ovl:null,items:new Map(),pawns:[],cups:[],dice:[],ring:null,N:0,gn:-1,boardKey:'',ovKey:'',mvId:-1,sim:null,lastId:-1,hitKey:'',lastHop:-1,fallAt:0,slideSnd:''};
const HOLD={on:false,src:'',at:0,relAt:0,rid:-1};
const ez=k=>k<=0?0:k>=1?1:k*k*(3-2*k);
const lerp=(a,b,k)=>a+(b-a)*k;
const CAM_TILT=58*Math.PI/180;
const csOf=N=>BW/N;
const rowZ=(r,N)=>{const cs=csOf(N);return HD-r*cs*(1+GAP)-cs/2};
function cellXZ(c,N){const cs=csOf(N),r=rowOf(c,N),col=colOf(c,N);return [-BH+(col+.5)*cs,rowZ(r,N)]}
/* 컵 자리: 그 사람 방향으로 판 가장자리 밖 */
function cupXZ(i){const a=seatAngle(i),dx=Math.sin(a),dz=Math.cos(a),s=Math.min(Math.abs(dx)>1e-6?(BH+.72)/Math.abs(dx):1e9,Math.abs(dz)>1e-6?(HD+.72)/Math.abs(dz):1e9);return [dx*s,dz*s]}
function roundBox(s,r,seg){
  const g=new THREE.BoxGeometry(s,s,s,seg,seg,seg),pa=g.attributes.position,na=g.attributes.normal,h=s/2-r;
  for(let k=0;k<pa.count;k++){const x=pa.getX(k),y=pa.getY(k),z=pa.getZ(k);const cx=clamp(x,-h,h),cy=clamp(y,-h,h),cz=clamp(z,-h,h);let nx=x-cx,ny=y-cy,nz=z-cz;const l=Math.hypot(nx,ny,nz);
    if(l<1e-9){nx=na.getX(k);ny=na.getY(k);nz=na.getZ(k)}else{nx/=l;ny/=l;nz/=l}pa.setXYZ(k,cx+nx*r,cy+ny*r,cz+nz*r);na.setXYZ(k,nx,ny,nz)}
  pa.needsUpdate=na.needsUpdate=true;return g;
}
function pipTex(v){
  return canvasTex(128,128,(g,w,h)=>{
    g.fillStyle='#fbf3e0';g.fillRect(0,0,w,h);
    const gr=g.createRadialGradient(w/2,h/2,w*.32,w/2,h/2,w*.74);gr.addColorStop(0,'rgba(120,90,50,0)');gr.addColorStop(1,'rgba(120,90,50,.2)');g.fillStyle=gr;g.fillRect(0,0,w,h);
    const P=[.26,.5,.74],R=v===1?w*.135:w*.088;
    for(const k of PIPS[v]||[]){g.fillStyle=v===1?'#cc3a2e':'#2a2118';g.beginPath();g.arc(P[(k-1)%3]*w,P[Math.floor((k-1)/3)]*h,R,0,7);g.fill()}
  });
}
function build(){
  if(S3.built||S3.fail)return S3.built;
  if(!T.ok||typeof THREE==='undefined'){S3.fail=true;return false}
  try{
    const root=new THREE.Group();root.visible=false;T.scene.add(root);S3.root=root;
    S3.cam=new THREE.PerspectiveCamera(40,1,.1,100);
    const ink=new THREE.MeshBasicMaterial({color:GFX_INK,side:THREE.BackSide});S3.ink=ink;
    /* 판: 나무 받침 + 윗면 그림(칸·번호) + 설치할 때 칸을 밝히는 덧그림 */
    const base=new THREE.Mesh(new THREE.BoxGeometry(1,BT,1),toon({color:0x9a6a3c,rim:.15}));base.position.y=BT/2;base.receiveShadow=true;base.castShadow=true;
    const bo=new THREE.Mesh(base.geometry,ink);bo.position.y=BT/2;
    const bc=document.createElement('canvas');bc.width=bc.height=1024;const bt=new THREE.CanvasTexture(bc);bt.anisotropy=8;
    const top=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:bt,transparent:true}));top.rotation.x=-Math.PI/2;top.position.y=BT+.001;top.receiveShadow=true;
    const oc=document.createElement('canvas');oc.width=oc.height=512;const ot=new THREE.CanvasTexture(oc);
    const ov=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:ot,transparent:true,depthWrite:false}));ov.rotation.x=-Math.PI/2;ov.position.y=BT+.004;ov.renderOrder=3;ov.visible=false;
    const bg=new THREE.Group();bg.add(base,bo,top,ov);root.add(bg);
    S3.board=bg;S3.top={c:bc,t:bt,m:top,base,bo};S3.ovl={c:oc,t:ot,m:ov};
    /* 주사위 */
    const dg=roundBox(1,.15,6),mats=[3,4,1,6,2,5].map(v=>toon({map:pipTex(v),rim:.12}));
    S3.mkDie=()=>{const g=new THREE.Group(),a=new THREE.Mesh(dg,mats),o=new THREE.Mesh(dg,ink);o.scale.setScalar(1.07);a.castShadow=true;g.add(a,o);g.scale.setScalar(DS);g.visible=false;root.add(g);return g};
    /* 컵 (구라! 다이스·야추다이스와 같은 가죽 컵) */
    const V2=(x,y)=>new THREE.Vector2(x,y);
    const prof=[V2(0,0),V2(.47,0),V2(.5,.05),V2(.58,.97),V2(.62,1),V2(.6,1.03),V2(.54,1.02),V2(.46,.14),V2(0,.14)];
    const lm=toon({color:0x6e3b22,rim:.22});lm.side=THREE.DoubleSide;
    const bodyG=new THREE.LatheGeometry(prof,40),hullG=new THREE.LatheGeometry(prof.slice(0,6).map(v=>V2(v.x+.035,v.y-.02)),40);
    const b1G=new THREE.TorusGeometry(.57,.045,8,40),b2G=new THREE.TorusGeometry(.5,.035,8,40),b2M=toon({color:0xd9a441,rim:.2});
    S3.mkCup=col=>{
      const g=new THREE.Group(),inner=new THREE.Group();
      const body=new THREE.Mesh(bodyG,lm);body.castShadow=true;
      const b1=new THREE.Mesh(b1G,toon({color:new THREE.Color(col).getHex(),rim:.2}));b1.rotation.x=Math.PI/2;b1.position.y=.84;
      const b2=new THREE.Mesh(b2G,b2M);b2.rotation.x=Math.PI/2;b2.position.y=.13;
      const gl=new THREE.Mesh(hullG,new THREE.MeshBasicMaterial({color:0xffa53a,side:THREE.BackSide,transparent:true,opacity:0,depthWrite:false}));gl.scale.set(1.09,1.03,1.09);gl.visible=false;g.userData.glow=gl;
      inner.add(body,new THREE.Mesh(hullG,ink),gl,b1,b2);inner.scale.setScalar(.78);g.add(inner);g.visible=false;root.add(g);return g;
    };
    /* 말: 둥근 받침 + 몸통 + 머리 (자리 색) */
    const pp=[V2(0,0),V2(.36,0),V2(.38,.06),V2(.3,.12),V2(.17,.2),V2(.13,.5),V2(.2,.56),V2(.12,.6),V2(0,.6)];
    const pawnG=new THREE.LatheGeometry(pp,28),headG=new THREE.SphereGeometry(.17,20,14);
    S3.mkPawn=col=>{
      const g=new THREE.Group(),m=toon({color:new THREE.Color(col).getHex(),rim:.25});
      const b=new THREE.Mesh(pawnG,m),h=new THREE.Mesh(headG,m);h.position.y=.72;b.castShadow=h.castShadow=true;
      const bo2=new THREE.Mesh(pawnG,ink),ho=new THREE.Mesh(headG,ink);bo2.scale.setScalar(1.08);ho.scale.setScalar(1.12);ho.position.y=.72;
      g.add(b,h,bo2,ho);g.visible=false;root.add(g);return g;
    };
    /* 차례 고리: 차례인 사람의 컵 밑 */
    {const rt=canvasTex(256,256,(g,w,h)=>{const gr=g.createRadialGradient(w/2,h/2,w*.2,w/2,h/2,w*.5);gr.addColorStop(0,'rgba(255,255,255,0)');gr.addColorStop(.62,'rgba(255,255,255,.9)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,w,h)});
     const m=new THREE.Mesh(new THREE.PlaneGeometry(1.5,1.5),new THREE.MeshBasicMaterial({map:rt,transparent:true,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.y=.012;m.renderOrder=1;m.visible=false;root.add(m);S3.ring=m}
    S3.built=true;
  }catch(e){S3.fail=true;try{console.warn('뱀 사다리 3D 준비 실패',e)}catch(_){}}
  return S3.built;
}
const cupOf=i=>S3.cups[i]||(S3.cups[i]=S3.mkCup(SEAT_C[i%4]));
const pawnOf=i=>S3.pawns[i]||(S3.pawns[i]=S3.mkPawn(SEAT_C[i%4]));
const dieOf=k=>S3.dice[k]||(S3.dice[k]=S3.mkDie());
/* 판 그림: 칸 무늬·번호, 출발·도착 */
/* 칸 그림 좌표(캔버스, 위가 먼 쪽): 줄 사이 간격 포함 */
const boxOf=(c,N,cs)=>[colOf(c,N)*cs,(N-1-rowOf(c,N))*cs*(1+GAP)];
function canvasFor(c,N,W){const h=Math.round(W*2*HD/BW);if(c.width!==W||c.height!==h){c.width=W;c.height=h}return h}
/* 꺾이는 곳: 줄 r의 끝 칸과 줄 r+1의 첫 칸은 같은 칸 열(짝수 줄은 오른쪽 끝, 홀수 줄은 왼쪽 끝)에서 간격의 절반씩 늘어나 맞닿음 */
const turnCol=(r,N)=>r%2?0:N-1;
function cellRect(c,N,cs,gp){
  const r=rowOf(c,N),col=colOf(c,N);let x=col*cs,y=(N-1-r)*(cs+gp),h=cs;
  if(r<N-1&&col===turnCol(r,N)){y-=gp/2;h+=gp/2}
  if(r>0&&col===turnCol(r-1,N))h+=gp/2;
  return [x,y,cs,h];
}
/* 공통 rr은 beginPath를 해서 여러 모양을 한 경로로 합칠 수 없음 → 하위 경로만 더하는 둥근 사각형 (같은 시계 방향이라 겹치면 합쳐짐) */
function rrSub(g,x,y,w,h,r){g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath()}
/* 판 모양: 줄마다 둥근 띠 + 꺾이는 곳을 잇는 칸 열 (subpath를 합쳐 하나의 리본) */
function ribbonPath(g,N,W,cs,gp,e){
  const rad=cs*.16;
  for(let r=0;r<N;r++){const y=(N-1-r)*(cs+gp);rrSub(g,3-e,y+2-e,W-6+2*e,cs-4+2*e,rad+e)}
  for(let r=0;r<N-1;r++){const col=turnCol(r,N),x0=col?col*cs:3,x1=col?W-3:cs,yT=(N-2-r)*(cs+gp)+cs-2-rad,yB=(N-1-r)*(cs+gp)+2+rad;g.rect(x0-e,yT,x1-x0+2*e,yB-yT)}
}
/* 판 그림: 번호가 이어지는 칸끼리만 붙은 지그재그 리본 하나 (줄 사이는 비어서 나무가 보임) */
function drawBoard(N){
  const c=S3.top.c,W=1024,Hc=canvasFor(c,N,W),g=c.getContext('2d'),cs=W/N,gp=cs*GAP;
  g.clearRect(0,0,W,Hc);
  g.fillStyle='#4a3020';g.beginPath();ribbonPath(g,N,W,cs,gp,6);g.fill();   // 테두리: 조금 큰 리본을 먼저 칠함
  g.save();g.beginPath();ribbonPath(g,N,W,cs,gp,0);g.clip();
  for(let c2=1;c2<=N*N;c2++){
    const r=rowOf(c2,N),col=colOf(c2,N),[x,y,w,h]=cellRect(c2,N,cs,gp),y0=(N-1-r)*(cs+gp);
    g.fillStyle=(r+col)%2?'#f4e4c2':'#e7c996';if(c2===1)g.fillStyle='#bfe0a8';if(c2===N*N)g.fillStyle='#ffd36a';
    g.fillRect(x,y,w,h);
    g.strokeStyle='rgba(74,48,32,.3)';g.lineWidth=2;
    if(col){g.beginPath();g.moveTo(x,y0);g.lineTo(x,y0+cs);g.stroke()}
    if(r<N-1&&col===turnCol(r,N)){g.beginPath();g.moveTo(x,y);g.lineTo(x+w,y);g.stroke()}   // 맞닿은 두 칸의 경계
    g.fillStyle='rgba(74,48,32,.78)';g.font=`600 ${Math.round(cs*.26)}px "IBM Plex Mono", "Jua", monospace`;g.textAlign='left';g.textBaseline='top';g.fillText(String(c2),x+cs*.1,y0+cs*.08);
    if(c2===1||c2===N*N){g.fillStyle=c2===1?'#2f6b22':'#9a5a00';g.font=`${Math.round(cs*.27)}px "Jua", sans-serif`;g.textAlign='center';g.textBaseline='bottom';g.fillText(c2===1?'출발':'도착',x+cs/2,y0+cs*.94)}
    if(c2===N*N){g.save();g.translate(x+cs*.68,y0+cs*.36);g.fillStyle='#e08a00';g.beginPath();for(let k=0;k<10;k++){const r2=k%2?cs*.07:cs*.16,a=k*Math.PI/5;g.lineTo(Math.sin(a)*r2,-Math.cos(a)*r2)}g.fill();g.restore()}
  }
  g.restore();
  S3.top.t.needsUpdate=true;
  /* 판 크기: 받침·윗면·덧그림을 이 깊이로 */
  const D=2*HD;S3.top.base.scale.set(BW+.26,1,D+.26);S3.top.bo.scale.set(BW+.32,1.25,D+.32);S3.top.m.scale.set(BW,D,1);S3.ovl.m.scale.set(BW,D,1);
}
/* 설치 덧그림: 고른 끝(내 색 고리), 놓을 수 있는 다른 끝(초록), 거둘 수 있는 내 끝(작은 점) */
function drawOverlay(o,me){
  const L=S3.ovl,N=o.cf.N,pl=placing(),on=!!pl;
  const ends=on&&SEL.a?endsFor(o.items,o.cf,pl==='snake'?'s':SEL.k,SEL.a,pl==='setup'?SEL.x:''):[];
  const mine=pl==='setup'?o.items.filter(it=>it.o===me):[];
  const key=[pl,SEL.k,SEL.a,SEL.x,ends.join(','),mine.map(it=>it.a+'-'+it.b).join(','),N].join('|');
  if(key===S3.ovKey)return;S3.ovKey=key;
  L.m.visible=on&&(!!SEL.a||mine.length>0);
  const W=512,Hc=canvasFor(L.c,N,W),g=L.c.getContext('2d'),cs=W/N;g.clearRect(0,0,W,Hc);
  if(!L.m.visible){L.t.needsUpdate=true;return}
  const box=c=>boxOf(c,N,cs);
  for(const b of ends){const [x,y]=box(b);g.fillStyle='rgba(70,200,90,.42)';g.fillRect(x+2,y+2,cs-4,cs-4);g.strokeStyle='rgba(40,150,60,.9)';g.lineWidth=3;g.strokeRect(x+3,y+3,cs-6,cs-6)}
  for(const it of mine)for(const c of [it.a,it.b]){const [x,y]=box(c);g.fillStyle='rgba(255,255,255,.9)';g.beginPath();g.arc(x+cs*.82,y+cs*.82,cs*.09,0,7);g.fill();g.strokeStyle=SEAT_C[me%4];g.lineWidth=3;g.stroke()}
  if(SEL.a){const [x,y]=box(SEL.a);g.strokeStyle=SEAT_C[me%4];g.lineWidth=Math.max(5,cs*.1);g.strokeRect(x+cs*.06,y+cs*.06,cs*.88,cs*.88)}
  L.t.needsUpdate=true;
}
/* 뱀 곡선: 머리 a → 꼬리 b, 옆으로 S자로 굽음 (말이 미끄러질 때도 같은 곡선) */
const ITEM_Y=BT+.04;   // 뱀·사다리는 판에 낮게 붙여 눕힘 (말 발밑으로 지나가 보이게)
function snakePts(a,b,N){
  const [ax,az]=cellXZ(a,N),[bx,bz]=cellXZ(b,N),dx=bx-ax,dz=bz-az,L=Math.hypot(dx,dz)||1,nx=-dz/L,nz=dx/L;
  const amp=Math.min(.42,.1+L*.06)*Math.min(1.2,csOf(N)/.5+.2),wav=Math.max(1,Math.round(L/1.3)),P=[];
  for(let k=0;k<=40;k++){const t=k/40,w=Math.sin(t*Math.PI*2*wav*.5+.0)*Math.sin(Math.PI*t)*amp;P.push(new THREE.Vector3(ax+dx*t+nx*w,ITEM_Y+.012,az+dz*t+nz*w))}
  return P;
}
function stripeTex(col){
  return canvasTex(128,32,(g,w,h)=>{const c=new THREE.Color(col);g.fillStyle='#'+c.getHexString();g.fillRect(0,0,w,h);
    const l=c.clone().lerp(new THREE.Color('#fff4d6'),.55);g.fillStyle='#'+l.getHexString();for(let k=0;k<4;k++){g.beginPath();g.moveTo(k*32+6,0);g.lineTo(k*32+18,0);g.lineTo(k*32+12,h);g.lineTo(k*32,h);g.fill()}
    g.fillStyle='rgba(0,0,0,.18)';g.fillRect(0,h*.82,w,h*.18)});
}
/* 설치 능력 표시: 시작 끝 칸 오른쪽 위에 작은 둥근 딱지 (사거리 +2 · 면역 방패 · 전용 자물쇠) */
const BADGE={};
function badgeTex(x,col){
  const key=x+col;if(BADGE[key])return BADGE[key];
  return BADGE[key]=canvasTex(128,128,(g,w,h)=>{g.clearRect(0,0,w,h);g.fillStyle='#fffaf0';g.beginPath();g.arc(64,64,58,0,7);g.fill();g.lineWidth=10;g.strokeStyle=col;g.stroke();
    g.fillStyle=col;g.strokeStyle=col;
    if(x==='rg'){g.font='700 58px "IBM Plex Mono", monospace';g.textAlign='center';g.textBaseline='middle';g.fillText('+2',64,68)}
    else if(x==='im'){g.beginPath();g.moveTo(64,24);g.lineTo(96,36);g.quadraticCurveTo(96,84,64,104);g.quadraticCurveTo(32,84,32,36);g.closePath();g.fill()}
    else{g.lineWidth=11;g.beginPath();g.arc(64,52,18,Math.PI,0);g.stroke();rr(g,36,52,56,46,8);g.fill()}});
}
function badge(x,c,N,o){
  const cs=csOf(N),[cx,cz]=cellXZ(c,N),m=new THREE.Mesh(new THREE.PlaneGeometry(cs*.46,cs*.46),new THREE.MeshBasicMaterial({map:badgeTex(x,SEAT_C[o%4]),transparent:true,depthWrite:false}));
  m.rotation.x=-Math.PI/2;m.position.set(cx+cs*.3,ITEM_Y+.12,cz-cs*.3);m.renderOrder=6;return m;
}
function mkSnake(it,N){
  const g=new THREE.Group(),col=SEAT_C[it.o%4],k=Math.min(1.25,Math.max(.75,csOf(N)/.5));
  const P=snakePts(it.a,it.b,N),curve=new THREE.CatmullRomCurve3(P),rad=.07*k;
  const tex=stripeTex(col);tex.wrapS=THREE.RepeatWrapping;tex.repeat.set(Math.max(2,Math.round(curve.getLength()*3)),1);
  const tg=new THREE.TubeGeometry(curve,80,rad,10,false);
  /* 꼬리 쪽으로 가늘게: 관 단면을 길이에 따라 줄임 */
  {const pa=tg.attributes.position,seg=81,rs=11;for(let i=0;i<seg;i++){const t=i/(seg-1),s=.35+.65*Math.pow(1-t,.6)*(t<.04?.85+t*3.7:1),c=curve.getPointAt(Math.min(1,t));for(let j=0;j<rs;j++){const v=i*rs+j;if(v>=pa.count)break;pa.setXYZ(v,c.x+(pa.getX(v)-c.x)*s,c.y+(pa.getY(v)-c.y)*s,c.z+(pa.getZ(v)-c.z)*s)}}pa.needsUpdate=true;tg.computeVertexNormals()}
  const body=new THREE.Mesh(tg,toon({map:tex,rim:.2}));body.castShadow=true;g.add(body);
  const hm=toon({color:new THREE.Color(col).getHex(),rim:.25});
  const head=new THREE.Mesh(new THREE.SphereGeometry(rad*1.75,18,12),hm);head.scale.set(1.05,.62,1.35);
  const t0=curve.getTangentAt(0);head.position.copy(P[0]).addScaledVector(t0,-rad*.6);head.position.y+=rad*.45;   // 머리만 살짝 듦
  head.rotation.y=Math.atan2(-t0.x,-t0.z);head.castShadow=true;
  const ho=new THREE.Mesh(head.geometry,S3.ink);ho.scale.setScalar(1.1);head.add(ho);
  const eyeG=new THREE.SphereGeometry(rad*.55,10,8),eyeM=new THREE.MeshBasicMaterial({color:0xffffff}),pupM=new THREE.MeshBasicMaterial({color:0x111111});
  for(const sd of [-1,1]){const e=new THREE.Mesh(eyeG,eyeM);e.position.set(sd*rad*.95,rad*.9,rad*.7);const p=new THREE.Mesh(eyeG,pupM);p.scale.setScalar(.55);p.position.set(0,.25*rad,.32*rad);e.add(p);head.add(e)}
  const tg2=new THREE.Mesh(new THREE.ConeGeometry(rad*.25,rad*1.6,6),new THREE.MeshBasicMaterial({color:0xd03030}));tg2.rotation.x=Math.PI/2;tg2.position.set(0,-.1*rad,rad*2.4);head.add(tg2);
  g.add(head);if(it.x)g.add(badge(it.x,it.a,N,it.o));g.userData.curve=curve;return g;
}
function mkLadder(it,N){
  const g=new THREE.Group(),col=SEAT_C[it.o%4],k=Math.min(1.2,Math.max(.75,csOf(N)/.5));
  const [ax,az]=cellXZ(it.a,N),[bx,bz]=cellXZ(it.b,N),dx=bx-ax,dz=bz-az,L=Math.hypot(dx,dz)||1,nx=-dz/L,nz=dx/L,w=.13*k;
  const rail=toon({color:new THREE.Color(col).getHex(),rim:.22}),rung=toon({color:0xc89a5c,rim:.18});
  const bar=(x1,z1,x2,z2,r,m,y)=>{const l=Math.hypot(x2-x1,z2-z1),c=new THREE.Mesh(new THREE.CylinderGeometry(r,r,l,8),m);c.position.set((x1+x2)/2,y,(z1+z2)/2);c.rotation.order='YXZ';c.rotation.y=Math.atan2(x2-x1,z2-z1);c.rotation.x=Math.PI/2;c.castShadow=true;
    const o=new THREE.Mesh(c.geometry,S3.ink);o.scale.set(1.35,1.02,1.35);c.add(o);g.add(c)};
  for(const s of [-1,1])bar(ax+nx*w*s-dx/L*.12,az+nz*w*s-dz/L*.12,bx+nx*w*s+dx/L*.12,bz+nz*w*s+dz/L*.12,.028*k,rail,ITEM_Y+.012);
  const n=Math.max(2,Math.round(L/(.3*k)));for(let j=0;j<=n;j++){const t=j/n,x=ax+dx*t,z=az+dz*t;bar(x-nx*w,z-nz*w,x+nx*w,z+nz*w,.02*k,rung,ITEM_Y+.008)}
  if(it.x)g.add(badge(it.x,it.a,N,it.o));
  return g;
}
/* 놓인 뱀·사다리를 상태에 맞춤 (새로 생긴 것은 톡 솟아오름) */
function syncItems(o,now,first){
  const want=new Set();
  for(const it of o.items){const key=it.k+it.a+':'+it.b+':'+it.o+':'+o.cf.N;want.add(key);
    if(!S3.items.has(key)){const g=it.k==='s'?mkSnake(it,o.cf.N):mkLadder(it,o.cf.N);S3.root.add(g);S3.items.set(key,{g,born:first?-1e9:now,it})}}
  for(const [key,v] of S3.items)if(!want.has(key)){S3.root.remove(v.g);v.g.traverse(m=>{if(m.geometry&&m.geometry!==S3.ink)m.geometry.dispose();if(m.material&&m.material!==S3.ink&&m.material.map)m.material.map.dispose()});S3.items.delete(key)}
  /* 말이 설 빈 자리를 고르려고 뱀·사다리가 지나는 점을 모아 둠 (바뀔 때만) */
  const ik=[...want].sort().join('|');
  if(ik!==S3.ipKey){S3.ipKey=ik;S3.spot=new Map();const P=[],N=o.cf.N;
    for(const v of S3.items.values()){const it=v.it;
      if(it.k==='s')for(const q of snakePts(it.a,it.b,N))P.push(q.x,q.z);
      else{const [ax,az]=cellXZ(it.a,N),[bx,bz]=cellXZ(it.b,N),L=Math.hypot(bx-ax,bz-az)||1,nx=-(bz-az)/L,nz=(bx-ax)/L,w=.13*Math.min(1.2,Math.max(.75,csOf(N)/.5)),n=Math.ceil(L/.08);
        for(let j=0;j<=n;j++){const t=j/n,x=ax+(bx-ax)*t,z=az+(bz-az)*t;P.push(x+nx*w,z+nz*w,x-nx*w,z-nz*w,x,z)}}}
    S3.ipts=P}
  for(const v of S3.items.values()){const k=ez((now-v.born)/320),s=k<1?(.2+.8*k)+Math.sin(Math.PI*k)*.12:1;v.g.scale.set(1,s,1);v.g.position.y=k<1?(1-k)*.25:0}
}
/* 굴림 연출 상태 (상태가 오면 시각 기준을 잡음) */
function simFor(m){
  if(S3.sim&&S3.sim.id===m.id)return S3.sim;
  /* 던지는 방향: 컵에서 판 가운데 쪽, 시작: 기울어진 컵 입구(판 가장자리 안쪽) (보는 사람마다 컵 자리가 달라 떨어지는 곳은 다를 수 있고, 눈은 같음) */
  const rnd=mulberry(m.seed),[cx,cz]=cupXZ(m.s),len=Math.hypot(cx,cz)||1,ux=-cx/len,uz=-cz/len,from=[cx+ux*CUP_MOUTH,BT+DH+.12,cz+uz*CUP_MOUTH];
  from[0]=clamp(from[0],-(AX-DH-.05),AX-DH-.05);from[2]=clamp(from[2],-(AZ-DH-.05),AZ-DH-.05);
  const r=simThrow(throwStarts(m.d.length,from,[ux,0,uz],rnd));
  r.rot=r.fin.map((q,k)=>preRot(q,m.d[k]));r.id=m.id;r.d=m.d.slice();r.s=m.s;r.hitAt=0;
  r.rate=Math.max(1,r.dur/((MV.throw-450)/1000));   // 오래 구르면 빨리 재생해서 말이 걷기 전에 멈추게
  S3.sim=r;return r;
}
/* 상태가 오면 시각 기준을 잡음 (3D·2D 모두) */
function syncMv(o){
  const now=clock();
  if(o.gn!==S3.gn){S3.gn=o.gn;S3.boardKey='';S3.ovKey='';S3.sim=null;S3.mvId=-1;SEL.a=0;S3.dk=null;S3.ipKey='';
    for(const v2 of S3.items.values())if(S3.root)S3.root.remove(v2.g);S3.items.clear();S3.first=true}
  if(o.sw&&S3.swId!==o.sw.id){S3.swId=o.sw.id;S3.swT0=now-(o.sw.el||0)}
  if(o.mv&&S3.mvId!==o.mv.id){S3.mvId=o.mv.id;S3.mvT0=now-(o.mv.el||0);S3.lastHop=-1;S3.slideSnd='';
    if(o.mv.s===myIdx()&&HOLD.relAt&&now-HOLD.relAt<1500)S3.mvT0=Math.min(S3.mvT0,HOLD.relAt+60)}   // 내가 던진 것은 손을 뗀 순간부터
}
G.field3D=(v)=>{
  if(T.stacks)for(const arr of T.stacks.values())arr.forEach(c=>{c.visible=false});
  if(v.sl)syncMv(v.sl);
};
/* 말이 지금 서 있는 곳 (연출 중이면 걷는 중) */
function pawnSpot(o,i,now){
  const N=o.cf.N,m=o.mv;
  /* 자리 바꾸기: 두 말이 서로의 칸으로 포물선을 그리며 건너감 */
  const sw=o.sw;
  if(sw&&(i===sw.a||i===sw.b)&&now-S3.swT0<SW_MS&&!(m&&m.s===i&&now-S3.mvT0>MV.walk0)){
    const f=ez((now-S3.swT0)/SW_MS),A=cellXZ(i===sw.a?sw.ca:sw.cb,N),B=cellXZ(i===sw.a?sw.cb:sw.ca,N);
    return {c:o.pos[i],p:[lerp(A[0],B[0],f),Math.sin(Math.PI*f)*.9,lerp(A[1],B[1],f)],moving:true};
  }
  if(m&&m.s===i){
    const e=now-S3.mvT0,n=m.path.length,hop0=m.nt?MV.walk0:MV.throw;
    if(e<hop0)return {c:m.from,p:null};
    const k=(e-hop0)/MV.step;
    if(k<n){const j=Math.floor(k),f=k-j,A=spotXZ(j?m.path[j-1]:m.from,N),B=spotXZ(m.path[j],N),t=ez(Math.min(1,f*1.25));
      if(j!==S3.lastHop){S3.lastHop=j;tone(520+j*35,.05,{type:'triangle',vol:.1})}
      return {c:m.path[j],p:[lerp(A[0],B[0],t),Math.sin(Math.PI*Math.min(1,f*1.25))*.32,lerp(A[1],B[1],t)],moving:true}}
    const land=n?m.path[n-1]:m.from;
    if(m.via){
      const sl=m.via.k==='l'?MV.ladder:MV.snake,e2=e-hop0-n*MV.step-90,f=e2/(sl-90);
      if(f<=0)return {c:land,p:null};
      if(f<1){
        if(S3.slideSnd!==m.id+':'+m.via.k){S3.slideSnd=m.id+':'+m.via.k;if(m.via.k==='l')[523,659,784,1047].forEach((fq,k2)=>tone(fq,.12,{type:'triangle',vol:.1,at:k2*.15}));else{tone(700,.9,{type:'sine',vol:.09,slide:180});hiss(.8,{freq:1400,sweep:500,q:.8,vol:.07})}}
        const t=m.via.k==='l'?ez(f):f*f*(3-2*f);
        if(m.via.k==='l'){const A=cellXZ(m.via.a,N),B=cellXZ(m.via.b,N);return {c:m.via.b,p:[lerp(A[0],B[0],t),.12+Math.sin(Math.PI*t)*.1,lerp(A[1],B[1],t)],moving:true}}
        const v=S3.items.size?[...S3.items.values()].find(x=>x.it.k==='s'&&x.it.a===m.via.a&&x.it.b===m.via.b):null;
        if(v&&v.g.userData.curve){const q=v.g.userData.curve.getPointAt(Math.min(1,t));return {c:m.via.b,p:[q.x,.04,q.z],moving:true}}
        const A=cellXZ(m.via.a,N),B=cellXZ(m.via.b,N);return {c:m.via.b,p:[lerp(A[0],B[0],t),.04,lerp(A[1],B[1],t)],moving:true};
      }
      return {c:m.to,p:null};
    }
    if(m.blk&&e>hop0+n*MV.step+60){   // 방패: 뱀 머리에 닿는 순간 알림 (말은 그 자리)
      if(S3.blkSaid!==m.id){S3.blkSaid=m.id;sfx('special');const P=cellXZ(land,N),[sx,sy]=scrOf(new THREE.Vector3(P[0],.6,P[1]));fxSay(`${nameOf(i)} · 방패`,SEAT_C[i%4],{x:sx,y:sy})}
      const f=(e-hop0-n*MV.step)/MV.shield;if(f<1){const P=cellXZ(land,N);return {c:land,p:[P[0],Math.sin(Math.PI*Math.min(1,f*2))*.25,P[1]],moving:true}}
    }
    return {c:land,p:null};
  }
  return {c:o.pos[i],p:null};
}
/* 같은 칸의 말은 겹치지 않게 조금씩 비킴 */
/* 칸 안에서 말이 설 자리: 가운데와 네 모서리 중 그 칸을 지나는 뱀·사다리에서 먼 곳부터 (같은 칸이면 다음으로 먼 곳) */
const SPOTS=[[0,0],[-.26,-.24],[.26,-.24],[-.26,.24],[.26,.24]];
const spotXZ=(c,N)=>{const [x,z]=cellXZ(c,N),o=spotsFor(c,N)[0],cs=csOf(N);return [x+o[0]*cs,z+o[1]*cs]};
function spotsFor(c,N){
  let r=S3.spot&&S3.spot.get(c);if(r)return r;
  const cs=csOf(N),[cx,cz]=cellXZ(c,N),P=S3.ipts||[];
  const sc=SPOTS.map(([dx,dz],k)=>{const x=cx+dx*cs,z=cz+dz*cs;let m=9;for(let j=0;j<P.length;j+=2){const d=Math.hypot(P[j]-x,P[j+1]-z);if(d<m)m=d}return {k,x:dx,z:dz,d:Math.min(m,cs*.5)+(k?0:cs*.04)}});
  r=sc.sort((a,b)=>b.d-a.d).map(o=>[o.x,o.z]);if(S3.spot)S3.spot.set(c,r);return r;
}
const SHK={w:28.5,A:.16,y0:.4};
const sndRattle=v=>{tone(650+Math.random()*700,.025,{type:'triangle',vol:.06*v});hiss(.025,{freq:2600,q:1.5,vol:.05*v})};
const sndHit=v=>{tone(900+Math.random()*500,.03,{type:'triangle',vol:Math.min(.12,.03*v)});hiss(.03,{freq:2600,q:1.2,vol:Math.min(.1,.025*v)})};
/* 컵 자세: 쉼(세움) · 흔들기(들어 대각선으로) · 던지기(판 쪽으로 기울임) */
function cupPose(i,now,o){
  const [x,z]=cupXZ(i),cp=new THREE.Vector3(x,0,z),q=new THREE.Quaternion();
  const len=Math.hypot(x,z)||1,ux=-x/len,uz=-z/len,ax=new THREE.Vector3(uz,0,-ux);   // 판 가운데 쪽으로 기울이는 축
  const me=i===myIdx(),m=o.mv&&o.mv.s===i?o.mv:null;
  if(m){const e=now-S3.mvT0;if(e<900&&!m.nt){const k=e<160?ez(e/160):e<520?1:1-ez((e-520)/380);q.setFromAxisAngle(ax,1.75*k);cp.y=.35*k;cp.x+=ux*.25*k;cp.z+=uz*.25*k}return {p:cp,q}}
  const sh=o.ph==='play'&&V.t===i&&!o.mv&&(me?HOLD.on:!!(o.shk&&o.shk[i]));
  if(sh){const st=(me?HOLD.at:S3.shAt[i])||now,tk=ez((now-st)/150),ph=now/1000*SHK.w+i*1.7,u=Math.sin(ph)*tk;
    cp.y=SHK.y0*tk+u*SHK.A*.9;cp.x+=ax.x*u*SHK.A*.5;cp.z+=ax.z*u*SHK.A*.5;q.setFromAxisAngle(ax,-.35*tk);
    const dir=Math.cos(ph)>=0?1:-1;if(S3.shD[i]&&S3.shD[i]!==dir&&tk>.5)sndRattle(me?1:.35);S3.shD[i]=dir}
  else S3.shAt[i]=0;
  if(sh&&!S3.shAt[i])S3.shAt[i]=now;
  return {p:cp,q};
}
S3.shAt=[];S3.shD=[];
/* 컵 안 주사위 자리 (컵 묶음 좌표, 바닥부터 쌓임) · 기울어진 컵 입구까지의 거리 */
const CUP_IN=[[0,.32,.02],[.05,.71,-.06],[-.06,1.08,.05]],CUP_MOUTH=1.02;
const CUP_E=[[.1,.4,.06],[.35,-.25,.12],[-.2,.6,.25]].map(e=>window.THREE?new THREE.Quaternion().setFromEuler(new THREE.Euler(e[0],e[1],e[2])):null);
const _v=window.THREE?new THREE.Vector3():null,_q=window.THREE?new THREE.Quaternion():null;
function inCup(seat,k,now,shake){
  const c=cupOf(seat);c.updateMatrixWorld();const L=CUP_IN[k%3];
  const j=shake?Math.abs(Math.sin(now/1000*SHK.w*2+k*1.9))*.13:0;   // 흔들면 컵 안에서 달그락 튐
  const p=_v.set(L[0]+(shake?Math.sin(now/37+k)*.04:0),L[1]+j,L[2]).applyMatrix4(c.matrixWorld).clone();
  const q=c.quaternion.clone().multiply(CUP_E[k%3]);if(shake)q.multiply(_q.setFromAxisAngle(_v.set(1,.3,0).normalize(),now/90+k));
  return {p,q};
}
function diceStep(o,m,now,me,bk){
  const D=S3.dk||(S3.dk={hold:null,at:[],fly:null});
  const put=(k,p,q)=>{const d=dieOf(k);d.visible=bk>=1;d.position.copy(p);d.quaternion.copy(q);D.at[k]={p:p.clone(),q:q.clone()}};
  if(m){   // 던지기: 컵이 기울기 시작해 0.2초까지는 컵 안, 그다음 물리 재생
    const r=simFor(m),e=(now-S3.mvT0-200)/1000;D.hold=m.s;D.fly=null;
    if(e<0){for(let k=0;k<r.d.length;k++){const c=inCup(m.s,k,now,false);put(k,c.p,c.q)}return r.d.length}
    const t=e*r.rate,fi=Math.max(0,Math.min(r.frames.length-1,Math.floor(t*60))),f=r.frames[fi];
    for(let k=0;k<r.d.length;k++){const R=r.rot[k];put(k,new THREE.Vector3(f[k*7],f[k*7+1],f[k*7+2]),new THREE.Quaternion(f[k*7+3],f[k*7+4],f[k*7+5],f[k*7+6]).multiply(new THREE.Quaternion(R[0],R[1],R[2],R[3])))}
    while(r.hitAt<r.hits.length&&r.hits[r.hitAt][0]<=t){sndHit(r.hits[r.hitAt][1]);r.hitAt++}
    D.board=r.d.length;return r.d.length;
  }
  const hold=o.ph==='play'&&V.t>=0&&V.t<o.out.length&&!o.out[V.t]?V.t:null;
  if(hold==null){   // 설치·끝: 지난 굴림이 있으면 판 위 그대로
    if(D.at.length&&D.board&&o.ph!=='setup'){for(let k=0;k<D.board;k++)put(k,D.at[k].p,D.at[k].q);return D.board}
    D.hold=null;return 0;
  }
  const n=o.cf.dn+(hold===me&&o.more?1:0),sh=o.ph==='play'&&!o.mv&&(hold===me?HOLD.on:!!(o.shk&&o.shk[hold]));
  if(D.hold!==hold){   // 차례가 바뀜: 지금 자리에서 새 컵으로 톡 튀어 들어감
    D.fly={t0:now,from:D.at.slice(0,3).map(a=>a&&{p:a.p.clone(),q:a.q.clone()})};D.hold=hold;D.board=0;
    if(D.fly.from.some(Boolean))sfx('tick');
  }
  const fk=D.fly?(now-D.fly.t0)/450:1;
  for(let k=0;k<n;k++){
    const c=inCup(hold,k,now,sh),fr=D.fly&&D.fly.from[k];
    if(fk<1&&fr){const t=ez(fk),p=fr.p.clone().lerp(c.p,t);p.y+=Math.sin(Math.PI*Math.min(1,fk))*.9;put(k,p,fr.q.clone().slerp(c.q,t))}
    else put(k,c.p,c.q);
  }
  if(fk>=1)D.fly=null;
  return n;
}
function step3D(now){
  const o=O_();if(!o||!S3.on)return;
  const me=myIdx(),n=V.ps.length,N=o.cf.N,cs=csOf(N),intro=IN.on?now-IN.t0:1e9;
  if(S3.boardKey!==String(N)){S3.boardKey=String(N);setGeo(N);drawBoard(N);S3.ovKey='';S3.lay=''}
  /* 시작 연출: 판이 툭 내려앉고 말이 출발 칸에 떨어짐 */
  const bk=IN.on&&!IN.again?ez((intro-INTRO.board[0])/INTRO.board[1]):1;
  S3.board.position.y=(1-bk)*2.2;S3.board.visible=bk>0;
  syncItems(o,now,!!S3.first);S3.first=false;
  for(const v of S3.items.values())v.g.visible=bk>=1;
  drawOverlay(o,me);
  /* 말 */
  const spots=[];for(let i=0;i<n;i++)spots[i]=o.out[i]?null:pawnSpot(o,i,now);
  const byCell=new Map();spots.forEach((s,i)=>{if(s&&!s.moving){const a=byCell.get(s.c)||[];a.push(i);byCell.set(s.c,a)}});
  const pk=Math.min(1.15,Math.max(.6,cs/.55));
  for(let i=0;i<Math.max(n,S3.pawns.length);i++){
    const s=i<n?spots[i]:null,pw=s||S3.pawns[i]?pawnOf(i):null;if(!pw)continue;
    pw.visible=!!s&&bk>=1;if(!pw.visible)continue;
    let x,y=BT,z;
    if(s.p){x=s.p[0];z=s.p[2];y=BT+s.p[1]}
    else{const [cx,cz]=cellXZ(s.c,N),grp=byCell.get(s.c)||[i],j=grp.indexOf(i),of=spotsFor(s.c,N)[j]||[0,0];x=cx+of[0]*cs;z=cz+of[1]*cs}
    if(IN.on&&!IN.again){const k=(intro-INTRO.pawn[0]-i*INTRO.pawn[1])/INTRO.pawn[2];if(k<1){if(k<0){pw.visible=false;continue}y+=(1-k*k)*1.4}}
    pw.position.set(x,y,z);pw.scale.setScalar(pk*((byCell.get(s.c)||[]).length>1&&!s.p?.44:.52));
  }
  /* 컵 */
  for(let i=0;i<Math.max(n,S3.cups.length);i++){
    const c=i<n||S3.cups[i]?cupOf(i):null;if(!c)continue;
    c.visible=i<n&&!o.out[i]&&bk>=1;if(!c.visible)continue;
    const P=cupPose(i,now,o);c.position.copy(P.p);c.quaternion.copy(P.q);
    const gl=c.userData.glow,on=i===me&&canRoll()&&!HOLD.on;gl.visible=on;if(on)gl.material.opacity=.55+.4*Math.sin(now/260);
  }
  /* 차례 고리 */
  {const ti=V.st==='play'&&o.ph==='play'?V.t:-1,ok=ti>=0&&ti<n&&!o.out[ti]&&bk>=1&&!IN.on;S3.ring.visible=ok;
   if(ok){const [x,z]=cupXZ(ti);S3.ring.position.set(x,.012,z);S3.ring.material.color.set(SEAT_C[ti%4]);const s=1+.08*Math.sin(now/220);S3.ring.scale.set(s,s,1);S3.ring.material.opacity=.6+.3*Math.sin(now/220)}}
  /* 주사위: 판 → 컵 → 판으로 사라지지 않고 이어짐.
     던지는 중이면 컵 안(기울기 전) → 물리 기록 재생, 아니면 차례인 사람의 컵 안(차례가 바뀌면 지난 자리에서 그 컵으로 톡 튀어 들어감).
     설치·끝난 판은 마지막으로 떨어진 자리 */
  const m=o.mv&&!o.mv.nt?o.mv:null,shown=diceStep(o,m,now,me,bk);
  for(let k=shown;k<S3.dice.length;k++)S3.dice[k].visible=false;
  for(const mm of [T.timerBg,T.timerArc,T.ring])if(mm)mm.visible=false;
  if(IN.on)introStep(now);
  placeUI(now,o,me);
}
/* ---------- 카메라 ----------
   판(+ 내 컵, 맞은편 컵)이 '판 자리'(위쪽 이름표 줄 아래, 아래쪽 내 이름 칸 위)에 꽉 차게. 자리를 정할 때만 계산 */
function layout(){
  const st=$('#stage'),W=st.clientWidth,Hh=st.clientHeight,o=O_();if(!W||!Hh||!o)return false;
  const n=V.ps.length,me=myIdx(),key=[W,Hh,n,me,HD.toFixed(3)].join(',');
  if(key===S3.lay)return false;S3.lay=key;
  const narrow=W<700,top=narrow?62:58,bot=narrow?92:78,sx=narrow?8:16;
  const fx0=sx,fx1=W-sx,fy0=top,fy1=Hh-bot,fw=fx1-fx0,fh=fy1-fy0;
  const cam=S3.cam;cam.aspect=W/Hh;cam.clearViewOffset();cam.updateProjectionMatrix();
  const pts=[];for(const sx2 of [-1,1])for(const sz of [-1,1])pts.push(new THREE.Vector3(sx2*(BH+.13),0,sz*(HD+.13)),new THREE.Vector3(sx2*(BH+.13),.3,sz*(HD+.13)));
  for(let i=0;i<n;i++){const a=seatAngle(i);if(Math.abs(Math.cos(a))>.85){const [x,z]=cupXZ(i);pts.push(new THREE.Vector3(x,1.15,z),new THREE.Vector3(x,0,z+.45*Math.sign(z)))}}
  const tg=new THREE.Vector3(0,0,.1),dir=new THREE.Vector3(0,Math.sin(CAM_TILT),Math.cos(CAM_TILT));
  let bb=null;
  const fit=d=>{cam.position.copy(tg).addScaledVector(dir,d);cam.lookAt(tg);cam.updateMatrixWorld();
    let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;for(const p of pts){const v=p.clone().project(cam),x=(v.x+1)/2*W,y=(1-v.y)/2*Hh;x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)}
    bb=[x0,x1,y0,y1];return x1-x0<=fw&&y1-y0<=fh};
  let lo=3,hi=80;for(let k=0;k<40;k++){const md=(lo+hi)/2;if(fit(md))hi=md;else lo=md}
  fit(hi);S3.d=hi;
  const ox=(bb[0]+bb[1])/2-(fx0+fx1)/2,oy=(bb[2]+bb[3])/2-(fy0+fy1)/2;
  cam.setViewOffset(W,Hh,ox,oy,W,Hh);cam.updateProjectionMatrix();cam.updateMatrixWorld();
  return true;
}
G.render3D=t=>{
  if(S3.on){
    layout();step3D(t);
    const fog=T.scene.fog,fn=fog?fog.near:0,ff=fog?fog.far:0;
    if(fog){fog.near=S3.d+4;fog.far=S3.d+30}
    let cam=S3.cam;
    const k=IN.on&&!IN.again?ez((t-IN.t0)/INTRO.cam):1;
    if(k<1){   // 시작 연출: 로비 카메라(공통 T.cam)에서 이 게임 카메라로 위치·방향·화면 범위를 함께 옮김
      const ic=S3.icam||(S3.icam=new THREE.PerspectiveCamera());
      ic.position.copy(T.cam.position).lerp(S3.cam.position,k);ic.quaternion.copy(T.cam.quaternion).slerp(S3.cam.quaternion,k);
      const a=T.cam.projectionMatrix.elements,b=S3.cam.projectionMatrix.elements,m=ic.projectionMatrix.elements;
      for(let j=0;j<16;j++)m[j]=a[j]+(b[j]-a[j])*k;
      ic.projectionMatrixInverse.copy(ic.projectionMatrix).invert();ic.updateMatrixWorld();
      if(fog){fog.near=fn+(fog.near-fn)*k;fog.far=ff+(fog.far-ff)*k}
      cam=ic;
    }
    T.r.render(T.scene,cam);
    if(fog){fog.near=fn;fog.far=ff}
  }else if(T.ok&&!$('#stage').classList.contains('sl2d'))T.r.render(T.scene,T.cam);
};
G._cam=()=>S3.on?S3.cam:null;G._xz=c=>{const o=O_();return o?cellXZ(c,o.cf.N):null};   // 헤드리스 확인용
function scrOf(p){const st=$('#stage'),w=st.clientWidth,h=st.clientHeight,v=p.clone().project(S3.cam);return [(v.x+1)/2*w,(1-v.y)/2*h]}
/* 남의 이름표: 그 사람 컵 위(화면에서)에. 공통 placeLabels가 놓은 뒤 매 프레임 덮어씀 */
function placeTags(o,me){
  if(!S3.on||!o||!(V.st==='play'||V.st==='over'))return;
  const st=$('#stage'),W=st.clientWidth,Hh=st.clientHeight;
  document.querySelectorAll('#labels .seat[data-i]').forEach(el=>{
    const i=+el.dataset.i;if(i===me)return;
    const [x,z]=cupXZ(i),[x0,y0]=scrOf(new THREE.Vector3(x,1.1,z)),hw=el.offsetWidth/2,hh=el.offsetHeight/2;
    const X=clamp(x0,hw+6,W-hw-6),Y=clamp(y0-hh-6,hh+6,Hh-hh-6);
    const L=Math.round(X)+'px',Tp=Math.round(Y)+'px';if(el.style.left!==L)el.style.left=L;if(el.style.top!==Tp)el.style.top=Tp;
  });
}
function placeUI(now,o,me){
  /* 내 컵 위 투명 누르는 자리 */
  const can=canRoll()||(HOLD.on&&o.ph==='play');
  if(!can){if(!elCup.hidden)elCup.hidden=true;S3.hitKey=''}
  else{
    const [x,z]=cupXZ(me),c=scrOf(new THREE.Vector3(x,.4,z)),e2=scrOf(new THREE.Vector3(x+.55,.4,z)),r=Math.max(36,Math.abs(e2[0]-c[0])*1.3);
    const key=[c[0]|0,c[1]|0,r|0].join();
    if(key!==S3.hitKey){S3.hitKey=key;Object.assign(elCup.style,{left:(c[0]-r)+'px',top:(c[1]-r*1.15)+'px',width:r*2+'px',height:r*2.3+'px'})}
    if(elCup.hidden)elCup.hidden=false;
  }
  /* 판 위 누르는 자리: 판 모서리를 화면에 옮긴 사각형만 (이름표·이모티콘 버튼을 덮지 않게) */
  const cp=!!placing();
  if(cp){let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;for(const a of [-1,1])for(const b of [-1,1]){const [x,y]=scrOf(new THREE.Vector3(a*BH,BT,b*HD));x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)}
    const key=[x0|0,y0|0,x1|0,y1|0].join();if(key!==S3.hbKey){S3.hbKey=key;Object.assign(elHit.style,{left:x0+'px',top:y0+'px',width:(x1-x0)+'px',height:(y1-y0)+'px'})}}
  if(elHit.hidden===cp)elHit.hidden=!cp;
}
G.postView=()=>{const o=O_();if(o&&S3.on)placeTags(o,myIdx())};
/* 판 위를 누른 칸 */
function cellAtScreen(cx,cy){
  const o=O_();if(!o)return 0;
  const st=$('#stage').getBoundingClientRect(),N=o.cf.N;
  if(S3.on){
    const v=new THREE.Vector2((cx-st.left)/st.width*2-1,-((cy-st.top)/st.height)*2+1),rc=S3.ray||(S3.ray=new THREE.Raycaster());rc.setFromCamera(v,S3.cam);
    const O=rc.ray.origin,D=rc.ray.direction;if(Math.abs(D.y)<1e-6)return 0;const t=(BT-O.y)/D.y;if(t<0)return 0;
    const x=O.x+D.x*t,z=O.z+D.z*t,cs=csOf(N),col=Math.floor((x+BH)/cs),u=(HD-z)/(cs*(1+GAP)),r=Math.floor(u);
    const f=(u-r)*(1+GAP);
    if(f>1){if(r<N-1&&col===turnCol(r,N))return cellAt(f>1+GAP/2?r+1:r,col,N);return 0}   // 줄 사이 간격 (꺾이는 칸은 이어짐)
    return cellAt(r,col,N);
  }
  return 0;
}
/* 설치: 끝 하나 → 다른 끝. 내 것의 끝을 누르면 거둠 */
function tapCell(c){
  const o=O_(),me=myIdx(),pl=placing();if(!pl||!c){sfx('no');return}
  if(pl==='snake'){   // 게임 중 뱀 놓기: 머리 → 꼬리
    if(!SEL.a){if(endsFor(o.items,o.cf,'s',c,'').length){SEL.a=c;sfx('pick')}else sfx('no');return}
    if(c===SEL.a){SEL.a=0;sfx('tick');return}
    if(okPut(o.items,o.cf,'s',SEL.a,c,'')){if(send({t:'ab',c:'snake',a:SEL.a,b:c})){sfx('play',1);SEL.a=0;SEL.gs=0}return}
    if(endsFor(o.items,o.cf,'s',c,'').length){SEL.a=c;sfx('pick');return}
    sfx('no');return;
  }
  const L=myLeft(),own=o.items.find(it=>it.o===me&&!it.g&&(it.a===c||it.b===c));
  if(!L[SEL.k==='s'?0:1]&&L[SEL.k==='s'?1:0]){SEL.k=SEL.k==='s'?'l':'s';if(!xOk(SEL.k,SEL.x))SEL.x=''}
  if(SEL.x&&!(o.tok&&o.tok[me]>0))SEL.x='';
  const ends=a=>endsFor(o.items,o.cf,SEL.k,a,SEL.x);
  if(SEL.a){
    if(c===SEL.a){SEL.a=0;sfx('tick');S3.ovKey='';drawSet();return}
    if(okPut(o.items,o.cf,SEL.k,SEL.a,c,SEL.x)){if(send({t:'put',k:SEL.k,a:SEL.a,b:c,x:SEL.x||undefined})){sfx('play',1);SEL.a=0;SEL.x='';S3.ovKey='';lastSet=''}return}
    if(own){send({t:'del',c});sfx('lift');SEL.a=0;return}
    if(L[SEL.k==='s'?0:1]&&ends(c).length){SEL.a=c;sfx('pick');return}
    sfx('no');return;
  }
  if(own){send({t:'del',c});sfx('lift');return}
  if(!L[SEL.k==='s'?0:1]){sfx('no');return}
  if(ends(c).length){SEL.a=c;sfx('pick');return}
  sfx('no');
}
/* 컵 누르기: 내 차례면 흔들기, 떼면 던짐 */
function holdStart(src){
  if(HOLD.on)return false;
  if(!canRoll()){sfx('no');return false}
  HOLD.on=true;HOLD.src=src;HOLD.at=clock();SEL.gs=0;SEL.a=0;SEL.ab='';sendAct({t:'shake',on:1});return true;
}
function holdEnd(cancel){
  if(!HOLD.on)return;HOLD.on=false;
  if(!cancel&&canRoll()){HOLD.relAt=clock();sendAct({t:'roll'})}else sendAct({t:'shake',on:0});
}
/* ---------- 시작 연출: 카메라가 내 자리 위로 → 판이 내려앉고 말이 떨어짐 → 판 가운데에서 첫 차례 주사위 ---------- */
const INTRO={cam:1100,board:[250,500],pawn:[800,110,380],dice:1500,diceA:300};
G.introMs=(again,rolls)=>Math.round((again?INTRO.diceA:INTRO.dice)+DicePick.totalFor(rolls)+150);
const IN={on:false,t0:0,total:0,r:0,again:false,fp:null,die:null,said:false};
G.intro=(t0,o)=>{
  if(!V||!V.sl||!V.ps)return;
  const rolls=o&&o.rolls,again=!!(o&&o.again);
  IN.on=true;IN.t0=t0;IN.said=false;IN.again=again;IN.r=again?INTRO.diceA:INTRO.dice;IN.total=(o&&o.total)||G.introMs(again,rolls);
  if(IN.die){IN.die.dispose();IN.die=null}
  IN.fp=rolls?firstPick(t0+IN.r,{seats:V.ps.map((_,i)=>i),first:V.sl.first,rolls,seed:(o&&o.seed)||1}):null;
};
function introStep(now){
  const e=now-IN.t0,done=e>=IN.total;
  if(IN.fp&&!IN.fp.fixed&&S3.root){
    if(!IN.die&&!done){IN.die=DicePick.mesh(THREE,V.ps.length,SEAT_C);S3.root.add(IN.die.g)}
    if(IN.die)IN.die.apply(done||e<IN.r?null:IN.fp.pose(now),.62,0,BT,0);
  }
  if(IN.fp&&e>=IN.r&&!IN.said&&IN.fp.tick(now)){IN.said=true;fxSay(IN.fp.msg(),SEAT_C[IN.fp.first%4])}
  if(done){if(IN.die){IN.die.dispose();IN.die=null}IN.said=true;IN.on=false}
}
function introTick2d(){
  if(!IN.on||S3.on)return;
  const now=clock(),e=now-IN.t0;
  if(IN.fp&&e>=IN.r&&!IN.said&&IN.fp.tick(now)){IN.said=true;fxSay(IN.fp.msg(),SEAT_C[IN.fp.first%4])}
  if(e>=IN.total)IN.on=false;
}

/* ---------- 2D: 설치 칸·단계 표시·WebGL이 없을 때 ---------- */
let lastSet='',last2d='';
function drawSet(){
  if(!elSet)return;
  const o=O_(),me=myIdx(),on=canPlace()&&(o.cf.sn+o.cf.ld>0);if(elSet.hidden===on)elSet.hidden=!on;if(!on){SEL.a=0;SEL.x='';return}
  const L=myLeft(),tok=o.cf.ab&&o.tok?o.tok[me]:0;
  if(!L[SEL.k==='s'?0:1]&&L[SEL.k==='s'?1:0]){SEL.k=SEL.k==='s'?'l':'s';SEL.a=0}
  if(SEL.x&&(!tok||!xOk(SEL.k,SEL.x)))SEL.x='';
  const key=[L.join(),SEL.k,SEL.a,SEL.x,tok].join('|');if(key===lastSet)return;lastSet=key;
  const col=SEAT_C[Math.max(0,me)%4];elSet.style.setProperty('--c',col);
  elSet.querySelectorAll('[data-k]').forEach(b=>{const k=b.dataset.k,n=L[k==='s'?0:1];b.classList.toggle('on',SEL.k===k&&n>0);b.disabled=n<=0;b.querySelector('b').textContent=n});
  const xr=elSet.querySelector('.sl-x');xr.hidden=!tok||L[0]+L[1]===0;
  xr.querySelectorAll('[data-x]').forEach(b=>{const x=b.dataset.x;b.classList.toggle('on',SEL.x===x);b.disabled=!xOk(SEL.k,x)});
}
/* 능력 모드: 설치하는 동안 게임 능력 하나 고르기 (위쪽 줄) */
let lastCards='',lastAb='';
function drawCards(){
  if(!elCards)return;
  const o=O_(),me=myIdx(),on=!!(o&&o.cf.ab&&V.st==='play'&&iSeat()&&o.ph==='setup'&&!o.go&&!dealingV()&&!IN.on);
  if(elCards.hidden===on)elCards.hidden=!on;if(!on)return;
  const cur=o.cards?o.cards[me]:null,key=cur+'|'+me;if(key===lastCards)return;lastCards=key;
  elCards.style.setProperty('--c',SEAT_C[Math.max(0,me)%4]);
  elCards.querySelectorAll('[data-c]').forEach(b=>b.classList.toggle('on',b.dataset.c===cur));
}
/* 능력 모드: 게임 중 내 게임 능력 (오른쪽 아래). 자리 바꾸기·골라 걷기는 누르면 고를 칸이 펼쳐지고, 뱀 놓기는 판을 눌러 놓음. 다시 누르면 되돌림 */
function drawAb(){
  if(!elAb)return;
  const o=O_(),me=myIdx(),c=myCard(),on=!!(o&&c&&V.st==='play'&&iSeat()&&o.ph==='play'&&!o.used[me]&&!IN.on);
  if(elAb.hidden===on)elAb.hidden=!on;if(!on){SEL.ab='';SEL.gs=0;return}
  const can=canAbV(c);if(!can){SEL.ab='';if(SEL.gs){SEL.gs=0;SEL.a=0}}
  const tg=SEL.ab==='swap'?V.ps.map((_,j)=>j).filter(swapOkV):[];
  const key=[c,can,SEL.ab,SEL.gs,tg.join(','),me].join('|');if(key===lastAb)return;lastAb=key;
  const col=SEAT_C[Math.max(0,me)%4];elAb.style.setProperty('--c',col);
  let h=`<button type="button" class="sl-abm${SEL.ab||SEL.gs?' on':''}${c==='shield'?' pas':''}" data-a="main" ${can||c==='shield'?'':'disabled'}>${CARD_IC[c]}<span>${CARD[c].n}</span></button>`;
  if(SEL.ab==='walk')h+='<div class="sl-opts">'+[1,2,3].map(n=>`<button type="button" data-n="${n}">${n}</button>`).join('')+'</div>';
  if(SEL.ab==='swap')h+='<div class="sl-opts col">'+(tg.length?tg.map(j=>`<button type="button" data-j="${j}" style="--pc:${SEAT_C[j%4]}"><i></i>${esc(nameOf(j))}</button>`).join(''):'')+'</div>';
  elAb.innerHTML=h;
}
function drawTag(){
  if(!elTag)return;
  const o=O_(),t=o&&V.st==='play'&&o.ph==='setup'&&!IN.on?(o.cf.sn+o.cf.ld?'뱀·사다리 설치':'능력 고르기'):'';
  if(elTag.textContent!==t)elTag.textContent=t;
}
/* WebGL이 없을 때: 위에서 본 판(SVG)과 굴리기 버튼 */
function draw2d(){
  if(!el2d||!O_())return;
  if(S3.on){if(last2d){el2d.innerHTML='';last2d=''}return}
  const o=O_(),N=o.cf.N,me=myIdx(),u=100/N,gp=u*GAP,Hs=N*u+(N-1)*gp,pl=placing();
  const cx=c=>(colOf(c,N)+.5)*u,ry=c=>(N-1-rowOf(c,N))*(u+gp),cy=c=>ry(c)+u/2;
  const ends=pl&&SEL.a?new Set(endsFor(o.items,o.cf,pl==='snake'?'s':SEL.k,SEL.a,pl==='setup'?SEL.x:'')):new Set();
  let h=`<svg class="sl-svg" viewBox="0 0 100 ${Hs.toFixed(2)}">`;
  for(let c=1;c<=N*N;c++){const [x,y,,hh]=cellRect(c,N,u,gp),r=rowOf(c,N);h+=`<rect data-c="${c}" x="${x}" y="${y}" width="${u}" height="${hh}" fill="${c===1?'#bfe0a8':c===N*N?'#ffd36a':(r+colOf(c,N))%2?'#f4e4c2':'#e7c996'}" stroke="${ends.has(c)?'#2a9640':c===SEL.a?SEAT_C[Math.max(0,me)%4]:'rgba(74,48,32,.3)'}" stroke-width="${ends.has(c)||c===SEL.a?.8:.15}"/><text x="${x+u*.08}" y="${ry(c)+u*.3}" font-size="${u*.26}" fill="#4a3020">${c}</text>`}
  const XS={rg:'+2',im:'🛡',ex:'🔒'};
  for(const it of o.items){const col=SEAT_C[it.o%4];h+=it.k==='l'?`<line x1="${cx(it.a)}" y1="${cy(it.a)}" x2="${cx(it.b)}" y2="${cy(it.b)}" stroke="${col}" stroke-width="${u*.22}" stroke-dasharray="${u*.08} ${u*.12}" opacity=".85"/>`:`<path d="M${cx(it.a)} ${cy(it.a)} Q${(cx(it.a)+cx(it.b))/2+u*.6} ${(cy(it.a)+cy(it.b))/2} ${cx(it.b)} ${cy(it.b)}" stroke="${col}" stroke-width="${u*.16}" fill="none" stroke-linecap="round" opacity=".85"/><circle cx="${cx(it.a)}" cy="${cy(it.a)}" r="${u*.17}" fill="${col}"/>`;
    if(it.x)h+=`<text x="${cx(it.a)+u*.22}" y="${cy(it.a)-u*.15}" font-size="${u*.3}" fill="${col}">${XS[it.x]}</text>`}
  o.pos.forEach((p,i)=>{if(o.out[i])return;const c=o.mv&&o.mv.s===i&&clock()-S3.mvT0>(o.mv.nt?MV.walk0:MV.throw)?o.mv.to:p;h+=`<circle cx="${cx(c)+(i%2?.18:-.18)*u}" cy="${cy(c)+(i>1?.18:-.18)*u}" r="${u*.2}" fill="${SEAT_C[i%4]}" stroke="#2a1a10" stroke-width=".4"/>`});
  h+='</svg>';
  const m=o.mv||o.last;if(m&&o.ph!=='setup')h+=`<p class="sl-dice">${esc(nameOf(m.s))} ${m.nt?'골라 걷기 '+m.nt:m.d.map(dieSVG).join('')}</p>`;
  if(h!==last2d){el2d.innerHTML=h;last2d=h}
  if(elRoll){const c=canRoll();if(elRoll.hidden===c)elRoll.hidden=!c}
}
G.live=()=>{
  if(!elBox||!O_())return;
  syncMv(O_());drawSet();drawCards();drawAb();drawTag();draw2d();introTick2d();
  if(S3.on)placeTags(O_(),myIdx());else placeTags2d(myIdx());
};
/* WebGL이 없을 때 남의 이름표: 판 위쪽 한 줄에 차례대로 */
function placeTags2d(me){
  if(!(V.st==='play'||V.st==='over'))return;
  const els=[...document.querySelectorAll('#labels .seat[data-i]')].filter(el=>+el.dataset.i!==me),W=$('#stage').clientWidth;
  els.forEach((el,k)=>{const L=Math.round(W*(k+1)/(els.length+1))+'px',Tp='74px';if(el.style.left!==L)el.style.left=L;if(el.style.top!==Tp)el.style.top=Tp});
}
G.hud=inGame=>{
  if(!elBox)return;
  const on=!!(inGame&&V&&O_());
  elBox.hidden=!on;
  const d3=on&&build();
  if(d3!==S3.on){S3.on=d3;if(S3.root)S3.root.visible=d3;S3.lay=''}
  $('#stage').classList.add('slg');$('#stage').classList.toggle('sl2d',on&&!d3);
  if(!on){if(S3.built)clearAll();S3.gn=-1;return}
  draw2d();
};
function clearAll(){
  for(const g of S3.cups)if(g)g.visible=false;
  for(const g of S3.pawns)if(g)g.visible=false;
  for(const g of S3.dice)if(g)g.visible=false;
  for(const v of S3.items.values())S3.root.remove(v.g);S3.items.clear();
  if(S3.ring)S3.ring.visible=false;if(S3.ovl)S3.ovl.m.visible=false;
  if(elCup)elCup.hidden=true;if(elHit)elHit.hidden=true;if(elSet)elSet.hidden=true;
}
G.overRank=p=>{const t=p.sr===3?'탈주':p.sr?'항복':'';return t?`<span class="left">${t}</span>`:''};
G.enter=()=>{$('#btnGura').hidden=true};
G.leave=()=>{
  if(S3.built)clearAll();
  if(typeof T!=='undefined'&&T.stacks)for(const arr of T.stacks.values())arr.forEach(c=>{c.visible=true});
  if(elBox)elBox.hidden=true;
  if(S3.root)S3.root.visible=false;
  if(IN.die){IN.die.dispose();IN.die=null}IN.on=false;
  Object.assign(S3,{on:false,gn:-1,lay:'',boardKey:'',ovKey:'',sim:null,mvId:-1});
  if(HOLD.on)holdEnd(true);SEL.a=0;lastSet='';last2d='';
  $('#stage').classList.remove('slg','sl2d');
  $('#btnPlay').disabled=false;$('#btnPass').disabled=false;
  document.querySelectorAll('#labels .seat').forEach(el=>{el.style.opacity=''});
};
G.holoPiece=mkM=>{
  const g=new THREE.Group(),m=mkM(0xffffff);
  for(const s of [-1,1]){const r=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,.9,8),m);r.position.x=s*.16;g.add(r)}
  for(let k=0;k<5;k++){const r=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,.32,6),m);r.rotation.z=Math.PI/2;r.position.y=-.36+k*.18;g.add(r)}
  const P=[];for(let k=0;k<=24;k++){const t=k/24;P.push(new THREE.Vector3(.32+Math.sin(t*Math.PI*2)*.14,.42-t*.84,.08))}
  const sn=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(P),40,.045,8,false),m);g.add(sn);
  const hd=new THREE.Mesh(new THREE.SphereGeometry(.08,12,8),m);hd.scale.set(1,.8,1.2);hd.position.copy(P[0]);g.add(hd);
  g.rotation.set(-.15,.35,0);g.scale.setScalar(.85);return g;
};
G.init=()=>{
  const css=document.createElement('style');
  css.textContent=`
.sl-box{position:absolute;inset:0;pointer-events:none;z-index:6}
.sl-box[hidden]{display:none}
.stage.slg #btnPlay,.stage.slg #btnPass{display:none}
.stage.slg #dim{display:none}
.stage.slg .seat .ct{display:none}
.sl-hit{position:absolute;pointer-events:auto;z-index:2;cursor:pointer;-webkit-tap-highlight-color:transparent}
.sl-hit[hidden]{display:none}
.sl-tag{position:absolute;left:12px;top:12px;font:16px "Jua",sans-serif;color:#3b2a1f;background:rgba(255,250,240,.82);padding:3px 12px;border-radius:12px;white-space:nowrap}
.sl-tag:empty{visibility:hidden}
.sl-set{position:absolute;right:12px;bottom:calc(var(--plateB,14px) + 4px);display:flex;flex-direction:column;gap:8px;padding:8px;border-radius:16px;background:rgba(255,250,240,.86);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);box-shadow:0 2px 10px -3px rgba(59,42,31,.4);pointer-events:auto;z-index:8;user-select:none;touch-action:manipulation;transform:scale(var(--actS,1));transform-origin:100% 100%}
.sl-set[hidden]{display:none}
.sl-set button{display:flex;align-items:center;gap:6px;min-width:120px;height:52px;padding:0 12px;border:2px solid rgba(59,42,31,.25);border-radius:12px;background:#fffaf0;color:#3b2a1f;font:20px "Jua",sans-serif}
.sl-set button.on{border-color:var(--c,#c53026);box-shadow:0 0 0 3px color-mix(in srgb,var(--c,#c53026) 35%,transparent);color:var(--c,#c53026)}
.sl-set button:disabled{opacity:.35}
.sl-set button b{margin-left:auto;font:700 22px "IBM Plex Mono",monospace}
.sl-ic{width:30px;height:30px}
.sl-x{display:flex;gap:5px}
.sl-x[hidden]{display:none}
.sl-set .sl-x button{flex:1;min-width:0;height:44px;padding:0 2px;flex-direction:column;justify-content:center;gap:0;font-size:12px;line-height:1.1;white-space:nowrap;border-width:2px}
.sl-set{min-width:150px}
.sl-x .sl-ic{width:18px;height:18px}
.sl-cards{position:absolute;left:8px;right:8px;top:48px;display:flex;flex-wrap:wrap;justify-content:center;gap:6px;pointer-events:auto;z-index:8}
.sl-cards[hidden]{display:none}
.sl-cards button,.sl-ab button{display:flex;align-items:center;gap:5px;height:40px;padding:0 10px;border:2px solid rgba(59,42,31,.25);border-radius:12px;background:rgba(255,250,240,.92);color:#3b2a1f;font:15px "Jua",sans-serif;box-shadow:0 2px 8px -3px rgba(59,42,31,.4)}
.sl-cards button.on{border-color:var(--c);color:var(--c);box-shadow:0 0 0 3px color-mix(in srgb,var(--c) 35%,transparent)}
.sl-cards .sl-ic,.sl-ab .sl-ic{width:22px;height:22px}
.sl-ab{position:absolute;right:12px;bottom:calc(var(--plateB,14px) + 4px);display:flex;flex-direction:column;align-items:flex-end;gap:6px;pointer-events:auto;z-index:8;transform:scale(var(--actS,1));transform-origin:100% 100%}
.sl-ab[hidden]{display:none}
.sl-ab .sl-abm{height:52px;font-size:19px;padding:0 14px}
.sl-ab .sl-abm.on{border-color:var(--c);color:var(--c);box-shadow:0 0 0 3px color-mix(in srgb,var(--c) 35%,transparent)}
.sl-ab .sl-abm.pas{opacity:.75}
.sl-ab button:disabled:not(.pas){opacity:.4}
.sl-opts{display:flex;gap:6px}
.sl-opts.col{flex-direction:column;align-items:flex-end}
.sl-opts button{min-width:52px;justify-content:center;font-size:19px}
.sl-opts button i{width:12px;height:12px;border-radius:50%;background:var(--pc)}
@media (min-width:700px){.sl-cards{left:12px;right:auto;top:50%;transform:translateY(-50%);flex-direction:column;align-items:stretch}}
@media (max-width:520px){.sl-cards button{height:36px;padding:0 7px;font-size:13px;gap:3px}.sl-cards .sl-ic{width:18px;height:18px}}
.sl-cup{position:absolute;padding:0;border:0;border-radius:50%;background:transparent;cursor:pointer;pointer-events:auto;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;z-index:5}
.sl-cup[hidden]{display:none}
.sl-2d{position:absolute;left:50%;top:98px;transform:translateX(-50%);width:min(94vw,54vh);text-align:center;pointer-events:auto}
@media (min-width:700px){.sl-2d{width:min(66vh,calc(100% - 340px))}}
.sl-svg{width:100%;display:block;border:3px solid #4a3020;border-radius:6px;background:#e7c996}
.sl-dice{margin:6px 0;font:18px "Jua",sans-serif;color:#3b2a1f}
.sl-d{width:28px;height:28px;vertical-align:middle;margin-left:4px}
.sl-roll{position:absolute;left:50%;bottom:calc(var(--plateB,14px) + 70px);transform:translateX(-50%);width:120px;height:60px;border-radius:14px;border:3px solid #4a3020;background:#6e3b22;color:#fff6e2;font:22px "Jua",sans-serif;pointer-events:auto;box-shadow:0 4px 0 #4a3020}
.sl-roll[hidden]{display:none}
@media (max-width:520px){.sl-set button{min-width:104px;height:46px;font-size:18px}.sl-ic{width:26px;height:26px}}
`;
  document.head.appendChild(css);
  elBox=document.createElement('div');elBox.className='sl-box';elBox.hidden=true;
  elBox.innerHTML=`<div class="sl-hit" hidden></div><div class="sl-tag"></div><div class="sl-2d"></div>
<div class="sl-set" hidden><button type="button" data-k="s">${ICON.s}뱀<b>0</b></button><button type="button" data-k="l">${ICON.l}사다리<b>0</b></button><div class="sl-x" hidden>${Object.keys(XAB).map(x=>`<button type="button" data-x="${x}" title="${XAB[x].d}">${XIC[x]}<span>${XAB[x].n}</span></button>`).join('')}</div></div>
<div class="sl-cards" hidden>${CARDS.map(c=>`<button type="button" data-c="${c}" title="${CARD[c].d}">${CARD_IC[c]}<span>${CARD[c].n}</span></button>`).join('')}</div><div class="sl-ab" hidden></div>
<button type="button" class="sl-cup" aria-label="내 컵" hidden></button><button type="button" class="sl-roll" hidden>굴리기</button>`;
  $('#stage').appendChild(elBox);
  elHit=elBox.querySelector('.sl-hit');elCards=elBox.querySelector('.sl-cards');elAb=elBox.querySelector('.sl-ab');elSet=elBox.querySelector('.sl-set');elCup=elBox.querySelector('.sl-cup');el2d=elBox.querySelector('.sl-2d');elTag=elBox.querySelector('.sl-tag');elRoll=elBox.querySelector('.sl-roll');
  elSet.addEventListener('click',e=>{
    const bx=e.target.closest('button[data-x]');
    if(bx){if(bx.disabled){sfx('no');return}SEL.x=SEL.x===bx.dataset.x?'':bx.dataset.x;SEL.a=0;S3.ovKey='';last2d='';sfx('tick');drawSet();return}   // 누르면 고르고, 다시 누르면 되돌림
    const b=e.target.closest('button[data-k]');if(!b||b.disabled){sfx('no');return}if(SEL.k!==b.dataset.k){SEL.k=b.dataset.k;SEL.a=0;if(!xOk(SEL.k,SEL.x))SEL.x='';S3.ovKey='';last2d=''}sfx('tick');drawSet()});
  elCards.addEventListener('click',e=>{const b=e.target.closest('button[data-c]');if(!b)return;if(!canPlace()&&!(O_()&&O_().ph==='setup')){sfx('no');return}send({t:'pick',c:b.dataset.c});sfx('pick');lastCards=''});
  elAb.addEventListener('click',e=>{
    const c=myCard(),b=e.target.closest('button');if(!b||!c)return;
    if(b.dataset.a==='main'){
      if(c==='shield'){sfx('no');return}   // 방패는 저절로
      if(!canAbV(c)){sfx('no');return}
      if(c==='more'){send({t:'ab',c});return}
      if(c==='snake'){SEL.gs=SEL.gs?0:1;SEL.a=0;S3.ovKey='';last2d='';sfx('tick');lastAb='';return}
      SEL.ab=SEL.ab===c?'':c;sfx('tick');lastAb='';return}
    if(b.dataset.n){if(canAbV('walk')&&send({t:'ab',c:'walk',n:+b.dataset.n})){SEL.ab='';sfx('dice')}return}
    if(b.dataset.j){const j=+b.dataset.j;if(canAbV('swap')&&swapOkV(j)&&send({t:'ab',c:'swap',j})){SEL.ab=''}else sfx('no');return}
  });
  elHit.addEventListener('click',e=>{tapCell(cellAtScreen(e.clientX,e.clientY));S3.ovKey='';});
  el2d.addEventListener('click',e=>{const r=e.target.closest('[data-c]');if(!r)return;tapCell(+r.dataset.c);last2d=''});
  elCup.addEventListener('pointerdown',e=>{if(e.button>0)return;e.preventDefault();if(holdStart('ptr'))try{elCup.setPointerCapture(e.pointerId)}catch(_){}});
  for(const ev of ['pointerup','pointercancel','lostpointercapture'])elCup.addEventListener(ev,()=>{if(HOLD.on&&HOLD.src==='ptr')holdEnd(false)});
  elCup.addEventListener('contextmenu',e=>e.preventDefault());
  elRoll.addEventListener('click',()=>{if(!canRoll()){sfx('no');return}sendAct({t:'roll'});sfx('dice')});
  addEventListener('keyup',e=>{if(typeof KEYS!=='undefined'&&e.code===KEYS.yroll&&HOLD.on&&HOLD.src==='key')holdEnd(false)});
  addEventListener('blur',()=>{if(HOLD.on)holdEnd(false)});
};
(window.GAMES=window.GAMES||{}).snakes=G;
})();
