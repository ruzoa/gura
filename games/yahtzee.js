/* ===== 야추다이스 게임 모듈 =====
   공통 코드(index.html)가 GAMES.yahtzee의 함수를 불러서 이 게임의 규칙·봇·화면을 그림.
   주사위 5개, 한 차례에 최대 3번 굴리고, 13칸 점수판에 기록해서 총점으로 순위를 정함 (턴제, 최대 4명, 빠른 모드 없음).
   화면: WebGL이 되면 공통 3D 테이블 위에 주사위 트레이와 컵을 올려서 굴리는 모습을 보여 주고(아래 '3D 주사위·컵'), 안 되면 2D 주사위 칸을 씀.
   칸 id: n1~n6(윗칸), three, four, full, small, large, yahtzee, chance(아랫칸). 점수판은 칸 순서(CATS)대로 배열로도 주고받음.
   손패(hand)는 카드가 아니라 '점수판 1장'을 뜻하는 표시: 공통 코드가 hand가 비면 끝난 사람으로 보기 때문에 게임 중에는 [0]으로 둠 */
(function(){
const G={id:'yahtzee',name:'야추다이스',short:'야추',lead:'주사위를 굴려 족보를 채우는 게임',brand:'야추',brandPx:62,maxHi:4,noFast:true};

/* ---------- 규칙 (방장 엔진과 화면이 같은 함수를 씀) ---------- */
const CATS=[
  {id:'n1',name:'1의 눈',rule:'1의 눈만 더합니다',up:true},
  {id:'n2',name:'2의 눈',rule:'2의 눈만 더합니다',up:true},
  {id:'n3',name:'3의 눈',rule:'3의 눈만 더합니다',up:true},
  {id:'n4',name:'4의 눈',rule:'4의 눈만 더합니다',up:true},
  {id:'n5',name:'5의 눈',rule:'5의 눈만 더합니다',up:true},
  {id:'n6',name:'6의 눈',rule:'6의 눈만 더합니다',up:true},
  {id:'three',name:'쓰리 카드',rule:'같은 눈 3개 이상이면 눈 전체 합',up:false},
  {id:'four',name:'포 카드',rule:'같은 눈 4개 이상이면 눈 전체 합',up:false},
  {id:'full',name:'풀하우스',rule:'같은 눈 3개 + 2개면 25점',up:false},
  {id:'small',name:'스몰 스트레이트',short:'S 스트레이트',rule:'4개 연속이면 30점',up:false},
  {id:'large',name:'라지 스트레이트',short:'L 스트레이트',rule:'5개 연속이면 40점',up:false},
  {id:'yahtzee',name:'야추',rule:'5개 모두 같은 눈이면 50점',up:false},
  {id:'chance',name:'찬스',rule:'조건 없이 눈 전체 합',up:false}
];
const byId={};CATS.forEach(c=>{byId[c.id]=c});
const PCOL=['#c53026','#2b65ca','#1f7a2e','#c9831a'];
const UPPER_BONUS=63,UPPER_PTS=35,YAHTZEE_BONUS=100;
const mkSc=()=>{const s={};CATS.forEach(c=>{s[c.id]=null});return s};
const counts=d=>{const c=[0,0,0,0,0,0,0];d.forEach(v=>{c[v]++});return c};
const sum=d=>d.reduce((a,b)=>a+b,0);
const isY=d=>d.length===5&&d[0]>0&&d.every(v=>v===d[0]);
function hasRun(d,len){
  const s=new Set(d);let best=0,cur=0;
  for(let i=1;i<=6;i++){if(s.has(i)){cur++;if(cur>best)best=cur}else cur=0}
  return best>=len;
}
/* 이 주사위로 칸 id에 기록하면 몇 점인가. joker: 야추를 50점으로 기록한 뒤 나온 추가 야추 (풀하우스·스트레이트를 정해진 점수로 쳐 줌) */
function calc(id,d,joker){
  const c=counts(d),mx=Math.max.apply(null,c.slice(1));
  if(id[0]==='n'){const n=+id[1];return n*c[n]}
  switch(id){
    case 'three':return mx>=3?sum(d):0;
    case 'four':return mx>=4?sum(d):0;
    case 'full':return (joker||(c.indexOf(3)>0&&c.indexOf(2)>0))?25:0;
    case 'small':return (joker||hasRun(d,4))?30:0;
    case 'large':return (joker||hasRun(d,5))?40:0;
    case 'yahtzee':return isY(d)?50:0;
    case 'chance':return sum(d);
  }
  return 0;
}
const jokerOf=(sc,d)=>isY(d)&&sc.yahtzee!==null;
/* 지금 기록할 수 있는 칸. 추가 야추(조커 규칙): 같은 눈의 윗칸이 비어 있으면 거기만, 아니면 빈 아랫칸 아무 곳, 아랫칸도 다 찼으면 빈 윗칸 아무 곳 */
function allowed(sc,d){
  const open=CATS.filter(c=>sc[c.id]===null).map(c=>c.id);
  if(jokerOf(sc,d)){
    const up='n'+d[0];
    if(open.indexOf(up)>=0)return [up];
    const low=open.filter(id=>id[0]!=='n');
    if(low.length)return low;
    return open;
  }
  return open;
}
function totals(sc,yb){
  let upper=0,lower=0;
  CATS.forEach(c=>{const v=sc[c.id];if(v!==null){if(c.up)upper+=v;else lower+=v}});
  const bonus=upper>=UPPER_BONUS?UPPER_PTS:0;
  return {upper,bonus,lower,yb:yb||0,total:upper+bonus+lower+(yb||0)};
}
const ROUNDS=13;   // 빠른 모드 없음: 방 설정의 fast 값은 무시

/* ---------- 봇 ---------- */
/* 주사위 5개의 눈 조합은 252가지. 남길 눈을 정하면 다시 굴렸을 때 어느 조합이 얼마의 확률로 나오는지 미리 셀 수 있음 */
const POW=[1,6,36,216,1296,7776];
const codeOf=d=>{let c=0;for(const v of d)c+=POW[v-1];return c};
const MS=[],MSI=new Map();
(function(){
  const d=[0,0,0,0,0];
  (function rec(k,mn){
    if(k===5){MSI.set(codeOf(d),MS.length);MS.push(d.slice());return}
    for(let v=mn;v<=6;v++){d[k]=v;rec(k+1,v)}
  })(0,1);
})();
const msIdx=d=>MSI.get(codeOf(d));
const RR=new Map();
function rerollDist(held){   // held: 오름차순으로 정렬된, 남길 눈들
  const key=held.join('');
  let r=RR.get(key);if(r)return r;
  const k=5-held.length,base=held.reduce((a,v)=>a+POW[v-1],0),N=Math.pow(6,k),acc=new Map();
  for(let t=0;t<N;t++){
    let x=t,c=base;
    for(let j=0;j<k;j++){c+=POW[x%6];x=(x/6)|0}
    acc.set(c,(acc.get(c)||0)+1);
  }
  const idx=[],p=[];
  for(const e of acc){idx.push(MSI.get(e[0]));p.push(e[1]/N)}
  r={idx:Int16Array.from(idx),p:Float64Array.from(p)};
  RR.set(key,r);return r;
}
/* 칸마다 '보통 이 정도는 나온다'는 점수. 기록한 점수가 이보다 높을수록 이득, 낮으면 손해로 쳐서 칸을 고름
   윗칸은 눈 3개씩(63점 보너스 기준)을 기준으로 두고, 보너스가 걸려 있어서 조금 더 크게 침 */
const BASE={three:21.7,four:13.1,full:22.6,small:29.5,large:32.7,yahtzee:16.9,chance:22};
const catVal=(id,pts)=>id[0]==='n'?1.4*(pts-3*(+id[1])):pts-BASE[id];
/* 이 주사위를 지금 기록한다면 가장 좋은 칸과 그 가치 (추가 야추 보너스 포함) */
function bestFor(sc,d){
  const joker=jokerOf(sc,d);
  let best=null,bv=-1e9;
  for(const id of allowed(sc,d)){
    const v=catVal(id,calc(id,d,joker));
    if(v>bv){bv=v;best=id}
  }
  if(isY(d)&&sc.yahtzee===50)bv+=YAHTZEE_BONUS;
  return {cat:best,val:bv};
}
/* 남길 눈의 서로 다른 조합 (같은 눈이 여러 개면 같은 조합) */
function holdsOf(d){
  const out=new Map();
  for(let m=0;m<32;m++){
    const h=[];for(let j=0;j<5;j++)if(m&(1<<j))h.push(d[j]);
    h.sort((a,b)=>a-b);
    const k=h.join('');if(!out.has(k))out.set(k,h);
  }
  return out;
}
/* W[조합 번호]가 '다시 굴린 뒤의 가치'일 때, 가장 좋은 남기기 */
function bestHold(d,W){
  let be=-1e9,bh=null;
  for(const h of holdsOf(d).values()){
    if(h.length===5)continue;
    const r=rerollDist(h);let e=0;
    for(let k=0;k<r.idx.length;k++)e+=r.p[k]*W[r.idx[k]];
    if(e>be){be=e;bh=h}
  }
  return {e:be,held:bh};
}
/* 남길 눈 목록에 맞게 실제 주사위 자리를 고름 */
function keepMask(dice,held){
  const need=held.slice(),mask=[false,false,false,false,false];
  dice.forEach((v,j)=>{const k=need.indexOf(v);if(k>=0){need.splice(k,1);mask[j]=true}});
  return mask;
}
function rawBest(sc,dice,al){
  const j=jokerOf(sc,dice);let best=al[0],bp=-1;
  for(const c of al){const p=calc(c,dice,j);if(p>bp){bp=p;best=c}}
  return best;
}
/* 쉬움: 가장 많이 나온 눈을 남기고, 마지막엔 점수가 가장 높은 칸 (가끔 엉뚱한 칸) */
function planEasy(sc,dice,left){
  const al=allowed(sc,dice);
  if(!al.length)return {};
  const c=counts(dice);let bv=1,bc=0;
  for(let v=1;v<=6;v++)if(c[v]>bc||(c[v]===bc&&v>bv)){bc=c[v];bv=v}
  if(left<=0||bc>=5){
    if(left<=0&&Math.random()<.18&&al.length>1)return {cat:al[Math.random()*al.length|0]};
    return {cat:rawBest(sc,dice,al)};
  }
  return {keep:dice.map(v=>v===bv)};
}
/* lv 0 쉬움, 1 보통(한 번 더 굴린 결과만 계산하고, 가끔 쉬움처럼 둠), 2 어려움(두 번 더 굴리는 것까지 계산)
   돌려주는 값: {keep: 남길 주사위 5칸} 또는 {cat: 기록할 칸} */
const LV1_SLIP=.5;   // 보통 봇이 쉬움처럼 두는 비율 (혼자 13칸을 채우면 평균 쉬움 약 145점, 보통 약 195점, 어려움 약 240점)
function plan(sc,dice,left,lv){
  if(!allowed(sc,dice).length)return {};
  if(lv<=0||(lv===1&&Math.random()<LV1_SLIP))return planEasy(sc,dice,left);
  const cur=bestFor(sc,dice);
  if(left<=0)return {cat:cur.cat};
  const V0=MS.map(d=>bestFor(sc,d).val);
  let W=V0;
  if(lv>=2&&left>=2)W=MS.map((d,k)=>Math.max(V0[k],bestHold(d,V0).e));
  const h=bestHold(dice,W);
  if(h.held&&h.e>cur.val+1e-9)return {keep:keepMask(dice,h.held)};
  return {cat:cur.cat};
}

/* ---------- 규칙 설명·방 설정 ---------- */
G.rulesHTML='<ol class="rules"><li><b>목표</b> : 주사위 5개로 13칸짜리 점수판을 채워서 <b>총점이 가장 높은 사람</b>이 승리합니다</li><li><b>내 차례</b> : 주사위를 최대 3번 굴립니다. 굴리기 버튼을 <b>꾹 누르면 컵을 흔들고, 손을 떼면 던집니다</b>. 굴린 뒤 남길 주사위를 눌러 <b>고정</b>하면 나머지만 다시 굴립니다</li><li><b>기록</b> : 굴리기를 멈추고 아직 비어 있는 칸 하나에 점수를 기록합니다. 조건이 맞지 않으면 0점으로 기록할 수도 있습니다</li><li><b>윗칸</b> : 고른 눈(1~6)만 더합니다. 윗칸 소계가 63점 이상이면 <b>보너스 35점</b>을 받습니다 (눈마다 3개씩 모으면 63점)</li><li><b>아랫칸</b> : 쓰리 카드(같은 눈 3개 이상, 눈 전체 합) · 포 카드(4개 이상, 눈 전체 합) · 풀하우스(3개 + 2개, 25점) · 스몰 스트레이트(4개 연속, 30점) · 라지 스트레이트(5개 연속, 40점) · 야추(5개 모두 같은 눈, 50점) · 찬스(조건 없음, 눈 전체 합)</li><li><b>야추 보너스</b> : 야추를 50점으로 기록한 뒤 또 야추가 나오면 <b>100점</b>을 더 받습니다. 이때는 같은 눈의 윗칸이 비어 있으면 그 칸에 기록해야 하고, 윗칸이 차 있으면 빈 아랫칸 아무 곳에 기록합니다. 풀하우스와 스트레이트는 정해진 점수를 받습니다</li><li><b>제한 시간</b> : 내 차례에 제한 시간이 지나면 남은 굴림과 기록을 알아서 처리합니다. 연결이 끊긴 사람은 봇이 대신 합니다</li><li><b>항복</b> : 항복하면 점수와 상관없이 가장 낮은 순위가 됩니다</li></ol>';
G.modeDesc=['13칸을 모두 채움','13칸을 모두 채움'];
G.defaults={max:4,turn:60};
G.roomSet=[
  {k:'turn',label:'제한 시간',unit:'초',lo:15,hi:180,step:5,desc:'내 차례에 제한 시간이 지나면 남은 굴림과 기록을 알아서 처리합니다. 연결이 끊긴 사람은 봇이 대신 합니다'}];
G.ruleSet=[];
G.cfgChips=c=>`<span class="chip">제한 시간 <b>${+c.turn||60}초</b></span>`;
G.cfgSum=c=>`제한 시간 ${+c.turn||60}초`;
G.roomSub=x=>`제한 시간 ${x.tn||60}초`;
G.pubExtra=c=>({tn:+c.turn||60});
G.cardInfo=(c,nowN)=>{
  const r=ROUNDS,n=Math.max(2,Math.min(4,nowN));
  return `<p class="cardinfo">지금 ${nowN}명이면 한 사람이 ${r}번씩, 모두 ${n*r}번 차례를 돕니다.${nowN>4?'<br>야추다이스는 최대 4명까지 할 수 있습니다.':''}</p>`;
};
G.rankTitle=()=>'';
G.finLabel=()=>'완료';
G.noEmotes=['gq'];
G.keys={yroll:'KeyC'};
G.keyActions=[{a:'yroll',n:'주사위 굴리기',d:'누르고 있으면 컵을 흔들고, 떼면 던집니다. 고정한 주사위는 그대로 둡니다'}];
/* 이 게임에는 카드가 없음 (공통 코드가 부르는 자리만 채움) */
G.cardHTML=()=>'';G.drawFace=()=>{};G.cmpCard=()=>0;G.labelOf=()=>'';

/* ---------- 주사위 물리 (화면 연출용, THREE 없이 숫자만 씀: 테스트에서도 돌림) ----------
   좌표: 테이블 윗면 y=0, 트레이 가운데가 원점, 화면 쪽이 +z. 주사위는 모서리가 둥근 정육면체(모서리 8곳의 작은 공)로,
   주사위끼리는 공 하나로 단순하게 부딪침. 눈은 방장이 정하고, 물리는 던지는 모습만 만든다 */
const DS=.72,DH=DS/2,DRAD=.095,DIN=DH-DRAD;            // 한 변, 반, 모서리 둥글기, 모서리 공의 중심
const EDGE_R=3,FELT_R=3.12,FLOOR=.024,FIELD_Z=.78,SLOT_Z=1.42,SLOT_DX=.9;   // 주사위가 넘지 못하는 펠트 가장자리(보이지 않음, 닿으면 튕기지 않고 멈춤), 펠트 반지름·높이, 굴린 주사위가 넘지 못하는 앞쪽 경계(z, 그 앞은 고정 칸 자리), 고정 칸 줄(z)과 간격
const GRAV=-34;                                          // 실제보다 느리게 떨어뜨려서 굴러가는 모습이 보이게
/* 눈 → 주사위 안쪽 좌표에서 그 면의 방향 (마주 보는 면의 합이 7) */
const FACE_N={1:[0,1,0],6:[0,-1,0],2:[0,0,1],5:[0,0,-1],3:[1,0,0],4:[-1,0,0]};
const qmul=(a,b)=>[a[0]*b[3]+a[3]*b[0]+a[1]*b[2]-a[2]*b[1],a[1]*b[3]+a[3]*b[1]+a[2]*b[0]-a[0]*b[2],a[2]*b[3]+a[3]*b[2]+a[0]*b[1]-a[1]*b[0],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
function qrot(q,v){
  const x=q[0],y=q[1],z=q[2],w=q[3];
  const ix=w*v[0]+y*v[2]-z*v[1],iy=w*v[1]+z*v[0]-x*v[2],iz=w*v[2]+x*v[1]-y*v[0],iw=-x*v[0]-y*v[1]-z*v[2];
  return [ix*w+iw*-x+iy*-z-iz*-y,iy*w+iw*-y+iz*-x-ix*-z,iz*w+iw*-z+ix*-y-iy*-x];
}
function qnorm(q){const l=Math.hypot(q[0],q[1],q[2],q[3])||1;return [q[0]/l,q[1]/l,q[2]/l,q[3]/l]}
/* 단위 벡터 a를 b로 돌리는 회전 */
function qFromUnit(a,b){
  let r=a[0]*b[0]+a[1]*b[1]+a[2]*b[2]+1,x,y,z;
  if(r<1e-6){r=0;if(Math.abs(a[0])>Math.abs(a[2])){x=-a[1];y=a[0];z=0}else{x=0;y=-a[2];z=a[1]}}
  else{x=a[1]*b[2]-a[2]*b[1];y=a[2]*b[0]-a[0]*b[2];z=a[0]*b[1]-a[1]*b[0]}
  return qnorm([x,y,z,r]);
}
const qAxis=(ax,ang)=>{const s=Math.sin(ang/2);return [ax[0]*s,ax[1]*s,ax[2]*s,Math.cos(ang/2)]};
/* 이 자세에서 위를 보는 눈 */
function topFace(q){let best=1,by=-9;for(let v=1;v<=6;v++){const y=qrot(q,FACE_N[v])[1];if(y>by){by=y;best=v}}return best}
/* 물리로 떨어진 자세 q에서 위를 보는 면에 '정해진 눈'이 오도록, 주사위 무늬를 미리 돌려 둘 회전 (보이는 자세 = q × 이 회전) */
const preRot=(q,want)=>qFromUnit(FACE_N[want],FACE_N[topFace(q)]);
/* 눈 want가 위로, 정면을 보게 칸에 놓인 자세. near가 있으면 그 자세에서 가장 덜 돌아가는 방향(90도 4가지 중)으로 */
function restQ(want,near){
  const base=qFromUnit(FACE_N[want],[0,1,0]);
  let best=base,bd=-1;
  for(let k=0;k<4;k++){
    const q=qmul(qAxis([0,1,0],k*Math.PI/2),base);
    if(!near)return q;
    const d=Math.abs(q[0]*near[0]+q[1]*near[1]+q[2]*near[2]+q[3]*near[3]);
    if(d>bd){bd=d;best=q}
  }
  return best;
}
const slotPos=i=>[(i-2)*SLOT_DX,FLOOR+DH,SLOT_Z];
/* 칸 정렬: 눈이 작은 주사위부터 왼쪽 칸에 (같은 눈은 주사위 번호 순). 돌려주는 값: 주사위 번호 → 칸 번호 */
function slotOrder(vals){const idx=[0,1,2,3,4].sort((a,b)=>(vals[a]-vals[b])||(a-b)),so=[];idx.forEach((i,s)=>{so[i]=s});return so}
/* 컵에서 쏟아질 때의 처음 상태. mouth: 컵 입구, dir: 쏟는 방향(수평 단위 벡터) */
/* gap: 주사위를 하나씩 쏟는 간격(초). k번째 주사위는 k×gap초 뒤에 입구에서 나옴 (그 전엔 움직이지도 부딪히지도 않음) */
const POUR_GAP=.075;
function throwStarts(n,mouth,dir,rnd,gap){
  const side=[-dir[2],0,dir[0]],out=[];
  for(let k=0;k<n;k++){
    const f=.3+rnd()*.12,l=(rnd()-.5)*.34;   // 입구 바로 앞, 가운데 근처
    const p=[mouth[0]+dir[0]*f+side[0]*l,mouth[1]+(rnd()-.5)*.14,mouth[2]+dir[2]*f+side[2]*l];
    const sp=POUR_SP[0]+rnd()*POUR_SP[1],lat=(rnd()-.5)*1.5;   // 벽이 없으니 펠트 안에서 멈출 만큼만
    const v=[dir[0]*sp+side[0]*lat,-.5+rnd()*1.1,dir[2]*sp+side[2]*lat];
    const wl=12+rnd()*12,wa=[rnd()-.5,rnd()-.5,rnd()-.5],wn=Math.hypot(...wa)||1;
    out.push({p,v,q:qnorm([rnd()-.5,rnd()-.5,rnd()-.5,rnd()-.5]),w:wa.map(x=>x/wn*wl),t0:k*(gap||0)});
  }
  return out;
}
const POUR_SP=[2.3,1.4];
/* 끝까지 미리 계산해서 1/60초마다 자세를 기록. statics: 칸에 고정된 주사위 위치 (움직이지 않는 장애물) */
function simThrow(starts,statics){
  const n=starts.length,dt=1/240,INV=6/(DS*DS),MU=.45,RS=DH*1.06;
  const B=starts.map(s=>({p:s.p.slice(),v:s.v.slice(),q:qnorm(s.q),w:s.w.slice(),fl:false,calm:0,lastHit:-1,t0:+s.t0||0}));
  const out=b=>step*dt<b.t0;   // 아직 컵에서 안 나온 주사위
  const C=[];for(const a of [-1,1])for(const b of [-1,1])for(const c of [-1,1])C.push([a*DIN,b*DIN,c*DIN]);
  const frames=[],hits=[];
  const rec=()=>{const f=new Float32Array(n*7);B.forEach((b,i)=>{f[i*7]=b.p[0];f[i*7+1]=b.p[1];f[i*7+2]=b.p[2];f[i*7+3]=b.q[0];f[i*7+4]=b.q[1];f[i*7+5]=b.q[2];f[i*7+6]=b.q[3]});frames.push(f)};
  /* 한 점에서의 충돌: 튕김 + 마찰 (주사위 질량 1, 관성 모멘트 DS²/6) */
  const contact=(b,r,nx,ny,nz,pen,e,step)=>{
    const vpx=b.v[0]+b.w[1]*r[2]-b.w[2]*r[1],vpy=b.v[1]+b.w[2]*r[0]-b.w[0]*r[2],vpz=b.v[2]+b.w[0]*r[1]-b.w[1]*r[0];
    const vn=vpx*nx+vpy*ny+vpz*nz;
    if(vn<0){
      const rnx=r[1]*nz-r[2]*ny,rny=r[2]*nx-r[0]*nz,rnz=r[0]*ny-r[1]*nx;
      const k=1+INV*(rnx*rnx+rny*rny+rnz*rnz),j=-(1+(vn<-1.4?e:0))*vn/k;
      b.v[0]+=nx*j;b.v[1]+=ny*j;b.v[2]+=nz*j;b.w[0]+=INV*j*rnx;b.w[1]+=INV*j*rny;b.w[2]+=INV*j*rnz;
      // 마찰: 미끄러지는 방향 반대로, 누르는 힘에 비례한 만큼까지
      const ux=b.v[0]+b.w[1]*r[2]-b.w[2]*r[1],uy=b.v[1]+b.w[2]*r[0]-b.w[0]*r[2],uz=b.v[2]+b.w[0]*r[1]-b.w[1]*r[0];
      const un=ux*nx+uy*ny+uz*nz,tx=ux-nx*un,ty=uy-ny*un,tz=uz-nz*un,tl=Math.hypot(tx,ty,tz);
      if(tl>1e-6){
        const ex=tx/tl,ey=ty/tl,ez=tz/tl,rtx=r[1]*ez-r[2]*ey,rty=r[2]*ex-r[0]*ez,rtz=r[0]*ey-r[1]*ex;
        const jt=Math.min(tl/(1+INV*(rtx*rtx+rty*rty+rtz*rtz)),MU*j);
        b.v[0]-=ex*jt;b.v[1]-=ey*jt;b.v[2]-=ez*jt;b.w[0]-=INV*jt*rtx;b.w[1]-=INV*jt*rty;b.w[2]-=INV*jt*rtz;
      }
      if(-vn>1.6&&step-b.lastHit>10){b.lastHit=step;hits.push([step*dt,-vn])}
    }
    const c=Math.min(pen,.05)*.5;b.p[0]+=nx*c;b.p[1]+=ny*c;b.p[2]+=nz*c;
  };
  rec();
  const MAXS=Math.round(3.6/dt);let quiet=0,step=0;
  for(;step<MAXS;step++){
    for(const b of B){
      if(out(b))continue;
      b.v[1]+=GRAV*dt;
      const wd=b.fl?1-3.2*dt:1-.35*dt,vd=b.fl?1-1.1*dt:1-.04*dt;
      b.w[0]*=wd;b.w[1]*=wd;b.w[2]*=wd;b.v[0]*=vd;b.v[2]*=vd;
      b.p[0]+=b.v[0]*dt;b.p[1]+=b.v[1]*dt;b.p[2]+=b.v[2]*dt;
      const dq=qmul([b.w[0],b.w[1],b.w[2],0],b.q);
      b.q=qnorm([b.q[0]+dq[0]*.5*dt,b.q[1]+dq[1]*.5*dt,b.q[2]+dq[2]*.5*dt,b.q[3]+dq[3]*.5*dt]);
      b.fl=false;
    }
    for(let it=0;it<3;it++){
      for(const b of B){
        if(out(b))continue;
        for(const c of C){
          const r=qrot(b.q,c),px=b.p[0]+r[0],py=b.p[1]+r[1],pz=b.p[2]+r[2];
          const pf=FLOOR+DRAD-py;
          if(pf>0){b.fl=true;contact(b,r,0,1,0,pf,.32,step)}
          const hd=Math.hypot(px,pz),pw=hd+DRAD-EDGE_R;
          if(pw>0&&hd>1e-6)contact(b,r,-px/hd,0,-pz/hd,pw,0,step);
          const pf2=pz+DRAD-FIELD_Z;if(pf2>0)contact(b,r,0,0,-1,pf2,0,step);
        }
      }
      // 주사위끼리 (공으로 단순화), 칸에 고정된 주사위는 움직이지 않음
      for(let i=0;i<n;i++){
        const a=B[i];if(out(a))continue;
        for(let j=i+1;j<=n-1+statics.length;j++){
          const o=j<n?B[j]:null,op=o?o.p:statics[j-n];
          if(o&&out(o))continue;
          const dx=op[0]-a.p[0],dy=op[1]-a.p[1],dz=op[2]-a.p[2],d=Math.hypot(dx,dy,dz);
          if(d>=RS*2||d<1e-6)continue;
          const nx=dx/d,ny=dy/d,nz=dz/d,pen=RS*2-d;
          const rv=((o?o.v[0]:0)-a.v[0])*nx+((o?o.v[1]:0)-a.v[1])*ny+((o?o.v[2]:0)-a.v[2])*nz;
          if(rv<0){
            const jj=-(1.35)*rv/(o?2:1);
            a.v[0]-=nx*jj;a.v[1]-=ny*jj;a.v[2]-=nz*jj;
            if(o){o.v[0]+=nx*jj;o.v[1]+=ny*jj;o.v[2]+=nz*jj}
            if(-rv>1.6&&step-a.lastHit>10){a.lastHit=step;hits.push([step*dt,-rv*.8])}
          }
          const m=o?pen/2:pen;a.p[0]-=nx*m;a.p[1]-=ny*m;a.p[2]-=nz*m;
          if(o){o.p[0]+=nx*m;o.p[1]+=ny*m;o.p[2]+=nz*m}
        }
      }
    }
    let all=true;
    for(const b of B){
      const calm=!out(b)&&b.fl&&Math.hypot(...b.v)<.08&&Math.hypot(...b.w)<.7;
      b.calm=calm?b.calm+1:0;if(b.calm<20)all=false;
    }
    quiet=all?quiet+1:0;
    if(step%4===3)rec();
    if(quiet>0)break;
  }
  rec();
  return {frames,hits,fin:B.map(b=>b.q.slice()),pos:B.map(b=>b.p.slice()),dur:frames.length/60};
}

/* ---------- 방장 엔진 (규칙 처리) ---------- */
function nextP(i){
  const n=H.players.length,Y=H.y;
  for(let k=1;k<=n;k++){const j=(i+k)%n;if(!H.players[j].finished&&Y.done[j]<Y.rounds)return j}
  return -1;
}
function startTurn(i){
  const Y=H.y;
  if(i<0){endGame();return}
  H.turn=i;H.graceUntil=0;
  H.deadline=clock()+H.cfg.turn*1000;
  H.botActAt=H.players[i].bot?clock()+rand(900,1800):0;
  Y.dice=[0,0,0,0,0];Y.held=[false,false,false,false,false];Y.left=3;Y.rolled=false;Y.tn++;Y.sh=0;Y.shk=[false,false,false,false,false];Y.hk=[false,false,false,false,false];Y.bk=null;
  mark();
}
/* keep: 남길 주사위 5칸(true = 남김). 첫 굴림에는 모두 굴림 */
function doRoll(i,keep){
  const Y=H.y;
  if(Y.left<=0)return false;
  const k=Y.rolled?keep.slice(0,5).map(Boolean):[false,false,false,false,false];
  while(k.length<5)k.push(false);
  if(Y.rolled&&k.every(Boolean))return false;
  Y.held=k;
  for(let j=0;j<5;j++)if(!k[j])Y.dice[j]=1+(Math.random()*6|0);
  Y.left--;Y.rolled=true;Y.rl++;Y.sh=0;Y.bk=null;Y.hk=k.slice();   // 남긴 주사위는 계속 고정 칸에
  mark();return true;
}
/* 컵 흔들기 (화면 연출용): 다른 사람 화면에도 컵을 흔드는 모습과 컵에 들어갈 주사위를 보여 줌. 규칙에는 영향 없음 */
function doShake(i,keep){
  const Y=H.y;
  if(Y.left<=0||Y.sh)return false;
  const k=Y.rolled&&Array.isArray(keep)?keep.slice(0,5).map(Boolean):[false,false,false,false,false];
  while(k.length<5)k.push(false);
  if(Y.rolled&&k.every(Boolean))return false;
  Y.sh=1;Y.shk=k;mark();return true;
}
/* 고정 칸으로 옮기기 (화면 표시용): 굴릴 때 실제로 남기는 주사위는 roll의 keep으로 정함 */
function doHold(i,keep){
  const Y=H.y;
  if(!Y.rolled||Y.left<=0||Y.sh||!Array.isArray(keep))return false;
  const k=keep.slice(0,5).map(Boolean);while(k.length<5)k.push(false);
  Y.hk=k;mark();return true;
}
function doScore(i,cat){
  const Y=H.y,p=H.players[i],d=Y.dice;
  if(!Y.rolled||typeof cat!=='string'||!CATS.some(c=>c.id===cat)||Y.sc[i][cat]!==null)return false;
  if(allowed(Y.sc[i],d).indexOf(cat)<0)return false;
  const pts=calc(cat,d,jokerOf(Y.sc[i],d));
  let note='';
  if(isY(d)&&Y.sc[i].yahtzee===50){Y.yb[i]+=YAHTZEE_BONUS;note=` (야추 보너스 +${YAHTZEE_BONUS})`}
  Y.sc[i][cat]=pts;Y.done[i]++;
  Y.lm={p:i,c:cat,pt:pts,d:d.slice()};
  H.seatNote[i]=`${byId[cat].name} ${pts}점`;
  addLog(`${p.name} ${byId[cat].name} ${pts}점${note}`);
  startTurn(nextP(i));
  return true;
}
const totalOf=i=>totals(H.y.sc[i],H.y.yb[i]).total;
/* 끝: 항복하지 않은 사람끼리 총점 순위 (같은 점수는 같은 순위), 항복한 사람은 그 아래 */
function endGame(){
  const act=H.players.map((p,i)=>i).filter(i=>!H.players[i].surrendered),tot=act.map(totalOf);
  act.forEach((i,k)=>{H.players[i].rank=1+tot.filter(t=>t>tot[k]).length});
  H.players.forEach(p=>{p.finished=true;p.hand=[]});
  const best=act.length?Math.max.apply(null,tot):0,win=act.filter((i,k)=>tot[k]===best);
  addLog(win.length===1?`게임 종료. ${H.players[win[0]].name} 우승! (${best}점)`:'게임 종료','sys');
  H.phase='over';mark();
  H.players.forEach((p,i)=>{if(p.bot&&Math.random()<.5)botEmote(i,'gg',800+Math.random()*1600)});
}
function doSurrender(i){
  if(H.phase!=='play'||i<0||H.players[i].finished)return;
  const p=H.players[i];
  p.hand=[];p.finished=true;p.surrendered=true;p.rank=H.rankBottom--;
  H.seatNote[i]='항복';
  addLog(`${p.name} 항복! ${p.rank}위`,'lie');
  if(H.players.filter(x=>!x.finished).length<=1){endGame();return}
  if(H.turn===i)startTurn(nextP(i));else mark();
}
/* 한 번 굴리거나 기록하는 봇의 한 동작 */
/* 봇: 컵을 잠깐 흔든 뒤 굴리고, 화면에서 주사위가 다 떨어질 때까지 기다렸다가 다음 동작 */
const ROLL_ANIM=2700;   // 컵을 기울여 던지고 주사위가 칸에 놓일 때까지 걸리는 시간 (화면 연출, 대략)
const sameMask=(a,b)=>[0,1,2,3,4].every(j=>!!(a||[])[j]===!!(b||[])[j]);
function botStep(i){
  const Y=H.y;
  if(Y.sh){doRoll(i,Y.bk||Y.shk);H.botActAt=clock()+ROLL_ANIM+rand(500,1200);return}
  if(!Y.rolled){if(doShake(i,[]))H.botActAt=clock()+rand(650,1000);else doRoll(i,[]);return}
  if(Y.bk){if(doShake(i,Y.bk)){H.botActAt=clock()+rand(650,1000);return}Y.bk=null}   // 골라 둔 주사위로 흔들기
  const pl=plan(Y.sc[i],Y.dice,Y.left,botLv(H.players[i]));
  if(pl.keep&&pl.keep.some(k=>!k)){
    Y.bk=pl.keep.map(Boolean);
    if(!sameMask(Y.hk,Y.bk)){doHold(i,Y.bk);H.botActAt=clock()+rand(600,950);return}   // 먼저 남길 주사위를 고정 칸으로 옮기는 모습
    if(doShake(i,Y.bk)){H.botActAt=clock()+rand(650,1000);return}
    Y.bk=null;
  }
  const cat=pl.cat||bestFor(Y.sc[i],Y.dice).cat||allowed(Y.sc[i],Y.dice)[0];
  doScore(i,cat);
}
/* 제한 시간이 지났을 때: 남은 굴림과 기록을 한꺼번에 알아서 처리 */
function autoFinish(i){
  const Y=H.y;
  for(let g=0;g<6;g++){
    if(!Y.rolled){doRoll(i,[]);continue}
    if(Y.sh&&Y.left>0&&doRoll(i,Y.shk))continue;   // 흔들던 중이면 그 주사위로 굴림
    const pl=plan(Y.sc[i],Y.dice,Y.left,1);
    if(pl.keep&&doRoll(i,pl.keep))continue;
    const cat=pl.cat||bestFor(Y.sc[i],Y.dice).cat||allowed(Y.sc[i],Y.dice)[0];
    if(doScore(i,cat))return;
  }
  const c=allowed(Y.sc[i],Y.dice)[0];if(c)doScore(i,c);
}
function timeout(){
  const i=H.turn,p=H.players[i];
  if(!p.bot)addLog(`${p.name} 시간 초과. 남은 굴림과 기록을 자동으로 처리합니다.`,'sys');
  autoFinish(i);
}
/* 테스트(tests/engine.test.js)에서 직접 부르는 내부 함수 */
G._test={doHold,phys:{simThrow,throwStarts,topFace,preRot,restQ,qrot,qmul,qAxis,FACE_N,slotPos,slotOrder,EDGE_R,FIELD_Z,POUR_GAP,DS,DH,FLOOR,DRAD},CATS,calc,allowed,totals,jokerOf,plan,bestFor,doRoll,doShake,doScore,doSurrender,autoFinish,timeout,botStep,rerollDist,msIdx,MS,ROUNDS,hasRun,counts,isY,mkSc,
  d3:()=>({A,D3}),view:{turnHTML,diceHTML,rollHTML,boardHTML,hintText,preView:()=>G.preView(),overExtra:()=>G.overExtra(),setCat:c=>{yCat=c},getCat:()=>yCat,getHold:()=>yHold.slice(),setHold:h=>{yHold=h.slice()}}};
G.engine={
  /* 게임 시작: 공통 코드가 H.players를 만든 뒤 부름 */
  start(){
    const n=H.players.length,cnt=Math.max(2,Math.min(n,4)),rounds=ROUNDS;
    Object.assign(H,{phase:'play',log:[],seatNote:{},field:[],last:null,reveal:null,shouts:[],pending:null,rankNext:1,rankBottom:cnt,known:{}});
    const Y={n,cnt,rounds,sc:[],yb:[],done:[],dice:[0,0,0,0,0],held:[false,false,false,false,false],left:3,rolled:false,rl:0,tn:0,lm:null,first:0,sh:0,shk:[false,false,false,false,false],hk:[false,false,false,false,false],bk:null};
    H.players.forEach((p,i)=>{
      Y.sc.push(mkSc());Y.yb.push(0);
      if(i<cnt){Y.done.push(0);p.hand=[0]}
      else{Y.done.push(rounds);p.hand=[];p.finished=true;p.rank=i+1}   // 자리가 모자라면(5명 이상) 구경만 함 (보통은 최대 인원 4명이라 생기지 않음)
    });
    H.y=Y;
    const first=Math.random()*cnt|0;Y.first=first;
    addLog(`${cnt}명 게임 시작 (${rounds}라운드). ${H.players[first].name}부터 시작합니다.`,'sys');
    startTurn(first);
  },
  act(seat,a){
    if(a.t==='surrender'){doSurrender(seat);return}
    if(H.phase!=='play'||seat<0||H.turn!==seat)return;
    if(a.t==='hold'){
      doHold(seat,a.keep);
    }else if(a.t==='shake'){
      doShake(seat,Array.isArray(a.keep)?a.keep:[]);
    }else if(a.t==='roll'){
      doRoll(seat,Array.isArray(a.keep)?a.keep:[]);
    }else if(a.t==='score'){
      if(typeof a.cat!=='string')return;
      doScore(seat,a.cat);
    }
  },
  tick(t){
    if(H.phase!=='play')return;
    const cur=H.players[H.turn];
    if(t>=H.deadline)timeout();
    else if(cur.bot&&H.botActAt&&t>=H.botActAt&&!(cur.away&&t<cur.awayAt+AWAY_WAIT))botStep(H.turn);
  },
  snap(s,you,t){
    const Y=H.y;
    s.y={n:Y.n,cnt:Y.cnt,rd:Y.rounds,d:Y.dice.slice(),hd:Y.held.slice(),l:Y.left,r:Y.rolled?1:0,rl:Y.rl,tn:Y.tn,
      sc:Y.sc.map(o=>CATS.map(c=>o[c.id])),yb:Y.yb.slice(),dn:Y.done.slice(),
      lm:Y.lm?{p:Y.lm.p,c:Y.lm.c,pt:Y.lm.pt,d:Y.lm.d.slice()}:null,f0:Y.first,sh:Y.sh?1:0,shk:(Y.shk||[]).slice(),hk:(Y.hk||[]).slice()};
    s.gr=0;s.dl=Math.max(0,Math.round(H.deadline-t));
  },
  restore(){},
  emoPhase:ph=>ph==='play'||ph==='over'
};

/* ---------- 화면 (모든 참가자) ---------- */
const PIPS={0:[],1:[5],2:[1,9],3:[1,5,9],4:[1,3,7,9],5:[1,3,5,7,9],6:[1,3,4,6,7,9]};
let yCat=null,yHold=[false,false,false,false,false],yLock={rl:-1,tn:-1,at:0},yMsg='',yMsgUntil=0,yMsgTimer=null,yTumbleUntil=0;
let elYz=null,elTurn=null,elDice=null,elRoll=null,elHint=null,elTbl=null,elLeft=null,elHold=null,yInk={k:'',until:0},lastTurn='',lastDice='',lastRoll='',lastBoard='',lastHint='';
const scoreOf=i=>{const o={};if(V&&V.y&&V.y.sc[i])CATS.forEach((c,k)=>{o[c.id]=V.y.sc[i][k]});return o};
const myTurnNow=()=>!!(V&&V.y&&V.st==='play'&&myReady());
function say(txt){
  yMsg=txt;yMsgUntil=Date.now()+2400;drawHint();
  clearTimeout(yMsgTimer);yMsgTimer=setTimeout(drawHint,2500);
}
function canRoll(){
  if(!myTurnNow()||!d3Ready())return false;
  const Y=V.y;
  if(Y.l<=0)return false;
  if(yLock.rl===Y.rl&&yLock.tn===Y.tn&&Date.now()-yLock.at<1500)return false;
  return !Y.r||yHold.some(h=>!h);
}
/* 굴리기 버튼을 누를 수 있는가: 굴릴 수 있거나, 지금 내가 꾹 누르고 흔드는 중 */
const shakingMine=()=>D3.on&&A.mine&&!A.released&&(A.st==='lift'||A.st==='shake');
const rollOn=()=>canRoll()||shakingMine();
function canScore(){
  if(!myTurnNow()||!V.y.r||!yCat||!d3Ready())return false;
  if(yLock.tn===V.y.tn&&yLock.sc&&Date.now()-yLock.at<1500)return false;
  return true;
}
function rollNow(){
  if(!canRoll())return;
  const Y=V.y;
  yLock={rl:Y.rl,tn:Y.tn,at:Date.now()};
  sendAct({t:'roll',keep:Y.r?yHold.slice():[false,false,false,false,false]});
  yCat=null;drawAll();G.buttons();
}
function record(){
  if(!canScore())return;
  const me=myIdx();
  if(allowed(scoreOf(me),V.y.d).indexOf(yCat)<0)return;
  yLock={rl:V.y.rl,tn:V.y.tn,at:Date.now(),sc:1};
  sendAct({t:'score',cat:yCat});
  yCat=null;drawAll();G.buttons();
}
function toggleHold(i){
  if(!V||!V.y||V.st!=='play'||myIdx()<0||V.t!==myIdx())return;
  if(!V.y.r){say('먼저 주사위를 굴려야 합니다.');return}
  if(V.y.l<=0){say('굴림을 모두 썼습니다. 기록할 칸을 골라 주세요.');return}
  if(!myTurnNow()||!d3Ready())return;
  yHold[i]=!yHold[i];
  sendAct({t:'hold',keep:yHold.slice()});   // 다른 사람 화면에서도 주사위가 고정 칸으로 옮겨 가게
  if(!D3.on)try{sfx('pick')}catch(e){}
  drawAll();G.buttons();
}
function pickCat(id){
  if(!myTurnNow()||!d3Ready())return;
  if(!V.y.r){say('먼저 주사위를 굴려야 합니다.');return}
  if(allowed(scoreOf(myIdx()),V.y.d).indexOf(id)<0)return;
  if(yCat===id){record();return}
  yCat=id;try{sfx('tick')}catch(e){}
  drawAll();G.buttons();
}
/* ---------- 3D 주사위·컵 (화면 연출) ----------
   공통 3D 테이블(T.scene)에 트레이·컵·주사위를 올리고, 자기 카메라(D3.cam)로 점수 종이에 가리지 않는 자리에 그림.
   흐름(A.st): idle → lift(컵이 들려 오고 다시 굴릴 주사위가 컵으로) → shake(흔들기) → pour(기울이기)
              → wait(내가 던졌는데 방장 결과가 아직이면) → fly(미리 계산한 물리를 재생) → rest → settle(떨어진 자리에서 바로 세움) → idle
   내 차례: 굴리기 버튼을 누르는 동안 흔들고, 떼면 방장에게 굴리기를 보내며 컵을 기울임.
   다른 사람·봇·관전: 방장 상태의 sh(흔드는 중)와 rl(굴림 번호)을 보고 같은 흐름을 재생.
   주사위가 칸에 놓이기 전(d3Ready가 아닐 때)에는 고정·기록·다시 굴리기를 막고 점수 예상값도 숨김 */
const D3={on:false,built:false,fail:false,dirty:true,lastR:0,lay:'',layDirty:true,layAt:0,root:null,cam:null,cup:null,band:null,dice:[],held:[],bandCol:-1,d:12};
const A={st:'idle',tn:-1,rl:-1,t0:0,mine:false,released:false,pend:null,rec:null,thrown:[],keep:[false,false,false,false,false],shakeT0:0,recT0:0,hitK:0,rattleAt:0,waitUntil:0};
const CUP_K=1.3,CUP_H=1*CUP_K;   // 컵 크기 배율(모델은 높이 1로 만들고 키움)과 실제 높이
const CUP_REST=[3.3,0,-1.7],CUP_UP=[2.2,1.3,-1.1];   // 컵이 쉬는 자리(펠트 밖 오른쪽, 휴대폰 위쪽 버튼에 가리지 않게), 흔드는 자리
const POUR_DIR=(()=>{const x=-.97,z=.22,l=Math.hypot(x,z);return [x/l,0,z/l]})();   // 왼쪽(살짝 화면 쪽)으로 쏟아서 입구 안이 보이고 테이블 가운데에 퍼지게
const Q_ID=[0,0,0,1],Q_POUR=qAxis((()=>{const l=Math.hypot(POUR_DIR[2],POUR_DIR[0]);return [POUR_DIR[2]/l,0,-POUR_DIR[0]/l]})(),1.35);   // 거의 눕힘: 입구가 카메라 쪽으로 조금 보이게
const ease=k=>k<=0?0:k>=1?1:k*k*(3-2*k);
const reduced=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){return false}};
function qslerp(a,b,k){
  let d=a[0]*b[0]+a[1]*b[1]+a[2]*b[2]+a[3]*b[3],s=1;if(d<0){d=-d;s=-1}
  if(d>.9995)return qnorm(a.map((x,i)=>x+(s*b[i]-x)*k));
  const th=Math.acos(d),sn=Math.sin(th),wa=Math.sin((1-k)*th)/sn,wb=s*Math.sin(k*th)/sn;
  return [a[0]*wa+b[0]*wb,a[1]*wa+b[1]*wb,a[2]*wa+b[2]*wb,a[3]*wa+b[3]*wb];
}
const mouthOf=(p,q)=>{const m=qrot(q,[0,CUP_H*.92,0]);return [p[0]+m[0],p[1]+m[1],p[2]+m[2]]};
/* 컵 안의 주사위: 컵에 들어가면 작아짐(IN_S)이 보통 크기 주사위 5개는 안 들어가는 컵이라, 들어갈 때 줄고 쏟아질 때 커짐
   자리: 바닥에 3개, 그 위에 2개 (컵 기준 좌표, 컵 배율 적용 전) */
const IN_S=.6,IN_SLOT=[[.22,0,0],[-.11,0,.19],[-.11,0,-.19],[.06,1,.1],[-.06,1,-.1]];
const IN_PH=[0,1.3,2.6,3.9,5.2],IN_AX=[[1,.3,0],[0,1,.4],[.5,0,1],[1,1,0],[0,.6,1]].map(a=>{const l=Math.hypot(...a);return a.map(x=>x/l)});
function inCup(i,cp,cq,now,amp){
  const sl=IN_SLOT[i],h=DS*IN_S,s=now/1000;
  const jump=amp?Math.abs(Math.sin(s*(17+i*3)+IN_PH[i]))*.17*amp:0;
  const loc=[sl[0]*CUP_K,(.14*CUP_K+h/2)+sl[1]*h*.95+jump,sl[2]*CUP_K];
  const w=qrot(cq,loc),p=[cp[0]+w[0],cp[1]+w[1],cp[2]+w[2]];
  const spin=amp?qAxis(IN_AX[i],s*(9+i)*amp+IN_PH[i]):qAxis(IN_AX[i],IN_PH[i]*.3);
  return {p,q:qmul(cq,spin)};
}
const mineNow=()=>!!(V&&V.y&&V.st==='play'&&myIdx()>=0&&V.t===myIdx());
/* 주사위가 칸에 놓여 있어서 고정·기록·굴리기를 해도 되는가 (2D 화면이면 항상) */
function d3Ready(){
  if(!D3.on||!V||!V.y||V.st!=='play')return true;
  return A.st==='idle'&&A.tn===V.y.tn&&A.rl===V.y.rl;
}

/* --- 물체 만들기 (처음 3D가 필요할 때 한 번) --- */
function roundBox(s,r,seg){
  const g=new THREE.BoxGeometry(s,s,s,seg,seg,seg),pa=g.attributes.position,na=g.attributes.normal,h=s/2-r;
  for(let k=0;k<pa.count;k++){
    const x=pa.getX(k),y=pa.getY(k),z=pa.getZ(k);
    const cx=Math.max(-h,Math.min(h,x)),cy=Math.max(-h,Math.min(h,y)),cz=Math.max(-h,Math.min(h,z));
    let nx=x-cx,ny=y-cy,nz=z-cz;const l=Math.hypot(nx,ny,nz);
    if(l<1e-9){nx=na.getX(k);ny=na.getY(k);nz=na.getZ(k)}else{nx/=l;ny/=l;nz/=l}
    pa.setXYZ(k,cx+nx*r,cy+ny*r,cz+nz*r);na.setXYZ(k,nx,ny,nz);
  }
  pa.needsUpdate=na.needsUpdate=true;return g;
}
function pipTex(v){
  return canvasTex(128,128,(g,w,h)=>{
    g.fillStyle='#fbf3e0';g.fillRect(0,0,w,h);
    const gr=g.createRadialGradient(w/2,h/2,w*.32,w/2,h/2,w*.74);gr.addColorStop(0,'rgba(120,90,50,0)');gr.addColorStop(1,'rgba(120,90,50,.2)');g.fillStyle=gr;g.fillRect(0,0,w,h);
    const P=[.26,.5,.74],R=v===1?w*.135:w*.088;
    for(const k of PIPS[v]){
      const x=P[(k-1)%3]*w,y=P[Math.floor((k-1)/3)]*h;
      g.fillStyle=v===1?'#cc3a2e':'#2a2118';g.beginPath();g.arc(x,y,R,0,7);g.fill();
    }
  });
}
function frameTex(color,fill){
  return canvasTex(128,128,(g,w,h)=>{
    g.clearRect(0,0,w,h);rr(g,8,8,w-16,h-16,22);
    if(fill){g.fillStyle=fill;g.fill()}
    g.lineWidth=7;g.strokeStyle=color;g.stroke();
  });
}
function d3Build(){
  if(D3.built||D3.fail)return D3.built;
  try{
    const root=new THREE.Group();root.visible=false;
    const ink=new THREE.MeshBasicMaterial({color:GFX_INK,side:THREE.BackSide});
    // 테이블 가운데 펠트 (공통 펠트의 점선 무늬를 덮음). 나무 벽은 없음
    const feltT=canvasTex(512,512,(g,w,h)=>{
      const gr=g.createRadialGradient(w/2,h/2,40,w/2,h/2,w/2);gr.addColorStop(0,'#3f9a69');gr.addColorStop(1,'#2d7350');g.fillStyle=gr;g.fillRect(0,0,w,h);
      for(let k=0;k<2600;k++){g.fillStyle=Math.random()<.5?'rgba(255,255,255,.035)':'rgba(0,0,0,.04)';g.fillRect(Math.random()*w,Math.random()*h,2,2)}   // 펠트 결
    });
    const felt=new THREE.Mesh(new THREE.CircleGeometry(FELT_R,96),toon({map:feltT,rim:0}));felt.rotation.x=-Math.PI/2;felt.position.y=FLOOR;felt.receiveShadow=true;root.add(felt);D3.felt=felt;   // 공통 테이블의 펠트(높이 .016)보다 살짝 위: 겹쳐서 깜빡이지 않게
    // 고정 칸 5개 (앞쪽)와 테이블과의 경계선, 고정 표시
    const slotM=new THREE.MeshBasicMaterial({map:frameTex('rgba(255,250,240,.6)'),transparent:true,depthWrite:false});
    const heldM=new THREE.MeshBasicMaterial({map:frameTex('#f2b632','rgba(242,182,50,.28)'),transparent:true,depthWrite:false});
    const pg=new THREE.PlaneGeometry(DS*1.42,DS*1.42);
    D3.held=[];D3.slots=[];
    {const lz=(FIELD_Z+SLOT_Z-DS*.71)/2,hw=Math.sqrt(FELT_R*FELT_R-lz*lz)-.15;
     const ln=new THREE.Mesh(new THREE.PlaneGeometry(hw*2,.035),new THREE.MeshBasicMaterial({color:0xfffaf0,transparent:true,opacity:.4,depthWrite:false}));
     ln.rotation.x=-Math.PI/2;ln.position.set(0,FLOOR+.004,lz);ln.renderOrder=1;root.add(ln);D3.line=ln}
    for(let i=0;i<5;i++){
      const sp=slotPos(i);
      const a=new THREE.Mesh(pg,slotM);a.rotation.x=-Math.PI/2;a.position.set(sp[0],FLOOR+.004,sp[2]);a.renderOrder=1;root.add(a);D3.slots.push(a);
      const b=new THREE.Mesh(pg,heldM);b.rotation.x=-Math.PI/2;b.position.set(sp[0],FLOOR+.007,sp[2]);b.renderOrder=2;b.visible=false;root.add(b);D3.held.push(b);
    }
    // 주사위: 모서리가 둥근 정육면체 + 외곽선. 면 순서 +x,-x,+y,-y,+z,-z = 3,4,1,6,2,5 (FACE_N과 같음)
    const dg=roundBox(DS,DRAD,8),mats=[3,4,1,6,2,5].map(v=>toon({map:pipTex(v),rim:.12}));
    D3.dice=[];
    for(let i=0;i<5;i++){
      const g=new THREE.Group(),m=new THREE.Mesh(dg,mats),o=new THREE.Mesh(dg,ink);
      o.scale.setScalar(1.075);m.castShadow=true;g.add(m,o);g.visible=false;root.add(g);
      D3.dice.push({g,val:1,where:'cup',slot:-1,fp:null,tw:null,pr:Q_ID,k:-1,p:slotPos(i),q:Q_ID,s:IN_S});
    }
    // 컵: 가죽 컵 (안쪽 벽까지 있는 회전체) + 차례인 사람 색 띠
    const V2=(x,y)=>new THREE.Vector2(x,y);
    const prof=[V2(0,0),V2(.47,0),V2(.5,.05),V2(.58,.97),V2(.62,1),V2(.6,1.03),V2(.54,1.02),V2(.46,.14),V2(0,.14)];
    const cup=new THREE.Group(),lm=toon({color:0x6e3b22,rim:.22});lm.side=THREE.DoubleSide;
    const body=new THREE.Mesh(new THREE.LatheGeometry(prof,48),lm);body.castShadow=true;
    const hullG=new THREE.LatheGeometry(prof.slice(0,6).map(v=>V2(v.x+.035,v.y-.02)),48);
    const hl=new THREE.Mesh(hullG,ink);
    D3.band=toon({color:0xc53026,rim:.2});
    const b1=new THREE.Mesh(new THREE.TorusGeometry(.57,.045,10,48),D3.band);b1.rotation.x=Math.PI/2;b1.position.y=.84;
    const b2=new THREE.Mesh(new THREE.TorusGeometry(.5,.035,10,48),toon({color:0xd9a441,rim:.2}));b2.rotation.x=Math.PI/2;b2.position.y=.13;
    cup.add(body,hl,b1,b2);cup.scale.setScalar(CUP_K);root.add(cup);
    D3.cup={g:cup,p:CUP_REST.slice(),q:Q_ID,tw:null};
    cup.position.set(...CUP_REST);
    D3.cam=new THREE.PerspectiveCamera(36,1,.1,100);
    T.scene.add(root);D3.root=root;D3.built=true;
  }catch(e){D3.fail=true;D3.built=false;try{console.warn('yahtzee 3D off',e)}catch(_){}}
  return D3.built;
}

/* --- 움직임 ---
   주사위 자리(where): cup(컵 안, 안 보임) · field(테이블 위, 떨어진 자리 그대로) · hold(앞쪽 고정 칸, 작은 눈부터) · fly(던지는 중) · tw(옮기는 중, tw.end가 갈 곳)
   테이블 위 주사위를 누르면 고정 칸으로, 고정 칸의 주사위를 누르면 테이블로 돌아감 (d3Arrange가 고정 표시에 맞춰 옮김) */
function dieTo(i,p1,q1,dur,o){
  const d=D3.dice[i],now=clock();
  d.tw={p0:d.p.slice(),p1:p1.slice(),q0:d.q.slice(),q1:q1.slice(),s0:d.s,s1:(o&&o.end)==='cup'?IN_S:1,t0:now+((o&&o.delay)||0),dur,arc:(o&&o.arc)||0,end:(o&&o.end)||'field',hide:!!(o&&o.hide)};
  d.where='tw';d.g.visible=!d.tw.hide;
  if(d.tw.end!=='hold')d.slot=-1;
  if(d.tw.end==='field')d.fp={p:p1.slice(),q:q1.slice()};   // 테이블 자리 기억 (고정했다 풀면 그 자리로)
}
const destOf=d=>d.where==='tw'?d.tw.end:d.where;
function cupTo(p1,q1,dur,delay){const c=D3.cup;c.tw={p0:c.p.slice(),p1:p1.slice(),q0:c.q.slice(),q1:q1.slice(),t0:clock()+(delay||0),dur}}
/* 고정 칸 순서: 고정한 주사위만, 눈이 작은 것부터 왼쪽 칸에 (같은 눈은 번호 순). 돌려주는 값: 주사위 번호 → 칸 번호 (고정 아니면 -1) */
function holdSlots(mask,vals){const idx=[0,1,2,3,4].filter(i=>mask[i]).sort((a,b)=>(vals[a]-vals[b])||(a-b)),so=[-1,-1,-1,-1,-1];idx.forEach((i,s)=>{so[i]=s});return so}
/* 바닥에 평평하게: 지금 위를 보는 면이 정확히 위로 (돌아간 방향은 그대로) */
function flatQ(q){const n=qrot(q,FACE_N[topFace(q)]);return qnorm(qmul(qFromUnit(n,[0,1,0]),q))}
/* 테이블 위 빈자리: 예전 자리가 비어 있으면 거기, 아니면 다른 주사위와 겹치지 않는 곳 */
function fieldSpot(i){
  const d=D3.dice[i],others=D3.dice.filter((o,j)=>j!==i&&destOf(o)==='field').map(o=>o.where==='tw'?o.tw.p1:o.p);
  const free=p=>others.every(o=>Math.hypot(o[0]-p[0],o[2]-p[2])>DS*1.4);
  if(d.fp&&free(d.fp.p))return d.fp;
  const yaw=qAxis([0,1,0],Math.random()*Math.PI*2);
  for(let k=0;k<80;k++){
    const a=Math.random()*Math.PI*2,r=Math.sqrt(Math.random())*2.1,p=[Math.cos(a)*r,FLOOR+DH,Math.min(FIELD_Z-DH-.12,Math.sin(a)*r-.4)];
    if(free(p))return {p,q:qmul(yaw,restQ(d.val))};
  }
  return {p:[(i-2)*.85,FLOOR+DH,-.7],q:restQ(d.val)};
}
/* 지금 고정으로 보여 줄 주사위: 내 차례는 내가 고른 것, 남의 차례는 방장 상태 (흔드는 중이면 그때 남긴 것) */
function holdMaskNow(){
  const Y=V&&V.y;if(!Y||!Y.r||V.st!=='play')return [false,false,false,false,false];
  if(mineNow())return yHold.map(Boolean);
  return [0,1,2,3,4].map(i=>!!(Y.sh?(Y.shk||[])[i]:(Y.hk||Y.hd)[i]));
}
/* 굴리지 않을 때: 고정 표시에 맞게 주사위를 고정 칸·테이블로 옮김 */
function d3Arrange(){
  const Y=V&&V.y;if(!Y||!Y.r||V.st!=='play'||A.st!=='idle'||A.tn!==Y.tn||A.rl!==Y.rl)return;
  const mask=holdMaskNow(),so=holdSlots(mask,D3.dice.map(d=>d.val));
  D3.dice.forEach((d,i)=>{
    const dest=destOf(d);
    if(mask[i]){
      if(dest==='hold'&&d.slot===so[i])return;
      const into=dest!=='hold';
      d.slot=so[i];dieTo(i,slotPos(so[i]),restQ(d.val,d.q),into?300:220,{arc:into?.45:.15,end:'hold'});
      if(into)tone(990,.04,{type:'triangle',vol:.05});
    }else if(dest!=='field'){
      const sp=fieldSpot(i);dieTo(i,sp.p,sp.q,320,{arc:.45,end:'field'});
      if(dest==='hold')tone(660,.04,{type:'triangle',vol:.045});
    }
  });
}
function d3NewTurn(Y){
  const joined=A.tn<0;   // 방금 화면을 켰음(관전 시작·재접속): 이미 굴린 주사위는 다음 프레임에 d3Arrange가 바로 놓음
  A.tn=Y.tn;A.rl=Y.rl;A.pend=null;A.st='idle';A.mine=false;A.rec=null;
  D3.cup.g.visible=true;cupTo(CUP_REST,Q_ID,380);
  if(Y.r&&joined){D3.dice.forEach((d,i)=>{d.val=Y.d[i]||1;d.fp=null;d.tw=null;d.where='cup';d.s=IN_S});return}
  // 테이블·고정 칸의 주사위는 컵으로 모음. 그사이 새 차례 사람이 벌써 굴렸으면(화면이 잠시 멈췄던 경우) 다음 프레임에 던지는 모습부터 보여 줌
  if(Y.r)A.rl=-1;
  D3.dice.forEach((d,i)=>{d.fp=null;if(d.where!=='cup'){const c=inCup(i,CUP_REST,Q_ID,0,0);dieTo(i,c.p,c.q,380,{arc:.7,end:'cup',delay:i*40})}});
}
/* 컵을 들어 흔들 준비: keep은 고정 칸에 두고, 나머지는 컵으로 */
function d3Lift(keep,mine){
  const now=clock();
  A.st='lift';A.t0=now;A.mine=mine;A.released=false;A.keep=keep.slice();A.rattleAt=0;
  cupTo(CUP_UP,Q_ID,280);
  const so=holdSlots(keep,D3.dice.map(d=>d.val));
  D3.dice.forEach((d,i)=>{
    if(keep[i]){
      if(destOf(d)==='hold'&&d.slot===so[i])return;
      d.slot=so[i];dieTo(i,slotPos(so[i]),restQ(d.val,d.q),260,{arc:.35,end:'hold'});
    }else if(d.where!=='cup'){const c=inCup(i,CUP_UP,Q_ID,0,0);dieTo(i,c.p,c.q,280,{arc:.6,end:'cup',delay:i*25})}
  });
  D3.dirty=true;
}
function d3StartPour(){
  A.st='pour';A.t0=clock();
  cupTo(CUP_UP,Q_POUR,240);
  hiss(.3,{freq:700,sweep:2600,q:.8,vol:.09});
  d3Sim(A.keep);
}
/* 던질 주사위(keep이 아닌 것)의 물리를 미리 끝까지 계산 (고정 칸은 테이블 앞쪽 경계 밖이라 부딪히지 않음) */
function d3Sim(keep){
  const thrown=[];
  for(let i=0;i<5;i++)if(!keep[i])thrown.push(i);
  A.thrown=thrown;A.simKeep=keep.slice();
  A.rec=thrown.length?simThrow(throwStarts(thrown.length,mouthOf(CUP_UP,Q_POUR),POUR_DIR,Math.random,POUR_GAP),[]):null;   // 하나씩 연달아 쏟아짐
}
function d3Launch(){
  const pd=A.pend;A.pend=null;
  if(pd.hd.some((h,i)=>!!h!==!!A.simKeep[i]))d3Sim(pd.hd.map(Boolean));   // 흔들 때와 실제로 남긴 주사위가 다르면 다시 계산
  D3.dice.forEach((d,i)=>{d.val=pd.d[i]||1});
  const so=holdSlots(pd.hd,pd.d);
  pd.hd.forEach((h,i)=>{const d=D3.dice[i];if(h&&destOf(d)!=='hold'){d.tw=null;d.where='hold';d.slot=so[i];d.p=slotPos(so[i]);d.q=restQ(d.val,d.q);d.g.visible=true}});
  if(!A.rec||reduced()){   // 움직임 줄이기: 컵에서 바로 테이블로 (d3Arrange가 놓음)
    A.thrown.forEach(i=>{const d=D3.dice[i];d.tw=null;d.where='cup';d.fp=null});
    cupTo(CUP_REST,Q_ID,450);d3Land();return;
  }
  const f0=A.rec.frames[0];
  A.thrown.forEach((i,k)=>{const d=D3.dice[i];d.pr=preRot(A.rec.fin[k],d.val);d.k=k;d.where='fly';d.tw=null;d.fp=null;d.slot=-1;d.g.visible=true;
    d.from=null});   // 자기 차례(k×POUR_GAP)가 오면 컵 안 자리에서 빠져나오며 원래 크기로
  A.st='fly';A.recT0=clock();A.hitK=0;A.cupBack=false;
}
function d3Abort(){
  A.st='idle';A.pend=null;A.mine=false;   // 컵에 든 주사위는 d3Arrange가 테이블로 돌려놓음
  cupTo(CUP_REST,Q_ID,400);
}
/* 떨어진 주사위는 거의 그 자리에 둠: 기대어 멈춘 것은 바닥에 평평하게, 서로 붙은 것은 누르기 쉽게 살짝 띄움 */
function d3Settle(){
  A.st='settle';
  const F=D3.dice.map((d,i)=>({i,move:A.thrown.includes(i),p:[d.p[0],d.p[2]]})).filter(o=>o.move||destOf(D3.dice[o.i])==='field');
  const GAP=DS*1.5,RMAX=EDGE_R-DH-.1,ZMAX=FIELD_Z-DH-.05;
  for(let it=0;it<12;it++){
    for(let a=0;a<F.length;a++)for(let b=a+1;b<F.length;b++){
      const A1=F[a],B1=F[b],dx=B1.p[0]-A1.p[0],dz=B1.p[1]-A1.p[1],dd=Math.hypot(dx,dz)||1e-6;
      if(dd>=GAP)continue;
      const push=(GAP-dd)/(A1.move&&B1.move?2:1),nx=dx/dd,nz=dz/dd;
      if(A1.move){A1.p[0]-=nx*push;A1.p[1]-=nz*push}
      if(B1.move){B1.p[0]+=nx*push;B1.p[1]+=nz*push}
    }
    for(const o of F){if(!o.move)continue;const r=Math.hypot(o.p[0],o.p[1]);if(r>RMAX){o.p[0]*=RMAX/r;o.p[1]*=RMAX/r}if(o.p[1]>ZMAX)o.p[1]=ZMAX}
  }
  for(const o of F)if(o.move){const d=D3.dice[o.i];dieTo(o.i,[o.p[0],FLOOR+DH,o.p[1]],flatQ(d.q),180,{end:'field'})}
}
function d3Land(){
  A.st='idle';A.mine=false;D3.dirty=true;
  drawAll();G.buttons();
}
/* 새 상태와 화면 비교: 매 프레임 부름 */
function d3Sync(){
  const Y=V&&V.y;if(!Y||V.st!=='play')return;
  if(Y.tn!==A.tn){d3NewTurn(Y);return}
  if(A.st==='idle'){
    if(Y.rl!==A.rl){
      A.rl=Y.rl;
      if(Y.r){A.pend={d:Y.d.slice(),hd:Y.hd.map(Boolean)};d3Lift(A.pend.hd,false)}
      return;
    }
    if(Y.sh&&!mineNow())d3Lift((Y.shk||[]).map(Boolean),false);   // 다른 사람이 컵을 흔드는 중
    return;
  }
  if(Y.rl!==A.rl&&Y.r&&(A.st==='lift'||A.st==='shake'||A.st==='pour'||A.st==='wait')){A.rl=Y.rl;A.pend={d:Y.d.slice(),hd:Y.hd.map(Boolean)}}
}
function rattle(amp){
  const c=900+Math.random()*900;
  tone(c,.02,{type:'square',vol:.022*amp});hiss(.03,{freq:2600+Math.random()*1500,q:2,vol:.05*amp});
}
function d3Step(now){
  if(A.st==='intro')introStep(now);else d3Sync();
  const c=D3.cup;
  // 컵
  if(c.tw){const k=ease((now-c.tw.t0)/c.tw.dur);c.p=c.tw.p0.map((x,j)=>x+(c.tw.p1[j]-x)*k);c.q=qslerp(c.tw.q0,c.tw.q1,k);if(k>=1)c.tw=null}
  let cp=c.p,cq=c.q;
  if(A.st==='shake'){
    const amp=Math.max(0,Math.min(1,(now-A.shakeT0)/260)),s=now/1000;
    cp=[c.p[0]+Math.sin(s*41)*.12*amp,c.p[1]+Math.abs(Math.sin(s*57))*.11*amp,c.p[2]+Math.cos(s*47)*.1*amp];
    cq=qmul(qAxis([1,0,0],Math.sin(s*50)*.2*amp),qAxis([0,0,1],Math.cos(s*43)*.18*amp));
    if(now>=A.rattleAt){A.rattleAt=now+50+Math.random()*60;rattle(.4+amp*.6)}
  }
  c.g.position.set(cp[0],cp[1],cp[2]);c.g.quaternion.set(cq[0],cq[1],cq[2],cq[3]);
  {const ie=now-IN0.t0,col=A.st==='intro'?(ie<IN0.r0?-1:introIdx(ie)%4):V&&V.ps&&V.st==='play'?V.t%4:-1;if(col!==D3.bandCol){D3.bandCol=col;D3.band.color.set(col>=0?PCOL[col]:'#8a5530')}}
  // 상태 진행
  if(A.st==='lift'&&now-A.t0>=280){A.st='shake';A.shakeT0=now}
  else if(A.st==='shake'){
    const long=now-A.shakeT0;
    if(A.mine?(A.released&&long>=340):(A.pend&&long>=300))d3StartPour();
  }else if(A.st==='pour'&&now-A.t0>=240){
    if(A.pend)d3Launch();else if(A.mine){A.st='wait';A.waitUntil=now+6000}else d3Abort();
  }else if(A.st==='wait'){
    if(A.pend)d3Launch();else if(now>A.waitUntil)d3Abort();
  }else if(A.st==='fly'){
    const R=A.rec,el=now-A.recT0,fi=Math.min(R.frames.length-1,Math.floor(el/1000*60)),f=R.frames[fi];
    const OUT=110;   // 컵 안에서 입구까지 0.11초, 빠져나간 뒤 0.5초 동안 원래 크기로
    A.thrown.forEach(i=>{const d=D3.dice[i],k=d.k,le=el-k*POUR_GAP*1000;
      if(le<0){const c=inCup(i,cp,cq,now,.35);d.p=c.p;d.q=c.q;d.s=IN_S;return}   // 아직 차례가 안 온 주사위는 기운 컵 안에서 달그락
      if(!d.from){d.from=d.p.slice();d.s0=d.s}
      const sp=[f[k*7],f[k*7+1],f[k*7+2]],out=Math.min(1,le/OUT),grow=ease((le-OUT)/500);
      d.p=out<1?d.from.map((x,j)=>x+(sp[j]-x)*out):sp;d.q=qmul([f[k*7+3],f[k*7+4],f[k*7+5],f[k*7+6]],d.pr);
      d.s=d.s0+(1-d.s0)*grow});
    while(A.hitK<R.hits.length&&R.hits[A.hitK][0]*1000<=el){const s=R.hits[A.hitK++][1];tone(420+Math.random()*420,.045,{type:'triangle',vol:Math.min(.16,.03+s*.018)});hiss(.03,{freq:2400,vol:Math.min(.1,s*.014)})}
    if(!A.cupBack&&el>(A.thrown.length-1)*POUR_GAP*1000+220){A.cupBack=true;cupTo(CUP_REST,Q_ID,520)}   // 다 쏟은 뒤 제자리로
    if(fi>=R.frames.length-1){A.st='rest';A.t0=now}
  }else if(A.st==='rest'&&now-A.t0>=120)d3Settle();
  // 주사위
  let moving=false;
  const amp=A.st==='shake'?Math.max(0,Math.min(1,(now-A.shakeT0)/260)):0;
  D3.dice.forEach((d,i)=>{
    if(d.where==='cup'){const c=inCup(i,cp,cq,now,amp);d.p=c.p;d.q=c.q;d.s=IN_S;d.g.visible=true}
    if(d.tw){
      const tw=d.tw,raw=(now-tw.t0)/tw.dur;
      if(raw>0){
        if(tw.hide){tw.hide=false;d.g.visible=true}   // 시작 연출: 떨어지기 시작할 때 보임
        const k=ease(raw);
        d.p=tw.p0.map((x,j)=>x+(tw.p1[j]-x)*k);d.p[1]+=Math.sin(Math.min(1,raw)*Math.PI)*tw.arc;
        d.q=qslerp(tw.q0,tw.q1,k);d.s=tw.s0+(tw.s1-tw.s0)*k;
        if(raw>=1){d.tw=null;d.p=tw.p1.slice();d.q=tw.q1.slice();d.s=tw.s1;d.where=tw.end;if(A.st==='intro')tone(700+i*60,.035,{type:'triangle',vol:.07})}
      }
      moving=true;
    }
    d.g.position.set(d.p[0],d.p[1],d.p[2]);d.g.quaternion.set(d.q[0],d.q[1],d.q[2],d.q[3]);d.g.scale.setScalar(d.s);
  });
  // 고정 칸의 노란 테두리: 주사위가 놓인 칸만
  for(let s=0;s<5;s++)D3.held[s].visible=D3.dice.some(d=>d.where==='hold'&&d.slot===s);
  if(A.st==='settle'&&!moving)d3Land();
  d3Arrange();
  return moving||A.st!=='idle'||!!c.tw||D3.dice.some(d=>d.tw);   // 컵 안 주사위는 컵이 움직일 때만 같이 움직임
}

/* --- 카메라: 점수 종이·버튼에 가리지 않는 빈 자리(.yz-left)에 펠트와 컵이 꽉 차게 --- */
function d3Layout(t){
  if(!D3.layDirty&&t-D3.layAt<700)return false;   // 크기가 바뀌었다는 알림이 없으면 가끔만 확인
  D3.layDirty=false;D3.layAt=t;
  const st=$('#stage'),W=st.clientWidth,Hh=st.clientHeight;if(!W||!Hh)return false;
  const sr=st.getBoundingClientRect(),lr=elLeft.getBoundingClientRect(),rb=elRoll.getBoundingClientRect(),hb=elHint.getBoundingClientRect();
  const key=[W,Hh,lr.left-sr.left,lr.top-sr.top,lr.width,lr.height,rb.height,hb.height].map(Math.round).join(',');
  if(key===D3.lay)return false;
  // 이미 보이던 카메라가 있으면 새 자리로 바로 튀지 않고 0.35초 동안 옮겨 감 (점수 종이 줄이 늘거나 화면을 돌렸을 때)
  if(D3.lay&&D3.cam.matrixWorld){D3.from={p:D3.cam.position.clone(),q:D3.cam.quaternion.clone(),m:D3.cam.projectionMatrix.clone()};D3.fromAt=t}
  D3.lay=key;D3.dirty=true;
  const wide=W>=820;
  let fx=lr.left-sr.left,fy=lr.top-sr.top,fw=lr.width,fh=lr.height;
  fh-=Math.max(rb.height,hb.height)+8;   // 아래 줄(안내 글 + 굴리기 버튼)은 빼고
  fw=Math.max(60,fw);fh=Math.max(60,fh);
  {const cw=Math.min(fw,620),ch=Math.min(fh,540);fx+=(fw-cw)/2;fy+=(fh-ch)/2;fw=cw;fh=ch}   // 큰 화면에서 주사위가 지나치게 커지지 않게
  const cam=D3.cam,phi=1.08,tgt=new THREE.Vector3(0,0,.15),pts=[],v=new THREE.Vector3();
  for(let k=0;k<24;k++){const a=k/24*Math.PI*2,r=2.85;   // 주사위가 거의 다 이 안에서 멈춤 (펠트 가장자리는 조금 잘려도 됨)
    pts.push([Math.cos(a)*r,0,Math.sin(a)*r],[Math.cos(a)*r,.3,Math.sin(a)*r])}
  pts.push([CUP_REST[0],CUP_H*.6,CUP_REST[2]]);   // 쉬고 있는 컵은 가운데만 들어오면 됨 (가장자리가 조금 잘려도 괜찮음)
  cam.fov=36;cam.aspect=W/Hh;
  let d=D3.d||14,ox=fx+fw/2-W/2,oy=fy+fh/2-Hh/2;
  for(let it=0;it<6;it++){
    cam.position.set(0,tgt.y+d*Math.sin(phi),tgt.z+d*Math.cos(phi));cam.lookAt(tgt);
    cam.setViewOffset(W,Hh,-ox,-oy,W,Hh);cam.updateProjectionMatrix();cam.updateMatrixWorld();
    let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;
    for(const p of pts){v.set(p[0],p[1],p[2]).project(cam);const x=(v.x+1)/2*W,y=(1-v.y)/2*Hh;x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)}
    const s=Math.max((x1-x0)/(fw*.97),(y1-y0)/(fh*.95));
    d*=s;ox+=(fx+fw/2)-(x0+x1)/2;oy+=(fy+fh/2)-(y0+y1)/2;
  }
  cam.position.set(0,tgt.y+d*Math.sin(phi),tgt.z+d*Math.cos(phi));cam.lookAt(tgt);
  cam.setViewOffset(W,Hh,-ox,-oy,W,Hh);cam.updateProjectionMatrix();cam.updateMatrixWorld();
  D3.d=d;D3.W=W;D3.H=Hh;
  return true;
}
/* 주사위마다 투명한 버튼(누르면 고정 칸으로, 다시 누르면 테이블로)을 겹쳐 둠: 키보드·화면 읽기 프로그램도 쓸 수 있게 */
function placeHoldBtns(){
  if(!elHold||elHold.hidden||!D3.W)return;
  const v=new THREE.Vector3(),cam=D3.cam,W=D3.W,Hh=D3.H;
  [...elHold.children].forEach((b,i)=>{
    const d=D3.dice[i],p=d.p;
    if(!d.g.visible||destOf(d)==='cup'){b.style.visibility='hidden';return}
    v.set(p[0],p[1],p[2]).project(cam);const x=(v.x+1)/2*W,y=(1-v.y)/2*Hh;
    v.set(p[0]+DH*1.25,p[1],p[2]).project(cam);const r=Math.max(20,Math.abs((v.x+1)/2*W-x));
    const k=`${Math.round(x-r)},${Math.round(y-r)},${Math.round(r*2)}`;
    if(b.dataset.k!==k){b.dataset.k=k;Object.assign(b.style,{left:(x-r)+'px',top:(y-r)+'px',width:r*2+'px',height:r*2+'px'})}
    if(b.style.visibility)b.style.visibility='';
  });
}
function drawHold(){
  if(!elHold)return;
  const on=D3.on&&mineNow()&&d3Ready()&&V.y.r&&V.y.l>0;
  if(elHold.hidden===on)elHold.hidden=!on;
  if(!on)return;
  [...elHold.children].forEach((b,i)=>{
    const h=!!yHold[i],lab=`${V.y.d[i]} 주사위${h?', 고정됨 (누르면 테이블로)':' (누르면 고정)'}`;
    if(b.getAttribute('aria-pressed')!==String(h))b.setAttribute('aria-pressed',h);
    if(b.getAttribute('aria-label')!==lab)b.setAttribute('aria-label',lab);
  });
}
function d3Render(t){
  if(!D3.on||!T.ok)return;
  if(d3Layout(t))D3.dirty=true;
  const anim=d3Step(t);
  const blend=D3.from&&t-D3.fromAt<350?ease((t-D3.fromAt)/350):1;if(blend>=1)D3.from=null;
  if(!anim&&!D3.dirty&&blend>=1&&t-D3.lastR<120)return;   // 움직이는 게 없으면 가끔만 그림 (배터리)
  D3.dirty=false;D3.lastR=t;
  const fog=T.scene.fog,fn=fog?fog.near:0,ff=fog?fog.far:0;
  if(fog){fog.near=D3.d+6;fog.far=D3.d+30}
  for(const m of [T.timerBg,T.timerArc,T.ring])if(m)m.visible=false;   // 공통 테이블의 자리별 시간 고리는 이 카메라에서 엉뚱한 곳에 보여서 숨김 (시간은 점수 종이 머리줄에 표시)
  let cam=D3.cam;
  // a(위치·방향·화면 범위)에서 야추 카메라로 k만큼 옮긴 카메라
  const mix=(pos,quat,proj,k)=>{
    const ic=D3.icam||(D3.icam=new THREE.PerspectiveCamera());
    ic.position.copy(pos).lerp(D3.cam.position,k);ic.quaternion.copy(quat).slerp(D3.cam.quaternion,k);
    const a=proj.elements,b=D3.cam.projectionMatrix.elements,m=ic.projectionMatrix.elements;
    for(let j=0;j<16;j++)m[j]=a[j]+(b[j]-a[j])*k;
    ic.projectionMatrixInverse.copy(ic.projectionMatrix).invert();ic.updateMatrixWorld();
    return ic;
  };
  {const k=IN0.on&&IN0.fromLobby?ease((t-IN0.t0)/INTRO.cam):1;
   if(k<1){   // 시작 연출: 로비 카메라(공통 T.cam)에서 야추 카메라로 위치·방향·화면 범위를 함께 옮김
     cam=mix(T.cam.position,T.cam.quaternion,T.cam.projectionMatrix,k);
     if(fog){fog.near=fn+(fog.near-fn)*k;fog.far=ff+(fog.far-ff)*k}
   }else if(blend<1)cam=mix(D3.from.p,D3.from.q,D3.from.m,blend);}
  T.r.render(T.scene,cam);
  if(fog){fog.near=fn;fog.far=ff}
  placeHoldBtns();
}
/* 굴리기 버튼: 누르는 동안 흔들고, 떼면 던짐 */
function d3Press(){
  if(!D3.on||!canRoll()||A.st!=='idle')return false;
  const Y=V.y,keep=Y.r?yHold.slice():[false,false,false,false,false];
  sendAct({t:'shake',keep});
  d3Lift(keep,true);
  yCat=null;elRoll.classList.add('down');drawAll();G.buttons();
  return true;
}
function d3Release(){
  elRoll&&elRoll.classList.remove('down');
  if(!A.mine||A.released||(A.st!=='lift'&&A.st!=='shake'))return;
  A.released=true;
  const Y=V.y;yLock={rl:Y.rl,tn:Y.tn,at:Date.now()};
  sendAct({t:'roll',keep:A.keep.slice()});
  drawAll();G.buttons();
}

