/* ===== 구라! 다이스 게임 모듈 =====
   공통 코드(index.html)가 GAMES.liardice의 함수를 불러서 이 게임의 규칙·봇·화면을 그림.
   2~4명 라이어스 다이스. 각자 주사위를 컵으로 덮어 굴리고(나만 봄), 차례대로 "이 눈이 모두 합쳐 최소 몇 개"라고 선언.
   다음 사람은 개수를 올리거나(눈은 아무거나), 개수는 그대로 두고 더 큰 눈으로 올림. 아니라고 생각하면 누구든 구라!
   모두 공개해서 선언이 맞으면 구라!를 외친 사람이, 틀리면 선언한 사람이 생명(또는 주사위) 1개를 잃음. 마지막 한 사람이 승리.
   규칙 묶음(사용자가 정함, 2026-11-06): 구라! 다이스(기본) · 페루도(1 와일드·주사위 잃기·칼사·팔리피코) · 커스텀(항목마다 켜고 끔)
   spot on(설정): 내 차례에 직전 선언에 '도전'(정확하면 나 빼고 모두 -1, 틀리면 나 -1). 구라!에 개수가 정확하면 선언한 사람 빼고 모두 -1(spot on!)
   판 ph: roll(컵 흔들기) → bid(선언) → show(공개) → roll … → done */
