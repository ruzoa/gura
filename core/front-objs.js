/* index.html 공통 코드 · 홀로그램·구멍·시작 버튼·카메라·타임머신·자판 동작·대기실 갱신. 파일 순서는 index.html의 <script src> 순서 */
/* 홀로그램 말: 게임 속 물건 모양을 반투명하게 (밝게 더하지 않아서 밝은 펠트 위에서도 모양이 또렷). 가장자리만 주황빛 */
function holoMat(color,map){
  return new THREE.ShaderMaterial({transparent:true,depthWrite:false,
    uniforms:{uC:{value:new THREE.Color(color)},uMap:{value:map||null},uR:{value:new THREE.Color(HOLO_C)},uA:{value:0},uT:GFX_U.time},
    defines:map?{USE_HMAP:''}:{},
    vertexShader:'varying vec2 vUv;varying vec3 vN;varying vec3 vV;varying float vY;void main(){vUv=uv;vec4 w=modelMatrix*vec4(position,1.0);vY=w.y;vec4 mv=viewMatrix*w;vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',
    fragmentShader:'uniform vec3 uC;uniform vec3 uR;uniform float uA;uniform float uT;uniform sampler2D uMap;varying vec2 vUv;varying vec3 vN;varying vec3 vV;varying float vY;void main(){vec3 b=uC;\n#ifdef USE_HMAP\nvec4 tx=texture2D(uMap,vUv);b*=tx.rgb;\n#endif\nfloat f=1.0-abs(dot(normalize(vN),normalize(vV)));vec3 col=mix(b,uR,0.28)+uR*pow(f,2.0)*0.85;float sc=0.88+0.12*sin(vY*90.0-uT*4.0);gl_FragColor=vec4(col,uA*(0.58+0.42*pow(f,1.5))*sc);}'});
}
function frontHoloPiece(id){
  const g=new THREE.Group(),mats=[];
  const add=(geo,mat,x=0,y=0,z=0,rx=0,ry=0,rz=0,sy=1)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.rotation.set(rx,ry,rz);m.scale.y=sy;m.renderOrder=41;g.add(m);if(!mats.includes(mat))mats.push(mat);return m};
  if(id==='gura'){const m=holoMat(0xffffff,T.back.map);add(new THREE.BoxGeometry(.4,.58,.012),m,-.09,0,0,0,0,.14);add(new THREE.BoxGeometry(.4,.58,.012),m,.1,.03,-.05,0,0,-.1)}   // 카드 두 장 (진짜 뒷면 그림)
  else if(id==='president'){   // 카드 위에 작은 왕관
    add(new THREE.BoxGeometry(.4,.58,.012),holoMat(0xffffff,T.back.map),0,-.06,0,0,0,-.06);
    const m=holoMat(0xf2b632),cy=.3;add(new THREE.CylinderGeometry(.16,.15,.09,20,1,true),m,0,cy,0);
    for(let k=0;k<5;k++){const a=k/5*Math.PI*2;add(new THREE.ConeGeometry(.045,.13,4),m,Math.sin(a)*.155,cy+.1,Math.cos(a)*.155);add(new THREE.SphereGeometry(.024,8,6),m,Math.sin(a)*.155,cy+.18,Math.cos(a)*.155)}}
  else if(id==='quoridor'){const pw=holoMat(0xd99a5a),wl=holoMat(0x8a5530);add(new THREE.CylinderGeometry(.08,.15,.3,16),pw,-.16,-.06,0);add(new THREE.SphereGeometry(.1,14,10),pw,-.16,.16,0);add(new THREE.BoxGeometry(.08,.24,.62),wl,.18,-.08,0)}   // 말과 벽
  else if(id==='yahtzee'){   // 컵에서 주사위가 비어져 나옴
    const dt=canvasTex(128,128,(x,w,h)=>{x.fillStyle='#fff';x.fillRect(0,0,w,h);x.fillStyle='#cc3a2e';for(const [a,b] of [[32,32],[96,32],[64,64],[32,96],[96,96]]){x.beginPath();x.arc(a,b,13,0,7);x.fill()}}),dm=holoMat(0xffffff,dt);
    add(new THREE.CylinderGeometry(.2,.16,.42,24,1,true),holoMat(0x8a4a2a),-.1,-.04,0,0,0,-.5);
    add(new THREE.BoxGeometry(.17,.17,.17),dm,.14,-.16,.06,.4,.7,.2);add(new THREE.BoxGeometry(.17,.17,.17),dm,.3,-.17,-.08,.9,.2,.5);add(new THREE.BoxGeometry(.17,.17,.17),dm,.04,.16,.02,.3,1.1,.8)}
  else if(id==='omok'){add(new THREE.SphereGeometry(.2,20,12),holoMat(0x2a2a2a),-.13,0,0,0,0,0,.45);add(new THREE.SphereGeometry(.2,20,12),holoMat(0xf6f3ea),.13,.1,-.05,0,0,0,.45)}   // 흑돌·백돌
  else if(id==='chess'&&GAMES.chess&&GAMES.chess.holoPiece){   // 게임 속 나이트 그대로 (반투명)
    const m=holoMat(0xf3e8d2),k=GAMES.chess.holoPiece(m);k.scale.setScalar(.44);k.position.y=-.2;k.rotation.y=-.6;k.traverse(o=>{if(o.isMesh)o.renderOrder=41});g.add(k);mats.push(m)}
  else if(id==='janggi'&&GAMES.janggi&&GAMES.janggi.holoPiece){   // 楚 장 알과 漢 차 알 (게임이 모양을 정하고 재질은 여기서)
    const k=GAMES.janggi.holoPiece((c,map)=>{const m=holoMat(c,map);mats.push(m);return m});k.traverse(o=>{if(o.isMesh)o.renderOrder=41});g.add(k)}
  else if(id==='blackjack'){   // A♠ 카드 한 장과 칩 더미
    const at=canvasTex(128,186,(x,w,h)=>{x.fillStyle='#fff';x.fillRect(0,0,w,h);x.fillStyle='#34404f';x.font='600 34px "IBM Plex Mono", monospace';x.textAlign='left';x.textBaseline='top';x.fillText('A',10,8);x.font='86px sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText('♠',w/2,h/2+8)});
    add(new THREE.BoxGeometry(.4,.58,.012),holoMat(0xffffff,at),-.1,.04,0,0,0,.12);
    const cm=holoMat(0xcc3a2e),cw=holoMat(0xf6f3ea);for(let k=0;k<4;k++){add(new THREE.CylinderGeometry(.12,.12,.045,20),k%2?cw:cm,.17,-.2+k*.05,.06)}}
  else if(id==='poker'){   // 엎은 카드와 A♠ 두 장, 칩 기둥
    const at=canvasTex(128,186,(x,w,h)=>{x.fillStyle='#fff';x.fillRect(0,0,w,h);x.fillStyle='#34404f';x.font='600 34px "IBM Plex Mono", monospace';x.textAlign='left';x.textBaseline='top';x.fillText('A',10,8);x.font='86px sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText('♠',w/2,h/2+8)});
    add(new THREE.BoxGeometry(.4,.58,.012),holoMat(0xffffff,T.back.map),-.2,.02,-.03,0,0,.2);add(new THREE.BoxGeometry(.4,.58,.012),holoMat(0xffffff,at),-.04,.05,0,0,0,-.08);
    const cm=holoMat(0x2e7d4f),cw=holoMat(0xf6f3ea);for(let k=0;k<5;k++){add(new THREE.CylinderGeometry(.12,.12,.045,20),k%2?cw:cm,.22,-.22+k*.05,.06)}}
  else if(id==='alkkagi'&&GAMES.alkkagi&&GAMES.alkkagi.holoPiece){   // 풀차징된 손과 흑돌 (게임이 모양을 정하고 재질은 여기서)
    const k=GAMES.alkkagi.holoPiece(c=>{const m=holoMat(c);mats.push(m);return m});k.traverse(o=>{if(o.isMesh)o.renderOrder=41});g.add(k)}
  else add(new THREE.OctahedronGeometry(.25),holoMat(0xffffff));
  g.userData={mats};return g;
}
/* 탁자에서 올라오는 물건(투사기·시작 버튼)의 구멍: 카메라 조리개처럼 열리고 닫힘 */
function frontHole(TG,x,y,z,r){
  const hole=new THREE.Group();hole.position.set(x,y,z);TG.add(hole);
  const hd=new THREE.Mesh(new THREE.CircleGeometry(r,40),new THREE.MeshBasicMaterial({color:0x15100c}));hd.rotation.x=-Math.PI/2;hole.add(hd);
  const hr=new THREE.Mesh(new THREE.RingGeometry(r,r*1.12,40),new THREE.MeshBasicMaterial({color:0x9a7a4a}));hr.rotation.x=-Math.PI/2;hr.position.y=.001;hole.add(hr);
  hole.scale.setScalar(.001);hole.visible=false;return hole;
}
function frontBuildHolo(TG){
  const hole=frontHole(TG,0,.0185,0,.5);   // 천이 다 깔리면 열림
  const g=new THREE.Group();g.position.y=-.35;TG.add(g);
  const metal=toon({color:0x3a3430,rim:.25}),brass=toon({color:0xb8925a,rim:.3});
  const base=new THREE.Mesh(new THREE.CylinderGeometry(.3,.4,.16,32),metal);base.position.y=.08;base.castShadow=true;g.add(base);hull(new THREE.CylinderGeometry(.32,.43,.19,32),base,g);
  const neck=new THREE.Mesh(new THREE.CylinderGeometry(.16,.22,.08,24),brass);neck.position.y=.2;g.add(neck);
  const lens=new THREE.Mesh(new THREE.CylinderGeometry(.14,.14,.03,24),new THREE.MeshBasicMaterial({color:HOLO_C}));lens.position.y=.255;g.add(lens);
  // 빛기둥: 아래가 밝고 위로 갈수록, 또 옆 가장자리일수록 흐려짐 (경계선이 보이지 않게) + 위로 흐르는 줄무늬
  const beamM=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
    uniforms:{uC:{value:new THREE.Color(HOLO_C)},uT:GFX_U.time,uA:{value:0}},
    vertexShader:'varying vec2 vUv;varying vec3 vN;varying vec3 vV;void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(position,1.0);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}',
    fragmentShader:'uniform vec3 uC;uniform float uT;uniform float uA;varying vec2 vUv;varying vec3 vN;varying vec3 vV;void main(){float up=pow(1.0-vUv.y,1.8);float edge=pow(abs(dot(vN,vV)),2.2);float scan=0.8+0.2*sin(vUv.y*60.0-uT*3.5);gl_FragColor=vec4(uC*up*edge*scan*uA,1.0);}'});
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(1,.14,1,40,1,true),beamM);beam.renderOrder=39;g.add(beam);
  const gc=canvasTex(128,128,(x,w,h)=>{const gr=x.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);gr.addColorStop(0,'rgba(255,255,255,.9)');gr.addColorStop(.35,'rgba(255,255,255,.35)');gr.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=gr;x.fillRect(0,0,w,h)});
  const glow=new THREE.Mesh(new THREE.CircleGeometry(.9,40),new THREE.MeshBasicMaterial({map:gc,color:HOLO_C,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false}));glow.rotation.x=-Math.PI/2;glow.position.y=.4;g.add(glow);   // 펠트 위 은은한 빛
  const NP=26,pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.BufferAttribute(new Float32Array(NP*3),3));
  const dust=new THREE.Points(pg,new THREE.PointsMaterial({map:gc,color:HOLO_LINE,size:.06,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false}));g.add(dust);   // 빛 속 먼지 알갱이
  const car=new THREE.Group();g.add(car);
  const pieces=GAME_IDS.map(id=>{const p=frontHoloPiece(id);p.userData.id=id;car.add(p);return p});
  {const nc=document.createElement('canvas');nc.width=nc.height=128;const c=nc.getContext('2d');   // 금지 표시: 홀로그램처럼 빛나는 반투명 선 + 가로 줄무늬
   const ring=()=>{c.beginPath();c.arc(64,64,46,0,7);c.moveTo(32,96);c.lineTo(96,32)};c.lineCap='round';
   c.shadowColor='#ff4d6d';c.shadowBlur=14;c.strokeStyle='rgba(255,77,109,.75)';c.lineWidth=12;ring();c.stroke();
   c.shadowBlur=0;c.strokeStyle='rgba(255,170,185,.95)';c.lineWidth=4;ring();c.stroke();
   c.globalCompositeOperation='destination-out';c.fillStyle='rgba(0,0,0,.45)';for(let y=0;y<128;y+=5)c.fillRect(0,y,128,2);
   const nt=new THREE.CanvasTexture(nc);pieces.forEach(p=>{const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:nt,transparent:true,depthTest:false,depthWrite:false,opacity:0}));sp.scale.setScalar(.62);sp.renderOrder=5;p.add(sp);p.userData.no=sp})}
  T.holo={g,base,lens,beam,car,pieces,glow,dust,hole};
}
/* 시작 버튼: 디스플레이 왼쪽 나무 띠에서 올라오는 둥근 빨간 버튼 (방장). 0.5초 누르고 있으면 시작 */
function frontBuildStart(TG){
  const hole=frontHole(TG,-1.2,.003,4.18,.33);
  const g=new THREE.Group();g.position.set(-1.2,-.3,4.18);TG.add(g);
  const base=new THREE.Mesh(new THREE.CylinderGeometry(.26,.3,.1,32),toon({color:0x3a3430,rim:.2}));base.position.y=.05;base.castShadow=true;g.add(base);hull(new THREE.CylinderGeometry(.28,.33,.13,32),base,g);
  const cap=new THREE.Mesh(new THREE.CylinderGeometry(.2,.21,.12,32),toon({color:0xcc3a2e,rim:.35}));cap.userData.on=new THREE.Color(0xcc3a2e);cap.userData.off=new THREE.Color(0x8d837b);cap.position.y=.15;cap.castShadow=true;g.add(cap);hull(new THREE.CylinderGeometry(.215,.225,.15,32),cap,g);
  T.startBtn={g,cap,hole};
}
/* 디스플레이 그리기: 바뀐 칸만 넘어감(그동안 아무 글자나 빠르게) */
function frontSetBoard(chars,spin){
  const t=clock();
  chars.forEach((c,i)=>{const f=FR.flaps[i];if(spin){f.to=null;f.until=1e12;return}
    if(f.to===c&&f.until<1e12)return;f.to=c;f.until=t+160+i*120+Math.random()*60});
}
function frontDrawBoard(force){
  const B=T.board;if(!B)return;
  const t=clock(),fb=t-(FR.fullAt||-1e9),warn=(FR.word&&FR_WORD.has(FR.word))||FR.bad||(fb<520&&((fb/130)|0)%2===0),audible=FR.open>.3;
  for(const f of FR.flaps){
    if(t<f.until){if(t>=f.next){f.next=t+55;f.ch=FR_POOL[Math.random()*FR_POOL.length|0];f.mid=1;if(audible)sfx('flap')}}
    else if(f.ch!==f.to){f.ch=f.to==null?' ':f.to;f.mid=0;if(audible)sfx('flap')}
  }
  const key=FR.flaps.map(f=>f.ch+(f.mid?'|':'')).join('')+(warn?'!':'')+(FR.lock||'')+(FR.eye||'');
  if(!force&&key===FR.drawn)return;FR.drawn=key;
  const g=B.cv.getContext('2d'),W=B.cv.width,Hc=B.cv.height;
  g.fillStyle='#2b1d14';g.fillRect(0,0,W,Hc);
  const fw=118,fh=164,gap=14,x0=(W-4*fw-3*gap)/2-22,y0=(Hc-fh)/2;
  FR.flaps.forEach((f,i)=>{
    const x=x0+i*(fw+gap);
    g.fillStyle='#16100c';rr(g,x,y0,fw,fh,12);g.fill();
    g.fillStyle='#231a14';rr(g,x,y0,fw,fh/2,12);g.fill();g.fillRect(x,y0+fh/2-12,fw,12);
    g.fillStyle='rgba(0,0,0,.55)';g.fillRect(x,y0+fh/2-1.5,fw,3);
    if(f.ch&&f.ch!==' '){
      g.save();g.fillStyle=warn?'#ff9b84':'#f6ecd8';g.textAlign='center';g.textBaseline='middle';
      const hang=/[가-힣]/.test(f.ch);g.font=`${hang?92:108}px "Black Han Sans", "Jua", "Apple SD Gothic Neo", sans-serif`;
      if(f.mid){g.globalAlpha=.85;g.translate(x+fw/2,y0+fh/2);g.scale(1,.86);g.fillText(f.ch,0,6)}else g.fillText(f.ch,x+fw/2,y0+fh/2+6);
      g.restore();
    }
    g.fillStyle='#3a2c22';g.fillRect(x-3,y0+fh/2-6,5,12);g.fillRect(x+fw-2,y0+fh/2-6,5,12);
  });
  // 오른쪽 끝 칸: 위 = 눈(번호 가리기, 누구나), 아래 = 자물쇠(closed 비공개 / open 공개: 방장에게만 흐리게)
  if(FR.eye){
    const ex=W-40,ey=56,shut=FR.eye==='shut';
    g.strokeStyle='#f6ecd8';g.lineWidth=5;g.beginPath();g.moveTo(ex-20,ey);g.quadraticCurveTo(ex,ey+(shut?16:-20),ex+20,ey);if(!shut)g.quadraticCurveTo(ex,ey+20,ex-20,ey);g.stroke();
    if(shut){for(const d of [-12,0,12]){g.beginPath();g.moveTo(ex+d,ey+9);g.lineTo(ex+d*1.3,ey+17);g.stroke()}}
    else{g.fillStyle='#f6ecd8';g.beginPath();g.arc(ex,ey,7,0,7);g.fill()}
  }
  if(FR.lock){
    const lx=W-40,ly=150,on=FR.lock==='closed';
    g.globalAlpha=on?1:.45;g.strokeStyle='#f2b632';g.lineWidth=7;g.beginPath();
    if(on)g.arc(lx,ly-14,13,Math.PI,0);else g.arc(lx+10,ly-24,13,Math.PI,-.2);
    g.stroke();g.fillStyle='#f2b632';rr(g,lx-19,ly-14,38,32,5);g.fill();g.fillStyle='#2b1d14';g.fillRect(lx-3,ly-4,6,12);g.globalAlpha=1;
  }
  B.tex.needsUpdate=true;
}
/* 서서 보는 눈: 탁자 전체와 그 위 하늘이 보이게. 좁은 화면은 뒤로 물러나고, 너무 멀어지면 화각을 넓힘 */
const _fc=window.THREE?new THREE.PerspectiveCamera(42,1,.1,140):null;
function frontPoses(w,h){
  if(!T.cam||!_fc)return;
  T.seat={p:T.cam.position.clone(),q:T.cam.quaternion.clone(),m:T.cam.projectionMatrix.clone()};
  const a=w/h,R=5.6,EL=15*Math.PI/180;let vf=40,tanV=Math.tan(vf/2*Math.PI/180),dist=Math.max(12.8,R/(tanV*a));
  if(dist>24){dist=24;tanV=R/(dist*a);vf=2*Math.atan(tanV)*180/Math.PI}
  _fc.fov=vf;_fc.aspect=a;_fc.position.set(0,.6+dist*Math.sin(EL),.4+dist*Math.cos(EL));_fc.lookAt(0,.3,0);_fc.updateMatrixWorld();_fc.updateProjectionMatrix();
  T.front={p:_fc.position.clone(),q:_fc.quaternion.clone(),m:_fc.projectionMatrix.clone()};
  {const tg=new THREE.Vector3(0,.2,DSP.Z+.1),R2=.82,EL2=50*Math.PI/180,tv=Math.tan(20*Math.PI/180),d2=Math.max(4.4,R2/(tv*a));   // 몸을 숙여 디스플레이·키판을 봄
   _fc.fov=40;_fc.position.set(0,tg.y+d2*Math.sin(EL2),tg.z+d2*Math.cos(EL2));_fc.lookAt(tg);_fc.updateMatrixWorld();_fc.updateProjectionMatrix();
   T.lean={p:_fc.position.clone(),q:_fc.quaternion.clone(),m:_fc.projectionMatrix.clone()}}
  if(T.plist){const P=T.plist,c=new THREE.Vector3(0,.002+P.L/2*Math.cos(P.tilt),DSP.Z+DSP.D*.8-P.L/2*Math.sin(P.tilt)),n=new THREE.Vector3(0,Math.sin(P.tilt),Math.cos(P.tilt));   // 목록 판을 정면에서 확대
   const tv=Math.tan(20*Math.PI/180),d=Math.max(P.L*.7/tv,(P.W+.55)*.56/(tv*a));
   _fc.fov=40;_fc.position.copy(c).addScaledVector(n,d);_fc.lookAt(c);_fc.updateMatrixWorld();_fc.updateProjectionMatrix();
   T.plCam={p:_fc.position.clone(),q:_fc.quaternion.clone(),m:_fc.projectionMatrix.clone()}
   // 규칙 나무판: 기둥까지 화면 폭을 채움(좁은 화면에서 글자가 작지 않게). 세로로 긴 화면은 판자를 길게(rbFit)
   rbFit(rbFitFor(a));
   const c2=new THREE.Vector3(0,.002+(RB.L/2+.08)*Math.cos(P.tilt),DSP.Z+DSP.D*.8-(RB.L/2+.08)*Math.sin(P.tilt)),d2=Math.max((RB.L+.3)*.54/tv,(RB.W/2+.3)/(tv*a));
   _fc.position.copy(c2).addScaledVector(n,d2);_fc.lookAt(c2);_fc.updateMatrixWorld();_fc.updateProjectionMatrix();
   T.rbCam={p:_fc.position.clone(),q:_fc.quaternion.clone(),m:_fc.projectionMatrix.clone()}}
  VW.max=viewLimit();FR.applied=false;frontApplyCam();
}
/* 고개 돌리기: 탁자 양옆이 화면에 다 안 보이는 좁은 화면에서, 앉은 눈이 제자리에서 좌우로 고개를 돎(VW.yaw). 양옆이 다 보이면 못 돌림(VW.max=0).
   탁자 끝까지만: 탁자 가장자리가 화면 가장자리에 닿을 때까지(frontPoses가 VW.max를 잼). 탁자 바깥에서 한 손가락으로 끌어 돌리고,
   놓고 1초 뒤 천천히 정중앙으로 돌아옴. 판 확대·서서 보기와 겹칠 때는 weight로 서서히 0 */
