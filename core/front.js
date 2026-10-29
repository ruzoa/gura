/* index.html 공통 코드 · 첫 화면·대기실(탁자 하나): 의자·디스플레이·자판·상치우기. 파일 순서는 index.html의 <script src> 순서 */
/* ===== 첫 화면·대기실: 탁자 하나 =====
   로비 창 대신 들판의 탁자 하나에서 시작합니다.
   · 첫 화면: 서서 탁자(펠트가 깔림)와 둘레의 나무 기둥 의자만 봄. 탁자를 누르면 다가가 앉음(FR.sit)
   · 앉으면: 내 앞 덮개가 열려 디스플레이·키판(찾아가기)이 올라오고, 가운데 구멍에서 상차리기 버튼이 올라옴.
     디스플레이·키판을 누르면 숙여서 봄. 탁자 밖을 두 번 누르거나 Esc면 일어섬
   · 찾아가면 앉은 채로 타임머신(탁자가 떨리고 해·하늘·안개) → 도착하면 그 탁자, 못 가면 덜컹 + 디스플레이에 없음·만석·끊김
   · 대기실: 상차리기 버튼이 들어간 구멍에서 투사기가 올라와 홀로그램(위에서부터 탁자 이름·게임 이름·게임 말), 디스플레이(번호·눈·자물쇠),
     이름표(자리), 시작 버튼. 게임이 시작되면 모두 닫히거나 탁자 속으로
   FR.stand: 1 서서 봄 ↔ 0 앉음.  모든 연출은 시간 기준(frontTween).  WebGL이 없으면 예전 로비 창 */
