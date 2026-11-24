/* 흑과백 테스트 (tests/engine.test.js가 이 파일을 불러서 { } 블록 안에서 돌림)
   앞에서 정해져 있는 것: BW(=GAMES.blackwhite), fail(), hostNew·hostStart·engineTick·snapFor 등 공통 엔진 */
const T=BW._test;
const eq=(a,b,m)=>{if(a!==b)fail('blackwhite '+m+': '+a+' != '+b)};
/* 비교: 큰 수가 이김, 0은 8만 이김, 같으면 무승부 */
eq(T.cmp(5,3),1,'5>3');eq(T.cmp(3,5),-1,'3<5');eq(T.cmp(4,4),0,'tie');
eq(T.cmp(0,8),1,'0 beats 8');eq(T.cmp(8,0),-1,'8 loses to 0');eq(T.cmp(0,1),-1,'0 loses to 1');eq(T.cmp(8,7),1,'8 beats 7');eq(T.cmp(1,0),1,'1 beats 0');
eq(T.colOf(0),0,'0 black');eq(T.colOf(7),1,'7 white');
/* 봇: 낼 수 있는 타일만 */
for(let k=0;k<200;k++){const h=[1,4,6],lc=k%3-1,v=T.botPick(h,lc);if(!h.includes(v))fail('blackwhite bot picked '+v)}
eq(T.botPick([2,3,8],0,()=>.9),8,'bot follows black with tile that beats most blacks');
/* 보통·어려움: 낼 수 있는 타일만, 끝까지 짐작이 맞는지 */
const seedR=a=>()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
{const S=T.oppSets([{m:5,oc:0,w:0}]);eq(S.size,2,'opp black beat 5 → 6 or 8');eq(S.get(511&~(1<<6)),1,'6 used');eq(S.get(511&~(1<<8)),1,'8 used')}
{const S=T.oppSets([{m:8,oc:0,w:0}]);eq(S.size,1,'only 0 beats 8');eq([...S.keys()][0],510,'0 used')}
{const S=T.oppSets([{m:3,oc:1,w:-1},{m:2,oc:1,w:1}]);eq(S.size,1,'tie 3 + white lost to 2 → 1');eq([...S.keys()][0],511&~(1<<3)&~(1<<1),'3 and 1 used')}
for(const lv of [1,2])for(let k=0;k<12;k++){
  const me=[0,2,3,5,6,8],V={me,rec:[{m:1,oc:0,w:1},{m:4,oc:1,w:0},{m:7,oc:1,w:1}],sc:[2,1],lc:k%3-1},v=T.botDecide(V,lv,seedR(k+lv*99));
  if(!me.includes(v))fail('blackwhite lv'+lv+' picked '+v);
}
eq(T.botDecide({me:[4],rec:[],sc:[0,0],lc:1},2),4,'last tile');
/* 어려움은 섞어서 냄: 첫 판 선을 여러 번 고르면 두 가지 넘게 나옴 */
{const seen=new Set();for(let k=0;k<40;k++)seen.add(T.botDecide({me:[0,1,2,3,4,5,6,7,8],rec:[],sc:[0,0],lc:-1},2,seedR(k)));if(seen.size<2)fail('blackwhite hard lead never mixes')}

/* 사람 둘로 시작해서 손으로 진행 */
const setup=first=>{
  hostNew(false,'t','t');H.cfg={...cfgFor('blackwhite'),game:'blackwhite',turn:30};
  H.members=[{name:'a',bot:false,conn:null,host:true,cid:''},{name:'b',bot:false,conn:{},host:false,cid:'c1'}];
  hostStart();
  for(let k=0;k<80;k++){NOW+=250;engineTick()}   // 시작 연출
  if(first!=null&&H.bw.A!==first){H.bw.A=first;H.bw.first=first;H.turn=first}
};
const put=(s,v)=>BW.engine.act(s,{t:'put',v});
const waitShow=()=>{for(let k=0;k<12;k++){NOW+=250;engineTick()}};
setup(0);
eq(H.phase,'play','started');eq(H.bw.ph,'lead','lead phase');
put(1,5);eq(H.bw.hand[1].length,9,'not your turn');
put(0,9);eq(H.bw.hand[0].length,9,'no tile 9');
put(0,6);eq(H.bw.ph,'follow','follow after lead');eq(H.turn,1,'turn to follower');
{const s=snapFor(1);eq(s.o.pl[0].c,0,'follower sees black');eq(s.o.pl[0].v,null,'follower does not see number');
 eq(snapFor(0).o.pl[0].v,6,'leader sees own number');
 eq(JSON.stringify(s.o.oc[1]),'null','own colors not sent');eq(s.o.oc[0].length,8,'opponent colors count');
 eq(s.o.oc[0].filter(c=>c===0).length,4,'opponent black left');}
put(1,6);eq(H.bw.rec[0].w,-1,'same number tie');eq(H.bw.sc.join(),'0,0','tie no score');
eq('t' in snapFor(0),false,'no turn while showing');
waitShow();eq(H.bw.A,0,'tie keeps leader');eq(H.turn,0,'leader again');
put(0,8);put(1,0);eq(H.bw.rec[1].w,1,'0 beats 8');eq(H.bw.sc.join(),'0,1','score after 0 vs 8');
waitShow();eq(H.bw.A,1,'winner leads');eq(H.turn,1,'winner turn');
{const s=snapFor(0);eq(s.o.rec[1].v[1],null,'opponent number hidden in record');eq(s.o.rec[1].v[0],8,'own number in record');
 const sp=snapFor(-1);eq(sp.o.rec[1].v.join(),',','spectator sees no numbers');eq(sp.o.my,null,'spectator has no hand');}
