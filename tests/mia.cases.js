/* 미아 테스트 (tests/engine.test.js가 이 파일을 불러서 { } 블록 안에서 돌림) */
const T=MI._test;
const eq=(a,b,m)=>{if(a!==b)fail('mia '+m+': '+a+' != '+b)};
const I=T.IX,E=T.newWalls;
const V_=(c)=>c*2,H_=(c)=>c*2+1;   // 벽 번호: 칸 c 동쪽 세로 벽, 칸 c 남쪽 가로 벽
eq(T.ACTS,1,'one action');
/* 칸 이름·주사위 */
eq(T.cellName(I(0,0)),'A9','A9 top left');eq(T.cellName(I(8,8)),'I1','I1 bottom right');eq(T.diceCell(1,1),I(0,8),'dice 1,1');eq(T.diceCell(9,9),I(8,0),'dice 9,9');
/* 벽 자리: 8×8 꼭짓점마다 둘, 판 밖 없음, 두 칸 */
{let n=0;for(let W=0;W<162;W++)if(T.validWall(W))n++;eq(n,128,'128 wall spots');eq(T.validWall(V_(I(8,0))),false,'east edge');eq(T.validWall(V_(I(0,8))),false,'south end');eq(T.validWall(H_(I(8,0))),false,'east end');eq(T.validWall(999),false,'bad')}
{const w=E();T.setWall(w,V_(I(4,4)),1);eq(T.step(w,I(4,4),1),I(4,4),'wall blocks top');eq(T.step(w,I(4,5),1),I(4,5),'wall blocks bottom');eq(T.step(w,I(4,6),1),I(5,6),'wall ends');eq(T.step(w,I(5,5),3),I(5,5),'both sides');
 const h=E();T.setWall(h,H_(I(4,4)),1);eq(T.step(h,I(4,4),2),I(4,4),'h blocks left');eq(T.step(h,I(5,4),2),I(5,4),'h blocks right');eq(T.step(h,I(6,4),2),I(6,5),'h ends')}
/* 이동·거리 */
{const w=E();eq(T.step(w,I(0,0),0),I(0,0),'edge stays');eq(T.distMap(w,I(0,0))[I(8,8)],16,'corner to corner');T.setWall(w,V_(I(4,4)),1);eq(T.distMap(w,I(4,4))[I(5,4)],3,'around wall')}
/* 겹침·십자 금지 */
{const w=E();T.setWall(w,V_(I(4,4)),1);eq(T.wallOK(w,V_(I(4,4))),false,'same');eq(T.wallOK(w,V_(I(4,3))),false,'overlap up');eq(T.wallOK(w,V_(I(4,5))),false,'overlap down');eq(T.wallOK(w,H_(I(4,4))),false,'cross');eq(T.wallOK(w,V_(I(4,6))),true,'end to end');eq(T.wallOK(w,H_(I(3,4))),true,'T shape')}
/* 격리 금지: 구석 칸, 두 칸 구역 */
{const w=E();T.setWall(w,V_(I(0,0)),1);eq(T.wallOK(w,H_(I(0,0))),false,'corner sealed');eq(T.connected(w),true,'still connected');
 const r=E();T.setWall(r,V_(I(1,0)),1);eq(T.wallOK(r,H_(I(0,1))),false,'2x2 sealed')}
