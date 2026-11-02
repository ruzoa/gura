/* 동물장기 테스트 (tests/engine.test.js가 이 파일을 불러서 { } 블록 안에서 돌림)
   앞에서 정해져 있는 것: DZ(=GAMES.animal), fail(), hostNew·hostStart·engineTick·snapFor 등 공통 엔진 */
const T=DZ._test;
T.setBotScale(.1);   // 봇 탐색 양을 줄여 테스트를 빠르게
const eq=(a,b,m)=>{if(a!==b)fail('animal '+m+': '+a+' != '+b)};
const {IX,mk,HIY,ZOU,KIR,LION,NIW}=T;
/* 국면 만들기: [x,y,말,색] 목록 + 둘 차례 + 포로 [[색,말,개수]…] */
const P=(list,side,hands,md)=>{const p=T.newPos(md);for(const [x,y,t,c] of list)p.b[IX(x,y)]=t|(c<<3);for(const [c,t,n] of hands||[])p.hd[c][t]=n;p.side=side||0;T.rehash(p);return p};
const tos=(p,x,y)=>T.legal(p).filter(m=>(m&15)===IX(x,y)).map(m=>{const t=(m>>4)&15;return (t%3)+','+((t/3)|0)}).sort().join(' ');
const L2=[[1,0,LION,0],[1,3,LION,1]];
const play=(p,f,t)=>{const m=mk(f,t);if(!T.legal(p).includes(m))fail('animal illegal '+f+'>'+t);T.make(p,m);return m};

/* 처음 국면: 선이 둘 수 있는 수는 4개 (병아리 잡기 1, 사자 2, 기린 1) */
{const p=T.startPos();
 eq(T.legal(p).length,4,'start moves');
 eq(tos(p,1,1),'1,2','chick forward captures chick');eq(tos(p,0,0),'','elephant blocked');eq(tos(p,1,0),'0,1 2,1','lion');eq(tos(p,2,0),'2,1','giraffe');
 p.side=1;T.rehash(p);eq(T.legal(p).length,4,'start moves second (symmetric)');eq(tos(p,1,3),'0,2 2,2','second lion');}
/* 움직임 */
eq(tos(P([...L2,[1,1,ZOU,0]]),1,1),'0,0 0,2 2,0 2,2','elephant diagonals');
eq(tos(P([...L2,[1,1,KIR,0]]),1,1),'0,1 1,2 2,1','giraffe orthogonal (own lion behind)');
eq(tos(P([[0,3,LION,0],[2,0,LION,1],[1,1,NIW,0]]),1,1),'0,1 0,2 1,0 1,2 2,1 2,2','hen six directions');
eq(tos(P([[0,3,LION,0],[2,0,LION,1],[1,2,NIW,1]],1),1,2),'0,1 0,2 1,1 1,3 2,1 2,2','second hen faces down');
eq(tos(P([[0,3,LION,0],[2,0,LION,1],[1,2,HIY,1]],1),1,2),'1,1','second chick forward is down');
/* 승격·포로 */
{const p=P([[0,0,LION,0],[2,3,LION,1],[1,2,HIY,0],[1,3,ZOU,1]]),h0=p.h1;
 play(p,IX(1,2),IX(1,3));
 eq(p.b[IX(1,3)],NIW,'chick promotes on last row');eq(p.hd[0][ZOU],1,'elephant captured to hand');
 T.unmake(p);eq(p.b[IX(1,2)],HIY,'unmake demotes');eq(p.b[IX(1,3)],ZOU|8,'unmake restores captured');eq(p.hd[0][ZOU],0,'unmake hand');eq(p.h1,h0,'unmake hash');}
{const p=P([[0,0,LION,0],[2,3,LION,1],[1,1,NIW,1],[1,0,KIR,0]]);
 play(p,IX(1,0),IX(1,1));eq(p.hd[0][HIY],1,'captured hen becomes chick in hand');eq(p.hd[0][5]||0,0,'no hen in hand');}
