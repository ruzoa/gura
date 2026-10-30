/* ===== 대부호 게임 모듈 =====
   공통 코드(index.html)가 GAMES.president의 함수를 불러서 이 게임의 규칙·봇·카드·화면을 그림.
   카드 id: 0~51 = 숫자 순번(0~12 = 3,4,…,K,A,2)*4 + 무늬(0~3 = ♦ ♣ ♥ ♠), 100·101 = 조커 (모든 숫자로 쓰는 와일드 카드)
   무늬는 강약과 상관없음. 색은 ♦♥ 빨강 / ♣♠ 남색 */
(function(){
const G={id:'president',name:'대부호',short:'대부호',lead:'계급이 오가는 카드게임',brand:'대부호',brandPx:50,dealAnim:true};   // dealAnim: 게임 시작 때 카드 섞고 나누는 연출

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
  if(rules.s3&&isS3Counter(ids,tk))return '';
  if(S.lock&&c.ty==='set'&&!subMulti(c.suits,S.lock))return '무늬 묶임';
  const eff=effRev(S),a=cmbKey(c,eff),b=cmbKey(tk,eff);
  if(a>b)return '';
  if(rules.skip&&a===b&&c.ty==='set'&&c.k!==JOKER_KEY)return '';   // 같은 숫자 건너뛰기: 같은 숫자도 낼 수 있고 다음 사람을 건너뜀
  return '더 강하게';
}
/* 스페이드 3 반격: 조커 한 장 위에 ♠3 한 장 */
const SPADE3=3;
const isS3Counter=(ids,tk)=>!!tk&&tk.ty==='set'&&tk.n===1&&tk.k===JOKER_KEY&&ids.length===1&&ids[0]===SPADE3;
/* 반칙 탈출: 마지막 카드에 조커·2(혁명 중엔 3)·8(8 끊기 켬)이 있거나 스페이드 3 반격으로 끝냄 */
function isFoulFinish(ids,S,rules){
  const top=effRev(S)?0:12;
  if(ids.some(isJ))return true;
  if(ids.some(id=>rkOf(id)===top))return true;
  if(rules.r8&&ids.some(id=>rkOf(id)===5))return true;
  if(rules.s3&&isS3Counter(ids,S.tk))return true;
  return false;
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
G.rulesHTML='<ol class="rules"><li><b>목표</b> : 손에 든 카드를 가장 먼저 털어낸 사람이 <b>대부호</b>, 마지막까지 남은 사람이 <b>대빈민</b>입니다</li><li><b>카드 강약</b> : 3 &lt; 4 &lt; … &lt; K &lt; A &lt; 2 &lt; <b>조커</b> (무늬는 강약과 상관없습니다)</li><li><b>시작</b> : ♦3을 가진 사람이 먼저 냅니다. 한 장도, 같은 숫자 여러 장도 낼 수 있습니다</li><li><b>진행</b> : 앞사람과 <b>같은 장수</b>로 더 강한 카드를 내거나 <b>패스</b>합니다</li><li><b>판 끝</b> : 모두가 연달아 패스하면 판이 끝나고, 마지막에 낸 사람이 새로 시작합니다</li><li><b>다음 판</b> : 대빈민은 가장 강한 카드를 대부호에게 주고 약한 카드를 돌려받습니다 (4명 이상이면 2장, 부호·빈민은 1장). 그다음 대빈민(서양 룰은 대부호)부터 시작합니다</li><li><b>룰 고르기</b> : 탁자 설정의 레버로 <b>서양 룰</b>(프레지던트: 조커·특수 규칙 없음)과 <b>일본 룰</b>(대부호: 조커 2장, 8 끊기·혁명·계단·묶기·11 백·스페이드 3 반격·반칙 탈출·도시오치)을 고릅니다. 세부 설정을 바꾸면 커스텀이 됩니다</li><li><b>조커</b> : 모든 숫자로 쓸 수 있는 와일드 카드이고, 혼자 내면 가장 강합니다</li></ol>';
G.modeDesc=['대빈민이 정해질 때까지','1등이 나오면 끝'];
/* 규칙 묶음: 레버로 고르는 서양 룰(프레지던트) / 일본 룰(대부호). 세부 설정을 바꾸면 레버가 가운데(커스텀)로 옴 */
const PRESETS=[
  {jokers:0,r8:0,rev:0,run:0,lock:0,b11:0,swap:1,dlead:0,stay:0,skip:0,s3:0,foul:0,miyako:0},
  {jokers:2,r8:1,rev:1,run:1,lock:1,b11:1,swap:1,dlead:1,stay:0,skip:0,s3:1,foul:1,miyako:1}];
const PKEYS=Object.keys(PRESETS[0]);
const PNAME=['서양 룰','일본 룰'];
const presetOf=c=>PRESETS.findIndex(P=>PKEYS.every(k=>(+c[k]||0)===P[k]));   // 0·1, 둘 다 아니면 -1(커스텀)
const baseOf=c=>{const p=presetOf(c);return p>=0?p:(+c.pb?1:0)};
const diffKeys=c=>{const P=PRESETS[baseOf(c)];return PKEYS.filter(k=>(+c[k]||0)!==P[k])};
G.defaults={grace:0,turn:30,rounds:3,...PRESETS[1],pb:1};
G.roomSet=[
  {k:'jokers',label:'조커',unit:'장',lo:0,hi:2,step:1,desc:'모든 숫자로 쓸 수 있는 와일드 카드. 혼자 내면 가장 강합니다'},
  {k:'rounds',label:'라운드',unit:'판',lo:1,hi:20,step:1,desc:'정한 라운드를 마치면 계급 점수 합계로 최종 순위를 정합니다. 대빈민 0점에서 한 계급씩 올라갑니다'},
  {k:'turn',label:'제한 시간',unit:'초',lo:5,hi:120,step:5,desc:'제한 시간이 지나면 패스 <br> 먼저 내는 차례면 가장 약한 카드가 자동으로 나갑니다'}];
/* 켜고 끄는 규칙 (방 설정의 세부 설정에서 보임. pb는 커스텀이 어느 룰에서 출발했는지만 기억) */
G.ruleSet=[
  {k:'r8',label:'8 끊기',off:'8 끊기 없음',desc:'8을 내면 그 판이 바로 끝나고 낸 사람이 다시 시작합니다'},
  {k:'rev',label:'혁명',off:'혁명 없음',desc:'같은 숫자 4장 이상을 내면 카드 강약이 뒤집힙니다 (한 번 더 나오면 원래대로)'},
  {k:'run',label:'계단',off:'계단 없음',desc:'같은 무늬의 연속된 숫자 3장 이상을 한 번에 냅니다'},
  {k:'lock',label:'묶기',off:'묶기 없음',desc:'같은 무늬 구성이 연달아 나오면 그 판은 그 무늬만 낼 수 있습니다'},
  {k:'b11',label:'11 백',off:'11 백 없음',desc:'J를 내면 그 판이 끝날 때까지 강약이 뒤집힙니다'},
  {k:'s3',label:'스페이드 3 반격',off:'스페이드 3 없음',desc:'조커 한 장은 ♠3 한 장으로 이길 수 있고, 그 판은 바로 끝납니다'},
  {k:'skip',label:'같은 숫자 건너뛰기',off:'건너뛰기 없음',desc:'앞사람과 같은 숫자를 같은 장수로 내면 다음 사람을 건너뜁니다'},
  {k:'stay',label:'패스하면 쉬기',off:'패스 뒤 다시 냄',desc:'패스한 사람은 그 판이 끝날 때까지 낼 수 없습니다. 끄면 차례가 다시 오면 낼 수 있습니다'},
  {k:'foul',label:'반칙 탈출',off:'반칙 탈출 없음',desc:'조커·2(혁명 중엔 3)·8로 마지막 카드를 내면 꼴찌가 됩니다'},
  {k:'swap',label:'계급 카드 교환',off:'교환 없음',desc:'다음 판 시작 전에 대빈민의 강한 카드와 대부호의 약한 카드를 맞바꿉니다'},
  {k:'miyako',label:'도시오치',off:'도시오치 없음',desc:'지난 판 대부호가 1등을 놓치면 바로 대빈민이 됩니다 (4명 이상)'},
  {k:'dlead',label:'다음 판 선',desc:'계급이 이어지는 판에서 누가 먼저 시작할지 정합니다'},
  {k:'pb',label:'',hidden:true,desc:''}];
const RULE=Object.fromEntries(G.ruleSet.map(d=>[d.k,d]));
/* 바뀐 항목 이름: '대부호 시작', '8 끊기 없음', '조커 1장', '스페이드 3 반격' */
function diffLabel(k,c){
  const v=+c[k]||0;
  if(k==='jokers')return `조커 ${v}장`;
  if(k==='dlead')return v?'대빈민 시작':'대부호 시작';
  return v?RULE[k].label:RULE[k].off;
}
/* 대기실 요약: '일본 룰 · 대부호 시작 · 8 끊기 없음' (바뀐 항목은 색으로) */
function ruleLine(c){
  const df=diffKeys(c).filter(k=>k!=='jokers');
  return `<b>${PNAME[baseOf(c)]}</b>${df.map(k=>` · <b class="pdiff">${esc(diffLabel(k,c))}</b>`).join('')}`;
}
const jkTxt=c=>{const d=diffKeys(c).includes('jokers');return `${d?'<b class="pdiff">':''}조커 ${+c.jokers||0}장${d?'</b>':''}`};
G.cfgChips=c=>`<span class="chip">${jkTxt(c)}</span><span class="chip"><b>${+c.rounds||1}라운드</b></span><span class="chip">제한 시간 <b>${+c.turn}초</b></span><span class="chip">규칙 ${ruleLine(c)}</span>`;
G.cfgSum=c=>`${jkTxt(c)} · ${+c.rounds||1}라운드 · 제한 시간 ${+c.turn}초<br>규칙: ${ruleLine(c)}`;
/* ---------- 방 설정의 룰 레버 (공통 코드가 G.settingsHTML·G.panelAct로 부름) ----------
   왼쪽 서양 룰 · 가운데 커스텀 · 오른쪽 일본 룰. 세부 설정은 펼쳐서 바꾸고, 출발한 룰과 다른 줄은 머스터드 색 + 원래 값 */
const CUS_KEY='gura-president-custom',MORE_KEY='gura-president-more';
let MORE=null,LASTLV=-1;   // MORE: 세부 설정 펼침 (공통 코드가 읽힌 뒤 처음 쓸 때 저장값을 읽음)
const isMore=()=>MORE==null?(MORE=store(MORE_KEY)==='1'):MORE;
const pickCfg=c=>{const o={};for(const k of PKEYS)o[k]=+c[k]||0;o.pb=+c.pb?1:0;return o};
function loadCustom(){
  try{const sv=JSON.parse(store(CUS_KEY)||'null');if(!sv)return null;const o=pickCfg(sv);o.jokers=Math.max(0,Math.min(2,Math.round(o.jokers)));for(const k of PKEYS)if(k!=='jokers')o[k]=o[k]?1:0;return presetOf(o)<0?o:null}catch(e){return null}
}
G.settingsHTML=(c,{stepRow})=>{
  const rs=roomSetOf(G),pos=presetOf(c),base=baseOf(c),P=PRESETS[base],df=new Set(diffKeys(c));
  if(pos<0)store(CUS_KEY,JSON.stringify(pickCfg(c)));   // 커스텀은 늘 기억해 둠 (레버를 옮겼다 돌아오면 그대로)
  const note=k=>df.has(k)?`<em class="pd-note">${PNAME[base]}: ${k==='jokers'?P[k]+'장':k==='dlead'?(P[k]?'대빈민':'대부호'):(P[k]?'켬':'끔')}</em>`:'';
  const lv=pos===0?0:pos===1?2:1;   // 레버 칸: 0 왼쪽, 1 가운데, 2 오른쪽
  const from=LASTLV<0?lv:LASTLV;LASTLV=lv;
  const opts=[[0,'프레지던트','서양 룰'],[2,'커스텀',pos<0?`${PNAME[base]} 기반`:'세부 설정'],[1,'대부호','일본 룰']];
  const lever=`<div class="plever" role="radiogroup" aria-label="규칙"><i class="pl-knob" style="--p:${lv};--f:${from}"></i>${opts.map(([v,t,sm],k)=>`<button type="button" role="radio" aria-checked="${lv===k}" class="pl-o${lv===k?' on':''}" data-act="pr:${v}"><b>${t}</b><small>${sm}</small></button>`).join('')}</div>`;
  const open=isMore();
  const more=`<button type="button" class="pl-more" data-act="prmore" aria-expanded="${open}">세부 설정 ${open?'접기':'펼치기'}<span aria-hidden="true">${open?'▴':'▾'}</span></button>`;
  let det='';
  if(open){
    const jd=rs.find(d=>d.k==='jokers');
    const jk=stepRow(jd).replace('<div class="stp">',`<div class="stp${df.has('jokers')?' pdiff-row':''}">`).replace(`<b>${jd.label}</b>`,`<b>${jd.label}</b>${note('jokers')}`);
    const dl=+c.dlead?1:0;
    const lead=`<div class="stp pl-lead${df.has('dlead')?' pdiff-row':''}"><div class="stp-t"><b>다음 판 선</b>${note('dlead')}<small>${RULE.dlead.desc}</small></div><div class="segrow">${[[0,'대부호'],[1,'대빈민']].map(([v,t])=>`<button class="btn ${dl===v?'btn-play':'btn-sub'}" type="button" role="radio" aria-checked="${dl===v}" data-act="pset:dlead:${v}">${t}</button>`).join('')}</div></div>`;
    const tgs=G.ruleSet.filter(d=>!d.hidden&&d.k!=='dlead').map(d=>{const on=!!(+c[d.k]);return `<div class="stp tg${df.has(d.k)?' pdiff-row':''}"><div class="stp-t"><b>${d.label}</b>${note(d.k)}<small>${d.desc}</small></div><div class="stp-c"><button type="button" class="sw${on?' on':''}" role="switch" aria-checked="${on}" aria-label="${d.label}" data-act="tog:${d.k}"><i></i></button></div></div>`}).join('');
    det=`<div class="pl-det"><div class="rs-grid">${jk}${lead}</div><div class="rs-grid tgs">${tgs}</div></div>`;
  }
  return `<div class="rs-grid">${rs.filter(d=>d.k!=='jokers').map(stepRow).join('')}</div><div class="rulehead">게임 규칙</div>${lever}<p class="pl-sum">${ruleLine(c)}</p>${more}${det}`;
};
G.panelAct=a=>{
  if(a==='again'&&mode==='host'&&H&&H.phase==='over'){clearSet();return false}   // 대기실로 가면 계급·점수 초기화 (바로 시작은 유지). 이어서 공통 코드가 대기실로 보냄
  if(a==='rankreset'){
    if(mode==='host'&&H&&(H.phase==='wait'||H.phase==='over')&&H.lastRanks&&confirm('계급과 점수를 초기화할까요?\n다음 판은 카드 교환 없이 ♦3을 가진 사람부터 시작합니다.')){clearSet();addLog('방장이 계급을 초기화했습니다.','sys');sfx('tick');lastPanelHtml='';mark()}
    return true;
  }
  if(a==='prmore'){MORE=!isMore();store(MORE_KEY,MORE?'1':'0');lastPanelHtml='';renderPanel();return true}
  if(!a.startsWith('pr:')&&!a.startsWith('pset:'))return false;
  if(!(mode==='host'&&H&&H.phase==='wait'))return true;
  const cur=presetOf(H.cfg);
  if(a.startsWith('pr:')){
    const v=+a.slice(3);
    if(v===2){   // 커스텀: 기억해 둔 커스텀이 있으면 되살리고, 없으면 세부 설정을 펼쳐 줌
      MORE=true;store(MORE_KEY,'1');
      const sv=cur<0?null:loadCustom();if(sv)H.cfg={...H.cfg,...sv};
    }else{
      if(cur===v){lastPanelHtml='';renderPanel();return true}
      if(cur<0)store(CUS_KEY,JSON.stringify(pickCfg(H.cfg)));
      H.cfg={...H.cfg,...PRESETS[v],pb:v};
    }
  }else{const [,k,v]=a.split(':');if(!PKEYS.includes(k))return true;H.cfg={...H.cfg,[k]:+v?1:0}}
  saveRoomCfg(H.cfg);sfx('tick');lastPanelHtml='';mark();return true;
};
/* 나무판 '세부 설정' 항목 (공통 코드가 G.boardSet으로 그림). 맨 위 룰 레버 → 아래 규칙이 한꺼번에 바뀜. 누르면 act가 돌려준 패널 동작을 G.panelAct·toggleRule로 */
G.boardSet=c=>{
  const pos=presetOf(c),lv=pos===0?0:pos===1?2:1,df=new Set(diffKeys(c));
  return [{kind:'choice',k:'preset',label:'규칙',opts:['프레지던트','커스텀','대부호'],desc:'왼쪽 서양 룰 · 가운데 커스텀 · 오른쪽 일본 룰. 룰을 고르면 아래 규칙이 그 룰대로 바뀌고, 아래 규칙을 바꾸면 커스텀이 됩니다',v:lv,act:o=>'pr:'+[0,2,1][o]},
    ...G.ruleSet.filter(d=>!d.hidden&&d.k!=='dlead').map(d=>({kind:'tog',k:d.k,label:d.label,desc:d.desc,v:+c[d.k]?1:0,diff:df.has(d.k),act:()=>'tog:'+d.k})),
    {kind:'choice',k:'dlead',label:'다음 판 선',opts:['대부호','대빈민'],desc:RULE.dlead.desc,v:+c.dlead?1:0,diff:df.has('dlead'),act:o=>'pset:dlead:'+o}];
};
G.roomSub=x=>`조커 ${x.jk}장`;
G.pubExtra=()=>({});
G.cardInfo=(c,nowN)=>{
  const total=52+(+c.jokers||0),perNow=Math.floor(total/nowN),perFull=Math.floor(total/Math.max(2,+c.max));
  return `<p class="cardinfo">카드 ${total}장 · 지금 ${nowN}명이면 1인당 약 ${perNow}장${+c.max>nowN?` · ${+c.max}명이 다 차면 약 ${perFull}장`:''}${+c.max>=7?'<br>7~8명 탁자는 제한 시간 20초 정도로 짧게 하면 덜 지루합니다.':''}</p>`;
};
G.finLabel=(r,n)=>rankTitle(r,n);
G.noEmotes=[];
G.keys={};
G.keyActions=[];

/* ---------- 방장 엔진 (규칙 처리) ---------- */
const stateH=()=>({tk:H.tk,rev:H.rev,b11:H.b11,lock:H.lock});
/* 계급 순서 (자리 번호, 1위부터): 지난 판 계급이 있는 사람은 그 순서대로 당겨 앉고(나간 사람 자리는 없어짐),
   새로 온 사람(봇 포함)은 들어온 순서대로 맨 아래. 지난 판 계급이 하나도 없으면 null */
function rankOrder(names){
  const lr=H.lastRanks;if(!lr||names.length<2)return null;
  const ranked=names.map((n,i)=>i).filter(i=>lr[names[i]]>0).sort((a,b)=>lr[names[a]]-lr[names[b]]||a-b);
  if(!ranked.length)return null;
  return [...ranked,...names.map((n,i)=>i).filter(i=>!(lr[names[i]]>0))];
}
const rankIdx=()=>rankOrder(H.players.map(p=>p.name));
/* 탁자를 나간 사람의 계급·점수 지우기. 끊긴 사람은 유지: 대기실에선 H.members에 away로 남고,
   게임 중·결과 화면에선 H.members에서 빠져도 H.players에 away로 남음('탁자 떠나기'로 판 중에 나가면 dzWhy 'out'이라 지움).
   끊긴 채로 다음 판이 시작되면 그 판 자리에서 빠지므로 그때 지워짐 */
function dropGone(){
  const keep=n=>H.members.some(m=>m.name===n)||(H.phase!=='wait'&&(H.players||[]).some(p=>p.name===n&&p.away&&p.dzWhy!=='out'));
  const gone=o=>{if(o)for(const n in o)if(!keep(n))delete o[n]};
  gone(H.lastRanks);gone(H.scores);
  if(H.lastRanks&&!Object.keys(H.lastRanks).length)H.lastRanks=null;
  if(H.scores&&!Object.keys(H.scores).length)H.scores=null;
}
function doExchange(idx){
  idx=idx||rankIdx();const n=H.players.length;H.xc=[];
  if(!H.cfg.swap||!idx)return null;
  const pairs=n>=4?[[n-1,0,2],[n-2,1,1]]:[[n-1,0,1]];
  for(const [lo,hi,k] of pairs){
    const g=H.players[idx[lo]],t=H.players[idx[hi]];
    g.hand.sort(cmpCard);t.hand.sort(cmpCard);
    const give=g.hand.splice(g.hand.length-k,k),back=t.hand.splice(0,k);
    t.hand.push(...give);g.hand.push(...back);t.got=give.slice();g.got=back.slice();t.gave=back.slice();g.gave=give.slice();
    H.xc.push([idx[lo],idx[hi],k]);   // 교환 연출용: [대빈민·빈민 자리, 대부호·부호 자리, 장수]
    addLog(`교환: ${g.name} → ${t.name} 강한 카드 ${k}장, ${t.name} → ${g.name} 약한 카드 ${k}장`,'sys');
  }
  return idx[n-1];
}
/* 패스하면 쉬기(stay): 이번 판에 패스한 사람은 판이 끝날 때까지 차례가 오지 않음 */
const sitting=j=>!!(H.cfg.stay&&H.out&&H.out[j]);
function nextTurn(i){const n=H.players.length;for(let k=1;k<=n;k++){const j=(i+k)%n;if(isActive(j)&&!sitting(j))return j}return -1}
function newTrick(st){
  H.tk=null;H.tkP=-1;H.lock=null;H.b11=false;H.passes=0;H.seatNote={};H.out={};H.graceUntil=0;
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
  if(H.cfg.stay)return !H.players.some((p,j)=>isActive(j)&&j!==H.tkP&&!sitting(j));   // 낸 사람 말고는 모두 쉬는 중
  const act=H.players.filter((p,j)=>isActive(j)).length;
  const need=act-(H.tkP>=0&&isActive(H.tkP)?1:0);   // 마지막으로 낸 사람을 뺀 나머지가 연달아 패스
  return H.passes>=need;
}
function endTrick(){
  const st=isActive(H.tkP)?H.tkP:nextActive(H.tkP);
  addLog('모두 패스. 판이 끝났습니다.','sys');
  newTrick(st);
}
/* 판 안에서 다음 차례로: 낸 사람 말고는 아무도 받을 수 없으면 판이 끝남 */
function goNext(i,skip){
  let nx=nextTurn(i);
  if(skip&&nx>=0&&nx!==i){addLog(`${H.players[nx].name} 건너뜀`,'sys');nx=nextTurn(nx)}
  if(H.tk&&(nx<0||nx===H.tkP)){endTrick();return}   // 한 바퀴 돌아 낸 사람에게 다시 오면(모두 패스·쉬는 중·건너뜀) 판 끝
  startTurn(nx>=0?nx:nextActive(i));
}
/* 판 도중 자리를 비우게 될 때(항복·도시오치): 그 사람이 낸 패스는 빼야 남은 사람이 모두 대답하기 전에 판이 끝나지 않음 */
function leaveTrick(j){
  if(H.seatNote[j]&&!H.cfg.stay)H.passes=Math.max(0,H.passes-1);
  delete H.seatNote[j];if(H.out)delete H.out[j];
}
function doPlay(i,ids){
  if(H.phase!=='play')return;
  const p=H.players[i],c=parseCombo(ids,H.cfg);if(!c)return;
  const set=new Set(ids);p.hand=p.hand.filter(id=>!set.has(id));
  const prev=H.tk,S0=stateH(),eff0=effRev(S0);
  const s3=!!(H.cfg.s3&&isS3Counter(ids,prev));
  const skip=!!(H.cfg.skip&&prev&&!s3&&c.ty==='set'&&prev.ty==='set'&&c.k!==JOKER_KEY&&cmbKey(c,eff0)===cmbKey(prev,eff0));
  const foul=!p.hand.length&&!!H.cfg.foul&&isFoulFinish(ids,S0,H.cfg);
  // 묶기: 같은 무늬 구성이 연달아 나오면 그 무늬로 묶임
  if(H.cfg.lock&&!H.lock&&prev&&c.ty==='set'&&prev.ty==='set'&&!c.jk&&!prev.jk&&c.suits.slice().sort().join()===prev.suits.slice().sort().join()){
    H.lock=c.suits.slice();addLog(`묶기! ${c.suits.map(s=>SUITS[s]).join('')} 무늬만 낼 수 있습니다.`,'sp');
  }
  H.tk={...c,ids:ids.slice()};H.tkP=i;H.passes=0;
  H.seatNote={};if(H.cfg.stay)for(const j in (H.out||{}))H.seatNote[j]='쉬는 중';
  H.lp={p:i,ids:ids.slice(),sq:(H.lp?H.lp.sq:0)+1};
  addLog(`${p.name}: ${comboStr(ids)}`);
  let cut=false;
  if(s3){cut=true;addLog('스페이드 3 반격! 조커를 이겼습니다.','sp')}
  if(c.ty==='set'&&c.k!==JOKER_KEY){
    if(H.cfg.rev&&c.n>=4){H.rev=!H.rev;addLog(H.rev?'혁명! 카드 강약이 뒤집힙니다.':'혁명! 카드 강약이 원래대로 돌아옵니다.','sp')}
    if(H.cfg.b11&&c.k===8){H.b11=!H.b11;addLog(H.b11?'11 백! 이 판 동안 강약이 뒤집힙니다.':'11 백! 강약이 원래대로 돌아옵니다.','sp')}
    if(H.cfg.r8&&c.k===5){cut=true;addLog('8 끊기! 판이 바로 끝납니다.','sp')}
  }
  if(!p.hand.length){
    if(foul){p.finished=true;p.fouled=true;p.rank=H.rankBottom--;addLog(`반칙 탈출! ${p.name} 님은 조커·2·8 같은 카드로 끝내서 ${p.rank}위입니다.`,'sp');checkEnd()}
    else finish(i);
    if(H.phase==='over')return;
  }
  if(cut){newTrick(isActive(i)?i:nextActive(i));return}
  goNext(i,skip);
}
function doPass(i,auto){
  if(H.phase!=='play'||!H.tk)return;
  H.passes++;H.out=H.out||{};H.out[i]=1;
  H.seatNote[i]=auto?'시간 초과':(H.cfg.stay?'쉬는 중':'패스');
  addLog(`${H.players[i].name} ${auto?'시간 초과 ':''}패스`,'sys');
  if(trickDone()){endTrick();return}
  goNext(i,false);
}
function finish(i){
  const p=H.players[i];p.finished=true;p.rank=H.rankNext++;addLog(`${p.name} 탈출! ${p.rank}위`,'fin');
  // 도시오치: 지난 판 대부호가 1등을 놓치면 바로 대빈민 (4명 이상)
  if(p.rank===1&&H.cfg.miyako&&H.players.length>=4&&H.prevTop&&H.prevTop!==p.name){
    const j=H.players.findIndex(x=>x.name===H.prevTop);
    if(j>=0&&isActive(j)){const q=H.players[j];leaveTrick(j);q.hand=[];q.finished=true;q.fell=true;q.rank=H.rankBottom--;addLog(`도시오치! ${q.name} 님이 대부호 자리를 지키지 못해 ${q.rank}위로 떨어집니다.`,'sp')}
  }
  if(H.cfg.fast&&p.rank===1){
    // 빠른 모드: 1등이 나오면 끝, 나머지는 남은 카드가 적을수록 높은 순위.
    // 계급이 다음 판으로 이어지므로 공동 순위 없이: 장수가 같으면 남은 카드가 더 강한 사람, 그것도 같으면 1등 다음 차례에 가까운 사람이 위
    const eff=effRev(stateH()),n=H.players.length;
    const pow=x=>x.hand.reduce((a,id)=>a+(isJ(id)?20:skey(rkOf(id),eff)),0);
    const dist=x=>(H.players.indexOf(x)-i+n)%n;
    const rest=H.players.filter(x=>!x.finished).sort((a,b)=>a.hand.length-b.hand.length||pow(b)-pow(a)||dist(a)-dist(b));
    rest.forEach((x,k)=>{x.rank=H.rankNext+k;x.finished=true});
    addLog('빠른 모드: 1등이 나와서 게임이 끝났습니다.','sys');endGame();return;
  }
  checkEnd();
}
function doSurrender(i){
  if(H.phase!=='play'||i<0||!isActive(i))return;
  const p=H.players[i];
  leaveTrick(i);
  p.hand=[];p.finished=true;p.surrendered=true;p.rank=H.rankBottom--;
  addLog(`${p.name} ${p.deserter?'탈주':'항복'}! ${p.rank}위`,'lie');
  const act=H.players.filter(x=>!x.finished);
  if(act.length<=1){checkEnd();return}
  if(H.tk&&trickDone()){endTrick();return}
  if(H.turn===i)goNext(i,false);else mark();
}
/* 라운드 점수: 대빈민 0점에서 한 계급씩 올라감 (n명이면 1위 n-1점). 이름으로 쌓아 다시 하기·재접속에도 이어짐 */
function addScores(){
  const n=H.players.length;H.scores=H.scores||{};
  H.players.forEach(p=>{H.scores[p.name]=(H.scores[p.name]||0)+Math.max(0,n-(p.rank||n))});
  H.setDone=(H.roundNo||1)>=Math.max(1,+H.cfg.rounds||1);
}
/* 계급·점수·라운드를 처음으로 (나가기·대기실로 가기·계급 초기화) */
function clearSet(){H.lastRanks=null;H.scores=null;H.roundNo=0;H.setDone=false}
function endGame(){
  H.phase='over';
  H.lastRanks={};H.players.forEach(p=>{H.lastRanks[p.name]=p.rank});
  addScores();
  if(H.setDone)addLog(`${H.roundNo}라운드를 모두 마쳤습니다.`,'sys');
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
  const foulOK=m=>!(rules.foul&&m.length===h.length&&isFoulFinish(m,S,rules));
  const fin=mv.find(m=>m.length===h.length&&foulOK(m));   // 한 번에 다 털 수 있으면 무조건 (반칙 탈출이면 빼고)
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
    if(!foulOK(ids))s+=60;                                       // 반칙 탈출은 정말 낼 게 없을 때만
    else if(rules.foul&&lv>=1){const left=h.filter(x=>!ids.includes(x));if(left.length&&left.every(x=>isFoulFinish([x],{...S,tk:null},rules)))s+=lv===2?6:3}   // 남는 카드가 전부 반칙 카드면 피함
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
  if(!lead&&!foulOK(pk.ids)){doPass(i);return}   // 이어 낼 차례면 반칙 탈출 대신 패스
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
/* 카드 나누기 뒤 교환 연출 시간: 교환이 있는 판만 (방장이 그동안 제한 시간·봇을 멈춤) */
const XMS=2100;
G.dealExtra=()=>H.xc&&H.xc.length?XMS:0;
G._test={newTrick,doPlay,doPass,doSurrender,botTurn,stateH,cardStr,doExchange,isFoulFinish,presetOf,diffKeys,PRESETS};
G.engine={
  /* 게임 시작: 공통 코드가 H.players를 만든 뒤 부름 */
  start(){
    const n=H.players.length;
    if(H.setDone){H.scores=null;H.roundNo=0;H.setDone=false}   // 정한 라운드를 마친 뒤 다시 하면 점수·라운드만 새로 (계급은 이어짐)
    const deck=shuffle([...Array(52).keys(),...Array(H.cfg.jokers).fill(0).map((_,k)=>JOKER_BASE+k)]),per=Math.floor(deck.length/n);
    H.players.forEach(p=>p.hand=deck.splice(0,per));
    const order=shuffle([...Array(n).keys()]);let k=0;while(deck.length)H.players[order[k++]].hand.push(deck.pop());
    Object.assign(H,{phase:'play',xc:[],log:[],seatNote:{},lp:null,tk:null,tkP:-1,lock:null,rev:false,b11:false,passes:0,rankNext:1,rankBottom:n,graceUntil:0,roundNo:(H.roundNo||0)+1});
    addLog(`${n}명 ${H.roundNo}/${Math.max(1,+H.cfg.rounds||1)}라운드 시작${H.cfg.jokers?` (조커 ${H.cfg.jokers}장)`:''}.`,'sys');
    // 첫 판(또는 계급이 없는 사람이 있으면)은 ♦3을 가진 사람부터. 계급이 이어지면 교환 뒤 대빈민(또는 대부호)부터
    let first=H.players.findIndex(p=>p.hand.includes(0));
    const idx=rankIdx();
    H.prevTop=idx?H.players[idx[0]].name:'';H.out={};
    H.players.forEach(p=>{p.pr=0});
    if(idx){
      idx.forEach((j,k)=>{H.players[j].pr=k+1});
      addLog('지난 판 계급을 이어서 합니다.','sys');
      const nw=H.players.filter(p=>!(H.lastRanks[p.name]>0)).map(p=>p.name);
      if(nw.length)addLog(`새로 온 ${nw.join(', ')} 님은 맨 아래 계급부터 시작합니다.`,'sys');
      doExchange(idx);first=H.cfg.dlead?idx[n-1]:idx[0];
    }
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
    if(me&&me.gave&&s.ps[you])s.ps[you].gv=me.gave.slice();   // 내가 준 카드 (나만 봄)
    if(H.xc&&H.xc.length)s.xc=H.xc.map(x=>x.slice());   // 누가 누구에게 몇 장 (모두 봄, 카드는 비공개)
    H.players.forEach((p,i)=>{const o=s.ps[i];if(!o)return;if(p.pr)o.pr=p.pr;if(p.fouled)o.fo=1;else if(p.fell)o.fo=2});
    s.rk=H.lastRanks?1:0;s.rt=Math.max(1,+H.cfg.rounds||1);s.sd=H.setDone?1:0;
    if(H.phase==='over')dropGone();
    H.players.forEach((p,i)=>{const o=s.ps[i];if(o)o.sc=(H.scores&&H.scores[p.name])||0});
  },
  restore(){},
  emoPhase:ph=>ph==='play'||ph==='over',
  /* 다른 게임에서 바뀌어 올 때: 지난 판 계급은 새로 */
  /* 대기실: 다음 판에 받을 계급 (나간 사람은 빠지고, 새로 온 사람은 맨 아래) */
  waitSnap(s){
    dropGone();   // 나간 사람의 계급·점수는 지움 → 같은 이름으로 새로 들어와도(봇 이름 재사용 등) 맨 아래부터
    s.rk=H.lastRanks?1:0;
    const ord=rankOrder(H.members.map(m=>m.name));
    if(ord)ord.forEach((j,k)=>{if(s.ps[j])s.ps[j].pr=k+1});
  },
  reset(){clearSet()}
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
/* ---------- 계급 카드 교환 연출 ----------
   카드 나누기가 끝나 손패를 펼친 뒤(dealExtra 동안): 먼저 대빈민·빈민의 강한 카드가 대부호·부호에게 날아가고, 이어서 약한 카드가 돌아옴.
   모두에게 누가 누구에게 몇 장 주는지 보이고(뒷면), 카드 앞면은 주고받는 당사자에게만 (내가 준 카드는 내 앞에서 앞면으로 떠나며 뒤집히고, 받는 카드는 날아오며 앞면으로 뒤집힘).
   받는 카드 자리는 손패에서 비워 뒀다가 도착하면 채우고 노란 테두리(받은 카드) */
const XL={wait:200,leg:900,fly:680,gap:110};   // 첫 출발, 두 번째 묶음 출발(첫 묶음 기준), 날아가는 시간, 같은 묶음 카드 사이 간격
const XIN=new Set();let XA=null;
function xchStop(){if(!XA)return;if(XA.raf)cancelAnimationFrame(XA.raf);for(const f of XA.fl)if(f.g)killCard(f.g);XA=null;XIN.clear()}
function xchStart(v){
  xchStop();
  const mi=myIdx(),mp=mi>=0?v.ps[mi]:null,got=mp&&Array.isArray(mp.g)?mp.g.slice():[],gave=mp&&Array.isArray(mp.gv)?mp.gv.slice():[];
  const xc=Array.isArray(v.xc)?v.xc:[],left=+v.dk||0;
  // 늦게 들어왔거나 연출을 볼 수 없으면: 받은 카드 표시만
  if(!xc.length||left<XMS-200){if(got.length)showTaken(got);return}
  const t0=clock()+left-XMS;   // 카드 나누기가 끝나는 때
  const fl=[];
  xc.forEach(([lo,hi,k],pi)=>{
    for(let j=0;j<k;j++){
      // 1) 강한 카드: lo → hi, 2) 약한 카드: hi → lo
      fl.push({from:lo,to:hi,at:XL.wait+pi*40+j*XL.gap,id:lo===mi?gave[j]:hi===mi?got[j]:null});
      fl.push({from:hi,to:lo,at:XL.wait+XL.leg+pi*40+j*XL.gap,id:hi===mi?gave[j]:lo===mi?got[j]:null});
    }
  });
  got.forEach(id=>XIN.add(id));
  XA={rd:v.rd,t0,fl,got};
  renderMe();
  const step=()=>{
    if(!XA)return;
    if(!V||!V.ps||V.st!=='play'||V.rd!==XA.rd){xchStop();if(V)renderMe();return}
    const a=clock()-XA.t0;
    for(const f of XA.fl)xchFly(f,a,mi);
    if(a>=XMS){const g=XA.got;xchStop();renderMe();if(g.length){newCards=new Set(g);markNewCards()}return}
    XA.raf=requestAnimationFrame(step);
  };
  XA.raf=requestAnimationFrame(step);
}
const angWrap=d=>{while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;return d};
function xchEnd(i,mi){   // 자리의 카드 위치와 방향: 내 자리는 손패 앞(앞면이 나를 봄), 다른 사람은 그 사람 카드 더미 위(뒷면)
  if(i===mi){const p=nearMe();return {x:p.x,y:p.y,z:p.z,rx:-1.3,ry:0}}
  const p=seatPos(i,3.85);return {x:p.x,y:.32,z:p.z,rx:Math.PI/2,ry:seatAngle(i)};
}
function xchFly(f,a,mi){
  const u0=(a-f.at)/XL.fly;
  if(u0<0){if(f.g)f.g.visible=false;return}
  if(!f.sent){f.sent=1;sfx('cut')}
  if(u0>=1){
    if(f.g){killCard(f.g);f.g=null}
    if(!f.done){f.done=1;if(f.to===mi){if(f.id!=null)XIN.delete(f.id);renderMe();if(f.id!=null){newCards.add(f.id);markNewCards()}sfx('pick')}else sfx('flick')}
    return;
  }
  if(!T.ok)return;
  const A=xchEnd(f.from,mi),B=xchEnd(f.to,mi);
  if(!f.g){
    f.g=makeCard(new THREE.Vector3(A.x,A.y,A.z),A.rx,A.ry,.8);f.g.userData.man=true;f.g.renderOrder=3;
    if(f.id!=null)f.g.children[0].material=faceMat(f.id);   // 앞면은 당사자만
  }
  const u=smooth(u0),e=eOut(u0);
  const x=bez(A.x,(A.x+B.x)/2,B.x,e),z=bez(A.z,(A.z+B.z)/2,B.z,e),y=bez(A.y,Math.max(A.y,B.y)+1.1,B.y,u);
  // 뒤집기: 내가 준 카드는 떠나자마자 뒷면으로(상대 쪽에서 앞면이 보이지 않게), 내가 받는 카드는 다가오며 앞면으로, 나머지는 뒷면 그대로
  const w=f.from===mi?smooth((u0-.08)/.35):f.to===mi?smooth((u0-.45)/.45):smooth(u0),rx=A.rx+(B.rx-A.rx)*w,ry=A.ry+angWrap(B.ry-A.ry)*u;
  const s=(f.from===mi?1.1:.8)+((f.to===mi?1.1:.8)-(f.from===mi?1.1:.8))*u;
  f.g.visible=true;setPose(f.g,x,y,z,rx,ry,0,s);
}
G.postView=()=>{
  try{BG.sync(V)}catch(e){}
  // 새 판에 계급 카드 교환으로 받은 카드는 노란 테두리로 표시 (마우스를 올리거나 눌러 보면 사라짐)
  const mi=myIdx();
  if(V.st==='play'&&(!PV||PV.st!=='play'||PV.rd!==V.rd))xchStart(V);
};
G.logCue=(txt,cls)=>{
  if(cls==='sp'){if(txt.startsWith('혁명'))BG.kick=true;sfx('special');showSpecial((txt.match(/^[^!]*!/)||[txt])[0]);return true}
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
    h+=`<span class="rb">${+V.rd||1} / ${+V.rt||1} 라운드</span>`;
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
  for(const el of hand.children){const id=+el.dataset.id,s=sel.has(id);el.classList.toggle('xin',XIN.has(id));el.classList.toggle('match',combo?(!s&&combo.has(id)):!!(playable&&playable.has(id)));el.classList.toggle('combo',!!(combo&&!s&&combo.has(id)));el.classList.toggle('faded',!!(combo&&!s&&!combo.has(id)))}
};
/* 계급 배지 (대부호·부호·평민·빈민·대빈민) */
const RT_CLS={'대부호':'r1','부호':'r2','평민':'r3','빈민':'r4','대빈민':'r5'};
function rankTag(r,n){if(!(r>0))return '';const t=rankTitle(r,n);return `<span class="rtag ${RT_CLS[t]||''}">${t}</span>`}
G.nameTag=p=>p&&p.pr&&!p.f?rankTag(p.pr,V.ps.length):'';
G.me=()=>{};
/* 결과 화면: 지난 판 계급 → 이번 계급 (▲ 올라감, ▼ 내려감) */
G.overRank=p=>{
  const n=V.ps.length,t=rankTitle(p.f,n),was=p.pr?rankTitle(p.pr,n):'';
  const why=p.sr?(p.sr===2?'시간 초과':p.sr===3?'탈주':'항복'):p.fo===1?'반칙 탈출':p.fo===2?'도시오치':'';
  const mv=p.pr?(p.f<p.pr?' <b class="up">▲</b>':p.f>p.pr?' <b class="dn">▼</b>':''):'';
  const pt=Math.max(0,n-p.f);
  return `<span class="left">${why?why+' · ':''}${was&&was!==t?`<s>${was}</s> → `:''}${t}${mv} · +${pt}점 (합계 ${+p.sc||0})</span>`;
};
const leadTxt=()=>+V.cfg.dlead?'대빈민':'대부호';
G.waitExtra=isHost=>V.rk?`<p class="rk-note">지난 판 계급을 이어서 합니다. 교환 뒤 ${leadTxt()}부터 시작하고, 새로 온 사람은 맨 아래 계급입니다.${isHost?' <button type="button" class="linkbtn" data-act="rankreset">계급 초기화</button>':''}</p>`:'';
const finalRows=()=>{
  const l=V.ps.map(p=>({n:p.n,sc:+p.sc||0})).sort((a,b)=>b.sc-a.sc);
  let r=0;return l.map((x,i)=>{if(!i||x.sc!==l[i-1].sc)r=i+1;return `<li><span class="r">${r}위</span><span>${esc(x.n)}</span><span class="left">${x.sc}점</span></li>`}).join('');
};
G.overExtra=()=>{
  const done=!!V.sd,rt=+V.rt||1,head=done?`<p class="rk-note"><b>${rt}라운드 최종 순위</b></p><ol class="ranks">${finalRows()}</ol>`:`<p class="rk-note">${+V.rd||1} / ${rt} 라운드를 마쳤습니다.</p>`;
  if(mode!=='host')return head;
  return head+(V.rk?`<p class="rk-note">바로 시작하면 ${done?'점수를 새로 세고 ':''}이 계급으로 교환하고 ${leadTxt()}부터 시작합니다. 대기실로 가면 계급과 점수가 초기화됩니다. <button type="button" class="linkbtn" data-act="rankreset">계급 초기화</button></p>`:'<p class="rk-note">계급을 초기화했습니다. 다음 판은 ♦3을 가진 사람부터 시작합니다.</p>');
};
G.buttons=()=>{
  const play=$('#btnPlay'),pass=$('#btnPass');
  const ready=myReady(),k=sel.size;
  const err=ready&&k?selError():'';
  play.disabled=!(ready&&k>0&&!err);
  play.classList.toggle('ready',!play.disabled);
  const main=k?`${k}장 내기`:'내기';
  const foulWarn=ready&&k&&!err&&+V.cfg.foul&&k===myHand().length&&isFoulFinish(selIds(),stateV(),V.cfg);   // 반칙 탈출이 되는 마지막 카드
  const sub=k&&ready?(err||(foulWarn?'반칙 탈출 (꼴찌)':'낼 수 있음')):keyLabel(KEYS.play);
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
G.enter=()=>{BG.on=true};
G.leave=()=>{xchStop();BG.on=false;const bd=$('#ruleBadges');bd.innerHTML='';bd.dataset.k='';const f=$('#field2d');f.hidden=true;f.innerHTML='';f.dataset.k='';T.fieldKey=''};
G.init=()=>{
  const css=document.createElement('style');
  css.textContent=`
.pdiff{color:#9a5b00;background:#fbe7b0;border-radius:4px;padding:0 3px;box-decoration-break:clone;-webkit-box-decoration-break:clone}
.plever{position:relative;display:grid;grid-template-columns:repeat(3,1fr);margin:8px 0 6px;padding:4px;border-radius:14px;background:var(--well,#ebe0cc);border:1.5px solid var(--line-strong,#cdb391);box-shadow:inset 0 2px 4px rgba(59,42,31,.18)}
.pl-knob{position:absolute;top:4px;bottom:4px;left:4px;width:calc((100% - 8px)/3);border-radius:10px;background:var(--mustard,#f2b632);border:1.5px solid var(--mustard-edge,#c08a17);box-shadow:0 3px 0 var(--mustard-edge,#c08a17),0 4px 8px -2px rgba(59,42,31,.35);transform:translateX(calc(var(--p)*100%));animation:plSlide .26s cubic-bezier(.3,1.4,.5,1)}
@keyframes plSlide{from{transform:translateX(calc(var(--f)*100%))}to{transform:translateX(calc(var(--p)*100%))}}
.pl-o{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:1px;padding:8px 4px 7px;background:none;border:0;border-radius:10px;color:var(--muted,#7a6a58);cursor:pointer;font:inherit}
.pl-o b{font-size:14px;color:inherit}
.pl-o small{font-size:11px;opacity:.85}
.pl-o.on{color:#3b2a1f}
.pl-o:focus-visible{outline:2px solid var(--focus,#b86e00);outline-offset:-2px}
.pl-sum{margin:2px 0 4px;font-size:12.5px;color:var(--muted,#7a6a58);line-height:1.6}
.pl-sum b{color:var(--ink,#3b2a1f)}
.pl-sum b.pdiff{color:#9a5b00}
.pl-more{display:flex;align-items:center;gap:6px;margin:2px 0 4px;padding:6px 2px;background:none;border:0;font:inherit;font-size:13px;font-weight:600;color:var(--wood-dark,#6b4a2b);cursor:pointer}
.pl-det{border-top:1px dashed var(--line,#e3d4bb);margin-top:2px}
.stp.pdiff-row{background:#fbe7b0;border-radius:10px;box-shadow:0 0 0 6px #fbe7b0}
.rs-grid .stp.pdiff-row{margin:4px 0}
.pd-note{display:inline-block;margin-left:6px;font-style:normal;font-size:11px;font-weight:600;color:#9a5b00;white-space:nowrap}
.pl-lead .segrow{flex:none;width:150px}
.rtag{display:inline-block;font-size:10.5px;font-weight:700;line-height:1;padding:3px 6px 2px;border-radius:99px;margin-right:5px;vertical-align:1px;white-space:nowrap;border:1px solid transparent}
.rtag.r1{background:#f2b632;color:#4a2f00;border-color:#c08a17}
.rtag.r2{background:#fbe7b0;color:#7a5200;border-color:#e3c46e}
.rtag.r3{background:#efe6d6;color:#6b5a48;border-color:#d8c7ab}
.rtag.r4{background:#dfe4ea;color:#3f4b5a;border-color:#bcc6d2}
.rtag.r5{background:#4a3a2e;color:#f4ead9;border-color:#2d2219}
.ranks s{color:var(--muted,#7a6a58);text-decoration-thickness:1.5px}
.ranks .up{color:#2c7d47}.ranks .dn{color:#cc3a2e}
.rk-note{font-size:12.5px;color:var(--muted,#7a6a58);line-height:1.55;margin:4px 0}
.card.xin{visibility:hidden}
.linkbtn{background:none;border:0;padding:0;font:inherit;font-weight:600;color:#cc3a2e;text-decoration:underline;cursor:pointer}
@media (max-width:480px){.pl-o b{font-size:13px}.pl-lead{flex-wrap:wrap}.pl-lead .segrow{width:100%}}
`;
  document.head.appendChild(css);
};


/* ---------- 배경음악 (대부호 방에 있을 때만): 평시 「왕궁의 오후」 ↔ 혁명 「뒤집힌 왕좌」 ----------
   두 곡은 페이지를 열 때 워커에서 한 번 합성해 16초 루프로 반복합니다.
   혁명 곡은 평시 멜로디를 맨 뒤 음부터 거꾸로 배열하고 단조로 바꾼 곡입니다.
   혁명·반혁명이 나오면 곡이 테이프처럼 느려지다 멈추고, 듣던 소리를 0.75초 거꾸로 감은 뒤
   새 곡을 거울 위치에서 이어 틉니다. 11 백 동안에는 지금 곡을 그 자리에서 거꾸로 틀고 똑딱 소리를 겹칩니다.
   대부호 방을 나가거나 다른 게임으로 바꾸면 멈추고, 공통 배경음악(들판 소리·카페 재즈)이 다시 나옵니다 (G.ownBgm). */
function bgmSynthLib() {
  'use strict';

  var BPM = 120, S16 = 60 / BPM / 4, BAR = 16 * S16, BARS = 8, LOOP = BARS * BAR, TAIL = 3;

  // ---- 기본 도구 ----
  var TN = 4096, SIN = new Float32Array(TN + 1);
  for (var i = 0; i <= TN; i++) SIN[i] = Math.sin(2 * Math.PI * i / TN);
  function fs(ph) { ph -= Math.floor(ph); var x = ph * TN, j = x | 0; return SIN[j] + (SIN[j + 1] - SIN[j]) * (x - j); }
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // ---- 악보 (MIDI 음높이, 16분음표 단위 길이) ----
  var MEL = [
    [76, 4], [79, 2], [84, 2], [83, 2], [79, 2], [76, 4],   // 1 C
    [81, 6], [79, 2], [76, 2], [72, 2], [76, 4],            // 2 Am
    [77, 2], [81, 2], [84, 4], [81, 2], [77, 2], [81, 4],   // 3 F
    [79, 8], [71, 2], [74, 2], [77, 2], [74, 2],            // 4 G7
    [84, 4], [79, 2], [76, 2], [79, 4], [84, 2], [86, 2],   // 5 C
    [88, 6], [86, 2], [84, 2], [81, 2], [76, 4],            // 6 Am
    [77, 2], [81, 2], [86, 4], [84, 2], [81, 2], [77, 4],   // 7 Dm
    [79, 4], [83, 2], [86, 2], [79, 8]                      // 8 G7
  ];
  // C장조 → C화성단음계: 미·라를 반음 내림 (시는 이끔음으로 유지)
  function minor(m) { var pc = ((m % 12) + 12) % 12; return (pc === 4 || pc === 9) ? m - 1 : m; }
  function timeline(list) {
    var t = 0, out = [];
    for (var k = 0; k < list.length; k++) { out.push({ m: list[k][0], s: t, d: list[k][1] }); t += list[k][1]; }
    return out;
  }
  var FWD = timeline(MEL);
  var REV = timeline(MEL.slice().reverse().map(function (n) { return [minor(n[0]), n[1]]; }));

  var CH_F = [
    { n: 'C', r: 48, t: [60, 64, 67] }, { n: 'Am', r: 45, t: [57, 60, 64] },
    { n: 'F', r: 41, t: [57, 60, 65] }, { n: 'G7', r: 43, t: [59, 62, 65] },
    { n: 'C', r: 48, t: [60, 64, 67] }, { n: 'Am', r: 45, t: [57, 60, 64] },
    { n: 'Dm', r: 38, t: [57, 62, 65] }, { n: 'G7', r: 43, t: [59, 62, 65] }
  ];
  var CH_R = [
    { n: 'G7', r: 43, t: [59, 62, 65] }, { n: 'Dø7', r: 38, t: [56, 60, 62, 65] },
    { n: 'A♭', r: 44, t: [56, 60, 63] }, { n: 'Cm', r: 48, t: [55, 60, 63] },
    { n: 'G7', r: 43, t: [59, 62, 65] }, { n: 'Fm', r: 41, t: [56, 60, 65] },
    { n: 'A♭', r: 44, t: [56, 60, 63] }, { n: 'Cm', r: 48, t: [55, 60, 63] }
  ];

  // ---- 믹스 버스 ----
  function Mix(sr, n) {
    this.sr = sr; this.n = n;
    this.dL = new Float32Array(n); this.dR = new Float32Array(n);
    this.wL = new Float32Array(n); this.wR = new Float32Array(n);
  }
  Mix.prototype.add = function (t0, dur, pan, send, gen) {
    var sr = this.sr, i0 = Math.round(t0 * sr), end = Math.min(this.n, i0 + Math.round(dur * sr)), inv = 1 / sr;
    var gl = Math.cos((pan + 1) * Math.PI / 4), gr = Math.sin((pan + 1) * Math.PI / 4);
    for (var i = Math.max(0, i0); i < end; i++) {
      var s = gen((i - i0) * inv);
      this.dL[i] += s * gl; this.dR[i] += s * gr;
      if (send) { this.wL[i] += s * gl * send; this.wR[i] += s * gr * send; }
    }
  };

  function rel(t, len, k) { return t > len ? Math.exp(-(t - len) * k) : 1; }

  // ---- 악기 ----
  function pluck(f, len, amp) {          // 하프시코드풍 뜯는 소리
    var w = [1, .32, .5, .16, .26, .09, .14], K = Math.min(7, Math.floor(16000 / f));
    return function (t) {
      var a = (t < .004 ? t / .004 : 1) * Math.exp(-t * 3) * rel(t, len, 20), s = 0;
      for (var k = 1; k <= K; k++) s += w[k - 1] * Math.exp(-t * k * 1.6) * fs(f * k * t);
      return s * a * amp;
    };
  }
  function ep(f, len, amp) {             // 일렉 피아노 스탭
    return function (t) {
      var a = (t < .003 ? t / .003 : 1) * Math.exp(-t * 3.5) * rel(t, len, 14);
      return (fs(f * t) + .12 * fs(2 * f * t) + .1 * Math.exp(-t * 14) * fs(6.9 * f * t)) * a * amp;
    };
  }
  function bass(f, len, amp) {
    var w = [1, .45, .2, .08];
    return function (t) {
      var a = (t < .005 ? t / .005 : 1) * Math.exp(-t * 2.2) * rel(t, len, 16), s = 0;
      for (var k = 1; k <= 4; k++) s += w[k - 1] * Math.exp(-t * k * 1.2) * fs(f * k * t);
      return s * a * amp;
    };
  }
  function brass(f, len, amp, sr) {      // 금관풍 리드 (밝기가 열렸다 닫히는 톱니파)
    var K = Math.max(1, Math.min(14, Math.floor(9000 / f))), p1 = 0, p2 = 0;
    return function (t) {
      var vib = t > .2 ? .003 * Math.sin(2 * Math.PI * 5.5 * t) * Math.min(1, (t - .2) / .3) : 0;
      p1 += f * (1.004 + vib) / sr; p2 += f * (.996 + vib) / sr;
      var c = 1.4 + 6 * Math.min(1, t / .05) * (.45 + .55 * Math.exp(-t * 2.5)), r = Math.exp(-1 / c), w = 1, s = 0;
      for (var k = 1; k <= K; k++) { s += w / k * (fs(p1 * k) + fs(p2 * k)); w *= r; }
      var a = Math.min(1, t / .025) * (.85 + .15 * Math.exp(-t * 4)) * rel(t, len, 14);
      return s * a * amp;
    };
  }
  function pad(f, len, amp) {
    var r = Math.exp(-1 / 2.2);
    return function (t) {
      var w = 1, s = 0;
      for (var k = 1; k <= 8; k++) { s += w / k * (fs(f * 1.005 * k * t) + fs(f * .995 * k * t)); w *= r; }
      return s * Math.min(1, t / .35) * rel(t, len, 6) * amp;
    };
  }
  function sawBass(f, len, amp) {
    var K = Math.min(10, Math.floor(8000 / f));
    return function (t) {
      var c = 1 + 5 * Math.exp(-t * 12), r = Math.exp(-1 / c), w = 1, s = 0;
      for (var k = 1; k <= K; k++) { s += w / k * fs(f * k * t); w *= r; }
      s += .5 * fs(f * .5 * t);
      return s * (t < .004 ? t / .004 : 1) * Math.exp(-t * 3) * rel(t, len, 25) * amp;
    };
  }
  function kick(amp, sr) {
    var ph = 0;
    return function (t) {
      ph += (44 + 110 * Math.exp(-t * 28)) / sr;
      return (fs(ph) * Math.exp(-t * 7) + .3 * Math.exp(-t * 300)) * amp;
    };
  }
  function hat(R, amp, dec) {
    var prev = 0;
    return function (t) { var n = R() * 2 - 1, s = n - prev; prev = n; return s * Math.exp(-t * dec) * amp * Math.min(1, t / .001); };
  }
  function snare(R, amp, sr) {
    var ph = 0, prev = 0;
    return function (t) {
      ph += (175 + 30 * Math.exp(-t * 40)) / sr;
      var n = R() * 2 - 1, h = n - prev * .6; prev = n;
      return (.45 * fs(ph) * Math.exp(-t * 22) + .6 * h * Math.exp(-t * 13)) * amp;
    };
  }

  // ---- 편곡 ----
  function arrFwd(mx, sr) {
    var R = rng(11);
    FWD.forEach(function (n) {
      var t0 = n.s * S16, len = n.d * S16 * .92, f = mtof(n.m);
      mx.add(t0, len + .45, 0, .35, pluck(f, len, .22));
      // 메아리: 원래 음이 아직 울리는 중이거나, 그 순간 멜로디가 같은 음을 치면 넣지 않음 (같은 음이 겹쳐 두 번 치는 것처럼 들림)
      [[3, .45, .06], [6, -.45, .025]].forEach(function (e) {
        var es = (n.s + e[0]) % 128;
        if (e[0] < n.d) return;
        if (FWD.some(function (x) { return x !== n && x.m === n.m && es >= x.s && es < x.s + x.d; })) return;
        mx.add(t0 + e[0] * S16, len + .45, e[1], .5, pluck(f, len, e[2]));
      });
    });
    for (var b = 0; b < BARS; b++) {
      var c = CH_F[b], bt = b * BAR;
      mx.add(bt, 1.1, 0, .05, bass(mtof(c.r), .7, .38));
      mx.add(bt + 8 * S16, .9, 0, .05, bass(mtof(c.r + 7), .45, .3));
      [4, 12].forEach(function (st) {
        c.t.forEach(function (m, k) { mx.add(bt + st * S16, .7, (k - 1) * .3, .3, ep(mtof(m), .2, .07)); });
        mx.add(bt + st * S16, .3, .1, .12, snare(R, .1, sr));
      });
      mx.add(bt, .5, 0, .02, kick(.5, sr));
      mx.add(bt + 8 * S16, .5, 0, .02, kick(.36, sr));
      for (var s = 0; s < 16; s += 2) mx.add(bt + s * S16, .12, .35, .05, hat(R, s % 4 ? .05 : .03, 45));
    }
  }
  function arrRev(mx, sr) {
    var R = rng(22);
    REV.forEach(function (n) {
      var t0 = n.s * S16, len = n.d * S16 * .95, f = mtof(n.m);
      mx.add(t0, len + .3, 0, .25, brass(f, len, .085, sr));
      mx.add(t0, len + .3, .15, .2, brass(f / 2, len, .045, sr));
    });
    var pat = [0, 0, 12, 0, 0, 12, 0, 7];
    for (var b = 0; b < BARS; b++) {
      var c = CH_R[b], bt = b * BAR;
      c.t.forEach(function (m, k) { mx.add(bt, BAR + .5, (k - 1.5) * .35, .45, pad(mtof(m), BAR - .05, .03)); });
      for (var e = 0; e < 8; e++) mx.add(bt + e * 2 * S16, .35, 0, .03, sawBass(mtof(c.r + pat[e] - 12), .2, .26));
      [0, 8, 10].forEach(function (st) { mx.add(bt + st * S16, .55, 0, .03, kick(st === 10 ? .55 : .8, sr)); });
      [4, 12].forEach(function (st) { mx.add(bt + st * S16, .35, 0, .15, snare(R, .38, sr)); });
      for (var s = 0; s < 16; s++) mx.add(bt + s * S16, .1, .3, .03, hat(R, s % 2 ? .035 : .055, 55));
      if (b === 0 || b === 4) mx.add(bt, 2.4, -.2, .2, hat(R, .16, 1.6));
      if (b === BARS - 1) for (var f2 = 12; f2 < 16; f2++) mx.add(bt + f2 * S16, .3, 0, .12, snare(R, .14 + (f2 - 12) * .07, sr));
    }
  }

  // ---- 잔향 (Freeverb 계열) ----
  function reverb(inp, off, sr, room, damp) {
    var sc = sr / 44100, n = inp.length, out = new Float32Array(n);
    var combs = [1116, 1188, 1277, 1356, 1422, 1491].map(function (d) { return { b: new Float32Array(Math.round((d + off) * sc)), i: 0, f: 0 }; });
    var aps = [556, 441, 341].map(function (d) { return { b: new Float32Array(Math.round((d + off) * sc)), i: 0 }; });
    for (var j = 0; j < n; j++) {
      var x = inp[j] * .1, s = 0;
      for (var c = 0; c < 6; c++) {
        var C = combs[c], y = C.b[C.i];
        C.f = y * (1 - damp) + C.f * damp; C.b[C.i] = x + C.f * room;
        if (++C.i >= C.b.length) C.i = 0; s += y;
      }
      for (var a = 0; a < 3; a++) {
        var A = aps[a], bo = A.b[A.i], y2 = -s + bo;
        A.b[A.i] = s + bo * .5; if (++A.i >= A.b.length) A.i = 0; s = y2;
      }
      out[j] = s;
    }
    return out;
  }

  function master(L, R, peak) {
    var pk = 0, i, n = L.length, d = 1.3, nd = Math.tanh(d);
    for (i = 0; i < n; i++) pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i]));
    var g = d / (pk || 1);
    for (i = 0; i < n; i++) { L[i] = Math.tanh(L[i] * g) / nd * peak; R[i] = Math.tanh(R[i] * g) / nd * peak; }
  }

  // 루프 렌더: 끝부분 꼬리(잔향·메아리)를 처음에 겹쳐 이음매 없이 반복되게 만든다.
  function render(mode, sr) {
    sr = sr || 44100;
    var n = Math.round((LOOP + TAIL) * sr), Ln = Math.round(LOOP * sr), mx = new Mix(sr, n);
    (mode === 'rev' ? arrRev : arrFwd)(mx, sr);
    var rl = reverb(mx.wL, 0, sr, .82, .3), rr = reverb(mx.wR, 23, sr, .82, .3);
    var L = new Float32Array(Ln), R = new Float32Array(Ln);
    for (var i = 0; i < n; i++) { var j = i % Ln; L[j] += mx.dL[i] + rl[i]; R[j] += mx.dR[i] + rr[i]; }
    master(L, R, mode === 'rev' ? .74 : .85);
    return { L: L, R: R, sr: sr, length: Ln };
  }

  // 전환음: 지금 듣던 곡을 fromSec 지점부터 실제로 거꾸로, 점점 빠르게 감는다.
  var RW_T = .75, RW_TRAVEL = RW_T * (1 + 3 / 2.5);
  function rewind(src, fromSec) {
    var sr = src.sr, n = Math.round(RW_T * sr), len = src.length, p = fromSec * sr;
    var L = new Float32Array(n), R = new Float32Array(n), yl = 0, yr = 0;
    for (var i = 0; i < n; i++) {
      var u = i / n, r = 1 + 3 * Math.pow(u, 1.5); p -= r;
      var q = ((p % len) + len) % len, i0 = q | 0, f = q - i0, i1 = (i0 + 1) % len;
      var xl = src.L[i0] + (src.L[i1] - src.L[i0]) * f, xr = src.R[i0] + (src.R[i1] - src.R[i0]) * f;
      var k = 1 / r; yl += (xl - yl) * k; yr += (xr - yr) * k;      // 빨라질수록 먹먹하게
      var g = Math.min(1, i / (.02 * sr)) * (1 - u * u * u) * (.95 + .3 * u);
      L[i] = yl * g; R[i] = yr * g;
    }
    return { L: L, R: R, sr: sr, length: n };
  }

  return {
    BPM: BPM, S16: S16, BAR: BAR, BARS: BARS, LOOP: LOOP, RW_T: RW_T, RW_TRAVEL: RW_TRAVEL,
    FWD: FWD, REV: REV, CH_F: CH_F, CH_R: CH_R, minor: minor,
    render: render, rewind: rewind
  };
}
const SY=bgmSynthLib();
const BG={
  on:false,data:{},buf:{},trim:null,cur:null,mode:'fwd',rv:false,tick:null,tickBuf:null,busyUntil:0,kick:false,lvl:-1,
  LEVEL:.0116,   // 곡마다 이 RMS로 맞춤 (공통 카페 재즈와 같은 크기)
  TRIM:1,
  TICK:.14,   // 11 백 똑딱 소리 음량 (곡 대비)
  render(){
    const got=(m,L,R,sr,length)=>{
      let q=0;for(let i=0;i<length;i++)q+=L[i]*L[i]+R[i]*R[i];
      const k=q>0?this.LEVEL/Math.sqrt(q/(2*length)):1;for(let i=0;i<length;i++){L[i]*=k;R[i]*=k}
      this.data[m]={L,R,sr,length};
    };
    const here=()=>{for(const m of ['fwd','rev'])if(!this.data[m]){const b=SY.render(m);got(m,b.L,b.R,b.sr,b.length)}};
    try{
      const src='var SY=('+bgmSynthLib.toString()+')();onmessage=function(e){var b=SY.render(e.data);postMessage({m:e.data,L:b.L,R:b.R,sr:b.sr,length:b.length},[b.L.buffer,b.R.buffer]);};';
      const w=new Worker(URL.createObjectURL(new Blob([src],{type:'text/javascript'})));let n=0;
      w.onmessage=e=>{const d=e.data;got(d.m,d.L,d.R,d.sr,d.length);if(++n===2)w.terminate()};
      w.onerror=()=>{w.terminate();setTimeout(here,30)};
      w.postMessage('fwd');w.postMessage('rev');
    }catch(e){setTimeout(here,60)}
  },
  toBuffer(b){const ab=SND.ctx.createBuffer(2,b.length,b.sr);ab.getChannelData(0).set(b.L);ab.getChannelData(1).set(b.R);return ab},
  // 11 백용: 곡을 통째로 거꾸로 뒤집은 버전 (진짜 역재생)
  reversed(b){const L=b.L.slice().reverse(),R=b.R.slice().reverse();return {L,R,sr:b.sr,length:b.length}},
  // 똑딱 1초 루프: 0초 '똑'(높은 음), 0.5초 '딱'(낮은 음) — 곡의 박자(120 BPM)에 맞춤
  makeTick(){
    const c=SND.ctx,sr=c.sampleRate,n=sr,ab=c.createBuffer(1,n,sr),d=ab.getChannelData(0);
    let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647*2-1;
    for(const [t0,f,a] of [[0,2100,.5],[.5,1500,.42]]){
      const i0=Math.round(t0*sr);
      for(let i=0;i<Math.round(.06*sr);i++){const t=i/sr,e=Math.exp(-t*90);d[i0+i]+=(Math.sin(2*Math.PI*f*t)*.8+Math.sin(2*Math.PI*f*2.7*t)*.25)*e*a+rnd()*Math.exp(-t*600)*a*.5}
    }
    return ab;
  },
  ready(){return !!(this.data.fwd&&this.data.rev&&SND.ctx&&SND.bgm)},
  key(m,r){return m+(r?'R':'')},
  begin(v){
    const c=SND.ctx;
    if(!this.trim){
      this.trim=c.createGain();this.trim.gain.value=0;this.trim.connect(SND.bgm);
      for(const m of ['fwd','rev']){this.buf[m]=this.toBuffer(this.data[m]);this.data[m+'R']=this.reversed(this.data[m]);this.buf[m+'R']=this.toBuffer(this.data[m+'R'])}
      this.tickBuf=this.makeTick();
    }
    this.mode=this.target(v);this.rv=this.wantB11(v);this.lvl=-1;
    this.play(this.mode,this.rv,0,c.currentTime+.05,.6);
    if(this.rv)this.tickOn(c.currentTime+.05);
  },
  // fe: '평시 방향' 기준 위치(초). 거꾸로 트는 곡이면 실제 재생 위치는 LOOP-fe
  play(m,r,fe,when,fade){
    const c=SND.ctx,L=SY.LOOP,s=c.createBufferSource(),g=c.createGain(),off=(((r?L-fe:fe)%L)+L)%L;
    s.buffer=this.buf[this.key(m,r)];s.loop=true;s.connect(g);g.connect(this.trim);
    g.gain.setValueAtTime(0,when);g.gain.linearRampToValueAtTime(1,when+fade);
    s.start(when,off);this.cur={src:s,g,mode:m,r,t0:when,off};
  },
  stop(){
    this.tickOff();
    if(!this.cur)return;const c=SND.ctx,old=this.cur,now=c.currentTime;this.cur=null;
    old.g.gain.cancelScheduledValues(now);old.g.gain.setValueAtTime(old.g.gain.value,now);old.g.gain.linearRampToValueAtTime(0,now+.6);
    try{old.src.stop(now+.65)}catch(e){}
  },
  pos(now){const c=this.cur,L=SY.LOOP;return (((c.off+Math.max(0,now-c.t0))%L)+L)%L},
  fe(p,r){const L=SY.LOOP;return r?(((L-p)%L)+L)%L:p},
  target(v){return v&&v.st!=='wait'&&v.rev?'rev':'fwd'},
  wantB11(v){return !!(v&&v.st==='play'&&v.b11)},
  tickOn(when){
    if(this.tick||!this.cur)return;const c=SND.ctx,s=c.createBufferSource(),g=c.createGain();
    s.buffer=this.tickBuf;s.loop=true;s.connect(g);g.connect(this.trim);
    g.gain.setValueAtTime(0,when);g.gain.linearRampToValueAtTime(this.TICK,when+.05);
    s.start(when,this.pos(when)%1);this.tick={src:s,g};   // 곡의 박에 맞춰 시작
  },
  tickOff(){
    if(!this.tick)return;const c=SND.ctx,t=this.tick,now=c.currentTime;this.tick=null;
    t.g.gain.cancelScheduledValues(now);t.g.gain.setValueAtTime(t.g.gain.value,now);t.g.gain.linearRampToValueAtTime(0,now+.15);
    try{t.src.stop(now+.2)}catch(e){}
  },
  // 11 백: 지금 곡을 그 자리에서 거꾸로(또는 다시 앞으로) 틀고 똑딱 소리를 켜고 끔
  // 11 백 시작·끝 효과음: 시작은 테이프를 거꾸로 감는 듯 내려가는 '휘릭', 끝은 반대로 올라가는 '휘릭'
  b11Sfx(on){
    if(on){hiss(.32,{freq:3200,sweep:500,q:1.1,vol:.16});tone(880,.3,{type:'triangle',vol:.09,slide:220});tone(1760,.08,{type:'sine',vol:.05,at:.26})}
    else{hiss(.3,{freq:500,sweep:3200,q:1.1,vol:.14});tone(220,.28,{type:'triangle',vol:.09,slide:880});tone(1320,.07,{type:'sine',vol:.05,at:.25})}
  },
  setB11(on){
    this.rv=on;try{this.b11Sfx(on)}catch(e){}if(!this.cur)return;
    const c=SND.ctx,old=this.cur,now=c.currentTime+.02,TS=.12,fe=this.fe(this.pos(now+TS),old.r);
    old.src.playbackRate.setValueAtTime(1,now);old.src.playbackRate.linearRampToValueAtTime(.55,now+TS);   // 테이프가 방향을 바꾸듯 살짝 처짐
    old.g.gain.setValueAtTime(1,now);old.g.gain.linearRampToValueAtTime(0,now+TS);old.src.stop(now+TS+.03);
    this.play(old.mode,on,fe,now+TS-.03,.1);
    if(on)this.tickOn(now+TS);else this.tickOff();
  },
  // 혁명·반혁명: 테이프 멈춤 → 듣던 소리를 거꾸로 감기 → 거울 위치에서 새 곡
  flip(to){
    const c=SND.ctx,TS=.22,L=SY.LOOP,old=this.cur,now=c.currentTime+.02,p=this.pos(now);
    old.src.playbackRate.setValueAtTime(1,now);old.src.playbackRate.linearRampToValueAtTime(.3,now+TS);
    old.g.gain.setValueAtTime(1,now);old.g.gain.linearRampToValueAtTime(0,now+TS+.03);old.src.stop(now+TS+.06);
    const p2=(p+.65*TS)%L,rw=c.createBufferSource(),rg=c.createGain();
    rw.buffer=this.toBuffer(SY.rewind(this.data[this.key(old.mode,old.r)],p2));rg.gain.value=.95;rw.connect(rg);rg.connect(this.trim);rw.start(now+TS-.02);
    const end=this.fe(p2-SY.RW_TRAVEL,old.r),fe=((Math.round((((L-end)%L)+L)%L/SY.S16)*SY.S16)%L+L)%L,t1=now+TS+SY.RW_T-.06;
    this.play(to,this.rv,fe,t1,.08);this.busyUntil=t1+.1;
  },
  // 새 판 시작처럼 혁명 없이 상태만 바뀌면 조용히 겹쳐 바꿈
  fade(to){
    const c=SND.ctx,old=this.cur,now=c.currentTime+.02;
    old.g.gain.setValueAtTime(1,now);old.g.gain.linearRampToValueAtTime(0,now+1.2);old.src.stop(now+1.3);
    this.play(to,this.rv,0,now,1.2);
  },
  sync(v){
    if(!this.cur||SND.ctx.currentTime<this.busyUntil)return;
    const b=this.wantB11(v),to=this.target(v);
    if(to!==this.mode){
      this.rv=b;this.mode=to;
      if(this.kick&&SND.ctx.state==='running')this.flip(to);else this.fade(to);
      if(b)this.tickOn(this.busyUntil>SND.ctx.currentTime?this.busyUntil:SND.ctx.currentTime);else this.tickOff();
    }else if(b!==this.rv)this.setB11(b);
    this.kick=false;
  },
  // 대부호 방에 있는 동안만 재생 (방을 나가거나 다른 게임이 되면 멈춤). 소리 켜기/끄기도 여기서 따라감
  watch(){
    const here=this.on&&!!V&&V.st!=='wait';   // 지금 화면의 게임이 대부호(enter/leave로 표시)이고 게임 중(대기실은 공통 배경음악)일 때
    if(!here){this.stop();return}
    if(!this.cur){if(this.ready()&&SND.ctx.state==='running')this.begin(V);else return}
    if(this.target(V)!==this.mode||this.wantB11(V)!==this.rv)this.sync(V);
    const lv=SND.on?this.TRIM:0;
    if(lv!==this.lvl){this.lvl=lv;this.trim.gain.setTargetAtTime(lv,SND.ctx.currentTime,.08)}
  }
};
G.ownBgm=()=>!!V&&V.st!=='wait';   // 대부호 게임 중에만 공통 배경음악을 쉼 (대기실은 공통 배경음악)
if(typeof window!=='undefined'&&typeof Worker!=='undefined'&&typeof document!=='undefined'){
  BG.render();
  setInterval(()=>{try{BG.watch()}catch(e){}},250);
}
(window.GAMES=window.GAMES||{}).president=G;
})();
