/* 포커 테스트: 족보·블라인드와 행동 순서·최소 레이즈·모자란 올인·사이드 팟·숨긴 카드·시간 초과·탈락·판 수 + 봇끼리 끝까지 (engine.test.js가 PK=GAMES.poker로 불러 씀) */
const {eval5,best,score7,handName,splitPots,raiseRange,preScore,equity,U}=PK._test;
const C=(r,s)=>r*4+(s||0);   // r: 0=A, 1=2, …, 9=10, 10=J, 11=Q, 12=K / s: 0♠ 1♥ 2♦ 3♣
// 족보: 등급 순서와 같은 족보끼리의 비교
{const cat=cs=>best(cs).cat,gt=(a,b,m)=>{if(!(best(a).v>best(b).v))fail('pk '+m)},eq=(a,b,m)=>{if(best(a).v!==best(b).v)fail('pk eq '+m)};
 const sf=[C(8),C(7),C(6),C(5),C(4)],quad=[C(3),C(3,1),C(3,2),C(3,3),C(12)],fh=[C(3),C(3,1),C(3,2),C(12),C(12,1)],fl=[C(1,2),C(5,2),C(7,2),C(9,2),C(11,2)],
   st=[C(4),C(5,1),C(6,2),C(7,3),C(8)],wheel=[C(0),C(1,1),C(2,2),C(3,3),C(4)],trip=[C(6),C(6,1),C(6,2),C(0),C(12)],tp=[C(6),C(6,1),C(2),C(2,1),C(0)],op=[C(6),C(6,1),C(2),C(9,1),C(0)],hc=[C(0),C(12,1),C(9),C(6,2),C(3)];
 [[sf,8],[quad,7],[fh,6],[fl,5],[st,4],[wheel,4],[trip,3],[tp,2],[op,1],[hc,0]].forEach(([cs,c])=>{if(cat(cs)!==c)fail('pk cat '+c+' got '+cat(cs))});
 gt(sf,quad,'sf>quad');gt(quad,fh,'quad>fh');gt(fh,fl,'fh>fl');gt(fl,st,'fl>st');gt(st,trip,'st>trip');gt(trip,tp,'trip>tp');gt(tp,op,'tp>op');gt(op,hc,'op>hc');
 gt(st,wheel,'6-high straight > wheel');gt([C(0),C(12),C(11),C(10),C(9,1)],st,'broadway > 9-high');
 gt([C(0),C(0,1),C(9),C(5),C(3)],[C(0,2),C(0,3),C(9,1),C(5,1),C(2)],'pair kicker');
 gt([C(12),C(12,1),C(3),C(3,1),C(5)],[C(12,2),C(12,3),C(3,2),C(3,3),C(4)],'two pair kicker');
 gt([C(12),C(12,1),C(4),C(4,1),C(1)],[C(12,2),C(12,3),C(3,2),C(3,3),C(10)],'two pair second pair');
 gt([C(3),C(3,1),C(3,2),C(1),C(1,1)],[C(2),C(2,1),C(2,2),C(12),C(12,1)],'full house by trips');
 gt([C(0,2),C(9,2),C(7,2),C(5,2),C(2,2)],[C(12,1),C(11,1),C(10,1),C(9,1),C(7,1)],'flush ace high');
 eq([C(0),C(12,1),C(9),C(6,2),C(3)],[C(0,1),C(12,2),C(9,3),C(6,3),C(3,3)],'same ranks other suits');
 // 7장: 가장 좋은 5장
 {const b=best([C(0),C(0,1),C(12),C(12,1),C(5,2),C(5,3),C(9)]);if(b.cat!==2||b.five.length!==5||!b.five.includes(C(9)))fail('pk 7 two pair with 10 kicker '+b.five)}
 {const b=best([C(0,1),C(12,1),C(11,1),C(10,1),C(9,1),C(1),C(2)]);if(handName(b)!=='로열 플러시')fail('pk royal '+handName(b))}
 {const b=best([C(0),C(1,1),C(2,2),C(3,3),C(4),C(12),C(12,1)]);if(b.cat!==4)fail('pk wheel in 7 '+b.cat)}
 // 공용 카드가 가장 좋으면 무승부
 {const bd=[C(0),C(12,1),C(11,2),C(10,3),C(9)];if(best([C(1),C(2,1),...bd]).v!==best([C(3),C(4,2),...bd]).v)fail('pk board plays')}
 // 빠른 7장 점수는 21가지를 다 본 점수와 같음 (무작위 대조)
 {let bad=0;for(let k=0;k<3000;k++){const d=shuffle([...Array(52).keys()]).slice(0,7);if(score7(d)!==best(d).v)bad++}if(bad)fail('pk score7 mismatch '+bad)}
 if(!(preScore(C(0),C(0,1))>preScore(C(12),C(11))&&preScore(C(12),C(11))>preScore(C(6),C(1,1))))fail('pk preScore order');
 {const e=equity([C(0),C(0,1)],[],1,400),e2=equity([C(6),C(1,1)],[],1,400);if(!(e>.75&&e2<.45))fail('pk equity '+e+' '+e2)}}

