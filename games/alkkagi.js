/* ===== 알까기 게임 모듈 =====
   공통 코드(index.html)가 GAMES.alkkagi의 함수를 불러서 이 게임의 규칙·봇·화면을 그림.
   두~네 사람이 바둑판 위의 내 알을 차례로 튕겨 다른 사람의 알을 판 밖으로 떨어뜨림. 내 알이 모두 떨어지면 탈락하고, 마지막까지 남은 사람이 이김.
   오목 모드(2명): 내 차례에 아무 점에나 돌을 놓거나 판 위의 내 돌을 튕김. 돌 수 제한·뺏기 없음.
   장기 모드(2명): 장기판 위 장기 상차림(마상마상)의 팔각 알 16개씩. 알마다 크기·두께가 다르고 무게는 부피에 비례(같은 힘이면 무거운 알이 느림). 부딪히면 알이 돎(겉모습만).
     '장 떨어지면 패배'를 켜면 장이 먼저 떨어진 쪽이 짐(같은 순간이면 튕긴 사람). 끄면 바둑알 모드처럼 알이 다 떨어지면 짐.
   월드 좌표는 공통 테이블 그대로(탁자 윗면 0): 판은 한가운데, 판 윗면 높이 TOP. 0번 자리의 알은 +z 쪽(0번 화면 아래), 1번은 -z 쪽
   물리는 방장만 계산(simulate)하고, 움직인 알의 자취(초당 30장)와 소리 날 일(부딪힘·떨어짐)을 모두에게 보냄. 화면은 그 자취를 재생만 함
   알은 납작한 바둑알(타원체)이라, 기울어진 채 부딪히면 위로 뜸: 세게 미끄러지는 알은 앞이 숙어 상대를 띄우고, 손가락으로 튕길 때 기우뚱함
   손패(hand)는 카드가 아니라 '알이 있음' 표시: 공통 코드가 hand가 비면 끝난 사람으로 보기 때문에 게임 중에는 [0]으로 둠 */
