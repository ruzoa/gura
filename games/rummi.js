/* ===== 루미큐브 게임 모듈 =====
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
/* 옆으로 붙은 타일 한 줄(a)을 맞는 묶음들로 나눔. 못 나누면 null, 되면 {cuts: 묶음이 시작하는 자리들, pts: 첫 등록 점수}.
   put·meld가 있으면(첫 등록) 묶음마다 이번 차례에 낸 타일만이거나 하나도 없어야 하고, 낸 타일만으로 된 묶음의 점수를 셈. 묶음 수가 적은 쪽을 고름 */
function splitRun(a,put,meld){
  const n=a.length,f=new Array(n+1).fill(-Infinity),from=new Array(n+1).fill(-1),pt=new Array(n+1).fill(0);
  f[0]=0;
  for(let i=3;i<=n;i++)for(let j=Math.max(0,i-13);j<=i-3;j++){
    if(f[j]===-Infinity)continue;
    const seg=a.slice(j,i),v=setValue(seg);if(!v)continue;
    let add=0;
    if(meld){const k=seg.filter(x=>put.includes(x)).length;if(k&&k<seg.length)continue;if(k)add=v}
    const sc=f[j]+add*1000-1;   // 점수 먼저, 같으면 묶음 수가 적게
    if(sc>f[i]){f[i]=sc;from[i]=j;pt[i]=pt[j]+add}
  }
  if(f[n]===-Infinity)return null;
  const cuts=[];for(let i=n;i>0;i=from[i])cuts.unshift(from[i]);
  return {cuts,pts:pt[n]};
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
G.rulesHTML='<ol class="rules"><li><b>타일</b> : 네 가지 색의 1~13 타일이 두 벌씩, 조커가 2개입니다. 14개씩 받습니다</li><li><b>묶음</b> : 같은 숫자에 색이 다른 타일 3~4개, 또는 같은 색으로 숫자가 이어지는 타일 3개 이상입니다. 13 다음에 1은 이어지지 않습니다. 조커는 어떤 타일이든 대신합니다</li><li><b>내 차례</b> : 내 타일을 탁자에 내서 묶음을 만들거나 탁자의 묶음에 붙입니다. 탁자의 타일은 자유롭게 옮겨 묶음을 다시 짤 수 있습니다. 이번 차례에 낸 타일만 다시 가져올 수 있습니다. 묶음끼리 붙어 있어도 됩니다</li><li><b>첫 등록</b> : 처음 낼 때는 내 타일만으로 만든 묶음의 합이 30점 이상이어야 합니다. 그 전에는 탁자의 타일을 옮길 수 없습니다</li><li><b>뽑기</b> : 하나도 내지 않고 차례를 마치면 타일을 하나 뽑습니다</li><li><b>되돌리기</b> : 차례를 마칠 때 탁자에 맞지 않는 묶음이 있으면 차례를 시작할 때로 되돌리고 3개를 뽑습니다. 제한 시간이 지나도 같습니다</li><li><b>승리</b> : 타일을 먼저 다 내면 이깁니다. 남은 패가 없고 아무도 내지 못하면 남은 타일의 합이 적은 사람이 이깁니다(조커 30점)</li></ol>';
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
  closeGaps(src.filter(c=>c>=0));
  mark();return true;
}
/* 이번 차례에 낸 타일을 패로 되돌림 */
function doBack(seat,ids){
  const O=H.rm;if(H.turn!==seat||!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length)return false;
  if(!ids.every(id=>O.put.includes(id)&&O.g.indexOf(id)>=0))return false;
  const gone=ids.map(id=>O.g.indexOf(id));
  ids.forEach(id=>{O.g[O.g.indexOf(id)]=-1;O.put.splice(O.put.indexOf(id),1);O.rk[seat].push(id)});
  closeGaps(gone);
  mark();return true;
}
/* 지금 탁자로 차례를 마칠 수 있는지. bad = 맞는 묶음들로 나눌 수 없는 줄의 첫 칸들, pts = 첫 등록 점수.
   붙어 있는 줄은 맞는 묶음들로 나눌 수 있으면 됨(묶음 사이를 띄우지 않아도 됨) */
