/* index.html 공통 코드 · 아바타(의자 위 나무 인형): 나무 말·동물·오뚝이 + 장식 + 색칠. 파일 순서는 index.html의 <script src> 순서 */
/* ===== 아바타 =====
   사람 자리의 의자 위에 앉는 나무 인형. 봇은 통나무(front.js frontBuildBot), 사람은 칠한 나무 인형.
   · 값: 'k-a-c-h' 글자 (k 종류 0 나무 말·1 동물·2 오뚝이, a 동물, c 바탕색 번호, h 장식). 칠한 그림이 있으면 '-p그림번호', 바꾸는 중이면 끝에 '-e'
   · 저장: gura-avatar (모양), gura-avatar-paint (칠한 그림 PNG). 처음에는 무작위로 정해 저장
   · 전달: 참가자는 hello에 실어 보내고(net.js), 방장은 자기 값을 members/players에 적음(avHostSync) → snapFor가 ps[].av로 모두에게.
     칠한 그림은 상태에 싣지 않고 바뀔 때 한 번만 {t:'avp',id,d}로 보냄(방장이 받아 모두에게 돌리고, 새로 온 사람에게는 지금 쓰는 그림을 모아 보냄). 받은 쪽은 번호로 기억(AVP)
   · 남이 칠한 그림은 비공개 탁자에서만 보임(공개 탁자는 모양·바탕색·장식만)
   · 내 화면에서는 내 인형을 그리지 않음(앉은 눈이 인형 자리). 아바타를 바꿀 때만 보임
   · 아바타 변경: 내 이름표 메뉴 → 카메라가 같은 각도로 내 의자 쪽으로 내려오고(돌지 않음) 인형이 돌아앉아 나를 봄. 다른 사람 화면에서도 돌아앉아 있음
   · 그리기: 인형 하나는 몸(그림 한 장) + 먹선 껍질, 두 번만 그림. 그림 한 장(256×256) = 위 절반 머리 · 그 아래 몸통 · 맨 아래 줄 단색 칸(귀·꼬리·장식처럼 칠하지 않는 부품)
   · 크기: 의자 위에서 AV_K배. 탁자 윗면(의자 위 1.25) 위로 가슴까지 보임 */
const AV_KIND=['나무 말','동물','오뚝이'],AV_ANI=['토끼','곰','고양이','여우','개','쥐','돼지','병아리','개구리'],AV_HAT=['없음','밀짚모자','고깔','목도리','안경'];
const AV_COL=['#e4573d','#f2994a','#f2c14e','#6fbf5f','#3fa7a0','#4a7fd4','#8c62c9','#e58fb1','#b9824f','#f6ecd8','#9aa0a8','#2a2420'];
const AV_CELL=[null,'#fff8ea','#2a2420','#f2c14e','#e8c36a','#d9483b','#3f8f6b','#f3a7b5','#f2994a','#ffe2c4','#f5c542'];   // 단색 칸: 0 바탕색, 1 크림, 2 먹, 3 노랑, 4 밀짚, 5 빨강, 6 목도리, 7 분홍, 8 주황, 9 살구, 10 금
const AV_RE=/^([0-2])-(\d{1,2})-(\d{1,2})(?:-(\d{1,2}))?(?:-p([0-9a-z]{4,8}))?(-e)?$/;
const AV_K=1.3,AV_TW=256,AV_HEAD_H=128,AV_BODY_H=112,AV_PMAX=56000;
const AV={edit:false,spin:0,mine:null,geo:{},tex:{},ink:null,drag:null,stroke:null,tab:0,tool:'fill',bc:11,paint:null,hasPaint:false,dirty:false,pid:'',pdata:'',myTex:null,myKey:'',myDoll:null,sent:null,hostPid:null,ver:0};
const AVP={};   // 받은 그림: 번호 → {d 데이터, cv 캔버스(풀리면)}
function avParse(s){const m=AV_RE.exec(typeof s==='string'?s:'');return m?{k:+m[1],a:Math.min(AV_ANI.length-1,+m[2]),c:Math.min(AV_COL.length-1,+m[3]),h:Math.min(AV_HAT.length-1,+(m[4]||0)),p:m[5]||'',e:!!m[6]}:null}
function avHash(s){let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return (h>>>0).toString(36).padStart(7,'0').slice(-7)}
function avMine(){
  if(AV.mine)return AV.mine;
  let v=avParse(store('gura-avatar'));
  if(!v){v={k:Math.random()*3|0,a:Math.random()*4|0,c:Math.random()*10|0,h:0};avSave(v)}
  AV.mine=v;
  const d=store('gura-avatar-paint');
  if(d&&d.length<=AV_PMAX&&d.startsWith('data:image/png;base64,')){AV.pdata=d;AV.pid=avHash(d);AV.hasPaint=true;avpPut(AV.pid,d);const im=new Image();im.onload=()=>{avPaintCv().getContext('2d').drawImage(im,0,0,AV_TW,AV_TW);AV.ver++};im.src=d}
  return v;
}
function avSave(v){store('gura-avatar',`${v.k}-${v.a}-${v.c}-${v.h}`)}
function myAvStr(){const v=avMine();return `${v.k}-${v.a}-${v.c}-${v.h}${AV.pid?'-p'+AV.pid:''}${AV.edit?'-e':''}`}
/* 내 값을 모두에게: 방장은 자기 자리에 적고, 참가자는 대기실에서 hello를 다시 보냄(닉네임 바꾸기와 같은 길) */
function avHostSync(){
  if(mode!=='host'||!H)return;const s=myAvStr();let ch=false;
  for(const L of [H.members,H.players]){const m=L&&L.find(x=>x.host);if(m&&m.av!==s){m.av=s;ch=true}}
  if(AV.hostPid!==AV.pid){AV.hostPid=AV.pid;if(AV.pid)for(const c of net.conns){if(c.open)try{c.send({t:'avp',id:AV.pid,d:AV.pdata})}catch(e){}}}
  if(ch)mark();
}
function avPush(){if(mode==='host')avHostSync();else if(mode==='guest'&&net.conn&&net.conn.open&&V&&V.st==='wait')guestHello(net.conn)}
/* ---- 칠한 그림 주고받기 ---- */
function avpPut(id,d){
  if(typeof id!=='string'||typeof d!=='string'||d.length>AV_PMAX||!d.startsWith('data:image/png;base64,')||avHash(d)!==id)return false;
  if(AVP[id])return true;
  const ks=Object.keys(AVP);if(ks.length>=40)delete AVP[ks[0]];
  const e=AVP[id]={d,cv:null},im=new Image();
  im.onload=()=>{const c=document.createElement('canvas');c.width=c.height=AV_TW;c.getContext('2d').drawImage(im,0,0,AV_TW,AV_TW);e.cv=c;AV.ver++};im.src=d;return true;
}
function avpSendMine(conn){if(!AV.pid||!AV.pdata||(AV.sent&&AV.sent.c===conn&&AV.sent.id===AV.pid))return;try{conn.send({t:'avp',id:AV.pid,d:AV.pdata});AV.sent={c:conn,id:AV.pid}}catch(e){}}   // 참가자: hello 뒤에 내 그림 (같은 연결에 같은 그림은 한 번만)
function avpHostGot(conn,d){   // 방장: 받은 그림을 기억하고 다른 사람들에게 돌림
  if(mode!=='host'||!H||!d||AVP[d.id]||!avpPut(d.id,d.d))return;
  for(const c of net.conns){if(c!==conn&&c.open)try{c.send({t:'avp',id:d.id,d:d.d})}catch(e){}}
}
function avpSendAll(conn){   // 방장: 새로 온 사람에게 지금 쓰는 그림을 모아 보냄
  if(mode!=='host'||!H)return;const ids=new Set();
  for(const L of [H.members,H.players])for(const m of L||[]){const v=avParse(m.av);if(v&&v.p)ids.add(v.p)}
  for(const id of ids){const e=AVP[id];if(e&&(!conn.__avp||!conn.__avp.has(id))){(conn.__avp=conn.__avp||new Set()).add(id);try{conn.send({t:'avp',id,d:e.d})}catch(er){}}}
}

