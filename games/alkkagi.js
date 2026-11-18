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
const G={id:'alkkagi',name:'알까기',short:'알까기',lead:'바둑알을 튕겨 상대 알을 판 밖으로',maxHi:4,noFast:true,firstPick:true};   // firstPick: 대기실 이름표 메뉴의 [선]을 씀 (주사위 연출은 아직 없음)
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
/* ---------- 물건 놓기 (바둑·장기 모드, 규칙 ob) ----------
   물건 종류 k: bh 블랙홀(움직이는 알을 끌어당기고 가운데 구멍에 빠지면 떨어진 것과 같음, 삼킬 때마다 커짐) · wh 웜홀(입구·출구 한 쌍, 양쪽 다 들어가면 다른 쪽으로 같은 속도로 나옴)
   br 벽돌(움직이지 않는 낮은 직사각형, 세게 쳐서 뜬 알은 넘어감) · tb 탱탱볼(고정 범퍼: 부딪힌 알을 더 세게 튕겨 냄) · ic 얼음판(마찰이 거의 없음) · sd 모래밭(마찰이 큼)
   jp 점프대(지나가는 알을 띄움) · bm 폭탄(알이 닿으면 터져 둘레 알을 밀어내고 사라짐, 곁의 폭탄도 같이 터짐)
   판 위 물건 {k, x, z, s 놓은 자리, o 고르기 목록 번호, r 블랙홀 구멍 반지름, n 삼킨 수, a 벽돌 방향, x2·z2 웜홀 다른 쪽, u 터진 폭탄} */
const OB_K=['bh','wh','br','tb','ic','sd','jp','bm','gl','gu','rb','tr','fn','gt','rt'];   // 판에 놓는 물건 (지우개 er·? qm은 판에 안 놓음)
const OB_NM={bh:'블랙홀',wh:'웜홀',br:'벽돌',tb:'탱탱볼',ic:'얼음판',sd:'모래밭',jp:'점프대',bm:'폭탄',gl:'유리',gu:'끈끈이',er:'지우개',rb:'랜덤박스',tr:'배신자의 길',fn:'선풍기',gt:'차단기',rt:'회전판',qm:'?'};
/* 희귀도 (0 일반 1 희귀 2 전설): 일반은 길을 막거나 빠르기만 바꿈, 희귀는 알을 옮기거나 띄우거나 물건을 바꿈, 전설은 혼자서 알을 없애거나 빼앗음(사기형)·판이 갈수록 세짐(성장형).
   고르기 목록은 물건 하나당 비율 OB_W로 뽑고(같은 물건이 두 번 나와도 됨) 전설은 한 판에 하나까지. qm '?'는 희귀 물건: 집으면 희귀도 비율대로 뽑은 물건이 되고(고른 사람만 봄) 판에 놓을 때 모두에게 보임 */
const OB_RAR={br:0,sd:0,ic:0,tb:0,gl:0,gu:0,jp:1,wh:1,er:1,rb:1,fn:1,gt:1,rt:1,qm:1,bh:2,bm:2,tr:2},OB_W=[10,5,2],OB_PICK=[...OB_K,'er','qm'];
const OB_QIN=OB_PICK.filter(k=>k!=='qm'),OB_RBIN=OB_K.filter(k=>k!=='rb');   // '?' 속(희귀도 비율), 랜덤박스에서 나오는 것(똑같은 확률)
const OB_CD=3000,OB_FLOAT=700,OB_WIN=200,OB_PUT=20000;   // 카운트다운, 고르기 전 물건이 떠오르는 시간, 선착순 판정 기다림, 놓기 제한 시간
function obDrawOne(kinds,rnd){const w=kinds.map(k=>OB_W[OB_RAR[k]]),sum=w.reduce((a,b)=>a+b,0);let x=rnd()*sum;for(let i=0;i<kinds.length;i++){x-=w[i];if(x<0)return kinds[i]}return kinds[kinds.length-1]}
function obDraw(n,rnd){rnd=rnd||Math.random;const out=[];let leg=false;for(let i=0;i<n;i++){const k=obDrawOne(OB_PICK.filter(k=>!leg||OB_RAR[k]<2),rnd);if(OB_RAR[k]===2)leg=true;out.push(k)}return out}
const IT={bh:{rc:.13,R:.8,G:.8,grow:.03,rmax:.27},wh:{r:.15,sep:.9},br:{L:.3,W:.075,H:.09,e:.45},tb:{r:.12,e:1.25,vmin:3,vmax:9},ic:{r:.5,f:.12},sd:{r:.42,f:4},jp:{r:.14,k:.75,vmax:5},bm:{r:.11,R:1,v:7.5,vy:2.6},
  gl:{L:.32,W:.03,H:.11,e:.5,vb:3,slow:.5},gu:{r:.45,c:3.5},rb:{r:.12,e:.45},tr:{L:.4,W:.07},
  fn:{r:.12,L:1.2,W:.2,F:9},gt:{L:.75,W:.025,hp:.075,P:8000,dn:3400,mv:600,e:.4},rt:{L:.42,W:.025,H:.1,P:8000,e:.5,kick:1}};
/* 3단계 (시간에 따라 움직이거나 치지 않아도 미는 물건). 시각은 방장 시계(놓은 시각 o.t0, 튕긴 시각 shot.ht).
   선풍기 fn: 몸통 반지름 r, 앞쪽 길이 L·반 폭 W 바람 띠 안의 알을 F로 밂(마찰보다 셈 → 멈춘 알도 밀려 띠 밖으로).
   차단기 gt: 기둥(x,z)에서 방향 a로 길이 L인 막대. 한 주기 P: 처음 dn 동안 내려감 → mv 동안 올라감 → 내려가기 mv 전까지 올라가 있음 → mv 동안 내려옴. 내려온 막대에 걸린 알은 옆으로 밀려남.
   회전판 rt: 가운데(x,z), 반 길이 L 막대가 P에 한 바퀴(방향 o.dir), 처음 각도 a. 막대에 닿은 알은 밖으로 밀려남.
   이 물건들의 자리(바람 띠·막대 자리·회전 원)에는 알이 쉬지 않음: 튕긴 뒤 그 안의 알이 밀려 나갈 때까지 계산을 이어감 */
const OB_ANG={br:1,gl:1,tr:1,fn:1,gt:1};   // 놓을 때 방향을 정하는 물건
const gateTh=(o,T)=>{const g=IT.gt,ph=(((T-(o.t0||0))%g.P)+g.P)%g.P,up=Math.PI/2,e=x=>x*x*(3-2*x);return ph<g.dn?0:ph<g.dn+g.mv?up*e((ph-g.dn)/g.mv):ph<g.P-g.mv?up:up*(1-e((ph-(g.P-g.mv))/g.mv))};   // 차단기 막대가 든 각도 (0 내려감)
const rotAng=(o,T)=>(o.a||0)+(o.dir||1)*2*Math.PI*(T-(o.t0||0))/IT.rt.P;   // 회전판 막대 각도
function gateDist(o,x,z){const c=Math.cos(o.a||0),s=Math.sin(o.a||0),dx=x-o.x,dz=z-o.z,lx=dx*c+dz*s,lz=-dx*s+dz*c,cl=Math.max(0,Math.min(IT.gt.L,lx));return Math.hypot(lx-cl,lz)}
function inWind(o,x,z,m){const c=Math.cos(o.a||0),s=Math.sin(o.a||0),dx=x-o.x,dz=z-o.z,lx=dx*c+dz*s-IT.fn.r,lz=-dx*s+dz*c;m=m||0;return lx>=-m&&lx<=IT.fn.L+m&&Math.abs(lz)<=IT.fn.W+m}   // 크기·세기 (쳐 보고 맞출 값). 유리: 정면 속도 vb 미만이면 튕기고 깨짐, 넘으면 깨고 지나가며 slow배. 끈끈이: 빠를수록 많이 느려짐 (속도 × e^(−c·시간))
const OB_ZONE={ic:1,sd:1,gu:1};
const OB_BOX={br:1,gl:1,tr:1};   // 방향 있는 직사각형 (가운데 x,z, 방향 a, 반 길이 L·반 폭 W)   // 바닥에 까는 물건 (알이 위에 있어도 놓을 수 있음)
const bhR=o=>IT.bh.R+((o.r||IT.bh.rc)-IT.bh.rc)*3;   // 블랙홀이 끌어당기는 범위 (구멍이 커지면 같이 넓어짐)
const itFp=o=>o.k==='bh'?(o.r||IT.bh.rc)+.08:OB_BOX[o.k]?IT[o.k].L:o.k==='gt'?.08:o.k==='rt'?IT.rt.L:IT[o.k].r;   // 물건끼리 겹침을 재는 반지름
const itPts=o=>o.k==='wh'?[[o.x,o.z],[o.x2,o.z2]]:o.k==='gt'?[0,.5,1].map(f=>[o.x+Math.cos(o.a||0)*IT.gt.L*f,o.z+Math.sin(o.a||0)*IT.gt.L*f]):[[o.x,o.z]];
/* 벽돌(가운데 x,z, 방향 a)에서 점까지 거리 */
function brDist(o,x,z){const D=IT[o.k]&&IT[o.k].L?IT[o.k]:IT.br,c=Math.cos(o.a||0),s=Math.sin(o.a||0),dx=x-o.x,dz=z-o.z,lx=dx*c+dz*s,lz=-dx*s+dz*c;return Math.hypot(Math.max(0,Math.abs(lx)-D.L),Math.max(0,Math.abs(lz)-D.W))}
/* 물건 하나를 놓을 수 있는지 (A: 판 상태 {st, it, jg}). 판 안쪽, 판 위 알과 안 겹침(바닥 물건은 괜찮음), 다른 물건과 안 겹침(바닥 물건끼리·서 있는 물건끼리), 웜홀 두 쪽은 멀리 */
function canPut(A,o){
  if(!o||!OB_K.includes(o.k)||!Number.isFinite(o.x)||!Number.isFinite(o.z))return false;
  if(o.k==='wh'&&!(Number.isFinite(o.x2)&&Number.isFinite(o.z2)&&Math.hypot(o.x2-o.x,o.z2-o.z)>=IT.wh.sep))return false;
  if(OB_ANG[o.k]&&!Number.isFinite(o.a))return false;
  useBoard(A.jg);
  const fp=itFp(o),M=.06,inB=(x,z,m)=>Math.abs(x)<=BD.x-m-M&&Math.abs(z)<=BD.z-m-M;
  if(OB_BOX[o.k]){const c=Math.cos(o.a),s=Math.sin(o.a),L=IT[o.k].L,W=IT[o.k].W;for(const [u,v] of [[L,W],[L,-W],[-L,W],[-L,-W]])if(!inB(o.x+u*c-v*s,o.z+u*s+v*c,0))return false}
  else if(!itPts(o).every(([x,z])=>inB(x,z,o.k==='bh'?(o.r||IT.bh.rc)+.06:o.k==='rt'?IT.rt.L+.03:fp)))return false;
  if(!OB_ZONE[o.k])for(const q of A.st){if(q.u||q.o||q.g)continue;const rv=geomOf(q.t).rv;
    if(OB_BOX[o.k]){if(brDist(o,q.x,q.z)<rv+.03)return false;continue}
    if(o.k==='gt'){if(gateDist(o,q.x,q.z)<rv+IT.gt.W+.04)return false;continue}   // 막대가 내려오는 자리
    if(o.k==='rt'){if(Math.hypot(q.x-o.x,q.z-o.z)<IT.rt.L+rv+.04)return false;continue}   // 도는 원
    if(o.k==='fn'&&inWind(o,q.x,q.z,rv))return false;   // 바람 띠 안에 알 금지
    const need=o.k==='bh'?(o.r||IT.bh.rc)+rv+.06:fp+rv+.03;
    if(itPts(o).some(([x,z])=>Math.hypot(q.x-x,q.z-z)<need))return false}
  for(const p of A.it||[]){if(p.u||!!OB_ZONE[p.k]!==!!OB_ZONE[o.k])continue;const f=fp+itFp(p)+.03;   // 터진 폭탄·깨진 유리·상자 자리는 비어 있음
    for(const [x,z] of itPts(o))for(const [px,pz] of itPts(p))if(Math.hypot(x-px,z-pz)<f)return false}
  return true;
}
/* 웜홀 첫 구멍 자리만 볼 때 (화면이 둘째 구멍을 고르기 전): 판 안쪽, 알·서 있는 물건과 안 겹침 */
function endFree(A,x,z){
  useBoard(A.jg);const r=IT.wh.r;if(!(Math.abs(x)<=BD.x-r-.06&&Math.abs(z)<=BD.z-r-.06))return false;
  for(const q of A.st){if(q.u||q.o||q.g)continue;if(Math.hypot(q.x-x,q.z-z)<r+geomOf(q.t).rv+.03)return false}
  for(const p of A.it||[]){if(p.u||OB_ZONE[p.k])continue;for(const [px,pz] of itPts(p))if(Math.hypot(x-px,z-pz)<r+itFp(p)+.03)return false}
  return true;
}
const halfH=q=>{const t=tiltOf(q);return q.h*Math.cos(t)+q.r*Math.sin(t)};   // 기울어진 알의 반높이 (가장자리로 서면 높아짐)
/* 한 번 튕기기: st(알 목록 {x,y,z,s,o,g, t 장기 알 종류, w 돈 각도})에서 shot.i번 알을 (vx,vz)로. 기울기 (ax,az): +x·+z 쪽 가장자리가 올라간 각도
   알마다 크기·무게(geomOf)가 다를 수 있음: 부딪힘은 무게 비율로 나눠 받음. 비껴 부딪히면 마찰로 돎(wy, 장기 알만 자취에 각도를 남김)
   its: 판 위 물건(물건 놓기). 물건이 낀 일은 ev에 물건 번호도 [ms, 종류, 세기, 물건 번호] (h 블랙홀이 삼킴, p 웜홀, k 벽돌, u 탱탱볼, j 점프대, x 폭탄)
   돌려줌: fin 끝난 자리, tr 움직인 알의 자취 {번호: [시작 장, x,y,z,ax,az(,w)(1000배 정수)…]}, k 한 장의 값 수(5, 장기 알이 있으면 6), nf 장 수, ev 소리 [[ms, 종류, 세기]], of 떨어진 시각 {번호: ms}, dur 길이(ms), it 끝난 물건(블랙홀 크기·터진 폭탄) */
