/* index.html 공통 코드 · 영수증 프린터(진행 기록). 파일 순서는 index.html의 <script src> 순서 */
/* ===== 영수증 프린터 (진행 기록) =====
   게임 중 탁자에 일자 틈이 열리고, 기록이 생길 때마다 '지직' 하며 한 줄씩 찍혀 화면 위쪽(맞은편)으로 밀려 나감.
   최신 줄은 늘 틈 바로 옆. 처음엔 보통 영수증처럼 나오다가 RC_MAX줄이 넘으면 위쪽에 들어가는 틈이 열려 오래된 줄을 삼킴.
   누르거나 위로 끌면 들어가는 틈에서 종이가 뽑혀 나와 눈앞으로 날아오고 2D 영수증(전체 기록)으로 펼쳐짐. 게임이 끝나면 2D 맨 아래 '가져가기'(복사) */
const RC={LH:.15,PW:.82,MAX:5,SEG:48,RPX:48,CW:420};   // 줄 높이, 종이 폭, 들어가는 틈까지 보이는 줄 수(머리글 포함), 띠 마디, 캔버스 줄 높이·폭
/* 종이 모양 (모든 게임 같음): 감열지는 빳빳해서 꺾이지 않음. 틈에서 90도로 서서 나와 같은 굽기(반지름 RC_R)로 둥글게 뒤로 넘어감.
   RC.MAX줄이 나오면 반원이 되어 끝이 탁자에 닿는 자리 = 들어가는 틈(RC_XIN). 그 뒤 줄은 들어가는 틈으로 내려가 탁자 속으로 (틈 아래는 탁자 윗면에 가려 안 보임) */
const RC_R=RC.MAX*RC.LH/Math.PI,RC_XIN=2*RC_R;
function rcCurve(al){   // 종이 길이 al(틈에서부터) → [앞으로 간 거리, 높이]
  if(al<=0)return [0,al];   // 아직 틈 속
  const th=al/RC_R;
  if(th<=Math.PI)return [RC_R*(1-Math.cos(th)),RC_R*Math.sin(th)];
  return [RC_XIN,-(al-Math.PI*RC_R)];   // 들어가는 틈으로 내려감
}
/* 틈 자리 후보: 내 쪽(화면 아래)을 0도로 탁자 둘레 나무 띠 위 각도. 카메라가 멈춘 뒤 화면 안에 다 보이고 2D 화면(손패·버튼·점수 종이)에 안 가리는 첫 자리를 탁자 좌표로 정해 고정 */
const RC_CAND={_:{a:[50,-50,90,-90,128,-128,150,-150,180],r:[4.3,3.7,3.1,2.5]},   // a: 각도 순서, r: 반지름 순서 (세로 휴대폰은 둘레가 화면 밖이라 안쪽까지)
  quoridor:{a:[50,-50,90,-90,145,-145,128,-128,180,165,-165],r:[4.3,3.9,3.5]},   // 판·벽 보관함 위에는 놓지 않음
  omok:{a:[90,-128,-90,128,145,-145,50,-50],r:[4.3,3.8,3.3]},
  yahtzee:{a:[-50,-90,50,90,-128,128],r:[4.3,3.7,3.1,2.5]},
  alkkagi:{a:[90,-90,128,-128,150,-150,50,-50,180],r:[4.3,3.9,3.6]}};   // 판(모서리 반지름 3.25)과 떨어진 알 자리는 피함
