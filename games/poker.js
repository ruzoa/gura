/* ===== 포커 (텍사스 홀덤, 노리밋) 게임 모듈 =====
   공통 코드(index.html)가 GAMES.poker의 함수를 불러서 이 게임의 규칙·봇·카드·화면을 그림.
   카드 id: 0~51 = 숫자 순번(0~12 = A,2,…,10,J,Q,K)*4 + 무늬(0~3 = ♠ ♥ ♦ ♣). 블랙잭과 같은 그림
   손패(hand)는 공통 코드가 '끝나지 않은 사람'으로 보도록 [0]만 넣어 둠. 진짜 카드는 H.pk.hc(사람마다 2장)·H.pk.bd(공용 카드)이고
   받는 사람 자기 카드만 보냄(쇼다운·올인으로 펼친 카드만 모두에게). 덱은 방장만 가짐
   칩: H.pk.ch는 앞에 남은 칩(건 칩은 빼고), bet은 이번 베팅 차례에 건 칩, tot는 이번 판에 낸 칩 모두(팟 = tot의 합)
   한 경기: 첫 딜러 버튼 룰렛 → 판마다 블라인드 → 카드 2장 → 프리플랍·플랍·턴·리버 베팅 → 쇼다운 → 정산 → 다음 판(버튼이 왼쪽으로).
   정한 판 수를 마치면 칩 순서로 순위, 칩을 다 잃으면 그때 탈락 */
