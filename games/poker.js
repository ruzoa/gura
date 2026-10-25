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
G.keys={pkUp:'ArrowUp',pkDown:'ArrowDown',pkAll:'KeyA'};
G.keyActions=[
  {a:'gura',n:'레이즈',d:'올린 칩만큼 레이즈합니다. 칩을 올리지 않았으면 가장 적게 올립니다 (구라!와 같은 키)'},
  {a:'pkUp',n:'칩 올리기',d:'레이즈할 칩을 빅 블라인드만큼 늘립니다'},
  {a:'pkDown',n:'칩 내리기',d:'마지막에 올린 칩을 내립니다'},
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

(window.GAMES=window.GAMES||{}).poker=G;
})();
