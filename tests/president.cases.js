/* 대부호 규칙 단위 테스트 (tests/engine.test.js가 불러서 실행) */
// --- 규칙 단위 테스트 ---
const R={run:1,rev:1,r8:1,lock:1,b11:1};
const id=(rk,s)=>rk*4+s;   // rk 0=3 ... 12=2
const S0={tk:null,rev:false,b11:false,lock:null};
const tkOf=ids=>({...parseCombo(ids,R),ids});
// 단일
let S={...S0,tk:tkOf([id(4,0)])};   // 7
if(playError([id(5,1)],S,R)!=='')fail('8 > 7');
if(playError([id(3,1)],S,R)==='')fail('6 < 7');
if(playError([id(4,1)],S,R)==='')fail('7 = 7 not allowed');
if(playError([id(5,0),id(5,1)],S,R)==='')fail('pair vs single');
if(playError([JOKER_BASE],S,R)!=='')fail('joker beats 7');
// 혁명
S={...S0,tk:tkOf([id(4,0)]),rev:true};
if(playError([id(3,1)],S,R)!=='')fail('rev: 6 beats 7');
if(playError([id(5,1)],S,R)==='')fail('rev: 8 not beat 7');
if(playError([JOKER_BASE],S,R)!=='')fail('rev: joker beats');
// 11백과 혁명 상쇄
S={...S0,tk:tkOf([id(4,0)]),rev:true,b11:true};
if(playError([id(5,1)],S,R)!=='')fail('rev+11back cancel');
// 계단
if(!parseCombo([id(2,1),id(3,1),id(4,1)],R))fail('run parse');
if(parseCombo([id(2,1),id(3,2),id(4,1)],R))fail('run mixed suit');
if(parseCombo([id(2,1),id(3,1),id(5,1)],R))fail('run gap');
S={...S0,tk:tkOf([id(2,1),id(3,1),id(4,1)])};
if(playError([id(3,2),id(4,2),id(5,2)],S,R)!=='')fail('run higher');
if(playError([id(0,2),id(1,2),id(2,2)],S,R)==='')fail('run lower');
if(playError([id(3,2),id(4,2),id(5,2),id(6,2)],S,R)==='')fail('run len differ');
// 조커 와일드
const c=parseCombo([id(6,0),JOKER_BASE],R);if(!c||c.ty!=='set'||c.k!==6||c.n!==2)fail('joker pair');
// 묶기
S={...S0,tk:tkOf([id(4,0),id(4,1)]),lock:[0,1]};
if(playError([id(6,0),id(6,1)],S,R)!=='')fail('lock ok');
if(playError([id(6,2),id(6,3)],S,R)==='')fail('lock violated');
if(playError([id(6,0),JOKER_BASE],S,R)!=='')fail('lock joker ok');
// legalPlays 일관성
for(let it=0;it<300;it++){
  const deck=shuffle([...Array(52).keys(),100,101]);const hand=deck.slice(0,12);
  const lead=Math.random()<.4;
  let S={tk:null,rev:Math.random()<.3,b11:Math.random()<.2,lock:null};
  if(!lead){const o=deck.slice(12,12+1+(Math.random()*3|0));const c=parseCombo(o,R);if(c)S.tk={...c,ids:o}}
  const mv=legalPlays(hand,S,R);
  const hs=new Set(hand);
  for(const m of mv){if(m.some(x=>!hs.has(x))||new Set(m).size!==m.length)fail('legal bad ids');if(playError(m,S,R))fail('legal not legal')}
  // 완전성 검사: 단일/쌍 전수 비교
  if(S.tk&&S.tk.ty==='set'&&S.tk.n<=2){
    const all=[];const n=S.tk.n;
    if(n===1)hand.forEach(a=>all.push([a]));
    else for(let i=0;i<hand.length;i++)for(let j=i+1;j<hand.length;j++)all.push([hand[i],hand[j]]);
    const seen=new Set();const ok=all.filter(m=>{if(playError(m,S,R))return false;const k=m.map(x=>x>=100?100:x).sort((a,b)=>a-b).join();if(seen.has(k))return false;seen.add(k);return true}).length;
    const got=mv.length;
    // joker 쌍/조합 중복 없이 같은 수여야 함 (조커 2장은 서로 구분되므로 hand 조합과 일치)
    if(ok!==got)fail(`legal count ${got} vs brute ${ok} n=${n}`);
  }
}
// 패스했던 사람이 항복해도, 남은 사람이 모두 대답하기 전엔 판이 끝나지 않음
cfgP({fast:0,jokers:0,swap:0,r8:0,rev:0,run:0,lock:0,b11:0});H.members=[0,1,2,3].map(i=>({name:'p'+i,bot:false,conn:null,host:i===0}));
hostStart();
H.players[0].hand=[id(4,0),id(0,1)];H.players[1].hand=[id(0,2),id(1,0)];H.players[2].hand=[id(1,1),id(2,2)];H.players[3].hand=[id(9,0),id(2,3)];
newTrick(0);doPlay(0,[id(4,0)]);doPass(1);doPass(2);
if(H.turn!==3)fail('setup turn');
doSurrender(1);
if(!H.tk||H.turn!==3)fail('surrender after pass ended trick early');
doPass(3);
if(H.tk||H.turn!==0)fail('trick should end after last pass, leader p0');
// 8 끊기: 테이블 표시용 마지막 카드(lp)는 남아 있어야 함
cfgP({fast:0,jokers:0,swap:0,r8:1,rev:0,run:0,lock:0,b11:0});H.members=[0,1,2].map(i=>({name:'p'+i,bot:false,conn:null,host:i===0}));
hostStart();H.players[0].hand=[id(5,0),id(0,1)];newTrick(0);doPlay(0,[id(5,0)]);
if(H.tk||H.turn!==0||!H.lp||H.lp.ids[0]!==id(5,0))fail('8 cut lp');
// 교환: 받은 카드 기록
cfgP({fast:0,jokers:0,swap:1,r8:1,rev:0,run:0,lock:0,b11:0});H.members=[0,1,2,3].map(i=>({name:'p'+i,bot:true,conn:null,host:i===0}));
H.lastRanks={p0:1,p1:2,p2:3,p3:4};hostStart();
{const g0=H.players[0].got,g3=H.players[3].got;
 if(!g0||g0.length!==2||!g3||g3.length!==2)fail('swap got');
 else if(!g0.every(x=>H.players[0].hand.includes(x))||!g3.every(x=>H.players[3].hand.includes(x)))fail('swap got not in hand');
 if(H.turn!==3)fail('daihinmin leads after swap');}