/* ---- 모양 만들기: 부품들을 인형 좌표로 옮겨 한 덩어리로 합침 (몸 + 같은 두께의 먹선 껍질) ----
   uv: 'head'·'body'는 그림의 그 칸에 펴고(색칠됨), 숫자는 단색 칸 번호(색칠 안 됨) */
const AV_INK_W=.022;
function avBake(parts){
  const pos=[],nor=[],uvs=[],idx=[],hp=[],v=new THREE.Vector3(),n=new THREE.Vector3(),nm=new THREE.Matrix3();let base=0;
  const v0=16/AV_TW,vb=AV_BODY_H/AV_TW;
  for(const p of parts){
    const g=p.g,P=g.attributes.position,N=g.attributes.normal,U=g.attributes.uv,m=p.m||new THREE.Matrix4();nm.getNormalMatrix(m);
    const w=p.w!=null?p.w:AV_INK_W,loc=[],map=new Map();
    for(let i=0;i<P.count;i++){
      v.fromBufferAttribute(P,i).applyMatrix4(m);n.fromBufferAttribute(N,i).applyMatrix3(nm).normalize();
      pos.push(v.x,v.y,v.z);nor.push(n.x,n.y,n.z);
      if(p.uv==='head')uvs.push(U.getX(i),.5+U.getY(i)*.5);else if(p.uv==='body')uvs.push(U.getX(i),v0+U.getY(i)*vb);else uvs.push((p.uv*16+8)/AV_TW,8/AV_TW);
      const key=Math.round(v.x*500)+','+Math.round(v.y*500)+','+Math.round(v.z*500);loc.push(key,v.x,v.y,v.z);
      const a=map.get(key)||[0,0,0];a[0]+=n.x;a[1]+=n.y;a[2]+=n.z;map.set(key,a);   // 같은 자리 꼭짓점은 방향을 평균: 모서리에서 껍질이 벌어지지 않게
    }
    for(let i=0;i<P.count;i++){const a=map.get(loc[i*4]),l=Math.hypot(a[0],a[1],a[2])||1;hp.push(loc[i*4+1]+a[0]/l*w,loc[i*4+2]+a[1]/l*w,loc[i*4+3]+a[2]/l*w)}
    if(g.index)for(let i=0;i<g.index.count;i++)idx.push(base+g.index.getX(i));else for(let i=0;i<P.count;i++)idx.push(base+i);
    base+=P.count;
  }
  const mk=(p,full)=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
    if(full){g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2))}g.setIndex(idx);return g};
  return {body:mk(pos,true),hull:mk(hp,false)};
}
/* 왕관 부품(우승자): 띠 + 뾰족한 끝 다섯 + 끝의 구슬. 사람 인형은 머리 위(모자·고깔 대신), 봇은 통나무 위 */
function avCrownParts(R,m,uv){
  const P=[],L=pts=>new THREE.LatheGeometry(pts.map(p=>new THREE.Vector2(p[0],p[1])),20),at=(x,y,z)=>new THREE.Matrix4().multiplyMatrices(m,new THREE.Matrix4().makeTranslation(x,y,z));
  P.push({g:L([[R-.04,0],[R,0],[R*1.05,.12],[R*1.05-.04,.12]]),uv,m,w:.014});
  for(let i=0;i<5;i++){const a=i/5*Math.PI*2+Math.PI/2,r=R*1.05-.02,x=Math.cos(a)*r,z=Math.sin(a)*r;
    P.push({g:new THREE.ConeGeometry(.05,.13,8),uv,m:at(x,.17,z),w:.012});P.push({g:new THREE.SphereGeometry(.03,8,6),uv,m:at(x,.25,z),w:.01})}
  return P;
}
function avGeo(k,a,h,cr){
  if(cr&&(h===1||h===2))h=0;   // 왕관을 쓰면 모자·고깔은 벗음 (목도리·안경은 그대로)
  const key=k+'-'+(k===1?a:0)+'-'+h+(cr?'c':'');if(AV.geo[key])return AV.geo[key];
  const parts=[],PI=Math.PI,CR=1,DK=2,YL=3,ST=4,RD=5,SC=6,PK=7,OR=8;
  const lathe=(pts,seg)=>new THREE.LatheGeometry(pts.map(p=>new THREE.Vector2(p[0],p[1])),seg||28);
  const sph=(r,a2,b2)=>new THREE.SphereGeometry(r,a2||16,b2||12);
  const len=pts=>pts.slice(1).reduce((s,p,i)=>s+Math.hypot(p[0]-pts[i][0],p[1]-pts[i][1]),0);
  const M=(x,y,z,sx,sy,sz,rx,ry,rz)=>new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(rx||0,ry||0,rz||0)),new THREE.Vector3(sx==null?1:sx,sy==null?1:sy,sz==null?1:sz));
  const add=(g,uv,m,w)=>parts.push({g,uv,m,w});
  const eyeAt=(hd,s)=>new THREE.Vector3(s*hd.ex,hd.eu,1).normalize().multiplyScalar(hd.r*.97);
  const eyes=hd=>{for(const s of[-1,1]){const d=eyeAt(hd,s);add(sph(.036,10,8),DK,M(d.x,hd.y+d.y,d.z,1,1.15,.6),0)}};
  const tri=(r,hh)=>lathe([[0,-hh*.5],[r,-hh*.5],[r*.96,-hh*.38],[r*.62,hh*.08],[r*.26,hh*.4],[r*.1,hh*.48],[0,hh*.5]],16);
  // 회전체·구 모두 그림 가운데(u=0.5)가 앞(+z)을 보게 돌림: 앞쪽이 이음매에 걸리지 않게
  let hd,reg;
  if(k===0){   // 나무 말: 원뿔 몸통 + 둥근 머리
    const bp=[[0,0],[.34,0],[.37,.05],[.36,.1],[.2,.96],[.17,1.12]];
    add(lathe(bp),'body',M(0,0,0,1,1,1,0,PI));add(sph(.26,24,16),'head',M(0,1.32,0,1,1,1,0,-PI/2));
    hd={y:1.32,r:.26,ny:1.08,nr:.19,ex:.38,eu:.05};reg={head:[AV_TW/(2*PI*.26),AV_HEAD_H/(PI*.26)],body:[AV_TW/(2*PI*.28),AV_BODY_H/len(bp)]};
  }else if(k===1){   // 동물 나무 인형: 몸통은 같고 귀·주둥이·꼬리만 다름
    const hr=.32,hy=1.31,bp=[[0,0],[.3,0],[.37,.05],[.39,.14],[.38,.48],[.31,.83],[.22,1.02],[.19,1.09]];
    add(lathe(bp),'body',M(0,0,0,1,1,1,0,PI));add(sph(hr,24,16),'head',M(0,hy,0,1,1,1,0,-PI/2));
    hd={y:hy,r:hr,ny:1.07,nr:.21,ex:.4,eu:.12};reg={head:[AV_TW/(2*PI*hr),AV_HEAD_H/(PI*hr)],body:[AV_TW/(2*PI*.34),AV_BODY_H/len(bp)]};
    const snout=(r,sx,sy,sz,z,c)=>add(sph(r,16,12),c||CR,M(0,hy-.075,z,sx,sy,sz),.014),nose=(z,r,c,y)=>add(sph(r||.036,10,8),c||DK,M(0,hy+(y||-.045),z,1.2,.85,.8),0);
    if(a!==8)eyes(hd);
    if(a===0){   // 토끼: 길쭉한 귀, 동그란 꼬리
      snout(.1,1.25,.82,.7,hr-.05);nose(hr+.022);
      for(const s of[-1,1])add(lathe([[0,-.26],[.07,-.26],[.085,-.1],[.09,.08],[.075,.2],[.04,.25],[0,.26]],16),0,M(s*.14,hy+.5,0,1,1,.55,0,0,-s*.14));
      add(sph(.1),CR,M(0,.26,-.38));
    }else if(a===1){   // 곰: 둥근 귀
      snout(.1,1.25,.82,.7,hr-.05);nose(hr+.022);
      for(const s of[-1,1])add(sph(.115),0,M(s*.235,hy+.235,0,1,1,.55));
    }else if(a===2){   // 고양이: 짧고 넓게 벌어진 귀, 짧은 주둥이, 가늘게 선 꼬리
      snout(.08,1.25,.75,.55,hr-.035);nose(hr+.012,.028,PK);
      for(const s of[-1,1])add(tri(.15,.2),0,M(s*.215,hy+.25,0,1,1,.5,0,0,-s*.5));
      add(lathe([[0,-.32],[.04,-.3],[.055,0],[.05,.26],[0,.32]],12),0,M(.14,.5,-.42,1,1,1,-.22,0,-.2));
    }else if(a===3){   // 여우: 길고 좁은 귀(끝이 검음), 길게 나온 주둥이, 굵은 꼬리(끝이 흼)
      snout(.1,1,.72,1.5,hr+.02);nose(hr+.165,.034,DK,-.06);
      for(const s of[-1,1]){const em=M(s*.17,hy+.39,0,1,1,.5,0,0,-s*.14);
        add(lathe([[0,-.21],[.1,-.21],[.096,-.16],[.07,.02],[.045,.1]],16),0,em);add(lathe([[.045,.1],[.026,.168],[.01,.2],[0,.21]],16),DK,em)}
      const L=.56,r=.13,tm=M(.2,.3,-.34,1,1,1,-.75,0,-.35);
      add(lathe([[0,-L/2],[r*.55,-L/2+.03],[r*.9,-L*.2],[r,L*.08],[r*.86,L*.26]],16),0,tm);add(lathe([[r*.86,L*.26],[r*.8,L*.32],[r*.4,L*.46],[0,L/2]],16),CR,tm);
    }else if(a===4){   // 개: 옆으로 늘어진 귀, 큰 코
      snout(.11,1.2,.85,.95,hr-.02);nose(hr+.075,.046);
      for(const s of[-1,1])add(sph(.13),0,M(s*.31,hy-.03,0,.45,1.3,.8,0,0,s*.2));
      add(lathe([[0,-.14],[.05,-.13],[.045,.08],[0,.14]],12),0,M(0,.42,-.4,1,1,1,-.5));
    }else if(a===5){   // 쥐: 크고 둥근 귀(안쪽 분홍), 뾰족한 주둥이, 가는 꼬리
      snout(.07,.9,.8,1.25,hr);nose(hr+.085,.028,PK,-.07);
      for(const s of[-1,1]){add(sph(.17),0,M(s*.27,hy+.25,-.02,1,1,.3));add(sph(.11),PK,M(s*.27,hy+.25,.03,1,1,.2),0)}
      add(lathe([[0,-.36],[.022,-.34],[.026,.3],[0,.36]],10),PK,M(.12,.2,-.52,1,1,1,-1.1,0,-.2),.012);
    }else if(a===6){   // 돼지: 납작한 코, 앞으로 접힌 귀
      add(new THREE.CylinderGeometry(.11,.11,.09,18),PK,M(0,hy-.06,hr+.005,1,1,.85,PI/2),.014);
      for(const s of[-1,1])add(sph(.02,8,6),DK,M(s*.04,hy-.06,hr+.052,1,1.3,.5),0);
      for(const s of[-1,1])add(tri(.1,.18),0,M(s*.2,hy+.27,.05,1,1,.5,.55,0,-s*.4));
      add(sph(.06),PK,M(0,.34,-.39));
    }else if(a===7){   // 병아리: 부리, 머리 깃, 작은 날개
      add(new THREE.ConeGeometry(.065,.14,12),OR,M(0,hy-.04,hr+.045,1,.7,1,PI/2),.012);
      for(const s of[-1,1])add(new THREE.ConeGeometry(.04,.15,10),0,M(s*.035,hy+hr+.045,0,1,1,1,0,0,-s*.35));
      for(const s of[-1,1])add(sph(.15),0,M(s*.37,.62,0,.3,1,.7,0,0,s*.25));
    }else{   // 개구리: 머리 위로 솟은 눈
      for(const s of[-1,1]){add(sph(.12),0,M(s*.17,hy+.26,.06));add(sph(.05,10,8),DK,M(s*.17,hy+.28,.165,1,1.1,.5),0)}
      for(const s of[-1,1])add(sph(.014,8,6),DK,M(s*.05,hy-.02,hr-.002,1,1,.5),0);
    }
  }else{   // 오뚝이: 둥근 몸 + 얼굴 + 머리
    const bp=[[0,0],[.22,.01],[.38,.14],[.44,.48],[.4,.82],[.28,1.06],[.25,1.16]],hp2=[[.25,1.16],[.3,1.26],[.32,1.37],[.3,1.45],[.27,1.5],[.14,1.57],[0,1.59]];
    add(lathe(bp),'body',M(0,0,0,1,1,1,0,PI));add(lathe(hp2),'head',M(0,0,0,1,1,1,0,PI));
    if(h!==3)add(lathe([[.25,1.1],[.275,1.13],[.26,1.2]]),YL,null,.03);   // 목 띠
    hd={y:1.37,r:.31,ny:1.14,nr:.265,ex:.38,eu:-.1};reg={head:[AV_TW/(2*PI*.29),AV_HEAD_H/len(hp2)],body:[AV_TW/(2*PI*.38),AV_BODY_H/len(bp)]};
    eyes(hd);
  }
  // 장식
  if(h===1){const r=hd.r,hm=M(0,hd.y+r*.74,-.02,1,1,1,-.14);   // 밀짚모자
    add(lathe([[r*.7,0],[r*1.55,0],[r*1.53,.028],[r*.74,.04],[r*.64,.2],[0,.215]]),ST,hm,.016);add(lathe([[r*.75,.04],[r*.78,.075],[r*.72,.105]]),RD,hm,0);
  }else if(h===2){const r=hd.r,y=hd.y+r*.82;   // 고깔
    add(new THREE.ConeGeometry(r*.5,.46,18),RD,M(.03,y+.2,0,1,1,1,0,0,-.14),.016);add(sph(.06,12,10),CR,M(.092,y+.44,0),.012);
  }else if(h===3){const R=hd.nr+.045;   // 목도리
    add(new THREE.TorusGeometry(R,.068,10,24),SC,M(0,hd.ny,0,1,1,1,PI/2),.016);add(sph(.075),SC,M(R*.55,hd.ny-.17,R*.8,.9,2.3,.5,.15,0,-.12),.016);
  }else if(h===4){const d=eyeAt(hd,1),ey=hd.y+d.y,ez=d.z+.035;   // 안경
    for(const s of[-1,1])add(new THREE.TorusGeometry(.085,.015,8,20),DK,M(s*(d.x+.01),ey,ez),.006);
    add(new THREE.CylinderGeometry(.012,.012,Math.max(.02,(d.x+.01)*2-.17),6),DK,M(0,ey,ez,1,1,1,0,0,PI/2),.006);
  }
  if(cr)parts.push(...avCrownParts(hd.r*.58,M(0,hd.y+hd.r*.8,0,1,1,1,-.08,0,.06),10));
  const G2=avBake(parts);G2.reg=reg;return AV.geo[key]=G2;
}
/* 바탕 그림: 머리·몸통 칸은 바탕색(동물 배, 오뚝이 얼굴·머리는 그려 둠), 맨 아래 줄은 단색 칸 */
function avBaseDraw(g,k,a,ci){
  const C=AV_COL[ci];g.globalCompositeOperation='source-over';g.fillStyle=C;g.fillRect(0,0,AV_TW,AV_TW);
  if(k===1&&a!==7){g.fillStyle=AV_CELL[1];g.beginPath();g.ellipse(AV_TW/2,AV_HEAD_H+AV_BODY_H*.56,30,AV_BODY_H*.3,0,0,7);g.fill()}
  if(k===2){g.fillStyle=AV_CELL[9];g.fillRect(0,0,AV_TW,AV_HEAD_H);g.fillStyle=AV_CELL[2];g.fillRect(0,0,AV_TW,AV_HEAD_H*.5)}
  AV_CELL.forEach((c,i)=>{g.fillStyle=c||C;g.fillRect(i*16,AV_TW-16,16,16)});
}
function avMkTex(c){const t=new THREE.CanvasTexture(c);t.minFilter=t.magFilter=THREE.LinearFilter;t.generateMipmaps=false;return t}
function avTex(k,a,ci,pid){   // 남의 인형 그림: 바탕 + (받아 둔) 칠
  const pc=pid&&AVP[pid]&&AVP[pid].cv,key=k+'-'+(k===1?a:0)+'-'+ci+'-'+(pc?pid:'');if(AV.tex[key])return AV.tex[key];
  const c=document.createElement('canvas');c.width=c.height=AV_TW;const g=c.getContext('2d');avBaseDraw(g,k,a,ci);if(pc)g.drawImage(pc,0,0);
  return AV.tex[key]=avMkTex(c);
}
function avPaintCv(){if(!AV.paint){AV.paint=document.createElement('canvas');AV.paint.width=AV.paint.height=AV_TW}return AV.paint}
function avMyTex(){   // 내 인형 그림: 바꾸는 동안 바로바로 다시 그림
  const v=avMine(),key=v.k+'-'+v.a+'-'+v.c+'-'+AV.ver;
  if(!AV.myTex){const c=document.createElement('canvas');c.width=c.height=AV_TW;AV.myTex=avMkTex(c);AV.myKey=''}
  if(AV.myKey!==key){AV.myKey=key;const g=AV.myTex.image.getContext('2d');avBaseDraw(g,v.k,v.a,v.c);if(AV.hasPaint)g.drawImage(avPaintCv(),0,0);AV.myTex.needsUpdate=true}
  return AV.myTex;
}
function avDoll(){
  if(!AV.ink)AV.ink=new THREE.MeshBasicMaterial({color:GFX_INK,side:THREE.BackSide});
  const g=new THREE.Group(),body=new THREE.Mesh(new THREE.BufferGeometry(),AV.ink),ink=new THREE.Mesh(new THREE.BufferGeometry(),AV.ink);
  body.castShadow=true;g.add(body);g.add(ink);g.visible=false;T.scene.add(g);
  return {g,body,ink,mat:null,key:'',geo:null,s:0,turn:{v:0,to:0,from:0,t0:0,ms:0},hopAt:-1e9};
}
const avSm=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
/* 의자마다: 그 자리 사람(p)의 인형을 맞춤. frontStumps가 프레임마다 부름 */
function avStump(S,t,dt,p){
  const D=S.av||(S.av=avDoll());
  const me=!!(p&&V&&V.ps&&p===V.ps[myIdx()]),w=avCamW();
  avFlag(S,t,!!(p&&!p.b&&p.hs&&!me));
  const v=p&&!p.b?(me?Object.assign({},avMine(),{e:AV.edit}):avParse(p.av)):null;
  const show=!!v&&(!me||w>.001);
  if(v&&show){
    const key=v.k+'-'+(v.k===1?v.a:0)+'-'+v.h+(p.cr?'c':'');
    if(D.key!==key){D.geo=avGeo(v.k,v.a,v.h,!!p.cr);D.body.geometry=D.geo.body;D.ink.geometry=D.geo.hull;if(D.key&&D.s>.5)D.hopAt=t;D.key=key}
    const tex=me?avMyTex():avTex(v.k,v.a,v.c,V.cfg&&+V.cfg.pub?'':v.p);   // 남이 칠한 그림은 비공개 탁자에서만
    if(!D.mat){D.mat=toon({map:tex});D.body.material=D.mat}else if(D.mat.map!==tex)D.mat.map=tex;
    if(me)AV.myDoll=D;
  }
  const f=1-Math.exp(-Math.max(0,dt)*7);D.s+=((show?1:0)-D.s)*f;if(D.s<.003&&!show)D.s=0;
  if(show&&!D.was)D.hopAt=t;D.was=show;   // 앉을 때·모양이 바뀔 때 폴짝
  D.g.visible=D.s>.01&&S.s>.3&&!!D.mat;if(!D.g.visible)return;
  frontTween(D.turn,v&&v.e?1:0,t,520);
  const h=(t-D.hopAt)/480,hop=h>0&&h<1?Math.sin(h*Math.PI)*.34:0,sq=h>0&&h<1?1+Math.sin(h*Math.PI)*.07:1,k=Math.max(.001,D.s*S.s)*AV_K;
  D.g.position.set(S.g.position.x,FLOOR_Y+1.35*S.s+hop,S.g.position.z);D.g.scale.set(k/Math.sqrt(sq),k*sq,k/Math.sqrt(sq));
  D.g.rotation.y=S.a+Math.PI+avSm(D.turn.v)*Math.PI+(me?AV.spin:0);   // 평소에는 탁자 가운데를 봄. 바꾸는 중에는 돌아앉음
}
/* 방장 깃발: 방장 의자 옆에 꽂힌 노란 삼각 깃발. 인형 어깨 옆, 탁자 위로 올라와 맞은편에서도 보임 (내 화면의 내 자리는 안 그림). avStump가 부름 */
function avFlag(S,t,on){
  if(!S.flag){if(!on)return;
    const g=new THREE.Group(),pole=new THREE.Mesh(new THREE.CylinderGeometry(.03,.035,1.95,8),toon({color:0x7b5534}));pole.position.y=.975;g.add(pole);hull(new THREE.CylinderGeometry(.052,.057,1.98,8),pole,g);
    const sh=new THREE.Shape();sh.moveTo(0,0);sh.lineTo(.62,-.21);sh.lineTo(0,-.42);sh.closePath();
    const fl=new THREE.Mesh(new THREE.ShapeGeometry(sh),toon({color:0xf2c14e,rim:0}));fl.material.side=THREE.DoubleSide;
    const ol=new THREE.Shape();ol.moveTo(-.02,.04);ol.lineTo(.72,-.21);ol.lineTo(-.02,-.46);ol.closePath();
    const ink=new THREE.Mesh(new THREE.ShapeGeometry(ol),new THREE.MeshBasicMaterial({color:GFX_INK,side:THREE.DoubleSide}));ink.position.z=-.006;
    const w=new THREE.Group();w.position.set(.03,1.91,0);w.scale.x=-1;w.add(ink);w.add(fl);g.add(w);   // 깃발은 인형 바깥쪽으로
    g.visible=false;T.scene.add(g);S.flag={g,w,s:0,t0:t,on:false};
  }
  const F=S.flag;if(on&&!F.on)F.t0=t;F.on=on;
  F.s=on?Math.min(1,Math.max(0,(t-F.t0)/350)):0;   // 꽂힐 때 0.35초에 걸쳐 올라옴
  F.g.visible=on&&S.s>.3;if(!F.g.visible)return;
  const a=S.a,bx=.72,bz=.1;   // 의자 가운데에서 옆(인형 어깨 옆)·조금 뒤. 깃발은 어깨~머리 높이: 위쪽 배경이 좁은 PC 화면에서도 잘리지 않게
  F.g.position.set(S.g.position.x+Math.sin(a)*bz+Math.cos(a)*bx,FLOOR_Y+1.35*S.s-1.95*(1-avSm(F.s)),S.g.position.z+Math.cos(a)*bz-Math.sin(a)*bx);
  F.g.rotation.y=a+Math.PI;F.g.scale.setScalar(S.s);F.w.rotation.y=Math.sin(t/620)*.28;   // 살짝 펄럭임
}
/* 봇이 우승자면 통나무 위에 왕관 */
function avBotCrown(S,on){
  const B=S.bot;if(!B)return;
  if(!B.crown){if(!on)return;const G2=avBake(avCrownParts(.2,new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-.08,0,.06)),10));
    const g=new THREE.Group(),m=new THREE.Mesh(G2.body,toon({color:0xf5c542}));g.add(m);g.add(new THREE.Mesh(G2.hull,AV.ink||(AV.ink=new THREE.MeshBasicMaterial({color:GFX_INK,side:THREE.BackSide}))));
    g.position.y=B.h-.01;B.g.add(g);B.crown=g}
  B.crown.visible=!!on;
}
/* 아바타 변경 카메라의 무게(0~1). frontApplyCam이 앉은 눈과 섞음 */
function avCamW(){return FR.ava?avSm(FR.ava.v):0}
function avTick(t){
  if(!FR.ava)FR.ava={v:0,to:0,from:0,t0:0,ms:0};
  if(AV.edit&&!(frWaitV()&&myIdx()>=0))avEditClose(true);
  frontTween(FR.ava,AV.edit?1:0,t,650);avHostSync();
}
/* 아바타 변경 눈: 앉은 눈과 같은 각도(37°)로 내 의자 쪽으로 내려옴. 돌지 않으니 어지럽지 않고, 탁자는 인형 뒤라 가리지 않음. 인형은 화면 위쪽(아래는 고르는 판) */
function avPose(a){
  if(!_fc||!T.seat)return;
  const tv=Math.tan(20*Math.PI/180),d=Math.max(8.2,3/a),EL=37*Math.PI/180,c=new THREE.Vector3(0,FLOOR_Y+1.35+1.25,5.75);
  _fc.fov=40;_fc.position.set(c.x,c.y+d*Math.sin(EL),c.z+d*Math.cos(EL));_fc.lookAt(c);_fc.updateMatrixWorld();
  _fc.translateY(-.3*d*tv);_fc.updateMatrixWorld();_fc.updateProjectionMatrix();
  T.avCam={p:_fc.position.clone(),q:_fc.quaternion.clone(),m:_fc.projectionMatrix.clone()};
}
/* ---- 색칠: 누른 자리의 겉면 좌표(uv)에 붓 자국. 머리·몸통 칸 안에서만, 좌우 이음매는 이어서 ---- */
const _avRay=window.THREE?new THREE.Raycaster():null;
function avHit(e){
  const D=AV.myDoll;if(!D||!D.g.visible||!_avRay)return null;
  const r=$('#cv').getBoundingClientRect();_avRay.setFromCamera({x:(e.clientX-r.left)/r.width*2-1,y:-((e.clientY-r.top)/r.height*2-1)},T.cam);
  D.g.updateMatrixWorld(true);const h=_avRay.intersectObject(D.body,false)[0];if(!h||!h.uv)return null;
  return {u:h.uv.x,v:h.uv.y,reg:h.uv.y>=.5?'head':h.uv.y>=16/AV_TW?'body':''};   // reg '' = 칠하지 않는 부품(귀·꼬리·장식)
}
function avDab(P,u,v){
  const D=AV.myDoll,m=D.geo.reg[P.reg],g=avPaintCv().getContext('2d'),R=.05,head=P.reg==='head';
  g.save();g.beginPath();g.rect(0,head?0:AV_HEAD_H,AV_TW,head?AV_HEAD_H:AV_BODY_H);g.clip();
  g.globalCompositeOperation=AV.tool==='erase'?'destination-out':'source-over';g.fillStyle=AV_COL[AV.bc];
  for(const du of[-1,0,1]){g.beginPath();g.ellipse((u+du)*AV_TW,(1-v)*AV_TW,R*m[0],R*m[1],0,0,7);g.fill()}
  g.restore();
}
function avStroke(P){
  const L=AV.stroke.last;
  if(L&&L.reg===P.reg&&Math.abs(P.u-L.u)<.3){const n=Math.max(1,Math.ceil(Math.hypot((P.u-L.u)*AV_TW,(P.v-L.v)*AV_TW)/2));for(let i=1;i<=n;i++)avDab(P,L.u+(P.u-L.u)*i/n,L.v+(P.v-L.v)*i/n)}
  else avDab(P,P.u,P.v);
  AV.stroke.last=P;AV.hasPaint=true;AV.dirty=true;AV.ver++;
}
function avPaintDone(){   // 칠한 그림을 PNG로: 너무 크면 줄여서 (받는 쪽이 다시 256으로 폄)
  if(!AV.dirty)return;AV.dirty=false;
  let d='';
  if(AV.hasPaint)for(const sz of[256,128,64]){
    let c=avPaintCv();if(sz!==AV_TW){c=document.createElement('canvas');c.width=c.height=sz;c.getContext('2d').drawImage(avPaintCv(),0,0,sz,sz)}
    d=c.toDataURL('image/png');if(d.length<=AV_PMAX)break}
  if(d.length>AV_PMAX)d='';
  AV.pdata=d;AV.pid=d?avHash(d):'';store('gura-avatar-paint',d);if(d)avpPut(AV.pid,d);
}
/* ---- 아바타 변경 판: 모양(종류·동물·장식) / 색칠(채우기·붓·지우개·처음으로 + 색) ---- */
function avPanelDraw(){
  const v=avMine(),chip=(arr,on,k)=>arr.map((t,i)=>`<button type="button" data-av="${k}:${i}"${i===on?' class="on"':''}>${t}</button>`).join('');
  let h=`<div class="av-row av-tabs">${chip(['모양','색칠'],AV.tab,'tab')}</div>`;
  if(AV.tab===0){
    h+=`<div class="av-row">${chip(AV_KIND,v.k,'k')}</div>`;
    if(v.k===1)h+=`<div class="av-row av-g5">${chip(AV_ANI,v.a,'a')}</div>`;
    h+=`<div class="av-row av-g5">${chip(AV_HAT,v.h,'h')}</div>`;
  }else{
    const tl=[['fill','채우기'],['brush','붓'],['erase','지우개']];
    h+=`<div class="av-row">${tl.map(([k,t])=>`<button type="button" data-av="t:${k}"${AV.tool===k?' class="on"':''}>${t}</button>`).join('')}<button type="button" data-av="reset">처음으로</button></div>`;
    const on=AV.tool==='fill'?v.c:AV.tool==='brush'?AV.bc:-1;
    h+=`<div class="av-row av-col">${AV_COL.map((c,i)=>`<button type="button" data-av="c:${i}" style="background:${c}" aria-label="색 ${i+1}"${i===on?' class="on"':''}></button>`).join('')}</div>`;
  }
  $('#avPanel').innerHTML=h+'<button type="button" class="av-done" data-av="done">완료</button>';
}
function avEditOpen(){
  if(AV.edit||!T.ok||!FR.ok||!frWaitV()||myIdx()<0||!T.avCam){sfx('no');return}
  AV.edit=true;AV.spin=0;AV.tab=0;AV.tool='fill';avPanelDraw();$('#avEdit').hidden=false;$('#stage').classList.add('avedit');sfx('tick');avPush();
}
function avEditClose(quiet){
  if(!AV.edit)return;
  AV.edit=false;AV.spin=0;AV.drag=null;AV.stroke=null;avPaintDone();$('#avEdit').hidden=true;$('#stage').classList.remove('avedit');if(!quiet)sfx('pick');avPush();
}
$('#avEdit').addEventListener('click',e=>{
  const b=e.target.closest('[data-av]');if(!b)return;
  const [k,x]=b.dataset.av.split(':'),v=avMine();
  if(k==='done'){avEditClose();return}
  if(k==='tab')AV.tab=+x;
  else if(k==='t')AV.tool=x;
  else if(k==='reset'){if(AV.hasPaint){avPaintCv().getContext('2d').clearRect(0,0,AV_TW,AV_TW);AV.hasPaint=false;AV.dirty=true;AV.ver++}}
  else if(k==='c'){if(AV.tool==='fill'){v.c=+x;avSave(v);avPush()}else{AV.bc=+x;AV.tool='brush'}}
  else{if(v[k]===+x)return;v[k]=+x;avSave(v);avPush()}
  avPanelDraw();sfx('tick');
});
/* 판 밖: 붓·지우개를 골랐으면 인형을 문질러 칠하고, 인형 밖을 좌우로 끌면 인형이 돎(카메라는 그대로) */
$('#avEdit').addEventListener('pointerdown',e=>{
  if(e.target.closest('.av-panel'))return;
  const P=AV.tab===1&&AV.tool!=='fill'?avHit(e):null;
  if(P){if(P.reg){AV.stroke={id:e.pointerId,last:null};avStroke(P)}else sfx('no');return}
  AV.drag={id:e.pointerId,x:e.clientX};
});
$('#avEdit').addEventListener('pointermove',e=>{
  if(AV.stroke&&AV.stroke.id===e.pointerId){const P=avHit(e);if(P&&P.reg)avStroke(P);else AV.stroke.last=null;return}
  const d=AV.drag;if(!d||d.id!==e.pointerId)return;AV.spin+=(e.clientX-d.x)*.012;d.x=e.clientX;
});
['pointerup','pointercancel'].forEach(ev=>$('#avEdit').addEventListener(ev,e=>{if(AV.drag&&AV.drag.id===e.pointerId)AV.drag=null;if(AV.stroke&&AV.stroke.id===e.pointerId)AV.stroke=null}));
document.addEventListener('keydown',e=>{   // 바꾸는 동안에는 다른 단축키를 막고 Esc·Enter로 닫음
  if(!AV.edit)return;
  e.stopImmediatePropagation();if(e.key==='Escape'||e.key==='Enter'){e.preventDefault();avEditClose()}
},true);
