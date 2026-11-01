/* ===== 동물장기 게임 모듈 =====
   공통 코드(index.html)가 GAMES.animal의 함수를 불러서 이 게임의 규칙·봇·화면을 그림. 화면 틀은 장기(games/janggi.js)를 따름.
   판: 가로 3칸 × 세로 4칸. 칸 번호 = y*3 + x (x 0~2, y 0 = 선 쪽 끝 줄 … 3 = 후 쪽 끝 줄). 색 0 = 선(먼저 둠), 1 = 후
   말: 1 병아리 2 코끼리 3 기린 4 사자 5 닭, 후는 +8 (0은 빈 칸). 각자 자기 쪽에서 본 왼쪽부터 코끼리·사자·기린, 사자 앞에 병아리
   포로: 잡은 말(닭은 병아리로)은 내 것이 되고, 내 차례에 빈 칸 아무 곳에나 놓을 수 있음(한 수). 사자를 잡으면 이김
   사자 도착: 내 사자가 상대 끝 줄에 닿았을 때 상대 말이 그 칸을 노리지 않으면 바로 승리. 노리고 있으면 계속(상대가 못 잡으면 다음 수 뒤에 승리)
   잡힐 자리로 가는 수도 둘 수 있음(표시 없음). 같은 국면이 3번 나오면 무승부. 둘 수 있는 수가 없으면 패배
   방 설정: 총 시간 tm(분), 추가 시간 inc(초), 선 플레이어 pickfirst(선택이면 방장이 대기실에서 고름). 바로 시작하면 선·후를 바꿈
   손패(hand)는 표시용 값 [0] (공통 코드가 hand가 비면 끝난 사람으로 봄) */