/* 포로 놓기: 빈 칸 아무 곳, 한 수. 끝 줄에 놓은 병아리는 닭이 아니고 못 움직임 */
{const p=P([[0,0,LION,0],[2,3,LION,1]],0,[[0,HIY,1]]);
 const drops=T.legal(p).filter(m=>(m&15)>=12);eq(drops.length,10,'drop on every empty square');
 play(p,12+HIY,IX(1,3));eq(p.b[IX(1,3)],HIY,'dropped chick on last row stays chick');eq(p.hd[0][HIY],0,'hand used');eq(p.side,1,'drop is a move');
 p.side=0;T.rehash(p);eq(tos(p,1,3),'','chick on last row cannot move');}
/* 해시: 같은 국면이면 같은 값 (다른 순서로 만들어도) */
{const a=T.startPos();play(a,IX(1,0),IX(0,1));play(a,IX(1,3),IX(2,2));play(a,IX(0,1),IX(1,0));play(a,IX(2,2),IX(1,3));
 eq(T.repKey(a),T.repKey(T.startPos()),'hash returns after round trip');}
/* 끝 판정 */
{const p=P([[1,0,LION,0],[1,1,LION,1],[0,0,KIR,0]],0);   // 사자 잡기
 play(p,IX(1,0),IX(1,1));const j=T.judge(p,T.lastCap(p));eq(j&&j.w,0,'lion capture wins');eq(j&&j.why,'lion','why lion');}
{const p=P([[1,2,LION,0],[2,1,LION,1]],0);   // 사자 도착, 노리는 말 없음
 play(p,IX(1,2),IX(1,3));const j=T.judge(p,0);eq(j&&j.w,0,'try wins');eq(j&&j.why,'try','why try');}
{const p=P([[1,2,LION,0],[2,1,LION,1],[0,3,KIR,1]],0);   // 도착했지만 기린이 노림 → 계속
 play(p,IX(1,2),IX(1,3));eq(T.judge(p,0),null,'attacked try continues');
 eq(T.legal(p).includes(mk(IX(0,3),IX(1,3))),true,'opponent may capture arrived lion');
 play(p,IX(2,1),IX(2,2));const j=T.judge(p,0);eq(j&&j.w,0,'arrived lion survives one move → wins');}
{const p=P([[1,1,LION,0],[1,3,LION,1],[0,3,ZOU,1]],0);   // 잡힐 자리로 가는 수도 둘 수 있음
 eq(T.legal(p).includes(mk(IX(1,1),IX(1,2))),true,'lion may move into danger');}
/* 봇: 사자를 잡을 수 있으면 잡고, 도착할 수 있으면 도착 */
for(const lv of [0,1,2]){
  const p=P([[1,0,LION,0],[1,1,LION,1],[2,3,KIR,1]],1);   // 후가 선의 사자를 잡을 수 있음
  eq(T.botPick(p,lv,{}),mk(IX(1,1),IX(1,0)),'bot takes lion lv'+lv);
  const q=P([[0,2,LION,0],[2,1,LION,1],[0,0,ZOU,1]],0);T.make(q,T.botPick(q,lv,{}));
  const j=T.judge(q,0);eq(j&&j.w,0,'bot plays safe try lv'+lv);
}
/* 보통·어려움 봇: 사자를 잡힐 자리에 두지 않음 */
for(const lv of [1,2])for(let k=0;k<3;k++){
  const p=P([[1,1,LION,0],[1,3,LION,1],[0,3,ZOU,1]],0),m=T.botPick(p,lv,{});T.make(p,m);
  if(T.legal(p).some(x=>(x&15)<12&&(p.b[(x>>4)&15]&7)===LION))fail('animal bot hangs lion lv'+lv);
}
/* 십이장기: 상대 끝 줄(진영 3칸)에는 포로를 못 놓음, 처음 국면은 같음 */
{const p=P([[0,0,LION,0],[2,3,LION,1]],0,[[0,HIY,1]],1);
 const drops=T.legal(p).filter(m=>(m&15)>=12).map(m=>(m>>4)&15);
 eq(drops.length,8,'12: drop squares (enemy row banned)');eq(drops.some(t=>((t/3)|0)===3),false,'12: no drop on enemy row');
 eq(drops.includes(IX(1,0)),true,'12: drop on own row ok');
 const q=P([[0,0,LION,0],[2,3,LION,1]],1,[[1,ZOU,1]],1),d2=T.legal(q).filter(m=>(m&15)>=12).map(m=>(m>>4)&15);
 eq(d2.some(t=>((t/3)|0)===0),false,'12: second cannot drop on row 0');
 const a=T.startPos(1),b=T.startPos(0);eq(T.repKey(a),T.repKey(b),'12: same start position');eq(T.moveName(a,mk(IX(1,0),IX(0,1))),'왕 B1→A2','12: names');}