const FR_POOL='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const FR_WORD=new Set(['없음','만석','끊김']);
const HOLO_C=0xffa04a,HOLO_LINE=0xffe2b8,HOLO_BAD=0xff4d6d;   // 주황빛 (못 하는 게임은 붉은 분홍)
const FR_KEYS=['1','2','3','4','5','search','dice','6','7','8','9','0','←','enter'];   // 키판 두 줄: 윗줄 1~5·돋보기(공개 탁자 목록)·주사위(아무 탁자나), 아랫줄 6~0·지우기(뒤로)·엔터
const FR_KEY_NAME={'←':'지우기 (뒤로)',enter:'참여하기',search:'공개 탁자 목록',dice:'아무 탁자나 앉기'};
const FR_MENU=['create','join','rules'],FR_HOST=['bot','chairUp','chairDn','rset','clear'];   // 첫 자판(상차리기·참여하기·게임 규칙), 방장 대기실 자판
const FR_ROWS=7;   // 공개 탁자 목록 판: 한 쪽에 7줄
const PL_CW=832,PL_CH=1024,PL_Y0=52,PL_STEP=122,PL_RH=108,PL_RAIL=966;   // 목록 판 그림 크기와 줄 자리
const DSP={W:1.5,D:.5,Th:.05,Z:3.9};   // 디스플레이: 폭, 깊이, 두께, 경첩(먼 쪽 끝) 위치
function frontBuild(){
  const TG=T.tableG;
  frontBuildStumps();frontBuildDisplay(TG);frontBuildHolo(TG);frontBuildStart(TG);rcptBuild(TG);
  FR.flaps=[0,1,2,3].map(()=>({ch:' ',to:' ',until:0,next:0}));
  frontDrawBoard(true);
}
/* 나무 기둥 의자: 탁자 둘레. 첫 화면 4개, 대기실은 최대 인원만큼(이름표와 같은 자리), 게임 중은 참가자만큼 */
function frontBuildStumps(){
  const top=canvasTex(256,256,(g,w,h)=>{g.fillStyle='#d9b07a';g.fillRect(0,0,w,h);g.strokeStyle='rgba(122,74,40,.45)';g.lineWidth=5;for(let r=16;r<128;r+=15){g.beginPath();g.arc(w/2+2,h/2-1,r,0,7);g.stroke()}g.fillStyle='rgba(122,74,40,.35)';g.beginPath();g.arc(w/2,h/2,7,0,7);g.fill()});
  const bark=toon({color:0x7b5534}),topM=toon({map:top,rim:0});
  T.stumps=[];
  for(let k=0;k<8;k++){
    const SH=1.35,g=new THREE.Group(),m=new THREE.Mesh(new THREE.CylinderGeometry(.55,.66,SH,14),[bark,topM,bark]);m.position.y=SH/2;m.castShadow=m.receiveShadow=true;g.add(m);hull(new THREE.CylinderGeometry(.58,.7,SH+.02,14),m,g);
    g.position.set(0,FLOOR_Y,0);g.rotation.y=k*1.7;g.scale.setScalar(.001);g.visible=false;T.scene.add(g);
    T.stumps.push({g,a:0,s:0,on:false});
  }
}
function frontStumps(t,dt,lobby,wait){
  if(!T.stumps)return;
  let angs=[];
  if(lobby||!V||!V.ps)angs=[0];   // 첫 화면: 내가 앉을 자리에 의자 하나
  else if(wait){const wN=Math.max(+(V.cfg&&V.cfg.max)||0,V.ps.length),me=myIdx(),wB=me>=0?mySeatNo():0;for(let k=0;k<wN;k++)angs.push(((k-wB+wN)%wN+(me<0?.5:0))*Math.PI*2/wN)}
  else angs=V.ps.map((_,i)=>seatAngle(i));
  const f=1-Math.exp(-Math.max(0,dt)*7);
  T.stumps.forEach((S,k)=>{
    const want=k<angs.length;
    if(want){let d=angs[k]-S.a;d=Math.atan2(Math.sin(d),Math.cos(d));S.a=S.s<.02?angs[k]:S.a+d*f}
    S.s+=((want?1:0)-S.s)*f;if(S.s<.003&&!want)S.s=0;
    S.g.visible=S.s>.01;S.g.scale.setScalar(Math.max(.001,S.s));S.g.position.x=Math.sin(S.a)*5.75;S.g.position.z=Math.cos(S.a)*5.75;
  });
}
/* 디스플레이: 내 쪽 나무 띠에 박힌 판. 닫히면 등판(원목)이 위로 와서 덮개, 열면 먼 쪽 경첩을 축으로 들려 화면이 나를 향함 */
function frontBuildDisplay(TG){
  const {W,D,Th,Z}=DSP,cv=document.createElement('canvas');cv.width=640;cv.height=208;
  const tex=new THREE.CanvasTexture(cv);tex.anisotropy=4;
  const pivot=new THREE.Group();pivot.position.set(0,.004,Z);TG.add(pivot);
  const panel=new THREE.Group();panel.position.z=D/2;pivot.add(panel);
  const dark=toon({color:0x2b1d14,rim:0}),side=toon({color:0x6e4526});
  const back=new THREE.Mesh(new THREE.BoxGeometry(W,Th,D),[side,side,T.woodTop,dark,side,side]);back.position.y=-Th/2;back.castShadow=true;panel.add(back);
  hull(new THREE.BoxGeometry(W+.035,Th+.03,D+.035),back,panel);
  const screen=new THREE.Mesh(new THREE.PlaneGeometry(W*.92,D*.9),new THREE.MeshBasicMaterial({map:tex}));screen.rotation.x=Math.PI/2;screen.position.y=-Th-.002;panel.add(screen);
  const hole=new THREE.Mesh(new THREE.PlaneGeometry(W,D),new THREE.MeshBasicMaterial({color:0x1d140e}));hole.rotation.x=-Math.PI/2;hole.position.set(0,.0015,Z+D/2);hole.visible=false;TG.add(hole);
  T.board={g:pivot,cv,tex,screen,panel,hole,sw:W*.92,sh:D*.9};
  // 키판: 디스플레이가 열리면 빈 자리에서 올라옴 (첫 화면에서만). 노트북처럼 화면 아래 키보드
  const kp=new THREE.Group();kp.position.set(0,-.09,Z+D/2);TG.add(kp);
  const keyM=toon({color:0xd9c7a8,rim:.2}),keys=[];
  FR_KEYS.forEach((k,i)=>{
    const r=i<7?0:1,c=i%7,kc=document.createElement('canvas');kc.width=kc.height=96;const g2=kc.getContext('2d');
    const num=/[0-9]/.test(k);
    g2.fillStyle=num?'#fbf3e4':k==='dice'||k==='search'?'#fffaf0':'#e6d6ba';g2.fillRect(0,0,96,96);
    if(k==='dice'){   // 주사위: 아무 탁자나
      g2.strokeStyle='#cc3a2e';g2.lineWidth=6;rr(g2,14,14,68,68,14);g2.stroke();g2.fillStyle='#cc3a2e';
      for(const [x,y] of [[30,30],[66,30],[48,48],[30,66],[66,66]]){g2.beginPath();g2.arc(x,y,7,0,7);g2.fill()}
    }else if(k==='search'){   // 돋보기: 공개 탁자 목록
      g2.strokeStyle='#3b2a1f';g2.lineWidth=8;g2.lineCap='round';g2.beginPath();g2.arc(42,42,20,0,7);g2.stroke();g2.lineWidth=11;g2.beginPath();g2.moveTo(57,57);g2.lineTo(75,75);g2.stroke();
    }else if(k==='enter'){   // 엔터: 꺾인 화살표
      g2.strokeStyle='#3b2a1f';g2.fillStyle='#3b2a1f';g2.lineWidth=8;g2.lineCap='round';g2.lineJoin='round';g2.beginPath();g2.moveTo(72,22);g2.lineTo(72,58);g2.lineTo(34,58);g2.stroke();
      g2.beginPath();g2.moveTo(20,58);g2.lineTo(38,42);g2.lineTo(38,74);g2.closePath();g2.fill();
    }else{g2.fillStyle='#3b2a1f';g2.font=`${num?60:52}px "Black Han Sans","Jua",sans-serif`;g2.textAlign='center';g2.textBaseline='middle';g2.fillText(k,48,54)}
    const top=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(kc)});
    const m=new THREE.Mesh(new THREE.BoxGeometry(.17,.06,.17),[keyM,keyM,top,keyM,keyM,keyM]);
    m.position.set((c-3)*.2,0,(r-.5)*.21);m.castShadow=true;kp.add(m);hull(new THREE.BoxGeometry(.185,.075,.185),m,kp);
    m.userData={k,downAt:-1e9};keys.push(m);
  });
  // 키판은 디스플레이 아래(경첩 쪽)에서 미끄러져 나옴: 경첩선 뒤쪽은 잘라서 안 보이게
  const clipZ=[new THREE.Plane(new THREE.Vector3(0,0,1),-Z)];
  kp.traverse(o=>{if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{m.clippingPlanes=clipZ})});
  T.keypad={g:kp,keys};
  // 첫 자판: 앉으면 먼저 나옴. 상차리기(탁자 위 +), 참여하기(→]). 참여하기를 누르면 이 자판이 들어가고 같은 틈에서 숫자 키판이 나옴
  T.menuPad=frontBuildPad(TG,FR_MENU,{w:.44,d:.38,gap:.52,id:'frM',on:frontMenu});
  // 대기실 자판: 방장(봇 추가·의자 추가·의자 빼기·상치우기), 참가자(관전하기·떠나기), 관전자(참여하기·떠나기). 같은 틈에서 나옴
  T.hostPad=frontBuildPad(TG,FR_HOST,{w:.26,d:.28,gap:.295,id:'frH',on:frontWaitKey});
  T.guestPad=frontBuildPad(TG,['spec','rset','leave'],{w:.44,d:.38,gap:.52,id:'frG',on:frontWaitKey});
  T.sitPad=frontBuildPad(TG,['sit','rset','leave'],{w:.44,d:.38,gap:.52,id:'frS',on:frontWaitKey});
  frontClearHold();
  const fr=$('#front');FR_KEYS.forEach((k,i)=>{const b=document.createElement('button');b.type='button';b.className='fr-hot off fr-key';b.id='frK'+i;b.setAttribute('aria-label',FR_KEY_NAME[k]||k);b.addEventListener('click',()=>frontKey(k));fr.insertBefore(b,$('#frFoot'))});
  frontBuildList(TG);frontBuildRules(TG);
}
/* 자판 하나 만들기: 디스플레이 아래(경첩 쪽)에서 미끄러져 나오는 큰 키 줄. 키 윗면은 그림만 (글자 없음) */
function frontBuildPad(TG,list,o){
  const {Z,D}=DSP,g=new THREE.Group();g.position.set(0,-.09,Z+D/2);TG.add(g);const keys=[],n=list.length;
  list.forEach((k,i)=>{
    const kc=document.createElement('canvas');kc.width=192;kc.height=Math.round(192*o.d/o.w);const g2=kc.getContext('2d');
    const col=PAD_COL[k]||['#fbf3e4',0xd9c7a8];g2.fillStyle=col[0];g2.fillRect(0,0,kc.width,kc.height);
    g2.save();g2.translate(kc.width/2-96,kc.height/2-64);padIcon(g2,k);g2.restore();
    const side=toon({color:col[1],rim:.2}),top=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(kc)});
    const m=new THREE.Mesh(new THREE.BoxGeometry(o.w,.07,o.d),[side,side,top,side,side,side]);
    m.position.set((i-(n-1)/2)*o.gap,0,0);m.castShadow=true;g.add(m);hull(new THREE.BoxGeometry(o.w+.02,.085,o.d+.02),m,g);
    m.userData={k,downAt:-1e9};keys.push(m);
  });
  const clipZ=[new THREE.Plane(new THREE.Vector3(0,0,1),-Z)];   // 경첩선 뒤쪽은 잘라서 안 보이게
  g.traverse(x=>{if(x.material)(Array.isArray(x.material)?x.material:[x.material]).forEach(m=>{m.clippingPlanes=clipZ})});
  list.forEach((k,i)=>{const b=document.createElement('button');b.type='button';b.className='fr-hot off fr-key';b.id=o.id+i;b.setAttribute('aria-label',PAD_NAME[k]);b.title=PAD_NAME[k];b.addEventListener('click',()=>o.on(k));$('#front').insertBefore(b,$('#frFoot'))});
  return {g,keys,id:o.id,a:{v:0,to:0,from:0,t0:0,ms:0}};
}
const PAD_NAME={create:'상차리기',join:'참여하기',bot:'봇 추가',chairUp:'의자 추가',chairDn:'의자 빼기',clear:'상치우기 (꾹 누르기)',spec:'관전하기',sit:'참여하기',rules:'게임 규칙',rset:'탁자 설정·규칙',leave:'탁자 떠나기 (두 번 누르기)'};
const PAD_COL={create:['#f2b632',0xd99a1e]};
function padIcon(g,k){   // 192×128 칸에 그림 (상·의자 그림은 사용자 스케치: 둥근 상판 + 기둥 + 발판, 나이테 보이는 나무 기둥)
  const ink='#3b2a1f',bg=g.fillStyle;g.strokeStyle=g.fillStyle=ink;g.lineCap='round';g.lineJoin='round';
  const L=(w,...p)=>{g.lineWidth=w;g.beginPath();g.moveTo(p[0],p[1]);for(let i=2;i<p.length;i+=2)g.lineTo(p[i],p[i+1]);g.stroke()};
  const E=(w,cx,cy,rx,ry,a0=0,a1=7)=>{g.lineWidth=w;g.beginPath();g.ellipse(cx,cy,rx,ry,0,a0,a1);g.stroke()};
  const mark=(cx,cy,r,plus)=>{   // 위에 뜬 +·−: 지나가는 자리의 선을 지우고 두껍게
    g.save();g.strokeStyle=bg;L(28,cx-r-6,cy,cx+r+6,cy);if(plus)L(28,cx,cy-r-6,cx,cy+r+6);g.restore();
    L(15,cx-r,cy,cx+r,cy);if(plus)L(15,cx,cy-r,cx,cy+r)};
  const table=()=>{   // 둥근 상판(두께) + 기둥 + 발판
    g.fillStyle=bg;g.beginPath();g.ellipse(96,60,64,17,0,0,7);g.fill();
    E(8,96,60,64,17);E(8,96,68,64,17,0,Math.PI);L(8,32,60,32,68);L(8,160,60,160,68);
    L(8,88,86,86,108);L(8,104,86,106,108);E(8,96,111,22,7,-.2,Math.PI+.2)};
  const stump=(cx,top,rx,h)=>{   // 나무 기둥 의자: 윗면 나이테 + 몸통
    const ry=rx*.42;E(8,cx,top,rx,ry);E(6,cx,top+1,rx*.62,ry*.6,Math.PI*.35,Math.PI*2.15);E(6,cx,top+1,rx*.3,ry*.3,Math.PI*.1,Math.PI*1.75);
    g.beginPath();g.arc(cx,top+1,3.5,0,7);g.fill();
    L(8,cx-rx,top,cx-rx+3,top+h);L(8,cx+rx,top,cx+rx-3,top+h);E(8,cx,top+h,rx-3,ry*.8,0,Math.PI)};
  // 상·의자 그림은 +·−에 상관없이 같은 크기. 상은 기호가 위에서 윗면 테두리를 끊고 지나가고, 의자는 기호가 오른쪽
  if(k==='create'){table();mark(96,26,18,true)}
  else if(k==='clear'){table();mark(96,42,22,false)}
  else if(k==='chairUp'){stump(78,52,36,46);L(15,140,70,180,70);L(15,160,50,160,90)}   // 의자는 기둥을 왼쪽으로, +·−는 오른쪽에
  else if(k==='chairDn'){stump(78,52,36,46);L(15,140,70,180,70)}
  else if(k==='join'||k==='sit'){L(11,122,24,146,24,146,104,122,104);L(11,40,64,116,64);L(11,92,40,118,64,92,88)}
  else if(k==='leave'){L(11,70,24,46,24,46,104,70,104);L(11,72,64,148,64);L(11,124,40,150,64,124,88)}   // 문틀 밖으로 나가는 화살표
  else if(k==='rset'){   // 탁자 설정: 톱니바퀴
    g.save();g.translate(96,64);g.lineWidth=12;
    for(let a=0;a<8;a++){g.rotate(Math.PI/4);g.beginPath();g.moveTo(0,-28);g.lineTo(0,-46);g.stroke()}
    g.lineWidth=11;g.beginPath();g.arc(0,0,29,0,7);g.stroke();g.beginPath();g.arc(0,0,9,0,7);g.fill();g.restore()}
  else if(k==='rules'){   // 펼친 책
    L(8,96,30,96,108);L(8,96,30,72,20,40,22,40,100,72,98,96,108);L(8,96,30,120,20,152,22,152,100,120,98,96,108);
    L(5,52,42,82,46);L(5,52,58,82,62);L(5,52,74,82,78);L(5,110,46,140,42);L(5,110,62,140,58);L(5,110,78,140,74)}
  else if(k==='bot'){L(8,96,14,96,32);g.beginPath();g.arc(96,12,7,0,7);g.fill();g.lineWidth=9;rr(g,58,34,76,64,16);g.stroke();
    g.beginPath();g.arc(80,62,8,0,7);g.arc(112,62,8,0,7);g.fill();L(7,82,84,110,84);L(8,52,58,52,74);L(8,140,58,140,74)}
  else if(k==='spec'){g.lineWidth=9;g.beginPath();g.arc(68,72,24,0,7);g.stroke();g.beginPath();g.arc(124,72,24,0,7);g.stroke();L(9,88,58,104,58);L(9,56,50,64,30);L(9,136,50,128,30)}
}
/* 대기실 자판 */
function frontWaitCan(k){
  if(!V||!frWaitV())return false;
  const max=+V.cfg.max,n=(V.ps||[]).length,hi=(roomSetOf(G).find(d=>d.k==='max')||{hi:8}).hi;
  if(k==='bot'||k==='chairUp')return mode==='host'&&(k==='bot'?n<max||max<hi:max<hi);
  if(k==='chairDn')return mode==='host'&&(max>Math.max(2,n)||(V.ps||[]).some(p=>p.b));
  if(k==='clear')return mode==='host';
  const sv=Array.isArray(V.sv)?V.sv:[],spm=+(V.cfg.spec??4);
  if(k==='spec')return myIdx()>=0&&mode!=='host'&&spm>0&&sv.length<spm;
  if(k==='sit')return myIdx()<0&&!!V.spec&&n<max;
  if(k==='leave')return mode!=='host';
  if(k==='rset')return true;
  return false;
}
function frontWaitKey(k){
  if(!frTableUI()||FR.clearing)return;
  const t=clock(),P=[T.hostPad,T.guestPad,T.sitPad].find(Q=>Q.g.visible&&Q.keys.some(x=>x.userData.k===k))||T.hostPad,m=P.keys.find(x=>x.userData.k===k);if(m)m.userData.downAt=t;
  if(k==='clear')return;   // 꾹 누르기로만 (frontClearHold)
  if(!frontWaitCan(k)){sfx('no');return}
  if(k==='spec'){sfx('key');sendAct({t:'spec'});return}
  if(k==='sit'){sfx('key');sendAct({t:'join'});return}
  if(k==='rset'){sfx('key');setTimeout(()=>frontRules(V.cfg.game||'gura',{set:true}),140);return}   // 설정 판자 → 지금 게임의 규칙 판자
  if(k==='leave'){   // 한 번 누르면 디스플레이에 '떠나기', 2.5초 안에 한 번 더 누르면 떠남 
    if(FR.leaveAt&&t-FR.leaveAt<2500){FR.leaveAt=0;FR.word='';sfx('key');leaveRoom();return}
    FR.leaveAt=t;frontWord('떠나기',2500);return}   // 키는 그대로 두고 디스플레이만 바뀜 (탁자 밖을 누를 때처럼 일어서지 않음)
  if(mode!=='host'||!H||H.phase!=='wait'){sfx('no');return}
  const max=+H.cfg.max;
  if(k==='bot'){if(H.members.length>=max)setRoomCfg('max',max+1);hostAddBot();sfx('pick');return}   // 빈 의자가 없으면 의자를 하나 놓고 앉힘
  if(k==='chairUp'){setRoomCfg('max',max+1);sfx('key');return}
  if(k==='chairDn'){   // 빈 의자부터, 없으면 마지막 봇과 그 의자. 사람이 앉은 의자는 빼지 않음
    fixSeats();
    if(max>Math.max(2,H.members.length)){const used=new Set(H.members.map(m=>m.seat));let e=max-1;while(e>0&&used.has(e))e--;dropSeat(e);setRoomCfg('max',max-1);sfx('key');return}   // 뒤쪽 빈 의자를 빼고 앉은 사람은 그대로
    for(let i=H.members.length-1;i>=0;i--)if(H.members[i].bot){const b=H.members.splice(i,1)[0];dropSeat(b.seat);if(max>2)H.cfg={...H.cfg,max:max-1};saveRoomCfg(H.cfg);lastPanelHtml='';mark();sfx('key');return}
    sfx('no');return}
}
/* 상치우기: 꾹 누르고 있으면 키가 점점 빨개지고 1초가 차면 치움. 일찍 떼면 원래 색으로 돌아감. 키보드 Enter·Space는 바로 */
const CLEAR_MS=1000;
function frontClearHold(){
  const b=$('#frH'+FR_HOST.indexOf('clear'));if(!b)return;
  b.addEventListener('pointerdown',e=>{if(FR.clearing)return;if(!frontWaitCan('clear')){sfx('no');return}FR.clearHold=clock();sfx('key');if(FR.humStop)FR.humStop();FR.humStop=hum(CLEAR_MS);frontWord('치우기',CLEAR_MS+400);try{b.setPointerCapture(e.pointerId)}catch(_){}});
  const stop=()=>{if(FR.clearHold&&clock()-FR.clearHold<CLEAR_MS){FR.word=''}FR.clearHold=0;if(FR.humStop){FR.humStop();FR.humStop=null}};
  b.addEventListener('pointerup',stop);b.addEventListener('pointercancel',stop);b.addEventListener('lostpointercapture',stop);
  b.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&frontWaitCan('clear')){e.preventDefault();frontClearGo()}});
}
/* 상치우기 연출: 홀로그램이 한 점으로 빨려 들어가고(FR.collapseAt, CLEAR_SUCK ms) 그 뒤에 탁자를 닫음 */
const CLEAR_SUCK=450;
function frontClearGo(){
  if(FR.clearing||mode!=='host')return;FR.clearing=1;FR.clearP=1;FR.collapseAt=clock();sfx('tableClear');
  setTimeout(()=>{FR.clearing=0;FR.clearP=0;hostClear()},CLEAR_SUCK);
}
/* 상치우기: 모두 내보내고 탁자를 정리. 방장은 앉은 채 첫 자판으로, 참가자는 상이 짧게 흔들리며 첫 자판으로 */
function hostClear(){
  if(mode!=='host'||!H)return;
  for(const c of net.conns){try{c.send({t:'cleared'})}catch(e){}}
  const conns=[...net.conns];net.conns.clear();setTimeout(()=>{for(const c of conns){try{c.close()}catch(e){}}},300);
  H.members=H.members.filter(m=>m.host);H.specs=[];   // 다음 방장에게 넘기지 않음
  leaveRoom();FR.sit=true;FR.kmode='menu';
}
function guestCleared(){
  if(mode!=='guest')return;
  unstore('gura-guest');
  if(!FR.ok){mode='closed';if(net.retry){clearTimeout(net.retry.timer);net.retry=null}showPanel('<h2>상을 치웠습니다</h2><p>방장이 탁자를 정리했습니다.</p><div class="row"><button class="btn btn-play" type="button" data-act="leave" data-auto>로비로</button></div>','gone');return}
  // 참가자: 홀로그램이 빨려 들어가고 이름표가 툭툭 떨어진 뒤, 탁자가 짧게 흔들리며 첫 자판으로
  FR.clearing=1;FR.collapseAt=clock();sfx('tableClear');
  document.querySelectorAll('#labels .wseat').forEach((el,i)=>{el.style.animationDelay=(i*60)+'ms';el.classList.add('drop')});
  setTimeout(()=>{FR.clearing=0;if(mode!=='guest')return;leaveRoom();FR.sit=true;FR.kmode='menu';FR.clearAt=clock();sfx('warpFail')},CLEAR_SUCK+150);
}
