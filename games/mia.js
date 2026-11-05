/* ===== 미아 게임 모듈 =====
   공통 코드(core/)가 GAMES.mia의 함수를 불러서 이 게임의 규칙·봇·화면을 그림. 사용자가 만든 보드게임. 화면 틀은 픽셀을 따름(탑뷰, 2~4명).
   판: 9×9 칸(위가 북). 칸 번호 = y*9 + x (x 0~8 서→동, y 0~8 북→남). 칸 이름 A~I + 1~9(아래가 1)
   벽: 칸과 칸 사이 한 칸 길이. 변 번호 e = 칸*2 + (0 동쪽 변, 1 남쪽 변). 어떤 칸도 판에서 끊어 놓는 벽은 세울 수 없음
   흐름: 시작 칸 고르기(place, 각자 다음 사람 말의 자리를 정함) → 깃발 주사위(roll) → 차례대로 이동·벽(move). 모두 한 번씩 하면 라운드가 끝나고 각자 자기 거리만 받음
   승리: 라운드 끝에 자기 깃발에 있으면 승리, 여럿이면 함께 승리(모두면 무승부)
   비밀: 내 말의 자리는 절대 나에게 보내지 않음(엔진 snap). 벽에 부딪혀도 알리지 않음. 소리도 똑같음
   손패(hand)는 표시용 값 [0] (공통 코드가 hand가 비면 끝난 사람으로 봄) */