const runTo=(cond,ms)=>{for(let k=0;k<(ms||60000)/50&&!cond();k++){NOW+=50;engineTick()}return cond()};
/* 사람만으로 시작 (첫 딜러 = 방장 0번: pickfirst), 첫 베팅 차례까지 */
const mkP=(n,over)=>{hostNew(false,'t','t');H.cfg={...cfgFor('poker'),pickfirst:1,...over,game:'poker'};
  H.members=[];for(let i=0;i<n;i++)H.members.push({name:'p'+i,bot:false,conn:null,host:i===0,cid:i?'c'+i:''});hostStart();
  if(!runTo(()=>H.pk.ph==='bet'&&!dealing(),30000))fail('pk start to bet '+H.pk.ph);return H.pk};
/* 카드 정하기: 사람마다 두 장, 공용 다섯 장(덱 끝에서 버리는 카드 한 장씩 사이에 둠) */
function rig(hcs,bd){
  const K=H.pk,used=new Set([...hcs.flat(),...bd]),rest=[...Array(52).keys()].filter(x=>!used.has(x));
  hcs.forEach((h,i)=>{if(h)K.hc[i]=h.slice()});
  const b=[rest.pop(),rest.pop(),rest.pop()];
  K.deck=[...rest,bd[4],b[2],bd[3],b[1],bd[2],bd[1],bd[0],b[0]];
}
const act=(i,a)=>{const ok=PK.engine.act(i,a);return ok};
const total=K=>K.ch.reduce((a,b)=>a+b,0)+K.tot.reduce((a,b)=>a+b,0);
const toNextBet=()=>runTo(()=>(H.pk.ph==='bet'&&H.turn>=0)||H.pk.ph==='show'||H.phase==='over',20000);
// 1) 셋이서: 버튼 0 → 스몰 1·빅 2, 프리플랍은 0부터. 최소 레이즈와 다시 올리기, 베팅이 끝나면 팟으로 모이고 플랍은 버튼 다음(1)부터
{const K=mkP(3,{chips:1000,sb:10});
 if(K.bt!==0||K.sbS!==1||K.bbS!==2||H.turn!==0)fail('pk 3p blinds '+[K.bt,K.sbS,K.bbS,H.turn]);
 if(K.ch.join()!=='1000,990,980'||K.cur!==20)fail('pk 3p posted '+K.ch+' cur '+K.cur);
 {const R=raiseRange(K,0);if(R.minTo!==40||R.maxTo!==1000||!R.open)fail('pk raise range '+JSON.stringify(R))}
 act(1,{t:'call'});if(K.bet[1]!==10)fail('pk out of turn');
 act(0,{t:'raise',a:30});   // 최소보다 적으면 최소(40)로
 if(K.cur!==40||K.bet[0]!==40||K.minR!==20||H.turn!==1)fail('pk min raise '+K.cur+' '+K.minR+' '+H.turn);
 act(1,{t:'raise',a:100});
 if(K.cur!==100||K.minR!==60||H.turn!==2)fail('pk reraise '+K.cur+' '+K.minR);
 act(2,{t:'call'});act(0,{t:'call'});
 if(K.ph!=='run'||K.bet.some(b=>b)||K.tot.join()!=='100,100,100'||K.bd.length!==3)fail('pk preflop done '+K.ph+' '+K.tot+' '+K.bd.length);
 toNextBet();if(H.turn!==1||K.sr!==1)fail('pk flop first left of button '+H.turn);
 // 플랍: 1 체크, 2 베팅 50, 0 폴드, 1 콜 → 턴
 act(1,{t:'call'});if(K.la[1]!=='체크')fail('pk check label');
 act(2,{t:'raise',a:50});if(K.la[2]!=='베팅'||K.cur!==50)fail('pk bet label '+K.la[2]);
 act(0,{t:'fold'});act(1,{t:'call'});
 if(K.sr!==2||K.st[0]!==1)fail('pk turn street '+K.sr);
 if(total(K)!==3000)fail('pk chips conserved '+total(K))}
