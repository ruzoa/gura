/* 첫 차례 주사위: 모양·순서·자세를 계산하는 순수 함수 + THREE 주사위 만들기
   테스트룸(lab.html)과 게임이 같은 파일을 쓰면 테스트룸에서 맞춘 감각이 그대로 나옵니다.

   누가 먼저인지는 방장 엔진이 정함(균등하게). 주사위는 그 결과가 위로 오도록 맞춰 굴러가는 연출입니다.
   - 야추다이스 주사위와 같은 몸통(크림색·둥근 모서리·먹색 외곽선)에 면마다 자리 색 원 하나:
     2·3·6명은 6면체, 4·8명은 8면체(색마다 면 수가 같음).
     5명은 6면체, 7명은 8면체에 '다시 굴리기' 면(검은 원 + 빨간 ↻) 하나: 그 면이 나오면 한 번 더 굴립니다.
   - 방장이 던진 횟수(rolls)를 정해 신호(H.fp)로 보내고, 모두 같은 횟수·같은 씨앗으로 같은 굴림을 재생합니다.

   DicePick.plan(n, first, opt) → { N, sides, own, rolls, throws, landAt, total, at(e), poseAt(e), ... }
     n     : 자리 수 (2~8)
     first : 첫 차례 자리 (0 ~ n-1)
     opt   : { rolls, seed, dur, durAgain, pause, wait, fixed }  (ms)
   own[f]         : f번 면의 주인 자리 (-1 = 다시 굴리기 면)
   poseAt(e)      : e ms 시점의 주사위 자세 {x,y,z,q,s,throw,rest} (주사위 한 변 = 1인 단위, y=0이 바닥, 끝나면 null)
   at(e)          : e ms 시점에 불이 켜질 자리 (멈추기 전 -1, 멈춘 뒤 first)
   impacts        : [{t, v}] 바닥에 닿는 시각과 세기(소리용)
   landAt / total : 멈춘 시각 / 안내가 사라지는 시각 (= 연출 끝) */
