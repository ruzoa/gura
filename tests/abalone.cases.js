/* 아발론 테스트 (tests/engine.test.js가 이 파일을 불러서 { } 블록 안에서 돌림) */
const T=AB._test;
const eq=(a,b,m)=>{if(a!==b)fail('abalone '+m+': '+a+' != '+b)};
const E=()=>new Array(61).fill(0),RW=T.ROW;
const key=m=>m.c.slice().sort((a,b)=>a-b).join('.')+':'+m.d;
/* 판: 61칸, 줄 길이, 이웃 대칭 */
eq(RW.map(r=>r.length).join(),'5,6,7,8,9,8,7,6,5','row sizes');eq(T.CELLS,61,'61 cells');
for(let i=0;i<61;i++)for(let d=0;d<6;d++){const j=T.NB[i][d];if(j>=0&&T.NB[j][(d+3)%6]!==i)fail('abalone nb symmetry')}
eq(T.cellName(RW[8][0]),'A1','A1');eq(T.cellName(RW[4][8]),'E9','E9');eq(T.cellName(RW[0][0]),'I5','I5');eq(T.cellName(RW[0][4]),'I9','I9');
/* 시작 배치: 양쪽 14개, 180도 대칭 */
for(const l of [0,1,2]){const b=T.startBoard(l);eq(b.filter(v=>v===1).length,14,'14 black '+l);eq(b.filter(v=>v===2).length,14,'14 white '+l);
 for(let i=0;i<61;i++)if(b[i]&&b[60-i]!==(l?b[i]:3-b[i]))fail('abalone layout symmetry '+l+' '+i);
 if(!T.legal(b,1).length)fail('abalone no opening move '+l)}
/* 표준 시작 수: 알려진 값 44수 */
eq(T.legal(T.startBoard(0),1).length,44,'standard opening moves');
/* 줄 판정 */
{const c=RW[4][3];eq(T.lineOf([c,T.NB[c][0]]).a,0,'line E');eq(T.lineOf([c,T.NB[c][1],T.NB[T.NB[c][1]][1]]).o.length,3,'line 3');eq(T.lineOf([c,T.NB[T.NB[c][0]][0]]),null,'gap');eq(T.lineOf([c,T.NB[c][0],T.NB[c][1]]),null,'bent');eq(T.lineOf([c,c]),null,'dup');}
/* 밀기 */
{const mk=(ms,os)=>{const b=E();for(const c of ms)b[c]=1;for(const c of os)b[c]=2;return b},r=RW[4];
 eq(T.tryMove(mk([r[1],r[2]],[r[3]]),[r[1],r[2]],0,1).p.length,1,'2:1');
 eq(T.tryMove(mk([r[1],r[2],r[3]],[r[4],r[5]]),[r[1],r[2],r[3]],0,1).p.length,2,'3:2');
 eq(T.tryMove(mk([r[1],r[2]],[r[3],r[4]]),[r[1],r[2]],0,1),null,'2:2 no');
 eq(T.tryMove(mk([r[1],r[2],r[3]],[r[4],r[5],r[6]]),[r[1],r[2],r[3]],0,1),null,'3:3 no');
 eq(T.tryMove(mk([r[1]],[r[2]]),[r[1]],0,1),null,'single cannot push');
 eq(T.tryMove(mk([r[1],r[2],r[4]],[r[3]]),[r[1],r[2]],0,1),null,'blocked by own behind');
 eq(T.tryMove(mk([r[1],r[2],r[3]],[]),[r[1],r[2]],0,1),null,'own ahead');
 eq(T.tryMove(mk([r[7],r[8]],[]),[r[7],r[8]],0,1),null,'cannot walk off');
 const o=T.tryMove(mk([r[6],r[7]],[r[8]]),[r[6],r[7]],0,1);eq(o.off,r[8],'push off');
 const nb=T.applyMove(mk([r[6],r[7]],[r[8]]),o);eq(nb.filter(v=>v===2).length,0,'pushed gone');eq(nb[r[7]],1,'moved');eq(nb[r[8]],1,'moved head');eq(nb[r[6]],0,'tail empty');
 const p=T.applyMove(mk([r[1],r[2]],[r[3]]),T.tryMove(mk([r[1],r[2]],[r[3]]),[r[1],r[2]],0,1));eq(p[r[4]],2,'opp shifted');eq(p[r[3]],1,'head');
 /* 옆으로: 가는 칸이 모두 비어야 함, 상대를 밀 수 없음 */
 const a=r[3],b2=r[4],ta=T.NB[a][1];eq(T.tryMove(mk([a,b2],[]),[a,b2],1,1).inl,false,'broadside');eq(T.tryMove(mk([a,b2],[ta]),[a,b2],1,1),null,'broadside blocked');
 eq(T.tryMove(mk([a,b2],[]),[a,b2],7,1),null,'bad dir');eq(T.tryMove(mk([a],[]),[b2],0,1),null,'not mine');}