(function(){
const G={id:'mia',name:'미아',short:'미아',lead:'내가 어디 있는지 모른 채 탈출구 찾아가기',maxHi:4,minN:2,noFast:true,firstPick:true,botLvs:['쉬움'],oneBotLv:true};

/* ---------- 규칙 (방장 엔진·화면·봇·테스트가 같은 함수를 씀) ---------- */
const N=9,CELLS=81,EDGES=162;
const IX=(x,y)=>y*N+x,CX=i=>i%N,CY=i=>(i/N)|0;
const DX=[0,1,0,-1],DY=[-1,0,1,0],DNAME=['북','동','남','서'],DARROW=['↑','→','↓','←'];
const cellName=i=>'ABCDEFGHI'[CX(i)]+(N-CY(i));
const diceCell=(a,b)=>IX(a-1,N-b);   // 주사위 두 개(1~9): 첫째 = 열(1이 A), 둘째 = 행
const validEdge=e=>{if(!Number.isInteger(e)||e<0||e>=EDGES)return false;const c=e>>1;return e&1?CY(c)<N-1:CX(c)<N-1};
const edgeOf=(c,d)=>d===1?c*2:d===2?c*2+1:d===3?(c-1)*2:(c-N)*2+1;   // 칸 c의 d 방향 변
const edgeName=e=>{const c=e>>1;return cellName(c)+'-'+cellName(e&1?c+N:c+1)};
function blocked(w,c,d){
  const x=CX(c)+DX[d],y=CY(c)+DY[d];
  if(x<0||x>=N||y<0||y>=N)return true;
  return !!w[edgeOf(c,d)];
}
const step=(w,c,d)=>blocked(w,c,d)?c:c+DX[d]+DY[d]*N;
/* 한 칸에서 모든 칸까지 최단 거리 */
function distMap(w,from){
  const dist=new Array(CELLS).fill(-1),q=[from];dist[from]=0;
  for(let h=0;h<q.length;h++){const c=q[h];for(let d=0;d<4;d++){if(blocked(w,c,d))continue;const m=c+DX[d]+DY[d]*N;if(dist[m]<0){dist[m]=dist[c]+1;q.push(m)}}}
  return dist;
}
const connected=w=>distMap(w,0).every(v=>v>=0);
/* 세울 수 있는 벽: 비어 있고, 세워도 모든 칸이 이어져 있음. 벽만 보고 판정하므로 내 자리가 드러나지 않음 */
function wallOK(w,e){
  if(!validEdge(e)||w[e])return false;
  w[e]=1;const ok=connected(w);w[e]=0;return ok;
}
function legalWalls(w){const o=[];for(let e=0;e<EDGES;e++)if(wallOK(w,e))o.push(e);return o}
/* 눌린 칸 안의 위치(fx,fy: 판 좌표)에서 가장 가까운 변 */
function edgeAt(fx,fy){
  const x=Math.floor(fx),y=Math.floor(fy);
  if(x<0||x>=N||y<0||y>=N)return -1;
  const c=IX(x,y),u=fx-x-.5,v=fy-y-.5,o=[[u,1],[-u,3],[-v,0],[v,2]].sort((a,b)=>b[0]-a[0]);
  for(const [,d] of o){if(CX(c)+DX[d]<0||CX(c)+DX[d]>=N||CY(c)+DY[d]<0||CY(c)+DY[d]>=N)continue;return edgeOf(c,d)}
  return -1;
}

/* 쉬움 봇: 자기 자리를 보지 않음. 공개된 벽·자기 깃발·자기가 받은 거리만으로 있을 수 있는 칸(bel)을 줄여 감
   beliefMove: 이동한 뒤의 후보, beliefFilter: 라운드 끝 거리로 거름 */
const beliefMove=(bel,w,d)=>[...new Set(bel.map(c=>step(w,c,d)))];
const beliefFilter=(bel,dist,d)=>bel.filter(c=>dist[c]===d);
function botDir(bel,w,flag,rnd){
  rnd=rnd||Math.random;
  if(!bel.length||rnd()<.2)return rnd()*4|0;
  const dist=distMap(w,flag);let best=[],bs=1e9;
  for(let d=0;d<4;d++){
    let s=0;for(const c of bel)s+=dist[step(w,c,d)];
    s/=bel.length;
    if(s<bs-1e-9){bs=s;best=[d]}else if(Math.abs(s-bs)<=1e-9)best.push(d);
  }
  return best[rnd()*best.length|0];
}
function botAction(bel,w,flag,left,rnd){
  rnd=rnd||Math.random;
  if(left>0&&rnd()<.2){const L=legalWalls(w);if(L.length)return {t:'wall',e:L[rnd()*L.length|0]}}
  return {t:'go',d:botDir(bel,w,flag,rnd)};
}

/* ---------- 규칙 설명·방 설정 ---------- */
G.rulesHTML='<ol class="rules"><li><b>목표</b> : 내 탈출구에 먼저 도착하면 이깁니다. 다만 <b>내 말이 어디 있는지 나만 모릅니다</b></li><li><b>판</b> : 9×9 칸이고 위가 북쪽입니다. 칸마다 A1~I9 이름이 있습니다</li><li><b>시작 칸</b> : 각자 다음 사람의 말을 놓을 칸을 몰래 고릅니다. 내 말은 이전 사람이 고릅니다</li><li><b>탈출구</b> : 각자 10면체 주사위 두 개로 탈출구 칸을 정합니다. 첫째는 열(1이 A), 둘째는 행입니다. 0이 나오면 다시 굴리고, 시작 칸과 같아도 다시 굴립니다</li><li><b>내 차례</b> : 행동을 <b>두 번</b> 합니다. 행동은 내 말을 동서남북 중 한 칸 움직이기, 또는 벽 하나 세우기입니다(2이동, 1벽 1이동, 2벽 모두 됩니다). 벽이나 판 끝으로 움직이면 아무 말 없이 제자리에 있고 행동만 씁니다</li><li><b>벽</b> : 칸과 칸 사이에 한 칸 길이로 세웁니다. 어떤 칸도 판에서 끊어 놓을 수 없습니다. 벽은 모두 40개이고 똑같이 나눠 각자 앞에 세워 둡니다(탁자 설정으로 바꿀 수 있습니다)</li><li><b>거리</b> : 모두 한 번씩 하면 라운드가 끝나고, 각자 내 탈출구까지의 <b>최단 거리</b>를 받습니다. 벽을 돌아가는 칸 수입니다</li><li><b>승리</b> : 라운드가 끝날 때 내 탈출구 칸에 있으면 이깁니다. 같은 라운드에 여럿이 도착하면 함께 승리하고, 모두 도착하면 무승부입니다</li><li><b>메모</b> : 판의 칸을 누르면 ✕, 한 번 더 누르면 지워집니다. 나만 봅니다</li><li><b>제한 시간</b> : 시간이 지나면 무작위 방향으로 움직입니다. 시작 칸은 무작위로 고릅니다. 연결이 끊겨도 시간은 흐르고, 45초 안에 돌아오지 않으면 탈주로 처리합니다</li><li><b>조작</b> : 내 차례가 되면 남은 칸 수 둘레에 방향 버튼이 생기고, 누르면 바로 움직입니다. 벽은 내 앞의 보관대를 누른 뒤 칸의 벽 세울 쪽을 누르고 <b>[놓기]</b>입니다. 설정의 <b>두 번 눌러 놓기</b>를 켜면 같은 곳을 한 번 더 눌러 바로 세웁니다. 키보드는 화살표, 벽은 X입니다</li><li><b>선 플레이어</b> : 첫 판은 탁자 설정으로 정합니다(무작위면 주사위, 선택이면 방장이 대기실에서 고름). 결과 화면에서 바로 시작하면 다음 사람이 먼저 합니다</li></ol>';
G.modeDesc=['탈출구에 도착하면 끝','탈출구에 도착하면 끝'];
G.defaults={max:2,turn:30,wallT:40,pickfirst:0};
G.roomSet=[{k:'turn',label:'제한 시간',unit:'초',lo:10,hi:120,step:5,desc:'시간이 지나면 무작위 방향으로 움직입니다. 연결이 끊겨도 시간은 흐르고, 45초가 지나면 탈주로 처리합니다'},{k:'wallT',label:'전체 벽',unit:'개',lo:8,hi:80,step:4,desc:'모든 사람의 벽을 합친 수입니다. 똑같이 나눠 가지고 남는 벽은 쓰지 않습니다'}];
G.ruleSet=[{k:'pickfirst',pick:1,label:'선 플레이어',desc:'선택: 방장이 이름표 메뉴에서 선 플레이어를 고릅니다. 무작위: 주사위로 정하고, 바로 시작하면 다음 사람이 먼저 합니다'}];
G.cfgChips=c=>`<span class="chip">제한 시간 <b>${+c.turn}초</b></span><span class="chip">전체 벽 <b>${+c.wallT}개</b></span><span class="chip">선 <b>${+c.pickfirst?'선택':'무작위'}</b></span>`;
G.cfgSum=c=>`제한 시간 ${+c.turn}초 · 전체 벽 ${+c.wallT}개 · 선 ${+c.pickfirst?'선택':'무작위'}`;
G.roomSub=()=>'2~4명 보드게임';
G.pubExtra=()=>({});
G.cardInfo=(c,nowN)=>`<p class="cardinfo">내 말이 어디 있는지 나만 모릅니다.${nowN>4?'<br>미아는 최대 4명까지 할 수 있습니다.':''}</p>`;
G.rankTitle=()=>'';
G.finLabel=()=>'';
G.noEmotes=[];
G.keys={miaL:'ArrowLeft',miaR:'ArrowRight'};   // ↑·↓는 블랙잭(bjUp·bjDown), 벽은 쿼리도(qmode)와 같은 키를 같이 씀
G.keyActions=[{a:'miaL',n:'서쪽 고르기',d:'미아: ← 방향을 고릅니다. ↑↓는 블랙잭 키, 벽은 쿼리도 벽 키를 같이 씁니다'},{a:'miaR',n:'동쪽 고르기',d:'미아: → 방향을 고릅니다'}];
G.cardHTML=()=>'';G.drawFace=()=>{};G.cmpCard=()=>0;G.labelOf=()=>'';

/* ---------- 방장 엔진 ---------- */
const ROLL_EACH=1300,ROLL_TAIL=400,ACTS=2;   // ACTS: 한 차례의 행동 수
const rollMs=cnt=>cnt*ROLL_EACH+ROLL_TAIL;
const active=i=>!H.players[i].finished;
const activeSeats=()=>{const o=[];for(let i=0;i<H.mia.cnt;i++)if(active(i))o.push(i);return o};
const targetOf=i=>(i+1)%H.mia.cnt;   // 내가 시작 칸을 정해 주는 사람
function sameNames(a,b){return a.length===b.length&&a.every(x=>b.includes(x))}
function pickFirst(again,cnt){
  const ns=H.players.slice(0,cnt).map(p=>p.name),L=H.miaLast;
  if(again&&L&&sameNames(ns,L.ns)&&ns.includes(L.h))return (ns.indexOf(L.h)+1)%cnt;
  return typeof firstSeat==='function'?firstSeat(cnt):Math.random()*cnt|0;
}
/* 시작 칸을 아직 안 고른 사람들 */
const pendSeats=()=>{const X_=H.mia,o=[];for(const i of activeSeats()){const t=targetOf(i);if(active(t)&&X_.pos[t]<0)o.push(i)}return o};
function setPlaceTurn(){const p=pendSeats(),X_=H.mia;H.turn=p.length?p[0]:X_.A}
function randomCell(){return Math.random()*CELLS|0}
function doPick(seat,c){
  const X_=H.mia;
  if(H.phase!=='play'||X_.ph!=='place'||!active(seat)||!Number.isInteger(c)||c<0||c>=CELLS)return false;
  const t=targetOf(seat);if(X_.pos[t]>=0)return false;
  X_.pos[t]=c;X_.path[t]=[c];
  addLog(`${H.players[seat].name} 시작 칸 고름`);
  if(pendSeats().length){setPlaceTurn();mark()}else beginRoll();
  return true;
}
function beginRoll(){
  const X_=H.mia;
  /* 끊긴 고리: 고를 사람이 나간 말은 아래에서 무작위로 */
  for(const i of activeSeats())if(X_.pos[i]<0){X_.pos[i]=randomCell();X_.path[i]=[X_.pos[i]]}
  for(const i of activeSeats()){
    let a,b,c;do{a=1+(Math.random()*9|0);b=1+(Math.random()*9|0);c=diceCell(a,b)}while(c===X_.pos[i]);
    X_.roll[i]=[a,b];X_.flag[i]=c;X_.bel[i]=Array.from({length:CELLS},(_,k)=>k).filter(k=>k!==c);
    addLog(`${H.players[i].name} 탈출구 ${cellName(c)}`);
  }
  X_.ph='roll';H.turn=active(X_.A)?X_.A:activeSeats()[0];
  H.deadline=clock()+rollMs(X_.cnt);H.botActAt=0;mark();
}
function startTurn(i){
  H.turn=i;H.graceUntil=0;H.deadline=clock()+H.cfg.turn*1000;
  H.botActAt=H.players[i].bot?clock()+rand(900,1700):0;
  mark();
}
function startRound(){
  const X_=H.mia;X_.done=[];X_.acts=0;
  const f=active(X_.A)?X_.A:activeSeats().find(s=>s>X_.A)??activeSeats()[0];
  X_.ph='move';startTurn(f);
}
function over(res){
  const X_=H.mia;X_.res=res;X_.ph='end';
  for(const s of activeSeats()){const p=H.players[s];p.rank=res.w.includes(s)?1:(res.w.length===0?1:2);p.finished=true;p.hand=[]}
  H.miaLast={ns:H.players.slice(0,X_.cnt).map(p=>p.name),h:H.players[X_.A].name};
  H.phase='over';H.botActAt=0;mark();
  H.players.forEach((p,i)=>{if(p.bot&&Math.random()<.5)botEmote(i,'gg',800+Math.random()*1600)});
}
function endRound(){
  const X_=H.mia;X_.rn++;
  const act=activeSeats();
  for(const s of act){
    const dist=distMap(X_.w,X_.flag[s]),d=dist[X_.pos[s]],h=X_.hist[s];
    if(h.length&&h[h.length-1].d<0)h[h.length-1].d=d;
    X_.bel[s]=beliefFilter(X_.bel[s],dist,d);
  }
  const w=act.filter(s=>X_.pos[s]===X_.flag[s]);
  if(w.length){
    if(w.length===act.length)addLog('모두 함께 도착해 무승부입니다.','sys');
    else addLog(`${w.map(s=>H.players[s].name).join(', ')} 도착, 승리`,'fin');
    over({why:'goal',w:w.length===act.length?[]:w});return;
  }
  startRound();
}
function afterAct(seat){
  const X_=H.mia;X_.n++;X_.acts++;
  if(X_.acts<ACTS){startTurn(seat);return}
  X_.acts=0;X_.done.push(seat);
  for(let k=1;k<=X_.cnt;k++){const j=(seat+k)%X_.cnt;if(active(j)&&!X_.done.includes(j)){startTurn(j);return}}
  endRound();
}
const turnOK=seat=>H.phase==='play'&&H.mia.ph==='move'&&H.turn===seat;
/* 내 기록: 차례마다 한 줄 {a:[행동…],d:라운드 끝 거리} */
function histAdd(seat,a){const X_=H.mia,h=X_.hist[seat];if(X_.acts===0||!h.length)h.push({a:[a],d:-1});else h[h.length-1].a.push(a)}
function doGo(seat,d){
  const X_=H.mia;
  if(!turnOK(seat)||!Number.isInteger(d)||d<0||d>3)return false;
  const from=X_.pos[seat],to=step(X_.w,from,d);
  X_.pos[seat]=to;X_.path[seat].push(to);histAdd(seat,d);
  X_.bel[seat]=beliefMove(X_.bel[seat],X_.w,d);
  X_.lm={n:X_.n+1,s:seat,k:'m',d};
  addLog(`${X_.rn+1}라운드 ${H.players[seat].name} ${DNAME[d]}쪽`);
  afterAct(seat);return true;
}
function doWall(seat,e){
  const X_=H.mia;
  if(!turnOK(seat)||X_.left[seat]<=0||!wallOK(X_.w,e))return false;
  X_.w[e]=seat+1;X_.ws.push(e);X_.left[seat]--;histAdd(seat,4);
  X_.lm={n:X_.n+1,s:seat,k:'w',e};
  addLog(`${X_.rn+1}라운드 ${H.players[seat].name} 벽 ${edgeName(e)}`);
  afterAct(seat);return true;
}
function doSurrender(i){
  const X_=H.mia;
  if(H.phase!=='play'||i<0||i>=X_.cnt||!active(i))return;
  const p=H.players[i];p.finished=true;p.hand=[];p.surrendered=true;p.rank=H.rankBottom--;
  addLog(`${p.name} ${p.deserter?'탈주':'항복'}`,'lie');
  const act=activeSeats();
  if(act.length<=1){if(act.length)addLog(`${H.players[act[0]].name} 승리`,'fin');over({why:'last',w:act});return}
  if(X_.ph==='place'){
    const t=targetOf(i);
    if(active(t)&&X_.pos[t]<0){X_.pos[t]=randomCell();X_.path[t]=[X_.pos[t]]}
    if(pendSeats().length){setPlaceTurn();mark()}else beginRoll();
    return;
  }
  if(X_.ph==='roll'){if(H.turn===i)H.turn=act[0];mark();return}
  if(H.turn===i){
    X_.acts=0;
    for(let k=1;k<=X_.cnt;k++){const j=(i+k)%X_.cnt;if(active(j)&&!X_.done.includes(j)){startTurn(j);return}}
    endRound();
  }else mark();
}
function timeoutMove(i){doGo(i,Math.random()*4|0)}
function botMove(i){
  const X_=H.mia,a=botAction(X_.bel[i],X_.w,X_.flag[i],X_.left[i]);
  if(!(a.t==='wall'?doWall(i,a.e):doGo(i,a.d)))timeoutMove(i);
}
G._test={ACTS,IX,CX,CY,cellName,diceCell,validEdge,edgeOf,edgeName,blocked,step,distMap,connected,wallOK,legalWalls,edgeAt,beliefMove,beliefFilter,botDir,botAction,doGo,doWall,doPick,doSurrender,pickFirst,rollMs,targetOf};
G.engine={
  start(){
    const again=H.phase==='over',cnt=Math.max(2,Math.min(H.players.length,4));
    Object.assign(H,{phase:'play',log:[],seatNote:{},field:[],last:null,reveal:null,shouts:[],pending:null,rankNext:1,rankBottom:cnt,known:{}});
    H.players.forEach((p,i)=>{p.finished=false;p.rank=null;p.surrendered=false;if(i<cnt)p.hand=[0];else{p.hand=[];p.finished=true;p.rank=i+1}});
    const A=pickFirst(again,cnt),nw=Math.floor(Math.max(0,Math.min(80,+H.cfg.wallT||0))/cnt),arr=v=>new Array(cnt).fill(v);
    H.mia={cnt,A,ph:'place',rn:0,n:0,acts:0,wn:nw,pos:arr(-1),flag:arr(-1),roll:arr(null),w:new Array(EDGES).fill(0),ws:[],left:arr(nw),done:[],hist:Array.from({length:cnt},()=>[]),bel:Array.from({length:cnt},()=>[]),path:Array.from({length:cnt},()=>[]),lm:null,res:null};
    addLog(`${H.players[A].name}님이 먼저 시작합니다.`,'sys');
    H.turn=A;setPlaceTurn();H.graceUntil=0;H.deadline=clock()+H.cfg.turn*1000;H.botActAt=clock()+rand(900,1700);mark();
  },
  act(seat,a){
    if(a.t==='surrender'){doSurrender(seat);return}
    if(a.t==='pick')doPick(seat,a.c);
    else if(a.t==='go')doGo(seat,a.d);
    else if(a.t==='wall')doWall(seat,a.e);
  },
  tick(t){
    if(H.phase!=='play')return;
    const X_=H.mia;
    if(X_.ph==='place'){
      if(t>=H.deadline){for(const i of pendSeats())doPick(i,randomCell());return}
      if(H.botActAt&&t>=H.botActAt){
        for(const i of pendSeats()){const p=H.players[i];if(p.bot&&!(p.away&&t<p.awayAt+AWAY_WAIT))doPick(i,randomCell());if(H.phase!=='play'||X_.ph!=='place')return}
      }
      return;
    }
    if(X_.ph==='roll'){if(t>=H.deadline)startRound();return}
    const cur=H.players[H.turn];
    if(t>=H.deadline){if(cur.bot&&!awayHuman(cur))botMove(H.turn);else timeoutMove(H.turn)}
    else if(cur.bot&&H.botActAt&&t>=H.botActAt&&!(cur.away&&t<cur.awayAt+AWAY_WAIT))botMove(H.turn);
  },
  /* 받는 사람마다 따로: 내 말의 자리(pos)와 내가 움직인 결과는 게임이 끝날 때까지 보내지 않음. 거리는 자기 것만 */
  snap(s,you,t){
    const X_=H.mia,end=H.phase==='over',seat=you>=0&&you<X_.cnt;
    let pos;
    if(X_.ph==='place')pos=X_.pos.map((c,i)=>seat&&i===targetOf(you)?c:-1);
    else pos=X_.pos.map((c,i)=>(!end&&i===you)||(!end&&H.players[i].finished)?-1:c);
    const showFlag=X_.ph!=='place';
    s.mia={cnt:X_.cnt,A:X_.A,ph:X_.ph,rn:X_.rn,n:X_.n,acts:X_.acts,wn:X_.wn,pos,flag:showFlag?X_.flag.slice():X_.flag.map(()=>-1),roll:showFlag?X_.roll.slice():null,
      ws:X_.ws.slice(),left:X_.left.slice(),hist:seat?X_.hist[you].map(h=>[h.a.slice(),h.d]):[],res:X_.res?{...X_.res,w:X_.res.w.slice()}:null,
      lm:X_.lm&&X_.lm.k==='w'?{...X_.lm}:null,out:Array.from({length:X_.cnt},(_,i)=>H.players[i].surrendered?1:0)};
    if(end)s.mia.path=X_.path.map(p=>p.slice());
    if(X_.ph==='place'){
      const P=pendSeats();s.mia.pk=X_.pos.map((c,i)=>!P.includes(i)?1:0);
      if(seat&&P.includes(you))s.t=you;else if(P.length)s.t=P[0];else delete s.t;
    }
    if(X_.ph==='roll'){delete s.t;s.mia.ra=Math.max(0,Math.round(H.deadline-t))}
    s.gr=0;s.dl=Math.max(0,Math.round(H.deadline-t));
  },
  restore(){},
  emoPhase:ph=>ph==='play'||ph==='over'
};

/* ---------- 화면 (모든 참가자) ----------
   2D(SVG)와 3D(공통 테이블 가운데 판)는 같은 상태(CS)를 보고 그림. 모두 같은 방향(위가 북)에서 봄.
   고른 것(pend): {k:'cell',c} 시작 칸, {k:'dir',d} 이동 방향, {k:'wall',e} 벽. 메모는 이 기기에만 남음 */
const SEAT_C=['#c53026','#2b65ca','#1f7a2e','#c9831a'];   // 자리 색 (첫 차례 주사위 면과 같음)
const MOVE_MS=240;
let CS=null,pend=null,wallMode=false,flash=-1,flashAt=0,memo={},memoKey='',rollT0=0,lastDist=-1,popAt=0;
let elRoot=null,elSvg=null,elMain=null,elBar=null,elBarMe=null,elHint=null,elHist=null,elCtl=null,lastBoard='',lastBar='',lastHint='',lastHist='',lastCtl='';
const dblOn=()=>typeof dblTap!=='undefined'&&!!dblTap;
const nm=i=>V.ps[i]?V.ps[i].n:'?';
const seatMe=()=>{const m=myIdx();return !!CS&&m>=0&&m<CS.cnt};
const playing=()=>!!(V&&V.mia&&V.st==='play'&&CS&&!introWait());
const pickingNow=()=>playing()&&CS.ph==='place'&&seatMe()&&V.t===myIdx()&&CS.pos[(myIdx()+1)%CS.cnt]<0;
const myMove=()=>playing()&&CS.ph==='move'&&seatMe()&&V.t===myIdx()&&myReady();
const wallSet=()=>{const w=new Array(EDGES).fill(0);if(CS)for(const e of CS.ws)w[e]=1;return w};
const flagShown=i=>{
  if(!CS||CS.flag[i]<0)return false;
  if(CS.ph!=='roll')return true;
  return clock()>=rollT0+(i+1)*ROLL_EACH-120;
};
const isOut=i=>!!(CS&&CS.out&&CS.out[i]);
const hideEnd=i=>isOut(i);
function redraw(){drawAll();G.buttons();P3.dirty=true;d3Marks()}
function sndLift(vol){tone(1100,.03,{type:'triangle',vol:vol*.5});hiss(.02,{freq:3400,q:3,vol:vol*.4})}
function sndNo(){sfx('no')}
function sndStep(at){tone(420,.05,{type:'triangle',vol:.1,at});hiss(.03,{freq:1500,q:2,vol:.08,at})}
function sndWall(at){hiss(.04,{freq:1400,q:2,vol:.2,at});tone(170,.1,{type:'triangle',vol:.2,at})}
function sndRound(at){tone(880,.06,{type:'triangle',vol:.1,at});tone(1320,.08,{type:'triangle',vol:.08,at:at+.07})}
function sndDice(at){hiss(.04,{freq:3000,q:2,vol:.1,at});tone(600+Math.random()*300,.025,{type:'square',vol:.02,at})}
function sndWin(at){[660,880,1320].forEach((f,k)=>tone(f,.13,{type:'square',vol:.035,at:at+k*.1}))}

/* 판을 누름: fx,fy는 판 좌표(칸 하나 = 1) */
function tapAt(fx,fy){
  if(!V||!V.mia||!CS)return;
  const x=Math.floor(fx),y=Math.floor(fy);
  if(x<0||x>=N||y<0||y>=N)return;
  const c=IX(x,y);
  if(pickingNow()){
    if(pend&&pend.k==='cell'&&pend.c===c){if(dblOn())confirmPend();else{pend=null;sndLift(.08);redraw()}return}
    pend={k:'cell',c};sndLift(.12);redraw();return;
  }
  if(wallMode&&myMove()){
    const e=edgeAt(fx,fy);if(e<0)return;
    if(pend&&pend.k==='wall'&&pend.e===e){if(dblOn())confirmPend();else{pend=null;sndLift(.08);redraw()}return}
    if(wallOK(wallSet(),e)&&CS.left[myIdx()]>0){pend={k:'wall',e};sndLift(.12);redraw();return}
    pend=null;flash=e;flashAt=clock();sndNo();redraw();return;
  }
  if(CS.ph==='place'&&!pickingNow()&&seatMe()&&V.st==='play')return;
  if(V.st==='play'||V.st==='over'){
    if(memo[c])delete memo[c];else memo[c]=1;
    saveMemo();sndLift(.07);redraw();
  }
}
function saveMemo(){try{store('gura-mia-memo',JSON.stringify({k:memoKey,m:memo}))}catch(e){}}
function loadMemo(){try{const o=JSON.parse(store('gura-mia-memo')||'null');memo=o&&o.k===memoKey&&o.m?o.m:{}}catch(e){memo={}}}
/* 방향 버튼: 누르면 바로 이동. 답이 오기 전에 또 눌러 두 행동이 나가지 않게 잠깐 막음 */
let goLock=-1,goAt=0;
function tapDir(d){
  if(!myMove()||(goLock===CS.n&&clock()-goAt<1500)){sndNo();return}
  wallMode=false;pend=null;goLock=CS.n;goAt=clock();sndLift(.12);
  sendAct({t:'go',d});redraw();
}
function toggleWall(){
  if(!myMove()||CS.left[myIdx()]<=0){sndNo();return}
  wallMode=!wallMode;pend=null;sndLift(.1);redraw();
}
function confirmPend(){
  if(!pend)return;
  const p=pend;
  if(p.k==='cell'){if(!pickingNow())return;pend=null;sendAct({t:'pick',c:p.c});redraw();return}
  if(!myMove())return;
  pend=null;
  if(CS.left[myIdx()]<=1)wallMode=false;
  sendAct({t:'wall',e:p.e});
  redraw();
}

/* ----- 2D (SVG): 칸 = 1, 판은 (0,0)~(9,9) ----- */
const edgeLine=e=>{const c=e>>1,x=CX(c),y=CY(c);return e&1?[x,y+1,x+1,y+1]:[x+1,y,x+1,y+1]};
const memoGlyph=(k,x,y,col)=>k===1?`<path d="M${x+.3} ${y+.3}L${x+.7} ${y+.7}M${x+.7} ${y+.3}L${x+.3} ${y+.7}" stroke="${col}" stroke-width=".07" stroke-linecap="round"/>`:`<circle cx="${x+.5}" cy="${y+.5}" r=".16" fill="${col}"/>`;
function boardHTML(){
  const out=['<rect x="-.34" y="-.34" width="9.68" height="9.68" rx=".12" fill="#6b3f1f"/>'];
  for(let y=0;y<N;y++)for(let x=0;x<N;x++)out.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${(x+y)&1?'#e6d6b4':'#f0e4c8'}" stroke="#a98a5b" stroke-width=".02"/>`);
  for(const c of Object.keys(memo))out.push(memoGlyph(memo[c],CX(+c),CY(+c),'rgba(70,50,30,.6)'));
  for(let i=0;i<CS.cnt;i++)if(flagShown(i)&&!hideEnd(i)){const c=CS.flag[i],x=CX(c),y=CY(c);out.push(`<circle cx="${x+.5}" cy="${y+.5}" r=".4" fill="${SEAT_C[i]}" stroke="#3a2210" stroke-width=".04"/><rect x="${x+.58}" y="${y+.22}" width=".22" height=".56" fill="#2a1a0e" stroke="#fff3d0" stroke-width=".04"/><g stroke="#fff3d0" stroke-width=".06" fill="none" stroke-linecap="round"><path d="M${x+.42} ${y+.38}L${x+.36} ${y+.56}M${x+.42} ${y+.4}L${x+.53} ${y+.47}M${x+.42} ${y+.4}L${x+.27} ${y+.46}M${x+.36} ${y+.57}L${x+.49} ${y+.64}L${x+.47} ${y+.77}M${x+.36} ${y+.57}L${x+.3} ${y+.71}L${x+.18} ${y+.72}"/></g><circle cx="${x+.47}" cy="${y+.27}" r=".07" fill="#fff3d0"/>`)}
  if(CS.path)CS.path.forEach((p,i)=>{if(p.length>1)out.push(`<polyline points="${p.map(c=>(CX(c)+.5)+','+(CY(c)+.5)).join(' ')}" fill="none" stroke="${SEAT_C[i]}" stroke-width=".07" opacity=".7"/>`)});
  CS.pos.forEach((c,i)=>{if(c>=0&&(CS.ph!=='place'||true)&&!(CS.ph==='roll'&&false))out.push(`<circle cx="${CX(c)+.5}" cy="${CY(c)+.5}" r=".28" fill="${SEAT_C[i]}" opacity="${V.st==='over'?.9:.5}" stroke="#3a2210" stroke-width=".03"/>`)});
  for(const e of CS.ws){const l=edgeLine(e),last=CS.lm&&CS.lm.e===e;out.push(`<line x1="${l[0]}" y1="${l[1]}" x2="${l[2]}" y2="${l[3]}" stroke="${last?'#c98a12':'#3a2210'}" stroke-width=".13" stroke-linecap="round"/>`)}
  if(pend&&pend.k==='cell')out.push(`<circle cx="${CX(pend.c)+.5}" cy="${CY(pend.c)+.5}" r=".28" fill="${SEAT_C[(myIdx()+1)%CS.cnt]}" opacity=".6"/>`);
  if(pend&&pend.k==='wall'){const l=edgeLine(pend.e);out.push(`<line x1="${l[0]}" y1="${l[1]}" x2="${l[2]}" y2="${l[3]}" stroke="#4f9d3f" stroke-width=".13" stroke-linecap="round" opacity=".85"/>`)}
  if(flash>=0&&clock()-flashAt<700&&validEdge(flash)){const l=edgeLine(flash);out.push(`<line x1="${l[0]}" y1="${l[1]}" x2="${l[2]}" y2="${l[3]}" stroke="#d6342a" stroke-width=".13" stroke-linecap="round"/>`)}
  return out.join('');
}
function onSvgClick(e){
  if(!CS)return;
  const pt=elSvg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;const m=elSvg.getScreenCTM();if(!m)return;
  const q=pt.matrixTransform(m.inverse());tapAt(q.x,q.y);
}
function chipHTML(i){
  const me=myIdx(),p=V.ps[i];if(!p||i>=CS.cnt)return '';
  const on=introWait()?(IN.fp?IN.fp.idx(clock())===i:false):V.st==='play'&&(CS.ph==='place'?CS.pk&&!CS.pk[i]:CS.ph==='move'&&V.t===i)&&!p.sr;
  const r=CS.res;
  const st=p.sr===3?'탈주':p.sr?'항복':V.st==='over'?(r&&r.w.includes(i)?'승리':''):CS.ph==='place'?'':`벽 ${CS.left[i]}`;
  return `<div class="mia-p${on?' on':''}${i===me?' me':''}${p.sr?' out':''}" style="--pc:${SEAT_C[i]}"><i class="dot"></i><b>${esc(p.n)}${i===me?' (나)':''}</b>${st?`<span class="st">${st}</span>`:''}${on&&V.st==='play'?'<span class="tb"><i></i></span>':''}</div>`;
}
function barHTML(){const n=CS.cnt,me=myIdx(),s=seatMe(),b=s?me:0,o=Array.from({length:n},(_,k)=>(b+k)%n);return (s?o.slice(1):o).map(chipHTML).join('')}
const meBarHTML=()=>seatMe()?chipHTML(myIdx()):'';
function hintText(){
  if(!V||!V.mia||!CS)return '';
  if(V.st==='play'){
    if(introWait())return '';
    if(CS.ph==='place')return pickingNow()?`${nm((myIdx()+1)%CS.cnt)} 시작 칸`:'';
    return '';
  }
  const r=CS.res;if(!r)return '게임이 끝났습니다.';
  if(!r.w.length)return '무승부입니다.';
  return r.w.length===1?`${nm(r.w[0])} 승리`:`${r.w.map(nm).join(', ')} 함께 승리`;
}
function histHTML(){
  if(!seatMe()||!CS.hist.length)return '';
  return CS.hist.map(h=>`<span class="mia-h${h[1]<0?' now':''}"><i>${h[0].map(a=>a===4?'벽':DARROW[a]).join('')}</i>${h[1]<0?'·':h[1]}</span>`).join('');
}
function ctlHTML(){
  const m=myIdx(),mine=myMove(),left=CS.left[m];
  const dist=(()=>{for(let k=CS.hist.length-1;k>=0;k--)if(CS.hist[k][1]>=0)return CS.hist[k][1];return -1})();
  const btn=d=>`<button class="mia-dir d${d}" data-d="${d}" aria-label="${DNAME[d]}쪽"><i></i></button>`;
  const lamps=mine?ACTS-CS.acts:0,lp=mine?`<span class="mia-acts" aria-label="남은 행동 ${lamps}">${Array.from({length:ACTS},(_,k)=>`<i class="${k<lamps?'on':''}"></i>`).join('')}</span>`:'';
  /* 3D는 보관대를 눌러 벽을 고름. 보관대가 없는 2D만 버튼 */
  const wb=P3.on?'':`<button class="mia-wbtn${wallMode?' sel':''}${mine&&left>0?'':' off'}" data-w="1" aria-pressed="${wallMode}">벽 ${left}</button>`;
  return `<div class="mia-pad${mine?' on':''}">${mine?[0,1,2,3].map(btn).join(''):''}<div class="mia-dist" aria-label="내 탈출구까지 남은 칸"><span><b>${dist<0?'?':dist}</b>${dist<0?'':'<small>칸</small>'}</span>${lp}</div></div>${wb}`;
}
function drawHint(){if(!elHint)return;const h=hintText();if(h!==lastHint){elHint.textContent=h;lastHint=h}}
function fit(){
  if(!elRoot||elRoot.hidden)return;
  const bd=elRoot.querySelector('.mia-bd'),k=Math.min(bd.clientWidth,bd.clientHeight);
  if(k>0){elSvg.style.width=k+'px';elSvg.style.height=k+'px'}
}
function drawAll(){
  if(!CS||!elMain)return;
  if(!P3.on){const bd=boardHTML();if(bd!==lastBoard){elMain.innerHTML=bd;lastBoard=bd}}
  const top=barHTML(),mb=meBarHTML(),key=top+'\u0001'+mb;if(key!==lastBar){elBar.innerHTML=top;elBarMe.innerHTML=mb;lastBar=key;P3.lay=''}
  const hs=histHTML();if(hs!==lastHist){elHist.innerHTML=hs;lastHist=hs}
  const showCtl=V.st==='play'&&CS.ph==='move'&&seatMe()&&!isOut(myIdx())&&!introWait();
  elCtl.hidden=!showCtl;
  if(showCtl){const c=ctlHTML();if(c!==lastCtl){elCtl.innerHTML=c;lastCtl=c}if(popAt){popAt=0;const d=elCtl.querySelector('.mia-dist');if(d){d.classList.remove('pop');void d.offsetWidth;d.classList.add('pop')}}}else lastCtl='';
  drawHint();fit();
}

/* ---------- 3D: 공통 테이블 가운데 판, 벽, 깃발, 반투명 말 ---------- */
const C=.46,HB=4.5*C,LIP=.04,RW=.3,FH=HB+LIP+RW,TOP=.15,PY=TOP+.004,WH=.1,WT=.085,RK_GAP=.08,RK_D=.42,RK=RK_GAP+RK_D;   // RK: 판 밖 벽 보관대 자리
const P3={on:false,built:false,fail:false,root:null,cam:null,dirty:true,lastR:0,lay:'',layAt:0,d:12,anim:[],racks:[],rackKey:'',walls:new Map(),pieces:[],flags:[],memo:new Map(),trail:[],dice:null,revealed:false};
const ease=k=>k<=0?0:k>=1?1:k*k*(3-2*k);
const dropY=(x,h)=>x>=1?0:x<.68?h*(1-(x/.68)*(x/.68)):h*.1*Math.sin(Math.PI*(x-.68)/.32);
const gW=v=>(v-4)*C;
function woodPaint(g,w,h,base,dark,n,seed){
  let s=seed||7;const rnd=()=>{s=(s*16807)%2147483647;return s/2147483647};
  g.fillStyle=base;g.fillRect(0,0,w,h);
  for(let i=0;i<n;i++){const y0=rnd()*h,a=rnd()*.12+.04;g.strokeStyle=dark;g.globalAlpha=a;g.lineWidth=rnd()*2.5+.8;g.beginPath();
    for(let t=0;t<=w;t+=8){const y=y0+Math.sin(t/30+i)*3+Math.sin(t/11+i*3)*1.2;t?g.lineTo(t,y):g.moveTo(t,y)}g.stroke()}
  g.globalAlpha=1;
}
/* 판 윗면: 원목 틀, 칸, 좌표(안쪽 띠), 동서남북(바깥 띠) */
function drawBoardTex(g,Sz){
  const s=Sz/(2*FH),p=v=>(v+FH)*s;
  woodPaint(g,Sz,Sz,'#7a4a22','#2e170a',150,3);
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){g.fillStyle=(x+y)&1?'#c9ae80':'#dcc69c';g.fillRect(p(gW(x)-C/2),p(gW(y)-C/2),C*s,C*s)}
  g.strokeStyle='#7d6240';g.lineWidth=Math.max(2,Sz/420);
  for(let y=0;y<N;y++)for(let x=0;x<N;x++)g.strokeRect(p(gW(x)-C/2),p(gW(y)-C/2),C*s,C*s);
  g.fillStyle='rgba(255,236,196,.9)';g.textAlign='center';g.textBaseline='middle';g.font=`700 ${Math.round(.125*s)}px "IBM Plex Mono",monospace`;
  const lab=HB+LIP+.08,far=HB+LIP+.225;
  for(let k=0;k<N;k++){g.fillText('ABCDEFGHI'[k],p(gW(k)),p(lab));g.fillText(String(N-k),p(-lab),p(gW(k)))}
  g.fillStyle='#ffe9b8';g.font=`800 ${Math.round(.135*s)}px "Noto Sans KR",sans-serif`;
  g.fillText('북',p(0),p(-far));g.fillText('남',p(0),p(far));g.fillText('서',p(-far),p(0));g.fillText('동',p(far),p(0));
}
const GEO={},MAT={};
const INK=()=>MAT.ink||(MAT.ink=new THREE.MeshBasicMaterial({color:GFX_INK,side:THREE.BackSide}));
const edgeXZ=e=>{const c=e>>1,x=gW(CX(c)),z=gW(CY(c));return e&1?[x,z+C/2]:[x+C/2,z]};
const wallMat=()=>MAT.wall||(MAT.wall=toon({map:canvasTex(128,32,(c,w,h)=>woodPaint(c,w,h,'#4a2a14','#1c0d05',24,9)),rim:.15}));
function wallMesh(e,ghost){
  const along=!(e&1),L=C*.97,g=new THREE.Group();
  const geoB=GEO.wb||(GEO.wb=new THREE.BoxGeometry(L,WH,WT)),geoI=GEO.wi||(GEO.wi=new THREE.BoxGeometry(L+.025,WH+.025,WT+.025));
  const body=new THREE.Mesh(geoB,ghost||wallMat());
  body.position.y=WH/2;if(along)body.rotation.y=Math.PI/2;body.castShadow=!ghost;g.add(body);
  if(!ghost){const o=new THREE.Mesh(geoI,INK());o.position.y=WH/2;if(along)o.rotation.y=Math.PI/2;g.add(o)}
  const [x,z]=edgeXZ(e);g.position.set(x,PY,z);return g;
}
/* 탈출구 코인: 판에 놓인 납작한 자리 색 코인. 윗면에 열린 문과 화살표 */
function drawExit(c,w,hex){
  const u=w/64,L=(pts,lw)=>{c.lineWidth=lw*u;c.beginPath();pts.forEach(([x,y],k)=>k?c.lineTo(x*u,y*u):c.moveTo(x*u,y*u));c.stroke()};
  c.fillStyle=hex;c.fillRect(0,0,w,w);
  c.strokeStyle='rgba(255,240,205,.85)';c.lineWidth=3*u;c.beginPath();c.arc(32*u,32*u,28*u,0,7);c.stroke();
  c.fillStyle='#2a1a0e';c.fillRect(39*u,13*u,15*u,38*u);                 // 문
  c.strokeStyle='#fff3d0';c.lineCap='round';c.lineJoin='round';
  L([[39,51],[39,13],[54,13],[54,51]],3);
  c.fillStyle='#fff3d0';c.beginPath();c.arc(30*u,16*u,4.6*u,0,7);c.fill();   // 달리는 사람: 머리
  L([[27,24],[23,36]],6.5);                                              // 몸통
  L([[27,25],[34,30],[39,26]],4);L([[27,25],[19,28],[16,34]],4);         // 팔
  L([[23,37],[31,41],[30,50]],4.5);L([[23,37],[19,45],[11,47]],4.5);     // 다리
}
function flagMesh(i){
  const g=new THREE.Group(),hex=SEAT_C[i],geo_=GEO.coin||(GEO.coin=new THREE.CylinderGeometry(.2,.205,.055,40));
  const side=toon({color:new THREE.Color(hex).getHex(),rim:.2}),top=toon({map:canvasTex(128,128,(c,w)=>drawExit(c,w,hex)),rim:.05});
  const m=new THREE.Mesh(geo_,[side,top,side]);m.position.y=.0275;m.rotation.y=Math.PI/2;m.castShadow=true;g.add(m);
  const ink=new THREE.Mesh(GEO.coinI||(GEO.coinI=new THREE.CylinderGeometry(.215,.22,.06,40)),INK());ink.position.y=.03;g.add(ink);
  return g;
}
function pieceMesh(i){
  const g=new THREE.Group(),m=toon({color:new THREE.Color(SEAT_C[i]).getHex(),rim:.2});m.transparent=true;m.opacity=.55;m.depthWrite=false;
  const b=new THREE.Mesh(GEO.pb||(GEO.pb=new THREE.CylinderGeometry(.11,.15,.1,24)),m);b.position.y=.05;b.renderOrder=5;g.add(b);
  const h=new THREE.Mesh(GEO.ph||(GEO.ph=new THREE.SphereGeometry(.09,20,14)),m);h.position.y=.17;h.renderOrder=6;g.add(h);
  g.userData.mat=m;return g;
}
function memoTex(k){
  return MAT['m'+k]||(MAT['m'+k]=new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,map:canvasTex(64,64,(c,w,h)=>{c.clearRect(0,0,w,h);c.strokeStyle=c.fillStyle='#46321e';c.lineWidth=7;c.lineCap='round';if(k===1){c.beginPath();c.moveTo(20,20);c.lineTo(44,44);c.moveTo(44,20);c.lineTo(20,44);c.stroke()}else{c.beginPath();c.arc(32,32,11,0,7);c.fill()}})}));
}
/* 대기실 홀로그램의 대표 말: 탈출구 코인과 흐린 말, 그 사이 벽 하나 */
G.holoPiece=mkM=>{
  const g=new THREE.Group();
  const cn=new THREE.Mesh(new THREE.CylinderGeometry(.24,.24,.05,28),mkM(new THREE.Color(SEAT_C[0]).getHex()));cn.rotation.x=Math.PI/2;cn.position.set(.24,.02,0);g.add(cn);
  const dr=new THREE.Mesh(new THREE.BoxGeometry(.13,.24,.02),mkM(0xf2e6c4));dr.position.set(.24,.02,.04);g.add(dr);
  const w=new THREE.Mesh(new THREE.BoxGeometry(.05,.34,.3),mkM(0x9a6a3a));w.position.set(-.04,-.14,0);g.add(w);
  const b=new THREE.Mesh(new THREE.SphereGeometry(.09,16,12),mkM(new THREE.Color(SEAT_C[1]).getHex()));b.position.set(-.26,-.02,0);g.add(b);
  const p=new THREE.Mesh(new THREE.CylinderGeometry(.07,.12,.2,16),mkM(new THREE.Color(SEAT_C[1]).getHex()));p.position.set(-.26,-.2,0);g.add(p);
  g.rotation.set(-.2,.45,.05);return g;
};
/* 10면체(오각 사다리꼴면체): 위 꼭짓점·아래 꼭짓점과 가운데 고리 10점으로 된 연 모양 면 10개. 면마다 숫자 0~9 */
const DIE_R=.3,DIE_H=.33,DIE_E=DIE_H*(1-Math.cos(Math.PI/5))/(1+Math.cos(Math.PI/5));
const DIE_NUM=[0,4,8,2,6,9,5,1,7,3];   // 면 순서: 위 다섯, 아래 다섯
function dieData(){
  if(GEO.d10)return GEO.d10;
  const V=(x,y,z)=>new THREE.Vector3(x,y,z),ring=[];
  for(let k=0;k<10;k++){const a=k*Math.PI/5;ring.push(V(Math.cos(a)*DIE_R,k&1?-DIE_E:DIE_E,Math.sin(a)*DIE_R))}
  const T_=V(0,DIE_H,0),B_=V(0,-DIE_H,0),pos=[],nor=[],uv=[],face={};
  const kite=(apex,a,b,c,num)=>{
    const ctr=apex.clone().add(a).add(b).add(c).multiplyScalar(.25);
    let n=b.clone().sub(apex).cross(a.clone().sub(c)).normalize();if(n.dot(ctr)<0)n.negate();
    const up=apex.clone().sub(b).normalize(),side=up.clone().cross(n).normalize();
    const col=num%5,row=(num/5)|0;
    const put=p=>{const d=p.clone().sub(ctr);return [(col+.5)/5+d.dot(side)*.5,1-(row+.5)/2+d.dot(up)*1.1]};
    const tri=(p,q,r)=>{
      const f=q.clone().sub(p).cross(r.clone().sub(p)).dot(n)>0?[p,q,r]:[p,r,q];
      for(const v of f){pos.push(v.x,v.y,v.z);nor.push(n.x,n.y,n.z);uv.push(...put(v))}
    };
    tri(apex,a,b);tri(apex,b,c);
    face[num]={n,up};
  };
  for(let k=0;k<5;k++)kite(T_,ring[k*2],ring[k*2+1],ring[(k*2+2)%10],DIE_NUM[k]);
  for(let k=0;k<5;k++)kite(B_,ring[k*2+1],ring[(k*2+2)%10],ring[(k*2+3)%10],DIE_NUM[k+5]);
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  /* 그 숫자 면이 위로, 글자 머리가 화면 위쪽으로 오는 자세 */
  const rest={},Yv=V(0,1,0);
  for(const k of Object.keys(face)){
    const q1=new THREE.Quaternion().setFromUnitVectors(face[k].n,Yv),u=face[k].up.clone().applyQuaternion(q1);
    rest[k]=new THREE.Quaternion().setFromAxisAngle(Yv,Math.atan2(u.x,-u.z)).multiply(q1);
  }
  return GEO.d10={g,rest};
}
function dieMat(i){
  const k='d'+i;if(MAT[k])return MAT[k];
  return MAT[k]=toon({rim:.2,map:canvasTex(640,256,(c,w,h)=>{
    c.fillStyle=SEAT_C[i];c.fillRect(0,0,w,h);
    c.textAlign='center';c.textBaseline='middle';c.font='800 92px "IBM Plex Mono",monospace';
    for(let n=0;n<10;n++){const x=(n%5+.5)*w/5,y=(((n/5)|0)+.5)*h/2;c.lineWidth=9;c.strokeStyle='rgba(30,16,8,.75)';c.strokeText(n,x,y+4);c.fillStyle='#fff6d8';c.fillText(n,x,y+4);
      if(n===6||n===9){c.fillRect(x-22,y+42,44,7)}}
  })});
}
function dieMesh(){const m=new THREE.Mesh(dieData().g,dieMat(0));return m}
function d3Build(){
  if(P3.built||P3.fail)return P3.built;
  if(!T.ok||typeof THREE==='undefined'){P3.fail=true;return false}
  try{
    const root=new THREE.Group();root.visible=false;
    const bg=new THREE.Group();root.add(bg);P3.boardG=bg;
    const frame=new THREE.Mesh(new THREE.BoxGeometry(2*FH,TOP-.02,2*FH),toon({map:canvasTex(512,512,(g,w,h)=>woodPaint(g,w,h,'#7a4a22','#2e170a',110,3)),rim:.08}));frame.position.y=.02+(TOP-.02)/2;frame.castShadow=frame.receiveShadow=true;bg.add(frame);
    const fo=new THREE.Mesh(new THREE.BoxGeometry(2*FH+.05,TOP,2*FH+.05),INK());fo.position.copy(frame.position);bg.add(fo);
    const top=new THREE.Mesh(new THREE.PlaneGeometry(2*FH-.02,2*FH-.02),toon({map:canvasTex(1024,1024,(g,w)=>drawBoardTex(g,w)),rim:0}));top.rotation.x=-Math.PI/2;top.position.y=TOP+.002;top.receiveShadow=true;bg.add(top);
    P3.wg=new THREE.Group();root.add(P3.wg);P3.fg=new THREE.Group();root.add(P3.fg);P3.pg=new THREE.Group();root.add(P3.pg);P3.mg=new THREE.Group();root.add(P3.mg);P3.tg=new THREE.Group();root.add(P3.tg);
    for(let i=0;i<4;i++){const f=flagMesh(i);f.visible=false;P3.fg.add(f);P3.flags.push(f);const p=pieceMesh(i);p.visible=false;P3.pg.add(p);P3.pieces.push(p)}
    const pick=new THREE.Mesh(new THREE.CircleGeometry(.16,24),new THREE.MeshBasicMaterial({transparent:true,opacity:.6,depthWrite:false}));pick.rotation.x=-Math.PI/2;pick.position.y=PY+.01;pick.visible=false;pick.renderOrder=4;root.add(pick);P3.pick=pick;
    P3.ghostOK=wallMesh(0,new THREE.MeshBasicMaterial({color:0x4f9d3f,transparent:true,opacity:.7,depthWrite:false}));P3.ghostOK.visible=false;root.add(P3.ghostOK);
    P3.ghostOK2=wallMesh(1,new THREE.MeshBasicMaterial({color:0x4f9d3f,transparent:true,opacity:.7,depthWrite:false}));P3.ghostOK2.visible=false;root.add(P3.ghostOK2);
    P3.ghostNo=wallMesh(0,new THREE.MeshBasicMaterial({color:0xd6342a,transparent:true,opacity:.8,depthWrite:false}));P3.ghostNo.visible=false;root.add(P3.ghostNo);
    P3.ghostNo2=wallMesh(1,new THREE.MeshBasicMaterial({color:0xd6342a,transparent:true,opacity:.8,depthWrite:false}));P3.ghostNo2.visible=false;root.add(P3.ghostNo2);
    P3.cam=new THREE.PerspectiveCamera(34,1,.1,100);
    T.scene.add(root);P3.root=root;P3.built=true;
  }catch(e){P3.fail=true;try{console.warn('미아 3D 준비 실패',e)}catch(_){}}
  return P3.built;
}
/* 벽 보관대: 각자 앞(나는 아래, 나머지는 시계 방향으로 왼쪽·위·오른쪽)에 벽을 세워 둠 */
const rackSlot=(i,cnt,base)=>{const r=(i-base+cnt)%cnt;return cnt===2?[0,2][r]:cnt===3?[0,1,3][r]:r};   // 0 아래 1 왼쪽 2 위 3 오른쪽
function rackBuild(cnt,wn,base){
  const key=[cnt,wn,base].join();if(P3.rackKey===key)return;P3.rackKey=key;
  for(const r of P3.racks)P3.boardG.remove(r.g);P3.racks=[];
  const L=2*FH,sp=wn?Math.min(.3,(L-.16)/wn):.2,th=Math.min(.085,sp*.62),len=RK_D*.78,h=.13;
  const wood=MAT.rack||(MAT.rack=toon({map:canvasTex(256,64,(c,w,hh)=>woodPaint(c,w,hh,'#b98a55','#6a4524',40,4)),rim:.1}));
  const geoB=new THREE.BoxGeometry(th,h,len);
  for(let i=0;i<cnt;i++){
    const slot=rackSlot(i,cnt,base),g=new THREE.Group();
    const b=new THREE.Mesh(new THREE.BoxGeometry(L,TOP-.02,RK_D),wood);b.position.y=.02+(TOP-.02)/2;b.castShadow=b.receiveShadow=true;g.add(b);
    const ink=new THREE.Mesh(new THREE.BoxGeometry(L+.04,TOP,RK_D+.04),INK());ink.position.y=b.position.y;g.add(ink);
    const st=new THREE.Mesh(new THREE.PlaneGeometry(L-.02,.04),new THREE.MeshBasicMaterial({color:SEAT_C[i]}));st.rotation.x=-Math.PI/2;st.position.set(0,TOP+.003,RK_D/2-.03);g.add(st);
    const walls=[];
    for(let k=0;k<wn;k++){
      const m=new THREE.Mesh(geoB,MAT.wall||wallMat());m.position.set(-sp*(wn-1)/2+sp*k,TOP+h/2-.01,-.02);m.castShadow=true;g.add(m);walls.push(m);
    }
    const d=FH+RK_GAP+RK_D/2;
    if(slot===0)g.position.z=d;else if(slot===2){g.position.z=-d;g.rotation.y=Math.PI}else if(slot===1){g.position.x=-d;g.rotation.y=-Math.PI/2}else{g.position.x=d;g.rotation.y=Math.PI/2}
    P3.boardG.add(g);P3.racks[i]={g,walls,h};
  }
}
function rackSync(){
  if(!CS||CS.wn==null)return;
  const m=myIdx(),s=seatMe();
  rackBuild(CS.cnt,CS.wn,s?m:0);
  P3.racks.forEach((r,i)=>{
    const left=CS.left[i],out=isOut(i);
    r.walls.forEach((w,k)=>{w.visible=!out&&k<left;w.position.y=TOP+r.h/2-.01+(i===m&&k===left-1?(wallMode?.12:myMove()?.04:0):0)});
  });
}
/* 보관대에서 벽이 날아가는 출발점 */
function rackFrom(i){
  const r=P3.racks[i];if(!r||!r.walls.length)return null;
  const w=r.walls[Math.min(r.walls.length-1,CS.left[i])],v=w.getWorldPosition(new THREE.Vector3());return [v.x,v.z];
}
function clearBoard(){
  for(const m of P3.walls.values())P3.wg.remove(m);P3.walls.clear();
  P3.pieces.forEach(p=>{p.visible=false;p.userData.c=-1;p.userData.mat.opacity=.55});
  P3.flags.forEach(f=>{f.visible=false;f.userData.dropped=false});
  for(const m of P3.trail)P3.tg.remove(m);P3.trail=[];P3.revealed=false;P3.anim=[];
  if(P3.dice){P3.root.remove(P3.dice.g);P3.dice=null}
}
const pieceSpot=(i,c)=>{
  /* 같은 칸의 말은 살짝 비켜 놓음 */
  const same=[];CS.pos.forEach((v,k)=>{if(v===c)same.push(k)});
  if(same.length<2)return [gW(CX(c)),gW(CY(c))];
  const a=same.indexOf(i)/same.length*Math.PI*2,r=.1;return [gW(CX(c))+Math.cos(a)*r,gW(CY(c))+Math.sin(a)*r];
};
function d3Sync(){
  if(!P3.on||!V||!V.mia||!CS)return;
  const now=clock();
  if(CS.n===0&&CS.ph==='place'&&(P3.walls.size||P3.revealed||P3.gameKey!==V.di))clearBoard();
  P3.gameKey=V.di;
  /* 벽 */
  rackSync();
  const has=new Set(CS.ws);
  for(const [e,m] of P3.walls)if(!has.has(e)){P3.wg.remove(m);P3.walls.delete(e)}
  for(const e of CS.ws){if(P3.walls.has(e))continue;const m=wallMesh(e);P3.wg.add(m);P3.walls.set(e,m);if(CS.lm&&CS.lm.e===e){const f=rackFrom(CS.lm.s),[tx,tz]=edgeXZ(e);if(f){m.position.set(f[0],PY,f[1]);P3.anim.push({obj:m,t0:now,dur:420,from:f,to:[tx,tz],h:.55})}else P3.anim.push({obj:m,t0:now,dur:300,drop:.8})}}
  /* 말: 받은 자리만 그림 (내 말은 끝날 때까지 안 옴) */
  CS.pos.forEach((c,i)=>{
    const g=P3.pieces[i],seen=c>=0&&!(CS.ph==='place');
    if(!seen){g.visible=false;g.userData.c=-1;return}
    const [x,z]=pieceSpot(i,c);
    if(g.userData.c===c||g.userData.c==null||g.userData.c<0){if(g.userData.c!==c){g.position.set(x,PY,z);g.userData.c=c;g.visible=true;P3.anim.push({obj:g,t0:now,dur:300,drop:.7})}else{g.position.x=x;g.position.z=z}return}
    P3.anim.push({obj:g,t0:now,dur:MOVE_MS,from:[g.position.x,g.position.z],to:[x,z]});g.userData.c=c;
  });
  /* 깃발 */
  CS.flag.forEach((c,i)=>{const f=P3.flags[i];if(c<0||isOut(i)){f.visible=false;return}
    const same=[];CS.flag.forEach((v,k)=>{if(v===c&&!isOut(k))same.push(k)});
    const a=same.length>1?same.indexOf(i)/same.length*Math.PI*2+.8:0,r=same.length>1?.1:0;f.scale.setScalar(same.length>1?.72:1);
    f.position.set(gW(CX(c))+Math.cos(a)*r,PY,gW(CY(c))+Math.sin(a)*r)});
  /* 끝: 내 말 공개, 지나온 길 */
  if(V.st==='over'&&CS.path&&!P3.revealed){
    P3.revealed=true;
    CS.path.forEach((p,i)=>{P3.pieces[i].userData.mat.opacity=.92;
      const mat=new THREE.MeshBasicMaterial({color:SEAT_C[i],transparent:true,opacity:.62,depthWrite:false});
      for(let k=1;k<p.length;k++){const a=p[k-1],b=p[k];if(a===b)continue;const ax=gW(CX(a)),az=gW(CY(a)),bx=gW(CX(b)),bz=gW(CY(b)),L=Math.hypot(bx-ax,bz-az)+.05;
        const s=new THREE.Mesh(GEO.seg||(GEO.seg=new THREE.PlaneGeometry(1,1)),mat);s.scale.set(L,.05,1);s.rotation.set(-Math.PI/2,0,-Math.atan2(bz-az,bx-ax));s.position.set((ax+bx)/2,PY+.014+i*.001,(az+bz)/2);s.renderOrder=4;s.visible=false;P3.tg.add(s);P3.trail.push(s);P3.anim.push({obj:s,t0:now+250+k*70,dur:1,show:1,seg:1})}
    });
  }
  d3Marks();P3.dirty=true;
}
function d3Marks(){
  if(!P3.on||!V||!V.mia||!CS)return;
  /* 메모 */
  for(const [c,m] of P3.memo){if(!memo[c]||m.userData.k!==memo[c]){P3.mg.remove(m);P3.memo.delete(c)}}
  for(const c of Object.keys(memo)){const i=+c;if(P3.memo.has(c))continue;const m=new THREE.Mesh(GEO.pl||(GEO.pl=new THREE.PlaneGeometry(C*.9,C*.9)),memoTex(memo[c]));m.rotation.x=-Math.PI/2;m.position.set(gW(CX(i)),PY+.064,gW(CY(i)));m.renderOrder=7;m.userData.k=memo[c];P3.mg.add(m);P3.memo.set(c,m)}
  rackSync();
  const cell=pend&&pend.k==='cell'?pend.c:-1;
  P3.pick.visible=cell>=0;if(cell>=0){P3.pick.position.x=gW(CX(cell));P3.pick.position.z=gW(CY(cell));P3.pick.material.color.set(SEAT_C[(myIdx()+1)%CS.cnt])}
  const show=(a,b,e)=>{a.visible=b.visible=false;if(e==null||e<0||!validEdge(e))return;const m=e&1?b:a,[x,z]=edgeXZ(e);m.position.set(x,PY,z);m.visible=true};
  show(P3.ghostOK,P3.ghostOK2,pend&&pend.k==='wall'?pend.e:-1);
  show(P3.ghostNo,P3.ghostNo2,flash>=0&&clock()-flashAt<700?flash:-1);
  P3.dirty=true;
}
function tvBox(r){
  const Wd=r.clientWidth,Hh=r.clientHeight;r.classList.toggle('wide',Wd>Hh||(Wd>=700&&!!(CS&&CS.cnt<=2)));
  const narrow=Wd<700,bar=r.querySelector('.mia-bar'),mb=r.querySelector('.mia-mebar'),gap=10;
  const low=narrow&&Hh>Wd?PAD_H:14;
  const R=Math.max(bar.offsetTop+bar.offsetHeight+gap,low+(mb.offsetHeight||26)+gap),m=narrow?8:16;
  return {fw:Wd-2*m,fh:Hh-2*R,cy:Hh/2,R};
}
const PAD_H=146;   // 휴대폰 세로: 판 아래에 방향 단추 자리
const CHIP_GAP=10;
function chipsAt(topY,botY){
  const r=elRoot,bar=r.querySelector('.mia-bar'),mb=r.querySelector('.mia-mebar');if(!bar||!mb)return;
  const Hh=r.clientHeight,lim=Hh-14-(mb.offsetHeight||34);
  r.style.setProperty('--bs',Math.max(bar.offsetHeight,Math.round(topY-CHIP_GAP-bar.offsetTop))+'px');
  r.style.setProperty('--mt',Math.round(Math.min(botY+CHIP_GAP,lim))+'px');
  r.classList.add('lay');
}
function d3Layout(t){
  if(t-P3.layAt<100&&P3.lay)return false;
  P3.layAt=t;
  const st=$('#stage'),Wd=st.clientWidth,Hh=st.clientHeight;if(!Wd||!Hh||!V||!V.mia)return false;
  const B=tvBox(elRoot),key=[Wd,Hh,B.R].join(',');
  if(key===P3.lay)return false;
  P3.lay=key;
  const s=Math.min(B.fw/(2*(FH+.03)),B.fh/(2*(FH+RK+.03))),cam=P3.cam,f=Math.tan(cam.fov*Math.PI/360),d=(Hh/2)/(s*f);
  cam.aspect=Wd/Hh;cam.clearViewOffset();cam.position.set(0,PY+d,0);cam.lookAt(0,PY,0);cam.updateProjectionMatrix();cam.updateMatrixWorld();
  chipsAt(B.cy-(FH+RK)*s,B.cy+(FH+RK)*s);
  P3.d=d;P3.dirty=true;
  return true;
}
function d3Step(now){
  let busy=false;
  P3.anim=P3.anim.filter(a=>{
    const k=(now-a.t0)/a.dur;busy=true;if(k<0)return true;
    const o=a.obj,e=Math.min(1,k);
    if(a.show)o.visible=true;
    if(a.seg)return false;
    if(a.drop!=null)o.position.y=PY+dropY(e,a.drop);
    else if(a.from){const q=ease(e);o.position.x=a.from[0]+(a.to[0]-a.from[0])*q;o.position.z=a.from[1]+(a.to[1]-a.from[1])*q;o.position.y=PY+Math.sin(Math.PI*e)*(a.h||.12)}
    if(k>=1){if(a.drop!=null||a.from)o.position.y=PY;return false}
    return true;
  });
  return busy;
}
/* 깃발 주사위: 사람마다 차례로 10면체 둘이 구르고 숫자가 뜬 뒤 깃발이 판에 떨어짐 */
function rollStep(now){
  if(!CS||CS.ph!=='roll'||!CS.roll||!rollT0){
    if(P3.dice){P3.root.remove(P3.dice.g);P3.dice=null}
    P3.flags.forEach((f,i)=>{f.visible=!!CS&&CS.flag[i]>=0&&!isOut(i)&&(!CS||CS.ph!=='place');if(f.visible)f.position.y=PY});
    return false;
  }
  if(!P3.dice){
    const g=new THREE.Group(),a=dieMesh(),b=dieMesh();P3.root.add(g);g.add(a);g.add(b);P3.dice={g,a,b,seat:-1,q:new THREE.Quaternion(),ax:new THREE.Vector3(.6,.5,.62).normalize(),bx:new THREE.Vector3(-.5,.7,.5).normalize()};
  }
  const Dc=P3.dice,e=now-rollT0,i=Math.min(CS.cnt-1,Math.floor(e/ROLL_EACH)),l=e-i*ROLL_EACH,D10=dieData();
  if(Dc.seat!==i){
    Dc.seat=i;Dc.a.material=Dc.b.material=dieMat(i);
    if(!isOut(i))for(let k=0;k<4;k++)sndDice(k*.13);
  }
  const has=!!CS.roll[i]&&!isOut(i);Dc.g.visible=has&&e<CS.cnt*ROLL_EACH;
  const tm=700,q=Math.min(1,l/tm),y=TOP+.29+Math.abs(Math.sin(q*Math.PI*2.5))*(1-q)*.8,spin=(1-q)*(1-q)*15;
  Dc.a.position.set(-.38-(1-q)*.5,y,-(1-q)*.4);Dc.b.position.set(.38+(1-q)*.5,y,(1-q)*.3);
  if(has){
    Dc.a.quaternion.setFromAxisAngle(Dc.ax,spin).multiply(D10.rest[CS.roll[i][0]]);
    Dc.b.quaternion.setFromAxisAngle(Dc.bx,-spin).multiply(D10.rest[CS.roll[i][1]]);
  }
  P3.flags.forEach((f,k)=>{
    const c=CS.flag[k];if(c<0||isOut(k)){f.visible=false;return}
    const t0=rollT0+(k+1)*ROLL_EACH-420,x=(now-t0)/320;
    f.visible=x>0;f.position.y=PY+dropY(Math.max(0,Math.min(1,x)),.8);
    if(x>=.68&&!f.userData.dropped){f.userData.dropped=true;sndWall(0)}
  });
  return true;
}
function d3Render(t){
  if(!P3.on||!T.ok)return;
  if(d3Layout(t))P3.dirty=true;
  const busy=d3Step(t),rl=rollStep(t),intro=IN.on3d&&introStep(t),fl=flash>=0&&t-flashAt<760;
  if(flash>=0&&!fl){flash=-1;d3Marks()}
  if(!busy&&!rl&&!intro&&!fl&&!P3.dirty&&t-P3.lastR<400)return;
  P3.dirty=false;P3.lastR=t;
  const fog=T.scene.fog,fn=fog?fog.near:0,ff=fog?fog.far:0;
  if(fog){fog.near=P3.d+5;fog.far=P3.d+30}
  for(const m of [T.timerBg,T.timerArc,T.ring])if(m)m.visible=false;
  let cam=P3.cam;
  {const k=intro&&IN.fromLobby?ease((t-IN.t0)/INTRO.cam):1;
   if(k<1){
     const ic=P3.icam||(P3.icam=new THREE.PerspectiveCamera());
     ic.position.copy(T.cam.position).lerp(P3.cam.position,k);ic.quaternion.copy(T.cam.quaternion).slerp(P3.cam.quaternion,k);
     const a=T.cam.projectionMatrix.elements,b=P3.cam.projectionMatrix.elements,m=ic.projectionMatrix.elements;
     for(let j=0;j<16;j++)m[j]=a[j]+(b[j]-a[j])*k;
     ic.projectionMatrixInverse.copy(ic.projectionMatrix).invert();ic.updateMatrixWorld();
     if(fog){fog.near=fn+(fog.near-fn)*k;fog.far=ff+(fog.far-ff)*k}
     cam=ic;
   }}
  T.r.render(T.scene,cam);
  if(fog){fog.near=fn;fog.far=ff}
}
/* ---------- 시작 연출 (방장이 그동안 시간·봇을 멈춤, 길이 G.introMs) ----------
   0~1.1초 로비 카메라 → 바로 위 카메라, 판이 내려앉음 → 첫 차례 주사위. 바로 시작은 판을 두고 주사위 없이 알림 */
