/* ===== 구라! 게임 모듈 =====
   공통 코드(index.html)가 GAMES.gura의 함수를 불러서 이 게임의 규칙·봇·카드·화면을 그림.
   카드 id: 0~(자음 수*4-1)은 자음 카드((순번-1)*4+0~3), 100~103은 별카드.
   순번 1~14 = 기본 자음 ㄱ~ㅎ, 15~19 = 쌍자음 ㄲ ㄸ ㅃ ㅆ ㅉ. 같은 자음은 같은 색 */
(function(){
const G={id:'gura',name:'구라!',short:'구라',lead:'속고 속이는 막장 카드게임',brand:'구라!',brandPx:62,dealAnim:true};   // dealAnim: 게임 시작 때 카드 섞고 나누는 연출

/* ---------- 카드 ---------- */
let MAXN=14;   // 이번 방에서 쓰는 자음 수 (방 설정에서 4~19)
const numOf=id=>isJ(id)?0:(id>>2)+1;
const labelOf=id=>isJ(id)?'★':rankLabel(numOf(id));
const GLYPH=['ㄱ','ㄴ','ㄷ','ㄹ','ㅁ','ㅂ','ㅅ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ','ㄲ','ㄸ','ㅃ','ㅆ','ㅉ'];
const DICT=['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];   // 화면에 늘어놓는 순서 (사전 순)
const DOUBLE_OF={15:1,16:3,17:6,18:7,19:9};   // 쌍자음 → 짝이 되는 기본 자음 순번
const isDbl=n=>n>=15;
const dpos=n=>DICT.indexOf(GLYPH[n-1]);
/* 자음마다 고유 색. 쌍자음은 짝이 되는 기본 자음과 같은 계열의 진한 색 (+ 카드 위 두 줄) */
const BASE_COLORS=['#c53026','#157568','#b42da2','#5c7010','#6258d5','#aa4c0e','#107093','#c52660','#1f7a2e','#9041c8','#886107','#2b65ca','#905e41','#0b8a8a'];
const darkHex=(h,k)=>'#'+[1,3,5].map(i=>Math.round(parseInt(h.slice(i,i+2),16)*k).toString(16).padStart(2,'0')).join('');
const RANK_COLORS=[...BASE_COLORS,...[15,16,17,18,19].map(n=>darkHex(BASE_COLORS[DOUBLE_OF[n]-1],.62))];
const rankLabel=n=>GLYPH[n-1]||String(n);
const numName=n=>n>=1&&n<=19?rankLabel(n):String(n);
// 손패 정렬: 사전 순, 별카드는 맨 뒤
const cmpCard=(a,b)=>(isJ(a)-isJ(b))||(isJ(a)?a-b:(dpos(numOf(a))-dpos(numOf(b)))||a-b);
// 선언 휠 순서 (위→아래 = ㄱ→ㅎ)
const wheelOrder=()=>Array.from({length:MAXN},(_,k)=>k+1).sort((a,b)=>dpos(a)-dpos(b));
const fits=(id,num)=>isJ(id)||numOf(id)===num;
const cardHTML=(id,extra)=>{
  const j=isJ(id),n=numOf(id);
  return `<button type="button" class="card ${j?'joker ':''}${!j&&isDbl(n)?'dbl ':''}${extra||''}" data-id="${id}"${j?'':` style="--rc:${RANK_COLORS[n-1]}"`} aria-label="${j?'별카드':rankLabel(n)}"><span class="cn">${labelOf(id)}</span><span class="big">${j?'★':rankLabel(n)}</span><span class="cn2" aria-hidden="true">${labelOf(id)}</span></button>`;
};
Object.assign(G,{labelOf,cmpCard,cardHTML});
/* 3D 카드 앞면 (60×88 카드를 256×372로 확대) */
G.drawFace=function(g,w,h,id){
  const j=isJ(id),n=numOf(id),RC=j?JOKER_C:RANK_COLORS[n-1],k=w/60;
  g.clearRect(0,0,w,h);
  g.save();rr(g,0,0,w,h,8*k);g.clip();
  g.fillStyle=j?'#3b2a1f':'#fffcf5';g.fillRect(0,0,w,h);
  if(!j){g.fillStyle=RC;if(isDbl(n)){g.fillRect(0,0,w,2.4*k);g.fillRect(0,4.4*k,w,2.4*k)}else g.fillRect(0,0,w,3*k)}
  g.restore();
  g.strokeStyle=j?RC:'#e3d4bb';g.lineWidth=j?2*k:1*k;rr(g,g.lineWidth/2,g.lineWidth/2,w-g.lineWidth,h-g.lineWidth,8*k);g.stroke();
  g.fillStyle=RC;g.font=`600 ${19*k}px "IBM Plex Mono", "Jua", monospace`;g.textAlign='left';g.textBaseline='top';g.fillText(labelOf(id),6*k,(j?4:6)*k);
  g.fillStyle=RC;g.textAlign='center';g.textBaseline='middle';
  g.font=j?`${40*k}px sans-serif`:`${40*k}px "Jua", "Black Han Sans", sans-serif`;g.fillText(j?'★':rankLabel(n),w/2,44*k);
  g.save();g.translate(w-6*k,h-3*k);g.rotate(Math.PI);g.font=`600 ${13*k}px "IBM Plex Mono", "Jua", monospace`;g.textAlign='left';g.textBaseline='top';g.fillText(labelOf(id),0,0);g.restore();
};

/* ---------- 규칙 설명·방 설정 ---------- */
G.rulesHTML='<ol class="rules"><li><b>목표</b> : 손에 든 카드를 먼저 털어낸 사람이 <b>승리</b>합니다</li><li><b>시작</b> : 첫 번째 플레이어가 자음 하나를 정하고 1장 이상 <b>뒷면으로</b> 냅니다</li><li><b>진행</b> : 돌아가며 해당 자음 카드를 뒷면으로 내거나 <b>패스</b>합니다. 카드는 골라서 탁자 쪽으로 끌어 놓으면 냅니다</li><li><b>구라!</b> : 정해진 자음이 아닌 다른 카드를 낸 것 같다면 누구든 <b>구라!</b>를 외칠 수 있습니다. 직전에 낸 카드(테두리가 빛나는 카드)를 누르거나 구라! 버튼을 누릅니다. 다음 사람이 카드를 내기 전까지는 패스가 나와도 외칠 수 있습니다(마지막 카드는 다음 사람이 패스하면 탈출)</li><li><b>판정</b> : <b>거짓</b>이면 카드를 낸 사람이, <b>진짜</b>면 구라!를 외친 사람이 쌓인 카드를 전부 가져갑니다</li><li><b>패스</b> : 만약 모든 플레이어가 패스를 하면 쌓인 카드는 버려집니다.</li><li><b>별카드</b> : 모든 자음으로 인정됩니다</li></ol>';
G.modeDesc=['꼴찌가 나올 때까지','1등이 나오면 끝'];
G.defaults={jokers:2,maxn:14,grace:3,turn:30};
G.roomSet=[
  {k:'jokers',label:'별카드',unit:'장',lo:0,hi:4,step:1,desc:'모든 자음으로 인정되는 카드'},
  {k:'maxn',label:'자음 수',unit:'자',lo:4,hi:19,step:1,desc:'14자 = ㄱ~ㅎ, 15자부터 ㄲ·ㄸ·ㅃ·ㅆ·ㅉ 순으로 추가. 자음마다 4장'},
  {k:'grace',label:'대기 시간',unit:'초',lo:0,hi:30,step:1,desc:'카드를 내고 다음 사람이 기다리는 시간'},
  {k:'turn',label:'제한 시간',unit:'초',lo:5,hi:120,step:5,desc:'제한 시간 지나면 패스 <br> 첫 플레이어는 다음 사람에게 순서가 넘어갑니다'}];
G.ruleSet=[];
G.cfgChips=c=>`<span class="chip">자음 <b>${+c.maxn||14}자</b></span><span class="chip">별카드 <b>${+c.jokers||0}장</b></span><span class="chip">대기 시간 <b>${+c.grace}초</b></span><span class="chip">제한 시간 <b>${+c.turn}초</b></span>`;
G.cfgSum=c=>`별카드 ${+c.jokers||0}장 · 자음 ${+c.maxn||14}자 · 대기 시간 ${+c.grace}초 · 제한 시간 ${+c.turn}초`;
G.roomSub=x=>`자음 ${x.maxn||14}자 · ★${x.jk}`;
G.pubExtra=c=>({maxn:c.maxn||14});
G.cardInfo=(c,nowN)=>{
  const total=(+c.maxn||14)*4+(+c.jokers||0),perNow=Math.floor(total/nowN),perFull=Math.floor(total/Math.max(2,+c.max));
  return `<p class="cardinfo${perFull<5?' warn':''}">카드 ${total}장 · 지금 ${nowN}명이면 1인당 약 ${perNow}장${+c.max>nowN?` · ${+c.max}명이 다 차면 약 ${perFull}장`:''}${perFull<5?'<br>1인당 5장 미만이라 판이 너무 빨리 끝날 수 있습니다. 자음 수나 별카드를 늘리는 것을 추천합니다.':''}${+c.max>=7?'<br>7~8명 탁자는 제한 시간 20초, 대기 시간 2초 정도로 짧게 하면 덜 지루합니다.':''}</p>`;
};
G.rankTitle=()=>'';
G.finLabel=()=>'탈출';
G.noEmotes=[];
G.keys={gura:'KeyF',numUp:'KeyW',numDown:'KeyS'};
G.keyActions=[
  {a:'gura',n:'구라!',d:'직전에 낸 카드를 의심합니다'},
  {a:'numUp',n:'선언 자음 이전',d:'라운드를 시작할 때 선언할 자음을 이전 자음(왼쪽)으로 바꿉니다'},
  {a:'numDown',n:'선언 자음 다음',d:'라운드를 시작할 때 선언할 자음을 다음 자음(오른쪽)으로 바꿉니다'}];

/* ---------- 방장 엔진 (규칙 처리) ---------- */
const REVEAL_PAUSE=1000;   // 구라! 외친 뒤 카드를 펼치기 전까지 잠깐 뜸 들이기
function newRound(st){
  H.roundNum=null;H.roundStarter=null;H.last=null;H.passes=0;H.field=[];H.seatNote={};H.shouts=[];
  if(!isActive(st))st=nextActive(st);
  H.graceUntil=0;startTurn(st);
}
function startTurn(i){
  if(i<0){checkEnd();return}
  H.turn=i;
  const base=Math.max(clock(),H.graceUntil);
  H.deadline=base+H.cfg.turn*1000;
  H.botActAt=H.players[i].bot?base+rand(900,2100):0;
  mark();
}
function closeChance(){
  if(H.last)H.last.open=false;
  H.shouts=[];
  if(H.pending!=null){const f=H.pending;H.pending=null;finish(f)}
}
function doPlay(i,ids,num){
  closeChance();if(H.phase!=='play')return;
  if(H.roundNum==null){H.roundNum=num;H.roundStarter=i}
  const p=H.players[i],set=new Set(ids);
  p.hand=p.hand.filter(id=>!set.has(id));
  H.field.push(...ids);bmPlay(i,ids,num);
  H.last={p:i,ids,count:ids.length,open:true};H.passes=0;
  H.seatNote={[i]:`"${numName(H.roundNum)}" ${ids.length}장`};
  addLog(`${p.name}: "${numName(H.roundNum)}" ${ids.length}장`);
  if(!p.hand.length){H.pending=i;addLog(`${p.name} 마지막 카드! 구라가 없으면 탈출.`,'sys')}
  const t=clock();H.graceUntil=t+H.cfg.grace*1000;
  planBotShouts(i,t);
  startTurn(nextActive(i));
}
function doPass(i,auto){
  // 패스해도 직전에 낸 카드에는 새 카드가 나올 때까지 구라!를 외칠 수 있음. 마지막 카드를 낸 사람(탈출 대기)만 패스가 오면 탈출이 확정됨
  if(H.pending!=null)closeChance();
  if(H.phase!=='play')return;
  H.passes++;H.seatNote[i]=auto?'시간 초과':'패스';
  addLog(`${H.players[i].name} ${auto?'시간 초과 ':''}패스`,'sys');
  // 마지막으로 낸 사람을 포함해 남은 사람 전원이 연속으로 패스해야 폐기
  const everyone=H.players.filter((p,j)=>isActive(j)).length;
  if(H.passes>=everyone){addLog(`모두 패스. 필드 ${H.field.length}장 폐기.`,'sys');newRound(H.roundStarter);return}
  startTurn(nextActive(i));
}
function canShoutH(s){return H&&H.phase==='play'&&H.last&&H.last.open&&s!==H.last.p&&s>=0&&isActive(s)}
function doShout(s){
  if(!canShoutH(s))return;
  const L=H.last;L.open=false;H.shouts=[];
  const lie=L.ids.some(id=>!fits(id,H.roundNum));
  H.phase='reveal';
  H.reveal={s,L,lie,taker:lie?L.p:s,starter:lie?s:L.p,num:H.roundNum,fc:H.field.length,until:clock()+3600+REVEAL_PAUSE};
  addLog(`${H.players[s].name}: "구라!" → ${H.players[L.p].name}`,'gura');
  mark();
}
function resolveReveal(){
  const R=H.reveal;H.reveal=null;H.phase='play';
  {const tk=R.taker,other=R.lie?R.s:R.L.p;   // 가져가는 봇은 😭/😵, 이긴 쪽 봇은 가끔 🤣
   if(H.players[tk]&&H.players[tk].bot&&Math.random()<.4)botEmote(tk,R.fc>=8?'dizzy':'cry',500+Math.random()*700);
   if(H.players[other]&&H.players[other].bot&&Math.random()<.25)botEmote(other,'lol',900+Math.random()*900);}
  bmReveal(R);const t=H.players[R.taker];t.hand.push(...H.field);t.hand.sort(cmpCard);
  H.known=H.known||{};const kn=new Set(H.known[R.taker]||[]);R.L.ids.forEach(id=>kn.add(id));H.known[R.taker]=[...kn];   // 모두가 본 카드 (봇이 기억)
  addLog(R.lie?`걸렸다! ${t.name} ${R.fc}장 가져감.`:`진짜였다. ${t.name} ${R.fc}장 가져감.`,R.lie?'lie':'truth');
  H.field=[];
  if(H.pending===R.L.p){H.pending=null;if(!R.lie){finish(R.L.p);if(H.phase==='over')return}}
  newRound(R.starter);
}
function finish(i){
  const p=H.players[i];p.finished=true;p.rank=H.rankNext++;addLog(`${p.name} 탈출! ${p.rank}위`,'fin');
  if(H.cfg.fast&&p.rank===1){
    // 빠른 모드: 1등이 나오면 끝, 나머지는 남은 카드가 적을수록 높은 순위 (같으면 공동 순위)
    const rest=H.players.filter(x=>!x.finished);
    rest.forEach(x=>{x.rank=2+rest.filter(y=>y.hand.length<x.hand.length).length;x.finished=true});
    addLog('빠른 모드: 1등이 나와서 게임이 끝났습니다.','sys');H.phase='over';H.shouts=[];mark();return;
  }
  checkEnd();
}
function doSurrender(i){
  if(H.phase!=='play'||i<0||!isActive(i)||H.pending===i)return;
  const p=H.players[i];
  if(H.last&&H.last.p===i&&H.last.open){H.last.open=false;H.shouts=[]}   // 항복한 사람의 카드에는 구라를 외칠 수 없음
  p.hand=[];p.finished=true;p.surrendered=true;p.rank=H.rankBottom--;
  addLog(`${p.name} ${p.deserter?'탈주':'항복'}! ${p.rank}위`,'lie');
  const act=H.players.filter(x=>!x.finished);
  if(act.length<=1){checkEnd();return}
  if(H.roundNum!=null&&H.last){
    const everyone=H.players.filter((x,j)=>isActive(j)).length;
    if(H.passes>=everyone){addLog(`모두 패스. 필드 ${H.field.length}장 폐기.`,'sys');newRound(H.roundStarter);return}
  }
  if(H.turn===i)startTurn(nextActive(i));else mark();
}
function checkEnd(){
  const act=H.players.filter(p=>!p.finished);
  if(act.length<=1){
    if(act.length===1){act[0].finished=true;act[0].rank=H.rankNext++}
    addLog('게임 종료','sys');H.phase='over';mark();
    H.players.forEach((p,i)=>{if(p.bot&&Math.random()<.5)botEmote(i,'gg',800+Math.random()*1600)});
  }
}
function timeout(){
  const i=H.turn,p=H.players[i];
  if(H.roundNum==null){
    // 라운드 첫 사람이 시간을 넘기면 카드를 내지 않고 다음 사람이 이 라운드를 시작
    H.seatNote[i]='시간 초과';
    addLog(`${p.name} 시간 초과. 다음 사람이 시작합니다.`,'sys');
    startTurn(nextActive(i));
  }else doPass(i,true);
}
/* ===== 어려움 봇의 기억과 판단 (공개 정보만 사용: 내 손패, 손패 장수, 선언, 구라! 때 펼쳐진 카드) =====
   시뮬레이션 연구 결과를 그대로 옮김: 진짜에 가짜를 섞지 않고, 거짓 확률 × 득실로 구라!를 외치고,
   판에서 구라!가 얼마나 나오는지 보고 거짓말 정도를 맞춤 */
const lnF=[0];for(let i=1;i<300;i++)lnF[i]=lnF[i-1]+Math.log(i);
const nCk=(n,k)=>k<0||k>n||n<0?0:Math.exp(lnF[n]-lnF[k]-lnF[n-k]);
const hyp=(N,K,n,k)=>{if(N<=0)return k===0?1:0;K=Math.max(0,Math.min(K,N));n=Math.max(0,Math.min(n,N));const d=nCk(N,n);return d?nCk(K,k)*nCk(N-K,n-k)/d:0};
const HB={w:.75,s:4,endW:3,lastW:8,tau:.5,floor:.02,mu:.1,beta:.5,keepJ:1,jFollow:.3,shedV:5,monoRate:.12};
const BM=()=>H.bm||(H.bm={loc:{},round:[],stat:{},plays1:0,calls1:0});   // loc: 펼쳐져서 누가 가졌는지 알려진 카드
function bmPlay(i,ids,num){
  const M=BM();
  if(H.field.length===ids.length)M.round=[];   // 새 라운드
  if(ids.length===1)M.plays1++;
  // 알려진 카드 중 이번 자음에 맞는 것을 먼저 냈다고 봄 (보이는 건 장수와 선언뿐)
  let c=ids.length;for(const id of Object.keys(M.loc))if(c>0&&M.loc[id]===i&&fits(+id,num)){delete M.loc[id];c--}
  const kn=Object.keys(M.loc).filter(id=>M.loc[id]===i);let over=kn.length-H.players[i].hand.length;for(const id of kn){if(over<=0)break;delete M.loc[id];over--}
  M.round.push({p:i,c:ids.length,st:H.roundStarter===i&&M.round.length===0,ids:ids.slice()});   // ids는 낸 사람 본인만 씀
}
function bmReveal(R){
  const M=BM();R.L.ids.forEach(id=>{M.loc[id]=R.taker});if(R.L.ids.length===1)M.calls1++;
  const last=M.round[M.round.length-1],s=M.stat[R.L.p]=M.stat[R.L.p]||{sc:0,sl:0,fc:0,fl:0};
  if(last&&last.st){s.sc++;if(R.lie)s.sl++}else{s.fc++;if(R.lie)s.fl++}
}
const knownOf=k=>{const M=BM();let n=0;for(const id in M.loc)if(M.loc[id]===k)n++;return n};
/* j가 보기에 i가 방금 낸 카드가 거짓일 확률 */
function hardLieProb(j,i){
  const M=BM(),me=H.players[j],num=H.roundNum,F=4+(H.cfg.jokers||0),last=M.round[M.round.length-1];
  if(!last||last.p!==i)return .3;
  const c=last.c,fit=id=>fits(+id,num);
  const myFit=me.hand.filter(fit).length;
  let myPile=0;M.round.forEach(r=>{if(r.p===j)myPile+=r.ids.filter(fit).length});
  let knownOther=0,knownI=0;for(const id in M.loc){const q=M.loc[id];if(q===j||!fit(id))continue;if(q===i)knownI++;else knownOther++}
  const otherClaims=M.round.slice(0,-1).filter(r=>r.p!==j).reduce((a,r)=>a+r.c,0);
  const A=F-myFit-myPile-knownOther-knownI;                  // 어디 있는지 모르는 맞는 카드
  const K=Math.max(0,A-HB.tau*otherClaims);                  // 앞서 낸 카드 중 절반쯤은 진짜였다고 봄
  let N=0;H.players.forEach((p,k)=>{if(k!==j)N+=Math.max(0,p.hand.length+(k===i?c:0)-knownOf(k))});
  const n=Math.max(0,H.players[i].hand.length+c-knownOf(i)),need=c-knownI;
  if(need>A)return 1;                                        // 남은 카드로는 불가능 → 확실한 거짓
  if(need<=0)return HB.floor;
  const s=M.stat[i]||{sc:0,sl:0,fc:0,fl:0};
  const mu=(HB.mu*6+s.sl+s.fl)/(6+s.sc+s.fc),beta=(HB.beta*6+s.fl)/(6+s.fc);   // 그 사람 습관 (본 만큼 배움)
  let T1=0;for(let k=need;k<=n;k++)T1+=hyp(N,K,n,k);T1*=1-mu;    // 진짜: 그만큼 가지고 있었음
  let L1=hyp(N,K,n,need-1)*mu;                                  // 하나 모자라서 섞음
  if(!last.st&&need<=2)L1+=hyp(N,K,n,0)*beta*(need===1?.8:.2); // 하나도 없어서 거짓
  if(last.st&&need===1)L1*=.1;                                   // 시작하며 낸 1장은 거의 진짜 (자기가 고른 자음)
  return Math.max(HB.floor,Math.min(1,L1/(L1+T1+1e-12)));
}
/* 외칠까: 거짓이면 상대가 판을 다 가져가고 내가 시작, 진짜면 내가 가져감. 끝나기 직전인 상대는 더 적극적으로 */
function hardShout(j,i){
  const p=hardLieProb(j,i),pile=H.field.length,op=H.players[i];
  let w=HB.w*(1+HB.endW/(1+op.hand.length));if(!op.hand.length)w+=HB.lastW;
  return p*(w*pile+HB.s)>(1-p)*(pile+HB.s);
}
function planBotShouts(i,t){
  const num=H.roundNum,claimed=H.last.count,J=H.cfg.jokers;
  H.players.forEach((b,j)=>{
    if(!b.bot||j===i||!isActive(j)||(b.away&&t<b.awayAt+AWAY_WAIT))return;
    const lv=botLv(b);
    const own=b.hand.filter(id=>numOf(id)===num).length;
    const ownJ=b.hand.filter(isJ).length;
    let pr;
    if(lv===2)pr=hardShout(j,i)?1:0;   // 어려움: 거짓 확률 × 득실 (막지르지 않음)
    else if(own+claimed>4+J-ownJ)pr=lv===0?.6:.95;
    else{
      pr=.05+.12*(claimed-1)+.13*own;
      if(own+claimed>4)pr+=.25;
      if(!H.players[i].hand.length)pr+=.35;
      pr-=Math.min(.15,H.field.length*.008);pr=Math.max(.02,Math.min(.9,pr));
      if(lv===0)pr*=.45;
    }
    if(Math.random()<pr){
      const g=Math.max(H.cfg.grace*1000,1400);
      H.shouts.push({p:j,at:t+(lv===2?rand(300,Math.min(g,1100)):lv===0?rand(700,g):rand(350,g))});
    }
  });
  H.shouts.sort((a,b)=>a.at-b.at);
}
function botTurn(i){
  const lv=botLv(H.players[i]);
  if(lv===2){botTurnHard(i);return}
  const easy=lv===0;
  const h=H.players[i].hand,jk=h.filter(isJ),plain=h.filter(id=>!isJ(id));
  if(H.roundNum==null){
    if(!plain.length){doPlay(i,jk.slice(),1+(Math.random()*(H.cfg.maxn||14)|0));return}
    const g=new Map();plain.forEach(id=>{const n=numOf(id);if(!g.has(n))g.set(n,[]);g.get(n).push(id)});
    let best=null;for(const [n,cs] of g)if(!best||cs.length>best[1].length||(cs.length===best[1].length&&Math.random()<.5))best=[n,cs];
    const ids=best[1].slice(),rest=plain.filter(id=>numOf(id)!==best[0]);
    if(rest.length&&Math.random()<(easy?.1:.3))ids.push(pick(rest));
    doPlay(i,ids,best[0]);
  }else{
    const num=H.roundNum,mine=plain.filter(id=>numOf(id)===num),rest=plain.filter(id=>numOf(id)!==num);
    if(mine.length){const ids=mine.slice();if(rest.length&&Math.random()<.25)ids.push(pick(rest));doPlay(i,ids,num)}
    else if(jk.length&&(h.length<=4||Math.random()<.5)){doPlay(i,[jk[0]],num)}
    else{
      const pb=((h.length>8?.45:.3)-Math.min(.2,H.field.length*.012))*(easy?.5:1);
      if(rest.length&&Math.random()<pb)doPlay(i,shuffle(rest.slice()).slice(0,(rest.length>1&&Math.random()<.2)?2:1),num);
      else doPass(i);
    }
  }
}
/* 어려움 봇: 진짜에 가짜를 섞지 않음. 맞는 카드가 없으면 판을 보고 거짓말할지 정함 */
function botTurnHard(i){
  const M=BM(),P=H.players[i],h=P.hand,jk=h.filter(isJ),plain=h.filter(id=>!isJ(id)),J=H.cfg.jokers||0,F=4+J;
  const by=new Map();plain.forEach(id=>{const n=numOf(id);if(!by.has(n))by.set(n,[]);by.get(n).push(id)});
  const callRate=(M.calls1+.3*10)/(M.plays1+10);   // 1장 냈을 때 구라! 당하는 비율 (판에서 본 만큼)
  const junkFirst=a=>a.slice().sort((x,y)=>by.get(numOf(x)).length-by.get(numOf(y)).length);   // 적게 가진 자음부터 버림
  if(H.roundNum==null){
    if(!plain.length){doPlay(i,jk.slice(),1+(Math.random()*(H.cfg.maxn||14)|0));return}
    let best=null;for(const [n,cs] of by)if(!best||cs.length>best[1].length||(cs.length===best[1].length&&Math.random()<.5))best=[n,cs];
    const rest=plain.filter(id=>numOf(id)!==best[0]);
    // 심리전: 어떤 자음 4장을 다 가지고 있고 판에서 구라!가 드물면, 그 자음을 선언하고 다른 카드를 냄 (진짜는 다음 차례에)
    if(best[1].length>=4&&callRate<HB.monoRate&&rest.length&&Math.random()<.5){
      const m=Math.min(best[1].length,rest.length);if(h.length-m>0){doPlay(i,junkFirst(rest).slice(0,m),best[0]);return}
    }
    const ids=best[1].slice();
    if(h.length-ids.length<=jk.length)ids.push(...jk);      // 별카드로 마무리할 수 있으면 한 번에 털기
    doPlay(i,ids,best[0]);return;
  }
  const num=H.roundNum,mine=by.get(num)||[],rest=plain.filter(id=>numOf(id)!==num);
  if(mine.length){
    const ids=mine.slice();
    if(h.length-ids.length<=jk.length)ids.push(...jk);
    doPlay(i,ids,num);return;
  }
  if(jk.length&&(h.length<=jk.length+HB.keepJ||Math.random()<HB.jFollow)){doPlay(i,[jk[0]],num);return}
  if(!rest.length){doPass(i);return}
  // 맞는 카드가 없음: 3명 이상이고 별카드가 있으면 1장 거짓말이 유리 (외치는 쪽도 틀리면 다 가져가므로)
  const act=H.players.filter((p,k)=>isActive(k)).length,pile=H.field.length;
  const claimed=M.round.reduce((a,r)=>a+r.c,0);
  if(act>=3&&J>0){doPlay(i,[junkFirst(rest)[0]],num);return}
  // 1대1이나 별카드가 없으면 잡히기 쉬우므로 득실을 따짐
  let pc=callRate;if(claimed+1>F-1)pc=Math.min(.95,pc+.4);if(h.length<=1)pc=Math.min(.95,pc+.15);
  if((1-pc)*HB.shedV-pc*(pile+1)>0){doPlay(i,[junkFirst(rest)[0]],num);return}
  doPass(i);
}
/* 테스트(tests/engine.test.js)에서 직접 부르는 내부 함수 */
G._test={newRound,doPlay,doPass,doShout,resolveReveal,botTurn,fits,numOf};
G.engine={
  /* 게임 시작: 공통 코드가 H.players를 만든 뒤 부름 */
  start(){
    const n=H.players.length;
    const N=H.cfg.maxn||13;
    const deck=shuffle([...Array(N*4).keys(),...Array(H.cfg.jokers).fill(0).map((_,k)=>JOKER_BASE+k)]),per=Math.floor(deck.length/n);
    H.players.forEach(p=>p.hand=deck.splice(0,per));
    const order=shuffle([...Array(n).keys()]);let k=0;while(deck.length)H.players[order[k++]].hand.push(deck.pop());
    H.players.forEach(p=>p.hand.sort(cmpCard));
    Object.assign(H,{phase:'play',log:[],seatNote:{},field:[],last:null,reveal:null,shouts:[],pending:null,rankNext:1,rankBottom:n,known:{},bm:null});
    const first=Math.random()*n|0;
    addLog(`${n}명 게임 시작${H.cfg.jokers?` (별카드 ${H.cfg.jokers}장)`:''}. ${H.players[first].name}부터 시작합니다.`,'sys');
    newRound(first);
  },
  act(seat,a){
    if(a.t==='gura'){doShout(seat);return}
    if(a.t==='surrender'){doSurrender(seat);return}
    if(H.phase!=='play'||seat<0||H.turn!==seat||clock()<H.graceUntil)return;
    if(a.t==='pass'){if(H.roundNum!=null)doPass(seat,false);return}
    if(a.t==='play'&&Array.isArray(a.ids)){
      const hand=new Set(H.players[seat].hand);
      const ids=[...new Set(a.ids)].filter(id=>Number.isInteger(id)&&hand.has(id));
      if(!ids.length||ids.length!==a.ids.length)return;
      let num=H.roundNum;
      if(num==null){num=a.num;if(!Number.isInteger(num)||num<1||num>(H.cfg.maxn||14))return}
      doPlay(seat,ids,num);
    }
  },
  tick(t){
    if(H.phase==='reveal'&&t>=H.reveal.until)resolveReveal();
    else if(H.phase==='play'){
      for(const pl of H.shouts)if(t>=pl.at&&canShoutH(pl.p)){doShout(pl.p);break}
      if(H.phase==='play'){
        H.shouts=H.shouts.filter(pl=>t<pl.at);
        const cur=H.players[H.turn];
        if(t>=H.deadline)timeout();
        else if(cur.bot&&H.botActAt&&t>=H.botActAt&&t>=H.graceUntil&&!(cur.away&&t<cur.awayAt+AWAY_WAIT))botTurn(H.turn);
      }
    }
  },
  snap(s,you,t){
    s.rn=H.roundNum;s.fc=H.field.length;
    s.la=H.last?{p:H.last.p,c:H.last.count,o:H.last.open?1:0}:null;
    s.gr=Math.max(0,Math.round(H.graceUntil-t));s.dl=Math.max(0,Math.round(H.deadline-t));
    if(H.reveal){const R=H.reveal;s.rv={s:R.s,p:R.L.p,ids:R.L.ids.slice(),lie:R.lie?1:0,tk:R.taker,stt:R.starter,fc:R.fc,num:R.num}}
  },
  /* 저장해 둔 방을 다시 열 때: 꺼져 있던 시간(d)만큼 밀기 */
  restore(d){
    if(H.reveal&&typeof H.reveal.until==='number')H.reveal.until+=d;
    (H.shouts||[]).forEach(x=>x.at+=d);
    if(H.reveal&&H.last&&H.reveal.L)H.reveal.L=H.last;
  },
  emoPhase:ph=>ph==='play'||ph==='reveal'||ph==='over'
};

/* ---------- 화면 (모든 참가자) ---------- */
let revealReadyAt=0,pileHoldTimer=null,lastPileN=-1,lastPileNum=null;
function canShoutV(){const i=myIdx();return V&&V.st==='play'&&V.la&&V.la.o&&i>=0&&i!==V.la.p&&activeV(i)}
function chosenNum(){
  if(!V)return null;if(V.rn!=null)return V.rn;if(pickNum!=null)return pickNum;
  const first=myHand().find(id=>sel.has(id)&&!isJ(id));return first!=null?numOf(first):null;
}
function renderPile(){
  const pc=$('#pileCount'),n=V&&V.ps&&(V.st==='play'||V.st==='reveal')?(+V.fc||0):0;
  pc.hidden=n<=0||(V&&V.st==='reveal');
  if(n!==lastPileN){$('#pileN').textContent=n;if(n>lastPileN&&lastPileN>=0){pc.classList.remove('bump');void pc.offsetWidth;pc.classList.add('bump')}lastPileN=n}
}
function renderPileNum(){
  const el=$('#pileNum'),rn=V&&V.ps&&V.st==='play'?V.rn:null;
  el.hidden=rn==null;
  if(rn!=null&&rn!==lastPileNum){$('#pileNumV').textContent=rankLabel(rn);el.style.setProperty('--rc',RANK_COLORS[rn-1]);el.classList.remove('pop');void el.offsetWidth;el.classList.add('pop')}
  lastPileNum=rn;
}
/* 선언 자음 가로 휠: 고른 자음 + 양옆 하나씩 (왼쪽 = 이전 자음) */
const WH_W=52;   // 자음 칸 너비(px). G.init의 CSS가 이 값으로 칸·보이는 창 너비를 정함
function renderWheel(){
  const order=wheelOrder(),np=$('#numpick'),cur=chosenNum()||order[order.length>>1];
  const idx=Math.max(0,order.indexOf(cur));
  if(!np.querySelector('.wh-list')){
    np.innerHTML=`<span class="wh-t">선언할 자음</span><button type="button" class="wh-arrow" data-step="1" aria-label="이전 자음" title="${esc(keyLabel(KEYS.numUp))}">◀</button><div class="wh-view"><ul class="wh-list">${order.map(k=>`<li><button type="button" class="np" data-n="${k}" style="--rc:${RANK_COLORS[k-1]}" aria-label="${rankLabel(k)}"><span class="wl">${rankLabel(k)}</span></button></li>`).join('')}</ul></div><button type="button" class="wh-arrow" data-step="-1" aria-label="다음 자음" title="${esc(keyLabel(KEYS.numDown))}">▶</button>`;
  }
  np.querySelector('.wh-list').style.transform=`translateX(${(1-idx)*WH_W}px)`;
  np.querySelectorAll('.np').forEach(b=>b.classList.toggle('on',+b.dataset.n===cur));
  np.querySelectorAll('.wh-arrow').forEach(a=>a.disabled=(+a.dataset.step>0?idx<=0:idx>=order.length-1));
}
function stepNum(d,wrap){
  if($('#numpick').hidden)return;
  // d=+1 → 위(이전 자음), d=-1 → 아래(다음 자음)
  const order=wheelOrder(),L=order.length,c=chosenNum();
  let pos=c!=null?order.indexOf(c):(d>0?L:-1);
  pos-=d;
  if(!wrap){pos=Math.max(0,Math.min(L-1,pos));if(order[pos]===c)return}
  else pos=((pos%L)+L)%L;
  pickNum=order[pos];
  sfx('tick');renderMe();
}
/* 카드를 냈을 때 테이블 가운데에 "ㄱ ×3" 이펙트 */
function playFx(v){
  const L=v.la,n=+v.rn;if(!L||!(n>=1&&n<=19))return;
  const a=(T&&T.anchor)||{x:$('#stage').clientWidth/2,y:$('#stage').clientHeight/2};
  const d=document.createElement('div');d.className='playfx';d.style.setProperty('--rc',RANK_COLORS[n-1]);
  d.style.left=a.x+'px';d.style.top=Math.max(46,a.y-100)+'px';
  d.innerHTML=`<span class="fx-card">${rankLabel(n)}</span><span class="fx-n">×${+L.c}</span>`;
  d.addEventListener('animationend',()=>d.remove());
  const layer=$('#fx');while(layer.children.length>2)layer.firstChild.remove();
  layer.appendChild(d);
  // 이펙트가 떠 있는 동안 같은 자리의 '지금' 자음 카드는 숨겼다가, 끝나면 다시 튀어나옴
  const pn=$('#pileNum');pn.classList.add('held');clearTimeout(pileHoldTimer);
  pileHoldTimer=setTimeout(()=>{pn.classList.remove('held');pn.classList.remove('pop');void pn.offsetWidth;pn.classList.add('pop')},1950);
  if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)setTimeout(()=>d.remove(),1800);
}
/* 새 상태를 받았을 때 (그리기 전 / 그린 뒤) */
G.preView=()=>{
  {const mn=Math.max(4,Math.min(19,+(V.cfg&&V.cfg.maxn)||14));if(mn!==MAXN){MAXN=mn;const w=$('#numpick');if(w)w.innerHTML=''}}
  if(V.st!=='play'||V.rn!=null)pickNum=null;
};
G.postView=()=>{
  // 구라 판정으로 내가 필드를 가져왔으면 어떤 카드였는지 잠깐 보여줌
  if(PV&&PV.st==='reveal'&&PV.rv&&PV.rv.tk===myIdx()&&V.st!=='reveal'){
    const before=new Set(PV.ps&&PV.ps[myIdx()]&&PV.ps[myIdx()].h||[]);
    const got=myHand().filter(id=>!before.has(id));
    if(got.length)showTaken(got);
  }
};
/* 진행 기록에 맞춘 효과음 (처리했으면 true) */
G.logCue=(txt,cls)=>{
  if(cls==='gura'){sfx('gura');return true}
  if(cls==='lie'||cls==='truth'){sfx('sweep');return true}
  if(cls!=='fin'&&txt.includes('폐기')){sfx('sweep');return true}
  return false;
};
G.cues=(v,pv)=>{
  if(typeof v.fc==='number'&&typeof pv.fc==='number'&&v.fc>pv.fc&&v.la){sfx('play',v.fc-pv.fc);playFx(v)}
  if(v.st==='reveal'&&v.rv&&pv.st!=='reveal'){setTimeout(()=>sfx(v.rv.lie?'lie':'truth'),550+REVEAL_PAUSE);revealReadyAt=Date.now()+REVEAL_PAUSE;renderHUD();setTimeout(()=>{if(V&&V.st==='reveal')renderHUD()},REVEAL_PAUSE+20);$('#fx').innerHTML='';showBubble(v.rv.s,'<span class="bt">구라!</span>',T&&T.ok?2400:REVEAL_PAUSE+150,'real');/* 3D에서는 펼쳐진 카드가 앞에서 말풍선을 가림, 3D가 없으면 카드 공개 때 사라짐 */clearTimeout(pileHoldTimer);$('#pileNum').classList.remove('held')}
};
G.hud=inGame=>{
  renderPile();renderPileNum();
  $('#stage').classList.toggle('revealing',!!(V&&V.st==='reveal'));
  const vd=$('#verdict');
  if(!inGame){vd.hidden=true;return}
  if(V.st==='reveal'&&V.rv&&Date.now()<revealReadyAt){vd.hidden=true;vd.dataset.k=''}
  else if(V.st==='reveal'&&V.rv){
    const R=V.rv,key=[R.s,R.p,R.lie,R.fc].join('|');
    // 상태가 새로 와도 같은 판정이면 다시 그리지 않음 (다시 그리면 튀어나오는 효과가 한 번 더 재생됨)
    if(vd.dataset.k!==key){
      vd.innerHTML=`<div class="vw"><b>${esc(V.ps[R.s].n)}</b> → <b>${esc(V.ps[R.p].n)}</b></div>
      <div class="vt ${R.lie?'lie':'truth'}">${R.lie?'걸렸다!':'진짜였다'}</div>`;
      vd.dataset.k=key;
    }
    if(vd.hidden)vd.hidden=false;
  }else{vd.hidden=true;vd.dataset.k=''}
};
/* 손패 표시: 지금 자음과 맞는 카드 표시, 라운드를 시작하는 차례면 선언 자음 휠 */
G.handMarks=(i,h,hand)=>{for(const el of hand.children){const id=+el.dataset.id;el.classList.toggle('match',V.rn!=null&&fits(id,V.rn))}};
G.me=(i,h)=>{
  const np=$('#numpick'),lead=V.st==='play'&&V.t===i&&activeV(i)&&V.rn==null;
  np.hidden=!lead;
  if(lead)renderWheel();else np.innerHTML='';
  midLayout();
};
/* 버튼 줄(손패 바로 위 가운데)과 내 정보 칸의 높이. 공통 layoutFan이 정한 손패 높이(T.fanH)와 내 정보 칸 자리(--plateB)를 보고 맞춤
   공통 코드는 건드리지 않고 구라! 화면 클래스(.gmid)에서만 쓰는 변수(--gMidB·--gPlateB)로 */
let midKey='';
function midLayout(){
  const st=$('#stage');if(!st.classList.contains('gmid'))return;
  const fh=+T.fanH||0,n=$('#hand').children.length,side=(st.style.getPropertyValue('--plateB')||'').trim()==='14px';
  const ah=$('#actions').offsetHeight||0,aS=+st.style.getPropertyValue('--actS')||1;
  const midB=n?fh+6:14,plateB=side||!n?14:Math.round(midB+ah*aS+10);
  const key=midB+':'+plateB;if(key===midKey)return;midKey=key;
  st.style.setProperty('--gMidB',midB+'px');st.style.setProperty('--gPlateB',plateB+'px');
}
G.afterFan=midLayout;   // 손패가 모서리 위치에 맞춰 다시 놓이면(창 크기·카메라 변화) 버튼 줄도 다시 맞춤
G.buttons=()=>{
  const play=$('#btnPlay'),pass=$('#btnPass');
  const ready=myReady(),num=chosenNum(),k=sel.size;
  play.disabled=!(ready&&k>0&&num!=null);
  play.classList.toggle('ready',!play.disabled);
  const main=k?`${k}장 내기`:'내기';
  const sub=k?(num!=null?`${numName(num)}${V&&V.rn==null?' 선언':''}`:'자음 선택'):keyLabel(KEYS.play);
  if($('#playMain').textContent!==main)$('#playMain').textContent=main;
  if($('#playSub').textContent!==sub)$('#playSub').textContent=sub;
  pass.disabled=!(ready&&V.rn!=null);
};
G.live=()=>{midLayout();const can=canShoutV(),gb=$('#btnGura');if(gb.disabled===can){gb.disabled=!can;gb.classList.toggle('ready',can)}
  if(!!GLOW.on.length!==!!can)glowSync()};   // 맨 위 카드 테두리는 구라!를 외칠 수 있을 때만
G.play=()=>{
  if(!myReady()||!sel.size)return;const num=chosenNum();if(num==null)return;
  const ids=myHand().filter(id=>sel.has(id));
  sendAct({t:'play',ids,num});sel.clear();pickNum=null;newCards=new Set();renderMe();
};
G.pass=()=>{if(myReady()&&V.rn!=null)sendAct({t:'pass'})};
G.keyPhase=st=>st==='play'||st==='reveal';
/* 이 게임에만 있는 키 (처리했으면 true) */
G.onKey=(act,e)=>{
  if(act==='numUp'||act==='numDown'){stepNum(act==='numUp'?1:-1,true);return true}
  if(act==='gura'){if(!e.repeat&&canShoutV())sendAct({t:'gura'});return true}
  return false;
};
/* 3D 테이블 가운데: 뒷면으로 쌓이는 카드, 구라! 때 펼침 */
G.field3D=(v,pv,me)=>{
  const prevReveal=pv&&pv.st==='reveal'&&pv.rv;
  if(v.fc===0&&T.field.length){
    for(const c of T.field){
      const u=c.userData;
      if(prevReveal){const tk=prevReveal.tk;const tp=tk===me?nearMe():seatPos(tk,3.85);u.p.set(tp.x,.3,tp.z);u.s=.5;u.rx=Math.PI/2}
      else{u.p.set(u.p.x*.3,-.6,-7.5);u.s=.6}
      u.die=true;
    }
    T.field=[];
  }
  if(v.fc>T.field.length){
    let from=null;if(pv&&v.la){from=v.la.p===me?nearMe():seatPos(v.la.p,3.9);from.y=.8}
    while(T.field.length<v.fc){
      const spot=fieldSpot(T.field.length);
      const c=makeCard(from||spot,Math.PI/2,rand(-.6,.6),1);c.userData.p.copy(spot);T.field.push(c);
    }
  }else while(T.field.length>(v.fc||0))killCard(T.field.pop());
  if(v.st==='reveal'&&v.rv&&Array.isArray(v.rv.ids)&&!(pv&&pv.st==='reveal'))setTimeout(()=>{
    // 뜸 들인 뒤 카드 공개 (그 사이 판정이 끝났으면 건너뜀)
    if(!T.ok||!V||V.st!=='reveal'||!V.rv||V.rv.s!==v.rv.s||V.rv.fc!==v.rv.fc)return;
    const ids=v.rv.ids,k=ids.length,start=T.field.length-k;
    // 카드 폭에 맞춘 간격으로 나란히 (겹치지 않게). 화면 폭을 넘으면 카드를 조금씩 줄임
    const cw=.62*(T.cardK||1);let sc=1.55,gap=cw*sc*1.08;
    for(let it=0;it<8&&k>1;it++){const q=new THREE.Vector3((k-1)/2*gap+cw*sc/2,2.3,1.2).project(T.cam);if(q.x<=.94)break;sc*=.9;gap=cw*sc*1.08}
    ids.forEach((id,j)=>{
      const c=T.field[start+j];if(!c||!Number.isInteger(id))return;
      c.children[0].material=faceMat(id);
      c.children.forEach(m=>{m.material=onTopMat(m.material);m.renderOrder=60});   // 공개 카드는 3D 말풍선보다 앞
      c.userData.p.set((j-(k-1)/2)*gap,2.3,1.2);c.userData.rx=-.72;c.userData.ry=0;c.userData.s=sc;
    });
  },REVEAL_PAUSE);
  glowSync();
};
/* 구라!를 외칠 수 있는 동안 직전에 낸 카드(맨 위)의 테두리가 빛나고, 그 카드를 누르면 구라! (패스해도 새 카드가 나올 때까지 이어짐) */
const GLOW={on:[],geo:null,mat:null,raf:0},_gRay=window.THREE?new THREE.Raycaster():null;
function glowMake(){
  if(GLOW.mat)return true;if(!window.THREE||!T.ok)return false;
  const k=T.cardK||1;
  GLOW.geo=new THREE.PlaneGeometry(.70*k,.98*k);   // 카드(.62×.9)와 먹선(.665×.945) 바로 바깥에 얇은 선 하나
  GLOW.mat=new THREE.MeshBasicMaterial({color:0xf2b632,map:canvasTex(128,180,(g,w,h)=>{g.lineWidth=4;g.strokeStyle='#fff';rr(g,2,2,w-4,h-4,16);g.stroke()}),transparent:true,opacity:.5,depthWrite:false,side:THREE.DoubleSide});   // 깊이 판정을 켜서 위에서 보이는 부분만 빛남
  return true;
}
function glowSync(){
  const n=T.ok&&Array.isArray(T.field)&&canShoutV()?Math.min(T.field.length,+V.la.c||0):0;
  const want=n?T.field.slice(T.field.length-n):[];
  for(const c of GLOW.on)if(!want.includes(c)&&c.userData.glow){c.remove(c.userData.glow);c.userData.glow=null}
  if(want.length&&glowMake())for(const c of want)if(!c.userData.glow){const m=new THREE.Mesh(GLOW.geo,GLOW.mat);m.renderOrder=40;c.add(m);c.userData.glow=m}
  GLOW.on=want;
  if(want.length&&!GLOW.raf){const loop=()=>{if(!GLOW.on.length){GLOW.raf=0;return}GLOW.mat.opacity=.5+.25*Math.sin(clock()/260);GLOW.raf=requestAnimationFrame(loop)};GLOW.raf=requestAnimationFrame(loop)}
}
function topCardAt(e){
  if(!_gRay||!T.ok||!GLOW.on.length)return false;
  const r=$('#cv').getBoundingClientRect();if(!r.width)return false;
  _gRay.setFromCamera({x:(e.clientX-r.left)/r.width*2-1,y:-(e.clientY-r.top)/r.height*2+1},T.cam);
  return _gRay.intersectObjects(GLOW.on.map(c=>c.userData.glow).filter(Boolean),false).length>0;
}
/* 이 게임으로 바뀔 때 / 다른 게임으로 바뀔 때 */
G.enter=()=>{
  $('#btnGura').hidden=false;$('#stage').classList.add('gmid');
  $('#actions').appendChild($('#numpick'));midKey='';   // 선언 자음 휠을 버튼 줄 안으로 (나갈 때 원래 자리로)
};
G.leave=()=>{
  for(const id of ['#pileNum','#pileCount','#verdict','#numpick'])$(id).hidden=true;
  $('#numpick').innerHTML='';$('#btnGura').hidden=true;$('#stage').classList.remove('revealing','gmid');$('#fx').innerHTML='';
  lastPileN=-1;lastPileNum=null;
  for(const c of GLOW.on)if(c.userData.glow){c.remove(c.userData.glow);c.userData.glow=null}
  GLOW.on=[];const cv=$('#cv');if(cv)cv.style.cursor='';
  const st=$('#stage');st.insertBefore($('#numpick'),$('#me'));st.style.removeProperty('--gMidB');st.style.removeProperty('--gPlateB');midKey='';
};
/* 처음 한 번: 휠·구라! 버튼 */
G.init=()=>{
  /* 구라! 화면(.gmid)에서만: 손패 바로 위 가운데에 윗줄 가로 자음 휠, 그 아래(휠과 손패 사이)에 [패스] [구라!].
     내기 버튼은 숨김(끌어서 냄, 키는 그대로). 자음 칸이 없는 차례에도 자리를 남겨 버튼이 움직이지 않음 */
  const css=document.createElement('style');
  css.textContent=`
.stage.gmid .actions{display:grid;grid-template-columns:1fr 1fr;grid-template-areas:"w w" "p g";gap:8px 10px;width:min(320px,calc(100% - 20px));left:50%;right:auto;bottom:var(--gMidB,14px);transform:translateX(-50%) scale(var(--actS,1));transform-origin:50% 100%;pointer-events:none}
.stage.gmid .myplate{bottom:var(--gPlateB,var(--plateB,14px))}
.stage.gmid .actions .act,.stage.gmid .actions .numwheel{pointer-events:auto}
.stage.gmid .actions .act{flex:none;min-width:0;height:60px;font-size:23px;padding:0 8px}
.stage.gmid .actions .act-gura{font-size:25px}
.stage.gmid #btnPass{grid-area:p}
.stage.gmid #btnGura{grid-area:g}
.stage.gmid #btnPlay{display:none}
.stage.gmid .numwheel{grid-area:w;justify-self:center;position:static;left:auto;top:auto;transform:none;flex-direction:row;align-items:center;gap:4px;height:46px;box-sizing:border-box;padding:3px 5px}
.stage.gmid .numwheel[hidden]{display:flex!important;visibility:hidden;pointer-events:none}
.stage.gmid .numwheel .wh-t{display:block;margin-right:2px}
.stage.gmid .numwheel .wh-arrow{flex:none;width:24px;height:36px;padding:0}
.stage.gmid .numwheel .wh-view{height:40px;width:${WH_W*3}px}
.stage.gmid .numwheel .wh-view::before{top:0;bottom:0;left:50%;right:auto;height:auto;width:${WH_W}px;margin:0 0 0 -${WH_W/2}px}
.stage.gmid .numwheel .wh-view::after{background:linear-gradient(90deg,var(--panel),rgba(255,250,240,0) 30%,rgba(255,250,240,0) 70%,var(--panel))}
.stage.gmid .numwheel .wh-list{display:flex;width:max-content}
.stage.gmid .numwheel .np{width:${WH_W}px;flex:none;padding:0;opacity:.4;transition:opacity .16s}
.stage.gmid .numwheel .np.on{opacity:1}
.stage.gmid .numwheel .np .wl{font-size:22px}
.stage.gmid .numwheel .np.on .wl{font-size:30px}
`;
  document.head.appendChild(css);
  const w=$('#numpick');let acc=0,ty=null;
  w.addEventListener('wheel',e=>{e.preventDefault();acc+=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY;if(Math.abs(acc)>=40){stepNum(acc<0?1:-1);acc=0}},{passive:false});
  w.addEventListener('touchstart',e=>{ty=e.touches[0].clientX},{passive:true});
  w.addEventListener('touchmove',e=>{if(ty==null)return;const dx=e.touches[0].clientX-ty;if(Math.abs(dx)>=26){stepNum(dx>0?1:-1);ty=e.touches[0].clientX}},{passive:true});
  w.addEventListener('touchend',()=>{ty=null});
  w.addEventListener('click',e=>{const a=e.target.closest('.wh-arrow');if(a){stepNum(+a.dataset.step)}});
  w.addEventListener('click',e=>{const b=e.target.closest('.np');if(!b)return;pickNum=+b.dataset.n;renderMe()});
  $('#btnGura').addEventListener('click',()=>{if(canShoutV())sendAct({t:'gura'})});
  // 맨 위 카드 누르기 = 구라! (꾹 누르기 없음). 고개를 돌리려고 끌었던 뒤의 click은 무시
  const cv=$('#cv');
  cv.addEventListener('click',e=>{if(clock()-(VW.movedAt||-1e9)<400||!canShoutV())return;if(topCardAt(e))sendAct({t:'gura'})});
  cv.addEventListener('pointermove',e=>{if(!GLOW.on.length&&!cv.style.cursor)return;const c=e.pointerType==='mouse'&&canShoutV()&&topCardAt(e)?'pointer':'';if(cv.style.cursor!==c)cv.style.cursor=c});
};

(window.GAMES=window.GAMES||{}).gura=G;
})();
