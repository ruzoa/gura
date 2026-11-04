/* ===== 픽셀 게임 모듈 =====
   공통 코드(core/)가 GAMES.pixel의 함수를 불러서 이 게임의 규칙·봇·화면을 그림. 화면 틀은 쿼리도·동물장기를 따름(탑뷰, 2~4명).
   판: 8×8에서 네 귀퉁이를 뺀 60칸. 칸 번호 = y*8 + x (x 0~7 왼쪽부터, y 0~7 위부터). b[칸] = 0 빈 칸, 자리 번호 + 1 = 그 사람 말
   슬라이더: 지금 교차점 sq. 내 차례에 슬라이더 하나를 움직여 sq와 같은 가로줄·세로줄의 빈 칸에 말을 놓음(말이 있는 칸은 건너뜀)
   승리: 2~3명 4목, 4명 3목(가로·세로·대각선, 더 길어도 승리). 판이 차거나 둘 칸이 없으면 끝나고 한 칸 짧은 줄이 많은 사람이 승리, 같으면 무승부
   손패(hand)는 표시용 값 [0] (공통 코드가 hand가 비면 끝난 사람으로 봄) */
(function(){
const G={id:'pixel',name:'픽셀',short:'픽셀',lead:'슬라이더로 말을 놓아 줄 만들기',brand:'픽셀',brandPx:60,maxHi:4,minN:2,noFast:true,firstPick:true,oneBotLv:true};

/* ---------- 규칙 (방장 엔진·화면·봇·테스트가 같은 함수를 씀) ---------- */
const W=8,CELLS=64,CUT=[0,7,56,63];
const IX=(x,y)=>y*W+x,X=i=>i%W,Y=i=>i>>3;
const isCell=(x,y)=>x>=0&&x<W&&y>=0&&y<W&&!CUT.includes(IX(x,y));
const LINE=[[1,0],[0,1],[1,1],[1,-1]];
const needOf=cnt=>cnt>=4?3:4;
const cellName=i=>'ABCDEFGH'[X(i)]+(W-Y(i));
function legal(b,sq){
  const o=[],sx=X(sq),sy=Y(sq);
  for(let k=0;k<W;k++){
    if(k!==sx&&isCell(k,sy)&&!b[IX(k,sy)])o.push(IX(k,sy));
    if(k!==sy&&isCell(sx,k)&&!b[IX(sx,k)])o.push(IX(sx,k));
  }
  return o;
}
/* 칸 i를 지나는 한 방향의 이어진 칸들 (i는 값 v로 침) */
function runOf(b,i,v,dx,dy){
  const o=[i];
  for(const s of [1,-1]){let x=X(i)+dx*s,y=Y(i)+dy*s;while(isCell(x,y)&&b[IX(x,y)]===v){o.push(IX(x,y));x+=dx*s;y+=dy*s}}
  return o;
}
/* i에 v를 놓았을 때 need 이상 이어지는 칸들 (없으면 빈 목록) */
function winCells(b,i,v,need){
  const o=new Set();
  for(const [dx,dy] of LINE){const r=runOf(b,i,v,dx,dy);if(r.length>=need)r.forEach(c=>o.add(c))}
  return [...o];
}
/* 값 v의 줄: 빈칸 없이 len칸 이상 이어진 묶음 하나가 한 줄 */
function linesOf(b,v,len){
  const out=[];
  for(let i=0;i<CELLS;i++){
    if(b[i]!==v)continue;
    for(const [dx,dy] of LINE){
      const px=X(i)-dx,py=Y(i)-dy;
      if(isCell(px,py)&&b[IX(px,py)]===v)continue;   // 줄의 첫 칸에서만 셈
      const r=[i];let x=X(i)+dx,y=Y(i)+dy;
      while(isCell(x,y)&&b[IX(x,y)]===v){r.push(IX(x,y));x+=dx;y+=dy}
      if(r.length>=len)out.push(r);
    }
  }
  return out;
}
/* 처음 자리: 가운데 네 칸을 시계 방향으로. 2명은 대각선. rot: 무작위 시작 위치. 돌려줌: 첫 플레이어부터 차례대로의 칸 */
const RING=[IX(3,3),IX(4,3),IX(4,4),IX(3,4)];
function startCells(cnt,rot){const o=[];for(let k=0;k<cnt;k++)o.push(RING[(rot+k*(cnt===2?2:1))%4]);return o}

/* 쉬움 봇: 이길 수 있으면 두고, 다음 사람의 승리 칸을 막거나 내 줄을 잇는 칸을 좋아함. 다음 사람에게 승리를 여는 수는 보통 피하지만 가끔 놓침 */
function botPick(b,sq,seat,nextSeat,need,rnd){
  rnd=rnd||Math.random;
  const ms=legal(b,sq),v=seat+1,nv=nextSeat+1;
  if(!ms.length)return -1;
  for(const m of ms)if(winCells(b,m,v,need).length)return m;
  const careful=rnd()<.7;let best=ms[0],bs=-1e9;
  for(const m of ms){
    let s=rnd()*2.4;
    for(const [dx,dy] of LINE){const n=runOf(b,m,v,dx,dy).length;s+=(n-1)*(n-1)*.9}
    if(nextSeat!==seat&&winCells(b,m,nv,need).length)s+=6;
    if(careful&&nextSeat!==seat){b[m]=v;const bad=legal(b,m).some(t=>winCells(b,t,nv,need).length);b[m]=0;if(bad)s-=40}
    if(s>bs){bs=s;best=m}
  }
  return best;
}

/* ---------- 규칙 설명·방 설정 ---------- */
G.rulesHTML='<ol class="rules"><li><b>목표</b> : 내 말을 한 줄로 이으면 이깁니다. <b>2~3명은 4개</b>, <b>4명은 3개</b>입니다. 가로·세로·대각선 모두 되고, 더 길게 이어져도 이깁니다</li><li><b>판</b> : 8×8에서 네 귀퉁이를 뺀 60칸입니다. 각자 가운데 네 칸에 말 하나씩 놓고 시작하고(자리는 자동, 2명이면 대각선), 두 슬라이더는 첫 플레이어의 말에서 만납니다</li><li><b>내 차례</b> : 슬라이더 <b>하나</b>를 움직여 두 슬라이더가 만나는 <b>빈 칸</b>에 내 말을 놓습니다. 놓은 말은 옮길 수 없습니다. 말이 있는 칸은 건너뛸 수 있지만 멈출 수는 없습니다</li><li><b>수비</b> : 내가 놓은 칸의 가로줄·세로줄이 다음 사람이 둘 수 있는 곳입니다. 다음 사람에게 좋은 줄로 슬라이더를 보내지 않는 것이 중요합니다</li><li><b>판이 끝날 때</b> : 판이 다 차거나 지금 슬라이더로 둘 칸이 없으면 끝납니다. 2~3명은 3줄, 4명은 2줄을 가장 많이 만든 사람이 이기고, 같으면 무승부입니다. 빈칸 없이 이어진 묶음 하나가 한 줄입니다</li><li><b>제한 시간</b> : 시간이 지나면 둘 수 있는 칸에 무작위로 놓습니다. 연결이 끊겨도 시간은 흐르고, 45초 안에 돌아오지 않으면 탈주로 처리합니다. 항복·탈주한 사람의 말은 판에 남습니다</li><li><b>선 플레이어</b> : 첫 판은 탁자 설정으로 정합니다(무작위면 주사위, 선택이면 방장이 대기실에서 고름). 결과 화면에서 바로 시작하면 다음 사람이 먼저 둡니다</li><li><b>조작</b> : 슬라이더를 끌거나 점이 찍힌 칸을 누르면 미리 보기, <b>[놓기]</b>로 확정합니다. 설정의 <b>두 번 눌러 놓기</b>를 켜면 같은 칸을 한 번 더 눌러 바로 놓습니다</li></ol>';
G.modeDesc=['줄을 이으면 끝','줄을 이으면 끝'];
G.defaults={max:4,turn:30,pickfirst:0};
G.roomSet=[{k:'turn',label:'제한 시간',unit:'초',lo:10,hi:120,step:5,desc:'시간이 지나면 둘 수 있는 칸에 무작위로 놓습니다. 연결이 끊겨도 시간은 흐르고, 45초가 지나면 탈주로 처리합니다'}];
G.ruleSet=[{k:'pickfirst',pick:1,label:'선 플레이어',desc:'선택: 방장이 이름표 메뉴에서 선 플레이어를 고릅니다. 무작위: 주사위로 정하고, 바로 시작하면 다음 사람이 먼저 둡니다'}];
G.cfgChips=c=>`<span class="chip">제한 시간 <b>${+c.turn}초</b></span><span class="chip">선 <b>${+c.pickfirst?'선택':'무작위'}</b></span>`;
G.cfgSum=c=>`제한 시간 ${+c.turn}초 · 선 ${+c.pickfirst?'선택':'무작위'}`;
G.roomSub=()=>'2~4명 보드게임';
G.pubExtra=()=>({});
G.cardInfo=(c,nowN)=>`<p class="cardinfo">${nowN>=4?'지금 인원이면 3개를 이으면 이깁니다.':'지금 인원이면 4개를 이으면 이깁니다.'}${nowN>4?'<br>픽셀은 최대 4명까지 할 수 있습니다.':''}</p>`;
G.rankTitle=()=>'';
G.finLabel=()=>'';
G.noEmotes=[];
G.keys={};
G.keyActions=[];
G.cardHTML=()=>'';G.drawFace=()=>{};G.cmpCard=()=>0;G.labelOf=()=>'';

/* ---------- 방장 엔진 ---------- */
function nextP(i){const n=H.pxl.cnt;for(let k=1;k<=n;k++){const j=(i+k)%n;if(!H.players[j].finished)return j}return -1}
function sameNames(a,b){return a.length===b.length&&a.every(x=>b.includes(x))}
/* 첫 판 선: 결과 화면에서 바로 시작하면 지난 판 선의 다음 사람, 아니면 공통 firstSeat(선택이면 방장이 고른 사람, 아니면 랜덤) */
function pickFirst(again,cnt){
  const ns=H.players.slice(0,cnt).map(p=>p.name),L=H.pxlLast;
  if(again&&L&&sameNames(ns,L.ns)&&ns.includes(L.h))return (ns.indexOf(L.h)+1)%cnt;
  return typeof firstSeat==='function'?firstSeat(cnt):Math.random()*cnt|0;
}
function startTurn(i){
  H.turn=i;H.graceUntil=0;H.deadline=clock()+H.cfg.turn*1000;
  H.botActAt=H.players[i].bot?clock()+rand(900,1700):0;
  mark();
}
function over(res){
  const X_=H.pxl;X_.res=res;
  const act=[];for(let i=0;i<X_.cnt;i++)if(!H.players[i].finished)act.push(i);
  if(res.why==='count'){
    const by=act.slice().sort((a,b)=>X_.ln[b]-X_.ln[a]);
    by.forEach((s,k)=>{const p=H.players[s],sameAsBefore=k&&X_.ln[s]===X_.ln[by[k-1]];p.rank=sameAsBefore?H.players[by[k-1]].rank:k+1});
  }else for(const s of act)H.players[s].rank=res.w.includes(s)?1:2;
  for(const s of act){const p=H.players[s];p.finished=true;p.hand=[]}
  H.pxlLast={ns:H.players.slice(0,X_.cnt).map(p=>p.name),h:H.players[X_.A].name};
  H.phase='over';H.botActAt=0;mark();
  H.players.forEach((p,i)=>{if(p.bot&&Math.random()<.5)botEmote(i,'gg',800+Math.random()*1600)});
}
function finishCount(stuck){
  const X_=H.pxl,len=X_.need-1,act=[];
  X_.ln=[];X_.win=[];
  for(let i=0;i<X_.cnt;i++){X_.ln.push(0);if(!H.players[i].finished)act.push(i)}
  const by=act.map(s=>{const L=linesOf(X_.b,s+1,len);X_.ln[s]=L.length;return L});
  const top=Math.max(...act.map(s=>X_.ln[s])),w=act.filter(s=>X_.ln[s]===top);
  if(w.length===1){by[act.indexOf(w[0])].forEach(r=>r.forEach(c=>{if(!X_.win.includes(c))X_.win.push(c)}));addLog(`${len}줄 ${top}개, ${H.players[w[0]].name} 승리`,'fin')}
  else if(w.length===act.length)addLog(`${len}줄 수가 같아 무승부입니다.`,'sys');
  else addLog(`${len}줄 ${top}개로 공동 1위입니다.`,'fin');
  over({why:'count',w:w.length===act.length?[]:w,stuck:stuck?1:0});
}
function doMove(seat,sq){
  const X_=H.pxl;
  if(H.phase!=='play'||H.turn!==seat||!legal(X_.b,X_.sq).includes(sq))return false;
  const v=seat+1;X_.b[sq]=v;X_.sq=sq;X_.lm=sq;X_.mv.push(sq);
  addLog(`${X_.mv.length}. ${H.players[seat].name} ${cellName(sq)}`);
  const win=winCells(X_.b,sq,v,X_.need);
  if(win.length){X_.win=win;addLog(`${X_.need}목! ${H.players[seat].name} 승리`,'fin');over({why:'line',w:[seat]});return true}
  if(!legal(X_.b,sq).length){finishCount(X_.mv.length+X_.cnt<60);return true}
  startTurn(nextP(seat));
  return true;
}
function doSurrender(i){
  const X_=H.pxl;
  if(H.phase!=='play'||i<0||i>=X_.cnt||H.players[i].finished)return;
  const p=H.players[i];p.finished=true;p.hand=[];p.surrendered=true;p.rank=H.rankBottom--;
  addLog(`${p.name} ${p.deserter?'탈주':'항복'}`,'lie');
  const act=[];for(let k=0;k<X_.cnt;k++)if(!H.players[k].finished)act.push(k);
  if(act.length<=1){if(act.length)addLog(`${H.players[act[0]].name} 승리`,'fin');over({why:'last',w:act});return}
  if(H.turn===i)startTurn(nextP(i));else mark();
}
function botTurn(i){
  const X_=H.pxl,m=botPick(X_.b,X_.sq,i,nextP(i),X_.need);
  if(m<0||!doMove(i,m))timeout();
}
function timeout(){
  const X_=H.pxl,ms=legal(X_.b,X_.sq),i=H.turn;
  if(ms.length)doMove(i,ms[Math.random()*ms.length|0]);
}
G._test={legal,isCell,winCells,linesOf,needOf,startCells,botPick,cellName,doMove,doSurrender,timeout,pickFirst,IX,X,Y,finishCount};
G.engine={
  start(){
    const again=H.phase==='over',cnt=Math.max(2,Math.min(H.players.length,4));
    Object.assign(H,{phase:'play',log:[],seatNote:{},field:[],last:null,reveal:null,shouts:[],pending:null,rankNext:1,rankBottom:cnt,known:{}});
    H.players.forEach((p,i)=>{p.finished=false;p.rank=null;p.surrendered=false;if(i<cnt)p.hand=[0];else{p.hand=[];p.finished=true;p.rank=i+1}});
    const A=pickFirst(again,cnt),st=startCells(cnt,Math.random()*4|0),b=new Array(CELLS).fill(0);
    st.forEach((c,k)=>{b[c]=((A+k)%cnt)+1});
    H.pxl={cnt,need:needOf(cnt),A,b,st,sq:st[0],lm:-1,mv:[],win:[],ln:null,res:null};
    addLog(`${H.players[A].name}님이 먼저 시작합니다.`,'sys');
    startTurn(A);
  },
  act(seat,a){
    if(a.t==='surrender'){doSurrender(seat);return}
    if(a.t==='put'&&Number.isInteger(a.sq))doMove(seat,a.sq);
  },
  tick(t){
    if(H.phase!=='play')return;
    const cur=H.players[H.turn];
    if(t>=H.deadline){if(cur.bot&&!awayHuman(cur))botTurn(H.turn);else timeout()}
    else if(cur.bot&&H.botActAt&&t>=H.botActAt&&!(cur.away&&t<cur.awayAt+AWAY_WAIT))botTurn(H.turn);
  },
  snap(s,you,t){
    const X_=H.pxl;
    s.pxl={cnt:X_.cnt,need:X_.need,A:X_.A,b:X_.b.join(''),st:X_.st.slice(),sq:X_.sq,lm:X_.lm,n:X_.mv.length,win:X_.win.slice(),ln:X_.ln?X_.ln.slice():null,res:X_.res?{...X_.res,w:X_.res.w.slice()}:null};
    s.gr=0;s.dl=Math.max(0,Math.round(H.deadline-t));
  },
  restore(){},
  emoPhase:ph=>ph==='play'||ph==='over'
};

/* ---------- 화면 (모든 참가자) ----------
   2D(SVG)와 3D(공통 테이블 가운데 판 + 네모 말 + 유리 슬라이더 둘)는 같은 상태(CS)를 보고 그림. 모두 같은 방향에서 봄 */
const SEAT_C=['#c53026','#2b65ca','#1f7a2e','#c9831a'];   // 자리 색 (첫 차례 주사위 면과 같음: DicePick.SEAT_COL 앞 넷)
const SLIDE=240;   // 슬라이더가 움직이는 시간 (말은 그 뒤에 내려앉음)
let CS=null,pend=-1,flash=-1,flashAt=0;   // pend: 미리 고른 칸
let elPx=null,elSvg=null,elMain=null,elBar=null,elBarMe=null,elHint=null,lastBoard='',lastBar='',lastHint='';
const buildS=c=>({...c,b:[...c.b].map(Number)});
const myTurnNow=()=>!!(V&&V.pxl&&V.st==='play'&&myReady()&&!introWait());
const dblOn=()=>typeof dblTap!=='undefined'&&!!dblTap;
const nm=i=>V.ps[i]?V.ps[i].n:'?';
const lines=()=>CS?legal(CS.b,CS.sq):[];
function tapSq(sq){
  if(!V||!V.pxl||V.st!=='play'||!CS||sq<0)return;
  if(!myTurnNow()){sndNo();return}
  if(pend===sq){if(dblOn())confirmPend();else{pend=-1;sndLift(.08);redraw()}return}
  if(lines().includes(sq)){pend=sq;sndLift(.12);redraw();return}
  pend=-1;flash=sq;flashAt=clock();sndNo();redraw();
}
function confirmPend(){
  if(pend<0||!myTurnNow())return;
  const sq=pend;pend=-1;
  if(!lines().includes(sq)){sndNo();redraw();return}
  sendAct({t:'put',sq});redraw();
}
function redraw(){drawAll();G.buttons();P3.dirty=true;d3Marks()}
function sndLift(vol){tone(1100,.03,{type:'triangle',vol:vol*.5});hiss(.02,{freq:3400,q:3,vol:vol*.4})}
function sndNo(){sfx('no')}
function sndTick(){tone(1500,.018,{type:'square',vol:.018});hiss(.012,{freq:5200,q:4,vol:.05})}
function sndSlide(at){hiss(.16,{freq:1700,q:1.6,vol:.07,at})}
function sndPut(at){hiss(.03,{freq:2400,q:2.5,vol:.22,at});tone(760,.05,{type:'triangle',vol:.13,at});tone(240,.08,{type:'sine',vol:.1,at:at+.004})}
function sndWin(at){[660,880,1320].forEach((f,k)=>tone(f,.13,{type:'square',vol:.035,at:at+k*.1}))}

/* ----- 2D (SVG): 칸 = 1, 판은 (0,0)~(8,8) ----- */
function boardHTML(){
  const out=['<rect x="-.34" y="-.34" width="8.68" height="8.68" rx=".12" fill="#6b3f1f"/>'];
  for(let y=0;y<W;y++)for(let x=0;x<W;x++){if(isCell(x,y))out.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${(x+y)&1?'#e6d6b4':'#f0e4c8'}" stroke="#a98a5b" stroke-width=".02"/>`)}
  const sq=CS.sq,cx=pend>=0?X(pend):X(sq),cy=pend>=0?Y(pend):Y(sq);
  for(let i=0;i<CELLS;i++){const v=CS.b[i];if(v){out.push(`<rect x="${X(i)+.07}" y="${Y(i)+.07}" width=".86" height=".86" rx=".1" fill="${SEAT_C[v-1]}"/>`)}}
  if(CS.lm>=0)out.push(`<rect x="${X(CS.lm)+.04}" y="${Y(CS.lm)+.04}" width=".92" height=".92" rx=".1" fill="none" stroke="#f2c94c" stroke-width=".08"/>`);
  for(const c of CS.win)out.push(`<rect x="${X(c)+.02}" y="${Y(c)+.02}" width=".96" height=".96" rx=".1" fill="#ffd23a" opacity=".42"/>`);
  if(!introWait()){
    out.push(`<rect x="${cx+.03}" y="-.3" width=".94" height="8.6" fill="#fff6d8" opacity=".3" stroke="#7a5a2a" stroke-width=".03"/><rect x="-.3" y="${cy+.03}" width="8.6" height=".94" fill="#fff6d8" opacity=".3" stroke="#7a5a2a" stroke-width=".03"/>`);
    if(myTurnNow()&&pend<0)for(const c of lines())out.push(`<circle cx="${X(c)+.5}" cy="${Y(c)+.5}" r=".12" fill="rgba(30,30,30,.4)"/>`);
    if(pend>=0)out.push(`<rect x="${cx+.07}" y="${cy+.07}" width=".86" height=".86" rx=".1" fill="${SEAT_C[myIdx()]}" opacity=".55"/>`);
    out.push(`<rect x="${cx+.02}" y="${cy+.02}" width=".96" height=".96" rx=".08" fill="none" stroke="${V.st==='play'&&V.t>=0?SEAT_C[V.t%4]:'#7a5a2a'}" stroke-width=".07"/>`);
  }
  if(flash>=0&&clock()-flashAt<700)out.push(`<rect x="${X(flash)+.03}" y="${Y(flash)+.03}" width=".94" height=".94" fill="#d6342a" opacity=".6"/>`);
  return out.join('');
}
function onSvgClick(e){
  if(!CS)return;
  const pt=elSvg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;const m=elSvg.getScreenCTM();if(!m)return;
  const q=pt.matrixTransform(m.inverse()),x=Math.floor(q.x),y=Math.floor(q.y);
  if(isCell(x,y))tapSq(IX(x,y));
}
/* 이름 칸: 나는 판 아래쪽, 다른 사람은 판 위쪽(나 다음부터 차례대로). 관전자는 모두 위쪽 */
function chipHTML(i){
  const me=myIdx(),p=V.ps[i];if(!p||i>=CS.cnt)return '';
  const on=introWait()?(IN.fp?IN.fp.idx(clock())===i:false):V.st==='play'&&V.t===i&&!p.f;
  const r=CS.res,len=CS.need-1;
  const st=p.sr===3?'탈주':p.sr?'항복':V.st==='over'?(CS.ln?`${len}줄 ${CS.ln[i]}개`:r&&r.w.includes(i)?'승리':''):'';
  return `<div class="pxl-p${on?' on':''}${i===me?' me':''}${p.sr?' out':''}" style="--pc:${SEAT_C[i]}"><i class="dot"></i><b>${esc(p.n)}${i===me?' (나)':''}</b>${st?`<span class="st">${st}</span>`:''}${on&&V.st==='play'?'<span class="tb"><i></i></span>':''}</div>`;
}
const seated=()=>{const me=myIdx();return me>=0&&me<CS.cnt};
function barHTML(){const n=CS.cnt,me=myIdx(),b=seated()?me:0,o=Array.from({length:n},(_,k)=>(b+k)%n);return (seated()?o.slice(1):o).map(chipHTML).join('')}
const meBarHTML=()=>seated()?chipHTML(myIdx()):'';
function hintText(){
  if(!V||!V.pxl||!CS||V.st!=='over')return '';
  const r=CS.res;if(!r)return '게임이 끝났습니다.';
  if(r.why==='line')return `${nm(r.w[0])} 승리 (${CS.need}목)`;
  if(r.why==='last')return r.w.length?`${nm(r.w[0])} 승리`:'게임이 끝났습니다.';
  if(!r.w.length)return '무승부입니다.';
  return r.w.length===1?`${nm(r.w[0])} 승리 (${CS.need-1}줄)`:`공동 1위 (${CS.need-1}줄)`;
}
function drawHint(){if(!elHint)return;const h=hintText();if(h!==lastHint){elHint.textContent=h;lastHint=h}}
function fit(){
  if(!elPx||elPx.hidden)return;
  const bd=elPx.querySelector('.pxl-bd'),k=Math.min(bd.clientWidth,bd.clientHeight);
  if(k>0){elSvg.style.width=k+'px';elSvg.style.height=k+'px'}
}
function drawAll(){
  if(!CS||!elMain)return;
  if(!P3.on){const bd=boardHTML();if(bd!==lastBoard){elMain.innerHTML=bd;lastBoard=bd}}
  const top=barHTML(),mb=meBarHTML(),key=top+'\u0001'+mb;if(key!==lastBar){elBar.innerHTML=top;elBarMe.innerHTML=mb;lastBar=key;P3.lay=''}
  drawHint();fit();
}

/* ---------- 3D: 공통 테이블 가운데 판, 네모 말, 유리 슬라이더 둘 ----------
   칸 한 변 C. 슬라이더는 판 둘레 홈을 따라 움직이고, 세로 슬라이더(가로로 움직임)와 가로 슬라이더(세로로 움직임)가 만나는 곳이 교차점 */
const C=.5,HB=4*C,LIP=.04,RW=.32,FH=HB+LIP+RW,TOP=.15,TS=C*.88,TH=.07,PY=TOP+.004,BY=TOP+TH+.05,PARK=-.9;
const P3={on:false,built:false,fail:false,root:null,cam:null,dirty:true,lastR:0,lay:'',layAt:0,d:12,tiles:new Map(),anim:[],mvN:-1,winAt:0,sl:{x:{v:PARK,from:PARK,to:PARK,t0:0},y:{v:PARK,from:PARK,to:PARK,t0:0}},movedAt:-1e9};
let D=null;   // 슬라이더를 끄는 중: {id,cx,cy,col,row,axis,moved,v}
const ease=k=>k<=0?0:k>=1?1:k*k*(3-2*k);
const dropY=(x,h)=>x>=1?0:x<.68?h*(1-(x/.68)*(x/.68)):h*.1*Math.sin(Math.PI*(x-.68)/.32);
const gW=v=>(v-3.5)*C;
function woodPaint(g,w,h,base,dark,n,seed){
  let s=seed||7;const rnd=()=>{s=(s*16807)%2147483647;return s/2147483647};
  g.fillStyle=base;g.fillRect(0,0,w,h);
  for(let i=0;i<n;i++){const y0=rnd()*h,a=rnd()*.12+.04;g.strokeStyle=dark;g.globalAlpha=a;g.lineWidth=rnd()*2.5+.8;g.beginPath();
    for(let t=0;t<=w;t+=8){const y=y0+Math.sin(t/30+i)*3+Math.sin(t/11+i*3)*1.2;t?g.lineTo(t,y):g.moveTo(t,y)}g.stroke()}
  g.globalAlpha=1;
}
/* 판 윗면: 원목 틀, 둘레 홈, 좌표, 60칸 */
function drawBoardTex(g,Sz){
  const s=Sz/(2*FH),p=v=>(v+FH)*s;
  woodPaint(g,Sz,Sz,'#7a4a22','#2e170a',150,3);
  const groove=(HB+LIP+RW/2),gw=.11*s;g.strokeStyle='#3a2210';g.lineWidth=gw;g.lineCap='round';
  for(const [a,b,c,d] of [[-HB,-groove,HB,-groove],[-HB,groove,HB,groove],[-groove,-HB,-groove,HB],[groove,-HB,groove,HB]]){g.beginPath();g.moveTo(p(a),p(b));g.lineTo(p(c),p(d));g.stroke()}
  for(let y=0;y<W;y++)for(let x=0;x<W;x++){
    if(!isCell(x,y))continue;
    g.fillStyle=(x+y)&1?'#e6d6b4':'#f0e4c8';g.fillRect(p(gW(x)-C/2),p(gW(y)-C/2),C*s,C*s);
  }
  g.strokeStyle='#a98a5b';g.lineWidth=Math.max(1.5,Sz/640);
  for(let y=0;y<W;y++)for(let x=0;x<W;x++)if(isCell(x,y))g.strokeRect(p(gW(x)-C/2),p(gW(y)-C/2),C*s,C*s);
  g.fillStyle='rgba(248,226,178,.55)';g.textAlign='center';g.textBaseline='middle';g.font=`600 ${Math.round(.1*s)}px "IBM Plex Mono",monospace`;
  const lab=HB+LIP+RW-.055;
  for(let k=0;k<W;k++){
    g.fillText('ABCDEFGH'[k],p(gW(k)),p(lab));g.fillText(String(W-k),p(-lab),p(gW(k)));
  }
}
const TEXT={};
/* 말 윗면: 도트 그림처럼 위·왼쪽 밝게, 아래·오른쪽 어둡게 */
function tileTex(hex){
  if(TEXT[hex])return TEXT[hex];
  return TEXT[hex]=canvasTex(64,64,(g,w,h)=>{
    const c=new THREE.Color(hex),a=c.clone().lerp(new THREE.Color(0xffffff),.34),d=c.clone().lerp(new THREE.Color(0),.28),u=8;
    g.fillStyle='#'+c.getHexString();g.fillRect(0,0,w,h);
    g.fillStyle='#'+a.getHexString();g.fillRect(0,0,w,u);g.fillRect(0,0,u,h);
    g.fillStyle='#'+d.getHexString();g.fillRect(0,h-u,w,u);g.fillRect(w-u,0,u,h);
    g.fillStyle='#fff';g.globalAlpha=.5;g.fillRect(u*1.5,u*1.5,u,u);g.globalAlpha=1;
  });
}
const GEO={},MAT={};
function geo(){
  if(GEO.body)return GEO;
  const r=.035,s=TS/2-r,sh=new THREE.Shape();
  sh.moveTo(-s,-s-r);sh.lineTo(s,-s-r);sh.quadraticCurveTo(s+r,-s-r,s+r,-s);sh.lineTo(s+r,s);sh.quadraticCurveTo(s+r,s+r,s,s+r);sh.lineTo(-s,s+r);sh.quadraticCurveTo(-s-r,s+r,-s-r,s);sh.lineTo(-s-r,-s);sh.quadraticCurveTo(-s-r,-s-r,-s,-s-r);
  const body=new THREE.ExtrudeGeometry(sh,{depth:TH,bevelEnabled:false,curveSegments:4});body.rotateX(-Math.PI/2);
  const ink=body.clone();ink.translate(0,-TH/2,0);ink.scale(1.07,1.1,1.07);ink.translate(0,TH/2,0);
  GEO.body=body;GEO.ink=ink;GEO.face=new THREE.PlaneGeometry(TS*.97,TS*.97);
  return GEO;
}
const INK=()=>MAT.ink||(MAT.ink=new THREE.MeshBasicMaterial({color:GFX_INK,side:THREE.BackSide}));
function tileMesh(v){
  const Gm=geo(),hex=SEAT_C[v-1],g=new THREE.Group();
  const body=new THREE.Mesh(Gm.body,MAT['b'+v]||(MAT['b'+v]=toon({color:new THREE.Color(hex).getHex(),rim:.1})));body.castShadow=body.receiveShadow=true;g.add(body);
  g.add(new THREE.Mesh(Gm.ink,INK()));
  const top=new THREE.Mesh(Gm.face,MAT['t'+v]||(MAT['t'+v]=toon({map:tileTex(hex),rim:.04})));top.rotation.x=-Math.PI/2;top.position.y=TH+.002;g.add(top);
  g.userData={v};return g;
}
/* 대기실 홀로그램의 대표 말: 도트 네 개와 그 위를 지나는 슬라이더 둘 */
G.holoPiece=mkM=>{
  const g=new THREE.Group(),S=.17;
  [[-1,-1,0],[0,-1,1],[0,0,2],[1,0,3],[-1,1,0],[1,1,1]].forEach(([x,y,c])=>{const b=new THREE.Mesh(new THREE.BoxGeometry(S*.9,S*.9,.05),mkM(new THREE.Color(SEAT_C[c]).getHex()));b.position.set((x-.0)*S,-y*S,0);g.add(b)});
  const bar=(w,h,x,y)=>{const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,.02),mkM(0xf2e6c4));b.position.set(x,y,.05);g.add(b)};
  bar(S*.26,S*4.2,0,0);bar(S*4.2,S*.26,0,0);
  g.rotation.set(-.32,.3,.1);return g;
};
function barMesh(alongZ,y){
  const g=new THREE.Group(),L=2*(HB+LIP+RW*.72),w=C*.94;
  const gl=MAT.glass||(MAT.glass=new THREE.MeshBasicMaterial({color:0xfff6d8,transparent:true,opacity:.2,depthWrite:false}));
  const eg=MAT.edge||(MAT.edge=new THREE.MeshBasicMaterial({color:0x6a4a22,transparent:true,opacity:.55,depthWrite:false}));
  const pl=(a,b,m,x,z,ro)=>{const p=new THREE.Mesh(new THREE.PlaneGeometry(a,b),m);p.rotation.x=-Math.PI/2;p.position.set(x,y,z);p.renderOrder=ro;g.add(p)};
  const brass=MAT.brass||(MAT.brass=toon({color:0xb8925a,rim:.3}));
  if(alongZ){pl(w,L,gl,0,0,5);for(const s of [-1,1])pl(.022,L,eg,s*w/2,0,6)}else{pl(L,w,gl,0,0,5);for(const s of [-1,1])pl(L,.022,eg,0,s*w/2,6)}
  for(const s of [-1,1]){
    const hb=HB+LIP+RW/2,bx=new THREE.Mesh(alongZ?new THREE.BoxGeometry(w*.86,.09,RW*.76):new THREE.BoxGeometry(RW*.76,.09,w*.86),brass);
    bx.position.set(alongZ?0:s*hb,TOP+.05,alongZ?s*hb:0);bx.castShadow=true;g.add(bx);
    const o=new THREE.Mesh(alongZ?new THREE.BoxGeometry(w*.86+.03,.1,RW*.76+.03):new THREE.BoxGeometry(RW*.76+.03,.1,w*.86+.03),INK());o.position.copy(bx.position);g.add(o);
  }
  return g;
}
function d3Build(){
  if(P3.built||P3.fail)return P3.built;
  if(!T.ok||typeof THREE==='undefined'){P3.fail=true;return false}
  try{
    const root=new THREE.Group();root.visible=false;
    const bg=new THREE.Group();root.add(bg);P3.boardG=bg;
    const frame=new THREE.Mesh(new THREE.BoxGeometry(2*FH,TOP-.02,2*FH),toon({map:canvasTex(512,512,(g,w,h)=>woodPaint(g,w,h,'#7a4a22','#2e170a',110,3)),rim:.08}));frame.position.y=.02+(TOP-.02)/2;frame.castShadow=frame.receiveShadow=true;bg.add(frame);
    const fo=new THREE.Mesh(new THREE.BoxGeometry(2*FH+.05,TOP,2*FH+.05),INK());fo.position.copy(frame.position);bg.add(fo);
    const top=new THREE.Mesh(new THREE.PlaneGeometry(2*FH-.02,2*FH-.02),toon({map:canvasTex(1024,1024,(g,w)=>drawBoardTex(g,w)),rim:0}));top.rotation.x=-Math.PI/2;top.position.y=TOP+.002;top.receiveShadow=true;bg.add(top);
    {const wd=toon({map:canvasTex(128,128,(g,w,h)=>woodPaint(g,w,h,'#6b3f1f','#2e170a',30,5)),rim:.08});   // 잘린 귀퉁이: 틀과 같은 나무 덩어리
     for(const i of CUT){const m=new THREE.Mesh(new THREE.BoxGeometry(C,.06,C),wd);m.position.set(gW(X(i)),TOP+.03,gW(Y(i)));m.castShadow=true;bg.add(m)}}
    const sq=(c,op,ro)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(C*.94,C*.94),new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:op,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.y=TOP+.004;m.visible=false;m.renderOrder=ro||2;root.add(m);return m};
    P3.lmM=sq(0xf2c94c,.5);P3.pendM=sq(0x6fbf5a,.4);P3.flashM=sq(0xd6342a,.62);P3.sq=sq;
    const dotM=new THREE.MeshBasicMaterial({color:0x1d1a17,transparent:true,opacity:.42,depthWrite:false});
    P3.dots=[];for(let k=0;k<14;k++){const d=new THREE.Mesh(new THREE.CircleGeometry(C*.13,20),dotM);d.rotation.x=-Math.PI/2;d.position.y=TOP+.008;d.visible=false;d.renderOrder=3;root.add(d);P3.dots.push(d)}
    P3.wins=[];
    P3.pg=new THREE.Group();root.add(P3.pg);
    P3.colB=barMesh(true,BY);P3.rowB=barMesh(false,BY+.012);bg.add(P3.colB);bg.add(P3.rowB);
    const ringT=canvasTex(128,128,(g,w,h)=>{g.strokeStyle='#fff';g.lineWidth=13;g.strokeRect(8,8,w-16,h-16)});
    P3.cross=new THREE.Mesh(new THREE.PlaneGeometry(C,C),new THREE.MeshBasicMaterial({map:ringT,transparent:true,depthWrite:false,color:0xf2c94c}));P3.cross.rotation.x=-Math.PI/2;P3.cross.position.y=BY+.03;P3.cross.renderOrder=8;P3.cross.visible=false;root.add(P3.cross);
    P3.ghost=new THREE.Mesh(new THREE.PlaneGeometry(TS,TS),new THREE.MeshBasicMaterial({transparent:true,opacity:.62,depthWrite:false}));P3.ghost.rotation.x=-Math.PI/2;P3.ghost.position.y=PY+TH;P3.ghost.visible=false;P3.ghost.renderOrder=4;root.add(P3.ghost);
    P3.cam=new THREE.PerspectiveCamera(34,1,.1,100);
    T.scene.add(root);P3.root=root;P3.built=true;
  }catch(e){P3.fail=true;try{console.warn('픽셀 3D 준비 실패',e)}catch(_){}}
  return P3.built;
}
/* 바로 시작: 판은 그대로, 말만 떠올라 사라짐 */
function sweep(now){
  let k=0;for(const g of P3.tiles.values()){P3.anim.push({obj:g,t0:now+k*12,dur:300,y0:g.position.y,y1:g.position.y+1,gone:1,s1:.01});k++}
  P3.tiles.clear();
}
function d3Sync(){
  if(!P3.on||!V||!V.pxl||!CS)return;
  const now=clock(),n=CS.n;
  if(IN.again&&!IN.gathered&&n===0){IN.gathered=true;sweep(now);P3.mvN=0}
  const step=P3.mvN>=0&&n===P3.mvN+1&&CS.lm>=0&&!IN.on3d;
  for(const [sq,g] of P3.tiles)if(CS.b[sq]!==g.userData.v){P3.pg.remove(g);P3.tiles.delete(sq)}
  for(let sq=0;sq<CELLS;sq++){
    const v=CS.b[sq];if(!v||P3.tiles.has(sq))continue;
    const g=tileMesh(v);g.position.set(gW(X(sq)),PY,gW(Y(sq)));P3.pg.add(g);P3.tiles.set(sq,g);
    if(step&&sq===CS.lm){g.visible=false;P3.anim.push({obj:g,t0:now+SLIDE*.85,dur:300,drop:.9,show:1})}
    else if(IN.on3d)g.visible=false;
  }
  if(V.st==='over'&&CS.win.length&&!P3.winDone){P3.winDone=true;P3.winAt=step?now+SLIDE+420:now+1}
  if(V.st!=='over'){P3.winDone=false;P3.winAt=0;for(const m of P3.wins)m.visible=false}
  P3.mvN=n;d3Marks();P3.dirty=true;
}
/* 슬라이더 목표: 첫 차례가 정해지기 전에는 홈 끝, 미리 고른 칸이 있으면 그 칸, 아니면 교차점 */
function slTarget(){
  if(!CS||introWait())return [PARK,PARK];
  const c=pend>=0?pend:CS.sq;return [X(c),Y(c)];
}
function slUpdate(now){
  const [tx,ty]=slTarget(),S=P3.sl;let busy=false;
  for(const [a,to] of [[S.x,tx],[S.y,ty]]){
    if(a.to!==to){a.from=a.v;a.to=to;a.t0=now}
    const k=(now-a.t0)/SLIDE;
    if(k<1){a.v=a.from+(a.to-a.from)*ease(k);busy=true}else a.v=a.to;
  }
  if(D&&D.moved&&D.axis)S[D.axis].v=D.v;
  P3.colB.position.x=gW(S.x.v);P3.rowB.position.z=gW(S.y.v);
  const cross=!!CS&&S.x.v>-.5&&S.y.v>-.5;
  P3.cross.visible=cross;if(cross)P3.cross.position.set(gW(S.x.v),BY+.03,gW(S.y.v));
  return busy;
}
function d3Marks(){
  if(!P3.on||!V||!V.pxl||!CS)return;
  const put=(m,sq)=>{if(sq==null||sq<0){m.visible=false;return}m.position.x=gW(X(sq));m.position.z=gW(Y(sq));m.visible=true};
  put(P3.lmM,V.st==='play'||!CS.win.length?CS.lm:-1);put(P3.pendM,pend);
  put(P3.flashM,flash>=0&&clock()-flashAt<700?flash:-1);
  const mine=myTurnNow(),ms=mine&&pend<0?lines():[];
  P3.dots.forEach((d,k)=>{put(d,k<ms.length?ms[k]:-1)});
  P3.cross.material.color.set(V.st==='play'&&V.t>=0&&V.t<4?SEAT_C[V.t]:'#f2c94c');
  if(pend>=0&&mine){P3.ghost.material.map=tileTex(SEAT_C[myIdx()]);P3.ghost.material.needsUpdate=true;P3.ghost.position.x=gW(X(pend));P3.ghost.position.z=gW(Y(pend));P3.ghost.visible=true}else P3.ghost.visible=false;
  P3.dirty=true;
}
function showWin(){
  const list=CS?CS.win:[];
  list.forEach((c,k)=>{let m=P3.wins[k];if(!m){m=P3.sq(0xffd23a,.5,7);m.position.y=PY+TH+.01;P3.wins.push(m)}m.position.x=gW(X(c));m.position.z=gW(Y(c));m.visible=true});
  P3.lmM.visible=false;P3.dirty=true;
}
function tvBox(r){
  const Wd=r.clientWidth,Hh=r.clientHeight;r.classList.toggle('wide',Wd>Hh||(Wd>=700&&!!(CS&&CS.cnt<=2)));
  const narrow=Wd<700,bar=r.querySelector('.pxl-bar'),mb=r.querySelector('.pxl-mebar'),gap=10;
  const R=Math.max(bar.offsetTop+bar.offsetHeight+gap,(narrow?70:14)+(mb.offsetHeight||26)+gap),m=narrow?8:16;
  return {fw:Wd-2*m,fh:Hh-2*R,cy:Hh/2,R};
}
const CHIP_GAP=10;
function chipsAt(topY,botY){
  const r=elPx,bar=r.querySelector('.pxl-bar'),mb=r.querySelector('.pxl-mebar');if(!bar||!mb)return;
  const Hh=r.clientHeight,lim=Hh-(r.clientWidth<700?70:14)-(mb.offsetHeight||34);
  r.style.setProperty('--bs',Math.max(bar.offsetHeight,Math.round(topY-CHIP_GAP-bar.offsetTop))+'px');
  r.style.setProperty('--mt',Math.round(Math.min(botY+CHIP_GAP,lim))+'px');
  r.classList.add('lay');
}
function d3Layout(t){
  if(t-P3.layAt<100&&P3.lay)return false;
  P3.layAt=t;
  const st=$('#stage'),Wd=st.clientWidth,Hh=st.clientHeight;if(!Wd||!Hh||!V||!V.pxl)return false;
  const B=tvBox(elPx),key=[Wd,Hh,B.R].join(',');
  if(key===P3.lay)return false;
  P3.lay=key;
  const s=Math.min(B.fw,B.fh)/(2*(FH+.03)),cam=P3.cam,f=Math.tan(cam.fov*Math.PI/360),d=(Hh/2)/(s*f);
  cam.aspect=Wd/Hh;cam.clearViewOffset();cam.position.set(0,PY+d,0);cam.lookAt(0,PY,0);cam.updateProjectionMatrix();cam.updateMatrixWorld();
  chipsAt(B.cy-FH*s,B.cy+FH*s);
  P3.d=d;P3.dirty=true;
  return true;
}
function d3Step(now){
  let busy=false;
  P3.anim=P3.anim.filter(a=>{
    const k=(now-a.t0)/a.dur;busy=true;if(k<0)return true;
    const o=a.obj,e=Math.min(1,k);
    if(a.show)o.visible=true;
    if(a.drop!=null)o.position.y=PY+dropY(e,a.drop);
    else{o.position.y=a.y0+(a.y1-a.y0)*ease(e);if(a.s1!=null)o.scale.setScalar(1+(a.s1-1)*ease(e))}
    if(k>=1){if(a.gone)P3.pg.remove(o);else if(a.drop!=null)o.position.y=PY;return false}
    return true;
  });
  return busy;
}
function d3Render(t){
  if(!P3.on||!T.ok)return;
  if(d3Layout(t))P3.dirty=true;
  const busy=d3Step(t),sl=slUpdate(t),intro=IN.on3d&&introStep(t),fl=flash>=0&&t-flashAt<760;
  if(flash>=0&&!fl){flash=-1;d3Marks()}
  if(P3.winAt&&t>=P3.winAt){P3.winAt=0;showWin()}
  if(!busy&&!sl&&!intro&&!fl&&!P3.dirty&&!(D&&D.moved)&&t-P3.lastR<400)return;
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
   0~1.1초 로비 카메라 → 바로 위 카메라. 판이 내려앉고 가운데 네 칸에 말이 하나씩 떨어짐 → 첫 차례 주사위 → 슬라이더가 첫 플레이어의 말로 모임.
   바로 시작은 판을 다시 차리지 않음: 말이 사라지고 처음 말이 다시 떨어진 뒤 주사위 없이 알림 */
const INTRO={cam:1100,ui:650,board:[100,400],tile:[600,170],dur:340,dice:1700};
const AGAIN={tile:[340,90],dice:820};
const DIE=.56;
G.introMs=(again,rolls)=>Math.round((again?AGAIN.dice:INTRO.dice)+DicePick.totalFor(again?-1:rolls)+100);
const IN={on:false,on3d:false,t0:0,total:0,r:0,again:false,fromLobby:true,said:false,gathered:false,fp:null,die:null,snd:{}};
const introOn=()=>IN.on&&clock()<IN.t0+IN.total;
const introWait=()=>introOn()&&!IN.said;
const tileAt=i=>{const A=IN.again?AGAIN:INTRO;return A.tile[0]+i*A.tile[1]};
G.intro=(t0,o)=>{
  if(!V||!V.pxl||!V.ps)return;
  IN.again=!!(o&&o.again)&&P3.on;
  const rolls=IN.again?-1:o&&o.rolls,seed=(o&&o.seed)||1,cnt=V.pxl.cnt;
  IN.on=true;IN.t0=t0;IN.said=false;IN.snd={};IN.fromLobby=!P3.on;IN.on3d=true;IN.gathered=false;
  IN.r=IN.again?AGAIN.dice:INTRO.dice;IN.total=(o&&o.total)||G.introMs(IN.again,rolls);
  if(IN.die){IN.die.dispose();IN.die=null}
  IN.fp=firstPick(t0+IN.r,{seats:Array.from({length:cnt},(_,k)=>k),first:V.pxl.A,rolls,seed});
  $('#stage').classList.add('pxl-intro');if(elPx&&IN.fromLobby)elPx.classList.add('intro');
  lastBar='';P3.dirty=true;
};
function introStep(now,force){
  if(!P3.built||!V||!V.pxl||!CS)return false;
  const e=now-IN.t0,done=force||e>=IN.total,fl=IN.fromLobby;
  if(done)IN.on3d=false;
  {const x=done||!fl?1:(e-INTRO.board[0])/INTRO.board[1];P3.boardG.visible=x>0;P3.boardG.position.y=dropY(Math.max(0,x),1.6)}
  CS.st.forEach((sq,i)=>{const g=P3.tiles.get(sq);if(!g)return;const x=done?1:(e-tileAt(i))/INTRO.dur;g.visible=x>0;g.position.y=PY+dropY(Math.max(0,Math.min(1,x)),1)});
  if(IN.fp&&!IN.fp.fixed){
    if(!IN.die&&!done&&P3.root){IN.die=DicePick.mesh(THREE,CS.cnt,SEAT_C.slice(0,CS.cnt));P3.root.add(IN.die.g)}
    if(IN.die)IN.die.apply(done||e<IN.r?null:IN.fp.pose(now),DIE,0,BY+.1,0);
  }
  if(done){for(const g of P3.tiles.values())g.visible=true;if(IN.die){IN.die.dispose();IN.die=null}d3Marks()}
  return true;
}
function introEnd(){
  if(IN.on3d)introStep(clock(),true);
  if(IN.die){IN.die.dispose();IN.die=null}
  IN.on=false;IN.on3d=false;IN.said=true;
  $('#stage').classList.remove('pxl-intro');if(elPx)elPx.classList.remove('intro');
}
function introTick(){
  if(!IN.on)return;
  const e=clock()-IN.t0,S_=IN.snd,once=(k,f)=>{if(!S_[k]){S_[k]=1;f()}};
  if(e>=INTRO.ui&&elPx&&elPx.classList.contains('intro'))elPx.classList.remove('intro');
  if(IN.on3d&&P3.on&&CS){
    if(IN.fromLobby&&e>=INTRO.board[0]+INTRO.board[1]*.68)once('thud',()=>{tone(120,.13,{type:'triangle',vol:.2});hiss(.09,{freq:650,vol:.12})});
    CS.st.forEach((_,i)=>{if(e>=tileAt(i)+INTRO.dur*.68)once('t'+i,()=>sndPut(0))});
  }
  if(IN.fp&&e>=IN.r&&IN.fp.tick(IN.t0+e)){
    IN.said=true;$('#stage').classList.remove('pxl-intro');if(elPx)elPx.classList.remove('intro');
    fxSay(IN.fp.msg(),SEAT_C[IN.fp.first]);sndSlide(0);
    lastBar='';redraw();
  }
  if(e>=IN.total){IN.on=false;lastBar='';lastHint='';G.buttons();if(P3.on)d3Marks()}
  drawAll();
}
/* 3D 화면에서 누른 곳 → 판 위 격자 좌표 (칸 하나 = 1, 0~8이 판 안, 바깥은 틀) */
function gridAt(e){
  const r=T.r.domElement.getBoundingClientRect();if(!r.width||!P3.cam)return null;
  const ray=P3.ray||(P3.ray=new THREE.Raycaster());
  ray.setFromCamera({x:(e.clientX-r.left)/r.width*2-1,y:-(e.clientY-r.top)/r.height*2+1},P3.cam);
  const o=ray.ray.origin,dv=ray.ray.direction;if(Math.abs(dv.y)<1e-6)return null;
  const k=(TOP-o.y)/dv.y;return {x:(o.x+dv.x*k)/C+4,y:(o.z+dv.z*k)/C+4};
}
function d3Click(e){
  if(!P3.on||G!==GAMES.pixel||clock()-P3.movedAt<350)return;
  const g=gridAt(e);if(!g)return;
  const x=Math.floor(g.x),y=Math.floor(g.y);
  if(x>=0&&x<W&&y>=0&&y<W)tapSq(isCell(x,y)?IX(x,y):-1);
}
/* 슬라이더 끌기: 슬라이더 위에서 눌러 움직이면 그 슬라이더가 손을 따라감. 다른 슬라이더는 교차점 자리로 돌아감(슬라이더는 하나만 움직임) */
function dragDown(e){
  if(!P3.on||G!==GAMES.pixel||!myTurnNow()||(e.pointerType==='mouse'&&e.button!==0)||e.target.id!=='cv')return;
  const g=gridAt(e);if(!g)return;
  const c=pend>=0?pend:CS.sq,col=Math.abs(g.x-(X(c)+.5))<.56&&g.y>-1&&g.y<9,row=Math.abs(g.y-(Y(c)+.5))<.56&&g.x>-1&&g.x<9;
  if(!col&&!row)return;
  D={id:e.pointerId,cx:e.clientX,cy:e.clientY,col,row,axis:null,moved:false,v:0,cell:-1};
}
function dragMove(e){
  if(!D||e.pointerId!==D.id)return;
  const dx=e.clientX-D.cx,dy=e.clientY-D.cy;
  if(!D.moved){
    if(Math.hypot(dx,dy)<8)return;
    const h=Math.abs(dx)>=Math.abs(dy);
    if(D.col&&D.row)D.axis=h?'x':'y';
    else if(D.col&&h)D.axis='x';else if(D.row&&!h)D.axis='y';
    else{D=null;return}   // 슬라이더가 움직이지 않는 쪽으로 끌면 끌기가 아님
    D.moved=true;try{$('#cv').setPointerCapture(e.pointerId)}catch(_){}
    pend=-1;
  }
  const g=gridAt(e);if(!g)return;
  const v=Math.max(0,Math.min(7,g[D.axis]-.5)),c=Math.round(v),sq=D.axis==='x'?IX(c,Y(CS.sq)):IX(X(CS.sq),c);
  D.v=v;P3.dirty=true;
  if(sq!==D.cell){
    D.cell=sq;const ok=lines().includes(sq);pend=ok?sq:-1;
    if(ok)sndTick();
    if(sq===CS.sq||ok)flash=-1;else{flash=sq;flashAt=clock()+1e6}
    redraw();
  }
}
function dragEnd(e){
  if(!D||e.pointerId!==D.id)return;
  const was=D.moved;D=null;
  if(!was)return;
  P3.movedAt=clock();flash=-1;
  if(pend<0)sndNo();else sndLift(.1);
  redraw();
}
/* 새 상태를 받았을 때 */
G.preView=()=>{
  if(!V.pxl){CS=null;return}
  CS=buildS(V.pxl);
  if(!PV||!PV.pxl||PV.st!==V.st||PV.pxl.n!==V.pxl.n||PV.pxl.A!==V.pxl.A){pend=-1;D=null}
  if(V.st!=='play')pend=-1;
};
G.postView=()=>{};
G.overExtra=()=>'';
G.logCue=()=>false;
G.overDelay=()=>CS&&CS.win.length?1900:0;
G.cues=(v,pv)=>{
  if(!v.pxl||!pv.pxl)return;
  if(v.pxl.n>pv.pxl.n){
    const at=P3.on?.2:0;sndSlide(0);sndPut(at+.12);
    if(v.pxl.win&&v.pxl.win.length)sndWin(at+.55);
  }
};
G.hud=inGame=>{
  if(!elPx)return;
  const on=!!(inGame&&V&&V.pxl&&CS);
  elPx.hidden=!on;
  $('#stage').classList.toggle('pxl-over',!!(on&&V.st==='over'));
  const d3=on&&d3Build();
  if(d3!==P3.on){P3.on=d3;P3.lay='';if(P3.root)P3.root.visible=d3;$('#stage').classList.toggle('pxl3d',d3);lastBoard='';lastHint=''}
  $('#stage').classList.toggle('pxl2d',on&&!d3);
  if(!on){lastBoard='';lastBar='';lastHint='';return}
  drawAll();
  d3Sync();
};
G.handMarks=()=>{};
G.me=()=>{$('#numpick').hidden=true};
G.overRank=p=>{
  const t=p.sr===3?'탈주':p.sr?'항복':'';
  if(t)return `<span class="left">${t}</span>`;
  const i=V&&V.ps?V.ps.indexOf(p):-1,c=V&&V.pxl;
  return c&&c.ln&&i>=0?`<span class="left">${c.need-1}줄 ${c.ln[i]}개</span>`:'';
};
G.usesDbl=true;
G.no3D=true;
G.buttons=()=>{
  const play=$('#btnPlay'),can=pend>=0&&myTurnNow();
  $('#btnPass').hidden=true;$('#btnGura').hidden=true;
  play.disabled=!can;play.classList.toggle('ready',can);
  if($('#playMain').textContent!=='놓기')$('#playMain').textContent='놓기';
  const sub=keyLabel(KEYS.play);if($('#playSub').textContent!==sub)$('#playSub').textContent=sub;
};
G.live=()=>{
  if(IN.on)introTick();
  if(!V||!V.pxl||!CS)return;
  const bar=elPx&&elPx.querySelector('.pxl-p.on .tb i');
  if(bar&&V.st==='play'){const left=Math.max(0,(V.deadAt-clock())/1000);bar.style.width=Math.min(100,left/(V.cfg.turn||30)*100)+'%'}
  if(flash>=0&&!P3.on&&clock()-flashAt>720){flash=-1;lastBoard='';drawAll()}
};
G.play=()=>confirmPend();
G.pass=()=>{};
G.keyPhase=st=>st==='play';
G.onKey=()=>false;
G.field3D=()=>{if(T.stacks)for(const arr of T.stacks.values())arr.forEach(c=>{c.visible=false})};
G.render3D=t=>{if(P3.on)d3Render(t);else if(T.ok&&!$('#stage').classList.contains('pxl2d'))T.r.render(T.scene,T.cam)};
G.enter=()=>{
  $('#stage').classList.add('pxl');
  $('#btnPass').hidden=true;$('#btnGura').hidden=true;$('#numpick').hidden=true;
  pend=-1;D=null;
  if(elPx)fit();
};
G.leave=()=>{
  introEnd();
  $('#stage').classList.remove('pxl','pxl-over','pxl3d','pxl2d');
  if(T.stacks)for(const arr of T.stacks.values())arr.forEach(c=>{c.visible=true});
  if(P3.root)P3.root.visible=false;P3.on=false;P3.anim=[];D=null;
  for(const g of P3.tiles.values())if(P3.pg)P3.pg.remove(g);P3.tiles.clear();P3.mvN=-1;P3.winDone=false;P3.winAt=0;
  $('#btnPass').hidden=false;
  if(elPx){elPx.hidden=true;lastBoard='';lastBar='';lastHint=''}
};
G.init=()=>{
  const css=document.createElement('style');
  css.textContent=`
.stage.pxl{background:radial-gradient(ellipse at 50% 38%,#f3e4c2 0%,#e2c89a 70%,#d3b27c 100%)}
.stage.pxl.pxl2d #cv,.stage.pxl #dim{visibility:hidden}
.stage.pxl3d #cv{touch-action:none}
.stage.pxl-intro .actions,.stage.pxl-intro .myplate,.stage.pxl-intro #pxl .pxl-row{opacity:0;pointer-events:none}
.stage.pxl .actions,.stage.pxl .myplate,#pxl .pxl-row,#pxl .pxl-bar,#pxl .pxl-mebar{transition:opacity .35s}
#pxl.intro .pxl-bar,#pxl.intro .pxl-mebar{opacity:0}
.stage.pxl3d #pxl svg.pxl-board{display:none}
.stage.pxl3d #pxl .pxl-hint{flex:0 1 auto;background:rgba(255,250,240,.9);border:1px solid var(--line-strong,#cdb391);border-radius:99px;padding:4px 12px;box-shadow:0 2px 6px -2px rgba(59,42,31,.35)}
.stage.pxl .labels{visibility:hidden}
.stage.pxl .nogl{display:none}
.stage.pxl.pxl-over .myplate,.stage.pxl.pxl-over .actions{display:none}
.specbar:not([hidden])~#pxl .pxl-bar{margin-top:30px}
.stage.pxl .actions{left:auto}
.stage.pxl .myplate{max-width:calc(100% - 150px)}
#pxl{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;gap:6px;padding:8px 10px 82px;pointer-events:none;min-height:0}
#pxl[hidden]{display:none}
#pxl .pxl-bar{min-height:44px;display:flex;flex-wrap:wrap;justify-content:center;align-items:flex-start;align-content:flex-end;gap:6px;align-self:center;max-width:calc(100% - 188px);pointer-events:none}
#pxl .pxl-mebar{position:absolute;left:50%;bottom:var(--plateB,14px);transform:translateX(-50%);z-index:2;display:flex;pointer-events:none;max-width:calc(100% - 188px)}
#pxl .pxl-mebar:empty{display:none}
#pxl .pxl-p{position:relative;display:flex;align-items:center;gap:6px;padding:4px 10px 6px;border-radius:12px;background:rgba(255,250,240,.92);border:1.5px solid var(--line-strong,#cdb391);font-size:13px;line-height:1.15;overflow:hidden;white-space:nowrap;max-width:100%}
#pxl .pxl-p .dot{width:12px;height:12px;border-radius:2px;background:var(--pc);box-shadow:0 0 0 1.5px rgba(59,42,31,.5);flex:none}
#pxl .pxl-p b{font-weight:600;overflow:hidden;text-overflow:ellipsis;max-width:8em}
#pxl .pxl-p .st{font-size:12px;color:var(--muted,#7a6550)}
#pxl .pxl-p.on{border-color:var(--pc);box-shadow:0 0 0 2px var(--pc)}
#pxl .pxl-p.out{opacity:.55}
#pxl .pxl-p .tb{position:absolute;left:0;right:0;bottom:0;height:3px;background:rgba(0,0,0,.08)}
#pxl .pxl-p .tb i{display:block;height:100%;width:100%;background:var(--pc)}
#pxl .pxl-row{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;width:100%;pointer-events:none;min-height:44px}
.stage.pxl3d #pxl .pxl-row{height:44px;min-height:0;flex:none;align-items:flex-start;padding-top:4px;overflow:visible;position:relative;z-index:1}
#pxl .pxl-hint:empty{visibility:hidden}
#pxl .pxl-hint{flex:1 1 200px;min-width:0;font-size:13px;line-height:1.3;color:#5b4129;text-align:center;min-height:17px}
#pxl .pxl-bd{position:relative;flex:1;min-height:0;width:100%}
#pxl svg.pxl-board{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);pointer-events:auto;touch-action:manipulation;user-select:none;-webkit-user-select:none;filter:drop-shadow(0 6px 8px rgba(59,42,31,.35))}
@media (max-width:520px){#pxl .pxl-p{font-size:12px;padding:3px 8px 5px;gap:5px}#pxl .pxl-bar{max-width:calc(100% - 150px)}}
.stage.pxl3d #pxl .pxl-row{order:-1}
.stage.pxl3d #pxl.lay .pxl-bar{transform:translateY(calc(var(--bs) - 100%));transition:transform .35s,opacity .35s}
.stage.pxl3d #pxl.lay .pxl-mebar{top:var(--mt);bottom:auto;transition:top .35s,opacity .35s}
.stage.pxl3d .specbar:not([hidden])~#pxl .pxl-bar{margin-top:0}
.stage.pxl3d .specbar:not([hidden])~#pxl .pxl-row{margin-top:30px}
.stage.pxl3d #pxl.wide .pxl-row{position:absolute;left:16px;top:8px;width:auto;max-width:30%;justify-content:flex-start}
.stage.pxl3d #pxl.wide .pxl-bar{min-height:0}
.stage.pxl3d .specbar:not([hidden])~#pxl.wide .pxl-bar{margin-top:30px}
@media (max-width:699px){#pxl{padding-bottom:112px}#pxl .pxl-mebar{bottom:70px;max-width:calc(100% - 24px)}}
`;
  document.head.appendChild(css);
  elPx=document.createElement('div');elPx.id='pxl';elPx.hidden=true;
  elPx.innerHTML=`<div class="pxl-bar"></div><div class="pxl-mebar"></div><div class="pxl-row"><div class="pxl-hint" aria-live="polite"></div></div><div class="pxl-bd"><svg class="pxl-board" viewBox="-.4 -.4 8.8 8.8" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="픽셀 판"><g id="pxlMain"></g></svg></div>`;
  $('#stage').insertBefore(elPx,$('#fx'));
  elSvg=elPx.querySelector('svg.pxl-board');elMain=elPx.querySelector('#pxlMain');
  elBar=elPx.querySelector('.pxl-bar');elBarMe=elPx.querySelector('.pxl-mebar');elHint=elPx.querySelector('.pxl-hint');
  elSvg.addEventListener('click',onSvgClick);
  document.addEventListener('keydown',e=>{if(e.code==='Escape'&&pend>=0&&elPx&&!elPx.hidden){pend=-1;redraw()}});
  window.addEventListener('resize',()=>{fit();P3.lay=''});
  const cv=$('#cv');
  cv.addEventListener('click',d3Click);cv.addEventListener('pointerdown',dragDown);cv.addEventListener('pointermove',dragMove);cv.addEventListener('pointerup',dragEnd);cv.addEventListener('pointercancel',dragEnd);
};
G._d3={P3,IN,introEnd,gridAt,get CS(){return CS},tapSq,get pend(){return pend},lines,get D(){return D}};   // 화면 검사용

if(typeof window!=='undefined')(window.GAMES=window.GAMES||{}).pixel=G;
})();
