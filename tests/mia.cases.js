/* 미아 테스트 (tests/engine.test.js가 이 파일을 불러서 { } 블록 안에서 돌림) */
const T=MI._test;
const eq=(a,b,m)=>{if(a!==b)fail('mia '+m+': '+a+' != '+b)};
const I=T.IX,E=()=>new Array(162).fill(0);
/* 칸 이름·주사위 */
eq(T.cellName(I(0,0)),'A9','A9 top left');eq(T.cellName(I(8,8)),'I1','I1 bottom right');eq(T.diceCell(1,1),I(0,8),'dice 1,1');eq(T.diceCell(9,9),I(8,0),'dice 9,9');
/* 변: 칸마다 사방, 판 끝은 없음 */
{let n=0;for(let e=0;e<162;e++)if(T.validEdge(e))n++;eq(n,144,'144 edges')}
eq(T.edgeOf(I(3,3),1),T.edgeOf(I(4,3),3),'same edge EW');eq(T.edgeOf(I(3,3),2),T.edgeOf(I(3,4),0),'same edge NS');
/* 이동: 벽·판 끝은 제자리 */
{const w=E();eq(T.step(w,I(4,4),0),I(4,3),'north');eq(T.step(w,I(4,4),1),I(5,4),'east');eq(T.step(w,I(0,0),0),I(0,0),'edge stays');eq(T.step(w,I(0,0),3),I(0,0),'edge stays w');
 w[T.edgeOf(I(4,4),1)]=1;eq(T.step(w,I(4,4),1),I(4,4),'wall stays');eq(T.step(w,I(5,4),3),I(5,4),'wall both sides')}
/* 거리: 벽을 돌아감 */
{const w=E();eq(T.distMap(w,I(4,4))[I(5,4)],1,'adjacent');w[T.edgeOf(I(4,4),1)]=1;eq(T.distMap(w,I(4,4))[I(5,4)],3,'around wall');eq(T.distMap(E(),I(0,0))[I(8,8)],16,'corner to corner')}
/* 격리 금지: 구석 칸은 두 번째 벽부터, 가운데 칸은 네 번째 벽, 두 칸 구역도 금지 */
{const w=E(),c=I(0,0);w[T.edgeOf(c,1)]=1;eq(T.wallOK(w,T.edgeOf(c,2)),false,'corner sealed');eq(T.connected(w),true,'still connected');
 const m=E(),k=I(4,4);for(const d of [0,1,2])m[T.edgeOf(k,d)]=1;eq(T.wallOK(m,T.edgeOf(k,3)),false,'cell sealed');
 const r=E(),a=I(4,4),b=I(5,4);for(const [q,d] of [[a,0],[a,2],[a,3],[b,0],[b,2]])r[T.edgeOf(q,d)]=1;eq(T.wallOK(r,T.edgeOf(b,1)),false,'two cells sealed');
 const s=E();s[T.edgeOf(I(4,4),1)]=1;eq(T.wallOK(s,T.edgeOf(I(4,4),1)),false,'same wall');eq(T.wallOK(E(),999),false,'bad edge');eq(T.wallOK(E(),I(8,0)*2),false,'east board edge');eq(T.wallOK(E(),I(0,8)*2+1),false,'south board edge')}
/* 누른 곳의 변 */
eq(T.edgeAt(4.9,4.5),T.edgeOf(I(4,4),1),'tap east');eq(T.edgeAt(4.1,4.5),T.edgeOf(I(4,4),3),'tap west');eq(T.edgeAt(4.5,4.1),T.edgeOf(I(4,4),0),'tap north');eq(T.edgeAt(4.5,4.9),T.edgeOf(I(4,4),2),'tap south');
eq(T.validEdge(T.edgeAt(8.95,8.9)),true,'corner tap valid');eq(T.validEdge(T.edgeAt(.02,.1)),true,'corner tap valid 2');eq(T.edgeAt(9.5,1),-1,'outside');
/* 믿음: 진짜 자리를 잃지 않음 */
{const w=E(),flag=I(2,2);w[T.edgeOf(I(6,6),0)]=1;let pos=I(6,6),bel=[];for(let i=0;i<81;i++)if(i!==flag)bel.push(i);
 for(const d of [0,0,3,1,2,3,3,0]){pos=T.step(w,pos,d);bel=T.beliefMove(bel,w,d);const dist=T.distMap(w,flag);bel=T.beliefFilter(bel,dist,dist[pos]);if(!bel.includes(pos))fail('mia belief lost')}}