// 다음 판 선: 대부호 시작(dlead 0)
cfgP({fast:0,jokers:0,swap:1,r8:0,rev:0,run:0,lock:0,b11:0,dlead:0});H.members=[0,1,2,3].map(i=>({name:'p'+i,bot:true,conn:null,host:i===0}));
H.lastRanks={p0:1,p1:2,p2:3,p3:4};hostStart();
if(H.turn!==0)fail('daifugo leads (dlead 0)');
// 스페이드 3 반격
{const S1={tk:{...parseCombo([JOKER_BASE],{s3:1}),ids:[JOKER_BASE]},rev:false,b11:false,lock:null};
 if(playError([3],S1,{s3:1})!=='')fail('s3 counters joker');
 if(playError([3],S1,{s3:0})==='')fail('s3 off');
 if(playError([id(0,2)],S1,{s3:1})==='')fail('only spade 3');}
cfgP({fast:0,jokers:1,swap:0,r8:0,rev:0,run:0,lock:0,b11:0,s3:1,foul:0});H.members=[0,1,2].map(i=>({name:'p'+i,bot:false,conn:null,host:i===0}));
hostStart();H.players[0].hand=[JOKER_BASE,id(4,0)];H.players[1].hand=[3,id(6,0)];H.players[2].hand=[id(7,0),id(8,0)];
newTrick(0);doPlay(0,[JOKER_BASE]);doPlay(1,[3]);
if(H.tk||H.turn!==1)fail('s3 cut, p1 leads');
// 같은 숫자 건너뛰기
cfgP({fast:0,jokers:0,swap:0,r8:0,rev:0,run:0,lock:0,b11:0,skip:1,foul:0});H.members=[0,1,2].map(i=>({name:'p'+i,bot:false,conn:null,host:i===0}));
hostStart();H.players[0].hand=[id(4,0),id(1,0)];H.players[1].hand=[id(4,1),id(1,1)];H.players[2].hand=[id(9,0),id(9,1)];
newTrick(0);doPlay(0,[id(4,0)]);
if(playError([id(4,1)],stateH(),H.cfg)!=='')fail('skip equal allowed');
doPlay(1,[id(4,1)]);
if(H.turn!==0)fail('skip: p2 skipped, p0 turn '+H.turn);
// 패스하면 쉬기
cfgP({fast:0,jokers:0,swap:0,r8:0,rev:0,run:0,lock:0,b11:0,stay:1,foul:0});H.members=[0,1,2].map(i=>({name:'p'+i,bot:false,conn:null,host:i===0}));
hostStart();H.players[0].hand=[id(1,0),id(9,0),id(2,0)];H.players[1].hand=[id(2,1),id(3,1)];H.players[2].hand=[id(5,0),id(6,0)];
newTrick(0);doPlay(0,[id(1,0)]);doPass(1);
if(H.turn!==2)fail('stay turn p2');
doPlay(2,[id(5,0)]);
if(H.turn!==0)fail('stay: p1 sitting, p0 next '+H.turn);
doPlay(0,[id(9,0)]);
if(H.turn!==2)fail('stay: skip p1 again '+H.turn);
doPass(2);
if(H.tk||H.turn!==0)fail('stay: trick ends, p0 leads');
// 반칙 탈출
cfgP({fast:0,jokers:0,swap:0,r8:0,rev:0,run:0,lock:0,b11:0,foul:1});H.members=[0,1,2].map(i=>({name:'p'+i,bot:false,conn:null,host:i===0}));
hostStart();H.players[0].hand=[id(12,0)];H.players[1].hand=[id(2,1),id(3,1)];H.players[2].hand=[id(5,0),id(6,0)];
newTrick(0);doPlay(0,[id(12,0)]);
if(H.players[0].rank!==3)fail('foul -> last rank '+H.players[0].rank);
if(!PT.isFoulFinish([id(0,0)],{tk:null,rev:true,b11:false,lock:null},{foul:1}))fail('foul 3 in revolution');
if(PT.isFoulFinish([id(11,0)],{tk:null,rev:false,b11:false,lock:null},{foul:1}))fail('ace is not foul');
// 도시오치
cfgP({fast:0,jokers:0,swap:0,r8:0,rev:0,run:0,lock:0,b11:0,foul:0,miyako:1,dlead:1});H.members=[0,1,2,3].map(i=>({name:'p'+i,bot:false,conn:null,host:i===0}));
H.lastRanks={p0:1,p1:2,p2:3,p3:4};hostStart();
H.players[0].hand=[id(0,0),id(1,0)];H.players[1].hand=[id(2,1)];H.players[2].hand=[id(5,0),id(6,0)];H.players[3].hand=[id(7,0),id(8,0)];
newTrick(1);doPlay(1,[id(2,1)]);
if(H.players[1].rank!==1||H.players[0].rank!==4||!H.players[0].finished)fail('miyako-ochi '+H.players.map(p=>p.rank));

