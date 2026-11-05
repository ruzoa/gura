/* ===== 로보77 게임 모듈 =====
   공통 코드(index.html)가 GAMES.robo77의 함수를 불러서 이 게임의 규칙·봇·카드·화면을 그림.
   2~8명. 카드를 내며 합계를 부르고, 더블릿(11, 22 … 66)이나 77 이상을 부르면 칩 1개를 잃음. 칩이 없을 때 또 잃으면 탈락, 마지막 한 사람이 승리.
   규칙 기준은 AMIGO Lobo 77 규칙서 3.2판(2019): 55장, 시작 칩 3개, 손패 5장. 칩은 화면에서 이름표의 불 3개.
   판 ph: turn → (77 이상) end → 다음 판을 나눔. x2를 받은 사람은 need=2로 두 장을 내고 그 뒤 두 장을 뽑음.
   화면은 상태를 바로 그리지 않고 낸 카드 기록(o.ev)을 재생해, 카드가 내려앉을 때 합계와 불이 바뀜 */
(function(){
const G={id:'robo77',name:'로보77',short:'로보',lead:'합계 77을 피하는 암산 카드 게임',dealAnim:true,maxHi:8,minN:2,noFast:true};

/* ---------- 규칙 값 ---------- */
const CHIPS=3,HAND=5,LIMIT=77,END_MS=2600;
const FLY_MS=420,FLY_H=.7,BLINK_MS=560;

/* ---------- 카드: id는 아래 순서(손패 정렬 순서)의 번호 ---------- */
const DECK=[];
const add=(n,o)=>{for(let k=0;k<n;k++)DECK.push({...o})};
add(4,{k:'n',v:0});
for(let v=2;v<=9;v++)add(3,{k:'n',v});
add(8,{k:'n',v:10});
for(const v of [11,22,33,44,55,66])add(1,{k:'n',v,dbl:1});
add(1,{k:'n',v:76,top:1});
add(4,{k:'n',v:-10,neg:1});
add(4,{k:'x2'});
add(4,{k:'rev'});
const labelOf=id=>{const c=DECK[id];return c.k==='x2'?'×2':c.k==='rev'?'⇄':String(c.v)};
const cardCol=id=>{const c=DECK[id];return c.k==='x2'?'#b4560f':c.k==='rev'?'#6258d5':c.neg?'#107093':c.top?'#2c3138':c.dbl?'#c53026':c.v===0?'#6b6256':c.v===10?'#1f7a2e':'#2b65ca'};
const afterCard=(tot,id)=>{const c=DECK[id];return c.k==='n'?tot+c.v:tot};
const isDouble=x=>x>0&&x<=LIMIT&&x%11===0;
const costs=x=>isDouble(x)||x>=LIMIT;
Object.assign(G,{labelOf,cmpCard:(a,b)=>a-b});
G.cardHTML=(id,extra)=>{const t=labelOf(id),c=DECK[id];return `<button type="button" class="card rb-c${t.length>2?' rb-w':''}${c.k!=='n'?' rb-s':''} ${extra||''}" data-id="${id}" style="--rc:${cardCol(id)}" aria-label="${t}"><span class="cn">${t}</span><span class="big">${t}</span><span class="cn2" aria-hidden="true">${t}</span></button>`};
G.drawFace=function(g,w,h,id){
  const RC=cardCol(id),k=w/60,t=labelOf(id),c=DECK[id];
  g.clearRect(0,0,w,h);g.save();rr(g,0,0,w,h,8*k);g.clip();g.fillStyle=c.k==='n'&&!c.dbl&&!c.top?'#fffcf5':RC;g.fillRect(0,0,w,h);g.fillStyle=RC;g.fillRect(0,0,w,3*k);g.restore();
  g.strokeStyle='#e3d4bb';g.lineWidth=k;rr(g,k/2,k/2,w-k,h-k,8*k);g.stroke();
  g.fillStyle=c.k==='n'&&!c.dbl&&!c.top?RC:'#fffcf5';g.textAlign='center';g.textBaseline='middle';g.font=`700 ${(t.length>2?26:34)*k}px "IBM Plex Mono", "Jua", sans-serif`;g.fillText(t,w/2,46*k);
  g.font=`600 ${11*k}px "IBM Plex Mono", "Jua", sans-serif`;g.textAlign='left';g.textBaseline='top';g.fillText(t,6*k,7*k);
};

/* ---------- 규칙 설명·방 설정 ---------- */
G.rulesHTML='<ol class="rules"><li><b>목표</b> : 합계를 부르며 카드를 냅니다. 마지막까지 남은 사람이 <b>승리</b>합니다</li><li><b>준비</b> : 손패 5장, 칩 3개로 시작합니다. 칩은 이름표의 불 3개이고, 잃을 때마다 하나씩 꺼집니다</li><li><b>내기</b> : 카드를 고르고 내면 그 값이 합계에 더해져 더미 위에 뜹니다. 낸 뒤 1장을 뽑습니다</li><li><b>칩을 잃을 때</b> : 합계가 <b>11, 22, 33, 44, 55, 66</b>이거나 <b>77 이상</b>이 되면 낸 사람이 칩 1개를 잃습니다. 합계가 그대로인 카드를 내서 같은 숫자를 다시 불러도 잃습니다</li><li><b>0</b> : 합계가 그대로입니다</li><li><b>-10</b> : 합계에서 10을 뺍니다. 0보다 작아질 수 있습니다</li><li><b>⇄</b> : 합계가 그대로이고 도는 방향이 바뀝니다</li><li><b>×2</b> : 합계가 그대로이고 다음 사람이 2장을 낸 뒤 2장을 뽑습니다. 받은 사람은 첫 장으로 ×2를 낼 수 없습니다</li><li><b>판 끝</b> : 77 이상이 되면 그 판이 끝나고, 시작한 사람의 다음 사람부터 새 판을 합니다</li><li><b>탈락</b> : 불이 모두 꺼져도 게임은 이어집니다. 그 상태에서 한 번 더 칩을 잃으면 탈락합니다</li><li><b>제한 시간</b> : 시간이 지나면 낼 수 있는 카드 중 하나가 무작위로 나갑니다</li></ol>';
G.modeDesc=['합계 77을 피하기','합계 77을 피하기'];
G.defaults={max:6,turn:20};
G.roomSet=[{k:'turn',label:'제한 시간',unit:'초',lo:5,hi:60,step:5,desc:'시간이 지나면 낼 수 있는 카드 중 하나가 무작위로 나갑니다'}];
G.ruleSet=[];
G.cfgChips=c=>`<span class="chip">제한 시간 <b>${+c.turn||20}초</b></span>`;
G.cfgSum=c=>`손패 5장 · 칩 3개 · 제한 시간 ${+c.turn||20}초`;
G.roomSub=()=>'2~8명 암산 카드 게임';
G.pubExtra=()=>({});
G.cardInfo=()=>'<p class="cardinfo">카드 55장 · 손패 5장 · 칩 3개</p>';
G.rankTitle=()=>'';
G.finLabel=f=>f===1?'승리':'탈락';
G.noEmotes=[];
G.keys={};G.keyActions=[];

/* ---------- 방장 엔진 ---------- */
const alive=()=>H.players.filter(p=>!p.finished);
function nextAlive(i,dir){const n=H.players.length;for(let k=1;k<=n;k++){const j=((i+dir*k)%n+n)%n;if(!H.players[j].finished)return j}return -1}
function setTurn(i){
  H.turn=i;H.deadline=clock()+(+H.cfg.turn||20)*1000;
  H.botActAt=H.players[i].bot?clock()+rand(900,2100):0;mark();
}
function startRound(st){
  const O=H.rb,deck=shuffle([...DECK.keys()]);
  H.players.forEach(p=>{if(!p.finished)p.hand=deck.splice(0,HAND).sort((a,b)=>a-b)});
  Object.assign(O,{deck,disc:[],seen:[],tot:0,dir:1,need:1,played:0,two:false,ph:'turn',ev:[],sq:0,start:st,rn:O.rn+1});
  H.seatNote={};setTurn(st);
}
function draw(p,k){
  const O=H.rb;
  for(let j=0;j<k;j++){
    if(!O.deck.length){
      const top=O.disc.pop();O.deck=shuffle(O.disc);O.disc=top==null?[]:[top];O.seen=O.disc.slice();addLog('버린 카드를 섞습니다.','sys');
      if(!O.deck.length)break;
    }
    p.hand.push(O.deck.pop());
  }
  p.hand.sort((a,b)=>a-b);
}
function retire(seat){const O=H.rb,p=H.players[seat];O.disc.unshift(...p.hand);p.hand=[];p.finished=true;p.rank=O.rank--}
function checkOver(){
  const L=alive();if(L.length>1)return false;
  if(L[0]){L[0].finished=true;L[0].rank=1;L[0].hand=[];addLog(`${L[0].name} 승리!`,'fin')}
  H.phase='over';H.botActAt=0;H.deadline=0;H.rb.ph='done';mark();
  H.players.forEach((p,i)=>{if(p.bot&&Math.random()<.5)botEmote(i,'gg',800+Math.random()*1600)});
  return true;
}
/* 칩 1개를 잃음. 탈락이면 true */
function lose(seat){
  const p=H.players[seat];
  if(p.chips>0){p.chips--;addLog(`${p.name} 칩 -1 (남은 칩 ${p.chips})`,'lie');return false}
  addLog(`${p.name} 탈락`,'lie');retire(seat);return true;
}
function passOn(seat){
  const O=H.rb;O.need=O.two?2:1;O.two=false;O.played=0;
  setTurn(nextAlive(seat,O.dir));
}
function doPlay(seat,id){
  const O=H.rb,p=H.players[seat],c=DECK[id];
  p.hand.splice(p.hand.indexOf(id),1);O.disc.push(id);O.seen.push(id);
  O.tot=afterCard(O.tot,id);O.need--;O.played++;H.seatNote={};
  if(c.k==='rev')O.dir=-O.dir;
  if(c.k==='x2')O.two=true;
  addLog(`${p.name} ${labelOf(id)} → ${O.tot}`);
  const pen=costs(O.tot),end=O.tot>=LIMIT,out=pen?lose(seat):false;
  const ev={q:++O.sq,s:seat,id,tot:O.tot,dir:O.dir,p:pen?1:0,d:0};O.ev.push(ev);if(O.ev.length>8)O.ev.shift();
  if(checkOver())return;
  if(end){O.ph='end';O.endAt=clock()+END_MS;H.botActAt=0;H.deadline=clock()+864e5;addLog('판 끝','sys');mark();return}
  if(out){passOn(seat);return}
  if(O.need>0){setTurn(seat);return}
  draw(p,O.played);ev.d=O.played;
  passOn(seat);
}
const legal=(seat,id)=>{const O=H.rb,p=H.players[seat];return p.hand.includes(id)&&!(O.need===2&&DECK[id].k==='x2')};
/* 봇. 쉬움: 칩을 잃지 않는 카드 중 무작위, 없으면 아무거나
   보통: 카드마다 점수를 매김. 칩을 잃으면 크게 깎고, 다음 사람이 낼 카드가 없을 확률만큼 더하고, 위기에 쓸 카드(0·-10·⇄·×2)는 아끼고, 큰 카드는 일찍 냄
   어려움: 나온 카드를 뺀 나머지를 남의 손패와 더미에 무작위로 나눠 보고(남의 실제 손패는 보지 않음), 판 끝까지 굴려 보아 내가 잃는 칩이 가장 적고 남이 잃는 칩이 가장 많은 카드를 고름 */
const noCard=(tot,need,pool)=>{
  const safe=pool.filter(id=>!(need===2&&DECK[id].k==='x2')&&!costs(afterCard(tot,id))).length/Math.max(1,pool.length);
  const has=1-Math.pow(1-safe,HAND);return need===2?1-has*has:1-has;
};
function cardScore(seat,id,tot,dir,hand,pool,left){
  const c=DECK[id],t=afterCard(tot,id),d=c.k==='rev'?-dir:dir,p=H.players[seat],esc=c.k!=='n'||c.v===0||!!c.neg;
  let v=0;
  if(costs(t))v-=p.chips>0?100:260;
  else if(esc)v-=(c.neg?9:7)*(1+Math.max(0,tot)/LIMIT);
  if(c.k==='n'&&c.v>0)v+=c.v*(c.v>=11?.35:.12)*(t<60?1:.3);
  if(t>=LIMIT)return v;
  if(left>0){
    const rest=hand.filter(x=>x!==id);let best=-1e9;
    for(const x of rest)best=Math.max(best,cardScore(seat,x,t,d,rest,pool,left-1));
    return v+(best>-1e9?best:0);
  }
  const nx=nextAlive(seat,d);
  if(nx>=0)v+=28*(H.players[nx].chips>0?1:1.6)*noCard(t,c.k==='x2'?2:1,pool);
  return v;
}
const ROLLS=70;
/* 어려움: 한 판 굴리기. 손패에서 ×2 금지만 지키고, 칩을 안 잃는 카드 중 숫자 카드를 먼저 내는 사람들로 가정 */
function rollout(S,me,first,left){
  const n=S.hands.length,lost=new Array(n).fill(0);
  let seat=me,tot=S.tot,dir=S.dir,need=left+1,two=false,forced=first,steps=0,played=0;
  while(steps++<70){
    const hand=S.hands[seat];
    let id=forced;forced=null;
    if(id==null){
      let pick=-1,rank=-1;
      for(let k=0;k<hand.length;k++){
        const x=hand[k],c=DECK[x];if(need===2&&played===0&&two&&c.k==='x2')continue;
        const r=(costs(afterCard(tot,x))?0:c.k==='n'&&c.v>0?3:1)+Math.random();
        if(r>rank){rank=r;pick=x}
      }
      if(pick<0)break;id=pick;
    }
    hand.splice(hand.indexOf(id),1);
    const c=DECK[id];tot=afterCard(tot,id);if(c.k==='rev')dir=-dir;
    const x2=c.k==='x2';played++;need--;
    if(costs(tot))lost[seat]++;
    if(tot>=LIMIT)break;
    if(need>0)continue;
    for(let k=0;k<played&&S.deck.length;k++)hand.push(S.deck.pop());
    played=0;two=x2;need=x2?2:1;
    let nx=seat;for(let k=1;k<=n;k++){nx=((seat+dir*k)%n+n)%n;if(S.hands[nx])break}
    seat=nx;
  }
  return lost;
}
function hardPick(seat,L){
  const O=H.rb,p=H.players[seat];
  const out=new Set([...p.hand,...O.seen]),pool=[...DECK.keys()].filter(id=>!out.has(id));
  let best=L[0],top=-1e9;
  for(const id of L){
    let sum=0;
    for(let r=0;r<ROLLS;r++){
      const deck=shuffle(pool.slice());
      const hands=H.players.map((q,i)=>q.finished?null:i===seat?p.hand.slice():deck.splice(0,q.hand.length));
      const lost=rollout({hands,deck,tot:O.tot,dir:O.dir},seat,id,O.need-1);
      H.players.forEach((q,i)=>{
        if(q.finished||!lost[i])return;
        if(i===seat)sum-=lost[i]*(q.chips>0?1.5:4);
        else sum+=lost[i]*(q.chips>0?.5:1.2);
      });
    }
    if(sum>top){top=sum;best=id}
  }
  return best;
}
function botPick(seat){
  const O=H.rb,p=H.players[seat],L=p.hand.filter(id=>legal(seat,id)),lv=botLv(p);
  if(lv<=0){const ok=L.filter(id=>!costs(afterCard(O.tot,id))),from=ok.length?ok:L;return from[Math.random()*from.length|0]}
  if(lv>=2)return hardPick(seat,L);
  const pool=[...DECK.keys()];
  let best=L[0],top=-1e9;
  for(const id of L){const v=cardScore(seat,id,O.tot,O.dir,p.hand,pool,O.need-1)+Math.random()*30;if(v>top){top=v;best=id}}
  return best;
}
function timeout(){
  const i=H.turn,L=H.players[i].hand.filter(id=>legal(i,id));
  addLog(`${H.players[i].name} 시간 초과`,'sys');
  const id=L[Math.random()*L.length|0];doPlay(i,id);
  if(H.phase==='play'&&H.players[i])H.seatNote[i]='시간 초과';
}
function doSurrender(seat){
  const O=H.rb,p=H.players[seat];
  if(H.phase!=='play'||!p||p.finished)return;
  retire(seat);p.surrendered=true;
  addLog(`${p.name} ${p.deserter?'탈주':'항복'}`,'lie');
  if(checkOver())return;
  if(O.start===seat&&O.ph==='end')O.start=nextAlive(seat,1);
  if(O.ph==='turn'&&H.turn===seat)passOn(seat);
  else mark();
}
function nextRound(){
  const O=H.rb;startRound(nextAlive(O.start,1));beginDeal(DEAL_MS);
}
G._test={botPick,DECK,CHIPS,HAND,END_MS,isDouble,costs,afterCard,labelOf};
G.engine={
  start(){
    Object.assign(H,{phase:'play',log:[],seatNote:{},field:[],last:null,reveal:null,shouts:[],pending:null,rankNext:1,known:{},turn:0,botActAt:0,deadline:0});
    const n=H.players.length;
    H.players.forEach(p=>{p.finished=false;p.rank=null;p.surrendered=false;p.hand=[];p.chips=CHIPS});
    H.rb={gn:((H.rb&&H.rb.gn)||0)+1,rn:0,rank:n,deck:[],disc:[],seen:[],ev:[],sq:0};
    const first=Math.random()*n|0;
    startRound(first);addLog(`${n}명 시작. ${H.players[first].name}부터 냅니다.`,'sys');
  },
  act(seat,a){
    if(!H.rb||H.phase!=='play'||seat<0||seat>=H.players.length)return;
    if(a.t==='surrender'){doSurrender(seat);return}
    if(H.rb.ph!=='turn'||H.turn!==seat)return;
    if(a.t==='play'&&Number.isInteger(a.id)&&legal(seat,a.id))doPlay(seat,a.id);
  },
  tick(t){
    const O=H.rb;if(!O||H.phase!=='play')return;
    if(O.ph==='end'){if(t>=O.endAt)nextRound();return}
    if(O.ph!=='turn')return;
    const cur=H.players[H.turn];
    if(t>=H.deadline)timeout();
    else if(cur.bot&&H.botActAt&&t>=H.botActAt&&!(cur.away&&t<cur.awayAt+AWAY_WAIT))doPlay(H.turn,botPick(H.turn));
  },
  snap(s,you,t){
    const O=H.rb;
    s.ps.forEach((x,i)=>{x.cp=H.players[i].chips});
    s.o={gn:O.gn,rn:O.rn,tot:O.tot,dir:O.dir,need:O.need,pl:O.played,ph:O.ph,dc:O.deck.length,top:O.disc.length?O.disc[O.disc.length-1]:-1,sq:O.sq,ev:O.ev.map(e=>({...e}))};
    s.gr=0;s.dl=O.ph==='turn'&&H.phase==='play'?Math.max(0,Math.round(H.deadline-t)):0;
    if(O.ph!=='turn')delete s.t;
  },
  restore(ms){const O=H.rb;if(O&&O.endAt)O.endAt+=ms},
  emoPhase:ph=>ph==='play'||ph==='over'
};

/* ---------- 화면: 조작 ---------- */
let elBox=null,lockAt=-1e9,last2d='';
const iSeat=()=>{const i=myIdx();return i>=0&&V&&V.ps&&i<V.ps.length};
const myTurn=()=>!!(V&&V.o&&V.st==='play'&&V.o.ph==='turn'&&iSeat()&&V.t===myIdx()&&!dealingV());
const blocked=id=>!!(V&&V.o&&V.o.need===2&&DECK[id]&&DECK[id].k==='x2');
const picked=()=>{const a=[...sel];return a.length===1&&!blocked(a[0])?a[0]:null};
G.handMarks=(i,h,hand)=>{
  if(sel.size>1){const keep=[...sel].pop();sel.clear();sel.add(keep)}
  for(const el of hand.children){el.classList.toggle('sel',sel.has(+el.dataset.id));el.classList.toggle('rb-no',myTurn()&&blocked(+el.dataset.id))}
};
G.me=()=>{$('#numpick').hidden=true;mineLamps()};
G.play=()=>{
  const id=picked();
  if(!myTurn()||id==null||clock()-lockAt<300){sfx('no');return}
  lockAt=clock();sel.clear();sendAct({t:'play',id});
};
G.pass=()=>{};
G.keyPhase=st=>st==='play';
G.onKey=()=>false;
G.preView=()=>{};
G.postView=()=>{};
G.buttons=()=>{
  const pb=$('#btnPlay'),ps=$('#btnPass'),ok=myTurn()&&picked()!=null;
  $('#btnGura').hidden=true;ps.hidden=true;pb.hidden=false;
  pb.disabled=!ok;pb.classList.toggle('ready',ok);
  if($('#playMain').textContent!=='내기')$('#playMain').textContent='내기';
  const sub=keyLabel(KEYS.play);if($('#playSub').textContent!==sub)$('#playSub').textContent=sub;
};
G.logCue=()=>false;
const sndLoss=()=>{tone(150,.3,{type:'triangle',vol:.2});tone(110,.4,{type:'triangle',vol:.16,at:.14})};
const sndEnd=()=>{tone(92,.5,{type:'triangle',vol:.26});tone(70,.7,{type:'triangle',vol:.22,at:.18});hiss(.34,{freq:900,q:.8,vol:.14})};
G.cues=(v,pv)=>{
  const a=v.o,b=pv&&pv.o;if(!a||!b||M.on||a.sq<=b.sq||a.rn!==b.rn)return;   // 3D에서는 카드가 내려앉는 순간에 (land)
  sfx('play',1);const e=a.ev[a.ev.length-1];if(e&&e.p)(e.tot>=LIMIT?sndEnd:sndLoss)();
};

/* ---------- 이름표의 불 3개 ---------- */
const lampsHTML=(i,cp)=>`<span class="rb-lamps" data-s="${i}" aria-label="칩 ${cp}개">${[0,1,2].map(k=>`<i${k<cp?' class="on"':''}></i>`).join('')}</span>`;
const lampOf=i=>M.on&&M.lamp[i]!=null?M.lamp[i]:(V.ps[i]&&V.ps[i].cp)||0;
G.nameTag=(p,i)=>p&&p.cp!=null&&V&&V.st!=='wait'?lampsHTML(i,lampOf(i)):'';
/* 내 불은 왼쪽 아래 내 이름표에 (사용자가 정함: 불은 모두 이름표에) */
function mineLamps(){
  const me=$('#me'),i=myIdx();if(!me)return;
  let el=me.querySelector('.rb-mine');
  const on=i>=0&&V&&V.ps&&V.ps[i]&&V.st!=='wait'&&V.ps[i].cp!=null;
  if(!on){if(el)el.remove();return}
  if(!el){el=document.createElement('span');el.className='rb-mine';me.appendChild(el)}
  const h=lampsHTML(i,lampOf(i));if(el.dataset.h!==h){el.dataset.h=h;el.innerHTML=h}
}

function removeMine(){const el=$('#me')&&$('#me').querySelector('.rb-mine');if(el)el.remove()}

/* ---------- 3D: 공통 앉은 카메라 위의 물건 ----------
   가운데 왼쪽 = 뽑을 더미, 오른쪽 = 버린 더미, 그 위 공중 = 합계 홀로그램, 둘레 펠트 = 도는 방향 화살표 */
const PX=.72,HY=1.02;
const M={on:false,built:false,fail:false,root:null,raf:0,deck:null,num:null,arrow:null,fly:[],blinks:[],lamp:[],gn:-1,rn:-1,sq:0,tot:0,dc:0,dir:1,dirAt:-1e9,glAt:-1e9,red:0,key:'',nextFly:0};
const ez=k=>k<=0?0:k>=1?1:k*k*(3-2*k);
const NW=640,NH=400,GL_MS=300,RED_MS=1100;
function drawNum(txt,tag,col,jit){
  const L=M.num,g=L.c.getContext('2d');
  g.clearRect(0,0,NW,NH);
  g.textAlign='center';g.textBaseline='middle';
  g.shadowColor=col;g.shadowBlur=34;g.fillStyle=col;
  g.font=`700 ${txt.length>2?216:250}px "IBM Plex Mono", "Jua", monospace`;
  g.fillText(txt,NW/2,158);g.fillText(txt,NW/2,158);
  if(tag){g.shadowBlur=18;g.font='700 70px "Jua", "IBM Plex Mono", sans-serif';g.fillText(tag,NW/2,340)}
  g.shadowBlur=0;
  if(jit){   // 지직: 가로 띠를 밀고 일부를 지움
    for(let k=0;k<7;k++){const y=rand(0,NH-24)|0,h=rand(8,30)|0,d=rand(-34,34)|0;g.drawImage(L.c,0,y,NW,h,d,y,NW,h)}
    g.clearRect(0,rand(0,NH)|0,NW,rand(2,8)|0);
  }
  L.t.needsUpdate=true;
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
    if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>{M.key=''});
    const at=canvasTex(512,512,(g,w,h)=>{   // 위에서 봤을 때 시계 반대 방향으로 도는 호 두 개
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
  }catch(e){M.fail=true;try{console.warn('로보77 3D 준비 실패',e)}catch(_){}}
  return M.built;
}
const pileSpot=k=>new THREE.Vector3(PX,.03+k*.009,0);
function launch(e,me){
  const now=clock(),t0=Math.max(now,M.nextFly);M.nextFly=t0+FLY_MS*.7;
  const from=e.s===me?nearMe():seatPos(e.s,3.85);from.y=.5;
  const c=makeCard(from,Math.PI/2,0,.8);c.visible=false;c.children[0].material=faceMat(e.id);
  const u=c.userData;u.man=true;
  const to=pileSpot(Math.min(T.field.length,12)),ry=rand(-.3,.3);T.field.push(c);
  M.fly.push({c,e,t0,x0:from.x,y0:from.y,z0:from.z,to,ry});
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
}
/* 카드가 내려앉는 순간: 합계·방향·불이 바뀌고 뽑는 카드가 나감 */
function land(e){
  const now=clock(),o=V&&V.o,me=myIdx();
  sfx('play',1);hiss(.09,{freq:3200,q:1.4,vol:.08});
  M.tot=e.tot;M.glAt=now;M.key='';
  if(e.dir!==M.dir){M.dir=e.dir;M.dirAt=now}
  if(e.p){
    M.red=now+RED_MS;(e.tot>=LIMIT?sndEnd:sndLoss)();
    if(M.lamp[e.s]>0){const k=--M.lamp[e.s];M.blinks.push({s:e.s,k,t0:now});if(typeof renderLabels==='function')renderLabels();mineLamps()}
  }
  for(let j=0;j<(e.d||0);j++){
    const to=e.s===me?nearMe():seatPos(e.s,3.85),c=makeCard(new THREE.Vector3(-PX,.2,0),Math.PI/2,0,.9),u=c.userData;
    u.p.set(to.x,.4,to.z);u.s=.55;u.die=true;
  }
  if(o&&!M.fly.length&&!M.blinks.length)syncLamps();
}
function syncLamps(){if(V&&V.ps){M.lamp=V.ps.map(p=>p.cp);if(typeof renderLabels==='function')renderLabels();mineLamps()}}
function clearPile(){for(const c of T.field)killCard(c);T.field=[];M.fly=[]}
G.field3D=(v,pv,me)=>{
  const o=v.o;if(!o||!T.ok||!M.built||v.st==='wait')return;
  const fresh=M.gn!==o.gn||M.rn!==o.rn;
  if(fresh){
    const live=M.gn===o.gn&&M.rn>=0;
    clearPile();M.blinks=[];M.gn=o.gn;M.rn=o.rn;M.dir=o.dir;M.nextFly=0;M.red=0;M.key='';M.lamp=v.ps.map(p=>p.cp);
    M.sq=live?0:o.sq;M.tot=live?0:o.tot;M.dc=o.dc;
    if(!live&&o.top>=0){const to=pileSpot(0),c=makeCard(to,-Math.PI/2,rand(-.3,.3),1);c.children[0].material=faceMat(o.top);T.field.push(c)}
  }
  if(o.dc>M.dc+3){while(T.field.length>1)killCard(T.field.shift())}   // 버린 카드를 섞어 뽑을 더미로
  M.dc=o.dc;
  for(const e of o.ev)if(e.q>M.sq){M.sq=e.q;launch(e,me)}
  while(T.field.length>13)killCard(T.field.shift());
  if(!M.fly.length&&!M.blinks.length){M.tot=o.tot;const a=M.lamp.join(),b=v.ps.map(p=>p.cp).join();if(a!==b)M.lamp=v.ps.map(p=>p.cp)}
};
function step(){
  M.raf=0;if(!M.on||!V||!V.o)return;
  M.raf=requestAnimationFrame(step);
  const now=clock(),o=V.o,show=V.st!=='wait'&&!dealingV();
  flyStep(now);
  M.deck.visible=show&&o.dc>0;
  if(M.deck.visible){const h=Math.max(.012,o.dc*.009);M.deck.scale.y=h;M.deck.position.y=.02+h/2}
  M.arrow.visible=show;
  if(show){
    const e=ez((now-M.dirAt)/320),flip=e<.5?1-e*2:e*2-1,d=e<.5?-M.dir:M.dir;
    M.arrow.scale.x=Math.max(.02,flip)*d;
    M.arrow.rotation.y=(now/1000*.16*M.dir)%(Math.PI*2);
  }
  {const sp=M.num.sp;sp.visible=show;
   if(show){
     const gl=now-M.glAt<GL_MS,red=now<M.red,txt=String(M.tot),tag=o.ph==='turn'&&(o.need===2||o.pl>0)&&o.need>0?`${o.need}장`:'',key=txt+'|'+tag+'|'+(red?1:0);
     if(gl||key!==M.key||M.wasGl){M.key=key;M.wasGl=gl;drawNum(txt,tag,red?'#ff5a3c':'#ffb04a',gl)}
     sp.position.x=PX+(red?Math.sin(now/34)*.02:0);
   }}
  M.blinks=M.blinks.filter(b=>{
    const el=document.querySelector(`.rb-lamps[data-s="${b.s}"]`),q=el&&el.children[b.k];
    const e=now-b.t0,lit=e<BLINK_MS&&Math.floor(e/(BLINK_MS/4))%2===1;
    if(q)q.classList.toggle('lit',lit);
    if(e<BLINK_MS)return true;
    if(q)q.classList.remove('lit');
    return false;
  });
}

/* ---------- 2D (WebGL이 없을 때) ---------- */
function draw2d(){
  if(!elBox||!V||!V.o)return;
  const d=elBox.querySelector('.rb-2d');if(M.on){if(d.innerHTML)d.innerHTML='';last2d='';return}
  const o=V.o,h=`<p class="rb-big">${o.tot}</p><p class="rb-dir">${o.dir>0?'↻':'↺'}${o.ph==='turn'&&(o.need===2||o.pl>0)?` · ${o.need}장`:''}</p>`;
  if(h!==last2d){d.innerHTML=h;last2d=h}
}
G.hud=inGame=>{
  if(!elBox)return;
  const on=!!(inGame&&V&&V.o);
  elBox.hidden=!on;
  const d3=on&&build();
  if(d3!==M.on){M.on=d3;if(M.root)M.root.visible=d3;if(d3){M.key='';if(!M.raf)M.raf=requestAnimationFrame(step)}}
  $('#stage').classList.add('rbg');
  if(!on){if(T.ok&&T.field.length)clearPile();M.gn=M.rn=-1;removeMine();return}
  draw2d();
};
G.overDelay=()=>1300;
G.overRank=p=>{const t=p.sr===3?'탈주':p.sr?'항복':'';return t?`<span class="left">${t}</span>`:''};
G.live=()=>{};
G.enter=()=>{$('#btnGura').hidden=true;$('#btnPass').hidden=true};
G.leave=()=>{
  if(T.ok)clearPile();
  if(elBox)elBox.hidden=true;
  if(M.root)M.root.visible=false;
  Object.assign(M,{on:false,fly:[],blinks:[],gn:-1,rn:-1,sq:0,key:''});
  $('#stage').classList.remove('rbg');
  $('#btnPass').hidden=false;
  removeMine();
};
G.holoPiece=mkM=>{
  const g=new THREE.Group(),tx=canvasTex(128,186,(x,w,h)=>{x.fillStyle='#fff';x.fillRect(0,0,w,h);x.fillStyle='#34404f';x.font='700 76px "IBM Plex Mono", monospace';x.textAlign='center';x.textBaseline='middle';x.fillText('77',w/2,h/2)});
  const a=new THREE.Mesh(new THREE.BoxGeometry(.4,.58,.012),mkM(0xffffff,T.back.map));a.position.set(-.13,0,-.03);a.rotation.z=.16;g.add(a);
  const b=new THREE.Mesh(new THREE.BoxGeometry(.4,.58,.012),mkM(0xffffff,tx));b.position.set(.09,.03,.01);b.rotation.z=-.1;g.add(b);
  g.rotation.set(-.3,.2,0);return g;
};
G.init=()=>{
  const css=document.createElement('style');
  css.textContent=`
.rb-box{position:absolute;inset:0;pointer-events:none;z-index:3}
.rb-box[hidden]{display:none}
.stage.rbg .card.rb-c .big{font-family:"IBM Plex Mono","Jua",monospace;font-weight:700;font-size:32px;color:var(--rc)}
.stage.rbg .card.rb-c.rb-w .big{font-size:25px}
.stage.rbg .card.rb-c .cn{font-size:14px;color:var(--rc)}
.stage.rbg .card.rb-c.rb-no{filter:grayscale(1);opacity:.6}
.stage.rbg .seat:not(.out) .ct{display:none}
.rb-lamps{display:inline-flex;gap:3px;vertical-align:middle;margin-right:5px}
.rb-lamps i{width:9px;height:9px;border-radius:50%;background:#3a2c22;box-shadow:inset 0 1px 2px rgba(0,0,0,.6)}
.rb-lamps i.on,.rb-lamps i.lit{background:#ffb04a;box-shadow:0 0 7px 1px rgba(255,160,60,.85)}
.rb-mine{display:inline-flex;align-items:center;margin-left:6px}
.rb-mine .rb-lamps{margin-right:0}
.rb-2d{position:absolute;left:0;right:0;top:128px;text-align:center;color:#3b2a1f}
.rb-2d p{margin:2px 0}.rb-big{font:700 72px "IBM Plex Mono",monospace;color:#b5521e}.rb-dir{font:700 22px "Jua",sans-serif}
`;
  document.head.appendChild(css);
  elBox=document.createElement('div');elBox.className='rb-box';elBox.hidden=true;elBox.innerHTML='<div class="rb-2d"></div>';
  $('#stage').appendChild(elBox);
};
(window.GAMES=window.GAMES||{}).robo77=G;
})();
