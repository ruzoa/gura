/* 숫자야구 테스트 (tests/engine.test.js가 이 파일을 불러서 { } 블록 안에서 돌림) */
const T=NB._test;
const eq=(a,b,m)=>{if(a!==b)fail('baseball '+m+': '+a+' != '+b)};
const sc=(a,b)=>{const q=T.score(a,b);return T.resText(q.S,q.B)};
eq(sc('1234','1234'),'4S','all strike');eq(sc('1234','5678'),'OUT','out');eq(sc('1234','1243'),'2S 2B','mix');eq(sc('0123','0456'),'1S','leading zero');
eq(T.validNum('0123',4),true,'0 first ok');eq(T.validNum('1123',4),false,'dup');eq(T.validNum('123',4),false,'len');eq(T.validNum('12a4',4),false,'char');
eq(T.allNums(3).length,720,'3');eq(T.allNums(4).length,5040,'4');eq(T.allNums(5).length,30240,'5');
const setup=(md,n,bots)=>{
  hostNew(false,'t','t');H.cfg={...cfgFor('baseball'),game:'baseball',md,len:4,turn:45,max:n};
  H.members=[];for(let i=0;i<n;i++)H.members.push(bots&&i?{name:'b'+i,bot:true,conn:null,host:false,lv:1}:{name:'p'+i,bot:false,conn:i?{}:null,host:i===0,cid:i?'c'+i:''});
  hostStart();for(let k=0;k<80;k++){NOW+=250;engineTick()}
};
const act=(s,a)=>NB.engine.act(s,a);
const pass=ms=>{for(let k=0;k<ms/250+2;k++){NOW+=250;engineTick()}};
const wrong=(sec,skip)=>{for(const x of T.allNums(4))if(x!==sec&&!(skip&&skip.has(x)))return x};
/* 혼자: 시간제한 없음, 10번, 중복 수 거절, 정답·실패 */
setup(0,1);
eq(H.nb.ph,'guess','solo start');eq(snapFor(0).o.sec,undefined,'solo hidden');
NOW+=3600000;engineTick();eq(H.phase,'play','solo no time limit');
{const s=H.nb.sec,g=wrong(s);act(0,{t:'guess',v:g});eq(H.nb.rec.length,1,'solo guess');act(0,{t:'guess',v:s});eq(H.nb.rec.length,1,'no call during reveal');pass(T.RV_MS);act(0,{t:'guess',v:g});eq(H.nb.rec.length,1,'repeat refused');act(0,{t:'guess',v:s});pass(T.WIN_RV);eq(H.phase,'over','solo found');eq(H.nb.res.w,0,'solo win')}
setup(0,1);
{const s=H.nb.sec,L=T.allNums(4).filter(x=>x!==s).slice(0,10);for(const g of L){act(0,{t:'guess',v:g});pass(T.RV_MS)}eq(H.phase,'over','solo 10 tries');eq(H.nb.res.why,'fail','solo fail');eq(snapFor(0).o.sec,s,'answer shown')}
/* 맞대결: 비밀은 상대에게 안 보임, 동시 공개, 둘 다 맞히면 무승부, 시간 초과는 건너뜀 */
setup(1,2);
eq(H.nb.ph,'set','vs set');act(0,{t:'set',v:'1123'});eq(H.nb.secs[0],null,'bad secret');act(0,{t:'set',v:'0123'});act(1,{t:'set',v:'4567'});eq(H.nb.ph,'guess','vs guess');
eq(snapFor(1).o.my,'4567','own secret');eq(JSON.stringify(snapFor(1)).includes('0123'),false,'other secret hidden');eq(JSON.stringify(snapFor(-1)).includes('4567'),false,'spectator hidden');
act(0,{t:'guess',v:'4567'});eq(H.nb.rec.length,0,'waits other');eq(snapFor(1).t,1,'other turn');eq(snapFor(1).o.mg,null,'own pending empty');
act(1,{t:'guess',v:'0123'});eq(H.nb.rec.length,2,'both shown');pass(T.WIN_RV);eq(H.phase,'over','both found');eq(H.nb.res.w,-1,'draw');
setup(1,2);act(0,{t:'set',v:'0123'});act(1,{t:'set',v:'4567'});act(0,{t:'guess',v:'4567'});NOW+=46000;engineTick();eq(H.nb.rec.filter(r=>r.g).length,1,'timeout skips');eq(H.nb.rec[1].g,null,'skip row');pass(T.WIN_RV);eq(H.nb.res.w,0,'one found wins');
setup(1,2);act(0,{t:'set',v:'0123'});NOW+=46000;engineTick();eq(H.nb.ph,'guess','secret auto');eq(T.validNum(H.nb.secs[1],4),true,'auto secret valid');
setup(1,2);act(0,{t:'set',v:'0123'});act(1,{t:'set',v:'4567'});for(let k=0;k<3;k++){NOW+=46000;engineTick();pass(T.RV_MS)}eq(H.phase,'over','idle ends');eq(H.nb.res.w,-1,'idle draw');
/* 경주: 차례, 이미 나온 수, 버저 */
setup(2,3);
{let a=H.turn,O=H.nb,s=O.sec,g=wrong(s),o=(a+1)%3;
 act(o,{t:'guess',v:g});eq(O.rec.length,0,'not your turn');act(a,{t:'guess',v:g});eq(O.rec.length,1,'race call');act(o,{t:'buzz'});eq(O.ph,'rv','buzz locked during reveal');pass(T.RV_MS);eq(H.turn,o,'next turn');
 act(o,{t:'guess',v:g});eq(O.rec.length,1,'public repeat refused');
 const left=H.deadline-NOW;act(a,{t:'buzz'});eq(O.ph,'buzz','buzz stops');eq(H.turn,a,'buzz owner');act(o,{t:'guess',v:wrong(s,new Set([g]))});eq(O.rec.length,1,'no call during buzz');
 const w2=wrong(s,new Set([g]));act(a,{t:'ans',v:w2});eq(O.alive[a],false,'wrong dies');eq(O.rec[1].x,1,'wrong public');pass(T.RV_MS);eq(H.turn,o,'resumes');eq(Math.abs(H.deadline-NOW-left)<1500,true,'time restored');
 act(a,{t:'buzz'});eq(O.ph,'guess','dead cannot buzz');
 const c=(o+1)%3===a?(a+1)%3:(o+1)%3;act(c,{t:'buzz'});NOW+=T.BUZZ_MS+300;engineTick();eq(O.alive[c],false,'buzz timeout dies');pass(1500);
 eq(H.phase,'over','last alive wins');eq(O.res.w,o,'last winner');eq(O.res.why,'last','last why');eq(H.players[o].rank,1,'winner rank');}
