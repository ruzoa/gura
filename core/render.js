/* index.html 공통 코드 · 2D 화면 그리기·입력·키 설정·메뉴·로비 설정. 파일 순서는 index.html의 <script src> 순서 */
/* ================= 렌더 ================= */
function cardHTML(id,extra){return G.cardHTML(id,extra)}
function render(){renderHUD();renderLabels();renderSpecBar();renderMe();renderLog();renderPanel()}
/* 게임 중 왼쪽 위 관전석 (이름만 표시) */
function renderSpecBar(){
  const bar=$('#specBar'),list=V&&mode!=='lobby'&&(V.st!=='wait'||frTableUI())&&Array.isArray(V.sv)?V.sv:[];
  if(!list.length){if(!bar.hidden){bar.hidden=true;bar.innerHTML=''}return}
  const html=`<span class="sb-h">관전 ${list.length}</span>`+list.map((n,k)=>{const me=!!V.spec&&n===myNick();return `<span class="sb-n${me?' me':''}"${V.st==='wait'&&mode==='host'?` data-s="${k}" role="button" tabindex="0" title="내보내기"`:''}>${esc(n)}${me?' (나)':''}</span>`}).join('');
  if(bar.dataset.h!==html){bar.innerHTML=html;bar.dataset.h=html}
  bar.hidden=false;
}
function roomInfoHTML(){
  if(!V||mode==='lobby')return '';
  const c=V.cfg||cfg;
  return (V.code?`<span class="chip code">탁자 번호 <b>${esc(shownCode(V.code))}</b></span>`:'<span class="chip"><b>연습 모드</b></span>')+
    `<span class="chip"><b>${esc(G.name)}</b></span>${G.noFast?'':`<span class="chip"><b>${c.fast?'빠른 모드':'클래식'}</b></span>`}<span class="chip">최대 <b>${+c.max}명</b></span><span class="chip">관전 <b>${+(c.spec??4)}명</b></span>${V.code?`<span class="chip"><b>${c.pub?'공개':'비공개'}</b></span>`:''}${G.cfgChips(c)}`;
}
function renderHUD(){
  const inGame=!!(V&&V.ps&&(V.st==='play'||V.st==='reveal'||V.st==='over'));
  $('#actions').hidden=!inGame||myIdx()<0;   // 관전 중에는 내기·패스 버튼 없음
  G.hud(inGame);   // 게임마다 다른 표시 (구라! 판정, 대부호 혁명 배지 등)
}
function renderLabels(){
  const box=$('#labels');
  if(V&&V.ps&&V.st==='wait'&&frTableUI()){const h=waitSeatsHTML();if(box.dataset.h!==h){box.innerHTML=h;box.dataset.h=h}placeLabels();return}
  box.dataset.h='';
  if(!V||!V.ps||V.st==='wait'){box.innerHTML='';return}
  const me=myIdx();
  box.innerHTML=V.ps.map((p,i)=>{
    if(i===me)return '';
    const on=V.st==='play'&&V.t===i&&activeV(i);
    const mu=emoMuted.has(p.n),note=p.dz&&!p.f?'탈주':p.aw&&!p.f?'연결 끊김':(p.no&&!String(p.no).startsWith('"')?p.no:'');   // 몇 장 냈는지는 표시하지 않음
    return `<div class="seat${on?' on':''}${p.f?' out':''}${mu?' muted':''}" data-i="${i}"><div class="nm" role="button" tabindex="0" data-nk="${i}" aria-haspopup="true" title="${esc(p.n)} 설정">${G.nameTag?G.nameTag(p,i):''}${esc(p.n)}<span class="ct">${p.f?(p.sr?(p.sr===2?'시간 초과':p.sr===3?'탈주':'항복'):G.finLabel(p.f,V.ps.length)):(+p.c+'장')}</span>${p.f?`<span class="rk">${+p.f}위</span>`:''}</div><div class="nt">${esc(note)}</div>${nickOpen===p.n&&!p.b?`<button type="button" class="emob${mu?' off':''}" data-emob="${i}" aria-pressed="${mu}" aria-label="${esc(p.n)} 이모티콘 ${mu?'켜기':'끄기'}" title="이모티콘 ${mu?'켜기':'끄기'}">😊</button>`:''}<svg class="ring" data-ring="${i}" viewBox="0 0 36 36" aria-hidden="true"><circle class="rb" cx="18" cy="18" r="15"/><circle class="rf" cx="18" cy="18" r="15"/></svg><svg class="tb" data-tb="${i}" aria-hidden="true"><rect x="1.5" y="1.5" width="10" height="10" rx="11" pathLength="100"/></svg></div>`;
  }).join('');
  placeLabels();
}
function renderMe(){
  const i=myIdx(),hand=$('#hand'),np=$('#numpick');
  $('#meName').textContent=myNick();
  {const eb=$('#btnEmo'),no=i<0;if(eb.hidden!==no)eb.hidden=no}   // 관전 중에는 이모티콘 없음
  $('#me').hidden=!(V&&V.ps&&V.st!=='wait'&&mode!=='lobby');
  if(!V||!V.ps||V.st==='wait'||i<0){
    hand.innerHTML='';hand.dataset.key='';np.hidden=true;np.innerHTML='';layoutFan();
    renderButtons();return;
  }
  const h=myHand();
  syncCursor();
  // 같은 카드면 다시 그리지 않고 상태만 바꿔서 마우스 올림·애니메이션이 끊기지 않게
  const key=h.join(',');
  if(hand.dataset.key!==key){
    hand.innerHTML=h.map(id=>cardHTML(id,'')).join('');hand.dataset.key=key;
  }
  for(const el of hand.children){const id=+el.dataset.id;el.classList.toggle('newcard',newCards.has(id));el.classList.toggle('sel',sel.has(id));el.classList.toggle('cur',id===curId)}
  G.handMarks(i,h,hand);   // 낼 수 있는 카드 표시는 게임마다 다름
  layoutFan();
  G.me(i,h);
  renderButtons();
}
/* 부채꼴 배치: 카드마다 아래쪽 먼 점을 축으로 조금씩 회전 */
const FAN={n:0,stepPx:20,half:30,R:600,k:1,S:0,zoneH:0},FOC={i:-1};
let lastFanH=-1;
function layoutFan(){
  const fan=$('#hand'),st=$('#stage'),cards=[...fan.children],n=cards.length;
  // 카드게임(구라!·대부호)은 손패를 테이블 모서리에 걸쳐 놓음: 모서리가 카드 가운데에 오고 아래 절반은 테이블 밖(화면 밖). 카드도 더 크게
  const edge=!!(T.ok&&T.edgeB!=null&&typeof G!=='undefined'&&G&&G.dealAnim);
  // 손패 크기: 화면 높이에 비례(세로로 긴 화면은 폭에 비례), 휴대폰 1배 ~ 큰 화면 1.8배. 높이가 낮은 화면(휴대폰 가로)은 0.8배까지
  // 모서리에 걸친 손패는 위 절반만 보이므로 1.3배 키워 2.3배까지
  const W=st.clientWidth,Hs=st.clientHeight||W,k=Math.max(Hs<600?(edge?.95:.8):1,Math.min(edge?2.3:1.8,Math.min(Hs/677,W/460)*(edge?1.3:1)));
  // 카드 간격: 폭 전체를 쓰되 최대 40 (모서리 글자가 다 보이는 간격). 손패 배치는 버튼 위치와 상관없이 정해짐
  // PC(넓고 높은 화면)에서는 버튼을 조금 키움(손패가 커지는 만큼, 최대 1.3배). 손패와 버튼이 같이 커져야 눌러야 할 곳이 작아 보이지 않음
  const pc=W>=900&&Hs>=600&&!(window.matchMedia&&matchMedia('(pointer:coarse)').matches),aS=pc?Math.max(1,Math.min(1.3,k*.8)):1;
  const aW=($('#actions').offsetWidth||0)*aS,mW=$('#me').offsetWidth||0;
  const side=Math.max(mW,aW)+24;
  // 벌어짐 폭(화면 px): 가리킨 카드 기준으로 모든 카드가 이만큼(가까운 카드는 더) 벌어짐 → 양 끝이 화면 밖으로 안 밀리게 손패 폭에서 미리 뺌
  const S=edge?Math.round(8*Math.min(1.4,k)):0;
  const SMAX=edge?24:40;   // 모서리에 걸친 손패는 왼쪽 위 글자만 보이게 촘촘히 모음
  let step=n>1?Math.min(SMAX,(Math.max(150,(W-24-2*S)/k)-60)/(n-1)):0;step=Math.max(step,9);
  // 손패 양옆에 내 정보·버튼이 들어갈 자리가 있으면 옆(화면 아래 구석)에, 없으면 손패 위에. 바뀌어도 손패·테이블은 그대로
  // 가로 화면은 손패를 조금 좁혀서라도(모서리 글자가 보이는 간격 20 이상) 옆에 둠 → 버튼이 화면 가운데로 올라오지 않음
  let wide=W-((n-1)*step+60)*k>=2*side+16;
  if(!wide&&W>Hs){const s2=(Math.max(150,(W-2*side-16)/k)-60)/(n-1||1);if(s2>=20||(Hs<560&&W/Hs>=1.6)){wide=true;step=Math.max(9,Math.min(SMAX,s2))}}
  // 휘는 정도: 손패가 넓을수록 큰 원의 일부로 → 가로로 긴 화면에서도 양 끝이 과하게 내려가지 않음 (양 끝 기울기 약 20도)
  let R=Math.max(560,((n-1)*step+60)*1.45);
  let da=step/(R+44),half=da*(n-1)/2;
  let drop=(R+88)*(1-Math.cos(half));
  // 모서리에 걸친 손패는 덜 휘게: 양 끝 카드가 가운데보다 34px(카드 기준) 넘게 내려가면 화면 밖으로 너무 숨음
  if(edge)for(let it=0;it<8&&drop>34;it++){R*=1.6;da=step/(R+44);half=da*(n-1)/2;drop=(R+88)*(1-Math.cos(half))}
  cards.forEach((c,i)=>{c.style.setProperty('--a',((i-(n-1)/2)*da).toFixed(4)+'rad');c.style.zIndex=i+1});
  FAN.n=n;FAN.stepPx=(R+44)*Math.sin(da)*k;FAN.half=30*k;   // 화면에서 카드 사이 가로 간격
  FAN.R=R;FAN.k=k;FAN.S=S;
  const coarse=window.matchMedia&&matchMedia('(pointer:coarse)').matches;
  // 카드 아래 위치(--b): 모서리 걸치기는 가운데 카드의 가운데 높이(44)가 테이블 모서리(화면 아래에서 T.edgeB px 위)에 오게. 양 끝은 drop/2만큼 아래, 가운데는 drop/2만큼 위
  const eb=edge?T.edgeB:0,bb=edge?eb/k-44+drop/2:(coarse?2:10)+drop;
  fan.style.setProperty('--R',R+'px');fan.style.setProperty('--k',k);fan.style.setProperty('--b',bb.toFixed(1)+'px');
  const fh=n?Math.round(edge?eb+(44+drop/2+(coarse?24:46))*k:(88+drop+(coarse?24:46))*k):0;
  FAN.zoneH=fh;
  fan.style.setProperty('--fh',(fh/k)+'px');
  // PC에서 손패 옆에 둘 때는 화면 구석이 아니라 손패 바로 옆에(카드에서 버튼까지 마우스가 멀지 않게). 손패가 줄면 같이 따라 들어옴
  // 손패를 숨기는 게임(보드·주사위·블랙잭)은 그대로 구석
  let aR=14,mL=12;
  if(pc&&wide&&n&&getComputedStyle(fan).display!=='none'){
    const hv=((R+44)*Math.sin(half)+30*Math.cos(half)+88*Math.sin(half))*k,gap=28;   // 손패 반폭(양 끝 카드가 기운 만큼 포함)
    aR=Math.max(14,Math.round(W/2-hv-gap-aW));mL=Math.max(12,Math.round(W/2-hv-gap-mW));
  }
  st.style.setProperty('--actR',aR+'px');st.style.setProperty('--plateL',mL+'px');st.style.setProperty('--actS',aS);
  st.style.setProperty('--plateB',(wide||!n?14:fh+66)+'px');
  st.style.setProperty('--actB',(wide||!n?14:fh+6)+'px');
  if(fh!==lastFanH){lastFanH=fh;T.fanH=fh;if(T.ok)resize3D()}
  if(FOC.i>=n||!S)FOC.i=-1;   // 다른 게임으로 바뀌었거나 카드가 줄면 벌어짐 해제
  // 키보드 커서(A·D)로 고르는 중이면 커서 카드를 가리킨 것으로 → 모서리에 걸쳐 반쯤 숨은 카드도 다 올라와 읽힘
  else if(document.body.classList.contains('kb')&&curId!=null){const j=cards.findIndex(c=>+c.dataset.id===curId);if(j>=0)FOC.i=j}
  applySpread();   // 손패가 다시 만들어지거나 크기가 바뀌어도 벌어짐 상태를 그대로 이어서 적용
  if(typeof G!=='undefined'&&G&&G.afterFan)G.afterFan();
}
/* 손패 벌어짐: 가리키면 그 카드(FOC.i, .hov)만 살짝 올라오고(손패 전체는 그대로) 왼쪽 카드는 왼쪽으로 오른쪽 카드는 오른쪽으로 모두 벌어짐
   가까운 카드일수록 더 벌어지고(독처럼) 멀리 있는 카드도 조금은 벌어짐. 모서리 글자가 가린 카드를 읽을 수 있게 하는 것이 목적.
   가리키는 카드는 벌어지기 전 '원래 자리' 가로 위치(fanIdxAt)로 정함 → 카드가 움직여도 경계에서 떨리지 않음 */