/* 십이장기: 왕이 안 노려진 채 들어가도 바로 이기지 않고, 상대 한 수 뒤에 이김 */
{const p=P([[1,2,LION,0],[2,1,LION,1]],0,[],1);
 play(p,IX(1,2),IX(1,3));eq(T.judge(p,0),null,'12: unattacked arrival not yet a win');
 play(p,IX(2,1),IX(2,2));const j=T.judge(p,0);eq(j&&j.w,0,'12: king survives one move → wins');eq(j&&j.why,'try','12: why try');}
{const p=P([[1,2,LION,0],[2,1,LION,1],[0,3,KIR,1]],0,[],1);   // 노려진 채 도착 → 잡히면 짐
 play(p,IX(1,2),IX(1,3));play(p,IX(0,3),IX(1,3));const j=T.judge(p,T.lastCap(p));eq(j&&j.w,1,'12: arrived king captured loses');}
for(const lv of [0,1,2]){   // 봇은 십이장기에서도 안전한 도착을 고름
  const q=P([[0,2,LION,0],[2,1,LION,1],[0,0,ZOU,1]],0,[],1),m=T.botPick(q,lv,{});T.make(q,m);
  eq(q.lion[0]>=0&&((q.lion[0]/3)|0)===3,true,'12: bot heads to safe arrival lv'+lv);
}
/* 엔진 흐름: 수 두기·시간 초과·항복·바로 시작(선 바꿈)·반복 무승부 */
const hostSetup=()=>{hostNew(false,'t','t');H.cfg={...cfgFor('animal'),game:'animal'};
  H.members=[{name:'p0',bot:false,conn:null,host:true},{name:'p1',bot:false,conn:{},host:false,cid:'c1'}];
  hostStart();for(let k=0;k<40;k++){NOW+=250;engineTick()}};
hostSetup();
{const A=H.c.A;eq(H.turn,A,'first mover turn');eq(H.c.co[A],0,'first mover plays color 0');
 const u=s=>DZ.engine.act(H.turn,{t:'mv',u:s});
 // 선: 기린 2,0→2,1 (칸 번호 02→05), 후: 기린 0,3→0,2 (09→06), 되풀이로 같은 국면 세 번
 const seq=['0205','0906','0502','0609','0205','0906','0502','0609'];
 for(const s of seq){if(H.phase!=='play')break;u(s)}
 eq(H.phase,'over','repetition draw ends');eq(H.c.res&&H.c.res.why,'rep','repetition reason');eq(H.players[0].rank,1,'draw rank');
 const sn=snapFor(1);eq(sn.c.mv.length,8,'snap moves');eq(typeof sn.c.rem[0],'number','snap clocks');}
{const firstName=H.players[H.c.A].name;hostStart();for(let k=0;k<40;k++){NOW+=250;engineTick()}
 eq(H.players[H.c.A].name!==firstName,true,'again swaps first player');}
{const i=H.turn;NOW+=3*60000+500;engineTick();eq(H.phase,'over','timeout ends');eq(H.c.res.why,'time','timeout reason');eq(H.c.res.w,1-i,'timeout winner');}
hostSetup();
{DZ.engine.act(H.turn,{t:'mv',u:'9999'});eq(H.c.mv.length,0,'bad move ignored');
 DZ.engine.act(1-H.turn,{t:'mv',u:'0205'});eq(H.c.mv.length,0,'out of turn ignored');
 DZ.engine.act(0,{t:'surrender'});eq(H.phase,'over','surrender ends');eq(H.c.res.w,1,'surrender winner');}
