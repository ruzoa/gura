/* index.html 공통 코드 · 방장 엔진(방장만 돌림): 시작·행동·차례·탈주·상태 보내기. 파일 순서는 index.html의 <script src> 순서 */
/* ================= 호스트 엔진 =================
   방장 브라우저가 규칙을 처리하고, 참가자마다 자기 손패만 담은 상태를 보내요. */
let H=null, flushQueued=false, lastBeat=0;
function mark(){if(!flushQueued){flushQueued=true;queueMicrotask(flush)}}
function isActive(i){const p=H.players[i];return !p.finished&&p.hand.length>0}
function nextActive(i){const n=H.players.length;for(let k=1;k<=n;k++){const j=(i+k)%n;if(isActive(j))return j}return -1}
function addLog(txt,cls=''){H.logSeq=(H.logSeq||0)+1;H.log.unshift([txt,cls,H.logSeq]);if(H.log.length>10)H.log.length=10}

function hostNew(online,code,title){
  const gid=GAME_IDS[cfg.gi]||'gura';store('gura-game',gid);
  H={online,code,title,cfg:{...cfgFor(gid),fast:cfg.fast&&!gameOf(gid).noFast?1:0,pub:cfg.pub?1:0},phase:'wait',members:[{name:myNick(),bot:false,conn:null,host:true}],specs:[],players:[],log:[],seatNote:{},field:[],last:null,reveal:null,shouts:[],pending:null,turn:0};
}
/* 대기실 자리 번호: 사람·봇마다 m.seat(0~최대 인원-1, 서로 다름). 없거나 겹치거나 범위 밖이면 빈 자리 중 가장 앞 번호로. 게임이 시작되면 자리 번호 순서대로 앉음 */
function fixSeats(){
  const max=Math.max(+H.cfg.max||0,H.members.length),used=new Set();
  for(const m of H.members){if(Number.isInteger(m.seat)&&m.seat>=0&&m.seat<max&&!used.has(m.seat))used.add(m.seat);else m.seat=undefined}
  for(const m of H.members)if(m.seat==null){let k=0;while(used.has(k))k++;m.seat=k;used.add(k)}
}
/* 자리 옮기기: {t:'seat',to:k} 빈 자리 k로 / {t:'swap',with:i} i번 사람(봇 포함)과 자리를 바꿈 */
function hostMoveSeat(i,a){
  if(!H||H.phase!=='wait')return;const m=H.members[i];if(!m)return;fixSeats();
  if(a.t==='seat'){const k=+a.to;if(!Number.isInteger(k)||k<0||k>=Math.max(+H.cfg.max||0,H.members.length)||H.members.some(x=>x.seat===k))return;m.seat=k;mark();return}
  const o=H.members[+a.with];if(!o||o===m)return;const t=m.seat;m.seat=o.seat;o.seat=t;mark();
}
function hostAddBot(force){
  if(!force&&(H.phase!=='wait'||H.members.length>=H.cfg.max))return;
  const used=new Set(H.members.map(m=>m.name));
  const nm=BOT_NAMES.map(n=>n+' 봇').find(n=>!used.has(n))||'봇';
  H.members.push({name:nm,bot:true,conn:null,host:false,lv:1});mark();
}
/* 선 플레이어: 방 설정에서 '선 플레이어 직접 선택'을 켠 방은 방장이 대기실에서 고른 사람(H.firstName, 안 골랐거나 나갔으면 방장), 아니면 랜덤 */
function firstSeat(cnt){
  if(H.cfg.pickfirst){
    let i=H.players.findIndex(p=>p.name===H.firstName);
    if(i<0||i>=cnt)i=H.players.findIndex(p=>p.host);
    if(i>=0&&i<cnt)return i;
  }
  return Math.random()*cnt|0;
}
/* 게임을 시작할 수 있는 최소 인원: 게임의 minN(숫자 또는 cfg=>숫자), 없으면 2명 */
const minPlayers=(g,c)=>typeof g.minN==='function'?g.minN(c||{}):(g.minN||2);
const canStart=()=>!!(H&&(H.phase==='wait'||H.phase==='over')&&H.members.filter(m=>!m.away).length>=minPlayers(EG(),H.cfg));
function hostStart(){
  if(!H||(H.phase!=='wait'&&H.phase!=='over'))return;
  const again=H.phase==='over';   // 결과 화면에서 '바로 시작': 시작 연출을 짧게 하는 게임이 있음 (G.introMs(again))
  H.members=H.members.filter(m=>!m.away);   // 대기실에서 끊긴 채인 사람은 빼고 시작
  fixSeats();H.members.sort((x,y)=>x.seat-y.seat);   // 대기실에서 앉은 자리 순서대로
  if(H.members.length<minPlayers(EG(),H.cfg))return;   // 최소 인원이 안 되면 시작하지 않음 (봇을 자동으로 넣지 않음)
  H.players=H.members.map(m=>({name:m.name,bot:m.bot,lv:m.bot?(m.lv??1):null,conn:m.conn,cid:m.cid||'',host:m.host,hand:[],finished:false,rank:null}));
  EG().engine.start();   // 카드 나누기·첫 차례는 게임마다 다름
  H.fp=0;
  if(EG().dealAnim)beginDeal(DEAL_MS+(EG().dealExtra?+EG().dealExtra()||0:0));   // dealExtra: 카드 나누기 뒤 게임의 추가 연출(대부호 카드 교환) 동안도 멈춤
  else if(EG().introMs){H.dealAgain=again?1:0;H.fp=EG().firstPick?(H.cfg.pickfirst?-1:Roulette.pickFast(Roulette.DEF.fastMin,Roulette.DEF.fastMax)):0;beginDeal(introLen(EG(),again,H.fp))}   // 카드가 없는 게임의 시작 연출 (야추다이스·쿼리도: 카메라 이동·준비·첫 차례 룰렛)
}
/* 카드 섞고 나누는 연출 동안(DEAL_MS)은 제한 시간·봇·행동을 멈춤. 화면 쪽 연출은 dealStart3D
   카드가 없는 게임은 G.introMs만큼 같은 방식으로 멈추고, 화면 쪽은 G.intro(시작 시각, {total, again})가 그림
   G.introMs는 숫자, 또는 바로 시작(again)이면 다른 길이를 돌려주는 함수 */