/* ---------- 시작 연출 (게임이 시작되면 한 번: 방장이 그동안 제한 시간·봇을 멈춤, 길이 G.introMs) ----------
   0~1.3초  로비 카메라(테이블 앞에 앉은 눈) → 야추 카메라(내려다봄). 0.65초부터 점수 종이·버튼이 들어옴
   0.3~1.1초 펠트가 펼쳐지고, 0.85~1.4초 고정 칸이 왼쪽부터 하나씩
   1.3~1.75초 컵이 위에서 내려와 놓이고(그 전엔 숨김), 1.85~2.45초 주사위 5개가 하나씩 컵에 떨어짐
   2.45~3.35초 컵 띠 색(과 위쪽 차례 표시)이 참가자 색으로 돌다가 점점 느려져 첫 차례 사람에서 멈춤
   바로 시작(결과 화면에서): 카메라·펠트·고정 칸·컵은 그대로, 테이블과 고정 칸의 주사위만 컵으로 모으고 룰렛 (2.3초)
   늦게 들어오거나 다시 연결된 사람은 연출 없이 바로 (공통 dealCheck). WebGL이 없으면 위쪽 차례 표시의 룰렛만 */
const INTRO={cam:1300,ui:650,felt:[300,800],slot:[850,90,220],line:[800,450],cup:[1300,450],drop:[1850,120,330],roul:[2450,3350]};
G.introMs=again=>again?2300:3600;   // 바로 시작(again)은 테이블이 이미 차려져 있어서 짧게
const IN0={on:false,t0:0,total:3600,again:false,r0:INTRO.roul[0],r1:INTRO.roul[1],fromLobby:true,said:false,seq:null,tick:0,pop:0};
const AGAIN={gather:[0,60,420],roul:[950,1850]};   // 바로 시작: 지난 판 주사위를 컵으로 모으고 룰렛
const introOn=()=>IN0.on&&clock()<IN0.t0+IN0.total;
/* 룰렛: 지금 가리키는 자리 (끝나면 첫 차례 사람) */
function introIdx(e){
  const q=IN0.seq;if(!q)return V?V.t:0;
  if(e>=IN0.r1)return q.f;
  let c=0;while(c<q.times.length&&q.times[c]<=e)c++;
  return (q.start+c)%q.n;
}
G.intro=(t0,o)=>{
  if(!V||!V.y||!V.ps)return;
  const again=!!(o&&o.again);
  IN0.on=true;IN0.t0=t0;IN0.said=false;IN0.tick=0;IN0.pop=0;IN0.fromLobby=!D3.on;yMsgUntil=0;
  IN0.again=again;IN0.total=(o&&o.total)||G.introMs(again);
  [IN0.r0,IN0.r1]=again?AGAIN.roul:INTRO.roul;
  const n=Math.max(2,Math.min(V.ps.length,4)),f=V.t>=0?V.t:0,times=[];
  for(let t=IN0.r0,dt=55;t+dt<IN0.r1-40;dt*=1.17){t+=dt;times.push(t)}   // 처음엔 빠르게, 점점 느리게
  IN0.seq={times,n,f,start:((f-times.length)%n+n)%n};
  if(elYz&&IN0.fromLobby)elYz.classList.add('intro');
  $('#stage').classList.add('yz-intro');
  lastTurn='';lastBoard='';
  if(!(window.THREE&&T.ok&&!D3.fail&&(D3.built||d3Build())))return;
  A.st='intro';A.tn=-1;A.pend=null;A.mine=false;A.rec=null;
  const c=D3.cup,now=clock();
  if(again&&!IN0.fromLobby){   // 바로 시작: 펠트·고정 칸·컵은 그대로, 테이블과 고정 칸에 있던 주사위만 컵으로
    c.g.visible=true;c.tw=null;cupTo(CUP_REST,Q_ID,300);
    let k=0;
    D3.dice.forEach((d,i)=>{
      d.fp=null;d.slot=-1;
      if(d.where==='cup'||d.where==='none'&&!d.g.visible){d.where='cup';d.tw=null;return}
      const c2=inCup(i,CUP_REST,Q_ID,0,0);dieTo(i,c2.p,c2.q,AGAIN.gather[2],{arc:.7,end:'cup',delay:t0+AGAIN.gather[0]+(k++)*AGAIN.gather[1]-now});
    });
    D3.dirty=true;return;
  }
  c.p=[CUP_REST[0],CUP_REST[1]+2.6,CUP_REST[2]];c.q=qAxis([1,0,0],.35);c.tw=null;c.g.visible=false;IN0.thud=false;
  cupTo(CUP_REST,Q_ID,INTRO.cup[1],t0+INTRO.cup[0]-now);
  const top=[CUP_REST[0],CUP_REST[1]+CUP_H+2.4,CUP_REST[2]];
  D3.dice.forEach((d,i)=>{
    d.where='none';d.tw=null;d.fp=null;d.slot=-1;d.s=IN_S;d.g.visible=false;
    d.p=[top[0]+(i-2)*.12,top[1]+i*.1,top[2]];d.q=qnorm([Math.random()-.5,Math.random()-.5,Math.random()-.5,Math.random()-.5]);
    const c2=inCup(i,CUP_REST,Q_ID,0,0);
    dieTo(i,c2.p,c2.q,INTRO.drop[2],{end:'cup',delay:t0+INTRO.drop[0]+i*INTRO.drop[1]-now,hide:true});
  });
  D3.dirty=true;
};
/* 연출 중 3D: 펠트·고정 칸·경계선 크기, 소리, 끝나면 보통 상태로 */
function introStep(now){
  const e=now-IN0.t0,done=e>=IN0.total,set=IN0.again&&!IN0.fromLobby;   // set: 바로 시작이라 테이블은 이미 차려져 있음
  const k=done||set?1:ease((e-INTRO.felt[0])/INTRO.felt[1]),fs=.2+.8*k;
  D3.felt.scale.set(fs,fs,1);
  D3.line.scale.set(done||set?1:ease((e-INTRO.line[0])/INTRO.line[1]),1,1);
  D3.slots.forEach((m,s)=>{
    const x=(e-INTRO.slot[0]-s*INTRO.slot[1])/INTRO.slot[2];
    const b=done||set||x>=1?1:x<=0?0:1+2.2*Math.pow(x-1,3)+1.2*Math.pow(x-1,2);   // 살짝 넘쳤다가 제자리
    m.scale.setScalar(Math.max(.001,b));
    if(x>0&&IN0.pop<=s&&!done&&!set){IN0.pop=s+1;tone(1250+s*90,.04,{type:'triangle',vol:.05})}
  });
  // 컵: 내려오기 시작할 때 보이고, 닿을 때 툭
  D3.cup.g.visible=done||set||e>=INTRO.cup[0];
  if(!set&&!IN0.thud&&e>=INTRO.cup[0]+INTRO.cup[1]){IN0.thud=true;tone(150,.09,{type:'triangle',vol:.16});hiss(.06,{freq:900,vol:.08})}
  if(done){A.st='idle';A.tn=-1;D3.dirty=true}
}
/* 연출 중 화면 글자·버튼: 매 프레임 (G.live) */
function introTick(){
  if(!IN0.on)return;
  const e=clock()-IN0.t0;
  if(e>=INTRO.ui&&elYz.classList.contains('intro'))elYz.classList.remove('intro');
  if(e>=IN0.r0&&e<IN0.r1){const c=IN0.seq?IN0.seq.times.filter(x=>x<=e).length:0;if(c>IN0.tick){IN0.tick=c;sfx('tick')}}
  if(e>=IN0.r1&&!IN0.said){
    IN0.said=true;$('#stage').classList.remove('yz-intro');
    const p=V.ps[V.t];if(p)say(V.t===myIdx()?'내가 먼저 시작합니다.':`${p.n}부터 시작합니다.`);
    sfx('turn');
  }
  if(e>=IN0.total){IN0.on=false;lastTurn='';lastBoard='';G.buttons()}
  drawAll();
}

