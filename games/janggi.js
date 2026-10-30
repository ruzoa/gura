/* ===== 장기 게임 모듈 =====
   공통 코드(index.html)가 GAMES.janggi의 함수를 불러서 이 게임의 규칙·봇·화면을 그림. 화면 틀은 체스(games/chess.js)를 따름.
   판: 9줄 × 10줄 교차점. 칸 번호 = y*9 + x (x 0~8, y 0 = 초 쪽 끝 줄 … 9 = 한 쪽 끝 줄). 기물: 1 졸·병 2 사 3 상 4 마 5 포 6 차 7 장, 한은 +8 (0은 빈 점)
   두 사람. 초가 먼저 상차림을 고르고, 한이 그걸 보고 고른 뒤, 초가 먼저 둠. 방 설정: 총 시간 tm(분), 추가 시간 inc(초), 선 플레이어 pickfirst(켜면 방장이 대기실에서 초를 고름), 반복 rep(0 3회까지, 1 무제한)
   끝: 외통(장군을 피할 수 없음) 승리, 빅장(마주 본 궁을 응수한 뒤에도 마주 보면) 무승부, 시간 초과 패배, 점수 계산 합의·반복 판정은 남은 기물 점수(한 덤 1.5)
   반복(3회까지): 같은 국면(같은 쪽 차례)이 네 번째로 나오는 수는 둘 수 없음. 단 양쪽 모두 덤을 뺀 점수가 30점 미만이면 둘 수 있고, 두면 점수로 판정
   손패(hand)는 표시용 값 [0] (공통 코드가 hand가 비면 끝난 사람으로 봄) */
