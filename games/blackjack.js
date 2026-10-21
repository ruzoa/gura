/* ===== 블랙잭 게임 모듈 =====
   공통 코드(index.html)가 GAMES.blackjack의 함수를 불러서 이 게임의 규칙·봇·카드·화면을 그림.
   카드 id: 0~51 = 숫자 순번(0~12 = A,2,…,10,J,Q,K)*4 + 무늬(0~3 = ♠ ♥ ♦ ♣). 한 판에 카드가 모자라면 52를 더한 id로 새 한 벌을 섞어 씀(id%52가 그림)
   손패(hand)는 공통 코드가 '끝나지 않은 사람'으로 보도록 [0]만 넣어 둠. 진짜 카드는 H.bj.hc(사람마다)·H.bj.dc(딜러)이고 모두에게 보임(딜러의 엎은 카드만 숨김)
   한 판: 베팅(모두 동시에) → 카드 나누기(공통 beginDeal로 그동안 멈춤) → 차례대로 히트·스탠드·더블 → 딜러 → 정산 → 다음 판 */
(function(){
const G={id:'blackjack',name:'블랙잭',short:'블랙잭',lead:'21에 가깝게, 넘지 않게',brand:'블랙잭',brandPx:50};

/* ---------- 카드 ---------- */
const RK=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const SUITS=['♠','♥','♦','♣'];
const SUIT_COL=['#34404f','#c53026','#c53026','#34404f'];
const rkOf=id=>(id%52)>>2, suitOf=id=>(id%52)&3;
const valOf=id=>{const r=rkOf(id);return r===0?11:r>=9?10:r+1};
/* 합계: A는 11로 세다가 21을 넘으면 1로. soft = 11로 센 A가 남아 있음. 엎은 카드(-1)는 빼고 셈 */
function score(cs){let t=0,a=0;for(const id of cs){if(!(id>=0))continue;const v=valOf(id);t+=v;if(v===11)a++}while(t>21&&a){t-=10;a--}return {t,soft:a>0}}
const isBJ=cs=>cs.length===2&&cs.every(id=>id>=0)&&score(cs).t===21;
G.cardHTML=()=>'';   // 손패 부채는 쓰지 않음 (카드는 모두 테이블 위)
G.labelOf=id=>RK[rkOf(id)];G.cmpCard=(a,b)=>a-b;
Object.assign(G,{score,isBJ,valOf});
/* 3D 카드 앞면 (60×88 카드를 256×372로 확대) */
G.drawFace=function(g,w,h,id){
  const RC=SUIT_COL[suitOf(id)],k=w/60,lab=RK[rkOf(id)],su=SUITS[suitOf(id)];
  g.clearRect(0,0,w,h);
  g.save();rr(g,0,0,w,h,8*k);g.clip();g.fillStyle='#fffcf5';g.fillRect(0,0,w,h);g.fillStyle=RC;g.fillRect(0,0,w,3*k);g.restore();
  g.strokeStyle='#e3d4bb';g.lineWidth=k;rr(g,k/2,k/2,w-k,h-k,8*k);g.stroke();
  g.fillStyle=RC;g.textAlign='left';g.textBaseline='top';
  g.font=`600 ${(lab.length>1?16:19)*k}px "IBM Plex Mono", "Jua", monospace`;g.fillText(lab,5*k,6*k);
  g.font=`${14*k}px sans-serif`;g.fillText(su,6*k,26*k);
  g.textAlign='center';g.textBaseline='middle';
  if(rkOf(id)>=10){g.font=`${34*k}px "Jua", "Black Han Sans", sans-serif`;g.fillText(lab,w/2,50*k)}   // J·Q·K는 글자로 크게
  else{g.font=`${40*k}px sans-serif`;g.fillText(su,w/2,50*k)}
  g.save();g.translate(w-6*k,h-3*k);g.rotate(Math.PI);g.font=`600 ${13*k}px "IBM Plex Mono", "Jua", monospace`;g.textAlign='left';g.textBaseline='top';g.fillText(lab,0,0);g.restore();
};
/* 2D 카드 (WebGL이 없을 때) */
const cardEl=id=>id>=0?`<span class="card bjc" style="--rc:${SUIT_COL[suitOf(id)]}"><span class="cn">${RK[rkOf(id)]}<i>${SUITS[suitOf(id)]}</i></span><span class="big">${rkOf(id)>=10?RK[rkOf(id)]:SUITS[suitOf(id)]}</span><span class="cn2" aria-hidden="true">${RK[rkOf(id)]}</span></span>`:'<span class="card bjc back" aria-label="엎은 카드"></span>';

/* ---------- 규칙 설명·방 설정 ---------- */
G.rulesHTML='<ol class="rules"><li><b>목표</b> : 모두 같은 수의 칩으로 시작해서, 정한 판 수를 마쳤을 때 칩이 가장 많은 사람이 이깁니다</li><li><b>베팅</b> : 판마다 먼저 칩을 겁니다 (10개 단위, 최소 10개)</li><li><b>카드</b> : 모두 두 장씩 앞면으로 받고, 딜러는 한 장을 엎어 둡니다. A는 1이나 11, J·Q·K는 10입니다</li><li><b>차례</b> : <b>히트</b>는 한 장 더, <b>스탠드</b>는 멈춤, <b>더블</b>은 처음 두 장일 때 건 칩을 두 배로 하고 딱 한 장만 더 받습니다. 21을 넘으면 <b>버스트</b>로 집니다</li><li><b>딜러</b> : 엎은 카드를 펼치고 16 이하면 반드시 더 받습니다. 봇 딜러는 17 이상이면 멈추고, 사람 딜러는 17 이상에서 더 받을지 고릅니다</li><li><b>정산</b> : 딜러보다 21에 가까우면 건 만큼 받고, 처음 두 장이 21(<b>블랙잭</b>)이면 1.5배를 받습니다. 같으면 무승부입니다. 딜러가 A나 10을 보이고 블랙잭이면 바로 정산합니다</li><li><b>사람 딜러</b> : 탁자 설정에서 켜면 참가자가 돌아가며 딜러를 맡아, 진 사람의 칩을 받고 이긴 사람에게 칩을 줍니다 (칩이 모자라면 가진 만큼 나눠 줌). 판 수를 인원의 배수로 하면 모두 같은 횟수만큼 딜러를 맡습니다</li><li><b>탈락</b> : 칩이 10개보다 적어지면 탈락합니다</li><li><b>시간 초과</b> : 베팅은 최소 칩(10개), 차례는 스탠드입니다</li><li>스플릿·인슈어런스는 없습니다</li></ol>';
G.modeDesc=['정한 판 수까지','정한 판 수까지'];
G.noFast=true;
G.specNote='관전 중입니다. 딜러가 엎은 카드만 빼고 모두 보입니다.';
const MIN=10;
G.defaults={chips:100,rounds:8,turn:20,hdeal:0};
G.roomSet=[
  {k:'chips',label:'시작 칩',unit:'개',lo:50,hi:1000,step:50,desc:'모두 같은 수의 칩으로 시작합니다'},
  {k:'rounds',label:'판 수',unit:'판',lo:1,hi:30,step:1,desc:'이 판 수를 마치면 칩이 가장 많은 사람이 이깁니다'},
  {k:'turn',label:'제한 시간',unit:'초',lo:5,hi:60,step:5,desc:'시간이 지나면 베팅은 최소 칩, 차례는 스탠드'}];
G.minN=c=>+c.hdeal?2:1;   // 봇 딜러면 혼자서도 시작 (사람 딜러는 2명부터). 공통 코드가 이 인원부터 시작 버튼을 올림
G.ruleSet=[{k:'hdeal',label:'사람 딜러',off:'봇 딜러',desc:'켜면 참가자가 돌아가며 딜러를 맡고, 끄면 봇 딜러가 맡습니다'}];
G.cfgChips=c=>`<span class="chip">시작 칩 <b>${+c.chips}개</b></span><span class="chip"><b>${+c.rounds}판</b></span><span class="chip"><b>${+c.hdeal?'사람 딜러':'봇 딜러'}</b></span><span class="chip">제한 시간 <b>${+c.turn}초</b></span>`;
G.cfgSum=c=>`시작 칩 ${+c.chips}개 · ${+c.rounds}판 · ${+c.hdeal?'사람 딜러':'봇 딜러'} · 제한 시간 ${+c.turn}초`;
G.roomSub=x=>`${x.hd?'사람 딜러':'봇 딜러'} · ${+x.rds||8}판`;
G.pubExtra=c=>({hd:+c.hdeal?1:0,rds:+c.rounds||8});
G.cardInfo=()=>'';
G.rankTitle=()=>'';
G.finLabel=()=>'';
G.noEmotes=['gq'];
G.keys={bjUp:'ArrowUp',bjDown:'ArrowDown'};
G.keyActions=[
  {a:'gura',n:'더블',d:'처음 두 장일 때 건 칩을 두 배로 하고 한 장만 더 받습니다 (구라!와 같은 키)'},
  {a:'bjUp',n:'베팅 늘리기',d:'걸 칩을 10개 늘립니다'},
  {a:'bjDown',n:'베팅 줄이기',d:'걸 칩을 10개 줄입니다'}];

/* ---------- 방장 엔진 ---------- */
const DEAL_PER=260;   // 처음 나눌 때 카드 한 장 간격 (ms)
const REVEAL_MS=900,DRAW_MS=850,SETTLE_MS=3600;
const nm=i=>H.players[i]?H.players[i].name:'';
const canBot=(p,t)=>!!p&&p.bot&&!(p.away&&t<p.awayAt+AWAY_WAIT);   // 끊긴 사람은 기다리는 동안 봇이 대신하지 않음
const alive=i=>!!H.players[i]&&!H.players[i].finished;
/* 이번 판에 거는 사람: 딜러 다음 자리부터 (봇 딜러면 0번부터) */
function seatOrder(){
  const n=H.players.length,B=H.bj,s=B.dl>=0?B.dl+1:0,out=[];
  for(let k=0;k<n;k++){const i=(s+k)%n;if(i!==B.dl&&alive(i))out.push(i)}
  return out;
}
const firstUnbet=()=>{const B=H.bj,i=B.order.find(j=>alive(j)&&!B.bt[j]);return i==null?-1:i};
function draw(){
  const B=H.bj;
  if(!B.deck.length){B.extra=(B.extra||0)+1;B.deck=shuffle([...Array(52).keys()].map(x=>x+52*B.extra))}   // 한 벌이 다 나가면 새 한 벌 (거의 없음)
  return B.deck.pop();
}
function newRound(){
  const B=H.bj,n=H.players.length,t=clock();
  B.rd++;
  if(B.hd){   // 사람 딜러: 남은 사람 중 지난 딜러 다음 자리
    let d=-1;for(let k=1;k<=n;k++){const j=((B.dl<0?-1:B.dl)+k+n)%n;if(alive(j)){d=j;break}}
    B.dl=d;
  }
  B.order=seatOrder();
  Object.assign(B,{bt:Array(n).fill(0),hc:Array.from({length:n},()=>[]),st:Array(n).fill(0),db:Array(n).fill(0),rs:null,dc:[],dr:0,ph:'bet',nextAt:0,auto:false,stop:false,deck:[],extra:0,botAt:Array(n).fill(0)});
  B.order.forEach(i=>{if(H.players[i].bot)B.botAt[i]=t+rand(700,2400)});
  H.seatNote={};
  H.deadline=t+H.cfg.turn*1000;H.botActAt=0;H.turn=firstUnbet();
  addLog(`${B.rd}판${B.hd&&B.dl>=0?` · 딜러 ${nm(B.dl)}`:''}`,'sys');
  B.sq++;mark();
}
function placeBet(i,a){
  const B=H.bj;
  if(B.ph!=='bet'||!B.order.includes(i)||B.bt[i]||!alive(i))return false;
  a=Math.round(+a/MIN)*MIN;const mx=Math.floor(B.ch[i]/MIN)*MIN;
  if(!(a>=MIN))return false;
  a=Math.min(a,mx);if(a<MIN)return false;
  B.bt[i]=a;H.seatNote[i]=`베팅 ${a}`;B.sq++;
  if(B.order.every(j=>!alive(j)||B.bt[j]))startDeal();
  else{H.turn=firstUnbet();mark()}
  return true;
}
function startDeal(){
  const B=H.bj;
  B.order=B.order.filter(i=>alive(i)&&B.bt[i]>0);
  if(!B.order.length){endRound();return}
  B.deck=shuffle([...Array(52).keys()]);B.extra=0;
  for(let r=0;r<2;r++){for(const i of B.order)B.hc[i].push(draw());B.dc.push(draw())}
  B.ph='deal';H.turn=-1;H.botActAt=0;B.nextAt=0;B.sq++;
  beginDeal(2*(B.order.length+1)*DEAL_PER+500);   // 나누는 동안 제한 시간·봇·행동을 멈춤 (화면은 카드가 한 장씩 날아감)
  mark();
}
function afterDeal(){
  const B=H.bj;
  B.order.forEach(i=>{if(isBJ(B.hc[i])){B.st[i]=3;addLog(`${nm(i)} 블랙잭!`,'sp')}});
  const up=valOf(B.dc[0]);
  if((up===11||up===10)&&isBJ(B.dc)){B.dr=1;addLog('딜러 블랙잭!','sp');settle();return}   // 딜러가 먼저 확인
  B.ph='turn';nextPlayer();
}
function nextPlayer(){
  const B=H.bj,t=clock();
  const i=B.order.find(j=>B.st[j]===0&&alive(j));
  if(i==null){dealerTurn();return}
  H.turn=i;H.deadline=t+H.cfg.turn*1000;H.botActAt=H.players[i].bot?t+rand(900,1700):0;B.sq++;mark();
}
const canDouble=i=>{const B=H.bj;return B.hc[i].length===2&&B.st[i]===0&&B.ch[i]>=2*B.bt[i]};
function doHit(i){
  const B=H.bj;B.hc[i].push(draw());const s=score(B.hc[i]).t;
  if(s>21){B.st[i]=2;addLog(`${nm(i)} 버스트 (${s})`)}
  else if(s===21)B.st[i]=1;
  B.sq++;
  if(B.st[i])nextPlayer();
  else{const t=clock();H.deadline=t+H.cfg.turn*1000;H.botActAt=H.players[i].bot?t+rand(900,1600):0;mark()}
}
function doStand(i){const B=H.bj;B.st[i]=1;B.sq++;nextPlayer()}
function doDouble(i){
  const B=H.bj;B.bt[i]*=2;B.db[i]=1;H.seatNote[i]=`베팅 ${B.bt[i]}`;
  B.hc[i].push(draw());const s=score(B.hc[i]).t;
  addLog(`${nm(i)} 더블${s>21?` · 버스트 (${s})`:''}`);
  B.st[i]=s>21?2:1;B.sq++;nextPlayer();
}
/* 딜러 차례: 엎은 카드를 펼침. 스탠드한 사람이 없으면(모두 버스트·블랙잭) 더 받지 않음 */
function dealerTurn(){
  const B=H.bj,t=clock();B.ph='dealer';B.dr=1;H.turn=-1;H.botActAt=0;B.sq++;
  if(!B.order.some(i=>B.st[i]===1&&alive(i))){B.auto=true;B.stop=true;B.nextAt=t+REVEAL_MS;mark();return}
  const hp=B.hd&&B.dl>=0?H.players[B.dl]:null;
  if(hp&&!hp.finished&&score(B.dc).t<21){B.auto=false;H.turn=B.dl;H.deadline=t+REVEAL_MS+H.cfg.turn*1000;H.botActAt=hp.bot?t+REVEAL_MS+rand(700,1500):0}
  else{B.auto=true;B.stop=false;B.nextAt=t+REVEAL_MS}
  mark();
}
const dealerMust=()=>score(H.bj.dc).t<17;
function dealerHit(){
  const B=H.bj,t=clock();B.dc.push(draw());B.sq++;
  const s=score(B.dc).t;
  if(s>21)addLog(`딜러 버스트 (${s})`);
  if(s>=21){B.auto=true;B.stop=true;B.nextAt=t+DRAW_MS;H.turn=-1;mark();return}
  H.deadline=t+H.cfg.turn*1000;H.botActAt=H.players[B.dl]&&H.players[B.dl].bot?t+rand(900,1500):0;mark();
}
function dealerStand(){const B=H.bj;B.auto=true;B.stop=true;B.nextAt=clock()+500;H.turn=-1;B.sq++;mark()}
function dealerTick(t){
  const B=H.bj;
  if(B.auto){
    if(t<B.nextAt)return;
    if(!B.stop&&dealerMust()){B.dc.push(draw());B.sq++;B.nextAt=t+DRAW_MS;const s=score(B.dc).t;if(s>21)addLog(`딜러 버스트 (${s})`);mark()}
    else settle();
    return;
  }
  const p=H.players[B.dl];
  if(!p||p.finished){B.auto=true;B.nextAt=t+400;H.turn=-1;mark();return}
  if(t>=H.deadline){B.auto=true;B.nextAt=t;H.turn=-1;addLog(`${p.name} 시간 초과`,'sys');mark();return}   // 시간이 지나면 정해진 대로(16 이하 받기, 17 이상 멈춤)
  if(H.botActAt&&t>=H.botActAt&&canBot(p,t))botDealer();
}
/* 정산: 이긴 만큼 받고 진 만큼 냄. 사람 딜러면 그 칩이 딜러에게서 나가고 들어옴 (모자라면 가진 만큼 나눠 줌) */
function settle(){
  const B=H.bj,t=clock(),d=score(B.dc).t,dbj=isBJ(B.dc),n=H.players.length;
  B.dr=1;B.ph='settle';H.turn=-1;H.botActAt=0;
  const net=Array(n).fill(0);
  for(const i of B.order){
    const b=B.bt[i];if(!b)continue;
    if(B.st[i]===4){net[i]=-b;continue}   // 판 도중 항복·탈주: 건 칩을 잃음
    const s=score(B.hc[i]).t,bj=B.st[i]===3;
    net[i]=s>21?-b:bj&&!dbj?b*3/2:dbj&&!bj?-b:bj&&dbj?0:d>21?b:s>d?b:s<d?-b:0;
  }
  if(B.hd&&B.dl>=0){
    const loss=net.reduce((a,x)=>a+(x<0?-x:0),0),owe=net.reduce((a,x)=>a+(x>0?x:0),0);
    let paid=owe;
    if(B.ch[B.dl]+loss-owe<0){   // 딜러 칩이 모자람: 가진 칩 + 받은 칩을 이긴 사람에게 비율대로
      const pot=B.ch[B.dl]+loss;paid=0;
      net.forEach((x,i)=>{if(x>0){net[i]=Math.floor(x*pot/owe);paid+=net[i]}});
      addLog(`딜러 ${nm(B.dl)} 칩이 모자라 가진 만큼 나눠 줍니다.`,'sys');
    }
    net[B.dl]=loss-paid;
  }
  net.forEach((x,i)=>{B.ch[i]+=x});
  B.rs=net;
  const sg=x=>x>0?`+${x}`:x<0?`−${-x}`:'±0';
  addLog(`딜러 ${dbj?'블랙잭':d>21?'버스트':d} · ${B.order.map(i=>`${nm(i)} ${sg(net[i])}`).join(' · ')}`,'sys');
  B.order.forEach(i=>{const p=H.players[i];if(!p.bot||p.finished)return;
    if(net[i]>=B.bt[i]*1.5&&B.st[i]===3&&Math.random()<.5)botEmote(i,'lol',500+Math.random()*700);
    else if(net[i]<0&&-net[i]>=B.ch[i]&&Math.random()<.5)botEmote(i,'cry',600+Math.random()*700)});
  B.nextAt=t+SETTLE_MS;B.sq++;mark();
}
function endRound(){
  const B=H.bj;
  // 칩이 최소 베팅보다 적으면 탈락 (적은 사람부터 아래 순위)
  const broke=H.players.map((p,i)=>i).filter(i=>alive(i)&&B.ch[i]<MIN).sort((a,b)=>B.ch[a]-B.ch[b]||b-a);
  for(const i of broke){const p=H.players[i];p.finished=true;p.broke=true;p.hand=[];p.rank=H.rankBottom--;addLog(`${p.name} 칩이 떨어졌습니다.`,'lie')}
  const act=H.players.filter(p=>!p.finished).length;
  if(B.rd>=B.rds||act<(B.hd?2:1)){endGame();return}
  newRound();
}
/* 게임 끝: 남은 사람은 칩이 많은 순서 (같으면 같은 순위) */
function endGame(){
  const B=H.bj;B.ph='end';H.turn=-1;H.botActAt=0;
  const rest=H.players.map((p,i)=>i).filter(alive);
  rest.forEach(i=>{const p=H.players[i];p.rank=H.rankNext+rest.filter(j=>B.ch[j]>B.ch[i]).length});
  rest.forEach(i=>{H.players[i].finished=true});
  addLog('게임 종료','sys');H.phase='over';B.sq++;mark();
  H.players.forEach((p,i)=>{if(p.bot&&Math.random()<.5)botEmote(i,'gg',800+Math.random()*1600)});
}
function doSurrender(i){
  if(H.phase!=='play'||i<0)return;
  const p=H.players[i],B=H.bj;if(!p||p.finished)return;
  p.finished=true;p.surrendered=true;p.hand=[];p.rank=H.rankBottom--;
  addLog(`${p.name} ${p.deserter?'탈주':'항복'}!`,'lie');
  if(B.ph==='bet'){B.order=B.order.filter(j=>j!==i);B.bt[i]=0;delete H.seatNote[i]}
  else if(B.order.includes(i)&&B.ph!=='settle')B.st[i]=4;
  B.sq++;
  if(H.players.filter(x=>!x.finished).length<(B.hd?2:1)){endGame();return}
  if(B.ph==='bet'){if(B.order.every(j=>!alive(j)||B.bt[j]))startDeal();else{H.turn=firstUnbet();mark()}return}
  if(B.ph==='turn'&&H.turn===i){nextPlayer();return}
  if(B.ph==='dealer'&&i===B.dl&&!B.auto){B.auto=true;B.nextAt=clock()+400;H.turn=-1}
  mark();
}
/* ---------- 봇 ---------- */
function botBet(i){
  const B=H.bj,c=B.ch[i],lv=botLv(H.players[i]),mx=Math.floor(c/MIN)*MIN;
  let a;
  if(lv===0)a=MIN*(1+(Math.random()*4|0));
  else if(lv===1)a=Math.round(c*rand(.05,.12)/MIN)*MIN;
  else{   // 어려움: 평소엔 칩의 5% 정도. 남은 판이 적은데 1등과 차이가 크면 따라잡을 만큼, 1등이고 마지막 판이면 최소로
    const left=B.rds-B.rd+1,others=H.players.map((p,j)=>j).filter(j=>j!==i&&j!==B.dl&&alive(j));
    const top=others.length?Math.max(...others.map(j=>B.ch[j])):0,gap=top-c;
    a=Math.round(c*.05/MIN)*MIN;
    if(gap>0&&left<=3)a=Math.max(a,Math.ceil(gap/left/MIN)*MIN);
    if(gap<0&&left===1)a=MIN;
  }
  return Math.max(MIN,Math.min(mx,a));
}
/* 기본 전략 (스플릿 없음). up: 딜러가 보인 카드 값 2~11 */
function basic(t,soft,up,dbl){
  if(soft){
    if(t>=19)return 'stand';
    if(t===18)return up>=3&&up<=6?(dbl?'double':'stand'):up<=8?'stand':'hit';
    if(t===17)return up>=3&&up<=6&&dbl?'double':'hit';
    if(t>=15)return up>=4&&up<=6&&dbl?'double':'hit';
    return up>=5&&up<=6&&dbl?'double':'hit';
  }
  if(t>=17)return 'stand';
  if(t>=13)return up<=6?'stand':'hit';
  if(t===12)return up>=4&&up<=6?'stand':'hit';
  if(t===11)return up<=10&&dbl?'double':'hit';
  if(t===10)return up<=9&&dbl?'double':'hit';
  if(t===9)return up>=3&&up<=6&&dbl?'double':'hit';
  return 'hit';
}
function botPlay(i){
  const B=H.bj,{t,soft}=score(B.hc[i]),up=valOf(B.dc[0]),lv=botLv(H.players[i]),dbl=canDouble(i);
  let m;
  if(lv===0){m=t<15?'hit':t<17&&Math.random()<.5?'hit':'stand';if(dbl&&t===11&&Math.random()<.3)m='double'}
  else if(lv===1){m=soft?(t<=17?'hit':'stand'):(t<17?'hit':'stand');if(dbl&&!soft&&(t===10||t===11)&&up<=9)m='double'}
  else m=basic(t,soft,up,dbl);
  if(m==='double'&&!dbl)m='hit';
  if(m==='hit')doHit(i);else if(m==='double')doDouble(i);else doStand(i);
}
/* 사람 딜러 자리의 봇: 16 이하는 받고, 17·18에서는 스탠드하면 잃을 칩이 크면 한 장 더 */
function botDealer(){
  const B=H.bj,{t}=score(B.dc),lv=botLv(H.players[B.dl]);
  let hit=t<17;
  if(!hit&&t<=18&&lv>=1){
    let lose=0,win=0;
    for(const i of B.order){if(B.st[i]!==1||!alive(i))continue;const s=score(B.hc[i]).t;if(s>t)lose+=B.bt[i];else if(s<t)win+=B.bt[i]}
    hit=t===17?lose>win:lv===2&&lose>2*win;
  }
  if(hit)dealerHit();else dealerStand();
}
G._test={score,isBJ,basic,newRound,placeBet,startDeal,afterDeal,doHit,doStand,doDouble,settle,endRound,dealerHit,dealerStand,canDouble,MIN};
G.engine={
  start(){
    const n=H.players.length;
    H.players.forEach(p=>{p.hand=[0];p.broke=false});
    Object.assign(H,{phase:'play',log:[],seatNote:{},turn:-1,rankNext:1,rankBottom:n,graceUntil:0,botActAt:0,deadline:0});
    H.bj={rd:0,rds:Math.max(1,+H.cfg.rounds||8),hd:!!+H.cfg.hdeal,dl:-1,ch:Array(n).fill(Math.max(MIN,+H.cfg.chips||100)),sq:0,order:[],bt:[],hc:[],st:[],db:[],dc:[],dr:0,rs:null,ph:'bet',deck:[],botAt:[]};
    addLog(`${n}명 게임 시작 · 칩 ${H.bj.ch[0]}개 · ${H.bj.rds}판 · ${H.bj.hd?'사람 딜러':'봇 딜러'}`,'sys');
    newRound();
  },
  act(seat,a){
    const B=H.bj;if(!B||!a)return;
    if(a.t==='surrender'){doSurrender(seat);return}
    if(H.phase!=='play'||seat<0||!alive(seat))return;
    if(a.t==='bet'){placeBet(seat,a.a);return}
    if(B.ph==='turn'&&H.turn===seat){
      if(a.t==='hit')doHit(seat);
      else if(a.t==='stand')doStand(seat);
      else if(a.t==='double'&&canDouble(seat))doDouble(seat);
    }else if(B.ph==='dealer'&&!B.auto&&seat===B.dl&&H.turn===seat){
      const s=score(B.dc).t;
      if(a.t==='hit'&&s<21)dealerHit();
      else if(a.t==='stand'&&s>=17)dealerStand();
    }
  },
  tick(t){
    const B=H.bj;if(H.phase!=='play'||!B)return;
    if(B.ph==='bet'){
      if(t>=H.deadline){   // 시간 초과: 아직 안 건 사람은 최소 칩
        const late=B.order.filter(i=>alive(i)&&!B.bt[i]);
        late.forEach(i=>{B.bt[i]=MIN;H.seatNote[i]=`베팅 ${MIN}`});
        if(late.length)addLog(`시간 초과 · ${late.map(nm).join(', ')} 최소 칩`,'sys');
        startDeal();return;
      }
      for(const i of B.order){
        const p=H.players[i];
        if(!B.bt[i]&&alive(i)&&B.botAt[i]&&t>=B.botAt[i]&&canBot(p,t)){B.botAt[i]=0;placeBet(i,botBet(i));if(B.ph!=='bet')return}
      }
    }else if(B.ph==='deal')afterDeal();
    else if(B.ph==='turn'){
      const i=H.turn,p=H.players[i];
      if(!p||!alive(i)){nextPlayer();return}
      if(t>=H.deadline){H.seatNote[i]=`베팅 ${B.bt[i]}`;addLog(`${p.name} 시간 초과 · 스탠드`,'sys');doStand(i)}
      else if(H.botActAt&&t>=H.botActAt&&canBot(p,t))botPlay(i);
    }else if(B.ph==='dealer')dealerTick(t);
    else if(B.ph==='settle'&&t>=B.nextAt)endRound();
  },
  snap(s,you,t){
    const B=H.bj;if(!B)return;
    s.gr=0;s.dl=Math.max(0,Math.round(H.deadline-t));
    const dc=B.dc.slice();if(!B.dr&&!(B.hd&&you>=0&&you===B.dl)&&dc.length>1)dc[1]=-1;   // 엎은 카드는 사람 딜러 본인만 봄
    s.bj={ph:B.ph,rd:B.rd,rds:B.rds,hd:B.hd?1:0,dl:B.dl,ch:B.ch.slice(),bt:B.bt.slice(),hc:B.hc.map(h=>h.slice()),st:B.st.slice(),db:B.db.slice(),dc,dr:B.dr,rs:B.rs?B.rs.slice():null,od:B.order.slice(),sq:B.sq};
    // 베팅은 모두 동시에: 아직 안 건 사람에게는 자기 차례로 보냄 (제한 시간·내 차례 표시)
    if(B.ph==='bet'&&you>=0&&B.order.includes(you)&&!B.bt[you]&&alive(you))s.t=you;
    else if(H.turn>=0&&H.phase==='play')s.t=H.turn;
    else delete s.t;
  },
  restore(d){
    const B=H.bj;if(!B)return;
    if(B.nextAt)B.nextAt+=d;
    if(Array.isArray(B.botAt))B.botAt=B.botAt.map(x=>x?x+d:0);
  },
  emoPhase:ph=>ph==='play'||ph==='over'
};

/* ================= 화면 (모든 참가자) ================= */
let ON=false,elTags=null,elBet=null,el2d=null,betAmt=MIN,lastBet=MIN,sentSq=-1;
const BV=()=>V&&V.bj&&V.ps?V.bj:null;
/* 내가 지금 할 일: bet(베팅) | turn(내 차례) | dealer(사람 딜러 차례) | wait */
function myMode(){
  const B=BV(),i=myIdx();if(!B||i<0||V.st!=='play'||!V.ps[i]||V.ps[i].f)return 'none';
  if(B.ph==='bet')return B.od.includes(i)&&!B.bt[i]?'bet':'wait';
  if(B.ph==='turn'&&V.t===i)return 'turn';
  if(B.ph==='dealer'&&B.dl===i&&V.t===i)return 'dealer';
  return 'wait';
}
const busy=()=>{const B=BV();return !!B&&B.sq===sentSq};
const maxBet=()=>{const B=BV(),i=myIdx();return B&&i>=0?Math.floor(B.ch[i]/MIN)*MIN:MIN};
function clampBet(){betAmt=Math.max(MIN,Math.min(maxBet(),Math.round(betAmt/MIN)*MIN||MIN))}
function send(a){sendAct(a);const B=BV();sentSq=B?B.sq:-1;renderButtons()}
function myDouble(){const B=BV(),i=myIdx();return !!B&&i>=0&&myMode()==='turn'&&(B.hc[i]||[]).length===2&&!B.st[i]&&B.ch[i]>=2*B.bt[i]}
function doAct(k){
  const m=myMode();
  if(!myReady()||busy()){if(m!=='none'&&m!=='wait')return;sfx('no');return}
  if(k==='bet'){if(m!=='bet')return;clampBet();lastBet=betAmt;sfxChip(2);send({t:'bet',a:betAmt});return}
  if(k==='double'){if(!myDouble()){sfx('no');return}send({t:'double'});return}
  if(m==='dealer'){const s=score(BV().dc).t;if(k==='stand'&&s<17){sfx('no');return}if(k==='hit'&&s>=21){sfx('no');return}}
  if(m!=='turn'&&m!=='dealer')return;
  send({t:k});
}
function sfxChip(n){for(let k=0;k<(n||1);k++){tone(2600+k*180,.025,{type:'triangle',vol:.07,at:k*.055});tone(3900,.02,{type:'sine',vol:.035,at:k*.055+.012})}}
function setTxt(b,txt){const n=b.firstChild;if(n&&n.nodeType===3){if(n.nodeValue!==txt)n.nodeValue=txt}else b.insertBefore(document.createTextNode(txt),b.firstChild)}
G.buttons=()=>{
  const play=$('#btnPlay'),pass=$('#btnPass'),gb=$('#btnGura'),B=BV(),m=myMode(),rd=myReady()&&!busy();
  const show=(el,on)=>{if(el.hidden===on)el.hidden=!on};
  let main='히트',sub=keyLabel(KEYS.play),pOn=false,sOn=false,dOn=false,sShow=true,dShow=true;
  if(m==='bet'){clampBet();main='베팅';sub=`칩 ${betAmt}개`;pOn=rd;sShow=false;dShow=false}
  else if(m==='turn'){pOn=rd;sOn=rd;dOn=rd&&myDouble()}
  else if(m==='dealer'){const s=score(B.dc).t;pOn=rd&&s<21;sOn=rd&&s>=17;dShow=false}
  else if(B&&myIdx()===B.dl&&B.hd)dShow=false;
  show(pass,sShow);show(gb,dShow);
  setTxt(pass,'스탠드');setTxt(gb,'더블');
  play.disabled=!pOn;play.classList.toggle('ready',pOn);pass.disabled=!sOn;gb.disabled=!dOn;gb.classList.toggle('ready',false);
  if($('#playMain').textContent!==main)$('#playMain').textContent=main;
  if($('#playSub').textContent!==sub)$('#playSub').textContent=sub;
  if(elBet){const on=m==='bet'&&!busy();if(elBet.hidden===on)elBet.hidden=!on;if(on)renderBet()}
};
function renderBet(){
  const v=elBet.querySelector('.bj-amt b'),mx=maxBet(),t=String(betAmt);
  if(v.textContent!==t)v.textContent=t;
  elBet.querySelectorAll('[data-add]').forEach(b=>{const d=+b.dataset.add;b.disabled=betAmt>=mx});
  elBet.querySelector('[data-all]').disabled=betAmt>=mx;
  elBet.querySelector('[data-clr]').disabled=betAmt<=MIN;
}
G.play=()=>{doAct(myMode()==='bet'?'bet':'hit')};
G.pass=()=>{doAct('stand')};
G.keyPhase=st=>st==='play';
G.onKey=(act,e)=>{
  if(act==='gura'){if(!e.repeat)doAct('double');return true}
  if(act==='bjUp'||act==='bjDown'){if(myMode()==='bet'&&!busy()){const b0=betAmt;betAmt+=act==='bjUp'?MIN:-MIN;clampBet();if(betAmt!==b0)sfx('tick');else sfx('no');renderButtons()}return true}
  return false;
};
G.handMarks=()=>{};
G.me=i=>{
  $('#numpick').hidden=true;
  const B=BV(),p=V.ps[i];if(!B||!p)return;
  const ch=B.ch[i];
  if(p.f){if(!p.sr)$('#meSub').innerHTML=V.st==='over'?`<b>${+p.f}위</b> · 칩 <b>${ch}</b>개`:'칩이 떨어졌습니다. 남은 판을 지켜봅니다.';return}
  $('#meSub').innerHTML=`칩 <b>${ch}</b>개${B.bt[i]?` · 베팅 <b>${B.bt[i]}</b>`:''}${B.hd&&B.dl===i?' · 딜러':''}`;
};
G.nameTag=(p,i)=>{const B=V&&V.st!=='wait'?V.bj:null;return B&&B.hd&&B.dl===i?'<span class="bj-dtag">딜러</span>':''};
G.overRank=p=>{const B=V&&V.bj,why=p.sr?(p.sr===2?'시간 초과':p.sr===3?'탈주':'항복'):'';return `<span class="left">${why?why+' · ':''}칩 ${B?B.ch[p.i]:0}개</span>`};
G.preView=()=>{
  const B=BV();if(!B)return;
  if(!PV||!PV.bj||PV.bj.rd!==B.rd){if(B.ph==='bet'){betAmt=lastBet;clampBet()}}   // 새 판: 지난번에 건 만큼
};
G.postView=()=>{};
G.logCue=()=>false;
G.cues=(v,pv)=>{
  const A=v.bj,P=pv.bj;if(!A||!P)return;
  const me=myIdx();
  if(A.rd===P.rd){
    const nb=A.bt.filter((b,i)=>b>(P.bt[i]||0)&&i!==me).length;if(nb)sfxChip(2);
    if(A.dr&&!P.dr)sfx('flick');
    if(me>=0&&A.st[me]===2&&P.st[me]!==2)tone(220,.25,{type:'triangle',vol:.12,slide:110});   // 내 버스트
  }
  if(A.ph==='settle'&&P.ph!=='settle'&&me>=0&&A.rs&&A.od.includes(me)){
    const x=A.rs[me];
    if(x>0)sfx(A.st[me]===3?'finish':'truth');else if(x===0)sfx('pass');else tone(330,.18,{vol:.1,slide:250});
  }
};

/* ---------- 3D: 카드·칩 ---------- */
const R_CARD=2.35,R_CHIP=1.35,R_SEAT=3.6,DEALER_Z=-.45,FROM=[0,1.5,-1.3],DISCARD=[0,.4,-1.5],POT=[0,.35];   // FROM: 카드가 나오는 곳(딜러 자리 위), DISCARD: 다 쓴 카드가 들어가는 곳
const V3={cards:new Map(),chips:new Map(),cg:new Set(),settled:-1,rd:-1,mats:null};
function seatDir(i){const a=seatAngle(i);return {x:Math.sin(a),z:Math.cos(a),a}}
function cardPose(seat,k,n,me){
  if(seat<0){const gap=.44;return {x:(k-(n-1)/2)*gap,y:.02+k*.004,z:DEALER_Z,ry:0,s:.95}}
  const d=seatDir(seat),mine=seat===me,gap=mine?.42:.34,off=(k-(n-1)/2)*gap;
  return {x:d.x*R_CARD+Math.cos(d.a)*off,y:.02+k*.004,z:d.z*R_CARD-Math.sin(d.a)*off,ry:d.a,s:mine?1.05:.85};
}
function chipMats(){
  if(V3.mats)return V3.mats;
  const geo=new THREE.CylinderGeometry(.15,.15,.042,24);
  const list=[{v:500,c:'#6b3fa0'},{v:100,c:'#2b2b2b'},{v:50,c:'#2e7d4f'},{v:10,c:'#cc3a2e'}].map(d=>{
    const side=canvasTex(128,16,(g,w,h)=>{g.fillStyle=d.c;g.fillRect(0,0,w,h);g.fillStyle='#fffaf0';for(let k=0;k<6;k++)g.fillRect(k*w/6+4,0,w/12,h)});
    const top=canvasTex(128,128,(g,w,h)=>{g.fillStyle=d.c;g.beginPath();g.arc(64,64,64,0,7);g.fill();g.strokeStyle='#fffaf0';g.lineWidth=9;g.setLineDash([14,12]);g.beginPath();g.arc(64,64,52,0,7);g.stroke();g.setLineDash([]);g.lineWidth=3;g.beginPath();g.arc(64,64,34,0,7);g.stroke()});
    const sm=toon({map:side,rim:.15}),tm=toon({map:top,rim:0});
    return {v:d.v,m:[sm,tm,tm]};
  });
  return V3.mats={geo,list};
}
function chipStack(amt){
  const M=chipMats(),g=new THREE.Group();let k=0;
  for(const d of M.list){while(amt>=d.v&&k<60){const col=k/12|0,row=k%12;const m=new THREE.Mesh(M.geo,d.m);m.position.set(col*.33,.022+row*.043,0);m.rotation.y=k*.7;m.castShadow=true;g.add(m);amt-=d.v;k++}}
  g.userData={q:[],cur:null};
  T.scene.add(g);V3.cg.add(g);return g;
}
function killGroup(g){if(g.parent)g.parent.remove(g);V3.cg.delete(g)}
function tw(g,x,z,ms,at,die,arc){g.userData.q.push({to:new THREE.Vector3(x,0,z),ms,at,die,arc:arc==null?.35:arc})}
function clear3D(){
  for(const e of V3.cards.values())killCard(e.g);V3.cards.clear();
  for(const g of [...V3.cg])killGroup(g);V3.chips.clear();
  V3.settled=-1;V3.rd=-1;
  if(elTags){elTags.innerHTML='';elTags.dataset.k=''}
}
function sync3(v){
  const B=v.bj;if(!B||!T.ok)return;
  const me=myIdx(),now=clock(),want=new Map();
  const push=(seat,list)=>list.forEach((id,k)=>want.set(B.rd+':'+seat+':'+k,{seat,k,id,n:list.length}));
  B.od.forEach(i=>push(i,B.hc[i]||[]));push(-1,B.dc||[]);
  // 지난 판 카드는 버리는 자리로
  for(const [key,e] of V3.cards){
    if(want.has(key))continue;
    V3.cards.delete(key);
    if(!e.launched){killCard(e.g);continue}
    const u=e.g.userData;u.p.set(DISCARD[0],DISCARD[1],DISCARD[2]);u.rx=Math.PI/2;u.ry=0;u.s=.3;u.die=true;
  }
  // 처음 나누기: 거는 사람 순서대로 한 장씩, 딜러, 한 바퀴 더 (엔진과 같은 순서)
  const dealing=dealingV(),start=dealing?V.dealAt-(+v.dm||0):0,nOrd=B.od.length+1;
  for(const [key,c] of want){
    let e=V3.cards.get(key);
    if(!e){
      const g=makeCard(new THREE.Vector3(FROM[0],FROM[1],FROM[2]),Math.PI/2,0,.4);
      let at=now;
      if(c.k<2&&dealing){const pos=c.seat<0?B.od.length:B.od.indexOf(c.seat);at=start+(c.k*nOrd+Math.max(0,pos))*DEAL_PER}
      g.userData.man=true;g.visible=false;
      e={g,id:null,at,launched:false};V3.cards.set(key,e);
    }
    if(c.id>=0&&e.id!==c.id){e.g.children[0].material=faceMat(c.id);e.id=c.id}
    const P=cardPose(c.seat,c.k,c.n,me),u=e.g.userData;
    u.p.set(P.x,P.y,P.z);u.ry=P.ry;u.s=P.s;
    const peek=c.seat<0&&c.k===1&&!B.dr&&c.id>=0;   // 사람 딜러 본인: 엎은 카드를 살짝 들어 봄
    u.rx=c.id<0?Math.PI/2:peek?-1.05:-Math.PI/2;
    if(peek)u.p.y+=.12;
  }
  // 칩: 건 자리 앞에 쌓고, 정산하면 이긴 만큼 딜러 쪽에서 오고, 진 칩은 딜러 쪽으로
  if(V3.rd!==B.rd){for(const g of [...V3.cg])killGroup(g);V3.chips.clear();V3.rd=B.rd}
  for(let i=0;i<v.ps.length;i++){
    const amt=B.bt[i]||0;let c=V3.chips.get(i);
    if(c&&c.settling)continue;
    if(amt>0&&(!c||c.amt!==amt)){
      const d=seatDir(i),x=d.x*R_CHIP,z=d.z*R_CHIP,g=chipStack(amt);
      if(c){g.position.copy(c.g.position);killGroup(c.g)}
      else{g.position.set(d.x*R_SEAT,0,d.z*R_SEAT);tw(g,x,z,420,now)}
      g.rotation.y=d.a;
      V3.chips.set(i,{g,amt});
    }else if(!amt&&c){killGroup(c.g);V3.chips.delete(i)}
  }
  if(B.ph==='settle'&&B.rs&&V3.settled!==B.rd){
    V3.settled=B.rd;
    for(const [i,c] of V3.chips){
      c.settling=true;const x=B.rs[i]||0,d=seatDir(i),sx=d.x*R_SEAT,sz=d.z*R_SEAT;
      if(x<0){tw(c.g,POT[0],POT[1],600,now+450,true)}
      else{
        if(x>0){const p=chipStack(x),tx=c.g.position.x+Math.cos(d.a)*.42,tz=c.g.position.z-Math.sin(d.a)*.42;p.rotation.y=d.a;p.position.set(POT[0],0,POT[1]);p.visible=false;p.userData.showAt=now+500;tw(p,tx,tz,520,now+500);tw(p,sx+Math.cos(d.a)*.42,sz-Math.sin(d.a)*.42,600,now+1900,true)}
        tw(c.g,sx,sz,600,now+1900,true);
      }
    }
  }
}
function frame3(now){
  for(const e of V3.cards.values())if(!e.launched&&now>=e.at){e.launched=true;e.g.visible=true;e.g.userData.man=false;sfx('flick')}
  for(const g of [...V3.cg]){
    const u=g.userData;
    if(u.showAt&&now>=u.showAt){g.visible=true;u.showAt=0}
    if(!u.cur&&u.q.length&&now>=u.q[0].at){u.cur=u.q.shift();u.cur.from=g.position.clone();u.cur.t0=now}
    if(u.cur){
      const k=smooth((now-u.cur.t0)/u.cur.ms);
      g.position.lerpVectors(u.cur.from,u.cur.to,k);g.position.y=Math.sin(k*Math.PI)*u.cur.arc;
      if(k>=1){const die=u.cur.die;u.cur=null;if(die)killGroup(g)}
    }
  }
}
G.render3D=t=>{if(ON&&V3.cg.size+V3.cards.size)frame3(t);T.r.render(T.scene,T.cam)};
/* 공통 코드가 다른 사람 자리에 카드 더미를 놓는데(손패 표시 1장) 블랙잭은 카드를 앞에 펼치므로 숨김 */
G.field3D=v=>{
  if(T.stacks)for(const arr of T.stacks.values())arr.forEach(c=>{c.visible=false});
  if(v&&v.bj&&(v.st==='play'||v.st==='over'))sync3(v);
};

/* ---------- 합계 표시 (카드 위 작은 표), 이름표의 칩 ---------- */
function handTag(cs,st,dealer,hide){
  const {t,soft}=score(cs);if(!cs.length)return '';
  if(dealer&&hide)return `<b>${t}</b><i>+?</i>`;
  if(st===2||t>21)return `<b class="bust">버스트</b>`;
  if(st===3||(dealer&&isBJ(cs)))return `<b class="bj">블랙잭</b>`;
  return `<b>${soft&&t<21?`${t-10}/${t}`:t}</b>`;
}
const sgn=x=>x>0?`+${x}`:x<0?`−${-x}`:'무승부';
function tagsFrame(){
  const B=BV();if(!elTags)return;
  if(!B||!T.ok||!(V.st==='play'||V.st==='over')){if(elTags.dataset.k){elTags.innerHTML='';elTags.dataset.k=''}return}
  const me=myIdx(),st=$('#stage'),W=st.clientWidth,Hh=st.clientHeight;
  const list=[];
  const hide=B.dc.some(id=>id<0);   // 사람 딜러 본인은 엎은 카드까지 보임
  if(B.dc.length)list.push({k:'d',html:`<span class="who">딜러</span>${handTag(B.dc,0,true,hide)}`,seat:-1,n:B.dc.length});
  B.od.forEach(i=>{const cs=B.hc[i]||[];if(!cs.length)return;
    const r=B.ph==='settle'&&B.rs?`<em class="${B.rs[i]>0?'w':B.rs[i]<0?'l':'p'}">${sgn(B.rs[i])}</em>`:'';
    list.push({k:'s'+i,html:handTag(cs,B.st[i],false)+(B.db[i]?'<i>더블</i>':'')+r,seat:i,n:cs.length,me:i===me})});
  const key=list.map(x=>x.k+x.html).join('|');
  if(elTags.dataset.k!==key){elTags.innerHTML=list.map(x=>`<div class="bj-tag${x.me?' me':''}${x.seat<0?' dl':''}" data-k="${x.k}">${x.html}</div>`).join('');elTags.dataset.k=key}
  // 위치: 그 손의 카드 위쪽 끝(화면에서 가장 위)
  const v3=new THREE.Vector3();
  list.forEach(x=>{
    const el=elTags.querySelector(`[data-k="${x.k}"]`);if(!el)return;
    let top=1e9,cx=0;
    for(let k=0;k<x.n;k++){const P=cardPose(x.seat,k,x.n,me),hw=.31*(T.cardK||1.2)*P.s,hh=.45*(T.cardK||1.2)*P.s,c=Math.cos(P.ry),s=Math.sin(P.ry);
      for(const [a,b] of [[-hw,-hh],[hw,-hh],[-hw,hh],[hw,hh]]){v3.set(P.x+a*c+b*s,P.y,P.z-a*s+b*c).project(T.cam);const y=(1-v3.y)/2*Hh;if(y<top)top=y}
      v3.set(P.x,P.y,P.z).project(T.cam);cx+=(v3.x+1)/2*W}
    cx/=x.n;
    const hw=el.offsetWidth/2;
    el.style.left=Math.max(hw+4,Math.min(W-hw-4,cx))+'px';el.style.top=Math.max(el.offsetHeight/2+4,top)+'px';   // 카드 위쪽 끝에 걸쳐 앉음
  });
}
/* WebGL이 없을 때: 딜러와 모두의 카드를 2D로 */
function render2D(){
  const B=BV();if(!el2d)return;
  const on=!!(B&&!T.ok&&(V.st==='play'||V.st==='over'));
  if(!on){if(!el2d.hidden){el2d.hidden=true;el2d.innerHTML='';el2d.dataset.k=''}return}
  const me=myIdx(),row=(name,cs,tag,cls)=>`<div class="r2${cls||''}"><span class="n2">${name}</span><span class="c2">${cs.map(cardEl).join('')}</span><span class="t2">${tag}</span></div>`;
  let h=row('딜러',B.dc,handTag(B.dc,0,true,B.dc.some(id=>id<0)),' dl');
  B.od.forEach(i=>{const p=V.ps[i];if(!p)return;const r=B.ph==='settle'&&B.rs?` <em class="${B.rs[i]>0?'w':B.rs[i]<0?'l':'p'}">${sgn(B.rs[i])}</em>`:'';h+=row(esc(p.n)+(i===me?' (나)':''),B.hc[i]||[],handTag(B.hc[i]||[],B.st[i],false)+r,i===me?' me':'')});
  if(el2d.dataset.k!==h){el2d.innerHTML=h;el2d.dataset.k=h}
  el2d.hidden=false;
}
G.hud=inGame=>{
  const on=!!(inGame&&BV());
  if(!on){if(ON&&T.ok)clear3D();if(elBet)elBet.hidden=true}
  render2D();
};
G.live=()=>{
  const B=BV();if(!B)return;
  tagsFrame();
  // 이름표: 손패 장수 대신 칩
  document.querySelectorAll('#labels .seat[data-i]').forEach(el=>{const i=+el.dataset.i,ct=el.querySelector('.ct'),p=V.ps[i];if(!ct||!p)return;const t=p.sr?(p.sr===2?'시간 초과':p.sr===3?'탈주':'항복'):`칩 ${B.ch[i]}`;if(ct.textContent!==t)ct.textContent=t});
};
G.enter=()=>{ON=true;$('#stage').classList.add('bj');$('#numpick').hidden=true};
G.leave=()=>{
  ON=false;if(typeof T!=='undefined'&&T.ok)clear3D();
  const st=$('#stage');if(st)st.classList.remove('bj');
  const pass=$('#btnPass'),gb=$('#btnGura');if(pass){setTxt(pass,'패스');pass.hidden=false}if(gb){setTxt(gb,'구라!');gb.hidden=true}
  if(elBet)elBet.hidden=true;if(el2d){el2d.hidden=true;el2d.innerHTML='';el2d.dataset.k=''}if(elTags){elTags.innerHTML='';elTags.dataset.k=''}
  if(typeof T!=='undefined'&&T.stacks)for(const arr of T.stacks.values())arr.forEach(c=>{c.visible=true});
};
G.init=()=>{
  const css=document.createElement('style');
  css.textContent=`
.stage.bj #dim{display:none}
.stage.bj .fan{display:none}
#bjTags{position:absolute;inset:0;pointer-events:none;z-index:4}
.bj-tag{position:absolute;transform:translate(-50%,-50%);display:flex;align-items:baseline;gap:5px;padding:2px 9px 3px;border-radius:99px;background:rgba(255,250,240,.93);border:1.5px solid var(--line-strong);box-shadow:0 2px 5px -2px rgba(59,42,31,.4);white-space:nowrap;font-size:12px;line-height:1.2}
.bj-tag b{font-family:var(--f-num);font-size:15px;font-weight:700;color:var(--ink)}
.bj-tag b.bust{font-family:var(--f-body);font-size:13px;color:var(--gura)}
.bj-tag b.bj{font-family:var(--f-body);font-size:13px;color:#9a5b00}
.bj-tag i{font-style:normal;font-size:11px;font-weight:600;color:var(--muted)}
.bj-tag .who{font-size:11px;font-weight:700;color:var(--muted)}
.bj-tag.me{border-color:var(--mustard-edge)}
.bj-tag em,.r2 em{font-style:normal;font-family:var(--f-num);font-weight:700;font-size:13px}
.bj-tag em.w,.r2 em.w{color:#2c7d47}.bj-tag em.l,.r2 em.l{color:var(--gura)}.bj-tag em.p,.r2 em.p{color:var(--muted);font-family:var(--f-body);font-size:12px}
.bj-dtag{display:inline-block;font-size:10.5px;font-weight:700;line-height:1;padding:3px 6px 2px;border-radius:99px;margin-right:5px;vertical-align:1px;background:#3b2a1f;color:#f4ead9}
#bjBet{position:absolute;left:50%;bottom:calc(var(--plateB,14px) + 62px);transform:translateX(-50%);z-index:8;display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:18px;background:rgba(255,250,240,.94);border:1.5px solid var(--line-strong);box-shadow:0 4px 12px -4px rgba(59,42,31,.45)}
#bjBet[hidden]{display:none}
#bjBet .bj-amt{display:flex;align-items:center;gap:4px;min-width:84px;justify-content:center}
#bjBet .bj-amt b{font-family:var(--f-num);font-size:26px;font-weight:700;color:var(--ink);min-width:58px;text-align:center}
#bjBet .bj-clr{width:30px;height:30px;border-radius:50%;border:1.5px solid var(--line-strong);background:var(--well);color:var(--muted);font-size:13px;font-weight:700;cursor:pointer;padding:0}
#bjBet .bj-chip{--c:#cc3a2e;width:50px;height:50px;border-radius:50%;border:0;background:radial-gradient(circle,var(--c) 0 52%,transparent 53%),repeating-conic-gradient(#fffaf0 0 15deg,var(--c) 15deg 45deg);box-shadow:0 3px 0 rgba(0,0,0,.35),inset 0 0 0 3px var(--c);color:#fffaf0;font-family:var(--f-num);font-weight:700;font-size:14px;cursor:pointer;padding:0;touch-action:manipulation;transition:transform .08s}
#bjBet .bj-chip:active:not(:disabled){transform:translateY(3px);box-shadow:0 0 0 rgba(0,0,0,.35),inset 0 0 0 3px var(--c)}
#bjBet .bj-chip.c50{--c:#2e7d4f}#bjBet .bj-chip.c100{--c:#2b2b2b}
#bjBet .bj-chip.all{--c:#6b3fa0;font-family:var(--f-body);font-size:12px}
#bjBet button:disabled{opacity:.4;cursor:not-allowed}
#bjBet button:focus-visible{outline:3px solid var(--focus);outline-offset:2px}
@media (max-width:480px){
  .stage.bj .myplate{bottom:72px;max-width:calc(100% - 24px)}
  #bjBet{bottom:128px;gap:6px;padding:7px 8px}
  #bjBet .bj-chip{width:44px;height:44px;font-size:13px}
  #bjBet .bj-amt{min-width:72px}#bjBet .bj-amt b{font-size:22px;min-width:48px}
}
#bj2d{position:absolute;left:50%;top:48%;transform:translate(-50%,-50%);z-index:5;display:flex;flex-direction:column;gap:6px;max-width:calc(100% - 20px);max-height:calc(100% - 200px);overflow:auto;pointer-events:none}
#bj2d[hidden]{display:none}
#bj2d .r2{display:grid;grid-template-columns:72px 1fr auto;align-items:center;gap:8px;padding:5px 10px;border-radius:12px;background:#fffaf0;border:1px solid var(--line-strong)}
#bj2d .r2.dl{background:#3b2a1f;color:#f4ead9}#bj2d .r2.me{box-shadow:0 0 0 2px var(--mustard)}
#bj2d .n2{font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#bj2d .c2{display:flex}
#bj2d .card{width:36px;height:52px;transform:none!important;cursor:default}
#bj2d .card+.card{margin-left:-10px}
#bj2d .card .cn{font-size:12px;left:3px;top:1px}#bj2d .card .cn i{font-size:9px}
#bj2d .card .big{font-size:20px;top:20px}#bj2d .card .cn2{display:none}
#bj2d .card.back{background:#cc3a2e;border:2px solid #fffcf5}
#bj2d .t2 b{font-family:var(--f-num)}#bj2d .r2.dl .t2 b{color:#f4ead9}
#bj2d .t2 b.bust{color:var(--gura)}#bj2d .t2 b.bj{color:#c08a17}
`;
  document.head.appendChild(css);
  elTags=document.createElement('div');elTags.id='bjTags';elTags.setAttribute('aria-hidden','true');$('#stage').insertBefore(elTags,$('#fx'));
  el2d=document.createElement('div');el2d.id='bj2d';el2d.hidden=true;el2d.setAttribute('aria-live','polite');$('#stage').insertBefore(el2d,$('#fx'));
  elBet=document.createElement('div');elBet.id='bjBet';elBet.hidden=true;elBet.setAttribute('role','group');elBet.setAttribute('aria-label','베팅');
  elBet.innerHTML=`<button type="button" class="bj-chip" data-add="10" aria-label="10개 더">10</button><button type="button" class="bj-chip c50" data-add="50" aria-label="50개 더">50</button><button type="button" class="bj-chip c100" data-add="100" aria-label="100개 더">100</button><div class="bj-amt"><b aria-live="polite">10</b><button type="button" class="bj-clr" data-clr aria-label="최소로" title="최소로">✕</button></div><button type="button" class="bj-chip all" data-all aria-label="가진 칩 모두">올인</button>`;
  $('#stage').appendChild(elBet);
  elBet.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b||b.disabled||myMode()!=='bet'||busy())return;
    if(b.dataset.add)betAmt+=+b.dataset.add;else if(b.hasAttribute('data-all'))betAmt=maxBet();else if(b.hasAttribute('data-clr'))betAmt=MIN;
    clampBet();sfxChip(1);renderButtons();
  });
  $('#btnGura').addEventListener('click',()=>{if(ON)doAct('double')});
};

(window.GAMES=window.GAMES||{}).blackjack=G;
})();
