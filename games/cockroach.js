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
const KN=8,CN=64,SHOW_MS=2300;
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
G.rulesHTML='<ol class="rules"><li><b>카드</b> : 바퀴벌레·박쥐·파리·두꺼비·쥐·전갈·거미·노린재 8종류가 8장씩, 64장을 모두 나눕니다</li><li><b>넘기기</b> : 내 차례에 카드 한 장을 고르고, 다른 사람에게 엎어서 넘기며 무슨 벌레인지 말합니다. 진짜를 말해도, 거짓말을 해도 됩니다</li><li><b>받으면</b> : <b>진짜</b>나 <b>가짜</b>를 고르거나, <b>넘기기</b>로 카드를 몰래 보고 아직 안 본 사람에게 다시 넘깁니다. 이때 말은 바꿔도 됩니다. 모두 본 카드는 넘길 수 없습니다</li><li><b>판정</b> : 맞히면 넘긴 사람이, 틀리면 받은 사람이 그 카드를 앞에 펼쳐 둡니다. 카드를 가져간 사람이 다음 차례입니다</li><li><b>패배</b> : 같은 벌레가 정한 장수(기본 4장)만큼 앞에 모이면 집니다. 내 차례에 손패가 없어도 집니다. 진 한 사람 말고는 모두 승리입니다</li><li><b>표시</b> : 한 장만 더 모이면 지는 벌레는 빨갛게 빛납니다. 카드를 본 사람은 이름표에 눈이 뜹니다</li><li><b>제한 시간</b> : 시간이 지나면 무작위로 넘기거나 고릅니다</li></ol>';
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
G.keys={};G.keyActions=[];

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
  addLog(`${H.players[seat].name} "${v?'진짜':'가짜'}" · ${KNAME(kindOf(C.id))}였음`,ok?'fin':'lie');
  pushEv({k:'a',s:seat,v,ok:ok?1:0,tk,id:C.id});mark();
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

/* ---------- 화면: 조작 ---------- */
let elBox=null,elPick=null,el2d=null,elT=null,elF=null,elP=null;
let pkTo=-1,pkCl=-1,pkCtx='',pickKey='',lastD='',layKey='',lockAt=-1e9;
const iSeat=()=>{const i=myIdx();return i>=0&&V&&V.ps&&i<V.ps.length};
const myTurn=()=>!!(V&&V.cp&&V.st==='play'&&iSeat()&&V.t===myIdx()&&!dealingV());
const phIs=ph=>myTurn()&&V.cp.ph===ph;
const pickedCard=()=>{if(!phIs('give'))return null;const a=[...sel];return a.length===1&&myHand().includes(a[0])?a[0]:null};
/* 넘길 수 있는 사람: 처음 넘길 때는 나 말고 모두, 본 뒤에는 아직 안 본 사람 */
function targetsV(){
  const me=myIdx(),o=V.cp,all=V.ps.map((_,i)=>i).filter(i=>i!==me);
  return o.ph==='give'?all:all.filter(i=>!(o.sn||[]).includes(i));
}
const canPassV=()=>phIs('ask')&&targetsV().length>0;
const nameOf=i=>V&&V.ps&&V.ps[i]?V.ps[i].n:'';
G.handMarks=(i,h,hand)=>{
  if(sel.size>1){const keep=[...sel].pop();sel.clear();sel.add(keep)}
  const g=phIs('give');
  for(const el of hand.children){const id=+el.dataset.id;el.classList.toggle('sel',sel.has(id));el.classList.toggle('match',g)}
};
G.me=()=>{$('#numpick').hidden=true};
function send(a){if(clock()-lockAt<300)return;lockAt=clock();sendAct(a);sel.clear();pkTo=pkCl=-1;sfx('play',1)}
function trySend(){
  if(pkTo<0||pkCl<0)return;
  if(phIs('give')){const id=pickedCard();if(id==null)return;send({t:'give',id,cl:pkCl,to:pkTo})}
  else if(phIs('peek'))send({t:'pass',cl:pkCl,to:pkTo});
  if(typeof renderMe==='function')renderMe();
}
G.play=()=>{if(pickedCard()==null)sfx('no')};
G.pass=()=>{sfx('no')};
function answer(v){if(!phIs('ask')){sfx('no');return}send({t:'ans',v})}
function pressPass(){if(!canPassV()){sfx('no');return}send({t:'peek'})}
G.keyPhase=st=>st==='play';
G.onKey=()=>false;
G.preView=()=>{};
G.postView=()=>{};
G.buttons=()=>{
  $('#btnGura').hidden=true;
  const pb=$('#btnPlay');pb.disabled=true;pb.classList.remove('ready');
  $('#btnPass').disabled=true;
};
const EYE='<svg class="cp-eye" viewBox="0 0 24 24" aria-label="봄"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" fill="#fff6e2" stroke="#b5521e" stroke-width="2"/><circle cx="12" cy="12" r="3.6" fill="#3b2a1f"/></svg>';
G.nameTag=(p,i)=>{const o=V&&V.cp;return V&&V.st==='play'&&o&&(o.ph==='ask'||o.ph==='peek')&&(o.sn||[]).includes(i)?EYE:''};
G.logCue=()=>false;
const sndOk=()=>{tone(660,.1,{type:'triangle',vol:.16});tone(990,.18,{type:'triangle',vol:.15,at:.09})};
const sndBad=()=>{tone(170,.25,{type:'triangle',vol:.2});tone(120,.35,{type:'triangle',vol:.16,at:.12})};
G.cues=(v,pv)=>{
  const a=v.cp,b=pv&&pv.cp;if(!a||!b||a.gn!==b.gn)return;
  for(const e of a.ev)if(e.q>b.sq)evCue(e,v);
};
function evCue(e,v){
  if(e.k==='g'||e.k==='p')sfx('play',1);
  else if(e.k==='k')sfx('pick');
  else if(e.k==='a'){
    showBubble(e.s,`<span class="bt">${e.v?'진짜':'가짜'}</span>`,1800,'cpb');
    setTimeout(()=>{if(!V||!V.cp)return;fxSay(`${KNAME(kindOf(e.id))} · ${e.ok?'맞힘':'틀림'}`,e.ok?'#2f7a3a':'#b03a2e');e.ok?sndOk():sndBad()},650);
  }
}