(function(){
const G={id:'alkkagi',name:'알까기',short:'알까기',lead:'바둑알을 튕겨 상대 알을 판 밖으로',brand:'알까기',brandPx:56,maxHi:4,noFast:true,firstPick:true};   // firstPick: 대기실 이름표 메뉴의 [선]을 씀 (주사위 연출은 아직 없음)
const OM_MAX=2;   // 오목·장기 모드 최대 인원
/* 게임 모드 md: 0 바둑, 1 오목, 2 장기. 예전에 저장한 설정(오목 스위치 omok)도 읽음 */
const mdOf=c=>{const m=Math.round(+c.md||0);return m>0&&m<=2?m:+c.omok?1:0};
G.maxOf=c=>mdOf(c)?OM_MAX:4;   // 공통 roomSetOf: 규칙에 따라 최대 인원이 달라짐
/* 규칙을 바꾼 뒤(또는 저장해 둔 설정을 불러온 뒤) 방 설정을 맞춤: 오목·장기 모드는 2명까지. strict면 인원이 넘을 때 못 바꾸게 null, 아니면 바둑 모드로 */
G.fixCfg=(c,n,strict)=>{
  if(!mdOf(c))return c;
  if(n>OM_MAX)return strict?null:{...c,md:0,omok:0};
  return +c.max>OM_MAX?{...c,max:OM_MAX}:c;
};

/* ---------- 판·알·물리 (방장 엔진과 화면이 같은 값을 씀) ---------- */
const NL=19,BW=2.3,GM=.3,TOP=.2,PITCH=(2*BW-2*GM)/(NL-1),SR=PITCH*.46,SH=SR*.52,KY=SR/SH;   // 줄 수, 판 반폭(틀 포함), 틀 안쪽 여백, 판 윗면 높이, 줄 간격, 알 반지름·반두께(오목 돌과 같은 비율: 줄 간격에 맞춤)
const HOSHI=[3,9,15];   // 화점 (19줄)
const FELT_Y=.016,FELT_R=3.15,TABLE_R=4.9;   // 공통 테이블: 펠트 윗면 높이·반지름, 탁자 반지름
const PHY={g:32,aB:6.5,aF:11,eSS:.86,eJ:.6,eG:.3,vmax:11,dt:1/240,fps:30,tmax:9,slope:.28,kT:700,cT:8,tk:7,mu:.25,aw:5,cw:1.2,miss:.2,kc:.012};   // 중력, 판·펠트 마찰 감속, 알끼리(바둑알·장기알)·바닥 튕김, 최고 속도, 계산 간격, 자취 장 수, 최대 길이(초), 미끄러질 때 앞이 숙는 정도, 기울기 복원·감쇠, 부딪힐 때 기우뚱, 알끼리 마찰(돎)·도는 알이 멈추는 정도, 장기 알: 끝까지 떨렸을 때 손가락이 가운데를 빗맞히는 거리(반지름 비율)·도는 알이 휘는 정도
const PMIN=.1;   // 이보다 약하게 당기고 놓으면 취소
/* 장기 모드: 판·알은 장기 모드(games/janggi.js)와 같은 크기. 점 사이 JS, 9줄×10줄, 판(틀 포함) 반폭 JBX·반길이 JBZ (떨어지는 기준은 나무판 가장자리)
   알 종류 t: 1 졸·병 2 사 3 상 4 마 5 포 6 차 7 장. 반지름(꼭짓점까지) JPR·두께 JPT는 장기 모드와 같음. 부딪힘은 원으로(꼭짓점과 변 사이 JCR배)
   무게는 부피(반지름²×두께)에 비례하고 차·포·마·상이 1.
   튕기기는 손가락(무게 JFM, 차와 같음)이 당긴 만큼의 속도로 알과 부딪히는 것: 알 속도 ∝ 2·JFM/(JFM+알 무게).
   가벼운 졸은 손가락보다 크게 빨라지지 못해 운동량이 장의 절반쯤(큰 기물을 잘 못 밂), 장·졸 속도 차이는 약 1.8배.
   JFU: 손가락 속도 크기 (장을 끝까지 당기면 판 길이만큼 갈 정도, 예전 '같은 충격량'일 때 장의 속도와 같게). 쳐 보고 맞출 값 */
const JS=.46,JHX=4*JS,JHZ=4.5*JS,JBX=JHX+.36,JBZ=JHZ+.36;
const JPR={1:.165,2:.165,3:.205,4:.205,5:.205,6:.205,7:.25},JPT={1:.075,2:.075,3:.09,4:.09,5:.09,6:.09,7:.105},JCR=.94;
const JM={};for(const t in JPR)JM[t]=JPR[t]*JPR[t]*JPT[t]/(JPR[4]*JPR[4]*JPT[4]);
const JFM=1,JFU=1.06;
const jShotK=t=>JFU*2*JFM/(JFM+JM[t]);   // 장기 알: 당긴 정도의 속도(speedOf)에 곱하는 값 (차 1.06, 장 .78, 졸 1.38)
const JNM=[['','졸','사','상','마','포','차','장'],['','병','사','상','마','포','차','장']],JHJ=[['','卒','士','象','馬','包','車','楚'],['','兵','士','象','馬','包','車','漢']];
/* 알 하나의 크기: 반지름(부딪힘)·반두께·무게. 바둑알(t 없음)은 SR·SH·1 */
const geomOf=t=>t?{r:JPR[t]*JCR,h:JPT[t]/2,m:JM[t],rv:JPR[t]}:{r:SR,h:SH,m:1,rv:SR};
/* 판 크기: 지금 판(바둑판 정사각형 / 장기판 직사각형)의 반폭·반길이. 물리·화면이 같이 씀 (방장 엔진은 튕기기 전에, 화면은 상태를 받을 때 맞춤) */
const BD={x:BW,z:BW,jg:0};
function useBoard(jg){jg=jg?1:0;if(BD.jg===jg)return;BD.jg=jg;BD.x=jg?JBX:BW;BD.z=jg?JBZ:BW}
/* 장기 상차림 (마상마상 고정): [종류, 줄 x 0~8, 끝 줄에서 y]. 0번 자리(+z 쪽)는 그대로, 1번 자리는 판 가운데를 중심으로 돌린 자리 */
const JSET=[[6,0,0],[4,1,0],[3,2,0],[2,3,0],[2,5,0],[4,6,0],[3,7,0],[6,8,0],[7,4,1],[5,1,2],[5,7,2],[1,0,3],[1,2,3],[1,4,3],[1,6,3],[1,8,3]];
function jgSetup(){
  const out=[];
  for(const s of [0,1]){const sg=s?-1:1;for(const [t,c,y] of JSET){const g=geomOf(t);out.push({x:sg*(c-4)*JS,y:TOP+g.h,z:sg*(4.5-y)*JS,s,o:0,g:0,t,w:0})}}
  return out;
}
/* 손 떨림: 당기기 시작부터 불규칙하게 떨리고, 세게 당길수록 크게. 놓는 순간 손이 가리키던 방향으로 나감 (살살 치면 거의 직선, 끝까지 당기면 최대 SPREAD) */
const SPREAD=2*Math.PI/180;   // 끝까지 당겼을 때 떨림 폭 (라디안, 2도: 손은 팔꿈치를 축으로 흔들려 손끝이 그만큼 더 크게 움직여 보임)
const spreadOf=p=>SPREAD*p*p;
function jit(t){   // -1~1, 잔잔하다 가끔 크게 (규칙적인 흔들림이 아니라 타이밍을 노리기 어렵게)
  const a=.5*Math.sin(t*.0067+1.3)+.3*Math.sin(t*.0151+.4)+.2*Math.sin(t*.0389+2.1);
  const b=Math.pow(Math.sin(t*.0021),8)*Math.sin(t*.047);
  return Math.max(-1,Math.min(1,a*.8+b*.6));
}
const speedOf=p=>PHY.vmax*Math.pow(Math.max(0,Math.min(1,p)),1.25);   // 당긴 정도 → 속도 (끝으로 갈수록 조금 더 세짐)
/* 이 알을 p만큼 당겨 튕긴 속도: 바둑알은 speedOf 그대로, 장기 알은 손가락과 부딪힌 속도(jShotK) */
const shotSpeed=(q,p)=>q&&q.t?speedOf(p)*jShotK(q.t):speedOf(p);
/* 장기 알 튕길 때 처음 회전: 손 떨림 몫 j(−SPREAD~SPREAD, 떨림 폭이 p²에 비례하니 세게 칠수록 큼)만큼 손가락이 가운데를 빗맞힘 → 회전 = 충격량 × 빗맞은 거리 ÷ 회전 관성(½·m·rv²) = 2·v·빗맞은 거리 ÷ rv².
   부호는 휘는 쪽이 떨린 쪽과 같게 (떨림이 더 커지는 쪽으로 휨: 세게 칠수록 불확정). 바둑알은 0 */
const shotSpin=(q,v,j)=>q&&q.t&&Number.isFinite(j)?-2*v*PHY.miss*Math.max(-1,Math.min(1,j/SPREAD))/JPR[q.t]:0;
const CNAME_JG=['','초','한'];   // 장기 모드: 선(1)이 초, 다음(2)이 한
const onBoardXZ=(x,z)=>Math.abs(x)<=BD.x&&Math.abs(z)<=BD.z;
function groundAt(x,z){
  if(onBoardXZ(x,z))return TOP;
  const r=Math.hypot(x,z);
  if(r<FELT_R)return FELT_Y;
  if(r<TABLE_R)return 0;
  return -99;   // 탁자 밖: 바닥으로 떨어져 사라짐
}
const wrapA=a=>{a%=Math.PI;if(a>Math.PI/2)a-=Math.PI;else if(a<-Math.PI/2)a+=Math.PI;return a};
const tiltOf=q=>{let t=Math.hypot(q.ax,q.az)%Math.PI;if(t>Math.PI/2)t=Math.PI-t;return t};
/* 장기 알 팔각(위에서 본 아랫면): 꼭짓점 반지름 rv, 변까지 거리 rv·cos(π/8). 변의 법선은 kπ/4 − w (그림 jMesh의 yaw와 같은 기준: 주인 쪽 각도는 π/2의 배수라 팔각 모양에는 상관없음)
   octHit(a,b): 겹치면 {p 겹친 깊이, ux,uz a→b 법선, cx,cz 닿은 점}, 아니면 null (분리축: 두 팔각의 변 법선 4개씩) */
const OCT_C=Math.cos(Math.PI/8);
function octVerts(q){const v=[];for(let k=0;k<8;k++){const a=Math.PI/8+k*Math.PI/4-q.w;v.push([q.x+q.rv*Math.cos(a),q.z+q.rv*Math.sin(a)])}return v}
function octIn(q,x,z){const dx=x-q.x,dz=z-q.z,ap=q.rv*OCT_C+1e-6;for(let k=0;k<4;k++){const a=k*Math.PI/4-q.w;if(Math.abs(dx*Math.cos(a)+dz*Math.sin(a))>ap)return false}return true}
function octHit(a,b){
  const dx=b.x-a.x,dz=b.z-a.z,Q=Math.PI/4;
  const hw=(q,ang)=>{let d=(ang-(Math.PI/8-q.w))%Q;if(d<0)d+=Q;return q.rv*Math.cos(Math.min(d,Q-d))};   // 팔각을 ang 방향으로 비춘 반폭 (가장 가까운 꼭짓점)
  let best=1e9,bx=0,bz=0;
  for(const q of [a,b])for(let k=0;k<4;k++){
    const ang=k*Q-q.w,ux=Math.cos(ang),uz=Math.sin(ang);
    const dp=dx*ux+dz*uz,o=hw(a,ang)+hw(b,ang)-Math.abs(dp);
    if(o<=0)return null;
    if(o<best){best=o;const sg=dp<0?-1:1;bx=ux*sg;bz=uz*sg}
  }
  // 닿은 점: 상대 팔각 안에 들어온 꼭짓점들의 가운데 (변끼리 나란히 닿으면 겹친 구간 가운데라 돌지 않음)
  const va=octVerts(a),vb=octVerts(b);let cx=0,cz=0,n=0;
  for(const [x,z] of vb)if(octIn(a,x,z)){cx+=x;cz+=z;n++}
  for(const [x,z] of va)if(octIn(b,x,z)){cx+=x;cz+=z;n++}
  if(n){cx/=n;cz/=n}else{const ha=a.rv*OCT_C;cx=a.x+bx*(ha-best/2);cz=a.z+bz*(ha-best/2)}
  return {p:best,ux:bx,uz:bz,cx,cz};
}
const halfH=q=>{const t=tiltOf(q);return q.h*Math.cos(t)+q.r*Math.sin(t)};   // 기울어진 알의 반높이 (가장자리로 서면 높아짐)
/* 한 번 튕기기: st(알 목록 {x,y,z,s,o,g, t 장기 알 종류, w 돈 각도})에서 shot.i번 알을 (vx,vz)로. 기울기 (ax,az): +x·+z 쪽 가장자리가 올라간 각도
   알마다 크기·무게(geomOf)가 다를 수 있음: 부딪힘은 무게 비율로 나눠 받음. 비껴 부딪히면 마찰로 돎(wy, 장기 알만 자취에 각도를 남김)
   돌려줌: fin 끝난 자리, tr 움직인 알의 자취 {번호: [시작 장, x,y,z,ax,az(,w)(1000배 정수)…]}, k 한 장의 값 수(5, 장기 알이 있으면 6), nf 장 수, ev 소리 [[ms, 종류, 세기]], of 떨어진 시각 {번호: ms}, dur 길이(ms) */
function simulate(st,shot,rnd){
  rnd=rnd||Math.random;
  const P=PHY,dt=P.dt,S=st.map(s=>({...geomOf(s.t),x:s.x,y:s.y,z:s.z,o:s.o?1:0,g:s.g?1:0,s:s.s,t:s.t||0,w:s.w||0,wy:0,vx:0,vy:0,vz:0,ax:0,az:0,bx:0,bz:0,aw:0,still:0}));
  const SPIN=S.some(q=>q.t),K=SPIN?6:5;   // 장기 알: 도는 각도도 자취에
  const ev=[],frames=[],every=Math.round(1/(P.fps*dt)),of={};   // of: 판에서 떨어진 시각(ms) {번호: ms} (화면이 남은 알 수를 그 순간에 줄임)
  const rec=()=>frames.push(S.map(q=>SPIN?[q.x,q.y,q.z,q.ax,q.az,q.w]:[q.x,q.y,q.z,q.ax,q.az]));
  const push=(k,v,step)=>{if(ev.length<60)ev.push([Math.round(step*dt*1000),k,Math.round(v*100)/100])};
  const q0=S[shot.i];q0.vx=shot.vx;q0.vz=shot.vz;q0.aw=1;if(q0.t&&shot.wy)q0.wy=shot.wy;
  // 손가락으로 튕긴 알은 살짝 기우뚱 (앞이 숙거나 들림, 세게 칠수록 크게)
  {const sp=Math.hypot(shot.vx,shot.vz)||1,ux=shot.vx/sp,uz=shot.vz/sp,k=(rnd()*2-1)*(1.5+6*(shot.p||0));q0.bx=ux*k+(rnd()-.5)*2;q0.bz=uz*k+(rnd()-.5)*2}
  rec();
  let last=0;
  const maxS=Math.round(P.tmax/dt);
  for(let step=1;step<=maxS;step++){
    for(const q of S){
      if(q.g||!q.aw)continue;
      const he=halfH(q),gy=groundAt(q.x,q.z),onG=q.y-he<=gy+.015&&q.vy<=.3;   // 기울기가 줄어 반높이가 낮아져도 바닥에 닿은 채로 봄 (그러지 않으면 공중에서 계속 돎)
      if(onG){
        const sp=Math.hypot(q.vx,q.vz),dec=(gy>=TOP-1e-6?P.aB:P.aF)*dt;
        if(q.t&&q.wy&&sp>1e-6){   // 도는 장기 알은 앞 가장자리가 움직이는 쪽(컬링처럼)으로 조금 휨: 속도에 수직, 크기 ∝ 회전 × 속도 (방향만 바꾸고 빠르기는 그대로)
          const k=P.kc*q.wy*dt,nx=q.vx+k*q.vz,nz=q.vz-k*q.vx,nl=Math.hypot(nx,nz);q.vx=nx*sp/nl;q.vz=nz*sp/nl}
        if(sp<=dec){q.vx=q.vz=0}else{q.vx-=q.vx/sp*dec;q.vz-=q.vz/sp*dec}
        // 미끄러지는 알은 앞이 살짝 숙음(빠를수록). 바닥에 닿은 동안은 납작하게 돌아오려 함
        const f=Math.min(1,sp/P.vmax),tx=sp>1e-6?-P.slope*f*q.vx/sp:0,tz=sp>1e-6?-P.slope*f*q.vz/sp:0;
        q.ax=wrapA(q.ax);q.az=wrapA(q.az);   // 반 바퀴 넘게 돈 각도는 접음 (바둑알은 뒤집어도 같음)
        q.bx+=(-P.kT*(q.ax-tx)-P.cT*q.bx)*dt;q.bz+=(-P.kT*(q.az-tz)-P.cT*q.bz)*dt;
        q.vy=0;q.y=gy+he;
        if(q.wy){const dw=(P.aw+Math.abs(q.wy)*P.cw)*dt;q.wy=Math.abs(q.wy)<=dw?0:q.wy-Math.sign(q.wy)*dw}   // 바닥에 닿은 채 도는 알은 마찰로 멈춰 감
      }else{q.vy-=P.g*dt;const br=Math.hypot(q.bx,q.bz);if(br>30){q.bx*=30/br;q.bz*=30/br}}
      q.ax+=q.bx*dt;q.az+=q.bz*dt;q.w+=q.wy*dt;
      q.x+=q.vx*dt;q.y+=q.vy*dt;q.z+=q.vz*dt;
      const gy2=groundAt(q.x,q.z),he2=halfH(q);
      if(q.y-he2<gy2){
        const vin=-q.vy;q.y=gy2+he2;
        if(q.vy<0){q.vy=vin>1.2?vin*P.eG:0;if(vin>.6)push(gy2>=TOP-1e-6?'b':'f',vin,step)}
      }
      // 판 옆면: 판 윗면보다 낮은 알은 판 안으로 못 들어감 (떨어지는 알이 판 모서리에서 밀려남)
      if(q.y-he2<TOP-.003){
        const ox=BD.x+q.r-Math.abs(q.x),oz=BD.z+q.r-Math.abs(q.z);
        if(ox>0&&oz>0&&!(onBoardXZ(q.x,q.z)&&q.y>TOP)){
          if(ox<oz){const sg=Math.sign(q.x)||1;q.x=sg*(BD.x+q.r);if(q.vx*sg<0){if(-q.vx*sg>.8)push('w',-q.vx*sg,step);q.vx=-q.vx*.3}}
          else{const sg=Math.sign(q.z)||1;q.z=sg*(BD.z+q.r);if(q.vz*sg<0){if(-q.vz*sg>.8)push('w',-q.vz*sg,step);q.vz=-q.vz*.3}}
        }
      }
      // 판에서 떨어지면 탈락(다시 올라와도 그대로). 판 밖으로 기울며 넘어감
      if(!q.o&&q.y<TOP-.01&&!onBoardXZ(q.x,q.z)){q.o=1;of[S.indexOf(q)]=Math.round(step*dt*1000);if(Math.abs(q.x)>BD.x)q.bx-=Math.sign(q.x)*6;if(Math.abs(q.z)>BD.z)q.bz-=Math.sign(q.z)*6}
      if(q.y<-1.5){if(!q.o)of[S.indexOf(q)]=Math.round(step*dt*1000);q.g=1;q.o=1;q.aw=0;q.vx=q.vy=q.vz=0;q.wy=0}   // 탁자 밖으로 떨어짐 (사라짐)
    }
    // 알끼리: 납작한 알(타원체) 두 개는 세로를 KY배로 늘리면 공 두 개가 됨 (크기가 다른 알은 두 알 합으로 잼: 반지름 합 rs, 세로 비율 ky)
    for(let it=0;it<2;it++)for(let i=0;i<S.length;i++){const a=S[i];if(a.g)continue;
      for(let j=i+1;j<S.length;j++){const b=S[j];if(b.g||(!a.aw&&!b.aw))continue;
        const rs=a.r+b.r,ky=rs/(a.h+b.h),oc=a.t&&b.t;
        const dx=b.x-a.x,dz=b.z-a.z;let dh=Math.hypot(dx,dz);if(dh>(oc?a.rv+b.rv:rs)+.02||Math.abs(b.y-a.y)>rs+.1)continue;
        let ux=dh>1e-9?dx/dh:1,uz=dh>1e-9?dz/dh:0,oh=null;
        if(oc&&dh>1e-6){   // 장기 알: 수평 법선과 겹친 깊이는 팔각으로 (위아래 뜨는 계산은 그대로, 겹친 깊이를 '원끼리 거리'로 바꿔 넣음)
          oh=octHit(a,b);if(!oh)continue;ux=oh.ux;uz=oh.uz;dh=Math.max(1e-6,rs-oh.p)}
        const la=a.r*Math.sin(a.ax*ux+a.az*uz),lb=b.r*Math.sin(-(b.ax*ux+b.az*uz));   // 서로를 향한 가장자리 높이
        const e=(b.y+lb)-(a.y+la),ey=e*ky,d=Math.hypot(dh,ey);
        if(d>=rs)continue;
        const nx=dh>1e-9?ux*dh/d:1,ny=ey/d,nz=dh>1e-9?uz*dh/d:0;
        let rx=nx,ry=ky*ny,rz=nz;const rl=Math.hypot(rx,ry,rz);rx/=rl;ry/=rl;rz/=rl;
        // 기울어진 알의 면은 법선도 같이 기욺: 앞이 숙은 알(a)이 치면 상대를 위로, 상대(b)의 가장자리가 숙어 있으면 아래로
        {const ph=-((a.ax+b.ax)*ux+(a.az+b.az)*uz),hz=Math.hypot(rx,rz),be=Math.atan2(ry,hz)+Math.max(-1.2,Math.min(1.2,ph)),cb=Math.cos(be);rx=ux*cb;rz=uz*cb;ry=Math.sin(be)}
        const ov=rs-d,ka=b.m/(a.m+b.m),kb=a.m/(a.m+b.m);   // 겹친 만큼 무게 비율로 밀어냄 (가벼운 알이 더 밀림)
        a.x-=nx*ov*ka;a.z-=nz*ov*ka;a.y-=ny*ov*ka/ky;b.x+=nx*ov*kb;b.z+=nz*ov*kb;b.y+=ny*ov*kb/ky;
        if(oh){   // 장기 알(팔각): 닿은 점에서 충격량 — 선속도 + 회전(wy, 닿은 점 속도 = 선속도 + (wy·rz, −wy·rx)), 회전 관성은 원판 ½·m·rv²
          const rax=oh.cx-a.x,raz=oh.cz-a.z,rbx=oh.cx-b.x,rbz=oh.cz-b.z,Ia=.5*a.m*a.rv*a.rv,Ib=.5*b.m*b.rv*b.rv,cr=(qx,qz,nx_,nz_)=>qz*nx_-qx*nz_;
          const rel=()=>[a.vx+a.wy*raz-b.vx-b.wy*rbz,a.vz-a.wy*rax-b.vz+b.wy*rbx];
          let [wx,wz]=rel();const vn=wx*rx+wz*rz+(a.vy-b.vy)*ry;
          if(vn>0){
            const ca=cr(rax,raz,rx,rz),cb=cr(rbx,rbz,rx,rz),E=vn>.4?P.eJ:0,J=(1+E)*vn/(1/a.m+1/b.m+ca*ca/Ia+cb*cb/Ib),Ja=J/a.m,Jb=J/b.m;
            a.vx-=Ja*rx;a.vy-=Ja*ry;a.vz-=Ja*rz;b.vx+=Jb*rx;b.vy+=Jb*ry;b.vz+=Jb*rz;a.wy-=J*ca/Ia;b.wy+=J*cb/Ib;
            a.bx+=ux*P.tk*(-Ja*ry);a.bz+=uz*P.tk*(-Ja*ry);b.bx-=ux*P.tk*(Jb*ry);b.bz-=uz*P.tk*(Jb*ry);
            // 마찰(접선 충격량): 닿은 점의 미끄러짐을 막음 → 비껴 맞으면 돌고 나가는 방향도 조금 바뀜
            [wx,wz]=rel();const tx=-uz,tz=ux,vt=wx*tx+wz*tz,ta=cr(rax,raz,tx,tz),tb=cr(rbx,rbz,tx,tz),kt=1/a.m+1/b.m+ta*ta/Ia+tb*tb/Ib,jt=-Math.sign(vt)*Math.min(P.mu*J,Math.abs(vt)/kt);
            a.vx+=jt*tx/a.m;a.vz+=jt*tz/a.m;b.vx-=jt*tx/b.m;b.vz-=jt*tz/b.m;a.wy+=jt*ta/Ia;b.wy-=jt*tb/Ib;
            if(vn>.5)push('c',vn,step);
            a.aw=b.aw=1;a.still=b.still=0;
          }
          continue;
        }
        const vn=(a.vx-b.vx)*rx+(a.vy-b.vy)*ry+(a.vz-b.vz)*rz;
        if(vn>0){
          const E=vn>.4?(a.t||b.t?P.eJ:P.eSS):0,J=(1+E)*vn/(1/a.m+1/b.m),Ja=J/a.m,Jb=J/b.m;   // 충격량 J는 같고 속도 변화는 무게에 반비례 (같은 무게면 (1+E)vn/2)
          a.vx-=Ja*rx;a.vy-=Ja*ry;a.vz-=Ja*rz;b.vx+=Jb*rx;b.vy+=Jb*ry;b.vz+=Jb*rz;
          a.bx+=ux*P.tk*(-Ja*ry);a.bz+=uz*P.tk*(-Ja*ry);b.bx-=ux*P.tk*(Jb*ry);b.bz-=uz*P.tk*(Jb*ry);   // 가장자리를 위·아래로 치면 기우뚱
          if(SPIN){   // 비껴 부딪히면 닿은 곳의 미끄러짐을 마찰이 막아 두 알이 돎 (겉모습만, 나가는 방향은 그대로)
            const tx=-uz,tz=ux,vt=(a.vx-b.vx)*tx+(a.vz-b.vz)*tz,c=-Math.sign(vt)*Math.min(P.mu*J,Math.abs(vt)/(1/a.m+1/b.m)*.5);
            a.wy-=a.r*c/(.5*a.m*a.r*a.r);b.wy-=b.r*c/(.5*b.m*b.r*b.r)}
          if(vn>.5)push('c',vn,step);
          a.aw=b.aw=1;a.still=b.still=0;
        }
      }}
    // 멈춤: 거의 안 움직이면 납작하게 내려놓고 쉼 (다른 알 위에 얹힌 채 멈춘 것도)
    for(const q of S){
      if(q.g||!q.aw)continue;
      const sp=Math.hypot(q.vx,q.vy,q.vz),rot=Math.hypot(q.bx,q.bz);
      if(sp<.03&&rot<.6&&tiltOf(q)<.03&&Math.abs(q.wy)<.3)q.still++;else q.still=0;
      if(q.still>12){q.aw=0;q.vx=q.vy=q.vz=0;q.bx=q.bz=0;q.ax=q.az=0;q.wy=0;const gy=groundAt(q.x,q.z);if(Math.abs(q.y-(gy+q.h))<.01)q.y=gy+q.h}
    }
    // 얹혀 쉬던 알은 받치던 알이 없어지면 다시 떨어짐
    for(const q of S){
      if(q.g||q.aw)continue;
      const gy=groundAt(q.x,q.z);if(q.y-q.h<=gy+.002)continue;
      let sup=false;for(const b of S){if(b===q||b.g)continue;const rs=q.r+b.r,dh=Math.hypot(b.x-q.x,b.z-q.z),dy=(q.y-b.y)*rs/(q.h+b.h);if(b.y<q.y&&Math.hypot(dh,dy)<rs+.01){sup=true;break}}
      if(!sup){q.aw=1;q.still=0}
    }
    last=step;
    if(step%every===0)rec();
    if(S.every(q=>q.g||!q.aw))break;
  }
  if(last%every)rec();
  for(const q of S){q.ax=q.az=0}
  frames.push(S.map(q=>SPIN?[q.x,q.y,q.z,0,0,q.w]:[q.x,q.y,q.z,0,0]));
  // 움직인 알만 자취를 남김 (움직이기 바로 앞 장부터 마지막으로 움직인 장까지, 1000배 정수)
  const tr={},nf=frames.length;
  S.forEach((q,i)=>{
    let f0=-1,f1=-1;
    for(let f=1;f<nf;f++){const a=frames[f][i],b=frames[f-1][i];let dd=0;for(let k=0;k<K;k++)dd+=Math.abs(a[k]-b[k]);if(dd>2e-4){if(f0<0)f0=f;f1=f}}
    if(f0<0)return;
    const out=[f0-1];for(let f=f0-1;f<=f1;f++)for(const v of frames[f][i])out.push(Math.round(v*1000));
    tr[i]=out;
  });
  return {fin:S.map(q=>({x:q.x,y:q.y,z:q.z,s:q.s,o:q.o,g:q.g,t:q.t,w:Math.round(q.w*1000)/1000})),tr,k:K,nf,ev,of,dur:Math.round((nf-1)/P.fps*1000)};
}
/* 자리 방향 (월드 xz): 0번 자리가 화면 아래이고 시계 방향으로 왼쪽·위·오른쪽. 두 명이면 아래·위(마주 보기), 세 명이면 아래·왼쪽·위 */
const SIDES=[[0,1],[-1,0],[0,-1],[1,0]];
const sideOfSeat=(seat,np)=>SIDES[(np||2)===2?(seat===1?2:0):Math.max(0,seat)%4];
/* 놓기 전 알: 내 쪽 판 바깥 펠트에 한 줄로 (놓으면 판으로 날아감). k번째 알, 한 사람 n개, np명 */
function reserveAt(s,k,n,np){
  const step=n>1?Math.min(.3,2.7/(n-1)):0,x=(k-(n-1)/2)*step,[sx,sz]=sideOfSeat(s,np),d=BW+.3;
  return {x:sz*x+sx*d,y:FELT_Y+SH,z:-sx*x+sz*d,s,o:0,g:0,u:1};
}
function reserves(n,np){np=np||2;const out=[];for(let s=0;s<np;s++)for(let k=0;k<n;k++)out.push(reserveAt(s,k,n,np));return out}
/* 놓을 수 있는 자리: 줄이 만나는 점 (c 가로, r 세로 0~18). 두 명이면 내 쪽 반(가운데 줄 빼고), 세·네 명이면 내 쪽 삼각형(대각선 빼고). 다른 알이 없는 곳.
   오목 모드는 판 어디나(다른 돌과 겹치지 않는 점) */
const C0=(NL-1)/2;
const gridXZ=(c,r)=>[(c-C0)*PITCH,(r-C0)*PITCH];
function ownPt(seat,np,c,r){const [sx,sz]=sideOfSeat(seat,np),dx=c-C0,dz=r-C0,a=dx*sx+dz*sz,p=Math.abs(dx*sz-dz*sx);return np>2?a>p:a>0}
function freeAt(A,c,r){const [x,z]=gridXZ(c,r),d=A.om?2*SR:PITCH*.6;return !A.st.some(q=>!q.u&&!q.o&&Math.hypot(q.x-x,q.z-z)<d)}   // 오목 모드는 돌이 겹치지 않을 만큼 떨어진 점
const simSt=st=>st.map(q=>q.u?{...q,g:1,o:1}:q);   // 아직 놓지 않은 알은 물리에서 뺌
function canPlace(A,seat,c,r){return Number.isInteger(c)&&Number.isInteger(r)&&c>=0&&c<NL&&r>=0&&r<NL&&(A.om||ownPt(seat,A.np||2,c,r))&&freeAt(A,c,r)}

/* ---------- 오목 모드 ----------
   두 사람. 돌 수 제한도 뺏기도 없음. 내 차례에 아무 점에나(다른 돌과 겹치지 않는 곳) 돌을 놓거나, 판 위의 내 돌 하나를 튕김. 판에서 떨어진 돌은 그냥 사라짐.
   돌이 다 멈추면 판정(omGrid): 줄 점마다 반 칸 안의 가장 가까운 돌이 그 점에 있음. 5목 이상이면 승리(누가 튕겼든), 양쪽 다면 튕긴 사람이 짐.
   놓을 수 있는 점이 하나도 없으면 무승부 */
function omGrid(st){   // 줄 점마다 놓인 돌의 주인+1 (0 = 빈 점)
  const g=new Array(NL*NL).fill(0),d=new Array(NL*NL).fill(9);
  for(const q of st){if(q.u||q.o)continue;
    const c=Math.round(q.x/PITCH+C0),r=Math.round(q.z/PITCH+C0);if(c<0||c>=NL||r<0||r>=NL)continue;
    const e=Math.hypot(q.x-(c-C0)*PITCH,q.z-(r-C0)*PITCH);if(e>=PITCH*.5||e>=d[r*NL+c])continue;
    d[r*NL+c]=e;g[r*NL+c]=q.s+1}
  return g;
}
const OM_DIR=[[1,0],[0,1],[1,1],[1,-1]];
function omFive(g,seat){   // 5목 이상인 줄의 점들 [[c,r]…] 또는 null
  const v=seat+1;
  for(let r=0;r<NL;r++)for(let c=0;c<NL;c++){if(g[r*NL+c]!==v)continue;
    for(const [dc,dr] of OM_DIR){
      const pc=c-dc,pr=r-dr;if(pc>=0&&pc<NL&&pr>=0&&pr<NL&&g[pr*NL+pc]===v)continue;   // 줄의 첫 점에서만 셈
      const ln=[];let x=c,y=r;while(x>=0&&x<NL&&y>=0&&y<NL&&g[y*NL+x]===v){ln.push([x,y]);x+=dc;y+=dr}
      if(ln.length>=5)return ln}}
  return null;
}
const omFull=A=>{for(let r=0;r<NL;r++)for(let c=0;c<NL;c++)if(freeAt(A,c,r))return false;return true};   // 놓을 점이 없음
/* 줄 세기 점수: 한쪽 돌만 있는 다섯 칸 묶음마다 (돌 수에 따라) 더함. 봇이 수를 고를 때 */
const OM_W=[0,1,6,40,300,5000];   // 다섯 칸이 다 차면(오목) 가장 크게: 0이면 이기는 점·막을 점을 노리지 않음
function omLines(g){
  const sc=[0,0];
  for(let r=0;r<NL;r++)for(let c=0;c<NL;c++)for(const [dc,dr] of OM_DIR){
    const ec=c+4*dc,er=r+4*dr;if(ec<0||ec>=NL||er<0||er>=NL)continue;
    let a=0,b=0;for(let k=0;k<5;k++){const v=g[(r+k*dr)*NL+c+k*dc];if(v===1)a++;else if(v===2)b++}
    if(a&&!b)sc[0]+=OM_W[a];else if(b&&!a)sc[1]+=OM_W[b]}
  return sc;
}
/* 노릴 빈 점: 내 줄을 늘리거나 상대 줄을 막는 점 (점수 높은 순). 돌이 놓일 수 있는 점만 */
function omTargets(A,seat,k){
  const g=omGrid(A.st),base=omLines(g),out=[];
  for(let r=0;r<NL;r++)for(let c=0;c<NL;c++){if(g[r*NL+c]||!freeAt(A,c,r))continue;
    let near=false;for(let dr=-2;dr<=2&&!near;dr++)for(let dc=-2;dc<=2;dc++){const y=r+dr,x=c+dc;if(x>=0&&x<NL&&y>=0&&y<NL&&g[y*NL+x]){near=true;break}}
    if(!near)continue;
    g[r*NL+c]=seat+1;const a=omLines(g);g[r*NL+c]=2-seat;const b=omLines(g);g[r*NL+c]=0;
    out.push({c,r,v:(a[seat]-base[seat])+.8*(b[1-seat]-base[1-seat])})}
  out.sort((x,y)=>y.v-x.v);
  if(!out.length){   // 판이 비었거나 근처에 놓을 점이 없음: 가운데 근처의 빈 점
    for(const [c,r] of [[9,9],[8,9],[10,9],[9,8],[9,10],[8,8],[10,10],[8,10],[10,8]])if(freeAt(A,c,r))out.push({c,r,v:0});
    for(let r=0;r<NL&&!out.length;r++)for(let c=0;c<NL;c++)if(freeAt(A,c,r)){out.push({c,r,v:0});break}
  }
  return out.slice(0,k);
}
/* 오목 모드 놓기 계획: 노릴 점 하나 [c,r] (쉬움은 위 셋 중 아무거나) */
function omPlacePlan(A,seat,rnd,lv){
  rnd=rnd||Math.random;
  const T=omTargets(A,seat,3);if(!T.length)return null;
  const t=T[lv===2?0:(rnd()*T.length)|0];
  return [t.c,t.r];
}
/* 오목 모드 봇 수 후보: 노릴 점에 놓기({pl}) + 노릴 빈 점에 멈추게 굴리기 + 상대 돌 치기 */
const stopP=d=>Math.max(PMIN,Math.min(1,Math.pow(Math.sqrt(2*PHY.aB*Math.max(.01,d))/PHY.vmax,1/1.25)));   // 이만큼 굴러가 멈추는 힘
function omCands(A,seat,lv){
  const L=BLV[lv],out=[],T=omTargets(A,seat,L.pairs);
  for(const t of T)out.push({pl:[t.c,t.r]});
  const mine=A.st.map((q,i)=>i).filter(i=>{const q=A.st[i];return q.s===seat&&!q.o});
  if(!mine.length)return out;
  for(const t of T){const [x,z]=gridXZ(t.c,t.r);
    const from=mine.slice().sort((a,b)=>Math.hypot(A.st[a].x-x,A.st[a].z-z)-Math.hypot(A.st[b].x-x,A.st[b].z-z)).slice(0,2);
    for(const i of from){const q=A.st[i],d=Math.hypot(x-q.x,z-q.z);if(d<PITCH*.3)continue;
      for(const k of [1,.97,1.04])out.push({i,a:Math.atan2(z-q.z,x-q.x),p:stopP(d*k)})}}
  const opp=A.st.map((q,i)=>i).filter(i=>{const q=A.st[i];return q.s!==seat&&!q.o});
  const hits=[];for(const i of mine)for(const j of opp){const a=A.st[i],b=A.st[j];hits.push({i,j,d:Math.hypot(b.x-a.x,b.z-a.z)})}
  hits.sort((x,y)=>x.d-y.d);
  for(const pk of hits.slice(0,Math.ceil(L.pairs/2))){const a=A.st[pk.i],b=A.st[pk.j],base=Math.atan2(b.z-a.z,b.x-a.x);
    for(const o of [0,-.08,.08])for(const p of [.6,.85])out.push({i:pk.i,a:base+o,p})}
  return out;
}
/* seat가 다음 차례에 놓으면 바로 오목이 되는 빈 점 수 (st: 돌 목록, g: 그 판의 omGrid). 봇이 막아야 할 수를 놓치지 않게 */
function omThreats(st,g,seat){
  const v=seat+1,A={om:1,st},seen=new Set();
  for(let r=0;r<NL;r++)for(let c=0;c<NL;c++)for(const [dc,dr] of OM_DIR){
    const ec=c+4*dc,er=r+4*dr;if(ec<0||ec>=NL||er<0||er>=NL)continue;
    let n=0,o=0,e=-1;for(let k=0;k<5;k++){const x=g[(r+k*dr)*NL+c+k*dc];if(x===v)n++;else if(x)o++;else e=k}
    if(n===4&&!o){const x=c+e*dc,y=r+e*dr,key=y*NL+x;if(!seen.has(key)&&freeAt(A,x,y))seen.add(key)}}
  return seen.size;
}
const OM_WIN=1e6;   // 이기고 지는 점수: 줄 세기 점수(수천까지 쌓임)보다 훨씬 크게
function omScore(A,seat,c){   // 놓아서 이기면 2×OM_WIN(확실), 굴려서 이기면 OM_WIN(손이 떨려 빗나갈 수 있음), 지면 −OM_WIN, 그 밖에는 줄 세기 점수 차이와 떨어뜨린 돌
  if(c.pl){const g=omGrid(A.st);g[c.pl[1]*NL+c.pl[0]]=seat+1;if(omFive(g,seat))return 2*OM_WIN;
    const [x,z]=gridXZ(c.pl[0],c.pl[1]),L=omLines(g);
    return L[seat]-1.3*L[1-seat]-(omThreats(A.st.concat([{x,y:TOP+SH,z,s:seat,o:0,g:0}]),g,1-seat)?OM_WIN/2:0)}   // 상대에게 이기는 점을 남기면 크게 −
  const v=speedOf(c.p),r=simulate(A.st,{i:c.i,vx:Math.cos(c.a)*v,vz:Math.sin(c.a)*v,p:c.p},()=>.5);
  const st=r.fin.map((q,k)=>({...q,o:A.st[k].o||q.o?1:0}));
  const g=omGrid(st),me=omFive(g,seat),op=omFive(g,1-seat);
  if(op)return -OM_WIN;if(me)return OM_WIN;
  const L=omLines(g);let sc=L[seat]-1.3*L[1-seat]-(omThreats(st,g,1-seat)?OM_WIN/2:0);
  st.forEach((q,k)=>{if(!A.st[k].o&&q.o)sc+=q.s===seat?-4:4});
  return sc;
}
/* 봇·시간 초과의 놓기(알까기): 내 끝줄에서 2~7줄 안쪽, 다른 알과 붙지 않은 곳 중 아무 데나 (없으면 놓을 수 있는 아무 곳) */
function placePlan(A,seat,rnd,lv){
  rnd=rnd||Math.random;const far=lv===2?5:7,[sx,sz]=sideOfSeat(seat,A.np||2);   // 어려움은 가운데에서 더 멀리(끝줄에서 2~5줄)
  const all=[],good=[];
  for(let r=0;r<NL;r++)for(let c=0;c<NL;c++){
    if(!canPlace(A,seat,c,r))continue;all.push([c,r]);
    const dx=c-C0,dz=r-C0,dEdge=C0-(dx*sx+dz*sz),pp=Math.abs(dx*sz-dz*sx),[x,z]=gridXZ(c,r);
    if(dEdge>=2&&dEdge<=far&&pp<=C0-2&&!A.st.some(q=>!q.u&&!q.o&&Math.hypot(q.x-x,q.z-z)<PITCH*1.5))good.push([c,r]);
  }
  const L=good.length?good:all;
  return L.length?L[(rnd()*L.length)|0]:null;
}
const CNAME=['','흑','백','적','청'];   // 알 색 이름 (세·네 명일 때 적·청)

/* ---------- 봇 ----------
   쉬움(botPlan): 남은 내 알 중 하나를 골라 가까운 상대 알을 향해, 방향과 힘을 크게 흔들어서.
   보통·어려움(botThink): 가까운 내 알·상대 알 짝마다 몇 가지 방향(정면·비껴 치기)과 힘으로 물리를 미리 돌려 보고(simulate, 흔들림 없이)
   가장 좋은 수를 고른 뒤 실제로는 조금 흔들어 튕김. 한 번에 다 돌리면 방장 화면이 멈추므로 틱마다 조금씩(BOT_MS) */
const BLV=[null,{pairs:3,offs:[0,-1,1],pows:[0,.25],aim:.11,pw:.15,opw:.05},{pairs:6,offs:[0,-1,1,-2,2],pows:[0,.2,.45],aim:.015,pw:.04,opw:.012}];   // opw: 오목 모드 힘 흔들림 (굴려 세우는 거리는 힘의 2.5제곱이라 더 작게)
const BOT_MS=8;   // 틱(0.1초)마다 생각에 쓰는 시간
function shotCands(A,seat,lv){
  if(A.om)return omCands(A,seat,lv);
  const L=BLV[lv],mine=[],opp=[];A.st.forEach((q,i)=>{if(q.o||q.u)return;(q.s===seat?mine:opp).push(i)});
  const pairs=[];for(const i of mine)for(const j of opp){const a=A.st[i],b=A.st[j];pairs.push({i,j,d:Math.hypot(b.x-a.x,b.z-a.z)})}
  pairs.sort((x,y)=>x.d-y.d);
  const out=[];
  for(const pk of pairs.slice(0,L.pairs)){const a=A.st[pk.i],b=A.st[pk.j],base=Math.atan2(b.z-a.z,b.x-a.x),cut=Math.asin(Math.min(.95,SR*.7/Math.max(pk.d,2*SR)));
    const need=Math.min(1,Math.pow(Math.min(1,Math.sqrt(2*PHY.aB*(pk.d+1.2))/PHY.vmax),.8));
    for(const o of L.offs)for(const dp of L.pows)out.push({i:pk.i,a:base+o*cut,p:Math.max(.3,Math.min(1,need+dp))})}
  return out;
}
function shotScore(A,seat,c){   // 떨어뜨린 상대 알 +10, 떨어진 내 알 −12, 튕긴 알이 판 끝 가까이 멈추면 조금 −
  if(A.om)return omScore(A,seat,c);
  const v=speedOf(c.p),r=simulate(A.st,{i:c.i,vx:Math.cos(c.a)*v,vz:Math.sin(c.a)*v,p:c.p},()=>.5);
  let sc=0;r.fin.forEach((q,k)=>{const was=A.st[k];if(was.o||!q.o)return;sc+=was.s===seat?-12:10});
  const f=r.fin[c.i];if(!f.o)sc-=2*Math.max(0,Math.max(Math.abs(f.x),Math.abs(f.z))-(BW-.5));
  return sc;
}
function botThink(i,lv){   // 이번 차례의 생각을 이어서 함. 끝났으면 true
  const A=H.ak;let q=A.bq;
  if(!q||q.sid!==A.sid||q.pc!==(A.pc||0)||q.seat!==i){q=A.bq={sid:A.sid,pc:A.pc||0,seat:i,c:shotCands(A,i,lv),k:0,best:null,bs:-1e9}}
  const t0=Date.now();
  while(q.k<q.c.length&&Date.now()-t0<BOT_MS){const c=q.c[q.k++],sc=shotScore(A,i,c)+Math.random()*.3;if(sc>q.bs){q.bs=sc;q.best=c}}
  return q.k>=q.c.length;
}
function botPick(i,rnd){   // 난이도에 맞는 수 {i,a,p,fa} 또는 (오목 모드) 놓기 {pl:[c,r]}
  rnd=rnd||Math.random;
  const A=H.ak,lv=botLvA(H.players[i]),L=BLV[lv];
  if(!L)return botPlan(A,i,rnd);
  botThink(i,lv);const b=A.bq&&A.bq.best;if(!b)return botPlan(A,i,rnd);
  if(b.pl)return {pl:b.pl};
  const a=b.a+(rnd()*2-1)*L.aim,p=Math.max(A.om?PMIN:.3,Math.min(1,b.p*(1+(rnd()*2-1)*(A.om?L.opw:L.pw))));   // 오목 모드는 살살 굴려 세우기도 함
  return {i:b.i,a,p,fa:a+spreadOf(p)*jit(rnd()*1e6)};
}
/* 봇 난이도: 장기 모드는 쉬움만 */
const botLvA=p=>H.ak&&H.ak.jg?0:typeof botLv==='function'?botLv(p):1;
function botPlan(A,seat,rnd){
  rnd=rnd||Math.random;
  if(A.jg){   // 장기 모드 쉬움: 가까운 상대 알(장 떨어지면 패배면 상대 장을 더 자주) 쪽으로, 맞은 알이 판 끝까지 갈 만큼 무게를 따져 대충
    const mine=[],opp=[];A.st.forEach((q,i)=>{if(q.o)return;(q.s===seat?mine:opp).push(i)});
    if(!mine.length)return null;
    const pairs=[];
    for(const i of mine)for(const j of opp){const a=A.st[i],b=A.st[j];if(A.jl&&a.t===7&&rnd()<.8)continue;pairs.push({i,j,d:Math.hypot(b.x-a.x,b.z-a.z)*(A.jl&&b.t===7?.5:1)})}   // 내 장으로는 웬만하면 안 침
    if(!pairs.length)for(const i of mine)for(const j of opp){const a=A.st[i],b=A.st[j];pairs.push({i,j,d:Math.hypot(b.x-a.x,b.z-a.z)})}
    pairs.sort((x,y)=>x.d-y.d);
    const pk=pairs.length?pairs[Math.min(pairs.length-1,(rnd()*Math.min(3,pairs.length))|0)]:{i:mine[0],j:-1};
    const a=A.st[pk.i],b=pk.j>=0?A.st[pk.j]:{x:-a.x,z:-a.z,t:a.t},ga=geomOf(a.t),gb=geomOf(b.t),d=Math.hypot(b.x-a.x,b.z-a.z);
    const ang=Math.atan2(b.z-a.z,b.x-a.x)+(rnd()*2-1)*.12;
    const ex=Math.max(.6,Math.min(Math.abs(Math.abs(b.x)-BD.x),Math.abs(Math.abs(b.z)-BD.z))+.4);   // 맞은 알이 판 끝까지 갈 거리 (가까운 끝)
    const vt=Math.sqrt(2*PHY.aB*ex),vh=vt*(ga.m+gb.m)/((1+PHY.eJ)*ga.m),vs=Math.sqrt(vh*vh+2*PHY.aB*d);   // 정면으로 맞혀 넘겨줄 속도(무게·반발) + 맞히기까지 줄어드는 속도
    let p=Math.pow(Math.min(1,vs/(jShotK(a.t)*PHY.vmax)),.8)*(.75+rnd()*.5);
    p=Math.max(.2,Math.min(1,p));
    return {i:pk.i,a:ang,p,fa:ang+spreadOf(p)*jit(rnd()*1e6)};
  }
  if(A.om){   // 오목 모드 쉬움: 대부분 노릴 점 셋 중 하나에 놓고, 가끔 돌 하나를 노릴 점으로 대충 굴림
    const mine=A.st.map((q,i)=>i).filter(i=>{const q=A.st[i];return q.s===seat&&!q.o});
    if(!mine.length||rnd()<.85){const pl=omPlacePlan(A,seat,rnd,0);return pl?{pl}:null}
    const T=omTargets(A,seat,3),t=T[(rnd()*T.length)|0];if(!t)return null;
    const [x,z]=gridXZ(t.c,t.r),i=mine.slice().sort((a,b)=>Math.hypot(A.st[a].x-x,A.st[a].z-z)-Math.hypot(A.st[b].x-x,A.st[b].z-z))[0],q=A.st[i];
    const ang=Math.atan2(z-q.z,x-q.x)+(rnd()*2-1)*.1,p=Math.max(PMIN,Math.min(1,stopP(Math.hypot(x-q.x,z-q.z))*(.85+rnd()*.3)));
    return {i,a:ang,p,fa:ang+spreadOf(p)*jit(rnd()*1e6)};
  }
  const mine=[],opp=[];A.st.forEach((s,i)=>{if(s.o)return;(s.s===seat?mine:opp).push(i)});
  if(!mine.length)return null;
  const pairs=[];
  for(const i of mine)for(const j of opp){const a=A.st[i],b=A.st[j];pairs.push({i,j,d:Math.hypot(b.x-a.x,b.z-a.z)})}
  pairs.sort((x,y)=>x.d-y.d);
  const pk=pairs.length?pairs[Math.min(pairs.length-1,(rnd()*Math.min(3,pairs.length))|0)]:{i:mine[0],j:-1,d:1};
  const a=A.st[pk.i],b=pk.j>=0?A.st[pk.j]:{x:-a.x,z:-a.z};
  const ang=Math.atan2(b.z-a.z,b.x-a.x)+(rnd()*2-1)*.12;
  const need=Math.sqrt(2*PHY.aB*(pk.d+1.6));   // 맞은 알이 판 끝까지 갈 만큼 대충
  let p=Math.pow(Math.min(1,need/PHY.vmax),.8)*(.7+rnd()*.5);
  p=Math.max(.3,Math.min(1,p));
  return {i:pk.i,a:ang,p,fa:ang+spreadOf(p)*jit(rnd()*1e6)};   // a: 겨눈 방향(상대 화면의 손), fa: 손 떨림까지 더해 실제로 나가는 방향
}

/* ---------- 규칙 설명·방 설정 ---------- */
G.rulesHTML='<ol class="rules"><li><b>목표</b> : 내 알을 튕겨 다른 사람의 알을 모두 판 밖으로 떨어뜨립니다. 내 알이 모두 떨어지면 탈락하고, 마지막까지 남은 사람이 <b>승리</b>합니다. 2~4명이 할 수 있습니다</li><li><b>알 놓기</b> : 먼저 선(흑)이 내 쪽의 줄이 만나는 점에 알을 하나 놓고, 이어서 다른 사람이 차례로 하나씩 놓습니다. 이렇게 번갈아 모두 놓으면 알까기를 시작합니다. 2명이면 내 쪽 반(가운데 줄 제외), 3~4명이면 내 쪽 삼각형(대각선 제외)에만 놓을 수 있습니다. 누른 점에 미리 보기가 뜨고, [놓기]를 누르거나 같은 점을 한 번 더 누르면 놓습니다(설정의 ‘두 번 눌러 놓기’를 끄면 같은 점을 다시 누를 때 취소됩니다). 놓을 수 없는 곳에는 빨간 빗금이 보이고, 경계에는 차단기가 내려옵니다</li><li><b>진행</b> : 선부터 차례로 내 알 하나씩 튕깁니다. 판 밖으로 떨어진 알은 다시 쓰지 못하고, 내 알이 떨어져도 마찬가지입니다</li><li><b>튕기기</b> : 내 알을 누른 채 뒤로 당겼다 놓습니다. 알 뒤에 내 손이 나타나 당길수록 진해지고 세게 나갑니다. 끝까지 당기면 더 세지지 않습니다. 조금만 당기고 놓으면 취소됩니다</li><li><b>손 떨림</b> : 손은 당기는 동안 계속 떨리고, 세게 당길수록 크게 떨립니다. 놓는 순간 손이 가리키던 쪽으로 나가므로 살살 치면 거의 똑바로, 세게 치면 빗나가기 쉽습니다</li><li><b>뜨는 알</b> : 바둑알은 납작해서 세게 부딪히면 위로 튀어 오르기도 합니다</li><li><b>한 번 더</b> : 탁자 설정에서 켜면, 다른 사람의 알을 떨어뜨리고 튕긴 내 알이 판에 남았을 때 한 번 더 튕깁니다</li><li><b>끝</b> : 한 명만 남으면 끝납니다. 남은 사람들의 마지막 알이 함께 떨어지면 무승부입니다. 탈락한 순서가 늦을수록 순위가 높습니다</li><li><b>제한 시간</b> : 튕길 차례에 제한 시간이 지나면 차례가 넘어가고, 놓을 차례에 지나면 아무 자리에 대신 놓습니다. 연결이 끊겨도 시간은 흐르고, 45초 안에 돌아오지 않으면 탈주로 처리합니다. 항복·탈주한 사람의 알은 판에서 사라집니다</li><li><b>다음 판</b> : 결과 화면에서 바로 시작하면 진 사람(4명이면 가장 먼저 탈락한 사람)이 선(먼저 놓고 먼저 튕김)이 되고, 비기면 서로 바꿉니다. 첫 판은 탁자 설정의 선 플레이어(선택·무작위)로 정합니다</li><li><b>게임 모드</b> : 탁자 설정에서 바둑(위 규칙)·오목·장기 중에서 고릅니다</li><li><b>오목 모드</b> : 게임 모드에서 오목을 고르면(2명), 판 위에 내 돌 다섯 개를 한 줄로 먼저 세우는 사람이 <b>승리</b>합니다<ul><li><b>진행</b> : 선(흑)부터 번갈아, 내 차례에 <b>돌을 놓거나</b> 판 위의 내 돌 하나를 <b>튕깁니다</b>. 돌은 얼마든지 놓을 수 있고, 판 어디든 다른 돌과 겹치지 않는 점이면 놓을 수 있습니다. 빈 점을 누르면 미리 보기가 뜨고 [놓기]를 누르거나 같은 점을 한 번 더 누르면 놓고, 내 돌을 누른 채 당겼다 놓으면 튕깁니다</li><li><b>떨어진 돌</b> : 판에서 떨어진 돌은 그냥 사라집니다. 가져오는 일은 없습니다</li><li><b>판정</b> : 돌이 모두 멈춘 뒤, 줄이 만나는 점마다 그 점을 가리는(반 칸 안에서 가장 가까운) 돌이 그 점에 있다고 봅니다. 가로·세로·대각선으로 다섯 개 이상 이어지면 오목입니다. 상대가 튕겨서 생긴 내 오목도 내 승리입니다</li><li><b>한 번 더</b> : 탁자 설정의 ‘떨어뜨리면 한 번 더’를 켜면, 상대 돌을 떨어뜨렸을 때 한 번 더 둡니다(튕긴 돌이 함께 떨어져도)</li><li><b>동시 오목</b> : 두 사람의 오목이 함께 생기면 튕긴 사람이 집니다</li><li><b>제한 시간</b> : 시간이 지나면 차례를 넘깁니다</li><li><b>무승부</b> : 돌을 놓을 수 있는 점이 하나도 없으면 무승부입니다</li></ul></li><li><b>장기 모드</b> : 게임 모드에서 장기를 고르면(2명), 장기판에 장기 상차림(마상마상)으로 알 16개씩 놓고 시작합니다. 선이 초(초록), 다음 사람이 한(빨강)입니다<ul><li><b>알 크기·무게</b> : 장이 가장 크고, 차·포·마·상, 사·졸 순으로 작습니다. 무게는 크기(부피)에 비례해서, 같은 힘으로 튕기면 무거운 알은 느리게 짧게 나가고 가벼운 알은 빠르게 멀리 나갑니다. 무거운 알은 맞아도 잘 밀리지 않습니다</li><li><b>도는 알</b> : 비껴 부딪히면 알이 돕니다(나가는 방향은 그대로)</li><li><b>끝</b> : 상대 알을 모두 떨어뜨리면 승리합니다. 탁자 설정의 ‘장 떨어지면 패배’를 켜면 장이 먼저 떨어진 쪽이 지고, 두 장이 같은 순간에 떨어지면 튕긴 사람이 집니다</li><li><b>놓기</b> : 알을 놓는 단계는 없고 바로 튕깁니다. 알 개수는 정하지 않습니다</li></ul></li></ol>';
G.modeDesc=['마지막까지 남은 사람이 이김','마지막까지 남은 사람이 이김'];
G.defaults={max:2,turn:30,stones:5,again:1,pickfirst:0,omok:0,md:0,jang:0};
/* 방 설정: 게임 모드(바둑·오목·장기)·알 개수·제한 시간은 설정 판자에서 G.boardSet으로 직접 그림(lever). 알 개수는 바둑 모드에만 */
const MD_NAME=['바둑','오목','장기'];
G.roomSet=[
  {k:'md',label:'게임 모드',unit:'',lo:0,hi:2,step:1,lever:1,desc:'바둑: 바둑알로 상대 알을 모두 떨어뜨리면 이깁니다(2~4명). 오목: 돌을 놓거나 튕겨 오목을 먼저 만들면 이깁니다(2명). 장기: 장기판에 장기 상차림으로 시작하고, 알마다 크기·무게가 다릅니다(2명)'},
  {k:'stones',label:'알 개수',unit:'개',lo:1,hi:10,step:1,lever:1,desc:'한 사람이 가지고 시작하는 알 수입니다 (바둑 모드)'},
  {k:'turn',label:'제한 시간',unit:'초',lo:10,hi:120,step:5,lever:1,desc:'시간이 지나면 차례가 넘어갑니다'}];
G.ruleSet=[
  {k:'omok',label:'오목 모드',hidden:true,desc:''},   // 예전 설정(오목 스위치)을 읽으려고 남겨 둠. 지금은 md로 정함
  {k:'again',label:'떨어뜨리면 한 번 더',desc:'다른 사람의 알을 떨어뜨리고 튕긴 내 알이 판에 남으면 한 번 더 튕깁니다 (오목 모드는 상대 돌을 떨어뜨리기만 하면)'},
  {k:'jang',label:'장 떨어지면 패배',desc:'장기 모드: 장이 먼저 떨어진 쪽이 집니다. 끄면 알이 모두 떨어진 쪽이 집니다'},
  {k:'pickfirst',pick:1,label:'선 플레이어',desc:'선택: 방장이 대기실에서 선(먼저 튕길 사람)을 고릅니다. 무작위: 랜덤으로 정합니다'}];
const nStones=c=>Math.max(1,Math.min(10,Math.round(+c.stones||5)));
const ruleOf=k=>G.ruleSet.find(d=>d.k===k);
/* 설정 판자 항목: 게임 모드 → (바둑) 알 개수 → 제한 시간 → 한 번 더 → (장기) 장 떨어지면 패배 → 선 플레이어 */
G.boardSet=c=>{
  const md=mdOf(c),rs=roomSetOf(G,c),num=k=>{const d=rs.find(x=>x.k===k),v=+(c[k]??G.defaults[k]);return {kind:'num',...d,v,diff:false}};
  const rule=k=>{const d=ruleOf(k);return {...rbRuleItem(d,c),diff:(+c[k]?1:0)!==(+G.defaults[k]?1:0)}};
  return [{kind:'choice',k:'md',label:'게임 모드',opts:MD_NAME,desc:rs.find(x=>x.k==='md').desc,v:md,diff:md!==0,act:o=>'ak:md:'+o},
    ...(md===0?[num('stones')]:[]),num('turn'),rule('again'),...(md===2?[rule('jang')]:[]),rule('pickfirst')];
};
/* WebGL이 없을 때의 탁자 설정 창 (2D): 게임 모드 버튼 셋 + 숫자 칸 + 스위치 */
G.settingsHTML=(c,{stepRow})=>{
  const md=mdOf(c),rs=roomSetOf(G,c),row=k=>{const d=rs.find(x=>x.k===k);return d?stepRow(d):''};
  const tog=k=>{const d=ruleOf(k),on=!!(+c[k]);return `<div class="stp tg"><div class="stp-t"><b>${d.label}</b><small>${d.desc}</small></div><div class="stp-c"><button type="button" class="sw${on?' on':''}" role="switch" aria-checked="${on}" aria-label="${d.label}" data-act="tog:${k}"><i></i></button></div></div>`};
  const mrow=`<div class="rs-seg"><div class="rs-h"><b>게임 모드</b><small>${rs.find(x=>x.k==='md').desc}</small></div><div class="segrow" role="radiogroup" aria-label="게임 모드">${MD_NAME.map((t,v)=>`<button class="btn ${md===v?'btn-play':'btn-sub'}" type="button" role="radio" aria-checked="${md===v}" data-act="ak:md:${v}">${t}</button>`).join('')}</div></div>`;
  return `<div class="rs-grid">${['max','spec'].map(row).join('')}</div>${mrow}<div class="rs-grid">${(md===0?['stones','turn']:['turn']).map(row).join('')}</div><div class="rulehead">게임 규칙</div><div class="rs-grid tgs">${tog('again')}${md===2?tog('jang'):''}${pickRowHTML(ruleOf('pickfirst'),c)}</div>`;
};
/* 게임 모드 바꾸기 (방장, 대기실): 오목·장기는 2명까지라 앉은 사람이 많으면 금지 소리 */
G.panelAct=a=>{
  if(!a.startsWith('ak:'))return false;
  if(!(mode==='host'&&H&&H.phase==='wait'))return true;
  const p=a.split(':'),v=+p[2];
  if(p[1]!=='md'||!(v>=0&&v<=2&&Number.isInteger(v)))return true;
  if(mdOf(H.cfg)===v){lastPanelHtml='';mark();return true}
  const nc=G.fixCfg({...H.cfg,md:v,omok:v===1?1:0},H.members.length,true);
  if(!nc){sfx('no');lastPanelHtml='';mark();return true}
  H.cfg=nc;saveRoomCfg(H.cfg);sfx('tick');lastPanelHtml='';mark();return true;
};
const cfgModeTxt=c=>{const md=mdOf(c);return md===1?'오목 모드':md===2?`장기 모드${+c.jang?' · 장 떨어지면 패배':''}`:`알 ${nStones(c)}개`};
G.cfgChips=c=>`<span class="chip">${mdOf(c)?`<b>${cfgModeTxt(c)}</b>`:`알 <b>${nStones(c)}개</b>`}</span><span class="chip">제한 시간 <b>${+c.turn||30}초</b></span><span class="chip">한 번 더 <b>${+c.again?'켜기':'끄기'}</b></span><span class="chip">선 <b>${+c.pickfirst?'선택':'무작위'}</b></span>`;
G.cfgSum=c=>`${cfgModeTxt(c)} · 제한 시간 ${+c.turn||30}초 · 한 번 더 ${+c.again?'켜기':'끄기'} · 선 ${+c.pickfirst?'선택':'무작위'}`;
G.roomSub=()=>'2~4명 보드게임';
G.pubExtra=()=>({});
G.cardInfo=(c,nowN)=>`<p class="cardinfo">${mdOf(c)===1?'오목 모드는 두 명이 하는 게임입니다.':mdOf(c)===2?'장기 모드는 두 명이 하는 게임입니다.':'두~네 명이 하는 게임입니다.'}</p>`;
G.rankTitle=()=>'';
G.finLabel=()=>'';
G.noEmotes=[];
G.keys={};
G.keyActions=[];
/* 이 게임에는 카드가 없음 (공통 코드가 부르는 자리만 채움) */
G.cardHTML=()=>'';G.drawFace=()=>{};G.cmpCard=()=>0;G.labelOf=()=>'';

/* ---------- 방장 엔진 (규칙 처리) ---------- */
const other=i=>1-i;   // 두 명일 때 상대 (오목 모드·두 명 판)
const aliveOf=(A,seat)=>A.st.filter(s=>s.s===seat&&!s.o).length;
/* 다음에 튕길 사람: seat 다음부터 시계 방향으로 아직 알이 남은 사람 (아무도 없으면 seat) */
function nextAlive(A,seat){for(let k=1;k<=A.np;k++){const j=(seat+k)%A.np;if(!H.players[j].finished&&aliveOf(A,j)>0)return j}return seat}
const turnAfter=(A,seat)=>A.om?other(seat):nextAlive(A,seat);
function sameNames(a,b){return a.length===b.length&&new Set(a).size===a.length&&a.every(x=>b.includes(x))}
/* 먼저 튕길 사람: 결과 화면에서 바로 시작하면 진 사람(비기면 지난 판 선이 아닌 사람, 세·네 명이면 가장 먼저 탈락한 사람), 아니면 공통 firstSeat (선택이면 방장이 고른 사람, 아니면 랜덤) */
function pickFirst(again){
  const np=Math.min(H.players.length,mdOf(H.cfg)?OM_MAX:4),ns=H.players.slice(0,np).map(p=>p.name),L=H.akLast;
  if(again&&L&&L.ns&&sameNames(ns,L.ns)){
    if(np===2){
      if(L.w)return ns.indexOf(L.w)===0?1:0;
      return ns.indexOf(L.A)===0?1:0;
    }
    const k=ns.indexOf(L.l);if(k>=0)return k;
  }
  return typeof firstSeat==='function'?firstSeat(np):(Math.random()*np|0);
}
function startTurn(i,ph){
  const A=H.ak,t=clock();
  A.ph=ph||'aim';A.aim=null;A.bp=null;H.turn=i;H.graceUntil=0;
  A.hold=A.ph==='place'&&H.players[i]&&H.players[i].bot?i:-1;   // 놓을 알을 집어 듦 (봇은 차례가 오면 바로)
  H.deadline=t+(+H.cfg.turn||30)*1000;
  H.botActAt=H.players[i]&&H.players[i].bot?t+rand(700,1400):0;
  mark();
}
/* 판 끝내기: w 이긴 자리(-1이면 남은 사람 모두 무승부), why ''·'surrender'·'desert'·'both'(동시 오목)·'full'(오목 모드 놓을 점 없음), ln 이긴 오목 줄 [[c,r]…], lose 항복·탈주한 자리.
   이미 탈락한 사람의 순위는 그대로이고, 아직 남은 사람은 이긴 사람 1위·나머지 2위(무승부면 모두 1위) */
function finishGame(w,why,ln,lose){
  flushLog();   // 굴러가는 중에 항복·탈주하면 그 튕기기 기록을 먼저
  const A=H.ak,np=A.np,sur=why==='surrender'||why==='desert';
  A.res={w,why:why||''};if(ln)A.res.ln=ln;A.ph='aim';A.aim=null;A.bp=null;
  const live=H.players.slice(0,np).map((p,i)=>i).filter(i=>!H.players[i].finished);
  for(const i of live){const p=H.players[i];p.finished=true;p.hand=[];p.rank=w<0||i===w?1:2}
  if(w>=0){
    const pw=H.players[w],pl=lose!=null?H.players[lose]:null;
    if(pl&&sur)pl.surrendered=true;
    addLog(sur&&pl?`${pl.name} ${why==='desert'?'탈주':'항복'}! ${pw.name} 승리`:why==='jang'&&pl?`${pl.name}의 장이 떨어졌습니다! ${pw.name} 승리`:why==='both'?`두 사람의 오목이 함께 생겨 튕긴 ${H.players[other(w)].name} 패배! ${pw.name} 승리`:A.om?`${pw.name} 오목! 승리`:`${pw.name} 승리!`,sur?'lie':'fin');
  }else addLog(why==='full'?'돌을 놓을 점이 없어 무승부입니다.':'무승부입니다.','sys');
  let l=-1,mr=0;H.players.slice(0,np).forEach((p,i)=>{if(p.rank>mr){mr=p.rank;l=i}});
  H.akLast={ns:H.players.slice(0,np).map(p=>p.name),w:w>=0?H.players[w].name:'',A:H.players[A.A].name,l:l>=0&&mr>1?H.players[l].name:''};
  H.phase='over';H.botActAt=0;mark();
  H.players.forEach((p,i)=>{if(p.bot&&i<np&&Math.random()<.5)botEmote(i,'gg',800+Math.random()*1600)});
}
/* 알이 모두 떨어지거나 항복·탈주한 사람들(같은 순위)을 탈락시킴. 남은 사람이 1명이면 그 사람이 이겨 판이 끝나고, 모두 한꺼번에 탈락하면 무승부. 판이 끝났으면 true */
function eliminate(list,why){
  const A=H.ak,np=A.np,sur=why==='surrender'||why==='desert';
  const live=H.players.slice(0,np).map((p,i)=>i).filter(i=>!H.players[i].finished),rest=live.filter(i=>!list.includes(i)),R=rest.length;
  if(R===0){finishGame(-1,why);return true}
  const rank=R+1;
  for(const i of list){const p=H.players[i];p.finished=true;p.hand=[];p.rank=rank;
    if(sur)p.surrendered=true;
    if(R>1){
      if(sur)A.st.forEach(q=>{if(q.s===i&&!q.o){q.o=1;q.g=1;q.y=-9}});   // 판이 이어지면 항복·탈주한 사람의 알은 판에서 치움
      addLog(sur?`${p.name} ${why==='desert'?'탈주':'항복'}! ${rank}위`:`${p.name} 탈락! ${rank}위`,sur?'lie':'fin');
    }}
  if(R===1){finishGame(rest[0],why,null,sur?list[0]:null);return true}
  return false;
}
/* 튕기기: 물리를 끝까지 계산해 결과 자리와 자취를 담아 둠. 연출이 끝나면(tick) 다음 차례 */
function doShot(seat,i,a,p,j){   // j: 그중 손 떨림 몫 (장기 알 처음 회전, 없으면 0)
  const A=H.ak,s=A.st[i];
  if(!s||s.s!==seat||s.o||s.u||!Number.isFinite(a)||!Number.isFinite(p))return false;
  p=Math.max(PMIN,Math.min(1,p));
  useBoard(A.jg);
  const v=shotSpeed(s,p),before=Array.from({length:A.np},(_,k)=>aliveOf(A,k));
  const r=simulate(simSt(A.st),{i,vx:Math.cos(a)*v,vz:Math.sin(a)*v,p,wy:shotSpin(s,v,j)});
  A.st=r.fin.map((q,k)=>{const o=A.st[k];if(o.u)return o;const n={x:q.x,y:q.y,z:q.z,s:q.s,o:o.o||q.o?1:0,g:o.g||q.g?1:0};if(o.t){n.t=o.t;n.w=q.w}return n});
  const after=before.map((_,k)=>aliveOf(A,k)),kn=before.reduce((n,b,k)=>k===seat?n:n+b-after[k],0),own=before[seat]-after[seat];   // 다른 사람 알 떨어진 수, 내 알 떨어진 수
  A.cnt++;A.sid++;
  A.sh={id:A.sid,by:seat,i,a,p,tr:r.tr,k:r.k,nf:r.nf,ev:r.ev,of:r.of,dur:r.dur,t0:clock()};
  A.ph='roll';A.until=clock()+r.dur+450;A.aim=null;A.bp=null;H.botActAt=0;
  A.ag=+H.cfg.again&&kn>0&&(A.om||!A.st[i].o)?1:0;   // 한 번 더: 다른 사람 알을 떨어뜨리고 튕긴 알이 판에 남음 (오목 모드는 상대 돌을 떨어뜨리기만 하면)
  A.next=A.ag?seat:turnAfter(A,seat);
  H.seatNote[seat]='';
  const nm=H.players[seat].name,parts=[];
  if(A.om){if(kn)parts.push(`상대 돌 ${kn}개 떨어뜨림`);if(own)parts.push(`내 돌 ${own}개 떨어짐`)}
  else{if(kn)parts.push(`${kn}알 까기`);if(own)parts.push(`내 알 ${own}개 떨어짐`)}
  if(A.jg)for(const q of A.st.filter((q,k)=>q.t===7&&q.o&&r.of[k]!=null))parts.push(`${CNAME_JG[A.co[q.s]]} 장 떨어짐`);
  A.lg=[`${A.cnt}. ${nm} ${parts.length?parts.join(' · '):A.om?'튕김':'빗나감'}`,kn?'fin':''];   // 기록은 알이 다 멈춘 뒤에 (굴러가는 동안 영수증이 결과를 먼저 알려 주지 않게)
  mark();
  return true;
}
/* 놓기: 선부터 한 알씩 번갈아(시계 방향) 내 쪽에 놓음. 다 놓으면 선이 먼저 튕김. 오목 모드는 판 어디나 놓고 차례를 넘김 */
const unplaced=(A,seat)=>A.st.filter(q=>q.s===seat&&q.u).length;
function nextUnplaced(A,seat){for(let k=1;k<=A.np;k++){const j=(seat+k)%A.np;if(unplaced(A,j))return j}return -1}
function doPlace(seat,c,r){
  const A=H.ak;
  if(A.om){
    if(A.ph!=='aim'||!canPlace(A,seat,c,r))return false;
    const [x,z]=gridXZ(c,r);A.st.push({x,y:TOP+SH,z,s:seat,o:0,g:0});A.pc=(A.pc||0)+1;A.cnt++;
    H.seatNote[seat]='';A.aim=null;A.bp=null;
    addLog(`${A.cnt}. ${H.players[seat].name} 놓음`);
    const ln=omFive(omGrid(A.st),seat);
    if(ln){finishGame(seat,'',ln);return true}
    if(omFull(A)){finishGame(-1,'full');return true}
    startTurn(other(seat));return true;
  }
  if(A.ph!=='place'||!canPlace(A,seat,c,r))return false;
  const i=A.st.findIndex(q=>q.s===seat&&q.u);if(i<0)return false;
  const [x,z]=gridXZ(c,r);A.st[i]={x,y:TOP+SH,z,s:seat,o:0,g:0};A.pc=(A.pc||0)+1;
  H.seatNote[seat]='';
  const nx=nextUnplaced(A,seat);
  if(nx<0){addLog('알을 모두 놓았습니다. 알까기를 시작합니다.','sys');startTurn(A.A);return true}
  startTurn(nx,'place');
  return true;
}
function autoPlace(i){
  const p=H.players[i],b=placePlan(H.ak,i,null,p&&p.bot&&typeof botLv==='function'?botLv(p):1);
  if(!b||!doPlace(i,b[0],b[1])){const A=H.ak;A.st.forEach(q=>{if(q.u&&q.s===i){q.u=0;q.o=1;q.g=1}});resumeAfterOut(i)}   // 놓을 곳이 없으면(생기지 않음) 남은 알은 빼고 이어감
}
function flushLog(){const A=H.ak;if(A&&A.lg){addLog(A.lg[0],A.lg[1]);A.lg=null}}
/* 차례인 사람이 탈락·항복해서 차례가 비면 다음 사람으로 (놓기 중이면 다음에 놓을 사람, 다 놓았으면 선부터 튕김) */
function resumeAfterOut(seat){
  const A=H.ak;if(!A||H.phase!=='play'||H.turn!==seat||A.ph==='roll')return;
  if(A.ph==='place'){const nx=nextUnplaced(A,seat);if(nx>=0){startTurn(nx,'place');return}
    addLog('알을 모두 놓았습니다. 알까기를 시작합니다.','sys');startTurn(H.players[A.A].finished?nextAlive(A,A.A):A.A);return}
  startTurn(nextAlive(A,seat));
}
function afterShot(){
  flushLog();
  const A=H.ak,by=A.sh?A.sh.by:A.next;
  if(A.om){
    const g=omGrid(A.st),f=[omFive(g,0),omFive(g,1)];
    if(f[0]&&f[1]){finishGame(other(by),'both',f[other(by)]);return}   // 동시 오목: 튕긴 사람이 짐
    if(f[0]||f[1]){const w=f[0]?0:1;finishGame(w,'',f[w]);return}
    if(omFull(A)){finishGame(-1,'full');return}
    startTurn(A.next);return;
  }
  if(A.jg&&A.jl){   // 장 떨어지면 패배: 이번에 떨어진 장 중 먼저 떨어진 쪽이 짐 (같은 순간이면 튕긴 사람)
    const of=(A.sh&&A.sh.of)||{},fell=[];A.st.forEach((q,k)=>{if(q.t===7&&q.o)fell.push({s:q.s,at:of[k]!=null?of[k]:-1})});
    if(fell.length){fell.sort((x,y)=>x.at-y.at);const lose=fell.length>1&&fell[0].at===fell[1].at?by:fell[0].s;finishGame(other(lose),'jang',null,lose);return}
  }
  const out=[];for(let s=0;s<A.np;s++)if(!H.players[s].finished&&aliveOf(A,s)===0)out.push(s);
  if(out.length&&eliminate(out,''))return;
  A.next=A.ag&&!H.players[by].finished?by:nextAlive(A,by);
  startTurn(A.next);
}
function doSurrender(seat){
  const A=H.ak;
  if(H.phase!=='play'||!A||seat<0||seat>=A.np||H.players[seat].finished)return;
  flushLog();
  const why=H.players[seat].deserter?'desert':'surrender';
  A.st.forEach(q=>{if(q.s===seat&&q.u){q.u=0;q.o=1;q.g=1;q.y=-9}});   // 아직 못 놓은 알은 치움
  if(eliminate([seat],why))return;
  resumeAfterOut(seat);
}
/* 제한 시간이 지나면 차례를 넘김. 봇(과 탈주해서 봇이 맡은 자리)은 바로 둠. 연결이 끊겨 기다리는 사람도 다른 사람과 똑같이 넘어감 */
function timeout(){
  const i=H.turn,p=H.players[i],A=H.ak;
  if(A.ph==='place'){if(!(p.bot&&!awayHuman(p)))addLog(`${p.name} 시간 초과로 아무 자리에 놓습니다.`,'sys');autoPlace(i);return}   // 놓기는 넘기지 않고 대신 놓음
  if(p.bot&&!awayHuman(p)){botShootNow(i);return}
  addLog(`${p.name} 시간 초과로 차례를 넘깁니다.`,'sys');
  startTurn(turnAfter(A,i));
}
function botDo(i,b){   // 봇의 수를 둠: 놓기({pl}) 또는 튕기기. 못 두면 false
  if(!b)return false;
  if(b.pl)return doPlace(i,b.pl[0],b.pl[1]);
  return doShot(i,b.i,b.fa,b.p,b.fa-b.a);
}
function botShootNow(i){const A=H.ak;if(!botDo(i,A.bp||botPick(i)))startTurn(turnAfter(A,i))}
/* 봇: 알을 고르고 천천히 당긴 뒤(상대 화면에도 손이 보임) 놓음. 오목 모드에서 놓기로 정했으면 바로 놓음 */
function botStep(i,t){
  const A=H.ak;
  if(!A.bp){const lv=botLvA(H.players[i]);if(BLV[lv]&&!botThink(i,lv)&&t<H.botActAt+4000)return;   // 다 생각할 때까지 (오래 걸리면 그때까지 찾은 것으로)
    const b=botPick(i);if(!b){startTurn(turnAfter(A,i));return}
    if(b.pl){if(!botDo(i,b))startTurn(turnAfter(A,i));return}
    A.bp={...b,t0:t,dur:Math.round(rand(650,1150))};A.aim={s:i,i:b.i,a:b.a,p:0,w:0};mark();return}
  const k=(t-A.bp.t0)/A.bp.dur;
  if(k<1){const e=1-Math.pow(1-Math.max(0,k),2),np=Math.round(A.bp.p*e*1000)/1000;if(!A.aim||A.aim.p!==np){A.aim={s:i,i:A.bp.i,a:A.bp.a,p:np,w:0};mark()}return}
  const b=A.bp;A.bp=null;
  if(!doShot(i,b.i,b.fa,b.p,b.fa-b.a))startTurn(turnAfter(A,i));
}
/* 테스트(tests/engine.test.js)에서 직접 부르는 내부 함수 */
G._test={geomOf,JM,jShotK,shotSpin,SPREAD,octHit,octVerts,JSET,jgSetup,useBoard,BD,shotSpeed,mdOf,omGrid,omFive,omThreats,omLines,omTargets,omPlacePlan,omCands,omScore,omFull,simulate,reserves,shotCands,shotScore,botPick,placePlan,canPlace,gridXZ,botPlan,speedOf,groundAt,doShot,doSurrender,timeout,pickFirst,aliveOf,sideOfSeat,ownPt,freeAt,PHY,TOP,SH,SR,BW,PITCH,NL};
G.engine={
  /* 게임 시작: 공통 코드가 H.players를 만든 뒤 부름 */
  start(){
    const again=H.phase==='over',md=mdOf(H.cfg),om=md===1?1:0,jg=md===2?1:0,np=Math.min(H.players.length,md?OM_MAX:4),n=om?0:jg?JSET.length:nStones(H.cfg);
    Object.assign(H,{phase:'play',log:[],seatNote:{},field:[],last:null,reveal:null,shouts:[],pending:null,rankNext:1,known:{}});
    H.players.forEach((p,i)=>{
      p.finished=false;p.rank=null;p.surrendered=false;
      if(i<np)p.hand=[0];else{p.hand=[];p.finished=true;p.rank=i+1}   // 자리가 모자라면 구경만 함 (보통은 최대 인원이 맞춰져 있어 생기지 않음)
    });
    const Af=pickFirst(again);
    H.akGid=(H.akGid||0)+1;
    const co=Array(np).fill(0);co[Af]=1;for(let k=1,c=2;k<np;k++)co[(Af+k)%np]=c++;   // 선이 흑(1), 이어서 시계 방향으로 백(2)·적(3)·청(4)
    H.ak={gid:H.akGid,n,np,om,jg,jl:jg&&+H.cfg.jang?1:0,A:Af,co,st:om?[]:jg?jgSetup():reserves(n,np),ph:om||jg?'aim':'place',pc:0,sid:0,sh:null,aim:null,bp:null,res:null,cnt:0,next:Af,until:0,ag:0};
    useBoard(jg);
    addLog(om?`${H.players[Af].name}님이 흑으로 먼저 둡니다. (오목 모드)`:jg?`${H.players[Af].name}님이 초로 먼저 튕깁니다. (장기 모드${H.ak.jl?', 장 떨어지면 패배':''})`:np>2?`${H.players[Af].name}님이 흑으로 먼저 놓고 먼저 튕깁니다. (알 ${n}개씩 차례로 놓기)`:`${H.players[Af].name}님이 흑으로 먼저 놓고 먼저 튕깁니다. (알 ${n}개씩 번갈아 놓기)`,'sys');
    startTurn(Af,om||jg?'aim':'place');
  },
  act(seat,a){
    if(a.t==='surrender'){doSurrender(seat);return}
    const A=H.ak;
    if(!A||H.phase!=='play'||seat<0||seat>=A.np||H.turn!==seat)return;
    if(a.t==='place'){doPlace(seat,a.c,a.r);return}
    if(a.t==='hold'){if(A.ph==='place'){const h=a.on?seat:-1;if(A.hold!==h){A.hold=h;mark()}}return}
    if(A.ph!=='aim')return;
    if(a.t==='aim'){   // 당기는 중 (화살표를 상대에게도 보여 줌). i<0이면 내려놓음
      if(!Number.isInteger(a.i)||a.i<0){if(A.aim){A.aim=null;mark()}return}
      const s=A.st[a.i];if(!s||s.s!==seat||s.o||s.u||!Number.isFinite(+a.a)||!Number.isFinite(+a.p))return;
      A.aim={s:seat,i:a.i,a:Math.round(+a.a*1000)/1000,p:Math.round(Math.max(0,Math.min(1,+a.p))*1000)/1000,w:a.w?1:0};mark();
    }else if(a.t==='shoot'){
      if(!Number.isInteger(a.i))return;
      doShot(seat,a.i,+a.a,+a.p,+a.j||0);
    }
  },
  tick(t){
    const A=H.ak;
    if(!A||H.phase!=='play')return;
    useBoard(A.jg);
    if(A.ph==='roll'){if(t>=A.until)afterShot();return}
    const cur=H.players[H.turn];if(!cur)return;
    if(t>=H.deadline){timeout();return}
    if(cur.bot&&H.botActAt&&A.ph==='aim'&&!A.bp&&t<H.botActAt&&!(cur.away&&t<cur.awayAt+AWAY_WAIT)){const lv=botLvA(cur);if(BLV[lv])botThink(H.turn,lv)}   // 당기기 전 쉬는 동안 미리 생각
    if(cur.bot&&H.botActAt&&t>=H.botActAt&&!(cur.away&&t<cur.awayAt+AWAY_WAIT)){if(A.ph==='place')autoPlace(H.turn);else botStep(H.turn,t)}
  },
  snap(s,you,t){
    const A=H.ak,r3=v=>Math.round(v*1000)/1000;
    const sh=A.sh?{id:A.sh.id,by:A.sh.by,i:A.sh.i,a:Math.round(A.sh.a*1000)/1000,p:Math.round(A.sh.p*1000)/1000,age:Math.max(0,Math.round(t-A.sh.t0))}:null;
    if(sh&&sh.age<A.sh.dur+4000){sh.tr=A.sh.tr;sh.k=A.sh.k;sh.nf=A.sh.nf;sh.ev=A.sh.ev;sh.of=A.sh.of;sh.dur=A.sh.dur}   // 자취는 연출 중인 동안만 보냄 (가볍게)
    s.ak={gid:A.gid,n:A.n,np:A.np,A:A.A,co:A.co.slice(),st:A.st.map(q=>q.t?[r3(q.x),r3(q.y),r3(q.z),q.s,q.o?1:0,q.g?1:0,q.u?1:0,q.t,r3(q.w||0)]:[r3(q.x),r3(q.y),r3(q.z),q.s,q.o?1:0,q.g?1:0,q.u?1:0]),jg:A.jg?1:0,jl:A.jl?1:0,ph:A.ph,sid:A.sid,sh,aim:A.aim?{...A.aim}:null,res:A.res?{...A.res,ln:A.res.ln?A.res.ln.map(v=>v.slice()):undefined}:null,cnt:A.cnt,ag:+H.cfg.again?1:0,om:A.om?1:0,hd:A.ph==='place'?(A.hold??-1):-1};
    s.gr=0;
    if(H.phase==='play'&&(A.ph==='aim'||A.ph==='place'))s.dl=Math.max(0,Math.round(H.deadline-t));
    else{s.dl=0;if(H.phase==='play')delete s.t}   // 알이 굴러가는 동안은 아무 차례도 아님 (시간 표시 없음)
  },
  restore(ms){const A=H.ak;if(!A||!ms)return;if(A.until)A.until+=ms;if(A.sh)A.sh.t0+=ms;if(A.bp)A.bp.t0+=ms},   // 시작 연출 동안·방장이 꺼져 있던 동안은 멈춤
  emoPhase:ph=>ph==='play'||ph==='over'
};

/* ---------- 화면 (모든 참가자) ----------
   3D: 공통 테이블 가운데 19줄 바둑판 + 알, 내 쪽에서 비스듬히 내려다보는 자기 카메라. WebGL이 없으면 위에서 본 2D 판(SVG)
   튕기기: 내 알(가까이 누른 곳의 알)을 누른 채 당기면 알 뒤에 화살표. 끝까지 당기면 흔들리고 더 길어지지 않음 → 놓으면 튕김 */
let OS=null,drag=null,elAk=null,elSvg=null,elMain=null,elBar=null,elBarMe=null,elHint=null,lastBar='',lastHint='',msg='',msgUntil=0,msgTimer=null;
const MAXD=1.25;   // 끝까지 당긴 거리 (월드). 넘게 당겨도 더 세지지 않음
const SEND_MS=90;   // 당기는 중 화살표를 방장에게 보내는 간격
const myTurnNow=()=>!!(V&&V.ak&&V.st==='play'&&myReady()&&OS&&OS.ph==='aim');
const myPlaceNow=()=>!!(V&&V.ak&&V.st==='play'&&OS&&((OS.ph==='place'&&V.t===myIdx()&&!introWait())||(OS.om&&myTurnNow()&&!introWait())));   // 오목 모드는 튕길 차례에도 놓을 수 있음
const STC=[null,{h:0x26262a,f:'#232326',s:'#0c0c0e',rim:.35,css:'blk'},{h:0xf4efe3,f:'#f7f2e8',s:'#8c7a5b',rim:.12,css:'wht'},{h:0xd9473a,f:'#d9473a',s:'#7a1d14',rim:.22,css:'red'},{h:0x3f7fe0,f:'#3f7fe0',s:'#173f7a',rim:.22,css:'blu'}];   // 알 색 1흑 2백 3적 4청
const stC=c=>STC[c]||STC[2];
const npOf=()=>OS?OS.np||2:2;
const mySide=()=>sideOfSeat(Math.max(0,myIdx()),npOf());   // 내 쪽 방향 [sx,sz] (내 쪽이 화면 아래). 관전은 0번 자리 쪽
const rotXZ=(x,z)=>{const [sx,sz]=mySide();return [sz*x-sx*z,sx*x+sz*z]};   // 월드 → 화면(내 쪽이 아래)
const unrotXZ=(X,Y)=>{const [sx,sz]=mySide();return [sz*X+sx*Y,-sx*X+sz*Y]};   // 화면 → 월드
const sideAng=()=>{const [sx,sz]=mySide();return Math.atan2(sx,sz)};   // 월드 방향 각도에 더하면 화면 각도
function buildS(o){
  useBoard(o.jg);
  return {gid:o.gid,n:o.n,np:o.np||2,A:o.A,co:o.co,st:o.st.map(a=>{const q={x:a[0],y:a[1],z:a[2],s:a[3],o:a[4],g:a[5],u:a[6]};if(a[7]){q.t=a[7];q.w=a[8]||0}return q}),ph:o.ph,sid:o.sid,sh:o.sh,aim:o.aim,res:o.res,cnt:o.cnt,ag:o.ag,om:o.om||0,jg:o.jg||0,jl:o.jl||0,hd:o.hd??-1};
}
/* ----- 장기 모드 그림: 알 윗면(상아빛 + 팔각 테 + 한자, 초 청록·한 붉은 글씨)과 판 무늬는 장기 모드(games/janggi.js)와 같게 ----- */
const JINK=['#17684f','#b5241b'];   // 초·한 글씨 색
const JFONT='"Noto Serif KR","Noto Serif CJK KR","Source Han Serif K","Nanum Myeongjo","Batang","AppleMyungjo",serif';
const jCol=seat=>OS&&OS.co[seat]===2?1:0;   // 그 자리의 장기 색 (0 초, 1 한)
const handCol=seat=>OS&&OS.jg&&seat>=0?(OS.co[seat]===1?3:0):seat;   // 손 색: 장기 모드는 알 색을 따름 (초 초록·한 빨강)
/* 알 윗면 글자의 위쪽 방향(월드 xz): 주인 쪽에서 바로 읽히게(실제 장기판처럼) + 돈 각도 w. 3D는 이 각도를 y축 회전으로 씀 (윗면 무늬는 로컬 +x가 글자 위쪽) */
function ownAng(seat){const [sx,sz]=sideOfSeat(seat,npOf());return Math.atan2(sz,-sx)}
function jOctPts(r){const o=[];for(let k=0;k<8;k++){const a=Math.PI/8+k*Math.PI/4;o.push((r*Math.cos(a)).toFixed(3)+','+(r*Math.sin(a)).toFixed(3))}return o.join(' ')}
function jPieceSvg(t,col,X,Y,deg,r,op){
  const ch=JHJ[col][t],fs=r*(t===7?1.02:1.1);
  return `<g transform="translate(${X.toFixed(3)} ${Y.toFixed(3)}) rotate(${deg.toFixed(1)})"${op!=null&&op<1?` opacity="${op}"`:''}><polygon points="${jOctPts(r)}" transform="translate(0 ${(r*.06).toFixed(3)})" fill="#a88a5a"/><polygon points="${jOctPts(r)}" fill="#f1e3c2" stroke="#5a4028" stroke-width="${(r*.07).toFixed(3)}" stroke-linejoin="round"/><polygon points="${jOctPts(r*.8)}" fill="none" stroke="${JINK[col]}" stroke-width="${(r*.05).toFixed(3)}" opacity=".7"/><text x="0" y="${(fs*.04).toFixed(3)}" transform="${col?'':'skewX(-8)'}" font-size="${fs.toFixed(3)}" fill="${JINK[col]}" text-anchor="middle" dominant-baseline="central" font-family='${JFONT}' font-weight="${col?600:800}">${ch}</text></g>`;
}
/* 장기판 무늬: 밝은 원목 + 먹선(9×10 선, 궁성 대각선, 졸·포 자리 표시). 캔버스 g, 월드 → 픽셀 px(x)·pz(z) */
function jBoardLines(L,mark){
  for(let c=0;c<9;c++)L((c-4)*JS,-JHZ,(c-4)*JS,JHZ,1);
  for(let r=0;r<10;r++)L(-JHX,(r-4.5)*JS,JHX,(r-4.5)*JS,1);
  for(const r0 of [0,7]){const z=r=>(r-4.5)*JS;L(-JS,z(r0),JS,z(r0+2),1);L(JS,z(r0),-JS,z(r0+2),1)}
  for(const r of [3,6])for(const c of [0,2,4,6,8])mark(c,r);
  for(const r of [2,7])for(const c of [1,7])mark(c,r);
}
function say(txt){
  msg=txt;msgUntil=Date.now()+2400;drawHint();
  clearTimeout(msgTimer);msgTimer=setTimeout(drawHint,2500);
}
const nm=i=>V.ps[i]?V.ps[i].n:'?';
/* 남은 알: 튕긴 자취를 재생하는 동안은 아직 떨어지지 않은 알(떨어진 시각 of가 재생 시각보다 뒤)도 남은 것으로 셈 */
function aliveS(seat){
  if(!OS)return 0;
  if(OS.om)return OS.st.filter(s=>s.s===seat&&!s.o).length;   // 오목 모드: 판 위의 내 돌
  const S=Ak3.shot,of=S&&S.sh.of,e=S?clock()-S.t0:0;
  return OS.st.filter((s,i)=>s.s===seat&&(!s.o||(of&&of[i]!=null&&e<of[i]))).length;
}
/* ----- 소리 (코드로 만든 소리) ----- */
function sndFlick(){hiss(.03,{freq:4200,q:3,vol:.22});tone(1600,.03,{type:'triangle',vol:.06})}   // 손톱으로 탁
function sndClack(v){const k=Math.min(1,v/8);hiss(.035,{freq:3600,q:2.2,vol:.1+.22*k});tone(2300,.03,{type:'triangle',vol:.03+.07*k});tone(900,.05,{type:'sine',vol:.03+.04*k,at:.004})}   // 알끼리 딱
function sndTap(v){const k=Math.min(1,v/4);hiss(.03,{freq:2600,q:2,vol:.06+.14*k});tone(700,.05,{type:'sine',vol:.03+.05*k})}   // 판에 툭
function sndDrop(v){const k=Math.min(1,v/5);tone(180,.09,{type:'triangle',vol:.06+.12*k});hiss(.05,{freq:700,vol:.05+.08*k})}   // 펠트·탁자에 툭
function sndWall(v){const k=Math.min(1,v/4);tone(320,.06,{type:'triangle',vol:.05+.08*k});hiss(.03,{freq:1500,vol:.04+.06*k})}   // 판 옆면에 탁
function sndStretch(p){tone(320+p*700,.025,{type:'square',vol:.018+p*.02})}   // 당기는 만큼 오르는 짧은 틱
function sndMax(){tone(150,.16,{type:'sawtooth',vol:.04,slide:120});hiss(.12,{freq:400,q:4,vol:.05})}   // 끝까지: 팽팽한 소리
function sndPickUp(){hiss(.025,{freq:2800,q:3,vol:.08})}   // 알을 짚음
function sndBowl(){for(let k=0;k<3;k++)hiss(.022,{freq:2400+Math.random()*1600,q:5,vol:.09*(.6+Math.random()*.4),at:k*.034+Math.random()*.015})}   // 통 속 돌이 자르륵 (오목 바둑통 소리)
function sndNo(){sfx('no')}

/* ----- 당기기 (3D·2D 같은 계산: 월드 좌표의 당긴 벡터) ----- */
function pickStone(x,z){   // 누른 곳에서 가까운 내 알 (알이 작아도 손가락으로 집기 쉽게 .45 안)
  if(!OS)return -1;
  const me=myIdx();let best=-1,bd=.45;
  OS.st.forEach((s,i)=>{if(s.s!==me||s.o||s.u)return;const d=Math.hypot(s.x-x,s.z-z);if(d<bd){bd=d;best=i}});
  return best;
}
/* 놓기: 누른 곳에서 가장 가까운 줄 점. 처음 누르면 반투명 미리 보기, 같은 점을 한 번 더 누르면 놓음('두 번 눌러 놓기'를 끄면 바로) */
let GH=null;   // 미리 보기 {c,r}
function nearGrid(x,z){const c=Math.round(x/PITCH+C0),r=Math.round(z/PITCH+C0);return Math.hypot(x-(c-C0)*PITCH,z-(r-C0)*PITCH)<PITCH*.75?[c,r]:null}
function setGH(g){const was=!!GH;GH=g;if(was!==!!g&&!(OS&&OS.om))sendAct({t:'hold',on:g?1:0});Ak3.dirty=true;draw2D();G.buttons()}
const nextOf=seat=>OS?OS.st.findIndex(q=>q.s===seat&&q.u):-1;   // 다음에 놓을 알 (놓기 전 줄의 첫 알)
function placeTap(x,z){
  const me=myIdx();if(me<0||me>=npOf())return;
  if(!myPlaceNow()){sndNo();return}
  {const k=nextOf(me),q=!OS.om&&k>=0&&OS.st[k];if(GH&&q&&Math.hypot(q.x-x,q.z-z)<.3){setGH(null);sndPickUp();return}}   // 집어 든 알을 누르면 내려놓음
  const g=nearGrid(x,z);
  if(!g||!canPlace(OS,me,g[0],g[1])){sndNo();return}
  if(GH&&GH.c===g[0]&&GH.r===g[1]){if(typeof dblTap!=='undefined'&&dblTap)confirmGH();else{setGH(null);sndPickUp()}return}   // 같은 점을 다시 누르면: 두 번 눌러 놓기면 놓음, 아니면 취소 (오목과 같음)
  if(!GH)sndPickUp();setGH({c:g[0],r:g[1]});
}
function confirmGH(){   // 미리 보기 자리에 놓음 ([놓기] 버튼·스페이스, 또는 같은 점 두 번)
  if(!GH||!myPlaceNow()){sndNo();return}
  const g=GH;GH=null;sendAct({t:'place',c:g.c,r:g.r});Ak3.dirty=true;G.buttons();
}
function dragStart(x,z){
  if(!OS||!V||V.st!=='play')return false;
  const me=myIdx();if(me<0)return false;
  if(OS.ph==='place'){placeTap(x,z);return false}
  const i=pickStone(x,z);
  if(i<0){if(OS.om&&OS.ph==='aim'&&!introWait())placeTap(x,z);return false}   // 오목 모드: 내 돌이 없는 곳을 누르면 그 점에 놓기
  if(!myTurnNow()||introWait()||Ak3.shot){sndNo();return true}   // 내 알이지만 지금은 못 튕김
  drag={i,x0:x,z0:z,px:0,pz:0,L:0,p:0,over:false,lvl:0,sent:0,sp:-1,sa:0,ph:Math.random()*1e6};   // ph: 떨림 위상 (매번 다르게)
  sndPickUp();Ak3.dirty=true;
  return true;
}
function dragMove(x,z){
  if(!drag)return;
  drag.px=x-drag.x0;drag.pz=z-drag.z0;drag.L=Math.hypot(drag.px,drag.pz);
  const p=Math.min(1,drag.L/MAXD),over=drag.L>MAXD;
  if(over&&!drag.over){sndMax();try{navigator.vibrate&&navigator.vibrate(14)}catch(e){}}   // 끝까지: 팽팽한 소리·진동 (더 세지지 않음)
  const lvl=Math.floor(p*10);
  if(!over&&lvl>drag.lvl)sndStretch(p);
  drag.lvl=lvl;drag.p=p;drag.over=over;
  sendAim(false);Ak3.dirty=true;
}
const baseAng=d=>Math.atan2(-d.pz,-d.px);   // 겨눈 방향 = 당긴 방향의 반대 (떨림 전)
function sendAim(force){
  if(!drag)return;
  const t=clock(),a=drag.L>1e-4?baseAng(drag):0;
  if(!force&&t-drag.sent<SEND_MS)return;
  if(!force&&Math.abs(drag.p-drag.sp)<.015&&Math.abs(a-drag.sa)<.015)return;
  drag.sent=t;drag.sp=drag.p;drag.sa=a;
  sendAct({t:'aim',i:drag.i,a,p:drag.p,w:drag.over?1:0});
}
function dragEnd(cancel){
  if(!drag)return;
  const d=drag;drag=null;Ak3.dirty=true;
  if(cancel||d.p<PMIN||!myTurnNow()){
    sendAct({t:'aim',i:-1});
    if(!cancel&&OS&&OS.om&&d.p<PMIN&&myTurnNow()){placeTap(d.x0,d.z0);return}   // 오목 모드: 거의 안 당기고 놓으면 누른 점에 놓기
    if(!cancel&&d.L>.02)sndPickUp();return}
  const t=clock(),j=spreadOf(d.p)*jit(t+d.ph),a=baseAng(d)+j;   // 놓는 순간 손이 가리키던 방향 (j: 그중 떨림 몫)
  const q=OS.st[d.i];
  sendAct({t:'shoot',i:d.i,a,p:d.p,j:Math.round(j*1e5)/1e5});
  sndFlick();Ak3.flickAt=t;
  FLK={i:d.i,a,j,p:d.p,seat:myIdx(),t0:t,x:q.x,z:q.z,mine:true};
}
/* 손으로 보여 줄 것: 내가 당기는 중이면 그것, 아니면 방장이 알려 준 상대(봇)의 당기기 (부드럽게 따라감).
   a: 겨눈 방향(떨림 전), 실제로 그리는 방향은 shownAng (떨림은 화면마다 따로: 상대의 떨림 위상은 알 수 없음) */
const AIM={i:-1,a:0,p:0,at:0,ph:0};
function aimNow(t){
  if(drag)return {i:drag.i,a:baseAng(drag),p:drag.p,mine:true,seat:myIdx(),ph:drag.ph};
  const o=OS&&OS.aim,me=myIdx();
  if(!o||OS.ph!=='aim'||V.st!=='play'||Ak3.shot||o.s===me){AIM.i=-1;return null}
  if(AIM.i!==o.i){AIM.i=o.i;AIM.a=o.a;AIM.p=0;AIM.ph=Math.random()*1e6}
  const k=Math.min(1,Math.max(0,(t-(AIM.at||t))/1000)*14);AIM.at=t;
  let da=o.a-AIM.a;while(da>Math.PI)da-=2*Math.PI;while(da<-Math.PI)da+=2*Math.PI;
  AIM.a+=da*k;AIM.p+=(o.p-AIM.p)*k;
  return {i:o.i,a:AIM.a,p:AIM.p,mine:false,seat:o.s,ph:AIM.ph};
}
const shownAng=(a,t)=>a.a+spreadOf(a.p)*jit(t+a.ph);
/* 튕기는 손: 놓으면 중지가 앞으로 뻗어 알을 치고(0.09초) 사라짐(0.38초). 내가 튕긴 것은 놓는 순간, 남이 튕긴 것은 자취가 올 때 */
let FLK=null;
const FLK_IN=90,FLK_OUT=380;

/* ----- 손 그림 (위에서 본 반투명 손, 캔버스에 그려 3D 판·2D 판에 같이 씀) -----
   영상처럼 엄지와 중지가 고리를 만들고(당길수록 원 → 납작한 타원), 검지·약지·소지는 당길수록 펴지고 벌어짐(뻣뻣해짐).
   손 좌표: 알 가운데가 0, +X가 튕기는 쪽, +Y가 손가락이 펴지는 쪽. 손목은 짧게 자르고 끝은 흐려짐.
   사람마다 손 색(0번 빨강·1번 파랑), 당길수록 진해짐(20%→90%), 윤곽선은 늘 보임 */
const HCOL=['#e0553f','#3f7fe0','#f2c230','#47b35a'],HINK='#3b2a1f';
const HB={x0:-.95,x1:.15,y:.55},HPX=384,HSC=1.4,HOFF=.15-SR;   // HSC: 손 크기 (고리 앞 끝 X=-.165가 알에 닿은 채로 키움), HOFF: 그림은 반지름 .15 알에 맞춰져 있어 작은 알에 닿게 옮김
const HAND={cv:null,full:null,line:null,key:'',url:''};
function handParts(p,fl){
  const P=[],W=.05;
  P.push({k:'cap',pts:[[-.47,-.02],[-.86,-.07]],w:.17});   // 손목 (짧게)
  const curl=1-p;
  [[-.28,.12,.2],[-.37,.165,.19],[-.46,.14,.15]].forEach(([bx,by,L],k)=>{   // 검지·약지·소지: 당길수록 펴지고(길어 보임) 벌어짐
    const ang=(100+(k-1)*(16+20*p))*Math.PI/180,len=L*(.5+.5*p);
    const ex=bx+Math.cos(ang)*len,ey=by+Math.sin(ang)*len;
    const mx=(bx+ex)/2+curl*.06,my=(by+ey)/2-curl*.01;
    P.push({k:'cap',pts:[[bx,by],[mx,my],[ex,ey]],w:W*.95});
  });
  P.push({k:'ell',cx:-.38,cy:.03,rx:.165,ry:.15,rot:.12});   // 손등
  const R0=.085,rx=R0*(1-.45*p),ry=R0*(1+.12*p),rcx=-.165-rx,rcy=-.01;
  return {P,ring:{rcx,rcy,rx,ry,w:W},fl};
}
function handPaint(g,mode,col,H2){   // mode: 'ink' 바깥 윤곽(두꺼운 먹), 'fill' 손 색
  const e=.016,ink=mode==='ink';
  g.strokeStyle=g.fillStyle=ink?HINK:col;g.lineCap=g.lineJoin='round';
  for(const q of H2.P){
    if(q.k==='cap'){g.lineWidth=q.w+(ink?2*e:0);g.beginPath();q.pts.forEach(([x,y],j)=>{if(j===0)g.moveTo(x,y);else if(q.pts.length===3&&j===1){}else if(q.pts.length===3)g.quadraticCurveTo(q.pts[1][0],q.pts[1][1],x,y);else g.lineTo(x,y)});g.stroke()}
    else{g.beginPath();g.ellipse(q.cx,q.cy,q.rx+(ink?e:0),q.ry+(ink?e:0),q.rot,0,Math.PI*2);g.fill()}
  }
}
function handRing(g,mode,col,H2){   // 엄지·중지 고리 (손등 위에 따로: 고리 구멍이 보이게). 튕기면 중지가 앞으로 뻗음
  const r=H2.ring,e=.016,ink=mode==='ink',fl=H2.fl;
  g.strokeStyle=ink?HINK:col;g.lineCap='round';g.lineWidth=r.w+(ink?2*e:0);
  if(fl<=0){g.beginPath();g.ellipse(r.rcx,r.rcy,r.rx,r.ry,0,0,Math.PI*2);g.stroke()}
  else{
    g.beginPath();g.ellipse(r.rcx,r.rcy,r.rx,r.ry,0,Math.PI,Math.PI*2);g.stroke();   // 엄지 (아래 반)
    const tx=-.17+.05*fl;g.beginPath();g.moveTo(-.29,.035);g.lineTo(tx,.0);g.stroke();   // 중지가 손등에서 앞으로 쭉
  }
}
function handCanvas(p,fl,seat,op){
  const col=HCOL[Math.max(0,seat)%HCOL.length],key=[seat,Math.round(p*50),Math.round(fl*20),Math.round(op*50)].join(',');
  if(!HAND.cv){const mk=()=>{const c=document.createElement('canvas');c.width=c.height=HPX;return c};HAND.cv=mk();HAND.full=mk();HAND.line=mk()}
  if(HAND.key===key)return {cv:HAND.cv,changed:false};
  HAND.key=key;
  const H2=handParts(p,fl),k=HPX/(HB.x1-HB.x0),T0=g=>{g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,HPX,HPX);g.setTransform(k,0,0,-k,-HB.x0*k,HB.y*k)};
  // 꽉 찬 손: 먹 → 손 색 → 고리(먹·손 색) → 고리 구멍은 비움 → 손톱
  {const g=HAND.full.getContext('2d');T0(g);g.globalCompositeOperation='source-over';
   handPaint(g,'ink',col,H2);handPaint(g,'fill',col,H2);handRing(g,'ink',col,H2);handRing(g,'fill',col,H2);
   if(fl<=0){const r=H2.ring;g.globalCompositeOperation='destination-out';g.beginPath();g.ellipse(r.rcx,r.rcy,Math.max(.004,r.rx-r.w/2-.016),Math.max(.004,r.ry-r.w/2-.016),0,0,Math.PI*2);g.fill();g.globalCompositeOperation='source-over';
     g.fillStyle='rgba(255,255,255,.6)';g.beginPath();g.ellipse(r.rcx+r.rx,r.rcy,.014,.02,0,0,Math.PI*2);g.fill()}   // 중지 손톱 (알에 닿는 곳)
   g.setTransform(1,0,0,1,0,0);g.globalCompositeOperation='destination-out';
   const fx=x=>(x-HB.x0)*k,gr=g.createLinearGradient(fx(-.95),0,fx(-.66),0);gr.addColorStop(0,'rgba(0,0,0,1)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(0,0,fx(-.66),HPX);   // 손목 끝은 흐리게
   g.globalCompositeOperation='source-over'}
  // 윤곽선만: 먹을 그리고 손 색 자리를 지움
  {const g=HAND.line.getContext('2d');g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,HPX,HPX);g.drawImage(HAND.full,0,0);
   g.globalCompositeOperation='source-in';g.fillStyle=HINK;g.fillRect(0,0,HPX,HPX);g.globalCompositeOperation='source-over';
   const T=HAND.tmp||(HAND.tmp=document.createElement('canvas'));T.width=T.height=HPX;const t2=T.getContext('2d');T0(t2);handPaint(t2,'fill',col,H2);handRing(t2,'fill',col,H2);
   g.globalCompositeOperation='destination-out';g.drawImage(T,0,0);g.globalCompositeOperation='source-over'}
  const g=HAND.cv.getContext('2d');g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,HPX,HPX);
  g.globalAlpha=op;g.drawImage(HAND.full,0,0);g.globalAlpha=Math.max(0,.6-op*.6);g.drawImage(HAND.line,0,0);g.globalAlpha=1;
  HAND.url='';
  return {cv:HAND.cv,changed:true};
}
/* 지금 그릴 손: {i, x, z, ang(그리는 방향), p, fl(튕김 0~1), op(불투명도), seat} 또는 null */
const handOp=p=>.45+.5*p;   // 손 진하기: 당길수록 45% → 95%
/* 손 크기는 그대로, 큰 알(장기 알)이면 중지 끝이 알 가장자리에 닿게 손을 그만큼 뒤로·위로 옮김 */
function handFit(o){
  if(!o)return o;const q=OS&&OS.st[o.i],g=geomOf(q&&q.t),dr=g.r-SR;
  o.seat=handCol(o.seat);o.dh=g.h-SH;
  if(dr){o.x-=Math.cos(o.ang)*dr;o.z-=Math.sin(o.ang)*dr}
  return o;
}
function handNow(t,pos){return handFit(handNow0(t,pos))}
function handNow0(t,pos){
  if(FLK){
    const e=t-FLK.t0;
    if(e>FLK_IN+FLK_OUT){FLK=null}
    else{const fl=Math.min(1,e/FLK_IN),fade=e<=FLK_IN?1:1-(e-FLK_IN)/FLK_OUT;
      return {i:FLK.i,x:FLK.x,z:FLK.z,ang:FLK.a,j:FLK.j||0,p:FLK.p,fl,op:handOp(FLK.p)*fade,seat:FLK.seat,fade}}
  }
  const a=aimNow(t);
  if(!a||!pos[a.i]||V.st!=='play'||Ak3.shot||a.p<(OS&&OS.om?PMIN:.005))return null;   // 오목 모드: 조금 당긴 것은 누르기라 손을 안 그림
  const j=spreadOf(a.p)*jit(t+a.ph);
  return {i:a.i,x:pos[a.i].x,z:pos[a.i].z,ang:a.a+j,j,p:a.p,fl:0,op:handOp(a.p),seat:a.seat,fade:1};
}

