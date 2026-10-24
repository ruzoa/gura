/* 알까기 3D 손 (테스트룸 lab-hand.html의 '새 살'을 그대로 옮김: 손뼈대 + 뼈에 붙인 살(거리 함수, 광선 따라가기) + 살 조각 번호 윤곽선)
   테스트룸에서 손 모양을 고치면 이 파일도 같이 맞춤(같은 코드를 옮겨 둠, 옮기는 범위: '손 만들기'부터 '3D 모델 손' 앞까지 + 'let PFL'부터 'renderAll' 앞까지).
   게임은 Hand3D(THREE,{SR,SH}) 하나를 만들고 매 프레임 set({...})으로 자세·자리를 정한 뒤, 게임 장면을 그린 다음 draw(renderer,camera,op)로 손을 그 위에 얹음(다른 물건보다 늘 위) */
(function(){
window.Hand3D=function(THREE,opt){
opt=opt||{};
const S={p:0,fl:0,open:0,pitch:22,tilt:-60,size:1.4,squash:.45,fat:1,col:0,ink:1,show:0,skin:1};
const COLS=[['빨강',0xe0553f],['파랑',0x3f7fe0],['노랑',0xf2c230],['초록',0x47b35a]];
const SR=opt.SR||.15,SH=opt.SH||.066;
const INK=0x3b2a1f;
const scene=new THREE.Scene();
let cam=null,R=null;
const HAND=new THREE.Group();HAND.visible=false;
const inner=new THREE.Group();HAND.add(inner);
const wristG=new THREE.Group();HAND.add(wristG);   // 손목·팔뚝은 손을 세워도 판과 나란히
const mats={skin:null,wrist:null};
const SKIN_VS=`varying vec3 vN;varying vec3 vV;varying vec2 vUv;void main(){vUv=uv;vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vV=-mv.xyz;gl_Position=projectionMatrix*mv;}`;
const SKIN_FS=`uniform vec3 uBase;uniform vec3 uShade;uniform float uWrist;varying vec3 vN;varying vec3 vV;varying vec2 vUv;
void main(){vec3 n=normalize(vN);if(!gl_FrontFacing)n=-n;vec3 L=normalize(vec3(-.45,.75,.55));float ndl=dot(n,L),ndv=dot(n,normalize(vV));
 float s=max(1.-smoothstep(-.36,-.3,ndl),(1.-smoothstep(.2,.25,ndv))*(1.-smoothstep(.35,.45,ndl)));   // 빛 반대쪽 + 아래쪽 가장자리를 따라 그늘 한 단
 float a=uWrist>.5?clamp((1.-vUv.y)/.75,0.,1.):1.;gl_FragColor=vec4(mix(uBase,uShade,s),a);}`;
function skinMat(wrist){const c=new THREE.Color(COLS[S.col][1]),hsl={};c.getHSL(hsl);
  const base=new THREE.Color().setHSL(hsl.h,Math.min(1,hsl.s*.85),Math.min(.82,hsl.l+.17));   // 밝은 면: 플레이어 색을 밝게
  const shade=new THREE.Color().setHSL((hsl.h+.985)%1,Math.min(1,hsl.s*1.05),hsl.l+.02);   // 그늘: 진하고 살짝 붉게 (그림의 분홍 그늘처럼)
  return new THREE.ShaderMaterial({uniforms:{uBase:{value:base},uShade:{value:shade},uWrist:{value:wrist?1:0}},vertexShader:SKIN_VS,fragmentShader:SKIN_FS})}
function mkMats(){mats.skin=skinMat(0);mats.wrist=skinMat(1)}
/* 마디 하나: +X로 길이 L, 굵기 r0 → r1 (양 끝 둥글게) */
function capGeo(L,r0,r1){
  const pts=[],n=8;
  for(let k=0;k<=n;k++){const a=-Math.PI/2+k/n*Math.PI/2;pts.push(new THREE.Vector2(Math.cos(a)*r0,Math.sin(a)*r0))}
  for(let k=0;k<=n;k++){const a=k/n*Math.PI/2;pts.push(new THREE.Vector2(Math.cos(a)*r1,L+Math.sin(a)*r1))}
  const g=new THREE.LatheGeometry(pts,28);g.rotateZ(-Math.PI/2);return g;   // 세로(Y) → 앞(X)
}
const all=[];
function addPart(parent,geo,kind){const m=new THREE.Mesh(geo,kind==='wrist'?mats.wrist:mats.skin);m.layers.set(1);parent.add(m);all.push({m,kind});return m}
/* 손가락: 뿌리(관절 묶음) → 마디 3개. 각 관절은 Z축으로 아래(손바닥 쪽)로 굽음 */
/* 손톱 선: 손끝 마디 위에 손톱 뿌리 쪽으로 볼록한 짧은 활 (그림처럼 선만, 손톱 색은 없음) */
const inkMat=new THREE.MeshBasicMaterial({color:INK});
function nailLine(par,L,r){const x0=L-r*.15,c=new THREE.CatmullRomCurve3([new THREE.Vector3(x0,r*.8,-r*.6),new THREE.Vector3(x0-r*.32,r*1.02,0),new THREE.Vector3(x0,r*.8,r*.6)]);
  const m=new THREE.Mesh(new THREE.TubeGeometry(c,10,.0024,5,false),inkMat);m.layers.set(1);par.add(m)}
function finger(base,lens,r0,r1,nail){
  const F=S.fat,root=new THREE.Group();root.position.set(...base);inner.add(root);
  const joints=[];let par=root;const rs=[r0,r0+(r1-r0)*.45,r0+(r1-r0)*.75,r1].map(v=>v*F);
  lens.forEach((L,k)=>{const j=new THREE.Group();if(k)j.position.x=lens[k-1];par.add(j);joints.push(j);
    addPart(j,capGeo(L,rs[k],rs[k+1]),'skin');par=j});
  const tip=new THREE.Object3D();tip.position.x=lens[lens.length-1]+rs[3]*.6;par.add(tip);
  if(nail)nailLine(par,lens[lens.length-1],rs[3]);
  return {root,joints,tip,lens};
}
let HS=null;   // 손 뼈대
const HZ=-1;   // 엄지 쪽 (-Z): 오른손 (손등이 위, 손가락이 앞으로 뻗었을 때 엄지가 왼쪽)
function buildHand(){
  inner.clear();wristG.clear();all.length=0;mkMats();
  const F=S.fat;
  // 손등: 손 모양 윤곽 (x 앞, y 옆: 엄지 쪽이 +, 마지막에 HZ로 오른손 방향). 손바닥 길이 ≈ 중지 길이
  const sh=new THREE.Shape(),Y=v=>v*HZ*-1*1.12;   // 1.12: 손등 폭 (실제 손 사진에 맞춤)   // 모양 y → 월드 -z 방향을 맞춤 (rotateX 뒤 z=y)
  // 그림처럼: 손목 쪽이 좁고 손가락 뿌리 쪽이 넓은 사다리꼴, 손가락 뿌리 줄은 검지 쪽이 앞으로, 검지와 엄지 사이는 오목하게 파임
  sh.moveTo(-.235,Y(-.06));sh.quadraticCurveTo(-.13,Y(-.071),-.026,Y(-.0695));sh.quadraticCurveTo(-.002,Y(-.068),.0,Y(-.04));   // 소지 쪽: 손목→소지 뿌리까지 곧게 (소지 바깥선과 한 줄)
  sh.quadraticCurveTo(.014,Y(.0),.01,Y(.05));sh.quadraticCurveTo(.006,Y(.074),-.025,Y(.0778));   // 검지 쪽: 바깥면이 검지 바깥면(뿌리 z .08 + 굵기)과 같은 줄
  sh.quadraticCurveTo(-.09,Y(.08),-.14,Y(.1));sh.quadraticCurveTo(-.19,Y(.082),-.235,Y(.06));sh.closePath();   // 엄지 쪽: 엄지 뿌리 → 손목까지 혹 없이 곧게 (손목 굵기와 같은 폭)
  const ex=(b)=>{const g=new THREE.ExtrudeGeometry(sh,{depth:.026,bevelEnabled:true,bevelThickness:.02+b,bevelSize:.02+b,bevelSegments:5,curveSegments:20});g.rotateX(-Math.PI/2);g.translate(0,-.013,0);return g};
  addPart(inner,ex(0),'skin');
  // 엄지 뿌리 살(손바닥 쪽 도톰한 곳): 손등 엄지 쪽 아래
  {const tg=b=>{const g=new THREE.SphereGeometry(1,22,14);g.scale(.075+b,.032+b,.042+b);g.rotateY(HZ*-.35);g.translate(-.16,-.028,HZ*.088);return g};
   addPart(inner,tg(0),'skin')}
  // 손목: 짧게, 끝은 흐리게
  {const wg=b=>{const g=new THREE.CylinderGeometry(.086+b,.09+b,.22,24,1,true);g.rotateZ(Math.PI/2);g.scale(1,.66,1);g.translate(-.085,0,0);return g};
   addPart(wristG,wg(0),'wrist')}
  // 손가락: 뿌리는 손등 앞 가장자리에 붙여서 (검지가 엄지 쪽)
  const fs={
    index:finger([.0,.008,HZ*.08],[.09,.055,.045],.027,.021,true),
    middle:finger([.008,.008,HZ*.027],[.1,.062,.05],.028,.022,true),
    ring:finger([.002,.006,HZ*-.027],[.093,.058,.047],.026,.021,true),
    pinky:finger([-.018,.003,HZ*-.075],[.07,.045,.04],.023,.018,true)};
  // 엄지 뼈대 (실제 손뼈 비율): 손허리뼈 CMC→MCP .10(손바닥 살 속, 아래 mc), 첫마디 .068, 끝마디 .057. 길이는 늘지 않음
  const t1=new THREE.Group(),t2=new THREE.Group();inner.add(t1,t2);
  const r=[.032,.029,.024].map(v=>v*F),TL=[.068,.048],LM=.10;   // 손뼈 실측 비율(첫마디 29.8mm·끝마디 20.9mm, 중지 첫마디 43.6mm = .1)   // 엄지는 검지보다 조금만 굵게
  const s1=new THREE.Group(),s2=new THREE.Group();t1.add(s1);t2.add(s2);
  addPart(s1,capGeo(TL[0],r[0],r[1]),'skin');
  addPart(s2,capGeo(TL[1],r[1],r[2]),'skin');nailLine(s2,TL[1],r[2]);
  // 엄지 손허리뼈: 손목 엄지 쪽 모서리(CMC)에서 엄지 뿌리까지 이어 주는 살 → 손목부터 엄지까지 바깥선이 한 줄로. 엄지 뿌리가 움직이면 따라 접힘
  const mc=new THREE.Group();inner.add(mc);
  {const rc=.03*F,cg=new THREE.CylinderGeometry(r[0],rc,1,22,1,true);cg.rotateZ(-Math.PI/2);cg.translate(.5,0,0);
   const cm=addPart(mc,cg,'skin');cm.userData.len=1;addPart(mc,new THREE.SphereGeometry(rc,22,14),'skin');mc.userData.cyl=cm}
  // 엄지 두덩(손허리뼈를 덮는 살)과 물갈퀴(엄지·검지 사이 살): 손허리뼈가 손가락처럼 따로 보이지 않고 손바닥으로 보이게. 매 프레임 두 점 사이에 늘여 둠
  const blob=()=>{const g=new THREE.Group();inner.add(g);addPart(g,new THREE.SphereGeometry(1,26,16),'skin');return g};
  const thn=blob();mc.visible=false;   // 예전 손허리뼈 원기둥은 안 씀(두덩 살이 대신)
  // 물갈퀴 살막: 위·아래 두 겹 + 옆면. 점 위치는 매 프레임 poseHand가 채움
  const webG=new THREE.BufferGeometry();webG.setAttribute('position',new THREE.BufferAttribute(new Float32Array(14*3),3));
  {const idx=[],N=6;for(let i=0;i<N;i++){const a=1+i,b=1+(i+1)%N;idx.push(0,a,b, 7,7+b,7+a, a,7+a,7+b, a,7+b,b)}webG.setIndex(idx)}
  const webM=addPart(inner,webG,'skin');webM.frustumCulled=false;webM.material=webM.material.clone();webM.material.side=THREE.DoubleSide;
  HS={fs,thumb:{mc,cmc:new THREE.Vector3(-.15,-.045,HZ*.055),wr:new THREE.Vector3(-.226,-.004,HZ*.06),LM,t1,t2,s1,s2,TL,r2:r[2],thn,webG,webM,iRoot:fs.index.root.position.clone()},tgt:null};
  buildBones();   // CMC: 큰마름뼈 자리(손목 주름 바로 앞, 엄지 쪽·손바닥 쪽)
}
const D2R=Math.PI/180,lerp=(a,b,t)=>a+(b-a)*t,lerpA=(a,b,t)=>a.map((v,k)=>lerp(v,b[k],t));
/* ===== 손뼈대 (오른손, 실측 평균) =====
   길이(mm): 손허리뼈 I 47.5 · II 68.8 · III 66.6 · IV 59.2 · V 52.8 (PMC11436343, 남성 평균)
            손가락뼈 첫·중간·끝마디: 엄지 29.8/-/20.9 · 검지 39.2/21.3/15.3 · 중지 43.6/25.8/16.2 · 약지 41.0/24.5/16.6 · 소지 31.9/17.1/14.9 (J Musculoskelet Surg Res)
   좌표(mm): 손목 관절(요골 끝) 가운데가 0, x 손가락 쪽, y 손등 쪽, t 엄지 쪽(+). 장면 단위 = mm × BS (중지 첫마디 43.6mm = .1)
   손허리뼈 바닥은 손목뼈 둘째 줄에 모여 있고 머리(손가락 뿌리 관절, MCP)로 갈수록 부채꼴로 벌어짐. 머리 줄은 검지·중지가 가장 앞, 약지·소지는 뒤로.
   손바닥은 가로로 오목(가로 손바닥 활): 약지·소지 쪽 머리가 조금 아래(손바닥 쪽). 관절 사이는 연골 틈 3mm.
   엄지 CMC(큰마름뼈와 엄지 손허리뼈의 안장 관절)는 손바닥 쪽으로 깊고, 엄지 사슬은 손가락들과 약 90도 돌아 있어 손톱이 바깥을 봄 */
const BS=.1/43.6,BGAP=3;
const BONE={
  index:{mc:68.8,base:[31,1,11],head:[-1,25],ph:[39.2,21.3,15.3]},
  middle:{mc:66.6,base:[33,0,0],head:[2,5],ph:[43.6,25.8,16.2]},
  ring:{mc:59.2,base:[31,-1,-10],head:[.5,-15],ph:[41.0,24.5,16.6]},
  pinky:{mc:52.8,base:[28,-3,-19],head:[-3.5,-33],ph:[31.9,17.1,14.9]},   // 손가락 뿌리 관절은 중지·약지가 살짝 높은 아치
  thumb:{mc:47.5,cmc:[21,-11,23],ph:[29.8,20.9]},
  carpal:[   // 손목뼈 8개: 가운데 [x,y,t], 크기 [x,y,t] (mm)
    ['손배뼈',[12,-2,16],[20,10,12]],['반달뼈',[11,0,3],[15,11,13]],['세모뼈',[10,-1,-10],[13,10,11]],['콩알뼈',[8,-9,-14],[9,8,9]],
    ['큰마름뼈',[25,-6,21],[14,10,13]],['작은마름뼈',[27,0,11],[11,10,10]],['알머리뼈',[24,0,0],[20,12,13]],['갈고리뼈',[24,-1,-13],[17,11,13]]]};
// 머리 x: 바닥에서 손허리뼈 길이만큼 (옆·아래로 벌어진 만큼 줄어듦)
for(const k of ['index','middle','ring','pinky']){const b=BONE[k],dy=b.head[0]-b.base[1],dt=b.head[1]-b.base[2];b.hx=b.base[0]+Math.sqrt(b.mc*b.mc-dy*dy-dt*dt)}
const BX0=BONE.middle.hx;   // 중지 MCP가 장면 x=0 (살 손가락 뿌리 자리와 같음)
const bp=(x,y,t)=>new THREE.Vector3((x-BX0)*BS,y*BS,HZ*t*BS);
/* 뼈 하나: +X로 길이 L(mm), 바닥·몸통·머리 반지름(mm). 양 끝이 뭉툭하게 부푼 긴뼈 모양 */
function boneGeo(L,rb,rs,rh,grow){
  const pts=[],N=26;for(let i=0;i<=N;i++){const t=i/N,e=Math.pow(Math.abs(2*t-1),6),cap=Math.sqrt(Math.max(0,1-Math.pow(Math.abs(2*t-1),10)));
    const r=(rs+(rb-rs)*Math.exp(-Math.pow(t/.16,2))+(rh-rs)*Math.exp(-Math.pow((1-t)/.16,2)))*cap+grow;pts.push(new THREE.Vector2(Math.max(0,r)*BS,t*L*BS))}
  pts[0].x=0;pts[N].x=0;const g=new THREE.LatheGeometry(pts,14);g.rotateZ(-Math.PI/2);return g}
const boneMat=new THREE.ShaderMaterial({uniforms:{uBase:{value:new THREE.Color(0xf3ead7)},uShade:{value:new THREE.Color(0xcbb894)},uWrist:{value:0}},vertexShader:SKIN_VS,fragmentShader:SKIN_FS});
const boneInk=new THREE.MeshBasicMaterial({color:0x5a4632,side:THREE.BackSide});
function addBone(par,L,rb,rs,rh,x0){const g=new THREE.Group();g.position.x=(x0||0)*BS;par.add(g);
  const m=new THREE.Mesh(boneGeo(L,rb,rs,rh,0),boneMat),h=new THREE.Mesh(boneGeo(L,rb,rs,rh,.7),boneInk);g.add(m,h);return g}
let SK=null;
function buildBones(){
  SK=new THREE.Group();inner.add(SK);const fsk={},segs=[];   // segs: 손허리뼈 4개, 손가락뼈 12개 순서 (살 붙일 때 씀)
  // 손목뼈
  for(const [,c,z] of BONE.carpal){const g=new THREE.SphereGeometry(1,16,12),m=new THREE.Mesh(g,boneMat),h=new THREE.Mesh(g,boneInk);
    m.scale.set(z[0]/2*BS,z[1]/2*BS,z[2]/2*BS);h.scale.copy(m.scale).multiplyScalar(1.08);m.position.copy(bp(...c));h.position.copy(m.position);SK.add(m,h)}
  // 네 손가락: 손허리뼈(바닥→머리) + 손가락뼈 셋. 관절 축 묶음은 살 손가락과 같은 구조(뿌리 → 관절 3개)라 각도를 그대로 옮겨 씀
  const R={index:[4.2,3.8,3.2],middle:[4.4,4,3.3],ring:[4,3.6,3.1],pinky:[3.6,3.3,2.8]};
  for(const k of ['index','middle','ring','pinky']){const b=BONE[k],base=bp(...b.base),head=bp(b.hx,b.head[0],b.head[1]),r=R[k];
    const mg=new THREE.Group();mg.position.copy(base);mg.quaternion.setFromUnitVectors(new THREE.Vector3(1,0,0),head.clone().sub(base).normalize());SK.add(mg);
    segs.push({g:addBone(mg,b.mc,r[0]*1.5,r[0],r[0]*1.45),L:b.mc});
    const root=new THREE.Group();root.position.copy(head);SK.add(root);const joints=[];let par=root;
    b.ph.forEach((L,i)=>{const j=new THREE.Group();if(i)j.position.x=(b.ph[i-1]+BGAP)*BS;else j.position.x=0;par.add(j);joints.push(j);
      segs.push({g:addBone(j,L,r[i]*1.35,r[i]*.85,i<2?r[i]*1.2:r[i]*1.25,BGAP*.5),L});par=j});
    fsk[k]={root,joints}}
  // 엄지: 손허리뼈 · 첫마디 · 끝마디 (자리는 poseBones가 매번 정함)
  const tb=BONE.thumb,th=[addBone(SK,tb.mc,6.5,4.6,6),addBone(SK,tb.ph[0],5.6,3.9,5),addBone(SK,tb.ph[1],4.8,3.2,4.4)];
  SK.userData={fsk,th,segs};
  buildSkin();
}
/* 뼈 자세: 네 손가락은 살 손가락의 관절 각도를 그대로, 엄지는 살 엄지와 같은 방법(한 평면 각도 사슬)으로 뼈 길이로 다시 풂 */
/* ===== 살: 뼈대 위에 붙인 살 (거리 함수 + 광선 따라가기) =====
   뼈마다 끝이 둥근 원뿔(굵기 = 살 두께)을 두고, 손바닥 덩어리끼리는 넓게 부드럽게 녹여 붙임(손허리뼈 4개 + 손목 + 엄지 두덩 + 팔뚝),
   손가락은 자기 마디끼리 녹이고 손바닥과는 뿌리에서만 녹임. 손가락끼리는 녹이지 않음(붙어도 벙어리장갑이 안 되게).
   손을 둘러싼 상자에 그려서 화면 점마다 광선을 따라가 살 표면을 찾고, 깊이도 써서 윤곽선·알 가림이 예전처럼 됨 */
const SKN=24;   // 0~3 손허리뼈(검지~소지) 4 손목 5 팔뚝 6 엄지 손허리뼈 7 엄지 두덩 8~9 엄지 첫·끝마디 10~21 네 손가락 첫·중간·끝마디 22 새끼 두덩 23 엄지모음근·첫째 등쪽 뼈사이근
const SKIN2_FS=`
uniform vec3 uA[${SKN}];uniform vec3 uB[${SKN}];uniform vec2 uR[${SKN}];uniform vec3 uS[${SKN}];
uniform mat4 uMV;uniform mat4 projectionMatrix;uniform mat3 uNM;   // inner 기준 (상자 자체의 위치·크기는 빼고)
uniform vec3 uCam;uniform vec3 uMin;uniform vec3 uMax;uniform vec3 uBase;uniform vec3 uShade;uniform vec2 uFade;uniform float uK[4];uniform float uDbg;uniform vec2 uPv[4];uniform vec3 uPs;uniform vec3 uFa[5];uniform vec3 uFb[5];uniform float uFr[5];
varying vec3 vL;
float rc(vec3 p,int i){vec3 sc=uS[i];vec3 a=uA[i]*sc,b=uB[i]*sc;p*=sc;float r1=uR[i].x,r2=uR[i].y;   // 끝이 둥근 원뿔 (iq)
  vec3 ba=b-a;float l2=dot(ba,ba),rr=r1-r2,a2=l2-rr*rr,il2=1./l2;vec3 pa=p-a;float y=dot(pa,ba),z=y-l2;vec3 xv=pa*l2-ba*y;float x2=dot(xv,xv),y2=y*y*l2,z2=z*z*l2;
  float k=sign(rr)*rr*rr*x2,d;
  if(sign(z)*a2*z2>k)d=sqrt(x2+z2)*il2-r2;else if(sign(y)*a2*y2<k)d=sqrt(x2+y2)*il2-r1;else d=(sqrt(x2*a2*il2)+y*rr)*il2-r1;
  return d/max(sc.x,max(sc.y,sc.z));}
// 손바닥 판: 네 꼭짓점(검지 머리 바깥 · 소지 머리 바깥 · 손목 소지 쪽 · 손목 엄지 쪽)으로 만든 판을 두께만큼 세우고 모서리를 둥글게 → 가장자리가 곧고 매끈
float palmSlab(vec3 p){vec2 q=p.xz;float d=dot(q-uPv[0],q-uPv[0]),sg=1.;
  for(int i=0;i<4;i++){int j=i==0?3:i-1;vec2 e=uPv[j]-uPv[i],w=q-uPv[i],b=w-e*clamp(dot(w,e)/dot(e,e),0.,1.);d=min(d,dot(b,b));
    bvec3 c=bvec3(q.y>=uPv[i].y,q.y<uPv[j].y,e.x*w.y>e.y*w.x);if(all(c)||all(not(c)))sg*=-1.;}
  float d2=sg*sqrt(d)+uPs.z,dy=abs(p.y-uPs.x)-uPs.y;   // uPs: 가운데 높이, 반두께, 둥근 모서리
  return length(max(vec2(d2,dy),0.))+min(max(d2,dy),0.)-uPs.z;}
float sm(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}
float map(vec3 p){
  float pm=palmSlab(p);for(int i=0;i<4;i++)pm=sm(pm,rc(p,i),uK[0]*.5);   // 손허리뼈는 손등에 살짝 드러나는 정도
  pm=sm(pm,rc(p,4),uK[0]);pm=sm(pm,rc(p,5),uK[0]);pm=sm(pm,rc(p,7),uK[1]);pm=sm(pm,rc(p,6),uK[1]);pm=sm(pm,rc(p,23),uK[1]);
  float d=pm;
  // 손가락 하나씩: 손가락 전체를 감싸는 굵은 캡슐보다 멀면 계산을 건너뜀 (빠르게)
  for(int f=0;f<5;f++){vec3 pa=p-uFa[f],ba=uFb[f]-uFa[f];float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);if(length(pa-ba*h)-uFr[f]>d+uK[3])continue;
    float fd;if(f==4)fd=sm(rc(p,8),rc(p,9),uK[2]);else{int i=10+f*3;fd=sm(sm(rc(p,i),rc(p,i+1),uK[2]),rc(p,i+2),uK[2]);}
    d=min(d,sm(pm,fd,uK[3]));}
  return d;}
vec3 nrm(vec3 p){vec2 e=vec2(.0016,-.0016);   // 넓게 재서 매끈한 법선 (그늘 경계가 깔끔하게)
 return normalize(e.xyy*map(p+e.xyy)+e.yyx*map(p+e.yyx)+e.yxy*map(p+e.yxy)+e.xxx*map(p+e.xxx));}
void main(){
  vec3 ro=uCam,rd=normalize(vL-uCam),iv=1./rd,t0=(uMin-ro)*iv,t1=(uMax-ro)*iv,tn=min(t0,t1),tf=max(t0,t1);
  float t=max(max(max(tn.x,tn.y),tn.z),0.),te=min(min(tf.x,tf.y),tf.z);bool hit=false;
  float dl=1.;for(int i=0;i<140;i++){vec3 p=ro+rd*t;float d=map(p);dl=d;if(d<.0004){hit=true;break;}t+=d*.95;if(t>te)break;}   // 비스듬히 볼 때(손끝·손목 쪽)는 길게 따라가야 해서 넉넉히
  if(!hit)discard;
  for(int i=0;i<3;i++)t+=map(ro+rd*t);   // 표면 위치를 몇 번 더 다듬음 (비스듬한 손날에서 깊이·법선이 들쭉날쭉하지 않게)
  vec3 p=ro+rd*t,n=normalize(uNM*nrm(p));vec4 mv=uMV*vec4(p,1.);vec3 V=normalize(-mv.xyz);
  vec3 L=normalize(vec3(-.45,.75,.55));float ndl=dot(n,L),ndv=dot(n,V);
  float w1=min(fwidth(ndl),.08)*1.2+.004,w2=min(fwidth(ndv),.08)*1.2+.004;   // 화면 한 칸 너비만큼만 부드럽게: 그늘 경계가 톱니 없이 매끈한 곡선
  float s=max(1.-smoothstep(-.33-w1,-.33+w1,ndl),(1.-smoothstep(.17-w2,.17+w2,ndv))*(1.-smoothstep(.4-w1,.4+w1,ndl)));
  float a=clamp((p.x-uFade.y)/(uFade.x-uFade.y),0.,1.);
  float bi=1.,bd=palmSlab(p);for(int i=0;i<8;i++){if(i==5)continue;bd=min(bd,rc(p,i));}bd=min(bd,rc(p,23));
  {float q=rc(p,8);if(q<bd){bd=q;bi=2.;}q=rc(p,9);if(q<bd){bd=q;bi=3.;}for(int i=10;i<22;i++){q=rc(p,i);if(q<bd){bd=q;bi=float(i-6);}}}
  gl_FragColor=vec4(mix(uBase,uShade,s),(floor(a*15.+.5)*16.+bi)/255.);   // 알파 = 흐림(위 4비트) + 살 조각 번호(아래 4비트): 윤곽선이 조각끼리 경계를 알 수 있게
  if(uDbg>.5){float m=palmSlab(p);vec3 c=vec3(1,.3,.3);   // 점검용: 가장 가까운 살 조각 색
    float q;q=rc(p,5);if(q<m){m=q;c=vec3(.3,.4,1);}q=rc(p,7);if(q<m){m=q;c=vec3(.2,.8,.2);}q=rc(p,6);if(q<m){m=q;c=vec3(1,.9,.1);}q=rc(p,23);if(q<m){m=q;c=vec3(.1,.9,.9);}
    for(int i=0;i<4;i++){q=rc(p,i);if(q<m){m=q;c=vec3(.9,.3,.9);}}for(int i=8;i<22;i++){q=rc(p,i);if(q<m){m=q;c=vec3(.95,.85,.75);}}gl_FragColor.rgb=c*(.55+.45*(1.-s));}
  vec4 cp=projectionMatrix*mv;gl_FragDepthEXT=(cp.z/cp.w)*.5+.5;}`;
let SKIN=null;
function buildSkin(){
  const box=new THREE.BoxGeometry(1,1,1),u={uA:{value:[]},uB:{value:[]},uR:{value:[]},uS:{value:[]},uCam:{value:new THREE.Vector3()},
    uMin:{value:new THREE.Vector3(-.62,-.13,-.2)},uMax:{value:new THREE.Vector3(.2,.16,.2)},uBase:{value:mats.skin.uniforms.uBase.value},uShade:{value:mats.skin.uniforms.uShade.value},
    uFade:{value:new THREE.Vector2(-.25,-.33)},uK:{value:[8*BS,10*BS,1.5*BS,9*BS]},uFa:{value:[0,1,2,3,4].map(()=>new THREE.Vector3())},uFb:{value:[0,1,2,3,4].map(()=>new THREE.Vector3(.001,0,0))},uFr:{value:[0,0,0,0,0]},uMV:{value:new THREE.Matrix4()},uDbg:{value:0},uPv:{value:[0,1,2,3].map(()=>new THREE.Vector2())},uPs:{value:new THREE.Vector3()},uNM:{value:new THREE.Matrix3()}};
  for(let i=0;i<SKN;i++){u.uA.value.push(new THREE.Vector3());u.uB.value.push(new THREE.Vector3(.001,0,0));u.uR.value.push(new THREE.Vector2(.01,.01));u.uS.value.push(new THREE.Vector3(1,1,1))}
  const mat=new THREE.ShaderMaterial({uniforms:u,side:THREE.BackSide,extensions:{fragDepth:true},
    vertexShader:`uniform vec3 uMin;uniform vec3 uMax;varying vec3 vL;void main(){vL=uMin+(position+.5)*(uMax-uMin);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:SKIN2_FS});
  // 상자: uMin~uMax
  SKIN=new THREE.Mesh(box,mat);SKIN.layers.set(1);   // 상자 자리·크기는 poseSkin이 매번 살 범위에 맞춤
  SKIN.frustumCulled=false;inner.add(SKIN);
}
/* 살 두께(mm, 반지름): [시작, 끝]. 손바닥(손허리뼈)은 두께 방향(y)으로 두껍고 옆(z)으로 얇게 */
const FLESH={mc:[[11,10.5],[11,10.5],[10.5,10],[10,10]],fin:{index:[[10.6,9.4],[9.2,8.2],[8,6.8]],middle:[[11,9.8],[9.6,8.6],[8.4,7.1]],ring:[[10.4,9.2],[9,8],[7.8,6.7]],pinky:[[9.3,8.2],[8,7.2],[7,6]]},   // 뿌리에서 끝으로 가늘어짐
  th:[[10,9.5],[11,9.6],[9.4,7.6]]};
function poseSkin(){
  if(!SKIN)return;const u=SKIN.material.uniforms,{segs,th}=SK.userData;inner.updateMatrixWorld(true);
  const L=(g,x)=>inner.worldToLocal(g.localToWorld(new THREE.Vector3(x,0,0)));
  const put=(i,a,b,r1,r2,sc)=>{u.uA.value[i].copy(a);u.uB.value[i].copy(b);u.uR.value[i].set(r1*BS,r2*BS);u.uS.value[i].copy(sc||new THREE.Vector3(1,1,1))};
  const flat=new THREE.Vector3(1,1,1.3);   // 손바닥: 옆으로 납작 (두께 쪽이 1.3배)
  ['index','middle','ring','pinky'].forEach((nm,k)=>{const sg=segs[k*4],bend=Math.min(1,Math.max(0,-HS.fs[nm].joints[0].rotation.z/(50*D2R)));put(k,L(sg.g,sg.L*BS*.3),L(sg.g,sg.L*BS),5,5.5+3*bend)});   // 손허리뼈 머리(주먹 마디): 편 손가락은 손바닥 판 안에 묻히고, 굽힌 손가락만 둥글게 드러나 손등에서 첫 마디로 꺼지지 않음   // 손등의 손허리뼈 줄기와 머리(주먹 마디): 손가락이 굽어도 마디가 둥글게 남아 손등에서 첫 마디로 푹 꺼지지 않음   // 손등의 손허리뼈 줄기·마디(주먹 마디)
  {const bi=BONE.index,bk=BONE.pinky,PR=7,P=(x,t)=>{const v=bp(x,0,t);return new THREE.Vector2(v.x,v.z)};
   // 판의 끝(손가락 쪽)은 손허리뼈 머리보다 조금 뒤 → 손가락이 손바닥에 묻히지 않고 마디부터 보임
   const v=[P(bi.hx-2,bi.head[1]+FLESH.fin.index[0][0]),P(bk.hx-2,bk.head[1]-FLESH.fin.pinky[0][0]),P(6,-27),P(6,25)];if(HZ<0)v.reverse();   // 손가락 쪽 꼭짓점은 검지·소지 바깥면과 같은 줄(턱 없음), 손목 쪽은 손목뼈 자리에서 팔뚝과 같은 폭(약 52mm, 손바닥의 7할)으로 곧게 좁아짐
   v.forEach((q,i)=>u.uPv.value[i].copy(q));u.uPs.value.set(-2*BS,2.5*BS,12.5*BS)}   // 손바닥 판: 모서리를 두께의 대부분만큼 둥글게(베개 모양) → 옆에서 봐도 판자가 아니라 손
  put(4,bp(22,5,2),bp(84,6,-5),15,14,new THREE.Vector3(1,1.7,.72));   // 손등 볼록: 손허리뼈 가운데를 덮는 낮고 넓은 둔덕 (옆에서 봐도 판자가 아니게)
  // 새끼 두덩(새끼손가락 쪽 손바닥 가장자리): 소지 손허리뼈 머리 → 손목 소지 쪽(콩알뼈). 가장자리를 한 줄로 매끈하게
  put(22,bp(0,0,0),bp(1,0,0),.1,.1);   // (안 씀: 손바닥 판이 대신)
  put(5,bp(10,-2,-1),bp(-150,-4,0),26.5,28,new THREE.Vector3(1,1.75,1));   // 손목 단면: 너비 약 53mm × 두께 약 30mm 타원 — 손바닥 손목 쪽 끝과 같은 폭으로 이어짐   // 팔뚝: 손목에서 손바닥 판과 같은 폭으로 시작해 뒤로 갈수록 천천히 굵어짐(흐려짐)
  // 엄지 쪽 가장자리(손목→엄지 뿌리)는 엄지 두덩 근육(짧은엄지벌림근·짧은엄지굽힘근·엄지맞섬근)이 엄지 손허리뼈를 손바닥 쪽에서 덮어 한 줄의 볼록한 곡선.
  // 손허리뼈 살은 두덩 안에 묻히게 가늘게, 두덩은 손목 엄지 쪽(손배뼈·큰마름뼈)에서 엄지 뿌리 관절까지 하나로 → 따로 솟는 혹이 없음
  const tb=BONE.thumb;put(6,L(th[0],tb.mc*BS*.25),L(th[0],tb.mc*BS),7,8.5);   // 엄지 손허리뼈 (손등 쪽에서 살짝 만져지는 정도)
  put(7,bp(14,-8,15),L(th[0],tb.mc*BS*.85).add(new THREE.Vector3(0,-4*BS,0)),11,13.5);   // 엄지 두덩: 손목 쪽은 가늘게 시작해 엄지 뿌리 쪽으로 도톰하게 (손목 위에 혹이 나지 않게)
  // 엄지모음근·첫째 등쪽 뼈사이근: 엄지 손허리뼈 끝 쪽 ↔ 검지 손허리뼈 끝 쪽 사이를 채우는 살 (엄지와 검지 사이 물갈퀴 바닥)
  {const m2=segs[0];put(23,L(th[0],tb.mc*BS*.7).add(new THREE.Vector3(0,-3*BS,0)),L(m2.g,m2.L*BS*.75).add(new THREE.Vector3(0,-3*BS,0)),7,6.5)}   // 엄지모음근·첫째 등쪽 뼈사이근 (엄지·검지 손허리뼈 사이, 손바닥 쪽으로 조금)
  put(8,L(th[1],0),L(th[1],tb.ph[0]*BS),FLESH.th[1][0],FLESH.th[1][1]);put(9,L(th[2],0),L(th[2],tb.ph[1]*BS),FLESH.th[2][0],FLESH.th[2][1]);
  // 손가락: 마디 살이 관절 점을 정확히 같이 쓰고(틈 없음), 굵기는 뿌리→끝까지 한 직선으로 가늘어짐 → 펴면 매끈한 원뿔 기둥, 마디마다 불룩하지 않음
  ['index','middle','ring','pinky'].forEach((k,f)=>{const ph=BONE[k].ph,Lt=ph[0]+ph[1]+ph[2]+2*BGAP-2,r0=FLESH.fin[k][0][0],r1=FLESH.fin[k][2][1];let acc=0;
    for(let j=0;j<3;j++){const sg=segs[f*4+1+j],a=L(sg.g,0),Lj=j<2?ph[j]+BGAP:ph[j]-2,b=L(sg.g,Lj*BS);
    if(j===0)a.copy(L(segs[f*4].g,segs[f*4].L*BS));   // 첫마디 살은 손허리뼈 머리(손가락 뿌리 관절)부터
    const ra=r0+(r1-r0)*acc/Lt;acc+=Lj;const rb=r0+(r1-r0)*acc/Lt;put(10+f*3+j,a,b,ra,rb)}});
  // 손가락 묶음 캡슐(건너뛰기용)과 살 범위 상자
  for(let f=0;f<5;f++){const ids=f===4?[8,9]:[10+f*3,11+f*3,12+f*3],a=u.uA.value[ids[0]],b=u.uB.value[ids[ids.length-1]];u.uFa.value[f].copy(a);u.uFb.value[f].copy(b);
    const ba=b.clone().sub(a),l2=Math.max(1e-9,ba.lengthSq());let r=0;for(const i of ids)for(const q of [u.uA.value[i],u.uB.value[i]]){const h=Math.min(1,Math.max(0,q.clone().sub(a).dot(ba)/l2));r=Math.max(r,q.clone().sub(a.clone().addScaledVector(ba,h)).length()+u.uR.value[i].x)}
    u.uFr.value[f]=r+.004}
  const mn=new THREE.Vector3(1e9,1e9,1e9),mx=new THREE.Vector3(-1e9,-1e9,-1e9);
  for(let i=0;i<SKN;i++){if(i===5)continue;const r=Math.max(u.uR.value[i].x,u.uR.value[i].y)*Math.max(u.uS.value[i].x,u.uS.value[i].y,u.uS.value[i].z)+.03;for(const q of [u.uA.value[i],u.uB.value[i]]){mn.min(q.clone().subScalar(r));mx.max(q.clone().addScalar(r))}}   // 넉넉히(+3cm): 상자 가장자리에 걸린 손끝이 떨어진 조각으로 그려지던 것
  mn.x=Math.min(mn.x,u.uFade.value.y);mn.y=Math.min(mn.y,-.08);mx.y=Math.max(mx.y,.08);mn.z=Math.min(mn.z,-.09);mx.z=Math.max(mx.z,.09);   // 팔뚝(흐려지는 끝까지)도 넣음
  u.uMin.value.copy(mn);u.uMax.value.copy(mx);SKIN.position.copy(mn).add(mx).multiplyScalar(.5);SKIN.scale.copy(mx).sub(mn);
  cam.updateMatrixWorld();u.uCam.value.copy(inner.worldToLocal(new THREE.Vector3().setFromMatrixPosition(cam.matrixWorld)));
  cam.updateMatrixWorld();u.uMV.value.multiplyMatrices(cam.matrixWorldInverse,inner.matrixWorld);u.uNM.value.getNormalMatrix(u.uMV.value);
  u.uBase.value=mats.skin.uniforms.uBase.value;u.uShade.value=mats.skin.uniforms.uShade.value;
}
let PFL=0;
function poseBones(o,Y){
  if(!SK)return;const {fsk,th}=SK.userData;
  for(const k in fsk){const s=HS.fs[k],d=fsk[k];d.root.rotation.copy(s.root.rotation);d.joints.forEach((j,i)=>j.rotation.copy(s.joints[i].rotation))}
  const tb=BONE.thumb,CMC=bp(...tb.cmc),LM=tb.mc*BS,L1=(tb.ph[0]+BGAP)*BS,L2=tb.ph[1]*BS;
  // 받치는 자리: 중지 끝마디뼈 윗면(손톱 쪽)에서 살 두께만큼 (중지 살 .011 + 엄지 끝마디 살 .012)
  const dj=fsk.middle.joints[2];dj.updateWorldMatrix(true,false);
  const q=inner.worldToLocal(dj.localToWorld(new THREE.Vector3((BONE.middle.ph[2]*.6+BGAP*.5)*BS,0,0))),n=inner.worldToLocal(dj.localToWorld(new THREE.Vector3((BONE.middle.ph[2]*.6+BGAP*.5)*BS,1,0))).sub(q).normalize();
  SK.userData.tst=SK.userData.tst||{};const C=q.add(n.clone().multiplyScalar(.024)),ch=thumbChain(CMC,LM,L1,L2,C,o,Y,SK.userData.tst,PFL,n);
  const aimB=(g,from,to,up)=>{const x=to.clone().sub(from).normalize(),y=new THREE.Vector3().crossVectors(ch.Z,x).normalize(),z=new THREE.Vector3().crossVectors(x,y);g.position.copy(from);g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,z))};
  aimB(th[0],CMC,ch.B,ch.Y);aimB(th[1],ch.B.clone().add(ch.E.clone().sub(ch.B).normalize().multiplyScalar(BGAP*.5*BS)),ch.E,ch.Y);aimB(th[2],ch.E,ch.T,ch.Y);
}
/* 자세: p 당긴 힘(0 느슨 → 1 뻣뻣·꽉), fl 튕김(0 → 1 중지가 쭉) */
/* 엄지 사슬: CMC → 손허리뼈(LM) → MCP(a도) → 첫마디(L1) → IP(b도) → 끝마디(L2). 굽는 쪽은 늘 손바닥 쪽(-Y), 손톱은 +Y.
   딱밤은 IP 50도로 끝마디 살(끝마디 80% 자리)이 C에 오도록 MCP 각도를 찾고 모양을 통째로 돌려 맞춤, 편 손은 손허리뼈를 옆 앞으로 벌림. o로 섞음 */
function thumbChain(CMC,LM,L1,L2,C,o,DORS,st,fl,N){
  const LD=L2*.6,chain=(a,b)=>{const ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(a+b),sb=Math.sin(a+b);
    const M=[LM,0],E=[M[0]+L1*ca,-L1*sa];return {M,E,P:[E[0]+LD*cb,E[1]-LD*sb],T:[E[0]+L2*cb,E[1]-L2*sb]}};
  const place=(c,X,Y)=>{const f=q=>CMC.clone().add(X.clone().multiplyScalar(q[0])).add(Y.clone().multiplyScalar(q[1]));return {B:f(c.M),E:f(c.E),T:f(c.T),Y}};
  // 당길 때(fl 0): 엄지 지문(끝마디 60% 자리, 손바닥 쪽)이 중지 손톱에 닿게 풀고, 그 모양을 st에 기억.
  // 엄지가 굽는 평면은 중지 손톱이 보는 쪽(N)을 품게 → 지문과 손톱이 마주 봄.
  // 쏜 뒤(fl>0): 엄지는 기억한 자리에 그대로 두고 IP(손톱 쪽 첫 관절)만 50도 → 4도로 펴짐 (중지를 따라가지 않음)
  const IPB=50*D2R;
  const ck=fl<=0?[C.x,C.y,C.z,N?N.x:0,N?N.y:0,N?N.z:0].map(v=>Math.round(v*1e5)).join():'';   // 받칠 자리가 그대로면(당긴 정도가 같으면) 지난번 답을 그대로 씀
  if((fl<=0&&st.ck!==ck)||!st.X){st.ck=ck;const v=C.clone().sub(CMC),d=v.length(),u=v.normalize();let best=0,be=1e9;
    let bb=IPB;for(let a=0;a<=70;a+=1)for(let ib=14;ib<=60;ib+=2){const c=chain(a*D2R,ib*D2R),e=Math.abs(Math.hypot(c.P[0],c.P[1])-d)+Math.abs(ib-34)*.00004+Math.abs(a-22)*.00002;   /* 엄지는 MCP·IP가 함께 나눠 굽어 둥근 고리 (한 관절만 꺾이지 않게) */if(e<be){be=e;best=a;bb=ib*D2R}}   // IP는 50도 근처, 닿지 않으면 펴서 닿게
    st.res=be;st.ib=bb;const c=chain(best*D2R,bb),ph=Math.atan2(c.P[1],c.P[0]),w0=DORS.clone().sub(u.clone().multiplyScalar(DORS.dot(u))).normalize();
    // 엄지가 굽는 평면을 u 둘레로 돌려 고름: 지문(끝마디 손바닥 쪽)이 중지 손톱(N)을 마주 보게, 엄지 손톱은 되도록 바깥(DORS)을 보게
    let X,Y,bs=1e9;for(let rd=-90;rd<=90;rd+=3){const w=w0.clone().applyAxisAngle(u,rd*D2R);
      const x=u.clone().multiplyScalar(Math.cos(ph)).sub(w.clone().multiplyScalar(Math.sin(ph))),y=u.clone().multiplyScalar(Math.sin(ph)).add(w.clone().multiplyScalar(Math.cos(ph)));
      const ab=best*D2R+bb,nail=x.clone().multiplyScalar(Math.sin(ab)).add(y.clone().multiplyScalar(Math.cos(ab)));
      const sc=(N?-nail.dot(N):0)+.12*(1-y.dot(DORS));if(sc<bs){bs=sc;X=x;Y=y}}   // 엄지 손톱이 N 쪽 = 지문은 중지 손톱 반대편에서 마주 봄
    st.a=best*D2R;st.X=X;st.Y=Y}
  const F=place(chain(st.a,lerp(st.ib,4*D2R,Math.max(0,fl))),st.X,st.Y);
  let Op;{const X=new THREE.Vector3(.72,.16,HZ*.67).normalize(),Y=DORS.clone().sub(X.clone().multiplyScalar(DORS.dot(X))).normalize();Op=place(chain(8*D2R,8*D2R),X,Y)}
  const ZF=new THREE.Vector3().crossVectors(st.X,st.Y),XO=new THREE.Vector3(.72,.16,HZ*.67).normalize(),ZO=new THREE.Vector3().crossVectors(XO,DORS.clone().sub(XO.clone().multiplyScalar(DORS.dot(XO))).normalize());
  return {B:F.B.lerp(Op.B,o),E:F.E.lerp(Op.E,o),T:F.T.lerp(Op.T,o),Y:F.Y.clone().lerp(Op.Y,o).normalize(),Z:ZF.lerp(ZO,o).normalize()};   // Z: 굽는 평면의 법선 (마디 방향을 정할 때 씀: 크게 굽어도 손톱이 뒤집히지 않게)
}
function poseHand(p,fl){
  const set=(f,ang,yaw,lift)=>{f.root.rotation.set(0,(yaw||0)*D2R,(lift||0)*D2R);f.joints.forEach((j,k)=>{j.rotation.z=-ang[k]*D2R})};
  const {fs}=HS,sq=S.squash;
  const o=S.open||0,O=(a,b)=>lerpA(a,b,o),o1=(a,b)=>lerp(a,b,o);   // 손 펴기: 손가락은 살짝만 굽은 채 부채꼴로, 엄지는 옆으로 떨어져 뻗음
  set(fs.index,O(lerpA([10,12,-6],[-6,-2,-14],p),[2,2,0]),o1(lerp(2,13,p),14),o1(lerp(-4,8,p),0));
  set(fs.ring,O(lerpA([12,14,-4],[-4,-1,-12],p),[2,2,0]),o1(lerp(-2,-10,p),-5),o1(lerp(-4,8,p),0));
  set(fs.pinky,O(lerpA([14,16,-2],[-3,0,-10],p),[2,2,0]),o1(lerp(-4,-20,p),-12),o1(lerp(-4,8,p),0));   // 검지·약지·소지: 처음엔 살짝 굽었다가 당길수록 뻣뻣하게 펴져(끝까지 당기면 살짝 젖혀짐) 위로 들리고 벌어짐
  // 중지: 둘째 관절(손톱 쪽에서 두 번째)이 90도로 꺾이고, 뿌리에서 엄지 쪽으로 틀어 손끝이 엄지를 향함. 당길수록 뿌리·끝마디가 더 꽉, 튕기면 쭉
  const pc=S.pitch,straight=[pc*.6+18,pc*.3+10,pc*.1+6];
  const mid=lerpA(lerpA([48,74,42],[48+18*sq,78,42+20*sq],p),straight,fl);   // 세 마디에 고르게 나눠 둥근 고리
  set(fs.middle,O(mid,[2,2,0]),lerp(14,0,Math.max(fl,o)),0);
  // 엄지: 중지 손톱 바로 앞을 받침. 두 마디 길이를 거리에 맞춰 조금 굽은 채로 (손가락처럼 살짝만 굽음)
  inner.updateMatrixWorld(true);
  const tip=inner.worldToLocal(fs.middle.tip.getWorldPosition(new THREE.Vector3()));
  // 엄지 길이는 고정(늘이지 않음). 뿌리는 편 손에선 손목 가까이, 딱밤에선 손바닥 쪽으로 접혀 앞으로 나옴 (엄지 손허리뼈가 접히는 것 대신)
  // 실제 딱밤(영상): 엄지는 거의 곧게 앞으로 뻗고, 말린 중지 끝이 엄지 끝마디 살에 걸림 → 엄지는 그 자리를 지나 제 길이만큼 뻗음
  // 엄지가 중지를 받침: 받치는 자리 C = 중지 끝이 향한 쪽으로 두 손가락 굵기만큼. 엄지 끝마디 살(길이의 72%)이 C에 오도록
  // 엄지 뿌리를 C에서 거꾸로 정하고(엄지와 큰마름뼈 사이가 접힘) 손허리뼈 살이 따라감
  const Th=HS.thumb,L1=Th.TL[0],L2=Th.TL[1],LT=L1+L2;
  if(fl<=0){const j=fs.middle.joints[2],L=fs.middle.lens[2],q=j.localToWorld(new THREE.Vector3(L*.75,0,0)),n=j.localToWorld(new THREE.Vector3(L*.75,1,0)).sub(q).normalize();
    inner.worldToLocal(q);const nl=inner.worldToLocal(n.add(inner.localToWorld(new THREE.Vector3()))).normalize();   // 중지 손톱 쪽(끝마디 윗면)
    HS.C=q.add(nl.clone().multiplyScalar(.05*S.fat));HS.CN=nl}   // 엄지 지문이 중지 손톱에 닿는 자리: 손톱 위로 중지 살 + 엄지 끝마디 살 두께만큼
  if(!HS.C)HS.C=tip.clone();
  // 두 뼈 IK: 뿌리 A에서 길이 l1·l2로 목표 P에 닿게. 가운데 관절은 hint 쪽으로 튀어나옴 (손등·바깥쪽 = 관절이 굽는 반대쪽)
  const ik=(A,P,l1,l2,hint)=>{const v=P.clone().sub(A),d=Math.min(v.length(),(l1+l2)*.999),u=v.normalize(),a=(l1*l1-l2*l2+d*d)/(2*d),h=Math.sqrt(Math.max(0,l1*l1-a*a));
    const w=hint.clone().sub(u.clone().multiplyScalar(hint.dot(u))).normalize();return A.clone().add(u.clone().multiplyScalar(a)).add(w.multiplyScalar(h))};
  const DORS=new THREE.Vector3(0,.55,HZ*.83).normalize();   // 엄지 손등 쪽(손톱 쪽): 엄지는 손가락들과 90도 돌아 있어 바깥·위
  // 엄지 사슬을 각도로 만듦: CMC → 손허리뼈(LM) → MCP(a도 굽음) → 첫마디 → IP(b도 굽음) → 끝마디. 굽는 쪽은 늘 손바닥 쪽(-Y), 손톱은 +Y
  // (두 번 따로 IK를 풀면 MCP·IP가 서로 반대로 꺾여 Z자가 될 수 있어서, 한 평면 안의 각도로만 굽힘)
  HS.tst=HS.tst||{};const ch=thumbChain(Th.cmc,Th.LM,L1,L2,HS.C,o,DORS,HS.tst,fl,HS.CN),B=ch.B,E=ch.E,T=ch.T,TY=ch.Y,k=1;
  // 두덩(손허리뼈를 덮는 살): 손목 모서리 쪽에서 MCP 조금 앞까지 납작하게
  const span=(g,A,P,ry,rz)=>{const dv=P.clone().sub(A),L=dv.length();g.position.copy(A).add(P).multiplyScalar(.5);g.quaternion.setFromUnitVectors(new THREE.Vector3(1,0,0),dv.normalize());g.scale.set(L*.5,ry,rz)};
  {const dn=new THREE.Vector3(0,-.02,HZ*-.012);span(Th.thn,Th.wr.clone().lerp(B,.3).add(dn),B.clone().lerp(Th.wr,.06).add(dn),.026*S.fat,.028*S.fat)}   // 손바닥 쪽으로 조금 내려 손등 위로 혹처럼 솟지 않게
  // 물갈퀴: 검지 뿌리 옆 ~ 엄지 첫마디 40% 사이의 얇은 살막(가장자리는 손바닥 쪽으로 오목)
  Th.webM.visible=o>.02;   // 물갈퀴는 엄지를 벌렸을 때만 (딱밤에선 엄지가 손바닥 앞으로 와서 막이 기둥처럼 보였음)
  if(o>.02){const W=Th.webG,I0=Th.iRoot.clone().add(new THREE.Vector3(-.008,-.006,HZ*.016)),P1=B.clone().lerp(E,.42*o),P4=new THREE.Vector3(-.075,-.012,HZ*.06),Q=I0.clone().add(P1).add(B).add(P4).multiplyScalar(.25);
    const M1=I0.clone().lerp(P1,.33).lerp(Q,.28),M2=I0.clone().lerp(P1,.66).lerp(Q,.28),pts=[I0,M1,M2,P1,B,P4];
    const n=new THREE.Vector3().crossVectors(P1.clone().sub(I0),P4.clone().sub(I0)).normalize();if(n.y<0)n.negate();const t=.01*S.fat;
    const pos=W.attributes.position;const put=(i,v)=>pos.setXYZ(i,v.x,v.y,v.z);
    put(0,Q.clone().addScaledVector(n,t));put(7,Q.clone().addScaledVector(n,-t));
    pts.forEach((q,i)=>{put(1+i,q.clone().addScaledVector(n,t));put(8+i,q.clone().addScaledVector(n,-t))});
    pos.needsUpdate=true;W.computeVertexNormals();W.computeBoundingSphere()}
  // 마디를 향하게 돌리되 손톱(+Y)이 엄지 손등 쪽을 보게
  const aim=(g,from,to)=>{const x=to.clone().sub(from).normalize(),y=new THREE.Vector3().crossVectors(ch.Z,x).normalize(),z=new THREE.Vector3().crossVectors(x,y);
    g.position.copy(from);g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,z))};
  aim(Th.t1,B,E);aim(Th.t2,E,T);Th.s1.scale.x=k;Th.s2.scale.x=k;
  PFL=fl;poseBones(o,DORS);
}
/* ----- 손 그림 한 장: 손만 따로 그리고(알은 깊이만 넣어 가림), 깊이 차이로 윤곽선 → 통째로 반투명하게 얹기 ----- */
const HP={rt:null,ss:1,depthOnly:new THREE.MeshBasicMaterial({colorWrite:false})};
const COMP_FS=`uniform sampler2D tC;uniform sampler2D tD;uniform vec2 px;uniform float near;uniform float far;uniform float lw;uniform float op;uniform float lop;uniform float ink;uniform vec3 inkC;varying vec2 vUv;
float lin(float d){float z=d*2.-1.;return 2.*near*far/(far+near-z*(far-near));}
// 알파 풀기: 위 4비트 흐림(0~1), 아래 4비트 살 조각 번호 (예전 살은 알파 1 → 흐림 1·번호 15)
vec2 un(float a){float v=floor(a*255.+.5);return vec2(floor(v/16.)/15.,mod(v,16.));}
float grp(float id){return id<1.5?0.:id<3.5?1.:floor((id-4.)/3.)+2.;}   // 0 손바닥 1 엄지 2~5 검지~소지
void main(){vec4 c=texture2D(tC,vUv);vec2 up=un(c.a);float dp=lin(texture2D(tD,vUv).x),line=0.,ip=up.y,gp=grp(ip);bool bg=up.x<.02;
 if(ink>.5){for(int i=0;i<16;i++){float a=float(i)*.3927;for(int k=1;k<=2;k++){vec2 o=vec2(cos(a),sin(a))*px*lw*float(k)*.5;vec2 q=vUv+o;
   vec2 uq=un(texture2D(tC,q).a);float aq=uq.x;if(aq<.02)continue;float dq=lin(texture2D(tD,q).x),iq=uq.y,gq=grp(iq),dd=dp-dq;
   bool on=false;
   if(bg)on=dd>0.;   // 바깥 윤곽
   else if(iq!=ip){
     if(gq==gp)on=dd>.01*dq;   // 한 손가락의 다른 마디가 앞에서 가림 (말린 중지)
     else if(gp==0.||gq==0.)on=dd>.008*dq;   // 손가락이 손바닥 앞 (뿌리 이음새는 깊이가 같아 선 없음)
     else on=dd>.01*dq||(abs(dd)<=.01*dq&&gq<gp);}   // 손가락끼리: 앞에 있거나, 맞닿아 있으면 한쪽에만 선
   if(on)line=max(line,aq);}}}
 vec4 o=vec4(c.rgb,(bg?0.:up.x)*op);if(line>0.){o=mix(o,vec4(inkC,lop),line);}
 if(o.a<.003)discard;gl_FragColor=o;}`;
const comp=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,
  uniforms:{tC:{value:null},tD:{value:null},px:{value:new THREE.Vector2()},near:{value:.1},far:{value:100},lw:{value:2.4},op:{value:1},lop:{value:1},ink:{value:1},inkC:{value:new THREE.Color(INK)}},
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,fragmentShader:COMP_FS}));
comp.frustumCulled=false;const compScene=new THREE.Scene();compScene.add(comp);const compCam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
/* ----- 손 그림 한 장: 손만 따로 그리고 깊이·조각 번호로 윤곽선 → 통째로 반투명하게 게임 화면 위에 얹기 ----- */
function draw(rend,camera,op,lop){
  R=rend;cam=camera;if(!HAND.visible||!SKIN)return;
  BASE.updateMatrixWorld(true);poseSkin();
  const w=R.domElement.width,h=R.domElement.height;   // 화면 해상도 그대로 (휴대폰에서 가볍게)
  if(!HP.rt||HP.rt.width!==w||HP.rt.height!==h){if(HP.rt)HP.rt.dispose();HP.rt=new THREE.WebGLRenderTarget(w,h,{depthBuffer:true,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter});
    HP.rt.depthTexture=new THREE.DepthTexture(w,h);HP.rt.depthTexture.type=THREE.UnsignedIntType;HP.ss=1}
  const ac=R.autoClear,cc=R.getClearColor(new THREE.Color()).getHex(),ca=R.getClearAlpha(),cl=camera.layers.mask,pr=R.getPixelRatio(),lw=1.6*pr;
  const rc=handRect(camera,w,h,Math.ceil(lw)+4);   // 손이 차지하는 화면 네모(윤곽선 폭만큼 넓혀서): 살 그리기·윤곽선 합치기는 이 안에서만
  HP.rt.scissorTest=false;R.setRenderTarget(HP.rt);R.setClearColor(0x000000,0);R.clear(true,true,true);   // 지우기는 통째로 (싸고, 지난 프레임 손이 남지 않게)
  if(rc){HP.rt.scissor.set(rc[0],rc[1],rc[2],rc[3]);HP.rt.scissorTest=true;R.setRenderTarget(HP.rt)}
  R.autoClear=false;camera.layers.set(1);R.render(scene,camera);camera.layers.mask=cl;
  HP.rt.scissorTest=false;R.setRenderTarget(null);R.setClearColor(cc,ca);
  const u=comp.material.uniforms;u.tC.value=HP.rt.texture;u.tD.value=HP.rt.depthTexture;u.px.value.set(1/w,1/h);u.lw.value=lw;
  u.near.value=camera.near;u.far.value=camera.far;u.op.value=op;u.lop.value=lop;u.ink.value=1;
  if(rc){R.setScissor(rc[0]/pr,rc[1]/pr,rc[2]/pr,rc[3]/pr);R.setScissorTest(true)}
  R.render(compScene,compCam);R.autoClear=ac;
  if(rc)R.setScissorTest(false);
}
/* 살 상자(SKIN)의 꼭짓점 8개를 화면에 옮긴 네모 [x,y,w,h] (화면 점, 아래가 0), pad만큼 넓힘. 상자가 카메라 뒤에 걸리면 null(화면 전체) */
const HR={v:new THREE.Vector3()};
function handRect(camera,w,h,pad){
  SKIN.updateMatrixWorld();camera.updateMatrixWorld();
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;const v=HR.v;
  for(let k=0;k<8;k++){
    v.set(k&1?.5:-.5,k&2?.5:-.5,k&4?.5:-.5).applyMatrix4(SKIN.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
    if(v.z>-camera.near)return null;
    v.applyMatrix4(camera.projectionMatrix);
    const X=(v.x+1)/2*w,Y=(v.y+1)/2*h;x0=Math.min(x0,X);x1=Math.max(x1,X);y0=Math.min(y0,Y);y1=Math.max(y1,Y);
  }
  x0=Math.max(0,Math.floor(x0-pad));y0=Math.max(0,Math.floor(y0-pad));x1=Math.min(w,Math.ceil(x1+pad));y1=Math.min(h,Math.ceil(y1+pad));
  return x1>x0&&y1>y0?[x0,y0,x1-x0,y1-y0]:[0,0,0,0];
}
/* 자세·자리: x,z 알 가운데, ang 손이 가리키는 방향(라디안, 게임과 같은 뜻: 회전 -ang), j 그중 떨림 몫(팔꿈치를 축으로 돎),
   p 당긴 힘, fl 튕김(0~1), seat 손 색, top 판 윗면 높이 */
const ELBOW=.98;let builtCol=-1;
const BASE=new THREE.Group(),ROOT=new THREE.Group(),HOLD=new THREE.Group();BASE.matrixAutoUpdate=false;scene.add(BASE);BASE.add(ROOT);ROOT.add(HOLD);HOLD.add(HAND);   // BASE: 게임 판 묶음의 자리(o.base)
function set(o){
  if(!o){HAND.visible=false;return}
  if(o.seat!==builtCol||!HS){S.col=Math.max(0,o.seat)%COLS.length;builtCol=o.seat;inner.clear();buildHand();
    for(const q of all)q.m.visible=false;inner.traverse(m=>{if(m.isMesh&&m.material===inkMat)m.visible=false});if(SK)SK.visible=false}   // 예전 살(뼈대 계산용)·손톱 선·뼈 모양은 숨기고 새 살만
  HAND.visible=true;const p=o.p,fl=o.fl,sc=S.size,tl=S.tilt*Math.PI/180,jt=o.j||0;
  inner.rotation.set(0,0,S.pitch*Math.PI/180);inner.position.set(0,0,0);
  poseHand(p,1);inner.updateMatrix();   // 튕긴 자세의 중지 끝을 알 뒤에 맞춤
  const tipH=inner.worldToLocal(HS.fs.middle.tip.getWorldPosition(new THREE.Vector3())).applyMatrix4(inner.matrix);
  inner.position.set(-tipH.x,-tipH.y,-tipH.z);poseHand(p,fl);
  HAND.rotation.order='YXZ';HAND.rotation.set(-tl,0,0);HAND.scale.setScalar(sc);HAND.position.set(0,0,0);
  // 떨림: 팔꿈치(손끝에서 손+팔뚝 길이만큼 뒤)를 축으로 jt만큼 → 손끝은 옆으로 비껴 나감
  const LP=ELBOW*sc;HOLD.position.set(-SR-.008-LP,SH,0);HAND.position.set(LP,0,0);HOLD.rotation.set(0,-jt,0);
  if(o.base)BASE.matrix.copy(o.base);ROOT.position.set(o.x,o.top||0,o.z);ROOT.rotation.set(0,-(o.ang-jt),0);
  BASE.updateMatrixWorld(true);
}
mkMats();
return {set,draw,root:ROOT};
};
})();
