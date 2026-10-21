/* 블랙잭 테스트: 합계·기본 전략·정산·딜러 규칙·사람 딜러 칩 보존·시간 초과·탈락 + 봇끼리 끝까지 (engine.test.js가 BJ=GAMES.blackjack으로 불러 씀) */
const {score,isBJ,basic,MIN}=BJ._test;
const C=(r,s)=>r*4+(s||0);   // r: 0=A, 1=2, …, 9=10, 10=J, 11=Q, 12=K
// 합계
{const t=(cs,v,soft)=>{const r=score(cs);if(r.t!==v||(soft!=null&&r.soft!==soft))fail('bj score '+cs+' = '+JSON.stringify(r)+' want '+v)};
 t([C(0),C(12)],21,true);t([C(0),C(0),C(8)],21,true);t([C(0),C(4),C(12)],16,false);t([C(0),C(0)],12,true);t([C(9),C(5),C(7)],24,false);t([C(0),C(-1+1),C(9)],12,false);
 t([C(0),-1],11,true);   // 엎은 카드는 빼고
 if(!isBJ([C(0),C(11)])||isBJ([C(0),C(4),C(4)])||isBJ([C(9),C(9)]))fail('bj isBJ')}
// 기본 전략
{const b=(t,s,u,d,w)=>{const m=basic(t,s,u,d);if(m!==w)fail(`bj basic ${t}${s?'s':''} vs ${u}: ${m} want ${w}`)};
 b(16,false,10,true,'hit');b(12,false,4,true,'stand');b(12,false,3,true,'hit');b(11,false,6,true,'double');b(11,false,6,false,'hit');
 b(18,true,9,true,'hit');b(18,true,7,true,'stand');b(18,true,5,true,'double');b(18,true,5,false,'stand');b(13,true,5,true,'double');b(17,false,11,true,'stand')}

/* 카드 순서를 정해 두기: 슈의 맨 끝부터 뽑으므로(pop) 뽑는 순서를 거꾸로 넣음 */
const rig=list=>{const B=H.bj;B.shoe=[...B.shoe.filter(x=>!list.includes(x)),...list.slice().reverse()]};
const mkB=(n,over)=>{hostNew(false,'t','t');H.cfg={...cfgFor('blackjack'),...over,game:'blackjack'};
  H.members=[];for(let i=0;i<n;i++)H.members.push({name:'p'+i,bot:false,conn:null,host:i===0,cid:i?'c'+i:''});hostStart();return H.bj};
const runTo=(cond,ms)=>{for(let k=0;k<(ms||60000)/50&&!cond();k++){NOW+=50;engineTick()}return cond()};
const afterDealing=()=>runTo(()=>!dealing()&&H.bj.ph!=='deal',20000);
// 1) 봇 딜러: 블랙잭 1.5배, 히트로 21이면 스탠드, 딜러 16은 받고 버스트
{const B=mkB(2,{chips:100});
 if(B.ph!=='bet'||H.turn!==0||B.dl!==-1)fail('bj start bet phase '+B.ph+' '+H.turn);
 rig([C(9),C(8),C(5),C(0),C(6),C(9,1),C(3),C(12)]);   // 뽑는 순서: p0 p1 딜러 p0 p1 딜러(엎음) / p1 히트 / 딜러 히트
 BJ.engine.act(1,{t:'bet',a:10});if(H.turn!==0)fail('bj first unbet turn');
 BJ.engine.act(0,{t:'bet',a:25});   // 10단위로 맞춤 → 30
 if(B.bt[0]!==30&&B.bt[0]!==20)fail('bj bet rounding '+B.bt[0]);
 const bet0=B.bt[0];
 if(B.ph!=='deal'||!dealing())fail('bj deal starts with beginDeal');
 {const s=snapFor(0);if(s.bj.dc[1]!==-1||s.bj.dc[0]!==C(5))fail('bj hole hidden '+s.bj.dc);if(snapFor(-1).bj.dc[1]!==-1)fail('bj hole hidden to spectator')}
 afterDealing();
 if(B.st[0]!==3||H.turn!==1||B.ph!=='turn')fail('bj natural & turn '+B.st+' '+H.turn+' '+B.ph);
 BJ.engine.act(0,{t:'hit'});if(B.hc[0].length!==2)fail('bj out-of-turn hit');
 BJ.engine.act(1,{t:'hit'});   // 9+7+4 = 20
 if(B.hc[1].length!==3||B.st[1]!==0)fail('bj hit to 20 '+B.hc[1]);
 BJ.engine.act(1,{t:'stand'});
 if(B.ph!=='dealer'||!B.dr)fail('bj dealer reveal');
 if(snapFor(0).bj.dc[1]!==C(9,1))fail('bj hole shown after reveal');
 runTo(()=>B.ph==='settle',10000);
 if(score(B.dc).t!==26)fail('bj dealer drew to bust '+B.dc);
 if(B.rs[0]!==bet0*1.5||B.rs[1]!==10)fail('bj settle '+B.rs);
 if(B.ch[0]!==100+bet0*1.5||B.ch[1]!==110)fail('bj chips '+B.ch);
 runTo(()=>B.ph==='bet',10000);
 if(B.rd!==2||B.hc[0].length||B.bt[0])fail('bj next round')}
