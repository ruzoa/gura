/* index.html 공통 코드 · 로그인(구글)·도토리. 파일 순서는 index.html의 <script src> 순서 */
/* ===== 로그인·도토리 =====
   · 꺼짐: FB_CONF가 비어 있으면 모두 꺼짐(로그인·g. 표시·복주머니 없음, 지금과 같음). 켜는 방법은 docs/login.md
   · 게스트: 로그인 없이 그대로 놂. 닉네임 앞에 작고 흐린 'g.'(방장이 붙임). 아바타는 모양(종류·동물)만, 장식·색칠은 잠김
   · 구글 로그인: 처음 로그인하면 탁자에서 쓸 이름을 정함(구글 이름은 쓰지 않음). 닉네임·아바타·칠한 그림·도토리가 계정에 저장됨(users/{uid})
   · 방장 확인: 로그인한 사람은 자기 PeerJS 번호를 peers/{uid}에 적고(본인만 쓸 수 있음), hello에 uid를 실음.
     방장은 peers/{uid}를 읽어 연결 번호와 같을 때만 g.를 뗌(남의 uid를 대도 번호가 달라 통과 못 함)
   · 도토리: 판이 끝나면(결과 화면) 끝까지 한 사람 1개, 왕관(1등)이면 1개 더. 하루(한국 시각) 30개까지, 받은 뒤 1분 안에는 다시 못 받음.
     같은 제한을 Firestore 보안 규칙(firebase/firestore.rules)이 지킴. 서버가 없어서 게임 결과 자체는 확인하지 못함(돈이 오가지 않는 동안은 받아들임)
   · Firebase SDK는 로그인한 적이 있거나 로그인을 누르거나 방장이 확인할 때만 받음(게스트는 받지 않음) */