/* 봇 방향: 후보가 하나면 가까워지는 쪽 */
{const w=E();for(let k=0;k<30;k++){const d=T.botDir([I(4,4)],w,I(4,0),()=>.5);eq(d,0,'bot heads north')}}
const setup=(n,bots,turn)=>{
  hostNew(false,'t','t');H.cfg={...cfgFor('mia'),game:'mia',turn:turn||30,max:4};
  H.members=[];for(let i=0;i<n;i++)H.members.push(bots?{name:'b'+i,bot:true,conn:null,host:i===0,lv:0}:{name:'p'+i,bot:false,conn:i?{}:null,host:i===0,cid:i?'c'+i:''});
  hostStart();for(let k=0;k<80;k++){NOW+=250;engineTick()}
};
const fin=()=>{for(let k=0;k<40&&H.mia.ph==='roll';k++){NOW+=250;engineTick()}};
/* 한 차례 = 행동 둘 */
const go2=(s,d,e)=>{T.doGo(s,d);return T.doGo(s,e==null?d:e)};
const place=()=>{const X_=H.mia;for(let i=0;i<X_.cnt;i++)if(X_.pos[T.targetOf(i)]<0)T.doPick(i,40);fin()};
/* 시작 칸 단계: 다음 사람의 칸을 정함, 깃발은 그 뒤, 한 사람이 두 번 못 고름 */
setup(2);{const X_=H.mia;eq(X_.ph,'place','starts in place');eq(snapFor(0).mia.flag[0],-1,'flag hidden');
 hostAct(0,{t:'pick',c:5});eq(X_.pos[1],5,'0 picks for 1');hostAct(0,{t:'pick',c:6});eq(X_.pos[1],5,'no double pick');
 eq(snapFor(0).mia.pos[1],5,'picker sees own pick');eq(snapFor(1).mia.pos[1],-1,'target cannot see');eq(snapFor(1).t,1,'still my turn');eq(snapFor(0).t,1,'done sees other');
 hostAct(1,{t:'pick',c:7});eq(X_.ph,'roll','roll after picks');
 for(let i=0;i<2;i++){if(X_.flag[i]<0)fail('mia no flag');if(X_.flag[i]===X_.pos[i])fail('mia flag on start')}
 eq(snapFor(0).t,undefined,'no turn in roll');fin();eq(X_.ph,'move','move after roll');eq(H.turn,X_.A,'first plays')}
/* 비밀: 끝나기 전까지 내 자리는 어떤 값으로도 오지 않음, 부딪혀도 같은 상태 */
setup(2);place();{const X_=H.mia,a=X_.A,o=1-a;X_.pos[a]=I(0,0);X_.flag[a]=I(8,8);X_.flag[o]=I(0,8);X_.pos[o]=I(4,4);
 eq(snapFor(a).mia.pos[a],-1,'own hidden');eq(snapFor(o).mia.pos[a],I(0,0),'others see');eq(snapFor(-1).mia.pos[a],I(0,0),'spectator sees');
 const before=snapFor(a);eq(T.doGo(a,0),true,'bump allowed');eq(X_.pos[a],I(0,0),'bumped stays');eq(H.turn,a,'second action');eq(snapFor(a).mia.acts,1,'one used');eq(T.doGo(a,3),true,'bump 2');eq(H.turn,o,'turn used');
 const s=snapFor(a);eq(s.mia.pos[a],-1,'still hidden');eq(s.mia.lm,null,'no move detail');eq(JSON.stringify(s.mia.hist),'[[[0,3],-1]]','no result yet');
 if(JSON.stringify(s).includes('"path"'))fail('mia path leaked');eq(before.mia.pos[a],-1,'before hidden');
 for(const l of H.log)if(/제자리|부딪/.test(String(l[0])))fail('mia log leaks bump');
 eq(T.doGo(o,0),true,'other move');eq(snapFor(a).mia.hist[0][1],-1,'no distance mid round');T.doGo(o,0);eq(snapFor(a).mia.hist[0][1],16,'distance after round');eq(snapFor(o).mia.hist[0][1],10,'own distance');eq(X_.rn,1,'round')}
/* 거리는 라운드 끝 벽까지 반영, 벽 수 제한, 격리 벽 거부 */
setup(2);place();{const X_=H.mia,a=X_.A,o=1-a;X_.pos[a]=I(3,4);X_.flag[a]=I(4,4);X_.pos[o]=I(8,8);X_.flag[o]=I(0,0);
 eq(X_.left[a],20,'40 split by 2');go2(a,3,1);eq(T.doWall(o,T.edgeOf(I(3,4),1)),true,'wall');eq(X_.left[o],19,'wall count');eq(T.doWall(o,T.edgeOf(I(7,7),1)),true,'two walls');eq(X_.left[o],18,'wall count 2');eq(snapFor(a).mia.hist[0][1],3,'wall counted at round end');
 eq(T.doWall(o,T.edgeOf(I(2,2),1)),false,'not your turn');X_.left[a]=0;eq(T.doWall(a,T.edgeOf(I(1,1),1)),false,'no walls left');eq(T.doGo(a,0),true,'move instead')}