/* ---------- 3D ----------
   넘기는 카드는 받은 사람 앞(가운데 쪽)에 엎어 두고 그 위 공중에 말한 벌레 그림. 몰래 볼 때는 내 눈앞으로 들어 올림.
   펼친 카드는 각자 앞 펠트에 종류별로 겹쳐 쌓음(4종류가 넘으면 두 줄). 한 장 더 모이면 지는 종류는 빨갛게 빛남.
   끝나면 진 사람이 모은 카드를 공중에 띄움 */
const R0=2.35,R1=1.45,STEP=.12,CS=.5,SP=.43;
const M={on:false,built:false,fail:false,root:null,raf:0,card:null,cardCs:-1,cardId:-2,sp:null,spK:-1,tex:[],col:[],glow:new Map(),gn:-1,lastSh:null,fl:null,flAt:0};
function claimTex(k){
  if(!M.tex[k])M.tex[k]=canvasTex(256,256,(g,w,h)=>{
    g.save();g.shadowColor='#ff8a2a';g.shadowBlur=24;g.fillStyle='rgba(255,250,240,.95)';g.beginPath();g.arc(w/2,h/2,96,0,7);g.fill();g.restore();
    g.strokeStyle='#ffb04a';g.lineWidth=10;g.beginPath();g.arc(w/2,h/2,96,0,7);g.stroke();
    g.save();g.translate(w/2,h/2);g.scale(1.45,1.45);drawBug(g,k);g.restore();
  });
  return M.tex[k];
}
function build(){
  if(M.built||M.fail)return M.built;
  if(!T.ok||typeof THREE==='undefined'){M.fail=true;return false}
  try{
    const root=new THREE.Group();root.visible=false;T.scene.add(root);M.root=root;
    const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:claimTex(0),transparent:true,depthTest:false,depthWrite:false}));sp.scale.set(.62,.62,1);sp.renderOrder=55;sp.visible=false;root.add(sp);M.sp=sp;M.spK=0;
    M.glowGeo=new THREE.PlaneGeometry(1,1);
    M.built=true;
  }catch(e){M.fail=true;try{console.warn('바퀴벌레 포커 3D 준비 실패',e)}catch(_){}}
  return M.built;
}
const seatFrom=(i,me)=>{const p=i===me?nearMe():seatPos(i,3.85);p.y=.5;return p};
const holdSpot=i=>{const p=seatPos(i,.75);p.y=.04;return p};
function newCard(pos,rx,ry,s,id){const c=makeCard(pos,rx,ry,s);if(id!=null)c.children[0].material=faceMat(id);return c}
function setFace(c,id){const m=id!=null&&id>=0?faceMat(id):T.back;if(c.children[0].material!==m)c.children[0].material=m}
function getGlow(key){
  let g=M.glow.get(key);
  if(!M.glowTex)M.glowTex=canvasTex(160,224,(x,w,h)=>{   // 빨갛게 빛나는 테두리 (가운데는 비움)
    x.fillStyle='rgba(255,70,40,.28)';rr(x,14,14,w-28,h-28,16);x.fill();
    x.shadowColor='#ff2a10';x.shadowBlur=16;x.strokeStyle='#ff5a3a';x.lineWidth=11;rr(x,14,14,w-28,h-28,16);x.stroke();x.stroke();
  });
  M.glowTex.premultiplyAlpha=true;   // 투명한 가장자리가 검게 번져 갈색으로 보이지 않게
  if(!g){g=new THREE.Mesh(M.glowGeo,new THREE.MeshBasicMaterial({map:M.glowTex,transparent:true,premultipliedAlpha:true,opacity:.8,depthWrite:false}));g.rotation.order='YXZ';g.renderOrder=2;M.root.add(g);M.glow.set(key,g)}
  return g;
}
function clearAll(){
  if(M.card){killCard(M.card);M.card=null}
  for(const row of M.col)for(const arr of row)arr.forEach(killCard);
  M.col=[];for(const g of M.glow.values()){M.root.remove(g);g.material.dispose()}M.glow.clear();
  M.cardCs=-1;M.cardId=-2;M.lastSh=null;M.fl=null;if(M.sp)M.sp.visible=false;
}
/* 펼친 카드 자리: 종류별 열, 열 안에서는 다음 카드가 주인 쪽으로 겹침(위 끝의 작은 그림이 보이게) */
function layoutCol(i,col,lose,show){
  const a=seatAngle(i),tx=Math.cos(a),tz=-Math.sin(a),ox=Math.sin(a),oz=Math.cos(a);
  const ks=[];for(let k=0;k<KN;k++)if(col[k]>0)ks.push(k);
  const rows=ks.length>4?[ks.slice(0,Math.ceil(ks.length/2)),ks.slice(Math.ceil(ks.length/2))]:[ks];
  rows.forEach((row,r)=>row.forEach((k,j)=>{
    const R=r?R1:R0,off=(j-(row.length-1)/2)*SP,arr=M.col[i][k];
    arr.forEach((c,n)=>{const u=c.userData,rr2=R+n*STEP;u.p.set(ox*rr2+tx*off,.03+n*.005,oz*rr2+tz*off);u.rx=-Math.PI/2;u.ry=a;u.s=CS;u.man=false});
    const key=i+':'+k,danger=show&&arr.length>=lose-1;
    if(danger){
      const g=getGlow(key),len=1.08*CS+(arr.length-1)*STEP+.14,mid=R+(arr.length-1)*STEP/2;
      g.visible=true;g.position.set(ox*mid+tx*off,.022,oz*mid+tz*off);g.rotation.set(-Math.PI/2,a,0);g.scale.set(.744*CS+.2,len+.06,1);g.userData.fl=false;
    }else if(M.glow.has(key))M.glow.get(key).visible=false;
  }));
  for(let k=0;k<KN;k++)if(!col[k]&&M.glow.has(i+':'+k))M.glow.get(i+':'+k).visible=false;
}
/* 진 사람이 모은 카드를 공중에 띄움: 내 쪽 공중에 종류별 열(세로 화면은 한 줄 3열), 지게 만든 종류는 빨갛게 */
const FL={S:.9,X:.82,DY:.15,CY:1.45,Z:2.3,TIL:-.6,GAP:.18};
function layoutFloat(i,col,lk){
  const ks=[];for(let k=0;k<KN;k++)if(col[k]>0)ks.push(k);
  const per=T.cam&&T.cam.aspect<1?3:4,rows=[];for(let j=0;j<ks.length;j+=per)rows.push(ks.slice(j,j+per));
  const {S,X,DY,CY,Z,TIL,GAP}=FL,ch=1.08*S,rh=ch+3*DY+GAP,top=CY+(rows.length*rh-GAP)/2-ch/2;
  for(const g of M.glow.values())g.visible=false;
  rows.forEach((row,r)=>row.forEach((k,j)=>{
    const x=(j-(row.length-1)/2)*X,y0=top-r*rh,arr=M.col[i][k];
    arr.forEach((c,n)=>{const u=c.userData;u.p.set(x,y0-n*DY,Z+n*.03);u.rx=TIL;u.ry=0;u.s=S;u.man=false});
    if(k===lk){
      const g=getGlow('fl'),h=ch+(arr.length-1)*DY+.22;
      g.visible=true;g.position.set(x,y0-(arr.length-1)*DY/2,Z-.06);g.rotation.set(TIL,0,0);g.scale.set(.744*S+.3,h+.1,1);g.userData.fl=true;
    }
  }));
}
G.field3D=(v,pv,me)=>{
  const o=v.cp;if(!o||!T.ok||!M.built||v.st==='wait')return;
  if(M.gn!==o.gn){clearAll();M.gn=o.gn}
  const n=v.ps.length;
  while(M.col.length<n)M.col.push(Array.from({length:KN},()=>[]));
  /* 넘기는 카드 */
  const has=o.cl!=null&&(o.ph==='ask'||o.ph==='peek'||o.ph==='show');
  let adopt=null;
  if(has){
    if(!M.card||M.cardCs!==o.cs){
      if(M.card)killCard(M.card);
      M.card=newCard(seatFrom(o.fr,me),Math.PI/2,seatAngle(o.fr),.8,null);M.cardCs=o.cs;M.cardId=-2;
    }
    const u=M.card.userData;u.man=false;
    let id=null;
    if(o.ph==='show'){const p=holdSpot(o.to);p.y=.06;u.p.copy(p);u.rx=-Math.PI/2;u.ry=0;u.s=1.1;id=o.id;M.lastSh={tk:o.sh.tk,k:kindOf(o.id)}}
    else if(o.ph==='peek'&&o.to===me&&o.id!=null){if(T.cam&&T.cam.aspect<1)u.p.set(0,2.35,2.3);else u.p.set(0,1.75,2.4);u.rx=-.6;u.ry=0;u.s=1.25;id=o.id}   // 내 눈앞(고르기 판 위쪽)으로 들어 올림
    else if(o.ph==='peek'){const p=holdSpot(o.to);p.y=.45;u.p.copy(p);u.rx=-.7;u.ry=seatAngle(o.to);u.s=1}
    else{u.p.copy(holdSpot(o.to));u.rx=Math.PI/2;u.ry=seatAngle(o.to);u.s=1}
    if(id!==M.cardId){M.cardId=id;setFace(M.card,id)}
  }else if(M.card){
    if(M.lastSh)adopt=M.lastSh;else{killCard(M.card);M.card=null}
    M.lastSh=null;
  }
  /* 펼친 카드 맞추기 */
  for(let i=0;i<n;i++)for(let k=0;k<KN;k++){
    const want=o.col[i]?o.col[i][k]:0,arr=M.col[i][k];
    while(arr.length>want)killCard(arr.pop());
    while(arr.length<want){
      if(adopt&&adopt.tk===i&&adopt.k===k&&M.card){setFace(M.card,k*8);arr.push(M.card);M.card=null;adopt=null;continue}
      const p=seatPos(i,R0);p.y=.4;arr.push(newCard(p,-Math.PI/2,seatAngle(i),CS,k*8));
    }
  }
  if(M.card&&!has){killCard(M.card);M.card=null}
  const lo=v.st==='over'&&o.lo?o.lo:null;
  for(let i=0;i<n;i++){if(lo&&i===lo.s)continue;layoutCol(i,o.col[i],o.lose,v.st==='play'||!!lo)}
  if(lo){if(!M.fl){M.fl=lo;M.flAt=clock()}layoutFloat(lo.s,o.col[lo.s],lo.k)}
  else M.fl=null;
};
function step(){
  M.raf=0;if(!M.on||!V||!V.cp)return;
  M.raf=requestAnimationFrame(step);
  const now=clock(),o=V.cp,show=V.st!=='wait'&&!dealingV();
  const sv=show&&!!M.card&&o.cl!=null&&(o.ph==='ask'||o.ph==='peek'||o.ph==='show')&&!(o.ph==='peek'&&o.to===myIdx());
  M.sp.visible=sv;
  if(sv){
    if(M.spK!==o.cl){M.spK=o.cl;M.sp.material.map=claimTex(o.cl);M.sp.material.needsUpdate=true}
    const p=M.card.position;M.sp.position.set(p.x,p.y+.72+Math.sin(now/420)*.03,p.z);
  }
  const pulse=.75+.25*Math.sin(now/260);
  for(const g of M.glow.values())if(g.visible)g.material.opacity=pulse;
}

