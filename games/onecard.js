/* ===== 원카드 게임 모듈 =====
   공통 코드(index.html)가 GAMES.onecard의 함수를 불러서 이 게임의 규칙·봇·카드·화면을 그림.
   2~6명. 같은 무늬나 같은 숫자·같은 기호를 내서 손패를 먼저 비움. 클래식은 한 사람이 남을 때까지, 빠른 모드는 1등이 나오면 끝.
   카드 60장. id: 0~39 = 숫자 순번(0~9 = A,2,…,10)*4 + 무늬(0~3 = ♦ ♣ ♥ ♠), 40~43 +2, 44~47 리버스, 48~51 금지, 52~55 색 바꾸기(★), 56~59 +4(★)
   숫자 카드에는 능력이 없고 J·Q·K는 없음. 받아치기는 공식 룰대로 없고, 설정 '겹치기'를 켜면 +2 위에 +2·+4, +4 위에 +4·지정 무늬 +2를 낼 수 있음.
   +4는 언제든 낼 수 있고 다음 사람이 도전할 수 있음(공식 룰): 낸 사람에게 그때 무늬 카드가 있었으면 낸 사람이 먹고, 없었으면 도전자가 2장 더 먹음.
   원카드 버튼은 언제나 눌림: 1장 남은 본인이 먼저 누르면 안전, 남이 먼저 누르면 그 사람이 2장, 잡을 사람이 없으면 누른 사람이 1장.
   판 ph: turn → (도전) reveal → turn … → done. 화면은 기록(o.ev)을 재생해 카드가 내려앉을 때 무늬·누적 장수가 바뀜 */