function tableState(g,put,meld){
  const bad=[];let pts=0;
  for(const r of runsOf(g)){const sp=splitRun(r.ids,put,meld);if(!sp)bad.push(r.at);else pts+=sp.pts}
  return {ok:!bad.length&&(!meld||pts>=MELD),bad,pts};
}
/* 타일을 빼낸 빈 칸들(cells): 양옆을 붙이면 맞는 묶음이 되는데 그대로 두면 안 맞을 때만 오른쪽을 당겨 붙임 (7 7 [7] 7 → 7 7 7) */
function closeGaps(cells){
  const O=H.rm,g=O.g,ok=a=>!!splitRun(a);
  for(const c0 of cells.slice().sort((a,b)=>b-a)){
    if(g[c0]>=0)continue;
    const row=c0/W|0;let a=c0,b=c0;
    while(a>row*W&&g[a-1]<0)a--;while(b<row*W+W-1&&g[b+1]<0)b++;          // 빈 칸 구간 a~b
    if(a===row*W||b===row*W+W-1)continue;
    let l=a-1;while(l>row*W&&g[l-1]>=0)l--;let r=b+1;while(r<row*W+W-1&&g[r+1]>=0)r++;
    const L=g.slice(l,a),R=g.slice(b+1,r+1);
    if((ok(L)&&ok(R))||!ok([...L,...R]))continue;
    for(let k=b+1;k<=r;k++){g[k-(b-a+1)]=g[k];g[k]=-1}
  }
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

G.judge={W,RH,CELLS,JK,isJ,colOf,numOf,setValue,splitRun,runsOf,tableState,ptsOf};   // 화면도 같은 판정을 씀
G._test={W,RH,CELLS,NT,JK,START,MELD,PEN,isJ,colOf,numOf,setValue,splitRun,runsOf,findSpot,tableState,rackSets,ptsOf};
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

/* ---------- 그림 도구: 타일 얼굴·자리 계산 ----------
   길이 단위는 타일 폭 = 1. 칸판 가운데가 (0,0), +z가 내 쪽. 받침대는 칸판 아래쪽(내 쪽)에 2단 */
const LAY={TW:1,TH:1.42,TT:.3,CW:1.08,CH:1.56,GAP:.5,RK:W,RZ:3.3};   // RZ: 칸판 아래 끝에서 받침대 앞 끝까지
const INK=['#26262a','#d2362b','#2563c4','#e3891b'];   // 검정·빨강·파랑·주황
const cellXZ=cell=>({x:(cell%W-(W-1)/2)*LAY.CW,z:((cell/W|0)-(RH-1)/2)*LAY.CH});
const BOARD={w:W*LAY.CW,d:RH*LAY.CH};
/* 화면에 꼭 들어와야 하는 곳: 칸판 + 내 받침대 */
const REGION={w:BOARD.w,z0:-BOARD.d/2,z1:BOARD.d/2+LAY.RZ+.35};
/* 타일 얼굴. style 0 = 밝은 타일에 색 숫자, 1 = 색 타일에 밝은 숫자. 조커는 별(빨강·검정) */
function drawFace(g,w,h,id,style){
  const j=isJ(id),c=j?(id===JK?1:0):colOf(id),ink=INK[c],bg=style?ink:'#f6eeda',fg=style?'#fff6e2':ink,r=w*.13;
  g.fillStyle=style?ink:'#e2d6b8';g.fillRect(0,0,w,h);   // 모서리 밖은 옆면 색
  g.beginPath();g.moveTo(r,0);g.arcTo(w,0,w,h,r);g.arcTo(w,h,0,h,r);g.arcTo(0,h,0,0,r);g.arcTo(0,0,w,0,r);g.closePath();
  g.fillStyle=bg;g.fill();
  g.lineWidth=w*.035;g.strokeStyle=style?'rgba(0,0,0,.28)':'rgba(120,92,50,.45)';g.stroke();
  g.fillStyle=fg;g.textAlign='center';g.textBaseline='middle';
  if(j){
    const cx=w/2,cy=h*.5,R=w*.42,q=R*.42;
    g.beginPath();for(let k=0;k<10;k++){const a=-Math.PI/2+k*Math.PI/5,rr=k%2?q:R;g.lineTo(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr)}g.closePath();g.fill();
    return;
  }
  const t=String(numOf(id));
  g.font=`700 ${Math.round(h*.68)}px "IBM Plex Mono", ui-monospace, Menlo, monospace`;
  const mw=g.measureText(t).width,k=Math.min(1,w*.88/mw);
  g.save();g.translate(w/2,h*.53);g.scale(k,1);g.fillText(t,0,0);g.restore();
}
G.kit={LAY,INK,BOARD,REGION,cellXZ,drawFace};

/* ---------- 화면 ----------
   카메라는 탑뷰 하나(75°)로 고정. 칸판과 내 받침대(2단, 타일은 40° 세움)가 화면에 꽉 차게 맞춤. 칸판은 누구에게나 숫자가 바로 서 보임.
   - 타일을 누르면 고름(살짝 올라오고 밝은 테두리, 여러 개), 다시 누르면 되돌림. 고른 뒤 빈 칸을 누르면 누른 순서대로 그 칸부터 오른쪽에 놓음
   - 고른 타일을 끌면 함께 따라옴. 꾹 누르고 있으면 그 타일부터 오른쪽으로 붙어 있는 타일이 하나씩 골라짐
   - 받침대는 직접 배열(처음 한 번만 색·숫자 순). 자리는 이 기기에 기억(gura-rummi-rack)
   - 이번 차례에 낸 타일은 노란 바탕, 맞지 않는 묶음은 빨간 테두리 */
const SEAT_C=['#c53026','#2b65ca','#1f7a2e','#c9831a'];
const SC=.31,ZC=(REGION.z0+REGION.z1)/2,TILT=60*Math.PI/180,CAMA=30*Math.PI/180,RKY=.05,ROOT_Y=.03;
/* 받침대: 비탈 하나(TILT)에 두 줄. u = 비탈 아래 끝에서 비탈을 따라 올라간 길이. 윗줄이 받침대 자리 0번 줄 */
const RSIN=Math.sin(TILT),RCOS=Math.cos(TILT),RGAP=.14,RLEN=2*LAY.TH+RGAP+.16,RZN=BOARD.d/2+LAY.RZ;
const rowU=tier=>(tier?0:LAY.TH+RGAP)+LAY.TH/2+.02;
const LONG_MS=420,LONG_STEP=170,MOVE_MS=190;
let CS=null,GV=new Array(CELLS).fill(-1),slots=[],slotsKey='',sel=[],want={},PT=null,DR=null;
let elRm=null,elBar=null,elHint=null,elBd=null,lastBar='',lastHint='',last2d='';
const P3={on:false,built:false,fail:false,root:null,cam:null,dirty:true,lastR:0,lay:'',layAt:0,d:12,tiles:new Map(),opp:null,oppKey:'',bad:[],movedAt:0};
const ease=k=>k<=0?0:k>=1?1:k*k*(3-2*k);
const dropY=(x,h)=>x>=1?0:x<.68?h*(1-(x/.68)*(x/.68)):h*.1*Math.sin(Math.PI*(x-.68)/.32);
const seated=()=>{const me=myIdx();return !!CS&&me>=0&&me<CS.n.length};
const myTurnNow=()=>!!(V&&CS&&V.st==='play'&&myReady()&&!introWait());
const meldNeed=s=>!!(V&&V.cfg&&V.cfg.meld)&&!!CS&&!CS.md[s];
const nm=i=>V.ps[i]?V.ps[i].n:'?';
function sndPick(v){tone(1100,.03,{type:'triangle',vol:(v||.1)*.5});hiss(.02,{freq:3400,q:3,vol:(v||.1)*.4})}
function sndPut(at){hiss(.03,{freq:2400,q:2.5,vol:.2,at:at||0});tone(700,.05,{type:'triangle',vol:.12,at:at||0})}
function sndNo(){sfx('no')}

/* 받침대 자리: 2단 × P칸 (P는 13, 타일이 26개를 넘으면 늘어남) */
const perTier=()=>slots.length/2;
function slotXZ(k){
  const P=perTier(),sc=Math.min(1,LAY.RK/P),tier=k/P|0,col=k%P,u=rowU(tier);
  return {x:(col-(P-1)/2)*LAY.CW*sc,z:RZN-RCOS*u,y:RKY+RSIN*u,s:sc};
}
function saveRack(){store('gura-rummi-rack',JSON.stringify({k:slotsKey,s:slots}))}
function syncRack(){
  const rk=seated()?CS.rk:null;if(!rk){slots=[];slotsKey='';return}
  const key=[CS.gn,myIdx(),V.ps.length].join('/');
  if(slotsKey!==key){
    slotsKey=key;slots=[];
    try{const sv=JSON.parse(store('gura-rummi-rack')||'null');if(sv&&sv.k===key&&Array.isArray(sv.s))slots=sv.s.map(x=>Number.isInteger(x)?x:-1)}catch(e){}
    if(!slots.some(x=>rk.includes(x)))slots=rk.slice().sort((a,b)=>isJ(a)-isJ(b)||colOf(a)-colOf(b)||numOf(a)-numOf(b));   // 처음 한 번만 색·숫자 순
  }
  const have=new Set(rk),seen=new Set();
  slots=slots.map(x=>have.has(x)&&!seen.has(x)?(seen.add(x),x):-1);
  for(const id of rk)if(!seen.has(id)){
    let k=want[id];if(!(k>=0&&k<slots.length&&slots[k]<0))k=slots.indexOf(-1);
    if(k<0)k=slots.length;while(slots.length<=k)slots.push(-1);slots[k]=id;
  }
  want={};
  const P=Math.max(LAY.RK,Math.ceil(rk.length/2));
  while(slots.length<2*P)slots.push(-1);
  for(let i=slots.length-1;i>=0&&slots.length>2*P;i--)if(slots[i]<0)slots.splice(i,1);
  saveRack();
}
/* 왼쪽부터 놓인 타일들이 묶음으로 이어질 수 있는지 (2개 이하도 봄): 같은 숫자·다른 색 4개까지, 또는 같은 색으로 1씩 커짐 */
function fits(a){
  const n=a.length,L=a.filter(x=>!isJ(x));if(!L.length)return n<=13;
  const v=numOf(L[0]);
  if(n<=4&&L.every(x=>numOf(x)===v)&&new Set(L.map(colOf)).size===L.length)return true;
  const c=colOf(L[0]),i0=a.findIndex(x=>!isJ(x)),st=numOf(a[i0])-i0;
  return st>=1&&st+n-1<=13&&a.every((x,i)=>isJ(x)||(colOf(x)===c&&numOf(x)===st+i));
}
/* 고르기·놓기 */
const onTable=id=>GV.indexOf(id)>=0;
function canTake(id){   // 탁자 타일을 옮길 수 있는지
  if(!myTurnNow())return false;
  return !meldNeed(myIdx())||CS.put.includes(id);
}
function toggle(id,inRack){
  const k=sel.indexOf(id);
  if(k>=0){sel.splice(k,1);sndPick(.06);redraw();return true}
  if(!inRack&&!canTake(id)){sndNo();return false}
  sel.push(id);sndPick(.12);redraw();return true;
}
/* 고른 타일 ids를 h(칸 또는 받침대 자리)에 놓을 수 있으면 {kind,to,back}. k = 그 자리에 올 타일이 ids 중 몇 번째인지 */
function planAt(h,k,ids){
  const n=ids.length;if(!n||!h)return null;
  if(h.kind==='cell'){
    if(!myTurnNow())return null;
    const to=h.k-k,row=h.k/W|0;
    if(to<row*W||to+n>(row+1)*W)return null;
    for(let j=0;j<n;j++){const x=GV[to+j];if(x>=0&&!ids.includes(x))return null}
    if(ids.some(id=>onTable(id)?!canTake(id):!slots.includes(id)))return null;
    if(ids.every((id,j)=>GV[to+j]===id))return null;
    return {kind:'cell',to,back:[]};
  }
  const P=perTier(),tier=h.k/P|0,to=h.k-k;
  if(!P||to<tier*P||to+n>(tier+1)*P)return null;
  const back=ids.filter(onTable);
  if(back.length&&(!myTurnNow()||back.some(id=>!CS.put.includes(id))))return null;
  /* 그 줄에서 옮기는 타일을 뺀 뒤, 놓을 자리에 있던 타일은 오른쪽으로(자리가 없으면 왼쪽으로) 한 칸씩 밀림 */
  const base=tier*P,row=slots.slice(base,base+P).map(x=>ids.includes(x)?-1:x),a=to-base;
  const push=dir=>{
    const out=new Array(P).fill(-1);
    if(dir>0){for(let i=0;i<a;i++)out[i]=row[i];let c=a+n;for(let i=a;i<P;i++)if(row[i]>=0){const q=Math.max(i,c);if(q>=P)return null;out[q]=row[i];c=q+1}}
    else{for(let i=a+n;i<P;i++)out[i]=row[i];let c=a-1;for(let i=a+n-1;i>=0;i--)if(row[i]>=0){const q=Math.min(i,c);if(q<0)return null;out[q]=row[i];c=q-1}}
    return out;
  };
  const out=push(1)||push(-1);if(!out)return null;
  return {kind:'slot',to,back,tier,row:out};
}
function placeAt(h,k){
  const ids=sel.slice(),pl=planAt(h,k,ids);
  if(!pl){sndNo();redraw();return false}
  sel=[];
  if(pl.kind==='cell')sendAct({t:'mv',ids,to:pl.to});
  else{
    const P=perTier();
    ids.forEach(id=>{const i=slots.indexOf(id);if(i>=0)slots[i]=-1});
    pl.row.forEach((x,i)=>{slots[pl.tier*P+i]=x});
    ids.forEach((id,j)=>{if(onTable(id))want[id]=pl.to+j;else slots[pl.to+j]=id});
    saveRack();if(pl.back.length)sendAct({t:'back',ids:pl.back});
  }
  sndPut();redraw();return true;
}
function tap(h){
  if(!h||!CS||V.st!=='play'||introWait())return;
  if(h.id>=0)toggle(h.id,h.kind==='slot');
  else if(sel.length)placeAt(h,0);
}
function redraw(){armAt=0;drawAll();G.buttons();P3.dirty=true;d3Sync()}

/* 이름 칸: 자리 색 점 · 이름 · 타일 수 · (차례면) 남은 시간 줄 */
function chipHTML(i){
  const me=myIdx(),p=V.ps[i];if(!p||i>=CS.n.length)return '';
  const on=introWait()?(IN.fp?IN.fp.idx(clock())===i:false):V.st==='play'&&V.t===i&&!p.f;
  const st=p.sr===3?'탈주':p.sr?'항복':V.st==='over'?(p.f===1?'승리':CS.fin&&CS.fin.pts?CS.fin.pts[i]+'점':''):'';
  return `<div class="rm-p${on?' on':''}${i===me?' me':''}${p.sr?' out':''}" style="--pc:${SEAT_C[i]}"><i class="dot"></i><b>${esc(p.n)}</b><span class="n">${CS.n[i]}</span>${st?`<span class="st">${st}</span>`:''}${on&&V.st==='play'?'<span class="tb"><i></i></span>':''}</div>`;
}
function barHTML(){const n=CS.n.length,b=seated()?myIdx():0;return Array.from({length:n},(_,k)=>chipHTML((b+k)%n)).join('')+`<div class="rm-pool">남은 패 <b>${CS.pool}</b></div>`}
function hintText(){
  if(!V||!CS)return '';
  if(V.st==='over'){const f=CS.fin;return f&&f.w>=0?`${nm(f.w)} 승리${f.why==='pts'?' (남은 타일 합)':''}`:'게임이 끝났습니다.'}
  if(myTurnNow()&&meldNeed(myIdx())&&CS.put.length)return `첫 등록 ${tableState(GV,CS.put,true).pts} / ${MELD}`;
  return '';
}
/* WebGL이 없을 때: 칸판과 받침대를 2D 칸으로 (누르기만) */
function tile2d(id,cls,attr){return `<i ${attr} class="t${id>=0?' c'+(isJ(id)?(id===JK?1:0):colOf(id)):' e'}${cls}">${id<0?'':isJ(id)?'★':numOf(id)}</i>`}
function board2dHTML(){
  const bad=badCells(),h=[];
  h.push('<div class="rm-g">');
  for(let c=0;c<CELLS;c++){const id=GV[c];h.push(tile2d(id,(id>=0&&CS.put.includes(id)?' put':'')+(sel.includes(id)?' sel':'')+(bad.has(c)?' bad':''),`data-c="${c}"`))}
  h.push('</div>');
  if(slots.length){h.push(`<div class="rm-g rk" style="--rp:${perTier()}">`);slots.forEach((id,k)=>h.push(tile2d(id,sel.includes(id)?' sel':'',`data-s="${k}"`)));h.push('</div>')}
  return h.join('');
}
function badCells(){
  const out=new Set();if(!CS||V.st!=='play')return out;
  const st=tableState(GV,CS.put,meldNeed(CS.cur));
  for(const r of runsOf(GV))if(st.bad.includes(r.at))for(let j=0;j<r.ids.length;j++)out.add(r.at+j);
  return out;
}
function drawAll(){
  if(!CS||!elRm)return;
  const top=barHTML();if(top!==lastBar){elBar.innerHTML=top;lastBar=top;P3.lay=''}
  const h=hintText();if(h!==lastHint){elHint.textContent=h;lastHint=h}
  if(!P3.on){const b=board2dHTML();if(b!==last2d){elBd.innerHTML=b;last2d=b}}
}

/* ---------- 3D ---------- */
const GEO={},MAT={},FACE={};
function faceMat(id){
  const key=isJ(id)?id:id%52;
  return FACE[key]||(FACE[key]=toon({map:canvasTex(128,182,(g,w,h)=>drawFace(g,w,h,id,0)),rim:0}));
}
function roundGeo(w,d,r){
  const sh=new THREE.Shape(),x=w/2,y=d/2;
  sh.moveTo(-x+r,-y);sh.lineTo(x-r,-y);sh.quadraticCurveTo(x,-y,x,-y+r);sh.lineTo(x,y-r);sh.quadraticCurveTo(x,y,x-r,y);sh.lineTo(-x+r,y);sh.quadraticCurveTo(-x,y,-x,y-r);sh.lineTo(-x,-y+r);sh.quadraticCurveTo(-x,-y,-x+r,-y);
  const g=new THREE.ShapeGeometry(sh,6);g.rotateX(-Math.PI/2);return g;
}
function flatMesh(mat,w,d,y,ro){const m=new THREE.Mesh(GEO.flat,mat);m.scale.set(w,1,d);m.position.y=y;m.renderOrder=ro||2;return m}
function backTile(){const m=new THREE.Mesh(GEO.box,MAT.side);m.position.y=LAY.TT/2;m.castShadow=true;const g=new THREE.Group();g.add(m);return g}
function d3Build(){
  if(P3.built||P3.fail)return P3.built;
  if(!T.ok||typeof THREE==='undefined'){P3.fail=true;return false}
  try{
    const root=new THREE.Group();root.visible=false;root.scale.setScalar(SC);root.position.set(0,ROOT_Y,-ZC*SC);
    GEO.box=new THREE.BoxGeometry(LAY.TW,LAY.TT,LAY.TH);GEO.flat=new THREE.PlaneGeometry(1,1);GEO.flat.rotateX(-Math.PI/2);GEO.put=roundGeo(LAY.TW+.12,LAY.TH+.14,.17);
    MAT.side=toon({color:0xe2d6b8,rim:.06});
    P3.feltTex=canvasTex(8,8,(g,w,h)=>{g.fillStyle='#2f6b4a';g.fillRect(0,0,w,h)});
    MAT.put=new THREE.MeshBasicMaterial({color:0xf2b632,transparent:true,opacity:.95,depthWrite:false});
    MAT.bad=new THREE.MeshBasicMaterial({color:0xe5352b,transparent:true,opacity:.95,depthWrite:false});
    const bg=new THREE.Group();root.add(bg);P3.boardG=bg;
    /* 받침대: 타일과 같은 기울기의 비탈 하나에 턱 둘(두 줄). 옆모습을 그려 가로로 늘림. 앞 끝(비탈 아래)이 z=0, 뒤로 갈수록 높아짐 */
    P3.wood=toon({color:0x9a6a3c,rim:.08});
    {const S=u=>[-RCOS*u,RKY+RSIN*u],N=(q,d)=>[q[0]+RSIN*d,q[1]+RCOS*d],top=S(RLEN),u1=LAY.TH+.04,sh=new THREE.Shape();
     const pts=[[top[0],0],top,S(u1+.06),N(S(u1+.06),.3),N(S(u1),.3),S(u1),S(0),N(S(0),.32),[RSIN*.32+.08,0]];
     pts.forEach((q,i)=>i?sh.lineTo(q[0],q[1]):sh.moveTo(q[0],q[1]));sh.closePath();
     const g=new THREE.ExtrudeGeometry(sh,{depth:1,bevelEnabled:false});g.rotateY(-Math.PI/2);g.translate(.5,0,0);GEO.rack=g}
    const rb=new THREE.Mesh(GEO.rack,P3.wood);rb.scale.x=BOARD.w+.3;rb.position.set(0,0,RZN);rb.castShadow=true;rb.receiveShadow=true;P3.rackG=rb;bg.add(rb);
    /* 펠트 위 표시: 이번 차례에 낸 타일(노란 바탕), 맞지 않는 줄(빨간 테두리). 타일을 따라다니지 않고 칸 자리에 놓임. 모서리는 타일처럼 둥글게 */
    P3.puts=[];P3.badGeo={};
    /* 끄는 동안 놓일 자리 그림자 */
    MAT.spot=new THREE.MeshBasicMaterial({color:0x10200f,transparent:true,opacity:.3,depthWrite:false});
    MAT.spotNo=new THREE.MeshBasicMaterial({color:0xe5352b,transparent:true,opacity:.4,depthWrite:false});
    P3.spots=[];P3.sg=new THREE.Group();root.add(P3.sg);
    P3.pg=new THREE.Group();root.add(P3.pg);
    P3.og=new THREE.Group();root.add(P3.og);
    P3.mg=new THREE.Group();root.add(P3.mg);
    P3.cam=new THREE.PerspectiveCamera(16,1,.5,200);   // 화각을 좁혀 먼 줄과 가까운 줄의 크기 차이를 줄임
    T.scene.add(root);P3.root=root;P3.built=true;
  }catch(e){P3.fail=true;try{console.warn('루미큐브 3D 준비 실패',e)}catch(_){}}
  return P3.built;
}
function tileObj(id){
  let o=P3.tiles.get(id);if(o)return o;
  const g=new THREE.Group(),m=new THREE.Mesh(GEO.box,[MAT.side,MAT.side,faceMat(id),MAT.side,MAT.side,MAT.side]);
  m.position.y=LAY.TT/2;m.castShadow=true;g.add(m);
  o={id,g,cur:null,from:null,to:null,t0:0};P3.pg.add(g);P3.tiles.set(id,o);return o;
}
function applyPose(o,p){o.g.position.set(p.x,p.y,p.z);o.g.rotation.x=p.rx;o.g.scale.setScalar(p.s);o.cur=p}
/* 고른 타일: 탁자에서는 위로 뜨고, 받침대에서는 비탈을 따라 올라오며 앞으로 나옴 (밑 테두리 없음) */
function poseOf(id){
  const on=sel.includes(id),c=GV.indexOf(id);
  if(c>=0){const q=cellXZ(c);return {x:q.x+(P3.dx?P3.dx[c]:0),y:on?.62:0,z:q.z,rx:0,s:1}}
  const k=slots.indexOf(id);if(k<0)return null;
  const q=slotXZ(k),up=on?.4*q.s:0,out=on?.24:0;
  return {x:q.x,y:q.y+RSIN*up+RCOS*out,z:q.z-RCOS*up+RSIN*out,rx:TILT,s:q.s};
}
const samePose=(a,b)=>a&&b&&a.x===b.x&&a.y===b.y&&a.z===b.z&&a.rx===b.rx&&a.s===b.s;
function d3Sync(){
  if(!P3.on||!CS)return;
  const now=clock(),need=new Set();
  /* 붙어 있는 묶음: 경계가 보이게 묶음마다 가운데로 살짝 모음 (칸 자리는 그대로) */
  const dx=P3.dx||(P3.dx=new Float32Array(CELLS));dx.fill(0);
  if(V.st==='play')for(const r of runsOf(GV)){
    const sp=splitRun(r.ids,CS.put,meldNeed(CS.cur));if(!sp||sp.cuts.length<2)continue;
    sp.cuts.forEach((a,i)=>{const b=i+1<sp.cuts.length?sp.cuts[i+1]:r.ids.length,m=(a+b-1)/2;for(let t=a;t<b;t++)dx[r.at+t]=(m-t)*LAY.CW*.05});
  }
  GV.forEach(id=>{if(id>=0)need.add(id)});slots.forEach(id=>{if(id>=0)need.add(id)});
  for(const [id,o] of P3.tiles)if(!need.has(id)){P3.pg.remove(o.g);P3.tiles.delete(id)}
  for(const id of need){
    const fresh=!P3.tiles.has(id),o=tileObj(id),p=poseOf(id);if(!p)continue;
    if(DR&&DR.ids.includes(id)){o.to=p;continue}
    if(fresh||!o.cur){   // 새 타일: 받침대는 위에서 내려앉고, 탁자는 그 자리에
      applyPose(o,p);o.to=p;o.from=null;if(IN.on3d&&slots.includes(id))o.g.visible=false;
      if(!IN.on3d&&slots.includes(id)&&P3.seen){o.from={...p,y:p.y+1.4};o.t0=now;applyPose(o,o.from)}
      else if(!IN.on3d&&P3.seen&&GV.indexOf(id)>=0&&CS.cur!==myIdx()&&P3.oppPos&&P3.oppPos[CS.cur]){   // 남이 낸 타일: 그 사람 받침대에서 날아옴
        const q=P3.oppPos[CS.cur];o.from={x:q.x,y:1.3,z:q.z,rx:0,s:.85};o.t0=now;o.dur=430;applyPose(o,o.from)}
    }else if(!samePose(o.to,p)){o.from={...o.cur};o.to=p;o.t0=now;o.dur=0}
  }
  P3.seen=true;
  d3Opp();d3Marks();P3.dirty=true;
}
/* 펠트: 게임에 들어오면 점선 없는 천으로 바꾸고 탁자 끝 가까이까지 커짐(칸판 귀퉁이까지 천 위). 나가면 되돌림 */
const FELT_R0=3.15,FELT_R1=4.5,FELT_MS=900;
const FE={on:false,t0:0,r:FELT_R0};
function feltSize(r){FE.r=r;const k=r/FELT_R0;T.felt.mat.scale.set(k,1,k);if(T.felt.ink)T.felt.ink.scale.set(k,k,1)}
function useFelt(on,slow){
  if(!T.ok||!T.felt||!P3.feltTex)return;
  const m=T.felt.mat.material[1],want=on?P3.feltTex:T.felt.tex;
  if(m.map!==want){m.map=want;m.needsUpdate=true}
  if(on&&!FE.on){FE.on=true;FE.t0=clock();feltSize(slow?FELT_R0:FELT_R1)}
  else if(!on&&FE.on){FE.on=false;feltSize(FELT_R0)}
  P3.dirty=true;
}
function feltFrame(now){
  if(!FE.on||FE.r>=FELT_R1)return false;
  feltSize(FELT_R0+(FELT_R1-FELT_R0)*ease((now-FE.t0)/FELT_MS));return true;
}
/* 끄는 동안: 손을 떼면 놓일 칸에 그림자(못 놓는 곳은 붉게) */
function d3Spots(){
  if(!P3.sg)return;
  let n=0;
  if(DR&&DR.h){
    const ids=DR.ids,pl=planAt(DR.h,DR.k,ids),P=perTier(),slot=DR.h.kind==='slot',per=slot?P:W;
    let to=pl?pl.to:DR.h.k-DR.k;const lo=(DR.h.k/per|0)*per;to=Math.max(lo,Math.min(lo+per-ids.length,to));
    for(let j=0;j<ids.length&&per>=ids.length;j++){
      const m=P3.spots[n]||(P3.spots[n]=flatMesh(MAT.spot,1,1,.004,1));if(!m.parent)P3.sg.add(m);n++;
      m.material=pl?MAT.spot:MAT.spotNo;m.visible=true;m.rotation.x=0;
      if(slot){const q=slotXZ(to+j);m.scale.set(LAY.TW*q.s,1,LAY.TH*q.s);m.rotation.x=TILT;m.position.set(q.x,q.y+RCOS*(LAY.TT+.02),q.z+RSIN*(LAY.TT+.02))}
      else{const q=cellXZ(to+j);m.scale.set(LAY.TW,1,LAY.TH);m.position.set(q.x,.004,q.z)}
    }
  }
  for(;n<P3.spots.length;n++)P3.spots[n].visible=false;
}
/* 다른 사람 받침대(뒷면): 내 다음 사람부터 왼쪽 → 위 → 오른쪽. 2명은 위 */
function d3Opp(){
  const n=CS.n.length,b=seated()?myIdx():0,key=[n,b,seated()?1:0,CS.n.join()].join('/');
  if(key===P3.oppKey)return;P3.oppKey=key;
  while(P3.og.children.length)P3.og.remove(P3.og.children[0]);
  P3.oppPos={};
  const place=n===2?[null,'t']:n===3?[null,'l','r']:[null,'l','t','r'];
  const zl=.8;   // 묶음 안에서 받침대 앞 끝(바깥쪽) 자리
  for(let k=seated()?1:0;k<n;k++){
    const i=(b+k)%n,cnt=CS.n[i],side=place[k]||'b',g=new THREE.Group();
    const per=cnt<=LAY.RK?Math.max(1,cnt):Math.ceil(cnt/2),sc=Math.min(1,LAY.RK/per);
    for(let j=0;j<cnt;j++){
      const tier=j<per?1:0,col=tier?j:j-per,u=rowU(tier),t=backTile();
      t.scale.setScalar(sc);t.rotation.x=TILT;t.position.set((col-(per-1)/2)*LAY.CW*sc,RKY+RSIN*u,zl-RCOS*u);g.add(t);
    }
    const base=new THREE.Mesh(GEO.rack,P3.wood);base.scale.x=BOARD.w+.3;base.position.z=zl;base.castShadow=true;g.add(base);
    const back=zl-RCOS*RLEN;   // 받침대 뒤(가운데 쪽) 끝
    if(side==='t'){g.rotation.y=Math.PI;g.position.set(0,0,REGION.z0-.6+back)}
    else if(side==='b')g.position.set(0,0,RZN-zl)
    else{g.rotation.y=side==='l'?-Math.PI/2:Math.PI/2;g.position.set((side==='l'?-1:1)*(BOARD.w/2+.6-back),0,0)}
    P3.oppPos[i]={x:g.position.x,z:g.position.z};P3.og.add(g);
  }
  P3.rackG.visible=seated();
}
/* 펠트 위 표시: 이번 차례에 낸 타일 자리(타일이 내려앉은 뒤), 맞지 않는 줄 */
function d3Marks(){
  if(!P3.on||!CS)return;
  let k=0,n=0;
  if(V.st==='play'&&!introWait()){
    for(const id of CS.put){
      const c=GV.indexOf(id),o=P3.tiles.get(id);if(c<0||!o||o.from||(DR&&DR.ids.includes(id)))continue;
      const m=P3.puts[n]||(P3.puts[n]=new THREE.Mesh(GEO.put,MAT.put));if(!m.parent){m.renderOrder=2;P3.mg.add(m)}n++;
      const q=cellXZ(c);m.visible=true;m.position.set(q.x+(P3.dx?P3.dx[c]:0),.006,q.z);
    }
    const st=tableState(GV,CS.put,meldNeed(CS.cur));
    for(const r of runsOf(GV)){
      if(!st.bad.includes(r.at))continue;
      const L=r.ids.length,geo=P3.badGeo[L]||(P3.badGeo[L]=roundGeo((L-1)*LAY.CW+LAY.TW+.3,LAY.TH+.3,.24));
      let m=P3.bad[k];if(!m){m=P3.bad[k]=new THREE.Mesh(geo,MAT.bad);m.renderOrder=1;P3.mg.add(m)}k++;
      if(m.geometry!==geo)m.geometry=geo;
      const a=cellXZ(r.at),b=cellXZ(r.at+L-1);
      m.visible=true;m.position.set((a.x+b.x)/2,.003,a.z);
    }
  }
  for(;k<P3.bad.length;k++)P3.bad[k].visible=false;
  for(;n<P3.puts.length;n++)P3.puts[n].visible=false;
  P3.dirty=true;
}
/* 카메라: 칸판 + 내 받침대가 이름 칸 아래, 버튼 위에 꽉 차게 */
function d3Layout(t){
  if(t-P3.layAt<100&&P3.lay)return false;
  P3.layAt=t;
  const st=$('#stage'),Wd=st.clientWidth,Hh=st.clientHeight;if(!Wd||!Hh||!CS)return false;
  const narrow=Wd<700,top=elBar.offsetTop+elBar.offsetHeight+8,bot=narrow?78:16,m=narrow?6:16,key=[Wd,Hh,top].join(',');
  if(key===P3.lay)return false;
  P3.lay=key;
  const fw=Wd-2*m,fh=Math.max(60,Hh-top-bot),cam=P3.cam,hw=BOARD.w/2+.2,hy=RKY+RSIN*RLEN+.1,zt=RZN-RCOS*RLEN;
  const pts=[[-hw,0,REGION.z0-.1],[hw,0,REGION.z0-.1],[-hw,0,REGION.z1],[hw,0,REGION.z1],[-hw,hy,zt],[hw,hy,zt]];
  const v=new THREE.Vector3();
  let d=P3.d||12,cy=0;
  cam.aspect=Wd/Hh;cam.clearViewOffset();
  for(let it=0;it<4;it++){
    cam.position.set(0,ROOT_Y+d*Math.cos(CAMA),d*Math.sin(CAMA));cam.lookAt(0,ROOT_Y,0);cam.updateProjectionMatrix();cam.updateMatrixWorld();
    let x0=9,x1=-9,y0=9,y1=-9;
    for(const q of pts){v.set(q[0]*SC,ROOT_Y+q[1]*SC,(q[2]-ZC)*SC).project(cam);x0=Math.min(x0,v.x);x1=Math.max(x1,v.x);y0=Math.min(y0,v.y);y1=Math.max(y1,v.y)}
    const r=Math.max((x1-x0)/2*Wd/fw,(y1-y0)/2*Hh/fh);
    cy=-(y0+y1)/2*Hh/2;
    if(Math.abs(r-1)<.002)break;
    d*=r;
  }
  cam.setViewOffset(Wd,Hh,0,cy-((top+fh/2)-Hh/2),Wd,Hh);cam.updateProjectionMatrix();cam.updateMatrixWorld();
  P3.d=d;P3.dirty=true;
  return true;
}
function d3Step(now){
  let busy=false;
  for(const o of P3.tiles.values()){
    if(DR&&DR.ids.includes(o.id)){const j=DR.ids.indexOf(o.id);applyPose(o,{x:DR.x+(j-DR.k)*LAY.CW,y:1.1,z:DR.z,rx:0,s:1});busy=true;continue}
    if(!o.from||!o.to)continue;
    const k=Math.min(1,(now-o.t0)/(o.dur||MOVE_MS)),e=ease(k),a=o.from,b=o.to,far=Math.hypot(b.x-a.x,b.z-a.z)>.5?.5:0;busy=true;
    applyPose(o,{x:a.x+(b.x-a.x)*e,y:a.y+(b.y-a.y)*e+Math.sin(Math.PI*k)*far,z:a.z+(b.z-a.z)*e,rx:a.rx+(b.rx-a.rx)*e,s:a.s+(b.s-a.s)*e});
    if(k>=1){applyPose(o,b);o.from=null;P3.markAt=1}
  }
  if(P3.markAt&&!busy){P3.markAt=0;d3Marks()}
  return busy;
}
function d3Render(t){
  if(!P3.on||!T.ok)return;
  if(d3Layout(t))P3.dirty=true;
  const busy=d3Step(t)|feltFrame(t),intro=IN.on3d&&introStep(t);d3Spots();
  if(!busy&&!intro&&!P3.dirty&&t-P3.lastR<400)return;
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
   로비 카메라 → 탑뷰. 깔개가 내려앉고 내 받침대에 타일이 하나씩 놓임 → 첫 차례 주사위. 바로 시작은 깔개를 다시 차리지 않고 타일만 */
const INTRO={cam:1100,ui:650,mat:[100,400],tile:[650,55],dur:300,dice:1750};
const AGAIN={tile:[150,40],dice:1000};
const DIE=1.6;
G.introMs=(again,rolls)=>Math.round((again?AGAIN.dice:INTRO.dice)+DicePick.totalFor(again?-1:rolls)+100);
const IN={on:false,on3d:false,t0:0,total:0,r:0,again:false,fromLobby:true,said:false,fp:null,die:null,snd:{}};
const introOn=()=>IN.on&&clock()<IN.t0+IN.total;
const introWait=()=>introOn()&&!IN.said;
const tileAt=i=>{const A=IN.again?AGAIN:INTRO;return A.tile[0]+i*A.tile[1]};
G.intro=(t0,o)=>{
  if(!CS||CS!==V.o)G.preView();   // 공통 코드가 화면 상태를 잡기 전에 부를 수 있음
  if(!V||!V.ps||!CS)return;
  IN.again=!!(o&&o.again)&&P3.on;
  const rolls=IN.again?-1:o&&o.rolls,seed=(o&&o.seed)||1,cnt=CS.n.length;
  IN.on=true;IN.t0=t0;IN.said=false;IN.snd={};IN.fromLobby=!P3.on;IN.on3d=true;
  IN.r=IN.again?AGAIN.dice:INTRO.dice;IN.total=(o&&o.total)||G.introMs(IN.again,rolls);
  if(IN.die){IN.die.dispose();IN.die=null}
  IN.fp=firstPick(t0+IN.r,{seats:Array.from({length:cnt},(_,k)=>k),first:CS.first,rolls,seed});
  $('#stage').classList.add('rm-intro');if(elRm&&IN.fromLobby)elRm.classList.add('intro');
  if(IN.fromLobby&&FE.on){FE.t0=t0+INTRO.mat[0];feltSize(FELT_R0)}
  lastBar='';P3.dirty=true;
};
function introStep(now,force){
  if(!P3.built||!CS)return false;
  const e=now-IN.t0,done=force||e>=IN.total,fl=IN.fromLobby;
  if(done)IN.on3d=false;
  {const x=done||!fl?1:(e-INTRO.mat[0])/INTRO.mat[1];P3.boardG.visible=x>0;P3.boardG.position.y=dropY(Math.max(0,x),4);P3.og.visible=done||!fl||e>INTRO.mat[0]+INTRO.mat[1]}
  let i=0;
  for(const id of slots){if(id<0)continue;const o=P3.tiles.get(id);if(!o||!o.to){i++;continue}
    const x=done?1:(e-tileAt(i))/INTRO.dur;o.g.visible=x>0;applyPose(o,{...o.to,y:o.to.y+dropY(Math.max(0,Math.min(1,x)),2.4)});i++}
  if(IN.fp&&!IN.fp.fixed){
    if(!IN.die&&!done&&P3.root){IN.die=DicePick.mesh(THREE,CS.n.length,SEAT_C.slice(0,CS.n.length));P3.root.add(IN.die.g)}
    if(IN.die)IN.die.apply(done||e<IN.r?null:IN.fp.pose(now),DIE,0,.05,0);
  }
  if(done){for(const o of P3.tiles.values())o.g.visible=true;if(IN.die){IN.die.dispose();IN.die=null}d3Marks()}
  return true;
}
function introEnd(){
  if(IN.on3d)introStep(clock(),true);
  if(IN.die){IN.die.dispose();IN.die=null}
  IN.on=false;IN.on3d=false;IN.said=true;
  $('#stage').classList.remove('rm-intro');if(elRm)elRm.classList.remove('intro');
}
function introTick(){
  if(!IN.on)return;
  const e=clock()-IN.t0,S_=IN.snd,once=(k,f)=>{if(!S_[k]){S_[k]=1;f()}};
  if(e>=INTRO.ui&&elRm&&elRm.classList.contains('intro'))elRm.classList.remove('intro');
  if(IN.on3d&&P3.on&&CS){
    if(IN.fromLobby&&e>=INTRO.mat[0]+INTRO.mat[1]*.68)once('thud',()=>{tone(120,.13,{type:'triangle',vol:.2});hiss(.09,{freq:650,vol:.12})});
    const n=slots.filter(x=>x>=0).length;for(let i=0;i<n;i+=2)if(e>=tileAt(i)+INTRO.dur*.68)once('t'+i,()=>sndPut(0));
  }
  if(IN.fp&&e>=IN.r&&IN.fp.tick(IN.t0+e)){
    IN.said=true;$('#stage').classList.remove('rm-intro');if(elRm)elRm.classList.remove('intro');
    fxSay(IN.fp.msg(),SEAT_C[IN.fp.first]);
    lastBar='';redraw();
  }
  if(e>=IN.total){IN.on=false;lastBar='';lastHint='';G.buttons();if(P3.on)d3Marks()}
  drawAll();
}
/* ---------- 누르기·끌기 ---------- */
function rayAt(e){   // 누른 곳으로 가는 빛줄기 (판 단위)
  const r=T.r.domElement.getBoundingClientRect();if(!r.width||!P3.cam)return null;
  const ray=P3.ray||(P3.ray=new THREE.Raycaster());
  ray.setFromCamera({x:(e.clientX-r.left)/r.width*2-1,y:-(e.clientY-r.top)/r.height*2+1},P3.cam);
  const o=ray.ray.origin,d=ray.ray.direction;
  return {ox:o.x/SC,oy:(o.y-ROOT_Y)/SC,oz:o.z/SC+ZC,dx:d.x,dy:d.y,dz:d.z};
}
function localAt(e,y){
  const q=rayAt(e);if(!q||Math.abs(q.dy)<1e-6)return null;
  const k=(y-q.oy)/q.dy;return {x:q.ox+q.dx*k,z:q.oz+q.dz*k};
}
function pickAt(e){
  const P=perTier(),q=rayAt(e);if(!q)return null;
  if(P){   // 받침대 비탈(타일 두께 절반 위)과 만나는 점 → 비탈을 따라 올라간 길이 u
    const py=RKY+RCOS*LAY.TT/2,pz=RZN+RSIN*LAY.TT/2,den=q.dy*RCOS+q.dz*RSIN;
    if(Math.abs(den)>1e-6){
      const k=((py-q.oy)*RCOS+(pz-q.oz)*RSIN)/den,x=q.ox+q.dx*k,y=q.oy+q.dy*k,z=q.oz+q.dz*k,u=(y-py)*RSIN-(z-pz)*RCOS,sc=Math.min(1,LAY.RK/P);
      if(k>0&&u>=-.3&&u<=RLEN+.3&&Math.abs(x)<=BOARD.w/2+.3){
        const tier=u<LAY.TH+RGAP/2+.02?1:0,col=Math.min(P-1,Math.max(0,Math.floor(x/(LAY.CW*sc)+P/2))),s=tier*P+col;
        return {kind:'slot',k:s,id:slots[s]};
      }
    }
  }
  const p=localAt(e,LAY.TT/2);if(!p)return null;
  const c=Math.floor(p.x/LAY.CW+W/2),r=Math.floor(p.z/LAY.CH+RH/2);
  if(c<0||c>=W||r<0||r>=RH)return null;
  return {kind:'cell',k:r*W+c,id:GV[r*W+c]};
}
const tileAtH=(kind,k)=>kind==='slot'?(k>=0&&k<slots.length?slots[k]:-1):(k>=0&&k<CELLS?GV[k]:-1);
function stopLong(){if(PT&&PT.tm){clearTimeout(PT.tm);clearInterval(PT.tm);PT.tm=0}}
function ptDown(e){
  if(!P3.on||!V||!V.cfg||V.cfg.game!=='rummi'||!CS||V.st!=='play'||introWait()||(e.pointerType==='mouse'&&e.button!==0)||e.target.id!=='cv'||PT)return;
  const h=pickAt(e);
  PT={id:e.pointerId,x:e.clientX,y:e.clientY,h,moved:false,long:false,tm:0,next:h?h.k:0};
  if(h&&h.id>=0)PT.tm=setTimeout(()=>{   // 꾹 누르기: 이 타일부터 오른쪽으로 붙어 있는 타일을 하나씩
    if(!PT||PT.moved)return;
    PT.long=true;
    const down=sel.includes(h.id),chain=[];   // 올라와 있던 타일이면 내리기
    const step=()=>{
      if(!PT)return;
      const P=h.kind==='slot'?perTier():W,k=PT.next,id=tileAtH(h.kind,k);
      if(id<0||(k!==h.k&&k%P===0)){stopLong();return}
      if(down){if(!sel.includes(id)){stopLong();return}toggle(id,h.kind==='slot')}
      else{
        if(!fits([...chain,id])){stopLong();return}
        if(!sel.includes(id)&&!toggle(id,h.kind==='slot')){stopLong();return}
        chain.push(id);
      }
      PT.next=k+1;
    };
    step();if(PT)PT.tm=setInterval(step,LONG_STEP);
  },LONG_MS);
}
function ptMove(e){
  if(!PT||e.pointerId!==PT.id)return;
  if(!PT.moved){
    if(Math.hypot(e.clientX-PT.x,e.clientY-PT.y)<9)return;
    PT.moved=true;stopLong();
    const h=PT.h;if(!h||h.id<0)return;
    if(!sel.includes(h.id)){if(h.kind==='cell'&&!canTake(h.id)){sndNo();return}sel=[h.id]}
    DR={ids:sel.slice(),k:sel.indexOf(h.id),x:0,z:0,h:null};
    try{e.target.setPointerCapture(e.pointerId)}catch(_){}
    sndPick(.12);
  }
  if(!DR)return;
  const p=localAt(e,1.1);if(p){DR.x=p.x;DR.z=p.z}
  DR.h=pickAt(e);
  P3.dirty=true;e.preventDefault();
}
function ptUp(e){
  if(!PT||e.pointerId!==PT.id)return;
  const p=PT;stopLong();PT=null;
  if(DR){
    const k=DR.k;DR=null;P3.movedAt=clock();
    const h=e.type==='pointercancel'?null:pickAt(e);
    if(!h||!placeAt(h,k)){sel=[];redraw()}
    return;
  }
  if(p.moved||p.long||e.type==='pointercancel')return;
  if(p.h)tap(p.h);
  else if(sel.length){sel=[];sndPick(.06);redraw()}   // 판 밖을 누르면 고른 것을 모두 내림
}
function on2dClick(e){
  const t=e.target.closest('[data-c],[data-s]');if(!t||P3.on)return;
  const cell=t.dataset.c!=null;const k=+(cell?t.dataset.c:t.dataset.s);
  tap({kind:cell?'cell':'slot',k,id:cell?GV[k]:slots[k]});
}

/* ---------- 공통 코드가 부르는 것 ---------- */
G.preView=()=>{
  if(!V||!V.o||!V.o.g||!Array.isArray(V.o.n)){CS=null;return}
  CS=V.o;GV=new Array(CELLS).fill(-1);for(let i=0;i<CS.g.length;i+=2)GV[CS.g[i]]=CS.g[i+1];
  syncRack();
  const mine=myTurnNow()||(V.st==='play'&&V.t===myIdx());
  sel=sel.filter(id=>slots.includes(id)||(mine&&onTable(id)));
  if(V.st!=='play'){sel=[];DR=null}
  if(DR)DR.ids=DR.ids.filter(id=>sel.includes(id));
  if(DR&&!DR.ids.length)DR=null;
};
G.postView=()=>{};
G.overExtra=()=>'';
G.logCue=()=>false;
G.overDelay=()=>0;
G.cues=(v,pv)=>{
  const a=v.o&&v.o.ev,b=pv&&pv.o&&pv.o.ev;if(!a||!v.o.g||(b&&b.q===a.q)||!pv||!pv.o||pv.o.gn!==v.o.gn)return;
  if(a.k==='put')sndPut(0);
  else if(a.k==='pen'){sfx('no');fxSay(`${v.ps[a.s]?v.ps[a.s].n:''} 되돌림 +${a.n}`,SEAT_C[a.s])}
  else if(a.k==='draw')sndPick(.14);
};
G.hud=inGame=>{
  if(!elRm)return;
  const on=!!(inGame&&V&&CS);
  elRm.hidden=!on;
  $('#stage').classList.toggle('rm-over',!!(on&&V.st==='over'));
  const d3=on&&d3Build();
  if(d3!==P3.on){useFelt(d3,IN.on&&IN.fromLobby);P3.on=d3;P3.lay='';P3.seen=false;P3.oppKey='';if(P3.root)P3.root.visible=d3;$('#stage').classList.toggle('rm3d',d3);last2d='';lastHint=''}
  $('#stage').classList.toggle('rm2d',on&&!d3);
  if(!on){lastBar='';lastHint='';last2d='';return}
  drawAll();
  d3Sync();
};
G.handMarks=()=>{};
G.me=()=>{$('#numpick').hidden=true};
G.overRank=p=>{
  const t=p.sr===3?'탈주':p.sr?'항복':'';
  if(t)return `<span class="left">${t}</span>`;
  const i=V&&V.ps?V.ps.indexOf(p):-1,f=CS&&CS.fin;
  return f&&f.pts&&i>=0&&CS.all&&CS.all[i]?`<span class="left">남은 타일 ${CS.all[i].length}개 · ${f.pts[i]}점</span>`:'';
};
G.no3D=true;
let armAt=0;   // 틀린 채로 마치기를 한 번 누른 시각
const tableBad=()=>!!CS&&CS.put.length>0&&!tableState(GV,CS.put,meldNeed(myIdx())).ok;
G.buttons=()=>{
  const play=$('#btnPlay'),can=myTurnNow(),bad=can&&tableBad(),armed=bad&&clock()-armAt<2500;
  $('#btnPass').hidden=true;$('#btnGura').hidden=true;
  play.disabled=!can;play.classList.toggle('ready',can&&!!CS&&CS.put.length>0&&!bad);
  play.classList.toggle('rm-warn',bad);
  const lab=bad?(armed?'한 번 더':'되돌리기 +3'):!CS||(can&&CS.put.length)?'마치기':CS.pool>0?'뽑기':'넘기기';
  if($('#playMain').textContent!==lab)$('#playMain').textContent=lab;
  const sub=keyLabel(KEYS.play);if($('#playSub').textContent!==sub)$('#playSub').textContent=sub;
};
G.live=()=>{
  if(IN.on)introTick();
  if(!V||!CS)return;
  const bar=elRm&&elRm.querySelector('.rm-p.on .tb i');
  if(bar&&V.st==='play'){const left=Math.max(0,(V.deadAt-clock())/1000);bar.style.width=Math.min(100,left/(V.cfg.turn||90)*100)+'%'}
};
G.play=()=>{
  if(!myTurnNow())return;
  if(tableBad()&&!(clock()-armAt<2500)){armAt=clock();sndNo();G.buttons();setTimeout(()=>{if(V&&V.cfg&&V.cfg.game==='rummi')G.buttons()},2550);return}   // 틀린 탁자: 한 번 더 눌러야 되돌리고 3개
  armAt=0;sel=[];DR=null;sendAct({t:'end'});
};
G.pass=()=>{};
G.keyPhase=st=>st==='play';
G.onKey=()=>false;
G.field3D=()=>{if(T.stacks)for(const arr of T.stacks.values())arr.forEach(c=>{c.visible=false})};
G.render3D=t=>{if(P3.on)d3Render(t);else if(T.ok&&!$('#stage').classList.contains('rm2d'))T.r.render(T.scene,T.cam)};
G.enter=()=>{
  $('#stage').classList.add('rm');
  $('#btnPass').hidden=true;$('#btnGura').hidden=true;$('#numpick').hidden=true;
  sel=[];DR=null;PT=null;
};
G.leave=()=>{
  introEnd();stopLong();PT=null;DR=null;sel=[];
  $('#stage').classList.remove('rm','rm-over','rm3d','rm2d');$('#btnPlay').classList.remove('rm-warn');
  if(T.stacks)for(const arr of T.stacks.values())arr.forEach(c=>{c.visible=true});
  useFelt(false);if(P3.root)P3.root.visible=false;P3.on=false;
  for(const o of P3.tiles.values())if(P3.pg)P3.pg.remove(o.g);P3.tiles.clear();P3.seen=false;P3.oppKey='';
  $('#btnPass').hidden=false;
  if(elRm){elRm.hidden=true;lastBar='';lastHint='';last2d=''}
};
/* 대기실 홀로그램의 대표 말: 세운 타일 셋 */
G.holoPiece=mkM=>{
  const g=new THREE.Group();
  [0xd2362b,0x2563c4,0xe3891b].forEach((c,i)=>{
    const t=new THREE.Mesh(new THREE.BoxGeometry(.2,.28,.05),mkM(0xf6eeda));t.position.set((i-1)*.23,0,0);g.add(t);
    const d=new THREE.Mesh(new THREE.BoxGeometry(.09,.13,.02),mkM(c));d.position.set((i-1)*.23,.02,.035);g.add(d)});
  g.rotation.set(-.25,.3,0);return g;
};
G.init=()=>{
  const css=document.createElement('style');
  css.textContent=`
.stage.rm{background:radial-gradient(ellipse at 50% 38%,#f3e4c2 0%,#e2c89a 70%,#d3b27c 100%)}
.stage.rm.rm2d #cv,.stage.rm #dim{visibility:hidden}
.stage.rm3d #cv{touch-action:none}
.stage.rm-intro .actions,.stage.rm-intro .myplate,.stage.rm-intro #rm .rm-row{opacity:0;pointer-events:none}
.stage.rm .actions,.stage.rm .myplate,#rm .rm-row,#rm .rm-bar{transition:opacity .35s}
#rm.intro .rm-bar{opacity:0}
.stage.rm .labels{visibility:hidden}
.stage.rm .nogl{display:none}
.stage.rm.rm-over .myplate,.stage.rm.rm-over .actions{display:none}
.stage.rm .actions{left:auto}
.stage.rm #btnPlay.rm-warn{background:#d2362b;border-color:#8d1f18;color:#fff;box-shadow:0 4px 0 #8d1f18}
.stage.rm #btnPlay.rm-warn small{color:#ffe1dc}
.stage.rm .myplate{max-width:calc(100% - 150px)}
#rm{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 8px 82px;pointer-events:none;min-height:0}
#rm[hidden]{display:none}
#rm .rm-bar{display:flex;flex-wrap:wrap;justify-content:center;align-items:flex-start;gap:5px;max-width:calc(100% - 100px);pointer-events:none}
.specbar:not([hidden])~#rm .rm-bar{margin-top:30px}
#rm .rm-p,#rm .rm-pool{position:relative;display:flex;align-items:center;gap:5px;padding:3px 9px 5px;border-radius:12px;background:rgba(255,250,240,.92);border:1.5px solid var(--line-strong,#cdb391);font-size:13px;line-height:1.15;overflow:hidden;white-space:nowrap;max-width:100%}
#rm .rm-pool{color:#5b4129}
#rm .rm-p .dot{width:11px;height:11px;border-radius:2px;background:var(--pc);box-shadow:0 0 0 1.5px rgba(59,42,31,.5);flex:none}
#rm .rm-p b{font-weight:600;overflow:hidden;text-overflow:ellipsis;max-width:7em}
#rm .rm-p .n{font-family:var(--f-num,monospace);font-weight:700;background:#f6eeda;border:1px solid #cdb391;border-radius:4px;padding:0 4px;min-width:1.5em;text-align:center}
#rm .rm-p .st{font-size:12px;color:var(--muted,#7a6550)}
#rm .rm-p.on{border-color:var(--pc);box-shadow:0 0 0 2px var(--pc)}
#rm .rm-p.me b{text-decoration:underline;text-underline-offset:2px}
#rm .rm-p.out{opacity:.55}
#rm .rm-p .tb{position:absolute;left:0;right:0;bottom:0;height:3px;background:rgba(0,0,0,.08)}
#rm .rm-p .tb i{display:block;height:100%;width:100%;background:var(--pc)}
#rm .rm-row{position:absolute;left:50%;bottom:var(--plateB,14px);transform:translateX(-50%);display:flex;justify-content:center;pointer-events:none;height:26px;max-width:calc(100% - 300px);z-index:2}
#rm .rm-hint{font-size:13px;line-height:1.3;color:#5b4129;text-align:center;background:rgba(255,250,240,.9);border:1px solid var(--line-strong,#cdb391);border-radius:99px;padding:3px 12px;white-space:nowrap}
#rm .rm-hint:empty{visibility:hidden}
#rm .rm-bd{flex:1;min-height:0;width:100%;display:none;flex-direction:column;align-items:center;justify-content:center;gap:8px;pointer-events:auto}
.stage.rm2d #rm .rm-bd{display:flex}
.stage.rm2d #rm .rm-bar{max-width:calc(100% - 160px);align-self:flex-start;justify-content:flex-start}
#rm .rm-g{display:grid;grid-template-columns:repeat(${W},minmax(0,1fr));gap:2px;width:min(100%,520px);background:#2f6b4a;padding:4px;border-radius:8px}
#rm .rm-g.rk{grid-template-columns:repeat(var(--rp),minmax(0,1fr));background:#9a6a3c}
#rm .rm-g .t{aspect-ratio:1/1.3;display:flex;align-items:center;justify-content:center;border-radius:4px;background:#f6eeda;font:700 15px/1 var(--f-num,monospace);font-style:normal;cursor:pointer;user-select:none;-webkit-user-select:none;border:2px solid transparent}
#rm .rm-g .t.e{background:none}
#rm .rm-g .t.c0{color:${INK[0]}}#rm .rm-g .t.c1{color:${INK[1]}}#rm .rm-g .t.c2{color:${INK[2]}}#rm .rm-g .t.c3{color:${INK[3]}}
#rm .rm-g .t.put{background:#ffe9a8}
#rm .rm-g .t.bad{border-color:#e5352b}
#rm .rm-g .t.sel{border-color:#fff;transform:translateY(-3px);box-shadow:0 0 0 2px #f2b632}
@media (max-width:699px){#rm{padding-bottom:78px}#rm .rm-p,#rm .rm-pool{font-size:12px;padding:2px 7px 4px;gap:4px}#rm .rm-bar{max-width:calc(100% - 104px);align-self:flex-start;justify-content:flex-start;gap:4px}#rm .rm-p b{max-width:4.2em}#rm .rm-row{bottom:26px;max-width:calc(100% - 16px)}#rm .rm-g .t{font-size:12px}}
`;
  document.head.appendChild(css);
  elRm=document.createElement('div');elRm.id='rm';elRm.hidden=true;
  elRm.innerHTML=`<div class="rm-bar"></div><div class="rm-bd"></div><div class="rm-row"><div class="rm-hint" aria-live="polite"></div></div>`;
  $('#stage').insertBefore(elRm,$('#fx'));
  elBar=elRm.querySelector('.rm-bar');elHint=elRm.querySelector('.rm-hint');elBd=elRm.querySelector('.rm-bd');
  elBd.addEventListener('click',on2dClick);
  document.addEventListener('keydown',e=>{if(e.code==='Escape'&&sel.length&&elRm&&!elRm.hidden){sel=[];redraw()}});
  window.addEventListener('resize',()=>{P3.lay=''});
  const cv=$('#cv');
  cv.addEventListener('pointerdown',ptDown);cv.addEventListener('pointermove',ptMove);cv.addEventListener('pointerup',ptUp);cv.addEventListener('pointercancel',ptUp);
};
/* 칸·받침대 자리의 화면 좌표 (화면 검사용) */
function scrOf(kind,k){
  const r=T.r.domElement.getBoundingClientRect(),q=kind==='slot'?slotXZ(k):cellXZ(k),y=kind==='slot'?q.y+RCOS*LAY.TT/2:LAY.TT/2,z=kind==='slot'?q.z+RSIN*LAY.TT/2:q.z;
  const v=new THREE.Vector3(q.x*SC,ROOT_Y+y*SC,(z-ZC)*SC).project(P3.cam);
  return {x:r.left+(v.x+1)/2*r.width,y:r.top+(1-v.y)/2*r.height};
}
G._d3={P3,IN,introEnd,pickAt,scrOf,tap,placeAt,get CS(){return CS},get GV(){return GV},get slots(){return slots},get sel(){return sel},get DR(){return DR},slotXZ,poseOf};   // 화면 검사용

(window.GAMES=window.GAMES||{}).rummi=G;
})();