/* 화면에 그리는 글 */
function lastRec(){
  const L=V.y&&V.y.lm;
  return L&&V.ps[L.p]?` · 직전 ${V.ps[L.p].n} ${byId[L.c].name} ${L.pt}점`:'';
}
function hintText(me){
  if(Date.now()<yMsgUntil&&yMsg)return yMsg;
  if(!V||!V.y)return '';
  if(introOn()&&!IN0.said)return '게임을 준비하는 중…';
  const Y=V.y,tp=V.ps[V.t];
  if(V.st==='over')return '게임이 끝났습니다.';
  if(me<0)return tp?`${tp.n} 차례입니다. 관전 중입니다.${lastRec()}`:'';
  const p=V.ps[me];
  if(p.f)return p.sr?'항복했습니다. 남은 판을 지켜봅니다.':'';
  if(V.t!==me)return tp?`${tp.n} 차례입니다.${lastRec()}`:'';
  if(!myTurnNow())return '내 차례입니다.';
  if(shakingMine())return '손을 떼면 주사위를 던집니다.';
  {const left=(V.deadAt-clock())/1000;if(left<=10&&left>0)return `${Math.ceil(left)}초 남았습니다. 제한 시간이 지나면 알아서 기록합니다.`}
  if(!d3Ready())return '주사위가 굴러가는 중…';
  if(!Y.r)return D3.on?'굴리기 버튼을 꾹 누르면 컵을 흔들고, 손을 떼면 던집니다.':'굴리기를 눌러 주사위를 굴립니다.';
  const sc=scoreOf(me);
  if(yCat){const c=byId[yCat];return `${c.name}: ${c.rule} → ${calc(yCat,Y.d,jokerOf(sc,Y.d))}점. 한 번 더 누르거나 [기록하기]를 누르면 기록합니다.`}
  if(jokerOf(sc,Y.d))return '추가 야추입니다. 조커 규칙에 따라 기록할 수 있는 칸이 정해져 있습니다.';
  return Y.l>0?(D3.on?'남길 주사위를 누르면 고정 칸으로 갑니다. 다시 누르면 테이블로 돌아갑니다.':'남길 주사위를 눌러 고정하고 다시 굴리거나, 점수 종이에 기록하세요.'):'굴림을 모두 썼습니다. 기록할 칸을 골라 주세요.';
}
function turnHTML(){
  const Y=V.y;
  if(V.st==='over')return '<span class="yz-chip"><b>게임 끝</b></span>';
  let t=V.t;
  if(introOn()&&!IN0.said){   // 시작 연출: 첫 차례를 룰렛으로
    const e=clock()-IN0.t0;
    if(e<IN0.r0)return '<span class="yz-chip"><b>게임 준비 중</b></span>';
    t=introIdx(e);
  }
  const p=V.ps[t];if(!p)return '';
  const mine=t===myIdx();
  const pips=Array.from({length:3},(_,k)=>`<i class="pp${k<Y.l?' on':''}"></i>`).join('');
  return `<span class="yz-chip yz-who${mine?' me':''}" style="--pc:${PCOL[t%4]}"><i class="dot"></i><b>${mine?'내 차례':esc(p.n)+' 차례'}</b></span><span class="yz-chip">${Math.min(Y.dn[t]+1,Y.rd)}/${Y.rd}라운드</span><span class="yz-chip" role="img" aria-label="남은 굴림 ${Y.l}번"><span class="yz-pips">${pips}</span></span>`;
}
function diceHTML(){
  const Y=V.y,me=myIdx(),mineTurn=V.st==='play'&&V.t===me&&me>=0;
  const hd=mineTurn?yHold:(Y.hk||Y.hd),can=myTurnNow()&&Y.r&&Y.l>0,tum=Date.now()<yTumbleUntil;
  const order=Y.r?[0,1,2,3,4].sort((a,b)=>(Y.d[a]-Y.d[b])||(a-b)):[0,1,2,3,4];   // 3D와 같이 눈이 작은 것부터
  return order.map(i=>{
    const v=Y.d[i],held=!!(Y.r&&V.st==='play'&&hd[i]);
    const pips=Array.from({length:9},(_,k)=>`<i${PIPS[v].indexOf(k+1)>=0?' class="on"':''}></i>`).join('');
    return `<div class="slot"><button type="button" class="die ${v?'v'+v:'blank'}${held?' held':''}${tum&&Y.r&&!held?' tumble':''}${can?'':' ro'}" data-i="${i}" aria-pressed="${held}" aria-label="${v?v+' 주사위':'빈 주사위'}${held?', 고정됨':''}">${pips}</button><span class="tag${held?'':' off'}">고정</span></div>`;
  }).join('');
}
function rollHTML(){
  const Y=V.y,mine=myTurnNow();
  const shaking=shakingMine();
  const main=shaking?'떼면 던지기':Y.r&&mine?'다시 굴리기':'굴리기';
  const sub=V.st!=='play'?'':shaking?'흔드는 중':mine?(Y.l>0?`남은 ${Y.l}번`:'굴림 끝'):'상대 차례';
  return `<b>${main}</b><small>${sub}</small>`;
}
/* 점수판: 칸 × 사람. 내 칸은 지금 기록하면 몇 점인지 보여 주고 눌러서 고름 */
function boardHTML(){
  const Y=V.y,me=myIdx(),n=Y.cnt,ids=Array.from({length:n},(_,i)=>i);
  const SC=ids.map(scoreOf),T=ids.map(i=>totals(SC[i],Y.yb[i]));
  const mine=me>=0&&me<n&&myTurnNow()&&Y.r&&!V.ps[me].f&&d3Ready();
  const ok=mine?allowed(SC[me],Y.d):[],joker=mine&&jokerOf(SC[me],Y.d);
  const head=`<thead><tr><th class="lb" scope="col">점수판</th>${ids.map(i=>{
    const p=V.ps[i],on=V.st==='play'&&V.t===i&&!p.f&&!(introOn()&&!IN0.said);
    return `<th class="pc${on?' on':''}${i===me?' me':''}${p.f&&p.sr?' out':''}" scope="col" style="--pc:${PCOL[i%4]}"><b>${esc(p.n)}${i===me?' (나)':''}</b><span class="tot">${p.f&&p.sr?'항복':T[i].total}</span>${on?'<span class="tb"><i></i></span>':''}</th>`;
  }).join('')}</tr></thead>`;
  const cell=(i,c)=>{
    const v=SC[i][c.id],m=i===me?' me':'';
    if(v!==null)return `<td class="c f${m}${Y.lm&&Y.lm.p===i&&Y.lm.c===c.id&&Date.now()<yInk.until?' ink':''}">${v}</td>`;
    if(i===me&&ok.indexOf(c.id)>=0){
      const pts=calc(c.id,Y.d,joker);
      return `<td class="c o me${pts?'':' z'}${yCat===c.id?' sel':''}" data-c="${c.id}" role="button" tabindex="0" aria-label="${c.name} ${pts}점으로 기록">${pts}</td>`;
    }
    return `<td class="c e${m}"></td>`;
  };
  const row=c=>`<tr class="${c.up?'up':'lo'}"><th class="lb" scope="row" title="${c.rule}">${c.short?`<span class="ln">${c.name}</span><span class="sn">${c.short}</span>`:c.name}</th>${ids.map(i=>cell(i,c)).join('')}</tr>`;
  const stat=(cls,label,f)=>`<tr class="${cls}"><th class="lb" scope="row">${label}</th>${ids.map(i=>`<td class="c${i===me?' me':''}">${f(i)}</td>`).join('')}</tr>`;
  const up=CATS.filter(c=>c.up).map(row).join(''),low=CATS.filter(c=>!c.up).map(row).join('');
  return head+'<tbody>'+up
    +stat('sum','<span title="윗칸 합이 63점 이상이면 +35점">윗칸 보너스</span>',i=>T[i].bonus?`<b>+${T[i].bonus}</b>`:`${T[i].upper}<small>/63</small>`)
    +low
    +(T.some(x=>x.yb)?stat('sum','야추 보너스',i=>T[i].yb?`+${T[i].yb}`:'–'):'')
    +stat('tot','총점',i=>`${T[i].total}`)
    +'</tbody>';
}
function drawHint(){
  if(!elHint)return;
  const h=hintText(myIdx());
  if(h!==lastHint){elHint.textContent=h;lastHint=h}
}
function drawAll(){
  if(!elYz||!V||!V.y)return;
  const t=turnHTML();if(t!==lastTurn){elTurn.innerHTML=t;lastTurn=t}
  if(!D3.on){const d=diceHTML();if(d!==lastDice){elDice.innerHTML=d;lastDice=d}}
  drawHold();
  const r=rollHTML();if(r!==lastRoll){elRoll.innerHTML=r;lastRoll=r}
  elRoll.disabled=!rollOn();
  const b=boardHTML();if(b!==lastBoard){elTbl.innerHTML=b;lastBoard=b}
  drawHint();
}
/* 새 상태를 받았을 때 (그리기 전) */
G.preView=()=>{
  if(!V.y)return;
  const me=myIdx(),Y=V.y;
  if(!PV||!PV.y||PV.y.tn!==Y.tn||PV.st!==V.st){
    // 차례가 바뀌었거나 새 판이 시작됨: 고른 칸과 고정 표시를 처음으로
    yCat=null;yLock={rl:-1,tn:-1,at:0};
    yHold=me>=0&&V.t===me&&Y.r?(Y.hk||Y.hd).map(Boolean):[false,false,false,false,false];
  }else if(PV.y.rl!==Y.rl){
    yCat=null;
    if(me>=0&&V.t===me)yHold=Y.hd.slice();
    if(V.st==='play')yTumbleUntil=Date.now()+520;
  }
  if(yCat&&me>=0&&allowed(scoreOf(me),Y.d).indexOf(yCat)<0)yCat=null;
  // 방금 기록한 칸은 잠깐 손글씨로 쓰는 효과
  const lk=Y.lm?`${Y.tn}:${Y.lm.p}:${Y.lm.c}`:'';
  if(lk!==yInk.k){yInk={k:lk,until:PV&&PV.y&&lk?Date.now()+1200:0};if(yInk.until)setTimeout(()=>{if(elYz&&!elYz.hidden)drawAll()},1250)}
};
G.postView=()=>{};
G.overExtra=()=>{
  if(!V||!V.y)return '';
  const Y=V.y,list=Array.from({length:Y.cnt},(_,i)=>i).sort((a,b)=>(V.ps[a].f-V.ps[b].f)||(a-b));
  const li=list.map(i=>{
    const T=totals(scoreOf(i),Y.yb[i]),p=V.ps[i];
    return `<li${i===myIdx()?' class="me"':''}><span class="n">${esc(p.n)}</span><b>${p.sr?'항복':T.total+'점'}</b><small>윗칸 ${T.upper}${T.bonus?` (+${T.bonus})`:''} · 아랫칸 ${T.lower}${T.yb?` · 야추 보너스 ${T.yb}`:''}</small></li>`;
  }).join('');
  return `<div class="yz-res"><div class="yz-res-h"><b>최종 점수</b></div><ul>${li}</ul></div>`;
};
G.logCue=()=>false;
G.cues=(v,pv)=>{
  if(!v.y||!pv.y)return;
  if(v.y.tn===pv.y.tn&&v.y.rl>pv.y.rl){if(!D3.on)sfx('pick')}   // 3D는 컵·주사위 소리를 따로 냄
  else if(v.y.lm&&(!pv.y.lm||v.y.lm.p!==pv.y.lm.p||v.y.dn[v.y.lm.p]!==pv.y.dn[v.y.lm.p]))sfx('play',1);
};
G.hud=inGame=>{
  if(!elYz)return;
  const on=!!(inGame&&V&&V.y);
  elYz.hidden=!on;
  const use=!!(on&&window.THREE&&T.ok&&!D3.fail&&(D3.built||d3Build()));
  if(use!==D3.on){
    D3.on=use;D3.lay='';D3.layDirty=true;D3.dirty=true;A.tn=-1;
    elYz.classList.toggle('yz3',use);$('#stage').classList.toggle('yz3d',use);
    if(D3.root)D3.root.visible=use;
    lastDice='';lastRoll='';
  }
  $('#stage').classList.toggle('yz-over',!!(on&&V.st==='over'));   // 결과 창이 길어도 아래 버튼이 내 정보 칸에 가리지 않게
  $('#stage').classList.toggle('yz2d',on&&!use);
  if(!on){lastTurn='';lastDice='';lastRoll='';lastBoard='';lastHint='';return}
  drawAll();
};
G.handMarks=()=>{};
G.me=(i,h)=>{
  $('#numpick').hidden=true;
  const p=V.ps[i];if(!p||!V.y)return;
  if(p.f){if(!p.sr)$('#meSub').innerHTML=`<b>${+p.f}위</b>입니다.`;return}
  const T=totals(scoreOf(i),V.y.yb[i]);
  $('#meSub').innerHTML=`총점 <b>${T.total}</b>점 · <b>${V.y.dn[i]}</b>/${V.y.rd}칸`;
};
G.specNote='관전 중입니다. 모든 주사위와 점수가 보입니다.';
G.no3D=true;   // 공통 테이블 카메라로는 그리지 않음 (2D 화면이면 그리기를 쉬어서 배터리를 아낌)
G.render3D=(t)=>{if(D3.on)d3Render(t);else if(T.ok)T.r.render(T.scene,T.cam)};   // 게임 중(3D)은 트레이·컵을 자기 카메라로, 대기실은 다른 게임처럼 공통 테이블
G.buttons=()=>{
  const play=$('#btnPlay'),can=canScore();
  $('#btnPass').hidden=true;$('#btnGura').hidden=true;
  play.disabled=!can;play.classList.toggle('ready',can);
  if($('#playMain').textContent!=='기록하기')$('#playMain').textContent='기록하기';
  let sub=keyLabel(KEYS.play);
  if(yCat&&V&&V.y&&myIdx()>=0)sub=`${byId[yCat].name} ${calc(yCat,V.y.d,jokerOf(scoreOf(myIdx()),V.y.d))}점`;
  if($('#playSub').textContent!==sub)$('#playSub').textContent=sub;
  if(elRoll)elRoll.disabled=!rollOn();
};
G.live=()=>{
  if(!elYz||elYz.hidden||!V||!V.y||V.st!=='play')return;
  introTick();
  const bar=elTbl&&elTbl.querySelector('th.pc.on .tb i');
  if(bar){const left=Math.max(0,(V.deadAt-clock())/1000);bar.style.width=Math.min(100,left/(V.cfg.turn||45)*100)+'%'}
  if(V.t===myIdx())drawHint();   // 남은 시간 안내
};
G.play=record;
G.pass=()=>{};
G.keyPhase=st=>st==='play';
G.onKey=(act,e)=>{
  if(act==='yroll'){if(!e.repeat){if(D3.on)d3Press();else rollNow()}return true}
  return false;
};
/* 공통 코드가 다른 사람 자리에 카드 더미를 놓는데(손패 표시 1장), 야추에는 카드가 없으니 숨김 */
G.field3D=()=>{if(T.stacks)for(const arr of T.stacks.values())arr.forEach(c=>{c.visible=false})};
/* 이 게임으로 바뀔 때 / 다른 게임으로 바뀔 때 */
G.enter=()=>{
  $('#stage').classList.add('yz');
  $('#btnPass').hidden=true;$('#btnGura').hidden=true;$('#numpick').hidden=true;
  yCat=null;
};
G.leave=()=>{
  $('#stage').classList.remove('yz','yz-over','yz3d','yz2d','yz-intro');IN0.on=false;if(elYz)elYz.classList.remove('intro');
  if(T.stacks)for(const arr of T.stacks.values())arr.forEach(c=>{c.visible=true});
  if(D3.root)D3.root.visible=false;
  D3.on=false;A.tn=-1;A.st='idle';if(elYz)elYz.classList.remove('yz3');
  $('#btnPass').hidden=false;
  if(elYz){elYz.hidden=true;lastTurn='';lastDice='';lastRoll='';lastBoard='';lastHint=''}
};
/* 처음 한 번: 주사위와 점수판 화면 만들기 */
G.init=()=>{
  const css=document.createElement('style');
  css.textContent=`
.stage.yz{background:radial-gradient(ellipse at 50% 30%,#4c9170 0%,var(--felt) 58%,var(--felt-dark) 100%)}
.stage.yz.yz2d #cv,.stage.yz #dim{visibility:hidden}   /* 3D 캔버스는 WebGL 없이 2D로 하는 게임 중에만 숨김 (대기실은 다른 게임처럼 테이블이 보임) */
.stage.yz .labels{visibility:hidden}
.stage.yz .nogl{display:none}
.stage.yz.yz-over .myplate,.stage.yz.yz-over .actions{display:none}
.specbar:not([hidden])~#yz .yz-top{margin-top:30px}
.stage.yz .actions{left:auto}
.stage.yz .myplate{max-width:calc(100% - 150px)}
#yz{position:absolute;inset:0;z-index:0;display:flex;flex-direction:column;gap:6px;padding:8px 10px 82px;pointer-events:none;min-height:0}
#yz[hidden]{display:none}
#yz .yz-top{height:34px;flex:none;display:flex;flex-wrap:wrap;align-items:center;align-content:flex-start;gap:6px;align-self:flex-start;max-width:calc(100% - 188px)}   /* 높이 고정: 차례 표시가 길어져 두 줄이 돼도 아래 테이블 자리(카메라)가 바뀌지 않게 */
#yz .yz-chip{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:12px;background:rgba(255,250,240,.92);border:1.5px solid var(--line-strong);font-size:13px;line-height:1.15;white-space:nowrap}
#yz .yz-who .dot{width:12px;height:12px;border-radius:50%;background:var(--pc);box-shadow:0 0 0 2px #fffaf0,0 0 0 3px var(--pc);flex:none}
#yz .yz-who.me{border-color:var(--mustard);box-shadow:0 0 0 2px var(--mustard)}
#yz .yz-who b{font-weight:600}
#yz .yz-pips{display:inline-flex;gap:4px}
#yz .yz-pips .pp{width:10px;height:10px;border-radius:50%;border:2px solid var(--line-strong);background:transparent}
#yz .yz-pips .pp.on{background:var(--mustard);border-color:var(--mustard-edge)}
#yz .yz-main{flex:1;min-height:0;display:flex;flex-direction:column;gap:8px}
#yz .yz-left{display:flex;flex-direction:column;gap:6px;flex:none}
#yz .yz-row{display:flex;align-items:stretch;gap:8px}
#yz .yz-dice{flex:1;min-width:0;display:flex;justify-content:center;gap:5px;padding:8px 8px 4px;border-radius:var(--r-md);background:rgba(20,50,35,.35);border:1.5px solid rgba(255,250,240,.18);pointer-events:auto}
#yz .slot{flex:1;min-width:0;max-width:66px;display:flex;flex-direction:column;align-items:center;gap:3px}
#yz .die{position:relative;width:100%;aspect-ratio:1;border:0;border-radius:17%;padding:13%;display:grid;grid-template:repeat(3,1fr)/repeat(3,1fr);background:linear-gradient(145deg,#fffdf6,#eadfc4);box-shadow:0 3px 0 #bfb292,0 7px 12px rgba(0,0,0,.3);cursor:pointer;transition:transform .12s ease,box-shadow .12s ease;touch-action:manipulation}
#yz .die i{place-self:center;width:84%;aspect-ratio:1;border-radius:50%;background:transparent}
#yz .die i.on{background:#2a2118}
#yz .die.v1 i.on{background:var(--gura);transform:scale(1.4)}
#yz .die.blank{background:transparent;box-shadow:none;border:2px dashed rgba(255,250,240,.4)}
#yz .die.ro{cursor:default}
#yz .die.held{transform:translateY(-5px);box-shadow:0 0 0 3px var(--mustard),0 9px 14px rgba(0,0,0,.35)}
#yz .die.tumble{animation:yzTumble .5s ease-out}
@keyframes yzTumble{0%{transform:rotate(-200deg) scale(.7) translateY(-10px);opacity:.3}60%{transform:rotate(14deg) scale(1.08)}100%{transform:none;opacity:1}}
#yz .tag{font-size:10.5px;font-weight:700;letter-spacing:.06em;color:var(--mustard);height:13px;line-height:13px}
#yz .tag.off{visibility:hidden}
#yz .yz-roll{flex:none;width:76px;border:2px solid var(--gura-edge);border-radius:14px;background:var(--gura);color:var(--gura-ink);box-shadow:0 4px 0 var(--gura-edge);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-family:var(--f-display);font-size:18px;line-height:1.1;padding:4px;word-break:keep-all;text-align:center;pointer-events:auto;cursor:pointer;touch-action:manipulation}
#yz .yz-roll b{font-weight:400}
#yz .yz-roll small{font-family:var(--f-body);font-size:11px;font-weight:600;opacity:.85;min-height:13px}
#yz .yz-roll:active:not(:disabled){transform:translateY(4px);box-shadow:none}
#yz .yz-roll:disabled{opacity:.45;box-shadow:0 2px 0 var(--gura-edge);cursor:not-allowed}
#yz .yz-hint{font-size:13px;line-height:1.35;color:#fffaf0;text-shadow:0 1px 2px rgba(0,0,0,.5);text-align:center;min-height:35px;padding:0 4px;text-wrap:pretty}
#yz .yz-card{flex:1;min-height:0;overflow:auto;-webkit-overflow-scrolling:touch;border-radius:var(--r-md);background:var(--paper);border:1.5px solid var(--line-strong);border-top:7px solid #a0653a;box-shadow:var(--sh-panel);pointer-events:auto}
#yz .yz-tbl{width:100%;border-collapse:separate;border-spacing:0;table-layout:fixed;font-size:12.5px;color:var(--ink)}
#yz .yz-tbl th.lb{width:104px;text-align:left;font-weight:500;padding:3px 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:var(--paper)}
#yz .yz-tbl th.lb small{font-size:10px;color:var(--muted)}
#yz .yz-tbl .sn{display:none}
@media (max-width:819px){#yz .yz-tbl .ln{display:none}#yz .yz-tbl .sn{display:inline}}
#yz .yz-tbl td.c{text-align:center;font-family:var(--f-num);font-size:13px;padding:3px 2px;height:26px;border-left:1px solid var(--line);border-top:1px solid var(--line)}
#yz .yz-tbl th.lb{border-top:1px solid var(--line)}
#yz .yz-tbl thead th{position:sticky;top:0;z-index:2;background:var(--well);border-top:0;border-bottom:1.5px solid var(--line-strong)}
#yz .yz-tbl thead th.pc{position:sticky;padding:4px 3px 6px;font-weight:500;text-align:center;overflow:hidden}
#yz .yz-tbl thead th.pc b{display:block;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border-bottom:3px solid var(--pc);padding-bottom:2px}
#yz .yz-tbl thead th.pc .tot{display:block;font-family:var(--f-num);font-size:12px;color:var(--muted);margin-top:2px}
#yz .yz-tbl thead th.pc.on{background:#fff0c8}
#yz .yz-tbl thead th.pc.out{opacity:.55}
#yz .yz-tbl thead th .tb{position:absolute;left:0;right:0;bottom:0;height:3px;background:rgba(0,0,0,.08)}
#yz .yz-tbl thead th .tb i{display:block;height:100%;width:100%;background:var(--pc)}
#yz .yz-tbl td.c.me{background:#fff6de}
#yz .yz-tbl td.c.f{font-family:var(--f-display);font-size:15px;font-weight:400;color:#24427e}   /* 펜으로 쓴 점수 */
#yz .yz-tbl td.c.ink{animation:yzInk .75s ease-out}
@keyframes yzInk{0%{clip-path:inset(0 100% 0 0);background-color:#fff0bf}55%{clip-path:inset(0 0 0 0)}100%{clip-path:inset(0 0 0 0)}}
#yz .yz-tbl td.c.o{color:var(--gura);font-weight:700;cursor:pointer;background:#fde9b5;touch-action:manipulation}
#yz .yz-tbl td.c.o.z{color:var(--muted);font-weight:500}
#yz .yz-tbl td.c.o.sel{background:var(--mustard);color:var(--ink);outline:2px solid var(--mustard-edge);outline-offset:-2px}
#yz .yz-tbl td.c.o:focus-visible{outline:2px solid var(--focus);outline-offset:-2px}
#yz .yz-tbl tr.sum th.lb,#yz .yz-tbl tr.sum td.c{background:var(--well);font-weight:600}
#yz .yz-tbl tr.tot th.lb,#yz .yz-tbl tr.tot td.c{background:var(--well);font-family:var(--f-display);font-size:16px;font-weight:400;height:32px}
#yz .yz-tbl tr.tot td.c{font-family:var(--f-num);font-weight:700}
@media (min-width:820px){
  #yz .yz-main{flex-direction:row;align-items:stretch;gap:14px}
  #yz .yz-left{width:min(330px,38%);justify-content:flex-start;gap:10px}
  #yz .yz-row{flex-direction:column}
  #yz .slot{max-width:none}
  #yz .yz-dice{padding:12px 10px 6px;gap:8px}
  #yz .yz-roll{width:auto;height:58px;flex-direction:row;gap:10px;font-size:21px}
  #yz .yz-hint{font-size:14px;text-align:left;padding:0 2px}
  #yz .yz-tbl th.lb{width:132px}
  #yz .yz-tbl{font-size:13.5px}
  /* 가로 화면: 점수 종이 높이를 줄들이 나눠 써서 아래가 비지 않게 (아주 큰 화면은 종이 높이에 상한을 두고 가운데) */
  #yz .yz-card{align-self:center;height:100%;max-height:820px}
  #yz .yz-tbl{height:100%;font-size:14.5px}
  #yz .yz-tbl th.lb{font-size:14px;padding:2px 12px}
  #yz .yz-tbl td.c{font-size:15px;height:auto}
  #yz .yz-tbl td.c.f{font-size:18px}
  #yz .yz-tbl thead th.pc{height:56px}
  #yz .yz-tbl thead th.pc b{font-size:15px}
  #yz .yz-tbl thead th.pc .tot{font-size:13px}
  #yz .yz-tbl tr.tot th.lb,#yz .yz-tbl tr.tot td.c{font-size:19px}
}
.yz-res{margin:4px 0 2px;text-align:left}
.yz-res-h{margin-bottom:6px}
.yz-res ul{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.yz-res li{display:grid;grid-template-columns:1fr auto;gap:0 10px;align-items:baseline;padding:8px 12px;border-radius:var(--r-sm);background:var(--well)}
.yz-res li.me{box-shadow:inset 0 0 0 2px var(--mustard)}
.yz-res li .n{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.yz-res li b{font-family:var(--f-num)}
.yz-res li small{grid-column:1/-1;font-size:12px;color:var(--muted)}
@media (max-width:520px){#yz .yz-chip{font-size:12px;padding:3px 8px}#yz{padding-bottom:76px}#yz .yz-top{height:54px}}   /* 좁은 화면은 늘 두 줄 자리 */
@media (prefers-reduced-motion:reduce){#yz .die.tumble,#yz .yz-tbl td.c.ink{animation:none}}
/* 3D 화면: 위(가로 화면은 왼쪽)는 비워서 테이블이 보이게, 점수 종이는 아래(오른쪽) */
#yz.yz3 .yz-main{gap:8px}
/* 시작 연출: 점수 종이는 아래(가로 화면은 오른쪽)에서 들어오고, 버튼 줄·내 정보는 첫 차례가 정해진 뒤에 보임 */
#yz .yz-card{transition:transform .6s cubic-bezier(.2,.8,.2,1)}
#yz.intro .yz-card{transform:translateY(calc(100% + 140px));transition:none}
#yz .yz-row,#yz .yz-hint{transition:opacity .35s}
#yz.intro .yz-row,#yz.intro .yz-hint{opacity:0}
.stage.yz-intro .actions,.stage.yz-intro .myplate,.stage.yz-intro #yz .yz-row{opacity:0;pointer-events:none}
.stage.yz .actions,.stage.yz .myplate{transition:opacity .35s}
#yz.yz3 .yz-left{flex:1 1 0;min-height:250px;display:grid;grid-template:"t t" 1fr "h r" auto/1fr auto;gap:0 10px;align-items:center}
#yz.yz3 .yz-dice{display:none}
#yz.yz3 .yz-row{grid-area:r}
#yz.yz3 .yz-hint{grid-area:h;height:56px;min-height:0;display:flex;align-items:center;text-align:left;padding:0 2px;overflow:hidden}   /* 줄 수가 바뀌어도 테이블 크기가 흔들리지 않게 */
#yz.yz3 .yz-roll{width:auto;min-width:112px;height:56px;padding:4px 14px;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
#yz.yz3 .yz-roll.down{transform:translateY(4px) scale(.97);box-shadow:0 0 0 3px var(--mustard)}
#yz.yz3 .yz-card{flex:0 1 auto}
#yz .yz-hold{position:absolute;inset:0;pointer-events:none}
#yz .yz-hold button{position:absolute;pointer-events:auto;background:transparent;border:0;border-radius:22%;padding:0;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
#yz .yz-hold button:focus-visible{outline:3px solid var(--focus);outline-offset:1px}
#yz .yz-hold button::after{content:'고정';position:absolute;left:50%;top:100%;transform:translate(-50%,1px);font-size:11px;font-weight:700;letter-spacing:.06em;color:#ffe08a;text-shadow:0 1px 2px rgba(0,0,0,.7);visibility:hidden;white-space:nowrap}
#yz .yz-hold button[aria-pressed="true"]::after{visibility:visible}
@media (max-width:819px){
  #yz.yz3 .yz-tbl td.c{height:21px;padding:1px 2px;font-size:12.5px}
  #yz.yz3 .yz-tbl td.c.f{font-size:14px}
  #yz.yz3 .yz-tbl th.lb{padding:1px 8px;font-size:12px}
  #yz.yz3 .yz-tbl thead th.pc{padding:3px 3px 4px}
  #yz.yz3 .yz-tbl thead th.pc .tot{margin-top:0;font-size:11px}
  #yz.yz3 .yz-tbl tr.tot td.c,#yz.yz3 .yz-tbl tr.tot th.lb{height:26px;font-size:15px}
}
@media (min-width:820px){
  #yz.intro .yz-card{transform:translateX(calc(100% + 40px))}
  #yz.yz3 .yz-left{width:auto;flex:1 1 0}
  #yz.yz3 .yz-card{flex:0 0 auto;width:min(44%,540px)}
  #yz.yz3 .yz-roll{min-width:180px;height:60px;flex-direction:row;gap:10px}
  #yz.yz3 .yz-hint{font-size:14px}
}
`;
  document.head.appendChild(css);
  elYz=document.createElement('div');elYz.id='yz';elYz.hidden=true;
  elYz.innerHTML=`<div class="yz-top"></div><div class="yz-main"><div class="yz-left"><div class="yz-row"><div class="yz-dice" role="group" aria-label="주사위"></div><button type="button" class="yz-roll" disabled></button></div><div class="yz-hint" aria-live="polite"></div></div><div class="yz-card"><table class="yz-tbl" aria-label="점수판"></table></div></div><div class="yz-hold" hidden>${[0,1,2,3,4].map(i=>`<button type="button" data-i="${i}" aria-pressed="false"></button>`).join('')}</div>`;
  $('#stage').insertBefore(elYz,$('#fx'));
  elTurn=elYz.querySelector('.yz-top');elDice=elYz.querySelector('.yz-dice');elRoll=elYz.querySelector('.yz-roll');
  elHint=elYz.querySelector('.yz-hint');elTbl=elYz.querySelector('.yz-tbl');elLeft=elYz.querySelector('.yz-left');elHold=elYz.querySelector('.yz-hold');
  elDice.addEventListener('click',e=>{const b=e.target.closest('.die');if(b)toggleHold(+b.dataset.i)});
  elHold.addEventListener('click',e=>{const b=e.target.closest('button');if(b)toggleHold(+b.dataset.i)});
  // 굴리기: 2D는 누르면 바로, 3D는 누르는 동안 흔들고 떼면 던짐 (키보드 Enter·Space는 잠깐 흔든 뒤 던짐)
  elRoll.addEventListener('click',e=>{
    if(!D3.on){rollNow();return}
    if(e.detail===0&&d3Press())setTimeout(d3Release,600);
  });
  elRoll.addEventListener('pointerdown',e=>{
    if(!D3.on||e.button>0)return;
    e.preventDefault();
    if(d3Press()){try{elRoll.setPointerCapture(e.pointerId)}catch(_){}}
  });
  for(const ev of ['pointerup','pointercancel','lostpointercapture'])elRoll.addEventListener(ev,()=>{if(D3.on)d3Release()});
  elRoll.addEventListener('contextmenu',e=>{if(D3.on)e.preventDefault()});
  addEventListener('keyup',e=>{if(D3.on&&typeof KEYS!=='undefined'&&e.code===KEYS.yroll)d3Release()});
  addEventListener('blur',()=>{if(D3.on)d3Release()});
  if(window.ResizeObserver){const ro=new ResizeObserver(()=>{D3.layDirty=true});[$('#stage'),elLeft,elRoll,elHint].forEach(x=>ro.observe(x))}
  elTbl.addEventListener('click',e=>{const c=e.target.closest('td[data-c]');if(c)pickCat(c.dataset.c)});
  elTbl.addEventListener('keydown',e=>{
    if(e.key!=='Enter'&&e.key!==' ')return;
    const c=e.target.closest&&e.target.closest('td[data-c]');if(!c)return;
    e.preventDefault();pickCat(c.dataset.c);
  });
};

(window.GAMES=window.GAMES||{}).yahtzee=G;
})();