const VW={yaw:0,ty:0,max:0,drag:null,t:0,at:0,sens:Math.max(20,Math.min(300,+(store('gura-cam-sens')||100)||100))},_vq=window.THREE?new THREE.Quaternion():null,_vY=window.THREE?new THREE.Vector3(0,1,0):null;
function viewStep(t){
  const dt=Math.min(.1,Math.max(0,(t-VW.t)/1000));VW.t=t;
  VW.ty=Math.max(-VW.max,Math.min(VW.max,VW.ty));
  if(!VW.drag&&VW.ty&&t-VW.at>1000)VW.ty=0;   // 놓고 1초 뒤 정중앙으로
  VW.yaw+=(VW.ty-VW.yaw)*Math.min(1,dt*(VW.drag?22:VW.ty?9:3));if(Math.abs(VW.yaw-VW.ty)<1e-4)VW.yaw=VW.ty;
}
function viewTurn(w){const y=VW.yaw*w;if(!y)return;_vq.setFromAxisAngle(_vY,y);T.cam.quaternion.premultiply(_vq)}   // 제자리에서 고개만 (눈 위치는 그대로, y>0 = 왼쪽)
const viewOn=()=>!!(VW.yaw||VW.ty);
function viewReset(){VW.ty=0}
/* 돌릴 수 있는 범위: 앉은 눈으로 탁자 가장자리(반지름 4.94) 점들을 화면에 찍어 양옆이 다 보이면 0, 잘리면 고개를 돌려 가장자리가 화면 끝에 닿는 각도 */
const _vc=window.THREE?new THREE.PerspectiveCamera():null,_vp=window.THREE?new THREE.Vector3():null;
function viewLimit(){
  if(!_vc||!T.seat)return 0;
  _vc.position.copy(T.seat.p);_vc.projectionMatrix.copy(T.seat.m);_vc.projectionMatrixInverse.copy(T.seat.m).invert();
  const minX=ang=>{_vq.setFromAxisAngle(_vY,ang);_vc.quaternion.copy(T.seat.q).premultiply(_vq);_vc.updateMatrixWorld();let m=1e9;
    for(let a=0;a<48;a++){const r=a/48*Math.PI*2;_vp.set(Math.sin(r)*4.94,0,Math.cos(r)*4.94).project(_vc);m=Math.min(m,_vp.x)}return m};
  const edge=-.985;if(minX(0)>=edge)return 0;   // 양옆이 다 보임
  let lo=0,hi=Math.PI*80/180;if(minX(hi)<edge)return hi;   // 80°까지 돌려도 안 닿으면 거기까지
  for(let i=0;i<24;i++){const m=(lo+hi)/2;if(minX(m)<edge)lo=m;else hi=m}return hi;
}
const _m4=window.THREE?new THREE.Matrix4():null,_fpose=window.THREE?{p:new THREE.Vector3(),q:new THREE.Quaternion(),m:new THREE.Matrix4()}:null;
function frontApplyCam(){
  if(!T.seat||!T.front)return;
  const t=clock(),u=FR.stand,k=u*u*(3-2*u),jolt=t-FR.shakeAt<420?(1-(t-FR.shakeAt)/420):0,rum=FR.rum||0;
  const am=FR.arm?FR.arm.v:0;
  const l=FR.lean||0;
  if(k<=0&&!jolt&&!rum&&!am&&l<=0){const vo=viewOn();if(!FR.applied||vo||FR.viewDrawn){FR.applied=!vo;FR.viewDrawn=vo;T.cam.position.copy(T.seat.p);T.cam.quaternion.copy(T.seat.q);if(vo)viewTurn(1);T.cam.projectionMatrix.copy(T.seat.m);T.cam.projectionMatrixInverse.copy(T.seat.m).invert();T.cam.updateMatrixWorld();frontFog()}return}
  FR.viewDrawn=false;
  FR.applied=false;
  const ls=l*l*(3-2*l),F=_fpose;   // 앉음 ↔ 서서 봄, 그 위에 숙여서 봄
  F.p.lerpVectors(T.seat.p,T.front.p,k);F.q.copy(T.seat.q).slerp(T.front.q,k);{const a=T.seat.m.elements,b=T.front.m.elements,e=F.m.elements;for(let i=0;i<16;i++)e[i]=a[i]+(b[i]-a[i])*k}
  T.cam.position.lerpVectors(F.p,T.lean.p,ls);
  T.cam.quaternion.copy(F.q).slerp(T.lean.q,ls);
  const rz=FR.rba&&FR.rba.v>.01,ZC=rz?T.rbCam:T.plCam,pz=FR.pla&&ZC?smooth(rz?FR.rba.v:FR.pla.v)*ls:0;   // 목록 판·규칙 판이 올라오면 판으로 확대
  if(pz>0){T.cam.position.lerp(ZC.p,pz);T.cam.quaternion.slerp(ZC.q,pz)}
  if(am){const a=am*am*(3-2*am);T.cam.position.z+=.9*a;T.cam.position.y+=.55*a}   // 떠나려고 의자를 뺌
  const s=jolt*.12+rum*.012;   // 눈은 조금만 흔들림 (탁자가 더 흔들림)
  if(s){T.cam.position.x+=Math.sin(t/23)*s;T.cam.position.y+=Math.cos(t/17)*s*.7}
  viewTurn((1-k)*(1-ls)*(1-pz));
  const a=F.m.elements,b=T.lean.m.elements,e=_m4.elements;for(let i=0;i<16;i++)e[i]=a[i]+(b[i]-a[i])*ls;
  if(pz>0){const c2=ZC.m.elements;for(let i=0;i<16;i++)e[i]+=(c2[i]-e[i])*pz}
  T.cam.projectionMatrix.copy(_m4);T.cam.projectionMatrixInverse.copy(_m4).invert();T.cam.updateMatrixWorld();frontFog();
}
function frontFog(){if(T.scene&&T.scene.fog){const d=T.cam.position.length();T.scene.fog.near=d+5;T.scene.fog.far=d+22}}
/* 하늘 한 바퀴: 낮 → 저녁 → 밤 → 새벽 → 낮 */
const FR_SKY=window.THREE?[0xcfe6ee,0xf3b98c,0x34406a,0x1f2742,0xf4cfa2].map(c=>new THREE.Color(c)):null;
const _sky=window.THREE?new THREE.Color():null;
function frontSky(w,p,s){
  if(!w.base)return;
  const n=FR_SKY.length,x=((p%1)+1)%1*n,i=Math.floor(x),f=x-i;
  _sky.copy(FR_SKY[i%n]).lerp(FR_SKY[(i+1)%n],f);
  const dark=1-(.299*_sky.r+.587*_sky.g+.114*_sky.b);
  T.scene.background.copy(w.base.sky).lerp(_sky,s);T.scene.fog.color.copy(T.scene.background);
  if(T.hemi){T.hemi.intensity=w.base.hemi*(1-.6*dark*s);T.hemi.color.copy(w.base.hc).lerp(_sky,.5*s)}
  if(T.dl){T.dl.intensity=w.base.dl*(1-.75*dark*s);const a=p*Math.PI*2*s,b=w.base.dlp;T.dl.position.set(b.x*Math.cos(a)-b.z*Math.sin(a),b.y,b.x*Math.sin(a)+b.z*Math.cos(a))}   // 해가 돌아 그림자가 휙휙
}
function frontWarpStart(code){
  if(!FR.ok)return;
  if(FR.warp&&FR.warp.ph==='go'){FR.warp.code=code||FR.warp.code;return}
  FR.word='';FR.sit=true;
  FR.warp={t0:clock(),ph:'go',code:code||'',tw0:FR.tw,
    base:{sky:T.scene.background.clone(),hemi:T.hemi?T.hemi.intensity:1,hc:T.hemi?T.hemi.color.clone():null,dl:T.dl?T.dl.intensity:1,dlp:T.dl?T.dl.position.clone():new THREE.Vector3()}};
  if(lobbyView!=='main')showView('main',false);
  sfx('warpGo');
}
function frontWarpArrive(){const w=FR.warp;if(!w||w.ph!=='go')return;w.ph='arrive';w.t1=clock();w.f1=w.fog||0;w.s1=w.s||0;w.r1=w.rum||0;sfx('warpArrive')}
/* 못 감: 덜컹 → 떨림이 멎고 안개가 걷히면 원래 들판. 디스플레이에 두 글자 */
function frontFail(word){
  if(!FR.ok)return;
  FR.spread=false;frontWord(word,4500);FR.shakeAt=clock();
  const w=FR.warp;
  if(w&&w.ph!=='fail'){w.ph='fail';w.t1=clock();w.f1=w.fog||0;w.s1=w.s||0;w.r1=w.rum||0}
  sfx(w?'warpFail':'no');
}
function frontWord(word,ms){FR.word=word;FR.wordAt=clock();FR.wordMs=ms||4500}
function frontWarpEnd(){
  const w=FR.warp;if(!w)return;FR.warp=null;FR.rum=0;
  if(T.tableG){T.tableG.position.set(0,0,0);T.tableG.rotation.set(0,0,0)}
  if(w.base){T.scene.background.copy(w.base.sky);T.scene.fog.color.copy(w.base.sky);if(T.hemi){T.hemi.intensity=w.base.hemi;T.hemi.color.copy(w.base.hc)}if(T.dl){T.dl.intensity=w.base.dl;T.dl.position.copy(w.base.dlp)}}
  frontFog();
}
function frontCreate(){
  if(!FR.ok||mode!=='lobby'||FR.warp||FR.spread||net.peer)return;
  FR.word='';FR.spread=true;sfx('btnGo');createRoom();
}
/* 첫 자판: 상차리기 = 탁자를 차림, 찾아가기 = 숫자 키판으로 바꿈. 누르면 디스플레이에 이름이 플립으로 뜨고 바로 작동 */
function frontMenu(k){
  if(!FR.ok||mode!=='lobby'||FR.warp||FR.spread||net.peer||FR.kmode!=='menu')return;
  const t=clock(),m=T.menuPad.keys.find(x=>x.userData.k===k);if(m)m.userData.downAt=t;FR.sit=true;
  if(k==='create'){frontCreate();if(FR.spread)frontWord('상차리기',1600);return}
  if(k==='rules'){sfx('key');frontWord('규칙',1200);setTimeout(()=>frontRules('list'),140);return}   // 첫 자판이 들어가고 같은 틈에서 규칙 나무판(게임 목록)
  sfx('key');frontWord('참여하기',1200);FR.kmode='num';FR.backAt=0;FR.leanOn=true;FR.keyAt=t;
}
/* 키판: 숫자 4자리를 넣고 엔터면 찾아감. ← 지우기, 엔터 = 찾아가기, 돋보기 = 공개 탁자 목록 판, 주사위 = 아무 탁자나 */
function frontKey(k){
  if(!FR.ok||mode!=='lobby'||FR.warp||FR.spread||net.peer)return;
  const t=clock();FR.keyAt=t;FR.leanOn=true;FR.sit=true;
  if(FR.kmode!=='num'){if(k==='←')return;FR.kmode='num'}   // 첫 자판일 때 숫자를 치면(PC 키보드) 숫자 키판으로
  if(k!=='←'||FR.buf||FR.pub)FR.word='';
  const m=T.keypad.keys.find(x=>x.userData.k===k);if(m)m.userData.downAt=t;
  sfx(k==='dice'?'dice':'key');
  if(/^[0-9a-z]$/i.test(k)){
    FR.pub=null;if(FR.buf.length<4)FR.buf+=k.toLowerCase();else{FR.fullAt=t;if(m)m.userData.blockAt=t;sfx('no')}   // 엔터를 눌러야 찾아감. 4자리가 찼는데 더 누르면 숫자가 빨갛게 깜빡·디스플레이 부르르·키가 튕김
    return;
  }
  if(k==='←'){   // 지울 숫자가 없으면 한 번은 디스플레이에 '뒤로', 2.5초 안에 한 번 더 누르면 첫 자판으로
    if(FR.pub){FR.pub=null;FR.backAt=0;return}
    if(FR.buf){FR.buf=FR.buf.slice(0,-1);FR.backAt=0;return}
    if(FR.backAt&&t-FR.backAt<2500){FR.backAt=0;FR.word='';frontToMenu();return}
    FR.backAt=t;frontWord('뒤로',2500);return}
  if(k==='dice'){FR.buf='';FR.pub=null;setTimeout(()=>{if(mode==='lobby'&&!net.peer&&!FR.warp)randomJoin()},380);return}   // 주사위가 구르고 나서 출발
  if(k==='enter'){if(!frontGo())sfx('no');return}
  if(k==='search'){setTimeout(()=>frontList(true),140);return}   // 키가 눌린 걸 보고 나서 키판이 들어감
}
function frontToMenu(){FR.kmode='menu';FR.buf='';FR.pub=null;FR.backAt=0;if(FR.list)FR.list=false;FR.leanOn=false}
function frontGo(){   // 디스플레이를 누름 / Enter
  if(mode!=='lobby'||FR.warp||FR.spread||net.peer)return false;
  if(FR.pub){const c=FR.pub;FR.pub=null;joinRoom(c);return true}
  if(FR.buf.length===4){const c=FR.buf;FR.buf='';joinRoom(c);return true}
  return false;
}
/* 자판 자세: 디스플레이 아래에서 미끄러져 나온 뒤(0~.6) 올라옴(.6~1). 누른 키는 쑥 들어감 */
function padPose(P,want,t,ms){
  const v=frontTween(P.a,want?1:0,t,ms),s=smooth(clamp01(v/.6)),r=smooth(clamp01((v-.6)/.4));
  P.g.position.z=DSP.Z-.45+(.45+DSP.D/2)*s;P.g.position.y=-.012+.047*r;P.g.visible=v>.01;
  for(const m of P.keys){const d=t-m.userData.downAt;m.position.y=d<160?-.03:0}
}
function frontTween(a,to,t,ms){
  if(a.to!==to){a.from=a.v;a.to=to;a.t0=t;a.ms=ms*Math.abs(to-a.v)}
  a.v=a.ms>0?a.from+(a.to-a.from)*clamp01((t-a.t0)/a.ms):a.to;return a.v;
}
const frWaitV=()=>!!(V&&V.code&&V.st==='wait'&&(mode==='host'||mode==='guest'));
/* 탁자 위 물건으로 대기실을 다룰 수 있으면 대기실 창 대신 이름표·디스플레이·자판·시작 버튼을 씀 */
const frTableUI=()=>!!(FR.ok&&frWaitV());
function frontUpdate(t,dt){
  if(!FR.ok)return;
  const lobby=mode==='lobby',wait=frWaitV(),host=mode==='host';
  if(!wait){if(FR.browse)frontBrowse(false);if(FR.pop!=null)seatPopClose()}
  // 타임머신: 탁자가 떨리고, 해가 돌며 하늘이 낮·밤으로, 안개가 짙어졌다 걷힘 (풍경은 돌지 않음)
  const w=FR.warp;
  if(w){
    const a=t-w.t0,p=Math.max(0,a-900)/2400;
    if(w.ph==='go'){w.rum=smooth((a-600)/1200);w.s=smooth((a-900)/700);w.fog=smooth((a-1900)/1100)}
    else if(w.ph==='arrive'){
      const b=t-w.t1;
      if(!w.swapped&&b>=420){w.swapped=1;if(T.env)T.env.rotation.y+=1.3+Math.random()*3.6}   // 안개 속에서 다른 들판으로
      w.fog=b<420?w.f1+(1-w.f1)*smooth(b/420):1-smooth((b-450)/950);w.s=w.s1*(1-smooth((b-250)/1100));w.rum=w.r1*(1-smooth(b/900));
      if(b>1450)frontWarpEnd();
    }else{
      const b=t-w.t1;w.rum=b<120?1:w.r1*(1-smooth((b-120)/260));w.fog=w.f1*(1-smooth((b-250)/900));w.s=w.s1*(1-smooth((b-250)/900));
      if(b>1250)frontWarpEnd();
    }
    if(FR.warp){
      FR.rum=w.rum;FR.tw=w.tw0+p*7;frontSky(w,p,w.s);
      const r=w.rum*(w.ph==='fail'&&t-w.t1<380?2.4:1),G2=T.tableG;
      if(G2){G2.position.set(r*.03*(Math.sin(t/19)+.6*Math.sin(t/7.3)),r*.018*Math.abs(Math.sin(t/13)),r*.03*Math.sin(t/23+1));G2.rotation.set(r*.005*Math.sin(t/29),0,r*.006*Math.sin(t/17))}
    }
  }
  // 서기 ↔ 앉기
  const want=lobby&&!FR.warp&&!FR.sit?1:0;   // 첫 화면: 서서 탁자만 봄 → 탁자를 누르면 앉음
  if(FR.armAt&&(t-FR.armAt>2500||!(frTableUI()||(lobby&&FR.sit))))FR.armAt=0;
  frontTween(FR.arm,FR.armAt?1:0,t,FR.armAt?260:320);
  FR.stand=frontTween(FR.sa,want,t,want?900:1100);
  {const ok=!lobby&&!FR.warp&&FR.stand<.05&&(FR.lean||0)<.05&&FR.rba.v<=.01&&FR.pla.v<=.01&&VW.max>0&&(!T.lastCam||T.lastCam===T.cam);   // 카메라를 돌릴 수 있는 때: 탁자에 앉아 대기실·게임을 볼 때. 양옆이 다 보이는 화면과 자기 카메라로 그리는 게임(쿼리도·야추 등)은 빼고 버튼도 숨김
   if(ok!==FR.camOk){FR.camOk=ok;document.body.classList.toggle('camok',ok);if(!ok){VW.drag=null;if(lobby||FR.warp)viewReset()}}
   const y0=VW.yaw;viewStep(t);if(VW.yaw!==y0)FR.viewMoved=1}   // 돌아가는 동안 이름표 등 화면 위 글자가 따라감 (frontApplyCam 뒤)
  frontApplyCam();if(FR.viewMoved){FR.viewMoved=0;placeLabels()}
  if(FR.warp&&T.scene.fog){const d=T.cam.position.length(),k=FR.warp.fog||0;T.scene.fog.near=d+5+(1-5)*k;T.scene.fog.far=d+22+(8-22)*k}
  {const st=$('#stage'),sit=!lobby&&FR.stand>.04;if(st.classList.contains('frsit')!==sit)st.classList.toggle('frsit',sit)}
  {const st=$('#stage'),fw=frTableUI();if(st.classList.contains('frwait')!==fw)st.classList.toggle('frwait',fw)}   // 3D 대기실: 게임 CSS가 이름표를 숨겨도 대기실에서는 보이게   // 앉는 동안은 창을 잠깐 숨김
  // 천
  frontStumps(t,dt,lobby,wait);
  // 디스플레이: 첫 화면·타임머신·대기실에서 열림, 게임이 시작되면 접혀 덮개가 됨
  const padOut=[T.menuPad,T.hostPad,T.guestPad,T.sitPad].some(P=>P&&P.a.v>.01)||(FR.ka&&FR.ka.v>.01)||(FR.pla&&FR.pla.v>.01)||(FR.rba&&FR.rba.v>.01);
  const ow=(lobby&&FR.sit)||!!FR.warp||wait||padOut?1:0;   // 자판이 다 들어간 뒤에 덮개가 닫힘 (안 그러면 키가 탁자 위로 뚫고 나옴)
  if(FR.oa.to!==ow)sfx('lid');
  FR.open=frontTween(FR.oa,ow,t,ow?520:420);
  if(T.board){const o=smooth(FR.open),fb=t-(FR.fullAt||-1e9);T.board.g.rotation.x=-o*2.05;T.board.g.position.x=fb<260?Math.sin(fb/22)*.018*(1-fb/260):0;   // 4자리 넘게 누르면 부르르
    T.board.hole.visible=o>.02;T.board.screen.visible=o>.02;T.board.g.visible=o>.001}   // 닫히면 덮개도 안 보임(탁자 위는 깔끔하게)   // 첫 화면(서서 볼 때)은 탁자만: 덮개도 안 보임
  // 키판: 첫 화면에서 디스플레이가 열리면 올라옴. 누르면 그 키가 쑥 들어감 (주사위 키는 구르듯 흔들림)
  // 키판: 디스플레이 아래에서 미끄러져 나온 뒤(0~.6) 올라옴(.6~1). 들어갈 때는 거꾸로. 목록 판과 번갈아 나옴
  if(!lobby||!FR.sit||FR.spread||FR.warp)FR.list=false;
  const kbase=lobby&&FR.sit&&!FR.spread&&FR.stand<.3;
  if(!lobby||!FR.sit)FR.kmode='menu';
  if(T.menuPad){T.menuPad.a=FR.ma;padPose(T.menuPad,kbase&&FR.kmode==='menu'&&!FR.list&&!FR.rb.on&&FR.ka.v<=.01&&FR.pla.v<=.01&&FR.rba.v<=.01,t,lobby?620:400)}
  if(T.hostPad){   // 대기실 자판: 방장·참가자·관전자 중 하나만. 바뀔 때는 앞 자판이 다 들어간 뒤 나옴
    const me=wait?myIdx():-1,sitd=wait&&FR.stand<.05&&FR.open>.98&&!FR.warp,pads=[[T.hostPad,host],[T.guestPad,!host&&me>=0],[T.sitPad,!host&&me<0&&!!(V&&V.spec)]];
    pads.forEach(([P,mine])=>padPose(P,sitd&&mine&&!FR.rb.on&&FR.rba.v<=.01&&pads.every(([Q])=>Q===P||Q.a.v<=.01),t,wait?620:380));
    if(FR.clearHold&&(!wait||!host)){FR.clearHold=0;if(FR.humStop){FR.humStop();FR.humStop=null}}
    const hp=FR.clearHold?clamp01((t-FR.clearHold)/CLEAR_MS):0;FR.clearP=FR.clearHold?hp:Math.max(0,(FR.clearP||0)-dt*3);   // 떼면 천천히 원래 색으로
    for(const P of [T.hostPad,T.guestPad,T.sitPad])if(P.g.visible)P.keys.forEach(m=>{const k=m.userData.k,ok=frontWaitCan(k);
      if(k==='clear'){const p=FR.clearP;m.material[2].color.setRGB(1,1-.62*p,1-.68*p);m.material[0].color.setRGB(.85+.15*p,.78-.45*p,.66-.4*p);if(FR.clearHold)m.position.y=-.03*Math.min(1,hp*4)}   // 꾹 누르면 점점 빨갛게
      else m.material[2].color.setScalar(ok?1:.55)});   // 못 누르는 키는 어둡게
    if(FR.clearHold&&hp>=1){FR.clearHold=0;FR.word='';if(FR.humStop){FR.humStop();FR.humStop=null}setTimeout(frontClearGo,0)}   // 그리는 도중에 탁자를 닫지 않게 다음 차례에
  }
  {const c=t-(FR.clearAt||-1e9),G2=T.tableG;if(!FR.warp&&G2){if(c<650){const r=1-c/650;G2.position.set(r*.05*Math.sin(t/17),0,r*.04*Math.sin(t/23+1));G2.rotation.set(0,0,r*.012*Math.sin(t/13));FR.clearShook=1}else if(FR.clearShook){FR.clearShook=0;G2.position.set(0,0,0);G2.rotation.set(0,0,0)}}}   // 상을 치움: 탁자가 짧게 흔들림
  if(T.keypad){const kv=frontTween(FR.ka,kbase&&FR.kmode==='num'&&!FR.list&&FR.pla.v<=.01&&FR.ma.v<=.01&&FR.rba.v<=.01?1:0,t,lobby?720:400),ks=smooth(clamp01(kv/.6)),kr=smooth(clamp01((kv-.6)/.4));
    T.keypad.g.position.z=DSP.Z-.45+(.45+DSP.D/2)*ks;T.keypad.g.position.y=-.012+.042*kr;T.keypad.g.visible=kv>.01;
    const full=lobby&&FR.buf.length===4&&!FR.list;
    for(const m of T.keypad.keys){const d=t-m.userData.downAt,bk=t-(m.userData.blockAt||-1e9);m.position.y=bk<200?-.012*Math.sin(bk/200*Math.PI):d<140?-.028:0;   // 막힌 키는 반만 들어갔다 튕김
      if(m.userData.k==='enter'){const top=m.material[2],p=full?.5+.5*Math.sin(t/180):0;top.color.setRGB(1,1-.08*p,1-.45*p);if(full&&d>=140)m.position.y=.006*p}m.rotation.set(0,m.userData.k==='dice'&&d<420?Math.sin(d/30)*.5*(1-d/420):0,0)}}   // 4자리가 차면 엔터 키가 노랗게 깜빡
  if(T.plist){const P=T.plist,pv=frontTween(FR.pla,FR.list&&FR.ka.v<=.01&&FR.ma.v<=.01&&FR.rba.v<=.01?1:0,t,FR.list?520:380),pu=smooth(pv);
    if(FR.pla.to===1&&pv>0&&!FR.listUp){FR.listUp=1;sfx('btnUp')}if(FR.pla.to===0)FR.listUp=0;
    P.b.position.y=P.L/2-(P.L+.1)*(1-pu);P.g.visible=pv>.01;
if(pv>.01)frontDrawList(t);
    if(FR.list&&pv>=.98&&!FR.scan&&Date.now()-roomScanAt>15000&&Date.now()-(FR.autoAt||0)>15000){FR.autoAt=Date.now();frontListRefresh(false)}
    {P.lbtn.forEach(B=>{const d=t-B.at,k=d<0||d>300?0:d<90?d/90:1-(d-90)/210;B.m.position.z=B.o.position.z=B.z-.022*k})}   // 눌림
  }
  frontRulesUpdate(t,dt,lobby,wait);
  if(FR.leanOn&&!FR.rb.on&&(!lobby||!FR.sit||FR.warp||FR.spread||(t-FR.keyAt>20000&&!FR.buf&&!FR.pub&&!FR.list)))FR.leanOn=false;
  if(lobby&&FR.sit&&FR.kmode==='num'&&!FR.leanOn&&!FR.buf&&!FR.pub&&!FR.list&&!FR.warp&&!FR.spread)frontToMenu();   // 숙여 보기를 그만두면(빈 곳·Esc) 번호가 없을 때 첫 자판으로
  if(!lobby){FR.buf='';FR.pub=null}
  FR.lean=frontTween(FR.la,FR.leanOn?1:0,t,550);
  // 디스플레이 글자
  if(FR.word&&t-FR.wordAt>FR.wordMs)FR.word='';
  let chars=[' ',' ',' ',' '],spin=false;FR.bad=false;
  const hid=FR.browse?frontHoloId():null;
  if(FR.word){const s=FR.word;chars=s.length===2?[' ',s[0],s[1],' ']:s.length===3?[' ',...s]:s.padEnd(4).slice(0,4).split('')}
  else if(FR.warp&&FR.warp.ph!=='fail'){if(FR.warp.code)chars=FR.warp.code.toUpperCase().padEnd(4).slice(0,4).split('');else spin=true}
  else if(lobby&&FR.scan)spin=true;
  else if(lobby&&FR.pub)chars=FR.pub.toUpperCase().padEnd(4).slice(0,4).split('');
  else if(lobby&&FR.buf)chars=FR.buf.toUpperCase().padEnd(4).split('');
  else if(wait)chars=shownCode(V.code).padEnd(4).slice(0,4).split('');
  FR.lock=wait&&!FR.word?(!V.cfg.pub?'closed':host?'open':''):'';
  FR.eye=wait&&!FR.word?(hideCode?'shut':'open'):'';
  const key=chars.join('')+(spin?'*':'')+FR.lock+FR.eye+(FR.bad?'!':'');
  if(key!==FR.boardKey){FR.boardKey=key;frontSetBoard(chars,spin)}
  frontDrawBoard(false);
  if(T.board){const cp=FR.clearHold?FR.clearP||0:0,bl=cp>0&&Math.floor((2*cp+7*cp*cp)*2)%2===1;T.board.screen.material.color.setScalar(bl?.3:1)}   // 상치우기를 누르는 동안 디스플레이가 점점 빨리 깜빡임
  // 투사기·홀로그램, 시작 버튼
  frontHoloPose(t,wait);
  if(T.startBtn){const S=T.startBtn,can=mode==='host'&&canStart(),want=wait&&host&&can&&FR.stand<.05&&!FR.browse&&!roomSetOpen;   // 시작할 수 있을 때만 구멍이 열리고 올라옴. 아니면 아무 흔적 없음
    // 구멍이 열림 → 버튼이 올라옴 (내려갈 때는 버튼 → 구멍)
    const hw=want||FR.sta.v>.02?1:0,hu=smooth(frontTween(FR.sha,hw,t,hw?260:220));S.hole.visible=hu>.01;S.hole.scale.setScalar(Math.max(.001,hu));
    if(FR.sha.to===1&&FR.sha.v>=1&&!FR.btnHoleSnd){FR.btnHoleSnd=1;sfx('iris')}if(!hw)FR.btnHoleSnd=0;
    const sw=want&&hu>.98?1:0;
    if(FR.sta.to!==sw&&sw===1)sfx('btnUp');
    const su=frontTween(FR.sta,sw,t,420);S.g.position.y=-.3+.3*smooth(su);S.g.visible=su>.01;
    
    const hp=FR.holdAt?clamp01((t-FR.holdAt)/500):0;S.cap.position.y=.15-.06*Math.min(1,hp*3);
    $('#frStart').style.setProperty('--p',hp);$('#frStart').setAttribute('aria-disabled',String(!can));
    if(FR.holdAt&&hp>=1){FR.holdAt=0;if(mode==='host'&&H&&H.phase==='wait'){if(canStart()){sfx('btnGo');hostStart()}else frontNeedSeats()}}}
  frontLayout(lobby,wait,host,t);
}
/* 홀로그램: idle = 지금 게임 말 하나가 투사기 위에서 천천히 돎, browse = 가운데 크게·양옆 작게 */
function frontCanPlay(id){const g=gameOf(id);return !(g.maxHi&&V&&V.ps&&V.ps.length>g.maxHi)}
function frontHoloId(){const n=GAME_IDS.length;return GAME_IDS[((FR.hpos%n)+n)%n]}
function frontBrowse(on){
  if(on===FR.browse)return;FR.browse=on;FR.hdrag=null;
  if(on){seatPopClose();FR.hpos=Math.max(0,GAME_IDS.indexOf((V&&V.cfg&&V.cfg.game)||'gura'));FR.hra={v:FR.hpos,to:FR.hpos,from:FR.hpos,t0:0,ms:0};sfx('holoOn')}
  else sfx('holoOff');
  $('#stage').classList.toggle('holo',on);
}
function frontHoloStep(d){if(!FR.browse||FR.hdrag!=null)return;FR.hpos+=d;sfx('holoTick')}
function frontHoloPick(){
  if(!FR.browse)return;const id=frontHoloId();
  if(!frontCanPlay(id)||mode!=='host'||!H||H.phase!=='wait'){sfx('no');return}
  if(H.cfg.game!==id)hostSetGame(id);
  sfx('holoPick');frontBrowse(false);
}
function frontHoloPose(t,wait){
  const Hh=T.holo;if(!Hh)return;
  // 천이 다 깔림 → 구멍이 열림 → 투사기가 올라옴 (내려갈 때는 거꾸로)
  // 가운데 구멍: 앉으면 열리고 상차리기 버튼이 올라옴 → 누르면 버튼이 들어가고 투사기가 올라옴 (정리할 때는 투사기 → 구멍 순서)
  const lobby=mode==='lobby';
  const pu=FR.dva.v,holeW=(lobby&&FR.spread)||wait||pu>.02?1:0;
  const hu=smooth(frontTween(FR.hla,holeW,t,holeW?320:260));
  if(FR.hla.to===1&&FR.hla.v>=1&&!FR.holeSnd){FR.holeSnd=1;sfx('iris')}if(!holeW)FR.holeSnd=0;
  Hh.hole.visible=hu>.01;Hh.hole.scale.setScalar(Math.max(.001,hu));
  const up=smooth(frontTween(FR.dva,wait&&hu>.98?1:0,t,wait?700:450)),br=smooth(frontTween(FR.hba,FR.browse?1:0,t,FR.browse?550:400));
  Hh.g.position.y=-.35+.356*up;Hh.g.visible=up>.01;
  const cp=FR.clearP||0,col=FR.collapseAt?smooth(clamp01((t-FR.collapseAt)/CLEAR_SUCK)):0;   // 상치우기: 누르는 정도(지직거림) · 빨려 들어감
  if(FR.collapseAt&&!wait&&FR.dva.v<.02)FR.collapseAt=0;
  const zz=cp>0&&!col?(Math.random()<.12+.35*cp?.15+.5*Math.random():1-.45*cp):1,cs=1-col;
  const on=up>.6,glow=(on?(up-.6)/.4:0)*zz*(col?Math.max(.0,1-col*.6):1),flick=.85+.15*Math.sin(t/37)*Math.sin(t/91);
  Hh.beam.visible=Hh.car.visible=Hh.dust.visible=on;
  const bh=(.85+.45*br)*Math.max(.02,cs);Hh.beam.scale.set((.5+.45*br)*Math.max(.02,cs),bh,(.5+.45*br)*Math.max(.02,cs));Hh.beam.position.y=.27+bh/2;Hh.beam.material.uniforms.uA.value=(.55+.3*br)*glow*flick;
  FR.holoTop=Hh.g.position.y+.27+bh;FR.holoGlow=glow;
  Hh.glow.material.opacity=(.35+.2*br)*glow;Hh.glow.scale.setScalar(.8+.5*br);Hh.glow.position.y=-.32+.35;
  {const a=Hh.dust.geometry.attributes.position,N=a.count;for(let i=0;i<N;i++){const f=((t/2800+i/N*1.618)%1),r=(.06+.3*f)*(.4+.6*((i*.37)%1)),an=i*2.4+t/2600;a.setXYZ(i,Math.sin(an)*r,.3+f*bh*1.05,Math.cos(an)*r)}a.needsUpdate=true;Hh.dust.material.opacity=.7*glow}
  const n=GAME_IDS.length,cur=Math.max(0,GAME_IDS.indexOf((V&&V.cfg&&V.cfg.game)||'gura'));
  const rot=FR.hdrag!=null?FR.hdrag:frontTween(FR.hra,FR.hpos,t,320),cy=.95;   // 미는 동안은 손을 그대로 따라감
  Hh.pieces.forEach((p,k)=>{
    // 고르는 중: 가운데 하나만 크게, 양옆에 이전·다음이 작게. 나머지는 숨음 (끝에서 처음으로 이어짐)
    let d=((k-rot)%n+n)%n;if(d>n/2)d-=n;const ad=Math.abs(d);
    const isCur=k===cur,ix=0,iy=.85,iz=0,is=isCur?.95:0,io=isCur?1:0;
    const rx=d*.95,ry=cy+.06*Math.min(1,ad),rz=.25*(1-Math.min(1,ad)),rs=Math.max(0,ad<=1?1.2-.65*ad:.55*(1-(ad-1)/.6)),ro=Math.max(0,ad<=1?1-.5*ad:.5*(1-(ad-1)/.6));
    const x=ix+(rx-ix)*br,y=iy+(ry-iy)*br,z=iz+(rz-iz)*br,s=is+(rs-is)*br,o=(io+(ro-io)*br)*glow*(.92+.08*flick);
    p.position.set(x*cs,(y+.04*Math.sin(t/500+k))*cs+.3*col+(cp&&!col?(Math.random()-.5)*.04*cp:0),z*cs);p.scale.setScalar(Math.max(.001,s*cs));p.rotation.y=t/1600+k;p.visible=o>.02;
    const bad=br>.5&&!frontCanPlay(GAME_IDS[k]),jit=bad?(Math.random()<.15?.45:1):1;
    p.userData.mats.forEach(m=>{m.uniforms.uA.value=o*jit;m.uniforms.uR.value.setHex(bad?HOLO_BAD:HOLO_C)});
    {const no=p.userData.no;if(no){const nv=bad?Math.min(.8,o*1.2)*jit:0;no.material.opacity=nv;no.visible=nv>.02;no.position.y=.25}}   // 못 하는 게임(인원 초과): 빨간 금지 표시
  });
  Hh.lens.material.color.setHex(on?HOLO_C:0x6a4a2a);
}
const _v3=window.THREE?new THREE.Vector3():null,_b3=window.THREE?new THREE.Box3():null;
function frontRect(obj,W,Hh){
  _b3.setFromObject(obj);const box=_b3;let l=1e9,r=-1e9,tp=1e9,b=-1e9;
  for(let i=0;i<8;i++){_v3.set(i&1?box.max.x:box.min.x,i&2?box.max.y:box.min.y,i&4?box.max.z:box.min.z).project(T.cam);
    const x=(_v3.x+1)/2*W,y=(1-_v3.y)/2*Hh;l=Math.min(l,x);r=Math.max(r,x);tp=Math.min(tp,y);b=Math.max(b,y)}
  return {l,r,t:tp,b};
}
function frontPut(b,on,rect,pad,minW=56,minH=48){
  if(!on||!rect){if(!b.classList.contains('off'))b.classList.add('off');return}
  const cx=(rect.l+rect.r)/2,cy=(rect.t+rect.b)/2,w=Math.max(minW,rect.r-rect.l+pad*2),h=Math.max(minH,rect.b-rect.t+pad*2);
  const L=Math.round(cx-w/2),Tp=Math.round(cy-h/2),Wd=Math.round(w),Ht=Math.round(h),o=b._r||[];
  b.classList.remove('off');
  if(o.length!==4||Math.abs(o[0]-L)>3||Math.abs(o[1]-Tp)>3||Math.abs(o[2]-Wd)>3||Math.abs(o[3]-Ht)>3){b._r=[L,Tp,Wd,Ht];b.style.left=L+'px';b.style.top=Tp+'px';b.style.width=Wd+'px';b.style.height=Ht+'px'}   // 3px 넘게 움직일 때만 (둥실거려도 누르기 쉽게)
}
function boardPt(fx,fy,W,Hh){const B=T.board;_v3.set(B.sw*(fx/640-.5),B.sh*(.5-fy/208),0);B.screen.localToWorld(_v3);_v3.project(T.cam);const x=(_v3.x+1)/2*W,y=(1-_v3.y)/2*Hh;return {l:x-4,r:x+4,t:y-4,b:y+4}}
function frontLayout(lobby,wait,host,t){
  const el=$('#front'),vis=lobby||!!FR.warp||wait;
  if(el.hidden===vis)el.hidden=!vis;
  if(!vis)return;
  const st=$('#stage'),W=st.clientWidth,Hh=st.clientHeight,k=FR.stand*FR.stand*(3-2*FR.stand),showTitle=lobby&&!FR.warp&&FR.stand>.01;
  const tt=$('#frTitle');tt.hidden=!showTitle;
  if(showTitle){_v3.set(0,0,-4.9).project(T.cam);const far=(1-_v3.y)/2*Hh;tt.style.top=Math.max(64,Math.min(far*.46,Hh*.3))+'px';tt.style.opacity=k;tt.style.marginTop=(-(1-k)*60)+'px'}
  const standing=lobby&&!FR.sit&&FR.stand>.98&&!FR.warp&&!net.peer;   // 첫 화면: 탁자만
  const front=lobby&&FR.sit&&FR.stand<.05&&!FR.warp&&!FR.spread&&!net.peer;   // 앉아서 상차리기·찾아가기를 고름
  el.classList.toggle('leaving',!(standing||front));$('#frFoot').hidden=!lobby;
  frontPut($('#frTable'),standing,standing?frontRect(T.felt.mat,W,Hh):null,10);
  const seated=wait&&FR.stand<.05&&!FR.browse&&!FR.rb.on&&FR.rba.v<=.01;
  const leaned=front&&FR.lean>.9,kpUp=T.keypad&&T.keypad.g.position.y>.02;
  // 숙이기 전: 디스플레이와 키판을 한 덩어리로 누르면 숙여서 봄
  for(const P of [T.hostPad,T.guestPad,T.sitPad]){const on=seated&&P.g.position.y>.025;P.keys.forEach((m,i)=>frontPut($('#'+P.id+i),on,on?frontRect(m,W,Hh):null,2,44,44))}
  const mUp=front&&T.menuPad.g.position.y>.025&&FR.open>.98&&FR.kmode==='menu';
  T.menuPad.keys.forEach((m,i)=>frontPut($('#frM'+i),mUp,mUp?frontRect(m,W,Hh):null,4,60,48));
  let kr=null;if(front&&FR.lean<.1&&kpUp&&FR.open>.98&&FR.kmode==='num'){const a1=frontRect(T.keypad.g,W,Hh),a2=frontRect(T.board.screen,W,Hh);kr={l:Math.min(a1.l,a2.l),r:Math.max(a1.r,a2.r),t:Math.min(a1.t,a2.t),b:Math.max(a1.b,a2.b)}}
  frontPut($('#frKeys'),!!kr,kr,8,72,56);
  const kOn=leaned&&kpUp&&FR.kmode==='num';
  T.keypad.keys.forEach((m,i)=>frontPut($('#frK'+i),kOn,kOn?frontRect(m,W,Hh):null,1,30,30));
  const lUp=leaned&&FR.list&&FR.pla.v>=.98,lr=lUp?frontListRooms():[];
  T.plist.rows.forEach((m,i)=>{const r=lr[(FR.lpage||0)*FR_ROWS+i],b=$('#frR'+i);frontPut(b,lUp&&!!r,lUp&&r?frontRect(m,W,Hh):null,0,40,30);if(r&&b.dataset.c!==r.code){b.dataset.c=r.code;b.setAttribute('aria-label',`${r.title} · ${gameOf(r.g).name} · ${r.n}/${r.max}`)}});
  T.plist.lbtn.forEach(B=>frontPut($('#frL'+B.k),lUp&&(B.k==='ref'||B.k==='x'||frontListRooms().length>FR_ROWS),lUp?frontRect(B.m,W,Hh):null,8,48,48));
  const dOn=((front&&FR.lean>.9&&!FR.list&&FR.pla.v<=0&&FR.kmode==='num')||seated)&&FR.open>.98;
  frontPut($('#frBoard'),dOn,dOn?frontRect(T.board.screen,W,Hh):null,6);
  // 눈(위)·자물쇠(아래): 디스플레이 오른쪽 끝 칸
  const side=seated&&FR.open>.98&&!!FR.eye;
  frontPut($('#frEye'),side,side?boardPt(600,56,W,Hh):null,0,40,38);
  frontPut($('#frLock'),side&&host,side&&host?boardPt(600,150,W,Hh):null,0,40,38);
  // 떠 있는 게임 말을 누르면 게임 고르기 (투사기 몸통은 누르는 자리가 아님)
  const hOk=seated&&host&&(FR.holoGlow||0)>.5;let hr=null;
  if(hOk){const cur=Math.max(0,GAME_IDS.indexOf(V.cfg.game||'gura'));hr=frontRect(T.holo.pieces[cur],W,Hh)}
  frontPut($('#frHolo'),hOk,hr,14,72,64);
  frontPut($('#frStart'),seated&&host&&T.startBtn.g.position.y>-.22,seated&&host?frontRect(T.startBtn.g,W,Hh):null,10,60,56);
  // 고르는 중: 가운데 말을 누르면 확정, 양옆 말을 누르거나 밀면 넘김
  const pick=FR.browse&&host;
  let pr=null;if(pick){const n=GAME_IDS.length,p=T.holo.pieces[((FR.hpos%n)+n)%n];pr=frontRect(p,W,Hh)}
  frontPut($('#frPick'),pick,pr,18,72,72);
  for(const [id,dd] of [['#frPrev',-1],['#frNext',1]]){let r2=null;if(pick){const n=GAME_IDS.length,p=T.holo.pieces[(((FR.hpos+dd)%n)+n)%n];r2=frontRect(p,W,Hh)}frontPut($(id),pick,r2,14,56,56)}
  // 규칙 나무판: 판자(밀기·휠·목록 줄 고르기), ✕, 레버
  const rbUp=FR.rb.on&&FR.rba.v>=.98&&FR.lean>.9;
  frontPut($('#frRbX'),rbUp,rbUp?frontRect(T.rb.xk,W,Hh):null,10,48,48);
  frontPut($('#frRbWin'),rbUp,rbUp?frontRect(T.rb.win,W,Hh):null,0,40,40);
  frontPut($('#frRbBack'),rbUp&&FR.rb.mode==='game'&&!!FR.rb.fromList,rbUp?frontRect(T.rb.bk,W,Hh):null,10,48,48);
  for(let k=0;k<RB_PG;k++){const b=T.rb.pgs[k],el=$('#frRbPg'+k),on=rbUp&&b.m.visible&&!FR.rb.chg;frontPut(el,on,on?frontRect(b.m,W,Hh):null,6,40,40);if(on&&el.dataset.l!==b.lab){el.dataset.l=b.lab;const L2=b.lab==='🎲'?'게임 설정':b.lab[0]==='⚙'?'탁자 설정':'규칙 '+b.lab+'쪽';el.setAttribute('aria-label',L2);el.title=L2}}
  {const tOn=rbUp&&FR.rb.mode==='game'&&FR.rb.pg===rbNSet()&&!FR.rb.chg,el=$('#frRbTitle');   // 첫 규칙 판자 맨 위 게임 이름 → 게임 고르기
   if(tOn){const [l,t2]=rbScreen(RB.CW*.12,50,W,Hh),[r,b]=rbScreen(RB.CW*.88,190,W,Hh);frontPut(el,true,{l,t:t2,r,b},0,60,40)}else frontPut(el,false,null,0)}
  rbLayoutSet(rbUp&&FR.rb.mode==='game'&&!!FR.rb.set&&FR.rb.pg<rbNSet()&&!FR.rb.chg,W,Hh);if(!rbUp)rbTag(null);
  st.classList.toggle('rbopen',FR.rba.v>.01);
  $('#frPad').classList.toggle('off',!pick&&!leaned&&!rbUp);
  // 홀로그램 글씨: 위에서부터 탁자 이름, 게임 이름, 게임 모드 (그 아래가 게임 말). 모드는 지금 고른 게임만(넘겨 보는 중이면 자리만)
  const ht=$('#holoTag'),hOn=wait&&(FR.holoGlow||0)>.05&&!roomSetOpen&&FR.rba.v<=.01;
  if(ht.hidden===hOn)ht.hidden=!hOn;
  if(hOn){
    _v3.set(0,(FR.holoTop||1.2)+.14,0).project(T.cam);const x=(_v3.x+1)/2*W,y=(1-_v3.y)/2*Hh;
    const gid=FR.browse?frontHoloId():(V.cfg.game||'gura'),bad=FR.browse&&!frontCanPlay(gid);
    const tn=V.title||'',gn=gameOf(gid).name,mn=FR.browse?'':modeLabelOf(gameOf(gid),V.cfg);
    {const me=$('#holoMode');if(me.textContent!==mn){const was=me.dataset.g;me.textContent=mn;me.dataset.g=gid+'|'+(FR.browse?1:0);if(mn&&was===me.dataset.g){me.classList.remove('chg');void me.offsetWidth;me.classList.add('chg')}}}   // 같은 게임에서 모드만 바뀌면 지직
    if(ht.dataset.k!==tn+'|'+gn+'|'+bad+'|'+host){ht.dataset.k=tn+'|'+gn+'|'+bad+'|'+host;if(!$('#holoTitleIn'))$('#holoTitle').textContent=tn;$('#holoGame').textContent=gn;ht.classList.toggle('bad',bad);$('#holoTitle').classList.toggle('editable',host);$('#holoGame').classList.toggle('pickable',host)}
    ht.style.left=Math.round(x)+'px';ht.style.top=Math.round(y-ht.offsetHeight)+'px';ht.style.opacity=Math.min(1,FR.holoGlow*1.2)*(FR.collapseAt?0:1);
  }
  {const hc=$('#holoCnt'),on=hOn&&!FR.browse;if(hc.hidden===on)hc.hidden=!on;   // 게임 말 아래 인원 (고르는 중에는 숨김)
    if(on){const n=(V.ps||[]).length,mx=Math.max(+V.cfg.max||0,n),tx=`${n}/${mx}명`;if(hc.textContent!==tx)hc.textContent=tx;
      _v3.set(0,.36,0);T.holo.g.localToWorld(_v3);_v3.project(T.cam);hc.style.left=Math.round((_v3.x+1)/2*W)+'px';hc.style.top=Math.round((1-_v3.y)/2*Hh)+'px';hc.style.opacity=Math.min(1,FR.holoGlow*1.2)*(FR.collapseAt?0:1)}}
}
/* 꺼진 시작 버튼을 누름: 금지 소리 + 빈 자리 이름표가 통통 튀며 "사람이 더 필요함"을 보여 줌 */
function frontNeedSeats(){
  sfx('no');document.querySelectorAll('#labels .wseat.empty').forEach(el=>{el.classList.remove('need');void el.offsetWidth;el.classList.add('need')});
}
function frontNick(){$('#frNickV').textContent=myNick()}
/* 첫 화면 닉네임: 이름표를 누르면 입력칸으로 바뀌고, Enter·바깥 누르기로 저장, Esc로 취소 */
{
  const b=$('#frNick'),inp=$('#frNickIn');
  const done=ok=>{
    if(inp.hidden)return;
    if(ok){const v=inp.value.trim().slice(0,10)||'나';$('#inNick').value=v;saveNick();const s=$('#nickShow');if(s)s.textContent=v;document.querySelectorAll('.nickShow2').forEach(e=>e.textContent=v)}
    inp.hidden=true;b.hidden=false;frontNick();
  };
  b.addEventListener('click',()=>{
    if(mode!=='lobby')return;
    inp.value=myNick();b.hidden=true;inp.hidden=false;inp.focus();inp.select();sfx('tick');
  });
  inp.addEventListener('keydown',e=>{
    e.stopPropagation();
    if(e.key==='Enter'){e.preventDefault();done(true)}
    else if(e.key==='Escape'){e.preventDefault();done(false)}
  });
  inp.addEventListener('blur',()=>done(true));
}
$('#frTable').addEventListener('click',()=>{if(mode!=='lobby'||FR.warp||net.peer)return;FR.sit=true;sfx('tick')});
/* 탁자 이름: 홀로그램 맨 위. 방장이 누르면 바로 고침 */
$('#holoTitle').addEventListener('click',()=>{
  if(mode!=='host'||!H||H.phase!=='wait'||$('#holoTitleIn'))return;
  const b=$('#holoTitle'),inp=document.createElement('input');inp.id='holoTitleIn';inp.maxLength=20;inp.value=H.title||'';inp.setAttribute('aria-label','탁자 이름');
  b.textContent='';b.appendChild(inp);inp.focus();inp.select();
  const done=ok=>{if(!inp.isConnected)return;const v=inp.value.trim().slice(0,20);inp.remove();if(ok&&v&&mode==='host'&&H){H.title=v;sfx('pick');mark()}$('#holoTag').dataset.k='';b.textContent=(V&&V.title)||''};
  inp.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter'){e.preventDefault();done(true)}else if(e.key==='Escape'){e.preventDefault();done(false)}});
  inp.addEventListener('blur',()=>done(true));
});
$('#frKeys').addEventListener('click',()=>{if(mode!=='lobby'||FR.warp||FR.spread)return;FR.leanOn=true;FR.keyAt=clock();sfx('tick')});
$('#frBoard').addEventListener('click',()=>{
  if(mode==='lobby'){if(FR.warp||FR.spread)return;FR.word='';if(frontGo())return;sfx('tick');frontList(true);return}   // 넣은 번호가 있으면 찾아가고, 없으면 공개 탁자 목록 판
  if(frWaitV()&&V.code){   // 대기실: 초대 링크 복사
    const link=roomLink(String(V.code));
    const ok=()=>{frontWord('복사',1400);sfx('pick')};
    if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(link).then(ok,()=>sfx('no'));else sfx('no');
  }
});
$('#frEye').addEventListener('click',()=>{hideCode=!hideCode;store('gura-hidecode',hideCode?'1':'0');lastPanelHtml='';sfx('tick');render()});   // 번호 가리기 (내 화면에서만)
$('#frLock').addEventListener('click',()=>{if(mode==='host'&&H&&H.online&&H.phase==='wait'){H.cfg={...H.cfg,pub:H.cfg.pub?0:1};sfx('lock');mark()}else sfx('no')});
$('#frHolo').addEventListener('click',()=>{if(mode!=='host'){sfx('no');return}frontBrowse(!FR.browse)});
$('#holoGame').addEventListener('click',()=>{if(mode!=='host'||!frWaitV()||FR.browse)return;frontBrowse(true)});   // 게임 이름을 눌러도 게임 고르기
{ // 시작 버튼: 0.5초 누르고 있으면 시작 (일찍 떼면 취소). 키보드 Enter·Space는 바로 시작
  const b=$('#frStart');
  b.addEventListener('pointerdown',e=>{if(mode!=='host')return;if(!canStart()){frontNeedSeats();return}FR.holdAt=clock();sfx('key');try{b.setPointerCapture(e.pointerId)}catch(_){}});
  const stop=()=>{FR.holdAt=0};b.addEventListener('pointerup',stop);b.addEventListener('pointercancel',stop);b.addEventListener('lostpointercapture',stop);
  b.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&mode==='host'&&H&&H.phase==='wait'){e.preventDefault();if(canStart()){sfx('btnGo');hostStart()}else frontNeedSeats()}});
}
$('#frPick').addEventListener('click',()=>frontHoloPick());
$('#frPrev').addEventListener('click',()=>frontHoloStep(-1));$('#frNext').addEventListener('click',()=>frontHoloStep(1));
{ // 홀로그램 넘기기: 밀면 말이 손을 따라 돌다가 놓으면 가까운 게임에 멈춤(빠르게 튕기면 하나 넘김), 왼쪽·오른쪽을 눌러도 넘김. 위쪽 빈 곳을 누르면 닫음
  // 미는 것은 가운데 말(#frPick)·양옆 말 위에서 시작해도 되게 #front에서 먼저 받음. 밀었으면 그 누름은 클릭으로 치지 않음
  const pad=$('#frPad'),fr=$('#front');let sx=null,sy=0,bx=null,by=0,drag=null,dragAt=0;
  const stepPx=()=>{const a=$('#frPick').getBoundingClientRect(),b=$('#frNext').getBoundingClientRect(),d=Math.abs((b.left+b.width/2)-(a.left+a.width/2));return d>40?d:140};   // 이웃한 말 사이 화면 거리
  const dragEnd=e=>{const d=drag;drag=null;bx=null;if(!d)return false;dragAt=clock();if(FR.hdrag==null)return true;
    const dx=e?e.clientX-d.x0:0,v=FR.hdrag,fast=Math.abs(dx)>36&&clock()-d.t0<300;
    let to=Math.round(v);if(fast&&to===d.from)to=d.from+(dx<0?1:-1);   // 짧고 빠르게 밀면 하나 넘김
    FR.hdrag=null;FR.hra={v,from:v,to:v,t0:0,ms:0};if(to!==FR.hpos)sfx('holoTick');FR.hpos=to;return true};   // 놓은 자리에서 가까운 게임으로 미끄러짐
  fr.addEventListener('pointerdown',e=>{bx=FR.browse?e.clientX:null;by=e.clientY;drag=null},true);
  fr.addEventListener('pointermove',e=>{
    if(bx==null||!FR.browse)return;const dx=e.clientX-bx,dy=e.clientY-by;
    if(!drag){if(Math.abs(dx)<10||Math.abs(dx)<Math.abs(dy))return;drag={base:FR.hra.v,from:FR.hpos,px:stepPx(),t0:clock(),x0:bx};try{fr.setPointerCapture(e.pointerId)}catch(_){}}
    FR.hdrag=drag.base-dx/drag.px;const r=Math.round(FR.hdrag);if(r!==FR.hpos){FR.hpos=r;sfx('holoTick')}   // 가운데 게임 이름·금지 표시도 따라 바뀜
  },true);
  const up=e=>{if(dragEnd(e.type==='pointercancel'?null:e)){sx=null;e.stopPropagation()}bx=null};
  fr.addEventListener('pointerup',up,true);fr.addEventListener('pointercancel',up,true);
  fr.addEventListener('click',e=>{if(clock()-dragAt<350){e.stopPropagation();e.preventDefault()}},true);
  pad.addEventListener('pointerdown',e=>{sx=e.clientX;sy=e.clientY});
  pad.addEventListener('pointerup',e=>{
    if(sx==null)return;const dx=e.clientX-sx,dy=e.clientY-sy;sx=null;
    if(!FR.browse){if(FR.rb.on)return;if(FR.list){if(Math.abs(dy)>36&&Math.abs(dy)>Math.abs(dx)){frontListPage(dy<0?-1:1);return}frontList(false);return}if(FR.leanOn){FR.leanOn=false;sfx('tick')}return}   // 숙여 보던 중 빈 곳을 누르면: 목록 판이면 키판으로, 아니면 다시 섬
    const r=pad.getBoundingClientRect(),x=(e.clientX-r.left)/r.width;
    if(frontOutside(e.clientX,e.clientY)){if(frontCanPlay(frontHoloId()))frontHoloPick();else frontBrowse(false);return}   // 탁자 밖 = 가운데 게임으로 정하고 닫음
    frontHoloStep(x<.5?-1:1);
  });
  // 마우스 휠(터치패드 두 손가락 밀기도): 한 칸에 한 게임. 터치패드처럼 잘게 오는 값은 모아서, 너무 빨리 여러 개 넘어가지 않게
  let wAcc=0,wAt=0,wStep=0;
  document.addEventListener('wheel',e=>{
    if(!FR.browse||mode!=='host'||drag)return;e.preventDefault();
    const t=clock(),d=(Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY)*(e.deltaMode===1?33:e.deltaMode===2?400:1);
    if(t-wAt>250||Math.sign(d)!==Math.sign(wAcc))wAcc=0;wAt=t;wAcc+=d;
    if(Math.abs(wAcc)>=50&&t-wStep>140){frontHoloStep(wAcc>0?1:-1);wAcc=0;wStep=t}
  },{passive:false});
}
document.addEventListener('keydown',e=>{   // 규칙 나무판: ↑↓ 판자 밀기, ←→ 판자 넘기기, Esc 뒤로
  if(!FR.rb.on||e.target.matches('input')||!$('#rulesOv').hidden||!$('#menu').hidden)return;
  const k=e.key;let done=true;
  if(k==='ArrowDown'||k==='PageDown')frontRulesScroll(k==='PageDown'?1:.3,false);
  else if(k==='ArrowUp'||k==='PageUp')frontRulesScroll(k==='PageUp'?-1:-.3,false);
  else if(k==='ArrowRight')frontRulesPage(1);else if(k==='ArrowLeft')frontRulesPage(-1);
  else if(k==='Escape'||k==='Backspace')frontRulesBack();
  else done=false;
  if(done){e.preventDefault();e.stopImmediatePropagation()}
},true);
document.addEventListener('keydown',e=>{
  if(!FR.browse||e.target.matches('input'))return;
  if(e.key==='ArrowLeft'){e.preventDefault();e.stopImmediatePropagation();frontHoloStep(-1)}
  else if(e.key==='ArrowRight'){e.preventDefault();e.stopImmediatePropagation();frontHoloStep(1)}
  else if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopImmediatePropagation();frontHoloPick()}
  else if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();frontBrowse(false)}
},true);
document.addEventListener('keydown',e=>{
  if(!FR.ok||mode!=='lobby'||lobbyView!=='main'||e.target.matches('input')||e.ctrlKey||e.metaKey||e.altKey||!$('#keysOv').hidden||!$('#rulesOv').hidden||!$('#menu').hidden)return;
  if(/^[0-9a-zA-Z]$/.test(e.key)){e.preventDefault();frontKey(e.key);return}
  if(e.key==='Backspace'){e.preventDefault();frontKey('←');return}
  if(e.key==='Enter'&&(FR.buf||FR.pub)){e.preventDefault();frontGo();return}
  if(FR.list&&/^Arrow(Left|Right|Up|Down)$/.test(e.key)){e.preventDefault();frontListPage(e.key==='ArrowRight'||e.key==='ArrowDown'?1:-1);return}
  if(e.key==='Escape'&&FR.list){e.preventDefault();frontList(false);return}
  if(e.key==='Escape'&&(FR.leanOn||FR.buf||FR.pub)){e.preventDefault();FR.leanOn=false;FR.buf='';FR.pub=null;return}
  if(e.key==='Escape'&&FR.sit&&!FR.warp&&!net.peer){e.preventDefault();FR.sit=false;return}   // 일어섬
  if(e.key==='Enter'&&!FR.sit&&!FR.warp&&!net.peer&&document.activeElement===document.body){e.preventDefault();FR.sit=true}
});
document.addEventListener('keydown',e=>{   // 대기실: Esc로 자리 메뉴 닫기
  if(e.key!=='Escape'||!frTableUI()||e.target.matches('input'))return;
  if(FR.pop!=null){e.preventDefault();seatPopClose()}
});
/* 탁자 밖(풀밭·하늘)을 누르면 의자를 빼듯 살짝 일어나고 디스플레이에 '떠나기' → 2.5초 안에 한 번 더 누르면 떠남. 탁자를 누르거나 기다리면 다시 앉음 (대기실만) */
const _ray=window.THREE?new THREE.Raycaster():null,_gp=window.THREE?new THREE.Plane(new THREE.Vector3(0,1,0),0):null;
function frontOutside(cx,cy){
  const r=$('#cv').getBoundingClientRect(),nx=(cx-r.left)/r.width*2-1,ny=-((cy-r.top)/r.height*2-1);
  _ray.setFromCamera({x:nx,y:ny},T.cam);const hit=_ray.ray.intersectPlane(_gp,_v3);
  return !hit||Math.hypot(hit.x,hit.z)>4.95;
}
$('#cv').addEventListener('click',e=>{
  if(clock()-(VW.movedAt||-1e9)<400)return;   // 고개를 돌리려고 끈 것은 누르기가 아님
  const lob=mode==='lobby'&&FR.ok&&FR.sit&&FR.stand<.05&&!FR.warp&&!FR.spread&&!net.peer&&FR.lean<.1&&lobbyView==='main';   // 앉아 있는 첫 화면: 두 번 누르면 일어섬
  if(!lob&&(!frTableUI()||FR.stand>.05||FR.browse||roomSetOpen||FR.pop!=null))return;
  const out=frontOutside(e.clientX,e.clientY),t=clock(),armed=FR.armAt&&t-FR.armAt<2500;
  if(!out){if(armed){FR.armAt=0;FR.word='';sfx('tick')}return}
  if(armed){FR.armAt=0;FR.word='';if(lob){FR.sit=false;sfx('tick')}else leaveRoom();return}
  FR.armAt=t;frontWord(lob?'일어서기':'떠나기',2500);sfx('tick');
});