function rcptBuild(TG){
  const cv=document.createElement('canvas');cv.width=RC.CW;cv.height=RC.RPX*(RC.MAX+1);
  const tex=new THREE.CanvasTexture(cv);tex.anisotropy=8;
  const N=RC.SEG+1,pos=new Float32Array(N*2*3),uv=new Float32Array(N*2*2),idx=[];
  for(let i=0;i<N;i++){for(let j=0;j<2;j++){const k=i*2+j;uv[k*2]=j;uv[k*2+1]=i/RC.SEG}if(i<RC.SEG){const a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2)}}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.BufferAttribute(uv,2));geo.setIndex(idx);
  const mat=toon({map:tex,rim:.12});mat.side=THREE.DoubleSide;   // 툰 셰이딩: 휜 곳에 명암
  const paper=new THREE.Mesh(geo,mat);paper.frustumCulled=false;paper.castShadow=true;paper.receiveShadow=true;TG.add(paper);paper.visible=false;
  const igeo=new THREE.BufferGeometry();igeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(N*2*3),3));igeo.setIndex(idx);
  const ink=new THREE.Mesh(igeo,new THREE.MeshBasicMaterial({color:GFX_INK,side:THREE.DoubleSide}));ink.frustumCulled=false;ink.visible=false;TG.add(ink);   // 외곽선: 조금 넓은 띠를 종이 뒤에 (다른 물건의 검은 테두리와 같게)
  const slot=w=>{   // 틈: 놋쇠 테두리가 살짝 솟고 안쪽이 파임
    const g=new THREE.Group(),brass=toon({color:0xb8925a,rim:.3}),W=w+.1,Dp=.09,b=.022,h=.016;
    for(const [x,z,sx,sz] of [[0,-(Dp-b)/2,W,b],[0,(Dp-b)/2,W,b],[-(W-b)/2,0,b,Dp],[(W-b)/2,0,b,Dp]]){const m=new THREE.Mesh(new THREE.BoxGeometry(sx,h,sz),brass);m.position.set(x,h/2,z);m.castShadow=true;g.add(m)}
    const hole=new THREE.Mesh(new THREE.BoxGeometry(W-2*b,.006,Dp-2*b),new THREE.MeshBasicMaterial({color:0x0d0806}));hole.position.y=.002;g.add(hole);
    g.visible=false;TG.add(g);return g};
  if(!T.r._rcWrap){const r0=T.r.render.bind(T.r);T.r.render=(sc,cam)=>{if(sc===T.scene)T.lastCam=cam;r0(sc,cam)};T.r._rcWrap=1}   // 마지막으로 공통 장면을 그린 카메라 (쿼리도·오목·야추는 자기 카메라). 따로 그리는 장면(알까기 3D 손의 윤곽선 합치기 등)의 카메라는 빼야 영수증 자리가 흔들리지 않음
  T.rc={cv,tex,geo,mat,paper,ink,out:slot(RC.PW),inn:slot(RC.PW),rows:[],seen:0,waitTop:0,feedAt:-1e9,oa:{v:0,to:0,from:0,t0:0,ms:0},ia:{v:0,to:0,from:0,t0:0,ms:0},open:false,spot:null,camKey:'',camAt:0,sizeKey:''};
  rcptHot();
}
function rcptText(){const R=T.rc;return R.rows.map(r=>r[0]).join('\n')}
function rcptDraw(){   // 캔버스: 아래가 최신 줄. 평평하게 보일 줄 + 들어가는 줄 하나
  const R=T.rc,c=R.cv.getContext('2d'),n=RC.MAX+1,rows=R.rows.slice(-n),W=RC.CW,Hc=R.cv.height;
  c.fillStyle='#fbfaf4';c.fillRect(0,0,W,Hc);
  rows.forEach((r,k)=>{const y=Hc-(rows.length-k)*RC.RPX;
    if(r[1]==='head'){c.fillStyle='#2c2620';c.font='700 24px ui-monospace,monospace';c.textAlign='center';c.fillText(r[0],W/2,y+RC.RPX*.62);c.strokeStyle='rgba(44,38,32,.5)';c.setLineDash([8,6]);c.lineWidth=2;c.beginPath();c.moveTo(14,y+RC.RPX-4);c.lineTo(W-14,y+RC.RPX-4);c.stroke();c.setLineDash([]);return}
    c.fillStyle=r[1]==='sys'?'rgba(44,38,32,.55)':'#2c2620';c.font=`${r[1]==='gura'||r[1]==='fin'?800:500} 22px ui-monospace,monospace`;c.textAlign='left';
    let tx=r[0];while(c.measureText(tx).width>W-28&&tx.length>2)tx=tx.slice(0,-2)+'…';c.fillText(tx,14,y+RC.RPX*.64)});
  R.tex.needsUpdate=true;
}
function rcptSync(){   // 기록이 새로 생기면 줄을 더하고 찍음. 새 게임이 시작되면 영수증을 새로
  const R=T.rc,lg=V&&Array.isArray(V.lg)?V.lg:[],top=lg.length?Math.max(...lg.map(l=>+l[2]||0)):0,live=V&&V.st&&V.st!=='wait';
  if(!live){R.waitTop=top;if(R.rows.length){R.rows=[];R.seen=top}return}
  if(!R.rows.length){R.rows=[[`탁자 ${shownCode(V.code)} · ${gameOf((V.cfg&&V.cfg.game)||'gura').name}`,'head']];R.seen=Math.min(R.seen||0,R.waitTop||0);if(top<R.seen)R.seen=0;rcptDraw()}
  const fresh=lg.filter(l=>(+l[2]||0)>R.seen).sort((a,b)=>(+a[2])-(+b[2]));
  if(!fresh.length)return;
  R.seen=Math.max(R.seen,top);
  for(const l of fresh)R.rows.push([String(l[0]),l[1]||'']);
  R.feedAt=clock();rcptDraw();if(R.open)rcptFill();
  if(R.oa.v>.9)sfx('rcPrint',fresh.length);
}
function rcptUpdate(t){
  const R=T.rc;if(!R)return;
  const on=!!(T.ok&&V&&V.code&&V.st&&V.st!=='wait'&&(mode==='host'||mode==='guest'))&&!(G.no3D&&!G.render3D)&&!/\b(qd2d|om2d)\b/.test($('#stage').className);
  document.body.classList.toggle('rc3d',!!T.ok);
  if(on)rcptSync();else if(R.rows.length&&!(V&&V.st&&V.st!=='wait')){R.rows=[];if(R.open)rcptClose(true)}
  const cam=T.lastCam||T.cam,st=$('#stage'),W=st.clientWidth,Hh=st.clientHeight;
  // 카메라가 멈췄는지 (시작 연출·화면 크기 변경 중에는 자리를 정하지 않음)
  cam.updateMatrixWorld();const e=cam.matrixWorld.elements,ck=[e[12],e[13],e[14],e[8],e[9],e[10],cam.projectionMatrix.elements[0]].map(v=>v.toFixed(3)).join(',');
  if(ck!==R.camKey){R.camKey=ck;R.camAt=t}
  const still=t-R.camAt>900,sk=W+'x'+Hh+'|'+ck+'|'+((V&&V.cfg&&V.cfg.game)||'');   // 시작 연출 중 잠깐 멈춘 카메라에서 정하지 않게 0.9초
  if(!on){R.spot=null;R.moving=0}
  else if(still&&!R.spot){R.spot=rcPickSpot(cam,W,Hh);R.sizeKey=sk}
  else if(still&&R.spot&&R.sizeKey!==sk&&!R.moving){if(rcSpotOk(R.spot,cam,W,Hh))R.sizeKey=sk;else R.moving=1}   // 카메라·화면이 바뀌어 안 보이게 되면: 틈이 닫혔다가 새 자리에서 다시 열림
  if(R.moving&&R.oa.v<=.01&&still){R.moving=0;R.spot=rcPickSpot(cam,W,Hh);R.sizeKey=sk}
  const S=R.spot,full=R.rows.length>RC.MAX;
  const ov=frontTween(R.oa,on&&S&&!R.moving?1:0,t,on?380:300),iv=frontTween(R.ia,on&&S&&!R.moving&&full?1:0,t,420);
  if(R.ia.to===1&&iv>0&&!R.innSnd){R.innSnd=1;sfx('iris')}if(R.ia.to===0)R.innSnd=0;
  if(!S){R.out.visible=R.inn.visible=R.paper.visible=R.ink.visible=false;$('#rcHot').classList.add('off');return}
  const x0=S.x,z0=S.z,D=S.d,Rr=_rcR.set(-D.z,0,D.x),ry=Math.atan2(-Rr.z,Rr.x),y0=rcY(x0,z0);
  const xi=x0+D.x*RC_XIN,zi=z0+D.z*RC_XIN;
  R.out.visible=ov>.01;R.out.scale.set(Math.max(.001,smooth(ov)),1,1);R.out.position.set(x0,y0-.001,z0);R.out.rotation.y=ry;
  R.inn.visible=iv>.01;R.inn.scale.set(Math.max(.001,smooth(iv)),1,1);R.inn.position.set(xi,rcY(xi,zi)-.001,zi);R.inn.rotation.y=ry;
  const rows=Math.min(R.rows.length,RC.MAX+1),fp=smooth(clamp01((t-R.feedAt)/260)),feed=RC.LH*(1-fp);
  R.paper.visible=R.ink.visible=on&&ov>.6&&rows>0;
  if(!R.paper.visible){$('#rcHot').classList.add('off');return}
  // 종이 띠: 틈에서 90도로 서서 나와 뒤로 휘어 누움. 출력할 때 한 줄만큼 밀려 나옴(feed)
  const LEN=rows*RC.LH,pos=R.geo.attributes.position,N=RC.SEG+1;
  if(R.uvRows!==rows){R.uvRows=rows;const uv=R.geo.attributes.uv;for(let i=0;i<N;i++)for(let j=0;j<2;j++)uv.setY(i*2+j,i/RC.SEG*rows/(RC.MAX+1));uv.needsUpdate=true}   // 그림의 아래쪽 rows줄만 종이에
  const ip=R.ink.geometry.attributes.position,OW=RC.PW+.03,OT=.004;
  for(let i=0;i<N;i++){const al=i/RC.SEG*LEN-feed,[fx,fy]=rcCurve(al),[gx,gy]=rcCurve(al+.004);let tx=gx-fx,ty=gy-fy;const tl=Math.hypot(tx,ty)||1;tx/=tl;ty/=tl;const nx=-ty,ny=tx;   // 종이 면의 법선(바닥이면 위쪽)
    const ex=fx,ey=fy;
    for(let j=0;j<2;j++){const u=j-.5,px=x0+Rr.x*u*RC.PW+D.x*fx,pz=z0+Rr.z*u*RC.PW+D.z*fx;pos.setXYZ(i*2+j,px,y0+.002+fy,pz);
      ip.setXYZ(i*2+j,x0+Rr.x*u*OW+D.x*(ex-nx*OT),y0+.002+ey-ny*OT,z0+Rr.z*u*OW+D.z*(ex-nx*OT))}}
  pos.needsUpdate=true;ip.needsUpdate=true;R.geo.computeVertexNormals();R.geo.computeBoundingBox();R.geo.computeBoundingSphere();
  // 누르는 자리: 종이
  frontPut($('#rcHot'),!R.open&&!roomSetOpen,rcRect(R.paper,cam,W,Hh),6,56,48);
}
/* 자리 고르기: 후보 각도마다 틈·세운 종이·들어가는 틈이 화면 안에 다 들어오고, 그 화면 점이 2D 화면에 가리지 않는지(#cv가 맨 위인지) 봄 */
function rcSpotAt(ang,cam,R0=4.3){
  const d=_rcD.set(0,1,0).applyQuaternion(cam.quaternion);d.y=0;if(d.lengthSq()<1e-4)d.set(0,0,-1);d.normalize();
  const r=new THREE.Vector3(-d.z,0,d.x),a=ang*Math.PI/180,toMe=d.clone().negate();
  const p=toMe.multiplyScalar(Math.cos(a)*R0).addScaledVector(r,Math.sin(a)*R0);
  const w=new THREE.Vector3(p.x,0,p.z);T.tableG.worldToLocal(w);const dl=d.clone().transformDirection(new THREE.Matrix4().copy(T.tableG.matrixWorld).invert());dl.y=0;dl.normalize();
  return {x:w.x,z:w.z,d:dl};
}
function rcSpotOk(S,cam,W,Hh){
  const D=S.d,Rr=new THREE.Vector3(-D.z,0,D.x),pts=[];
  for(const [f,h] of [[0,0],[RC_R*.3,RC_R*.75],[RC_R,RC_R],[RC_XIN,0]])for(const u of [-.5,.5])pts.push([S.x+Rr.x*u*RC.PW+D.x*f,h,S.z+Rr.z*u*RC.PW+D.z*f]);
  for(const [x,,z] of pts)if(x*x+z*z>4.85*4.85)return false;   // 탁자 밖
  const sr=$('#stage').getBoundingClientRect(),hot=$('#rcHot'),pe=hot.style.pointerEvents;hot.style.pointerEvents='none';
  let ok=true;
  for(const [x,y,z] of pts){_v3.set(x,y,z);T.tableG.localToWorld(_v3);_v3.project(cam);const sx=(_v3.x+1)/2*W,sy=(1-_v3.y)/2*Hh;
    if(_v3.z>1||sx<24||sx>W-24||sy<24||sy>Hh-24){ok=false;break}
    const el=document.elementFromPoint(sr.left+sx,sr.top+sy);if(el&&el.id!=='cv'&&!el.closest('#front')){ok=false;break}
    if(rcBlocked(x,y,z,cam)){ok=false;break}}
  hot.style.pointerEvents=pe;return ok;
}
const _rcRay=window.THREE?new THREE.Raycaster():null;
function rcBlocked(x,y,z,cam){   // 그 점과 카메라 사이에 다른 3D 물건(판·보관함·통·카드)이 있으면 가림 (들판·탁자 자체·영수증은 빼고)
  const p=new THREE.Vector3(x,y+.01,z);T.tableG.localToWorld(p);const o=cam.position.clone(),dir=p.clone().sub(o),dist=dir.length();dir.normalize();
  _rcRay.set(o,dir);_rcRay.far=dist-.02;_rcRay.camera=cam;   // 스프라이트를 맞힐 때 카메라가 필요함
  const R=T.rc,skip=new Set([R.paper,R.ink,T.env,T.felt&&T.felt.mat].filter(Boolean));
  const objs=T.scene.children.filter(c=>c!==T.env&&c.visible);
  for(const h of _rcRay.intersectObjects(objs,true)){let o2=h.object,bad=false;
    while(o2){if(skip.has(o2)||o2===R.out||o2===R.inn||!o2.visible){bad=true;break}o2=o2.parent}   // 숨은 물건도 빼고
    if(bad||!h.object.visible||h.object.isSprite||h.object.isPoints||(h.object.material&&h.object.material.transparent&&h.object.material.opacity<.5))continue;
    if(h.object.parent===T.tableG&&!h.object.castShadow)continue;   // 탁자에 붙은 판(구멍·펠트 무늬 등)
    if(h.object.geometry&&h.object.geometry.type==='CylinderGeometry'&&h.object.parent===T.tableG)continue;   // 탁자 상판
    return true}
  return false;
}
function rcPickSpot(cam,W,Hh){
  const g=(V&&V.cfg&&V.cfg.game)||'gura',L=RC_CAND[g]||RC_CAND._;
  for(const a of L.a)for(const r of L.r){const S=rcSpotAt(a,cam,r);if(rcSpotOk(S,cam,W,Hh))return S}
  return rcSpotAt(L.a[0],cam,L.r[L.r.length-1]);   // 다 안 되면 첫 각도의 가장 안쪽 (탁자 위)
}
const _rcD=window.THREE?new THREE.Vector3():null,_rcR=window.THREE?new THREE.Vector3():null;
const rcY=(x,z)=>x*x+z*z<3.18*3.18?.0195:.006;   // 펠트(반지름 3.15, 윗면 .016) 위면 그만큼 높게
function rcRect(obj,cam,W,Hh){   // frontRect와 같지만 실제로 그린 카메라로
  _b3.setFromObject(obj);const box=_b3;let l=1e9,r=-1e9,tp=1e9,b=-1e9;
  for(let i=0;i<8;i++){_v3.set(i&1?box.max.x:box.min.x,i&2?box.max.y:box.min.y,i&4?box.max.z:box.min.z).project(cam);
    const x=(_v3.x+1)/2*W,y=(1-_v3.y)/2*Hh;l=Math.min(l,x);r=Math.max(r,x);tp=Math.min(tp,y);b=Math.max(b,y)}
  return {l,r,t:tp,b};
}
function rcptOpen(){   // 누르면 3D 영수증은 그대로 두고 2D 영수증(전체 기록)을 펼침
  const R=T.rc;if(!R||R.open)return;R.open=true;sfx('paper');rcptFill();$('#rcOv').hidden=false;
}
function rcptClose(quiet){
  const R=T.rc;if(!R||!R.open)return;R.open=false;$('#rcOv').hidden=true;if(!quiet)sfx('paper');
}
function rcptFill(){
  const R=T.rc,rows=R.rows;$('#rcHead').textContent=rows[0]?rows[0][0]:'';
  $('#rcLines').innerHTML=rows.slice(1).map(r=>`<li class="${r[1]?'lg-'+esc(r[1]):''}">${esc(r[0])}</li>`).join('');
  $('#rcTake').hidden=!(V&&V.st==='over');
  const b=$('#rc2d');b.scrollTop=b.scrollHeight;
}

function rcptHot(){
  const b=$('#rcHot');
  b.addEventListener('click',()=>rcptOpen());
  $('#rcOv').addEventListener('click',e=>{if(!e.target.closest('.rc2d'))rcptClose()});
  $('#rcTake').addEventListener('click',()=>{const txt=rcptText(),ok=()=>{$('#rcTake').textContent='✂ 가져갔습니다';sfx('pick');setTimeout(()=>{$('#rcTake').textContent='✂ 가져가기'},1600)};
    if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(txt).then(ok,()=>sfx('no'));else sfx('no')});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&T.rc&&T.rc.open){e.preventDefault();e.stopImmediatePropagation();rcptClose()}},true);
}
