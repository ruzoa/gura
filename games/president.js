/* ===== 대부호 게임 모듈 =====
   공통 코드(index.html)가 GAMES.president의 함수를 불러서 이 게임의 규칙·봇·카드·화면을 그림.
   카드 id: 0~51 = 숫자 순번(0~12 = 3,4,…,K,A,2)*4 + 무늬(0~3 = ♦ ♣ ♥ ♠), 100·101 = 조커 (모든 숫자로 쓰는 와일드 카드)
   무늬는 강약과 상관없음. 색은 ♦♥ 빨강 / ♣♠ 남색 */
(function(){
const G={id:'president',name:'대부호',short:'대부호',lead:'계급이 오가는 트럼프 카드게임',brand:'대부호',brandPx:50};

/* ---------- 카드·규칙 판정 (방장 엔진과 화면이 같은 함수를 씀) ---------- */
const rkOf=id=>id>>2, suitOf=id=>id&3;
const RK_LABEL=['3','4','5','6','7','8','9','10','J','Q','K','A','2'];
const SUITS=['♦','♣','♥','♠'];
const SUIT_COL=['#c53026','#34404f','#c53026','#34404f'];
const labelOf=id=>isJ(id)?'★':RK_LABEL[rkOf(id)];
const cardStr=id=>isJ(id)?'★':SUITS[suitOf(id)]+RK_LABEL[rkOf(id)];
// 손패 정렬: 약한 카드부터, 조커는 맨 뒤
const cmpCard=(a,b)=>(isJ(a)-isJ(b))||(isJ(a)?a-b:(rkOf(a)-rkOf(b))||(suitOf(a)-suitOf(b)));

/* ===== 대부호 규칙 (방장 엔진과 화면이 같은 함수를 씀) =====
   상태 S = {tk: 지금 깔린 조합|null, rev: 혁명 중, b11: 11 백 중, lock: 묶인 무늬 배열|null}
   조합 = {ty:'set'|'run', n:장수, k:비교용 숫자 순번(조커만이면 99), hi:계단의 가장 높은 숫자, suits:조커 제외 무늬들, jk:조커 수} */
const JOKER_KEY=99;
const effRev=S=>!!S.rev!==!!S.b11;                         // 혁명과 11 백이 겹치면 서로 상쇄
const skey=(k,eff)=>k===JOKER_KEY?JOKER_KEY:(eff?-k:k);    // 클수록 강함 (조커는 항상 최강)
const runKey=(c,eff)=>eff?-c.hi:c.k;
const cmbKey=(c,eff)=>c.ty==='run'?runKey(c,eff):skey(c.k,eff);
function subMulti(a,b){const m=b.slice();for(const s of a){const i=m.indexOf(s);if(i<0)return false;m.splice(i,1)}return true}
function parseCombo(ids,rules){
  const n=ids.length;if(!n)return null;
  const jk=ids.filter(isJ).length,pl=ids.filter(id=>!isJ(id));
  if(!pl.length)return {ty:'set',n,k:JOKER_KEY,suits:[],jk};
  const rks=pl.map(rkOf);
  if(new Set(rks).size===1)return {ty:'set',n,k:rks[0],suits:pl.map(suitOf),jk};
  if(rules.run&&n>=3&&!jk&&new Set(pl.map(suitOf)).size===1){
    const s=[...rks].sort((a,b)=>a-b);
    if(s.every((v,i)=>i===0||v===s[i-1]+1))return {ty:'run',n,k:s[0],hi:s[n-1],suits:[suitOf(pl[0])],jk:0};
  }
  return null;
}
/* 낼 수 없는 이유 (빈 문자열이면 낼 수 있음) */
function playError(ids,S,rules){
  const c=parseCombo(ids,rules);if(!c)return '조합 불가';
  const tk=S.tk;if(!tk)return '';
  if(c.ty!==tk.ty||c.n!==tk.n)return `${tk.n}장 ${tk.ty==='run'?'계단':'묶음'}`;
  if(S.lock&&c.ty==='set'&&!subMulti(c.suits,S.lock))return '무늬 묶임';
  const eff=effRev(S);
  return cmbKey(c,eff)>cmbKey(tk,eff)?'':'더 강하게';
}
function subsets(arr,m){
  if(m===0)return [[]];if(arr.length<m)return [];
  const out=[];
  for(let i=0;i<=arr.length-m;i++)for(const rest of subsets(arr.slice(i+1),m-1))out.push([arr[i],...rest]);
  return out;
}
/* 손패로 낼 수 있는 모든 조합 */
function legalPlays(hand,S,rules){
  const jk=hand.filter(isJ),pl=hand.filter(id=>!isJ(id)),out=[],by={};
  pl.forEach(id=>{(by[rkOf(id)]=by[rkOf(id)]||[]).push(id)});
  const need=S.tk?S.tk.n:0,push=ids=>{if(!playError(ids,S,rules))out.push(ids)};
  if(!S.tk||S.tk.ty==='set'){
    for(const r of Object.keys(by)){
      const g=by[r];
      for(let m=1;m<=g.length;m++){
        if(need&&m>need)break;
        for(const sub of subsets(g,m))for(let j=0;j<=jk.length;j++){
          if(need&&m+j!==need)continue;
          push(sub.concat(jk.slice(0,j)));
        }
      }
    }
    for(let j=1;j<=jk.length;j++)if(!need||j===need)push(jk.slice(0,j));
  }
  if(rules.run&&(!S.tk||S.tk.ty==='run')){
    for(let s=0;s<4;s++){
      const cs=pl.filter(id=>suitOf(id)===s).sort((a,b)=>rkOf(a)-rkOf(b));
      for(let a=0;a<cs.length;a++){
        let b=a;
        while(b+1<cs.length&&rkOf(cs[b+1])===rkOf(cs[b])+1)b++;
        for(let e=a+2;e<=b;e++){const L=e-a+1;if(!need||L===need)push(cs.slice(a,e+1))}
      }
    }
  }
  return out;
}
const comboStr=ids=>ids.slice().sort(cmpCard).map(cardStr).join(' ');
/* 계급 이름 (n명 중 r위) */
function rankTitle(r,n){
  if(!r)return '';
  if(r===1)return '대부호';
  if(r>=n)return '대빈민';
  if(n>=4&&r===2)return '부호';
  if(n>=4&&r===n-1)return '빈민';
  return '평민';
}

const cardHTML=(id,extra)=>{
  const j=isJ(id),lab=j?'★':RK_LABEL[rkOf(id)],su=j?'':SUITS[suitOf(id)];
  return `<button type="button" class="card ${j?'joker ':''}${extra||''}" data-id="${id}"${j?'':` style="--rc:${SUIT_COL[suitOf(id)]}"`} aria-label="${j?'조커':su+lab}"><span class="cn">${lab}${su?`<i>${su}</i>`:''}</span><span class="big">${j?'★':su}</span><span class="cn2" aria-hidden="true">${lab}</span></button>`;
};
Object.assign(G,{labelOf,cmpCard,cardHTML,rankTitle,parseCombo,playError,legalPlays});
/* 3D 카드 앞면 (60×88 카드를 256×372로 확대) */
G.drawFace=function(g,w,h,id){
  const j=isJ(id),RC=j?JOKER_C:SUIT_COL[suitOf(id)],k=w/60;   // 60×88 카드를 256×372로 확대
  g.clearRect(0,0,w,h);
  g.save();rr(g,0,0,w,h,8*k);g.clip();
  g.fillStyle=j?'#3b2a1f':'#fffcf5';g.fillRect(0,0,w,h);
  if(!j){g.fillStyle=RC;g.fillRect(0,0,w,3*k)}
  g.restore();
  g.strokeStyle=j?RC:'#e3d4bb';g.lineWidth=j?2*k:1*k;rr(g,g.lineWidth/2,g.lineWidth/2,w-g.lineWidth,h-g.lineWidth,8*k);g.stroke();
  g.fillStyle=RC;g.textAlign='left';g.textBaseline='top';
  g.font=`600 ${19*k}px "IBM Plex Mono", "Jua", monospace`;g.fillText(labelOf(id),6*k,(j?4:6)*k);
  if(!j){g.font=`${14*k}px sans-serif`;g.fillText(SUITS[suitOf(id)],6*k,26*k)}
  g.textAlign='center';g.textBaseline='middle';g.font=`${40*k}px sans-serif`;g.fillText(j?'★':SUITS[suitOf(id)],w/2,50*k);
  g.save();g.translate(w-6*k,h-3*k);g.rotate(Math.PI);g.font=`600 ${13*k}px "IBM Plex Mono", "Jua", monospace`;g.textAlign='left';g.textBaseline='top';g.fillText(labelOf(id),0,0);g.restore();
};

/* ---------- 규칙 설명·방 설정 ---------- */
G.rulesHTML='<ol class="rules"><li><b>목표</b> : 손에 든 카드를 가장 먼저 털어낸 사람이 <b>대부호</b>, 마지막까지 남은 사람이 <b>대빈민</b>입니다</li><li><b>카드 강약</b> : 3 &lt; 4 &lt; … &lt; K &lt; A &lt; 2 &lt; <b>조커</b> (무늬는 강약과 상관없습니다)</li><li><b>시작</b> : ♦3을 가진 사람이 먼저 냅니다. 한 장도, 같은 숫자 여러 장도 낼 수 있습니다</li><li><b>진행</b> : 앞사람과 <b>같은 장수</b>로 더 강한 카드를 내거나 <b>패스</b>합니다</li><li><b>판 끝</b> : 모두가 연달아 패스하면 판이 끝나고, 마지막에 낸 사람이 새로 시작합니다</li><li><b>특수 규칙</b> : 방 설정에서 켜고 끌 수 있습니다. 8 끊기, 혁명(같은 숫자 4장), 계단(같은 무늬 연속 3장), 묶기, 11 백</li><li><b>다음 판</b> : 대빈민은 가장 강한 카드를 대부호에게 주고 약한 카드를 돌려받습니다 (4명 이상이면 2장, 부호·빈민은 1장). 방 설정에서 끌 수 있습니다</li><li><b>조커</b> : 모든 숫자로 쓸 수 있는 와일드 카드이고, 혼자 내면 가장 강합니다</li></ol>';
G.modeDesc=['대빈민이 정해질 때까지','1등이 나오면 끝'];
G.defaults={jokers:2,grace:0,turn:30,r8:1,rev:1,run:1,lock:1,b11:1,swap:1};
G.roomSet=[
  {k:'jokers',label:'조커',unit:'장',lo:0,hi:2,step:1,desc:'모든 숫자로 쓸 수 있는 와일드 카드. 혼자 내면 가장 강합니다'},
  {k:'turn',label:'제한 시간',unit:'초',lo:5,hi:120,step:5,desc:'제한 시간이 지나면 패스 <br> 먼저 내는 차례면 가장 약한 카드가 자동으로 나갑니다'}];
/* 켜고 끄는 규칙 */
G.ruleSet=[
  {k:'r8',label:'8 끊기',desc:'8을 내면 그 판이 바로 끝나고 낸 사람이 다시 시작합니다'},
  {k:'rev',label:'혁명',desc:'같은 숫자 4장 이상을 내면 카드 강약이 뒤집힙니다 (한 번 더 나오면 원래대로)'},
  {k:'run',label:'계단',desc:'같은 무늬의 연속된 숫자 3장 이상을 한 번에 냅니다'},
  {k:'lock',label:'묶기',desc:'같은 무늬 구성이 연달아 나오면 그 판은 그 무늬만 낼 수 있습니다'},
  {k:'b11',label:'11 백',desc:'J를 내면 그 판이 끝날 때까지 강약이 뒤집힙니다'},
  {k:'swap',label:'계급 카드 교환',desc:'다음 판 시작 전에 대빈민의 강한 카드와 대부호의 약한 카드를 맞바꿉니다'}];
const rulesOn=c=>G.ruleSet.filter(d=>+c[d.k]).map(d=>d.label).join(' · ')||'없음';
G.cfgChips=c=>`<span class="chip">조커 <b>${+c.jokers||0}장</b></span><span class="chip">제한 시간 <b>${+c.turn}초</b></span><span class="chip">규칙 <b>${esc(rulesOn(c))}</b></span>`;
G.cfgSum=c=>`조커 ${+c.jokers||0}장 · 제한 시간 ${+c.turn}초<br>규칙: <b>${esc(rulesOn(c))}</b>`;
G.roomSub=x=>`조커 ${x.jk}장`;
G.pubExtra=()=>({});
G.cardInfo=(c,nowN)=>{
  const total=52+(+c.jokers||0),perNow=Math.floor(total/nowN),perFull=Math.floor(total/Math.max(2,+c.max));
  return `<p class="cardinfo">카드 ${total}장 · 지금 ${nowN}명이면 1인당 약 ${perNow}장${+c.max>nowN?` · ${+c.max}명이 다 차면 약 ${perFull}장`:''}${+c.max>=7?'<br>7~8명 방은 제한 시간 20초 정도로 짧게 하면 덜 지루합니다.':''}</p>`;
};
G.finLabel=(r,n)=>rankTitle(r,n);
G.noEmotes=['gq'];
G.keys={};
G.keyActions=[];

/* ---------- 방장 엔진 (규칙 처리) ---------- */
const stateH=()=>({tk:H.tk,rev:H.rev,b11:H.b11,lock:H.lock});
function doExchange(){
  const lr=H.lastRanks,n=H.players.length;
  if(!H.cfg.swap||!lr||n<2)return null;
  const rk=H.players.map(p=>lr[p.name]);
  if(rk.some(r=>!(r>0)))return null;
  const idx=H.players.map((_,i)=>i).sort((a,b)=>rk[a]-rk[b]);
  const pairs=n>=4?[[n-1,0,2],[n-2,1,1]]:[[n-1,0,1]];
  for(const [lo,hi,k] of pairs){
    const g=H.players[idx[lo]],t=H.players[idx[hi]];
    g.hand.sort(cmpCard);t.hand.sort(cmpCard);
    const give=g.hand.splice(g.hand.length-k,k),back=t.hand.splice(0,k);
    t.hand.push(...give);g.hand.push(...back);t.got=give.slice();g.got=back.slice();
    addLog(`교환: ${g.name} → ${t.name} 강한 카드 ${k}장, ${t.name} → ${g.name} 약한 카드 ${k}장`,'sys');
  }
  return idx[n-1];
}
function newTrick(st){
  H.tk=null;H.tkP=-1;H.lock=null;H.b11=false;H.passes=0;H.seatNote={};H.graceUntil=0;
  if(st>=0&&!isActive(st))st=nextActive(st);
  startTurn(st);
}
function startTurn(i){
  if(i<0){checkEnd();return}
  H.turn=i;H.graceUntil=0;
  const now=clock();
  H.deadline=now+H.cfg.turn*1000;
  H.botActAt=H.players[i].bot?now+rand(800,1800):0;
  mark();
}
function trickDone(){
  const act=H.players.filter((p,j)=>isActive(j)).length;
  const need=act-(H.tkP>=0&&isActive(H.tkP)?1:0);   // 마지막으로 낸 사람을 뺀 나머지가 연달아 패스
  return H.passes>=need;
}
function endTrick(){
  const st=isActive(H.tkP)?H.tkP:nextActive(H.tkP);
  addLog('모두 패스. 판이 끝났습니다.','sys');
  newTrick(st);
}
function doPlay(i,ids){
  if(H.phase!=='play')return;
  const p=H.players[i],c=parseCombo(ids,H.cfg);if(!c)return;
  const set=new Set(ids);p.hand=p.hand.filter(id=>!set.has(id));
  const prev=H.tk;
  // 묶기: 같은 무늬 구성이 연달아 나오면 그 무늬로 묶임
  if(H.cfg.lock&&!H.lock&&prev&&c.ty==='set'&&prev.ty==='set'&&!c.jk&&!prev.jk&&c.suits.slice().sort().join()===prev.suits.slice().sort().join()){
    H.lock=c.suits.slice();addLog(`묶기! ${c.suits.map(s=>SUITS[s]).join('')} 무늬만 낼 수 있습니다.`,'sp');
  }
  H.tk={...c,ids:ids.slice()};H.tkP=i;H.passes=0;H.seatNote={};
  H.lp={p:i,ids:ids.slice(),sq:(H.lp?H.lp.sq:0)+1};
  addLog(`${p.name}: ${comboStr(ids)}`);
  let cut=false;
  if(c.ty==='set'&&c.k!==JOKER_KEY){
    if(H.cfg.rev&&c.n>=4){H.rev=!H.rev;addLog(H.rev?'혁명! 카드 강약이 뒤집힙니다.':'혁명! 카드 강약이 원래대로 돌아옵니다.','sp')}
    if(H.cfg.b11&&c.k===8){H.b11=!H.b11;addLog(H.b11?'11 백! 이 판 동안 강약이 뒤집힙니다.':'11 백! 강약이 원래대로 돌아옵니다.','sp')}
    if(H.cfg.r8&&c.k===5){cut=true;addLog('8 끊기! 판이 바로 끝납니다.','sp')}
  }
  if(!p.hand.length){finish(i);if(H.phase==='over')return}
  if(cut){newTrick(isActive(i)?i:nextActive(i));return}
  startTurn(nextActive(i));
}
function doPass(i,auto){
  if(H.phase!=='play'||!H.tk)return;
  H.passes++;H.seatNote[i]=auto?'시간 초과':'패스';
  addLog(`${H.players[i].name} ${auto?'시간 초과 ':''}패스`,'sys');
  if(trickDone()){endTrick();return}
  startTurn(nextActive(i));
}
function finish(i){
  const p=H.players[i];p.finished=true;p.rank=H.rankNext++;addLog(`${p.name} 탈출! ${p.rank}위`,'fin');
  if(H.cfg.fast&&p.rank===1){
    // 빠른 모드: 1등이 나오면 끝, 나머지는 남은 카드가 적을수록 높은 순위 (같으면 공동 순위)
    const rest=H.players.filter(x=>!x.finished);
    rest.forEach(x=>{x.rank=2+rest.filter(y=>y.hand.length<x.hand.length).length;x.finished=true});
    addLog('빠른 모드: 1등이 나와서 게임이 끝났습니다.','sys');endGame();return;
  }
  checkEnd();
}
function doSurrender(i){
  if(H.phase!=='play'||i<0||!isActive(i))return;
  const p=H.players[i];
  if(H.seatNote[i]){H.passes=Math.max(0,H.passes-1);delete H.seatNote[i]}   // 이미 패스했던 사람이 항복하면 그 패스는 빼야 남은 사람이 모두 대답하기 전에 판이 끝나지 않음
  p.hand=[];p.finished=true;p.surrendered=true;p.rank=H.rankBottom--;
  addLog(`${p.name} 항복! ${p.rank}위`,'lie');
  const act=H.players.filter(x=>!x.finished);
  if(act.length<=1){checkEnd();return}
  if(H.tk&&trickDone()){endTrick();return}
  if(H.turn===i)startTurn(nextActive(i));else mark();
}
function endGame(){
  H.phase='over';
  H.lastRanks={};H.players.forEach(p=>{H.lastRanks[p.name]=p.rank});
  mark();
  H.players.forEach((p,i)=>{if(p.bot&&Math.random()<.5)botEmote(i,'gg',800+Math.random()*1600)});
}
function checkEnd(){
  const act=H.players.filter(p=>!p.finished);
  if(act.length<=1){
    if(act.length===1){act[0].finished=true;act[0].rank=H.rankNext++}
    addLog('게임 종료','sys');endGame();
  }
}
function timeout(){
  const i=H.turn,p=H.players[i];
  if(!H.tk){
    // 먼저 내는 차례는 패스할 수 없으니 가장 약한 카드 한 장이 자동으로 나감
    const S=stateH(),eff=effRev(S);
    const one=p.hand.map(id=>[id]).sort((a,b)=>cmbKey(parseCombo(a,H.cfg),eff)-cmbKey(parseCombo(b,H.cfg),eff));
    addLog(`${p.name} 시간 초과. 가장 약한 카드를 냅니다.`,'sys');
    doPlay(i,one[0]);
  }else doPass(i,true);
}
function botTurn(i){
  const P=H.players[i],h=P.hand,lv=botLv(P),S=stateH(),eff=effRev(S),rules=H.cfg;
  const mv=legalPlays(h,S,rules);
  if(!mv.length){doPass(i);return}
  const fin=mv.find(m=>m.length===h.length);   // 한 번에 다 털 수 있으면 무조건
  if(fin){doPlay(i,fin);return}
  const lead=!H.tk;
  const byR={};h.forEach(id=>{if(!isJ(id)){const r=rkOf(id);byR[r]=(byR[r]||0)+1}});
  const mean=e=>{const a=h.filter(id=>!isJ(id)).map(id=>skey(rkOf(id),e));return a.length?a.reduce((x,y)=>x+y,0)/a.length:0};
  const opp=H.players.filter((p,k)=>k!==i&&isActive(k));
  const minOpp=Math.min(99,...opp.map(p=>p.hand.length));
  const scored=mv.map(ids=>{
    const c=parseCombo(ids,rules),v=cmbKey(c,eff),top=c.ty==='run'?(eff?c.k:c.hi):c.k;
    let s=c.k===JOKER_KEY?20:v;
    s+=c.jk*(h.length<=4?1:9);                                  // 조커는 아껴 둠
    if(lead)s-=(ids.length-1)*.9;                               // 먼저 낼 땐 여러 장을 한꺼번에
    if(lv>=1&&c.ty==='set'&&c.k!==JOKER_KEY){                   // 묶음을 쪼개지 않음
      const left=(byR[c.k]||0)-(ids.length-c.jk);if(left>0)s+=lv===2?2.2:1;
    }
    if(lv===2&&rules.r8&&c.ty==='set'&&c.k===5&&mean(eff)>6)s-=3;   // 강한 카드가 많으면 8 끊기로 선을 잡음
    if(c.ty==='set'&&c.n>=4&&rules.rev){                         // 혁명: 약한 카드가 많을 때만
      const gain=mean(!eff)-mean(eff);
      s+=lv===2?(gain>1.5?-6:8):lv===1?3:0;
    }
    return {ids,c,s,top};
  });
  scored.sort((a,b)=>a.s-b.s);
  let pk=scored[0];
  if(lv===0)pk=scored[Math.min(scored.length-1,(Math.random()*3)|0)];
  if(!lead){
    const strong=pk.c.k===JOKER_KEY||pk.c.jk>0||(eff?pk.top<=1:pk.top>=11);   // A·2·조커(혁명 중엔 3·4)
    let pp;
    if(lv===0)pp=.25;
    else if(lv===1)pp=strong&&h.length>4?.35:.05;
    else pp=minOpp<=2?0:strong&&h.length>5&&minOpp>3?.55:h.length>7&&minOpp>3?.15:.03;
    if(Math.random()<pp){doPass(i);return}
  }
  doPlay(i,pk.ids);
}
/* 테스트(tests/engine.test.js)에서 직접 부르는 내부 함수 */
G._test={newTrick,doPlay,doPass,doSurrender,botTurn,stateH,cardStr,doExchange};
G.engine={
  /* 게임 시작: 공통 코드가 H.players를 만든 뒤 부름 */
  start(){
    const n=H.players.length;
    const deck=shuffle([...Array(52).keys(),...Array(H.cfg.jokers).fill(0).map((_,k)=>JOKER_BASE+k)]),per=Math.floor(deck.length/n);
    H.players.forEach(p=>p.hand=deck.splice(0,per));
    const order=shuffle([...Array(n).keys()]);let k=0;while(deck.length)H.players[order[k++]].hand.push(deck.pop());
    Object.assign(H,{phase:'play',log:[],seatNote:{},lp:null,tk:null,tkP:-1,lock:null,rev:false,b11:false,passes:0,rankNext:1,rankBottom:n,graceUntil:0,roundNo:(H.roundNo||0)+1});
    addLog(`${n}명 ${H.roundNo}번째 판 시작${H.cfg.jokers?` (조커 ${H.cfg.jokers}장)`:''}.`,'sys');
    let first=H.players.findIndex(p=>p.hand.includes(0));   // ♦3을 가진 사람부터
    const ex=doExchange();if(ex!=null)first=ex;             // 교환이 있었다면 대빈민부터
    H.players.forEach(p=>p.hand.sort(cmpCard));
    if(first<0)first=0;
    addLog(`${H.players[first].name}부터 시작합니다.`,'sys');
    newTrick(first);
  },
  act(seat,a){
    if(a.t==='surrender'){doSurrender(seat);return}
    if(H.phase!=='play'||seat<0||H.turn!==seat)return;
    if(a.t==='pass'){if(H.tk)doPass(seat,false);return}
    if(a.t==='play'&&Array.isArray(a.ids)){
      const hand=new Set(H.players[seat].hand);
      const ids=[...new Set(a.ids)].filter(id=>Number.isInteger(id)&&hand.has(id));
      if(!ids.length||ids.length!==a.ids.length)return;
      if(playError(ids,stateH(),H.cfg))return;
      doPlay(seat,ids);
    }
  },
  tick(t){
    if(H.phase==='play'){
      const cur=H.players[H.turn];
      if(t>=H.deadline)timeout();
      else if(cur&&cur.bot&&H.botActAt&&t>=H.botActAt&&!(cur.away&&t<cur.awayAt+AWAY_WAIT))botTurn(H.turn);
    }
  },
  snap(s,you,t){
    s.gr=0;s.dl=Math.max(0,Math.round(H.deadline-t));
    s.tk=H.tk?{p:H.tkP,ids:H.tk.ids.slice(),ty:H.tk.ty,n:H.tk.n,k:H.tk.k,hi:H.tk.hi,suits:H.tk.suits.slice(),jk:H.tk.jk}:null;
    s.lp=H.lp?{p:H.lp.p,ids:H.lp.ids.slice(),sq:H.lp.sq}:null;
    s.rev=H.rev?1:0;s.b11=H.b11?1:0;s.lk=H.lock?H.lock.slice():null;s.rd=H.roundNo||1;
    const me=H.players[you];if(me&&me.got&&s.ps[you])s.ps[you].g=me.got.slice();
  },
  restore(){},
  emoPhase:ph=>ph==='play'||ph==='over',
  /* 다른 게임에서 바뀌어 올 때: 지난 판 계급은 새로 */
  reset(){H.lastRanks=null;H.roundNo=0}
};

/* ---------- 화면 (모든 참가자) ---------- */
const stateV=()=>({tk:V.tk,rev:!!V.rev,b11:!!V.b11,lock:V.lk});
function selIds(){return myHand().filter(id=>sel.has(id))}
function selError(){const ids=selIds();return ids.length?playError(ids,stateV(),V.cfg):'카드를 고르세요'}
function showSpecial(txt){
  const a=(T&&T.anchor)||{x:$('#stage').clientWidth/2,y:$('#stage').clientHeight/2};
  const d=document.createElement('div');d.className='playfx';d.style.setProperty('--rc','#cc3a2e');
  d.style.left=a.x+'px';d.style.top=Math.max(46,a.y-110)+'px';
  d.innerHTML=`<span class="fx-n">${esc(txt)}</span>`;
  d.addEventListener('animationend',()=>d.remove());
  const layer=$('#fx');while(layer.children.length>2)layer.firstChild.remove();
  layer.appendChild(d);
  setTimeout(()=>d.remove(),2300);
}
function fieldCombo(v){
  if(!v||!v.ps||v.st!=='play')return null;
  const lp=v.lp;
  if(lp&&lp.sq!==T.lpSq){T.lpSq=lp.sq;T.lpAt=clock()}
  if(v.tk)return v.tk;
  if(!lp)return null;
  const left=1500-(clock()-T.lpAt);if(left<=0)return null;
  clearTimeout(T.lpTimer);T.lpTimer=setTimeout(()=>{if(V)sync3D(V,PV)},left+30);
  return lp;
}
function field2D(fk){
  const el=$('#field2d');if(!el)return;
  const key=!T.ok&&fk?fk.p+':'+fk.ids.join(','):'';
  if(el.dataset.k===key)return;el.dataset.k=key;
  if(!key){el.hidden=true;el.innerHTML='';return}
  const nm=V&&V.ps&&V.ps[fk.p]?V.ps[fk.p].n:'';
  el.innerHTML=`<div class="f2-cards">${fk.ids.slice().sort(cmpCard).map(id=>cardHTML(id,'')).join('')}</div><div class="f2-n">${esc(nm)}</div>`;el.hidden=false;
}
G.preView=()=>{};
G.postView=()=>{
  // 새 판에 계급 카드 교환으로 받은 카드는 노란 테두리로 표시 (마우스를 올리거나 눌러 보면 사라짐)
  const mi=myIdx();
  if(V.st==='play'&&mi>=0&&Array.isArray(V.ps[mi].g)&&V.ps[mi].g.length&&(!PV||PV.st!=='play'||PV.rd!==V.rd))showTaken(V.ps[mi].g);
};
G.logCue=(txt,cls)=>{
  if(cls==='sp'){sfx('special');showSpecial((txt.match(/^[^!]*!/)||[txt])[0]);return true}
  if(cls!=='fin'&&txt.includes('판이 끝났')){sfx('sweep');return true}
  return false;
};
G.cues=(v,pv)=>{
  const key=o=>o&&o.tk?o.tk.p+':'+o.tk.ids.join(','):'';
  if(v.tk&&key(v)!==key(pv))sfx('play',v.tk.n);
};
/* 혁명·11 백·묶기·계단 배지 */
G.hud=()=>{
  const bd=$('#ruleBadges');let h='';
  if(V&&V.ps&&V.st==='play'){
    if(V.rev)h+='<span class="rb rv">혁명 중</span>';
    if(V.b11)h+='<span class="rb">11 백</span>';
    if(V.lk&&V.lk.length)h+=`<span class="rb">묶기 ${V.lk.map(s=>SUITS[s]).join('')}</span>`;
    if(V.tk&&V.tk.ty==='run')h+=`<span class="rb">계단 ${V.tk.n}장</span>`;
  }
  if(bd.dataset.k!==h){bd.innerHTML=h;bd.dataset.k=h}
};
/* 손패 표시: 낼 수 있는 카드에 빨간 점, 골라 둔 카드와 함께 낼 수 있는 카드만 올리고 나머지는 흐리게 */
G.handMarks=(i,h,hand)=>{
  // 내 차례에 앞사람 카드를 이어 낼 땐, 낼 수 있는 조합에 들어가는 카드에 빨간 점
  // 카드를 골라 두면: 그 카드와 함께 낼 수 있는 카드만 빨간 점과 함께 올라오고, 나머지는 흐리게 (class 이름 dim은 화면 어둡게 하는 #dim과 겹치므로 faded) (내 차례가 아니면 앞 조합과 상관없이 짝만 보여 줌)
  const mineSel=selIds();let combo=null;
  if(mineSel.length&&V.st==='play'&&activeV(i)){
    const S=V.t===i?stateV():{tk:null,rev:!!V.rev,b11:!!V.b11,lock:null};
    const sj=mineSel.filter(isJ).length,sp=mineSel.filter(id=>!isJ(id));
    const ok=legalPlays(h,S,V.cfg).filter(pl=>sp.every(id=>pl.includes(id))&&pl.filter(isJ).length>=sj);
    combo=new Set(ok.flat().filter(id=>!isJ(id)));if(ok.some(pl=>pl.filter(isJ).length>sj))h.filter(isJ).forEach(id=>combo.add(id));   // 고른 것보다 조커가 더 들어가는 조합이 있을 때만 다른 조커도 표시;   // 짝이 하나도 없으면 빈 집합: 나머지가 전부 흐려짐
  }
  let playable=null;
  if(!combo&&V.st==='play'&&V.t===i&&V.tk&&activeV(i)){
    const pl=legalPlays(h,stateV(),V.cfg);playable=new Set(pl.flat());
    if(pl.some(m=>m.some(isJ)))h.filter(isJ).forEach(id=>playable.add(id));   // 조합 목록에는 첫 조커만 들어가므로, 조커는 모두 같이 표시
  }
  for(const el of hand.children){const id=+el.dataset.id,s=sel.has(id);el.classList.toggle('match',combo?(!s&&combo.has(id)):!!(playable&&playable.has(id)));el.classList.toggle('combo',!!(combo&&!s&&combo.has(id)));el.classList.toggle('faded',!!(combo&&!s&&!combo.has(id)))}
};
G.me=()=>{};
G.buttons=()=>{
  const play=$('#btnPlay'),pass=$('#btnPass');
  const ready=myReady(),k=sel.size;
  const err=ready&&k?selError():'';
  play.disabled=!(ready&&k>0&&!err);
  play.classList.toggle('ready',!play.disabled);
  const main=k?`${k}장 내기`:'내기';
  const sub=k&&ready?(err||'낼 수 있음'):keyLabel(KEYS.play);
  if($('#playMain').textContent!==main)$('#playMain').textContent=main;
  if($('#playSub').textContent!==sub)$('#playSub').textContent=sub;
  pass.disabled=!(ready&&V.tk);
};
G.live=()=>{};
G.play=()=>{
  if(!myReady()||!sel.size||selError())return;
  const ids=selIds();
  sendAct({t:'play',ids});sel.clear();newCards=new Set();renderMe();
};
G.pass=()=>{if(myReady()&&V.tk)sendAct({t:'pass'})};
G.keyPhase=st=>st==='play';
G.onKey=()=>false;
/* 3D가 없을 때도 가운데 조합을 2D로 보여 주므로 3D 준비 전에 부름 */
G.pre3D=v=>{const fk=fieldCombo(v);field2D(fk);return fk};
/* 3D 테이블 가운데: 지금 깔린 조합을 앞면으로 펼침 */
G.field3D=(v,pv,me,fk)=>{
  // 테이블 가운데에는 지금 깔린 조합만 앞면으로 펼침. 새로 나오면 이전 카드는 치워짐
  const key=fk?fk.p+':'+fk.ids.join(','):'';
  if(key!==T.fieldKey){
    for(const c of T.field){const u=c.userData;u.p.set(u.p.x*.3,-.6,-7.5);u.s=.6;u.die=true}
    T.field=[];
    if(fk){
      const ids=fk.ids,n=ids.length,from=fk.p===me?nearMe():seatPos(fk.p,3.9);from.y=.8;
      const gap=Math.min(.62,3.8/Math.max(1,n-1));
      ids.forEach((id,j)=>{
        const c=makeCard(from.clone(),-Math.PI/2,0,1);
        c.userData.p.set((j-(n-1)/2)*gap,.5+j*.01,.4);c.userData.rx=-1.3;c.userData.ry=0;c.userData.s=1.25;
        c.children[0].material=faceMat(id);
        T.field.push(c);
      });
    }
    T.fieldKey=key;
  }
};
G.clear3D=()=>{T.fieldKey=''};
G.enter=()=>{};
G.leave=()=>{const bd=$('#ruleBadges');bd.innerHTML='';bd.dataset.k='';const f=$('#field2d');f.hidden=true;f.innerHTML='';f.dataset.k='';T.fieldKey=''};
G.init=()=>{};

(window.GAMES=window.GAMES||{}).president=G;
})();
