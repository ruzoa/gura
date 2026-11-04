/* 보난자 테스트 (tests/engine.test.js가 이 파일을 불러서 { } 블록 안에서 돌림) */
const TT=BN._test;
const eq=(a,b,m)=>{if(a!==b)fail('bohnanza '+m+': '+a+' != '+b)};
const pass=ms=>{for(let k=0;k<ms/50;k++){NOW+=50;engineTick()}};
const setup=(n,bots,over)=>{
  hostNew(false,'t','t');H.cfg={...cfgFor('bohnanza'),game:'bohnanza',...(over||{})};
  H.members=[];for(let i=0;i<n;i++)H.members.push(bots&&i>=bots?{name:'b'+i,bot:true,conn:null,host:false,lv:0}:{name:'p'+i,bot:false,conn:i?{}:null,host:i===0,cid:i?'c'+i:''});
  hostStart();pass(DEAL_MS+100);
};
const act=(s,a)=>BN.engine.act(s,a);
const O=()=>H.bn;
const count=()=>{const o=H.bn;return o.deck.length+o.disc.length+o.up.length+H.players.reduce((v,p,i)=>v+p.hand.length+o.tmp[i].length+o.coin[i].length+o.fd[i].reduce((w,L)=>w+L.length,0),0)};
const idOf=(t,k)=>TT.TYPE.indexOf(t)+(k||0);
const toTrade=()=>{const s=O().act;act(s,{t:'plant',f:0});if(O().ph==='p1')act(s,{t:'skip'});return s};
/* 구성·시세 */
eq(TT.TYPE.length,104,'104 cards');
eq(TT.coinsFor(2,8),4,'stink 8');eq(TT.coinsFor(2,2),0,'stink 2');eq(TT.coinsFor(7,1),0,'garden 1');eq(TT.coinsFor(7,2),2,'garden 2');eq(TT.coinsFor(7,3),3,'garden 3');
eq(TT.nextStep(7,1).at,2,'garden next at');eq(TT.nextStep(7,1).c,2,'garden next coin');eq(TT.nextStep(7,3),null,'garden max');eq(TT.nextStep(0,2).at,4,'blue next');
/* 인원별 밭 */
for(const [n,f] of [[3,3],[4,2],[5,2]]){setup(n);eq(O().fd[0].length,f,n+' fields');eq(H.players.every(p=>p.hand.length===5),true,n+' hand');eq(count(),104,n+' total');eq(O().runs,0,n+' runs')}
/* 1단계: 맨 앞 카드만, 다른 콩은 못 심음, 두 장까지 */
setup(4);{const s=O().act,p=H.players[s];p.hand=[idOf(0),idOf(1),idOf(0,1),idOf(2)];act(s,{t:'skip'});eq(O().ph,'p1','skip needs one');act(s,{t:'plant',f:0});eq(O().fd[s][0].length,1,'planted front');act(s,{t:'plant',f:0});eq(O().fd[s][0].length,1,'wrong bean refused');eq(O().ph,'p1','still p1');act(s,{t:'plant',f:1});eq(O().ph,'trade','two then trade');eq(O().up.length,2,'two turned');eq(p.hand.join(),[idOf(0,1),idOf(2)].join(),'hand order kept')}
/* 빈 손패: 끝난 사람이 아니고 1단계를 건너뜀 */
setup(4);{const s=O().act;H.players[s].hand=[];H.players[(s+1)%4].hand=[];toTradeEmpty(s);}
function toTradeEmpty(s){act(s,{t:'plant',f:0});pass(H.cfg.turn*1000+100);eq(O().ph,'trade','empty hand timeout');eq(H.players[s].finished,false,'empty not finished');eq(H.phase,'play','empty not over')}
/* 새싹 보호법 */
setup(3);{const s=0,a=O().fd[s];a[0]=[idOf(0)];a[1]=[idOf(1),idOf(1,1)];a[2]=[];eq(TT.canHarvest(s,0),false,'protected');act(s,{t:'harvest',f:0});eq(a[0].length,1,'protected refused');
  a[1]=[idOf(1)];eq(TT.canHarvest(s,0),true,'all single ok');act(s,{t:'harvest',f:0});eq(O().fd[s][0].length,0,'single harvest');eq(O().coin[s].length,0,'single no coin')}