setup(2,3);{const O=H.nb,s=O.sec,b=(H.turn+1)%3;act(b,{t:'buzz'});act(b,{t:'ans',v:s});pass(T.WIN_RV);eq(H.nb.res.w,b,'buzz right wins')}
setup(2,3);{const a=H.turn,g=wrong(H.nb.sec);act(a,{t:'guess',v:H.nb.sec});pass(T.WIN_RV);eq(H.nb.res.w,a,'turn call wins');eq(H.nb.alive[a],true,'not dead')}
/* 경주 다음 판은 선을 넘김 */
{const f=H.nb.first;hostStart();eq(H.nb.first,(f+1)%3,'first rotates')}
/* 경주: 항복·버저 중 항복 */
setup(2,3);{const a=H.turn,b=(a+1)%3,c=(a+2)%3;NB.engine.act(a,{t:'surrender'});eq(H.nb.alive[a],false,'race surrender');eq(H.turn,b,'turn moves');act(c,{t:'buzz'});NB.engine.act(c,{t:'surrender'});eq(H.phase,'over','all but one');eq(H.nb.res.w,b,'last alive')}
/* 봇 기억력: 쉬움·보통은 최근 줄만 따짐 */
{const rows=[{g:'0123',S:4,B:0},{g:'4567',S:0,B:0},{g:'8901',S:0,B:0},{g:'2389',S:0,B:0}];
 eq(T.memNums(rows.slice(0,1),1,4,new Set()).join(),'0123','memory one row');
 eq(T.memNums([{g:'4567',S:0,B:0}],3,4,new Set()).some(x=>/[4-7]/.test(x)),false,'out row filters digits');
 eq(T.memNums(rows.slice(1).concat([{g:'0123',S:4,B:0}]),1,4,new Set()).join(),'0123','last row only');
 eq(T.memNums([],2,4,new Set(['0123'])).includes('0123'),false,'used numbers skipped');
 eq(T.botMem(2),Infinity,'hard remembers all');eq(T.botMem(1),3,'normal three rows');eq(T.botMem(0,()=>.1),2,'easy two rows');eq(T.botMem(0,()=>.9),3,'easy three rows')}
/* 설정: 모드별 인원 */
{hostNew(false,'t','t');let c={...cfgFor('baseball'),game:'baseball',md:0,max:6};eq(NB.fixCfg(c,1,true).max,1,'solo max');eq(NB.fixCfg(c,2,true),null,'solo refused');eq(NB.fixCfg(c,3,false).md,2,'to race');eq(minPlayers(NB,{md:0}),1,'solo min');eq(minPlayers(NB,{md:2}),2,'race min')}
/* 봇끼리 끝까지: 모드·자릿수·난이도 */
let nbt=0;
for(let rep=0;rep<36;rep++){
  const md=rep%2?2:1,n=md===2?2+rep%5:2,len=3+rep%3;
  hostNew(false,'t','t');H.cfg={...cfgFor('baseball'),game:'baseball',md,len,turn:30,max:n};
  H.members=[];for(let i=0;i<n;i++)H.members.push({name:'b'+i,bot:true,conn:null,host:i===0,lv:(rep+i)%3});
  for(let g=0;g<2;g++){
    hostStart();let guard=0;
    while(H.phase!=='over'&&guard++<30000){NOW+=250;engineTick();nbt++;const cur=H.players[H.turn];if(H.phase==='play'&&cur&&cur.finished){fail('baseball turn on dead');break}}
    if(H.phase!=='over')fail('baseball bots stuck md='+md+' len='+len);
    if(H.nb.res.w>=0&&H.players[H.nb.res.w].rank!==1)fail('baseball winner rank');
    if(md===2&&JSON.stringify(H.players.map(p=>p.rank).sort())!==JSON.stringify(H.players.map((_,i)=>i+1)))fail('baseball ranks '+H.players.map(p=>p.rank));
  }
}
console.log('baseball ticks',nbt);
