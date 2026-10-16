/* 엔진 테스트: index.html의 방장 엔진(공통) + games/*.js를 node에서 그대로 돌립니다.
   실행: node tests/engine.test.js
   내용: 대부호 규칙 단위 테스트 + 두 게임 모두 봇끼리 여러 설정으로 끝까지 자동 대전(멈춤·카드 수·순위 확인) */
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const cut=(a,b)=>{const s=html.indexOf(a),e=html.indexOf(b,s);if(s<0||e<0)throw new Error('marker not found: '+a);return html.slice(s,e)};
const run=(code,name)=>vm.runInThisContext(code,{filename:name});
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
run(fs.readFileSync(path.join(root,'games/gura.js'),'utf8'),'gura.js');
run(fs.readFileSync(path.join(root,'games/president.js'),'utf8'),'president.js');
run(fs.readFileSync(path.join(root,'games/quoridor.js'),'utf8'),'quoridor.js');
run(cut('/* 카드 id 규칙은','const PEER_PREFIX='),'core-consts');
run(cut('let H=null, flushQueued=false, lastBeat=0;','function snapFor(you){').replace('setInterval(engineTick,100);',''),'core-engine');
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
 // 시간이 지나면 자동으로 한 칸
 const t3=H.turn,before=JSON.stringify(Qs.pos[t3]);NOW=H.deadline+1;engineTick();
 if(H.turn===t3||JSON.stringify(Qs.pos[t3])===before)fail('quoridor timeout automove');
 // 항복
 const t4=H.turn;Q.engine.act(t4,{t:'surrender'});
 if(!H.players[t4].finished||H.players[t4].rank!==4||H.q.pos[t4]!==null)fail('quoridor surrender');
 if(H.phase!=='play'||H.players[H.turn].finished)fail('quoridor turn after surrender')}
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
  if(!H.cfg.fast){const exp=Array.from({length:n},(_,i)=>i+1);if(JSON.stringify(ranks)!==JSON.stringify(exp))fail('quoridor ranks '+ranks)}
  const w=H.players.find(p=>p.rank===1),wi=H.players.indexOf(w);
  if(!H.q.done[wi]||!atGoal(H.q.sd[wi],H.q.pos[wi][0],H.q.pos[wi][1]))fail('quoridor winner not at goal');
  return ticks;
}
globalThis.playOutQ=playOutQ;
}`,'quoridor.cases.js');
run(`
let qt=0;
for(let rep=0;rep<48;rep++){
  const n=2+(rep%3);
  qt+=playOutQ(n,{fast:rep%4===0?1:0,walls:[10,6,16][rep%3],turn:30,max:4},[0,1,2,1]);
}
console.log('quoridor ticks',qt);
`,'quoridor.run');
run(`
let ticks=0;
for(let rep=0;rep<60;rep++){
  const n=2+(rep%7);
  ticks+=playOut('president',n,{fast:rep%5===0?1:0,jokers:rep%3,r8:rep%2,rev:(rep>>1)%2,run:(rep>>2)%2,lock:(rep>>1)%2,b11:(rep>>3)%2,swap:1,turn:30,max:8},[0,1,2,1]);
}
for(let rep=0;rep<60;rep++){
  const n=2+(rep%7);
  ticks+=playOut('gura',n,{fast:rep%5===0?1:0,jokers:rep%5,maxn:[14,8,19,10,4][rep%5],grace:rep%4,turn:30,max:8},[0,1,2,1]);
}
console.log('ticks',ticks,'fails',fails);
process.exit(fails?1:0);
`,'run');