/* ----- 2D (SVG, WebGL이 없을 때) ----- */
const VX=BW+.1,VY=BW+.5;   // 그림 범위: 가로는 판 끝까지, 세로는 놓기 전 알(판 위아래 펠트)까지
const VXY=()=>OS&&OS.jg?[JBX+.1,JBZ+.12]:npOf()>2?[BW+.5,BW+.5]:[VX,VY];
const w2s=(x,z)=>rotXZ(x,z);
function s2w(e){
  const [vx,vy]=VXY(),r=elSvg.getBoundingClientRect(),k=Math.min(r.width/(2*vx),r.height/(2*vy))||1,ox=(r.width-2*vx*k)/2,oy=(r.height-2*vy*k)/2;
  const X=(e.clientX-r.left-ox)/k-vx,Y=(e.clientY-r.top-oy)/k-vy;
  return unrotXZ(X,Y);
}
function boardSvg(){
  if(OS&&OS.jg){   // 장기판 (내 쪽이 아래: 판은 앞뒤가 같아 돌리지 않음)
    const out=[`<circle cx="0" cy="0" r="3.15" fill="#2f6b4f"/><rect x="${-JBX-.06}" y="${-JBZ+.08}" width="${2*JBX+.12}" height="${2*JBZ+.04}" rx=".08" fill="#000" opacity=".22"/><rect x="${-JBX}" y="${-JBZ}" width="${2*JBX}" height="${2*JBZ}" rx=".06" fill="#7a4a22"/><rect x="${-JBX+.05}" y="${-JBZ+.05}" width="${2*JBX-.1}" height="${2*JBZ-.1}" rx=".04" fill="#e4c283"/>`];
    const L=(x0,z0,x1,z1)=>out.push(`<line x1="${x0.toFixed(3)}" y1="${z0.toFixed(3)}" x2="${x1.toFixed(3)}" y2="${z1.toFixed(3)}" stroke="#3a2412" stroke-width=".016"/>`);
    jBoardLines(L,(c,r)=>out.push(`<circle cx="${((c-4)*JS).toFixed(3)}" cy="${((r-4.5)*JS).toFixed(3)}" r=".035" fill="#3a2412"/>`));
    out.push(`<rect x="${-JHX}" y="${-JHZ}" width="${2*JHX}" height="${2*JHZ}" fill="none" stroke="#3a2412" stroke-width=".035"/>`);
    return out.join('');
  }
  const out=[],c0=(NL-1)/2,hl=c0*PITCH;
  out.push(`<circle cx="0" cy="0" r="3.15" fill="#2f6b4f"/><rect x="${-BW-.06}" y="${-BW+.08}" width="${2*BW+.12}" height="${2*BW+.04}" rx=".08" fill="#000" opacity=".22"/><rect x="${-BW}" y="${-BW}" width="${2*BW}" height="${2*BW}" rx=".06" fill="#8a5a32"/><rect x="${-BW+.06}" y="${-BW+.06}" width="${2*BW-.12}" height="${2*BW-.12}" rx=".04" fill="#e3bd7e"/>`);
  for(let k=0;k<NL;k++){const v=(k-c0)*PITCH;out.push(`<line x1="${-hl}" y1="${v}" x2="${hl}" y2="${v}" stroke="#6b4a26" stroke-width=".014"/><line x1="${v}" y1="${-hl}" x2="${v}" y2="${hl}" stroke="#6b4a26" stroke-width=".014"/>`)}
  for(const a of HOSHI)for(const b of HOSHI)out.push(`<circle cx="${(a-c0)*PITCH}" cy="${(b-c0)*PITCH}" r=".03" fill="#4b3319"/>`);
  return out.join('');
}
function stones2D(pos){
  const out=[],t=clock(),np=npOf(),me=myIdx();
  pos.forEach((q,i)=>{
    const s=OS.st[i];if(!s||q.y<-.5)return;
    const gm=geomOf(s.t),c=stC(OS.co[s.s]),[X,Y]=w2s(q.x,q.z),h=Math.max(0,q.y-(groundAt(q.x,q.z)+gm.h)),k=stoneScale(q.y,gm.h);
    if(s.t){   // 장기 알: 팔각 + 한자, 글자 위쪽은 주인 쪽에서 바로 읽히는 방향 + 돈 각도
      const a=ownAng(s.s)+(q.w||0),[UX,UY]=w2s(Math.cos(a),-Math.sin(a)),deg=Math.atan2(UX,-UY)*180/Math.PI;
      out.push(`<circle cx="${X+h*.5}" cy="${Y+h*.35}" r="${gm.rv*(1+h*.8)}" fill="#000" opacity="${.28/(1+h*5)}"/>`+jPieceSvg(s.t,jCol(s.s),X,Y,deg,gm.rv*k));
      return;
    }
    out.push(`<circle cx="${X+h*.5}" cy="${Y+h*.35}" r="${SR*(1+h*.8)}" fill="#000" opacity="${.28/(1+h*5)}"/><circle cx="${X}" cy="${Y}" r="${SR*k}" fill="${c.f}" stroke="${c.s}" stroke-width=".02"/>`);
  });
  if(OS.om){   // 오목 모드: 바둑통(그림), 멈춘 돌이 점령한 점, 끝나면 이긴 줄
    const n=bowlCounts(),bw=[];
    for(const seat of [0,1]){const [X,Y]=w2s(...bowlXZ(seat)),c=stC(OS.co[seat]),k=Math.min(n[seat],BN);
      bw.push(`<circle cx="${X}" cy="${Y}" r=".24" fill="#8a5a32" stroke="#3b2a1f" stroke-width=".02"/><circle cx="${X}" cy="${Y}" r=".19" fill="#5a3416"/>`);
      for(let j=0;j<k;j++){const b=bowlSpots[j];bw.push(`<circle cx="${X+b.x*.42}" cy="${Y+b.z*.42}" r=".045" fill="${c.f}" stroke="#0c0c0e" stroke-width=".008"/>`)}}
    out.unshift(...bw);
    if(!introOn()){const M=omMarks(pos),mk=[];
      for(const [c,r,sd] of M.on){const [X,Y]=w2s(...gridXZ(c,r)),b=OS.co[sd]===1,h=PITCH*.44;mk.push(`<rect x="${X-h}" y="${Y-h}" width="${2*h}" height="${2*h}" rx=".04" fill="${b?'rgba(30,26,22,.32)':'rgba(255,255,255,.55)'}" stroke="${b?'rgba(30,26,22,.75)':'#fff'}" stroke-width=".016"/>`)}
      out.unshift(...mk)}
    const ln=V.st==='over'&&OS.res&&OS.res.ln;
    if(ln&&ln.length>1){const [a,b]=[gridXZ(...ln[0]),gridXZ(...ln[ln.length-1])].map(([x,z])=>w2s(x,z));out.push(`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#f2b632" stroke-width="${PITCH*.22}" stroke-linecap="round" opacity=".85"/>`)}
  }
  else if(OS.ph==='place'&&V.st==='play'&&!introWait()){const hl=BW-.07,pl=me>=0&&me<np;
    if(np===2){   // 상대 쪽 반 빗금(화면 위쪽) + 가운데 차단기
      if(pl)out.unshift(`<rect x="${-BW+.06}" y="${-(BW-.06)}" width="${2*BW-.12}" height="${BW-.06-PITCH/2}" fill="url(#akHatch)" opacity=".32"/>`);
      out.unshift(`<rect x="${-hl}" y="${-PITCH*.21}" width="${2*hl}" height="${PITCH*.42}" fill="url(#akBar)" stroke="#3b2a1f" stroke-width=".02"/>`)}
    else{   // 3~4명: 내 삼각형(화면 아래) 말고 세 삼각형에 빗금 + 대각선 차단기 넷과 가운데 받침
      const L=BW-.06,d=hl*Math.SQRT2,bar=[];
      if(pl)for(const [a,b] of [[[-L,-L],[L,-L]],[[-L,-L],[-L,L]],[[L,-L],[L,L]]])out.unshift(`<polygon points="0,0 ${a.join(',')} ${b.join(',')}" fill="url(#akHatch)" opacity=".32"/>`);
      for(const r of [45,-45])bar.push(`<rect x="${-d}" y="${-PITCH*.21}" width="${2*d}" height="${PITCH*.42}" fill="url(#akBar)" stroke="#3b2a1f" stroke-width=".02" transform="rotate(${r})"/>`);
      bar.push(`<circle r="${PITCH*.45}" fill="#2b2b2e" stroke="#3b2a1f" stroke-width=".02"/>`);
      out.unshift(...bar)}}
  if(myPlaceNow()){
    if(GH){const [x,z]=gridXZ(GH.c,GH.r),[X,Y]=w2s(x,z),c=stC(OS.co[me]);out.push(`<circle cx="${X}" cy="${Y}" r="${SR}" fill="${c.f}" stroke="${c.s}" stroke-width=".02" opacity=".5"/>`)}}
  if(myTurnNow()&&!drag&&!Ak3.shot&&!FLK)OS.st.forEach((s,i)=>{if(s.s===me&&!s.o&&!s.u){const [X,Y]=w2s(pos[i].x,pos[i].z);out.push(`<circle cx="${X}" cy="${Y}" r="${geomOf(s.t).rv*(s.t?1.25:1.45)}" fill="none" stroke="#f2b632" stroke-width=".03" opacity=".85"/>`)}});
  const hd=handNow(t,pos);
  if(hd){
    const r=handCanvas(hd.p,hd.fl,hd.seat,hd.op);if(r.changed||!HAND.url)HAND.url=r.cv.toDataURL();
    const [X,Y]=w2s(hd.x,hd.z),deg=(hd.ang+sideAng())*180/Math.PI;
    out.push(`<image href="${HAND.url}" x="${HB.x0}" y="${-HB.y}" width="${HB.x1-HB.x0}" height="${2*HB.y}" transform="translate(${X} ${Y}) rotate(${deg}) translate(${-.165*(1-HSC)+HOFF} 0) scale(${HSC})"/>`);
  }
  return out.join('');
}
function draw2D(){
  if(!elMain||Ak3.on||!OS)return;
  const bd=elMain.querySelector('#akB'),bk=OS.jg?'j':'b';if(bd.dataset.k!==bk){bd.innerHTML=boardSvg();bd.dataset.k=bk}
  elMain.querySelector('#akS').innerHTML=stones2D(curPos(clock()));
}

