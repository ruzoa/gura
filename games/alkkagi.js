/* ===== 알까기 게임 모듈 =====
   공통 코드(index.html)가 GAMES.alkkagi의 함수를 불러서 이 게임의 규칙·봇·화면을 그림.
   두 사람이 바둑판 위의 내 알을 번갈아 튕겨 상대 알을 판 밖으로 떨어뜨림. 내 알이 모두 떨어지면 짐.
   월드 좌표는 공통 테이블 그대로(탁자 윗면 0): 판은 한가운데, 판 윗면 높이 TOP. 0번 자리의 알은 +z 쪽(0번 화면 아래), 1번은 -z 쪽
   물리는 방장만 계산(simulate)하고, 움직인 알의 자취(초당 30장)와 소리 날 일(부딪힘·떨어짐)을 모두에게 보냄. 화면은 그 자취를 재생만 함
   알은 납작한 바둑알(타원체)이라, 기울어진 채 부딪히면 위로 뜸: 세게 미끄러지는 알은 앞이 숙어 상대를 띄우고, 손가락으로 튕길 때 기우뚱함
   손패(hand)는 카드가 아니라 '알이 있음' 표시: 공통 코드가 hand가 비면 끝난 사람으로 보기 때문에 게임 중에는 [0]으로 둠 */
(function(){
const G={id:'alkkagi',name:'알까기',short:'알까기',lead:'바둑알을 튕겨 상대 알을 판 밖으로',brand:'알까기',brandPx:56,maxHi:2,noFast:true,firstPick:true};   // firstPick: 대기실 이름표 메뉴의 [선]을 씀 (룰렛 연출은 없음)

/* ---------- 판·알·물리 (방장 엔진과 화면이 같은 값을 씀) ---------- */
const NL=19,BW=2.3,GM=.3,TOP=.2,PITCH=(2*BW-2*GM)/(NL-1),SR=PITCH*.46,SH=SR*.52,KY=SR/SH;   // 줄 수, 판 반폭(틀 포함), 틀 안쪽 여백, 판 윗면 높이, 줄 간격, 알 반지름·반두께(오목 돌과 같은 비율: 줄 간격에 맞춤)
const HOSHI=[3,9,15];   // 화점 (19줄)
const FELT_Y=.016,FELT_R=3.15,TABLE_R=4.9;   // 공통 테이블: 펠트 윗면 높이·반지름, 탁자 반지름
const PHY={g:32,aB:6.5,aF:11,eSS:.86,eG:.3,vmax:11,dt:1/240,fps:30,tmax:9,slope:.28,kT:700,cT:8,tk:7};   // 중력, 판·펠트 마찰 감속, 알끼리·바닥 튕김, 최고 속도, 계산 간격, 자취 장 수, 최대 길이(초), 미끄러질 때 앞이 숙는 정도, 기울기 복원·감쇠, 부딪힐 때 기우뚱
const PMIN=.1;   // 이보다 약하게 당기고 놓으면 취소
/* 손 떨림: 당기기 시작부터 불규칙하게 떨리고, 세게 당길수록 크게. 놓는 순간 손이 가리키던 방향으로 나감 (살살 치면 거의 직선, 끝까지 당기면 최대 SPREAD) */
const SPREAD=2*Math.PI/180;   // 끝까지 당겼을 때 떨림 폭 (라디안, 2도: 손은 팔꿈치를 축으로 흔들려 손끝이 그만큼 더 크게 움직여 보임)
const spreadOf=p=>SPREAD*p*p;
function jit(t){   // -1~1, 잔잔하다 가끔 크게 (규칙적인 흔들림이 아니라 타이밍을 노리기 어렵게)
  const a=.5*Math.sin(t*.0067+1.3)+.3*Math.sin(t*.0151+.4)+.2*Math.sin(t*.0389+2.1);
  const b=Math.pow(Math.sin(t*.0021),8)*Math.sin(t*.047);
  return Math.max(-1,Math.min(1,a*.8+b*.6));
}
const speedOf=p=>PHY.vmax*Math.pow(Math.max(0,Math.min(1,p)),1.25);   // 당긴 정도 → 속도 (끝으로 갈수록 조금 더 세짐)
const onBoardXZ=(x,z)=>Math.abs(x)<=BW&&Math.abs(z)<=BW;
function groundAt(x,z){
  if(onBoardXZ(x,z))return TOP;
  const r=Math.hypot(x,z);
  if(r<FELT_R)return FELT_Y;
  if(r<TABLE_R)return 0;
  return -99;   // 탁자 밖: 바닥으로 떨어져 사라짐
}
const wrapA=a=>{a%=Math.PI;if(a>Math.PI/2)a-=Math.PI;else if(a<-Math.PI/2)a+=Math.PI;return a};
const tiltOf=q=>{let t=Math.hypot(q.ax,q.az)%Math.PI;if(t>Math.PI/2)t=Math.PI-t;return t};
const halfH=q=>{const t=tiltOf(q);return SH*Math.cos(t)+SR*Math.sin(t)};   // 기울어진 알의 반높이 (가장자리로 서면 높아짐)
/* 한 번 튕기기: st(알 목록 {x,y,z,s,o,g})에서 shot.i번 알을 (vx,vz)로. 기울기 (ax,az): +x·+z 쪽 가장자리가 올라간 각도
   돌려줌: fin 끝난 자리, tr 움직인 알의 자취 {번호: [시작 장, x,y,z,ax,az(1000배 정수)…]}, nf 장 수, ev 소리 [[ms, 종류, 세기]], of 떨어진 시각 {번호: ms}, dur 길이(ms) */
function simulate(st,shot,rnd){
  rnd=rnd||Math.random;
  const P=PHY,dt=P.dt,S=st.map(s=>({x:s.x,y:s.y,z:s.z,o:s.o?1:0,g:s.g?1:0,s:s.s,vx:0,vy:0,vz:0,ax:0,az:0,bx:0,bz:0,aw:0,still:0}));
  const ev=[],frames=[],every=Math.round(1/(P.fps*dt)),of={};   // of: 판에서 떨어진 시각(ms) {번호: ms} (화면이 남은 알 수를 그 순간에 줄임)
  const rec=()=>frames.push(S.map(q=>[q.x,q.y,q.z,q.ax,q.az]));
  const push=(k,v,step)=>{if(ev.length<60)ev.push([Math.round(step*dt*1000),k,Math.round(v*100)/100])};
  const q0=S[shot.i];q0.vx=shot.vx;q0.vz=shot.vz;q0.aw=1;
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
        if(sp<=dec){q.vx=q.vz=0}else{q.vx-=q.vx/sp*dec;q.vz-=q.vz/sp*dec}
        // 미끄러지는 알은 앞이 살짝 숙음(빠를수록). 바닥에 닿은 동안은 납작하게 돌아오려 함
        const f=Math.min(1,sp/P.vmax),tx=sp>1e-6?-P.slope*f*q.vx/sp:0,tz=sp>1e-6?-P.slope*f*q.vz/sp:0;
        q.ax=wrapA(q.ax);q.az=wrapA(q.az);   // 반 바퀴 넘게 돈 각도는 접음 (바둑알은 뒤집어도 같음)
        q.bx+=(-P.kT*(q.ax-tx)-P.cT*q.bx)*dt;q.bz+=(-P.kT*(q.az-tz)-P.cT*q.bz)*dt;
        q.vy=0;q.y=gy+he;
      }else{q.vy-=P.g*dt;const br=Math.hypot(q.bx,q.bz);if(br>30){q.bx*=30/br;q.bz*=30/br}}
      q.ax+=q.bx*dt;q.az+=q.bz*dt;
      q.x+=q.vx*dt;q.y+=q.vy*dt;q.z+=q.vz*dt;
      const gy2=groundAt(q.x,q.z),he2=halfH(q);
      if(q.y-he2<gy2){
        const vin=-q.vy;q.y=gy2+he2;
        if(q.vy<0){q.vy=vin>1.2?vin*P.eG:0;if(vin>.6)push(gy2>=TOP-1e-6?'b':'f',vin,step)}
      }
      // 판 옆면: 판 윗면보다 낮은 알은 판 안으로 못 들어감 (떨어지는 알이 판 모서리에서 밀려남)
      if(q.y-he2<TOP-.003){
        const ox=BW+SR-Math.abs(q.x),oz=BW+SR-Math.abs(q.z);
        if(ox>0&&oz>0&&!(onBoardXZ(q.x,q.z)&&q.y>TOP)){
          if(ox<oz){const sg=Math.sign(q.x)||1;q.x=sg*(BW+SR);if(q.vx*sg<0){if(-q.vx*sg>.8)push('w',-q.vx*sg,step);q.vx=-q.vx*.3}}
          else{const sg=Math.sign(q.z)||1;q.z=sg*(BW+SR);if(q.vz*sg<0){if(-q.vz*sg>.8)push('w',-q.vz*sg,step);q.vz=-q.vz*.3}}
        }
      }
      // 판에서 떨어지면 탈락(다시 올라와도 그대로). 판 밖으로 기울며 넘어감
      if(!q.o&&q.y<TOP-.01&&!onBoardXZ(q.x,q.z)){q.o=1;of[S.indexOf(q)]=Math.round(step*dt*1000);if(Math.abs(q.x)>BW)q.bx-=Math.sign(q.x)*6;if(Math.abs(q.z)>BW)q.bz-=Math.sign(q.z)*6}
      if(q.y<-1.5){if(!q.o)of[S.indexOf(q)]=Math.round(step*dt*1000);q.g=1;q.o=1;q.aw=0;q.vx=q.vy=q.vz=0}   // 탁자 밖으로 떨어짐 (사라짐)
    }
    // 알끼리: 납작한 알(타원체) 두 개는 세로를 KY배로 늘리면 공 두 개가 됨
    for(let it=0;it<2;it++)for(let i=0;i<S.length;i++){const a=S[i];if(a.g)continue;
      for(let j=i+1;j<S.length;j++){const b=S[j];if(b.g||(!a.aw&&!b.aw))continue;
        const dx=b.x-a.x,dz=b.z-a.z,dh=Math.hypot(dx,dz);if(dh>2*SR+.02||Math.abs(b.y-a.y)>2*SR+.1)continue;
        const ux=dh>1e-9?dx/dh:1,uz=dh>1e-9?dz/dh:0;
        const la=SR*Math.sin(a.ax*ux+a.az*uz),lb=SR*Math.sin(-(b.ax*ux+b.az*uz));   // 서로를 향한 가장자리 높이
        const e=(b.y+lb)-(a.y+la),ey=e*KY,d=Math.hypot(dh,ey);
        if(d>=2*SR)continue;
        const nx=dh>1e-9?dx/d:1,ny=ey/d,nz=dh>1e-9?dz/d:0;
        let rx=nx,ry=KY*ny,rz=nz;const rl=Math.hypot(rx,ry,rz);rx/=rl;ry/=rl;rz/=rl;
        // 기울어진 알의 면은 법선도 같이 기욺: 앞이 숙은 알(a)이 치면 상대를 위로, 상대(b)의 가장자리가 숙어 있으면 아래로
        {const ph=-((a.ax+b.ax)*ux+(a.az+b.az)*uz),hz=Math.hypot(rx,rz),be=Math.atan2(ry,hz)+Math.max(-1.2,Math.min(1.2,ph)),cb=Math.cos(be);rx=ux*cb;rz=uz*cb;ry=Math.sin(be)}
        const pen=(2*SR-d)/2;
        a.x-=nx*pen;a.z-=nz*pen;a.y-=ny*pen/KY;b.x+=nx*pen;b.z+=nz*pen;b.y+=ny*pen/KY;
        const vn=(a.vx-b.vx)*rx+(a.vy-b.vy)*ry+(a.vz-b.vz)*rz;
        if(vn>0){
          const E=vn>.4?P.eSS:0,J=(1+E)*vn/2;
          a.vx-=J*rx;a.vy-=J*ry;a.vz-=J*rz;b.vx+=J*rx;b.vy+=J*ry;b.vz+=J*rz;
          a.bx+=ux*P.tk*(-J*ry);a.bz+=uz*P.tk*(-J*ry);b.bx-=ux*P.tk*(J*ry);b.bz-=uz*P.tk*(J*ry);   // 가장자리를 위·아래로 치면 기우뚱
          if(vn>.5)push('c',vn,step);
          a.aw=b.aw=1;a.still=b.still=0;
        }
      }}
    // 멈춤: 거의 안 움직이면 납작하게 내려놓고 쉼 (다른 알 위에 얹힌 채 멈춘 것도)
    for(const q of S){
      if(q.g||!q.aw)continue;
      const sp=Math.hypot(q.vx,q.vy,q.vz),rot=Math.hypot(q.bx,q.bz);
      if(sp<.03&&rot<.6&&tiltOf(q)<.03)q.still++;else q.still=0;
      if(q.still>12){q.aw=0;q.vx=q.vy=q.vz=0;q.bx=q.bz=0;q.ax=q.az=0;const gy=groundAt(q.x,q.z);if(Math.abs(q.y-(gy+SH))<.01)q.y=gy+SH}
    }
    // 얹혀 쉬던 알은 받치던 알이 없어지면 다시 떨어짐
    for(const q of S){
      if(q.g||q.aw)continue;
      const gy=groundAt(q.x,q.z);if(q.y-SH<=gy+.002)continue;
      let sup=false;for(const b of S){if(b===q||b.g)continue;const dh=Math.hypot(b.x-q.x,b.z-q.z),dy=(q.y-b.y)*KY;if(b.y<q.y&&Math.hypot(dh,dy)<2*SR+.01){sup=true;break}}
      if(!sup){q.aw=1;q.still=0}
    }
    last=step;
    if(step%every===0)rec();
    if(S.every(q=>q.g||!q.aw))break;
  }
  if(last%every)rec();
  for(const q of S){q.ax=q.az=0}
  frames.push(S.map(q=>[q.x,q.y,q.z,0,0]));
  // 움직인 알만 자취를 남김 (움직이기 바로 앞 장부터 마지막으로 움직인 장까지, 1000배 정수)
  const tr={},nf=frames.length;
  S.forEach((q,i)=>{
    let f0=-1,f1=-1;
    for(let f=1;f<nf;f++){const a=frames[f][i],b=frames[f-1][i];if(Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])+Math.abs(a[2]-b[2])+Math.abs(a[3]-b[3])+Math.abs(a[4]-b[4])>2e-4){if(f0<0)f0=f;f1=f}}
    if(f0<0)return;
    const out=[f0-1];for(let f=f0-1;f<=f1;f++)for(const v of frames[f][i])out.push(Math.round(v*1000));
    tr[i]=out;
  });
  return {fin:S.map(q=>({x:q.x,y:q.y,z:q.z,s:q.s,o:q.o,g:q.g})),tr,nf,ev,of,dur:Math.round((nf-1)/P.fps*1000)};
}
/* 놓기 전 알: 내 쪽 판 바깥 펠트에 한 줄로 (놓으면 판으로 날아감). k번째 알, 한 사람 n개 */
function reserveAt(s,k,n){
  const step=n>1?Math.min(.3,2.7/(n-1)):0,x=(k-(n-1)/2)*step,z=BW+.3,sd=s?-1:1;
  return {x:x*sd,y:FELT_Y+SH,z:z*sd,s,o:0,g:0,u:1};
}
function reserves(n){const out=[];for(const s of [0,1])for(let k=0;k<n;k++)out.push(reserveAt(s,k,n));return out}
/* 놓을 수 있는 자리: 줄이 만나는 점 (c 가로, r 세로 0~18). 0번 자리는 +z 쪽 반(r>9), 1번 자리는 -z 쪽 반(r<9), 가운데 줄은 안 됨, 다른 알이 없는 곳 */
const C0=(NL-1)/2;
const gridXZ=(c,r)=>[(c-C0)*PITCH,(r-C0)*PITCH];
const ownRow=(seat,r)=>seat===0?r>C0:r<C0;
function freeAt(A,c,r){const [x,z]=gridXZ(c,r);return !A.st.some(q=>!q.u&&!q.o&&Math.hypot(q.x-x,q.z-z)<PITCH*.6)}
function canPlace(A,seat,c,r){return Number.isInteger(c)&&Number.isInteger(r)&&c>=0&&c<NL&&r>=0&&r<NL&&ownRow(seat,r)&&freeAt(A,c,r)}
/* 봇·시간 초과의 놓기: 내 끝줄에서 2~7줄 안쪽, 다른 알과 붙지 않은 곳 중 아무 데나 (없으면 놓을 수 있는 아무 곳) */
function placePlan(A,seat,rnd,lv){
  rnd=rnd||Math.random;const far=lv===2?5:7;   // 어려움은 가운데에서 더 멀리(끝줄에서 2~5줄)
  const all=[],good=[];
  for(let r=0;r<NL;r++)for(let c=0;c<NL;c++){
    if(!canPlace(A,seat,c,r))continue;all.push([c,r]);
    const dEdge=seat===0?NL-1-r:r,[x,z]=gridXZ(c,r);
    if(dEdge>=2&&dEdge<=far&&c>=2&&c<=NL-3&&!A.st.some(q=>!q.u&&!q.o&&Math.hypot(q.x-x,q.z-z)<PITCH*1.5))good.push([c,r]);
  }
  const L=good.length?good:all;
  return L.length?L[(rnd()*L.length)|0]:null;
}
const CNAME=['','흑','백'];