function applySpread(){
  const cards=[...$('#hand').children],f=FOC.i;
  cards.forEach((c,j)=>{
    const d=j-f;
    if(f<0||d===0){c.style.removeProperty('--sp');c.classList.toggle('hov',f>=0&&d===0);return}
    const ad=Math.abs(d),px=FAN.S*(1+.7*Math.max(0,1-(ad-1)/3));   // 바로 옆 1.7배 → 4장 떨어지면 1배
    c.style.setProperty('--sp',(Math.sign(d)*px/(FAN.k*(FAN.R+44))).toFixed(5)+'rad');
    c.classList.remove('hov');
  });
}
function setFocus(i){
  const n=$('#hand').children.length;if(i<0||i>=n||!FAN.S)i=-1;
  if(FOC.i===i)return;FOC.i=i;applySpread();
}
/* 화면 가로 위치로 손패에서 몇 번째 카드를 가리키는지 (벌어지기 전 자리 기준) */
function fanIdxAt(x){
  const n=FAN.n;if(!n)return -1;
  const r=$('#stage').getBoundingClientRect(),cx=r.left+r.width/2;
  return Math.max(0,Math.min(n-1,Math.floor((x-cx+FAN.half)/Math.max(6,FAN.stepPx)+(n-1)/2)));
}
window.addEventListener('resize',()=>{if(V)layoutFan()});
/* 선언 자음 세로 휠 */
function renderButtons(){
  {const gb=$('#btnGiveUp'),i=myIdx();
   const show=!!(V&&V.ps&&V.st==='play'&&i>=0&&activeV(i));
   if(gb.hidden===show)gb.hidden=!show;
   if(!show&&giveUpArmed)disarmGiveUp();}
  const i=myIdx();
  G.buttons();   // 내기·패스 버튼 상태
  $('#me').classList.toggle('on',!!(V&&V.st==='play'&&V.t===i&&i>=0));
}
function renderLog(){syncLogDotSoon();$('#log').innerHTML=(V&&Array.isArray(V.lg)?V.lg:[]).map(l=>`<li class="${l[1]?'lg-'+esc(l[1]):''}">${esc(l[0])}</li>`).join('')}
const syncLogDotSoon=()=>{if(typeof syncLogDot==='function')try{syncLogDot()}catch(e){}};
/* 상태가 갱신돼도 같은 내용이면 다시 그리지 않아서 키보드 포커스가 유지돼요.
   패널이 처음 뜰 때는 data-auto 버튼(게임 시작, 다시 하기 등)에 포커스를 줘요. */
