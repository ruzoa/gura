/* ===== 쿼리도 게임 모듈 =====
   공통 코드(index.html)가 GAMES.quoridor의 함수를 불러서 이 게임의 규칙·봇·화면을 그림.
   9×9 보드. 칸 (r,c): r = 위에서 아래로 0~8, c = 왼쪽에서 오른쪽으로 0~8.
   여기 좌표는 모두 '실제' 좌표이고, 화면은 내 출발점이 아래로 오게 돌려서 그림.
   벽 (r,c,o): 칸 (r,c)의 오른쪽 아래 모서리를 가운데로 하는 두 칸 길이 벽. o=0 가로, o=1 세로, r·c = 0~7
   출발 변: 0 아래, 1 왼쪽, 2 위, 3 오른쪽 (목표는 맞은편 변의 아무 칸)
   손패(hand)는 카드가 아니라 '말 1개'를 뜻하는 표시: 공통 코드가 hand가 비면 끝난 사람으로 보기 때문에 게임 중에는 [0]으로 둠 */
(function(){
const G={id:'quoridor',name:'쿼리도',short:'쿼리도',lead:'벽을 세워 길을 막는 보드게임',brand:'쿼리도',brandPx:56,maxHi:4,noFast:true};   // 공식 규칙: 한 명이 도착하면 끝 (게임 모드 선택 없음)

/* ---------- 규칙 (방장 엔진과 화면이 같은 함수를 씀) ---------- */
const DIRS=[[-1,0],[0,1],[1,0],[0,-1]];   // 위 오른쪽 아래 왼쪽
const SIDE_START=[[8,4],[4,0],[0,4],[4,8]];
const SEATS={2:[0,2],3:[0,3,2],4:[0,3,2,1]};   // 자리 순서: 아래 → 오른쪽 → 위 → 왼쪽 (테이블에서 도는 방향과 같음)
const PCOL=['#c53026','#2b65ca','#1f7a2e','#c9831a'];
const PDARK=['#8e1f18','#1c4690','#14551f','#8f5a0e'];
const atGoal=(s,r,c)=>{const g=(s+2)&3;return g===0?r===8:g===1?c===0:g===2?r===0:c===8};
const mkB=()=>({hw:Array.from({length:8},()=>Array(8).fill(0)),vw:Array.from({length:8},()=>Array(8).fill(0))});
/* 좌표 (체스식, 모두에게 같은 절대 좌표): 세로줄 a~i(왼쪽→오른쪽), 가로줄 1~9(아래 출발점 쪽이 1)
   칸 (r,c) → 'e1'. 벽은 가운데 모서리를 오른쪽 위 꼭짓점으로 갖는 칸 + h(가로)/v(세로): 벽 (r,c,o) → 'e1h' */
const COLS='abcdefghi';
const sqName=(r,c)=>COLS[c]+(9-r);
const wallName=(r,c,o)=>COLS[c]+(8-r)+(o?'v':'h');
const CNAME=['빨강','파랑','초록','주황'];
const wallsPer=(w,cnt)=>cnt<=2?w:Math.max(1,Math.floor(w*2/cnt));
/* (r,c)에서 d방향 옆 칸으로 갈 수 있는가: 가장자리와 벽만 따짐 (말은 따지지 않음) */
function canStep(B,r,c,d){
  const dr=DIRS[d][0],dc=DIRS[d][1],nr=r+dr,nc=c+dc;
  if(nr<0||nr>8||nc<0||nc>8)return false;
  if(dr){const rr=dr>0?r:nr;return !((c<=7&&B.hw[rr][c])||(c>=1&&B.hw[rr][c-1]))}
  const cc=dc>0?c:nc;
  return !((r<=7&&B.vw[r][cc])||(r>=1&&B.vw[r-1][cc]))
}
const pawnAt=(S,r,c)=>{for(let i=0;i<S.pos.length;i++){const p=S.pos[i];if(p&&!S.done[i]&&p[0]===r&&p[1]===c)return i}return -1};
/* i가 지금 갈 수 있는 칸들: 한 칸 이동, 말을 뛰어넘기, 뒤가 막히면 대각선 */
function legalMoves(S,i){
  const p=S.pos[i],out=[];if(!p||S.done[i])return out;
  const r=p[0],c=p[1];
  for(let d=0;d<4;d++){
    if(!canStep(S.B,r,c,d))continue;
    const nr=r+DIRS[d][0],nc=c+DIRS[d][1];
    if(pawnAt(S,nr,nc)<0){out.push([nr,nc]);continue}
    const jr=nr+DIRS[d][0],jc=nc+DIRS[d][1];
    if(canStep(S.B,nr,nc,d)&&pawnAt(S,jr,jc)<0){out.push([jr,jc]);continue}
    for(const e of [(d+1)&3,(d+3)&3]){
      if(!canStep(S.B,nr,nc,e))continue;
      const sr=nr+DIRS[e][0],sc=nc+DIRS[e][1];
      if(pawnAt(S,sr,sc)<0)out.push([sr,sc]);
    }
  }
  return out;
}
/* 말을 무시하고 목표 변까지 가장 짧은 길의 칸 수 (길이 없으면 -1) */
function dist(S,i){
  const p=S.pos[i];if(!p||S.done[i])return -1;
  const sd=S.sd[i],B=S.B,seen=new Uint8Array(81),q=[p[0]*9+p[1]],lv=[0];
  seen[q[0]]=1;
  for(let h=0;h<q.length;h++){
    const cur=q[h],r=(cur/9)|0,c=cur%9;
    if(atGoal(sd,r,c))return lv[h];
    for(let d=0;d<4;d++){
      if(!canStep(B,r,c,d))continue;
      const n=(r+DIRS[d][0])*9+c+DIRS[d][1];
      if(!seen[n]){seen[n]=1;q.push(n);lv.push(lv[h]+1)}
    }
  }
  return -1;
}
/* 가장 짧은 길의 칸 목록 (r*9+c), 없으면 null */
function path(S,i){
  const p=S.pos[i];if(!p||S.done[i])return null;
  const sd=S.sd[i],B=S.B,par=new Array(81).fill(-2),q=[p[0]*9+p[1]];
  par[q[0]]=-1;
  for(let h=0;h<q.length;h++){
    const cur=q[h],r=(cur/9)|0,c=cur%9;
    if(atGoal(sd,r,c)){const out=[];for(let x=cur;x>=0;x=par[x])out.push(x);return out.reverse()}
    for(let d=0;d<4;d++){
      if(!canStep(B,r,c,d))continue;
      const n=(r+DIRS[d][0])*9+c+DIRS[d][1];
      if(par[n]===-2){par[n]=cur;q.push(n)}
    }
  }
  return null;
}
/* 벽이 보드 안에 있고 다른 벽과 겹치거나 가로지르지 않는가 */
function wallFits(B,r,c,o){
  if(r<0||r>7||c<0||c>7)return false;
  if(B.hw[r][c]||B.vw[r][c])return false;
  if(o===0)return !((c>0&&B.hw[r][c-1])||(c<7&&B.hw[r][c+1]));
  return !((r>0&&B.vw[r-1][c])||(r<7&&B.vw[r+1][c]));
}
/* 놓을 수 있는 벽인가: 겹침 없음 + 아직 끝나지 않은 모든 말이 목표까지 갈 길이 남음 */
function wallOK(S,r,c,o){
  if(!wallFits(S.B,r,c,o))return false;
  const arr=o===0?S.B.hw:S.B.vw;arr[r][c]=1;
  let ok=true;
  for(let i=0;i<S.pos.length&&ok;i++)if(S.pos[i]&&!S.done[i]&&dist(S,i)<0)ok=false;
  arr[r][c]=0;
  return ok;
}
/* 시험 삼아 두어 보기: 되돌리는 함수를 돌려줌 */
function apply(S,i,a){
  if(a.k===0){const o=S.pos[i];S.pos[i]=[a.r,a.c];return ()=>{S.pos[i]=o}}
  const arr=a.o===0?S.B.hw:S.B.vw;arr[a.r][a.c]=1;S.wl[i]--;
  return ()=>{arr[a.r][a.c]=0;S.wl[i]++};
}

/* ---------- 봇 ---------- */
/* 가고 있는 길을 막는 벽 후보 + 갈 수 있는 칸 */
function actions(S,i){
  const out=legalMoves(S,i).map(m=>({k:0,r:m[0],c:m[1]}));
  if(S.wl[i]>0){
    const seen=new Set();
    for(let j=0;j<S.pos.length;j++){
      if(j===i)continue;
      const pt=path(S,j);if(!pt)continue;
      for(let t=0;t+1<pt.length;t++){
        const a=pt[t],b=pt[t+1],ar=(a/9)|0,ac=a%9,br=(b/9)|0,bc=b%9;
        const ws=ar!==br?[[Math.min(ar,br),ac,0],[Math.min(ar,br),ac-1,0]]:[[ar,Math.min(ac,bc),1],[ar-1,Math.min(ac,bc),1]];
        for(const [r,c,o] of ws){
          const key=r+','+c+','+o;if(seen.has(key))continue;seen.add(key);
          if(wallOK(S,r,c,o))out.push({k:1,r,c,o});
        }
      }
    }
  }
  return out;
}
/* i에게 얼마나 유리한가: 상대는 멀수록, 나는 가까울수록 좋고, 남은 벽도 조금 쳐줌 */
function evalS(S,i,lv){
  const me=dist(S,i);
  if(me<0)return -1e5;
  if(me===0)return 1e4;
  let mn=99,sum=0,cnt=0;
  for(let j=0;j<S.pos.length;j++){
    if(j===i||!S.pos[j]||S.done[j])continue;
    const d=dist(S,j);if(d===0)return -1e4;
    if(d<0)continue;
    mn=Math.min(mn,d);sum+=d;cnt++;
  }
  if(!cnt)return 1e4;
  const op=cnt>1?.6*mn+.4*sum/cnt:mn;
  return op-me+(lv>=2?.35:.2)*S.wl[i];
}
const othersAlive=(S,i)=>S.pos.reduce((a,p,j)=>a+(j!==i&&p&&!S.done[j]?1:0),0);
function botChoose(S,i,lv){
  const moves=legalMoves(S,i);
  if(lv===0){
    if(S.wl[i]>0&&Math.random()<.12){const ws=actions(S,i).filter(a=>a.k===1);if(ws.length){const w=ws[Math.random()*ws.length|0];return w}}
    if(!moves.length)return null;
    if(Math.random()<.2){const m=moves[Math.random()*moves.length|0];return {k:0,r:m[0],c:m[1]}}
    let best=null,bd=1e9;
    for(const m of moves){const o=S.pos[i];S.pos[i]=[m[0],m[1]];const d=dist(S,i);S.pos[i]=o;const s=d+Math.random()*.5;if(s<bd){bd=s;best=m}}
    return {k:0,r:best[0],c:best[1]};
  }
  const cands=actions(S,i);if(!cands.length)return null;
  let best=null,bs=-1e9;
  if(lv>=2&&othersAlive(S,i)===1){
    // 어려움 (1대1): 내가 둔 뒤 상대가 가장 아프게 받아치는 것까지 따져서 고름
    const o=S.pos.findIndex((p,j)=>j!==i&&p&&!S.done[j]);
    for(const a of cands){
      const u=apply(S,i,a);let s;
      if(a.k===0&&atGoal(S.sd[i],a.r,a.c))s=1e4;
      else{
        let worst=1e9;
        for(const b of actions(S,o)){
          const u2=apply(S,o,b);
          const v=(b.k===0&&atGoal(S.sd[o],b.r,b.c))?-1e4:evalS(S,i,2);
          u2();if(v<worst)worst=v;
        }
        s=worst===1e9?evalS(S,i,2):worst;
      }
      u();s+=Math.random()*.15;
      if(s>bs){bs=s;best=a}
    }
    return best;
  }
  for(const a of cands){
    const u=apply(S,i,a),s=evalS(S,i,lv)+Math.random()*(lv>=2?.15:.7);u();
    if(s>bs){bs=s;best=a}
  }
  return best;
}

/* ---------- 규칙 설명·방 설정 ---------- */
G.rulesHTML='<ol class="rules"><li><b>목표</b> : 내 말을 맞은편 끝줄의 아무 칸에 가장 먼저 도착시키면 <b>승리</b>하고 게임이 끝납니다. 나머지 순위는 목표까지 남은 거리가 짧은 순서입니다</li><li><b>내 차례</b> : <b>말 이동</b>과 <b>벽 세우기</b> 중 하나만 합니다</li><li><b>말 이동</b> : 위·아래·왼쪽·오른쪽으로 한 칸. 벽은 넘을 수 없습니다</li><li><b>뛰어넘기</b> : 상대 말이 바로 앞에 있으면 그 말을 뛰어넘습니다. 그 뒤가 벽이나 끝이라서 못 넘으면 대각선 옆 칸으로 비켜 갑니다</li><li><b>벽 세우기</b> : 칸 사이의 틈에 두 칸 길이의 벽을 놓아 길을 막습니다. 벽은 한 번 놓으면 옮길 수 없고, 벽끼리 겹치거나 십자로 놓을 수 없습니다</li><li><b>반칙</b> : 누구든 목표까지 갈 길이 완전히 막히는 자리에는 벽을 놓을 수 없습니다</li><li><b>4명</b> : 네 방향에서 출발해 맞은편 끝줄이 목표입니다. 벽은 인원수대로 나눠 가집니다</li><li><b>제한 시간</b> : 내 차례에 제한 시간이 지나면 <b>패배</b>합니다. 연결이 끊긴 사람은 봇이 대신 둡니다</li><li><b>기보</b> : 세로줄은 왼쪽부터 a~i, 가로줄은 빨강 출발점 쪽부터 1~9입니다. 말 이동은 도착한 칸(e2), 벽은 벽 가운데가 오른쪽 위 꼭짓점인 칸에 가로 h·세로 v를 붙여 적습니다(e3h)</li></ol>';
G.modeDesc=['먼저 도착한 사람이 이기면 끝','먼저 도착한 사람이 이기면 끝'];
G.defaults={max:2,walls:10,turn:30};
G.roomSet=[
  {k:'walls',label:'벽 개수',unit:'개',lo:4,hi:20,step:1,desc:'2명일 때 1인당 벽 수. 3·4명이면 전체 벽 수를 인원수대로 나눕니다'},
  {k:'turn',label:'제한 시간',unit:'초',lo:10,hi:180,step:5,desc:'제한 시간이 지나면 패배합니다. 연결이 끊긴 사람은 봇이 대신 둡니다'}];
G.ruleSet=[];
G.cfgChips=c=>`<span class="chip">벽 <b>${+c.walls||10}개</b></span><span class="chip">제한 시간 <b>${+c.turn}초</b></span>`;
G.cfgSum=c=>`벽 ${+c.walls||10}개 (2명 기준) · 제한 시간 ${+c.turn}초`;
G.roomSub=x=>`벽 ${x.wl||10}개`;
G.pubExtra=c=>({wl:+c.walls||10});
G.cardInfo=(c,nowN)=>{
  const n=Math.max(2,Math.min(4,nowN)),per=wallsPer(+c.walls||10,n);
  return `<p class="cardinfo">지금 ${nowN}명이면 1인당 벽 ${per}개${nowN===3?'<br>3명이면 한쪽 변이 비어서 2명·4명보다 균형이 덜 맞습니다.':''}${nowN>4?'<br>쿼리도는 최대 4명까지 할 수 있습니다.':''}</p>`;
};
G.rankTitle=()=>'';
G.finLabel=()=>'도착';
G.noEmotes=['gq'];
G.keys={qmode:'KeyX',qrot:'KeyR'};
G.keyActions=[
  {a:'qmode',n:'이동 / 벽 바꾸기',d:'말을 움직이는 모드와 벽을 세우는 모드를 바꿉니다'},
  {a:'qrot',n:'벽 방향',d:'가로·세로가 애매한 모서리에서 벽 방향을 바꿉니다'}];
/* 이 게임에는 카드가 없음 (공통 코드가 부르는 자리만 채움) */
const cmpCard=()=>0;
G.cardHTML=()=>'';G.drawFace=()=>{};G.cmpCard=cmpCard;G.labelOf=()=>'';

/* ---------- 방장 엔진 (규칙 처리) ---------- */
const PAWN=()=>[0];
function nextP(i){const n=H.players.length;for(let k=1;k<=n;k++){const j=(i+k)%n;if(!H.players[j].finished)return j}return -1}
function startTurn(i,guard){
  if(i<0){checkEnd();return}
  H.turn=i;H.graceUntil=0;
  H.deadline=clock()+H.cfg.turn*1000;
  H.botActAt=H.players[i].bot?clock()+rand(900,2000):0;
  // 움직일 수도 벽을 놓을 수도 없으면 차례를 넘김 (아주 드문 경우)
  if(!(guard>H.players.length)&&!legalMoves(H.q,i).length&&!(H.q.wl[i]>0)){
    addLog(`${H.players[i].name} 움직일 수 없어 차례를 넘깁니다.`,'sys');
    startTurn(nextP(i),(guard||0)+1);return;
  }
  mark();
}
function endTurn(i){if(H.phase==='play')startTurn(nextP(i))}
/* 기보에 한 수 적기: 출발 순서가 한 바퀴 돌면 수 번호가 1 늘어남 (차례 밖의 항복은 번호를 바꾸지 않음) */
function recAdd(i,m,outOfTurn){
  const Q=H.q,n=Q.n;
  if(!outOfTurn){const pos=(i-Q.first+n)%n;if(pos<=Q.lastPos)Q.rnd++;Q.lastPos=pos}
  Q.rec.push([Q.rnd,i,m]);
  return Q.rnd;
}
function doMove(i,r,c){
  const Q=H.q,p=H.players[i];
  Q.pos[i]=[r,c];Q.lm={p:i,k:0,r,c};H.seatNote[i]='이동';
  const n=recAdd(i,sqName(r,c));
  addLog(`${n}. ${p.name} ${sqName(r,c)}`);
  if(atGoal(Q.sd[i],r,c)){finish(i);if(H.phase==='over')return}
  endTurn(i);
}
function doWall(i,r,c,o){
  const Q=H.q,p=H.players[i];
  (o===0?Q.B.hw:Q.B.vw)[r][c]=1;Q.walls.push([r,c,o,i]);Q.wl[i]--;
  Q.lm={p:i,k:1,r,c,o};H.seatNote[i]='벽';
  const n=recAdd(i,wallName(r,c,o));
  addLog(`${n}. ${p.name} ${wallName(r,c,o)} 벽 (남은 벽 ${Q.wl[i]}개)`);
  endTurn(i);
}
function doPass(i){endTurn(i)}
function finish(i){
  const p=H.players[i];p.finished=true;p.rank=H.rankNext++;p.hand=[];H.q.done[i]=1;
  addLog(`${p.name} 도착! ${p.rank}위`,'fin');
  if(p.rank===1){
    // 공식 규칙: 1등이 나오면 끝, 나머지는 목표까지 남은 길이 짧을수록 높은 순위 (같으면 공동 순위)
    const rest=H.players.filter(x=>!x.finished),S=H.q;
    const ds=rest.map(x=>{const d=dist(S,H.players.indexOf(x));return d<0?99:d});
    rest.forEach((x,j)=>{x.rank=2+ds.filter(d=>d<ds[j]).length;x.finished=true;x.hand=[]});
    addLog(`${p.name} 승리! 게임이 끝났습니다.`,'sys');H.phase='over';mark();return;
  }
  checkEnd();
}
/* 항복·시간 초과 패배: 보드에서 말을 빼고 남은 사람 중 꼴찌 순위 */
function knockOut(i,why){
  const p=H.players[i],Q=H.q;
  p.hand=[];p.finished=true;p.surrendered=why==='time'?'time':true;p.rank=H.rankBottom--;Q.done[i]=1;Q.pos[i]=null;
  if(Q.lm&&Q.lm.k===0&&Q.lm.p===i)Q.lm=null;
  const n=recAdd(i,why==='time'?'시간 초과':'항복',why!=='time');
  addLog(why==='time'?`${n}. ${p.name} 시간 초과로 패배! ${p.rank}위`:`${p.name} 항복! ${p.rank}위`,'lie');
}
function doSurrender(i){
  if(H.phase!=='play'||i<0||H.players[i].finished)return;
  knockOut(i,'surrender');
  if(H.players.filter(x=>!x.finished).length<=1){checkEnd();return}
  if(H.turn===i)startTurn(nextP(i));else mark();
}
function checkEnd(){
  const act=H.players.filter(p=>!p.finished);
  if(act.length<=1){
    if(act.length===1){act[0].finished=true;act[0].rank=H.rankNext++;act[0].hand=[]}
    addLog('게임 종료','sys');H.phase='over';mark();
    H.players.forEach((p,i)=>{if(p.bot&&Math.random()<.5)botEmote(i,'gg',800+Math.random()*1600)});
  }
}
/* 봇이 둘 수가 없을 때: 가장 가까운 길로 한 칸 */
function autoStep(i){
  const S=H.q,moves=legalMoves(S,i);
  if(!moves.length){doPass(i);return}
  let best=null,bd=1e9;
  for(const m of moves){const o=S.pos[i];S.pos[i]=[m[0],m[1]];const d=dist(S,i);S.pos[i]=o;const s=(d<0?99:d)+Math.random()*.3;if(s<bd){bd=s;best=m}}
  doMove(i,best[0],best[1]);
}
/* 제한 시간이 지나면 패배. 연결이 끊긴 사람(봇이 대신 맡은 자리)과 봇은 지지 않고 봇이 대신 둠 */
function timeout(){
  const i=H.turn,p=H.players[i];
  if(p.bot){botTurn(i);return}
  knockOut(i,'time');
  if(H.players.filter(x=>!x.finished).length<=1){checkEnd();return}
  startTurn(nextP(i));
}
function botTurn(i){
  const a=botChoose(H.q,i,botLv(H.players[i]));
  if(!a){autoStep(i);return}
  if(a.k===0)doMove(i,a.r,a.c);else doWall(i,a.r,a.c,a.o);
}
/* 테스트(tests/engine.test.js)에서 직접 부르는 내부 함수 */
G._test={sqName,wallName,timeout,recordText,mkB,canStep,legalMoves,dist,path,wallOK,wallFits,atGoal,botChoose,doMove,doWall,doSurrender,wallsPer,actions,pawnAt};
G.engine={
  /* 게임 시작: 공통 코드가 H.players를 만든 뒤 부름 */
  start(){
    const n=H.players.length,cnt=Math.max(2,Math.min(n,4)),seats=SEATS[cnt];
    const per=wallsPer(+H.cfg.walls||10,cnt);
    Object.assign(H,{phase:'play',log:[],seatNote:{},field:[],last:null,reveal:null,shouts:[],pending:null,rankNext:1,rankBottom:n,known:{}});
    const Q={n,cnt,sd:[],pos:[],done:[],wl:[],B:mkB(),walls:[],lm:null,rec:[],rnd:1,lastPos:-1,first:0};
    H.rankBottom=cnt;   // 항복 순위는 실제로 말을 가진 사람 수 기준
    H.players.forEach((p,i)=>{
      if(i<cnt){Q.sd.push(seats[i]);Q.pos.push(SIDE_START[seats[i]].slice());Q.done.push(0);Q.wl.push(per);p.hand=PAWN()}
      else{Q.sd.push(0);Q.pos.push(null);Q.done.push(1);Q.wl.push(0);p.hand=[];p.finished=true;p.rank=i+1}   // 자리가 모자라면(5명 이상) 구경만 함 (보통은 최대 인원 4명이라 생기지 않음)
    });
    H.q=Q;
    const first=Math.random()*cnt|0;Q.first=first;
    addLog(`${cnt}명 게임 시작 (벽 ${per}개씩). ${H.players[first].name}부터 시작합니다.`,'sys');
    startTurn(first);
  },
  act(seat,a){
    if(a.t==='surrender'){doSurrender(seat);return}
    if(H.phase!=='play'||seat<0||H.turn!==seat)return;
    const Q=H.q;
    if(a.t==='move'){
      if(!Number.isInteger(a.r)||!Number.isInteger(a.c))return;
      if(legalMoves(Q,seat).some(m=>m[0]===a.r&&m[1]===a.c))doMove(seat,a.r,a.c);
    }else if(a.t==='wall'){
      if(!Number.isInteger(a.r)||!Number.isInteger(a.c)||(a.o!==0&&a.o!==1)||!(Q.wl[seat]>0))return;
      if(wallOK(Q,a.r,a.c,a.o))doWall(seat,a.r,a.c,a.o);
    }
  },
  tick(t){
    if(H.phase!=='play')return;
    const cur=H.players[H.turn];
    if(t>=H.deadline)timeout();
    else if(cur.bot&&H.botActAt&&t>=H.botActAt&&!(cur.away&&t<cur.awayAt+AWAY_WAIT))botTurn(H.turn);
  },
  snap(s,you,t){
    const Q=H.q;
    s.q={n:Q.n,cnt:Q.cnt,sd:Q.sd.slice(),pos:Q.pos.map(p=>p&&p.slice()),dn:Q.done.slice(),wl:Q.wl.slice(),w:Q.walls.map(w=>w.slice()),lm:Q.lm?{...Q.lm}:null,rec:Q.rec.map(x=>x.slice()),f0:Q.first};
    s.gr=0;s.dl=Math.max(0,Math.round(H.deadline-t));
  },
  restore(){},
  emoPhase:ph=>ph==='play'||ph==='over'
};

/* ---------- 화면 (모든 참가자) ---------- */
const rp=(x,y,k)=>{for(let t=0;t<k;t++){const nx=9-y;y=x;x=nx}return [x,y]};   // 점을 시계 방향으로 90°씩 k번 돌림
const rc=(r,c,k)=>{for(let t=0;t<k;t++){const nr=c,nc=8-r;r=nr;c=nc}return [r,c]};   // 칸을 시계 방향으로 90°씩 k번 돌림
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const VB={x:-.9,y:-.4,w:10.3};   // 보드 그림 범위: 왼쪽·아래에 좌표 글자 자리를 둠
let QS=null,viewK=0,qMode='move',qOri=0,pend=null,hov=null,lastPT='mouse',qMsg='',qMsgUntil=0,qMsgTimer=null;
let elQd=null,elSvg=null,elMain=null,elGhost=null,elBar=null,elHint=null,elModes=null,lastBoard='',lastBar='',lastHint='',lastModes='';
function buildS(q){
  const B=mkB();for(const w of q.w)(w[2]===0?B.hw:B.vw)[w[0]][w[1]]=1;
  return {n:q.n,cnt:q.cnt,sd:q.sd,pos:q.pos,done:q.dn,wl:q.wl.slice(),B,walls:q.w,lm:q.lm};
}
const myTurnNow=()=>!!(V&&V.q&&V.st==='play'&&myReady());
function say(txt){
  qMsg=txt;qMsgUntil=Date.now()+2400;drawHint();
  clearTimeout(qMsgTimer);qMsgTimer=setTimeout(drawHint,2500);
}
/* 화면 좌표(화면을 돌린 뒤 기준) → 실제 좌표 */
const toAbsCell=(vr,vc)=>rc(vr,vc,(4-viewK)&3);
function toAbsWall(X,Y,vo){const [ax,ay]=rp(X,Y,(4-viewK)&3);return {r:ay-1,c:ax-1,o:vo^(viewK&1)}}
function toLat(e){
  const r=elSvg.getBoundingClientRect(),s=Math.min(r.width,r.height)||1;
  const ox=(r.width-s)/2,oy=(r.height-s)/2;
  return [(e.clientX-r.left-ox)/s*VB.w+VB.x,(e.clientY-r.top-oy)/s*VB.w+VB.y];
}
function wallAt(x,y){
  if(x<-.25||y<-.25||x>9.25||y>9.25)return null;
  const Xr=Math.round(x),Yr=Math.round(y),dx=Math.abs(x-Xr),dy=Math.abs(y-Yr);
  const vo=dx<dy-.03?1:dy<dx-.03?0:qOri;   // 가까운 쪽 선을 따라 놓음 (거의 같으면 모서리: 고른 방향)
  if(vo===1&&(Xr<1||Xr>8))return null;
  if(vo===0&&(Yr<1||Yr>8))return null;
  return vo===1?{X:Xr,Y:clamp(Yr,1,8),vo}:{X:clamp(Xr,1,8),Y:Yr,vo};
}
function wallLegal(w){
  if(!QS||myIdx()<0||!(QS.wl[myIdx()]>0))return false;
  return wallOK(QS,w.r,w.c,w.o);
}
function sendWall(w){sendAct({t:'wall',r:w.r,c:w.c,o:w.o});pend=null;hov=null;drawGhost();drawHint();G.buttons()}
function onSvgClick(e){
  if(!V||!V.q||V.st!=='play'||!QS)return;
  const me=myIdx();if(me<0)return;
  if(!myTurnNow()){say(V.t===me?'잠시만 기다려 주세요.':'아직 내 차례가 아닙니다.');return}
  const [x,y]=toLat(e);
  if(qMode==='move'){
    if(x<-.3||y<-.3||x>9.3||y>9.3)return;
    const vr=clamp(Math.floor(y),0,8),vc=clamp(Math.floor(x),0,8),[r,c]=toAbsCell(vr,vc);
    if(legalMoves(QS,me).some(m=>m[0]===r&&m[1]===c)){sfxMove();sendAct({t:'move',r,c})}
    else say('그 칸으로는 갈 수 없습니다. 초록 점이 있는 칸만 갈 수 있습니다.');
    return;
  }
  const w=wallAt(x,y);if(!w)return;
  const abs=toAbsWall(w.X,w.Y,w.vo);
  if(!wallLegal(abs)){say(QS.wl[me]>0?'그 자리에는 벽을 놓을 수 없습니다. 벽끼리 겹치거나 길을 완전히 막으면 안 됩니다.':'남은 벽이 없습니다.');return}
  if(lastPT==='mouse'||(pend&&pend.r===abs.r&&pend.c===abs.c&&pend.o===abs.o)){sendWall(abs);return}
  pend=abs;hov=null;drawGhost();drawHint();G.buttons();
}
const sfxMove=()=>{try{sfx('pick')}catch(e){}};
function onSvgMove(e){
  if(e.pointerType==='touch'||qMode!=='wall'||!myTurnNow()||!QS)return;
  const [x,y]=toLat(e),w=wallAt(x,y);
  if(!w){if(hov){hov=null;drawGhost();drawHint()}return}
  const abs=toAbsWall(w.X,w.Y,w.vo);
  if(hov&&hov.r===abs.r&&hov.c===abs.c&&hov.o===abs.o)return;
  hov={...abs,ok:wallLegal(abs)};drawGhost();drawHint();
}
/* 벽 한 개를 그리는 선 (실제 좌표의 벽 → 화면 좌표) */
function wallLine(r,c,o,col,w,op,extra){
  const [X,Y]=rp(c+1,r+1,viewK),vo=o^(viewK&1);
  const x1=vo===0?X-.94:X,x2=vo===0?X+.94:X,y1=vo===1?Y-.94:Y,y2=vo===1?Y+.94:Y;
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="${w}" stroke-linecap="round" opacity="${op}"${extra||''}/>`;
}
function drawGhost(){
  if(!elGhost)return;
  const g=hov||(pend&&qMode==='wall'?{...pend,ok:true}:null);
  elGhost.innerHTML=g&&qMode==='wall'?wallLine(g.r,g.c,g.o,g.ok?'#2f9e44':'#d6342a',.2,.78):'';
}
function boardHTML(S,me){
  const k=viewK,out=[];
  out.push('<rect x="-.34" y="-.34" width="9.68" height="9.68" rx=".38" fill="#8a5a32"/><rect x="-.1" y="-.1" width="9.2" height="9.2" rx=".12" fill="#c9a56e"/>');
  // 목표 변 표시: 끝나지 않은 사람마다 자기 색 띠를 바깥 테두리에 그림
  for(let i=0;i<S.n;i++){
    if(!S.pos[i]||S.done[i])continue;
    const gs=((S.sd[i]+2)&3),vs=(gs+k)&3,col=PCOL[i%4];
    out.push(vs===0?`<rect x=".3" y="9.13" width="8.4" height=".16" rx=".08" fill="${col}"/>`:vs===2?`<rect x=".3" y="-.29" width="8.4" height=".16" rx=".08" fill="${col}"/>`:vs===1?`<rect x="-.29" y=".3" width=".16" height="8.4" rx=".08" fill="${col}"/>`:`<rect x="9.13" y=".3" width=".16" height="8.4" rx=".08" fill="${col}"/>`);
  }
  // 좌표: 화면 아래 줄과 왼쪽 줄에 그 줄의 절대 좌표 (a~i 또는 1~9)
  {const back=(4-k)&3,lab=(r1,c1,r2,c2)=>{const a=rc(r1,c1,back),b=rc(r2,c2,back);return a[1]===b[1]?COLS[a[1]]:String(9-a[0])};
   for(let v=0;v<9;v++){
     out.push(`<text class="qd-co" x="${v+.5}" y="9.66">${lab(0,v,8,v)}</text>`);
     out.push(`<text class="qd-co" x="-.62" y="${v+.53}">${lab(v,0,v,8)}</text>`);
   }}
  for(let r=0;r<9;r++)for(let c=0;c<9;c++){const [vr,vc]=rc(r,c,k);out.push(`<rect x="${vc+.06}" y="${vr+.06}" width=".88" height=".88" rx=".1" fill="#f8ecd0"/>`)}
  // 갈 수 있는 칸
  const turnMe=myTurnNow()&&qMode==='move'&&me>=0;
  if(turnMe)for(const m of legalMoves(S,me)){const [vr,vc]=rc(m[0],m[1],k);out.push(`<rect x="${vc+.06}" y="${vr+.06}" width=".88" height=".88" rx=".1" fill="#cfe9b4"/><circle cx="${vc+.5}" cy="${vr+.5}" r=".15" fill="#2f9e44"/>`)}
  // 마지막에 둔 곳
  const lm=S.lm;
  if(lm&&lm.k===0){const [vr,vc]=rc(lm.r,lm.c,k);out.push(`<rect x="${vc+.06}" y="${vr+.06}" width=".88" height=".88" rx=".1" fill="none" stroke="${PCOL[lm.p%4]}" stroke-width=".07" stroke-dasharray=".18 .12" opacity=".85"/>`)}
  // 벽
  const lastW=lm&&lm.k===1?lm:null;
  for(const w of S.walls){
    const isLast=lastW&&lastW.r===w[0]&&lastW.c===w[1]&&lastW.o===w[2];
    if(isLast)out.push(wallLine(w[0],w[1],w[2],'#fff',.3,.9));
    out.push(wallLine(w[0],w[1],w[2],PDARK[w[3]%4],.2,1,''));
    out.push(wallLine(w[0],w[1],w[2],PCOL[w[3]%4],.12,1,''));
  }
  // 도착한 말은 흐리게 순위만 표시 (다른 말이 그 칸을 지나갈 수 있으므로 살아 있는 말보다 먼저 그림)
  for(let i=0;i<S.n;i++){
    const p=S.pos[i];if(!p||!S.done[i])continue;
    const [vr,vc]=rc(p[0],p[1],k),cx=vc+.5,cy=vr+.5,col=PCOL[i%4],rk=V.ps[i]&&V.ps[i].f;
    out.push(`<circle cx="${cx}" cy="${cy}" r=".3" fill="${col}" opacity=".28" stroke="${col}" stroke-width=".05"/><text x="${cx}" y="${cy+.11}" text-anchor="middle" font-size=".34" font-weight="700" fill="#3b2a1f" opacity=".75">${rk?+rk:''}</text>`);
  }
  for(let i=0;i<S.n;i++){
    const p=S.pos[i];if(!p||S.done[i])continue;
    const [vr,vc]=rc(p[0],p[1],k),cx=vc+.5,cy=vr+.5,col=PCOL[i%4];
    const on=V.st==='play'&&V.t===i;
    if(on)out.push(`<circle class="qd-pulse" cx="${cx}" cy="${cy}" r=".42" fill="none" stroke="${col}" stroke-width=".06"/>`);
    out.push(`<circle cx="${cx}" cy="${cy+.04}" r=".33" fill="#000" opacity=".22"/><circle cx="${cx}" cy="${cy}" r=".33" fill="${col}" stroke="#fffaf0" stroke-width=".07"/><circle cx="${cx-.09}" cy="${cy-.1}" r=".09" fill="#fff" opacity=".45"/>`);
    if(i===me)out.push(`<circle cx="${cx}" cy="${cy}" r=".09" fill="#fffaf0"/>`);
  }
  return out.join('');
}
function barHTML(q,me){
  return V.ps.map((p,i)=>{
    if(i>=q.cnt&&p.f)return '';
    const on=V.st==='play'&&V.t===i&&!p.f;
    return `<div class="qd-p${on?' on':''}${i===me?' me':''}${p.f?' out':''}" style="--pc:${PCOL[i%4]}"><i class="dot"></i><b>${esc(p.n)}${i===me?' (나)':''}</b>${p.f?`<span class="w">${p.sr===2?'시간 초과':p.sr?'항복':(+p.f)+'위'}</span>`:`<span class="w">벽 ${+q.wl[i]}</span>`}${on?'<span class="tb"><i></i></span>':''}</div>`;
  }).join('');
}
function hintText(me){
  if(Date.now()<qMsgUntil&&qMsg)return qMsg;
  if(!V||!V.q)return '';
  if(V.st==='over')return '게임이 끝났습니다.';
  if(me<0)return V.ps[V.t]?`${V.ps[V.t].n} 차례입니다. 관전 중입니다.${lastRec()}`:'';
  const p=V.ps[me];
  if(p.f)return p.sr===2?'제한 시간이 지나 패배했습니다. 남은 판을 지켜봅니다.':p.sr?'항복했습니다. 남은 판을 지켜봅니다.':V.q.dn[me]?'도착했습니다! 남은 판을 지켜봅니다.':'';
  if(V.t!==me)return V.ps[V.t]?`${V.ps[V.t].n} 차례입니다.${lastRec()}`:'';
  if(!myTurnNow())return '내 차례입니다.';
  {const left=(V.deadAt-clock())/1000;if(left<=10&&left>0)return `${Math.ceil(left)}초 남았습니다. 제한 시간이 지나면 패배합니다.`}
  if(qMode==='move')return V.q.wl[me]>0?'초록 점이 있는 칸을 눌러 말을 움직입니다. 벽을 세우려면 오른쪽 버튼을 누르세요.':'초록 점이 있는 칸을 눌러 말을 움직입니다. 남은 벽이 없습니다.';
  if(pend)return `${wallName(pend.r,pend.c,pend.o)} 벽: 이 자리가 맞으면 한 번 더 누르거나 [벽 놓기]를 누릅니다.`;
  if(hov)return hov.ok?`${wallName(hov.r,hov.c,hov.o)} 벽: 누르면 놓습니다.`:`${wallName(hov.r,hov.c,hov.o)}에는 벽을 놓을 수 없습니다.`;
  return '칸 사이의 틈을 눌러 벽을 놓을 자리를 고릅니다.';
}
/* 직전 수 한 줄 (예: ' · 직전 3. 나 e4') */
function lastRec(){
  const rec=V.q&&V.q.rec,L=rec&&rec[rec.length-1];
  return L&&V.ps[L[1]]?` · 직전 ${L[0]}. ${V.ps[L[1]].n} ${L[2]}`:'';
}
/* 기보 글: 2명이면 체스처럼 '1. e2 e8', 3명 이상이거나 순서가 비면 색 이름을 붙임 */
function recordText(v){
  const q=v.q,rec=q.rec||[],cnt=q.cnt,f0=q.f0||0,order=Array.from({length:q.n},(_,k)=>(f0+k)%q.n).filter(i=>i<cnt);
  const name=i=>v.ps[i]?v.ps[i].n:'?';
  const lines=['쿼리도 기보',order.map(i=>`${CNAME[i%4]}: ${name(i)}`).join(' · ')];
  const rounds=new Map();for(const [n,i,m] of rec){if(!rounds.has(n))rounds.set(n,[]);rounds.get(n).push([i,m])}
  for(const [n,list] of rounds){
    const plain=cnt===2&&list.every(([i],k)=>i===order[k]);
    lines.push(`${n}. `+list.map(([i,m])=>plain?m:`${CNAME[i%4]} ${m}`).join(plain?' ':', '));
  }
  if(v.st==='over')lines.push('결과: '+v.ps.map((p,i)=>({p,i})).filter(x=>x.i<cnt&&x.p.f).sort((a,b)=>a.p.f-b.p.f).map(x=>`${x.p.f}위 ${x.p.n}${x.p.sr===2?' (시간 초과)':x.p.sr?' (항복)':''}`).join(', '));
  return lines.join('\n');
}
function modesHTML(me){
  const mine=myTurnNow()&&me>=0,wl=me>=0&&V.q?V.q.wl[me]:0;
  return `<button type="button" class="qd-m${qMode==='move'?' on':''}" data-m="move"${mine?'':' disabled'}>말 이동</button><button type="button" class="qd-m${qMode==='wall'?' on':''}" data-m="wall"${mine&&wl>0?'':' disabled'}>벽 세우기</button>`;
}
function drawHint(){
  if(!elHint)return;
  const me=myIdx(),h=hintText(me);
  if(h!==lastHint){elHint.textContent=h;lastHint=h}
  const m=modesHTML(me);if(m!==lastModes){elModes.innerHTML=m;lastModes=m}
}
function fit(){
  if(!elQd||elQd.hidden)return;
  const bd=elQd.querySelector('.qd-bd'),bw=bd.clientWidth,bh=bd.clientHeight;
  let s=Math.min(bw,bh),top='50%';
  // 넓고 낮은 화면(가로 휴대폰·PC): 아래쪽 '내 정보'와 '벽 놓기' 버튼 사이로 보드를 더 키움
  const st=$('#stage').getBoundingClientRect(),br=bd.getBoundingClientRect(),me=$('#me'),act=$('#actions');
  const pr=Math.max(240,me&&!me.hidden?me.getBoundingClientRect().right-st.left:0);   // 내 정보 칸은 글자에 따라 폭이 바뀌므로 넉넉히 잡아서 보드가 흔들리지 않게
  const al=Math.min(st.width-140,act&&!act.hidden?act.getBoundingClientRect().left-st.left:st.width);
  const cx=br.left-st.left+bw/2;
  const big=Math.floor(Math.min(bw,bh+(st.bottom-br.bottom)-10,2*Math.min(cx-pr-10,al-10-cx)));
  if(big>s){s=big;top=(s/2)+'px'}
  s=Math.floor(s);
  if(s>0){elSvg.style.width=elSvg.style.height=s+'px';elSvg.style.top=top}
}
function drawAll(){
  if(!QS||!elMain)return;
  const me=myIdx();
  const bd=boardHTML(QS,me);
  if(bd!==lastBoard){elMain.innerHTML=bd;lastBoard=bd}
  const bar=barHTML(V.q,me);if(bar!==lastBar){elBar.innerHTML=bar;lastBar=bar}
  drawGhost();drawHint();fit();
}
/* 새 상태를 받았을 때 (그리기 전 / 그린 뒤) */
G.preView=()=>{
  if(!V.q){QS=null;return}
  QS=buildS(V.q);
  const me=myIdx();
  viewK=me>=0&&V.q.sd[me]!=null?(4-V.q.sd[me])&3:0;
  // 차례가 바뀌거나 누군가 두면 미리 골라 둔 벽·모드는 처음으로
  if(!PV||!PV.q||PV.t!==V.t||PV.st!==V.st||PV.q.w.length!==V.q.w.length){qMode='move';pend=null;hov=null}
  if(me>=0&&!(QS.wl[me]>0))qMode='move';
};
G.postView=()=>{};
G.overExtra=()=>{
  if(!V||!V.q||!Array.isArray(V.q.rec)||!V.q.rec.length)return '';
  return `<div class="qd-rec"><div class="qd-rec-h"><b>기보</b><button type="button" class="btn btn-sub qd-copy">기보 복사</button></div><pre>${esc(recordText(V))}</pre></div>`;
};
G.logCue=()=>false;
G.cues=(v,pv)=>{
  if(!v.q||!pv.q)return;
  if(v.q.w.length>pv.q.w.length)sfx('play',1);
  else if(v.q.lm&&pv.q.lm&&v.q.lm.k===0&&(v.q.lm.r!==pv.q.lm.r||v.q.lm.c!==pv.q.lm.c||v.q.lm.p!==pv.q.lm.p)&&v.q.lm.p!==myIdx())sfx('pick');
};
G.hud=inGame=>{
  if(!elQd)return;
  const on=!!(inGame&&V&&V.q&&QS);
  elQd.hidden=!on;
  $('#stage').classList.toggle('qd-over',!!(on&&V.st==='over'));   // 결과 창이 길어도(기보) 아래 버튼이 내 정보 칸에 가리지 않게
  if(!on){lastBoard='';lastBar='';lastHint='';lastModes='';return}
  drawAll();
};
G.handMarks=()=>{};
G.me=(i,h)=>{
  $('#numpick').hidden=true;
  const p=V.ps[i];if(!p||!V.q)return;
  if(p.f){if(!p.sr)$('#meSub').innerHTML=V.q.dn[i]?`<b>${+p.f}위</b>로 도착했습니다.`:`<b>${+p.f}위</b>입니다.`;return}
  $('#meSub').innerHTML=`남은 벽 <b>${+V.q.wl[i]}</b>개`;
};
G.specNote='관전 중입니다. 모든 말과 벽이 보입니다.';
G.no3D=true;   // 3D 테이블을 쓰지 않음: 공통 코드가 그리기를 쉬어서 휴대폰 배터리를 아낌
G.buttons=()=>{
  const play=$('#btnPlay'),can=!!(pend&&qMode==='wall'&&myTurnNow());
  $('#btnPass').hidden=true;$('#btnGura').hidden=true;
  play.disabled=!can;play.classList.toggle('ready',can);
  if($('#playMain').textContent!=='벽 놓기')$('#playMain').textContent='벽 놓기';
  const sub=keyLabel(KEYS.play);if($('#playSub').textContent!==sub)$('#playSub').textContent=sub;
};
G.live=()=>{
  if(elHint&&V&&V.st==='play'&&V.t===myIdx())drawHint();   // 남은 시간 안내
  const bar=elBar&&elBar.querySelector('.qd-p.on .tb i');
  if(bar&&V&&V.st==='play'){const left=Math.max(0,(V.deadAt-clock())/1000);bar.style.width=Math.min(100,left/(V.cfg.turn||30)*100)+'%'}
};
G.play=()=>{
  if(!pend||qMode!=='wall'||!myTurnNow())return;
  sendWall({...pend});
};
G.pass=()=>{};
G.keyPhase=st=>st==='play';
G.onKey=(act,e)=>{
  if(act==='qmode'){
    if(!e.repeat&&myTurnNow()&&V.q){
      const me=myIdx();
      if(qMode==='move'&&me>=0&&V.q.wl[me]>0)qMode='wall';else qMode='move';
      pend=null;hov=null;drawAll();G.buttons();
    }
    return true;
  }
  if(act==='qrot'){if(!e.repeat){qOri^=1;hov=null;drawGhost()}return true}
  return false;
};
G.field3D=()=>{};
/* 이 게임으로 바뀔 때 / 다른 게임으로 바뀔 때 */
G.enter=()=>{
  $('#stage').classList.add('qd');
  $('#btnPass').hidden=true;$('#btnGura').hidden=true;$('#numpick').hidden=true;
  qMode='move';pend=null;hov=null;
  if(elQd)fit();
};
G.leave=()=>{
  $('#stage').classList.remove('qd','qd-over');
  $('#btnPass').hidden=false;
  if(elQd){elQd.hidden=true;lastBoard='';lastBar='';lastHint='';lastModes=''}
};
/* 처음 한 번: 보드 화면 만들기 */
G.init=()=>{
  const css=document.createElement('style');
  css.textContent=`
.stage.qd{background:radial-gradient(ellipse at 50% 38%,#f3e4c2 0%,#e2c89a 70%,#d3b27c 100%)}
.stage.qd #cv,.stage.qd #dim{visibility:hidden}
.stage.qd .labels{visibility:hidden}
.stage.qd .nogl{display:none}
.stage.qd.qd-over .myplate,.stage.qd.qd-over .actions{display:none}
.specbar:not([hidden])~#qd .qd-bar{margin-top:30px}
.stage.qd .actions{left:auto}
.stage.qd .myplate{max-width:calc(100% - 150px)}
#qd{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;gap:6px;padding:8px 10px 82px;pointer-events:none;min-height:0}
#qd[hidden]{display:none}
#qd .qd-bar{min-height:44px;display:flex;flex-wrap:wrap;gap:6px;align-self:flex-start;max-width:calc(100% - 188px);pointer-events:none}
#qd .qd-p{position:relative;display:flex;align-items:center;gap:6px;padding:4px 10px 6px;border-radius:12px;background:rgba(255,250,240,.92);border:1.5px solid var(--line-strong,#cdb391);font-size:13px;line-height:1.15;overflow:hidden;white-space:nowrap;max-width:100%}
#qd .qd-p .dot{width:12px;height:12px;border-radius:50%;background:var(--pc);box-shadow:0 0 0 2px #fffaf0,0 0 0 3px var(--pc);flex:none}
#qd .qd-p b{font-weight:600;overflow:hidden;text-overflow:ellipsis;max-width:9em}
#qd .qd-p .w{font-family:var(--f-num,inherit);font-size:12px;color:var(--muted,#7a6550)}
#qd .qd-p.on{border-color:var(--pc);box-shadow:0 0 0 2px var(--pc)}
#qd .qd-p.me b{color:#3b2a1f}
#qd .qd-p.out{opacity:.55}
#qd .qd-p .tb{position:absolute;left:0;right:0;bottom:0;height:3px;background:rgba(0,0,0,.08)}
#qd .qd-p .tb i{display:block;height:100%;width:100%;background:var(--pc)}
#qd .qd-row{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;width:100%;pointer-events:none}
#qd .qd-hint{flex:1 1 200px;min-width:0;font-size:13px;line-height:1.3;color:#5b4129;text-align:center;min-height:17px}
#qd .qd-modes{display:flex;gap:4px;pointer-events:auto}
#qd .qd-m{height:34px;padding:0 12px;border-radius:10px;border:2px solid var(--mustard-edge,#c08a17);background:#fffaf0;color:#3b2a1f;font-family:var(--f-display,inherit);font-size:15px;cursor:pointer}
#qd .qd-m.on{background:var(--mustard,#f2b632)}
#qd .qd-m:disabled{opacity:.45;cursor:default}
#qd .qd-bd{position:relative;flex:1;min-height:0;width:100%}
#qd svg{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);pointer-events:auto;touch-action:manipulation;user-select:none;-webkit-user-select:none;filter:drop-shadow(0 6px 8px rgba(59,42,31,.35))}
#qd .qd-co{font-size:.3px;font-weight:700;fill:#7a5a3a;text-anchor:middle;dominant-baseline:central;font-family:var(--f-num,monospace)}
.qd-rec{margin:4px 0 2px;text-align:left}
.qd-rec-h{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}
.qd-rec-h .btn{min-height:0;height:34px;padding:0 12px;font-size:14px}
.qd-rec pre{margin:0;max-height:min(30vh,220px);overflow:auto;padding:10px 12px;border-radius:var(--r-sm,10px);background:var(--well,#f3e7d2);font-family:var(--f-num,monospace);font-size:13px;line-height:1.5;white-space:pre-wrap;word-break:keep-all;user-select:text;-webkit-user-select:text}
#qd .qd-pulse{animation:qdPulse 1.3s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
@keyframes qdPulse{0%,100%{opacity:.95;transform:scale(1)}50%{opacity:.35;transform:scale(1.18)}}
@media (max-width:520px){#qd .qd-p{font-size:12px;padding:3px 8px 5px}#qd .qd-m{height:32px;padding:0 10px;font-size:14px}#qd{padding-bottom:76px}}
`;
  document.head.appendChild(css);
  elQd=document.createElement('div');elQd.id='qd';elQd.hidden=true;
  elQd.innerHTML=`<div class="qd-bar"></div><div class="qd-row"><div class="qd-hint" aria-live="polite"></div><div class="qd-modes" role="group" aria-label="행동 고르기"></div></div><div class="qd-bd"><svg viewBox="${VB.x} ${VB.y} ${VB.w} ${VB.w}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="쿼리도 보드"><g id="qdMain"></g><g id="qdGhost"></g></svg></div>`;
  $('#stage').insertBefore(elQd,$('#fx'));
  elSvg=elQd.querySelector('svg');elMain=elQd.querySelector('#qdMain');elGhost=elQd.querySelector('#qdGhost');
  elBar=elQd.querySelector('.qd-bar');elHint=elQd.querySelector('.qd-hint');elModes=elQd.querySelector('.qd-modes');
  elSvg.addEventListener('pointerdown',e=>{lastPT=e.pointerType||'mouse'});
  elSvg.addEventListener('click',onSvgClick);
  elSvg.addEventListener('pointermove',onSvgMove);
  elSvg.addEventListener('pointerleave',()=>{if(hov){hov=null;drawGhost()}});
  elModes.addEventListener('click',e=>{
    const b=e.target.closest('.qd-m');if(!b||b.disabled)return;
    qMode=b.dataset.m;pend=null;hov=null;sfx('tick');drawAll();G.buttons();
  });
  document.addEventListener('keydown',e=>{if(e.code==='Escape'&&pend&&elQd&&!elQd.hidden){pend=null;drawAll();G.buttons()}});
  window.addEventListener('resize',fit);
  document.addEventListener('click',e=>{
    const b=e.target.closest('.qd-copy');if(!b||!V||!V.q)return;
    const txt=recordText(V),done=ok=>{b.textContent=ok?'복사했습니다':'복사하지 못했습니다';setTimeout(()=>{b.textContent='기보 복사'},1600)};
    try{navigator.clipboard.writeText(txt).then(()=>done(true),()=>done(false))}catch(_){done(false)}
  });
};

(window.GAMES=window.GAMES||{}).quoridor=G;
})();