/* 화살표: 옆으로 미는 방향은 칸이 겹치지 않음 */
{const r=RW[4],b=E();b[r[3]]=1;b[r[4]]=1;b[r[5]]=1;const m=T.arrowsOf(b,[r[3],r[4],r[5]],1);eq(m.size,6,'six arrows');eq(new Set(m.values()).size,6,'distinct dirs');
 const s=E();s[r[4]]=1;eq(T.arrowsOf(s,[r[4]],1).size,6,'single 6');}
/* 봇: 떨어뜨릴 수 있으면 떨어뜨리고, 둘 수 있는 수만 */
{const r=RW[4],b=E();b[r[6]]=1;b[r[7]]=1;b[r[8]]=2;let hit=0;for(let k=0;k<30;k++)if(T.botPick(b,1).off>=0)hit++;eq(hit,30,'bot pushes off');
 const f=T.startBoard(1),ok=new Set(T.legal(f,2).map(key));for(let k=0;k<30;k++)if(!ok.has(key(T.botPick(f,2))))fail('abalone bot illegal')}

const setup=(tm,lay)=>{
  hostNew(false,'t','t');H.cfg={...cfgFor('abalone'),game:'abalone',tm:tm||10,inc:5,lay:lay||0,max:2};
  H.members=[0,1].map(i=>({name:'p'+i,bot:false,conn:i?{}:null,host:i===0,cid:i?'c'+i:''}));
  hostStart();for(let k=0;k<80;k++){NOW+=250;engineTick()}
};
const mv=(s,c,d)=>AB.engine.act(s,{t:'mv',c,d});
/* 시작: 흑 = 선, 차례·잘못된 수 */
setup();{const C=H.c,a=C.A,o=1-a;eq(C.co[a],0,'first is black');eq(H.turn,a,'turn');
 const m=T.legal(C.b,1)[0],m2=T.legal(C.b,2)[0];
 mv(o,m2.c,m2.d);eq(C.mv.length,0,'not your turn');mv(a,m2.c,m2.d);eq(C.mv.length,0,'not your marbles');mv(a,[999],0);eq(C.mv.length,0,'bad cell');mv(a,'x',0);eq(C.mv.length,0,'bad cells');
 mv(a,m.c,m.d);eq(C.mv.length,1,'legal move');eq(H.turn,o,'turn passes');eq(snapFor(0).c.b.length,61,'snap board')}
/* 6개 떨어뜨리면 승리 */
setup();{const C=H.c,a=C.A,o=1-a,r=RW[4],b=E();b[r[6]]=1;b[r[7]]=1;b[r[8]]=2;b[RW[0][0]]=2;C.b=b;C.out=[0,5];
 mv(a,[r[6],r[7]],0);eq(H.phase,'over','six ends');eq(C.res.why,'six','why six');eq(C.res.w,a,'winner');eq(H.players[a].rank,1,'rank 1');eq(H.players[o].rank,2,'rank 2');eq(C.out[1],6,'six out')}
