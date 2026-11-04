/* 픽셀 테스트 (tests/engine.test.js가 이 파일을 불러서 { } 블록 안에서 돌림) */
const T=PX._test;
const eq=(a,b,m)=>{if(a!==b)fail('pixel '+m+': '+a+' != '+b)};
const I=T.IX,E=()=>new Array(64).fill(0);
/* 판: 귀퉁이 넷을 뺀 60칸 */
{let n=0;for(let y=0;y<8;y++)for(let x=0;x<8;x++)if(T.isCell(x,y))n++;eq(n,60,'60 cells')}
eq(T.isCell(0,0)||T.isCell(7,0)||T.isCell(0,7)||T.isCell(7,7),false,'corners cut');
eq(T.cellName(I(1,7)),'B1','cell name');eq(T.cellName(I(7,1)),'H7','cell name 2');
/* 둘 수 있는 칸: 같은 가로·세로줄의 빈 칸, 말은 건너뜀, 귀퉁이 제외 */
{const b=E(),s=I(3,3);b[s]=1;eq(T.legal(b,s).length,14,'14 moves');
 b[I(5,3)]=2;const L=T.legal(b,s);eq(L.length,13,'filled cell skipped');eq(L.includes(I(6,3)),true,'can jump over');eq(L.includes(I(5,3)),false,'cannot stop on piece');eq(L.includes(s),false,'not same cell');
 eq(T.legal(E(),I(0,1)).includes(I(0,0)),false,'corner not legal');eq(T.legal(E(),I(1,0)).includes(I(0,0)),false,'corner not legal row');}
/* 승리 칸: 가로·세로·대각선, 더 길어도 승리 */
{const b=E();b[I(1,1)]=1;b[I(2,1)]=1;b[I(4,1)]=1;eq(T.winCells(b,I(3,1),1,4).length,4,'fill gap wins');eq(T.winCells(b,I(3,1),1,5).length,0,'need 5');
 const d=E();d[I(1,1)]=1;d[I(2,2)]=1;d[I(3,3)]=1;eq(T.winCells(d,I(4,4),1,4).length,4,'diagonal');
 const a=E();a[I(4,1)]=1;a[I(3,2)]=1;a[I(2,3)]=1;eq(T.winCells(a,I(1,4),1,4).length,4,'anti diagonal');
 const l=E();for(const x of [1,2,4,5])l[I(x,1)]=1;eq(T.winCells(l,I(3,1),1,4).length,5,'overline wins');
 const o=E();o[I(1,1)]=2;o[I(2,1)]=1;o[I(3,1)]=1;eq(T.winCells(o,I(4,1),1,4).length,0,'blocked');}
/* 줄 세기: 묶음 하나가 한 줄 */
{const b=E();for(const x of [1,2,3])b[I(x,1)]=1;for(const y of [3,4,5])b[I(1,y)]=1;b[I(6,6)]=1;eq(T.linesOf(b,1,3).length,2,'two lines');
 const c=E();c[I(1,1)]=1;c[I(3,1)]=1;c[I(4,1)]=1;eq(T.linesOf(c,1,3).length,0,'gap is not a line');eq(T.linesOf(c,1,2).length,1,'pair');
 const k=E();k[I(2,2)]=1;k[I(3,2)]=1;k[I(2,3)]=1;eq(T.linesOf(k,1,2).length,3,'L has 2 pairs + 1 diagonal');}
/* 인원별 목표·처음 자리 */
eq(T.needOf(2),4,'2p');eq(T.needOf(3),4,'3p');eq(T.needOf(4),3,'4p');
for(let r=0;r<4;r++){const s=T.startCells(2,r);eq(Math.abs(T.X(s[0])-T.X(s[1])),1,'2p diagonal x');eq(Math.abs(T.Y(s[0])-T.Y(s[1])),1,'2p diagonal y');eq(new Set(T.startCells(4,r)).size,4,'4p distinct');eq(new Set(T.startCells(3,r)).size,3,'3p distinct')}
/* 봇: 이기는 칸을 두고, 둘 수 있는 칸만 */
{const b=E();b[I(1,3)]=1;b[I(2,3)]=1;b[I(3,3)]=1;b[I(0,3)]=2;for(let k=0;k<30;k++)eq(T.botPick(b,I(3,3),0,1,4),I(4,3),'bot wins');
 const f=E();f[I(3,3)]=1;for(let k=0;k<100;k++)if(!T.legal(f,I(3,3)).includes(T.botPick(f,I(3,3),0,1,4)))fail('pixel bot illegal');}

const setup=(n,bots,turn)=>{
  hostNew(false,'t','t');H.cfg={...cfgFor('pixel'),game:'pixel',turn:turn||30,max:4};
  H.members=[];for(let i=0;i<n;i++)H.members.push(bots?{name:'b'+i,bot:true,conn:null,host:i===0,lv:0}:{name:'p'+i,bot:false,conn:i?{}:null,host:i===0,cid:i?'c'+i:''});
  hostStart();for(let k=0;k<80;k++){NOW+=250;engineTick()}
};
const put=(s,sq)=>PX.engine.act(s,{t:'put',sq});
/* 시작: 슬라이더가 첫 플레이어 말에서 만남, 시작 말은 가운데 */
for(const n of [2,3,4]){setup(n);const X_=H.pxl;eq(X_.cnt,n,'count');eq(X_.b[X_.sq],X_.A+1,'slider on first stone');eq(H.turn,X_.A,'first turn');eq(X_.b.filter(Boolean).length,n,'start stones');
 for(const c of X_.st)if(T.X(c)<3||T.X(c)>4||T.Y(c)<3||T.Y(c)>4)fail('pixel start not middle');eq(X_.need,n===4?3:4,'need')}