// 계급 이어가기: 나간 사람은 빠지고 남은 사람 순서대로, 새로 온 사람은 맨 아래
cfgP({fast:0,jokers:0,swap:1,r8:0,rev:0,run:0,lock:0,b11:0,dlead:1});
H.members=['b','x','d','n1','n2'].map((n,i)=>({name:n,bot:true,conn:null,host:i===0}));
H.lastRanks={a:1,b:2,c:3,d:4};   // a·c는 나감, x·n1·n2는 새로 옴 (x가 먼저)
hostStart();
{const pr=Object.fromEntries(H.players.map(p=>[p.name,p.pr]));
 if(pr.b!==1||pr.d!==2||pr.x!==3||pr.n1!==4||pr.n2!==5)fail('carry order '+JSON.stringify(pr));
 if(H.players[H.turn].name!=='n2')fail('daihinmin(newest) leads');
 if(!H.players.find(p=>p.name==='b').got)fail('exchange with newcomers');}

const G0=()=>GAMES.president;
// 라운드 점수: 대빈민 0점부터 한 계급씩 올라감, 정한 라운드를 마치면 최종 순위
cfgP({fast:0,jokers:0,swap:1,r8:0,rev:0,run:0,lock:0,b11:0,rounds:2});H.members=[0,1,2].map(i=>({name:'p'+i,bot:false,conn:null,host:i===0}));
H.lastRanks=null;H.scores=null;H.roundNo=0;H.setDone=false;
hostStart();doSurrender(1);doSurrender(2);
if(H.phase!=='over')fail('round 1 should end');
if(H.scores.p0!==4||H.scores.p2!==2||H.scores.p1!==0)fail('round scores (대부호4·평민2·대빈민0) '+JSON.stringify(H.scores));
if(!G0().joinLocked())fail('late join locked between rounds');
{const s={ps:H.players.map(()=>({}))};GAMES.president.engine.snap(s,0,0);if(s.nj!==1)fail('snap nj');}
if(H.setDone)fail('1/2 rounds is not the end');
// 바로 시작(다시 하기): 계급·점수 유지
hostStart();
if(H.roundNo!==2||H.scores.p0!==4||!H.lastRanks||H.lastRanks.p0!==1)fail('restart keeps ranks and scores');
H.players.forEach((p,i)=>{p.hand=[i]});
doSurrender(0);doSurrender(1);
if(H.phase!=='over'||!H.setDone)fail('2/2 rounds ends the set');
if(G0().joinLocked())fail('join opens after the last round');
{const s={ps:H.players.map(()=>({}))};GAMES.president.engine.snap(s,0,0);
 if(s.rt!==2||s.sd!==1||s.ps.some((o,i)=>o.sc!==H.scores[H.players[i].name]))fail('snap rounds/scores '+JSON.stringify([s.rt,s.sd,s.ps.map(o=>o.sc),H.scores,H.phase]));}