function simulate(st,shot,rnd,its){
  rnd=rnd||Math.random;
  const P=PHY,dt=P.dt,S=st.map(s=>({...geomOf(s.t),x:s.x,y:s.y,z:s.z,o:s.o?1:0,g:s.g?1:0,s:s.s,t:s.t||0,w:s.w||0,wy:0,vx:0,vy:0,vz:0,ax:0,az:0,bx:0,bz:0,aw:0,still:0}));
  const SPIN=S.some(q=>q.t),K=SPIN?6:5;   // 장기 알: 도는 각도도 자취에
  const ev=[],frames=[],every=Math.round(1/(P.fps*dt)),of={};   // of: 판에서 떨어진 시각(ms) {번호: ms} (화면이 남은 알 수를 그 순간에 줄임)
  const rec=()=>frames.push(S.map(q=>SPIN?[q.x,q.y,q.z,q.ax,q.az,q.w]:[q.x,q.y,q.z,q.ax,q.az]));
  const push=(k,v,step)=>{if(ev.length<60)ev.push([Math.round(step*dt*1000),k,Math.round(v*100)/100])};
  /* 물건 */
  const IS=(its||[]).map(o=>({...o})),ITM=IS.length>0,BHS=IS.some(o=>o.k==='bh'),ZN=IS.some(o=>OB_ZONE[o.k]),GU=IS.some(o=>o.k==='gu'),sw=[];
  const by=shot.by??S[shot.i].s,nx=shot.nx??(by===0?1:0);   // 배신자의 길: 튕긴 사람 by, 그다음 사람 nx
  const T0=shot.ht||0,FNS=IS.filter(o=>o.k==='fn'),ACT=IS.some(o=>o.k==='fn'||o.k==='gt'||o.k==='rt');
  const inAct=q=>{if(q.o||q.g||!onBoardXZ(q.x,q.z))return false;for(const o of IS){if(o.u)continue;   // 알이 쉴 수 없는 자리 (바람 띠·차단기 막대 자리·회전 원)
    if(o.k==='fn'&&inWind(o,q.x,q.z))return true;if(o.k==='gt'&&gateDist(o,q.x,q.z)<q.r+IT.gt.W+.01)return true;if(o.k==='rt'&&Math.hypot(q.x-o.x,q.z-o.z)<IT.rt.L+q.r+.01)return true}return false};
  const glueK=(x,z)=>{for(const o of IS)if(o.k==='gu'&&Math.hypot(x-o.x,z-o.z)<IT.gu.r)return IT.gu.c;return 0};
  const pushI=(k,v,step,ii)=>{if(ev.length<120)ev.push([Math.round(step*dt*1000),k,Math.round(v*100)/100,ii])};
  const low=(q,h)=>q.y-halfH(q)<TOP+h;   // 알 아랫면이 판 윗면에서 h보다 낮음 (뜬 알은 서 있는 물건을 넘어감)
  const zoneMul=(x,z)=>{let m=1;for(const o of IS){if(o.k==='ic'&&Math.hypot(x-o.x,z-o.z)<IT.ic.r)m=Math.min(m,IT.ic.f);else if(o.k==='sd'&&Math.hypot(x-o.x,z-o.z)<IT.sd.r)m=Math.max(m,IT.sd.f)}return m};
  const bhPull=q=>{for(const o of IS){if(o.k!=='bh')continue;const dx=o.x-q.x,dz=o.z-q.z,d=Math.hypot(dx,dz),R=bhR(o);if(d>=R||d<1e-6)continue;   // 블랙홀: 가까울수록 세게 (움직이는 알만. 마찰보다 약한 곳에 멈춘 알은 그대로)
    const dc=Math.max(.1,d),a=IT.bh.G*(o.r/IT.bh.rc)/(dc*dc)*(1-d/R)*dt;q.vx+=dx/d*a;q.vz+=dz/d*a}};
  const boom=(ii,step)=>{const o=IS[ii];if(o.u)return;o.u=1;pushI('x',1,step,ii);   // 폭탄: 둘레 알을 밖으로 밀고 띄움, 곁의 폭탄도 터짐
    for(const b of S){if(b.g)continue;const dx=b.x-o.x,dz=b.z-o.z,d=Math.hypot(dx,dz);if(d>=IT.bm.R)continue;const f=1-d/IT.bm.R,ux=d>1e-6?dx/d:Math.cos(rnd()*6.28),uz=d>1e-6?dz/d:Math.sin(rnd()*6.28);
      b.vx+=ux*IT.bm.v*f;b.vz+=uz*IT.bm.v*f;b.vy+=IT.bm.vy*f;b.y+=.004;b.bx+=(rnd()-.5)*24*f;b.bz+=(rnd()-.5)*24*f;b.aw=1;b.still=0}
    IS.forEach((p,j)=>{if(p.k==='bm'&&!p.u&&Math.hypot(p.x-o.x,p.z-o.z)<IT.bm.R*.8)boom(j,step)})};
  const itemStep=(q,step)=>{   // 알 하나가 물건에 닿았는지 (판 위에서만). 블랙홀에 빠지면 true
    if(!onBoardXZ(q.x,q.z)||q.y<TOP-.05)return false;
    for(let ii=0;ii<IS.length;ii++){const o=IS[ii];if(o.u)continue;
      const k=o.k,dx=q.x-o.x,dz=q.z-o.z,d=Math.hypot(dx,dz);
      if(k==='bh'){if(d<o.r&&low(q,.06)){const i=S.indexOf(q);if(!q.o)of[i]=Math.round(step*dt*1000);
          q.o=1;q.g=1;q.aw=0;q.vx=q.vy=q.vz=0;q.wy=0;q.x=o.x;q.z=o.z;q.y=-2;o.r=Math.min(IT.bh.rmax,o.r+IT.bh.grow);o.n=(o.n||0)+1;pushI('h',1,step,ii);return true}}
      else if(k==='wh'){for(const e of [0,1]){const px=e?o.x2:o.x,pz=e?o.z2:o.z,de=Math.hypot(q.x-px,q.z-pz),id=ii*2+e;
          if(q.wl===id){if(de>IT.wh.r+q.r)q.wl=-1;continue}
          if(de<IT.wh.r&&low(q,.05)){const tx=e?o.x:o.x2,tz=e?o.z:o.z2;q.x=tx+(q.x-px);q.z=tz+(q.z-pz);q.wl=ii*2+(1-e);pushI('p',Math.hypot(q.vx,q.vz),step,ii);break}}}
      else if(k==='tr'){   // 배신자의 길: 알 가운데가 띠를 가로질러 넘어가면 주인이 바뀜 (뜬 알·장기 장은 그대로)
        const c=Math.cos(o.a),s=Math.sin(o.a),lx=dx*c+dz*s,lz=-dx*s+dz*c,side=lz>=0?1:-1,key='t'+ii,prev=q[key];q[key]=side;
        if(prev&&prev!==side&&Math.abs(lx)<=IT.tr.L&&low(q,.03)&&q.t!==7){const from=q.s,to=from!==by?by:nx;
          if(to!=null&&to>=0&&to!==from){const i=S.indexOf(q);q.s=to;sw.push([Math.round(step*dt*1000),i,from,to]);pushI('v',i,step,ii)}}}
      else if(k==='fn'){if(!low(q,.22))continue;const rs=q.r+IT.fn.r;if(d>=rs||d<1e-9)continue;   // 선풍기 몸통
        const nx2=dx/d,nz2=dz/d;q.x=o.x+nx2*rs;q.z=o.z+nz2*rs;const vn=q.vx*nx2+q.vz*nz2;if(vn<0){q.vx-=1.45*vn*nx2;q.vz-=1.45*vn*nz2;if(-vn>.5)pushI('k',-vn,step,ii)}}
      else if(k==='gt'){   // 차단기: 막대가 그 자리에서 알과 높이가 겹치면 옆으로 밀어냄 (내려온 막대는 낮은 벽)
        const g=IT.gt,c=Math.cos(o.a),s=Math.sin(o.a),lx=dx*c+dz*s,lz=-dx*s+dz*c;if(lx<-q.r-g.W||lx>g.L+q.r+g.W)continue;
        const cl=Math.max(0,Math.min(g.L,lx)),ex=lx-cl,dd=Math.hypot(ex,lz);if(dd>=q.r+g.W)continue;
        const th=gateTh(o,T0+step*dt*1000),yb=TOP+g.hp-g.W+cl*Math.sin(th),he=halfH(q);if(q.y+he<yb||q.y-he>yb+2*g.W)continue;
        let nl=dd>1e-6?ex/dd:0,nz=dd>1e-6?lz/dd:(lz>=0?1:-1);const wx=nl*c-nz*s,wz=nl*s+nz*c,pen=q.r+g.W-dd;q.x+=wx*pen;q.z+=wz*pen;
        const vn=q.vx*wx+q.vz*wz;if(vn<0){q.vx-=(1+g.e)*vn*wx;q.vz-=(1+g.e)*vn*wz;if(-vn>.5)pushI('k',-vn,step,ii)}
        const v2=q.vx*wx+q.vz*wz;if(v2<.8){q.vx+=(.8-v2)*wx;q.vz+=(.8-v2)*wz}}   // 멈춘 알도 밀려 나감
      else if(k==='rt'){if(!low(q,IT.rt.H))continue;   // 회전판: 도는 막대에 닿으면 막대 빠르기 + 밖으로
        const R=IT.rt,ph=rotAng(o,T0+step*dt*1000),ux=Math.cos(ph),uz=Math.sin(ph),sp=Math.max(-R.L,Math.min(R.L,dx*ux+dz*uz)),px=o.x+ux*sp,pz=o.z+uz*sp;
        let nx2=q.x-px,nz2=q.z-pz;const dd=Math.hypot(nx2,nz2);if(dd>=q.r+R.W)continue;
        if(dd<1e-6){nx2=-uz;nz2=ux}else{nx2/=dd;nz2/=dd}const pen=q.r+R.W-dd;q.x+=nx2*pen;q.z+=nz2*pen;
        const om=(o.dir||1)*2*Math.PI/R.P*1000,vbn=(-uz*nx2+ux*nz2)*om*sp,vn=q.vx*nx2+q.vz*nz2;
        if(vn<vbn+.05){const tgt=vbn+R.e*Math.max(0,vbn-vn)+.3*Math.sign(vbn||1);q.vx+=(tgt-vn)*nx2;q.vz+=(tgt-vn)*nz2;
          const rl=Math.hypot(dx,dz);if(rl>1e-6&&rl<R.L+q.r){q.vx+=dx/rl*R.kick;q.vz+=dz/rl*R.kick}
          if(Math.abs(tgt-vn)>.6)pushI('q',Math.abs(tgt-vn),step,ii)}}
      else if(k==='rb'){if(!low(q,.2))continue;const rs=q.r+IT.rb.r;if(d>=rs||d<1e-9)continue;   // 랜덤박스: 튕겨 나오고 깨짐 (나오는 물건은 doShot에서)
        const nx2=dx/d,nz2=dz/d;q.x=o.x+nx2*rs;q.z=o.z+nz2*rs;const vn=q.vx*nx2+q.vz*nz2;
        if(vn<0){q.vx-=(1+IT.rb.e)*vn*nx2;q.vz-=(1+IT.rb.e)*vn*nz2;o.u=1;pushI('r',-vn,step,ii)}}
      else if(k==='br'||k==='gl'){if(!low(q,IT[k].H))continue;
        const c=Math.cos(o.a),s=Math.sin(o.a),lx=dx*c+dz*s,lz=-dx*s+dz*c,L=IT[k].L,W=IT[k].W,cx=Math.max(-L,Math.min(L,lx)),cz=Math.max(-W,Math.min(W,lz));
        let nx=lx-cx,nz=lz-cz,dd=Math.hypot(nx,nz),pen;if(dd>=q.r)continue;
        if(dd<1e-6){const px=L-Math.abs(lx),pz=W-Math.abs(lz);if(px<pz){nx=Math.sign(lx)||1;nz=0;pen=px+q.r}else{nx=0;nz=Math.sign(lz)||1;pen=pz+q.r}}
        else{nx/=dd;nz/=dd;pen=q.r-dd}
        const wx=nx*c-nz*s,wz=nx*s+nz*c,vn=q.vx*wx+q.vz*wz;
        if(k==='gl'){if(vn<0){o.u=1;pushI('g',-vn,step,ii);   // 유리: 살살 맞으면 튕겨 나오고, 세게 맞으면 깨고 지나감. 어느 쪽이든 깨짐
            if(-vn<IT.gl.vb){q.x+=wx*pen;q.z+=wz*pen;q.vx-=(1+IT.gl.e)*vn*wx;q.vz-=(1+IT.gl.e)*vn*wz}else{q.vx*=IT.gl.slow;q.vz*=IT.gl.slow}}else{q.x+=wx*pen;q.z+=wz*pen}continue}
        q.x+=wx*pen;q.z+=wz*pen;
        if(vn<0){q.vx-=(1+IT.br.e)*vn*wx;q.vz-=(1+IT.br.e)*vn*wz;if(-vn>.5)pushI('k',-vn,step,ii)}}
      else if(k==='tb'){if(!low(q,2*IT.tb.r))continue;const rs=q.r+IT.tb.r;if(d>=rs||d<1e-9)continue;
        const nx=dx/d,nz=dz/d;q.x=o.x+nx*rs;q.z=o.z+nz*rs;const vn=q.vx*nx+q.vz*nz;
        if(vn<0){const out=Math.min(IT.tb.vmax,Math.max(IT.tb.vmin,-vn*IT.tb.e));q.vx+=(out-vn)*nx;q.vz+=(out-vn)*nz;pushI('u',out,step,ii)}}
      else if(k==='jp'){if(q.jl===ii){if(d>IT.jp.r+q.r)q.jl=-1;continue}
        if(d<IT.jp.r&&low(q,.03)){const sp=Math.hypot(q.vx,q.vz);if(sp>.6){q.vy=Math.min(IT.jp.vmax,sp*IT.jp.k);q.y+=.01;q.jl=ii;pushI('j',sp,step,ii)}}}
      else if(k==='bm'){if(d<IT.bm.r+q.r&&low(q,2*IT.bm.r))boom(ii,step)}
    }
    return false;
  };
  if(ITM)for(const q of S){q.wl=-1;q.jl=-1;IS.forEach((o,ii)=>{   // 웜홀·점프대 위에 멈춰 있던 알은 거기서 출발해도 바로 빨려 들거나 뜨지 않음
    if(o.k==='wh')[0,1].forEach(e=>{if(Math.hypot(q.x-(e?o.x2:o.x),q.z-(e?o.z2:o.z))<IT.wh.r+q.r)q.wl=ii*2+e});
    if(o.k==='jp'&&Math.hypot(q.x-o.x,q.z-o.z)<IT.jp.r+q.r)q.jl=ii;
    if(o.k==='tr'){const dx=q.x-o.x,dz=q.z-o.z;q['t'+ii]=-dx*Math.sin(o.a)+dz*Math.cos(o.a)>=0?1:-1}})}
  if(ACT)for(const q of S)if(inAct(q)){q.aw=1;q.still=0}   // 바람·막대 자리에 있던 알은 처음부터 움직일 수 있게
  const q0=S[shot.i];q0.vx=shot.vx;q0.vz=shot.vz;q0.aw=1;if(q0.t&&shot.wy)q0.wy=shot.wy;
  // 손가락으로 튕긴 알은 살짝 기우뚱 (앞이 숙거나 들림, 세게 칠수록 크게)
  {const sp=Math.hypot(shot.vx,shot.vz)||1,ux=shot.vx/sp,uz=shot.vz/sp,k=(rnd()*2-1)*(1.5+6*(shot.p||0));q0.bx=ux*k+(rnd()-.5)*2;q0.bz=uz*k+(rnd()-.5)*2}
  rec();
  let last=0;
  const maxS=Math.round((P.tmax+(ACT?10:0))/dt);   // 바람·막대 자리의 알이 밀려 나갈 때까지 더 계산
  for(let step=1;step<=maxS;step++){
    for(const q of S){
      if(q.g||!q.aw)continue;
      if(BHS)bhPull(q);
      for(const o of FNS)if(inWind(o,q.x,q.z)&&q.y<TOP+.6){q.vx+=Math.cos(o.a)*IT.fn.F*dt;q.vz+=Math.sin(o.a)*IT.fn.F*dt}   // 선풍기 바람
      const he=halfH(q),gy=groundAt(q.x,q.z),onG=q.y-he<=gy+.015&&q.vy<=.3;   // 기울기가 줄어 반높이가 낮아져도 바닥에 닿은 채로 봄 (그러지 않으면 공중에서 계속 돎)
      if(onG){
        const sp=Math.hypot(q.vx,q.vz),dec=(gy>=TOP-1e-6?P.aB*(ZN?zoneMul(q.x,q.z):1):P.aF)*dt;
        if(q.t&&q.wy&&sp>1e-6){   // 도는 장기 알은 앞 가장자리가 움직이는 쪽(컬링처럼)으로 조금 휨: 속도에 수직, 크기 ∝ 회전 × 속도 (방향만 바꾸고 빠르기는 그대로)
          const k=P.kc*q.wy*dt,nx=q.vx+k*q.vz,nz=q.vz-k*q.vx,nl=Math.hypot(nx,nz);q.vx=nx*sp/nl;q.vz=nz*sp/nl}
        if(sp<=dec){q.vx=q.vz=0}else{q.vx-=q.vx/sp*dec;q.vz-=q.vz/sp*dec}
        if(GU&&gy>=TOP-1e-6){const c=glueK(q.x,q.z);if(c){const m=Math.exp(-c*dt);q.vx*=m;q.vz*=m}}   // 끈끈이
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
      if(ITM&&itemStep(q,step))continue;
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
      if(q.still>12&&!(ACT&&inAct(q))){q.aw=0;q.vx=q.vy=q.vz=0;q.bx=q.bz=0;q.ax=q.az=0;q.wy=0;const gy=groundAt(q.x,q.z);if(Math.abs(q.y-(gy+q.h))<.01)q.y=gy+q.h}
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
  return {fin:S.map(q=>({x:q.x,y:q.y,z:q.z,s:q.s,o:q.o,g:q.g,t:q.t,w:Math.round(q.w*1000)/1000})),tr,k:K,nf,ev,of,sw,dur:Math.round((nf-1)/P.fps*1000),it:IS.map(o=>{const n={...o};if(n.k==='bh')n.r=Math.round(n.r*1000)/1000;return n})};
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
  const v=speedOf(c.p),r=simulate(A.st,{i:c.i,vx:Math.cos(c.a)*v,vz:Math.sin(c.a)*v,p:c.p,ht:clock()+600},()=>.5,A.it);
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
G.rulesHTML='<ol class="rules"><li><b>목표</b> : 내 알을 튕겨 다른 사람의 알을 모두 판 밖으로 떨어뜨립니다. 내 알이 모두 떨어지면 탈락하고, 마지막까지 남은 사람이 <b>승리</b>합니다. 2~4명이 할 수 있습니다</li><li><b>알 놓기</b> : 먼저 선(흑)이 내 쪽의 줄이 만나는 점에 알을 하나 놓고, 이어서 다른 사람이 차례로 하나씩 놓습니다. 이렇게 번갈아 모두 놓으면 알까기를 시작합니다. 2명이면 내 쪽 반(가운데 줄 제외), 3~4명이면 내 쪽 삼각형(대각선 제외)에만 놓을 수 있습니다. 누른 점에 미리 보기가 뜨고, [놓기]를 누르거나 같은 점을 한 번 더 누르면 놓습니다(설정의 ‘두 번 눌러 놓기’를 끄면 같은 점을 다시 누를 때 취소됩니다). 놓을 수 없는 곳에는 빨간 빗금이 보이고, 경계에는 차단기가 내려옵니다</li><li><b>진행</b> : 선부터 차례로 내 알 하나씩 튕깁니다. 판 밖으로 떨어진 알은 다시 쓰지 못하고, 내 알이 떨어져도 마찬가지입니다</li><li><b>튕기기</b> : 내 알을 누른 채 뒤로 당겼다 놓습니다. 알 뒤에 내 손이 나타나 당길수록 진해지고 세게 나갑니다. 끝까지 당기면 더 세지지 않습니다. 조금만 당기고 놓으면 취소됩니다. 가장자리 알처럼 뒤로 당길 자리가 없으면 내 알을 짧게 눌러 고릅니다. 손이 나타나면 판 어디서든 누르고 끌어 그 알을 당길 수 있습니다(누른 점에서 끈 만큼). 빈 곳을 짧게 누르거나 같은 알을 다시 누르면 내려놓습니다</li><li><b>손 떨림</b> : 손은 당기는 동안 계속 떨리고, 세게 당길수록 크게 떨립니다. 놓는 순간 손이 가리키던 쪽으로 나가므로 살살 치면 거의 똑바로, 세게 치면 빗나가기 쉽습니다</li><li><b>뜨는 알</b> : 바둑알은 납작해서 세게 부딪히면 위로 튀어 오르기도 합니다</li><li><b>한 번 더</b> : 탁자 설정에서 켜면, 다른 사람의 알을 떨어뜨리고 튕긴 내 알이 판에 남았을 때 한 번 더 튕깁니다</li><li><b>끝</b> : 한 명만 남으면 끝납니다. 남은 사람들의 마지막 알이 함께 떨어지면 무승부입니다. 탈락한 순서가 늦을수록 순위가 높습니다</li><li><b>제한 시간</b> : 튕길 차례에 제한 시간이 지나면 차례가 넘어가고, 놓을 차례에 지나면 아무 자리에 대신 놓습니다. 연결이 끊겨도 시간은 흐르고, 45초 안에 돌아오지 않으면 탈주로 처리합니다. 항복·탈주한 사람의 알은 판에서 사라집니다</li><li><b>다음 판</b> : 결과 화면에서 바로 시작하면 진 사람(4명이면 가장 먼저 탈락한 사람)이 선(먼저 놓고 먼저 튕김)이 되고, 비기면 서로 바꿉니다. 첫 판은 탁자 설정의 선 플레이어(선택·무작위)로 정합니다</li><li><b>게임 모드</b> : 탁자 설정에서 바둑(위 규칙)·오목·장기 중에서 고릅니다</li><li><b>물건 놓기</b> : 탁자 설정에서 켜면(바둑·장기 모드) 알을 놓은 뒤(장기 모드는 바로) 물건을 고르고 판에 놓은 다음 튕깁니다<ul><li><b>고르기</b> : 판 가운데에 물건이 (사람 수 × 물건 수 + 1)개 떠오르고 3·2·1을 센 뒤, 모두 함께 먼저 누른 사람이 가져갑니다(각자 화면에서 0이 된 뒤 누르기까지 걸린 시간으로 정함). 물건 둘레 색은 희귀도입니다: 회색 일반·파랑 희귀·금색 전설(한 판에 하나까지). 시간이 지나면 남은 것 중 아무것이나 가져갑니다</li><li><b>?</b> : 희귀 물건입니다. 집으면 무엇이 될지 정해지고(일반이 잘 나오고 전설은 드묾), 판에 놓기 전까지는 고른 사람만 압니다</li><li><b>놓기</b> : 다시 3·2·1 뒤 모두 동시에 놓습니다. 판을 누르면 미리 보기가 뜨고(다른 사람에게도 보임), [놓기]를 누르거나 미리 보기를 한 번 더 누르면 놓습니다. 같은 자리는 먼저 놓은 사람 것입니다. 벽돌·유리·배신자의 길·선풍기·차단기는 미리 보기를 누른 채 끌어 방향을 돌리고, 웜홀은 구멍 두 개를 차례로 놓습니다. 알·다른 물건과 겹치거나 판 가장자리에 너무 가까우면 미리 보기가 빨갛고 놓을 수 없습니다(얼음판·모래밭은 알 위에도 깔 수 있음). 20초 안에 못 놓은 물건은 아무 자리에 놓입니다</li><li><b>블랙홀</b> : 움직이는 알을 끌어당깁니다. 가운데 구멍에 빠진 알은 판에서 떨어진 것과 같고, 삼킬 때마다 블랙홀이 조금씩 커집니다. 멈춰 있는 알은 당기지 않습니다</li><li><b>웜홀</b> : 구멍 두 개가 한 쌍입니다. 어느 쪽으로 들어가도 다른 쪽에서 같은 빠르기·방향으로 나옵니다</li><li><b>벽돌</b> : 움직이지 않는 낮은 벽입니다. 알이 부딪히면 튕겨 나오고, 세게 쳐서 뜬 알은 넘어갑니다</li><li><b>탱탱볼</b> : 박혀 있는 공입니다. 부딪힌 알을 더 세게 튕겨 냅니다</li><li><b>얼음판</b> : 그 위에서는 알이 거의 멈추지 않고 미끄러집니다</li><li><b>모래밭</b> : 그 위에서는 알이 금방 멈춥니다</li><li><b>점프대</b> : 지나가는 알을 띄워 줍니다. 뜬 알은 벽돌·탱탱볼·폭탄을 넘어갑니다</li><li><b>폭탄</b> : 알이 닿으면 터져서 둘레의 알을 모두 밀어내고 사라집니다. 가까운 폭탄도 같이 터집니다</li><li><b>유리</b> : 투명한 판입니다. 살살 맞으면 알이 튕겨 나오고, 세게 맞으면 깨고 지나가며 느려집니다. 어느 쪽이든 한 번 맞으면 깨집니다</li><li><b>끈끈이</b> : 위를 지나는 알이 느려집니다. 빠를수록 많이 느려집니다(모래밭은 반대로 느린 알이 금방 멈춤)</li><li><b>랜덤박스</b> : 알이 부딪히면 튕겨 나오고 상자가 깨집니다. 알이 다 멈추면 그 자리에 아무 물건이나 하나 나오고, 깬 사람의 물건이 됩니다</li><li><b>배신자의 길</b> : 바닥의 띠를 알이 가로질러 넘어가면 주인이 바뀝니다. 남의 알은 튕긴 사람의 알이 되고, 튕긴 사람의 알은 다음 사람의 알이 됩니다(2명이면 상대). 뜬 알과 장기 모드의 장은 바뀌지 않습니다</li><li><b>지우개</b> : 다른 물건을 모두 놓은 뒤 맨 마지막에 씁니다. 상대가 놓은 물건을 눌러 고르고 한 번 더 누르거나 [놓기]를 누르면 지웁니다. 지울 물건이 없으면 사라집니다</li><li><b>선풍기</b> : 바라보는 쪽으로 바람을 보냅니다. 바람 위의 알은 튕기지 않아도 바람 끝까지 밀려갑니다. 알이 바람 위에 있는 자리에는 놓을 수 없습니다</li><li><b>차단기</b> : 막대가 8초마다 올라갔다 내려옵니다(빨간 불이 깜빡이면 곧 움직임). 내려와 있으면 알이 막히고, 올라가 있으면 지나갑니다. 내려오는 막대 밑에 있던 알은 옆으로 밀려납니다</li><li><b>회전판</b> : 막대가 8초에 한 바퀴씩 계속 돕니다(방향은 놓을 때 정해짐). 도는 원 안에 들어온 알은 막대에 밀려 원 밖으로 나갑니다. 원 안에 알이 있는 자리에는 놓을 수 없습니다</li><li><b>희귀도</b> : 일반 벽돌·유리·모래밭·얼음판·끈끈이·탱탱볼, 희귀 점프대·웜홀·지우개·랜덤박스·선풍기·차단기·회전판·?, 전설 블랙홀·폭탄·배신자의 길</li><li><b>다음 판</b> : 바로 시작하면 물건을 새로 고릅니다</li></ul></li><li><b>오목 모드</b> : 게임 모드에서 오목을 고르면(2명), 판 위에 내 돌 다섯 개를 한 줄로 먼저 세우는 사람이 <b>승리</b>합니다<ul><li><b>진행</b> : 선(흑)부터 번갈아, 내 차례에 <b>돌을 놓거나</b> 판 위의 내 돌 하나를 <b>튕깁니다</b>. 돌은 얼마든지 놓을 수 있고, 판 어디든 다른 돌과 겹치지 않는 점이면 놓을 수 있습니다. 빈 점을 누르면 미리 보기가 뜨고 [놓기]를 누르거나 같은 점을 한 번 더 누르면 놓고, 내 돌을 누른 채 당겼다 놓으면 튕깁니다</li><li><b>떨어진 돌</b> : 판에서 떨어진 돌은 그냥 사라집니다. 가져오는 일은 없습니다</li><li><b>판정</b> : 돌이 모두 멈춘 뒤, 줄이 만나는 점마다 그 점을 가리는(반 칸 안에서 가장 가까운) 돌이 그 점에 있다고 봅니다. 가로·세로·대각선으로 다섯 개 이상 이어지면 오목입니다. 상대가 튕겨서 생긴 내 오목도 내 승리입니다</li><li><b>한 번 더</b> : 탁자 설정의 ‘떨어뜨리면 한 번 더’를 켜면, 상대 돌을 떨어뜨렸을 때 한 번 더 둡니다(튕긴 돌이 함께 떨어져도)</li><li><b>동시 오목</b> : 두 사람의 오목이 함께 생기면 튕긴 사람이 집니다</li><li><b>제한 시간</b> : 시간이 지나면 차례를 넘깁니다</li><li><b>무승부</b> : 돌을 놓을 수 있는 점이 하나도 없으면 무승부입니다</li></ul></li><li><b>장기 모드</b> : 게임 모드에서 장기를 고르면(2명), 장기판에 장기 상차림(마상마상)으로 알 16개씩 놓고 시작합니다. 선이 초(초록), 다음 사람이 한(빨강)입니다<ul><li><b>알 크기·무게</b> : 장이 가장 크고, 차·포·마·상, 사·졸 순으로 작습니다. 무게는 크기(부피)에 비례해서, 같은 힘으로 튕기면 무거운 알은 느리게 짧게 나가고 가벼운 알은 빠르게 멀리 나갑니다. 무거운 알은 맞아도 잘 밀리지 않습니다</li><li><b>도는 알</b> : 비껴 부딪히면 알이 돕니다(나가는 방향은 그대로)</li><li><b>끝</b> : 상대 알을 모두 떨어뜨리면 승리합니다. 탁자 설정의 ‘장 떨어지면 패배’를 켜면 장이 먼저 떨어진 쪽이 지고, 두 장이 같은 순간에 떨어지면 튕긴 사람이 집니다</li><li><b>놓기</b> : 알을 놓는 단계는 없고 바로 튕깁니다. 알 개수는 정하지 않습니다</li></ul></li></ol>';
G.modeDesc=['마지막까지 남은 사람이 이김','마지막까지 남은 사람이 이김'];
G.defaults={max:2,turn:30,stones:5,again:1,pickfirst:0,omok:0,md:0,jang:0,ob:0,obn:1};
/* 방 설정: 게임 모드(바둑·오목·장기)·알 개수·제한 시간은 설정 판자에서 G.boardSet으로 직접 그림(lever). 알 개수는 바둑 모드에만 */
const MD_NAME=['바둑','오목','장기'];
G.roomSet=[
  {k:'md',label:'게임 모드',unit:'',lo:0,hi:2,step:1,lever:1,desc:'바둑: 바둑알로 상대 알을 모두 떨어뜨리면 이깁니다(2~4명). 오목: 돌을 놓거나 튕겨 오목을 먼저 만들면 이깁니다(2명). 장기: 장기판에 장기 상차림으로 시작하고, 알마다 크기·무게가 다릅니다(2명)'},
  {k:'stones',label:'알 개수',unit:'개',lo:1,hi:10,step:1,lever:1,desc:'한 사람이 가지고 시작하는 알 수입니다 (바둑 모드)'},
  {k:'turn',label:'제한 시간',unit:'초',lo:10,hi:120,step:5,lever:1,desc:'시간이 지나면 차례가 넘어갑니다'},
  {k:'obn',label:'물건 수',unit:'개',lo:1,hi:3,step:1,lever:1,desc:'물건 놓기에서 한 사람이 고르는 물건 수입니다'}];
G.ruleSet=[
  {k:'omok',label:'오목 모드',hidden:true,desc:''},   // 예전 설정(오목 스위치)을 읽으려고 남겨 둠. 지금은 md로 정함
  {k:'again',label:'떨어뜨리면 한 번 더',desc:'다른 사람의 알을 떨어뜨리고 튕긴 내 알이 판에 남으면 한 번 더 튕깁니다 (오목 모드는 상대 돌을 떨어뜨리기만 하면)'},
  {k:'jang',label:'장 떨어지면 패배',desc:'장기 모드: 장이 먼저 떨어진 쪽이 집니다. 끄면 알이 모두 떨어진 쪽이 집니다'},
  {k:'ob',label:'물건 놓기',desc:'바둑·장기 모드: 알을 놓은 뒤 블랙홀·웜홀·벽돌·탱탱볼·얼음판·모래밭·점프대·폭탄 중에서 선착순으로 물건을 고르고, 선부터 한 명씩 판에 놓습니다'},
  {k:'pickfirst',pick:1,label:'선 플레이어',desc:'선택: 방장이 대기실에서 선(먼저 튕길 사람)을 고릅니다. 무작위: 랜덤으로 정합니다'}];
const nStones=c=>Math.max(1,Math.min(10,Math.round(+c.stones||5)));
const ruleOf=k=>G.ruleSet.find(d=>d.k===k);
/* 설정 판자 항목: 게임 모드 → (바둑) 알 개수 → 제한 시간 → 한 번 더 → (장기) 장 떨어지면 패배 → 선 플레이어 */
const obOn=c=>mdOf(c)!==1&&!!+c.ob;   // 물건 놓기 (오목 모드에는 없음)
G.modeLabel=c=>(MD_NAME[mdOf(c)]||'')+(obOn(c)?' · 물건':'');   // 홀로그램 모드 줄
G.boardSet=c=>{
  const md=mdOf(c),rs=roomSetOf(G,c),num=k=>{const d=rs.find(x=>x.k===k),v=+(c[k]??G.defaults[k]);return {kind:'num',...d,v,diff:false}};
  const rule=k=>{const d=ruleOf(k);return {...rbRuleItem(d,c),diff:(+c[k]?1:0)!==(+G.defaults[k]?1:0)}};
  return [{kind:'choice',k:'md',label:'게임 모드',opts:MD_NAME,desc:rs.find(x=>x.k==='md').desc,v:md,diff:md!==0,act:o=>'ak:md:'+o},
    ...(md===0?[num('stones')]:[]),num('turn'),rule('again'),...(md===2?[rule('jang')]:[]),...(md!==1?[rule('ob'),...(+c.ob?[num('obn')]:[])]:[]),rule('pickfirst')];
};
/* WebGL이 없을 때의 탁자 설정 창 (2D): 게임 모드 버튼 셋 + 숫자 칸 + 스위치 */
G.settingsHTML=(c,{stepRow})=>{
  const md=mdOf(c),rs=roomSetOf(G,c),row=k=>{const d=rs.find(x=>x.k===k);return d?stepRow(d):''};
  const tog=k=>{const d=ruleOf(k),on=!!(+c[k]);return `<div class="stp tg"><div class="stp-t"><b>${d.label}</b><small>${d.desc}</small></div><div class="stp-c"><button type="button" class="sw${on?' on':''}" role="switch" aria-checked="${on}" aria-label="${d.label}" data-act="tog:${k}"><i></i></button></div></div>`};
  const mrow=`<div class="rs-seg"><div class="rs-h"><b>게임 모드</b><small>${rs.find(x=>x.k==='md').desc}</small></div><div class="segrow" role="radiogroup" aria-label="게임 모드">${MD_NAME.map((t,v)=>`<button class="btn ${md===v?'btn-play':'btn-sub'}" type="button" role="radio" aria-checked="${md===v}" data-act="ak:md:${v}">${t}</button>`).join('')}</div></div>`;
  return `<div class="rs-grid">${['max','spec'].map(row).join('')}</div>${mrow}<div class="rs-grid">${(md===0?['stones','turn']:['turn']).concat(md!==1&&+c.ob?['obn']:[]).map(row).join('')}</div><div class="rulehead">게임 규칙</div><div class="rs-grid tgs">${tog('again')}${md===2?tog('jang'):''}${md!==1?tog('ob'):''}${pickRowHTML(ruleOf('pickfirst'),c)}</div>`;
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
const cfgModeTxt=c=>{const md=mdOf(c),ob=obOn(c)?` · 물건 ${Math.max(1,Math.min(3,+c.obn||1))}개`:'';return md===1?'오목 모드':md===2?`장기 모드${+c.jang?' · 장 떨어지면 패배':''}${ob}`:`알 ${nStones(c)}개${ob}`};
G.cfgChips=c=>`<span class="chip">${mdOf(c)?`<b>${cfgModeTxt(c)}</b>`:`알 <b>${nStones(c)}개</b>`}</span>${obOn(c)&&!mdOf(c)?`<span class="chip">물건 <b>${Math.max(1,Math.min(3,+c.obn||1))}개</b></span>`:''}<span class="chip">제한 시간 <b>${+c.turn||30}초</b></span><span class="chip">한 번 더 <b>${+c.again?'켜기':'끄기'}</b></span><span class="chip">선 <b>${+c.pickfirst?'선택':'무작위'}</b></span>`;
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
function doShot(seat,i,a,p,j,ht){   // j: 그중 손 떨림 몫 (장기 알 처음 회전, 없으면 0), ht: 놓은 순간의 방장 시각(화면이 본 차단기·회전판 자리와 맞춤, 0.8초 안쪽만 믿음)
  const A=H.ak,s=A.st[i];
  if(!s||s.s!==seat||s.o||s.u||!Number.isFinite(a)||!Number.isFinite(p))return false;
  p=Math.max(PMIN,Math.min(1,p));
  useBoard(A.jg);
  const v=shotSpeed(s,p),before=Array.from({length:A.np},(_,k)=>aliveOf(A,k));
  const it0=A.it&&A.it.length?A.it.map(o=>({...o})):null;
  const tn=clock(),hT=Number.isFinite(ht)?Math.max(tn-800,Math.min(tn,ht)):tn;
  const r=simulate(simSt(A.st),{i,vx:Math.cos(a)*v,vz:Math.sin(a)*v,p,wy:shotSpin(s,v,j),by:seat,nx:nextAlive(A,seat),ht:hT},null,A.it);
  const st0=A.st;
  if(it0)A.it=r.it;
  A.st=r.fin.map((q,k)=>{const o=A.st[k];if(o.u)return o;const n={x:q.x,y:q.y,z:q.z,s:q.s,o:o.o||q.o?1:0,g:o.g||q.g?1:0};if(o.t){n.t=o.t;n.w=q.w}return n});
  const fell=A.st.map((q,k)=>!st0[k].u&&!st0[k].o&&q.o?st0[k].s:-1);   // 떨어진 알의 (튕기기 전) 주인 — 배신자의 길로 바뀐 주인은 떨어진 수로 치지 않음
  const kn=fell.filter(o=>o>=0&&o!==seat).length,own=fell.filter(o=>o===seat).length;   // 다른 사람 알 떨어진 수, 내 알 떨어진 수
  const spawn=[];if(it0)A.it.forEach((o,ii)=>{if(o.k==='rb'&&o.u&&it0[ii]&&!it0[ii].u){const n=rbSpawn(A,o,seat);if(n)spawn.push(n)}});spawn.forEach(n=>A.it.push(n));   // 랜덤박스가 깨진 자리에 물건
  A.cnt++;A.sid++;
  A.sh={id:A.sid,by:seat,i,a,p,tr:r.tr,k:r.k,nf:r.nf,ev:r.ev,of:r.of,dur:r.dur,t0:clock(),it0,sw:r.sw&&r.sw.length?r.sw:null,ht0:Math.round(hT)};
  A.ph='roll';A.until=clock()+r.dur+450;A.aim=null;A.bp=null;H.botActAt=0;
  A.ag=+H.cfg.again&&kn>0&&(A.om||!A.st[i].o)?1:0;   // 한 번 더: 다른 사람 알을 떨어뜨리고 튕긴 알이 판에 남음 (오목 모드는 상대 돌을 떨어뜨리기만 하면)
  A.next=A.ag?seat:turnAfter(A,seat);
  H.seatNote[seat]='';
  const nm=H.players[seat].name,parts=[];
  if(A.om){if(kn)parts.push(`상대 돌 ${kn}개 떨어뜨림`);if(own)parts.push(`내 돌 ${own}개 떨어짐`)}
  else{if(kn)parts.push(`${kn}알 까기`);if(own)parts.push(`내 알 ${own}개 떨어짐`)}
  {const ex=(r.ev||[]).filter(e=>e[1]==='x').length;if(ex)parts.push(`폭탄${ex>1?' '+ex+'개':''} 펑`)}
  if(r.sw&&r.sw.length)parts.push(`배신 ${r.sw.length}알`);
  spawn.forEach(n=>parts.push(`랜덤박스에서 ${OB_NM[n.k]}`));
  if(A.jg)for(const q of A.st.filter((q,k)=>q.t===7&&q.o&&r.of[k]!=null))parts.push(`${CNAME_JG[A.co[q.s]]} 장 떨어짐`);
  A.lg=[`${A.cnt}. ${nm} ${parts.length?parts.join(' · '):A.om?'튕김':'빗나감'}`,kn?'fin':''];   // 기록은 알이 다 멈춘 뒤에 (굴러가는 동안 기록이 결과를 먼저 알려 주지 않게)
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
  if(nx<0){afterStones();return true}
  startTurn(nx,'place');
  return true;
}
/* 알을 다 놓았으면: 물건 놓기면 물건 고르기, 아니면 선부터 튕김 */
function afterStones(){
  const A=H.ak;
  if(A.ob){addLog('알을 모두 놓았습니다.','sys');startPick();return}
  addLog('알을 모두 놓았습니다. 알까기를 시작합니다.','sys');startTurn(H.players[A.A].finished?nextAlive(A,A.A):A.A);
}
/* ----- 물건 놓기: 고르기(모두 함께, 선착순) → 놓기(선부터 한 명씩 한 개씩) → 튕기기 ----- */
const obPicks=(A,seat)=>A.ofs?A.ofs.filter(x=>x===seat).length:0;
const obNeed=(A,seat)=>!!H.players[seat]&&!H.players[seat].finished&&obPicks(A,seat)<A.obn;
function obFirst(A,test){for(let k=0;k<A.np;k++){const j=(A.A+k)%A.np;if(test(j))return j}return -1}
const obBotRt=p=>{const lv=typeof botLv==='function'?botLv(p):1;return lv>=2?rand(300,600):lv===1?rand(500,900):rand(800,1500)};   // 봇 반응 시간
function startPick(){
  const A=H.ak,live=H.players.slice(0,A.np).filter(p=>!p.finished).length,n=live*A.obn+1;
  A.of=obDraw(n);A.ok=A.of.map(k=>k==='qm'?null:k);A.ofs=Array(n).fill(-1);A.cl=[];A.inv=null;A.igs={};A.ph='pick';A.aim=null;A.bp=null;
  const t=clock();A.go=t+OB_FLOAT+OB_CD;H.deadline=A.go+(+H.cfg.turn||30)*1000;H.graceUntil=0;H.botActAt=0;
  A.bt=H.players.slice(0,A.np).map(p=>p.bot?A.go+obBotRt(p):0);   // 봇이 누르는 시각
  H.turn=obFirst(A,j=>obNeed(A,j));
  mark();
}
/* 고르기 선착순: 누른 사람마다 자기 화면에서 0이 된 뒤 걸린 시간(rt)을 보내고, 방장은 그 물건을 처음 누른 것이 온 뒤 OB_WIN만큼 기다렸다가 가장 빨리 누른 사람에게 줌 */
function claimPick(seat,k,rt){
  const A=H.ak,t=clock();
  if(A.ph!=='pick'||t<A.go||!Number.isInteger(k)||k<0||k>=A.of.length||A.ofs[k]!==-1||!obNeed(A,seat))return false;
  rt=Number.isFinite(+rt)?Math.max(0,Math.min(+rt,t-A.go+50)):t-A.go;
  A.cl=A.cl.filter(c=>!(c.s===seat&&c.k===k));A.cl.push({k,s:seat,rt,at:t});return true;
}
function resolvePicks(t){
  const A=H.ak;if(A.ph!=='pick'||!A.cl||!A.cl.length)return;
  const of=k=>A.cl.filter(c=>c.k===k),ks=[...new Set(A.cl.map(c=>c.k))].filter(k=>Math.min(...of(k).map(c=>c.at))+OB_WIN<=t);
  if(!ks.length)return;
  const best=k=>Math.min(...of(k).map(c=>c.rt));ks.sort((a,b)=>best(a)-best(b));
  for(const k of ks){const cs=of(k).sort((a,b)=>a.rt-b.rt);A.cl=A.cl.filter(c=>c.k!==k);
    for(const c of cs)if(A.ph==='pick'&&A.ofs[k]===-1&&obNeed(A,c.s)){doPick(c.s,k);break}
    if(A.ph!=='pick')return}
}
function doPick(seat,k){
  const A=H.ak;
  if(A.ph!=='pick'||!Number.isInteger(k)||k<0||k>=A.of.length||A.ofs[k]!==-1||!obNeed(A,seat))return false;
  A.ofs[k]=seat;if(A.of[k]==='qm')A.ok[k]=obDrawOne(OB_QIN,Math.random);   // '?'는 집는 순간 무엇인지 정함
  addLog(`${H.players[seat].name} ${OB_NM[A.of[k]]} 고름`);
  afterPick();return true;
}
function pickAny(seat){const A=H.ak,free=A.ofs.map((x,k)=>x<0?k:-1).filter(k=>k>=0);return free.length?doPick(seat,free[Math.random()*free.length|0]):false}
function afterPick(){
  const A=H.ak;if(A.ph!=='pick')return;
  const f=obFirst(A,j=>obNeed(A,j));
  if(f>=0){H.turn=f;mark();return}
  startPut();
}
/* 놓기: 카운트다운 뒤 모두 동시에, 같은 자리는 먼저 놓은 사람 것 */
const obPutting=(A,s)=>!!(A.inv&&A.inv[s]&&A.inv[s].length&&H.players[s]&&!H.players[s].finished);
function startPut(){
  const A=H.ak;
  A.inv=Array.from({length:A.np},(_,s)=>H.players[s].finished?[]:A.of.map((k,i)=>A.ofs[i]===s?i:-1).filter(i=>i>=0).sort((a,b)=>(A.ok[a]==='er')-(A.ok[b]==='er')));   // 놓을 물건 (고르기 목록 번호, 지우개는 맨 뒤)
  A.cl=[];A.bt=null;A.igs={};
  if(obFirst(A,j=>obPutting(A,j))<0){goShoot();return}
  const t=clock();A.ph='iput';A.aim=null;A.bp=null;A.go=t+OB_CD;H.deadline=A.go+OB_PUT;H.graceUntil=0;H.botActAt=0;
  A.pbt=H.players.slice(0,A.np).map((p,s)=>p.bot&&obPutting(A,s)?A.go+rand(1200,3500):0);   // 봇이 놓는 시각
  H.turn=obFirst(A,j=>obPutting(A,j));
  addLog('물건을 놓습니다.','sys');afterPut();   // 지울 물건이 없는 지우개는 바로 사라짐
}
function goShoot(){const A=H.ak;A.igs={};A.go=0;addLog('알까기를 시작합니다.','sys');startTurn(H.players[A.A].finished?nextAlive(A,A.A):A.A)}
function afterPut(){const A=H.ak;if(A.ph!=='iput')return;
  if(obEraseReady(A))for(let s=0;s<A.np;s++)while(obPutting(A,s)&&A.ok[A.inv[s][0]]==='er'&&!eraseTargets(A,s).length){A.inv[s].shift();delete A.igs[s];addLog(`${H.players[s].name} 지울 물건이 없어 지우개가 사라집니다.`,'sys')}
  const f=obFirst(A,j=>obPutting(A,j));if(f<0){goShoot();return}H.turn=f;mark()}
/* 물건 하나 놓기: a {x,z, a 벽돌 방향, x2·z2 웜홀 다른 쪽} */
function doPut(seat,a){
  const A=H.ak;if(A.ph!=='iput'||!obPutting(A,seat)||clock()<A.go-100)return false;
  const oi=A.inv[seat][0],k=A.ok[oi],r3=v=>Math.round(+v*1000)/1000;
  if(k==='er')return false;
  const o={k,x:r3(a.x),z:r3(a.z),s:seat,o:oi};
  if(OB_ANG[k])o.a=r3(a.a);
  if(k==='rt')o.a=Math.round(Math.random()*Math.PI*1000)/1000;
  obInit(o);
  if(k==='wh'){o.x2=r3(a.x2);o.z2=r3(a.z2)}
  if(!canPut(A,o))return false;
  A.it.push(o);A.inv[seat].shift();delete A.igs[seat];H.seatNote[seat]='';
  addLog(`${H.players[seat].name} ${A.of[oi]==='qm'?'? → ':''}${OB_NM[k]} 놓음`);
  afterPut();return true;
}
function autoPut(i){
  const A=H.ak;if(!obPutting(A,i)){afterPut();return}
  if(A.ok[A.inv[i][0]]==='er'){if(!obEraseReady(A))return;const t=erasePlan(A,i);if(t>=0&&doErase(i,t))return;A.inv[i].shift();delete A.igs[i];afterPut();return}   // 지우개는 다른 물건을 다 놓은 뒤
  const b=itemPlan(A,i,A.ok[A.inv[i][0]]);
  if(b&&doPut(i,b))return;
  A.inv[i].shift();delete A.igs[i];afterPut();   // 놓을 곳이 없으면(거의 없음) 그 물건은 버림
}
/* 놓은 물건의 시각·방향 (방장 시계): 차단기·회전판은 놓은 때부터 돌고, 회전판 방향은 무작위 */
function obInit(o){if(o.k==='bh'){o.r=IT.bh.rc;o.n=0}if(o.k==='gt'||o.k==='rt')o.t0=Math.round(clock());if(o.k==='rt'){o.dir=Math.random()<.5?1:-1;if(!Number.isFinite(o.a))o.a=0}return o}
/* 랜덤박스가 깨진 자리에 나오는 물건: 판에 놓는 물건 중 똑같은 확률, 그 자리에 놓을 수 없는 것은 건너뜀. 주인은 깬 사람 */
function rbSpawn(A,box,seat){
  const ks=OB_RBIN.slice();for(let i=ks.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[ks[i],ks[j]]=[ks[j],ks[i]]}
  A.sq=(A.sq||0)+1;
  for(const k of ks){const o=obInit({k,x:box.x,z:box.z,s:seat,o:100+A.sq});
    if(OB_ANG[k]){for(let t=0;t<8;t++){o.a=Math.round(((Math.random()+t)/8*Math.PI)*1000)/1000;if(canPut(A,o))return o}continue}
    if(k==='wh'){for(let t=0;t<80;t++){o.x2=Math.round((Math.random()*2-1)*(BD.x-.25)*1000)/1000;o.z2=Math.round((Math.random()*2-1)*(BD.z-.25)*1000)/1000;if(canPut(A,o))return o}continue}
    if(canPut(A,o))return o}
  return null;
}
/* 지우개: 다른 물건을 모두 놓은 뒤 맨 마지막에 씀. 상대가 놓은 물건 하나를 지움 */
const obEraseReady=A=>!!A.inv&&A.inv.every(L=>L.every(i=>A.ok[i]==='er'));
const eraseTargets=(A,seat)=>A.it.map((o,i)=>o.s!==seat&&!o.u?i:-1).filter(i=>i>=0);
function doErase(seat,i){
  const A=H.ak;if(A.ph!=='iput'||!obPutting(A,seat)||A.ok[A.inv[seat][0]]!=='er'||!obEraseReady(A)||clock()<A.go-100)return false;
  const o=A.it[i];if(!Number.isInteger(i)||!o||o.s===seat||o.u)return false;
  const oi=A.inv[seat][0];A.it.splice(i,1);A.inv[seat].shift();delete A.igs[seat];H.seatNote[seat]='';
  addLog(`${H.players[seat].name} ${A.of[oi]==='qm'?'? → ':''}지우개로 ${H.players[o.s]?H.players[o.s].name+'의 ':''}${OB_NM[o.k]} 지움`);
  afterPut();return true;
}
function erasePlan(A,seat){   // 봇·시간 초과: 가장 위험한 상대 물건 (희귀할수록, 내 알 가까이 있을수록)
  const own=A.st.filter(q=>!q.u&&!q.o&&!q.g&&q.s===seat);let best=-1,bs=-1e9;
  for(const i of eraseTargets(A,seat)){const o=A.it[i],sc=OB_RAR[o.k]*2+own.reduce((n,q)=>n+Math.max(0,1-Math.hypot(q.x-o.x,q.z-o.z)/1.2),0)+Math.random()*.3;if(sc>bs){bs=sc;best=i}}
  return best;
}
/* 봇·시간 초과: 놓을 자리를 무작위 후보 중 점수로 고름 (블랙홀·폭탄·얼음은 상대 알 근처, 모래·벽돌은 내 알 곁, 웜홀 한쪽은 가장자리 가까이) */
function itemPlan(A,seat,k,rnd){
  rnd=rnd||Math.random;useBoard(A.jg);
  const live=A.st.filter(q=>!q.u&&!q.o&&!q.g),opp=live.filter(q=>q.s!==seat),own=live.filter(q=>q.s===seat);
  const W={bh:[1,-1.3],ic:[.8,-.8],bm:[1,-1.2],sd:[-.6,1],tb:[.3,-.3],jp:[0,0],br:[-.2,.6],gl:[-.2,.6],wh:[.5,-.5],gu:[-.5,1],rb:[0,0],tr:[.3,.3],fn:[0,0],gt:[0,.3],rt:[.2,-.2]}[k]||[0,0];
  const near=(L,x,z)=>L.reduce((n,q)=>n+Math.max(0,1-Math.hypot(q.x-x,q.z-z)/1.1),0);
  const rp=()=>[(rnd()*2-1)*(BD.x-.2),(rnd()*2-1)*(BD.z-.2)];
  let best=null,bs=-1e9;
  for(let n=0;n<320;n++){
    const [x,z]=rp(),o={k,x,z};
    if(k==='bh')o.r=IT.bh.rc;
    if(k==='tr')o.a=rnd()*Math.PI;
    if(k==='fn'||k==='gt')o.a=rnd()*2*Math.PI;
    if(k==='br'||k==='gl'){const t=opp.length&&own.length&&rnd()<.6?own[rnd()*own.length|0]:null;
      if(t){const g=opp.reduce((b,q)=>Math.hypot(q.x-t.x,q.z-t.z)<Math.hypot(b.x-t.x,b.z-t.z)?q:b,opp[0]),d=Math.atan2(g.z-t.z,g.x-t.x),off=.32+rnd()*.12;o.x=t.x+Math.cos(d)*off;o.z=t.z+Math.sin(d)*off;o.a=d+Math.PI/2+(rnd()-.5)*.4}   // 내 알 앞을 막음
      else o.a=rnd()*Math.PI}
    if(k==='wh'){const [x2,z2]=rp();o.x2=x2;o.z2=z2}
    if(!canPut(A,o))continue;
    let sc=W[0]*near(opp,o.x,o.z)+W[1]*near(own,o.x,o.z)+rnd()*.35;
    if(k==='wh')sc+=Math.max(Math.abs(o.x2)/BD.x,Math.abs(o.z2)/BD.z);
    if(sc>bs){bs=sc;best=o}
  }
  if(!best){   // 판이 붐벼 무작위로 못 찾으면 판 전체를 촘촘히 훑음 (벽돌은 방향 넷, 웜홀은 둘째 구멍도 훑음)
    const pts=[];for(let x=-BD.x+.15;x<=BD.x-.15;x+=.08)for(let z=-BD.z+.15;z<=BD.z-.15;z+=.08)pts.push([x,z]);
    for(const [x,z] of pts){
      if(k==='wh'){if(!endFree(A,x,z))continue;for(const [x2,z2] of pts){const o={k,x,z,x2,z2};if(canPut(A,o))return o}continue}
      for(const a of OB_ANG[k]?[0,Math.PI/4,Math.PI/2,3*Math.PI/4,Math.PI,5*Math.PI/4,3*Math.PI/2,7*Math.PI/4]:[0]){const o={k,x,z,a};if(k==='bh')o.r=IT.bh.rc;if(canPut(A,o))return o}
    }
  }
  return best;
}
function autoPlace(i){
  const p=H.players[i],b=placePlan(H.ak,i,null,p&&p.bot&&typeof botLv==='function'?botLv(p):1);
  if(!b||!doPlace(i,b[0],b[1])){const A=H.ak;A.st.forEach(q=>{if(q.u&&q.s===i){q.u=0;q.o=1;q.g=1}});resumeAfterOut(i)}   // 놓을 곳이 없으면(생기지 않음) 남은 알은 빼고 이어감
}
function flushLog(){const A=H.ak;if(A&&A.lg){addLog(A.lg[0],A.lg[1]);A.lg=null}}
/* 차례인 사람이 탈락·항복해서 차례가 비면 다음 사람으로 (놓기 중이면 다음에 놓을 사람, 다 놓았으면 선부터 튕김) */
function resumeAfterOut(seat){
  const A=H.ak;if(!A||H.phase!=='play')return;
  if(A.ph==='pick'){afterPick();return}   // 고르기·놓기는 모두 함께라 차례와 상관없음
  if(A.ph==='iput'){afterPut();return}
  if(H.turn!==seat||A.ph==='roll')return;
  if(A.ph==='place'){const nx=nextUnplaced(A,seat);if(nx>=0){startTurn(nx,'place');return}afterStones();return}
  if(A.ph==='iput'){afterPut();return}
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
  if(A.inv&&A.inv[seat])A.inv[seat]=[];   // 못 놓은 물건도
  if(eliminate([seat],why))return;
  resumeAfterOut(seat);
}
/* 제한 시간이 지나면 차례를 넘김. 봇(과 탈주해서 봇이 맡은 자리)은 바로 둠. 연결이 끊겨 기다리는 사람도 다른 사람과 똑같이 넘어감 */
function timeout(){
  const i=H.turn,p=H.players[i],A=H.ak;
  if(A.ph==='pick'){   // 아직 못 고른 사람은 아무 물건이나
    for(let s=0;s<A.np&&A.ph==='pick';s++){const q=H.players[s];if(!obNeed(A,s))continue;if(!(q.bot&&!awayHuman(q)))addLog(`${q.name} 시간 초과로 아무 물건이나 고릅니다.`,'sys');while(A.ph==='pick'&&obNeed(A,s)&&pickAny(s));}
    if(A.ph==='pick')afterPick();
    return}
  if(A.ph==='iput'){   // 아직 못 놓은 사람은 아무 자리에
    for(let s=0;s<A.np&&A.ph==='iput';s++){const q=H.players[s];if(!obPutting(A,s))continue;if(!(q.bot&&!awayHuman(q)))addLog(`${q.name} 시간 초과로 아무 자리에 놓습니다.`,'sys');for(let g=0;g<5&&A.ph==='iput'&&obPutting(A,s)&&A.ok[A.inv[s][0]]!=='er';g++)autoPut(s)}
    for(let s=0;s<A.np&&A.ph==='iput';s++)for(let g=0;g<5&&A.ph==='iput'&&obPutting(A,s);g++)autoPut(s);   // 지우개는 마지막에
    return}
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
G._test={OB_K,OB_RAR,OB_BOX,gateTh,rotAng,inWind,gateDist,rbSpawn,doErase,obEraseReady,obDraw,claimPick,resolvePicks,IT,canPut,endFree,itemPlan,doPut,doPick,bhR,brDist,geomOf,JM,jShotK,shotSpin,SPREAD,octHit,octVerts,JSET,jgSetup,useBoard,BD,shotSpeed,mdOf,omGrid,omFive,omThreats,omLines,omTargets,omPlacePlan,omCands,omScore,omFull,simulate,reserves,shotCands,shotScore,botPick,placePlan,canPlace,gridXZ,botPlan,speedOf,groundAt,doShot,doSurrender,timeout,pickFirst,aliveOf,sideOfSeat,ownPt,freeAt,PHY,TOP,SH,SR,BW,PITCH,NL};
G.engine={
  /* 게임 시작: 공통 코드가 H.players를 만든 뒤 부름 */
  start(){
    const again=H.phase==='over',md=mdOf(H.cfg),om=md===1?1:0,jg=md===2?1:0,ob=!om&&+H.cfg.ob?1:0,obn=Math.max(1,Math.min(3,Math.round(+H.cfg.obn||1))),np=Math.min(H.players.length,md?OM_MAX:4),n=om?0:jg?JSET.length:nStones(H.cfg);
    Object.assign(H,{phase:'play',log:[],seatNote:{},field:[],last:null,reveal:null,shouts:[],pending:null,rankNext:1,known:{}});
    H.players.forEach((p,i)=>{
      p.finished=false;p.rank=null;p.surrendered=false;
      if(i<np)p.hand=[0];else{p.hand=[];p.finished=true;p.rank=i+1}   // 자리가 모자라면 구경만 함 (보통은 최대 인원이 맞춰져 있어 생기지 않음)
    });
    const Af=pickFirst(again);
    H.akGid=(H.akGid||0)+1;
    const co=Array(np).fill(0);co[Af]=1;for(let k=1,c=2;k<np;k++)co[(Af+k)%np]=c++;   // 선이 흑(1), 이어서 시계 방향으로 백(2)·적(3)·청(4)
    H.ak={gid:H.akGid,n,np,om,jg,jl:jg&&+H.cfg.jang?1:0,A:Af,co,st:om?[]:jg?jgSetup():reserves(n,np),ph:om||jg?'aim':'place',pc:0,sid:0,sh:null,aim:null,bp:null,res:null,cnt:0,next:Af,until:0,ag:0,ob,obn,it:[],of:null,ok:null,ofs:null,inv:null,igs:{},bt:null,pbt:null,cl:[],go:0};
    useBoard(jg);
    addLog(om?`${H.players[Af].name}님이 흑으로 먼저 둡니다. (오목 모드)`:jg?`${H.players[Af].name}님이 초로 먼저 튕깁니다. (장기 모드${H.ak.jl?', 장 떨어지면 패배':''})`:np>2?`${H.players[Af].name}님이 흑으로 먼저 놓고 먼저 튕깁니다. (알 ${n}개씩 차례로 놓기)`:`${H.players[Af].name}님이 흑으로 먼저 놓고 먼저 튕깁니다. (알 ${n}개씩 번갈아 놓기)`,'sys');
    startTurn(Af,om||jg?'aim':'place');
    if(jg&&ob)startPick();   // 장기 모드는 상차림이 정해져 있어 바로 물건 고르기
  },
  act(seat,a){
    if(a.t==='surrender'){doSurrender(seat);return}
    const A=H.ak;
    if(a.t==='pick'){if(A&&H.phase==='play'&&seat>=0&&seat<A.np)claimPick(seat,+a.k,a.rt);return}   // 고르기·놓기는 모두 함께 (차례 없음)
    if(A&&H.phase==='play'&&seat>=0&&seat<A.np&&A.ph==='iput'){
      if(a.t==='iput'){doPut(seat,a);return}
      if(a.t==='erase'){doErase(seat,+a.i);return}
      if(a.t==='ig'){   // 놓을 물건 미리 보기 (다른 사람에게도 보임)
        const f=v=>Number.isFinite(+v)?Math.round(+v*1000)/1000:null,g=a.on&&obPutting(A,seat)&&f(a.x)!=null&&f(a.z)!=null?{x:f(a.x),z:f(a.z),a:f(a.a)||0}:null;
        if(g&&f(a.x2)!=null&&f(a.z2)!=null){g.x2=f(a.x2);g.z2=f(a.z2)}
        if(g)A.igs[seat]=g;else delete A.igs[seat];mark();return}
    }
    if(!A||H.phase!=='play'||seat<0||seat>=A.np||H.turn!==seat)return;
    if(a.t==='place'){doPlace(seat,a.c,a.r);return}
    if(a.t==='hold'){if(A.ph==='place'){const h=a.on?seat:-1;if(A.hold!==h){A.hold=h;mark()}}return}
    if(A.ph!=='aim')return;
    if(a.t==='aim'){   // 당기는 중 (화살표를 상대에게도 보여 줌). i<0이면 내려놓음
      if(!Number.isInteger(a.i)||a.i<0){if(A.aim){A.aim=null;mark()}return}
      const s=A.st[a.i];if(!s||s.s!==seat||s.o||s.u||!Number.isFinite(+a.a)||!Number.isFinite(+a.p))return;
      A.aim={s:seat,i:a.i,a:Math.round(+a.a*1000)/1000,p:Math.round(Math.max(0,Math.min(1,+a.p))*1000)/1000,w:a.w?1:0,h:a.h?1:0};mark();   // h: 골라 둔 알(아직 안 당김)
    }else if(a.t==='shoot'){
      if(!Number.isInteger(a.i))return;
      doShot(seat,a.i,+a.a,+a.p,+a.j||0,+a.ht);
    }
  },
  tick(t){
    const A=H.ak;
    if(!A||H.phase!=='play')return;
    useBoard(A.jg);
    if(A.ph==='roll'){if(t>=A.until)afterShot();return}
    if(A.ph==='pick'){   // 모두 함께 고름: 봇은 저마다 정한 시각에 누름(어려울수록 희귀한 것을 노림)
      if(t>=H.deadline){timeout();return}
      resolvePicks(t);
      for(let s=0;s<A.np&&A.ph==='pick';s++){const p=H.players[s];if(!p.bot||!A.bt||!A.bt[s]||t<A.bt[s]||!obNeed(A,s)||(p.away&&t<p.awayAt+AWAY_WAIT))continue;
        const free=A.ofs.map((x,k)=>x<0&&!A.cl.some(c=>c.s===s&&c.k===k)?k:-1).filter(k=>k>=0);if(!free.length)continue;
        const lv=typeof botLv==='function'?botLv(p):1,k=lv&&Math.random()<.7?free.reduce((b,k)=>OB_RAR[A.of[k]]>OB_RAR[A.of[b]]?k:b,free[0]):free[Math.random()*free.length|0];
        claimPick(s,k,A.bt[s]-A.go);A.bt[s]=t+obBotRt(p)}
      return}
    if(A.ph==='iput'){   // 모두 함께 놓음: 봇은 저마다 정한 시각에 하나씩
      if(t>=H.deadline){timeout();return}
      for(let s=0;s<A.np&&A.ph==='iput';s++){const p=H.players[s];if(!p.bot||!A.pbt||!A.pbt[s]||t<A.pbt[s]||!obPutting(A,s)||(p.away&&t<p.awayAt+AWAY_WAIT))continue;
        if(A.ok[A.inv[s][0]]==='er'&&!obEraseReady(A))continue;   // 지우개는 다른 물건을 다 놓을 때까지 기다림
        A.pbt[s]=t+rand(1000,2600);autoPut(s)}
      return}
    const cur=H.players[H.turn];if(!cur)return;
    if(t>=H.deadline){timeout();return}
    if(cur.bot&&H.botActAt&&A.ph==='aim'&&!A.bp&&t<H.botActAt&&!(cur.away&&t<cur.awayAt+AWAY_WAIT)){const lv=botLvA(cur);if(BLV[lv])botThink(H.turn,lv)}   // 당기기 전 쉬는 동안 미리 생각
    if(cur.bot&&H.botActAt&&t>=H.botActAt&&!(cur.away&&t<cur.awayAt+AWAY_WAIT)){if(A.ph==='place')autoPlace(H.turn);else botStep(H.turn,t)}
  },
  snap(s,you,t){
    const A=H.ak,r3=v=>Math.round(v*1000)/1000;
    const sh=A.sh?{id:A.sh.id,by:A.sh.by,i:A.sh.i,a:Math.round(A.sh.a*1000)/1000,p:Math.round(A.sh.p*1000)/1000,age:Math.max(0,Math.round(t-A.sh.t0))}:null;
    if(sh&&sh.age<A.sh.dur+4000){sh.tr=A.sh.tr;sh.k=A.sh.k;sh.nf=A.sh.nf;sh.ev=A.sh.ev;sh.of=A.sh.of;sh.dur=A.sh.dur;if(A.sh.it0)sh.it0=A.sh.it0;if(A.sh.sw)sh.sw=A.sh.sw;sh.ht0=A.sh.ht0}   // 자취는 연출 중인 동안만 보냄 (가볍게)
    s.ak={gid:A.gid,n:A.n,np:A.np,A:A.A,co:A.co.slice(),st:A.st.map(q=>q.t?[r3(q.x),r3(q.y),r3(q.z),q.s,q.o?1:0,q.g?1:0,q.u?1:0,q.t,r3(q.w||0)]:[r3(q.x),r3(q.y),r3(q.z),q.s,q.o?1:0,q.g?1:0,q.u?1:0]),jg:A.jg?1:0,jl:A.jl?1:0,ph:A.ph,sid:A.sid,sh,aim:A.aim?{...A.aim}:null,res:A.res?{...A.res,ln:A.res.ln?A.res.ln.map(v=>v.slice()):undefined}:null,cnt:A.cnt,ag:+H.cfg.again?1:0,om:A.om?1:0,hd:A.ph==='place'?(A.hold??-1):-1};
    if(A.ob){
      const placed=new Set(A.it.map(o=>o.o)),seen=i=>A.of[i]!=='qm'||A.ofs[i]===you||placed.has(i);   // '?' 속은 고른 사람만 (놓으면 모두)
      const igs={};for(const k in A.igs){const g=A.igs[k],i=A.inv&&A.inv[k]&&A.inv[k][0];igs[k]=+k===you||i==null||seen(i)?g:{x:g.x,z:g.z}}
      Object.assign(s.ak,{ob:1,obn:A.obn,it:A.it,of:A.of,ok:A.ok?A.ok.map((k,i)=>seen(i)?k:null):null,ofs:A.ofs,inv:A.inv,igs,ht:Math.round(t),erd:A.ph==='iput'&&obEraseReady(A)?1:0,gi:A.go?Math.round(A.go):0,cd:A.go?Math.round(A.go-t):0});
      if(H.phase==='play'&&you>=0&&you<A.np&&((A.ph==='pick'&&obNeed(A,you))||(A.ph==='iput'&&obPutting(A,you))))s.t=you}   // 고르기·놓기: 아직 남은 사람에게는 자기 차례
    s.gr=0;
    if(H.phase==='play'&&(A.ph==='aim'||A.ph==='place'||A.ph==='pick'||A.ph==='iput'))s.dl=Math.max(0,Math.round(H.deadline-t));
    else{s.dl=0;if(H.phase==='play')delete s.t}   // 알이 굴러가는 동안은 아무 차례도 아님 (시간 표시 없음)
  },
  restore(ms){const A=H.ak;if(!A||!ms)return;if(A.until)A.until+=ms;if(A.sh)A.sh.t0+=ms;if(A.bp)A.bp.t0+=ms;if(A.bt)A.bt=A.bt.map(v=>v?v+ms:0);if(A.pbt)A.pbt=A.pbt.map(v=>v?v+ms:0);if(A.go)A.go+=ms;if(A.cl)A.cl.forEach(c=>{c.at+=ms})},   // 시작 연출 동안·방장이 꺼져 있던 동안은 멈춤
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
  return {gid:o.gid,n:o.n,np:o.np||2,A:o.A,co:o.co,st:o.st.map(a=>{const q={x:a[0],y:a[1],z:a[2],s:a[3],o:a[4],g:a[5],u:a[6]};if(a[7]){q.t=a[7];q.w=a[8]||0}return q}),ph:o.ph,sid:o.sid,sh:o.sh,aim:o.aim,res:o.res,cnt:o.cnt,ag:o.ag,om:o.om||0,jg:o.jg||0,jl:o.jl||0,hd:o.hd??-1,ob:o.ob||0,obn:o.obn||1,it:o.it||[],of:o.of||null,ok:o.ok||null,ofs:o.ofs||null,inv:o.inv||null,igs:o.igs||{},erd:o.erd||0,gi:o.gi||0,cd:o.cd||0,ht:o.ht||0};
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
function sndSuck(){tone(560,.55,{type:'sine',vol:.1,slide:55});hiss(.45,{freq:1000,sweep:120,q:2,vol:.08})}   // 블랙홀이 삼킴: 우우웅 내려감
function sndWarp(){tone(320,.16,{type:'sine',vol:.07,slide:1500});tone(1500,.16,{type:'triangle',vol:.04,slide:320,at:.12})}   // 웜홀: 슝
function sndBoing(v){const k=Math.min(1,v/7);tone(210,.26,{type:'sine',vol:.08+.08*k,path:[[.05,560],[.24,300]]})}   // 탱탱볼: 뽀잉
function sndSpring(){tone(250,.2,{type:'triangle',vol:.08,slide:950});hiss(.05,{freq:3000,vol:.04})}   // 점프대: 통
function sndGlass(v){const k=Math.min(1,v/7);for(let j=0;j<5;j++)tone(2200+Math.random()*2400,.08+Math.random()*.1,{type:'triangle',vol:.03+.03*k,at:j*.025});hiss(.25,{freq:5000,q:1.5,vol:.08+.06*k})}   // 유리: 쨍그랑
function sndBox(){hiss(.12,{freq:900,q:1.2,vol:.12});tone(784,.12,{type:'triangle',vol:.06,at:.08});tone(1175,.16,{type:'triangle',vol:.06,at:.16})}   // 랜덤박스: 퍽 + 띠링
function sndFlip(){tone(420,.14,{type:'square',vol:.04,slide:840});tone(840,.14,{type:'square',vol:.04,slide:420,at:.12})}   // 배신자의 길: 띠용띠용
function sndErase(){hiss(.35,{freq:1800,q:.8,vol:.07})}   // 지우개: 쓱쓱
function sndBoom(){hiss(.7,{freq:600,sweep:70,q:.6,ftype:'lowpass',vol:.4});tone(75,.55,{type:'sine',vol:.28,slide:32})}   // 폭탄: 펑

/* ----- 당기기 (3D·2D 같은 계산: 월드 좌표의 당긴 벡터) ----- */
function pickStone(x,z){   // 누른 곳에서 가까운 내 알 (알이 작아도 손가락으로 집기 쉽게 .45 안)
  if(!OS)return -1;
  const me=myIdx();let best=-1,bd=.45;
  OS.st.forEach((s,i)=>{if(s.s!==me||s.o||s.u)return;const d=Math.hypot(s.x-x,s.z-z);if(d<bd){bd=d;best=i}});
  return best;
}
/* 놓기: 누른 곳에서 가장 가까운 줄 점. 처음 누르면 반투명 미리 보기, 같은 점을 한 번 더 누르면 놓음('두 번 눌러 놓기'를 끄면 바로) */
let GH=null;   // 미리 보기 {c,r}
/* 골라 두기: 내 알을 짧게 누르면 그 알이 골라지고 손이 나타남. 그 뒤로는 알이 아닌 아무 곳이나 누르고 끌어도 그 알을 당김(상대좌표: 당긴 벡터 = 누른 점 → 손가락).
   가장자리 알처럼 뒤로 당길 화면이 없을 때 씀. 알 위에서 바로 끌면 예전처럼 그 알을 당김(절대좌표). 빈 곳을 짧게 누르거나 같은 알을 다시 누르면 내려놓음 */
let SEL=-1,selA=0;
const TAPD=.06;   // 이보다 덜 움직이고 떼면 '누르기' (월드 거리, 끝까지 당김 MAXD의 5%)
const fwdAng=()=>{const [sx,sz]=mySide();return Math.atan2(-sz,-sx)};   // 내 쪽에서 앞(맞은편)으로 튕기는 방향
function selOk(){
  if(SEL<0)return false;
  const s=OS&&OS.st[SEL];
  if(!s||s.s!==myIdx()||s.o||s.u||!myTurnNow()||introWait()||Ak3.shot||FLK){SEL=-1;return false}
  return true;
}
function setSel(i,a){
  SEL=i;if(i>=0){selA=a;sendAct({t:'aim',i,a:Math.round(a*1000)/1000,p:0,h:1})}else sendAct({t:'aim',i:-1});
  Ak3.dirty=true;draw2D();
}
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
/* ----- 물건 놓기 (화면): 고르기는 떠 있는 물건을 누름, 놓기는 판을 누르면 미리 보기 → 미리 보기를 한 번 더 누르거나 [놓기] -----
   벽돌은 미리 보기를 누른 채 끌어 방향을 돌림(손가락 쪽으로 길게), 웜홀은 첫 구멍을 놓은 뒤 둘째 구멍 (첫 구멍을 다시 누르면 들어 올림) */
let IG=null,IW1=null,ROT=null,PEND=null,PUTW=null;   // 내 미리 보기 {x,z,a}, 웜홀 첫 구멍 {x,z}, 벽돌 돌리기, 누르고 결과를 기다리는 고르기·놓기
const CD={gi:0,at:0,shown:-1};
const HO={off:null};   // 방장 시계와의 차이 (받은 상태 중 가장 작은 값 = 늦게 온 것을 뺀 값)
function hostNow(now){const S=Ak3.shot;if(S&&S.sh&&S.sh.ht0!=null){const e=now-S.t0;if(e>=0&&e<=(S.sh.dur||0)+60)return S.sh.ht0+e}return now-(HO.off||0)}   // 튕긴 자취를 재생하는 동안은 계산한 시각 그대로   // 카운트다운: 이 기기에서 0이 되는 시각 (방장이 보낸 남은 시간을 받은 순간부터 셈)
const cdLeft=()=>OS&&OS.gi&&CD.gi===OS.gi?CD.at-clock():0;
const seatOk=i=>i>=0&&i<npOf();
const dispKind=i=>OS&&OS.of?(OS.ok&&OS.ok[i])||OS.of[i]:null;   // 보이는 물건: '?' 속은 고른 사람만 (모르면 qm)
const putKind=seat=>OS&&OS.inv&&OS.inv[seat]&&OS.inv[seat].length&&OS.of?dispKind(OS.inv[seat][0]):null;
const putting=seat=>!!(OS&&OS.ph==='iput'&&V&&V.st==='play'&&putKind(seat)&&!(V.ps[seat]&&V.ps[seat].f));
const picksOf=seat=>OS&&OS.ofs?OS.ofs.filter(x=>x===seat).length:0;
const myPickNow=()=>{const me=myIdx();return !!(V&&V.ak&&V.st==='play'&&OS&&OS.ph==='pick'&&OS.of&&!introWait()&&seatOk(me)&&!(V.ps[me]&&V.ps[me].f)&&picksOf(me)<(OS.obn||1)&&cdLeft()<=0)};
const myPutNow=()=>{const me=myIdx();return !!(seatOk(me)&&putting(me)&&!introWait()&&cdLeft()<=0)};
/* 지우개: 상대가 놓은 물건을 눌러 고르고(IG.i), 한 번 더 누르거나 [놓기]면 지움. 다른 물건을 다 놓을 때까지(OS.erd) 기다림 */
function eraseHit(x,z){const me=myIdx();let best=-1,bd=1e9;(OS.it||[]).forEach((o,i)=>{if(o.s===me||o.u)return;
  const d=OB_BOX[o.k]?brDist(o,x,z)-.06:o.k==='gt'?gateDist(o,x,z)-.06:o.k==='rt'?Math.hypot(x-o.x,z-o.z)-IT.rt.L*.9:Math.min(...itPts(o).map(([px,pz])=>Math.hypot(px-x,pz-z)))-(o.k==='bh'?(o.r||IT.bh.rc)*1.6:TOKR[o.k]);
  if(d<.08&&d<bd){bd=d;best=i}});return best}
function igItem(){
  const k=putKind(myIdx());if(!k||!IG)return null;
  const o={k,x:IG.x,z:IG.z};if(k==='bh')o.r=IT.bh.rc;if(OB_ANG[k])o.a=IG.a||0;if(k==='rt')o.a=0;
  if(k==='wh'){if(!IW1)return null;o.x=IW1.x;o.z=IW1.z;o.x2=IG.x;o.z2=IG.z}
  return o;
}
function igOk(){const k=putKind(myIdx());if(!k||!IG)return false;if(k==='er'){const o=OS.it[IG.i];return !!OS.erd&&!!o&&o.s!==myIdx()&&!o.u}return k==='wh'&&!IW1?endFree(OS,IG.x,IG.z):canPut(OS,igItem())}
function sendIg(){
  const k=putKind(myIdx()),a={t:'ig',on:1};
  if(k==='wh'&&IW1){a.x=IW1.x;a.z=IW1.z;if(IG){a.x2=IG.x;a.z2=IG.z}}
  else if(IG){a.x=IG.x;a.z=IG.z;a.a=Math.round((IG.a||0)*1000)/1000}
  else{sendAct({t:'ig',on:0});return}
  sendAct(a);
}
const obRedraw=()=>{Ak3.dirty=true;draw2D();G.buttons();drawHint()};
const brickAng0=()=>fwdAng()+Math.PI/2;   // 처음 벽돌 방향: 내 화면에서 가로
function itemTap(x,z){
  if(!myPutNow()){sndNo();return}
  const k=putKind(myIdx());
  if(k==='er'){   // 지우개
    if(!OS.erd){sndNo();return}
    const i=eraseHit(x,z);if(i<0){if(IG){IG=null;sndPickUp();sendIg();obRedraw()}else sndNo();return}
    if(IG&&IG.i===i){if(typeof dblTap!=='undefined'&&!dblTap){IG=null;sndPickUp();sendIg();obRedraw();return}confirmIG();return}
    const o=OS.it[i];if(!IG)sndPickUp();IG={x:o.x,z:o.z,i};sendIg();obRedraw();return}
  if(k==='wh'&&IW1&&Math.hypot(x-IW1.x,z-IW1.z)<.2&&!(IG&&Math.hypot(x-IG.x,z-IG.z)<.2)){IW1=null;IG=null;sndPickUp();sendIg();obRedraw();return}   // 첫 구멍을 다시 누르면 들어 올림
  if(IG&&Math.hypot(x-IG.x,z-IG.z)<.2){
    if(typeof dblTap!=='undefined'&&!dblTap){IG=null;sndPickUp();sendIg();obRedraw();return}   // 두 번 눌러 놓기를 끄면 같은 곳을 다시 누를 때 취소 (알 놓기와 같음)
    confirmIG();return}
  if(!IG)sndPickUp();
  IG={x:Math.round(x*1000)/1000,z:Math.round(z*1000)/1000,a:IG?IG.a:k==='fn'?fwdAng():OB_ANG[k]?brickAng0():0};   // 선풍기는 처음에 상대 쪽을 봄
  sendIg();obRedraw();
}
function confirmIG(){
  if(!myPutNow()||!IG){sndNo();return}
  const k=putKind(myIdx());
  if(k==='er'){if(!igOk()){sndNo();return}sendAct({t:'erase',i:IG.i});PUTW={oi:OS.inv[myIdx()][0],t:clock(),g:{...IG},w:null};IG=null;obRedraw();return}
  if(k==='wh'&&!IW1){if(!endFree(OS,IG.x,IG.z)){sndNo();return}IW1={x:IG.x,z:IG.z};IG=null;sndTap(2);sendIg();obRedraw();return}
  if(!igOk()){sndNo();return}
  const o=igItem();sendAct({t:'iput',x:o.x,z:o.z,a:o.a,x2:o.x2,z2:o.z2});PUTW={oi:OS.inv[myIdx()][0],t:clock(),g:{...IG},w:IW1};IG=null;IW1=null;obRedraw();
}
/* 고르기: 떠 있는 물건 자리 (내 화면 가로로 한두 줄, 판 가운데) */
function tokRow(i){
  const n=OS.of.length,cols=n>7?Math.ceil(n/2):n,rows=Math.ceil(n/cols),row=Math.floor(i/cols),col=i%cols,inRow=row<rows-1?cols:n-cols*(rows-1);
  const sp=Math.min(.6,(2*Math.min(BD.x,BD.z)-.5)/Math.max(1,cols)),X=(col-(inRow-1)/2)*sp,Y=(row-(rows-1)/2)*sp*1.1;
  return unrotXZ(X,Y);
}
/* 고른 물건: 주인 쪽 판 바깥 (놓기 전 알 자리처럼) */
function trayAt(seat,j,n){const [sx,sz]=sideOfSeat(seat,npOf()),d=(sz?BD.z:BD.x)+.3,x=1.25+(j-(n-1)/2)*.42;return [sz*x+sx*d,-sx*x+sz*d]}   // 이름 칸을 비켜 주인 쪽에서 오른쪽
const picksList=seat=>OS.of.map((k,i)=>OS.ofs[i]===seat?i:-1).filter(i=>i>=0);
function pickTap(x,z){
  if(!myPickNow()){sndNo();return}
  let best=-1,bd=.3;
  OS.of.forEach((k,i)=>{if(OS.ofs[i]>=0)return;const [px,pz]=tokRow(i),d=Math.hypot(px-x,pz-z);if(d<bd){bd=d;best=i}});
  if(best<0)return;
  PEND={k:best,t:clock()};sendAct({t:'pick',k:best,rt:Math.round(-cdLeft())});sndPickUp();   // rt: 내 화면에서 0이 된 뒤 걸린 시간
}
function dragStart(x,z){
  if(!OS||!V||V.st!=='play')return false;
  const me=myIdx();if(me<0)return false;
  if(OS.ph==='pick'){pickTap(x,z);return false}
  if(OS.ph==='iput'){
    if(myPutNow()&&IG&&OB_ANG[putKind(me)]&&Math.hypot(x-IG.x,z-IG.z)<.3){ROT={x0:x,z0:z,mv:false};return true}   // 벽돌 미리 보기를 누른 채 끌면 돌림
    itemTap(x,z);return false}
  if(OS.ph==='place'){placeTap(x,z);return false}
  const i=pickStone(x,z);
  if(i<0){
    if(selOk()&&OS.ph==='aim'){   // 골라 둔 알이 있으면 아무 곳에서나 끌어 그 알을 당김 (상대좌표)
      drag={i:SEL,rel:1,x0:x,z0:z,px:0,pz:0,L:0,p:0,over:false,lvl:0,sent:0,sp:-1,sa:0,a0:selA,ph:Math.random()*1e6};
      Ak3.dirty=true;draw2D();return true}
    if(OS.om&&OS.ph==='aim'&&!introWait())placeTap(x,z);return false}   // 오목 모드: 내 돌이 없는 곳을 누르면 그 점에 놓기
  if(!myTurnNow()||introWait()||Ak3.shot){sndNo();return true}   // 내 알이지만 지금은 못 튕김
  drag={i,x0:x,z0:z,px:0,pz:0,L:0,p:0,over:false,lvl:0,sent:0,sp:-1,sa:0,a0:selOk()&&SEL===i?selA:fwdAng(),ph:Math.random()*1e6};   // ph: 떨림 위상 (매번 다르게)
  sndPickUp();Ak3.dirty=true;
  return true;
}
function dragMove(x,z){
  if(ROT){if(!ROT.mv&&Math.hypot(x-ROT.x0,z-ROT.z0)>TAPD)ROT.mv=true;
    if(ROT.mv&&IG&&Math.hypot(x-IG.x,z-IG.z)>.05){IG.a=Math.round(Math.atan2(z-IG.z,x-IG.x)*1000)/1000;obRedraw()}return}
  if(!drag)return;
  drag.px=x-drag.x0;drag.pz=z-drag.z0;drag.L=Math.hypot(drag.px,drag.pz);
  const p=Math.min(1,drag.L/MAXD),over=drag.L>MAXD;
  if(over&&!drag.over){sndMax();try{navigator.vibrate&&navigator.vibrate(14)}catch(e){}}   // 끝까지: 팽팽한 소리·진동 (더 세지지 않음)
  const lvl=Math.floor(p*10);
  if(!over&&lvl>drag.lvl)sndStretch(p);
  drag.lvl=lvl;drag.p=p;drag.over=over;
  sendAim(false);Ak3.dirty=true;
}
const baseAng=d=>d.L>.02?Math.atan2(-d.pz,-d.px):d.a0;   // 겨눈 방향 = 당긴 방향의 반대 (떨림 전). 아직 안 움직였으면 처음 방향
function sendAim(force){
  if(!drag)return;
  const t=clock(),a=drag.L>1e-4?baseAng(drag):0;
  if(!force&&t-drag.sent<SEND_MS)return;
  if(!force&&Math.abs(drag.p-drag.sp)<.015&&Math.abs(a-drag.sa)<.015)return;
  drag.sent=t;drag.sp=drag.p;drag.sa=a;
  sendAct({t:'aim',i:drag.i,a,p:drag.p,w:drag.over?1:0});
}
function dragEnd(cancel){
  if(ROT){const r=ROT;ROT=null;if(cancel)return;if(!r.mv)itemTap(r.x0,r.z0);else sendIg();return}
  if(!drag)return;
  const d=drag;drag=null;Ak3.dirty=true;draw2D();
  if(!cancel&&d.L<TAPD&&myTurnNow()){   // 누르기: 알이면 고르기(같은 알이면 내려놓기), 빈 곳이면 내려놓기
    if(d.rel||SEL===d.i){setSel(-1);sndPickUp()}else setSel(d.i,d.a0);
    return}
  if(cancel||d.p<PMIN||!myTurnNow()){
    if(selOk())setSel(SEL,selA);else sendAct({t:'aim',i:-1});   // 골라 둔 알이 있으면 다시 그 알을 들고 있음
    if(!cancel&&!d.rel&&OS&&OS.om&&d.p<PMIN&&myTurnNow()){placeTap(d.x0,d.z0);return}   // 오목 모드: 거의 안 당기고 놓으면 누른 점에 놓기
    if(!cancel&&d.L>.02)sndPickUp();return}
  const t=clock(),j=spreadOf(d.p)*jit(t+d.ph),a=baseAng(d)+j;   // 놓는 순간 손이 가리키던 방향 (j: 그중 떨림 몫)
  const q=OS.st[d.i];SEL=-1;
  sendAct({t:'shoot',i:d.i,a,p:d.p,j:Math.round(j*1e5)/1e5,ht:Math.round(clock()-(HO.off||0))});   // 놓은 순간의 방장 시각 (차단기·회전판을 본 대로)
  sndFlick();Ak3.flickAt=t;
  FLK={i:d.i,a,j,p:d.p,seat:myIdx(),t0:t,x:q.x,z:q.z,mine:true};
}
/* 손으로 보여 줄 것: 내가 당기는 중이면 그것, 아니면 방장이 알려 준 상대(봇)의 당기기 (부드럽게 따라감).
   a: 겨눈 방향(떨림 전), 실제로 그리는 방향은 shownAng (떨림은 화면마다 따로: 상대의 떨림 위상은 알 수 없음) */
const AIM={i:-1,a:0,p:0,at:0,ph:0};
function aimNow(t){
  if(drag)return {i:drag.i,a:baseAng(drag),p:drag.p,mine:true,seat:myIdx(),ph:drag.ph,sel:drag.rel||SEL===drag.i?1:0};
  if(selOk())return {i:SEL,a:selA,p:0,mine:true,seat:myIdx(),ph:0,sel:1};
  const o=OS&&OS.aim,me=myIdx();
  if(!o||OS.ph!=='aim'||V.st!=='play'||Ak3.shot||o.s===me){AIM.i=-1;return null}
  if(AIM.i!==o.i){AIM.i=o.i;AIM.a=o.a;AIM.p=0;AIM.ph=Math.random()*1e6}
  const k=Math.min(1,Math.max(0,(t-(AIM.at||t))/1000)*14);AIM.at=t;
  let da=o.a-AIM.a;while(da>Math.PI)da-=2*Math.PI;while(da<-Math.PI)da+=2*Math.PI;
  AIM.a+=da*k;AIM.p+=(o.p-AIM.p)*k;
  return {i:o.i,a:AIM.a,p:AIM.p,mine:false,seat:o.s,ph:AIM.ph,sel:o.h?1:0};
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
  if(!a||!pos[a.i]||V.st!=='play'||Ak3.shot||(!a.sel&&a.p<(OS&&OS.om?PMIN:.005)))return null;   // 오목 모드: 조금 당긴 것은 누르기라 손을 안 그림. 골라 둔 알은 안 당겨도 손이 보임
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
/* 물건 그림 (2D): 화면 좌표 X,Y, 크기 sc(판 위 1), 벽돌 방향 a(월드), 블랙홀 구멍 r, 주인 own(-1 없음), op 진하기, bad 놓을 수 없음 */
function itSvg(k,x,z,o){
  o=o||{};const [X,Y]=w2s(x,z),sc=o.sc||1,op=o.op!=null?o.op:1,out=[];
  const ring=r=>o.own>=0?`<circle r="${r}" fill="none" stroke="${HCOL[Math.max(0,handCol(o.own))%HCOL.length]}" stroke-width=".022"/>`:o.rar!=null?`<circle r="${r}" fill="none" stroke="${RCSS[o.rar]}" stroke-width="${o.rar===2?.04:.025}"/>`:'';
  if(k==='bh'){const r=o.r||IT.bh.rc;out.push(o.sc?'':`<circle r="${bhR({r})}" fill="none" stroke="#7a4cc0" stroke-width=".012" stroke-dasharray=".05 .04" opacity=".55"/>`,`<circle r="${r*2.1}" fill="url(#akBh)"/><circle r="${r}" fill="#050308" stroke="#ffe2a0" stroke-width=".012"/>`,ring(r*2.1+.02))}
  else if(k==='wh')out.push(`<circle r="${IT.wh.r}" fill="url(#akWh)" stroke="#8f7cff" stroke-width=".03"/>`,ring(IT.wh.r+.03));
  else if(k==='br'){const a=o.a||0,[ux,uy]=w2s(Math.cos(a),Math.sin(a)),deg=Math.atan2(uy,ux)*180/Math.PI;out.push(`<g transform="rotate(${deg.toFixed(1)})"><rect x="${-IT.br.L}" y="${-IT.br.W}" width="${2*IT.br.L}" height="${2*IT.br.W}" rx=".01" fill="#b3452c" stroke="#3b2a1f" stroke-width=".015"/><line x1="${-IT.br.L}" y1="0" x2="${IT.br.L}" y2="0" stroke="#e2cfae" stroke-width=".01"/>${o.own>=0?`<rect x="${-IT.br.L-.03}" y="${-IT.br.W-.03}" width="${2*IT.br.L+.06}" height="${2*IT.br.W+.06}" rx=".03" fill="none" stroke="${HCOL[Math.max(0,handCol(o.own))%HCOL.length]}" stroke-width=".02"/>`:''}</g>`)}
  else if(k==='tb')out.push(`<circle r="${IT.tb.r}" fill="#ff5c8a" stroke="#3b2a1f" stroke-width=".015"/><ellipse rx="${IT.tb.r}" ry="${IT.tb.r*.25}" fill="none" stroke="#fff1d6" stroke-width=".02"/><circle cx="${-IT.tb.r*.35}" cy="${-IT.tb.r*.35}" r="${IT.tb.r*.22}" fill="#fff" opacity=".6"/>`,ring(IT.tb.r+.03));
  else if(k==='ic')out.push(`<circle r="${IT.ic.r}" fill="rgba(170,220,255,.6)" stroke="rgba(255,255,255,.85)" stroke-width=".015"/><path d="M-.2 -.15 L.05 .05 L.25 -.05 M-.05 .2 L.08 .05" stroke="#fff" stroke-width=".012" fill="none"/>`,ring(IT.ic.r));
  else if(k==='sd')out.push(`<circle r="${IT.sd.r}" fill="#d6ad62" stroke="rgba(59,42,31,.45)" stroke-width=".012"/><circle r="${IT.sd.r*.62}" fill="none" stroke="rgba(120,85,40,.45)" stroke-width=".014" stroke-dasharray=".02 .03"/><circle r="${IT.sd.r*.3}" fill="none" stroke="rgba(120,85,40,.45)" stroke-width=".014" stroke-dasharray=".02 .03"/>`,ring(IT.sd.r));
  else if(k==='jp')out.push(`<circle r="${IT.jp.r}" fill="#3a3f46"/><circle r="${IT.jp.r*.8}" fill="#f2c230" stroke="#3b2a1f" stroke-width=".012"/><circle r="${IT.jp.r*.4}" fill="none" stroke="#3b2a1f" stroke-width=".01"/>`,ring(IT.jp.r+.03));
  else if(k==='gl'||k==='tr'){const a=o.a||0,[ux,uy]=w2s(Math.cos(a),Math.sin(a)),deg=Math.atan2(uy,ux)*180/Math.PI,L=IT[k].L,W=IT[k].W,oc=o.own>=0?HCOL[Math.max(0,handCol(o.own))%HCOL.length]:null;
    out.push(k==='gl'?`<g transform="rotate(${deg.toFixed(1)})"><rect x="${-L}" y="${-W}" width="${2*L}" height="${2*W}" fill="rgba(191,234,255,.6)" stroke="#fff" stroke-width=".012"/>${oc?`<line x1="${-L*.8}" y1="0" x2="${L*.8}" y2="0" stroke="${oc}" stroke-width=".02"/>`:''}</g>`
      :`<g transform="rotate(${deg.toFixed(1)})"><rect x="${-L}" y="${-W}" width="${2*L}" height="${2*W}" fill="#2b2340" ${oc?`stroke="${oc}" stroke-width=".02"`:''}/>${[-.6,-.2,.2,.6].map(f=>`<rect x="${L*f-.04}" y="${-W}" width=".08" height="${2*W}" fill="#d63a6a" transform="skewX(-25)"/>`).join('')}<text y=".03" font-size=".09" text-anchor="middle" fill="#fff3d6">⇄</text></g>`)}
  else if(k==='gu')out.push(`<circle r="${IT.gu.r}" fill="rgba(226,156,40,.85)" stroke="rgba(150,90,10,.6)" stroke-width=".012"/><ellipse cx="-.12" cy="-.12" rx=".1" ry=".035" fill="#fff" opacity=".55" transform="rotate(-35 -.12 -.12)"/><circle cx=".1" cy=".08" r=".025" fill="#fff6d6" opacity=".7"/><circle cx="-.05" cy=".15" r=".018" fill="#fff6d6" opacity=".7"/>`,ring(IT.gu.r));
  else if(k==='rb')out.push(`<rect x="-.1" y="-.1" width=".2" height=".2" rx=".015" fill="#e0473a" stroke="#8a2a22" stroke-width=".015"/><rect x="-.016" y="-.1" width=".032" height=".2" fill="#ffd23f"/><rect x="-.1" y="-.016" width=".2" height=".032" fill="#ffd23f"/>`,ring(.15));
  else if(k==='er')out.push(`<rect x="-.12" y="-.06" width=".24" height=".12" rx=".02" fill="#f28ab0" stroke="#3b2a1f" stroke-width=".012"/><rect x="0" y="-.062" width=".12" height=".124" fill="#4f7fd8"/>`,ring(.16));
  else if(k==='fn'){const a=o.a||0,[ux,uy]=w2s(Math.cos(a),Math.sin(a)),deg=Math.atan2(uy,ux)*180/Math.PI,F=IT.fn;
    out.push(`<g transform="rotate(${deg.toFixed(1)})"><rect x="${F.r}" y="${-F.W}" width="${F.L}" height="${2*F.W}" fill="rgba(170,215,245,.35)"/>${[.3,.65,1].map(f=>`<path d="M${F.r+F.L*f-.08} ${-F.W*.5} l.08 ${F.W*.5} l-.08 ${F.W*.5}" stroke="#fff" stroke-width=".02" fill="none" opacity=".8"/>`).join('')}<circle r="${F.r}" fill="#6b7480" stroke="#3b2a1f" stroke-width=".012"/><circle r="${F.r*.6}" fill="none" stroke="#d9dee3" stroke-width=".015"/><path d="M0 -.05 L.012 0 L0 .05 L-.012 0Z" fill="#5fb3e8"/></g>`,ring(F.r+.03))}
  else if(k==='gt'){const a=o.a||0,[ux,uy]=w2s(Math.cos(a),Math.sin(a)),deg=Math.atan2(uy,ux)*180/Math.PI,up=(o.th||0)>.3;   // 올라간 막대는 옅게
    out.push(`<g transform="rotate(${deg.toFixed(1)})"><line x1="0" y1="0" x2="${IT.gt.L*(up?.35:1)}" y2="0" stroke="#d8322a" stroke-width=".05" stroke-dasharray=".08 .08" opacity="${up?.45:1}"/><line x1="0" y1="0" x2="${IT.gt.L*(up?.35:1)}" y2="0" stroke="#fff" stroke-width=".05" stroke-dasharray=".08 .08" stroke-dashoffset=".08" opacity="${up?.45:1}"/></g><circle r=".035" fill="#f4f1ea" stroke="#3b2a1f" stroke-width=".012"/>`,ring(.06))}
  else if(k==='rt'){const ph=o.ph!=null?o.ph:(o.a||0),[ux,uy]=w2s(Math.cos(ph),Math.sin(ph)),deg=Math.atan2(uy,ux)*180/Math.PI,R=IT.rt;
    out.push(`<circle r="${R.L}" fill="none" stroke="#3b2a1f" stroke-width=".01" stroke-dasharray=".03 .03" opacity=".5"/><g transform="rotate(${deg.toFixed(1)})"><rect x="${-R.L}" y="${-R.W}" width="${2*R.L}" height="${2*R.W}" fill="#f2c230" stroke="#24201c" stroke-width=".012"/></g><circle r=".05" fill="#3b4048"/>`,ring(R.L+.02))}
  else if(k==='qm')out.push(`<rect x="-.1" y="-.1" width=".2" height=".2" rx=".015" fill="#c98f4a" stroke="#3b2a1f" stroke-width=".015"/><text y=".055" font-size=".17" font-weight="900" text-anchor="middle" fill="#fff3d6" stroke="#3b2a1f" stroke-width=".02" paint-order="stroke">?</text>`,ring(.15));
  else if(k==='bm')out.push(`<circle r="${IT.bm.r}" fill="#2a2a30" stroke="#0c0c0e" stroke-width=".012"/><path d="M0 ${-IT.bm.r} q.02 -.05 .05 -.06" stroke="#8a6a3a" stroke-width=".014" fill="none"/><circle cx=".05" cy="${-IT.bm.r-.06}" r=".022" fill="#ffb030"/>`,ring(IT.bm.r+.03));
  if(o.bad)out.unshift(`<circle r="${OB_BOX[k]?IT[k].L+.04:k==='bh'?IT.bh.rc*2.1:TOKR[k]+.03}" fill="#d6281e" opacity=".42"/>`);
  return `<g transform="translate(${X.toFixed(3)} ${Y.toFixed(3)}) scale(${sc.toFixed(3)})"${op<1?` opacity="${op}"`:''}>${out.join('')}</g>`;
}
function items2D(top){   // top: 떠 있는 것(고르기 물건·미리 보기)만, 아니면 판 위 물건과 주인 쪽 물건
  if(!OS||!OS.ob||!OS.of)return '';
  const out=[],its=itemsNow(clock()),placed={};its.forEach((o,ii)=>{placed[o.o]=ii});
  if(!top){
    const HT=hostNow(clock());
    its.forEach(o=>{if(o.u)return;out.push(itSvg(o.k,o.x,o.z,{r:o.r,a:o.a,own:o.s,th:o.k==='gt'?gateTh(o,HT):0,ph:o.k==='rt'?rotAng(o,HT):null}));if(o.k==='wh')out.push(itSvg('wh',o.x2,o.z2,{own:o.s}))});
    if(OS.ph==='pick'||OS.ph==='iput')
      OS.of.forEach((k0,i)=>{const ow=OS.ofs[i],k=dispKind(i);if(ow<0||placed[i]!=null)return;const L=picksList(ow),[x,z]=trayAt(ow,L.indexOf(i),L.length),cur=OS.ph==='iput'&&putting(ow)&&OS.inv[ow][0]===i;out.push(itSvg(k,x,z,{sc:(TOK_R/TOKR[k])*(cur?1.25:1),own:ow,a:fwdAng()+Math.PI/2}))});
    return out.join('');
  }
  if(OS.ph==='pick'&&V.st==='play')OS.of.forEach((k,i)=>{if(OS.ofs[i]>=0)return;const [x,z]=tokRow(i),[X,Y]=w2s(x,z);out.push(`<circle cx="${X}" cy="${Y+.03}" r="${TOK_R+.02}" fill="#000" opacity=".18"/>`+itSvg(k,x,z,{sc:TOK_R/TOKR[k],a:fwdAng()+Math.PI/2,rar:OB_RAR[k]})+`<text x="${X}" y="${Y+TOK_R+.11}" font-size=".1" text-anchor="middle" fill="${RCSS[OB_RAR[k]]}" font-weight="700" stroke="#fffaf0" stroke-width=".025" paint-order="stroke">${OB_NM[k]}</text>`)});
  for(const gn of ghostsNow()){out.push(itSvg(gn.k,gn.x,gn.z,{a:gn.a,op:.55,own:gn.seat,bad:gn.mine&&gn.bad&&!(gn.k==='wh'&&gn.x2!=null)}));if(gn.x2!=null)out.push(itSvg('wh',gn.x2,gn.z2,{op:.55,own:gn.seat,bad:gn.mine&&gn.bad}))}
  {const c=cdLeft();if(c>0&&(OS.ph==='pick'||OS.ph==='iput')&&V.st==='play')out.push(`<text x="0" y=".22" font-size=".7" font-weight="900" text-anchor="middle" fill="#fffaf0" stroke="#3b2a1f" stroke-width=".05" paint-order="stroke" opacity=".92">${Math.ceil(c/1000)}</text>`)}
  return out.join('');
}
function stones2D(pos){
  const out=[items2D(false)],t=clock(),np=npOf(),me=myIdx();
  pos.forEach((q,i)=>{
    const s=OS.st[i];if(!s||q.y<-.5)return;
    const so=stOwn(i),gm=geomOf(s.t),c=stC(OS.co[so]),[X,Y]=w2s(q.x,q.z),h=Math.max(0,q.y-(groundAt(q.x,q.z)+gm.h)),k=stoneScale(q.y,gm.h);
    if(s.t){   // 장기 알: 팔각 + 한자, 글자 위쪽은 주인 쪽에서 바로 읽히는 방향 + 돈 각도
      const a=ownAng(so)+(q.w||0),[UX,UY]=w2s(Math.cos(a),-Math.sin(a)),deg=Math.atan2(UX,-UY)*180/Math.PI;
      out.push(`<circle cx="${X+h*.5}" cy="${Y+h*.35}" r="${gm.rv*(1+h*.8)}" fill="#000" opacity="${.28/(1+h*5)}"/>`+jPieceSvg(s.t,jCol(so),X,Y,deg,gm.rv*k));
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
  if(drag&&drag.rel){const [X,Y]=w2s(drag.x0,drag.z0);out.push(`<circle cx="${X}" cy="${Y}" r="${SR*.9}" fill="none" stroke="#f2b632" stroke-width=".03" opacity=".85"/><circle cx="${X}" cy="${Y}" r="${SR*.28}" fill="#f2b632" opacity=".85"/>`)}   // 상대좌표로 당길 때 누른 점
  out.push(items2D(true));
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
  if(OS.ph==='pick'&&!introWait())return '물건 고르기';
  if(OS.ph==='iput'&&!introWait()){const k=putKind(myIdx());return k?`물건 놓기 · ${OB_NM[k]}${k==='wh'?(IW1?' 2/2':' 1/2'):k==='er'&&!OS.erd?' (마지막)':''}`:'물건 놓기'}
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
    {const rg=new THREE.Group(),m2=new THREE.MeshBasicMaterial({color:0xf2b632,transparent:true,opacity:.85,depthTest:false,depthWrite:false});   // 상대좌표로 당길 때 누른 점
     for(const g of [new THREE.RingGeometry(SR*.8,SR*.98,32),new THREE.CircleGeometry(SR*.28,20)]){const m=new THREE.Mesh(g,m2);m.rotation.x=-Math.PI/2;m.renderOrder=8;rg.add(m)}
     rg.visible=false;root.add(rg);Ak3.relDot=rg}
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
/* 재생 중인 알의 주인: 배신자의 길로 바뀐 알은 그 순간까지 예전 주인 (sh.sw [ms, 알, 예전, 새]) */
function stOwn(i){const s=OS.st[i];if(!s)return 0;const S=Ak3.shot;if(!S||!S.sh.sw)return s.s;const e=clock()-S.t0;let o=s.s;for(let k=S.sh.sw.length-1;k>=0;k--){const w=S.sh.sw[k];if(w[1]===i&&w[0]>e)o=w[2]}return o}
/* 알 개수·색이 바뀌면 다시 만듦 */
function ak3Stones(){
  if(!Ak3.built||!OS)return;
  const key=OS.st.map((s,i)=>OS.co[stOwn(i)]+(s.t?'j'+s.t:'')).join(',');
  if(Ak3.sKey===key)return;
  Ak3.sKey=key;
  for(const m of [...Ak3.stones,...Ak3.rings,...Ak3.blobs])Ak3.root.remove(m);
  Ak3.stones=OS.st.map((s,i)=>{const o=stOwn(i),m=s.t?jMesh(s.t,jCol(o)):stoneMesh(OS.co[o]);Ak3.root.add(m);return m});
  Ak3.blobs=OS.st.map(()=>{const b=new THREE.Mesh(Ak3.blobGeo,new THREE.MeshBasicMaterial({color:0x1a120c,transparent:true,opacity:.28,depthWrite:false}));b.rotation.x=-Math.PI/2;b.renderOrder=2;Ak3.root.add(b);return b});
  Ak3.rings=OS.st.map(()=>{const r=new THREE.Mesh(Ak3.ringGeo,Ak3.ringM);r.rotation.x=-Math.PI/2;r.visible=false;r.renderOrder=3;Ak3.root.add(r);return r});
}
/* ----- 물건 (3D) -----
   판 위 물건(Ak3.itB[고르기 번호]), 고르기·놓기 동안의 작은 물건(Ak3.tok[고르기 번호]: 판 가운데 떠 있다가 → 고른 사람 쪽 판 바깥 → 놓으면 판으로 날아가고 판 물건이 나타남),
   놓을 자리 미리 보기(Ak3.gh, 놓을 수 없으면 빨간 원), 효과(폭탄 불꽃·웜홀 빛). 놓은 사람 색(손 색) 고리 */
const ITX={};
function itTex(n){
  if(ITX[n])return ITX[n];
  const spiral=(g,c,arms,r0,r1,turn,col,lw)=>{g.strokeStyle=col;g.lineWidth=lw;g.lineCap='round';for(let k=0;k<arms;k++){g.beginPath();for(let t=0;t<=1.001;t+=.04){const r=c*(r0+(r1-r0)*t),a=k*Math.PI*2/arms+t*turn,x=c+Math.cos(a)*r,y=c+Math.sin(a)*r;t?g.lineTo(x,y):g.moveTo(x,y)}g.stroke()}};
  const disc=(g,c,gr)=>{g.fillStyle=gr;g.beginPath();g.arc(c,c,c,0,Math.PI*2);g.fill()};
  const D={
    bh:(g,w)=>{const c=w/2;g.clearRect(0,0,w,w);const gr=g.createRadialGradient(c,c,c*.44,c,c,c);gr.addColorStop(0,'rgba(255,200,95,1)');gr.addColorStop(.35,'rgba(214,92,200,.85)');gr.addColorStop(1,'rgba(70,30,140,0)');disc(g,c,gr);
      spiral(g,c,5,.48,.98,2.6,'rgba(40,10,60,.45)',w*.035);g.fillStyle='#050308';g.beginPath();g.arc(c,c,c*.476,0,Math.PI*2);g.fill();g.strokeStyle='rgba(255,226,160,.95)';g.lineWidth=w*.014;g.beginPath();g.arc(c,c,c*.49,0,Math.PI*2);g.stroke()},
    wh:(g,w)=>{const c=w/2;g.clearRect(0,0,w,w);const gr=g.createRadialGradient(c,c,0,c,c,c);gr.addColorStop(0,'#0b0820');gr.addColorStop(.45,'#3b2a9a');gr.addColorStop(.85,'#5fd0f4');gr.addColorStop(1,'rgba(95,208,244,0)');disc(g,c,gr);spiral(g,c,4,.1,.9,3.4,'rgba(200,245,255,.55)',w*.03)},
    ic:(g,w)=>{const c=w/2;g.clearRect(0,0,w,w);const gr=g.createRadialGradient(c,c,0,c,c,c);gr.addColorStop(0,'rgba(214,240,255,.85)');gr.addColorStop(.88,'rgba(160,214,248,.8)');gr.addColorStop(1,'rgba(160,214,248,0)');disc(g,c,gr);
      let s2=7;const r=()=>{s2=(s2*16807)%2147483647;return s2/2147483647};g.strokeStyle='rgba(255,255,255,.85)';g.lineWidth=w*.008;for(let k=0;k<9;k++){let a=r()*6.28,x=c+Math.cos(a)*c*.2*r(),y=c+Math.sin(a)*c*.2*r();g.beginPath();g.moveTo(x,y);for(let j=0;j<5;j++){a+=(r()-.5)*1.2;x+=Math.cos(a)*c*.15;y+=Math.sin(a)*c*.15;g.lineTo(x,y)}g.stroke()}
      g.strokeStyle='rgba(255,255,255,.5)';g.lineWidth=w*.03;for(let k=0;k<3;k++){g.beginPath();g.moveTo(c*.5+k*c*.3,c*.4);g.lineTo(c*.3+k*c*.3,c*.75);g.stroke()}},
    sd:(g,w)=>{const c=w/2;g.clearRect(0,0,w,w);const gr=g.createRadialGradient(c,c,0,c,c,c);gr.addColorStop(0,'rgba(236,212,152,.97)');gr.addColorStop(.85,'rgba(224,196,132,.92)');gr.addColorStop(1,'rgba(224,196,132,0)');disc(g,c,gr);
      let s2=3;const r=()=>{s2=(s2*16807)%2147483647;return s2/2147483647};for(let k=0;k<420;k++){const a=r()*6.28,d=Math.sqrt(r())*c*.92;g.fillStyle=r()<.5?'rgba(150,112,58,.45)':'rgba(255,246,214,.6)';g.fillRect(c+Math.cos(a)*d,c+Math.sin(a)*d,w*.012,w*.012)}
      g.strokeStyle='rgba(170,130,70,.35)';g.lineWidth=w*.01;for(let k=0;k<4;k++){g.beginPath();g.arc(c,c*1.9,c*(.9+k*.18),Math.PI*1.25,Math.PI*1.75);g.stroke()}},
    qm:(g,w)=>{g.fillStyle='#c98f4a';g.fillRect(0,0,w,w);g.strokeStyle='#7a4a22';g.lineWidth=w*.06;g.strokeRect(w*.03,w*.03,w*.94,w*.94);g.lineWidth=w*.02;for(const y of [.36,.64]){g.beginPath();g.moveTo(w*.06,w*y);g.lineTo(w*.94,w*y);g.stroke()}
      g.font=`900 ${Math.round(w*.72)}px sans-serif`;g.textAlign='center';g.textBaseline='middle';g.lineJoin='round';g.strokeStyle='#3b2a1f';g.lineWidth=w*.07;g.strokeText('?',w/2,w*.54);g.fillStyle='#fff3d6';g.fillText('?',w/2,w*.54)},
    gu:(g,w)=>{const c=w/2;g.clearRect(0,0,w,w);const gr=g.createRadialGradient(c*.8,c*.75,0,c,c,c);gr.addColorStop(0,'rgba(255,214,110,.97)');gr.addColorStop(.75,'rgba(222,150,30,.93)');gr.addColorStop(.95,'rgba(190,110,10,.85)');gr.addColorStop(1,'rgba(190,110,10,0)');disc(g,c,gr);   // 끈끈이: 꿀 웅덩이
      let s2=11;const r=()=>{s2=(s2*16807)%2147483647;return s2/2147483647};for(let k=0;k<14;k++){const a=r()*6.28,d=Math.sqrt(r())*c*.75,rr=w*(.015+r()*.03);g.fillStyle='rgba(255,246,214,.75)';g.beginPath();g.arc(c+Math.cos(a)*d,c+Math.sin(a)*d,rr,0,7);g.fill()}
      g.fillStyle='rgba(255,255,255,.55)';g.beginPath();g.ellipse(c*.62,c*.55,c*.22,c*.08,-.6,0,7);g.fill()},
    tr:(g,w,h)=>{const n=8;for(let k=0;k<n;k++){g.fillStyle=k%2?'#2b2340':'#d63a6a';g.beginPath();const x0=k*w/n;g.moveTo(x0,0);g.lineTo(x0+w/n,0);g.lineTo(x0+w/n-h*.6,h);g.lineTo(x0-h*.6,h);g.fill()}   // 배신자의 길: 두 색 빗금 + ⇄
      g.font=`900 ${Math.round(h*.8)}px sans-serif`;g.textAlign='center';g.textBaseline='middle';g.lineWidth=h*.12;g.strokeStyle='#1a1428';g.fillStyle='#fff3d6';for(const x of [.25,.75]){g.strokeText('⇄',w*x,h*.55);g.fillText('⇄',w*x,h*.55)}},
    fnw:(g,w,h)=>{g.clearRect(0,0,w,h);g.fillStyle='rgba(200,235,255,.22)';g.fillRect(0,0,w,h);g.strokeStyle='rgba(255,255,255,.85)';g.lineCap='round';g.lineWidth=h*.06;   // 선풍기 바람 결
      let s2=5;const r=()=>{s2=(s2*16807)%2147483647;return s2/2147483647};for(let k=0;k<9;k++){const y=h*(.12+.76*r()),x=w*r(),l=w*(.12+.12*r());g.beginPath();g.moveTo(x,y);g.lineTo(x+l,y);g.stroke();if(x+l>w){g.beginPath();g.moveTo(x-w,y);g.lineTo(x+l-w,y);g.stroke()}}},
    gta:(g,w,h)=>{const n=6;for(let k=0;k<n;k++){g.fillStyle=k%2?'#ffffff':'#d8322a';g.fillRect(k*w/n,0,w/n,h)}},   // 차단기 막대 빨강·하양
    rtb:(g,w,h)=>{const n=10;g.fillStyle='#f2c230';g.fillRect(0,0,w,h);g.fillStyle='#24201c';for(let k=0;k<n;k+=2){g.beginPath();const x0=k*w/n;g.moveTo(x0,0);g.lineTo(x0+w/n,0);g.lineTo(x0+w/n-h,h);g.lineTo(x0-h,h);g.fill()}},   // 회전판 막대 노랑·검정
    rb:(g,w)=>{g.fillStyle='#e0473a';g.fillRect(0,0,w,w);g.fillStyle='#ffd23f';g.fillRect(w*.42,0,w*.16,w);g.fillRect(0,w*.42,w,w*.16);g.strokeStyle='#8a2a22';g.lineWidth=w*.04;g.strokeRect(w*.02,w*.02,w*.96,w*.96)},   // 랜덤박스: 선물 상자
    br:(g,w,h)=>{g.fillStyle='#e2cfae';g.fillRect(0,0,w,h);const bw=w/4,bh=h/2;for(let r=0;r<2;r++)for(let k=-1;k<5;k++){const x=k*bw+(r?bw/2:0);g.fillStyle=(k+r)%2?'#b3452c':'#a63c26';g.fillRect(x+3,r*bh+3,bw-6,bh-6)}}
  };
  const WH={br:[128,32],qm:[128,128],rb:[128,128],tr:[256,40],fnw:[256,64],gta:[128,16],rtb:[256,24]}[n]||[256,256];
  ITX[n]=canvasTex(WH[0],WH[1],D[n]);if(n==='fnw'){ITX[n].wrapS=THREE.RepeatWrapping;ITX[n].needsUpdate=true}return ITX[n];
}
const TOKR={bh:.27,wh:.15,br:.3,tb:.12,ic:.5,sd:.42,jp:.14,bm:.12,qm:.14,gl:.32,gu:.45,er:.14,rb:.13,tr:.4,fn:.14,gt:.4,rt:.42};
const RCOL=[0x9aa0a6,0x3f7fe0,0xf2b632],RCSS=['#8a9096','#2f6fd0','#d99a12'];   // 희귀도 색: 일반 회색·희귀 파랑·전설 금색   // 작은 물건 크기를 맞출 때 쓰는 반지름
const TOK_R=.19;
/* 물건 한 개(웜홀은 구멍 하나) 그림. 무리 g의 원점이 판 윗면. o.ghost면 반투명 */
function itUnit(k){
  const g=new THREE.Group(),ink=MAT.ink||(MAT.ink=new THREE.MeshBasicMaterial({color:GFX_INK,side:THREE.BackSide})),u=g.userData;u.k=k;
  const flat=(tex,r,y,ro)=>{const m=new THREE.Mesh(new THREE.CircleGeometry(1,48),new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false}));m.rotation.x=-Math.PI/2;m.scale.setScalar(r);m.position.y=y;m.renderOrder=ro;g.add(m);return m};
  const solid=(geo,mat,y,e)=>{const m=new THREE.Mesh(geo,mat),o=new THREE.Mesh(geo,ink);m.position.y=y;o.position.y=y;o.scale.setScalar(e||1.08);m.castShadow=true;g.add(m,o);return m};
  if(k==='bh'){u.spin=flat(itTex('bh'),IT.bh.rc*2.1,.005,2);
    const ring=new THREE.Mesh(new THREE.RingGeometry(.975,1,72),new THREE.MeshBasicMaterial({color:0x7a4cc0,transparent:true,opacity:.35,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.y=.0035;ring.renderOrder=1;g.add(ring);u.reach=ring}
  else if(k==='wh'){u.spin=flat(itTex('wh'),IT.wh.r,.005,2);const t=new THREE.Mesh(new THREE.TorusGeometry(IT.wh.r*.96,.02,8,40),new THREE.MeshBasicMaterial({color:0x8f7cff}));t.rotation.x=-Math.PI/2;t.position.y=.012;g.add(t)}
  else if(k==='ic'||k==='sd'){const r=IT[k].r;flat(itTex(k),r,k==='ic'?.0042:.0041,1);   // 바닥 물건: 가장자리에 옅은 먹선
    const e=new THREE.Mesh(new THREE.RingGeometry(r*.97,r*.97+.012,64),new THREE.MeshBasicMaterial({color:GFX_INK,transparent:true,opacity:.45,depthWrite:false}));e.rotation.x=-Math.PI/2;e.position.y=.0043;e.renderOrder=1;g.add(e)}
  else if(k==='br'){const L=IT.br.L,W=IT.br.W,Hh=IT.br.H,tx=itTex('br'),geo=new THREE.BoxGeometry(2*L,Hh,2*W),m=new THREE.Mesh(geo,toon({map:tx,rim:.1})),o=new THREE.Mesh(geo,ink);
    m.position.y=o.position.y=Hh/2;o.scale.set(1+.02/L,1+.03/Hh,1+.03/W);m.castShadow=true;g.add(m,o)}
  else if(k==='tb'){const r=IT.tb.r;u.body=solid(new THREE.SphereGeometry(r,24,16),toon({color:0xff5c8a,rim:.3}),r,1.07);
    const band=new THREE.Mesh(new THREE.TorusGeometry(r*1.005,r*.12,8,32),toon({color:0xfff1d6,rim:.1}));band.rotation.x=Math.PI/2;u.body.add(band)}
  else if(k==='jp'){const r=IT.jp.r;solid(new THREE.CylinderGeometry(r,r*1.05,.03,28),toon({color:0x3a3f46,rim:.1}),.015);
    const coil=toon({color:0xb9c0c8,rim:.2});for(let j=0;j<2;j++){const t=new THREE.Mesh(new THREE.TorusGeometry(r*.55,.012,6,24),coil);t.rotation.x=Math.PI/2;t.position.y=.04+j*.018;g.add(t)}
    u.body=solid(new THREE.CylinderGeometry(r*.92,r*.92,.02,28),toon({color:0xf2c230,rim:.2}),.075,1.1)}
  else if(k==='gl'){const L=IT.gl.L,W=IT.gl.W,Hh=IT.gl.H,geo=new THREE.BoxGeometry(2*L,Hh,2*W),m=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:0xbfeaff,transparent:true,opacity:.42,depthWrite:false}));m.position.y=Hh/2;m.renderOrder=4;g.add(m);   // 유리: 투명 판 + 흰 테두리
    const e=new THREE.LineSegments(new THREE.EdgesGeometry(geo),new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:.9}));e.position.y=Hh/2;g.add(e);
    const sh=new THREE.Mesh(new THREE.PlaneGeometry(L*1.2,Hh*.5),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.6,depthWrite:false,side:THREE.DoubleSide}));sh.position.set(-L*.3,Hh*.6,W+.001);sh.rotation.z=.5;g.add(sh)}
  else if(k==='gu'){const r=IT.gu.r;flat(itTex('gu'),r,.0043,1)}
  else if(k==='tr'){const L=IT.tr.L,W=IT.tr.W,m=new THREE.Mesh(new THREE.PlaneGeometry(2*L,2*W),new THREE.MeshBasicMaterial({map:itTex('tr'),transparent:true,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.y=.005;m.renderOrder=1;g.add(m);u.body=m}
  else if(k==='rb'){const geo=new THREE.BoxGeometry(.2,.17,.2),m=new THREE.Mesh(geo,toon({map:itTex('rb'),rim:.15})),o=new THREE.Mesh(geo,ink);m.position.y=o.position.y=.085;o.scale.setScalar(1.08);m.castShadow=true;g.add(m,o);u.body=m;
    const bw=toon({color:0xffd23f,rim:.2});for(const s of [-1,1]){const b=new THREE.Mesh(new THREE.TorusGeometry(.035,.012,6,14),bw);b.position.set(s*.03,.18,0);b.rotation.set(Math.PI/2,0,s*.6);g.add(b)}}
  else if(k==='er'){const a=new THREE.Mesh(new THREE.BoxGeometry(.24,.08,.12),toon({color:0xf28ab0,rim:.2})),b=new THREE.Mesh(new THREE.BoxGeometry(.12,.085,.125),toon({color:0x4f7fd8,rim:.2}));a.position.y=.04;b.position.set(.06,.04,0);a.castShadow=true;g.add(a,b);   // 지우개: 분홍 고무 + 파란 종이 띠
    const o=new THREE.Mesh(a.geometry,ink);o.position.y=.04;o.scale.setScalar(1.08);g.add(o)}
  else if(k==='fn'){const r=IT.fn.r;solid(new THREE.CylinderGeometry(r*.85,r,.035,24),toon({color:0x6b7480,rim:.15}),.0175);   // 선풍기: 받침 + 목 + 둥근 망 + 도는 날개, 앞쪽 바람 띠
    const nk=new THREE.Mesh(new THREE.CylinderGeometry(.014,.014,.09,8),toon({color:0x9aa3ad}));nk.position.y=.08;g.add(nk);
    const head=new THREE.Group();head.position.set(.01,.14,0);g.add(head);
    const cage=new THREE.Mesh(new THREE.TorusGeometry(.085,.008,6,28),toon({color:0xd9dee3,rim:.2}));cage.rotation.y=Math.PI/2;head.add(cage);
    const bl=new THREE.Group(),bm=toon({color:0x5fb3e8,rim:.2});for(let j=0;j<3;j++){const b=new THREE.Mesh(new THREE.BoxGeometry(.006,.07,.03),bm);b.position.y=.035;const p2=new THREE.Group();p2.rotation.x=j*2.094;p2.add(b);bl.add(p2)}
    const hub=new THREE.Mesh(new THREE.SphereGeometry(.018,10,8),toon({color:0x3b4048}));bl.add(hub);head.add(bl);u.blades=bl;
    const w=new THREE.Mesh(new THREE.PlaneGeometry(IT.fn.L,2*IT.fn.W),new THREE.MeshBasicMaterial({map:itTex('fnw'),transparent:true,depthWrite:false}));w.rotation.x=-Math.PI/2;w.position.set(r+IT.fn.L/2,.006,0);w.renderOrder=1;g.add(w);u.reach=w}
  else if(k==='gt'){const g2=IT.gt;solid(new THREE.CylinderGeometry(.024,.03,.17,12),toon({color:0xf4f1ea,rim:.2}),.085,1.15);   // 차단기: 기둥 + 경고등 + 오르내리는 막대
    u.lamp=new THREE.Mesh(new THREE.SphereGeometry(.027,12,10),new THREE.MeshBasicMaterial({color:0x5a1a14}));u.lamp.position.y=.185;g.add(u.lamp);
    const pv=new THREE.Group();pv.position.y=g2.hp;g.add(pv);u.arm=pv;
    const geo=new THREE.BoxGeometry(g2.L,2*g2.W,2*g2.W),m=new THREE.Mesh(geo,toon({map:itTex('gta'),rim:.15})),o=new THREE.Mesh(geo,ink);m.position.x=o.position.x=g2.L/2;o.scale.set(1.01,1.3,1.3);m.castShadow=true;pv.add(m,o)}
  else if(k==='rt'){const R=IT.rt;solid(new THREE.CylinderGeometry(.05,.06,.09,16),toon({color:0x3b4048,rim:.2}),.045);   // 회전판: 가운데 축 + 도는 막대, 도는 원 표시
    const br=new THREE.Group();br.position.y=.055;g.add(br);u.bar=br;
    const geo=new THREE.BoxGeometry(2*R.L,.05,2*R.W),m=new THREE.Mesh(geo,toon({map:itTex('rtb'),rim:.15})),o=new THREE.Mesh(geo,ink);o.scale.set(1.01,1.2,1.3);m.castShadow=true;br.add(m,o);
    const ring=new THREE.Mesh(new THREE.RingGeometry(R.L-.004,R.L+.004,72),new THREE.MeshBasicMaterial({color:0x3b2a1f,transparent:true,opacity:.28,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.y=.004;g.add(ring);u.reach=ring}
  else if(k==='qm'){const geo=new THREE.BoxGeometry(.2,.2,.2),m=new THREE.Mesh(geo,toon({map:itTex('qm'),rim:.12})),o=new THREE.Mesh(geo,ink);m.position.y=o.position.y=.1;o.scale.setScalar(1.08);m.castShadow=true;g.add(m,o)}
  else if(k==='bm'){const r=IT.bm.r;solid(new THREE.SphereGeometry(r,22,16),toon({color:0x2a2a30,rim:.35}),r,1.07);
    const f=new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,.07,8),toon({color:0x8a6a3a}));f.position.set(0,2*r+.025,0);f.rotation.z=.3;g.add(f);
    u.spark=new THREE.Mesh(new THREE.SphereGeometry(.024,10,8),new THREE.MeshBasicMaterial({color:0xffb030}));u.spark.position.set(-.012,2*r+.06,0);g.add(u.spark)}
  // 놓은 사람 색 (손 색): 둘레의 가는 고리, 벽돌은 윗면 띠. 블랙홀 고리는 구멍과 함께 커짐(u.ownK)
  {const om=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.9,depthWrite:false});let own;
   if(k==='br'||k==='gl'){own=new THREE.Mesh(new THREE.PlaneGeometry(2*IT[k].L*.86,Math.max(.03,IT[k].W*.7)),om);own.rotation.x=-Math.PI/2;own.position.y=IT[k].H+.003}
   else if(k==='tr'){own=new THREE.Mesh(new THREE.PlaneGeometry(2*IT.tr.L+.04,2*IT.tr.W+.04),om);own.rotation.x=-Math.PI/2;own.position.y=.0045;own.renderOrder=0}
   else{const r=k==='bh'?IT.bh.rc*2.1:k==='gt'?.05:TOKR[k];own=new THREE.Mesh(new THREE.RingGeometry(r+.012,r+.034,56),om);own.rotation.x=-Math.PI/2;own.position.y=.0045;own.renderOrder=2;u.ownK=k==='bh'}
   own.visible=false;g.add(own);u.own=own}
  return g;
}
/* 판 위 물건 (웜홀은 구멍 둘) */
function itBoard(o){
  const g=new THREE.Group();g.userData={k:o.k,units:[]};
  for(let e=0;e<(o.k==='wh'?2:1);e++){const u=itUnit(o.k);g.add(u);g.userData.units.push(u)}
  return g;
}
function itGhost(k){
  const g=itBoard({k});
  g.traverse(m=>{if(!m.isMesh)return;if(m.material.side===THREE.BackSide){m.visible=false;return}m.material=m.material.clone();m.material.transparent=true;m.material.opacity=Math.min(m.material.opacity,.7);m.material.depthWrite=false;m.castShadow=false});
  const bad=new THREE.Mesh(new THREE.CircleGeometry(1,40),new THREE.MeshBasicMaterial({color:0xd6281e,transparent:true,opacity:.42,depthWrite:false}));bad.rotation.x=-Math.PI/2;bad.position.y=.006;bad.renderOrder=3;
  g.userData.bad=[bad,bad.clone()];g.userData.units.forEach((u,e)=>u.add(g.userData.bad[e]));
  g.renderOrder=5;return g;
}
/* 판에서 뺀 물건 그림의 도형·재질을 버림 (같이 쓰는 그림 ITX·먹 재질 MAT.ink는 남김) */
function itDrop(g){if(!g)return;Ak3.root.remove(g);g.traverse(m=>{if(!m.isMesh)return;m.geometry.dispose();if(m.material!==MAT.ink)m.material.dispose()})}
/* 작은 물건(고르기·주인 쪽): 바람 띠·당기는 범위·도는 원은 숨기고 그림자 없이, 차단기는 막대 가운데가 가운데로 */
function tokUnit(k){const g=itUnit(k);if(g.userData.reach)g.userData.reach.visible=false;g.traverse(m=>{m.castShadow=false});if(k==='gt')g.children.forEach(c=>{if(c!==g.userData.own)c.position.x-=IT.gt.L/2});return g}
const ownCol=seat=>new THREE.Color(HCOL[Math.max(0,handCol(seat))%HCOL.length]);
/* 지금 보일 물건 상태: 튕긴 자취를 재생하는 동안은 그 일(삼킴·폭발)이 일어나기 전 모습 */
function itemsNow(now){
  if(!OS||!OS.it)return [];
  const S=Ak3.shot;if(!S||!S.sh.it0)return OS.it;
  const e=now-S.t0,ev=S.sh.ev||[];
  return OS.it.map((o,i)=>{const b=S.sh.it0[i];if(!b)return e<(S.sh.dur||0)+200?{...o,u:1}:o;   // 랜덤박스에서 나온 물건은 알이 다 멈춘 뒤에
    let r=b.r,u=b.u;
    for(const x of ev){if(x[3]!==i||x[0]>e)continue;if(x[1]==='h')r=Math.min(IT.bh.rmax,(r||IT.bh.rc)+IT.bh.grow);else if(x[1]==='x'||x[1]==='g'||x[1]==='r')u=1}
    return {...o,r,u}});
}
const FX=[];   // 효과 {k, ii 물건 번호, t0}
function itFx(k,ii,now){FX.push({k,ii,t0:now});if(FX.length>24)FX.shift()}
const FLY_MS=480;   // 놓은 물건이 판으로 날아가는 시간
function ak3Items(now){
  const R=Ak3.root,on=!!(OS&&OS.ob&&OS.of),key=on?OS.gid+'|'+OS.of.join(','):'';
  if(key!==Ak3.obKey){
    for(const t of Ak3.tok||[])itDrop(t.g);for(const k in Ak3.itB||{})itDrop(Ak3.itB[k].g);for(const k in Ak3.ghs||{})itDrop(Ak3.ghs[k].g);Ak3.ghs={};
    Ak3.obKey=key;Ak3.tok=[];Ak3.itB={};Ak3.obFresh=true;
    if(on)Ak3.tok=OS.of.map((k0,i)=>{const k=dispKind(i),g=tokUnit(k);g.visible=false;R.add(g);return {g,k,p:null,sc:0}});
  }
  if(!on){for(const k in Ak3.ghs||{})Ak3.ghs[k].g.visible=false;if(Ak3.tl)Ak3.tl.hidden=true;return}
  const dt=Math.min(.1,Math.max(0,(now-(Ak3.itT||now))/1000));Ak3.itT=now;
  const its=itemsNow(now),placed={},HT=hostNow(now);its.forEach((o,ii)=>{placed[o.o]=ii});
  {const wt=ITX.fnw;if(wt)wt.offset.x=-((now/520)%1)}   // 바람 결이 흐름
  // 판 위 물건: 새로 놓인 것은 작은 물건이 날아간 뒤에 나타남 (처음 볼 때 이미 있던 것은 바로)
  its.forEach((o,ii)=>{
    let b=Ak3.itB[o.o];
    if(!b){const g=itBoard(o);R.add(g);b=Ak3.itB[o.o]={g,t0:Ak3.obFresh?now-FLY_MS:now,snd:Ak3.obFresh};
      g.userData.units.forEach(u=>{u.userData.own.visible=true;u.userData.own.material.color.copy(ownCol(o.s))})}
    const g=b.g,u0=g.userData.units,vis=now-b.t0>=FLY_MS*.85&&!o.u;b.gone=0;
    if(vis&&!g.visible)b.v0=now;g.visible=vis;
    if(!b.snd&&g.visible){b.snd=1;if(o.o<100)sndTap(2.6);else tone(1046,.25,{type:'triangle',vol:.08,slide:1568})}   // 랜덤박스에서 나온 물건은 짠
    {const x=Math.min(1,(now-(b.v0||0))/260),pop=o.o>=100&&x<1?(x<.7?x/.7*1.2:1.2-.2*(x-.7)/.3):1;g.scale.setScalar(pop);g.position.set(0,TOP,0);if(pop!==1)g.position.set(o.x*(1-pop),TOP,o.z*(1-pop))}   // 나온 물건은 툭 커짐 (가운데 기준)
    u0.forEach((u,e)=>{const x=e?o.x2:o.x,z=e?o.z2:o.z;u.position.set(x,0,z);const d=u.userData;
      if(OB_ANG[o.k])u.rotation.y=-(o.a||0);
      if(o.k==='gt'){const th=gateTh(o,HT),g=IT.gt,ph=(((HT-(o.t0||0))%g.P)+g.P)%g.P,warn=(ph>=g.dn&&ph<g.dn+g.mv)||ph>=g.P-g.mv-900;d.arm.rotation.z=th;d.lamp.material.color.setHex(warn&&Math.floor(now/180)%2?0xff3020:0x5a1a14)}   // 움직이기 전·움직이는 동안 빨간 불이 깜빡
      if(o.k==='rt')d.bar.rotation.y=-rotAng(o,HT);
      if(o.k==='fn')d.blades.rotation.x=now/35;
      if(d.spin)d.spin.rotation.z=(o.k==='bh'?-1:1)*now/(o.k==='bh'?700:450);
      if(o.k==='bh'){const r=o.r||IT.bh.rc;d.spin.scale.setScalar(r*2.1);d.reach.scale.setScalar(bhR(o));d.own.scale.setScalar(r/IT.bh.rc)}
      if(d.spark){d.spark.scale.setScalar(.7+.5*Math.abs(Math.sin(now/70+ii)));}
      // 부딪힘 효과: 커졌다 돌아옴
      let pk=0;for(const f of FX)if(f.ii===ii&&now-f.t0<400)pk=Math.max(pk,1-(now-f.t0)/400);
      if(d.body)d.body.scale.set(1+.25*pk,1-.2*pk*(o.k==='tb'?1:0)+(o.k==='jp'?pk*.8:0),1+.25*pk);
      if(o.k==='jp'&&d.body)d.body.position.y=.075+pk*.05;
      if(o.k==='tr'&&d.body)d.body.material.opacity=1;
      if(o.k==='bh'&&d.spin){const s2=(o.r||IT.bh.rc)*2.1*(1+.35*pk);d.spin.scale.setScalar(s2)}
      if(o.k==='wh'&&d.spin)d.spin.scale.setScalar(IT.wh.r*(1+.5*pk));
    });
  });
  for(const k in Ak3.itB)if(placed[k]==null){const b=Ak3.itB[k];   // 지우개로 지운 물건: 줄어들며 사라짐
    if(b.g.visible&&!b.gone){b.gone=now;const u=b.g.userData.units[0];FX.push({k:'e',x:u.position.x,z:u.position.z,t0:now});sndErase()}
    const x=b.gone?(now-b.gone)/450:1;b.g.visible=x<1;if(x<1){const u=b.g.userData.units[0],sc=1-x;b.g.scale.setScalar(sc);b.g.position.set(u.position.x*(1-sc),TOP,u.position.z*(1-sc))}}
  // 작은 물건: 고르기 중이면 판 가운데 위, 고른 뒤에는 주인 쪽, 놓으면 판으로
  const bob=Math.sin(now/300)*.02,cur=i=>{const ow=OS.ofs[i];return OS.ph==='iput'&&ow>=0&&putting(ow)&&OS.inv[ow][0]===i};   // 지금 놓을 물건 (사람마다 하나씩 떠오름)
  Ak3.tok.forEach((t,i)=>{
    {const dk=dispKind(i);if(dk&&t.k!==dk){const g0=t.g,g=tokUnit(dk);g.visible=g0.visible;g.position.copy(g0.position);itDrop(g0);R.add(g);t.g=g;if(t.p)t.sc*=TOKR[t.k]/TOKR[dk];t.k=dk;if(OS.ofs[i]===myIdx())tone(1320,.12,{type:'triangle',vol:.06})}}   // '?'가 열림 (내 것이면 띵)
    let tgt=null,sc=TOK_R/TOKR[t.k],own=-1;
    const ow=OS.ofs[i],ii=placed[i];
    if(ii!=null){const o=its[ii],b=Ak3.itB[i];if(b&&now-b.t0<FLY_MS){tgt=[o.x,TOP,o.z];sc=1;own=o.s}}
    else if(ow>=0&&(OS.ph==='pick'||OS.ph==='iput')){const L=picksList(ow),[x,z]=trayAt(ow,L.indexOf(i),L.length);tgt=[x,FELT_Y+.01+(cur(i)?LIFT+bob:0),z];own=ow}
    else if(ow<0&&OS.ph==='pick'){const [x,z]=tokRow(i);tgt=[x,TOP+.3+bob*(i%2?1:-1),z]}
    const g=t.g;
    if(!tgt){if(t.p&&t.sc>.02){t.sc+=(0-t.sc)*Math.min(1,dt*10);g.scale.setScalar(t.sc)}else{g.visible=false;t.p=null}return}
    if(!t.p){t.p=tgt.slice();t.sc=sc}
    const k=Math.min(1,dt*(ii!=null?12:8));for(let j=0;j<3;j++)t.p[j]+=(tgt[j]-t.p[j])*k;t.sc+=(sc-t.sc)*k;
    if(ii!=null){const b=Ak3.itB[i],x=Math.min(1,(now-b.t0)/FLY_MS);t.p[1]=tgt[1]+Math.sin(Math.PI*x)*.5}
    g.visible=true;g.position.set(...t.p);g.scale.setScalar(t.sc);g.rotation.y=ow<0?now/1400+i:0;
    const d=g.userData,rr=ow<0&&ii==null;d.own.visible=own>=0||rr;   // 고르기 줄에서는 희귀도 색, 고른 뒤에는 주인 색
    if(own>=0){d.own.material.color.copy(ownCol(own));d.own.material.opacity=.9}else if(rr){const r=OB_RAR[OS.of[i]];d.own.material.color.setHex(RCOL[r]);d.own.material.opacity=r===2?.6+.4*Math.abs(Math.sin(now/240)):.9}
    if(d.spin)d.spin.rotation.z=now/600;if(t.k==='bh'&&d.spin)d.spin.scale.setScalar(IT.bh.rc*2.1);
  });
  Ak3.obFresh=false;
  // 미리 보기: 내 것과 다른 사람 것(사람마다 하나, 그 사람 손 색 고리)
  const GS=Ak3.ghs||(Ak3.ghs={}),gl=ghostsNow(),on2={};
  for(const gn of gl){let G2=GS[gn.seat];
    if(!G2||G2.k!==gn.k){if(G2)itDrop(G2.g);G2=GS[gn.seat]={k:gn.k,g:itGhost(gn.k)};R.add(G2.g)}
    on2[gn.seat]=1;G2.g.visible=true;const u=G2.g.userData.units;G2.g.position.set(0,TOP,0);
    u.forEach((x,e)=>{const has=e===0||gn.x2!=null;x.visible=has;if(!has)return;x.position.set(e?gn.x2:gn.x,.002,e?gn.z2:gn.z);if(OB_ANG[gn.k])x.rotation.y=-(gn.a||0);if(gn.k==='er')x.position.y=.12+Math.sin(now/160)*.02;
      const bad=G2.g.userData.bad[e];bad.visible=!!gn.mine&&(gn.k!=='wh'||e===(gn.x2!=null?1:0))&&gn.bad;bad.scale.setScalar(OB_BOX[gn.k]?IT[gn.k].L+.04:gn.k==='bh'?IT.bh.rc*2.1:TOKR[gn.k]+.03);
      const ow=x.userData.own;ow.visible=true;ow.material.color.copy(ownCol(gn.seat));
      if(x.userData.reach&&gn.k==='bh')x.userData.reach.scale.setScalar(bhR({r:IT.bh.rc}));if(x.userData.spin)x.userData.spin.rotation.z=now/600})}
  for(const k in GS)if(!on2[k])GS[k].g.visible=false;
  // 폭탄 불꽃·웜홀 빛
  if(!Ak3.boom){const m=new THREE.Mesh(new THREE.RingGeometry(.7,1,48),new THREE.MeshBasicMaterial({color:0xffa030,transparent:true,depthWrite:false,side:THREE.DoubleSide}));m.rotation.x=-Math.PI/2;m.renderOrder=7;
    const f=new THREE.Mesh(new THREE.SphereGeometry(1,20,14),new THREE.MeshBasicMaterial({color:0xfff0a0,transparent:true,depthWrite:false}));f.renderOrder=7;const g=new THREE.Group();g.add(m,f);g.visible=false;R.add(g);Ak3.boom={g,m,f}}
  {const B=Ak3.boom,fx=FX.filter(f=>f.k==='x'&&now-f.t0<650).pop();B.g.visible=!!fx&&!!its[fx&&fx.ii];
    if(B.g.visible){const o=its[fx.ii],x=(now-fx.t0)/650;B.g.position.set(o.x,TOP+.02,o.z);B.m.scale.setScalar(.15+IT.bm.R*ease(x));B.m.material.opacity=.9*(1-x);B.f.scale.setScalar(.25*(1-x)+.05);B.f.material.opacity=1-x}}
  ak3Parts(now,its);
  tokLabels();
}
/* 조각 효과: 유리 조각·랜덤박스 색종이·지우개 가루 (시간으로 계산, 끝나면 버림), 배신자의 길 번쩍임 */
const PARTS=[];let PART_GEO=null;
function ak3Parts(now,its){
  const R=Ak3.root;if(!PART_GEO)PART_GEO=new THREE.PlaneGeometry(.065,.04);
  for(const f of FX){if(f.pd)continue;f.pd=1;
    const o=f.ii!=null?its[f.ii]:null,x=f.x!=null?f.x:o&&o.x,z=f.z!=null?f.z:o&&o.z;if(x==null)continue;
    const cols=f.k==='g'?[0x7fd0f0,0xffffff,0x4fb6e0]:f.k==='r'?[0xe0473a,0xffd23f,0x4f7fd8,0x58c26a,0xf28ab0]:f.k==='e'?[0xf3e8dc,0xd8c8b8]:null;if(!cols)continue;
    const n=f.k==='e'?10:16;
    for(let j=0;j<n;j++){const m=new THREE.Mesh(PART_GEO,new THREE.MeshBasicMaterial({color:cols[j%cols.length],transparent:true,side:THREE.DoubleSide,depthWrite:false}));m.renderOrder=8;R.add(m);
      const a=Math.random()*6.28,v=f.k==='e'?.25+Math.random()*.3:.6+Math.random()*1.1;
      PARTS.push({m,t0:now,x,z,y:TOP+.07,vx:Math.cos(a)*v,vz:Math.sin(a)*v,vy:f.k==='e'?.3+Math.random()*.4:1+Math.random()*1.4,sp:(Math.random()-.5)*20,life:f.k==='e'?500:750})}}
  for(let i=PARTS.length-1;i>=0;i--){const P2=PARTS[i],t=(now-P2.t0)/1000;
    if(t*1000>P2.life){R.remove(P2.m);P2.m.material.dispose();PARTS.splice(i,1);continue}
    const y=Math.max(TOP+.004,P2.y+P2.vy*t-4.5*t*t);P2.m.position.set(P2.x+P2.vx*t,y,P2.z+P2.vz*t);P2.m.rotation.set(P2.sp*t,P2.sp*t*.7,0);P2.m.material.opacity=1-t*1000/P2.life}
  // 배신자의 길: 넘어간 순간 띠가 번쩍
  for(const f of FX){if(f.k!=='v'||now-f.t0>350)continue;const b=its[f.ii]&&Ak3.itB[its[f.ii].o];if(b){const d=b.g.userData.units[0].userData;if(d.body)d.body.material.opacity=.6+.4*Math.abs(Math.sin((now-f.t0)/40))}}
}
/* 지금 보일 미리 보기들: 내 것 + 다른 사람 것(그 사람 손 색). {seat,k,x,z,a,x2,z2,bad,mine} */
function ghostsNow(){
  if(!OS||OS.ph!=='iput'||!V||V.st!=='play')return [];
  const me=myIdx(),out=[];
  if(myPutNow()){const k=putKind(me);
    if(k==='wh'){if(IW1||IG){const a=IW1||IG,b=IW1?IG:null;out.push({seat:me,k,x:a.x,z:a.z,x2:b?b.x:null,z2:b?b.z:null,bad:!igOk(),mine:1})}}
    else if(IG)out.push({seat:me,k,x:IG.x,z:IG.z,a:IG.a||0,bad:k==='er'?true:!igOk(),mine:1})}   // 지우개는 지울 물건 아래 빨간 원
  for(const sk in OS.igs){const sd=+sk;if(sd===me||!putting(sd))continue;const g=OS.igs[sk],k=putKind(sd);if(!g||!k)continue;
    out.push({seat:sd,k,x:g.x,z:g.z,a:g.a||0,x2:g.x2??null,z2:g.z2??null,bad:false,mine:0})}
  return out;
}
/* 고르기 동안 떠 있는 물건 아래 이름 (화면 글자) */
function tokLabels(){
  let box=Ak3.tl;
  const on=!!(OS&&OS.ph==='pick'&&OS.of&&V.st==='play'&&!introWait()&&Ak3.vcam);
  if(!box){box=Ak3.tl=document.createElement('div');box.className='ak-tls';elAk.appendChild(box)}
  box.hidden=!on;if(!on)return;
  const r=T.r.domElement.getBoundingClientRect(),er=elAk.getBoundingClientRect(),v=Ak3.v3||(Ak3.v3=new THREE.Vector3()),key=[];
  const items=OS.of.map((k,i)=>{if(OS.ofs[i]>=0)return null;const [x,z]=tokRow(i);v.set(x,TOP+.3,z).project(Ak3.vcam);
    const px=Math.round(r.left-er.left+(v.x+1)/2*r.width),py=Math.round(r.top-er.top+(1-v.y)/2*r.height);key.push(i,px,py);return {i,k,px,py}});
  const ks=key.join(',');if(ks===box.dataset.k)return;box.dataset.k=ks;
  const sc=Math.abs(new THREE.Vector3(TOK_R,TOP+.3,0).project(Ak3.vcam).x-new THREE.Vector3(0,TOP+.3,0).project(Ak3.vcam).x)*r.width/2;
  box.innerHTML=items.filter(Boolean).map(o=>`<span class="r${OB_RAR[o.k]}" style="left:${o.px}px;top:${Math.round(o.py+sc+4)}px">${OB_NM[o.k]}</span>`).join('');
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
  const B=tvBox(elAk,'ak'),[sx,sz]=mySide(),np=npOf(),om=OS&&OS.om?1:0,jo=OS&&OS.jg&&OS.ob?.6:.03,key=[W,Hh,B.R,sx,sz,np,om,OS&&OS.jg?1:0,jo].join(',');
  if(key===Ak3.lay)return false;
  Ak3.lay=key;
  const fw=B.fw,fh=B.fh,fy=B.cy-fh/2;
  let s=Math.min(fw/(2*(BW+.08)),fh/(2*(BW+.45)));
  if(np>2){const full=Math.min(fw/(2*(BW+.45)),fh/(2*(BW+.45))),peek=Math.min(fw/(2*(BW+.3)),fh/(2*(BW+.45)));s=full<peek*.93?peek:full}   // 3~4명: 양옆 놓기 전 알 줄. 좁은 화면은 알 반쯤만 보이게 해서 판을 크게
  if(OS&&OS.jg)s=Math.min(fw/(2*(JBX+.03)),fh/(2*(JBZ+jo)));   // 장기 모드: 장기판 끝까지 (둘레는 아주 조금, 물건 놓기면 판 바깥 물건 자리까지)
  if(om){const ext=2*(BW+BGAP+2*BR),sV=Math.min(fw/(2*(BW+.08)),fh/ext),sH=Math.min(fw/ext,fh/(2*(BW+.1)));Ak3.bl=sH>sV?'h':'v';s=Math.max(sV,sH)*.97}   // 오목 모드: 바둑통까지 (넓은 화면은 판 옆, 좁은 화면은 판 위아래)
  const cam=Ak3.cam,f=Math.tan(cam.fov*Math.PI/360),d=(Hh/2)/(s*f);
  cam.aspect=W/Hh;cam.position.set(0,TOP+d,0);cam.up.set(-sx,0,-sz);cam.lookAt(0,TOP,0);
  cam.setViewOffset(W,Hh,0,-((fy+fh/2)-Hh/2),W,Hh);cam.updateProjectionMatrix();cam.updateMatrixWorld();
  {const hv=(OS&&OS.jg?JBZ+jo:om?(Ak3.bl==='v'?2*(BW+BGAP+2*BR)/2:BW+.1):BW+.45)*s,cy=fy+fh/2;chipsAt(cy-hv,cy+hv)}
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
      const jump=Math.hypot(tr[1+b*K]-tr[1+a*K],tr[3+b*K]-tr[3+a*K])>600,ww=jump?(w<.5?0:1):w;   // 웜홀로 건너뛴 장은 이어 그리지 않음
      const g=j=>tr[1+a*K+j]/1000*(1-ww)+tr[1+b*K+j]/1000*ww;
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
    if(u.yaw)u.yaw.rotation.y=ownAng(stOwn(i))+(q.w||0);   // 장기 알: 주인 쪽에서 바로 읽히는 방향 + 돈 각도
    if(bl){const gy=groundAt(q.x,q.z),h=Math.max(0,q.y-(gy+gm.h));bl.visible=m.visible&&gy>-50;
      if(bl.visible){bl.position.set(q.x+h*.5,gy+.004,q.z+h*.35);bl.scale.setScalar((1+h*.8)*gm.rv/SR);bl.material.opacity=.3/(1+h*5)}}   // 뜬 만큼 그림자가 옆으로 벌어지고 흐려짐
  });
  // 고리: 내 차례면 튕길 수 있는 내 알, 상대가 당기는 중이면 그 알 (내가 당기는 중에는 손이 보여 줌)
  const me=myIdx(),a=aimNow(now),pulse=.75+.25*Math.sin(now/260);
  Ak3.ringM.opacity=.9*pulse;
  if(Ak3.relDot){const on=!!(drag&&drag.rel);Ak3.relDot.visible=on;if(on)Ak3.relDot.position.set(drag.x0,TOP+.006,drag.z0)}
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
  ak3Items(now);
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
  while(S.ei<ev.length&&ev[S.ei][0]<=e){const [,k,v,ii]=ev[S.ei++];if(ii!=null)itFx(k,ii,now);if(e-ev[S.ei-1][0]>300)continue;
    if(k==='c')sndClack(v);else if(k==='b')sndTap(v);else if(k==='f')sndDrop(v);else if(k==='h')sndSuck();else if(k==='p')sndWarp();else if(k==='u')sndBoing(v);else if(k==='j')sndSpring();else if(k==='x')sndBoom();else if(k==='g')sndGlass(v);else if(k==='r')sndBox();else if(k==='v')sndFlip();else sndWall(v)}   // q 회전판·k 벽돌·차단기·선풍기는 나무 소리
  if(e>=S.sh.dur+60){Ak3.shot=null;Ak3.dirty=true;drawAll()}
}
function ak3Render(t){
  if(!Ak3.on||!T.ok)return;
  if(ak3Layout(t))Ak3.dirty=true;
  ak3Stones();
  shotSounds(t);
  const intro=IN.on3d&&introStep(t);
  const busy=!!(Ak3.shot||intro||drag||FLK||(OS&&OS.aim&&OS.ph==='aim')||myTurnNow()||myPlaceNow()||(OS&&OS.hd>=0)||gateTimes(Ak3.bar,t).busy||(OS&&OS.ph==='place')||(Ak3.pl&&Ak3.pl.some(Boolean))||!!(OS&&OS.ob&&V.st==='play'));   // 물건이 있으면 늘 그림 (블랙홀이 돎)   // 움직이는 것이 없으면 가끔만 그림
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
  Ak3.shot=null;Ak3.lastSid=OS.sid;Ak3.lastGid=OS.gid;drag=null;SEL=-1;
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
  if(OS.gid!==Ak3.lastGid){Ak3.lastGid=OS.gid;Ak3.lastSid=OS.sid;Ak3.shot=null;drag=null;SEL=-1}
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
  if(OS.ht){const off=clock()-OS.ht;if(HO.off==null||off<HO.off||off-HO.off>1500)HO.off=off}
  if(OS.gi&&OS.gi!==CD.gi){CD.gi=OS.gi;CD.at=clock()+OS.cd;CD.shown=-1}   // 카운트다운: 받은 순간부터 이 기기 시계로 셈
  if(!myPutNow()){IG=null;IW1=null;ROT=null}
  if(PEND&&OS.ofs&&OS.ofs[PEND.k]!=null&&OS.ofs[PEND.k]>=0){if(OS.ofs[PEND.k]!==myIdx())sndNo();PEND=null}   // 먼저 가져간 사람이 있으면 금지 소리
  if(PEND&&(OS.ph!=='pick'||clock()-PEND.t>3000))PEND=null;
  if(pv&&pv.ofs&&OS.ofs&&pv.gid===OS.gid&&OS.ofs.some((x,i)=>x>=0&&pv.ofs[i]<0&&x!==myIdx()))sndBowl();   // 다른 사람이 집음
  if(pv&&pv.ph!=='pick'&&OS.ph==='pick'&&V.st==='play'){say('물건 고르기');sfx('turn')}
  if(!myPlaceNow())GH=null;
  else if(GH&&!canPlace(OS,myIdx(),GH.c,GH.r))setGH(null);
  G.buttons();
  if(pv&&(pv.ph==='place'||pv.ph==='iput'||pv.ph==='pick')&&OS.ph==='aim'&&V.st==='play'&&!OS.om){say('알까기를 시작합니다.');sfx('turn')}
  // 한 번 더: 굴러가기가 끝나고 같은 사람 차례가 다시 오면
  if(pv&&pv.ph==='roll'&&OS.ph==='aim'&&V.st==='play'&&OS.sh&&V.t===OS.sh.by&&!OS.om)say(V.t===myIdx()?'한 번 더':`${nm(V.t)} 한 번 더`);
  Ak3.dirty=true;
};
/* 매 프레임: 카운트다운 숫자·소리, 놓기가 거절됐는지 (다른 사람이 먼저 그 자리에 놓음) */
function obLive(){
  const c=cdLeft(),on=!!(OS.ob&&(OS.ph==='pick'||OS.ph==='iput')&&V.st==='play'&&!introWait()&&c>0),n=on?Math.ceil(c/1000):0;
  let el=elAk&&elAk.querySelector('.ak-cd');if(!el&&elAk){el=document.createElement('div');el.className='ak-cd';elAk.appendChild(el)}
  if(el){const show=on&&Ak3.on;if(el.hidden!==!show)el.hidden=!show;const tx=show?String(n):'';if(el.textContent!==tx)el.textContent=tx;
    if(show){const x=Math.min(1,(1000-(c-(n-1)*1000))/450),e=1-(1-x)*(1-x);el.style.transform=`translate(-50%,-50%) scale(${(1.5-.5*e).toFixed(3)})`;el.style.opacity=Math.min(1,x*2.5).toFixed(2)}}   // 숫자마다 크게 나타났다 줄어듦 (시각으로 계산)
  if(OS.ob&&(OS.ph==='pick'||OS.ph==='iput')&&V.st==='play'&&!introWait()&&CD.gi===OS.gi){const k=c>0?n:0;if(k!==CD.shown){if(CD.shown>=0||k>0){if(k>0)tone(880,.12,{type:'triangle',vol:.07});else tone(1320,.22,{type:'triangle',vol:.09})}CD.shown=k;obRedraw()}}   // 삑 삑 삑 띵
  if(PUTW&&clock()-PUTW.t>700){const me=myIdx();if(OS.ph==='iput'&&OS.inv&&OS.inv[me]&&OS.inv[me][0]===PUTW.oi){sndNo();if(myPutNow()&&!IG){IG=PUTW.g;IW1=PUTW.w;obRedraw()}}PUTW=null}   // 거절됨: 미리 보기를 되살려 빨갛게
}
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
  const play=$('#btnPlay'),me=myIdx(),put=!!(OS&&OS.ph==='iput'&&putting(me)),show=!!(V&&V.ak&&V.st==='play'&&OS&&me>=0&&me<npOf()&&(OS.om||OS.ph==='place'||put)),can=show&&(put?!!IG&&myPutNow()&&igOk():!!GH&&myPlaceNow());
  play.hidden=!show;play.disabled=!can;play.classList.toggle('ready',can);
  if(show){if($('#playMain').textContent!=='놓기')$('#playMain').textContent='놓기';const sub=keyLabel(KEYS.play);if($('#playSub').textContent!==sub)$('#playSub').textContent=sub}
};
/* 매 프레임: 내 차례 남은 시간 (이름 칸), 2D 화면의 굴러가기 */
G.live=()=>{
  if(IN.on)introTick();
  if(!V||!V.ak||!OS)return;
  obLive();
  const t=clock(),run=V.st==='play'&&(OS.ph==='aim'||OS.ph==='place'||OS.ph==='pick'||OS.ph==='iput')&&!introWait()&&Number.isInteger(V.t);
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
    else if(OS.ob&&(OS.ph==='pick'||OS.ph==='iput'||(OS.it||[]).some(o=>o.k==='gt'||o.k==='rt'))&&t-(Ak3.d2At||0)>250){Ak3.d2At=t;draw2D()}   // 차단기·회전판이 있으면 늘 다시 그림
  }
};
G.play=()=>{if(OS&&OS.ph==='iput')confirmIG();else confirmGH()};
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
  drag=null;SEL=-1;
};
G.leave=()=>{
  introEnd();drag=null;SEL=-1;
  $('#stage').classList.remove('ak','ak-over','ak3d','ak2d','ak-intro');
  if(T.stacks)for(const arr of T.stacks.values())arr.forEach(c=>{c.visible=true});
  if(Ak3.root)Ak3.root.visible=false;Ak3.on=false;Ak3.shot=null;if(Ak3.tl)Ak3.tl.hidden=true;IG=null;IW1=null;ROT=null;PEND=null;PUTW=null;{const el=elAk&&elAk.querySelector('.ak-cd');if(el)el.hidden=true}
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
#ak .ak-tls{position:absolute;inset:0;pointer-events:none;z-index:1}
#ak .ak-tls[hidden]{display:none}
#ak .ak-tls span{position:absolute;transform:translateX(-50%);font-size:min(12px,2.7vw);font-weight:700;color:#3b2a1f;background:rgba(255,250,240,.88);border-radius:99px;padding:1px min(7px,1.3vw);white-space:nowrap;border:1.5px solid transparent}
#ak .ak-tls span.r0{color:#5f656b;border-color:#9aa0a6}
#ak .ak-tls span.r1{color:#2a5fb8;border-color:#3f7fe0}
#ak .ak-tls span.r2{color:#9a6a00;border-color:#f2b632;box-shadow:0 0 8px rgba(242,182,50,.8)}
#ak .ak-cd{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:min(28vw,170px);font-weight:900;line-height:1;color:#fffaf0;-webkit-text-stroke:5px #3b2a1f;paint-order:stroke;text-shadow:0 6px 0 rgba(59,42,31,.35);pointer-events:none;z-index:3}
#ak .ak-cd[hidden]{display:none}

@media (max-width:699px){#ak{padding-bottom:112px}#ak .ak-mebar{bottom:70px;max-width:calc(100% - 24px)}}
`;
  document.head.appendChild(css);
  elAk=document.createElement('div');elAk.id='ak';elAk.hidden=true;
  elAk.innerHTML=`<div class="ak-bar"></div><div class="ak-mebar"></div><div class="ak-row"><div class="ak-hint" aria-live="polite"></div></div><div class="ak-bd"><svg viewBox="${-VX} ${-VY} ${2*VX} ${2*VY}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="알까기 판"><defs><pattern id="akHatch" width=".23" height=".23" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width=".075" height=".23" fill="#d6281e"/><animateTransform attributeName="patternTransform" type="translate" from="0 0" to=".23 0" dur="2.6s" repeatCount="indefinite" additive="sum"/></pattern><pattern id="akBar" width=".15" height=".15" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width=".15" height=".15" fill="#f2c230"/><rect width=".075" height=".15" fill="#1d1b19"/></pattern><radialGradient id="akBh"><stop offset=".45" stop-color="#ffc85f"/><stop offset=".7" stop-color="#d65cc8" stop-opacity=".85"/><stop offset="1" stop-color="#46208c" stop-opacity="0"/></radialGradient><radialGradient id="akWh"><stop offset="0" stop-color="#0b0820"/><stop offset=".5" stop-color="#3b2a9a"/><stop offset="1" stop-color="#5fd0f4"/></radialGradient></defs><g id="akB"></g><g id="akS"></g></svg></div>`;
  $('#stage').insertBefore(elAk,$('#fx'));
  elSvg=elAk.querySelector('svg');elMain=elSvg;elBar=elAk.querySelector('.ak-bar');elBarMe=elAk.querySelector('.ak-mebar');elHint=elAk.querySelector('.ak-hint');
  // 당기기: 3D(캔버스)와 2D(SVG) 모두 누르기 → 끌기 → 놓기. 누른 채 화면 밖으로 끌어도 이어짐
  const bind=(el,toW,ok)=>{
    let pid=null;
    el.addEventListener('pointerdown',e=>{
      if(!ok()||G!==GAMES.alkkagi||(e.button!=null&&e.button>0))return;
      const w=toW(e);if(!w)return;
      if(dragStart(w[0],w[1])&&(drag||ROT)){pid=e.pointerId;try{el.setPointerCapture(pid)}catch(_){}e.preventDefault()}
    });
    el.addEventListener('pointermove',e=>{if((drag||ROT)&&e.pointerId===pid){const w=toW(e);if(w)dragMove(w[0],w[1])}});
    const up=cancel=>e=>{if(e.pointerId!==pid)return;pid=null;try{el.releasePointerCapture(e.pointerId)}catch(_){}dragEnd(cancel)};
    el.addEventListener('pointerup',up(false));el.addEventListener('pointercancel',up(true));
  };
  bind($('#cv'),e=>Ak3.on&&ak3World(e),()=>Ak3.on&&!!OS);
  bind(elSvg,e=>s2w(e),()=>!Ak3.on&&!!OS);
  document.addEventListener('keydown',e=>{if(e.code!=='Escape'||!elAk||elAk.hidden)return;if(drag)dragEnd(true);else if(selOk()){setSel(-1);sndPickUp()}else if(GH){setGH(null);sndPickUp()}else if(IG||IW1){if(IG)IG=null;else IW1=null;sndPickUp();sendIg();obRedraw()}});
  window.addEventListener('resize',()=>{Ak3.lay='';fit2D()});
};
G._ak3={Ak3,IN,introEnd,handCanvas,tokRow,trayAt,get IG(){return IG},get parts(){return PARTS.length},confirmIG,itemTap,get FLK(){return FLK},get OS(){return OS},get drag(){return drag},dragStart,dragMove,dragEnd,curPos};   // 화면 검사용

(window.GAMES=window.GAMES||{}).alkkagi=G;
})();