/* 고개 돌리기 입력: 탁자 바깥(위쪽 배경·탁자 가장자리 바깥)에서 시작한 한 손가락(마우스는 왼쪽 버튼) 드래그. 탁자 위는 게임이 쓰므로 건드리지 않음.
   놓으면 1초 뒤 천천히 정중앙으로 돌아옴 (viewStep). 끌고 난 뒤 생기는 click은 탁자 밖 누르기(떠나기)로 치지 않음(VW.movedAt) */
{
  // three.js를 못 불러온 기기(2D 화면)에서도 아래 설정(카메라 감도)은 붙어야 하므로 THREE가 없으면 고개 돌리기만 끔
  const st=$('#stage'),H3=!!window.THREE,rc=H3?new THREE.Raycaster():null,pl=H3?new THREE.Plane(new THREE.Vector3(0,1,0),0):null,pt=H3?new THREE.Vector3():null;
  const outside=e=>{if(!rc||!T.cam)return false;const r=st.getBoundingClientRect();rc.setFromCamera({x:(e.clientX-r.left)/r.width*2-1,y:-(e.clientY-r.top)/r.height*2+1},T.cam);return !rc.ray.intersectPlane(pl,pt)||Math.hypot(pt.x,pt.z)>4.94}   // 탁자 바깥을 눌렀는지
  const move=dx=>{VW.ty=Math.max(-VW.max,Math.min(VW.max,VW.ty+dx*.005*VW.sens/100))};   // 오른쪽으로 끌면 장면이 따라 오른쪽으로 → 고개는 왼쪽
  st.addEventListener('pointerdown',e=>{
    if(!FR.camOk||(e.pointerType==='mouse'&&e.button!==0)||(e.target.id!=='cv'&&e.target!==st)||!outside(e))return;
    VW.drag={id:e.pointerId,x:e.clientX,sx:e.clientX};VW.at=clock();   // 붙잡기(capture)는 실제로 끌 때부터: 그냥 누르면 click이 #cv로 가야 함(대기실 떠나기)
  },true);
  st.addEventListener('pointermove',e=>{const d=VW.drag;if(!d||e.pointerId!==d.id)return;move(e.clientX-d.x);d.x=e.clientX;VW.at=clock();if(Math.abs(e.clientX-d.sx)>6){VW.movedAt=VW.at;if(!d.cap){d.cap=1;try{st.setPointerCapture(e.pointerId)}catch(_){}}}},true);
  const up=e=>{if(VW.drag&&VW.drag.id===e.pointerId){VW.drag=null;VW.at=clock()}};
  st.addEventListener('pointerup',up,true);st.addEventListener('pointercancel',up,true);
  const camS=()=>{for(const id of ['#mCamS','#inCamS'])$(id).value=VW.sens;$('#mCamSV').textContent=$('#camSV').textContent=VW.sens+'%'};   // 설정 → 카메라 감도 (드래그 거리당 도는 양, gura-cam-sens)
  for(const id of ['#mCamS','#inCamS'])$(id).addEventListener('input',e=>{VW.sens=+e.target.value;store('gura-cam-sens',String(VW.sens));camS()});
  camS();
}