(function(){
const G={id:'onecard',name:'원카드',short:'원카드',lead:'손패를 먼저 비우는 카드 게임',dealAnim:true,maxHi:6,minN:2};

/* ---------- 규칙 값 ---------- */
const WRONG=2,FALSE=1,CH_FAIL=2,RV_MS=2300,GRACE_MS=1200;
const FLY_MS=420,FLY_H=.7;

/* ---------- 카드 ---------- */
const CN=60;
const kindOf=id=>id<40?'n':id<44?'two':id<48?'rev':id<52?'skip':id<56?'wild':'four';
const suitOf=id=>id<52?id&3:-1,rkOf=id=>id>>2,isStar=id=>id>=52;
const RK=['A','2','3','4','5','6','7','8','9','10'],SUITS=['♦','♣','♥','♠'],SUIT_COL=['#c53026','#34404f','#c53026','#34404f'];
const SYM={two:'+2',rev:'⇄',skip:'⊘',wild:'★',four:'+4'};
const labelOf=id=>{const k=kindOf(id);return k==='n'?RK[rkOf(id)]:SYM[k]};
const cardStr=id=>(isStar(id)?'★':SUITS[suitOf(id)])+(kindOf(id)==='wild'?'':labelOf(id));
/* 손패 정렬: 무늬별로 숫자 다음 기능 카드, 별 카드는 맨 뒤 */
const sortKey=id=>isStar(id)?1000+id:suitOf(id)*100+(id<40?rkOf(id):20+(id>>2));
const cmpCard=(a,b)=>sortKey(a)-sortKey(b);
/* 지금 낼 수 있나. S={top,suit,atk,stack} */
function fits(id,S){
  const k=kindOf(id),tk=kindOf(S.top);
  if(S.atk){
    if(!S.stack)return false;
    return tk==='two'?k==='two'||k==='four':k==='four'||(k==='two'&&suitOf(id)===S.suit);
  }
  if(isStar(id)||suitOf(id)===S.suit)return true;
  return k==='n'?tk==='n'&&rkOf(id)===rkOf(S.top):k===tk;
}
Object.assign(G,{labelOf,cmpCard});
G.cardHTML=(id,extra)=>{
  const s=isStar(id),t=labelOf(id),su=s?'':SUITS[suitOf(id)],n=kindOf(id)==='n';
  return `<button type="button" class="card ${s?'joker ':''}${n?'':'oc-a '}${extra||''}" data-id="${id}"${s?'':` style="--rc:${SUIT_COL[suitOf(id)]}"`} aria-label="${cardStr(id)}">${trumpCorner(t,su,true)}<span class="big">${n?su:t}</span><span class="cn2" aria-hidden="true">${t}</span></button>`;
};
G.drawFace=function(g,w,h,id){
  const s=isStar(id),n=kindOf(id)==='n',RC=s?JOKER_C:SUIT_COL[suitOf(id)],k=w/60,t=labelOf(id);
  g.clearRect(0,0,w,h);
  g.save();rr(g,0,0,w,h,8*k);g.clip();g.fillStyle=s?'#3b2a1f':'#fffcf5';g.fillRect(0,0,w,h);if(!s){g.fillStyle=RC;g.fillRect(0,0,w,3*k)}g.restore();
  g.strokeStyle=s?RC:'#e3d4bb';g.lineWidth=s?2*k:k;rr(g,g.lineWidth/2,g.lineWidth/2,w-g.lineWidth,h-g.lineWidth,8*k);g.stroke();
  g.fillStyle=RC;drawTrumpCorner(g,k,t,s?'':SUITS[suitOf(id)],true);
  g.textAlign='center';g.textBaseline='middle';
  if(n||kindOf(id)==='wild'){g.font=`${40*k}px sans-serif`;g.fillText(n?SUITS[suitOf(id)]:'★',w/2,50*k)}
  else{g.font=`700 ${(t.length>1?29:36)*k}px "IBM Plex Mono", "Jua", sans-serif`;g.fillText(t,w/2,50*k)}
  g.save();g.translate(w-6*k,h-3*k);g.rotate(Math.PI);g.font=`600 ${13*k}px "IBM Plex Mono", "Jua", monospace`;g.textAlign='left';g.textBaseline='top';g.fillText(t,0,0);g.restore();
};

/* ---------- 규칙 설명·방 설정 ---------- */
G.rulesHTML='<ol class="rules"><li><b>목표</b> : 손패를 먼저 비웁니다. 클래식은 한 사람이 남을 때까지, 빠른 모드는 1등이 나오면 끝납니다</li><li><b>내기</b> : 맨 위 카드와 <b>무늬</b>나 <b>숫자·기호</b>가 같은 카드를 냅니다. 별 카드는 언제든 낼 수 있습니다</li><li><b>뽑기</b> : 내지 않고 1장을 뽑을 수 있습니다. 뽑은 카드를 낼 수 있으면 바로 내거나 넘깁니다</li><li><b>+2</b> : 다음 사람이 2장을 먹고 차례를 넘깁니다</li><li><b>⇄ 리버스</b> : 도는 방향이 바뀝니다. 2명이면 금지와 같습니다</li><li><b>⊘ 금지</b> : 다음 사람을 건너뜁니다</li><li><b>★ 색 바꾸기</b> : 다음 무늬를 정합니다</li><li><b>★ +4</b> : 다음 무늬를 정하고 다음 사람이 4장을 먹고 차례를 넘깁니다</li><li><b>도전</b> : +4를 받으면 받기 대신 도전할 수 있습니다. 낸 사람의 손패를 보고, 그때 무늬의 카드가 있었으면 성공입니다. 성공하면 낸 사람이 먹고 내 차례를 그대로 합니다. 실패하면 2장을 더 먹고 차례를 넘깁니다</li><li><b>원카드</b> : 1장 남으면 원카드 버튼을 먼저 누릅니다. 다른 사람이 먼저 누르면 2장을 먹습니다. 다음 사람이 내거나 뽑으면 기회가 끝납니다. 잡을 사람이 없을 때 누르면 내가 1장을 먹습니다</li><li><b>겹치기</b> (설정) : +2에는 +2나 +4, +4에는 +4나 지정 무늬의 +2를 내서 장수를 쌓아 넘깁니다</li><li><b>제한 시간</b> : 시간이 지나면 뽑거나 받고 차례를 넘깁니다</li></ol>';
G.modeDesc=['한 사람이 남을 때까지','1등이 나오면 끝'];
G.defaults={max:6,turn:20,hand:7,stack:0};
G.roomSet=[
  {k:'turn',label:'제한 시간',unit:'초',lo:5,hi:60,step:5,desc:'시간이 지나면 뽑거나 받고 차례를 넘깁니다'},
  {k:'hand',label:'시작 장수',unit:'장',lo:5,hi:8,step:1,desc:'처음 나눠 주는 카드 수입니다'}];
G.ruleSet=[{k:'stack',label:'겹치기',desc:'+2에는 +2나 +4, +4에는 +4나 지정 무늬의 +2를 내서 장수를 쌓아 넘깁니다'}];
G.cfgChips=c=>`<span class="chip">시작 <b>${+c.hand||7}장</b></span><span class="chip">겹치기 <b>${c.stack?'켜짐':'꺼짐'}</b></span><span class="chip">제한 시간 <b>${+c.turn||20}초</b></span>`;
G.cfgSum=c=>`시작 ${+c.hand||7}장 · 겹치기 ${c.stack?'켜짐':'꺼짐'} · 제한 시간 ${+c.turn||20}초`;
G.roomSub=()=>'2~6명 카드 게임';
G.pubExtra=()=>({});
G.cardInfo=()=>'<p class="cardinfo">카드 60장 · 숫자 40장 · 기능 12장 · 별 8장</p>';
G.rankTitle=()=>'';
G.finLabel=f=>f+'등';
G.noEmotes=[];
G.keys={onecard:'KeyV',ocChal:'KeyB'};
G.keyActions=[{a:'onecard',n:'원카드',d:'1장 남았을 때 선언하거나 남을 잡습니다'},{a:'ocChal',n:'도전',d:'+4를 낸 사람의 손패를 확인합니다'}];

/* ---------- 방장 엔진 ---------- */
const alive=()=>H.players.filter(p=>!p.finished);
const stateOf=()=>{const O=H.oc;return {top:O.disc[O.disc.length-1],suit:O.suit,atk:O.atk,stack:!!H.cfg.stack}};
function nextAlive(i,dir){const n=H.players.length;for(let k=1;k<=n;k++){const j=((i+dir*k)%n+n)%n;if(!H.players[j].finished)return j}return -1}
function setTurn(i){H.turn=i;H.deadline=clock()+(+H.cfg.turn||20)*1000;H.botActAt=H.players[i].bot?clock()+rand(900,2100):0;mark()}
const pushEv=e=>{const O=H.oc;e.q=++O.sq;O.ev.push(e);if(O.ev.length>12)O.ev.shift();return e};
/* n장 뽑기. 더미가 없으면 맨 위만 남기고 섞음. 실제로 뽑은 카드 목록을 돌려줌 */
function draw(seat,n){
  const O=H.oc,p=H.players[seat],got=[];
  for(let j=0;j<n;j++){
    if(!O.deck.length){
      const top=O.disc.pop();O.deck=shuffle(O.disc);O.disc=top==null?[]:[top];
      if(!O.deck.length)break;
      addLog('버린 카드를 섞습니다.','sys');pushEv({k:'m',dc:O.deck.length});
    }
    got.push(O.deck.pop());
  }
  p.hand.push(...got);p.hand.sort(cmpCard);
  if(got.length)O.miss[seat]=O.miss[seat].map(x=>x*.6);   // 새로 뽑았으니 '그 무늬가 없다'는 기억은 흐려짐
  if(got.length)pushEv({k:'d',s:seat,n:got.length});
  if(O.uno===seat&&p.hand.length!==1)closeWindow();
  return got;
}
function closeWindow(){const O=H.oc;O.uno=-1;O.botCall=null}
/* 1장이 된 순간의 봇 반응. 단계별 [확률, 최소 ms, 최대 ms]. 가장 빠른 한 명만 누름. 헛누름은 하지 않음 */
const SELF_CALL=[[.8,1000,2000],[.95,700,1200],[1,400,700]],CATCH_CALL=[[.6,1000,2000],[.8,800,1500],[.95,500,900]];
function openWindow(seat){
  const O=H.oc;let best=null;
  O.uno=seat;O.botCall=null;
  H.players.forEach((p,i)=>{
    if(p.finished||!p.bot||p.away)return;
    const [pr,lo,hi]=(i===seat?SELF_CALL:CATCH_CALL)[Math.min(2,botLv(p))];
    if(Math.random()>=pr)return;
    const at=clock()+rand(lo,hi);if(!best||at<best.at)best={s:i,at};
  });
  O.botCall=best;
}
function endGame(){
  const O=H.oc;H.phase='over';H.botActAt=0;H.deadline=0;O.ph='done';O.rv=null;closeWindow();mark();
  H.players.forEach((p,i)=>{if(p.bot&&Math.random()<.5)botEmote(i,'gg',800+Math.random()*1600)});
}
/* 남은 사람이 한 명이면 순위를 매기고 끝냄 */
function checkOver(){
  const L=alive();if(L.length>1)return false;
  if(L[0]){L[0].finished=true;L[0].rank=H.oc.rankHi;L[0].hand=[]}
  endGame();return true;
}
function finish(seat){
  const O=H.oc,p=H.players[seat];p.finished=true;p.rank=O.rankLo++;addLog(`${p.name} ${p.rank}등`,'fin');
  if(H.cfg.fast&&p.rank===1){
    const n=H.players.length,dist=q=>(H.players.indexOf(q)-seat+n)%n;
    alive().sort((a,b)=>a.hand.length-b.hand.length||dist(a)-dist(b)).forEach(q=>{q.rank=O.rankLo++;q.finished=true});
    endGame();return true;
  }
  return checkOver();
}
function passOn(seat){H.oc.drawn=-1;setTurn(nextAlive(seat,H.oc.dir))}
/* 공격을 받음: 먹고 차례를 넘김 */
function takeHit(seat){
  const O=H.oc,n=O.atk,p=H.players[seat];O.atk=0;O.ch=null;
  draw(seat,n);addLog(`${p.name} ${n}장 받음`,'lie');
}
function doPlay(seat,id,suit){
  const O=H.oc,p=H.players[seat],k=kindOf(id),prev=O.suit;
  p.hand.splice(p.hand.indexOf(id),1);O.disc.push(id);O.drawn=-1;closeWindow();H.seatNote={};
  if(suitOf(id)>=0)O.miss[seat][suitOf(id)]=0;
  O.suit=isStar(id)?suit:suitOf(id);
  if(k==='two'){O.atk+=2;O.ch=null}
  if(k==='four'){O.atk+=4;O.ch={by:seat,suit:prev,had:p.hand.some(x=>suitOf(x)===prev)}}
  if(k==='rev')O.dir=-O.dir;
  addLog(`${p.name} ${cardStr(id)}${isStar(id)?` → ${SUITS[suit]}`:''}`);
  pushEv({k:'p',s:seat,id,su:O.suit,dir:O.dir,atk:O.atk});
  if(!p.hand.length){if(finish(seat))return}
  else if(p.hand.length===1)openWindow(seat);
  if(k==='two'||k==='four'){
    const nx=nextAlive(seat,O.dir);
    if(H.cfg.stack||k==='four'){setTurn(nx);return}
    takeHit(nx);passOn(nx);return;
  }
  if(k==='skip'||(k==='rev'&&alive().length===2)){setTurn(nextAlive(nextAlive(seat,O.dir),O.dir));return}
  passOn(seat);
}
function doDraw(seat){
  const O=H.oc,su=O.suit;closeWindow();
  const got=draw(seat,1);
  O.miss[seat][su]=1;   // 낼 수 있는데 뽑는 사람도 있지만 대개 그 무늬가 없음 (모두가 보는 정보)
  if(got.length&&fits(got[0],stateOf())){O.drawn=got[0];setTurn(seat);return}
  passOn(seat);
}
function doChallenge(seat){
  const O=H.oc,c=O.ch;closeWindow();
  O.ph='reveal';O.rv={by:c.by,to:seat,ok:c.had?1:0,hand:H.players[c.by].hand.slice(),at:clock()+RV_MS};
  H.botActAt=0;H.deadline=clock()+864e5;
  addLog(`${H.players[seat].name} 도전`,'sp');pushEv({k:'r',s:seat,by:c.by});mark();
}
function endReveal(){
  const O=H.oc,R=O.rv,n=O.atk,to=H.players[R.to],by=H.players[R.by];
  O.rv=null;O.ph='turn';O.atk=0;O.ch=null;
  pushEv({k:'x',ok:R.ok});
  O.bl[R.by].c++;if(R.ok)O.bl[R.by].y++;
  addLog(`도전 ${R.ok?'성공':'실패'}`,R.ok?'fin':'lie');
  if(R.ok){
    if(!by.finished)draw(R.by,n);
    if(!to.finished){setTurn(R.to);return}
  }else if(!to.finished)draw(R.to,n+CH_FAIL);
  passOn(R.to);
}
/* 원카드 버튼 */
function doOne(seat){
  const O=H.oc,p=H.players[seat],t=clock();
  if(O.uno===seat){closeWindow();O.grace=t+GRACE_MS;addLog(`${p.name} 원카드!`,'sp');pushEv({k:'c',s:seat});mark();return}
  if(O.uno>=0){
    const v=O.uno,q=H.players[v];closeWindow();O.grace=t+GRACE_MS;
    addLog(`${p.name} 원카드! ${q.name} ${WRONG}장`,'lie');pushEv({k:'c',s:seat,v});draw(v,WRONG);mark();return;
  }
  if(t<O.grace)return;   // 간발의 차로 늦은 누름은 벌칙 없음
  addLog(`${p.name} 헛누름 ${FALSE}장`,'lie');pushEv({k:'f',s:seat});draw(seat,FALSE);mark();
}
const suitCounts=hand=>{const c=[0,0,0,0];for(const id of hand)if(!isStar(id))c[suitOf(id)]++;return c};
const bestSuit=hand=>{const c=suitCounts(hand);let b=Math.random()*4|0;for(let i=0;i<4;i++)if(c[i]>c[b])b=i;return b};
/* 어려움의 무늬 지정: 내가 많이 가졌고 다음 사람이 없어 보이는 무늬 */
function hardSuit(seat,hand){
  const O=H.oc,c=suitCounts(hand),nx=nextAlive(seat,O.dir),m=nx>=0?O.miss[nx]:[0,0,0,0];let b=0,top=-1e9;
  for(let i=0;i<4;i++){const v=c[i]*2+m[i]*3+Math.random()*.5;if(v>top){top=v;b=i}}
  return b;
}
const pickSuit=(seat,lv,hand)=>lv>=2?hardSuit(seat,hand):bestSuit(hand);
/* 낼 카드 점수 (보통·어려움). 남의 손패는 보지 않고 장수·낸 카드·뽑은 무늬만 씀 */
function playScore(seat,id,lv){
  const O=H.oc,p=H.players[seat],rest=p.hand.filter(x=>x!==id),c=suitCounts(rest),k=kindOf(id),su=suitOf(id);
  let v=k==='wild'?(rest.length<=1?30:-18):k==='four'?(rest.length<=1?30:-18):(k==='n'?10:12)+c[su]*2;   // 별 카드는 언제든 낼 수 있어 끝까지 아낌 (일찍 쓰면 승률이 떨어짐: 대전으로 확인)
  if(rest.length===1&&(isStar(rest[0])||suitOf(rest[0])===su))v+=8;   // 다음 차례에 나갈 수 있게
  if(lv>=2){
    const nx=nextAlive(seat,O.dir),nn=nx>=0?H.players[nx].hand.length:99,atk=k==='two'||k==='four';
    if(nn<=2){if(atk)v+=k==='four'?48:32;else if(k==='skip')v+=26;else if(k==='rev')v+=14}
    if(su>=0&&nx>=0)v+=O.miss[nx][su]*8;
  }
  return v+Math.random()*(lv>=2?1:3);
}
/* 도전: 나온 카드로 '그 무늬가 있었을 확률'을 어림잡고, 보통은 그 값만, 어려움은 뽑은 기억과 그 사람이 허세를 부린 기록까지 씀 */
function wantChallenge(seat,lv){
  const O=H.oc,c=O.ch,mine=H.players[seat].hand,by=H.players[c.by];
  const seen=O.disc.concat(mine),left=(60-seen.length)||1,suitLeft=Math.max(0,13-seen.filter(x=>suitOf(x)===c.suit).length);
  let has=1-Math.pow(1-suitLeft/left,by.hand.length);
  if(lv<=1)return has>.8&&Math.random()<.3;
  has*=1-O.miss[c.by][c.suit]*.9;
  const b=O.bl[c.by],bluff=(b.y+1)/(b.c+3);
  return has*bluff>.2;
}
/* 쉬움: 낼 수 있는 카드 중 무작위(별 카드는 아낌), 공격은 70% 겹치고 도전은 25%
   보통: 점수로 고름, 숫자·많이 가진 무늬부터 내고 별 카드는 아낌. 어려움: 다음 사람의 장수·없어 보이는 무늬까지 봄 */
function botAct(i){
  const O=H.oc,p=H.players[i],S=stateOf(),lv=Math.min(2,botLv(p));
  const L=p.hand.filter(id=>fits(id,S));
  if(O.atk){
    if(O.ch&&(lv?wantChallenge(i,lv):Math.random()<.25)){doChallenge(i);return}
    if(L.length&&Math.random()<(lv===0?.7:lv===1?.9:1)){
      const id=lv?L.slice().sort((a,b)=>kindOf(a).length-kindOf(b).length||a-b).find(x=>kindOf(x)==='two')??L[0]:L[Math.random()*L.length|0];
      doPlay(i,id,pickSuit(i,lv,p.hand.filter(x=>x!==id)));return;
    }
    takeHit(i);passOn(i);return;
  }
  if(O.drawn>=0){doPlay(i,O.drawn,pickSuit(i,lv,p.hand.filter(x=>x!==O.drawn)));return}
  if(!L.length){doDraw(i);return}
  let id;
  if(lv){let top=-1e9;for(const x of L){const v=playScore(i,x,lv);if(v>top){top=v;id=x}}}
  else{const plain=L.filter(x=>!isStar(x)),from=plain.length?plain:L;id=from[Math.random()*from.length|0]}
  doPlay(i,id,pickSuit(i,lv,p.hand.filter(x=>x!==id)));
}
function timeout(){
  const O=H.oc,i=H.turn,p=H.players[i];
  addLog(`${p.name} 시간 초과`,'sys');
  if(O.atk){takeHit(i);passOn(i)}
  else if(O.drawn>=0)passOn(i);
  else{doDraw(i);if(O.drawn>=0)passOn(i)}
  if(H.phase==='play'&&H.players[i])H.seatNote[i]='시간 초과';
}
function doSurrender(seat){
  const O=H.oc,p=H.players[seat];
  if(H.phase!=='play'||!p||p.finished)return;
  O.disc.unshift(...p.hand);p.hand=[];p.finished=true;p.surrendered=true;p.rank=O.rankHi--;
  addLog(`${p.name} ${p.deserter?'탈주':'항복'}`,'lie');
  if(O.uno===seat)closeWindow();
  if(O.ch&&O.ch.by===seat)O.ch=null;
  if(checkOver())return;
  if(O.ph==='turn'&&H.turn===seat){if(O.atk&&!H.cfg.stack&&!O.ch)O.atk=0;passOn(seat)}
  else mark();
}
G._test={DECK:[...Array(CN).keys()],kindOf,suitOf,rkOf,fits,botAct,GRACE_MS,RV_MS};
G.engine={
  start(){
    Object.assign(H,{phase:'play',log:[],seatNote:{},field:[],last:null,reveal:null,shouts:[],pending:null,rankNext:1,known:{},turn:0,botActAt:0,deadline:0});
    const n=H.players.length,hand=+H.cfg.hand||7,deck=shuffle([...Array(CN).keys()]);
    H.players.forEach(p=>{p.finished=false;p.rank=null;p.surrendered=false;p.hand=deck.splice(0,hand).sort(cmpCard)});
    const at=deck.findIndex(id=>kindOf(id)==='n'),top=deck.splice(at,1)[0];   // 시작 카드는 숫자 카드만
    H.oc={gn:((H.oc&&H.oc.gn)||0)+1,deck,disc:[top],suit:suitOf(top),dir:1,atk:0,ch:null,drawn:-1,uno:-1,grace:0,botCall:null,ph:'turn',rv:null,ev:[],sq:0,rankLo:1,rankHi:n,miss:H.players.map(()=>[0,0,0,0]),bl:H.players.map(()=>({c:0,y:0}))};
    const first=Math.random()*n|0;
    setTurn(first);addLog(`${n}명 시작. ${H.players[first].name}부터 냅니다.`,'sys');
  },
  act(seat,a){
    const O=H.oc;
    if(!O||H.phase!=='play'||seat<0||seat>=H.players.length)return;
    if(a.t==='surrender'){doSurrender(seat);return}
    const p=H.players[seat];if(p.finished||dealing())return;
    if(a.t==='one'){doOne(seat);return}
    if(O.ph!=='turn'||H.turn!==seat)return;
    if(a.t==='play'){
      const id=a.id;
      if(!Number.isInteger(id)||!p.hand.includes(id)||(O.drawn>=0&&id!==O.drawn)||!fits(id,stateOf()))return;
      if(isStar(id)&&!(Number.isInteger(a.suit)&&a.suit>=0&&a.suit<4))return;
      doPlay(seat,id,a.suit);
    }else if(a.t==='draw'){
      if(O.atk){takeHit(seat);passOn(seat)}
      else if(O.drawn<0)doDraw(seat);
    }else if(a.t==='pass'){if(O.drawn>=0)passOn(seat)}
    else if(a.t==='ch'){if(O.atk&&O.ch)doChallenge(seat)}
  },
  tick(t){
    const O=H.oc;if(!O||H.phase!=='play')return;
    if(O.botCall&&t>=O.botCall.at){const s=O.botCall.s;O.botCall=null;if(!H.players[s].finished)doOne(s)}
    if(O.ph==='reveal'){if(t>=O.rv.at)endReveal();return}
    if(O.ph!=='turn')return;
    const cur=H.players[H.turn];
    if(t>=H.deadline)timeout();
    else if(cur.bot&&H.botActAt&&t>=H.botActAt&&!(cur.away&&t<cur.awayAt+AWAY_WAIT))botAct(H.turn);
  },
  snap(s,you,t){
    const O=H.oc,mine=O.ph==='turn'&&H.turn===you;
    s.o={gn:O.gn,top:O.disc[O.disc.length-1],su:O.suit,dir:O.dir,atk:O.atk,dc:O.deck.length,ph:O.ph,sq:O.sq,st:H.cfg.stack?1:0,ev:O.ev.map(e=>({...e})),ch:mine&&O.atk&&O.ch?1:0,dr:mine?O.drawn:-1};
    if(O.rv){s.o.rv={by:O.rv.by,to:O.rv.to};if(you===O.rv.to)s.o.rv.h=O.rv.hand}
    s.gr=0;s.dl=O.ph==='turn'&&H.phase==='play'?Math.max(0,Math.round(H.deadline-t)):0;
    if(O.ph!=='turn')delete s.t;
  },
  restore(ms){const O=H.oc;if(!O)return;if(O.rv)O.rv.at+=ms;if(O.botCall)O.botCall.at+=ms;if(O.grace)O.grace+=ms},
  emoPhase:ph=>ph==='play'||ph==='over'
};

/* ---------- 화면: 조작 ---------- */
let elBox=null,elOne=null,elCh=null,elSuits=null,elRv=null,elD=null;
let lockAt=-1e9,pickId=null,oneAt=-1e9,lastRv='',lastD='',layKey='';
const iSeat=()=>{const i=myIdx();return i>=0&&V&&V.ps&&i<V.ps.length};
const myTurn=()=>!!(V&&V.o&&V.st==='play'&&V.o.ph==='turn'&&iSeat()&&V.t===myIdx()&&!dealingV());
const stateV=()=>{const o=V.o;return {top:o.top,suit:o.su,atk:o.atk,stack:!!o.st}};
const legalV=id=>myTurn()&&(V.o.dr<0||V.o.dr===id)&&fits(id,stateV());
const picked=()=>{const a=[...sel];return a.length===1&&legalV(a[0])?a[0]:null};
const live1=()=>!!(V&&V.o&&V.st==='play'&&iSeat()&&!V.ps[myIdx()].f&&!dealingV());
function closePick(){pickId=null;if(elSuits)elSuits.hidden=true}
G.handMarks=(i,h,hand)=>{
  if(sel.size>1){const keep=[...sel].pop();sel.clear();sel.add(keep)}
  if(pickId!=null&&!sel.has(pickId))closePick();
  for(const el of hand.children){const id=+el.dataset.id;el.classList.toggle('sel',sel.has(id));el.classList.toggle('match',legalV(id))}
};
G.me=()=>{$('#numpick').hidden=true};
function sendPlay(id,suit){if(clock()-lockAt<300)return;lockAt=clock();sel.clear();closePick();sendAct({t:'play',id,suit})}
G.play=()=>{
  const id=picked();
  if(id==null){sfx('no');return}
  if(isStar(id)){pickId=id;elSuits.hidden=false;return}
  sendPlay(id);
};
G.pass=()=>{
  if(!myTurn()||clock()-lockAt<300){sfx('no');return}
  lockAt=clock();sel.clear();closePick();sendAct({t:V.o.dr>=0?'pass':'draw'});
};
function pressOne(){
  if(!live1()){sfx('no');return}
  if(clock()-oneAt<400)return;oneAt=clock();sfx('play',1);sendAct({t:'one'});
}
function keyTags(){for(const [el,k] of [[elOne,KEYS.onecard],[elCh,KEYS.ocChal]]){const t=keyLabel(k),s=el.querySelector('small');if(s.textContent!==t)s.textContent=t}}
function pressCh(){if(!myTurn()||!V.o.ch){sfx('no');return}closePick();sendAct({t:'ch'})}
G.keyPhase=st=>st==='play';
G.onKey=(act,e)=>{
  if(act==='onecard'){if(!e.repeat)pressOne();return true}
  if(act==='ocChal'){if(!e.repeat)pressCh();return true}
  return false;
};
G.preView=()=>{};
G.postView=()=>{};
G.buttons=()=>{
  const pb=$('#btnPlay'),ps=$('#btnPass'),t=myTurn(),ok=t&&picked()!=null;
  $('#btnGura').hidden=true;ps.hidden=false;pb.hidden=false;   // 내기 버튼은 CSS로 숨김: 끌어서 내기·Space가 이 버튼 상태를 씀
  pb.disabled=!ok;pb.classList.toggle('ready',ok);
  if($('#playMain').textContent!=='내기')$('#playMain').textContent='내기';
  const sub=keyLabel(KEYS.play);if($('#playSub').textContent!==sub)$('#playSub').textContent=sub;
  ps.disabled=!t;
  const lab=(V&&V.o&&V.o.atk?'받기':V&&V.o&&V.o.dr>=0?'넘기기':'뽑기')+`<small>${esc(keyLabel(KEYS.pass))}</small>`;
  if(ps.dataset.oc!==lab){ps.dataset.oc=lab;ps.innerHTML=lab}
};
G.logCue=()=>false;
G.cues=(v,pv)=>{
  const a=v.o,b=pv&&pv.o;if(!a||!b||M.on||a.gn!==b.gn)return;   // 3D에서는 재생하며 (land)
  for(const e of a.ev)if(e.q>b.sq)evCue(e);
};
const sndHit=()=>{tone(150,.3,{type:'triangle',vol:.2});tone(110,.4,{type:'triangle',vol:.16,at:.14})};
const sndCall=()=>{tone(660,.1,{type:'triangle',vol:.16});tone(880,.16,{type:'triangle',vol:.16,at:.08})};
const nameOf=i=>V&&V.ps&&V.ps[i]?V.ps[i].n:'';
function evCue(e){
  if(e.k==='p'){sfx('play',1);if(e.atk)sndHit()}
  else if(e.k==='c'){sndCall();showBubble(e.s,'<span class="bt">원카드!</span>',2000,'one')}
  else if(e.k==='f'){sfx('no')}
  else if(e.k==='r'){fxSay('도전','#b5521e')}
  else if(e.k==='x'){fxSay(e.ok?'도전 성공':'도전 실패',e.ok?'#2f7a3a':'#b03a2e');if(e.ok)sndCall();else sndHit()}
}

/* ---------- 3D: 공통 앉은 카메라 위의 물건 ----------
   가운데 왼쪽 = 뽑을 더미, 오른쪽 = 버린 더미, 그 위 공중 = 지정 무늬·누적 장수 홀로그램, 둘레 펠트 = 도는 방향 */
const PX=.72,HY=1.02,NW=640,NH=400;
const M={on:false,built:false,fail:false,root:null,raf:0,deck:null,num:null,arrow:null,fly:[],q:[],gn:-1,sq:0,dc:0,dir:1,dirAt:-1e9,atk:0,su:0,top:-1,key:'',nextFly:0};
const ez=k=>k<=0?0:k>=1?1:k*k*(3-2*k);
function drawNum(main,tag,col){
  const L=M.num,g=L.c.getContext('2d');
  g.clearRect(0,0,NW,NH);g.textAlign='center';g.textBaseline='middle';g.shadowColor=col;g.shadowBlur=30;g.fillStyle=col;
  if(main){g.font='700 210px "IBM Plex Mono", "Jua", sans-serif';g.fillText(main,NW/2,tag?140:190);g.fillText(main,NW/2,tag?140:190)}
  if(tag){g.font=`700 ${main?120:210}px "IBM Plex Mono", "Jua", sans-serif`;g.fillText(tag,NW/2,main?320:190)}
  g.shadowBlur=0;L.t.needsUpdate=true;
}
function build(){
  if(M.built||M.fail)return M.built;
  if(!T.ok||typeof THREE==='undefined'){M.fail=true;return false}
  try{
    const root=new THREE.Group();root.visible=false;T.scene.add(root);M.root=root;
    const k=T.cardK||1,side=new THREE.MeshBasicMaterial({color:0xefe4cf});
    const deck=new THREE.Mesh(new THREE.BoxGeometry(.62*k,1,.9*k),[side,side,T.back,side,side,side]);deck.position.set(-PX,.03,0);deck.castShadow=true;root.add(deck);M.deck=deck;
    const c=document.createElement('canvas');c.width=NW;c.height=NH;const t=new THREE.CanvasTexture(c);t.anisotropy=4;
    const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true,depthTest:false,depthWrite:false}));sp.position.set(PX,HY,0);sp.scale.set(1.76,1.1,1);sp.renderOrder=55;root.add(sp);
    M.num={c,t,sp};
    const at=canvasTex(512,512,(g,w,h)=>{
      g.strokeStyle=g.fillStyle='#ffb04a';g.shadowColor='#ff8a2a';g.shadowBlur=12;g.lineWidth=11;g.lineCap='round';
      for(const s of [0,Math.PI]){
        const a0=s+.42,a1=s+Math.PI-.42,r=224;g.beginPath();g.arc(w/2,h/2,r,-a0,-a1,true);g.stroke();
        const x=w/2+Math.cos(-a1)*r,y=h/2+Math.sin(-a1)*r,d=-a1-Math.PI/2;
        g.save();g.translate(x,y);g.rotate(d);g.beginPath();g.moveTo(26,0);g.lineTo(-12,-23);g.lineTo(-12,23);g.closePath();g.fill();g.restore();
      }
    });
    const ar=new THREE.Mesh(new THREE.PlaneGeometry(3.5,3.5),new THREE.MeshBasicMaterial({map:at,transparent:true,opacity:.55,depthWrite:false}));
    ar.rotation.order='YXZ';ar.rotation.x=-Math.PI/2;ar.position.y=.021;ar.renderOrder=1;root.add(ar);M.arrow=ar;
    M.built=true;
  }catch(e){M.fail=true;try{console.warn('원카드 3D 준비 실패',e)}catch(_){}}
  return M.built;
}
const pileSpot=k=>new THREE.Vector3(PX,.03+k*.009,0);
const seatFrom=(s,me)=>s===me?nearMe():seatPos(s,3.85);
/* 기록을 차례대로 재생: 카드 한 장의 비행이 끝나기 전에 다음 일이 앞지르지 않게 */
function enqueue(e,me){
  const now=clock(),t0=Math.max(now,M.nextFly);
  if(e.k==='p'){
    M.nextFly=t0+FLY_MS*.7;
    const from=seatFrom(e.s,me);from.y=.5;
    const c=makeCard(from,Math.PI/2,0,.8);c.visible=false;c.children[0].material=faceMat(e.id);c.userData.man=true;
    const to=pileSpot(Math.min(T.field.length,12));T.field.push(c);
    M.fly.push({c,e,t0,x0:from.x,y0:from.y,z0:from.z,to,ry:rand(-.3,.3)});
    return;
  }
  if(e.k==='m'){M.q.push({t0,run:()=>{while(T.field.length>1)killCard(T.field.shift())}});return}
  if(e.k==='d')M.nextFly=t0+180;
  M.q.push({t0,run:()=>{
    if(e.k==='d'){
      const n=Math.min(e.n,6),to=seatFrom(e.s,me);
      for(let j=0;j<n;j++){const c=makeCard(new THREE.Vector3(-PX,.2+j*.03,0),Math.PI/2,0,.9),u=c.userData;u.p.set(to.x,.4,to.z);u.s=.55;u.die=true}
      sfx('play',1);if(M.atk&&!M.fly.length)M.atk=0;
    }
    if(e.k==='x')M.atk=0;
    evCue(e);
  }});
}
function flyStep(now){
  M.fly=M.fly.filter(f=>{
    const c=f.c;if(!T.cards.has(c))return false;
    if(now<f.t0)return true;
    c.visible=true;
    const k=Math.min(1,(now-f.t0)/FLY_MS),e=ez(k),L=(a,b)=>a+(b-a)*e;
    c.position.set(L(f.x0,f.to.x),L(f.y0,f.to.y)+Math.sin(Math.PI*k)*FLY_H,L(f.z0,f.to.z));
    c.rotation.x=L(Math.PI/2,-Math.PI/2);c.rotation.y=L(0,f.ry);c.scale.setScalar(L(.8,1));
    if(k<1)return true;
    const u=c.userData;u.man=false;u.p.copy(f.to);u.rx=-Math.PI/2;u.ry=f.ry;u.s=1;
    land(f.e);
    return false;
  });
  M.q=M.q.filter(x=>{if(now<x.t0)return true;x.run();return false});
}
/* 카드가 내려앉는 순간: 무늬·방향·누적 장수가 바뀜 */
function land(e){
  evCue(e);M.top=e.id;M.su=e.su;M.atk=e.atk;
  if(e.dir!==M.dir){M.dir=e.dir;M.dirAt=clock()}
}
function clearPile(){for(const c of T.field)killCard(c);T.field=[];M.fly=[];M.q=[]}
G.field3D=(v,pv,me)=>{
  const o=v.o;if(!o||!T.ok||!M.built||v.st==='wait')return;
  if(M.gn!==o.gn){
    clearPile();M.gn=o.gn;M.dir=o.dir;M.nextFly=0;M.sq=o.sq;M.dc=o.dc;M.atk=o.atk;M.su=o.su;M.top=o.top;M.needTop=true;
  }
  M.dc=o.dc;
  for(const e of o.ev)if(e.q>M.sq){M.sq=e.q;enqueue(e,me)}
  while(T.field.length>13)killCard(T.field.shift());
  if(!M.fly.length&&!M.q.length){M.atk=o.atk;M.su=o.su;M.top=o.top;M.dir=o.dir}
};
function step(){
  M.raf=0;if(!M.on||!V||!V.o)return;
  M.raf=requestAnimationFrame(step);
  const now=clock(),o=V.o,show=V.st!=='wait'&&!dealingV();
  if(M.needTop&&show){   // 시작 연출에서 뒤집은 카드가 끝나면 그 자리에 진짜 카드
    M.needTop=false;
    if(!T.field.length){const c=makeCard(pileSpot(0),-Math.PI/2,0,1);c.children[0].material=faceMat(o.top);T.field.push(c)}
  }
  flyStep(now);
  M.deck.visible=show&&o.dc>0;
  if(M.deck.visible){const h=Math.max(.012,o.dc*.009);M.deck.scale.y=h;M.deck.position.y=.02+h/2}
  M.arrow.visible=show;
  if(show){
    const e=ez((now-M.dirAt)/320),flip=e<.5?1-e*2:e*2-1,d=e<.5?-M.dir:M.dir;
    M.arrow.scale.x=Math.max(.02,flip)*d;
    M.arrow.rotation.y=(now/1000*.16*M.dir)%(Math.PI*2);
  }
  const star=M.top>=0&&isStar(M.top),main=star?SUITS[M.su]:'',tag=M.atk?`+${M.atk}`:'',sp=M.num.sp;
  sp.visible=show&&!!(main||tag);
  if(sp.visible){
    const col=M.atk?'#ff5a3c':'#ffb04a',key=main+'|'+tag+'|'+col;
    if(key!==M.key){M.key=key;drawNum(main,tag,col)}
  }
}