/* 누른 곳의 벽 */
eq(T.wallAt(5,4.9),V_(I(4,4)),'tap vertical');eq(T.wallAt(4.9,5),H_(I(4,4)),'tap horizontal');eq(T.validWall(T.wallAt(8.9,8.9)),true,'corner tap');eq(T.validWall(T.wallAt(.1,.1)),true,'corner tap 2');eq(T.wallAt(9.5,1),-1,'outside');
/* 믿음: 진짜 자리를 잃지 않음 */
{const w=E(),flag=I(2,2);T.setWall(w,H_(I(6,5)),1);let pos=I(6,6),bel=[];for(let i=0;i<81;i++)if(i!==flag)bel.push(i);
 for(const d of [0,0,3,1,2,3,3,0]){pos=T.step(w,pos,d);bel=T.beliefMove(bel,w,d);const dist=T.distMap(w,flag);bel=T.beliefFilter(bel,dist,dist[pos]);if(!bel.includes(pos))fail('mia belief lost')}}
{const w=E();for(let k=0;k<30;k++)eq(T.botDir([I(4,4)],w,I(4,0),()=>.5),0,'bot heads north')}
/* 게임 만들기 */
const setup=(n,bots,turn,md)=>{
  hostNew(false,'t','t');H.cfg={...cfgFor('mia'),game:'mia',turn:turn||30,max:4,md:md||0};
  H.members=[];for(let i=0;i<n;i++)H.members.push(bots?{name:'b'+i,bot:true,conn:null,host:i===0,lv:0}:{name:'p'+i,bot:false,conn:i?{}:null,host:i===0,cid:i?'c'+i:''});
  hostStart();for(let k=0;k<70;k++){NOW+=250;if(H.mia.ph==='setup'&&H.deadline-NOW<3000)H.deadline=NOW+15000;engineTick()}
};
const fin=()=>{for(let k=0;k<40&&H.mia.ph==='roll';k++){NOW+=250;engineTick()}};
const skipSetup=()=>{const X_=H.mia;while(X_.ph==='setup'){const L=T.legalWalls(X_.w);if(!T.doWall(H.turn,L[0]))fail('mia setup wall')}};
/* 판을 비워 놓고 움직임 단계로: 말·탈출구는 테스트가 정함 */
const place=()=>{skipSetup();const X_=H.mia;for(let i=0;i<X_.cnt;i++)if(X_.pos[T.targetOf(i)]<0)T.doPick(i,40);fin();X_.w.fill(0);X_.ws.length=0;X_.left=X_.left.map(()=>X_.wn)};
/* 시작 전 벽: 인원별 수, 번갈아, 끝나면 시작 칸 */
for(const [n,each,per] of [[2,10,5],[3,6,3],[4,5,2]]){setup(n);const X_=H.mia;eq(X_.wn,each,'walls each '+n);eq(X_.ph,'setup','starts setup');eq(H.turn,X_.A,'first sets');eq(snapFor(0).mia.flag[0],-1,'flag hidden');
 for(let k=0;k<n*per;k++){const s=H.turn;eq(s,(X_.A+k)%n,'alternate');eq(T.doGo(s,0),false,'no move in setup');T.doPick(s,3);eq(X_.pos.every(c=>c<0),true,'no pick in setup');eq(T.doWall(s,T.legalWalls(X_.w)[k*3]),true,'setup wall')}
 eq(X_.ph,'place','place after setup');eq(X_.ws.length,n*per,'walls on board');for(let i=0;i<n;i++)eq(X_.left[i],each-per,'left '+n)}
/* 시작 전 시간 초과: 무작위 벽 */
setup(2);{const X_=H.mia,k=X_.ws.length;NOW+=16000;engineTick();eq(X_.ws.length,k+1,'setup timeout wall')}
/* 시작 칸: 다음 사람 칸, 탈출구는 그 뒤 */
setup(2);skipSetup();{const X_=H.mia;
 hostAct(0,{t:'pick',c:5});eq(X_.pos[1],5,'0 picks for 1');hostAct(0,{t:'pick',c:6});eq(X_.pos[1],5,'no double pick');
 eq(snapFor(0).mia.pos[1],5,'picker sees own pick');eq(snapFor(1).mia.pos[1],-1,'target cannot see');eq(snapFor(1).t,1,'still my turn');eq(snapFor(0).t,1,'done sees other');
 hostAct(1,{t:'pick',c:7});eq(X_.ph,'roll','roll after picks');
 for(let i=0;i<2;i++){if(X_.flag[i]<0)fail('mia no flag');if(X_.flag[i]===X_.pos[i])fail('mia flag on start')}
 eq(snapFor(0).t,undefined,'no turn in roll');fin();eq(X_.ph,'move','move after roll');eq(H.turn,X_.A,'first plays')}
/* 비밀: 끝나기 전까지 내 자리는 오지 않음, 부딪혀도 같은 상태, 한 라운드가 끝나야 거리 */
setup(2);place();{const X_=H.mia,a=X_.A,o=1-a;X_.pos[a]=I(0,0);X_.flag[a]=I(8,8);X_.flag[o]=I(0,8);X_.pos[o]=I(4,4);
 eq(snapFor(a).mia.pos[a],-1,'own hidden');eq(snapFor(o).mia.pos[a],I(0,0),'others see');eq(snapFor(-1).mia.pos[a],I(0,0),'spectator sees');
 eq(T.doGo(a,0),true,'bump allowed');eq(X_.pos[a],I(0,0),'bumped stays');eq(H.turn,o,'one action ends turn');
 const s=snapFor(a);eq(s.mia.pos[a],-1,'still hidden');eq(s.mia.lm,null,'no move detail');eq(JSON.stringify(s.mia.hist),'[[[0],-1]]','no result yet');
 if(JSON.stringify(s).includes('"path"'))fail('mia path leaked');
 eq(T.doGo(o,0),true,'other move');eq(snapFor(a).mia.hist[0][1],16,'distance after round');eq(snapFor(o).mia.hist[0][1],9,'own distance');eq(X_.rn,1,'round')}