/* ----- 위쪽 이름 칸: 알 색·이름·남은 알(●)·내 차례면 남은 시간 ----- */
/* 이름 칸: 나는 판 아래쪽 가운데, 다른 사람은 위쪽 가운데(나 다음부터 시계 방향). 관전자는 모두 위쪽 */
function chipHTML(i){
  const me=myIdx(),np=npOf(),p=V.ps[i];if(!p)return '';
  const on=V.st==='play'&&V.t===i&&!introWait(),col=OS.co[i],al=aliveS(i),c=OS.jg?{css:col===1?'cho':'han'}:stC(col);
  const st=V.st==='over'?(OS.res&&OS.res.w<0?'무승부':p.f===1?'승리':(p.sr===3?'탈주':p.sr?'항복':np>2&&p.f>1?`${p.f}위`:'패배')):(V.st==='play'&&!OS.om&&np>2&&al===0?'탈락':'');
  const dots=OS.om?'':OS.jg?`<span class="cnt">${al}</span>`:Array.from({length:OS.n},(_,k)=>`<i class="pip${k<al?'':' gone'}"></i>`).join('');   // 장기 모드: 남은 알 수 (16개라 점 대신 숫자)
  return `<div class="ak-p${on?' on':''}${i===me?' me':''}"><i class="dot ${c.css}"></i><b>${esc(p.n)}${i===me?' (나)':''}</b>${dots?`<span class="pips">${dots}</span>`:''}<span class="w" data-ct="${i}"></span>${st?`<span class="st">${st}</span>`:''}</div>`;
}
/* 이름 칸을 판 위·아래 끝에서 일정 거리(CHIP_GAP)만큼 띄움. 카메라 자리를 새로 정할 때만 부름 (매 프레임 계산 없음)
   topY·botY: 판 자리(물건 포함)의 화면 위·아래 끝(px). 위 칸은 아래 끝을, 내 칸은 위 끝을 맞춤 */
