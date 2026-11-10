/* ===== 루미큐브 게임 모듈 (1단계: 방장 엔진·묶음 판정·쉬움 봇. 화면은 아직 없어 index.html·GAME_IDS에 넣지 않음) =====
   2~4명. 타일 106장: 4색 × 1~13 × 2벌(id 0~103 = 벌*52 + 색*13 + 숫자-1) + 조커 2장(104, 105). 14장씩 받고 남은 패에서 뽑음.
   탁자는 가로 W칸 × 세로 RH줄의 칸판. 한 줄에서 옆으로 붙어 있는 타일들이 묶음 하나(빈칸이 묶음을 나눔).
   차례: 내 패를 칸에 놓거나(mv) 탁자 타일을 옮김 → 차례 마치기(end). 이번 차례에 낸 타일만 패로 되돌릴 수 있음(back).
   - 한 장도 안 냈으면 1장 뽑고 넘어감(남은 패가 없으면 그냥 넘김).
   - 냈는데 탁자가 규칙에 안 맞으면 차례 시작 때로 되돌리고 3장 뽑음. 시간이 다 돼도 같음(맞으면 그대로 마침).
   - 첫 등록(설정): 내 패만으로 만든 묶음 합이 30점 이상이어야 하고, 그 전에는 탁자 타일을 못 건드림.
   - 패를 다 내면 승리. 남은 패가 없고 모두 연달아 못 내면 남은 패 점수가 적은 순서(조커 30점).
   남의 패 값은 방장 엔진에만 있고 snap에는 자기 패만 담음. 손패(hand)는 표시용 [0] */