/* 벽: 라운드 끝 거리에 반영, 수 제한, 격리 거부(턴 유지) */
setup(2);place();{const X_=H.mia,a=X_.A,o=1-a;X_.pos[a]=I(3,4);X_.flag[a]=I(4,4);X_.pos[o]=I(8,8);X_.flag[o]=I(0,0);
 eq(X_.left[a],10,'10 each');T.doGo(a,2);eq(T.doWall(o,V_(I(3,4))),true,'wall');eq(X_.left[o],9,'wall count');eq(snapFor(a).mia.hist[0][1],4,'wall at round end');
 X_.left[a]=0;eq(T.doWall(a,V_(I(1,1))),false,'no walls left');eq(T.doGo(a,0),true,'move instead')}
setup(2);place();{const X_=H.mia,a=X_.A;T.setWall(X_.w,V_(I(0,0)),1);const n=X_.n;eq(T.doWall(a,H_(I(0,0))),false,'isolation rejected');eq(X_.n,n,'turn kept')}
/* 클래식: 라운드 끝 승리, 동시 도착 무승부, 3명 함께 승리 */
setup(2);place();{const X_=H.mia,a=X_.A,o=1-a;X_.pos[a]=I(3,4);X_.flag[a]=I(4,4);X_.pos[o]=I(5,5);X_.flag[o]=I(5,4);
 T.doGo(a,1);eq(H.phase,'play','arrival waits round end');T.doGo(o,0);eq(H.phase,'over','over');eq(X_.res.w.length,0,'draw');eq(H.players[0].rank,1,'draw 0');eq(H.players[1].rank,1,'draw 1');eq(Array.isArray(snapFor(0).mia.path),true,'path at end');eq(snapFor(a).mia.pos[a],I(4,4),'revealed')}
setup(2);place();{const X_=H.mia,a=X_.A,o=1-a;X_.pos[a]=I(3,4);X_.flag[a]=I(4,4);X_.pos[o]=I(0,0);X_.flag[o]=I(8,8);
 T.doGo(a,1);T.doGo(o,1);eq(X_.res.w[0],a,'winner');eq(H.players[a].rank,1,'rank win');eq(H.players[o].rank,2,'rank lose')}
setup(3);place();{const X_=H.mia,a=X_.A,b=(a+1)%3,c=(a+2)%3;X_.pos[a]=I(3,4);X_.flag[a]=I(4,4);X_.pos[b]=I(5,5);X_.flag[b]=I(5,4);X_.pos[c]=I(0,0);X_.flag[c]=I(8,8);
 T.doGo(a,1);T.doGo(b,0);eq(H.phase,'play','third pending');T.doGo(c,1);eq(X_.res.w.length,2,'two winners');eq(H.players[c].rank,2,'third')}
/* 선 넘기기: 3~4명만 */
setup(3);place();{const X_=H.mia,a=X_.A;for(let i=0;i<3;i++){X_.pos[i]=I(4,4);X_.flag[i]=I(0,0)}
 for(let r=0;r<3;r++){eq(H.turn,(a+r)%3,'rotates '+r);for(let k=0;k<3;k++)T.doGo(H.turn,(k+r)%2?1:3)}}
setup(2);place();{const X_=H.mia,a=X_.A;for(let i=0;i<2;i++){X_.pos[i]=I(4,4);X_.flag[i]=I(0,0)}for(let r=0;r<3;r++){eq(H.turn,a,'2p keeps first');T.doGo(H.turn,1);T.doGo(H.turn,3)}}
/* 배틀로얄: 탈출구 하나, 먼저 밟으면 바로 승리, 라운드를 기다리지 않음 */
setup(3,false,30,1);skipSetup();{const X_=H.mia;for(let i=0;i<3;i++)if(X_.pos[T.targetOf(i)]<0)T.doPick(i,10+i);eq(X_.flag[0],X_.flag[1],'same exit');eq(X_.flag[1],X_.flag[2],'same exit 2');eq(X_.roll[1],null,'one roll');if(X_.pos.includes(X_.flag[0]))fail('mia exit on start');eq(T.rollMs(1)<T.rollMs(3),true,'short roll');fin();eq(X_.ph,'move','br move');
 X_.w.fill(0);const a=H.turn,b=(a+1)%3,c=(a+2)%3,f=I(4,4);X_.flag=[f,f,f];X_.pos[a]=I(0,0);X_.pos[b]=I(3,4);X_.pos[c]=I(5,4);
 T.doGo(a,1);eq(H.phase,'play','not yet');T.doGo(b,1);eq(H.phase,'over','instant win');eq(X_.res.w.length,1,'single winner');eq(X_.res.w[0],b,'first stepper');eq(H.players[b].rank,1,'rank 1');eq(H.players[c].rank,2,'rank 2')}