let lastPanelHtml='',lastPanelKind='';
function showPanel(html,kind,opt){
  const p=$('#panel');p.hidden=false;
  if(html===lastPanelHtml)return;
  const ae=document.activeElement,prevAct=ae&&p.contains(ae)&&ae.dataset?ae.dataset.act:null;
  const typing=ae&&ae.tagName==='INPUT'&&p.contains(ae)?{id:ae.id,v:ae.value,s:ae.selectionStart,e:ae.selectionEnd}:null;
  p.dataset.kind=kind||'';const pb=$('#panelBody');
  pb.innerHTML=html;lastPanelHtml=html;$('#panelBody').classList.toggle('min',kind==='wait'&&FR.sheetMin);$('#panelBody').classList.toggle('wide',kind==='roomset');
  if(typing&&typing.id){const el=document.getElementById(typing.id);if(el){el.value=typing.v;el.focus();try{el.setSelectionRange(typing.s,typing.e)}catch(_){}lastPanelKind=kind||'';return}}
  let target=prevAct?p.querySelector(`[data-act="${prevAct}"]:not([disabled])`):null;
  if(!target&&kind!==lastPanelKind)target=p.querySelector('[data-auto]:not([disabled])');
  lastPanelKind=kind||'';
  if(target)target.focus({preventScroll:kind==='roomset'});
}
/* 방장이 방 설정 값 바꾸기 (범위 밖이면 가까운 값으로) */
function setRoomCfg(k,v){
  if(mode!=='host'||!H||H.phase!=='wait')return;
  const d=roomSetOf(EG(),H.cfg).find(x=>x.k===k);if(!d)return;
  let lo=d.lo;if(k==='max')lo=Math.max(lo,H.members.length);if(k==='spec')lo=Math.max(lo,(H.specs||[]).length);
  v=Math.round(+v);if(!Number.isFinite(v))v=+(H.cfg[k]??cfg[k]);
  if(d.step>1)v=Math.round(v/d.step)*d.step;
  v=Math.max(lo,Math.min(d.hi,v));
  if(k==='max'&&v<+H.cfg.max)shrinkSeats(v);   // 뒤쪽 빈 의자부터 뺌(앉은 사람·봇의 자리는 그대로)
  if(v!==+(H.cfg[k]??-1)){H.cfg={...H.cfg,[k]:v};saveRoomCfg(H.cfg);sfx('tick')}
  lastPanelHtml='';mark();
}
/* −/+ 꾹 누르기: 처음 한 칸 → 0.4초 뒤부터 계속 (오래 누를수록 빨라짐). 패널이 다시 그려져도 멈추지 않게 문서 단위로 처리 */
const HOLD={timer:null,act:'',n:0};
function holdStep(){
  const [op,k]=HOLD.act.split(':');const d=roomSetOf(EG(),H&&H.cfg).find(x=>x.k===k);if(!d||!H){holdStop();return}
  const before=+H.cfg[k];setRoomCfg(k,before+(op==='inc'?d.step:-d.step));
  if(+H.cfg[k]===before){holdStop();return}
  HOLD.n++;HOLD.timer=setTimeout(holdStep,HOLD.n<6?140:HOLD.n<16?80:45);
}
function holdStop(){clearTimeout(HOLD.timer);HOLD.timer=null;HOLD.act=''}
$('#panel').addEventListener('pointerdown',e=>{
  const b=e.target.closest('.stp-b');if(!b||b.disabled||e.button>0)return;
  e.preventDefault();holdStop();HOLD.act=b.dataset.act;HOLD.n=0;
  const [op,k]=HOLD.act.split(':');const d=roomSetOf(EG(),H&&H.cfg).find(x=>x.k===k);if(!d||!H)return;
  setRoomCfg(k,(+H.cfg[k])+(op==='inc'?d.step:-d.step));
  HOLD.timer=setTimeout(holdStep,400);
});
['pointerup','pointercancel','blur'].forEach(ev=>window.addEventListener(ev,holdStop));
document.addEventListener('visibilitychange',()=>{if(document.hidden)holdStop()});
$('#panel').addEventListener('contextmenu',e=>{if(e.target.closest('.stp-b'))e.preventDefault()});
$('#panel').addEventListener('change',e=>{const t=e.target;if(t&&t.id&&t.id.startsWith('st_'))setRoomCfg(t.id.slice(3),t.value)});
$('#panel').addEventListener('keydown',e=>{const t=e.target;if(e.key==='Enter'&&t&&t.id&&t.id.startsWith('st_')){e.preventDefault();setRoomCfg(t.id.slice(3),t.value);t.blur()}});
function hidePanel(){$('#panel').hidden=true;lastPanelHtml='';lastPanelKind=''}
/* 선 플레이어처럼 선택·무작위 버튼 둘로 고르는 규칙 한 줄 (2D 설정 창) */
function pickRowHTML(d,c,cls=''){
  const cur=pickIdx(c[d.k]);
  return `<div class="stp pick${cls}"><div class="stp-t"><b>${d.label}</b><small>${d.desc}</small></div><div class="segrow" role="radiogroup" aria-label="${d.label}">${PICK_OPTS.map((t,j)=>`<button class="btn ${cur===j?'btn-play':'btn-sub'}" type="button" role="radio" aria-checked="${cur===j}" data-act="set:${d.k}:${pickVal(j)}">${t}</button>`).join('')}</div></div>`;
}
function renderPanel(){
  if(mode==='closed'||mode==='promoting'||net.retry)return;
  if(!V||mode==='lobby'){if(mode==='lobby')hidePanel();return}
  const me=myIdx(),isHost=mode==='host';
  if(V.st==='wait'){
    if(frTableUI()){hidePanel();return}   // 3D로 다 할 수 있으면 대기실 창 없음 (자리 = 이름표, 시작 = 빨간 버튼, 설정 = 설정 판자)
    const max=+V.cfg.max;
    // 선 플레이어를 직접 고르는 방(방 설정의 '선 플레이어 선택·무작위'): 고른 사람(없으면 방장)에 '선' 표시, 방장은 눌러서 바꿈
    const pickF=!!(G.firstPick&&+V.cfg.pickfirst);
    let fi=pickF?V.ps.findIndex(p=>p.n===V.fn):-1;if(pickF&&fi<0)fi=Math.max(0,V.ps.findIndex(p=>p.hs));
    const fBtn=i=>!pickF?'':isHost?`<button type="button" class="firstbtn${i===fi?' on':''}" data-act="first:${i}" aria-pressed="${i===fi}" title="눌러서 선 플레이어로 정하기">선</button>`:i===fi?'<span class="firstbtn on ro">선</span>':'';
    let li=V.ps.map((p,i)=>`<li data-i="${i}">${G.nameTag?G.nameTag(p,i):''}${esc(p.n)}${i===me?' (나)':''}${p.b&&!G.oneBotLv?(isHost?`<button type="button" class="botlv lv${p.lv??1}" data-act="botlv:${i}" data-name="${esc(p.n)}" title="눌러서 난이도 바꾸기">${BOT_LV[p.lv??1]}</button>`:`<span class="botlv lv${p.lv??1} ro">${BOT_LV[p.lv??1]}</span>`):''}<span class="tag ${p.hs?'host':''}">${p.hs?'방장':p.b?'봇':p.aw?'연결 끊김':'참가자'}</span>${fBtn(i)}${i===me?'<button type="button" class="slot-emo emo-open" data-act="emopad" aria-label="이모티콘" title="이모티콘">😊</button>':''}${isHost&&!p.hs?`<button type="button" class="kick" data-act="kick:${i}" data-name="${esc(p.n)}" aria-label="${esc(p.n)} 내보내기" title="내보내기">✕</button>`:''}</li>`).join('');
    for(let k=V.ps.length;k<max;k++)li+='<li class="empty">빈 자리</li>';
    const full=V.ps.length>=max;
    const sv=Array.isArray(V.sv)?V.sv:[],spm=+(V.cfg.spec??4);
    const specHtml=sv.length||spm?`<div class="specs"><span class="label">관전 ${sv.length}/${spm}명</span>${sv.map((n,k)=>{const mine=!!V.spec&&n===myNick();
      return `<span class="sp-n${mine?' me':''}" data-s="${k}">${esc(n)}${mine?' (나)':''}${isHost?`<button type="button" class="kick" data-act="kicksp:${k}" data-name="${esc(n)}" aria-label="${esc(n)} 내보내기" title="내보내기">✕</button>`:''}</span>`}).join('')||'<span class="sp-none">없음</span>'}</div>`:'';
    let foot;
    if(isHost)foot=`<div class="row"><button class="btn btn-sub" type="button" data-act="addbot" ${full?'disabled':''}>봇 추가</button></div>
      <div class="row"><button class="btn btn-red" type="button" data-act="start" data-auto ${canStart()?'':'disabled'}>게임 시작</button></div>${canStart()?'':`<p>${minPlayers(EG(),H.cfg)}명부터 시작할 수 있습니다. 빈 자리에 봇을 앉히거나 친구를 부릅니다.</p>`}`;
    else if(me<0&&V.spec)foot=`<p>관전 중입니다.${full?' 빈 자리가 생기면 참가할 수 있습니다.':''}</p><div class="row"><button class="btn btn-red" type="button" data-act="join" data-auto ${full?'disabled':''}>참가하기</button></div>`;
    else if(me<0)foot='<p>자리를 받는 중입니다.</p>';
    else foot=`<p>${G.modeDesc[V.cfg.fast?1:0]} · 방장이 게임을 시작하기를 기다리는 중입니다.</p>${spm>0?`<div class="row"><button class="btn btn-sub" type="button" data-act="tospec" ${sv.length>=spm?'disabled':''}>관전하기</button></div>`:''}`;
    const link=V.code?roomLink(String(V.code)):'';
    const pubOn=!!V.cfg.pub;
    // 방장: 공개(왼쪽)/비공개(오른쪽) 슬라이드 스위치, 참가자: 표시만
    const pubCtl=isHost?`<div class="pubsw"><span class="${pubOn?'on':''}">공개 탁자</span><button type="button" class="sw${pubOn?' on':''}" role="switch" aria-checked="${pubOn}" aria-label="공개 탁자" data-act="pub"><i></i></button></div>`
      :`<span class="pubtag${pubOn?' on':''}">${pubOn?'공개 탁자':'비공개 탁자'}</span>`;
    // 방장: 인원 수 다시 정하기 (지금 들어와 있는 사람보다 적게는 못 줄임)
    if(roomSetOpen&&isHost){
      const c=V.cfg,minMax=Math.max(2,V.ps.length);
      const nowN=Math.max(2,V.ps.length),cardInfo=G.cardInfo(c,nowN);
      const rules=G.ruleSet.filter(d=>!d.hidden).map(d=>{const on=!!(+c[d.k]);if(d.pick)return pickRowHTML(d,c);return `<div class="stp tg"><div class="stp-t"><b>${d.label}</b><small>${d.desc}</small></div><div class="stp-c"><button type="button" class="sw${on?' on':''}" role="switch" aria-checked="${on}" aria-label="${d.label}" data-act="tog:${d.k}"><i></i></button></div></div>`}).join('');
      const tooMany=GAME_IDS.filter(id=>GAMES[id].maxHi&&V.ps.length>GAMES[id].maxHi);   // 인원 제한이 있는 게임(쿼리도 4명)은 지금 인원이 넘으면 고를 수 없음
      const gpick=`<div class="rs-seg"><div class="rs-h"><b>게임</b><small>${esc(G.lead)}${tooMany.length?`<br>${tooMany.map(id=>`${esc(GAMES[id].name)}은(는) 최대 ${GAMES[id].maxHi}명`).join(', ')}까지 할 수 있습니다.`:''}</small></div><div class="segrow" role="radiogroup" aria-label="게임">${GAME_IDS.map(id=>`<button class="btn ${c.game===id?'btn-play':'btn-sub'}" type="button" role="radio" aria-checked="${c.game===id}" data-act="game:${id}"${tooMany.includes(id)?' disabled':''}>${esc(GAMES[id].name)}</button>`).join('')}</div></div>`;
      const stepRow=d=>{const v=+(c[d.k]??cfg[d.k]),lo=d.k==='max'?minMax:d.k==='spec'?(Array.isArray(V.sv)?V.sv.length:0):d.lo;
        return `<div class="stp"><div class="stp-t"><b>${d.label}</b><small>${d.desc}</small></div><div class="stp-c"><button type="button" class="stp-b" data-act="dec:${d.k}" aria-label="${d.label} 줄이기"${v<=lo?' disabled':''}>−</button><input class="txt stp-v" id="st_${d.k}" type="number" inputmode="numeric" min="${lo}" max="${d.hi}" step="${d.step}" value="${v}" aria-label="${d.label}"><span class="stp-u">${d.unit}</span><button type="button" class="stp-b" data-act="inc:${d.k}" aria-label="${d.label} 늘리기"${v>=d.hi?' disabled':''}>+</button></div></div>`};
      const rows=roomSetOf(G,c).map(stepRow).join('');
      // 게임이 규칙 칸을 직접 그릴 수 있음 (G.settingsHTML: 대부호의 룰 레버). 없으면 −/+ 칸과 스위치를 차례로
      const body=G.settingsHTML?G.settingsHTML(c,{stepRow,common:COMMON_SET.map(d=>roomSetOf(G,c).find(x=>x.k===d.k))}):`<div class="rs-grid">${rows}</div>${rules?`<div class="rulehead">게임 규칙</div><div class="rs-grid tgs">${rules}</div>`:''}`;
      const modeRow=G.noFast?'':`<div class="rs-seg"><div class="rs-h"><b>게임 모드</b><small>${G.modeDesc[c.fast?1:0]}</small></div><div class="segrow" role="radiogroup" aria-label="게임 모드">${[0,1].map(v=>`<button class="btn ${(c.fast?1:0)===v?'btn-play':'btn-sub'}" type="button" role="radio" aria-checked="${(c.fast?1:0)===v}" data-act="mode${v}">${OPT_LABEL.fast[v]}</button>`).join('')}</div></div>`;
      showPanel(`<div class="vhead"><button type="button" class="back" data-act="setclose" aria-label="대기실로">←</button><h2>탁자 설정</h2></div>
        ${gpick}${modeRow}
        ${body}${cardInfo}
        <div class="row"><button class="btn btn-red" type="button" data-act="setclose" data-auto>완료</button></div>`,'roomset');
      return;
    }
    const c=V.cfg;
    const sum=`<p class="cfgsum"><span class="gametag">${esc(G.short)}</span>${G.noFast?'':`<b>${OPT_LABEL.fast[c.fast?1:0]}</b> · `}최대 ${+c.max}명 · 관전 ${+(c.spec??4)}명 · ${G.cfgSum(c)}</p>`;
    showPanel(`<div class="vhead"><button type="button" class="back" data-act="leave" aria-label="탁자 떠나기" title="탁자 떠나기">←</button><h2>${esc(V.title||'대기실')}</h2><button type="button" class="back sheetmin" data-act="sheetmin" aria-label="대기실 창 접기·펴기" title="탁자 보기"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>${isHost?'<button type="button" class="btn btn-sub setbtn" data-act="setopen"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg><span>탁자 설정</span></button>':''}</div>
      <div class="coderow"><div><span class="label">탁자 번호</span><div class="codewrap"><div class="bigcode">${esc(shownCode(V.code))}</div><button type="button" class="eyebtn" data-act="hidecode" aria-pressed="${hideCode}" aria-label="${hideCode?'탁자 번호 보이기':'탁자 번호 가리기'}" title="${hideCode?'탁자 번호·링크 보이기':'탁자 번호·링크 가리기'}">${hideCode?EYE_OFF:EYE_ON}</button></div></div>${V.code?pubCtl:''}</div>

      ${isHost&&link?`<div class="linkbox"><input class="txt" id="linkTxt" ${hideCode?'type="password"':''} readonly value="${esc(link)}" aria-label="초대 링크"><button class="btn btn-sub" type="button" data-act="copy">링크 복사</button></div><p>이 링크를 보내면 코드가 자동으로 입력됩니다.</p>`:''}
      <ul class="slots">${li}</ul>${specHtml}${sum}${G.waitExtra?G.waitExtra(isHost):''}${foot}`,'wait');
    return;
  }
  if(V.st==='over'){
    const list=V.ps.map((p,i)=>({...p,i})).sort((a,b)=>a.f-b.f);
    showPanel(`<div class="vhead"><button type="button" class="back" data-act="leave" aria-label="탁자 떠나기" title="탁자 떠나기">←</button><h2>게임 끝</h2></div><ol class="ranks">${list.map(p=>`<li class="${p.i===me?'me':''}" data-i="${p.i}"><span class="r">${+p.f}위</span><span>${esc(p.n)}</span>${G.overRank?G.overRank(p):(()=>{const t=G.rankTitle(p.f,V.ps.length);return p.sr||t?`<span class="left">${p.sr?(p.sr===2?'시간 초과':'항복'):''}${p.sr&&t?' · ':''}${t}</span>`:''})()}${V.cfg&&V.cfg.fast&&p.c>0?`<span class="left">남은 카드 ${+p.c}장</span>`:''}</li>`).join('')}</ol>${G.overExtra?G.overExtra():''}
      ${me>=0?'<div class="row"><button class="btn btn-sub" type="button" data-act="emo:gg">GG 보내기</button></div>':''}
      ${V.spec?V.nj?'<p>라운드가 모두 끝나면 참가할 수 있습니다.</p>':(+V.mc<+V.cfg.max?'<div class="row"><button class="btn btn-red" type="button" data-act="join" data-auto>다음 판 참가하기</button></div>':'<p>빈 자리가 없어 계속 관전합니다.</p>'):V.jn?'<p>다음 판에 참가합니다.</p>':''}
      ${isHost?`<div class="row"><button class="btn btn-sub" type="button" data-act="again">대기실</button><button class="btn btn-red" type="button" data-act="restart" data-auto ${canStart()?'':'disabled'}>바로 시작</button></div>`:'<p>방장이 다음 판을 시작하거나 대기실을 열 때까지 기다립니다.</p>'}`,'over');
    return;
  }
  hidePanel();
}
$('#panel').addEventListener('click',e=>{
  const b=e.target.closest('[data-act]');if(!b)return;
  const a=b.dataset.act;
  if(a==='sheetmin'){FR.sheetMin=!FR.sheetMin;$('#panelBody').classList.toggle('min',FR.sheetMin);sfx('tick');return}
  if(a==='rules'){sfx('paper');openRules();return}
  if(a==='hidecode'){hideCode=!hideCode;store('gura-hidecode',hideCode?'1':'0');lastPanelHtml='';renderPanel();const f=$('#panel [data-act="hidecode"]');if(f)f.focus();return}
  if(a==='leave'){
    // 방장이 나가면 방이 없어지므로, 다른 사람이 있으면 한 번 확인
    if(b.classList.contains('back')&&mode==='host'&&H&&H.online&&H.members.some(m=>!m.host&&!m.bot)&&!confirm('방장이 떠나면 탁자가 정리됩니다. 떠나시겠습니까?'))return;
    leaveRoom();return}
  if(a==='emopad'){$('#emoPad').hidden?openEmoPad(b):closeEmoPad();return}
  if(a.startsWith('emo:')){sendEmote(a.slice(4));return}
  if(a==='join'){sendAct({t:'join'});return}
  if(a==='tospec'){sendAct({t:'spec'});return}
  if(a.startsWith('kicksp:')){
    const k=+a.slice(7),nm=b.dataset.name||'',sp=H&&H.specs?H.specs[k]:null;
    if(mode==='host'&&sp&&sp.name===nm&&confirm(`${nm}님을 탁자에서 내보낼까요?\n내보낸 사람은 이 탁자에 다시 앉을 수 없습니다.`))hostKickSpec(k);
    return}
  if(a.startsWith('kick:')){
    const i=+a.slice(5),nm=b.dataset.name||'';
    if(mode==='host'&&H&&H.phase==='wait'&&H.members[i]&&!H.members[i].host&&H.members[i].name===nm&&(H.members[i].bot||confirm(`${nm}님을 탁자에서 내보낼까요?\n내보낸 사람은 이 탁자에 다시 앉을 수 없습니다.`)))hostKick(i);
    return}
  if(a.startsWith('first:')){
    const i=+a.slice(6);
    if(mode==='host'&&H&&H.phase==='wait'&&EG().firstPick&&H.cfg.pickfirst&&H.members[i]){H.firstName=H.members[i].name;sfx('tick');lastPanelHtml='';mark()}
    return}
  if(a==='setopen'){roomSetOpen=true;renderPanel();return}
  if(a==='setclose'){roomSetOpen=false;renderPanel();return}
  if((a==='om:more'||a==='prmore')&&!H&&G.panelAct){G.panelAct(a,b);return}   // 참가자도 세부 설정 쪽은 넘겨 볼 수 있음
  if(/^(inc|dec):/.test(a)){if(e.detail!==0)return;const [op,k]=a.split(':');const d=roomSetOf(EG(),H&&H.cfg).find(x=>x.k===k);if(d&&H)setRoomCfg(k,(+H.cfg[k])+(op==='inc'?d.step:-d.step));return}
  if(a==='pub'){if(mode==='host'&&H&&H.online){H.cfg={...H.cfg,pub:H.cfg.pub?0:1};mark()}return}
  if(a==='copy'){
    const inp=$('#linkTxt');if(!inp)return;
    const done=()=>{b.textContent='복사됨';setTimeout(()=>{b.textContent='링크 복사'},1500)};
    if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(inp.value).then(done,()=>{inp.select()});
    else inp.select();
    return;
  }
  if(!H)return;
  if(G.panelAct&&G.panelAct(a,b))return;   // 게임이 따로 처리하는 버튼 (대부호의 룰 레버 등)
  if(a.startsWith('tog:')){toggleRule(a.slice(4));return}
  if(a.startsWith('set:')){const p=a.split(':');setRule(p[1],p[2]);return}
  if(a.startsWith('game:')){hostSetGame(a.slice(5));return}
  if(a.startsWith('botlv:')){const i=+a.slice(6),m=H&&H.members[i];if(mode==='host'&&H.phase==='wait'&&m&&m.bot&&m.name===b.dataset.name){m.lv=((m.lv??1)+1)%3;sfx('tick');mark()}return}
  if(a==='mode0'||a==='mode1'){if(H.phase==='wait'&&!EG().noFast){H.cfg={...H.cfg,fast:a==='mode1'?1:0};mark()}return}
  if(a==='addbot')hostAddBot();
  else if(a==='start')hostStart();
  else if(a==='again'){H.phase='wait';roomSetOpen=false;mark()}
  else if(a==='restart')hostStart();
});

