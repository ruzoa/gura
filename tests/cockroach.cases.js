/* 바퀴벌레 포커 테스트 (tests/engine.test.js가 이 파일을 불러서 { } 블록 안에서 돌림) */
const TT=CP._test,K=TT.kindOf;
const eq=(a,b,m)=>{if(a!==b)fail('cockroach '+m+': '+a+' != '+b)};
const pass=ms=>{for(let k=0;k<ms/50;k++){NOW+=50;engineTick()}};
const setup=(n,bots,over)=>{
  hostNew(false,'t','t');H.cfg={...cfgFor('cockroach'),game:'cockroach',...(over||{})};
  H.members=[];for(let i=0;i<n;i++)H.members.push(bots&&i>=bots?{name:'b'+i,bot:true,conn:null,host:false,lv:0}:{name:'p'+i,bot:false,conn:i?{}:null,host:i===0,cid:i?'c'+i:''});
  hostStart();pass(DEAL_MS+100);
};
const act=(s,a)=>CP.engine.act(s,a);
const colSum=()=>H.cp.col.reduce((a,c)=>a+c.reduce((x,y)=>x+y,0),0);
const total=()=>H.players.reduce((a,p)=>a+p.hand.length,0)+colSum()+(H.cp.cur?1:0);
/* 0번 차례(넘기기)로 맞춰 둠 */
const at0=()=>{H.cp.ph='give';H.cp.cur=null;H.cp.sh=null;H.turn=0;H.deadline=NOW+60000;H.botActAt=0};
const cardOf=(s,k)=>H.players[s].hand.find(x=>K(x)===k);
const anyKind=s=>K(H.players[s].hand[0]);

/* 나누기: 64장 모두, 고르게, 겹침 없음 */
for(const n of [2,3,4,5,6]){setup(n);eq(total(),64,n+' all dealt');const L=H.players.map(p=>p.hand.length);eq(Math.max(...L)-Math.min(...L)<=1,true,n+' even');eq(new Set(H.players.flatMap(p=>p.hand)).size,64,n+' no dup')}
/* 숨김 */
setup(3);{const s=snapFor(1);eq(s.ps[0].h,undefined,'other hand hidden');eq(Array.isArray(s.ps[1].h),true,'own hand')}
/* 진짜를 말하고 '진짜'로 맞힘 → 넘긴 사람이 가져감, 그 사람이 다음 차례 */
setup(3);at0();{const k=anyKind(0),id=cardOf(0,k),h0=H.players[0].hand.length;
  act(1,{t:'give',id,cl:k,to:2});eq(H.cp.ph,'give','not your turn');
  act(0,{t:'give',id,cl:k,to:0});eq(H.cp.ph,'give','not to self');
  act(0,{t:'give',id,cl:9,to:1});eq(H.cp.ph,'give','bad kind');
  act(0,{t:'give',id,cl:k,to:1});eq(H.cp.ph,'ask','given');eq(H.turn,1,'receiver turn');eq(H.players[0].hand.length,h0-1,'left hand');
  eq(snapFor(2).cp.id,undefined,'card hidden from others');eq(snapFor(1).cp.id,undefined,'card hidden from receiver');eq(snapFor(0).cp.id,id,'giver knows');eq(snapFor(1).cp.cl,k,'claim shown');
  act(1,{t:'ans',v:1});eq(H.cp.ph,'show','show');eq(H.cp.sh.ok,1,'right');eq(snapFor(2).cp.id,id,'shown to all');eq(snapFor(2).t,undefined,'no turn while showing');
  pass(TT.SHOW_MS+100);eq(H.cp.col[0][k],1,'giver takes');eq(H.turn,0,'taker starts');eq(H.cp.ph,'give','next give');eq(total(),64,'cards kept')}
/* 거짓말에 '진짜'라고 하면 받은 사람이 가져감 */
setup(3);at0();{const k=anyKind(0),id=cardOf(0,k),lie=(k+1)%8;
  act(0,{t:'give',id,cl:lie,to:2});act(2,{t:'ans',v:1});eq(H.cp.sh.ok,0,'wrong');pass(TT.SHOW_MS+100);eq(H.cp.col[2][k],1,'receiver takes');eq(H.turn,2,'receiver starts')}
