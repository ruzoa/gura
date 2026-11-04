/* ===== 아발론 게임 모듈 =====
   공통 코드(core/)가 GAMES.abalone의 함수를 불러서 이 게임의 규칙·봇·화면을 그림. 화면 틀은 동물장기·픽셀을 따름(탑뷰, 2명, 체스 시계).
   판: 한 변 5칸의 육각형 61칸. 칸 번호는 위 줄 왼쪽부터 0~60. b[칸] = 0 빈 칸, 1 흑, 2 백. 색 번호 col = 0 흑, 1 백 (값 = col + 1)
   방향 d: 0 동, 1 남동, 2 남서, 3 서, 4 북서, 5 북동. d%3이 같으면 같은 줄, (d+3)%6은 반대 방향
   수: 일직선으로 붙은 내 구슬 1~3개를 방향 d로 한 칸. 줄 방향이면 더 적은 상대 줄을 밀 수 있고, 밀린 구슬이 판 밖으로 나가면 떨어짐. 상대 구슬 6개를 떨어뜨리면 승리
   손패(hand)는 표시용 값 [0] (공통 코드가 hand가 비면 끝난 사람으로 봄) */
(function(){
const G={id:'abalone',name:'아발론',short:'아발론',lead:'구슬을 밀어 판 밖으로',maxHi:2,minN:2,noFast:true,firstPick:true};

/* ---------- 규칙 (방장 엔진·화면·봇·테스트가 같은 함수를 씀) ---------- */
const CELLS=61,NEED=6,NP_MAX=60,REP=3;
const DIRS=[[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]];   // 축 좌표 (q, r). r이 늘면 아래 줄
const ROW=[],Q=[],R_=[],CX=[],CY=[],NB=[],RY=[],RX=[];
{const id={};
 for(let y=0;y<9;y++){const r=y-4,q0=Math.max(-4,-4-r),q1=Math.min(4,4-r),row=[];
   for(let q=q0;q<=q1;q++){const i=Q.length;id[q+','+r]=i;Q.push(q);R_.push(r);CX.push(q+r/2);CY.push(r*Math.sqrt(3)/2);RY.push(y);RX.push(q-q0);row.push(i)}
   ROW.push(row)}
 for(let i=0;i<CELLS;i++)NB.push(DIRS.map(([a,b])=>{const k=id[(Q[i]+a)+','+(R_[i]+b)];return k==null?-1:k}));}
/* 시작 배치: 0 표준, 1 벨기안 데이지, 2 독일 데이지 (흑 = 판 아래쪽이 기본) */
const LAY_NAME=['표준','벨기안 데이지','독일 데이지'];
const LAYS=[
  [[0,[0,1,2,3,4],2],[1,[0,1,2,3,4,5],2],[2,[2,3,4],2],[6,[2,3,4],1],[7,[0,1,2,3,4,5],1],[8,[0,1,2,3,4],1]],
  [[0,[0,1],2],[0,[3,4],1],[1,[0,1,2],2],[1,[3,4,5],1],[2,[1,2],2],[2,[4,5],1],[6,[1,2],1],[6,[4,5],2],[7,[0,1,2],1],[7,[3,4,5],2],[8,[0,1],1],[8,[3,4],2]],
  [[1,[0,1],2],[1,[4,5],1],[2,[0,1,2],2],[2,[4,5,6],1],[3,[1,2],2],[3,[5,6],1],[5,[1,2],1],[5,[5,6],2],[6,[0,1,2],1],[6,[4,5,6],2],[7,[0,1],1],[7,[4,5],2]]];
function startBoard(l){const b=new Array(CELLS).fill(0);for(const [y,xs,v] of LAYS[l]||LAYS[0])for(const x of xs)b[ROW[y][x]]=v;return b}
/* 칸 이름: 아래 줄 A ~ 위 줄 I, 번호는 공식 표기 */
const cellName=i=>'IHGFEDCBA'[RY[i]]+(RX[i]+1+Math.max(0,4-RY[i]));
const hexDist=i=>Math.max(Math.abs(Q[i]),Math.abs(R_[i]),Math.abs(Q[i]+R_[i]));
/* 고른 구슬을 한 줄 순서로 (축 a 방향으로 정렬). 일직선으로 붙어 있지 않으면 null */
function lineOf(cells){
  if(!Array.isArray(cells)||cells.length<1||cells.length>3||new Set(cells).size!==cells.length)return null;
  if(cells.length===1)return {a:-1,o:cells.slice()};
  for(let a=0;a<3;a++){
    const set=new Set(cells),st=cells.filter(c=>!set.has(NB[c][a+3]));
    if(st.length!==1)continue;
    const o=[st[0]];let c=NB[st[0]][a];while(c>=0&&set.has(c)){o.push(c);c=NB[c][a]}
    if(o.length===cells.length)return {a,o};
  }
  return null;
}
/* 수 판정. 되면 {c:움직이는 내 구슬, d, p:밀리는 상대 구슬(가까운 쪽부터), off:떨어지는 칸 또는 -1, inl:줄 방향} */
function tryMove(b,cells,d,v){
  if(!Number.isInteger(d)||d<0||d>5)return null;
  if(!Array.isArray(cells)||!cells.every(c=>Number.isInteger(c)&&c>=0&&c<CELLS&&b[c]===v))return null;
  const L=lineOf(cells);if(!L)return null;
  const n=cells.length,inl=n>1&&d%3===L.a;
  if(!inl){
    for(const c of cells){const t=NB[c][d];if(t<0||b[t])return null}
    return {c:cells.slice(),d,p:[],off:-1,inl:false};
  }
  const head=d===L.a?L.o[n-1]:L.o[0],s=NB[head][d];
  if(s<0||b[s]===v)return null;
  if(!b[s])return {c:cells.slice(),d,p:[],off:-1,inl:true};
  const p=[];let c=s;
  while(c>=0&&b[c]&&b[c]!==v){p.push(c);c=NB[c][d]}
  if(p.length>=n||(c>=0&&b[c]===v))return null;
  return {c:cells.slice(),d,p,off:c<0?p[p.length-1]:-1,inl:true};
}
function applyMove(b,m){
  const nb=b.slice(),v=b[m.c[0]],o=3-v;
  for(const c of m.c)nb[c]=0;
  for(const c of m.p)nb[c]=0;
  for(const c of m.c)nb[NB[c][m.d]]=v;
  for(const c of m.p)if(c!==m.off)nb[NB[c][m.d]]=o;
  return nb;
}
/* 둘 수 있는 수 전부 (봇 탐색이 자주 부르므로 tryMove를 거치지 않고 바로 셈. 결과는 tryMove와 같음) */
const NOP=[];
function legal(b,v){
  const out=[],o=3-v;
  const inline=(cs,head,d)=>{
    const s=NB[head][d];if(s<0)return;const x=b[s];if(x===v)return;
    if(!x){out.push({c:cs,d,p:NOP,off:-1,inl:true});return}
    const n=cs.length,p=[s];let c=NB[s][d];
    while(c>=0&&b[c]===o){p.push(c);if(p.length>=n)return;c=NB[c][d]}
    if(p.length>=n||(c>=0&&b[c]===v))return;
    out.push({c:cs,d,p,off:c<0?p[p.length-1]:-1,inl:true});
  };
  const broad=(cs,a)=>{for(let d=0;d<6;d++){if(d%3===a)continue;let ok=true;for(let k=0;k<cs.length;k++){const t=NB[cs[k]][d];if(t<0||b[t]){ok=false;break}}if(ok)out.push({c:cs,d,p:NOP,off:-1,inl:false})}};
  for(let i=0;i<CELLS;i++){
    if(b[i]!==v)continue;
    const N=NB[i];
    for(let d=0;d<6;d++){const t=N[d];if(t>=0&&!b[t])out.push({c:[i],d,p:NOP,off:-1,inl:false})}
    for(let a=0;a<3;a++){
      const j=N[a];if(j<0||b[j]!==v)continue;
      const c2=[i,j];inline(c2,j,a);inline(c2,i,a+3);broad(c2,a);
      const k=NB[j][a];if(k<0||b[k]!==v)continue;
      const c3=[i,j,k];inline(c3,k,a);inline(c3,i,a+3);broad(c3,a);
    }
  }
  return out;
}
/* 고른 구슬로 갈 수 있는 방향 → 그 방향을 누르는 칸. 옆으로 미는 수는 이웃 방향과 겹치지 않는 끝 칸 */
function arrowsOf(b,cells,v){
  const out=new Map();
  for(let d=0;d<6;d++){
    const m=tryMove(b,cells,d,v);if(!m)continue;
    if(m.inl){const L=lineOf(cells),head=d===L.a?L.o[L.o.length-1]:L.o[0];out.set(NB[head][d],d);continue}
    if(cells.length===1){out.set(NB[cells[0]][d],d);continue}
    const T_=cells.map(c=>NB[c][d]),uniq=T_.find(t=>![0,1,2,3,4,5].some(e=>e!==d&&cells.some(c=>NB[c][e]===t)));
    out.set(uniq!=null?uniq:T_[0],d);
  }
  return out;
}
/* 쉬움 봇: 떨어뜨릴 수 있으면 대체로 떨어뜨리고, 가운데로 모이는 수를 좋아함. 내 구슬이 떨어질 자리는 보통 피하지만 가끔 놓침 */
function botPick(b,v,rnd){
  rnd=rnd||Math.random;
  const ms=legal(b,v);if(!ms.length)return null;
  const careful=rnd()<.6;let best=ms[0],bs=-1e9;
  for(const m of ms){
    let s=rnd()*1.6+m.c.length*.2+m.p.length*.5;
    if(m.off>=0)s+=9;
    for(const c of m.c)s+=(hexDist(c)-hexDist(NB[c][m.d]))*.6;
    if(careful&&s>-1e8&&rnd()<.35){const nb=applyMove(b,m);if(legal(nb,3-v).some(x=>x.off>=0))s-=5}
    if(s>bs){bs=s;best=m}
  }
  return best;
}

/* 보통·어려움 봇: 알파-베타 탐색. 어려움은 정해진 시간 안에서 한 수씩 더 깊이(수당 1초). 점수는 떨어진 구슬이 가장 크고, 가운데·뭉침·가장자리 순 */
const AI={mat:900,cen:[34,26,17,6,-16],coh:5,win:1e6};
let BOTSCALE=1;   // 테스트에서 생각 시간을 줄임
const LEVEL=[null,{ms:220,depth:2,noise:30},{ms:1000,depth:9,noise:4}];
const CEN=[];for(let i=0;i<CELLS;i++)CEN.push(AI.cen[hexDist(i)]);
function evalFor(b,v){   // v 쪽에서 본 점수
  let me=0,op=0,n=0,m=0;
  for(let i=0;i<CELLS;i++){
    const x=b[i];if(!x)continue;
    let s=CEN[i];const N=NB[i];
    for(let d=0;d<3;d++){const j=N[d];if(j>=0&&b[j]===x)s+=AI.coh*2}
    if(x===v){me+=s;n++}else{op+=s;m++}
  }
  return me-op+(n-m)*AI.mat;
}
function makeM(b,m){
  const v=b[m.c[0]],o=3-v,N=m.d;
  for(const c of m.c)b[c]=0;
  for(const c of m.p)b[c]=0;
  for(const c of m.c)b[NB[c][N]]=v;
  for(const c of m.p)if(c!==m.off)b[NB[c][N]]=o;
  return v;
}
function unmakeM(b,m,v){
  const o=3-v,N=m.d;
  for(const c of m.c)b[NB[c][N]]=0;
  for(const c of m.p)if(c!==m.off)b[NB[c][N]]=0;
  for(const c of m.c)b[c]=v;
  for(const c of m.p)b[c]=o;
}
const moveOrder=m=>(m.off>=0?4000:0)+m.p.length*300+m.c.length*40+m.c.reduce((a,c)=>a+CEN[NB[c][m.d]]-CEN[c],0);
const countV=(b,v)=>{let n=0;for(let i=0;i<CELLS;i++)if(b[i]===v)n++;return n};
class SearchStop extends Error{}
function searchAB(b,v,dep,al,be,S,ply){
  if((++S.nodes&255)===0&&Date.now()>S.end)throw new SearchStop();
  if(countV(b,v)<=8)return -AI.win+ply;
  if(countV(b,3-v)<=8)return AI.win-ply;
  if(S.np+ply>=NP_MAX){const d=countV(b,v)-countV(b,3-v);return d>0?AI.win/2-ply:d<0?-AI.win/2+ply:0}   // 60수 판정
  if(dep<=0)return evalFor(b,v);
  const ms=legal(b,v);if(!ms.length)return -AI.win+ply;
  ms.forEach(m=>{m.o=moveOrder(m)});ms.sort((x,y)=>y.o-x.o);
  let best=-Infinity;
  for(const m of ms){
    const vv=makeM(b,m);let s;
    try{const S0=S.np;if(m.off>=0)S.np=-ply-1;s=-searchAB(b,3-v,dep-1,-be,-al,S,ply+1);S.np=S0}finally{unmakeM(b,m,vv)}
    if(s>best)best=s;
    if(best>al)al=best;
    if(al>=be)break;
  }
  return best;
}
/* rp: 지금까지 나온 국면 횟수(같은 국면 3번이면 무승부), np: 구슬이 안 떨어진 수. 돌려줌: 수 */
function botSearch(b0,v,lv,rp,np,rnd){
  rnd=rnd||Math.random;
  const L=LEVEL[lv]||LEVEL[1],b=b0.slice(),ms=legal(b,v);if(!ms.length)return null;
  if(ms.length===1)return ms[0];
  const S={nodes:0,end:Date.now()+L.ms*BOTSCALE,np:np||0};
  ms.forEach(m=>{m.o=moveOrder(m)});ms.sort((x,y)=>y.o-x.o);
  const col=v-1,repOf=m=>{const nb=applyMove(b,m);return (rp&&rp[repKey(nb,1-col)])||0};
  let best=ms[0];
  for(let dep=1;dep<=L.depth;dep++){
    let al=-Infinity,cur=null;const sc=new Map();
    try{
      for(const m of ms){
        const r=m.off>=0?0:repOf(m);let s;
        if(r>=2)s=0;   // 이 수로 무승부가 됨: 이길 때는 피하고 질 때는 찾음
        else{
          const vv=makeM(b,m),S0=S.np;if(m.off>=0)S.np=-1;
          try{s=-searchAB(b,3-v,dep-1,-Infinity,al===-Infinity?Infinity:-al+L.noise,S,1)}finally{S.np=S0;unmakeM(b,m,vv)}
          if(r===1)s-=60;   // 같은 국면을 되풀이하지 않게
        }
        s+=rnd()*L.noise;sc.set(m,s);
        if(s>al){al=s;cur=m}
      }
    }catch(e){if(!(e instanceof SearchStop))throw e;break}
    best=cur;
    ms.sort((x,y)=>(sc.get(y)??-1e9)-(sc.get(x)??-1e9));
    if(Math.abs(al)>AI.win/4)break;
  }
  return best;
}
const botChoose=(b,v,lv,rp,np)=>lv>=1?botSearch(b,v,lv,rp,np):botPick(b,v);

/* ---------- 규칙 설명·방 설정 ---------- */
G.rulesHTML='<ol class="rules"><li><b>목표</b> : 상대 구슬 <b>6개</b>를 판 밖으로 밀어내면 이깁니다</li><li><b>내 차례</b> : 일직선으로 붙은 내 구슬 <b>1~3개</b>를 한 칸 옮깁니다. 줄 방향으로도, 줄째 옆으로도 옮길 수 있습니다. 옆으로 옮길 때는 가는 칸이 모두 비어 있어야 합니다</li><li><b>밀기</b> : 줄 방향으로 옮길 때 내 구슬이 더 많으면 상대 구슬을 밉니다(2:1, 3:1, 3:2). 상대 줄 바로 뒤에 내 구슬이 있으면 밀 수 없고, 내 구슬 1개로는 밀 수 없습니다. 내 구슬은 판 밖으로 옮길 수 없습니다</li><li><b>시작 배치</b> : 표준·벨기안 데이지·독일 데이지 가운데 설정에서 고릅니다. 표준은 지키기 쉬워 판이 길어질 수 있습니다</li><li><b>판이 끝날 때</b> : 같은 국면이 3번 나오면 무승부입니다. 구슬이 떨어지지 않고 60수(두 사람 합계)가 지나면 더 많이 밀어낸 사람이 이기고, 같으면 무승부입니다</li><li><b>시계</b> : 체스처럼 총 시간에 한 수마다 추가 시간이 붙습니다. 시간을 다 쓰면 패배합니다. 연결이 끊겨도 시간은 흐르고, 45초 안에 돌아오지 않으면 탈주로 처리합니다</li><li><b>선 플레이어</b> : 흑이 먼저 둡니다. 첫 판은 탁자 설정으로 정하고(무작위면 주사위, 선택이면 방장이 대기실에서 고름), 결과 화면에서 바로 시작하면 선·후를 바꿉니다</li><li><b>조작</b> : 구슬을 누르거나 끌어 1~3개를 고르면 갈 수 있는 곳에 화살표가 나옵니다. 화살표를 누르거나 고른 구슬을 그 방향으로 밀면 미리 보기, <b>[두기]</b>로 확정합니다. 설정의 <b>두 번 눌러 놓기</b>를 켜면 화살표를 한 번 더 눌러 바로 둡니다</li></ol>';
G.modeDesc=['6개를 밀어내면 끝','6개를 밀어내면 끝'];
G.defaults={max:2,turn:30,tm:10,inc:5,lay:0,pickfirst:0};
G.roomSet=[
  {k:'lay',label:'시작 배치',unit:'',lo:0,hi:2,step:1,lever:1,desc:'표준: 양쪽이 끝 줄에 모여 시작합니다. 벨기안 데이지·독일 데이지: 구슬이 꽃처럼 둘로 나뉘어 맞붙은 채 시작해 판이 빨리 움직입니다'},
  {k:'tm',label:'총 시간',unit:'분',lo:1,hi:30,step:1,lever:1,desc:'한 사람이 쓸 수 있는 전체 시간입니다. 다 쓰면 패배합니다'},
  {k:'inc',label:'추가 시간',unit:'초',lo:0,hi:30,step:1,lever:1,desc:'한 수를 둘 때마다 늘어나는 시간입니다'}];
G.ruleSet=[{k:'pickfirst',pick:1,label:'선 플레이어',desc:'선택: 방장이 대기실에서 먼저 두는 사람을 고릅니다. 무작위: 주사위로 정하고, 바로 시작하면 선·후를 바꿉니다'}];
const layOf=c=>Math.max(0,Math.min(2,+c.lay||0));
const LAY_SHORT=['표준','벨기안','독일'];
G.modeLabel=c=>LAY_SHORT[layOf(c)];   // 홀로그램 모드 줄
G.boardSet=c=>{
  const rs=roomSetOf(G,c),num=k=>{const d=rs.find(x=>x.k===k);return {kind:'num',...d,v:+(c[k]??G.defaults[k]),diff:false}},v=layOf(c);
  return [{kind:'choice',k:'lay',label:'시작 배치',opts:LAY_NAME,desc:rs.find(x=>x.k==='lay').desc,v,diff:v!==0,act:o=>'ab:lay:'+o},num('tm'),num('inc'),rbRuleItem(G.ruleSet[0],c)];
};
/* WebGL이 없을 때의 탁자 설정 창 (2D) */
G.settingsHTML=(c,{stepRow})=>{
  const rs=roomSetOf(G,c),row=k=>{const d=rs.find(x=>x.k===k);return d?stepRow(d):''},v=layOf(c);
  const lay=`<div class="rs-seg"><div class="rs-h"><b>시작 배치</b><small>${rs.find(x=>x.k==='lay').desc}</small></div><div class="segrow" role="radiogroup" aria-label="시작 배치">${LAY_NAME.map((t,k)=>`<button class="btn ${v===k?'btn-play':'btn-sub'}" type="button" role="radio" aria-checked="${v===k}" data-act="ab:lay:${k}">${t}</button>`).join('')}</div></div>`;
  return `<div class="rs-grid">${['max','spec'].map(row).join('')}</div>${lay}<div class="rs-grid">${['tm','inc'].map(row).join('')}</div><div class="rulehead">게임 규칙</div><div class="rs-grid tgs">${pickRowHTML(G.ruleSet[0],c)}</div>`;
};
G.panelAct=a=>{
  if(!a.startsWith('ab:'))return false;
  if(!(mode==='host'&&H&&H.phase==='wait'))return true;
  const p=a.split(':'),v=+p[2];
  if(p[1]!=='lay'||!Number.isInteger(v)||v<0||v>2)return true;
  if(layOf(H.cfg)!==v){H.cfg={...H.cfg,lay:v};saveRoomCfg(H.cfg);sfx('tick')}
  lastPanelHtml='';mark();return true;
};
const clockTxt=c=>`${+c.tm||10}분 + ${+c.inc||0}초`;
G.cfgChips=c=>`<span class="chip"><b>${LAY_NAME[layOf(c)]}</b></span><span class="chip">시계 <b>${clockTxt(c)}</b></span><span class="chip">선 <b>${+c.pickfirst?'선택':'무작위'}</b></span>`;
G.cfgSum=c=>`${LAY_NAME[layOf(c)]} · 시계 ${clockTxt(c)} · 선 ${+c.pickfirst?'선택':'무작위'}`;
G.roomSub=()=>'2명 보드게임';
G.pubExtra=()=>({});
G.cardInfo=(c,nowN)=>`<p class="cardinfo">아발론은 2명이 합니다.${nowN>2?'<br>2명까지 할 수 있습니다.':''}</p>`;
G.rankTitle=()=>'';
G.finLabel=()=>'';
G.noEmotes=[];
G.keys={};
G.keyActions=[];
G.cardHTML=()=>'';G.drawFace=()=>{};G.cmpCard=()=>0;G.labelOf=()=>'';

/* 일꾼(Web Worker): 같은 파일을 일꾼으로 띄워 생각을 맡김. 요청 {id,b,v,lv,rp,np} → 답 {id,c,d} */
const IS_WORKER=typeof window==='undefined'&&typeof self!=='undefined'&&typeof importScripts==='function';
if(IS_WORKER){
  self.onmessage=e=>{const a=e.data||{};try{const m=botChoose(a.b,a.v,a.lv|0,a.rp,a.np);self.postMessage({id:a.id,c:m?m.c:null,d:m?m.d:-1})}catch(err){self.postMessage({id:a.id,c:null,d:-1,err:String(err)})}};
}
const BOTW={w:null,fail:false,id:0,pend:null};
function botWorker(){
  if(BOTW.w||BOTW.fail)return BOTW.w;
  try{if(typeof Worker==='undefined'||typeof document==='undefined'){BOTW.fail=true;return null}
    const src=(document.querySelector('script[src*="games/abalone.js"]')||{}).src||'games/abalone.js';
    BOTW.w=new Worker(src);BOTW.w.onmessage=e=>botReply(e.data);BOTW.w.onerror=()=>{BOTW.fail=true;BOTW.w=null;BOTW.pend=null}}catch(e){BOTW.fail=true;BOTW.w=null}
  return BOTW.w;
}

/* ---------- 방장 엔진 ---------- */
const other=i=>1-i;
const WHY_LOG={rep:'같은 국면 3번',long:'60수 동안 떨어진 구슬 없음'};
const seatOfColor=col=>H.c.co[0]===col?0:1;
function pickFirst(again){
  const ns=H.players.slice(0,2).map(p=>p.name),L=H.abLast;
  if(again&&L&&ns.length===2&&ns.every(n=>L.ns.includes(n))&&ns.includes(L.h))return ns.indexOf(L.h);
  return typeof firstSeat==='function'?firstSeat(2):(Math.random()<.5?0:1);
}
const botDelay=p=>botLv(p)===2?rand(150,350):rand(600,1400);   // 어려움은 생각하는 시간이 길어서 앞 기다림을 줄임
function setMover(to,inc){
  const C=H.c,t=clock(),from=C.mv_,cur=H.players[from];
  if(cur&&!cur.bot)C.rem[from]=Math.max(0,C.rem[from]-Math.max(0,t-C.since));   // 사람이 쓴 시간만 깎음
  if(inc&&from!==to&&cur&&!cur.bot)C.rem[from]+=C.R.inc*1000;
  C.mv_=to;H.turn=to;C.since=t;
  const nx=H.players[to];C.mvBot=nx&&nx.bot?1:0;
  H.botActAt=nx&&nx.bot?t+botDelay(nx):0;
  mark();
}
function finishGame(winSeat,why){
  const C=H.c;
  C.res={w:winSeat,why};
  if(winSeat>=0){
    const l=other(winSeat),pw=H.players[winSeat],pl=H.players[l];
    pw.finished=true;pw.rank=1;pw.hand=[];pl.finished=true;pl.rank=2;pl.hand=[];
    if(why==='time')pl.surrendered='time';else if(why==='surrender'||why==='desert')pl.surrendered=true;
    addLog(why==='time'?`${pl.name} 시간 초과로 패배! ${pw.name} 승리`:why==='surrender'||why==='desert'?`${pl.name} ${why==='desert'?'탈주':'항복'}! ${pw.name} 승리`:why==='six'?`구슬 ${NEED}개! ${pw.name} 승리`:`${pw.name} 승리 (${WHY_LOG[why]||''})`,'fin');
  }else{
    for(const i of [0,1]){const p=H.players[i];p.finished=true;p.rank=1;p.hand=[]}
    addLog(`무승부입니다. (${WHY_LOG[why]||''})`,'sys');
  }
  H.abLast={ns:H.players.slice(0,2).map(p=>p.name),h:H.players[seatOfColor(1)].name};   // 바로 시작하면 지난 판의 후가 선
  H.phase='over';H.botActAt=0;mark();
  H.players.forEach((p,i)=>{if(p.bot&&i<2&&Math.random()<.5)botEmote(i,'gg',800+Math.random()*1600)});
}
const repKey=(b,col)=>col+b.join('');
function doMove(seat,cells,d){
  const C=H.c;
  if(H.phase!=='play'||C.mv_!==seat)return false;
  const col=C.co[seat],m=tryMove(C.b,cells,d,col+1);if(!m)return false;
  const L=lineOf(m.c);m.c=L.o;
  C.b=applyMove(C.b,m);
  C.mv.push(m.c.join('.')+':'+d);
  C.lm={c:m.c,d,p:m.p,off:m.off};
  const nm=H.players[seat].name,names=m.c.length>1?cellName(m.c[0])+'-'+cellName(m.c[m.c.length-1]):cellName(m.c[0]);
  addLog(`${C.mv.length}. ${nm} ${names} ${'→↘↙←↖↗'[d]}${m.off>=0?' 떨어뜨림':m.p.length?' 밀기':''}`);
  if(m.off>=0){C.out[1-col]++;C.np=0}else C.np++;
  if(C.out[1-col]>=NEED){finishGame(seat,'six');return true}
  const k=repKey(C.b,1-col);C.rp[k]=(C.rp[k]||0)+1;
  if(C.rp[k]>=REP){finishGame(-1,'rep');return true}
  if(C.np>=NP_MAX){const a=C.out[1],b=C.out[0];finishGame(a===b?-1:seatOfColor(a>b?0:1),'long');return true}
  if(!legal(C.b,(1-col)+1).length){finishGame(seat,'stuck');return true}
  setMover(other(seat),true);
  return true;
}
function doSurrender(seat){
  if(H.phase!=='play'||seat<0||seat>1||H.players[seat].finished)return;
  finishGame(other(seat),H.players[seat].deserter?'desert':'surrender');
}
function timeout(){finishGame(other(H.c.mv_),'time')}
/* 봇 차례: 보통·어려움은 일꾼이 있으면 판을 보내고 답을 기다림(그동안 방장 화면은 그대로 움직임), 없으면 바로 계산 */
function botTurn(i){
  const C=H.c,lv=botLv(H.players[i]),v=C.co[i]+1,w=lv?botWorker():null;
  if(w){const id=++BOTW.id;BOTW.pend={id,n:C.mv.length,seat:i,c:C,at:clock()};H.botActAt=0;
    try{w.postMessage({id,b:C.b,v,lv,rp:C.rp,np:C.np});return}catch(e){BOTW.pend=null;BOTW.fail=true;BOTW.w=null}}
  const m=botChoose(C.b,v,lv,C.rp,C.np);
  if(!m||!doMove(i,m.c,m.d))finishGame(other(i),'stuck');
}
/* 일꾼의 답: 그사이 판이 바뀌었거나(다른 수·새 판·방장이 바뀜) 사람이 돌아왔으면 버림 */
function botReply(a){
  const P=BOTW.pend;if(!P||!a||a.id!==P.id)return;BOTW.pend=null;
  if(typeof H==='undefined'||!H||H.c!==P.c||H.phase!=='play'||H.c.mv.length!==P.n||H.c.mv_!==P.seat)return;
  const pl=H.players[P.seat];if(!pl||!pl.bot)return;
  if(a.c&&doMove(P.seat,a.c,a.d))return;
  const C=H.c,m=botPick(C.b,C.co[P.seat]+1);if(m)doMove(P.seat,m.c,m.d);else finishGame(other(P.seat),'stuck');
}
G._test={setBotScale:f=>{BOTSCALE=f},botSearch,evalFor,makeM,unmakeM,ROW,NB,CELLS,NEED,NP_MAX,startBoard,lineOf,tryMove,applyMove,legal,arrowsOf,botPick,cellName,doMove,timeout,pickFirst,hexDist,repKey,LAY_NAME};
G.engine={
  start(){
    const again=H.phase==='over',R={tm:Math.max(1,+H.cfg.tm||10),inc:Math.max(0,+H.cfg.inc||0)},lay=layOf(H.cfg);
    Object.assign(H,{phase:'play',log:[],seatNote:{},field:[],last:null,reveal:null,shouts:[],pending:null,rankNext:1,known:{}});
    H.players.forEach((p,i)=>{p.finished=false;p.rank=null;p.surrendered=false;if(i<2)p.hand=[0];else{p.hand=[];p.finished=true;p.rank=i+1}});
    const A=pickFirst(again),t=clock(),b=startBoard(lay);
    H.c={R,lay,A,co:A===0?[0,1]:[1,0],b,mv:[],lm:null,out:[0,0],np:0,rp:{[repKey(b,0)]:1},mv_:A,rem:[R.tm*60000,R.tm*60000],since:t,mvBot:0,res:null};
    H.turn=A;H.botActAt=H.players[A].bot?t+rand(900,1600):0;
    addLog(`${H.players[A].name}님이 흑으로 먼저 시작합니다.`,'sys');
    mark();
  },
  act(seat,a){
    if(a.t==='surrender'){doSurrender(seat);return}
    const C=H.c;
    if(!C||H.phase!=='play'||seat<0||seat>1)return;
    if(a.t==='mv'&&C.mv_===seat)doMove(seat,a.c,a.d);
  },
  tick(t){
    const C=H.c;if(!C||H.phase!=='play')return;
    const p=H.players[C.mv_];if(!p)return;
    if(p.bot&&!awayHuman(p)){
      if(!C.mvBot){C.rem[C.mv_]=Math.max(0,C.rem[C.mv_]-Math.max(0,t-C.since));C.mvBot=1}
      C.since=t;
      if(BOTW.pend){if(BOTW.pend.c===C&&t-BOTW.pend.at<6000)return;BOTW.pend=null}   // 일꾼 답을 기다림 (오래 안 오면 다시 생각)
      if(!H.botActAt)H.botActAt=t+300;
      if(t>=H.botActAt&&!(p.away&&t<p.awayAt+AWAY_WAIT))botTurn(C.mv_);
      return;
    }
    if(C.mvBot){C.mvBot=0;C.since=t}
    if(C.rem[C.mv_]-Math.max(0,t-C.since)<=0)timeout();
  },
  snap(s,you,t){
    const C=H.c,p=H.players[C.mv_],run=H.phase==='play'&&p&&(!p.bot||awayHuman(p))?1:0;
    const el=run?Math.max(0,t-C.since):0,rem=C.rem.map((v,i)=>Math.max(0,Math.round(v-(run&&i===C.mv_?el:0))));
    s.c={n:C.mv.length,lay:C.lay,A:C.A,co:C.co.slice(),b:C.b.join(''),lm:C.lm?{...C.lm}:null,out:C.out.slice(),np:C.np,rem,run,hold:run?Math.max(0,Math.round(C.since-t)):0,R:{...C.R},res:C.res?{...C.res}:null};
    s.gr=0;s.dl=rem[C.mv_];
  },
  restore(ms){if(H.c&&ms)H.c.since+=ms},
  emoPhase:ph=>ph==='play'||ph==='over'
};

/* ---------- 화면 (모든 참가자) ----------
   2D(SVG)와 3D는 같은 상태(CS)를 보고 그림. 내 구슬이 아래에 오도록 백은 판만 180도 돌려서 봄 */
const SEAT_C=['#c53026','#2b65ca'];   // 첫 차례 주사위 면과 같은 자리 색
const MB_C=['#26262b','#efe9dc'];     // 구슬 색 흑·백
let CS=null,sel=[],pick=-1,flash=-1,flashAt=0;   // sel: 고른 구슬, pick: 고른 방향(미리 보기)
const OC={at:0};
let elAb=null,elSvg=null,elMain=null,elBar=null,elBarMe=null,elHint=null,lastBoard='',lastBar='',lastHint='';
const buildS=c=>({...c,b:[...c.b].map(Number)});
const myTurnNow=()=>!!(V&&V.c&&V.st==='play'&&CS&&myReady()&&!introWait());
const dblOn=()=>typeof dblTap!=='undefined'&&!!dblTap;
const nm=i=>V.ps[i]?V.ps[i].n:'?';
const seated=()=>{const me=myIdx();return me>=0&&me<2};
const myV=()=>seated()&&CS?CS.co[myIdx()]+1:0;
const flipped=()=>!!(CS&&seated()&&CS.co[myIdx()]===1);
const arrows=()=>sel.length&&CS&&myTurnNow()?arrowsOf(CS.b,sel,myV()):new Map();
const preview=()=>pick>=0&&sel.length&&CS?tryMove(CS.b,sel,pick,myV()):null;
function clearPick(){sel=[];pick=-1}
function tapCell(i){
  if(!V||!V.c||V.st!=='play'||!CS)return;
  if(!myTurnNow()){if(i>=0)sndNo();return}
  const ar=arrows();
  if(i>=0&&ar.has(i)){
    const d=ar.get(i);
    if(pick===d){if(dblOn())confirmMove();else{pick=-1;sndLift(.08);redraw()}return}
    pick=d;sndLift(.12);redraw();return;
  }
  const v=myV();
  if(i>=0&&CS.b[i]===v){
    pick=-1;
    if(sel.includes(i)){
      const L=lineOf(sel),o=L?L.o:sel;
      if(o.length===3&&o[1]===i)sel=[];else sel=sel.filter(c=>c!==i);
    }else{
      const ext=extend(sel,i);sel=ext||[i];
    }
    sndLift(.1);redraw();return;
  }
  if(sel.length){clearPick();sndLift(.06);redraw();return}
  if(i>=0){flash=i;flashAt=clock()}
  sndNo();redraw();
}
/* 고른 줄에 i를 더함. 사이에 내 구슬 하나가 있으면 함께 고름. 안 되면 null */
function extend(cur,i){
  if(!cur.length||cur.length>=3)return null;
  const v=myV();
  for(const e of cur)for(let d=0;d<6;d++){
    let c=e;const p=[];
    for(let k=0;k<2;k++){
      c=NB[c][d];if(c<0||CS.b[c]!==v)break;
      if(!cur.includes(c))p.push(c);
      if(c===i){const n=[...cur,...p];if(n.length<=3&&lineOf(n))return n;break}
    }
  }
  return null;
}
function confirmMove(){
  if(pick<0||!sel.length||!myTurnNow())return;
  if(!tryMove(CS.b,sel,pick,myV())){sndNo();clearPick();redraw();return}
  sendAct({t:'mv',c:sel.slice(),d:pick});
}
function redraw(){drawAll();G.buttons();P3.dirty=true;d3Marks()}
function sndLift(vol){tone(980,.03,{type:'triangle',vol:vol*.5});hiss(.02,{freq:3000,q:3,vol:vol*.4})}
function sndNo(){sfx('no')}
function sndClick(at,hard){tone(hard?1500:1250,.03,{type:'sine',vol:.11,at});hiss(.022,{freq:4200,q:3,vol:hard?.2:.13,at});tone(420,.05,{type:'sine',vol:.06,at:at+.004})}
function sndRoll(at){hiss(.16,{freq:900,q:1.2,vol:.06,at})}
function sndFall(at){tone(170,.14,{type:'triangle',vol:.18,at});hiss(.07,{freq:700,vol:.1,at});tone(120,.1,{type:'sine',vol:.11,at:at+.13})}
function sndWin(at){[660,880,1320].forEach((f,k)=>tone(f,.13,{type:'square',vol:.035,at:at+k*.1}))}

/* ----- 2D (SVG): 구슬 간격 = 1, 판 가운데 = (0,0) ----- */
const fx=i=>flipped()?-CX[i]:CX[i],fy=i=>flipped()?-CY[i]:CY[i];
const dvx=d=>{const a=[1,.5,-.5,-1,-.5,.5][d];return flipped()?-a:a};
const dvy=d=>{const a=[0,.866,.866,0,-.866,-.866][d];return flipped()?-a:a};
function boardHTML(){
  const ht=[];for(let k=0;k<6;k++){const a=k*Math.PI/3;ht.push((5.15*Math.cos(a)).toFixed(3)+','+(5.15*Math.sin(a)).toFixed(3))}
  const out=[`<polygon points="${ht.join(' ')}" fill="#6b3f1f" stroke="#3a2210" stroke-width=".06"/>`];
  for(let i=0;i<CELLS;i++)out.push(`<circle cx="${fx(i)}" cy="${fy(i)}" r=".36" fill="#4e2e16"/>`);
  const m=preview(),mv=new Set(m?m.c:[]),ps=new Set(m?m.p:[]);
  const ball=(x,y,v,op)=>`<circle cx="${x}" cy="${y}" r=".42" fill="${MB_C[v-1]}" stroke="#1d1a17" stroke-width=".04"${op?` opacity="${op}"`:''}/>`;
  for(let i=0;i<CELLS;i++){
    const v=CS.b[i];if(!v)continue;
    if(mv.has(i)||ps.has(i)){out.push(ball(fx(i),fy(i),v,.28));continue}
    out.push(ball(fx(i),fy(i),v));
  }
  if(m){for(const c of [...m.c,...m.p])out.push(ball(fx(c)+dvx(m.d),fy(c)+dvy(m.d),CS.b[c],c===m.off?.45:.82))}
  if(CS.lm)for(const c of CS.lm.c){const t=NB[c][CS.lm.d];if(t>=0&&!m)out.push(`<circle cx="${fx(t)}" cy="${fy(t)}" r=".46" fill="none" stroke="#f2c94c" stroke-width=".06"/>`)}
  for(const c of sel)out.push(`<circle cx="${fx(c)}" cy="${fy(c)}" r=".47" fill="none" stroke="#ffd23a" stroke-width=".1"/>`);
  for(const [c,d] of arrows()){
    const x=fx(c),y=fy(c),a=Math.atan2(dvy(d),dvx(d))*180/Math.PI,on=pick===d;
    out.push(`<g transform="translate(${x} ${y}) rotate(${a})"><circle r=".3" fill="${on?'#f2c94c':'#4f9d4a'}" opacity=".92"/><path d="M-.11 -.16L.13 0L-.11 .16" fill="none" stroke="#fff" stroke-width=".09" stroke-linecap="round" stroke-linejoin="round"/></g>`);
  }
  if(flash>=0&&clock()-flashAt<700)out.push(`<circle cx="${fx(flash)}" cy="${fy(flash)}" r=".44" fill="#d6342a" opacity=".6"/>`);
  return out.join('');
}
function onSvgClick(e){
  if(!CS)return;
  const pt=elSvg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;const m=elSvg.getScreenCTM();if(!m)return;
  const q=pt.matrixTransform(m.inverse());let best=-1,bd=.3;
  for(let i=0;i<CELLS;i++){const dx=fx(i)-q.x,dy=fy(i)-q.y,dd=dx*dx+dy*dy;if(dd<bd){bd=dd;best=i}}
  tapCell(best);
}
function remMs(i){
  const c=V&&V.c;if(!c)return 0;
  let v=c.rem[i];
  if(V.st==='play'&&c.run&&V.t===i){const e=clock()-OC.at-(c.hold||0);if(e>0)v-=e}
  return Math.max(0,v);
}
function fmtT(ms){
  if(ms<10000&&ms>0)return (Math.floor(ms/100)/10).toFixed(1);
  const s=Math.ceil(ms/1000),m=Math.floor(s/60);return m+':'+String(s%60).padStart(2,'0');
}
/* 이름 칸: 나는 판 아래쪽, 상대는 판 위쪽. 관전자는 모두 위쪽 */
function chipHTML(i){
  const me=myIdx(),p=V.ps[i];if(!p||i>1)return '';
  const col=CS.co[i],on=introWait()?(IN.fp?IN.fp.idx(clock())===i:false):V.st==='play'&&V.t===i&&!p.f,r=CS.res;
  const st=p.sr===2?'시간 초과':p.sr===3?'탈주':p.sr?'항복':r&&r.w<0?'무승부':r&&r.w===i?'승리':'';
  return `<div class="ab-p${on?' on':''}${i===me?' me':''}${p.sr?' out':''}" style="--pc:${SEAT_C[i]}"><i class="dot${col?' w':''}"></i><b>${esc(p.n)}${i===me?' (나)':''}</b>${P3.on?'':`<span class="st">${CS.out[1-col]}/${NEED}</span>`}${st?`<span class="st">${st}</span>`:''}<span class="ct"><span data-ct="${i}">${fmtT(remMs(i))}</span></span></div>`;
}
function barHTML(){const me=myIdx();return seated()?chipHTML(1-me):chipHTML(0)+chipHTML(1)}
const meBarHTML=()=>seated()?chipHTML(myIdx()):'';
function hintText(){
  if(!V||!V.c||!CS||V.st!=='over')return '';
  const r=CS.res;if(!r)return '게임이 끝났습니다.';
  if(r.w<0)return r.why==='rep'?'무승부입니다. (같은 국면 3번)':'무승부입니다.';
  const t=nm(r.w);
  return r.why==='six'?`${t} 승리 (${NEED}개)`:r.why==='time'?`${t} 승리 (시간 초과)`:r.why==='long'?`${t} 승리 (밀어낸 수)`:r.why==='desert'?`${t} 승리 (탈주)`:r.why==='surrender'?`${t} 승리 (항복)`:`${t} 승리`;
}
function drawHint(){if(!elHint)return;const h=hintText();if(h!==lastHint){elHint.textContent=h;lastHint=h}}
function fit(){
  if(!elAb||elAb.hidden)return;
  const bd=elAb.querySelector('.ab-bd'),k=Math.min(bd.clientWidth,bd.clientHeight);
  if(k>0){elSvg.style.width=k+'px';elSvg.style.height=k+'px'}
}
function drawAll(){
  if(!CS||!elMain)return;
  if(!P3.on){const bd=boardHTML();if(bd!==lastBoard){elMain.innerHTML=bd;lastBoard=bd}}
  const top=barHTML(),mb=meBarHTML(),key=(top+'\u0001'+mb).replace(/data-ct="(\d)">[^<]*/g,'data-ct="$1">');
  if(key!==lastBar){elBar.innerHTML=top;elBarMe.innerHTML=mb;lastBar=key;P3.lay=''}
  drawHint();fit();
}

/* ---------- 3D: 공통 테이블 가운데 육각 판, 구슬, 양쪽 끝 받침(떨어진 구슬) ---------- */
const S=.5,MR=.21,TOP=.16,MY=TOP+MR*.74,BH=S*4*Math.sqrt(3)/2+.46,BR=BH/(Math.sqrt(3)/2),TRAY=.42,TZ=BH+.2,FHZ=TZ+TRAY/2+.03,FHX=BR+.03,MOVE=170;
const wx=i=>CX[i]*S,wz=i=>CY[i]*S;
const dx3=d=>[1,.5,-.5,-1,-.5,.5][d]*S,dz3=d=>[0,.866,.866,0,-.866,-.866][d]*S;
const P3={on:false,built:false,fail:false,root:null,cam:null,dirty:true,lastR:0,lay:'',layAt:0,d:12,m:new Map(),tr:[[],[]],anim:[],mvN:-1,movedAt:-1e9};
let D=null;   // 끄는 중: {id,cx,cy,kind:'swipe'|'pick',start,moved,wx,wz}
const ease=k=>k<=0?0:k>=1?1:k*k*(3-2*k);
const dropY=(x,h)=>x>=1?0:x<.68?h*(1-(x/.68)*(x/.68)):h*.1*Math.sin(Math.PI*(x-.68)/.32);
const trayPos=(col,k)=>({x:(k-2.5)*TRAY,z:col?TZ:-TZ});   // 흑 구슬은 위(백 쪽) 받침, 백 구슬은 아래(흑 쪽) 받침
function woodPaint(g,w,h,base,dark,n,seed){
  let s=seed||7;const rnd=()=>{s=(s*16807)%2147483647;return s/2147483647};
  g.fillStyle=base;g.fillRect(0,0,w,h);
  for(let i=0;i<n;i++){const y0=rnd()*h,a=rnd()*.12+.04;g.strokeStyle=dark;g.globalAlpha=a;g.lineWidth=rnd()*2.5+.8;g.beginPath();
    for(let t=0;t<=w;t+=8){const y=y0+Math.sin(t/30+i)*3+Math.sin(t/11+i*3)*1.2;t?g.lineTo(t,y):g.moveTo(t,y)}g.stroke()}
  g.globalAlpha=1;
}
function hexPath(g,cx,cy,r){g.beginPath();for(let k=0;k<6;k++){const a=k*Math.PI/3,x=cx+r*Math.cos(a),y=cy+r*Math.sin(a);k?g.lineTo(x,y):g.moveTo(x,y)}g.closePath()}
/* 판 윗면: 원목 틀, 둘레 도랑, 밝은 판, 61개 홈 */
function drawBoardTex(g,Sz){
  const s=Sz/(2*BR),c=Sz/2,p=v=>c+v*s;
  woodPaint(g,Sz,Sz,'#6e4220','#2e170a',170,3);
  hexPath(g,c,c,(BR-.13)*s);g.strokeStyle='#2e1a0c';g.lineWidth=.13*s;g.stroke();
  hexPath(g,c,c,(BR-.2)*s);g.save();g.clip();woodPaint(g,Sz,Sz,'#c79a62','#7a4f26',120,11);g.restore();
  hexPath(g,c,c,(BR-.2)*s);g.strokeStyle='#5a3618';g.lineWidth=Math.max(2,Sz/400);g.stroke();
  for(let i=0;i<CELLS;i++){
    const x=p(wx(i)),y=p(wz(i)),r=MR*1.02*s,gr=g.createRadialGradient(x-r*.2,y-r*.25,r*.1,x,y,r);
    gr.addColorStop(0,'#5d3a1b');gr.addColorStop(.75,'#6f4722');gr.addColorStop(1,'#3e2410');
    g.fillStyle=gr;g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fill();
    g.strokeStyle='rgba(255,232,190,.5)';g.lineWidth=Math.max(1.2,Sz/700);g.beginPath();g.arc(x,y,r+1.5,.2*Math.PI,.85*Math.PI);g.stroke();
  }
}
const GEO={},MAT={};
function marbleMesh(v){
  GEO.b=GEO.b||new THREE.SphereGeometry(MR,28,18);
  GEO.o=GEO.o||new THREE.SphereGeometry(MR*1.07,20,14);
  GEO.h=GEO.h||new THREE.CircleGeometry(MR*.2,14);
  const g=new THREE.Group();
  const body=new THREE.Mesh(GEO.b,MAT['b'+v]||(MAT['b'+v]=toon({color:new THREE.Color(MB_C[v-1]).getHex(),rim:.1})));body.castShadow=true;g.add(body);
  g.add(new THREE.Mesh(GEO.o,MAT.ink||(MAT.ink=new THREE.MeshBasicMaterial({color:GFX_INK,side:THREE.BackSide}))));
  const hl=new THREE.Mesh(GEO.h,MAT.hl||(MAT.hl=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.75,depthWrite:false})));hl.rotation.x=-Math.PI/2;hl.position.set(-MR*.28,MR*.97,-MR*.3);g.add(hl);
  g.userData={v,tw:null,tx:0,ty:0,tz:0};return g;
}
/* 대기실 홀로그램의 대표 말: 육각 판과 구슬 넷 */
G.holoPiece=mkM=>{
  const g=new THREE.Group(),m=new THREE.Mesh(new THREE.CylinderGeometry(.38,.38,.04,6),mkM(0xf2e6c4));m.rotation.x=Math.PI/2;m.rotation.y=Math.PI/6;g.add(m);
  [[-.17,.06,0],[0,.06,0],[.17,.06,1],[.085,-.09,1]].forEach(([x,y,c])=>{const b=new THREE.Mesh(new THREE.SphereGeometry(.082,18,12),mkM(c?0xffffff:0x777777));b.position.set(x,y,.07);g.add(b)});
  g.rotation.set(-.38,.3,.06);return g;
};
function d3Build(){
  if(P3.built||P3.fail)return P3.built;
  if(!T.ok||typeof THREE==='undefined'){P3.fail=true;return false}
  try{
    const root=new THREE.Group();root.visible=false;
    const bg=new THREE.Group();root.add(bg);P3.boardG=bg;
    const hexS=r=>{const s=new THREE.Shape();for(let k=0;k<6;k++){const a=k*Math.PI/3,x=r*Math.cos(a),y=r*Math.sin(a);k?s.lineTo(x,y):s.moveTo(x,y)}s.closePath();return s};
    const wood=toon({map:canvasTex(512,512,(g,w,h)=>woodPaint(g,w,h,'#6e4220','#2e170a',110,3)),rim:.08});
    const body=new THREE.Mesh(new THREE.ExtrudeGeometry(hexS(BR),{depth:TOP-.02,bevelEnabled:false}),wood);body.rotation.x=-Math.PI/2;body.position.y=.02;body.castShadow=body.receiveShadow=true;bg.add(body);
    const ink=new THREE.Mesh(new THREE.ExtrudeGeometry(hexS(BR+.025),{depth:TOP-.01,bevelEnabled:false}),new THREE.MeshBasicMaterial({color:GFX_INK,side:THREE.BackSide}));ink.rotation.x=-Math.PI/2;ink.position.y=.015;bg.add(ink);
    const tg=new THREE.ShapeGeometry(hexS(BR-.005));{const p=tg.attributes.position,uv=tg.attributes.uv;for(let i=0;i<p.count;i++)uv.setXY(i,p.getX(i)/(2*BR)+.5,p.getY(i)/(2*BR)+.5);uv.needsUpdate=true}
    const top=new THREE.Mesh(tg,toon({map:canvasTex(1024,1024,(g,w)=>drawBoardTex(g,w)),rim:0}));top.rotation.x=-Math.PI/2;top.position.y=TOP+.002;top.receiveShadow=true;bg.add(top);
    /* 떨어진 구슬 받침: 판 위·아래 끝에 여섯 칸 */
    const trayTex=canvasTex(512,84,(g,w,h)=>{woodPaint(g,w,h,'#6e4220','#2e170a',40,9);for(let k=0;k<6;k++){const x=(k+.5)*w/6.2+w*.016,gr=g.createRadialGradient(x,h/2,3,x,h/2,h*.42);gr.addColorStop(0,'#3e2410');gr.addColorStop(1,'#2a170a');g.fillStyle=gr;g.beginPath();g.arc(x,h/2,h*.42,0,Math.PI*2);g.fill()}});
    for(const col of [0,1]){
      const z=col?TZ:-TZ,tw=6.2*TRAY,bar=new THREE.Mesh(new THREE.BoxGeometry(tw,TOP-.04,TRAY),wood);bar.position.set(0,.02+(TOP-.04)/2,z);bar.castShadow=bar.receiveShadow=true;bg.add(bar);
      const bo=new THREE.Mesh(new THREE.BoxGeometry(tw+.05,TOP-.03,TRAY+.05),new THREE.MeshBasicMaterial({color:GFX_INK,side:THREE.BackSide}));bo.position.copy(bar.position);bg.add(bo);
      const tp=new THREE.Mesh(new THREE.PlaneGeometry(tw,TRAY),toon({map:trayTex,rim:0}));tp.rotation.x=-Math.PI/2;tp.position.set(0,TOP-.018,z);bg.add(tp);
    }
    P3.mg=new THREE.Group();root.add(P3.mg);
    const ringG=new THREE.RingGeometry(MR*1.08,MR*1.32,32),ring=(c,op)=>{const m=new THREE.Mesh(ringG,new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:op,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.y=TOP+.01;m.visible=false;m.renderOrder=3;root.add(m);return m};
    P3.lmR=[];for(let k=0;k<3;k++)P3.lmR.push(ring(0xf2c94c,.6));
    P3.selR=[];for(let k=0;k<3;k++)P3.selR.push(ring(0xffd23a,1));
    P3.flashM=ring(0xd6342a,.9);
    const arT=canvasTex(128,128,(g,w,h)=>{g.fillStyle='#fff';g.beginPath();g.arc(w/2,h/2,58,0,Math.PI*2);g.fill();g.globalCompositeOperation='destination-out';g.lineWidth=15;g.lineCap='round';g.lineJoin='round';g.beginPath();g.moveTo(48,32);g.lineTo(84,64);g.lineTo(48,96);g.stroke()});
    P3.arr=[];for(let k=0;k<6;k++){const m=new THREE.Mesh(new THREE.PlaneGeometry(S*.72,S*.72),new THREE.MeshBasicMaterial({map:arT,color:0x4f9d4a,transparent:true,opacity:.95,depthWrite:false,depthTest:false}));m.position.y=MY+MR+.03;m.visible=false;m.renderOrder=9;root.add(m);P3.arr.push(m)}
    P3.cam=new THREE.PerspectiveCamera(34,1,.1,100);
    T.scene.add(root);P3.root=root;P3.built=true;
  }catch(e){P3.fail=true;try{console.warn('아발론 3D 준비 실패',e)}catch(_){}}
  return P3.built;
}
function placeTo(g,x,y,z,now,dur){
  const u=g.userData;if(u.tx===x&&u.ty===y&&u.tz===z&&!u.force)return;
  u.force=false;u.tx=x;u.ty=y;u.tz=z;
  u.tw={fx:g.position.x,fy:g.position.y,fz:g.position.z,t0:now,dur:dur||MOVE};
}
function setAt(g,x,y,z){g.position.set(x,y,z);const u=g.userData;u.tx=x;u.ty=y;u.tz=z;u.tw=null}
/* 구슬 목표 자리: 집, 고른 것은 살짝 들림, 미리 보기 중이면 민 뒤 자리 */
function layoutMarbles(now){
  if(!P3.on||IN.on3d||!CS)return;
  const m=preview(),sh=new Set(m?[...m.c,...m.p]:[]);
  for(const [c,g] of P3.m){
    const d=m&&sh.has(c)?m.d:-1,lift=sel.includes(c)&&!m?.05:0;
    placeTo(g,wx(c)+(d>=0?dx3(d):0),MY+lift,wz(c)+(d>=0?dz3(d):0),now);
  }
}
/* 바로 시작: 판은 그대로, 구슬만 떠올라 사라짐 */
function sweep(now){
  let k=0;
  const go=g=>{P3.anim.push({obj:g,t0:now+k*6,dur:300,y0:g.position.y,y1:g.position.y+1,gone:1,s1:.01});k++};
  for(const g of P3.m.values())go(g);P3.m.clear();
  for(const col of [0,1]){for(const g of P3.tr[col])go(g);P3.tr[col]=[]}
}
function d3Sync(){
  if(!P3.on||!V||!V.c||!CS)return;
  const now=clock(),n=CS.n,lm=CS.lm;
  if(IN.again&&!IN.gathered&&n===0){IN.gathered=true;sweep(now);P3.mvN=0}
  /* 한 수 진행: 구슬을 옮긴 칸으로 이름을 바꾸고 떨어지는 구슬은 받침으로 */
  if(P3.mvN>=0&&n===P3.mvN+1&&lm&&!IN.on3d){
    const moved=[...lm.c,...lm.p],nw=new Map();
    for(const c of moved){
      const g=P3.m.get(c);if(!g)continue;P3.m.delete(c);
      if(c===lm.off){
        const col=g.userData.v-1,k=P3.tr[col].length,ty=trayPos(col,k),ex=wx(c)+dx3(lm.d),ez=wz(c)+dz3(lm.d);
        P3.tr[col].push(g);g.userData.tw=null;
        P3.anim.push({obj:g,t0:now,dur:MOVE+40,path:1,fx:g.position.x,fy:g.position.y,fz:g.position.z,tx:ex,ty:TOP+MR*.8,tz:ez,hop:0});
        P3.anim.push({obj:g,t0:now+MOVE+40,dur:430,path:1,fx:ex,fy:TOP+MR*.8,fz:ez,tx:ty.x,ty:TOP-.03+MR*.72,tz:ty.z,hop:.34});
      }else{nw.set(NB[c][lm.d],g)}
    }
    for(const [c,g] of nw)P3.m.set(c,g);
    for(const [c,g] of nw){g.userData.force=false;placeTo(g,wx(c),MY,wz(c),now)}
  }
  /* 상태와 맞춤 (재접속·새 판) */
  for(const [c,g] of P3.m)if(CS.b[c]!==g.userData.v){P3.mg.remove(g);P3.m.delete(c)}
  for(let c=0;c<CELLS;c++){
    const v=CS.b[c];if(!v||P3.m.has(c))continue;
    const g=marbleMesh(v);setAt(g,wx(c),MY,wz(c));if(IN.on3d)g.visible=false;P3.mg.add(g);P3.m.set(c,g);
  }
  for(const col of [0,1]){
    while(P3.tr[col].length>CS.out[col]){const g=P3.tr[col].pop();P3.mg.remove(g)}
    while(P3.tr[col].length<CS.out[col]){const k=P3.tr[col].length,p=trayPos(col,k),g=marbleMesh(col+1);setAt(g,p.x,TOP-.03+MR*.72,p.z);P3.mg.add(g);P3.tr[col].push(g)}
  }
  P3.mvN=n;layoutMarbles(now);d3Marks();P3.dirty=true;
}
function d3Marks(){
  if(!P3.on||!V||!V.c||!CS)return;
  const put=(m,c)=>{if(c==null||c<0){m.visible=false;return}m.position.x=wx(c);m.position.z=wz(c);m.visible=true};
  const lm=CS.lm&&!IN.on3d&&!sel.length?CS.lm.c.map(c=>NB[c][CS.lm.d]):[];
  P3.lmR.forEach((r,k)=>put(r,k<lm.length?lm[k]:-1));
  const mv=preview();
  P3.selR.forEach((r,k)=>put(r,k<sel.length&&!mv?sel[k]:-1));
  put(P3.flashM,flash>=0&&clock()-flashAt<700?flash:-1);
  const ar=[...arrows()];
  P3.arr.forEach((a,k)=>{
    if(k>=ar.length){a.visible=false;return}
    const [c,d]=ar[k];a.position.x=wx(c);a.position.z=wz(c);a.rotation.set(-Math.PI/2,0,Math.atan2(-dz3(d),dx3(d)));
    a.material.color.set(pick===d?0xe0a820:0x4f9d4a);a.visible=true;
  });
  layoutMarbles(clock());P3.dirty=true;
}
function tvBox(r){
  const Wd=r.clientWidth,Hh=r.clientHeight;r.classList.toggle('wide',Wd>Hh||Wd>=700);
  const narrow=Wd<700,bar=r.querySelector('.ab-bar'),mb=r.querySelector('.ab-mebar'),gap=10;
  const Rr=Math.max(bar.offsetTop+bar.offsetHeight+gap,(narrow?70:14)+(mb.offsetHeight||26)+gap),m=narrow?8:16;
  return {fw:Wd-2*m,fh:Hh-2*Rr,cy:Hh/2,R:Rr};
}
const CHIP_GAP=10;
function chipsAt(topY,botY){
  const r=elAb,bar=r.querySelector('.ab-bar'),mb=r.querySelector('.ab-mebar');if(!bar||!mb)return;
  const Hh=r.clientHeight,lim=Hh-(r.clientWidth<700?70:14)-(mb.offsetHeight||34);
  r.style.setProperty('--bs',Math.max(bar.offsetHeight,Math.round(topY-CHIP_GAP-bar.offsetTop))+'px');
  r.style.setProperty('--mt',Math.round(Math.min(botY+CHIP_GAP,lim))+'px');
  r.classList.add('lay');
}
function d3Layout(t){
  if(t-P3.layAt<100&&P3.lay)return false;
  P3.layAt=t;
  const st=$('#stage'),Wd=st.clientWidth,Hh=st.clientHeight;if(!Wd||!Hh||!V||!V.c)return false;
  const B=tvBox(elAb),fl=flipped(),key=[Wd,Hh,B.R,fl].join(',');
  if(key===P3.lay)return false;
  P3.lay=key;
  const s=Math.min(B.fw/(2*FHX),B.fh/(2*FHZ)),cam=P3.cam,f=Math.tan(cam.fov*Math.PI/360),d=(Hh/2)/(s*f);
  P3.root.rotation.y=fl?Math.PI:0;   // 탁자는 그대로 두고 판만 돌림
  cam.aspect=Wd/Hh;cam.clearViewOffset();cam.up.set(0,0,-1);cam.position.set(0,MY+d,0);cam.lookAt(0,MY,0);cam.updateProjectionMatrix();cam.updateMatrixWorld();
  chipsAt(B.cy-FHZ*s,B.cy+FHZ*s);
  P3.d=d;P3.dirty=true;
  return true;
}
function d3Step(now){
  let busy=false;
  P3.anim=P3.anim.filter(a=>{
    const k=(now-a.t0)/a.dur;busy=true;if(k<0)return true;
    const o=a.obj,e=ease(Math.min(1,k));
    if(a.path){o.position.set(a.fx+(a.tx-a.fx)*e,a.fy+(a.ty-a.fy)*e+Math.sin(Math.min(1,k)*Math.PI)*a.hop,a.fz+(a.tz-a.fz)*e);if(k>=1&&a.hop){sndClick(0,true);const u=o.userData;u.tx=a.tx;u.ty=a.ty;u.tz=a.tz}}
    else{o.position.y=a.y0+(a.y1-a.y0)*e;if(a.s1!=null)o.scale.setScalar(1+(a.s1-1)*e)}
    if(k>=1){if(a.gone)P3.mg.remove(o);return false}
    return true;
  });
  for(const g of P3.m.values()){
    const u=g.userData,w=u.tw;if(!w)continue;
    busy=true;const k=(now-w.t0)/w.dur,e=ease(Math.min(1,Math.max(0,k)));
    g.position.set(w.fx+(u.tx-w.fx)*e,w.fy+(u.ty-w.fy)*e,w.fz+(u.tz-w.fz)*e);
    if(k>=1)u.tw=null;
  }
  return busy;
}
function d3Render(t){
  if(!P3.on||!T.ok)return;
  if(d3Layout(t))P3.dirty=true;
  const busy=d3Step(t),intro=IN.on3d&&introStep(t),fl=flash>=0&&t-flashAt<760;
  if(flash>=0&&!fl){flash=-1;d3Marks()}
  if(!busy&&!intro&&!fl&&!P3.dirty&&t-P3.lastR<400)return;
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
   로비 카메라 → 바로 위 카메라. 판이 내려앉고 구슬이 줄마다 떨어짐 → 첫 차례 주사위. 바로 시작은 구슬만 다시 떨어지고 주사위 없이 알림 */
const INTRO={cam:1100,ui:650,board:[100,400],tile:[560,26],dur:300,dice:1700};
const AGAIN={tile:[340,12],dice:1050};
const DIE=.56;
G.introMs=(again,rolls)=>Math.round((again?AGAIN.dice:INTRO.dice)+DicePick.totalFor(again?-1:rolls)+100);
const IN={on:false,on3d:false,t0:0,total:0,r:0,again:false,fromLobby:true,said:false,gathered:false,fp:null,die:null,snd:{}};
const introOn=()=>IN.on&&clock()<IN.t0+IN.total;
const introWait=()=>introOn()&&!IN.said;
const tileAt=i=>{const A=IN.again?AGAIN:INTRO;return A.tile[0]+i*A.tile[1]};
G.intro=(t0,o)=>{
  if(!V||!V.c||!V.ps)return;
  IN.again=!!(o&&o.again)&&P3.on;
  const rolls=IN.again?-1:o&&o.rolls,seed=(o&&o.seed)||1;
  IN.on=true;IN.t0=t0;IN.said=false;IN.snd={};IN.fromLobby=!P3.on;IN.on3d=true;IN.gathered=false;
  IN.r=IN.again?AGAIN.dice:INTRO.dice;IN.total=(o&&o.total)||G.introMs(IN.again,rolls);
  if(IN.die){IN.die.dispose();IN.die=null}
  IN.fp=firstPick(t0+IN.r,{seats:[0,1],first:V.c.A,rolls,seed});
  $('#stage').classList.add('ab-intro');if(elAb&&IN.fromLobby)elAb.classList.add('intro');
  clearPick();lastBar='';P3.dirty=true;
};
function introStep(now,force){
  if(!P3.built||!V||!V.c||!CS)return false;
  const e=now-IN.t0,done=force||e>=IN.total,fl=IN.fromLobby;
  if(done)IN.on3d=false;
  {const x=done||!fl?1:(e-INTRO.board[0])/INTRO.board[1];P3.boardG.visible=x>0;P3.boardG.position.y=dropY(Math.max(0,x),1.6)}
  let i=0;
  for(let c=0;c<CELLS;c++){const g=P3.m.get(c);if(!g)continue;const x=done?1:(e-tileAt(i))/INTRO.dur;g.visible=x>0;g.userData.tw=null;g.position.set(wx(c),MY+dropY(Math.max(0,Math.min(1,x)),.9),wz(c));g.userData.tx=wx(c);g.userData.ty=MY;g.userData.tz=wz(c);i++}
  if(IN.fp&&!IN.fp.fixed){
    if(!IN.die&&!done&&P3.root){IN.die=DicePick.mesh(THREE,2,SEAT_C);P3.root.add(IN.die.g)}
    if(IN.die)IN.die.apply(done||e<IN.r?null:IN.fp.pose(now),DIE,0,MY+MR+.1,0);
  }
  if(done){for(const g of P3.m.values())g.visible=true;if(IN.die){IN.die.dispose();IN.die=null}d3Marks()}
  return true;
}
function introEnd(){
  if(IN.on3d)introStep(clock(),true);
  if(IN.die){IN.die.dispose();IN.die=null}
  IN.on=false;IN.on3d=false;IN.said=true;
  $('#stage').classList.remove('ab-intro');if(elAb)elAb.classList.remove('intro');
}
function introTick(){
  if(!IN.on)return;
  const e=clock()-IN.t0,S_=IN.snd,once=(k,f)=>{if(!S_[k]){S_[k]=1;f()}};
  if(e>=INTRO.ui&&elAb&&elAb.classList.contains('intro'))elAb.classList.remove('intro');
  if(IN.on3d&&P3.on&&CS){
    if(IN.fromLobby&&e>=INTRO.board[0]+INTRO.board[1]*.68)once('thud',()=>{tone(120,.13,{type:'triangle',vol:.2});hiss(.09,{freq:650,vol:.12})});
    if(e>=tileAt(0)+INTRO.dur*.68&&e<tileAt(28))once('r'+Math.floor((e-tileAt(0))/110),()=>sndClick(0,false));
  }
  if(IN.fp&&e>=IN.r&&IN.fp.tick(IN.t0+e)){
    IN.said=true;$('#stage').classList.remove('ab-intro');if(elAb)elAb.classList.remove('intro');
    fxSay(IN.fp.msg(),SEAT_C[IN.fp.first]);
    lastBar='';redraw();
  }
  if(e>=IN.total){IN.on=false;lastBar='';lastHint='';G.buttons();if(P3.on)d3Marks()}
  drawAll();
}
/* 3D 화면에서 누른 곳 → 구슬 높이 평면 위 좌표 */
function worldAt(e){
  const r=T.r.domElement.getBoundingClientRect();if(!r.width||!P3.cam)return null;
  const ray=P3.ray||(P3.ray=new THREE.Raycaster());
  ray.setFromCamera({x:(e.clientX-r.left)/r.width*2-1,y:-(e.clientY-r.top)/r.height*2+1},P3.cam);
  const o=ray.ray.origin,dv=ray.ray.direction;if(Math.abs(dv.y)<1e-6)return null;
  const k=(MY-o.y)/dv.y,x=o.x+dv.x*k,z=o.z+dv.z*k;return P3.root.rotation.y?{x:-x,z:-z}:{x,z};
}
function cellAt(w){
  if(!w)return -1;let best=-1,bd=(S*.56)*(S*.56);
  for(let i=0;i<CELLS;i++){const a=wx(i)-w.x,b=wz(i)-w.z,dd=a*a+b*b;if(dd<bd){bd=dd;best=i}}
  return best;
}
function d3Click(e){
  if(!P3.on||G!==GAMES.abalone||clock()-P3.movedAt<350)return;
  tapCell(cellAt(worldAt(e)));
}
/* 끌기: 안 고른 내 구슬에서 시작 = 줄 고르기, 고른 구슬에서 시작 = 그 방향으로 밀기(미리 보기) */
function dragDown(e){
  if(!P3.on||G!==GAMES.abalone||!myTurnNow()||(e.pointerType==='mouse'&&e.button!==0)||e.target.id!=='cv')return;
  const w=worldAt(e),c=cellAt(w);if(c<0)return;
  if(sel.includes(c))D={id:e.pointerId,cx:e.clientX,cy:e.clientY,kind:'swipe',start:c,moved:false,w};
  else if(CS.b[c]===myV())D={id:e.pointerId,cx:e.clientX,cy:e.clientY,kind:'pick',start:c,moved:false,w};
}
function dragMove(e){
  if(!D||e.pointerId!==D.id)return;
  if(!D.moved){
    if(Math.hypot(e.clientX-D.cx,e.clientY-D.cy)<9)return;
    D.moved=true;try{$('#cv').setPointerCapture(e.pointerId)}catch(_){}
    if(D.kind==='pick'){sel=[D.start];pick=-1;sndLift(.1);redraw()}
  }
  const w=worldAt(e);if(!w)return;
  if(D.kind==='swipe'){
    const ax=w.x-D.w.x,az=w.z-D.w.z,len=Math.hypot(ax,az);if(len<S*.3)return;
    const ds=[...arrows().values()];let best=-1,bd=.5;
    for(const d of ds){const c=(ax*dx3(d)+az*dz3(d))/(len*S);if(c>bd){bd=c;best=d}}
    if(best!==pick){pick=best;if(best>=0)sndLift(.1);redraw()}
    return;
  }
  const c=cellAt(w);if(c<0)return;
  let nw=null;
  if(c===D.start)nw=[c];else{const x=extend([D.start],c);if(x)nw=x}
  if(nw&&(nw.length!==sel.length||nw.some(k=>!sel.includes(k)))){sel=nw;pick=-1;sndLift(.1);redraw()}
}
function dragEnd(e){
  if(!D||e.pointerId!==D.id)return;
  const was=D.moved;D=null;
  if(was)P3.movedAt=clock();
}
/* 새 상태를 받았을 때 */
G.preView=()=>{
  if(!V.c){CS=null;return}
  CS=buildS(V.c);OC.at=clock();
  if(!PV||!PV.c||PV.st!==V.st||PV.c.n!==V.c.n||PV.c.A!==V.c.A){clearPick();D=null}
};
G.postView=()=>{};
G.overExtra=()=>'';
G.logCue=()=>false;
G.overDelay=()=>CS&&CS.res&&CS.res.why==='six'?1250:0;
G.cues=(v,pv)=>{
  if(!v.c||!pv.c||v.c.n<=pv.c.n)return;
  const lm=v.c.lm,push=!!(lm&&lm.p.length);
  sndClick(.02,push);sndRoll(0);
  if(lm&&lm.off>=0)sndFall(.26);
  if(v.c.res&&v.c.res.why==='six')sndWin(.8);
};
G.hud=inGame=>{
  if(!elAb)return;
  const on=!!(inGame&&V&&V.c&&CS);
  elAb.hidden=!on;
  $('#stage').classList.toggle('ab-over',!!(on&&V.st==='over'));
  const d3=on&&d3Build();
  if(d3!==P3.on){P3.on=d3;P3.lay='';if(P3.root)P3.root.visible=d3;$('#stage').classList.toggle('ab3d',d3);lastBoard='';lastHint='';lastBar=''}
  $('#stage').classList.toggle('ab2d',on&&!d3);
  if(!on){lastBoard='';lastBar='';lastHint='';return}
  drawAll();
  d3Sync();
};
G.handMarks=()=>{};
G.me=()=>{$('#numpick').hidden=true};
G.overRank=p=>{
  const r=V&&V.c&&V.c.res,t=p.sr===2?'시간 초과':p.sr===3?'탈주':p.sr?'항복':r&&r.w<0?'무승부':'';
  return t?`<span class="left">${t}</span>`:'';
};
G.usesDbl=true;
G.no3D=true;
G.buttons=()=>{
  const play=$('#btnPlay'),can=pick>=0&&myTurnNow();
  $('#btnPass').hidden=true;$('#btnGura').hidden=true;
  play.disabled=!can;play.classList.toggle('ready',can);
  if($('#playMain').textContent!=='두기')$('#playMain').textContent='두기';
  const sub=keyLabel(KEYS.play);if($('#playSub').textContent!==sub)$('#playSub').textContent=sub;
};
G.live=()=>{
  if(IN.on)introTick();
  if(!V||!V.c||!CS)return;
  clockTick();
  if(flash>=0&&!P3.on&&clock()-flashAt>720){flash=-1;lastBoard='';drawAll()}
};
/* 이름 칸의 시간 (매 프레임 글자만 바꿈). 10초 남으면 빨갛게 깜빡임 */
function clockTick(){
  if(!elAb)return;
  elAb.querySelectorAll('[data-ct]').forEach(el=>{const i=+el.dataset.ct,ms=remMs(i),t=fmtT(ms);if(el.textContent!==t)el.textContent=t;
    const low=V.st==='play'&&V.t===i&&V.c.run&&ms<=10000;if(el.parentNode.classList.contains('low')!==low)el.parentNode.classList.toggle('low',low)});
}
G.play=()=>confirmMove();
G.pass=()=>{};
G.keyPhase=st=>st==='play';
G.onKey=()=>false;
G.field3D=()=>{if(T.stacks)for(const arr of T.stacks.values())arr.forEach(c=>{c.visible=false})};
G.render3D=t=>{if(P3.on)d3Render(t);else if(T.ok&&!$('#stage').classList.contains('ab2d'))T.r.render(T.scene,T.cam)};
G.enter=()=>{
  $('#stage').classList.add('ab');
  $('#btnPass').hidden=true;$('#btnGura').hidden=true;$('#numpick').hidden=true;
  clearPick();D=null;
  if(elAb)fit();
};
G.leave=()=>{
  introEnd();
  $('#stage').classList.remove('ab','ab-over','ab3d','ab2d');
  if(T.stacks)for(const arr of T.stacks.values())arr.forEach(c=>{c.visible=true});
  if(P3.root)P3.root.visible=false;P3.on=false;P3.anim=[];D=null;
  if(P3.mg){for(const g of [...P3.m.values(),...P3.tr[0],...P3.tr[1]])P3.mg.remove(g)}
  P3.m.clear();P3.tr=[[],[]];P3.mvN=-1;
  $('#btnPass').hidden=false;
  if(elAb){elAb.hidden=true;lastBoard='';lastBar='';lastHint=''}
};
G.init=()=>{
  const css=document.createElement('style');
  css.textContent=`
.stage.ab{background:radial-gradient(ellipse at 50% 38%,#f3e4c2 0%,#e2c89a 70%,#d3b27c 100%)}
.stage.ab.ab2d #cv,.stage.ab #dim{visibility:hidden}
.stage.ab3d #cv{touch-action:none}
.stage.ab-intro .actions,.stage.ab-intro .myplate,.stage.ab-intro #abl .ab-row{opacity:0;pointer-events:none}
.stage.ab .actions,.stage.ab .myplate,#abl .ab-row,#abl .ab-bar,#abl .ab-mebar{transition:opacity .35s}
#abl.intro .ab-bar,#abl.intro .ab-mebar{opacity:0}
.stage.ab3d #abl svg.ab-board{display:none}
.stage.ab3d #abl .ab-hint{flex:0 1 auto;background:rgba(255,250,240,.9);border:1px solid var(--line-strong,#cdb391);border-radius:99px;padding:4px 12px;box-shadow:0 2px 6px -2px rgba(59,42,31,.35)}
.stage.ab .labels{visibility:hidden}
.stage.ab .nogl{display:none}
.stage.ab.ab-over .myplate,.stage.ab.ab-over .actions{display:none}
.specbar:not([hidden])~#abl .ab-bar{margin-top:30px}
.stage.ab .actions{left:auto}
.stage.ab .myplate{max-width:calc(100% - 150px)}
#abl{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;gap:6px;padding:8px 10px 82px;pointer-events:none;min-height:0}
#abl[hidden]{display:none}
#abl .ab-bar{min-height:44px;display:flex;flex-wrap:wrap;justify-content:center;align-items:flex-start;align-content:flex-end;gap:6px;align-self:center;max-width:calc(100% - 188px);pointer-events:none}
#abl .ab-mebar{position:absolute;left:50%;bottom:var(--plateB,14px);transform:translateX(-50%);z-index:2;display:flex;pointer-events:none;max-width:calc(100% - 188px)}
#abl .ab-mebar:empty{display:none}
#abl .ab-p{position:relative;display:flex;align-items:center;gap:6px;padding:4px 10px;border-radius:12px;background:rgba(255,250,240,.92);border:1.5px solid var(--line-strong,#cdb391);font-size:13px;line-height:1.15;overflow:hidden;white-space:nowrap;max-width:100%}
#abl .ab-p .dot{width:13px;height:13px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#6a6a72,#1e1e22 70%);box-shadow:0 0 0 1.5px rgba(59,42,31,.5);flex:none}
#abl .ab-p .dot.w{background:radial-gradient(circle at 35% 30%,#fff,#ddd5c4 75%)}
#abl .ab-p b{font-weight:600;overflow:hidden;text-overflow:ellipsis;max-width:8em}
#abl .ab-p .st{font-size:12px;color:var(--muted,#7a6550)}
#abl .ab-p .ct{font-family:"IBM Plex Mono",monospace;font-size:13px;font-weight:600;font-variant-numeric:tabular-nums;color:#5b4129}
#abl .ab-p .ct.low{color:#c62f24;animation:abLow .8s steps(2) infinite}
@keyframes abLow{50%{opacity:.45}}
#abl .ab-p.on{border-color:var(--pc);box-shadow:0 0 0 2px var(--pc)}
#abl .ab-p.out{opacity:.55}
#abl .ab-row{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;width:100%;pointer-events:none;min-height:44px}
.stage.ab3d #abl .ab-row{height:44px;min-height:0;flex:none;align-items:flex-start;padding-top:4px;overflow:visible;position:relative;z-index:1}
#abl .ab-hint:empty{visibility:hidden}
#abl .ab-hint{flex:1 1 200px;min-width:0;font-size:13px;line-height:1.3;color:#5b4129;text-align:center;min-height:17px}
#abl .ab-bd{position:relative;flex:1;min-height:0;width:100%}
#abl svg.ab-board{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);pointer-events:auto;touch-action:manipulation;user-select:none;-webkit-user-select:none;filter:drop-shadow(0 6px 8px rgba(59,42,31,.35))}
@media (max-width:520px){#abl .ab-p{font-size:12px;padding:3px 8px;gap:5px}#abl .ab-bar{max-width:calc(100% - 150px)}}
.stage.ab3d #abl .ab-row{order:-1}
.stage.ab3d #abl.lay .ab-bar{transform:translateY(calc(var(--bs) - 100%));transition:transform .35s,opacity .35s}
.stage.ab3d #abl.lay .ab-mebar{top:var(--mt);bottom:auto;transition:top .35s,opacity .35s}
.stage.ab3d .specbar:not([hidden])~#abl .ab-bar{margin-top:0}
.stage.ab3d .specbar:not([hidden])~#abl .ab-row{margin-top:30px}
.stage.ab3d #abl.wide .ab-row{position:absolute;left:16px;top:8px;width:auto;max-width:30%;justify-content:flex-start}
.stage.ab3d #abl.wide .ab-bar{min-height:0}
.stage.ab3d .specbar:not([hidden])~#abl.wide .ab-bar{margin-top:30px}
@media (max-width:699px){#abl{padding-bottom:112px}#abl .ab-mebar{bottom:70px;max-width:calc(100% - 24px)}}
`;
  document.head.appendChild(css);
  elAb=document.createElement('div');elAb.id='abl';elAb.hidden=true;
  elAb.innerHTML=`<div class="ab-bar"></div><div class="ab-mebar"></div><div class="ab-row"><div class="ab-hint" aria-live="polite"></div></div><div class="ab-bd"><svg class="ab-board" viewBox="-5.3 -5.3 10.6 10.6" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="아발론 판"><g id="abMain"></g></svg></div>`;
  $('#stage').insertBefore(elAb,$('#fx'));
  elSvg=elAb.querySelector('svg.ab-board');elMain=elAb.querySelector('#abMain');
  elBar=elAb.querySelector('.ab-bar');elBarMe=elAb.querySelector('.ab-mebar');elHint=elAb.querySelector('.ab-hint');
  elSvg.addEventListener('click',onSvgClick);
  document.addEventListener('keydown',e=>{if(e.code==='Escape'&&sel.length&&elAb&&!elAb.hidden){clearPick();redraw()}});
  window.addEventListener('resize',()=>{fit();P3.lay=''});
  const cv=$('#cv');
  cv.addEventListener('click',d3Click);cv.addEventListener('pointerdown',dragDown);cv.addEventListener('pointermove',dragMove);cv.addEventListener('pointerup',dragEnd);cv.addEventListener('pointercancel',dragEnd);
};
G._d3={P3,IN,introEnd,worldAt,cellAt,get CS(){return CS},tapCell,get sel(){return sel},get pick(){return pick},arrows,wx,wz,MY};   // 화면 검사용

if(!IS_WORKER)(window.GAMES=window.GAMES||{}).abalone=G;
})();
