/* 원카드 테스트 (tests/engine.test.js가 이 파일을 불러서 { } 블록 안에서 돌림) */
const TT=OC._test,K=TT.kindOf;
const eq=(a,b,m)=>{if(a!==b)fail('onecard '+m+': '+a+' != '+b)};
const pass=ms=>{for(let k=0;k<ms/50;k++){NOW+=50;engineTick()}};
const num=(r,s)=>r*4+s,TWO=s=>40+s,REV=s=>44+s,SKIP=s=>48+s,WILD=k=>52+k,FOUR=k=>56+k;
const setup=(n,cfg,bots)=>{
  hostNew(false,'t','t');H.cfg={...cfgFor('onecard'),game:'onecard',stack:0,fast:0,...cfg};
  H.members=[];for(let i=0;i<n;i++)H.members.push(bots&&i>=bots?{name:'b'+i,bot:true,conn:null,host:false,lv:0}:{name:'p'+i,bot:false,conn:i?{}:null,host:i===0,cid:i?'c'+i:''});
  hostStart();pass(DEAL_MS+100);
};
const act=(s,a)=>OC.engine.act(s,a);
const put=(s,id,suit)=>act(s,{t:'play',id,suit});
/* 판을 정해 둠: 0번 차례, 맨 위 top */
const at=(top,hands,o)=>{const O=H.oc;H.players.forEach((p,i)=>{if(hands[i])p.hand=hands[i].slice()});
  const used=new Set(H.players.flatMap(p=>p.hand).concat(top));O.deck=[...Array(60).keys()].filter(x=>!used.has(x));O.disc=[top];
  Object.assign(O,{suit:top<52?top&3:0,dir:1,atk:0,ch:null,drawn:-1,uno:-1,grace:0,botCall:null,ph:'turn',rv:null},o);H.turn=0;H.deadline=NOW+60000;H.botActAt=0};
/* 카드 구성 */
{const D=TT.DECK;eq(D.length,60,'60 cards');for(const [k,n] of [['n',40],['two',4],['rev',4],['skip',4],['wild',4],['four',4]])eq(D.filter(x=>K(x)===k).length,n,'count '+k)}
/* 시작: 7장, 첫 카드는 숫자 */
setup(4);eq(H.players.every(p=>p.hand.length===7),true,'deal');eq(K(H.oc.disc[0]),'n','start number');eq(new Set(H.players.flatMap(p=>p.hand).concat(H.oc.deck,H.oc.disc)).size,60,'no dup');
for(let r=0;r<30;r++){setup(2);eq(K(H.oc.disc[0]),'n','start number '+r)}
setup(6,{hand:8});eq(H.oc.deck.length,11,'six players eight cards');
/* 숨김 */
setup(3);{const s=snapFor(1);eq(s.ps[0].h,undefined,'other hidden');eq(s.o.deck,undefined,'deck hidden')}
/* 낼 수 있는 카드 */
{const S=(top,suit,o)=>({top,suit,atk:0,stack:false,...o});
 for(const [id,top,suit,r,m] of [[num(3,1),num(5,1),1,true,'suit'],[num(5,2),num(5,1),1,true,'rank'],[num(3,2),num(5,1),1,false,'neither'],[REV(1),REV(2),2,true,'symbol'],[TWO(0),TWO(3),3,true,'two on two'],[SKIP(1),REV(0),0,false,'other symbol'],[num(0,0),WILD(0),3,false,'wild suit'],[num(0,3),WILD(0),3,true,'wild suit ok'],[WILD(1),num(2,0),0,true,'wild'],[FOUR(1),num(2,0),0,true,'four any time'],[num(1,0),TWO(0),1,false,'suit changed']])eq(TT.fits(id,S(top,suit)),r,'fits '+m);
 const A=(top,suit)=>({top,suit,atk:2,stack:true});
 eq(TT.fits(TWO(2),A(TWO(1),1)),true,'two on two any suit');eq(TT.fits(FOUR(0),A(TWO(1),1)),true,'four on two');eq(TT.fits(num(1,1),A(TWO(1),1)),false,'number on attack');
 eq(TT.fits(FOUR(1),A(FOUR(0),2)),true,'four on four');eq(TT.fits(TWO(2),A(FOUR(0),2)),true,'two of named suit on four');eq(TT.fits(TWO(1),A(FOUR(0),2)),false,'two of other suit on four');eq(TT.fits(WILD(0),A(FOUR(0),2)),false,'wild on attack');
 eq(TT.fits(TWO(1),{top:FOUR(0),suit:1,atk:4,stack:false}),false,'no stack')}
