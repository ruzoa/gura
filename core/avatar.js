/* index.html 공통 코드 · 아바타(의자 위 나무 인형): 나무 말·동물·오뚝이. 파일 순서는 index.html의 <script src> 순서 */
/* ===== 아바타 =====
   사람 자리의 의자 위에 앉는 나무 인형. 봇은 통나무(front.js frontBuildBot), 사람은 칠한 나무 인형.
   · 값: 'k-a-c' 글자 (k 종류 0 나무 말·1 동물·2 오뚝이, a 동물 0 토끼·1 곰·2 고양이·3 여우, c 색 번호). 바꾸는 중이면 끝에 '-e'
   · 저장: gura-avatar (기기마다). 처음에는 무작위로 정해 저장
   · 전달: 참가자는 hello에 실어 보내고(net.js), 방장은 자기 값을 members/players에 적음(avHostSync) → snapFor가 ps[].av로 모두에게
   · 내 화면에서는 내 인형을 그리지 않음(앉은 눈이 인형 자리). 아바타를 바꿀 때만 보임
   · 아바타 변경: 내 이름표 메뉴 → 카메라가 같은 각도로 내 의자 쪽으로 내려오고(돌지 않음) 인형이 돌아앉아 나를 봄. 다른 사람 화면에서도 돌아앉아 있음
   · 그리기: 인형 하나는 몸(꼭짓점 색) + 먹선 껍질, 두 번만 그림. 모양은 테스트룸 lab-doll.html에서 옮김 (몸통만 길게 ×1.6) */
const AV_KIND=['나무 말','동물','오뚝이'],AV_ANI=['토끼','곰','고양이','여우'];
const AV_COL=['#e4573d','#f2994a','#f2c14e','#6fbf5f','#3fa7a0','#4a7fd4','#8c62c9','#e58fb1','#b9824f','#f6ecd8'];
const AV_RE=/^([0-2])-([0-3])-(\d{1,2})(-e)?$/;
const AV={edit:false,spin:0,mine:null,geo:{},mat:null,ink:null,drag:null};
function avParse(s){const m=AV_RE.exec(typeof s==='string'?s:'');return m?{k:+m[1],a:+m[2],c:Math.min(AV_COL.length-1,+m[3]),e:!!m[4]}:null}
function avMine(){
  if(AV.mine)return AV.mine;
  let v=avParse(store('gura-avatar'));
  if(!v){v={k:Math.random()*3|0,a:Math.random()*4|0,c:Math.random()*AV_COL.length|0,e:false};store('gura-avatar',`${v.k}-${v.a}-${v.c}`)}
  v.e=false;return AV.mine=v;
}
function myAvStr(){const v=avMine();return `${v.k}-${v.a}-${v.c}${AV.edit?'-e':''}`}
/* 내 값을 모두에게: 방장은 자기 자리에 적고, 참가자는 대기실에서 hello를 다시 보냄(닉네임 바꾸기와 같은 길) */
function avHostSync(){
  if(mode!=='host'||!H)return;const s=myAvStr();let ch=false;
  for(const L of [H.members,H.players]){const m=L&&L.find(x=>x.host);if(m&&m.av!==s){m.av=s;ch=true}}
  if(ch)mark();
}
function avPush(){if(mode==='host')avHostSync();else if(mode==='guest'&&net.conn&&net.conn.open&&V&&V.st==='wait')guestHello(net.conn)}