// 2) 딜러 블랙잭(A 보임): 바로 정산, 블랙잭끼리는 무승부
{const B=mkB(2,{chips:100});
 rig([C(9),C(0,1),C(0),C(9,2),C(12,1),C(12)]);   // p0 10·10=20, p1 A·K=블랙잭, 딜러 A·K
 BJ.engine.act(0,{t:'bet',a:20});BJ.engine.act(1,{t:'bet',a:20});afterDealing();
 if(B.ph!=='settle'||B.rs[0]!==-20||B.rs[1]!==0)fail('bj dealer blackjack '+B.ph+' '+B.rs)}
// 3) 더블: 칩이 모자라면 못 함, 하면 두 배 걸고 한 장만
{const B=mkB(2,{chips:100});
 rig([C(5),C(9),C(9,1),C(4),C(8),C(7),C(8,2)]);   // p0 6·5=11, p1 10·9=19, 딜러 10·8=18 / p0 더블 9
 BJ.engine.act(0,{t:'bet',a:100});BJ.engine.act(1,{t:'bet',a:10});afterDealing();
 BJ.engine.act(0,{t:'double'});if(B.db[0]||B.hc[0].length!==2)fail('bj double without chips');
 B.bt[0]=40;BJ.engine.act(0,{t:'double'});
 if(!B.db[0]||B.bt[0]!==80||B.hc[0].length!==3||B.st[0]!==1||H.turn!==1)fail('bj double '+B.bt[0]+' '+B.hc[0]+' '+H.turn);
 BJ.engine.act(1,{t:'stand'});runTo(()=>B.ph==='settle',10000);
 if(B.rs[0]!==80||B.rs[1]!==10)fail('bj double settle '+B.rs)}
// 4) 시간 초과: 안 건 사람은 최소 칩, 차례는 스탠드
{const B=mkB(3,{chips:100,turn:10});
 BJ.engine.act(2,{t:'bet',a:50});NOW=H.deadline+1;engineTick();
 if(B.bt[0]!==MIN||B.bt[1]!==MIN||B.bt[2]!==50||B.ph!=='deal')fail('bj bet timeout '+B.bt);
 afterDealing();
 if(B.ph==='turn'){const i=H.turn,n0=B.hc[i].length;NOW=H.deadline+1;engineTick();if(B.st[i]!==1||B.hc[i].length!==n0)fail('bj turn timeout stand')}}