const FB_CONF={apiKey:'',authDomain:'',projectId:'',appId:''};   // Firebase 콘솔 → 프로젝트 설정 → 웹 앱의 값을 넣으면 켜짐
const FB_VER='10.12.2';
const AUTH_ON=!!((FB_CONF.apiKey&&FB_CONF.projectId)||window.AUTH_MOCK);
const ACORN_DAY=30,ACORN_GAP=60e3;
const AU={user:null,prof:null,fb:null,loading:null,busy:false,err:'',step:'',peerSent:'',save:{},saveT:0,gain:0,open:false,from:'',awarding:false};
const auLocked=()=>AUTH_ON&&!AU.user;
const kstDay=ms=>Math.floor((ms+9*3600e3)/86400e3);
/* 닉네임 앞 g.: 방장이 게스트에게 붙임. 직접 g.로 시작하는 이름은 쓸 수 없음 */
const auTag=(raw,ok)=>AUTH_ON&&!ok?'g.'+raw:raw;
const myTagNick=()=>auTag(myNick(),!!AU.user);
function nmH(n){n=String(n==null?'':n);return AUTH_ON&&n.startsWith('g.')?`<i class="gtag">g.</i>${esc(n.slice(2))}`:esc(n)}
/* ---- Firebase (필요할 때만 받음) ---- */
function auFb(){
  if(window.AUTH_MOCK)return Promise.resolve(AU.fb=window.AUTH_MOCK);
  if(AU.fb)return Promise.resolve(AU.fb);
  if(AU.loading)return AU.loading;
  const u=n=>`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-${n}.js`;
  AU.loading=Promise.all([import(u('app')),import(u('auth')),import(u('firestore'))]).then(([A,B,C])=>{
    const app=A.initializeApp(FB_CONF),auth=B.getAuth(app),db=C.getFirestore(app);
    const ms=v=>v&&v.toMillis?v.toMillis():+v||0;
    const fix=d=>d?{...d,at:ms(d.at)}:null;
    return AU.fb={
      onUser:cb=>B.onAuthStateChanged(auth,cb),
      login:()=>B.signInWithPopup(auth,new B.GoogleAuthProvider()),
      logout:()=>B.signOut(auth),
      get:p=>C.getDoc(C.doc(db,p)).then(s=>s.exists()?fix(s.data()):null),
      put:(p,d,stamp)=>C.setDoc(C.doc(db,p),stamp?{...d,at:C.serverTimestamp()}:d,{merge:true}),
      award:(uid,gain)=>C.runTransaction(db,async tx=>{
        const ref=C.doc(db,'users/'+uid),s=await tx.get(ref);if(!s.exists())return null;
        const d=fix(s.data()),now=Date.now();if(now-d.at<ACORN_GAP)return null;
        const n=kstDay(d.at)===kstDay(now)?d.dayN:0,g=Math.min(gain,ACORN_DAY-n);if(g<=0)return null;
        tx.update(ref,{acorn:d.acorn+g,dayN:n+g,at:C.serverTimestamp()});return {...d,acorn:d.acorn+g,dayN:n+g,at:now,got:g};
      })
    };
  }).catch(e=>{AU.loading=null;throw e});
  return AU.loading;
}
function auStart(){
  if(!AUTH_ON)return;
  if(store('gura-login')==='1'||window.AUTH_MOCK)auWatch();   // 로그인한 적이 있으면 바로 받아서 로그인 상태를 되살림
}
function auWatch(){
  if(AU.watching)return auFb();AU.watching=true;
  return auFb().then(fb=>{fb.onUser(u=>auUser(u))}).catch(()=>{AU.watching=false;AU.err='net';auTagDraw()});
}
function auUser(u){
  const was=AU.user&&AU.user.uid;AU.user=u||null;
  if(!u){store('gura-login','');AU.prof=null;AU.peerSent='';AU.step='';if(was){avPush();auSelf()}auTagDraw();return}
  store('gura-login','1');
  if(was===u.uid)return;
  auLoadProf(u).catch(()=>{AU.err='net';auTagDraw()});
}
async function auLoadProf(u){
  const fb=await auFb();let p=await fb.get('users/'+u.uid);
  const lav=store('gura-avatar')||'',lp=store('gura-avatar-paint')||'';
  if(!p){p={nick:'',av:lav,paint:lp.length<=60000?lp:'',acorn:0,dayN:0};await fb.put('users/'+u.uid,p,true);p.at=Date.now()}
  if(!AU.user||AU.user.uid!==u.uid)return;
  AU.prof=p;
  if(p.av&&p.av!==lav&&avParse(p.av)){store('gura-avatar',p.av);AV.mine=null}
  if(typeof p.paint==='string'&&p.paint!==lp){store('gura-avatar-paint',p.paint);AV.mine=null;AV.hasPaint=false;AV.pid='';AV.pdata='';AV.ver++;avPaintCv().getContext('2d').clearRect(0,0,AV_TW,AV_TW)}
  avMine();
  if(p.nick)frontSetNick(p.nick);else{AU.step='nick';AU.open=true;sfx('paper')}   // 처음 로그인: 탁자에서 쓸 이름 정하기
  auPeer();avPush();auSelf();auTagDraw();
}
/* 내 이름표: 방장이면 내 이름의 g.를 바로 고치고, 참가자면 다시 인사(방장이 다시 확인) */
function auSelf(){
  if(mode==='host'&&H&&H.phase==='wait'){const m=H.members.find(x=>x.host);if(m){const n=myTagNick();if(H.firstName===m.name)H.firstName=n;m.name=n;mark()}}
  else if(mode==='guest'&&net.conn&&net.conn.open&&V&&V.st==='wait')guestHello(net.conn);
}
/* 내 PeerJS 번호를 계정에 적음 (방장이 이걸로 확인) */
function auPeer(){
  const id=net.peer&&net.peer.id;
  if(!AU.user||!id||AU.peerSent===id)return;AU.peerSent=id;
  auFb().then(fb=>fb.put('peers/'+AU.user.uid,{peer:id},true)).catch(()=>{AU.peerSent=''});
}
/* 계정에 저장 (모아서 1.5초 뒤 한 번) */
function auProfSave(d){
  if(!AU.user||!AU.prof)return;
  Object.assign(AU.prof,d);Object.assign(AU.save,d);clearTimeout(AU.saveT);
  AU.saveT=setTimeout(()=>{const s=AU.save;AU.save={};if(AU.user)auFb().then(fb=>fb.put('users/'+AU.user.uid,s,false)).catch(()=>{})},1500);
}
/* ---- 방장: 들어온 사람 확인 ---- */
const auUidOf=d=>AUTH_ON&&typeof d.uid==='string'&&/^[A-Za-z0-9_-]{6,64}$/.test(d.uid)?d.uid:'';
function auHostVerify(conn,uid,tries=0){
  auFb().then(fb=>fb.get('peers/'+uid)).then(d=>{
    if(!H||mode!=='host'||!net.conns.has(conn)||conn.__uid!==uid)return;
    if(d&&d.peer===conn.peer){conn.__lg=uid;auHostName(conn);return}
    if(tries<3)setTimeout(()=>auHostVerify(conn,uid,tries+1),1200*(tries+1));   // 아직 적는 중일 수 있음
  }).catch(()=>{});
}
function auHostName(conn){
  const raw=conn.__nick;if(!raw||!H)return;
  if(H.phase==='wait'){const m=H.members.find(x=>x.conn===conn);if(m){if(H.firstName===m.name)H.firstName=raw;m.name=raw}}
  const sp=(H.specs||[]).find(x=>x.conn===conn);if(sp)sp.name=raw;
  mark();
}
/* ---- 도토리: 판이 끝나면 ---- */
function auGameEnd(pv,v){
  if(!AU.user||!AU.prof||!pv||!v||v.st!=='over'||pv.st==='over'||pv.st==='wait'||v.spec||!(v.you>=0))return;
  const p=v.ps&&v.ps[v.you];if(!p||p.b||p.dz||p.sr)return;   // 항복·시간 초과·탈주는 없음
  const gain=1+(p.cr?1:0),now=Date.now(),P=AU.prof;
  if(now-(P.at||0)<ACORN_GAP||AU.awarding)return;
  if(kstDay(P.at||0)===kstDay(now)&&P.dayN>=ACORN_DAY)return;
  AU.awarding=true;
  auFb().then(fb=>fb.award(AU.user.uid,gain)).then(r=>{
    AU.awarding=false;if(!r||!AU.prof)return;
    Object.assign(AU.prof,{acorn:r.acorn,dayN:r.dayN,at:r.at});AU.gain+=r.got;auTagDraw();
  }).catch(()=>{AU.awarding=false});
}
/* ---- 앱 안 브라우저(카카오톡 등): 구글이 로그인을 막음 → 바깥 브라우저로 ---- */
const auUA=navigator.userAgent||'';
const auInApp=()=>/KAKAOTALK|Instagram|FBAN|FBAV|\bLine\/|NAVER\(inapp|DaumApps|everytimeApp|; wv\)/i.test(auUA);
function auOpenOut(){
  const u=location.href;
  if(/KAKAOTALK/i.test(auUA)){location.href='kakaotalk://web/openExternal?url='+encodeURIComponent(u);return}
  if(/Android/i.test(auUA)){location.href='intent://'+u.replace(/^https?:\/\//,'')+'#Intent;scheme=https;package=com.android.chrome;end';return}
  try{navigator.clipboard.writeText(u).then(()=>{AU.err='copied';auTagDraw()})}catch(e){}
}
function auLogin(){
  if(AU.busy)return;
  if(auInApp()){AU.err='inapp';auTagDraw();return}
  AU.busy=true;AU.err='';auTagDraw();
  auWatch().then(fb=>fb.login()).then(()=>{AU.busy=false;auTagDraw()}).catch(e=>{AU.busy=false;AU.err=e&&/popup-closed|cancelled/.test(String(e.code||e))?'':'fail';auTagDraw()});
}
function auLogout(){
  if(!AU.user)return;
  auFb().then(fb=>fb.logout()).catch(()=>{});AU.open=false;auTagDraw();sfx('pick');
}
/* ---- 나무 꼬리표 (복주머니를 누르거나, 잠긴 꾸미기를 누르면) ---- */
function auTagOpen(from){
  if(!AUTH_ON)return;
  if(AU.open&&AU.from===from){auTagClose();return}   // 다시 누르면 닫힘
  AU.open=true;AU.from=from||'';AU.err='';sfx('paper');auTagDraw();
}
function auTagClose(){if(!AU.open)return;if(AU.step==='nick'&&AU.user)return;AU.open=false;auTagDraw();sfx('paper')}
function auTagDraw(){
  const el=$('#acTag');if(!el)return;
  el.hidden=!AU.open;if(!AU.open)return;
  const u=AU.user,P=AU.prof;let h='';
  const G_SVG='<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.6 13.3l7.9 6.2C12.4 13.7 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.1 5.5c4.2-3.9 7.2-9.6 7.2-16.9z"/><path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.2C1 16.5 0 20.1 0 24s1 7.5 2.6 10.8l7.9-6.2z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.1-5.5c-2.2 1.5-5 2.3-8.8 2.3-6.3 0-11.6-4.2-13.5-10l-7.9 6.2C6.6 42.6 14.6 48 24 48z"/></svg>';
  if(!u){
    if(AU.err==='inapp'){
      h=`<p>이 앱 안에서는 구글 로그인을 할 수 없습니다. Chrome이나 Safari에서 열어 주세요.</p><button type="button" class="ac-btn" data-ac="out">${/KAKAOTALK|Android/i.test(auUA)?'다른 브라우저로 열기':'주소 복사'}</button>`;
    }else{
      h=`<p>${AU.from==='av'?'로그인하면 아바타를 꾸밀 수 있습니다.':'로그인하면 도토리를 모으고 아바타를 꾸밀 수 있습니다.'}</p>`+
        `<button type="button" class="ac-g" data-ac="login"${AU.busy?' disabled':''}>${G_SVG}<span>${AU.busy?'로그인 중…':'Google로 로그인'}</span></button>`+
        (AU.err==='fail'||AU.err==='net'?'<small class="ac-err">로그인하지 못했습니다. 잠시 뒤 다시 해 주세요.</small>':AU.err==='copied'?'<small>주소를 복사했습니다.</small>':'');
    }
  }else if(AU.step==='nick'){
    h=`<p>탁자에서 쓸 이름을 정해 주세요.</p><form class="ac-nick" data-ac="nickf"><input id="acNick" maxlength="10" autocomplete="off" enterkeyhint="done" value="${esc(myNick()==='나'?'':myNick())}" placeholder="이름"><button type="submit" class="ac-btn">정하기</button></form>`;
  }else if(!P){
    h='<p>불러오는 중…</p>';
  }else{
    const today=kstDay(P.at||0)===kstDay(Date.now())?P.dayN:0;
    h=`<div class="ac-n"><svg class="ac-ico" viewBox="0 0 32 32" aria-hidden="true"><ellipse cx="16" cy="20" rx="8.5" ry="9.5" fill="#c98a4b"/><path d="M6 13c0-5 4.5-8 10-8s10 3 10 8c0 1.2-.8 2-2 2H8c-1.2 0-2-.8-2-2z" fill="#6b4423"/><path d="M16 5V2" stroke="#6b4423" stroke-width="2.4" stroke-linecap="round"/></svg><b>${P.acorn|0}</b></div>`+
      `<small>오늘 받은 도토리 ${today}/${ACORN_DAY}</small><button type="button" class="ac-out" data-ac="logout">로그아웃</button>`;
  }
  el.innerHTML=h;
  if(AU.step==='nick'){const i=$('#acNick');if(i&&document.activeElement!==i)setTimeout(()=>{try{i.focus()}catch(e){}},60)}
}
$('#acTag').addEventListener('click',e=>{
  e.acHit=true;const b=e.target.closest('[data-ac]');if(!b)return;
  const k=b.dataset.ac;
  if(k==='login')auLogin();else if(k==='logout')auLogout();else if(k==='out')auOpenOut();
});
$('#acTag').addEventListener('submit',e=>{
  e.preventDefault();const i=$('#acNick'),v=String(i&&i.value||'').trim().replace(/^g\./i,'').slice(0,10);
  if(!v){sfx('no');return}
  AU.step='';frontSetNick(v);auProfSave({nick:myNick()});sfx('pick');auTagDraw();
});
document.addEventListener('click',e=>{if(AU.open&&!e.acHit&&!e.pouchHit)auTagClose()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&AU.open)auTagClose()});
/* 꼬리표 자리: 복주머니가 보이면 그 위, 아니면 화면 아래 가운데 */
function auTagPlace(rect,W,Hh){
  const el=$('#acTag');if(!AU.open||el.hidden)return;
  const w=el.offsetWidth||220,h=el.offsetHeight||120;let x,y;
  if(rect){x=(rect.l+rect.r)/2-w/2;y=rect.t-h-12}else{x=W/2-w/2;y=Hh-h-90}
  x=Math.max(8,Math.min(W-w-8,x));y=Math.max(8,Math.min(Hh-h-8,y));
  const k=Math.round(x)+','+Math.round(y);if(el.dataset.p!==k){el.dataset.p=k;el.style.left=Math.round(x)+'px';el.style.top=Math.round(y)+'px'}
}