(function(){
const G={id:'liardice',name:'구라! 다이스',short:'다이스',lead:'컵 속 주사위로 허세를 부리는 게임',maxHi:4,minN:2,noFast:true,oneBotLv:true,botLvs:['쉬움'],firstPick:true};

/* ---------- 규칙 값 ---------- */
const ROLL_MS=1300,OPEN_MS=450;
/* 공개 연출 (ms, 공개 시작 기준): 말풍선 → 컵이 들림 → 맞는 주사위를 하나씩 셈 → 판정 → 끝 */
const SH={lift:450,liftDur:550,count0:1150,per:190,verdictGap:300,hold:1900};
const showLen=n=>SH.count0+n*SH.per+SH.verdictGap+SH.hold;
const verdictAt=n=>SH.count0+n*SH.per+SH.verdictGap;
const PRESET=[{wild:0,dl:0,spot:0,calza:0,pal:0},{wild:1,dl:1,spot:0,calza:1,pal:1}];   // 0 구라! 다이스, 1 페루도
const PKEYS=['wild','dl','spot','calza','pal'];
const PNAME=['구라! 다이스','페루도'];
const presetOf=c=>PRESET.findIndex(P=>PKEYS.every(k=>(+c[k]?1:0)===P[k]));
const diffKeys=c=>{const pos=presetOf(c);if(pos>=0)return [];const d=P=>PKEYS.filter(k=>(+c[k]?1:0)!==P[k]);const a=d(PRESET[0]),b=d(PRESET[1]);return a.length<=b.length?a:b};
const SEAT_C=['#c53026','#2b65ca','#1f7a2e','#c9831a'];   // 자리 색 (첫 차례 주사위 면과 같음: DicePick.SEAT_COL 앞 넷)

/* ---------- 선언 규칙 (방장 엔진과 화면이 같은 함수를 씀) ----------
   r: {wild, pal(팔리피코 판), free(팔리피코라도 눈을 바꿀 수 있는 사람: 생명·주사위가 1개 남은 사람)}
   prev: 직전 선언 {q,f} 또는 null. 돌려주는 값: 눈 f로 선언할 수 있는 최소 개수 (못 하면 Infinity) */
function minQ(prev,f,r){
  const w=r.wild&&!r.pal;
  if(!prev)return w&&f===1?Infinity:1;   // 첫 선언: 1이 와일드면 1로는 못 함
  if(r.pal&&!r.free)return f===prev.f?prev.q+1:Infinity;   // 팔리피코: 눈은 그대로, 개수만
  if(!w)return f>prev.f?prev.q:prev.q+1;
  if(prev.f===1)return f===1?prev.q+1:prev.q*2+1;   // 1에서 다른 눈: 두 배 + 1
  if(f===1)return Math.ceil(prev.q/2);   // 다른 눈에서 1: 절반(올림)
  return f>prev.f?prev.q:prev.q+1;
}
const countOf=(dice,f,r)=>{const w=r.wild&&!r.pal&&f!==1;let n=0;for(const a of dice)for(const d of a)if(d===f||(w&&d===1))n++;return n};
const matches=(d,f,r)=>d===f||(r.wild&&!r.pal&&f!==1&&d===1);

G.cardHTML=()=>'';G.drawFace=()=>{};G.cmpCard=()=>0;G.labelOf=()=>'';   // 카드 없음 (hand는 표시용 값 하나)

/* ---------- 규칙 설명·방 설정 ---------- */
G.rulesHTML='<ol class="rules"><li><b>준비</b> : 각자 주사위 5개를 컵으로 덮어 굴립니다. 내 주사위는 나만 봅니다. 생명은 3개입니다</li><li><b>선언</b> : 차례대로 "이 눈이 모두의 주사위를 합쳐 <b>최소 몇 개</b>"라고 선언합니다. 오른쪽 아래에서 눈과 개수를 고르고 [선언]을 누릅니다</li><li><b>올리기</b> : 다음 사람은 개수를 올리거나(눈은 아무거나), 개수는 그대로 두고 더 큰 눈으로 올립니다</li><li><b>구라!</b> : 선언이 아닌 것 같으면 선언한 사람 말고 누구든 <b>구라!</b>를 외칩니다. 모두 공개해서 그 눈이 선언한 개수 이상이면 구라!를 외친 사람이, 모자라면 선언한 사람이 생명 1개를 잃습니다</li><li><b>다음 판</b> : 생명을 잃은 사람부터 다시 굴립니다. 생명이 모두 없어지면 탈락하고, 마지막까지 남은 사람이 <b>승리</b>합니다</li><li><b>제한 시간</b> : 시간이 지나면 선언이 있으면 구라!, 없으면 가장 낮은 선언을 합니다</li><li><b>규칙 묶음</b> : 탁자 설정에서 구라! 다이스(위 규칙)·페루도·커스텀을 고릅니다<ul><li><b>1 와일드</b> : 1은 모든 눈으로 셉니다. 첫 선언은 1로 할 수 없습니다. 다른 눈에서 1로 바꿀 때는 개수를 절반(올림)까지 내릴 수 있고, 1에서 다른 눈으로 바꿀 때는 두 배 + 1 이상이어야 합니다</li><li><b>주사위 잃기</b> : 생명 대신 주사위를 하나씩 잃습니다. 주사위가 모두 없어지면 탈락합니다</li><li><b>spot on</b> : 내 차례에 직전 선언에 <b>도전</b>할 수 있습니다. 개수가 정확하면 나를 뺀 모두가, 아니면 내가 1개를 잃습니다. 구라!를 외쳤는데 개수가 정확하면(spot on!) 선언한 사람을 뺀 모두가 1개를 잃습니다</li><li><b>칼사</b> : 내 차례에 직전 선언이 정확하다고 <b>칼사</b>를 외칩니다. 맞으면 내가 1개를 되찾고(처음 개수까지), 틀리면 1개를 잃습니다</li><li><b>팔리피코</b> : 처음으로 1개만 남은 사람이 생기면 그 사람부터 한 판 동안 1이 와일드가 아니고, 처음 선언한 눈을 바꿀 수 없습니다(1개만 남은 사람은 바꿀 수 있음). 사람마다 한 번만 열립니다</li></ul></li></ol>';
G.modeDesc=['마지막 한 사람이 남을 때까지','마지막 한 사람이 남을 때까지'];
G.defaults={max:4,turn:30,lives:3,dice:5,wild:0,dl:0,spot:0,calza:0,pal:0,pickfirst:0};
G.roomSet=[
  {k:'turn',label:'제한 시간',unit:'초',lo:10,hi:90,step:5,desc:'시간이 지나면 선언이 있으면 구라!, 없으면 가장 낮은 선언을 합니다'},
  {k:'lives',label:'생명',unit:'개',lo:1,hi:5,step:1,lever:1,desc:'처음 생명 수. 주사위 잃기를 켜면 쓰지 않습니다'},
  {k:'dice',label:'주사위',unit:'개',lo:2,hi:6,step:1,lever:1,desc:'한 사람이 굴리는 주사위 수'}];
G.ruleSet=[
  {k:'wild',label:'1 와일드',desc:'1을 모든 눈으로 셉니다'},
  {k:'dl',label:'주사위 잃기',desc:'생명 대신 주사위를 하나씩 잃고, 주사위가 모두 없어지면 탈락합니다'},
  {k:'spot',label:'spot on',desc:'내 차례에 직전 선언에 도전합니다. 정확하면 나 빼고 모두, 아니면 내가 1개를 잃습니다. 구라!에 개수가 정확해도 선언한 사람 빼고 모두 1개를 잃습니다. 칼사와 함께 켤 수 없습니다'},
  {k:'calza',label:'칼사',desc:'내 차례에 직전 선언이 정확하다고 외칩니다. 맞으면 1개를 되찾고, 틀리면 1개를 잃습니다. spot on과 함께 켤 수 없습니다'},
  {k:'pal',label:'팔리피코',desc:'처음 1개만 남은 사람이 생기면 한 판 동안 1이 와일드가 아니고 눈을 바꿀 수 없습니다'},
  {k:'pickfirst',pick:1,label:'선 플레이어',desc:'선택: 방장이 대기실에서 먼저 선언할 사람을 고릅니다. 무작위: 주사위로 정합니다'}];
/* spot on과 칼사는 둘 다 '정확' 외치기라 하나만: 방금 켠 쪽을 남김 */
G.fixCfg=(c,n,strict)=>{
  const r={...c};
  if(+r.spot&&+r.calza){const was=H&&H.cfg?H.cfg:{};if(+was.spot)r.spot=0;else r.calza=0}
  return r;
};
const ruleOf=k=>G.ruleSet.find(d=>d.k===k);
G.modeLabel=c=>PNAME[presetOf(c)]||'커스텀';
G.boardSet=c=>{
  const pos=presetOf(c),lv=pos===0?0:pos===1?2:1,df=new Set(diffKeys(c)),rs=roomSetOf(G,c);
  const num=k=>{const d=rs.find(x=>x.k===k);return {kind:'num',...d,v:+(c[k]??G.defaults[k]),diff:false}};
  return [{kind:'choice',k:'preset',label:'규칙',opts:['구라! 다이스','커스텀','페루도'],desc:'구라! 다이스: 아래 항목 모두 끔 · 페루도: 1 와일드·주사위 잃기·칼사·팔리피코. 아래 항목을 바꾸면 커스텀이 됩니다',v:lv,act:o=>'ld:pr:'+['0','c','1'][o]},
    ...PKEYS.map(k=>{const d=ruleOf(k);return {kind:'tog',k,label:d.label,desc:d.desc,v:+c[k]?1:0,diff:df.has(k),act:()=>'ld:t:'+k}}),
    ...(+c.dl?[]:[num('lives')]),num('dice'),
    rbRuleItem(ruleOf('pickfirst'),c)];
};
G.panelAct=a=>{
  if(!a.startsWith('ld:'))return false;
  if(!(mode==='host'&&H&&H.phase==='wait'))return true;
  const p=a.split(':');
  if(p[1]==='pr'){if(p[2]==='c'){lastPanelHtml='';renderPanel();return true}H.cfg={...H.cfg,...PRESET[+p[2]]}}
  else if(p[1]==='t'&&PKEYS.includes(p[2])){
    const k=p[2],on=+H.cfg[k]?0:1,nc={...H.cfg,[k]:on};
    if(on&&k==='spot')nc.calza=0;if(on&&k==='calza')nc.spot=0;
    H.cfg=nc;
  }else return true;
  saveRoomCfg(H.cfg);sfx('tick');lastPanelHtml='';mark();return true;
};
const ruleTxt=c=>{const pos=presetOf(c);if(pos>=0)return PNAME[pos];const on=PKEYS.filter(k=>+c[k]).map(k=>ruleOf(k).label);return '커스텀'+(on.length?' ('+on.join('·')+')':'')};
G.cfgChips=c=>`<span class="chip"><b>${esc(ruleTxt(c))}</b></span>${+c.dl?'':`<span class="chip">생명 <b>${+c.lives||3}개</b></span>`}<span class="chip">주사위 <b>${+c.dice||5}개</b></span><span class="chip">제한 시간 <b>${+c.turn||30}초</b></span>`;
G.cfgSum=c=>`${ruleTxt(c)} · ${+c.dl?'':`생명 ${+c.lives||3}개 · `}주사위 ${+c.dice||5}개 · 제한 시간 ${+c.turn||30}초 · 선 ${+c.pickfirst?'선택':'무작위'}`;
G.roomSub=()=>'2~4명 주사위 허세 게임';
G.pubExtra=()=>({});
G.cardInfo=()=>'<p class="cardinfo">주사위 · 컵</p>';
G.rankTitle=()=>'';
G.finLabel=f=>f===1?'승리':'탈락';
G.noEmotes=[];
G.keys={ldExact:'KeyG'};   // 구라!는 구라! 키(gura), 선언은 내기 키(play), 개수는 ↑↓(bjUp·bjDown)·선언 휠 키(numUp·numDown), 눈은 ←→(miaL·miaR)
G.keyActions=[{a:'ldExact',n:'도전 / 칼사',d:'구라! 다이스: 직전 선언이 정확하다고 외칩니다(spot on·칼사를 켰을 때). 구라!는 구라! 키, 선언은 내기 키, 개수는 ↑↓, 눈은 ←→를 같이 씁니다'}];

/* ---------- 방장 엔진 ---------- */
const C=()=>{const c=H.cfg;return {wild:+c.wild?1:0,dl:+c.dl?1:0,spot:+c.spot?1:0,calza:+c.calza&&!+c.spot?1:0,pal:+c.pal?1:0,L:Math.max(1,Math.min(5,+c.lives||3)),D:Math.max(2,Math.min(6,+c.dice||5))}};
const alive=()=>H.players.map((_,i)=>i).filter(i=>!H.players[i].finished);
const lifeOf=i=>{const p=H.players[i];return H.ld.cf.dl?p.dc:p.lv};
function nextAlive(i){const n=H.players.length;for(let k=1;k<=n;k++){const j=(i+k)%n;if(!H.players[j].finished)return j}return -1}
const aliveOr=i=>H.players[i]&&!H.players[i].finished?i:nextAlive(i);
const pushEv=e=>{const O=H.ld;e.q=++O.sq;O.ev.push(e);if(O.ev.length>12)O.ev.shift();return e};
const ruleNow=seat=>{const O=H.ld;return {wild:O.cf.wild,pal:O.pal>=0,free:O.pal>=0&&seat>=0&&lifeOf(seat)===1}};
const totalDice=()=>H.ld.dice.reduce((a,d)=>a+d.length,0);
function setTurn(i){H.turn=i;H.deadline=clock()+(+H.cfg.turn||30)*1000;H.botActAt=H.players[i].bot?clock()+rand(1500,2900):0;mark()}
function startRound(st){
  const O=H.ld;
  O.pal=O.palNext;O.palNext=-1;
  O.dice=H.players.map((p,i)=>p.finished?[]:Array.from({length:O.cf.dl?p.dc:O.cf.D},()=>1+(Math.random()*6|0)).sort((a,b)=>a-b));
  Object.assign(O,{bid:null,hist:[],ph:'roll',rollAt:clock()+ROLL_MS,rn:O.rn+1,start:st,sh:null});
  H.turn=st;H.deadline=clock()+864e5;H.botActAt=0;H.seatNote={};mark();
}
function doBid(seat,q,f){
  const O=H.ld;O.bid={q,f,s:seat};O.hist.push({q,f,s:seat});if(O.hist.length>16)O.hist.shift();H.seatNote={};
  addLog(`${H.players[seat].name} : ${f} ${q}개`);
  pushEv({k:'b',s:seat,q,f});setTurn(nextAlive(seat));
}
/* 외치기: k = g(구라!) · x(도전, spot on) · c(칼사) */
function doCall(seat,k){
  const O=H.ld,B=O.bid,cf=O.cf,r=ruleNow(-1),n=countOf(O.dice,B.f,r),ex=n===B.q,tr=n>=B.q,d={};
  let res,st=seat;
  const all=(but,v)=>{for(const i of alive())if(i!==but)d[i]=v};
  if(k==='g'){
    if(tr&&cf.spot&&ex){res='spot';all(B.s,-1)}
    else if(tr){res='true';d[seat]=-1}
    else{res='lie';d[B.s]=-1;st=B.s}
  }else if(k==='x'){if(ex){res='xok';all(seat,-1)}else{res='xno';d[seat]=-1}}
  else{if(ex){res='cok';d[seat]=1}else{res='cno';d[seat]=-1}}
  const m=O.dice.reduce((a,dd)=>a+dd.filter(v=>matches(v,B.f,r)).length,0);
  O.ph='show';O.sh={k,by:seat,bid:{...B},n,res,d,st,t0:clock(),m,ms:showLen(m)};
  H.turn=-1;H.botActAt=0;H.deadline=clock()+864e5;H.seatNote={};
  const NM={g:'구라!',x:'도전',c:'칼사'};
  addLog(`${H.players[seat].name} ${NM[k]} · ${B.f} ${n}개`,res==='true'||res==='cok'?'fin':'lie');
  pushEv({k:'c',s:seat,c:k});mark();
}
function retire(seats){
  const O=H.ld;if(!seats.length)return;
  for(const i of seats){const p=H.players[i];p.finished=true;p.hand=[];p.rank=O.rank-seats.length+1}
  O.rank-=seats.length;
}
function checkOver(){
  const L=alive();if(L.length>1)return false;
  const O=H.ld;O.ph='done';
  if(L[0]!=null){const p=H.players[L[0]];p.finished=true;p.rank=1;p.hand=[];addLog(`${p.name} 승리!`,'fin')}
  H.phase='over';H.botActAt=0;H.deadline=0;H.turn=-1;mark();
  H.players.forEach((q,i)=>{if(q.bot&&Math.random()<.5)botEmote(i,'gg',800+Math.random()*1600)});
  return true;
}
function endShow(){
  const O=H.ld,S=O.sh,cf=O.cf,out=[],one=[];
  for(const k in S.d){
    const i=+k,p=H.players[i];if(p.finished)continue;
    const before=lifeOf(i);
    if(cf.dl)p.dc=Math.max(0,Math.min(cf.D,p.dc+S.d[k]));else p.lv=Math.max(0,Math.min(cf.L,p.lv+S.d[k]));
    const now=lifeOf(i);
    if(now<=0){out.push(i);addLog(`${p.name} 탈락`,'lie')}
    else if(now===1&&before>1)one.push(i);
  }
  retire(out);
  if(checkOver())return;
  let st=aliveOr(S.st);
  if(cf.pal){   // 팔리피코: 처음 1개만 남은 사람부터 (사람마다 한 번)
    const n=H.players.length,cand=one.filter(i=>!H.players[i].palUsed).sort((a,b)=>((a-st+n)%n)-((b-st+n)%n));
    if(cand.length){const i=cand[0];H.players[i].palUsed=true;O.palNext=i;st=i;addLog(`팔리피코 · ${H.players[i].name}`,'sys')}
  }
  startRound(st);
}
/* 쉬움 봇: 내 주사위 + 남의 주사위 기대값으로 판단 (남의 실제 주사위는 보지 않음) */
function expectOf(seat,f,r){
  const O=H.ld,mine=O.dice[seat].filter(v=>matches(v,f,r)).length,other=totalDice()-O.dice[seat].length;
  return mine+other*(r.wild&&!r.pal&&f!==1?1/3:1/6);
}
function botAct(i){
  const O=H.ld,r=ruleNow(i),T=totalDice(),B=O.bid,cf=O.cf;
  if(B){
    const e=expectOf(i,B.f,r);
    if((cf.spot||cf.calza)&&Math.abs(e-B.q)<.45&&Math.random()<.2){doCall(i,cf.spot?'x':'c');return}
    if(B.q>e+.6+Math.random()*1.4){doCall(i,'g');return}
  }
  let best=null,bv=-1e9;
  for(let f=1;f<=6;f++){
    const lo=minQ(B,f,r);if(lo>T)continue;
    const e=expectOf(i,f,r),q=Math.max(lo,Math.min(T,Math.round(e-Math.random()*1.2)));
    const v=e-q+Math.random()*.8-(f===1&&r.wild&&!r.pal?.4:0);
    if(v>bv){bv=v;best={q,f}}
  }
  if(!best||(B&&bv<-1.2)){if(B){doCall(i,'g');return}}
  if(!best)best={q:1,f:2};
  doBid(i,best.q,best.f);
}
function openBid(i){   // 시간 초과로 하는 첫 선언: 내 주사위에 가장 많은 눈 1개
  const O=H.ld,r=ruleNow(i),cnt=[0,0,0,0,0,0,0];for(const v of O.dice[i])cnt[v]++;
  let f=2;for(let v=1;v<=6;v++)if(minQ(null,v,r)<=1&&cnt[v]>cnt[f])f=v;
  if(minQ(null,f,r)>1)f=2;
  return f;
}
function timeout(){
  const O=H.ld,i=H.turn,p=H.players[i];
  addLog(`${p.name} 시간 초과`,'sys');
  if(O.bid)doCall(i,'g');else doBid(i,1,openBid(i));
  if(H.phase==='play'&&H.players[i])H.seatNote[i]='시간 초과';
}
function doSurrender(seat){
  const O=H.ld,p=H.players[seat];
  if(H.phase!=='play'||!p||p.finished)return;
  p.surrendered=true;addLog(`${p.name} ${p.deserter?'탈주':'항복'}`,'lie');
  retire([seat]);
  if(checkOver())return;
  if(O.ph==='show'){if(O.sh.st===seat)O.sh.st=nextAlive(seat);mark();return}
  if(O.ph==='bid'&&(H.turn===seat||(O.bid&&O.bid.s===seat))){startRound(nextAlive(seat));return}   // 그 사람의 차례·선언이 걸려 있으면 다시 굴림
  if(O.ph==='bid'||O.ph==='roll'){O.dice[seat]=[];if(O.start===seat)O.start=nextAlive(seat);if(O.ph==='roll'&&H.turn===seat)H.turn=O.start}
  mark();
}
G._test={minQ,countOf,SH,showLen,ROLL_MS,PRESET,presetOf,botAct};
G.engine={
  start(){
    Object.assign(H,{phase:'play',log:[],seatNote:{},field:[],last:null,reveal:null,shouts:[],pending:null,rankNext:1,known:{},turn:0,botActAt:0,deadline:0});
    const n=H.players.length,cf=C();
    H.players.forEach(p=>{p.finished=false;p.rank=null;p.surrendered=false;p.hand=[0];p.lv=cf.L;p.dc=cf.D;p.palUsed=false});
    H.ld={gn:((H.ld&&H.ld.gn)||0)+1,rn:0,cf,rank:n,dice:[],bid:null,hist:[],ph:'roll',sh:null,pal:-1,palNext:-1,ev:[],sq:0,start:0};
    const first=firstSeat(n);H.ld.first=first;
    addLog(`${n}명 시작. ${H.players[first].name}부터 선언합니다.`,'sys');
    startRound(first);
  },
  act(seat,a){
    const O=H.ld;
    if(!O||H.phase!=='play'||seat<0||seat>=H.players.length)return;
    if(a.t==='surrender'){doSurrender(seat);return}
    if(dealing()||O.ph!=='bid'||H.players[seat].finished)return;
    if(a.t==='gura'){if(O.bid&&O.bid.s!==seat)doCall(seat,'g');return}
    if(H.turn!==seat)return;
    if(a.t==='bid'){
      const q=a.q,f=a.f;if(!Number.isInteger(q)||!Number.isInteger(f)||f<1||f>6||q<1||q>totalDice())return;
      if(q<minQ(O.bid,f,ruleNow(seat)))return;
      doBid(seat,q,f);
    }else if(a.t==='exact'){if(O.bid&&O.bid.s!==seat&&(O.cf.spot||O.cf.calza))doCall(seat,O.cf.spot?'x':'c')}
  },
  tick(t){
    const O=H.ld;if(!O||H.phase!=='play')return;
    if(O.ph==='roll'){if(t>=O.rollAt){O.ph='bid';setTurn(aliveOr(O.start))}return}
    if(O.ph==='show'){if(t>=O.sh.t0+O.sh.ms)endShow();return}
    if(O.ph!=='bid')return;
    const cur=H.players[H.turn];
    if(t>=H.deadline)timeout();
    else if(cur.bot&&H.botActAt&&t>=H.botActAt&&!(cur.away&&t<cur.awayAt+AWAY_WAIT))botAct(H.turn);
  },
  snap(s,you,t){
    const O=H.ld,open=O.ph==='show'||O.ph==='done';
    s.ld={gn:O.gn,rn:O.rn,ph:O.ph,cf:{...O.cf},bid:O.bid?{...O.bid}:null,hist:O.hist.map(b=>({...b})),pal:O.pal,first:O.first,
      dn:O.dice.map(d=>d.length),lv:H.players.map(p=>p.lv),dc:H.players.map(p=>p.dc),out:H.players.map(p=>p.finished?1:0),T:totalDice(),sq:O.sq,ev:O.ev.map(e=>({...e}))};
    if(you>=0&&O.dice[you])s.ld.my=O.dice[you].slice();
    if(open&&O.sh)s.ld.all=O.dice.map(d=>d.slice());
    if(O.ph==='roll')s.ld.ra=Math.max(0,Math.round(O.rollAt-t));
    if(O.sh)s.ld.sh={k:O.sh.k,by:O.sh.by,bid:{...O.sh.bid},n:O.sh.n,res:O.sh.res,d:{...O.sh.d},m:O.sh.m,ms:O.sh.ms,el:Math.max(0,Math.round(t-O.sh.t0))};
    s.gr=0;s.dl=O.ph==='bid'&&H.phase==='play'?Math.max(0,Math.round(H.deadline-t)):0;
    if(O.ph!=='bid')delete s.t;
  },
  restore(ms){const O=H.ld;if(!O)return;if(O.rollAt)O.rollAt+=ms;if(O.sh)O.sh.t0+=ms},
  emoPhase:ph=>ph==='play'||ph==='over'
};

/* ---------- 화면: 공통 ---------- */
const PIPS={1:[5],2:[1,9],3:[1,5,9],4:[1,3,7,9],5:[1,3,5,7,9],6:[1,3,4,6,7,9]};
const dieSVG=(v,cls)=>`<svg class="ld-d ${cls||''}" viewBox="0 0 30 30" aria-label="${v}"><rect x="1.5" y="1.5" width="27" height="27" rx="6" fill="#fbf3e0" stroke="#4a3020" stroke-width="2"/>${(PIPS[v]||[]).map(k=>`<circle cx="${[8,15,22][(k-1)%3]}" cy="${[8,15,22][Math.floor((k-1)/3)]}" r="${v===1?4.2:2.8}" fill="${v===1?'#cc3a2e':'#2a2118'}"/>`).join('')}</svg>`;
const HEART='<svg viewBox="0 0 20 18" class="ld-h"><path d="M10 17 2.4 9.6A4.6 4.6 0 0 1 10 3.4a4.6 4.6 0 0 1 7.6 6.2z"/></svg>';
let elBox=null,el2d=null,elPick=null,elCalls=null,elG=null,elX=null,elBid=null;
let pkF=2,pkQ=1,pkCtx='',lockAt=-1e9,last2d='',lastPick='';
const O_=()=>V&&V.ld;
const iSeat=()=>{const i=myIdx();return i>=0&&V&&V.ps&&i<V.ps.length&&O_()&&!O_().out[i]};
const nameOf=i=>V&&V.ps&&V.ps[i]?V.ps[i].n:'';
const myTurn=()=>!!(O_()&&V.st==='play'&&iSeat()&&O_().ph==='bid'&&V.t===myIdx()&&!dealingV());
const ruleV=seat=>{const o=O_();const life=o.cf.dl?o.dc[seat]:o.lv[seat];return {wild:o.cf.wild,pal:o.pal>=0,free:o.pal>=0&&life===1}};
const canGura=()=>{const o=O_();return !!(o&&V.st==='play'&&iSeat()&&o.ph==='bid'&&o.bid&&o.bid.s!==myIdx()&&!dealingV())};
const canExact=()=>{const o=O_();return !!(myTurn()&&o.bid&&(o.cf.spot||o.cf.calza))};
const exactName=()=>{const o=O_();return o&&o.cf.spot?'도전':'칼사'};
const facesOk=()=>{const o=O_(),r=ruleV(myIdx()),out=[];for(let f=1;f<=6;f++)if(minQ(o.bid,f,r)<=o.T)out.push(f);return out};
/* 선택값: 선언이 바뀌면 가장 낮은 선언으로 다시 맞춤 (눈은 직전 눈, 첫 선언이면 내 주사위에 많은 눈) */
function syncPick(){
  const o=O_();if(!o)return;
  const ctx=o.gn+':'+o.rn+':'+(o.bid?o.bid.q+','+o.bid.f+','+o.bid.s:'-');
  if(ctx===pkCtx)return;pkCtx=ctx;
  const F=facesOk();if(!F.length)return;
  let f=o.bid?o.bid.f:2;
  if(!o.bid&&o.my){const cnt=[0,0,0,0,0,0,0];for(const v of o.my)cnt[v]++;for(const v of F)if(cnt[v]>cnt[f]||!F.includes(f))f=v}
  if(!F.includes(f))f=F.find(x=>x>f)||F[0];
  pkF=f;pkQ=minQ(o.bid,f,ruleV(myIdx()));
}
const pickLegal=()=>{const o=O_();return myTurn()&&pkQ>=minQ(o.bid,pkF,ruleV(myIdx()))&&pkQ<=o.T};
function stepF(d){
  if(!myTurn()){sfx('no');return}
  const F=facesOk();if(F.length<2){sfx('no');return}
  const k=F.indexOf(pkF),n=F[((k<0?0:k)+d+F.length)%F.length];
  pkF=n;pkQ=Math.max(minQ(O_().bid,n,ruleV(myIdx())),Math.min(pkQ,O_().T));sfx('tick');lastPick='';drawPick();
}
function stepQ(d){
  if(!myTurn()){sfx('no');return}
  const lo=minQ(O_().bid,pkF,ruleV(myIdx())),n=pkQ+d;
  if(n<lo||n>O_().T){sfx('no');return}
  pkQ=n;sfx('tick');lastPick='';drawPick();
}
function send(a){if(clock()-lockAt<300)return false;lockAt=clock();sendAct(a);return true}
function doBidV(){if(!pickLegal()){sfx('no');return}send({t:'bid',q:pkQ,f:pkF})}
function doGuraV(){if(!canGura()){sfx('no');return}send({t:'gura'})}
function doExactV(){if(!canExact()){sfx('no');return}send({t:'exact'})}
G.handMarks=()=>{};
G.me=()=>{$('#numpick').hidden=true};
G.play=()=>doBidV();
G.pass=()=>{};
G.keyPhase=st=>st==='play';
G.onKey=(act,e)=>{
  if(!O_()||V.cfg.game!=='liardice')return false;
  if(act==='play'){if(!e.repeat)doBidV();return true}
  if(act==='gura'){if(!e.repeat)doGuraV();return true}
  if(act==='ldExact'){if(!e.repeat)doExactV();return true}
  if(act==='bjUp'||act==='numUp'){stepQ(1);return true}
  if(act==='bjDown'||act==='numDown'){stepQ(-1);return true}
  if(act==='miaL'){stepF(-1);return true}
  if(act==='miaR'){stepF(1);return true}
  return false;
};
G.preView=()=>{};
G.postView=()=>{};
G.buttons=()=>{$('#btnGura').hidden=true;$('#btnPlay').disabled=true;$('#btnPass').disabled=true};
G.logCue=()=>false;
const NM={g:'구라!',x:'도전!',c:'칼사!'};
G.cues=(v,pv)=>{
  const a=v.ld,b=pv&&pv.ld;if(!a||!b||a.gn!==b.gn)return;
  for(const e of a.ev)if(e.q>b.sq){
    if(e.k==='b'){sfx('play',1);showBubble(e.s,`<span class="bt sm ld-bb"><b>${e.q}</b>${dieSVG(e.f)}</span>`,1900,'soft')}
    else if(e.k==='c'){if(e.c==='g'){sfx('gura');showBubble(e.s,'<span class="bt">구라!</span>',2100,'real')}else{sfx('gura');showBubble(e.s,`<span class="bt">${NM[e.c]}</span>`,2100,'ldx')}}
  }
  if(a.rn!==b.rn&&a.ph==='roll')sfx('dice');
};
/* 생명·주사위: 이름표 (주사위 잃기면 주사위 아이콘 + 개수, 아니면 하트) */
const SHOWN={k:'',v:null};   // 공개 연출이 판정에 닿기 전에는 생명이 줄지 않게: 다음 판 상태가 오기 전까지 스냅샷 값 그대로
function lifeHTML(i){
  const o=O_();if(!o||o.out[i])return '';
  if(o.cf.dl)return `<span class="ld-life" data-s="${i}">${dieSVG(5,'ld-mini')}<b>${o.dc[i]}</b></span>`;
  return `<span class="ld-life" data-s="${i}">${Array.from({length:o.cf.L},(_,k)=>`<i class="${k<o.lv[i]?'on':''}">${HEART}</i>`).join('')}</span>`;
}
G.nameTag=(p,i)=>V&&V.st!=='wait'&&O_()&&i!==myIdx()?lifeHTML(i):'';
/* 내 생명은 내 이름 칸이 아니라 내 주사위 줄 바로 앞 탁자 위에 (공통 원칙: 내 이름 칸에는 이모티콘·닉네임만) */
function removeMine(){}
function drawMineLife(L,o,i){
  const g=L.c.getContext('2d'),w=L.c.width,h=L.c.height;g.clearRect(0,0,w,h);
  const heart=(x,y,r,on)=>{g.beginPath();g.moveTo(x,y+r*.9);g.bezierCurveTo(x-r*1.6,y-r*.1,x-r*.7,y-r*1.3,x,y-r*.45);g.bezierCurveTo(x+r*.7,y-r*1.3,x+r*1.6,y-r*.1,x,y+r*.9);g.fillStyle=on?'#d8352a':'rgba(59,42,31,.28)';g.fill()};
  if(o.cf.dl){g.fillStyle='rgba(255,250,240,.9)';rr(g,w/2-118,h/2-46,92,92,18);g.fill();g.strokeStyle='#4a3020';g.lineWidth=6;g.stroke();g.fillStyle='#2a2118';for(const [a,b] of [[.25,.25],[.75,.25],[.5,.5],[.25,.75],[.75,.75]]){g.beginPath();g.arc(w/2-118+a*92,h/2-46+b*92,8,0,7);g.fill()}
    g.fillStyle='#fff6e2';g.font='700 92px "IBM Plex Mono", monospace';g.textAlign='left';g.textBaseline='middle';g.shadowColor='rgba(0,0,0,.4)';g.shadowBlur=6;g.fillText('×'+o.dc[i],w/2-14,h/2+4);g.shadowBlur=0}
  else{const n=o.cf.L,gap=72,x0=w/2-(n-1)*gap/2;for(let k=0;k<n;k++)heart(x0+k*gap,h/2,30,k<o.lv[i])}
  L.t.needsUpdate=true;
}

/* ---------- 3D: 컵·주사위·가운데 선언 홀로그램 ----------
   남의 컵은 그 사람 앞(R_CUP)에 엎어 둠. 내 컵은 굴린 뒤 뒤로 눕혀 열고, 내 주사위는 내 앞에 한 줄로 세움(크게).
   공개: 남의 컵이 들려 바깥쪽에 엎어지고, 주사위가 커지며 퍼짐. 선언한 사람부터 시계 방향으로 맞는 주사위에 빛 고리 + 톡 튐, 가운데 숫자가 하나씩 오름.
   모든 움직임은 시각(판 시작·공개 시작)으로 계산 (상태 없음) */
const R_CUP=2.5,R_ASIDE=3.5,R_MINE=3.05,CUP_K=.82,DS=.27,DSM=.36,HY=.9,NW=640,NH=420;
const M={on:false,built:false,fail:false,root:null,raf:0,cups:[],dice:[],rings:[],num:null,key:'',rn:-1,gn:-1,rollEnd:0,showT0:0,shKey:'',lastTick:-1,introT0:0,introTotal:0,fp:null,die:null,said:true};
const ez=k=>k<=0?0:k>=1?1:k*k*(3-2*k);
const lerp=(a,b,k)=>a+(b-a)*k;
function roundBox(s,r,seg){
  const g=new THREE.BoxGeometry(s,s,s,seg,seg,seg),pa=g.attributes.position,na=g.attributes.normal,h=s/2-r;
  for(let k=0;k<pa.count;k++){
    const x=pa.getX(k),y=pa.getY(k),z=pa.getZ(k);
    const cx=Math.max(-h,Math.min(h,x)),cy=Math.max(-h,Math.min(h,y)),cz=Math.max(-h,Math.min(h,z));
    let nx=x-cx,ny=y-cy,nz=z-cz;const l=Math.hypot(nx,ny,nz);
    if(l<1e-9){nx=na.getX(k);ny=na.getY(k);nz=na.getZ(k)}else{nx/=l;ny/=l;nz/=l}
    pa.setXYZ(k,cx+nx*r,cy+ny*r,cz+nz*r);na.setXYZ(k,nx,ny,nz);
  }
  pa.needsUpdate=na.needsUpdate=true;return g;
}
function pipTex(v){
  return canvasTex(128,128,(g,w,h)=>{
    g.fillStyle='#fbf3e0';g.fillRect(0,0,w,h);
    const gr=g.createRadialGradient(w/2,h/2,w*.32,w/2,h/2,w*.74);gr.addColorStop(0,'rgba(120,90,50,0)');gr.addColorStop(1,'rgba(120,90,50,.2)');g.fillStyle=gr;g.fillRect(0,0,w,h);
    const P=[.26,.5,.74],R=v===1?w*.135:w*.088;
    for(const k of PIPS[v]){const x=P[(k-1)%3]*w,y=P[Math.floor((k-1)/3)]*h;g.fillStyle=v===1?'#cc3a2e':'#2a2118';g.beginPath();g.arc(x,y,R,0,7);g.fill()}
  });
}
/* 눈 v가 위로 오는 회전 (면 순서 +x,-x,+y,-y,+z,-z = 3,4,1,6,2,5) */
const UP={1:[0,0,0],6:[Math.PI,0,0],3:[0,0,Math.PI/2],4:[0,0,-Math.PI/2],2:[-Math.PI/2,0,0],5:[Math.PI/2,0,0]};
const qUp={};
const TILT=.62;   // 내 주사위는 윗면이 내 눈 쪽으로 오게 앞으로 기울임 (위에서 비스듬히 보면 옆면과 섞여 읽기 어려움)
function dieQ(v,yaw,tilt){
  if(!qUp[v]){const e=UP[v];qUp[v]=new THREE.Quaternion().setFromEuler(new THREE.Euler(e[0],e[1],e[2],'XYZ'))}
  const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw);
  if(tilt)q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),tilt));
  return q.multiply(qUp[v]);
}
function ringTex(){
  return canvasTex(128,128,(g,w,h)=>{g.clearRect(0,0,w,h);g.shadowColor='#ff8a2a';g.shadowBlur=16;g.strokeStyle='#ffb04a';g.lineWidth=10;rr(g,18,18,w-36,h-36,22);g.stroke()});
}
function build(){
  if(M.built||M.fail)return M.built;
  if(!T.ok||typeof THREE==='undefined'){M.fail=true;return false}
  try{
    const root=new THREE.Group();root.visible=false;T.scene.add(root);M.root=root;
    const ink=new THREE.MeshBasicMaterial({color:GFX_INK,side:THREE.BackSide});
    const dg=roundBox(1,.13,6),mats=[3,4,1,6,2,5].map(v=>toon({map:pipTex(v),rim:.12}));
    M.mkDie=()=>{const g=new THREE.Group(),m=new THREE.Mesh(dg,mats),o=new THREE.Mesh(dg,ink);o.scale.setScalar(1.07);m.castShadow=true;g.add(m,o);g.visible=false;root.add(g);return g};
    const V2=(x,y)=>new THREE.Vector2(x,y);
    const prof=[V2(0,0),V2(.47,0),V2(.5,.05),V2(.58,.97),V2(.62,1),V2(.6,1.03),V2(.54,1.02),V2(.46,.14),V2(0,.14)];
    const lm=toon({color:0x6e3b22,rim:.22});lm.side=THREE.DoubleSide;
    const bodyG=new THREE.LatheGeometry(prof,40),hullG=new THREE.LatheGeometry(prof.slice(0,6).map(v=>V2(v.x+.035,v.y-.02)),40);
    const b1G=new THREE.TorusGeometry(.57,.045,8,40),b2G=new THREE.TorusGeometry(.5,.035,8,40),b2M=toon({color:0xd9a441,rim:.2});
    M.mkCup=col=>{
      const g=new THREE.Group(),inner=new THREE.Group();
      const body=new THREE.Mesh(bodyG,lm);body.castShadow=true;
      const b1=new THREE.Mesh(b1G,toon({color:new THREE.Color(col).getHex(),rim:.2}));b1.rotation.x=Math.PI/2;b1.position.y=.84;
      const b2=new THREE.Mesh(b2G,b2M);b2.rotation.x=Math.PI/2;b2.position.y=.13;
      inner.add(body,new THREE.Mesh(hullG,ink),b1,b2);inner.scale.setScalar(CUP_K);g.add(inner);g.visible=false;root.add(g);return g;
    };
    const rt=ringTex(),rg=new THREE.PlaneGeometry(1,1);
    M.mkRing=()=>{const m=new THREE.Mesh(rg,new THREE.MeshBasicMaterial({map:rt,transparent:true,depthWrite:false}));m.rotation.order='YXZ';m.rotation.x=-Math.PI/2;m.renderOrder=2;m.visible=false;root.add(m);return m};
    const c=document.createElement('canvas');c.width=NW;c.height=NH;const t=new THREE.CanvasTexture(c);t.anisotropy=4;
    const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true,depthTest:false,depthWrite:false}));sp.position.set(0,HY,.3);sp.scale.set(1.9,1.25,1);sp.renderOrder=55;root.add(sp);
    M.num={c,t,sp};
    {const c2=document.createElement('canvas');c2.width=384;c2.height=128;const t2=new THREE.CanvasTexture(c2);t2.anisotropy=4;
     const m=new THREE.Mesh(new THREE.PlaneGeometry(1.2,.4),new THREE.MeshBasicMaterial({map:t2,transparent:true,depthWrite:false}));m.rotation.order='YXZ';m.rotation.x=-Math.PI/2;m.renderOrder=2;m.visible=false;root.add(m);M.life={c:c2,t:t2,m,key:''}}
    if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>{M.key=''});
    M.built=true;
  }catch(e){M.fail=true;try{console.warn('구라! 다이스 3D 준비 실패',e)}catch(_){}}
  return M.built;
}
const cupOf=i=>M.cups[i]||(M.cups[i]=M.mkCup(SEAT_C[i%SEAT_C.length]));
const dieOf=(i,k)=>{const a=M.dice[i]||(M.dice[i]=[]);return a[k]||(a[k]=M.mkDie())};
const ringOf=(i,k)=>{const a=M.rings[i]||(M.rings[i]=[]);return a[k]||(a[k]=M.mkRing())};
const CUP_H=CUP_K*1.03;
/* 컵 자세: closed(그 자리에 엎음) · aside(바깥쪽에 엎음) · open(내 컵: 뒤로 눕혀 입구가 나를 봄) */
function cupPose(i,kind){
  const a=seatAngle(i),me=i===myIdx();
  if(kind==='open'){   // 주사위 줄 오른쪽에 옆으로 눕힘, 입구가 주사위 쪽(쏟은 모양)
    const off=DSM*1.22*2+DSM/2+.2,r=R_MINE+.05;
    return {p:new THREE.Vector3(Math.sin(a)*r+Math.cos(a)*(off+CUP_K*.95),.5*CUP_K,Math.cos(a)*r-Math.sin(a)*(off+CUP_K*.95)),q:new THREE.Quaternion().setFromEuler(new THREE.Euler(0,a,Math.PI/2+.08,'YXZ'))};
  }
  const r=kind==='aside'?R_ASIDE:me?R_MINE-.2:R_CUP;
  return {p:new THREE.Vector3(Math.sin(a)*r,CUP_H,Math.cos(a)*r),q:new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI,a,0,'YXZ'))};
}
/* 주사위 자리: 컵 아래 뭉치(오각형) · 공개 때 퍼진 자리 · 내 줄 */
function clusterPos(i,k,n,spread){
  const a=seatAngle(i),me=i===myIdx(),c=me?R_MINE-.2:R_CUP,rad=n<=1?0:(n===2?.15:n<=5?.19:.22)*spread;
  const t=n<=1?0:k/n*Math.PI*2+a;
  return new THREE.Vector3(Math.sin(a)*c+Math.cos(t)*rad,0,Math.cos(a)*c+Math.sin(t)*rad);
}
function rowPos(i,k,n){const a=seatAngle(i),gap=DSM*1.22,off=(k-(n-1)/2)*gap;return new THREE.Vector3(Math.sin(a)*R_MINE+Math.cos(a)*off,0,Math.cos(a)*R_MINE-Math.sin(a)*off)}
function lerpPose(A,B,k,arc){const p=A.p.clone().lerp(B.p,k);if(arc)p.y+=Math.sin(Math.PI*k)*arc;return {p,q:A.q.clone().slerp(B.q,k)}}
function setPose(g,P){g.position.copy(P.p);g.quaternion.copy(P.q)}
/* 공개 때 세는 순서: 선언한 사람부터 시계 방향, 사람마다 주사위 순서 */
function countOrder(o){
  const sh=o.sh,all=o.all||[],r={wild:o.cf.wild,pal:o.pal>=0},L=[],n=all.length;if(!sh)return L;
  for(let j=0;j<n;j++){const i=(sh.bid.s+j)%n;(all[i]||[]).forEach((v,k)=>{if(matches(v,sh.bid.f,r))L.push([i,k])})}
  return L;
}
function drawNum(main,f,tag,col,sub,subCol){
  const L=M.num,g=L.c.getContext('2d');
  g.clearRect(0,0,NW,NH);g.textAlign='center';g.textBaseline='middle';
  g.shadowColor=col;g.shadowBlur=30;g.fillStyle=col;
  if(main){
    g.font=`700 ${main.length>3?150:200}px "IBM Plex Mono", "Jua", monospace`;
    const tw=g.measureText(main).width,ds=f?170:0,gap=f?30:0,x0=NW/2-(tw+gap+ds)/2;
    g.textAlign='left';g.fillText(main,x0,150);g.fillText(main,x0,150);
    if(f){   // 눈: 빛나는 테두리 사각형 + 점
      const x=x0+tw+gap,y=150-ds/2;g.lineWidth=12;g.strokeStyle=col;rr(g,x,y,ds,ds,30);g.stroke();
      const P=[.25,.5,.75];for(const k of PIPS[f]){g.beginPath();g.arc(x+P[(k-1)%3]*ds,y+P[Math.floor((k-1)/3)]*ds,f===1?24:16,0,7);g.fill()}
    }
    g.textAlign='center';
  }
  if(sub){g.shadowColor=subCol||col;g.fillStyle=subCol||col;g.shadowBlur=20;g.font='700 92px "Jua", "IBM Plex Mono", sans-serif';g.fillText(sub,NW/2,340)}
  else if(tag){g.shadowBlur=14;g.font='700 60px "Jua", "IBM Plex Mono", sans-serif';g.fillText(tag,NW/2,330)}
  g.shadowBlur=0;L.t.needsUpdate=true;
}
const RES={true:['진짜!','#ffd24a'],lie:['구라!','#ff5a3c'],spot:['spot on!','#ff7ad9'],xok:['spot on!','#ff7ad9'],xno:['실패','#ff5a3c'],cok:['칼사!','#7ee07a'],cno:['실패','#ff5a3c']};
const TRUE_RES=new Set(['true','spot','xok','cok']);
/* 상태가 오면 시각 기준을 잡음 */
G.field3D=(v)=>{
  if(T.stacks)for(const arr of T.stacks.values())arr.forEach(c=>{c.visible=false});   // 손패 표시용 값이 만든 남의 카드 더미는 숨김
  const o=v.ld;if(!o)return;
  if(o.gn!==M.gn||o.rn!==M.rn){
    const fresh=o.gn!==M.gn;M.gn=o.gn;M.rn=o.rn;
    M.rollEnd=o.ph==='roll'?clock()+(o.ra||0):fresh?clock()-ROLL_MS-OPEN_MS:clock()-OPEN_MS;
    M.prevSh=fresh?null:M.lastSh;M.lastTick=-1;
  }
  if(o.sh){const k=o.gn+':'+o.rn+':'+o.sh.by;if(k!==M.shKey){M.shKey=k;M.showT0=clock()-(o.sh.el||0);M.lastTick=-1;M.verdictSaid=false}M.lastSh=o.sh}
};
function step(){
  M.raf=0;if(!M.on||!V||!O_())return;
  M.raf=requestAnimationFrame(step);
  const now=clock(),o=O_(),me=myIdx(),n=V.ps.length,show=V.st!=='wait'&&!(IN.on&&now<IN.t0+IN.cupAt);
  const inShow=(o.ph==='show'||o.ph==='done')&&o.sh,e=inShow?now-M.showT0:0;
  const rollK=o.ph==='roll'?Math.max(0,(now-(M.rollEnd-ROLL_MS))/ROLL_MS):1;
  const backK=ez((now-(M.rollEnd-ROLL_MS))/380);   // 새 판: 옆에 있던 컵이 제자리로
  const openK=o.ph==='roll'?0:ez((now-M.rollEnd)/OPEN_MS);
  const liftK=inShow?ez((e-SH.lift)/SH.liftDur):0;
  const order=inShow?countOrder(o):[],cnt=inShow?Math.max(0,Math.min(order.length,Math.floor((e-SH.count0)/SH.per)+1)):0;
  if(inShow&&cnt!==M.lastTick&&e>=SH.count0){if(cnt>M.lastTick&&cnt>0)tone(880+cnt*40,.05,{type:'triangle',vol:.08});M.lastTick=cnt}
  const lit=new Set(order.slice(0,cnt).map(([i,k])=>i+':'+k)),hopAt=new Map(order.map(([i,k],j)=>[i+':'+k,SH.count0+j*SH.per]));
  for(let i=0;i<Math.max(n,M.cups.length);i++){
    const alive=i<n&&show&&!o.out[i]&&(o.dn[i]>0||inShow),cup=alive||M.cups[i]?cupOf(i):null;
    if(!cup)continue;cup.visible=alive;
    const nd=inShow&&o.all?(o.all[i]||[]).length:o.dn[i]||0,mine=i===me;
    if(alive){
      let P;
      if(mine)P=lerpPose(cupPose(i,'closed'),cupPose(i,'open'),openK,.5);
      else if(inShow)P=lerpPose(cupPose(i,'closed'),cupPose(i,'aside'),liftK,1.1);
      else P=M.prevSh&&o.ph==='roll'?lerpPose(cupPose(i,'aside'),cupPose(i,'closed'),backK,1.1):cupPose(i,'closed');
      if(o.ph==='roll'&&rollK>.25&&rollK<.95&&!(mine&&openK>0)){   // 흔들기 (엎은 채로 달그락)
        const s=now/1000,a=Math.sin(rollK*Math.PI);P.p.y+=Math.abs(Math.sin(s*23+i))*.08*a;P.p.x+=Math.sin(s*31+i*2)*.05*a;P.p.z+=Math.cos(s*27+i)*.05*a;
        P.q.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(s*29+i)*.12*a,0,Math.cos(s*25+i)*.12*a)));
      }
      setPose(cup,P);
    }
    const vals=inShow&&o.all?o.all[i]||[]:mine&&o.my?o.my:[];
    const arr=M.dice[i]||[];
    for(let k=0;k<Math.max(arr.length,vals.length);k++){
      const d=dieOf(i,k),rg=ringOf(i,k),has=alive&&k<vals.length&&k<nd;
      const vis=has&&(mine?openK>0||inShow:inShow&&liftK>.15);
      d.visible=vis;rg.visible=false;if(!vis)continue;
      const v=vals[k],a=seatAngle(i);
      let p,s,yaw,tilt=0;
      if(mine){p=clusterPos(i,k,vals.length,1).lerp(rowPos(i,k,vals.length),openK);s=lerp(DS,DSM,openK);yaw=a;tilt=TILT*openK}
      else{p=clusterPos(i,k,vals.length,lerp(1,1.7,liftK));s=lerp(DS,DS*1.35,liftK);yaw=a+k*.7}
      const key=i+':'+k,h=hopAt.get(key);let hop=0;
      if(h!=null&&e>=h){const t=(e-h)/260;if(t<1)hop=Math.sin(Math.PI*t)*.28}
      d.position.set(p.x,s/2*(Math.cos(tilt)+Math.sin(tilt))+hop,p.z);d.quaternion.copy(dieQ(v,yaw,tilt));d.scale.setScalar(s);
      if(lit.has(key)){rg.visible=true;rg.position.set(p.x,.022,p.z);rg.rotation.y=yaw;rg.scale.setScalar(s*1.6);rg.material.opacity=.8+.2*Math.sin(now/160)}
    }
  }
  /* 내 생명: 주사위 줄 바로 앞(내 쪽) 나무 위. 좁은 화면에서도 잘리지 않게 가운데 */
  {const L=M.life,ok=show&&me>=0&&!o.out[me];L.m.visible=ok;
   if(ok){const a=seatAngle(me),off=0,r=R_MINE+.5;L.m.position.set(Math.sin(a)*r+Math.cos(a)*off,.02,Math.cos(a)*r-Math.sin(a)*off);L.m.rotation.y=a;
     const k=[o.cf.dl,o.cf.L,o.lv[me],o.dc[me]].join();if(k!==L.key){L.key=k;drawMineLife(L,o,me)}}}
  /* 가운데 홀로그램 */
  const sp=M.num.sp;sp.visible=show&&(!!o.bid||inShow||o.pal>=0);
  if(sp.visible){
    let key,args;
    if(inShow){
      const vd=e>=verdictAt(order.length),R=RES[o.sh.res]||['',''];
      if(vd&&!M.verdictSaid){M.verdictSaid=true;sfx(TRUE_RES.has(o.sh.res)?'truth':'lie');if(o.sh.res==='spot'||o.sh.res==='xok')sfx('special')}
      args=[`${cnt}/${o.sh.bid.q}`,o.sh.bid.f,'',vd?R[1]:'#ffb04a',vd?R[0]:'',R[1]];
    }else args=[o.bid?String(o.bid.q):'',o.bid?o.bid.f:0,o.pal>=0?'팔리피코':'','#ffb04a','',''];
    key=args.join('|');
    if(key!==M.key){M.key=key;drawNum(...args)}
    sp.position.y=HY+Math.sin(now/600)*.03;
  }
  if(IN.on)introStep(now);
}
function clearAll(){
  for(const g of M.cups)if(g)g.visible=false;
  for(const a of M.dice)for(const d of a||[])if(d)d.visible=false;
  for(const a of M.rings)for(const d of a||[])if(d)d.visible=false;
  if(M.num)M.num.sp.visible=false;
  if(M.life)M.life.m.visible=false;
}