// 5) 사람 딜러: 돌아가며 맡음, 엎은 카드는 딜러만 봄, 16 이하는 스탠드 못 함, 칩 총합은 그대로
{const B=mkB(3,{chips:100,hdeal:1});
 if(!B.hd||B.dl!==0||B.order.join()!=='1,2'||H.turn!==1)fail('bj hd first dealer '+B.dl+' '+B.order);
 BJ.engine.act(0,{t:'bet',a:20});if(B.bt[0])fail('bj dealer cannot bet');
 rig([C(9),C(8),C(5),C(7),C(9,1),C(4)]);   // p1 10·8=18, p2 9·10=19, 딜러 6·5=11
 BJ.engine.act(1,{t:'bet',a:30});BJ.engine.act(2,{t:'bet',a:40});
 if(snapFor(0).bj.dc[1]!==C(4)||snapFor(1).bj.dc[1]!==-1)fail('bj hd hole only for dealer');
 afterDealing();BJ.engine.act(1,{t:'stand'});BJ.engine.act(2,{t:'stand'});
 if(B.ph!=='dealer'||H.turn!==0||B.auto)fail('bj hd dealer turn');
 BJ.engine.act(0,{t:'stand'});if(B.ph!=='dealer'||B.auto)fail('bj hd must hit under 17');
 B.shoe.push(C(6));BJ.engine.act(0,{t:'hit'});   // 11+7=18
 if(score(B.dc).t!==18)fail('bj hd hit '+B.dc);
 BJ.engine.act(0,{t:'stand'});runTo(()=>B.ph==='settle',10000);
 if(B.rs[1]!==0||B.rs[2]!==40||B.rs[0]!==-40||B.ch.reduce((a,b)=>a+b,0)!==300)fail('bj hd settle '+B.rs+' '+B.ch);
 runTo(()=>B.ph==='bet',10000);if(B.dl!==1||B.order.join()!=='2,0')fail('bj hd rotate '+B.dl+' '+B.order)}
// 6) 사람 딜러 칩이 모자라면 가진 만큼 나눠 줌 (총합 그대로, 음수 없음)
{const B=mkB(3,{chips:100,hdeal:1});B.ch=[20,200,200];
 rig([C(9),C(9,1),C(9,2),C(8),C(8,1),C(6)]);   // p1 19, p2 19, 딜러 10·7=17
 BJ.engine.act(1,{t:'bet',a:100});BJ.engine.act(2,{t:'bet',a:50});afterDealing();
 BJ.engine.act(1,{t:'stand'});BJ.engine.act(2,{t:'stand'});BJ.engine.act(0,{t:'stand'});runTo(()=>B.ph==='settle',10000);
 if(B.ch[0]>=MIN||B.ch.some(x=>x<0)||B.ch.reduce((a,b)=>a+b,0)!==420||B.rs[1]<=B.rs[2])fail('bj hd broke dealer '+B.ch+' '+B.rs);
 runTo(()=>H.phase==='over'||B.ph==='bet',10000);
 if(!H.players[0].finished||H.players[0].rank!==3)fail('bj broke player out '+H.players[0].rank)}
// 7) 판 수를 마치면 칩 순서로 순위 (같으면 같은 순위)
{const B=mkB(3,{chips:100,rounds:1});
 rig([C(9),C(9,1),C(9,2),C(9,3),C(8),C(8,1),C(8,2),C(8,3)]);   // 모두 19, 딜러 10·9=19 → 모두 무승부
 BJ.engine.act(0,{t:'bet',a:10});BJ.engine.act(1,{t:'bet',a:10});BJ.engine.act(2,{t:'bet',a:10});afterDealing();
 [0,1,2].forEach(i=>BJ.engine.act(i,{t:'stand'}));runTo(()=>H.phase==='over',15000);
 if(H.phase!=='over'||H.players.some(p=>p.rank!==1))fail('bj tie ranks '+H.players.map(p=>p.rank))}
// 8) 항복: 베팅 중이면 빠지고, 판 도중이면 건 칩을 잃음
{const B=mkB(3,{chips:100});
 BJ.engine.act(0,{t:'bet',a:10});BJ.engine.act(1,{t:'surrender'});
 if(B.order.includes(1)||H.players[1].rank!==3)fail('bj surrender in bet');
 BJ.engine.act(2,{t:'bet',a:10});if(B.ph!=='deal')fail('bj deal after surrender');
 afterDealing();if(B.ph==='turn'){const i=H.turn;BJ.engine.act(i,{t:'surrender'});if(B.st[i]!==4||H.turn===i)fail('bj surrender in turn')}
 runTo(()=>B.ph==='settle',60000);if(!B.rs)fail('bj no settle after surrender');else if(B.st[0]===4&&B.rs[0]!==-10)fail('bj surrender loses bet')}