const CHIP_GAP=10;
/* 탑뷰 판 자리: 판 가운데 = 화면 가운데. 위아래는 이름 칸 자리(안내 줄·위 칸 / 내 칸·버튼)를 같은 높이로 비우고 양옆은 조금만(휴대폰 8px, PC 16px).
   가로 화면(폭>높이)은 안내 줄을 왼쪽 위 구석에 두어(.wide) 위 여백을 위 칸 한 줄만큼으로 줄임 */
function tvBox(r,p){
  const W=r.clientWidth,Hh=r.clientHeight;r.classList.toggle('wide',W>Hh||(W>=700&&npOf()<=2));   // 가로 화면, 또는 PC·태블릿 폭의 2명 판: 안내 줄을 왼쪽 위 구석으로 빼서 위 칸이 맨 위 줄로 (위아래 여백을 칸 한 줄만큼으로)
  const narrow=W<700,bar=r.querySelector('.'+p+'-bar'),mb=r.querySelector('.'+p+'-mebar');
  const R=Math.max(bar.offsetTop+bar.offsetHeight+CHIP_GAP,(narrow?70:14)+(mb.offsetHeight||26)+CHIP_GAP),m=narrow?8:16;
  return {fw:W-2*m,fh:Hh-2*R,cy:Hh/2,R};
}
function chipsAt(topY,botY){
  const r=elAk,bar=r.querySelector('.ak-bar'),mb=r.querySelector('.ak-mebar');if(!bar||!mb)return;
  const H=r.clientHeight,lim=H-(r.clientWidth<700?70:14)-(mb.offsetHeight||34);
  r.style.setProperty('--bs',Math.max(bar.offsetHeight,Math.round(topY-CHIP_GAP-bar.offsetTop))+'px');
  r.style.setProperty('--mt',Math.round(Math.min(botY+CHIP_GAP,lim))+'px');
  r.classList.add('lay');
}
const seatedMe=()=>{const me=myIdx();return me>=0&&me<npOf()};
function barHTML(){
  const me=myIdx(),np=npOf(),b=Math.max(0,me),order=Array.from({length:np},(_,k)=>(b+k)%np);   // 나부터 시계 방향
  return (seatedMe()?order.slice(1):order).map(chipHTML).join('');
}
function meBarHTML(){return seatedMe()?chipHTML(myIdx()):''}
/* 안내 줄: 꼭 필요한 것만 (누구 차례인지는 이름 칸, 튕길 수 있는 알은 고리가 보여 줌) */
function hintText(){
  if(Date.now()<msgUntil&&msg)return msg;
  if(!V||!V.ak||!OS)return '';
  if(V.st==='over'){
    const r=OS.res;if(!r)return '게임이 끝났습니다.';
    return r.w<0?'무승부입니다.':`${nm(r.w)} 승리${r.why==='surrender'?' (항복)':r.why==='desert'?' (탈주)':r.why==='both'?' (동시 오목: 튕긴 사람 패배)':r.why==='jang'?' (장 떨어짐)':OS.om?' (오목)':''}`;
  }
  if(OS.ph==='place'&&!introWait()&&!OS.om)return `알 놓기 ${OS.st.filter(q=>!q.u).length+1}/${OS.st.length}`;   // 놓기 단계 (몇 번째 알인지)
  return '';
}
function drawHint(){if(!elHint)return;const h=hintText();if(h!==lastHint){elHint.textContent=h;lastHint=h}}
function drawAll(){
  if(!OS||!elAk)return;
  const top=barHTML(),mb=meBarHTML(),key=top+'\u0001'+mb;if(key!==lastBar){elBar.innerHTML=top;elBarMe.innerHTML=mb;lastBar=key}
  drawHint();fit2D();draw2D();
}
function fit2D(){
  if(!elAk||elAk.hidden||Ak3.on)return;
  const [vx,vy]=VXY(),vb=`${-vx} ${-vy} ${2*vx} ${2*vy}`;if(elSvg.getAttribute('viewBox')!==vb)elSvg.setAttribute('viewBox',vb);
  const bd=elAk.querySelector('.ak-bd'),k=Math.min(bd.clientWidth/(2*vx),bd.clientHeight/(2*vy));
  if(k>0){elSvg.style.width=Math.floor(2*vx*k)+'px';elSvg.style.height=Math.floor(2*vy*k)+'px'}
}

