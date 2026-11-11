/* 루미큐브 테스트 (tests/engine.test.js가 이 파일을 불러서 { } 블록 안에서 돌림) */
const TT=RM._test,E=RM.engine,RM_GAMES=120;
const eq=(a,b,m)=>{if(a!==b)fail('rummi '+m+': '+a+' != '+b)};
const pass=ms=>{for(let k=0;k<ms/50;k++){NOW+=50;engineTick()}};
const setup=(n,bots,cfg)=>{
  hostNew(false,'t','t');H.cfg={...cfgFor('rummi'),game:'rummi',...cfg};
  H.members=[];for(let i=0;i<n;i++)H.members.push(bots&&i>=bots?{name:'b'+i,bot:true,conn:null,host:false,lv:0}:{name:'p'+i,bot:false,conn:i?{}:null,host:i===0,cid:i?'c'+i:''});
  hostStart();H.dealUntil=0;
};
/* 타일: 색 0~3, 숫자 1~13, 벌 0~1. J0·J1 = 조커 */
const ID=(c,v,k)=>(k||0)*52+c*13+v-1,J0=TT.JK,J1=TT.JK+1,W=TT.W;
const at=(r,c)=>r*W+c;
/* 판을 정해 둠: 0번 차례. table = [[칸, [타일…]], …] */
const board=(rks,table,pool,md)=>{
  const O=H.rm;O.g=new Array(TT.CELLS).fill(-1);(table||[]).forEach(([p,ids])=>ids.forEach((x,j)=>{O.g[p+j]=x}));
  O.rk=rks.map(r=>r.slice());O.pool=(pool||[]).slice();O.md=md||rks.map(()=>0);O.passN=0;O.fin=null;
  H.players.forEach(p=>{p.finished=false;p.rank=null;p.hand=[0]});
  H.turn=0;O.base=O.g.slice();O.rk0=O.rk[0].slice();O.put=[];O.plan=null;H.deadline=NOW+90000;
};
const total=()=>{const O=H.rm;return O.g.filter(x=>x>=0).length+O.rk.flat().length+O.pool.length};
const uniq=()=>{const O=H.rm,a=[...O.g.filter(x=>x>=0),...O.rk.flat(),...O.pool];return new Set(a).size===a.length};

/* 묶음 판정 */
const sv=TT.setValue;
eq(sv([ID(0,3),ID(0,4),ID(0,5)]),12,'run');
eq(sv([ID(0,3),ID(0,4)]),0,'two tiles');
eq(sv([ID(0,3),ID(1,4),ID(0,5)]),0,'run mixed colour');
eq(sv([ID(0,5),ID(0,4),ID(0,3)]),0,'run backwards');
eq(sv([ID(0,12),ID(0,13),ID(0,1)]),0,'no wrap');
eq(sv([ID(0,11),ID(0,12),ID(0,13)]),36,'run to 13');
eq(sv([...Array(13).keys()].map(i=>ID(2,i+1))),91,'run 1~13');
eq(sv([ID(0,7),ID(1,7),ID(2,7)]),21,'group 3');
eq(sv([ID(0,7),ID(1,7),ID(2,7),ID(3,7)]),28,'group 4');
eq(sv([ID(0,7),ID(1,7),ID(0,7,1)]),0,'group same colour twice');
eq(sv([ID(0,7),ID(1,7),ID(2,7),ID(3,7),J0]),0,'group of 5');
eq(sv([ID(0,3),ID(0,3,1),ID(0,4)]),0,'duplicate number');
eq(sv([ID(0,3),J0,ID(0,5)]),12,'joker middle');
eq(sv([J0,ID(0,2),ID(0,3)]),6,'joker as 1');
eq(sv([J0,ID(0,1),ID(0,2)]),0,'joker below 1');
eq(sv([ID(0,12),ID(0,13),J0]),0,'joker above 13');
eq(sv([J0,ID(0,12),ID(0,13)]),36,'joker as 11');
eq(sv([ID(0,7),J0,ID(2,7)]),21,'joker in group');
eq(sv([ID(0,7),ID(1,7),ID(2,7),J0]),28,'joker 4th of group');
eq(sv([J0,J1,ID(0,5)]),15,'two jokers: bigger of run 12 / group 15');
eq(sv([ID(0,5),J0,J1]),18,'two jokers: run 5 6 7');
eq(sv([J0,J1]),0,'jokers only');
eq(sv([ID(0,3),J0,J1,ID(0,6)]),18,'two jokers inside run');
/* 구성 */
for(const n of [2,3,4]){setup(n);eq(H.rm.rk.every(r=>r.length===TT.START),true,n+' start tiles');eq(H.rm.pool.length,TT.NT-n*TT.START,n+' pool');eq(total(),TT.NT,n+' total');eq(uniq(),true,n+' unique')}
/* 숨김: 남의 패는 개수만 */
for(let k=0;k<10;k++){setup(3);const s=snapFor(1).o;
  eq(s.rk.slice().sort().join(),H.rm.rk[1].slice().sort().join(),'own rack');eq(s.all,null,'no racks in play');eq(s.n.join(),'14,14,14','counts');
  const mine=new Set(H.rm.rk[1]);if(JSON.stringify({...s,rk:null}).match(/\d+/g).length>40)fail('rummi snap too big');
  if(Object.keys(s).some(key=>key!=='rk'&&Array.isArray(s[key])&&s[key].length>3&&key!=='g'&&key!=='put'))fail('rummi snap leak '+Object.keys(s))}
