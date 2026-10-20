/* ===== 오목 게임 모듈 =====
   공통 코드(index.html)가 GAMES.omok의 함수를 불러서 이 게임의 규칙·봇·화면을 그림.
   판: 15×15 또는 19×19. 칸 (r,c): r = 위에서 아래로 0~n-1, c = 왼쪽에서 오른쪽으로. 돌: 1 흑, 2 백 (0은 빈 칸)
   두 사람이 하는 게임이고 모든 화면이 같은 방향(아래가 1줄)으로 봄. 좌표는 'h8'처럼 가로 a~, 세로 1~(아래가 1)
   방 설정(레버): 판 크기 sz, 3-3·4-4 b33, 장목(6목 이상) ov, 오프닝 op, 총 시간 tm(분), 추가 시간 inc(초), 선 플레이어 직접 선택 pickfirst(쿼리도와 같은 공통 스위치: 켜면 방장이 대기실 목록의 [선]으로 고름)
   손패(hand)는 카드가 아니라 '돌 하나'를 뜻하는 표시: 공통 코드가 hand가 비면 끝난 사람으로 보기 때문에 게임 중에는 [0]으로 둠 */
(function(){
const G={id:'omok',name:'오목',short:'오목',lead:'렌주 금수와 스왑 오프닝까지',brand:'오목',brandPx:62,maxHi:2,noFast:true,firstPick:true};   // firstPick: 대기실 목록의 [선] 버튼을 씀 (룰렛 연출은 아직 없음: 랜덤이면 시작 안내로만 알림)   // 두 사람이 하는 게임 (게임 모드 선택 없음)

/* ---------- 규칙 (방장 엔진과 화면이 같은 함수를 씀) ---------- */
const COLS='abcdefghijklmnopqrs';
const SZ=[15,19];
const CNAME=['','흑','백'];
const DR=[[0,1],[1,0],[1,1],[1,-1]];   // 가로, 세로, 대각선 ＼, 대각선 ／
const at=(b,n,r,c)=>(r<0||c<0||r>=n||c>=n)?3:b[r*n+c];   // 판 밖은 3
const sqName=(n,r,c)=>COLS[c]+(n-r);
/* 방 설정 값 → 규칙 */
const rulesOf=c=>({n:SZ[+c.sz?1:0],b33:Math.max(0,Math.min(2,+c.b33|0)),ov:Math.max(0,Math.min(2,+c.ov|0)),op:Math.max(0,Math.min(2,+c.op|0)),tm:Math.max(1,+c.tm||10),inc:Math.max(0,+c.inc||0)});
/* (r,c)를 지나는 d방향 줄에서 col이 이어진 길이 ((r,c)는 이미 col이 놓였다고 보고 셈) */
function runLen(b,n,r,c,d,col){
  const dr=DR[d][0],dc=DR[d][1];let k=1;
  for(let s=1;at(b,n,r+dr*s,c+dc*s)===col;s++)k++;
  for(let s=1;at(b,n,r-dr*s,c-dc*s)===col;s++)k++;
  return k;
}
/* 이 길이의 줄이 이기는 줄인가 (장목 레버 ov: 0 승리, 1 승리 아님, 2 흑만 금수·백은 승리) */
const winLen=(len,col,R)=>R.ov===0?len>=5:R.ov===1?len===5:(col===1?len===5:len>=5);
/* col이 3-3·4-4·장목 같은 금수 판정을 받는 색인가 */
const bound=(col,R)=>col===1?(R.b33>=1||R.ov===2):R.b33===2;
/* d방향 줄에서, 방금 둔 (r,c)가 들어간 '4'를 셈. (r,c)는 이미 col이 놓여 있어야 함
   4 = 돌 4개 + 빈 칸 1개로 이루어진 다섯 칸이 있고, 그 빈 칸에 두면 이기는 줄이 되는 것.
   같은 네 돌로 양쪽 끝에서 완성되는 것(열린 4)은 4 하나로 셈. 네 돌이 다르면(●●_●●_●●) 같은 줄이라도 4가 둘 */
function scanFours(b,R,r,c,d,col){
  const n=R.n,dr=DR[d][0],dc=DR[d][1],L=[];
  for(let k=-5;k<=5;k++)L.push(k===0?col:at(b,n,r+dr*k,c+dc*k));
  const sets=new Map();   // 네 돌의 위치 → 이 네 돌로 이기는 자리 수
  for(let s=-4;s<=0;s++){
    let own=0,empty=null;
    for(let k=s;k<s+5;k++){const v=L[k+5];if(v===col)own++;else if(v===0)empty=empty===null?k:-99;else{own=-9;break}}
    if(own!==4||empty===null||empty===-99)continue;
    const ext=L[s-1+5]===col||L[s+5+5]===col;   // 다섯 칸 바로 바깥에 같은 돌이 있으면 6목 이상이 됨
    const ok=ext?winLen(6,col,R):winLen(5,col,R);
    const key=[];for(let k=s;k<s+5;k++)if(k!==empty)key.push(k);
    const id=key.join(',');
    sets.set(id,(sets.get(id)||0)+(ok?1:0));
  }
  let fours=0,straight=false;
  for(const v of sets.values()){if(v>=1)fours++;if(v>=2)straight=true}
  return {fours,straight};
}
/* 열린 3인가: d방향에 4가 아직 없고, 한 칸 더 두면 (양쪽으로 이길 수 있는) 열린 4가 되는 자리가 있음.
   그 자리가 금수이면 거짓 3이라 세지 않음 (depth는 금수 판정이 서로를 부르는 깊이 제한) */
function openThree(b,R,r,c,d,col,depth){
  const n=R.n,dr=DR[d][0],dc=DR[d][1];
  for(let k=-4;k<=4;k++){
    if(!k)continue;
    const rr=r+dr*k,cc=c+dc*k;
    if(at(b,n,rr,cc)!==0)continue;
    b[rr*n+cc]=col;
    const f=scanFours(b,R,r,c,d,col);
    b[rr*n+cc]=0;
    if(!f.straight)continue;
    if(depth>=3||!bound(col,R))return true;
    if(!judge(b,R,rr,cc,col,depth+1).bad)return true;
  }
  return false;
}
/* 빈 칸 (r,c)에 col을 두면: {win: 이기는 줄의 방향(없으면 -1), bad: 금수 이유('6' 장목, '44', '33') 또는 null}
   5목이 되는 수는 금수보다 먼저(승리). 판은 잠깐 바꿨다가 되돌림 */
function judge(b,R,r,c,col,depth){
  const n=R.n;
  b[r*n+c]=col;
  try{
    for(let d=0;d<4;d++)if(winLen(runLen(b,n,r,c,d,col),col,R))return {win:d,bad:null};
    if(R.ov===2&&col===1)for(let d=0;d<4;d++)if(runLen(b,n,r,c,d,col)>=6)return {win:-1,bad:'6'};
    if(R.b33===0||(R.b33===1&&col!==1))return {win:-1,bad:null};
    let fours=0;const fs=[];
    for(let d=0;d<4;d++){const f=scanFours(b,R,r,c,d,col);fs.push(f);fours+=f.fours}
    if(fours>=2)return {win:-1,bad:'44'};
    let threes=0;
    for(let d=0;d<4;d++)if(!fs[d].fours&&openThree(b,R,r,c,d,col,depth||0))threes++;
    if(threes>=2)return {win:-1,bad:'33'};
    return {win:-1,bad:null};
  }finally{b[r*n+c]=0}
}
const legalAt=(b,R,r,c,col)=>at(b,R.n,r,c)===0&&!judge(b,R,r,c,col,0).bad;
/* 이긴 줄의 칸 목록 [[r,c],…] ((r,c)에 col이 놓인 판에서) */
function winCells(b,n,r,c,d){
  const col=b[r*n+c],dr=DR[d][0],dc=DR[d][1],out=[[r,c]];
  for(let s=1;at(b,n,r+dr*s,c+dc*s)===col;s++)out.unshift([r+dr*s,c+dc*s]);
  for(let s=1;at(b,n,r-dr*s,c-dc*s)===col;s++)out.push([r-dr*s,c-dc*s]);
  return out;
}
/* col이 지금 둘 수 없는 빈 칸들 (화면의 빨간 ✕). 같은 색 돌이 가까이 있는 칸만 따짐 */
function forbidCells(b,R,col){
  const n=R.n,out=[];
  if(!bound(col,R))return out;
  for(let r=0;r<n;r++)for(let c=0;c<n;c++){
    if(b[r*n+c])continue;
    let near=false;
    for(let dr=-4;dr<=4&&!near;dr++)for(let dc=-4;dc<=4;dc++)if(at(b,n,r+dr,c+dc)===col){near=true;break}
    if(near&&judge(b,R,r,c,col,0).bad)out.push(r*n+c);
  }
  return out;
}
/* 오프닝 규칙: 0 없음, 1 Swap, 2 Swap2.  단계(ph): p1 선플레이어가 돌 3개, c1 상대가 고름, p2 상대가 돌 2개 더(Swap2), c2 선플레이어가 고름, play 대국 */
const nextColor=cnt=>cnt%2===0?1:2;   // 놓인 돌이 짝수 개면 흑 차례

/* ---------- 봇 ---------- */
const PAT=[[0,0,0],[0,1,2],[0,4,14],[0,30,150],[0,800,4000],[1e5,1e5,1e5]];
/* col이 (r,c)에 두면 얻는 점수: 네 방향에서 이어지는 길이와 열린 정도 */
function cellScore(b,n,r,c,col){
  let s=0;
  for(let d=0;d<4;d++){
    const dr=DR[d][0],dc=DR[d][1];let a=0,x=1;
    while(at(b,n,r+dr*x,c+dc*x)===col){a++;x++}
    const e1=at(b,n,r+dr*x,c+dc*x)===0?1:0;
    let a2=0;x=1;
    while(at(b,n,r-dr*x,c-dc*x)===col){a2++;x++}
    const e2=at(b,n,r-dr*x,c-dc*x)===0?1:0;
    s+=PAT[Math.min(5,1+a+a2)][e1+e2];
  }
  return s;
}
/* 돌 가까이(2칸 안)의 빈 칸들 */
function cands(b,n){
  let any=false;for(let i=0;i<b.length;i++)if(b[i]){any=true;break}
  if(!any){const m=n>>1;return [[m,m]]}
  const seen=new Uint8Array(n*n),out=[];
  for(let r=0;r<n;r++)for(let c=0;c<n;c++){
    if(!b[r*n+c])continue;
    for(let dr=-2;dr<=2;dr++)for(let dc=-2;dc<=2;dc++){
      const rr=r+dr,cc=c+dc;
      if(rr<0||cc<0||rr>=n||cc>=n||b[rr*n+cc]||seen[rr*n+cc])continue;
      seen[rr*n+cc]=1;out.push([rr,cc]);
    }
  }
  return out;
}
/* col의 형세: 둘 수 있는 자리 중 점수가 높은 셋의 합 */
function strength(b,n,col){
  const sc=cands(b,n).map(([r,c])=>cellScore(b,n,r,c,col)).sort((x,y)=>y-x);
  return (sc[0]||0)+(sc[1]||0)*.6+(sc[2]||0)*.3;
}
/* 대국 중 한 수: 이길 수 있으면 이기고, 상대의 5·4를 막고, 아니면 공격·수비 점수가 높은 자리 (금수는 피함) */
function botMove(O,seat,lv){
  const b=O.b,R=O.R,n=R.n,col=O.co[seat],opp=3-col,mid=(n-1)/2;
  const sc=cands(b,n).map(([r,c])=>{
    const A=cellScore(b,n,r,c,col),D=cellScore(b,n,r,c,opp);
    let s=lv===0?A+D*.5:A*1.05+D;
    s+=(8-Math.max(Math.abs(r-mid),Math.abs(c-mid)))*.3+Math.random()*(lv===0?6:lv===1?1.5:.3);
    return {r,c,s};
  }).sort((x,y)=>y.s-x.s);
  const list=lv===0&&Math.random()<.2?sc.slice().sort(()=>Math.random()-.5):sc;
  for(const x of list)if(!bound(col,R)||!judge(b,R,x.r,x.c,col,0).bad)return [x.r,x.c];
  // 후보가 모두 금수면 판 전체에서 둘 수 있는 곳
  for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(!b[r*n+c]&&(!bound(col,R)||!judge(b,R,r,c,col,0).bad))return [r,c];
  return null;
}
/* 오프닝 돌 하나: 가운데 근처 */
function botOpenStone(O){
  const n=O.R.n,m=n>>1,b=O.b;
  if(O.cnt===0)return [m,m];
  const opts=[];
  for(let dr=-2;dr<=2;dr++)for(let dc=-2;dc<=2;dc++){const r=m+dr,c=m+dc;if((dr||dc)&&b[r*n+c]===0)opts.push([r,c])}
  return opts[Math.random()*opts.length|0];
}
/* 오프닝 결과를 보고 고르기: 1 흑, 2 백, 3 돌 더 놓기 (백 차례가 먼저 오므로 백에게 주도권이 있음) */
function botPick(O,seat,lv){
  const n=O.R.n,b=O.b,canMore=O.ph==='c1'&&O.R.op===2;
  if(lv===0){const o=canMore?[1,2,3]:[1,2];return o[Math.random()*o.length|0]}
  const w=strength(b,n,2)*1.25,k=strength(b,n,1),adv=w-k;
  if(canMore&&lv>=2&&Math.abs(adv)<Math.max(30,.3*(w+k))&&Math.random()<.4)return 3;
  return adv>0?2:1;
}

/* ---------- 규칙 설명·방 설정 ---------- */
G.rulesHTML='<ol class="rules"><li><b>목표</b> : 가로·세로·대각선으로 내 돌 5개를 먼저 이어 놓으면 <b>승리</b>합니다</li><li><b>진행</b> : 흑이 먼저 두고 번갈아 한 수씩 둡니다. 둔 돌은 옮기거나 물릴 수 없고, 판이 가득 차면 무승부입니다</li><li><b>시계</b> : 두 사람이 각자의 총 시간을 쓰는 체스 시계입니다. 내 차례에는 내 시간이 줄고, 한 수를 둘 때마다 추가 시간이 붙습니다. 총 시간을 다 쓰면 <b>패배</b>합니다. 연결이 끊겨도 시계는 흐르고, 45초 안에 돌아오지 않으면 탈주로 처리합니다</li><li><b>규칙 고르기</b> : 탁자 설정의 레버로 <b>자유</b>(금수·오프닝 없음)와 <b>렌주</b>(흑 금수 + Swap2 오프닝)를 고릅니다. 세부 설정을 바꾸면 커스텀이 됩니다</li><li><b>장목(6목 이상)</b> : <b>승리</b>(6목도 이김), <b>승리 아님</b>(두어도 되지만 이기지 못하고 게임이 계속됨), <b>흑만 금수</b>(흑이 두면 반칙, 백은 6목도 이김) 중에서 정합니다. 정확히 5목이 되는 수는 언제나 승리가 먼저입니다</li><li><b>금수</b> : 금수가 켜져 있으면 흑이 둘 수 없는 자리에 빨간 ✕가 보이고 놓을 수 없습니다. <b>3-3</b>(열린 3이 둘), <b>4-4</b>(4가 둘)이며, 열린 3이 되려면 한 칸 더 둔 자리가 금수가 아니어야 합니다. 3-4는 둘 수 있습니다</li><li><b>Swap</b> : 선플레이어가 돌 3개(흑·백·흑)를 놓으면 상대가 흑과 백 중 하나를 고르고, 백부터 둡니다</li><li><b>Swap2</b> : 돌 3개를 놓은 뒤 상대가 ① 백 선택 ② 흑 선택 ③ 돌 2개(백·흑)를 더 놓고 선택권을 넘기기 중 하나를 고릅니다. ③이면 선플레이어가 흑과 백을 고르고 백부터 둡니다. 오프닝 돌에는 금수 판정을 하지 않습니다</li><li><b>다음 판</b> : 이긴 사람이 선플레이어(오프닝이 없으면 흑)가 되고, 비기면 서로 바꿉니다. 첫 판은 탁자 설정의 선플레이어로 정합니다</li><li><b>조작</b> : 놓을 칸을 누르면 반투명 돌로 미리 보이고, <b>[놓기]</b>를 누르면 확정합니다. 설정의 <b>두 번 눌러 놓기</b>를 켜면 같은 칸을 한 번 더 눌러 바로 둡니다</li><li><b>기보</b> : 세로줄은 왼쪽부터 a~, 가로줄은 아래부터 1~입니다. 게임이 끝나면 기보를 복사할 수 있습니다</li></ol>';
G.modeDesc=['먼저 5목을 만든 사람이 이기면 끝','먼저 5목을 만든 사람이 이기면 끝'];

/* 규칙 묶음: 레버로 고르는 자유 / 렌주. 세부 설정을 바꾸면 레버가 가운데(커스텀)로 옴 */
const PKEYS=['sz','b33','ov','op'];
const PRESETS=[{sz:0,b33:0,ov:0,op:0},{sz:0,b33:1,ov:2,op:2}];
const PNAME=['자유','렌주'];
const LV={
  sz:{label:'판 크기',vals:['15×15','19×19'],desc:'기본은 15×15입니다'},
  b33:{label:'3-3 · 4-4',vals:['가능','흑만 금지','양쪽 금지'],desc:'열린 3이 둘, 또는 4가 둘이 되는 수를 둘 수 있는지 정합니다'},
  ov:{label:'장목 (6목 이상)',vals:['승리','승리 아님','흑만 금수'],desc:'승리: 6목도 이김 · 승리 아님: 두어도 되지만 이기지 못함 · 흑만 금수: 흑은 둘 수 없고 백은 6목도 이김'},
  op:{label:'오프닝',vals:['없음','Swap','Swap2'],desc:'없음: 선플레이어가 흑 · Swap: 돌 3개를 놓고 상대가 색을 고름 · Swap2: 거기에 돌 2개를 더 놓고 넘기는 선택이 있음'}};
const presetOf=c=>PRESETS.findIndex(P=>PKEYS.every(k=>(+c[k]||0)===P[k]));   // 0·1, 둘 다 아니면 -1(커스텀)
const baseOf=c=>{const p=presetOf(c);if(p>=0)return p;const df=PRESETS.map(P=>PKEYS.filter(k=>(+c[k]||0)!==P[k]).length);return df[1]<df[0]?1:0};
const diffKeys=c=>{const P=PRESETS[baseOf(c)];return PKEYS.filter(k=>(+c[k]||0)!==P[k])};
const lvTxt=(k,c)=>LV[k].vals[Math.max(0,Math.min(LV[k].vals.length-1,+c[k]||0))];
const diffLabel=(k,c)=>k==='sz'?lvTxt('sz',c):k==='b33'?'3-3·4-4 '+lvTxt('b33',c):k==='ov'?'장목 '+lvTxt('ov',c):'오프닝 '+lvTxt('op',c);
const clockTxt=c=>`${+c.tm||10}분${+c.inc?`+${+c.inc}초`:''}`;
G.defaults={max:2,turn:30,sz:0,b33:0,ov:0,op:0,tm:10,inc:5,pickfirst:0};
/* 방 설정에 저장되는 값들. 시간만 −/+ 칸으로 바꾸고, 나머지는 레버(settingsHTML)로 바꿈 */
G.roomSet=[
  {k:'tm',label:'총 시간',unit:'분',lo:1,hi:60,step:1,desc:'한 사람이 쓸 수 있는 전체 시간입니다. 다 쓰면 패배합니다'},
  {k:'inc',label:'추가 시간',unit:'초',lo:0,hi:30,step:1,desc:'한 수를 둘 때마다 늘어나는 시간입니다'},
  {k:'sz',label:'판 크기',unit:'',lo:0,hi:1,step:1,desc:'',lever:1},
  {k:'b33',label:'3-3 · 4-4',unit:'',lo:0,hi:2,step:1,desc:'',lever:1},
  {k:'ov',label:'장목',unit:'',lo:0,hi:2,step:1,desc:'',lever:1},
  {k:'op',label:'오프닝',unit:'',lo:0,hi:2,step:1,desc:'',lever:1}];
G.ruleSet=[{k:'pickfirst',label:'선 플레이어 직접 선택 (끄면 랜덤)',desc:'켜면 방장이 대기실에서 선 플레이어를 고릅니다. 오프닝이 없으면 선 플레이어가 흑, 있으면 오프닝 돌을 놓습니다. 결과 화면에서 바로 시작하면 이긴 사람이 선입니다'}];
function ruleLine(c){
  const p=presetOf(c),df=diffKeys(c);
  return `<b>${p>=0?PNAME[p]:'커스텀'}</b>${p>=0?'':` <small>(${PNAME[baseOf(c)]} 기반)</small>`}${p>=0?'':df.map(k=>` · <b class="pdiff">${esc(diffLabel(k,c))}</b>`).join('')}`;
}
G.cfgChips=c=>`<span class="chip">규칙 ${ruleLine(c)}</span><span class="chip">${lvTxt('sz',c)}</span><span class="chip">시계 <b>${clockTxt(c)}</b></span><span class="chip">선 <b>${+c.pickfirst?'방장 선택':'랜덤'}</b></span>`;
G.cfgSum=c=>`${lvTxt('sz',c)} · 시계 ${clockTxt(c)} · 선 ${+c.pickfirst?'방장 선택':'랜덤'}<br>규칙: ${ruleLine(c)}${+c.op?` · 오프닝 ${lvTxt('op',c)}`:''}`;
G.roomSub=()=>'2명 보드게임';
G.pubExtra=()=>({});
G.cardInfo=(c,nowN)=>`<p class="cardinfo">${nowN>2?'오목은 두 명이 하는 게임입니다.':'두 명이 하는 게임입니다. 사람이 한 명이면 봇이 상대합니다.'}</p>`;
G.rankTitle=()=>'';
G.finLabel=()=>'';
G.noEmotes=['gq'];
G.keys={};
G.keyActions=[];
/* 이 게임에는 카드가 없음 (공통 코드가 부르는 자리만 채움) */
G.cardHTML=()=>'';G.drawFace=()=>{};G.cmpCard=()=>0;G.labelOf=()=>'';

/* ---------- 방장 엔진 (규칙 처리) ---------- */
const other=i=>1-i;
function sameNames(a,b){return a.length===2&&b.length===2&&a.every(x=>b.includes(x))&&a[0]!==a[1]}
/* 첫 선플레이어: 결과 화면에서 바로 시작하면 이긴 사람(비기면 서로 바꿈), 아니면 공통 firstSeat (직접 선택이면 방장이 고른 사람, 아니면 랜덤) */
function pickFirst(again){
  const ps=H.players.slice(0,2),ns=ps.map(p=>p.name),L=H.oLast;
  if(again&&L&&L.ns&&sameNames(ns,L.ns)){
    if(L.w)return ns.indexOf(L.w);
    return ns.indexOf(L.A)===0?1:0;
  }
  return typeof firstSeat==='function'?firstSeat(2):(Math.random()<.5?0:1);
}
function setMover(to,inc){
  const O=H.o,t=clock(),from=O.mv;
  const cur=H.players[from];
  const el=Math.max(0,t-O.since);
  if(cur&&!cur.bot)O.rem[from]=Math.max(0,O.rem[from]-el);   // 사람이 쓴 시간만 깎음 (봇·자리 비운 사람은 시계가 안 감)
  if(inc&&from!==to&&cur&&!cur.bot)O.rem[from]+=O.R.inc*1000;
  O.mv=to;H.turn=to;O.since=t;
  const nx=H.players[to];O.mvBot=nx&&nx.bot?1:0;
  if(nx&&nx.bot&&O.ph==='play')O.hd[to]=1;
  H.botActAt=nx&&nx.bot?t+rand(700,1600):0;
  mark();
}
/* 색이 정해진 뒤: 다음 돌 색을 가진 사람이 차례 */
function seatOfColor(col){const O=H.o;return O.co[0]===col?0:1}
function addRec(k,seat,r,c,col){H.o.rec.push([k,seat,r,c,col])}
function placeStone(seat,r,c,col,open){
  const O=H.o,n=O.R.n;
  O.b[r*n+c]=col;O.cnt++;O.lm={r,c,col};
  addRec('s',seat,r,c,col);
  addLog(`${O.cnt}. ${H.players[seat].name} ${open?CNAME[col]+' ':''}${sqName(n,r,c)}`);
  H.seatNote[seat]=open?'오프닝':'';
}
function finishGame(winSeat,why,line){
  const O=H.o;
  O.res={w:winSeat,why:why||'',line:line||null};
  if(winSeat>=0){
    const l=other(winSeat),pw=H.players[winSeat],pl=H.players[l];
    pw.finished=true;pw.rank=1;pw.hand=[];
    pl.finished=true;pl.rank=2;pl.hand=[];
    if(why==='time')pl.surrendered='time';else if(why==='surrender'||why==='desert')pl.surrendered=true;
    addLog(why==='time'?`${pl.name} 시간 초과로 패배! ${pw.name} 승리`:why==='surrender'||why==='desert'?`${pl.name} ${why==='desert'?'탈주':'항복'}! ${pw.name} 승리`:`${pw.name} 승리! (${CNAME[O.co[winSeat]]})`,why?'lie':'fin');
  }else{
    for(const i of [0,1]){const p=H.players[i];p.finished=true;p.rank=1;p.hand=[]}
    addLog('무승부입니다.','sys');
  }
  H.oLast={ns:H.players.slice(0,2).map(p=>p.name),w:winSeat>=0?H.players[winSeat].name:'',A:H.players[O.A].name};
  H.phase='over';H.botActAt=0;mark();
  H.players.forEach((p,i)=>{if(p.bot&&i<2&&Math.random()<.5)botEmote(i,'gg',800+Math.random()*1600)});
}
/* 한 수 (대국 중) */
function doMove(seat,r,c){
  const O=H.o,n=O.R.n,col=O.co[seat];
  const j=judge(O.b,O.R,r,c,col,0);
  if(j.bad)return false;
  placeStone(seat,r,c,col,false);O.hd[seat]=0;
  if(j.win>=0){const line=winCells(O.b,n,r,c,j.win);finishGame(seat,'',line);return true}
  if(O.cnt>=n*n||!canMove(O,nextColor(O.cnt))){finishGame(-1);return true}   // 판이 차거나, 다음 색이 둘 곳이 모두 금수면 무승부
  setMover(seatOfColor(nextColor(O.cnt)),true);
  return true;
}
/* col이 둘 수 있는 빈 칸이 하나라도 있나 (빈 칸이 적을 때만 하나씩 확인: 금수 판정이 무거움) */
function canMove(O,col){
  const b=O.b,R=O.R,n=R.n,left=n*n-O.cnt;
  if(!left)return false;
  if(!bound(col,R)||left>40)return true;
  for(let i=0;i<b.length;i++)if(!b[i]&&!judge(b,R,(i/n)|0,i%n,col,0).bad)return true;
  return false;
}
/* 오프닝 돌 놓기 (p1, p2) */
function doOpenStone(seat,r,c){
  const O=H.o,col=nextColor(O.cnt);
  placeStone(seat,r,c,col,true);
  if(O.ph==='p1'&&O.cnt===3){O.ph='c1';setMover(other(O.A),true)}
  else if(O.ph==='p2'&&O.cnt===5){O.ph='c2';setMover(O.A,true)}
  else mark();
}
/* 오프닝 선택 (c1, c2): v 1 흑, 2 백, 3 돌 2개 더 (c1 + Swap2만) */
function doPick(seat,v){
  const O=H.o,name=H.players[seat].name;
  if(v===3){
    if(O.ph!=='c1'||O.R.op!==2)return false;
    O.ph='p2';addRec('k',seat,3,0,0);
    addLog(`${name} 돌 2개를 더 놓습니다.`,'sys');
    mark();return true;
  }
  if(v!==1&&v!==2)return false;
  O.co[seat]=v;O.co[other(seat)]=3-v;O.ph='play';addRec('k',seat,v,0,0);
  addLog(`${name} ${CNAME[v]} 선택. ${H.players[seat^1].name}은(는) ${CNAME[3-v]}입니다.`,'sys');
  H.seatNote[0]=H.seatNote[1]='';
  setMover(seatOfColor(nextColor(O.cnt)),true);
  return true;
}
function doSurrender(seat){
  if(H.phase!=='play'||seat<0||seat>1||H.players[seat].finished)return;
  finishGame(other(seat),H.players[seat].deserter?'desert':'surrender');
}
function timeout(){
  const i=H.o.mv;
  finishGame(other(i),'time');
}
function botTurn(i){
  const O=H.o,lv=botLv(H.players[i]);
  if(O.ph==='play'){
    const m=botMove(O,i,lv);
    if(!m){finishGame(-1);return}
    if(!doMove(i,m[0],m[1]))finishGame(-1);
  }else if(O.ph==='p1'||O.ph==='p2'){
    const m=botOpenStone(O);if(m)doOpenStone(i,m[0],m[1]);
  }else doPick(i,botPick(O,i,lv));
}
/* 테스트(tests/engine.test.js)에서 직접 부르는 내부 함수 */
G._test={canMove,rulesOf,runLen,winLen,bound,scanFours,openThree,judge,legalAt,winCells,forbidCells,nextColor,cellScore,cands,botMove,botPick,botOpenStone,sqName,presetOf,baseOf,diffKeys,PRESETS,doMove,doOpenStone,doPick,doSurrender,timeout,pickFirst,recordText:v=>recordText(v)};
G.engine={
  /* 게임 시작: 공통 코드가 H.players를 만든 뒤 부름 */
  start(){
    const again=H.phase==='over',R=rulesOf(H.cfg),n=R.n;
    Object.assign(H,{phase:'play',log:[],seatNote:{},field:[],last:null,reveal:null,shouts:[],pending:null,rankNext:1,known:{}});
    H.players.forEach((p,i)=>{
      p.finished=false;p.rank=null;p.surrendered=false;
      if(i<2)p.hand=[0];else{p.hand=[];p.finished=true;p.rank=i+1}   // 자리가 모자라면(3명 이상) 구경만 함 (보통은 최대 인원 2명이라 생기지 않음)
    });
    const A=pickFirst(again),t=clock();
    const O={hd:[0,0],mvBot:H.players[A].bot?1:0,R,A,ph:R.op?'p1':'play',co:R.op?[0,0]:(A===0?[1,2]:[2,1]),mv:A,rem:[R.tm*60000,R.tm*60000],since:t,b:Array(n*n).fill(0),cnt:0,lm:null,rec:[],res:null};
    H.o=O;H.turn=A;
    if(O.ph==='play'&&H.players[A].bot)O.hd[A]=1;   // 봇은 차례가 오면 돌을 집어 듦
    H.botActAt=H.players[A].bot?t+rand(900,2000):0;
    const nm=H.players[A].name;
    addLog(R.op?`${nm}님이 오프닝 돌 3개를 놓습니다.`:`${nm}님이 흑으로 먼저 시작합니다.`,'sys');
    mark();
  },
  act(seat,a){
    if(a.t==='surrender'){doSurrender(seat);return}
    const O=H.o;
    // 돌을 집어 들었다/내려놓았다 (화면 표시만: 상대 통 위에 돌이 떠 보임). 바뀔 때만 오므로 가벼움
    if(a.t==='hold'){if(O&&H.phase==='play'&&O.ph==='play'&&(seat===0||seat===1)&&O.hd){const v=a.v?1:0;if(O.hd[seat]!==v){O.hd[seat]=v;mark()}}return}
    if(!O||H.phase!=='play'||seat<0||seat>1||O.mv!==seat)return;
    if(a.t==='put'){
      const r=a.r,c=a.c,n=O.R.n;
      if(!Number.isInteger(r)||!Number.isInteger(c)||r<0||c<0||r>=n||c>=n||O.b[r*n+c])return;
      if(O.ph==='play')doMove(seat,r,c);
      else if(O.ph==='p1'||O.ph==='p2')doOpenStone(seat,r,c);
    }else if(a.t==='pick'){
      if(O.ph!=='c1'&&O.ph!=='c2')return;
      doPick(seat,a.v|0);
    }
  },
  tick(t){
    const O=H.o;
    if(!O||H.phase!=='play')return;
    const p=H.players[O.mv];if(!p)return;
    if(p.bot&&!awayHuman(p)){
      // 봇(과 탈주해서 봇이 맡은 자리)은 시계를 멈춤: 그때까지 쓴 시간만 깎고, 그 뒤로는 시작 시각을 계속 지금으로 둠.
      // 연결이 끊겨 기다리는 사람은 멈추지 않음 (멈추면 일부러 끊어 생각할 시간을 벌 수 있음)
      if(!O.mvBot){O.rem[O.mv]=Math.max(0,O.rem[O.mv]-Math.max(0,t-O.since));O.mvBot=1}
      O.since=t;
      if(H.botActAt&&t>=H.botActAt&&!(p.away&&t<p.awayAt+AWAY_WAIT))botTurn(O.mv);
      return;
    }
    if(O.mvBot){O.mvBot=0;O.since=t}
    if(O.rem[O.mv]-Math.max(0,t-O.since)<=0)timeout();
  },
  snap(s,you,t){
    const O=H.o,p=H.players[O.mv],run=H.phase==='play'&&p&&(!p.bot||awayHuman(p))?1:0;   // 끊겨서 기다리는 사람도 시계가 흐름
    const el=run?Math.max(0,t-O.since):0,rem=O.rem.map((v,i)=>Math.max(0,Math.round(v-(run&&i===O.mv?el:0))));
    s.o={n:O.R.n,b:O.b.join(''),ph:O.ph,A:O.A,co:O.co.slice(),cnt:O.cnt,lm:O.lm?{...O.lm}:null,rec:O.rec.map(x=>x.slice()),hd:(O.hd||[0,0]).slice(),rem,run,hold:run?Math.max(0,Math.round(O.since-t)):0,R:{...O.R},res:O.res?{w:O.res.w,why:O.res.why,line:O.res.line}:null};
    s.gr=0;s.dl=rem[O.mv];
  },
  restore(ms){if(H.o&&ms)H.o.since+=ms},   // 시작 연출 동안·방장이 꺼져 있던 동안은 시계를 멈춤
  emoPhase:ph=>ph==='play'||ph==='over'
};

/* 기보 글: 오프닝(돌 놓기·선택)과 대국을 번호 순서대로 */
function recordText(v){
  const o=v.o,n=o.n,rec=o.rec||[],name=i=>v.ps[i]?v.ps[i].n:'?';
  const R=o.R||{},c={sz:n===19?1:0,b33:R.b33,ov:R.ov,op:R.op,tm:R.tm,inc:R.inc};
  const p=presetOf(c);
  const lines=['오목 기보',`규칙: ${p>=0?PNAME[p]:'커스텀'} · ${lvTxt('sz',c)} · 3-3·4-4 ${lvTxt('b33',c)} · 장목 ${lvTxt('ov',c)} · 오프닝 ${lvTxt('op',c)} · 시계 ${clockTxt(c)}`,`선플레이어: ${name(o.A)}`];
  const cols=o.co||[0,0];
  if(cols[0])lines.push(`흑: ${name(cols[0]===1?0:1)} · 백: ${name(cols[0]===1?1:0)}`);
  const mv=[];let k=0;
  for(const x of rec){
    if(x[0]==='s'){k++;mv.push(`${k}.${CNAME[x[4]]}${sqName(n,x[2],x[3])}`)}
    else mv.push(x[2]===3?`[${name(x[1])}: 돌 2개 더]`:`[${name(x[1])}: ${CNAME[x[2]]} 선택]`);
  }
  lines.push(mv.join(' '));
  if(v.st==='over'&&o.res){
    const r=o.res;
    lines.push('결과: '+(r.w<0?'무승부':`${name(r.w)} 승리${r.why==='time'?' (상대 시간 초과)':r.why==='surrender'?' (상대 항복)':r.why==='desert'?' (상대 탈주)':''}`));
  }
  return lines.join('\n');
}

/* ---------- 방 설정의 규칙 레버 (공통 코드가 G.settingsHTML·G.panelAct로 부름) ----------
   왼쪽 자유 · 가운데 커스텀 · 오른쪽 렌주. 세부 설정은 펼쳐서 바꾸고(펼침 상태는 기억), 출발한 규칙과 다른 줄은 머스터드 색 + 원래 값 */
const CUS_KEY='gura-omok-custom',MORE_KEY='gura-omok-more';
let MORE=null,LASTLV=-1;
const isMore=()=>MORE==null?(MORE=store(MORE_KEY)==='1'):MORE;
const pickCfg=c=>{const o={};for(const k of PKEYS)o[k]=+c[k]||0;return o};
function loadCustom(){
  try{const sv=JSON.parse(store(CUS_KEY)||'null');if(!sv)return null;const o=pickCfg(sv);o.sz=o.sz?1:0;for(const k of ['b33','ov','op'])o[k]=Math.max(0,Math.min(2,Math.round(o[k])));return presetOf(o)<0?o:null}catch(e){return null}
}
G.settingsHTML=(c,{stepRow})=>{
  const rs=roomSetOf(G),pos=presetOf(c),base=baseOf(c),P=PRESETS[base],df=new Set(diffKeys(c));
  if(pos<0)store(CUS_KEY,JSON.stringify(pickCfg(c)));   // 커스텀은 늘 기억해 둠 (레버를 옮겼다 돌아오면 그대로)
  const note=k=>df.has(k)?`<em class="pd-note">${PNAME[base]}: ${LV[k].vals[P[k]]}</em>`:'';
  const lv=pos===0?0:pos===1?2:1;   // 레버 칸: 0 왼쪽, 1 가운데, 2 오른쪽
  const from=LASTLV<0?lv:LASTLV;LASTLV=lv;
  const opts=[[0,'자유','금수·오프닝 없음'],['c','커스텀',pos<0?`${PNAME[base]} 기반`:'세부 설정'],[1,'렌주','흑 금수 + Swap2']];
  const lever=`<div class="plever" role="radiogroup" aria-label="규칙"><i class="pl-knob" style="--p:${lv};--f:${from}"></i>${opts.map(([v,t,sm],k)=>`<button type="button" role="radio" aria-checked="${lv===k}" class="pl-o${lv===k?' on':''}" data-act="om:pr:${v}"><b>${t}</b><small>${sm}</small></button>`).join('')}</div>`;
  const open=isMore();
  const more=`<button type="button" class="pl-more" data-act="om:more" aria-expanded="${open}">세부 설정 ${open?'접기':'펼치기'}<span aria-hidden="true">${open?'▴':'▾'}</span></button>`;
  const seg=k=>{const v=Math.max(0,Math.min(LV[k].vals.length-1,+c[k]||0));
    return `<div class="stp om-seg${df.has(k)?' pdiff-row':''}"><div class="stp-t"><b>${LV[k].label}</b>${note(k)}<small>${LV[k].desc}</small></div><div class="segrow">${LV[k].vals.map((t,j)=>`<button class="btn ${v===j?'btn-play':'btn-sub'}" type="button" role="radio" aria-checked="${v===j}" data-act="om:set:${k}:${j}">${t}</button>`).join('')}</div></div>`};
  const det=open?`<div class="pl-det"><div class="rs-grid">${['sz','b33','ov','op'].map(seg).join('')}</div></div>`:'';
  const sp=rs.find(d=>d.k==='spec'),tm=rs.find(d=>d.k==='tm'),inc=rs.find(d=>d.k==='inc');
  const pf=!!(+c.pickfirst),pd=G.ruleSet[0];   // 선 플레이어: 쿼리도와 같은 스위치 (켜면 대기실 목록의 [선]으로 고름)
  const pfRow=`<div class="stp tg om-full"><div class="stp-t"><b>${pd.label}</b><small>${pd.desc}</small></div><div class="stp-c"><button type="button" class="sw${pf?' on':''}" role="switch" aria-checked="${pf}" aria-label="${pd.label}" data-act="tog:pickfirst"><i></i></button></div></div>`;
  return `<div class="rs-grid">${[sp,tm,inc].filter(Boolean).map(stepRow).join('')}</div><div class="rulehead">게임 규칙</div>${lever}<p class="pl-sum">${ruleLine(c)}</p>${more}${det}<div class="rs-grid tgs">${pfRow}</div>`;
};
G.panelAct=a=>{
  if(!a.startsWith('om:'))return false;
  if(a==='om:more'){MORE=!isMore();store(MORE_KEY,MORE?'1':'0');lastPanelHtml='';renderPanel();return true}
  if(!(mode==='host'&&H&&H.phase==='wait'))return true;
  const cur=presetOf(H.cfg),p=a.split(':');
  if(p[1]==='pr'){
    if(p[2]==='c'){   // 커스텀: 기억해 둔 커스텀이 있으면 되살리고, 없으면 세부 설정을 펼쳐 줌
      MORE=true;store(MORE_KEY,'1');
      const sv=cur<0?null:loadCustom();if(sv)H.cfg={...H.cfg,...sv};
    }else{
      const v=+p[2];
      if(cur===v){lastPanelHtml='';renderPanel();return true}
      if(cur<0)store(CUS_KEY,JSON.stringify(pickCfg(H.cfg)));
      H.cfg={...H.cfg,...PRESETS[v]};
    }
  }else if(p[1]==='set'){
    const k=p[2],v=+p[3];
    if(!LV[k]||!Number.isInteger(v)||v<0||v>=LV[k].vals.length)return true;
    H.cfg={...H.cfg,[k]:v};
  }
  saveRoomCfg(H.cfg);sfx('tick');lastPanelHtml='';mark();return true;
};

/* ---------- 화면 (모든 참가자) ----------
   2D(SVG)와 3D(공통 테이블 위 원목 판 + 체스 시계)는 같은 상태(OS)를 보고 그림 */
let OS=null,pend=null,held=false,msg='',msgUntil=0,msgTimer=null;   // OS: 지금 판 {n,R,b,...}, pend: 미리 보기로 고른 칸 {r,c} (상대 차례에도 미리 고를 수 있음), held: 통에서 돌 하나를 집어 든 상태 (놓을 때까지 유지, 취소해도 통에 돌려놓지 않음)
let elOm=null,elSvg=null,elMain=null,elGhost=null,elBar=null,elHint=null,elModes=null,lastBoard='',lastBar='',lastHint='',lastModes='';
const OC={at:0,fk:'',fl:[]};   // OC.at: 상태를 받은 시각 (시계가 흐른 시간 계산), fk·fl: 금수 칸 캐시
function buildS(o){
  const n=o.n,b=Array.from(o.b,Number),R=o.R&&o.R.n?o.R:rulesOf({sz:n===19?1:0,b33:0,ov:0,op:0,tm:10,inc:5});
  return {n,R,b,hd:o.hd||[0,0],cnt:o.cnt,ph:o.ph,A:o.A,co:o.co,lm:o.lm,rec:o.rec,rem:o.rem,run:o.run,hold:o.hold,res:o.res};
}
const myTurnNow=()=>!!(V&&V.o&&V.st==='play'&&myReady());
const dblOn=()=>typeof dblTap!=='undefined'&&!!dblTap;
function say(txt){
  msg=txt;msgUntil=Date.now()+2400;drawHint();
  clearTimeout(msgTimer);msgTimer=setTimeout(drawHint,2500);
}
/* 사람마다 남은 시간 (지금 둘 차례의 사람은 흐른 만큼 뺌) */
function remMs(i){
  const o=V&&V.o;if(!o)return 0;
  let v=o.rem[i];
  if(V.st==='play'&&o.run&&V.t===i){const e=clock()-OC.at-(o.hold||0);if(e>0)v-=e}
  return Math.max(0,v);
}
function fmtT(ms){const s=Math.ceil(ms/1000),m=Math.floor(s/60);return m+':'+String(s%60).padStart(2,'0')}
/* 지금 두는 색의 금수 칸 (판이 바뀔 때만 다시 계산) */
function forbidNow(){
  if(!OS||V.st!=='play'||OS.ph!=='play')return [];
  const col=myTurnNow()?nextColor(OS.cnt):canPre()?OS.co[myIdx()]:0;   // 내 차례, 또는 상대 차례에 미리 고를 때는 내 색 기준
  if(!col)return [];
  if(!bound(col,OS.R))return [];
  const k=V.o.b+'|'+col+'|'+OS.R.b33+OS.R.ov;
  if(OC.fk!==k){OC.fk=k;OC.fl=forbidCells(OS.b.slice(),OS.R,col)}
  return OC.fl;
}
/* 미리 고를 수 있나: 내 차례(오프닝 돌 놓기 포함), 또는 대국 중 상대 차례(색이 정해진 뒤) */
const canPre=()=>{const me=myIdx();return !!(V&&V.o&&OS&&V.st==='play'&&me>=0&&!introWait()&&OS.ph==='play'&&OS.co[me]&&!(V.ps[me]&&V.ps[me].f))};
/* 미리 보기 돌의 색: 대국 중이면 내 색, 오프닝이면 이번에 놓을 돌의 색 */
const pendCol=()=>{const me=myIdx();return OS.ph==='play'&&me>=0&&OS.co[me]?OS.co[me]:nextColor(OS.cnt)};
/* 눌러서 고르기 (미리 보기): 확정은 [놓기]. 상대 차례에도 골라 둘 수 있고, 내 차례가 오면 [놓기]로 둠 */
function pickCell(r,c){
  if(!V||!V.o||V.st!=='play'||!OS)return;
  const me=myIdx();if(me<0)return;
  const mine=myTurnNow();
  if(!mine&&!canPre()){sndNo();return}
  if(OS.ph==='c1'||OS.ph==='c2'){sndNo();return}
  if(r<0||c<0||r>=OS.n||c>=OS.n)return;
  if(OS.b[r*OS.n+c]){sndNo();return}
  if(OS.ph==='play'&&judge(OS.b.slice(),OS.R,r,c,pendCol(),0).bad){sndNo();return}   // 금수: 빨간 ✕ + 소리
  if(pend&&pend.r===r&&pend.c===c){if(dblOn()&&mine)confirmPend();else cancelPend();return}   // 같은 칸을 다시 누르면: 두 번 눌러 놓기면 둠, 아니면 취소
  pend={r,c};
  if(OS.ph==='play'&&!held)setHeld(true);else sfx('pick');   // 처음 고를 때 통에서 돌을 집어 듦
  redraw();
}
function confirmPend(){
  if(!pend||!myTurnNow())return;
  const p=pend;pend=null;
  sendAct({t:'put',r:p.r,c:p.c});redraw();
}
/* 돌을 집어 들기/내려놓기 (내 화면은 바로, 상대에게는 방장을 거쳐 알림: 상대 통 위에도 돌이 떠 보임) */
function setHeld(v){
  if(held===v)return;
  held=v;if(v)sndPick(.16);
  if(OS&&OS.ph==='play')sendAct({t:'hold',v:v?1:0});
  om3Bowls();
}
/* 미리 고른 칸 취소: 들고 있던 돌은 통으로 내려앉음 */
function cancelPend(){pend=null;if(held)setHeld(false);redraw()}
/* 내 통을 누르면 집는 소리 (돌을 들고 있으면 통에 내려놓고 취소) */
function bowlTap(){if(pend&&held){cancelPend();sndPick(.1)}else sndPick(.16)}
function sendPick(v){if(myTurnNow()&&(OS.ph==='c1'||OS.ph==='c2'))sendAct({t:'pick',v})}
function redraw(){msgUntil=0;drawAll();G.buttons();Om3.dirty=true}
const sqn=(r,c)=>sqName(OS.n,r,c);
/* ----- 2D (SVG) ----- */
const vbOf=n=>({x:-1.3,y:-1.3,w:n-1+2.6});
function toLat(e){
  const r=elSvg.getBoundingClientRect(),s=Math.min(r.width,r.height)||1,vb=vbOf(OS.n);
  const ox=(r.width-s)/2,oy=(r.height-s)/2;
  return [(e.clientX-r.left-ox)/s*vb.w+vb.x,(e.clientY-r.top-oy)/s*vb.w+vb.y];
}
function onSvgClick(e){if(!OS)return;const [x,y]=toLat(e);pickCell(Math.round(y),Math.round(x))}
const HOSHI={15:[3,7,11],19:[3,9,15]};
function stoneSvg(x,y,col,op,extra){
  const f=col===1?'#232326':'#f7f2e8',s=col===1?'#0c0c0e':'#8c7a5b';
  return `<circle cx="${x+.03}" cy="${y+.06}" r=".45" fill="#000" opacity="${.22*op}"/><circle cx="${x}" cy="${y}" r=".45" fill="${f}" stroke="${s}" stroke-width=".05" opacity="${op}"${extra||''}/>${op>=1?`<circle cx="${x-.14}" cy="${y-.15}" r=".12" fill="#fff" opacity="${col===1?.18:.55}"/>`:''}`;
}
function boardHTML(){
  const n=OS.n,out=[];
  out.push(`<rect x="-1.2" y="-1.2" width="${n-1+2.4}" height="${n-1+2.4}" rx=".3" fill="#8a5a32"/><rect x="-.98" y="-.98" width="${n-1+1.96}" height="${n-1+1.96}" rx=".12" fill="#e3bd7e"/>`);
  for(let i=0;i<n;i++){
    out.push(`<line x1="0" y1="${i}" x2="${n-1}" y2="${i}" stroke="#6b4a26" stroke-width=".045"/><line x1="${i}" y1="0" x2="${i}" y2="${n-1}" stroke="#6b4a26" stroke-width=".045"/>`);
    out.push(`<text class="om-co" x="${i}" y="${n-1+.68}">${COLS[i]}</text><text class="om-co" x="-.68" y="${i+.03}">${n-i}</text>`);
  }
  for(const a of HOSHI[n]||[])for(const b of HOSHI[n])out.push(`<circle cx="${a}" cy="${b}" r=".1" fill="#4b3319"/>`);
  const fb=forbidNow();
  // 마지막 수 표시, 이긴 줄
  const line=OS.res&&OS.res.line;
  if(line&&line.length>1){const a=line[0],z=line[line.length-1];out.push(`<line x1="${a[1]}" y1="${a[0]}" x2="${z[1]}" y2="${z[0]}" stroke="#f2b632" stroke-width=".26" stroke-linecap="round" opacity=".85"/>`)}
  for(let r=0;r<n;r++)for(let c=0;c<n;c++){const v=OS.b[r*n+c];if(v)out.push(stoneSvg(c,r,v,1))}
  if(OS.lm){out.push(`<circle cx="${OS.lm.c}" cy="${OS.lm.r}" r=".16" fill="${OS.lm.col===1?'#ffcf3d':'#d6342a'}"/>`)}
  if(line)for(const [r,c] of line)out.push(`<circle cx="${c}" cy="${r}" r=".5" fill="none" stroke="#f2b632" stroke-width=".08"/>`);
  if(V.st==='play'&&(myTurnNow()||canPre()))for(const i of fb){const r=(i/n)|0,c=i%n;out.push(`<path d="M${c-.26} ${r-.26}L${c+.26} ${r+.26}M${c+.26} ${r-.26}L${c-.26} ${r+.26}" stroke="#d6342a" stroke-width=".13" stroke-linecap="round"/>`)}
  return out.join('');
}
function drawGhost(){
  if(!elGhost)return;
  const out=[];
  if(pend&&OS)out.push(stoneSvg(pend.c,pend.r,pendCol(),.5));
  elGhost.innerHTML=out.join('');
  om3Marks();
}
const nm=i=>V.ps[i]?V.ps[i].n:'?';
function stoneDot(col){return `<i class="dot ${col===1?'blk':col===2?'wht':'non'}"></i>`}
function barHTML(){
  const me=myIdx(),o=OS,order=me===1?[1,0]:[0,1];
  return order.map(i=>{
    const p=V.ps[i];if(!p||i>1)return '';
    const on=V.st==='play'&&V.t===i&&!introWait();
    const st=V.st==='over'?(o.res&&o.res.w<0?'무승부':p.f===1?'승리':(p.sr===2?'시간 초과':p.sr===3?'탈주':p.sr?'항복':'패배')):'';
    return `<div class="om-p${on?' on':''}${i===me?' me':''}">${stoneDot(o.co[i])}<b>${esc(p.n)}${i===me?' (나)':''}</b><span class="w" data-ct="${i}">${fmtT(remMs(i))}</span>${st?`<span class="st">${st}</span>`:''}</div>`;
  }).join('');
}
/* 안내 줄: 꼭 필요한 것만 짧게 (누구 차례인지는 바둑통 고리·이름 칸이, 놓기는 [놓기] 버튼이 보여 줌) */
function hintText(){
  if(Date.now()<msgUntil&&msg)return msg;
  if(!V||!V.o||!OS)return '';
  if(V.st==='over'){
    const r=OS.res;if(!r)return '게임이 끝났습니다.';
    return r.w<0?'무승부입니다.':`${nm(r.w)} 승리${r.why==='time'?' (시간 초과)':r.why==='surrender'?' (항복)':r.why==='desert'?' (탈주)':''}`;
  }
  if(introWait())return '';
  const me=myIdx(),ph=OS.ph,mine=me>=0&&V.t===me;
  if(ph==='p1')return `오프닝 ${Math.min(3,OS.cnt+1)}/3`;
  if(ph==='p2')return `오프닝 ${Math.min(5,OS.cnt+1)}/5`;
  if(ph==='c1'||ph==='c2')return mine?'흑·백 고르기':'흑·백 고르는 중';
  return '';
}
function modesHTML(){
  if(!(V&&V.o&&OS&&myTurnNow()&&(OS.ph==='c1'||OS.ph==='c2')))return '';
  const mo=OS.ph==='c1'&&OS.R.op===2;
  return `<button type="button" class="om-m" data-v="1">${stoneDot(1)}흑으로 하기</button><button type="button" class="om-m" data-v="2">${stoneDot(2)}백으로 하기</button>${mo?'<button type="button" class="om-m" data-v="3">돌 2개 더 놓기</button>':''}`;
}
function drawHint(){
  if(!elHint)return;
  const h=hintText();
  if(h!==lastHint){elHint.textContent=h;lastHint=h}
  const m=modesHTML();if(m!==lastModes){elModes.innerHTML=m;lastModes=m}
}
function fit(){
  if(!elOm||elOm.hidden)return;
  const bd=elOm.querySelector('.om-bd'),bw=bd.clientWidth,bh=bd.clientHeight;
  let s=Math.min(bw,bh),top='50%';
  const st=$('#stage').getBoundingClientRect(),br=bd.getBoundingClientRect(),me=$('#me'),act=$('#actions');
  const pr=Math.max(240,me&&!me.hidden?me.getBoundingClientRect().right-st.left:0);
  const al=Math.min(st.width-140,act&&!act.hidden?act.getBoundingClientRect().left-st.left:st.width);
  const cx=br.left-st.left+bw/2;
  const big=Math.floor(Math.min(bw,bh+(st.bottom-br.bottom)-10,2*Math.min(cx-pr-10,al-10-cx)));
  if(big>s){s=big;top=(s/2)+'px'}
  s=Math.floor(s);
  if(s>0){elSvg.style.width=elSvg.style.height=s+'px';elSvg.style.top=top}
}
function drawAll(){
  if(!OS||!elMain)return;
  if(!Om3.on){
    const vb=vbOf(OS.n),vs=`${vb.x} ${vb.y} ${vb.w} ${vb.w}`;
    if(elSvg.getAttribute('viewBox')!==vs)elSvg.setAttribute('viewBox',vs);
    const bd=boardHTML();   // 같은 그림이면 다시 넣지 않음 (내 차례 여부에 따라 금수 ✕가 바뀌므로 글 전체로 비교)
    if(bd!==lastBoard){elMain.innerHTML=bd;lastBoard=bd}
  }
  const bar=barHTML();if(bar!==lastBar){elBar.innerHTML=bar;lastBar=bar}
  drawGhost();drawHint();fit();
}

/* ---------- 3D: 공통 원목 테이블 가운데의 오목판 + 바둑통 둘, 바로 위(90도)에서 내려다보는 자기 카메라 ----------
   단위: 월드 그대로. 판 반폭 BW(틀 포함), 교점 간격은 판 크기에 맞춤. 화면 x→월드 x, 화면 아래→월드 +z, 줄 번호는 위가 15 · 아래가 1
   판은 늘 테이블 한가운데. 바둑통: 내 통은 오른쪽 아래, 상대 통은 왼쪽 위 (넓은 화면은 판 옆, 좁은 화면은 판 위아래 모서리)
   남은 시간은 위쪽 이름 칸이 보여 줌 (시계 물건은 없음). 돌을 집고 놓는 움직임 대신 소리: 차례가 오면 통에서 돌 집는 소리, 놓으면 딱 */
const BW=2.3,GM=.3,TOP=.2,SPAN=2*BW-2*GM,BR=.56,BGAP=.24,BN=27;   // 틀 반폭, 틀 안쪽 여백, 판 윗면 높이, 격자 폭, 바둑통 반지름, 판과 통 사이, 통에 보이는 돌 수(가득)
const Om3={on:false,built:false,fail:false,root:null,cam:null,dirty:true,lastR:0,lay:'',layAt:0,d:12,W:0,H:0,K:'',stones:new Map(),anim:[],cnt:-1,ck:'',forbid:[],tx:{}};
const ease=k=>k<=0?0:k>=1?1:k*k*(3-2*k);
const pitchOf=n=>SPAN/(n-1);
const cellW=(n,r,c)=>{const p=pitchOf(n);return [(c-(n-1)/2)*p,(r-(n-1)/2)*p]};   // 칸 (r,c) → 월드 (x,z)
function woodPaint(g,w,h,base,dark,n,seed){
  let s=seed||7;const rnd=()=>{s=(s*16807)%2147483647;return s/2147483647};
  g.fillStyle=base;g.fillRect(0,0,w,h);
  for(let i=0;i<n;i++){const y0=rnd()*h,a=rnd()*.12+.04;g.strokeStyle=dark;g.globalAlpha=a;g.lineWidth=rnd()*2.5+.8;g.beginPath();
    for(let t=0;t<=w;t+=8){const y=y0+Math.sin(t/30+i)*3+Math.sin(t/11+i*3)*1.2;t?g.lineTo(t,y):g.moveTo(t,y)}g.stroke()}
  g.globalAlpha=1;
}
function withInk(geo,mat,inkGeo){
  const g=new THREE.Group(),m=new THREE.Mesh(geo,mat);m.castShadow=true;m.receiveShadow=true;g.add(m);
  const o=new THREE.Mesh(inkGeo,new THREE.MeshBasicMaterial({color:GFX_INK,side:THREE.BackSide}));g.add(o);g.userData.ink=o;g.userData.body=m;return g;
}
const MAT={};
function stoneMesh(col,ghost){
  const key='s'+col+(ghost?'g':'');
  if(!MAT[key])MAT[key]=ghost?new THREE.MeshBasicMaterial({color:col===1?0x222226:0xf7f2e8,transparent:true,opacity:.55,depthWrite:false}):toon({color:col===1?0x26262a:0xf4efe3,rim:col===1?.35:.12});
  const g=new THREE.Group(),r=pitchOf(OS?OS.n:15)*.46;
  const geo=new THREE.SphereGeometry(r,26,16),m=new THREE.Mesh(geo,MAT[key]);m.scale.y=.52;m.castShadow=!ghost;m.receiveShadow=!ghost;g.add(m);
  if(!ghost){const o=new THREE.Mesh(new THREE.SphereGeometry(r*1.07,26,16),new THREE.MeshBasicMaterial({color:GFX_INK,side:THREE.BackSide}));o.scale.y=.56;g.add(o);g.userData.ink=o}
  g.userData.r=r;g.userData.col=col;g.userData.n=OS?OS.n:15;
  return g;
}
const stoneY=g=>TOP+g.userData.r*.52;
/* 판 무늬: 격자·별·좌표 (판 크기가 바뀔 때 다시 그림) */
function drawBoardTex(n){
  const cv=Om3.boardTex.image,g=cv.getContext('2d'),N=cv.width,s=N/(2*BW),X=v=>(v+BW)*s;
  woodPaint(g,N,N,'#e0b878','#8a5520',90,13);
  g.strokeStyle='rgba(60,36,12,.9)';g.lineWidth=Math.max(1.5,N/700);
  const p=pitchOf(n);
  for(let i=0;i<n;i++){const v=(i-(n-1)/2)*p;g.beginPath();g.moveTo(X(-SPAN/2),X(v));g.lineTo(X(SPAN/2),X(v));g.moveTo(X(v),X(-SPAN/2));g.lineTo(X(v),X(SPAN/2));g.stroke()}
  g.strokeStyle='rgba(60,36,12,1)';g.lineWidth=Math.max(3,N/300);g.strokeRect(X(-SPAN/2),X(-SPAN/2),SPAN*s,SPAN*s);
  g.fillStyle='rgba(60,36,12,1)';
  for(const a of HOSHI[n]||[])for(const b of HOSHI[n]){g.beginPath();g.arc(X((a-(n-1)/2)*p),X((b-(n-1)/2)*p),Math.max(3,N/230),0,7);g.fill()}
  g.fillStyle='rgba(70,42,16,.95)';g.font=`700 ${Math.round(.17*s)}px "IBM Plex Mono", monospace`;g.textAlign='center';g.textBaseline='middle';
  for(let i=0;i<n;i++){const v=(i-(n-1)/2)*p;g.fillText(COLS[i],X(v),X(SPAN/2+GM*.55));g.fillText(String(n-i),X(-SPAN/2-GM*.55),X(v))}
  Om3.boardTex.needsUpdate=true;Om3.texN=n;
}
/* 바둑통: 둥근 원목 통(돌림 모양) + 안에 쌓인 돌 BN개(한 번에 그리는 묶음). 돌 자리는 아래층부터 차례로 정해 둠 */
const BOWL_ST=.095;
const bowlSpots=(()=>{
  const out=[],layers=[[13,.35],[9,.25],[5,.13]];let s=11;const rnd=()=>{s=(s*16807)%2147483647;return s/2147483647};
  layers.forEach(([N,R],L)=>{for(let k=0;k<N;k++){const r=R*Math.sqrt((k+.5)/N),a=k*2.39996+L*.9;out.push({x:Math.cos(a)*r,z:Math.sin(a)*r,y:.14+L*.06+rnd()*.012,rx:(rnd()-.5)*.5,rz:(rnd()-.5)*.5})}});
  return out;
})();
function bowlGroup(){
  const g=new THREE.Group();
  if(!MAT.bowl)MAT.bowl=toon({map:canvasTex(256,256,(c,w,h)=>woodPaint(c,w,h,'#b06a32','#5a2c0c',40,21)),rim:.18});
  const prof=[[0,.02],[.40,.02],[.50,.07],[.555,.18],[.535,.29],[.48,.355],[.445,.36],[.43,.31],[.39,.15],[.2,.105],[0,.1]].map(([x,y])=>new THREE.Vector2(x,y));
  const geo=new THREE.LatheGeometry(prof,40);
  const body=new THREE.Mesh(geo,MAT.bowl);body.material.side=THREE.DoubleSide;body.castShadow=body.receiveShadow=true;g.add(body);
  const ink=new THREE.Mesh(new THREE.LatheGeometry(prof.slice(0,7).map(v=>new THREE.Vector2(v.x*1.04+.005,v.y)),40),new THREE.MeshBasicMaterial({color:GFX_INK,side:THREE.BackSide}));g.add(ink);
  const sg=new THREE.SphereGeometry(BOWL_ST,14,8),mat=toon({color:0x26262a,rim:.3});
  const st=new THREE.InstancedMesh(sg,mat,BN);st.castShadow=true;g.add(st);
  const ik=new THREE.InstancedMesh(sg,new THREE.MeshBasicMaterial({color:GFX_INK,side:THREE.BackSide}),BN);g.add(ik);
  // 차례 표시: 통 둘레의 노란 고리
  const ring=new THREE.Mesh(new THREE.RingGeometry(BR+.06,BR+.13,48),new THREE.MeshBasicMaterial({color:0xf2b632,transparent:true,opacity:.85,depthWrite:false}));
  ring.rotation.x=-Math.PI/2;ring.position.y=.012;ring.visible=false;ring.renderOrder=2;g.add(ring);
  // 집어 든 돌: 통 위로 떠오름 (내려놓으면 통으로 내려앉고, 판에 두면 그 자리에서 사라짐)
  const fl=new THREE.Group(),fm=new THREE.Mesh(new THREE.SphereGeometry(BOWL_ST*1.15,20,12),mat);fm.scale.y=.5;fm.castShadow=true;fl.add(fm);
  const fo=new THREE.Mesh(new THREE.SphereGeometry(BOWL_ST*1.15*1.1,20,12),new THREE.MeshBasicMaterial({color:GFX_INK,side:THREE.BackSide}));fo.scale.y=.58;fl.add(fo);
  fl.scale.setScalar(1.2);fl.visible=false;g.add(fl);
  g.userData={st,ik,mat,ring,fl,fs:'none',ft0:0,lastCnt:-1,col:0,n:BN,drop:null};
  bowlFill(g,BN,null);
  return g;
}
const _m4=()=>Om3.m4||(Om3.m4=new THREE.Matrix4());
/* 통 안의 돌 n개를 제자리에 (drop: 시작 연출에서 떨어지는 중이면 {t: 연출 시각, t0: 첫 돌 시각, gap, dur}) */
function bowlFill(g,n,drop){
  const u=g.userData,m=_m4(),q=Om3.q||(Om3.q=new THREE.Quaternion()),e=Om3.eu||(Om3.eu=new THREE.Euler()),p=Om3.pv||(Om3.pv=new THREE.Vector3()),sc=Om3.sv||(Om3.sv=new THREE.Vector3());
  let shown=0;
  for(let i=0;i<n;i++){
    const b=bowlSpots[i];let y=b.y;
    let sp=1;   // 떨어지는 돌은 통 가운데 위에서 내려와 제자리로 퍼짐 (바로 위 카메라라 높이 있는 돌이 통 밖으로 보이지 않게 낮게)
    if(drop){const x=(drop.t-drop.t0-i*drop.gap)/drop.dur;if(x<=0)break;y+=dropY(Math.min(1,x),.4);sp=Math.min(1,.35+x*.9)}
    e.set(b.rx,i*.7,b.rz);q.setFromEuler(e);p.set(b.x*sp,y,b.z*sp);
    sc.set(1,.5,1);m.compose(p,q,sc);u.st.setMatrixAt(i,m);
    sc.set(1.12,.62,1.12);m.compose(p,q,sc);u.ik.setMatrixAt(i,m);
    shown++;
  }
  u.st.count=u.ik.count=shown;u.st.instanceMatrix.needsUpdate=u.ik.instanceMatrix.needsUpdate=true;u.n=shown;
}
/* 소리: 통에서 돌을 집는 소리(자르륵), 판에 놓는 소리(딱). 코드로 만든 소리 */
function sndPick(vol,at){for(let k=0;k<4;k++)hiss(.022,{freq:2400+Math.random()*1600,q:5,vol:vol*(.55+Math.random()*.45),at:(at||0)+k*.034+Math.random()*.018})}
function sndNo(){sfx('no')}   // 안 되는 곳을 눌렀을 때 (글 대신)
function sndPut(at){hiss(.03,{freq:3300,q:2.4,vol:.24,at});tone(2100,.025,{type:'triangle',vol:.07,at});tone(820,.06,{type:'sine',vol:.07,at:at+.004})}
function om3Build(){
  if(Om3.built||Om3.fail)return Om3.built;
  if(!T.ok||typeof THREE==='undefined'){Om3.fail=true;return false}
  try{
    const root=new THREE.Group();root.visible=false;
    const inkM=new THREE.MeshBasicMaterial({color:GFX_INK,side:THREE.BackSide});
    const bg=new THREE.Group();root.add(bg);Om3.boardG=bg;
    const frameT=canvasTex(512,512,(g,w,h)=>woodPaint(g,w,h,'#6f4020','#2a1206',110,3));
    const frame=new THREE.Mesh(new THREE.BoxGeometry(2*BW,TOP-.02,2*BW),toon({map:frameT,rim:.08}));frame.position.y=.02+(TOP-.02)/2;frame.castShadow=frame.receiveShadow=true;bg.add(frame);
    const fo=new THREE.Mesh(new THREE.BoxGeometry(2*BW+.05,TOP,2*BW+.05),inkM);fo.position.copy(frame.position);bg.add(fo);
    Om3.boardTex=canvasTex(1024,1024,()=>{});
    const top=new THREE.Mesh(new THREE.PlaneGeometry(2*BW-.1,2*BW-.1),new THREE.MeshBasicMaterial({map:Om3.boardTex}));   // 판 무늬는 나무판과 한 몸 (따로 나타나지 않음)
    top.rotation.x=-Math.PI/2;top.position.y=TOP+.003;top.renderOrder=1;bg.add(top);Om3.top=top;
    // 금수 ✕ (미리 만들어 두고 켜고 끔)
    const xT=canvasTex(128,128,(g,w,h)=>{g.strokeStyle='#d6342a';g.lineWidth=18;g.lineCap='round';g.beginPath();g.moveTo(30,30);g.lineTo(98,98);g.moveTo(98,30);g.lineTo(30,98);g.stroke()});
    const xM=new THREE.MeshBasicMaterial({map:xT,transparent:true,depthWrite:false});
    Om3.xs=[];for(let k=0;k<80;k++){const m=new THREE.Mesh(new THREE.PlaneGeometry(1,1),xM);m.rotation.x=-Math.PI/2;m.position.y=TOP+.006;m.visible=false;m.renderOrder=3;root.add(m);Om3.xs.push(m)}
    // 마지막 수 표시, 이긴 줄, 미리 보기 돌
    Om3.lastM=new THREE.Mesh(new THREE.CircleGeometry(1,20),new THREE.MeshBasicMaterial({color:0xd6342a,transparent:true,opacity:.95,depthWrite:false}));Om3.lastM.rotation.x=-Math.PI/2;Om3.lastM.visible=false;Om3.lastM.renderOrder=4;root.add(Om3.lastM);
    Om3.winM=new THREE.Mesh(new THREE.BoxGeometry(1,.03,1),new THREE.MeshBasicMaterial({color:0xf2b632,transparent:true,opacity:.9}));Om3.winM.visible=false;Om3.winM.renderOrder=5;root.add(Om3.winM);
    Om3.ghost=new THREE.Group();Om3.ghost.visible=false;root.add(Om3.ghost);
    // 바둑통 둘: 0 = 내 통(오른쪽 아래), 1 = 상대 통(왼쪽 위)
    Om3.bowls=[0,1].map(()=>{const g=bowlGroup();root.add(g);return g});
    Om3.cam=new THREE.PerspectiveCamera(44,1,.1,100);Om3.cam.up.set(0,0,-1);
    T.scene.add(root);Om3.root=root;Om3.built=true;
  }catch(e){Om3.fail=true;try{console.warn('오목 3D 준비 실패',e)}catch(_){}}
  return Om3.built;
}
/* 바둑통 자리: 넓은 화면(h)은 판 옆, 좁은 화면(v)은 판 위아래 모서리. 내 통이 오른쪽 아래 */
function bowlPos(lay,k){
  const a=BW+BGAP+BR,b=BW-BR,sg=k?-1:1;
  return lay==='h'?[sg*a,sg*b]:[sg*b,sg*a];
}
function placeBowls(lay){Om3.bowls.forEach((g,k)=>{const [x,z]=bowlPos(lay,k);g.position.x=x;g.position.z=z})}
/* 통의 돌 색(사람의 색, 오프닝 중 아직 안 정했으면 선플레이어 흑·상대 백으로 보임)과 남은 양, 차례 고리 */
function om3Bowls(){
  if(!Om3.on||!V||!V.o||!OS)return;
  const me=myIdx()<0?0:myIdx(),o=OS;
  let used=[0,0,0];for(const v of o.b)used[v]++;
  Om3.bowls.forEach((g,k)=>{
    const seat=k?1-me:me,col=o.co[seat]||(seat===o.A?1:2),u=g.userData;
    if(u.col!==col){u.col=col;u.mat.color.setHex(col===1?0x26262a:0xece4d4);Om3.dirty=true}
    // 집어 든 돌: 내 통은 내 화면의 상태(held), 상대 통은 방장이 알려 준 상태(hd). 판에 두었으면 바로 사라지고, 내려놓았으면 통으로 내려앉음
    const want=V.st==='play'&&!IN.on3d&&(k===0?(held&&myIdx()>=0):!!(o.hd&&o.hd[seat]));
    const L=o.cnt>u.lastCnt&&u.lastCnt>=0?(o.rec||[]).filter(x=>x[0]==='s').pop():null,placed=!!(L&&L[1]===seat);u.lastCnt=o.cnt;
    if(want&&(u.fs==='none'||u.fs==='down')){u.fs='up';u.ft0=clock();u.fl.visible=true;Om3.dirty=true}
    else if(!want&&(u.fs==='up'||u.fs==='held')){if(placed||V.st!=='play'){u.fs='none';u.fl.visible=false}else{u.fs='down';u.ft0=clock()}Om3.dirty=true}
    if(!IN.on3d){const n=Math.max(6,BN-used[col]-(u.fs!=='none'?1:0));if(n!==u.n){bowlFill(g,n,null);Om3.dirty=true}}   // 놓은 돌 수만큼 통이 빔 (손에 든 돌 하나 포함, 바닥은 남겨 둠)
    const on=V.st==='play'&&V.t===seat&&!introWait();
    if(u.ring.visible!==on){u.ring.visible=on;Om3.dirty=true}   // 누구 차례인지: 통 둘레의 노란 고리 (시간은 보여 주지 않음)
  });
}
/* 상태를 3D 물체에 맞춤 (새 상태가 올 때마다) */
function om3Sync(){
  if(!Om3.on||!V||!V.o||!OS)return;
  const o=OS,n=o.n;
  if(Om3.texN!==n){drawBoardTex(n);for(const m of Om3.stones.values())Om3.root.remove(m);Om3.stones.clear();Om3.cnt=-1}
  const snap=o.cnt<Om3.cnt||Om3.cnt<0;
  Om3.cnt=o.cnt;
  const keep=new Set();
  for(let r=0;r<n;r++)for(let c=0;c<n;c++){
    const v=o.b[r*n+c];if(!v)continue;
    const key=r*n+c;keep.add(key);
    let m=Om3.stones.get(key);
    if(m&&m.userData.col!==v){Om3.root.remove(m);Om3.stones.delete(key);m=null}
    if(!m){
      m=stoneMesh(v);const [x,z]=cellW(n,r,c);m.position.set(x,stoneY(m),z);Om3.root.add(m);Om3.stones.set(key,m);
      if(!snap){const y1=stoneY(m);m.position.y=y1+.3;Om3.anim.push({obj:m,t0:clock(),dur:170,y0:y1+.3,y1})}   // 바로 위에서 툭 (통에서 날아오지 않음, 소리가 대신함)
    }
  }
  for(const [k,m] of Om3.stones)if(!keep.has(k)){Om3.root.remove(m);Om3.stones.delete(k)}
  // 이긴 줄 표시
  const ln=o.res&&o.res.line;
  if(ln&&ln.length>1){
    const a=cellW(n,ln[0][0],ln[0][1]),z=cellW(n,ln[ln.length-1][0],ln[ln.length-1][1]),L=Math.hypot(z[0]-a[0],z[1]-a[1])+.1;
    Om3.winM.scale.set(L,1,.07);Om3.winM.position.set((a[0]+z[0])/2,TOP+.16,(a[1]+z[1])/2);Om3.winM.rotation.y=-Math.atan2(z[1]-a[1],z[0]-a[0]);Om3.winM.visible=true;
  }else Om3.winM.visible=false;
  if(o.lm){const [x,z]=cellW(n,o.lm.r,o.lm.c),sm=Om3.stones.get(o.lm.r*n+o.lm.c),p=pitchOf(n);Om3.lastM.scale.setScalar(p*.13);Om3.lastM.position.set(x,(sm?stoneY(sm)+sm.userData.r*.52:TOP)+.01,z);Om3.lastM.material.color.setHex(o.lm.col===1?0xffcf3d:0xd6342a);Om3.lastM.visible=true}
  else Om3.lastM.visible=false;
  om3Marks();om3Bowls();
  Om3.dirty=true;
}
/* 금수 ✕, 미리 보기 돌 (고를 때마다) */
function om3Marks(){
  if(!Om3.on||!V||!V.o||!OS)return;
  const n=OS.n,p=pitchOf(n),fb=V.st==='play'&&(myTurnNow()||canPre())?forbidNow():[];
  Om3.xs.forEach((m,k)=>{const i=fb[k];m.visible=i!=null;if(i!=null){const [x,z]=cellW(n,(i/n)|0,i%n);m.position.x=x;m.position.z=z;m.scale.set(p*.8,p*.8,1)}});
  if(pend){
    const col=pendCol();
    if(Om3.ghost.userData.k!==col+'|'+n){Om3.ghost.clear();{const gm=stoneMesh(col,true);gm.children[0].renderOrder=5;Om3.ghost.add(gm)}Om3.ghost.userData.k=col+'|'+n}
    const [x,z]=cellW(n,pend.r,pend.c);Om3.ghost.position.set(x,stoneY(Om3.ghost.children[0]),z);Om3.ghost.visible=true;
  }else Om3.ghost.visible=false;
  Om3.dirty=true;
}
/* 카메라: 판(테이블 가운데)과 바둑통이 '판 자리'(위 HUD 아래, 휴대폰은 내 정보 칸 위)에 꽉 차게. 통은 더 크게 보이는 쪽(옆·위아래)에 */
function om3Layout(t){
  if(t-Om3.layAt<100&&Om3.lay)return false;
  Om3.layAt=t;
  const st=$('#stage'),W=st.clientWidth,Hh=st.clientHeight;if(!W||!Hh||!V||!V.o)return false;
  const sr=st.getBoundingClientRect(),bd=elOm.querySelector('.om-bd').getBoundingClientRect();
  const base=[W,Hh].join(',');
  if(Om3.topBase!==base){Om3.topBase=base;Om3.topMax=0}
  const top=Math.max(Math.round(bd.top-sr.top),Om3.topMax);Om3.topMax=top;
  const key=base+','+top+','+myIdx();
  if(key===Om3.lay)return false;
  Om3.lay=key;
  const narrow=W<700,fy=top+2,fh=(narrow?Hh-78:Hh-54)-fy,fw=W-8;
  const ext=2*(BW+BGAP+2*BR),sV=Math.min(fw/(2*BW),fh/ext),sH=Math.min(fw/ext,fh/(2*BW));
  const lay=sH>sV?'h':'v',s=Math.max(sV,sH)*.97;
  Om3.layout=lay;placeBowls(lay);
  const cam=Om3.cam,f=Math.tan(cam.fov*Math.PI/360),d=(Hh/2)/(s*f);
  cam.aspect=W/Hh;cam.position.set(0,TOP+d,0);cam.lookAt(0,TOP,0);
  const oy=(fy+fh/2)-Hh/2;
  cam.setViewOffset(W,Hh,0,-oy,W,Hh);cam.updateProjectionMatrix();cam.updateMatrixWorld();
  Om3.d=d;Om3.W=W;Om3.H=Hh;Om3.dirty=true;
  return true;
}
function om3Step(now){
  let busy=false;
  Om3.anim=Om3.anim.filter(a=>{
    const k=Math.min(1,(now-a.t0)/a.dur),e=1-Math.pow(1-k,3);busy=true;
    a.obj.position.y=a.y0+(a.y1-a.y0)*e+(k>.8?Math.sin((k-.8)*Math.PI/.2)*.03:0);
    return k<1;
  });
  return busy;
}
function om3Render(t){
  if(!Om3.on||!T.ok)return;
  if(om3Layout(t))Om3.dirty=true;
  const busy=om3Step(t),intro=IN.on3d&&introStep(t);
  let flBusy=false;
  for(const g of Om3.bowls){   // 집어 든 돌: 떠오르기 0.15초, 내려앉기 0.17초
    const u=g.userData;if(u.fs==='none')continue;
    const lo=.3,hi=.95,toB=(()=>{const x=-g.position.x,z=-g.position.z,l=Math.hypot(x,z)||1,f=u.fs==='down'?1-Math.min(1,(t-u.ft0)/170):u.fs==='up'?Math.min(1,(t-u.ft0)/150):1;return [x/l*.4*f,z/l*.4*f]})();   // 통 위로 떠올라 판 쪽 가장자리에 (그림자가 통에 떨어져 '들었다'는 게 보이게)
    u.fl.position.x=toB[0];u.fl.position.z=toB[1];
    if(u.fs==='up'){const k=Math.min(1,(t-u.ft0)/150);u.fl.position.y=lo+(hi-lo)*(1-Math.pow(1-k,3));if(k>=1)u.fs='held';flBusy=true}
    else if(u.fs==='held')u.fl.position.y=hi;
    else{const k=Math.min(1,(t-u.ft0)/170);u.fl.position.y=hi-(hi-lo)*k*k;flBusy=true;if(k>=1){u.fs='none';u.fl.visible=false;om3Bowls()}}
  }
  if(flBusy)Om3.dirty=true;
  if(!busy&&!intro&&!Om3.dirty&&t-Om3.lastR<400)return;
  Om3.dirty=false;Om3.lastR=t;
  const fog=T.scene.fog,fn=fog?fog.near:0,ff=fog?fog.far:0;
  if(fog){fog.near=Om3.d+4;fog.far=Om3.d+26}
  for(const m of [T.timerBg,T.timerArc,T.ring])if(m)m.visible=false;
  let cam=Om3.cam;
  {const k=intro&&IN.fromLobby?ease((t-IN.t0)/INTRO.cam):1;
   if(k<1){   // 시작 연출: 이 기기의 로비 카메라에서 오목 카메라로 위치·방향·화면 범위를 함께 옮김
     const ic=Om3.icam||(Om3.icam=new THREE.PerspectiveCamera());
     ic.position.copy(T.cam.position).lerp(Om3.cam.position,k);ic.quaternion.copy(T.cam.quaternion).slerp(Om3.cam.quaternion,k);
     const a=T.cam.projectionMatrix.elements,b=Om3.cam.projectionMatrix.elements,m=ic.projectionMatrix.elements;
     for(let j=0;j<16;j++)m[j]=a[j]+(b[j]-a[j])*k;
     ic.projectionMatrixInverse.copy(ic.projectionMatrix).invert();ic.updateMatrixWorld();
     if(fog){fog.near=fn+(fog.near-fn)*k;fog.far=ff+(fog.far-ff)*k}
     cam=ic;
   }}
  T.r.render(T.scene,cam);
  if(fog){fog.near=fn;fog.far=ff}
}
/* ---------- 시작 연출 (게임이 시작되면 한 번: 방장이 그동안 시간·봇을 멈춤, 길이 G.introMs) ----------
   0~1.1초    로비 카메라 → 바로 위 90도. 0.65초부터 위쪽 이름 목록이 들어옴
   0.1~0.5초  판(무늬까지 한 몸)이 위에서 툭 내려앉음, 0.45~0.8초 바둑통 둘이 내려앉음
   0.8~1.7초  통마다 돌이 하나씩 쏟아져 차오름 (자르륵 소리)
   1.8초      '○○님이 먼저 시작합니다' 안내, 2.4초에 끝
   다시 하기(이미 오목 화면)는 카메라·판·통은 그대로 두고 통에 돌만 다시 채움. WebGL이 없으면 위쪽 이름 목록만 */
const INTRO={cam:1100,ui:650,board:[100,400],bowl:[450,350],fill:[800,30,240],say:1800};
G.introMs=2400;
const IN={on:false,on3d:false,t0:0,fromLobby:true,said:false,snd:{}};
const introOn=()=>IN.on&&clock()<IN.t0+G.introMs;
const introWait=()=>introOn()&&!IN.said;
const eOut=x=>{x=x<0?0:x>1?1:x;return 1-Math.pow(1-x,3)};
const dropY=(x,h)=>x>=1?0:x<.68?h*(1-(x/.68)*(x/.68)):h*.13*Math.sin(Math.PI*(x-.68)/.32);
G.intro=t0=>{
  if(!V||!V.o||!V.ps)return;
  IN.on=true;IN.t0=t0;IN.said=false;IN.snd={};IN.fromLobby=!Om3.on;IN.on3d=true;
  $('#stage').classList.add('om-intro');if(elOm&&IN.fromLobby)elOm.classList.add('intro');
  lastBar='';Om3.dirty=true;
};
function introStep(now,force){
  if(!Om3.built||!V||!V.o)return false;
  const e=now-IN.t0,done=force||e>=G.introMs,fl=IN.fromLobby;
  if(done)IN.on3d=false;
  {const x=done||!fl?1:(e-INTRO.board[0])/INTRO.board[1];Om3.boardG.visible=x>0;Om3.boardG.position.y=dropY(Math.max(0,x),1.6)}
  Om3.bowls.forEach(g=>{
    const x=done||!fl?1:(e-INTRO.bowl[0])/INTRO.bowl[1];g.visible=x>0;g.position.y=dropY(Math.max(0,x),1.2);
    if(done){bowlFill(g,BN,null);g.userData.n=-1}else bowlFill(g,BN,{t:e,t0:INTRO.fill[0],gap:INTRO.fill[1],dur:INTRO.fill[2]});
  });
  if(done)om3Bowls();
  return true;
}
function introEnd(){
  if(IN.on3d)introStep(clock(),true);
  IN.on=false;IN.on3d=false;IN.said=true;
  $('#stage').classList.remove('om-intro');if(elOm)elOm.classList.remove('intro');
}
function introTick(){
  if(!IN.on)return;
  const e=clock()-IN.t0,S=IN.snd,once=(k,f)=>{if(!S[k]){S[k]=1;f()}};
  if(e>=INTRO.ui&&elOm&&elOm.classList.contains('intro'))elOm.classList.remove('intro');
  if(IN.on3d&&Om3.on&&IN.fromLobby){
    if(e>=INTRO.board[0]+INTRO.board[1]*.68)once('thud',()=>{tone(120,.13,{type:'triangle',vol:.2});hiss(.09,{freq:650,vol:.12})});
    if(e>=INTRO.bowl[0]+INTRO.bowl[1]*.68)once('bowl',()=>{tone(170,.1,{type:'triangle',vol:.14});hiss(.06,{freq:900,vol:.08})});
  }
  if(IN.on3d&&Om3.on)for(let k=0;k<BN;k+=4)if(e>=INTRO.fill[0]+k*INTRO.fill[1]+INTRO.fill[2]*.6)once('f'+k,()=>sndPick(.09));   // 돌이 통에 쏟아지는 소리
  if(e>=INTRO.say&&!IN.said){
    IN.said=true;$('#stage').classList.remove('om-intro');if(elOm)elOm.classList.remove('intro');
    const p=V&&V.o&&V.ps&&V.ps[V.o.A];
    if(p)say(V.o.A===myIdx()?(V.o.R&&V.o.R.op?'내가 먼저 오프닝 돌을 놓습니다.':'내가 흑으로 먼저 시작합니다.'):(V.o.R&&V.o.R.op?`${p.n}님이 먼저 오프닝 돌을 놓습니다.`:`${p.n}님이 흑으로 먼저 시작합니다.`));
    sfx('turn');lastBar='';if(Om3.on){om3Marks();om3Bowls()}
  }
  if(e>=G.introMs){IN.on=false;lastBar='';lastHint='';G.buttons()}
  drawAll();
}
/* 3D 화면에서 누른 곳 → 가장 가까운 교점 */
const omRay=()=>Om3.ray||(Om3.ray=new THREE.Raycaster());
/* 누른 곳의 테이블 위 월드 좌표 (판 윗면 높이) */
function om3World(e){
  const r=T.r.domElement.getBoundingClientRect();if(!r.width)return null;
  const ray=omRay();ray.setFromCamera({x:(e.clientX-r.left)/r.width*2-1,y:-(e.clientY-r.top)/r.height*2+1},Om3.cam);
  const o=ray.ray.origin,dv=ray.ray.direction;if(Math.abs(dv.y)<1e-6)return null;
  const k=(.36-o.y)/dv.y;return [o.x+dv.x*k,o.z+dv.z*k];   // 통 윗면 높이
}
function om3Point(e){
  const r=T.r.domElement.getBoundingClientRect();if(!r.width||!OS)return null;
  const nx=(e.clientX-r.left)/r.width*2-1,ny=-(e.clientY-r.top)/r.height*2+1;
  const ray=omRay();ray.setFromCamera({x:nx,y:ny},Om3.cam);
  const o=ray.ray.origin,dv=ray.ray.direction;if(Math.abs(dv.y)<1e-6)return null;
  const k=(TOP-o.y)/dv.y,x=o.x+dv.x*k-Om3.root.position.x,z=o.z+dv.z*k-Om3.root.position.z,n=OS.n,p=pitchOf(n);
  const c=Math.round(x/p+(n-1)/2),rw=Math.round(z/p+(n-1)/2);
  if(Math.abs(x/p+(n-1)/2-c)>.6||Math.abs(z/p+(n-1)/2-rw)>.6)return null;
  return [rw,c];
}
function om3Click(e){
  if(!Om3.on||G!==GAMES.omok)return;
  {const w=om3World(e),b=Om3.bowls&&Om3.bowls[0];if(w&&b&&myIdx()>=0&&Math.hypot(w[0]-b.position.x,w[1]-b.position.z)<BR+.06){bowlTap();return}}   // 내 통
  const p=om3Point(e);if(!p)return;
  pickCell(p[0],p[1]);
}
/* 새 상태를 받았을 때 (그리기 전 / 그린 뒤) */
G.preView=()=>{
  if(!V.o){OS=null;return}
  OS=buildS(V.o);OC.at=clock();
  // 새 판·단계가 바뀌면 처음으로. 돌이 놓이면: 내가 놓았으면 든 돌을 내려놓음, 상대가 두어 미리 고른 자리가 막혔거나 금수가 되면 지움
  const me=myIdx();
  if(!PV||!PV.o||PV.st!==V.st||PV.o.ph!==V.o.ph||V.o.cnt<PV.o.cnt){pend=null;if(!PV||!PV.o||V.o.cnt<PV.o.cnt||V.st!=='play')held=false}
  else if(PV.o.cnt!==V.o.cnt){
    const L=(V.o.rec||[]).filter(x=>x[0]==='s').pop();
    if(L&&L[1]===me){held=false;pend=null}
    else if(pend){
      // 상대가 그 자리에 두었거나 금수가 되면 조용히 지우고 돌은 통으로 (알림 없음)
      if(OS.b[pend.r*OS.n+pend.c]||(OS.ph==='play'&&me>=0&&OS.co[me]&&judge(OS.b.slice(),OS.R,pend.r,pend.c,OS.co[me],0).bad)){pend=null;if(held)setHeld(false)}
    }
  }
  if(V.st!=='play')pend=null;
};
G.postView=()=>{};
G.overExtra=()=>{
  if(!V||!V.o||!Array.isArray(V.o.rec)||!V.o.rec.length)return '';
  return `<div class="qd-rec"><div class="qd-rec-h"><b>기보</b><button type="button" class="btn btn-sub om-copy">기보 복사</button></div><pre>${esc(recordText(V))}</pre></div>`;
};
G.logCue=()=>false;
/* 소리: 돌이 놓이면 '딱'(내려앉는 순간에 맞춤). 집는 소리는 내가 칸을 처음 고를 때와 내 통을 누를 때만 (차례가 바뀔 때는 없음) */
G.cues=(v,pv)=>{
  if(!v.o||!pv.o)return;
  if(v.o.cnt>pv.o.cnt)sndPut(Om3.on?.15:0);
  else if(v.o.ph!==pv.o.ph&&v.st==='play')sfx('pick');
};
G.hud=inGame=>{
  if(!elOm)return;
  const on=!!(inGame&&V&&V.o&&OS);
  elOm.hidden=!on;
  $('#stage').classList.toggle('om-over',!!(on&&V.st==='over'));
  const d3=on&&om3Build();
  if(d3!==Om3.on){Om3.on=d3;Om3.lay='';Om3.K='';if(Om3.root)Om3.root.visible=d3;$('#stage').classList.toggle('om3d',d3);lastBoard='';lastHint=''}
  $('#stage').classList.toggle('om2d',on&&!d3);
  if(!on){lastBoard='';lastBar='';lastHint='';lastModes='';return}
  drawAll();
  om3Sync();
};
G.handMarks=()=>{};
G.me=(i,h)=>{
  $('#numpick').hidden=true;
  const p=V.ps[i];if(!p||!V.o||!OS)return;
  const c=OS.co[i];
  if(p.f){if(!p.sr)$('#meSub').innerHTML=OS.res&&OS.res.w<0?'<b>무승부</b>입니다.':`<b>${+p.f}위</b>입니다.`;return}
  $('#meSub').innerHTML=c?`<b>${c===1?'흑':'백'}</b>을 잡았습니다`:'오프닝 중입니다';
};
G.specNote='관전 중입니다. 두 사람의 대국을 지켜봅니다.';
/* 결과 창 순위 옆 글자: 비기면 둘 다 1위라 '무승부'로 알려 줌 */
G.overRank=p=>{
  const r=V&&V.o&&V.o.res,t=p.sr===2?'시간 초과':p.sr===3?'탈주':p.sr?'항복':r&&r.w<0?'무승부':'';
  return t?`<span class="left">${t}</span>`:'';
};
G.usesDbl=true;
G.no3D=true;
G.buttons=()=>{
  const play=$('#btnPlay'),can=!!(pend&&myTurnNow());
  $('#btnPass').hidden=true;$('#btnGura').hidden=true;
  play.disabled=!can;play.classList.toggle('ready',can);
  if($('#playMain').textContent!=='놓기')$('#playMain').textContent='놓기';
  const sub=keyLabel(KEYS.play);if($('#playSub').textContent!==sub)$('#playSub').textContent=sub;
};
G.live=()=>{
  if(IN.on){introTick();}
  if(!V||!V.o||!OS)return;
  // 시계: 위쪽 이름 칸과 내 정보 칸의 시간 (매 프레임 조금씩)
  if(elBar)elBar.querySelectorAll('[data-ct]').forEach(el=>{const i=+el.dataset.ct,ms=remMs(i),t=fmtT(ms);if(el.textContent!==t)el.textContent=t;
    const low=V.st==='play'&&V.t===i&&V.o.run&&ms<=10000;if(el.parentNode.classList.contains('low')!==low)el.parentNode.classList.toggle('low',low)});   // 10초 남으면 이름 칸 시간이 빨갛게 깜빡임 (글 안내 대신)
  const me=myIdx();
  if(me>=0){const mt=$('#meTime');const t=V.st==='play'?fmtT(remMs(me)):'';if(mt.textContent!==t)mt.textContent=t}
};
G.play=confirmPend;
G.pass=()=>{};
G.keyPhase=st=>st==='play';
G.onKey=()=>false;
G.field3D=()=>{if(T.stacks)for(const arr of T.stacks.values())arr.forEach(c=>{c.visible=false})};
G.render3D=t=>{if(Om3.on)om3Render(t);else if(T.ok&&!$('#stage').classList.contains('om2d'))T.r.render(T.scene,T.cam)};
G.enter=()=>{
  $('#stage').classList.add('om');
  $('#btnPass').hidden=true;$('#btnGura').hidden=true;$('#numpick').hidden=true;
  pend=null;held=false;
  if(elOm)fit();
};
G.leave=()=>{
  introEnd();
  $('#stage').classList.remove('om','om-over','om3d','om2d');
  if(T.stacks)for(const arr of T.stacks.values())arr.forEach(c=>{c.visible=true});
  if(Om3.root)Om3.root.visible=false;Om3.on=false;Om3.anim=[];
  $('#btnPass').hidden=false;
  if(elOm){elOm.hidden=true;lastBoard='';lastBar='';lastHint='';lastModes=''}
};
G.init=()=>{
  const css=document.createElement('style');
  css.textContent=`
.stage.om{background:radial-gradient(ellipse at 50% 38%,#f3e4c2 0%,#e2c89a 70%,#d3b27c 100%)}
.stage.om.om2d #cv,.stage.om #dim{visibility:hidden}
.stage.om-intro .actions,.stage.om-intro .myplate,.stage.om-intro #om .om-row{opacity:0;pointer-events:none}
.stage.om .actions,.stage.om .myplate,#om .om-row,#om .om-bar{transition:opacity .35s}
#om.intro .om-bar{opacity:0}
.stage.om3d #om svg{display:none}
.stage.om3d #om .om-hint{flex:0 1 auto;background:rgba(255,250,240,.9);border:1px solid var(--line-strong,#cdb391);border-radius:99px;padding:4px 12px;box-shadow:0 2px 6px -2px rgba(59,42,31,.35)}
.stp.om-seg{flex-wrap:wrap}.stp.om-seg .segrow{flex:1 1 100%;width:100%}.rs-grid .stp.om-seg,.rs-grid .stp.om-full{grid-column:1/-1}
.stage.om .labels{visibility:hidden}
.stage.om .nogl{display:none}
.stage.om.om-over .myplate,.stage.om.om-over .actions{display:none}
.specbar:not([hidden])~#om .om-bar{margin-top:30px}
.stage.om .actions{left:auto}
.stage.om .myplate{max-width:calc(100% - 150px)}
#om{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;gap:6px;padding:8px 10px 82px;pointer-events:none;min-height:0}
#om[hidden]{display:none}
#om .om-bar{min-height:44px;display:flex;flex-wrap:wrap;gap:6px;align-self:flex-start;max-width:calc(100% - 188px);pointer-events:none}
#om .om-p{position:relative;display:flex;align-items:center;gap:6px;padding:4px 10px 5px;border-radius:12px;background:rgba(255,250,240,.92);border:1.5px solid var(--line-strong,#cdb391);font-size:13px;line-height:1.15;white-space:nowrap;max-width:100%}
#om .om-p .dot,.om-m .dot{width:13px;height:13px;border-radius:50%;flex:none;display:inline-block;vertical-align:-2px}
#om .dot.blk{background:#222;box-shadow:0 0 0 2px #fffaf0,0 0 0 3px #555}
#om .dot.wht{background:#f7f2e8;box-shadow:0 0 0 2px #fffaf0,0 0 0 3px #8c7a5b}
#om .dot.non{background:#d9c9aa;box-shadow:0 0 0 2px #fffaf0,0 0 0 3px #b9a37c}
#om .om-p b{font-weight:600;overflow:hidden;text-overflow:ellipsis;max-width:8em}
#om .om-p .w{font-family:var(--f-num,monospace);font-size:13px;font-weight:700;color:#5b4129;min-width:3em;text-align:right}
#om .om-p.low .w{color:#c0281c;animation:omBlink 1s steps(2,start) infinite}
@keyframes omBlink{50%{opacity:.25}}
#om .om-p .st{font-size:12px;color:var(--muted,#7a6550)}
#om .om-p.on{border-color:#c08a17;box-shadow:0 0 0 2px #f2b632}
#om .om-row{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;width:100%;pointer-events:none;min-height:44px}
.stage.om3d #om .om-row{height:44px;min-height:0;flex:none;align-items:flex-start;padding-top:4px;overflow:visible;position:relative;z-index:1}
#om .om-hint:empty{visibility:hidden}
#om .om-hint{flex:1 1 200px;min-width:0;font-size:13px;line-height:1.3;color:#5b4129;text-align:center;min-height:17px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
#om .om-modes{display:flex;gap:4px;pointer-events:auto;flex-wrap:wrap;justify-content:center}
#om .om-m{height:34px;padding:0 12px;border-radius:10px;border:2px solid var(--mustard-edge,#c08a17);background:var(--mustard,#f2b632);color:#3b2a1f;font-family:var(--f-display,inherit);font-size:15px;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
#om .om-bd{position:relative;flex:1;min-height:0;width:100%}
#om svg{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);pointer-events:auto;touch-action:manipulation;user-select:none;-webkit-user-select:none;filter:drop-shadow(0 6px 8px rgba(59,42,31,.35))}
#om .om-co{font-size:.46px;font-weight:700;fill:#6b4a26;text-anchor:middle;dominant-baseline:central;font-family:var(--f-num,monospace)}
@media (max-width:520px){#om .om-p{font-size:12px;padding:3px 8px 4px}#om .om-m{height:32px;padding:0 10px;font-size:14px}#om{padding-bottom:76px}}
`;
  document.head.appendChild(css);
  elOm=document.createElement('div');elOm.id='om';elOm.hidden=true;
  elOm.innerHTML=`<div class="om-bar"></div><div class="om-row"><div class="om-hint" aria-live="polite"></div><div class="om-modes" role="group" aria-label="오프닝 선택"></div></div><div class="om-bd"><svg viewBox="-1.3 -1.3 16.6 16.6" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="오목판"><g id="omMain"></g><g id="omGhost"></g></svg></div>`;
  $('#stage').insertBefore(elOm,$('#fx'));
  elSvg=elOm.querySelector('svg');elMain=elOm.querySelector('#omMain');elGhost=elOm.querySelector('#omGhost');
  elBar=elOm.querySelector('.om-bar');elHint=elOm.querySelector('.om-hint');elModes=elOm.querySelector('.om-modes');
  elSvg.addEventListener('click',onSvgClick);
  elModes.addEventListener('click',e=>{const b=e.target.closest('.om-m');if(!b)return;sendPick(+b.dataset.v)});
  document.addEventListener('keydown',e=>{if(e.code==='Escape'&&pend&&elOm&&!elOm.hidden)cancelPend()});
  window.addEventListener('resize',()=>{fit();Om3.lay=''});
  $('#cv').addEventListener('click',om3Click);
  document.addEventListener('click',e=>{
    const b=e.target.closest('.om-copy');if(!b||!V||!V.o)return;
    const txt=recordText(V),done=ok=>{b.textContent=ok?'복사했습니다':'복사하지 못했습니다';setTimeout(()=>{b.textContent='기보 복사'},1600)};
    try{navigator.clipboard.writeText(txt).then(()=>done(true),()=>done(false))}catch(_){done(false)}
  });
};
G._om3={Om3,IN,introEnd,cellW,pitchOf,get OS(){return OS}};   // 화면 검사용

(window.GAMES=window.GAMES||{}).omok=G;
})();