/* ===== 첫 차례 룰렛 공통 실행부 (게임 연출 안에서 쓰는 도구, 계산은 roulette.js)
   쓰는 법: 게임에 G.firstPick=true를 두고 G.introMs=(again,fast)=>시작 전 연출 ms + Roulette.planFor(2,0,fast).total + 여유.
   G.intro(t0,{fast})에서 ctl=firstPick(룰렛 시작 시각, {seats,first,fast}) →
   매 프레임 ctl.idx(now)로 지금 켜진 자리를 그리고, ctl.tick(now)를 부르면 틱 소리가 나고 끝나는 순간 한 번 true(그때 게임이 ctl.msg()를 안내로 보여 줌).
   seats: 룰렛에 들어가는 자리 번호들(V.ps 기준), first: 첫 차례 자리 번호. 결과는 엔진이 정함 — 화면은 그 자리에서 멈추도록 맞춰 돎
   방 설정의 '선 플레이어 직접 선택'(pickfirst)을 켜면 방장이 대기실에서 고르고(H.firstName), 신호 fp=-1 → 룰렛 없이 그 자리만 짧게 알림 */
function firstPick(t0,{seats,first,fast}){
  const L=seats.slice(),f=Math.max(0,L.indexOf(first)),P=Roulette.planFor(L.length,f,fast);   // fast<0: 방장이 직접 고른 선 (돌지 않음)
  const c={t0,total:P.total,seats:L,first:L[f],plan:P,fixed:P.fixed,n:0,said:false,cued:false,
    idx(now){const e=now-t0;if(e>=P.total)return L[f];const k=P.at(e);return k<0?-1:L[k]},   // 지금 켜진 자리 (-1: 아직 후보만 켜진 중)
    cand(now){return !P.fixed&&now>=t0&&now-t0<P.lead},   // 후보(모든 자리)가 한꺼번에 켜져 있는 구간 — 게임이 모든 자리를 켜 줌
    msg(){const p=V&&V.ps&&V.ps[c.first];return p?(c.first===myIdx()?'내가 먼저 시작합니다.':`${p.n}부터 시작합니다.`):''},   // 끝날 때 보여 줄 안내 (표시는 게임이 함)
    tick(now){   // 틱 소리 + 끝나면 안내 (끝나는 순간 한 번 true)
      const e=now-t0,m=P.times.length;let k=0;while(k<m&&P.times[k]<=e)k++;
      if(!c.cued&&e>=0&&!P.fixed){c.cued=true;tone(420,.34,{type:'triangle',vol:.1,slide:900})}   // 룰렛이 시작된다는 신호음 (후보가 켜지는 순간)
      if(k>c.n){c.n=k;const r=k/m;tone(1400-r*650,.035,{type:'square',vol:.03+r*.03})}   // 느려질수록 낮고 또렷한 틱
      if(e>=P.total&&!c.said){
        c.said=true;sfx('turn');return true;
      }
      return false;
    }};
  return c;
}
const DEAL_MS=4350;
const introLen=(g,again,fast)=>typeof g.introMs==='function'?g.introMs(!!again,fast):+g.introMs||0;   // fast: 첫 차례 룰렛의 빠른 칸 수 (G.firstPick인 게임만)
function beginDeal(ms){
  ms=ms||DEAL_MS;
  const t=clock();H.dealUntil=t+ms;H.dealMs=ms;H.dealId=(H.dealId||0)+1;
  if(typeof H.deadline==='number'&&H.deadline)H.deadline+=ms;
  if(H.botActAt)H.botActAt+=ms;
  H.graceUntil=Math.max(+H.graceUntil||0,t)+ms;
  if(EG().engine.restore)EG().engine.restore(ms);
}
const dealing=()=>!!(H&&H.dealUntil&&clock()<H.dealUntil);
/* 대기실에서 방장이 게임 종류 바꾸기: 인원·관전·공개·모드는 그대로, 나머지는 그 게임에 저장해 둔 설정 */
function hostSetGame(id){
  if(mode!=='host'||!H||H.phase!=='wait'||!GAMES[id]||H.cfg.game===id)return;
  const mx=GAMES[id].maxHi;   // 인원 제한이 있는 게임: 지금 인원이 넘으면 바꾸지 않음
  if(mx&&H.members.length>mx){addLog(`${GAMES[id].name}은(는) 최대 ${mx}명까지 할 수 있습니다.`,'sys');mark();return}
  const keep={max:Math.max(H.cfg.max,H.members.length),spec:H.cfg.spec,pub:H.cfg.pub,fast:H.cfg.fast};
  if(mx)keep.max=Math.min(keep.max,mx);
  H.cfg={...cfgFor(id),...keep};store('gura-game',id);
  if(GAMES[id].engine.reset)GAMES[id].engine.reset();
  addLog(`게임을 ${GAMES[id].name}(으)로 바꿨습니다.`,'sys');
  sfx('tick');lastPanelHtml='';mark();
}
/* 켜고 끄는 규칙 (대부호의 8 끊기·혁명 등) */
function toggleRule(k){
  if(mode!=='host'||!H||H.phase!=='wait'||!EG().ruleSet.some(d=>d.k===k))return;
  H.cfg={...H.cfg,[k]:H.cfg[k]?0:1};saveRoomCfg(H.cfg);sfx('tick');lastPanelHtml='';mark();
}
/* 봇이 보기에 i번이 방금 낸 카드가 진짜일 확률 (공개된 정보만 사용) */
const botLv=b=>b&&b.lv!=null?b.lv:1;   // 봇마다 따로 정한 난이도 (기본 보통)
/* 사람(나 또는 참가자)의 행동을 검증해서 처리 */
function hostEmote(seat,k){
  if(!H||seat<0)return;
  if(H.phase==='wait'){const m=H.members[seat];if(!m||m.bot)return}
  else if(!H.players[seat]||!EG().engine.emoPhase(H.phase))return;
  if(!EMOTES.some(em=>em.k===k)||EG().noEmotes.includes(k))return;
  const t=clock();H.emoAt=H.emoAt||{};
  if(t-(H.emoAt[seat]||0)<1500)return;   // 도배 방지 (한 사람당 1.5초)
  H.emoAt[seat]=t;H.emoSeq=(H.emoSeq||0)+1;
  H.emos=(H.emos||[]).concat([[H.emoSeq,seat,k]]).slice(-8);
  mark();
}
function botEmote(seat,k,delay){setTimeout(()=>{if(H&&H.players[seat]&&H.players[seat].bot)hostEmote(seat,k)},delay||600)}
/* 어려움 봇: 들킬 위험을 따져서 진짜/거짓/패스 고르기 */
function hostAct(seat,a){
  if(!H||!a||typeof a!=='object')return;
  if(a.t==='emo'){hostEmote(seat,String(a.k||''));return}
  if((a.t==='seat'||a.t==='swap')&&H.phase==='wait'){hostMoveSeat(seat,a);return}
  if(H.phase==='wait'||dealing())return;   // 카드를 나누는 동안은 기다림
  EG().engine.act(seat,a);   // 내기·패스·항복 등은 게임 규칙대로
}
function engineTick(){
  if(!H)return;
  const t=clock();
  const inGame=ph=>ph!=='wait'&&ph!=='over';   // 게임 중 (구라!의 판정 'reveal'도 포함)
  if(inGame(H.phase))deserterTick(t);
  if(H&&inGame(H.phase)&&!dealing())EG().engine.tick(t);
  if(H&&H.phase==='wait'){   // 대기실에서 끊긴 뒤 돌아오지 않은 사람은 정리
    const before=H.members.length;
    H.members=H.members.filter(m=>!(m.away&&t>m.awayAt+30000));
    if(H.members.length!==before)mark();
  }
  if(H&&H.online&&t-lastBeat>3000)mark();
}
const DESERT_WAIT=45000;   // 연결이 끊긴 채 이만큼 이어지면 탈주로 확정
const AWAY_WAIT=DESERT_WAIT;   // 게임 파일이 씀: 끊긴 사람 자리는 이 시간 전에는 봇이 두지 않음 (기다리다 탈주로 넘어감)
const awayHuman=p=>!!p&&p.away&&!p.deserter;   // 연결이 끊겨 기다리는 사람 (bot 표시여도 사람으로 시간 규칙을 받음)
/* 탈주: '탁자 떠나기'는 바로, 연결 끊김은 DESERT_WAIT 동안 이어졌을 때. 기다리는 동안 봇은 두지 않고 제한 시간도 멈추지 않음
   (멈추면 일부러 끊었다 붙어 생각할 시간을 벌 수 있음: 끊긴 사람은 자리를 비운 사람과 똑같이 시간 초과 규칙을 받음).
   탈주한 자리는 항복 처리하고(항복을 못 받는 동안만 봇이 둠) 이름표에 표시. 방장은 해당 없음 */
