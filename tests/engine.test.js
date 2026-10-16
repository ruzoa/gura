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
