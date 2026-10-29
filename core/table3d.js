/* index.html 공통 코드 · 3D 테이블·툰 셰이딩·카드 나누기 연출·3D 말풍선. 파일 순서는 index.html의 <script src> 순서 */
/* ================= 3D 테이블 ================= */
const FLOOR_Y=-2.6;   // 바닥 높이 (탁자 윗면 0). 의자·풀·나무가 모두 여기에
const T={ok:false,cards:new Set(),field:[],stacks:new Map(),faces:new Map()};
function canvasTex(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.anisotropy=4;return t}
function rr(g,x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath()}
function backTex(){return canvasTex(256,372,(g,w,h)=>{
  g.fillStyle='#fffcf5';rr(g,0,0,w,h,22);g.fill();
  g.fillStyle='#cc3a2e';rr(g,12,12,w-24,h-24,14);g.fill();
  g.save();rr(g,12,12,w-24,h-24,14);g.clip();g.strokeStyle='rgba(255,255,255,.22)';g.lineWidth=5;
  for(let k=-h;k<w+h;k+=18){g.beginPath();g.moveTo(k,0);g.lineTo(k+h,h);g.stroke()}g.restore();
  g.fillStyle='#fffcf5';g.beginPath();g.arc(w/2,h/2,92,0,7);g.fill();
  g.strokeStyle='#cc3a2e';g.lineWidth=5;g.beginPath();g.arc(w/2,h/2,82,0,7);g.stroke();
  g.save();g.translate(w/2,h/2);g.rotate(-Math.PI/5);
  g.fillStyle='#cc3a2e';g.font=`${G.brandPx||62}px "Jua", "Black Han Sans", sans-serif`;g.textAlign='center';g.textBaseline='middle';g.fillText(G.brand,0,4);
  g.restore();
})}
function faceMat(id){
  const gm=G,fk=gm.id+':'+id;   // 같은 id라도 게임마다 그림이 다름
  if(T.faces.has(fk))return T.faces.get(fk);
  const tex=canvasTex(256,372,(g,w,h)=>gm.drawFace(g,w,h,id));
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>{gm.drawFace(tex.image.getContext('2d'),256,372,id);tex.needsUpdate=true});
  const m=new THREE.MeshBasicMaterial({map:tex,alphaTest:.4});T.faces.set(fk,m);return m;
}
/* ===== 툰 셰이딩 그래픽 =====
   3칸 명암 램프 + 푸른 그림자 + 외곽선 + 림 라이트 + 구름 그림자/바람. GFX_ENV: 'meadow'(들판) | 'cafe'(카페) */