hostSetup();
{const f=H.turn;const u=(s)=>DZ.engine.act(H.turn,{t:'mv',u:s});
 u('0407');   // 선 병아리가 후 병아리를 잡음 (1,1→1,2)
 eq(H.c.mv.length,1,'capture move');
 const sn=snapFor(0),r=T.replay(sn.c.mv);eq(r.p.hd[0][HIY],1,'captured chick in hand (replay)');
 u('1006');   // 후 사자 1,3→0,2
 u('1304');   // 선 포로 병아리를 1,1에 놓기
 eq(H.c.mv.length,3,'drop move accepted');eq(T.replay(H.c.mv).p.b[IX(1,1)],HIY,'dropped chick on board');eq(H.turn,1-f,'turn after drop');}

/* 봇끼리 끝까지 (기보를 처음부터 다시 두어 모든 수가 규칙에 맞는지) */
function playOutD(over,lvs){
  hostNew(false,'t','t');
  H.cfg={...cfgFor('animal'),...over,game:'animal'};
  H.members=[0,1].map(i=>({name:'b'+i,bot:true,conn:null,host:i===0,lv:lvs[i]}));
  let ticks=0;
  for(let g=0;g<2;g++){
    hostStart();
    let guard=0;
    while(H.phase!=='over'&&guard++<20000){NOW+=250;engineTick();ticks++}
    if(H.phase!=='over'){fail('animal stuck '+H.c.mv.length);return ticks}
    const ranks=H.players.map(p=>p.rank).join();
    if(ranks!=='1,2'&&ranks!=='2,1'&&ranks!=='1,1')fail('animal ranks '+ranks);
    const r=T.replay(H.c.mv,H.c.md);if(H.c.mv.length&&T.replay(H.c.mv,H.c.md).p.h1!==r.p.h1)fail('animal replay');
    if(!!H.c.md!==!!over.md)fail('animal mode not kept');
    {const p=T.startPos(H.c.md);for(const u of H.c.mv){const m=T.fromU(p,u);if(!m){fail('animal illegal move in record '+u);break}T.make(p,m)}}
    if(Object.values(r.reps).some(n=>n>3))fail('animal repetition over limit');
    globalThis.DZW=(globalThis.DZW||{});DZW[H.c.res.why]=(DZW[H.c.res.why]||0)+1;
  }
  return ticks;
}
let dzt=0;const dz0=Date.now();
for(const [lvs,pf] of [[[0,0],0],[[1,0],1],[[2,1],0],[[0,2],1],[[2,2],0],[[1,1],0]])dzt+=playOutD({tm:3,inc:2,pickfirst:pf},lvs);
for(const lvs of [[0,0],[1,2],[2,0]])dzt+=playOutD({tm:3,inc:2,md:1},lvs);   // 십이장기
console.log('animal ticks',dzt,'ms',Date.now()-dz0,JSON.stringify(globalThis.DZW));
/* 세기: 어려움이 쉬움을 거의 이김 */
{let w=0;const n=6;for(let k=0;k<n;k++){hostNew(false,'t','t');H.cfg={...cfgFor('animal'),game:'animal'};
  H.members=[{name:'h',bot:true,conn:null,host:true,lv:2},{name:'e',bot:true,conn:null,host:false,lv:0}];
  hostStart();let g=0;while(H.phase!=='over'&&g++<20000){NOW+=250;engineTick()}
  if(H.players[0].rank===1&&H.players[1].rank===2)w++}
 console.log('animal hard vs easy',w+'/'+n);if(w<n-2)fail('animal hard bot too weak '+w+'/'+n);}
