/* 구라! 다이스 테스트 (tests/engine.test.js가 이 파일을 불러서 { } 블록 안에서 돌림) */
const TT=LD._test,mq=TT.minQ;
const eq=(a,b,m)=>{if(a!==b)fail('liardice '+m+': '+a+' != '+b)};
const pass=ms=>{for(let k=0;k<ms/50;k++){NOW+=50;engineTick()}};
const setup=(n,bots,over)=>{
  hostNew(false,'t','t');H.cfg={...cfgFor('liardice'),game:'liardice',...(over||{})};
  H.members=[];for(let i=0;i<n;i++)H.members.push(bots&&i>=bots?{name:'b'+i,bot:true,conn:null,host:false,lv:0}:{name:'p'+i,bot:false,conn:i?{}:null,host:i===0,cid:i?'c'+i:''});
  hostStart();pass(4000);rollAll();
};
const act=(s,a)=>LD.engine.act(s,a);
function rollAll(){H.players.forEach((p,i)=>{if(!p.finished)LD.engine.act(i,{t:'roll'})});pass(TT.SETTLE_MS+100)}
/* 0번 차례, 주사위를 정해 둠 */
const at0=dice=>{const O=H.ld;O.ph='bid';O.bid=null;O.sh=null;H.turn=0;H.deadline=NOW+60000;H.botActAt=0;if(dice)O.dice=dice.map(d=>d.slice())};
const R0={wild:0,pal:false,free:false},RW={wild:1,pal:false,free:false};

/* 선언 규칙 */
eq(mq(null,1,R0),1,'open 1 no wild');eq(mq(null,1,RW),Infinity,'open 1 wild');eq(mq(null,4,RW),1,'open 4 wild');
eq(mq({q:3,f:4},5,R0),3,'same count higher face');eq(mq({q:3,f:4},2,R0),4,'lower face needs more');eq(mq({q:3,f:4},4,R0),4,'same face +1');
eq(mq({q:5,f:4},1,RW),3,'to ones half up');eq(mq({q:4,f:4},1,RW),2,'to ones half');eq(mq({q:3,f:1},5,RW),7,'from ones 2q+1');eq(mq({q:3,f:1},1,RW),4,'ones +1');
eq(mq({q:3,f:4},1,R0),4,'no wild: 1 is lowest');
eq(mq({q:3,f:4},5,{wild:1,pal:true,free:false}),Infinity,'palifico locked face');eq(mq({q:3,f:4},4,{wild:1,pal:true,free:false}),4,'palifico +1');
eq(mq({q:3,f:4},2,{wild:1,pal:true,free:true}),4,'palifico free player changes face');eq(mq(null,1,{wild:1,pal:true,free:false}),1,'palifico open ones ok');
eq(TT.countOf([[1,2,4],[4,4,6]],4,R0),3,'count no wild');eq(TT.countOf([[1,2,4],[4,4,6]],4,RW),4,'count wild');eq(TT.countOf([[1,1,4]],1,RW),2,'count ones');
eq(TT.countOf([[1,2,4],[4,4,6]],4,{wild:1,pal:true}),3,'palifico ones not wild');

/* 시작: 주사위 5개, 생명 3, 숨김 */
setup(3);{eq(H.ld.ph,'bid','bidding after intro+roll');eq(H.ld.dice.every(d=>d.length===5),true,'5 dice');eq(H.players.every(p=>p.lv===3),true,'3 lives');
  const s=snapFor(1);eq(JSON.stringify(s.ld.my),JSON.stringify(H.ld.dice[1]),'own dice');eq(s.ld.all,undefined,'others hidden');eq(s.ld.T,15,'total')}