/* ---------- 2D: 고르기 판·WebGL이 없을 때 ---------- */
const imgI=(k,cls)=>`<img class="${cls||''}" src="${iconURL(k)}" alt="${KNAME(k)}">`;
function drawPick(){
  if(!elPick)return;
  const give=phIs('give'),peek=phIs('peek'),id=give?pickedCard():null,on=(give&&id!=null)||peek;
  const ctx=on?(give?'g'+id:'p'+V.cp.cs)+':'+V.cp.sq:'';
  if(ctx!==pkCtx){pkCtx=ctx;pkTo=pkCl=-1}
  if(!on){if(!elPick.hidden){elPick.hidden=true;elPick.innerHTML='';pickKey=''}return}
  const tg=targetsV();if(tg.length===1)pkTo=tg[0];
  if(T.ok&&V.ps.length>2)tg.sort((a,b)=>Math.sin(seatAngle(a))-Math.sin(seatAngle(b)));   // 화면에서 왼쪽 자리부터
  if(pkTo>=0&&!tg.includes(pkTo))pkTo=-1;
  const peekImg=peek&&!M.on&&V.cp.id!=null?`<div class="cp-peek"><img src="${faceURL(kindOf(V.cp.id))}" alt="${KNAME(kindOf(V.cp.id))}"></div>`:'';
  const h=`${peekImg}${tg.length>1?`<div class="cp-to">${tg.map(i=>`<button type="button" data-to="${i}"${i===pkTo?' class="on"':''}>${esc(nameOf(i))}</button>`).join('')}</div>`:''}<div class="cp-cl">${[...Array(KN).keys()].map(k=>`<button type="button" data-cl="${k}" style="--bg:${KINDS[k].bg}"${k===pkCl?' class="on"':''} aria-label="${KNAME(k)}">${imgI(k)}</button>`).join('')}</div>`;
  if(h!==pickKey){pickKey=h;elPick.innerHTML=h;elPick.style.bottom='';elPick.hidden=false;liftPick()}
  elPick.hidden=false;
}
/* 고르기 판이 왼쪽 아래 내 이름 칸(#me)과 겹치면 그 위로 올림 */
function liftPick(){
  const me=$('#me'),st=$('#stage');if(!me||me.hidden||!st)return;
  const a=elPick.getBoundingClientRect(),b=me.getBoundingClientRect(),r=st.getBoundingClientRect();
  if(a.left<b.right+4&&a.bottom>b.top-4)elPick.style.bottom=Math.round(r.bottom-b.top+6)+'px';
}
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
function layoutBar(){
  const st=$('#stage'),fh=+T.fanH||0,key=String(fh);
  if(key===layKey)return;layKey=key;pickKey='';
  st.style.setProperty('--cpB',(fh+6)+'px');
}
G.afterFan=layoutBar;
G.live=()=>{
  if(!elT||!V||!V.cp)return;
  layoutBar();
  const ask=phIs('ask');
  if(elT.hidden===ask){elT.hidden=elF.hidden=!ask}
  const cp=ask&&canPassV();if(elP.hidden===cp)elP.hidden=!cp;
  drawPick();draw2d();
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
G.overDelay=()=>M.on?2400:0;
G.overWho=()=>{const o=V&&V.cp;return o&&o.lo?`${nameOf(o.lo.s)} 패배`:''};
G.overRank=p=>{const o=V&&V.cp,t=p.sr===3?'탈주':p.sr?'항복':o&&o.lo&&o.lo.s===p.i?'패배':'';return t?`<span class="left">${t}</span>`:''};
G.overExtra=()=>{
  const o=V&&V.cp;if(!o||!o.lo)return '';
  const c=o.col[o.lo.s]||[],cells=[...Array(KN).keys()].filter(k=>c[k]>0).map(k=>`<span class="cp-n${k===o.lo.k?' bad':''}">${imgI(k,'cp-ic')}${c[k]}</span>`).join('');
  return `<div class="cp-over"><p>${esc(nameOf(o.lo.s))}${o.lo.why==='empty'?' · 손패 없음':''}</p><div>${cells||'—'}</div></div>`;
};
G.enter=()=>{$('#btnGura').hidden=true};
G.leave=()=>{
  if(T.ok&&M.built)clearAll();
  if(elBox)elBox.hidden=true;
  if(M.root)M.root.visible=false;
  Object.assign(M,{on:false,gn:-1});
  layKey='';pkTo=pkCl=-1;pkCtx='';pickKey='';lastD='';
  if(elPick){elPick.hidden=true;elPick.innerHTML=''}
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
.cp-pick{position:absolute;left:50%;bottom:calc(var(--cpB,120px) + 6px);transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:8px;padding:8px;border-radius:16px;background:rgba(59,42,31,.92);pointer-events:auto;max-width:calc(100% - 16px);box-sizing:border-box}
.cp-pick[hidden]{display:none}
.cp-to{display:flex;flex-wrap:wrap;gap:6px;justify-content:center}
.cp-to button{font:400 16px "Jua",sans-serif;padding:7px 12px;border-radius:10px;border:0;background:#f4ead8;color:#3b2a1f;cursor:pointer;touch-action:manipulation}
.cp-to button.on{background:#ffb04a;box-shadow:0 0 0 2px #fff6e2 inset}
.cp-cl{display:grid;grid-template-columns:repeat(4,58px);gap:6px}
.cp-cl button{width:58px;height:58px;border-radius:12px;border:0;background:var(--bg);padding:5px;cursor:pointer;touch-action:manipulation}
.cp-cl button.on{box-shadow:0 0 0 3px #ffb04a}
.cp-cl img{width:100%;height:100%;display:block;pointer-events:none}
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
  elBox.innerHTML='<div class="cp-2d"></div><div class="cp-pick" hidden></div>';
  $('#stage').appendChild(elBox);
  $('#actions').insertAdjacentHTML('beforeend','<button type="button" class="act act-play cp-act" id="cpT" hidden>진짜</button><button type="button" class="act act-gura cp-act" id="cpF" hidden>가짜</button><button type="button" class="act act-pass cp-act" id="cpP" hidden>넘기기</button>');
  elT=$('#cpT');elF=$('#cpF');elP=$('#cpP');el2d=elBox.querySelector('.cp-2d');elPick=elBox.querySelector('.cp-pick');
  elT.addEventListener('click',()=>answer(1));elF.addEventListener('click',()=>answer(0));elP.addEventListener('click',pressPass);
  elPick.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(!phIs('give')&&!phIs('peek')){sfx('no');return}
    if(b.dataset.to!=null){const i=+b.dataset.to;pkTo=pkTo===i?-1:i}
    else if(b.dataset.cl!=null){const k=+b.dataset.cl;pkCl=pkCl===k?-1:k}
    sfx('pick');trySend();drawPick();
  });
};
(window.GAMES=window.GAMES||{}).cockroach=G;
})();
