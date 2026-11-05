/* ===== 다빈치코드 게임 모듈 =====
   공통 코드(index.html)가 GAMES.davinci의 함수를 불러서 이 게임의 규칙·봇·화면을 그림.
   2~4명. 흑·백 0~11 타일과 조커 2개(설정). 2~3명은 4개, 4명은 3개로 시작하고 남은 패는 탁자 가운데에 흩어 둠.
   차례: 남은 패에서 하나를 집음(draw) → 상대 타일 하나의 숫자를 추리(guess) → 방장이 잠깐 뒤 판정(show → res).
   맞히면 계속(guess) 또는 멈춤(집은 타일을 숨겨서 놓음), 틀리면 집은 타일을 공개해서 놓음. 남은 패가 없을 때 틀리면 내 타일 하나를 공개(reveal).
   타일이 모두 공개되면 탈락, 마지막 한 사람이 승리.
   타일 값은 방장 엔진에만 있고 snap에는 자기 타일·공개된 타일만 담음. 화면에서 타일을 가리키는 번호 u는 값과 상관없는 무작위 번호.
   손패(hand)는 표시용 [0] (공통 코드가 hand가 비면 끝난 사람으로 봄) */
(function(){
const G={id:'davinci',name:'다빈치코드',short:'다빈치',lead:'상대 타일의 숫자를 맞히는 추리 게임',maxHi:4,minN:2,noFast:true,firstPick:true,oneBotLv:true,noView:true};

/* ---------- 규칙 값 ---------- */
const JOKER=12,SHOW_MS=1100,RES_MS=1200;
const CN=['흑','백'];
const colOf=id=>id>=13?1:0,valOf=id=>id%13;
const vName=v=>v===JOKER?'조커':String(v);
const sortKey=id=>valOf(id)*2+colOf(id);   // 같은 숫자는 흑이 왼쪽
/* 줄 rack에 타일 id를 놓을 수 있는 자리들. 숫자끼리의 순서만 지키면 되고, 조커는 어디든 */
function legalSlots(rack,id){
  const n=rack.length,all=[...Array(n+1).keys()];
  if(valOf(id)===JOKER)return all;
  const k=sortKey(id);
  return all.filter(p=>rack.every((t,i)=>valOf(t.id)===JOKER||(i<p?sortKey(t.id)<k:sortKey(t.id)>k)));
}

/* ---------- 규칙 설명·방 설정 ---------- */
G.rulesHTML='<ol class="rules"><li><b>타일</b> : 흑·백 0~11 타일과 조커 2개입니다. 2~3명은 4개, 4명은 3개로 시작합니다. 시작 타일에는 조커가 없습니다</li><li><b>줄 세우기</b> : 타일은 작은 숫자부터 왼쪽으로 저절로 놓입니다. 같은 숫자는 흑이 왼쪽입니다. 조커는 내가 고른 자리에 놓고, 조커 때문에 놓을 자리가 여러 곳이면 숫자 타일도 직접 고릅니다</li><li><b>뽑기</b> : 내 차례에는 탁자에 흩어진 패에서 원하는 타일을 하나 집습니다. 색은 보고 고를 수 있습니다</li><li><b>추리</b> : 상대 패를 누르면 그쪽으로 다가갑니다. 타일을 누르고 숫자를 고른 뒤 <b>[추리]</b>를 누릅니다. 빈 곳을 누르면 돌아옵니다</li><li><b>맞히면</b> : 그 타일이 쓰러져 공개됩니다. 계속 추리하거나 멈출 수 있고, 멈추면 집은 타일을 숨긴 채 놓습니다</li><li><b>틀리면</b> : 집은 타일을 공개해서 놓습니다. 남은 패가 없으면 내 타일 하나를 골라 공개합니다</li><li><b>탈락·승리</b> : 타일이 모두 공개되면 탈락하고, 마지막까지 남은 사람이 승리합니다</li><li><b>제한 시간</b> : 시간이 지나면 뽑기·추리는 무작위로 하고, 계속할지 고를 때는 멈춥니다</li></ol>';
G.modeDesc=['상대 타일 맞히기','상대 타일 맞히기'];
G.defaults={max:4,turn:30,joker:1,help:1};
G.roomSet=[{k:'turn',label:'제한 시간',unit:'초',lo:10,hi:120,step:10,desc:'시간이 지나면 뽑기·추리는 무작위로 하고, 계속할지 고를 때는 멈춥니다'}];
G.ruleSet=[
  {k:'joker',label:'조커',desc:'조커 타일 2개를 넣습니다'},
  {k:'help',label:'숫자 흐리게',desc:'숫자를 고를 때 내 타일·공개된 타일·이미 틀린 숫자를 흐리게 보여 줍니다'},
  {k:'pickfirst',pick:1,label:'선 플레이어',desc:'선택이면 방장이 대기실 이름표에서 고르고, 무작위면 주사위로 정합니다'}
];
G.cfgChips=c=>`<span class="chip">제한 시간 <b>${+c.turn||30}초</b></span><span class="chip">조커 <b>${c.joker?'있음':'없음'}</b></span>`;
G.cfgSum=c=>`제한 시간 ${+c.turn||30}초 · 조커 ${c.joker?'있음':'없음'}`;
G.roomSub=()=>'2~4명 추리 타일 게임';
G.pubExtra=()=>({});
G.cardInfo=()=>'<p class="cardinfo">2~3명 타일 4개 · 4명 타일 3개</p>';
G.rankTitle=()=>'';
G.finLabel=f=>f===1?'승리':'탈락';
G.noEmotes=[];
G.keys={};G.keyActions=[];
G.cardHTML=()=>'';G.drawFace=()=>{};G.cmpCard=()=>0;G.labelOf=()=>'';

/* ---------- 방장 엔진 ---------- */
const alive=()=>H.players.map((p,i)=>i).filter(i=>!H.players[i].finished);
const hidden=s=>H.dv.rk[s].filter(t=>!t.o);
function scatter(n){   // 흩어 놓을 자리 n곳 (겹침이 적게, 모두 같은 자리를 보게 방장이 정함)
  const L=[],R0=1.72;
  for(let i=0;i<n;i++){
    let x=0,z=0;
    for(let k=0;k<70;k++){
      const r=Math.sqrt(Math.random())*R0,a=Math.random()*Math.PI*2;x=Math.cos(a)*r;z=Math.sin(a)*r*.92;
      const gap=k<45?.56:k<60?.47:.36;
      if(L.every(q=>Math.hypot(q.x-x,q.z-z)>gap))break;
    }
    L.push({x:+x.toFixed(3),z:+z.toFixed(3),r:+(Math.random()*Math.PI*2).toFixed(3)});
  }
  return L;
}
function setDl(){
  const t=clock(),p=H.players[H.turn];
  H.deadline=t+(+H.cfg.turn||30)*1000;
  H.botActAt=p&&p.bot?t+rand(900,1900):0;mark();
}
function beginTurn(i){
  const O=H.dv;
  H.turn=i;O.held=null;O.g=null;O.res=null;O.at=null;H.seatNote={};
  O.ph=O.pool.length?'draw':'guess';setDl();
}
function doDraw(seat,u,auto){
  const O=H.dv;if(O.ph!=='draw'||H.turn!==seat)return false;
  const k=O.pool.findIndex(t=>t.u===u);if(k<0)return false;
  const t=O.pool.splice(k,1)[0];O.held={u:t.u,id:t.id};
  addLog(`${H.players[seat].name} ${auto?'시간 초과 · ':''}${CN[colOf(t.id)]} 뽑음`);
  O.ph='guess';setDl();return true;
}
function doGuess(seat,t,u,v,auto){
  const O=H.dv;if(O.ph!=='guess'||H.turn!==seat||t===seat)return false;
  const q=H.players[t];if(!q||q.finished||!Number.isInteger(v)||v<0||v>JOKER)return false;
  const x=O.rk[t].find(y=>y.u===u);if(!x||x.o)return false;
  O.g={s:seat,t,u,v};O.ph='show';O.until=clock()+SHOW_MS;H.deadline=0;H.botActAt=0;
  H.seatNote={[t]:`${vName(v)}?`};
  addLog(`${auto?'시간 초과 · ':''}${H.players[seat].name} → ${q.name} ${CN[colOf(x.id)]} ${vName(v)}?`);
  mark();return true;
}
function judge(){
  const O=H.dv,g=O.g;O.g=null;H.seatNote={};
  const x=O.rk[g.t].find(y=>y.u===g.u);
  if(!x||x.o||H.players[g.t].finished){O.ph='guess';setDl();return}   // 그사이 항복한 사람
  const hit=valOf(x.id)===g.v;
  if(hit)x.o=1;else if(!x.w.includes(g.v))x.w.push(g.v);
  O.res={s:g.s,t:g.t,u:g.u,v:g.v,hit};O.ph='res';O.until=clock()+RES_MS;
  addLog(hit?'정답!':'오답',hit?'fin':'lie');mark();
}
function outCheck(s){
  const p=H.players[s];if(p.finished||hidden(s).length)return false;
  p.rank=alive().length;p.finished=true;p.hand=[];addLog(`${p.name} 탈락`,'sys');return true;
}
function winCheck(){const L=alive();if(L.length>1)return false;finishGame(L.length?L[0]:-1,'');return true}
function afterRes(){
  const O=H.dv,r=O.res;O.res=null;
  outCheck(r.t);if(winCheck())return;
  if(r.hit){O.ph='cont';setDl();return}
  if(O.held)settle(1);
  else if(hidden(r.s).length>1){O.ph='reveal';setDl()}
  else doReveal(r.s,hidden(r.s)[0].u);
}
/* 집은 타일 놓기 (open 1이면 공개). 놓을 자리가 여럿이면 고르게 함 */
function settle(open){
  const O=H.dv,s=H.turn,h=O.held,L=legalSlots(O.rk[s],h.id);
  O.op=open;
  if(L.length>1){O.at=L;O.ph='place';setDl();return}
  putHeld(L[0]);
}
function putHeld(p){
  const O=H.dv,s=H.turn,h=O.held;
  O.rk[s].splice(p,0,{u:h.u,id:h.id,o:O.op?1:0,w:[]});O.held=null;O.at=null;
  endTurn();
}
function endTurn(){const s=H.turn;outCheck(s);if(winCheck())return;beginTurn(nextActive(s))}
function doReveal(s,u){
  const O=H.dv,x=O.rk[s].find(y=>y.u===u);if(!x||x.o)return false;
  x.o=1;addLog(`${H.players[s].name} ${CN[colOf(x.id)]} ${vName(valOf(x.id))} 공개`);endTurn();return true;
}
function finishGame(w,why){
  const O=H.dv;
  O.fin={w,why};O.ph='done';O.g=null;O.res=null;H.seatNote={};
  if(w>=0){const p=H.players[w];p.rank=1;p.finished=true;p.hand=[];addLog(`${p.name} 승리!`,'fin')}
  H.phase='over';H.deadline=0;H.botActAt=0;mark();
  H.players.forEach((p,i)=>{if(p.bot&&Math.random()<.4)botEmote(i,'gg',800+Math.random()*1600)});
}
function doSurrender(s){
  const O=H.dv,p=H.players[s];if(H.phase!=='play'||!p||p.finished)return;
  const wasTurn=H.turn===s;
  O.rk[s].forEach(t=>{t.o=1});
  p.rank=alive().length;p.finished=true;p.surrendered=true;p.hand=[];
  addLog(`${p.name} ${p.deserter?'탈주':'항복'}!`,'lie');
  if(wasTurn&&O.held){const q=scatter(1)[0];O.pool.push({...O.held,...q});O.held=null}
  if(winCheck())return;
  if(wasTurn)beginTurn(nextActive(s));else mark();
}
/* 쉬움 봇: 공개된 정보만 씀. 이미 공개된 숫자와 그 타일에서 틀린 숫자만 피하고, 앞뒤 타일로 좁히지는 않음 */
function pickGuess(s){
  const O=H.dv,T0=alive().filter(i=>i!==s).flatMap(i=>hidden(i).map(x=>({i,x}))),c=pick(T0),col=colOf(c.x.id);
  const seen=new Set(O.rk.flat().filter(t=>t.o&&colOf(t.id)===col).map(t=>valOf(t.id)));
  const L=[...Array(12).keys()].filter(v=>!seen.has(v)&&!c.x.w.includes(v));
  return {t:c.i,u:c.x.u,v:L.length?pick(L):(Math.random()*12|0)};
}
function autoStep(i,auto){
  const O=H.dv;
  if(O.ph==='draw')doDraw(i,pick(O.pool).u,auto);
  else if(O.ph==='guess'){const g=pickGuess(i);doGuess(i,g.t,g.u,g.v,auto)}
  else if(O.ph==='cont'){if(!auto&&Math.random()<.3){O.ph='guess';setDl()}else stop(i)}
  else if(O.ph==='place')putHeld(pick(O.at));
  else if(O.ph==='reveal')doReveal(i,pick(hidden(i)).u);
}
function stop(i){const O=H.dv;if(O.held)settle(0);else endTurn()}
G._test={JOKER,SHOW_MS,RES_MS,legalSlots,colOf,valOf,sortKey};
G.engine={
  start(){
    Object.assign(H,{phase:'play',log:[],seatNote:{},field:[],last:null,reveal:null,shouts:[],pending:null,rankNext:1,known:{},turn:0,botActAt:0,deadline:0});
    const n=H.players.length,k=n>=4?3:4,ids=shuffle([...Array(26).keys()].filter(i=>valOf(i)!==JOKER)),us=shuffle([...Array(26).keys()]);
    const mk=id=>({u:us.pop(),id,o:0,w:[]});
    const rk=H.players.map(()=>ids.splice(0,k).map(mk).sort((a,b)=>sortKey(a.id)-sortKey(b.id)));
    const rest=shuffle(ids.concat(H.cfg.joker?[JOKER,13+JOKER]:[])),sc=scatter(rest.length);
    H.players.forEach(p=>{p.finished=false;p.rank=null;p.surrendered=false;p.hand=[0]});
    const A=firstSeat(n);
    H.dv={gn:((H.dv&&H.dv.gn)||0)+1,first:A,rk,pool:rest.map((id,i)=>({u:us.pop(),id,...sc[i]})),held:null,g:null,res:null,at:null,op:0,ph:'draw',until:0,fin:null};
    addLog(`${H.players[A].name}님이 먼저 뽑습니다.`,'sys');
    beginTurn(A);
  },
  act(seat,a){
    if(a.t==='surrender'){doSurrender(seat);return}
    const O=H.dv;if(!O||H.phase!=='play'||seat<0||seat>=H.players.length||H.turn!==seat||dealing())return;
    if(a.t==='draw')doDraw(seat,a.u,false);
    else if(a.t==='guess')doGuess(seat,a.s,a.u,a.v,false);
    else if(a.t==='cont'&&O.ph==='cont'){if(a.go){O.ph='guess';setDl()}else stop(seat)}
    else if(a.t==='place'&&O.ph==='place'&&O.at.includes(a.at))putHeld(a.at);
    else if(a.t==='reveal'&&O.ph==='reveal')doReveal(seat,a.u);
  },
  tick(t){
    const O=H.dv;if(!O||H.phase!=='play')return;
    if(O.ph==='show'){if(t>=O.until)judge();return}
    if(O.ph==='res'){if(t>=O.until)afterRes();return}
    const p=H.players[H.turn];if(!p)return;
    if(p.bot&&!awayHuman(p)){if(H.botActAt&&t>=H.botActAt&&!(p.away&&t<p.awayAt+AWAY_WAIT))autoStep(H.turn,false);return}
    if(H.deadline&&t>=H.deadline){H.seatNote={[H.turn]:'시간 초과'};autoStep(H.turn,true)}
  },
  snap(s,you,t){
    const O=H.dv,over=H.phase==='over',me=you>=0&&you<H.players.length?you:-1;
    s.o={gn:O.gn,first:O.first,ph:O.ph,cur:H.turn,
      pool:O.pool.map(q=>({u:q.u,c:colOf(q.id),x:q.x,z:q.z,r:q.r})),
      rk:O.rk.map((r,i)=>r.map(x=>({u:x.u,c:colOf(x.id),o:x.o,w:x.w.slice(),v:over||x.o||i===me?valOf(x.id):null}))),
      held:O.held?{u:O.held.u,c:colOf(O.held.id),v:H.turn===me||over?valOf(O.held.id):null}:null,
      g:O.g?{...O.g}:null,res:O.res?{...O.res}:null,at:O.at&&H.turn===me?O.at.slice():null,fin:O.fin?{...O.fin}:null};
    s.gr=0;
    if(H.phase==='play'&&H.deadline)s.dl=Math.max(0,Math.round(H.deadline-t));
    else{s.dl=0;if(H.phase==='play')delete s.t}
  },
  restore(ms){if(H.dv&&H.dv.until)H.dv.until+=ms},
  emoPhase:ph=>ph==='play'||ph==='over'
};

/* ---------- 화면: 조작 상태 ---------- */
let foc=-1,focAt=-1e9,focFrom=0,selU=-1,selV=-1,elBox=null,elPad=null,el2d=null,elHint=null,lastPad='',last2d='',lastHint='';
const meI=()=>{const i=myIdx();return V&&V.ps&&i>=0&&i<V.ps.length?i:-1};
const myTurn=()=>!!(V&&V.o&&V.st==='play'&&!dealingV()&&!introWait()&&V.o.cur===meI()&&meI()>=0&&V.t===meI());
const phIs=p=>!!(V&&V.o&&V.o.ph===p);
const nm=i=>V.ps[i]?V.ps[i].n:'?';
const sndPick=()=>{tone(1500,.03,{type:'triangle',vol:.06});hiss(.025,{freq:3200,q:3,vol:.07})};
const sndPut=at=>{hiss(.03,{freq:2600,q:2.2,vol:.18,at:at||0});tone(520,.06,{type:'triangle',vol:.1,at:(at||0)+.003})};
const sndHit=()=>{tone(880,.12,{type:'sine',vol:.11});tone(1320,.2,{type:'sine',vol:.1,at:.09})};
const sndMiss=()=>{tone(150,.22,{type:'triangle',vol:.16});tone(110,.3,{type:'triangle',vol:.12,at:.1})};
function setFocus(s){
  if(s===foc)return;
  focFrom=focK();foc=s<0?foc:s;Dv.lastFoc=foc;
  if(s<0)foc=-1;
  focAt=clock();selU=-1;selV=-1;sndPick();redraw();
}
function focK(){   // 지금 카메라가 다가간 정도 0~1
  const e=clamp((clock()-focAt)/FOC_MS),k=e*e*(3-2*e),to=foc>=0?1:0;
  return focFrom+(to-focFrom)*k;
}
const clamp=x=>x<0?0:x>1?1:x;
function pickTarget(s,u){
  if(!myTurn()||!phIs('guess')){sfx('no');return}
  if(selU===u){selU=-1;selV=-1}else{selU=u;selV=-1}
  sndPick();redraw();
}
function pickKey(v){
  if(!myTurn()||!phIs('guess')||selU<0)return;
  if(selV===v&&typeof dblTap!=='undefined'&&dblTap){submit();return}
  selV=selV===v?-1:v;sndPick();redraw();
}
function submit(){
  if(selU<0||selV<0||!myTurn()||!phIs('guess')){sfx('no');return}
  sendAct({t:'guess',s:foc,u:selU,v:selV});
}
function redraw(){drawPad();G.buttons();if(Dv.on)sync()}
const tileOf=(s,u)=>(V.o.rk[s]||[]).find(t=>t.u===u);
/* 내가 뒤집어 놓은 줄: 다가갔을 때·놓을 자리·공개할 타일 고를 때 화면 아래에 */
function myStrip(){
  const me=meI();if(me<0)return '';
  const o=V.o,R=o.rk[me],gaps=phIs('place')&&myTurn()?o.at||[]:null,rev=phIs('reveal')&&myTurn();
  let h='';
  const gap=k=>gaps&&gaps.includes(k)?`<button type="button" class="dvgap" data-at="${k}" aria-label="여기에 놓기">+</button>`:'';
  R.forEach((t,k)=>{
    h+=gap(k);
    const can=rev&&!t.o;
    h+=`<${can?'button type="button"':'span'} class="dvt ${t.c?'w':'b'}${t.o?' open':''}${can?' can':''}"${can?` data-rv="${t.u}"`:''}>${t.v===JOKER?'★':t.v}</${can?'button':'span'}>`;
  });
  h+=gap(R.length);
  if(o.held&&o.held.v!=null)h+=`<span class="dvt held ${o.held.c?'w':'b'}">${o.held.v===JOKER?'★':o.held.v}</span>`;
  return `<div class="dv-my">${h}</div>`;
}
function dimSet(c,t){
  if(!V.cfg.help)return new Set();
  const S=new Set(t?t.w:[]);
  V.o.rk.forEach(r=>r.forEach(x=>{if(x.c===c&&x.v!=null)S.add(x.v)}));
  if(V.o.held&&V.o.held.c===c&&V.o.held.v!=null)S.add(V.o.held.v);
  return S;
}
function keysHTML(){
  const t=foc>=0&&selU>=0?tileOf(foc,selU):null;if(!t)return '';
  const dim=dimSet(t.c,t),max=V.cfg.joker?JOKER:11;let h='';
  for(let v=0;v<=max;v++)h+=`<button type="button" class="dvk ${t.c?'w':'b'}${selV===v?' on':''}${dim.has(v)?' dm':''}" data-k="${v}">${v===JOKER?'조커':v}</button>`;
  h+=`<button type="button" class="dvk go${selV>=0?' ready':''}" data-go="1"${selV>=0?'':' disabled'}>추리</button>`;
  return `<div class="dv-keys">${h}</div>`;
}
function drawPad(){
  if(!elPad||!V||!V.o)return;
  const zoom=foc>=0,show=zoom||(myTurn()&&(phIs('place')||phIs('reveal')))||(!Dv.on&&meI()>=0&&V.st==='play');
  $('#stage').classList.toggle('dv-zoom',zoom);
  const h=show?myStrip()+keysHTML():'';
  if(h!==lastPad){elPad.innerHTML=h;lastPad=h}
  elPad.hidden=!h;
  if(!Dv.on)draw2d();
  const ht=hintText();if(ht!==lastHint){elHint.textContent=ht;lastHint=ht}
}
function hintText(){
  const o=V.o;
  if(V.st==='over'){const r=o.fin;return !r||r.w<0?'게임이 끝났습니다.':`${nm(r.w)} 승리`}
  if(!myTurn())return '';
  if(o.ph==='draw')return '패 뽑기';
  if(o.ph==='guess')return foc<0?'상대 패 고르기':selU<0?`${nm(foc)} · 타일 고르기`:'숫자 고르기';
  if(o.ph==='cont')return '계속할까요?';
  if(o.ph==='place')return '놓을 자리';
  if(o.ph==='reveal')return '공개할 타일';
  return '';
}
function draw2d(){
  if(!el2d)return;
  const o=V.o,me=meI(),can=myTurn()&&phIs('guess');
  const row=i=>`<div class="dv-row${o.cur===i?' on':''}"><b>${esc(nm(i))}</b>${o.rk[i].map(t=>{const p=can&&!t.o&&!V.ps[i].f;return `<${p?'button type="button"':'span'} class="dvt ${t.c?'w':'b'}${t.o?' open':''}${t.u===selU?' sel':''}"${p?` data-s="${i}" data-u="${t.u}"`:''}>${t.v==null?'':t.v===JOKER?'★':t.v}</${p?'button':'span'}>`}).join('')}</div>`;
  const n=c=>o.pool.filter(t=>t.c===c).length,dr=myTurn()&&phIs('draw');
  const pool=[0,1].map(c=>`<button type="button" class="dvt ${c?'w':'b'} wide"${dr&&n(c)?` data-pc="${c}"`:' disabled'}>${CN[c]} ${n(c)}</button>`).join('');
  const h=`<div class="dv-row">${pool}</div>${V.ps.map((_,i)=>i).filter(i=>i!==me).map(row).join('')}`;
  if(h!==last2d){el2d.innerHTML=h;last2d=h}
}

/* ---------- 3D: 공통 앉은 카메라 + 상대 쪽으로 다가가는 카메라 ----------
   타일 o={g,c,v,u,p:{x,y,z,ry,rx,s},tw}. 남은 패는 눕혀서 흩어 두고, 줄 타일은 자리마다 곧게 세움.
   세운 타일의 앞면은 주인 쪽. 공개하면 탁자 가운데 쪽으로 쓰러져 앞면이 위로 옴 */
const TW=.4,TH=.58,TD=.13,GAP=.46,RACK=3.08,TILT=-.46,FOC_MS=360;
const Dv={on:false,built:false,fail:false,root:null,tiles:new Map(),gn:-1,lastFoc:-1,cam:null,ray:null,rid:0,gid:0};
const BODY=[0x2a2a2e,0xf1ebde],ez=k=>k<=0?0:k>=1?1:k*k*(3-2*k);
const MAT={};
function faceMat(c,v){
  const k=c+'_'+v;if(MAT[k])return MAT[k];
  const tx=canvasTex(128,184,(g,w,h)=>{
    g.fillStyle=c?'#f1ebde':'#2a2a2e';g.fillRect(0,0,w,h);
    g.strokeStyle=c?'rgba(120,100,70,.35)':'rgba(255,255,255,.16)';g.lineWidth=5;g.strokeRect(9,9,w-18,h-18);
    g.fillStyle=v===JOKER?'#d8392b':c?'#26262a':'#f4efe3';g.textAlign='center';g.textBaseline='middle';
    g.font=`700 ${v>9?92:116}px "IBM Plex Mono", monospace`;
    if(v===JOKER){g.beginPath();for(let i=0;i<10;i++){const r=i%2?22:56,a=-Math.PI/2+i*Math.PI/5,x=w/2+Math.cos(a)*r,y=h/2+Math.sin(a)*r;i?g.lineTo(x,y):g.moveTo(x,y)}g.closePath();g.fill()}
    else{g.fillText(String(v),w/2,h/2+6);if(v===6||v===9)g.fillRect(w/2-24,h/2+58,48,7)}   // 6·9 밑줄 (뒤집혀 보여도 헷갈리지 않게)
  });
  return MAT[k]=toon({map:tx,rim:0});
}
const sideMat=c=>MAT['s'+c]||(MAT['s'+c]=toon({color:BODY[c],rim:c?.12:.35}));
function mkTile(u,c){
  const m=new THREE.Mesh(Dv.geo,[sideMat(c),sideMat(c),sideMat(c),sideMat(c),sideMat(c),sideMat(c)]);m.castShadow=true;
  const g=new THREE.Group();g.add(m);g.rotation.order='YXZ';
  const ink=new THREE.Mesh(Dv.igeo,Dv.ink);g.add(ink);
  Dv.root.add(g);
  return {u,c,v:null,g,m,ink,p:null,tw:null,where:'',seat:-1};
}
function build(){
  if(Dv.built||Dv.fail)return Dv.built;
  if(!T.ok||typeof THREE==='undefined'){Dv.fail=true;return false}
  try{
    const root=new THREE.Group();root.visible=false;T.scene.add(root);Dv.root=root;
    Dv.geo=new THREE.BoxGeometry(TW,TH,TD);Dv.igeo=new THREE.BoxGeometry(TW+.03,TH+.03,TD+.03);
    Dv.ink=new THREE.MeshBasicMaterial({color:GFX_INK,side:THREE.BackSide});Dv.gold=new THREE.MeshBasicMaterial({color:0xffc83a,side:THREE.BackSide});
    Dv.cam=new THREE.PerspectiveCamera();Dv.ray=new THREE.Raycaster();
    const c=document.createElement('canvas');c.width=320;c.height=160;const t=new THREE.CanvasTexture(c);
    const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true,depthTest:false,depthWrite:false}));sp.scale.set(1.2,.6,1);sp.renderOrder=55;sp.visible=false;root.add(sp);
    Dv.bub={c,t,sp,key:''};
    Dv.built=true;
  }catch(e){Dv.fail=true;try{console.warn('다빈치코드 3D 준비 실패',e)}catch(_){}}
  return Dv.built;
}
function setV(o,v){if(o.v===v)return;o.v=v;o.m.material[4]=v==null?sideMat(o.c):faceMat(o.c,v)}
function rackK(i,n){   // 줄이 길면 타일을 줄임. 내 줄은 화면 폭 안에 들어오게
  let w=V.ps.length>=4?5:6.2;   // 4명은 옆 줄과 모서리에서 만나지 않게
  if(i===meI()&&T.cam){const q=new THREE.Vector3(1,0,RACK).project(T.cam),z=new THREE.Vector3(0,0,RACK).project(T.cam),per=Math.abs(q.x-z.x);if(per>0)w=Math.min(w,1.9/per)}
  return Math.max(.5,Math.min(1,w/Math.max(1,n*GAP)));
}
function rackPose(i,k,n,open,lift){
  const K=rackK(i,n),a=seatAngle(i),d=(k-(n-1)/2)*GAP*K,R=RACK-(open?.3:0)-(lift?.14:0);   // 자리 앞에 곧은 줄
  return {x:Math.sin(a)*R+Math.cos(a)*d,z:Math.cos(a)*R-Math.sin(a)*d,y:open?TD*K/2+.012:TH*K/2+.01+(lift?.12:0),ry:a,rx:open?-Math.PI/2:TILT,s:K};
}
function moveT(t,to,dur,arc,delay,now){
  const q=t.tw?t.tw.to:t.p;
  if(q&&Math.abs(q.x-to.x)+Math.abs(q.z-to.z)+Math.abs(q.y-to.y)+Math.abs(q.rx-to.rx)+Math.abs(q.ry-to.ry)+Math.abs(q.s-to.s)<1e-3)return;
  if(!t.p||!dur){t.p={...to};t.tw=null;return}
  t.tw={from:{...t.p},to:{...to},t0:now+(delay||0),dur,arc:arc||0};
}
function shake(t){t.shk=clock()}
/* 상태 → 물건 자리 */
function sync(){
  if(!Dv.on||!V||!V.o)return;
  const o=V.o,now=clock(),fresh=Dv.gn!==o.gn;
  if(fresh){for(const t of Dv.tiles.values())Dv.root.remove(t.g);Dv.tiles.clear();Dv.gn=o.gn;Dv.rid=0;Dv.gid=0}
  const live=new Set(),intro=IN.on,sw=fresh;
  const tile=(u,c)=>{live.add(u);let t=Dv.tiles.get(u);if(!t){t=mkTile(u,c);Dv.tiles.set(u,t);t.spot=(u*2.399)%6.283;t.isNew=true}return t};
  o.pool.forEach((q,k)=>{
    const t=tile(q.u,q.c);t.where='pool';setV(t,null);
    const to={x:q.x,z:q.z,y:TD/2+.012,ry:q.r,rx:Math.PI/2,s:1};
    if(t.isNew&&intro){t.p={...to,y:1.8};t.g.visible=false;moveT(t,to,300,0,k*26+60,now);t.isNew=false}
    else{moveT(t,to,sw?0:300,0,0,now);t.isNew=false}
  });
  o.rk.forEach((R,i)=>R.forEach((x,k)=>{
    const t=tile(x.u,x.c),was=t.v,open=!!x.o||V.st==='over';
    if(x.v!=null)setV(t,x.v);
    const lift=x.u===selU||(o.g&&o.g.u===x.u),to=rackPose(i,k,R.length,open,lift);
    if(t.isNew&&intro){   // 시작: 흩어진 자리에서 줄로
      const r=1.1+(x.u%7)*.09;t.p={x:Math.cos(t.spot)*r,z:Math.sin(t.spot)*r,y:1.8,ry:t.spot,rx:Math.PI/2,s:1};t.g.visible=false;
      const pile={...t.p,y:TD/2+.012};moveT(t,pile,300,0,(x.u%10)*26+60,now);t.next={to,at:INTRO_D0+(i*5+k)*70};t.isNew=false;
    }else{moveT(t,to,t.isNew||sw?0:(t.where==='pool'||t.where==='held'?460:300),t.where==='pool'||t.where==='held'?.7:0,0,now);t.isNew=false}
    if(t.where!=='rack'&&t.where!==''&&!sw)sndPut(.42);
    t.where='rack';t.seat=i;t.open=open;
  }));
  if(o.held){
    const t=tile(o.held.u,o.held.c),n=o.rk[o.cur].length,to=rackPose(o.cur,n+.35,n+1,false,false);
    if(t.where==='pool')sndPick();
    if(o.held.v!=null)setV(t,o.held.v);
    t.where='held';t.seat=o.cur;
    moveT(t,to,460,.7,0,now);
  }
  for(const [u,t] of Dv.tiles)if(!live.has(u)){Dv.root.remove(t.g);Dv.tiles.delete(u)}
  for(const t of Dv.tiles.values())t.ink.material=t.u===selU||(o.g&&o.g.u===t.u)||(o.res&&o.res.u===t.u)?Dv.gold:Dv.ink;
  if(o.res&&o.res.u!==Dv.rid){Dv.rid=o.res.u;const t=Dv.tiles.get(o.res.u);if(o.res.hit)sndHit();else{sndMiss();if(t)shake(t)}}
  if(!o.res)Dv.rid=0;
  bubble();
}
const vName2=v=>v===JOKER?'★':v;
function bubble(){
  const o=V.o,B=Dv.bub,src=o.g||o.res;
  if(!src){B.sp.visible=false;B.key='';return}
  const hit=o.res?o.res.hit:null,txt=`${vName2(src.v)}${hit==null?'?':hit?' ✓':' ✕'}`,col=hit==null?'#ffb04a':hit?'#7dff9c':'#ff6a55';
  if(B.key!==txt){B.key=txt;const g=B.c.getContext('2d');g.clearRect(0,0,320,160);g.shadowColor=col;g.shadowBlur=18;g.fillStyle=col;g.font='700 110px "IBM Plex Mono", monospace';g.textAlign='center';g.textBaseline='middle';g.fillText(txt,160,84);B.t.needsUpdate=true}
  const t=Dv.tiles.get(src.u);if(t&&t.p){B.sp.position.set(t.p.x*.92,1.02,t.p.z*.92);B.sp.visible=true}
}
/* 매 프레임 (시작 시각과의 차이로) */
function frame(now){
  for(const t of Dv.tiles.values()){
    if(t.next&&now>=IN.t0+t.next.at){moveT(t,t.next.to,420,.7,0,now);t.next=null}
    if(t.tw){
      const a=t.tw,k=(now-a.t0)/a.dur;
      if(k>=0)t.g.visible=true;
      if(k>=1){t.p={...a.to};t.tw=null;if(a.dur===300&&a.from.y>1)sndPut(0)}
      else if(k>0){const e=ez(k),L=(p,q)=>p+(q-p)*e;t.p={x:L(a.from.x,a.to.x),z:L(a.from.z,a.to.z),y:L(a.from.y,a.to.y)+Math.sin(Math.PI*k)*a.arc,ry:L(a.from.ry,a.to.ry),rx:L(a.from.rx,a.to.rx),s:L(a.from.s,a.to.s)}}
    }
    if(t.p){
      const sh=t.shk&&now-t.shk<420?Math.sin((now-t.shk)/28)*.05*(1-(now-t.shk)/420):0;
      t.g.position.set(t.p.x+sh,t.p.y,t.p.z);t.g.rotation.y=t.p.ry;t.g.rotation.x=t.p.rx;t.g.scale.setScalar(t.p.s);
    }
  }
  if(IN.die&&IN.fp)IN.die.apply(IN.fp.pose(now),.5,0,.16,0);
}
const _f=window.THREE?new THREE.Vector3():null,_u=window.THREE?new THREE.Vector3():null,_q=window.THREE?new THREE.Quaternion():null,_a=window.THREE?new THREE.Vector3(0,1,0):null,_c=window.THREE?new THREE.Vector3():null;
/* 지금 쓰는 카메라: 앉은 카메라에서 상대 줄로 이동·줌. 옆자리는 줄이 보일 만큼만 고개를 돌림 */
function camNow(){
  const k=focK(),s=foc>=0?foc:Dv.lastFoc;
  if(k<=.001||s<0||!V.ps[s]||!V.o)return T.cam;
  const R=V.o.rk[s]||[],n=Math.max(1,R.length),K=rackK(s,n),a=seatAngle(s),e=T.cam.projectionMatrix.elements;
  let yaw=(a-Math.PI)%(Math.PI*2);if(yaw>Math.PI)yaw-=Math.PI*2;if(yaw<-Math.PI)yaw+=Math.PI*2;yaw*=.72;
  _q.setFromAxisAngle(_a,yaw).multiply(T.cam.quaternion);
  _f.set(0,0,-1).applyQuaternion(_q);_u.set(0,1,0).applyQuaternion(_q);
  const tH=1/e[0],tV=1/e[5],half=n*GAP*K/2+.3,D=Math.max(3,Math.min(7,Math.max(half/tH,1.25/tV)));
  _c.set(Math.sin(a)*RACK*.97,.42,Math.cos(a)*RACK*.97).addScaledVector(_u,-D*tV*.36).addScaledVector(_f,-D);
  const c=Dv.cam;
  c.position.copy(T.cam.position).lerp(_c,k);c.quaternion.copy(T.cam.quaternion).slerp(_q,k);
  c.projectionMatrix.copy(T.cam.projectionMatrix);c.projectionMatrixInverse.copy(T.cam.projectionMatrixInverse);c.updateMatrixWorld();
  return c;
}
G.render3D=t=>{
  if(!Dv.on){if(T.ok&&!$('#stage').classList.contains('dv2d'))T.r.render(T.scene,T.cam);return}
  frame(t);
  for(const m of [T.timerBg,T.timerArc,T.ring])if(m)m.visible=false;
  Dv.now=camNow();
  T.r.render(T.scene,Dv.now);
};
G.field3D=()=>{if(T.stacks)for(const arr of T.stacks.values())arr.forEach(c=>{c.visible=false})};
/* 누른 곳에서 가장 가까운 타일 (화면 좌표로, 작은 타일도 누르기 쉽게) */
function nearTile(e,L,px){
  const r=$('#cv').getBoundingClientRect();if(!r.width)return null;
  const cam=Dv.now||T.cam,x=e.clientX-r.left,y=e.clientY-r.top;let best=null,bd=px;
  const v=new THREE.Vector3();
  for(const t of L){if(!t.p)continue;v.set(t.p.x,t.p.y,t.p.z).project(cam);const d=Math.hypot((v.x+1)/2*r.width-x,(1-v.y)/2*r.height-y);if(d<bd){bd=d;best=t}}
  return best;
}
function cvClick(e){
  if(!Dv.on||!V||!V.o||!currentG()||V.st!=='play'||meI()<0)return;
  const o=V.o,me=meI(),all=[...Dv.tiles.values()];
  if(!myTurn()){return}
  if(o.ph==='draw'){const t=nearTile(e,all.filter(t=>t.where==='pool'),34);if(t)sendAct({t:'draw',u:t.u});else sfx('no');return}
  if(o.ph!=='guess')return;
  if(foc<0){
    const t=nearTile(e,all.filter(t=>t.where==='rack'&&t.seat!==me&&!V.ps[t.seat].f),46);
    if(t)setFocus(t.seat);else sfx('no');
    return;
  }
  const t=nearTile(e,all.filter(t=>t.where==='rack'&&t.seat===foc&&!t.open),60);
  if(t)pickTarget(foc,t.u);else setFocus(-1);
}