const INTRO={cam:1100,ui:650,board:[100,400],dice:1100};
const AGAIN={dice:320};
const DIE=.56;
G.introMs=(again,rolls)=>Math.round((again?AGAIN.dice:INTRO.dice)+DicePick.totalFor(again?-1:rolls)+100);
const IN={on:false,on3d:false,t0:0,total:0,r:0,again:false,fromLobby:true,said:false,fp:null,die:null,snd:{}};
const introOn=()=>IN.on&&clock()<IN.t0+IN.total;
const introWait=()=>introOn()&&!IN.said;
G.intro=(t0,o)=>{
  if(!V||!V.mia||!V.ps)return;
  IN.again=!!(o&&o.again)&&P3.on;
  const rolls=IN.again?-1:o&&o.rolls,seed=(o&&o.seed)||1,cnt=V.mia.cnt;
  IN.on=true;IN.t0=t0;IN.said=false;IN.snd={};IN.fromLobby=!P3.on;IN.on3d=true;
  IN.r=IN.again?AGAIN.dice:INTRO.dice;IN.total=(o&&o.total)||G.introMs(IN.again,rolls);
  if(IN.die){IN.die.dispose();IN.die=null}
  IN.fp=firstPick(t0+IN.r,{seats:Array.from({length:cnt},(_,k)=>k),first:V.mia.A,rolls,seed});
  $('#stage').classList.add('mia-intro');if(elRoot&&IN.fromLobby)elRoot.classList.add('intro');
  lastBar='';P3.dirty=true;
};
function introStep(now,force){
  if(!P3.built||!V||!V.mia||!CS)return false;
  const e=now-IN.t0,done=force||e>=IN.total,fl=IN.fromLobby;
  if(done)IN.on3d=false;
  {const x=done||!fl?1:(e-INTRO.board[0])/INTRO.board[1];P3.boardG.visible=x>0;P3.boardG.position.y=dropY(Math.max(0,x),1.6)}
  if(IN.fp&&!IN.fp.fixed){
    if(!IN.die&&!done&&P3.root){IN.die=DicePick.mesh(THREE,CS.cnt,SEAT_C.slice(0,CS.cnt));P3.root.add(IN.die.g)}
    if(IN.die)IN.die.apply(done||e<IN.r?null:IN.fp.pose(now),DIE,0,TOP+.25,0);
  }
  if(done&&IN.die){IN.die.dispose();IN.die=null}
  return true;
}
function introEnd(){
  if(IN.on3d)introStep(clock(),true);
  if(IN.die){IN.die.dispose();IN.die=null}
  IN.on=false;IN.on3d=false;IN.said=true;
  $('#stage').classList.remove('mia-intro');if(elRoot)elRoot.classList.remove('intro');
}
function introTick(){
  if(!IN.on)return;
  const e=clock()-IN.t0,S_=IN.snd,once=(k,f)=>{if(!S_[k]){S_[k]=1;f()}};
  if(e>=INTRO.ui&&elRoot&&elRoot.classList.contains('intro'))elRoot.classList.remove('intro');
  if(IN.on3d&&P3.on&&CS&&IN.fromLobby&&e>=INTRO.board[0]+INTRO.board[1]*.68)once('thud',()=>{tone(120,.13,{type:'triangle',vol:.2});hiss(.09,{freq:650,vol:.12})});
  if(IN.fp&&e>=IN.r&&IN.fp.tick(IN.t0+e)){
    IN.said=true;$('#stage').classList.remove('mia-intro');if(elRoot)elRoot.classList.remove('intro');
    fxSay(IN.fp.msg(),SEAT_C[IN.fp.first]);
    lastBar='';redraw();
  }
  if(e>=IN.total){IN.on=false;lastBar='';lastHint='';G.buttons();if(P3.on)d3Marks()}
  drawAll();
}
/* 3D 화면에서 누른 곳 → 판 좌표 (칸 하나 = 1, 0~9가 판 안) */
function gridAt(e){
  const r=T.r.domElement.getBoundingClientRect();if(!r.width||!P3.cam)return null;
  const ray=P3.ray||(P3.ray=new THREE.Raycaster());
  ray.setFromCamera({x:(e.clientX-r.left)/r.width*2-1,y:-(e.clientY-r.top)/r.height*2+1},P3.cam);
  const o=ray.ray.origin,dv=ray.ray.direction;if(Math.abs(dv.y)<1e-6)return null;
  const k=(TOP-o.y)/dv.y;return {x:(o.x+dv.x*k)/C+4.5,y:(o.z+dv.z*k)/C+4.5};
}
function d3Click(e){
  if(!P3.on||G!==GAMES.mia||V.cfg.game!=='mia')return;
  const g=gridAt(e);if(!g)return;
  if(seatMe()&&Math.abs(g.x-4.5)<FH/C&&g.y>4.5+(FH+RK_GAP-.04)/C&&g.y<4.5+(FH+RK+.04)/C){toggleWall();return}
  tapAt(g.x,g.y);
}
/* 새 상태를 받았을 때 */
G.preView=()=>{
  if(!V.mia){CS=null;return}
  const pv=PV&&PV.mia;
  CS={...V.mia};
  const key=CS.A+':'+(V.di||0)+':'+CS.flag.join(',');
  if(CS.ph!=='place'&&key!==memoKey){memoKey=key;loadMemo()}
  if(CS.ph==='place'&&CS.n===0&&(!pv||pv.ph!=='place')){memo={};memoKey=''}
  if(CS.ph==='roll'&&(!pv||pv.ph!=='roll'))rollT0=clock()-(rollMs(CS.cnt)-(CS.ra||0));
  if(CS.ph!=='roll')rollT0=0;
  if(!pv||PV.st!==V.st||pv.n!==CS.n||pv.ph!==CS.ph||pv.A!==CS.A){pend=null;if(!pv||pv.ph!==CS.ph||CS.ph!=='move'||!myMoveNow())wallMode=false}
  if(pv&&CS.rn>pv.rn)popAt=clock();
  if(V.st!=='play'){pend=null;wallMode=false}
};
const myMoveNow=()=>V&&V.st==='play'&&myIdx()===V.t;
G.postView=()=>{};
G.overExtra=()=>'';
G.logCue=()=>false;
G.overDelay=()=>1900;
G.cues=(v,pv)=>{
  if(!v.mia||!pv.mia)return;
  if(v.mia.n>pv.mia.n){const w=v.mia.ws.length>pv.mia.ws.length;if(w)sndWall(0);else sndStep(0)}
  if(v.mia.rn>pv.mia.rn)sndRound(.28);
  if(v.st==='over'&&pv.st==='play'&&v.mia.res&&v.mia.res.w.length)sndWin(.5);
};
G.hud=inGame=>{
  if(!elRoot)return;
  const on=!!(inGame&&V&&V.mia&&CS);
  elRoot.hidden=!on;
  $('#stage').classList.toggle('mia-over',!!(on&&V.st==='over'));
  const d3=on&&d3Build();
  if(d3!==P3.on){P3.on=d3;P3.lay='';if(P3.root)P3.root.visible=d3;$('#stage').classList.toggle('mia3d',d3);lastBoard='';lastHint=''}
  $('#stage').classList.toggle('mia2d',on&&!d3);
  if(!on){lastBoard='';lastBar='';lastHint='';lastHist='';lastCtl='';return}
  drawAll();
  d3Sync();
};
G.handMarks=()=>{};
G.me=()=>{$('#numpick').hidden=true};
G.overRank=p=>{const t=p.sr===3?'탈주':p.sr?'항복':'';return t?`<span class="left">${t}</span>`:''};
G.usesDbl=true;
G.no3D=true;
G.buttons=()=>{
  const play=$('#btnPlay'),can=!!pend&&(pend.k==='cell'?pickingNow():myMove()),lb='놓기';
  play.hidden=!(pickingNow()||(wallMode&&myMove()));
  $('#btnPass').hidden=true;$('#btnGura').hidden=true;
  play.disabled=!can;play.classList.toggle('ready',can);
  if($('#playMain').textContent!==lb)$('#playMain').textContent=lb;
  const sub=keyLabel(KEYS.play);if($('#playSub').textContent!==sub)$('#playSub').textContent=sub;
};
G.live=()=>{
  if(IN.on)introTick();
  if(!V||!V.mia||!CS)return;
  const bar=elRoot&&elRoot.querySelector('.mia-p.on .tb i');
  if(bar&&V.st==='play'){const left=Math.max(0,(V.deadAt-clock())/1000);bar.style.width=Math.min(100,left/(V.cfg.turn||30)*100)+'%'}
  if(flash>=0&&!P3.on&&clock()-flashAt>720){flash=-1;lastBoard='';drawAll()}
  if(!P3.on&&CS.ph==='roll')drawAll();
};
G.play=()=>confirmPend();
G.pass=()=>{};
G.keyPhase=st=>st==='play';
G.onKey=(act,e)=>{
  const dir={bjUp:0,miaR:1,bjDown:2,miaL:3}[act];
  if(dir!=null){if(!e.repeat)tapDir(dir);return true}
  if(act==='qmode'){if(!e.repeat)toggleWall();return true}
  return false;
};
G.field3D=()=>{if(T.stacks)for(const arr of T.stacks.values())arr.forEach(c=>{c.visible=false})};
G.render3D=t=>{if(P3.on)d3Render(t);else if(T.ok&&!$('#stage').classList.contains('mia2d'))T.r.render(T.scene,T.cam)};
G.enter=()=>{
  $('#stage').classList.add('mia');
  $('#btnPass').hidden=true;$('#btnGura').hidden=true;$('#numpick').hidden=true;
  pend=null;wallMode=false;
  if(elRoot)fit();
};
G.leave=()=>{
  introEnd();
  $('#stage').classList.remove('mia','mia-over','mia3d','mia2d');
  if(T.stacks)for(const arr of T.stacks.values())arr.forEach(c=>{c.visible=true});
  if(P3.built)clearBoard();
  if(P3.root)P3.root.visible=false;P3.on=false;
  for(const m of P3.memo.values())if(P3.mg)P3.mg.remove(m);P3.memo.clear();
  $('#btnPass').hidden=false;$('#btnPlay').hidden=false;
  if(elRoot){elRoot.hidden=true;lastBoard='';lastBar='';lastHint='';lastHist='';lastCtl=''}
};
G.init=()=>{
  const css=document.createElement('style');
  css.textContent=`
.stage.mia{background:radial-gradient(ellipse at 50% 38%,#f3e4c2 0%,#e2c89a 70%,#d3b27c 100%)}
.stage.mia.mia2d #cv,.stage.mia #dim{visibility:hidden}
.stage.mia3d #cv{touch-action:manipulation}
.stage.mia-intro .actions,.stage.mia-intro .myplate,.stage.mia-intro #mia .mia-row{opacity:0;pointer-events:none}
.stage.mia .actions,.stage.mia .myplate,#mia .mia-row,#mia .mia-bar,#mia .mia-mebar{transition:opacity .35s}
#mia.intro .mia-bar,#mia.intro .mia-mebar{opacity:0}
.stage.mia3d #mia svg.mia-board{display:none}
.stage.mia .labels{visibility:hidden}
.stage.mia .nogl{display:none}
.stage.mia.mia-over .myplate,.stage.mia.mia-over .actions{display:none}
.specbar:not([hidden])~#mia .mia-bar{margin-top:30px}
.stage.mia .actions{left:auto}
.stage.mia .myplate{max-width:calc(100% - 150px)}
#mia{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;gap:6px;padding:8px 10px 82px;pointer-events:none;min-height:0}
#mia[hidden]{display:none}
#mia .mia-bar{min-height:44px;display:flex;flex-wrap:wrap;justify-content:center;align-items:flex-start;align-content:flex-end;gap:6px;align-self:center;max-width:calc(100% - 188px);pointer-events:none}
#mia .mia-mebar{position:absolute;left:50%;bottom:var(--plateB,14px);transform:translateX(-50%);z-index:2;display:flex;pointer-events:none;max-width:calc(100% - 188px)}
#mia .mia-mebar:empty{display:none}
#mia .mia-p{position:relative;display:flex;align-items:center;gap:6px;padding:4px 10px 6px;border-radius:12px;background:rgba(255,250,240,.92);border:1.5px solid var(--line-strong,#cdb391);font-size:13px;line-height:1.15;overflow:hidden;white-space:nowrap;max-width:100%}
#mia .mia-p .dot{width:12px;height:12px;border-radius:50%;background:var(--pc);box-shadow:0 0 0 1.5px rgba(59,42,31,.5);flex:none}
#mia .mia-p b{font-weight:600;overflow:hidden;text-overflow:ellipsis;max-width:8em}
#mia .mia-p .st{font-size:12px;color:var(--muted,#7a6550)}
#mia .mia-p.on{border-color:var(--pc);box-shadow:0 0 0 2px var(--pc)}
#mia .mia-p.out{opacity:.55}
#mia .mia-p .tb{position:absolute;left:0;right:0;bottom:0;height:3px;background:rgba(0,0,0,.08)}
#mia .mia-p .tb i{display:block;height:100%;width:100%;background:var(--pc)}
#mia .mia-row{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;pointer-events:none;min-height:44px}
.stage.mia3d #mia .mia-row{height:44px;min-height:0;flex:none;overflow:hidden;position:relative;z-index:1;order:-1}
#mia .mia-hint:empty{display:none}
#mia .mia-hint{flex:0 0 auto;font-size:13px;line-height:1.3;color:#5b4129;background:rgba(255,250,240,.9);border:1px solid var(--line-strong,#cdb391);border-radius:99px;padding:4px 12px}
#mia .mia-hist{display:flex;justify-content:flex-end;gap:4px;min-width:0;overflow:hidden;flex:0 1 auto}
#mia .mia-hist:empty{display:none}
#mia .mia-h{flex:none;display:inline-flex;align-items:baseline;gap:3px;font:700 15px "IBM Plex Mono",monospace;background:rgba(255,250,240,.9);border:1px solid var(--line-strong,#cdb391);border-radius:7px;padding:2px 6px;color:#3a2a1f}
#mia .mia-h i{font-style:normal;color:#8a6a48;font-size:12px}
#mia .mia-h.now{opacity:.65}
#mia .mia-bd{position:relative;flex:1;min-height:0;width:100%}
#mia svg.mia-board{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);pointer-events:auto;touch-action:manipulation;user-select:none;-webkit-user-select:none;filter:drop-shadow(0 6px 8px rgba(59,42,31,.35))}
#mia .mia-ctl{position:absolute;right:20px;bottom:100px;z-index:3;display:flex;flex-direction:column;align-items:center;gap:8px;pointer-events:none}
#mia .mia-ctl[hidden]{display:none}
#mia .mia-pad{--pz:168px;position:relative;width:var(--pz);height:var(--pz);pointer-events:none}
#mia .mia-dir{all:unset;position:absolute;inset:0;pointer-events:auto;cursor:pointer;touch-action:manipulation;clip-path:polygon(1% 0,99% 0,66% 32%,34% 32%);background:linear-gradient(#a06c3c,#6b3f1f 32%);animation:miaIn .18s ease-out}
#mia .mia-dir:active{background:linear-gradient(#5fae4e,#3f8a32 32%)}
#mia .mia-dir i{position:absolute;left:50%;top:9%;width:0;height:0;margin-left:-11px;border:11px solid transparent;border-top:0;border-bottom:15px solid #ffefcf}
#mia .mia-dir.d1{transform:rotate(90deg)}#mia .mia-dir.d2{transform:rotate(180deg)}#mia .mia-dir.d3{transform:rotate(270deg)}
@keyframes miaIn{from{opacity:0}to{opacity:1}}
#mia .mia-dist{position:absolute;left:50%;top:50%;width:62px;height:62px;margin:-31px 0 0 -31px;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;border-radius:50%;background:#2a1a0e;color:#ffd97a;box-shadow:inset 0 0 0 2px #6b3f1f,0 2px 5px rgba(0,0,0,.35);pointer-events:none}
#mia .mia-dist span{display:flex;align-items:baseline;gap:1px}
#mia .mia-dist b{font:700 24px/1 "IBM Plex Mono",monospace}
#mia .mia-dist small{font-size:10px;opacity:.85}
#mia .mia-dist.pop{animation:miaPop .45s}
@keyframes miaPop{0%{transform:scale(1)}35%{transform:scale(1.28);background:#7a4a14}100%{transform:scale(1)}}
#mia .mia-dist .mia-acts{gap:3px}
#mia .mia-acts i{width:8px;height:8px;border-radius:50%;background:#5a4632}
#mia .mia-acts i.on{background:#ffcf4a;box-shadow:0 0 5px #ffcf4a}
#mia .mia-wbtn{all:unset;pointer-events:auto;box-sizing:border-box;display:flex;align-items:center;justify-content:center;width:150px;height:38px;border-radius:10px;background:rgba(255,250,240,.95);border:1.5px solid var(--line-strong,#cdb391);font-size:14px;font-weight:600;color:#3a2a1f;cursor:pointer;touch-action:manipulation}
#mia .mia-wbtn.sel{background:#4f9d3f;color:#fff;border-color:#f2c94c;box-shadow:0 0 0 2px #f2c94c}
#mia .mia-wbtn.off{opacity:.6}
@media (max-width:520px){#mia .mia-p{font-size:12px;padding:3px 8px 5px;gap:5px}#mia .mia-bar{max-width:calc(100% - 150px)}}
.stage.mia3d #mia.lay .mia-bar{transform:translateY(calc(var(--bs) - 100%));transition:transform .35s,opacity .35s}
.stage.mia3d #mia.lay .mia-mebar{top:var(--mt);bottom:auto;transition:top .35s,opacity .35s}
.stage.mia3d .specbar:not([hidden])~#mia .mia-bar{margin-top:0}
.stage.mia3d .specbar:not([hidden])~#mia .mia-row{margin-top:30px}
.stage.mia3d #mia.wide .mia-row{position:absolute;left:16px;top:8px;width:calc(50% - 280px);min-width:190px;max-width:42%;justify-content:flex-start;flex-wrap:wrap;height:auto;max-height:90%}
.stage.mia3d #mia.wide .mia-hist{flex-wrap:wrap;justify-content:flex-start}
.stage.mia3d #mia.wide .mia-bar{min-height:0}
.stage.mia3d .specbar:not([hidden])~#mia.wide .mia-bar{margin-top:30px}
@media (max-width:699px) and (orientation:portrait){#mia{padding-bottom:112px}
.stage.mia3d #mia .mia-row{width:calc(100% - 110px);align-self:flex-start;justify-content:flex-start}
#mia .mia-h{font-size:13px;padding:2px 5px}#mia .mia-mebar{bottom:70px;max-width:calc(100% - 24px)}
#mia .mia-mebar{bottom:70px;max-width:calc(100% - 24px)}
#mia .mia-ctl{left:0;right:0;bottom:6px;flex-direction:row;justify-content:center}
#mia .mia-pad{--pz:134px}
#mia .mia-dir i{margin-left:-9px;border-width:0 9px 12px}
#mia .mia-dist{width:48px;height:48px;margin:-24px 0 0 -24px}
#mia .mia-dist b{font-size:18px}
#mia .mia-dist small{font-size:9px}
#mia .mia-acts i{width:6px;height:6px}
#mia .mia-wbtn{position:absolute;left:10px;bottom:62px;width:68px;height:44px}}
@media (max-height:520px) and (orientation:landscape){#mia .mia-ctl{bottom:8px;right:112px;flex-direction:row-reverse;align-items:flex-end}#mia .mia-pad{--pz:132px}#mia .mia-dist{width:48px;height:48px;margin:-24px 0 0 -24px}#mia .mia-dist b{font-size:18px}#mia .mia-wbtn{width:62px;height:44px}}
`;
  document.head.appendChild(css);
  elRoot=document.createElement('div');elRoot.id='mia';elRoot.hidden=true;
  elRoot.innerHTML=`<div class="mia-bar"></div><div class="mia-mebar"></div><div class="mia-row"><div class="mia-hint" aria-live="polite"></div><div class="mia-hist" aria-label="내 기록"></div></div><div class="mia-bd"><svg class="mia-board" viewBox="-.4 -.4 9.8 9.8" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="미아 판"><g id="miaMain"></g></svg></div><div class="mia-ctl" hidden></div>`;
  $('#stage').insertBefore(elRoot,$('#fx'));
  elSvg=elRoot.querySelector('svg.mia-board');elMain=elRoot.querySelector('#miaMain');
  elBar=elRoot.querySelector('.mia-bar');elBarMe=elRoot.querySelector('.mia-mebar');elHint=elRoot.querySelector('.mia-hint');elHist=elRoot.querySelector('.mia-hist');elCtl=elRoot.querySelector('.mia-ctl');
  elSvg.addEventListener('click',onSvgClick);
  elCtl.addEventListener('click',e=>{
    const d=e.target.closest('[data-d]');if(d){tapDir(+d.dataset.d);return}
    if(e.target.closest('[data-w]'))toggleWall();
  });
  document.addEventListener('keydown',e=>{if(e.code==='Escape'&&elRoot&&!elRoot.hidden&&(pend||wallMode)){pend=null;wallMode=false;redraw()}});
  window.addEventListener('resize',()=>{fit();P3.lay=''});
  $('#cv').addEventListener('click',d3Click);
};
G._d3={P3,IN,introEnd,gridAt,get CS(){return CS},tapAt,tapDir,toggleWall,confirmPend,get pend(){return pend},get wallMode(){return wallMode},get memo(){return memo}};   // 화면 검사용

if(typeof window!=='undefined')(window.GAMES=window.GAMES||{}).mia=G;
})();
