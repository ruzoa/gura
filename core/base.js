/* index.html 공통 코드 · 공통 상수·게임 목록·방 설정 값. 파일 순서는 index.html의 <script src> 순서 */
/* ================= 공통 ================= */
const $=s=>document.querySelector(s);
const clock=()=>performance.now();
const rand=(a,b)=>a+Math.random()*(b-a);
const pick=a=>a[Math.random()*a.length|0];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a}

/* 카드 id 규칙은 게임마다 다름 (games/*.js). 100 이상은 어느 게임이든 와일드 카드(별카드·조커) */
const JOKER_BASE=100;
const isJ=id=>id>=JOKER_BASE;
const JOKER_C='#efbc4e';
/* ===== 게임 목록 =====
   G = 지금 화면에 보이는 게임, EG() = 방장 엔진이 돌리는 게임 (방장 화면에서는 둘이 같음) */
const GAME_IDS=['gura','president','quoridor','yahtzee','omok','chess','janggi','blackjack','poker','alkkagi'];
let G=GAMES.gura;
const EG=()=>(H&&H.cfg&&GAMES[H.cfg.game])||GAMES.gura;
const gameOf=id=>GAMES[id]||GAMES.gura;
/* 이모티콘: 1~0, - 키 순서. q = 구라?(노란 뾰족 풍선), 나머지는 크림색 둥근 풍선 */
const EMOTES=[
  {k:'gq',t:'구라?',n:'구라?',q:1},
  {k:'shh',e:'🤫',n:'쉿'},{k:'plz',e:'🙏',n:'제발'},{k:'omg',e:'😱',n:'놀람'},{k:'lol',e:'🤣',n:'빵 터짐'},
  {k:'dizzy',e:'😵',n:'멘붕'},{k:'cry',e:'😭',n:'슬픔'},{k:'mad',e:'😡',n:'화남'},{k:'hurry',e:'⏰',n:'재촉'},
  {k:'smile',e:'😊',n:'좋음'},{k:'gg',t:'GG',n:'GG'}];
/* 선 플레이어처럼 '선택'(값 1) / '무작위'(값 0) 두 버튼으로 고르는 규칙: 규칙 정의에 pick:true. 판자·2D 창이 스위치 대신 버튼 둘을 그림 */
const PICK_OPTS=['선택','무작위'];
const pickIdx=v=>+v?0:1;            // 버튼 번호: 0 선택, 1 무작위
const pickVal=i=>i===0?1:0;
const EMO_KEYS=['Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9','Digit0','Minus'];
const BOT_NAMES=['여우','까치','너구리','고양이','두더지','수달','부엉이','다람쥐'];
const OPTS={gi:GAME_IDS.map((_,i)=>i),fast:[0,1],pub:[0,1]};
const OPT_LABEL={fast:['클래식','빠른 모드'],pub:['비공개','공개']};
/* 홀로그램 게임 이름 아래 모드(규칙) 한 줄: 게임의 G.modeLabel(c)가 있으면 그것, 없으면 빠른 모드가 있는 게임은 클래식/빠른 모드, 둘 다 없으면 빈 글자(자리만 남김) */
function modeLabelOf(g,c){if(!g||!c)return '';try{if(g.modeLabel)return String(g.modeLabel(c)||'');}catch(_){return ''}return g.noFast?'':OPT_LABEL.fast[+c.fast?1:0]}
const MODE_DESC=['끝까지 순위를 정함','1등이 나오면 끝'];
const OPT_HTML={fast:v=>`<b>${OPT_LABEL.fast[v]}</b><small>${MODE_DESC[v]}</small>`,gi:v=>`<b>${gameOf(GAME_IDS[v]).name}</b><small>${gameOf(GAME_IDS[v]).lead}</small>`};
const cfg={gi:Math.max(0,GAME_IDS.indexOf(store('gura-game')||'gura')),fast:0,pub:0};   // 방 만들기 화면에서 고른 값
const BOT_LV=['쉬움','보통','어려움'];
/* 방 설정 항목: 대기실의 '방 설정'에서 −/+ 버튼으로 조절. 모든 게임 공통 + 게임별(G.roomSet) */
const COMMON_SET=[
  {k:'max',label:'최대 인원',unit:'명',lo:2,hi:8,step:1,desc:'현재 인원보다 적게 줄일 수 없습니다'},
  {k:'spec',label:'관전 인원',unit:'명',lo:0,hi:8,step:1,desc:'게임 중이거나 탁자가 가득 차면 관전으로 들어옵니다'}];