(function(){
const G={id:'poker',name:'포커',short:'포커',lead:'텍사스 홀덤, 노 리밋',brand:'포커',brandPx:56};

/* ---------- 카드 ---------- */
const RK=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const SUITS=['♠','♥','♦','♣'];
const SUIT_COL=['#34404f','#c53026','#c53026','#34404f'];
const rkOf=id=>(id%52)>>2, suitOf=id=>(id%52)&3;
const rv=id=>{const r=rkOf(id);return r===0?14:r+1};   // 2~14 (A가 가장 높음)
G.cardHTML=()=>'';   // 손패 부채는 쓰지 않음 (카드는 모두 테이블 위)
G.labelOf=id=>RK[rkOf(id)];G.cmpCard=(a,b)=>a-b;
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
  if(rkOf(id)>=10){g.font=`${34*k}px "Jua", "Black Han Sans", sans-serif`;g.fillText(lab,w/2,52*k)}   // J·Q·K는 글자로 크게
  else{g.font=`${40*k}px sans-serif`;g.fillText(su,w/2,52*k)}
  g.save();g.translate(w-6*k,h-3*k);g.rotate(Math.PI);g.font=`600 ${13*k}px "IBM Plex Mono", "Jua", monospace`;g.textAlign='left';g.textBaseline='top';g.fillText(lab,0,0);g.restore();
};
/* 2D 카드 (WebGL이 없을 때) */
const cardEl=id=>id>=0?`<span class="card pkc" style="--rc:${SUIT_COL[suitOf(id)]}"><span class="cn">${RK[rkOf(id)]}<i>${SUITS[suitOf(id)]}</i></span><span class="big">${rkOf(id)>=10?RK[rkOf(id)]:SUITS[suitOf(id)]}</span></span>`:'<span class="card back"></span>';

/* ---------- 족보 ----------
   5장 점수: 족보 등급 × 15^5 + 비교할 숫자들(높은 것부터). 같은 족보끼리도 숫자 하나로 비교됨
   7장은 21가지 5장 중 가장 높은 것 */
const HAND_NAMES=['하이 카드','원 페어','투 페어','트리플','스트레이트','플러시','풀 하우스','포카드','스트레이트 플러시'];
const B15=15**5;
function eval5(cs){
  const v=cs.map(rv).sort((a,b)=>b-a),s0=suitOf(cs[0]),fl=cs.every(c=>suitOf(c)===s0);
  const cnt=new Map();for(const x of v)cnt.set(x,(cnt.get(x)||0)+1);
  const gr=[...cnt].sort((a,b)=>b[1]-a[1]||b[0]-a[0]);   // [숫자, 장수]: 많은 것, 높은 것부터
  let st=0;
  if(gr.length===5){if(v[0]-v[4]===4)st=v[0];else if(v[0]===14&&v[1]===5)st=5}   // A-2-3-4-5는 5 스트레이트
  let cat,ks;
  if(st&&fl){cat=8;ks=[st]}
  else if(gr[0][1]===4){cat=7;ks=[gr[0][0],gr[1][0]]}
  else if(gr[0][1]===3&&gr[1][1]===2){cat=6;ks=[gr[0][0],gr[1][0]]}
  else if(fl){cat=5;ks=v}
  else if(st){cat=4;ks=[st]}
  else if(gr[0][1]===3){cat=3;ks=gr.map(g=>g[0])}
  else if(gr[0][1]===2&&gr[1][1]===2){cat=2;ks=gr.map(g=>g[0])}
  else if(gr[0][1]===2){cat=1;ks=gr.map(g=>g[0])}
  else{cat=0;ks=v}
  let s=cat;for(let k=0;k<5;k++)s=s*15+(ks[k]||0);
  return s;
}
const C5=[];for(let a=0;a<7;a++)for(let b=a+1;b<7;b++)C5.push([a,b]);   // 7장에서 뺄 2장
/* 가장 좋은 5장: {v 점수, cat 족보 등급, five 그 5장} (5~7장) */
function best(cs){
  let bv=-1,bf=null;
  const tryF=f=>{const v=eval5(f);if(v>bv){bv=v;bf=f}};
  if(cs.length<=5)tryF(cs.slice());
  else if(cs.length===6)for(let a=0;a<6;a++)tryF(cs.filter((_,k)=>k!==a));
  else for(const [a,b] of C5)tryF(cs.filter((_,k)=>k!==a&&k!==b));
  return {v:bv,cat:Math.floor(bv/B15),five:bf};
}
/* 빠른 7장 점수 (봇의 승률 계산용): 21가지를 다 보지 않고 숫자·무늬를 세어 바로 계산. best(cs).v와 같은 값 */
const _cnt=new Int8Array(15),_sc=new Int8Array(4),_sm=new Int32Array(4);
function topStraight(m){if(m&16384)m|=2;for(let r=14;r>=5;r--)if(((m>>(r-4))&31)===31)return r;return 0}
function score7(cs){
  _cnt.fill(0);_sc.fill(0);_sm.fill(0);let mask=0;
  for(const id of cs){const r=rv(id),su=suitOf(id);_cnt[r]++;_sc[su]++;_sm[su]|=1<<r;mask|=1<<r}
  const enc=(cat,a,b,c,d,e)=>((((cat*15+a)*15+(b||0))*15+(c||0))*15+(d||0))*15+(e||0);
  let f=-1;for(let k=0;k<4;k++)if(_sc[k]>=5)f=k;
  if(f>=0){const sf=topStraight(_sm[f]);if(sf)return enc(8,sf)}
  let q=0,t1=0,t2=0,p1=0,p2=0;
  for(let r=14;r>=2;r--){const c=_cnt[r];if(c===4)q=r;else if(c===3){if(!t1)t1=r;else if(!t2)t2=r}else if(c===2){if(!p1)p1=r;else if(!p2)p2=r}}
  const top=(n,...ex)=>{const o=[];for(let r=14;r>=2&&o.length<n;r--)if(_cnt[r]&&!ex.includes(r))o.push(r);return o};
  if(q)return enc(7,q,top(1,q)[0]);
  if(t1&&(t2||p1))return enc(6,t1,Math.max(t2,p1));
  if(f>=0){const o=[];for(let r=14;r>=2&&o.length<5;r--)if(_sm[f]&(1<<r))o.push(r);return enc(5,...o)}
  const st=topStraight(mask);if(st)return enc(4,st);
  if(t1)return enc(3,t1,...top(2,t1));
  if(p1&&p2)return enc(2,p1,p2,top(1,p1,p2)[0]);
  if(p1)return enc(1,p1,...top(3,p1));
  return enc(0,...top(5));
}
const handName=b=>b.cat===8&&Math.floor(b.v/15**4)%15===14?'로열 플러시':HAND_NAMES[b.cat];
Object.assign(G,{eval5,best,handName});

/* ---------- 규칙 설명·방 설정 ---------- */
G.rulesHTML='<ol class="rules"><li><b>목표</b> : 모두 같은 수의 칩으로 시작해서, 정한 판 수를 마쳤을 때 칩이 가장 많은 사람이 이깁니다. 칩을 다 잃으면 탈락합니다</li><li><b>카드</b> : 모두 카드 2장을 받고, 가운데에 공용 카드 5장이 차례로 펼쳐집니다. 내 카드 2장과 공용 카드 5장 중 가장 좋은 5장으로 겨룹니다</li><li><b>블라인드</b> : 딜러 버튼(D) 왼쪽 사람이 스몰 블라인드, 그다음 사람이 빅 블라인드(두 배)를 먼저 겁니다. 버튼은 판마다 왼쪽으로 옮깁니다. 둘이서 할 때는 버튼이 스몰 블라인드입니다</li><li><b>베팅</b> : 카드를 받은 뒤(프리플랍), 공용 카드 3장(플랍), 4번째(턴), 5번째(리버)를 펼친 뒤 한 바퀴씩 겁니다. <b>체크</b>는 더 걸지 않고 넘김, <b>콜</b>은 앞사람만큼 맞춤, <b>레이즈</b>는 더 올림, <b>폴드</b>는 이번 판을 포기합니다</li><li><b>레이즈</b> : 내 앞의 칩 더미를 누르면 그 칩이 베팅 칸으로 가고, 베팅 칸을 누르면 돌아옵니다. 칩을 올리지 않고 [레이즈]를 누르면 가장 적게 올립니다. 최소 레이즈는 바로 앞에서 올린 만큼이고, 가진 칩을 모두 거는 <b>올인</b>은 언제든 됩니다 (노 리밋)</li><li><b>쇼다운</b> : 리버까지 남은 사람은 카드를 펼쳐 가장 좋은 사람이 팟을 가져갑니다. 같으면 나눕니다. 올인한 사람은 자기가 건 만큼만 겨루고, 그보다 더 걸린 칩(사이드 팟)은 나머지 사람끼리 겨룹니다</li><li><b>족보</b> (높은 것부터) : 스트레이트 플러시 · 포카드 · 풀 하우스 · 플러시 · 스트레이트 · 트리플 · 투 페어 · 원 페어 · 하이 카드. A는 가장 높고, A-2-3-4-5 스트레이트에서만 1로 씁니다</li><li><b>시간 초과</b> : 체크할 수 있으면 체크, 아니면 폴드입니다</li></ol>';
G.modeDesc=['정한 판 수까지','정한 판 수까지'];
G.noFast=true;
G.oneBotLv=true;   // 봇은 쉬움 하나뿐: 대기실에서 난이도를 고르지 않음
G.specNote='관전 중입니다. 쇼다운에서 펼친 카드만 보입니다.';
const U=10;   // 가장 작은 칩: 모든 베팅·나누기가 이 단위
G.defaults={chips:1000,sb:10,rounds:10,up:0,turn:30,pickfirst:0};
G.roomSet=[
  {k:'chips',label:'시작 칩',unit:'개',lo:200,hi:5000,step:100,desc:'모두 같은 수의 칩으로 시작합니다'},
  {k:'rounds',label:'판 수',unit:'판',lo:3,hi:50,step:1,desc:'이 판 수를 마치면 칩이 가장 많은 사람이 이깁니다'},
  {k:'sb',label:'스몰 블라인드',unit:'개',lo:10,hi:100,step:10,desc:'빅 블라인드는 두 배입니다'},
  {k:'up',label:'블라인드 오름',unit:'판마다',lo:0,hi:10,step:1,desc:'이 판 수마다 블라인드가 두 배로 오릅니다. 0이면 오르지 않습니다'},
  {k:'turn',label:'제한 시간',unit:'초',lo:10,hi:60,step:5,desc:'시간이 지나면 체크할 수 있으면 체크, 아니면 폴드'}];
G.ruleSet=[{k:'pickfirst',label:'첫 딜러 직접 고르기',desc:'켜면 방장이 대기실에서 첫 딜러 버튼을 받을 사람을 고릅니다. 끄면 룰렛으로 정합니다'}];
const blindTxt=c=>`${+c.sb||10}/${2*(+c.sb||10)}`;
G.cfgChips=c=>`<span class="chip">시작 칩 <b>${+c.chips}개</b></span><span class="chip"><b>${+c.rounds}판</b></span><span class="chip">블라인드 <b>${blindTxt(c)}</b></span><span class="chip">제한 시간 <b>${+c.turn}초</b></span>`;
G.cfgSum=c=>`시작 칩 ${+c.chips}개 · ${+c.rounds}판 · 블라인드 ${blindTxt(c)}${+c.up?` (${+c.up}판마다 두 배)`:''} · 제한 시간 ${+c.turn}초 · 첫 딜러 ${+c.pickfirst?'방장 선택':'룰렛'}`;
G.roomSub=x=>`블라인드 ${x.bl||'10/20'} · ${+x.rds||10}판`;
G.pubExtra=c=>({bl:blindTxt(c),rds:+c.rounds||10});
G.cardInfo=()=>'';
G.rankTitle=()=>'';
G.finLabel=()=>'';
G.noEmotes=['gq'];
G.keys={pkAll:'KeyZ'};   // ↑·↓는 블랙잭과 같은 키(bjUp·bjDown)를 같이 씀
G.keyActions=[
  {a:'gura',n:'레이즈',d:'올린 칩만큼 레이즈합니다. 칩을 올리지 않았으면 가장 적게 올립니다 (구라!와 같은 키)'},
  {a:'bjUp',n:'칩 올리기',d:'레이즈할 칩을 빅 블라인드만큼 늘립니다'},
  {a:'bjDown',n:'칩 내리기',d:'마지막에 올린 칩을 내립니다'},
  {a:'pkAll',n:'올인',d:'가진 칩을 모두 올립니다'}];

/* ---------- 방장 엔진 ---------- */
const DEAL_PER=190;   // 처음 나눌 때 카드 한 장 간격 (ms)
const COLLECT_MS=520,FLOP_MS=1150,CARD_MS=750,RUN_GAP=900,SHOW_MS=4200,FOLD_WIN_MS=2600,OPEN_MS=900;
const nm=i=>H.players[i]?H.players[i].name:'';
const canBot=(p,t)=>!!p&&p.bot&&!(p.away&&t<p.awayAt+AWAY_WAIT);   // 끊긴 사람은 기다리는 동안 봇이 대신하지 않음
const alive=i=>!!H.players[i]&&!H.players[i].finished;
const K_=()=>H.pk;
/* 판 안의 상태 st: 0 = 겨루는 중(행동할 수 있음), 1 = 폴드, 2 = 올인, 3 = 이번 판에 없음 */
const inHand=i=>{const s=K_().st[i];return s===0||s===2};
const canAct=i=>K_().st[i]===0&&alive(i);
function nextFrom(i,f){const n=H.players.length;for(let k=1;k<=n;k++){const j=((i+k)%n+n)%n;if(f(j))return j}return -1}
const live=()=>H.players.map((_,i)=>i).filter(inHand);
const potOf=K=>K.tot.reduce((a,b)=>a+b,0);
const rUp=a=>Math.ceil(a/U)*U;
/* 레이즈할 수 있는 범위: 가장 적게(minTo) ~ 올인(maxTo). 둘 다 이번 베팅 차례에 건 칩 합계 기준 */
function raiseRange(K,i){
  const maxTo=K.bet[i]+K.ch[i],minTo=K.cur+K.minR;
  return {minTo:Math.min(minTo,maxTo),maxTo,open:!!K.ro[i]&&maxTo>K.cur};
}
function pay(K,i,a){a=Math.max(0,Math.min(a,K.ch[i]));K.ch[i]-=a;K.bet[i]+=a;K.tot[i]+=a;if(K.ch[i]===0&&K.st[i]===0)K.st[i]=2;return a}
function setTurn(i){
  const t=clock(),K=K_();
  H.turn=i;H.deadline=t+H.cfg.turn*1000;H.botActAt=H.players[i].bot?t+rand(1000,2300):0;K.sq++;mark();
}
function newHand(){
  const K=K_(),n=H.players.length,t=clock();
  K.hn++;
  if(K.hn>1)K.bt=nextFrom(K.bt,alive);else if(!alive(K.bt))K.bt=nextFrom(K.bt,alive);
  if(K.up>0&&K.hn>1&&(K.hn-1)%K.up===0){K.sb*=2;K.bb=K.sb*2;K.lv=K.hn;addLog(`블라인드가 ${K.sb}/${K.bb}로 오릅니다.`,'sys')}
  K.st=H.players.map((_,i)=>alive(i)&&K.ch[i]>0?0:3);
  K.ch0=K.ch.slice();
  const ls=live();
  if(ls.length===2){K.sbS=K.bt;K.bbS=nextFrom(K.bt,inHand)}   // 둘이서: 버튼이 스몰 블라인드
  else{K.sbS=nextFrom(K.bt,inHand);K.bbS=nextFrom(K.sbS,inHand)}
  Object.assign(K,{bet:Array(n).fill(0),tot:Array(n).fill(0),la:Array(n).fill(''),hc:Array.from({length:n},()=>[]),bd:[],rs:null,sr:0,acted:Array(n).fill(false),ro:Array(n).fill(true),open:false,nextAt:0,ph:'deal'});
  pay(K,K.sbS,K.sb);pay(K,K.bbS,K.bb);
  K.cur=K.bb;K.minR=K.bb;
  K.deck=shuffle([...Array(52).keys()]);
  K.dor=[];for(let k=0;k<ls.length;k++)K.dor.push(nextFrom(k?K.dor[k-1]:K.sbS-1,inHand));   // 스몰 블라인드부터 왼쪽으로
  for(let r=0;r<2;r++)for(const i of K.dor)K.hc[i].push(K.deck.pop());
  H.seatNote={};H.turn=-1;H.botActAt=0;
  addLog(`${K.hn}판 · 딜러 ${nm(K.bt)} · 블라인드 ${K.sb}/${K.bb}`,'sys');
  K.sq++;
  beginDeal(2*ls.length*DEAL_PER+700);   // 나누는 동안 제한 시간·봇·행동을 멈춤 (화면은 카드가 한 장씩 날아감)
  mark();
}
/* 베팅 차례 시작: 프리플랍은 빅 블라인드 다음(둘이서는 버튼), 그 뒤는 버튼 다음 사람부터 */
function startStreet(){
  const K=K_();K.ph='bet';
  if(live().length<2){winNoShow();return}
  const from=K.sr===0?K.bbS:K.bt;
  if(runOut()){endStreet();return}
  const i=nextFrom(from,needs);
  if(i<0){endStreet();return}
  setTurn(i);
}
const needs=i=>{const K=K_();return canAct(i)&&(!K.acted[i]||K.bet[i]<K.cur)};
/* 더 걸 사람이 없음: 행동할 수 있는 사람이 없거나, 한 명뿐이고 이미 맞춰 걸었음 → 남은 카드를 바로 펼침 */
function runOut(){
  const K=K_(),ca=H.players.map((_,i)=>i).filter(canAct);
  return ca.length===0||(ca.length===1&&K.bet[ca[0]]>=K.cur);
}
function advance(from){
  const K=K_();
  if(live().length<2){winNoShow();return}
  if(runOut()){endStreet();return}
  const i=nextFrom(from,needs);
  if(i<0){endStreet();return}
  setTurn(i);
}
/* 행동: fold | call(체크·콜) | raise(to: 이번 베팅 차례에 건 칩 합계) */
function doAct(i,a){
  const K=K_();
  if(K.ph!=='bet'||H.turn!==i||!canAct(i))return false;
  if(a.t==='fold'){K.st[i]=1;K.la[i]='폴드';addLog(`${nm(i)} 폴드`)}
  else if(a.t==='call')doCall(K,i);
  else if(a.t==='raise'){
    const R=raiseRange(K,i);
    if(!R.open){if(K.bet[i]+K.ch[i]<=K.cur){doCall(K,i)}else return false}
    else{
      let to=a.all?R.maxTo:rUp(+a.a||0);
      if(!(to>=R.minTo))to=R.minTo;   // 칩을 올리지 않았거나 모자라면 가장 적게
      to=Math.min(to,R.maxTo);
      const prev=K.cur,inc=to-prev;
      pay(K,i,to-K.bet[i]);
      if(inc>=K.minR){K.minR=inc;for(let j=0;j<K.st.length;j++)if(j!==i&&canAct(j)){K.acted[j]=false;K.ro[j]=true}}
      else for(let j=0;j<K.st.length;j++)if(j!==i&&canAct(j)&&K.acted[j])K.ro[j]=false;   // 모자란 올인: 이미 행동한 사람에게 레이즈를 다시 열지 않음
      K.cur=to;
      K.la[i]=K.ch[i]===0?'올인':prev===0?'베팅':'레이즈';
      addLog(`${nm(i)} ${K.la[i]} ${to}`);
    }
  }else return false;
  K.acted[i]=true;K.sq++;
  advance(i);
  return true;
}
function doCall(K,i){
  const need=K.cur-K.bet[i];
  if(need<=0){K.la[i]='체크';return}
  pay(K,i,need);K.la[i]=K.ch[i]===0?'올인':'콜';
}
/* 베팅 차례 끝: 건 칩을 팟으로 모으고 다음 공용 카드. 리버가 끝났으면 쇼다운 */
function endStreet(){
  const K=K_(),t=clock();
  H.turn=-1;H.botActAt=0;
  const moved=K.bet.some(b=>b>0);
  K.bet=K.bet.map(()=>0);K.cur=0;K.minR=K.bb;K.acted=K.acted.map(()=>false);K.ro=K.ro.map(()=>true);
  K.la=K.la.map((x,i)=>K.st[i]===1?'폴드':K.st[i]===2?'올인':'');
  if(live().length<2){winNoShow();return}
  // 더 걸 사람이 없으면 모든 카드를 펼치고 남은 공용 카드를 차례로 (처음 한 번)
  let open=0;if(!K.open&&runOut()){K.open=true;open=OPEN_MS;addLog('카드를 펼칩니다.','sys')}
  if(K.sr>=3){K.ph='run';K.nextAt=t+(moved?COLLECT_MS:0)+open+200;K.toShow=true;K.sq++;mark();return}
  K.sr++;
  K.deck.pop();   // 한 장 버리고
  if(K.sr===1)K.bd.push(K.deck.pop(),K.deck.pop(),K.deck.pop());else K.bd.push(K.deck.pop());
  K.ph='run';K.toShow=false;
  K.nextAt=t+(moved?COLLECT_MS:0)+open+(K.sr===1?FLOP_MS:CARD_MS)+(K.open?RUN_GAP:0);
  K.sq++;mark();
}
/* 팟 나누기: 낸 칩(tot)의 층마다 그 층까지 낸 사람끼리 겨룸(사이드 팟). 남는 칩(U 단위)은 버튼 왼쪽부터 */
function splitPots(K,score){
  const n=K.tot.length,ct=live(),lv=[...new Set(ct.map(i=>K.tot[i]))].sort((a,b)=>a-b),pots=[];
  let prev=0;
  lv.forEach((L,k)=>{
    let a=0;for(let j=0;j<n;j++)a+=Math.max(0,Math.min(K.tot[j],L)-prev);
    if(k===lv.length-1)for(let j=0;j<n;j++)a+=Math.max(0,K.tot[j]-L);   // 폴드한 사람이 더 낸 칩(드묾)도 마지막 팟에
    const el=ct.filter(i=>K.tot[i]>=L);
    if(a>0){
      const top=Math.max(...el.map(i=>score[i])),w=el.filter(i=>score[i]===top);
      pots.push({a,el,w,ret:el.length===1?1:0});
    }
    prev=L;
  });
  const won=Array(n).fill(0);
  for(const p of pots){
    const units=p.a/U|0,each=Math.floor(units/p.w.length)*U;let left=p.a-each*p.w.length;
    p.w.forEach(i=>{won[i]+=each});
    const ord=[];for(let k=1;k<=n;k++){const j=(K.bt+k)%n;if(p.w.includes(j))ord.push(j)}
    for(let k=0;left>0;k++){const g=Math.min(U,left);won[ord[k%ord.length]]+=g;left-=g}
  }
  return {pots,won};
}
function showdown(){
  const K=K_(),t=clock(),n=H.players.length,ct=live(),score=Array(n).fill(-1),bs={};
  for(const i of ct){const b=best([...K.hc[i],...K.bd]);score[i]=b.v;bs[i]={v:b.v,cat:b.cat,five:b.five,nm:handName(b)}}
  const {pots,won}=splitPots(K,score);
  const pot=potOf(K);
  won.forEach((x,i)=>{K.ch[i]+=x});K.tot=K.tot.map(()=>0);   // 팟은 정산 결과(rs)로 옮김
  K.rs={won,pot,pots:pots.map(p=>({a:p.a,w:p.w,ret:p.ret})),show:ct,best:bs};
  K.ph='show';H.turn=-1;H.botActAt=0;K.nextAt=t+SHOW_MS+Math.max(0,pots.filter(p=>!p.ret).length-1)*1200;
  const ws=[...new Set(pots.filter(p=>!p.ret).flatMap(p=>p.w))];
  addLog(`${ws.map(i=>`${nm(i)} ${bs[i].nm}`).join(' · ')} · 팟 ${pot}`,'sp');
  ws.forEach(i=>{const p=H.players[i];if(p.bot&&bs[i].cat>=5&&Math.random()<.5)botEmote(i,'lol',900+Math.random()*900)});
  K.sq++;mark();
}
/* 모두 폴드하고 한 명만 남음: 카드를 보이지 않고 팟을 가져감 */
function winNoShow(){
  const K=K_(),t=clock(),n=H.players.length,ls=live();
  H.turn=-1;H.botActAt=0;
  const moved=K.bet.some(b=>b>0);
  K.bet=K.bet.map(()=>0);K.cur=0;
  const won=Array(n).fill(0),pot=potOf(K);
  if(ls.length===1)won[ls[0]]=pot;
  won.forEach((x,i)=>{K.ch[i]+=x});K.tot=K.tot.map(()=>0);
  K.rs={won,pot,pots:ls.length===1?[{a:pot,w:[ls[0]],ret:0}]:[],show:[],best:{}};
  K.ph='show';K.nextAt=t+FOLD_WIN_MS+(moved?COLLECT_MS:0);
  if(ls.length===1)addLog(`${nm(ls[0])} 팟 ${pot}`,'sp');
  K.sq++;mark();
}
function endHand(){
  const K=K_();
  // 칩을 다 잃은 사람은 탈락 (이번 판을 적은 칩으로 시작한 사람이 아래 순위)
  const broke=H.players.map((p,i)=>i).filter(i=>alive(i)&&K.ch[i]<=0).sort((a,b)=>K.ch0[a]-K.ch0[b]||b-a);
  for(const i of broke){const p=H.players[i];p.finished=true;p.broke=true;p.hand=[];p.rank=H.rankBottom--;addLog(`${p.name} 칩이 떨어졌습니다.`,'lie')}
  const act=H.players.filter(p=>!p.finished).length;
  if(K.hn>=K.hns||act<2){endGame();return}
  newHand();
}
/* 게임 끝: 남은 사람은 칩이 많은 순서 (같으면 같은 순위) */
function endGame(){
  const K=K_();K.ph='end';H.turn=-1;H.botActAt=0;
  const rest=H.players.map((p,i)=>i).filter(alive);
  rest.forEach(i=>{const p=H.players[i];p.rank=H.rankNext+rest.filter(j=>K.ch[j]>K.ch[i]).length});
  rest.forEach(i=>{H.players[i].finished=true});
  addLog('게임 종료','sys');H.phase='over';K.sq++;mark();
  H.players.forEach((p,i)=>{if(p.bot&&Math.random()<.5)botEmote(i,'gg',800+Math.random()*1600)});
}
function doSurrender(i){
  if(H.phase!=='play'||i<0)return;
  const p=H.players[i],K=K_();if(!p||p.finished)return;
  p.finished=true;p.surrendered=true;p.hand=[];p.rank=H.rankBottom--;
  addLog(`${p.name} ${p.deserter?'탈주':'항복'}!`,'lie');
  if(K.st[i]===0||K.st[i]===2){K.st[i]=1;K.la[i]='폴드'}
  K.sq++;
  const inPlay=K.ph==='deal'||K.ph==='bet'||K.ph==='run'||K.ph==='intro';
  if(H.players.filter(x=>!x.finished).length<2){
    if(inPlay&&K.ph!=='intro'){const ls=live();if(ls.length===1){K.ch[ls[0]]+=potOf(K);K.tot=K.tot.map(()=>0);K.bet=K.bet.map(()=>0)}}
    endGame();return;
  }
  if(K.ph==='bet'){if(live().length<2){winNoShow();return}if(H.turn===i){advance(i);return}}
  mark();
}
/* ---------- 봇 (쉬움) ----------
   프리플랍은 두 장 점수, 그 뒤는 남은 상대 수만큼 몇백 번 끝까지 펼쳐 본 승률을 팟 오즈와 견줌. 무작위를 섞어 가끔 따라가고 가끔 블러핑 */
function preScore(a,b){
  let x=rv(a),y=rv(b);if(x<y)[x,y]=[y,x];
  let s=x===14?10:x===13?8:x===12?7:x===11?6:x/2;
  if(x===y)s=Math.max(5,s*2);
  else{const gap=x-y-1;s-=gap<=0?0:gap===1?1:gap===2?2:gap===3?4:5;if(gap<=1&&x<12)s+=1}
  if(suitOf(a)===suitOf(b))s+=2;
  return s;   // 대략 -1(7-2) ~ 20(A-A)
}
function equity(hole,board,opp,sims){
  const known=new Set([...hole,...board]),rest=[...Array(52).keys()].filter(x=>!known.has(x));
  let win=0;
  for(let s=0;s<sims;s++){
    const need=5-board.length+2*opp;
    for(let k=0;k<need;k++){const j=k+(Math.random()*(rest.length-k)|0);const t=rest[k];rest[k]=rest[j];rest[j]=t}
    const bd=board.concat(rest.slice(0,5-board.length));
    const me=score7([...hole,...bd]);
    let tie=0,lose=false;
    for(let o=0;o<opp;o++){const off=5-board.length+2*o,v=score7([rest[off],rest[off+1],...bd]);if(v>me){lose=true;break}if(v===me)tie++}
    if(!lose)win+=tie?1/(tie+1):1;
  }
  return win/sims;
}
function botPlay(i){
  const K=K_(),R=raiseRange(K,i),need=K.cur-K.bet[i],pot=potOf(K),r=Math.random();
  const opp=live().length-1,stack=K.ch[i];
  const raiseTo=x=>({t:'raise',a:rUp(Math.max(R.minTo,x))});
  let a;
  if(K.sr===0){
    const s=preScore(K.hc[i][0],K.hc[i][1]);
    if(s>=10&&R.open&&r<.6)a=raiseTo(K.cur+Math.max(K.minR,K.bb*(2+(Math.random()*2|0))));
    else if(s>=6)a=need<=Math.max(K.bb*3,stack*.15)||s>=10?{t:'call'}:{t:'fold'};
    else if(need<=0)a={t:'call'};
    else a=need<=K.bb&&r<.55?{t:'call'}:{t:'fold'};
  }else{
    const eq=equity(K.hc[i],K.bd,Math.max(1,opp),opp>3?110:180),odds=need>0?need/(pot+need):0;
    if(eq>.72&&R.open&&r<.55)a=raiseTo(K.cur+Math.max(K.minR,pot*(.4+Math.random()*.4)));
    else if(need<=0)a=R.open&&(eq>.55&&r<.35||r<.06)?raiseTo(pot*(.35+Math.random()*.3)):{t:'call'};
    else if(eq>odds+.05||(r<.08&&need<=pot*.5))a={t:'call'};
    else a={t:'fold'};
  }
  if(a.t==='raise'&&R.maxTo<=R.minTo&&r<.5&&K.sr===0&&preScore(K.hc[i][0],K.hc[i][1])<12)a=need<=0?{t:'call'}:{t:'fold'};   // 쉬움 봇은 올인이 되는 레이즈를 잘 안 함
  if(a.t==='fold'&&need<=0)a={t:'call'};   // 체크할 수 있으면 폴드하지 않음
  doAct(i,a);
}
G._test={eval5,best,score7,handName,splitPots,raiseRange,preScore,equity,doAct,newHand,startStreet,endStreet,showdown,winNoShow,endHand,live,U};
G.firstPick=true;   // 첫 딜러 버튼은 공통 룰렛(firstPick + roulette.js)으로 정함
const INTRO_LEAD=900,INTRO_REST=700;
G.introMs=(again,fast)=>Math.round(INTRO_LEAD+Roulette.planFor(2,0,fast).total+INTRO_REST);   // 정수 ms (방장 시계와 신호가 소수로 어긋나지 않게)
G.engine={
  start(){
    const n=H.players.length;
    H.players.forEach(p=>{p.hand=[0];p.broke=false});
    Object.assign(H,{phase:'play',log:[],seatNote:{},turn:-1,rankNext:1,rankBottom:n,graceUntil:0,botActAt:0,deadline:0});
    const sb=Math.max(U,rUp(+H.cfg.sb||10));
    H.pk={ph:'intro',hn:0,hns:Math.max(3,+H.cfg.rounds||10),up:Math.max(0,+H.cfg.up||0),sb,bb:sb*2,lv:0,bt:firstSeat(n),sbS:-1,bbS:-1,
      ch:Array(n).fill(Math.max(sb*4,rUp(+H.cfg.chips||1000))),ch0:[],st:Array(n).fill(3),bet:Array(n).fill(0),tot:Array(n).fill(0),la:Array(n).fill(''),
      hc:Array.from({length:n},()=>[]),bd:[],deck:[],dor:[],cur:0,minR:sb*2,acted:[],ro:[],open:false,rs:null,sr:0,sq:0,nextAt:0,toShow:false};
    addLog(`${n}명 게임 시작 · 칩 ${H.pk.ch[0]}개 · ${H.pk.hns}판 · 블라인드 ${sb}/${sb*2}`,'sys');
    mark();
  },
  act(seat,a){
    const K=H.pk;if(!K||!a)return;
    if(a.t==='surrender'){doSurrender(seat);return}
    if(H.phase!=='play'||seat<0||!alive(seat))return;
    if(a.t==='fold'||a.t==='call'||a.t==='raise')doAct(seat,a);
  },
  tick(t){
    const K=H.pk;if(H.phase!=='play'||!K)return;
    if(K.ph==='intro'){newHand();return}
    if(K.ph==='deal'){startStreet();return}
    if(K.ph==='bet'){
      const i=H.turn,p=H.players[i];
      if(!p||!canAct(i)){advance(i<0?K.bt:i);return}
      if(t>=H.deadline){const chk=K.bet[i]>=K.cur;addLog(`${p.name} 시간 초과 · ${chk?'체크':'폴드'}`,'sys');doAct(i,{t:chk?'call':'fold'})}
      else if(H.botActAt&&t>=H.botActAt&&canBot(p,t))botPlay(i);
      return;
    }
    if(K.ph==='run'&&t>=K.nextAt){if(K.toShow)showdown();else startStreet();return}
    if(K.ph==='show'&&t>=K.nextAt)endHand();
  },
  snap(s,you,t){
    const K=H.pk;if(!K)return;
    s.gr=0;s.dl=Math.max(0,Math.round(H.deadline-t));
    const shown=K.ph==='show'&&K.rs?K.rs.show:K.open?live():[];
    const hc=K.hc.map((h,i)=>i===you||shown.includes(i)?h.slice():h.map(()=>-1));   // 남의 카드는 엎은 채로 (펼친 카드만 보임)
    s.pk={ph:K.ph,hn:K.hn,hns:K.hns,sb:K.sb,bb:K.bb,lv:K.lv,bt:K.bt,sbS:K.sbS,bbS:K.bbS,ch:K.ch.slice(),bet:K.bet.slice(),tot:K.tot.slice(),st:K.st.slice(),la:K.la.slice(),
      bd:K.bd.slice(),hc,cur:K.cur,minR:K.minR,ro:you>=0&&K.ro[you]?1:0,op:K.open?1:0,rs:K.rs,sq:K.sq,sr:K.sr,dor:K.dor.slice()};
    if(K.ph==='bet'&&H.turn>=0&&H.phase==='play')s.t=H.turn;
    else if(K.ph==='intro')s.t=K.bt;   // 시작 연출: 룰렛이 멈출 자리(첫 딜러)
    else delete s.t;
  },
  restore(d){
    const K=H.pk;if(!K)return;
    if(K.nextAt)K.nextAt+=d;
  },
  emoPhase:ph=>ph==='play'||ph==='over'
};

/* ================= 화면 (모든 참가자) =================
   탁자는 둥근 그대로 두고 펠트 그림만 바꿈. 가운데 공용 카드 5칸, 그 앞(내 쪽)에 팟, 내 베팅 칸, 내 카드, 내 칩 더미.
   다른 사람은 맞은편 호(弧)를 따라 앉은 순서대로(폭은 화면에 들어오게 fitRx). 카드 위에는 글자를 두지 않음:
   내 족보·칩은 내 정보 칸, 다른 사람의 칩·마지막 행동·족보는 그 자리 바깥 이름표
   레이즈: 내 칩 더미를 누르면 한 개가 베팅 칸으로 날아가고, 베팅 칸을 누르면 마지막에 올린 칩이 돌아옴 → [레이즈] */
let ON=false,el2d=null,elBet=null,sentSq=-1,pend=[];
const BV=()=>V&&V.pk&&V.ps?V.pk:null;
const DEN=[10,50,100,500],DEN_C=['#cc3a2e','#2e7d4f','#2b2b2b','#6b3fa0'];
const sum=a=>a.reduce((x,y)=>x+y,0);
const betAmt=()=>sum(pend);
/* 내가 지금 할 일: act(내 차례) | wait | none */
function myMode(){
  const B=BV(),i=myIdx();if(!B||i<0||V.st!=='play'||!V.ps[i]||V.ps[i].f)return 'none';
  return B.ph==='bet'&&V.t===i&&B.st[i]===0?'act':'wait';
}
const busy=()=>{const B=BV();return !!B&&B.sq===sentSq};
const myCh=()=>{const B=BV(),i=myIdx();return B&&i>=0?B.ch[i]:0};
/* 내 레이즈 범위 (엔진 raiseRange와 같은 계산) */
function myRange(){
  const B=BV(),i=myIdx();if(!B||i<0)return null;
  const maxTo=B.bet[i]+B.ch[i],minTo=Math.min(B.cur+B.minR,maxTo);
  return {minTo,maxTo,open:!!B.ro&&maxTo>B.cur,need:Math.max(0,B.cur-B.bet[i])};
}
/* 레이즈 목표: 올린 칩이 없으면 가장 적게. bad = 최소보다 적게 올림(올인도 아님) */
function raiseTarget(){
  const R=myRange(),B=BV(),i=myIdx();if(!R)return null;
  const p=betAmt(),to=p>0?B.bet[i]+p:R.minTo;
  return {to:Math.min(to,R.maxTo),all:to>=R.maxTo,bad:p>0&&to<R.minTo&&to<R.maxTo,R};
}
function send(a){sendAct(a);const B=BV();sentSq=B?B.sq:-1;pend=[];renderButtons();renderMe();if(ON&&T.ok)syncChips()}
const canStage=()=>{const R=myRange();return myMode()==='act'&&!busy()&&myReady()&&!!R&&R.open};
/* 칩 올리기·내리기 (확정 전, 내 화면에서만) */
function addChip(d){
  if(!canStage()){if(myMode()==='act')sfx('no');return}
  if(betAmt()+d>myCh()){sfx('no');return}
  pend.push(d);sfxChip(1);if(ON&&T.ok)flyMine(d,true);renderMe();renderButtons();
}
function takeChip(){
  if(!canStage())return;
  if(!pend.length){sfx('no');return}
  const d=pend.pop();sfxChip(1);if(ON&&T.ok)flyMine(d,false);renderMe();renderButtons();
}
function stageAll(){
  if(!canStage()){if(myMode()==='act')sfx('no');return}
  pend=greedy(myCh());sfxChip(3);if(ON&&T.ok)syncChips();renderMe();renderButtons();
}
function doMove(k){
  const m=myMode();
  if(m!=='act'||!myReady()||busy()){if(m==='act')sfx('no');return}
  if(k==='fold'){send({t:'fold'});return}
  if(k==='call'){const R=myRange();if(R&&R.need>0)sfxChip(2);send({t:'call'});return}
  if(k==='raise'){
    const r=raiseTarget();if(!r||!r.R.open||r.bad){sfx('no');return}
    sfxChip(3);send(r.all?{t:'raise',all:1}:{t:'raise',a:r.to});
  }
}
function sfxChip(n){for(let k=0;k<(n||1);k++){tone(2600+k*180,.025,{type:'triangle',vol:.07,at:k*.055});tone(3900,.02,{type:'sine',vol:.035,at:k*.055+.012})}}
function setTxt(b,txt){const n=b.firstChild;if(n&&n.nodeType===3){if(n.nodeValue!==txt)n.nodeValue=txt}else b.insertBefore(document.createTextNode(txt),b.firstChild)}
G.buttons=()=>{
  const play=$('#btnPlay'),pass=$('#btnPass'),gb=$('#btnGura'),B=BV(),m=myMode(),rd=m==='act'&&myReady()&&!busy();
  const show=(el,on)=>{if(el.hidden===on)el.hidden=!on};
  const R=myRange(),i=myIdx();
  let main='체크',sub=keyLabel(KEYS.play),rTxt='레이즈',rOn=false,rShow=true;
  if(B&&R&&i>=0&&!V.ps[i].f&&B.st[i]===0){
    if(R.need>0){const c=Math.min(R.need,B.ch[i]);main=c>=B.ch[i]?'올인':'콜';sub=String(c)}
    const r=raiseTarget();
    if(r&&R.open){rTxt=(B.cur===0?'베팅':'레이즈')+' '+(r.all?'올인':r.to);if(r.bad)rTxt=`최소 ${R.minTo}`;rOn=rd&&!r.bad}
    else if(m==='act')rShow=false;   // 다시 올릴 수 없음 (모자란 올인 뒤)
  }else rShow=false;
  show(pass,true);show(gb,rShow);
  setTxt(pass,'폴드');setTxt(gb,rTxt);
  play.disabled=!rd;play.classList.toggle('ready',rd);pass.disabled=!rd;gb.disabled=!rOn;gb.classList.toggle('ready',false);
  if($('#playMain').textContent!==main)$('#playMain').textContent=main;
  if($('#playSub').textContent!==sub)$('#playSub').textContent=sub;
  if(elBet){const on=!T.ok&&rd&&!!R&&R.open;if(elBet.hidden===on)elBet.hidden=!on;if(on)renderBet()}
};
/* WebGL이 없을 때만 쓰는 2D 칩 버튼 */
function renderBet(){
  const v=elBet.querySelector('.pk-amt b'),a=betAmt(),mx=myCh(),t=String(a);
  if(v.textContent!==t)v.textContent=t;
  elBet.querySelectorAll('[data-add]').forEach(b=>{b.disabled=a+(+b.dataset.add)>mx});
  elBet.querySelector('[data-all]').disabled=a>=mx;
  elBet.querySelector('[data-clr]').disabled=!a;
}
G.play=()=>{doMove('call')};
G.pass=()=>{doMove('fold')};
G.keyPhase=st=>st==='play';
G.onKey=(act,e)=>{
  if(act==='gura'){if(!e.repeat)doMove('raise');return true}
  if(act==='bjUp'){const B=BV();if(B)for(const d of greedy(B.bb))addChip(d);return true}
  if(act==='bjDown'){takeChip();return true}
  if(act==='pkAll'){if(!e.repeat)stageAll();return true}
  return false;
};
G.handMarks=()=>{};
const sgn=x=>x>0?`+${x}`:x<0?`−${-x}`:'±0';
/* 지금 내 족보 (공용 카드가 3장 이상일 때, 프리플랍은 페어만) */
function curHand(cs,bd){
  if(cs.length<2||cs.some(x=>x<0))return '';
  if(bd.length<3)return rkOf(cs[0])===rkOf(cs[1])?'원 페어':'';
  return handName(best([...cs,...bd]));
}
const isWin=(B,i)=>!!(B.ph==='show'&&B.rs&&B.rs.won[i]>0&&B.rs.pots.some(p=>!p.ret&&p.w.includes(i)));
/* 정산 전 칩: 팟 칩이 도착하기 전에는 받은 만큼 빼고 보임 (결과가 연출을 앞지르지 않게) */
const shownCh=(B,i)=>B.ph==='show'&&B.rs&&!V3.landed.has(i)&&T.ok&&ON?B.ch[i]-(B.rs.won[i]||0):B.ch[i];
G.me=i=>{
  $('#numpick').hidden=true;placeSide();
  const B=BV(),p=V.ps[i];if(!B||!p)return;
  const ch=shownCh(B,i);
  if(p.f){if(!p.sr)$('#meSub').innerHTML=V.st==='over'?`<b>${+p.f}위</b> · 칩 <b>${B.ch[i]}</b>개`:'칩이 떨어졌습니다. 남은 판을 지켜봅니다.';return}
  const bt=B.bet[i]+(myMode()==='act'?betAmt():0),cs=B.hc[i]||[];
  const hn=B.st[i]===1?'폴드':curHand(cs,B.bd);
  const res=B.ph==='show'&&B.rs&&V3.landed.has(i)&&B.rs.won[i]>0?` <em class="w">+${B.rs.won[i]}</em>`:'';
  $('#meSub').innerHTML=`칩 <b>${Math.max(0,ch-(myMode()==='act'?betAmt():0))}</b>개${bt?` · 베팅 <b>${bt}</b>`:''}${hn?` · <span class="pk-me">${hn}</span>`:''}${res}`;
};
G.nameTag=()=>'';
G.overRank=p=>{const B=V&&V.pk,why=p.sr?(p.sr===2?'시간 초과':p.sr===3?'탈주':'항복'):'';return `<span class="left">${why?why+' · ':''}칩 ${B?B.ch[p.i]:0}개</span>`};
G.preView=()=>{
  const B=BV();if(!B)return;
  const fresh=!PV||!PV.pk||PV.pk.hn!==B.hn;
  if(myMode()!=='act'||(PV&&PV.pk&&(PV.pk.sr!==B.sr||PV.pk.cur!==B.cur)))pend=[];   // 내 차례가 아니거나 상황이 바뀌면 비움
  if(fresh&&B.hn>0&&V.st==='play')setTimeout(()=>{const b=BV();if(b&&b.hn===B.hn)handStart(b)},0);
};
G.postView=()=>{};
G.logCue=()=>false;
G.cues=(v,pv)=>{
  const A=v.pk,P=pv.pk;if(!A||!P||A.hn!==P.hn)return;
  const me=myIdx();
  const nb=A.bet.filter((b,i)=>b>(P.bet[i]||0)&&i!==me).length;if(nb)sfxChip(2);
  if(A.st.some((s,i)=>s===1&&P.st[i]!==1&&i!==me))tone(300,.08,{type:'triangle',vol:.05,slide:220});   // 누군가 폴드
  if(A.ph==='show'&&P.ph!=='show'&&me>=0&&A.rs&&(A.rs.show.includes(me)||A.rs.won[me]>0||A.st[me]!==3)){
    const won=A.rs.won[me]||0,lost=A.tot[me]||P.tot[me]||0;
    setTimeout(()=>{if(won>0)sfx(A.rs.show.length?'finish':'truth');else if(P.st[me]!==1&&P.st[me]!==3)tone(330,.18,{vol:.1,slide:250})},A.rs.show.length?900:300);
  }
};

/* ---------- 탁자 배치 (월드 좌표, 나는 +z 쪽) ---------- */
const O={x:0,z:0};                     // 공용 카드 가운데 = 탁자 정중앙
const BD_DX=.66,S_BD=.74,POT={x:0,z:.86},DECK={x:0,z:-.92};
const MY={x:0,z:2.1},MYBET={x:0,z:1.44},BANK_Z=3.45,BANK_X=[-.75,-.25,.25,.75],CHIP_R=.2,CHIP_H=.052;   // 내 카드는 다른 사람과 같은 거리(둘레), 칩 더미는 펠트 밖 나무 띠 위 내 앞
const CW=.62*1.2,CH=.9*1.2;            // 카드 폭·높이 (크기 1일 때)
const S_ME=.82,S_OT=.58,S_SHOW=.7,RZ=2.25;
let SP=new Map(),spKey='',RX=2.9;
/* 다른 사람의 자리: 나를 아래(0°)로 두고 탁자 둘레를 인원 수만큼 똑같이 나눈 각도(360°/인원)에 앉은 순서대로. 관전 중이면 내 앞자리를 비움(seatAngle) */
function arcPos(th,rx){return {x:O.x+Math.sin(th)*rx,z:O.z-Math.cos(th)*RZ}}
function seatList(){const me=myIdx();return V.ps.map((_,i)=>i).filter(i=>i!==me).sort((a,b)=>seatAngle(a)-seatAngle(b))}
function thetas(list){const out=new Map();list.forEach(i=>out.set(i,Math.PI-seatAngle(i)));return out}
/* 화면 폭에 맞춘 둘레의 가로 반지름: 모든 자리(카드 + 이름표)가 화면 안에 들어오게 (내 쪽 자리는 가까워 더 넓게 보이므로 모두 잼) */
function fitRx(ths,cam){
  if(!T.ok||!cam)return 2.9;
  const v=new THREE.Vector3(),side=[...ths.values()].filter(th=>Math.abs(Math.sin(th))>.05),hw=seatHW()+.1;
  for(let rx=2.95;rx>=1.3;rx-=.05)if(side.every(th=>{const p=arcPos(Math.abs(th),rx);v.set(p.x+hw,0,p.z).project(cam);return v.x<=.94}))return rx;
  return 1.3;
}
function layout(){
  const me=myIdx(),st=$('#stage'),W=st.clientWidth,Hh=st.clientHeight,c=T.cam?T.cam.position:{x:0,y:0,z:0};
  const key=V.ps.length+'|'+me+'|'+W+'x'+Hh+'|'+PK_EL+'|'+PK_FL+'|'+PK_D+'|'+[c.x,c.y,c.z].map(x=>x.toFixed(1)).join(',');
  if(key===spKey)return SP;spKey=key;NAR=W<Hh;
  const list=seatList(),ths=thetas(list);RX=fitRx(ths,T.ok&&T.cam?camTarget(W,Hh):null);
  SP=new Map();
  for(const i of list){
    const th=ths.get(i),p=arcPos(th,RX);
    if(Math.abs(p.x-O.x)<BOARD_HX+seatHW()&&Math.abs(p.z-O.z)<.85)p.z=O.z-.9;   // 좁은 화면: 양옆 자리가 공용 카드 높이에 걸치면 공용 카드 위쪽으로
    const dx=O.x-p.x,dz=O.z-p.z,dl=Math.hypot(dx,dz)||1;
    SP.set(i,{x:p.x,z:p.z,th,ry:Math.atan2(-dx/dl,-dz/dl),ux:dx/dl,uz:dz/dl,   // 카드 위쪽이 탁자 중심을 향함
      bet:offBoard({x:p.x+dx/dl*.68,z:p.z+dz/dl*.68})});
  }
  if(me>=0)SP.set(me,{x:MY.x,z:MY.z,th:0,ry:0,ux:0,uz:-1,bet:MYBET,me:true});
  V3.ringsKey='';
  return SP;
}
const betPos=i=>(SP.get(i)||{bet:POT}).bet;
/* 카드 자리: 나는 크게 두 장 나란히, 다른 사람은 작게 살짝 겹쳐(세로 화면은 둘째 장이 첫 장의 왼쪽 위 숫자만 남기고 덮음). 공용 카드는 가운데 한 줄 */
let NAR=false;   // 세로 화면 (layout에서 정함)
const OVL=.38;   // 세로 화면에서 다른 사람 카드 두 장의 간격 (카드 폭 .62×크기에 곱함)
const seatHW=()=>(CW*S_OT+.62*S_OT*(NAR?OVL:1.08))/2;   // 다른 사람 카드 두 장의 반폭
function cardPose(seat,k,show){
  if(seat<0)return {x:O.x+(k-2)*BD_DX,y:.02,z:O.z,ry:0,s:S_BD};
  const S=SP.get(seat);if(!S)return {x:DECK.x,y:.4,z:DECK.z,ry:0,s:.4};
  const ov=NAR&&!S.me&&!show,s=S.me?S_ME:show?S_SHOW:S_OT,gap=.62*s*(ov?OVL:1.08),o=(k-.5)*gap,tx=-S.uz,tz=S.ux,inw=show&&!S.me?.32:0;   // 자리에서 본 옆으로 겹치지 않게 나란히(카드 폭 .62×크기). 펼친 카드는 크게, 안쪽으로
  return {x:S.x+tx*o+S.ux*inw,y:.02+(ov?k*.004:0),z:S.z+tz*o+S.uz*inw,ry:S.ry,s};
}

/* ---------- 3D ---------- */
const V3={toBet:0,toBank:0,cards:new Map(),flights:[],piles:new Map(),pot:null,potAmt:-1,potPend:0,bank:null,rings:new Map(),ringsKey:'',arc:null,arcQ:-1,arcSeat:-2,root:null,deck:null,btn:null,btnAt:null,hk:-1,awarded:-1,landed:new Set(),felt:null,mats:null,bounceAt:-1e9,lift:new Set()};
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
  const n=[0,0,0,0];let r=Math.floor(a/U)*U;
  n[0]=(r%50)/10;r-=n[0]*10;if(r>=50&&n[0]<5){n[0]+=5;r-=50}
  n[1]=(r%100)/50;r-=n[1]*50;if(r>=100&&n[1]<2){n[1]+=2;r-=100}
  n[2]=(r%500)/100;r-=n[2]*100;if(r>=500&&n[2]<5){n[2]+=5;r-=500}
  n[3]=r/500;return n;
}
/* 섞인 칩 기둥 (베팅·팟): 14개마다 옆 기둥, 가운데 맞춤 */
function pileGroup(amt){
  const g=new THREE.Group(),cs=greedy(amt),cols=Math.ceil(cs.length/14);
  cs.forEach((d,k)=>{const m=chipMesh(d),col=k/14|0,row=k%14;m.position.set((col-(cols-1)/2)*.42,CHIP_H/2+row*CHIP_H,(col%2)*.06);m.rotation.y=k*.9;g.add(m)});
  g.userData.n=cs.length;T.scene.add(g);return g;
}
/* 종류별로 세운 칩 기둥 4개 (내 칩 더미) */
function stackGroup(amt){
  const g=new THREE.Group(),n=change(amt);
  n.forEach((c,k)=>{for(let j=0;j<Math.min(c,40);j++){const m=chipMesh(DEN[k]),col=j/12|0,row=j%12;m.position.set(BANK_X[k],CHIP_H/2+row*CHIP_H,BANK_Z+col*.44);m.rotation.y=j*.7;g.add(m)}});
  g.userData.n=n;T.scene.add(g);return g;
}
const topY=n=>Math.min(n,14)*CHIP_H+.02;
function killG(g){if(g&&g.parent)g.parent.remove(g)}
/* 날아가는 물건 */
function fly(obj,from,to,ms,at,arc,done){obj.position.set(from.x,from.y,from.z);obj.visible=at<=clock();V3.flights.push({obj,from,to,ms,at,arc,done})}
function setPile(i,amt){
  let P=V3.piles.get(i);const pos=betPos(i);
  if(P&&P.amt===amt&&P.g){if(!P.flying)P.g.position.set(pos.x,0,pos.z);return P}
  if(P)killG(P.g);
  P={amt,g:amt>0?pileGroup(amt):null};
  if(P.g)P.g.position.set(pos.x,0,pos.z);
  V3.piles.set(i,P);return P;
}
/* 내 칩 하나가 더미 ↔ 베팅 칸으로. 떠나는 쪽은 바로 빼고, 받는 쪽은 도착하면 채움(잔상 없음) */
function flyMine(d,toBet){
  const me=myIdx(),bp=betPos(me),k=DEN.indexOf(d),bn=(V3.bank&&V3.bank.userData.n[k])||0;
  const bank={x:BANK_X[k],y:topY(Math.min(12,bn+(toBet?1:0))),z:BANK_Z};
  const P=V3.piles.get(me),pn=P&&P.g?P.g.userData.n:0,pile={x:bp.x,y:topY(pn+(toBet?0:1)),z:bp.z};
  if(toBet)V3.toBet+=d;else V3.toBank+=d;
  const m=chipMesh(d);T.scene.add(m);
  fly(m,toBet?bank:pile,toBet?pile:bank,230,clock(),.32,()=>{killG(m);if(toBet)V3.toBet=Math.max(0,V3.toBet-d);else V3.toBank=Math.max(0,V3.toBank-d);syncChips()});
  syncChips();
}
const homeOf=i=>{const S=SP.get(i);if(!S)return {x:0,y:.3,z:0};return S.me?{x:0,y:.3,z:BANK_Z}:{x:S.x,y:.25,z:S.z}};
/* 팟 금액: 베팅 차례 중이면 지난 차례까지 모인 칩, 정산 중이면 정산 전 팟. 날아오는 중인 칩은 도착하면 더함 */
function potTarget(B){return B.ph==='show'&&B.rs?(V3.awarded===B.hn?0:B.rs.pot):sum(B.tot)-sum(B.bet)}
function syncChips(){
  const B=BV();if(!B||!T.ok)return;
  const me=myIdx();
  if(me>=0&&!V.ps[me].f){
    const a=Math.max(0,shownCh(B,me)-(myMode()==='act'?betAmt():0)-V3.toBank),key=change(a).join(',');
    if(!V3.bank||V3.bank.userData.key!==key){killG(V3.bank);V3.bank=stackGroup(a);V3.bank.userData.key=key}
  }else if(V3.bank){killG(V3.bank);V3.bank=null}
  const now=clock();
  for(const i of SP.keys()){
    const amt=B.ph==='show'?0:i===me&&myMode()==='act'?B.bet[i]+Math.max(0,betAmt()-V3.toBet):B.bet[i]||0;
    const P=V3.piles.get(i);
    if(P&&P.flying)continue;
    if(P&&P.g&&amt<P.amt&&amt===0){   // 베팅 차례가 끝남: 팟으로 모임
      const g=P.g,a=P.amt;V3.piles.delete(i);V3.potPend+=a;
      fly(g,{x:g.position.x,y:0,z:g.position.z},{x:POT.x,y:.05,z:POT.z},COLLECT_MS-80,now,.25,()=>{killG(g);V3.potPend=Math.max(0,V3.potPend-a);syncChips()});
      continue;
    }
    if(i!==me&&amt>(P?P.amt:0)){   // 다른 사람이 걸면 그 사람 자리에서 날아옴
      const bp=betPos(i),g=pileGroup(amt),h=homeOf(i);if(P)killG(P.g);
      const NP={amt,g,flying:true};V3.piles.set(i,NP);
      fly(g,{x:h.x,y:.3,z:h.z},{x:bp.x,y:0,z:bp.z},380,now,.4,()=>{NP.flying=false});
      continue;
    }
    setPile(i,amt);
  }
  for(const [i,P] of V3.piles)if(!SP.has(i)){killG(P.g);V3.piles.delete(i)}
  // 팟
  const pa=Math.max(0,potTarget(B)-V3.potPend);
  if(pa!==V3.potAmt){killG(V3.pot);V3.pot=pa>0?pileGroup(pa):null;if(V3.pot)V3.pot.position.set(POT.x,0,POT.z);V3.potAmt=pa}
  // 정산: 모인 팟이 이긴 사람에게 (나누면 나눠서)
  if(B.ph==='show'&&B.rs&&V3.awarded!==B.hn&&V3.potPend===0&&![...V3.piles.values()].some(P=>P.g)&&now>=V3.showAt){
    V3.awarded=B.hn;killG(V3.pot);V3.pot=null;V3.potAmt=0;
    const ws=B.rs.won.map((x,i)=>[i,x]).filter(([,x])=>x>0);
    if(!ws.length)return;
    ws.forEach(([i,x],k)=>{
      const g=pileGroup(x),h=homeOf(i);
      fly(g,{x:POT.x,y:0,z:POT.z},h,640,now+k*140,.45,()=>{killG(g);V3.landed.add(i);if(i===me){syncChips();renderMe()}});
    });
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
/* ---------- 카드 움직임: 직접 그림 (블랙잭과 같은 방식) ----------
   날아가는 동안 위로 뜨는 곡선, 뒤집기는 카드의 긴 축으로 넘기고 뒤집히는 만큼 떠 있게 */
const _qa=window.THREE?new THREE.Quaternion():null,_qb=window.THREE?new THREE.Quaternion():null,_ax=window.THREE?{x:new THREE.Vector3(1,0,0),y:new THREE.Vector3(0,1,0)}:null;
const wrapA=a=>{while(a>Math.PI)a-=2*Math.PI;while(a<=-Math.PI)a+=2*Math.PI;return a};
function cardSet(e,to,ms,lift){
  const T0=e.to;if(T0&&['x','y','z','ry','s','f','tl'].every(k=>Math.abs(T0[k]-to[k])<1e-4)&&!to.die===!T0.die&&!to.hand===!T0.hand)return;
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
  if(k>=1&&Bt.hand&&!e.inHand){e.inHand=true;e.g.visible=false;syncHand()}   // 손패에 닿으면 3D 카드는 숨기고 2D 손패에
  if(k>=1){e.tw=null;if(Bt.die){killCard(e.g);if(Bt.keep)e.gone=true;else V3.cards.delete(e.key)}}   // keep: 폴드한 카드는 사라져도 목록에 남겨 다시 만들지 않음
}
/* ---------- 펠트 무늬·덱·딜러 버튼 ---------- */
function feltTex(){
  if(V3.felt)return V3.felt;
  const W=1024,R=3.15,k=W/(2*R);
  return V3.felt=canvasTex(W,W,(g,w,h)=>{
    const gr=g.createRadialGradient(w/2,h/2,80,w/2,h/2,w/2);gr.addColorStop(0,'#4f9e6e');gr.addColorStop(1,'#2f7550');g.fillStyle=gr;g.fillRect(0,0,w,h);
    // 월드 좌표(x, z)로 그림: 원통 윗면 UV는 u←z, v←x. 글자 없이 공용 카드 자리 다섯 칸과 금색 테두리만
    g.setTransform(0,-k/100,k/100,0,w/2,h/2);
    const cw=CW*S_BD*100,chh=CH*S_BD*100;
    g.strokeStyle='rgba(255,250,240,.28)';g.lineWidth=2.2;
    for(let j=0;j<5;j++){const x=(O.x+(j-2)*BD_DX)*100,z=O.z*100;rr(g,x-cw/2-4,z-chh/2-4,cw+8,chh+8,9);g.stroke()}
    g.strokeStyle='rgba(242,193,78,.7)';g.lineWidth=2.6;rr(g,(O.x-2*BD_DX)*100-cw/2-16,O.z*100-chh/2-16,4*BD_DX*100+cw+32,chh+32,22);g.stroke();
    g.setTransform(1,0,0,1,0,0);
    g.strokeStyle='rgba(255,250,240,.5)';g.lineWidth=6;g.beginPath();g.arc(w/2,h/2,488,0,7);g.stroke();
    g.strokeStyle='rgba(242,193,78,.55)';g.lineWidth=3;g.beginPath();g.arc(w/2,h/2,470,0,7);g.stroke();
  });
}
function useFelt(on){
  if(!T.ok||!T.felt)return;
  const m=T.felt.mat.material[1],want=on?feltTex():T.felt.tex;
  if(m.map!==want){m.map=want;m.needsUpdate=true}
}
function buildRoot(){
  if(!T.ok||V3.root)return;
  const root=new THREE.Group();T.scene.add(root);V3.root=root;
  // 덱: 공용 카드 맞은편에 엎은 카드 더미
  const dark=toon({color:0x3a3430,rim:.2}),dg=new THREE.Group();dg.position.set(DECK.x,0,DECK.z);root.add(dg);
  const st=new THREE.Mesh(new THREE.BoxGeometry(CW*.55,.12,CH*.55),[dark,dark,T.back,dark,dark,dark]);st.position.y=.06;st.castShadow=true;dg.add(st);
  V3.deck=dg;
  // 딜러 버튼: 흰 원판에 D
  const top=canvasTex(128,128,(g,w,h)=>{g.fillStyle='#fffaf0';g.beginPath();g.arc(64,64,64,0,7);g.fill();g.strokeStyle='#3b2a1f';g.lineWidth=6;g.beginPath();g.arc(64,64,52,0,7);g.stroke();g.fillStyle='#3b2a1f';g.font='bold 70px "Jua", sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText('D',64,70)});
  const side=toon({color:0xf4ead9,rim:.2}),tm=toon({map:top,rim:0});
  const b=new THREE.Mesh(new THREE.CylinderGeometry(.17,.17,.06,32),[side,tm,tm]);b.castShadow=true;b.position.y=.03;
  const bg=new THREE.Group();bg.add(b);hull(new THREE.CylinderGeometry(.185,.185,.075,32),b,bg);bg.visible=false;root.add(bg);V3.btn=bg;V3.btnAt=null;
}
/* 베팅 칸이 공용 카드 칸에 걸치면 위아래로 비킴 (좁은 화면에서 양옆 자리가 가운데로 모일 때) */
const BOARD_HX=2*BD_DX+CW*S_BD/2;   // 공용 카드 줄의 반폭
function offBoard(p){
  const hx=BOARD_HX+.25,hz=CH*S_BD/2+.25;
  if(Math.abs(p.x-O.x)<hx&&Math.abs(p.z-O.z)<hz)p.z=O.z+(p.z>=O.z?hz:-hz);
  return p;
}
/* 딜러 버튼 자리: 그 사람 카드 옆 (내 것은 오른쪽 앞) */
function btnPos(i){
  const S=SP.get(i);if(!S)return null;
  if(S.me)return {x:.78,z:1.75};
  const tx=-S.uz,tz=S.ux,sd=S.th>=0?-1:1;   // 탁자 안쪽(화면 가운데) 쪽으로
  return {x:S.x+tx*.48*sd+S.ux*.2,z:S.z+tz*.48*sd+S.uz*.2};
}
/* 링: 차례 시간(지금 차례인 사람의 베팅 칸 둘레, 줄어듦)과 룰렛·차례 표시(카드 자리 둘레) */
function ringMesh(r0,r1,col,op){
  const m=new THREE.Mesh(new THREE.RingGeometry(r0,r1,48),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:op,depthWrite:false}));
  m.rotation.x=-Math.PI/2;return m;
}
function spotRing(i){
  let r=V3.rings.get(i);
  if(!r){const S=SP.get(i)||{};r=ringMesh(S.me?.62:.42,S.me?.68:.47,0xf2c14e,.9);T.scene.add(r);V3.rings.set(i,r)}
  const S=SP.get(i);if(S){r.position.set(S.x,.021,S.z)}
  return r;
}
function turnTimer(now){
  const B=BV(),i=V&&V.t,on=!!(B&&B.ph==='bet'&&V.st==='play'&&i>=0&&SP.has(i)&&!dealingV()&&!busy());
  if(!on){if(V3.arc)V3.arc.visible=false;return}
  const frac=Math.max(0,Math.min(1,(V.deadAt-now)/((+V.cfg.turn||30)*1000))),q=Math.round(frac*200)/200;
  const mine=i===myIdx(),r0=mine?.36:.3,r1=mine?.42:.35;
  if(!V3.arc){V3.arc=new THREE.Mesh(new THREE.RingGeometry(r0,r1,64),new THREE.MeshBasicMaterial({color:0xf2b632,side:THREE.DoubleSide,transparent:true,depthWrite:false}));V3.arc.rotation.x=-Math.PI/2;T.scene.add(V3.arc);V3.arcQ=-1}
  if(q!==V3.arcQ||V3.arcSeat!==i){V3.arcQ=q;V3.arcSeat=i;V3.arc.geometry.dispose();V3.arc.geometry=new THREE.RingGeometry(r0,r1,64,1,Math.PI/2,Math.max(.001,q*Math.PI*2))}
  const p=betPos(i);V3.arc.position.set(p.x,.023,p.z);V3.arc.visible=true;
  V3.arc.material.color.set(frac<.25?0xcc3a2e:0xf2b632);
}
function clear3D(){
  for(const e of V3.cards.values())killCard(e.g);V3.cards.clear();
  for(const f of V3.flights)killG(f.obj);V3.flights=[];
  for(const P of V3.piles.values())killG(P.g);V3.piles.clear();
  killG(V3.bank);V3.bank=null;killG(V3.pot);V3.pot=null;V3.potAmt=-1;V3.potPend=0;
  for(const r of V3.rings.values())killG(r);V3.rings.clear();
  if(V3.arc){killG(V3.arc);V3.arc=null}
  killG(V3.root);V3.root=null;V3.deck=V3.btn=null;V3.btnAt=null;
  V3.hk=-1;V3.awarded=-1;V3.landed.clear();V3.toBet=V3.toBank=0;spKey='';IN.on=false;
  useFelt(false);
}
/* 쇼다운: 이긴 사람의 5장을 살짝 들어 올리고 금색 테두리 (카드 뒤에 조금 큰 판) */
let GLOW_MAT=null;
function glow(e,on){
  if(!on&&!e.glow)return;
  if(!e.glow){GLOW_MAT=GLOW_MAT||new THREE.MeshBasicMaterial({color:0xf2b632});const m=new THREE.Mesh(new THREE.PlaneGeometry(.62*1.14,.9*1.1),GLOW_MAT);m.position.z=-.006;e.g.add(m);e.glow=m}
  e.glow.visible=on;
}
function liftSet(B){
  const s=new Set();if(B.ph!=='show'||!B.rs||!B.rs.best)return s;
  for(const p of B.rs.pots)if(!p.ret)for(const w of p.w){const b=B.rs.best[w];if(b)b.five.forEach(id=>s.add(id))}
  return s;
}
function sync3(v){
  const B=v.pk;if(!B||!T.ok)return;
  layout();buildRoot();useFelt(true);
  const me=myIdx(),now=clock();
  if(V3.hk!==B.hn){
    for(const P of V3.piles.values())killG(P.g);V3.piles.clear();V3.landed.clear();V3.potPend=0;V3.hk=B.hn;V3.toBet=V3.toBank=0;
    killG(V3.pot);V3.pot=null;V3.potAmt=-1;
  }
  if(B.ph==='show'&&V3.showFor!==B.hn){V3.showFor=B.hn;V3.showAt=now+(B.rs&&B.rs.show.length?1500:450)}   // 카드를 펼친 뒤 팟이 감
  const lift=liftSet(B);
  const want=new Map();
  if(B.hn>0){
    V.ps.forEach((_,i)=>{const h=B.hc[i]||[];if(B.st[i]===3||!h.length)return;h.forEach((id,k)=>want.set(B.hn+':'+i+':'+k,{seat:i,k,id}))});
    B.bd.forEach((id,k)=>want.set(B.hn+':b:'+k,{seat:-1,k,id}));
  }
  const dk={x:DECK.x,z:DECK.z};
  for(const [key,e] of V3.cards){   // 지난 판 카드는 엎어서 덱으로
    if(e.gone&&!want.has(key)){V3.cards.delete(key);continue}
    if(want.has(key)||e.dying)continue;
    if(!e.launched){killCard(e.g);V3.cards.delete(key);continue}
    e.dying=true;if(e.inHand){e.inHand=false;e.g.visible=true}   // 내 카드는 손패 자리에서 다시 나타나 덱으로
    cardSet(e,{x:dk.x,y:.3,z:dk.z,ry:0,s:.4,f:0,tl:0,die:true},460,.3);
  }
  // 처음 나누기: 스몰 블라인드부터 한 장씩 두 바퀴 (엔진과 같은 순서). 공용 카드는 모인 칩이 팟에 닿은 뒤 한 장씩
  const dealing=dealingV(),start=dealing?V.dealAt-(+v.dm||0):0,nOrd=Math.max(1,B.dor.length);
  let bdNew=0;
  for(const [key,c] of want){
    let e=V3.cards.get(key);
    if(e&&e.gone)continue;
    if(!e&&c.seat>=0&&c.seat!==me&&B.st[c.seat]===1)continue;   // 이미 폴드한 사람의 카드는 새로 만들지 않음 (늦게 들어온 사람)
    if(!e){
      const g=makeCard(new THREE.Vector3(dk.x,.4,dk.z),Math.PI/2,0,.4);g.userData.man=true;g.visible=false;
      let at=now;
      if(c.seat>=0&&dealing){const pos=Math.max(0,B.dor.indexOf(c.seat));at=start+250+(c.k*nOrd+pos)*DEAL_PER}
      else if(c.seat<0){const pv=PV&&PV.pk&&PV.pk.hn===B.hn?PV.pk:null;at=now+(pv&&pv.bet.some(b=>b>0)?COLLECT_MS:0)+(B.op&&pv&&!pv.op?OPEN_MS:0)+bdNew*170;bdNew++}   // 모인 칩이 팟에 닿고, 카드를 펼친 뒤
      e={key,g,id:null,at,launched:false,cur:{x:dk.x,y:.42,z:dk.z,ry:0,s:.4,f:0,tl:0},to:null,tw:null};V3.cards.set(key,e);
    }
    if(c.id>=0&&e.id!==c.id){e.g.children[0].material=faceMat(c.id);e.id=c.id}
    const P=cardPose(c.seat,c.k,c.id>=0&&c.seat!==me),folded=c.seat>=0&&B.st[c.seat]===1,up=c.id>=0&&!folded,L=c.id>=0&&lift.has(c.id)?.09:0;
    if(c.seat===me&&c.seat>=0){cardSet(e,{...handPose(c.k),f:c.id>=0?1:0},300,.2);continue}   // 내 카드: 화면 아래 손패로 날아가 들어감
    if(folded&&c.seat!==me){cardSet(e,{x:dk.x+(c.k-.5)*.1,y:.05,z:dk.z,ry:.3*(c.k?1:-1),s:.4,f:0,tl:0,die:true,keep:true},420,.25);continue}   // 폴드한 카드는 덱 쪽으로 모음
    glow(e,!!L&&up);
    const flip=e.to&&e.to.f!==(up?1:0);
    cardSet(e,{x:P.x,y:P.y+L+(folded?-.01:0),z:P.z-(L?.06:0),ry:P.ry,s:P.s*(folded?.88:1),f:up?1:0,tl:0},flip?420:300,flip?.32:.14);
  }
  syncRingsIntro(now);
  // 딜러 버튼
  if(V3.btn&&(B.hn>0||(IN.on&&IN.said))){const p=btnPos(B.bt);if(p){
    if(!V3.btnAt){V3.btnAt={x:p.x,z:p.z};V3.btn.position.set(p.x,0,p.z)}
    if(Math.hypot(V3.btnAt.x-p.x,V3.btnAt.z-p.z)>1e-3){fly(V3.btn,{x:V3.btn.position.x,y:0,z:V3.btn.position.z},{x:p.x,y:0,z:p.z},520,now,.3,null);V3.btnAt={x:p.x,z:p.z}}
    V3.btn.visible=true}}
  syncChips();
}
function frame3(now){
  for(const e of [...V3.cards.values()]){
    if(!e.launched&&now>=e.at&&e.to){e.launched=true;e.g.visible=true;e.tw={from:{...e.cur},to:e.to,t0:now,ms:e.to.f?460:400,lift:.38};sfx('flick')}
    if(e.launched)cardStep(e,now);
  }
  frameFlights(now);turnTimer(now);introFrame(now);syncHand();
  if(V3.bank){const a=now-V3.bounceAt;V3.bank.position.y=a>=0&&a<520?Math.abs(Math.sin(a/520*Math.PI*2))*.09*(1-a/520):0}
  if(ON&&BV()&&BV().ph==='show'&&V3.awarded!==BV().hn&&now>=V3.showAt)syncChips();
}
/* ---------- 내 카드: 2D 손패 (다른 카드 게임처럼 화면 아래 가운데) ----------
   3D 카드는 덱에서 화면 아래(손패 자리 앞)로 날아가 닿으면 숨고 2D 손패에 나타남. 새 판이면 그 자리에서 다시 나타나 덱으로 */
let elHand=null;
const handK=()=>{const st=$('#stage'),W=st.clientWidth,Hs=st.clientHeight||W;return Math.max(Hs<600?.8:1,Math.min(1.8,Math.min(Hs/677,W/460)))};   // 공통 손패와 같은 크기
const HAND_W=104,HAND_H=112;   // 손패가 차지하는 폭·높이(크기 1일 때, 카드 60×88 두 장 + 아래 여백). 카메라는 이만큼 화면 아래를 비워 둠
const handPose=k=>({x:(k-.5)*.4,y:.5,z:BANK_Z+.75,ry:0,s:.6,tl:0,hand:true});
const handOn=()=>{const B=BV(),me=myIdx();return !!(B&&T.ok&&gameOn()&&me>=0&&!V.ps[me].f)};
function syncHand(){
  if(!elHand)return;
  const B=BV(),me=myIdx(),on=handOn()&&B.hn>0,ids=[];
  if(on)(B.hc[me]||[]).forEach((id,k)=>{const e=V3.cards.get(B.hn+':'+me+':'+k);if(id>=0&&e&&e.inHand)ids.push(id)});
  const fold=on&&B.st[me]===1,lift=on?liftSet(B):new Set(),key=ids.map(id=>id+(lift.has(id)?'w':'')).join(',')+'|'+fold;
  if(elHand.dataset.k!==key){elHand.innerHTML=ids.map(id=>cardEl(id).replace('class="card pkc"','class="card pkc'+(lift.has(id)?' win':'')+'"')).join('');elHand.dataset.k=key;elHand.classList.toggle('fold',fold)}
  elHand.hidden=!ids.length;elHand.style.setProperty('--k',handK());
}
/* 손패 옆(넓으면)이나 위(좁으면)에 내 정보 칸·버튼: 공통 layoutFan과 같은 규칙 (공통 손패는 비어 있어 구석으로 보내므로 여기서 고침) */
function placeSide(){
  const st=$('#stage');if(!handOn())return;
  const W=st.clientWidth,Hs=st.clientHeight,k=handK(),hw=HAND_W*k,hh=HAND_H*k;
  const pc=W>=900&&Hs>=600&&!(window.matchMedia&&matchMedia('(pointer:coarse)').matches),aS=pc?Math.max(1,Math.min(1.3,k*.8)):1;
  const aW=($('#actions').offsetWidth||0)*aS,mW=$('#me').offsetWidth||0,side=Math.max(mW,aW)+24,wide=W-hw>=2*side+16;
  let aR=14,mL=12;if(pc&&wide){aR=Math.max(14,Math.round(W/2-hw/2-28-aW));mL=Math.max(12,Math.round(W/2-hw/2-28-mW))}
  st.style.setProperty('--actR',aR+'px');st.style.setProperty('--plateL',mL+'px');st.style.setProperty('--actS',aS);
  st.style.setProperty('--plateB',(wide?14:Math.round(hh)+60)+'px');st.style.setProperty('--actB',(wide?14:Math.round(hh))+'px');
}

/* ---------- 카메라: 가로 화면은 공통 카메라 그대로, 세로 화면은 더 위에서(PK_EL) 내려다봄 (위아래 빈 곳이 줄어듦) ----------
   크기·각도가 바뀌거나 게임이 시작되면 그때 보이던 카메라에서 미끄러지듯 옮김 */
let PK_EL=60,PK_FL=50,PK_D=6.5;   // 세로 화면 카메라 각도(도, 공통 37)·초점 거리(mm, 클수록 망원)·거리. 테스트룸(lab-poker.html)에서 바꿔 봄
G.labCam=o=>{if(o.el!=null)PK_EL=+o.el;if(o.fl!=null)PK_FL=+o.fl;if(o.d!=null)PK_D=+o.d;spKey=''};
const PC={cam:null,tgt:null,on:false,key:'',t0:0,dur:0,fp:null,fq:null,fm:null};
function camTarget(w,h){
  const c=PC.tgt||(PC.tgt=new THREE.PerspectiveCamera(42,1,.1,100));
  const v=new THREE.Vector3(),tn=(x,y,z)=>{v.set(x,y,z).applyMatrix4(c.matrixWorldInverse);return [v.x/-v.z,v.y/-v.z]};
  const r=myIdx()>=0?Math.min(.35,HAND_H*handK()/h):0;   // 화면 아래 손패 몫
  let hx=0,top=-9,bot=9;
  if(w>=h){   // 가로: 공통 카메라에서 위쪽은 그대로, 내 칩 더미가 손패 위로 오게 필요한 만큼만 멀리
    c.position.copy(T.cam.position);c.quaternion.copy(T.cam.quaternion);c.updateMatrixWorld();
    const m=T.cam.projectionMatrix.elements;hx=1/m[0];top=(m[9]+1)/m[5];bot=(m[9]-1)/m[5];
    const need=top-tn(0,0,BANK_Z+.35)[1];let S=top-bot;
    if(need>S*(1-r)){S=need/(1-r);hx*=S/(top-bot)}
    bot=top-S;
  }else{   // 세로: 더 위에서(PK_EL) 거리 PK_D, 초점 거리 PK_FL(35mm 환산: 화면 폭 = 36mm, 클수록 망원). 탁자 가운데가 손패 위 칸의 가운데에 오게
    const EL=PK_EL*Math.PI/180,D=PK_D,tz=.2;
    c.position.set(0,D*Math.sin(EL),tz+D*Math.cos(EL));c.lookAt(0,0,tz);c.updateMatrixWorld();
    hx=18/PK_FL;const S=2*hx*h/w;top=S*(1-r)/2;bot=top-S;
  }
  const n=c.near,f=c.far;c.projectionMatrix.makePerspective(-hx*n,hx*n,top*n,bot*n,n,f);c.projectionMatrixInverse.copy(c.projectionMatrix).invert();
  return c;
}
function pkCamFrame(now){
  const st=$('#stage'),w=st.clientWidth,h=st.clientHeight,tg=camTarget(w,h);
  if(!PC.cam){PC.cam=new THREE.PerspectiveCamera(42,1,.1,100);PC.fp=new THREE.Vector3();PC.fq=new THREE.Quaternion();PC.fm=new THREE.Matrix4()}
  const c=PC.cam,key=w+'x'+h+'|'+PK_EL+'|'+PK_FL+'|'+PK_D+'|'+(myIdx()>=0);
  if(!PC.on||key!==PC.key){   // 지금 보이던 카메라(시작이면 공통 카메라)에서 출발
    const s=PC.on?c:T.cam;PC.fp.copy(s.position);PC.fq.copy(s.quaternion);PC.fm.copy(s.projectionMatrix);
    PC.dur=PC.on?350:900;PC.t0=now;PC.on=true;PC.key=key;
  }
  const k0=Math.min(1,(now-PC.t0)/PC.dur),k=k0*k0*(3-2*k0);
  c.position.copy(PC.fp).lerp(tg.position,k);c.quaternion.copy(PC.fq).slerp(tg.quaternion,k);c.updateMatrixWorld();
  const a=PC.fm.elements,b=tg.projectionMatrix.elements,m=c.projectionMatrix.elements;for(let j=0;j<16;j++)m[j]=a[j]+(b[j]-a[j])*k;
  c.projectionMatrixInverse.copy(c.projectionMatrix).invert();
  return c;
}
const gameOn=()=>ON&&V3.root&&(V.st==='play'||V.st==='over');
const CAM=()=>gameOn()&&PC.on&&PC.cam?PC.cam:T.cam;   // 지금 그리는 카메라 (이름표·누르기 계산용)
G.render3D=t=>{
  if(ON&&V3.root){frame3(t);T.timerBg.visible=T.timerArc.visible=false}
  if(gameOn())T.r.render(T.scene,pkCamFrame(performance.now()));else{PC.on=false;T.r.render(T.scene,T.cam)}
};   // 남은 시간은 이름표 테두리와 베팅 칸 고리로 (자리 가장자리 고리는 숨김)
/* 공통 코드가 다른 사람 자리에 카드 더미를 놓는데(손패 표시 1장) 포커는 카드를 펠트에 펼치므로 숨김 */
G.field3D=v=>{
  if(T.stacks)for(const arr of T.stacks.values())arr.forEach(c=>{c.visible=false});
  if(v&&v.pk&&(v.st==='play'||v.st==='over'))sync3(v);
};
/* 판이 시작되면: 판 번호(블라인드가 올랐으면 함께)를 펠트 가운데에 잠깐, 칩 더미가 튐 */
function fxText(html,col){
  const a=(T&&T.anchor)||{x:$('#stage').clientWidth/2,y:$('#stage').clientHeight/2};
  const d=document.createElement('div');d.className='playfx';d.style.setProperty('--rc',col||'#9a5b00');
  d.style.left=a.x+'px';d.style.top=Math.max(46,a.y-40)+'px';d.innerHTML=html;
  d.addEventListener('animationend',()=>d.remove());
  const layer=$('#fx');while(layer.children.length>2)layer.firstChild.remove();layer.appendChild(d);setTimeout(()=>d.remove(),2300);
}
function handStart(B){
  fxText(`<span class="fx-n">${B.hn} / ${B.hns}판</span>${B.lv===B.hn?`<span class="fx-s">블라인드 ${B.sb}/${B.bb}</span>`:''}`);
  V3.bounceAt=clock();
}
/* ---------- 첫 딜러 룰렛 (시작 연출) ---------- */
const IN={on:false,t0:0,total:0,fp:null,said:false};
G.intro=(t0,o)=>{
  const B=BV();if(!B||B.ph!=='intro')return;   // 판마다 카드를 나눌 때도 불림 → 시작 연출만
  const L=V.ps.map((_,i)=>i);
  IN.on=true;IN.t0=t0;IN.said=false;IN.total=(o&&o.total)||G.introMs(false,o&&o.fast);
  IN.fp=firstPick(t0+INTRO_LEAD,{seats:L,first:B.bt,fast:o&&o.fast});
};
function syncRingsIntro(now){
  const on=IN.on&&now<IN.t0+IN.total;
  if(!on){for(const r of V3.rings.values())r.visible=false;return}
}
function introFrame(now){
  if(!IN.on)return;
  const end=IN.t0+IN.total;
  if(now>=end+200){IN.on=false;for(const r of V3.rings.values())r.visible=false;return}
  const fp=IN.fp;if(!fp||!V||!V.ps)return;
  const cand=fp.cand(now),cur=now>=IN.t0+INTRO_LEAD?fp.idx(now):-2;
  V.ps.forEach((_,i)=>{const r=spotRing(i);r.visible=cand||cur===i;if(r.visible){const s=cand?1+.12*Math.sin(now/80):1;r.scale.set(s,s,1)}});
  if(fp.tick(now)&&!IN.said){IN.said=true;const p=V.ps[fp.first];if(p)fxText(`<span class="fx-n" style="font-size:.7em">${fp.first===myIdx()?'내가':esc(p.n)+' 님이'} 첫 딜러입니다</span>`,'#3b2a1f')}
}

/* ---------- 이름표: 자리 바깥에 칩·마지막 행동, 쇼다운이면 족보·받은 칩 ---------- */
function tagLine(B,i){
  if(B.st[i]===3)return '';
  if(B.ph==='show'&&B.rs){
    const b=B.rs.best&&B.rs.best[i],w=B.rs.won[i]||0,land=V3.landed.has(i)||!T.ok;
    return (b?`<b>${b.nm}</b>`:'')+(w>0&&land?`<em class="w">+${w}</em>`:'')+(B.st[i]===1&&!b?'<i>폴드</i>':'');
  }
  const la=B.la[i];
  return la?`<i class="${la==='폴드'?'f':la==='올인'?'a':''}">${la}</i>`:'';
}
function seatTags(B){
  const on3=T.ok&&(V.st==='play'||V.st==='over'),st=$('#stage'),W=st.clientWidth,Hh=st.clientHeight,v3=on3?new THREE.Vector3():null,put=[];
  document.querySelectorAll('#labels .seat[data-i]').forEach(el=>{
    const i=+el.dataset.i,ct=el.querySelector('.ct'),p=V.ps[i];if(!ct||!p)return;
    const t=p.sr?(p.sr===2?'시간 초과':p.sr===3?'탈주':'항복'):p.f&&V.st==='play'?'탈락':`칩 ${shownCh(B,i)}`;if(ct.textContent!==t)ct.textContent=t;
    const h=tagLine(B,i);
    let x=el.querySelector('.pkt');if(!x){x=document.createElement('div');x.className='pkt';el.appendChild(x)}
    if(x.dataset.h!==h){x.innerHTML=h;x.dataset.h=h}
    el.classList.toggle('pk-fold',B.st[i]===1&&B.ph!=='show');
    const S=SP.get(i);
    if(on3&&S&&!S.me){
      const shw=B.hc[i]&&B.hc[i].some(x=>x>=0),q=cardPose(i,0,shw),half=CH*q.s/2+.07;   // 카드 바로 위(화면 위쪽)에
      v3.set(S.x+(shw?S.ux*.32:0),.03,Math.min(S.z,q.z)-half).project(CAM());
      const w=el.offsetWidth,hh=el.offsetHeight;
      put.push({el,w,h:hh,x:Math.max(w/2+6,Math.min(W-w/2-6,(v3.x+1)/2*W)),y:(1-v3.y)/2*Hh-hh/2});   // 이름표 아래 끝이 카드 바깥쪽에 닿게
    }
  });
  // 좁은 화면에서 이웃 이름표가 겹치면 위로 비킴
  put.sort((a,b)=>b.y-a.y);
  const done=[];
  for(const q of put){
    for(let g=0;g<4&&done.some(o=>Math.abs(o.x-q.x)<(o.w+q.w)/2+4&&Math.abs(o.y-q.y)<(o.h+q.h)/2+2);g++)q.y-=q.h+3;
    done.push(q);q.el.style.left=q.x+'px';q.el.style.top=Math.max(q.h/2+6,Math.min(Hh-q.h/2-6,q.y))+'px';
  }
}
/* WebGL이 없을 때: 공용 카드와 모두의 카드를 2D로 */
function render2D(){
  const B=BV();if(!el2d)return;
  const on=!!(B&&!T.ok&&(V.st==='play'||V.st==='over'));
  if(!on){if(!el2d.hidden){el2d.hidden=true;el2d.innerHTML='';el2d.dataset.k=''}return}
  const me=myIdx();
  let h=`<div class="r2 bd"><span class="n2">팟 ${B.ph==='show'&&B.rs?B.rs.pot:sum(B.tot)}</span><span class="c2">${B.bd.map(cardEl).join('')}</span><span class="t2"></span></div>`;
  V.ps.forEach((p,i)=>{if(B.st[i]===3&&!p.f)return;
    const cs=B.hc[i]||[],mk=(i===B.bt?'<span class="pk-d">D</span>':'');
    h+=`<div class="r2${i===me?' me':''}${B.st[i]===1?' fold':''}${V.t===i&&B.ph==='bet'?' on':''}"><span class="n2">${mk}${esc(p.n)}${i===me?' (나)':''}</span><span class="c2">${cs.map(cardEl).join('')}</span><span class="t2">칩 ${B.ch[i]}${B.bet[i]?` · <b>${B.bet[i]}</b>`:''} ${tagLine(B,i)}</span></div>`});
  if(el2d.dataset.k!==h){el2d.innerHTML=h;el2d.dataset.k=h}
  el2d.hidden=false;
}
G.hud=inGame=>{
  const on=!!(inGame&&BV());
  if(!on){if(T.ok)clear3D();if(elBet)elBet.hidden=true}
  render2D();
};
G.live=()=>{
  const B=BV();if(!B)return;
  if(T.ok)layout();
  seatTags(B);
};
G.enter=()=>{ON=true;$('#stage').classList.add('pk');$('#numpick').hidden=true};
G.leave=()=>{
  ON=false;if(typeof T!=='undefined'&&T.ok)clear3D();
  const st=$('#stage');if(st)st.classList.remove('pk');
  const pass=$('#btnPass'),gb=$('#btnGura');if(pass){setTxt(pass,'패스');pass.hidden=false}if(gb){setTxt(gb,'구라!');gb.hidden=true}
  if(elHand){elHand.hidden=true;elHand.innerHTML='';elHand.dataset.k=''}
  if(elBet)elBet.hidden=true;if(el2d){el2d.hidden=true;el2d.innerHTML='';el2d.dataset.k=''}
  document.querySelectorAll('#labels .seat .pkt').forEach(x=>x.remove());document.querySelectorAll('#labels .seat.pk-fold').forEach(x=>x.classList.remove('pk-fold'));
  if(typeof T!=='undefined'&&T.stacks)for(const arr of T.stacks.values())arr.forEach(c=>{c.visible=true});
  const cv=$('#cv');if(cv)cv.style.cursor='';
};
/* 칩 누르기: 내 칩 더미 → 베팅 칸, 베팅 칸 → 돌려받기 */
const _ray=window.THREE?new THREE.Raycaster():null,_pl=window.THREE?new THREE.Plane(new THREE.Vector3(0,1,0),-.12):null,_hit=window.THREE?new THREE.Vector3():null;
function chipAt(e){
  if(!ON||!T.ok||!BV()||myIdx()<0||!V3.bank)return null;
  const r=$('#cv').getBoundingClientRect();if(!r.width)return null;
  _ray.setFromCamera({x:(e.clientX-r.left)/r.width*2-1,y:-(e.clientY-r.top)/r.height*2+1},CAM());
  if(!_ray.ray.intersectPlane(_pl,_hit))return null;
  const n=V3.bank.userData.n;
  for(let k=0;k<4;k++)if(n[k]&&Math.hypot(_hit.x-BANK_X[k],_hit.z-(BANK_Z+.1))<.27)return {d:DEN[k]};
  if(Math.hypot(_hit.x-MYBET.x,_hit.z-MYBET.z)<.38)return {bet:1};
  return null;
}
G.init=()=>{
  const css=document.createElement('style');
  css.textContent=`
.stage.pk #dim{display:none}
.stage.pk .fan{display:none}
.seat .pkt{display:flex;align-items:baseline;justify-content:center;gap:4px;font-size:11px;line-height:1.2}.seat .pkt:empty{display:none}
.seat .pkt b{font-size:11.5px;font-weight:700;color:var(--ink)}
.seat .pkt i{font-style:normal;font-size:10.5px;font-weight:700;color:var(--muted)}.seat .pkt i.a{color:#9a5b00}.seat .pkt i.f{color:var(--muted);font-weight:600}
.seat .pkt em{font-style:normal;font-family:var(--f-num);font-weight:700;font-size:12.5px}.seat .pkt em.w{color:#2c7d47}
.stage.pk .seat.pk-fold{opacity:.62}
.pk-me{font-weight:700}
.myplate .me-sub em.w{font-style:normal;font-family:var(--f-num);font-weight:700;color:#2c7d47}
@media (max-width:480px){.stage.pk .myplate{bottom:72px;max-width:calc(100% - 24px)}}
#pkBet{position:absolute;left:50%;bottom:calc(var(--plateB,14px) + 62px);transform:translateX(-50%);z-index:8;display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:18px;background:rgba(255,250,240,.94);border:1.5px solid var(--line-strong);box-shadow:0 4px 12px -4px rgba(59,42,31,.45)}
#pkBet[hidden]{display:none}
#pkBet .pk-amt{display:flex;align-items:center;gap:4px;min-width:84px;justify-content:center}
#pkBet .pk-amt b{font-family:var(--f-num);font-size:26px;font-weight:700;color:var(--ink);min-width:58px;text-align:center}
#pkBet .pk-clr{width:30px;height:30px;border-radius:50%;border:1.5px solid var(--line-strong);background:var(--well);color:var(--muted);font-size:13px;font-weight:700;cursor:pointer;padding:0}
#pkBet .pk-chip{--c:#cc3a2e;width:50px;height:50px;border-radius:50%;border:0;background:radial-gradient(circle,var(--c) 0 52%,transparent 53%),repeating-conic-gradient(#fffaf0 0 15deg,var(--c) 15deg 45deg);box-shadow:0 3px 0 rgba(0,0,0,.35),inset 0 0 0 3px var(--c);color:#fffaf0;font-family:var(--f-num);font-weight:700;font-size:14px;cursor:pointer;padding:0;touch-action:manipulation}
#pkBet .pk-chip.c50{--c:#2e7d4f}#pkBet .pk-chip.c100{--c:#2b2b2b}
#pkBet .pk-chip.all{--c:#6b3fa0;font-family:var(--f-body);font-size:12px}
#pkBet button:disabled{opacity:.4;cursor:not-allowed}
@media (max-width:480px){#pkBet{bottom:128px;gap:6px;padding:7px 8px}#pkBet .pk-chip{width:44px;height:44px;font-size:13px}#pkBet .pk-amt{min-width:72px}#pkBet .pk-amt b{font-size:22px;min-width:48px}}
#pk2d{position:absolute;left:50%;top:46%;transform:translate(-50%,-50%);z-index:5;display:flex;flex-direction:column;gap:6px;width:min(560px,calc(100% - 20px));max-height:calc(100% - 210px);overflow:auto;pointer-events:none}
#pk2d[hidden]{display:none}
#pkHand{position:absolute;left:50%;bottom:0;display:flex;align-items:flex-end;z-index:6;pointer-events:none;transform:translateX(-50%) scale(var(--k,1));transform-origin:50% 100%;padding-bottom:14px}
#pkHand[hidden]{display:none}
#pkHand .card{transition:transform .2s,filter .2s,opacity .2s}#pkHand .card+.card{margin-left:-16px}
#pkHand .card:first-child{transform:rotate(-5deg)}#pkHand .card:last-child:not(:first-child){transform:rotate(5deg)}
#pkHand .card.win{outline:3px solid #e8b130;outline-offset:-1px;translate:0 -12px}
#pkHand.fold .card{filter:grayscale(.75) brightness(.9);opacity:.6}
#pk2d .r2{display:grid;grid-template-columns:96px auto 1fr;align-items:center;gap:8px;padding:5px 10px;border-radius:12px;background:#fffaf0;border:1px solid var(--line-strong)}
#pk2d .r2.bd{background:#2f7550;color:#f4ead9;min-height:60px}
#pk2d .r2.me{box-shadow:0 0 0 2px var(--mustard)}#pk2d .r2.on{border-color:var(--mustard-edge)}#pk2d .r2.fold{opacity:.55}
#pk2d .n2{font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#pk2d .c2{display:flex;gap:3px}
#pk2d .t2{font-size:12px;text-align:right}#pk2d .t2 b{font-family:var(--f-num)}#pk2d .t2 i{font-style:normal;color:var(--muted);font-weight:700}#pk2d .t2 em{font-style:normal;color:#2c7d47;font-weight:700}
#pk2d .card{width:36px;height:52px;transform:none!important;cursor:default}
#pk2d .card .cn{font-size:12px;left:3px;top:1px}#pk2d .card .cn i{font-size:9px}
#pk2d .card .big{font-size:20px;top:20px}
#pk2d .card.back{background:#cc3a2e;border:2px solid #fffcf5}
#pk2d .pk-d{display:inline-block;font-size:10px;font-weight:700;line-height:1;padding:3px 5px 2px;border-radius:99px;margin-right:4px;background:#fffaf0;color:#3b2a1f;border:1.5px solid #3b2a1f}
`;
  document.head.appendChild(css);
  elHand=document.createElement('div');elHand.id='pkHand';elHand.hidden=true;elHand.setAttribute('aria-label','내 카드');$('#stage').insertBefore(elHand,$('#fx'));
  el2d=document.createElement('div');el2d.id='pk2d';el2d.hidden=true;el2d.setAttribute('aria-live','polite');$('#stage').insertBefore(el2d,$('#fx'));
  elBet=document.createElement('div');elBet.id='pkBet';elBet.hidden=true;elBet.setAttribute('role','group');elBet.setAttribute('aria-label','레이즈');
  elBet.innerHTML=`<button type="button" class="pk-chip" data-add="10" aria-label="10개 더">10</button><button type="button" class="pk-chip c50" data-add="50" aria-label="50개 더">50</button><button type="button" class="pk-chip c100" data-add="100" aria-label="100개 더">100</button><div class="pk-amt"><b aria-live="polite">0</b><button type="button" class="pk-clr" data-clr aria-label="모두 빼기" title="모두 빼기">✕</button></div><button type="button" class="pk-chip all" data-all aria-label="가진 칩 모두">올인</button>`;
  $('#stage').appendChild(elBet);
  elBet.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b||b.disabled||!canStage())return;
    if(b.dataset.add){addChip(+b.dataset.add);return}
    if(b.hasAttribute('data-all'))pend=greedy(myCh());else if(b.hasAttribute('data-clr'))pend=[];
    sfxChip(1);renderMe();renderButtons();
  });
  $('#btnGura').addEventListener('click',()=>{if(ON)doMove('raise')});
  const cv=$('#cv');
  cv.addEventListener('click',e=>{if(!ON)return;const h=chipAt(e);if(!h)return;if(!canStage()){if(myMode()==='act')sfx('no');return}if(h.d)addChip(h.d);else takeChip()});
  cv.addEventListener('pointermove',e=>{if(!ON)return;const h=e.pointerType==='mouse'&&canStage()?chipAt(e):null;const c=h?'pointer':'';if(cv.style.cursor!==c)cv.style.cursor=c});
};

(window.GAMES=window.GAMES||{}).poker=G;
})();