// 2) 둘이서: 버튼이 스몰 블라인드이고 프리플랍은 먼저, 플랍부터는 나중
{const K=mkP(2,{chips:500,sb:10});
 if(K.bt!==0||K.sbS!==0||K.bbS!==1||H.turn!==0)fail('pk heads-up blinds '+[K.bt,K.sbS,K.bbS,H.turn]);
 act(0,{t:'call'});if(H.turn!==1)fail('pk HU big blind option '+H.turn);   // 빅 블라인드는 체크·레이즈를 고를 수 있음
 act(1,{t:'call'});toNextBet();
 if(H.turn!==1)fail('pk HU postflop big blind first '+H.turn)}
// 3) 모자란 올인은 이미 행동한 사람에게 레이즈를 다시 열지 않음
{const K=mkP(3,{chips:1000,sb:10});
 K.ch[2]=130;   // 빅 블라인드(2)는 모두 150
 act(0,{t:'raise',a:100});act(1,{t:'call'});
 act(2,{t:'raise',all:1});
 if(K.cur!==150||K.st[2]!==2||K.minR!==80)fail('pk short all-in '+K.cur+' '+K.minR);
 if(H.turn!==0||raiseRange(K,0).open)fail('pk short all-in reopened '+H.turn);
 if(act(0,{t:'raise',a:400})===true||K.bet[0]!==100)fail('pk raise after short all-in '+K.bet[0]);
 act(0,{t:'call'});if(H.turn!==1||raiseRange(K,1).open)fail('pk second caller can only call');
 act(1,{t:'call'});if(K.sr!==1||K.tot.join()!=='150,150,150')fail('pk after short all-in '+K.tot)}
// 4) 사이드 팟: 100 올인(가장 좋음) · 300 올인(둘째) · 300 → 메인 300은 0, 사이드 400은 1. 남는 칩은 버튼 왼쪽부터
{mkP(3,{chips:1000});const K=H.pk;
 K.tot=[100,300,300];K.st=[2,2,0];K.bt=2;
 const {pots,won}=splitPots(K,[30,20,10]);
 if(pots.length!==2||won.join()!=='300,400,0')fail('pk side pots '+won+' '+JSON.stringify(pots));
 K.tot=[100,300,500];K.st=[2,2,0];   // 2가 더 건 200은 혼자라 돌려받음
 {const r=splitPots(K,[30,20,10]);if(r.won.join()!=='300,400,200'||!r.pots[2].ret)fail('pk uncalled return '+r.won)}
 K.tot=[10,10,10];K.st=[0,0,1];K.bt=0;   // 30을 둘이 나눔: 10 단위라 버튼 왼쪽(1)이 20
 {const r=splitPots(K,[5,5,-1]);if(r.won.join()!=='10,20,0')fail('pk odd chip '+r.won)}
 K.tot=[40,40,20];K.st=[0,0,1];   // 폴드한 사람의 칩도 팟에
 {const r=splitPots(K,[9,5,-1]);if(r.won.join()!=='100,0,0')fail('pk folded chips in pot '+r.won)}}