/* 제한 시간 */
setup(2);place();{const X_=H.mia,i=H.turn,n=X_.n;NOW+=31000;engineTick();eq(X_.n,n+1,'timeout acted');eq(X_.hist[i].length,1,'timeout history');eq(H.phase,'play','not loss')}
setup(2);skipSetup();{const X_=H.mia;NOW+=31000;engineTick();eq(X_.ph,'roll','place timeout');if(X_.pos[0]<0||X_.pos[1]<0)fail('mia place timeout pos')}
/* 항복 */
setup(3);{const X_=H.mia,a=X_.A;T.doSurrender(a);eq(H.phase,'play','3p continues');if(H.turn===a)fail('mia setup skips surrendered');skipSetup();eq(X_.ph,'place','place after surrender');for(let i=0;i<3;i++)if(!H.players[i].finished&&!H.players[T.targetOf(i)].finished&&X_.pos[T.targetOf(i)]<0)T.doPick(i,3);fin();eq(X_.ph,'move','move with surrender');const S=snapFor((a+1)%3);eq(S.mia.pos[a]<0,true,'out hidden');eq(S.mia.out[a],1,'out mark')}
setup(3);place();{const X_=H.mia,a=X_.A,b=(a+1)%3,c=(a+2)%3;X_.pos[a]=X_.pos[b]=X_.pos[c]=I(4,4);X_.flag[a]=X_.flag[b]=X_.flag[c]=I(0,0);T.doGo(a,0);T.doSurrender(b);eq(H.turn,c,'skip surrendered');T.doGo(c,0);eq(X_.rn,1,'round ends');T.doSurrender(a);T.doSurrender(c);eq(H.phase,'over','all gone')}
setup(2);{T.doSurrender(1);eq(H.phase,'over','over 2p');eq(H.players[0].rank,1,'left wins')}
{setup(2);const a=H.mia.A;T.doSurrender(1);eq(T.pickFirst(true,2),(a+1)%2,'again next first')}
/* 어려움 판단 */
{const w=E();eq(T.hardDir([I(4,1)],w,I(4,0),1,()=>.5),0,'hard goes to exit');
 eq(T.hardWall([I(8,8)],E(),I(0,0),5,[{pos:I(4,3),flag:I(4,1)}])>=0,true,'hard blocks leader');
 eq(T.hardWall([I(1,0)],E(),I(0,0),5,[{pos:I(8,8),flag:I(0,8)}]),-1,'hard no wall when ahead');
 eq(T.hardWall([I(8,8)],E(),I(0,0),0,[{pos:I(4,3),flag:I(4,1)}]),-1,'no walls left')}
/* 봇끼리: 끝까지 가고 후보를 잃지 않음 */
for(const [n,md] of [[2,0],[3,0],[4,0],[2,1],[4,1]]){let rs=0;for(let g=0;g<12;g++){setup(n,true,30,md);let k=0;
  while(H.phase==='play'&&k++<40000){NOW+=250;engineTick();const X_=H.mia;if(X_.ph==='move'&&!X_.done.length)for(let i=0;i<n;i++){if(H.players[i].finished)continue;if(!X_.bel[i].includes(X_.pos[i]))fail('mia bot belief lost');if(!T.connected(X_.w))fail('mia disconnected')}}
  if(H.phase!=='over')fail('mia bots stuck '+n);rs+=H.mia.rn}
 console.log('mia bots',n,'md',md,'avg rounds',(rs/12).toFixed(1))}
const duel=(a,b,N)=>{let wa=0,wb=0;for(let g=0;g<N;g++){hostNew(false,'t','t');H.cfg={...cfgFor('mia'),game:'mia',turn:30,max:2};
  const sw=g%2;H.members=[{name:'x',bot:true,conn:null,host:true,lv:sw?b:a},{name:'y',bot:true,conn:null,host:false,lv:sw?a:b}];hostStart();let k=0;
  while(H.phase!=='over'&&k++<60000){NOW+=250;engineTick()}
  if(H.phase!=='over'){fail('mia duel stuck');continue}
  const w=H.mia.res.w;if(w.length===1){if((w[0]===0)!==!!sw)wa++;else wb++}}
 return [wa,wb]};
for(const [a,b] of [[1,0],[2,1]]){const r=duel(a,b,24);console.log('mia duel lv'+a,'vs lv'+b,r[0],':',r[1]);if(r[0]<r[1])fail('mia level order '+a+'/'+b)}
console.log('mia ok');