let GFX_ENV=store('gura-bg')==='cafe'?'cafe':'meadow';
const ENV_LABEL={meadow:'들판',cafe:'카페'};
const GFX_U={time:{value:0}};
function gfxRng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const GFX_INK=0x4a3020;
let GFX_RAMP=null,GFX_CLOUD=null;
function gfxRamp(){
  const d=new Uint8Array([70,78,120,255,70,78,120,255,196,192,210,255,255,255,255,255]);
  const t=new THREE.DataTexture(d,4,1,THREE.RGBAFormat);t.minFilter=t.magFilter=THREE.NearestFilter;t.generateMipmaps=false;t.needsUpdate=true;return t;
}
function gfxCloud(){
  const t=canvasTex(512,512,(g,w,h)=>{g.fillStyle='#000';g.fillRect(0,0,w,h);const r=gfxRng(3);
    for(let k=0;k<26;k++){const x=r()*w,y=r()*h,s=40+r()*90;
      for(const [dx,dy] of [[0,0],[w,0],[-w,0],[0,h],[0,-h]]){const gr=g.createRadialGradient(x+dx,y+dy,0,x+dx,y+dy,s);gr.addColorStop(0,'rgba(255,255,255,.9)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(x+dx-s,y+dy-s,s*2,s*2)}}});
  t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;
}
function toon(o){
  const m=new THREE.MeshToonMaterial({color:o.color!=null?o.color:0xffffff,map:o.map||null,gradientMap:GFX_RAMP});
  const rim=o.rim!=null?o.rim:.16,cloud=!!o.cloud,wind=!!o.wind;
  m.onBeforeCompile=sh=>{
    sh.uniforms.uTime=GFX_U.time;sh.uniforms.uCloud={value:GFX_CLOUD};
    sh.vertexShader='uniform float uTime;\nvarying vec3 vWPos;\n'+sh.vertexShader
      .replace('#include <begin_vertex>','#include <begin_vertex>\n'+(wind?'float ph=0.0;\n#ifdef USE_INSTANCING\nph=instanceMatrix[3].x*0.7+instanceMatrix[3].z*0.45;\n#endif\nfloat bend=transformed.y*transformed.y*2.2;\ntransformed.x+=sin(uTime*1.7+ph)*0.07*bend;transformed.z+=cos(uTime*1.2+ph)*0.035*bend;\n':''))
      .replace('#include <project_vertex>','#include <project_vertex>\nvec4 wp=vec4(transformed,1.0);\n#ifdef USE_INSTANCING\nwp=instanceMatrix*wp;\n#endif\nvWPos=(modelMatrix*wp).xyz;\n');
    sh.fragmentShader='uniform float uTime;uniform sampler2D uCloud;\nvarying vec3 vWPos;\n'+sh.fragmentShader
      .replace('#include <dithering_fragment>','float rimF=1.0-clamp(dot(normalize(vViewPosition),normal),0.0,1.0);\ngl_FragColor.rgb+=vec3(1.0,0.93,0.78)*smoothstep(0.6,0.8,rimF)*'+rim.toFixed(3)+';\n'+(cloud?'float cl=texture2D(uCloud,vWPos.xz*0.022+vec2(uTime*0.006,uTime*0.0025)).r;gl_FragColor.rgb*=mix(1.0,0.8,smoothstep(0.35,0.6,cl));\n':'')+'#include <dithering_fragment>');
  };
  m.customProgramCacheKey=()=>'toon'+rim+cloud+wind;
  return m;
}
function hull(geo,mesh,parent){
  const o=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:GFX_INK,side:THREE.BackSide}));
  o.position.copy(mesh.position);o.rotation.copy(mesh.rotation);o.scale.copy(mesh.scale);parent.add(o);return o;
}
/* 배경 바꾸기: 이전 배경 물체를 지우고 새로 만들고, 하늘·안개·조명 색도 맞춤 */
function setEnv(name){
  GFX_ENV=name==='cafe'?'cafe':'meadow';store('gura-bg',GFX_ENV);
  document.querySelectorAll('.bgseg button').forEach(b=>{const on=b.dataset.v===GFX_ENV;b.setAttribute('aria-pressed',on);b.setAttribute('aria-checked',on)});
  if(!T.scene)return;
  const meadow=GFX_ENV==='meadow';
  if(T.env){T.scene.remove(T.env);T.env.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)[].concat(o.material).forEach(m=>{if(m.map&&m.map!==GFX_CLOUD)m.map.dispose();m.dispose()})})}
  T.env=new THREE.Group();buildEnv(T.env,meadow);T.scene.add(T.env);
  const sky=meadow?0xcfe6ee:0xead9bf;
  T.scene.background.setHex(sky);T.scene.fog.color.setHex(sky);
  if(T.hemi){T.hemi.color.setHex(meadow?0xd8ecff:0xfff1e0);T.hemi.groundColor.setHex(meadow?0x8d8a5c:0xb48a5c);T.hemi.intensity=meadow?.6:.66}
  if(T.dl){T.dl.color.setHex(meadow?0xfff1d8:0xffe9c8);T.dl.intensity=meadow?.62:.55}
}
function buildBgSeg(box){
  box.setAttribute('role','radiogroup');box.setAttribute('aria-label','배경');
  box.innerHTML=Object.keys(ENV_LABEL).map(k=>`<button type="button" role="radio" data-v="${k}" aria-pressed="${k===GFX_ENV}" aria-checked="${k===GFX_ENV}">${ENV_LABEL[k]}</button>`).join('');
  box.addEventListener('click',e=>{const b=e.target.closest('button');if(b&&b.dataset.v!==GFX_ENV){setEnv(b.dataset.v);sfx('tick')}});
}
buildBgSeg($('#segBg'));buildBgSeg($('#mBg'));
/* 두 번 눌러 놓기 (개인 설정, 쿼리도·오목): 같은 자리를 한 번 더 누르면 [놓기] 없이 바로 둠. 기본 켜기. 메뉴·로비 설정에 언제나 보임 */
let dblTap=store('gura-dbltap')!=='0';
function syncDblSeg(){document.querySelectorAll('.dblseg button').forEach(b=>{const on=(b.dataset.v==='on')===dblTap;b.setAttribute('aria-pressed',on);b.setAttribute('aria-checked',on)})}
function buildDblSeg(box){
  box.setAttribute('role','radiogroup');box.setAttribute('aria-label','두 번 눌러 놓기');
  box.innerHTML='<button type="button" role="radio" data-v="off">끄기</button><button type="button" role="radio" data-v="on">켜기</button>';
  box.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const on=b.dataset.v==='on';if(on===dblTap)return;dblTap=on;store('gura-dbltap',on?'1':'0');syncDblSeg();sfx('tick')});
}
buildDblSeg($('#segDbl'));buildDblSeg($('#mDbl'));syncDblSeg();
function buildEnv(sc,meadow){
  const GY=FLOOR_Y;
  if(meadow){
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(120,120),toon({color:0x93c266,rim:0,cloud:true}));ground.rotation.x=-Math.PI/2;ground.position.y=GY;ground.receiveShadow=true;sc.add(ground);
    const r=gfxRng(5),blade=new THREE.ConeGeometry(.05,.38,3,1).translate(0,.19,0);
    for(const [col,count] of [[0x7fb555,2600],[0xa6d06e,1800]]){
      const im=new THREE.InstancedMesh(blade,toon({color:col,rim:.1,wind:true,cloud:true}),count),M=new THREE.Object3D();
      for(let k=0;k<count;k++){let x,z;do{const a=r()*Math.PI*2,d=5.3+Math.pow(r(),.7)*18;x=Math.sin(a)*d;z=Math.cos(a)*d}while(z>9);
        M.position.set(x,GY,z);M.rotation.set((r()-.5)*.3,r()*6.3,(r()-.5)*.3);M.scale.setScalar(.7+r()*.9);M.updateMatrix();im.setMatrixAt(k,M.matrix)}
      im.receiveShadow=true;sc.add(im);
    }
    const flower=new THREE.IcosahedronGeometry(.07,0);
    for(const col of [0xfff8ea,0xf6d24a,0xf0a0a8]){
      const im=new THREE.InstancedMesh(flower,toon({color:col,rim:0}),160),M=new THREE.Object3D();
      for(let k=0;k<160;k++){let x,z;do{const a=r()*Math.PI*2,d=5.6+r()*14;x=Math.sin(a)*d;z=Math.cos(a)*d}while(z>8);M.position.set(x,GY+.32+r()*.12,z);M.updateMatrix();im.setMatrixAt(k,M.matrix)}
      sc.add(im);
    }
    const trunkM=toon({color:0x7b5534}),leafA=toon({color:0x5c9a48,rim:.22,cloud:true}),leafB=toon({color:0x76ad52,rim:.22,cloud:true});
    const blob=new THREE.MeshBasicMaterial({color:0x3e5a2c,transparent:true,opacity:.28,depthWrite:false});
    [[-11,-12],[-7,-17],[-2.5,-21],[4,-18],[9.5,-13],[13,-7],[-14,-5],[16,-16],[-17,-14],[1,-27],[-9,-26],[11,-24],[17,2],[-16,4]].forEach(([x,z])=>{
      const tr=new THREE.Group();tr.position.set(x,GY,z);tr.scale.setScalar(.9+r()*.6);
      const t=new THREE.Mesh(new THREE.CylinderGeometry(.22,.32,2,10),trunkM);t.position.y=1;tr.add(t);hull(new THREE.CylinderGeometry(.27,.37,2,10),t,tr);
      [[0,2.7,0,1.45],[.75,2.25,.2,1.0],[-.65,2.35,-.1,1.05],[.1,3.45,0,.9]].forEach(([cx,cy,cz,cr],j)=>{
        const c=new THREE.Mesh(new THREE.SphereGeometry(cr,20,14),j%2?leafB:leafA);c.position.set(cx,cy,cz);tr.add(c);hull(new THREE.SphereGeometry(cr*1.05,20,14),c,tr)});
      const b=new THREE.Mesh(new THREE.CircleGeometry(1.8,24),blob);b.rotation.x=-Math.PI/2;b.position.set(.9,.02,-.5);tr.add(b);sc.add(tr);
    });
    const rockM=toon({color:0xb8b4a8,rim:.2});
    [[-7.2,4.5,.6],[7.5,3.2,.45],[-9,-6,.8],[8.4,-8,.55],[6,7.4,.35]].forEach(([x,z,s])=>{
      const m=new THREE.Mesh(new THREE.DodecahedronGeometry(s,0),rockM);m.position.set(x,GY+s*.45,z);m.rotation.set(r(),r(),r());m.scale.y=.7;m.castShadow=m.receiveShadow=true;sc.add(m);
      hull(new THREE.DodecahedronGeometry(s*1.07,0),m,sc)});
  }else{
    const floorTex=canvasTex(1024,1024,(g,w,h)=>{const n=8,pw=w/n;for(let p=0;p<n;p++){g.fillStyle=p%2?'#d9b98f':'#cfae82';g.fillRect(p*pw,0,pw,h);g.fillStyle='rgba(110,69,38,.35)';g.fillRect(p*pw,0,4,h);g.fillRect(p*pw,(p*0.37%1)*h,pw,4)}});
    floorTex.wrapS=floorTex.wrapT=THREE.RepeatWrapping;floorTex.repeat.set(10,10);
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(120,120),toon({map:floorTex,rim:0}));floor.rotation.x=-Math.PI/2;floor.position.y=GY;floor.receiveShadow=true;sc.add(floor);
    const rug=new THREE.Mesh(new THREE.CircleGeometry(7.4,72),toon({color:0xb0705a,rim:0}));rug.rotation.x=-Math.PI/2;rug.position.y=GY+.01;rug.receiveShadow=true;sc.add(rug);
    const rug2=new THREE.Mesh(new THREE.RingGeometry(6.7,6.95,72),new THREE.MeshBasicMaterial({color:0xd9a441}));rug2.rotation.x=-Math.PI/2;rug2.position.y=GY+.02;sc.add(rug2);
  }
}
function init3D(){
  if(!window.THREE){$('#nogl').hidden=false;document.body.classList.add('no3d');return}
  try{
    const cv=$('#cv');
    T.r=new THREE.WebGLRenderer({canvas:cv,antialias:true});T.r.localClippingEnabled=true;   // 키판이 디스플레이 아래에서 나올 때
    T.r.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
    T.r.shadowMap.enabled=true;T.r.shadowMap.type=THREE.PCFSoftShadowMap;
    GFX_RAMP=gfxRamp();GFX_CLOUD=gfxCloud();
    T.scene=new THREE.Scene();T.scene.background=new THREE.Color(0xcfe6ee);T.scene.fog=new THREE.Fog(0xcfe6ee,15,34);
    T.cam=new THREE.PerspectiveCamera(42,1,.1,100);
    T.hemi=new THREE.HemisphereLight(0xd8ecff,0x8d8a5c,.6);T.scene.add(T.hemi);
    const dl=new THREE.DirectionalLight(0xfff1d8,.62);dl.position.set(-5,10,4);T.dl=dl;
    dl.castShadow=true;dl.shadow.mapSize.set(2048,2048);
    Object.assign(dl.shadow.camera,{left:-9,right:9,top:9,bottom:-9,near:1,far:30});dl.shadow.bias=-.0006;dl.shadow.normalBias=.02;
    T.scene.add(dl);
    // 원목 상판: 판자 7장을 붓으로 칠한 듯 단순하게
    const woodTex=canvasTex(1024,1024,(g,w,h)=>{
      const planks=7,ph=h/planks,r=gfxRng(11);
      for(let p=0;p<planks;p++){
        g.fillStyle=p%2?'#b98350':'#ad7745';g.fillRect(0,p*ph,w,ph);
        g.fillStyle='rgba(255,236,205,.22)';g.fillRect(0,p*ph+4,w,5);
        for(let k=0;k<5;k++){const y0=p*ph+18+r()*(ph-36),amp=3+r()*5,fr=.003+r()*.004,p0=r()*6;
          g.strokeStyle='rgba(140,82,40,.22)';g.lineWidth=3+r()*3;g.lineCap='round';
          const x0=r()*w*.5,x1=x0+w*(.3+r()*.5);g.beginPath();for(let x=x0;x<=x1;x+=16){const y=y0+Math.sin(x*fr+p0)*amp;x===x0?g.moveTo(x,y):g.lineTo(x,y)}g.stroke()}
        g.fillStyle='rgba(84,46,20,.6)';g.fillRect(0,(p+1)*ph-3,w,5);
      }
    });
    const side=toon({color:0x8a5530}),top=toon({map:woodTex,rim:0});
    // 탁자 한 덩어리(T.tableG): 타임머신 때 함께 떨림. 카드·말 같은 게임 물건은 그대로 장면에 둠
    const TG=new THREE.Group();T.scene.add(TG);T.tableG=TG;T.woodTop=top;
    const table=new THREE.Mesh(new THREE.CylinderGeometry(4.9,4.9,.3,72),[side,top,side]);table.position.y=-.15;table.receiveShadow=table.castShadow=true;TG.add(table);
    hull(new THREE.CylinderGeometry(4.94,4.94,.36,72),table,TG);
    // 받침: 기둥 + 넓은 발판 (멀리서 봐도 탁자 키가 작아 보이지 않게 바닥을 낮춤, FLOOR_Y)
    const legM=toon({color:0x7a4a28}),LH=-.28-FLOOR_Y-.28;
    const base=new THREE.Mesh(new THREE.CylinderGeometry(.62,.82,LH,32),legM);base.position.y=-.28-LH/2;base.castShadow=true;TG.add(base);
    hull(new THREE.CylinderGeometry(.66,.86,LH,32),base,TG);
    const foot=new THREE.Mesh(new THREE.CylinderGeometry(1.25,1.75,.28,40),legM);foot.position.y=FLOOR_Y+.14;foot.castShadow=foot.receiveShadow=true;TG.add(foot);
    hull(new THREE.CylinderGeometry(1.29,1.8,.3,40),foot,TG);
    const cap=new THREE.Mesh(new THREE.CylinderGeometry(1.15,.7,.22,32),legM);cap.position.y=-.39;cap.castShadow=true;TG.add(cap);hull(new THREE.CylinderGeometry(1.19,.74,.24,32),cap,TG);
    // 가운데 초록 펠트 매트 (필드)
    const felt=canvasTex(1024,1024,(g,w,h)=>{
      const gr=g.createRadialGradient(w/2,h/2,80,w/2,h/2,w/2);gr.addColorStop(0,'#5fae7b');gr.addColorStop(1,'#3f8a5f');g.fillStyle=gr;g.fillRect(0,0,w,h);
      g.strokeStyle='#f2b632';g.lineWidth=8;g.lineCap='round';g.setLineDash([26,18]);g.beginPath();g.arc(w/2,h/2,300,0,7);g.stroke();g.setLineDash([]);
      g.strokeStyle='rgba(255,250,240,.5)';g.lineWidth=6;g.beginPath();g.arc(w/2,h/2,488,0,7);g.stroke();
    });
    const fs=toon({color:0x2f6b4a});
    const mat=new THREE.Mesh(new THREE.CylinderGeometry(3.15,3.15,.02,72),[fs,toon({map:felt,rim:0}),fs]);mat.position.y=.006;mat.receiveShadow=true;TG.add(mat);
    const ink=new THREE.Mesh(new THREE.RingGeometry(3.14,3.19,96),new THREE.MeshBasicMaterial({color:GFX_INK}));ink.rotation.x=-Math.PI/2;ink.position.y=.0175;TG.add(ink);
    T.felt={mat,ink,tex:felt};   // 첫 화면에서는 맨 탁자 → 상을 차리면 펼쳐짐 (frontUpdate)
    setEnv(GFX_ENV);
    T.geo=new THREE.PlaneGeometry(.62,.9);
    T.back=new THREE.MeshBasicMaterial({map:backTex(),alphaTest:.4});
    // 카드 외곽선 판: 카드보다 살짝 크고 뒤로 밀려 그려져서 테두리만 보임
    T.olGeo=new THREE.PlaneGeometry(.665,.945);
    T.olMat=new THREE.MeshBasicMaterial({color:GFX_INK,map:canvasTex(128,180,(g,w,h)=>{g.fillStyle='#fff';rr(g,0,0,w,h,16);g.fill()}),alphaTest:.5,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:2,polygonOffsetUnits:6});
    T.ring=new THREE.Mesh(new THREE.TorusGeometry(.62,.055,10,48),new THREE.MeshBasicMaterial({color:0xf2b632}));
    T.timerBg=new THREE.Mesh(new THREE.RingGeometry(.66,.78,64),new THREE.MeshBasicMaterial({color:0x3b2a1f,transparent:true,opacity:.18,side:THREE.DoubleSide}));
    T.timerBg.rotation.x=-Math.PI/2;T.timerBg.visible=false;T.scene.add(T.timerBg);
    T.timerArc=new THREE.Mesh(new THREE.RingGeometry(.66,.78,64,1,0,Math.PI*2),new THREE.MeshBasicMaterial({color:0xf2b632,side:THREE.DoubleSide}));
    T.timerArc.rotation.x=-Math.PI/2;T.timerArc.visible=false;T.scene.add(T.timerArc);T.timerFrac=-1;
    T.ring.rotation.x=Math.PI/2;T.ring.visible=false;T.scene.add(T.ring);
    frontBuild();
    if(window.ResizeObserver)new ResizeObserver(resize3D).observe($('#stage'));else window.addEventListener('resize',resize3D);
    resize3D();
    T.ok=true;
    if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>{T.back.map=backTex();T.back.needsUpdate=true});
  }catch(e){$('#nogl').hidden=false;document.body.classList.add('no3d');T.ok=false}
}
function resize3D(){
  const st=$('#stage'),w=st.clientWidth,h=st.clientHeight;if(!T.r||!w||!h)return;
  T.r.setSize(w,h,false);T.cam.aspect=w/h;
  // 테이블 위 카드 크기 (모든 화면 같음)
  {const ck=1.2;if(T.geo&&ck!==T.cardK){const f=ck/(T.cardK||1);T.geo.scale(f,f,1);T.olGeo.scale(f,f,1);T.cardK=ck}}
  // 카메라 = 테이블 앞에 앉은 내 눈. 눈의 위치와 각도는 어떤 화면에서도 똑같고, 화면은 창문처럼 보이는 범위만 달라짐
  //  · 기준: 맞은편 자리 위로 화면 높이의 10%만큼 테이블 너머(배경)가 보이고, 화면 맨 아래는 내 쪽 테이블 끝
  //  · 가로로 긴 화면: 위아래 범위는 기준 그대로, 양옆이 더 보임
  //  · 세로로 긴 화면: 위아래 범위는 기준 그대로, 양옆이 덜 보임 (양옆 사람 자리는 잘릴 수 있음)
  //  · 가운데 노란 점선 원마저 잘리는 아주 좁은 화면부터는 위쪽 배경과 아래쪽 배경을 2 : 1로 함께 늘려 점선 원을 지킴
  T.cam.clearViewOffset();
  const EL=37*Math.PI/180,DIST=12.5,tgt=new THREE.Vector3(0,0,.4);
  T.cam.position.set(0,tgt.y+DIST*Math.sin(EL),tgt.z+DIST*Math.cos(EL));T.cam.lookAt(tgt);T.cam.updateMatrixWorld();
  const tn=p=>{const v=p.clone().applyMatrix4(T.cam.matrixWorldInverse);return [v.x/-v.z,v.y/-v.z]};
  const tFar=tn(new THREE.Vector3(0,.35,-4.05))[1],tNear=tn(new THREE.Vector3(0,0,4.9))[1];
  let top=(tFar-.1*tNear)/.9,bot=tNear;
  // 양옆 사람 자리는 화면이 좁으면 잘려도 됨(이름표는 화면 끝에 붙어 보임). 가운데 노란 점선 원은 끝까지 보여야 하므로,
  // 그것마저 안 들어가는 좁은 화면부터는 위쪽 배경을 2, 아래쪽 배경을 1의 비율로 함께 늘림(늘어나는 양을 3으로 나눔)
  const hxFit=tn(new THREE.Vector3(2.15,0,0))[0]*(1+2*12/w);
  T.seatKey=(V&&V.ps?V.ps.length:0)+':'+myIdx();
  let hx=(w/h)*(top-bot)/2;
  if(hx<hxFit){hx=hxFit;const ex=2*hx*h/w-(top-bot);top+=ex*2/3;bot-=ex/3}   // 늘어나는 양: 위쪽 배경 2 : 아래쪽 배경 1
  const nr=T.cam.near,fr=T.cam.far;
  T.cam.projectionMatrix.makePerspective(-hx*nr,hx*nr,top*nr,bot*nr,nr,fr);T.cam.projectionMatrixInverse.copy(T.cam.projectionMatrix).invert();
  if(T.scene&&T.scene.fog){const d=T.cam.position.length();T.scene.fog.near=d+5;T.scene.fog.far=d+22}
  frontPoses(w,h);   // 앉은 눈(위)과 서서 보는 눈(첫 화면)을 기억해 두고, 첫 화면이면 그 사이로 옮김
  placeLabels();
}
function seatBase(){const i=myIdx();return i>=0?i:0}
function seatAngle(i){const N=V&&V.ps?V.ps.length:1,off=myIdx()<0&&V&&V.st!=='wait'?.5:0;return((i-seatBase()+N)%N+off)*Math.PI*2/N}   // 관전 중에는 내 앞자리를 비워서 모두가 보이게
function seatPos(i,r){const a=seatAngle(i);return new THREE.Vector3(Math.sin(a)*r,0,Math.cos(a)*r)}
function makeCard(pos,rx,ry,s){
  const g=new THREE.Group();g.rotation.order='YXZ';
  const front=new THREE.Mesh(T.geo,T.back),back=new THREE.Mesh(T.geo,T.back);back.rotation.y=Math.PI;
  front.castShadow=back.castShadow=true;g.add(front,back,new THREE.Mesh(T.olGeo,T.olMat));g.position.copy(pos);g.rotation.x=rx;g.rotation.y=ry;g.scale.setScalar(s);
  g.userData={p:pos.clone(),rx,ry,s,die:false};
  T.scene.add(g);T.cards.add(g);return g;
}
function killCard(c){T.scene.remove(c);T.cards.delete(c)}
/* ===== 게임 시작 연출: 리플 셔플 → 커트 → 한 장씩 점점 빠르게 곡선을 타고 나누기 → 내 패가 고개를 들듯 일어나 부채꼴로 펼쳐짐
   카드게임만 (G.dealAnim). 방장이 그동안 시간을 멈춤(DEAL_MS). 늦게 들어오거나 다시 연결된 사람은 연출 없이 바로 보임 */