/* ---------- 3D ---------- */
/* 바로 위(90도)에서 내려다봄: 높이가 안 보이므로 뜬 알은 조금 커지고(stoneScale) 바닥 그림자가 옆으로 벌어지며 흐려짐. 판 아래(펠트)로 떨어진 알은 작아짐 */
const stoneScale=(y,h)=>Math.max(.72,Math.min(1.75,1+(y-(TOP+(h||SH)))*1.3));
const Ak3={hi:{cur:-1,prev:-1,t0:0},bar:{on:false,t0:-1e9},on:false,built:false,fail:false,root:null,cam:null,dirty:true,lastR:0,lay:'',layAt:0,d:12,stones:[],rings:[],blobs:[],hand:null,shot:null,lastSid:-1,lastGid:-1,flickAt:0,col:[]};
const ease=k=>k<=0?0:k>=1?1:k*k*(3-2*k);
const MAT={};
function stoneMesh(col){
  const key='s'+col;
  if(!MAT[key])MAT[key]=toon({color:stC(col).h,rim:stC(col).rim});
  if(!MAT.ink)MAT.ink=new THREE.MeshBasicMaterial({color:GFX_INK,side:THREE.BackSide});
  const g=new THREE.Group(),geo=Ak3.sGeo||(Ak3.sGeo=new THREE.SphereGeometry(SR,28,16)),m=new THREE.Mesh(geo,MAT[key]);m.scale.y=SH/SR;m.receiveShadow=true;g.add(m);
  const o=new THREE.Mesh(geo,MAT.ink);o.scale.set(1.07,SH/SR*1.12,1.07);g.add(o);
  g.userData={col,body:m};g.rotation.order='YXZ';
  return g;
}
/* 장기 알: 팔각 기둥(윗면이 조금 좁음) + 먹 윤곽. 바깥 묶음(g)은 기울기, 안쪽(yaw)은 돈 각도·주인 쪽 글자 방향. 가운데가 알 가운데 높이 */
const JTEX={},JGEO={};
function jFaceTex(t,col){
  const k=t+'|'+col;if(JTEX[k])return JTEX[k];
  return JTEX[k]=canvasTex(256,256,(g,w,h)=>{
    g.fillStyle='#f2e5c6';g.fillRect(0,0,w,h);
    const oct=r=>{g.beginPath();for(let i=0;i<8;i++){const a=Math.PI/8+i*Math.PI/4,x=w/2+r*Math.cos(a),y=h/2+r*Math.sin(a);i?g.lineTo(x,y):g.moveTo(x,y)}g.closePath()};
    g.strokeStyle=JINK[col];g.globalAlpha=.65;g.lineWidth=w*.022;oct(w*.4);g.stroke();g.globalAlpha=1;
    g.fillStyle=JINK[col];g.textAlign='center';g.textBaseline='middle';
    g.font=`${col?600:800} ${Math.round(w*(t===7?.48:.52))}px ${JFONT}`;
    g.save();g.translate(w/2,h/2+w*.02);if(!col)g.transform(1,0,-.14,1,0,0);g.fillText(JHJ[col][t],0,0);g.restore();
  });
}
function jMesh(t,col){
  const r=JPR[t],h=JPT[t],o=r*.08;
  if(!JGEO[t])JGEO[t]={body:new THREE.CylinderGeometry(r*.88,r,h,8,1,false,Math.PI/8),ink:new THREE.CylinderGeometry(r*.88+o,r+o,h+o*.5,8,1,false,Math.PI/8)};
  if(!MAT.ink)MAT.ink=new THREE.MeshBasicMaterial({color:GFX_INK,side:THREE.BackSide});
  const mk='j'+t+'|'+col;if(!MAT[mk]){const side=MAT.jside||(MAT.jside=toon({color:0xd2b986,rim:.1}));MAT[mk]=[side,toon({map:jFaceTex(t,col),rim:.04}),side]}
  const g=new THREE.Group(),yaw=new THREE.Group(),m=new THREE.Mesh(JGEO[t].body,MAT[mk]);m.castShadow=m.receiveShadow=true;yaw.add(m,new THREE.Mesh(JGEO[t].ink,MAT.ink));g.add(yaw);
  g.userData={col,body:m,yaw,t};
  return g;
}
function woodPaint(g,w,h,base,dark,n,seed){
  let s=seed||7;const rnd=()=>{s=(s*16807)%2147483647;return s/2147483647};
  g.fillStyle=base;g.fillRect(0,0,w,h);
  for(let i=0;i<n;i++){const y0=rnd()*h,a=rnd()*.12+.04;g.strokeStyle=dark;g.globalAlpha=a;g.lineWidth=rnd()*2.5+.8;g.beginPath();
    for(let t=0;t<=w;t+=8){const y=y0+Math.sin(t/30+i)*3+Math.sin(t/11+i*3)*1.2;t?g.lineTo(t,y):g.moveTo(t,y)}g.stroke()}
  g.globalAlpha=1;
}
function boardTex(){
  return canvasTex(1024,1024,(g,N)=>{
    woodPaint(g,N,N,'#e0b878','#8a5520',90,13);
    const s=N/(2*BW),X=v=>(v+BW)*s,c0=(NL-1)/2,hl=c0*PITCH;
    g.strokeStyle='rgba(60,36,12,.9)';g.lineWidth=Math.max(1.5,N/700);
    for(let k=0;k<NL;k++){const v=(k-c0)*PITCH;g.beginPath();g.moveTo(X(-hl),X(v));g.lineTo(X(hl),X(v));g.moveTo(X(v),X(-hl));g.lineTo(X(v),X(hl));g.stroke()}
    g.lineWidth=Math.max(3,N/300);g.strokeRect(X(-hl),X(-hl),2*hl*s,2*hl*s);
    g.fillStyle='rgba(60,36,12,1)';
    for(const a of HOSHI)for(const b of HOSHI){g.beginPath();g.arc(X((a-c0)*PITCH),X((b-c0)*PITCH),Math.max(3,N/230),0,7);g.fill()}
  });
}
function jBoardTex(){   // 장기판 무늬 (장기 모드와 같은 그림)
  return canvasTex(1024,Math.round(1024*JBZ/JBX),(g,W,Hh)=>{
    const s=W/(2*JBX),px=v=>(v+JBX)*s,pz=v=>(v+JBZ)*s,lw=Math.max(2,W/420);
    woodPaint(g,W,Hh,'#e4c283','#a8793e',70,11);
    g.strokeStyle='#3a2412';g.lineCap='round';
    const L=(x0,z0,x1,z1)=>{g.lineWidth=lw;g.beginPath();g.moveTo(px(x0),pz(z0));g.lineTo(px(x1),pz(z1));g.stroke()};
    const d=JS*.1,l=JS*.16;
    jBoardLines(L,(c,r)=>{const x=(c-4)*JS,z=(r-4.5)*JS;for(const sx of [-1,1])for(const sz of [-1,1]){if((c===0&&sx<0)||(c===8&&sx>0))continue;
      g.lineWidth=lw;g.beginPath();g.moveTo(px(x+sx*(d+l)),pz(z+sz*d));g.lineTo(px(x+sx*d),pz(z+sz*d));g.lineTo(px(x+sx*d),pz(z+sz*(d+l)));g.stroke()}});
    g.lineWidth=lw*2.2;g.strokeRect(px(-JHX),pz(-JHZ),2*JHX*s,2*JHZ*s);
    g.lineWidth=lw*1.4;g.strokeStyle='rgba(58,36,18,.55)';g.strokeRect(px(-JBX)+W*.012,pz(-JBZ)+W*.012,W-W*.024,Hh-W*.024);
  });
}
function ak3Build(){
  if(Ak3.built||Ak3.fail)return Ak3.built;
  if(!T.ok||typeof THREE==='undefined'){Ak3.fail=true;return false}
  try{
    const root=new THREE.Group();root.visible=false;
    const inkM=new THREE.MeshBasicMaterial({color:GFX_INK,side:THREE.BackSide});
    const bg=new THREE.Group();root.add(bg);Ak3.boardG=bg;
    const frameT=canvasTex(512,512,(g,w,h)=>woodPaint(g,w,h,'#6f4020','#2a1206',110,3));
    const bd0=new THREE.Group(),bd1=new THREE.Group();bg.add(bd0,bd1);Ak3.bd=[bd0,bd1];   // 바둑판·장기판 (모드에 따라 하나만 보임)
    const frame=new THREE.Mesh(new THREE.BoxGeometry(2*BW,TOP-.02,2*BW),toon({map:frameT,rim:.08}));frame.position.y=.02+(TOP-.02)/2;frame.castShadow=frame.receiveShadow=true;bd0.add(frame);
    const fo=new THREE.Mesh(new THREE.BoxGeometry(2*BW+.05,TOP,2*BW+.05),inkM);fo.position.copy(frame.position);bd0.add(fo);
    const top=new THREE.Mesh(new THREE.PlaneGeometry(2*BW-.1,2*BW-.1),toon({map:boardTex(),rim:0}));
    top.rotation.x=-Math.PI/2;top.position.y=TOP+.002;top.receiveShadow=true;bd0.add(top);
    {const jf=new THREE.Mesh(new THREE.BoxGeometry(2*JBX,TOP-.02,2*JBZ),toon({map:canvasTex(512,512,(g,w,h)=>woodPaint(g,w,h,'#7a4a22','#2e170a',110,3)),rim:.08}));jf.position.y=.02+(TOP-.02)/2;jf.castShadow=jf.receiveShadow=true;bd1.add(jf);
     const jo=new THREE.Mesh(new THREE.BoxGeometry(2*JBX+.05,TOP,2*JBZ+.05),inkM);jo.position.copy(jf.position);bd1.add(jo);
     const jt=new THREE.Mesh(new THREE.PlaneGeometry(2*JBX-.04,2*JBZ-.04),toon({map:jBoardTex(),rim:0}));jt.rotation.x=-Math.PI/2;jt.position.y=TOP+.002;jt.receiveShadow=true;bd1.add(jt);bd1.visible=false}
    // 튕길 수 있는 내 알 둘레의 고리 (내 차례), 화살표
    const ringM=new THREE.MeshBasicMaterial({color:0xf2b632,transparent:true,opacity:.9,depthWrite:false});
    Ak3.ringGeo=new THREE.RingGeometry(SR*1.22,SR*1.42,40);Ak3.ringM=ringM;
    // 손: 위에서 본 반투명 손 그림(캔버스)을 알 위에 눕혀 둠 (다른 알보다 늘 위에 보이게)
    {const tex=new THREE.CanvasTexture(handCanvas(0,0,0,.2).cv);tex.anisotropy=4;
     const hm=new THREE.MeshBasicMaterial({map:tex,transparent:true,depthTest:false,depthWrite:false});
     const pl=new THREE.Mesh(new THREE.PlaneGeometry(HB.x1-HB.x0,2*HB.y),hm);pl.rotation.x=-Math.PI/2;pl.position.x=(HB.x0+HB.x1)/2;pl.renderOrder=9;
     const inner=new THREE.Group();inner.add(pl);inner.scale.setScalar(HSC);inner.position.x=-.165*(1-HSC)+HOFF;const hg=new THREE.Group();hg.add(inner);hg.visible=false;root.add(hg);Ak3.hand={g:hg,tex}}
    loadHand3D();
    Ak3.blobGeo=new THREE.CircleGeometry(SR,28);
    // 놓기: 상대 쪽 반(가운데 줄 빼고)에 반투명 빨간 빗금(판 위·알 아래, 한쪽으로 흘러감), 가운데 줄에 건널목 차단기, 미리 보기 알
    {const w=2*BW-.12,h=BW-.06-PITCH/2,tex=canvasTex(128,128,(g,W)=>{g.clearRect(0,0,W,W);g.strokeStyle='rgba(214,40,30,1)';g.lineWidth=W*.16;g.lineCap='square';
       for(let c=-W;c<=2*W;c+=W/2){g.beginPath();g.moveTo(c,0);g.lineTo(c+W,W);g.stroke()}});
     tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(w/.46,h/.46);
     const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:tex,transparent:true,opacity:.32,depthWrite:false}));
     m.rotation.x=-Math.PI/2;m.visible=false;m.renderOrder=1;m.userData.h=h;root.add(m);Ak3.half=m}
    // 3~4명 놓기: 내 쪽 삼각형 말고 나머지 세 삼각형에 빨간 빗금 (월드 좌표로 직접 만든 세모 셋, 무늬는 판 좌표로 이어짐. 쪽이 바뀌면 다시 채움)
    {const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(27),3));geo.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(18),2));
     const t3=Ak3.half.material.map.clone();t3.needsUpdate=true;t3.repeat.set(1,1);
     const wm=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({map:t3,transparent:true,opacity:.32,depthWrite:false,side:THREE.DoubleSide}));
     wm.visible=false;wm.renderOrder=1;wm.frustumCulled=false;root.add(wm);Ak3.wedge=wm;Ak3.wedgeKey=''}
    Ak3.bowls=[0,1].map(()=>{const g=bowlGroup();root.add(g);return g});
    {const sq=(fill,line)=>canvasTex(64,64,(c,w)=>{c.clearRect(0,0,w,w);c.fillStyle=fill;c.strokeStyle=line;c.lineWidth=5;c.beginPath();c.roundRect?c.roundRect(5,5,w-10,w-10,10):c.rect(5,5,w-10,w-10);c.fill();c.stroke()});
     const tb=sq('rgba(30,26,22,.32)','rgba(30,26,22,.75)'),tw=sq('rgba(255,255,255,.55)','rgba(255,255,255,.95)');
     Ak3.omOn=[[],[]];   // 돌이 있다고 보는 점 (흑·백), 판 위·알 아래. 필요한 만큼 늘려 씀
     Ak3.omMake=col=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(PITCH*.96,PITCH*.96),new THREE.MeshBasicMaterial({map:col?tw:tb,transparent:true,depthWrite:false}));m.rotation.x=-Math.PI/2;m.visible=false;m.renderOrder=1;root.add(m);return m}}
    Ak3.winM=new THREE.Mesh(new THREE.BoxGeometry(1,.02,1),new THREE.MeshBasicMaterial({color:0xf2b632,transparent:true,opacity:.85,depthWrite:false}));Ak3.winM.visible=false;Ak3.winM.renderOrder=6;root.add(Ak3.winM);
    // 건널목 차단기 (놓기 동안): 두 명이면 판 틀 양끝(가운데 줄 끝)에 기둥 둘, 세·네 명이면 판 네 모서리에 기둥 넷과 가운데 받침(Ak3.barD).
    // 기둥 위 축에서 검정·노랑 차단봉이 경계(가운데 줄·대각선) 위로 내려옴. 기둥 머리에 빨간 경고등 둘(번갈아 깜빡, 모든 기둥이 함께)
    {const XP=BW-.13,AH=.3,AW=.06,AT=.04,tex=canvasTex(256,32,(g,W,Hc)=>{g.fillStyle='#f2c230';g.fillRect(0,0,W,Hc);g.fillStyle='#1d1b19';
       for(let x=-Hc;x<W+Hc;x+=Hc*2){g.beginPath();g.moveTo(x,Hc);g.lineTo(x+Hc,Hc);g.lineTo(x+2*Hc,0);g.lineTo(x+Hc,0);g.closePath();g.fill()}});
     tex.wrapS=THREE.RepeatWrapping;
     const pm=toon({color:0xd9dcdf,rim:.15}),dm=toon({color:0x2b2b2e,rim:.1}),
       lampA=new THREE.MeshBasicMaterial({color:0x5a1410}),lampB=new THREE.MeshBasicMaterial({color:0x5a1410}),
       add=(par,geo,m,x,y,z)=>{const a=new THREE.Mesh(geo,m),o=new THREE.Mesh(geo,inkM);a.position.set(x,y,z);o.position.copy(a.position);
         geo.computeBoundingBox();const bb=geo.boundingBox,e=.018;o.scale.set(...['x','y','z'].map(k=>(bb.max[k]-bb.min[k]+e)/(bb.max[k]-bb.min[k])));a.castShadow=true;par.add(a,o);return a};
     const mkGate=(posts,AL,ped)=>{   // posts: 기둥 자리 [[x,z]…] (봉은 판 가운데 쪽으로), AL: 봉 길이, ped: 가운데 받침
       const g=new THREE.Group(),arms=[],t2=tex.clone();t2.needsUpdate=true;t2.repeat.set(AL/(AW*8),1);const am=toon({map:t2,rim:.1});
       for(const [px,pz] of posts){
         const post=new THREE.Group();post.position.set(px,0,pz);post.rotation.y=Math.atan2(pz,-px);g.add(post);   // 로컬 +x가 판 가운데 쪽
         add(post,new THREE.CylinderGeometry(.075,.085,.03,20),dm,0,.015,0);   // 받침
         add(post,new THREE.CylinderGeometry(.03,.034,AH+.1,16),pm,0,(AH+.1)/2,0);   // 기둥
         add(post,new THREE.BoxGeometry(.06,.07,.16),dm,0,AH+.13,0);   // 경고등 머리
         for(const [z,m] of [[-.05,lampA],[.05,lampB]]){const l=new THREE.Mesh(new THREE.SphereGeometry(.028,14,10),m);l.position.set(0,AH+.13+.03,z);post.add(l)}
         const piv=new THREE.Group();piv.position.set(0,AH,0);post.add(piv);
         const arm=new THREE.Group();piv.add(arm);
         add(arm,new THREE.BoxGeometry(AL,AW,AT),am,AL/2,0,0);
         add(arm,new THREE.BoxGeometry(.13,.07,.07),dm,-.08,0,0);   // 축 뒤 추
         arms.push(arm)}
       if(ped){const h=AH-AW/2;add(g,new THREE.CylinderGeometry(.09,.1,.03,20),dm,0,.015,0);add(g,new THREE.CylinderGeometry(.045,.05,h,16),pm,0,h/2,0);add(g,new THREE.CylinderGeometry(.08,.08,.025,20),dm,0,h-.012,0)}   // 가운데 받침: 내려온 봉 끝이 걸침
       g.visible=false;g.position.y=TOP;root.add(g);return {g,arms}};
     const G2=mkGate([[-XP,0],[XP,0]],XP-.045,false),G4=mkGate([[-XP,-XP],[XP,-XP],[XP,XP],[-XP,XP]],XP*Math.SQRT2-.045-.07,true);
     Ak3.barG=G2.g;Ak3.barD=G4.g;Ak3.gate={arms:G2.arms,lampA,lampB};Ak3.gateD={arms:G4.arms}}
    {const g=new THREE.Group(),mat=new THREE.MeshBasicMaterial({color:0x26262a,transparent:true,opacity:.5,depthWrite:false}),m=new THREE.Mesh(new THREE.SphereGeometry(SR,28,16),mat);
     m.scale.y=SH/SR;g.add(m);g.visible=false;g.renderOrder=4;root.add(g);Ak3.ghost={g,mat}}
    Ak3.cam=new THREE.PerspectiveCamera(40,1,.1,100);
    T.scene.add(root);Ak3.root=root;Ak3.built=true;
  }catch(e){Ak3.fail=true;try{console.warn('알까기 3D 준비 실패',e)}catch(_){}}
  return Ak3.built;
}
/* 3D 손: games/hand3d.js(테스트룸 '새 살'을 옮긴 것)를 필요할 때 한 번 불러옴. 못 쓰면 위의 캔버스 손 그대로 */
const H3W=[];   // 손 파일을 다 불러오면 부를 것들 (게임 손·홀로그램 손)
function loadHand3D(cb){
  const go=cb||(()=>{try{if(window.Hand3D)Ak3.h3=window.Hand3D(THREE,{SR,SH})}catch(e){Ak3.h3=null;try{console.warn('3D 손 준비 실패',e)}catch(_){}}});
  if(!cb){if(Ak3.h3||Ak3.h3load)return;Ak3.h3load=true}
  if(window.Hand3D)return go();
  H3W.push(go);if(H3W.length>1)return;
  const sc=document.createElement('script');sc.src='games/hand3d.js';sc.onload=()=>{while(H3W.length)H3W.shift()()};document.head.appendChild(sc);
}
/* 알 개수·색이 바뀌면 다시 만듦 */
function ak3Stones(){
  if(!Ak3.built||!OS)return;
  const key=OS.st.map(s=>OS.co[s.s]+(s.t?'j'+s.t:'')).join(',');
  if(Ak3.sKey===key)return;
  Ak3.sKey=key;
  for(const m of [...Ak3.stones,...Ak3.rings,...Ak3.blobs])Ak3.root.remove(m);
  Ak3.stones=OS.st.map(s=>{const m=s.t?jMesh(s.t,jCol(s.s)):stoneMesh(OS.co[s.s]);Ak3.root.add(m);return m});
  Ak3.blobs=OS.st.map(()=>{const b=new THREE.Mesh(Ak3.blobGeo,new THREE.MeshBasicMaterial({color:0x1a120c,transparent:true,opacity:.28,depthWrite:false}));b.rotation.x=-Math.PI/2;b.renderOrder=2;Ak3.root.add(b);return b});
  Ak3.rings=OS.st.map(()=>{const r=new THREE.Mesh(Ak3.ringGeo,Ak3.ringM);r.rotation.x=-Math.PI/2;r.visible=false;r.renderOrder=3;Ak3.root.add(r);return r});
}
/* ----- 오목 모드 바둑통 (games/omok.js의 통과 같은 모양·크기) -----
   사람마다 통 하나(Ak3.bowls[자리]), 내 통은 내 쪽 오른쪽. 넓은 화면(h)은 판 옆, 좁은 화면(v)은 판 위아래 모서리. 2D는 판 아래 펠트에 작게.
   통은 그림일 뿐(늘 가득, 규칙과 상관없음). 돌을 놓으면 통에서 판으로 날아감 */