/* 차례·잘못된 수 */
setup(2);{const X_=H.pxl,a=X_.A,o=1-a,ok=T.legal(X_.b,X_.sq)[0],c0=X_.mv.length;
 put(o,ok);eq(X_.mv.length,c0,'not your turn');put(a,X_.sq);eq(X_.mv.length,c0,'own cell');put(a,0);eq(X_.mv.length,c0,'corner');put(a,I((T.X(X_.sq)+2)%8,(T.Y(X_.sq)+2)%8));eq(X_.mv.length,c0,'off line');
 put(a,ok);eq(X_.mv.length,1,'legal');eq(X_.sq,ok,'slider moved');eq(H.turn,o,'turn passed');eq(snapFor(0).pxl.b.length,64,'snap board')}
/* 제한 시간: 무작위로 두고 패배가 아님 */
{const X_=H.pxl,n=X_.mv.length,i=H.turn;NOW+=31000;engineTick();eq(X_.mv.length,n+1,'timeout places');eq(H.phase,'play','timeout not loss');eq(H.turn===i,false,'timeout passes turn')}
/* 줄 완성 승리 */
setup(2);{const X_=H.pxl,a=X_.A,v=a+1;X_.b=E();X_.st=[];X_.b[I(1,2)]=v;X_.b[I(2,2)]=v;X_.b[I(3,2)]=v;X_.b[I(1,5)]=2-a;X_.sq=I(1,5);H.turn=a;
 eq(T.doMove(a,I(4,5)),true,'move');NOW+=1;H.turn=1-a;X_.sq=I(4,5);T.doMove(1-a,I(4,3));H.turn=a;X_.sq=I(4,2)+8;T.doMove(a,I(4,2));eq(H.phase,'over','line win');eq(X_.res.why,'line','why line');eq(H.players[a].rank,1,'winner rank');eq(H.players[1-a].rank,2,'loser rank');eq(X_.win.length,4,'win cells')}
/* 둘 칸이 없음: 줄 수 판정. 슬라이더 줄이 꽉 참 */
setup(2);{const X_=H.pxl,a=X_.A,o=1-a,va=a+1,vo=o+1,b=E();
 /* 1번 가로줄·1번 세로줄을 번갈아 채우고 (1,1)만 비움, 4목이 없게 */
 const pat=[va,va,vo,vo,va,va,vo,vo];for(let k=0;k<8;k++){if(T.isCell(k,1))b[I(k,1)]=pat[k];if(T.isCell(1,k))b[I(1,k)]=pat[(k+3)%8]}
 b[I(1,1)]=0;b[I(5,5)]=va;b[I(5,6)]=va;b[I(5,7)]=va;   /* a는 3줄을 하나 더 만듦 */
 X_.b=b;X_.sq=I(4,1);X_.mv=[1,2];H.turn=a;b[I(4,1)]=va;
 /* 마지막 빈 칸 (1,1)에 두면 그 칸의 가로·세로줄이 꽉 참 */
 const before=T.winCells(b,I(1,1),va,4).length;eq(before,0,'setup has no 4');T.doMove(a,I(1,1));
 eq(H.phase,'over','stuck ends');eq(X_.res.why,'count','why count');eq(X_.res.stuck,1,'stuck flag');eq(X_.ln.length,2,'line counts');eq(H.players[a].rank,1,'more lines wins')}
/* 판이 다 참: 같으면 무승부, 모두 1위 */
setup(2);{const X_=H.pxl;X_.b=E();T.finishCount(false);eq(X_.res.w.length,0,'tie has no winner');eq(H.players[0].rank,1,'tie rank');eq(H.players[1].rank,1,'tie rank 2')}
/* 3명: 항복해도 말은 남고 차례를 건너뜀, 마지막 한 명이 승리 */
setup(3);{const X_=H.pxl,a=H.turn,b=(a+1)%3,c=(a+2)%3,n=X_.b.filter(Boolean).length;
 PX.engine.act(b,{t:'surrender'});eq(H.players[b].rank,3,'surrender last');eq(X_.b.filter(Boolean).length,n,'stones stay');put(a,T.legal(X_.b,X_.sq)[0]);eq(H.turn,c,'skip surrendered');
 PX.engine.act(c,{t:'surrender'});eq(H.phase,'over','last one wins');eq(H.players[a].rank,1,'last rank');eq(X_.res.why,'last','why last');eq(H.players[c].rank,2,'second surrender')}
/* 바로 시작: 다음 사람이 선 */
setup(3,true);{for(let k=0;k<6000&&H.phase==='play';k++){NOW+=250;engineTick()}eq(H.phase,'over','bots finish');const a=H.pxl.A;hostStart();eq(H.pxl.A,(a+1)%3,'next player first after again')}
/* 봇끼리 끝까지 */
for(const n of [2,3,4])for(let g=0;g<8;g++){setup(n,true);let k=0;for(;k<20000&&H.phase==='play';k++){NOW+=250;engineTick()}
 eq(H.phase,'over','bots end '+n);const X_=H.pxl;if(!X_.res)fail('pixel no result');
 const seen=new Set(X_.st);for(const m of X_.mv){if(seen.has(m))fail('pixel overwrite');seen.add(m)}
 if(H.players.slice(0,n).some(p=>p.rank==null))fail('pixel rank missing');
 if(X_.res.why==='line'&&!X_.win.length)fail('pixel no win cells')}
console.log('pixel ok');
