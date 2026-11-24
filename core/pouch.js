/* index.html 공통 코드 · 대기실 도토리 주머니(복주머니 모양이지만 복주머니는 아님: '복' 글자 없음). 파일 순서는 index.html의 <script src> 순서 */
/* ===== 도토리 주머니 =====
   디스플레이 오른쪽 나무 띠(시작 버튼과 맞은 자리)에서 구멍이 열리고 올라옴. 로그인이 켜져 있을 때(AUTH_ON) 대기실에서 내 자리에 앉아 있으면 보임
   · 게스트: 덜 찬 빈 주머니(납작하지 않게 키 .82). 누르면 로그인 꼬리표(core/auth.js)
   · 로그인: 도토리가 많을수록 통통해짐(100개쯤이면 가득). 누르면 입구가 벌어지며 도토리가 보이고 꼬리표에 개수
   · 판이 끝나고 받은 도토리는 대기실로 돌아와 주머니가 올라오면 위에서 하나씩 떨어져 들어감 */
const PO={a:{v:0,to:0,from:0,t0:0,ms:0},h:{v:0,to:0,from:0,t0:0,ms:0},op:{v:0,to:0,from:0,t0:0,ms:0},holeSnd:0,drops:[],bounceAt:-1e9,plusAt:-1e9};
const PO_X=1.3,PO_Z=4.18;
function pouchAcorn(){
  const g=new THREE.Group();
  const nut=new THREE.Mesh(new THREE.SphereGeometry(.045,14,10),toon({color:0xc98a4b,rim:.3}));nut.scale.set(1,1.3,1);nut.position.y=-.012;g.add(nut);hull(new THREE.SphereGeometry(.05,14,10),nut,g);
  const cap=new THREE.Mesh(new THREE.SphereGeometry(.05,14,8,0,Math.PI*2,0,Math.PI/2),toon({color:0x6b4423,rim:.2}));cap.scale.set(1,.7,1);cap.position.y=.02;g.add(cap);hull(new THREE.SphereGeometry(.056,14,8,0,Math.PI*2,0,Math.PI/2),cap,g);
  const st=new THREE.Mesh(new THREE.CylinderGeometry(.007,.009,.03,6),toon({color:0x6b4423}));st.position.y=.062;g.add(st);
  g.traverse(o=>{if(o.isMesh)o.castShadow=true});
  return g;
}
function pouchBuild(TG){
  if(!AUTH_ON)return;
  const hole=frontHole(TG,PO_X,.003,PO_Z,.3);
  const g=new THREE.Group();g.position.set(PO_X,-.55,PO_Z);g.visible=false;TG.add(g);
  const tilt=new THREE.Group();tilt.rotation.x=-.5;tilt.scale.setScalar(1.25);g.add(tilt);   // 앉은 눈에 앞이 보이게 뒤로 기댐
  const bag=new THREE.Group();tilt.add(bag);   // 통통함(scale)은 이 묶음에
  const red=toon({color:0xd23a40,rim:.3}),cord=toon({color:0x2d5fb0,rim:.3}),gold=toon({color:0xf2c14e,rim:.3});
  // 몸통: 둥근 바닥에서 목으로 모이는 주머니. 목 가까이는 잔주름
  const prof=[[.001,0],[.08,.005],[.15,.03],[.2,.08],[.226,.14],[.22,.2],[.19,.26],[.13,.31],[.085,.335]].map(([x,y])=>new THREE.Vector2(x,y));
  const pleat=(geo,amp,from)=>{const p=geo.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),a=Math.atan2(x,z),k=1+amp(y)*Math.sin(a*14);p.setXYZ(i,x*k,y,z*k)}geo.computeVertexNormals();return geo};
  const bodyGeo=()=>pleat(new THREE.LatheGeometry(prof,40),y=>.05*clamp01((y-.2)/.13),0);
  const body=new THREE.Mesh(bodyGeo(),red);body.castShadow=true;bag.add(body);
  const bi=hull(bodyGeo(),body,bag);bi.scale.setScalar(1.045);bi.position.y=-.006;
  // 입구 주름(벌어지는 위쪽): 안쪽은 분홍
  const fp=[[.08,.33],[.1,.36],[.125,.395],[.145,.43],[.135,.445],[.11,.44]].map(([x,y])=>new THREE.Vector2(x,y));
  const frGeo=()=>pleat(new THREE.LatheGeometry(fp,40),y=>.14*clamp01((y-.33)/.1),0);
  const frill=new THREE.Group();frill.position.y=.33;bag.add(frill);
  const fm=new THREE.Mesh(frGeo(),toon({color:0xd23a40,rim:.3}));fm.geometry.translate(0,-.33,0);fm.material.side=THREE.DoubleSide;fm.castShadow=true;frill.add(fm);
  const fin=new THREE.Mesh(frGeo(),toon({color:0xf3a7b5,rim:0}));fin.geometry.translate(0,-.33,0);fin.scale.setScalar(.97);fin.material.side=THREE.BackSide;frill.add(fin);
  const lid=new THREE.Mesh(new THREE.CircleGeometry(.088,24),toon({color:0x8e1f27,rim:0}));lid.rotation.x=-Math.PI/2;lid.position.y=.334;bag.add(lid);   // 목을 막음 (안이 비쳐 보이지 않게)
  // 끈: 목에 감긴 끈 + 앞 매듭 + 술 두 가닥
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.09,.018,8,32),cord);ring.rotation.x=Math.PI/2;ring.position.y=.335;bag.add(ring);hull(new THREE.TorusGeometry(.09,.024,8,32),ring,bag);
  const knot=new THREE.Mesh(new THREE.SphereGeometry(.03,12,10),cord);knot.position.set(0,.335,.105);bag.add(knot);hull(new THREE.SphereGeometry(.037,12,10),knot,bag);
  for(const s of[-1,1]){
    const a=new THREE.Vector3(0,.33,.11),b=new THREE.Vector3(s*.055,.2,.235),mid=a.clone().add(b).multiplyScalar(.5),len=a.distanceTo(b);
    const c=new THREE.Mesh(new THREE.CylinderGeometry(.009,.009,len,6),cord);c.position.copy(mid);c.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());bag.add(c);
    const ts=new THREE.Mesh(new THREE.CylinderGeometry(.012,.03,.08,10),gold);ts.position.set(s*.058,.16,.24);ts.rotation.x=.18;bag.add(ts);hull(new THREE.CylinderGeometry(.016,.036,.09,10),ts,bag);
  }
  // 입구에서 보이는 도토리 (열렸을 때)
  const peek=[[-.04,.0,.01,.4],[.045,-.005,-.02,-.5],[0,.01,-.045,.1]].map(([x,y,z,r])=>{const a=pouchAcorn();a.position.set(x,y,z);a.rotation.z=r;a.visible=false;frill.add(a);return a});
  T.pouch={g,bag,frill,peek,hole,TG};
}
/* 도토리 수 → 통통함 0..1 */
const pouchFull=()=>AU.user&&AU.prof?Math.min(1,Math.log10(1+(AU.prof.acorn|0))/2):0;
function pouchUpdate(t,wait){
  const P=T.pouch;if(!P)return;
  const want=wait&&FR.stand<.05&&!FR.browse&&!roomSetOpen&&!FR.seek&&!FR.rb.on&&FR.rba.v<=.01&&myIdx()>=0&&!V.spec&&!AV.edit;
  if(!want&&AU.open&&AU.from==='pouch'&&!(AU.step==='nick'&&AU.user)){AU.open=false;auTagDraw()}
  // 구멍이 열림 → 주머니가 올라옴 → 구멍이 닫힘(주머니는 탁자 위에 놓임). 내려갈 때는 구멍이 열림 → 주머니 → 구멍이 닫힘
  const up=PO.a.v>=.999,down=PO.a.v<=.001,hw=(want&&!up)||(!want&&!down)?1:0,hu=smooth(frontTween(PO.h,hw,t,hw?260:220));P.hole.visible=hu>.01;P.hole.scale.setScalar(Math.max(.001,hu));
  if(PO.h.to===1&&PO.h.v>=1&&!PO.holeSnd){PO.holeSnd=1;sfx('iris')}if(!hw)PO.holeSnd=0;
  const sw=want?(up||hu>.98?1:0):(down||hu>.98?0:1);if(PO.a.to!==sw&&sw===1)sfx('btnUp');
  const su=frontTween(PO.a,sw,t,480);P.g.position.y=-.55+.55*smooth(su);P.g.visible=su>.01;
  if(!P.g.visible){PO.drops.forEach(d=>d.m.visible=false);return}
  // 통통함·흔들림·떨어진 도토리에 들썩임
  const f=pouchFull(),b=t-PO.bounceAt,bb=b<420?Math.sin(b/420*Math.PI)*(1-b/420):0;
  const sy=.82+.23*f,sx=.98+.1*f;   // 빈 주머니도 납작하지 않게(높이 .82), 가득 차면 키 1.05·폭 1.08로 불룩
  P.bag.scale.set(sx*(1+.08*bb),sy*(1-.12*bb),sx*(1+.08*bb));
  P.bag.rotation.z=.035*Math.sin(t/900);P.bag.rotation.x=.02*Math.sin(t/1300+1);
  // 열림: 로그인했고 꼬리표가 열려 있으면 입구가 벌어지고 도토리가 보임
  const ov=smooth(frontTween(PO.op,AU.open&&AU.from==='pouch'&&!!AU.user?1:0,t,260));
  P.frill.scale.set(1+.4*ov,(1-.15*ov)*Math.min(1.2,.95/sy),1+.4*ov);   // 입구 주름은 주머니 키를 따라 눌리지 않게
  const nPeek=AU.prof?Math.min(3,AU.prof.acorn|0):0;P.peek.forEach((a,i)=>{a.visible=ov>.05&&i<nPeek;a.position.y=-.05+.08*ov});
  // 받은 도토리가 위에서 떨어져 들어감
  if(AU.gain>0&&su>=.999&&want){const n=Math.min(5,AU.gain);for(let i=0;i<n;i++)PO.drops.push({at:t+150+i*200,m:null,x:(Math.random()-.5)*.06,r:Math.random()*6,done:false});PO.plus=AU.gain;PO.plusAt=t+150;AU.gain=0}
  for(const d of PO.drops){
    if(!d.m){d.m=pouchAcorn();P.TG.add(d.m)}
    const k=(t-d.at)/420;d.m.visible=k>=0&&k<1;
    if(k>=0&&k<1){d.m.position.set(PO_X+d.x,P.g.position.y+1.3-(1.3-.4*sy)*k*k,PO_Z);d.m.rotation.set(d.r+k*3,d.r,0)}
    if(k>=1&&!d.done){d.done=true;PO.bounceAt=t;sfx('tick')}
  }
  if(PO.drops.length&&PO.drops.every(d=>d.done)){PO.drops.forEach(d=>{P.TG.remove(d.m)});PO.drops=[]}
}
function pouchLayout(W,Hh){
  const P=T.pouch,b=$('#frPouch');if(!b)return;
  const on=!!P&&P.g.visible&&P.g.position.y>-.2&&!FR.browse,rect=on?frontRect(P.bag,W,Hh):null;
  frontPut(b,on,rect,10,56,56);
  if(b.dataset.lg!==String(!!AU.user)){b.dataset.lg=String(!!AU.user);const L=AU.user?'도토리 주머니':'도토리 주머니 · 로그인';b.setAttribute('aria-label',L);b.title=L}
  let anc=null;if(on){const pt=(x,y)=>{_v3.set(x,y,PO_Z).project(T.cam);return [(_v3.x+1)/2*W,(1-_v3.y)/2*Hh]};const [l]=pt(PO_X-.3,0),[r]=pt(PO_X+.3,0),[,tp]=pt(PO_X,.62);anc={l,r,t:tp,b:tp}}
  auTagPlace(anc,W,Hh);   // 꼬리표는 흔들리는 주머니가 아니라 고정 자리를 기준으로 (흔들림에 따라 움직이지 않게)
  const pl=$('#acPlus'),pk=clock()-PO.plusAt;
  if(pl){const show=on&&pk>=0&&pk<1400;if(pl.hidden===show)pl.hidden=!show;if(show){pl.textContent='+'+PO.plus;pl.style.left=Math.round((rect.l+rect.r)/2)+'px';pl.style.top=Math.round(rect.t-10-pk/1400*24)+'px';pl.style.opacity=pk<1000?1:1-(pk-1000)/400}}
}
$('#frPouch').addEventListener('click',e=>{e.pouchHit=true;auTagOpen('pouch')});