/* 차례·없는 카드·틀린 카드 */
setup(3);at(num(5,1),[[num(3,1),num(4,2),num(6,0)],[num(7,1),num(8,1)],[num(2,0),num(2,2)]]);
put(1,num(7,1));eq(H.turn,0,'not your turn');put(0,num(9,1));eq(H.turn,0,'not in hand');put(0,num(4,2));eq(H.turn,0,'not fitting');
put(0,num(3,1));eq(H.oc.suit,1,'suit');eq(H.turn,1,'next');
/* 숫자 카드에는 능력 없음: 2, 7, A */
for(const r of [0,1,6]){setup(3);at(num(5,1),[[num(r,1),num(4,2),num(6,0)]]);const h=H.players[1].hand.length;put(0,num(r,1));eq(H.turn,1,'plain '+r);eq(H.oc.atk,0,'no atk');eq(H.players[1].hand.length,h,'no draw')}
/* +2: 겹치기 꺼짐이면 바로 먹고 건너뜀 */
setup(3);at(num(5,1),[[TWO(1),num(4,2),num(6,0)],[num(1,0),num(2,0)]]);put(0,TWO(1));eq(H.players[1].hand.length,4,'+2 draws');eq(H.turn,2,'+2 skips');eq(H.oc.atk,0,'+2 done');
/* 금지 */
setup(4);at(num(5,1),[[SKIP(1),num(4,2),num(6,0)]]);put(0,SKIP(1));eq(H.turn,2,'skip');
setup(2);at(num(5,1),[[SKIP(1),num(4,2),num(6,0)]]);put(0,SKIP(1));eq(H.turn,0,'skip two players');
/* 리버스 */
setup(4);at(num(5,1),[[REV(1),num(4,2),num(6,0)]]);put(0,REV(1));eq(H.oc.dir,-1,'reversed');eq(H.turn,3,'rev back');
setup(2);at(num(5,1),[[REV(1),num(4,2),num(6,0)]]);put(0,REV(1));eq(H.turn,0,'rev two players = skip');
setup(3);H.players[2].finished=true;H.players[2].rank=3;H.players[2].hand=[];H.oc.rankHi=2;at(num(5,1),[[REV(1),num(4,2),num(6,0)]]);put(0,REV(1));eq(H.turn,0,'rev two alive = skip');
/* 색 바꾸기: 무늬를 안 고르면 못 냄, 고르면 그 무늬 */
setup(3);at(num(5,1),[[WILD(0),num(4,2),num(6,0)]]);put(0,WILD(0));eq(H.turn,0,'wild needs suit');put(0,WILD(0),7);eq(H.turn,0,'wild bad suit');put(0,WILD(0),3);eq(H.oc.suit,3,'wild suit');eq(H.turn,1,'wild next');
/* 뽑기: 못 내면 넘어감, 낼 수 있으면 내거나 넘김, 그 카드만 낼 수 있음 */
setup(3);at(num(5,1),[[num(4,2),num(6,0)]],{});H.oc.deck.push(num(1,0));act(0,{t:'draw'});eq(H.players[0].hand.length,3,'drew');eq(H.turn,1,'unplayable passes');
setup(3);at(num(5,1),[[num(4,1),num(6,0)]]);H.oc.deck=H.oc.deck.filter(x=>x!==num(1,1));H.oc.deck.push(num(1,1));act(0,{t:'draw'});eq(H.turn,0,'can play drawn');eq(snapFor(0).o.dr,num(1,1),'drawn snap');eq(snapFor(1).o.dr,-1,'drawn hidden');
put(0,num(4,1));eq(H.turn,0,'only drawn card');put(0,num(1,1));eq(H.turn,1,'played drawn');
setup(3);at(num(5,1),[[num(4,1),num(6,0)]]);H.oc.deck=H.oc.deck.filter(x=>x!==num(1,1));H.oc.deck.push(num(1,1));act(0,{t:'draw'});act(0,{t:'draw'});eq(H.players[0].hand.length,3,'no second draw');act(0,{t:'pass'});eq(H.turn,1,'pass after draw');
/* +4: 받기 */
setup(3);at(num(5,1),[[FOUR(0),num(4,2),num(6,0)],[num(1,0),num(2,0)]]);put(0,FOUR(0),2);eq(H.turn,1,'four next');eq(H.oc.atk,4,'four atk');eq(snapFor(1).o.ch,1,'can challenge');eq(snapFor(2).o.ch,0,'only target');put(1,num(1,0));eq(H.turn,1,'must answer');act(1,{t:'draw'});eq(H.players[1].hand.length,6,'took four');eq(H.turn,2,'lost turn');eq(H.oc.atk,0,'atk done');eq(H.oc.suit,2,'named suit stays');
/* 도전 성공: 낸 사람이 4장, 도전자 차례 그대로 */
setup(3);at(num(5,1),[[FOUR(0),num(4,1),num(6,0)],[num(1,0),num(2,0)]]);put(0,FOUR(0),2);act(1,{t:'ch'});eq(H.oc.ph,'reveal','reveal');eq(snapFor(1).o.rv.h.length,2,'challenger sees');eq(snapFor(2).o.rv.h,undefined,'others do not');eq(snapFor(0).o.rv.h,undefined,'owner no');eq(snapFor(2).t,undefined,'no turn in reveal');
pass(TT.RV_MS+100);eq(H.players[0].hand.length,6,'guilty draws');eq(H.players[1].hand.length,2,'challenger safe');eq(H.turn,1,'challenger plays');eq(H.oc.atk,0,'cleared');eq(H.oc.ph,'turn','back');
/* 도전 실패: 도전자 6장, 넘어감. 숫자가 같은 카드·별 카드는 세지 않음 */
setup(3);at(num(5,1),[[FOUR(0),num(5,2),WILD(0)],[num(1,0),num(2,0)]]);put(0,FOUR(0),2);act(1,{t:'ch'});pass(TT.RV_MS+100);eq(H.players[1].hand.length,8,'failed draws six');eq(H.players[0].hand.length,2,'innocent');eq(H.turn,2,'failed loses turn');
/* 겹치기: +2 → +2 → +4 → 지정 무늬 +2, 받으면 누적 */
setup(4,{stack:1});at(num(5,1),[[TWO(1),num(1,0),num(2,0)],[TWO(3),num(1,2),num(2,2)],[FOUR(0),num(1,3),num(2,3)],[TWO(2),num(3,3),num(3,0)]]);
put(0,TWO(1));eq(H.turn,1,'stack waits');eq(H.oc.atk,2,'stack 2');put(1,TWO(3));eq(H.oc.atk,4,'stack 4');put(2,FOUR(0),2);eq(H.oc.atk,8,'stack 8');eq(snapFor(3).o.ch,1,'chal last four');put(3,TWO(2));eq(H.oc.atk,10,'stack 10');eq(H.oc.ch,null,'chal only after four');
act(0,{t:'draw'});eq(H.players[0].hand.length,12,'took stack');eq(H.turn,1,'after stack');eq(H.oc.atk,0,'stack done');
/* 겹치기 도전: 성공이면 낸 사람이 누적, 실패면 누적 + 2 */
setup(3,{stack:1});at(num(5,1),[[TWO(1),num(1,0),num(2,0)],[FOUR(0),num(1,1),num(2,2)],[num(3,3),num(4,3)]]);put(0,TWO(1));put(1,FOUR(0),0);act(2,{t:'ch'});pass(TT.RV_MS+100);eq(H.players[1].hand.length,8,'stack guilty takes all');eq(H.turn,2,'stack guilty turn');
setup(3,{stack:1});at(num(5,1),[[TWO(1),num(1,0),num(2,0)],[FOUR(0),num(1,2),num(2,2)],[num(3,3),num(4,3)]]);put(0,TWO(1));put(1,FOUR(0),0);act(2,{t:'ch'});pass(TT.RV_MS+100);eq(H.players[2].hand.length,10,'stack failed plus two');eq(H.turn,0,'stack failed passes');
/* 원카드: 본인 선언 */
setup(3);at(num(5,1),[[num(4,1),num(6,0)],[num(1,0),num(2,0)],[num(1,2),num(2,2)]]);put(0,num(4,1));eq(H.oc.uno,0,'window');act(0,{t:'one'});eq(H.oc.uno,-1,'declared');eq(H.players[0].hand.length,1,'declare free');
act(1,{t:'one'});eq(H.players[1].hand.length,2,'race after declare is free');NOW+=TT.GRACE_MS+10;act(1,{t:'one'});eq(H.players[1].hand.length,3,'false press');
/* 원카드: 잡힘 */
setup(3);at(num(5,1),[[num(4,1),num(6,0)],[num(1,0),num(2,0)],[num(1,2),num(2,2)]]);put(0,num(4,1));act(2,{t:'one'});eq(H.players[0].hand.length,3,'caught two');eq(H.players[2].hand.length,2,'catcher free');eq(H.oc.uno,-1,'closed');
/* 헛누름: 항상 눌림, 1장 */
setup(3);at(num(5,1),[[num(4,1),num(6,0)]]);act(2,{t:'one'});eq(H.players[2].hand.length,8,'false press any time');
/* 다음 사람이 내거나 뽑으면 끝 */
setup(3);at(num(5,1),[[num(4,1),num(6,0)],[num(1,1),num(2,0)]]);put(0,num(4,1));put(1,num(1,1));eq(H.oc.uno,1,'window moved');
setup(3);at(num(5,1),[[num(4,1),num(6,0)],[num(1,0),num(2,0)]]);put(0,num(4,1));act(1,{t:'draw'});eq(H.oc.uno,-1,'draw closes');
/* 자동으로 먹는 +2는 잡을 기회를 닫지 않음 */
setup(3);at(num(5,1),[[TWO(1),num(6,0)],[num(1,0),num(2,0)]]);put(0,TWO(1));eq(H.oc.uno,0,'auto hit keeps window');
/* 나가기·순위 */
setup(3);at(num(5,1),[[num(4,1)],[num(1,1),num(2,0)],[num(3,2),num(2,2)]]);put(0,num(4,1));eq(H.players[0].rank,1,'first');eq(H.phase,'play','classic goes on');eq(H.turn,1,'next after out');
at(num(5,1),[null,[num(4,1)]]);H.turn=1;H.oc.uno=-1;put(1,num(4,1));eq(H.players[1].rank,2,'second');eq(H.phase,'over','classic ends');eq(H.players[2].rank,3,'last');
setup(4,{fast:1});at(num(5,1),[[num(4,1)],[num(1,1),num(2,0),num(3,0)],[num(3,2)],[num(7,2),num(8,2)]]);put(0,num(4,1));eq(H.phase,'over','fast ends');eq(H.players[0].rank,1,'fast first');eq(H.players[2].rank,2,'fewest second');eq(H.players[3].rank,3,'fast third');eq(H.players[1].rank,4,'most last');
/* 마지막 카드가 공격이어도 효과 */
setup(3);at(num(5,1),[[TWO(1)],[num(1,0),num(2,0)],[num(3,2),num(2,2)]]);put(0,TWO(1));eq(H.players[1].hand.length,4,'last +2 hits');eq(H.turn,2,'then next');
/* 제한 시간: 뽑고 넘김, 공격은 받음 */
setup(3);at(num(5,1),[[num(4,1),num(6,0)]]);H.deadline=NOW+10;pass(100);eq(H.players[0].hand.length,3,'timeout draws');eq(H.turn,1,'timeout passes');
setup(3);at(num(5,1),[[FOUR(0),num(4,1),num(6,0)],[num(1,0),num(2,0)]]);put(0,FOUR(0),1);H.deadline=NOW+10;pass(100);eq(H.players[1].hand.length,6,'timeout takes');eq(H.turn,2,'timeout attack passes');
/* 뽑을 더미가 없으면 맨 위만 남기고 섞음, 카드가 아예 없으면 그냥 넘김 */
setup(3);{const O=H.oc;at(num(5,1),[[num(4,2),num(6,0)]]);const rest=O.deck.slice();O.disc=[...rest,num(5,1)];O.deck=[];O.drawn=-1;act(0,{t:'draw'});eq(O.disc.length,1,'top stays');eq(O.disc[0],num(5,1),'top same');eq(O.deck.length,rest.length-1,'deck back');}
setup(3);{const O=H.oc;at(num(5,1),[[num(4,2),num(6,0)]]);O.deck=[];act(0,{t:'draw'});eq(H.turn,1,'nothing to draw')}
/* 항복: 차례면 넘어가고 카드는 안 사라짐 */
setup(3);at(num(5,1),[[num(4,1),num(6,0)]]);act(0,{t:'surrender'});eq(H.players[0].finished,true,'surrender');eq(H.players[0].rank,3,'surrender last');eq(H.turn,1,'surrender passes');act(1,{t:'surrender'});eq(H.phase,'over','last wins');eq(H.players[2].rank,1,'left winner');
/* 도전 중 항복 */
setup(4);at(num(5,1),[[FOUR(0),num(4,1),num(6,0)],[num(1,0),num(2,0)]]);put(0,FOUR(0),2);act(1,{t:'ch'});act(1,{t:'surrender'});pass(TT.RV_MS+100);eq(H.oc.ph,'turn','reveal ends after surrender');eq(H.turn,2,'turn moved');
/* 봇 판: 끝까지 가고 카드가 틀어지지 않음 (겹치기·빠른 모드 조합) */
for(let rep=0;rep<48;rep++){
  const n=2+rep%5,cfg={stack:rep>>1&1,fast:rep&1,hand:5+rep%4};setup(n,cfg,1);
  for(let k=0;k<80000&&H.phase==='play';k++){
    NOW+=200;
    const O=H.oc,p=H.players[0];
    if(O.ph==='turn'&&H.turn===0&&!p.finished&&!dealing()){
      const S={top:O.disc[O.disc.length-1],suit:O.suit,atk:O.atk,stack:!!H.cfg.stack},L=O.drawn>=0?[O.drawn]:p.hand.filter(id=>TT.fits(id,S));
      if(L.length)put(0,L[Math.random()*L.length|0],Math.random()*4|0);else act(0,{t:'draw'});
      if(O.drawn>=0&&H.turn===0&&Math.random()<.3)act(0,{t:'pass'});
    }
    if(Math.random()<.02)act(Math.random()*n|0,{t:'one'});
    engineTick();
    if(!dealing()&&H.phase==='play'){
      const all=H.players.flatMap(q=>q.hand).concat(H.oc.deck,H.oc.disc);
      if(new Set(all).size!==all.length)fail('onecard duplicate card');
      if(all.length!==60)fail('onecard card count '+all.length);
    }
  }
  eq(H.phase,'over','bots finish n='+n);
  eq(H.players.filter(p=>p.rank===1).length,1,'one winner');
  eq(new Set(H.players.map(p=>p.rank)).size,n,'ranks');
}
