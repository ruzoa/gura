/* ===== 블랙잭 게임 모듈 =====
   공통 코드(index.html)가 GAMES.blackjack의 함수를 불러서 이 게임의 규칙·봇·카드·화면을 그림.
   카드 id: 0~51 = 숫자 순번(0~12 = A,2,…,10,J,Q,K)*4 + 무늬(0~3 = ♠ ♥ ♦ ♣). 여러 벌을 한 통(슈)에 섞어 쓰므로 k번째 벌은 52*k를 더한 id(id%52가 그림)
   슈는 판이 바뀌어도 이어 쓰고, 다음 판을 나눌 만큼 남지 않으면 그때 다시 섞음
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
G.rulesHTML='<ol class="rules"><li><b>목표</b> : 모두 같은 수의 칩으로 시작해서, 정한 판 수를 마쳤을 때 칩이 가장 많은 사람이 이깁니다</li><li><b>베팅</b> : 판마다 먼저 칩을 겁니다 (최소 10개). 내 앞의 칩 더미를 누르면 그 칩이 베팅 칸으로 가고, 베팅 칸의 칩을 누르면 돌아옵니다. [베팅]으로 확정합니다</li><li><b>카드</b> : 모두 두 장씩 앞면으로 받고, 딜러는 한 장을 엎어 둡니다. A는 1이나 11, J·Q·K는 10입니다. 카드는 정한 벌 수만큼 한 통에 섞어 판이 바뀌어도 이어 쓰고, 다음 판을 나눌 만큼 남지 않으면 다시 섞습니다</li><li><b>차례</b> : <b>히트</b>는 한 장 더, <b>스탠드</b>는 멈춤, <b>더블</b>은 처음 두 장일 때 건 칩을 두 배로 하고 딱 한 장만 더 받습니다. 21을 넘으면 <b>버스트</b>로 집니다</li><li><b>딜러</b> : 엎은 카드를 펼치고 16 이하면 반드시 더 받습니다. 봇 딜러는 17 이상이면 멈추고, 사람 딜러는 17 이상에서 더 받을지 고릅니다</li><li><b>정산</b> : 딜러보다 21에 가까우면 건 만큼 받고, 처음 두 장이 21(<b>블랙잭</b>)이면 1.5배를 받습니다. 같으면 무승부입니다. 딜러가 A나 10을 보이고 블랙잭이면 바로 정산합니다</li><li><b>사람 딜러</b> : 탁자 설정에서 켜면 참가자가 돌아가며 딜러를 맡아, 진 사람의 칩을 받고 이긴 사람에게 칩을 줍니다 (칩이 모자라면 가진 만큼 나눠 줌). 판 수를 인원의 배수로 하면 모두 같은 횟수만큼 딜러를 맡습니다</li><li><b>탈락</b> : 칩이 10개보다 적어지면 탈락합니다</li><li><b>시간 초과</b> : 베팅은 최소 칩(10개), 차례는 스탠드입니다</li><li>스플릿·인슈어런스는 없습니다</li></ol>';
G.modeDesc=['정한 판 수까지','정한 판 수까지'];
G.noFast=true;
const MIN=10;
G.defaults={chips:100,rounds:8,turn:20,decks:2,hdeal:0};
G.roomSet=[
  {k:'chips',label:'시작 칩',unit:'개',lo:50,hi:1000,step:50,desc:'모두 같은 수의 칩으로 시작합니다'},
  {k:'rounds',label:'판 수',unit:'판',lo:1,hi:30,step:1,desc:'이 판 수를 마치면 칩이 가장 많은 사람이 이깁니다'},
  {k:'turn',label:'제한 시간',unit:'초',lo:5,hi:60,step:5,desc:'시간이 지나면 베팅은 최소 칩, 차례는 스탠드'},
  {k:'decks',label:'카드 벌 수',unit:'벌',lo:1,hi:8,step:1,desc:'이만큼의 카드를 한 통에 섞어 쓰고, 다음 판을 나눌 만큼 남지 않을 때 다시 섞습니다'}];
G.minN=c=>+c.hdeal?2:1;   // 봇 딜러면 혼자서도 시작 (사람 딜러는 2명부터). 공통 코드가 이 인원부터 시작 버튼을 올림
G.ruleSet=[{k:'hdeal',label:'사람 딜러',off:'봇 딜러',desc:'켜면 참가자가 돌아가며 딜러를 맡고, 끄면 봇 딜러가 맡습니다'}];
G.cfgChips=c=>`<span class="chip">시작 칩 <b>${+c.chips}개</b></span><span class="chip"><b>${+c.rounds}판</b></span><span class="chip"><b>${+c.hdeal?'사람 딜러':'봇 딜러'}</b></span><span class="chip">제한 시간 <b>${+c.turn}초</b></span>`;
G.cfgSum=c=>`시작 칩 ${+c.chips}개 · ${+c.rounds}판 · ${+c.hdeal?'사람 딜러':'봇 딜러'} · 카드 ${+c.decks||2}벌 · 제한 시간 ${+c.turn}초`;
G.roomSub=x=>`${x.hd?'사람 딜러':'봇 딜러'} · ${+x.rds||8}판`;
G.pubExtra=c=>({hd:+c.hdeal?1:0,rds:+c.rounds||8});
G.cardInfo=()=>'';
G.rankTitle=()=>'';
G.finLabel=()=>'';
G.noEmotes=[];
G.keys={bjUp:'ArrowUp',bjDown:'ArrowDown'};
G.keyActions=[
  {a:'gura',n:'더블',d:'처음 두 장일 때 건 칩을 두 배로 하고 한 장만 더 받습니다 (구라!와 같은 키)'},
  {a:'bjUp',n:'베팅 늘리기',d:'걸 칩을 10개 늘립니다'},
  {a:'bjDown',n:'베팅 줄이기',d:'걸 칩을 10개 줄입니다'}];

/* ---------- 방장 엔진 ---------- */
const DEAL_PER=260;   // 처음 나눌 때 카드 한 장 간격 (ms)
const REVEAL_MS=900,DRAW_MS=850,SETTLE_MS=3600,SHUF_MS=1600;
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
/* 슈: 정한 벌 수를 섞음. 탁자 위에 나와 있는 카드는 빼고 섞음(판 도중에 다 떨어졌을 때) */
const HILO=id=>{const v=valOf(id);return v<=6?1:v>=10?-1:0};   // 카드 세기 (어려움 봇이 씀)
function newShoe(){
  const B=H.bj,on=new Set([...B.dc,...B.hc.flat()]);
  B.shoe=shuffle([...Array(52*B.dk).keys()].filter(x=>!on.has(x)));B.disc=0;B.rc=0;B.sf=(B.sf||0)+1;
}
function draw(){
  const B=H.bj;
  if(!B.shoe.length){newShoe();addLog('카드가 떨어져 다시 섞습니다.','sys')}   // 판 도중 (아주 드묾)
  return B.shoe.pop();
}
const needCards=()=>(H.bj.order.length+1)*5;   // 한 판에 넉넉히 쓰는 장수
function newRound(){
  const B=H.bj,n=H.players.length,t=clock();
  B.rd++;
  if(B.hd){   // 사람 딜러: 남은 사람 중 지난 딜러 다음 자리
    let d=-1;for(let k=1;k<=n;k++){const j=((B.dl<0?-1:B.dl)+k+n)%n;if(alive(j)){d=j;break}}
    B.dl=d;
  }
  B.order=seatOrder();
  B.disc+=B.dc.length+B.hc.reduce((a,h)=>a+h.length,0);   // 지난 판 카드는 버린 더미로
  Object.assign(B,{bt:Array(n).fill(0),hc:Array.from({length:n},()=>[]),st:Array(n).fill(0),db:Array(n).fill(0),rs:null,dc:[],dr:0,ph:'bet',nextAt:0,auto:false,stop:false,shufRd:0,botAt:Array(n).fill(0)});
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
  B.bt[i]=a;B.sq++;
  if(B.order.every(j=>!alive(j)||B.bt[j]))startDeal();
  else{H.turn=firstUnbet();mark()}
  return true;
}
function startDeal(){
  const B=H.bj;
  B.order=B.order.filter(i=>alive(i)&&B.bt[i]>0);
  if(!B.order.length){endRound();return}
  let sh=0;if(B.shoe.length<needCards()){newShoe();B.shufRd=B.rd;sh=SHUF_MS;addLog('카드를 다시 섞습니다.','sys')}   // 다음 판을 나눌 만큼 남지 않았을 때만
  for(let r=0;r<2;r++){for(const i of B.order)B.hc[i].push(draw());B.dc.push(draw())}
  B.ph='deal';H.turn=-1;H.botActAt=0;B.nextAt=0;B.sq++;
  beginDeal(sh+2*(B.order.length+1)*DEAL_PER+500);   // 섞고 나누는 동안 제한 시간·봇·행동을 멈춤 (화면은 카드가 한 장씩 날아감)
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
  const B=H.bj;B.bt[i]*=2;B.db[i]=1;
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
  for(const id of [...B.dc,...B.hc.flat()])B.rc+=HILO(id);   // 모두 펼쳐진 카드로 세기
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
    const tc=B.rc/Math.max(.5,B.shoe.length/52);   // 남은 카드 한 벌당 세기: 높을수록 10·A가 많이 남음
    a=Math.round(c*.05*(tc>=2?Math.min(4,tc):1)/MIN)*MIN;
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
G._test={score,isBJ,basic,newShoe,needCards,newRound,placeBet,startDeal,afterDeal,doHit,doStand,doDouble,settle,endRound,dealerHit,dealerStand,canDouble,MIN};
G.engine={
  start(){
    const n=H.players.length;
    H.players.forEach(p=>{p.hand=[0];p.broke=false});
    Object.assign(H,{phase:'play',log:[],seatNote:{},turn:-1,rankNext:1,rankBottom:n,graceUntil:0,botActAt:0,deadline:0});
    H.bj={rd:0,rds:Math.max(1,+H.cfg.rounds||8),hd:!!+H.cfg.hdeal,dl:-1,ch:Array(n).fill(Math.max(MIN,+H.cfg.chips||100)),sq:0,order:[],bt:[],hc:[],st:[],db:[],dc:[],dr:0,rs:null,ph:'bet',dk:Math.max(1,Math.min(8,+H.cfg.decks||2)),shoe:[],disc:0,rc:0,sf:0,shufRd:0,botAt:[]};
    newShoe();
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
        late.forEach(i=>{B.bt[i]=MIN});
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
      if(t>=H.deadline){addLog(`${p.name} 시간 초과 · 스탠드`,'sys');doStand(i)}
      else if(H.botActAt&&t>=H.botActAt&&canBot(p,t))botPlay(i);
    }else if(B.ph==='dealer')dealerTick(t);
    else if(B.ph==='settle'&&t>=B.nextAt)endRound();
  },
  snap(s,you,t){
    const B=H.bj;if(!B)return;
    s.gr=0;s.dl=Math.max(0,Math.round(H.deadline-t));
    const dc=B.dc.slice();if(!B.dr&&!(B.hd&&you>=0&&you===B.dl)&&dc.length>1)dc[1]=-1;   // 엎은 카드는 사람 딜러 본인만 봄
    s.bj={ph:B.ph,rd:B.rd,rds:B.rds,hd:B.hd?1:0,dl:B.dl,ch:B.ch.slice(),bt:B.bt.slice(),hc:B.hc.map(h=>h.slice()),st:B.st.slice(),db:B.db.slice(),dc,dr:B.dr,rs:B.rs?B.rs.slice():null,od:B.order.slice(),sq:B.sq,sh:B.shoe.length,ds:B.disc,tot:52*B.dk,sf:B.sf,sr:B.shufRd===B.rd?1:0};
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

/* ================= 화면 (모든 참가자) =================
   탁자는 둥근 그대로 두고 펠트에 블랙잭 무늬를 덮어 그림: 딜러는 맞은편, 거는 사람의 자리는 딜러를 둘러싼 부채꼴(가운데가 나, 폭은 화면과 상관없이 고정).
   합계는 카드 위가 아니라 베팅 칸 아래 작은 표(나는 내 정보 칸)
   베팅: 내 앞의 칩 더미(10·50·100·500)의 맨 위 칩을 누르면 한 개가 베팅할 칩 공간으로 날아가고, 그 공간을 누르면 마지막에 올린 칩이 돌아옴 → [베팅]으로 확정하면 베팅한 칩 공간(베팅 칸)으로 옮겨져 누를 수 없음 */
let ON=false,elTags=null,elBet=null,el2d=null,sentSq=-1,pend=[];
const BV=()=>V&&V.bj&&V.ps?V.bj:null;
const DEN=[10,50,100,500],DEN_C=['#cc3a2e','#2e7d4f','#2b2b2b','#6b3fa0'];
const sum=a=>a.reduce((x,y)=>x+y,0);
const betAmt=()=>sum(pend);
/* 내가 지금 할 일: bet(베팅) | turn(내 차례) | dealer(사람 딜러 차례) | wait */
function myMode(){
  const B=BV(),i=myIdx();if(!B||i<0||V.st!=='play'||!V.ps[i]||V.ps[i].f)return 'none';
  if(B.ph==='bet')return B.od.includes(i)&&!B.bt[i]?'bet':'wait';
  if(B.ph==='turn'&&V.t===i)return 'turn';
  if(B.ph==='dealer'&&B.dl===i&&V.t===i)return 'dealer';
  return 'wait';
}
const busy=()=>{const B=BV();return !!B&&B.sq===sentSq};
const myChips=()=>{const B=BV(),i=myIdx();return B&&i>=0?B.ch[i]:0};
function send(a){sendAct(a);const B=BV();sentSq=B?B.sq:-1;renderButtons()}
function myDouble(){const B=BV(),i=myIdx();return !!B&&i>=0&&myMode()==='turn'&&(B.hc[i]||[]).length===2&&!B.st[i]&&B.ch[i]>=2*B.bt[i]}
const canBetNow=()=>myMode()==='bet'&&!busy()&&!dealingV();
/* 칩 올리기·내리기 (확정 전, 내 화면에서만) */
function addChip(d){
  if(!canBetNow())return;
  if(betAmt()+d>myChips()){sfx('no');return}
  pend.push(d);sfxChip(1);if(ON&&T.ok)flyMine(d,true);renderMe();
}
function takeChip(){
  if(!canBetNow())return;
  if(!pend.length){sfx('no');return}
  const d=pend.pop();sfxChip(1);if(ON&&T.ok)flyMine(d,false);renderMe();
}
function doAct(k){
  const m=myMode();
  if(!myReady()||busy()){if(m!=='none'&&m!=='wait')return;sfx('no');return}
  if(k==='bet'){if(m!=='bet')return;const a=betAmt();if(a<MIN){sfx('no');return}send({t:'bet',a});return}
  if(k==='double'){if(!myDouble()){sfx('no');return}sfxChip(2);send({t:'double'});return}
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
  if(m==='bet'){const a=betAmt();main='베팅';if(a)sub=`칩 ${a}개`;pOn=rd&&a>=MIN;sShow=false;dShow=false}
  else if(m==='turn'){pOn=rd;sOn=rd;dOn=rd&&myDouble()}
  else if(m==='dealer'){const s=score(B.dc).t;pOn=rd&&s<21;sOn=rd&&s>=17;dShow=false}
  else if(B&&myIdx()===B.dl&&B.hd)dShow=false;
  show(pass,sShow);show(gb,dShow);
  setTxt(pass,'스탠드');setTxt(gb,'더블');
  play.disabled=!pOn;play.classList.toggle('ready',pOn);pass.disabled=!sOn;gb.disabled=!dOn;gb.classList.toggle('ready',false);
  if($('#playMain').textContent!==main)$('#playMain').textContent=main;
  if($('#playSub').textContent!==sub)$('#playSub').textContent=sub;
  if(elBet){const on=!T.ok&&m==='bet'&&!busy();if(elBet.hidden===on)elBet.hidden=!on;if(on)renderBet()}
};
/* WebGL이 없을 때만 쓰는 2D 칩 버튼 */
function renderBet(){
  const v=elBet.querySelector('.bj-amt b'),a=betAmt(),mx=myChips(),t=String(a);
  if(v.textContent!==t)v.textContent=t;
  elBet.querySelectorAll('[data-add]').forEach(b=>{b.disabled=a+(+b.dataset.add)>mx});
  elBet.querySelector('[data-all]').disabled=a>=Math.floor(mx/MIN)*MIN;
  elBet.querySelector('[data-clr]').disabled=!a;
}
G.play=()=>{doAct(myMode()==='bet'?'bet':'hit')};
G.pass=()=>{doAct('stand')};
G.keyPhase=st=>st==='play';
G.onKey=(act,e)=>{
  if(act==='gura'){if(!e.repeat)doAct('double');return true}
  if(act==='bjUp'){addChip(MIN);return true}
  if(act==='bjDown'){takeChip();return true}
  return false;
};
G.handMarks=()=>{};
const sgn=x=>x>0?`+${x}`:x<0?`−${-x}`:'무승부';
/* 합계 글자: 소프트는 7/17, 엎은 카드가 있으면 4 +? */
function totalHTML(cs,st,dealer){
  if(!cs.length)return '';
  const hide=cs.some(id=>id<0),{t,soft}=score(cs);
  if(dealer&&hide)return `<b>${t}</b><i>+?</i>`;
  if(st===2||t>21)return '<b class="bust">버스트</b>';
  if(st===3||(dealer&&isBJ(cs)))return '<b class="bj">블랙잭</b>';
  return `<b>${soft&&t<21?`${t-10}/${t}`:t}</b>`;
}
G.me=()=>{$('#numpick').hidden=true};
G.nameTag=(p,i)=>{const B=V&&V.st!=='wait'?V.bj:null;return B&&B.hd&&B.dl===i?'<span class="bj-dtag">딜러</span>':''};
G.overRank=p=>{const B=V&&V.bj,why=p.sr?(p.sr===2?'시간 초과':p.sr===3?'탈주':'항복'):'';return `<span class="left">${why?why+' · ':''}칩 ${B?B.ch[p.i]:0}개</span>`};
G.preView=()=>{
  const B=BV(),i=myIdx();if(!B)return;
  const fresh=!PV||!PV.bj||PV.bj.rd!==B.rd;
  if(fresh||B.ph!=='bet'||(i>=0&&B.bt[i]))pend=[];   // 새 판이거나 이미 걸었으면 비움
  if(fresh&&PV&&B.ph==='bet'&&V.st==='play')setTimeout(()=>{if(BV()&&BV().rd===B.rd)roundStart(B)},0);   // 판 번호·칩 더미 튀기 (첫 판은 카드 나누기 대신 바로)
};
G.postView=()=>{};
G.logCue=txt=>{if(txt.includes('섞습니다')){sfx('riffle');setTimeout(()=>sfx('square'),700);return true}return false};
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

/* ---------- 탁자 배치 (월드 좌표, 나는 +z 쪽) ----------
   기본은 딜러가 맞은편, 거는 사람은 딜러를 둘러싼 부채꼴(나는 가운데).
   내가 사람 딜러인 판은 앞뒤를 뒤집어(FL=-1) 딜러 카드·칩·카드 통이 내 앞, 손님 부채꼴이 맞은편 (카메라는 그대로) */
const C0={x:0,z:-2.0};                 // 부채꼴의 중심 (딜러 쪽)
const R_HAND=2.75,R_BET=3.45,R_PILL=3.86,HALF=40*Math.PI/180,STEP=22*Math.PI/180;
const DEALER_Z=-2.0,SHOE={x:1.9,z:-2.2},DISC={x:-1.9,z:-2.2},TRAY={x:0,z:-2.75};
const BANK_Z=3.45,BANK_X=[-.75,-.25,.25,.75],CHIP_R=.2,CHIP_H=.052;   // 내 칩 더미는 펠트 밖 나무 띠(포커와 같은 자리): 칩 기둥이 높아도 화면에서 베팅할 칩 공간을 가리지 않게
const PEND_Z=2.25;                     // 베팅할 칩 공간(내 칩 더미와 베팅한 칩 공간 사이). 걸기 전 칩만 올라가고, 건 뒤에는 베팅한 칩 공간(betPos)으로 옮겨져 누를 수 없음
const pendPos=()=>M({x:0,z:PEND_Z});
const CW=.62*1.2,CH=.9*1.2;            // 카드 폭·높이 (크기 1일 때)
const S_ME=.8,S_DL=.8,S_OT=.65;        // 카드 크기: 나·딜러·다른 사람
let FL=1;
const M=p=>({x:p.x,z:p.z*FL});
/* 카드 통·버린 더미: 내가 딜러면 내 앞이라 원근으로 커지므로 안쪽으로 당김(휴대폰에서 잘리지 않게) */
const shoeAt=p=>FL<0?{x:Math.sign(p.x)*1.4,z:-1.85}:p;
const wrapA=a=>{while(a>Math.PI)a-=2*Math.PI;while(a<=-Math.PI)a+=2*Math.PI;return a};
const atC=(a,r)=>({x:C0.x+Math.sin(a)*r,z:C0.z+Math.cos(a)*r});   // 뒤집기 전
const atA=(a,r)=>M(atC(a,r));
/* 자리마다 부채꼴의 각도: 나는 가운데, 다른 사람은 탁자에서 앉은 쪽(왼쪽·오른쪽) 순서대로 */
function spotAngles(od){
  const me=myIdx(),out=new Map();
  const rest=od.filter(i=>i!==me).map(i=>({i,v:wrapA(seatAngle(i))}));
  if(od.includes(me)){
    out.set(me,0);
    const L=rest.filter(x=>x.v<0).sort((a,b)=>b.v-a.v),R=rest.filter(x=>x.v>0&&x.v<Math.PI-1e-6).sort((a,b)=>a.v-b.v);
    rest.filter(x=>x.v>=Math.PI-1e-6).forEach(x=>(L.length<R.length?L:R).push(x));   // 맞은편은 적은 쪽으로
    L.forEach((x,k)=>out.set(x.i,-(k+1)*STEP_E));R.forEach((x,k)=>out.set(x.i,(k+1)*STEP_E));
  }else{
    rest.sort((a,b)=>a.v-b.v);const n=rest.length,st=Math.min(STEP,2*HALF_E/Math.max(1,n-1));
    rest.forEach((x,k)=>out.set(x.i,(k-(n-1)/2)*st));
  }
  return out;
}
/* 부채꼴 반각은 화면 비율과 상관없이 고정: 어느 화면에서나 같은 자리에 앉은 것처럼. 좁은 화면은 양옆 자리가 잘리고 이름표는 화면 끝에 붙음(seatTags) */
const HALF_E=HALF;let STEP_E=STEP;
let SPOTS=new Map(),spotKey='',SC={me:S_ME,ot:S_OT};
function layout(B){
  const me=myIdx();FL=B.hd&&me>=0&&B.dl===me?-1:1;
  const key=B.od.join(',')+'|'+me+'|'+FL+'|'+V.ps.length;   // 화면 크기는 배치에 쓰지 않음
  if(key!==spotKey){
    spotKey=key;
    const rest=B.od.filter(i=>i!==me),side=B.od.includes(me)?Math.max(1,...[-1,1].map(sg=>rest.filter(i=>{const v=wrapA(seatAngle(i));return sg<0?v<0:v>0}).length)):1;
    STEP_E=Math.min(STEP,HALF_E/Math.max(1,side));
    SPOTS=spotAngles(B.od);
    // 카드 크기는 고정(나 0.8·다른 사람 0.65), 자리가 좁을 때만 이웃 손과 안 겹치게 줄임 (손 폭 ≈ 카드 1.45장)
    const sp=(B.od.includes(me)?STEP_E:Math.min(STEP,2*HALF_E/Math.max(1,B.od.length-1)))*R_HAND,u=CW*1.45;
    SC.ot=Math.min(S_OT,Math.max(.42,sp/u*.95));SC.me=Math.min(S_ME,Math.max(SC.ot,2*sp/u*.95-SC.ot));
    V3.ringsKey='';
  }
  return SPOTS;
}
/* 카드 자리: 옆으로 겹쳐 왼쪽 위 숫자가 보이게(카드가 늘면 더 겹침). 딜러는 가운데 한 줄 */
function cardPose(seat,k,n){
  const fan=s=>n>1?CW*s*Math.min(.42,1.05/(n-1)):0;
  if(seat<0){const g=fan(S_DL),c=M({x:(k-(n-1)/2)*g,z:DEALER_Z});return {x:c.x,y:.02+k*.004,z:c.z,ry:0,s:S_DL}}
  const a=SPOTS.get(seat)||0,s=seat===myIdx()?SC.me:SC.ot,g=fan(s);
  const c=atC(a,R_HAND),o=(k-(n-1)/2)*g,p=M({x:c.x+Math.cos(a)*o,z:c.z-Math.sin(a)*o});
  return {x:p.x,y:.02+k*.004,z:p.z,ry:a*FL,s};
}
const betPos=i=>atA(SPOTS.get(i)||0,R_BET);

/* ---------- 3D ---------- */
const V3={toBet:0,toBank:0,pend:null,cards:new Map(),flights:[],piles:new Map(),bank:null,dstack:null,ringsKey:'',rings:[],myRing:null,betArc:null,arcQ:-1,root:null,rootFL:0,shoe:null,disc:null,sf:-1,rd:-1,settled:-1,landed:new Set(),felt:{},mats:null,bounceAt:-1e9};
function chipMats(){
  if(V3.mats)return V3.mats;
  const geo=new THREE.CylinderGeometry(CHIP_R,CHIP_R,CHIP_H,28);
  const list=DEN.map((v,k)=>{
    const c=DEN_C[k];
    const side=canvasTex(128,16,(g,w,h)=>{g.fillStyle=c;g.fillRect(0,0,w,h);g.fillStyle='#fffaf0';for(let j=0;j<6;j++)g.fillRect(j*w/6+4,0,w/12,h)});
    const top=canvasTex(128,128,(g,w,h)=>{g.fillStyle=c;g.beginPath();g.arc(64,64,64,0,7);g.fill();g.strokeStyle='#fffaf0';g.lineWidth=10;g.setLineDash([16,12]);g.beginPath();g.arc(64,64,54,0,7);g.stroke();g.setLineDash([]);g.lineWidth=3;g.beginPath();g.arc(64,64,36,0,7);g.stroke();g.fillStyle='#fffaf0';g.font='bold 34px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(String(v),64,66)});
    return [toon({map:side,rim:.15}),toon({map:top,rim:0}),toon({map:top,rim:0})];
  });
  return V3.mats={geo,list};
}
const chipMesh=d=>{const M=chipMats(),m=new THREE.Mesh(M.geo,M.list[DEN.indexOf(d)]);m.castShadow=true;return m};
/* 금액 → 칩 (큰 칩부터). 칩 더미는 거스름돈처럼 작은 칩도 남겨 둠(누를 수 있게) */
function greedy(a){const o=[];for(let k=DEN.length-1;k>=0;k--){while(a>=DEN[k]){o.push(DEN[k]);a-=DEN[k]}}return o}
function change(a){
  const n=[0,0,0,0];let r=Math.floor(a/MIN)*MIN;
  n[0]=(r%50)/10;r-=n[0]*10;if(r>=50&&n[0]<5){n[0]+=5;r-=50}
  n[1]=(r%100)/50;r-=n[1]*50;if(r>=100&&n[1]<2){n[1]+=2;r-=100}
  n[2]=(r%500)/100;r-=n[2]*100;if(r>=500&&n[2]<5){n[2]+=5;r-=500}
  n[3]=r/500;return n;
}
/* 섞인 칩 한 기둥 (베팅) */
function pileGroup(amt){
  const g=new THREE.Group(),cs=greedy(amt);
  cs.forEach((d,k)=>{const m=chipMesh(d),col=k/14|0,row=k%14;m.position.set(col*.44,CHIP_H/2+row*CHIP_H,0);m.rotation.y=k*.9;g.add(m)});
  g.userData.n=cs.length;T.scene.add(g);return g;
}
/* 종류별로 세운 칩 기둥 4개 (많으면 한 줄 더): 내 칩 더미(내 앞), 딜러 칩(딜러 뒤) */
function stackGroup(amt,cz,back){
  const g=new THREE.Group(),n=change(amt);
  n.forEach((c,k)=>{for(let j=0;j<Math.min(c,40);j++){const m=chipMesh(DEN[k]),col=j/12|0,row=j%12,p=M({x:BANK_X[k],z:cz+back*col*.44});m.position.set(p.x,CHIP_H/2+row*CHIP_H,p.z);m.rotation.y=j*.7;g.add(m)}});
  g.userData.n=n;T.scene.add(g);return g;
}
const topY=(n)=>Math.min(n,14)*CHIP_H+.02;
function killG(g){if(g&&g.parent)g.parent.remove(g)}
/* 날아가는 칩·칩 더미 */
function fly(obj,from,to,ms,at,arc,done){obj.position.set(from.x,from.y,from.z);obj.visible=false;V3.flights.push({obj,from,to,ms,at,arc,done})}
function setPile(i,amt,pos){
  let P=V3.piles.get(i);
  if(P&&P.amt===amt&&P.g)return P;
  if(P)killG(P.g);
  P={amt,g:amt>0?pileGroup(amt):null,pos};
  if(P.g)P.g.position.set(pos.x,0,pos.z);
  V3.piles.set(i,P);return P;
}
/* 내 칩 하나가 더미 ↔ 베팅할 칩 공간으로. 떠나는 쪽은 바로 빼고, 받는 쪽은 도착하면 채움(잔상 없음) */
function flyMine(d,toBet){
  const bp=pendPos(),k=DEN.indexOf(d),bn=(V3.bank&&V3.bank.userData.n[k])||0;
  const bank={x:BANK_X[k],y:topY(Math.min(12,bn+(toBet?1:0))),z:BANK_Z};
  const P=V3.pend,pn=P&&P.g?P.g.userData.n:0,pile={x:bp.x,y:topY(pn+(toBet?0:1)),z:bp.z};
  if(toBet)V3.toBet+=d;else V3.toBank+=d;
  const m=chipMesh(d);T.scene.add(m);
  fly(m,toBet?bank:pile,toBet?pile:bank,230,clock(),.32,()=>{killG(m);if(toBet)V3.toBet=Math.max(0,V3.toBet-d);else V3.toBank=Math.max(0,V3.toBank-d);syncChips()});
  syncChips();
}
/* 칩 더미·베팅 기둥을 지금 상태에 맞춤 */
function bankAmt(B,me){
  let a=B.ch[me]-(B.bt[me]||0)-(B.ph==='bet'&&!B.bt[me]?betAmt():0)-V3.toBank;
  if(B.ph==='settle'&&B.rs&&B.od.includes(me)&&!V3.landed.has(me))a=B.ch[me]-B.rs[me]-(B.bt[me]||0);   // 정산 칩이 도착하기 전
  return Math.max(0,a);
}
function syncChips(){
  const B=BV();if(!B||!T.ok)return;
  const me=myIdx(),meDl=B.hd&&B.dl===me;
  if(me>=0&&!V.ps[me].f&&!meDl){
    const a=bankAmt(B,me),key=change(a).join(',');
    if(!V3.bank||V3.bank.userData.key!==key){killG(V3.bank);V3.bank=stackGroup(a,BANK_Z,1);V3.bank.userData.key=key}
  }else if(V3.bank){killG(V3.bank);V3.bank=null}
  // 딜러 칩: 사람 딜러면 그 사람이 가진 칩, 봇 딜러는 넉넉히
  {const a=B.hd&&B.dl>=0?B.ch[B.dl]:2400,key=FL+':'+change(a).join(',');
   if(!V3.dstack||V3.dstack.userData.key!==key){killG(V3.dstack);V3.dstack=stackGroup(a,TRAY.z,-1);V3.dstack.userData.key=key}}
  if(B.ph==='settle')return;
  // 베팅할 칩 공간: 걸기 전 내 칩만. 건 뒤에는 이 칩이 그대로 베팅한 칩 공간으로 날아가 자리 잡음(그 뒤에는 누를 수 없음)
  if(me>=0&&B.od.includes(me)&&!meDl&&SPOTS.has(me)){
    const placed=B.bt[me]||0;
    if(placed>0&&V3.pend&&V3.pend.g&&!V3.piles.get(me)){
      const pp=pendPos(),g=V3.pend.g,a=V3.pend.amt;V3.pend=null;
      if(a+V3.toBet===placed){   // 올려 둔 그대로 걸림: 그 칩이 베팅한 칩 공간으로
        const bp=betPos(me),NP={amt:a,g,pos:bp,flying:true};V3.piles.set(me,NP);
        fly(g,{x:pp.x,y:0,z:pp.z},{x:bp.x,y:0,z:bp.z},320,clock(),.35,()=>{NP.flying=false;V3.ringsKey=''});
      }else{   // 다르게 걸림(시간 초과로 최소 칩 등): 올려 둔 칩은 칩 더미로 돌아가고, 건 칩은 칩 더미에서 따로 날아감(아래)
        V3.toBank+=a;fly(g,{x:pp.x,y:0,z:pp.z},{x:0,y:.3,z:BANK_Z},300,clock(),.3,()=>{killG(g);V3.toBank=Math.max(0,V3.toBank-a);syncChips()});
      }
    }
    const want=B.ph==='bet'&&!placed?Math.max(0,betAmt()-V3.toBet):0,Q=V3.pend;
    if(want>0){
      if(!Q||Q.amt!==want){if(Q)killG(Q.g);const pp=pendPos(),g=pileGroup(want);g.position.set(pp.x,0,pp.z);V3.pend={amt:want,g}}
    }else if(Q){killG(Q.g);V3.pend=null}
  }else if(V3.pend){killG(V3.pend.g);V3.pend=null}
  for(const i of B.od){
    if(!SPOTS.has(i))continue;
    const amt=B.bt[i]||0;
    const P=V3.piles.get(i);
    if(amt>(P?P.amt:0)&&!(P&&P.flying)&&(i!==me||!P)){   // 걸면 그 사람 자리(나는 내 칩 더미)에서 날아옴
      const bp=betPos(i),g=pileGroup(amt),sp=i===me?{x:0,z:BANK_Z}:seatPos(i,4.3);if(P)killG(P.g);
      const NP={amt,g,pos:bp,flying:true};V3.piles.set(i,NP);
      fly(g,{x:sp.x,y:.3,z:sp.z},{x:bp.x,y:0,z:bp.z},420,clock(),.45,()=>{NP.flying=false;V3.ringsKey=''});
      continue;
    }
    if(P&&P.flying)continue;
    setPile(i,amt,betPos(i));
  }
  for(const [i,P] of V3.piles)if(!B.od.includes(i)){killG(P.g);V3.piles.delete(i)}
}
/* 정산: 진 칩은 딜러 칩 쪽으로, 이긴 만큼 딜러 쪽에서 오고, 그다음 모두 주인에게 */
function settleFly(B){
  const now=clock(),me=myIdx(),t0=M(TRAY),tray={x:t0.x,y:.25,z:t0.z};
  for(const i of B.od){
    const P=V3.piles.get(i),x=B.rs[i]||0,a=(SPOTS.get(i)||0)*FL;
    const home=i===me?{x:0,y:.3,z:BANK_Z}:(()=>{const sp=seatPos(i,4.3);return {x:sp.x,y:.3,z:sp.z}})();
    const land=()=>{V3.landed.add(i);if(i===me){syncChips();renderMe()}};
    if(!P||!P.g){land();continue}
    const bp={x:P.g.position.x,y:0,z:P.g.position.z};
    if(x<0){fly(P.g,bp,tray,520,now+450,.35,()=>{killG(P.g);land()});P.g.visible=true;continue}
    if(x>0){
      const g=pileGroup(x),side={x:bp.x+Math.cos(a)*.46,y:0,z:bp.z-Math.sin(a)*.46};
      fly(g,tray,side,520,now+450,.4,null);
      V3.flights.push({obj:g,from:side,to:home,ms:560,at:now+1700,arc:.35,done:()=>killG(g)});
    }
    V3.flights.push({obj:P.g,from:bp,to:home,ms:560,at:now+1700,arc:.35,done:()=>{killG(P.g);land()}});
  }
}
function frameFlights(now){
  for(const f of [...V3.flights]){
    if(now<f.at)continue;
    const k=smooth((now-f.at)/f.ms);f.obj.visible=true;
    f.obj.position.set(f.from.x+(f.to.x-f.from.x)*k,f.from.y+(f.to.y-f.from.y)*k+Math.sin(k*Math.PI)*f.arc,f.from.z+(f.to.z-f.from.z)*k);
    if(k>=1){V3.flights.splice(V3.flights.indexOf(f),1);if(f.done)f.done()}
  }
}
/* ---------- 카드 움직임: 직접 그림 ----------
   공통 코드의 미끄러지기는 카드를 가로축으로 뒤집어 중간에 카드가 서면서 펠트를 뚫음 →
   날아가는 동안 위로 뜨는 곡선, 뒤집기는 카드의 긴 축으로 넘기고 뒤집히는 만큼 떠 있게 */
const _qa=window.THREE?new THREE.Quaternion():null,_qb=window.THREE?new THREE.Quaternion():null,_ax=window.THREE?{x:new THREE.Vector3(1,0,0),y:new THREE.Vector3(0,1,0)}:null;
function cardSet(e,to,ms,lift){
  const T0=e.to;if(T0&&['x','y','z','ry','s','f','tl'].every(k=>Math.abs(T0[k]-to[k])<1e-4)&&!to.die)return;
  e.to=to;if(!e.launched)return;
  e.tw={from:{...e.cur},to,t0:clock(),ms,lift};
}
function cardApply(e){
  const c=e.cur,g=e.g,ph=(1-c.f)*Math.PI;
  g.position.set(c.x,c.y,c.z);g.scale.setScalar(c.s);
  _qa.setFromAxisAngle(_ax.y,c.ry);_qb.setFromAxisAngle(_ax.x,-Math.PI/2+c.tl);_qa.multiply(_qb);_qb.setFromAxisAngle(_ax.y,ph);_qa.multiply(_qb);
  g.quaternion.copy(_qa);
}
function cardStep(e,now){
  const w=e.tw;if(!w)return;
  const k=clamp01((now-w.t0)/w.ms),q=smooth(k),A=w.from,Bt=w.to,c=e.cur;
  for(const key of ['x','z','s','tl'])c[key]=A[key]+(Bt[key]-A[key])*q;
  c.ry=A.ry+wrapA(Bt.ry-A.ry)*q;c.f=A.f+(Bt.f-A.f)*smooth((k-.15)/.7);
  const ph=(1-c.f)*Math.PI,guard=Math.abs(Math.sin(ph))*CW*c.s*.5+Math.abs(Math.sin(c.tl))*CH*c.s*.5+.02;
  c.y=Math.max(A.y+(Bt.y-A.y)*q+Math.sin(k*Math.PI)*w.lift,guard);
  cardApply(e);
  if(k>=1){e.tw=null;if(Bt.die){killCard(e.g);V3.cards.delete(e.key)}}
}
/* ---------- 펠트 무늬·딜러 쪽 물건 ---------- */
function feltTex(){
  if(V3.felt[FL])return V3.felt[FL];
  const W=1024,R=3.15,k=W/(2*R);
  return V3.felt[FL]=canvasTex(W,W,(g,w,h)=>{
    const gr=g.createRadialGradient(w/2,h/2,80,w/2,h/2,w/2);gr.addColorStop(0,'#5aa877');gr.addColorStop(1,'#3a8257');g.fillStyle=gr;g.fillRect(0,0,w,h);
    // 월드 좌표(x, z)로 그림: 원통 윗면 UV는 u←z, v←x. 글자는 넣지 않고 딜러 쪽 금색 두 줄 선만
    g.setTransform(0,-k/100,k/100,0,w/2,h/2);
    const arcLine=(r,a0,a1,wd,col)=>{g.strokeStyle=col;g.lineWidth=wd;g.beginPath();
      for(let j=0;j<=60;j++){const a=a0+(a1-a0)*j/60,p=atA(a,r);j?g.lineTo(p.x*100,p.z*100):g.moveTo(p.x*100,p.z*100)}g.stroke()};
    arcLine(1.5,-.95,.95,2.6,'rgba(242,193,78,.85)');arcLine(1.57,-.95,.95,1.3,'rgba(242,193,78,.6)');
    g.setTransform(1,0,0,1,0,0);
    g.strokeStyle='rgba(255,250,240,.5)';g.lineWidth=6;g.beginPath();g.arc(w/2,h/2,488,0,7);g.stroke();
  });
}
function useFelt(on){
  if(!T.ok||!T.felt)return;
  const m=T.felt.mat.material[1],want=on?feltTex():T.felt.tex;
  if(m.map!==want){m.map=want;m.needsUpdate=true}
}
function buildRoot(){
  if(!T.ok||(V3.root&&V3.rootFL===FL))return;
  killG(V3.root);V3.rootFL=FL;
  const root=new THREE.Group();T.scene.add(root);V3.root=root;
  const dark=toon({color:0x3a3430,rim:.2});
  // 카드 통(슈)과 버린 카드 더미
  const mk=(pos,ry)=>{const p=M(pos),g=new THREE.Group();g.position.set(p.x,0,p.z);g.rotation.y=ry;root.add(g);
    const st=new THREE.Mesh(new THREE.BoxGeometry(.62*.75*1.2,1,.9*.75*1.2),[dark,dark,T.back,dark,dark,dark]);st.castShadow=true;g.add(st);return {g,st}};
  V3.shoe=mk(shoeAt(SHOE),-.35*FL);V3.disc=mk(shoeAt(DISC),.35*FL);
  // 카드 통 받침: 낮은 판 + 딜러 쪽 벽(손님 쪽은 열려 있어 남은 카드 높이가 보임)
  const hold=toon({color:0x2b2420,rim:.2}),base=new THREE.Mesh(new THREE.BoxGeometry(.66,.04,.95),hold);base.position.y=.02;V3.shoe.g.add(base);hull(new THREE.BoxGeometry(.69,.07,.98),base,V3.shoe.g);
  const wall=new THREE.Mesh(new THREE.BoxGeometry(.66,.42,.05),hold);wall.position.set(0,.21,-.47*FL);V3.shoe.g.add(wall);hull(new THREE.BoxGeometry(.69,.45,.08),wall,V3.shoe.g);
  killG(V3.dstack);V3.dstack=null;
}
function stackH(m,frac,base){const h=Math.max(.004,frac*.34);m.scale.y=h;m.position.y=base+h/2;m.visible=frac>0}
/* 베팅 칸 동그라미: 걸기 전 점선(흰색) → 걸면 실선(내 칸은 금색). 내가 걸 차례면 베팅할 칩 공간에 금색 점선 고리가 따로 하나 더(숨 쉬듯 밝아지고 시간 고리가 두름) */
function ringMesh(r0,r1,col,op,dashed){
  const g=new THREE.Group(),mat=new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:op,depthWrite:false});
  const N=dashed?14:1,seg=Math.PI*2/N;
  for(let j=0;j<N;j++){const m=new THREE.Mesh(new THREE.RingGeometry(r0,r1,dashed?8:48,1,j*seg,dashed?seg*.55:Math.PI*2),mat);m.rotation.x=-Math.PI/2;g.add(m)}
  g.userData.mat=mat;return g;
}
function syncRings(B){
  const me=myIdx(),bet=i=>(B.bt[i]||0)>0&&!(V3.piles.get(i)||{}).flying;
  const pendOn=me>=0&&SPOTS.has(me)&&B.ph==='bet'&&!B.bt[me]&&FL>0;
  const key=[...SPOTS].map(([i,a])=>i+':'+a.toFixed(3)+':'+(bet(i)?1:0)).join(',')+'|'+FL+'|'+(pendOn?1:0);
  if(V3.ringsKey===key)return;V3.ringsKey=key;
  V3.rings.forEach(killG);V3.rings=[];V3.myRing=null;
  for(const [i,a] of SPOTS){
    const p=atA(a,R_BET),mine=i===me;
    const g=mine?(bet(i)?ringMesh(.29,.335,0xf2c14e,.9,false):ringMesh(.29,.315,0xfffaf0,.45,true)):ringMesh(.29,.315,0xfffaf0,bet(i)?.6:.45,!bet(i));
    g.position.set(p.x,.021,p.z);T.scene.add(g);V3.rings.push(g);
  }
  if(pendOn){
    const p=pendPos(),g=ringMesh(.25,.285,0xf2c14e,.9,true);
    g.position.set(p.x,.021,p.z);T.scene.add(g);V3.rings.push(g);V3.myRing=g;
  }
}
/* 베팅 시간: 내 베팅할 칩 공간 둘레에 남은 시간 고리(줄어듦) + 그 칸이 숨 쉬듯 밝아짐 */
function betTimer(now){
  const B=BV(),on=!!(B&&V3.myRing&&myMode()==='bet'&&!busy()&&!dealingV());
  if(V3.myRing)V3.myRing.userData.mat.opacity=on?.6+.35*Math.sin(now/180):.9;
  if(!on){if(V3.betArc)V3.betArc.visible=false;return}
  const frac=Math.max(0,Math.min(1,(V.deadAt-now)/((+V.cfg.turn||20)*1000))),q=Math.round(frac*200)/200;
  if(!V3.betArc){V3.betArc=new THREE.Mesh(new THREE.RingGeometry(.31,.35,64),new THREE.MeshBasicMaterial({color:0xf2b632,side:THREE.DoubleSide,transparent:true,depthWrite:false}));V3.betArc.rotation.x=-Math.PI/2;T.scene.add(V3.betArc);V3.arcQ=-1}
  if(q!==V3.arcQ){V3.arcQ=q;V3.betArc.geometry.dispose();V3.betArc.geometry=new THREE.RingGeometry(.31,.35,64,1,Math.PI/2,Math.max(.001,q*Math.PI*2))}
  const p=pendPos();V3.betArc.position.set(p.x,.023,p.z);V3.betArc.visible=true;
  V3.betArc.material.color.set(frac<.25?0xcc3a2e:0xf2b632);
}
function clear3D(){
  for(const e of V3.cards.values())killCard(e.g);V3.cards.clear();
  for(const f of V3.flights)killG(f.obj);V3.flights=[];
  for(const P of V3.piles.values())killG(P.g);V3.piles.clear();
  if(V3.pend)killG(V3.pend.g);V3.pend=null;
  killG(V3.bank);V3.bank=null;killG(V3.dstack);V3.dstack=null;V3.rings.forEach(killG);V3.rings=[];V3.ringsKey='';V3.myRing=null;
  if(V3.betArc){killG(V3.betArc);V3.betArc=null}
  killG(V3.root);V3.root=null;V3.rootFL=0;V3.shoe=V3.disc=null;
  V3.sf=-1;V3.rd=-1;V3.settled=-1;V3.landed.clear();V3.toBet=V3.toBank=0;spotKey='';FL=1;
  useFelt(false);
  if(elTags){elTags.innerHTML='';elTags.dataset.k=''}
}
function sync3(v){
  const B=v.bj;if(!B||!T.ok)return;
  layout(B);buildRoot();useFelt(true);
  const me=myIdx(),now=clock();
  if(V3.rd!==B.rd){for(const P of V3.piles.values())killG(P.g);V3.piles.clear();if(V3.pend)killG(V3.pend.g);V3.pend=null;V3.landed.clear();V3.rd=B.rd;V3.toBet=V3.toBank=0}
  syncRings(B);
  // 카드 통·버린 더미 높이, 다시 섞으면 버린 카드가 통으로
  stackH(V3.shoe.st,B.sh/B.tot,.04);stackH(V3.disc.st,Math.min(B.ds,B.tot)/B.tot,.0);
  const sh=M(shoeAt(SHOE)),dc=M(shoeAt(DISC));
  if(V3.sf>=0&&V3.sf!==B.sf){
    const g=new THREE.Mesh(new THREE.BoxGeometry(.56,.2,.81),[toon({color:0x3a3430}),toon({color:0x3a3430}),T.back,toon({color:0x3a3430}),toon({color:0x3a3430}),toon({color:0x3a3430})]);T.scene.add(g);
    fly(g,{x:dc.x,y:.1,z:dc.z},{x:sh.x,y:.15,z:sh.z},700,now,.8,()=>killG(g));
  }
  V3.sf=B.sf;
  const want=new Map();
  const push=(seat,list)=>list.forEach((id,k)=>want.set(B.rd+':'+seat+':'+k,{seat,k,id,n:list.length}));
  B.od.forEach(i=>push(i,B.hc[i]||[]));push(-1,B.dc||[]);
  for(const [key,e] of V3.cards){   // 지난 판 카드는 엎어서 버린 더미로
    if(want.has(key)||e.dying)continue;
    if(!e.launched){killCard(e.g);V3.cards.delete(key);continue}
    e.dying=true;cardSet(e,{x:dc.x,y:.3,z:dc.z,ry:.35*FL,s:.55,f:0,tl:0,die:true},460,.3);
  }
  // 처음 나누기: 거는 사람 순서대로 한 장씩, 딜러, 한 바퀴 더 (엔진과 같은 순서). 다시 섞은 판은 섞은 뒤에
  const dealing=dealingV(),start=dealing?V.dealAt-(+v.dm||0)+(B.sr?SHUF_MS:0):0,nOrd=B.od.length+1;
  for(const [key,c] of want){
    let e=V3.cards.get(key);
    if(!e){
      const g=makeCard(new THREE.Vector3(sh.x,.4,sh.z),Math.PI/2,0,.55);g.userData.man=true;g.visible=false;
      let at=now;
      if(c.k<2&&dealing){const pos=c.seat<0?B.od.length:B.od.indexOf(c.seat);at=start+(c.k*nOrd+Math.max(0,pos))*DEAL_PER}
      e={key,g,id:null,at,launched:false,cur:{x:sh.x,y:.42,z:sh.z,ry:-.35*FL,s:.55,f:0,tl:0},to:null,tw:null};V3.cards.set(key,e);
    }
    if(c.id>=0&&e.id!==c.id){e.g.children[0].material=faceMat(c.id);e.id=c.id}
    const P=cardPose(c.seat,c.k,c.n);
    const peek=c.seat<0&&c.k===1&&!B.dr&&c.id>=0;   // 사람 딜러 본인: 엎은 카드를 살짝 들어 봄
    cardSet(e,{x:P.x,y:P.y+(peek?.1:0),z:P.z,ry:P.ry,s:P.s,f:c.id>=0&&!peek?1:peek?1:0,tl:peek?.55:0},e.to&&e.to.f!==(c.id>=0?1:0)?380:300,e.to&&e.to.f!==(c.id>=0?1:0)?.32:.14);
  }
  if(B.ph==='settle'&&B.rs&&V3.settled!==B.rd){V3.settled=B.rd;settleFly(B)}
  syncChips();
}
function frame3(now){
  for(const e of [...V3.cards.values()]){
    if(!e.launched&&now>=e.at&&e.to){e.launched=true;e.g.visible=true;e.tw={from:{...e.cur},to:e.to,t0:now,ms:420,lift:.38};sfx('flick')}
    if(e.launched)cardStep(e,now);
  }
  frameFlights(now);betTimer(now);
  // 베팅이 시작되면 내 칩 더미가 한 번 통통 튐
  if(V3.bank){const a=now-V3.bounceAt;V3.bank.position.y=a>=0&&a<520?Math.abs(Math.sin(a/520*Math.PI*2))*.09*(1-a/520):0}
}
G.render3D=t=>{if(ON&&V3.root){frame3(t);T.timerBg.visible=T.timerArc.visible=false}T.r.render(T.scene,T.cam)};   // 남은 시간은 이름표 테두리와 내 베팅 칸 고리로 (자리 가장자리 고리는 숨김)
/* 공통 코드가 다른 사람 자리에 카드 더미를 놓는데(손패 표시 1장) 블랙잭은 카드를 펠트에 펼치므로 숨김 */
G.field3D=v=>{
  if(T.stacks)for(const arr of T.stacks.values())arr.forEach(c=>{c.visible=false});
  if(v&&v.bj&&(v.st==='play'||v.st==='over'))sync3(v);
};
/* 판이 시작되면: 판 번호를 펠트 가운데에 잠깐, 내가 걸 차례면 칩 더미가 튀고 짤랑 */
function roundStart(B){
  const a=(T&&T.anchor)||{x:$('#stage').clientWidth/2,y:$('#stage').clientHeight/2};
  const d=document.createElement('div');d.className='playfx';d.style.setProperty('--rc','#9a5b00');
  d.style.left=a.x+'px';d.style.top=Math.max(46,a.y-40)+'px';d.innerHTML=`<span class="fx-n">${B.rd} / ${B.rds}판</span>`;
  d.addEventListener('animationend',()=>d.remove());
  const layer=$('#fx');while(layer.children.length>2)layer.firstChild.remove();layer.appendChild(d);setTimeout(()=>d.remove(),2300);
  if(myMode()==='bet'){V3.bounceAt=clock();sfxChip(3)}
}
/* 칩 더미 누르기는 기둥마다 맨 위 칩(날아가는 칩)만: 맨 위 칩 높이의 평면에서 그 칩 자리 + 위쪽(화면 위, -z)으로 조금 여유 */
const _tp=window.THREE?new THREE.Plane(new THREE.Vector3(0,1,0),0):null,_th=window.THREE?new THREE.Vector3():null;
function topChipAt(ray,n){
  for(let k=0;k<4;k++){
    if(!n[k])continue;
    _tp.constant=-Math.min(n[k],12)*CHIP_H;if(!ray.intersectPlane(_tp,_th))continue;
    const dx=_th.x-BANK_X[k],dz=_th.z-BANK_Z;
    if(Math.abs(dx)<CHIP_R+.03&&dz>-CHIP_R-.12&&dz<CHIP_R&&(dz<0||Math.hypot(dx,dz)<CHIP_R+.03))return DEN[k];
  }
  return 0;
}
/* 칩 누르기: 내 칩 더미(맨 위 칩) → 베팅할 칩 공간, 베팅할 칩 공간 → 돌려받기 */
const _ray=window.THREE?new THREE.Raycaster():null,_pl=window.THREE?new THREE.Plane(new THREE.Vector3(0,1,0),-.12):null,_hit=window.THREE?new THREE.Vector3():null;
function chipAt(e){
  if(!ON||!T.ok||!BV()||myIdx()<0||!V3.bank)return null;
  const r=$('#cv').getBoundingClientRect();if(!r.width)return null;
  _ray.setFromCamera({x:(e.clientX-r.left)/r.width*2-1,y:-(e.clientY-r.top)/r.height*2+1},T.cam);
  const d=topChipAt(_ray.ray,V3.bank.userData.n);if(d)return {d};
  if(!_ray.ray.intersectPlane(_pl,_hit))return null;
  if(SPOTS.has(myIdx())){const b=pendPos();if(Math.hypot(_hit.x-b.x,_hit.z-b.z)<.3)return {bet:1}}   // 베팅할 칩 공간만 누를 수 있음(건 칩은 못 누름)
  return null;
}

/* ---------- 합계 표 (베팅 칸 아래), 이름표의 칩 ---------- */
function tagsFrame(){
  const B=BV();if(!elTags)return;
  if(!B||!T.ok||!(V.st==='play'||V.st==='over')){if(elTags.dataset.k){elTags.innerHTML='';elTags.dataset.k=''}return}
  const me=myIdx(),st=$('#stage'),W=st.clientWidth,Hh=st.clientHeight,list=[];
  if(B.dc.length){const dn=B.hd&&B.dl===me?'딜러 · 나':'딜러';list.push({k:'d',html:`<span class="who">${dn}</span>${totalHTML(B.dc,0,true)}`,p:M({x:0,z:DEALER_Z+.66}),on:B.ph==='dealer'&&V.t===B.dl})}
  // 내 칩 숫자: 칩 더미 아래에 남은 칩, 베팅할 칩 공간 옆에 올려 둔 칩 (칩이 떠나고 도착하는 때에 맞춰 바뀜)
  if(me>=0&&V.ps[me]&&!V.ps[me].f&&!(B.hd&&B.dl===me)&&B.od.includes(me)&&V3.bank){
    list.push({k:'c',c:' num',html:`<b>${bankAmt(B,me)}</b>`,p:M({x:0,z:BANK_Z+.42}),on:false});
    if(V3.pend&&V3.pend.amt>0)list.push({k:'p',c:' num',html:`<b>${V3.pend.amt}</b>`,p:M({x:.62,z:PEND_Z}),on:false});
  }
  const key=list.map(x=>x.k+x.html+(x.on?1:0)).join('|');
  if(elTags.dataset.k!==key){elTags.innerHTML=list.map(x=>`<div class="bj-tag${x.on?' on':''}${x.k==='d'?' dl':''}${x.c||''}" data-k="${x.k}">${x.html}</div>`).join('');elTags.dataset.k=key}
  const v3=new THREE.Vector3();
  list.forEach(x=>{
    const el=elTags.querySelector(`[data-k="${x.k}"]`);if(!el)return;
    v3.set(x.p.x,.03,x.p.z).project(T.cam);
    const hw=el.offsetWidth/2,hh=el.offsetHeight/2;
    el.style.left=Math.max(hw+4,Math.min(W-hw-4,(v3.x+1)/2*W))+'px';el.style.top=Math.max(hh+4,Math.min(Hh-hh-4,(1-v3.y)/2*Hh))+'px';
  });
}
/* WebGL이 없을 때: 딜러와 모두의 카드를 2D로 */
function render2D(){
  const B=BV();if(!el2d)return;
  const on=!!(B&&!T.ok&&(V.st==='play'||V.st==='over'));
  if(!on){if(!el2d.hidden){el2d.hidden=true;el2d.innerHTML='';el2d.dataset.k=''}return}
  const me=myIdx(),row=(name,cs,tag,cls)=>`<div class="r2${cls||''}"><span class="n2">${name}</span><span class="c2">${cs.map(cardEl).join('')}</span><span class="t2">${tag}</span></div>`;
  let h=row('딜러',B.dc,totalHTML(B.dc,0,true),' dl');
  B.od.forEach(i=>{const p=V.ps[i];if(!p)return;const r=B.ph==='settle'&&B.rs?` <em class="${B.rs[i]>0?'w':B.rs[i]<0?'l':'p'}">${sgn(B.rs[i])}</em>`:'';h+=row(esc(p.n)+(i===me?' (나)':''),B.hc[i]||[],totalHTML(B.hc[i]||[],B.st[i],false)+r,i===me?' me':'')});
  if(el2d.dataset.k!==h){el2d.innerHTML=h;el2d.dataset.k=h}
  el2d.hidden=false;
}
G.hud=inGame=>{
  const on=!!(inGame&&BV());
  if(!on){if(T.ok)clear3D();if(elBet)elBet.hidden=true}
  render2D();
};
/* 이름표: 장수 대신 칩, 그 아래 줄에 카드 합계·정산. 3D면 이름표를 그 사람 베팅 칸 바로 아래로 옮김(공통 코드가 자리 가장자리에 놓은 뒤 매 프레임) */
function seatTags(B){
  const on3=T.ok&&(V.st==='play'||V.st==='over'),st=$('#stage'),W=st.clientWidth,Hh=st.clientHeight,v3=on3?new THREE.Vector3():null,put=[];
  document.querySelectorAll('#labels .seat[data-i]').forEach(el=>{
    const i=+el.dataset.i,ct=el.querySelector('.ct'),p=V.ps[i];if(!ct||!p)return;
    const t=p.sr?(p.sr===2?'시간 초과':p.sr===3?'탈주':'항복'):`칩 ${B.ch[i]}`;if(ct.textContent!==t)ct.textContent=t;
    const cs=B.od.includes(i)?B.hc[i]||[]:[];
    const r=B.ph==='settle'&&B.rs&&B.od.includes(i)?`<em class="${B.rs[i]>0?'w':B.rs[i]<0?'l':'p'}">${sgn(B.rs[i])}</em>`:'';
    const h=cs.length?totalHTML(cs,B.st[i],false)+(B.db[i]?'<i>더블</i>':'')+r:'';
    let x=el.querySelector('.bjt');if(!x){x=document.createElement('div');x.className='bjt';el.appendChild(x)}
    if(x.dataset.h!==h){x.innerHTML=h;x.dataset.h=h}
    const dlr=on3&&B.hd&&i===B.dl;   // 사람 딜러의 이름표는 딜러 카드 위(맞은편)
    if(on3&&(SPOTS.has(i)||dlr)){
      const q=dlr?M({x:0,z:DEALER_Z-.95}):atA(SPOTS.get(i),R_PILL);v3.set(q.x,.03,q.z).project(T.cam);
      const w=el.offsetWidth,h=el.offsetHeight;   // 베팅 칸 바깥쪽(내가 딜러면 화면 위쪽)으로 붙임
      put.push({el,w,h,x:Math.max(w/2+6,Math.min(W-w/2-6,(v3.x+1)/2*W)),y:(1-v3.y)/2*Hh+(FL>0?h/2-10:-h/2+10)});
    }
  });
  // 좁은 화면에서 이웃 이름표가 겹치면 한 칸 비킴(탁자 바깥쪽으로)
  put.sort((a,b)=>Math.abs(a.x-W/2)-Math.abs(b.x-W/2));
  const done=[];
  for(const q of put){
    for(let g=0;g<4&&done.some(o=>Math.abs(o.x-q.x)<(o.w+q.w)/2+4&&Math.abs(o.y-q.y)<(o.h+q.h)/2+2);g++)q.y+=(q.h+3)*FL;
    done.push(q);q.el.style.left=q.x+'px';q.el.style.top=Math.max(q.h/2+6,Math.min(Hh-q.h/2-6,q.y))+'px';
  }
}
/* 시간이 다 돼 가는데 베팅할 칩 공간에 칩이 올라가 있으면 그대로 검(방장은 시간이 지나면 최소 칩으로 처리하므로 조금 일찍 보냄) */
function autoBet(){
  if(!pend.length||myMode()!=='bet'||!canBetNow()||V.deadAt-clock()>700)return;
  doAct('bet');
}
G.live=()=>{
  const B=BV();if(!B)return;
  if(T.ok)layout(B);
  tagsFrame();seatTags(B);autoBet();
};
G.enter=()=>{ON=true;$('#stage').classList.add('bj');$('#numpick').hidden=true};
G.leave=()=>{
  ON=false;if(typeof T!=='undefined'&&T.ok)clear3D();
  const st=$('#stage');if(st)st.classList.remove('bj');
  const pass=$('#btnPass'),gb=$('#btnGura');if(pass){setTxt(pass,'패스');pass.hidden=false}if(gb){setTxt(gb,'구라!');gb.hidden=true}
  if(elBet)elBet.hidden=true;if(el2d){el2d.hidden=true;el2d.innerHTML='';el2d.dataset.k=''}if(elTags){elTags.innerHTML='';elTags.dataset.k=''}
  if(typeof T!=='undefined'&&T.stacks)for(const arr of T.stacks.values())arr.forEach(c=>{c.visible=true});
  const cv=$('#cv');if(cv)cv.style.cursor='';
};
G.init=()=>{
  const css=document.createElement('style');
  css.textContent=`
.stage.bj #dim{display:none}
.stage.bj .fan{display:none}
#bjTags{position:absolute;inset:0;pointer-events:none;z-index:4}
.bj-tag{position:absolute;transform:translate(-50%,-50%);display:flex;align-items:baseline;gap:5px;padding:1px 8px 2px;border-radius:99px;background:rgba(255,250,240,.9);border:1.5px solid var(--line-strong);box-shadow:0 2px 5px -2px rgba(59,42,31,.4);white-space:nowrap;font-size:12px;line-height:1.2;transition:box-shadow .2s,border-color .2s}
.bj-tag.on{border-color:var(--mustard-edge);box-shadow:0 0 0 2px var(--mustard)}
.bj-tag.dl{background:rgba(59,42,31,.88);border-color:#2d2219;color:#f4ead9}
.bj-tag.dl b{color:#f4ead9}.bj-tag.dl .who{color:#d8c7ab}
.bj-tag.num{padding:0 7px 1px;background:rgba(59,42,31,.82);border-color:transparent;box-shadow:none}
.bj-tag.num b{font-size:13px;color:#f4ead9}
.bj-tag b{font-family:var(--f-num);font-size:14px;font-weight:700;color:var(--ink)}
.bj-tag b.bust{font-family:var(--f-body);font-size:12.5px;color:var(--gura)}
.bj-tag b.bj{font-family:var(--f-body);font-size:12.5px;color:#c08a17}
.bj-tag i{font-style:normal;font-size:11px;font-weight:600;color:var(--muted)}
.bj-tag .who{font-size:11px;font-weight:700;color:var(--muted)}
.bj-tag em,.r2 em{font-style:normal;font-family:var(--f-num);font-weight:700;font-size:13px}
.bj-tag em.w,.r2 em.w{color:#2c7d47}.bj-tag em.l,.r2 em.l{color:var(--gura)}.bj-tag em.p,.r2 em.p{color:var(--muted);font-family:var(--f-body);font-size:12px}
.seat .bjt{display:flex;align-items:baseline;gap:4px;font-size:11px;line-height:1.2}.seat .bjt:empty{display:none}
.seat .bjt b{font-family:var(--f-num);font-size:13.5px;font-weight:700;color:var(--ink)}.seat .bjt b.bust{font-family:var(--f-body);font-size:12px;color:var(--gura)}.seat .bjt b.bj{font-family:var(--f-body);font-size:12px;color:#c08a17}.seat .bjt i{font-style:normal;font-size:10.5px;font-weight:600;color:var(--muted)}.seat .bjt em{font-style:normal;font-family:var(--f-num);font-weight:700;font-size:12.5px}.seat .bjt em.w{color:#2c7d47}.seat .bjt em.l{color:var(--gura)}.seat .bjt em.p{color:var(--muted);font-family:var(--f-body);font-size:11px}

.bj-dtag{display:inline-block;font-size:10.5px;font-weight:700;line-height:1;padding:3px 6px 2px;border-radius:99px;margin-right:5px;vertical-align:1px;background:#3b2a1f;color:#f4ead9}
@media (max-width:480px){.stage.bj .myplate{bottom:72px;max-width:calc(100% - 24px)}}
#bjBet{position:absolute;left:50%;bottom:calc(var(--plateB,14px) + 62px);transform:translateX(-50%);z-index:8;display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:18px;background:rgba(255,250,240,.94);border:1.5px solid var(--line-strong);box-shadow:0 4px 12px -4px rgba(59,42,31,.45)}
#bjBet[hidden]{display:none}
#bjBet .bj-amt{display:flex;align-items:center;gap:4px;min-width:84px;justify-content:center}
#bjBet .bj-amt b{font-family:var(--f-num);font-size:26px;font-weight:700;color:var(--ink);min-width:58px;text-align:center}
#bjBet .bj-clr{width:30px;height:30px;border-radius:50%;border:1.5px solid var(--line-strong);background:var(--well);color:var(--muted);font-size:13px;font-weight:700;cursor:pointer;padding:0}
#bjBet .bj-chip{--c:#cc3a2e;width:50px;height:50px;border-radius:50%;border:0;background:radial-gradient(circle,var(--c) 0 52%,transparent 53%),repeating-conic-gradient(#fffaf0 0 15deg,var(--c) 15deg 45deg);box-shadow:0 3px 0 rgba(0,0,0,.35),inset 0 0 0 3px var(--c);color:#fffaf0;font-family:var(--f-num);font-weight:700;font-size:14px;cursor:pointer;padding:0;touch-action:manipulation}
#bjBet .bj-chip.c50{--c:#2e7d4f}#bjBet .bj-chip.c100{--c:#2b2b2b}
#bjBet .bj-chip.all{--c:#6b3fa0;font-family:var(--f-body);font-size:12px}
#bjBet button:disabled{opacity:.4;cursor:not-allowed}
@media (max-width:480px){#bjBet{bottom:128px;gap:6px;padding:7px 8px}#bjBet .bj-chip{width:44px;height:44px;font-size:13px}#bjBet .bj-amt{min-width:72px}#bjBet .bj-amt b{font-size:22px;min-width:48px}}
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
  elBet.innerHTML=`<button type="button" class="bj-chip" data-add="10" aria-label="10개 더">10</button><button type="button" class="bj-chip c50" data-add="50" aria-label="50개 더">50</button><button type="button" class="bj-chip c100" data-add="100" aria-label="100개 더">100</button><div class="bj-amt"><b aria-live="polite">0</b><button type="button" class="bj-clr" data-clr aria-label="모두 빼기" title="모두 빼기">✕</button></div><button type="button" class="bj-chip all" data-all aria-label="가진 칩 모두">올인</button>`;
  $('#stage').appendChild(elBet);
  elBet.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b||b.disabled||!canBetNow())return;
    if(b.dataset.add){addChip(+b.dataset.add);return}
    if(b.hasAttribute('data-all'))pend=greedy(Math.floor(myChips()/MIN)*MIN);else if(b.hasAttribute('data-clr'))pend=[];
    sfxChip(1);renderMe();
  });
  $('#btnGura').addEventListener('click',()=>{if(ON)doAct('double')});
  const cv=$('#cv');
  cv.addEventListener('click',e=>{if(!ON||!canBetNow())return;const h=chipAt(e);if(!h)return;if(h.d)addChip(h.d);else takeChip()});
  cv.addEventListener('pointermove',e=>{if(!ON)return;const h=e.pointerType==='mouse'&&canBetNow()?chipAt(e):null;const c=h?'pointer':'';if(cv.style.cursor!==c)cv.style.cursor=c});
};

(window.GAMES=window.GAMES||{}).blackjack=G;
})();