(function(){
const G={id:'rummi',name:'루미큐브',short:'루미',lead:'숫자 타일을 묶어 먼저 다 내는 게임',maxHi:4,minN:2,noFast:true,firstPick:true,noView:true,oneBotLv:true};

/* ---------- 규칙 값 ---------- */
const W=13,RH=12,CELLS=W*RH,NT=106,JK=104,START=14,MELD=30,PEN=3,JOKER_PTS=30;
const isJ=id=>id>=JK;
const colOf=id=>isJ(id)?-1:(id%52)/13|0,numOf=id=>isJ(id)?0:id%13+1;
const ptsOf=ids=>ids.reduce((a,x)=>a+(isJ(x)?JOKER_PTS:numOf(x)),0);
/* 왼쪽부터 놓인 타일들이 묶음이면 그 점수(조커는 대신하는 숫자), 아니면 0. 그룹과 연속 둘 다 되면 큰 쪽 */
function setValue(a){
  const n=a.length;if(n<3||n>13)return 0;
  const T=a.filter(x=>!isJ(x));if(!T.length)return 0;
  let best=0;
  if(n<=4){const v=numOf(T[0]);if(T.every(x=>numOf(x)===v)&&new Set(T.map(colOf)).size===T.length)best=v*n}   // 그룹: 같은 숫자, 다른 색
  const c=colOf(T[0]),i0=a.findIndex(x=>!isJ(x)),st=numOf(a[i0])-i0;                                        // 연속: 같은 색, 1씩 커짐 (13 다음 1 없음)
  if(st>=1&&st+n-1<=13&&a.every((x,i)=>isJ(x)||(colOf(x)===c&&numOf(x)===st+i)))best=Math.max(best,n*(2*st+n-1)/2);
  return best;
}
/* 칸판에서 묶음들: {at: 첫 칸, ids} */
function runsOf(g){
  const out=[];
  for(let r=0;r<RH;r++){let cur=null;
    for(let c=0;c<W;c++){const x=g[r*W+c];
      if(x>=0){if(!cur){cur={at:r*W+c,ids:[]};out.push(cur)}cur.ids.push(x)}else cur=null}}
  return out;
}
/* 길이 k인 묶음을 놓을 빈 자리(양옆이 비어 다른 묶음과 안 붙는 곳). 가운데 줄부터. 없으면 -1 */
function findSpot(g,k){
  const rows=[...Array(RH).keys()].sort((a,b)=>Math.abs(a-(RH-1)/2)-Math.abs(b-(RH-1)/2));
  for(const r of rows)for(let c=0;c+k<=W;c++){
    let ok=true;for(let j=c-1;j<=c+k&&ok;j++)if(j>=0&&j<W&&g[r*W+j]>=0)ok=false;
    if(ok)return r*W+c}
  return -1;
}

/* ---------- 규칙 설명·방 설정 ---------- */
G.rulesHTML='<ol class="rules"><li><b>타일</b> : 네 가지 색의 1~13 타일이 두 벌씩, 조커가 2개입니다. 14개씩 받습니다</li><li><b>묶음</b> : 같은 숫자에 색이 다른 타일 3~4개, 또는 같은 색으로 숫자가 이어지는 타일 3개 이상입니다. 13 다음에 1은 이어지지 않습니다. 조커는 어떤 타일이든 대신합니다</li><li><b>내 차례</b> : 내 타일을 탁자에 내서 묶음을 만들거나 탁자의 묶음에 붙입니다. 탁자의 타일은 자유롭게 옮겨 묶음을 다시 짤 수 있습니다. 이번 차례에 낸 타일만 다시 가져올 수 있습니다</li><li><b>첫 등록</b> : 처음 낼 때는 내 타일만으로 만든 묶음의 합이 30점 이상이어야 합니다. 그 전에는 탁자의 타일을 옮길 수 없습니다</li><li><b>뽑기</b> : 하나도 내지 않고 차례를 마치면 타일을 하나 뽑습니다</li><li><b>되돌리기</b> : 차례를 마칠 때 탁자에 맞지 않는 묶음이 있으면 차례를 시작할 때로 되돌리고 3개를 뽑습니다. 제한 시간이 지나도 같습니다</li><li><b>승리</b> : 타일을 먼저 다 내면 이깁니다. 남은 패가 없고 아무도 내지 못하면 남은 타일의 합이 적은 사람이 이깁니다(조커 30점)</li></ol>';
G.modeDesc=['타일을 묶어 먼저 다 내기','타일을 묶어 먼저 다 내기'];
G.defaults={max:4,turn:90,meld:1};
G.roomSet=[{k:'turn',label:'제한 시간',unit:'초',lo:30,hi:180,step:30,desc:'시간이 지나면 탁자가 맞을 때는 그대로 마치고, 아니면 되돌리고 뽑습니다'}];
G.ruleSet=[
  {k:'meld',label:'첫 등록 30점',desc:'처음 낼 때 내 타일만으로 만든 묶음의 합이 30점 이상이어야 합니다'},
  {k:'pickfirst',pick:1,label:'선 플레이어',desc:'선택이면 방장이 대기실 이름표에서 고르고, 무작위면 주사위로 정합니다'}
];
G.cfgChips=c=>`<span class="chip">제한 시간 <b>${+c.turn||90}초</b></span><span class="chip">첫 등록 <b>${c.meld?'30점':'없음'}</b></span>`;
G.cfgSum=c=>`제한 시간 ${+c.turn||90}초 · 첫 등록 ${c.meld?'30점':'없음'}`;
G.roomSub=()=>'2~4명 숫자 타일 게임';
G.pubExtra=()=>({});
G.cardInfo=()=>'<p class="cardinfo">타일 106개 · 14개씩</p>';
G.rankTitle=()=>'';
G.finLabel=f=>f===1?'승리':f+'등';
G.noEmotes=[];
G.keys={};G.keyActions=[];
G.cardHTML=()=>'';G.drawFace=()=>{};G.cmpCard=()=>0;G.labelOf=()=>'';

/* ---------- 방장 엔진 ---------- */
const alive=()=>H.players.map((p,i)=>i).filter(i=>!H.players[i].finished);
const needMeld=s=>!!H.cfg.meld&&!H.rm.md[s];   // 아직 첫 등록을 못 함
function setDl(){
  const t=clock(),p=H.players[H.turn];
  H.deadline=t+(+H.cfg.turn||90)*1000;
  H.botActAt=p&&p.bot?t+rand(900,1700):0;mark();
}
function beginTurn(i){
  const O=H.rm;
  H.turn=i;O.base=O.g.slice();O.rk0=O.rk[i].slice();O.put=[];O.plan=null;H.seatNote={};setDl();
}
/* 타일 ids를 칸 to부터 오른쪽으로 놓음. 내 패에서 내거나 탁자에서 옮김(첫 등록 전에는 이번 차례에 낸 것만) */
function doMove(seat,ids,to){
  const O=H.rm;if(H.turn!==seat||!Array.isArray(ids))return false;
  const k=ids.length;if(k<1||k>W||!Number.isInteger(to)||to<0||to>=CELLS||to%W+k>W||new Set(ids).size!==k)return false;
  const R=O.rk[seat],free=!needMeld(seat),src=[];
  for(const id of ids){
    if(!Number.isInteger(id)||id<0||id>=NT)return false;
    const gi=O.g.indexOf(id);
    if(gi>=0){if(!free&&!O.put.includes(id))return false;src.push(gi)}
    else if(R.includes(id))src.push(-1);
    else return false;
  }
  for(let j=0;j<k;j++){const x=O.g[to+j];if(x>=0&&!ids.includes(x))return false}   // 놓을 칸은 비었거나 옮기는 타일 자리
  ids.forEach((id,j)=>{if(src[j]>=0)O.g[src[j]]=-1;else{R.splice(R.indexOf(id),1);O.put.push(id)}});
  ids.forEach((id,j)=>{O.g[to+j]=id});
  mark();return true;
}
/* 이번 차례에 낸 타일을 패로 되돌림 */
function doBack(seat,ids){
  const O=H.rm;if(H.turn!==seat||!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length)return false;
  if(!ids.every(id=>O.put.includes(id)&&O.g.indexOf(id)>=0))return false;
  ids.forEach(id=>{O.g[O.g.indexOf(id)]=-1;O.put.splice(O.put.indexOf(id),1);O.rk[seat].push(id)});
  mark();return true;
}
/* 지금 탁자로 차례를 마칠 수 있는지. bad = 맞지 않는 묶음의 첫 칸들, pts = 첫 등록 점수 */
function tableState(g,put,meld){
  const bad=[];let pts=0;
  for(const r of runsOf(g)){
    const v=setValue(r.ids),k=meld?r.ids.filter(x=>put.includes(x)).length:0;
    if(!v||(k&&k<r.ids.length))bad.push(r.at);   // 첫 등록 때는 탁자 묶음에 붙일 수 없음
    else if(k)pts+=v;
  }
  return {ok:!bad.length&&(!meld||pts>=MELD),bad,pts};
}
function drawN(seat,n){const O=H.rm;let k=0;while(k<n&&O.pool.length){O.rk[seat].push(O.pool.pop());k++}return k}
function endTurn(seat,auto){
  const O=H.rm,p=H.players[seat],pre=auto?'시간 초과 · ':'';
  if(O.put.length&&tableState(O.g,O.put,needMeld(seat)).ok){
    const k=O.put.length,first=needMeld(seat);
    O.md[seat]=1;O.passN=0;O.ev={q:++O.q,s:seat,k:'put',n:k};
    addLog(`${pre}${p.name} ${k}개 냄${first?' · 첫 등록':''}`);
    if(!O.rk[seat].length){finishGame(seat);return}
  }else{
    const bad=O.put.length>0;
    O.g=O.base.slice();O.rk[seat]=O.rk0.slice();O.put=[];
    const got=drawN(seat,bad?PEN:1);
    O.passN=got?0:O.passN+1;O.ev={q:++O.q,s:seat,k:bad?'pen':got?'draw':'pass',n:got};
    addLog(`${pre}${p.name} ${bad?'되돌림 · ':''}${got?got+'개 뽑음':'넘김'}`,bad?'lie':'');
    if(O.passN>=alive().length){finishGame(-1);return}   // 남은 패가 없고 모두 못 냄
  }
  beginTurn(nextActive(seat));
}
/* w: 다 낸 사람(-1이면 점수로). 남은 사람은 남은 타일 합이 적은 순서(같으면 개수, 자리 순) */
function finishGame(w){
  const O=H.rm,L=alive().filter(i=>i!==w).sort((a,b)=>ptsOf(O.rk[a])-ptsOf(O.rk[b])||O.rk[a].length-O.rk[b].length||a-b);
  let r=1;
  if(w>=0)H.players[w].rank=r++;
  L.forEach(i=>{H.players[i].rank=r++});
  const win=w>=0?w:L[0];
  O.fin={w:win,why:w>=0?'':'pts',pts:O.rk.map(ptsOf)};
  H.players.forEach(p=>{p.finished=true;p.hand=[]});
  if(win>=0)addLog(`${H.players[win].name} 승리!`,'fin');
  H.seatNote={};H.phase='over';H.deadline=0;H.botActAt=0;mark();
  H.players.forEach((p,i)=>{if(p.bot&&Math.random()<.4)botEmote(i,'gg',800+Math.random()*1600)});
}
/* 항복: 하던 것을 되돌리고 내 타일은 남은 패로 */
function doSurrender(s){
  const O=H.rm,p=H.players[s];if(H.phase!=='play'||!O||!p||p.finished)return;
  const wasTurn=H.turn===s;
  if(wasTurn){O.g=O.base.slice();O.rk[s]=O.rk0.slice();O.put=[]}
  p.rank=alive().length;p.finished=true;p.surrendered=true;p.hand=[];
  O.pool.push(...O.rk[s]);O.rk[s]=[];shuffle(O.pool);O.passN=0;
  addLog(`${p.name} ${p.deserter?'탈주':'항복'}!`,'lie');
  const L=alive();
  if(L.length<=1){finishGame(L.length?L[0]:-1);return}
  if(wasTurn)beginTurn(nextActive(s));else mark();
}

/* ---------- 쉬움 봇: 내 패로 만든 묶음을 내고, 등록한 뒤에는 탁자 묶음 끝에 한 장씩 붙임 (탁자를 다시 짜지 않음) ---------- */
function rackSets(R){
  const build=runFirst=>{
    const left=R.filter(x=>!isJ(x)),out=[];
    const take=ids=>{ids.forEach(x=>left.splice(left.indexOf(x),1));out.push(ids)};
    const runs=()=>{for(let c=0;c<4;c++)for(;;){
      const by={};left.forEach(x=>{if(colOf(x)===c&&!by[numOf(x)])by[numOf(x)]=[x]});
      let best=null;
      for(let s=1;s<=11;s++){let e=s;while(by[e])e++;if(e-s>=3&&(!best||e-s>best.length)){best=[];for(let v=s;v<e;v++)best.push(by[v][0])}}
      if(!best)break;take(best)}};
    const groups=()=>{for(let v=13;v>=1;v--)for(;;){
      const by={};left.forEach(x=>{if(numOf(x)===v&&!by[colOf(x)])by[colOf(x)]=[x]});
      const L=Object.values(by).map(q=>q[0]);if(L.length<3)break;take(L)}};
    if(runFirst){runs();groups()}else{groups();runs()}
    for(const j of R.filter(isJ)){   // 조커: 두 장짜리 짝에 끼움
      let s=null;
      for(let a=0;a<left.length&&!s;a++)for(let b=a+1;b<left.length&&!s;b++){
        const x=left[a],y=left[b];
        if(numOf(x)===numOf(y)){if(colOf(x)!==colOf(y))s=[x,y,j]}
        else if(colOf(x)===colOf(y)){
          const lo=numOf(x)<numOf(y)?x:y,hi=lo===x?y:x,d=numOf(hi)-numOf(lo);
          if(d===1)s=numOf(hi)<13?[lo,hi,j]:[j,lo,hi];else if(d===2)s=[lo,j,hi];
        }
      }
      if(s){s.filter(x=>!isJ(x)).forEach(x=>left.splice(left.indexOf(x),1));out.push(s)}
    }
    return out;
  };
  const val=S=>S.reduce((a,s)=>a+setValue(s),0),A=build(true),B=build(false);
  return val(A)>=val(B)?A:B;
}
function findAttach(seat){
  const O=H.rm,g=O.g;
  for(const r of runsOf(g)){
    const row=r.at/W|0,c0=r.at%W,c1=c0+r.ids.length-1;
    for(const id of O.rk[seat]){
      if(isJ(id))continue;
      if(c0>0&&g[r.at-1]<0&&(c0<2||g[r.at-2]<0)&&setValue([id,...r.ids]))return {id,to:r.at-1};
      if(c1<W-1&&g[row*W+c1+1]<0&&(c1>W-3||g[row*W+c1+2]<0)&&setValue([...r.ids,id]))return {id,to:row*W+c1+1};
    }
  }
  return null;
}
/* 내 두 장에 탁자 타일 하나를 빌려 새 묶음: 4개 이상인 묶음의 끝(그룹은 아무 자리)에서 하나를 빼도 그 묶음이 맞을 때만 */
function findBorrow(seat){
  const O=H.rm,R=O.rk[seat].filter(x=>!isJ(x)),runs=runsOf(O.g).filter(r=>r.ids.length>=4);
  if(!runs.length||findSpot(O.g,3)<0)return null;
  for(let a=0;a<R.length;a++)for(let b=a+1;b<R.length;b++){
    const x=R[a],y=R[b];
    for(const r of runs)for(let k=0;k<r.ids.length;k++){
      const t=r.ids[k];if(isJ(t))continue;
      const rest=r.ids.filter((_,j)=>j!==k);if(!setValue(rest))continue;
      const set=[x,y,t].sort((p,q)=>numOf(p)-numOf(q));
      if(setValue(set))return {set,rest,at:r.at,mid:k>0&&k<r.ids.length-1,head:k===0};
    }
  }
  return null;
}
function botStep(i){
  const O=H.rm,next=()=>{H.botActAt=clock()+rand(500,900)};
  if(!O.plan){O.plan=rackSets(O.rk[i]);if(needMeld(i)&&O.plan.reduce((a,s)=>a+setValue(s),0)<MELD)O.plan=[]}
  while(O.plan.length){const s=O.plan.shift(),at=findSpot(O.g,s.length);if(at>=0&&doMove(i,s,at)){next();return}}
  if(!needMeld(i)){
    const a=findAttach(i);if(a&&doMove(i,[a.id],a.to)){next();return}
    const w=findBorrow(i),at=w?findSpot(O.g,3):-1;
    if(w&&at>=0&&doMove(i,w.set,at)){if(w.mid)doMove(i,w.rest,w.at);next();return}
  }
  if(O.put.length&&!tableState(O.g,O.put,needMeld(i)).ok)doBack(i,O.put.slice());   // 자리가 없어 30점을 못 채웠으면 거두고 뽑음
  endTurn(i,false);
}

G.judge={W,RH,CELLS,JK,isJ,colOf,numOf,setValue,runsOf,tableState,ptsOf};   // 화면도 같은 판정을 씀
G._test={W,RH,CELLS,NT,JK,START,MELD,PEN,isJ,colOf,numOf,setValue,runsOf,findSpot,tableState,rackSets,ptsOf};
G.engine={
  start(){
    Object.assign(H,{phase:'play',log:[],seatNote:{},field:[],last:null,reveal:null,shouts:[],pending:null,rankNext:1,known:{},turn:0,botActAt:0,deadline:0});
    const n=H.players.length,pool=shuffle([...Array(NT).keys()]);
    const rk=H.players.map(()=>pool.splice(0,START));
    H.players.forEach(p=>{p.finished=false;p.rank=null;p.surrendered=false;p.hand=[0]});
    const A=firstSeat(n);
    H.rm={gn:((H.rm&&H.rm.gn)||0)+1,first:A,g:new Array(CELLS).fill(-1),base:null,rk,rk0:null,put:[],pool,md:rk.map(()=>0),passN:0,q:0,ev:null,plan:null,fin:null};
    addLog(`${H.players[A].name}님이 먼저 합니다.`,'sys');
    beginTurn(A);
  },
  act(seat,a){
    if(a.t==='surrender'){doSurrender(seat);return}
    const O=H.rm;if(!O||H.phase!=='play'||seat<0||seat>=H.players.length||H.turn!==seat||dealing())return;
    if(a.t==='mv')doMove(seat,a.ids,a.to);
    else if(a.t==='back')doBack(seat,a.ids);
    else if(a.t==='end')endTurn(seat,false);
  },
  tick(t){
    const O=H.rm;if(!O||H.phase!=='play')return;
    const p=H.players[H.turn];if(!p)return;
    if(p.bot&&!awayHuman(p)){if(H.botActAt&&t>=H.botActAt&&!(p.away&&t<p.awayAt+AWAY_WAIT))botStep(H.turn);return}
    if(H.deadline&&t>=H.deadline){const s=H.turn;endTurn(s,true);if(H.phase==='play')H.seatNote={[s]:'시간 초과'}}
  },
  snap(s,you,t){
    const O=H.rm,over=H.phase==='over',me=you>=0&&you<H.players.length?you:-1,g=[];
    O.g.forEach((x,i)=>{if(x>=0)g.push(i,x)});   // [칸, 타일, 칸, 타일, …]
    s.o={gn:O.gn,first:O.first,cur:H.turn,g,put:O.put.slice(),pool:O.pool.length,n:O.rk.map(r=>r.length),md:O.md.slice(),
      rk:me>=0?O.rk[me].slice():null,all:over?O.rk.map(r=>r.slice()):null,ev:O.ev?{...O.ev}:null,fin:O.fin?{...O.fin}:null};
    s.gr=0;
    if(H.phase==='play'&&H.deadline)s.dl=Math.max(0,Math.round(H.deadline-t));
    else{s.dl=0;if(H.phase==='play')delete s.t}
  },
  restore(){},
  emoPhase:ph=>ph==='play'||ph==='over'
};

/* ---------- 그림 도구: 타일 얼굴·자리 계산 (게임 화면과 테스트룸 lab-rummi.html이 같이 씀. THREE는 받아서 씀) ----------
   길이 단위는 타일 폭 = 1. 칸판 가운데가 (0,0), +z가 내 쪽. 받침대는 칸판 아래쪽(내 쪽)에 2단 */
const LAY={TW:1,TH:1.42,TT:.3,CW:1.08,CH:1.56,GAP:.5,RK:W};
const INK=['#26262a','#d2362b','#2563c4','#e3891b'];   // 검정·빨강·파랑·주황
const cellXZ=cell=>({x:(cell%W-(W-1)/2)*LAY.CW,z:((cell/W|0)-(RH-1)/2)*LAY.CH});
const BOARD={w:W*LAY.CW,d:RH*LAY.CH};
/* 받침대: 한 단에 RK개. 시작 패 14개까지는 한 단에 조금 줄여 담고, 넘치면 두 단에 나눠 담음(두 단도 넘치면 그만큼 줄임). i번째 타일의 자리와 크기 */
function rackXZ(i,n){
  const per=n<=LAY.RK+1?Math.max(LAY.RK,n):Math.max(LAY.RK,Math.ceil(n/2)),sc=Math.min(1,LAY.RK/per),tier=i<per?0:1,k=tier?i-per:i;
  return {x:(k-(per-1)/2)*LAY.CW*sc,z:BOARD.d/2+LAY.GAP+LAY.CH*(tier+.5),s:sc,tier};
}
/* 화면에 꼭 들어와야 하는 곳: 칸판 + 받침대 2단 */
const REGION={w:BOARD.w,z0:-BOARD.d/2,z1:BOARD.d/2+LAY.GAP+LAY.CH*2};
/* 타일 얼굴. style 0 = 밝은 타일에 색 숫자, 1 = 색 타일에 밝은 숫자 */
function drawFace(g,w,h,id,style){
  const j=isJ(id),c=j?(id===JK?1:0):colOf(id),ink=INK[c],bg=style?ink:'#f6eeda',fg=style?'#fff6e2':ink,r=w*.13;
  g.clearRect(0,0,w,h);
  g.beginPath();g.moveTo(r,0);g.arcTo(w,0,w,h,r);g.arcTo(w,h,0,h,r);g.arcTo(0,h,0,0,r);g.arcTo(0,0,w,0,r);g.closePath();
  g.fillStyle=bg;g.fill();
  g.lineWidth=w*.035;g.strokeStyle=style?'rgba(0,0,0,.28)':'rgba(120,92,50,.45)';g.stroke();
  g.fillStyle=fg;g.strokeStyle=fg;g.textAlign='center';g.textBaseline='middle';
  if(j){   // 조커: 웃는 얼굴
    const cx=w/2,cy=h*.46,R=w*.33;
    g.lineWidth=w*.07;g.beginPath();g.arc(cx,cy,R,0,Math.PI*2);g.stroke();
    g.beginPath();g.arc(cx-R*.38,cy-R*.22,w*.05,0,Math.PI*2);g.arc(cx+R*.38,cy-R*.22,w*.05,0,Math.PI*2);g.fill();
    g.beginPath();g.arc(cx,cy+R*.05,R*.55,Math.PI*.15,Math.PI*.85);g.stroke();
    return;
  }
  const v=numOf(id),t=String(v);
  g.font=`700 ${Math.round(h*.6)}px "IBM Plex Mono", ui-monospace, Menlo, monospace`;
  const mw=g.measureText(t).width,k=Math.min(1,w*.86/mw);
  g.save();g.translate(w/2,h*.45);g.scale(k,1);g.fillText(t,0,0);g.restore();
  g.lineWidth=w*.045;g.beginPath();g.arc(w/2,h*.86,w*.085,0,Math.PI*2);g.stroke();   // 아래 동그라미 (6·9 구분: 동그라미가 아래)
}
G.kit={LAY,INK,BOARD,REGION,cellXZ,rackXZ,drawFace};

(window.GAMES=window.GAMES||{}).rummi=G;
})();