/* ---------- 시작 연출: 패가 쏟아져 흩어짐 → 처음 타일이 줄로 → 첫 차례 주사위 ---------- */
const INTRO_D0=1000,INTRO_D=2300;
G.introMs=(again,rolls)=>Math.round(INTRO_D+DicePick.totalFor(rolls)+100);
const IN={on:false,t0:0,total:0,fp:null,die:null,said:false};
const introOn=()=>IN.on&&clock()<IN.t0+IN.total;
const introWait=()=>introOn()&&!IN.said;
function dieOff(){if(IN.die){IN.die.dispose();IN.die=null}}
G.intro=(t0,o)=>{
  if(!V||!V.o||!V.ps)return;
  dieOff();
  IN.on=true;IN.t0=t0;IN.said=false;IN.total=(o&&o.total)||G.introMs(false,o&&o.rolls);
  IN.fp=firstPick(t0+INTRO_D,{seats:V.ps.map((_,i)=>i),first:V.o.first,rolls:o&&o.rolls,seed:(o&&o.seed)||1});
  Dv.gn=-1;foc=-1;selU=-1;selV=-1;focFrom=0;
  if(Dv.on)sync();
};
function introTick(){
  if(!IN.on)return;
  const now=clock(),fp=IN.fp;
  if(fp&&now>=IN.t0+INTRO_D){
    if(!fp.fixed&&!IN.die&&Dv.on&&Dv.root){IN.die=DicePick.mesh(THREE,V.ps.length,V.ps.map((_,i)=>DicePick.SEAT_COL[i%8]));Dv.root.add(IN.die.g)}
    if(fp.tick(now)&&!IN.said){IN.said=true;fxSay(fp.msg(),DicePick.SEAT_COL[fp.first%8]);G.buttons();drawPad()}
  }
  if(now>=IN.t0+IN.total){IN.on=false;IN.said=true;dieOff();G.buttons();drawPad()}
}
function introEnd(){IN.on=false;IN.said=true;dieOff()}