const roomSetOf=(g,c)=>[...COMMON_SET.map(d=>{const hi=d.k==='max'?(g.maxOf&&c?g.maxOf(c):g.maxHi):0;return hi?{...d,hi}:d}),...g.roomSet];   // g.maxHi: 그 게임의 최대 인원 (쿼리도 4명), g.maxOf(방 설정): 규칙에 따라 달라지는 최대 인원 (알까기 오목 모드 2명)
const cfgKey=id=>id==='gura'?'gura-roomcfg':'gura-roomcfg-'+id;
/* 게임별로 저장해 둔 방 설정 (없으면 기본값). 범위 밖이면 가까운 값으로 */
function cfgFor(id){
  const g=gameOf(id),c={max:4,spec:4,...g.defaults};
  try{const sv=JSON.parse(store(cfgKey(g.id))||'null');if(sv){for(const d of roomSetOf(g))if(Number.isFinite(+sv[d.k]))c[d.k]=+sv[d.k];for(const d of g.ruleSet)if(sv[d.k]!==undefined)c[d.k]=+sv[d.k]?1:0}}catch(e){}
  for(const d of roomSetOf(g,c))c[d.k]=Math.max(d.lo,Math.min(d.hi,Math.round(+c[d.k])||0));
  for(const d of g.ruleSet)c[d.k]=+c[d.k]?1:0;
  c.game=g.id;return c;
}
function saveRoomCfg(c){const g=gameOf(c.game),o={};for(const d of roomSetOf(g,c))o[d.k]=c[d.k];for(const d of g.ruleSet)o[d.k]=c[d.k]?1:0;store(cfgKey(g.id),JSON.stringify(o))}
let roomSetOpen=false;
const PEER_PREFIX='gura-cardgame-room-';
const ALPH='abcdefghjkmnpqrstuvwxyz23456789';
const genCode=()=>String(Math.random()*10000|0).padStart(4,'0');   // 탁자 번호는 숫자 4자리(디스플레이 키판으로 입력). 예전 영문 번호도 찾아가기는 됨
function store(k,v){try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v)}catch(e){return null}}
function unstore(k){try{localStorage.removeItem(k)}catch(e){}}
/* 이 브라우저를 구분하는 id: 새로고침 뒤 다시 들어와도 같은 자리를 돌려받는 데 씀 */
const CID=(()=>{let c=store('gura-cid');if(!c||!/^[a-z0-9]{8,32}$/.test(c)){c=Math.random().toString(36).slice(2,10)+Date.now().toString(36);store('gura-cid',c)}return c})();
const RESUME_MS=10*60*1000;   // 새로고침·앱 전환 뒤 이 시간 안이면 방을 이어서 열기

const net={peer:null,conn:null,conns:new Set(),code:'',retry:null,savedAt:0,pub:null,pubBusy:false,pubRetryAt:0,handoff:''};
let mode='lobby';           // lobby | host | guest | closed
/* 첫 화면(탁자 하나) 상태. 자세한 설명은 frontBuild 위 */
const FR={ok:false,rb:{on:false,mode:'list',gid:null,pg:0,s:0,v:0,pick:-1,pickAt:0,drag:false,chg:null},rba:{v:0,to:0,from:0,t0:0,ms:0},kmode:'menu',backAt:0,ma:{v:0,to:0,from:0,t0:0,ms:0},stand:1,sa:null,ca:null,cloth:0,spread:false,warp:null,word:'',wordAt:0,wordMs:4500,shakeAt:-1e9,tw:0,rum:0,open:1,flaps:null,boardKey:'',drawn:'',applied:true,browse:false,hpos:0,sheetMin:false,lock:'',bad:false,buf:'',pub:null,leanOn:false,lean:0,keyAt:0,pop:null,holdAt:0,eye:'',armAt:0,sit:false,arm:{v:0,to:0,from:0,t0:0,ms:0}};
let V=null, PV=null;        // 지금 화면 상태, 직전 상태
const sel=new Set(); let pickNum=null;   // pickNum: 구라!에서 라운드를 시작할 때 고른 선언 자음

