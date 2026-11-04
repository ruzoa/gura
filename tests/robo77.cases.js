/* 로보77 테스트 (tests/engine.test.js가 이 파일을 불러서 { } 블록 안에서 돌림) */
const TT=RB._test,D=TT.DECK;
const eq=(a,b,m)=>{if(a!==b)fail('robo77 '+m+': '+a+' != '+b)};
const pass=ms=>{for(let k=0;k<ms/50;k++){NOW+=50;engineTick()}};
const idOf=(f,skip=0)=>{const L=D.map((c,i)=>f(c)?i:-1).filter(i=>i>=0);return L[skip]};
const num=(v,skip=0)=>idOf(c=>c.k==='n'&&c.v===v,skip),X2=(k=0)=>idOf(c=>c.k==='x2',k),REV=(k=0)=>idOf(c=>c.k==='rev',k);
const setup=(n,bots)=>{
  hostNew(false,'t','t');H.cfg={...cfgFor('robo77'),game:'robo77'};
  H.members=[];for(let i=0;i<n;i++)H.members.push(bots&&i>=bots?{name:'b'+i,bot:true,conn:null,host:false,lv:0}:{name:'p'+i,bot:false,conn:i?{}:null,host:i===0,cid:i?'c'+i:''});
  hostStart();pass(DEAL_MS+100);
};
const act=(s,a)=>RB.engine.act(s,a);
const put=(s,id)=>act(s,{t:'play',id});
/* 판을 정해 둠: 0번 차례, 합계 tot */
const at=(tot,hands)=>{const O=H.rb;O.tot=tot;O.need=1;O.played=0;O.two=false;O.dir=1;O.ph='turn';H.turn=0;H.deadline=NOW+60000;H.players.forEach((p,i)=>{if(hands[i])p.hand=hands[i].slice()})};
/* 카드 구성 */
eq(D.length,55,'55 cards');
for(const [f,n,m] of [[c=>c.k==='n'&&c.v===0,4,'zero'],[c=>c.k==='n'&&c.v>=2&&c.v<=9,24,'2-9'],[c=>c.k==='n'&&c.v===10,8,'ten'],[c=>c.dbl,6,'doublets'],[c=>c.top,1,'76'],[c=>c.neg,4,'-10'],[c=>c.k==='x2',4,'x2'],[c=>c.k==='rev',4,'rev']])eq(D.filter(f).length,n,m);
if(!D.every((c,i)=>i<100))fail('robo77 ids under star');
for(const [v,r] of [[11,true],[66,true],[77,true],[80,true],[0,false],[-11,false],[50,false],[76,false]])eq(TT.costs(v),r,'costs '+v);
/* 시작 */
setup(4);eq(H.players.every(p=>p.hand.length===5&&p.chips===3),true,'deal');eq(H.rb.deck.length,35,'deck left');eq(new Set(H.players.flatMap(p=>p.hand).concat(H.rb.deck)).size,55,'no dup');
/* 숨김: 남의 손패는 안 감 */
{const s=snapFor(1);eq(s.ps[0].h,undefined,'other hidden');eq(s.ps[0].cp,3,'chips shown')}
/* 차례가 아니면 못 냄, 없는 카드 못 냄 */
setup(3);at(5,[[num(2),num(3),num(4),num(5),num(6)],[num(7),num(8),num(9),num(10),num(0)],[num(2,1),num(3,1),num(4,1),num(5,1),num(6,1)]]);
put(1,num(7));eq(H.turn,0,'not your turn');put(0,num(9));eq(H.turn,0,'not in hand');
/* 더하고 뽑고 다음 사람 */
put(0,num(5));eq(H.rb.tot,10,'adds');eq(H.players[0].hand.length,5,'draw one');eq(H.turn,1,'next');eq(H.players[0].chips,3,'no loss');
/* 더블릿 */
setup(3);at(19,[[num(3),num(4),num(5),num(6),num(7)]]);put(0,num(3));eq(H.rb.tot,22,'doublet total');eq(H.players[0].chips,2,'doublet loses');eq(H.rb.ph,'turn','round goes on');
/* 더블릿을 카드로 내도 합계가 더블릿이 아니면 잃지 않음 */
setup(3);at(28,[[num(11),num(4),num(5),num(6),num(7)]]);put(0,num(11));eq(H.rb.tot,39,'card 11');eq(H.players[0].chips,3,'card doublet safe');
/* 0·방향·x2로 더블릿을 다시 부르면 잃음 */
for(const f of [()=>num(0),()=>REV(),()=>X2()]){setup(3);at(44,[[f(),num(2),num(3),num(4),num(5)]]);put(0,f());eq(H.rb.tot,44,'same total');eq(H.players[0].chips,2,'repeat doublet loses')}
/* -10: 음수 가능 */
setup(3);at(4,[[idOf(c=>c.neg),num(2),num(3),num(4),num(5)]]);put(0,idOf(c=>c.neg));eq(H.rb.tot,-6,'negative');eq(H.players[0].chips,3,'negative safe');
/* 76은 합계가 0 이하면 안전 */
setup(3);at(0,[[num(76),num(2),num(3),num(4),num(5)]]);put(0,num(76));eq(H.rb.tot,76,'76 ok');eq(H.rb.ph,'turn','76 goes on');
/* 방향 전환 */
setup(4);at(5,[[REV(),num(2),num(3),num(4),num(5)]]);put(0,REV());eq(H.rb.dir,-1,'reversed');eq(H.turn,3,'other way');eq(H.rb.tot,5,'rev keeps');
setup(2);at(5,[[REV(),num(2),num(3),num(4),num(5)]]);put(0,REV());eq(H.turn,1,'two players rev');
/* x2: 다음 사람 2장, 뽑기는 끝에 2장, 첫 장 x2 금지, 둘째 장 x2 가능 */
setup(3);at(5,[[X2(),num(2),num(3),num(4),num(5)],[X2(1),num(6),num(7),num(8),X2(2)]]);put(0,X2());eq(H.turn,1,'x2 next');eq(H.rb.need,2,'two cards');eq(H.rb.tot,5,'x2 keeps');
put(1,X2(1));eq(H.players[1].hand.length,5,'no x2 on x2');put(1,num(6));eq(H.turn,1,'still mine');eq(H.rb.need,1,'one more');eq(H.players[1].hand.length,4,'not drawn yet');
put(1,X2(2));eq(H.players[1].hand.length,5,'drew two');eq(H.turn,2,'then next');eq(H.rb.need,2,'chained x2');
/* x2로 받은 첫 장 방향 전환은 둘째 장 뒤에 그 방향으로 */
setup(4);at(5,[[X2(),num(2),num(3),num(4),num(5)],[REV(),num(6),num(7),num(8),num(9)]]);put(0,X2());put(1,REV());eq(H.turn,1,'rev first');put(1,num(6));eq(H.turn,0,'rev then back');eq(H.rb.tot,11,'x2 second total');eq(H.players[1].chips,2,'second card doublet');
/* 두 장 모두 벌칙이면 2개 */
setup(3);at(9,[[X2(),num(2),num(3),num(4),num(5)],[num(2),num(10,1),num(0),num(3),num(4)]]);put(0,X2());put(1,num(2));eq(H.players[1].chips,2,'first');put(1,num(0));eq(H.players[1].chips,1,'repeat second');
/* 77 이상: 칩 1개, 판 끝, 다음 사람이 새 판 */
setup(3);{const st=H.rb.start,rn=H.rb.rn;at(70,[[num(9),num(2),num(3),num(4),num(5)]]);put(0,num(9));eq(H.rb.tot,79,'over');eq(H.players[0].chips,2,'over loses one');eq(H.rb.ph,'end','round ended');eq(snapFor(1).t,undefined,'no turn at end');
 pass(TT.END_MS+200);eq(H.rb.rn,rn+1,'new round');eq(H.rb.tot,0,'reset');eq(H.rb.dir,1,'dir reset');eq(H.rb.start,(st+1)%3,'starter rotates');eq(H.turn,H.rb.start,'starter plays');eq(H.players.every(p=>p.hand.length===5),true,'new hands');}