const humanP=p=>!p.deserter&&(!p.bot||p.away||!!p.cid);   // 봇 자리는 cid가 없음. 끊긴 사람은 bot이어도 사람
const soloTable=h=>!!h&&h.phase!=='wait'&&h.phase!=='over'&&(h.players||[]).every(p=>p.host||!humanP(p));   // 사람이 방장 혼자 봇과 하는 게임 중
function desertSeat(i,why){
  const p=H&&H.players[i];
  if(!p||p.deserter||p.finished||H.phase==='wait'||H.phase==='over')return;   // 이미 끝난(탈출·항복) 사람은 그대로
  if(p.host)return;   // 방장이 나가면 탁자가 넘어가거나(사람이 있으면) 정리됨(혼자면)
  p.deserter=true;p.dzWhy=why||'';p.dzTry=0;p.bot=true;p.conn=null;
  if(!p.away||typeof p.awayAt!=='number'){p.away=true;p.awayAt=clock()-AWAY_WAIT}   // 항복을 못 받는 동안은 봇이 바로 이어받음
  else p.awayAt=Math.min(p.awayAt,clock()-AWAY_WAIT);
  mark();
}
function deserterTick(t){
  H.players.forEach((p,i)=>{
    if(!p.host&&!p.deserter&&p.away&&typeof p.awayAt==='number'&&t>=p.awayAt+DESERT_WAIT)desertSeat(i);
    if(!p.deserter||p.finished||dealing()||H.phase==='wait'||H.phase==='over')return;
    hostAct(i,{t:'surrender'});   // 못 받는 때(연출 중, 구라! 판정 대기 등)는 다음 틱에 다시
    if(!p.finished&&!p.dzLog){p.dzLog=1;addLog(`${p.name} 탈주`,'sys')}   // 받았으면 게임이 '탈주!'로 기록함
  });
}
setInterval(engineTick,100);

