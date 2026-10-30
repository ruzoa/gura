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
const wallsPer=cnt=>cnt<=2?10:Math.floor(20/cnt);   // 공식 규칙: 벽 20개를 나눔 (2명 10개, 3명 6개, 4명 5개). 보관함의 홈이 10개
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
G.rulesHTML='<ol class="rules"><li><b>목표</b> : 내 말을 맞은편 끝줄의 아무 칸에 가장 먼저 도착시키면 <b>승리</b>하고 게임이 끝납니다. 나머지 순위는 목표까지 남은 거리가 짧은 순서입니다</li><li><b>내 차례</b> : <b>말 이동</b>과 <b>벽 세우기</b> 중 하나만 합니다</li><li><b>말 이동</b> : 위·아래·왼쪽·오른쪽으로 한 칸. 벽은 넘을 수 없습니다</li><li><b>뛰어넘기</b> : 상대 말이 바로 앞에 있으면 그 말을 뛰어넘습니다. 그 뒤가 벽이나 끝이라서 못 넘으면 대각선 옆 칸으로 비켜 갑니다</li><li><b>벽 세우기</b> : 칸 사이의 틈에 두 칸 길이의 벽을 놓아 길을 막습니다. 벽은 한 번 놓으면 옮길 수 없고, 벽끼리 겹치거나 십자로 놓을 수 없습니다</li><li><b>반칙</b> : 누구든 목표까지 갈 길이 완전히 막히는 자리에는 벽을 놓을 수 없습니다</li><li><b>4명</b> : 네 방향에서 출발해 맞은편 끝줄이 목표입니다. 벽은 인원수대로 나눠 가집니다</li><li><b>조작</b> : 갈 칸이나 벽 자리를 누르면 반투명으로 미리 보이고, <b>[놓기]</b>를 누르면 확정합니다. 벽은 내 앞 보관함에서 놓을 벽을 눌러 고릅니다(3D 화면이 안 되는 기기는 [벽 세우기]). 설정의 <b>두 번 눌러 놓기</b>를 켜면 같은 자리를 한 번 더 눌러 바로 둡니다</li><li><b>제한 시간</b> : 내 차례에 제한 시간이 지나면 <b>패배</b>합니다. 연결이 끊겨도 시간은 흐르고, 45초 안에 돌아오지 않으면 탈주로 처리합니다</li><li><b>기보</b> : 세로줄은 왼쪽부터 a~i, 가로줄은 빨강 출발점 쪽부터 1~9입니다. 말 이동은 도착한 칸(e2), 벽은 벽 가운데가 오른쪽 위 꼭짓점인 칸에 가로 h·세로 v를 붙여 적습니다(e3h)</li></ol>';
G.modeDesc=['먼저 도착한 사람이 이기면 끝','먼저 도착한 사람이 이기면 끝'];
G.defaults={max:2,turn:30,pickfirst:0};
G.roomSet=[
  {k:'turn',label:'제한 시간',unit:'초',lo:10,hi:180,step:5,desc:'제한 시간이 지나면 패배합니다. 연결이 끊겨도 시간은 흐르고, 45초가 지나면 탈주로 처리합니다'}];
