/* ===== 흑과백 게임 모듈 =====
   공통 코드(index.html)가 GAMES.blackwhite의 함수를 불러서 이 게임의 규칙·봇·화면을 그림.
   두 사람이 0~8 숫자 타일을 9개씩 가짐. 짝수(0·2·4·6·8)는 흑, 홀수(1·3·5·7)는 백.
   한 판: 선이 타일 하나를 엎어 내면 상대는 그 색만 보고 자기 타일을 엎어 냄 → 큰 수가 1점. 단 0은 8을 잡음(0이 8에게만 이김).
   같은 수면 무승부(점수 없음, 선은 그대로). 다음 판 선은 이긴 사람. 첫 판 선은 공통 첫 차례 주사위.
   5점을 먼저 내면 승리. 9판이 끝나면 점수가 높은 쪽이 승리, 같으면 무승부.
   숨김: 낸 숫자는 끝날 때까지 상대·관전자에게 보이지 않음(색만). 상대 손의 타일은 판마다 섞은 순서로 색만 보냄(자리로 숫자를 알 수 없게).
   손패(hand)는 카드가 아니라 표시용 [0] (공통 코드가 hand가 비면 끝난 사람으로 봄) */
(function(){
const G={id:'blackwhite',name:'흑과백',short:'흑백',lead:'색만 보고 숫자를 겨루기',brand:'흑과백',brandPx:56,maxHi:2,minN:2,noFast:true,firstPick:true,oneBotLv:true};

/* ---------- 규칙 (방장 엔진과 화면이 같은 함수를 씀) ---------- */
const N=9,WIN=5;
const colOf=v=>v%2;   // 0 흑(짝수), 1 백(홀수)
const CN=['흑','백'];
/* a가 b를 이기면 1, 지면 -1, 같으면 0. 0은 8에게만 이기고, 8은 0에게만 짐 */
const cmp=(a,b)=>a===b?0:(a===0&&b===8)?1:(a===8&&b===0)?-1:a>b?1:-1;
const SHOW_MS=1700;   // 두 타일이 다 놓인 뒤 결과 불이 켜지고 다음 판까지 (화면 연출: 0.42초 미끄러짐 + 0.5초 뒤 불)
const SEAT_C=['#c53026','#2b65ca'];   // 자리 색 (첫 차례 주사위 면과 같음: DicePick.SEAT_COL 앞 둘)

/* ---------- 규칙 설명·방 설정 ---------- */
G.rulesHTML='<ol class="rules"><li><b>타일</b> : 두 사람이 0~8 숫자 타일을 9개씩 가집니다. 짝수(0·2·4·6·8)는 <b>흑</b>, 홀수(1·3·5·7)는 <b>백</b>입니다</li><li><b>한 판</b> : 선이 타일 하나를 엎어서 내면, 상대는 그 타일의 <b>색만 보고</b> 자기 타일을 엎어서 냅니다. 숫자가 큰 쪽이 1점을 얻습니다</li><li><b>0과 8</b> : 0은 8을 이깁니다. 0은 1~7에게는 지고, 8은 0에게만 집니다</li><li><b>같은 숫자</b> : 무승부로 점수가 없고, 다음 판 선은 그대로입니다</li><li><b>선</b> : 첫 판은 주사위로 정하고, 그다음 판부터는 앞 판에서 이긴 사람이 먼저 냅니다</li><li><b>승리</b> : 5점을 먼저 얻으면 승리합니다. 9판이 끝나면 점수가 높은 쪽이 승리하고, 같으면 무승부입니다</li><li><b>숨김</b> : 낸 숫자는 게임이 끝날 때까지 공개되지 않고, 누가 이겼는지만 알려 줍니다. 가운데 기록 줄에서 이긴 쪽 타일에 금색 테두리가 둘리고, 무승부면 양쪽 모두 은색 테두리가 둘립니다. 상대 손의 타일은 판마다 섞여 놓입니다</li><li><b>제한 시간</b> : 시간이 지나면 남은 타일 중 하나가 무작위로 나갑니다</li><li><b>조작</b> : 내 타일을 누르면 들리고, <b>[내기]</b>를 누르면 냅니다. 같은 타일을 다시 누르면 내려놓습니다(설정의 <b>두 번 눌러 놓기</b>를 켜면 바로 냅니다)</li><li><b>공개</b> : 게임이 끝나면 가운데 기록 줄의 타일이 모두 뒤집혀 숫자가 보입니다</li></ol>';
G.modeDesc=['5점을 먼저 얻으면 승리','5점을 먼저 얻으면 승리'];
G.defaults={max:2,turn:30};
G.roomSet=[{k:'turn',label:'제한 시간',unit:'초',lo:10,hi:120,step:10,desc:'시간이 지나면 남은 타일 중 하나가 무작위로 나갑니다'}];
G.ruleSet=[];
G.cfgChips=c=>`<span class="chip">제한 시간 <b>${+c.turn||30}초</b></span>`;
G.cfgSum=c=>`제한 시간 ${+c.turn||30}초 · 5점 먼저 (9판)`;
G.roomSub=()=>'2명 타일 게임';
G.pubExtra=()=>({});
G.cardInfo=(c,nowN)=>`<p class="cardinfo">${nowN>2?'흑과백은 두 명이 하는 게임입니다.':'두 명이 하는 게임입니다.'}</p>`;
G.rankTitle=()=>'';
G.finLabel=()=>'';
G.noEmotes=[];
G.keys={};
G.keyActions=[];
G.cardHTML=()=>'';G.drawFace=()=>{};G.cmpCard=()=>0;G.labelOf=()=>'';

/* ---------- 봇 (쉬움) ----------
   선이면 아무거나. 따라 낼 때는 반쯤은 아무거나, 나머지는 '그 색의 수 가운데 절반 넘게 이기는 가장 작은 타일'(없으면 가장 작은 타일을 버림) */
function botPick(hand,leadCol,rnd){
  const r=rnd||Math.random;
  if(!hand.length)return -1;
  if(leadCol<0||r()<.5)return hand[(r()*hand.length)|0];
  const pool=[0,1,2,3,4,5,6,7,8].filter(v=>colOf(v)===leadCol);
  const winP=v=>pool.filter(o=>cmp(v,o)>0).length/pool.length;
  const s=hand.slice().sort((a,b)=>a-b);
  return s.find(v=>winP(v)>.5)??s[0];
}

/* ---------- 방장 엔진 (규칙 처리) ---------- */
const other=i=>1-i;
function setDeadline(){
  const t=clock(),p=H.players[H.turn];
  H.deadline=t+(+H.cfg.turn||30)*1000;
  H.botActAt=p&&p.bot?t+rand(900,1900):0;
}
function startRound(){
  const O=H.bw;
  O.ph='lead';O.pl=[-1,-1];H.turn=O.A;
  setDeadline();mark();
}
function finishGame(w,why){
  const O=H.bw;
  O.res={w,why:why||''};O.ph='done';
  if(w>=0){
    const l=other(w),pw=H.players[w],pl=H.players[l];
    pw.finished=true;pw.rank=1;pw.hand=[];
    pl.finished=true;pl.rank=2;pl.hand=[];
    if(why==='surrender'||why==='desert')pl.surrendered=true;
    if(O.resLog){addLog(...O.resLog);O.resLog=null}
    addLog(why?`${pl.name} ${why==='desert'?'탈주':'항복'}! ${pw.name} 승리`:`${pw.name} 승리! (${O.sc[w]}:${O.sc[l]})`,why?'lie':'fin');
  }else{
    for(const i of [0,1]){const p=H.players[i];p.finished=true;p.rank=1;p.hand=[]}
    addLog(`무승부입니다. (${O.sc[0]}:${O.sc[1]})`,'sys');
  }
  H.phase='over';H.botActAt=0;H.deadline=0;mark();
  H.players.forEach((p,i)=>{if(p.bot&&i<2&&Math.random()<.5)botEmote(i,'gg',800+Math.random()*1600)});
}
/* 타일 내기 (seat가 v를 냄) */
function playTile(seat,v,auto){
  const O=H.bw;
  if(H.phase!=='play'||(O.ph!=='lead'&&O.ph!=='follow')||H.turn!==seat)return false;
  const h=O.hand[seat],k=h.indexOf(v);if(k<0)return false;
  h.splice(k,1);O.vo[seat]=shuffle(h.slice());   // 남은 타일을 다시 섞어 둠 (상대 화면의 자리로 무엇을 냈는지 알 수 없게)
  O.pl[seat]=v;
  const nm=H.players[seat].name,rd=O.rec.length+1;
  if(auto)addLog(`${nm} 시간 초과 (무작위로 냄)`,'sys');
  if(O.ph==='lead'){
    addLog(`${rd}판 · ${nm} ${CN[colOf(v)]}`);
    O.ph='follow';H.turn=other(seat);setDeadline();mark();
    return true;
  }
  const a=O.A,b=other(a),c=cmp(O.pl[a],O.pl[b]),w=c>0?a:c<0?b:-1;
  O.rec.push({a,t:[O.pl[0],O.pl[1]],w});
  if(w>=0){O.sc[w]++;O.A=w}
  addLog(`${rd}판 · ${nm} ${CN[colOf(v)]}`);
  O.resLog=[`${rd}판 결과 · ${w>=0?H.players[w].name+' 승':'무승부'} (${O.sc[0]}:${O.sc[1]})`,w>=0?'':'sys'];   // 결과는 불이 켜진 뒤 기록 (연출을 앞지르지 않게)
  O.ph='show';O.showUntil=clock()+SHOW_MS;H.deadline=0;H.botActAt=0;
  mark();return true;
}
function gameDone(){
  const O=H.bw;
  return O.sc[0]>=WIN||O.sc[1]>=WIN||O.rec.length>=N;
}
function endByScore(){
  const O=H.bw;
  finishGame(O.sc[0]>O.sc[1]?0:O.sc[1]>O.sc[0]?1:-1,'');
}
function doSurrender(seat){
  if(H.phase!=='play'||seat<0||seat>1||H.players[seat].finished)return;
  finishGame(other(seat),H.players[seat].deserter?'desert':'surrender');
}
function botTurn(i){
  const O=H.bw,lc=O.ph==='follow'?colOf(O.pl[O.A]):-1;
  playTile(i,botPick(O.hand[i],lc),false);
}
function timeout(){
  const O=H.bw,i=H.turn,h=O.hand[i];
  if(h&&h.length)playTile(i,pick(h),true);
}
G._test={cmp,colOf,botPick,playTile,timeout,doSurrender,SHOW_MS};
G.engine={
  start(){
    Object.assign(H,{phase:'play',log:[],seatNote:{},field:[],last:null,reveal:null,shouts:[],pending:null,rankNext:1,known:{}});
    H.players.forEach((p,i)=>{
      p.finished=false;p.rank=null;p.surrendered=false;
      if(i<2)p.hand=[0];else{p.hand=[];p.finished=true;p.rank=i+1}
    });
    const A=typeof firstSeat==='function'?firstSeat(2):(Math.random()<.5?0:1);
    const full=()=>[0,1,2,3,4,5,6,7,8];
    H.bw={gn:((H.bw&&H.bw.gn)||0)+1,A,first:A,ph:'lead',hand:[full(),full()],vo:[shuffle(full()),shuffle(full())],pl:[-1,-1],rec:[],sc:[0,0],showUntil:0,res:null};
    addLog(`${H.players[A].name}님이 먼저 냅니다.`,'sys');
    startRound();
  },
  act(seat,a){
    if(a.t==='surrender'){doSurrender(seat);return}
    if(!H.bw||H.phase!=='play'||seat<0||seat>1)return;
    if(a.t==='put'&&Number.isInteger(a.v))playTile(seat,a.v,false);
  },
  tick(t){
    const O=H.bw;
    if(!O||H.phase!=='play')return;
    if(O.ph==='show'){
      if(t>=O.showUntil){if(O.resLog){addLog(...O.resLog);O.resLog=null}if(gameDone())endByScore();else startRound()}
      return;
    }
    const p=H.players[H.turn];if(!p)return;
    if(p.bot&&!awayHuman(p)){
      if(H.botActAt&&t>=H.botActAt&&!(p.away&&t<p.awayAt+AWAY_WAIT))botTurn(H.turn);
      return;
    }
    if(H.deadline&&t>=H.deadline)timeout();
  },
  snap(s,you,t){
    const O=H.bw,over=H.phase==='over',seat=you===0||you===1;
    const showV=(i,v)=>over||(seat&&you===i)?v:null;
    const o={gn:O.gn,A:O.A,first:O.first,ph:O.ph,sc:O.sc.slice(),
      rec:O.rec.map(r=>({a:r.a,w:r.w,c:[colOf(r.t[0]),colOf(r.t[1])],v:[showV(0,r.t[0]),showV(1,r.t[1])]})),
      pl:O.ph==='follow'?[0,1].map(i=>O.pl[i]>=0?{c:colOf(O.pl[i]),v:showV(i,O.pl[i])}:null):[null,null],
      my:seat?O.hand[you].slice().sort((a,b)=>a-b):null,
      oc:[0,1].map(i=>seat&&i===you?null:O.vo[i].map(colOf)),
      res:O.res?{...O.res}:null};
    if(over)o.ov=[O.vo[0].slice(),O.vo[1].slice()];
    s.o=o;s.gr=0;
    if(H.phase==='play'&&(O.ph==='lead'||O.ph==='follow'))s.dl=Math.max(0,Math.round(H.deadline-t));
    else{s.dl=0;if(H.phase==='play')delete s.t}   // 결과를 보여 주는 동안은 아무 차례도 아님
  },
  restore(ms){if(H.bw&&H.bw.showUntil)H.bw.showUntil+=ms},
  emoPhase:ph=>ph==='play'||ph==='over'
};

/* 기록 글 (결과 창) */
function recordText(v){
  const o=v.o,name=i=>v.ps[i]?v.ps[i].n:'?',L=['흑과백 기록'];
  (o.rec||[]).forEach((r,k)=>{
    const t=i=>r.v[i]==null?CN[r.c[i]]:`${CN[r.c[i]]} ${r.v[i]}`;
    L.push(`${k+1}판  ${name(r.a)} ${t(r.a)} · ${name(1-r.a)} ${t(1-r.a)}  → ${r.w<0?'무승부':name(r.w)+' 승'}`);
  });
  if(v.st==='over'&&o.res){const r=o.res;L.push(`결과: ${r.w<0?'무승부':name(r.w)+' 승리'}${r.why==='surrender'?' (상대 항복)':r.why==='desert'?' (상대 탈주)':''} (${r.w<0?o.sc[0]+':'+o.sc[1]:o.sc[r.w]+':'+o.sc[1-r.w]})`)}
  return L.join('\n');
}

/* ---------- 화면 (모든 참가자) ---------- */
let pend=-1,sentV=-1,sentAt=0;   // pend: 들어 올린 내 타일 (값), 없으면 -1. sentV: 방금 낸 타일 (상태가 올 때까지 들린 채로 둠)
let elBw=null,elBar=null,elBarMe=null,elHint=null,el2d=null,lastBar='',lastHint='',last2d='';
let msg='',msgUntil=0,msgTimer=null;
const myTurnNow=()=>!!(V&&V.o&&V.st==='play'&&myReady()&&!introWait()&&(V.o.ph==='lead'||V.o.ph==='follow'));
const dblOn=()=>typeof dblTap!=='undefined'&&!!dblTap;
const seated=()=>{const me=myIdx();return me===0||me===1};
const botSeat=()=>seated()?myIdx():0;   // 화면 아래쪽에 놓이는 자리 (관전자는 0번)
const nm=i=>V.ps[i]?V.ps[i].n:'?';
function say(txt){msg=txt;msgUntil=Date.now()+2400;drawHint();clearTimeout(msgTimer);msgTimer=setTimeout(drawHint,2500)}
const sndNo=()=>sfx('no');
function sndPick(){tone(1500,.03,{type:'triangle',vol:.06});hiss(.025,{freq:3200,q:3,vol:.07})}
function sndPut(at){hiss(.03,{freq:2600,q:2.2,vol:.2,at});tone(520,.06,{type:'triangle',vol:.1,at:at+.003});tone(1700,.025,{type:'triangle',vol:.05,at})}
/* 결과 불 소리: 내가 이김(올라가는 두 음) · 짐(낮은 음) · 무승부·관전(가운데) */
function sndLight(k){
  if(k>0){tone(880,.12,{type:'sine',vol:.11});tone(1320,.2,{type:'sine',vol:.1,at:.09})}
  else if(k<0){tone(330,.2,{type:'triangle',vol:.1});tone(247,.26,{type:'triangle',vol:.08,at:.1})}
  else{tone(660,.16,{type:'sine',vol:.09});tone(660,.16,{type:'sine',vol:.06,at:.12})}
}
/* 내 타일 누르기: 들어 올림 → [내기]. 같은 타일을 다시 누르면 내려놓음(두 번 눌러 놓기면 냄). 상대 차례에도 미리 들어 둘 수 있음 */
function pickTile(v){
  if(!V||!V.o||V.st!=='play'||!seated()||introWait())return;
  const my=V.o.my||[];
  if(!my.includes(v)){sndNo();return}
  if(pend===v){if(dblOn()&&myTurnNow())confirmPend();else{pend=-1;sndPick();redraw()}return}
  pend=v;sndPick();redraw();
}
function confirmPend(){
  if(pend<0||!myTurnNow())return;
  const v=pend;pend=-1;sentV=v;sentAt=clock();sendAct({t:'put',v});redraw();
}
function redraw(){drawAll();G.buttons();Bw3.dirty=true;bw3Sync()}
/* 이름 칸: 자리 색 점 · 이름 · 점수 · (차례면) 남은 초 */
function chipHTML(i){
  const me=myIdx(),o=V.o,p=V.ps[i];if(!p||i>1)return '';
  const on=V.st==='play'&&V.t===i&&!introWait();
  const st=V.st==='over'?(o.res&&o.res.w<0?'무승부':p.f===1?'승리':(p.sr===3?'탈주':p.sr?'항복':'패배')):'';
  return `<div class="bw-p${on?' on':''}${i===me?' me':''}"><i class="dot" style="background:${SEAT_C[i]}"></i><b>${esc(p.n)}${i===me?' (나)':''}</b><span class="sc">${o.sc[i]}</span><span class="w" data-ct="${i}"></span>${st?`<span class="st">${st}</span>`:''}</div>`;
}
const CHIP_GAP=10;
function tvBox(r){
  const W=r.clientWidth,Hh=r.clientHeight;r.classList.toggle('wide',W>Hh||W>=700);
  const narrow=W<700,bar=r.querySelector('.bw-bar'),mb=r.querySelector('.bw-mebar');
  const R=Math.max(bar.offsetTop+bar.offsetHeight+CHIP_GAP,(narrow?70:14)+(mb.offsetHeight||26)+CHIP_GAP),m=narrow?8:16;
  return {fw:W-2*m,fh:Hh-2*R,cy:Hh/2,R};
}
function chipsAt(topY,botY){
  const r=elBw,bar=r.querySelector('.bw-bar'),mb=r.querySelector('.bw-mebar');if(!bar||!mb)return;
  const Hh=r.clientHeight,lim=Hh-(r.clientWidth<700?70:14)-(mb.offsetHeight||34);
  r.style.setProperty('--bs',Math.max(bar.offsetHeight,Math.round(topY-CHIP_GAP-bar.offsetTop))+'px');
  r.style.setProperty('--mt',Math.round(Math.min(botY+CHIP_GAP,lim))+'px');
  r.classList.add('lay');
}
function barHTML(){const me=myIdx();return seated()?chipHTML(1-me):chipHTML(0)+chipHTML(1)}
function meBarHTML(){return seated()?chipHTML(myIdx()):''}
/* 안내 줄: 결과만 (차례는 이름 칸·빈 칸 고리가, 판 결과는 불이 보여 줌) */
function hintText(){
  if(Date.now()<msgUntil&&msg)return msg;
  if(!V||!V.o)return '';
  if(V.st==='over'){
    const r=V.o.res,sc=V.o.sc;if(!r)return '게임이 끝났습니다.';
    return r.w<0?`무승부입니다. (${sc[0]}:${sc[1]})`:`${nm(r.w)} 승리${r.why==='surrender'?' (항복)':r.why==='desert'?' (탈주)':` (${sc[r.w]}:${sc[1-r.w]})`}`;
  }
  return '';
}
function drawHint(){if(!elHint)return;const h=hintText();if(h!==lastHint){elHint.textContent=h;lastHint=h}}
/* ----- 2D (WebGL이 없을 때): 상대 줄 · 기록 줄 · 내 줄 ----- */
function tile2d(c,v,cls){return `<span class="bw-t ${c?'w':'b'}${cls?' '+cls:''}">${v==null?'':v}</span>`}
function html2d(){
  const o=V.o,bs=botSeat(),ts=1-bs,lit=(r,i)=>r.w<0||r.w===i;
  const row=i=>{
    if(seated()&&i===myIdx())return (o.my||[]).map(v=>`<button type="button" class="bw-t ${colOf(v)?'w':'b'}${v===pend?' up':''}" data-v="${v}">${v}</button>`).join('');
    const oc=o.oc[i]||[],ov=o.ov&&o.ov[i];return oc.map((c,k)=>tile2d(c,ov?ov[k]:null)).join('');
  };
  const cols=[];
  for(let k=0;k<N;k++){
    const r=o.rec[k],cur=!r&&k===o.rec.length?o.pl:null;
    const cell=i=>r?tile2d(r.c[i],r.v[i],lit(r,i)?(r.w<0?'lit tie':'lit'):''):cur&&cur[i]?tile2d(cur[i].c,cur[i].v):'<span class="bw-t e"></span>';
    cols.push(`<div class="bw-col">${cell(ts)}${cell(bs)}</div>`);
  }
  return `<div class="bw-row2">${row(ts)}</div><div class="bw-rec2">${cols.join('')}</div><div class="bw-row2 me">${row(bs)}</div>`;
}
function drawAll(){
  if(!elBw||!V||!V.o)return;
  const top=barHTML(),mb=meBarHTML(),key=top+'\u0001'+mb;if(key!==lastBar){elBar.innerHTML=top;elBarMe.innerHTML=mb;lastBar=key}
  if(!Bw3.on){const h=html2d();if(h!==last2d){el2d.innerHTML=h;last2d=h}}
  drawHint();
}

/* ---------- 3D: 공통 원목 테이블 위, 바로 위(90도)에서 내려다보는 자기 카메라 ----------
   화면 아래가 내 줄(내 타일 9개, 숫자가 보임), 위가 상대 줄(엎은 타일, 색만). 가운데는 기록 판(9칸 × 위아래 2칸).
   타일은 물건 하나가 손 → 기록 칸으로 미끄러져 들어감. 이긴 쪽 기록 타일 아래에 금빛이 켜지고, 비기면 양쪽 모두.
   단위: 월드 그대로. 화면 오른쪽 = +x, 화면 아래 = +z */
const TW=.46,TD=.66,TT=.09,HP=.53,ZH=2.02;   // 타일 폭·깊이·두께, 손 줄 간격, 손 줄 z
const RS=.8,RG=.44,RZ=.38,BH=.06;           // 기록 타일 크기 비율, 기록 칸 간격, 기록 위아래 칸 z, 기록 판 두께
const BWD=N*RG+.34,BDP=2*RZ+TD*RS+.36;      // 기록 판 폭·깊이
const XW=(N-1)/2*HP+TW/2+.06,ZW=ZH+TD/2+.06;   // 화면에 꼭 들어갈 반폭·반높이
const Bw3={on:false,built:false,fail:false,root:null,cam:null,dirty:true,lastR:0,lay:'',layAt:0,d:12,tiles:null,gn:-1,glows:[],slot:null,anim:false,lit:[],flipAt:null,lands:[]};
const ease=k=>k<=0?0:k>=1?1:k*k*(3-2*k);
const eOut=x=>{x=x<0?0:x>1?1:x;return 1-Math.pow(1-x,3)};
const dropY=(x,h)=>x>=1?0:x<.68?h*(1-(x/.68)*(x/.68)):h*.13*Math.sin(Math.PI*(x-.68)/.32);
function woodPaint(g,w,h,base,dark,n,seed){
  let s=seed||7;const rnd=()=>{s=(s*16807)%2147483647;return s/2147483647};
  g.fillStyle=base;g.fillRect(0,0,w,h);
  for(let i=0;i<n;i++){const y0=rnd()*h,a=rnd()*.12+.04;g.strokeStyle=dark;g.globalAlpha=a;g.lineWidth=rnd()*2.5+.8;g.beginPath();
    for(let t=0;t<=w;t+=8){const y=y0+Math.sin(t/30+i)*3+Math.sin(t/11+i*3)*1.2;t?g.lineTo(t,y):g.moveTo(t,y)}g.stroke()}
  g.globalAlpha=1;
}
const MAT={};
const BODY=[0x2a2a2e,0xf1ebde];   // 흑·백 타일 몸
function faceMat(c,v){
  const k='f'+c+'_'+(v==null?'x':v);
  if(MAT[k])return MAT[k];
  if(v==null)return MAT[k]=toon({color:BODY[c],rim:c?.12:.35});
  const tx=canvasTex(128,184,(g,w,h)=>{
    g.fillStyle=c?'#f1ebde':'#2a2a2e';g.fillRect(0,0,w,h);
    g.strokeStyle=c?'rgba(120,100,70,.35)':'rgba(255,255,255,.16)';g.lineWidth=5;g.strokeRect(9,9,w-18,h-18);
    g.fillStyle=c?'#26262a':'#f4efe3';g.font='700 112px "IBM Plex Mono", monospace';g.textAlign='center';g.textBaseline='middle';g.fillText(String(v),w/2,h/2+6);
    if(v===6){g.fillRect(w/2-22,h/2+56,44,7)}   // 6 밑줄 (뒤집혀 보여도 헷갈리지 않게)
  });
  return MAT[k]=toon({map:tx,rim:0});
}
const sideMat=c=>MAT['s'+c]||(MAT['s'+c]=toon({color:BODY[c],rim:c?.12:.35}));
/* 타일 하나: 윗면 = 숫자(모르면 민무늬), 아랫면 = 민무늬. 엎은 타일은 z축으로 반 바퀴 */
function tileMesh(c,v){
  const g=new THREE.Group(),geo=Bw3.geo||(Bw3.geo=new THREE.BoxGeometry(TW,TT,TD));
  const m=new THREE.Mesh(geo,[sideMat(c),sideMat(c),faceMat(c,v),sideMat(c),sideMat(c),sideMat(c)]);m.castShadow=true;m.receiveShadow=true;g.add(m);
  const ink=new THREE.Mesh(Bw3.igeo||(Bw3.igeo=new THREE.BoxGeometry(TW+.035,TT+.03,TD+.035)),Bw3.inkM||(Bw3.inkM=new THREE.MeshBasicMaterial({color:GFX_INK,side:THREE.BackSide})));g.add(ink);
  g.userData={m,c,v:v==null?-1:v};
  return g;
}
function setFace(o,v){o.v=v;o.g.userData.m.material[2]=faceMat(o.c,v)}
function bw3Build(){
  if(Bw3.built||Bw3.fail)return Bw3.built;
  if(!T.ok||typeof THREE==='undefined'){Bw3.fail=true;return false}
  try{
    const root=new THREE.Group();root.visible=false;
    const bg=new THREE.Group();root.add(bg);Bw3.boardG=bg;
    const bt=canvasTex(1024,Math.round(1024*BDP/BWD),(g,w,h)=>{
      woodPaint(g,w,h,'#6f4020','#2a1206',90,5);
      const s=w/BWD,X=x=>(x+BWD/2)*s,Z=z=>(z+BDP/2)*s,sw=TW*RS+.07,sd=TD*RS+.07;
      g.fillStyle='rgba(20,10,4,.38)';g.strokeStyle='rgba(255,220,170,.22)';g.lineWidth=3;
      for(let k=0;k<N;k++)for(const z of [-RZ,RZ]){const x=(k-(N-1)/2)*RG;g.fillRect(X(x-sw/2),Z(z-sd/2),sw*s,sd*s);g.strokeRect(X(x-sw/2),Z(z-sd/2),sw*s,sd*s)}
      g.fillStyle='rgba(255,226,180,.55)';g.font=`700 ${Math.round(.13*s)}px "IBM Plex Mono", monospace`;g.textAlign='center';g.textBaseline='middle';
      for(let k=0;k<N;k++)g.fillText(String(k+1),X((k-(N-1)/2)*RG),Z(0));
    });
    const board=new THREE.Mesh(new THREE.BoxGeometry(BWD,BH,BDP),[toon({color:0x5a3218,rim:.1}),toon({color:0x5a3218,rim:.1}),toon({map:bt,rim:0}),toon({color:0x5a3218}),toon({color:0x5a3218,rim:.1}),toon({color:0x5a3218,rim:.1})]);
    board.position.y=BH/2+.005;board.castShadow=board.receiveShadow=true;bg.add(board);
    const bo=new THREE.Mesh(new THREE.BoxGeometry(BWD+.05,BH+.02,BDP+.05),new THREE.MeshBasicMaterial({color:GFX_INK,side:THREE.BackSide}));bo.position.copy(board.position);bg.add(bo);
    // 들어 올린 타일 빛 (금빛 번짐)
    const gT=canvasTex(128,160,(x,w,h)=>{const gr=x.createRadialGradient(w/2,h/2,0,w/2,h/2,w*.62);gr.addColorStop(0,'rgba(255,214,70,1)');gr.addColorStop(.55,'rgba(255,190,40,.85)');gr.addColorStop(1,'rgba(255,170,20,0)');x.fillStyle=gr;x.fillRect(0,0,w,h)});
    // 결과 테두리: 이긴 쪽 기록 타일 둘레에 금색 실선, 무승부면 양쪽 은색 (타일 아래 판 위에 깔아 타일 바깥으로 테두리만 보임)
    const fT=canvasTex(128,176,(x,w,h)=>{x.fillStyle='#fff';const b=17;x.fillRect(0,0,w,b);x.fillRect(0,h-b,w,b);x.fillRect(0,0,b,h);x.fillRect(w-b,0,b,h)});
    for(let k=0;k<N;k++)for(let s=0;s<2;s++){
      const m=new THREE.Mesh(new THREE.PlaneGeometry(TW*RS+.13,TD*RS+.13),new THREE.MeshBasicMaterial({map:fT,color:0xf2b632,transparent:true,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.set((k-(N-1)/2)*RG,BH+.012,s?RZ:-RZ);m.visible=false;m.renderOrder=2;root.add(m);
      Bw3.glows.push(m);
    }
    // 다음에 낼 자리: 지금 차례인 사람의 빈 기록 칸에 금색 테두리
    const sT=canvasTex(128,176,(x,w,h)=>{x.strokeStyle='#fffaf0';x.lineWidth=12;x.setLineDash([22,14]);x.strokeRect(8,8,w-16,h-16)});
    Bw3.slot=new THREE.Mesh(new THREE.PlaneGeometry(TW*RS+.08,TD*RS+.08),new THREE.MeshBasicMaterial({map:sT,transparent:true,depthWrite:false}));
    Bw3.slot.rotation.x=-Math.PI/2;Bw3.slot.position.y=BH+.014;Bw3.slot.visible=false;Bw3.slot.renderOrder=3;root.add(Bw3.slot);
    // 들어 올린 내 타일 둘레의 빛
    Bw3.sel=new THREE.Mesh(new THREE.PlaneGeometry(TW*1.9,TD*1.6),new THREE.MeshBasicMaterial({map:gT,transparent:true,opacity:.75,depthWrite:false}));
    Bw3.sel.rotation.x=-Math.PI/2;Bw3.sel.position.y=.01;Bw3.sel.visible=false;Bw3.sel.renderOrder=2;root.add(Bw3.sel);
    Bw3.cam=new THREE.PerspectiveCamera(44,1,.1,100);Bw3.cam.up.set(0,0,-1);
    T.scene.add(root);Bw3.root=root;Bw3.built=true;
  }catch(e){Bw3.fail=true;try{console.warn('흑과백 3D 준비 실패',e)}catch(_){}}
  return Bw3.built;
}
/* 타일 물건: 자리마다 9개. 내 자리는 숫자를 아는 타일(값 0~8), 나머지는 색만 아는 엎은 타일(흑 5 · 백 4).
   o = {g, c, v(모르면 -1), seat, where:'hand'|'rec', rd(기록 칸 번호), p:{x,y,z,s,rz}(지금), tw:{from,to,t0,dur,arc}(움직임)} */
function bw3Reset(){
  if(Bw3.tiles)for(const o of Bw3.tiles)Bw3.root.remove(o.g);
  Bw3.tiles=[];Bw3.lit=[];Bw3.flipAt=null;Bw3.lands=[];
  const bs=botSeat();
  for(const seat of [0,1])for(let v=0;v<N;v++){
    const known=seated()&&seat===myIdx(),c=colOf(v);
    const g=tileMesh(c,known?v:null);Bw3.root.add(g);
    Bw3.tiles.push({g,c,v:known?v:-1,seat,where:'hand',rd:-1,p:null,tw:null,face:known?1:0,fl:null});
  }
  for(const g of Bw3.glows)g.visible=false;
  Bw3.bs=bs;
}
const sideZ=seat=>seat===Bw3.bs?1:-1;   // 아래쪽 자리 +1, 위쪽 -1
/* 목표 자세 */
function handPose(seat,k,n,lift){const z=sideZ(seat)*ZH;return {x:(k-(n-1)/2)*HP,y:TT/2+(lift?.16:0),z:z-(lift?.2:0)*sideZ(seat),s:1}}
function recPose(seat,rd){return {x:(rd-(N-1)/2)*RG,y:BH+TT*RS/2+.006,z:sideZ(seat)*RZ,s:RS}}
function moveTo(o,to,dur,arc,now){
  const cur=o.p||to;
  if(o.tw&&Math.abs(o.tw.to.x-to.x)<1e-4&&Math.abs(o.tw.to.z-to.z)<1e-4&&Math.abs(o.tw.to.y-to.y)<1e-4&&o.tw.to.s===to.s)return;
  if(!o.tw&&o.p&&Math.abs(o.p.x-to.x)<1e-4&&Math.abs(o.p.z-to.z)<1e-4&&Math.abs(o.p.y-to.y)<1e-4&&o.p.s===to.s)return;
  if(!o.p||!dur){o.p={...to};o.tw=null;return}
  o.tw={from:{...cur},to:{...to},t0:now,dur,arc:arc||0};Bw3.anim=true;
}
/* 상태 → 물건 자리 (새 상태가 올 때·고를 때마다) */
function bw3Sync(){
  if(!Bw3.on||!V||!V.o)return;
  const o=V.o,now=clock();
  if(o.gn!==Bw3.gn||botSeat()!==Bw3.bs||!Bw3.tiles){Bw3.gn=o.gn;bw3Reset();Bw3.first=true}
  const snap=!!Bw3.first;Bw3.first=false;
  // 기록 칸(끝난 판 + 지금 판의 선 타일)에 들어갈 물건 정하기
  const occ=[[],[]];
  o.rec.forEach((r,k)=>{for(const i of [0,1])occ[i][k]={c:r.c[i],v:r.v[i]}});
  o.pl.forEach((x,i)=>{if(x)occ[i][o.rec.length]=x});
  const lands=[];
  for(const seat of [0,1]){
    const mine=Bw3.tiles.filter(t=>t.seat===seat);
    occ[seat].forEach((x,rd)=>{
      if(!x)return;
      let t=mine.find(t=>t.rd===rd);
      if(!t){
        const free=mine.filter(t=>t.where==='hand'&&t.c===x.c);
        t=x.v!=null?(free.find(t=>t.v===x.v)||free[0]):(free.filter(t=>t.v<0).sort((a,b)=>(b.p?b.p.x:0)*sideZ(seat)-(a.p?a.p.x:0)*sideZ(seat))[0]||free[0]);   // 상대 타일은 그 색 중 화면 오른쪽 끝 것이 나감
        if(!t)return;
        t.where='rec';t.rd=rd;
        if(!snap)lands.push(t);
      }
      if(x.v!=null&&t.v!==x.v&&!(V.st==='over'))setFace(t,x.v);
      moveTo(t,recPose(seat,rd),snap?0:430,snap?0:.5,now);
    });
    // 손에 남은 타일 줄: 내 자리는 숫자 순서, 상대는 받은 색 순서(판마다 섞임: 같은 색끼리 지금 자리 순서대로 짝지음 → 섞이는 움직임)
    const hand=mine.filter(t=>t.where==='hand');
    if(seated()&&seat===myIdx()){
      const my=o.my||[];
      hand.sort((a,b)=>a.v-b.v);
      hand.forEach(t=>{const k=my.indexOf(t.v);if(k<0)return;moveTo(t,handPose(seat,k,my.length,(t.v===pend||t.v===sentV)&&V.st==='play'),snap?0:240,0,now)});
    }else{
      const oc=o.oc[seat]||[],ov=o.ov&&o.ov[seat],pool=hand.slice().sort((a,b)=>((a.p?a.p.x:0)-(b.p?b.p.x:0))*sideZ(seat));
      oc.forEach((c,k)=>{
        const i=pool.findIndex(t=>t.c===c);if(i<0)return;const t=pool.splice(i,1)[0];
        if(ov&&t.v<0)t.rv=ov[k];
        moveTo(t,handPose(seat,sideZ(seat)>0?k:oc.length-1-k,oc.length,false),snap?0:300,0,now);
      });
    }
  }
  // 앞면이 보이는 쪽: 내 타일은 늘 앞면, 나머지는 엎음. 끝나면 모두 뒤집어 공개(기록 칸 왼쪽부터 → 손에 남은 타일)
  for(const t of Bw3.tiles){
    const want=t.rev||(seated()&&t.seat===myIdx())?1:0;
    if(!t.fl){t.face=want;t.g.rotation.z=want?0:Math.PI}
  }
  if(V.st==='over'&&o.ov&&!Bw3.flipAt){
    Bw3.flipAt=now+(snap?0:350);let k=0;
    const order=[...Bw3.tiles.filter(t=>t.where==='rec').sort((a,b)=>a.rd-b.rd||a.seat-b.seat),...Bw3.tiles.filter(t=>t.where==='hand')];
    for(const t of order){
      if(t.face)continue;
      const r=t.where==='rec'?o.rec[t.rd]:null,v=r?r.v[t.seat]:t.rv;
      if(v==null)continue;
      setFace(t,v);t.rev=1;t.fl={t0:Bw3.flipAt+k*(snap?0:110),dur:snap?0:380};k++;
    }
    Bw3.anim=true;
  }
  // 불: 끝난 판의 이긴 쪽(비기면 양쪽). 새로 끝난 판은 타일이 미끄러져 닿고(0.43초) 0.5초 뒤, 처음 그릴 때는 바로
  o.rec.forEach((r,k)=>{for(const i of [0,1])if((r.w<0||r.w===i)&&!Bw3.lit.some(x=>x.k===k&&x.i===i))Bw3.lit.push({k,i,t0:snap?now-2000:now+930,w:r.w})});
  Bw3.lands=(Bw3.lands||[]).concat(lands.map(t=>now+430));
  bw3Marks();
  Bw3.dirty=true;Bw3.anim=true;
}
/* 다음 낼 자리 테두리, 들어 올린 타일 빛 */
function bw3Marks(){
  if(!Bw3.on||!V||!V.o)return;
  const o=V.o,play=V.st==='play'&&(o.ph==='lead'||o.ph==='follow')&&!introWait();
  if(play&&V.t>=0&&V.t<=1){const k=o.rec.length;Bw3.slot.position.x=(k-(N-1)/2)*RG;Bw3.slot.position.z=sideZ(V.t)*RZ;Bw3.slot.visible=k<N}
  else Bw3.slot.visible=false;
  Bw3.dirty=true;
}
/* 카메라: 위 줄·기록 판·아래 줄이 판 자리에 꽉 차게 */
function bw3Layout(t){
  if(t-Bw3.layAt<100&&Bw3.lay)return false;
  Bw3.layAt=t;
  const st=$('#stage'),W=st.clientWidth,Hh=st.clientHeight;if(!W||!Hh||!V||!V.o)return false;
  const B=tvBox(elBw),key=[W,Hh,B.R,myIdx()].join(',');
  if(key===Bw3.lay)return false;
  Bw3.lay=key;
  const s=Math.min(B.fw/(2*XW),B.fh/(2*ZW))*.98,fy=B.cy-B.fh/2;
  const cam=Bw3.cam,f=Math.tan(cam.fov*Math.PI/360),d=(Hh/2)/(s*f);
  cam.aspect=W/Hh;cam.position.set(0,d,0);cam.lookAt(0,0,0);
  cam.setViewOffset(W,Hh,0,-((fy+B.fh/2)-Hh/2),W,Hh);cam.updateProjectionMatrix();cam.updateMatrixWorld();
  {const cy=fy+B.fh/2;chipsAt(cy-ZW*s,cy+ZW*s)}
  Bw3.d=d;Bw3.dirty=true;
  return true;
}
/* 매 프레임: 움직임·뒤집기·불 (시작 시각과의 차이로 계산) */
function bw3Step(now){
  let busy=false;
  for(const t of Bw3.tiles||[]){
    if(t.tw){
      const a=t.tw,k=Math.min(1,(now-a.t0)/a.dur),e=ease(k);busy=true;
      t.p={x:a.from.x+(a.to.x-a.from.x)*e,y:a.from.y+(a.to.y-a.from.y)*e+Math.sin(Math.PI*k)*a.arc,z:a.from.z+(a.to.z-a.from.z)*e,s:a.from.s+(a.to.s-a.from.s)*e};
      if(k>=1){t.p={...a.to};t.tw=null}
    }
    let lift=0;
    if(t.fl){
      const k=t.fl.dur?(now-t.fl.t0)/t.fl.dur:1;
      if(k<=0){t.g.rotation.z=Math.PI;busy=true}
      else if(k<1){const e=ease(k);t.g.rotation.z=Math.PI*(1-e);lift=Math.sin(Math.PI*k)*.28;busy=true}
      else{t.g.rotation.z=0;t.face=1;t.fl=null}
    }
    if(t.p){t.g.position.set(t.p.x,t.p.y+lift,t.p.z);t.g.scale.setScalar(t.p.s)}
  }
  // 닿는 소리
  if(Bw3.lands&&Bw3.lands.length){const keep=[];for(const at of Bw3.lands){if(now>=at)sndPut(0);else keep.push(at)}Bw3.lands=keep;if(keep.length)busy=true}
  // 불
  const me=myIdx();
  for(const g of Bw3.glows)g.userData.on=false;
  for(const L of Bw3.lit){
    const g=Bw3.glows[L.k*2+(sideZ(L.i)>0?1:0)];if(!g)continue;
    const e=now-L.t0;if(e<0){busy=true;continue}
    if(!L.snd){L.snd=1;if(e<400&&(L.i===L.w||L.w<0)&&!(L.w<0&&L.i!==Bw3.bs))sndLight(L.w<0?0:me<0?0:L.w===me?1:-1)}
    g.userData.on=true;
    g.material.color.setHex(L.w<0?0xc9ced6:0xf2b632);   // 승리 금색 · 무승부 은색
    const k=Math.min(1,e/180),fl=e<700?Math.sin(Math.PI*e/700):0;   // 켜지는 순간 한 번 반짝(살짝 커졌다 돌아옴)
    g.material.opacity=k;g.scale.setScalar(1+.18*fl);if(e<700)busy=true;
  }
  for(const g of Bw3.glows)g.visible=!!g.userData.on;
  // 들어 올린 내 타일 빛
  const st=pend>=0&&V&&V.st==='play'&&Bw3.tiles?Bw3.tiles.find(t=>t.seat===me&&t.v===pend&&t.where==='hand'):null;
  Bw3.sel.visible=!!st;if(st&&st.p){Bw3.sel.position.x=st.p.x;Bw3.sel.position.z=st.p.z}
  if(Bw3.slot.visible){Bw3.slot.material.opacity=.55+.45*Math.abs(Math.sin(now/420));busy=true}
  return busy;
}
function bw3Render(t){
  if(!Bw3.on||!T.ok)return;
  if(bw3Layout(t))Bw3.dirty=true;
  const busy=bw3Step(t),intro=IN.on3d&&introStep(t);
  if(!busy&&!intro&&!Bw3.dirty&&t-Bw3.lastR<400)return;
  Bw3.dirty=false;Bw3.lastR=t;
  const fog=T.scene.fog,fn=fog?fog.near:0,ff=fog?fog.far:0;
  if(fog){fog.near=Bw3.d+4;fog.far=Bw3.d+26}
  for(const m of [T.timerBg,T.timerArc,T.ring])if(m)m.visible=false;
  let cam=Bw3.cam;
  {const k=intro&&IN.fromLobby?ease((t-IN.t0)/INTRO.cam):1;
   if(k<1){   // 시작 연출: 이 기기의 로비 카메라에서 바로 위 카메라로
     const ic=Bw3.icam||(Bw3.icam=new THREE.PerspectiveCamera());
     ic.position.copy(T.cam.position).lerp(Bw3.cam.position,k);ic.quaternion.copy(T.cam.quaternion).slerp(Bw3.cam.quaternion,k);
     const a=T.cam.projectionMatrix.elements,b=Bw3.cam.projectionMatrix.elements,m=ic.projectionMatrix.elements;
     for(let j=0;j<16;j++)m[j]=a[j]+(b[j]-a[j])*k;
     ic.projectionMatrixInverse.copy(ic.projectionMatrix).invert();ic.updateMatrixWorld();
     if(fog){fog.near=fn+(fog.near-fn)*k;fog.far=ff+(fog.far-ff)*k}
     cam=ic;
   }}
  T.r.render(T.scene,cam);
  if(fog){fog.near=fn;fog.far=ff}
}

/* ---------- 시작 연출 (방장이 그동안 시간·봇을 멈춤, 길이 G.introMs) ----------
   0~1.1초     로비 카메라 → 바로 위 90도, 0.65초부터 이름 칸
   0.1~0.5초   기록 판이 툭 내려앉음
   0.5~1.3초   타일이 두 줄에 하나씩 떨어짐(양쪽 같이)
   1.65초~     기록 판 가운데에 첫 차례 주사위 → 멈추면 'OO부터 시작합니다'
   바로 시작(again)은 카메라·판 없이 타일만 짧게 다시 떨어지고 주사위 */
const INTRO={cam:1100,ui:650,board:[100,400],tile:[500,70,260],dice:1650,tileA:[100,45,220],diceA:950};
const DIE=.5;
G.introMs=(again,rolls)=>Math.round((again?INTRO.diceA:INTRO.dice)+DicePick.totalFor(rolls)+100);
const IN={on:false,on3d:false,t0:0,total:0,r:0,again:false,fromLobby:true,said:false,fp:null,die:null,snd:{}};
const introOn=()=>IN.on&&clock()<IN.t0+IN.total;
const introWait=()=>introOn()&&!IN.said;
G.intro=(t0,o)=>{
  if(!V||!V.o||!V.ps)return;
  const rolls=o&&o.rolls,seed=(o&&o.seed)||1;
  IN.on=true;IN.t0=t0;IN.said=false;IN.snd={};IN.fromLobby=!Bw3.on;IN.again=!!(o&&o.again)&&!IN.fromLobby;
  IN.r=IN.again?INTRO.diceA:INTRO.dice;IN.total=(o&&o.total)||G.introMs(IN.again,rolls);
  if(IN.die){IN.die.dispose();IN.die=null}
  IN.fp=firstPick(t0+IN.r,{seats:[0,1],first:V.o.first,rolls,seed});
  IN.on3d=true;pend=-1;
  $('#stage').classList.add('bw-intro');if(elBw&&IN.fromLobby)elBw.classList.add('intro');
  lastBar='';Bw3.dirty=true;
};
function introStep(now,force){
  if(!Bw3.built||!V||!V.o||!Bw3.tiles)return false;
  const e=now-IN.t0,done=force||e>=IN.total,fl=IN.fromLobby,A=IN.again?INTRO.tileA:INTRO.tile;
  if(done)IN.on3d=false;
  {const x=done||!fl?1:(e-INTRO.board[0])/INTRO.board[1];Bw3.boardG.visible=x>0;Bw3.boardG.position.y=dropY(Math.max(0,x),1.6)}
  for(const t of Bw3.tiles){
    if(t.where!=='hand'||!t.p)continue;
    const k=Math.round((t.p.x/HP+(N-1)/2)*sideZ(t.seat)+(sideZ(t.seat)>0?0:N-1));   // 줄 안 순서(왼쪽부터, 위 줄은 오른쪽부터)
    const x=done?1:(e-A[0]-k*A[1])/A[2];
    t.g.visible=x>0;t.g.position.y=t.p.y+dropY(Math.max(0,x),1.3);
  }
  if(IN.fp&&!IN.fp.fixed){
    if(!IN.die&&!done&&Bw3.root){IN.die=DicePick.mesh(THREE,2,SEAT_C);Bw3.root.add(IN.die.g)}
    if(IN.die)IN.die.apply(done||e<IN.r?null:IN.fp.pose(now),DIE,0,BH,0);
  }
  if(done){for(const t of Bw3.tiles)t.g.visible=true;if(IN.die){IN.die.dispose();IN.die=null}bw3Marks()}
  return true;
}
function introEnd(){
  if(IN.on3d)introStep(clock(),true);
  if(IN.die){IN.die.dispose();IN.die=null}
  IN.on=false;IN.on3d=false;IN.said=true;
  $('#stage').classList.remove('bw-intro');if(elBw)elBw.classList.remove('intro');
}
function introTick(){
  if(!IN.on)return;
  const e=clock()-IN.t0,S=IN.snd,once=(k,f)=>{if(!S[k]){S[k]=1;f()}},d3=IN.on3d&&Bw3.on,A=IN.again?INTRO.tileA:INTRO.tile;
  if(e>=INTRO.ui&&elBw&&elBw.classList.contains('intro'))elBw.classList.remove('intro');
  if(d3&&IN.fromLobby&&e>=INTRO.board[0]+INTRO.board[1]*.68)once('thud',()=>{tone(120,.13,{type:'triangle',vol:.2});hiss(.09,{freq:650,vol:.12})});
  if(d3)for(let k=0;k<N;k++)if(e>=A[0]+k*A[1]+A[2]*.68)once('t'+k,()=>sndPut(0));
  if(IN.fp&&e>=IN.r&&IN.fp.tick(IN.t0+e)){
    IN.said=true;$('#stage').classList.remove('bw-intro');if(elBw)elBw.classList.remove('intro');
    fxSay(IN.fp.msg(),SEAT_C[IN.fp.first]);
    lastBar='';bw3Marks();
  }
  if(e>=IN.total){IN.on=false;lastBar='';lastHint='';G.buttons();bw3Marks()}
  drawAll();
}
/* 3D에서 누른 곳 → 내 타일 */
function bw3Click(e){
  if(!Bw3.on||G!==GAMES.blackwhite||!Bw3.tiles||!seated())return;
  const r=T.r.domElement.getBoundingClientRect();if(!r.width)return;
  const ray=Bw3.ray||(Bw3.ray=new THREE.Raycaster());
  ray.setFromCamera({x:(e.clientX-r.left)/r.width*2-1,y:-(e.clientY-r.top)/r.height*2+1},Bw3.cam);
  const o=ray.ray.origin,dv=ray.ray.direction;if(Math.abs(dv.y)<1e-6)return;
  const k=(TT-o.y)/dv.y,x=o.x+dv.x*k,z=o.z+dv.z*k,me=myIdx();
  const t=Bw3.tiles.find(t=>t.seat===me&&t.where==='hand'&&t.p&&Math.abs(x-t.p.x)<TW/2+.035&&Math.abs(z-t.p.z)<TD/2+.08);
  if(t)pickTile(t.v);
  else if(Math.abs(z-ZH)<TD/2+.1&&Math.abs(x)<XW&&V.st==='play')sndNo();   // 내 줄의 빈 곳
}
/* 새 상태를 받았을 때 */
G.preView=()=>{
  if(!V.o)return;
  if(pend>=0&&(!V.o.my||!V.o.my.includes(pend)||V.st!=='play'))pend=-1;
  if(sentV>=0&&(!V.o.my||!V.o.my.includes(sentV)||clock()-sentAt>1500))sentV=-1;
};
G.postView=()=>{};
G.overExtra=()=>{
  if(!V||!V.o||!V.o.rec||!V.o.rec.length)return '';
  return `<div class="qd-rec"><div class="qd-rec-h"><b>기록</b></div><pre>${esc(recordText(V))}</pre></div>`;
};
G.logCue=()=>false;
G.cues=()=>{};
G.hud=inGame=>{
  if(!elBw)return;
  const on=!!(inGame&&V&&V.o);
  elBw.hidden=!on;
  $('#stage').classList.toggle('bw-over',!!(on&&V.st==='over'));
  const d3=on&&bw3Build();
  if(d3!==Bw3.on){Bw3.on=d3;Bw3.lay='';if(Bw3.root)Bw3.root.visible=d3;$('#stage').classList.toggle('bw3d',d3);last2d='';lastHint=''}
  $('#stage').classList.toggle('bw2d',on&&!d3);
  if(!on){lastBar='';lastHint='';last2d='';return}
  drawAll();
  bw3Sync();
};
G.handMarks=()=>{};
G.me=()=>{$('#numpick').hidden=true};
G.overRank=p=>{
  const r=V&&V.o&&V.o.res,t=p.sr===3?'탈주':p.sr?'항복':r&&r.w<0?'무승부':'';
  return t?`<span class="left">${t}</span>`:'';
};
G.usesDbl=true;
G.no3D=true;
G.buttons=()=>{
  const play=$('#btnPlay'),can=!!(pend>=0&&myTurnNow());
  $('#btnPass').hidden=true;$('#btnGura').hidden=true;
  play.disabled=!can;play.classList.toggle('ready',can);
  if($('#playMain').textContent!=='내기')$('#playMain').textContent='내기';
  const sub=keyLabel(KEYS.play);if($('#playSub').textContent!==sub)$('#playSub').textContent=sub;
};
G.live=()=>{
  if(IN.on)introTick();
  if(!V||!V.o||!elBw)return;
  // 차례인 사람 이름 칸의 남은 초 (5초 남으면 빨갛게 깜빡)
  elBw.querySelectorAll('[data-ct]').forEach(el=>{
    const i=+el.dataset.ct,run=V.st==='play'&&V.t===i&&V.dl>0&&!introWait()&&(V.o.ph==='lead'||V.o.ph==='follow');
    const left=run?Math.max(0,V.deadAt-clock()):0,txt=run?String(Math.ceil(left/1000)):'';
    if(el.textContent!==txt)el.textContent=txt;
    const low=run&&left<=5000;if(el.parentNode.classList.contains('low')!==low)el.parentNode.classList.toggle('low',low);
  });
};
G.play=confirmPend;
G.pass=()=>{};
G.keyPhase=st=>st==='play';
G.onKey=()=>false;
G.field3D=()=>{if(T.stacks)for(const arr of T.stacks.values())arr.forEach(c=>{c.visible=false})};
G.render3D=t=>{if(Bw3.on)bw3Render(t);else if(T.ok&&!$('#stage').classList.contains('bw2d'))T.r.render(T.scene,T.cam)};
G.enter=()=>{
  $('#stage').classList.add('bwg');
  $('#btnPass').hidden=true;$('#btnGura').hidden=true;$('#numpick').hidden=true;
  pend=-1;
};
G.leave=()=>{
  introEnd();
  $('#stage').classList.remove('bwg','bw-over','bw3d','bw2d');
  if(T.stacks)for(const arr of T.stacks.values())arr.forEach(c=>{c.visible=true});
  if(Bw3.root)Bw3.root.visible=false;Bw3.on=false;
  $('#btnPass').hidden=false;
  if(elBw){elBw.hidden=true;lastBar='';lastHint='';last2d=''}
};
/* 대기실 홀로그램의 대표 말: 엎은 흑 타일과 숫자가 보이는 백 타일 (공통 frontHoloPiece가 재질 만드는 함수를 줌) */
G.holoPiece=mk=>{
  const g=new THREE.Group();
  const nt=canvasTex(128,184,(x,w,h)=>{x.fillStyle='#fff';x.fillRect(0,0,w,h);x.fillStyle='#3a3a3e';x.font='700 112px "IBM Plex Mono", monospace';x.textAlign='center';x.textBaseline='middle';x.fillText('7',w/2,h/2+6)});
  const a=new THREE.Mesh(new THREE.BoxGeometry(.3,.43,.06),mk(0x2a2a2e));a.position.set(-.12,-.02,-.04);a.rotation.set(.15,.35,.12);g.add(a);
  const b=new THREE.Mesh(new THREE.BoxGeometry(.3,.43,.06),[mk(0xf1ebde),mk(0xf1ebde),mk(0xf1ebde),mk(0xf1ebde),mk(0xffffff,nt),mk(0xf1ebde)]);b.position.set(.13,.05,.05);b.rotation.set(-.1,-.3,-.1);g.add(b);
  return g;
};
G.init=()=>{
  const css=document.createElement('style');
  css.textContent=`
.stage.bwg{background:radial-gradient(ellipse at 50% 38%,#f3e4c2 0%,#e2c89a 70%,#d3b27c 100%)}
.stage.bwg.bw2d #cv,.stage.bwg #dim{visibility:hidden}
.stage.bw-intro .actions,.stage.bw-intro .myplate,.stage.bw-intro #bw .bw-row{opacity:0;pointer-events:none}
.stage.bwg .actions,.stage.bwg .myplate,#bw .bw-row,#bw .bw-bar,#bw .bw-mebar{transition:opacity .35s}
#bw.intro .bw-bar,#bw.intro .bw-mebar{opacity:0}
.stage.bw3d #bw .bw-2d{display:none}
.stage.bw3d #bw .bw-hint{flex:0 1 auto;background:rgba(255,250,240,.9);border:1px solid var(--line-strong,#cdb391);border-radius:99px;padding:4px 12px;box-shadow:0 2px 6px -2px rgba(59,42,31,.35)}
.stage.bwg .labels{visibility:hidden}
.stage.bwg .nogl{display:none}
.stage.bwg.bw-over .myplate,.stage.bwg.bw-over .actions{display:none}
.specbar:not([hidden])~#bw .bw-bar{margin-top:30px}
.stage.bwg .actions{left:auto}
.stage.bwg .myplate{max-width:calc(100% - 150px)}
#bw{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;gap:6px;padding:8px 10px 82px;pointer-events:none;min-height:0}
#bw[hidden]{display:none}
#bw .bw-bar{min-height:44px;display:flex;flex-wrap:wrap;justify-content:center;align-items:flex-start;align-content:flex-end;gap:6px;align-self:center;max-width:calc(100% - 188px);pointer-events:none}
#bw .bw-mebar{position:absolute;left:50%;bottom:var(--plateB,14px);transform:translateX(-50%);z-index:2;display:flex;pointer-events:none;max-width:calc(100% - 188px)}
#bw .bw-mebar:empty{display:none}
#bw .bw-p{position:relative;display:flex;align-items:center;gap:6px;padding:4px 10px 5px;border-radius:12px;background:rgba(255,250,240,.92);border:1.5px solid var(--line-strong,#cdb391);font-size:13px;line-height:1.15;white-space:nowrap;max-width:100%}
#bw .bw-p .dot{width:11px;height:11px;border-radius:50%;flex:none;display:inline-block;box-shadow:0 0 0 2px #fffaf0}
#bw .bw-p b{font-weight:600;overflow:hidden;text-overflow:ellipsis;max-width:8em}
#bw .bw-p .sc{font-family:var(--f-num,monospace);font-size:15px;font-weight:700;color:#3b2a1f;min-width:1.1em;text-align:center;background:#f2e2bf;border-radius:7px;padding:0 5px}
#bw .bw-p .w{font-family:var(--f-num,monospace);font-size:13px;font-weight:700;color:#5b4129;min-width:1.6em;text-align:right}
#bw .bw-p .w:empty{display:none}
#bw .bw-p.low .w{color:#c0281c;animation:bwBlink 1s steps(2,start) infinite}
@keyframes bwBlink{50%{opacity:.25}}
#bw .bw-p .st{font-size:12px;color:var(--muted,#7a6550)}
#bw .bw-p.on{border-color:#c08a17;box-shadow:0 0 0 2px #f2b632}
#bw .bw-row{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;pointer-events:none;min-height:44px}
.stage.bw3d #bw .bw-row{height:44px;min-height:0;flex:none;align-items:flex-start;padding-top:4px;position:relative;z-index:1;order:-1}
#bw .bw-hint:empty{visibility:hidden}
#bw .bw-hint{flex:1 1 200px;min-width:0;font-size:13px;line-height:1.3;color:#5b4129;text-align:center;min-height:17px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
#bw .bw-2d{flex:1;min-height:0;width:100%;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:18px;pointer-events:auto}
#bw .bw-row2{display:flex;gap:5px;justify-content:center;min-height:52px}
#bw .bw-rec2{display:flex;gap:4px;padding:8px;border-radius:10px;background:#6f4020}
#bw .bw-col{display:flex;flex-direction:column;gap:6px}
#bw .bw-t{width:30px;height:44px;border-radius:5px;display:inline-flex;align-items:center;justify-content:center;font:700 20px var(--f-num,monospace);border:2px solid #4a3020;box-sizing:border-box;padding:0}
#bw .bw-t.b{background:#2a2a2e;color:#f4efe3}
#bw .bw-t.w{background:#f1ebde;color:#26262a}
#bw .bw-t.e{background:rgba(0,0,0,.25);border-color:rgba(255,220,170,.25)}
#bw .bw-t.lit{box-shadow:0 0 0 3px #f2b632}
#bw .bw-t.lit.tie{box-shadow:0 0 0 3px #c9ced6}
#bw .bw-rec2 .bw-t{width:24px;height:35px;font-size:16px}
#bw button.bw-t{cursor:pointer;transition:transform .15s}
#bw button.bw-t.up{transform:translateY(-10px);box-shadow:0 0 0 3px #f2b632}
@media (max-width:520px){#bw .bw-p{font-size:12px;padding:3px 8px 4px}#bw .bw-t{width:28px;height:41px}#bw .bw-rec2 .bw-t{width:22px;height:32px;font-size:14px}}
.stage.bw3d #bw.lay .bw-bar{transform:translateY(calc(var(--bs) - 100%));transition:transform .35s,opacity .35s}
.stage.bw3d #bw.lay .bw-mebar{top:var(--mt);bottom:auto;transition:top .35s,opacity .35s}
.stage.bw3d .specbar:not([hidden])~#bw .bw-bar{margin-top:0}
.stage.bw3d .specbar:not([hidden])~#bw .bw-row{margin-top:30px}
.stage.bw3d #bw.wide .bw-row{position:absolute;left:16px;top:8px;width:auto;max-width:30%;justify-content:flex-start}
.stage.bw3d #bw.wide .bw-bar{min-height:0}
.stage.bw3d .specbar:not([hidden])~#bw.wide .bw-bar{margin-top:30px}
@media (max-width:699px){#bw{padding-bottom:112px}#bw .bw-mebar{bottom:70px;max-width:calc(100% - 24px)}}
`;
  document.head.appendChild(css);
  elBw=document.createElement('div');elBw.id='bw';elBw.hidden=true;
  elBw.innerHTML=`<div class="bw-bar"></div><div class="bw-mebar"></div><div class="bw-row"><div class="bw-hint" aria-live="polite"></div></div><div class="bw-2d"></div>`;
  $('#stage').insertBefore(elBw,$('#fx'));
  elBar=elBw.querySelector('.bw-bar');elBarMe=elBw.querySelector('.bw-mebar');elHint=elBw.querySelector('.bw-hint');el2d=elBw.querySelector('.bw-2d');
  el2d.addEventListener('click',e=>{const b=e.target.closest('button.bw-t');if(b)pickTile(+b.dataset.v)});
  document.addEventListener('keydown',e=>{if(e.code==='Escape'&&pend>=0&&elBw&&!elBw.hidden){pend=-1;redraw()}});
  window.addEventListener('resize',()=>{Bw3.lay=''});
  $('#cv').addEventListener('click',bw3Click);
};
G._bw3={Bw3,IN,introEnd,get pend(){return pend}};   // 화면 검사용

(window.GAMES=window.GAMES||{}).blackwhite=G;
})();