// 5) 숨긴 카드: 남의 카드·덱은 보내지 않음, 모두 폴드하면 카드를 펼치지 않음
{const K=mkP(3,{chips:1000});
 const s0=snapFor(0).pk,s1=snapFor(1).pk,sv=snapFor(-1).pk;
 if(s0.hc[0].some(x=>x<0)||s0.hc[1].some(x=>x>=0)||s0.hc[2].some(x=>x>=0))fail('pk own cards only '+JSON.stringify(s0.hc));
 if(s1.hc[0].some(x=>x>=0)||s1.hc[1].some(x=>x<0))fail('pk p1 sees own');
 if(sv.hc.flat().some(x=>x>=0))fail('pk spectator sees cards');
 if('deck' in s0||s0.bd.length)fail('pk deck/board leak');
 if(JSON.stringify(snapFor(-1)).includes('"deck"'))fail('pk deck in snapshot');
 act(0,{t:'fold'});act(1,{t:'fold'});
 if(K.ph!=='show'||K.rs.won[2]!==30||K.rs.show.length)fail('pk fold win '+K.ph+' '+(K.rs&&K.rs.won));
 if(snapFor(0).pk.hc[2].some(x=>x>=0)||snapFor(-1).pk.hc[2].some(x=>x>=0))fail('pk fold win shows cards')}
// 6) 쇼다운: 정한 카드로 이긴 사람·족보, 쇼다운 카드는 모두에게 보임
{const K=mkP(2,{chips:1000});
 rig([[C(0),C(0,1)],[C(12),C(11)]],[C(0,2),C(5),C(6,1),C(1,3),C(12,2)]);   // 0: A 트리플, 1: K 원 페어
 act(0,{t:'call'});act(1,{t:'call'});
 for(let s=0;s<3;s++){toNextBet();act(H.turn,{t:'call'});act(H.turn,{t:'call'})}
 runTo(()=>K.ph==='show',10000);
 if(K.ph!=='show'||K.rs.won[0]!==40||K.rs.best[0].nm!=='트리플'||K.rs.best[1].nm!=='원 페어')fail('pk showdown '+K.ph+' '+(K.rs&&JSON.stringify(K.rs.won)));
 const sv=snapFor(-1).pk;if(sv.hc[0][0]!==C(0)||sv.hc[1][0]!==C(12))fail('pk showdown visible '+JSON.stringify(sv.hc));
 if(K.ch.join()!=='1020,980')fail('pk showdown chips '+K.ch)}
// 7) 둘 다 올인: 카드를 펼치고 공용 카드를 끝까지, 진 사람은 탈락하고 게임이 끝남
{const K=mkP(2,{chips:500});
 rig([[C(0),C(0,1)],[C(12),C(12,1)]],[C(2),C(5,1),C(7,2),C(9,3),C(3,1)]);
 act(0,{t:'raise',all:1});act(1,{t:'call'});
 if(!K.open||snapFor(-1).pk.hc[1][0]!==C(12))fail('pk all-in open cards');
 runTo(()=>K.ph==='show'||H.phase==='over',20000);
 if(K.bd.length!==5||K.rs.won[0]!==1000)fail('pk all-in runout '+K.bd.length+' '+(K.rs&&K.rs.won));
 runTo(()=>H.phase==='over',20000);
 if(H.phase!=='over'||H.players[1].rank!==2||H.players[0].rank!==1||!H.players[1].broke)fail('pk bust ends game '+H.phase+' '+H.players.map(p=>p.rank))}
// 8) 시간 초과: 체크할 수 있으면 체크, 아니면 폴드
{const K=mkP(3,{chips:1000,turn:10});
 NOW=H.deadline+1;engineTick();
 if(K.st[0]!==1)fail('pk timeout fold');
 act(1,{t:'call'});   // 스몰 블라인드 콜 → 빅 블라인드는 체크할 수 있음
 NOW=H.deadline+1;engineTick();
 if(K.st[2]!==0||K.sr!==1)fail('pk timeout check '+K.st[2]+' '+K.sr)}