/* 시간 초과: 패배 */
setup(1);{const C=H.c,a=C.A;NOW+=61000;engineTick();eq(H.phase,'over','time ends');eq(C.res.why,'time','why time');eq(C.res.w,1-a,'time winner')}
/* 추가 시간 */
setup();{const C=H.c,a=C.A,r0=C.rem[a]-(NOW-C.since);NOW+=2000;const m=T.legal(C.b,1)[0];mv(a,m.c,m.d);eq(C.rem[a],r0-2000+5000,'increment')}
/* 같은 국면 3번: 무승부 */
setup();{const C=H.c,a=C.A,o=1-a;
 const cyc=T.legal(C.b,1).find(m=>m.c.length===1&&T.tryMove(T.applyMove(C.b,m),[T.NB[m.c[0]][m.d]],(m.d+3)%6,1)),cy2=T.legal(C.b,2).find(m=>m.c.length===1);
 const c1=cyc.c[0],d1=cyc.d,t1=T.NB[c1][d1],c2=cy2.c[0],d2=cy2.d,t2=T.NB[c2][d2];
 for(let k=0;k<2&&H.phase==='play';k++){mv(a,[c1],d1);mv(o,[c2],d2);mv(a,[t1],(d1+3)%6);mv(o,[t2],(d2+3)%6)}
 eq(H.phase,'over','repetition ends');eq(C.res.why,'rep','why rep');eq(C.res.w,-1,'rep draw');eq(H.players[0].rank,1,'draw rank');eq(H.players[1].rank,1,'draw rank 2')}
/* 60수 동안 안 떨어짐: 많이 밀어낸 쪽 승리, 같으면 무승부 */
setup();{const C=H.c,a=C.A;C.np=T.NP_MAX-1;C.out=[0,2];const m=T.legal(C.b,1)[0];mv(a,m.c,m.d);eq(H.phase,'over','long ends');eq(C.res.why,'long','why long');eq(C.res.w,a,'long winner')}
setup();{const C=H.c,a=C.A;C.np=T.NP_MAX-1;const m=T.legal(C.b,1)[0];mv(a,m.c,m.d);eq(C.res.w,-1,'long draw')}
/* 떨어뜨리면 무진행 수가 처음으로 */
setup();{const C=H.c,a=C.A,r=RW[4],b=E();b[r[6]]=1;b[r[7]]=1;b[r[8]]=2;b[RW[0][0]]=2;b[RW[0][2]]=2;C.b=b;C.np=30;mv(a,[r[6],r[7]],0);eq(C.np,0,'np reset');eq(H.phase,'play','still play')}
/* 항복 */
setup();{const a=H.c.A;AB.engine.act(a,{t:'surrender'});eq(H.phase,'over','surrender');eq(H.c.res.w,1-a,'surrender winner')}
/* 바로 시작: 선·후 바꿈 */
setup();{const a=H.c.A;AB.engine.act(a,{t:'surrender'});hostStart();for(let k=0;k<80;k++){NOW+=250;engineTick()}eq(H.c.A,1-a,'again swaps first')}
/* 시작 배치 설정 */
for(const l of [0,1,2]){setup(10,l);eq(H.c.b.join(),T.startBoard(l).join(),'layout cfg '+l)}
/* 봇끼리 끝까지 (배치마다) */
for(const l of [0,1,2]){for(let r=0;r<2;r++){
  hostNew(false,'t','t');H.cfg={...cfgFor('abalone'),game:'abalone',lay:l,max:2};
  H.members=[0,1].map(i=>({name:'b'+i,bot:true,conn:null,host:i===0,lv:0}));hostStart();
  let g=0;while(H.phase!=='over'&&g++<30000){NOW+=250;engineTick();const C=H.c;
    if(C&&C.b.filter(v=>v===1).length+C.out[0]!==14)fail('abalone black count');if(C&&C.b.filter(v=>v===2).length+C.out[1]!==14)fail('abalone white count')}
  eq(H.phase,'over','bots finish '+l)}}