/* ---------- 공통 코드 훅 ---------- */
G.preView=()=>{
  const o=V.o;if(!o)return;
  const me=meI(),keep=V.st==='play'&&o.cur===me&&(o.ph==='guess'||((o.ph==='show'||o.ph==='res')&&foc>=0));
  if(foc>=0&&(!keep||(V.ps[foc]&&V.ps[foc].f&&o.ph==='guess'))){focFrom=focK();foc=-1;focAt=clock();selU=-1;selV=-1}
  if(selU>=0&&foc>=0){const t=tileOf(foc,selU);if(!t||t.o)selU=-1}
  if(o.ph==='res'||o.ph==='show'){if(o.ph==='res'){selU=-1;selV=-1}}
};
G.postView=()=>{};
G.hud=inGame=>{
  if(!elBox)return;
  const on=!!(inGame&&V&&V.o);
  elBox.hidden=!on;
  const d3=on&&build();
  if(d3!==Dv.on){Dv.on=d3;if(Dv.root)Dv.root.visible=d3;Dv.gn=-1}
  $('#stage').classList.add('dvg');
  $('#stage').classList.toggle('dv2d',on&&!d3);
  if(!on){lastPad='';last2d='';lastHint='';return}
  drawPad();
  sync();
};
G.overDelay=()=>Dv.on?1800:0;
G.overRank=p=>{const t=p.sr===3?'탈주':p.sr?'항복':'';return t?`<span class="left">${t}</span>`:''};
G.overExtra=()=>{
  if(!V||!V.o)return '';
  const L=V.ps.map((p,i)=>`${p.n}: ${V.o.rk[i].map(t=>`${CN[t.c]}${vName2(t.v)}`).join(' ')}`);
  return `<div class="qd-rec"><div class="qd-rec-h"><b>타일</b></div><pre>${esc(L.join('\n'))}</pre></div>`;
};
G.usesDbl=true;
G.handMarks=()=>{};
G.me=()=>{$('#numpick').hidden=true};
G.logCue=()=>false;
G.cues=()=>{};
G.buttons=()=>{
  const pb=$('#btnPlay'),ps=$('#btnPass'),c=myTurn()&&phIs('cont');
  $('#btnGura').hidden=true;pb.hidden=!c;ps.hidden=!c;
  pb.disabled=!c;ps.disabled=!c;pb.classList.toggle('ready',c);
  if($('#playMain').textContent!=='계속')$('#playMain').textContent='계속';
  const sub=keyLabel(KEYS.play);if($('#playSub').textContent!==sub)$('#playSub').textContent=sub;
  if(ps.firstChild.nodeValue!=='멈춤')ps.firstChild.nodeValue='멈춤';
};
G.play=()=>{if(myTurn()&&phIs('cont'))sendAct({t:'cont',go:1})};
G.pass=()=>{if(myTurn()&&phIs('cont'))sendAct({t:'cont',go:0})};
G.keyPhase=st=>st==='play';
G.onKey=()=>false;
G.live=()=>{introTick()};
G.enter=()=>{$('#btnGura').hidden=true;$('#btnPass').hidden=true;$('#btnPlay').hidden=true;$('#numpick').hidden=true};
G.leave=()=>{
  introEnd();foc=-1;selU=-1;selV=-1;focFrom=0;
  if(elBox)elBox.hidden=true;
  if(Dv.root)Dv.root.visible=false;
  Dv.on=false;Dv.gn=-1;
  $('#stage').classList.remove('dvg','dv2d','dv-zoom');
  $('#btnPass').hidden=false;$('#btnPlay').hidden=false;
  $('#btnPass').firstChild.nodeValue='패스';$('#playMain').textContent='내기';
  lastPad='';last2d='';lastHint='';
};
/* 대기실 홀로그램의 대표 말: 세운 타일 둘 */
G.holoPiece=mkM=>{
  const g=new THREE.Group(),tx=canvasTex(128,184,(x,w,h)=>{x.fillStyle='#fff';x.fillRect(0,0,w,h);x.fillStyle='#3a3a3e';x.font='700 112px "IBM Plex Mono", monospace';x.textAlign='center';x.textBaseline='middle';x.fillText('7',w/2,h/2+6)});
  const a=new THREE.Mesh(new THREE.BoxGeometry(.3,.43,.1),mkM(0x2a2a2e));a.position.set(-.15,0,-.05);a.rotation.y=.28;g.add(a);
  const w=mkM(0xf1ebde),b=new THREE.Mesh(new THREE.BoxGeometry(.3,.43,.1),[w,w,w,w,mkM(0xffffff,tx),w]);b.position.set(.15,.02,.03);b.rotation.y=-.2;g.add(b);
  g.rotation.x=-.12;return g;
};
G.init=()=>{
  const css=document.createElement('style');
  css.textContent=`
.dv-box{position:absolute;inset:0;pointer-events:none;z-index:3}
.dv-box[hidden]{display:none}
.stage.dvg .seat:not(.out) .ct{display:none}
.stage.dv-zoom .labels,.stage.dv-zoom .myplate,.stage.dv-zoom .actions{opacity:0;pointer-events:none;transition:opacity .25s}
.stage.dvg .labels,.stage.dvg .myplate,.stage.dvg .actions{transition:opacity .25s}
.stage.dv2d #cv{visibility:hidden}
.stage.dvg #dim,.stage.dvg .nogl{visibility:hidden}
.stage.dvg .actions{left:auto}
.stage.dvg:not(.dv-zoom) .dv-pad{bottom:66px}
.dv-hint{position:absolute;top:10px;left:50%;transform:translateX(-50%);padding:3px 12px;border-radius:999px;background:rgba(59,42,31,.74);color:#fff6e4;font-size:13px;white-space:nowrap}
.dv-hint:empty{display:none}
.dv-pad{position:absolute;left:0;right:0;bottom:calc(10px + env(safe-area-inset-bottom,0px)*0);display:flex;flex-direction:column;align-items:center;gap:8px;padding:0 8px;pointer-events:auto;perspective:700px}
.dv-pad[hidden]{display:none}
.dv-my{display:flex;flex-wrap:wrap;justify-content:center;align-items:flex-end;gap:3px;padding:6px 8px;max-width:100%;box-sizing:border-box;border-radius:10px;background:linear-gradient(#7a4a26,#5a3218);box-shadow:0 3px 0 #3a2010,0 6px 12px rgba(0,0,0,.35);transform:rotateX(14deg)}
.dvt{width:30px;height:43px;border:0;border-radius:5px;padding:0;display:inline-flex;align-items:center;justify-content:center;position:relative;box-sizing:border-box;font:700 19px "IBM Plex Mono",monospace;box-shadow:0 3px 0 rgba(0,0,0,.45)}
.dvt.b{background:#2a2a2e;color:#f4efe3}.dvt.w{background:#f1ebde;color:#26262a}
.dvt.open{opacity:.55;transform:translateY(3px)}
.dvt.held{margin-left:9px;outline:2px solid #ffc83a}
.dvt.can{cursor:pointer;outline:2px dashed #ffc83a}
.dvt.sel{outline:3px solid #ffc83a}
.dvt.wide{width:auto;padding:0 12px}
.dvgap{width:22px;height:43px;border:2px dashed #ffc83a;border-radius:5px;background:rgba(255,200,58,.2);color:#ffc83a;font:700 16px monospace;padding:0;cursor:pointer}
.dv-keys{display:grid;grid-template-columns:repeat(7,minmax(0,50px));gap:5px;padding:8px;border-radius:12px;background:linear-gradient(#845028,#5f361a);box-shadow:0 4px 0 #3a2010,0 8px 16px rgba(0,0,0,.4);transform:rotateX(12deg);transform-origin:50% 100%}
.dvk{height:48px;min-width:0;border:0;border-radius:6px;padding:0;font:700 19px "IBM Plex Mono",monospace;cursor:pointer;box-shadow:0 4px 0 rgba(0,0,0,.45);transition:transform .08s}
.dvk.b{background:#2a2a2e;color:#f4efe3}.dvk.w{background:#f1ebde;color:#26262a}
.dvk.dm{opacity:.35}
.dvk.on{outline:3px solid #ffc83a;transform:translateY(-4px)}
.dvk[data-k="12"]{font:600 13px "Jua",sans-serif}
.dvk.go{background:#b9ab90;color:#5b4129;font:600 14px "Jua",sans-serif}
.dvk.go.ready{background:#d8392b;color:#fff6e4}
.dv-2d{position:absolute;left:0;right:0;top:52px;display:flex;flex-direction:column;align-items:center;gap:20px;pointer-events:auto;color:#3b2a1f}
.dv-row{display:flex;flex-wrap:wrap;gap:4px;align-items:center;justify-content:center}
.dv-row b{margin-right:6px;font-size:13px}.dv-row.on b{color:#b5521e}
@media (max-width:520px){.dvt{width:25px;height:37px;font-size:16px}.dvgap{width:18px;height:37px}.dvk{height:42px;font-size:17px}.dv-keys{gap:4px;padding:6px}}
`;
  document.head.appendChild(css);
  elBox=document.createElement('div');elBox.className='dv-box';elBox.hidden=true;
  elBox.innerHTML='<div class="dv-hint" aria-live="polite"></div><div class="dv-2d"></div><div class="dv-pad" hidden></div>';
  $('#stage').appendChild(elBox);
  elHint=elBox.querySelector('.dv-hint');el2d=elBox.querySelector('.dv-2d');elPad=elBox.querySelector('.dv-pad');
  elPad.addEventListener('click',e=>{
    const k=e.target.closest('[data-k]');if(k){pickKey(+k.dataset.k);return}
    if(e.target.closest('[data-go]')){submit();return}
    const a=e.target.closest('[data-at]');if(a){sendAct({t:'place',at:+a.dataset.at});return}
    const r=e.target.closest('[data-rv]');if(r)sendAct({t:'reveal',u:+r.dataset.rv});
  });
  el2d.addEventListener('click',e=>{
    const b=e.target.closest('[data-u]');if(b){foc=+b.dataset.s;pickTarget(foc,+b.dataset.u);return}
    const c=e.target.closest('[data-pc]');if(c){const q=V.o.pool.filter(t=>t.c===+c.dataset.pc);if(q.length)sendAct({t:'draw',u:pick(q).u})}
  });
  $('#cv').addEventListener('click',cvClick);
  // 상대 이름표를 눌러도 그쪽으로 다가감 (휴대폰에서 옆자리 패가 화면 밖일 때)
  $('#labels').addEventListener('click',e=>{
    if(!currentG()||!V||V.st!=='play'||!myTurn()||!phIs('guess'))return;
    const el=e.target.closest('.seat[data-i]');if(!el)return;
    const i=+el.dataset.i;if(i===meI()||V.ps[i].f)return;
    e.stopPropagation();setFocus(i);
  },true);
  document.addEventListener('keydown',e=>{if(e.code==='Escape'&&foc>=0&&currentG()&&myTurn())setFocus(-1)});
};
const currentG=()=>typeof GAMES!=='undefined'&&V&&V.cfg&&GAMES[V.cfg.game]===G;
G._dv={Dv,IN,get foc(){return foc},get selU(){return selU}};   // 화면 검사용
(window.GAMES=window.GAMES||{}).davinci=G;
})();
