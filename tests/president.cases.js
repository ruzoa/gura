/* 대부호 규칙 단위 테스트 (tests/engine.test.js가 불러서 실행) */
// --- 규칙 단위 테스트 ---
const R={run:1,rev:1,r8:1,lock:1,b11:1};
const id=(rk,s)=>rk*4+s;   // rk 0=3 ... 12=2
const S0={tk:null,rev:false,b11:false,lock:null};
const tkOf=ids=>({...parseCombo(ids,R),ids});
// 단일
let S={...S0,tk:tkOf([id(4,0)])};   // 7
if(playError([id(5,1)],S,R)!=='')fail('8 > 7');
if(playError([id(3,1)],S,R)==='')fail('6 < 7');
if(playError([id(4,1)],S,R)==='')fail('7 = 7 not allowed');
if(playError([id(5,0),id(5,1)],S,R)==='')fail('pair vs single');
if(playError([JOKER_BASE],S,R)!=='')fail('joker beats 7');
// 혁명
S={...S0,tk:tkOf([id(4,0)]),rev:true};
if(playError([id(3,1)],S,R)!=='')fail('rev: 6 beats 7');
if(playError([id(5,1)],S,R)==='')fail('rev: 8 not beat 7');
if(playError([JOKER_BASE],S,R)!=='')fail('rev: joker beats');
// 11백과 혁명 상쇄
S={...S0,tk:tkOf([id(4,0)]),rev:true,b11:true};
if(playError([id(5,1)],S,R)!=='')fail('rev+11back cancel');
// 계단
if(!parseCombo([id(2,1),id(3,1),id(4,1)],R))fail('run parse');
if(parseCombo([id(2,1),id(3,2),id(4,1)],R))fail('run mixed suit');
if(parseCombo([id(2,1),id(3,1),id(5,1)],R))fail('run gap');
S={...S0,tk:tkOf([id(2,1),id(3,1),id(4,1)])};
if(playError([id(3,2),id(4,2),id(5,2)],S,R)!=='')fail('run higher');
if(playError([id(0,2),id(1,2),id(2,2)],S,R)==='')fail('run lower');
if(playError([id(3,2),id(4,2),id(5,2),id(6,2)],S,R)==='')fail('run len differ');
// 조커 와일드
const c=parseCombo([id(6,0),JOKER_BASE],R);if(!c||c.ty!=='set'||c.k!==6||c.n!==2)fail('joker pair');
// 묶기
S={...S0,tk:tkOf([id(4,0),id(4,1)]),lock:[0,1]};
if(playError([id(6,0),id(6,1)],S,R)!=='')fail('lock ok');
if(playError([id(6,2),id(6,3)],S,R)==='')fail('lock violated');
if(playError([id(6,0),JOKER_BASE],S,R)!=='')fail('lock joker ok');
// legalPlays 일관성
for(let it=0;it<300;it++){
  const deck=shuffle([...Array(52).keys(),100,101]);const hand=deck.slice(0,12);
  const lead=Math.random()<.4;
  let S={tk:null,rev:Math.random()<.3,b11:Math.random()<.2,lock:null};
  if(!lead){const o=deck.slice(12,12+1+(Math.random()*3|0));const c=parseCombo(o,R);if(c)S.tk={...c,ids:o}}
  const mv=legalPlays(hand,S,R);
  const hs=new Set(hand);
  for(const m of mv){if(m.some(x=>!hs.has(x))||new Set(m).size!==m.length)fail('legal bad ids');if(playError(m,S,R))fail('legal not legal')}
  // 완전성 검사: 단일/쌍 전수 비교
  if(S.tk&&S.tk.ty==='set'&&S.tk.n<=2){
    const all=[];const n=S.tk.n;
    if(n===1)hand.forEach(a=>all.push([a]));
    else for(let i=0;i<hand.length;i++)for(let j=i+1;j<hand.length;j++)all.push([hand[i],hand[j]]);
    const seen=new Set();const ok=all.filter(m=>{if(playError(m,S,R))return false;const k=m.map(x=>x>=100?100:x).sort((a,b)=>a-b).join();if(seen.has(k))return false;seen.add(k);return true}).length;
    const got=mv.length;
    // joker 쌍/조합 중복 없이 같은 수여야 함 (조커 2장은 서로 구분되므로 hand 조합과 일치)
    if(ok!==got)fail(`legal count ${got} vs brute ${ok} n=${n}`);
  }
}
// 패스했던 사람이 항복해도, 남은 사람이 모두 대답하기 전엔 판이 끝나지 않음
cfgP({fast:0,jokers:0,swap:0,r8:0,rev:0,run:0,lock:0,b11:0});H.members=[0,1,2,3].map(i=>({name:'p'+i,bot:false,conn:null,host:i===0}));
hostStart();
H.players[0].hand=[id(4,0),id(0,1)];H.players[1].hand=[id(0,2),id(1,0)];H.players[2].hand=[id(1,1),id(2,2)];H.players[3].hand=[id(9,0),id(2,3)];
newTrick(0);doPlay(0,[id(4,0)]);doPass(1);doPass(2);
if(H.turn!==3)fail('setup turn');
doSurrender(1);
if(!H.tk||H.turn!==3)fail('surrender after pass ended trick early');
doPass(3);
if(H.tk||H.turn!==0)fail('trick should end after last pass, leader p0');
// 8 끊기: 테이블 표시용 마지막 카드(lp)는 남아 있어야 함
cfgP({fast:0,jokers:0,swap:0,r8:1,rev:0,run:0,lock:0,b11:0});H.members=[0,1,2].map(i=>({name:'p'+i,bot:false,conn:null,host:i===0}));
hostStart();H.players[0].hand=[id(5,0),id(0,1)];newTrick(0);doPlay(0,[id(5,0)]);
if(H.tk||H.turn!==0||!H.lp||H.lp.ids[0]!==id(5,0))fail('8 cut lp');
// 교환: 받은 카드 기록
cfgP({fast:0,jokers:0,swap:1,r8:1,rev:0,run:0,lock:0,b11:0});H.members=[0,1,2,3].map(i=>({name:'p'+i,bot:true,conn:null,host:i===0}));
H.lastRanks={p0:1,p1:2,p2:3,p3:4};hostStart();
{const g0=H.players[0].got,g3=H.players[3].got;
 if(!g0||g0.length!==2||!g3||g3.length!==2)fail('swap got');
 else if(!g0.every(x=>H.players[0].hand.includes(x))||!g3.every(x=>H.players[3].hand.includes(x)))fail('swap got not in hand');
 if(H.turn!==3)fail('daihinmin leads after swap');}