// 9) 슈: 판이 바뀌어도 섞지 않고 이어 씀, 다음 판을 나눌 만큼 남지 않을 때만 다시 섞음, 한 통 안에서 같은 카드가 두 번 나오지 않음
{const B=mkB(2,{chips:1000,decks:1,rounds:30});
 if(B.shoe.length!==52||B.sf!==1)fail('bj shoe start '+B.shoe.length);
 const seen=new Set();let sf=B.sf,dup=0,shuf=0,rounds=0;
 for(let r=0;r<14&&H.phase==='play';r++){
   runTo(()=>B.ph==='bet',20000);
   const left=B.shoe.length;[0,1].forEach(i=>BJ.engine.act(i,{t:'bet',a:10}));
   if(B.sf!==sf){shuf++;sf=B.sf;seen.clear();if(left>=(B.order.length+1)*5)fail('bj reshuffled too early '+left)}
   else if(r&&left<(B.order.length+1)*5)fail('bj should reshuffle '+left);
   for(const id of [...B.dc,...B.hc.flat()]){if(seen.has(id))dup++;seen.add(id)}
   afterDealing();while(B.ph==='turn')BJ.engine.act(H.turn,{t:'stand'});runTo(()=>B.ph==='settle'||H.phase==='over',20000);
   for(const id of [...B.dc,...B.hc.flat()])seen.add(id);rounds++;
   if(B.shoe.length+B.disc+B.dc.length+B.hc.flat().length!==52&&B.sf===sf)fail('bj shoe count '+B.shoe.length+'+'+B.disc);
   runTo(()=>B.ph==='bet'||H.phase==='over',20000);
 }
 if(dup)fail('bj duplicate in one shoe '+dup);if(!shuf)fail('bj never reshuffled');if(rounds<8)fail('bj shoe rounds '+rounds)}

/* 봇끼리 끝까지: 인원·칩·판 수·딜러 방식·난이도를 바꿔 가며. 칩 음수 없음, 차례는 늘 남은 사람, 사람 딜러는 칩 총합 그대로, 순위 1~n */
function playOutB(n,over,lvs){
  hostNew(false,'t','t');
  H.cfg={...cfgFor('blackjack'),...over,game:'blackjack'};
  H.members=[];for(let i=0;i<n;i++)H.members.push({name:'b'+i,bot:true,conn:null,host:i===0,lv:lvs[i%lvs.length]});
  let ticks=0;
  for(let g=0;g<2;g++){
    hostStart();
    const total=H.bj.ch.reduce((a,b)=>a+b,0);let guard=0;
    while(H.phase!=='over'&&guard++<200000){
      NOW+=250;engineTick();ticks++;
      const B=H.bj;
      if(B.ch.some(x=>x<0)){fail('bj negative chips '+B.ch);return ticks}
      if(B.hd&&B.ch.reduce((a,b)=>a+b,0)!==total){fail('bj hd chips not conserved');return ticks}
      if(H.phase==='play'&&H.turn>=0&&H.players[H.turn].finished){fail('bj turn on finished');return ticks}
      if(B.ph!=='settle'&&B.ph!=='end'&&B.order.some(i=>B.bt[i]>B.ch[i]&&!H.players[i].finished)){fail('bj bet over chips '+B.ph);return ticks}
      if(B.hc.some(h=>new Set(h).size!==h.length)){fail('bj duplicate card');return ticks}
    }
    if(H.phase!=='over'){fail('bj stuck n='+n+' '+JSON.stringify(over));return ticks}
    const r=H.players.map(p=>p.rank),N=H.players.length;
    if(!r.includes(1)||r.some(x=>!(x>=1&&x<=N))||H.players.some(p=>!p.finished))fail('bj ranks '+r);
    if(H.bj.rd>H.bj.rds)fail('bj too many rounds');
  }
  return ticks;
}
globalThis.playOutB=playOutB;
// 혼자(봇 딜러)도 시작해서 끝까지 감, 사람 딜러는 혼자 시작하지 않음 (공통 코드가 봇을 자동으로 넣지 않음)
{mkB(1,{rounds:3});if(!H.bj||H.players.length!==1)fail('bj solo start');
 if(!runTo(()=>H.phase==='over',600000))fail('bj solo finish');
 hostNew(false,'t','t');H.cfg={...cfgFor('blackjack'),hdeal:1,game:'blackjack'};H.members=[{name:'p0',bot:false,conn:null,host:true}];hostStart();
 if(H.phase!=='wait'||H.members.length!==1)fail('bj human dealer needs 2')}