setup(2);eq(snapFor(-1).o.rk,null,'spectator rack');
/* 차례가 아니면 못 함, 남의 타일·없는 타일·찬 칸·줄 넘김은 안 됨 */
setup(2,0,{meld:0});board([[ID(0,3),ID(0,4),ID(0,5),ID(1,9)],[ID(2,1),ID(2,2),ID(2,3)]],[[at(0,0),[ID(3,1),ID(3,2),ID(3,3)]]],[ID(1,1),ID(1,2),ID(1,3),ID(1,4)]);
E.act(1,{t:'mv',ids:[ID(2,1)],to:at(5,0)});eq(H.rm.g[at(5,0)],-1,'not turn');
E.act(0,{t:'mv',ids:[ID(2,1)],to:at(5,0)});eq(H.rm.g[at(5,0)],-1,'not my tile');
E.act(0,{t:'mv',ids:[ID(0,3)],to:at(0,1)});eq(H.rm.g[at(0,1)],ID(3,2),'cell taken');
E.act(0,{t:'mv',ids:[ID(0,3),ID(0,4),ID(0,5)],to:at(5,11)});eq(H.rm.rk[0].length,4,'row overflow');
E.act(0,{t:'mv',ids:[ID(0,3),ID(0,3)],to:at(5,0)});eq(H.rm.rk[0].length,4,'same tile twice');
E.act(0,{t:'mv',ids:[ID(0,3)],to:-1});E.act(0,{t:'mv',ids:[ID(0,3)],to:TT.CELLS});E.act(0,{t:'mv',ids:'x',to:0});E.act(0,{t:'mv',ids:[999],to:0});eq(H.rm.rk[0].length,4,'bad input');
/* 내고 마침 */
E.act(0,{t:'mv',ids:[ID(0,3),ID(0,4),ID(0,5)],to:at(5,0)});eq(H.rm.rk[0].length,1,'played');eq(H.rm.put.length,3,'put');
eq(snapFor(1).o.g.length,12,'live table for others');
E.act(0,{t:'end'});eq(H.turn,1,'turn passed');eq(H.rm.g[at(5,2)],ID(0,5),'kept');eq(H.rm.rk[0].length,1,'no draw after play');eq(H.rm.ev.k,'put','ev put');
/* 탁자 타일 옮기기: 쪼개 붙이기, 탁자 타일은 패로 못 가져옴 */
setup(2,0,{meld:0});board([[ID(3,4),ID(1,9)],[ID(2,1)]],[[at(0,0),[ID(3,1),ID(3,2),ID(3,3)]],[at(2,0),[ID(0,6),ID(1,6),ID(2,6),ID(3,6)]]],[ID(1,1)]);
E.act(0,{t:'back',ids:[ID(3,1)]});eq(H.rm.rk[0].length,2,'table tile stays');
E.act(0,{t:'mv',ids:[ID(3,4)],to:at(0,3)});E.act(0,{t:'back',ids:[ID(3,4)]});eq(H.rm.rk[0].length,2,'take back own');eq(H.rm.put.length,0,'put cleared');
E.act(0,{t:'mv',ids:[ID(3,4)],to:at(0,3)});
E.act(0,{t:'mv',ids:[ID(3,3),ID(3,4)],to:at(4,0)});eq(H.rm.g[at(0,2)],-1,'moved out');   // 3·4를 옮기고
E.act(0,{t:'mv',ids:[ID(3,3),ID(3,4)],to:at(4,1)});eq(H.rm.g[at(4,0)],-1,'shift onto own cells');eq(H.rm.g[at(4,2)],ID(3,4),'shifted');
E.act(0,{t:'end'});eq(H.turn,1,'invalid ends turn');eq(H.rm.g[at(0,2)],ID(3,3),'reverted');eq(H.rm.g[at(4,1)],-1,'reverted 2');
eq(H.rm.rk[0].length,3,'penalty: 2 back + 1 (pool had 1)');eq(H.rm.ev.k,'pen','ev pen');
/* 틀리면 3장 */
setup(2,0,{meld:0});board([[ID(3,4),ID(1,9)],[ID(2,1)]],[],[ID(1,1),ID(1,2),ID(1,3),ID(1,4)]);
E.act(0,{t:'mv',ids:[ID(3,4)],to:at(0,0)});E.act(0,{t:'end'});eq(H.rm.rk[0].length,5,'penalty 3');eq(H.rm.pool.length,1,'pool -3');eq(H.rm.g.every(x=>x<0),true,'table empty again');
/* 안 내고 마치면 1장. 옮기기만 한 것은 되돌림 */
setup(2,0,{meld:0});board([[ID(3,4)],[ID(2,1)]],[[at(0,0),[ID(3,1),ID(3,2),ID(3,3)]]],[ID(1,1),ID(1,2)]);
E.act(0,{t:'mv',ids:[ID(3,1),ID(3,2),ID(3,3)],to:at(6,6)});E.act(0,{t:'end'});eq(H.rm.rk[0].length,2,'draw 1');eq(H.rm.g[at(0,0)],ID(3,1),'rearrange only reverts');eq(H.rm.ev.k,'draw','ev draw');
/* 첫 등록: 30점 미만·탁자에 붙이기·탁자 타일 옮기기는 안 됨 */
setup(2);board([[ID(0,3),ID(0,4),ID(0,5),ID(3,4),ID(0,10),ID(1,10),ID(2,10)],[ID(2,1)]],[[at(0,0),[ID(3,1),ID(3,2),ID(3,3)]]],[ID(1,1),ID(1,2),ID(1,3),ID(1,4),ID(1,5),ID(1,6),ID(1,7)]);
E.act(0,{t:'mv',ids:[ID(3,1)],to:at(7,0)});eq(H.rm.g[at(0,0)],ID(3,1),'cannot touch table before meld');
E.act(0,{t:'mv',ids:[ID(0,3),ID(0,4),ID(0,5)],to:at(5,0)});E.act(0,{t:'end'});eq(H.rm.md[0],0,'12 points not enough');eq(H.rm.rk[0].length,10,'meld fail penalty');
H.turn=0;H.rm.base=H.rm.g.slice();H.rm.rk0=H.rm.rk[0].slice();H.rm.put=[];
E.act(0,{t:'mv',ids:[ID(0,10),ID(1,10),ID(2,10)],to:at(5,0)});E.act(0,{t:'mv',ids:[ID(3,4)],to:at(0,3)});
eq(TT.tableState(H.rm.g,H.rm.put,true).ok,false,'no attach on first meld');
E.act(0,{t:'back',ids:[ID(3,4)]});eq(TT.tableState(H.rm.g,H.rm.put,true).pts,30,'30 points');
E.act(0,{t:'end'});eq(H.rm.md[0],1,'melded');eq(H.turn,1,'meld passes turn');
/* 등록한 뒤에는 붙일 수 있음. 조커 빼 오기: 자리를 채우고 조커는 탁자에 */
setup(2);board([[ID(3,4),ID(0,7),ID(0,9)],[ID(2,1)]],[[at(0,0),[ID(3,1),ID(3,2),ID(3,3)]],[at(2,0),[ID(0,6),J0,ID(0,8)]]],[ID(1,1)],[1,0]);
E.act(0,{t:'mv',ids:[ID(3,4)],to:at(0,3)});
E.act(0,{t:'mv',ids:[J0],to:at(2,3)});E.act(0,{t:'mv',ids:[ID(0,7)],to:at(2,1)});E.act(0,{t:'mv',ids:[ID(0,9)],to:at(2,4)});   // 6 7 8 조커 9 → 틀림
eq(TT.tableState(H.rm.g,H.rm.put,false).ok,false,'joker misplaced');
E.act(0,{t:'mv',ids:[J0,ID(0,9)],to:at(2,4)});E.act(0,{t:'mv',ids:[ID(0,9)],to:at(2,3)});E.act(0,{t:'mv',ids:[J0],to:at(2,4)});   // 6 7 8 9 조커(10)
eq(TT.tableState(H.rm.g,H.rm.put,false).ok,true,'joker reused');
E.act(0,{t:'back',ids:[J0]});eq(H.rm.g[at(2,4)],J0,'joker from table stays on table');
E.act(0,{t:'end'});eq(H.phase,'over','went out');eq(H.players[0].rank,1,'winner');eq(H.players[1].rank,2,'loser');
{const o=snapFor(1).o;eq(o.all.length,2,'racks shown at end');eq(o.fin.w,0,'fin winner')}
/* 붙어 있는 묶음: 맞는 묶음들로 나눌 수 있으면 됨 */
{const sp=TT.splitRun;
 eq(sp([ID(0,3),ID(0,4),ID(0,5),ID(0,7),ID(1,7),ID(2,7)]).cuts.join(),'0,3','run + group adjacent');
 eq(sp([ID(0,3),ID(0,4),ID(0,5),ID(0,6),ID(0,7),ID(0,8)]).cuts.join(),'0','one long run, not two');
 eq(sp([ID(0,3),ID(0,4),ID(0,5),ID(0,7)]),null,'leftover tile');
 eq(sp([ID(0,7),ID(1,7),ID(2,7),ID(0,7,1),ID(1,7,1),ID(3,7)]).cuts.join(),'0,3','two groups adjacent');
 eq(sp([ID(0,3),ID(0,4)]),null,'short');
 eq(sp([ID(0,10),ID(1,10),ID(2,10),ID(3,1),ID(3,2),ID(3,3)],[ID(0,10),ID(1,10),ID(2,10)],true).pts,30,'meld next to table set');
 eq(sp([ID(3,1),ID(3,2),ID(3,3),ID(3,4)],[ID(3,4)],true),null,'meld cannot extend table set')}