const BR=.56,BGAP=.24,BN=27,BOWL_ST=.095,BOWL_Y=.3;
function bowlXZ(seat){
  const me=myIdx(),k=seat===(me===1?1:0)?0:1,sg=k?-1:1,sd=mySide()[1];
  if(!Ak3.on)return [sd*sg*(BW-.34),sd*sg*(BW+.26)];
  const a=BW+BGAP+BR,b=BW-BR,[x,z]=Ak3.bl==='h'?[sg*a,sg*b]:[sg*b,sg*a];
  return [x*sd,z*sd];
}
const bowlSpots=(()=>{
  const out=[],layers=[[13,.35],[9,.25],[5,.13]];let s=11;const rnd=()=>{s=(s*16807)%2147483647;return s/2147483647};
  layers.forEach(([N,R],L)=>{for(let k=0;k<N;k++){const r=R*Math.sqrt((k+.5)/N),a=k*2.39996+L*.9;out.push({x:Math.cos(a)*r,z:Math.sin(a)*r,y:.14+L*.06+rnd()*.012,rx:(rnd()-.5)*.5,rz:(rnd()-.5)*.5})}});
  return out;
})();
function bowlGroup(){
  const g=new THREE.Group();
  if(!MAT.bowl)MAT.bowl=toon({map:canvasTex(256,256,(c,w,h)=>woodPaint(c,w,h,'#b06a32','#5a2c0c',40,21)),rim:.18});
  const prof=[[0,.02],[.40,.02],[.50,.07],[.555,.18],[.535,.29],[.48,.355],[.445,.36],[.43,.31],[.39,.15],[.2,.105],[0,.1]].map(([x,y])=>new THREE.Vector2(x,y));
  const body=new THREE.Mesh(new THREE.LatheGeometry(prof,40),MAT.bowl);body.material.side=THREE.DoubleSide;body.castShadow=body.receiveShadow=true;g.add(body);
  g.add(new THREE.Mesh(new THREE.LatheGeometry(prof.slice(0,7).map(v=>new THREE.Vector2(v.x*1.04+.005,v.y)),40),new THREE.MeshBasicMaterial({color:GFX_INK,side:THREE.BackSide})));
  const sg=new THREE.SphereGeometry(BOWL_ST,14,8),mat=toon({color:0x26262a,rim:.3});
  const st=new THREE.InstancedMesh(sg,mat,BN);st.castShadow=true;g.add(st);
  const ik=new THREE.InstancedMesh(sg,new THREE.MeshBasicMaterial({color:GFX_INK,side:THREE.BackSide}),BN);g.add(ik);
  g.userData={st,ik,mat,col:0,n:-1};g.visible=false;
  return g;
}
function bowlFill(g,n){   // 통 안의 돌 n개를 아래층부터
  const u=g.userData;if(u.n===n)return;u.n=n;
  const m=new THREE.Matrix4(),q=new THREE.Quaternion(),e=new THREE.Euler(),p=new THREE.Vector3(),sc=new THREE.Vector3();
  const k=Math.min(n,BN);
  for(let i=0;i<k;i++){const b=bowlSpots[i];e.set(b.rx,i*.7,b.rz);q.setFromEuler(e);p.set(b.x,b.y,b.z);
    sc.set(1,.5,1);m.compose(p,q,sc);u.st.setMatrixAt(i,m);sc.set(1.12,.62,1.12);m.compose(p,q,sc);u.ik.setMatrixAt(i,m)}
  u.st.count=u.ik.count=k;u.st.instanceMatrix.needsUpdate=u.ik.instanceMatrix.needsUpdate=true;Ak3.dirty=true;
}
/* 통에 보이는 돌 수: 늘 가득 (시작 연출 중에는 하나씩 채워짐). 통은 그림일 뿐 규칙과는 상관없음 */
function bowlCounts(){
  if(IN.on3d&&IN.fill!=null){const k=Math.max(0,Math.floor((clock()-IN.t0-IN.fill)/IN.gap));return [Math.min(BN,k),Math.min(BN,k)]}
  return [BN,BN];
}
/* 오목 모드 표시: 판 위에 멈춰 있는 돌이 있다고 보는 줄 점(on). 움직이는 돌(그리는 자리가 OM_STILL ms 안에 바뀐 돌)은 빼고 셈 */
const OM_STILL=120,omPrev=[];
function omMarks(pos){
  const t=clock();
  const st=OS.st.map((s,i)=>{const q=pos[i]||s,L=omPrev[i];
    if(!L||Math.abs(L.x-q.x)+Math.abs(L.y-q.y)+Math.abs(L.z-q.z)>1e-4)omPrev[i]={x:q.x,y:q.y,z:q.z,t};
    const mv=L?t-omPrev[i].t<OM_STILL:false;
    return {x:q.x,z:q.z,s:s.s,u:q.lift||q.fly||mv?1:0,o:q.hide||q.y<TOP-.01||!onBoardXZ(q.x,q.z)?1:0}});
  omPrev.length=OS.st.length;
  const g=omGrid(st),on=[];for(let k=0;k<g.length;k++)if(g[k])on.push([k%NL,(k/NL)|0,g[k]-1]);
  return {on};
}
function ak3Bowls(pos){
  const on=!!(OS&&OS.om);
  Ak3.bowls.forEach((g,seat)=>{
    g.visible=on&&Ak3.boardG.visible;if(!g.visible)return;
    const [x,z]=bowlXZ(seat),u=g.userData,col=OS.co[seat];g.position.set(x,Ak3.boardG.position.y,z);
    if(u.col!==col){u.col=col;u.mat.color.setHex(col===1?0x26262a:0xece4d4)}
  });
  if(!on)return;
  const n=bowlCounts();Ak3.bowls.forEach((g,seat)=>bowlFill(g,n[seat]));
}
/* 카메라: 바로 위에서. 판과 판 둘레(떨어진 알이 놓이는 펠트 조금)가 판 자리(위 이름 칸 아래, 휴대폰은 내 정보 칸 위)에 꽉 차게. 내 쪽이 화면 아래 */
function ak3Layout(t){
  if(t-Ak3.layAt<100&&Ak3.lay)return false;
  Ak3.layAt=t;
  const st=$('#stage'),W=st.clientWidth,Hh=st.clientHeight;if(!W||!Hh||!V||!V.ak)return false;
  const B=tvBox(elAk,'ak'),[sx,sz]=mySide(),np=npOf(),om=OS&&OS.om?1:0,key=[W,Hh,B.R,sx,sz,np,om,OS&&OS.jg?1:0].join(',');
  if(key===Ak3.lay)return false;
  Ak3.lay=key;
  const fw=B.fw,fh=B.fh,fy=B.cy-fh/2;
  let s=Math.min(fw/(2*(BW+.08)),fh/(2*(BW+.45)));
  if(np>2){const full=Math.min(fw/(2*(BW+.45)),fh/(2*(BW+.45))),peek=Math.min(fw/(2*(BW+.3)),fh/(2*(BW+.45)));s=full<peek*.93?peek:full}   // 3~4명: 양옆 놓기 전 알 줄. 좁은 화면은 알 반쯤만 보이게 해서 판을 크게
  if(OS&&OS.jg)s=Math.min(fw/(2*(JBX+.03)),fh/(2*(JBZ+.03)));   // 장기 모드: 장기판 끝까지 (둘레는 아주 조금)
  if(om){const ext=2*(BW+BGAP+2*BR),sV=Math.min(fw/(2*(BW+.08)),fh/ext),sH=Math.min(fw/ext,fh/(2*(BW+.1)));Ak3.bl=sH>sV?'h':'v';s=Math.max(sV,sH)*.97}   // 오목 모드: 바둑통까지 (넓은 화면은 판 옆, 좁은 화면은 판 위아래)
  const cam=Ak3.cam,f=Math.tan(cam.fov*Math.PI/360),d=(Hh/2)/(s*f);
  cam.aspect=W/Hh;cam.position.set(0,TOP+d,0);cam.up.set(-sx,0,-sz);cam.lookAt(0,TOP,0);
  cam.setViewOffset(W,Hh,0,-((fy+fh/2)-Hh/2),W,Hh);cam.updateProjectionMatrix();cam.updateMatrixWorld();
  {const hv=(OS&&OS.jg?JBZ+.03:om?(Ak3.bl==='v'?2*(BW+BGAP+2*BR)/2:BW+.1):BW+.45)*s,cy=fy+fh/2;chipsAt(cy-hv,cy+hv)}
  Ak3.d=d;Ak3.dirty=true;
  return true;
}
/* 지금 그릴 알 자리: 연출 중이면 자취에서, 아니면 상태 그대로. 시작 연출 중이면 떨어지는 중 */
function curPos(now){
  if(!OS)return [];
  const base=OS.st.map(s=>({x:s.x,y:s.y,z:s.z,ax:0,az:0,w:s.w||0}));
  const S=Ak3.shot;
  if(S){
    const f=(now-S.t0)/1000*PHY.fps,K=S.sh.k||5;   // K: 한 장의 값 수 (장기 알은 도는 각도까지 6)
    for(const k in S.sh.tr){
      const tr=S.sh.tr[k],i=+k,f0=tr[0],m=(tr.length-1)/K,l=Math.max(0,Math.min(m-1,f-f0)),a=Math.floor(l),b=Math.min(m-1,a+1),w=l-a;
      if(!base[i])continue;
      const g=j=>tr[1+a*K+j]/1000*(1-w)+tr[1+b*K+j]/1000*w;
      base[i]={x:g(0),y:g(1),z:g(2),ax:g(3),az:g(4),w:K>5?g(5):base[i].w};
    }
  }
  {const hi=heldIdx();if(hi!==Ak3.hi.cur){Ak3.hi={prev:Ak3.hi.cur,cur:hi,t0:now}}   // 집어 든 알: 놓기 전 자리 위로 떠오름 (내려놓으면 가라앉음)
   const k=ease((now-Ak3.hi.t0)/LIFT_MS),bob=.015*Math.sin(now/260);
   if(Ak3.hi.cur>=0&&base[Ak3.hi.cur]){base[Ak3.hi.cur].y+=LIFT*k+bob*k;base[Ak3.hi.cur].lift=1}
   if(Ak3.hi.prev>=0&&base[Ak3.hi.prev]&&k<1&&OS.st[Ak3.hi.prev].u){base[Ak3.hi.prev].y+=LIFT*(1-k);base[Ak3.hi.prev].lift=1}}
  if(Ak3.pl)base.forEach((q,i)=>{const a=Ak3.pl[i];if(!a)return;const x=(now-a.t0)/PL_MS;   // 놓은 알: 놓기 전 자리에서 날아와 툭
    if(x>=1||OS.st[i].u){Ak3.pl[i]=null;return}const k=ease(Math.max(0,x));q.x=a.x+(q.x-a.x)*k;q.z=a.z+(q.z-a.z)*k;q.y=a.y+(q.y-a.y)*k+Math.sin(Math.PI*Math.max(0,x))*.7});
  if(IN.on3d&&IN.drop){   // 시작 연출: 알이 하나씩 위에서 떨어져 제자리에
    const e=now-IN.t0;
    base.forEach((q,i)=>{const d=IN.drop[i];if(!d)return;const x=(e-d.t)/d.dur;
      if(x<=0){q.hide=!d.from;if(d.from){q.x=d.from.x;q.y=d.from.y;q.z=d.from.z}return}
      if(x>=1)return;
      if(d.from){const k=ease(x);q.x=d.from.x+(q.x-d.from.x)*k;q.z=d.from.z+(q.z-d.from.z)*k;q.y=d.from.y+(q.y-d.from.y)*k+Math.sin(Math.PI*x)*.9}   // 바로 시작: 있던 자리에서 날아서 제자리로
      else q.y+=dropY(x,1.4);
    });
  }
  return base;
}
function ak3Place(now){
  const pos=curPos(now);
  {const j=OS.jg?1:0;if(Ak3.bd[0].visible!==!j){Ak3.bd[0].visible=!j;Ak3.bd[1].visible=!!j}}
  Ak3.stones.forEach((m,i)=>{
    const q=pos[i],s=OS.st[i],bl=Ak3.blobs[i];if(!q||!s){m.visible=false;if(bl)bl.visible=false;return}
    const gm=geomOf(s.t),u=m.userData;
    m.visible=!q.hide&&q.y>-1.2;
    m.position.set(q.x,q.y,q.z);m.rotation.set(-q.az,0,q.ax);m.scale.setScalar(stoneScale(q.y,gm.h));
    if(u.yaw)u.yaw.rotation.y=ownAng(s.s)+(q.w||0);   // 장기 알: 주인 쪽에서 바로 읽히는 방향 + 돈 각도
    if(bl){const gy=groundAt(q.x,q.z),h=Math.max(0,q.y-(gy+gm.h));bl.visible=m.visible&&gy>-50;
      if(bl.visible){bl.position.set(q.x+h*.5,gy+.004,q.z+h*.35);bl.scale.setScalar((1+h*.8)*gm.rv/SR);bl.material.opacity=.3/(1+h*5)}}   // 뜬 만큼 그림자가 옆으로 벌어지고 흐려짐
  });
  // 고리: 내 차례면 튕길 수 있는 내 알, 상대가 당기는 중이면 그 알 (내가 당기는 중에는 손이 보여 줌)
  const me=myIdx(),a=aimNow(now),pulse=.75+.25*Math.sin(now/260);
  Ak3.ringM.opacity=.9*pulse;
  Ak3.rings.forEach((r,i)=>{
    const s=OS.st[i],q=pos[i];
    const on=!!s&&!s.o&&!s.u&&V.st==='play'&&!Ak3.shot&&!FLK&&!introWait()&&(a?(!a.mine&&a.i===i):(myTurnNow()&&s.s===me));
    r.visible=on;if(on){r.position.set(q.x,TOP+.004,q.z);r.scale.setScalar(geomOf(s.t).rv/SR*(s.t?.84:1))}
  });
  // 놓기: 놓을 수 없는 곳에 빨간 빗금(2명은 상대 쪽 반, 3~4명은 내 삼각형 말고 나머지)과 차단기, 미리 보기
  {const on=myPlaceNow(),me=myIdx(),[sx,sz]=mySide(),om=!!OS.om,np=npOf(),B=Ak3.bar;
   const pl=!om&&OS.ph==='place'&&V.st==='play'&&!introWait();
   if(pl!==B.on){B.on=pl;B.t0=now}
   const k=ease((now-B.t0)/BAR_MS),bk=B.on?k:1-k;   // 놓기 단계가 되면 차단기가 서고 빗금이 나타남, 끝나면 들어가며 사라짐
   if(om){Ak3.barG.visible=Ak3.barD.visible=false}else gateStep(now,B);
   const hm=np>2?Ak3.wedge:Ak3.half;(np>2?Ak3.half:Ak3.wedge).visible=false;
   if(hm.visible){const m=hm.material.map;m.offset.x=(now/2600)%1}   // 빗금은 늘 한쪽으로 흘러감
   hm.visible=!om&&bk>.01&&me>=0&&me<np;
   if(hm.visible){hm.material.opacity=.32*bk;
     if(np===2)hm.position.set(0,TOP+.003,-sz*(PITCH/2+hm.userData.h/2));
     else{hm.position.set(0,TOP+.003,0);const key=sx+','+sz;
       if(Ak3.wedgeKey!==key){Ak3.wedgeKey=key;const L=BW-.06,P=hm.geometry.attributes.position,U=hm.geometry.attributes.uv,pa=[],ua=[];
         for(const [ax,az] of SIDES){if(ax===sx&&az===sz)continue;   // 내 쪽 빼고 세 삼각형
           for(const [x,z] of [[0,0],[L*(ax+az),L*(az-ax)],[L*(ax-az),L*(az+ax)]]){pa.push(x,0,z);ua.push(x/.46,-z/.46)}}
         P.array.set(pa);U.array.set(ua);P.needsUpdate=U.needsUpdate=true}}}
   const gh=Ak3.ghost;gh.g.visible=on&&!!GH;
   if(gh.g.visible){const [x,z]=gridXZ(GH.c,GH.r);gh.g.position.set(x,TOP+SH,z);gh.mat.color.setHex(stC(OS.co[me]).h)}}
  ak3Bowls(pos);
  {const M=OS.om&&V.st!=='wait'&&!IN.on3d?omMarks(pos):{on:[]},used=[0,0];
   Ak3.omOn.forEach(a=>a.forEach(m=>{m.visible=false}));
   for(const [c,r,sd] of M.on){const col=OS.co[sd]===1?0:1,pool=Ak3.omOn[col],ix=used[col]++;let m=pool[ix];if(!m){m=Ak3.omMake(col);pool[ix]=m}const [x,z]=gridXZ(c,r);m.position.set(x,TOP+.0035,z);m.visible=true}
  }
  // 오목: 이긴 줄 위에 금색 띠
  {const ln=V.st==='over'&&OS.res&&OS.res.ln,w=Ak3.winM;w.visible=!!(ln&&ln.length>1);
   if(w.visible){const [x0,z0]=gridXZ(...ln[0]),[x1,z1]=gridXZ(...ln[ln.length-1]),L=Math.hypot(x1-x0,z1-z0);
     w.position.set((x0+x1)/2,TOP+2*SH+.02,(z0+z1)/2);w.rotation.set(0,-Math.atan2(z1-z0,x1-x0),0);w.scale.set(L+PITCH*.7,1,PITCH*.22)}}
  // 손
  const H3=Ak3.hand,hd=handNow(now,pos);
  Ak3.hd=hd;
  if(hd&&Ak3.h3){H3.g.visible=false;Ak3.root.updateMatrixWorld(true);Ak3.h3.set({x:hd.x,z:hd.z,ang:hd.ang,j:hd.j||0,p:hd.p,fl:hd.fl,seat:hd.seat,top:TOP+(hd.dh||0),base:Ak3.root.matrixWorld})}
  else if(hd){
    if(Ak3.h3)Ak3.h3.set(null);
    const r=handCanvas(hd.p,hd.fl,hd.seat,hd.op);if(r.changed)H3.tex.needsUpdate=true;
    H3.g.visible=true;H3.g.position.set(hd.x,TOP+2*(SH+(hd.dh||0))+.12,hd.z);H3.g.rotation.set(0,-hd.ang,0);
  }else{H3.g.visible=false;if(Ak3.h3)Ak3.h3.set(null)}
}
/* 튕긴 뒤 소리: 자취와 같은 시각에 */
function shotSounds(now){
  const S=Ak3.shot;if(!S)return;
  const e=now-S.t0,ev=S.sh.ev||[];
  if(!S.flick){S.flick=1;if(!(Ak3.flickAt&&now-Ak3.flickAt<1500)&&e<400)sndFlick()}   // 내가 튕긴 소리는 놓을 때 이미 냄
  if(e<0)return;   // 손가락이 닿기 전
  while(S.ei<ev.length&&ev[S.ei][0]<=e){const [,k,v]=ev[S.ei++];if(e-ev[S.ei-1][0]>300)continue;if(k==='c')sndClack(v);else if(k==='b')sndTap(v);else if(k==='f')sndDrop(v);else sndWall(v)}
  if(e>=S.sh.dur+60){Ak3.shot=null;Ak3.dirty=true;drawAll()}
}
function ak3Render(t){
  if(!Ak3.on||!T.ok)return;
  if(ak3Layout(t))Ak3.dirty=true;
  ak3Stones();
  shotSounds(t);
  const intro=IN.on3d&&introStep(t);
  const busy=!!(Ak3.shot||intro||drag||FLK||(OS&&OS.aim&&OS.ph==='aim')||myTurnNow()||myPlaceNow()||(OS&&OS.hd>=0)||gateTimes(Ak3.bar,t).busy||(OS&&OS.ph==='place')||(Ak3.pl&&Ak3.pl.some(Boolean)));   // 움직이는 것이 없으면 가끔만 그림
  if(!busy&&!Ak3.dirty&&t-Ak3.lastR<400)return;
  ak3Place(t);
  const fog=T.scene.fog,fn=fog?fog.near:0,ff=fog?fog.far:0;
  if(fog){fog.near=Ak3.d+4;fog.far=Ak3.d+26}
  for(const m of [T.timerBg,T.timerArc,T.ring])if(m)m.visible=false;
  let cam=Ak3.cam;
  {const k=OS&&OS.om?0:gateTimes(Ak3.bar,t).cam;   // 놓기 동안: 내 쪽에서 비스듬히 (차단기가 서 있는 게 보이게), 끝나면 천천히 바로 위로
   if(k>.001&&!intro){const tc=Ak3.tcam||(Ak3.tcam=new THREE.PerspectiveCamera()),[sx,sz]=mySide(),th=GATE.tilt*k,d=Ak3.d*(1+.06*k);
     tc.position.set(sx*d*Math.sin(th),TOP+d*Math.cos(th),sz*d*Math.sin(th));tc.up.set(-sx,0,-sz);tc.lookAt(0,TOP,0);
     tc.projectionMatrix.copy(Ak3.cam.projectionMatrix);tc.projectionMatrixInverse.copy(Ak3.cam.projectionMatrixInverse);tc.updateMatrixWorld();cam=tc}}
  {const k=intro&&IN.fromLobby?ease((t-IN.t0)/INTRO.cam):1;
   if(k<1){   // 시작 연출: 이 기기의 로비 카메라에서 알까기 카메라로 위치·방향·화면 범위를 함께 옮김
     const ic=Ak3.icam||(Ak3.icam=new THREE.PerspectiveCamera());
     ic.position.copy(T.cam.position).lerp(Ak3.cam.position,k);ic.quaternion.copy(T.cam.quaternion).slerp(Ak3.cam.quaternion,k);
     const a=T.cam.projectionMatrix.elements,b=Ak3.cam.projectionMatrix.elements,m=ic.projectionMatrix.elements;
     for(let j=0;j<16;j++)m[j]=a[j]+(b[j]-a[j])*k;
     ic.projectionMatrixInverse.copy(ic.projectionMatrix).invert();ic.updateMatrixWorld();
     if(fog){fog.near=fn+(fog.near-fn)*k;fog.far=ff+(fog.far-ff)*k}
     cam=ic;
   }}
  Ak3.vcam=cam;T.r.render(T.scene,cam);
  if(Ak3.h3&&Ak3.hd){const hd=Ak3.hd;Ak3.h3.draw(T.r,cam,hd.op,Math.max(.85,handOp(hd.p))*(hd.fade==null?1:hd.fade))}   // 3D 손은 판·알 위에 늘 보이게 따로 그려 얹음
  if(fog){fog.near=fn;fog.far=ff}
  Ak3.lastR=t;Ak3.dirty=false;
}
/* 누른 곳의 월드 좌표 (알 가운데 높이의 평면) */
const akRay=()=>Ak3.ray||(Ak3.ray=new THREE.Raycaster());
function ak3World(e){
  const r=T.r.domElement.getBoundingClientRect();if(!r.width)return null;
  const ray=akRay();ray.setFromCamera({x:(e.clientX-r.left)/r.width*2-1,y:-(e.clientY-r.top)/r.height*2+1},Ak3.vcam||Ak3.cam);   // 지금 그린 카메라 (놓기 동안은 기운 카메라)
  const o=ray.ray.origin,dv=ray.ray.direction;if(Math.abs(dv.y)<1e-6)return null;
  const k=(TOP+SH-o.y)/dv.y;return [o.x+dv.x*k,o.z+dv.z*k];
}

/* ---------- 시작 연출 (방장이 그동안 시간·봇을 멈춤) ----------
   처음: 0~1.1초 로비 카메라 → 알까기 카메라, 0.1~0.5초 판이 내려앉음, 0.6초부터 알이 양쪽 번갈아 하나씩 판 바깥 놓기 전 자리(내 쪽 펠트)에 떨어짐, 끝에 '○○님이 흑으로 먼저 놓습니다'
   바로 시작: 판은 그대로, 있던 자리(판 밖에 떨어진 알 포함)에서 알이 날아와 제자리에 */
const PL_MS=420;   // 놓은 알이 날아가는 시간
const LIFT=.22,LIFT_MS=220,BAR_MS=520;   // 집어 든 알이 뜨는 높이·시간, 빗금이 나타나는 시간
/* 건널목 차단기 (놓기 동안): 기둥이 툭 떨어져 서고(쿵) → 경고등이 번갈아 깜빡이며 '땡땡' → 봉이 천천히 내려옴. 끝나면 '땡땡' 하며 봉이 올라가고 기둥이 들려 사라짐.
   그동안 카메라는 내 쪽에서 비스듬히(GATE.tilt) 천천히 기울고, 끝나면 봉이 반쯤 올라갔을 때부터 천천히 바로 위로 돌아옴 */