/* 수확: 코인 카드는 빠지고 나머지는 버림, 다른 사람 차례에도 */
setup(3);{const s=(O().act+1)%3;O().fd[s][0]=[0,1,2,3,4,5];const c=O().disc.length;act(s,{t:'harvest',f:0});eq(O().coin[s].length,2,'six blue two coins');eq(O().disc.length,c+4,'rest discarded')}
/* 거래: 숨김·양쪽 수락·임시 구역·다시 거래 못 함 */
setup(4);{const s=toTrade(),b=(s+1)%4,c=(s+2)%4,P=H.players;
  P[s].hand=[idOf(2),idOf(0,5)];P[b].hand=[idOf(1,1),idOf(3),idOf(1,2)];
  act(b,{t:'offer',to:c,hand:[idOf(3)]});eq(O().of.length,0,'no side trade');
  act(s,{t:'offer',to:b,hand:[idOf(2)],want:[1]});eq(O().of.length,1,'offer made');
  {const sn=snapFor(b),o=sn.o.of[0],j=JSON.stringify(sn.o.of);eq(o.mh,undefined,'no hand ids to target');eq(o.g.join(),'2','type only');if(j.includes(':'+idOf(2)+',')||j.includes('['+idOf(2)+']'))fail('bohnanza id leaked');eq(snapFor(c).o.of.length,0,'others do not see');eq(snapFor(s).o.of[0].mh.join(),String(idOf(2)),'own ids')}
  const id=O().of[0].id;
  act(b,{t:'accept',id,pick:[idOf(1,1)]});eq(O().of.length,1,'locked first second');
  NOW+=TT.LOCK_MS+1;
  act(b,{t:'accept',id,pick:[idOf(3)]});eq(O().of.length,1,'wrong type refused');
  act(s,{t:'offer',to:b,hand:[idOf(2)],want:[3]});const id2=O().of[0].id;eq(O().of.length,1,'replaced');NOW+=TT.LOCK_MS+1;
  act(b,{t:'accept',id,pick:[idOf(3)]});eq(O().of.length,1,'old offer dead');eq(P[b].hand.length,3,'old no trade');
  act(s,{t:'offer',to:b,hand:[idOf(2)],want:[1]});const id3=O().of[0].id;NOW+=TT.LOCK_MS+1;
  act(b,{t:'accept',id:id3,pick:[idOf(1,2)]});eq(O().tmp[b].join(),String(idOf(2)),'to temp');eq(O().tmp[s].join(),String(idOf(1,2)),'to temp 2');eq(P[b].hand.join(),[idOf(1,1),idOf(3)].join(),'chosen copy leaves');eq(P[s].hand.length,1,'gave');
  act(b,{t:'offer',to:s,hand:[idOf(2)]});eq(O().of.length,0,'temp cannot retrade');
  /* 기증과 거절 */
  act(s,{t:'offer',to:c,gf:[O().up[0]]});const g=O().of[0].id;act(c,{t:'reject',id:g});eq(O().of.length,0,'rejected');
  act(s,{t:'offer',to:c,gf:[O().up[0]]});NOW+=TT.LOCK_MS+1;act(c,{t:'accept',id:O().of[0].id,pick:[]});eq(O().tmp[c].length,1,'gift');eq(O().up.length,1,'gift from up');
  const c0=count();
  /* 거래 끝: 남은 공개 카드는 차례인 사람 임시 구역으로, 순서 자유, 다 심어야 다음 */
  act(b,{t:'end'});eq(O().ph,'trade','only active ends');act(s,{t:'end'});eq(O().ph,'p3','p3');eq(O().up.length,0,'up moved');eq(O().tmp[s].length,2,'kept up');
  const before=s,tm=O().tmp[s].slice().reverse();for(const v of tm){const f=O().fd[s].findIndex((L,k)=>!L.length||TT.TYPE[L[0]]===TT.TYPE[v]);if(f<0){O().fd[s].forEach((L,k)=>{if(TT.canHarvest(s,k))act(s,{t:'harvest',f:k})});act(s,{t:'tplant',id:v,f:O().fd[s].findIndex(L=>!L.length)})}else act(s,{t:'tplant',id:v,f})}
  eq(O().tmp[s].length,0,'free order');eq(O().ph,'p3','wait others');eq(snapFor(b).t,b,'simultaneous turn');
  pass(H.cfg.turn*1000+100);eq(O().act,(before+1)%4,'next turn');eq(P[before].hand.length,4,'drew three');eq(count(),c0,'p3 total')}