/* 받는 사람(you)마다 자기 손패만 넣은 상태. sr: 1 항복, 2 제한 시간 초과로 패배, 3 탈주로 항복 처리. dz: 탈주 */
function snapFor(you){
  const t=clock();
  const s={code:H.code,title:H.title,cfg:H.cfg,st:H.phase,lg:H.log,you};
  if(H.emos&&H.emos.length)s.em=H.emos;
  if(H.specs&&H.specs.length)s.sv=H.specs.map(x=>x.name);
  s.mc=H.members.length;
  if(H.phase==='wait'){fixSeats();s.ps=H.members.map(m=>({n:m.name,b:m.bot?1:0,hs:m.host?1:0,aw:m.away?1:0,lv:m.bot?(m.lv??1):undefined,st:m.seat}));if(H.firstName)s.fn=H.firstName;if(EG().engine.waitSnap)EG().engine.waitSnap(s);return s}   // waitSnap: 대기실에도 게임별 값 (대부호의 계급)
  s.ps=H.players.map((p,i)=>{const o={n:p.name,b:p.bot?1:0,c:p.hand.length,f:p.rank||0,no:H.seatNote[i]||''};if(p.surrendered)o.sr=p.surrendered==='time'?2:p.deserter?3:1;if(p.away)o.aw=1;if(p.deserter)o.dz=1;if(i===you)o.h=p.hand.slice();return o});
  s.t=H.turn;
  if(H.dealUntil>t){s.dk=Math.round(H.dealUntil-t);s.di=H.dealId;s.dm=H.dealMs||0;if(H.dealAgain)s.dg=1;if(H.fp)s.fp=H.fp}   // 카드를 나누는 중 (남은 ms, fp: 첫 차례 룰렛의 빠른 칸 수)
  EG().engine.snap(s,you,t);   // 필드·판정 등은 게임마다 다름
  return s;
}
function seatOfConn(conn){
  if(!H)return -1;
  if(H.phase==='wait')return H.members.findIndex(m=>m.conn===conn);
  return H.players.findIndex(p=>p.conn===conn&&!p.bot);
}
function hostSeat(){
  if(H.phase==='wait')return H.members.findIndex(m=>m.host);
  return H.players.findIndex(p=>p.host);
}
function saveHost(){
  if(!H||!H.online||mode!=='host')return;
  try{localStorage.setItem('gura-host',JSON.stringify({at:Date.now(),ck:clock(),H},(k,v)=>k==='conn'?undefined:v))}catch(e){}
}
let hideCode=store('gura-hidecode')==='1';
const EYE_ON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',EYE_OFF='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
const shownCode=c=>hideCode?'••••':String(c||'').toUpperCase();
const PUB_PREFIX='gura-cardgame-pub-',PUB_SLOTS=16;
function pubInfo(){const hm=H.members.find(m=>m.host);return {t:'room',code:H.code,title:H.title,host:hm?hm.name:'',n:H.members.filter(m=>!m.away).length,max:H.cfg.max,ph:H.phase,fast:H.cfg.fast?1:0,g:H.cfg.game,...EG().pubExtra(H.cfg),jk:H.cfg.jokers||0,sp:(H.specs||[]).length,spm:H.cfg.spec??4}}
function pubSync(){
  const want=!!(H&&H.online&&H.cfg.pub&&mode==='host'&&!noPeerLib());
  if(want&&!net.pub&&!net.pubBusy&&clock()>=(net.pubRetryAt||0))claimSlot(shuffle([...Array(PUB_SLOTS).keys()]),0);
  if(!want&&net.pub){try{net.pub.destroy()}catch(e){}net.pub=null}
}
function claimSlot(order,k){
  net.pubBusy=true;
  const p=new Peer(PUB_PREFIX+order[k]);let ok=false;
  p.on('open',()=>{ok=true;net.pubBusy=false;
    if(!(H&&H.online&&H.cfg.pub&&mode==='host')){try{p.destroy()}catch(e){}return}
    net.pub=p});
  p.on('connection',c=>{c.on('open',()=>{try{if(H)c.send(pubInfo())}catch(e){}setTimeout(()=>{try{c.close()}catch(e){}},2000)})});
  p.on('disconnected',()=>{if(net.pub===p&&!p.destroyed){try{p.reconnect()}catch(e){}}});
  p.on('error',e=>{
    if(ok)return;try{p.destroy()}catch(_){}
    if(e.type==='unavailable-id'&&k+1<order.length){claimSlot(order,k+1);return}
    net.pubBusy=false;net.pubRetryAt=clock()+20000;   // 자리가 다 찼거나 연결 문제 → 잠시 뒤 다시
  });
}
function successor(){
  if(!H)return null;
  const m=H.members.find(x=>!x.host&&!x.bot&&!x.away&&x.conn&&x.conn.open);
  return m||null;
}
function flush(){
  flushQueued=false;if(!H)return;
  pubSync();
  applyView(snapFor(hostSeat()));
  if(H.online){
    saveHost();
    lastBeat=clock();
    const nx=successor();
    for(const c of net.conns){if(c.open){try{const sn=snapFor(seatOfConn(c));if(specOf(c))sn.spec=1;else if(H.phase==='over'&&H.members.some(m=>m.conn===c)&&!H.players.some(p=>p.conn===c))sn.jn=1;if(nx){sn.nxn=nx.name;if(nx.conn===c)sn.nx=1}c.send({t:'state',s:sn})}catch(e){}}}
  }
}