/* 77을 맞춰도 1개만 */
setup(3);at(70,[[num(7),num(2),num(3),num(4),num(5)]]);put(0,num(7));eq(H.players[0].chips,2,'exact 77 one chip');eq(H.rb.ph,'end','exact ends');
/* 수영: 불이 다 꺼져도 남고, 한 번 더 잃으면 탈락, 그 판은 이어짐 */
setup(3);H.players[0].chips=1;at(19,[[num(3),num(4),num(5),num(6),num(7)]]);put(0,num(3));eq(H.players[0].chips,0,'swim');eq(H.players[0].finished,false,'swim alive');
at(19,[[num(3),num(4),num(5),num(6),num(7)]]);put(0,num(3));eq(H.players[0].finished,true,'out');eq(H.players[0].rank,3,'out rank');eq(H.players[0].hand.length,0,'out hand');eq(H.rb.ph,'turn','others go on');eq(H.turn,1,'next after out');
/* 탈락한 사람은 건너뜀 + 시작 칸도 건너뜀 */
setup(4);H.players[1].finished=true;H.players[1].rank=4;H.players[1].hand=[];H.rb.rank=3;at(5,[[num(2),num(3),num(4),num(5),num(6)]]);put(0,num(2));eq(H.turn,2,'skips out');
/* 둘 남고 하나 탈락하면 끝 */
setup(2);H.players[1].chips=0;H.turn=1;H.rb.tot=19;H.players[1].hand=[num(3),num(4),num(5),num(6),num(7)];put(1,num(3));eq(H.phase,'over','game over');eq(H.players[0].rank,1,'winner');eq(H.players[1].rank,2,'loser');
/* 제한 시간: 낼 수 있는 카드가 나감 (x2는 안 됨) */
setup(3);at(5,[[X2(),num(2),num(3),num(4),num(5)],[X2(1),X2(2),X2(3),num(6),num(7)]]);put(0,X2());H.deadline=NOW+10;pass(100);eq(H.rb.played,1,'timeout plays');eq(D[H.rb.disc[H.rb.disc.length-1]].k,'n','timeout not x2');
/* 뽑을 더미가 없으면 맨 위만 남기고 섞음 */
setup(3);{const O=H.rb,p=H.players[0];at(5,[[num(2),num(3),num(4),num(5),num(6)]]);const rest=O.deck.slice();O.disc=rest;O.deck=[];put(0,num(2));eq(p.hand.length,5,'reshuffle draw');eq(O.disc.length,1,'top stays');eq(O.deck.length,rest.length,'deck back')}
/* 항복: 차례면 넘어가고, 시작 자리면 다음 판도 안 틀어짐 */
setup(3);at(5,[[num(2),num(3),num(4),num(5),num(6)]]);act(0,{t:'surrender'});eq(H.players[0].finished,true,'surrender');eq(H.turn,1,'surrender passes');act(1,{t:'surrender'});eq(H.phase,'over','last wins');
/* 봇 판: 끝까지 가고 카드가 틀어지지 않음 */
for(let rep=0;rep<30;rep++){
  const n=2+rep%7;setup(n,1);
  for(let k=0;k<60000&&H.phase==='play';k++){
    NOW+=200;
    if(H.rb.ph==='turn'&&H.turn===0&&!H.players[0].finished){const p=H.players[0],L=p.hand.filter(id=>!(H.rb.need===2&&D[id].k==='x2'));put(0,L[Math.random()*L.length|0])}
    engineTick();
    if(!dealing()&&H.rb.ph==='turn'){
      const all=H.players.flatMap(p=>p.hand).concat(H.rb.deck,H.rb.disc);
      if(new Set(all).size!==all.length)fail('robo77 duplicate card');
      if(all.length!==55)fail('robo77 card count '+all.length);
      H.players.forEach((p,i)=>{if(!p.finished&&p.hand.length>5)fail('robo77 hand size')});
    }
  }
  eq(H.phase,'over','bots finish n='+n);
  eq(H.players.filter(p=>p.rank===1).length,1,'one winner');
  eq(new Set(H.players.map(p=>p.rank)).size,n,'ranks');
}