/* 제한 시간: 무작위로 나감 (패배 아님) */
{const n=H.bw.hand[1].length;NOW+=31000;engineTick();eq(H.bw.hand[1].length,n-1,'timeout plays a tile');eq(H.phase,'play','timeout is not a loss')}
/* 5점 먼저 */
setup(0);
for(let r=0;r<5;r++){put(0,[8,7,6,5,4][r]);put(1,[6,5,4,3,2][r]);waitShow()}
eq(H.phase,'over','5 points ends');eq(H.bw.sc[0],5,'5 points');eq(H.players[0].rank,1,'winner rank');
{const s=snapFor(1);eq(s.o.rec[0].v[0],8,'numbers revealed at end');eq(s.o.ov[0].length,4,'remaining revealed')}
/* 9판 끝: 4:4 무승부 */
setup(0);
{   // 같은 수 한 판 + 서로 4판씩
 const seq=[[8,1],[1,8],[7,2],[2,7],[6,3],[3,6],[5,0],[0,5],[4,4]];
 for(const [x,y] of seq){if(H.phase!=='play')break;const a=H.bw.A;if(a===0){put(0,x);put(1,y)}else{put(1,y);put(0,x)}waitShow()}}
eq(H.phase,'over','9 rounds end');eq(H.bw.rec.length,9,'9 rounds');eq(H.bw.sc.join(),'4,4','4:4');eq(H.bw.res.w,-1,'4:4 draw');eq(H.players[0].rank,1,'draw rank 1');eq(H.players[1].rank,1,'draw rank 1 b');
/* 항복 */
setup(0);BW.engine.act(1,{t:'surrender'});eq(H.phase,'over','surrender ends');eq(H.bw.res.w,0,'surrender winner');
/* 봇은 공개된 정보만: 상대 숫자만 다르고 색·승패가 같은 두 판에서 보는 것과 고르는 타일이 같음 */
{
  const look=(oppT,lv,seed)=>{
    setup(0);
    put(0,5);put(1,oppT[0]);waitShow();   // 내 5 vs 상대 흑(6 또는 8): 상대 승 → 상대가 선
    put(1,oppT[1]);   // 상대가 백을 냄 (3 또는 7) → 내가 따라 냄
    return {V:JSON.stringify(T.botView(0)),v:T.botDecide(T.botView(0),lv,seedR(seed))};
  };
  for(const lv of [0,1,2])for(const seed of [1,2,3]){
    const a=look([6,3],lv,seed),b=look([8,7],lv,seed);
    eq(a.V,b.V,'bot view hides opponent numbers');eq(a.v,b.v,'lv'+lv+' same pick with hidden numbers changed');
  }
}
/* 보통은 쉬움을, 어려움은 보통을 이김 (정해진 난수로 한 판씩 번갈아 선) */
{
  const R0=Math.random,bp={...T.BP};
  const duel=(A,B,n,seed)=>{
    Math.random=seedR(seed);let sc=0;
    for(let g=0;g<n;g++){
      hostNew(false,'t','t');H.cfg={...cfgFor('blackwhite'),game:'blackwhite',turn:30};
      const lv=g%2?[B,A]:[A,B];
      H.members=lv.map((l,i)=>({name:'d'+i,bot:true,conn:null,host:!i,lv:l}));
      H.players=H.members.map(m=>({name:m.name,bot:true,lv:m.lv,hand:[],finished:false,rank:null}));
      H.phase='play';BW.engine.start();
      for(let k=0;k<40&&H.phase==='play';k++){const O=H.bw;if(O.ph==='show'){NOW=O.showUntil+1;BW.engine.tick(NOW);continue}const i=H.turn;T.playTile(i,T.botDecide(T.botView(i),lv[i]),false)}
      const w=H.bw.res.w,ia=g%2;sc+=w<0?.5:w===ia?1:0;
    }
    Math.random=R0;return sc/n;
  };
  const m=duel(1,0,300,7);if(m<.56)fail('blackwhite medium vs easy '+m);
  Object.assign(T.BP,{types:8,M:12,it:200});   // 테스트가 빨리 끝나게 어려움을 가볍게
  const h=duel(2,1,60,11);if(h<.56)fail('blackwhite hard vs medium '+h);
  Object.assign(T.BP,bp);
  console.log('blackwhite duel medium/easy',m.toFixed(3),'hard/medium',h.toFixed(3));
}
/* 봇끼리 끝까지 (여러 번): 9판 안에 끝나고, 타일 수가 맞음 (난이도를 섞어서) */
let bwt=0;
const bp0={...T.BP};Object.assign(T.BP,{types:6,M:8,it:120});
for(let rep=0;rep<40;rep++){
  hostNew(false,'t','t');H.cfg={...cfgFor('blackwhite'),game:'blackwhite',turn:[30,10,60][rep%3]};
  H.members=[{name:'b0',bot:true,conn:null,host:true,lv:rep%3},{name:'b1',bot:true,conn:null,host:false,lv:(rep+1)%3}];
  for(let g=0;g<2;g++){
    hostStart();let guard=0;
    while(H.phase!=='over'&&guard++<4000){NOW+=250;engineTick();bwt++;
      const O=H.bw;if(O.hand[0].length+O.rec.length+(O.pl[0]>=0&&O.ph==='follow'?1:0)!==9)fail('blackwhite tiles lost '+JSON.stringify(O))}
    if(H.phase!=='over')fail('blackwhite bots stuck');
    const O=H.bw;if(O.rec.length>9)fail('blackwhite >9 rounds');
    if(Math.max(...O.sc)>5)fail('blackwhite score >5');
    if(O.res.w>=0&&O.sc[O.res.w]<=O.sc[1-O.res.w])fail('blackwhite winner has lower score');
  }
}
Object.assign(T.BP,bp0);
console.log('blackwhite ticks',bwt);
