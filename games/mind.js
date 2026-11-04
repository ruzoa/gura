/* ===== 더 마인드 게임 모듈 =====
   공통 코드(index.html)가 GAMES.mind의 함수를 불러서 이 게임의 규칙·봇·카드·화면을 그림.
   2~4명 협력. 1~100 숫자 카드를 레벨 수만큼 나눠 갖고, 아무 말 없이 낮은 숫자부터 탁자 가운데에 쌓음. 차례는 없음.
   카드 id는 숫자-1(0~99): 공통 코드가 100 이상을 별카드로 보기 때문.
   더 작은 카드가 남아 있는데 내면 생명 1개를 잃고 그보다 작은 카드를 모두 버림. 표창은 모두 불을 켜면 각자 가장 낮은 카드를 버림.
   단계 ph: focus(모두 시작 버튼을 함께 누름) → play → show(버린 카드·통과를 보여 줌) → focus 또는 다음 레벨. 모든 레벨을 넘기면 블라인드로 이어짐.
   거의 동시에 낸 카드는 방장이 BATCH_MS 동안 모아 숫자순으로 내려놓음(인터넷 지연으로 억울한 실패가 나지 않게) */
(function(){
const G={id:'mind',name:'더 마인드',short:'마인드',lead:'말없이 숫자를 맞추는 협력 게임',dealAnim:true,maxHi:4,minN:2,noFast:true,oneBotLv:true,noGiveUp:true};

/* ---------- 규칙 값 ---------- */
const TOP={2:12,3:10,4:8},REWARD={2:'star',3:'life',5:'star',6:'life',8:'star',9:'life'};
const MAX_LIVES=5,MAX_STARS=3;
const BATCH_MS=150,HOLD_MS=500,MISS_MS=2200,CLEAR_MS=1500,BLIND_MS=3000;
const TEMPO=120;   // 봇: 숫자 1 차이마다 기다리는 시간

/* ---------- 카드 ---------- */
const num=id=>id+1;
const cardCol=id=>`hsl(${Math.round(222-222*id/99)},52%,38%)`;   // 낮으면 푸르고 높으면 붉음
Object.assign(G,{labelOf:id=>String(num(id)),cmpCard:(a,b)=>a-b});
G.cardHTML=(id,extra)=>{const n=num(id);return `<button type="button" class="card md-c${n>99?' md-w':''} ${extra||''}" data-id="${id}" style="--rc:${cardCol(id)}" aria-label="${n}"><span class="cn">${n}</span><span class="big">${n}</span><span class="cn2" aria-hidden="true">${n}</span></button>`};
G.drawFace=function(g,w,h,id){
  const RC=cardCol(id),k=w/60,n=String(num(id));
  g.clearRect(0,0,w,h);g.save();rr(g,0,0,w,h,8*k);g.clip();g.fillStyle='#fffcf5';g.fillRect(0,0,w,h);g.fillStyle=RC;g.fillRect(0,0,w,3*k);g.restore();
  g.strokeStyle='#e3d4bb';g.lineWidth=k;rr(g,k/2,k/2,w-k,h-k,8*k);g.stroke();
  g.fillStyle=RC;g.textAlign='center';g.textBaseline='middle';g.font=`700 ${(n.length>2?28:38)*k}px "IBM Plex Mono", monospace`;g.fillText(n,w/2,46*k);
  g.font=`600 ${11*k}px "IBM Plex Mono", monospace`;g.textAlign='left';g.textBaseline='top';g.fillText(n,6*k,7*k);
};

/* ---------- 규칙 설명·방 설정 ---------- */
G.rulesHTML='<ol class="rules"><li><b>목표</b> : 모두 한 팀입니다. 레벨마다 레벨 수만큼 카드를 받고, 모두의 카드를 <b>낮은 숫자부터</b> 가운데에 쌓으면 통과합니다</li><li><b>인원</b> : 2명은 레벨 12, 3명은 레벨 10, 4명은 레벨 8까지입니다. 생명은 인원수만큼, 표창은 1개로 시작합니다</li><li><b>침묵</b> : 게임 중에는 어떤 의사소통도 할 수 없습니다. 차례도 제한 시간도 없습니다</li><li><b>시작 버튼</b> : 레벨을 시작할 때와 실수·표창 뒤에는 탁자 위 시작 버튼을 <b>모두 함께</b> 꾹 누르고 있어야 시작합니다. 시작하면 같은 자리에 표창 버튼이 올라옵니다</li><li><b>내기</b> : 손의 카드를 누르면 살짝 올라와 반투명해지고, 탁자 위에 뒤집혀 올라가 다른 사람도 볼 수 있습니다. 카드를 잡고 손패 밖으로 빼면 바로 냅니다. 같은 카드를 다시 누르면 내려놓습니다. 어떤 카드든 고를 수 있습니다</li><li><b>거의 동시에 냈을 때</b> : 0.15초 안에 나온 카드는 숫자순으로 놓입니다</li><li><b>실수</b> : 낸 숫자보다 작은 카드가 누구에게든 남아 있으면 생명 1개를 잃고 그 카드를 모두 공개해 버립니다. 생명이 없으면 게임이 끝납니다</li><li><b>표창</b> : 탁자 위 표창 버튼을 누르면 불이 켜지고 다시 누르면 꺼집니다. 켠 사람 수만큼 표창 말 옆 홈에 불이 들어옵니다. 모두 켜면 표창 1개를 쓰고 각자 가장 낮은 카드를 공개해 버립니다</li><li><b>보상</b> : 레벨 2·5·8을 통과하면 표창, 3·6·9를 통과하면 생명을 얻습니다. 최대 생명 5개, 표창 3개입니다</li><li><b>블라인드</b> : 모든 레벨을 통과하면 레벨 1부터 다시 시작하고, 낸 카드가 뒤집혀 쌓입니다. 레벨이 끝날 때 순서가 틀렸으면 생명 1개를 잃고 다음 레벨로 갑니다</li></ol>';
G.modeDesc=['낮은 숫자부터 말없이','낮은 숫자부터 말없이'];
G.defaults={max:4};
G.roomSet=[];G.ruleSet=[];
G.cfgChips=()=>'';
G.cfgSum=()=>'2명 레벨 12 · 3명 레벨 10 · 4명 레벨 8';
G.roomSub=()=>'협력 카드 게임';
G.pubExtra=()=>({});
G.cardInfo=(c,nowN)=>{const n=Math.max(2,Math.min(4,nowN));return `<p class="cardinfo">${n}명: 레벨 ${TOP[n]}까지 · 생명 ${n} · 표창 1</p>`};
G.rankTitle=()=>'';
G.finLabel=()=>'';
G.noEmotes=[];
G.keys={};G.keyActions=[];

/* ---------- 방장 엔진 ---------- */
const realBot=p=>!!p&&p.bot&&!p.away;
const seats=()=>H.players.map((p,i)=>i);
const allHands=()=>H.players.flatMap((p,s)=>p.hand.map(v=>({v,s})));
function resetRound(){
  const O=H.md,n=H.players.length,t=clock();
  O.up=Array(n).fill(-1);O.st=Array(n).fill(false);O.hd=Array(n).fill(false);O.hdAt=0;O.q=[];O.qAt=0;O.bp=Array(n).fill(null);O.bs=Array(n).fill(0);
  O.ph='focus';O.bh=H.players.map(()=>t+rand(600,1500));mark();
}
function deal(){
  const O=H.md,deck=shuffle([...Array(100).keys()]);
  H.players.forEach(p=>p.hand=deck.splice(0,O.lv).sort((a,b)=>a-b));
  O.pile=[];O.last=-1;O.show=null;O.own=H.players.map(()=>-1);
  resetRound();
}
function finish(why,seat){
  const O=H.md;
  O.left=H.players.map(p=>p.hand.slice());
  O.res={why:why,lv:O.lv,blind:O.blind,won:O.won,by:seat==null?-1:seat};O.ph='done';O.show=null;
  H.players.forEach((p,i)=>{p.finished=true;p.rank=i===seat?2:1;p.hand=[];if(i===seat)p.surrendered=true});
  const where=`${O.blind?'블라인드 ':''}레벨 ${O.lv}`;
  if(why==='win')addLog('모든 레벨 통과!','fin');
  else if(why==='fail')addLog(`${where}에서 끝났습니다.`,'sys');
  else addLog(`${H.players[seat].name} ${why==='desert'?'탈주':'항복'}! ${where}에서 끝났습니다.`,'lie');
  H.phase='over';H.botActAt=0;H.deadline=0;mark();
}
function showStep(k,cards,ms,next){
  const O=H.md;
  O.sid=(O.sid||0)+1;O.show={k,id:O.sid,c:cards};O.ph='show';O.showUntil=clock()+ms;O.next=next;O.up=O.up.map(()=>-1);O.q=[];mark();
}
function levelClear(){
  const O=H.md,r=REWARD[O.lv];
  addLog(`${O.blind?'블라인드 ':''}레벨 ${O.lv} 통과`,'sys');
  if(r==='life'&&O.lives<MAX_LIVES){O.lives++;addLog('생명 +1','sys')}
  if(r==='star'&&O.stars<MAX_STARS){O.stars++;addLog('표창 +1','sys')}
  showStep('clear',[],CLEAR_MS,'level');
}
function nextLevel(){
  const O=H.md;
  if(O.lv>=O.top){
    if(O.blind){finish('win');return}
    O.won=1;O.blind=1;O.lv=1;addLog('블라인드 시작','sys');
  }else O.lv++;
  deal();beginDeal(DEAL_MS);
}
function afterShow(){
  const O=H.md,nx=O.next;O.show=null;
  if(nx==='over')finish('fail');
  else if(nx==='level')nextLevel();
  else if(!allHands().length)levelClear();
  else resetRound();
}
/* 카드 하나를 쌓음. 실수면 false를 돌려 같은 묶음의 남은 카드를 멈춤 */
function place(seat,id){
  const O=H.md,p=H.players[seat],k=p.hand.indexOf(id);if(k<0)return true;
  p.hand.splice(k,1);O.pile.push({v:id,s:seat});O.up[seat]=-1;O.own[seat]=id;
  addLog(O.blind?`${p.name} 냄`:`${p.name} ${num(id)}`);
  if(O.blind){
    if(!allHands().length){blindCheck();return false}
    O.last=id;return true;
  }
  O.last=id;
  const low=allHands().filter(c=>c.v<id).sort((a,b)=>a.v-b.v);
  if(low.length){
    for(const q of H.players)q.hand=q.hand.filter(v=>v>id);
    O.lives--;addLog(`실수! 생명 -1 (${low.map(c=>num(c.v)).join(', ')} 버림)`,'lie');
    showStep('miss',low,MISS_MS,O.lives<=0?'over':'after');
    return false;
  }
  if(!allHands().length){levelClear();return false}
  return true;
}
function blindCheck(){
  const O=H.md,P=O.pile,i=P.findIndex((c,k)=>k&&P[k-1].v>c.v);
  if(i<0){levelClear();return}
  O.lives--;addLog('순서가 틀렸습니다. 생명 -1','lie');
  showStep('blind',[P[i-1],P[i]],BLIND_MS,O.lives<=0?'over':'clear');
}
function flush(){
  const O=H.md,L=O.q.slice().sort((a,b)=>a.id-b.id);O.q=[];O.qAt=0;
  for(const q of L){if(O.ph!=='play')break;if(!place(q.s,q.id))break}
  if(O.ph==='play')plan();
  mark();
}
/* 봇(쉬움): 자기 패만 봄. 마지막 숫자와의 차이만큼 기다렸다 뒤집어 올리고 잠시 뒤 냄. 오차가 커서 높은 레벨은 어려움 */
function plan(){
  const O=H.md,t=clock();
  H.players.forEach((p,i)=>{
    O.bp[i]=null;if(!realBot(p)||!p.hand.length)return;
    const id=O.up[i]>=0&&p.hand.includes(O.up[i])?O.up[i]:p.hand[0],last=O.blind?O.own[i]:O.last,gap=Math.max(1,id-last);
    const wait=Math.max(900,gap*TEMPO)*rand(.65,1.4)+rand(0,500);
    O.bp[i]={id,at:t+wait,upAt:t+Math.max(0,wait-rand(500,1000))};
  });
}
function allOn(a){return a.length>0&&a.every(Boolean)}
function useStar(){
  const O=H.md;O.stars--;O.st=O.st.map(()=>false);
  const c=[];H.players.forEach((p,s)=>{if(p.hand.length)c.push({v:p.hand.shift(),s})});
  c.sort((a,b)=>a.v-b.v);addLog(`표창! ${c.map(x=>num(x.v)).join(', ')} 버림`,'sys');
  for(const x of c)if(x.v>O.last)O.last=x.v;
  showStep('star',c,MISS_MS,'after');
}
function queue(seat,id){
  const O=H.md;
  if(O.q.some(q=>q.s===seat))return;
  if(!O.q.length)O.qAt=clock()+BATCH_MS;
  O.q.push({s:seat,id});
}
function doSurrender(seat){
  if(H.phase!=='play'||H.players[seat].finished)return;
  finish(H.players[seat].deserter?'desert':'surrender',seat);
}
function tickFocus(t){
  const O=H.md;
  H.players.forEach((p,i)=>{if(realBot(p)&&t>=O.bh[i])O.hd[i]=true;else if(!realBot(p)&&p.bot)O.hd[i]=false});
  if(allOn(O.hd)){
    if(!O.hdAt){O.hdAt=t;mark()}
    else if(t>=O.hdAt+HOLD_MS){O.ph='play';O.hd=O.hd.map(()=>false);O.hdAt=0;plan();mark()}
  }else if(O.hdAt){O.hdAt=0;mark()}
}
function tickPlay(t){
  const O=H.md;
  if(O.q.length&&t>=O.qAt){flush();if(O.ph!=='play')return}
  if(!O.q.length&&O.stars>0&&allOn(O.st)){useStar();return}
  const some=H.players.some((p,i)=>!realBot(p)&&O.st[i]);
  H.players.forEach((p,i)=>{
    if(!realBot(p))return;
    if(some&&!O.st[i]){if(!O.bs[i])O.bs[i]=t+rand(1200,2600);else if(t>=O.bs[i]){O.st[i]=true;O.bs[i]=0;mark()}}
    else if(!some&&(O.st[i]||O.bs[i])){O.st[i]=false;O.bs[i]=0;mark()}
    const b=O.bp[i];if(!b)return;
    if(O.up[i]<0&&t>=b.upAt){O.up[i]=b.id;mark()}
    if(t>=b.at){O.bp[i]=null;queue(i,b.id)}
  });
}
G._test={TOP,REWARD,BATCH_MS,HOLD_MS,MISS_MS,CLEAR_MS,plan,flush};
G.engine={
  start(){
    Object.assign(H,{phase:'play',log:[],seatNote:{},field:[],last:null,reveal:null,shouts:[],pending:null,rankNext:1,known:{},turn:0,botActAt:0,deadline:clock()+864e5});
    const n=H.players.length;
    H.players.forEach(p=>{p.finished=false;p.rank=null;p.surrendered=false;p.hand=[]});
    H.md={gn:((H.md&&H.md.gn)||0)+1,lv:1,top:TOP[n]||8,blind:0,won:0,lives:n,stars:1,sid:0,res:null,left:null,ph:'focus'};
    addLog(`${n}명 · 레벨 ${H.md.top}까지`,'sys');
    deal();
  },
  act(seat,a){
    if(!H.md||H.phase!=='play'||seat<0||seat>=H.players.length)return;
    if(a.t==='surrender'){doSurrender(seat);return}
    const O=H.md,p=H.players[seat];
    if(a.t==='hold'){if(O.ph==='focus'){O.hd[seat]=!!a.on;mark()}return}
    if(O.ph!=='play')return;
    if(a.t==='star'){if(O.stars>0){O.st[seat]=!!a.on;O.bs=O.bs.map(()=>0);mark()}return}
    if(O.q.some(q=>q.s===seat))return;
    if(a.t==='up'&&Number.isInteger(a.id)&&p.hand.includes(a.id)){O.up[seat]=a.id;mark();return}
    if(a.t==='down'){O.up[seat]=-1;mark();return}
    if(a.t==='put'&&a.id===O.up[seat]&&p.hand.includes(a.id))queue(seat,a.id);
  },
  tick(t){
    const O=H.md;if(!O||H.phase!=='play')return;
    if(O.ph==='show'){if(t>=O.showUntil)afterShow();return}
    if(O.ph==='focus')tickFocus(t);else if(O.ph==='play')tickPlay(t);
  },
  snap(s,you,t){
    const O=H.md,over=H.phase==='over',seat=you>=0&&you<H.players.length;
    const P=O.pile,hide=O.blind&&!over;
    s.o={gn:O.gn,lv:O.lv,top:O.top,blind:O.blind,won:O.won,lives:O.lives,stars:O.stars,ph:O.ph,hd:O.hd.slice(),st:O.st.slice(),
      ups:O.up.map(x=>x>=0?1:0),my:seat?O.up[you]:-1,pc:P.length,pv:hide?null:P.map(c=>c.v),ls:P.length?P[P.length-1].s:-1,
      show:O.show?{k:O.show.k,id:O.show.id,c:O.show.c.map(c=>({...c}))}:null,hk:O.hdAt?Math.max(0,HOLD_MS-(t-O.hdAt)):-1,res:O.res?{...O.res}:null,left:O.left};
    s.gr=0;s.dl=0;if(H.phase==='play')delete s.t;
  },
  restore(ms){
    const O=H.md;if(!O)return;
    if(O.showUntil)O.showUntil+=ms;if(O.qAt)O.qAt+=ms;if(O.hdAt)O.hdAt+=ms;
    if(O.bh)O.bh=O.bh.map(x=>x+ms);
    if(O.bp)for(const b of O.bp)if(b){b.at+=ms;b.upAt+=ms}
    if(O.bs)O.bs=O.bs.map(x=>x?x+ms:0);
  },
  emoPhase:ph=>ph==='over'   // 게임 중에는 어떤 신호도 주고받지 않음
};

/* ---------- 화면: 조작 ---------- */
let up=-1,sentAt=-1e9,holding=false,starSent=false,elBox=null,last2d='',bestGn=-1;
const iSeat=()=>{const i=myIdx();return i>=0&&V&&V.ps&&i<V.ps.length};
const canPlay=()=>!!(V&&V.o&&V.st==='play'&&V.o.ph==='play'&&iSeat()&&!dealingV());
const canHold=()=>!!(V&&V.o&&V.st==='play'&&V.o.ph==='focus'&&iSeat()&&!dealingV());
function hold(on){
  if(on===holding)return;
  if(on&&!canHold())return;
  holding=on;sendAct({t:'hold',on});if(on)tone(190,.08,{type:'triangle',vol:.12});
  M.dirty=true;
}
function toggleStar(){
  if(!canPlay()||!(V.o.stars>0)){sfx('no');return}
  const on=!V.o.st[myIdx()];sendAct({t:'star',on});starSent=on;
}
function putUp(){
  if(!canPlay()||up<0)return;
  sendAct({t:'put',id:up});
}
/* 공통 손패의 고르기(sel)를 '카드 올리기'로 씀: 마우스·터치·키보드가 모두 같은 길로 들어옴 */
function syncSel(){
  const a=[...sel];
  if(!a.length){if(up>=0){up=-1;sentAt=clock();sendAct({t:'down'})}return}
  const nw=a.find(id=>id!==up);
  if(nw==null){return}
  sel.clear();
  if(!canPlay()){if(up>=0)sel.add(up);sfx('no');return}
  sel.add(nw);up=nw;sentAt=clock();sendAct({t:'up',id:nw});
}
G.handMarks=(i,h,hand)=>{syncSel();for(const el of hand.children)el.classList.toggle('sel',sel.has(+el.dataset.id))};
G.me=()=>{$('#numpick').hidden=true};
G.play=()=>{
  if(!canPlay()){sfx('no');return}
  const id=[...sel][0];
  if(id==null){sfx('no');return}
  if(id!==up)syncSel();   // 끌어 빼면 바로 냄 (올리는 단계를 건너뜀)
  putUp();
};
G.pass=toggleStar;
G.keyPhase=st=>st==='play';
G.onKey=(act,e)=>{if(act==='play'&&canHold()){if(!e.repeat)hold(true);return true}return false};
G.preView=()=>{
  const o=V.o;if(!o)return;
  if(o.ph!=='focus'&&holding)holding=false;
  if(o.ph!=='play'){up=-1;sel.clear()}
  else if(clock()-sentAt>700&&o.my!==up){up=o.my;sel.clear();if(up>=0&&myHand().includes(up))sel.add(up)}
  if(up>=0&&!myHand().includes(up)){up=-1;sel.clear()}
};
G.postView=()=>{};
G.buttons=()=>{
  const pb=$('#btnPlay'),ps=$('#btnPass'),o=V&&V.o,foc=canHold(),pl=canPlay();
  $('#btnGura').hidden=true;
  pb.hidden=false;ps.hidden=false;
  pb.disabled=!(foc||pl);pb.classList.toggle('ready',foc||(pl&&up>=0));
  const m=foc?'시작':'내기';if($('#playMain').textContent!==m)$('#playMain').textContent=m;
  const sub=keyLabel(KEYS.play);if($('#playSub').textContent!==sub)$('#playSub').textContent=sub;
  ps.disabled=!(pl&&o&&o.stars>0);
  const t=o&&iSeat()&&o.st[myIdx()]?'표창 끄기':'표창';if(ps.firstChild.nodeValue!==t)ps.firstChild.nodeValue=t;
};
G.logCue=()=>false;
G.cues=(v,pv)=>{
  const a=v.o,b=pv&&pv.o;if(!a||!b)return;
  if(a.pc>b.pc&&a.gn===b.gn&&a.lv===b.lv&&!M.on)sfx('play',1);   // 3D에서는 카드가 내려앉는 순간에 (fly)
  {const n=x=>x.st.filter(Boolean).length,d=n(a)-n(b);if(a.ph==='play'&&b.ph==='play'&&d)tone(d>0?880:440,.07,{type:'triangle',vol:.1})}
  if(b.ph==='focus'&&a.ph==='play')tone(660,.1,{type:'sine',vol:.1});
  a.ups.forEach((u,i)=>{if(u&&!b.ups[i])hiss(.05,{freq:2600,q:1.2,vol:.1})});
  if(a.show&&(!b.show||b.show.id!==a.show.id)){
    const k=a.show.k;
    if(k==='miss'||k==='blind'){tone(150,.3,{type:'triangle',vol:.2});tone(110,.4,{type:'triangle',vol:.16,at:.14})}
    else if(k==='star'){hiss(.3,{freq:3000,sweep:900,q:1,vol:.16});tone(990,.14,{type:'sine',vol:.08,at:.14})}
    else{tone(660,.12,{type:'sine',vol:.1});tone(880,.14,{type:'sine',vol:.1,at:.1});tone(1320,.24,{type:'sine',vol:.09,at:.2});fxSay(`레벨 ${a.lv} 통과`,'#2e7d4f')}
  }
  if(a.blind&&!b.blind)fxSay('블라인드','#6258d5');
};

/* ---------- 3D: 공통 앉은 카메라 위의 물건 ----------
   가운데 점선 원 = 쌓이는 카드, 위쪽 호 = 생명·표창 말, 한가운데 펠트 = 레벨 글자. 자리마다 펠트 밖 나무 위 구멍 하나: 시작 버튼이 들어가면 같은 구멍으로 표창 버튼이 올라옴.
   자리 물건은 seatAngle을 따라 놓임 */
const R_UP=2.42,R_BTN=3.82,T_BTN=-1.15;
const M={on:false,built:false,fail:false,root:null,seats:[],lamps:[],fly:[],lv:[],sv:[],ups:[],showC:[],showId:0,key:'',dirty:true,raf:0,ray:null,hk:-1,hkAt:0};
const ez=k=>k<=0?0:k>=1?1:k*k*(3-2*k);
function heartTex(){return canvasTex(128,128,(g,w,h)=>{
  g.fillStyle='#fff3e0';g.fillRect(0,0,w,h);g.fillStyle='#d83a3a';g.beginPath();g.moveTo(64,106);g.bezierCurveTo(10,66,18,20,64,44);g.bezierCurveTo(110,20,118,66,64,106);g.fill()})}
function starShape(a,b){const s=new THREE.Shape();for(let k=0;k<8;k++){const r=k%2?b:a,t=k*Math.PI/4+Math.PI/2,x=Math.cos(t)*r,y=Math.sin(t)*r;k?s.lineTo(x,y):s.moveTo(x,y)}s.closePath();return s}
const levelText=o=>`${o.blind?'블라인드 ':'레벨 '}${o.lv} / ${o.top}`;
function tokenPos(k,n,mid){const st=.34,a=mid+(k-(n-1)/2)*st;return [Math.cos(a)*1.46,Math.sin(a)*1.46]}
function build(){
  if(M.built||M.fail)return M.built;
  if(!T.ok||typeof THREE==='undefined'){M.fail=true;return false}
  try{
    const root=new THREE.Group();root.visible=false;T.scene.add(root);M.root=root;
    const ink=new THREE.MeshBasicMaterial({color:GFX_INK,side:THREE.BackSide}),hole=new THREE.MeshBasicMaterial({color:0x14241b});
    M.rd=[toon({color:0xd8392b}),toon({color:0xff7a55})];M.star=[toon({color:0x59626e}),toon({color:0x2c3138})];
    const sTop=(bg,fg)=>canvasTex(128,128,(g,w,h)=>{g.fillStyle=bg;g.fillRect(0,0,w,h);g.fillStyle=fg;g.beginPath();for(let k=0;k<8;k++){const r=k%2?13:50,t=k*Math.PI/4-Math.PI/2+.3,x=w/2+Math.cos(t)*r,y=h/2+Math.sin(t)*r;k?g.lineTo(x,y):g.moveTo(x,y)}g.closePath();g.fill();g.fillStyle=bg;g.beginPath();g.arc(w/2,h/2,6,0,7);g.fill()});
    const capM=(bg,fg,side,basic)=>{const t=basic?new THREE.MeshBasicMaterial({map:sTop(bg,fg)}):toon({map:sTop(bg,fg),rim:0}),e=toon({color:side});return [e,t,e]};
    M.sb=[capM('#e9dfca','#3a404a',0xb9ab90),capM('#ffd24a','#3a2a10',0xd9a52e,true),capM('#6b6f75','#44484e',0x4c5056)];   // 표창 버튼: 꺼짐 · 켜짐 · 표창 없음
    const add=(p,g,m,y)=>{const o=new THREE.Mesh(g,m);o.position.y=y||0;o.castShadow=true;p.add(o);return o};
    const gCap=new THREE.CylinderGeometry(.34,.37,.2,36),gInk=new THREE.CylinderGeometry(.385,.41,.22,36),gHole=new THREE.CircleGeometry(.46,40);
    const gSCap=new THREE.CylinderGeometry(.32,.34,.14,36),gSInk=new THREE.CylinderGeometry(.35,.37,.16,36);
    for(let i=0;i<4;i++){
      const g=new THREE.Group();root.add(g);
      const h=new THREE.Mesh(gHole,hole);h.rotation.x=-Math.PI/2;h.position.y=.022;g.add(h);
      const cap=new THREE.Group();g.add(cap);add(cap,gCap,M.rd[0]);add(cap,gInk,ink);
      const ring=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial({color:0xffd24a,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.03;ring.visible=false;g.add(ring);
      const lamp=add(g,gSCap,M.sb[0]);add(lamp,gSInk,ink);
      M.seats.push({g,h,cap,capM:cap.children[0],ring,lamp,t0:-1e9,mode:'',from:'',rk:-1});
    }
    const gT=new THREE.CylinderGeometry(.16,.16,.05,28),hm=toon({map:heartTex(),rim:0}),sd=toon({color:0xc9352e});
    for(let k=0;k<MAX_LIVES;k++){const o=new THREE.Mesh(gT,[sd,hm,sd]);o.castShadow=true;root.add(o);o.visible=false;M.lv.push({o,on:false,t0:-1e9})}
    const gS=new THREE.ExtrudeGeometry(starShape(.27,.095),{depth:.05,bevelEnabled:false});
    for(let k=0;k<MAX_STARS;k++){const o=new THREE.Mesh(gS,M.star[0]);o.rotation.x=-Math.PI/2;o.castShadow=true;root.add(o);o.visible=false;M.sv.push({o,on:false,t0:-1e9})}
    const texPlane=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;const t=new THREE.CanvasTexture(c);t.anisotropy=4;return {c,t,key:''}};
    {const L=texPlane(640,160),m=new THREE.Mesh(new THREE.PlaneGeometry(3.2,.8),new THREE.MeshBasicMaterial({map:L.t,transparent:true,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.set(0,.024,0);m.renderOrder=1;root.add(m);M.lvT=L;
     if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>{L.key=''})}
    {const gH=new THREE.CircleGeometry(.1,24),gB=new THREE.SphereGeometry(.078,18,10),bm=new THREE.MeshBasicMaterial({color:0xffd24a});   // 표창 불: 인원수만큼 판 홈
     for(let k=0;k<4;k++){const h=new THREE.Mesh(gH,hole);h.rotation.x=-Math.PI/2;h.position.y=.022;root.add(h);const b=new THREE.Mesh(gB,bm);b.position.y=.03;root.add(b);M.lamps.push({h,b,on:false,t0:-1e9})}}
    M.ray=new THREE.Raycaster();M.built=true;
  }catch(e){M.fail=true;try{console.warn('더 마인드 3D 준비 실패',e)}catch(_){}}
  return M.built;
}
function place3D(){
  const n=V.ps.length,key=n+':'+myIdx();if(key===M.key)return;M.key=key;
  M.seats.forEach((s,i)=>{
    const on=i<n;s.g.visible=on;if(!on)return;
    const a=seatAngle(i),sn=Math.sin(a),cs=Math.cos(a);
    s.g.position.set(sn*R_BTN+cs*T_BTN,0,cs*R_BTN-sn*T_BTN);
  });
  const lay=(L,mid)=>L.forEach((t,k)=>{const [x,z]=tokenPos(k,L.length,mid);t.o.position.set(x,.04,z)});
  lay(M.lv,-Math.PI*.72);lay(M.sv,-Math.PI*.27);
  M.lamps.forEach((l,k)=>{const on=k<n;l.h.visible=on;l.b.visible=false;if(!on)return;const a=-Math.PI*.27+(k-(n-1)/2)*.27,x=Math.cos(a)*1.9,z=Math.sin(a)*1.9;l.h.position.x=l.b.position.x=x;l.h.position.z=l.b.position.z=z});
}
/* 매 프레임: 버튼·말 움직임 (시작 시각과의 차이로) */
function step(){
  M.raf=0;if(!M.on||!V||!V.o)return;
  M.raf=requestAnimationFrame(step);
  const now=clock(),o=V.o,mode=V.st!=='play'||dealingV()?'':o.ph==='focus'?'go':o.ph==='play'||o.ph==='show'?'st':'',foc=mode==='go';
  M.seats.forEach((s,i)=>{
    if(!s.g.visible)return;
    if(s.mode!==mode){s.from=s.mode;s.mode=mode;s.t0=now}
    const e=now-s.t0,down=ez(e/200),rise=ez((e-220)/240),lift=m=>m===s.mode?rise:m===s.from?1-down:0;   // 앞 버튼이 들어간 뒤 같은 구멍으로 다음 버튼이 올라옴
    const op=mode?(s.from?1:ez(e/200)):s.from?1-ez((e-200)/200):0,ri=lift('go'),rs=lift('st');
    s.h.scale.setScalar(Math.max(.001,op));s.h.visible=op>.01;
    const pressed=i===myIdx()?holding||o.hd[i]:o.hd[i];
    s.cap.position.y=-.14+ri*(pressed?.14:.21);s.cap.visible=ri>.01;
    s.capM.material=M.rd[pressed?1:0];
    // 고리: 모두 눌렀을 때 차오름
    let k=-1;if(foc&&o.hk>=0)k=1-Math.max(0,(M.hkAt+o.hk-now))/HOLD_MS;
    if(k>=0){k=Math.min(1,k);const q=Math.round(k*48);if(q!==s.rk){s.rk=q;s.ring.geometry.dispose();s.ring.geometry=new THREE.RingGeometry(.48,.56,48,1,Math.PI/2,-Math.max(.01,k)*Math.PI*2)}s.ring.visible=true}else{s.ring.visible=false;s.rk=-1}
    const lit=V.st==='play'&&o.st[i],can=o.stars>0;
    s.lamp.material=M.sb[lit?1:can?0:2];s.lamp.position.y=-.1+rs*(lit?.19:.23);s.lamp.visible=rs>.01;
  });
  const tok=(L,n)=>L.forEach((t,k)=>{
    const on=k<n;if(on!==t.on){t.on=on;t.t0=now}
    const e=now-t.t0,x=t.on?ez(e/260):1-ez(e/260),b=t.on&&e<260?Math.sin(e/260*Math.PI)*.25:0;
    t.o.visible=x>.01;t.o.scale.setScalar(Math.max(.001,x*(1+b)));
  });
  tok(M.lv,o.lives);tok(M.sv,o.stars);
  {const L=M.lvT,txt=`${o.blind?'BLIND':'LEVEL'} ${o.lv}`;if(L.key!==txt){L.key=txt;const g=L.c.getContext('2d'),w=L.c.width,h=L.c.height;g.clearRect(0,0,w,h);g.fillStyle='#2f7350';g.font='700 118px "IBM Plex Mono", monospace';g.textAlign='center';g.textBaseline='middle';g.fillText(txt,w/2,h/2+6);L.t.needsUpdate=true}}
  {const n=V.st==='play'&&o.ph==='play'?o.st.filter(Boolean).length:0;
   M.lamps.forEach((l,k)=>{if(!l.h.visible)return;const on=k<n;if(on!==l.on){l.on=on;l.t0=now}
     const x=l.on?ez((now-l.t0)/140):1-ez((now-l.t0)/140);l.b.visible=x>.01;l.b.scale.set(Math.max(.01,x),Math.max(.01,x*.6),Math.max(.01,x))})}
  flyStep(now);
}
/* 카드 뒤집어 내기: 탁자를 뚫지 않게 위로 들어 올리면서 뒤집고 내려앉음 (시작 시각과의 차이로) */
const FLY_MS=420,FLY_H=.8;
function fly(c,to,rx,ry,snd){
  const u=c.userData;u.man=true;
  M.fly.push({c,t0:clock(),x0:c.position.x,y0:c.position.y,z0:c.position.z,r0:c.rotation.x,ry0:c.rotation.y,s0:c.scale.x,to:to.clone(),rx,ry,snd});
}
function flyStep(now){
  M.fly=M.fly.filter(f=>{
    const c=f.c;if(!T.cards.has(c))return false;
    const k=Math.min(1,Math.max(0,(now-f.t0)/FLY_MS)),e=ez(k),L=(a,b)=>a+(b-a)*e;
    c.position.set(L(f.x0,f.to.x),L(f.y0,f.to.y)+Math.sin(Math.PI*k)*FLY_H,L(f.z0,f.to.z));
    c.rotation.x=L(f.r0,f.rx);c.rotation.y=L(f.ry0,f.ry);c.scale.setScalar(L(f.s0,1));
    if(k<1)return true;
    const u=c.userData;u.man=false;u.p.copy(f.to);u.rx=f.rx;u.ry=f.ry;u.s=1;
    if(f.snd)sfx('play',1);
    return false;
  });
}
G.field3D=(v,pv,me)=>{
  const o=v.o;if(!o||!T.ok||!M.built)return;
  if(v.st==='wait')return;
  place3D();
  if(o.hk>=0&&(!pv||!pv.o||pv.o.hk<0))M.hkAt=clock();else if(o.hk>=0)M.hkAt=clock();
  // 뒤집어 올린 카드
  v.ps.forEach((p,i)=>{
    const want=!!o.ups[i],c=M.ups[i];
    if(want&&!c){
      const from=i===me?nearMe():seatPos(i,3.85);from.y=.5;
      const g=makeCard(from,Math.PI/2,seatAngle(i),.8),to=seatPos(i,R_UP);to.y=.08;g.userData.p.copy(to);g.userData.s=1;M.ups[i]=g;
    }else if(!want&&c){
      M.ups[i]=null;
      const put=o.pc>((pv&&pv.o&&pv.o.pc)||0)&&o.ls===i;
      if(put){M.upFrom=c.position.clone();killCard(c)}
      else{const u=c.userData,tp=i===me?nearMe():seatPos(i,3.85);u.p.set(tp.x,.2,tp.z);u.s=.6;u.die=true}
    }
  });
  // 가운데 더미
  if(o.pc<T.field.length)while(T.field.length>o.pc)killCard(T.field.pop());
  while(T.field.length<o.pc){
    const k=T.field.length,val=o.pv?o.pv[k]:null,f=M.upFrom||seatPos(o.ls>=0?o.ls:0,R_UP);f.y=.2;M.upFrom=null;
    const c=makeCard(f,Math.PI/2,0,1),u=c.userData,to=new THREE.Vector3(0,.03+k*.012,0),rx=val==null?Math.PI/2:-Math.PI/2,ry=rand(-.14,.14),live=!!(pv&&pv.o&&pv.o.pc===k&&pv.o.gn===o.gn);
    if(val!=null)c.children[0].material=faceMat(val);
    if(live)fly(c,to,rx,ry,true);else{u.p.copy(to);u.rx=rx;u.ry=ry;c.position.copy(to);c.rotation.x=rx;c.rotation.y=ry}
    T.field.push(c);
  }
  if(o.pv&&v.st==='over')T.field.forEach((c,k)=>{if(c.userData.rx>0&&!c.userData.man){c.children[0].material=faceMat(o.pv[k]);fly(c,c.userData.p,-Math.PI/2,c.userData.ry,false)}});
  // 버린 카드: 앞면으로 떠서 보여 줌
  const sid=o.show&&o.show.c.length?o.show.id:0;
  if(sid!==M.showId){
    for(const c of M.showC){const u=c.userData;u.p.set(u.p.x*.4,.1,-7);u.s=.5;u.die=true}
    M.showC=[];M.showId=sid;
    if(sid){
      const L=o.show.c,n=L.length,cw=.62*(T.cardK||1);let sc=1.4,gap=cw*sc*1.08;
      for(let it=0;it<8&&n>1;it++){const q=new THREE.Vector3((n-1)/2*gap+cw*sc/2,2.3,1.2).project(T.cam);if(q.x<=.94)break;sc*=.88;gap=cw*sc*1.08}
      L.forEach((x,j)=>{
        const f=x.s===me?nearMe():seatPos(x.s,3.85);f.y=.6;
        const c=makeCard(f,-.72,0,.8);c.children[0].material=faceMat(x.v);c.children.forEach(m=>{m.material=onTopMat(m.material);m.renderOrder=60});
        const u=c.userData;u.p.set((j-(n-1)/2)*gap,2.3,1.2);u.s=sc;M.showC.push(c);
      });
    }
  }
  M.dirty=true;
};
/* 탁자 면에 찍힌 점이 물건 자리 가까이인지 (작은 물건은 넉넉하게) */
function near(e,obj,r0){
  const r=$('#cv').getBoundingClientRect();if(!r.width||!obj)return false;
  M.ray.setFromCamera({x:(e.clientX-r.left)/r.width*2-1,y:-(e.clientY-r.top)/r.height*2+1},T.cam);
  const a=M.ray.ray,k=-a.origin.y/a.direction.y,x=a.origin.x+a.direction.x*k,z=a.origin.z+a.direction.z*k;
  return Math.hypot(x-obj.position.x,z-obj.position.z)<r0;
}

/* ---------- 2D (WebGL이 없을 때) ---------- */
function draw2d(){
  if(!elBox||!V||!V.o)return;
  const o=V.o;
  const tag=levelText(o),bar=elBox.querySelector('.md-lv');if(bar.textContent!==tag)bar.textContent=tag;
  const d=elBox.querySelector('.md-2d');if(M.on){if(d.innerHTML)d.innerHTML='';last2d='';return}
  const lastV=o.pv&&o.pv.length?num(o.pv[o.pv.length-1]):o.pc?'?':'-';
  const row=V.ps.map((p,i)=>`<span class="${o.hd[i]||o.st[i]?'on':''}">${esc(p.n)} · ${+p.c||0}장${o.ups[i]?' · 올림':''}${o.st[i]?' · 표창':''}</span>`).join('');
  const shown=o.show&&o.show.c.length?`<p class="md-sh">${o.show.c.map(c=>num(c.v)).join(' · ')}</p>`:'';
  const h=`<p class="md-tk">생명 ${o.lives} · 표창 ${o.stars}</p><p class="md-big">${lastV}</p>${shown}<div class="md-ps">${row}</div>`;
  if(h!==last2d){d.innerHTML=h;last2d=h}
}
G.hud=inGame=>{
  if(!elBox)return;
  const on=!!(inGame&&V&&V.o);
  elBox.hidden=!on;
  const d3=on&&build();
  if(d3!==M.on){M.on=d3;plainFelt(d3);if(M.root)M.root.visible=d3;$('#stage').classList.toggle('md3d',d3);if(d3){M.key='';if(!M.raf)M.raf=requestAnimationFrame(step)}}
  $('#stage').classList.add('mdg');
  $('#stage').classList.toggle('md2d',on&&!d3);
  if(!on){clearField();return}
  draw2d();
  if(V.st==='over'&&bestGn!==V.o.gn){bestGn=V.o.gn;saveBest()}
};
/* 이 게임 동안만 노란 점선이 없는 펠트 그림으로 (공통 그림은 나갈 때 되돌림) */
function plainFelt(on){
  if(!T.ok||!T.felt)return;
  const m=T.felt.mat.material[1];
  if(!M.feltT){const src=T.felt.tex;M.feltO=src;M.feltT=canvasTex(1024,1024,(g,w,h)=>{const gr=g.createRadialGradient(w/2,h/2,80,w/2,h/2,w/2);gr.addColorStop(0,'#5fae7b');gr.addColorStop(1,'#3f8a5f');g.fillStyle=gr;g.fillRect(0,0,w,h);g.strokeStyle='rgba(255,250,240,.5)';g.lineWidth=6;g.beginPath();g.arc(w/2,h/2,488,0,7);g.stroke()})}
  const want=on?M.feltT:M.feltO;if(m.map!==want){m.map=want;m.needsUpdate=true}
}
function clearField(){
  for(const c of M.ups)if(c)killCard(c);M.ups=[];
  for(const c of M.showC)killCard(c);M.showC=[];M.showId=0;
}
/* 인원별 최고 기록 (이 기기) */
const reached=r=>r.blind?r.top+r.lv-(r.why==='win'?0:1):r.lv-1;
function bestMap(){try{return JSON.parse(store('gura-mind-best')||'{}')||{}}catch(e){return {}}}
function saveBest(){
  const o=V.o;if(!o.res)return;
  const n=V.ps.length,v=reached({...o.res,top:o.top}),m=bestMap();
  if(!(m[n]>=v)){m[n]=v;store('gura-mind-best',JSON.stringify(m))}
}
const resText=o=>{
  const r=o.res;if(!r)return '';
  if(r.why==='win')return '모든 레벨을 통과했습니다.';
  const w=`${r.blind?'블라인드 ':''}레벨 ${r.lv}`;
  return r.why==='fail'?`${w}에서 끝났습니다.`:`${V.ps[r.by]?V.ps[r.by].n:'?'} ${r.why==='desert'?'탈주':'항복'} · ${w}`;
};
G.overExtra=()=>{
  if(!V||!V.o||!V.o.res)return '';
  const o=V.o,n=V.ps.length,b=bestMap()[n],L=(o.left||[]).flat().sort((a,b)=>a-b).map(num);
  const clear=x=>x>o.top?`블라인드 레벨 ${x-o.top}`:`레벨 ${x}`;
  return `<div class="qd-rec"><div class="qd-rec-h"><b>${esc(resText(o))}</b></div><pre>${b>0?`${n}명 최고 기록: ${clear(b)} 통과`:`${n}명 최고 기록: 없음`}${L.length?`\n남은 카드: ${L.join(', ')}`:''}</pre></div>`;
};
G.overRank=p=>{const t=p.sr===3?'탈주':p.sr?'항복':'';return t?`<span class="left">${t}</span>`:''};
G.live=()=>{};
G.enter=()=>{$('#btnGura').hidden=true};
G.leave=()=>{
  holding=false;up=-1;clearField();
  if(elBox)elBox.hidden=true;
  if(M.root)M.root.visible=false;M.on=false;M.key='';plainFelt(false);M.fly=[];
  $('#stage').classList.remove('mdg','md3d','md2d');
  $('#btnPass').hidden=false;
  $('#btnPass').firstChild.nodeValue='패스';
};
G.holoPiece=mkM=>{
  const g=new THREE.Group(),tx=canvasTex(128,186,(x,w,h)=>{x.fillStyle='#fff';x.fillRect(0,0,w,h);x.fillStyle='#34404f';x.font='700 76px "IBM Plex Mono", monospace';x.textAlign='center';x.textBaseline='middle';x.fillText('37',w/2,h/2)});
  const a=new THREE.Mesh(new THREE.BoxGeometry(.4,.58,.012),mkM(0xffffff,T.back.map));a.position.set(-.13,.0,-.03);a.rotation.z=.16;g.add(a);
  const b=new THREE.Mesh(new THREE.BoxGeometry(.4,.58,.012),mkM(0xffffff,tx));b.position.set(.09,.03,.01);b.rotation.z=-.1;g.add(b);
  g.rotation.set(-.3,.2,0);return g;
};
G.init=()=>{
  const css=document.createElement('style');
  css.textContent=`
.md-box{position:absolute;inset:0;pointer-events:none;z-index:3}
.md-box[hidden]{display:none}
.md-lv{position:absolute;top:calc(8px + env(safe-area-inset-top,0px)*0);left:50%;transform:translateX(-50%);padding:3px 12px;border-radius:999px;background:rgba(59,42,31,.72);color:#fff6e4;font:700 14px "IBM Plex Mono","Jua",monospace;white-space:nowrap}
.stage.mdg .card.md-c .big{font-family:"IBM Plex Mono",monospace;font-weight:700;font-size:30px;color:var(--rc)}
.stage.mdg .card.md-c.md-w .big{font-size:24px}
.stage.mdg .card.md-c .cn{font-size:14px;color:var(--rc)}
.stage.md3d #btnPlay,.stage.md3d #btnPass,.stage.md3d .md-lv{display:none}
.stage.mdg .fan .card.md-c.sel{--ly:-12px;opacity:.55;outline:none}
.md-2d{position:absolute;left:0;right:0;top:128px;text-align:center;color:#3b2a1f}
.stage.md2d .md-lv{left:12px;transform:none}
.md-2d p{margin:4px 0}.md-big{font:700 64px "IBM Plex Mono",monospace}.md-sh{color:#b5321e;font-weight:700}
.md-ps{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;font-size:13px}.md-ps span{padding:2px 8px;border-radius:8px;background:rgba(59,42,31,.14)}.md-ps span.on{background:#b5521e;color:#fff6e4}
`;
  document.head.appendChild(css);
  elBox=document.createElement('div');elBox.className='md-box';elBox.hidden=true;elBox.innerHTML='<div class="md-lv"></div><div class="md-2d"></div>';
  $('#stage').appendChild(elBox);
  const cv=$('#cv');
  cv.addEventListener('pointerdown',e=>{
    if(currentG()!==G||!M.on||!iSeat()||e.button)return;
    const s=M.seats[myIdx()];
    if(!near(e,s.g,.62))return;
    if(canHold()){e.preventDefault();hold(true)}else if(V.o.ph==='play')toggleStar();
  });
  const off=()=>{if(holding)hold(false)};
  window.addEventListener('pointerup',off);window.addEventListener('pointercancel',off);window.addEventListener('blur',off);
  document.addEventListener('keyup',e=>{if(currentG()===G&&KEYS&&e.code===KEYS.play)off()});
  $('#btnPlay').addEventListener('pointerdown',()=>{if(currentG()===G&&canHold())hold(true)});
};
const currentG=()=>typeof GAMES!=='undefined'&&V&&V.cfg&&GAMES[V.cfg.game]?GAMES[V.cfg.game]:null;
(window.GAMES=window.GAMES||{}).mind=G;
})();