/* 실시간 타이머, 버튼 상태 */
function liveUI(t){
  const dim=$('#dim'),myTurn=!!(V&&V.ps&&V.st==='play'&&myIdx()>=0&&V.t===myIdx()&&!T.deal&&!dealingV());   // 카드를 나누는 동안은 어둡게 하지 않음
  if(dim.classList.contains('on')!==myTurn)dim.classList.toggle('on',myTurn);
  if(!V||!V.ps)return;
  document.querySelectorAll('[data-bar]').forEach(b=>{b.firstChild.style.width='0';b.classList.remove('grace')});
  const setRing=(i,frac,grace)=>{const f=Math.max(0,Math.min(1,frac));const r=document.querySelector(`[data-ring="${i}"]`);if(r){r.style.setProperty('--off',(94.25*(1-f)).toFixed(1));r.classList.toggle('grace',grace)}
    const b=document.querySelector(`[data-tb="${i}"]`);if(b){const el=b.parentNode,w=el.offsetWidth+4,h=el.offsetHeight+4,rc=b.firstChild;if(rc.dataset.wh!==w+'x'+h){rc.dataset.wh=w+'x'+h;rc.setAttribute('width',w-3);rc.setAttribute('height',h-3)}
      b.style.setProperty('--off',(100*(1-f)).toFixed(1));b.classList.toggle('grace',grace)}};   // 이름표 테두리에도 같은 시간
  const meBar=$('#meBar');meBar.firstChild.style.width='0';meBar.classList.remove('grace');
  if(V.st==='play'&&V.ps[V.t]&&!dealingV()){
    const g=V.graceAt-t,me=myIdx();
    const bar=V.t===me?meBar:document.querySelector(`[data-bar="${V.t}"]`);
    if(g>0){if(bar){bar.classList.add('grace');bar.firstChild.style.width=Math.min(100,g/(V.cfg.grace*1000)*100)+'%'}if(V.t!==me)setRing(V.t,1,true)}
    else{
      const left=Math.max(0,(V.deadAt-t)/1000);if(bar)bar.firstChild.style.width=Math.min(100,left/V.cfg.turn*100)+'%';if(V.t!==me)setRing(V.t,left/V.cfg.turn,false);
      const sec=Math.ceil(left);
      if(V.t===me&&sec<=5&&sec>0){if(sec!==lastWarnSec){lastWarnSec=sec;sfx('warn',sec<=2)}}else lastWarnSec=-1;
    }
  }
  G.live();
  renderButtons();
}