const GATE={post:450,arm0:500,arm:1100,bell:380,cam:1100,tilt:24*Math.PI/180};
function gateTimes(B,now){
  const e=now-B.t0,G2=GATE;
  if(B.on)return {e,post:Math.min(1,e/G2.post),up:1-ease((e-G2.arm0)/G2.arm),bell:e>=G2.post&&e<G2.arm0+G2.arm+250,cam:ease(e/G2.cam),busy:e<G2.arm0+G2.arm+600};
  const lift=(e-G2.arm*.8)/G2.post;
  return {e,post:lift>=1?-1:2+Math.max(0,lift),up:ease(e/(G2.arm*.8)),bell:e<G2.arm*.8,cam:1-ease((e-G2.arm*.4)/G2.cam),busy:e<G2.arm*.4+G2.cam+100};
}
function gateStep(now,B){   // 두 명은 가운데 줄 차단기(barG), 세·네 명은 대각선 차단기 넷(barD)
  const four=npOf()>2,g=Ak3.gate,T2=gateTimes(B,now),bar=four?Ak3.barD:Ak3.barG;(four?Ak3.barG:Ak3.barD).visible=false;
  bar.visible=T2.post>=0&&!(B.on&&T2.e<0);
  if(bar.visible)bar.position.y=TOP+(T2.post<=1?dropY(T2.post,1.6):1.8*ease(T2.post-2));
  if(B.on&&T2.post>=.68&&!B.thud){B.thud=1;tone(140,.12,{type:'triangle',vol:.16});hiss(.08,{freq:900,vol:.1})}
  if(!B.on)B.thud=0;
  for(const a of (four?Ak3.gateD:g).arms)a.rotation.z=T2.up*Math.PI/2;   // 1 = 서 있음, 0 = 경계 위로 내려옴
  const k=Math.floor(T2.e/GATE.bell);
  g.lampA.color.setHex(T2.bell&&k%2===0?0xff3b2a:0x5a1410);g.lampB.color.setHex(T2.bell&&k%2===1?0xff3b2a:0x5a1410);
  if(T2.bell&&k!==B.bk&&T2.e>=0){B.bk=k;tone(1480,.09,{type:'triangle',vol:.07});tone(1975,.07,{type:'sine',vol:.04,at:.01})}   // 땡
  return T2;
}
function heldIdx(){   // 지금 떠 있는 알: 내가 미리 보기를 골랐으면 내 다음 알, 아니면 방장이 알려 준 사람(상대·봇)의 다음 알
  if(!OS||OS.ph!=='place'||!V||V.st!=='play')return -1;
  const me=myIdx();if(me>=0&&me<npOf()&&V.t===me)return GH?nextOf(me):-1;
  return OS.hd>=0?nextOf(OS.hd):-1;
}
const INTRO={cam:1100,board:[100,400],drop:600,dur:320};
G.introMs=again=>again?1500:2600;
const IN={on:false,on3d:false,t0:0,fromLobby:true,said:false,snd:{},drop:null,total:2600};
const introOn=()=>IN.on&&clock()<IN.t0+IN.total;
const introWait=()=>introOn()&&!IN.said;
const dropY=(x,h)=>x>=1?0:x<.68?h*(1-(x/.68)*(x/.68)):h*.1*Math.sin(Math.PI*(x-.68)/.32);
G.intro=(t0,o)=>{
  if(!V||!V.ak||!V.ps)return;
  const again=!!(o&&o.again)&&Ak3.on;
  IN.on=true;IN.t0=t0;IN.said=false;IN.snd={};IN.fromLobby=!Ak3.on;IN.on3d=true;IN.total=(o&&o.total)||G.introMs(again);
  OS=buildS(V.ak);
  // 알마다 떨어지는 시각 (양쪽 번갈아). 바로 시작이면 지금 보이는 자리에서 날아옴
  const n=OS.st.length,np=OS.np||2,per=Math.floor(n/np),gap=Math.min(110,(IN.total-INTRO.drop-INTRO.dur-500)/Math.max(1,n));
  const order=[];for(let k=0;k<per;k++)for(let q=0;q<np;q++)order.push(q*per+k);   // 사람마다 번갈아
  const from=again&&Ak3.stones.length===n?Ak3.stones.map(m=>m.visible?{x:m.position.x,y:m.position.y,z:m.position.z}:{x:m.position.x*.5,y:2,z:m.position.z*.5}):null;
  IN.drop=[];order.forEach((i,k)=>{IN.drop[i]={t:(again?150:INTRO.drop)+k*(again?Math.min(60,gap):gap),dur:again?520:INTRO.dur,from:from&&from[i]}});
  IN.fill=null;
  if(OS.om){   // 오목 모드: 처음에는 통이 판과 함께 내려앉고 돌이 하나씩 채워짐 (바로 시작이면 통은 그대로)
    IN.drop=null;IN.fill=again?null:INTRO.drop;IN.gap=Math.min(70,(IN.total-INTRO.drop-600)/BN);
  }
  Ak3.shot=null;Ak3.lastSid=OS.sid;Ak3.lastGid=OS.gid;drag=null;
  $('#stage').classList.add('ak-intro');
  lastBar='';Ak3.dirty=true;
};
function introStep(now,force){
  if(!Ak3.built||!V||!V.ak)return false;
  const e=now-IN.t0,done=force||e>=IN.total,fl=IN.fromLobby;
  if(done)IN.on3d=false;
  {const x=done||!fl?1:(e-INTRO.board[0])/INTRO.board[1];Ak3.boardG.visible=x>0;Ak3.boardG.position.y=dropY(Math.max(0,x),1.6)}
  return true;
}
function introEnd(){
  if(IN.on3d)introStep(clock(),true);
  IN.on=false;IN.on3d=false;IN.said=true;
  $('#stage').classList.remove('ak-intro');
}
function introTick(){
  if(!IN.on)return;
  const e=clock()-IN.t0,S=IN.snd,once=(k,f)=>{if(!S[k]){S[k]=1;f()}};
  if(IN.on3d&&Ak3.on&&IN.fromLobby&&e>=INTRO.board[0]+INTRO.board[1]*.68)once('thud',()=>{tone(120,.13,{type:'triangle',vol:.2});hiss(.09,{freq:650,vol:.12})});
  if(IN.on3d&&IN.drop)IN.drop.forEach((d,i)=>{if(d&&e>=d.t+d.dur*.68)once('d'+i,()=>sndTap(2.2))});   // 알이 판에 툭
  if(IN.on3d&&IN.fill!=null&&e>=IN.fill){const k=Math.floor((e-IN.fill)/IN.gap);if(k>(S.fk??-1)&&k<=BN){S.fk=k;if(k%2===0)sndBowl()}}   // 통이 채워지며 자르륵
  const sayAt=IN.total-350;
  if(e>=sayAt&&!IN.said){
    IN.said=true;$('#stage').classList.remove('ak-intro');
    const A=V&&V.ak&&V.ak.A,p=V&&V.ps&&V.ps[A];
    if(p)say(OS&&OS.jg?(A===myIdx()?'내가 초로 먼저 튕깁니다.':`${p.n}님이 초로 먼저 튕깁니다.`):A===myIdx()?'내가 흑으로 먼저 놓습니다.':`${p.n}님이 흑으로 먼저 놓습니다.`);
    sfx('turn');lastBar='';
  }
  if(e>=IN.total){IN.on=false;IN.drop=null;lastBar='';lastHint=''}
  drawAll();
}

/* ---------- 공통 코드가 부르는 화면 훅 ---------- */
G.preView=()=>{
  if(!V.ak){OS=null;return}
  const pv=PV&&PV.ak;
  OS=buildS(V.ak);
  // 새 판이면 처음부터. 튕긴 것이 새로 오면 그 자취를 재생 (늦게 들어왔거나 너무 오래된 것은 결과만)
  if(OS.gid!==Ak3.lastGid){Ak3.lastGid=OS.gid;Ak3.lastSid=OS.sid;Ak3.shot=null;drag=null}
  const sh=OS.sh;
  if(sh&&sh.id!==Ak3.lastSid){
    Ak3.lastSid=sh.id;
    if(sh.tr&&sh.age<sh.dur+300){
      Ak3.shot={sh,t0:clock()-sh.age+FLK_IN,ei:0,flick:0};drag=null;   // 손가락이 알에 닿은 뒤에 알이 나감
      const tr=sh.tr[sh.i],mine=FLK&&FLK.mine&&FLK.i===sh.i&&clock()-FLK.t0<2000;
      if(!mine&&tr&&sh.age<300&&Number.isFinite(sh.a))FLK={i:sh.i,a:sh.a,p:sh.p||.5,seat:sh.by,t0:clock()-sh.age,x:tr[1]/1000,z:tr[3]/1000,mine:false};   // 튕기기 전 자리에서 손이 탁
    }
    else Ak3.shot=null;
  }
  if(drag&&(!myTurnNow()||V.st!=='play'))drag=null;
  // 새로 놓인 알: 놓기 전 자리(오목 모드는 통)에서 날아가게 (같은 판에서 바로 앞 상태를 본 경우만)
  if(pv&&pv.gid===OS.gid&&pv.st){Ak3.pl=Ak3.pl||[];Ak3.plSnd=Ak3.plSnd||{};OS.st.forEach((q,i)=>{const o=pv.st[i];
    if(OS.om){if(o)return;const [bx,bz]=bowlXZ(q.s);Ak3.pl[i]={x:bx,y:BOWL_Y,z:bz,t0:clock()};Ak3.plSnd[i]=0;return}
    if(o&&o[6]&&!q.u){Ak3.pl[i]={x:o[0],y:o[1]+(Ak3.hi.cur===i?LIFT:0),z:o[2],t0:clock()};if(Ak3.hi.cur===i)Ak3.hi={cur:-1,prev:-1,t0:0};Ak3.plSnd[i]=0}})}
  if(!myPlaceNow())GH=null;
  else if(GH&&!canPlace(OS,myIdx(),GH.c,GH.r))setGH(null);
  G.buttons();
  if(pv&&pv.ph==='place'&&OS.ph==='aim'&&V.st==='play'&&!OS.om){say('알까기를 시작합니다.');sfx('turn')}
  // 한 번 더: 굴러가기가 끝나고 같은 사람 차례가 다시 오면
  if(pv&&pv.ph==='roll'&&OS.ph==='aim'&&V.st==='play'&&OS.sh&&V.t===OS.sh.by&&!OS.om)say(V.t===myIdx()?'한 번 더':`${nm(V.t)} 한 번 더`);
  Ak3.dirty=true;
};
G.postView=()=>{};
G.overExtra=()=>'';
G.logCue=()=>false;
G.cues=()=>{};
G.hud=inGame=>{
  if(!elAk)return;
  const on=!!(inGame&&V&&V.ak&&OS);
  elAk.hidden=!on;
  $('#stage').classList.toggle('ak-over',!!(on&&V.st==='over'));
  const d3=on&&ak3Build();
  if(d3!==Ak3.on){Ak3.on=d3;Ak3.lay='';if(Ak3.root)Ak3.root.visible=d3;$('#stage').classList.toggle('ak3d',d3);lastHint=''}
  $('#stage').classList.toggle('ak2d',on&&!d3);
  if(!on){lastBar='';lastHint='';return}
  if(d3)ak3Stones();
  drawAll();
};
G.handMarks=()=>{};
G.me=()=>{$('#numpick').hidden=true};
G.overRank=p=>{
  const r=V&&V.ak&&V.ak.res,t=p.sr===3?'탈주':p.sr?'항복':r&&r.w<0?'무승부':'';
  return t?`<span class="left">${t}</span>`:'';
};
G.no3D=true;
G.buttons=()=>{   // 튕기기는 버튼 없이 당겼다 놓음. 알을 놓을 수 있는 동안만 [놓기] (오목과 같음: 미리 보기를 고르면 켜짐)
  $('#btnPass').hidden=true;$('#btnGura').hidden=true;
  const play=$('#btnPlay'),me=myIdx(),show=!!(V&&V.ak&&V.st==='play'&&OS&&me>=0&&me<npOf()&&(OS.om||OS.ph==='place')),can=show&&!!GH&&myPlaceNow();
  play.hidden=!show;play.disabled=!can;play.classList.toggle('ready',can);
  if(show){if($('#playMain').textContent!=='놓기')$('#playMain').textContent='놓기';const sub=keyLabel(KEYS.play);if($('#playSub').textContent!==sub)$('#playSub').textContent=sub}
};
/* 매 프레임: 내 차례 남은 시간 (이름 칸), 2D 화면의 굴러가기 */
G.live=()=>{
  if(IN.on)introTick();
  if(!V||!V.ak||!OS)return;
  const t=clock(),run=V.st==='play'&&(OS.ph==='aim'||OS.ph==='place')&&!introWait()&&Number.isInteger(V.t);
  if(Ak3.pl)Ak3.pl.forEach((a,i)=>{if(a&&!Ak3.plSnd[i]&&t-a.t0>=PL_MS*.7){Ak3.plSnd[i]=1;sndTap(2.4)}});   // 놓은 알이 판에 툭
    const left=run?Math.max(0,V.deadAt-t):0,txt=run?String(Math.ceil(left/1000)):'';
  if(elBar)elAk.querySelectorAll('.ak-bar [data-ct],.ak-mebar [data-ct]').forEach(el=>{const i=+el.dataset.ct,s=run&&V.t===i?txt:'';if(el.textContent!==s)el.textContent=s;
    const low=run&&V.t===i&&left<=10000;if(el.parentNode.classList.contains('low')!==low)el.parentNode.classList.toggle('low',low)});
  const np=npOf();
  if(Ak3.shot){const k=Array.from({length:np},(_,q)=>aliveS(q)).join(',');if(k!==Ak3.aliveK){Ak3.aliveK=k;drawAll()}}   // 재생 중 알이 떨어지는 순간 점을 줄임
  else if(Ak3.aliveK)Ak3.aliveK='';
  if(!Ak3.on){
    if(Ak3.shot){shotSounds(t)}
    if(Ak3.shot||drag||FLK||(OS.aim&&OS.ph==='aim')||myTurnNow()||(Ak3.pl&&Ak3.pl.some(Boolean)))draw2D();
  }
};
G.play=()=>confirmGH();
G.pass=()=>{};
G.keyPhase=st=>st==='play';
G.onKey=()=>false;
G.field3D=()=>{if(T.stacks)for(const arr of T.stacks.values())arr.forEach(c=>{c.visible=false})};
G.render3D=t=>{if(Ak3.on)ak3Render(t);else if(T.ok&&!$('#stage').classList.contains('ak2d'))T.r.render(T.scene,T.cam)};
/* 대기실 홀로그램의 대표 말: 끝까지 당긴(풀차징) 손과 그 앞의 흑돌 (공통 frontHoloPiece가 부름). 손은 games/hand3d.js를 불러온 뒤 붙임 */
G.holoPiece=(mk)=>{
  const g=new THREE.Group(),box=new THREE.Group();g.add(box);
  const K=1.7,b=new THREE.Mesh(new THREE.SphereGeometry(SR*K,24,14),mk(0x2a2a2a));b.scale.y=SH/SR;b.position.set(SR*(K-1)-.025,SH*K,0);box.add(b);   // 알은 손보다 크게(작으면 홀로그램에서 안 보임), 손끝 바로 앞에
  const fit=()=>{box.position.set(0,0,0);box.scale.setScalar(1);g.matrixWorld.identity();box.updateMatrixWorld(true);   // 손까지 넣은 크기를 다른 말과 비슷하게, 가운데를 투사기 축에. 손은 g가 탁자에 놓인 뒤 늦게 붙으므로 g 자리·크기를 빼고 g 안 좌표로 잼
    const bb=new THREE.Box3().setFromObject(box),sz=bb.getSize(new THREE.Vector3()),c=bb.getCenter(new THREE.Vector3()),k=.62/Math.max(sz.x,sz.z,.4);
    box.scale.setScalar(k);box.position.set(-c.x*k,-c.y*k,-c.z*k)};
  fit();
  loadHand3D(()=>{try{const h=window.Hand3D(THREE,{SR,SH}).holo(mk);h.traverse(o=>{if(o.isMesh)o.renderOrder=41});box.add(h);fit()}catch(e){try{console.warn('홀로그램 손 준비 실패',e)}catch(_){}}});
  return g;
};
G.enter=()=>{
  $('#stage').classList.add('ak');
  $('#btnPass').hidden=true;$('#btnGura').hidden=true;$('#btnPlay').hidden=true;$('#numpick').hidden=true;
  drag=null;
};
G.leave=()=>{
  introEnd();drag=null;
  $('#stage').classList.remove('ak','ak-over','ak3d','ak2d','ak-intro');
  if(T.stacks)for(const arr of T.stacks.values())arr.forEach(c=>{c.visible=true});
  if(Ak3.root)Ak3.root.visible=false;Ak3.on=false;Ak3.shot=null;
  $('#btnPass').hidden=false;$('#btnPlay').hidden=false;
  if(elAk){elAk.hidden=true;lastBar='';lastHint=''}
};
G.init=()=>{
  const css=document.createElement('style');
  css.textContent=`
.stage.ak{background:radial-gradient(ellipse at 50% 38%,#f3e4c2 0%,#e2c89a 70%,#d3b27c 100%)}
.stage.ak.ak2d #cv,.stage.ak #dim{visibility:hidden}
.stage.ak.ak3d #cv{touch-action:none}
.stage.ak-intro .actions,.stage.ak-intro .myplate,.stage.ak-intro #ak .ak-row{opacity:0;pointer-events:none}
.stage.ak .actions,.stage.ak .myplate,#ak .ak-row,#ak .ak-bar,#ak .ak-mebar{transition:opacity .35s}
.stage.ak3d #ak svg{display:none}
.stage.ak3d #ak .ak-hint{flex:0 1 auto;background:rgba(255,250,240,.9);border:1px solid var(--line-strong,#cdb391);border-radius:99px;padding:4px 12px;box-shadow:0 2px 6px -2px rgba(59,42,31,.35)}
.stage.ak:not(.frwait) .labels{visibility:hidden}
.stage.ak .nogl{display:none}
.stage.ak.ak-over .myplate,.stage.ak.ak-over .actions{display:none}
.stage.ak .actions{left:auto}
.stage.ak .myplate{max-width:calc(100% - 150px)}
.specbar:not([hidden])~#ak .ak-bar{margin-top:30px}
#ak{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;gap:6px;padding:8px 10px 82px;pointer-events:none;min-height:0}
#ak[hidden]{display:none}
#ak .ak-bar{min-height:44px;display:flex;flex-wrap:wrap;justify-content:center;align-items:flex-start;align-content:flex-end;gap:6px;align-self:center;max-width:calc(100% - 188px);pointer-events:none}
#ak .ak-mebar{position:absolute;left:50%;bottom:var(--plateB,14px);transform:translateX(-50%);z-index:2;display:flex;pointer-events:none;max-width:calc(100% - 188px)}
#ak .ak-mebar:empty{display:none}
#ak .ak-p{position:relative;display:flex;align-items:center;gap:6px;padding:4px 10px 5px;border-radius:12px;background:rgba(255,250,240,.92);border:1.5px solid var(--line-strong,#cdb391);font-size:13px;line-height:1.15;white-space:nowrap;max-width:100%}
#ak .dot{width:13px;height:13px;border-radius:50%;flex:none;display:inline-block}
#ak .dot.blk{background:#222;box-shadow:0 0 0 2px #fffaf0,0 0 0 3px #555}
#ak .dot.wht{background:#f7f2e8;box-shadow:0 0 0 2px #fffaf0,0 0 0 3px #8c7a5b}
#ak .dot.red{background:#d9473a;box-shadow:0 0 0 2px #fffaf0,0 0 0 3px #7a1d14}
#ak .dot.blu{background:#3f7fe0;box-shadow:0 0 0 2px #fffaf0,0 0 0 3px #173f7a}
#ak .dot.cho{background:#17684f;box-shadow:0 0 0 2px #fffaf0,0 0 0 3px #0c3a2c}
#ak .dot.han{background:#b5241b;box-shadow:0 0 0 2px #fffaf0,0 0 0 3px #5e120d}
#ak .ak-p .cnt{font-family:var(--f-num,monospace);font-size:12px;font-weight:700;color:#5b4129;background:rgba(91,65,41,.1);border-radius:99px;padding:0 6px}
#ak .ak-p b{font-weight:600;overflow:hidden;text-overflow:ellipsis;max-width:8em}
#ak .pips{display:inline-flex;gap:2px;flex-wrap:wrap;max-width:62px}
#ak .pip{width:6px;height:6px;border-radius:50%;background:#5b4129;display:inline-block}
#ak .pip.gone{background:none;box-shadow:inset 0 0 0 1px #b9a37c}
#ak .ak-p .w{font-family:var(--f-num,monospace);font-size:13px;font-weight:700;color:#5b4129;min-width:1.4em;text-align:right}
#ak .ak-p .w:empty{display:none}
#ak .ak-p.low .w{color:#c0281c;animation:akBlink 1s steps(2,start) infinite}
@keyframes akBlink{50%{opacity:.25}}
#ak .ak-p .st{font-size:12px;color:var(--muted,#7a6550)}
#ak .ak-p.on{border-color:#c08a17;box-shadow:0 0 0 2px #f2b632}
#ak .ak-row{display:flex;align-items:flex-start;justify-content:center;width:100%;pointer-events:none;height:44px;flex:none;padding-top:4px;position:relative;z-index:1}
#ak .ak-hint:empty{visibility:hidden}
#ak .ak-hint{min-width:0;font-size:13px;line-height:1.3;color:#5b4129;text-align:center;min-height:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
#ak .ak-bd{position:relative;flex:1;min-height:0;width:100%}
#ak svg{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);pointer-events:auto;touch-action:none;user-select:none;-webkit-user-select:none}
#ak .ak-p{min-height:26px}
@media (max-width:520px){#ak .ak-p{font-size:12px;padding:3px 8px 4px;min-height:24px}#ak .pips{max-width:44px}}
@media (max-width:520px){.stage.ak2d #ak .ak-bar{align-self:flex-start;width:calc(100% - 150px);max-width:none}}
.stage.ak3d #ak .ak-row{order:-1}
.stage.ak3d #ak.lay .ak-bar{transform:translateY(calc(var(--bs) - 100%));transition:transform .35s,opacity .35s}
.stage.ak3d #ak.lay .ak-mebar{top:var(--mt);bottom:auto;transition:top .35s,opacity .35s}
.stage.ak3d .specbar:not([hidden])~#ak .ak-bar{margin-top:0}
.stage.ak3d .specbar:not([hidden])~#ak .ak-row{margin-top:30px}
.stage.ak3d #ak.wide .ak-row{position:absolute;left:16px;top:8px;width:auto;max-width:30%;justify-content:flex-start}
.stage.ak3d #ak.wide .ak-bar{min-height:0}
.stage.ak3d .specbar:not([hidden])~#ak.wide .ak-bar{margin-top:30px}
@media (max-width:699px){#ak{padding-bottom:112px}#ak .ak-mebar{bottom:70px;max-width:calc(100% - 24px)}}
`;
  document.head.appendChild(css);
  elAk=document.createElement('div');elAk.id='ak';elAk.hidden=true;
  elAk.innerHTML=`<div class="ak-bar"></div><div class="ak-mebar"></div><div class="ak-row"><div class="ak-hint" aria-live="polite"></div></div><div class="ak-bd"><svg viewBox="${-VX} ${-VY} ${2*VX} ${2*VY}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="알까기 판"><defs><pattern id="akHatch" width=".23" height=".23" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width=".075" height=".23" fill="#d6281e"/><animateTransform attributeName="patternTransform" type="translate" from="0 0" to=".23 0" dur="2.6s" repeatCount="indefinite" additive="sum"/></pattern><pattern id="akBar" width=".15" height=".15" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width=".15" height=".15" fill="#f2c230"/><rect width=".075" height=".15" fill="#1d1b19"/></pattern></defs><g id="akB"></g><g id="akS"></g></svg></div>`;
  $('#stage').insertBefore(elAk,$('#fx'));
  elSvg=elAk.querySelector('svg');elMain=elSvg;elBar=elAk.querySelector('.ak-bar');elBarMe=elAk.querySelector('.ak-mebar');elHint=elAk.querySelector('.ak-hint');
  // 당기기: 3D(캔버스)와 2D(SVG) 모두 누르기 → 끌기 → 놓기. 누른 채 화면 밖으로 끌어도 이어짐
  const bind=(el,toW,ok)=>{
    let pid=null;
    el.addEventListener('pointerdown',e=>{
      if(!ok()||G!==GAMES.alkkagi||(e.button!=null&&e.button>0))return;
      const w=toW(e);if(!w)return;
      if(dragStart(w[0],w[1])&&drag){pid=e.pointerId;try{el.setPointerCapture(pid)}catch(_){}e.preventDefault()}
    });
    el.addEventListener('pointermove',e=>{if(drag&&e.pointerId===pid){const w=toW(e);if(w)dragMove(w[0],w[1])}});
    const up=cancel=>e=>{if(e.pointerId!==pid)return;pid=null;try{el.releasePointerCapture(e.pointerId)}catch(_){}dragEnd(cancel)};
    el.addEventListener('pointerup',up(false));el.addEventListener('pointercancel',up(true));
  };
  bind($('#cv'),e=>Ak3.on&&ak3World(e),()=>Ak3.on&&!!OS);
  bind(elSvg,e=>s2w(e),()=>!Ak3.on&&!!OS);
  document.addEventListener('keydown',e=>{if(e.code!=='Escape'||!elAk||elAk.hidden)return;if(drag)dragEnd(true);else if(GH){setGH(null);sndPickUp()}});
  window.addEventListener('resize',()=>{Ak3.lay='';fit2D()});
};
G._ak3={Ak3,IN,introEnd,handCanvas,get FLK(){return FLK},get OS(){return OS},get drag(){return drag},dragStart,dragMove,dragEnd,curPos};   // 화면 검사용

(window.GAMES=window.GAMES||{}).alkkagi=G;
})();