/* 선언: 차례·올리기 검사 */
setup(3);at0([[2,2,3,5,6],[2,4,4,4,6],[1,2,3,5,5]]);
act(1,{t:'bid',q:1,f:2});eq(H.ld.bid,null,'not your turn');
act(0,{t:'bid',q:0,f:2});act(0,{t:'bid',q:16,f:2});act(0,{t:'bid',q:2,f:7});eq(H.ld.bid,null,'bad bid');
act(0,{t:'bid',q:3,f:4});eq(H.ld.bid.q,3,'bid');eq(H.turn,1,'next');
act(1,{t:'bid',q:3,f:3});eq(H.ld.bid.f,4,'must raise');act(1,{t:'bid',q:3,f:5});eq(H.ld.bid.f,5,'higher face same count');
act(2,{t:'bid',q:4,f:2});eq(H.ld.bid.q,4,'more count lower face');
/* 구라!: 선언이 맞음(2가 4개) → 외친 사람 -1, 그 사람부터 */
act(2,{t:'gura'});eq(H.ld.ph,'bid','bidder cannot call');
act(1,{t:'gura'});eq(H.ld.ph,'show','called by anyone');eq(H.ld.sh.n,4,'count 2s');eq(H.ld.sh.res,'true','true');eq(snapFor(0).ld.all.length,3,'shown to all');eq(snapFor(0).t,undefined,'no turn while showing');
eq(H.players[1].lv,3,'not yet (after show)');pass(H.ld.sh.ms+100);eq(H.players[1].lv,2,'caller lost');eq(H.ld.ph,'roll','new roll');eq(H.ld.start,1,'loser starts');rollAll();eq(H.turn,1,'loser turn')
/* 구라!: 선언이 틀림 → 선언한 사람 -1 */
setup(3);at0([[2,2,3,5,6],[2,4,4,4,6],[1,2,3,5,5]]);act(0,{t:'bid',q:5,f:2});act(2,{t:'gura'});eq(H.ld.sh.res,'lie','lie');pass(H.ld.sh.ms+100);eq(H.players[0].lv,2,'bidder lost');eq(H.ld.start,0,'bidder starts');
/* 1 와일드 */
setup(3,0,{wild:1});at0([[2,2,3,5,6],[1,4,4,4,6],[1,1,3,5,5]]);act(0,{t:'bid',q:1,f:1});eq(H.ld.bid,null,'no open ones');
act(0,{t:'bid',q:5,f:4});act(1,{t:'bid',q:2,f:1});eq(H.ld.bid.f,4,'ones too low');act(1,{t:'bid',q:3,f:1});eq(H.ld.bid.f,1,'ones half');
act(2,{t:'bid',q:6,f:4});eq(H.ld.bid.f,1,'from ones needs 7');act(2,{t:'bid',q:7,f:4});eq(H.ld.bid.q,7,'2q+1');
act(0,{t:'gura'});eq(H.ld.sh.n,6,'4s + ones');eq(H.ld.sh.res,'lie','7 > 6');
/* 탈락·끝: 생명 1 */
setup(2,0,{lives:1});at0([[2,2,3,5,6],[2,4,4,4,6]]);act(0,{t:'bid',q:9,f:2});act(1,{t:'gura'});pass(H.ld.sh.ms+100);eq(H.phase,'over','over');eq(H.players[1].rank,1,'winner');eq(H.players[0].rank,2,'loser');
/* 주사위 잃기 */
setup(3,0,{dl:1});at0([[2,2,3,5,6],[2,4,4,4,6],[1,2,3,5,5]]);act(0,{t:'bid',q:9,f:2});act(1,{t:'gura'});pass(H.ld.sh.ms+100);eq(H.players[0].dc,4,'lost a die');eq(H.ld.dice[0].length,4,'rolls 4');eq(H.players[0].lv,3,'lives untouched');
/* spot on: 구라!에 정확 → 선언한 사람 빼고 모두 -1 */
setup(4,0,{spot:1});at0([[2,2,3,5,6],[2,4,4,4,6],[1,2,3,5,5],[6,6,6,6,6]]);act(0,{t:'bid',q:4,f:2});act(2,{t:'gura'});eq(H.ld.sh.res,'spot','spot on');pass(H.ld.sh.ms+100);
  eq(H.players.map(p=>p.lv).join(),'3,2,2,2','all but bidder');eq(H.ld.start,2,'caller starts');
/* 도전: 정확 → 나 빼고 모두 -1, 아니면 나 -1, 차례에만 */
setup(3,0,{spot:1});at0([[2,2,3,5,6],[2,4,4,4,6],[1,2,3,5,5]]);act(0,{t:'bid',q:4,f:2});act(2,{t:'exact'});eq(H.ld.ph,'bid','exact only on turn');act(1,{t:'exact'});eq(H.ld.sh.res,'xok','challenge ok');pass(H.ld.sh.ms+100);eq(H.players.map(p=>p.lv).join(),'2,3,2','challenge hits others');
setup(3,0,{spot:1});at0([[2,2,3,5,6],[2,4,4,4,6],[1,2,3,5,5]]);act(0,{t:'bid',q:3,f:2});act(1,{t:'exact'});eq(H.ld.sh.res,'xno','challenge fail');pass(H.ld.sh.ms+100);eq(H.players[1].lv,2,'challenger lost');
/* 칼사: 맞으면 +1(처음 개수까지), 틀리면 -1 */
setup(3,0,{calza:1,dl:1});at0([[2,2,3,5,6],[2,4,4,4,6],[1,2,3,5,5]]);H.players[1].dc=4;H.ld.dice[1]=[2,4,4,4];act(0,{t:'bid',q:4,f:2});act(1,{t:'exact'});eq(H.ld.sh.res,'cok','calza ok');pass(H.ld.sh.ms+100);eq(H.players[1].dc,5,'calza regains');
setup(3,0,{calza:1});at0([[2,2,3,5,6],[2,4,4,4,6],[1,2,3,5,5]]);act(0,{t:'bid',q:4,f:2});act(1,{t:'exact'});pass(H.ld.sh.ms+100);eq(H.players[1].lv,3,'calza capped at start');
/* spot·calza 함께 켜지지 않음 */
{const old=H.cfg;H.cfg={...old,spot:1,calza:0};const c=LD.fixCfg({...H.cfg,calza:1},3,true);eq(c.spot+c.calza,1,'exclusive');eq(c.calza,1,'newest wins');H.cfg=old}
/* 팔리피코: 1개 남은 사람부터, 1 와일드 아님, 눈 고정 */
setup(3,0,{wild:1,dl:1,pal:1});at0([[2,2,3,5,6],[2,4,4,4,6],[1,2,3,5,5]]);H.players[0].dc=2;H.ld.dice[0]=[2,2];act(0,{t:'bid',q:9,f:2});act(1,{t:'gura'});pass(H.ld.sh.ms+100);
  eq(H.ld.pal,0,'palifico round');eq(H.ld.start,0,'pal player starts');rollAll();
  H.ld.dice=[[3],[1,1,4,4,6],[2,5,5,6,6]];act(0,{t:'bid',q:1,f:1});eq(H.ld.bid&&H.ld.bid.f,1,'open ones in palifico');act(1,{t:'bid',q:2,f:4});eq(H.ld.bid.f,1,'face locked');act(1,{t:'bid',q:2,f:1});act(2,{t:'gura'});eq(H.ld.sh.n,2,'ones count');
  pass(H.ld.sh.ms+100);eq(H.ld.pal,-1,'one palifico only');