setup(2,0,{meld:0});board([[ID(0,7),ID(1,7),ID(2,7),ID(1,9)],[ID(2,1)]],[[at(0,0),[ID(3,1),ID(3,2),ID(3,3)]]],[ID(1,1),ID(1,2),ID(1,3)]);
E.act(0,{t:'mv',ids:[ID(0,7),ID(1,7),ID(2,7)],to:at(0,3)});E.act(0,{t:'end'});eq(H.turn,1,'adjacent sets ok');eq(H.rm.rk[0].length,1,'adjacent sets no penalty');eq(H.rm.g[at(0,5)],ID(2,7),'adjacent kept');
/* 가운데를 빼면 붙음: 7 7 [7] 7 → 7 7 7. 연속은 안 붙음 */
setup(2,0,{meld:0});board([[ID(3,4),ID(3,5),ID(1,9)],[ID(2,1)]],[[at(2,2),[ID(0,7),ID(1,7),ID(2,7),ID(3,7)]],[at(4,0),[ID(0,1),ID(0,2),ID(0,3),ID(0,4),ID(0,5)]]],[ID(1,1),ID(1,2),ID(1,3)],[1,0]);
E.act(0,{t:'mv',ids:[ID(1,7)],to:at(8,0)});eq(H.rm.g.slice(at(2,2),at(2,6)).join(),[ID(0,7),ID(2,7),ID(3,7),-1].join(),'group closes');
E.act(0,{t:'mv',ids:[ID(0,3)],to:at(9,0)});eq(H.rm.g[at(4,2)],-1,'run stays open');eq(H.rm.g[at(4,3)],ID(0,4),'run right part stays');
E.act(0,{t:'mv',ids:[ID(0,3)],to:at(4,2)});E.act(0,{t:'mv',ids:[ID(1,7)],to:at(2,5)});
E.act(0,{t:'mv',ids:[ID(3,4),ID(3,5)],to:at(6,0)});E.act(0,{t:'mv',ids:[ID(3,7)],to:at(6,2)});   // 주황 7을 빼서 주황 4 5 뒤에 (틀린 묶음)
eq(H.rm.g.slice(at(2,2),at(2,6)).join(),[ID(0,7),ID(2,7),ID(1,7),-1].join(),'end tile removal keeps order');
E.act(0,{t:'back',ids:[ID(3,4)]});eq(H.rm.g[at(6,0)],-1,'back leaves gap when rest is invalid');
/* 시간 초과: 맞으면 그대로, 틀리면 되돌리고 3장, 안 냈으면 1장 */
setup(2,0,{meld:0});board([[ID(0,3),ID(0,4),ID(0,5),ID(1,9)],[ID(2,1)]],[],[ID(1,1),ID(1,2),ID(1,3),ID(1,4)]);
E.act(0,{t:'mv',ids:[ID(0,3),ID(0,4),ID(0,5)],to:at(5,0)});H.deadline=NOW+10;pass(100);eq(H.turn,1,'timeout turn');eq(H.rm.g[at(5,0)],ID(0,3),'timeout keeps valid');eq(H.rm.rk[0].length,1,'timeout no draw');
setup(2,0,{meld:0});board([[ID(0,3),ID(0,4),ID(0,5),ID(1,9)],[ID(2,1)]],[],[ID(1,1),ID(1,2),ID(1,3),ID(1,4)]);
E.act(0,{t:'mv',ids:[ID(0,3),ID(0,4)],to:at(5,0)});H.deadline=NOW+10;pass(100);eq(H.rm.rk[0].length,7,'timeout penalty');eq(H.rm.g.every(x=>x<0),true,'timeout reverted');
setup(2,0,{meld:0});board([[ID(0,3)],[ID(2,1)]],[],[ID(1,1),ID(1,2)]);H.deadline=NOW+10;pass(100);eq(H.rm.rk[0].length,2,'timeout draw');eq(H.turn,1,'timeout next');
/* 남은 패가 없고 모두 못 내면 점수로 */
setup(3,0,{meld:0});board([[ID(0,3),ID(1,9)],[J0],[ID(2,1),ID(2,5)]],[],[]);
E.act(0,{t:'end'});eq(H.phase,'play','pass 1');E.act(1,{t:'end'});E.act(2,{t:'end'});eq(H.phase,'over','all passed');
eq(H.players[2].rank,1,'6 points wins');eq(H.players[0].rank,2,'12 points');eq(H.players[1].rank,3,'joker 30');eq(H.rm.fin.why,'pts','by points');
/* 남은 패가 없을 때 누가 내면 넘김 횟수는 다시 셈 */
setup(2,0,{meld:0});board([[ID(0,3),ID(0,4),ID(0,5),ID(1,9)],[ID(2,1)]],[],[]);
E.act(0,{t:'mv',ids:[ID(0,3),ID(0,4),ID(0,5)],to:at(5,0)});E.act(0,{t:'end'});E.act(1,{t:'end'});eq(H.phase,'play','reset after play');E.act(0,{t:'end'});eq(H.phase,'over','then stalemate');
/* 항복: 내 차례면 되돌리고 넘어감, 타일은 남은 패로 */
setup(3,0,{meld:0});board([[ID(0,3),ID(0,4),ID(0,5),ID(1,9)],[ID(2,1)],[ID(2,2)]],[],[ID(1,1)]);
E.act(0,{t:'mv',ids:[ID(0,3),ID(0,4)],to:at(5,0)});E.act(0,{t:'surrender'});
eq(H.players[0].finished,true,'surrender');eq(H.players[0].rank,3,'surrender last');eq(H.rm.g.every(x=>x<0),true,'surrender reverts');eq(H.rm.pool.length,5,'tiles to pool');eq(H.turn,1,'turn moved');
E.act(2,{t:'surrender'});eq(H.phase,'over','last one wins');eq(H.players[1].rank,1,'winner by surrender');eq(H.players[2].rank,2,'second');
/* 봇 묶음 찾기 */
{const S=TT.rackSets([ID(0,3),ID(0,4),ID(0,5),ID(0,6),ID(1,9),ID(2,9),ID(3,9),ID(1,1)]);eq(S.length,2,'bot finds 2 sets');eq(S.every(s=>sv(s)>0),true,'bot sets valid')}
{const S=TT.rackSets([ID(0,3),ID(0,5),J0,ID(1,1)]);eq(S.length,1,'bot joker');eq(sv(S[0]),12,'bot joker middle')}
{const S=TT.rackSets([ID(0,12),ID(0,13),J0]);eq(sv(S[0]),36,'bot joker front at 13')}
for(let k=0;k<300;k++){const R=shuffle([...Array(TT.NT).keys()]).slice(0,14+k%10),S=TT.rackSets(R),F=S.flat();
  if(S.some(s=>!sv(s))||new Set(F).size!==F.length||F.some(x=>!R.includes(x))){fail('rummi bot sets invalid');break}}