/* ---------- 2D (WebGL이 없을 때)·손패 위 버튼 ---------- */
function draw2d(){
  if(!elD||!V||!V.o)return;
  if(M.on){if(lastD){elD.innerHTML='';lastD=''}return}
  const o=V.o,h=`<div class="oc-top">${G.cardHTML(o.top,'')}</div><p class="oc-big">${isStar(o.top)?SUITS[o.su]:''}${o.atk?` +${o.atk}`:''}</p><p class="oc-dir">${o.dir>0?'↻':'↺'} · 더미 ${o.dc}</p>`;
  if(h!==lastD){elD.innerHTML=h;lastD=h}
}
function drawReveal(){
  const r=V&&V.o&&V.o.rv,h=r&&r.h?`<p>${esc(nameOf(r.by))}</p><div class="oc-rvh">${r.h.map(id=>G.cardHTML(id,'')).join('')||'<b>0장</b>'}</div>`:'';
  if(h!==lastRv){lastRv=h;elRv.innerHTML=h;elRv.hidden=!h}
}
function layoutBar(){
  const st=$('#stage'),fh=+T.fanH||0,key=String(fh);
  if(key===layKey)return;layKey=key;
  st.style.setProperty('--ocB',(fh+6)+'px');
}
G.afterFan=layoutBar;
/* 시작 연출: 남은 카드도 같이 섞고, 나눈 뒤 왼쪽 더미 자리로 옮기고 맨 위 한 장을 뒤집어 오른쪽에 펼침 */
const REST_MS=[2520,2800],FLIP_MS=[2820,3220];
G.dealPile=v=>v.o?(+v.o.dc||0)+1:0;
G.dealRest=(c,a,fy)=>{
  const u=smooth((a-REST_MS[0])/(REST_MS[1]-REST_MS[0])),s=.8+.2*u,x=-PX*u;
  if(c.pile>1||a<FLIP_MS[0]){setPose(c.g,x,fy,0,Math.PI/2,0,0,s);return}
  if(!c.faced&&V&&V.o){c.faced=1;c.g.children[0].material=faceMat(V.o.top);sfx('play',1)}
  const f=smooth((a-FLIP_MS[0])/(FLIP_MS[1]-FLIP_MS[0]));
  setPose(c.g,-PX+2*PX*f,fy+(.03-fy)*f+Math.sin(Math.PI*f)*.7,0,Math.PI/2-Math.PI*f,0,0,1);
};
G.live=()=>{
  if(!elOne||!V||!V.o)return;
  layoutBar();
  keyTags();elOne.disabled=!live1();
  const c=myTurn()&&!!V.o.ch;if(elCh.hidden===c)elCh.hidden=!c;
  if(pickId!=null&&!legalV(pickId))closePick();
  drawReveal();
};
G.hud=inGame=>{
  if(!elBox)return;
  const on=!!(inGame&&V&&V.o);
  elBox.hidden=!on;
  const d3=on&&build();
  if(d3!==M.on){M.on=d3;if(M.root)M.root.visible=d3;if(d3){M.key='';if(!M.raf)M.raf=requestAnimationFrame(step)}}
  $('#stage').classList.add('ocg');
  if(!on){if(T.ok&&T.field.length)clearPile();M.gn=-1;closePick();return}
  draw2d();
};
G.overRank=p=>{const t=p.sr===3?'탈주':p.sr?'항복':'';return t?`<span class="left">${t}</span>`:''};
G.enter=()=>{$('#btnGura').hidden=true};
G.leave=()=>{
  if(T.ok)clearPile();
  if(elBox)elBox.hidden=true;
  if(M.root)M.root.visible=false;
  Object.assign(M,{on:false,gn:-1,sq:0,key:'',top:-1,atk:0});
  closePick();layKey='';M.needTop=false;
  const st=$('#stage');st.classList.remove('ocg');st.style.removeProperty('--ocB');
  const ps=$('#btnPass');delete ps.dataset.oc;ps.innerHTML=`패스<small>${esc(keyLabel(KEYS.pass))}</small>`;ps.hidden=false;
};
G.holoPiece=mkM=>{
  const g=new THREE.Group(),tx=canvasTex(128,186,(x,w,h)=>{x.fillStyle='#fff';x.fillRect(0,0,w,h);x.fillStyle='#34404f';x.font='700 96px sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText('A',w/2,h/2)});
  const a=new THREE.Mesh(new THREE.BoxGeometry(.4,.58,.012),mkM(0xffffff,T.back.map));a.position.set(-.13,0,-.03);a.rotation.z=.16;g.add(a);
  const b=new THREE.Mesh(new THREE.BoxGeometry(.4,.58,.012),mkM(0xffffff,tx));b.position.set(.09,.03,.01);b.rotation.z=-.1;g.add(b);
  g.rotation.set(-.3,.2,0);return g;
};
G.init=()=>{
  const css=document.createElement('style');
  css.textContent=`
.oc-box{position:absolute;inset:0;pointer-events:none;z-index:6}
.oc-box[hidden]{display:none}
.stage.ocg .card.oc-a .big{top:30px;font-family:"IBM Plex Mono","Jua",monospace;font-weight:700;font-size:26px;color:var(--rc)}
.stage.ocg .card.joker.oc-a .big{color:${JOKER_C}}
.oc-act{display:none}
.stage.ocg .oc-act{display:flex}
.stage.ocg .oc-act[hidden]{display:none}
.stage.ocg #btnPlay{display:none}
.stage.ocg .actions{left:50%;right:auto;bottom:var(--ocB,120px);width:min(340px,calc(100% - 20px));justify-content:center;transform:translateX(-50%) scale(var(--actS,1));transform-origin:50% 100%}
.stage.ocg .actions .act{flex:1;min-width:0;pointer-events:auto}
.bubble.one .bt{font-size:calc(27px*var(--bk,1))}
.oc-suits{position:absolute;left:50%;bottom:calc(var(--ocB,120px) + 70px);transform:translateX(-50%);display:flex;gap:8px;padding:8px;border-radius:16px;background:rgba(59,42,31,.92);pointer-events:auto}
.oc-suits[hidden]{display:none}
.oc-suits button{width:60px;height:60px;border:0;border-radius:12px;background:#fffcf5;font-size:36px;line-height:1;cursor:pointer;touch-action:manipulation}
.oc-rv{position:absolute;left:0;right:0;top:15%;width:fit-content;max-width:calc(100% - 24px);margin:0 auto;box-sizing:border-box;padding:8px 12px 12px;border-radius:14px;background:rgba(59,42,31,.92);color:#fffaf0;text-align:center;font-family:"Jua",sans-serif}
.oc-rv[hidden]{display:none}
.oc-rv p{margin:0 0 6px}
@media (max-width:600px){.oc-rvh .card{zoom:.72}}
.oc-rvh{display:flex;flex-wrap:wrap;gap:4px;justify-content:center}
.oc-rvh .card,.oc-2d .card{position:relative;left:auto;top:auto;bottom:auto;transform:none;margin:0;pointer-events:none;flex:none}
.oc-2d{position:absolute;left:0;right:0;top:112px;text-align:center;color:#3b2a1f}
.oc-2d p{margin:2px 0}.oc-top{display:flex;justify-content:center}.oc-big{font:700 34px "IBM Plex Mono",sans-serif;color:#b5521e;min-height:42px}.oc-dir{font:400 18px "Jua",sans-serif}
`;
  document.head.appendChild(css);
  elBox=document.createElement('div');elBox.className='oc-box';elBox.hidden=true;
  elBox.innerHTML=`<div class="oc-2d"></div><div class="oc-rv" hidden></div><div class="oc-suits" hidden>${SUITS.map((s,i)=>`<button type="button" data-s="${i}" aria-label="${s}" style="color:${SUIT_COL[i]}">${s}</button>`).join('')}</div>`;
  $('#stage').appendChild(elBox);
  const acts=$('#actions');
  acts.insertAdjacentHTML('beforeend',`<button type="button" class="act act-play oc-act" id="ocCh" hidden>도전<small></small></button><button type="button" class="act act-gura oc-act" id="ocOne">원카드!<small></small></button>`);
  elOne=$('#ocOne');elCh=$('#ocCh');elSuits=elBox.querySelector('.oc-suits');elRv=elBox.querySelector('.oc-rv');elD=elBox.querySelector('.oc-2d');
  elOne.addEventListener('click',pressOne);elCh.addEventListener('click',pressCh);
  elSuits.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||pickId==null)return;if(!legalV(pickId)){closePick();sfx('no');return}sendPlay(pickId,+b.dataset.s)});
};
(window.GAMES=window.GAMES||{}).onecard=G;
})();