// 라운드를 모두 마친 뒤 다시 하면 점수·라운드만 새로, 계급은 유지
hostStart();
if(H.roundNo!==1||H.setDone||H.scores!==null)fail('new set restarts rounds '+JSON.stringify([H.roundNo,H.setDone,H.scores]));
if(!H.lastRanks||H.players[H.turn]===undefined)fail('new set keeps ranks');
// 결과 화면: 탁자를 나간 사람은 지우고, 끊긴 사람(H.members에서는 빠지고 H.players에 away로 남음)은 유지
{const sp=()=>{const s={ps:H.players.map(()=>({}))};GAMES.president.engine.snap(s,0,0)};
 H.phase='over';H.scores={p0:2,p1:3,p2:1};H.lastRanks={p0:1,p1:2,p2:3};
 H.players.forEach(p=>{p.away=false;p.dzWhy=undefined});
 const pl1=H.players.find(p=>p.name==='p1'),pl2=H.players.find(p=>p.name==='p2');
 pl1.away=true;pl2.away=true;H.members=H.members.filter(m=>m.name==='p0');   // p1은 끊김, p2는 나감(away지만 다음 판이 시작되면 빠짐)
 pl2.dzWhy='out';sp();
 if(H.lastRanks.p2!==undefined||H.scores.p2!==undefined)fail('leaver reset '+JSON.stringify([H.lastRanks,H.scores]));
 if(H.lastRanks.p1!==2||H.scores.p1!==3)fail('disconnected keeps rank '+JSON.stringify([H.lastRanks,H.scores]));
 if(H.lastRanks.p0!==1||H.scores.p0!==2)fail('present keeps rank');}
// 계급별 점수: 인원이 달라도 같은 계급은 같은 점수
{const P=PT.rankPts;
 if(P(1,4)!==4||P(2,4)!==3||P(3,4)!==1||P(4,4)!==0)fail('4p pts');
 if(P(1,3)!==4||P(2,3)!==2||P(3,3)!==0)fail('3p pts');
 if(P(3,6)!==2||P(4,6)!==2||P(5,6)!==1)fail('6p commoners same pts');}
// 동점이면 마지막 판 계급이 높은 사람이 앞섬
{const o=PT.finalOrder([{n:'a',sc:5,f:3},{n:'b',sc:7,f:4},{n:'c',sc:5,f:1}]).map(x=>x.n).join('');
 if(o!=='bca')fail('tie-break by last rank '+o);}
