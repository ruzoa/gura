/* index.html 공통 코드 · 공개 탁자 목록 판(플립 안내판). 파일 순서는 index.html의 <script src> 순서 */
/* 공개 탁자 목록 판 = 플립 안내판: 돋보기를 누르면 키판이 디스플레이 아래로 들어간 뒤, 같은 틈에서 원목 틀의 안내판이 서서 올라옴.
   틀 안에 플립 줄 7개(게임·탁자 이름·인원 칸, 디스플레이와 같은 짙은 칸에 크림 글씨). 내용이 바뀌면 줄마다 차례로 촤라락 넘어감.
   맨 위 띠에 쪽 표시 점, 짙은 판 바로 아래 놋쇠 단추(◀ ▶ ↻ ✕). 줄을 누르면 그 줄이 밝게 딸깍 → 찾아감 */
const PL_X=[46,226,622,786],PL_FR=34;   // 칸 경계(게임 | 탁자 이름 | 인원), 틀 두께
function frontBuildList(TG){
  const {Z,D}=DSP,PW=1.3,PL=PL_CH/640,cv=document.createElement('canvas');cv.width=PL_CW;cv.height=PL_CH;   // 구멍 폭 안, 세로로 김
  const tex=new THREE.CanvasTexture(cv);tex.anisotropy=8;
  const g=new THREE.Group();g.position.set(0,.002,Z+D*.8);TG.add(g);
  const arm=new THREE.Group();arm.rotation.x=-.08;g.add(arm);   // 거의 똑바로 섬
  const b=new THREE.Group();arm.add(b);
  const wood=toon({color:0x8a5530}),face=toon({map:tex,rim:0});
  const board=new THREE.Mesh(new THREE.BoxGeometry(PW,PL,.09),[wood,wood,wood,wood,face,wood]);board.castShadow=true;b.add(board);hull(new THREE.BoxGeometry(PW+.035,PL+.035,.12),board,b);
  const top=new THREE.Mesh(new THREE.BoxGeometry(PW+.1,.07,.16),wood);top.position.set(0,PL/2+.035,0);b.add(top);hull(new THREE.BoxGeometry(PW+.13,.1,.19),top,b);   // 위 갓
  const pt=(x,y)=>[x/PL_CW*PW-PW/2,PL/2-y/PL_CH*PL];
  const hitM=new THREE.MeshBasicMaterial({visible:false}),rows=[];
  for(let i=0;i<FR_ROWS;i++){const [x,y]=pt(PL_CW/2,PL_Y0+i*PL_STEP+PL_RH/2),m=new THREE.Mesh(new THREE.PlaneGeometry(PW*.9,PL_RH/PL_CH*PL),hitM);m.position.set(x,y,.05);b.add(m);rows.push(m)}
  // 레버: 오른쪽 옆면 축에서 앞으로 뻗은 놋쇠 막대 + 나무 손잡이. 당기면 아래로 꺾였다가 되돌아옴
  const lv=new THREE.Group();lv.position.set(PW/2+.05,-.05,0);b.add(lv);
  const brass=toon({color:0xb8925a,rim:.3}),knobM=toon({color:0x5a3a22,rim:.25});
  const hub=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,.08,20),brass);hub.rotation.z=Math.PI/2;lv.add(hub);hull(new THREE.CylinderGeometry(.085,.085,.1,20),hub,lv).rotation.z=Math.PI/2;
  const rod=new THREE.Group();lv.add(rod);
  const bar=new THREE.Mesh(new THREE.CylinderGeometry(.022,.022,.36,10),brass);bar.rotation.x=Math.PI/2;bar.position.set(.03,0,.18);rod.add(bar);
  const knob=new THREE.Mesh(new THREE.SphereGeometry(.075,16,12),knobM);knob.position.set(.03,0,.38);knob.castShadow=true;rod.add(knob);hull(new THREE.SphereGeometry(.088,16,12),knob,rod);
  rod.rotation.x=-.5;   // 쉬는 자리: 손잡이가 앞으로 비스듬히 올라감
  // 새로고침: 판 왼쪽 옆 위의 놋쇠 단추 (↻를 새김). 누르면 한 바퀴 돌며 다시 찾음, 찾는 동안 계속 돎, 없음·끊김이면 숨 쉬듯 빛남
  const refT=canvasTex(128,128,(x,w,h)=>{x.fillStyle='#c9a46a';x.fillRect(0,0,w,h);x.strokeStyle='#5a3a1c';x.fillStyle='#5a3a1c';x.lineWidth=13;x.lineCap='round';x.beginPath();x.arc(64,66,32,-Math.PI*.35,Math.PI*1.25);x.stroke();
    const a=-Math.PI*.35,ex=64+32*Math.cos(a),ey=66+32*Math.sin(a);x.beginPath();x.moveTo(ex+20,ey-6);x.lineTo(ex-6,ey-22);x.lineTo(ex-2,ey+14);x.closePath();x.fill()});
  const refM=toon({color:0xb8925a,rim:.3}),rf=new THREE.Group();rf.position.set(-PW/2-.11,PL/2-.2,.04);b.add(rf);   // 왼쪽 옆 위 (레버는 오른쪽)
  const xT=canvasTex(128,128,(x,w,h)=>{x.fillStyle='#c9a46a';x.fillRect(0,0,w,h);x.strokeStyle='#5a3a1c';x.lineWidth=16;x.lineCap='round';x.beginPath();x.moveTo(38,38);x.lineTo(90,90);x.moveTo(90,38);x.lineTo(38,90);x.stroke()});
  const lx=new THREE.Mesh(new THREE.CylinderGeometry(.075,.075,.05,24),[brass,toon({map:xT,rim:.2}),brass]);lx.rotation.x=Math.PI/2;lx.position.set(PW/2+.1,PL/2-.2,.04);b.add(lx);{const o=hull(new THREE.CylinderGeometry(.088,.088,.06,24),lx,b);o.rotation.x=Math.PI/2;lx.visible=o.visible=false}
  const rfm=new THREE.Mesh(new THREE.CylinderGeometry(.085,.085,.05,24),[refM,toon({map:refT,rim:.2}),refM]);rfm.rotation.x=Math.PI/2;rf.add(rfm);hull(new THREE.CylinderGeometry(.1,.1,.06,24),rfm,rf).rotation.x=Math.PI/2;
  // 판 얼굴 아랫단(어두운 줄 아래 밝은 나무 띠)에 박힌 놋쇠 단추: ◀ 이전 쪽 · ▶ 다음 쪽 · ↻ 새로고침 · ✕ 닫기. 판과 같이 오르내리고, 누르면 판 안쪽으로 살짝 들어갔다 나옴
  const lbtn=[],BR=.08,BZ=.068,BY=PL/2-PL_BTNY/PL_CH*PL;
  {const ink='#5a3a1c',dr={
    prev:x=>{x.beginPath();x.moveTo(36,64);x.lineTo(86,34);x.lineTo(86,94);x.closePath();x.fill()},
    next:x=>{x.beginPath();x.moveTo(92,64);x.lineTo(42,34);x.lineTo(42,94);x.closePath();x.fill()},
    ref:x=>{x.lineWidth=13;x.beginPath();x.arc(64,66,32,-Math.PI*.35,Math.PI*1.25);x.stroke();const a=-Math.PI*.35,ex=64+32*Math.cos(a),ey=66+32*Math.sin(a);x.beginPath();x.moveTo(ex+20,ey-6);x.lineTo(ex-6,ey-22);x.lineTo(ex-2,ey+14);x.closePath();x.fill()},
    x:x=>{x.lineWidth=16;x.beginPath();x.moveTo(38,38);x.lineTo(90,90);x.moveTo(90,38);x.lineTo(38,90);x.stroke()}};
   [['prev',-.42],['next',-.14],['ref',.14],['x',.42]].forEach(([k,bx])=>{
    const tx=canvasTex(128,128,(x,w,h)=>{x.fillStyle='#c9a46a';x.fillRect(0,0,w,h);x.strokeStyle=x.fillStyle=ink;x.lineCap='round';x.lineJoin='round';x.translate(64,64);x.rotate(-Math.PI/2);x.translate(-64,-64);dr[k](x)});   // 단추 윗면은 90도 돌아 보여서 미리 반대로 돌려 그림
    const m=new THREE.Mesh(new THREE.CylinderGeometry(BR,BR+.008,.05,28),[brass,toon({map:tx,rim:.2}),brass]);m.rotation.x=Math.PI/2;m.position.set(bx,BY,BZ);m.castShadow=true;b.add(m);
    const o=hull(new THREE.CylinderGeometry(BR+.012,BR+.02,.06,28),m,b);
    lbtn.push({k,m,o,z:BZ,at:-1e9})})}
  // 판이 오르내릴 때 탁자 윗면 아래쪽은 잘라서 안 보이게 + 판이 나오는 틈
  const clipY=[new THREE.Plane(new THREE.Vector3(0,1,0),-.001)];
  b.traverse(o=>{if(o.material&&o.material!==hitM)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{m.clippingPlanes=clipY})});
  const slit=new THREE.Mesh(new THREE.PlaneGeometry(PW+.16,.22),new THREE.MeshBasicMaterial({color:0x15100c}));slit.rotation.x=-Math.PI/2;slit.position.y=.0005;g.add(slit);
  lv.visible=false;rf.visible=false;
  T.plist={g,b,board,lbtn,cv,tex,rows,xk:lx,ref:{g:rf,m:refM,at:-1e9,ang:0},lever:{g:lv,rod,knob,at:-1e9,dir:1},L:PL,W:PW,tilt:.08,key:'',flaps:[...Array(FR_ROWS)].map(()=>({to:['','',''],cur:['','',''],until:0,next:0,mid:0})),pick:-1,pickAt:0,drawn:''};
  const fr=$('#front');
  {const acts={prev:()=>frontListPage(-1),next:()=>frontListPage(1),ref:()=>frontListRefresh(true),x:()=>frontList(false)},nm={prev:'이전 쪽',next:'다음 쪽',ref:'새로고침',x:'닫기'};
   lbtn.forEach(B=>{const bt=document.createElement('button');bt.type='button';bt.className='fr-hot off fr-key';bt.id='frL'+B.k;bt.setAttribute('aria-label',nm[B.k]);bt.title=nm[B.k];
     bt.addEventListener('click',()=>{B.at=clock();acts[B.k]();if(B.k==='prev'||B.k==='next'||B.k==='x')sfx('key')});fr.insertBefore(bt,$('#frFoot'))})}
  rows.forEach((m,i)=>{const bt=document.createElement('button');bt.type='button';bt.className='fr-hot off fr-key';bt.id='frR'+i;bt.addEventListener('click',()=>frontListPick(i));fr.insertBefore(bt,$('#frFoot'))});
}
function frontListRooms(){return (FR.lrooms||[]).filter(roomOpen)}
const PL_POOL='가나다라마바사아자차카타파하구오목야추대부호블랙잭쿼리도0123456789';
/* 줄마다 보일 내용: [게임, 탁자 이름, 인원]. 찾는 중이면 첫 줄이 계속 돌고, 없으면 가운데 줄에 두 글자 */
function frontListWant(){
  const rooms=frontListRooms(),pages=Math.max(1,Math.ceil(rooms.length/FR_ROWS)),pg=Math.min(FR.lpage||0,pages-1);
  const rows=[...Array(FR_ROWS)].map(()=>['','','']);let spin=-1;
  if(FR.lrooms==null)spin=0;
  else if(FR.lrooms===false)rows[3]=['','끊김',''];
  else if(!rooms.length)rows[3]=['','없음',''];
  else rooms.slice(pg*FR_ROWS,pg*FR_ROWS+FR_ROWS).forEach((r,i)=>{rows[i]=[gameOf(r.g).short||gameOf(r.g).name,r.title||'공개 탁자',r.n+'/'+r.max]});
  return {rows,spin,pg,pages};
}
function frontDrawList(t){
  const P=T.plist;if(!P)return;
  const w=frontListWant(),key=JSON.stringify(w);
  if(key!==P.key){P.key=key;w.rows.forEach((r,i)=>{const f=P.flaps[i];
    if(w.spin===i){f.to=r;f.until=1e12;return}
    if(f.until<1e12&&f.to.join('|')===r.join('|'))return;
    f.to=r;f.until=(f.cur.join('')||r.join(''))?t+180+i*110+Math.random()*80:0})}
  let busy=false;
  for(const f of P.flaps){
    if(t<f.until){busy=true;if(t>=f.next){f.next=t+60;f.mid=1;const rnd=n=>[...Array(n)].map(()=>PL_POOL[Math.random()*PL_POOL.length|0]).join('');f.cur=[f.to[0]?rnd(Math.max(1,[...f.to[0]].length)):'',rnd(Math.max(2,Math.min(6,[...f.to[1]].length||3))),f.to[2]?rnd(3):''];if(!P.sndAt||t-P.sndAt>70){P.sndAt=t;sfx('flap')}}}
    else if(f.mid||f.cur.join('|')!==f.to.join('|')){f.cur=f.to.slice();f.mid=0}
  }
  const pk=P.pick>=0&&t-P.pickAt<420?P.pick:-1;
  const dk=P.flaps.map(f=>f.cur.join('|')+f.mid).join('/')+pk+'|'+w.pg+'/'+w.pages;
  if(dk===P.drawn&&!busy)return;P.drawn=dk;
  const g=P.cv.getContext('2d'),W=PL_CW,Hc=PL_CH;
  // 원목 틀
  for(let p=0;p<5;p++){const y0=p*Hc/5,ph=Hc/5;g.fillStyle=p%2?'#b98350':'#ad7745';g.fillRect(0,y0,W,ph);g.fillStyle='rgba(84,46,20,.5)';g.fillRect(0,y0+ph-3,W,4)}
  g.fillStyle='#2b1d14';rr(g,PL_FR-8,PL_Y0-26,W-2*PL_FR+16,(FR_ROWS-1)*PL_STEP+PL_RH+52,18);g.fill();   // 안쪽 짙은 판
  const cell=(x0,x1,y,txt,mid,lit,align)=>{
    const h=PL_RH;g.fillStyle=lit?'#3d2c20':'#16100c';rr(g,x0,y,x1-x0,h,10);g.fill();
    g.fillStyle=lit?'#4a3627':'#231a14';rr(g,x0,y,x1-x0,h/2,10);g.fill();g.fillRect(x0,y+h/2-10,x1-x0,10);
    g.fillStyle='rgba(0,0,0,.55)';g.fillRect(x0,y+h/2-1.5,x1-x0,3);
    if(txt){g.save();g.beginPath();g.rect(x0+4,y,x1-x0-8,h);g.clip();g.fillStyle=lit?'#fff6e2':'#f6ecd8';g.textBaseline='middle';
      const cy=y+h/2+4;let fs=align==='r'?44:48;g.font=`${fs}px "Jua","Black Han Sans",sans-serif`;
      let s=txt;const maxW=x1-x0-24;while([...s].length>1&&g.measureText(s).width>maxW){s=[...s].slice(0,-1).join('')}if(s!==txt&&[...s].length>1)s=[...s].slice(0,-1).join('')+'…';
      const x=align==='c'?(x0+x1)/2:align==='r'?x1-14:x0+16;g.textAlign=align==='c'?'center':align==='r'?'right':'left';
      if(mid){g.globalAlpha=.85;g.translate(x,cy);g.scale(1,.84);g.fillText(s,0,0)}else g.fillText(s,x,cy);g.restore()}
    g.fillStyle='#3a2c22';g.fillRect(x0-3,y+h/2-6,5,12);g.fillRect(x1-2,y+h/2-6,5,12);   // 경첩
  };
  P.flaps.forEach((f,i)=>{const y=PL_Y0+i*PL_STEP,lit=i===pk,big=f.to[1]&&!f.to[0];
    if(big)cell(PL_X[0],PL_X[3],y,f.cur[1],f.mid,lit,'c');
    else{cell(PL_X[0],PL_X[1]-10,y,f.cur[0],f.mid,lit,'c');cell(PL_X[1],PL_X[2]-10,y,f.cur[1],f.mid,lit,'l');cell(PL_X[2],PL_X[3],y,f.cur[2],f.mid,lit,'r')}});
  // 위 띠: 쪽 표시 놋쇠 못 (단추는 짙은 판 바로 아래)
  if(w.pages>1)for(let k=0;k<w.pages&&k<9;k++){const x=W/2+(k-(Math.min(w.pages,9)-1)/2)*36;g.fillStyle=k===w.pg?'#f2d08a':'#6e4a2c';g.beginPath();g.arc(x,PL_DOTY,10,0,7);g.fill();g.strokeStyle='rgba(43,29,20,.7)';g.lineWidth=3;g.stroke()}
  P.tex.needsUpdate=true;
}
function frontList(on){
  if(on){
    if(!FR.ok||mode!=='lobby'||FR.warp||FR.spread||net.peer)return;
    FR.list=true;FR.leanOn=true;FR.keyAt=clock();FR.buf='';FR.pub=null;FR.lpage=0;
    if(T.plist){T.plist.key='';T.plist.flaps.forEach(f=>{f.cur=['','',''];f.to=['','',''];f.until=0})}
    if(Date.now()-roomScanAt<20000&&roomCache.length)FR.lrooms=roomCache;
    else{FR.lrooms=null;if(!FR.scan){FR.scan=true;scanRooms(l=>{FR.scan=false;FR.lrooms=l||false})}}
  }else{if(!FR.list)return;FR.list=false;sfx('tick')}
}
/* 새로고침: 누르면 줄을 비우고 다시 찾음(첫 줄이 돎). 판이 열려 있으면 15초마다 저절로 다시 찾음(찾는 동안 지금 줄은 그대로) */
function frontListRefresh(manual){
  const P=T.plist;if(P)P.ref.at=clock();
  if(manual)sfx('key');
  if(FR.scan)return;
  if(manual){FR.lrooms=null;FR.lpage=0}
  FR.scan=true;scanRooms(l=>{FR.scan=false;if(l)FR.lrooms=l;else if(manual||!FR.lrooms)FR.lrooms=false});
}
function frontListPage(dir){
  const P=T.plist;if(P){P.lever.at=clock();P.lever.dir=dir}
  const pages=Math.ceil(frontListRooms().length/FR_ROWS);
  sfx('lid');
  if(pages<=1){setTimeout(()=>sfx('no'),120);return}
  FR.lpage=((FR.lpage||0)+dir+pages)%pages;FR.keyAt=clock();
}
function frontListPick(i){
  const r=frontListRooms()[(FR.lpage||0)*FR_ROWS+i];if(!r||mode!=='lobby'||FR.warp||net.peer)return;
  const P=T.plist;P.pick=i;P.pickAt=clock();sfx('key');
  setTimeout(()=>{if(mode!=='lobby'||FR.warp||net.peer)return;FR.list=false;joinRoom(r.code)},320);   // 줄이 밝게 딸깍 → 판이 들어가며 출발
}
