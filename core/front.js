/* index.html 공통 코드 · 첫 화면·대기실(탁자 하나): 의자·디스플레이·자판·상치우기. 파일 순서는 index.html의 <script src> 순서 */
/* ===== 첫 화면·대기실: 탁자 하나 =====
   로비 창 대신 들판의 탁자 하나에서 시작합니다.
   · 첫 화면: 서서 탁자(펠트가 깔림)와 둘레의 나무 기둥 의자만 봄. 탁자를 누르면 다가가 앉음(FR.sit)
   · 앉으면: 내 앞 덮개가 열려 디스플레이·키판(참여하기)이 올라오고, 가운데 구멍에서 상차리기 버튼이 올라옴.
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
const FR_MENU=['create','join','rules'],FR_HOST=['rules','rset','go'],FR_GUEST=['rules','rset','go'];   // 첫 자판(지금은 쓰지 않음: 앉으면 바로 상을 차림), 대기실 자판(게임 규칙·탁자 설정·다른 탁자 참여하기). 봇 추가는 빈 자리 메뉴, 관전하기는 내 이름표 메뉴, 앉기는 빈 자리 메뉴
/* 다른 탁자 참여하기(FR.seek): 대기실에 앉은 채로 공개 탁자 목록 판·숫자 키판을 씀. 실제로 출발할 때만 지금 탁자를 떠남 */
const frSeek=()=>!!(FR.seek&&frTableUI());
const frGoOk=()=>!!(FR.ok&&!FR.warp&&!FR.spread&&((mode==='lobby'&&!net.peer)||frSeek()));
const FR_ROWS=7;   // 공개 탁자 목록 판: 한 쪽에 7줄
const PL_CW=832,PL_CH=1092,PL_Y0=72,PL_STEP=122,PL_RH=108,PL_DOTY=24,PL_BTNY=1014;   // 목록 판 그림 크기와 줄 자리: 맨 위 쪽 표시 점 → 플립 줄 7개 → 바로 아래 단추
const DSP={W:1.7,D:.55,Th:.05,Z:3.85};   // 대기실에 펠트가 없어 안쪽으로 크게 (예전 1.5 × .5, 경첩 3.9). 화면 비율은 캔버스(640×208)와 맞춤, 왼쪽 시작 버튼과 겹치지 않게   // 디스플레이: 폭, 깊이, 두께, 경첩(먼 쪽 끝) 위치
function frontBuild(){
  const TG=T.tableG;
  frontBuildStumps();frontBuildDisplay(TG);frontBuildHolo(TG);frontBuildStart(TG);pouchBuild(TG);
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
    const bot=frontBuildBot(g,SH);
    T.stumps.push({g,a:0,s:0,on:false,bot,bs:0,ani:''});
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
    const r=5.75+(lobby&&k===0?frontChairPull(t):0);   // 첫 화면: 가만히 있으면 의자가 뒤로 빠졌다 돌아옴 (앉으라는 신호)
    S.g.visible=S.s>.01;S.g.scale.setScalar(Math.max(.001,S.s));S.g.position.x=Math.sin(S.a)*r;S.g.position.z=Math.cos(S.a)*r;
    // 봇 자리: 의자 위에 통나무 + 동물 얼굴 종이(투명 테이프). 종이는 탁자 가운데를 봄
    const p=want&&!lobby?stumpWho(k,wait):null,isBot=!!(p&&p.b);
    if(isBot){const an=BOT_ANI[([...String(p.n)].reduce((a,c)=>a*31+c.charCodeAt(0)|0,7)>>>0)%BOT_ANI.length];if(S.ani!==an){S.ani=an;S.bot.paper.material.map=botPaperTex(an);S.bot.paper.material.needsUpdate=true}}
    S.bs+=((isBot?1:0)-S.bs)*f;if(S.bs<.003&&!isBot)S.bs=0;
    S.bot.g.visible=S.bs>.01;S.bot.g.scale.setScalar(Math.max(.001,S.bs)*BOT_K);S.bot.g.rotation.y=S.a+Math.PI-S.g.rotation.y;
    avStump(S,t,dt,isBot?null:p);avBotCrown(S,isBot&&p.cr);   // 사람 자리: 의자 위 나무 인형 (core/avatar.js)
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
  T.menuPad=frontBuildPad(TG,FR_MENU,{w:.48,d:.42,gap:.57,id:'frM',on:frontMenu});
  // 대기실 자판: 방장(봇 추가·탁자 설정·상치우기), 참가자(관전하기·떠나기), 관전자(참여하기·떠나기). 같은 틈에서 나옴
  T.hostPad=frontBuildPad(TG,FR_HOST,{w:.48,d:.42,gap:.57,id:'frH',on:frontWaitKey});
  T.guestPad=frontBuildPad(TG,FR_GUEST,{w:.48,d:.42,gap:.57,id:'frG',on:frontWaitKey});   // 방장이 바뀌면 방장 자판이 들어가고 같은 틈에서 참가자 자판이 올라옴
  T.sitPad=frontBuildPad(TG,FR_GUEST,{w:.48,d:.42,gap:.57,id:'frS',on:frontWaitKey});
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
const PAD_NAME={create:'상차리기',join:'참여하기',bot:'봇 추가',clear:'상치우기 (꾹 누르기)',spec:'관전하기',sit:'참여하기',rules:'게임 규칙',rset:'탁자 설정·규칙',leave:'탁자 떠나기 (두 번 누르기)',go:'다른 탁자 참여하기'};
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
  // 상 그림: 기호가 위에서 윗면 테두리를 끊고 지나감
  if(k==='create'){table();mark(96,26,18,true)}
  else if(k==='clear'){table();mark(96,42,22,false)}
  else if(k==='join'||k==='sit'){L(11,122,24,146,24,146,104,122,104);L(11,40,64,116,64);L(11,92,40,118,64,92,88)}
  else if(k==='go'){L(11,70,24,46,24,46,104,70,104);L(11,76,64,152,64);L(11,128,40,152,64,128,88)}   // 다른 탁자 참여하기([→): 문틀을 나서 밖으로
  else if(k==='leave'){L(11,122,24,146,24,146,104,122,104);L(11,40,64,116,64);L(11,64,40,38,64,64,88)}   // 참여하기(→])와 같은 문틀, 화살표 방향만 반대(←]): 문 밖으로 나감
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
  const max=+V.cfg.max,n=(V.ps||[]).length;
  if(k==='bot')return mode==='host'&&n<max;   // 빈 자리가 없으면 못 누름 (최대 인원은 탁자 설정에서)
  if(k==='clear')return mode==='host';
  const sv=Array.isArray(V.sv)?V.sv:[],spm=+(V.cfg.spec??4);
  if(k==='spec')return myIdx()>=0&&mode!=='host'&&spm>0&&sv.length<spm;
  if(k==='sit')return myIdx()<0&&!!V.spec&&!V.nj&&n<max;   // V.nj: 라운드 중 도중 참가 막음 (대부호)
  if(k==='leave')return mode!=='host';
  if(k==='rset'||k==='go'||k==='rules')return true;
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
  if(k==='rules'){sfx('key');setTimeout(()=>frontRules('list'),140);return}   // 게임 목록 규칙 판자 (모든 게임)
  if(k==='go'){sfx('key');frontWord('참여하기',1200);FR.seek=true;FR.kmode='menu';FR.buf='';FR.pub=null;frontList(true);return}   // 자판이 들어가고 같은 틈에서 공개 탁자 목록 판
  if(k==='leave'){   // 한 번 누르면 디스플레이에 '떠나기', 2.5초 안에 한 번 더 누르면 떠남 
    if(FR.leaveAt&&t-FR.leaveAt<2500){FR.leaveAt=0;FR.word='';sfx('key');frontLeave();return}
    FR.leaveAt=t;frontWord('떠나기',2500);return}   // 키는 그대로 두고 디스플레이만 바뀜 (탁자 밖을 누를 때처럼 일어서지 않음)
  if(mode!=='host'||!H||H.phase!=='wait'){sfx('no');return}
  if(k==='bot'){hostAddBot();sfx('pick');return}
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
/* 참여하기 끝: 목록 판·키판이 들어가고 대기실 자판이 다시 나옴 */
function frontSeekEnd(){FR.seek=false;FR.list=false;FR.kmode='menu';FR.buf='';FR.pub=null;FR.backAt=0;FR.leanOn=false}
/* 찾아가며 출발: 지금 탁자를 떠나되 앉은 채로 (방장이면 다른 사람에게 넘어감) */
function frontSeekLeave(){if(!frSeek())return;frontSeekEnd();leaveRoom();FR.sit=true}
function frontJoin(code){frontSeekLeave();joinRoom(code)}
/* 첫 화면에서 앉거나, 다른 탁자로 못 갔거나, 상을 치우면: 바로 내 탁자를 차림 (번호는 매번 새로, 공개 여부·번호 보이기는 기본 비공개) */
function frontMakeHome(){hideCode=true;store('gura-hidecode','1');createRoom()}
/* 참가자가 탁자를 떠남: 탁자에 들어갈 때처럼 타임머신을 타고 내 탁자로 */
function frontLeave(){const home=FR.ok&&mode==='guest';leaveRoom();if(home)frontGoHome()}
function frontGoHome(){if(!FR.ok||mode!=='lobby'||net.peer)return;FR.sit=true;frontWarpStart('');FR.mkAt=clock();frontMakeHome()}
/* 닉네임 바꾸기 (첫 화면 이름표·대기실 내 이름표). 대기실이면 이름표도 바로 바뀜 */
function frontSetNick(v){
  v=String(v||'').trim().slice(0,10)||DEF_NICK;if(v===myNick())return;
  $('#inNick').value=v;saveNick();frontNick();const s=$('#nickShow');if(s)s.textContent=v;document.querySelectorAll('.nickShow2').forEach(e=>e.textContent=v);
  auProfSave({nick:myNick()});   // 로그인했으면 계정에도 (core/auth.js)
  auSelf();
}
/* 친구 초대: 휴대폰은 공유 창, 아니면 초대 링크 복사(디스플레이에 '복사') */
function frontInvite(){
  if(!frWaitV()||!V.code)return;
  const link=roomLink(String(V.code)),ok=()=>{frontWord('복사',1400);sfx('pick')};
  const copy=()=>{if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(link).then(ok,()=>sfx('no'));else sfx('no')};
  if(navigator.share&&matchMedia('(pointer:coarse)').matches){navigator.share({title:__('탁자하나'),text:__('{0}에 앉으러 오십시오.',V.title||__('탁자')),url:link}).catch(e=>{if(e&&e.name!=='AbortError')copy()});return}
  copy();
}
/* 의자 자리 k에 앉은 사람(대기실은 자리 번호, 게임 중은 사람 순서) */
function stumpWho(k,wait){const ps=(V&&V.ps)||[];if(!wait)return ps[k]||null;return ps.find((p,i)=>(p.st!=null?p.st:i)===k)||null}
/* 첫 화면 의자 신호: 아무것도 안 하고 4초가 지나면 7초마다 의자가 뒤로 쓱 빠졌다(0.5초) 잠깐 멈추고 돌아옴(0.6초) */
['pointerdown','keydown','wheel'].forEach(ev=>window.addEventListener(ev,()=>{FR.actAt=clock()},{passive:true,capture:true}));
function frontChairPull(t){
  if(FR.sit||FR.warp||FR.stand<.98||mode!=='lobby')return 0;
  const idle=t-Math.max(FR.actAt||0,FR.standAt||0);if(idle<4000)return 0;
  const p=(idle-4000)%7000,A=.6;
  if(p<500)return A*smooth(p/500);if(p<1300)return A;if(p<1900)return A*(1-smooth((p-1300)/600));return 0;
}
/* 펠트: 펠트가 필요한 게임이 시작되면 가운데 점에서 커지고, 대기실·첫 화면으로 돌아오면 점으로 줄어 사라짐 */
function frontFelt(t,lobby){
  const fg=T.felt&&T.felt.g;if(!fg)return;
  const want=!lobby&&!!(V&&V.st&&V.st!=='wait')&&gameFelt(V.cfg&&V.cfg.game)?1:0;
  if(FR.fa.to!==want&&want)sfx('cloth');
  const k=smooth(frontTween(FR.fa,want,t,want?700:450)),s=Math.max(.001,k);
  fg.scale.set(s,1,s);fg.visible=k>.002;
}
/* 봇: 통나무(의자 위에 세움) + 동물 얼굴을 그린 종이 + 투명 테이프. 테스트룸(lab-doll.html) '봇 · 통나무' 그대로 */
const BOT_ANI=['rabbit','bear','cat','fox'],BOT_ANI_C={rabbit:'#f6ecd8',bear:'#b9824f',cat:'#f2c14e',fox:'#f2994a'},BOT_TEX={};
function botPaperTex(a){
  if(BOT_TEX[a])return BOT_TEX[a];
  return BOT_TEX[a]=canvasTex(160,176,(g,w,h)=>{
    g.fillStyle='#fffdf6';g.fillRect(0,0,w,h);g.fillStyle=BOT_ANI_C[a];g.strokeStyle='#2a2420';g.lineWidth=5;g.lineJoin='round';
    const cx=w/2,cy=h*.6,r=w*.3;
    for(const k of[-1,1]){g.beginPath();
      if(a==='rabbit')g.ellipse(cx+k*r*.45,cy-r*1.45,r*.22,r*.7,k*.12,0,7);
      else if(a==='bear')g.arc(cx+k*r*.75,cy-r*.75,r*.33,0,7);
      else{g.moveTo(cx+k*r*.25,cy-r*.85);g.lineTo(cx+k*r*.85,cy-r*(a==='fox'?1.6:1.35));g.lineTo(cx+k*r*.98,cy-r*.3);g.closePath()}
      g.fill();g.stroke()}
    g.beginPath();g.arc(cx,cy,r,0,7);g.fill();g.stroke();
    const s=28;g.fillStyle=g.strokeStyle='#2a2420';g.lineCap='round';g.lineWidth=Math.max(2,s*.09);   // 웃는 얼굴
    for(const k of[-1,1]){g.beginPath();g.arc(cx+k*s*.42,cy-s*.12,s*.1,0,7);g.fill()}
    g.beginPath();g.arc(cx,cy+s*.12,s*.26,.15*Math.PI,.85*Math.PI);g.stroke();
  });
}
const BOT_K=1.3;   // 봇 통나무 크기: 사람 인형(AV_K)과 같게 키워 종이 얼굴이 탁자 위로 보이게 (탁자 윗면은 의자 위 1.25)
function frontBuildBot(stump,SH){
  const g=new THREE.Group();g.position.y=SH;g.scale.setScalar(.001);g.visible=false;stump.add(g);
  const LH=1.6,log=new THREE.Mesh(new THREE.CylinderGeometry(.3,.32,LH,14),toon({color:0x7b5534}));log.position.y=LH/2;log.castShadow=true;g.add(log);hull(new THREE.CylinderGeometry(.33,.35,LH+.03,14),log,g);
  const top=new THREE.Mesh(new THREE.CircleGeometry(.3,14),toon({color:0xd9b07a}));top.rotation.x=-Math.PI/2;top.position.y=LH+.002;g.add(top);
  const paper=new THREE.Mesh(new THREE.PlaneGeometry(.4,.44),toon({map:botPaperTex('rabbit'),rim:0}));paper.position.set(0,LH-.38,.325);paper.rotation.z=.06;g.add(paper);
  const tape=new THREE.Mesh(new THREE.PlaneGeometry(.2,.075),new THREE.MeshBasicMaterial({color:0xfff3c4,transparent:true,opacity:.55}));tape.position.set(.01,LH-.165,.328);tape.rotation.z=-.1;g.add(tape);
  return {g,paper,h:LH};
}