(function(){
const G={id:'janggi',name:'장기',short:'장기',lead:'상차림부터 외통까지',brand:'장기',brandPx:62,maxHi:2,minN:2,noFast:true,firstPick:true,oneBotLv:true};

/* ---------- 규칙 엔진 (방장 엔진·화면·봇·테스트가 같은 함수를 씀) ---------- */
const ZOL=1,SA=2,SANG=3,MA=4,PO=5,CHA=6,JANG=7;
const VAL=[0,2,3,3,5,7,13,0];   // 점수 (덤 빼고): 졸·병 2, 사·상 3, 마 5, 포 7, 차 13 → 한 쪽 72점
const DUM=1.5,LOW=30;            // 한의 덤, 반복을 허용하는 점수(양쪽 모두 이 아래)
const NM=[['','졸','사','상','마','포','차','장'],['','병','사','상','마','포','차','장']];
const HJ=[['','卒','士','象','馬','包','車','楚'],['','兵','士','象','馬','包','車','漢']];
const CNAME=['초','한'];
const N=90,PASS=127|(127<<7);
const X=i=>i%9,Y=i=>(i/9)|0,IX=(x,y)=>y*9+x;
const inB=(x,y)=>x>=0&&x<9&&y>=0&&y<10;
const inPal=(x,y)=>x>=3&&x<=5&&(y<=2||y>=7);
/* 궁성 대각선: 그어진 선 위로만 (가운데 점은 네 방향, 모서리는 가운데 쪽 한 방향) */
const PD=[];
for(let i=0;i<N;i++){const x=X(i),y=Y(i),o=[];if(inPal(x,y)){const cy=y<=2?1:8;if(x===4&&y===cy)o.push([1,1],[1,-1],[-1,1],[-1,-1]);else if(x!==4&&y!==cy)o.push([Math.sign(4-x),Math.sign(cy-y)])}PD.push(o)}
const hasD=(i,dx,dy)=>PD[i].some(d=>d[0]===dx&&d[1]===dy);
const OR=[[1,0],[-1,0],[0,1],[0,-1]];
/* 마·상의 길: 곧게 한 칸(o) 뒤 대각선 바깥(p). 마는 2o+p, 상은 3o+2p. 막히는 자리(멱): 마 o, 상 o·2o+p */
const HP=[];for(const [ox,oy] of OR)for(const s of [1,-1])HP.push([ox,oy,oy?s:0,ox?s:0]);
const mF=m=>m&127,mT=m=>(m>>7)&127,mk=(f,t)=>f|(t<<7);
/* 국면 해시: 32비트 두 줄, 고정 씨앗 (모든 기기에서 같음) */
const Z1=new Int32Array(16*N),Z2=new Int32Array(16*N);let ZS1=0,ZS2=0;
{let s=0x2545F491;const r=()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return s|0};for(let i=0;i<Z1.length;i++){Z1[i]=r();Z2[i]=r()}ZS1=r();ZS2=r()}
function newPos(){return {b:new Int8Array(N),side:0,k:[-1,-1],h1:0,h2:0,st:[]}}
function rehash(p){let a=0,c=0;for(let i=0;i<N;i++){const v=p.b[i];if(v){a^=Z1[v*N+i];c^=Z2[v*N+i]}}if(p.side){a^=ZS1;c^=ZS2}p.h1=a;p.h2=c}
function clonePos(p){const q=newPos();q.b.set(p.b);q.side=p.side;q.k=p.k.slice();q.h1=p.h1;q.h2=p.h2;return q}
/* 상차림: 자기 쪽에서 본 왼쪽부터 끝 줄 2·3·7·8번째 자리 */
const SETUPS=[[MA,SANG,MA,SANG],[MA,SANG,SANG,MA],[SANG,MA,MA,SANG],[SANG,MA,SANG,MA]];
const SU_NAME=['마상마상','마상상마','상마마상','상마상마'];
const suXs=c=>c?[7,6,2,1]:[1,2,6,7];
/* 처음 국면 (su[색]이 -1이면 그 쪽 마·상은 아직 없음: 상차림 중) */
function startPos(su){
  const p=newPos(),put=(x,y,t,c)=>{p.b[IX(x,y)]=t|(c<<3)};
  for(const c of [0,1]){
    const yy=d=>c?9-d:d;
    put(0,yy(0),CHA,c);put(8,yy(0),CHA,c);put(3,yy(0),SA,c);put(5,yy(0),SA,c);put(4,yy(1),JANG,c);put(1,yy(2),PO,c);put(7,yy(2),PO,c);
    for(const x of [0,2,4,6,8])put(x,yy(3),ZOL,c);
    const s=su&&su[c]>=0?SETUPS[su[c]]:null;
    if(s)suXs(c).forEach((x,k)=>put(x,yy(0),s[k],c));
  }
  p.k=[IX(4,1),IX(4,8)];rehash(p);return p;
}
/* sq가 by 쪽에게 공격받나 (장군 판정) */
function attacked(p,sq,by){
  const b=p.b,o=by<<3,x=X(sq),y=Y(sq),tPo=(b[sq]&7)===PO,fw=by?-1:1;
  for(const [dx,dy] of OR){   // 차: 곧게 첫 기물 / 포: 포가 아닌 기물 하나 너머
    let cx=x+dx,cy=y+dy,first=0;
    while(inB(cx,cy)){const v=b[IX(cx,cy)];if(v){if(!first){if(v===(CHA|o))return true;if((v&7)===PO)break;first=1}else{if(v===(PO|o)&&!tPo)return true;break}}cx+=dx;cy+=dy}
  }
  if(inB(x,y-fw)&&b[IX(x,y-fw)]===(ZOL|o))return true;   // 졸: 앞과 옆
  for(const dx of [1,-1])if(inB(x+dx,y)&&b[IX(x+dx,y)]===(ZOL|o))return true;
  if(inPal(x,y))for(const [dx,dy] of OR){const nx=x+dx,ny=y+dy;if(inB(nx,ny)&&inPal(nx,ny)){const v=b[IX(nx,ny)];if(v===(JANG|o)||v===(SA|o))return true}}
  for(const [dx,dy] of PD[sq]){   // 궁성 대각선
    const n1=sq+dx+dy*9,v=b[n1];
    if(v===(CHA|o)||v===(JANG|o)||v===(SA|o))return true;
    if(v===(ZOL|o)&&-dy===fw)return true;
    if(hasD(n1,dx,dy)){const w=b[n1+dx+dy*9];if(!v&&w===(CHA|o))return true;if(v&&(v&7)!==PO&&w===(PO|o)&&!tPo)return true}
  }
  for(const [ox,oy,px,py] of HP){
    let hx=x-2*ox-px,hy=y-2*oy-py;
    if(inB(hx,hy)&&b[IX(hx,hy)]===(MA|o)&&!b[IX(hx+ox,hy+oy)])return true;
    hx=x-3*ox-2*px;hy=y-3*oy-2*py;
    if(inB(hx,hy)&&b[IX(hx,hy)]===(SANG|o)&&!b[IX(hx+ox,hy+oy)]&&!b[IX(hx+2*ox+px,hy+2*oy+py)])return true;
  }
  return false;
}
/* 둘 수 있을지도 모르는 수 (장이 공격받는지는 아직 안 봄) */
function gen(p,out){
  const b=p.b,us=p.side,them=us^1;
  const add=(f,t)=>{const q=b[t];if(!q||(q>>3)===them)out.push(mk(f,t))};
  for(let i=0;i<N;i++){
    const v=b[i];if(!v||(v>>3)!==us)continue;
    const t=v&7,x=X(i),y=Y(i);
    if(t===JANG||t===SA){
      for(const [dx,dy] of OR){const nx=x+dx,ny=y+dy;if(inB(nx,ny)&&inPal(nx,ny))add(i,IX(nx,ny))}
      for(const [dx,dy] of PD[i])add(i,i+dx+dy*9);
    }else if(t===CHA){
      for(const [dx,dy] of OR){let cx=x+dx,cy=y+dy;while(inB(cx,cy)){const s=IX(cx,cy),q=b[s];if(!q)out.push(mk(i,s));else{if((q>>3)===them)out.push(mk(i,s));break}cx+=dx;cy+=dy}}
      for(const [dx,dy] of PD[i]){let s=i;while(hasD(s,dx,dy)){s+=dx+dy*9;const q=b[s];if(!q)out.push(mk(i,s));else{if((q>>3)===them)out.push(mk(i,s));break}}}
    }else if(t===PO){
      for(const [dx,dy] of OR){let cx=x+dx,cy=y+dy,scr=false;while(inB(cx,cy)){const s=IX(cx,cy),q=b[s];
        if(!scr){if(q){if((q&7)===PO)break;scr=true}}
        else if(!q)out.push(mk(i,s));else{if((q>>3)===them&&(q&7)!==PO)out.push(mk(i,s));break}
        cx+=dx;cy+=dy}}
      for(const [dx,dy] of PD[i]){const n1=i+dx+dy*9,q=b[n1];if(q&&(q&7)!==PO&&hasD(n1,dx,dy)){const n2=n1+dx+dy*9,w=b[n2];if(!w||((w>>3)===them&&(w&7)!==PO))out.push(mk(i,n2))}}
    }else if(t===MA||t===SANG){
      for(const [ox,oy,px,py] of HP){
        if(!inB(x+ox,y+oy)||b[IX(x+ox,y+oy)])continue;
        if(t===MA){const tx=x+2*ox+px,ty=y+2*oy+py;if(inB(tx,ty))add(i,IX(tx,ty))}
        else{const tx=x+3*ox+2*px,ty=y+3*oy+2*py;if(inB(tx,ty)&&!b[IX(x+2*ox+px,y+2*oy+py)])add(i,IX(tx,ty))}
      }
    }else if(t===ZOL){
      const fw=us?-1:1;
      for(const [dx,dy] of [[0,fw],[1,0],[-1,0]]){const nx=x+dx,ny=y+dy;if(inB(nx,ny))add(i,IX(nx,ny))}
      for(const [dx,dy] of PD[i])if(dy===fw)add(i,i+dx+dy*9);
    }
  }
  return out;
}
/* 수 두기·되돌리기 (한 수 쉬기 PASS도 같은 길) */
function make(p,m){
  const st=p.st;
  if(m===PASS){st.push(m,0,p.h1,p.h2);p.side^=1;p.h1^=ZS1;p.h2^=ZS2;return}
  const b=p.b,f=mF(m),t=mT(m),pc=b[f],cap=b[t];
  st.push(m,cap,p.h1,p.h2);
  let a=p.h1^Z1[pc*N+f]^Z1[pc*N+t],c=p.h2^Z2[pc*N+f]^Z2[pc*N+t];
  if(cap){a^=Z1[cap*N+t];c^=Z2[cap*N+t]}
  b[t]=pc;b[f]=0;if((pc&7)===JANG)p.k[pc>>3]=t;
  p.side^=1;p.h1=a^ZS1;p.h2=c^ZS2;
}
function unmake(p){
  const st=p.st,n=st.length,h2=st[n-1],h1=st[n-2],cap=st[n-3],m=st[n-4];st.length=n-4;
  p.side^=1;p.h1=h1;p.h2=h2;if(m===PASS)return;
  const b=p.b,f=mF(m),t=mT(m),pc=b[t];b[f]=pc;b[t]=cap;if((pc&7)===JANG)p.k[pc>>3]=f;
}
const inCheck=p=>attacked(p,p.k[p.side],p.side^1);
/* 정말로 둘 수 있는 수 (내 장이 공격받지 않게 남는 수). 장군이 아니면 한 수 쉬기도 됨 */
function legal(p,noPass){
  const out=gen(p,[]),res=[],us=p.side;
  for(const m of out){make(p,m);if(!attacked(p,p.k[us],us^1))res.push(m);unmake(p)}
  if(!noPass&&!attacked(p,p.k[us],us^1))res.push(PASS);
  return res;
}
/* 빅장: 두 장이 같은 세로줄에서 사이에 아무것도 없이 마주 봄 */
function facing(p){
  const a=p.k[0],c=p.k[1];if(a<0||c<0||X(a)!==X(c))return false;
  for(let s=a+9;s<c;s+=9)if(p.b[s])return false;
  return true;
}
function score(p,col){let s=0;for(let i=0;i<N;i++){const v=p.b[i];if(v&&(v>>3)===col)s+=VAL[v&7]}return s}
const lowMat=p=>score(p,0)<LOW&&score(p,1)<LOW;
const judgeCol=p=>score(p,0)>score(p,1)+DUM?0:1;   // 점수 판정에서 이기는 색 (덤이 있어 비기지 않음)
const repKey=p=>(p.h1>>>0).toString(36)+'.'+(p.h2>>>0).toString(36);
const toU=m=>m===PASS?'pp':String(mF(m)).padStart(2,'0')+String(mT(m)).padStart(2,'0');
function fromU(p,u,ls){
  if(u==='pp')return (ls||legal(p)).includes(PASS)?PASS:0;
  if(typeof u!=='string'||u.length!==4)return 0;
  const m=mk(+u.slice(0,2),+u.slice(2,4));
  return (ls||legal(p)).includes(m)?m:0;
}
/* 반복 판정: 0 둘 수 있음, 1 금수(네 번째 반복), 2 둘 수 있지만 두면 점수 판정(양쪽 30점 미만) */
function repState(p,m,reps,mode){
  if(mode||!reps)return 0;
  make(p,m);const c=reps[repKey(p)]||0,low=lowMat(p);unmake(p);
  return c>=3?(low?2:1):0;
}
/* 상차림·기보를 처음부터 다시 두어 지금 국면과 반복 횟수를 만듦 */
function replay(su,ucis){
  const p=startPos(su),reps={};
  const bump=()=>{const k=repKey(p);reps[k]=(reps[k]||0)+1;return reps[k]};
  bump();
  for(const u of ucis||[]){const m=fromU(p,u);if(!m)break;make(p,m);p.st.length=0;bump()}
  return {p,reps};
}
/* 사람이 읽는 수 이름: '차 잡음' 꼴 (진행 기록용) */
function moveName(p,m){
  if(m===PASS)return '한 수 쉼';
  const v=p.b[mF(m)],c=p.b[mT(m)],col=v>>3;
  const pos=i=>{const x=X(i)+1,y=col?10-Y(i):Y(i)+1;return `${y%10}${col?10-x:x}`};   // 내 쪽에서 센 줄·세로줄 (장기 기보처럼)
  return `${pos(mF(m))}${NM[col][v&7]}${pos(mT(m))}${c?` (${NM[c>>3][c&7]} 잡음)`:''}`;
}

/* ---------- 봇 (쉬움): 두 수 앞까지 + 잡는 수 정리 탐색, 흔들림 크고 가끔 엉뚱한 수 ---------- */
let BOTSCALE=1;   // 테스트에서 탐색 양을 줄임
const MATE=30000;
function evalPos(p){   // 둘 차례인 쪽 기준 (1점 = 100)
  const b=p.b;let s=0;
  for(let i=0;i<N;i++){
    const v=b[i];if(!v)continue;
    const t=v&7,col=v>>3,sg=col===p.side?1:-1;let e=VAL[t]*100;
    if(t===ZOL){const adv=col?9-Y(i):Y(i);e+=(adv-3)*6;if(adv>=7&&X(i)>=3&&X(i)<=5)e+=12}
    else if(t===MA||t===SANG){if(col?Y(i)<9:Y(i)>0)e+=8}
    else if(t===SA){const k=p.k[col];if(Math.abs(X(k)-X(i))+Math.abs(Y(k)-Y(i))<=1)e+=6}
    s+=sg*e;
  }
  return s+(p.side?DUM*100:-DUM*100)*.3;
}
function qs(p,alpha,beta,d,ctx){
  ctx.n++;
  const st=evalPos(p);if(st>=beta)return st;if(st>alpha)alpha=st;
  if(d>=4||ctx.n>ctx.max)return st;
  const us=p.side,caps=gen(p,[]).filter(m=>p.b[mT(m)]).sort((a,c)=>VAL[p.b[mT(c)]&7]-VAL[p.b[mT(a)]&7]);
  for(const m of caps){
    make(p,m);if(attacked(p,p.k[us],us^1)){unmake(p);continue}
    const v=-qs(p,-beta,-alpha,d+1,ctx);unmake(p);
    if(v>=beta)return v;if(v>alpha)alpha=v;
  }
  return alpha;
}
function search(p,d,alpha,beta,ply,ctx){
  ctx.n++;
  if(d<=0)return qs(p,alpha,beta,0,ctx);
  const fb=facing(p),ms=legal(p);
  if(!ms.length)return -MATE+ply;   // 외통 (장군이라 쉬지도 못함)
  ms.sort((a,c)=>(c!==PASS&&p.b[mT(c)]?VAL[p.b[mT(c)]&7]:0)-(a!==PASS&&p.b[mT(a)]?VAL[p.b[mT(a)]&7]:0));
  let best=-MATE*2;
  for(const m of ms){
    make(p,m);
    const v=fb&&facing(p)?0:-search(p,d-1,-beta,-alpha,ply+1,ctx);   // 빅장을 응수하지 않으면 비김
    unmake(p);
    if(v>best)best=v;if(v>alpha)alpha=v;if(alpha>=beta)break;
  }
  return best;
}
/* 봇이 고르는 수: 반복은 피하고(금수는 빼고), 점수에 흔들림을 더함 */
function botPick(p,reps,mode,o){
  o=o||{};
  const noise=o.noise??120,wild=o.wild??.12,ls=legal(p).filter(m=>repState(p,m,reps,mode)!==1);
  if(!ls.length)return 0;
  const fb=facing(p),ctx={n:0,max:Math.round(9000*BOTSCALE)+400},sc=[];
  for(const m of ls){
    make(p,m);
    let v=fb&&facing(p)?0:-search(p,1,-MATE*2,MATE*2,1,ctx);
    if(reps)v-=40*(reps[repKey(p)]||0);   // 왔던 국면은 피함 (무제한 반복에서도 끝없이 되풀이하지 않게)
    unmake(p);
    if(m===PASS)v-=25;   // 꼭 필요할 때만 쉼
    sc.push([m,v]);
  }
  const top=Math.max(...sc.map(x=>x[1]));
  if(Math.random()<wild){const ok=sc.filter(x=>x[1]>top-260&&x[0]!==PASS);if(ok.length)return ok[Math.random()*ok.length|0][0]}
  let bm=sc[0][0],bv=-Infinity;
  for(const [m,v] of sc){const w=Math.abs(v)>MATE-500?v:v+(Math.random()*2-1)*noise;if(w>bv){bv=w;bm=m}}
  return bm;
}
const botSetup=()=>Math.random()*4|0;

/* ---------- 규칙 설명·방 설정 ---------- */
G.rulesHTML='<ol class="rules"><li><b>목표</b> : 상대 장을 피할 수 없게 몰면(<b>외통</b>) 이깁니다. 초가 먼저 두고 번갈아 한 수씩 둡니다</li><li><b>상차림</b> : 시작하면 끝 줄의 마·상 자리를 정합니다. 초가 먼저 고르고, 한은 초의 상차림을 보고 고릅니다(마상마상·마상상마·상마마상·상마상마). 고를 시간은 20초이고, 넘으면 마상마상입니다</li><li><b>기물</b> : 차는 가로·세로로 끝까지, 포는 다른 기물 하나를 넘어서 갑니다(포끼리는 넘지도 잡지도 못함). 마는 한 칸 곧게 간 뒤 대각선 한 칸, 상은 한 칸 곧게 간 뒤 대각선 두 칸이고 가는 길에 기물이 있으면 막힙니다(멱). 장·사는 궁성 안에서 선을 따라 한 칸, 졸·병은 앞과 옆으로 한 칸 갑니다. 궁성 안에서는 그어진 대각선을 따라서도 갑니다(졸·병은 앞쪽 대각선만)</li><li><b>장군</b> : 장이 공격받으면 장이 붉게 빛납니다. 장군을 풀지 않는 수는 둘 수 없습니다</li><li><b>한 수 쉬기</b> : 아래쪽 내 이름 칸을 눌러 차례를 넘길 수 있습니다. 장군일 때는 쉴 수 없습니다</li><li><b>빅장</b> : 두 장이 같은 줄에서 사이에 아무것도 없이 마주 보면 빅장입니다. 받은 쪽이 응수한 뒤에도 마주 보고 있으면 <b>무승부</b>입니다</li><li><b>반복</b> : 탁자 설정이 <b>3회까지</b>면 같은 국면이 네 번째로 나오는 수는 둘 수 없습니다(빨간 ✕). 단 양쪽 모두 남은 기물이 30점(덤 빼고) 미만이면 둘 수 있고, 두면 남은 기물 점수로 승패를 정합니다. <b>무제한</b>이면 반복해도 됩니다</li><li><b>점수</b> : 차 13, 포 7, 마 5, 상·사 3, 졸·병 2점이고 승패를 가릴 때만 한에 덤 1.5점을 더합니다. 내 이름 칸을 눌러 <b>점수 계산</b>을 제안할 수 있고, 상대가 받으면 남은 기물 점수로 승패를 정합니다(한 판에 세 번까지)</li><li><b>시계</b> : 두 사람이 각자의 총 시간을 씁니다. 한 수를 둘 때마다 추가 시간이 붙고, 총 시간을 다 쓰면 <b>패배</b>합니다. 연결이 끊겨도 시계는 흐르고, 45초 안에 돌아오지 않으면 탈주로 처리합니다</li><li><b>선 플레이어</b> : 첫 판은 탁자 설정으로 정합니다(선택이면 방장이 대기실에서 초를 고름). 결과 화면에서 바로 시작하면 초·한을 바꿉니다</li><li><b>조작</b> : 내 기물을 누르면 갈 수 있는 점(잡을 수 있는 점은 고리)이 보입니다. 점을 누르면 미리 보기, <b>[두기]</b>로 확정합니다. 설정의 <b>두 번 눌러 놓기</b>를 켜면 같은 점을 한 번 더 눌러 바로 둡니다. 상대 차례에도 미리 골라 둘 수 있습니다</li></ol>';
G.modeDesc=['외통하면 끝','외통하면 끝'];
const clockTxt=c=>`${+c.tm||10}+${+c.inc||0}`;
G.defaults={max:2,turn:30,tm:10,inc:10,pickfirst:0,rep:0};
G.roomSet=[
  {k:'tm',label:'총 시간',unit:'분',lo:1,hi:60,step:1,desc:'한 사람이 쓸 수 있는 전체 시간입니다. 다 쓰면 패배합니다'},
  {k:'inc',label:'추가 시간',unit:'초',lo:0,hi:60,step:1,desc:'한 수를 둘 때마다 늘어나는 시간입니다'}];
G.ruleSet=[
  {k:'pickfirst',pick:1,label:'선 플레이어',desc:'선택: 방장이 대기실에서 초(먼저 두는 사람)를 고릅니다. 무작위: 랜덤이고, 바로 시작하면 초·한을 바꿉니다'},
  {k:'rep',label:'같은 수 반복',boardLabel:'반복',named:['3회까지','무제한'],desc:'3회까지: 같은 국면이 네 번째로 나오는 수는 둘 수 없습니다(양쪽 모두 30점 미만이면 두고 점수로 판정). 무제한: 반복해도 됩니다'}];
const repTxt=c=>+c.rep?'무제한':'3회까지';
G.cfgChips=c=>`<span class="chip">시계 <b>${clockTxt(c)}</b></span><span class="chip">반복 <b>${repTxt(c)}</b></span><span class="chip">선 <b>${+c.pickfirst?'선택':'무작위'}</b></span>`;
G.cfgSum=c=>`시계 ${+c.tm||10}분 + ${+c.inc||0}초 · 반복 ${repTxt(c)} · 선 ${+c.pickfirst?'선택':'무작위'}`;
G.roomSub=()=>'2명 보드게임';
G.pubExtra=()=>({});
G.cardInfo=(c,nowN)=>`<p class="cardinfo">${nowN>2?'장기는 두 명이 하는 게임입니다.':'두 명이 하는 게임입니다.'}</p>`;
G.rankTitle=()=>'';
G.finLabel=()=>'';
G.noEmotes=[];
G.keys={};
G.keyActions=[];
G.cardHTML=()=>'';G.drawFace=()=>{};G.cmpCard=()=>0;G.labelOf=()=>'';

/* ---------- 방장 엔진 (규칙 처리) ----------
   H.c: 저장할 수 있는 값만 둠(JSON). 지금 국면은 상차림 su + 기보 mv를 다시 두어 만들고 HC에 기억 */
const SET_MS=20000,BOT_CAP=600;   // 상차림 고를 시간, 봇끼리 둘 때 점수로 끝내는 수(반 수)
const HC={c:null,n:-1,su:'',p:null,reps:null};
function hostPos(){
  const C=H.c,sk=C.su.join();
  if(HC.c!==C||HC.n!==C.mv.length||HC.su!==sk){const r=replay(C.su,C.mv);HC.c=C;HC.n=C.mv.length;HC.su=sk;HC.p=r.p;HC.reps=r.reps}
  return HC.p;
}
const other=i=>1-i;
const seatOfColor=col=>H.c.co[0]===col?0:1;
function sameNames(a,b){return a.length===2&&b.length===2&&a.every(x=>b.includes(x))&&a[0]!==a[1]}
/* 첫 판 초: 결과 화면에서 바로 시작하면 지난 판과 바꿈, 아니면 공통 firstSeat (선택이면 방장이 고른 사람, 아니면 랜덤) */
function pickCho(again){
  const ns=H.players.slice(0,2).map(p=>p.name),L=H.jLast;
  if(again&&L&&L.ns&&sameNames(ns,L.ns))return ns.indexOf(L.h);
  return typeof firstSeat==='function'?firstSeat(2):(Math.random()<.5?0:1);
}
function botDelay(){return rand(600,1500)}
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
const WHY_TXT={mate:'외통',time:'시간 초과',surrender:'항복',desert:'탈주',bik:'빅장',rep:'반복 · 점수',agree:'점수 계산',stuck:'둘 수 없음 · 점수',long:'수 제한 · 점수'};
const scoreBy=(p,col)=>score(p,col)+(col?DUM:0);
function finishGame(winSeat,why){
  const C=H.c,p=hostPos();
  C.res={w:winSeat,why:why||'',sc:[scoreBy(p,0),scoreBy(p,1)]};C.dr=-1;
  if(winSeat>=0){
    const l=other(winSeat),pw=H.players[winSeat],pl=H.players[l];
    pw.finished=true;pw.rank=1;pw.hand=[];
    pl.finished=true;pl.rank=2;pl.hand=[];
    if(why==='time')pl.surrendered='time';else if(why==='surrender'||why==='desert')pl.surrendered=true;
    const sc=C.res.sc;
    addLog(why==='time'?`${pl.name} 시간 초과로 패배! ${pw.name} 승리`:why==='surrender'||why==='desert'?`${pl.name} ${why==='desert'?'탈주':'항복'}! ${pw.name} 승리`:why==='mate'?`외통! ${pw.name} 승리 (${CNAME[C.co[winSeat]]})`:`점수 초 ${sc[0]} : 한 ${sc[1]} — ${pw.name} 승리`,why==='mate'?'fin':'lie');
  }else{
    for(const i of [0,1]){const p=H.players[i];p.finished=true;p.rank=1;p.hand=[]}
    addLog(`무승부입니다. (${WHY_TXT[why]||''})`,'sys');
  }
  H.jLast={ns:H.players.slice(0,2).map(p=>p.name),h:H.players[seatOfColor(1)].name};   // 바로 시작하면 지난 판의 한이 초
  H.phase='over';H.botActAt=0;mark();
  H.players.forEach((p,i)=>{if(p.bot&&i<2&&Math.random()<.5)botEmote(i,'gg',800+Math.random()*1600)});
}
const finishScore=why=>{const p=hostPos();finishGame(seatOfColor(judgeCol(p)),why)};
/* 상차림: 초가 고르면 한 차례, 한이 고르면 초가 첫 수 */
function doSetup(seat,v){
  const C=H.c;v=v|0;
  if(C.ph!=='set'||C.mv_!==seat||v<0||v>3)return false;
  const col=C.co[seat];if(C.su[col]>=0)return false;
  C.su[col]=v;HC.c=null;
  addLog(`${H.players[seat].name} 상차림 ${SU_NAME[v]}`,'sys');
  const t=clock();
  if(col===0){const h=seatOfColor(1);C.mv_=h;H.turn=h;C.sdl=t+SET_MS;H.botActAt=H.players[h].bot?t+rand(900,1800):0}
  else{const c0=seatOfColor(0);C.ph='play';C.mv_=c0;H.turn=c0;C.since=t;C.mvBot=H.players[c0].bot?1:0;H.botActAt=H.players[c0].bot?t+rand(1100,1900):0}
  mark();return true;
}
/* 한 수: 기보에 더하고, 잡은 기물·장군·빅장·끝 판정 */
function doMove(seat,u){
  const C=H.c;if(C.ph!=='play')return false;
  const p=hostPos();
  if(C.co[seat]!==p.side)return false;
  const ls=legal(p),m=fromU(p,u,ls);if(!m)return false;
  const rs=repState(p,m,HC.reps,C.R.rep);if(rs===1)return false;   // 네 번째 반복: 금수
  const fb=facing(p),name=moveName(p,m),cap=m===PASS?0:p.b[mT(m)];
  make(p,m);p.st.length=0;
  C.mv.push(toU(m));HC.n=C.mv.length;
  const k=repKey(p);HC.reps[k]=(HC.reps[k]||0)+1;
  if(cap)C.cp[seat].push(cap&7);
  C.lm=m===PASS?null:[mF(m),mT(m)];C.chk=inCheck(p)?1:0;C.bik=facing(p)?1:0;
  if(C.dr===other(seat))C.dr=-1;   // 제안을 받은 사람이 그냥 두면 없던 일
  addLog(`${C.mv.length}. ${H.players[seat].name} ${name}${C.bik&&!fb?' · 빅장':C.chk?' · 장군':''}`);
  if(fb&&C.bik){finishGame(-1,'bik');return true}
  const ls2=legal(p);
  if(!ls2.length){finishGame(seat,'mate');return true}
  if(rs===2){finishScore('rep');return true}
  if(!C.R.rep&&!ls2.some(x=>repState(p,x,HC.reps,0)!==1)){finishScore('stuck');return true}   // 둘 수 있는 수가 모두 반복 금수
  if(C.mv.length>=BOT_CAP&&H.players[0].bot&&H.players[1].bot&&!awayHuman(H.players[0])&&!awayHuman(H.players[1])){finishScore('long');return true}
  setMover(other(seat),true);
  return true;
}
function doSurrender(seat){
  if(H.phase!=='play'||seat<0||seat>1||H.players[seat].finished)return;
  finishGame(other(seat),H.players[seat].deserter?'desert':'surrender');
}
/* 점수 계산 제안: 내 제안이 없으면 제안(다시 누르면 거둠), 상대 제안이 있으면 받음 */
function doOffer(seat){
  const C=H.c;
  if(H.phase!=='play'||C.ph!=='play'||seat<0||seat>1)return;
  if(C.dr===other(seat)){addLog(`${H.players[seat].name} 점수 계산을 받았습니다.`,'sys');finishScore('agree');return}
  if(C.dr===seat){C.dr=-1;mark();return}
  if(C.drN[seat]>=3)return;
  C.dr=seat;C.drN[seat]++;
  addLog(`${H.players[seat].name} 점수 계산을 제안합니다.`,'sys');
  const o=H.players[other(seat)];if(o&&o.bot&&!awayHuman(o))C.drBot=clock()+rand(1200,2400);
  mark();
}
function timeout(){const C=H.c;finishGame(other(C.mv_),'time')}
function botTurn(i){
  const C=H.c;
  if(C.ph==='set'){doSetup(i,botSetup());return}
  const p=hostPos(),m=botPick(p,HC.reps,C.R.rep);
  if(!m||!doMove(i,toU(m)))finishScore('stuck');
}
G._test={startPos,legal,gen,make,unmake,attacked,inCheck,facing,score,judgeCol,repKey,repState,replay,toU,fromU,moveName,evalPos,botPick,setBotScale:f=>{BOTSCALE=f},doMove,doSetup,doOffer,timeout,pickCho,IX,X,Y,PASS,ZOL,SA,SANG,MA,PO,CHA,JANG,newPos,rehash,SETUPS};
G.engine={
  start(){
    const again=H.phase==='over',R={tm:Math.max(1,+H.cfg.tm||10),inc:Math.max(0,+H.cfg.inc||0),rep:+H.cfg.rep?1:0};
    Object.assign(H,{phase:'play',log:[],seatNote:{},field:[],last:null,reveal:null,shouts:[],pending:null,rankNext:1,known:{}});
    H.players.forEach((p,i)=>{
      p.finished=false;p.rank=null;p.surrendered=false;
      if(i<2)p.hand=[0];else{p.hand=[];p.finished=true;p.rank=i+1}
    });
    const A=pickCho(again),t=clock();
    H.c={R,A,co:A===0?[0,1]:[1,0],ph:'set',su:[-1,-1],sdl:t+SET_MS,mv:[],cp:[[],[]],lm:null,chk:0,bik:0,mv_:A,rem:[R.tm*60000,R.tm*60000],since:t,mvBot:0,res:null,dr:-1,drN:[0,0],drBot:0};
    HC.c=null;H.turn=A;
    H.botActAt=H.players[A].bot?t+rand(900,1800):0;
    addLog(`${H.players[A].name}님이 초로 먼저 시작합니다.`,'sys');
    mark();
  },
  act(seat,a){
    if(a.t==='surrender'){doSurrender(seat);return}
    const C=H.c;
    if(!C||H.phase!=='play'||seat<0||seat>1)return;
    if(a.t==='offer'){doOffer(seat);return}
    if(a.t==='su'&&C.mv_===seat){doSetup(seat,a.v);return}
    if(a.t==='mv'&&C.mv_===seat&&typeof a.u==='string')doMove(seat,a.u);
  },
  tick(t){
    const C=H.c;
    if(!C||H.phase!=='play')return;
    if(C.dr>=0&&C.drBot&&t>=C.drBot){   // 봇이 점수 계산 제안을 받았으면: 점수로 이기면 받음
      const r=other(C.dr),p=H.players[r];C.drBot=0;
      if(p&&p.bot&&!awayHuman(p)){
        if(judgeCol(hostPos())===C.co[r]){addLog(`${p.name} 점수 계산을 받았습니다.`,'sys');finishScore('agree');return}
        C.dr=-1;addLog(`${p.name} 점수 계산을 거절했습니다.`,'sys');mark();
      }
    }
    const p=H.players[C.mv_];if(!p)return;
    if(C.ph==='set'){
      if(p.bot&&!awayHuman(p)){if(!H.botActAt)H.botActAt=t+600;if(t>=H.botActAt&&!(p.away&&t<p.awayAt+AWAY_WAIT))botTurn(C.mv_);return}
      if(t>=C.sdl)doSetup(C.mv_,0);   // 고를 시간이 지나면 마상마상
      return;
    }
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
    const C=H.c,p=H.players[C.mv_],run=H.phase==='play'&&C.ph==='play'&&p&&(!p.bot||awayHuman(p))?1:0;
    const el=run?Math.max(0,t-C.since):0,rem=C.rem.map((v,i)=>Math.max(0,Math.round(v-(run&&i===C.mv_?el:0))));
    const sl=C.ph==='set'?Math.max(0,Math.round(C.sdl-Math.max(t,C.since))):0;
    s.c={ph:C.ph,su:C.su.slice(),mv:C.mv.slice(),cp:C.cp.map(a=>a.slice()),A:C.A,co:C.co.slice(),lm:C.lm?C.lm.slice():null,chk:C.chk,bik:C.bik,rem,run,hold:run?Math.max(0,Math.round(C.since-t)):C.ph==='set'?Math.max(0,Math.round(C.since-t)):0,sl,R:{...C.R},res:C.res?{...C.res,sc:C.res.sc.slice()}:null,dr:C.dr,drN:C.drN.slice()};
    s.gr=0;s.dl=C.ph==='set'?sl:rem[C.mv_];
  },
  restore(ms){if(H.c&&ms){H.c.since+=ms;H.c.sdl+=ms}},
  emoPhase:ph=>ph==='play'||ph==='over'
};
/* ---------- 화면 (모든 참가자) ----------
   2D(SVG)와 3D(공통 테이블 가운데 장기판 + 팔각 알)는 같은 상태(CS)를 보고 그림. 한을 잡으면 판을 돌려 내 기물이 늘 아래, 글자는 늘 내 쪽에서 바로 읽힘 */
let CS=null,sel=-1,pend=null,suSel=-1,msg='',msgUntil=0,msgTimer=null,flash=null,popOpen=false;   // sel: 고른 내 기물 점, pend: 미리 보기 수 {m,from,to}, suSel: 고른 상차림(미리 보기)
let elSu=null,lastSu='',elJg=null,elSvg=null,elMain=null,elGhost=null,elBar=null,elBarMe=null,elHint=null,elModes=null,lastBoard='',lastBar='',lastHint='',lastModes='';
const OC={at:0,mk:'',ms:{ok:[],bad:[]}};   // OC.at: 상태를 받은 시각, ms: 내가 둘 수 있는 수(ok)·반복 금수(bad)
const NOMS={ok:[],bad:[]};
function buildS(c){
  const r=replay(c.su,c.mv);
  return {p:r.p,reps:r.reps,ph:c.ph,su:c.su,co:c.co,A:c.A,lm:c.lm,chk:c.chk,bik:c.bik,rem:c.rem,run:c.run,hold:c.hold,sl:c.sl,res:c.res,dr:c.dr,drN:c.drN||[0,0],cp:c.cp||[[],[]],mv:c.mv||[],R:c.R||{}};
}
const myCol=()=>{const me=myIdx();return me>=0&&me<2&&CS?CS.co[me]:-1};
const flipped=()=>myCol()===1;   // 한을 잡으면 판을 돌림 (관전은 초 쪽에서)
const myTurnNow=()=>!!(V&&V.c&&V.st==='play'&&myReady());
const dblOn=()=>typeof dblTap!=='undefined'&&!!dblTap;
const inSet=()=>!!(CS&&CS.ph==='set');
function say(txt){msg=txt;msgUntil=Date.now()+2400;drawHint();clearTimeout(msgTimer);msgTimer=setTimeout(drawHint,2500)}
function remMs(i){
  const c=V&&V.c;if(!c)return 0;
  if(c.ph==='set'&&V.st==='play'){if(V.t!==i)return c.rem[i];const e=clock()-OC.at-(c.hold||0);return Math.max(0,c.sl-Math.max(0,e))}
  let v=c.rem[i];
  if(V.st==='play'&&c.run&&V.t===i){const e=clock()-OC.at-(c.hold||0);if(e>0)v-=e}
  return Math.max(0,v);
}
function fmtT(ms){
  if(ms<10000&&ms>0){return (Math.floor(ms/100)/10).toFixed(1)}
  const s=Math.ceil(ms/1000),m=Math.floor(s/60);return m+':'+String(s%60).padStart(2,'0');
}
const scoreOf=i=>CS?score(CS.p,CS.co[i])+(CS.co[i]?DUM:0):0;
/* 미리 고를 수 있나: 둘 차례(상차림이 끝난 뒤), 또는 상대 차례(내 색으로 미리 골라 둠) */
const canPre=()=>{const me=myIdx();return !!(V&&V.c&&CS&&V.st==='play'&&CS.ph==='play'&&me>=0&&me<2&&!introWait()&&!(V.ps[me]&&V.ps[me].f))};
/* 내 기물이 둘 수 있는 수: 내 차례면 지금 국면(반복 금수는 bad), 상대 차례면 내 차례라고 치고 계산 */
function myMoves(){
  if(!canPre())return NOMS;
  const col=myCol(),k=V.c.mv.length+'|'+V.c.su.join()+'|'+col;
  if(OC.mk!==k){
    OC.mk=k;let p=CS.p;const own=p.side===col;
    if(!own){p=clonePos(CS.p);p.side=col;rehash(p)}
    const ok=[],bad=[];
    for(const m of legal(p,true)){if(own&&repState(p,m,CS.reps,CS.R.rep)===1)bad.push(m);else ok.push(m)}
    OC.ms={ok,bad};
  }
  return OC.ms;
}
const movesFrom=sq=>myMoves().ok.filter(m=>mF(m)===sq);
const badFrom=sq=>myMoves().bad.filter(m=>mF(m)===sq);
const pcAt=sq=>CS?CS.p.b[sq]:0;
/* 기물을 못 움직이는 까닭 (잠깐 붉게): 마·상의 멱, 장군을 거는 상대 기물, 이 기물을 묶은 상대 기물 */
function blockers(sq){
  const q=clonePos(CS.p),v=q.b[sq],col=v>>3,t=v&7,out=[],x=X(sq),y=Y(sq);
  const push=s=>{if(!out.includes(s))out.push(s)};
  if(t===MA||t===SANG)for(const [ox,oy,px,py] of HP){
    if(!inB(x+ox,y+oy))continue;
    const tx=t===MA?x+2*ox+px:x+3*ox+2*px,ty=t===MA?y+2*oy+py:y+3*oy+2*py;if(!inB(tx,ty))continue;
    const b1=IX(x+ox,y+oy);if(q.b[b1]){push(b1);continue}
    if(t===SANG){const b2=IX(x+2*ox+px,y+2*oy+py);if(q.b[b2])push(b2)}
  }
  if(t!==JANG){
    const ks=q.k[col];q.side=col^1;
    const atk=()=>gen(q,[]).filter(m=>mT(m)===ks).map(mF);
    const now=atk();q.b[sq]=0;const pin=atk();q.b[sq]=v;
    for(const s of [...now,...pin])push(s);
  }
  return out;
}
/* 점을 눌렀을 때: 내 기물이면 고르고(다시 누르면 내려놓음), 갈 수 있는 점이면 미리 보기, 미리 보기 점을 다시 누르면 두 번 눌러 놓기면 둠 */
function tapSq(sq){
  if(!V||!V.c||V.st!=='play'||!CS)return;
  if(sq<0||sq>=N)return;
  if(!canPre()){sndNo();return}
  const col=myCol(),v=pcAt(sq),mine=myTurnNow();
  if(pend&&pend.to===sq){if(dblOn()&&mine)confirmPend();else{pend=null;sndLift(.08);redraw()}return}
  if(v&&(v>>3)===col){
    if(sel===sq&&!pend){sel=-1;sndLift(.06);redraw();return}
    const ms=movesFrom(sq);
    if(!ms.length&&!badFrom(sq).length){sel=-1;pend=null;const bl=blockers(sq);flash={sq:bl.length?bl.slice(0,4):[sq],at:clock()};sndNo();redraw();return}
    sel=sq;pend=null;sndLift(.14);redraw();return;
  }
  if(sel>=0){
    const m=movesFrom(sel).find(m=>mT(m)===sq);
    if(m){pend={m,from:sel,to:sq};sndLift(.1);redraw();return}
    if(badFrom(sel).some(m=>mT(m)===sq)){flash={sq:[sq],at:clock()};sndNo();redraw();return}
  }
  sndNo();
}
function confirmPend(){
  if(!pend||!myTurnNow())return;
  const m=pend.m;
  if(!legal(CS.p,true).includes(m)||repState(CS.p,m,CS.reps,CS.R.rep)===1){pend=null;sel=-1;sndNo();redraw();return}   // 상대 차례에 골라 둔 수는 지금 국면에서 다시 확인
  pend=null;sel=-1;
  sendAct({t:'mv',u:toU(m)});redraw();
}
function cancelSel(){if(pend){pend=null}else sel=-1;redraw()}
const canPass=()=>!!(myTurnNow()&&CS&&CS.ph==='play'&&!CS.chk&&repState(CS.p,PASS,CS.reps,CS.R.rep)!==1);
function sendPass(){if(!canPass()){sndNo();return}popOpen=false;sel=-1;pend=null;sendAct({t:'mv',u:'pp'});redraw()}
function sendOffer(){if(V&&V.c&&V.st==='play'&&CS&&CS.ph==='play'&&myIdx()>=0&&myIdx()<2){sendAct({t:'offer'});popOpen=false;lastBar='';drawAll()}}
/* 상차림: 그림 단추를 누르면 판에 미리 보기(다시 누르면 되돌림), [정하기]로 확정 */
const mySetTurn=()=>!!(inSet()&&myTurnNow()&&!introWait());
function tapSetup(v){
  if(!mySetTurn()){sndNo();return}
  if(suSel===v){if(dblOn()){confirmSetup();return}suSel=-1;sndLift(.06)}else{suSel=v;sndLift(.12)}
  redraw();
}
function confirmSetup(){if(!mySetTurn()||suSel<0)return;sendAct({t:'su',v:suSel});suSel=-1;redraw()}
function redraw(){msgUntil=0;drawAll();G.buttons();Jg3.dirty=true;j3Marks()}
/* 소리: 알을 드는 소리(나무 톡), 두는 소리(묵직한 딱), 잡는 소리, 장군, 빅장 */
function sndLift(vol){tone(1100,.03,{type:'triangle',vol:vol*.5});hiss(.02,{freq:3400,q:3,vol:vol*.4})}
function sndNo(){sfx('no')}
function sndPut(at,cap){hiss(.03,{freq:2600,q:2.5,vol:.24,at});tone(760,.05,{type:'triangle',vol:.13,at});tone(240,.08,{type:'sine',vol:.1,at:at+.004});if(cap){hiss(.05,{freq:4200,q:4,vol:.14,at:at+.035});tone(1040,.04,{type:'triangle',vol:.07,at:at+.035})}}
function sndLand(k,at){at=at||0;const f=1.3-k*.1;hiss(.03,{freq:2600*f,q:2,vol:.13+k*.02,at});tone(620*f,.05+k*.012,{type:'triangle',vol:.09+k*.012,at});tone(220*f,.08+k*.02,{type:'sine',vol:.07+k*.02,at:at+.004});if(k>=4){tone(100,.22,{type:'sine',vol:.2,at:at+.01});hiss(.12,{freq:420,vol:.12,at})}}
function sndCheck(at){tone(620,.09,{type:'triangle',vol:.1,at});tone(930,.14,{type:'triangle',vol:.09,at:at+.09})}
function sndBik(at){tone(330,.16,{type:'triangle',vol:.11,at});tone(330,.2,{type:'triangle',vol:.1,at:at+.2})}

/* ----- 알 그림 (2D 판·상차림 단추·잡은 기물): 가운데 (cx,cy), 반지름 r의 팔각 알 ----- */
const SZ={1:.36,2:.36,3:.45,4:.45,5:.45,6:.45,7:.54};   // 판 한 칸(점 사이) = 1 기준 반지름
const INKC=['#17684f','#b5241b'];
const FONT='"Noto Serif KR","Noto Serif CJK KR","Source Han Serif K","Nanum Myeongjo","Batang","AppleMyungjo",serif';
function octPts(cx,cy,r){const o=[];for(let k=0;k<8;k++){const a=Math.PI/8+k*Math.PI/4;o.push((cx+r*Math.cos(a)).toFixed(3)+','+(cy+r*Math.sin(a)).toFixed(3))}return o.join(' ')}
function pieceSvg(t,col,cx,cy,r,op,down){   // down: 글자를 거꾸로 (상대 알)
  const ch=HJ[col][t],fs=r*(t===JANG?1.02:1.1),tf=`translate(${cx} ${cy})${down?' rotate(180)':''}${col?'':' skewX(-8)'}`;
  return `<g${op!=null&&op<1?` opacity="${op}"`:''}><polygon points="${octPts(cx,cy+r*.06,r)}" fill="#a88a5a"/><polygon points="${octPts(cx,cy,r)}" fill="#f1e3c2" stroke="#5a4028" stroke-width="${(r*.07).toFixed(3)}" stroke-linejoin="round"/><polygon points="${octPts(cx,cy,r*.8)}" fill="none" stroke="${INKC[col]}" stroke-width="${(r*.05).toFixed(3)}" opacity=".7"/><text x="0" y="${(fs*.04).toFixed(3)}" transform="${tf}" font-size="${fs.toFixed(3)}" fill="${INKC[col]}" text-anchor="middle" dominant-baseline="central" font-family='${FONT}' font-weight="${col?600:800}">${ch}</text></g>`;
}
/* 상차림 단추: 자기 쪽에서 본 왼쪽부터 읽는 이름 (마상마상 …) */
const suBtns=()=>SU_NAME.map((n,v)=>`<button type="button" class="jg-m su${suSel===v?' on':''}" data-su="${v}" aria-pressed="${suSel===v}">${n}</button>`).join('');
const suLine='<i class="jg-sut" aria-hidden="true"><b></b></i>';   // 3D 단추 아래 남은 상차림 시간 (내 이름 칸을 숨기는 동안)

/* ----- 2D (SVG): 점 사이 = 1, 판은 (0,0)~(8,9) ----- */
const dXY=i=>{const x=X(i),y=Y(i);return flipped()?[8-x,y]:[x,9-y]};
const xyI=(x,y)=>{if(x<0||y<0||x>8||y>9)return -1;return flipped()?IX(8-x,y):IX(x,9-y)};
function onSvgClick(e){
  if(!CS)return;
  const pt=elSvg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;const m=elSvg.getScreenCTM();if(!m)return;
  const q=pt.matrixTransform(m.inverse()),x=Math.round(q.x),y=Math.round(q.y);
  if(Math.hypot(q.x-x,q.y-y)>.5)return;
  tapSq(xyI(x,y));
}
function lineSvg(){
  const o=[],L=(a,b,c,d,w)=>o.push(`<line x1="${a}" y1="${b}" x2="${c}" y2="${d}" stroke="#3a2412" stroke-width="${w||.035}"/>`);
  for(let x=0;x<9;x++)L(x,0,x,9);for(let y=0;y<10;y++)L(0,y,8,y);
  o.push(`<rect x="0" y="0" width="8" height="9" fill="none" stroke="#3a2412" stroke-width=".07"/>`);
  for(const y0 of [0,7]){L(3,y0,5,y0+2);L(5,y0,3,y0+2)}
  return o.join('');
}
function boardHTML(){
  const out=[],p=CS.p;
  out.push(`<rect x="-.62" y="-.62" width="9.24" height="10.24" rx=".16" fill="#6b3f1f"/><rect x="-.45" y="-.45" width="8.9" height="9.9" fill="#e2bf7e"/>`);
  out.push(lineSvg());
  const hl=(sq,c,op,r)=>{const [x,y]=dXY(sq);out.push(`<circle cx="${x}" cy="${y}" r="${r||.5}" fill="${c}" opacity="${op}"/>`)};
  if(CS.lm){hl(CS.lm[0],'#f2c94c',.45);hl(CS.lm[1],'#f2c94c',.6)}
  if(CS.bik&&V.st==='play'){const [ax,ay]=dXY(p.k[0]),[bx,by]=dXY(p.k[1]);out.push(`<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="#e0281a" stroke-width=".22" opacity=".55" stroke-linecap="round"/>`)}
  if(CS.chk&&V.st==='play'&&CS.ph==='play'){const [x,y]=dXY(p.k[p.side]);out.push(`<circle cx="${x}" cy="${y}" r=".78" fill="url(#jgChk)"/>`)}
  if(sel>=0)hl(sel,'#6fbf5a',.55);
  if(flash&&clock()-flash.at<700)for(const s of flash.sq)hl(s,'#d6342a',.6);
  const capSq=pend&&p.b[pend.to]?pend.to:-1;
  for(let sq=0;sq<N;sq++){const v=p.b[sq];if(!v||sq===capSq)continue;const [x,y]=dXY(sq);out.push(pieceSvg(v&7,v>>3,x,y,SZ[v&7],pend&&pend.from===sq?.35:1,(v>>3)!==viewCol()))}
  if(sel>=0&&!pend){
    for(const m of movesFrom(sel)){const t=mT(m),[x,y]=dXY(t);if(p.b[t])out.push(`<circle cx="${x}" cy="${y}" r=".5" fill="none" stroke="rgba(30,30,30,.45)" stroke-width=".08"/>`);else out.push(`<circle cx="${x}" cy="${y}" r=".14" fill="rgba(30,30,30,.36)"/>`)}
    for(const m of badFrom(sel)){const [x,y]=dXY(mT(m));out.push(`<path d="M${x-.2} ${y-.2}L${x+.2} ${y+.2}M${x+.2} ${y-.2}L${x-.2} ${y+.2}" stroke="#d6342a" stroke-width=".1" stroke-linecap="round"/>`)}
  }
  return out.join('');
}
function drawGhost(){
  if(!elGhost)return;
  let h='';
  if(pend&&CS){const [x,y]=dXY(pend.to),v=pcAt(pend.from);h=`<circle cx="${x}" cy="${y}" r=".5" fill="#6fbf5a" opacity=".45"/>`+pieceSvg(v&7,v>>3,x,y,SZ[v&7],.75)}
  else if(suSel>=0&&mySetTurn()){const col=myCol(),yy=col?9:0;SETUPS[suSel].forEach((t,k)=>{const [x,y]=dXY(IX(suXs(col)[k],yy));h+=pieceSvg(t,col,x,y,SZ[t],.6)})}
  elGhost.innerHTML=h;
  j3Marks();
}
const nm=i=>V.ps[i]?V.ps[i].n:'?';
const colDot=col=>`<i class="dot ${col===0?'cho':col===1?'han':'non'}"></i>`;
/* 이름 칸: 초·한, 이름, 시간(상차림 중이면 고를 시간), 점수로 앞서면 +점수 차. 내 칸을 누르면 한 수 쉬기·점수 계산 제안 */
function chipHTML(i){
  const me=myIdx(),c=CS,p=V.ps[i];if(!p||i>1)return '';
  const on=V.st==='play'&&V.t===i&&!introWait();
  const st=V.st==='over'?(c.res&&c.res.w<0?'무승부':p.f===1?'승리':(p.sr===2?'시간 초과':p.sr===3?'탈주':p.sr?'항복':'패배')):'';
  const d=scoreOf(i)-scoreOf(1-i),sc=d>0?`<span class="sc">+${String(+d.toFixed(1))}</span>`:'';
  const dr=V.st==='play'&&c.dr===i?'<span class="dr" title="점수 계산 제안">점</span>':'';
  const mine=i===me&&V.st==='play'&&c.ph==='play';
  const pop=mine&&popOpen?`<span class="jg-pop"><button type="button" class="jg-drbtn${canPass()?'':' off'}" data-pass="1">한 수 쉬기</button><button type="button" class="jg-drbtn" data-dr="1">${c.dr===i?'제안 거두기':'점수 계산 제안'}</button></span>`:'';
  return `<div class="jg-p${on?' on':''}${i===me?' me':''}${mine?' tap':''}"${mine?' data-me="1"':''}>${colDot(c.co[i])}<b>${esc(p.n)}${i===me?' (나)':''}</b>${dr}${sc}<span class="w" data-ct="${i}"></span>${st?`<span class="st">${st}</span>`:''}${pop}</div>`;
}
const CHIP_GAP=10;
function chipsAt(topY,botY){
  const r=elJg,bar=r.querySelector('.jg-bar'),mb=r.querySelector('.jg-mebar');if(!bar||!mb)return;
  const H=r.clientHeight,lim=H-(r.clientWidth<700?70:14)-(mb.offsetHeight||34);
  r.style.setProperty('--bs',Math.max(bar.offsetHeight,Math.round(topY-CHIP_GAP-bar.offsetTop))+'px');
  r.style.setProperty('--mt',Math.round(Math.min(botY+CHIP_GAP,lim))+'px');
  r.classList.add('lay');
}
const seated=()=>{const me=myIdx();return me===0||me===1};
function barHTML(){const me=myIdx();return seated()?chipHTML(1-me):chipHTML(0)+chipHTML(1)}
function meBarHTML(){return seated()?chipHTML(myIdx()):''}
const WHY_SHORT={mate:'외통',time:'시간 초과',surrender:'항복',desert:'탈주',bik:'빅장',rep:'반복',agree:'점수 계산',stuck:'둘 수 없음',long:'수 제한'};
/* 안내 줄: 상차림 단계와 결과만 (누구 차례·장군·갈 수 있는 점은 판이 보여 줌) */
function hintText(){
  if(Date.now()<msgUntil&&msg)return msg;
  if(!V||!V.c||!CS)return '';
  if(V.st==='over'){
    const r=CS.res;if(!r)return '게임이 끝났습니다.';
    if(r.w<0)return `무승부입니다. (${WHY_SHORT[r.why]||''})`;
    const sc=r.sc&&['rep','agree','stuck','long'].includes(r.why)?` · 초 ${r.sc[0]} : 한 ${r.sc[1]}`:'';
    return `${nm(r.w)} 승리 (${WHY_SHORT[r.why]||''}${sc})`;
  }
  if(inSet()&&!introWait())return '상차림';
  return '';
}
/* 안내 줄 옆 단추: 상차림 넷, 상대가 낸 점수 계산 제안 받기 */
function modesHTML(){
  if(!V||!V.c||!CS||V.st!=='play')return '';
  const out=[],me=myIdx();
  if(mySetTurn()&&!Jg3.on)out.push(suBtns());
  if(me>=0&&me<2&&CS.ph==='play'&&CS.dr===1-me)out.push(`<button type="button" class="jg-m dr" data-dr="1">점수 계산 받기</button>`);
  return out.join('');
}
function drawHint(){
  if(!elHint)return;
  const h=hintText();if(h!==lastHint){elHint.textContent=h;lastHint=h}
  const m=modesHTML();if(m!==lastModes){elModes.innerHTML=m;lastModes=m}
  const u=mySetTurn()&&Jg3.on?suBtns():'';if(u!==lastSu){elSu.innerHTML=u?u+suLine:'';lastSu=u;elJg.classList.toggle('suon',!!u);clockTick()}
}
function fit(){
  if(!elJg||elJg.hidden)return;
  const bd=elJg.querySelector('.jg-bd'),bw=bd.clientWidth,bh=bd.clientHeight;
  const k=Math.min(bw/9.6,bh/10.6);
  if(k>0){elSvg.style.width=Math.floor(k*9.6)+'px';elSvg.style.height=Math.floor(k*10.6)+'px'}
}
function drawAll(){
  if(!CS||!elMain)return;
  if(!Jg3.on){const bd=boardHTML();if(bd!==lastBoard){elMain.innerHTML=bd;lastBoard=bd}}
  const top=barHTML(),mb=meBarHTML(),key=top+'\u0001'+mb;if(key!==lastBar){elBar.innerHTML=top;elBarMe.innerHTML=mb;lastBar=key;clockTick()}
  drawGhost();drawHint();fit();
}

/* ---------- 3D: 공통 원목 테이블 가운데 장기판 + 팔각 알, 거의 바로 위에서 보는 자기 카메라 ----------
   단위: 월드 그대로. 점 사이 S. 내 쪽 끝 줄이 화면 아래(+z). 잡은 기물은 판 옆(넓은 화면: 내가 잡은 것 오른쪽, 상대가 잡은 것 왼쪽) 또는 앞뒤(좁은 화면) */
const S=.46,HX=4*S,HZ=4.5*S,BX=HX+.36,BZ=HZ+.36,TOP=.15,PY=TOP+.012,GS=.62;   // PY: 알 바닥(판 윗면·표시 원보다 위)
const GY=()=>T.felt&&T.felt.mat?T.felt.mat.position.y+.013:.02;   // 잡은 알 바닥: 탁자 천 윗면 위
const PR={1:.165,2:.165,3:.205,4:.205,5:.205,6:.205,7:.25},PHT={1:.075,2:.075,3:.09,4:.09,5:.09,6:.09,7:.105};   // 알 반지름(꼭짓점까지)·두께: 장 > 차·포·마·상 > 사·졸
const Jg3={on:false,built:false,fail:false,root:null,cam:null,dirty:true,lastR:0,lay:'',layAt:0,d:12,layout:'h',pcs:new Map(),grave:[[],[]],anim:[],flipT:null,mvN:-1,suK:'',ph:''};
const ease=k=>k<=0?0:k>=1?1:k*k*(3-2*k);
function pW(i){const x=X(i),y=Y(i);return Jg3.flipT?[(4-x)*S,(y-4.5)*S]:[(x-4)*S,(4.5-y)*S]}
function woodPaint(g,w,h,base,dark,n,seed){
  let s=seed||7;const rnd=()=>{s=(s*16807)%2147483647;return s/2147483647};
  g.fillStyle=base;g.fillRect(0,0,w,h);
  for(let i=0;i<n;i++){const y0=rnd()*h,a=rnd()*.12+.04;g.strokeStyle=dark;g.globalAlpha=a;g.lineWidth=rnd()*2.5+.8;g.beginPath();
    for(let t=0;t<=w;t+=8){const y=y0+Math.sin(t/30+i)*3+Math.sin(t/11+i*3)*1.2;t?g.lineTo(t,y):g.moveTo(t,y)}g.stroke()}
  g.globalAlpha=1;
}
/* 판 무늬: 밝은 원목 + 먹선(9×10 선, 궁성 대각선, 졸·포 자리 표시). 앞뒤가 같아 돌려 봐도 다시 그리지 않음 */
function drawBoardTex(cv){
  const g=cv.getContext('2d'),W=cv.width,Hh=cv.height,s=W/(2*BX),px=v=>(v+BX)*s,pz=v=>(v+BZ)*s;
  woodPaint(g,W,Hh,'#e4c283','#a8793e',70,11);
  g.strokeStyle='#3a2412';g.lineCap='round';
  const L=(x0,z0,x1,z1,w)=>{g.lineWidth=w;g.beginPath();g.moveTo(px(x0),pz(z0));g.lineTo(px(x1),pz(z1));g.stroke()};
  const lw=Math.max(2,W/420);
  for(let c=0;c<9;c++)L((c-4)*S,-HZ,(c-4)*S,HZ,lw);
  for(let r=0;r<10;r++)L(-HX,(r-4.5)*S,HX,(r-4.5)*S,lw);
  g.lineWidth=lw*2.2;g.strokeRect(px(-HX),pz(-HZ),2*HX*s,2*HZ*s);
  for(const r0 of [0,7]){const z=r=>(r-4.5)*S;L(-S,z(r0),S,z(r0+2),lw);L(S,z(r0),-S,z(r0+2),lw)}
  const d=S*.1,l=S*.16;
  const mark=(c,r)=>{const x=(c-4)*S,z=(r-4.5)*S;for(const sx of [-1,1])for(const sz of [-1,1]){if((c===0&&sx<0)||(c===8&&sx>0))continue;
    g.lineWidth=lw;g.beginPath();g.moveTo(px(x+sx*(d+l)),pz(z+sz*d));g.lineTo(px(x+sx*d),pz(z+sz*d));g.lineTo(px(x+sx*d),pz(z+sz*(d+l)));g.stroke()}};
  for(const r of [3,6])for(const c of [0,2,4,6,8])mark(c,r);
  for(const r of [2,7])for(const c of [1,7])mark(c,r);
  g.lineWidth=lw*1.4;g.strokeStyle='rgba(58,36,18,.55)';g.strokeRect(px(-BX)+W*.012,pz(-BZ)+W*.012,W-W*.024,Hh-W*.024);
}
/* 알 윗면: 상아빛 바탕 + 안쪽 팔각 테 + 한자 (초 청록·흘림 기운, 한 붉은 바른 글씨) */
const TEX={};
function faceTex(t,col){
  const k=t+'|'+col;if(TEX[k])return TEX[k];
  return TEX[k]=canvasTex(256,256,(g,w,h)=>{
    g.fillStyle='#f2e5c6';g.fillRect(0,0,w,h);
    const oct=r=>{g.beginPath();for(let i=0;i<8;i++){const a=Math.PI/8+i*Math.PI/4,x=w/2+r*Math.cos(a),y=h/2+r*Math.sin(a);i?g.lineTo(x,y):g.moveTo(x,y)}g.closePath()};
    g.strokeStyle=INKC[col];g.globalAlpha=.65;g.lineWidth=w*.022;oct(w*.4);g.stroke();g.globalAlpha=1;
    g.fillStyle=INKC[col];g.textAlign='center';g.textBaseline='middle';
    g.font=`${col?600:800} ${Math.round(w*(t===JANG?.48:.52))}px ${FONT}`;
    g.save();g.translate(w/2,h/2+w*.02);if(!col)g.transform(1,0,-.14,1,0,0);g.fillText(HJ[col][t],0,0);g.restore();
  });
}
const GEO={},MAT={};
function geoOf(t){
  if(GEO[t])return GEO[t];
  const r=PR[t],h=PHT[t],o=r*.08;
  const body=new THREE.CylinderGeometry(r*.88,r,h,8,1,false,Math.PI/8);body.translate(0,h/2,0);
  const ink=new THREE.CylinderGeometry(r*.88+o,r+o,h+o*.5,8,1,false,Math.PI/8);ink.translate(0,(h+o*.5)/2,0);
  return GEO[t]={body,ink};
}
const INK=()=>MAT.ink||(MAT.ink=new THREE.MeshBasicMaterial({color:GFX_INK,side:THREE.BackSide}));
function matsOf(t,col,ghost){
  const k=(ghost?'g':'m')+t+'|'+col;
  if(MAT[k])return MAT[k];
  if(ghost){const side=MAT.gs||(MAT.gs=new THREE.MeshBasicMaterial({color:0xd8c193,transparent:true,opacity:.5,depthWrite:false}));return MAT[k]=[side,new THREE.MeshBasicMaterial({map:faceTex(t,col),transparent:true,opacity:.6,depthWrite:false}),side]}
  const side=MAT.side||(MAT.side=toon({color:0xd2b986,rim:.1}));
  return MAT[k]=[side,toon({map:faceTex(t,col),rim:.04}),side];
}
/* 알 하나: 실제 판처럼 각자 자기 쪽에서 바로 읽힘 — 내 알은 바로, 상대 알은 거꾸로, 잡은 알은 잡은 사람 쪽으로.
   윗면 무늬는 로컬 +x가 글자 위쪽: y축 +90°면 화면 위(-z), -90°면 화면 아래. 카메라는 늘 같은 쪽에서 보고 판을 뒤집을 때는 알 자리만 바꿈(pW) */
const viewCol=()=>{const c=myCol();return c<0?0:c};   // 관전자는 초 쪽에서 봄
const orient=g=>{const u=g.userData,up=u.grave?u.col!==viewCol():u.col===viewCol();u.body.rotation.y=up?Math.PI/2:-Math.PI/2};
function pieceMesh(t,col,ghost){
  const G3=geoOf(t),g=new THREE.Group();
  const body=new THREE.Mesh(G3.body,matsOf(t,col,ghost));body.castShadow=!ghost;body.receiveShadow=!ghost;g.add(body);
  if(!ghost)g.add(new THREE.Mesh(G3.ink,INK()));
  g.userData={t,col,parts:[body],body};orient(g);
  return g;
}
/* 대기실 홀로그램의 대표 말: 楚 장 알과 그 뒤 漢 차 알 (공통 frontHoloPiece가 재질 만드는 함수를 줌) */
G.holoPiece=mk=>{
  const g=new THREE.Group();
  const one=(t,col,x,y,z,rx,rz)=>{const r=PR[t]*1.6,h=PHT[t]*1.6;const m=new THREE.Mesh(new THREE.CylinderGeometry(r*.88,r,h,8,1,false,Math.PI/8),[mk(0xd8c193),mk(0xffffff,faceTex(t,col)),mk(0xd8c193)]);m.position.set(x,y,z);m.rotation.set(rx,Math.PI/2,rz,'XZY');g.add(m)};
  one(CHA,1,.13,.1,-.12,1.1,-.25);one(JANG,0,-.06,-.04,.06,1.15,.18);
  return g;
};
function j3Build(){
  if(Jg3.built||Jg3.fail)return Jg3.built;
  if(!T.ok||typeof THREE==='undefined'){Jg3.fail=true;return false}
  try{
    const root=new THREE.Group();root.visible=false;
    const bg=new THREE.Group();root.add(bg);Jg3.boardG=bg;
    const frameT=canvasTex(512,512,(g,w,h)=>woodPaint(g,w,h,'#7a4a22','#2e170a',110,3));
    const frame=new THREE.Mesh(new THREE.BoxGeometry(2*BX,TOP-.02,2*BZ),toon({map:frameT,rim:.08}));frame.position.y=.02+(TOP-.02)/2;frame.castShadow=frame.receiveShadow=true;bg.add(frame);
    const fo=new THREE.Mesh(new THREE.BoxGeometry(2*BX+.05,TOP,2*BZ+.05),INK());fo.position.copy(frame.position);bg.add(fo);
    const bt=canvasTex(1024,Math.round(1024*BZ/BX),(g,w,h)=>drawBoardTex(g.canvas));
    const top=new THREE.Mesh(new THREE.PlaneGeometry(2*BX-.04,2*BZ-.04),toon({map:bt,rim:0}));
    top.rotation.x=-Math.PI/2;top.position.y=TOP+.002;top.receiveShadow=true;bg.add(top);
    // 점 표시: 마지막 수(노랑)·고른 기물(초록)·안 되는 까닭(빨강)·장군(붉은 빛)·빅장(붉은 줄)·갈 수 있는 점·잡을 수 있는 점(고리)·반복 금수(✕)
    const disc=(c,op,r)=>{const m=new THREE.Mesh(new THREE.CircleGeometry(r||S*.56,32),new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:op,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.y=TOP+.004;m.visible=false;m.renderOrder=2;root.add(m);return m};
    Jg3.lmA=disc(0xf2c94c,.42);Jg3.lmB=disc(0xf2c94c,.58);Jg3.selM=disc(0x6fbf5a,.58);Jg3.pendM=disc(0x6fbf5a,.42);
    Jg3.flashM=[0,1,2,3].map(()=>disc(0xd6342a,.62));
    const gT=canvasTex(128,128,(x,w,h)=>{const gr=x.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);gr.addColorStop(0,'rgba(255,40,20,.95)');gr.addColorStop(.55,'rgba(230,30,20,.55)');gr.addColorStop(1,'rgba(200,20,10,0)');x.fillStyle=gr;x.fillRect(0,0,w,h)});
    Jg3.chkM=new THREE.Mesh(new THREE.PlaneGeometry(S*1.9,S*1.9),new THREE.MeshBasicMaterial({map:gT,transparent:true,depthWrite:false}));Jg3.chkM.rotation.x=-Math.PI/2;Jg3.chkM.position.y=TOP+.006;Jg3.chkM.visible=false;Jg3.chkM.renderOrder=3;root.add(Jg3.chkM);
    Jg3.bikM=new THREE.Mesh(new THREE.PlaneGeometry(S*.34,1),new THREE.MeshBasicMaterial({color:0xe0281a,transparent:true,opacity:.5,depthWrite:false}));Jg3.bikM.rotation.x=-Math.PI/2;Jg3.bikM.position.y=TOP+.005;Jg3.bikM.visible=false;Jg3.bikM.renderOrder=3;root.add(Jg3.bikM);
    const dotM=new THREE.MeshBasicMaterial({color:0x1d1a17,transparent:true,opacity:.42,depthWrite:false});
    const ringM=new THREE.MeshBasicMaterial({color:0x1d1a17,transparent:true,opacity:.5,depthWrite:false});
    const xT=canvasTex(64,64,(x,w,h)=>{x.strokeStyle='#d6342a';x.lineWidth=9;x.lineCap='round';x.beginPath();x.moveTo(14,14);x.lineTo(50,50);x.moveTo(50,14);x.lineTo(14,50);x.stroke()});
    const xM=new THREE.MeshBasicMaterial({map:xT,transparent:true,depthWrite:false});
    Jg3.dots=[];Jg3.rings=[];Jg3.xs=[];
    for(let k=0;k<20;k++){
      const d=new THREE.Mesh(new THREE.CircleGeometry(S*.15,20),dotM);d.rotation.x=-Math.PI/2;d.position.y=TOP+.008;d.visible=false;d.renderOrder=4;root.add(d);Jg3.dots.push(d);
      const r=new THREE.Mesh(new THREE.RingGeometry(S*.5,S*.58,32),ringM);r.rotation.x=-Math.PI/2;r.position.y=TOP+.008;r.visible=false;r.renderOrder=4;root.add(r);Jg3.rings.push(r);
    }
    for(let k=0;k<8;k++){const x=new THREE.Mesh(new THREE.PlaneGeometry(S*.6,S*.6),xM);x.rotation.x=-Math.PI/2;x.position.y=TOP+.01;x.visible=false;x.renderOrder=5;root.add(x);Jg3.xs.push(x)}
    Jg3.pg=new THREE.Group();root.add(Jg3.pg);
    Jg3.ghost=new THREE.Group();Jg3.ghost.visible=false;root.add(Jg3.ghost);
    Jg3.suG=new THREE.Group();Jg3.suG.visible=false;root.add(Jg3.suG);
    Jg3.cam=new THREE.PerspectiveCamera(34,1,.1,100);
    T.scene.add(root);Jg3.root=root;Jg3.built=true;
  }catch(e){Jg3.fail=true;try{console.warn('장기 3D 준비 실패',e)}catch(_){}}
  return Jg3.built;
}
/* 잡은 기물 자리: k 0 = 내가 잡은 것, 1 = 상대가 잡은 것 (알을 눕혀 작게) */
function graveXZ(k,i){
  const sg=k?-1:1;
  if(Jg3.layout==='h')return [sg*(BX+.26+(i%2)*.4),sg*(HZ-.12-Math.floor(i/2)*.46)];
  return [-sg*(HX-.08-(i%8)*.46),sg*(BZ+.24+Math.floor(i/8)*.42)];
}
/* 바로 시작: 판은 그대로, 지금 알을 처음 자리로 미끄러져 모음(같은 종류·색 중 가까운 것끼리). 마·상은 상차림을 다시 하므로 판에서 들어 올려 치움 */
const GLIDE=420;
function regather(p){
  const pool=[...Jg3.pcs.values(),...Jg3.grave[0],...Jg3.grave[1]];
  Jg3.pcs.clear();Jg3.grave=[[],[]];Jg3.anim=[];
  const used=new Set();
  for(let sq=0;sq<N;sq++){
    const v=p.b[sq];if(!v)continue;
    const [x,z]=pW(sq);let best=null,bd=1e9;
    for(const g of pool){if(used.has(g)||g.userData.t!==(v&7)||g.userData.col!==(v>>3))continue;const d=Math.hypot(g.position.x-x,g.position.z-z);if(d<bd){bd=d;best=g}}
    if(!best){best=pieceMesh(v&7,v>>3);best.position.set(x,PY+1,z);best.visible=false;Jg3.pg.add(best)}
    used.add(best);Jg3.pcs.set(sq,best);
    const [a]=pieceAt(v&7,sq,true),g=best,y0=g.userData.grave?GY():g.visible?g.position.y:PY+1;g.userData.grave=0;orient(g);
    Jg3.anim.push({obj:g,t0:IN.t0+a,dur:GLIDE,x0:g.position.x,z0:g.position.z,x1:x,z1:z,lift:Math.hypot(g.position.x-x,g.position.z-z)>.05?.3:0,s0:g.scale.x,s1:1,y0,y1:PY,show:1});
  }
  const now=clock();
  for(const g of pool)if(!used.has(g)){Jg3.anim.push({obj:g,t0:now,dur:360,x0:g.position.x,z0:g.position.z,x1:g.position.x,z1:g.position.z,y0:g.position.y,y1:g.position.y+1.4,s0:g.scale.x,s1:.01,gone:1})}
  Jg3.mvN=0;Jg3.dirty=true;
}
/* 알 자리를 상태에 맞춤: 마지막 수는 미끄러지듯(마·상은 살짝 뛰어오름), 잡힌 알은 판 옆으로, 상차림으로 새로 생긴 마·상은 위에서 내려앉음 */
function j3Sync(){
  if(!Jg3.on||!V||!V.c||!CS)return;
  const fl=flipped(),c=V.c,p=CS.p,now=clock(),me=myIdx()<0?0:myIdx();
  if(IN.again&&!IN.gathered&&c.mv.length===0&&Jg3.flipT!==null){IN.gathered=true;Jg3.flipT=fl;regather(p)}
  if(Jg3.flipT!==fl){Jg3.flipT=fl;for(const g of Jg3.pcs.values())Jg3.pg.remove(g);Jg3.pcs.clear();for(const k of [0,1]){for(const g of Jg3.grave[k])Jg3.pg.remove(g);Jg3.grave[k]=[]}Jg3.mvN=-1}
  const n=c.mv.length,step=Jg3.mvN>=0&&n===Jg3.mvN+1&&c.lm&&!IN.on3d;
  let capMesh=null;
  if(step){
    const [f,t]=c.lm,g=Jg3.pcs.get(f);
    if(g){
      const old=Jg3.pcs.get(t);if(old){Jg3.pcs.delete(t);capMesh=old}
      Jg3.pcs.delete(f);Jg3.pcs.set(t,g);
      const [x0,z0]=pW(f),[x1,z1]=pW(t),jump=g.userData.t===MA||g.userData.t===SANG;
      Jg3.anim.push({obj:g,t0:now,dur:jump?290:240,x0,z0,x1,z1,lift:jump?.32:.07});
    }
  }
  const want=new Map();
  for(let sq=0;sq<N;sq++){const v=p.b[sq];if(v)want.set(sq,v)}
  for(const [sq,g] of Jg3.pcs){const v=want.get(sq);if(!v||g.userData.t!==(v&7)||g.userData.col!==(v>>3)){if(!Jg3.anim.some(a=>a.obj===g&&!a.gone)){Jg3.pg.remove(g);Jg3.pcs.delete(sq)}}}
  let drop=0;
  for(const [sq,v] of want){
    if(Jg3.pcs.has(sq))continue;
    const g=pieceMesh(v&7,v>>3),[x,z]=pW(sq);g.position.set(x,PY,z);Jg3.pg.add(g);Jg3.pcs.set(sq,g);
    if(n===0&&!IN.on3d&&Jg3.mvN===0&&((v&7)===MA||(v&7)===SANG)){   // 상차림: 위에서 차례로 내려앉음
      const t0=now+drop*110;g.visible=false;g.position.y=PY+1;Jg3.anim.push({obj:g,t0,dur:330,x0:x,z0:z,x1:x,z1:z,y0:PY+1,y1:PY,show:1,fall:1});sndLand(2,(t0-now)/1000+.24);drop++}
  }
  for(const [sq,g] of Jg3.pcs)if(!Jg3.anim.some(a=>a.obj===g)){const [x,z]=pW(sq);g.position.set(x,PY,z)}
  for(const k of [0,1]){   // 잡은 알
    const seat=k?1-me:me,list=(c.cp[seat]||[]).slice(),gs=Jg3.grave[k],col=c.co[seat]^1;
    while(gs.length>list.length)Jg3.pg.remove(gs.pop());
    for(let i=0;i<list.length;i++){
      let g=gs[i];
      if(g&&g.userData.t!==list[i]){Jg3.pg.remove(g);g=null}
      const [x,z]=graveXZ(k,i);
      if(!g){
        if(capMesh&&i===list.length-1&&capMesh.userData.col===col&&capMesh.userData.t===list[i]){g=capMesh;capMesh=null;g.userData.grave=1;orient(g);Jg3.anim.push({obj:g,t0:now+120,dur:420,x0:g.position.x,z0:g.position.z,x1:x,z1:z,y0:g.position.y,y1:GY(),lift:.5,s0:g.scale.x,s1:GS})}
        else{g=pieceMesh(list[i],col);g.userData.grave=1;orient(g);g.scale.setScalar(GS);g.position.set(x,GY(),z);Jg3.pg.add(g)}
        gs[i]=g;g.userData.grave=1;
      }else if(!Jg3.anim.some(a=>a.obj===g))g.position.set(x,GY(),z);
    }
  }
  if(capMesh)Jg3.pg.remove(capMesh);
  Jg3.mvN=n;
  j3Marks();Jg3.dirty=true;
}
/* 점 표시를 상태에 맞춤 (고를 때마다) */
function j3Marks(){
  if(!Jg3.on||!V||!V.c||!CS)return;
  const put=(m,sq)=>{if(sq==null||sq<0){m.visible=false;return}const [x,z]=pW(sq);m.position.x=x;m.position.z=z;m.visible=true};
  put(Jg3.lmA,CS.lm?CS.lm[0]:-1);put(Jg3.lmB,CS.lm?CS.lm[1]:-1);
  put(Jg3.selM,sel>=0&&!introWait()?sel:-1);put(Jg3.pendM,pend?pend.to:-1);
  const play=V.st==='play'&&CS.ph==='play';
  put(Jg3.chkM,CS.chk&&play?CS.p.k[CS.p.side]:-1);
  if(CS.bik&&play){const [ax,az]=pW(CS.p.k[0]),[bx,bz]=pW(CS.p.k[1]);Jg3.bikM.position.set(ax,TOP+.005,(az+bz)/2);Jg3.bikM.scale.y=Math.abs(az-bz);Jg3.bikM.visible=true}else Jg3.bikM.visible=false;
  const fs=flash&&clock()-flash.at<700?flash.sq:[];Jg3.flashM.forEach((m,k)=>put(m,fs[k]));
  const ms=sel>=0&&!pend?movesFrom(sel):[],bs=sel>=0&&!pend?badFrom(sel):[];let di=0,ri=0,xi=0;
  for(const m of ms){const t=mT(m);if(CS.p.b[t]){if(ri<Jg3.rings.length)put(Jg3.rings[ri++],t)}else if(di<Jg3.dots.length)put(Jg3.dots[di++],t)}
  for(const m of bs)if(xi<Jg3.xs.length)put(Jg3.xs[xi++],mT(m));
  for(;di<Jg3.dots.length;di++)Jg3.dots[di].visible=false;for(;ri<Jg3.rings.length;ri++)Jg3.rings[ri].visible=false;for(;xi<Jg3.xs.length;xi++)Jg3.xs[xi].visible=false;
  const capSq=pend&&CS.p.b[pend.to]?pend.to:-1;
  for(const [sq,g] of Jg3.pcs){if(Jg3.anim.some(a=>a.obj===g))continue;const up=sq===sel&&!introWait();const y=PY+(up?.1:0);if(g.position.y!==y){g.position.y=y;Jg3.dirty=true}
    g.visible=!(pend&&(pend.from===sq||capSq===sq))}
  if(pend){
    const v=pcAt(pend.from),key=(v&7)+'|'+(v>>3)+'|'+Jg3.flipT;
    if(Jg3.ghost.userData.k!==key){Jg3.ghost.clear();const gm=pieceMesh(v&7,v>>3,true);gm.traverse(o=>{o.renderOrder=6});Jg3.ghost.add(gm);Jg3.ghost.userData.k=key}
    const [x,z]=pW(pend.to);Jg3.ghost.position.set(x,PY,z);Jg3.ghost.visible=true;
  }else Jg3.ghost.visible=false;
  // 상차림 미리 보기: 내 끝 줄 네 자리에 반투명 마·상
  const sk=suSel>=0&&mySetTurn()?suSel+'|'+myCol()+'|'+Jg3.flipT:'';
  if(Jg3.suG.userData.k!==sk){Jg3.suG.clear();Jg3.suG.userData.k=sk;
    if(sk){const col=myCol(),yy=col?9:0;SETUPS[suSel].forEach((t,k)=>{const gm=pieceMesh(t,col,true);const [x,z]=pW(IX(suXs(col)[k],yy));gm.position.set(x,PY,z);gm.traverse(o=>{o.renderOrder=6});Jg3.suG.add(gm)})}}
  Jg3.suG.visible=!!sk;
  Jg3.dirty=true;
}
/* 카메라: 바로 위에서 내려다봄 (오목·쿼리도와 같은 탑뷰). 판 가운데 = 화면 가운데, 위아래는 이름 칸 자리를 같은 높이로 비우고 양옆은 조금만(tvBox).
   잡은 알은 판 옆(넓은 화면) 또는 판 앞뒤(좁은 화면) 중 판이 더 크게 보이는 쪽.
   상차림 단추(.jg-su)는 내 쪽 판 끝에 걸침(가운데가 판 끝선). 판을 줄이지 않게 고르는 동안은 내 이름 칸을 숨기고 단추 아래 시간 선으로 남은 시간을 보여 줌 */
function tvBox(r){
  const W=r.clientWidth,Hh=r.clientHeight;r.classList.toggle('wide',W>Hh||W>=700);   // 가로 화면, 또는 폭 700px 이상의 2명 판: 안내 줄을 왼쪽 위 구석으로 빼서 위 칸이 맨 위 줄로 (위아래 여백을 칸 한 줄만큼으로)
  const narrow=W<700,bar=r.querySelector('.jg-bar'),mb=r.querySelector('.jg-mebar');
  const R=Math.max(bar.offsetTop+bar.offsetHeight+CHIP_GAP,(narrow?70:14)+(mb.offsetHeight||26)+CHIP_GAP),m=narrow?8:16;
  return {fw:W-2*m,fh:Hh-2*R,cy:Hh/2,R};
}
const GXW=.88,GZW=.9;   // 잡은 알 두 줄이 차지하는 폭 (옆 / 앞뒤)
function j3Layout(t){
  if(t-Jg3.layAt<100&&Jg3.lay)return false;
  Jg3.layAt=t;
  const st=$('#stage'),W=st.clientWidth,Hh=st.clientHeight;if(!W||!Hh||!V||!V.c)return false;
  const B=tvBox(elJg),key=[W,Hh,B.R,flipped()].join(',');
  if(key===Jg3.lay)return false;
  Jg3.lay=key;
  const fw=B.fw,fh=B.fh;
  const sH=Math.min(fw/(2*(BX+GXW)),fh/(2*BZ)),sV=Math.min(fw/(2*BX),fh/(2*(BZ+GZW)));
  const lay=sH>=sV?'h':'v',s=Math.max(sH,sV)*.98;
  Jg3.layout=lay;
  const cam=Jg3.cam,f=Math.tan(cam.fov*Math.PI/360),d=(Hh/2)/(s*f);
  cam.aspect=W/Hh;cam.clearViewOffset();cam.position.set(0,PY+d,0);cam.lookAt(0,PY,0);
  cam.setViewOffset(W,Hh,0,-(B.cy-Hh/2),W,Hh);cam.updateProjectionMatrix();cam.updateMatrixWorld();
  {const hv=(lay==='v'?BZ+GZW:BZ)*s;chipsAt(B.cy-hv,B.cy+hv)}
  // 상차림 단추 자리: 가운데가 내 쪽 판 끝선, 폭은 판 선 폭
  elJg.style.setProperty('--sux',Math.round(W/2)+'px');elJg.style.setProperty('--suy',Math.round(B.cy+BZ*s)+'px');
  elJg.style.setProperty('--suw',Math.round(2*HX*s)+'px');elJg.style.setProperty('--suh',(W<700?28:32)+'px');
  Jg3.d=d;Jg3.dirty=true;
  j3Sync();
  return true;
}
function j3Step(now){
  let busy=false;
  Jg3.anim=Jg3.anim.filter(a=>{
    const k=(now-a.t0)/a.dur;if(k<0){busy=true;return true}
    const e=a.fall?Math.min(1,k)*Math.min(1,k):ease(Math.min(1,k)),o=a.obj;busy=true;
    o.position.x=a.x0+(a.x1-a.x0)*e;o.position.z=a.z0+(a.z1-a.z0)*e;
    const base=o.userData.grave?GY():PY;
    if(a.show)o.visible=true;
    o.position.y=(a.y0!=null?a.y0+(a.y1-a.y0)*e:base)+Math.sin(Math.PI*Math.min(1,k))*(a.lift||0);
    if(a.s1!=null){o.scale.setScalar(a.s0+(a.s1-a.s0)*e)}
    if(k>=1){
      if(a.gone){Jg3.pg.remove(o);return false}
      o.position.set(a.x1,a.y1!=null?a.y1:base,a.z1);
      return false;
    }
    return true;
  });
  return busy;
}
function j3Render(t){
  if(!Jg3.on||!T.ok)return;
  if(j3Layout(t))Jg3.dirty=true;
  const busy=j3Step(t),intro=IN.on3d&&introStep(t),fl=flash&&t-flash.at<760;
  if(flash&&!fl&&Jg3.flashM[0].visible){flash=null;j3Marks();drawAll()}
  if(!busy&&!intro&&!fl&&!Jg3.dirty&&t-Jg3.lastR<400)return;
  Jg3.dirty=false;Jg3.lastR=t;
  const fog=T.scene.fog,fn=fog?fog.near:0,ff=fog?fog.far:0;
  if(fog){fog.near=Jg3.d+5;fog.far=Jg3.d+30}
  for(const m of [T.timerBg,T.timerArc,T.ring])if(m)m.visible=false;
  let cam=Jg3.cam;
  {const k=intro&&IN.fromLobby?ease((t-IN.t0)/INTRO.cam):1;
   if(k<1){
     const ic=Jg3.icam||(Jg3.icam=new THREE.PerspectiveCamera());
     ic.position.copy(T.cam.position).lerp(Jg3.cam.position,k);ic.quaternion.copy(T.cam.quaternion).slerp(Jg3.cam.quaternion,k);
     const a=T.cam.projectionMatrix.elements,b=Jg3.cam.projectionMatrix.elements,m=ic.projectionMatrix.elements;
     for(let j=0;j<16;j++)m[j]=a[j]+(b[j]-a[j])*k;
     ic.projectionMatrixInverse.copy(ic.projectionMatrix).invert();ic.updateMatrixWorld();
     if(fog){fog.near=fn+(fog.near-fn)*k;fog.far=ff+(fog.far-ff)*k}
     cam=ic;
   }}
  T.r.render(T.scene,cam);
  if(fog){fog.near=fn;fog.far=ff}
}
/* ---------- 시작 연출 (방장이 그동안 시간·봇을 멈춤, 길이 G.introMs) ----------
   0~1.1초 로비 카메라 → 장기 카메라. 0.1~0.5초 판이 내려앉음.
   0.55초~ 알이 차례로 섬: 졸·병(내 왼쪽부터 물결) → 사 → 포 → 차 → 장(혼자 마지막, 더 높이서 쿵). 마·상은 상차림에서.
   장이 서면 '○○님이 초로 먼저 시작합니다', 그 뒤 상차림.
   바로 시작은 판을 다시 차리지 않음: 알이 같은 순서로 처음 자리로 미끄러져 돌아가고 마·상은 들어 올려 치움 */
const INTRO={cam:1100,ui:650,board:[100,400],zol:[550,110,300],at:{2:1250,5:1550,6:1850,7:2250},dur:320,kDur:420,say:2900};
const AGAIN={zol:[80,60],at:{2:420,5:600,6:780,7:960},say:1400};
G.introMs=again=>again?1700:3300;
const IN={on:false,on3d:false,t0:0,fromLobby:true,said:false,snd:{}};
const introOn=()=>IN.on&&clock()<IN.t0+G.introMs(IN.again);
const introWait=()=>introOn()&&!IN.said;
const dropY=(x,h)=>x>=1?0:x<.68?h*(1-(x/.68)*(x/.68)):h*.1*Math.sin(Math.PI*(x-.68)/.32);
/* 알 하나가 떨어지기(바로 시작이면 미끄러지기) 시작하는 시각과 길이 */
function pieceAt(t,sq,again){
  const A=again?AGAIN:INTRO;
  if(t===ZOL){const k=(Jg3.flipT?8-X(sq):X(sq))>>1;return [A.zol[0]+k*A.zol[1],INTRO.zol[2]]}
  return [A.at[t]||A.at[2],t===JANG?INTRO.kDur:INTRO.dur];
}
G.intro=(t0,o)=>{
  if(!V||!V.c||!V.ps)return;
  IN.again=!!(o&&o.again)&&Jg3.on;
  IN.on=true;IN.t0=t0;IN.said=false;IN.snd={};IN.fromLobby=!Jg3.on;IN.on3d=true;IN.gathered=false;
  $('#stage').classList.add('jg-intro');if(elJg&&IN.fromLobby)elJg.classList.add('intro');
  lastBar='';Jg3.dirty=true;
};
function introStep(now,force){
  if(!Jg3.built||!V||!V.c)return false;
  const e=now-IN.t0,done=force||e>=G.introMs(IN.again),fl=IN.fromLobby;
  if(done)IN.on3d=false;
  {const x=done||!fl?1:(e-INTRO.board[0])/INTRO.board[1];Jg3.boardG.visible=x>0;Jg3.boardG.position.y=dropY(Math.max(0,x),1.6)}
  if(IN.again){if(done)for(const g of Jg3.pcs.values())g.visible=true;return true}
  for(const [sq,g] of Jg3.pcs){
    const [a,d]=pieceAt(g.userData.t,sq),x=done?1:(e-a)/d;
    g.visible=x>0;g.position.y=PY+dropY(Math.max(0,Math.min(1,x)),g.userData.t===JANG?1.5:1);
  }
  return true;
}
function introEnd(){
  if(IN.on3d)introStep(clock(),true);
  IN.on=false;IN.on3d=false;IN.said=true;
  $('#stage').classList.remove('jg-intro');if(elJg)elJg.classList.remove('intro');
}
function introTick(){
  if(!IN.on)return;
  const e=clock()-IN.t0,S_=IN.snd,once=(k,f)=>{if(!S_[k]){S_[k]=1;f()}},A=IN.again?AGAIN:INTRO;
  if(e>=INTRO.ui&&elJg&&elJg.classList.contains('intro'))elJg.classList.remove('intro');
  if(IN.on3d&&Jg3.on){
    if(IN.fromLobby&&e>=INTRO.board[0]+INTRO.board[1]*.68)once('thud',()=>{tone(120,.13,{type:'triangle',vol:.2});hiss(.09,{freq:650,vol:.12})});
    const land=d=>IN.again?GLIDE:d*.68;
    for(let f=0;f<5;f++)if(e>=A.zol[0]+f*A.zol[1]+land(INTRO.zol[2]))once('z'+f,()=>sndLand(0));
    [[2,1],[5,2],[6,3],[7,4]].forEach(([t,k])=>{if(e>=A.at[t]+land(t===JANG?INTRO.kDur:INTRO.dur))once('t'+t,()=>sndLand(k))});
  }
  if(e>=A.say&&!IN.said){
    IN.said=true;$('#stage').classList.remove('jg-intro');if(elJg)elJg.classList.remove('intro');
    const w=V&&V.c?seatCho():-1,p=w>=0&&V.ps[w];
    if(p)say(w===myIdx()?'내가 초로 먼저 시작합니다.':`${p.n}님이 초로 먼저 시작합니다.`);
    sfx('turn');lastBar='';lastModes='';if(Jg3.on)j3Marks();
  }
  if(e>=G.introMs(IN.again)){IN.on=false;lastBar='';lastHint='';lastModes='';G.buttons()}
  drawAll();
}
const seatCho=()=>V.c.co[0]===0?0:1;
/* 3D 화면에서 누른 곳 → 점 (알 몸통을 먼저, 아니면 판 윗면에서 가장 가까운 점) */
const jgRay=()=>Jg3.ray||(Jg3.ray=new THREE.Raycaster());
function j3Point(e){
  const r=T.r.domElement.getBoundingClientRect();if(!r.width||!CS)return -1;
  const ray=jgRay();ray.setFromCamera({x:(e.clientX-r.left)/r.width*2-1,y:-(e.clientY-r.top)/r.height*2+1},Jg3.cam);
  const objs=[];for(const g of Jg3.pcs.values())if(g.visible)for(const pm of g.userData.parts)objs.push(pm);
  const hit=ray.intersectObjects(objs,false)[0];
  if(hit){for(const [sq,g] of Jg3.pcs)if(g.userData.parts.includes(hit.object))return sq}
  const o=ray.ray.origin,dv=ray.ray.direction;if(Math.abs(dv.y)<1e-6)return -1;
  const k=(TOP-o.y)/dv.y,x=o.x+dv.x*k,z=o.z+dv.z*k;
  const gx=Math.round(x/S+4),gr=Math.round(z/S+4.5);
  if(gx<0||gx>8||gr<0||gr>9||Math.hypot(x-(gx-4)*S,z-(gr-4.5)*S)>S*.5)return -1;
  return Jg3.flipT?IX(8-gx,gr):IX(gx,9-gr);
}
function j3Click(e){
  if(!Jg3.on||G!==GAMES.janggi)return;
  const sq=j3Point(e);if(sq<0)return;
  tapSq(sq);
}
/* 새 상태를 받았을 때 */
G.preView=()=>{
  if(!V.c){CS=null;return}
  CS=buildS(V.c);OC.at=clock();
  const me=myIdx();
  if(!PV||!PV.c||PV.st!==V.st||V.c.mv.length<PV.c.mv.length||(V.c.mv.length===0&&PV.c.mv.length===0&&PV.c.A!==V.c.A)){sel=-1;pend=null;popOpen=false}
  else if(PV.c.mv.length!==V.c.mv.length){
    const last=V.c.mv[V.c.mv.length-1],myMove=me>=0&&me<2&&CS.p.side!==myCol();
    if(myMove){sel=-1;pend=null}
    else{
      const col=myCol();
      if(sel>=0&&(!CS.p.b[sel]||(CS.p.b[sel]>>3)!==col)){sel=-1;pend=null}
      if(pend&&!legal(CS.p,true).includes(pend.m)){pend=null}
    }
    if(last==='pp')popOpen=false;
  }
  if(!inSet()||V.t!==me)suSel=-1;
  if(V.st!=='play'){sel=-1;pend=null;popOpen=false;suSel=-1}
};
G.postView=()=>{};
G.overExtra=()=>{
  const r=V&&V.c&&V.c.res;if(!r||!r.sc)return '';
  return `<p class="cardinfo">남은 기물 점수 · 초 <b>${r.sc[0]}</b> : 한 <b>${r.sc[1]}</b> (덤 ${DUM})</p>`;
};
G.logCue=()=>false;
/* 소리: 알이 놓이면 딱(도착하는 순간에 맞춤), 잡으면 딸깍이 더해짐, 장군은 두 음, 빅장은 낮은 두 음 */
G.cues=(v,pv)=>{
  if(!v.c||!pv.c)return;
  if(v.c.mv.length>pv.c.mv.length){
    const at=Jg3.on?.2:0;
    if(v.c.mv[v.c.mv.length-1]==='pp'){tone(520,.05,{type:'triangle',vol:.06});return}
    const cap=(v.c.cp[0].length+v.c.cp[1].length)>(pv.c.cp[0].length+pv.c.cp[1].length);
    sndPut(at,cap);
    if(v.st==='play'&&v.c.bik&&!pv.c.bik)sndBik(at+.12);
    else if(v.c.chk&&v.st==='play')sndCheck(at+.12);
  }
};
G.hud=inGame=>{
  if(!elJg)return;
  const on=!!(inGame&&V&&V.c&&CS);
  elJg.hidden=!on;
  $('#stage').classList.toggle('jg-over',!!(on&&V.st==='over'));
  const d3=on&&j3Build();
  if(d3!==Jg3.on){Jg3.on=d3;Jg3.lay='';if(Jg3.root)Jg3.root.visible=d3;$('#stage').classList.toggle('jg3d',d3);lastBoard='';lastHint=''}
  $('#stage').classList.toggle('jg2d',on&&!d3);
  if(!on){lastBoard='';lastBar='';lastHint='';lastModes='';lastSu='';return}
  drawAll();
  j3Sync();
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
  const play=$('#btnPlay'),set=inSet(),can=set?!!(suSel>=0&&mySetTurn()):!!(pend&&myTurnNow());
  $('#btnPass').hidden=true;$('#btnGura').hidden=true;
  play.disabled=!can;play.classList.toggle('ready',can);
  const lb=set?'정하기':'두기';if($('#playMain').textContent!==lb)$('#playMain').textContent=lb;
  const sub=keyLabel(KEYS.play);if($('#playSub').textContent!==sub)$('#playSub').textContent=sub;
};
G.live=()=>{
  if(IN.on)introTick();
  if(!V||!V.c||!CS)return;
  clockTick();
  if(inSet()&&(lastModes!==modesHTML()||lastSu!==(mySetTurn()&&Jg3.on?suBtns():'')))drawHint();
  if(flash&&!Jg3.on&&clock()-flash.at>720){flash=null;lastBoard='';drawAll()}
};
/* 이름 칸의 시간 (매 프레임 글자만 바꿈). 10초 남으면 빨갛게 깜빡임 */
function clockTick(){
  if(!elBar||!V||!V.c)return;
  elJg.querySelectorAll('.jg-bar [data-ct],.jg-mebar [data-ct]').forEach(el=>{const i=+el.dataset.ct,ms=remMs(i),t=fmtT(ms);if(el.textContent!==t)el.textContent=t;
    const low=V.st==='play'&&V.t===i&&(V.c.run||V.c.ph==='set')&&ms<=(V.c.ph==='set'?5000:10000);if(el.parentNode.classList.contains('low')!==low)el.parentNode.classList.toggle('low',low)});
  const sb=elSu&&elSu.querySelector('.jg-sut');
  if(sb){const ms=remMs(myIdx()),k=Math.max(0,Math.min(1,ms/SET_MS));sb.firstChild.style.transform=`scaleX(${k.toFixed(4)})`;const low=ms<=5000;if(sb.classList.contains('low')!==low)sb.classList.toggle('low',low)}
}
G.play=()=>{if(inSet())confirmSetup();else confirmPend()};
G.pass=()=>{};
G.keyPhase=st=>st==='play';
G.onKey=()=>false;
G.field3D=()=>{if(T.stacks)for(const arr of T.stacks.values())arr.forEach(c=>{c.visible=false})};
G.render3D=t=>{if(Jg3.on)j3Render(t);else if(T.ok&&!$('#stage').classList.contains('jg2d'))T.r.render(T.scene,T.cam)};
G.enter=()=>{
  $('#stage').classList.add('jg');
  $('#btnPass').hidden=true;$('#btnGura').hidden=true;$('#numpick').hidden=true;
  sel=-1;pend=null;popOpen=false;suSel=-1;
  if(elJg)fit();
};
G.leave=()=>{
  introEnd();
  $('#stage').classList.remove('jg','jg-over','jg3d','jg2d');
  if(T.stacks)for(const arr of T.stacks.values())arr.forEach(c=>{c.visible=true});
  if(Jg3.root)Jg3.root.visible=false;Jg3.on=false;Jg3.anim=[];
  $('#btnPass').hidden=false;
  if(elJg){elJg.hidden=true;elJg.classList.remove('suon');if(elSu)elSu.innerHTML='';lastBoard='';lastBar='';lastHint='';lastModes='';lastSu=''}
};
G.init=()=>{
  const css=document.createElement('style');
  css.textContent=`
.stage.jg{background:radial-gradient(ellipse at 50% 38%,#f3e4c2 0%,#e2c89a 70%,#d3b27c 100%)}
.stage.jg.jg2d #cv,.stage.jg #dim{visibility:hidden}
.stage.jg-intro .actions,.stage.jg-intro .myplate,.stage.jg-intro #jg .jg-row{opacity:0;pointer-events:none}
.stage.jg .actions,.stage.jg .myplate,#jg .jg-row,#jg .jg-bar,#jg .jg-mebar{transition:opacity .35s}
#jg.intro .jg-bar,#jg.intro .jg-mebar{opacity:0}
.stage.jg3d #jg svg.jg-board{display:none}
.stage.jg3d #jg .jg-hint{flex:0 1 auto;background:rgba(255,250,240,.9);border:1px solid var(--line-strong,#cdb391);border-radius:99px;padding:4px 12px;box-shadow:0 2px 6px -2px rgba(59,42,31,.35)}
.stage.jg .labels{visibility:hidden}
.stage.jg .nogl{display:none}
.stage.jg.jg-over .myplate,.stage.jg.jg-over .actions{display:none}
.specbar:not([hidden])~#jg .jg-bar{margin-top:30px}
.stage.jg .actions{left:auto}
.stage.jg .myplate{max-width:calc(100% - 150px)}
#jg{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;gap:6px;padding:8px 10px 82px;pointer-events:none;min-height:0}
#jg[hidden]{display:none}
#jg .jg-bar{min-height:44px;display:flex;flex-wrap:wrap;justify-content:center;align-items:flex-start;align-content:flex-end;gap:6px;align-self:center;max-width:calc(100% - 188px);pointer-events:none}
#jg .jg-mebar{position:absolute;left:50%;bottom:var(--plateB,14px);transform:translateX(-50%);z-index:2;display:flex;pointer-events:none;max-width:calc(100% - 188px)}
#jg .jg-mebar:empty{display:none}
#jg .jg-mebar .jg-pop{left:50%;top:auto;bottom:calc(100% + 4px);transform:translateX(-50%)}
#jg .jg-p{position:relative;display:flex;align-items:center;gap:6px;padding:4px 10px 5px;border-radius:12px;background:rgba(255,250,240,.92);border:1.5px solid var(--line-strong,#cdb391);font-size:13px;line-height:1.15;white-space:nowrap;max-width:100%}
#jg .jg-p.tap{pointer-events:auto;cursor:pointer}
#jg .dot{width:13px;height:13px;border-radius:50%;flex:none;display:inline-block;vertical-align:-2px}
#jg .dot.cho{background:#17684f;box-shadow:0 0 0 2px #fffaf0,0 0 0 3px #0e4535}
#jg .dot.han{background:#b5241b;box-shadow:0 0 0 2px #fffaf0,0 0 0 3px #7a1610}
#jg .jg-p b{font-weight:600;overflow:hidden;text-overflow:ellipsis;max-width:8em}
#jg .jg-p .w{font-family:var(--f-num,monospace);font-size:13px;font-weight:700;color:#5b4129;min-width:3em;text-align:right}
#jg .jg-p.low .w{color:#c0281c;animation:jgBlink 1s steps(2,start) infinite}
@keyframes jgBlink{50%{opacity:.25}}
#jg .jg-p .st{font-size:12px;color:var(--muted,#7a6550)}
#jg .jg-p .sc{font-family:var(--f-num,monospace);font-size:11px;font-weight:700;color:#7a6550}
#jg .jg-p.on{border-color:#c08a17;box-shadow:0 0 0 2px #f2b632}
#jg .jg-p .dr{font-weight:700;color:#7a4a10;background:#f2d27a;border-radius:99px;padding:0 6px;font-size:12px;animation:jgPulse 1.4s ease-in-out infinite}
@keyframes jgPulse{50%{box-shadow:0 0 0 3px rgba(242,182,50,.45)}}
#jg .jg-pop{position:absolute;left:0;top:calc(100% + 4px);z-index:5;display:flex;gap:6px}
#jg .jg-drbtn,#jg .jg-m{height:34px;padding:0 12px;border-radius:10px;border:2px solid var(--mustard-edge,#c08a17);background:var(--mustard,#f2b632);color:#3b2a1f;font-family:var(--f-display,inherit);font-size:15px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;pointer-events:auto;white-space:nowrap}
#jg .jg-drbtn.off{opacity:.45;filter:grayscale(.6)}
#jg .jg-m.su{padding:0 8px;background:rgba(255,250,240,.95);border-color:var(--line-strong,#cdb391);font-size:14px}
#jg .jg-su{position:absolute;left:var(--sux,50%);top:var(--suy,80%);width:var(--suw,280px);height:var(--suh,28px);transform:translate(-50%,-50%);display:flex;gap:4px;justify-content:center;z-index:2;pointer-events:none}
#jg .jg-su:empty{display:none}
#jg .jg-su .jg-m.su{flex:1 1 0;min-width:0;height:100%;padding:0 2px;justify-content:center;font-size:clamp(11px,calc(var(--suh,28px)*.5),15px);border-width:1.5px;border-radius:8px;pointer-events:auto}
.stage.jg-intro #jg .jg-su{opacity:0;pointer-events:none}
#jg .jg-su:not(:empty){animation:jgFade .35s ease-out}
@keyframes jgFade{from{opacity:0}}
#jg.suon .jg-mebar{opacity:0;pointer-events:none}
#jg .jg-sut{position:absolute;left:6px;right:6px;bottom:-8px;height:3px;border-radius:2px;background:rgba(59,42,31,.2);overflow:hidden;pointer-events:none}
#jg .jg-sut b{display:block;height:100%;background:#c08a17;transform-origin:left center}
#jg .jg-sut.low b{background:#c0281c;animation:jgBlink 1s steps(2,start) infinite}
#jg .jg-m.su.on{background:var(--mustard,#f2b632);border-color:var(--mustard-edge,#c08a17)}
#jg .jg-row{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;width:100%;pointer-events:none;min-height:44px}
.stage.jg3d #jg .jg-row{height:44px;min-height:0;flex:none;align-items:flex-start;padding-top:4px;overflow:visible;position:relative;z-index:1}
#jg .jg-hint:empty{visibility:hidden}
#jg .jg-hint{flex:1 1 200px;min-width:0;font-size:13px;line-height:1.3;color:#5b4129;text-align:center;min-height:17px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
#jg .jg-modes{display:flex;gap:4px;pointer-events:auto;flex-wrap:wrap;justify-content:center}
#jg .jg-modes:empty{display:none}
#jg .jg-bd{position:relative;flex:1;min-height:0;width:100%}
#jg svg.jg-board{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);pointer-events:auto;touch-action:manipulation;user-select:none;-webkit-user-select:none;filter:drop-shadow(0 6px 8px rgba(59,42,31,.35))}
@media (max-width:520px){#jg .jg-p{font-size:12px;padding:3px 8px 4px;gap:5px}#jg .jg-m,#jg .jg-drbtn{height:32px;padding:0 10px;font-size:14px}#jg .jg-m.su{padding:0 4px}#jg .jg-bar{max-width:calc(100% - 150px)}}
@media (max-width:520px){.stage.jg2d #jg .jg-bar{align-self:flex-start;width:calc(100% - 150px);max-width:none}}
.stage.jg3d #jg .jg-row{order:-1}
.stage.jg3d #jg.lay .jg-bar{transform:translateY(calc(var(--bs) - 100%));transition:transform .35s,opacity .35s}
.stage.jg3d #jg.lay .jg-mebar{top:var(--mt);bottom:auto;transition:top .35s,opacity .35s}
.stage.jg3d .specbar:not([hidden])~#jg .jg-bar{margin-top:0}
.stage.jg3d .specbar:not([hidden])~#jg .jg-row{margin-top:30px}
.stage.jg3d #jg.wide .jg-row{position:absolute;left:16px;top:8px;width:auto;max-width:34%;justify-content:flex-start}
.stage.jg3d #jg.wide .jg-bar{min-height:0}
.stage.jg3d .specbar:not([hidden])~#jg.wide .jg-bar{margin-top:30px}
@media (max-width:699px){#jg{padding-bottom:112px}#jg .jg-mebar{bottom:70px;max-width:calc(100% - 24px)}}
`;
  document.head.appendChild(css);
  elJg=document.createElement('div');elJg.id='jg';elJg.hidden=true;
  elJg.innerHTML=`<div class="jg-bar"></div><div class="jg-mebar"></div><div class="jg-su" role="group" aria-label="상차림"></div><div class="jg-row"><div class="jg-hint" aria-live="polite"></div><div class="jg-modes" role="group" aria-label="고르기"></div></div><div class="jg-bd"><svg class="jg-board" viewBox="-.8 -.8 9.6 10.6" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="장기판"><defs><radialGradient id="jgChk"><stop offset="0" stop-color="#ff2a14" stop-opacity=".95"/><stop offset=".6" stop-color="#e01e14" stop-opacity=".5"/><stop offset="1" stop-color="#c8140a" stop-opacity="0"/></radialGradient></defs><g id="jgMain"></g><g id="jgGhost"></g></svg></div>`;
  $('#stage').insertBefore(elJg,$('#fx'));
  elSvg=elJg.querySelector('svg.jg-board');elMain=elJg.querySelector('#jgMain');elGhost=elJg.querySelector('#jgGhost');
  elSu=elJg.querySelector('.jg-su');elBar=elJg.querySelector('.jg-bar');elBarMe=elJg.querySelector('.jg-mebar');elHint=elJg.querySelector('.jg-hint');elModes=elJg.querySelector('.jg-modes');
  elSvg.addEventListener('click',onSvgClick);
  for(const box of [elModes,elSu])box.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.su!=null)tapSetup(+b.dataset.su);else if(b.dataset.dr)sendOffer()});
  for(const bar of [elBar,elBarMe])bar.addEventListener('click',e=>{
    if(e.target.closest('[data-pass]')){e.stopPropagation();sendPass();return}
    if(e.target.closest('[data-dr]')){e.stopPropagation();sendOffer();return}
    if(e.target.closest('[data-me]')){e.jgPop=1;popOpen=!popOpen;lastBar='';drawAll()}
  });
  document.addEventListener('click',e=>{if(popOpen&&elJg&&!e.jgPop){popOpen=false;lastBar='';drawAll()}});   // 바깥을 누르면 닫힘 (칸을 다시 그리므로 e.target 대신 표시로 판단)
  document.addEventListener('keydown',e=>{if(e.code==='Escape'&&(pend||sel>=0||suSel>=0)&&elJg&&!elJg.hidden){if(suSel>=0){suSel=-1;redraw()}else cancelSel()}});
  window.addEventListener('resize',()=>{fit();Jg3.lay=''});
  $('#cv').addEventListener('click',j3Click);
};
G._j3={Jg3,IN,introEnd,pW,get CS(){return CS},tapSq,tapSetup,myMoves,movesFrom,get sel(){return sel},get pend(){return pend},get suSel(){return suSel},j3Point};   // 화면 검사용

if(typeof window!=='undefined')(window.GAMES=window.GAMES||{}).janggi=G;
})();