/* 입력 */
/* 끌어서 내기: 카드를 잡고 위로 끌어 손패에서 완전히 떼어 놓으면 냄 (내기 버튼까지 가지 않아도 됨). 손패에 조금이라도 겹친 채 놓으면 취소
   고른 카드를 잡으면 고른 카드가 모두, 안 고른 카드를 잡으면 그 한 장만 따라옴 */
const DRAG={el:null,x:0,y:0,on:false,rest:null,cards:[],off:[],one:null,gt:0,suppress:0};
function dragClear(){clearTimeout(DRAG.gt);for(const c of DRAG.cards){c.classList.remove('drag','gath','go');for(const v of ['--dx','--dy','--ra'])c.style.removeProperty(v)}DRAG.el=null;DRAG.on=false;DRAG.cards=[];DRAG.off=[];DRAG.one=null}
/* 끌기 시작: 끄는 카드는 기울기를 펴고 잡은 카드 옆으로 촘촘하게 모임(잡은 카드는 손 아래 그대로) */
function dragBegin(b){
  const cs=[...$('#hand').children];let l=1e9,t=1e9,r=-1e9,bt=-1e9;
  for(const c of cs){const q=c.getBoundingClientRect();l=Math.min(l,q.left);t=Math.min(t,q.top);r=Math.max(r,q.right);bt=Math.max(bt,q.bottom)}
  DRAG.rest={l,t,r,b:bt};DRAG.on=true;
  DRAG.one=b.classList.contains('sel')?null:+b.dataset.id;
  DRAG.cards=DRAG.one==null?cs.filter(c=>c.classList.contains('sel')):[b];
  const k=parseFloat($('#hand').style.getPropertyValue('--k'))||1,mid=q=>[(q.left+q.right)/2,(q.top+q.bottom)/2];
  const g=mid(b.getBoundingClientRect()),gi=Math.max(0,DRAG.cards.indexOf(b)),GAP=18;
  // 기울기를 편 자리를 재고(움직임 없이) 원래대로 돌린 뒤, 짧게 미끄러지며 모임
  for(const c of DRAG.cards){c.classList.add('drag');c.style.setProperty('--ra','0rad')}
  DRAG.off=DRAG.cards.map((c,j)=>{const m=mid(c.getBoundingClientRect());return [(g[0]-m[0])/k+(j-gi)*GAP,(g[1]-m[1])/k]});
  for(const c of DRAG.cards)c.style.removeProperty('--ra');
  void b.offsetWidth;
  for(const c of DRAG.cards){c.classList.add('gath');c.style.setProperty('--ra','0rad')}
  DRAG.gt=setTimeout(()=>{for(const c of DRAG.cards)c.classList.remove('gath')},160);
}
function dragMove(e){
  const dx=e.clientX-DRAG.x,dy=e.clientY-DRAG.y,k=parseFloat($('#hand').style.getPropertyValue('--k'))||1;
  DRAG.cards.forEach((c,j)=>{const o=DRAG.off[j]||[0,0];c.style.setProperty('--dx',(o[0]+dx/k).toFixed(1)+'px');c.style.setProperty('--dy',(o[1]+dy/k).toFixed(1)+'px')});
  const go=dragFree();for(const c of DRAG.cards)c.classList.toggle('go',go);
}
/* 끌고 있는 카드가 손패(끌기 전 카드 자리 전체)와 한 점도 겹치지 않으면 true */
function dragFree(){
  const R=DRAG.rest;if(!R)return false;
  return DRAG.cards.every(c=>{const b=c.getBoundingClientRect();return b.right<R.l||b.left>R.r||b.bottom<R.t||b.top>R.b});
}
/* 놓기: 손패와 떨어져 있으면 냄 (내기 버튼을 누른 것과 같음). 한 장을 끌었으면 그 카드만 골라서 냄 */
function dragDrop(cancel){
  for(const c of DRAG.cards)c.classList.remove('gath');   // 모이는 중에 놓아도 다 모인 자리로 판단
  const free=!cancel&&dragFree(),one=DRAG.one;
  dragClear();DRAG.suppress=Date.now();
  if(!free)return;
  const pb=$('#btnPlay');
  if(one!=null){
    const old=new Set(sel);sel.clear();sel.add(one);renderButtons();
    if(pb.hidden||pb.disabled){sel.clear();for(const id of old)sel.add(id);renderMe();sfx('no');return}
    curId=one;
  }else if(pb.hidden||pb.disabled){sfx('no');return}
  G.play();
}
$('#hand').addEventListener('pointerdown',e=>{
  if(e.pointerType==='touch'||e.button!==0)return;
  const b=e.target.closest('.card');if(!b)return;
  DRAG.el=b;DRAG.x=e.clientX;DRAG.y=e.clientY;DRAG.on=false;
  try{b.setPointerCapture(e.pointerId)}catch(_){}
});
$('#hand').addEventListener('pointermove',e=>{
  if(e.pointerType==='touch'||!DRAG.el)return;
  if(!DRAG.on){if(Math.hypot(e.clientX-DRAG.x,e.clientY-DRAG.y)<6)return;dragBegin(DRAG.el)}
  dragMove(e);
});
function mouseUp(e,cancel){
  if(e.pointerType==='touch'||!DRAG.el)return;
  if(!DRAG.on){DRAG.el=null;return}   // 움직이지 않았으면 그냥 누르기 (click에서 고르기 풀기)
  dragDrop(cancel);
}
$('#hand').addEventListener('pointerup',e=>mouseUp(e,false));
$('#hand').addEventListener('pointercancel',e=>mouseUp(e,true));
$('#hand').addEventListener('lostpointercapture',e=>mouseUp(e,true));

/* 터치: 짧게 탭하면 선택, 꾹 누르면 카드가 올라와서 미리 보기(손가락을 옆으로 밀면 다른 카드 보기), 떼면 선택 안 함
   위로 밀면 끌어서 내기 (미리 보기 중에는 그 카드를 위로 밀면) */