/* ---------- 봇 ----------
   쉬움(botPlan): 남은 내 알 중 하나를 골라 가까운 상대 알을 향해, 방향과 힘을 크게 흔들어서.
   보통·어려움(botThink): 가까운 내 알·상대 알 짝마다 몇 가지 방향(정면·비껴 치기)과 힘으로 물리를 미리 돌려 보고(simulate, 흔들림 없이)
   가장 좋은 수를 고른 뒤 실제로는 조금 흔들어 튕김. 한 번에 다 돌리면 방장 화면이 멈추므로 틱마다 조금씩(BOT_MS) */
const BLV=[null,{pairs:3,offs:[0,-1,1],pows:[0,.25],aim:.11,pw:.15},{pairs:6,offs:[0,-1,1,-2,2],pows:[0,.2,.45],aim:.015,pw:.04}];
const BOT_MS=8;   // 틱(0.1초)마다 생각에 쓰는 시간
function shotCands(A,seat,lv){
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
  const v=speedOf(c.p),r=simulate(A.st,{i:c.i,vx:Math.cos(c.a)*v,vz:Math.sin(c.a)*v,p:c.p},()=>.5);
  let sc=0;r.fin.forEach((q,k)=>{const was=A.st[k];if(was.o||!q.o)return;sc+=was.s===seat?-12:10});
  const f=r.fin[c.i];if(!f.o)sc-=2*Math.max(0,Math.max(Math.abs(f.x),Math.abs(f.z))-(BW-.5));
  return sc;
}
function botThink(i,lv){   // 이번 차례의 생각을 이어서 함. 끝났으면 true
  const A=H.ak;let q=A.bq;
  if(!q||q.sid!==A.sid||q.seat!==i){q=A.bq={sid:A.sid,seat:i,c:shotCands(A,i,lv),k:0,best:null,bs:-1e9}}
  const t0=Date.now();
  while(q.k<q.c.length&&Date.now()-t0<BOT_MS){const c=q.c[q.k++],sc=shotScore(A,i,c)+Math.random()*.3;if(sc>q.bs){q.bs=sc;q.best=c}}
  return q.k>=q.c.length;
}
function botPick(i,rnd){   // 난이도에 맞는 수 {i,a,p,fa}
  rnd=rnd||Math.random;
  const A=H.ak,lv=typeof botLv==='function'?botLv(H.players[i]):1,L=BLV[lv];
  if(!L)return botPlan(A,i,rnd);
  botThink(i,lv);const b=A.bq&&A.bq.best;if(!b)return botPlan(A,i,rnd);
  const a=b.a+(rnd()*2-1)*L.aim,p=Math.max(.3,Math.min(1,b.p*(1+(rnd()*2-1)*L.pw)));
  return {i:b.i,a,p,fa:a+spreadOf(p)*jit(rnd()*1e6)};
}
function botPlan(A,seat,rnd){
  rnd=rnd||Math.random;
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
G.rulesHTML='<ol class="rules"><li><b>목표</b> : 내 알을 튕겨 상대 알을 모두 판 밖으로 떨어뜨리면 <b>승리</b>합니다</li><li><b>알 놓기</b> : 먼저 선(흑)이 내 쪽 반의 줄이 만나는 점에 알을 하나 놓고, 이어서 상대가 하나 놓습니다. 이렇게 번갈아 모두 놓으면 알까기를 시작합니다. 가운데 줄과 상대 쪽 반에는 놓지 못합니다. 누른 점에 미리 보기가 뜨고, 같은 점을 한 번 더 누르면 놓습니다(설정의 ‘두 번 눌러 놓기’를 끄면 바로 놓습니다)</li><li><b>진행</b> : 선부터 번갈아 내 알 하나씩 튕깁니다. 판 밖으로 떨어진 알은 다시 쓰지 못하고, 내 알이 떨어져도 마찬가지입니다</li><li><b>튕기기</b> : 내 알을 누른 채 뒤로 당겼다 놓습니다. 알 뒤에 내 손이 나타나 당길수록 진해지고 세게 나갑니다. 끝까지 당기면 더 세지지 않습니다. 조금만 당기고 놓으면 취소됩니다</li><li><b>손 떨림</b> : 손은 당기는 동안 계속 떨리고, 세게 당길수록 크게 떨립니다. 놓는 순간 손이 가리키던 쪽으로 나가므로 살살 치면 거의 똑바로, 세게 치면 빗나가기 쉽습니다</li><li><b>뜨는 알</b> : 바둑알은 납작해서 세게 부딪히면 위로 튀어 오르기도 합니다</li><li><b>한 번 더</b> : 탁자 설정에서 켜면, 상대 알을 떨어뜨리고 튕긴 내 알이 판에 남았을 때 한 번 더 튕깁니다</li><li><b>끝</b> : 한쪽 알이 모두 떨어지면 끝납니다. 두 사람의 마지막 알이 함께 떨어지면 무승부입니다</li><li><b>제한 시간</b> : 튕길 차례에 제한 시간이 지나면 차례가 넘어가고, 놓을 차례에 지나면 아무 자리에 대신 놓습니다. 연결이 끊겨도 시간은 흐르고, 45초 안에 돌아오지 않으면 탈주로 처리합니다</li><li><b>다음 판</b> : 결과 화면에서 바로 시작하면 진 사람이 선(먼저 놓고 먼저 튕김)이 되고, 비기면 서로 바꿉니다. 첫 판은 탁자 설정의 선 직접 고르기로 정합니다</li></ol>';
G.modeDesc=['상대 알을 모두 떨어뜨리면 끝','상대 알을 모두 떨어뜨리면 끝'];
G.defaults={max:2,turn:30,stones:5,again:1,pickfirst:0};
G.roomSet=[
  {k:'stones',label:'알 개수',unit:'개',lo:1,hi:10,step:1,desc:'한 사람이 가지고 시작하는 알 수입니다'},
  {k:'turn',label:'제한 시간',unit:'초',lo:10,hi:120,step:5,desc:'시간이 지나면 차례가 넘어갑니다'}];
G.ruleSet=[
  {k:'again',label:'떨어뜨리면 한 번 더',desc:'상대 알을 떨어뜨리고 튕긴 내 알이 판에 남으면 한 번 더 튕깁니다'},
  {k:'pickfirst',label:'선 직접 고르기',desc:'켜면 방장이 대기실에서 선(먼저 놓고 먼저 튕길 사람)을 고릅니다. 끄면 랜덤입니다'}];
const nStones=c=>Math.max(1,Math.min(10,Math.round(+c.stones||5)));
G.cfgChips=c=>`<span class="chip">알 <b>${nStones(c)}개</b></span><span class="chip">제한 시간 <b>${+c.turn||30}초</b></span><span class="chip">한 번 더 <b>${+c.again?'켜기':'끄기'}</b></span><span class="chip">선 <b>${+c.pickfirst?'방장 선택':'랜덤'}</b></span>`;
G.cfgSum=c=>`알 ${nStones(c)}개 · 제한 시간 ${+c.turn||30}초 · 한 번 더 ${+c.again?'켜기':'끄기'} · 선 ${+c.pickfirst?'방장 선택':'랜덤'}`;
G.roomSub=()=>'2명 보드게임';
G.pubExtra=()=>({});
G.cardInfo=(c,nowN)=>`<p class="cardinfo">${nowN>2?'알까기는 두 명이 하는 게임입니다.':'두 명이 하는 게임입니다.'}</p>`;
G.rankTitle=()=>'';
G.finLabel=()=>'';
G.noEmotes=['gq'];
G.keys={};
G.keyActions=[];
/* 이 게임에는 카드가 없음 (공통 코드가 부르는 자리만 채움) */
G.cardHTML=()=>'';G.drawFace=()=>{};G.cmpCard=()=>0;G.labelOf=()=>'';

/* ---------- 방장 엔진 (규칙 처리) ---------- */
const other=i=>1-i;
const aliveOf=(A,seat)=>A.st.filter(s=>s.s===seat&&!s.o).length;
function sameNames(a,b){return a.length===2&&b.length===2&&a.every(x=>b.includes(x))&&a[0]!==a[1]}
/* 먼저 튕길 사람: 결과 화면에서 바로 시작하면 진 사람(비기면 지난 판 선이 아닌 사람), 아니면 공통 firstSeat (직접 고르기면 방장이 고른 사람, 아니면 랜덤) */
function pickFirst(again){
  const ns=H.players.slice(0,2).map(p=>p.name),L=H.akLast;
  if(again&&L&&L.ns&&sameNames(ns,L.ns)){
    if(L.w)return ns.indexOf(L.w)===0?1:0;
    return ns.indexOf(L.A)===0?1:0;
  }
  return typeof firstSeat==='function'?firstSeat(2):(Math.random()<.5?0:1);
}
function startTurn(i,ph){
  const A=H.ak,t=clock();
  A.ph=ph||'aim';A.aim=null;A.bp=null;H.turn=i;H.graceUntil=0;
  A.hold=A.ph==='place'&&H.players[i]&&H.players[i].bot?i:-1;   // 놓을 알을 집어 듦 (봇은 차례가 오면 바로)
  H.deadline=t+(+H.cfg.turn||30)*1000;
  H.botActAt=H.players[i]&&H.players[i].bot?t+rand(700,1400):0;
  mark();
}
function finishGame(w,why){
  flushLog();   // 굴러가는 중에 항복·탈주하면 그 튕기기 기록을 먼저
  const A=H.ak;
  A.res={w,why:why||''};A.ph='aim';A.aim=null;A.bp=null;
  if(w>=0){
    const l=other(w),pw=H.players[w],pl=H.players[l];
    pw.finished=true;pw.rank=1;pw.hand=[];pl.finished=true;pl.rank=2;pl.hand=[];
    if(why==='surrender'||why==='desert')pl.surrendered=true;
    addLog(why?`${pl.name} ${why==='desert'?'탈주':'항복'}! ${pw.name} 승리`:`${pw.name} 승리!`,why?'lie':'fin');
  }else{
    for(const i of [0,1]){const p=H.players[i];p.finished=true;p.rank=1;p.hand=[]}
    addLog('무승부입니다.','sys');
  }
  H.akLast={ns:H.players.slice(0,2).map(p=>p.name),w:w>=0?H.players[w].name:'',A:H.players[A.A].name};
  H.phase='over';H.botActAt=0;mark();
  H.players.forEach((p,i)=>{if(p.bot&&i<2&&Math.random()<.5)botEmote(i,'gg',800+Math.random()*1600)});
}
/* 튕기기: 물리를 끝까지 계산해 결과 자리와 자취를 담아 둠. 연출이 끝나면(tick) 다음 차례 */
function doShot(seat,i,a,p){
  const A=H.ak,s=A.st[i];
  if(!s||s.s!==seat||s.o||!Number.isFinite(a)||!Number.isFinite(p))return false;
  p=Math.max(PMIN,Math.min(1,p));
  const v=speedOf(p),before=[aliveOf(A,0),aliveOf(A,1)];
  const r=simulate(A.st,{i,vx:Math.cos(a)*v,vz:Math.sin(a)*v,p});
  A.st=r.fin.map((q,k)=>({x:q.x,y:q.y,z:q.z,s:q.s,o:A.st[k].o||q.o?1:0,g:A.st[k].g||q.g?1:0}));
  const after=[aliveOf(A,0),aliveOf(A,1)],kn=before[other(seat)]-after[other(seat)],own=before[seat]-after[seat];
  A.cnt++;A.sid++;
  A.sh={id:A.sid,by:seat,i,a,p,tr:r.tr,nf:r.nf,ev:r.ev,of:r.of,dur:r.dur,t0:clock()};
  A.ph='roll';A.until=clock()+r.dur+450;A.aim=null;A.bp=null;H.botActAt=0;
  A.next=+H.cfg.again&&kn>0&&!A.st[i].o?seat:other(seat);   // 한 번 더: 상대 알을 떨어뜨리고 튕긴 알이 판에 남음
  H.seatNote[seat]='';
  const nm=H.players[seat].name,parts=[];
  if(kn)parts.push(`${kn}알 까기`);if(own)parts.push(`내 알 ${own}개 떨어짐`);
  A.lg=[`${A.cnt}. ${nm} ${parts.length?parts.join(' · '):'빗나감'}`,kn?'fin':''];   // 기록은 알이 다 멈춘 뒤에 (굴러가는 동안 영수증이 결과를 먼저 알려 주지 않게)
  mark();
  return true;
}
/* 놓기: 선부터 한 알씩 번갈아 내 쪽 반에 놓음. 다 놓으면 선이 먼저 튕김 */
const unplaced=(A,seat)=>A.st.filter(q=>q.s===seat&&q.u).length;
function doPlace(seat,c,r){
  const A=H.ak;
  if(A.ph!=='place'||!canPlace(A,seat,c,r))return false;
  const i=A.st.findIndex(q=>q.s===seat&&q.u);if(i<0)return false;
  const [x,z]=gridXZ(c,r);A.st[i]={x,y:TOP+SH,z,s:seat,o:0,g:0};A.pc=(A.pc||0)+1;
  H.seatNote[seat]='';
  if(!unplaced(A,0)&&!unplaced(A,1)){addLog('알을 모두 놓았습니다. 알까기를 시작합니다.','sys');startTurn(A.A);return true}
  startTurn(unplaced(A,other(seat))?other(seat):seat,'place');
  return true;
}
function autoPlace(i){const p=H.players[i],b=placePlan(H.ak,i,null,p&&p.bot&&typeof botLv==='function'?botLv(p):1);if(!b||!doPlace(i,b[0],b[1])){const A=H.ak;A.st.forEach(q=>{if(q.u){q.u=0;q.o=1;q.g=1}});startTurn(A.A)}}   // 놓을 곳이 없으면(생기지 않음) 남은 알은 빼고 시작
function flushLog(){const A=H.ak;if(A&&A.lg){addLog(A.lg[0],A.lg[1]);A.lg=null}}
function afterShot(){
  flushLog();
  const A=H.ak,a0=aliveOf(A,0),a1=aliveOf(A,1);
  if(!a0||!a1){finishGame(!a0&&!a1?-1:a0?0:1);return}
  startTurn(A.next);
}
function doSurrender(seat){
  if(H.phase!=='play'||seat<0||seat>1||H.players[seat].finished)return;
  finishGame(other(seat),H.players[seat].deserter?'desert':'surrender');
}
/* 제한 시간이 지나면 차례를 넘김. 봇(과 탈주해서 봇이 맡은 자리)은 바로 튕김. 연결이 끊겨 기다리는 사람도 다른 사람과 똑같이 넘어감 */
function timeout(){
  const i=H.turn,p=H.players[i];
  if(H.ak.ph==='place'){if(!(p.bot&&!awayHuman(p)))addLog(`${p.name} 시간 초과로 아무 자리에 놓습니다.`,'sys');autoPlace(i);return}   // 놓기는 넘기지 않고 대신 놓음
  if(p.bot&&!awayHuman(p)){botShootNow(i);return}
  addLog(`${p.name} 시간 초과로 차례를 넘깁니다.`,'sys');
  startTurn(other(i));
}
function botShootNow(i){const b=H.ak.bp||botPick(i);if(!b||!doShot(i,b.i,b.fa,b.p))startTurn(other(i))}
/* 봇: 알을 고르고 천천히 당긴 뒤(상대 화면에도 손이 보임) 놓음 */
function botStep(i,t){
  const A=H.ak;
  if(!A.bp){const lv=typeof botLv==='function'?botLv(H.players[i]):1;if(BLV[lv]&&!botThink(i,lv)&&t<H.botActAt+4000)return;   // 다 생각할 때까지 (오래 걸리면 그때까지 찾은 것으로)
    const b=botPick(i);if(!b){startTurn(other(i));return}A.bp={...b,t0:t,dur:Math.round(rand(650,1150))};A.aim={s:i,i:b.i,a:b.a,p:0,w:0};mark();return}
  const k=(t-A.bp.t0)/A.bp.dur;
  if(k<1){const e=1-Math.pow(1-Math.max(0,k),2),np=Math.round(A.bp.p*e*1000)/1000;if(!A.aim||A.aim.p!==np){A.aim={s:i,i:A.bp.i,a:A.bp.a,p:np,w:0};mark()}return}
  const b=A.bp;A.bp=null;
  if(!doShot(i,b.i,b.fa,b.p))startTurn(other(i));
}
/* 테스트(tests/engine.test.js)에서 직접 부르는 내부 함수 */
G._test={simulate,reserves,shotCands,shotScore,botPick,placePlan,canPlace,gridXZ,botPlan,speedOf,groundAt,doShot,doSurrender,timeout,pickFirst,aliveOf,PHY,TOP,SH,SR,BW,PITCH,NL};
G.engine={
  /* 게임 시작: 공통 코드가 H.players를 만든 뒤 부름 */
  start(){
    const again=H.phase==='over',n=nStones(H.cfg);
    Object.assign(H,{phase:'play',log:[],seatNote:{},field:[],last:null,reveal:null,shouts:[],pending:null,rankNext:1,known:{}});
    H.players.forEach((p,i)=>{
      p.finished=false;p.rank=null;p.surrendered=false;
      if(i<2)p.hand=[0];else{p.hand=[];p.finished=true;p.rank=i+1}   // 자리가 모자라면(3명 이상) 구경만 함 (보통은 최대 인원 2명이라 생기지 않음)
    });
    const Af=pickFirst(again);
    H.akGid=(H.akGid||0)+1;
    H.ak={gid:H.akGid,n,A:Af,co:Af===0?[1,2]:[2,1],st:reserves(n),ph:'place',pc:0,sid:0,sh:null,aim:null,bp:null,res:null,cnt:0,next:Af,until:0};
    addLog(`${H.players[Af].name}님이 흑으로 먼저 놓고 먼저 튕깁니다. (알 ${n}개씩 번갈아 놓기)`,'sys');
    startTurn(Af,'place');
  },
  act(seat,a){
    if(a.t==='surrender'){doSurrender(seat);return}
    const A=H.ak;
    if(!A||H.phase!=='play'||seat<0||seat>1||H.turn!==seat)return;
    if(a.t==='place'){doPlace(seat,a.c,a.r);return}
    if(a.t==='hold'){if(A.ph==='place'){const h=a.on?seat:-1;if(A.hold!==h){A.hold=h;mark()}}return}
    if(A.ph!=='aim')return;
    if(a.t==='aim'){   // 당기는 중 (화살표를 상대에게도 보여 줌). i<0이면 내려놓음
      if(!Number.isInteger(a.i)||a.i<0){if(A.aim){A.aim=null;mark()}return}
      const s=A.st[a.i];if(!s||s.s!==seat||s.o||!Number.isFinite(+a.a)||!Number.isFinite(+a.p))return;
      A.aim={s:seat,i:a.i,a:Math.round(+a.a*1000)/1000,p:Math.round(Math.max(0,Math.min(1,+a.p))*1000)/1000,w:a.w?1:0};mark();
    }else if(a.t==='shoot'){
      if(!Number.isInteger(a.i))return;
      doShot(seat,a.i,+a.a,+a.p);
    }
  },
  tick(t){
    const A=H.ak;
    if(!A||H.phase!=='play')return;
    if(A.ph==='roll'){if(t>=A.until)afterShot();return}
    const cur=H.players[H.turn];if(!cur)return;
    if(t>=H.deadline){timeout();return}
    if(cur.bot&&H.botActAt&&A.ph==='aim'&&!A.bp&&t<H.botActAt&&!(cur.away&&t<cur.awayAt+AWAY_WAIT)){const lv=typeof botLv==='function'?botLv(cur):1;if(BLV[lv])botThink(H.turn,lv)}   // 당기기 전 쉬는 동안 미리 생각
    if(cur.bot&&H.botActAt&&t>=H.botActAt&&!(cur.away&&t<cur.awayAt+AWAY_WAIT)){if(A.ph==='place')autoPlace(H.turn);else botStep(H.turn,t)}
  },
  snap(s,you,t){
    const A=H.ak,r3=v=>Math.round(v*1000)/1000;
    const sh=A.sh?{id:A.sh.id,by:A.sh.by,i:A.sh.i,a:Math.round(A.sh.a*1000)/1000,p:Math.round(A.sh.p*1000)/1000,age:Math.max(0,Math.round(t-A.sh.t0))}:null;
    if(sh&&sh.age<A.sh.dur+4000){sh.tr=A.sh.tr;sh.nf=A.sh.nf;sh.ev=A.sh.ev;sh.of=A.sh.of;sh.dur=A.sh.dur}   // 자취는 연출 중인 동안만 보냄 (가볍게)
    s.ak={gid:A.gid,n:A.n,A:A.A,co:A.co.slice(),st:A.st.map(q=>[r3(q.x),r3(q.y),r3(q.z),q.s,q.o?1:0,q.g?1:0,q.u?1:0]),ph:A.ph,sid:A.sid,sh,aim:A.aim?{...A.aim}:null,res:A.res?{...A.res}:null,cnt:A.cnt,ag:+H.cfg.again?1:0,hd:A.ph==='place'?(A.hold??-1):-1};
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
let OS=null,drag=null,elAk=null,elSvg=null,elMain=null,elBar=null,elHint=null,lastBar='',lastHint='',msg='',msgUntil=0,msgTimer=null;
const MAXD=1.25;   // 끝까지 당긴 거리 (월드). 넘게 당겨도 더 세지지 않음
const SEND_MS=90;   // 당기는 중 화살표를 방장에게 보내는 간격
const myTurnNow=()=>!!(V&&V.ak&&V.st==='play'&&myReady()&&OS&&OS.ph==='aim');
const myPlaceNow=()=>!!(V&&V.ak&&V.st==='play'&&V.t===myIdx()&&OS&&OS.ph==='place'&&!introWait());
const sideOf=()=>myIdx()===1?-1:1;   // 내 쪽: 0번 자리(또는 관전)는 +z, 1번 자리는 -z
function buildS(o){
  return {gid:o.gid,n:o.n,A:o.A,co:o.co,st:o.st.map(a=>({x:a[0],y:a[1],z:a[2],s:a[3],o:a[4],g:a[5],u:a[6]})),ph:o.ph,sid:o.sid,sh:o.sh,aim:o.aim,res:o.res,cnt:o.cnt,ag:o.ag,hd:o.hd??-1};
}
function say(txt){
  msg=txt;msgUntil=Date.now()+2400;drawHint();
  clearTimeout(msgTimer);msgTimer=setTimeout(drawHint,2500);
}
const nm=i=>V.ps[i]?V.ps[i].n:'?';
/* 남은 알: 튕긴 자취를 재생하는 동안은 아직 떨어지지 않은 알(떨어진 시각 of가 재생 시각보다 뒤)도 남은 것으로 셈 */
function aliveS(seat){
  if(!OS)return 0;
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
function sndNo(){sfx('no')}

/* ----- 당기기 (3D·2D 같은 계산: 월드 좌표의 당긴 벡터) ----- */
function pickStone(x,z){   // 누른 곳에서 가까운 내 알 (알이 작아도 손가락으로 집기 쉽게 .45 안)
  if(!OS)return -1;
  const me=myIdx();let best=-1,bd=.45;
  OS.st.forEach((s,i)=>{if(s.s!==me||s.o)return;const d=Math.hypot(s.x-x,s.z-z);if(d<bd){bd=d;best=i}});
  return best;
}
/* 놓기: 누른 곳에서 가장 가까운 줄 점. 처음 누르면 반투명 미리 보기, 같은 점을 한 번 더 누르면 놓음('두 번 눌러 놓기'를 끄면 바로) */
let GH=null;   // 미리 보기 {c,r}
function nearGrid(x,z){const c=Math.round(x/PITCH+C0),r=Math.round(z/PITCH+C0);return Math.hypot(x-(c-C0)*PITCH,z-(r-C0)*PITCH)<PITCH*.75?[c,r]:null}
function setGH(g){const was=!!GH;GH=g;if(was!==!!g)sendAct({t:'hold',on:g?1:0});Ak3.dirty=true;draw2D()}
const nextOf=seat=>OS?OS.st.findIndex(q=>q.s===seat&&q.u):-1;   // 다음에 놓을 알 (놓기 전 줄의 첫 알)
function placeTap(x,z){
  const me=myIdx();if(me<0||me>1)return;
  if(!myPlaceNow()){sndNo();return}
  {const k=nextOf(me),q=k>=0&&OS.st[k];if(GH&&q&&Math.hypot(q.x-x,q.z-z)<.3){setGH(null);sndPickUp();return}}   // 집어 든 알을 누르면 내려놓음
  const g=nearGrid(x,z);
  if(!g||!canPlace(OS,me,g[0],g[1])){sndNo();return}
  const dbl=typeof dblTap==='undefined'||!!dblTap;
  if(dbl&&!(GH&&GH.c===g[0]&&GH.r===g[1])){if(!GH)sndPickUp();setGH({c:g[0],r:g[1]});return}
  GH=null;sendAct({t:'place',c:g[0],r:g[1]});Ak3.dirty=true;
}
function dragStart(x,z){
  if(!OS||!V||V.st!=='play')return false;
  const me=myIdx();if(me<0)return false;
  if(OS.ph==='place'){placeTap(x,z);return false}
  const i=pickStone(x,z);
  if(i<0)return false;
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
  if(cancel||d.p<PMIN||!myTurnNow()){sendAct({t:'aim',i:-1});if(!cancel&&d.L>.02)sndPickUp();return}
  const t=clock(),j=spreadOf(d.p)*jit(t+d.ph),a=baseAng(d)+j;   // 놓는 순간 손이 가리키던 방향 (j: 그중 떨림 몫)
  const q=OS.st[d.i];
  sendAct({t:'shoot',i:d.i,a,p:d.p});
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
function handNow(t,pos){
  if(FLK){
    const e=t-FLK.t0;
    if(e>FLK_IN+FLK_OUT){FLK=null}
    else{const fl=Math.min(1,e/FLK_IN),fade=e<=FLK_IN?1:1-(e-FLK_IN)/FLK_OUT;
      return {i:FLK.i,x:FLK.x,z:FLK.z,ang:FLK.a,j:FLK.j||0,p:FLK.p,fl,op:handOp(FLK.p)*fade,seat:FLK.seat,fade}}
  }
  const a=aimNow(t);
  if(!a||!pos[a.i]||V.st!=='play'||Ak3.shot||a.p<.005)return null;
  const j=spreadOf(a.p)*jit(t+a.ph);
  return {i:a.i,x:pos[a.i].x,z:pos[a.i].z,ang:a.a+j,j,p:a.p,fl:0,op:handOp(a.p),seat:a.seat,fade:1};
}

/* ----- 2D (SVG, WebGL이 없을 때) ----- */
const VX=BW+.1,VY=BW+.5;   // 그림 범위: 가로는 판 끝까지, 세로는 놓기 전 알(판 위아래 펠트)까지
const w2s=(x,z)=>{const sd=sideOf();return [x*sd,z*sd]};
function s2w(e){
  const r=elSvg.getBoundingClientRect(),k=Math.min(r.width/(2*VX),r.height/(2*VY))||1,ox=(r.width-2*VX*k)/2,oy=(r.height-2*VY*k)/2;
  const X=(e.clientX-r.left-ox)/k-VX,Y=(e.clientY-r.top-oy)/k-VY,sd=sideOf();
  return [X*sd,Y*sd];
}
function boardSvg(){
  const out=[],c0=(NL-1)/2,hl=c0*PITCH;
  out.push(`<circle cx="0" cy="0" r="3.15" fill="#2f6b4f"/><rect x="${-BW-.06}" y="${-BW+.08}" width="${2*BW+.12}" height="${2*BW+.04}" rx=".08" fill="#000" opacity=".22"/><rect x="${-BW}" y="${-BW}" width="${2*BW}" height="${2*BW}" rx=".06" fill="#8a5a32"/><rect x="${-BW+.06}" y="${-BW+.06}" width="${2*BW-.12}" height="${2*BW-.12}" rx=".04" fill="#e3bd7e"/>`);
  for(let k=0;k<NL;k++){const v=(k-c0)*PITCH;out.push(`<line x1="${-hl}" y1="${v}" x2="${hl}" y2="${v}" stroke="#6b4a26" stroke-width=".014"/><line x1="${v}" y1="${-hl}" x2="${v}" y2="${hl}" stroke="#6b4a26" stroke-width=".014"/>`)}
  for(const a of HOSHI)for(const b of HOSHI)out.push(`<circle cx="${(a-c0)*PITCH}" cy="${(b-c0)*PITCH}" r=".03" fill="#4b3319"/>`);
  return out.join('');
}
function stones2D(pos){
  const out=[],t=clock();
  pos.forEach((q,i)=>{
    const s=OS.st[i];if(!s||q.y<-.5)return;
    const col=OS.co[s.s],[X,Y]=w2s(q.x,q.z),h=Math.max(0,q.y-(groundAt(q.x,q.z)+SH)),k=stoneScale(q.y),f=col===1?'#232326':'#f7f2e8',st=col===1?'#0c0c0e':'#8c7a5b';
    out.push(`<circle cx="${X+h*.5}" cy="${Y+h*.35}" r="${SR*(1+h*.8)}" fill="#000" opacity="${.28/(1+h*5)}"/><circle cx="${X}" cy="${Y}" r="${SR*k}" fill="${f}" stroke="${st}" stroke-width=".02"/>`);
  });
  if(OS.ph==='place'&&V.st==='play'&&!introWait()){const me=myIdx(),hl=BW-.07;   // 상대 쪽 반 빗금(화면 위쪽) + 가운데 바리케이드
    if(me>=0&&me<2)out.unshift(`<rect x="${-BW+.06}" y="${-(BW-.06)}" width="${2*BW-.12}" height="${BW-.06-PITCH/2}" fill="url(#akHatch)" opacity=".32"/>`);
    out.unshift(`<rect x="${-hl}" y="${-PITCH*.21}" width="${2*hl}" height="${PITCH*.42}" fill="url(#akBar)" stroke="#3b2a1f" stroke-width=".02"/>`)}
  if(myPlaceNow()){const me=myIdx();
    if(GH){const [x,z]=gridXZ(GH.c,GH.r),[X,Y]=w2s(x,z),c=OS.co[me];out.push(`<circle cx="${X}" cy="${Y}" r="${SR}" fill="${c===1?'#232326':'#f7f2e8'}" stroke="${c===1?'#0c0c0e':'#8c7a5b'}" stroke-width=".02" opacity=".5"/>`)}}
  if(myTurnNow()&&!drag&&!Ak3.shot&&!FLK)OS.st.forEach((s,i)=>{if(s.s===myIdx()&&!s.o){const [X,Y]=w2s(pos[i].x,pos[i].z);out.push(`<circle cx="${X}" cy="${Y}" r="${SR*1.45}" fill="none" stroke="#f2b632" stroke-width=".03" opacity=".85"/>`)}});
  const hd=handNow(t,pos);
  if(hd){
    const r=handCanvas(hd.p,hd.fl,hd.seat,hd.op);if(r.changed||!HAND.url)HAND.url=r.cv.toDataURL();
    const [X,Y]=w2s(hd.x,hd.z),deg=(hd.ang+(sideOf()<0?Math.PI:0))*180/Math.PI;
    out.push(`<image href="${HAND.url}" x="${HB.x0}" y="${-HB.y}" width="${HB.x1-HB.x0}" height="${2*HB.y}" transform="translate(${X} ${Y}) rotate(${deg}) translate(${-.165*(1-HSC)+HOFF} 0) scale(${HSC})"/>`);
  }
  return out.join('');
}
function draw2D(){
  if(!elMain||Ak3.on||!OS)return;
  const bd=elMain.querySelector('#akB');if(!bd.dataset.k){bd.innerHTML=boardSvg();bd.dataset.k='1'}
  elMain.querySelector('#akS').innerHTML=stones2D(curPos(clock()));
}

/* ----- 위쪽 이름 칸: 알 색·이름·남은 알(●)·내 차례면 남은 시간 ----- */
function barHTML(){
  const me=myIdx(),order=me===1?[1,0]:[0,1];
  return order.map(i=>{
    const p=V.ps[i];if(!p||i>1)return '';
    const on=V.st==='play'&&V.t===i&&!introWait(),col=OS.co[i],al=aliveS(i);
    const st=V.st==='over'?(OS.res&&OS.res.w<0?'무승부':p.f===1?'승리':(p.sr===3?'탈주':p.sr?'항복':'패배')):'';
    const dots=Array.from({length:OS.n},(_,k)=>`<i class="pip${k<al?'':' gone'}"></i>`).join('');
    return `<div class="ak-p${on?' on':''}${i===me?' me':''}"><i class="dot ${col===1?'blk':'wht'}"></i><b>${esc(p.n)}${i===me?' (나)':''}</b><span class="pips">${dots}</span><span class="w" data-ct="${i}"></span>${st?`<span class="st">${st}</span>`:''}</div>`;
  }).join('');
}
/* 안내 줄: 꼭 필요한 것만 (누구 차례인지는 이름 칸, 튕길 수 있는 알은 고리가 보여 줌) */
function hintText(){
  if(Date.now()<msgUntil&&msg)return msg;
  if(!V||!V.ak||!OS)return '';
  if(V.st==='over'){
    const r=OS.res;if(!r)return '게임이 끝났습니다.';
    return r.w<0?'무승부입니다.':`${nm(r.w)} 승리${r.why==='surrender'?' (항복)':r.why==='desert'?' (탈주)':''}`;
  }
  if(OS.ph==='place'&&!introWait())return `알 놓기 ${OS.st.filter(q=>!q.u).length+1}/${OS.st.length}`;   // 놓기 단계 (몇 번째 알인지)
  return '';
}
function drawHint(){if(!elHint)return;const h=hintText();if(h!==lastHint){elHint.textContent=h;lastHint=h}}
function drawAll(){
  if(!OS||!elAk)return;
  const bar=barHTML();if(bar!==lastBar){elBar.innerHTML=bar;lastBar=bar}
  drawHint();fit2D();draw2D();
}
function fit2D(){
  if(!elAk||elAk.hidden||Ak3.on)return;
  const bd=elAk.querySelector('.ak-bd'),k=Math.min(bd.clientWidth/(2*VX),bd.clientHeight/(2*VY));
  if(k>0){elSvg.style.width=Math.floor(2*VX*k)+'px';elSvg.style.height=Math.floor(2*VY*k)+'px'}
}

/* ---------- 3D ---------- */
/* 바로 위(90도)에서 내려다봄: 높이가 안 보이므로 뜬 알은 조금 커지고(stoneScale) 바닥 그림자가 옆으로 벌어지며 흐려짐. 판 아래(펠트)로 떨어진 알은 작아짐 */
const stoneScale=y=>Math.max(.72,Math.min(1.75,1+(y-(TOP+SH))*1.3));
const Ak3={hi:{cur:-1,prev:-1,t0:0},bar:{on:false,t0:-1e9},on:false,built:false,fail:false,root:null,cam:null,dirty:true,lastR:0,lay:'',layAt:0,d:12,stones:[],rings:[],blobs:[],hand:null,shot:null,lastSid:-1,lastGid:-1,flickAt:0,col:[]};
const ease=k=>k<=0?0:k>=1?1:k*k*(3-2*k);
const MAT={};
function stoneMesh(col){
  const key='s'+col;
  if(!MAT[key])MAT[key]=toon({color:col===1?0x26262a:0xf4efe3,rim:col===1?.35:.12});
  if(!MAT.ink)MAT.ink=new THREE.MeshBasicMaterial({color:GFX_INK,side:THREE.BackSide});
  const g=new THREE.Group(),geo=Ak3.sGeo||(Ak3.sGeo=new THREE.SphereGeometry(SR,28,16)),m=new THREE.Mesh(geo,MAT[key]);m.scale.y=SH/SR;m.receiveShadow=true;g.add(m);
  const o=new THREE.Mesh(geo,MAT.ink);o.scale.set(1.07,SH/SR*1.12,1.07);g.add(o);
  g.userData={col,body:m};g.rotation.order='YXZ';
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
function ak3Build(){
  if(Ak3.built||Ak3.fail)return Ak3.built;
  if(!T.ok||typeof THREE==='undefined'){Ak3.fail=true;return false}
  try{
    const root=new THREE.Group();root.visible=false;
    const inkM=new THREE.MeshBasicMaterial({color:GFX_INK,side:THREE.BackSide});
    const bg=new THREE.Group();root.add(bg);Ak3.boardG=bg;
    const frameT=canvasTex(512,512,(g,w,h)=>woodPaint(g,w,h,'#6f4020','#2a1206',110,3));
    const frame=new THREE.Mesh(new THREE.BoxGeometry(2*BW,TOP-.02,2*BW),toon({map:frameT,rim:.08}));frame.position.y=.02+(TOP-.02)/2;frame.castShadow=frame.receiveShadow=true;bg.add(frame);
    const fo=new THREE.Mesh(new THREE.BoxGeometry(2*BW+.05,TOP,2*BW+.05),inkM);fo.position.copy(frame.position);bg.add(fo);
    const top=new THREE.Mesh(new THREE.PlaneGeometry(2*BW-.1,2*BW-.1),toon({map:boardTex(),rim:0}));
    top.rotation.x=-Math.PI/2;top.position.y=TOP+.002;top.receiveShadow=true;bg.add(top);
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
    // 건널목 차단기: 판 틀 양끝(가운데 줄 끝)에 기둥, 기둥 위 축에서 검정·노랑 차단봉이 가운데 줄 위로 내려옴. 기둥 머리에 빨간 경고등 둘(번갈아 깜빡)
    {const XP=BW-.13,AH=.3,AL=XP-.045,AW=.06,AT=.04,tex=canvasTex(256,32,(g,W,Hc)=>{g.fillStyle='#f2c230';g.fillRect(0,0,W,Hc);g.fillStyle='#1d1b19';
       for(let x=-Hc;x<W+Hc;x+=Hc*2){g.beginPath();g.moveTo(x,Hc);g.lineTo(x+Hc,Hc);g.lineTo(x+2*Hc,0);g.lineTo(x+Hc,0);g.closePath();g.fill()}});
     tex.wrapS=THREE.RepeatWrapping;tex.repeat.set(AL/(AW*8),1);
     const g=new THREE.Group(),am=toon({map:tex,rim:.1}),pm=toon({color:0xd9dcdf,rim:.15}),dm=toon({color:0x2b2b2e,rim:.1}),
       lampA=new THREE.MeshBasicMaterial({color:0x5a1410}),lampB=new THREE.MeshBasicMaterial({color:0x5a1410}),
       add=(par,geo,m,x,y,z)=>{const a=new THREE.Mesh(geo,m),o=new THREE.Mesh(geo,inkM);a.position.set(x,y,z);o.position.copy(a.position);
         geo.computeBoundingBox();const bb=geo.boundingBox,e=.018;o.scale.set(...['x','y','z'].map(k=>(bb.max[k]-bb.min[k]+e)/(bb.max[k]-bb.min[k])));a.castShadow=true;par.add(a,o);return a};
     const arms=[];
     for(const sg of [-1,1]){
       const post=new THREE.Group();post.position.set(sg*XP,0,0);g.add(post);
       add(post,new THREE.CylinderGeometry(.075,.085,.03,20),dm,0,.015,0);   // 받침
       add(post,new THREE.CylinderGeometry(.03,.034,AH+.1,16),pm,0,(AH+.1)/2,0);   // 기둥
       add(post,new THREE.BoxGeometry(.06,.07,.16),dm,0,AH+.13,0);   // 경고등 머리
       for(const [z,m] of [[-.05,lampA],[.05,lampB]]){const l=new THREE.Mesh(new THREE.SphereGeometry(.028,14,10),m);l.position.set(0,AH+.13+.03,z);post.add(l)}
       const piv=new THREE.Group();piv.position.set(0,AH,0);piv.rotation.y=sg>0?Math.PI:0;post.add(piv);   // 축: 봉이 판 가운데 쪽(+x 로컬)으로 뻗음
       const arm=new THREE.Group();piv.add(arm);
       add(arm,new THREE.BoxGeometry(AL,AW,AT),am,AL/2,0,0);
       add(arm,new THREE.BoxGeometry(.13,.07,.07),dm,-.08,0,0);   // 축 뒤 추
       arms.push(arm)}
     g.visible=false;g.position.y=TOP;root.add(g);Ak3.barG=g;Ak3.gate={arms,lampA,lampB}}
    {const g=new THREE.Group(),mat=new THREE.MeshBasicMaterial({color:0x26262a,transparent:true,opacity:.5,depthWrite:false}),m=new THREE.Mesh(new THREE.SphereGeometry(SR,28,16),mat);
     m.scale.y=SH/SR;g.add(m);g.visible=false;g.renderOrder=4;root.add(g);Ak3.ghost={g,mat}}
    Ak3.cam=new THREE.PerspectiveCamera(40,1,.1,100);
    T.scene.add(root);Ak3.root=root;Ak3.built=true;
  }catch(e){Ak3.fail=true;try{console.warn('알까기 3D 준비 실패',e)}catch(_){}}
  return Ak3.built;
}
/* 3D 손: games/hand3d.js(테스트룸 '새 살'을 옮긴 것)를 필요할 때 한 번 불러옴. 못 쓰면 위의 캔버스 손 그대로 */
function loadHand3D(){
  if(Ak3.h3||Ak3.h3load)return;Ak3.h3load=true;
  const go=()=>{try{if(window.Hand3D)Ak3.h3=window.Hand3D(THREE,{SR,SH})}catch(e){Ak3.h3=null;try{console.warn('3D 손 준비 실패',e)}catch(_){}}};
  if(window.Hand3D)return go();
  const sc=document.createElement('script');sc.src='games/hand3d.js';sc.onload=go;document.head.appendChild(sc);
}
/* 알 개수·색이 바뀌면 다시 만듦 */
function ak3Stones(){
  if(!Ak3.built||!OS)return;
  const key=OS.st.map(s=>OS.co[s.s]).join('');
  if(Ak3.sKey===key)return;
  Ak3.sKey=key;
  for(const m of [...Ak3.stones,...Ak3.rings,...Ak3.blobs])Ak3.root.remove(m);
  Ak3.stones=OS.st.map(s=>{const m=stoneMesh(OS.co[s.s]);Ak3.root.add(m);return m});
  Ak3.blobs=OS.st.map(()=>{const b=new THREE.Mesh(Ak3.blobGeo,new THREE.MeshBasicMaterial({color:0x1a120c,transparent:true,opacity:.28,depthWrite:false}));b.rotation.x=-Math.PI/2;b.renderOrder=2;Ak3.root.add(b);return b});
  Ak3.rings=OS.st.map(()=>{const r=new THREE.Mesh(Ak3.ringGeo,Ak3.ringM);r.rotation.x=-Math.PI/2;r.visible=false;r.renderOrder=3;Ak3.root.add(r);return r});
}
/* 카메라: 바로 위에서. 판과 판 둘레(떨어진 알이 놓이는 펠트 조금)가 판 자리(위 이름 칸 아래, 휴대폰은 내 정보 칸 위)에 꽉 차게. 내 쪽이 화면 아래 */
function ak3Layout(t){
  if(t-Ak3.layAt<100&&Ak3.lay)return false;
  Ak3.layAt=t;
  const st=$('#stage'),W=st.clientWidth,Hh=st.clientHeight;if(!W||!Hh||!V||!V.ak)return false;
  const sr=st.getBoundingClientRect(),bd=elAk.querySelector('.ak-bd').getBoundingClientRect();
  const base=[W,Hh].join(',');
  if(Ak3.topBase!==base){Ak3.topBase=base;Ak3.topMax=0}
  const top=Math.max(Math.round(bd.top-sr.top),Ak3.topMax);Ak3.topMax=top;
  const sd=sideOf(),key=base+','+top+','+sd;
  if(key===Ak3.lay)return false;
  Ak3.lay=key;
  const narrow=W<700,fy=top+2,fh=(narrow?Hh-70:Hh-40)-fy,fw=W-6;
  const s=Math.min(fw/(2*(BW+.08)),fh/(2*(BW+.45))),cam=Ak3.cam,f=Math.tan(cam.fov*Math.PI/360),d=(Hh/2)/(s*f);
  cam.aspect=W/Hh;cam.position.set(0,TOP+d,0);cam.up.set(0,0,-sd);cam.lookAt(0,TOP,0);
  cam.setViewOffset(W,Hh,0,-((fy+fh/2)-Hh/2),W,Hh);cam.updateProjectionMatrix();cam.updateMatrixWorld();
  Ak3.d=d;Ak3.dirty=true;
  return true;
}
/* 지금 그릴 알 자리: 연출 중이면 자취에서, 아니면 상태 그대로. 시작 연출 중이면 떨어지는 중 */
function curPos(now){
  if(!OS)return [];
  const base=OS.st.map(s=>({x:s.x,y:s.y,z:s.z,ax:0,az:0}));
  const S=Ak3.shot;
  if(S){
    const f=(now-S.t0)/1000*PHY.fps;
    for(const k in S.sh.tr){
      const tr=S.sh.tr[k],i=+k,f0=tr[0],m=(tr.length-1)/5,l=Math.max(0,Math.min(m-1,f-f0)),a=Math.floor(l),b=Math.min(m-1,a+1),w=l-a;
      if(!base[i])continue;
      const g=j=>tr[1+a*5+j]/1000*(1-w)+tr[1+b*5+j]/1000*w;
      base[i]={x:g(0),y:g(1),z:g(2),ax:g(3),az:g(4)};
    }
  }
  {const hi=heldIdx();if(hi!==Ak3.hi.cur){Ak3.hi={prev:Ak3.hi.cur,cur:hi,t0:now}}   // 집어 든 알: 놓기 전 자리 위로 떠오름 (내려놓으면 가라앉음)
   const k=ease((now-Ak3.hi.t0)/LIFT_MS),bob=.015*Math.sin(now/260);
   if(Ak3.hi.cur>=0&&base[Ak3.hi.cur])base[Ak3.hi.cur].y+=LIFT*k+bob*k;
   if(Ak3.hi.prev>=0&&base[Ak3.hi.prev]&&k<1&&OS.st[Ak3.hi.prev].u)base[Ak3.hi.prev].y+=LIFT*(1-k)}
  if(Ak3.pl)base.forEach((q,i)=>{const a=Ak3.pl[i];if(!a)return;const x=(now-a.t0)/PL_MS;   // 놓은 알: 놓기 전 자리에서 날아와 툭
    if(x>=1){Ak3.pl[i]=null;return}const k=ease(Math.max(0,x));q.x=a.x+(q.x-a.x)*k;q.z=a.z+(q.z-a.z)*k;q.y=a.y+(q.y-a.y)*k+Math.sin(Math.PI*Math.max(0,x))*.7});
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
  Ak3.stones.forEach((m,i)=>{
    const q=pos[i],s=OS.st[i],bl=Ak3.blobs[i];if(!q||!s){m.visible=false;if(bl)bl.visible=false;return}
    m.visible=!q.hide&&q.y>-1.2;
    m.position.set(q.x,q.y,q.z);m.rotation.set(-q.az,0,q.ax);m.scale.setScalar(stoneScale(q.y));
    if(bl){const gy=groundAt(q.x,q.z),h=Math.max(0,q.y-(gy+SH));bl.visible=m.visible&&gy>-50;
      if(bl.visible){bl.position.set(q.x+h*.5,gy+.004,q.z+h*.35);bl.scale.setScalar(1+h*.8);bl.material.opacity=.3/(1+h*5)}}   // 뜬 만큼 그림자가 옆으로 벌어지고 흐려짐
  });
  // 고리: 내 차례면 튕길 수 있는 내 알, 상대가 당기는 중이면 그 알 (내가 당기는 중에는 손이 보여 줌)
  const me=myIdx(),a=aimNow(now),pulse=.75+.25*Math.sin(now/260);
  Ak3.ringM.opacity=.9*pulse;
  Ak3.rings.forEach((r,i)=>{
    const s=OS.st[i],q=pos[i];
    const on=!!s&&!s.o&&V.st==='play'&&!Ak3.shot&&!FLK&&!introWait()&&(a?(!a.mine&&a.i===i):(myTurnNow()&&s.s===me));
    r.visible=on;if(on)r.position.set(q.x,TOP+.004,q.z);
  });
  // 놓기: 놓을 수 있는 반쪽과 미리 보기
  {const on=myPlaceNow(),me=myIdx(),sd=me===1?-1:1,pl=OS.ph==='place'&&V.st==='play'&&!introWait(),B=Ak3.bar;
   if(pl!==B.on){B.on=pl;B.t0=now}
   const k=ease((now-B.t0)/BAR_MS),bk=B.on?k:1-k;   // 놓기 단계가 되면 바리케이드가 판에서 솟고 빗금이 나타남, 끝나면 들어가며 사라짐
   gateStep(now,B);
   if(Ak3.half.visible){const m=Ak3.half.material.map;m.offset.x=(now/2600)%1}   // 빗금은 늘 한쪽으로 흘러감
   Ak3.half.visible=bk>.01&&me>=0&&me<2;if(Ak3.half.visible){Ak3.half.position.set(0,TOP+.003,-sd*(PITCH/2+Ak3.half.userData.h/2));Ak3.half.material.opacity=.32*bk}
   const gh=Ak3.ghost;gh.g.visible=on&&!!GH;
   if(gh.g.visible){const [x,z]=gridXZ(GH.c,GH.r);gh.g.position.set(x,TOP+SH,z);gh.mat.color.set(OS.co[me]===1?0x26262a:0xf4efe3)}}
  // 손
  const H3=Ak3.hand,hd=handNow(now,pos);
  Ak3.hd=hd;
  if(hd&&Ak3.h3){H3.g.visible=false;Ak3.root.updateMatrixWorld(true);Ak3.h3.set({x:hd.x,z:hd.z,ang:hd.ang,j:hd.j||0,p:hd.p,fl:hd.fl,seat:hd.seat,top:TOP,base:Ak3.root.matrixWorld})}
  else if(hd){
    if(Ak3.h3)Ak3.h3.set(null);
    const r=handCanvas(hd.p,hd.fl,hd.seat,hd.op);if(r.changed)H3.tex.needsUpdate=true;
    H3.g.visible=true;H3.g.position.set(hd.x,TOP+2*SH+.12,hd.z);H3.g.rotation.set(0,-hd.ang,0);
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
  {const k=gateTimes(Ak3.bar,t).cam;   // 놓기 동안: 내 쪽에서 비스듬히 (차단기가 서 있는 게 보이게), 끝나면 천천히 바로 위로
   if(k>.001&&!intro){const tc=Ak3.tcam||(Ak3.tcam=new THREE.PerspectiveCamera()),sd=sideOf(),th=GATE.tilt*k,d=Ak3.d*(1+.06*k);
     tc.position.set(0,TOP+d*Math.cos(th),sd*d*Math.sin(th));tc.up.set(0,0,-sd);tc.lookAt(0,TOP,0);
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
function gateStep(now,B){
  const g=Ak3.gate,T2=gateTimes(B,now),bar=Ak3.barG;
  bar.visible=T2.post>=0&&!(B.on&&T2.e<0);
  if(bar.visible)bar.position.y=TOP+(T2.post<=1?dropY(T2.post,1.6):1.8*ease(T2.post-2));
  if(B.on&&T2.post>=.68&&!B.thud){B.thud=1;tone(140,.12,{type:'triangle',vol:.16});hiss(.08,{freq:900,vol:.1})}
  if(!B.on)B.thud=0;
  for(const a of g.arms)a.rotation.z=T2.up*Math.PI/2;   // 1 = 서 있음, 0 = 가운데 줄 위로 내려옴
  const k=Math.floor(T2.e/GATE.bell);
  g.lampA.color.setHex(T2.bell&&k%2===0?0xff3b2a:0x5a1410);g.lampB.color.setHex(T2.bell&&k%2===1?0xff3b2a:0x5a1410);
  if(T2.bell&&k!==B.bk&&T2.e>=0){B.bk=k;tone(1480,.09,{type:'triangle',vol:.07});tone(1975,.07,{type:'sine',vol:.04,at:.01})}   // 땡
  return T2;
}
function heldIdx(){   // 지금 떠 있는 알: 내가 미리 보기를 골랐으면 내 다음 알, 아니면 방장이 알려 준 사람(상대·봇)의 다음 알
  if(!OS||OS.ph!=='place'||!V||V.st!=='play')return -1;
  const me=myIdx();if(me>=0&&me<2&&V.t===me)return GH?nextOf(me):-1;
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
  const n=OS.st.length,half=n/2,gap=Math.min(110,(IN.total-INTRO.drop-INTRO.dur-500)/Math.max(1,n));
  const order=[];for(let k=0;k<half;k++)order.push(k,k+half);
  const from=again&&Ak3.stones.length===n?Ak3.stones.map(m=>m.visible?{x:m.position.x,y:m.position.y,z:m.position.z}:{x:m.position.x*.5,y:2,z:m.position.z*.5}):null;
  IN.drop=[];order.forEach((i,k)=>{IN.drop[i]={t:(again?150:INTRO.drop)+k*(again?Math.min(60,gap):gap),dur:again?520:INTRO.dur,from:from&&from[i]}});
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
  const sayAt=IN.total-350;
  if(e>=sayAt&&!IN.said){
    IN.said=true;$('#stage').classList.remove('ak-intro');
    const A=V&&V.ak&&V.ak.A,p=V&&V.ps&&V.ps[A];
    if(p)say(A===myIdx()?'내가 흑으로 먼저 놓습니다.':`${p.n}님이 흑으로 먼저 놓습니다.`);
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
  // 새로 놓인 알: 놓기 전 자리에서 날아가게 (같은 판에서 바로 앞 상태를 본 경우만)
  if(pv&&pv.gid===OS.gid&&pv.st){Ak3.pl=Ak3.pl||[];OS.st.forEach((q,i)=>{const o=pv.st[i];if(o&&o[6]&&!q.u){Ak3.pl[i]={x:o[0],y:o[1]+(Ak3.hi.cur===i?LIFT:0),z:o[2],t0:clock()};if(Ak3.hi.cur===i)Ak3.hi={cur:-1,prev:-1,t0:0};Ak3.plSnd=Ak3.plSnd||{};Ak3.plSnd[i]=0}})}
  if(!myPlaceNow())GH=null;
  else if(GH&&!canPlace(OS,myIdx(),GH.c,GH.r))setGH(null);
  if(pv&&pv.ph==='place'&&OS.ph==='aim'&&V.st==='play'){say('알까기를 시작합니다.');sfx('turn')}
  // 한 번 더: 굴러가기가 끝나고 같은 사람 차례가 다시 오면
  if(pv&&pv.ph==='roll'&&OS.ph==='aim'&&V.st==='play'&&OS.sh&&V.t===OS.sh.by)say(V.t===myIdx()?'한 번 더':`${nm(V.t)} 한 번 더`);
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
G.me=(i)=>{
  $('#numpick').hidden=true;
  const p=V.ps[i];if(!p||!V.ak||!OS)return;
  if(p.f){if(!p.sr)$('#meSub').innerHTML=OS.res&&OS.res.w<0?'<b>무승부</b>입니다.':`<b>${+p.f}위</b>입니다.`;return}
  $('#meSub').innerHTML=`<b>${OS.co[i]===1?'흑':'백'}</b> · 남은 알 <b>${aliveS(i)}</b>개`;
};
G.specNote='관전 중입니다. 두 사람의 알까기를 지켜봅니다.';
G.overRank=p=>{
  const r=V&&V.ak&&V.ak.res,t=p.sr===3?'탈주':p.sr?'항복':r&&r.w<0?'무승부':'';
  return t?`<span class="left">${t}</span>`:'';
};
G.no3D=true;
G.buttons=()=>{
  $('#btnPass').hidden=true;$('#btnGura').hidden=true;$('#btnPlay').hidden=true;   // 누르는 버튼 없음: 알을 당겼다 놓아서 튕김
};
/* 매 프레임: 내 차례 남은 시간 (이름 칸·내 정보 칸), 2D 화면의 굴러가기 */
G.live=()=>{
  if(IN.on)introTick();
  if(!V||!V.ak||!OS)return;
  const t=clock(),run=V.st==='play'&&(OS.ph==='aim'||OS.ph==='place')&&!introWait()&&Number.isInteger(V.t);
  if(Ak3.pl)Ak3.pl.forEach((a,i)=>{if(a&&!Ak3.plSnd[i]&&t-a.t0>=PL_MS*.7){Ak3.plSnd[i]=1;sndTap(2.4)}});   // 놓은 알이 판에 툭
  const left=run?Math.max(0,V.deadAt-t):0,txt=run?String(Math.ceil(left/1000)):'';
  if(elBar)elBar.querySelectorAll('[data-ct]').forEach(el=>{const i=+el.dataset.ct,s=run&&V.t===i?txt:'';if(el.textContent!==s)el.textContent=s;
    const low=run&&V.t===i&&left<=10000;if(el.parentNode.classList.contains('low')!==low)el.parentNode.classList.toggle('low',low)});
  const me=myIdx();
  if(Ak3.shot){const k=aliveS(0)+','+aliveS(1);if(k!==Ak3.aliveK){Ak3.aliveK=k;drawAll();if(me>=0&&me<2)G.me(me)}}   // 재생 중 알이 떨어지는 순간 점·남은 알 수를 줄임
  else if(Ak3.aliveK){Ak3.aliveK='';if(me>=0&&me<2)G.me(me)}
  if(me>=0){const mt=$('#meTime'),s=run&&V.t===me?txt+'초':'';if(mt.textContent!==s)mt.textContent=s}
  if(!Ak3.on){
    if(Ak3.shot){shotSounds(t)}
    if(Ak3.shot||drag||FLK||(OS.aim&&OS.ph==='aim')||myTurnNow()||(Ak3.pl&&Ak3.pl.some(Boolean)))draw2D();
  }
};
G.play=()=>{};
G.pass=()=>{};
G.keyPhase=st=>st==='play';
G.onKey=()=>false;
G.field3D=()=>{if(T.stacks)for(const arr of T.stacks.values())arr.forEach(c=>{c.visible=false})};
G.render3D=t=>{if(Ak3.on)ak3Render(t);else if(T.ok&&!$('#stage').classList.contains('ak2d'))T.r.render(T.scene,T.cam)};
/* 대기실 홀로그램의 대표 말: 흑돌 하나와 그 위로 튀어 오르는 백돌 (공통 frontHoloPiece가 부름) */
G.holoPiece=(mk)=>{
  const g=new THREE.Group(),geo=new THREE.SphereGeometry(.2,24,14);
  const b=new THREE.Mesh(geo,mk(0x2a2a2a));b.scale.y=.42;b.position.set(-.1,-.12,0);g.add(b);
  const w=new THREE.Mesh(geo,mk(0xf6f3ea));w.scale.y=.42;w.position.set(.14,.12,-.04);w.rotation.z=.55;g.add(w);
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
.stage.ak .actions,.stage.ak .myplate,#ak .ak-row,#ak .ak-bar{transition:opacity .35s}
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
#ak .ak-bar{min-height:44px;display:flex;flex-wrap:wrap;gap:6px;align-self:flex-start;max-width:calc(100% - 188px);pointer-events:none}
#ak .ak-p{position:relative;display:flex;align-items:center;gap:6px;padding:4px 10px 5px;border-radius:12px;background:rgba(255,250,240,.92);border:1.5px solid var(--line-strong,#cdb391);font-size:13px;line-height:1.15;white-space:nowrap;max-width:100%}
#ak .dot{width:13px;height:13px;border-radius:50%;flex:none;display:inline-block}
#ak .dot.blk{background:#222;box-shadow:0 0 0 2px #fffaf0,0 0 0 3px #555}
#ak .dot.wht{background:#f7f2e8;box-shadow:0 0 0 2px #fffaf0,0 0 0 3px #8c7a5b}
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
@media (max-width:520px){#ak .ak-p{font-size:12px;padding:3px 8px 4px}#ak{padding-bottom:76px}#ak .pips{max-width:44px}}
`;
  document.head.appendChild(css);
  elAk=document.createElement('div');elAk.id='ak';elAk.hidden=true;
  elAk.innerHTML=`<div class="ak-bar"></div><div class="ak-row"><div class="ak-hint" aria-live="polite"></div></div><div class="ak-bd"><svg viewBox="${-VX} ${-VY} ${2*VX} ${2*VY}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="알까기 판"><defs><pattern id="akHatch" width=".23" height=".23" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width=".075" height=".23" fill="#d6281e"/><animateTransform attributeName="patternTransform" type="translate" from="0 0" to=".23 0" dur="2.6s" repeatCount="indefinite" additive="sum"/></pattern><pattern id="akBar" width=".15" height=".15" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width=".15" height=".15" fill="#f2c230"/><rect width=".075" height=".15" fill="#1d1b19"/></pattern></defs><g id="akB"></g><g id="akS"></g></svg></div>`;
  $('#stage').insertBefore(elAk,$('#fx'));
  elSvg=elAk.querySelector('svg');elMain=elSvg;elBar=elAk.querySelector('.ak-bar');elHint=elAk.querySelector('.ak-hint');
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
