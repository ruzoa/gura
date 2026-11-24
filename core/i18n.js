/* 언어 (한국어·English). 모든 스크립트보다 먼저 불러옴 (게임 파일도 맨 위에서 __()를 쓸 수 있게)
   화면 글자는 지금처럼 한국어로 쓰고, 다른 언어는 사전에 '한국어 → 번역'으로 더함(lang/en.js, 게임 문구는 게임 파일의 G.i18n). 사전에 없으면 한국어 그대로.
   언어는 사람마다 고르는 개인 설정(gura-lang, 기본 한국어). 바꾸면 페이지를 다시 엶(탁자는 새로고침처럼 이어짐) → 모든 글자를 처음부터 그 언어로 그림.
   한국어가 아니면 문서 글자(텍스트·title·aria-label·placeholder)·캔버스 글자(fillText·measureText)·확인 창(confirm·alert)을 사전으로 자동으로 바꿈.
   그래서 대부분은 사전에 더하기만 하면 되고, 글자를 한 자·한 낱말씩 쪼개 그리는 곳(디스플레이 플립·목록 판·규칙 판자)만 쪼개기 전에 __()를 씀. 자세한 것은 docs/i18n.md */
/* ===== 언어 ===== */
const LANGS={ko:'한국어',en:'English',ja:'日本語'};   // 고르는 버튼 이름 (번역하지 않음)
const LANG=(()=>{try{const v=localStorage.getItem('gura-lang');if(v&&LANGS[v])return v}catch(e){}return 'ko'})();
const I18N={dict:{},pats:[],cache:new Map(),board:{},unit:{},short:{}};   // board: 디스플레이 4칸 플립 낱말(영어는 4글자 이하), unit: 숫자 옆 단위, short: 게임의 짧은 이름(G.short 한국어 → 번역) 중 사전의 이름과 달라야 하는 것만(base.js에서 바꿈)
const DEF_NICK={ko:'나',en:'Me',ja:'わたし'}[LANG]||'나';   // 닉네임을 비웠을 때 (사전에 '나'를 넣지 않음: 남의 닉네임 '나'가 바뀌지 않게)   // board: 디스플레이 4칸 플립 낱말(영어는 4글자 이하)
const HANGUL=/[가-힣ㄱ-ㅎ]/;   // 한글이 없는 글자는 바로 건너뜀
/* 사전 더하기: 지금 언어의 것만 담음. 키에 {0}·{1}이 있으면 이미 만들어진 글자(방장이 보낸 기록, 이름이 든 문장)도 맞춰 바꿈 */
I18N.add=(lang,d)=>{
  if(lang!==LANG||!d)return;
  for(const k0 in d){
    const k=k0.trim();   // 키는 앞뒤 빈칸 없이 (화면 글자도 앞뒤 빈칸을 떼고 맞춤. ' (나)'처럼 빈칸을 붙인 키가 맞지 않던 것)
    if(!(k in I18N.dict)&&/\{#?\d\}/.test(k)){
      const re=new RegExp('^'+k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\\\{#(\d)\\\}/g,'([-+]?[\\d.,/×:]+)').replace(/\\\{(\d)\\\}/g,'([\\s\\S]+?)')+'$');
      I18N.pats.push({re,ix:[...k.matchAll(/\{#?(\d)\}/g)].map(m=>+m[1]),v:k,len:k.length});
    }
    I18N.dict[k]=d[k0];
  }
  I18N.pats.sort((a,b)=>b.len-a.len);I18N.cache.clear();
};
/* 사전 밖의 표 (board: 디스플레이 낱말, unit: 단위, short: 목록 판 짧은 게임 이름): 지금 언어의 것만 */
I18N.set=(lang,key,d)=>{if(lang===LANG)Object.assign(I18N[key],d)};
/* __('한국어 {0}', 값…): 코드에서 직접 쓰는 번역 (gettext처럼). 값은 {0}·{1} 자리에 넣음. t·tr 같은 짧은 이름은 게임 코드의 지역 변수(t=시각)와 겹쳐서 쓰지 않음 */
function __(s,...a){
  if(s==null)return s;s=String(s);
  let r=LANG==='ko'?s:(I18N.dict[s]??s);
  if(typeof r==='function')r=r(...a);
  return a.length?String(r).replace(/\{(\d)\}/g,(m,i)=>a[i]==null?m:__s(String(a[i]))):r;   // 값도 사전에 있으면 바꿈 (게임 이름 등)
}
/* __u('초'): 숫자 옆 단위. 사전의 낱말과 겹치지 않게 따로 (I18N.unit, 없으면 __) */
const __u=u=>LANG==='ko'||!u?u:(I18N.unit[u]??__(u));
/* __s(이미 만든 글자): 사전에 그대로 있거나 {0} 모양과 맞으면 바꿈. 앞뒤 빈칸은 그대로 둠 */
function __s(s){
  if(LANG==='ko'||typeof s!=='string'||!HANGUL.test(s))return s;
  const c=I18N.cache.get(s);if(c!==undefined)return c;
  const m=/^(\s*)([\s\S]*?)(\s*)$/.exec(s),core=m[2];let r=I18N.dict[core];
  if(typeof r==='function')r=null;
  if(r==null)for(const p of I18N.pats){const x=p.re.exec(core);if(!x)continue;
    const v=I18N.dict[p.v],args=[];p.ix.forEach((n,j)=>{args[n]=__s(x[j+1])});   // 값도 사전 모양으로 다시 바꿈('여우 봇 설정' → {0}='여우 봇' → '{0} 봇' → 'Fox Bot'). 값은 문장보다 짧아서 끝남
    r=typeof v==='function'?v(...args):String(v).replace(/\{(\d)\}/g,(q,i)=>args[i]??q);break}
  const out=r==null?s:m[1]+r+m[3];
  if(I18N.cache.size>4000)I18N.cache.clear();I18N.cache.set(s,out);return out;
}
/* 문서 글자 바꾸기 (한국어가 아닐 때만): 처음 한 번 전체 + 이후 바뀌는 곳만 (MutationObserver) */
const I18N_ATTR=['title','aria-label','placeholder','alt'];
I18N.text=n=>{const v=n.data;if(!HANGUL.test(v))return;const p=n.parentNode;if(p&&/^(SCRIPT|STYLE|TEXTAREA)$/.test(p.nodeName))return;const r=__s(v);if(r!==v)n.data=r};
I18N.attr=(el,a)=>{const v=el.getAttribute(a);if(v&&HANGUL.test(v)){const r=__s(v);if(r!==v)el.setAttribute(a,r)}};
I18N.dom=root=>{
  if(LANG==='ko'||!root)return;
  if(root.nodeType===3){I18N.text(root);return}
  if(root.nodeType!==1&&root.nodeType!==11&&root.nodeType!==9)return;
  if(root.nodeType===1)for(const a of I18N_ATTR)if(root.hasAttribute(a))I18N.attr(root,a);
  const w=document.createTreeWalker(root,5);let n;   // 요소 + 글자
  while((n=w.nextNode())){if(n.nodeType===3)I18N.text(n);else for(const a of I18N_ATTR)if(n.hasAttribute(a))I18N.attr(n,a)}
};
/* 다른 언어로: 저장하고 다시 열기 (방장 탁자·참가하던 탁자는 새로고침처럼 이어짐) */
function setLang(l){if(!LANGS[l]||l===LANG)return;try{localStorage.setItem('gura-lang',l)}catch(e){}location.reload()}
if(LANG!=='ko'&&typeof document!=='undefined'){
  document.documentElement.lang=LANG;
  const CP=typeof CanvasRenderingContext2D!=='undefined'&&CanvasRenderingContext2D.prototype;   // 캔버스 글자 (3D 판·카드 그림 등)
  if(CP)for(const k of ['fillText','strokeText','measureText']){const f=CP[k];CP[k]=function(s,...r){return f.call(this,typeof s==='string'&&s.length>1?__s(s):s,...r)}}   // 한 글자는 그대로 (한 자씩 그리는 판·말의 글자가 낱말로 바뀌지 않게)
  for(const k of ['confirm','alert','prompt']){const f=window[k];if(f)window[k]=(m,...r)=>f.call(window,__s(m),...r)}
  const start=()=>{
    I18N.dom(document.body);document.title=__s(document.title);
    new MutationObserver(ms=>{for(const m of ms){
      if(m.type==='characterData')I18N.text(m.target);
      else if(m.type==='attributes')I18N.attr(m.target,m.attributeName);
      else for(const n of m.addedNodes)I18N.dom(n);
    }}).observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:I18N_ATTR});
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else setTimeout(start,0);   // 사전(lang/*.js)을 다 읽은 뒤
}
