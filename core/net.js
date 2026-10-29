/* index.html 공통 코드 · 네트워크(PeerJS): 방 열기·참가·관전·재접속·방장 이양·공개 탁자 찾기. 파일 순서는 index.html의 <script src> 순서 */
/* ================= 네트워크 (PeerJS) ================= */
function cleanNick(n){return (typeof n==='string'&&n.trim()?n.trim():'손님').slice(0,10)}
function hostConn(conn){
  if(!H||mode!=='host'){conn.on('open',()=>{try{conn.close()}catch(e){}});return}   // 이미 방을 떠난 방장
  conn.on('open',()=>{net.conns.add(conn)});
  conn.on('data',d=>{
    if(!H||!d||typeof d!=='object')return;
    net.conns.add(conn);
    if(d.t==='hello'){
      const nick=cleanNick(d.nick),cid=typeof d.cid==='string'?d.cid.slice(0,40):'';
      if(cid&&(H.banned||[]).includes(cid)){net.conns.delete(conn);try{conn.send({t:'kicked'})}catch(e){}setTimeout(()=>{try{conn.close()}catch(e){}},300);return}
      const take=x=>{if(x.conn&&x.conn!==conn){net.conns.delete(x.conn);try{x.conn.close()}catch(e){}}x.conn=conn};
      H.specs=H.specs||[];
      let m=H.members.find(m=>m.conn===conn);
      if(!m&&cid){m=H.members.find(x=>!x.bot&&!x.host&&x.cid===cid);if(m){take(m);m.away=false}}
      if(!m){const sp=H.specs.find(x=>x.conn===conn)||(cid?H.specs.find(x=>x.cid===cid):null);if(sp){take(sp);mark();return}}   // 다시 연결한 관전자
      if(m){if(H.phase==='wait')m.name=nick}
      else if(H.phase==='wait'&&!d.sp&&H.members.length<H.cfg.max){H.members.push({name:nick,bot:false,conn,cid,host:false});addLog(`${nick} 입장`,'sys')}
      else if(H.phase==='wait'){if(!hostAddSpec(conn,nick,cid))return}
      if(H.phase!=='wait'){
        const pl=cid?H.players.find(x=>x.cid===cid&&!x.host):null;
        if(pl){
          const back=pl.away||pl.conn!==conn;take(pl);pl.bot=false;pl.away=false;
          if(pl.deserter&&!pl.finished&&pl.dzWhy!=='out'){pl.deserter=false;pl.dzLog=0}   // 항복 처리 전에 돌아오면 탈주 취소
          if(!m)H.members.push({name:pl.name,bot:false,conn,cid,host:false});
          if(back)addLog(`${pl.name} 다시 연결됨`,'sys');
        }else if(!m){if(!hostAddSpec(conn,nick,cid))return}
      }
      mark();return;
    }
    if(d.t==='out'){conn.__out=true;return}   // '탁자 떠나기'를 누름: 곧 닫히는 연결을 탈주로 처리
    {const sp=specOf(conn);
     if(sp){if(d.t==='join')hostJoinSpec(conn,d.seat);return}}   // 관전자는 이모티콘을 보낼 수 없음
    if(d.t==='spec'){hostToSpec(conn);return}
    hostAct(seatOfConn(conn),d);
  });
  const gone=()=>{
    if(!net.conns.has(conn)||!H)return;
    net.conns.delete(conn);
    {const sk=(H.specs||[]).findIndex(x=>x.conn===conn);if(sk>=0)H.specs.splice(sk,1)}
    const mi=H.members.findIndex(m=>m.conn===conn);
    if(mi>=0){
      const m=H.members[mi];
      if(H.phase==='wait'){m.conn=null;m.away=true;m.awayAt=clock();addLog(`${m.name} 연결 끊김`,'sys')}   // 30초 안에 돌아오면 그대로
      else H.members.splice(mi,1);
    }
    const pl=H.players.find(x=>x.conn===conn&&!x.bot);
    if(pl&&H.phase!=='wait'){
      pl.bot=true;pl.conn=null;pl.away=true;pl.awayAt=clock();
      if(conn.__out&&H.phase!=='over')desertSeat(H.players.indexOf(pl),'out');
      else addLog(H.phase!=='over'?`${pl.name} 연결 끊김. 45초 안에 돌아오지 않으면 탈주입니다.`:`${pl.name} 연결 끊김`,'sys');
      if(H.phase==='play'&&H.players[H.turn]===pl)H.botActAt=Math.max(clock(),H.graceUntil)+800;
    }
    mark();
  };
  conn.on('close',gone);conn.on('error',gone);
}
function hostKick(i){
  const m=H.members[i];if(!m||m.host)return;
  H.members.splice(i,1);
  if(!m.bot){
    if(m.cid)H.banned=[...new Set([...(H.banned||[]),m.cid])];
    const c=m.conn;
    if(c){net.conns.delete(c);try{c.send({t:'kicked'})}catch(e){}setTimeout(()=>{try{c.close()}catch(e){}},300)}
    addLog(`${m.name} 님을 내보냈습니다.`,'sys');
  }
  mark();
}
/* 관전: 손패가 없는 자리. 게임 중이거나 방이 가득 차면 관전으로 들어옴 (방장이 정한 인원까지) */
const specMax=()=>Math.max(0,Math.min(8,Math.round(+(H.cfg.spec??4))||0));
function specOf(conn){return H&&H.specs?H.specs.find(x=>x.conn===conn)||null:null}
function hostAddSpec(conn,nick,cid){
  H.specs=H.specs||[];
  if(H.specs.length>=specMax()){net.conns.delete(conn);try{conn.send({t:'full'})}catch(e){}setTimeout(()=>{try{conn.close()}catch(e){}},300);return false}
  H.specs.push({name:nick,cid,conn});addLog(`${nick} 관전 입장`,'sys');return true;
}
function hostToSpec(conn){   // 대기실의 참가자 → 관전
  if(!H||H.phase!=='wait')return;
  const i=H.members.findIndex(m=>m.conn===conn&&!m.host&&!m.bot);if(i<0)return;
  H.specs=H.specs||[];if(H.specs.length>=specMax())return;
  const m=H.members.splice(i,1)[0];H.specs.push({name:m.name,cid:m.cid||'',conn});
  addLog(`${m.name} 관전으로 이동`,'sys');mark();
}
function hostJoinSpec(conn,seat){   // 관전 → 참가 (대기실이나 게임이 끝난 뒤 빈 자리가 있을 때)
  if(!H||(H.phase!=='wait'&&H.phase!=='over'))return;
  const k=(H.specs||[]).findIndex(x=>x.conn===conn);if(k<0||H.members.length>=H.cfg.max)return;
  const sp=H.specs.splice(k,1)[0],nm={name:sp.name,bot:false,conn,cid:sp.cid,host:false};
  if(H.phase==='wait'&&Number.isInteger(seat)&&seat>=0&&seat<H.cfg.max&&!H.members.some(x=>x.seat===seat))nm.seat=seat;   // 고른 빈 자리에 앉음
  H.members.push(nm);
  addLog(H.phase==='over'?`${sp.name} 다음 판 참가`:`${sp.name} 참가`,'sys');mark();
}
function hostKickSpec(k){
  const sp=(H.specs||[])[k];if(!sp)return;H.specs.splice(k,1);
  if(sp.cid)H.banned=[...new Set([...(H.banned||[]),sp.cid])];
  const c=sp.conn;if(c){net.conns.delete(c);try{c.send({t:'kicked'})}catch(e){}setTimeout(()=>{try{c.close()}catch(e){}},300)}
  addLog(`${sp.name} 님을 내보냈습니다.`,'sys');mark();
}
function noPeerLib(){return typeof Peer==='undefined'}
function setNote(id,txt,warn){const el=$(id);el.textContent=txt;el.className='note'+(warn?' warn':'');if(id==='#resumeNote')$('#frNote').textContent=txt}

