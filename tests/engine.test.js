/* 엔진 테스트: index.html의 방장 엔진(공통) + games/*.js를 node에서 그대로 돌립니다.
   실행: node tests/engine.test.js
   내용: 대부호·쿼리도·야추다이스 규칙 단위 테스트 + 쿼리도 규칙 무작위 대조 + 야추다이스 봇 세기 + 모든 게임 봇끼리 여러 설정으로 끝까지 자동 대전(멈춤·카드 수·순위 확인) */
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const cut=(a,b)=>{const s=html.indexOf(a),e=html.indexOf(b,s);if(s<0||e<0)throw new Error('marker not found: '+a);return html.slice(s,e)};
const run=(code,name)=>vm.runInThisContext(code,{filename:name});
// index.html 안의 스크립트 전체가 문법에 맞는지 먼저 확인 (테스트가 일부만 잘라 쓰기 때문에, 나머지 부분의 실수도 잡기 위함)
{const re=/<script>([\s\S]*?)<\/script>/g;let m;while((m=re.exec(html)))new vm.Script(m[1],{filename:'index.html inline script'})}
run(`
var window=globalThis;
let NOW=0;const clock=()=>NOW;
const rand=(a,b)=>a+Math.random()*(b-a);
const pick=a=>a[Math.random()*a.length|0];
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a}
const store=()=>null;
let mode='host',lastPanelHtml='';
const myNick=()=>'나';
const sfx=()=>{};
function flush(){flushQueued=false}
globalThis.queueMicrotask=()=>{};
`,'stubs');
run(fs.readFileSync(path.join(root,'roulette.js'),'utf8'),'roulette.js');   // 첫 차례 룰렛 계산 (hostStart가 씀)
run(fs.readFileSync(path.join(root,'games/gura.js'),'utf8'),'gura.js');
run(fs.readFileSync(path.join(root,'games/president.js'),'utf8'),'president.js');
run(fs.readFileSync(path.join(root,'games/quoridor.js'),'utf8'),'quoridor.js');
run(fs.readFileSync(path.join(root,'games/yahtzee.js'),'utf8'),'yahtzee.js');
run(fs.readFileSync(path.join(root,'games/omok.js'),'utf8'),'omok.js');
run(cut('/* 카드 id 규칙은','const PEER_PREFIX='),'core-consts');
run(cut('let H=null, flushQueued=false, lastBeat=0;','function seatOfConn(conn){').replace('setInterval(engineTick,100);',''),'core-engine');
run(`
let fails=0;const fail=m=>{fails++;if(fails<20)console.log('FAIL',m)};
/* 봇만으로 한 게임: 가짜 시계를 0.25초씩 돌리며 실제와 같이 engineTick으로 진행 */
function playOut(game,n,over,lvs){
  hostNew(false,'t','t');
  H.cfg={...cfgFor(game),...over,game};
  H.members=[];for(let i=0;i<n;i++)H.members.push({name:'b'+i,bot:true,conn:null,host:i===0,lv:lvs[i%lvs.length]});
  let games=0,ticks=0;
  for(let r=0;r<3;r++){
    hostStart();
    const deckN=game==='gura'?(H.cfg.maxn*4+H.cfg.jokers):(52+H.cfg.jokers);
    const total=()=>H.players.reduce((a,p)=>a+p.hand.length,0)+(game==='gura'?H.field.length:0);
    if(total()!==deckN)fail(game+' deal '+total()+' != '+deckN);
    let guard=0;
    while(H.phase!=='over'&&guard++<40000){
      NOW+=250;engineTick();ticks++;
      if(game==='gura'&&H.phase!=='over'){
        const t=total();if(t>deckN)fail('gura cards grew '+t);
      }
      const cur=H.players[H.turn];
      if(H.phase==='play'&&cur&&(cur.finished||!cur.hand.length)){fail(game+' turn on inactive');break}
    }
    if(H.phase!=='over'){fail(game+' stuck n='+n+' cfg='+JSON.stringify(over));return ticks}
    const ranks=H.players.map(p=>p.rank).sort((a,b)=>a-b);
    if(!H.cfg.fast){const exp=Array.from({length:n},(_,i)=>i+1);if(JSON.stringify(ranks)!==JSON.stringify(exp))fail(game+' ranks '+ranks)}
    else if(!ranks.includes(1))fail(game+' fast no winner');
    games++;
  }
  return ticks;
}
`,'helpers');
// 대부호 규칙 단위 테스트 (기존 테스트를 모듈 함수로)
run(`{
const {parseCombo,playError,legalPlays}=GAMES.president;
const {newTrick,doPlay,doPass,doSurrender,stateH,cardStr}=GAMES.president._test;
const PT=GAMES.president._test;
const cfgP=o=>{hostNew(false,'t','t');H.cfg={...cfgFor('president'),...o,game:'president'}};
`+fs.readFileSync(path.join(__dirname,'president.cases.js'),'utf8')+`
}`,'president.cases.js');
// 쿼리도: 규칙 단위 테스트 + 봇끼리 끝까지 자동 대전
run(`{
const Q=GAMES.quoridor,{mkB,legalMoves,dist,wallOK,wallFits,atGoal,canStep}=Q._test;
const mk=(pos,sd)=>({n:pos.length,cnt:pos.length,sd,pos:pos.map(p=>p&&p.slice()),done:pos.map(()=>0),wl:pos.map(()=>10),B:mkB(),walls:[],lm:null});
const has=(ms,r,c)=>ms.some(m=>m[0]===r&&m[1]===c);
// 처음 위치: 어느 쪽에서 출발해도 목표까지 8칸
{const S=mk([[8,4],[4,0],[0,4],[4,8]],[0,1,2,3]);for(let i=0;i<4;i++)if(dist(S,i)!==8)fail('quoridor start dist '+i+'='+dist(S,i))}
// 목표 변
if(!atGoal(0,0,5)||atGoal(0,8,5)||!atGoal(1,3,8)||!atGoal(2,8,0)||!atGoal(3,5,0))fail('quoridor goal sides');
// 말 뛰어넘기: 바로 앞 말은 뛰어넘음
{const S=mk([[4,4],[3,4]],[0,2]);const m=legalMoves(S,0);
 if(has(m,3,4)||!has(m,2,4)||!has(m,4,3)||!has(m,4,5)||!has(m,5,4)||m.length!==4)fail('quoridor straight jump '+JSON.stringify(m))}
// 뛰어넘을 자리가 벽이면 대각선
{const S=mk([[4,4],[3,4]],[0,2]);S.B.hw[2][3]=1;const m=legalMoves(S,0);
 if(has(m,2,4)||!has(m,3,3)||!has(m,3,5))fail('quoridor diagonal by wall '+JSON.stringify(m))}
// 뛰어넘을 자리가 보드 밖이면 대각선
{const S=mk([[1,4],[0,4]],[0,2]);const m=legalMoves(S,0);
 if(!has(m,0,3)||!has(m,0,5)||has(m,-1,4))fail('quoridor diagonal by edge '+JSON.stringify(m))}
// 벽은 넘을 수 없음
{const S=mk([[4,4],[0,0]],[0,2]);S.B.hw[3][4]=1;if(has(legalMoves(S,0),3,4))fail('quoridor wall blocks move');
 if(canStep(S.B,4,4,0)||canStep(S.B,4,5,0)||!canStep(S.B,4,3,0)||!canStep(S.B,4,6,0))fail('quoridor wall span')}
// 벽 겹침·십자 금지
{const B=mkB();B.hw[3][3]=1;
 if(wallFits(B,3,3,0)||wallFits(B,3,4,0)||wallFits(B,3,2,0)||wallFits(B,3,3,1))fail('quoridor wall overlap/cross');
 if(!wallFits(B,3,5,0)||!wallFits(B,4,3,0)||!wallFits(B,3,2,1)||!wallFits(B,2,3,1))fail('quoridor wall fits');
 if(wallFits(B,-1,0,0)||wallFits(B,8,0,0)||wallFits(B,0,8,1))fail('quoridor wall bounds')}
// 길을 완전히 막는 벽은 금지
{const S=mk([[8,0],[0,4]],[0,2]);
 if(!wallOK(S,7,0,1))fail('quoridor first wall');
 S.B.vw[7][0]=1;
 if(wallOK(S,6,0,0))fail('quoridor must not seal pawn in');
 if(!wallOK(S,6,1,0))fail('quoridor open wall rejected')}
// 엔진: 시작·벽 수·잘못된 행동 무시
{hostNew(false,'t','t');H.cfg={...cfgFor('quoridor'),game:'quoridor'};
 if(H.cfg.max!==2||roomSetOf(Q).find(d=>d.k==='max').hi!==4)fail('quoridor cfg max');
 H.members=[0,1,2,3].map(i=>({name:'p'+i,bot:false,conn:null,host:i===0}));
 hostStart();
 if(H.q.wl.some(w=>w!==5)||H.q.cnt!==4)fail('quoridor 4p walls '+H.q.wl);
 const t=H.turn,Qs=H.q;
 Q.engine.act((t+1)%4,{t:'move',r:0,c:0});   // 차례가 아닌 사람
 if(H.turn!==t)fail('quoridor wrong turn accepted');
 Q.engine.act(t,{t:'move',r:0,c:0});   // 갈 수 없는 칸
 if(H.turn!==t)fail('quoridor illegal move accepted');
 Q.engine.act(t,{t:'wall',r:9,c:0,o:0});Q.engine.act(t,{t:'wall',r:1,c:1,o:2});
 if(H.turn!==t||Qs.walls.length)fail('quoridor illegal wall accepted');
 const mv=legalMoves(Qs,t)[0];Q.engine.act(t,{t:'move',r:mv[0],c:mv[1]});
 if(H.turn===t)fail('quoridor legal move rejected');
 const t2=H.turn;Q.engine.act(t2,{t:'wall',r:3,c:3,o:0});
 if(Qs.wl[t2]!==4||Qs.walls.length!==1)fail('quoridor wall not placed');
 // 사람이 제한 시간을 넘기면 패배 (4명이면 4위, 게임은 계속)
 const t3=H.turn;NOW=H.deadline+1;engineTick();
 if(!H.players[t3].finished||H.players[t3].surrendered!=='time'||H.players[t3].rank!==4||H.q.pos[t3]!==null)fail('quoridor timeout lose');
 if(H.phase!=='play'||H.turn===t3||H.players[H.turn].finished)fail('quoridor turn after timeout');
 if(snapFor(t3).ps[t3].sr!==2)fail('quoridor timeout snap sr');
 // 연결이 끊긴 사람(봇이 대신 맡음)은 시간이 지나도 지지 않고 봇이 둠
 const ta=H.turn;H.players[ta].bot=true;H.players[ta].away=true;H.players[ta].awayAt=NOW;H.botActAt=0;
 const nw=Qs.walls.length,np=JSON.stringify(Qs.pos[ta]);NOW=H.deadline+1;engineTick();
 if(H.players[ta].finished||(Qs.walls.length===nw&&JSON.stringify(Qs.pos[ta])===np)||H.turn===ta)fail('quoridor away player should be played by bot');
 // 항복
 const t4=H.turn;Q.engine.act(t4,{t:'surrender'});
 if(!H.players[t4].finished||H.players[t4].rank!==3||H.q.pos[t4]!==null)fail('quoridor surrender');
 if(H.phase!=='play'||H.players[H.turn].finished)fail('quoridor turn after surrender')}
// 2명: 제한 시간이 지나면 상대가 1위로 끝
{hostNew(false,'t','t');H.cfg={...cfgFor('quoridor'),game:'quoridor'};
 H.members=[0,1].map(i=>({name:'p'+i,bot:false,conn:null,host:i===0}));hostStart();
 const t=H.turn;NOW=H.deadline+1;engineTick();
 if(H.phase!=='over'||H.players[t].rank!==2||H.players[1-t].rank!==1)fail('quoridor 2p timeout end')}
// 좌표·기보
{const {sqName,wallName,recordText}=Q._test;
 if(sqName(8,4)!=='e1'||sqName(0,4)!=='e9'||sqName(4,0)!=='a5'||sqName(4,8)!=='i5'||sqName(0,0)!=='a9'||sqName(8,8)!=='i1')fail('quoridor square names');
 if(wallName(7,4,0)!=='e1h'||wallName(0,0,1)!=='a8v'||wallName(7,7,0)!=='h1h'||wallName(0,7,1)!=='h8v')fail('quoridor wall names');
 hostNew(false,'t','t');H.cfg={...cfgFor('quoridor'),game:'quoridor'};
 H.members=[0,1].map(i=>({name:'p'+i,bot:false,conn:null,host:i===0}));hostStart();
 const a=H.turn,b=1-a,mv=(i)=>{const m=legalMoves(H.q,i).find(x=>x[1]===4&&Math.abs(x[0]-4)<Math.abs(H.q.pos[i][0]-4));Q.engine.act(i,{t:'move',r:m[0],c:m[1]})};   // 가운데 쪽(목표 쪽)으로 한 칸
 mv(a);Q.engine.act(b,{t:'wall',r:3,c:3,o:0});mv(a);mv(b);
 const rec=H.q.rec.map(x=>x[0]+':'+x[1]+':'+x[2]).join(' ');
 const ea=a===0?'e2':'e8',eb=b===0?'e2':'e8',ea2=a===0?'e3':'e7';
 if(rec!==\`1:\${a}:\${ea} 1:\${b}:d5h 2:\${a}:\${ea2} 2:\${b}:\${eb}\`)fail('quoridor record '+rec);
 if(H.log[0][0]!==\`2. p\${b} \${eb}\`)fail('quoridor log notation '+H.log[0][0]);
 const s=snapFor(0);const txt=recordText({q:s.q,ps:s.ps,st:'play'});
 if(!txt.includes(\`1. \${ea} d5h\`)||!txt.includes(\`2. \${ea2} \${eb}\`))fail('quoridor record text '+txt);
 Q.engine.act(a,{t:'surrender'});const s2=snapFor(0),t2=recordText({q:s2.q,ps:s2.ps,st:'over'});
 if(!t2.includes('항복')||!t2.includes('결과: 1위'))fail('quoridor record over '+t2)}
// 봇끼리 끝까지: 인원·모드·난이도를 바꿔 가며, 매 순간 모든 말에 길이 남아 있는지 확인
function playOutQ(n,over,lvs){
  hostNew(false,'t','t');
  H.cfg={...cfgFor('quoridor'),...over,game:'quoridor'};
  H.members=[];for(let i=0;i<n;i++)H.members.push({name:'b'+i,bot:true,conn:null,host:i===0,lv:lvs[i%lvs.length]});
  let ticks=0;
  hostStart();
  let guard=0;
  while(H.phase!=='over'&&guard++<60000){
    NOW+=250;engineTick();ticks++;
    const S=H.q;
    for(let i=0;i<S.n;i++){
      if(S.pos[i]&&!S.done[i]&&dist(S,i)<0){fail('quoridor no path for '+i);return ticks}
      if(S.wl[i]<0){fail('quoridor negative walls');return ticks}
      if(S.pos[i]&&!S.done[i])for(let j=i+1;j<S.n;j++)if(S.pos[j]&&!S.done[j]&&S.pos[j][0]===S.pos[i][0]&&S.pos[j][1]===S.pos[i][1]){fail('quoridor pawns overlap');return ticks}
    }
    if(H.phase==='play'&&H.players[H.turn].finished){fail('quoridor turn on finished');return ticks}
  }
  if(H.phase!=='over'){fail('quoridor stuck n='+n+' cfg='+JSON.stringify(over));return ticks}
  const ranks=H.players.map(p=>p.rank).sort((a,b)=>a-b);
  if(!ranks.includes(1))fail('quoridor no winner');
  if(ranks.filter(r=>r===1).length!==1||ranks.some(r=>!(r>=1&&r<=n)))fail('quoridor ranks '+ranks);   // 한 명이 도착하면 끝, 나머지는 남은 거리 순(공동 순위 가능)
  if(H.players.filter(p=>p.rank===1).some(p=>!H.q.done[H.players.indexOf(p)]&&H.players.filter(x=>!x.surrendered).length>1))fail('quoridor winner did not arrive');
  const w=H.players.find(p=>p.rank===1),wi=H.players.indexOf(w);
  if(!H.q.done[wi]||!atGoal(H.q.sd[wi],H.q.pos[wi][0],H.q.pos[wi][1]))fail('quoridor winner not at goal');
  return ticks;
}
globalThis.playOutQ=playOutQ;
}`,'quoridor.cases.js');
run('{'+fs.readFileSync(path.join(__dirname,'quoridor.fuzz.js'),'utf8')+'}','quoridor.fuzz.js');
run(`
let qt=0;
for(let rep=0;rep<48;rep++){
  const n=2+(rep%3);
  qt+=playOutQ(n,{fast:rep%4===0?1:0,walls:[10,6,16][rep%3],turn:30,max:4},[0,1,2,1]);
}
console.log('quoridor ticks',qt);
`,'quoridor.run');
// 야추다이스: 규칙 단위 테스트 + 봇 세기 + 봇끼리 끝까지 자동 대전
run(`{
const Y=GAMES.yahtzee;
`+fs.readFileSync(path.join(__dirname,'yahtzee.cases.js'),'utf8')+`
}`,'yahtzee.cases.js');
run(`
let yt=0;
for(let rep=0;rep<36;rep++){
  const n=2+(rep%3);
  yt+=playOutY(n,{fast:rep%4===0?1:0,turn:[45,15,90][rep%3],max:4},[0,1,2,1]);
}
console.log('yahtzee ticks',yt);
`,'yahtzee.run');
// 오목: 규칙 단위 테스트 + 54가지 규칙 조합을 봇끼리 끝까지
run(`{
const OM=GAMES.omok;
`+fs.readFileSync(path.join(__dirname,'omok.cases.js'),'utf8')+`
}`,'omok.cases.js');
run(`
let ot=0;
for(let sz=0;sz<2;sz++)for(let b33=0;b33<3;b33++)for(let ov=0;ov<3;ov++)for(let op=0;op<3;op++){
  ot+=playOutO({sz,b33,ov,op,tm:10,inc:5,pickfirst:(sz+b33+ov+op)%2},[(sz+op)%3,(b33+ov+1)%3]);
}
console.log('omok ticks',ot);
`,'omok.run');
// 탈주: 나가기 버튼은 바로, 연결 끊김은 DESERT_WAIT 동안 이어질 때 항복 처리 + 표시 (모든 게임). 그 전에 돌아오면 취소, 방장은 해당 없음
run(`
for(const [g,n] of [['gura',3],['president',3],['quoridor',3],['yahtzee',3],['omok',2]]){
  const setup=()=>{hostNew(false,'t','t');H.cfg={...cfgFor(g),game:g,turn:600};
    H.members=[];for(let i=0;i<n;i++)H.members.push({name:'p'+i,bot:false,conn:i?{}:null,host:i===0,cid:'c'+i});
    hostStart();for(let k=0;k<80;k++){NOW+=250;engineTick()}};   // 시작 연출이 끝날 때까지
  const find=()=>H.players.findIndex(p=>!p.host);
  // 1) 연결 끊김이 이어짐
  setup();let i=find();
  Object.assign(H.players[i],{bot:true,conn:null,away:true,awayAt:NOW});
  for(let k=0;k<(AWAY_WAIT/250);k++){NOW+=250;engineTick()}
  if(H.players[i].deserter||H.players[i].finished)fail(g+' deserted too early');
  for(let k=0;k<((DESERT_WAIT-AWAY_WAIT)/250)+8;k++){NOW+=250;engineTick()}
  {const p=H.players[i];
   if(!p.deserter)fail(g+' disconnect not deserted');
   else{if(H.phase!=='over'&&!p.finished)fail(g+' deserter not surrendered');
     const sn=snapFor(0).ps[i];if(!sn.dz||(p.finished&&sn.sr!==3))fail(g+' snap dz/sr '+JSON.stringify(sn))}}
  // 2) 나가기 버튼: 바로 탈주
  setup();i=find();
  H.players[i].conn=null;desertSeat(i);for(let k=0;k<8;k++){NOW+=250;engineTick()}
  {const p=H.players[i];if(!p.deserter||(H.phase!=='over'&&!p.finished))fail(g+' leave not deserted')}
  // 3) 끊겼다가 45초 안에 돌아오면 탈주 아님
  setup();i=find();
  Object.assign(H.players[i],{bot:true,conn:null,away:true,awayAt:NOW});
  for(let k=0;k<(DESERT_WAIT/250)-20;k++){NOW+=250;engineTick()}
  Object.assign(H.players[i],{bot:false,away:false,conn:{}});
  for(let k=0;k<400;k++){NOW+=250;engineTick()}
  if(H.players[i].deserter)fail(g+' returned player deserted');
  // 4) 방장은 탈주 처리하지 않음
  setup();H.players[0].away=true;H.players[0].awayAt=NOW-DESERT_WAIT*3;engineTick();
  if(H.players[0].deserter)fail(g+' host deserted');
}
`,'deserter.cases');
run(`
let ticks=0;
for(let rep=0;rep<60;rep++){
  const n=2+(rep%7);
  ticks+=playOut('president',n,{fast:rep%5===0?1:0,jokers:rep%3,r8:rep%2,rev:(rep>>1)%2,run:(rep>>2)%2,lock:(rep>>1)%2,b11:(rep>>3)%2,swap:1,s3:(rep>>1)%2,skip:(rep>>2)%2,stay:(rep>>3)%2,foul:rep%2,miyako:(rep>>1)%2,dlead:(rep>>2)%2,turn:30,max:8},[0,1,2,1]);
}
for(let rep=0;rep<60;rep++){
  const n=2+(rep%7);
  ticks+=playOut('gura',n,{fast:rep%5===0?1:0,jokers:rep%5,maxn:[14,8,19,10,4][rep%5],grace:rep%4,turn:30,max:8},[0,1,2,1]);
}
console.log('ticks',ticks,'fails',fails);
process.exit(fails?1:0);
`,'run');