setup(2);place();{const X_=H.mia,a=X_.A;H.turn=a;X_.w[T.edgeOf(I(0,0),1)]=1;const n=X_.n;eq(T.doWall(a,T.edgeOf(I(0,0),2)),false,'isolation rejected');eq(X_.n,n,'turn kept')}
/* 라운드 끝 승리: 동시 도착 무승부, 나중 사람이 도착해도 함께 판정 */
setup(2);place();{const X_=H.mia,a=X_.A,o=1-a;X_.pos[a]=I(3,4);X_.flag[a]=I(4,4);X_.pos[o]=I(5,5);X_.flag[o]=I(5,4);
 T.doWall(a,10);T.doGo(a,1);eq(H.phase,'play','arrival waits round end');T.doWall(o,20);T.doGo(o,0);eq(H.phase,'over','over');eq(X_.res.w.length,0,'draw');eq(H.players[0].rank,1,'draw rank 0');eq(H.players[1].rank,1,'draw rank 1');eq(Array.isArray(snapFor(0).mia.path),true,'path at end');eq(snapFor(a).mia.pos[a],I(4,4),'revealed at end')}
setup(2);place();{const X_=H.mia,a=X_.A,o=1-a;X_.pos[a]=I(3,4);X_.flag[a]=I(4,4);X_.pos[o]=I(0,0);X_.flag[o]=I(8,8);
 T.doWall(a,10);T.doGo(a,1);go2(o,1);eq(X_.res.w[0],a,'winner');eq(H.players[a].rank,1,'rank win');eq(H.players[o].rank,2,'rank lose')}
/* 3명: 도착 둘은 함께 승리 */
setup(3);place();{const X_=H.mia,a=X_.A,b=(a+1)%3,c=(a+2)%3;X_.pos[a]=I(3,4);X_.flag[a]=I(4,4);X_.pos[b]=I(5,5);X_.flag[b]=I(5,4);X_.pos[c]=I(0,0);X_.flag[c]=I(8,8);
 T.doWall(a,10);T.doGo(a,1);T.doWall(b,20);T.doGo(b,0);eq(H.phase,'play','third pending');go2(c,1);eq(X_.res.w.length,2,'two winners');eq(H.players[c].rank,2,'third')}
/* 제한 시간: 무작위 방향, 패배 아님 */
setup(2);place();{const X_=H.mia,i=H.turn,n=X_.n;NOW+=31000;engineTick();eq(X_.n,n+1,'timeout acted');eq(X_.hist[i].length,1,'timeout history');eq(H.phase,'play','not loss')}
/* 시작 칸 제한 시간: 모두 무작위 */
setup(2);{const X_=H.mia;NOW+=31000;engineTick();eq(X_.ph,'roll','place timeout');if(X_.pos[0]<0||X_.pos[1]<0)fail('mia place timeout pos')}
/* 3명 항복: 시작 칸, 라운드 중간 */
setup(3);{const X_=H.mia;T.doSurrender(1);eq(H.phase,'play','3p continues');if(X_.pos[2]<0)fail('mia seat 2 start missing');T.doPick(0,3);T.doPick(2,4);fin();eq(X_.ph,'move','move with surrender');const S=snapFor(0);eq(S.mia.pos[1]<0,true,'out piece hidden');eq(S.mia.out[1],1,'out mark')}
setup(3);place();{const X_=H.mia,a=X_.A,b=(a+1)%3,c=(a+2)%3;X_.pos[a]=X_.pos[b]=X_.pos[c]=I(4,4);X_.flag[a]=X_.flag[b]=X_.flag[c]=I(0,0);go2(a,0);T.doGo(b,0);T.doSurrender(b);eq(H.turn,c,'skip surrendered');eq(X_.acts,0,'actions reset');go2(c,0);eq(X_.rn,1,'round ends');eq(H.turn,a,'back to first');T.doSurrender(a);T.doSurrender(c);eq(H.phase,'over','all gone')}
/* 2명 항복: 남은 사람 승리 */
setup(2);{T.doSurrender(1);eq(H.phase,'over','over 2p');eq(H.players[0].rank,1,'left wins')}
/* 바로 시작 선 */
{setup(2);const a=H.mia.A;T.doSurrender(1);eq(T.pickFirst(true,2),(a+1)%2,'again next first')}
/* 봇끼리: 끝까지 가고 봇이 진짜 자리를 잃지 않음 */
for(const n of [2,3,4]){let rs=0;for(let g=0;g<30;g++){setup(n,true);let k=0;
  while(H.phase==='play'&&k++<40000){NOW+=250;engineTick();const X_=H.mia;if(X_.ph==='move'&&!X_.done.length)for(let i=0;i<n;i++){if(H.players[i].finished)continue;if(!X_.bel[i].includes(X_.pos[i]))fail('mia bot belief lost');if(!T.connected(X_.w))fail('mia disconnected')}}
  if(H.phase!=='over')fail('mia bots stuck '+n);rs+=H.mia.rn}
 if(typeof console!=='undefined')console.log('mia bots',n,'avg rounds',(rs/30).toFixed(1))}
console.log('mia ok');