/* ---------- 시작 연출: 컵이 자리에 내려앉고 가운데에서 첫 차례 주사위 ---------- */
const INTRO={pre:900,preA:350,cup:200};
G.introMs=(again,rolls)=>Math.round((again?INTRO.preA:INTRO.pre)+DicePick.totalFor(rolls)+150);
const IN={on:false,t0:0,total:0,r:0,cupAt:0,fp:null,die:null,said:false};
G.intro=(t0,o)=>{
  if(!V||!V.ld||!V.ps)return;
  const rolls=o&&o.rolls,again=!!(o&&o.again);
  IN.on=true;IN.t0=t0;IN.said=false;IN.r=again?INTRO.preA:INTRO.pre;IN.cupAt=again?0:INTRO.cup;IN.total=(o&&o.total)||G.introMs(again,rolls);
  if(IN.die){IN.die.dispose();IN.die=null}
  IN.fp=rolls?firstPick(t0+IN.r,{seats:V.ps.map((_,i)=>i),first:V.ld.first,rolls,seed:(o&&o.seed)||1}):null;
};
function introStep(now){
  const e=now-IN.t0,done=e>=IN.total;
  if(IN.fp&&!IN.fp.fixed&&M.root){
    if(!IN.die&&!done){IN.die=DicePick.mesh(THREE,V.ps.length,SEAT_C);M.root.add(IN.die.g)}
    if(IN.die)IN.die.apply(done||e<IN.r?null:IN.fp.pose(now),.6,0,.03,0);
  }
  if(IN.fp&&e>=IN.r&&!IN.said&&IN.fp.tick(now)){IN.said=true;fxSay(IN.fp.msg(),SEAT_C[IN.fp.first%4])}
  if(done){if(IN.die){IN.die.dispose();IN.die=null}if(IN.fp&&!IN.said){IN.said=true}IN.on=false}
}
function introTick2d(){   // WebGL이 없을 때: 주사위 없이 안내만
  if(!IN.on||M.on)return;
  const now=clock(),e=now-IN.t0;
  if(IN.fp&&e>=IN.r&&!IN.said&&IN.fp.tick(now)){IN.said=true;fxSay(IN.fp.msg(),SEAT_C[IN.fp.first%4])}
  if(e>=IN.total)IN.on=false;
}