/* 시간 초과: 선언 없으면 가장 낮은 선언, 있으면 구라! */
setup(3,0,{turn:10});at0([[2,2,3,5,6],[2,4,4,4,6],[1,2,3,5,5]]);H.deadline=NOW+10000;pass(10200);eq(H.ld.bid&&H.ld.bid.q,1,'timeout opens');eq(H.ld.bid.f,2,'most common face');pass(10200);eq(H.ld.ph,'show','timeout calls');
/* 항복: 차례인 사람이면 다시 굴림 */
setup(3);at0();act(0,{t:'surrender'});eq(H.players[0].finished,true,'surrender out');eq(H.ld.ph,'roll','reroll');eq(H.ld.start,1,'next starts');
setup(2);at0();act(1,{t:'surrender'});eq(H.phase,'over','2p surrender ends');eq(H.players[0].rank,1,'other wins');
/* 봇끼리: 끝까지, 승자 한 명 */
for(const over of [{},{wild:1,dl:1,calza:1,pal:1},{spot:1,lives:2}]){
  for(let g=0;g<8;g++){
    setup(4,1,over);let k=0;while(H.phase==='play'&&k++<40000){NOW+=100;engineTick();if(H.players[0].bot===false&&H.ld.ph==='bid'&&H.turn===0)LD._test.botAct(0)}
    if(H.phase!=='over')fail('liardice bots did not finish '+JSON.stringify(over));
    eq(H.players.filter(p=>p.rank===1).length,1,'one winner');
  }
}
console.log('liardice ok');

/* 굴리기: 흔들기·엎기, 다 엎어야 선언 시작, 10초면 저절로, 봇은 알아서 */
setup(3);at0();{const O=H.ld;act(0,{t:'bid',q:1,f:2});act(1,{t:'gura'});pass(O.sh.ms+100);eq(H.ld.ph,'roll','roll phase');
  act(2,{t:'shake',on:1});eq(H.ld.shk[2],1,'shaking');eq(snapFor(0).ld.sk[2],1,'shake shown');act(2,{t:'roll'});eq(H.ld.rolled[2],1,'rolled');eq(H.ld.shk[2],0,'stop shaking');
  pass(2000);eq(H.ld.ph,'roll','waits for all');eq(snapFor(0).t,undefined,'no turn while rolling');act(0,{t:'roll'});act(1,{t:'roll'});pass(TT.SETTLE_MS+100);eq(H.ld.ph,'bid','all rolled')}
setup(3);at0();{act(0,{t:'bid',q:1,f:2});act(1,{t:'gura'});pass(H.ld.sh.ms+100);pass(TT.ROLL_WAIT+TT.SETTLE_MS+200);eq(H.ld.ph,'bid','auto roll after 10s')}
setup(3,1);{act(0,{t:'bid',q:1,f:2});}
setup(3,1);at0();{act(0,{t:'bid',q:1,f:2});act(1,{t:'gura'});pass(H.ld.sh.ms+100);act(0,{t:'roll'});pass(3500);eq(H.ld.rolled.every(Boolean),true,'bots roll themselves');eq(H.ld.ph,'bid','bid after bots')}
/* 들춰 보기: 선언 단계에만, 모두에게 들린 것만 */
setup(3);at0();act(2,{t:'peek',on:1});eq(snapFor(0).ld.pk[2],1,'peek shown');eq(snapFor(0).ld.all,undefined,'dice still hidden');act(2,{t:'peek',on:0});eq(H.ld.pk[2],0,'peek off');
console.log('liardice roll ok');