/* ---- 모양 만들기: 부품들을 인형 좌표로 옮겨 한 덩어리로 합침 (몸 + 같은 두께의 먹선 껍질) ---- */
const AV_INK_W=.024;
function avBake(parts){
  const pos=[],nor=[],col=[],idx=[],hp=[],v=new THREE.Vector3(),n=new THREE.Vector3(),nm=new THREE.Matrix3(),c=new THREE.Color();let base=0;
  for(const p of parts){
    const g=p.g,P=g.attributes.position,N=g.attributes.normal,m=p.m||new THREE.Matrix4();nm.getNormalMatrix(m);c.set(p.c);
    const w=p.w!=null?p.w:AV_INK_W,loc=[],map=new Map();
    for(let i=0;i<P.count;i++){
      v.fromBufferAttribute(P,i).applyMatrix4(m);n.fromBufferAttribute(N,i).applyMatrix3(nm).normalize();
      pos.push(v.x,v.y,v.z);nor.push(n.x,n.y,n.z);col.push(c.r,c.g,c.b);
      const key=Math.round(v.x*500)+','+Math.round(v.y*500)+','+Math.round(v.z*500);loc.push(key,v.x,v.y,v.z);
      const a=map.get(key)||[0,0,0];a[0]+=n.x;a[1]+=n.y;a[2]+=n.z;map.set(key,a);   // 같은 자리 꼭짓점은 방향을 평균: 모서리에서 껍질이 벌어지지 않게
    }
    for(let i=0;i<P.count;i++){const a=map.get(loc[i*4]),l=Math.hypot(a[0],a[1],a[2])||1;hp.push(loc[i*4+1]+a[0]/l*w,loc[i*4+2]+a[1]/l*w,loc[i*4+3]+a[2]/l*w)}
    if(g.index)for(let i=0;i<g.index.count;i++)idx.push(base+g.index.getX(i));else for(let i=0;i<P.count;i++)idx.push(base+i);
    base+=P.count;
  }
  const mk=(p,withCol)=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
    if(withCol){g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3))}g.setIndex(idx);return g};
  return {body:mk(pos,true),hull:mk(hp,false)};
}
function avGeo(k,a,ci){
  const key=k+'-'+(k===1?a:0)+'-'+ci;if(AV.geo[key])return AV.geo[key];
  const C=AV_COL[ci],CREAM='#fff8ea',DARK='#2a2420',parts=[];
  const lathe=pts=>new THREE.LatheGeometry(pts.map(p=>new THREE.Vector2(p[0],p[1])),28);
  const M=(x,y,z,sx,sy,sz,rx,rz)=>{const e=new THREE.Euler(rx||0,0,rz||0),q=new THREE.Quaternion().setFromEuler(e);return new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),q,new THREE.Vector3(sx==null?1:sx,sy==null?1:sy,sz==null?1:sz))};
  const add=(g,c,m,w)=>parts.push({g,c,m,w});
  const eyes=(hy,hr,dx,up)=>{for(const s of[-1,1]){const d=new THREE.Vector3(s*dx,up,1).normalize().multiplyScalar(hr*.97);add(new THREE.SphereGeometry(.036,10,8),DARK,M(d.x,hy+d.y,d.z,1,1.15,.6),0)}};
  if(k===0){   // 나무 말: 원뿔 몸통 + 둥근 머리
    add(lathe([[0,0],[.34,0],[.37,.05],[.36,.1],[.2,.96],[.17,1.12]]),C);
    add(new THREE.SphereGeometry(.26,24,16),C,M(0,1.32,0));
  }else if(k===1){   // 동물 나무 인형: 몸통은 같고 귀·꼬리만 다름
    const hr=.32,hy=1.31;
    add(lathe([[0,0],[.3,0],[.37,.05],[.39,.14],[.38,.48],[.31,.83],[.22,1.02],[.19,1.09]]),C);
    add(new THREE.SphereGeometry(.2,18,12),CREAM,M(0,.5,.3,1,1.7,.42),0);   // 배
    add(new THREE.SphereGeometry(hr,24,16),C,M(0,hy,0));
    add(new THREE.SphereGeometry(.1,16,12),CREAM,M(0,hy-.07,hr-.05,1.25,.82,.7),.014);   // 주둥이
    add(new THREE.SphereGeometry(.036,10,8),DARK,M(0,hy-.045,hr+.022,1.2,.85,.8),0);   // 코
    eyes(hy,hr,.4,.12);
    const tri=(r,h)=>lathe([[0,-h*.5],[r,-h*.5],[r*.96,-h*.38],[r*.62,h*.08],[r*.26,h*.4],[r*.1,h*.48],[0,h*.5]]);
    for(const s of[-1,1]){
      if(a===0)add(lathe([[0,-.26],[.07,-.26],[.085,-.1],[.09,.08],[.075,.2],[.04,.25],[0,.26]]),C,M(s*.14,hy+.5,0,1,1,.55,0,-s*.14));
      else if(a===1)add(new THREE.SphereGeometry(.115,16,12),C,M(s*.235,hy+.235,0,1,1,.55));
      else if(a===2)add(tri(.125,.26),C,M(s*.19,hy+.29,0,1,1,.5,0,-s*.3));
      else add(tri(.13,.36),C,M(s*.18,hy+.33,0,1,1,.5,0,-s*.22));
    }
    if(a>=2){const fox=a===3,L=fox?.56:.5,r=fox?.13:.075,tm=M(.2,.3,-.34,1,1,1,-.75,-.35);   // 꼬리 (여우는 끝이 흼)
      add(lathe([[0,-L/2],[r*.55,-L/2+.03],[r*.9,-L*.2],[r,L*.08],[r*.86,L*.26]]),C,tm);
      add(lathe([[r*.86,L*.26],[r*.8,L*.32],[r*.4,L*.46],[0,L/2]]),fox?CREAM:C,tm)}
  }else{   // 오뚝이: 둥근 몸(옷 색) + 얼굴 + 머리
    add(lathe([[0,0],[.22,.01],[.38,.14],[.44,.48],[.4,.82],[.28,1.06],[.25,1.16]]),C);
    add(lathe([[.25,1.1],[.275,1.13],[.26,1.2]]),'#f2c14e',null,.03);   // 목 띠
    add(lathe([[.25,1.16],[.3,1.26],[.32,1.37],[.3,1.45]]),'#ffe2c4');
    add(lathe([[.3,1.45],[.27,1.5],[.14,1.57],[0,1.59]]),DARK);
    eyes(1.33,.32,.38,.02);
  }
  return AV.geo[key]=avBake(parts);
}
function avDoll(){
  if(!AV.mat){AV.mat=toon({color:0xffffff});AV.mat.vertexColors=true;AV.ink=new THREE.MeshBasicMaterial({color:GFX_INK,side:THREE.BackSide})}
  const g=new THREE.Group(),body=new THREE.Mesh(new THREE.BufferGeometry(),AV.mat),ink=new THREE.Mesh(new THREE.BufferGeometry(),AV.ink);
  body.castShadow=true;g.add(body);g.add(ink);g.visible=false;T.scene.add(g);
  return {g,body,ink,key:'',s:0,turn:{v:0,to:0,from:0,t0:0,ms:0},hopAt:-1e9};
}
const avSm=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
/* 의자마다: 그 자리 사람(p)의 인형을 맞춤. frontStumps가 프레임마다 부름 */
function avStump(S,t,dt,p){
  const D=S.av||(S.av=avDoll());
  const me=!!(p&&V&&V.ps&&p===V.ps[myIdx()]),w=avCamW();
  const v=p&&!p.b?(me?Object.assign({},avMine(),{e:AV.edit}):avParse(p.av)):null;
  const show=!!v&&(!me||w>.001);
  if(v){const key=v.k+'-'+(v.k===1?v.a:0)+'-'+v.c;if(D.key!==key){const G2=avGeo(v.k,v.a,v.c);D.body.geometry=G2.body;D.ink.geometry=G2.hull;if(D.key&&D.s>.5)D.hopAt=t;D.key=key}}
  const f=1-Math.exp(-Math.max(0,dt)*7);D.s+=((show?1:0)-D.s)*f;if(D.s<.003&&!show)D.s=0;
  if(show&&!D.was)D.hopAt=t;D.was=show;   // 앉을 때·모양이 바뀔 때 폴짝
  D.g.visible=D.s>.01&&S.s>.3;if(!D.g.visible)return;
  if(D.turn.to!==(v&&v.e?1:0))frontTween(D.turn,v&&v.e?1:0,t,520);else frontTween(D.turn,D.turn.to,t,520);
  const h=(t-D.hopAt)/480,hop=h>0&&h<1?Math.sin(h*Math.PI)*.34:0,sq=h>0&&h<1?1+Math.sin(h*Math.PI)*.07:1,k=Math.max(.001,D.s*S.s);
  D.g.position.set(S.g.position.x,FLOOR_Y+1.35*S.s+hop,S.g.position.z);D.g.scale.set(k/Math.sqrt(sq),k*sq,k/Math.sqrt(sq));
  D.g.rotation.y=S.a+Math.PI+avSm(D.turn.v)*Math.PI+(me?AV.spin:0);   // 평소에는 탁자 가운데를 봄. 바꾸는 중에는 돌아앉음
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
  const tv=Math.tan(20*Math.PI/180),d=Math.max(6.2,2.3/a),EL=37*Math.PI/180,c=new THREE.Vector3(0,FLOOR_Y+1.35+.9,5.75);
  _fc.fov=40;_fc.position.set(c.x,c.y+d*Math.sin(EL),c.z+d*Math.cos(EL));_fc.lookAt(c);_fc.updateMatrixWorld();
  _fc.translateY(-.29*d*tv);_fc.updateMatrixWorld();_fc.updateProjectionMatrix();
  T.avCam={p:_fc.position.clone(),q:_fc.quaternion.clone(),m:_fc.projectionMatrix.clone()};
}
/* ---- 아바타 변경 판 ---- */
function avPanelDraw(){
  const v=avMine(),chip=(arr,on,k)=>arr.map((t,i)=>`<button type="button" data-av="${k}:${i}"${i===on?' class="on"':''}>${t}</button>`).join('');
  $('#avKind').innerHTML=chip(AV_KIND,v.k,'k');
  $('#avAni').innerHTML=chip(AV_ANI,v.a,'a');$('#avAni').hidden=v.k!==1;
  $('#avCol').innerHTML=AV_COL.map((c,i)=>`<button type="button" data-av="c:${i}" style="background:${c}" aria-label="색 ${i+1}"${i===v.c?' class="on"':''}></button>`).join('');
}
function avEditOpen(){
  if(AV.edit||!T.ok||!FR.ok||!frWaitV()||myIdx()<0||!T.avCam){sfx('no');return}
  AV.edit=true;AV.spin=0;avPanelDraw();$('#avEdit').hidden=false;$('#stage').classList.add('avedit');sfx('tick');avPush();
}
function avEditClose(quiet){
  if(!AV.edit)return;
  AV.edit=false;AV.spin=0;AV.drag=null;$('#avEdit').hidden=true;$('#stage').classList.remove('avedit');if(!quiet)sfx('pick');avPush();
}
$('#avEdit').addEventListener('click',e=>{
  const b=e.target.closest('[data-av]');
  if(b){const [k,i]=b.dataset.av.split(':'),v=avMine();if(v[k]===+i)return;v[k]=+i;store('gura-avatar',`${v.k}-${v.a}-${v.c}`);avPanelDraw();sfx('tick');avPush();return}
  if(e.target.closest('#avDone'))avEditClose();
});
/* 판 밖을 좌우로 끌면 인형이 돎(카메라는 그대로): 뒷모습 보기 */
$('#avEdit').addEventListener('pointerdown',e=>{if(e.target.closest('.av-panel'))return;AV.drag={id:e.pointerId,x:e.clientX}});
$('#avEdit').addEventListener('pointermove',e=>{const d=AV.drag;if(!d||d.id!==e.pointerId)return;AV.spin+=(e.clientX-d.x)*.012;d.x=e.clientX});
['pointerup','pointercancel'].forEach(ev=>$('#avEdit').addEventListener(ev,e=>{if(AV.drag&&AV.drag.id===e.pointerId)AV.drag=null}));
document.addEventListener('keydown',e=>{   // 바꾸는 동안에는 다른 단축키를 막고 Esc·Enter로 닫음
  if(!AV.edit)return;
  e.stopImmediatePropagation();if(e.key==='Escape'||e.key==='Enter'){e.preventDefault();avEditClose()}
},true);