/* ---------- 2D: 고르는 칸·외치기 버튼·WebGL이 없을 때 ---------- */
function keyTags(){for(const [el,k] of [[elG,KEYS.gura],[elX,KEYS.ldExact],[elBid,KEYS.play]]){const s=el&&el.querySelector('small'),t=k?keyLabel(k):'';if(s&&s.textContent!==t)s.textContent=t}}
function drawPick(){
  if(!elPick)return;
  const on=myTurn();
  if(elPick.hidden===on)elPick.hidden=!on;
  if(!on)return;
  syncPick();
  const o=O_(),r=ruleV(myIdx()),lo=minQ(o.bid,pkF,r),F=facesOk(),ok=pickLegal();
  const key=[pkF,pkQ,lo,o.T,F.join(''),ok].join('|');if(key===lastPick)return;lastPick=key;
  elPick.querySelector('.ld-face').innerHTML=dieSVG(pkF);
  elPick.querySelector('.ld-q').textContent=pkQ;
  const [fu,fd]=elPick.querySelectorAll('[data-f]'),[qu,qd]=elPick.querySelectorAll('[data-q]');
  fu.disabled=fd.disabled=F.length<2;qu.disabled=pkQ>=o.T;qd.disabled=pkQ<=lo;
  elBid.disabled=!ok;elBid.classList.toggle('ready',ok);
}
function drawCalls(){
  if(!elCalls)return;
  const g=canGura(),x=canExact();
  if(elG.hidden===g)elG.hidden=!g;
  if(elX.hidden===x)elX.hidden=!x;
  if(x){const t=exactName();const b=elX.querySelector('b');if(b.textContent!==t)b.textContent=t}
  elG.classList.toggle('ready',g&&myTurn());
}
function draw2d(){
  if(!el2d||!O_())return;
  if(M.on){if(last2d){el2d.innerHTML='';last2d=''}return}
  const o=O_(),me=myIdx();
  let h='';
  if(o.bid&&o.ph==='bid')h+=`<p class="ld-now">${esc(nameOf(o.bid.s))} : <b>${o.bid.q}</b> ${dieSVG(o.bid.f)}</p>`;
  if(o.pal>=0&&o.ph!=='show'&&o.ph!=='done')h+='<p class="ld-tag">팔리피코</p>';
  if(o.sh&&(o.ph==='show'||o.ph==='done')){
    const r={wild:o.cf.wild,pal:o.pal>=0},R=RES[o.sh.res]||['',''];
    h+=`<p class="ld-now">${o.sh.bid.q} ${dieSVG(o.sh.bid.f)} → <b>${o.sh.n}개</b> <span style="color:${R[1]}">${R[0]}</span></p>`;
    h+='<div class="ld-rows">'+(o.all||[]).map((d,i)=>d.length?`<div class="ld-row"><b>${esc(nameOf(i))}</b>${d.map(v=>dieSVG(v,matches(v,o.sh.bid.f,r)?'hit':'')).join('')}</div>`:'').join('')+'</div>';
  }else if(o.my&&me>=0&&o.ph!=='roll')h+=`<div class="ld-rows"><div class="ld-row me">${lifeHTML(me)}${o.my.map(v=>dieSVG(v)).join('')}</div></div>`;
  if(h!==last2d){el2d.innerHTML=h;last2d=h}
}
G.live=()=>{
  if(!elBox||!O_())return;
  drawPick();drawCalls();keyTags();draw2d();introTick2d();
};
G.hud=inGame=>{
  if(!elBox)return;
  const on=!!(inGame&&V&&O_());
  elBox.hidden=!on;
  const d3=on&&build();
  if(d3!==M.on){M.on=d3;if(M.root)M.root.visible=d3;if(d3){M.key='';if(!M.raf)M.raf=requestAnimationFrame(step)}}
  $('#stage').classList.add('ldg');
  if(!on){if(M.built)clearAll();M.gn=-1;M.rn=-1;removeMine();return}
  draw2d();
};
G.overDelay=()=>0;
G.overRank=p=>{const t=p.sr===3?'탈주':p.sr?'항복':'';return t?`<span class="left">${t}</span>`:''};
G.enter=()=>{$('#btnGura').hidden=true};
G.leave=()=>{
  if(M.built)clearAll();
  if(typeof T!=='undefined'&&T.stacks)for(const arr of T.stacks.values())arr.forEach(c=>{c.visible=true});
  if(elBox)elBox.hidden=true;
  if(M.root)M.root.visible=false;
  if(IN.die){IN.die.dispose();IN.die=null}IN.on=false;
  Object.assign(M,{on:false,gn:-1,rn:-1,key:'',shKey:''});
  pkCtx='';last2d='';lastPick='';
  if(elPick)elPick.hidden=true;if(elG)elG.hidden=true;if(elX)elX.hidden=true;
  $('#stage').classList.remove('ldg');
  $('#btnPlay').disabled=false;$('#btnPass').disabled=false;
  removeMine();
};
G.holoPiece=mkM=>{
  const g=new THREE.Group(),V2=(x,y)=>new THREE.Vector2(x,y);
  const prof=[V2(0,0),V2(.47,0),V2(.5,.05),V2(.58,.97),V2(.62,1),V2(.6,1.03),V2(.54,1.02),V2(.46,.14),V2(0,.14)];
  const cup=new THREE.Mesh(new THREE.LatheGeometry(prof,32),mkM(0xffffff));cup.scale.setScalar(.42);cup.rotation.z=Math.PI;cup.position.set(-.12,.22,0);g.add(cup);
  const die=new THREE.Mesh(new THREE.BoxGeometry(.2,.2,.2),mkM(0xffffff,canvasTex(64,64,(x,w,h)=>{x.fillStyle='#fff';x.fillRect(0,0,w,h);x.fillStyle='#34404f';for(const [a,b] of [[.25,.25],[.75,.25],[.5,.5],[.25,.75],[.75,.75]]){x.beginPath();x.arc(a*w,b*h,7,0,7);x.fill()}})));
  die.position.set(.2,-.08,.05);die.rotation.set(.4,.6,0);g.add(die);
  g.rotation.set(-.2,.3,0);return g;
};
G.init=()=>{
  const css=document.createElement('style');
  css.textContent=`
.ld-box{position:absolute;inset:0;pointer-events:none;z-index:6}
.ld-box[hidden]{display:none}
.stage.ldg #btnPlay,.stage.ldg #btnPass{display:none}
.stage.ldg #dim{display:none}
.stage.ldg .seat .ct{display:none}
.ld-d{width:26px;height:26px;display:inline-block;vertical-align:middle}
.ld-d.hit{filter:drop-shadow(0 0 4px #ffb04a)}
.ld-d.ld-mini{width:14px;height:14px;margin-right:2px}
.ld-life{display:inline-flex;align-items:center;gap:2px;vertical-align:middle;margin-right:5px}
.ld-life b{font-size:13px}
.ld-life i{display:inline-flex}
.ld-h{width:12px;height:11px;fill:#d9cbb4}
.ld-life i.on .ld-h{fill:#d8352a;filter:drop-shadow(0 0 2px rgba(216,53,42,.5))}
.ld-mine{display:inline-flex;align-items:center;margin-left:6px}
.ld-mine .ld-life{margin-right:0}
.bubble.soft .bt.ld-bb{display:inline-flex;align-items:center;gap:calc(6px*var(--bk,1));font-family:"IBM Plex Mono","Jua",monospace;font-size:calc(30px*var(--bk,1))}
.bubble .ld-bb svg.ld-d{position:relative;inset:auto;width:calc(32px*var(--bk,1));height:calc(32px*var(--bk,1))}
.bubble.ldx svg path{fill:#7d3fa8;stroke:#55287a}
.bubble.ldx .bt{color:#fff;text-shadow:0 2px 0 #55287a}
.ld-pick{position:absolute;right:12px;bottom:calc(var(--plateB,14px) + 4px);display:grid;grid-template-columns:auto auto;gap:6px 8px;align-items:center;justify-items:center;padding:8px 10px 10px;border-radius:16px;background:rgba(255,250,240,.86);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);box-shadow:0 2px 10px -3px rgba(59,42,31,.4);pointer-events:auto;z-index:8;user-select:none;touch-action:manipulation;transform:scale(var(--actS,1));transform-origin:100% 100%}
.ld-pick[hidden]{display:none}
.ld-col{display:flex;flex-direction:column;align-items:center;gap:4px}
.ld-arr{width:54px;height:30px;border:none;border-radius:9px;background:rgba(59,42,31,.12);color:var(--ink);font-size:15px;line-height:1;padding:0}
.ld-arr:disabled{opacity:.3}
.ld-arr:active:not(:disabled){background:rgba(59,42,31,.25)}
.ld-face .ld-d{width:50px;height:50px}
.ld-q{font:700 40px/50px "IBM Plex Mono","Jua",monospace;min-width:54px;text-align:center;color:#3b2a1f}
.ld-q::before{content:"×";font-size:22px;margin-right:2px;opacity:.6}
.ld-pick .ld-bid{grid-column:1/3;width:100%;height:50px;min-width:0}
.ld-calls{position:absolute;left:var(--plateL,12px);bottom:calc(var(--plateB,14px) + 54px);display:flex;flex-direction:column;gap:10px;pointer-events:auto;z-index:8;transform:scale(var(--actS,1));transform-origin:0 100%}
.ld-calls .act{min-width:110px}
.ld-calls .act[hidden]{display:none}
.act-ldx{--face:#7d3fa8;--edge:#55287a;--ink-on:#fff}
.ld-2d{position:absolute;left:0;right:0;top:104px;text-align:center;color:#3b2a1f;font-family:"Jua",sans-serif}
.ld-2d p{margin:3px 0}
.ld-now{font-size:20px}.ld-now b{font-size:26px}
.ld-tag{font-size:15px;color:#b5521e}
.ld-rows{display:inline-flex;flex-direction:column;gap:4px;margin-top:6px;text-align:left}
.ld-row{display:flex;align-items:center;gap:4px;font-size:15px}
.ld-row b{min-width:64px}
.ld-row.me .ld-d{width:40px;height:40px}
@media (max-width:520px){.ld-arr{width:46px;height:28px}.ld-face .ld-d{width:42px;height:42px}.ld-q{font-size:34px;line-height:44px;min-width:46px}.ld-calls .act{min-width:96px}}
`;
  document.head.appendChild(css);
  elBox=document.createElement('div');elBox.className='ld-box';elBox.hidden=true;
  elBox.innerHTML=`<div class="ld-2d"></div>
<div class="ld-pick" hidden><div class="ld-col"><button type="button" class="ld-arr" data-f="1" aria-label="큰 눈">▲</button><div class="ld-face"></div><button type="button" class="ld-arr" data-f="-1" aria-label="작은 눈">▼</button></div><div class="ld-col"><button type="button" class="ld-arr" data-q="1" aria-label="개수 늘리기">▲</button><div class="ld-q">1</div><button type="button" class="ld-arr" data-q="-1" aria-label="개수 줄이기">▼</button></div><button type="button" class="act act-play ld-bid">선언<small></small></button></div>
<div class="ld-calls"><button type="button" class="act act-gura ld-g" hidden>구라!<small></small></button><button type="button" class="act act-ldx ld-x" hidden><b>도전</b><small></small></button></div>`;
  $('#stage').appendChild(elBox);
  el2d=elBox.querySelector('.ld-2d');elPick=elBox.querySelector('.ld-pick');elCalls=elBox.querySelector('.ld-calls');elG=elBox.querySelector('.ld-g');elX=elBox.querySelector('.ld-x');elBid=elBox.querySelector('.ld-bid');
  elPick.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.f)stepF(+b.dataset.f);else if(b.dataset.q)stepQ(+b.dataset.q);else if(b===elBid)doBidV()});
  let acc=0;
  elPick.addEventListener('wheel',e=>{e.preventDefault();acc+=e.deltaY;if(Math.abs(acc)>=40){const onF=!!e.target.closest('.ld-col')&&!!e.target.closest('.ld-col').querySelector('.ld-face');(onF?stepF:stepQ)(acc<0?1:-1);acc=0}},{passive:false});
  elG.addEventListener('click',doGuraV);elX.addEventListener('click',doExactV);
};
(window.GAMES=window.GAMES||{}).liardice=G;
})();
