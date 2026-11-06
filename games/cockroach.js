/* ===== 바퀴벌레 포커 게임 모듈 =====
   공통 코드(index.html)가 GAMES.cockroach의 함수를 불러서 이 게임의 규칙·봇·카드·화면을 그림.
   2~6명. 벌레 카드 8종류 × 8장 = 64장을 모두 나눔. 카드 id: 종류(0~7)*8 + 번호(0~7)
   차례인 사람이 카드 한 장을 엎어서 다른 사람에게 밀며 종류를 말함(참이든 거짓이든). 받은 사람은 진짜/가짜를 맞히거나,
   몰래 보고 아직 안 본 사람에게 다시 넘김(말은 바꿀 수 있음). 맞히면 넘긴 사람이, 틀리면 받은 사람이 그 카드를 앞에 펼쳐 둠.
   카드를 가져간 사람이 다음 차례. 같은 종류가 '지는 장수'(기본 4)만큼 모이거나, 내 차례에 손패가 없으면 그 한 사람이 짐.
   판 ph: give(넘기기) → ask(받은 사람이 고름) ↔ peek(본 뒤 넘길 곳 고름) → show(공개) → give … → done */
(function(){
const G={id:'cockroach',name:'바퀴벌레 포커',short:'바퀴',lead:'거짓말로 벌레 카드를 떠넘기는 게임',dealAnim:true,maxHi:6,minN:2,noFast:true,oneBotLv:true,botLvs:['쉬움'],emptyHandOk:true};

/* ---------- 규칙 값 ---------- */
const KN=8,CN=64,SHOW_MS=2700;
const kindOf=id=>id>>3;

/* ---------- 카드 그림 (직접 그린 실루엣) ---------- */
const KINDS=[
  {n:'바퀴벌레',c:'#7a4a22',bg:'#f3e3cf'},
  {n:'박쥐',c:'#4b3a78',bg:'#e6e0f2'},
  {n:'파리',c:'#2f6f73',bg:'#dcefee'},
  {n:'두꺼비',c:'#4d8a2a',bg:'#e3f0d6'},
  {n:'쥐',c:'#6c6f78',bg:'#e8e9ec'},
  {n:'전갈',c:'#c4661a',bg:'#f8e6d2'},
  {n:'거미',c:'#26262e',bg:'#e2e2e6'},
  {n:'노린재',c:'#b0302a',bg:'#f6dcda'}];
const KNAME=k=>KINDS[k]?KINDS[k].n:'';
/* 가운데 (0,0), -50~50 상자 안에 그림 */
function drawBug(g,k){
  const C=KINDS[k].c,hi='rgba(255,255,255,.3)';
  g.save();g.fillStyle=C;g.strokeStyle=C;g.lineCap='round';g.lineJoin='round';
  const E=(x,y,rx,ry,r)=>{g.beginPath();g.ellipse(x,y,rx,ry,r||0,0,Math.PI*2);g.fill()};
  const L=(p,w)=>{g.lineWidth=w||4;g.beginPath();g.moveTo(p[0],p[1]);for(let i=2;i<p.length;i+=2)g.lineTo(p[i],p[i+1]);g.stroke()};
  const S=[-1,1];
  if(k===0){   // 바퀴벌레
    for(const s of S){
      L([s*10,-8,s*28,-16,s*40,-6]);L([s*12,4,s*32,4,s*42,20]);L([s*10,16,s*26,30,s*30,46]);
      g.lineWidth=2.5;g.beginPath();g.moveTo(s*4,-36);g.quadraticCurveTo(s*14,-62,s*42,-56);g.stroke();
    }
    E(0,8,17,30);E(0,-22,15,10);E(0,-34,8,6);
    g.fillStyle=hi;E(0,-23,10,4.5);g.strokeStyle='rgba(0,0,0,.3)';L([0,-10,0,36],2);
  }else if(k===1){   // 박쥐
    g.beginPath();g.moveTo(0,-6);
    g.quadraticCurveTo(-20,-26,-48,-20);g.quadraticCurveTo(-44,-4,-40,10);g.quadraticCurveTo(-34,0,-26,6);g.quadraticCurveTo(-20,2,-14,16);g.quadraticCurveTo(-8,6,0,14);
    g.quadraticCurveTo(8,6,14,16);g.quadraticCurveTo(20,2,26,6);g.quadraticCurveTo(34,0,40,10);g.quadraticCurveTo(44,-4,48,-20);g.quadraticCurveTo(20,-26,0,-6);g.fill();
    E(0,2,9,16);E(0,-16,9,8);
    for(const s of S){g.beginPath();g.moveTo(s*2,-20);g.lineTo(s*9,-34);g.lineTo(s*9,-17);g.closePath();g.fill()}
    g.fillStyle='#fff';E(-3.5,-17,2,2);E(3.5,-17,2,2);
  }else if(k===2){   // 파리
    for(const s of S){L([s*8,-2,s*22,8,s*26,22],3);L([s*8,4,s*20,18,s*18,32],3);L([s*6,-8,s*20,-10,s*28,-2],3)}
    E(0,16,10,17);E(0,-6,11,10);E(0,-22,9,8);
    g.fillStyle='#c0392b';for(const s of S)E(s*7,-24,5.5,6.5);
    g.fillStyle='rgba(205,235,242,.78)';g.lineWidth=2;
    for(const s of S){g.beginPath();g.ellipse(s*17,6,10,22,s*-.5,0,Math.PI*2);g.fill();g.stroke()}
    g.fillStyle=hi;E(0,-8,6,4);
  }else if(k===3){   // 두꺼비
    for(const s of S){E(s*30,22,15,9,s*.4);L([s*16,18,s*24,34,s*31,36],5)}
    E(0,8,32,24);
    for(const s of S){g.fillStyle=C;E(s*14,-14,10,10);g.fillStyle='#fff8e0';E(s*14,-15,6.5,6.5);g.fillStyle='#111';E(s*14,-15,3,4.5)}
    g.fillStyle=hi;for(const [x,y,r] of [[-12,12,3],[8,18,4],[18,5,3],[-20,22,2.5],[0,2,2.5]])E(x,y,r,r);
    g.strokeStyle='rgba(0,0,0,.35)';g.lineWidth=2;g.beginPath();g.moveTo(-14,-3);g.quadraticCurveTo(0,5,14,-3);g.stroke();
  }else if(k===4){   // 쥐 (왼쪽을 봄)
    g.lineWidth=3.5;g.beginPath();g.moveTo(26,14);g.bezierCurveTo(50,20,52,44,30,44);g.stroke();
    E(6,8,26,18,-.1);E(-20,3,15,12);
    g.beginPath();g.moveTo(-32,-4);g.lineTo(-47,6);g.lineTo(-30,13);g.closePath();g.fill();
    E(-6,24,5,3);E(18,24,5,3);
    E(-14,-11,8,8);g.fillStyle='#e8a0a0';E(-14,-11,4.5,4.5);E(-46,6,2.6,2.6);
    g.fillStyle='#111';E(-28,0,2.3,2.3);
    g.fillStyle=hi;E(6,0,12,5,-.1);
  }else if(k===5){   // 전갈
    for(const s of S)for(let j=0;j<4;j++){const y=-2+j*7;L([s*10,y,s*24,y-6+j*3,s*31,y+6+j*2],3)}
    for(const s of S){L([s*8,-12,s*18,-24,s*22,-32],5);E(s*24,-40,7.5,10,s*.3)}
    g.strokeStyle=KINDS[5].bg;for(const s of S)L([s*25,-50,s*24,-40],2);
    g.fillStyle=C;E(0,-4,13,12);E(0,12,11,8);E(0,24,9,6);
    g.strokeStyle=C;g.lineWidth=8;g.beginPath();g.moveTo(0,28);g.bezierCurveTo(0,48,32,50,33,26);g.bezierCurveTo(34,10,26,2,19,5);g.stroke();
    g.beginPath();g.moveTo(22,-1);g.lineTo(9,2);g.lineTo(18,11);g.closePath();g.fill();
    g.fillStyle=hi;E(0,-7,7,4);
  }else if(k===6){   // 거미
    for(const s of S){L([s*6,-12,s*22,-34,s*34,-46],3.5);L([s*8,-6,s*30,-16,s*45,-9],3.5);L([s*8,0,s*30,8,s*43,22],3.5);L([s*6,6,s*22,24,s*30,42],3.5)}
    E(0,-8,10,10);E(0,14,16,18);
    g.fillStyle='#d0342c';g.beginPath();g.moveTo(-5,7);g.lineTo(5,7);g.lineTo(0,14);g.closePath();g.fill();g.beginPath();g.moveTo(-5,21);g.lineTo(5,21);g.lineTo(0,14);g.closePath();g.fill();
    g.fillStyle='rgba(255,255,255,.22)';E(-5,8,4,6);
  }else{   // 노린재
    for(const s of S){L([s*14,-6,s*30,-14,s*38,-4],3.5);L([s*16,6,s*32,10,s*38,26],3.5);L([s*12,18,s*24,32,s*26,46],3.5);L([s*4,-34,s*14,-48,s*24,-54],2.5)}
    g.beginPath();g.moveTo(-7,-26);g.lineTo(-5,-39);g.lineTo(5,-39);g.lineTo(7,-26);g.closePath();g.fill();
    g.beginPath();g.moveTo(0,-29);g.lineTo(-23,-20);g.lineTo(-27,4);g.lineTo(-14,30);g.lineTo(0,36);g.lineTo(14,30);g.lineTo(27,4);g.lineTo(23,-20);g.closePath();g.fill();
    g.fillStyle='rgba(0,0,0,.22)';g.beginPath();g.moveTo(-14,-14);g.lineTo(14,-14);g.lineTo(0,16);g.closePath();g.fill();
    g.fillStyle=hi;for(const [x,y] of [[-16,-4],[16,-4],[-10,22],[10,22]])E(x,y,2.6,2.6);
  }
  g.restore();
}
G.drawFace=function(g,w,h,id){
  const k=kindOf(id),K=KINDS[k],s=w/60;
  g.clearRect(0,0,w,h);
  g.save();rr(g,0,0,w,h,8*s);g.clip();g.fillStyle=K.bg;g.fillRect(0,0,w,h);g.fillStyle=K.c;g.fillRect(0,0,w,3*s);g.fillRect(0,h-3*s,w,3*s);g.restore();
  g.strokeStyle=K.c;g.lineWidth=1.2*s;rr(g,.6*s,.6*s,w-1.2*s,h-1.2*s,8*s);g.stroke();
  g.save();g.translate(w/2,h/2+2*s);g.scale(.48*s,.48*s);drawBug(g,k);g.restore();
  g.save();g.translate(10*s,13*s);g.scale(.15*s,.15*s);drawBug(g,k);g.restore();
  g.save();g.translate(w-10*s,h-13*s);g.rotate(Math.PI);g.scale(.15*s,.15*s);drawBug(g,k);g.restore();
};
/* 2D에서 쓰는 그림(카드 앞면, 벌레만): 종류마다 한 번 그려 둠 */
const URL_F=[],URL_I=[];
function faceURL(k){if(!URL_F[k]){const c=document.createElement('canvas');c.width=120;c.height=176;G.drawFace(c.getContext('2d'),120,176,k*8);URL_F[k]=c.toDataURL()}return URL_F[k]}
function iconURL(k){if(!URL_I[k]){const c=document.createElement('canvas');c.width=c.height=96;const g=c.getContext('2d');g.translate(48,48);g.scale(.9,.9);drawBug(g,k);URL_I[k]=c.toDataURL()}return URL_I[k]}
Object.assign(G,{labelOf:id=>KNAME(kindOf(id)),cmpCard:(a,b)=>a-b});
G.cardHTML=(id,extra)=>`<button type="button" class="card cp-c ${extra||''}" data-id="${id}" aria-label="${KNAME(kindOf(id))}"><img src="${faceURL(kindOf(id))}" alt="" draggable="false"></button>`;

/* ---------- 규칙 설명·방 설정 ---------- */
G.rulesHTML='<ol class="rules"><li><b>카드</b> : 바퀴벌레·박쥐·파리·두꺼비·쥐·전갈·거미·노린재 8종류가 8장씩, 64장을 모두 나눕니다</li><li><b>넘기기</b> : 내 차례에 카드 한 장을 고르면 휠에 그 벌레가 뜹니다. 휠을 돌려 말할 벌레를 정하고(거짓말도 됩니다), 카드를 상대 쪽으로 끌어 놓거나 상대 이름표를 누르면 엎어서 넘깁니다</li><li><b>받으면</b> : <b>진짜!</b>나 <b>구라!</b>를 외치거나, <b>넘기기</b>로 카드를 몰래 보고 아직 안 본 사람에게 다시 넘깁니다. 이때 말은 바꿔도 됩니다. 모두 본 카드는 넘길 수 없습니다</li><li><b>판정</b> : 외친 사람이 카드를 들어 모두에게 보여 줍니다. 맞히면 넘긴 사람이, 틀리면 외친 사람이 그 카드를 앞에 펼쳐 둡니다. 카드를 가져간 사람이 다음 차례입니다</li><li><b>패배</b> : 같은 벌레가 정한 장수(기본 4장)만큼 앞에 모이면 집니다. 내 차례에 손패가 없어도 집니다. 진 한 사람 말고는 모두 승리입니다</li><li><b>표시</b> : 한 장만 더 모이면 지는 벌레는 빨갛게 빛납니다. 카드를 본 사람은 이름표에 눈이 뜹니다</li><li><b>제한 시간</b> : 시간이 지나면 무작위로 넘기거나 외칩니다</li></ol>';
G.modeDesc=['한 사람이 질 때까지','한 사람이 질 때까지'];
G.defaults={max:6,turn:30,lose:4,pickfirst:0};
G.roomSet=[
  {k:'turn',label:'제한 시간',unit:'초',lo:10,hi:90,step:5,desc:'시간이 지나면 무작위로 넘기거나 고릅니다'},
  {k:'lose',label:'지는 장수',unit:'장',lo:3,hi:5,step:1,desc:'같은 벌레가 이만큼 앞에 모이면 집니다'}];
G.ruleSet=[{k:'pickfirst',pick:1,label:'선 플레이어',desc:'선택: 방장이 대기실에서 먼저 넘기는 사람을 고릅니다. 무작위: 무작위로 정합니다'}];
G.cfgChips=c=>`<span class="chip">지는 장수 <b>${+c.lose||4}장</b></span><span class="chip">제한 시간 <b>${+c.turn||30}초</b></span><span class="chip">선 <b>${+c.pickfirst?'선택':'무작위'}</b></span>`;
G.cfgSum=c=>`지는 장수 ${+c.lose||4}장 · 제한 시간 ${+c.turn||30}초 · 선 ${+c.pickfirst?'선택':'무작위'}`;
G.roomSub=()=>'2~6명 블러핑 카드 게임';
G.pubExtra=()=>({});
G.cardInfo=()=>'<p class="cardinfo">벌레 8종류 × 8장 · 64장</p>';
G.rankTitle=()=>'';
G.finLabel=f=>f===1?'승리':'패배';
G.noEmotes=[];
G.keys={cpTrue:'KeyT'};   // 구라!는 구라! 게임 키(gura), 넘기기는 패스 키, 휠은 구라! 선언 휠 키(numUp·numDown)를 같이 씀
G.keyActions=[{a:'cpTrue',n:'진짜!',d:'바퀴벌레 포커: 받은 카드가 말한 벌레라고 외칩니다. 구라!는 구라! 키, 넘기기는 패스 키, 선언할 벌레는 선언 자음 키를 같이 씁니다'}];

/* ---------- 방장 엔진 ---------- */
const loseN=()=>Math.max(3,Math.min(5,+H.cfg.lose||4));
const others=s=>H.players.map((_,i)=>i).filter(i=>i!==s);
const pickOne=a=>a[Math.random()*a.length|0];
/* 지금 카드를 들고 있는 사람(s)이 넘길 수 있는 사람: 아직 안 본 사람 */
const passTargets=s=>{const C=H.cp.cur;return C?others(s).filter(i=>!C.seen.includes(i)):[]};
function setTurn(i){H.turn=i;H.deadline=clock()+(+H.cfg.turn||30)*1000;H.botActAt=H.players[i].bot?clock()+rand(1300,2600):0;mark()}
const pushEv=e=>{const O=H.cp;e.q=++O.sq;O.ev.push(e);if(O.ev.length>12)O.ev.shift();return e};
function lose(seat,why,k){
  const O=H.cp,n=H.players.length,p=H.players[seat];
  O.ph='done';O.lo={s:seat,why,k:k??-1};O.sh=null;
  H.phase='over';H.botActAt=0;H.deadline=0;
  H.players.forEach((q,i)=>{q.finished=true;q.rank=i===seat?n:1});
  addLog(`${p.name} 패배${why==='col'?` (${KNAME(k)} ${O.col[seat][k]}장)`:why==='empty'?' (손패 없음)':''}`,'lie');
  mark();
  H.players.forEach((q,i)=>{if(q.bot&&i!==seat&&Math.random()<.5)botEmote(i,'gg',900+Math.random()*1600)});
}
/* 새 차례: 손패가 없으면 짐 */
function startTurn(seat){
  const O=H.cp;O.ph='give';O.cur=null;O.sh=null;
  if(!H.players[seat].hand.length){lose(seat,'empty');return}
  setTurn(seat);
}
function doGive(seat,id,cl,to){
  const O=H.cp,p=H.players[seat];
  p.hand.splice(p.hand.indexOf(id),1);H.seatNote={};
  O.cs++;O.cur={id,cl,fr:seat,to,seen:[seat]};O.ph='ask';
  addLog(`${p.name} → ${H.players[to].name} : ${KNAME(cl)}`);
  pushEv({k:'g',s:seat,to,cl});setTurn(to);
}
function doPeek(seat){
  const O=H.cp;O.cur.seen.push(seat);O.ph='peek';
  pushEv({k:'k',s:seat});setTurn(seat);
}
function doPass(seat,cl,to){
  const O=H.cp,C=O.cur;H.seatNote={};
  C.cl=cl;C.fr=seat;C.to=to;O.ph='ask';
  addLog(`${H.players[seat].name} 넘김 → ${H.players[to].name} : ${KNAME(cl)}`);
  pushEv({k:'p',s:seat,to,cl});setTurn(to);
}
function doAnswer(seat,v){
  const O=H.cp,C=O.cur,truth=kindOf(C.id)===C.cl,ok=(v===1)===truth,tk=ok?C.fr:seat;
  O.ph='show';O.sh={v,ok:ok?1:0,tk,by:seat,at:clock()+SHOW_MS};
  H.botActAt=0;H.deadline=clock()+864e5;
  addLog(`${H.players[seat].name} ${v?'진짜!':'구라!'} · ${KNAME(kindOf(C.id))}였음`,ok?'fin':'lie');
  pushEv({k:'a',s:seat,v,ok:ok?1:0,tr:truth?1:0,tk,id:C.id});mark();
}
function endShow(){
  const O=H.cp,C=O.cur,S=O.sh,k=kindOf(C.id);
  O.col[S.tk][k]++;O.cur=null;O.sh=null;
  addLog(`${H.players[S.tk].name} ${KNAME(k)} 가져감`,'sys');
  if(O.col[S.tk][k]>=loseN()){lose(S.tk,'col',k);return}
  startTurn(S.tk);
}
const randClaim=id=>Math.random()<.5?kindOf(id):pickOne([...Array(KN).keys()].filter(k=>k!==kindOf(id)));
/* 쉬움 봇: 넘길 카드·말·사람은 무작위(말은 반은 진짜). 받으면 30%는 넘기고, 아니면 무작위로 고름.
   단, 내 손패와 펼쳐진 카드만으로 그 벌레 8장이 다 보이면 '가짜' */
function botAct(i){
  const O=H.cp,p=H.players[i];
  if(O.ph==='give'){const id=pickOne(p.hand);doGive(i,id,randClaim(id),pickOne(others(i)));return}
  if(O.ph==='peek'){doPass(i,randClaim(O.cur.id),pickOne(passTargets(i)));return}
  const cl=O.cur.cl,known=p.hand.filter(x=>kindOf(x)===cl).length+O.col.reduce((a,c)=>a+c[cl],0);
  if(known>=PER_KIND){doAnswer(i,0);return}
  if(passTargets(i).length&&Math.random()<.3){doPeek(i);return}
  doAnswer(i,Math.random()<.5?1:0);
}
const PER_KIND=8;
function timeout(){
  const O=H.cp,i=H.turn,p=H.players[i];
  addLog(`${p.name} 시간 초과`,'sys');
  if(O.ph==='give'){const id=pickOne(p.hand);doGive(i,id,randClaim(id),pickOne(others(i)))}
  else if(O.ph==='peek')doPass(i,randClaim(O.cur.id),pickOne(passTargets(i)));
  else doAnswer(i,Math.random()<.5?1:0);
  if(H.phase==='play'&&H.players[i])H.seatNote[i]='시간 초과';
}
function doSurrender(seat){
  const p=H.players[seat];
  if(H.phase!=='play'||!p||p.finished)return;
  p.surrendered=true;addLog(`${p.name} ${p.deserter?'탈주':'항복'}`,'lie');
  lose(seat,'sur',-1);
}
const okKind=k=>Number.isInteger(k)&&k>=0&&k<KN;
G._test={KN,CN,SHOW_MS,kindOf,botAct,passTargets,loseN};
G.engine={
  start(){
    Object.assign(H,{phase:'play',log:[],seatNote:{},field:[],last:null,reveal:null,shouts:[],pending:null,rankNext:1,known:{},turn:0,botActAt:0,deadline:0});
    const n=H.players.length,deck=shuffle([...Array(CN).keys()]);
    H.players.forEach(p=>{p.finished=false;p.rank=null;p.surrendered=false;p.hand=[]});
    deck.forEach((id,j)=>H.players[j%n].hand.push(id));
    H.players.forEach(p=>p.hand.sort((a,b)=>a-b));
    H.cp={gn:((H.cp&&H.cp.gn)||0)+1,ph:'give',col:H.players.map(()=>Array(KN).fill(0)),cur:null,sh:null,lo:null,cs:0,ev:[],sq:0};
    const first=firstSeat(n);
    addLog(`${n}명 시작. ${H.players[first].name}부터 넘깁니다.`,'sys');
    setTurn(first);
  },
  act(seat,a){
    const O=H.cp;
    if(!O||H.phase!=='play'||seat<0||seat>=H.players.length)return;
    if(a.t==='surrender'){doSurrender(seat);return}
    if(dealing()||H.turn!==seat)return;
    const p=H.players[seat];
    if(a.t==='give'){
      if(O.ph!=='give'||!Number.isInteger(a.id)||!p.hand.includes(a.id)||!okKind(a.cl))return;
      if(!Number.isInteger(a.to)||a.to===seat||a.to<0||a.to>=H.players.length)return;
      doGive(seat,a.id,a.cl,a.to);
    }else if(a.t==='peek'){if(O.ph==='ask'&&passTargets(seat).length)doPeek(seat)}
    else if(a.t==='pass'){if(O.ph==='peek'&&okKind(a.cl)&&passTargets(seat).includes(a.to))doPass(seat,a.cl,a.to)}
    else if(a.t==='ans'){if(O.ph==='ask'&&(a.v===0||a.v===1))doAnswer(seat,a.v)}
  },
  tick(t){
    const O=H.cp;if(!O||H.phase!=='play')return;
    if(O.ph==='show'){if(t>=O.sh.at)endShow();return}
    if(O.ph!=='give'&&O.ph!=='ask'&&O.ph!=='peek')return;
    const cur=H.players[H.turn];
    if(t>=H.deadline)timeout();
    else if(cur.bot&&H.botActAt&&t>=H.botActAt&&!(cur.away&&t<cur.awayAt+AWAY_WAIT))botAct(H.turn);
  },
  snap(s,you,t){
    const O=H.cp,C=O.cur,live=O.ph==='give'||O.ph==='ask'||O.ph==='peek';
    s.cp={gn:O.gn,ph:O.ph,col:O.col.map(a=>a.slice()),lose:loseN(),cs:O.cs,sq:O.sq,ev:O.ev.map(e=>({...e}))};
    if(C){Object.assign(s.cp,{cl:C.cl,fr:C.fr,to:C.to,sn:C.seen.slice()});if(C.seen.includes(you)||O.sh)s.cp.id=C.id}
    if(O.sh)s.cp.sh={v:O.sh.v,ok:O.sh.ok,tk:O.sh.tk,by:O.sh.by};
    if(O.lo)s.cp.lo={...O.lo};
    s.gr=0;s.dl=live&&H.phase==='play'?Math.max(0,Math.round(H.deadline-t)):0;
    if(!live)delete s.t;
  },
  restore(ms){const O=H.cp;if(O&&O.sh)O.sh.at+=ms},
  emoPhase:ph=>ph==='play'||ph==='over'
};


/* ---------- 화면: 조작 ----------
   넘길 차례: 손패 위 오른쪽 세로 휠(선언할 벌레, 처음 값 = 고른 카드의 벌레). 카드를 끌어 상대 쪽으로 가져가면 그 사람 이름표가 빛나고, 놓으면 넘김.
   카드를 고르고 이름표를 눌러도 넘김. 몰래 본 카드는 휠 위에 한 장으로 나오고 같은 방법으로 넘김 */
let elBox=null,el2d=null,elT=null,elF=null,elP=null,elWh=null,elHeld=null,elPn=null;
let pkCl=0,pkCtx='',dragKindId=null,lastD='',lockAt=-1e9,aimI=-1,pnKey='',barKey='',peekAt=0;
const HD={on:false,x:0,y:0,id:-1};
const iSeat=()=>{const i=myIdx();return i>=0&&V&&V.ps&&i<V.ps.length};
const myTurn=()=>!!(V&&V.cp&&V.st==='play'&&iSeat()&&V.t===myIdx()&&!dealingV());
const phIs=ph=>myTurn()&&V.cp.ph===ph;
const selCard=()=>{const a=[...sel];return a.length===1&&myHand().includes(a[0])?a[0]:null};
/* 넘길 수 있는 사람: 처음 넘길 때는 나 말고 모두, 본 뒤에는 아직 안 본 사람 */
function targetsV(){
  const me=myIdx(),o=V.cp,all=V.ps.map((_,i)=>i).filter(i=>i!==me);
  return o.ph==='give'?all:all.filter(i=>!(o.sn||[]).includes(i));
}
const canPassV=()=>phIs('ask')&&targetsV().length>0;
const nameOf=i=>V&&V.ps&&V.ps[i]?V.ps[i].n:'';
/* 휠 값: 카드를 고르면(몰래 보면) 그 카드의 벌레로 시작 */
function syncPick(){
  const g=phIs('give'),p=phIs('peek'),id=g?selCard():p?V.cp.id:null;
  const ctx=g?'g'+id:p?'p'+V.cp.cs+':'+V.cp.sq:'';
  if(ctx!==pkCtx){pkCtx=ctx;if(id!=null)pkCl=kindOf(id);if(p)peekAt=clock()}
}
G.handMarks=(i,h,hand)=>{
  if(sel.size>1){const keep=[...sel].pop();sel.clear();sel.add(keep)}
  syncPick();
  const g=phIs('give');
  for(const el of hand.children){const id=+el.dataset.id;el.classList.toggle('sel',sel.has(id));el.classList.toggle('match',g)}
};
G.me=()=>{$('#numpick').hidden=true};
function send(a){if(clock()-lockAt<300)return false;lockAt=clock();sendAct(a);sel.clear();sfx('play',1);setAim(-1);if(typeof renderMe==='function')renderMe();return true}
/* i번에게 넘기기 (give: 고른 카드 또는 끈 카드, peek: 본 카드) */
function giveTo(i,id){
  if(phIs('give')){const c=id??selCard();if(c==null||!targetsV().includes(i)){sfx('no');return false}return send({t:'give',id:c,cl:pkCl,to:i})}
  if(phIs('peek')){if(!targetsV().includes(i)){sfx('no');return false}return send({t:'pass',cl:pkCl,to:i})}
  return false;
}
G.play=()=>{if(selCard()==null)sfx('no')};
G.pass=()=>{if(canPassV())pressPass();else sfx('no')};
function answer(v){if(!phIs('ask')){sfx('no');return}send({t:'ans',v})}
function pressPass(){if(!canPassV()){sfx('no');return}send({t:'peek'})}
G.keyPhase=st=>st==='play';
G.onKey=(act,e)=>{
  if(!V||!V.cp||V.cfg.game!=='cockroach')return false;
  if(act==='cpTrue'){if(!e.repeat)answer(1);return true}
  if(act==='gura'){if(!e.repeat)answer(0);return true}
  if(act==='pass'){if(!e.repeat){if(canPassV())pressPass();else sfx('no')}return true}
  if(act==='numUp'||act==='numDown'){if(!elWh.hidden)stepCl(act==='numUp'?-1:1);return true}
  return false;
};
G.preView=()=>{};
G.postView=()=>{};
G.buttons=()=>{
  $('#btnGura').hidden=true;
  const pb=$('#btnPlay'),ok=phIs('give')&&selCard()!=null;pb.disabled=!ok;pb.classList.remove('ready');   // 끌어서 넘기기는 이 버튼 상태를 씀 (버튼은 CSS로 숨김)
  $('#btnPass').disabled=true;
};
/* ----- 겨누기: 끄는 카드가 손패에서 떨어지면, 시작점에서 본 방향이 가장 가까운 사람의 이름표가 빛남 ----- */
function tagCenter(i){const el=document.querySelector(`#labels .seat[data-i="${i}"]`);if(!el)return null;const r=el.getBoundingClientRect();return r.width?[(r.left+r.right)/2,(r.top+r.bottom)/2]:null}
function aimAt(x,y,ox,oy){
  const tg=targetsV();if(!tg.length||Math.hypot(x-ox,y-oy)<50)return -1;
  if(tg.length===1)return tg[0];
  const a=Math.atan2(y-oy,x-ox);let best=-1,bd=9;
  for(const i of tg){const c=tagCenter(i);if(!c)continue;let d=Math.abs(Math.atan2(c[1]-oy,c[0]-ox)-a);if(d>Math.PI)d=2*Math.PI-d;if(d<bd){bd=d;best=i}}
  return best;
}
function setAim(i){if(i===aimI)return;aimI=i;if(i>=0)sfx('tick');markTags()}
/* 이름표 표시: 겨눈 사람(빛남), 넘길 수 있는 사람(테두리), 이미 본 사람(흐림) */
function markTags(){
  const on=phIs('give')||phIs('peek'),tg=on?targetsV():[],me=myIdx();
  document.querySelectorAll('#labels .seat[data-i]').forEach(el=>{const i=+el.dataset.i;
    el.classList.toggle('cp-aim',on&&i===aimI);el.classList.toggle('cp-tg',on&&tg.includes(i)&&i!==aimI);el.classList.toggle('cp-dim',on&&i!==me&&!tg.includes(i))});
}
G.dragMove=(x,y,free,D)=>{
  if(!phIs('give'))return;
  const ids=D.cards.map(c=>+c.dataset.id);if(ids.length!==1){setAim(-1);return}
  if(ids[0]!==selCard()&&ids[0]!==dragKindId){dragKindId=ids[0];pkCl=kindOf(ids[0]);drawWheel()}
  setAim(free?aimAt(x,y,D.x,D.y):-1);
};
G.dragDrop=(free,ids)=>{
  dragKindId=null;
  if(!phIs('give')){setAim(-1);return false}
  const i=aimI;setAim(-1);
  if(free&&ids.length===1&&i>=0)giveTo(i,ids[0]);
  else pkCtx='';   // 넘기지 않았으면 휠을 고른 카드의 벌레로 되돌림
  return true;   // 아무도 겨누지 않고 놓으면 손패로 돌아감 (소리 없음)
};
/* ----- 세로 휠 (구라! 세로 화면의 선언 휠과 같은 모양, 손패 위 오른쪽: 옆자리 이름표를 가리지 않게) ----- */
const WH=44;
function buildWheel(){
  elWh.innerHTML=`<button type="button" class="wh-arrow" data-step="-1" aria-label="이전 벌레">▲</button><div class="wh-view"><ul class="wh-list">${[...Array(KN).keys()].map(k=>`<li><button type="button" class="np" data-k="${k}" aria-label="${KNAME(k)}"><img class="wl" src="${iconURL(k)}" alt=""></button></li>`).join('')}</ul></div><button type="button" class="wh-arrow" data-step="1" aria-label="다음 벌레">▼</button>`;
}
function drawWheel(){
  if(!elWh)return;
  const show=phIs('give')||phIs('peek');
  if(elWh.hidden===show){elWh.hidden=!show;barKey=''}
  if(!show)return;
  if(!elWh.firstChild)buildWheel();
  elWh.querySelector('.wh-list').style.transform=`translateY(${(1-pkCl)*WH}px)`;
  elWh.querySelectorAll('.np').forEach(b=>b.classList.toggle('on',+b.dataset.k===pkCl));
  elWh.querySelectorAll('.wh-arrow').forEach(a=>a.disabled=+a.dataset.step<0?pkCl<=0:pkCl>=KN-1);
}
function stepCl(d){const n=Math.max(0,Math.min(KN-1,pkCl+d));if(n===pkCl)return;pkCl=n;sfx('tick');drawWheel()}
/* ----- 몰래 본 카드: 휠 위에 한 장, 끌어서 넘김 ----- */
function drawHeld(){
  if(!elHeld)return;
  const id=phIs('peek')?V.cp.id:null,show=id!=null&&(!M.on||clock()-peekAt>650);
  if(!show){if(!elHeld.hidden){elHeld.hidden=true;HD.on=false;elHeld.classList.remove('drag');elHeld.style.removeProperty('--dx');elHeld.style.removeProperty('--dy')}return}
  if(HD.id!==id){HD.id=id;elHeld.innerHTML=`<img src="${faceURL(kindOf(id))}" alt="${KNAME(kindOf(id))}" draggable="false">`;elHeld.setAttribute('aria-label',KNAME(kindOf(id)))}
  if(elHeld.hidden){elHeld.hidden=false;barKey=''}
}
function heldDown(e){if(e.button>0)return;HD.on=true;HD.moved=false;HD.x=e.clientX;HD.y=e.clientY;try{elHeld.setPointerCapture(e.pointerId)}catch(_){}e.preventDefault()}
function heldMove(e){
  if(!HD.on)return;const dx=e.clientX-HD.x,dy=e.clientY-HD.y;
  if(!HD.moved&&Math.hypot(dx,dy)<6)return;HD.moved=true;elHeld.classList.add('drag');
  elHeld.style.setProperty('--dx',dx+'px');elHeld.style.setProperty('--dy',dy+'px');
  setAim(Math.hypot(dx,dy)>70?aimAt(e.clientX,e.clientY,HD.x,HD.y):-1);
}
function heldUp(e,cancel){
  if(!HD.on)return;HD.on=false;
  elHeld.classList.remove('drag');elHeld.style.removeProperty('--dx');elHeld.style.removeProperty('--dy');
  const i=aimI;setAim(-1);if(!cancel&&HD.moved&&i>=0)giveTo(i);
}
/* 손패 위 자리: 몰래 본 카드는 손패 바로 위 가운데 (휠은 손패 위 오른쪽) */
function placeBar(){
  const st=$('#stage'),fh=+T.fanH||0,key=fh+'|'+elHeld.hidden;
  if(key===barKey)return;barKey=key;
  st.style.setProperty('--cpB',(fh+6)+'px');
  elHeld.style.bottom=(fh+14)+'px';
}
G.afterFan=()=>{barKey=''};
const EYE='<svg class="cp-eye" viewBox="0 0 24 24" aria-label="봄"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" fill="#fff6e2" stroke="#b5521e" stroke-width="2"/><circle cx="12" cy="12" r="3.6" fill="#3b2a1f"/></svg>';
G.nameTag=(p,i)=>{const o=V&&V.cp;return V&&V.st==='play'&&o&&(o.ph==='ask'||o.ph==='peek')&&(o.sn||[]).includes(i)?EYE:''};
G.logCue=()=>false;
G.cues=(v,pv)=>{
  const a=v.cp,b=pv&&pv.cp;if(!a||!b||a.gn!==b.gn)return;
  for(const e of a.ev)if(e.q>b.sq)evCue(e);
};
/* 외치기는 구라! 게임의 말풍선·소리, 공개 소리는 구라! 판정과 같은 진짜/거짓 소리 */
function evCue(e){
  if(e.k==='g'||e.k==='p')sfx('play',1);
  else if(e.k==='k')sfx('pick');
  else if(e.k==='a'){
    if(e.v)showBubble(e.s,'<span class="bt">진짜!</span>',1900,'cpb');
    else{sfx('gura');showBubble(e.s,'<span class="bt">구라!</span>',2100,'real')}
    setTimeout(()=>{if(V&&V.cp)sfx(e.tr?'truth':'lie')},SH.face-200);
  }
}

/* ---------- 3D ----------
   넘기는 카드는 받은 사람 앞(가운데 쪽)에 엎어 둠. 움직임은 모두 시간 기준 키 프레임(tween): 탁자 위에서 돌리지 않고 먼저 들어 올린 뒤 돌림.
   외치면 외친 사람이 카드를 들어 올려 앞면을 보여 주고, 판정이 끝나면 가져갈 사람 앞 펠트로 감.
   펼친 카드는 각자 앞 펠트에 종류별로 겹쳐 쌓음(4종류가 넘으면 두 줄). 한 장 더 모이면 지는 종류는 빨간 테두리.
   같은 종류가 모여 지면 그 종류 카드만 공중에 나란히 띄움 */
const R0=2.35,R1=1.45,STEP=.12,CS=.5,SP=.43,LIFT=.75;
const SH={hold:450,up:800,to:1150,face:1550};   // 공개: 말풍선 → 들어 올림 → 외친 사람 앞 공중 → 앞면
const M={on:false,built:false,fail:false,root:null,raf:0,card:null,cardCs:-1,col:[],glow:new Map(),gn:-1,lastSh:null,fl:null,key:'',aim:null};
const TW=new Set();
const ez=k=>k<=0?0:k>=1?1:k*k*(3-2*k);
function build(){
  if(M.built||M.fail)return M.built;
  if(!T.ok||typeof THREE==='undefined'){M.fail=true;return false}
  try{
    const root=new THREE.Group();root.visible=false;T.scene.add(root);M.root=root;
    M.glowGeo=new THREE.PlaneGeometry(1,1);
    const at=canvasTex(128,128,(x,w,h)=>{const g=x.createRadialGradient(w/2,h/2,4,w/2,h/2,w/2);g.addColorStop(0,'rgba(255,190,90,.85)');g.addColorStop(.6,'rgba(255,160,60,.35)');g.addColorStop(1,'rgba(255,150,50,0)');x.fillStyle=g;x.fillRect(0,0,w,h)});
    at.premultiplyAlpha=true;
    const aim=new THREE.Mesh(M.glowGeo,new THREE.MeshBasicMaterial({map:at,transparent:true,premultipliedAlpha:true,depthWrite:false}));aim.rotation.x=-Math.PI/2;aim.scale.set(2.2,2.2,1);aim.renderOrder=2;aim.visible=false;root.add(aim);M.aim=aim;
    M.built=true;
  }catch(e){M.fail=true;try{console.warn('바퀴벌레 포커 3D 준비 실패',e)}catch(_){}}
  return M.built;
}
const seatFrom=(i,me)=>{const p=i===me?nearMe():seatPos(i,3.85);p.y=.5;return p};
const holdSpot=i=>{const p=seatPos(i,.75);p.y=.04;return p};
const narrow=()=>!!(T.cam&&T.cam.aspect<1);
/* 외친 사람(나면 내 눈앞)이 카드를 들어 보이는 자리: 모두 내 화면 쪽(카메라)으로 앞면 */
function airOf(i,me){if(i===me)return narrow()?{x:0,y:2.35,z:2.3,s:1.2}:{x:0,y:1.75,z:2.4,s:1.2};const p=seatPos(i,1.9);return {x:p.x,y:1.25,z:p.z,s:1.15}}
function newCard(pos,rx,ry,s,id){const c=makeCard(pos,rx,ry,s);if(id!=null)c.children[0].material=faceMat(id);return c}
function setFace(c,id){const m=id!=null&&id>=0?faceMat(id):T.back;if(c.children[0].material!==m)c.children[0].material=m}
/* 키 프레임: keys = [{t(ms), x,y,z,rx,ry,s 중 바뀌는 것}], 첫 프레임은 지금 모습. keep이면 끝난 뒤에도 그 자리에 둠(아니면 공통 따라가기로 넘김) */
function tween(c,keys,keep){
  const u=c.userData,p0={t:0,x:c.position.x,y:c.position.y,z:c.position.z,rx:c.rotation.x,ry:c.rotation.y,s:c.scale.x},ks=[p0];
  for(const k of keys){const q={...ks[ks.length-1],...k},d=q.ry-ks[ks.length-1].ry;q.ry=ks[ks.length-1].ry+Math.atan2(Math.sin(d),Math.cos(d));ks.push(q)}
  u.man=true;u.tw={t0:clock(),ks,keep:!!keep};TW.add(c);
}
const poseKey=(t,p,rx,ry,s)=>({t,x:p.x,y:p.y,z:p.z,rx,ry,s});
function twStep(now){
  for(const c of [...TW]){
    const u=c.userData,w=u.tw;if(!w||!T.cards.has(c)){TW.delete(c);continue}
    const e=now-w.t0,ks=w.ks;let j=1;while(j<ks.length-1&&e>ks[j].t)j++;
    const a=ks[j-1],b=ks[j],f=b.t>a.t?ez((e-a.t)/(b.t-a.t)):1,L=(p,q)=>p+(q-p)*f;
    c.rotation.order='YXZ';c.position.set(L(a.x,b.x),L(a.y,b.y),L(a.z,b.z));c.rotation.set(L(a.rx,b.rx),L(a.ry,b.ry),0);c.scale.setScalar(L(a.s,b.s));
    if(e>=ks[ks.length-1].t){u.tw=null;TW.delete(c);if(!w.keep){u.man=false;c.rotation.y=u.ry}}
  }
}
/* 탁자 위 카드를 다른 자리로: 평평한 채 떠올라 옮긴 뒤 내려앉음 (탁자를 뚫지 않게) */
function flyFlat(c,to,rx,ry,s,dur,keep){
  const mx=(c.position.x+to.x)/2,mz=(c.position.z+to.z)/2,h=Math.max(c.position.y,to.y)+.55;
  tween(c,[{t:dur*.5,x:mx,y:h,z:mz,rx,ry,s:(c.scale.x+s)/2},poseKey(dur,to,rx,ry,s)],keep);
}
function getGlow(key){
  let g=M.glow.get(key);
  if(!M.glowTex){M.glowTex=canvasTex(160,224,(x,w,h)=>{   // 빨갛게 빛나는 테두리 (가운데는 비움)
    x.fillStyle='rgba(255,70,40,.28)';rr(x,14,14,w-28,h-28,16);x.fill();
    x.shadowColor='#ff2a10';x.shadowBlur=16;x.strokeStyle='#ff5a3a';x.lineWidth=11;rr(x,14,14,w-28,h-28,16);x.stroke();x.stroke();
  });M.glowTex.premultiplyAlpha=true}   // 투명한 가장자리가 검게 번져 갈색으로 보이지 않게
  if(!g){g=new THREE.Mesh(M.glowGeo,new THREE.MeshBasicMaterial({map:M.glowTex,transparent:true,premultipliedAlpha:true,opacity:.8,depthWrite:false}));g.rotation.order='YXZ';g.renderOrder=2;M.root.add(g);M.glow.set(key,g)}
  return g;
}
function clearAll(){
  if(M.card){killCard(M.card);M.card=null}
  for(const row of M.col)for(const arr of row)arr.forEach(killCard);
  M.col=[];for(const g of M.glow.values()){M.root.remove(g);g.material.dispose()}M.glow.clear();TW.clear();
  M.cardCs=-1;M.lastSh=null;M.fl=null;M.key='';
}
/* 펼친 카드 자리: 종류별 열, 열 안에서는 다음 카드가 주인 쪽으로 겹침(위 끝의 작은 그림이 보이게) */
function layoutCol(i,col,lose,show,skip){
  const a=seatAngle(i),tx=Math.cos(a),tz=-Math.sin(a),ox=Math.sin(a),oz=Math.cos(a);
  const ks=[];for(let k=0;k<KN;k++)if(col[k]>0&&k!==skip)ks.push(k);
  const rows=ks.length>4?[ks.slice(0,Math.ceil(ks.length/2)),ks.slice(Math.ceil(ks.length/2))]:[ks];
  for(let k=0;k<KN;k++)if(M.glow.has(i+':'+k))M.glow.get(i+':'+k).visible=false;
  rows.forEach((row,r)=>row.forEach((k,j)=>{
    const R=r?R1:R0,off=(j-(row.length-1)/2)*SP,arr=M.col[i][k];
    arr.forEach((c,n)=>{const u=c.userData,rr2=R+n*STEP;u.p.set(ox*rr2+tx*off,.03+n*.005,oz*rr2+tz*off);u.rx=-Math.PI/2;u.ry=a;u.s=CS});
    if(show&&arr.length>=lose-1){
      const g=getGlow(i+':'+k),len=1.08*CS+(arr.length-1)*STEP+.14,mid=R+(arr.length-1)*STEP/2;
      g.visible=true;g.position.set(ox*mid+tx*off,.022,oz*mid+tz*off);g.rotation.set(-Math.PI/2,a,0);g.scale.set(.744*CS+.2,len+.06,1);
    }
  }));
}
/* 같은 종류가 모여 진 사람: 그 종류 카드만 내 쪽 공중에 나란히 (탁자 위 카드는 먼저 평평하게 떠오름) */
function floatLose(i,k){
  const arr=M.col[i][k],n=arr.length,S=narrow()?.72:.95,X=narrow()?.6:.78,Y=1.45,Z=2.3,TIL=-.6;
  arr.forEach((c,j)=>{
    const to={x:(j-(n-1)/2)*X,y:Y,z:Z},d=j*90;
    if(c.position.y<.3)tween(c,[{t:d},{t:d+380,y:LIFT+.2},poseKey(d+900,to,TIL,0,S)],true);
    else tween(c,[poseKey(600,to,TIL,0,S)],true);
  });
  const g=getGlow('fl');g.visible=true;g.position.set(0,Y,Z-.07);g.rotation.set(TIL,0,0);g.scale.set((n-1)*X+.744*S+.35,1.08*S+.35,1);
}
G.field3D=(v,pv,me)=>{
  const o=v.cp;if(!o||!T.ok||!M.built||v.st==='wait')return;
  if(M.gn!==o.gn){clearAll();M.gn=o.gn}
  const n=v.ps.length;
  while(M.col.length<n)M.col.push(Array.from({length:KN},()=>[]));
  /* 넘기는 카드: 단계가 바뀔 때마다 키 프레임 */
  const has=o.cl!=null&&(o.ph==='ask'||o.ph==='peek'||o.ph==='show');
  let adopt=null;
  if(has){
    const fresh=!M.card||M.cardCs!==o.cs;
    if(fresh){if(M.card)killCard(M.card);M.card=newCard(seatFrom(o.fr,me),Math.PI/2,seatAngle(o.fr),.8,null);M.card.userData.man=true;M.cardCs=o.cs}
    const c=M.card,key=o.ph+':'+o.to+':'+o.cs;
    if(key!==M.key){
      M.key=key;const hs=holdSpot(o.to),ry=seatAngle(o.to);
      if(o.ph==='ask'){setFace(c,null);c.visible=true;flyFlat(c,hs,Math.PI/2,ry,1,fresh?480:620,true)}
      else if(o.ph==='peek'&&o.to===me){setFace(c,o.id);tween(c,[{t:260,y:LIFT},{t:620,x:0,y:1.2,z:3.4,rx:-.6,ry:0,s:1}],true)}
      else if(o.ph==='peek'){tween(c,[{t:260,y:LIFT},{t:560,rx:-.75,ry}],true)}
      else{   // show: 외친 사람이 들어 올려 보여 줌
        const A=airOf(o.sh.by,me);setFace(c,o.id);c.visible=true;M.lastSh={tk:o.sh.tk,k:kindOf(o.id)};
        tween(c,[{t:SH.hold},{t:SH.up,y:Math.max(c.position.y,LIFT+.1),rx:Math.PI/2},{t:SH.to,x:A.x,y:A.y,z:A.z,rx:Math.PI/2,ry:0,s:A.s},{t:SH.face,rx:-.6}],true);
      }
    }
  }else if(M.card){
    if(M.lastSh)adopt=M.lastSh;else{killCard(M.card);M.card=null}
    M.lastSh=null;M.key='';
  }
  /* 펼친 카드 맞추기 */
  let moved=null;
  for(let i=0;i<n;i++)for(let k=0;k<KN;k++){
    const want=o.col[i]?o.col[i][k]:0,arr=M.col[i][k];
    while(arr.length>want)killCard(arr.pop());
    while(arr.length<want){
      if(adopt&&adopt.tk===i&&adopt.k===k&&M.card){M.card.visible=true;setFace(M.card,k*8);arr.push(M.card);moved=M.card;M.card=null;adopt=null;continue}
      const p=seatPos(i,R0);p.y=.03;arr.push(newCard(p,-Math.PI/2,seatAngle(i),CS,k*8));
    }
  }
  if(M.card&&!has){killCard(M.card);M.card=null}
  const lo=v.st==='over'&&o.lo?o.lo:null,lk=lo&&lo.why==='col'?lo.k:-1;
  for(let i=0;i<n;i++)layoutCol(i,o.col[i],o.lose,v.st==='play'||!!lo,lo&&i===lo.s?lk:-1);
  if(moved){const u=moved.userData;flyFlat(moved,u.p,u.rx,u.ry,u.s,650,false)}   // 공중에서 가져갈 사람 앞 펠트로
  if(lk>=0&&!M.fl){M.fl=lo;floatLose(lo.s,lk)}
  if(!lo){M.fl=null;if(M.glow.has('fl'))M.glow.get('fl').visible=false}
};
const _pv=window.THREE?new THREE.Vector3():null;
function step(){
  M.raf=0;if(!M.on||!V||!V.cp)return;
  M.raf=requestAnimationFrame(step);
  const now=clock(),o=V.cp,me=myIdx();
  twStep(now);
  if(M.card)M.card.visible=!(o.ph==='peek'&&o.to===me&&now-peekAt>650);   // 몰래 본 카드는 들어 올린 뒤 내 손(2D 한 장)으로
  /* 선언 표시: 구라!의 '지금' 칸처럼 카드 위에 떠 있고, 말이 바뀌면 톡 튀어나옴 */
  const pv=V.st==='play'&&!dealingV()&&o.cl!=null&&(o.ph==='ask'||o.ph==='peek'||o.ph==='show');
  if(elPn.hidden===pv)elPn.hidden=!pv;
  if(pv){
    const k=o.cs+':'+o.cl+':'+o.fr;
    if(k!==pnKey){pnKey=k;elPn.style.setProperty('--rc',KINDS[o.cl].c);elPn.querySelector('img').src=iconURL(o.cl);elPn.classList.remove('pop');void elPn.offsetWidth;elPn.classList.add('pop')}
    const base=M.card&&M.card.visible&&o.ph!=='show'?M.card.position:holdSpot(o.to);
    _pv.set(base.x,Math.max(.1,base.y)+.62,base.z).project(T.cam);
    const st=$('#stage');elPn.style.left=((_pv.x+1)/2*st.clientWidth).toFixed(1)+'px';elPn.style.top=((1-_pv.y)/2*st.clientHeight).toFixed(1)+'px';
  }
  M.aim.visible=aimI>=0&&V.st==='play';
  if(M.aim.visible){const p=seatPos(aimI,2.1);M.aim.position.set(p.x,.024,p.z);M.aim.material.opacity=.75+.25*Math.sin(now/180)}
  const pulse=.75+.25*Math.sin(now/260);
  for(const g of M.glow.values())if(g.visible)g.material.opacity=pulse;
}

/* ---------- 2D (WebGL이 없을 때)·버튼 ---------- */
const imgI=(k,cls)=>`<img class="${cls||''}" src="${iconURL(k)}" alt="${KNAME(k)}">`;
function draw2d(){
  if(!el2d||!V||!V.cp)return;
  if(M.on){if(lastD){el2d.innerHTML='';lastD=''}return}
  const o=V.cp,me=myIdx();
  let top='';
  if(o.cl!=null&&o.ph!=='give'&&o.ph!=='done'){
    top=`<p class="cp-now">${esc(nameOf(o.fr))} → ${esc(nameOf(o.to))} ${imgI(o.cl,'cp-ic')}</p>`;
    if(o.ph==='show'&&o.id!=null)top+=`<div class="cp-peek"><img src="${faceURL(kindOf(o.id))}" alt="${KNAME(kindOf(o.id))}"></div>`;
  }
  const rows=V.ps.map((p,i)=>{const c=o.col[i]||[];const cells=[...Array(KN).keys()].filter(k=>c[k]>0).map(k=>`<span class="cp-n${c[k]>=o.lose-1?' bad':''}">${imgI(k,'cp-ic')}${c[k]}</span>`).join('');return `<div class="cp-row${i===me?' me':''}"><b>${esc(p.n)}</b>${cells}</div>`}).join('');
  const h=top+`<div class="cp-rows">${rows}</div>`;
  if(h!==lastD){el2d.innerHTML=h;lastD=h}
}
function keyTags(){for(const [el,k] of [[elT,KEYS.cpTrue],[elF,KEYS.gura],[elP,KEYS.pass]]){const s=el.querySelector('small'),t=k?keyLabel(k):'';if(s&&s.textContent!==t)s.textContent=t}}
G.live=()=>{
  if(!elT||!V||!V.cp)return;
  syncPick();
  const ask=phIs('ask');
  if(elT.hidden===ask){elT.hidden=elF.hidden=!ask}
  const cp=ask&&canPassV();if(elP.hidden===cp)elP.hidden=!cp;
  keyTags();drawWheel();drawHeld();placeBar();markTags();draw2d();
  if(!M.on&&elPn&&!elPn.hidden)elPn.hidden=true;
};
G.hud=inGame=>{
  if(!elBox)return;
  const on=!!(inGame&&V&&V.cp);
  elBox.hidden=!on;
  const d3=on&&build();
  if(d3!==M.on){M.on=d3;if(M.root)M.root.visible=d3;if(d3&&!M.raf)M.raf=requestAnimationFrame(step)}
  $('#stage').classList.add('cpg');
  if(!on){if(T.ok&&M.built)clearAll();M.gn=-1;return}
  draw2d();
};
G.overDelay=()=>{const o=V&&V.cp;return M.on&&o&&o.lo&&o.lo.why==='col'?2600:0};
G.overWho=()=>{const o=V&&V.cp;return o&&o.lo?`${nameOf(o.lo.s)} 패배`:''};
G.overRank=p=>{const o=V&&V.cp,t=p.sr===3?'탈주':p.sr?'항복':o&&o.lo&&o.lo.s===p.i?'패배':'';return t?`<span class="left">${t}</span>`:''};
G.overExtra=()=>{
  const o=V&&V.cp;if(!o||!o.lo)return '';
  const L=o.lo,c=o.col[L.s]||[];
  const body=L.why==='col'?`<span class="cp-n bad">${imgI(L.k,'cp-ic')}${c[L.k]}</span>`:L.why==='empty'?'손패 없음':'';
  return body?`<div class="cp-over"><p>${esc(nameOf(L.s))}</p><div>${body}</div></div>`:'';
};
G.enter=()=>{$('#btnGura').hidden=true};
G.leave=()=>{
  if(T.ok&&M.built)clearAll();
  if(elBox)elBox.hidden=true;
  if(M.root)M.root.visible=false;
  Object.assign(M,{on:false,gn:-1});
  pkCtx='';lastD='';barKey='';pnKey='';aimI=-1;HD.on=false;HD.id=-1;
  if(elWh){elWh.hidden=true;elWh.innerHTML=''}
  if(elHeld)elHeld.hidden=true;if(elPn)elPn.hidden=true;
  document.querySelectorAll('#labels .seat').forEach(el=>el.classList.remove('cp-aim','cp-tg','cp-dim'));
  const st=$('#stage');st.classList.remove('cpg');st.style.removeProperty('--cpB');
  $('#btnPass').disabled=false;
};
G.holoPiece=mkM=>{
  const g=new THREE.Group(),tx=canvasTex(128,186,(x,w,h)=>G.drawFace(x,w,h,0));
  const a=new THREE.Mesh(new THREE.BoxGeometry(.4,.58,.012),mkM(0xffffff,T.back.map));a.position.set(-.13,0,-.03);a.rotation.z=.16;g.add(a);
  const b=new THREE.Mesh(new THREE.BoxGeometry(.4,.58,.012),mkM(0xffffff,tx));b.position.set(.09,.03,.01);b.rotation.z=-.1;g.add(b);
  g.rotation.set(-.3,.2,0);return g;
};
G.init=()=>{
  const css=document.createElement('style');
  css.textContent=`
.cp-box{position:absolute;inset:0;pointer-events:none;z-index:6}
.cp-box[hidden]{display:none}
.card.cp-c{overflow:hidden;background:#fffcf5}
.card.cp-c img{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;-webkit-user-drag:none;user-select:none}
.cp-act{display:none}
.stage.cpg .cp-act{display:flex}
.stage.cpg .cp-act[hidden]{display:none}
.stage.cpg #btnPlay,.stage.cpg #btnPass{display:none}
.stage.cpg .actions{left:50%;right:auto;bottom:var(--cpB,120px);width:min(360px,calc(100% - 20px));justify-content:center;transform:translateX(-50%) scale(var(--actS,1));transform-origin:50% 100%}
.stage.cpg .actions .act{flex:1;min-width:0;pointer-events:auto}
.cp-eye{width:1.05em;height:1.05em;vertical-align:-.15em;margin-right:3px}
.bubble.cpb .bt{font-size:calc(24px*var(--bk,1))}
.stage.cpg .seat.cp-tg{border-color:#ffb04a}
.stage.cpg .seat.cp-dim{opacity:.5}
.stage.cpg .seat.cp-aim{border-color:#ff8a2a;box-shadow:0 0 0 3px #ffb04a,0 0 18px 4px rgba(255,150,50,.75);transform:translate(-50%,-50%) scale(1.18);z-index:3}
.cp-wh.numwheel{position:absolute;left:auto;right:8px;top:auto;bottom:calc(var(--cpB,120px) + 8px);transform:none;flex-direction:column;align-items:center;gap:3px;width:70px;height:auto;box-sizing:border-box;padding:4px 4px 5px;pointer-events:auto;background:rgba(255,250,240,.82);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);box-shadow:0 2px 8px -3px rgba(59,42,31,.35)}
.cp-wh.numwheel[hidden]{display:none}
.cp-wh .wh-arrow{width:100%;height:22px;padding:0;background:rgba(59,42,31,.1)}
.cp-wh .wh-view{width:60px;height:${WH*3}px;-webkit-mask-image:linear-gradient(transparent,#000 30%,#000 70%,transparent);mask-image:linear-gradient(transparent,#000 30%,#000 70%,transparent)}
.cp-wh .wh-view::before{left:0;right:0;top:50%;bottom:auto;width:auto;height:${WH}px;margin:-${WH/2}px 0 0 0}
.cp-wh .wh-view::after{display:none}
.cp-wh .wh-list{display:block;width:auto}
.cp-wh .np{width:60px;height:${WH}px;padding:0;opacity:.4;transition:opacity .16s;justify-content:center}
.cp-wh .np.on{opacity:1}
.cp-wh .np img.wl{width:28px;height:28px;display:block;pointer-events:none}
.cp-wh .np.on img.wl{width:38px;height:38px}
.cp-held{position:absolute;left:50%;width:78px;height:114px;margin-left:-39px;border-radius:8px;overflow:hidden;pointer-events:auto;touch-action:none;cursor:grab;box-shadow:0 0 0 3px #ffb04a,0 8px 16px -6px rgba(59,42,31,.6);transform:translate(var(--dx,0),var(--dy,0));transition:transform .2s;animation:pop .3s ease-out}
.cp-held.drag{transition:none;cursor:grabbing}
.cp-held[hidden]{display:none}
.cp-held img{width:100%;height:100%;display:block;pointer-events:none}
.pilenum.cp-pn{position:absolute;min-width:58px;height:62px}
.pilenum.cp-pn b{display:flex;align-items:center;justify-content:center}
.pilenum.cp-pn img{width:46px;height:46px;display:block}
.cp-peek img{width:72px;height:106px;border-radius:8px;display:block;margin:0 auto}
.cp-2d{position:absolute;left:0;right:0;top:104px;text-align:center;color:#3b2a1f;font-family:"Jua",sans-serif}
.cp-2d p{margin:2px 0}
.cp-ic{width:26px;height:26px;vertical-align:middle}
.cp-now{font-size:18px}
.cp-rows{display:inline-flex;flex-direction:column;gap:2px;margin-top:6px;text-align:left}
.cp-row{display:flex;align-items:center;gap:6px;font-size:15px}
.cp-row.me b{color:#b5521e}
.cp-n{display:inline-flex;align-items:center;gap:1px}
.cp-n.bad{color:#c62a1e;font-weight:700}
.cp-over{text-align:center;margin-top:8px;font-family:"Jua",sans-serif}
.cp-over p{margin:0 0 4px}
.cp-over div{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;font-size:17px}
`;
  document.head.appendChild(css);
  elBox=document.createElement('div');elBox.className='cp-box';elBox.hidden=true;
  elBox.innerHTML='<div class="cp-2d"></div><div class="pilenum cp-pn" hidden><b><img alt=""></b></div><div class="numwheel cp-wh" hidden></div><div class="card cp-held" role="img" hidden></div>';
  $('#stage').appendChild(elBox);
  $('#actions').insertAdjacentHTML('beforeend','<button type="button" class="act act-play cp-act" id="cpT" hidden>진짜!<small></small></button><button type="button" class="act act-gura cp-act" id="cpF" hidden>구라!<small></small></button><button type="button" class="act act-pass cp-act" id="cpP" hidden>넘기기<small></small></button>');
  elT=$('#cpT');elF=$('#cpF');elP=$('#cpP');el2d=elBox.querySelector('.cp-2d');elWh=elBox.querySelector('.cp-wh');elHeld=elBox.querySelector('.cp-held');elPn=elBox.querySelector('.cp-pn');
  elT.addEventListener('click',()=>answer(1));elF.addEventListener('click',()=>answer(0));elP.addEventListener('click',pressPass);
  /* 휠: 화살표·누르기·마우스 휠·위아래로 밀기 */
  elWh.addEventListener('click',e=>{const a=e.target.closest('.wh-arrow');if(a){stepCl(+a.dataset.step);return}const b=e.target.closest('.np');if(b&&+b.dataset.k!==pkCl){pkCl=+b.dataset.k;sfx('tick');drawWheel()}});
  let acc=0,tx0=null;
  elWh.addEventListener('wheel',e=>{e.preventDefault();acc+=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY;if(Math.abs(acc)>=40){stepCl(acc>0?1:-1);acc=0}},{passive:false});
  elWh.addEventListener('touchstart',e=>{tx0=e.touches[0].clientY},{passive:true});
  elWh.addEventListener('touchmove',e=>{if(tx0==null)return;const d=e.touches[0].clientY-tx0;if(Math.abs(d)>=26){stepCl(d>0?-1:1);tx0=e.touches[0].clientY}},{passive:true});
  elWh.addEventListener('touchend',()=>{tx0=null});
  /* 몰래 본 카드 끌기 */
  elHeld.addEventListener('pointerdown',heldDown);elHeld.addEventListener('pointermove',heldMove);
  elHeld.addEventListener('pointerup',e=>heldUp(e,false));elHeld.addEventListener('pointercancel',e=>heldUp(e,true));
  /* 이름표 누르기 = 그 사람에게 넘기기 (넘길 차례에 카드를 골랐을 때·몰래 본 뒤). 이때는 이름표 메뉴를 열지 않음 */
  $('#labels').addEventListener('click',e=>{
    if(!V||!V.cp||V.cfg.game!=='cockroach')return;
    const seat=e.target.closest('.seat[data-i]');if(!seat)return;
    const g=phIs('give'),p=phIs('peek');if(!(p||(g&&selCard()!=null)))return;
    e.stopPropagation();e.preventDefault();giveTo(+seat.dataset.i);
  },true);
};
(window.GAMES=window.GAMES||{}).cockroach=G;
})();