const DL={split:[250,520],riffle:[520,960],square:[960,1060],cut1:[1080,1300],cut2:[1300,1500],slide:[1500,1600],deal:[1600,2500],lift:2700,liftDur:720,hold:90,fanDur:820};
const PILE_DY=.007,clamp01=x=>x<0?0:x>1?1:x,smooth=x=>{x=clamp01(x);return x*x*(3-2*x)},eOut=x=>{x=clamp01(x);return 1-Math.pow(1-x,3)};
const dealingV=()=>!!(V&&V.dealAt&&clock()<V.dealAt);
let dealSeen='';
function dealCheck(v){
  if(T.deal&&(v.st==='wait'||!v.ps||v.code+':'+v.di!==T.deal.key&&v.di))dealAbort();
  if(!(G.dealAnim||G.intro)||!v.ps||!v.dk||!v.di)return;
  const key=v.code+':'+v.di;if(key===dealSeen)return;dealSeen=key;
  const total=G.dealAnim?(+v.dm||DEAL_MS):(+v.dm||introLen(G,!!v.dg,+v.fp));
  const done=total-(+v.dk);if(done>900)return;   // 이미 많이 지났으면 연출 없이
  if(G.dealAnim)dealStart(v,clock()-Math.max(0,done),key);
  else G.intro(clock()-Math.max(0,done),{total,again:!!v.dg,fast:+v.fp||undefined});
}
function dealAbort(){
  const d=T.deal;if(!d)return;T.deal=null;
  if(T.ok)d.cards.forEach(c=>killCard(c.g));
  $('#hand').classList.remove('dealing');$('#stage').classList.remove('dealing');
}
const _q=window.THREE?new THREE.Quaternion():null,_qz=window.THREE?new THREE.Quaternion():null,_e=window.THREE?new THREE.Euler(0,0,0,'YXZ'):null,_Z=window.THREE?new THREE.Vector3(0,0,1):null;
function setPose(g,x,y,z,rx,ry,tz,s){
  g.position.set(x,y,z);_e.set(rx,ry,0,'YXZ');_q.setFromEuler(_e);
  if(tz){_qz.setFromAxisAngle(_Z,tz);_q.premultiply(_qz)}
  g.quaternion.copy(_q);g.scale.setScalar(s);
}
const bez=(a,b,c,u)=>(1-u)*(1-u)*a+2*(1-u)*u*b+u*u*c;
function dealStart(v,t0,key){
  dealAbort();
  const me=myIdx(),n=v.ps.length;
  const cnt=v.ps.map((p,i)=>i===me?myHand().length:Math.max(0,+p.c||0));
  const N=cnt.reduce((a,b)=>a+b,0);if(!N)return;
  const d={key,t0,me,N,cards:[],fired:{},fanned:false,cutAt:0};
  if(me>=0)$('#hand').classList.add('dealing');
  $('#stage').classList.add('dealing');
  // 나누는 순서: 첫 차례인 사람부터 돌아가며 한 장씩 (장수가 다르면 다 받은 사람은 건너뜀)
  const got=Array(n).fill(0),order=[];let s0=v.t!=null&&v.t>=0?v.t:0;
  for(let k=0,i=s0;k<N;i=(i+1)%n){if(got[i]<cnt[i]){order.push([i,got[i]]);got[i]++;k++}}
  const h=Math.floor(N/2),cutAt=Math.round(N*(.4+Math.random()*.2)),myIds=me>=0?myHand():[];
  for(let idx=0;idx<N;idx++){
    // idx: 처음 더미에서의 순서(0이 맨 아래). 리플로 번갈아 섞인 순서 j, 커트 뒤 순서 f
    const top=idx>=h,hi=top?idx-h:idx;
    const c={idx,top,hi};d.cards.push(c);
  }
  // 리플: 두 묶음의 아래쪽부터 번갈아 떨어짐 (가끔 두 장 연속)
  const A=d.cards.filter(c=>c.top),B=d.cards.filter(c=>!c.top);let ia=0,ib=0,j=0,turnB=true;
  while(ia<A.length||ib<B.length){
    const fromB=ib<B.length&&(turnB||ia>=A.length);const c=fromB?B[ib++]:A[ia++];c.j=j++;
    if(Math.random()<.78)turnB=!turnB;
  }
  d.cutAt=cutAt;
  for(const c of d.cards){c.f=c.j>=cutAt?c.j-cutAt:N-cutAt+c.j;c.jit=(Math.random()-.5)*.05}
  // 맨 위(f가 큰 카드)부터 나눔
  const byF=[...d.cards].sort((a,b)=>b.f-a.f);
  byF.forEach((c,k)=>{
    const x=N>1?k/(N-1):0;c.k=k;c.dt=DL.deal[0]+(DL.deal[1]-DL.deal[0])*Math.pow(x,.5);c.dur=260-110*x;   // 처음엔 느리다가 점점 빠르게
    const [i,m]=order[k];c.seat=i;c.m=m;
  });
  if(T.ok){
    T.field.forEach(killCard);T.field=[];T.fieldKey='';
    for(const arr of T.stacks.values())arr.forEach(killCard);T.stacks.clear();
    for(const c of d.cards){
      c.g=makeCard(new THREE.Vector3(0,-1,0),Math.PI/2,0,.8);c.g.userData.man=true;c.g.visible=false;
      if(c.seat===me)c.g.renderOrder=2;
      // 받는 자리
      if(c.seat===me){const p=seatPos(me,3.85);c.dx=p.x;c.dz=p.z;c.dy=.03+c.m*.006;c.dry=seatAngle(me);if(c.m===0&&myIds.length)c.id=myIds[myIds.length-1]}   // 다른 사람과 같은 거리(나무 위). 맨 아래 카드 앞면 = 손패 맨 위 카드
      else{const p=seatPos(c.seat,3.85);c.dx=p.x;c.dz=p.z;c.dy=.03+Math.min(c.m,13)*.016;c.dry=seatAngle(c.seat)}
      // 날아가는 방향이 휘는 쪽 (시계 방향으로 살짝)
      c.bend=.35+.25*Math.random();
    }
    d.myN=d.cards.filter(c=>c.seat===me).length;
  }
  T.deal=d;
}
function dealFire(d,k,fn){if(!d.fired[k]){d.fired[k]=1;fn()}}
function dealPose(d,c,a){
  const N=d.N,g=c.g,S=.8;
  const pileY=i=>.03+i*PILE_DY;
  // 0) 처음: 가운데 더미 (위에서 툭 떨어지듯 나타남)
  if(a<DL.split[0]){const u=eOut(a/DL.split[0]);setPose(g,0,pileY(c.idx)+(1-u)*.8,0,Math.PI/2,0,0,S*(.6+.4*u));return}
  // 1) 두 묶음으로 나눔: 아래 절반은 오른쪽으로 밀고, 위 절반은 들어서 왼쪽에 놓음
  const sx=c.top?-.58:.58;
  const halfY=i=>.03+i*PILE_DY;
  if(a<DL.riffle[0]){
    const u=smooth((a-DL.split[0])/(DL.split[1]-DL.split[0]));
    const y0=pileY(c.idx),y1=halfY(c.hi);
    setPose(g,sx*u,y0+(y1-y0)*u+(c.top?Math.sin(u*Math.PI)*.35:0),0,Math.PI/2,0,0,S);return;
  }
  // 2) 리플: 두 묶음 안쪽 모서리를 들고(기울임) 아래부터 번갈아 떨어뜨림
  const R0=DL.riffle[0],R1=DL.riffle[1],dropAt=R0+60+(c.j/N)*(R1-R0-120),dropDur=110;
  const centerY=pileY(c.j);
  if(a<dropAt+dropDur&&a<DL.square[1]){
    const bend=smooth((a-R0)/70)*.42;
    if(a<dropAt){
      // 같은 묶음에서 먼저 떨어진 카드만큼 내려앉음
      const sameBelow=d.cards.filter(o=>o.top===c.top&&o.hi<c.hi&&a>=R0+60+(o.j/N)*(R1-R0-120)).length;
      setPose(g,sx,halfY(c.hi-sameBelow)+.05,0,Math.PI/2,0,(c.top?-1:1)*bend,S);return;
    }
    const u=smooth((a-dropAt)/dropDur);
    setPose(g,sx*(1-u)+c.jit*u,halfY(0)+.05+(centerY-halfY(0)-.05)*u,0,Math.PI/2,0,(c.top?-1:1)*bend*(1-u),S);return;
  }
  // 3) 탁 정리 (삐져나온 카드가 가운데로)
  if(a<DL.cut1[0]){const u=smooth((a-DL.square[0])/(DL.square[1]-DL.square[0]));setPose(g,c.jit*(1-u),centerY,0,Math.PI/2,0,0,S);return}
  // 4) 커트: 위쪽을 들어 오른쪽에 놓고, 남은 아래쪽을 그 위에 올린 뒤 가운데로 밀어 놓음
  const cx=.85,fy=pileY(c.f);
  if(a<DL.deal[0]){
    let x=0,y=centerY;
    const first=c.j>=d.cutAt;   // 위쪽 묶음 먼저
    if(first){
      const u=smooth((a-DL.cut1[0])/(DL.cut1[1]-DL.cut1[0]));x=cx*u;y=centerY+(fy-centerY)*u+Math.sin(u*Math.PI)*.45;
    }else{
      const u=smooth((a-DL.cut2[0])/(DL.cut2[1]-DL.cut2[0]));x=cx*u;y=centerY+(fy-centerY)*u+Math.sin(u*Math.PI)*.55;
    }
    if(a>=DL.slide[0]){const u=smooth((a-DL.slide[0])/(DL.slide[1]-DL.slide[0]));x=cx*(1-u);y=fy}
    setPose(g,x,y,0,Math.PI/2,0,0,S);return;
  }
  // 5) 나누기: 맨 위부터 한 장씩, 점점 빠르게, 살짝 떠올라 휘면서 빙글 돌아 각 자리로
  if(a<c.dt){setPose(g,0,fy,0,Math.PI/2,0,0,S);return}
  const u=clamp01((a-c.dt)/c.dur);
  if(c.seat===d.me&&a>=DL.lift){dealLift(d,c,a);return}
  const e=eOut(u),mx=c.dx/2,mz=c.dz/2,len=Math.hypot(c.dx,c.dz)||1;
  const px=mx+(-c.dz/len)*c.bend*len*.25,pz=mz+(c.dx/len)*c.bend*len*.25;
  const x=bez(0,px,c.dx,e),z=bez(0,pz,c.dz,e),y=bez(fy,.75,c.dy,e);
  let ry=c.dry;{let dd=c.dry;while(dd>Math.PI)dd-=2*Math.PI;while(dd<-Math.PI)dd+=2*Math.PI;ry=(dd-Math.PI*2)*e}   // 한 바퀴 가까이 돌면서 그 자리 방향으로
  setPose(g,x,y,z,Math.PI/2-.35*Math.sin(Math.PI*u),ry,0,S);
}
function dealLift(d,c,a){
  // 실제로 카드를 가져와 눈앞에서 펼치듯: 테이블을 따라 낮게 끌어오다가 곡선을 타고 들어 올리며
  // 내 쪽 모서리부터 일어서서 앞면은 나를, 뒷면은 맞은편(상대)을 향하게 → 손패 자리에서 손패 카드와 같은 크기로 멈춤
  // (멈춘 순간 같은 자리·크기·방향의 2D 카드 묶음으로 바뀌고 펼쳐짐)
  const g=c.g,S=.8,x0=clamp01((a-DL.lift)/DL.liftDur),u=smooth(x0);
  if(!d.out){
    const cam=T.cam,cv=T.r.domElement,W=cv.clientWidth||1,Hh=cv.clientHeight||1,hand=$('#hand');
    const k=parseFloat(hand.style.getPropertyValue('--k'))||1,bb=parseFloat(hand.style.getPropertyValue('--b'))||10;
    const el=hand.children[0],cwPx=(el?el.offsetWidth:60)*k,chPx=(el?el.offsetHeight:88)*k;
    const sy=Hh-bb*k-chPx/2;   // 손패가 겹쳐 있을 때 카드 가운데 (화면 좌표)
    const ndc=new THREE.Vector3(0,1-2*sy/Hh,.5).unproject(cam),dir=ndc.sub(cam.position).normalize();
    const right=new THREE.Vector3(1,0,0).applyQuaternion(cam.quaternion),half=.31*(T.cardK||1)*S;
    const pA=new THREE.Vector3(),pB=new THREE.Vector3();
    // 눈앞에 든 카드는 손패보다 크게 보임: 손패 카드의 1.5배 크기가 되는 거리 (테이블 위로 충분히 올라올 때까지 더 가까이)
    let r=1.5,P2=null;
    for(let t=0;t<12;t++){
      let D=4;for(let it=0;it<6;it++){const P=cam.position.clone().addScaledVector(dir,D);pA.copy(P).addScaledVector(right,-half).project(cam);pB.copy(P).addScaledVector(right,half).project(cam);const px=Math.abs(pB.x-pA.x)/2*W;D*=px/(cwPx*r)}
      P2=cam.position.clone().addScaledVector(dir,D);if(P2.y>=.6)break;r+=.15;
    }
    d.handR=r;
    const qL=new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI/2,c.dry,0,'YXZ')),qF=cam.quaternion.clone();
    d.out={p2:P2,p1z:c.dz+(P2.z-c.dz)*.6,qL,qF,back:new THREE.Vector3()};
  }
  const o=d.out;
  // 위치: 낮게 오다가 휘어 올라오는 곡선 (모든 카드가 한 묶음)
  const bx=bez(c.dx,c.dx,o.p2.x,u),by=bez(.03,.08,o.p2.y,u),bz=bez(c.dz,o.p1z,o.p2.z,u);
  // 방향: 들어 올리는 만큼 일어섬 (뒤쪽 절반에서 주로 돌아섬)
  const w=smooth((u-.12)/.8);_q.copy(o.qL).slerp(o.qF,w);g.quaternion.copy(_q);
  // 묶음 두께: 언제나 뒷면 쪽으로 쌓임 → 맨 아래 카드(앞면이 손패 맨 위 카드)가 처음부터 끝까지 앞면 쪽 맨 끝
  // (누워 있을 땐 맨 아래, 일어서면 나를 향한 맨 앞. 중간에 순서가 뒤집히지 않음)
  o.back.set(0,0,-1).applyQuaternion(_q);
  g.position.set(bx,by,bz).addScaledVector(o.back,c.m*.006);
  g.scale.setScalar(S);
  if(c.m===0&&c.id!=null&&!c.faced){c.faced=1;g.children[0].material=faceMat(c.id)}
  g.visible=!d.handed;
}
function dealUpdate(t){
  const d=T.deal;if(!d)return;
  const a=t-d.t0;
  if(a>=DL.riffle[0]+60)dealFire(d,'riffle',()=>sfx('riffle'));
  if(a>=DL.square[0])dealFire(d,'sq',()=>sfx('square'));
  if(a>=DL.cut1[0])dealFire(d,'c1',()=>sfx('cut'));
  if(a>=DL.cut2[0])dealFire(d,'c2',()=>sfx('cut'));
  if(a>=DL.slide[1])dealFire(d,'sl',()=>sfx('tick'));
  if(d.me>=0&&a>=DL.lift)dealFire(d,'lift',()=>sfx('lift'));
  if(d.me>=0&&!d.fanned&&a>=DL.lift+DL.liftDur+DL.hold){d.fanned=true;d.handed=true;fanIn(d)}   // 눈앞에 멈춘 3D 묶음 → 같은 자리의 2D 묶음으로 바꾸고 펼침
  if(T.ok)for(const c of d.cards){
    if(!c.g)continue;
    if(c.k!=null&&a>=c.dt&&!c.fl){c.fl=1;if(c.k%2===0||c.k<12)sfx('flick')}
    c.g.visible=true;dealPose(d,c,a);
  }
  if(a>=DEAL_MS)dealEnd(d);
}
function dealEnd(d){
  T.deal=null;$('#hand').classList.remove('dealing');$('#stage').classList.remove('dealing');
  if(T.ok){
    const by=new Map();
    for(const c of d.cards){
      if(c.seat===d.me||!V||!V.ps||c.m>=14){killCard(c.g);continue}
      if(!by.has(c.seat))by.set(c.seat,[]);by.get(c.seat).push(c);
    }
    for(const [i,list] of by){
      list.sort((a,b)=>a.m-b.m);
      const arr=list.map(c=>{const g=c.g,u=g.userData;u.man=false;u.p.set(c.dx,c.dy,c.dz);u.rx=Math.PI/2;u.ry=seatAngle(i);u.s=.8;
        g.quaternion.identity();g.rotation.order='YXZ';g.rotation.set(Math.PI/2,seatAngle(i),0);g.position.copy(u.p);g.scale.setScalar(.8);g.visible=true;return g});
      T.stacks.set(i,arr);
    }
    if(V)sync3D(V,null);
  }
}
/* 손패: 화면 아래 밖에서 한 장처럼 고개를 숙인 채 올라와 고개를 들고, 다 올라오면 부채꼴로 펼쳐짐 */
function fanIn(d){
  // 3D 묶음이 멈춘 자리(손패 가운데)에 겹친 채 나타나서 그대로 부채꼴로 펼쳐짐
  const hand=$('#hand');hand.classList.remove('dealing');$('#stage').classList.remove('dealing');
  const cards=[...hand.children];if(!cards.length||!cards[0].animate)return;
  const R=parseFloat(hand.style.getPropertyValue('--R'))||600,r=d&&d.handR||1,mid=R+44;   // 카드 가운데 기준으로 크기 조절
  const tf=(rot,sc)=>`rotate(${rot}) translateY(${-mid}px) scale(${sc}) translateY(${mid}px)`;
  cards.forEach(c=>{
    const a=c.style.getPropertyValue('--a')||'0rad';
    try{c.animate([{transform:tf('0rad',r)},{transform:tf('0rad',1),offset:.45},{transform:tf(a,1)}],{duration:DL.fanDur,easing:'cubic-bezier(.3,.7,.25,1)',fill:'backwards'})}catch(e){}
  });
}
function fieldSpot(k){const a=k*2.399,r=.25+Math.min(.85,k*.06);return new THREE.Vector3(Math.cos(a)*r,.02+k*.012,Math.sin(a)*r)}
function nearMe(){return new THREE.Vector3(0,1.6,6.6)}
/* ===== 3D 말풍선 (구라! / 구라?) — 테이블 안에 떠 있어서 앞쪽 카드가 자연스럽게 가림 ===== */
T.bubbles=[];
function bubbleTex(kind,ang){
  const W=440,Hc=360,draw=(g)=>{
    g.clearRect(0,0,W,Hc);g.save();g.scale(2,2);
    // 꼬리는 화면에서 말한 사람 쪽으로, 어느 방향이든 몸통 밖으로 비슷한 길이만큼 나오게
    const ex=1/Math.sqrt((Math.cos(ang)/BUB.rx)**2+(Math.sin(ang)/BUB.ry)**2);
    const lim=Math.min(Math.abs(Math.cos(ang))>1e-3?106/Math.abs(Math.cos(ang)):1e9,Math.abs(Math.sin(ang))>1e-3?86/Math.abs(Math.sin(ang)):1e9);
    const path=new Path2D(burstPath(ang,Math.min(lim,ex+38)));
    g.lineJoin='round';g.lineWidth=4;
    g.fillStyle=kind==='q'?'#f2b632':'#cc3a2e';g.strokeStyle=kind==='q'?'#c08a17':'#922519';
    g.fill(path);g.stroke(path);g.restore();
    g.textAlign='center';g.textBaseline='middle';g.font='64px Jua, "Black Han Sans", sans-serif';
    g.save();g.translate(W/2,Hc*.46);g.rotate(-.09);
    if(kind==='q'){g.fillStyle='rgba(255,250,240,.6)';g.fillText('구라?',0,4);g.fillStyle='#3b2a1f';g.fillText('구라?',0,0)}
    else{g.fillStyle='#922519';g.fillText('구라!',0,4);g.fillStyle='#fffaf0';g.fillText('구라!',0,0)}
    g.restore();
  };
  const tex=canvasTex(W,Hc,draw);
  if(document.fonts&&document.fonts.load)document.fonts.load('64px Jua').then(()=>{draw(tex.image.getContext('2d'));tex.needsUpdate=true}).catch(()=>{});
  return tex;
}
function show3DBubble(i,kind,life){
  try{
    if(!T.scene)return false;
    T.bubbles.filter(b=>b.i===i).forEach(killBubble);
    // 말풍선은 테이블 위(가운데와 그 사람 자리 사이)에 띄우고, 꼬리로 그 사람 쪽을 가리킴 → 가로·세로 화면 모두 화면 안에 보임
    const base=seatPos(i,1.75);base.y=1.15;
    const seat=seatPos(i,3.85);seat.y=.4;
    const pb=base.clone().project(T.cam),ps=seat.clone().project(T.cam);
    const cw=T.r.domElement.clientWidth||1,ch=T.r.domElement.clientHeight||1;
    const ang=Math.atan2(-(ps.y-pb.y)*ch,(ps.x-pb.x)*cw);
    const mat=new THREE.SpriteMaterial({map:bubbleTex(kind,ang),transparent:true,depthTest:false,depthWrite:false,fog:false});
    const sp=new THREE.Sprite(mat);sp.position.copy(base);sp.renderOrder=50;   // 테이블·카드 더미·배경보다 항상 앞
    const d=T.cam.position.distanceTo(base),k=Math.pow(d/10,.55);
    T.scene.add(sp);
    T.bubbles.push({i,kind,sp,mat,t0:clock(),life:life||1600,w:1.7*k});
    return true;
  }catch(e){return false}
}
const ON_TOP=new Map();
function onTopMat(m){let t=ON_TOP.get(m);if(!t){t=m.clone();t.transparent=true;ON_TOP.set(m,t)}return t}
function killBubble(b){if(b.sp.parent)b.sp.parent.remove(b.sp);if(b.mat.map)b.mat.map.dispose();b.mat.dispose();T.bubbles=T.bubbles.filter(x=>x!==b)}
function updBubbles(t){
  for(const b of [...T.bubbles]){
    const a=t-b.t0;if(a>b.life+300){killBubble(b);continue}
    // 튀어나오기(살짝 넘쳤다가 제자리) → 유지 → 작아지며 사라짐
    let s=a<320?(()=>{const x=a/320;return .3+.7*(1+2.2*Math.pow(x-1,3)+1.2*Math.pow(x-1,2))})():1;
    let op=1;if(a>b.life){const x=(a-b.life)/300;op=1-x;s*=1-.15*x}
    b.mat.opacity=Math.max(0,op);
    b.sp.scale.set(b.w*s,b.w*s*360/440,1);
    b.mat.rotation=b.kind==='q'?Math.sin(a/160)*.05:Math.sin(a/90)*.015;   // 구라?는 갸웃갸웃
    b.sp.position.y+= (Math.sin(a/300)*.0015);
  }
}
function sync3D(v,pv){
  const fk=G.pre3D?G.pre3D(v):null;   // 3D가 없어도 필요한 표시 (대부호의 2D 조합)
  if(!T.ok)return;
  if(!v||!v.ps||v.st==='wait'){
    T.field.forEach(killCard);T.field=[];T.fieldKey='';for(const arr of T.stacks.values())arr.forEach(killCard);T.stacks.clear();T.ring.visible=false;return;
  }
  const me=myIdx();
  if(T.seatKey!==v.ps.length+':'+me)resize3D();   // 인원·내 자리가 바뀌면 카메라를 다시 맞춤
  if(T.deal){G.field3D(v,pv,me,fk);return}
  for(const [i,arr] of T.stacks)if(i>=v.ps.length||i===me){arr.forEach(killCard);T.stacks.delete(i)}
  v.ps.forEach((p,i)=>{
    if(i===me)return;
    const want=Math.min(+p.c||0,14);let arr=T.stacks.get(i);if(!arr){arr=[];T.stacks.set(i,arr)}
    while(arr.length>want)killCard(arr.pop());
    while(arr.length<want){const sp=seatPos(i,3.85);sp.y=.5;arr.push(makeCard(sp,Math.PI/2,seatAngle(i),.8))}
    const sp=seatPos(i,3.85);
    arr.forEach((c,k)=>{c.userData.p.set(sp.x,.03+k*.016,sp.z);c.userData.ry=seatAngle(i);c.userData.rx=Math.PI/2;c.userData.s=.8});
  });
  G.field3D(v,pv,me,fk);   // 테이블 가운데 카드는 게임마다 다름
}