(function(){
const G={id:'animal',name:'동물장기',short:'동물',lead:'사자를 잡거나 끝 줄까지',brand:'동물장기',brandPx:52,maxHi:2,minN:2,noFast:true,firstPick:true};

/* ---------- 규칙 엔진 (방장 엔진·화면·봇·테스트가 같은 함수를 씀) ---------- */
const HIY=1,ZOU=2,KIR=3,LION=4,NIW=5;
const NM=['','병아리','코끼리','기린','사자','닭'];
const CNAME=['선','후'];
const N=12,X=i=>i%3,Y=i=>(i/3)|0,IX=(x,y)=>y*3+x;
const inB=(x,y)=>x>=0&&x<3&&y>=0&&y<4;
const goalY=c=>c?0:3;   // 그 색 사자가 닿으면 이기는 줄 (상대 끝 줄)
/* 움직임: 자기 쪽에서 본 방향 (dy +1 = 앞) */
const DIRS={
  [HIY]:[[0,1]],
  [ZOU]:[[1,1],[-1,1],[1,-1],[-1,-1]],
  [KIR]:[[0,1],[1,0],[-1,0],[0,-1]],
  [LION]:[[0,1],[1,1],[-1,1],[1,0],[-1,0],[0,-1],[1,-1],[-1,-1]],
  [NIW]:[[0,1],[1,1],[-1,1],[1,0],[-1,0],[0,-1]]};
/* ATK[색][말][칸] = 그 말이 그 칸에서 갈 수 있는 칸들 */
const ATK=[[],[]];
for(const c of [0,1])for(let t=1;t<=5;t++){ATK[c][t]=[];for(let i=0;i<N;i++){const o=[];for(const [dx,dy] of DIRS[t]){const x=X(i)+dx,y=Y(i)+(c?-dy:dy);if(inB(x,y))o.push(IX(x,y))}ATK[c][t].push(o)}}
/* 수: f | t<<4. f 0~11 = 판의 칸, 12+말 = 포로 놓기(13 병아리 14 코끼리 15 기린). t 0~11 */
const mF=m=>m&15,mT=m=>(m>>4)&15,mk=(f,t)=>f|(t<<4);
const isDrop=m=>mF(m)>=12;
/* 국면 해시: 32비트 두 줄, 고정 씨앗 (모든 기기에서 같음). 포로는 색·말·몇 번째 */
const Z1=new Int32Array(16*N),Z2=new Int32Array(16*N),ZH1=new Int32Array(2*4*3),ZH2=new Int32Array(2*4*3);let ZS1=0,ZS2=0;
{let s=0x6A09E667;const r=()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return s|0};for(let i=0;i<Z1.length;i++){Z1[i]=r();Z2[i]=r()}for(let i=0;i<ZH1.length;i++){ZH1[i]=r();ZH2[i]=r()}ZS1=r();ZS2=r()}
const zh=(c,t,k)=>(c*4+t)*3+Math.min(2,k);
function newPos(){return {b:new Int8Array(N),hd:[[0,0,0,0],[0,0,0,0]],side:0,lion:[-1,-1],h1:0,h2:0,st:[]}}
function rehash(p){
  let a=0,c=0;
  for(let i=0;i<N;i++){const v=p.b[i];if(v){a^=Z1[v*N+i];c^=Z2[v*N+i];if((v&7)===LION)p.lion[v>>3]=i}}
  for(const col of [0,1])for(let t=1;t<=3;t++)for(let k=0;k<p.hd[col][t];k++){a^=ZH1[zh(col,t,k)];c^=ZH2[zh(col,t,k)]}
  if(p.side){a^=ZS1;c^=ZS2}p.h1=a;p.h2=c;
}
function clonePos(p){const q=newPos();q.b.set(p.b);q.hd=[p.hd[0].slice(),p.hd[1].slice()];q.side=p.side;q.lion=p.lion.slice();q.h1=p.h1;q.h2=p.h2;return q}
function startPos(){
  const p=newPos(),put=(x,y,t,c)=>{p.b[IX(x,y)]=t|(c<<3)};
  put(0,0,ZOU,0);put(1,0,LION,0);put(2,0,KIR,0);put(1,1,HIY,0);   // 선: 자기 쪽 왼쪽부터 코끼리·사자·기린
  put(2,3,ZOU,1);put(1,3,LION,1);put(0,3,KIR,1);put(1,2,HIY,1);   // 후: 판을 돌린 같은 모양
  rehash(p);return p;
}
/* sq가 by 쪽 말에게 노려지나 */
function attacked(p,sq,by){
  const b=p.b;
  for(let i=0;i<N;i++){const v=b[i];if(!v||(v>>3)!==by)continue;if(ATK[by][v&7][i].includes(sq))return true}
  return false;
}
/* 둘 수 있는 수 (사자를 잡힐 자리로 보내는 수도 됨) */
function gen(p,out){
  const b=p.b,us=p.side;
  for(let i=0;i<N;i++){
    const v=b[i];if(!v||(v>>3)!==us)continue;
    for(const t of ATK[us][v&7][i]){const q=b[t];if(!q||(q>>3)!==us)out.push(mk(i,t))}
  }
  for(let t=1;t<=3;t++)if(p.hd[us][t])for(let i=0;i<N;i++)if(!b[i])out.push(mk(12+t,i));
  return out;
}
const legal=p=>gen(p,[]);
/* 수 두기·되돌리기. 병아리가 상대 끝 줄에 닿으면 닭, 잡은 닭은 병아리로 포로 */
function make(p,m){
  const b=p.b,us=p.side,them=us^1,f=mF(m),t=mT(m);
  let a=p.h1,c=p.h2,cap=0,prom=0;
  if(f>=12){
    const k=f-12,n=--p.hd[us][k];a^=ZH1[zh(us,k,n)];c^=ZH2[zh(us,k,n)];
    const v=k|(us<<3);b[t]=v;a^=Z1[v*N+t];c^=Z2[v*N+t];
  }else{
    const pc=b[f];cap=b[t];
    if(cap){
      a^=Z1[cap*N+t];c^=Z2[cap*N+t];
      const ct=cap&7;
      if(ct===LION)p.lion[them]=-1;
      else{const k=ct===NIW?HIY:ct,n=p.hd[us][k]++;a^=ZH1[zh(us,k,n)];c^=ZH2[zh(us,k,n)]}
    }
    let np=pc;
    if((pc&7)===HIY&&Y(t)===goalY(us)){np=NIW|(us<<3);prom=1}
    a^=Z1[pc*N+f];c^=Z2[pc*N+f];a^=Z1[np*N+t];c^=Z2[np*N+t];
    b[f]=0;b[t]=np;if((pc&7)===LION)p.lion[us]=t;
  }
  p.st.push(m,cap,prom,p.h1,p.h2);
  p.side=them;p.h1=a^ZS1;p.h2=c^ZS2;
}
function unmake(p){
  const st=p.st,n=st.length,h2=st[n-1],h1=st[n-2],prom=st[n-3],cap=st[n-4],m=st[n-5];st.length=n-5;
  p.side^=1;p.h1=h1;p.h2=h2;
  const b=p.b,us=p.side,them=us^1,f=mF(m),t=mT(m);
  if(f>=12){p.hd[us][f-12]++;b[t]=0;return}
  let pc=b[t];if(prom)pc=HIY|(us<<3);
  b[f]=pc;b[t]=cap;if((pc&7)===LION)p.lion[us]=f;
  if(cap){const ct=cap&7;if(ct===LION)p.lion[them]=t;else p.hd[us][ct===NIW?HIY:ct]--}
}
/* 수를 둔 뒤의 끝 판정 (p.side는 이제 상대). 돌려줌: null 계속, {w:이긴 색, why} */
function judge(p,cap){
  const mover=p.side^1,opp=p.side;
  if(cap&&(cap&7)===LION)return {w:mover,why:'lion'};
  const ol=p.lion[opp];if(ol>=0&&Y(ol)===goalY(opp))return {w:opp,why:'try'};   // 끝 줄에 닿은 상대 사자를 잡지 못함
  const ml=p.lion[mover];if(ml>=0&&Y(ml)===goalY(mover)&&!attacked(p,ml,opp))return {w:mover,why:'try'};
  return null;
}
const lastCap=p=>p.st.length?p.st[p.st.length-4]:0;
const lionAttacked=p=>{const l=p.lion[p.side];return l>=0&&attacked(p,l,p.side^1)};
const repKey=p=>(p.h1>>>0).toString(36)+'.'+(p.h2>>>0).toString(36);
const REP=3;   // 같은 국면이 이만큼 나오면 무승부
const toU=m=>String(mF(m)).padStart(2,'0')+String(mT(m)).padStart(2,'0');
function fromU(p,u,ls){
  if(typeof u!=='string'||u.length!==4)return 0;
  const m=mk(+u.slice(0,2),+u.slice(2,4));
  return (ls||legal(p)).includes(m)?m:0;
}
/* 기보를 처음부터 다시 두어 지금 국면과 반복 횟수를 만듦 */
function replay(ucis){
  const p=startPos(),reps={};
  const bump=()=>{const k=repKey(p);reps[k]=(reps[k]||0)+1};
  bump();
  for(const u of ucis||[]){const m=fromU(p,u);if(!m)break;make(p,m);p.st.length=0;bump()}
  return {p,reps};
}
/* 사람이 읽는 수 이름 (진행 기록용): 칸은 선 쪽에서 본 A~C 세로줄 + 1~4 줄 */
const sqName=i=>'ABC'[X(i)]+(Y(i)+1);
function moveName(p,m){
  const f=mF(m),t=mT(m);
  if(f>=12)return `${NM[f-12]} ${sqName(t)}에 놓기`;
  const v=p.b[f],c=p.b[t],prom=(v&7)===HIY&&Y(t)===goalY(v>>3);
  return `${NM[v&7]} ${sqName(f)}→${sqName(t)}${c?` (${NM[c&7]} 잡음)`:''}${prom?' · 닭':''}`;
}

/* ---------- 봇: 알파-베타 + 기억표. 쉬움 2수·흔들림 큼, 보통 4수·작은 흔들림, 어려움 끝까지(수 상한·시간 상한) ---------- */
let BOTSCALE=1;   // 테스트에서 탐색 양을 줄임
const WIN=100000;
const PVAL=[0,100,320,380,0,420],HV=[0,120,350,420];   // 판 위 말·포로의 값 (포로는 어디든 놓을 수 있어 조금 더)
function evalPos(p){   // 둘 차례인 쪽 기준
  const b=p.b,us=p.side;let s=0;
  for(let i=0;i<N;i++){
    const v=b[i];if(!v)continue;
    const t=v&7,col=v>>3,sg=col===us?1:-1;let e=PVAL[t];
    const adv=col?3-Y(i):Y(i);
    if(t===HIY)e+=adv*12;
    else if(t===LION)e+=adv*18;
    e+=ATK[col][t][i].length*4;
    s+=sg*e;
  }
  for(let t=1;t<=3;t++)s+=(p.hd[us][t]-p.hd[us^1][t])*HV[t];
  // 사자 둘레: 노리는 상대 말 수만큼 위험
  for(const col of [0,1]){const l=p.lion[col];if(l<0)continue;let k=0;for(const n of ATK[col][LION][l])if(attacked(p,n,col^1))k++;s+=(col===us?-1:1)*k*10}
  return s;
}
/* 이 수가 상대 사자를 잡나 */
const capsLion=(p,m)=>!isDrop(m)&&(p.b[mT(m)]&7)===LION;
function orderMoves(p,ms,best){
  const sc=m=>{if(m===best)return 1e6;if(isDrop(m))return 10;const c=p.b[mT(m)];return c?PVAL[c&7]*10+1000-PVAL[p.b[mF(m)]&7]:((p.b[mF(m)]&7)===LION?20:30)};
  return ms.map(m=>[sc(m),m]).sort((a,c)=>c[0]-a[0]).map(x=>x[1]);
}
function search(p,d,alpha,beta,ply,ctx){
  ctx.n++;
  if(ctx.n>ctx.max||(ctx.n&1023)===0&&ctx.deadline&&Date.now()>ctx.deadline){ctx.stop=true;return 0}
  const us=p.side,them=us^1,ms=gen(p,[]);
  for(const m of ms)if(capsLion(p,m))return WIN-ply;   // 사자를 잡을 수 있으면 이김
  const ol=p.lion[them];if(ol>=0&&Y(ol)===goalY(them))return -(WIN-ply);   // 끝 줄 상대 사자를 못 잡음
  if(!ms.length)return -(WIN-ply);
  const key=repKey(p);
  if(ply>0&&(ctx.path[key]||(ctx.reps&&ctx.reps[key]>=REP-1)))return 0;   // 되풀이는 비김으로
  if(d<=0)return evalPos(p);
  const tt=ctx.tt.get(key);let best=0;
  if(tt){best=tt.m;if(tt.d>=d){let v=tt.v;if(v>WIN-500)v-=ply;else if(v<-WIN+500)v+=ply;if(tt.f===0)return v;if(tt.f===1&&v>=beta)return v;if(tt.f===2&&v<=alpha)return v}}
  const a0=alpha;let bv=-WIN*2,bm=0;
  ctx.path[key]=1;
  for(const m of orderMoves(p,ms,best)){
    make(p,m);
    const ml=p.lion[us];
    const v=ml>=0&&Y(ml)===goalY(us)&&!attacked(p,ml,them)?WIN-ply-1:-search(p,d-1,-beta,-alpha,ply+1,ctx);
    unmake(p);
    if(ctx.stop){delete ctx.path[key];return 0}
    if(v>bv){bv=v;bm=m}
    if(v>alpha)alpha=v;
    if(alpha>=beta)break;
  }
  delete ctx.path[key];
  let sv=bv;if(sv>WIN-500)sv+=ply;else if(sv<-WIN+500)sv-=ply;
  ctx.tt.set(key,{d,v:sv,m:bm,f:bv<=a0?2:bv>=beta?1:0});
  return bv;
}
const LV=[{d:2,noise:160,wild:.15},{d:4,noise:40,wild:0},{d:30,noise:0,wild:0,max:400000,ms:600}];
/* 봇이 고르는 수: 사자를 잡거나 도착할 수 있으면 바로, 아니면 탐색 점수 + 흔들림 */
function botPick(p,lv,reps){
  const L=LV[lv]||LV[1],ms=legal(p);if(!ms.length)return 0;
  const us=p.side,them=us^1;
  for(const m of ms)if(capsLion(p,m))return m;
  for(const m of ms){make(p,m);const ml=p.lion[us],ok=ml>=0&&Y(ml)===goalY(us)&&!attacked(p,ml,them);unmake(p);if(ok)return m}
  const ctx={n:0,max:Math.round((L.max||60000)*BOTSCALE)+500,tt:new Map(),path:{[repKey(p)]:1},reps,stop:false,deadline:L.ms?Date.now()+L.ms*Math.max(.05,BOTSCALE):0};
  const root=shuffleArr(ms.slice());
  let sc=root.map(m=>[m,0]);
  const maxD=L.d;
  for(let d=1;d<=maxD;d++){
    const cur=[];let alpha=-WIN*2;
    const ord=d>1?sc.slice().sort((a,c)=>c[1]-a[1]).map(x=>x[0]):root;
    for(const m of ord){
      make(p,m);
      const key=repKey(p),rp=reps&&reps[key]>=REP-1;
      // 흔들림을 쓰는 단계는 모든 수의 점수가 필요하므로 창을 넓게, 어려움은 좁게
      const v=rp?0:-search(p,d-1,-WIN*2,L.noise?WIN*2:-alpha,1,ctx);
      unmake(p);
      if(ctx.stop)break;
      cur.push([m,v]);if(v>alpha)alpha=v;
    }
    if(ctx.stop&&cur.length<ord.length){if(cur.length){const top=cur.reduce((a,x)=>x[1]>a[1]?x:a);sc=sc.map(x=>x[0]===top[0]?[x[0],top[1]+1]:x);sc.sort((a,c)=>c[1]-a[1])}break}
    sc=cur;
    if(Math.abs(alpha)>WIN-500)break;   // 이기고 지는 길이 정해짐
  }
  const top=Math.max(...sc.map(x=>x[1]));
  if(L.wild&&Math.random()<L.wild){const ok=sc.filter(x=>x[1]>top-250);if(ok.length)return ok[Math.random()*ok.length|0][0]}
  let bm=sc[0][0],bv=-Infinity;
  for(const [m,v] of sc){const w=Math.abs(v)>WIN-500?v:v+(Math.random()*2-1)*L.noise;if(w>bv){bv=w;bm=m}}
  return bm;
}
function shuffleArr(a){for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a}

/* ---------- 규칙 설명·방 설정 ---------- */
G.rulesHTML='<ol class="rules"><li><b>목표</b> : 상대 <b>사자</b>를 잡거나, 내 사자가 상대 끝 줄에 닿으면 이깁니다. 끝 줄에 닿은 순간 상대 말이 그 칸을 노리고 있으면 아직 이긴 것이 아니고, 상대가 다음 수에 잡지 못하면 이깁니다</li><li><b>판과 말</b> : 가로 3칸 × 세로 4칸 판에서 각자 네 말로 합니다. 내 쪽 끝 줄 왼쪽부터 코끼리·사자·기린, 사자 앞에 병아리가 섭니다</li><li><b>움직임</b> : 한 번에 한 칸. 코끼리는 대각선, 기린은 앞뒤·옆, 사자는 모든 방향, 병아리는 앞으로만 갑니다. 말에 찍힌 점이 갈 수 있는 방향입니다</li><li><b>닭</b> : 병아리가 상대 끝 줄에 닿으면 닭이 됩니다. 닭은 앞·앞 대각선·옆·뒤로 한 칸 갑니다(뒤 대각선은 못 감)</li><li><b>포로</b> : 상대 말을 잡으면 내 포로가 됩니다(닭은 병아리로). 내 차례에 포로 하나를 판의 빈 칸 아무 곳에나 놓을 수 있고, 이것이 한 수입니다. 놓은 병아리는 끝 줄에 놓아도 닭이 되지 않습니다</li><li><b>사자</b> : 사자를 잡힐 자리로 옮겨도 됩니다. 상대가 잡으면 집니다</li><li><b>무승부</b> : 같은 국면(판·포로·차례)이 세 번 나오면 무승부입니다</li><li><b>시계</b> : 두 사람이 각자의 총 시간을 씁니다. 한 수를 둘 때마다 추가 시간이 붙고, 총 시간을 다 쓰면 <b>패배</b>합니다. 연결이 끊겨도 시계는 흐르고, 45초 안에 돌아오지 않으면 탈주로 처리합니다</li><li><b>선 플레이어</b> : 첫 판은 탁자 설정으로 정합니다(무작위면 주사위, 선택이면 방장이 대기실에서 고름). 결과 화면에서 바로 시작하면 선·후를 바꿉니다</li><li><b>조작</b> : 내 말이나 포로를 누르면 갈 수 있는 칸이 보입니다. 칸을 누르면 미리 보기, <b>[두기]</b>로 확정합니다. 설정의 <b>두 번 눌러 놓기</b>를 켜면 같은 칸을 한 번 더 눌러 바로 둡니다. 상대 차례에도 미리 골라 둘 수 있습니다</li></ol>';
G.modeDesc=['사자를 잡으면 끝','사자를 잡으면 끝'];
const clockTxt=c=>`${+c.tm||3}+${+c.inc||0}`;
G.defaults={max:2,turn:30,tm:3,inc:2,pickfirst:0};
G.roomSet=[
  {k:'tm',label:'총 시간',unit:'분',lo:1,hi:30,step:1,desc:'한 사람이 쓸 수 있는 전체 시간입니다. 다 쓰면 패배합니다'},
  {k:'inc',label:'추가 시간',unit:'초',lo:0,hi:30,step:1,desc:'한 수를 둘 때마다 늘어나는 시간입니다'}];
G.ruleSet=[
  {k:'pickfirst',pick:1,label:'선 플레이어',desc:'선택: 방장이 대기실에서 먼저 두는 사람을 고릅니다. 무작위: 주사위로 정하고, 바로 시작하면 선·후를 바꿉니다'}];
G.cfgChips=c=>`<span class="chip">시계 <b>${clockTxt(c)}</b></span><span class="chip">선 <b>${+c.pickfirst?'선택':'무작위'}</b></span>`;
G.cfgSum=c=>`시계 ${+c.tm||3}분 + ${+c.inc||0}초 · 선 ${+c.pickfirst?'선택':'무작위'}`;
G.roomSub=()=>'2명 보드게임';
G.pubExtra=()=>({});
G.cardInfo=(c,nowN)=>`<p class="cardinfo">${nowN>2?'동물장기는 두 명이 하는 게임입니다.':'두 명이 하는 게임입니다.'}</p>`;
G.rankTitle=()=>'';
G.finLabel=()=>'';
G.noEmotes=[];
G.keys={};
G.keyActions=[];
G.cardHTML=()=>'';G.drawFace=()=>{};G.cmpCard=()=>0;G.labelOf=()=>'';

/* ---------- 방장 엔진 (규칙 처리) ----------
   H.c: 저장할 수 있는 값만 둠(JSON). 지금 국면은 기보 mv를 다시 두어 만들고 HC에 기억 */
const BOT_CAP=300;   // 봇끼리 둘 때 비김으로 끝내는 수(반 수)
const HC={c:null,n:-1,p:null,reps:null};
function hostPos(){
  const C=H.c;
  if(HC.c!==C||HC.n!==C.mv.length){const r=replay(C.mv);HC.c=C;HC.n=C.mv.length;HC.p=r.p;HC.reps=r.reps}
  return HC.p;
}
const other=i=>1-i;
const seatOfColor=col=>H.c.co[0]===col?0:1;
function sameNames(a,b){return a.length===2&&b.length===2&&a.every(x=>b.includes(x))&&a[0]!==a[1]}
/* 첫 판 선: 결과 화면에서 바로 시작하면 지난 판과 바꿈, 아니면 공통 firstSeat (선택이면 방장이 고른 사람, 아니면 랜덤) */
function pickFirst(again){
  const ns=H.players.slice(0,2).map(p=>p.name),L=H.dzLast;
  if(again&&L&&L.ns&&sameNames(ns,L.ns))return ns.indexOf(L.h);
  return typeof firstSeat==='function'?firstSeat(2):(Math.random()<.5?0:1);
}
function botDelay(){return rand(500,1300)}
function setMover(to,inc){
  const C=H.c,t=clock(),from=C.mv_;
  const cur=H.players[from];
  if(cur&&!cur.bot)C.rem[from]=Math.max(0,C.rem[from]-Math.max(0,t-C.since));   // 사람이 쓴 시간만 깎음
  if(inc&&from!==to&&cur&&!cur.bot)C.rem[from]+=C.R.inc*1000;
  C.mv_=to;H.turn=to;C.since=t;
  const nx=H.players[to];C.mvBot=nx&&nx.bot?1:0;
  H.botActAt=nx&&nx.bot?t+botDelay():0;
  mark();
}
function finishGame(winSeat,why){
  const C=H.c;
  C.res={w:winSeat,why:why||''};
  if(winSeat>=0){
    const l=other(winSeat),pw=H.players[winSeat],pl=H.players[l];
    pw.finished=true;pw.rank=1;pw.hand=[];
    pl.finished=true;pl.rank=2;pl.hand=[];
    if(why==='time')pl.surrendered='time';else if(why==='surrender'||why==='desert')pl.surrendered=true;
    addLog(why==='time'?`${pl.name} 시간 초과로 패배! ${pw.name} 승리`:why==='surrender'||why==='desert'?`${pl.name} ${why==='desert'?'탈주':'항복'}! ${pw.name} 승리`:why==='lion'?`사자를 잡았습니다! ${pw.name} 승리`:why==='try'?`사자 도착! ${pw.name} 승리`:`${pw.name} 승리`,why==='lion'||why==='try'?'fin':'lie');
  }else{
    for(const i of [0,1]){const p=H.players[i];p.finished=true;p.rank=1;p.hand=[]}
    addLog(`무승부입니다. (${WHY_SHORT[why]||''})`,'sys');
  }
  H.dzLast={ns:H.players.slice(0,2).map(p=>p.name),h:H.players[seatOfColor(1)].name};   // 바로 시작하면 지난 판의 후가 선
  H.phase='over';H.botActAt=0;mark();
  H.players.forEach((p,i)=>{if(p.bot&&i<2&&Math.random()<.5)botEmote(i,'gg',800+Math.random()*1600)});
}
/* 한 수: 기보에 더하고 끝 판정 */
function doMove(seat,u){
  const C=H.c,p=hostPos();
  if(C.co[seat]!==p.side)return false;
  const ls=legal(p),m=fromU(p,u,ls);if(!m)return false;
  const name=moveName(p,m);
  make(p,m);const cap=lastCap(p);p.st.length=0;
  C.mv.push(toU(m));HC.n=C.mv.length;
  const k=repKey(p);HC.reps[k]=(HC.reps[k]||0)+1;
  C.lm=[mF(m),mT(m)];C.att=lionAttacked(p)?1:0;
  addLog(`${C.mv.length}. ${H.players[seat].name} ${name}`);
  const j=judge(p,cap);
  if(j){finishGame(seatOfColor(j.w),j.why);return true}
  if(HC.reps[k]>=REP){finishGame(-1,'rep');return true}
  if(!legal(p).length){finishGame(seat,'stuck');return true}
  if(C.mv.length>=BOT_CAP&&H.players[0].bot&&H.players[1].bot&&!awayHuman(H.players[0])&&!awayHuman(H.players[1])){finishGame(-1,'long');return true}
  setMover(other(seat),true);
  return true;
}
function doSurrender(seat){
  if(H.phase!=='play'||seat<0||seat>1||H.players[seat].finished)return;
  finishGame(other(seat),H.players[seat].deserter?'desert':'surrender');
}
function timeout(){const C=H.c;finishGame(other(C.mv_),'time')}
function botTurn(i){
  const C=H.c,p=hostPos(),m=botPick(p,botLv(H.players[i]),HC.reps);
  if(!m||!doMove(i,toU(m)))finishGame(other(i),'stuck');
}
G._test={startPos,legal,gen,make,unmake,attacked,judge,lastCap,repKey,replay,toU,fromU,moveName,evalPos,botPick,setBotScale:f=>{BOTSCALE=f},doMove,timeout,pickFirst,IX,X,Y,mk,HIY,ZOU,KIR,LION,NIW,newPos,rehash,clonePos,lionAttacked};
G.engine={
  start(){
    const again=H.phase==='over',R={tm:Math.max(1,+H.cfg.tm||3),inc:Math.max(0,+H.cfg.inc||0)};
    Object.assign(H,{phase:'play',log:[],seatNote:{},field:[],last:null,reveal:null,shouts:[],pending:null,rankNext:1,known:{}});
    H.players.forEach((p,i)=>{
      p.finished=false;p.rank=null;p.surrendered=false;
      if(i<2)p.hand=[0];else{p.hand=[];p.finished=true;p.rank=i+1}
    });
    const A=pickFirst(again),t=clock();
    H.c={R,A,co:A===0?[0,1]:[1,0],mv:[],lm:null,att:0,mv_:A,rem:[R.tm*60000,R.tm*60000],since:t,mvBot:0,res:null};
    HC.c=null;H.turn=A;
    H.botActAt=H.players[A].bot?t+rand(900,1600):0;
    addLog(`${H.players[A].name}님이 먼저 시작합니다.`,'sys');
    mark();
  },
  act(seat,a){
    if(a.t==='surrender'){doSurrender(seat);return}
    const C=H.c;
    if(!C||H.phase!=='play'||seat<0||seat>1)return;
    if(a.t==='mv'&&C.mv_===seat&&typeof a.u==='string')doMove(seat,a.u);
  },
  tick(t){
    const C=H.c;
    if(!C||H.phase!=='play')return;
    const p=H.players[C.mv_];if(!p)return;
    if(p.bot&&!awayHuman(p)){
      if(!C.mvBot){C.rem[C.mv_]=Math.max(0,C.rem[C.mv_]-Math.max(0,t-C.since));C.mvBot=1}
      C.since=t;
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
    s.c={mv:C.mv.slice(),A:C.A,co:C.co.slice(),lm:C.lm?C.lm.slice():null,att:C.att,rem,run,hold:run?Math.max(0,Math.round(C.since-t)):0,R:{...C.R},res:C.res?{...C.res}:null};
    s.gr=0;s.dl=rem[C.mv_];
  },
  restore(ms){if(H.c&&ms)H.c.since+=ms},
  emoPhase:ph=>ph==='play'||ph==='over'
};

/* ---------- 화면 (모든 참가자) ----------
   2D(SVG)와 3D(공통 테이블 가운데 원목 판 + 네모 타일 말)는 같은 상태(CS)를 보고 그림. 후를 잡으면 판을 돌려 내 말이 늘 아래.
   말 타일은 자기 쪽에서 앞이 위: 내 말은 화면 위를, 상대 말은 화면 아래를 봄. 테두리 색 = 주인 자리 색(주사위 면과 같음) */
const SEAT_C=['#c53026','#2b65ca'];   // 자리 색 (첫 차례 주사위 면과 같음: DicePick.SEAT_COL 앞 둘)
let CS=null,sel=-1,pend=null,msg='',msgUntil=0,msgTimer=null,flash=null;   // sel: 고른 칸(0~11) 또는 포로(12+말), pend: 미리 보기 수 {m,from,to}
let elDz=null,elSvg=null,elMain=null,elGhost=null,elBar=null,elBarMe=null,elHint=null,lastBoard='',lastBar='',lastHint='';
const OC={at:0,mk:'',ms:[]};   // OC.at: 상태를 받은 시각, ms: 내가 둘 수 있는 수
function buildS(c){const r=replay(c.mv);return {p:r.p,reps:r.reps,co:c.co,A:c.A,lm:c.lm,att:c.att,rem:c.rem,run:c.run,hold:c.hold,res:c.res,mv:c.mv||[],R:c.R||{}}}
const myCol=()=>{const me=myIdx();return me>=0&&me<2&&CS?CS.co[me]:-1};
const viewCol=()=>{const c=myCol();return c<0?0:c};   // 관전자는 선 쪽에서 봄
const flipped=()=>myCol()===1;   // 후를 잡으면 판을 돌림
const seatOfCol=col=>CS&&CS.co[0]===col?0:1;
const colC=col=>SEAT_C[seatOfCol(col)];
const myTurnNow=()=>!!(V&&V.c&&V.st==='play'&&myReady());
const dblOn=()=>typeof dblTap!=='undefined'&&!!dblTap;
function say(txt){msg=txt;msgUntil=Date.now()+2400;drawHint();clearTimeout(msgTimer);msgTimer=setTimeout(drawHint,2500)}
function remMs(i){
  const c=V&&V.c;if(!c)return 0;
  let v=c.rem[i];
  if(V.st==='play'&&c.run&&V.t===i){const e=clock()-OC.at-(c.hold||0);if(e>0)v-=e}
  return Math.max(0,v);
}
function fmtT(ms){
  if(ms<10000&&ms>0){return (Math.floor(ms/100)/10).toFixed(1)}
  const s=Math.ceil(ms/1000),m=Math.floor(s/60);return m+':'+String(s%60).padStart(2,'0');
}
/* 미리 고를 수 있나: 둘 차례, 또는 상대 차례(내 색으로 미리 골라 둠) */
const canPre=()=>{const me=myIdx();return !!(V&&V.c&&CS&&V.st==='play'&&me>=0&&me<2&&!introWait()&&!(V.ps[me]&&V.ps[me].f))};
function myMoves(){
  if(!canPre())return [];
  const col=myCol(),k=V.c.mv.length+'|'+col;
  if(OC.mk!==k){
    OC.mk=k;let p=CS.p;
    if(p.side!==col){p=clonePos(CS.p);p.side=col}
    OC.ms=legal(p);
  }
  return OC.ms;
}
const movesFrom=f=>myMoves().filter(m=>mF(m)===f);
const pcAt=sq=>CS?CS.p.b[sq]:0;
const isMine=v=>v&&(v>>3)===myCol();
/* 칸을 눌렀을 때: 내 말이면 고르고(다시 누르면 내려놓음), 갈 수 있는 칸이면 미리 보기, 미리 보기 칸을 다시 누르면 두 번 눌러 놓기면 둠 */
function tapSq(sq){
  if(!V||!V.c||V.st!=='play'||!CS)return;
  if(sq<0||sq>=N)return;
  if(!canPre()){sndNo();return}
  const v=pcAt(sq),mine=myTurnNow();
  if(pend&&pend.to===sq){if(dblOn()&&mine)confirmPend();else{pend=null;sndLift(.08);redraw()}return}
  if(sel>=0){
    const m=movesFrom(sel).find(m=>mT(m)===sq);
    if(m){pend={m,from:sel,to:sq};sndLift(.1);redraw();return}
  }
  if(isMine(v)){
    if(sel===sq&&!pend){sel=-1;sndLift(.06);redraw();return}
    if(!movesFrom(sq).length){sel=-1;pend=null;flash={sq:[sq],at:clock()};sndNo();redraw();return}
    sel=sq;pend=null;sndLift(.14);redraw();return;
  }
  sndNo();
}
/* 포로를 눌렀을 때 (t: 말 종류) */
function tapHand(t){
  if(!V||!V.c||V.st!=='play'||!CS)return;
  if(!canPre()){sndNo();return}
  const f=12+t;
  if(!CS.p.hd[myCol()][t]){sndNo();return}
  if(sel===f&&!pend){sel=-1;sndLift(.06);redraw();return}
  sel=f;pend=null;sndLift(.14);redraw();
}
function confirmPend(){
  if(!pend||!myTurnNow())return;
  const m=pend.m;
  if(!legal(CS.p).includes(m)){pend=null;sel=-1;sndNo();redraw();return}   // 상대 차례에 골라 둔 수는 지금 국면에서 다시 확인
  pend=null;sel=-1;
  sendAct({t:'mv',u:toU(m)});redraw();
}
function cancelSel(){if(pend){pend=null}else sel=-1;redraw()}
function redraw(){msgUntil=0;drawAll();G.buttons();Dz3.dirty=true;d3Marks()}
/* 소리: 타일을 드는 소리(나무 톡), 놓는 소리(딱), 잡는 소리, 닭이 되는 소리 */
function sndLift(vol){tone(1100,.03,{type:'triangle',vol:vol*.5});hiss(.02,{freq:3400,q:3,vol:vol*.4})}
function sndNo(){sfx('no')}
function sndPut(at,cap){hiss(.03,{freq:2400,q:2.5,vol:.22,at});tone(700,.05,{type:'triangle',vol:.13,at});tone(220,.08,{type:'sine',vol:.1,at:at+.004});if(cap){hiss(.05,{freq:4200,q:4,vol:.14,at:at+.035});tone(1040,.04,{type:'triangle',vol:.07,at:at+.035})}}
function sndLand(k,at){at=at||0;const f=1.3-k*.1;hiss(.03,{freq:2600*f,q:2,vol:.13+k*.02,at});tone(620*f,.05+k*.012,{type:'triangle',vol:.09+k*.012,at});tone(220*f,.08+k*.02,{type:'sine',vol:.07+k*.02,at:at+.004});if(k>=3){tone(100,.22,{type:'sine',vol:.2,at:at+.01});hiss(.12,{freq:420,vol:.12,at})}}
function sndProm(at){tone(880,.07,{type:'triangle',vol:.08,at});tone(1320,.12,{type:'triangle',vol:.08,at:at+.08})}

/* ----- 타일 그림 (3D 윗면·2D 판이 같은 그림): 크림색 바탕, 주인 색 테두리, 가운데 동물, 갈 수 있는 방향 점. 캔버스 위쪽 = 말의 앞 ----- */
function drawTile(g,w,h,t,oc){
  const r=w*.12;
  g.fillStyle='#f6ecd2';g.beginPath();g.moveTo(r,0);g.arcTo(w,0,w,h,r);g.arcTo(w,h,0,h,r);g.arcTo(0,h,0,0,r);g.arcTo(0,0,w,0,r);g.closePath();g.fill();
  g.strokeStyle=oc;g.lineWidth=w*.055;const q=w*.045,rr=r*.75;g.beginPath();g.moveTo(q+rr,q);g.arcTo(w-q,q,w-q,h-q,rr);g.arcTo(w-q,h-q,q,h-q,rr);g.arcTo(q,h-q,q,q,rr);g.arcTo(q,q,w-q,q,rr);g.closePath();g.stroke();
  g.fillStyle=oc;
  for(const [dx,dy] of DIRS[t]){g.beginPath();g.arc(w/2+dx*w*.355,h/2-dy*h*.355,w*.042,0,7);g.fill()}
  drawAnimal(g,w/2,h/2+h*.01,w*.27,t);
}
const C_=(g,x,y,r,f)=>{g.fillStyle=f;g.beginPath();g.arc(x,y,r,0,7);g.fill()};
const E_=(g,x,y,rx,ry,f,rot)=>{g.fillStyle=f;g.beginPath();g.ellipse(x,y,rx,ry,rot||0,0,7);g.fill()};
function eyes(g,x,y,d,r){C_(g,x-d,y,r,'#2a1a10');C_(g,x+d,y,r,'#2a1a10');C_(g,x-d+r*.35,y-r*.35,r*.35,'#fff');C_(g,x+d+r*.35,y-r*.35,r*.35,'#fff')}
function drawAnimal(g,x,y,R,t){
  g.save();g.lineCap='round';g.lineJoin='round';
  if(t===LION){
    for(let k=0;k<14;k++){const a=k/14*Math.PI*2;C_(g,x+Math.cos(a)*R*.86,y+Math.sin(a)*R*.86,R*.3,'#c8702a')}
    C_(g,x,y,R*.9,'#d98234');
    C_(g,x-R*.5,y-R*.52,R*.17,'#f0c066');C_(g,x+R*.5,y-R*.52,R*.17,'#f0c066');
    C_(g,x,y,R*.62,'#f4c86e');
    E_(g,x,y+R*.24,R*.3,R*.2,'#fbe6b8');
    eyes(g,x,y-R*.1,R*.24,R*.075);
    g.fillStyle='#5a3018';g.beginPath();g.moveTo(x-R*.1,y+R*.1);g.lineTo(x+R*.1,y+R*.1);g.lineTo(x,y+R*.22);g.closePath();g.fill();
    g.strokeStyle='#5a3018';g.lineWidth=R*.05;g.beginPath();g.moveTo(x,y+R*.22);g.lineTo(x,y+R*.3);g.moveTo(x-R*.12,y+R*.34);g.quadraticCurveTo(x,y+R*.3,x+R*.12,y+R*.34);g.stroke();
  }else if(t===ZOU){
    E_(g,x-R*.62,y-R*.02,R*.42,R*.56,'#8b98bf');E_(g,x+R*.62,y-R*.02,R*.42,R*.56,'#8b98bf');
    E_(g,x-R*.62,y,R*.27,R*.38,'#b3a6c9');E_(g,x+R*.62,y,R*.27,R*.38,'#b3a6c9');
    C_(g,x,y-R*.12,R*.52,'#a3afd3');
    g.strokeStyle='#a3afd3';g.lineWidth=R*.28;g.beginPath();g.moveTo(x,y+R*.12);g.quadraticCurveTo(x+R*.02,y+R*.62,x+R*.24,y+R*.78);g.stroke();
    g.strokeStyle='#fffaf0';g.lineWidth=R*.07;g.beginPath();g.moveTo(x-R*.2,y+R*.22);g.quadraticCurveTo(x-R*.26,y+R*.38,x-R*.16,y+R*.46);g.moveTo(x+R*.2,y+R*.22);g.quadraticCurveTo(x+R*.26,y+R*.36,x+R*.34,y+R*.4);g.stroke();
    eyes(g,x,y-R*.2,R*.22,R*.07);
  }else if(t===KIR){
    g.strokeStyle='#c48a2c';g.lineWidth=R*.1;g.beginPath();g.moveTo(x-R*.18,y-R*.4);g.lineTo(x-R*.26,y-R*.86);g.moveTo(x+R*.18,y-R*.4);g.lineTo(x+R*.26,y-R*.86);g.stroke();
    C_(g,x-R*.26,y-R*.88,R*.11,'#7a4a1a');C_(g,x+R*.26,y-R*.88,R*.11,'#7a4a1a');
    E_(g,x-R*.5,y-R*.42,R*.24,R*.1,'#e2a83a',-.4);E_(g,x+R*.5,y-R*.42,R*.24,R*.1,'#e2a83a',.4);
    E_(g,x,y-R*.02,R*.44,R*.6,'#f0c040');
    C_(g,x-R*.24,y-R*.32,R*.09,'#c47a2a');C_(g,x+R*.25,y-R*.18,R*.08,'#c47a2a');C_(g,x-R*.3,y+R*.06,R*.07,'#c47a2a');C_(g,x+R*.12,y-R*.42,R*.06,'#c47a2a');
    E_(g,x,y+R*.36,R*.32,R*.22,'#f7dfa4');
    C_(g,x-R*.1,y+R*.36,R*.04,'#6a4020');C_(g,x+R*.1,y+R*.36,R*.04,'#6a4020');
    eyes(g,x,y-R*.1,R*.2,R*.07);
  }else if(t===HIY){
    E_(g,x-R*.56,y+R*.12,R*.18,R*.28,'#f2c430',.4);E_(g,x+R*.56,y+R*.12,R*.18,R*.28,'#f2c430',-.4);
    C_(g,x,y+R*.05,R*.6,'#ffd84a');
    g.strokeStyle='#e8b820';g.lineWidth=R*.08;g.beginPath();g.moveTo(x-R*.04,y-R*.52);g.quadraticCurveTo(x-R*.14,y-R*.74,x-R*.02,y-R*.78);g.moveTo(x+R*.06,y-R*.52);g.quadraticCurveTo(x+R*.14,y-R*.7,x+R*.22,y-R*.68);g.stroke();
    eyes(g,x,y-R*.08,R*.22,R*.075);
    g.fillStyle='#f08a24';g.beginPath();g.moveTo(x-R*.12,y+R*.1);g.lineTo(x,y+R*.02);g.lineTo(x+R*.12,y+R*.1);g.lineTo(x,y+R*.22);g.closePath();g.fill();
  }else if(t===NIW){
    C_(g,x-R*.2,y-R*.58,R*.16,'#d8342a');C_(g,x,y-R*.68,R*.18,'#d8342a');C_(g,x+R*.2,y-R*.58,R*.16,'#d8342a');
    C_(g,x,y+R*.05,R*.64,'#d9cdb8');C_(g,x,y+R*.05,R*.6,'#fdfaf2');
    eyes(g,x,y-R*.1,R*.22,R*.075);
    g.fillStyle='#f0a024';g.beginPath();g.moveTo(x-R*.12,y+R*.08);g.lineTo(x,y);g.lineTo(x+R*.12,y+R*.08);g.lineTo(x,y+R*.2);g.closePath();g.fill();
    E_(g,x,y+R*.34,R*.09,R*.13,'#d8342a');
  }
  g.restore();
}
const TILE_URL={};
function tileURL(t,oc){
  const k=t+oc;if(TILE_URL[k])return TILE_URL[k];
  const c=document.createElement('canvas');c.width=c.height=192;drawTile(c.getContext('2d'),192,192,t,oc);
  return TILE_URL[k]=c.toDataURL();
}

/* ----- 2D (SVG): 칸 = 1, 판은 (0,0)~(3,4). 상대 포로 줄은 위(-1.1), 내 포로 줄은 아래(4.2) ----- */
const dXY=i=>{const x=X(i),y=Y(i);return flipped()?[2-x,y]:[x,3-y]};   // 칸 왼쪽 위
const xyI=(x,y)=>{if(x<0||y<0||x>2||y>3)return -1;return flipped()?IX(2-x,y):IX(x,3-y)};
const HAND_ROW=[4.18,-1.08],HS=.82;   // 포로 줄 위치(k 0 = 나, 1 = 상대), 포로 크기
function handList(col){const o=[];if(!CS)return o;for(let t=1;t<=3;t++)if(CS.p.hd[col][t])o.push([t,CS.p.hd[col][t]]);return o}
const handX2=(k,i)=>k?3-HS-i*(HS+.12):i*(HS+.12);
function onSvgClick(e){
  if(!CS)return;
  const pt=elSvg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;const m=elSvg.getScreenCTM();if(!m)return;
  const q=pt.matrixTransform(m.inverse());
  if(q.y>HAND_ROW[0]-.05&&q.y<HAND_ROW[0]+HS+.05){const hl=handList(viewCol());for(let i=0;i<hl.length;i++){const x0=handX2(0,i);if(q.x>=x0&&q.x<=x0+HS){tapHand(hl[i][0]);return}}return}
  if(q.x<0||q.x>3||q.y<0||q.y>4)return;
  tapSq(xyI(Math.floor(q.x),Math.floor(q.y)));
}
function tileSvg(t,col,x,y,s,op){
  const down=col!==viewCol(),cx=x+s/2,cy=y+s/2;
  return `<image href="${tileURL(t,colC(col))}" x="${x}" y="${y}" width="${s}" height="${s}"${op!=null&&op<1?` opacity="${op}"`:''}${down?` transform="rotate(180 ${cx} ${cy})"`:''}/>`;
}
function boardHTML(){
  const out=[],p=CS.p;
  out.push(`<rect x="-.18" y="-.18" width="3.36" height="4.36" rx=".12" fill="#6b3f1f"/><rect x="0" y="0" width="3" height="4" fill="#e2bf7e"/><rect x="0" y="0" width="3" height="1" fill="#000" opacity=".06"/><rect x="0" y="3" width="3" height="1" fill="#000" opacity=".06"/>`);
  for(let k=1;k<3;k++)out.push(`<line x1="${k}" y1="0" x2="${k}" y2="4" stroke="#3a2412" stroke-width=".03"/>`);
  for(let k=1;k<4;k++)out.push(`<line x1="0" y1="${k}" x2="3" y2="${k}" stroke="#3a2412" stroke-width=".03"/>`);
  const hl=(sq,c,op)=>{const [x,y]=dXY(sq);out.push(`<rect x="${x+.03}" y="${y+.03}" width=".94" height=".94" rx=".08" fill="${c}" opacity="${op}"/>`)};
  if(CS.lm){if(CS.lm[0]<12)hl(CS.lm[0],'#f2c94c',.4);hl(CS.lm[1],'#f2c94c',.6)}
  if(CS.att&&V.st==='play'){const l=p.lion[p.side];if(l>=0){const [x,y]=dXY(l);out.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="url(#dzAtt)"/>`)}}
  if(sel>=0&&sel<12)hl(sel,'#6fbf5a',.55);
  if(flash&&clock()-flash.at<700)for(const s of flash.sq)hl(s,'#d6342a',.6);
  const capSq=pend&&p.b[pend.to]?pend.to:-1;
  for(let sq=0;sq<N;sq++){const v=p.b[sq];if(!v||sq===capSq)continue;const [x,y]=dXY(sq);out.push(tileSvg(v&7,v>>3,x+.07,y+.07,.86,pend&&pend.from===sq?.35:1))}
  for(const k of [0,1]){
    const col=k?viewCol()^1:viewCol(),hl2=handList(col);
    hl2.forEach(([t,n],i)=>{
      const x=handX2(k,i),y=HAND_ROW[k];
      if(k===0&&sel===12+t)out.push(`<rect x="${x-.05}" y="${y-.05}" width="${HS+.1}" height="${HS+.1}" rx=".1" fill="#6fbf5a" opacity=".55"/>`);
      if(n>1)out.push(tileSvg(t,col,x+.08,y-.08,HS));
      out.push(tileSvg(t,col,x,y,HS,k===0&&pend&&pend.from===12+t&&n===1?.35:1));
    });
  }
  if(sel>=0&&!pend)for(const m of movesFrom(sel)){const t=mT(m),[x,y]=dXY(t);if(p.b[t])out.push(`<rect x="${x+.06}" y="${y+.06}" width=".88" height=".88" rx=".1" fill="none" stroke="rgba(30,30,30,.5)" stroke-width=".07"/>`);else out.push(`<circle cx="${x+.5}" cy="${y+.5}" r=".12" fill="rgba(30,30,30,.36)"/>`)}
  return out.join('');
}
function drawGhost(){
  if(!elGhost)return;
  let h='';
  if(pend&&CS){
    const [x,y]=dXY(pend.to),f=pend.from,col=myCol();
    let t=f>=12?f-12:pcAt(f)&7;if(t===HIY&&f<12&&Y(pend.to)===goalY(col))t=NIW;
    h=`<rect x="${x+.03}" y="${y+.03}" width=".94" height=".94" rx=".08" fill="#6fbf5a" opacity=".42"/>`+tileSvg(t,col,x+.07,y+.07,.86,.75);
  }
  elGhost.innerHTML=h;
  d3Marks();
}
const nm=i=>V.ps[i]?V.ps[i].n:'?';
/* 이름 칸: 자리 색 점, 이름, 시간 */
function chipHTML(i){
  const me=myIdx(),c=CS,p=V.ps[i];if(!p||i>1)return '';
  const on=V.st==='play'&&V.t===i&&!introWait();
  const st=V.st==='over'?(c.res&&c.res.w<0?'무승부':p.f===1?'승리':(p.sr===2?'시간 초과':p.sr===3?'탈주':p.sr?'항복':'패배')):'';
  return `<div class="dz-p${on?' on':''}${i===me?' me':''}"><i class="dot" style="background:${SEAT_C[i]}"></i><b>${esc(p.n)}${i===me?' (나)':''}</b><span class="w" data-ct="${i}"></span>${st?`<span class="st">${st}</span>`:''}</div>`;
}
const CHIP_GAP=10;
function chipsAt(topY,botY){
  const r=elDz,bar=r.querySelector('.dz-bar'),mb=r.querySelector('.dz-mebar');if(!bar||!mb)return;
  const H=r.clientHeight,lim=H-(r.clientWidth<700?70:14)-(mb.offsetHeight||34);
  r.style.setProperty('--bs',Math.max(bar.offsetHeight,Math.round(topY-CHIP_GAP-bar.offsetTop))+'px');
  r.style.setProperty('--mt',Math.round(Math.min(botY+CHIP_GAP,lim))+'px');
  r.classList.add('lay');
}
const seated=()=>{const me=myIdx();return me===0||me===1};
function barHTML(){const me=myIdx();return seated()?chipHTML(1-me):chipHTML(0)+chipHTML(1)}
function meBarHTML(){return seated()?chipHTML(myIdx()):''}
const WHY_SHORT={lion:'사자 잡음',try:'사자 도착',time:'시간 초과',surrender:'항복',desert:'탈주',rep:'같은 국면 세 번',stuck:'둘 수 없음',long:'수 제한'};
/* 안내 줄: 결과만 (누구 차례·갈 수 있는 칸은 판이 보여 줌) */
function hintText(){
  if(Date.now()<msgUntil&&msg)return msg;
  if(!V||!V.c||!CS)return '';
  if(V.st==='over'){
    const r=CS.res;if(!r)return '게임이 끝났습니다.';
    if(r.w<0)return `무승부입니다. (${WHY_SHORT[r.why]||''})`;
    return `${nm(r.w)} 승리 (${WHY_SHORT[r.why]||''})`;
  }
  return '';
}
function drawHint(){
  if(!elHint)return;
  const h=hintText();if(h!==lastHint){elHint.textContent=h;lastHint=h}
}
function fit(){
  if(!elDz||elDz.hidden)return;
  const bd=elDz.querySelector('.dz-bd'),bw=bd.clientWidth,bh=bd.clientHeight;
  const k=Math.min(bw/3.6,bh/6.9);
  if(k>0){elSvg.style.width=Math.floor(k*3.6)+'px';elSvg.style.height=Math.floor(k*6.9)+'px'}
}
function drawAll(){
  if(!CS||!elMain)return;
  if(!Dz3.on){const bd=boardHTML();if(bd!==lastBoard){elMain.innerHTML=bd;lastBoard=bd}}
  const top=barHTML(),mb=meBarHTML(),key=top+'\u0001'+mb;if(key!==lastBar){elBar.innerHTML=top;elBarMe.innerHTML=mb;lastBar=key;clockTick()}
  drawGhost();drawHint();fit();
}

/* ---------- 3D: 공통 원목 테이블 가운데 원목 판 + 네모 타일 말, 바로 위에서 보는 자기 카메라 ----------
   단위: 월드 그대로. 칸 한 변 C. 내 쪽 끝 줄이 화면 아래(+z). 포로는 판 옆(넓은 화면: 내 것 오른쪽 아래부터, 상대 것 왼쪽 위부터) 또는 앞뒤(좁은 화면) */
const C=.62,HX=1.5*C,HZ=2*C,BX=HX+.18,BZ=HZ+.18,TOP=.15,TS=.54,TH=.1,PY=TOP+.004,GS=.8;   // PY: 타일 바닥(판 윗면 위)
const GY=()=>T.felt&&T.felt.mat?T.felt.mat.position.y+.013:.02;   // 포로 바닥: 탁자 천 윗면 위
const Dz3={on:false,built:false,fail:false,root:null,cam:null,dirty:true,lastR:0,lay:'',layAt:0,d:12,layout:'h',pcs:new Map(),hand:[[],[]],anim:[],flipT:null,mvN:-1};
const ease=k=>k<=0?0:k>=1?1:k*k*(3-2*k);
function pW(i){const x=X(i),y=Y(i);return Dz3.flipT?[(1-x)*C,(y-1.5)*C]:[(x-1)*C,(1.5-y)*C]}
function woodPaint(g,w,h,base,dark,n,seed){
  let s=seed||7;const rnd=()=>{s=(s*16807)%2147483647;return s/2147483647};
  g.fillStyle=base;g.fillRect(0,0,w,h);
  for(let i=0;i<n;i++){const y0=rnd()*h,a=rnd()*.12+.04;g.strokeStyle=dark;g.globalAlpha=a;g.lineWidth=rnd()*2.5+.8;g.beginPath();
    for(let t=0;t<=w;t+=8){const y=y0+Math.sin(t/30+i)*3+Math.sin(t/11+i*3)*1.2;t?g.lineTo(t,y):g.moveTo(t,y)}g.stroke()}
  g.globalAlpha=1;
}
/* 판 무늬: 밝은 원목 + 3×4 칸 선, 양쪽 끝 줄은 조금 어둡게. 앞뒤가 같아 돌려 봐도 다시 그리지 않음 */
function drawBoardTex(g,W,Hh){
  const s=W/(2*BX),px=v=>(v+BX)*s,pz=v=>(v+BZ)*s;
  woodPaint(g,W,Hh,'#e4c283','#a8793e',50,13);
  g.fillStyle='rgba(90,52,20,.1)';g.fillRect(px(-HX),pz(-HZ),2*HX*s,C*s);g.fillRect(px(-HX),pz(HZ-C),2*HX*s,C*s);
  g.strokeStyle='#3a2412';g.lineCap='round';
  const lw=Math.max(2,W/260);
  const L=(x0,z0,x1,z1,w)=>{g.lineWidth=w;g.beginPath();g.moveTo(px(x0),pz(z0));g.lineTo(px(x1),pz(z1));g.stroke()};
  for(let c=1;c<3;c++)L(-HX+c*C,-HZ,-HX+c*C,HZ,lw);
  for(let r=1;r<4;r++)L(-HX,-HZ+r*C,HX,-HZ+r*C,lw);
  g.lineWidth=lw*2;g.strokeRect(px(-HX),pz(-HZ),2*HX*s,2*HZ*s);
}
const TEX={};
function faceTex(t,oc){const k=t+oc;return TEX[k]||(TEX[k]=canvasTex(256,256,(g,w,h)=>drawTile(g,w,h,t,oc)))}
const GEO={},MAT={};
function geo(){
  if(GEO.body)return GEO;
  const r=.06,s=TS/2-r,sh=new THREE.Shape();
  sh.moveTo(-s,-s-r);sh.lineTo(s,-s-r);sh.quadraticCurveTo(s+r,-s-r,s+r,-s);sh.lineTo(s+r,s);sh.quadraticCurveTo(s+r,s+r,s,s+r);sh.lineTo(-s,s+r);sh.quadraticCurveTo(-s-r,s+r,-s-r,s);sh.lineTo(-s-r,-s);sh.quadraticCurveTo(-s-r,-s-r,-s,-s-r);
  const body=new THREE.ExtrudeGeometry(sh,{depth:TH,bevelEnabled:false,curveSegments:4});body.rotateX(-Math.PI/2);body.translate(0,-TH/2,0);
  const ink=body.clone();ink.scale(1.06,1.08,1.06);
  GEO.body=body;GEO.ink=ink;GEO.face=new THREE.PlaneGeometry(TS*.97,TS*.97);
  return GEO;
}
const INK=()=>MAT.ink||(MAT.ink=new THREE.MeshBasicMaterial({color:GFX_INK,side:THREE.BackSide}));
const sideMat=()=>MAT.side||(MAT.side=toon({color:0xd9bf8c,rim:.1}));
function faceMat(t,oc,ghost){
  const k=(ghost?'g':'m')+t+oc;if(MAT[k])return MAT[k];
  return MAT[k]=ghost?new THREE.MeshBasicMaterial({map:faceTex(t,oc),transparent:true,opacity:.6,depthWrite:false}):toon({map:faceTex(t,oc),rim:.04});
}
/* 타일 하나: 바깥 g(자리·방향) 안에 inner(뒤집기용). 윗면은 그 말, 병아리는 아랫면에 닭(닭이 될 때 뒤집음).
   윗면 무늬 위쪽 = 말의 앞: 그룹 y 회전 0이면 화면 위(-z)를 봄 */
function pieceMesh(t,col,ghost){
  const Gm=geo(),g=new THREE.Group(),inner=new THREE.Group(),oc=colC(col);
  inner.position.y=TH/2;g.add(inner);
  const parts=[];
  if(ghost){const gs=MAT.gs||(MAT.gs=new THREE.MeshBasicMaterial({color:0xd8c193,transparent:true,opacity:.45,depthWrite:false}));const b=new THREE.Mesh(Gm.body,gs);inner.add(b);parts.push(b)}
  else{const b=new THREE.Mesh(Gm.body,sideMat());b.castShadow=b.receiveShadow=true;inner.add(b);parts.push(b);inner.add(new THREE.Mesh(Gm.ink,INK()))}
  const top=new THREE.Mesh(Gm.face,faceMat(t,oc,ghost));top.rotation.x=-Math.PI/2;top.position.y=TH/2+.002;inner.add(top);parts.push(top);
  if(t===HIY&&!ghost){const bt=new THREE.Mesh(Gm.face,faceMat(NIW,oc));bt.rotation.x=Math.PI/2;bt.position.y=-TH/2-.002;inner.add(bt)}
  g.userData={t,col,oc,parts,inner};orient(g);
  return g;
}
const orient=g=>{g.rotation.y=g.userData.col===viewCol()?0:Math.PI};
/* 대기실 홀로그램의 대표 말: 사자 타일과 병아리 타일 (공통 frontHoloPiece가 재질 만드는 함수를 줌) */
G.holoPiece=mkM=>{
  const g=new THREE.Group();
  const one=(t,oc,x,y,z,rx,rz)=>{const b=new THREE.Mesh(new THREE.BoxGeometry(.42,.42,.08),[mkM(0xd9bf8c),mkM(0xd9bf8c),mkM(0xd9bf8c),mkM(0xd9bf8c),mkM(0xffffff,canvasTex(256,256,(x,w,h)=>drawTile(x,w,h,t,oc))),mkM(0xd9bf8c)]);b.position.set(x,y,z);b.rotation.set(rx,0,rz);g.add(b)};
  one(HIY,SEAT_C[1],.16,.12,-.1,-.25,-.28);one(LION,SEAT_C[0],-.06,-.04,.06,-.2,.16);
  return g;
};
function d3Build(){
  if(Dz3.built||Dz3.fail)return Dz3.built;
  if(!T.ok||typeof THREE==='undefined'){Dz3.fail=true;return false}
  try{
    const root=new THREE.Group();root.visible=false;
    const bg=new THREE.Group();root.add(bg);Dz3.boardG=bg;
    const frameT=canvasTex(512,512,(g,w,h)=>woodPaint(g,w,h,'#7a4a22','#2e170a',110,3));
    const frame=new THREE.Mesh(new THREE.BoxGeometry(2*BX,TOP-.02,2*BZ),toon({map:frameT,rim:.08}));frame.position.y=.02+(TOP-.02)/2;frame.castShadow=frame.receiveShadow=true;bg.add(frame);
    const fo=new THREE.Mesh(new THREE.BoxGeometry(2*BX+.05,TOP,2*BZ+.05),INK());fo.position.copy(frame.position);bg.add(fo);
    const bt=canvasTex(768,Math.round(768*BZ/BX),(g,w,h)=>drawBoardTex(g,w,h));
    const top=new THREE.Mesh(new THREE.PlaneGeometry(2*BX-.04,2*BZ-.04),toon({map:bt,rim:0}));
    top.rotation.x=-Math.PI/2;top.position.y=TOP+.002;top.receiveShadow=true;bg.add(top);
    // 칸 표시: 마지막 수(노랑)·고른 말(초록)·안 되는 까닭(빨강)·노려지는 사자(붉은 빛)·갈 수 있는 칸(점)·잡을 수 있는 칸(테두리)
    const sq=(c,op)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(C*.94,C*.94),new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:op,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.y=TOP+.003;m.visible=false;m.renderOrder=2;root.add(m);return m};
    Dz3.lmA=sq(0xf2c94c,.36);Dz3.lmB=sq(0xf2c94c,.55);Dz3.selM=sq(0x6fbf5a,.58);Dz3.pendM=sq(0x6fbf5a,.4);Dz3.flashM=sq(0xd6342a,.62);
    const gT=canvasTex(128,128,(x,w,h)=>{const gr=x.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);gr.addColorStop(0,'rgba(255,40,20,.9)');gr.addColorStop(.6,'rgba(230,30,20,.5)');gr.addColorStop(1,'rgba(200,20,10,0)');x.fillStyle=gr;x.fillRect(0,0,w,h)});
    Dz3.attM=new THREE.Mesh(new THREE.PlaneGeometry(C*1.5,C*1.5),new THREE.MeshBasicMaterial({map:gT,transparent:true,depthWrite:false}));Dz3.attM.rotation.x=-Math.PI/2;Dz3.attM.position.y=TOP+.005;Dz3.attM.visible=false;Dz3.attM.renderOrder=3;root.add(Dz3.attM);
    const hT=canvasTex(128,128,(x,w,h)=>{x.fillStyle='rgba(111,191,90,.6)';x.beginPath();x.roundRect?x.roundRect(4,4,w-8,h-8,16):x.rect(4,4,w-8,h-8);x.fill()});
    Dz3.handSel=new THREE.Mesh(new THREE.PlaneGeometry(TS*GS*1.25,TS*GS*1.25),new THREE.MeshBasicMaterial({map:hT,transparent:true,depthWrite:false}));Dz3.handSel.rotation.x=-Math.PI/2;Dz3.handSel.visible=false;Dz3.handSel.renderOrder=2;root.add(Dz3.handSel);
    const dotM=new THREE.MeshBasicMaterial({color:0x1d1a17,transparent:true,opacity:.42,depthWrite:false});
    const rT=canvasTex(128,128,(x,w,h)=>{x.strokeStyle='rgba(29,26,23,.55)';x.lineWidth=10;x.strokeRect(8,8,w-16,h-16)});
    const ringM=new THREE.MeshBasicMaterial({map:rT,transparent:true,depthWrite:false});
    Dz3.dots=[];Dz3.rings=[];
    for(let k=0;k<12;k++){
      const d=new THREE.Mesh(new THREE.CircleGeometry(C*.13,20),dotM);d.rotation.x=-Math.PI/2;d.position.y=TOP+.008;d.visible=false;d.renderOrder=4;root.add(d);Dz3.dots.push(d);
      const r=new THREE.Mesh(new THREE.PlaneGeometry(C*.96,C*.96),ringM);r.rotation.x=-Math.PI/2;r.position.y=TOP+.008;r.visible=false;r.renderOrder=4;root.add(r);Dz3.rings.push(r);
    }
    Dz3.pg=new THREE.Group();root.add(Dz3.pg);
    Dz3.ghost=new THREE.Group();Dz3.ghost.visible=false;root.add(Dz3.ghost);
    Dz3.cam=new THREE.PerspectiveCamera(34,1,.1,100);
    T.scene.add(root);Dz3.root=root;Dz3.built=true;
  }catch(e){Dz3.fail=true;try{console.warn('동물장기 3D 준비 실패',e)}catch(_){}}
  return Dz3.built;
}
/* 포로 자리: k 0 = 내 포로, 1 = 상대 포로. i번째 종류 칸(같은 종류 둘이면 겹쳐 놓음) */
const HSP=TS*GS+.1;
function handXZ(k,i){
  const sg=k?-1:1;
  if(Dz3.layout==='h')return [sg*(BX+.12+TS*GS/2),sg*(HZ-TS*GS/2-.04-i*HSP)];
  return [sg*(-HX+TS*GS/2+.02+i*HSP),sg*(BZ+.1+TS*GS/2)];
}
/* 지금 내 쪽(k)·상대 쪽 포로 목록 [[말, 개수], …] */
const handOfK=k=>handList(k?viewCol()^1:viewCol());
/* 바로 시작: 판은 그대로, 지금 말을 처음 자리로 미끄러져 모음(같은 종류·색 중 가까운 것끼리, 닭은 병아리로) */
const GLIDE=420;
function regather(p){
  const pool=[...Dz3.pcs.values(),...Dz3.hand[0].flat(),...Dz3.hand[1].flat()];
  Dz3.pcs.clear();Dz3.hand=[[],[]];Dz3.anim=[];
  const used=new Set();
  for(let sq=0;sq<N;sq++){
    const v=p.b[sq];if(!v)continue;
    const [x,z]=pW(sq);let best=null,bd=1e9;
    for(const g of pool){if(used.has(g)||g.userData.t!==(v&7)||g.userData.oc!==colC(v>>3))continue;const d=Math.hypot(g.position.x-x,g.position.z-z);if(d<bd){bd=d;best=g}}
    if(!best){best=pieceMesh(v&7,v>>3);best.position.set(x,PY+1,z);best.visible=false;Dz3.pg.add(best)}
    used.add(best);Dz3.pcs.set(sq,best);best.userData.col=v>>3;best.userData.hand=0;
    const g=best,y0=g.visible?g.position.y:PY+1;
    Dz3.anim.push({obj:g,t0:IN.t0+pieceAt(v&7,sq,true)[0],dur:GLIDE,x0:g.position.x,z0:g.position.z,x1:x,z1:z,lift:Math.hypot(g.position.x-x,g.position.z-z)>.05?.3:0,s0:g.scale.x,s1:1,y0,y1:PY,show:1,ry:g.rotation.y,ry1:(v>>3)===viewCol()?0:Math.PI});
  }
  const now=clock();
  for(const g of pool)if(!used.has(g)){Dz3.anim.push({obj:g,t0:now,dur:360,x0:g.position.x,z0:g.position.z,x1:g.position.x,z1:g.position.z,y0:g.position.y,y1:g.position.y+1.4,s0:g.scale.x,s1:.01,gone:1})}
  Dz3.mvN=0;Dz3.dirty=true;
}
/* 말 자리를 상태에 맞춤: 마지막 수는 미끄러지듯(포로 놓기는 받침에서 날아옴), 잡힌 말은 내 받침으로 날아가 돌아섬, 병아리가 끝 줄에 닿으면 뒤집혀 닭 */
function d3Sync(){
  if(!Dz3.on||!V||!V.c||!CS)return;
  const fl=flipped(),c=V.c,p=CS.p,now=clock();
  if(IN.again&&!IN.gathered&&c.mv.length===0&&Dz3.flipT!==null){IN.gathered=true;Dz3.flipT=fl;regather(p)}
  if(Dz3.flipT!==fl){Dz3.flipT=fl;for(const g of Dz3.pcs.values())Dz3.pg.remove(g);Dz3.pcs.clear();for(const k of [0,1]){for(const g of Dz3.hand[k].flat())Dz3.pg.remove(g);Dz3.hand[k]=[]}Dz3.mvN=-1}
  const n=c.mv.length,step=Dz3.mvN>=0&&n===Dz3.mvN+1&&c.lm&&!IN.on3d;
  let capMesh=null,capT=0,capK=-1;
  if(step){
    const [f,t]=c.lm,last=c.mv[n-1],mover=(p.side^1),moverK=mover===viewCol()?0:1;
    let g=null;
    if(f>=12){   // 포로 놓기: 받침의 그 종류 하나를 집음
      const hk=Dz3.hand[moverK],slot=hk.find(s=>s.length&&s[0].userData.t===f-12);
      if(slot){g=slot.pop()}
    }else{g=Dz3.pcs.get(f);if(g)Dz3.pcs.delete(f)}
    if(g){
      const old=Dz3.pcs.get(t);if(old){Dz3.pcs.delete(t);capMesh=old;capT=old.userData.t===NIW?HIY:old.userData.t;capK=moverK}
      Dz3.pcs.set(t,g);
      const [x1,z1]=pW(t),x0=g.position.x,z0=g.position.z,y0=g.position.y,s0=g.scale.x;
      Dz3.anim.push({obj:g,t0:now,dur:f>=12?360:250,x0,z0,x1,z1,y0,y1:PY,lift:f>=12?.4:.1,s0,s1:1});
      if(f<12&&g.userData.t===HIY&&(p.b[t]&7)===NIW)Dz3.anim.push({obj:g,t0:now+250,dur:300,x0:x1,z0:z1,x1,z1,y0:PY,y1:PY,lift:.22,flip:1,prom:1});
    }
    if(last==null)Dz3.mvN=-1;
  }
  // 판 위: 상태와 다른 것은 바꿈
  const want=new Map();
  for(let sq=0;sq<N;sq++){const v=p.b[sq];if(v)want.set(sq,v)}
  for(const [sq,g] of Dz3.pcs){const v=want.get(sq),busy=Dz3.anim.some(a=>a.obj===g&&!a.gone);const tt=g.userData.t,ok=v&&g.userData.col===(v>>3)&&(tt===(v&7)||busy&&tt===HIY&&(v&7)===NIW);if(!ok){Dz3.pg.remove(g);Dz3.pcs.delete(sq)}}
  for(const [sq,v] of want){
    if(Dz3.pcs.has(sq))continue;
    const g=pieceMesh(v&7,v>>3),[x,z]=pW(sq);g.position.set(x,PY,z);Dz3.pg.add(g);Dz3.pcs.set(sq,g);
  }
  for(const [sq,g] of Dz3.pcs)if(!Dz3.anim.some(a=>a.obj===g)){const [x,z]=pW(sq);g.position.set(x,PY,z)}
  // 포로 받침: 종류마다 칸 하나, 개수만큼 겹쳐 놓음
  for(const k of [0,1]){
    const list=handOfK(k),col=k?viewCol()^1:viewCol(),old=Dz3.hand[k],nw=[];
    for(let i=0;i<list.length;i++){
      const [t,cnt]=list[i];let slot=old.find(s=>s.length&&s[0].userData.t===t)||[];
      const keep=slot.filter(g=>g.userData.col===col);for(const g of slot)if(!keep.includes(g))Dz3.pg.remove(g);slot=keep;
      while(slot.length>cnt)Dz3.pg.remove(slot.pop());
      while(slot.length<cnt){
        const g=pieceMesh(t,col);g.scale.setScalar(GS);g.userData.hand=1;Dz3.pg.add(g);
        if(capMesh&&k===capK&&t===capT){   // 잡힌 말이 날아와 이 자리에 앉음: 날아가는 동안은 새 타일을 숨김
          const [x,z]=handXZ(k,i),cm=capMesh;capMesh=null;g.visible=false;
          const j=slot.length;Dz3.anim.push({obj:cm,t0:now+150,dur:420,x0:cm.position.x,z0:cm.position.z,x1:x+j*.06,z1:z-j*.06,y0:cm.position.y,y1:GY()+j*TH*GS,lift:.5,s0:cm.scale.x,s1:GS,ry:cm.rotation.y,ry1:k?Math.PI:0,gone:2,then:g});
        }
        slot.push(g);
      }
      slot.forEach((g,j)=>{const [x,z]=handXZ(k,i);if(!Dz3.anim.some(a=>a.obj===g)){g.position.set(x+j*.06,GY()+j*TH*GS,z-j*.06);g.scale.setScalar(GS);orient(g)}});
      nw.push(slot);
    }
    const live=new Set(nw.flat());for(const s of old)for(const g of s)if(!live.has(g))Dz3.pg.remove(g);
    Dz3.hand[k]=nw;
  }
  if(capMesh)Dz3.pg.remove(capMesh);
  Dz3.mvN=n;
  d3Marks();Dz3.dirty=true;
}
/* 칸 표시를 상태에 맞춤 (고를 때마다) */
function d3Marks(){
  if(!Dz3.on||!V||!V.c||!CS)return;
  const put=(m,sq)=>{if(sq==null||sq<0||sq>=N){m.visible=false;return}const [x,z]=pW(sq);m.position.x=x;m.position.z=z;m.visible=true};
  put(Dz3.lmA,CS.lm?CS.lm[0]:-1);put(Dz3.lmB,CS.lm?CS.lm[1]:-1);
  put(Dz3.selM,sel>=0&&sel<12&&!introWait()?sel:-1);put(Dz3.pendM,pend?pend.to:-1);
  put(Dz3.attM,CS.att&&V.st==='play'?CS.p.lion[CS.p.side]:-1);
  put(Dz3.flashM,flash&&clock()-flash.at<700?flash.sq[0]:-1);
  const ms=sel>=0&&!pend?movesFrom(sel):[];let di=0,ri=0;
  for(const m of ms){const t=mT(m);if(CS.p.b[t]){if(ri<Dz3.rings.length)put(Dz3.rings[ri++],t)}else if(di<Dz3.dots.length)put(Dz3.dots[di++],t)}
  for(;di<Dz3.dots.length;di++)Dz3.dots[di].visible=false;for(;ri<Dz3.rings.length;ri++)Dz3.rings[ri].visible=false;
  const capSq=pend&&CS.p.b[pend.to]?pend.to:-1;
  for(const [sq,g] of Dz3.pcs){if(Dz3.anim.some(a=>a.obj===g))continue;const up=sq===sel&&!introWait();const y=PY+(up?.08:0);if(g.position.y!==y){g.position.y=y;Dz3.dirty=true}
    g.visible=!(pend&&(pend.from===sq||capSq===sq))}
  // 고른 포로: 받침의 맨 위 타일을 살짝 들고 밑에 초록
  let hs=null;
  Dz3.hand[0].forEach((slot,i)=>{const top=slot[slot.length-1];slot.forEach((g,j)=>{if(Dz3.anim.some(a=>a.obj===g))return;const up=sel===12+g.userData.t&&j===slot.length-1&&!introWait();g.position.y=GY()+j*TH*GS+(up?.08:0);g.visible=!(pend&&pend.from===12+g.userData.t&&j===slot.length-1)});if(top&&sel===12+top.userData.t)hs=handXZ(0,i)});
  if(hs){Dz3.handSel.position.set(hs[0],GY()+.002,hs[1]);Dz3.handSel.visible=true}else Dz3.handSel.visible=false;
  if(pend){
    const f=pend.from,col=myCol();let t=f>=12?f-12:pcAt(f)&7;if(t===HIY&&f<12&&Y(pend.to)===goalY(col))t=NIW;
    const key=t+'|'+col+'|'+Dz3.flipT;
    if(Dz3.ghost.userData.k!==key){Dz3.ghost.clear();const gm=pieceMesh(t,col,true);gm.traverse(o=>{o.renderOrder=6});Dz3.ghost.add(gm);Dz3.ghost.userData.k=key}
    const [x,z]=pW(pend.to);Dz3.ghost.position.set(x,PY,z);Dz3.ghost.visible=true;
  }else Dz3.ghost.visible=false;
  Dz3.dirty=true;
}
/* 카메라: 바로 위에서 내려다봄 (장기·오목과 같은 탑뷰). 판 가운데 = 화면 가운데, 위아래는 이름 칸 자리를 같은 높이로 비우고 양옆은 조금만(tvBox).
   포로 받침은 판 옆(넓은 화면) 또는 판 앞뒤(좁은 화면) 중 판이 더 크게 보이는 쪽 */
function tvBox(r){
  const W=r.clientWidth,Hh=r.clientHeight;r.classList.toggle('wide',W>Hh||W>=700);
  const narrow=W<700,bar=r.querySelector('.dz-bar'),mb=r.querySelector('.dz-mebar');
  const R=Math.max(bar.offsetTop+bar.offsetHeight+CHIP_GAP,(narrow?70:14)+(mb.offsetHeight||26)+CHIP_GAP),m=narrow?8:16;
  return {fw:W-2*m,fh:Hh-2*R,cy:Hh/2,R};
}
const GXW=.2+TS*GS,GZW=.18+TS*GS;   // 포로 받침이 차지하는 폭 (옆 / 앞뒤)
function d3Layout(t){
  if(t-Dz3.layAt<100&&Dz3.lay)return false;
  Dz3.layAt=t;
  const st=$('#stage'),W=st.clientWidth,Hh=st.clientHeight;if(!W||!Hh||!V||!V.c)return false;
  const B=tvBox(elDz),key=[W,Hh,B.R,flipped()].join(',');
  if(key===Dz3.lay)return false;
  Dz3.lay=key;
  const fw=B.fw,fh=B.fh;
  const sH=Math.min(fw/(2*(BX+GXW)),fh/(2*BZ)),sV=Math.min(fw/(2*BX),fh/(2*(BZ+GZW)));
  const lay=sH>=sV?'h':'v',s=Math.max(sH,sV)*.98;
  Dz3.layout=lay;
  const cam=Dz3.cam,f=Math.tan(cam.fov*Math.PI/360),d=(Hh/2)/(s*f);
  cam.aspect=W/Hh;cam.clearViewOffset();cam.position.set(0,PY+d,0);cam.lookAt(0,PY,0);
  cam.setViewOffset(W,Hh,0,-(B.cy-Hh/2),W,Hh);cam.updateProjectionMatrix();cam.updateMatrixWorld();
  {const hv=(lay==='v'?BZ+GZW:BZ)*s;chipsAt(B.cy-hv,B.cy+hv)}
  Dz3.d=d;Dz3.dirty=true;
  d3Sync();
  return true;
}
function d3Step(now){
  let busy=false;
  Dz3.anim=Dz3.anim.filter(a=>{
    const k=(now-a.t0)/a.dur;if(k<0){busy=true;return true}
    const e=ease(Math.min(1,k)),o=a.obj;busy=true;
    o.position.x=a.x0+(a.x1-a.x0)*e;o.position.z=a.z0+(a.z1-a.z0)*e;
    if(a.show)o.visible=true;
    o.position.y=(a.y0!=null?a.y0+(a.y1-a.y0)*e:PY)+Math.sin(Math.PI*Math.min(1,k))*(a.lift||0);
    if(a.s1!=null)o.scale.setScalar(a.s0+(a.s1-a.s0)*e);
    if(a.ry1!=null)o.rotation.y=a.ry+(a.ry1-a.ry)*e;
    if(a.flip)o.userData.inner.rotation.x=Math.PI*e;
    if(k>=1){
      if(a.gone){Dz3.pg.remove(o);if(a.then)a.then.visible=true;return false}
      o.position.set(a.x1,a.y1!=null?a.y1:PY,a.z1);
      if(a.prom){   // 닭 면이 위로: 닭 타일로 바꿔 끼움
        for(const [sq,g] of Dz3.pcs)if(g===o){const ng=pieceMesh(NIW,o.userData.col);ng.position.copy(o.position);Dz3.pg.remove(o);Dz3.pg.add(ng);Dz3.pcs.set(sq,ng);break}
      }
      return false;
    }
    return true;
  });
  return busy;
}
function d3Render(t){
  if(!Dz3.on||!T.ok)return;
  if(d3Layout(t))Dz3.dirty=true;
  const busy=d3Step(t),intro=IN.on3d&&introStep(t),fl=flash&&t-flash.at<760;
  if(flash&&!fl&&Dz3.flashM.visible){flash=null;d3Marks();drawAll()}
  if(!busy&&!intro&&!fl&&!Dz3.dirty&&t-Dz3.lastR<400)return;
  Dz3.dirty=false;Dz3.lastR=t;
  const fog=T.scene.fog,fn=fog?fog.near:0,ff=fog?fog.far:0;
  if(fog){fog.near=Dz3.d+5;fog.far=Dz3.d+30}
  for(const m of [T.timerBg,T.timerArc,T.ring])if(m)m.visible=false;
  let cam=Dz3.cam;
  {const k=intro&&IN.fromLobby?ease((t-IN.t0)/INTRO.cam):1;
   if(k<1){
     const ic=Dz3.icam||(Dz3.icam=new THREE.PerspectiveCamera());
     ic.position.copy(T.cam.position).lerp(Dz3.cam.position,k);ic.quaternion.copy(T.cam.quaternion).slerp(Dz3.cam.quaternion,k);
     const a=T.cam.projectionMatrix.elements,b=Dz3.cam.projectionMatrix.elements,m=ic.projectionMatrix.elements;
     for(let j=0;j<16;j++)m[j]=a[j]+(b[j]-a[j])*k;
     ic.projectionMatrixInverse.copy(ic.projectionMatrix).invert();ic.updateMatrixWorld();
     if(fog){fog.near=fn+(fog.near-fn)*k;fog.far=ff+(fog.far-ff)*k}
     cam=ic;
   }}
  T.r.render(T.scene,cam);
  if(fog){fog.near=fn;fog.far=ff}
}
/* ---------- 시작 연출 (방장이 그동안 시간·봇을 멈춤, 길이 G.introMs) ----------
   0~1.1초 로비 카메라 → 바로 위 카메라. 0.1~0.5초 판이 내려앉음.
   0.55초~ 말이 차례로 떨어짐: 병아리 → 코끼리 → 기린 → 사자(마지막, 더 높이서 쿵)
   1.9초~ 판 가운데에 첫 차례 주사위 → 멈추면 'OO부터 시작합니다'
   바로 시작은 판을 다시 차리지 않음: 말이 같은 순서로 처음 자리로 미끄러져 돌아가고(포로도 판으로), 선·후를 바꿔 주사위 없이 알림 */
const INTRO={cam:1100,ui:650,board:[100,400],at:{[HIY]:550,[ZOU]:800,[KIR]:1050,[LION]:1350},dur:320,kDur:420,dice:1900};
const AGAIN={at:{[HIY]:80,[ZOU]:200,[KIR]:320,[LION]:440},dice:1000};
const DIE=.5;
G.introMs=(again,rolls)=>Math.round((again?AGAIN.dice:INTRO.dice)+DicePick.totalFor(again?-1:rolls)+100);
const IN={on:false,on3d:false,t0:0,total:0,r:0,again:false,fromLobby:true,said:false,fp:null,die:null,snd:{}};
const introOn=()=>IN.on&&clock()<IN.t0+IN.total;
const introWait=()=>introOn()&&!IN.said;
const dropY=(x,h)=>x>=1?0:x<.68?h*(1-(x/.68)*(x/.68)):h*.1*Math.sin(Math.PI*(x-.68)/.32);
/* 말 하나가 떨어지기(바로 시작이면 미끄러지기) 시작하는 시각과 길이. 같은 종류는 왼쪽(내 쪽에서 본) 먼저 */
function pieceAt(t,sq,again){
  const A=again?AGAIN:INTRO,base=t===NIW?HIY:t;
  return [(A.at[base]||A.at[HIY])+((Dz3.flipT?2-X(sq):X(sq))===2?60:0),t===LION?INTRO.kDur:INTRO.dur];
}
G.intro=(t0,o)=>{
  if(!V||!V.c||!V.ps)return;
  IN.again=!!(o&&o.again)&&Dz3.on;
  const rolls=IN.again?-1:o&&o.rolls,seed=(o&&o.seed)||1;
  IN.on=true;IN.t0=t0;IN.said=false;IN.snd={};IN.fromLobby=!Dz3.on;IN.on3d=true;IN.gathered=false;
  IN.r=IN.again?AGAIN.dice:INTRO.dice;IN.total=(o&&o.total)||G.introMs(IN.again,rolls);
  if(IN.die){IN.die.dispose();IN.die=null}
  IN.fp=firstPick(t0+IN.r,{seats:[0,1],first:V.c.A,rolls,seed});
  $('#stage').classList.add('dz-intro');if(elDz&&IN.fromLobby)elDz.classList.add('intro');
  lastBar='';Dz3.dirty=true;
};
function introStep(now,force){
  if(!Dz3.built||!V||!V.c)return false;
  const e=now-IN.t0,done=force||e>=IN.total,fl=IN.fromLobby;
  if(done)IN.on3d=false;
  {const x=done||!fl?1:(e-INTRO.board[0])/INTRO.board[1];Dz3.boardG.visible=x>0;Dz3.boardG.position.y=dropY(Math.max(0,x),1.6)}
  if(!IN.again)for(const [sq,g] of Dz3.pcs){
    const [a,d]=pieceAt(g.userData.t,sq),x=done?1:(e-a)/d;
    g.visible=x>0;g.position.y=PY+dropY(Math.max(0,Math.min(1,x)),g.userData.t===LION?1.5:1);
  }
  if(IN.fp&&!IN.fp.fixed){
    if(!IN.die&&!done&&Dz3.root){IN.die=DicePick.mesh(THREE,2,SEAT_C);Dz3.root.add(IN.die.g)}
    if(IN.die)IN.die.apply(done||e<IN.r?null:IN.fp.pose(now),DIE,0,PY+TH,0);
  }
  if(done){for(const g of Dz3.pcs.values())g.visible=true;if(IN.die){IN.die.dispose();IN.die=null}d3Marks()}
  return true;
}
function introEnd(){
  if(IN.on3d)introStep(clock(),true);
  if(IN.die){IN.die.dispose();IN.die=null}
  IN.on=false;IN.on3d=false;IN.said=true;
  $('#stage').classList.remove('dz-intro');if(elDz)elDz.classList.remove('intro');
}
function introTick(){
  if(!IN.on)return;
  const e=clock()-IN.t0,S_=IN.snd,once=(k,f)=>{if(!S_[k]){S_[k]=1;f()}},A=IN.again?AGAIN:INTRO;
  if(e>=INTRO.ui&&elDz&&elDz.classList.contains('intro'))elDz.classList.remove('intro');
  if(IN.on3d&&Dz3.on){
    if(IN.fromLobby&&e>=INTRO.board[0]+INTRO.board[1]*.68)once('thud',()=>{tone(120,.13,{type:'triangle',vol:.2});hiss(.09,{freq:650,vol:.12})});
    const land=d=>IN.again?GLIDE:d*.68;
    [[HIY,0],[ZOU,1],[KIR,2],[LION,3]].forEach(([t,k])=>{if(e>=A.at[t]+land(t===LION?INTRO.kDur:INTRO.dur))once('t'+t,()=>sndLand(k))});
  }
  if(IN.fp&&e>=IN.r&&IN.fp.tick(IN.t0+e)){
    IN.said=true;$('#stage').classList.remove('dz-intro');if(elDz)elDz.classList.remove('intro');
    fxSay(IN.fp.msg(),SEAT_C[IN.fp.first]);
    lastBar='';if(Dz3.on)d3Marks();
  }
  if(e>=IN.total){IN.on=false;lastBar='';lastHint='';G.buttons();if(Dz3.on)d3Marks()}
  drawAll();
}
/* 3D 화면에서 누른 곳 → 칸 또는 내 포로 (타일 몸통을 먼저, 아니면 판 윗면에서 그 칸) */
const dzRay=()=>Dz3.ray||(Dz3.ray=new THREE.Raycaster());
function d3Point(e){
  const r=T.r.domElement.getBoundingClientRect();if(!r.width||!CS)return -1;
  const ray=dzRay();ray.setFromCamera({x:(e.clientX-r.left)/r.width*2-1,y:-(e.clientY-r.top)/r.height*2+1},Dz3.cam);
  const objs=[];
  for(const g of Dz3.pcs.values())if(g.visible)for(const pm of g.userData.parts)objs.push(pm);
  for(const s of Dz3.hand[0])for(const g of s)if(g.visible)for(const pm of g.userData.parts)objs.push(pm);
  const hit=ray.intersectObjects(objs,false)[0];
  if(hit){
    for(const [sq,g] of Dz3.pcs)if(g.userData.parts.includes(hit.object))return sq;
    for(const s of Dz3.hand[0])for(const g of s)if(g.userData.parts.includes(hit.object))return 12+g.userData.t;
  }
  const o=ray.ray.origin,dv=ray.ray.direction;if(Math.abs(dv.y)<1e-6)return -1;
  const k=(TOP-o.y)/dv.y,x=o.x+dv.x*k,z=o.z+dv.z*k;
  const gx=Math.floor(x/C+1.5),gr=Math.floor(z/C+2);
  if(gx<0||gx>2||gr<0||gr>3)return -1;
  return Dz3.flipT?IX(2-gx,gr):IX(gx,3-gr);
}
function d3Click(e){
  if(!Dz3.on||G!==GAMES.animal)return;
  const sq=d3Point(e);if(sq<0)return;
  if(sq>=12)tapHand(sq-12);else tapSq(sq);
}
/* 새 상태를 받았을 때 */
G.preView=()=>{
  if(!V.c){CS=null;return}
  CS=buildS(V.c);OC.at=clock();OC.mk='';
  const me=myIdx();
  if(!PV||!PV.c||PV.st!==V.st||V.c.mv.length<PV.c.mv.length||(V.c.mv.length===0&&PV.c.mv.length===0&&PV.c.A!==V.c.A)){sel=-1;pend=null}
  else if(PV.c.mv.length!==V.c.mv.length){
    const myMove=me>=0&&me<2&&CS.p.side!==myCol();
    if(myMove){sel=-1;pend=null}
    else{
      const col=myCol();
      if(sel>=0&&sel<12&&!isMine(CS.p.b[sel])){sel=-1;pend=null}
      if(sel>=12&&!CS.p.hd[col][sel-12]){sel=-1;pend=null}
      if(pend&&!legal(CS.p).includes(pend.m))pend=null;
    }
  }
  if(V.st!=='play'){sel=-1;pend=null}
};
G.postView=()=>{};
G.overExtra=()=>'';
G.logCue=()=>false;
/* 소리: 타일이 놓이면 딱(도착하는 순간에 맞춤), 잡으면 딸깍이 더해짐, 닭이 되면 두 음 */
G.cues=(v,pv)=>{
  if(!v.c||!pv.c)return;
  if(v.c.mv.length>pv.c.mv.length){
    const at=Dz3.on?.2:0,a=replay(pv.c.mv).p,m=fromU(a,v.c.mv[v.c.mv.length-1]);
    const cap=m&&!isDrop(m)&&a.b[mT(m)],prom=m&&!isDrop(m)&&(a.b[mF(m)]&7)===HIY&&Y(mT(m))===goalY(a.side);
    sndPut(at,!!cap);
    if(prom)sndProm(at+.35);
  }
};
G.hud=inGame=>{
  if(!elDz)return;
  const on=!!(inGame&&V&&V.c&&CS);
  elDz.hidden=!on;
  $('#stage').classList.toggle('dz-over',!!(on&&V.st==='over'));
  const d3=on&&d3Build();
  if(d3!==Dz3.on){Dz3.on=d3;Dz3.lay='';if(Dz3.root)Dz3.root.visible=d3;$('#stage').classList.toggle('dz3d',d3);lastBoard='';lastHint=''}
  $('#stage').classList.toggle('dz2d',on&&!d3);
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
  const play=$('#btnPlay'),can=!!(pend&&myTurnNow());
  $('#btnPass').hidden=true;$('#btnGura').hidden=true;
  play.disabled=!can;play.classList.toggle('ready',can);
  if($('#playMain').textContent!=='두기')$('#playMain').textContent='두기';
  const sub=keyLabel(KEYS.play);if($('#playSub').textContent!==sub)$('#playSub').textContent=sub;
};
G.live=()=>{
  if(IN.on)introTick();
  if(!V||!V.c||!CS)return;
  clockTick();
  if(flash&&!Dz3.on&&clock()-flash.at>720){flash=null;lastBoard='';drawAll()}
};
/* 이름 칸의 시간 (매 프레임 글자만 바꿈). 10초 남으면 빨갛게 깜빡임 */
function clockTick(){
  if(!elBar||!V||!V.c)return;
  elDz.querySelectorAll('.dz-bar [data-ct],.dz-mebar [data-ct]').forEach(el=>{const i=+el.dataset.ct,ms=remMs(i),t=fmtT(ms);if(el.textContent!==t)el.textContent=t;
    const low=V.st==='play'&&V.t===i&&V.c.run&&ms<=10000;if(el.parentNode.classList.contains('low')!==low)el.parentNode.classList.toggle('low',low)});
}
G.play=()=>confirmPend();
G.pass=()=>{};
G.keyPhase=st=>st==='play';
G.onKey=()=>false;
G.field3D=()=>{if(T.stacks)for(const arr of T.stacks.values())arr.forEach(c=>{c.visible=false})};
G.render3D=t=>{if(Dz3.on)d3Render(t);else if(T.ok&&!$('#stage').classList.contains('dz2d'))T.r.render(T.scene,T.cam)};
G.enter=()=>{
  $('#stage').classList.add('dz');
  $('#btnPass').hidden=true;$('#btnGura').hidden=true;$('#numpick').hidden=true;
  sel=-1;pend=null;
  if(elDz)fit();
};
G.leave=()=>{
  introEnd();
  $('#stage').classList.remove('dz','dz-over','dz3d','dz2d');
  if(T.stacks)for(const arr of T.stacks.values())arr.forEach(c=>{c.visible=true});
  if(Dz3.root)Dz3.root.visible=false;Dz3.on=false;Dz3.anim=[];
  $('#btnPass').hidden=false;
  if(elDz){elDz.hidden=true;lastBoard='';lastBar='';lastHint=''}
};
G.init=()=>{
  const css=document.createElement('style');
  css.textContent=`
.stage.dz{background:radial-gradient(ellipse at 50% 38%,#f3e4c2 0%,#e2c89a 70%,#d3b27c 100%)}
.stage.dz.dz2d #cv,.stage.dz #dim{visibility:hidden}
.stage.dz-intro .actions,.stage.dz-intro .myplate,.stage.dz-intro #dz .dz-row{opacity:0;pointer-events:none}
.stage.dz .actions,.stage.dz .myplate,#dz .dz-row,#dz .dz-bar,#dz .dz-mebar{transition:opacity .35s}
#dz.intro .dz-bar,#dz.intro .dz-mebar{opacity:0}
.stage.dz3d #dz svg.dz-board{display:none}
.stage.dz3d #dz .dz-hint{flex:0 1 auto;background:rgba(255,250,240,.9);border:1px solid var(--line-strong,#cdb391);border-radius:99px;padding:4px 12px;box-shadow:0 2px 6px -2px rgba(59,42,31,.35)}
.stage.dz .labels{visibility:hidden}
.stage.dz .nogl{display:none}
.stage.dz.dz-over .myplate,.stage.dz.dz-over .actions{display:none}
.specbar:not([hidden])~#dz .dz-bar{margin-top:30px}
.stage.dz .actions{left:auto}
.stage.dz .myplate{max-width:calc(100% - 150px)}
#dz{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;gap:6px;padding:8px 10px 82px;pointer-events:none;min-height:0}
#dz[hidden]{display:none}
#dz .dz-bar{min-height:44px;display:flex;flex-wrap:wrap;justify-content:center;align-items:flex-start;align-content:flex-end;gap:6px;align-self:center;max-width:calc(100% - 188px);pointer-events:none}
#dz .dz-mebar{position:absolute;left:50%;bottom:var(--plateB,14px);transform:translateX(-50%);z-index:2;display:flex;pointer-events:none;max-width:calc(100% - 188px)}
#dz .dz-mebar:empty{display:none}
#dz .dz-p{position:relative;display:flex;align-items:center;gap:6px;padding:4px 10px 5px;border-radius:12px;background:rgba(255,250,240,.92);border:1.5px solid var(--line-strong,#cdb391);font-size:13px;line-height:1.15;white-space:nowrap;max-width:100%}
#dz .dot{width:13px;height:13px;border-radius:50%;flex:none;display:inline-block;vertical-align:-2px;box-shadow:0 0 0 2px #fffaf0,0 0 0 3px rgba(59,42,31,.5)}
#dz .dz-p b{font-weight:600;overflow:hidden;text-overflow:ellipsis;max-width:8em}
#dz .dz-p .w{font-family:var(--f-num,monospace);font-size:13px;font-weight:700;color:#5b4129;min-width:3em;text-align:right}
#dz .dz-p.low .w{color:#c0281c;animation:dzBlink 1s steps(2,start) infinite}
@keyframes dzBlink{50%{opacity:.25}}
#dz .dz-p .st{font-size:12px;color:var(--muted,#7a6550)}
#dz .dz-p.on{border-color:#c08a17;box-shadow:0 0 0 2px #f2b632}
#dz .dz-row{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;width:100%;pointer-events:none;min-height:44px}
.stage.dz3d #dz .dz-row{height:44px;min-height:0;flex:none;align-items:flex-start;padding-top:4px;overflow:visible;position:relative;z-index:1}
#dz .dz-hint:empty{visibility:hidden}
#dz .dz-hint{flex:1 1 200px;min-width:0;font-size:13px;line-height:1.3;color:#5b4129;text-align:center;min-height:17px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
#dz .dz-bd{position:relative;flex:1;min-height:0;width:100%}
#dz svg.dz-board{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);pointer-events:auto;touch-action:manipulation;user-select:none;-webkit-user-select:none;filter:drop-shadow(0 6px 8px rgba(59,42,31,.35))}
@media (max-width:520px){#dz .dz-p{font-size:12px;padding:3px 8px 4px;gap:5px}#dz .dz-bar{max-width:calc(100% - 150px)}}
@media (max-width:520px){.stage.dz2d #dz .dz-bar{align-self:flex-start;width:calc(100% - 150px);max-width:none}}
.stage.dz3d #dz .dz-row{order:-1}
.stage.dz3d #dz.lay .dz-bar{transform:translateY(calc(var(--bs) - 100%));transition:transform .35s,opacity .35s}
.stage.dz3d #dz.lay .dz-mebar{top:var(--mt);bottom:auto;transition:top .35s,opacity .35s}
.stage.dz3d .specbar:not([hidden])~#dz .dz-bar{margin-top:0}
.stage.dz3d .specbar:not([hidden])~#dz .dz-row{margin-top:30px}
.stage.dz3d #dz.wide .dz-row{position:absolute;left:16px;top:8px;width:auto;max-width:34%;justify-content:flex-start}
.stage.dz3d #dz.wide .dz-bar{min-height:0}
.stage.dz3d .specbar:not([hidden])~#dz.wide .dz-bar{margin-top:30px}
@media (max-width:699px){#dz{padding-bottom:112px}#dz .dz-mebar{bottom:70px;max-width:calc(100% - 24px)}}
`;
  document.head.appendChild(css);
  elDz=document.createElement('div');elDz.id='dz';elDz.hidden=true;
  elDz.innerHTML=`<div class="dz-bar"></div><div class="dz-mebar"></div><div class="dz-row"><div class="dz-hint" aria-live="polite"></div></div><div class="dz-bd"><svg class="dz-board" viewBox="-.3 -1.3 3.6 6.9" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="동물장기판"><defs><radialGradient id="dzAtt"><stop offset="0" stop-color="#ff2a14" stop-opacity=".85"/><stop offset=".6" stop-color="#e01e14" stop-opacity=".45"/><stop offset="1" stop-color="#c8140a" stop-opacity="0"/></radialGradient></defs><g id="dzMain"></g><g id="dzGhost"></g></svg></div>`;
  $('#stage').insertBefore(elDz,$('#fx'));
  elSvg=elDz.querySelector('svg.dz-board');elMain=elDz.querySelector('#dzMain');elGhost=elDz.querySelector('#dzGhost');
  elBar=elDz.querySelector('.dz-bar');elBarMe=elDz.querySelector('.dz-mebar');elHint=elDz.querySelector('.dz-hint');
  elSvg.addEventListener('click',onSvgClick);
  document.addEventListener('keydown',e=>{if(e.code==='Escape'&&(pend||sel>=0)&&elDz&&!elDz.hidden)cancelSel()});
  window.addEventListener('resize',()=>{fit();Dz3.lay=''});
  $('#cv').addEventListener('click',d3Click);
};
G._d3={Dz3,IN,introEnd,pW,get CS(){return CS},tapSq,tapHand,myMoves,movesFrom,get sel(){return sel},get pend(){return pend},d3Point,handXZ};   // 화면 검사용

if(typeof window!=='undefined')(window.GAMES=window.GAMES||{}).animal=G;
})();