/* 방장이 새로고침하거나 앱이 꺼졌다 켜지면: 저장해 둔 방 상태로 같은 코드의 방을 다시 열고, 참가자들은 자동으로 다시 붙음 */
function hostPeerHandlers(peer){
  peer.on('connection',hostConn);
  peer.on('disconnected',()=>{if(mode==='host'&&net.peer===peer&&!peer.destroyed){try{peer.reconnect()}catch(e){}}});
}
function restoreHost(sv,tries){
  const code=sv.H.code;
  setNote('#resumeNote',`${String(code).toUpperCase()} 탁자를 다시 차리는 중입니다…`);
  const peer=new Peer(PEER_PREFIX+code);let ok=false;
  peer.on('open',()=>{
    ok=true;net.peer=peer;mode='host';
    H=sv.H;H.specs=[];   // 관전자는 다시 연결되면 다시 들어옴
    const d=clock()-(+sv.ck||0);   // 꺼져 있던 동안은 시간을 멈춘 것으로 처리
    for(const k of ['deadline','graceUntil'])if(typeof H[k]==='number')H[k]+=d;
    if(H.botActAt)H.botActAt+=d;
    H.dealUntil=0;
    const t=clock();
    for(const m of H.members){m.conn=null;if(!m.bot&&!m.host){m.away=true;m.awayAt=t}}
    for(const pl of H.players||[]){pl.conn=null;if(pl.away&&typeof pl.awayAt==='number')pl.awayAt+=d;if(!pl.bot&&!pl.host){pl.bot=true;pl.away=true;pl.awayAt=t}}
    EG().engine.restore(d);
    addLog('방장이 다시 연결했습니다.','sys');
    enterRoom();setNote('#resumeNote','');mark();
  });
  hostPeerHandlers(peer);
  peer.on('error',e=>{
    if(ok)return;
    try{peer.destroy()}catch(_){}
    // 방금 끊긴 이전 연결이 아직 코드를 잡고 있으면 잠시 뒤 다시 시도
    if((e.type==='unavailable-id'||e.type==='network'||e.type==='server-error'||e.type==='socket-error')&&tries<20){setTimeout(()=>{if(mode==='lobby')restoreHost(sv,tries+1)},2000);return}
    unstore('gura-host');setNote('#resumeNote','이전 탁자를 다시 차리지 못했습니다.',true);
  });
}
let createTries=0;
function createRoom(){
  if(noPeerLib()){setNote('#createNote','온라인 연결 라이브러리를 불러오지 못했습니다. 새로고침이 필요합니다.',true);frontFail('끊김');return}
  saveNick();
  setNote('#createNote','상을 차리는 중입니다…');
  $('#btnCreate').disabled=true;
  const code=genCode();
  const peer=new Peer(PEER_PREFIX+code);
  let ok=false;
  peer.on('open',()=>{
    ok=true;createTries=0;net.peer=peer;mode='host';FR.spread=false;
    hostNew(true,code,($('#inTitle').value.trim()||myNick()+'의 탁자').slice(0,20));
    enterRoom();mark();setNote('#createNote','');$('#btnCreate').disabled=false;
  });
  hostPeerHandlers(peer);
  peer.on('error',e=>{
    if(!ok){
      peer.destroy();$('#btnCreate').disabled=false;
      if(e.type==='unavailable-id'&&createTries++<3){createRoom();return}
      setNote('#createNote','상을 차리지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주십시오.',true);frontFail('끊김');
    }
  });
}
function guestHello(conn){try{conn.send({t:'hello',nick:myNick(),cid:CID,sp:V&&V.spec?1:0})}catch(e){}}
function saveGuest(){if(mode==='guest'&&net.code)store('gura-guest',JSON.stringify({code:net.code,at:Date.now()}))}
function wireGuestConn(conn){
  conn.on('data',d=>{if(net.conn!==conn)return;if(d&&d.t==='kicked'){guestKicked();return}if(d&&d.t==='cleared'){guestCleared();return}if(d&&d.t==='full'){guestFull();return}if(d&&d.t==='bye'){hostLeft(!!d.nx,cleanNick(d.nxn||''));return}if(d&&typeof d==='object'&&d.t==='state'&&d.s&&typeof d.s==='object'){if(Date.now()-(net.savedAt||0)>5000){net.savedAt=Date.now();saveGuest()}applyView(d.s)}});
  conn.on('close',()=>{if(mode==='guest'&&net.conn===conn)guestReconnect()});
  conn.on('error',()=>{if(mode==='guest'&&net.conn===conn)guestReconnect()});
}
function joinRoom(code){
  if(noPeerLib()){setNote('#netNote','온라인 연결 라이브러리를 불러오지 못했습니다. 새로고침이 필요합니다.',true);frontFail('끊김');return}
  saveNick();
  setNote('#netNote',`${code.toUpperCase()} 탁자에 참여하는 중입니다…`);
  frontWarpStart(code);   // 첫 화면: 앉은 채로 타임머신 출발
  $('#btnJoinCode').disabled=true;
  const peer=new Peer();net.peer=peer;
  let opened=false,dead=false;
  const fail=(msg,word)=>{if(opened||dead)return;dead=true;try{peer.destroy()}catch(e){}if(net.peer===peer)net.peer=null;$('#btnJoinCode').disabled=false;setNote('#netNote',msg,true);unstore('gura-guest');frontFail(word||'끊김')};
  peer.on('open',()=>{
    if(opened||dead)return;
    const conn=peer.connect(PEER_PREFIX+code,{reliable:true});
    conn.on('open',()=>{
      if(dead)return;
      opened=true;mode='guest';net.code=code;net.conn=conn;V=null;PV=null;$('#btnJoinCode').disabled=false;setNote('#netNote','');frontWarpArrive();
      enterRoom();guestHello(conn);saveGuest();
      showPanel('<h2>입장 중</h2><p>방장 화면의 응답을 기다리는 중입니다.</p><div class="row"><button class="btn btn-sub" type="button" data-act="leave">취소</button></div>');
    });
    wireGuestConn(conn);net.conn=conn;
  });
  peer.on('disconnected',()=>{if(net.peer===peer&&!peer.destroyed&&mode==='guest'){try{peer.reconnect()}catch(e){}}});
  peer.on('error',e=>{
    if(!opened){
      if(e.type==='peer-unavailable')fail(`${code.toUpperCase()} 탁자를 찾지 못했습니다. 번호를 다시 확인해 주십시오.`,'없음');
      else fail('연결하지 못했습니다. 인터넷 연결을 확인해 주십시오.');
    }else if(mode==='guest'){if(net.retry){clearTimeout(net.retry.timer);net.retry.timer=setTimeout(retryOnce,1500)}else guestReconnect()}
  });
  setTimeout(()=>fail('연결 시간이 초과됐습니다. 다시 시도해 주십시오.'),15000);
}
/* 방장이 새로고침·앱 전환으로 잠깐 사라져도 최대 2분 동안 계속 다시 붙어 봄 */
function guestReconnect(){
  if(mode!=='guest'||net.retry)return;
  net.retry={until:Date.now()+120000,timer:null};
  try{if(net.conn)net.conn.close()}catch(e){}
  net.conn=null;
  net.retry.start=Date.now();
  const ho=net.handoff;net.handoff='';
  showPanel(ho?`<h2>방장이 나갔습니다</h2><p><b>${esc(ho)}</b> 님이 새 방장이 됩니다. 새 방장에게 연결하는 중입니다…</p><div class="row"><button class="btn btn-sub" type="button" data-act="leave">로비로</button></div>`
    :`<h2>다시 연결하는 중</h2><p>방장과 연결이 끊겼습니다. 방장이 돌아오면 자동으로 이어서 합니다.${V&&V.nxn?`<br>40초 안에 돌아오지 않으면 <b>${esc(V.nxn)}</b> 님이 새 방장이 됩니다.`:''}</p><div class="row"><button class="btn btn-sub" type="button" data-act="leave">로비로</button></div>`,'retry');
  if(ho){net.retry.timer=setTimeout(retryOnce,1500);return}   // 이전 방장 연결이 완전히 닫힌 뒤 새 방장에게
  retryOnce();
}
function retryOnce(){
  const R=net.retry;if(!R||mode!=='guest')return;
  if(Date.now()>R.until){net.retry=null;hostGone();return}
  if(V&&V.nx&&Date.now()-R.start>40000){becomeHost('lost');return}   // 방장이 안 돌아오면 다음 방장이 이어받음
  const next=()=>{if(net.retry===R){clearTimeout(R.timer);R.timer=setTimeout(retryOnce,2500)}};
  let peer=net.peer;
  if(!peer||peer.destroyed){
    peer=new Peer();net.peer=peer;
    peer.on('error',e=>{if(net.retry){clearTimeout(net.retry.timer);net.retry.timer=setTimeout(retryOnce,1500)}});
    peer.on('disconnected',()=>{if(net.peer===peer&&!peer.destroyed&&mode==='guest'){try{peer.reconnect()}catch(e){}}});
    peer.on('open',()=>{if(net.retry===R)retryOnce()});
    return;
  }
  if(peer.disconnected||!peer.open){try{peer.reconnect()}catch(e){}next();return}
  const conn=peer.connect(PEER_PREFIX+net.code,{reliable:true});
  const to=setTimeout(()=>{if(!conn.open){try{conn.close()}catch(e){}next()}},4000);
  conn.on('open',()=>{
    clearTimeout(to);if(net.retry!==R||mode!=='guest'){try{conn.close()}catch(e){}return}
    clearTimeout(R.timer);net.retry=null;net.conn=conn;guestHello(conn);
    showPanel('<h2>다시 연결됨</h2><p>게임 상태를 받아오는 중입니다…</p>','back');
  });
  wireGuestConn(conn);
  conn.on('error',()=>{clearTimeout(to);if(net.retry===R)next()});
}
/* 공개 방 찾기: 알림판 16자리에 동시에 물어보고 3.5초 동안 답을 모음 */
let roomScan=null,roomCache=[],roomScanAt=0;
function scanRooms(cb){
  if(noPeerLib()){cb(null);return}
  if(roomScan){roomScan.cbs.push(cb);return}
  const peer=new Peer(),rooms=new Map(),S={cbs:[cb]};roomScan=S;let done=false;
  const finish=()=>{
    if(done)return;done=true;try{peer.destroy()}catch(e){}roomScan=null;
    roomCache=[...rooms.values()];roomScanAt=Date.now();S.cbs.forEach(f=>{try{f(roomCache)}catch(e){}});
  };
  peer.on('open',()=>{
    for(let k=0;k<PUB_SLOTS;k++){
      const c=peer.connect(PUB_PREFIX+k,{reliable:true});
      c.on('data',d=>{if(d&&d.t==='room'&&/^[a-z0-9]{4}$/.test(d.code||'')){rooms.set(d.code,{code:d.code,title:cleanNick(d.title||'')||'공개 탁자',host:d.host?cleanNick(d.host):'',n:+d.n||0,max:+d.max||0,ph:String(d.ph||''),fast:+d.fast?1:0,g:GAMES[d.g]?d.g:'gura',maxn:+d.maxn||14,jk:+d.jk||0,wl:+d.wl||0,sp:+d.sp||0,spm:d.spm==null?8:+d.spm||0})}});
    }
    setTimeout(finish,3500);
  });
  peer.on('error',e=>{if(e&&e.type==='peer-unavailable')return;if(!peer.open)finish()});
  setTimeout(finish,9000);
}
const roomOpen=x=>x.ph==='wait'&&x.n<x.max;
const roomWatch=x=>!roomOpen(x)&&x.sp<x.spm;   // 참가는 못 해도 관전은 가능
function roomCard(x){
  const open=roomOpen(x),watch=roomWatch(x),st=x.ph==='wait'?(open?'대기 중':'가득 참'):x.ph==='over'?'결과 보는 중':'게임 중';
  return `<button type="button" class="room${open?'':' closed'}" data-code="${esc(x.code)}" ${!open&&!watch?'disabled':''}>
    <span class="rm-top"><b class="rm-t">${esc(x.title)}</b><span class="rm-n">${x.n}/${x.max}명</span></span>
    <span class="rm-sub"><span class="gametag">${esc(gameOf(x.g).short)}</span>${x.host?`방장 ${esc(x.host)} · `:''}${gameOf(x.g).noFast?'':(x.fast?'빠른 모드':'클래식')+' · '}${gameOf(x.g).roomSub(x)}</span>
    <span class="rm-st">${st}${watch?`<span class="rm-w">관전 가능 ${x.sp}/${x.spm}</span>`:!open?' · 관전 자리 없음':''}</span></button>`;
}
function renderRooms(list,loading){
  const box=$('#roomList');
  if(loading&&!list){box.innerHTML='<div class="room sk"></div><div class="room sk"></div>';return}
  if(list===null){box.innerHTML='<p class="note warn">온라인 연결 라이브러리를 불러오지 못했습니다. 새로고침이 필요합니다.</p>';return}
  const open=list.filter(roomOpen).sort((a,b)=>(b.n-a.n)||a.title.localeCompare(b.title));
  const rest=list.filter(x=>!roomOpen(x)).sort((a,b)=>(a.ph==='wait')-(b.ph==='wait')||a.title.localeCompare(b.title));
  let h='';
  h+=`<div class="rl-h">들어갈 수 있는 탁자 <b>${open.length}</b></div>`;
  h+=open.length?open.map(roomCard).join(''):'<p class="rl-empty">지금 앉을 수 있는 공개 탁자가 없습니다. <button type="button" class="linkbtn" data-go="create" data-pub="1">공개 탁자로 상차리기</button></p>';
  if(rest.length)h+=`<div class="rl-h">게임 중 · 가득 찬 탁자 <b>${rest.length}</b></div>`+rest.map(roomCard).join('');
  box.innerHTML=h;box.classList.toggle('loading',!!loading);
}
function refreshRooms(){
  const btn=$('#btnRooms');btn.classList.add('spin');btn.disabled=true;
  renderRooms(roomCache.length?roomCache:undefined,true);
  scanRooms(list=>{btn.classList.remove('spin');btn.disabled=false;renderRooms(list,false)});
}
$('#btnRooms').addEventListener('click',refreshRooms);
$('#roomList').addEventListener('click',e=>{
  const b=e.target.closest('.room[data-code]');if(!b||b.disabled||mode!=='lobby'||net.peer)return;
  const x=roomCache.find(r=>r.code===b.dataset.code);
  setNote('#randNote',`${x?x.title:'탁자'}에 ${x&&!roomOpen(x)?'관전으로 ':''}참여하는 중입니다…`);
  joinRoom(b.dataset.code);
});
function randomJoin(){
  if(noPeerLib()){setNote('#randNote','온라인 연결 라이브러리를 불러오지 못했습니다. 새로고침이 필요합니다.',true);return}
  if(net.peer||mode!=='lobby')return;
  saveNick();
  const btn=$('#btnRandom');btn.disabled=true;setNote('#randNote','공개 탁자를 찾는 중입니다…');frontWarpStart('');
  scanRooms(list=>{
    btn.disabled=false;renderRooms(list,false);
    const ok=(list||[]).filter(roomOpen);
    if(!ok.length){setNote('#randNote','지금 앉을 수 있는 공개 탁자가 없습니다. 공개 탁자로 상을 차려 보십시오.',true);frontFail('없음');return}
    // 사람이 더 많은 방을 조금 더 우선 (빨리 시작할 수 있게)
    ok.sort((a,b)=>(b.n-a.n)||(Math.random()-.5));
    const pick=ok[0];setNote('#randNote',`${pick.title}에 참여하는 중입니다…`);
    joinRoom(pick.code);
  });
}
/* 방장이 나갔을 때: 다음 방장이면 방을 이어서 열고, 아니면 새 방장에게 다시 연결 */
function hostLeft(amNext,nxName){
  if(mode!=='guest')return;
  if(amNext){becomeHost('left');return}
  net.handoff=nxName||'다른 참가자';
  guestReconnect();
}
function becomeHost(why){
  if(mode!=='guest'||!V||!net.code)return;
  const code=net.code,last=V,meI=myIdx(),myName=meI>=0&&last.ps[meI]?last.ps[meI].n:myNick();
  // 연결을 닫기 전에 먼저 상태를 바꿈: conn.close()가 바로 'close'를 내보내 guestReconnect()가 다시 돌면 재접속 상태가 남아 알림이 안 사라짐
  const oldConn=net.conn;net.conn=null;mode='promoting';
  if(net.retry){clearTimeout(net.retry.timer);net.retry=null}
  try{if(oldConn)oldConn.close()}catch(e){}
  try{if(net.peer)net.peer.destroy()}catch(e){}net.peer=null;
  showPanel('<h2>새 방장이 되었습니다</h2><p>탁자를 이어서 차리는 중입니다…</p>','promote');
  const tryOpen=n=>{
    const peer=new Peer(PEER_PREFIX+code);let ok=false;
    peer.on('open',()=>{
      ok=true;net.peer=peer;mode='host';unstore('gura-guest');
      if(net.retry){clearTimeout(net.retry.timer);net.retry=null}
      const cfg0={...cfgFor((last.cfg&&last.cfg.game)||'gura'),...(last.cfg||{})};
      H={online:true,code,title:last.title||myName+'의 탁자',cfg:cfg0,phase:'wait',members:[{name:myName,bot:false,conn:null,cid:CID,host:true}],specs:[],players:[],log:[],seatNote:{},field:[],last:null,reveal:null,shouts:[],pending:null,turn:0};
      // 봇은 그대로 남기고, 사람들은 다시 연결되면 자동으로 자리에 들어옴
      (last.ps||[]).forEach((p,i)=>{if(p.b&&!p.f&&H.members.length<H.cfg.max)H.members.push({name:String(p.n).replace(/ \(봇\)$/,''),bot:true,conn:null,host:false,lv:p.lv??1})});
      addLog(why==='left'?`방장이 나가서 ${myName} 님이 새 방장이 되었습니다.`:`방장과 연결이 끊겨 ${myName} 님이 새 방장이 되었습니다.`,'sys');
      if(last.st&&last.st!=='wait')addLog('진행 중이던 게임은 중단되었습니다.','sys');
      roomSetOpen=false;lastPanelHtml='';mark();
    });
    hostPeerHandlers(peer);
    peer.on('error',e=>{
      if(ok)return;try{peer.destroy()}catch(_){}
      if(n<15){setTimeout(()=>{if(mode==='promoting')tryOpen(n+1)},1500);return}
      mode='closed';showPanel('<h2>탁자를 이어서 차리지 못했습니다</h2><p>인터넷 연결을 확인해 주십시오.</p><div class="row"><button class="btn btn-play" type="button" data-act="leave" data-auto>로비로</button></div>','gone');
    });
  };
  tryOpen(0);
}
function guestKicked(){
  if(mode!=='guest')return;
  mode='closed';unstore('gura-guest');
  if(net.retry){clearTimeout(net.retry.timer);net.retry=null}
  showPanel('<h2>탁자에서 일어났습니다</h2><p>방장이 이 탁자에서 내보냈습니다. 이 탁자에는 다시 앉을 수 없습니다.</p><div class="row"><button class="btn btn-play" type="button" data-act="leave" data-auto>로비로</button></div>','kicked');
}
function guestFull(){
  if(mode!=='guest')return;
  if(FR.ok&&!V){unstore('gura-guest');leaveRoom();FR.sit=true;frontFail('만석');return}   // 첫 화면에서 찾아갔는데 자리가 없음: 숫자판에 '만석'
  mode='closed';unstore('gura-guest');
  if(net.retry){clearTimeout(net.retry.timer);net.retry=null}
  showPanel('<h2>자리가 없습니다</h2><p>참가 자리와 관전 자리가 모두 찼습니다. 잠시 뒤 다시 시도해 주십시오.</p><div class="row"><button class="btn btn-play" type="button" data-act="leave" data-auto>로비로</button></div>','full');
}
function hostGone(){
  if(mode!=='guest')return;
  mode='closed';unstore('gura-guest');
  showPanel('<h2>연결이 끊겼습니다</h2><p>방장이 나갔거나 인터넷 연결이 끊겼습니다.</p><div class="row"><button class="btn btn-play" type="button" data-act="leave" data-auto>로비로</button></div>','gone');
}
function leaveRoom(){
  const handing=mode==='host'&&H&&H.online&&successor();
  if(handing){
    // 방장이 나감 → 참가자들에게 알리고, 다음 방장이 같은 방 코드로 방을 이어서 엶
    const nx=handing,conns=[...net.conns],pr=net.peer;
    for(const c of conns){try{c.send({t:'bye',nxn:nx.name,nx:c===nx.conn?1:0})}catch(e){}}
    net.conns.clear();net.peer=null;
    setTimeout(()=>{for(const c of conns){try{c.close()}catch(e){}}try{pr&&pr.destroy()}catch(e){}},400);
  }else{
    for(const c of net.conns){try{c.close()}catch(e){}}net.conns.clear();
    const outing=mode==='guest'&&net.conn&&net.conn.open&&V&&V.st!=='wait'&&V.st!=='over'&&myIdx()>=0;
    if(outing)try{net.conn.send({t:'out'})}catch(e){}   // 게임 중에 직접 나가면 방장이 바로 탈주로 처리
    const pr=net.peer;net.peer=null;
    if(pr)outing?setTimeout(()=>{try{pr.destroy()}catch(e){}},300):(()=>{try{pr.destroy()}catch(e){}})();   // 신호가 가도록 잠깐 뒤에 닫음
  }
  if(net.conn){const c=net.conn;if(mode==='guest'&&c.open&&V&&V.st!=='wait'&&V.st!=='over'&&myIdx()>=0)setTimeout(()=>{try{c.close()}catch(e){}},250);else{try{c.close()}catch(e){}}net.conn=null}
  if(net.retry){clearTimeout(net.retry.timer);net.retry=null}
  if(net.pub){try{net.pub.destroy()}catch(e){}net.pub=null}
  if(mode==='host')unstore('gura-host');
  unstore('gura-guest');net.code='';
  roomSetOpen=false;emoSeen=-1;closeEmoPad();
  H=null;V=null;PV=null;mode='lobby';sel.clear();pickNum=null;FR.sit=false;FR.leanOn=false;FR.spread=false;   // 떠나면 일어섬
  $('#lobby').hidden=false;$('#panel').hidden=true;lastPanelHtml='';lastPanelKind='';
  focusLobby();
  render();sync3D(null,null);
}
window.addEventListener('beforeunload',()=>{saveHost();if(net.peer)try{net.peer.destroy()}catch(e){}if(net.pub)try{net.pub.destroy()}catch(e){}});
window.addEventListener('pagehide',saveHost);
/* 앱 전환 후 돌아왔을 때: 끊긴 연결 되살리기 */
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){saveHost();return}
  const pr=net.peer;
  if(pr&&!pr.destroyed&&pr.disconnected&&(mode==='host'||mode==='guest')){try{pr.reconnect()}catch(e){}}
  if(mode==='guest'&&!net.retry&&!(net.conn&&net.conn.open))guestReconnect();
});
function enterRoom(){$('#lobby').hidden=true}
function myNick(){return ($('#inNick').value.trim()||'나').slice(0,10)}
function saveNick(){store('gura-nick',myNick())}
function roomLink(code){return location.origin+location.pathname+'?room='+code.toUpperCase()}