// 9) 판 수를 마치면 끝: 칩 순서로 순위 (같으면 같은 순위), 버튼은 판마다 왼쪽으로
{const K=mkP(3,{chips:1000,rounds:3});
 const bts=[K.bt];
 for(let h=0;h<3&&H.phase!=='over';h++){
   while(K.ph==='bet'&&H.turn>=0){const i=H.turn;act(i,{t:K.bet[i]>=K.cur?'call':'fold'})}
   runTo(()=>H.phase==='over'||(K.ph==='bet'&&K.hn>h+1&&!dealing()),30000);
   if(H.phase!=='over')bts.push(K.bt);
 }
 if(H.phase!=='over'||K.hn!==3)fail('pk rounds end '+H.phase+' '+K.hn);
 if(bts.join()!=='0,1,2')fail('pk button moves '+bts);
 const r=H.players.map(p=>p.rank);H.players.forEach((p,i)=>{const want=1+K.ch.filter(x=>x>K.ch[i]).length;if(p.rank!==want)fail('pk final rank '+r+' '+K.ch)})}
// 10) 블라인드 오름: 2판마다 두 배
{const K=mkP(2,{chips:2000,rounds:5,up:2});
 const seen=[];for(let h=0;h<4&&H.phase!=='over';h++){seen.push(K.bb);act(H.turn,{t:'fold'});runTo(()=>H.phase==='over'||(K.ph==='bet'&&K.hn>h+1&&!dealing()),30000)}
 if(seen.join()!=='20,20,40,40')fail('pk blinds up '+seen)}
// 11) 항복: 차례인 사람이 항복하면 폴드하고 다음 사람, 둘만 남았다가 항복하면 남은 사람이 팟을 가져가고 끝
{const K=mkP(3,{chips:1000});
 act(0,{t:'surrender'});if(!H.players[0].finished||K.st[0]!==1||H.turn!==1)fail('pk surrender on turn '+H.turn);
 act(2,{t:'surrender'});if(H.phase!=='over'||H.players[1].rank!==1)fail('pk surrender ends '+H.phase);
 if(total(K)!==3000)fail('pk surrender chips '+total(K))}

/* 봇끼리 끝까지: 인원·칩·블라인드·판 수를 바꿔 가며. 칩 총합 그대로·음수 없음·10 단위, 차례는 행동할 수 있는 사람, 카드 겹침 없음, 순위 1~n */
function playOutP(n,over){
  hostNew(false,'t','t');
  H.cfg={...cfgFor('poker'),...over,game:'poker'};
  H.members=[];for(let i=0;i<n;i++)H.members.push({name:'b'+i,bot:true,conn:null,host:i===0,lv:0});
  let ticks=0;
  for(let g=0;g<2;g++){
    hostStart();
    const K=H.pk,sum=total(K);let guard=0,hands=0,shows=0,lastHn=0;
    while(H.phase!=='over'&&guard++<300000){
      NOW+=250;engineTick();ticks++;
      if(K.ch.some(x=>x<0)||K.tot.some(x=>x<0)){fail('pk negative chips '+K.ch);return ticks}
      if(total(K)!==sum){fail('pk chips not conserved '+total(K)+' '+sum+' '+K.ph);return ticks}
      if(K.ch.some(x=>x%U)||K.tot.some(x=>x%U)){fail('pk chips not in units '+K.ch);return ticks}
      if(H.phase==='play'&&H.turn>=0&&(K.st[H.turn]!==0||H.players[H.turn].finished)){fail('pk turn on inactive '+K.st);return ticks}
      if(K.hn!==lastHn){lastHn=K.hn;hands++;const all=[...K.hc.flat(),...K.bd,...K.deck];if(new Set(all).size!==all.length||all.length!==52){fail('pk deck size '+all.length);return ticks}}
      if(K.ph==='show'&&K.rs&&K.rs.show.length)shows++;
    }
    if(H.phase!=='over'){fail('pk stuck n='+n+' '+JSON.stringify(over)+' ph='+K.ph);return ticks}
    const r=H.players.map(p=>p.rank),N=H.players.length;
    if(!r.includes(1)||r.some(x=>!(x>=1&&x<=N))||H.players.some(p=>!p.finished))fail('pk ranks '+r);
    if(K.hn>K.hns)fail('pk too many hands');
    globalThis.pkShows=(globalThis.pkShows||0)+shows;
  }
  return ticks;
}
globalThis.playOutP=playOutP;