G.ruleSet=[{k:'pickfirst',pick:1,label:'선 플레이어',desc:'선택: 방장이 이름표 메뉴에서 선 플레이어를 고릅니다. 무작위: 주사위로 정합니다'}];
G.cfgChips=c=>`<span class="chip">제한 시간 <b>${+c.turn}초</b></span><span class="chip">선 <b>${c.pickfirst?'선택':'무작위'}</b></span>`;
G.cfgSum=c=>`제한 시간 ${+c.turn}초 · 선 ${c.pickfirst?'선택':'무작위'}`;
G.roomSub=()=>'2~4명 보드게임';
G.pubExtra=()=>({});
G.cardInfo=(c,nowN)=>{
  const n=Math.max(2,Math.min(4,nowN)),per=wallsPer(n);
  return `<p class="cardinfo">지금 ${nowN}명이면 1인당 벽 ${per}개${nowN===3?'<br>3명이면 한쪽 변이 비어서 2명·4명보다 균형이 덜 맞습니다.':''}${nowN>4?'<br>쿼리도는 최대 4명까지 할 수 있습니다.':''}</p>`;
};
G.rankTitle=()=>'';
G.finLabel=()=>'도착';
G.noEmotes=[];
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
  const wd=why==='time'?'시간 초과':p.deserter?'탈주':'항복';
  const n=recAdd(i,wd,why!=='time');
  addLog(why==='time'?`${n}. ${p.name} 시간 초과로 패배! ${p.rank}위`:`${p.name} ${wd}! ${p.rank}위`,'lie');
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
/* 제한 시간이 지나면 패배. 봇과 탈주해서 봇이 맡은 자리는 지지 않고 봇이 둠. 연결이 끊겨 기다리는 사람은 시간이 그대로 흐름 */
function timeout(){
  const i=H.turn,p=H.players[i];
  if(p.bot&&!awayHuman(p)){botTurn(i);return}   // 끊겨서 기다리는 사람은 시간이 지나면 다른 사람처럼 패배
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
    const per=wallsPer(cnt);
    Object.assign(H,{phase:'play',log:[],seatNote:{},field:[],last:null,reveal:null,shouts:[],pending:null,rankNext:1,rankBottom:n,known:{}});
    const Q={n,cnt,sd:[],pos:[],done:[],wl:[],B:mkB(),walls:[],lm:null,rec:[],rnd:1,lastPos:-1,first:0};
    H.rankBottom=cnt;   // 항복 순위는 실제로 말을 가진 사람 수 기준
    H.players.forEach((p,i)=>{
      if(i<cnt){Q.sd.push(seats[i]);Q.pos.push(SIDE_START[seats[i]].slice());Q.done.push(0);Q.wl.push(per);p.hand=PAWN()}
      else{Q.sd.push(0);Q.pos.push(null);Q.done.push(1);Q.wl.push(0);p.hand=[];p.finished=true;p.rank=i+1}   // 자리가 모자라면(5명 이상) 구경만 함 (보통은 최대 인원 4명이라 생기지 않음)
    });
    H.q=Q;
    const first=typeof firstSeat==='function'?firstSeat(cnt):Math.random()*cnt|0;Q.first=first;   // 방장이 고른 선 또는 랜덤
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
let QS=null,viewK=0,qMode='move',qOri=0,pend=null,hov=null,qMsg='',qMsgUntil=0,qMsgTimer=null;   // pend: 미리 보기 {k:0 이동|1 벽, r, c, o}
let elQd=null,elSvg=null,elMain=null,elGhost=null,elBar=null,elBarMe=null,elHint=null,elModes=null,lastBoard='',lastBar='',lastHint='',lastModes='';
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
/* 보드 위 한 점을 눌렀을 때 (화면 기준 격자 좌표: 칸 하나 = 1, 칸 사이 선 = 정수)
   말 이동 모드면 갈 칸, 벽 모드면 벽 자리를 '미리 보기'로 고름. 확정은 [놓기] */
function pickAt(x,y){
  if(!V||!V.q||V.st!=='play'||!QS)return;
  const me=myIdx();if(me<0)return;
  if(!myTurnNow()){sfx('no');return}
  if(qMode==='move'){
    if(x<-.3||y<-.3||x>9.3||y>9.3)return;
    const vr=clamp(Math.floor(y),0,8),vc=clamp(Math.floor(x),0,8),[r,c]=toAbsCell(vr,vc);
    if(!legalMoves(QS,me).some(m=>m[0]===r&&m[1]===c)){sfx('no');return}   // 갈 수 있는 칸은 초록 점
    if(dblOn()&&pend&&pend.k===0&&pend.r===r&&pend.c===c){confirmPend();return}   // 두 번 눌러 놓기
    pend={k:0,r,c};
  }else{
    const w=wallAt(x,y);if(!w)return;
    const abs=toAbsWall(w.X,w.Y,w.vo);
    if(!wallLegal(abs)){sfx('no');if(QS.wl[me]>0){hov={...abs,ok:false};drawGhost();Q3.dirty=true}return}   // 글 대신 금지 소리 + 그 자리에 빨간 벽
    if(dblOn()&&pend&&pend.k===1&&pend.r===abs.r&&pend.c===abs.c&&pend.o===abs.o){confirmPend();return}   // 두 번 눌러 놓기
    pend={k:1,...abs};hov=null;
  }
  sfx('pick');redraw();
}
const dblOn=()=>typeof dblTap!=='undefined'&&!!dblTap;   // 개인 설정 '두 번 눌러 놓기' (공통 설정 화면)
/* [놓기]: 미리 보기를 확정해서 보냄 */
function confirmPend(){
  if(!pend||!myTurnNow())return;
  const p=pend;pend=null;hov=null;
  if(p.k===1)Q3.flyFrom=Q3.sel;   // 3D: 고른 벽이 그 홈에서 날아감
  if(p.k===0)sendAct({t:'move',r:p.r,c:p.c});else sendAct({t:'wall',r:p.r,c:p.c,o:p.o});
  redraw();
}
function setMode(m){
  const me=myIdx();
  if(m==='wall'&&!(me>=0&&V.q&&V.q.wl[me]>0)){sfx('no');return}   // 빈 보관함이 보임
  if(qMode===m)return;
  qMode=m;pend=null;hov=null;
  if(m==='move')Q3.sel=null;
  else if(Q3.on&&Q3.sel==null){const sl=Q3.slots.get(me);if(sl)for(let g=9;g>=0;g--)if(sl.w[g]){Q3.sel=g;break}}   // 키(X)로 벽 모드: 끝 쪽 벽을 고름
  sfx('tick');redraw();
}
function redraw(){qMsgUntil=0;drawAll();G.buttons();Q3.dirty=true}   // 직접 고르면 잠깐 띄운 안내(시작 안내 등)는 내리고 고른 내용을 보임
/* 마우스를 올린 벽 자리 (벽 모드, 아직 고르지 않았을 때) */
function hoverAt(x,y){
  if(qMode!=='wall'||!myTurnNow()||!QS){if(hov){hov=null;drawGhost();drawHint();Q3.dirty=true}return}
  const w=x==null?null:wallAt(x,y);
  if(!w){if(hov){hov=null;drawGhost();drawHint();Q3.dirty=true}return}
  const abs=toAbsWall(w.X,w.Y,w.vo);
  if(hov&&hov.r===abs.r&&hov.c===abs.c&&hov.o===abs.o)return;
  hov={...abs,ok:wallLegal(abs)};drawGhost();drawHint();Q3.dirty=true;
}
function onSvgClick(e){const [x,y]=toLat(e);pickAt(x,y)}
function onSvgMove(e){if(e.pointerType==='touch')return;const [x,y]=toLat(e);hoverAt(x,y)}
/* 벽 한 개를 그리는 선 (실제 좌표의 벽 → 화면 좌표) */
function wallLine(r,c,o,col,w,op,extra){
  const [X,Y]=rp(c+1,r+1,viewK),vo=o^(viewK&1);
  const x1=vo===0?X-.94:X,x2=vo===0?X+.94:X,y1=vo===1?Y-.94:Y,y2=vo===1?Y+.94:Y;
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="${w}" stroke-linecap="round" opacity="${op}"${extra||''}/>`;
}
function drawGhost(){
  if(!elGhost)return;
  const me=myIdx(),out=[];
  if(pend&&pend.k===0&&me>=0){const [vr,vc]=rc(pend.r,pend.c,viewK);out.push(`<circle cx="${vc+.5}" cy="${vr+.5}" r=".33" fill="${PCOL[me%4]}" opacity=".45" stroke="#fffaf0" stroke-width=".07"/>`)}
  if(pend&&pend.k===1)out.push(wallLine(pend.r,pend.c,pend.o,'#2f9e44',.2,.85));   // 놓인 벽과 같은 굵기
  else if(hov&&qMode==='wall')out.push(wallLine(hov.r,hov.c,hov.o,hov.ok?'#2f9e44':'#d6342a',.2,.55));
  elGhost.innerHTML=out.join('');
  q3Marks();
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
/* 이름 칸: 나는 판 아래쪽, 다른 사람은 판 위쪽(나 다음부터 차례대로). 관전자는 모두 위쪽. 판 끝에서 CHIP_GAP 띄움(chipsAt) */
function chipHTML(q,me,i){
  const p=V.ps[i];if(!p||(i>=q.cnt&&p.f))return '';
  const on=introWait()?introIdx(clock()-IN.t0)===i:V.st==='play'&&V.t===i&&!p.f;   // 시작 연출 중: 주사위가 멈춘 뒤에야 첫 차례 이름표가 켜짐
  return `<div class="qd-p${on?' on':''}${i===me?' me':''}${p.f?' out':''}" style="--pc:${PCOL[i%4]}"><i class="dot"></i><b>${esc(p.n)}${i===me?' (나)':''}</b>${p.f?`<span class="w">${p.sr===2?'시간 초과':p.sr===3?'탈주':p.sr?'항복':(+p.f)+'위'}</span>`:`<span class="w">벽 ${+q.wl[i]}</span>`}${on?'<span class="tb"><i></i></span>':''}</div>`;
}
const seatedQ=me=>me>=0&&me<V.ps.length;
function barHTML(q,me){const n=V.ps.length,b=Math.max(0,me),order=Array.from({length:n},(_,k)=>(b+k)%n);return (seatedQ(me)?order.slice(1):order).map(i=>chipHTML(q,me,i)).join('')}
function meBarHTML(q,me){return seatedQ(me)?chipHTML(q,me,me):''}
function hintText(me){   // 안내·알림 원칙: 차례·할 수 있는 행동·남은 시간은 화면(고리·초록 점·버튼·빨간 선)이 보여 주므로 글은 결과만
  if(Date.now()<qMsgUntil&&qMsg)return qMsg;
  if(!V||!V.q)return '';
  if(V.st==='over')return '게임이 끝났습니다.';
  if(introWait()||me<0)return '';
  const p=V.ps[me];
  if(p&&p.f)return p.sr===2?'시간 초과로 패배했습니다.':p.sr===3?'탈주 처리되었습니다.':p.sr?'항복했습니다.':V.q.dn[me]?'도착했습니다!':'';
  return '';
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
  if(v.st==='over')lines.push('결과: '+v.ps.map((p,i)=>({p,i})).filter(x=>x.i<cnt&&x.p.f).sort((a,b)=>a.p.f-b.p.f).map(x=>`${x.p.f}위 ${x.p.n}${x.p.sr===2?' (시간 초과)':x.p.sr===3?' (탈주)':x.p.sr?' (항복)':''}`).join(', '));
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
  if(!Q3.on){const bd=boardHTML(QS,me);if(bd!==lastBoard){elMain.innerHTML=bd;lastBoard=bd}}   // 3D 화면이면 2D 보드는 그리지 않음
  const top=barHTML(V.q,me),mb=meBarHTML(V.q,me),key=top+'\u0001'+mb;if(key!==lastBar){elBar.innerHTML=top;elBarMe.innerHTML=mb;lastBar=key}
  drawGhost();drawHint();fit();
}
/* ---------- 3D 보드: 공통 원목 테이블 위에 놓고, 바로 위(90도)에서 내려다보는 자기 카메라로 그림 ----------
   단위: '칸 단위'(칸 한 변 = 1, 칸 사이 홈 = .24)로 계산하고 월드에는 U배로 놓음. 화면 기준 x→월드 x, 화면 기준 y(아래)→월드 +z
   보는 사람에 따라 돌린 좌표(viewK)로 모두 놓기 때문에 내 출발점이 항상 아래에 옴. WebGL이 없으면 2D 그림을 씀 */
const U=.47,SZ=1,GP=.24,PT=SZ+GP,INN=9*SZ+8*GP,BH=INN/2+.66,WLEN=2*SZ+GP,WTH=.2,WHT=.62;
/* 보관함: 보드와 떨어진 진갈색 함 (참가한 사람 쪽에만). 칸막이 9개 사이·양 끝 홈 10개에 벽을 세워 둠 */
const TI=BH+.3,TO=TI+WLEN+.36,XE=4*PT+SZ/2+GP,TW=XE+.16,TF=.12,PEEK=.85;   // 보관함 안쪽·바깥쪽 거리, 홈 끝, 보관함 반폭, 바닥 높이, 좁은 화면에서 양옆 보관함이 보이는 깊이
const TOP=.2,CT=TOP+.06;
const BS=.78;   // 보드 묶음 전체 배율: 테이블 둘레가 보이게 줄임 (카메라도 같은 비율로 가까워져서 원근감은 그대로)   // 보드 틀 윗면, 칸 윗면 높이 (테이블 윗면 = 0)
const Q3={on:false,built:false,fail:false,root:null,cam:null,dirty:true,lastR:0,lay:'',layAt:0,d:12,W:0,H:0,K:-1,labKey:'',lab:null,
  anim:[],pawns:new Map(),walls:new Map(),slots:new Map(),sel:null,flyFrom:null,hl:[],ghostP:null,ghostW:null,hovW:null,ring:null,trayRect:null,recN:-1,wN:-1};   // slots: 사람마다 {side, w:[홈 10개의 벽 또는 null]}, sel: 내가 고른 홈
const ease=k=>k<=0?0:k>=1?1:k*k*(3-2*k);
const cellXY=(vr,vc)=>[(vc-4)*PT,(vr-4)*PT];
const latXY=(X,Y)=>[(X-4.5)*PT,(Y-4.5)*PT];
const SIDE_N=[[0,1],[-1,0],[0,-1],[1,0]];   // 화면 기준 변(0 아래, 1 왼쪽, 2 위, 3 오른쪽)의 바깥 방향
function woodPaint(g,w,h,base,dark,n,seed){
  let s=seed||7;const r=()=>{s=(s*16807)%2147483647;return s/2147483647};
  g.fillStyle=base;g.fillRect(0,0,w,h);
  for(let i=0;i<n;i++){const y0=r()*h,a=r()*.12+.04;g.strokeStyle=dark;g.globalAlpha=a;g.lineWidth=r()*2.5+.8;g.beginPath();
    for(let t=0;t<=w;t+=8){const y=y0+Math.sin(t/(30+r()*0)+i)*3+Math.sin(t/11+i*3)*1.2;t?g.lineTo(t,y):g.moveTo(t,y)}g.stroke()}
  g.globalAlpha=1;
}
/* 윤곽선(공통 그림 스타일)을 같은 묶음 안에 붙여서, 물체가 움직여도 따라가게 */
function withInk(geo,mat,inkGeo,inkMat){
  const g=new THREE.Group(),m=new THREE.Mesh(geo,mat);m.castShadow=true;m.receiveShadow=true;g.add(m);
  const o=new THREE.Mesh(inkGeo,inkMat||new THREE.MeshBasicMaterial({color:GFX_INK,side:THREE.BackSide}));g.add(o);g.userData.ink=o;g.userData.body=m;return g;
}
const MAT={};
function pawnGroup(col,ghost){
  const g=new THREE.Group(),key=col+(ghost?'g':'');
  if(!MAT[key])MAT[key]=ghost?new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.45,depthWrite:false}):toon({color:col,rim:.25});
  const m=MAT[key],ink=ghost?null:new THREE.MeshBasicMaterial({color:GFX_INK,side:THREE.BackSide});
  const add=(geo,y,inkGeo)=>{const o=new THREE.Mesh(geo,m);o.position.y=y;o.castShadow=!ghost;g.add(o);if(ink){const h=new THREE.Mesh(inkGeo,ink);h.position.y=y;g.add(h)}};
  add(new THREE.CylinderGeometry(.33*U,.38*U,.3*U,28),.15*U,new THREE.CylinderGeometry(.36*U,.41*U,.33*U,28));
  add(new THREE.CylinderGeometry(.15*U,.2*U,.36*U,20),.46*U,new THREE.CylinderGeometry(.18*U,.23*U,.36*U,20));
  add(new THREE.SphereGeometry(.27*U,24,16),.8*U,new THREE.SphereGeometry(.3*U,24,16));
  return g;
}
function wallMat(i){const k='w'+i;if(!MAT[k])MAT[k]=toon({color:PCOL[i%4],rim:.2});return MAT[k]}
function wallMesh(i){
  const geo=new THREE.BoxGeometry(WLEN*U,WHT*U,WTH*U),ink=new THREE.BoxGeometry(WLEN*U+.035,WHT*U+.03,WTH*U+.035);
  return withInk(geo,wallMat(i),ink);
}
function q3Build(){
  if(Q3.built||Q3.fail)return Q3.built;
  if(!T.ok||typeof THREE==='undefined'){Q3.fail=true;return false}
  try{
    const root=new THREE.Group();root.visible=false;root.scale.setScalar(BS);
    const inkM=new THREE.MeshBasicMaterial({color:GFX_INK,side:THREE.BackSide});
    // 보드 틀 (진한 원목)
    const frameT=canvasTex(512,512,(g,w,h)=>woodPaint(g,w,h,'#6f4020','#2a1206',110,3));
    const fg=new THREE.BoxGeometry(2*BH*U,TOP-.02,2*BH*U);
    const bg=new THREE.Group();root.add(bg);Q3.boardG=bg;   // 보드 틀·홈·좌표 판 (시작 연출에서 함께 내려앉음)
    const frame=new THREE.Mesh(fg,toon({map:frameT,rim:.08}));frame.position.y=.02+(TOP-.02)/2;frame.castShadow=frame.receiveShadow=true;bg.add(frame);
    const fo=new THREE.Mesh(new THREE.BoxGeometry(2*BH*U+.05,TOP-.02+.02,2*BH*U+.05),inkM);fo.position.copy(frame.position);bg.add(fo);
    // 좌표·목표 줄을 그리는 판 (틀 위, 홈 바닥 아래)
    Q3.labTex=canvasTex(1024,1024,()=>{});
    const lab=new THREE.Mesh(new THREE.PlaneGeometry(2*BH*U,2*BH*U),new THREE.MeshBasicMaterial({map:Q3.labTex,transparent:true,depthWrite:false}));
    lab.rotation.x=-Math.PI/2;lab.position.y=TOP+.002;lab.renderOrder=1;bg.add(lab);Q3.lab=lab;
    // 목표 줄 (사람마다 자기 색, 시작 연출에서 그어짐)
    const stT=canvasTex(256,32,(g,w,h)=>{g.fillStyle='#fff';rr(g,0,0,w,h,h/2);g.fill()});
    Q3.stripes=[0,1,2,3].map(i=>{const m=new THREE.Mesh(new THREE.PlaneGeometry((INN-.2)*U,.13*U),new THREE.MeshBasicMaterial({map:stT,color:PCOL[i],transparent:true,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.y=TOP+.003;m.renderOrder=1;m.visible=false;bg.add(m);return m});
    // 홈 바닥 (칸 사이)
    const groove=new THREE.Mesh(new THREE.BoxGeometry((INN+.2)*U,.01,(INN+.2)*U),toon({color:0x3a200e,rim:0}));groove.position.y=TOP+.005;groove.receiveShadow=true;bg.add(groove);
    // 칸 81개 (밝은 원목)
    const cellT=canvasTex(256,256,(g,w,h)=>woodPaint(g,w,h,'#ecca93','#8a5520',46,11));
    const cellM=toon({map:cellT,rim:0}),cellG=new THREE.BoxGeometry(SZ*U,.05,SZ*U);
    Q3.cells=[];for(let vr=0;vr<9;vr++)for(let vc=0;vc<9;vc++){const [x,y]=cellXY(vr,vc),m=new THREE.Mesh(cellG,cellM);m.position.set(x*U,TOP+.035,y*U);m.receiveShadow=true;m.userData.ring=Math.max(Math.abs(vr-4),Math.abs(vc-4));bg.add(m);Q3.cells.push(m)}
    Q3.trays=[0,1,2,3].map(sd=>{const g=trayGroup(sd);g.visible=false;root.add(g);return g});
    // 갈 수 있는 칸 표시 (초록) — 미리 8개 만들어 두고 켜고 끔
    const hlM=new THREE.MeshBasicMaterial({color:0x55c271,transparent:true,opacity:.42,depthWrite:false}),dotM=new THREE.MeshBasicMaterial({color:0x1f7a2e,transparent:true,opacity:.8,depthWrite:false});
    for(let k=0;k<8;k++){const g=new THREE.Group();const a=new THREE.Mesh(new THREE.PlaneGeometry(SZ*U*.98,SZ*U*.98),hlM);a.rotation.x=-Math.PI/2;g.add(a);
      const d=new THREE.Mesh(new THREE.CircleGeometry(.13*U,20),dotM);d.rotation.x=-Math.PI/2;d.position.y=.002;g.add(d);g.position.y=CT+.003;g.visible=false;g.renderOrder=2;root.add(g);Q3.hl.push(g)}
    // 차례 고리 (지금 차례인 말 밑)
    Q3.ring=new THREE.Mesh(new THREE.RingGeometry(.43*U,.52*U,40),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.9,depthWrite:false}));
    Q3.ring.rotation.x=-Math.PI/2;Q3.ring.position.y=CT+.004;Q3.ring.visible=false;root.add(Q3.ring);
    // 미리 보기: 반투명 말, 초록 벽(+빛), 마우스를 올린 벽
    Q3.ghostP=new THREE.Group();Q3.ghostP.visible=false;root.add(Q3.ghostP);
    // 미리 보기 벽: 실제 벽과 같은 크기·두께의 반투명 초록 벽 하나 (겹치는 빛 판 없이)
    const gw=new THREE.Group();
    gw.add(new THREE.Mesh(new THREE.BoxGeometry(WLEN*U,WHT*U,WTH*U),new THREE.MeshBasicMaterial({color:0x4fd36c,transparent:true,opacity:.75})));
    gw.visible=false;root.add(gw);Q3.ghostW=gw;
    const hw=new THREE.Mesh(new THREE.BoxGeometry(WLEN*U,WHT*U,WTH*U),new THREE.MeshBasicMaterial({color:0x2f9e44,transparent:true,opacity:.4}));hw.visible=false;root.add(hw);Q3.hovW=hw;
    Q3.cam=new THREE.PerspectiveCamera(44,1,.1,100);Q3.cam.up.set(0,0,-1);
    T.scene.add(root);Q3.root=root;Q3.built=true;
  }catch(e){Q3.fail=true;try{console.warn('쿼리도 3D 준비 실패',e)}catch(_){}}
  return Q3.built;
}
/* 좌표 글자와 목표 줄 (보는 방향·남은 사람에 따라 다시 그림) */
function q3Labels(q,K){
  const act=q.sd.map((s,i)=>i<q.cnt&&q.pos[i]&&!q.dn[i]?1:0).join('');
  const key=K+'|'+act;if(key===Q3.labKey)return;Q3.labKey=key;
  const cv=Q3.labTex.image,g=cv.getContext('2d'),N=cv.width,s=N/(2*BH),X=v=>(v+BH)*s;
  g.clearRect(0,0,N,N);
  Q3.stripes.forEach((m,i)=>{
    m.visible=i<q.cnt&&!!q.pos[i]&&!q.dn[i];if(!m.visible)return;
    const vs=(((q.sd[i]+2)&3)+K)&3,o=(INN/2+.2)*U,n=SIDE_N[vs];   // 목표 줄: 출발한 변의 맞은편
    m.position.x=n[0]*o;m.position.z=n[1]*o;m.rotation.z=vs&1?Math.PI/2:0;
  });
  const back=(4-K)&3,lab=(r1,c1,r2,c2)=>{const a=rc(r1,c1,back),b=rc(r2,c2,back);return a[1]===b[1]?COLS[a[1]]:String(9-a[0])};
  g.fillStyle='rgba(252,236,206,.92)';g.font=`700 ${Math.round(.3*s)}px "IBM Plex Mono", monospace`;g.textAlign='center';g.textBaseline='middle';
  for(let v=0;v<9;v++){g.fillText(lab(0,v,8,v),X((v-4)*PT),X(INN/2+.45));g.fillText(lab(v,0,v,8),X(-INN/2-.45),X((v-4)*PT))}
  Q3.labTex.needsUpdate=true;
}
/* 보관함 (아래 변 기준으로 만들고 변 방향으로 돌림). 진갈색 함 + 조금 밝은 칸막이 9개, 칸막이 사이·양 끝이 벽 홈 */
function trayGroup(sd){
  const g=new THREE.Group();g.rotation.y=-sd*Math.PI/2;
  if(!MAT.tray){
    MAT.tray=toon({map:canvasTex(256,256,(c,w,h)=>woodPaint(c,w,h,'#3d2210','#120600',60,5)),rim:.06});
    MAT.rib=toon({map:canvasTex(256,256,(c,w,h)=>woodPaint(c,w,h,'#5a3418','#1c0b02',50,9)),rim:.08});
  }
  const ink=new THREE.MeshBasicMaterial({color:GFX_INK,side:THREE.BackSide}),zc=(TI+TO)/2*U,dz=(TO-TI)*U;
  const base=new THREE.Mesh(new THREE.BoxGeometry(2*TW*U,TF-.02,dz),MAT.tray);base.position.set(0,.02+(TF-.02)/2,zc);base.castShadow=base.receiveShadow=true;g.add(base);
  const o=new THREE.Mesh(new THREE.BoxGeometry(2*TW*U+.04,TF,dz+.04),ink);o.position.copy(base.position);g.add(o);
  const rg=new THREE.BoxGeometry(SZ*U,.07,WLEN*U);
  for(let vc=0;vc<9;vc++){const m=new THREE.Mesh(rg,MAT.rib);m.position.set((vc-4)*PT*U,TF+.035,zc);m.castShadow=m.receiveShadow=true;g.add(m)}
  return g;
}
/* 보관함 홈 g(0~9)에 세운 벽의 자리: 변과 수직 */
function slotPose(side,g){
  const a=-side*Math.PI/2,lx=(g-4.5)*PT,lz=(TI+TO)/2,c=Math.cos(a),s=Math.sin(a);
  return {x:(lx*c+lz*s)*U,z:(-lx*s+lz*c)*U,y:TF+WHT*U/2,ry:Math.PI/2+a};
}
/* 처음 벽 n개를 홈 10개에 고르게 (10개면 꽉 참, 5개면 한 칸 건너) */
const slotLayout=n=>n>=10?[0,1,2,3,4,5,6,7,8,9]:Array.from({length:n},(_,j)=>Math.round((j+.5)*10/n-.5));
function q3Slots(i,side,n,reset){
  let sl=Q3.slots.get(i),from=null;
  const count=sl?sl.w.filter(Boolean).length:-1;
  if(!sl||reset||sl.side!==side||n>count){   // 새 판·방향 바뀜·다시 연결: 처음 배치로
    if(sl)sl.w.forEach(m=>m&&Q3.root.remove(m));
    sl={side,w:Array(10).fill(null)};Q3.slots.set(i,sl);
    for(const g of slotLayout(n)){const m=wallMesh(i),p=slotPose(side,g);m.position.set(p.x,p.y,p.z);m.rotation.y=p.ry;Q3.root.add(m);sl.w[g]=m}
    return null;
  }
  // 벽을 썼으면 그만큼 뺌: 내가 고른 홈 먼저, 아니면 끝 쪽부터 (빠진 홈은 비워 둠)
  let drop=count-n;
  const take=g=>{const m=sl.w[g];if(!m)return;Q3.root.remove(m);sl.w[g]=null;if(!from)from=slotPose(side,g);drop--};
  if(drop>0&&i===myIdx()&&Q3.flyFrom!=null)take(Q3.flyFrom);
  for(let g=9;g>=0&&drop>0;g--)take(g);
  return from;
}
function wallPose(w,K){const [X,Y]=rp(w[1]+1,w[0]+1,K),vo=w[2]^(K&1),[x,y]=latXY(X,Y);return {x:x*U,z:y*U,y:TOP+.01+WHT*U/2,ry:vo?Math.PI/2:0}}
function pawnPose(p,K){const [vr,vc]=rc(p[0],p[1],K),[x,y]=cellXY(vr,vc);return {x:x*U,z:y*U,y:CT}}
function q3Anim(obj,to,dur,hop,fromRy){
  Q3.anim=Q3.anim.filter(a=>a.obj!==obj);
  Q3.anim.push({obj,t0:clock(),dur,hop,from:obj.position.clone(),to,ry0:fromRy!=null?fromRy:obj.rotation.y});
}
/* 게임 상태를 3D 물체에 맞춤 (새 상태가 올 때마다) */
function q3Sync(){
  if(!Q3.on||!V||!V.q)return;
  const q=V.q,me=myIdx(),K=viewK,snap=K!==Q3.K||(q.rec||[]).length<Q3.recN||q.w.length<Q3.wN;   // 보는 방향이 바뀌거나 새 판이면 애니메이션 없이 바로
  Q3.K=K;Q3.recN=(q.rec||[]).length;Q3.wN=q.w.length;
  q3Labels(q,K);
  const from={},on=new Set();for(let i=0;i<q.cnt;i++)if(q.pos[i])on.add((q.sd[i]+K)&3);
  Q3.trays.forEach((g,sd)=>{g.visible=g.userData.on=on.has(sd)});
  // 지난 판이 사람이 더 많았으면(4명 → 2명) 남은 사람 수 밖의 말·보관함 벽을 치움
  for(const [i,sl] of Q3.slots)if(i>=q.n){sl.w.forEach(m=>m&&Q3.root.remove(m));Q3.slots.delete(i)}
  for(const [i,pw] of Q3.pawns)if(i>=q.n){Q3.root.remove(pw);Q3.pawns.delete(i)}
  // 보관함 (벽을 하나 쓰면 그 홈에서 벽이 날아감)
  for(let i=0;i<q.n;i++){
    if(i>=q.cnt||!q.pos[i]){const sl=Q3.slots.get(i);if(sl){sl.w.forEach(m=>m&&Q3.root.remove(m));Q3.slots.delete(i)}continue}
    const f=q3Slots(i,(q.sd[i]+K)&3,q.wl[i],snap);if(f)from[i]=f;
  }
  Q3.flyFrom=null;
  // 놓인 벽
  const keep=new Set();
  for(const w of q.w){
    const key=w[0]+','+w[1]+','+w[2];keep.add(key);
    let m=Q3.walls.get(key);const pose=wallPose(w,K);
    if(!m){m=wallMesh(w[3]);Q3.root.add(m);Q3.walls.set(key,m);
      const f=from[w[3]];
      if(f&&!snap){m.position.set(f.x,f.y,f.z);m.rotation.y=f.ry;q3Anim(m,pose,520,.9*U*2,f.ry)}
      else{m.position.set(pose.x,pose.y,pose.z);m.rotation.y=pose.ry}
    }else if(snap){m.position.set(pose.x,pose.y,pose.z);m.rotation.y=pose.ry}
    const last=q.lm&&q.lm.k===1&&q.lm.r===w[0]&&q.lm.c===w[1]&&q.lm.o===w[2];
    m.userData.ink.material.color.setHex(last?0xfff2b8:GFX_INK);
  }
  for(const [key,m] of Q3.walls)if(!keep.has(key)){Q3.root.remove(m);Q3.walls.delete(key)}
  // 말
  for(let i=0;i<q.n;i++){
    let pw=Q3.pawns.get(i);const p=q.pos[i];
    if(!p||i>=q.cnt){if(pw){Q3.root.remove(pw);Q3.pawns.delete(i)}continue}
    const pose=pawnPose(p,K);
    if(!pw){pw=pawnGroup(PCOL[i%4]);pw.position.set(pose.x,pose.y,pose.z);Q3.root.add(pw);Q3.pawns.set(i,pw);continue}
    const moved=Math.abs(pw.userData.tx-pose.x)>1e-6||Math.abs(pw.userData.tz-pose.z)>1e-6;
    if(moved){if(snap)pw.position.set(pose.x,pose.y,pose.z);else q3Anim(pw,pose,360,.5*U)}
    pw.userData.tx=pose.x;pw.userData.tz=pose.z;
  }
  for(const [i,pw] of Q3.pawns){pw.userData.tx=pw.userData.tx??pw.position.x;pw.userData.tz=pw.userData.tz??pw.position.z}
  q3Marks();
  Q3.dirty=true;
}
/* 갈 수 있는 칸, 미리 보기, 차례 고리, 내 보관대 빛 (고를 때마다) */
function q3Marks(){
  if(!Q3.on||!V||!V.q||!QS)return;
  const q=V.q,me=myIdx(),K=viewK,mine=myTurnNow()&&me>=0;
  const moves=mine&&qMode==='move'?legalMoves(QS,me):[];
  Q3.hl.forEach((h,k)=>{const m=moves[k];h.visible=!!m;if(m){const [vr,vc]=rc(m[0],m[1],K),[x,y]=cellXY(vr,vc);h.position.x=x*U;h.position.z=y*U}});
  // 반투명 말
  if(pend&&pend.k===0&&me>=0){
    if(Q3.ghostP.userData.col!==me){Q3.ghostP.clear();Q3.ghostP.add(pawnGroup(PCOL[me%4],true));Q3.ghostP.userData.col=me}
    const p=pawnPose([pend.r,pend.c],K);Q3.ghostP.position.set(p.x,p.y,p.z);Q3.ghostP.visible=true;
  }else Q3.ghostP.visible=false;
  if(pend&&pend.k===1){const p=wallPose([pend.r,pend.c,pend.o],K);Q3.ghostW.position.set(p.x,p.y,p.z);Q3.ghostW.rotation.y=p.ry;Q3.ghostW.visible=true}else Q3.ghostW.visible=false;
  if(!pend&&hov&&qMode==='wall'){const p=wallPose([hov.r,hov.c,hov.o],K);Q3.hovW.position.set(p.x,p.y,p.z);Q3.hovW.rotation.y=p.ry;Q3.hovW.material.color.setHex(hov.ok?0x2f9e44:0xd6342a);Q3.hovW.visible=true}else Q3.hovW.visible=false;
  // 내 보관함: 고른 벽은 살짝 들어 올림
  const sl=me>=0?Q3.slots.get(me):null;Q3.trayRect=sl?[-TW,TI,TW,TO]:null;   // 내 보관함은 항상 아래 변
  if(sl){if(!(mine&&qMode==='wall'))Q3.sel=null;
    sl.w.forEach((m,g)=>{if(!m)return;const p=slotPose(sl.side,g);m.position.y=p.y+(g===Q3.sel?.16:0)})}
  // 차례 고리
  if(IN.on3d)return void(Q3.dirty=true);   // 시작 연출 중 차례 고리는 주사위가 멈춘 뒤에 켜짐
  const ti=V.st==='play'?V.t:-1,pw=Q3.pawns.get(ti);
  if(pw){Q3.ring.material.color.set(PCOL[ti%4]);Q3.ring.userData.pw=pw;Q3.ring.visible=true}else Q3.ring.visible=false;
  Q3.dirty=true;
}
/* 카메라: 보드(+보관대)가 '보드 자리'(위 HUD 아래, 휴대폰은 내 정보 칸 위)에 꽉 차게. 4명 휴대폰은 양옆 보관대를 조금만 보이게 */
/* 이름 칸을 판 위·아래 끝에서 일정 거리(CHIP_GAP)만큼 띄움. 카메라 자리를 새로 정할 때만 부름 (매 프레임 계산 없음)
   topY·botY: 판 자리(물건 포함)의 화면 위·아래 끝(px). 위 칸은 아래 끝을, 내 칸은 위 끝을 맞춤 */
const CHIP_GAP=10;
function chipsAt(topY,botY){
  const r=elQd,bar=r.querySelector('.qd-bar'),mb=r.querySelector('.qd-mebar');if(!bar||!mb)return;
  const H=r.clientHeight,lim=H-(r.clientWidth<700?70:14)-(mb.offsetHeight||34);
  r.style.setProperty('--bs',Math.max(bar.offsetHeight,Math.round(topY-CHIP_GAP-bar.offsetTop))+'px');
  r.style.setProperty('--mt',Math.round(Math.min(botY+CHIP_GAP,lim))+'px');
  r.classList.add('lay');
}
/* 탑뷰 판 자리: 판 가운데 = 화면 가운데. 위아래는 이름 칸 자리(안내 줄·위 칸 / 내 칸·버튼)를 같은 높이로 비우고 양옆은 조금만(휴대폰 8px, PC 16px) */
function tvBox(r,p){
  const W=r.clientWidth,Hh=r.clientHeight,narrow=W<700,bar=r.querySelector('.'+p+'-bar'),mb=r.querySelector('.'+p+'-mebar');
  const R=Math.max(bar.offsetTop+bar.offsetHeight+CHIP_GAP,(narrow?70:14)+(mb.offsetHeight||26)+CHIP_GAP),m=narrow?8:16;
  return {fw:W-2*m,fh:Hh-2*R,cy:Hh/2,R};
}
function q3Layout(t){
  if(t-Q3.layAt<100&&Q3.lay)return false;   // 보드 자리 크기가 바뀌었는지 자주 확인 (시작 직후 위쪽 목록이 그려지면서 자리가 바뀜)
  Q3.layAt=t;
  const st=$('#stage'),W=st.clientWidth,Hh=st.clientHeight;if(!W||!Hh||!V||!V.q)return false;
  const q=V.q,sides=new Set();for(let i=0;i<q.cnt;i++)if(q.pos[i])sides.add((q.sd[i]+viewK)&3);
  const B=tvBox(elQd,'qd'),key=[W,Hh,[...sides].sort().join(''),B.R].join(',');
  if(key===Q3.lay)return false;
  Q3.lay=key;
  const fw=B.fw,fh=B.fh,fy=B.cy-fh/2;
  // 보드와 보관함이 다 들어오게. 좁은 화면(휴대폰 세로)에서는 양옆 보관함을 벽 끝만 보이게 해서 보드를 크게
  const hy=(sides.has(0)||sides.has(2)?TO:BH)+.05,side=sides.has(1)||sides.has(3);
  const full=Math.min(fw/(2*((side?TO:BH)+.05)),fh/(2*hy)),peek=Math.min(fw/(2*(BH+(side?PEEK:0))),fh/(2*hy));
  const sc=(side&&full<peek*.93?peek:full)*.97,ppu=sc/(U*BS);   // 화면 1px에 해당하는 월드 크기의 역수 (보드 높이에서)
  const cam=Q3.cam,f=Math.tan(cam.fov*Math.PI/360),d=(Hh/2)/(ppu*f);
  cam.aspect=W/Hh;cam.position.set(0,TOP*BS+d,0);cam.lookAt(0,TOP*BS,0);
  const ox=W/2-W/2,oy=(fy+fh/2)-Hh/2;
  cam.setViewOffset(W,Hh,-ox,-oy,W,Hh);cam.updateProjectionMatrix();cam.updateMatrixWorld();
  chipsAt(fy+fh/2-hy*sc,fy+fh/2+hy*sc);
  Q3.d=d;Q3.W=W;Q3.H=Hh;Q3.dirty=true;
  return true;
}
function q3Step(now){
  let busy=false;
  Q3.anim=Q3.anim.filter(a=>{
    const k=Math.min(1,(now-a.t0)/a.dur),e=ease(k);busy=true;
    a.obj.position.set(a.from.x+(a.to.x-a.from.x)*e,a.from.y+(a.to.y-a.from.y)*e+a.hop*Math.sin(Math.PI*k),a.from.z+(a.to.z-a.from.z)*e);
    if(a.to.ry!=null)a.obj.rotation.y=a.ry0+(a.to.ry-a.ry0)*e;
    return k<1;
  });
  if(Q3.ring.visible){const pw=Q3.ring.userData.pw;if(pw){Q3.ring.position.x=pw.position.x;Q3.ring.position.z=pw.position.z}const s=1+.12*Math.sin(now/220);Q3.ring.scale.set(s,s,1);Q3.ring.material.opacity=.55+.35*Math.sin(now/220)}
  return busy;
}
function q3Render(t){
  if(!Q3.on||!T.ok)return;
  if(q3Layout(t))Q3.dirty=true;
  const busy=q3Step(t),intro=IN.on3d&&introStep(t);
  if(!busy&&!intro&&!Q3.dirty&&t-Q3.lastR<(Q3.ring.visible?60:400))return;   // 움직이는 게 없으면 가끔만 그림 (배터리)
  Q3.dirty=false;Q3.lastR=t;
  const fog=T.scene.fog,fn=fog?fog.near:0,ff=fog?fog.far:0;
  if(fog){fog.near=Q3.d+4;fog.far=Q3.d+26}
  for(const m of [T.timerBg,T.timerArc,T.ring])if(m)m.visible=false;   // 공통 테이블의 자리별 시간 고리는 숨김 (시간은 위쪽 목록에 표시)
  let cam=Q3.cam;
  {const k=intro&&IN.fromLobby?ease((t-IN.t0)/INTRO.cam):1;
   if(k<1){   // 시작 연출: 이 기기의 로비 카메라(공통 T.cam: 화면 크기마다 다른 위치·범위)에서 쿼리도 카메라로 위치·방향·화면 범위를 함께 옮김
     const ic=Q3.icam||(Q3.icam=new THREE.PerspectiveCamera());
     ic.position.copy(T.cam.position).lerp(Q3.cam.position,k);ic.quaternion.copy(T.cam.quaternion).slerp(Q3.cam.quaternion,k);
     const a=T.cam.projectionMatrix.elements,b=Q3.cam.projectionMatrix.elements,m=ic.projectionMatrix.elements;
     for(let j=0;j<16;j++)m[j]=a[j]+(b[j]-a[j])*k;
     ic.projectionMatrixInverse.copy(ic.projectionMatrix).invert();ic.updateMatrixWorld();
     if(fog){fog.near=fn+(fog.near-fn)*k;fog.far=ff+(fog.far-ff)*k}
     cam=ic;
   }}
  T.r.render(T.scene,cam);
  if(fog){fog.near=fn;fog.far=ff}
}
/* ---------- 시작 연출 (게임이 시작되면 한 번: 방장이 그동안 제한 시간·봇을 멈춤, 길이 G.introMs) ----------
   0~1.3초     로비 카메라(이 기기 화면의 테이블 앞 눈높이) → 바로 위 90도. 0.65초부터 위쪽 이름 목록이 들어옴
   0.15~0.6초  보드가 위에서 툭 내려앉음, 0.45~1.1초 칸 81개가 가운데부터 바깥으로 솟아오름, 0.9초부터 좌표 글자
   1.0~1.4초   보관함이 바깥에서 미끄러져 들어옴, 1.25~2.0초 벽이 홈에 하나씩 꽂힘(탁탁탁)
   1.95~2.7초  말이 출발 칸에 하나씩 떨어져 튕기고, 닿는 순간 그 사람의 목표 줄이 그어짐
   2.6초~  보드 가운데에 주사위 하나를 던짐(면마다 자리 색, 5·7명은 '다시 굴리기' 면이 나오면 한 번 더) → 멈추면 위 면 색 자리의 말 밑에 고리 + 가운데에 'OO부터 시작합니다'
   다시 하기(이미 쿼리도 화면)는 카메라·보드 없이 벽·말·주사위만. 늦게 들어오거나 다시 연결된 사람은 연출 없이 바로 (공통 dealCheck)
   기기의 '움직임 줄이기' 설정과 상관없이 보임 (야추다이스와 같게), WebGL이 없으면 주사위 없이 위쪽 이름 목록의 켜짐(멈춘 뒤 첫 차례)만 */
const INTRO={cam:1300,ui:650,board:[150,450],cells:[450,90,260],lab:[900,350],tray:[1000,380],walls:[1250,55,220],pawn:[1950,110,380],stripe:300,rest:500};   // rest: 보드 준비(마지막 말의 목표 줄)가 끝난 뒤 주사위 전 쉬는 박자. 주사위의 길이는 공통 firstPick이 정함(다시 굴린 횟수가 판마다 달라서 연출 길이도 달라짐)
/* 주사위 시작 시각: 마지막 말이 떨어져 목표 줄이 다 그어진 뒤 + 쉬는 박자 (인원수에 따라) */
const roulAt=n=>INTRO.pawn[0]+(Math.max(1,n)-1)*INTRO.pawn[1]+INTRO.pawn[2]*.68+INTRO.stripe+INTRO.rest;
const introN=()=>(typeof H!=='undefined'&&H&&H.q&&H.q.cnt)||(V&&V.q&&V.q.cnt)||4;
const DIE=.6;   // 주사위 한 변 (보드 묶음 안 단위. 칸 간격 .58과 비슷)
G.firstPick=true;   // 첫 차례 주사위는 core/engine.js의 firstPick + dicepick.js를 씀 (값은 테스트룸 lab.html에서 맞춤)
G.introMs=(again,rolls)=>Math.round(roulAt(introN())+DicePick.totalFor(rolls)+100);   // 주사위 시작 + 주사위 길이 + 여유 0.1초 (정수 ms: 방장 시계와 신호가 소수로 어긋나지 않게)
const IN={on:false,on3d:false,t0:0,total:0,r:0,fromLobby:true,said:false,fp:null,die:null,L:[],snd:{}};
const introOn=()=>IN.on&&clock()<IN.t0+IN.total;
const introWait=()=>introOn()&&!IN.said;   // 첫 차례 안내 전
const eOut=x=>{x=x<0?0:x>1?1:x;return 1-Math.pow(1-x,3)};
const popS=x=>x<=0?0:x>=1?1:1+2.2*Math.pow(x-1,3)+1.2*Math.pow(x-1,2);   // 0→1, 살짝 넘쳤다가 제자리
const dropY=(x,h)=>x>=1?0:x<.68?h*(1-(x/.68)*(x/.68)):h*.13*Math.sin(Math.PI*(x-.68)/.32);   // 떨어진 뒤 한 번 튕김
/* 주사위: 켜질 사람 (멈추기 전 -1, 멈춘 뒤 첫 차례 사람) */
function introIdx(e){
  if(!IN.fp)return V?V.t:0;
  return IN.fp.idx(IN.t0+e);
}
G.intro=(t0,o)=>{
  if(!V||!V.q||!V.ps)return;
  const q=V.q,L=[];for(let i=0;i<q.cnt;i++)if(q.pos[i])L.push(i);
  if(!L.length)return;
  const rolls=o&&o.rolls,seed=(o&&o.seed)||1;   // 방장이 정한 던진 횟수(없으면 한 번, -1은 방장이 직접 고른 선)
  IN.on=true;IN.t0=t0;IN.said=false;IN.snd={};IN.fromLobby=!Q3.on;IN.L=L;IN.r=roulAt(L.length);IN.total=(o&&o.total)||G.introMs(false,rolls);
  if(IN.die){IN.die.dispose();IN.die=null}
  IN.fp=firstPick(t0+IN.r,{seats:L,first:V.t,rolls,seed});   // 방장이 정한 횟수·같은 씨앗으로 모두 같은 주사위가 굴러감
  IN.on3d=true;
  $('#stage').classList.add('qd-intro');if(elQd&&IN.fromLobby)elQd.classList.add('intro');
  lastBar='';Q3.dirty=true;
};
/* 연출 중 3D: 매 프레임 물체 위치를 시간에 맞춤 (게임 상태로 정해진 자리 = 끝난 자리) */
function introStep(now,force){
  if(!Q3.built||!V||!V.q)return false;
  const e=now-IN.t0,done=force||e>=IN.total,fl=IN.fromLobby;
  if(done)IN.on3d=false;
  // 보드
  {const x=done||!fl?1:(e-INTRO.board[0])/INTRO.board[1];Q3.boardG.visible=x>0;Q3.boardG.position.y=dropY(Math.max(0,x),1.6)}
  for(const m of Q3.cells){const x=done||!fl?1:(e-INTRO.cells[0]-m.userData.ring*INTRO.cells[1])/INTRO.cells[2];m.scale.setScalar(Math.max(.001,popS(x)))}
  Q3.lab.material.opacity=done||!fl?1:eOut((e-INTRO.lab[0])/INTRO.lab[1]);
  // 보관함: 바깥에서 미끄러져 들어옴
  Q3.trays.forEach((g,sd)=>{const x=done||!fl?1:(e-INTRO.tray[0])/INTRO.tray[1],o=(1-eOut(x))*2.2,n=SIDE_N[sd];g.position.set(n[0]*o,0,n[1]*o);g.visible=!!g.userData.on&&x>0});
  // 보관함의 벽: 홈 순서대로 위에서 꽂힘 (모든 사람 같이)
  for(const sl of Q3.slots.values())sl.w.forEach((m,g)=>{if(!m)return;
    const x=done?1:(e-INTRO.walls[0]-g*INTRO.walls[1])/INTRO.walls[2],p=slotPose(sl.side,g);
    m.visible=x>0;m.position.y=p.y+dropY(Math.max(0,x),1.1)});
  // 말과 목표 줄
  const L=IN.L;
  for(const [i,pw] of Q3.pawns){
    const k=Math.max(0,L.indexOf(i)),x=done?1:(e-INTRO.pawn[0]-k*INTRO.pawn[1])/INTRO.pawn[2];
    pw.visible=x>0;pw.position.y=CT+dropY(Math.max(0,x),2.4);
    const st=Q3.stripes[i];if(st){const y=done?1:(e-INTRO.pawn[0]-k*INTRO.pawn[1]-INTRO.pawn[2]*.68)/INTRO.stripe;st.scale.x=Math.max(.001,eOut(y))}
  }
  // 주사위: 보드 가운데에 던짐 (고정 선이면 없음). 끝나면 치움
  if(IN.fp&&!IN.fp.fixed){
    if(!IN.die&&!done&&Q3.root){IN.die=DicePick.mesh(THREE,IN.L.length,IN.L.map(i=>PCOL[i%4]));Q3.root.add(IN.die.g)}
    if(IN.die)IN.die.apply(done||e<IN.r?null:IN.fp.pose(now),DIE,0,CT,0);
  }
  // 차례 고리: 주사위가 멈춘 뒤 첫 차례 말 밑
  if(!done&&IN.fp&&e<IN.r+IN.fp.total+80){
    const pw=e>=IN.r?Q3.pawns.get(introIdx(e)):null;
    Q3.ring.visible=!!pw;if(pw){Q3.ring.userData.pw=pw;Q3.ring.material.color.set(PCOL[introIdx(e)%4])}
  }
  if(done){for(const pw of Q3.pawns.values())pw.visible=true;if(IN.die){IN.die.dispose();IN.die=null}q3Marks()}
  return true;
}
/* 연출을 바로 끝냄 (게임을 떠날 때) */
function introEnd(){
  if(IN.on3d)introStep(clock(),true);
  if(IN.die){IN.die.dispose();IN.die=null}
  IN.on=false;IN.on3d=false;IN.said=true;
  $('#stage').classList.remove('qd-intro');if(elQd)elQd.classList.remove('intro');
}
/* 연출 중 소리·화면 글자 (매 프레임, G.live) */
function introTick(){
  if(!IN.on)return;
  const e=clock()-IN.t0,S=IN.snd,once=(k,f)=>{if(!S[k]){S[k]=1;f()}},d3=IN.on3d&&Q3.on;
  if(e>=INTRO.ui&&elQd&&elQd.classList.contains('intro'))elQd.classList.remove('intro');
  if(d3&&IN.fromLobby){
    if(e>=INTRO.board[0]+INTRO.board[1]*.68)once('thud',()=>{tone(120,.13,{type:'triangle',vol:.2});hiss(.09,{freq:650,vol:.12})});
    for(let r=0;r<5;r++)if(e>=INTRO.cells[0]+r*INTRO.cells[1])once('c'+r,()=>tone(700+r*110,.035,{type:'triangle',vol:.04}));
    if(e>=INTRO.tray[0])once('tray',()=>hiss(.3,{freq:500,sweep:1400,q:.7,vol:.08}));
  }
  if(d3){
    for(let g=0;g<10;g++)if(e>=INTRO.walls[0]+g*INTRO.walls[1]+INTRO.walls[2]*.68)once('w'+g,()=>{hiss(.03,{freq:2600,q:2,vol:.1});tone(380+g*22,.04,{type:'triangle',vol:.08})});
    const L=IN.L;
    L.forEach((i,k)=>{if(e>=INTRO.pawn[0]+k*INTRO.pawn[1]+INTRO.pawn[2]*.68)once('p'+k,()=>{tone(190,.08,{type:'triangle',vol:.16});hiss(.04,{freq:1500,vol:.08});tone(520+k*130,.12,{type:'sine',vol:.06,at:.05})})});
  }
  if(IN.fp&&e>=IN.r&&IN.fp.tick(IN.t0+e)){   // 닿는 소리, 멈추는 순간 한 번 안내
    IN.said=true;$('#stage').classList.remove('qd-intro');if(elQd)elQd.classList.remove('intro');
    fxSay(IN.fp.msg(),PCOL[IN.fp.first%4]);   // 멈추면 가운데에 안내
    lastBar='';if(Q3.on)q3Marks();
  }
  if(e>=IN.total){IN.on=false;lastBar='';lastHint='';G.buttons()}
  drawAll();
}
/* 3D 화면에서 누른 곳 → 보드 위 점 (화면 기준 칸 단위) */
const q3Ray=()=>Q3.ray||(Q3.ray=new THREE.Raycaster());
function q3Point(e){
  const r=T.r.domElement.getBoundingClientRect();if(!r.width)return null;
  const nx=(e.clientX-r.left)/r.width*2-1,ny=-(e.clientY-r.top)/r.height*2+1;
  const ray=q3Ray();ray.setFromCamera({x:nx,y:ny},Q3.cam);
  const o=ray.ray.origin,dv=ray.ray.direction;if(Math.abs(dv.y)<1e-6)return null;
  const k=(CT*BS-o.y)/dv.y;return [(o.x+dv.x*k)/(U*BS),(o.z+dv.z*k)/(U*BS)];   // 보드 묶음 안의 칸 단위
}
function q3Click(e){
  if(!Q3.on||G!==GAMES.quoridor)return;
  const p=q3Point(e);if(!p)return;
  const [x,y]=p,me=myIdx(),R=Q3.trayRect;
  // 내 보관함의 벽을 누르면 그 벽을 고름 (벽 모드). 고른 벽을 다시 누르면 취소
  if(R&&x>=R[0]-.2&&x<=R[2]+.2&&y>=R[1]-.2&&y<=R[3]+.2){
    if(!myTurnNow()){sfx('no');return}
    const sl=Q3.slots.get(me);let best=-1,bd=1e9;
    if(sl)sl.w.forEach((m,g)=>{if(!m)return;const d=Math.abs((g-4.5)*PT-x);if(d<bd){bd=d;best=g}});
    if(best<0){sfx('no');return}
    if(qMode==='wall'&&Q3.sel===best){setMode('move');return}
    Q3.sel=best;if(qMode!=='wall')setMode('wall');else{pend=null;hov=null;sfx('tick');redraw()}
    return;
  }
  // 벽 모드에서 내 말을 누르면 말 이동으로
  if(qMode==='wall'&&me>=0&&V.q.pos[me]){const pw=Q3.pawns.get(me);if(pw&&Math.hypot(x-pw.position.x/U,y-pw.position.z/U)<.42){setMode('move');return}}
  pickAt(x/PT+4.5,y/PT+4.5);
}
function q3Move(e){
  if(!Q3.on||G!==GAMES.quoridor||e.pointerType==='touch')return;
  const p=q3Point(e);if(!p){hoverAt(null,null);return}
  hoverAt(p[0]/PT+4.5,p[1]/PT+4.5);
}
/* 새 상태를 받았을 때 (그리기 전 / 그린 뒤) */
G.preView=()=>{
  if(!V.q){QS=null;return}
  QS=buildS(V.q);
  const me=myIdx();
  viewK=me>=0&&V.q.sd[me]!=null?(4-V.q.sd[me])&3:0;
  // 차례가 바뀌거나 누군가 두면 미리 골라 둔 벽·모드는 처음으로
  if(!PV||!PV.q||PV.t!==V.t||PV.st!==V.st||PV.q.w.length!==V.q.w.length||(PV.q.rec||[]).length!==(V.q.rec||[]).length){qMode='move';pend=null;hov=null;Q3.sel=null}
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
  // 3D: WebGL이 되면 공통 테이블 위에 보드를 놓고, 안 되면 2D 그림
  const d3=on&&q3Build();
  if(d3!==Q3.on){Q3.on=d3;Q3.lay='';Q3.K=-1;if(Q3.root)Q3.root.visible=d3;$('#stage').classList.toggle('qd3d',d3);lastBoard='';lastHint=''}
  $('#stage').classList.toggle('qd2d',on&&!d3);
  if(!on){lastBoard='';lastBar='';lastHint='';lastModes='';return}
  drawAll();
  q3Sync();
};
G.handMarks=()=>{};
G.me=()=>{$('#numpick').hidden=true};
G.usesDbl=true;   // 개인 설정 '두 번 눌러 놓기'를 게임 중 메뉴에 보임
G.no3D=true;   // 3D 테이블을 쓰지 않음: 공통 코드가 그리기를 쉬어서 휴대폰 배터리를 아낌
G.buttons=()=>{
  const play=$('#btnPlay'),can=!!(pend&&myTurnNow());
  $('#btnPass').hidden=true;$('#btnGura').hidden=true;
  play.disabled=!can;play.classList.toggle('ready',can);
  if($('#playMain').textContent!=='놓기')$('#playMain').textContent='놓기';
  const sub=keyLabel(KEYS.play);if($('#playSub').textContent!==sub)$('#playSub').textContent=sub;
};
G.live=()=>{
  if(IN.on){introTick();return}
  if(elHint&&V&&V.st==='play'&&V.t===myIdx())drawHint();   // 남은 시간 안내
  const bar=elQd&&elQd.querySelector('.qd-bar .qd-p.on .tb i,.qd-mebar .qd-p.on .tb i');
  if(bar&&V&&V.st==='play'){const left=Math.max(0,(V.deadAt-clock())/1000);bar.style.width=Math.min(100,left/(V.cfg.turn||30)*100)+'%'}
};
G.play=confirmPend;
G.pass=()=>{};
G.keyPhase=st=>st==='play';
G.onKey=(act,e)=>{
  if(act==='qmode'){
    if(!e.repeat&&myTurnNow()&&V.q)setMode(qMode==='move'?'wall':'move');
    return true;
  }
  if(act==='qrot'){if(!e.repeat){qOri^=1;hov=null;drawGhost();Q3.dirty=true}return true}
  return false;
};
/* 공통 코드가 다른 사람 자리에 놓는 카드 더미(손패 표시 1장)는 쿼리도에 없으니 숨김 */
G.field3D=()=>{if(T.stacks)for(const arr of T.stacks.values())arr.forEach(c=>{c.visible=false})};
G.render3D=t=>{if(Q3.on)q3Render(t);else if(T.ok&&!$('#stage').classList.contains('qd2d'))T.r.render(T.scene,T.cam)};   // 게임 중(3D)은 자기 카메라로, 대기실은 다른 게임처럼 공통 테이블(시작 연출이 이 카메라에서 출발), 2D 게임 중은 그리기를 쉼
/* 이 게임으로 바뀔 때 / 다른 게임으로 바뀔 때 */
G.enter=()=>{
  $('#stage').classList.add('qd');
  $('#btnPass').hidden=true;$('#btnGura').hidden=true;$('#numpick').hidden=true;
  qMode='move';pend=null;hov=null;
  if(elQd)fit();
};
G.leave=()=>{
  introEnd();   // 연출 도중에 나가면 물체를 제자리로 (주사위도 치움)
  $('#stage').classList.remove('qd','qd-over','qd3d','qd2d');
  if(T.stacks)for(const arr of T.stacks.values())arr.forEach(c=>{c.visible=true});
  if(Q3.root)Q3.root.visible=false;Q3.on=false;Q3.anim=[];
  $('#btnPass').hidden=false;
  if(elQd){elQd.hidden=true;lastBoard='';lastBar='';lastHint='';lastModes=''}
};
/* 처음 한 번: 보드 화면 만들기 */
G.init=()=>{
  const css=document.createElement('style');
  css.textContent=`
.stage.qd{background:radial-gradient(ellipse at 50% 38%,#f3e4c2 0%,#e2c89a 70%,#d3b27c 100%)}
.stage.qd.qd2d #cv,.stage.qd #dim{visibility:hidden}   /* 3D 캔버스는 WebGL 없이 2D로 하는 게임 중에만 숨김 (대기실은 다른 게임처럼 테이블이 보임) */
.stage.qd-intro .actions,.stage.qd-intro .myplate,.stage.qd-intro #qd .qd-row{opacity:0;pointer-events:none}
.stage.qd .actions,.stage.qd .myplate,#qd .qd-row,#qd .qd-bar,#qd .qd-mebar{transition:opacity .35s}
#qd.intro .qd-bar,#qd.intro .qd-mebar{opacity:0}
.stage.qd3d #qd svg,.stage.qd3d #qd .qd-modes{display:none}
.stage.qd3d #qd .qd-hint{flex:0 1 auto;background:rgba(255,250,240,.9);border:1px solid var(--line-strong,#cdb391);border-radius:99px;padding:4px 12px;box-shadow:0 2px 6px -2px rgba(59,42,31,.35)}
.stage.qd .labels{visibility:hidden}
.stage.qd .nogl{display:none}
.stage.qd.qd-over .myplate,.stage.qd.qd-over .actions{display:none}
.specbar:not([hidden])~#qd .qd-bar{margin-top:30px}
.stage.qd .actions{left:auto}
.stage.qd .myplate{max-width:calc(100% - 150px)}
#qd{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;gap:6px;padding:8px 10px 82px;pointer-events:none;min-height:0}
#qd[hidden]{display:none}
#qd .qd-bar{min-height:44px;display:flex;flex-wrap:wrap;justify-content:center;align-items:flex-start;align-content:flex-end;gap:6px;align-self:center;max-width:calc(100% - 188px);pointer-events:none}
#qd .qd-mebar{position:absolute;left:50%;bottom:var(--plateB,14px);transform:translateX(-50%);z-index:2;display:flex;pointer-events:none;max-width:calc(100% - 188px)}
#qd .qd-mebar:empty{display:none}
#qd .qd-p{position:relative;display:flex;align-items:center;gap:6px;padding:4px 10px 6px;border-radius:12px;background:rgba(255,250,240,.92);border:1.5px solid var(--line-strong,#cdb391);font-size:13px;line-height:1.15;overflow:hidden;white-space:nowrap;max-width:100%}
#qd .qd-p .dot{width:12px;height:12px;border-radius:50%;background:var(--pc);box-shadow:0 0 0 2px #fffaf0,0 0 0 3px var(--pc);flex:none}
#qd .qd-p b{font-weight:600;overflow:hidden;text-overflow:ellipsis;max-width:9em}
#qd .qd-p .w{font-family:var(--f-num,inherit);font-size:12px;color:var(--muted,#7a6550)}
#qd .qd-p.on{border-color:var(--pc);box-shadow:0 0 0 2px var(--pc)}
#qd .qd-p.me b{color:#3b2a1f}
#qd .qd-p.out{opacity:.55}
#qd .qd-p .tb{position:absolute;left:0;right:0;bottom:0;height:3px;background:rgba(0,0,0,.08)}
#qd .qd-p .tb i{display:block;height:100%;width:100%;background:var(--pc)}
#qd .qd-row{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;width:100%;pointer-events:none;min-height:44px}
.stage.qd3d #qd .qd-row{height:44px;min-height:0;flex:none;align-items:flex-start;padding-top:4px;overflow:visible;position:relative;z-index:1}   /* 3D: 안내 글이 길어지거나 글자가 커도 줄 높이는 그대로 (넘치면 보드 위로 살짝 겹침) → 보드·카메라가 움직이지 않음 */
#qd .qd-hint{flex:1 1 200px;min-width:0;font-size:13px;line-height:1.3;color:#5b4129;text-align:center;min-height:17px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}   /* 안내 글이 바뀌어도 보드가 움직이지 않게 줄 높이 고정 (최대 2줄) */
#qd .qd-hint:empty{visibility:hidden}   /* 안내가 없으면 자리만 남김 (보드가 들썩이지 않게) */
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
@media (max-width:520px){#qd .qd-p{font-size:12px;padding:3px 8px 5px}#qd .qd-m{height:32px;padding:0 10px;font-size:14px}}
@media (max-width:520px){.stage.qd2d #qd .qd-bar{align-self:flex-start;width:calc(100% - 150px);max-width:none}}
.stage.qd3d #qd .qd-row{order:-1}
.stage.qd3d #qd.lay .qd-bar{transform:translateY(calc(var(--bs) - 100%));transition:transform .35s,opacity .35s}
.stage.qd3d #qd.lay .qd-mebar{top:var(--mt);bottom:auto;transition:top .35s,opacity .35s}
.stage.qd3d .specbar:not([hidden])~#qd .qd-bar{margin-top:0}
.stage.qd3d .specbar:not([hidden])~#qd .qd-row{margin-top:30px}
@media (max-width:699px){#qd{padding-bottom:112px}#qd .qd-mebar{bottom:70px;max-width:calc(100% - 24px)}}
`;
  document.head.appendChild(css);
  elQd=document.createElement('div');elQd.id='qd';elQd.hidden=true;
  elQd.innerHTML=`<div class="qd-bar"></div><div class="qd-mebar"></div><div class="qd-row"><div class="qd-hint" aria-live="polite"></div><div class="qd-modes" role="group" aria-label="행동 고르기"></div></div><div class="qd-bd"><svg viewBox="${VB.x} ${VB.y} ${VB.w} ${VB.w}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="쿼리도 보드"><g id="qdMain"></g><g id="qdGhost"></g></svg></div>`;
  $('#stage').insertBefore(elQd,$('#fx'));
  elSvg=elQd.querySelector('svg');elMain=elQd.querySelector('#qdMain');elGhost=elQd.querySelector('#qdGhost');
  elBar=elQd.querySelector('.qd-bar');elBarMe=elQd.querySelector('.qd-mebar');elHint=elQd.querySelector('.qd-hint');elModes=elQd.querySelector('.qd-modes');
  elSvg.addEventListener('click',onSvgClick);
  elSvg.addEventListener('pointermove',onSvgMove);
  elSvg.addEventListener('pointerleave',()=>hoverAt(null,null));
  elModes.addEventListener('click',e=>{
    const b=e.target.closest('.qd-m');if(!b||b.disabled)return;
    setMode(b.dataset.m);
  });
  document.addEventListener('keydown',e=>{if(e.code==='Escape'&&pend&&elQd&&!elQd.hidden){pend=null;redraw()}});
  window.addEventListener('resize',()=>{fit();Q3.lay=''});
  $('#cv').addEventListener('click',q3Click);
  $('#cv').addEventListener('pointermove',q3Move);
  $('#cv').addEventListener('pointerleave',()=>{if(Q3.on)hoverAt(null,null)});
  document.addEventListener('click',e=>{
    const b=e.target.closest('.qd-copy');if(!b||!V||!V.q)return;
    const txt=recordText(V),done=ok=>{b.textContent=ok?'복사했습니다':'복사하지 못했습니다';setTimeout(()=>{b.textContent='기보 복사'},1600)};
    try{navigator.clipboard.writeText(txt).then(()=>done(true),()=>done(false))}catch(_){done(false)}
  });
};

const toW=p=>({x:p.x*BS,y:p.y*BS,z:p.z*BS,ry:p.ry});
G._q3={Q3,IN,introEnd,wallPose:(w)=>toW(wallPose(w,viewK)),pawnPose:(p)=>toW(pawnPose(p,viewK)),trayRect:()=>Q3.trayRect,U:U*BS};   // 화면 검사용
(window.GAMES=window.GAMES||{}).quoridor=G;
})();