const TOUCH={id:null,t0:0,x:0,y:0,timer:null,peek:false,el:null,suppress:0};
function setPeek(el){if(TOUCH.el===el)return;if(TOUCH.el)TOUCH.el.classList.remove('peek');TOUCH.el=el;if(el){el.classList.add('peek');setFocus([...$('#hand').children].indexOf(el))}}
function toggleCard(id){curId=id;sel.has(id)?sel.delete(id):sel.add(id);sfx('pick');renderMe()}
$('#hand').addEventListener('contextmenu',e=>e.preventDefault());
$('#hand').addEventListener('pointerover',e=>{if(e.pointerType!=='touch')seeNewCard(e.target.closest('.card'))});
/* 마우스: 카드에 올리면 그 카드 기준으로 벌어짐. 한 번 올리면 손패 띠(카드가 놓인 가로·세로 범위)를 벗어날 때까지 이어짐(카드 사이 틈·벌어진 틈에서 풀리지 않게) */
document.addEventListener('pointermove',e=>{
  if(e.pointerType==='touch')return;
  if(!FAN.n||!FAN.S){if(FOC.i>=0)setFocus(-1);return}
  if(DRAG.el||DRAG.on)return;   // 누르고 있거나 끄는 동안은 벌어진 그대로 (끌기 자리 재기가 흔들리지 않게)
  const t=e.target,onCard=!!(t&&t.closest&&t.closest('#hand .card'));
  if(FOC.i<0&&!onCard)return;
  const st=$('#stage').getBoundingClientRect(),cx=st.left+st.width/2;
  const halfW=(FAN.n-1)*FAN.stepPx/2+FAN.half+FAN.S*1.7+6;
  const inZone=e.clientY>=st.bottom-FAN.zoneH&&e.clientY<=st.bottom&&Math.abs(e.clientX-cx)<=halfW&&!(t&&t.closest&&t.closest('button,.panel'));
  if(!onCard&&!inZone){setFocus(-1);return}
  setFocus(fanIdxAt(e.clientX));
});
document.addEventListener('pointerout',e=>{if(!e.relatedTarget&&e.pointerType!=='touch')setFocus(-1)});
$('#hand').addEventListener('pointerdown',e=>{
  if(e.pointerType!=='touch')return;
  const b=e.target.closest('.card');if(!b)return;
  seeNewCard(b);
  setFocus([...$('#hand').children].indexOf(b));   // 손가락이 닿으면 바로 살짝 올라오고 벌어짐 (꾹 누르면 크게 올라와 미리 보기)
  TOUCH.id=+b.dataset.id;TOUCH.t0=Date.now();TOUCH.x=e.clientX;TOUCH.y=e.clientY;TOUCH.peek=false;
  DRAG.el=b;DRAG.on=false;
  clearTimeout(TOUCH.timer);
  TOUCH.timer=setTimeout(()=>{TOUCH.peek=true;setPeek(b);sfx('tick');if(navigator.vibrate)try{navigator.vibrate(8)}catch(_){}},300);
});
$('#hand').addEventListener('pointermove',e=>{
  if(e.pointerType!=='touch'||TOUCH.id==null)return;
  if(DRAG.on){dragMove(e);return}
  const dx=e.clientX-TOUCH.x,dy=e.clientY-TOUCH.y,up=-dy>Math.abs(dx);
  if(!TOUCH.peek){
    if(Math.hypot(dx,dy)>12){
      clearTimeout(TOUCH.timer);
      if(up&&DRAG.el){DRAG.x=TOUCH.x;DRAG.y=TOUCH.y;dragBegin(DRAG.el);dragMove(e);return}
      TOUCH.timer=setTimeout(()=>{TOUCH.peek=true},0);
    }
    return;
  }
  // 미리 보기 중 위로 크게 밀면 보고 있는 카드로 끌기
  if(TOUCH.el&&up&&-dy>40){DRAG.x=e.clientX;DRAG.y=e.clientY;dragBegin(TOUCH.el);return}
  // 올라온 카드가 손가락을 덮으므로 화면 좌표 대신 부채 가운데로부터의 가로 거리로 카드 고르기
  const cards=[...$('#hand').children];if(!cards.length)return;
  const idx=fanIdxAt(e.clientX);
  const c=cards[idx];
  if(c&&c!==TOUCH.el){setPeek(c);seeNewCard(c);sfx('tick')}
});
function touchEnd(e,cancel){
  if(e.pointerType!=='touch'||TOUCH.id==null)return;
  clearTimeout(TOUCH.timer);setFocus(-1);
  if(DRAG.on){setPeek(null);dragDrop(cancel);TOUCH.id=null;TOUCH.peek=false;TOUCH.suppress=Date.now();return}
  DRAG.el=null;
  const quick=!TOUCH.peek&&Date.now()-TOUCH.t0<300&&Math.hypot(e.clientX-TOUCH.x,e.clientY-TOUCH.y)<=12;
  if(quick&&!cancel)toggleCard(TOUCH.id);
  setPeek(null);TOUCH.id=null;TOUCH.peek=false;TOUCH.suppress=Date.now();
}
$('#hand').addEventListener('pointerup',e=>touchEnd(e,false));
$('#hand').addEventListener('pointercancel',e=>touchEnd(e,true));
$('#hand').addEventListener('click',e=>{if(Date.now()-TOUCH.suppress<700||Date.now()-DRAG.suppress<300)return;const b=e.target.closest('.card');if(!b)return;const id=+b.dataset.id;curId=id;sel.has(id)?sel.delete(id):sel.add(id);sfx('pick');renderMe()});
$('#btnPlay').addEventListener('click',()=>G.play());
$('#btnPass').addEventListener('click',()=>G.pass());
/* 키 설정 — 물리 키(e.code)로 저장해서 한/영 입력 상태와 상관없이 동작 */
const DEFAULT_KEYS={play:'Space',pass:'KeyQ',pick:'KeyE',right:'KeyD',left:'KeyA'};
for(const id of GAME_IDS)Object.assign(DEFAULT_KEYS,GAMES[id].keys);   // 게임에만 있는 키 (구라!, 선언 자음 등)
EMOTES.forEach((em,i)=>{DEFAULT_KEYS['emo_'+em.k]=EMO_KEYS[i]});
/* 키 설정 목록: '전체' = 모든 게임이 같이 쓰는 키(카드·이모티콘), '게임별' = 게임마다 따로 있는 키 */
let keyTab='all';
function keyActionsAll(){return [
  {a:'play',n:'카드 내기',d:'고른 카드를 냅니다'},
  {a:'pass',n:'패스',d:'이번 차례를 넘깁니다'},
  {a:'pick',n:'카드 선택 / 취소',d:'커서가 있는 카드를 고르거나 풉니다'},
  {a:'right',n:'오른쪽 카드',d:'커서를 오른쪽으로 옮깁니다'},
  {a:'left',n:'왼쪽 카드',d:'커서를 왼쪽으로 옮깁니다'},
  ...EMOTES.filter(em=>!G.noEmotes.includes(em.k)).map(em=>({a:'emo_'+em.k,n:`이모티콘 ${em.e||em.t}`,d:`${em.n} 이모티콘을 보냅니다`}))]}