/* 거짓말에 '가짜' → 넘긴 사람 */
setup(3);at0();{const k=anyKind(0),id=cardOf(0,k);act(0,{t:'give',id,cl:(k+3)%8,to:1});act(1,{t:'ans',v:0});pass(TT.SHOW_MS+100);eq(H.cp.col[0][k],1,'liar caught')}
/* 넘기기: 보고 안 본 사람에게만, 말 바꾸기, 마지막 사람은 넘길 수 없음 */
setup(4);at0();{const k=anyKind(0),id=cardOf(0,k);
  act(0,{t:'give',id,cl:k,to:1});act(1,{t:'pass',cl:2,to:2});eq(H.cp.ph,'ask','must peek first');
  act(1,{t:'peek'});eq(H.cp.ph,'peek','peeking');eq(H.turn,1,'still mine');eq(snapFor(1).cp.id,id,'peeker sees');eq(snapFor(2).cp.id,undefined,'others not');
  act(1,{t:'pass',cl:2,to:0});eq(H.cp.ph,'peek','not back to giver');act(1,{t:'pass',cl:2,to:1});eq(H.cp.ph,'peek','not self');
  act(1,{t:'pass',cl:(k+2)%8,to:2});eq(H.cp.ph,'ask','passed');eq(H.turn,2,'to 2');eq(H.cp.cur.fr,1,'claimer now 1');eq(H.cp.cur.cl,(k+2)%8,'new claim');
  eq(JSON.stringify(snapFor(3).cp.sn),'[0,1]','seen list');
  act(2,{t:'peek'});act(2,{t:'pass',cl:k,to:3});eq(H.turn,3,'to 3');
  act(3,{t:'peek'});eq(H.cp.ph,'ask','everyone saw: no peek');
  act(3,{t:'ans',v:1});eq(H.cp.sh.ok,1,'claim true');pass(TT.SHOW_MS+100);eq(H.cp.col[2][k],1,'last passer takes')}
/* 2명: 넘길 수 없음 */
setup(2);at0();{const id=H.players[0].hand[0];act(0,{t:'give',id,cl:K(id),to:1});act(1,{t:'peek'});eq(H.cp.ph,'ask','2p no peek')}
/* 지는 장수: 같은 종류가 모이면 패배, 한 사람만 짐 */
setup(3);at0();{const k=anyKind(0),id=cardOf(0,k);H.cp.col[1][k]=3;act(0,{t:'give',id,cl:(k+1)%8,to:1});act(1,{t:'ans',v:1});pass(TT.SHOW_MS+100);
  eq(H.phase,'over','lost');eq(H.players[1].rank,3,'loser last');eq(H.players[0].rank,1,'others win');eq(H.players[2].rank,1,'others win 2');eq(snapFor(0).cp.lo.s,1,'lo seat');eq(snapFor(0).cp.lo.k,k,'lo kind')}
setup(3,0,{lose:3});at0();{const k=anyKind(0),id=cardOf(0,k);H.cp.col[1][k]=2;act(0,{t:'give',id,cl:k,to:1});act(1,{t:'ans',v:0});pass(TT.SHOW_MS+100);eq(H.phase,'over','lose 3')}
setup(3,0,{lose:5});at0();{const k=anyKind(0),id=cardOf(0,k);H.cp.col[1][k]=3;act(0,{t:'give',id,cl:k,to:1});act(1,{t:'ans',v:0});pass(TT.SHOW_MS+100);eq(H.phase,'play','lose 5 not yet')}
/* 내 차례에 손패가 없으면 패배 */
setup(3);at0();{const k=anyKind(1),id=cardOf(0,anyKind(0));H.players[1].hand=[];act(0,{t:'give',id,cl:(K(id)+1)%8,to:1});act(1,{t:'ans',v:1});pass(TT.SHOW_MS+100);eq(H.phase,'over','empty hand loses');eq(H.cp.lo.why,'empty','why empty');eq(H.players[1].rank,3,'empty loser')}
/* 시간 초과: 넘기기·고르기·본 뒤 넘기기 모두 무작위로 진행 */
setup(3,0,{turn:10});at0();H.deadline=NOW+10000;pass(10200);eq(H.cp.ph,'ask','timeout gives');{const t=H.turn;pass(10200);eq(H.cp.ph,'show','timeout answers')}
setup(3,0,{turn:10});at0();{const id=H.players[0].hand[0];act(0,{t:'give',id,cl:0,to:1});act(1,{t:'peek'});pass(10200);eq(H.cp.ph,'ask','timeout passes');eq(H.turn,2,'to unseen')}
/* 항복: 그 사람이 지고 끝 */
setup(4);at0();act(2,{t:'surrender'});eq(H.phase,'over','surrender ends');eq(H.players[2].rank,4,'surrender loses');eq(snapFor(0).ps[2].sr,1,'sr');
/* 봇끼리: 끝까지, 카드 보존, 진 사람 한 명 */
for(let r=0;r<60;r++){
  const n=2+(r%5);setup(n,1,{lose:3+(r%3),turn:30});H.players[0].bot=true;H.players[0].lv=0;H.botActAt=NOW+500;
  let g=0;while(H.phase==='play'&&g++<20000){NOW+=250;engineTick();if(total()!==64){fail('cockroach cards '+total());break}}
  if(H.phase!=='over'){fail('cockroach stuck n='+n);continue}
  const ranks=H.players.map(p=>p.rank);if(ranks.filter(x=>x===n).length!==1||ranks.filter(x=>x===1).length!==n-1)fail('cockroach ranks '+ranks);
  const lo=H.cp.lo;if(lo.why==='col'&&H.cp.col[lo.s][lo.k]<loseOf())fail('cockroach lose count');
  if(lo.why==='sur')fail('cockroach bots surrendered');
}
function loseOf(){return +H.cfg.lose}
console.log('cockroach ok');