(function(root){
  const DEF={dur:1800,durAgain:1300,pause:260,wait:1100,shrink:220};   // 첫 굴림 1.8초, 다시 굴림 1.3초(굴림 사이 0.26초 쉼), 멈춘 뒤 안내 1.1초
  const MAXR=12;   // 다시 굴리기가 연달아 나오는 최대 횟수 (확률이 (1/6)^11 이하라 공정성에 영향 없음)
  const SEAT_COL=['#c53026','#2b65ca','#1f7a2e','#c9831a','#7d3fa8','#12a3a3','#d9568f','#6b5a4a'];   // 자리 색: 앞 넷은 쿼리도·야추다이스의 PCOL과 같음
  const REROLL_COL='#33302d',BODY_COL='#fbf3e0',INK_COL='#4a3020';   // 몸통은 야추다이스 주사위 면과 같은 색, 먹색은 게임 공통 외곽선(GFX_INK)
  const R8=.68;   // 8면체 꼭짓점 거리 (6면체 한 변 = 1일 때 눈에 비슷한 크기)
  /* 모서리 둥글기(한 변 = 1 기준)와 원 반지름. 6면체 .132는 야추다이스 주사위(.095/.72)와 같음, 8면체는 꼭짓점이 뾰족해 한 변의 8%.
     원은 평평한 곳 안에 들어가게: 6면체 지름 = 한 변의 70%, 8면체 = 삼각형 내접원의 80%(면적 비율이 6면체와 비슷) */
  const LOOK={6:{r:.132,circle:.35},8:{r:.077,circle:.222}};
  const RING=.018;   // 원 테두리 두께

  const merge=opt=>{const o=Object.assign({},DEF);if(opt)for(const k in opt)if(opt[k]!==null&&opt[k]!==''&&Number.isFinite(+opt[k]))o[k]=+opt[k];return o};
  const clampN=n=>Math.max(2,Math.min(8,Math.round(+n)||2));
  const sidesFor=n=>{n=clampN(n);return n===4||n>6?8:6};
  /* 면 주인: 나누어떨어지면 자리 번호를 돌려 가며(이웃 면이 다른 색), 아니면 앞에서부터 한 면씩 + 남는 면은 다시 굴리기 */
  function owners(n){n=clampN(n);const s=sidesFor(n),o=[];for(let f=0;f<s;f++)o.push(s%n===0?f%n:f<n?f:-1);return o}
  /* 다시 굴리기 면이 있으면 그 면이 나올 확률 */
  const rerollP=n=>{n=clampN(n);const s=sidesFor(n);return s%n===0?0:(s-n)/s};
  /* 방장이 던질 횟수를 정함: 다시 굴리기 면이 나오는 동안 계속 (rnd는 0~1 난수, 테스트에서 고정 가능) */
  function pickRolls(n,rnd){const p=rerollP(n),r=rnd||Math.random;let k=1;while(k<MAXR&&r()<p)k++;return k}
  /* 던진 횟수(rolls)로 연출 길이 계산 (rolls<0: 방장이 직접 고른 선 → 굴리지 않고 안내만) */
  function totalFor(rolls,opt){
    const o=merge(opt);rolls=Math.round(+rolls);
    if(!(rolls>0))return o.wait;   // 방장이 직접 고름(-1) 또는 신호 없음
    return o.dur+(rolls-1)*(o.pause+o.durAgain)+o.wait;
  }

  /* ---- 아주 작은 사원수·벡터 (배열 [x,y,z,w]) ---- */
  const qMul=(a,b)=>[a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
  const qAxis=(ax,ang)=>{const s=Math.sin(ang/2);return [ax[0]*s,ax[1]*s,ax[2]*s,Math.cos(ang/2)]};
  const qRot=(q,v)=>{const x=v[0],y=v[1],z=v[2],qx=q[0],qy=q[1],qz=q[2],qw=q[3];
    const ix=qw*x+qy*z-qz*y,iy=qw*y+qz*x-qx*z,iz=qw*z+qx*y-qy*x,iw=-qx*x-qy*y-qz*z;
    return [ix*qw+iw*-qx+iy*-qz-iz*-qy,iy*qw+iw*-qy+iz*-qx-ix*-qz,iz*qw+iw*-qz+ix*-qy-iy*-qx]};
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const norm=v=>{const l=Math.hypot(v[0],v[1],v[2])||1;return [v[0]/l,v[1]/l,v[2]/l]};
  /* a를 b로 돌리는 가장 짧은 회전 */
  function qArc(a,b){
    const d=dot(a,b);
    if(d>.999999)return [0,0,0,1];
    if(d<-.999999){const h=Math.abs(a[0])<.9?[1,0,0]:[0,0,1],ax=norm(cross(a,h));return qAxis(ax,Math.PI)}
    const c=cross(a,b),q=[c[0],c[1],c[2],1+d],l=Math.hypot(q[0],q[1],q[2],q[3]);
    return [q[0]/l,q[1]/l,q[2]/l,q[3]/l];
  }

  /* ---- 주사위 모양: 꼭짓점과 면(꼭짓점 번호, 바깥 향하는 법선) ---- */
  const SHAPES={};
  function shape(sides){
    if(SHAPES[sides])return SHAPES[sides];
    let verts,faces;
    if(sides===6){
      verts=[];faces=[];
      for(let ax=0;ax<3;ax++)for(const s of [1,-1]){   // 면 순서: +x -x +y -y +z -z
        const u=(ax+1)%3,v=(ax+2)%3,n=[0,0,0];n[ax]=s;
        const quad=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>{const p=[0,0,0];p[ax]=s*.5;p[u]=a*.5;p[v]=b*.5;verts.push(p);return verts.length-1});
        faces.push({idx:quad,n});
      }
    }else{
      verts=[[R8,0,0],[-R8,0,0],[0,R8,0],[0,-R8,0],[0,0,R8],[0,0,-R8]];
      faces=[[0,2,4],[0,4,3],[0,3,5],[0,5,2],[1,2,5],[1,5,3],[1,3,4],[1,4,2]].map(idx=>{
        const c=[0,1,2].map(k=>(verts[idx[0]][k]+verts[idx[1]][k]+verts[idx[2]][k])/3);return {idx,n:norm(c)};
      });
    }
    /* 바깥에서 볼 때 반시계가 되게 꼭짓점 순서를 맞춤 */
    for(const f of faces){const p=f.idx.map(i=>verts[i]),a=p[0],b=p[1],c=p[2];
      const e1=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],e2=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
      if(dot(cross(e1,e2),f.n)<0)f.idx.reverse()}
    const faceR=sides===6?.5:R8/Math.sqrt(3);   // 면 중심까지 거리
    /* 둥근 모양 = 안쪽 작은 다면체(inner) + 반지름 r의 공. 면까지 거리는 그대로라 멈춘 높이가 변하지 않음 */
    const r=LOOK[sides].r,k=(faceR-r)/faceR,inner=verts.map(v=>[v[0]*k,v[1]*k,v[2]*k]);
    return SHAPES[sides]={sides,verts,faces,faceR,r,circle:LOOK[sides].circle,inner};
  }

  /* 자세 q에서 둥근 주사위의 가장 낮은 점(가운데 기준 y) */
  function lowY(S,q){let m=1e9;for(const v of S.inner)m=Math.min(m,qRot(q,v)[1]);return m-S.r}

  /* 평면 볼록 다각형 poly(바깥에서 반시계) 위에서 p와 가장 가까운 점 (p는 같은 평면 근처) */
  function closestOnPoly(p,poly,n){
    let inside=true,best=null,bd=1e9;
    for(let i=0;i<poly.length;i++){
      const a=poly[i],b=poly[(i+1)%poly.length],e=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],ap=[p[0]-a[0],p[1]-a[1],p[2]-a[2]];
      if(dot(cross(e,ap),n)<0)inside=false;
      const u=Math.max(0,Math.min(1,dot(ap,e)/dot(e,e))),c=[a[0]+e[0]*u,a[1]+e[1]*u,a[2]+e[2]*u],d=Math.hypot(p[0]-c[0],p[1]-c[1],p[2]-c[2]);
      if(d<bd){bd=d;best=c}
    }
    if(!inside)return best;
    const h=dot([p[0]-poly[0][0],p[1]-poly[0][1],p[2]-poly[0][2]],n);
    return [p[0]-n[0]*h,p[1]-n[1]*h,p[2]-n[2]*h];
  }
  /* 둥근 다면체 몸통: 면을 잘게 나눈 점을 안쪽 면에서 반지름 r만큼 띄움 */
  function roundedBody(S,seg){
    const pos=[],nor=[];
    const put=(p,f,poly)=>{
      const c=closestOnPoly(p,poly,f.n),d=[p[0]-c[0],p[1]-c[1],p[2]-c[2]],l=Math.hypot(d[0],d[1],d[2]),m=l<1e-9?f.n:[d[0]/l,d[1]/l,d[2]/l];
      pos.push(c[0]+m[0]*S.r,c[1]+m[1]*S.r,c[2]+m[2]*S.r);nor.push(m[0],m[1],m[2]);
    };
    const at=(a,b,c,i,j)=>{const u=i/seg,v=j/seg,w=1-u-v;return [0,1,2].map(k=>a[k]*w+b[k]*u+c[k]*v)};
    for(const f of S.faces){
      const P=f.idx.map(i=>S.verts[i]),poly=f.idx.map(i=>S.inner[i]);
      for(let t=1;t<P.length-1;t++){
        const a=P[0],b=P[t],c=P[t+1];
        for(let i=0;i<seg;i++)for(let j=0;j<seg-i;j++){
          put(at(a,b,c,i,j),f,poly);put(at(a,b,c,i+1,j),f,poly);put(at(a,b,c,i,j+1),f,poly);
          if(i+j<seg-1){put(at(a,b,c,i+1,j),f,poly);put(at(a,b,c,i+1,j+1),f,poly);put(at(a,b,c,i,j+1),f,poly)}
        }
      }
    }
    return {pos,nor};
  }

  function rng32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

  /* 굴림 한 번의 높이 계산표: [종류, 길이 비율, 높이, 소리 세기]
     fall: 위에서 떨어져 처음 닿음, toss: 바닥에서 던져 올림, hop: 튕김 */
  const CHAIN_FIRST=[['fall',.40,3.4,1],['hop',.26,.95,.6],['hop',.15,.32,.3],['hop',.08,.09,.12]];
  const CHAIN_AGAIN=[['toss',.46,2.1,.8],['hop',.22,.55,.4],['hop',.12,.18,.2],['hop',.07,.05,.1]];

  function plan(n,first,opt){
    const o=merge(opt),N=clampN(n),sides=sidesFor(N),own=owners(N),S=shape(sides),f0=((Math.round(first)||0)%N+N)%N;
    const base={N,sides,own,first:f0,shape:S,impacts:[],throws:[]};
    if(o.fixed)return Object.assign(base,{fixed:true,rolls:0,landAt:0,total:o.wait,at:()=>f0,poseAt:()=>null});   // 방장이 직접 고른 선: 굴리지 않음
    const reroll=own.indexOf(-1),mine=[];own.forEach((s,i)=>{if(s===f0)mine.push(i)});
    const rolls=reroll<0?1:Math.max(1,Math.min(MAXR,Math.round(+o.rolls)||1));
    const seed=(Math.round(+o.seed)||1)>>>0;
    const ups=[0,1,0];
    let t=0,prev=null;
    const th=[],impacts=[];
    for(let k=0;k<rolls;k++){
      const rnd=rng32(seed*7919+k*104729+N*131+f0*17+1),last=k===rolls-1;
      const face=last?mine[(rnd()*mine.length)|0]:reroll,dur=k?o.durAgain:o.dur;
      const p0=k===0?[(rnd()<.5?-1:1)*(1.5+rnd()*1.1),-(1.9+rnd()*.8)]:prev.p1;
      const p1=[(rnd()-.5)*1.0,(rnd()-.5)*.8];
      const ax=norm([rnd()-.5,(rnd()-.5)*.6,rnd()-.5]),theta=Math.PI*(5.5+rnd()*2.5);
      const qEnd=qMul(qAxis(ups,rnd()*Math.PI*2),qArc(S.faces[face].n,ups));
      const minY=lowY(S,qEnd);
      const chain=k?CHAIN_AGAIN:CHAIN_FIRST,segs=[];let c=0;
      for(const [type,fr,h,v] of chain){segs.push({type,a:c*dur,b:(c+fr)*dur,h,v});c+=fr;impacts.push({t:t+(c)*dur,v})}
      const T={t0:t,dur,face,seat:own[face],p0,p1,ax,theta,qEnd,restY:-minY,tStop:.9*dur,segs};
      th.push(T);prev=T;t+=dur+(last?0:o.pause);
    }
    const landAt=t,total=landAt+o.wait;
    const flat=T=>({x:T.p1[0],y:T.restY,z:T.p1[1],q:T.qEnd,s:1,throw:th.indexOf(T),rest:true});
    function poseAt(e){
      if(e<0||e>=total)return null;
      let k=th.length-1;while(k>0&&e<th[k].t0)k--;
      const T=th[k],tt=e-T.t0;let p;
      if(tt>=T.dur)p=flat(T);
      else{
        const u=Math.min(1,tt/T.tStop),pm=1-Math.pow(1-u,3),sp=(1-u)*(1-u);
        const q=qMul(qAxis(T.ax,T.theta*sp),T.qEnd);
        let h=0;
        for(const g of T.segs){if(tt<g.a||tt>=g.b)continue;const x=(tt-g.a)/(g.b-g.a);h=g.type==='fall'?g.h*(1-x*x):4*g.h*x*(1-x);break}
        const mn=lowY(S,q);
        p={x:T.p0[0]+(T.p1[0]-T.p0[0])*pm,y:h-mn,z:T.p0[1]+(T.p1[1]-T.p0[1])*pm,q,s:1,throw:k,rest:false};
      }
      const sl=total-e;if(sl<o.shrink){const x=sl/o.shrink;p.s=x*x*(3-2*x)}   // 끝나기 직전 작아지며 사라짐
      return p;
    }
    return Object.assign(base,{fixed:false,rolls,throws:th,impacts,landAt,total,at:e=>e>=landAt?f0:-1,poseAt,opt:o});
  }
  /* 신호(rolls)로 계획 만들기: 음수(-1)는 방장이 직접 고른 선(고정), 없으면 한 번 */
  const planFor=(n,first,rolls,seed)=>plan(n,first,rolls<0?{fixed:1}:{rolls:rolls||1,seed});

  /* ---- THREE 주사위 만들기 (한 변 1인 크기로 만들고 apply에서 키움) ----
     colors: 자리 번호 → 색(문자열·숫자). 게임 안에서는 공통 toon 재질과 외곽선을 쓰고, 테스트룸처럼 없으면 기본 재질 */
  function mesh(THREE,n,colors){
    const N=clampN(n),sides=sidesFor(N),own=owners(N),S=shape(sides);
    const mat=(color,flat)=>{
      const m=typeof toon==='function'?toon({color,rim:flat?0:.12}):new THREE.MeshLambertMaterial({color});
      if(flat){m.polygonOffset=true;m.polygonOffsetFactor=-2;m.polygonOffsetUnits=-2}
      return m;
    };
    const num=c=>new THREE.Color(c).getHex();
    const body=roundedBody(S,16),geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(body.pos,3));
    geo.setAttribute('normal',new THREE.Float32BufferAttribute(body.nor,3));
    const bodyM=mat(num(BODY_COL)),m=new THREE.Mesh(geo,bodyM);m.castShadow=true;
    const inkM=new THREE.MeshBasicMaterial({color:typeof GFX_INK==='number'?GFX_INK:num(INK_COL),side:THREE.BackSide}),hull=new THREE.Mesh(geo,inkM);
    hull.scale.setScalar(1.075);   // 야추다이스 주사위와 같은 외곽선
    const g=new THREE.Group();g.add(m,hull);g.visible=false;
    const own_=[geo,bodyM,inkM];
    /* 면마다 원 하나: 크림 면 위에 얇은 먹색 테두리 + 자리 색 원 (같은 높이에서 겹치지 않음) */
    const cg=new THREE.CircleGeometry(S.circle-RING,48),rg=new THREE.RingGeometry(S.circle-RING,S.circle,48,1),ringM=mat(num(INK_COL),true),faceM={};
    own_.push(cg,rg,ringM);
    const onFace=(o,f,h)=>{const q=qArc([0,0,1],f.n);o.quaternion.set(q[0],q[1],q[2],q[3]);o.position.set(f.n[0]*(S.faceR+h),f.n[1]*(S.faceR+h),f.n[2]*(S.faceR+h));g.add(o)};
    S.faces.forEach((f,fi)=>{
      const c=own[fi]<0?REROLL_COL:colors[own[fi]%colors.length],key=num(c);
      if(!faceM[key]){faceM[key]=mat(key,true);own_.push(faceM[key])}
      onFace(new THREE.Mesh(cg,faceM[key]),f,.003);onFace(new THREE.Mesh(rg,ringM),f,.003);
    });
    const rf=own.indexOf(-1);
    if(rf>=0){   // 다시 굴리기 면: 검은 원 안에 빨간 ↻
      const cv=document.createElement('canvas');cv.width=cv.height=128;const c=cv.getContext('2d');
      c.strokeStyle='#e2362b';c.fillStyle='#e2362b';c.lineWidth=15;c.lineCap='round';
      c.beginPath();c.arc(64,64,36,-Math.PI*.15,Math.PI*1.55);c.stroke();
      c.beginPath();c.moveTo(64+36*Math.cos(-Math.PI*.15)+24,64+36*Math.sin(-Math.PI*.15)-4);c.lineTo(64+36*Math.cos(-Math.PI*.15)-18,64+36*Math.sin(-Math.PI*.15)-20);c.lineTo(64+36*Math.cos(-Math.PI*.15)-6,64+36*Math.sin(-Math.PI*.15)+24);c.closePath();c.fill();
      const tx=new THREE.CanvasTexture(cv),w=S.circle*1.7;
      const dm=new THREE.MeshBasicMaterial({map:tx,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4});
      const dg=new THREE.PlaneGeometry(w,w);onFace(new THREE.Mesh(dg,dm),S.faces[rf],.005);
      own_.push(tx,dm,dg);
    }
    return {
      g,
      /* 자세를 적용: size = 한 변의 실제 크기, (cx,gy,cz) = 바닥 가운데. pose가 null이면 숨김 */
      apply(p,size,cx,gy,cz){
        if(!p){g.visible=false;return}
        g.visible=true;g.position.set(cx+p.x*size,gy+p.y*size,cz+p.z*size);g.quaternion.set(p.q[0],p.q[1],p.q[2],p.q[3]);g.scale.setScalar(size*p.s);
      },
      dispose(){if(g.parent)g.parent.remove(g);own_.forEach(o=>o&&o.dispose&&o.dispose())}
    };
  }

  const api={DEF,SEAT_COL,REROLL_COL,MAXR,merge,sidesFor,owners,rerollP,pickRolls,totalFor,shape,plan,planFor,mesh,math:{qMul,qAxis,qRot,qArc}};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DicePick=api;
})(typeof window!=='undefined'?window:globalThis);
