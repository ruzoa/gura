/* 첫 차례 주사위: 모양·순서·자세를 계산하는 순수 함수 + THREE 주사위 만들기
   테스트룸(lab.html)과 게임이 같은 파일을 쓰면 테스트룸에서 맞춘 감각이 그대로 나옵니다.

   누가 먼저인지는 방장 엔진이 정함(균등하게). 주사위는 그 결과가 위로 오도록 맞춰 굴러가는 연출입니다.
   - 면마다 자리 색: 2·3·6명은 6면체, 4·8명은 8면체(색마다 면 수가 같음).
     5명은 6면체, 7명은 8면체에 '다시 굴리기' 면(검은 면 + 빨간 ↻) 하나: 그 면이 나오면 한 번 더 굴립니다.
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
  const REROLL_COL='#33302d';
  const R8=.68;   // 8면체 꼭짓점 거리 (6면체 한 변 = 1일 때 눈에 비슷한 크기)

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
    return SHAPES[sides]={sides,verts,faces,faceR};
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
      let minY=1e9;for(const v of S.verts)minY=Math.min(minY,qRot(qEnd,v)[1]);
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
        let mn=1e9;for(const v of S.verts)mn=Math.min(mn,qRot(q,v)[1]);
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
     colors: 자리 번호 → 색(문자열·숫자). 다시 굴리기 면은 검정 + 빨간 ↻ */
  function mesh(THREE,n,colors){
    const N=clampN(n),sides=sidesFor(N),own=owners(N),S=shape(sides);
    const pos=[],nor=[],col=[],tmp=new THREE.Color();
    S.faces.forEach((f,fi)=>{
      tmp.set(own[fi]<0?REROLL_COL:colors[own[fi]%colors.length]);
      const tri=f.idx.length===4?[[0,1,2],[0,2,3]]:[[0,1,2]];
      for(const t of tri)for(const k of t){const p=S.verts[f.idx[k]];pos.push(p[0],p[1],p[2]);nor.push(f.n[0],f.n[1],f.n[2]);col.push(tmp.r,tmp.g,tmp.b)}
    });
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    geo.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));
    geo.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
    const m=new THREE.Mesh(geo,new THREE.MeshLambertMaterial({vertexColors:true}));m.castShadow=true;
    const edges=new THREE.LineSegments(new THREE.EdgesGeometry(geo,1),new THREE.LineBasicMaterial({color:0x2a211b}));
    const g=new THREE.Group();g.add(m,edges);g.visible=false;
    const own_=[geo,m.material,edges.geometry,edges.material];
    const rf=own.indexOf(-1);
    if(rf>=0){   // 다시 굴리기 면: 빨간 ↻ 그림
      const cv=document.createElement('canvas');cv.width=cv.height=128;const c=cv.getContext('2d');
      c.strokeStyle='#e2362b';c.fillStyle='#e2362b';c.lineWidth=15;c.lineCap='round';
      c.beginPath();c.arc(64,64,36,-Math.PI*.15,Math.PI*1.55);c.stroke();
      c.beginPath();c.moveTo(64+36*Math.cos(-Math.PI*.15)+24,64+36*Math.sin(-Math.PI*.15)-4);c.lineTo(64+36*Math.cos(-Math.PI*.15)-18,64+36*Math.sin(-Math.PI*.15)-20);c.lineTo(64+36*Math.cos(-Math.PI*.15)-6,64+36*Math.sin(-Math.PI*.15)+24);c.closePath();c.fill();
      const tx=new THREE.CanvasTexture(cv),w=sides===6?.62:.5;
      const dm=new THREE.MeshBasicMaterial({map:tx,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
      const dg=new THREE.PlaneGeometry(w,w),d=new THREE.Mesh(dg,dm),n=S.faces[rf].n,q=qArc([0,0,1],n);
      d.quaternion.set(q[0],q[1],q[2],q[3]);d.position.set(n[0]*(S.faceR+.004),n[1]*(S.faceR+.004),n[2]*(S.faceR+.004));g.add(d);
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