/* 시간 초과 자동 심기 */
setup(4);{const s=O().act;H.players[s].hand=[idOf(0),idOf(1)];O().fd[s]=[[idOf(2),idOf(2,1),idOf(2,2)],[idOf(3)]];pass(H.cfg.turn*1000+100);eq(O().ph,'trade','timeout to trade');eq(O().coin[s].length,1,'auto harvest respects law');eq(TT.TYPE[O().fd[s][0][0]],0,'auto planted');
  pass(H.cfg.tt*1000+100);eq(O().ph,'p3','trade timeout')}
/* 끝: 세 번째로 떨어지면 끝, 뽑기 중이면 바로, 남은 밭 수확, 동점은 먼 사람 */
setup(3);{const o=O();const s=o.act;o.runs=2;const keep=o.deck.splice(0,o.deck.length-3);o.disc.push(...keep);toTrade();eq(o.up.length,2,'last two');eq(o.last,0,'one left');act(s,{t:'end'});pass(H.cfg.turn*1000+100);eq(H.phase,'over','ends in draw');eq(count(),104,'over total');eq(H.players.every(p=>p.finished&&p.rank>0),true,'ranked')}
setup(3);{const o=O();const s=o.act;o.runs=2;const keep=o.deck.splice(0,o.deck.length-1);o.disc.push(...keep);toTrade();eq(o.last,1,'ran out in turn over');eq(H.phase,'play','finish planting');eq(o.up.length,1,'one up');act(s,{t:'end'});pass(H.cfg.turn*1000+100);eq(H.phase,'over','ends after p3')}
setup(3);{const o=O();o.first=0;o.coin=[[1],[2],[3]];o.runs=2;o.last=1;o.fd=o.fd.map(a=>a.map(()=>[]));o.tmp=o.tmp.map(()=>[]);o.ph='p3';o.up=[];H.players.forEach(p=>p.hand=[]);o.tmp[0]=[idOf(7)];H.deadline=NOW;pass(200);eq(H.phase,'over','tie over');eq(H.players[2].rank,1,'tie far seat');eq(H.players[0].rank,3,'tie near seat')}
/* 세 번째 밭 사기는 설정이 켜진 4~5명만 */
setup(4);{const o=O();o.coin[1]=[1,2,3];act(1,{t:'buy'});eq(o.fd[1].length,2,'buy off')}
setup(4,0,{buy3:1});{const o=O();o.coin[1]=[1,2,3];act(1,{t:'buy'});eq(o.fd[1].length,3,'buy on');eq(o.coin[1].length,0,'paid')}
/* 봇이 섞인 판: 언제나 끝나고 카드 수가 맞음 */
let trades=0;
for(let rep=0;rep<18;rep++){
  const n=3+rep%3;setup(n,rep%2?1:0.5,{turn:10,tt:20});
  if(!H.players[0])continue;
  for(let k=0;k<160000&&H.phase==='play';k++){
    NOW+=100;
    if(H.bn.ph==='p1'&&H.bn.act===0){const f=H.players[0].hand.length?H.bn.fd[0].findIndex((L,j)=>!L.length||TT.TYPE[L[0]]===TT.TYPE[H.players[0].hand[0]]):-1;if(f>=0)act(0,{t:'plant',f});if(H.bn.ph==='p1')act(0,{t:'skip'})}
    engineTick();
    if(count()!==104){fail('bohnanza count '+count());break}
    for(const a of H.bn.fd)for(const L of a)if(L.some(id=>TT.TYPE[id]!==TT.TYPE[L[0]])){fail('bohnanza mixed field');break}
  }
  eq(H.phase,'over','bots finish n='+n);trades+=H.bn.ts;
}
if(!trades)fail('bohnanza bots never traded');