/* 빈 자리 찾기: 양옆이 비어야 함 */
{const g=new Array(TT.CELLS).fill(-1);const p=TT.findSpot(g,13);eq(p%W,0,'full row');for(let c=0;c<W;c++)g[p+c]=c;const q=TT.findSpot(g,3);eq((q/W|0)!==(p/W|0),true,'other row');
 const f=new Array(TT.CELLS).fill(0);eq(TT.findSpot(f,3),-1,'no room')}
/* 봇 대전: 타일 보존, 차례가 넘어갈 때 탁자는 늘 맞음, 언제나 끝남 */
{let outs=0,pts=0,turns=0,t0=Date.now();
for(let g=0;g<RM_GAMES;g++){
  setup(2+g%3,1,{meld:g%4?1:0});H.players[0].bot=true;H.players[0].cid='';H.botActAt=NOW+1;
  let last=-1;
  for(let k=0;k<200000&&H.phase==='play';k++){NOW+=200;engineTick();
    if(total()!==TT.NT||!uniq()){fail('rummi tiles lost '+total());break}
    if(H.turn!==last){last=H.turn;turns++;if(H.phase==='play'&&!TT.tableState(H.rm.g,[],false).ok){fail('rummi invalid table kept');break}}}
  eq(H.phase,'over','bot game ends');
  eq(H.players.filter(p=>p.rank===1).length,1,'one winner');
  eq(H.players.map(p=>p.rank).sort().join(),[...Array(H.players.length).keys()].map(i=>i+1).join(),'ranks');
  if(H.rm.fin.why==='pts')pts++;else{outs++;eq(H.rm.rk[H.rm.fin.w].length,0,'winner empty')}
}
console.log('rummi bot games',RM_GAMES,'went out',outs,'by points',pts,'avg turns',Math.round(turns/RM_GAMES),'ms',Date.now()-t0)}