function keyGroups(){   // 게임별: [{game, keys}] (지금 게임이 맨 위)
  const ids=[G.id,...GAME_IDS.filter(id=>id!==G.id)];
  return ids.map(id=>({id,name:GAMES[id].name,keys:GAMES[id].keyActions||[]})).filter(x=>x.keys.length);
}
function keyActions(){return [...keyActionsAll(),...keyGroups().flatMap(x=>x.keys)]}
const RESERVED=new Set(['Escape','Tab','MetaLeft','MetaRight']);
let KEYS={...DEFAULT_KEYS},listening=null;
try{const s=JSON.parse(store('gura-keys2')||'null');if(s&&typeof s==='object')for(const k of Object.keys(DEFAULT_KEYS))if(typeof s[k]==='string'&&s[k])KEYS[k]=s[k]}catch(e){}
function keyLabel(c){
  if(!c)return '없음';
  if(c.startsWith('Key'))return c.slice(3);
  if(c.startsWith('Digit'))return c.slice(5);
  if(c.startsWith('Numpad'))return '넘패드 '+c.slice(6);
  const m={Space:'스페이스',Enter:'Enter',Backspace:'Backspace',ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→',ShiftLeft:'왼쪽 Shift',ShiftRight:'오른쪽 Shift',ControlLeft:'왼쪽 Ctrl',ControlRight:'오른쪽 Ctrl',AltLeft:'왼쪽 Alt',AltRight:'오른쪽 Alt',Slash:'/',Period:'.',Comma:',',Semicolon:';',Quote:"'",BracketLeft:'[',BracketRight:']',Minus:'-',Equal:'=',Backquote:'`',Backslash:'\\'};
  return m[c]||c;
}
function renderKeys(){
  const row=k=>`<div class="keyrow"><span class="kn">${k.n}<span class="kd">${k.d}</span></span><button type="button" class="keycap${listening===k.a?' listen':''}" data-key="${k.a}">${listening===k.a?'키를 누르십시오':esc(keyLabel(KEYS[k.a]))}</button></div>`;
  document.querySelectorAll('#keyTabs button').forEach(b=>{const on=b.dataset.t===keyTab;b.setAttribute('aria-selected',on)});
  $('#keyList').innerHTML=keyTab==='all'?keyActionsAll().map(row).join(''):keyGroups().map(x=>`<div class="keygrp"><h3>${esc(x.name)}</h3>${x.keys.map(row).join('')}</div>`).join('')||'<p class="note">게임별 키가 없습니다.</p>';
  $('#btnPass small').textContent=keyLabel(KEYS.pass);
  $('#btnGura small').textContent=keyLabel(KEYS.gura);
  renderButtons();
}
let keysReturn=null;
function openKeys(){keysReturn=document.activeElement;listening=null;$('#keysOv').hidden=false;renderKeys();const f=$('#keyList [data-key]');if(f)f.focus()}
function closeKeys(){listening=null;$('#keysOv').hidden=true;renderKeys();if(keysReturn&&keysReturn.focus)keysReturn.focus()}
$('#keyTabs').addEventListener('click',e=>{const b=e.target.closest('[data-t]');if(!b||b.dataset.t===keyTab)return;keyTab=b.dataset.t;listening=null;renderKeys();sfx('tick')});
$('#btnKeysLobby').addEventListener('click',openKeys);
$('#btnKeysClose').addEventListener('click',closeKeys);
$('#keysOv').addEventListener('click',e=>{if(e.target===e.currentTarget)closeKeys()});
$('#keyList').addEventListener('click',e=>{const b=e.target.closest('[data-key]');if(!b)return;const k=b.dataset.key;listening=listening===k?null:k;renderKeys();const nb=$(`#keyList [data-key="${k}"]`);if(nb)nb.focus()});
$('#btnKeysReset').addEventListener('click',()=>{KEYS={...DEFAULT_KEYS};listening=null;store('gura-keys2',JSON.stringify(KEYS));renderKeys()});

document.addEventListener('keydown',e=>{
  if(listening){
    e.preventDefault();
    if(e.code==='Escape'){listening=null;renderKeys();return}
    if(RESERVED.has(e.code)||!e.code)return;
    const other=Object.keys(KEYS).find(a=>a!==listening&&KEYS[a]===e.code);
    if(other)KEYS[other]=KEYS[listening];
    const done=listening;KEYS[listening]=e.code;listening=null;
    store('gura-keys2',JSON.stringify(KEYS));renderKeys();const nb=$(`#keyList [data-key="${done}"]`);if(nb)nb.focus();return;
  }
  if(!$('#keysOv').hidden){if(e.code==='Escape')closeKeys();return}
  if(e.target.matches('input')||!$('#lobby').hidden||e.ctrlKey||e.metaKey||e.altKey)return;
  if(!V||!V.st)return;
  const act=Object.keys(KEYS).find(a=>KEYS[a]===e.code);
  if(!act)return;
  if(act.startsWith('emo_')){e.preventDefault();if(!e.repeat)sendEmote(act.slice(4));return}
  if(!G.keyPhase(V.st))return;  // 대기실·결과 화면에서는 Tab/Enter/Space로 버튼 조작
  e.preventDefault();
  if(act==='left'||act==='right'){moveCursor(act==='right'?1:-1);return}
  if(G.onKey(act,e))return;   // 게임에만 있는 키
  if(e.repeat)return;
  if(act==='pick')pickCursor();
  else if(act==='play'){if(!$('#btnPlay').disabled)$('#btnPlay').click()}
  else if(act==='pass'){if(!$('#btnPass').disabled)$('#btnPass').click()}
});

/* 키보드 커서: 마우스 없이 카드 고르기 */
let curId=null,curIdx=0;
function syncCursor(){
  const h=myHand();
  if(!h.length){curId=null;return}
  if(curId!=null&&h.includes(curId)){curIdx=h.indexOf(curId);return}
  if(curId!=null){curIdx=Math.min(curIdx,h.length-1);curId=h[curIdx]}
}
/* 마우스를 움직이면 키보드 커서 표시를 숨기고, A·D·E를 누르면 다시 보임 */
function kbOn(){if(!document.body.classList.contains('kb'))document.body.classList.add('kb')}
let lastPX=null,lastPY=null;
document.addEventListener('pointermove',e=>{
  if(lastPX!==null&&(Math.abs(e.clientX-lastPX)>2||Math.abs(e.clientY-lastPY)>2))document.body.classList.remove('kb');
  lastPX=e.clientX;lastPY=e.clientY;
},{passive:true});
document.addEventListener('pointerdown',()=>document.body.classList.remove('kb'),{passive:true});
function moveCursor(d){kbOn();
  const h=myHand();if(!h.length)return;
  let i=curId!=null?h.indexOf(curId):-1;
  i=i<0?(d>0?0:h.length-1):Math.max(0,Math.min(h.length-1,i+d));
  curIdx=i;curId=h[i];sfx('tick');renderMe();showCursor();
}
function pickCursor(){kbOn();
  const h=myHand();if(!h.length)return;
  if(curId==null||!h.includes(curId)){curIdx=0;curId=h[0];renderMe();showCursor();return}
  sel.has(curId)?sel.delete(curId):sel.add(curId);sfx('pick');renderMe();showCursor();
}
function showCursor(){}

/* 화면 배치: 항상 게임 테이블이 창 전체를 채움. 설정 메뉴의 '전체화면'은 브라우저 주소창까지 숨김 */
document.body.classList.add('fs');
let isApp=false;
try{if(matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches||navigator.standalone){isApp=true;document.body.classList.add('app')}}catch(e){}
if('serviceWorker' in navigator&&location.protocol==='https:')window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
const fsEl=()=>document.fullscreenElement||document.webkitFullscreenElement;
const fsReq=document.documentElement.requestFullscreen||document.documentElement.webkitRequestFullscreen;
const ICON_MAX='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';
const ICON_MIN='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';
/* 전체화면 버튼(설정 오른쪽): 브라우저 주소창까지 숨김. 앱으로 실행했거나 지원하지 않으면 버튼을 숨기고 다른 버튼을 오른쪽으로 당김 */
function setFsLabel(){
  const b=$('#btnFs'),no=isApp||!fsReq;b.hidden=no;document.body.classList.toggle('nofs',no);
  const on=!!fsEl();b.innerHTML=on?ICON_MIN:ICON_MAX;const t=on?'전체화면 끄기':'전체화면';b.title=t;b.setAttribute('aria-label',t);
}
setFsLabel();
$('#btnFs').addEventListener('click',()=>{
  closeMenu();closeLog();
  if(fsEl()){const ex=document.exitFullscreen||document.webkitExitFullscreen;if(ex)try{const r=ex.call(document);if(r&&r.catch)r.catch(()=>{})}catch(e){}}
  else if(fsReq){try{const r=fsReq.call(document.documentElement);if(r&&r.catch)r.catch(()=>{})}catch(e){}}
});
['fullscreenchange','webkitfullscreenchange'].forEach(ev=>document.addEventListener(ev,setFsLabel));
/* 진행 기록: 오른쪽 위 버튼으로 열고 닫음. 닫혀 있는 동안 새 기록이 생기면 버튼에 빨간 점 */
let logSeen=0;
const logTop=()=>V&&Array.isArray(V.lg)&&V.lg[0]?+V.lg[0][2]||0:0;
function openLog(){closeMenu();$('#logPanel').hidden=false;$('#btnLog').setAttribute('aria-expanded','true');logSeen=logTop();syncLogDot()}
function closeLog(){$('#logPanel').hidden=true;$('#btnLog').setAttribute('aria-expanded','false')}
function syncLogDot(){
  const open=!$('#logPanel').hidden,top=logTop();
  if(open||mode==='lobby')logSeen=top;
  if(top<logSeen)logSeen=top;   // 새 방에 들어가 기록 번호가 처음부터 시작
  const d=$('#btnLog .dot'),on=top>logSeen;if(d.hidden===on)d.hidden=!on;
}
$('#btnLog').addEventListener('click',e=>{e.stopPropagation();$('#logPanel').hidden?openLog():closeLog()});
document.addEventListener('click',e=>{if(!$('#logPanel').hidden&&!e.target.closest('#logPanel')&&!e.target.closest('#btnLog'))closeLog()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#logPanel').hidden){closeLog();$('#btnLog').focus()}});
/* 게임 방법 창 (메인 화면, 설정 메뉴) */
let rulesReturn=null;
function renderRules(id){   // 게임 제목 버튼 하나 → 누르면 게임 선택창
  $('#rulesPickName').textContent=GAMES[id].name;
  $('#rulesGames').innerHTML=GAME_IDS.map(g=>`<button type="button" role="option" aria-selected="${g===id}" data-g="${g}">${esc(GAMES[g].name)}</button>`).join('');
  closeRulesPick();
  $('#rulesBody').innerHTML=gameOf(id).rulesHTML;
}
function closeRulesPick(){$('#rulesGames').hidden=true;$('#rulesPick').setAttribute('aria-expanded','false')}
function openRules(){rulesReturn=document.activeElement;closeMenu();renderRules(mode==='lobby'?(GAME_IDS[cfg.gi]||'gura'):G.id);$('#rulesOv').hidden=false;$('#btnRulesClose').focus()}
function closeRules(){$('#rulesOv').hidden=true;if(rulesReturn&&rulesReturn.focus)rulesReturn.focus()}
$('#btnRulesLobby').addEventListener('click',openRules);
$('#mRules').addEventListener('click',openRules);
$('#btnRulesClose').addEventListener('click',closeRules);
$('#rulesPick').addEventListener('click',e=>{e.stopPropagation();const l=$('#rulesGames'),open=l.hidden;l.hidden=!open;$('#rulesPick').setAttribute('aria-expanded',open);sfx('tick');if(open){const c=l.querySelector('[aria-selected="true"]');if(c)c.focus()}});
$('#rulesGames').addEventListener('click',e=>{const b=e.target.closest('[data-g]');if(b){renderRules(b.dataset.g);sfx('tick');$('#rulesPick').focus()}});
$('#rulesOv').addEventListener('click',e=>{if(!e.target.closest('.rpick'))closeRulesPick()});
$('#rulesOv').addEventListener('click',e=>{if(e.target===e.currentTarget)closeRules()});
document.addEventListener('keydown',e=>{if(!$('#rulesOv').hidden){if(e.key==='Escape'){e.preventDefault();if(!$('#rulesGames').hidden){closeRulesPick();$('#rulesPick').focus()}else closeRules()}e.stopImmediatePropagation()}},true);   // 창이 열려 있는 동안 게임 단축키 막기
/* 테이블 설정 메뉴 (진행 기록 버튼 왼쪽) */
let leaveArmed=false,leaveTimer=null;
function disarmLeave(){leaveArmed=false;clearTimeout(leaveTimer);const b=$('#mLeave');b.classList.remove('arm');b.querySelector('span').textContent='탁자 떠나기'}
function closeMenu(){$('#menu').hidden=true;$('#btnMenu').setAttribute('aria-expanded','false');disarmLeave()}
$('#btnMenu').addEventListener('click',e=>{
  e.stopPropagation();const m=$('#menu');
  if(!m.hidden){closeMenu();return}
  closeLog();
  $('#menuInfo').innerHTML=roomInfoHTML();$('#mLeave').hidden=mode==='lobby';
  m.hidden=false;$('#btnMenu').setAttribute('aria-expanded','true');$('#mKeys').focus();
});
document.addEventListener('click',e=>{if(!$('#menu').hidden&&!e.target.closest('#menu')&&!e.target.closest('#btnMenu'))closeMenu()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#menu').hidden){closeMenu();$('#btnMenu').focus()}});
$('#mKeys').addEventListener('click',()=>{closeMenu();openKeys()});
$('#mLeave').addEventListener('click',()=>{
  if(!leaveArmed){leaveArmed=true;const b=$('#mLeave');b.classList.add('arm');b.querySelector('span').textContent='한 번 더';leaveTimer=setTimeout(disarmLeave,3000);return}
  closeMenu();leaveRoom();
});
/* 항복: 한 번 누르면 확인 상태, 3초 안에 다시 누르면 항복 */
let giveUpArmed=false,giveUpTimer=null;
function disarmGiveUp(){giveUpArmed=false;clearTimeout(giveUpTimer);const b=$('#btnGiveUp');b.classList.remove('arm');b.querySelector('span').textContent='항복'}
$('#btnGiveUp').addEventListener('click',()=>{
  if(!giveUpArmed){giveUpArmed=true;const b=$('#btnGiveUp');b.classList.add('arm');b.querySelector('span').textContent='한 번 더';giveUpTimer=setTimeout(disarmGiveUp,3000);return}
  disarmGiveUp();closeMenu();sendAct({t:'surrender'});
});
$('#btnCreate').addEventListener('click',createRoom);
$('#btnJoinCode').addEventListener('click',()=>{const c=$('#inCode').value.trim().toLowerCase();if(/^[a-z0-9]{4}$/.test(c))joinRoom(c);else setNote('#netNote','탁자 번호는 영문과 숫자 4자리입니다.',true)});
$('#inCode').addEventListener('keydown',e=>{if(e.key==='Enter')$('#btnJoinCode').click()});
$('#btnRandom').addEventListener('click',randomJoin);

/* 로비 설정 버튼: 라디오 그룹처럼 Tab으로 들어가고 ←→ (또는 A/D)로 값 변경 */
function buildSeg(id,key,unit,label){
  const box=$(id);
  box.setAttribute('role','radiogroup');box.setAttribute('aria-label',label);
  box.innerHTML=OPTS[key].map(v=>`<button type="button" role="radio" data-v="${v}" aria-pressed="${cfg[key]===v}" aria-checked="${cfg[key]===v}" tabindex="${cfg[key]===v?0:-1}">${OPT_HTML[key]?OPT_HTML[key](v):OPT_LABEL[key]?OPT_LABEL[key][v]:v+unit}</button>`).join('');
  const choose=b=>{cfg[key]=+b.dataset.v;box.querySelectorAll('button').forEach(x=>{const on=x===b;x.setAttribute('aria-pressed',on);x.setAttribute('aria-checked',on);x.tabIndex=on?0:-1});sfx('tick')};
  box.addEventListener('click',e=>{const b=e.target.closest('button');if(b)choose(b)});
  box.addEventListener('keydown',e=>{
    const k=e.key,bs=[...box.querySelectorAll('button')];
    let i=bs.findIndex(x=>x.getAttribute('aria-checked')==='true');
    if(k==='ArrowRight'||k==='ArrowDown'||e.code==='KeyD')i=Math.min(bs.length-1,i+1);
    else if(k==='ArrowLeft'||k==='ArrowUp'||e.code==='KeyA')i=Math.max(0,i-1);
    else if(k==='Home')i=0;else if(k==='End')i=bs.length-1;
    else return;
    e.preventDefault();choose(bs[i]);bs[i].focus();
  });
}
try{if(/SamsungBrowser/i.test(navigator.userAgent)&&matchMedia('(prefers-color-scheme: dark)').matches)$('#sdarkNote').hidden=false}catch(e){}
buildSeg('#segGame','gi','','게임');buildSeg('#segFast','fast','','게임 모드');
/* 빠른 모드가 없는 게임(G.noFast, 야추다이스)을 고르면 '게임 모드' 칸을 숨김 */
function syncFastField(){$('#segFast').closest('.field').hidden=!!gameOf(GAME_IDS[cfg.gi]).noFast}
syncFastField();['click','keydown'].forEach(ev=>$('#segGame').addEventListener(ev,syncFastField));
/* 방 만들기의 공개 방 스위치 */
function setPubSw(v){cfg.pub=v?1:0;const b=$('#swPub');b.classList.toggle('on',!!v);b.setAttribute('aria-checked',!!v)}
$('#swPub').addEventListener('click',()=>{setPubSw(!cfg.pub);sfx('tick')});/* 대기 시간·제한 시간 등은 대기실 방 설정에서 조절 (범위 밖이면 가까운 값으로) */
$('#inNick').value=store('gura-nick')||'나';
const invited=(()=>{const q=new URLSearchParams(location.search).get('room');if(q&&/^[a-z0-9]{4}$/i.test(q)){$('#inCode').value=q.toUpperCase();setNote('#netNote','초대받은 탁자입니다. 참가를 누르면 앉습니다.');return true}return false})();

/* 로비 Enter 흐름: 닉네임 → (초대 코드가 있으면 참가, 없으면 코드 칸), 방 이름 → 방 만들기 */
/* 로비 닉네임: 수정 버튼 → 입력칸, Enter·저장으로 확정, Esc로 취소 */
function openNickEdit(){$('#nickLine').hidden=true;$('#nickEdit').hidden=false;const i=$('#inNick');i.focus();i.select()}
function closeNickEdit(save){
  if(save){$('#inNick').value=($('#inNick').value.trim()||'나').slice(0,10);saveNick()}else $('#inNick').value=store('gura-nick')||'나';
  $('#nickEdit').hidden=true;$('#nickLine').hidden=false;showView(lobbyView,false);$('#btnNickEdit').focus();
}
$('#btnNickEdit').addEventListener('click',openNickEdit);
$('#btnNickSave').addEventListener('click',()=>closeNickEdit(true));
$('#inNick').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();closeNickEdit(true)}else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeNickEdit(false)}});
/* 음량 */
function applyVol(){
  if(SND.master)SND.master.gain.value=.55*SND.masterVol/100;
  if(SND.fx)SND.fx.gain.value=(SND.fxMute?0:SND.vol)/100;if(SND.bgm)SND.bgm.gain.value=(SND.bgmMute?0:SND.bgmVol)/100;
  document.querySelectorAll('.mv-ic').forEach(b=>{const m=b.dataset.ch==='all'?!SND.on:b.dataset.ch==='fx'?SND.fxMute:SND.bgmMute;b.classList.toggle('muted',m);b.setAttribute('aria-pressed',m);b.closest('.menu-vol').classList.toggle('muted',m)});   // 아이콘 누름 = 음소거(음량은 그대로)
  $('#masterV').textContent=SND.masterVol+'%';$('#inMaster').value=SND.masterVol;$('#mMaster').value=SND.masterVol;$('#mMasterV').textContent=SND.masterVol+'%';
  $('#volV').textContent=SND.vol+'%';$('#inVol').value=SND.vol;$('#mVol').value=SND.vol;$('#mVolV').textContent=SND.vol+'%';
  $('#bgmV').textContent=SND.bgmVol+'%';$('#inBgm').value=SND.bgmVol;$('#mBgm').value=SND.bgmVol;$('#mBgmV').textContent=SND.bgmVol+'%';
}
for(const id of ['#mBgm','#inBgm'])$(id).addEventListener('input',e=>{SND.bgmVol=+e.target.value;store('gura-bgm-vol',String(SND.bgmVol));if(SND.bgmMute){SND.bgmMute=false;store('gura-bgm-mute','0')}applyVol();audioOn();if(SND.bgmVol>0&&typeof BGM!=='undefined')BGM.start()});
$('#mVol').addEventListener('input',e=>{SND.vol=+e.target.value;store('gura-vol',String(SND.vol));if(SND.fxMute){SND.fxMute=false;store('gura-vol-mute','0')}applyVol()});
$('#mVol').addEventListener('change',()=>{audioOn();sfx('pick')});
$('#inVol').addEventListener('input',e=>{SND.vol=+e.target.value;store('gura-vol',String(SND.vol));if(SND.fxMute){SND.fxMute=false;store('gura-vol-mute','0')}applyVol()});
$('#inVol').addEventListener('change',()=>{audioOn();sfx('pick')});
for(const id of ['#mMaster','#inMaster']){
  $(id).addEventListener('input',e=>{SND.masterVol=+e.target.value;store('gura-master-vol',String(SND.masterVol));if(!SND.on)setSound(true);applyVol()});   // 움직이면 음소거 풀림
  $(id).addEventListener('change',()=>{audioOn();sfx('pick')});
}
document.querySelectorAll('.mv-ic').forEach(b=>b.addEventListener('click',e=>{
  e.preventDefault();if(b.dataset.ch==='all'){setSound(!SND.on);applyVol();return}
  const fx=b.dataset.ch==='fx';
  if(fx){SND.fxMute=!SND.fxMute;store('gura-vol-mute',SND.fxMute?'1':'0')}else{SND.bgmMute=!SND.bgmMute;store('gura-bgm-mute',SND.bgmMute?'1':'0')}
  applyVol();audioOn();
  if(fx&&!SND.fxMute)sfx('pick');if(!fx&&!SND.bgmMute&&SND.bgmVol>0&&typeof BGM!=='undefined')BGM.start();
}));
applyVol();
$('#inNick').addEventListener('change',saveNick);
$('#inTitle').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('#btnCreate').click()}});
let lobbyView='main';
function showView(v,focus=true){
  if(v==='create'&&FR.ok)v='main';   // 첫 화면에서는 천 꾸러미가 상차리기
  lobbyView=v;
  document.querySelectorAll('#lobby .view').forEach(el=>{el.hidden=el.dataset.view!==v});
  if(FR.ok&&mode==='lobby')$('#lobby').hidden=v==='main';   // 첫 화면: 로비 창 없이 탁자 하나 (찾아가기·설정 창만 위에 뜸)
  const nk=myNick();$('#nickShow').textContent=nk;document.querySelectorAll('.nickShow2').forEach(e=>e.textContent=nk);
  if(v==='join'&&mode==='lobby'&&!roomScan)refreshRooms();
  if(!focus)return;
  setTimeout(()=>{
    if($('#lobby').hidden&&!(FR.ok&&v==='main'&&mode==='lobby'))return;
    const coarse=window.matchMedia&&matchMedia('(pointer:coarse)').matches;   // 폰: 키보드가 바로 올라오지 않게
    const el=v==='join'?(/^[a-z0-9]{4}$/i.test($('#inCode').value.trim())?$('#btnJoinCode'):coarse?null:$('#btnRandom')):v==='settings'?$('#inVol'):v==='create'?$('#segFast [tabindex="0"]'):FR.ok?null:$('#lobby .mm');
    if(el){el.focus();if(el.select)el.select()}
  },30);
}
$('#lobby').addEventListener('click',e=>{const b=e.target.closest('[data-go]');if(b){if(b.dataset.pub)setPubSw(1);if(b.dataset.go==='create'&&FR.ok){showView('main',false);frontCreate();return}showView(b.dataset.go)}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#lobby').hidden&&$('#keysOv').hidden&&lobbyView!=='main'){e.preventDefault();if(lobbyView==='settings')saveNick();showView('main')}});
function focusLobby(){showView(invited?'join':'main')}
/* 페이지를 열었을 때 10분 안에 하던 방이 있으면 이어서 */
setTimeout(()=>{
  if(noPeerLib()||mode!=='lobby')return;
  let sv=null,gv=null;
  try{sv=JSON.parse(store('gura-host')||'null')}catch(e){}
  try{gv=JSON.parse(store('gura-guest')||'null')}catch(e){}
  if(sv&&sv.H&&soloTable(sv.H)){unstore('gura-host');sv=null}   // 사람이 혼자 봇과 하던 게임 중에 앱을 닫았으면 탁자를 떠난 것으로 (이어서 열지 않음)
  if(sv&&sv.H&&sv.H.code&&Date.now()-sv.at<RESUME_MS){restoreHost(sv,0);return}
  unstore('gura-host');
  if(gv&&/^[a-z0-9]{4}$/.test(gv.code||'')&&Date.now()-gv.at<RESUME_MS){showView('join');$('#inCode').value=gv.code.toUpperCase();joinRoom(gv.code);return}
  unstore('gura-guest');
},0);
focusLobby();

