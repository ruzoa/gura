/* ===== 시티 체이스 게임 모듈 =====
   공통 코드(core/)가 GAMES.citychase의 함수를 불러서 이 게임의 규칙·봇·화면을 그림. 코리아보드게임즈 '시티 체이스: 경찰 vs 도둑'의 공식 규칙.
   인원: 2~4명. 첫 차례 주사위로 고른 한 명이 도둑, 나머지가 경찰. 헬리콥터는 인원과 상관없이 늘 3대(분홍·노랑·초록)
   판: 건물 5×5(위가 북). 건물 번호 b = y*5 + x (x 0~4 서→동, y 0~4 북→남). 이름 A~E + 1~5(아래가 1)
   교차로: 건물 사이 길이 만나는 곳 4×4. 번호 k = j*4 + i, 판 좌표로는 (i+1, j+1). 교차로마다 둘레에 건물 넷
   흐름: 헬기 놓기(heli) → 라운드마다 도둑 숨기(thief) → 헬기 3대가 하나씩 행동(police) → … R라운드(기본 11)
   도둑: 첫 라운드는 아무 건물, 그다음은 바로 옆(대각선 아님) 건물로만. 지나간 건물에는 흔적이 남고 흔적이 있는 건물로는 못 감. 갈 곳이 없으면 포위돼 경찰 승리
   헬기: 이동(옆 교차로, 다른 헬기가 있으면 못 감) 또는 수색(둘레 건물 넷 중 하나를 들어 봄). 흔적을 찾으면 그 건물 위에 올려 둠(첫 흔적 노랑, 가운데 라운드 빨강, 나머지 파랑 — 몇 번째인지는 모름)
   비밀: 도둑의 자리와 지나온 길은 도둑에게만 보냄(엔진 snap). 경찰 봇은 공개된 정보(헬기·찾은 흔적·빈 건물 수색 결과)만 씀
   손패(hand)는 표시용 값 [0] (공통 코드가 hand가 비면 끝난 사람으로 봄) */
(function(){
const G={id:'citychase',name:'시티 체이스',short:'시티 체이스',lead:'헬기 셋으로 건물 밑에 숨은 도둑 찾기',maxHi:4,minN:2,noFast:true,firstPick:true};

/* ---------- 규칙 (방장 엔진·화면·봇·테스트가 같은 함수를 씀) ---------- */
const N=5,NB=25,NI=16,NH=3;
const BX=b=>b%N,BY=b=>(b/N)|0,IX=k=>k%4,IY=k=>(k/4)|0;
const bName=b=>'ABCDE'[BX(b)]+(N-BY(b));
const iName=k=>'ABCDE'[IX(k)]+'ABCDE'[IX(k)+1]+(N-IY(k)-1)+(N-IY(k));   // 교차로 이름: 둘레 건물의 열 두 개 + 행 두 개 (예: AB45)
const NBR_B=Array.from({length:NB},(_,b)=>{const x=BX(b),y=BY(b),o=[];if(y>0)o.push(b-N);if(x<N-1)o.push(b+1);if(y<N-1)o.push(b+N);if(x>0)o.push(b-1);return o});
const NBR_I=Array.from({length:NI},(_,k)=>{const x=IX(k),y=IY(k),o=[];if(y>0)o.push(k-4);if(x<3)o.push(k+1);if(y<3)o.push(k+4);if(x>0)o.push(k-1);return o});
const AROUND=Array.from({length:NI},(_,k)=>{const i=IX(k),j=IY(k);return [j*N+i,j*N+i+1,(j+1)*N+i,(j+1)*N+i+1]});
const IAT=Array.from({length:NB},(_,b)=>{const o=[];for(let k=0;k<NI;k++)if(AROUND[k].includes(b))o.push(k);return o});
const R_LO=7,R_HI=15,R_DEF=11;
const roundsOf=c=>Math.max(R_LO,Math.min(R_HI,Math.round(+(c&&c.rnd)||R_DEF)));
const midOf=R=>Math.ceil(R/2);   // 빨간 흔적 라운드 (11라운드면 여섯째)
const TR_B=1,TR_Y=2,TR_R=3;      // 흔적 색: 파랑·노랑(출발)·빨강(가운데)
const traceCol=(i,mid)=>i===0?TR_Y:i===mid-1?TR_R:TR_B;
/* 도둑이 숨을 수 있는 건물: 처음엔 아무 곳, 그다음은 옆 건물 중 흔적이 없는 곳 */
const legalHides=path=>path.length?NBR_B[path[path.length-1]].filter(b=>!path.includes(b)):Array.from({length:NB},(_,b)=>b);
/* 헬기 h의 주인: 경찰마다 한 대씩, 남는 헬기는 라운드마다 돌아가며 맡음 (경찰 1명이면 3대 모두) */
const ownerOf=(h,pol,rn)=>!pol.length?-1:h<pol.length?pol[h]:pol[(Math.max(1,rn)-1+h)%pol.length];
const heliMoves=(hel,h)=>hel[h]<0?[]:NBR_I[hel[h]].filter(k=>!hel.includes(k));
const heliSearches=(hel,rv,h)=>hel[h]<0?[]:AROUND[hel[h]].filter(b=>!rv[b]);

/* 공개 정보와 맞는 도둑의 길 모두 (경찰 봇·도둑 어려움 봇이 씀). 5×5에서 13칸 길도 10만 개 남짓이라 그대로 셈
   t: 도둑이 지금까지 숨은 수(= 길이), es: 빈 건물 수색 [건물, 그때 길이], tr: 찾은 흔적 [건물, 색, 그때 길이], mid: 빨간 흔적 라운드 */
let PF_KEY='',PF_OUT=null;   // 같은 공개 정보로 여러 헬기가 차례로 물으면 한 번만 셈
function pathsFor(t,es,tr,mid){
  const key=t+'|'+mid+'|'+JSON.stringify(es)+JSON.stringify(tr);if(key===PF_KEY)return PF_OUT;
  const out=pathsCalc(t,es,tr,mid);PF_KEY=key;PF_OUT=out;return out;
}
function pathsCalc(t,es,tr,mid){
  const out=[];if(t<=0)return out;
  const ban=Array.from({length:t},()=>new Uint8Array(NB));   // ban[i][b]: i번째 자리에 b가 올 수 없음 (빈 건물이었음)
  for(const [b,u] of es)for(let i=0;i<Math.min(u,t);i++)ban[i][b]=1;
  let fixY=-1,fixR=-1;const blue=[];   // 노랑·빨강은 자리가 정해짐. 파랑은 처음·가운데가 아닌 어딘가(찾은 때보다 앞)
  for(const [b,c,u] of tr){if(c===TR_Y)fixY=b;else if(c===TR_R)fixR=b;else blue.push([b,u])}
  const fixedOn=new Uint8Array(NB);if(fixY>=0)fixedOn[fixY]=1;if(fixR>=0)fixedOn[fixR]=1;
  const blueOn=new Uint8Array(NB);for(const [b] of blue)blueOn[b]=1;
  const p=new Array(t),used=new Uint8Array(NB);
  const ok=(i,b)=>{
    if(used[b]||ban[i][b])return false;
    if(i===0&&fixY>=0)return b===fixY;
    if(i===mid-1&&fixR>=0)return b===fixR;
    if(fixedOn[b])return false;
    if(blueOn[b]&&(i===0||i===mid-1))return false;
    for(const [bb,u] of blue)if(bb===b&&i>u-2)return false;   // 흔적은 찾았을 때 이미 지나간 자리 (그때 숨어 있던 곳이면 차였음)
    return true;
  };
  const due=i=>{for(const [b,u] of blue)if(i===u-1&&!used[b])return false;return true};   // 파랑 흔적은 찾은 때보다 앞(u-2 자리까지)에 있어야 함
  const dfs=i=>{
    if(i>0&&!due(i))return;
    if(i===t){for(const [b] of blue)if(!used[b])return;out.push(p.slice());return}
    const cand=i===0?null:NBR_B[p[i-1]];
    if(cand){for(const b of cand)if(ok(i,b)){p[i]=b;used[b]=1;dfs(i+1);used[b]=0}}
    else for(let b=0;b<NB;b++)if(ok(i,b)){p[i]=b;used[b]=1;dfs(i+1);used[b]=0}
  };
  dfs(0);return out;
}
/* b에서 시작해 막히지 않고 need번 더 옮길 수 있는지 (used: 이미 흔적이 있는 건물) */
function canRun(b,used,need){
  if(need<=0)return true;
  used[b]=1;let ok=false;
  for(const m of NBR_B[b])if(!used[m]&&canRun(m,used,need-1)){ok=true;break}
  used[b]=0;return ok;
}
const freeNbr=(b,path)=>NBR_B[b].filter(m=>m!==b&&!path.includes(m)).length;

/* ----- 봇 -----
   경찰: 공개 정보와 맞는 도둑의 길(S)마다 무게를 주고(이번 라운드 처음 헬기 자리 hel0 둘레는 도둑이 피한다고 봄, beta)
   지금 자리 확률(car)·흔적 확률(old)·다음 라운드 자리 확률(nx)을 셈.
   수색 = 지금 잡을 확률 + 정보(결과 셋의 엔트로피) + 그 자리에서 다음 라운드에 노릴 확률, 이동 = 옮긴 자리에서 다음 라운드에 노릴 확률 */
const PLV=[{rnd:.4,lam:0,gam:.35,noise:.18,beta:0},{rnd:.08,lam:.15,gam:.6,noise:.05,beta:0},{rnd:0,lam:.25,gam:.7,noise:.004,beta:.9}];
function policeView(X){return {t:X.path?X.path.length:X.t,es:X.es,tr:X.tr,mid:X.mid,hel:X.hel,hel0:X.hel0,rv:X.rv}}
const adjN=(b,hel)=>{let n=0;if(hel)for(const k of hel)if(k>=0&&AROUND[k].includes(b))n++;return n};
function beliefOf(P,beta){
  beta=beta||0;
  const S=pathsFor(P.t,P.es,P.tr,P.mid),n=S.length,car=new Float64Array(NB),old=new Float64Array(NB),nx=new Float64Array(NB);
  let W=0;
  for(const p of S){
    const t=p.length,last=p[t-1],w=beta?Math.exp(-beta*adjN(last,P.hel0)):1;W+=w;car[last]+=w;
    for(let i=0;i<t-1;i++)old[p[i]]+=w;
    const used=new Uint8Array(NB);for(const b of p)used[b]=1;
    const L=NBR_B[last].filter(m=>!used[m]);if(!L.length)continue;
    let z=0;const lw=L.map(m=>{const v=beta?Math.exp(-beta*adjN(m,P.hel)):1;z+=v;return v});
    L.forEach((m,k)=>{nx[m]+=w*lw[k]/z});
  }
  if(W)for(let b=0;b<NB;b++){car[b]/=W;old[b]/=W;nx[b]/=W}
  return {S,n,car,old,nx};
}
const lg=x=>x>0?Math.log2(x):0;
function infoGain(B,b){   // 수색 결과(차·흔적·빈 곳)의 엔트로피 = 길 후보에 대해 얻는 정보 (0~1)
  if(B.n<2)return 0;
  const c=B.car[b],o=B.old[b],e=Math.max(0,1-c-o);
  return -(c*lg(c)+o*lg(o)+e*lg(e))/Math.log2(3);
}
function policeAction(P,h,lv,rnd){
  rnd=rnd||Math.random;const L=PLV[Math.max(0,Math.min(2,lv|0))];
  const mv=heliMoves(P.hel,h),sr=heliSearches(P.hel,P.rv,h);
  if(!mv.length&&!sr.length)return null;
  const any=()=>{const all=[...sr.map(b=>({t:'search',h,b})),...mv.map(k=>({t:'move',h,k}))];return all[rnd()*all.length|0]};
  if(rnd()<L.rnd)return any();
  const B=beliefOf(P,L.beta);
  if(!B.n)return any();
  /* 다른 헬기가 이미 노리는 건물은 덜 셈 (여럿이 같은 곳을 맡지 않게) */
  const others=new Uint8Array(NB);P.hel.forEach((k,j)=>{if(j!==h&&k>=0)for(const b of AROUND[k])others[b]=1});
  const pot=k=>{let m=0;for(const b of AROUND[k]){if(P.rv[b])continue;const v=B.nx[b]*(others[b]?.55:1);if(v>m)m=v}return m};
  let best=null,bs=-1e9;
  const take=(a,v)=>{v+=(rnd()-.5)*2*L.noise;if(v>bs){bs=v;best=a}};
  const here=pot(P.hel[h]);
  for(const b of sr)take({t:'search',h,b},B.car[b]+L.lam*infoGain(B,b)+L.gam*here);
  for(const k of mv)take({t:'move',h,k},L.gam*pot(k));
  return best;
}
/* 헬기 놓기: 둘레 건물이 겹치지 않게 흩어 놓음 */
function placeHeli(hel,rnd){
  rnd=rnd||Math.random;
  const free=[];for(let k=0;k<NI;k++)if(!hel.includes(k))free.push(k);
  const cov=new Uint8Array(NB);for(const k of hel)if(k>=0)for(const b of AROUND[k])cov[b]=1;
  let best=[],bs=-1;
  for(const k of free){let v=0;for(const b of AROUND[k])if(!cov[b])v++;if(v>bs){bs=v;best=[k]}else if(v===bs)best.push(k)}
  return best[rnd()*best.length|0];
}
/* 도둑: 헬기 둘레를 피하고(지금·한 칸 옮긴 뒤), 끝까지 갈 길이 남는 곳. 어려움은 경찰이 보는 확률이 낮고 헬기에서 먼 곳, 다음 라운드에 갈 곳이 안전한 곳을 보고 비슷한 곳끼리는 섞어 고름 */
const TLV=[null,{adj:3,near:.9,mob:.35,mg:0,room:0,noise:.5},{adj:5,near:.34,mob:.17,mg:2.73,room:1.65,noise:.02,temp:.25,edge:1.48,beta:0,far:1.92,ahead:1.89}];   // 어려움 값은 봇끼리 대전으로 고름(docs/citychase.md '균형')
function roomOf(b,used){   // b에서 흔적을 피해 닿을 수 있는 건물 수
  const seen=new Uint8Array(NB),q=[b];seen[b]=1;let n=0;
  for(let h=0;h<q.length;h++){const c=q[h];n++;for(const m of NBR_B[c])if(!seen[m]&&!used[m]){seen[m]=1;q.push(m)}}
  return n;
}
/* 헬기에서 b 둘레 교차로까지 가장 가까운 이동 수 */
const IDIST=(()=>{const d=[];for(let a=0;a<NI;a++){d.push([]);for(let b=0;b<NI;b++)d[a].push(Math.abs(IX(a)-IX(b))+Math.abs(IY(a)-IY(b)))}return d})();
function heliDist(b,hel){let m=9;for(const k of hel){if(k<0)continue;for(const q of IAT[b])m=Math.min(m,IDIST[k][q])}return m}
function thiefAction(X,lv,rnd,W){
  rnd=rnd||Math.random;
  const path=X.path,L=legalHides(path);if(!L.length)return -1;
  const need=X.R-path.length-1;   // 이번에 숨은 뒤에도 옮겨야 하는 수
  const used=new Uint8Array(NB);for(const b of path)used[b]=1;
  const run=b=>canRun(b,used,need);
  const adj=b=>adjN(b,X.hel);
  const near=b=>{let n=0;for(const k of X.hel){if(k<0||AROUND[k].includes(b))continue;if(NBR_I[k].some(q=>AROUND[q].includes(b)))n++}return n};
  if(lv<=0&&!W){
    const safe=L.filter(run),pool=safe.length?safe:L;
    if(rnd()<.5)return pool[rnd()*pool.length|0];
    let m=1e9,o=[];for(const b of pool){const v=adj(b);if(v<m){m=v;o=[b]}else if(v===m)o.push(b)}return o[rnd()*o.length|0];
  }
  const w=W||TLV[Math.min(2,lv)];
  let mg=null;
  if(w.mg&&path.length){const B=beliefOf({t:path.length,es:X.es,tr:X.tr,mid:X.mid,hel:X.hel,hel0:X.hel},w.beta||0);mg=B.nx}   // 경찰 쪽에서 본 다음 자리 확률
  let best=-1,bs=-1e9;const sc=[];
  for(const b of L){
    let v=-w.adj*adj(b)-w.near*near(b)+w.mob*Math.min(3,freeNbr(b,path.concat(b)))+(run(b)?0:-30);
    if(w.room){used[b]=1;v+=w.room*Math.min(need+1,roomOf(b,used))/(need+1);used[b]=0}
    if(w.far)v+=w.far*Math.min(3,heliDist(b,X.hel));
    if(w.ahead&&need>0){used[b]=1;let m=-9;for(const c of NBR_B[b])if(!used[c]){const q=-adj(c)-.4*near(c);if(q>m)m=q}used[b]=0;v+=w.ahead*m}
    if(mg)v-=w.mg*mg[b];
    else if(w.edge&&!path.length){const e=Math.min(BX(b),BY(b),N-1-BX(b),N-1-BY(b));v+=e===0?w.edge:0}   // 첫 자리: 가장자리 쪽(헬기 하나만 닿는 곳이 많음)
    v+=(rnd()-.5)*w.noise;sc.push(v);
    if(v>bs){bs=v;best=b}
  }
  if(w.temp){   // 섞기: 점수가 비슷한 곳 사이에서 고정된 습관이 생기지 않게
    let z=0;const e=sc.map(v=>{const x=Math.exp((v-bs)/w.temp);z+=x;return x});
    let r=rnd()*z;for(let k=0;k<L.length;k++){r-=e[k];if(r<=0)return L[k]}
  }
  return best;
}

/* ---------- 규칙 설명·방 설정 ---------- */
G.rulesHTML='<ol class="rules"><li><b>목표</b> : 도둑 한 명과 나머지 경찰이 겨룹니다. 경찰은 라운드가 다 끝나기 전에 도둑의 차를 찾으면 이기고, 도둑은 끝까지 숨으면 이깁니다</li><li><b>준비</b> : 주사위로 도둑을 정합니다. 경찰은 헬리콥터 3대를 교차로에 놓습니다(인원과 상관없이 3대)</li><li><b>도둑</b> : 라운드마다 바로 옆 건물(대각선 빼고)로 몰래 옮겨 숨습니다. 첫 라운드는 아무 건물이나 고릅니다. 지나간 건물에는 흔적이 남고, 흔적이 있는 건물로는 다시 갈 수 없습니다</li><li><b>경찰</b> : 헬기마다 한 번씩 옆 교차로로 옮기거나, 둘레 건물 넷 중 하나를 들어 봅니다. 순서는 자유입니다</li><li><b>흔적</b> : 찾은 흔적은 건물 위에 올려 둡니다. 노랑은 출발한 곳, 빨강은 가운데 라운드에 숨었던 곳이고 파랑은 그 밖의 곳입니다</li><li><b>끝</b> : 차를 찾거나 도둑이 갈 곳이 없으면 경찰 승리, 마지막 라운드까지 숨으면 도둑 승리입니다</li></ol>';
G.defaults={max:3,turn:30,rnd:R_DEF,pickfirst:0};
G.roomSet=[{lever:1,k:'turn',label:'제한 시간',unit:'초',lo:10,hi:120,step:5,desc:'도둑은 시간이 지나면 무작위 건물로 옮기고, 헬기는 무작위로 수색합니다. 연결이 끊겨도 시간은 흐르고, 45초가 지나면 탈주로 처리합니다'},{lever:1,k:'rnd',label:'라운드',unit:'',lo:R_LO,hi:R_HI,step:1,desc:'도둑이 이만큼 숨으면 이깁니다. 원래 규칙은 11라운드이고, 빨간 흔적은 가운데 라운드에 남습니다'}];
G.ruleSet=[{k:'pickfirst',pick:1,label:'도둑',desc:'선택: 방장이 이름표 메뉴의 [선]으로 도둑을 고릅니다. 무작위: 주사위로 정하고, 바로 시작하면 다음 사람이 도둑입니다'}];
G.boardSet=c=>{
  const rs=roomSetOf(G,c),num=k=>({kind:'num',...rs.find(x=>x.k===k),v:+(c[k]??G.defaults[k]),diff:k==='rnd'&&roundsOf(c)!==R_DEF});
  return [num('rnd'),num('turn'),rbRuleItem(G.ruleSet[0],c)];
};
G.cfgChips=c=>`<span class="chip">라운드 <b>${roundsOf(c)}</b></span><span class="chip">제한 시간 <b>${+c.turn}초</b></span><span class="chip">도둑 <b>${+c.pickfirst?'선택':'무작위'}</b></span>`;
G.cfgSum=c=>`${roundsOf(c)}라운드 · 제한 시간 ${+c.turn}초 · 도둑 ${+c.pickfirst?'선택':'무작위'}`;
G.roomSub=()=>'2~4명 보드게임';
G.pubExtra=()=>({});
G.cardInfo=(c,nowN)=>`<p class="cardinfo">도둑 한 명과 경찰이 겨룹니다. 헬기는 늘 3대입니다.${nowN>4?'<br>시티 체이스는 최대 4명까지 할 수 있습니다.':''}</p>`;
G.rankTitle=()=>'';
G.finLabel=()=>'';
G.noEmotes=[];
G.keys={};
G.keyActions=[];
G.cardHTML=()=>'';G.drawFace=()=>{};G.cmpCard=()=>0;G.labelOf=()=>'';

/* ---------- 방장 엔진 ---------- */
const active=i=>!H.players[i].finished;
const activeSeats=()=>{const o=[];for(let i=0;i<H.cc.cnt;i++)if(active(i))o.push(i);return o};
const polOf=()=>{const X=H.cc,o=[];for(let i=0;i<X.cnt;i++)if(i!==X.th&&active(i))o.push(i);return o};
const ownNow=h=>ownerOf(h,polOf(),H.cc.rn);
/* 아직 할 일이 남은 헬기 (놓기 단계: 안 놓은 헬기, 경찰 단계: 아직 안 움직인 헬기) */
function pendHelis(seat){
  const X=H.cc,o=[];
  for(let h=0;h<NH;h++){
    const due=X.ph==='heli'?X.hel[h]<0:X.ph==='police'?!X.hd[h]:false;
    if(due&&(seat==null||ownNow(h)===seat))o.push(h);
  }
  return o;
}
function setTurn(){
  const X=H.cc;
  if(X.ph==='thief'){H.turn=X.th;return}
  const p=pendHelis();H.turn=p.length?ownNow(p[0]):X.th;
  if(!active(H.turn))H.turn=activeSeats()[0];
}
function sameNames(a,b){return a.length===b.length&&a.every(x=>b.includes(x))}
function pickThief(again,cnt){
  const ns=H.players.slice(0,cnt).map(p=>p.name),L=H.ccLast;
  if(again&&L&&sameNames(ns,L.ns)&&ns.includes(L.th))return (ns.indexOf(L.th)+1)%cnt;   // 바로 시작: 다음 사람이 도둑
  return typeof firstSeat==='function'?firstSeat(cnt):Math.random()*cnt|0;
}
/* 큰 건물 10개·작은 건물 15개를 무작위로 (모양만, 규칙에는 상관없음) */
function cityLayout(){const a=Array.from({length:NB},(_,b)=>b<10?1:0);shuffle(a);return a.map((v,b)=>v|(((Math.random()*6)|0)<<1))}
const evPush=e=>{const X=H.cc;X.n++;e.n=X.n;X.ev.push(e);if(X.ev.length>12)X.ev.shift()};
function beginHeli(){
  const X=H.cc;X.ph='heli';setTurn();H.graceUntil=0;H.deadline=clock()+H.cfg.turn*1000;
  H.botActAt=clock()+rand(900,1500);mark();
}
function beginThief(){
  const X=H.cc;X.ph='thief';X.rn++;X.em=[];
  if(X.path.length&&!legalHides(X.path).length){
    evPush({k:'x'});addLog(`${X.rn}라운드 도둑이 갈 곳이 없어 경찰 승리`,'fin');over({why:'trap',w:polOf()});return;
  }
  H.turn=X.th;H.graceUntil=0;H.deadline=clock()+H.cfg.turn*1000;
  const last=X.ev.length?X.ev[X.ev.length-1].k:'';
  H.botActAt=H.players[X.th].bot?clock()+(last==='s'?rand(2000,2600):rand(1100,1800)):0;mark();
}
function beginPolice(){
  const X=H.cc;X.ph='police';X.hd=[0,0,0];X.hel0=X.hel.slice();
  for(let h=0;h<NH;h++)if(!heliMoves(X.hel,h).length&&!heliSearches(X.hel,X.rv,h).length)X.hd[h]=1;   // 아무것도 못 하는 헬기는 넘김
  setTurn();H.graceUntil=0;H.deadline=clock()+H.cfg.turn*1000;
  H.botActAt=clock()+rand(1100,1700);mark();   // 숨기 연출 뒤
  if(X.hd.every(v=>v))afterPolice();
}
function over(res){
  const X=H.cc;X.res=res;X.ph='end';
  for(const s of activeSeats()){const p=H.players[s];p.rank=res.w.includes(s)?1:2;p.finished=true;p.hand=[]}
  H.ccLast={ns:H.players.slice(0,X.cnt).map(p=>p.name),th:H.players[X.th].name};
  H.phase='over';H.botActAt=0;mark();
  H.players.forEach((p,i)=>{if(p.bot&&Math.random()<.5)botEmote(i,'gg',800+Math.random()*1600)});
}
const BOT_GAP={p:[600,850],m:[850,1200],s:[1750,2200]};   // 봇은 앞 사건의 연출(EV_MS)이 끝난 뒤에
const botWait=k=>{const g=BOT_GAP[k]||[900,1300];H.botActAt=Math.max(H.botActAt||0,clock()+rand(g[0],g[1]))};
function afterPolice(){
  const X=H.cc;
  for(const h of pendHelis())if(!heliMoves(X.hel,h).length&&!heliSearches(X.hel,X.rv,h).length)X.hd[h]=1;
  if(pendHelis().length){setTurn();mark();return}
  if(X.rn>=X.R){addLog(`${X.R}라운드까지 숨어 도둑 승리`,'fin');over({why:'escape',w:[X.th]});return}
  beginThief();
}
function doPlace(seat,h,k){
  const X=H.cc;
  if(H.phase!=='play'||X.ph!=='heli'||!Number.isInteger(k)||k<0||k>=NI||X.hel.includes(k))return false;
  if(h==null){const p=pendHelis(seat);if(!p.length)return false;h=p[0]}
  if(!Number.isInteger(h)||h<0||h>=NH||X.hel[h]>=0||ownNow(h)!==seat)return false;
  X.hel[h]=k;evPush({k:'p',h,to:k});botWait('p');
  addLog(`${H.players[seat].name} ${HELI_NAME[h]} 헬기 ${iName(k)}`);
  if(pendHelis().length){setTurn();mark();return true}
  beginThief();return true;
}
function doHide(seat,b){
  const X=H.cc;
  if(H.phase!=='play'||X.ph!=='thief'||seat!==X.th||!legalHides(X.path).includes(b))return false;
  X.path.push(b);X.pos=b;evPush({k:'t',b});
  addLog(`${X.rn}라운드 도둑이 숨었습니다`);
  beginPolice();return true;
}
const heliOK=(seat,h)=>{const X=H.cc;return H.phase==='play'&&X.ph==='police'&&Number.isInteger(h)&&h>=0&&h<NH&&!X.hd[h]&&ownNow(h)===seat};
function doMove(seat,h,k){
  const X=H.cc;
  if(!heliOK(seat,h)||!heliMoves(X.hel,h).includes(k))return false;
  const f=X.hel[h];X.hel[h]=k;X.hd[h]=1;evPush({k:'m',h,f,to:k});botWait('m');
  addLog(`${X.rn}라운드 ${HELI_NAME[h]} 헬기 ${iName(k)}로`);
  afterPolice();return true;
}
function doSearch(seat,h,b){
  const X=H.cc;
  if(!heliOK(seat,h)||!heliSearches(X.hel,X.rv,h).includes(b))return false;
  X.hd[h]=1;botWait('s');
  if(b===X.pos){
    evPush({k:'s',h,b,r:4});addLog(`${X.rn}라운드 ${HELI_NAME[h]} 헬기가 ${bName(b)}에서 차를 찾아 경찰 승리`,'fin');
    over({why:'catch',w:polOf(),h,b});return true;
  }
  const i=X.path.indexOf(b);
  if(i>=0){const c=traceCol(i,X.mid);X.rv[b]=c;X.tr.push([b,c,X.path.length]);evPush({k:'s',h,b,r:c});addLog(`${X.rn}라운드 ${HELI_NAME[h]} 헬기 ${bName(b)} 흔적`)}
  else{X.es.push([b,X.path.length]);X.em.push(b);evPush({k:'s',h,b,r:0});addLog(`${X.rn}라운드 ${HELI_NAME[h]} 헬기 ${bName(b)} 빈 건물`)}
  afterPolice();return true;
}
function doSurrender(i){
  const X=H.cc;
  if(H.phase!=='play'||i<0||i>=X.cnt||!active(i))return;
  const p=H.players[i];p.finished=true;p.hand=[];p.surrendered=true;p.rank=H.rankBottom--;
  addLog(`${p.name} ${p.deserter?'탈주':'항복'}`,'lie');
  if(i===X.th){addLog('경찰 승리','fin');over({why:'gone',w:polOf()});return}
  if(!polOf().length){addLog(`${H.players[X.th].name} 승리`,'fin');over({why:'gone',w:[X.th]});return}
  if(X.ph==='police'){afterPolice();return}
  setTurn();mark();
}
/* 시간 초과·봇 */
function autoHeli(seat,h,bot){
  const X=H.cc,lv=bot?botLv(H.players[seat]):-1;
  if(X.ph==='heli'){doPlace(seat,h,placeHeli(X.hel));return}
  let a=null;
  if(bot)a=policeAction(policeView(X),h,lv);
  else{const sr=heliSearches(X.hel,X.rv,h),mv=heliMoves(X.hel,h);a=sr.length?{t:'search',h,b:sr[Math.random()*sr.length|0]}:mv.length?{t:'move',h,k:mv[Math.random()*mv.length|0]}:null}
  if(!a){X.hd[h]=1;afterPolice();return}
  if(!(a.t==='search'?doSearch(seat,h,a.b):doMove(seat,h,a.k))){X.hd[h]=1;afterPolice()}
}
function autoHide(bot){
  const X=H.cc,b=bot?thiefAction(X,botLv(H.players[X.th])):(()=>{const L=legalHides(X.path);return L[Math.random()*L.length|0]})();
  if(b<0||!doHide(X.th,b)){const L=legalHides(X.path);if(L.length)doHide(X.th,L[0])}
}
const ready=(p,t)=>p.bot&&!(p.away&&t<p.awayAt+AWAY_WAIT);
G._test={PLV,TLV,roomOf,adjN,N,NB,NI,NH,BX,BY,IX,IY,bName,iName,NBR_B,NBR_I,AROUND,IAT,legalHides,ownerOf,heliMoves,heliSearches,pathsFor,canRun,traceCol,midOf,roundsOf,beliefOf,infoGain,policeAction,policeView,placeHeli,thiefAction,doPlace,doHide,doMove,doSearch,doSurrender,pendHelis,polOf,ownNow};
G.engine={
  start(){
    const again=H.phase==='over',cnt=Math.max(2,Math.min(H.players.length,4));
    Object.assign(H,{phase:'play',log:[],seatNote:{},field:[],last:null,reveal:null,shouts:[],pending:null,rankNext:1,rankBottom:cnt,known:{}});
    H.players.forEach((p,i)=>{p.finished=false;p.rank=null;p.surrendered=false;if(i<cnt)p.hand=[0];else{p.hand=[];p.finished=true;p.rank=i+1}});
    const th=pickThief(again,cnt),R=roundsOf(H.cfg);
    H.cc={cnt,th,R,mid:midOf(R),ph:'heli',rn:0,n:0,pos:-1,path:[],hel:[-1,-1,-1],hel0:[-1,-1,-1],hd:[0,0,0],rv:new Array(NB).fill(0),es:[],tr:[],em:[],ev:[],bl:cityLayout(),res:null};
    addLog(`${H.players[th].name} 도둑`,'sys');
    beginHeli();
  },
  act(seat,a){
    if(a.t==='surrender'){doSurrender(seat);return}
    if(a.t==='place')doPlace(seat,a.h,a.k);
    else if(a.t==='hide')doHide(seat,a.b);
    else if(a.t==='move')doMove(seat,a.h,a.k);
    else if(a.t==='search')doSearch(seat,a.h,a.b);
  },
  tick(t){
    if(H.phase!=='play')return;
    const X=H.cc;
    if(X.ph==='thief'){
      const p=H.players[X.th];
      if(t>=H.deadline)autoHide(p.bot&&!awayHuman(p));
      else if(H.botActAt&&t>=H.botActAt&&ready(p,t))autoHide(true);
      return;
    }
    if(X.ph!=='heli'&&X.ph!=='police')return;
    if(t>=H.deadline){   // 남은 헬기를 한꺼번에
      for(let g=0;g<6&&H.phase==='play'&&(X.ph==='heli'||X.ph==='police');g++){const P=pendHelis();if(!P.length)break;const h=P[0],s=ownNow(h),p=H.players[s];autoHeli(s,h,p.bot&&!awayHuman(p))}
      return;
    }
    if(H.botActAt&&t>=H.botActAt){
      const h=pendHelis().find(h=>ready(H.players[ownNow(h)],t));
      if(h!=null)autoHeli(ownNow(h),h,true);   // 다음 봇 시각은 행동마다 botWait
    }
  },
  /* 받는 사람마다 따로: 도둑의 자리·길은 도둑에게만(끝나면 모두에게). 놓기·경찰 단계는 할 일이 남은 사람마다 차례 */
  snap(s,you,t){
    const X=H.cc,end=H.phase==='over',me=you===X.th,seat=you>=0&&you<X.cnt;
    const ev=X.ev.map(e=>e.k==='t'&&!me&&!end?{n:e.n,k:'t'}:{...e});
    s.cc={cnt:X.cnt,th:X.th,R:X.R,mid:X.mid,ph:X.ph,rn:X.rn,n:X.n,hel:X.hel.slice(),hel0:X.hel0.slice(),hd:X.hd.slice(),rv:X.rv.slice(),tr:X.tr.map(a=>a.slice()),es:X.es.map(a=>a.slice()),em:X.em.slice(),ev,bl:X.bl,
      own:Array.from({length:NH},(_,h)=>ownNow(h)),t:X.path.length,res:X.res?{...X.res,w:X.res.w.slice()}:null,out:Array.from({length:X.cnt},(_,i)=>H.players[i].surrendered?1:0)};
    if(me||end){s.cc.pos=X.pos;s.cc.path=X.path.slice()}
    if(H.phase==='play'&&(X.ph==='heli'||X.ph==='police')){
      const mine=seat&&pendHelis(you).length;
      if(mine)s.t=you;else{const P=pendHelis();if(P.length)s.t=ownNow(P[0]);else delete s.t}
    }
    s.gr=0;s.dl=Math.max(0,Math.round(H.deadline-t));
  },
  restore(){},
  emoPhase:ph=>ph==='play'||ph==='over'
};
const HELI_NAME=['분홍','노랑','초록'];

/* ---------- 화면 (모든 참가자) ----------
   2D(SVG)와 3D(공통 테이블 가운데 도시 판)는 같은 상태(CS)를 보고 그림. 모두 남쪽(아래)에서 북쪽을 봄.
   고른 것(pend): {k:'place',h,q} 헬기 놓기, {k:'hide',b} 숨기, {k:'move',h,q} 이동, {k:'search',h,b} 수색
   사건(ev)은 차례로 재생(EVQ): 헬기가 옮겨 가고 건물이 들렸다 내려온 뒤에야 흔적이 지붕에 올라감 (결과는 연출을 앞지르지 않음) */
const SEAT_C=['#c53026','#2b65ca','#1f7a2e','#c9831a'];   // 자리 색 (첫 차례 주사위 면과 같음)
const HELI_C=['#e8679b','#f2c230','#43a35a'];             // 분홍·노랑·초록 헬기
const TR_C=['','#3f7fe0','#f2c230','#d83a2e'];            // 흔적: 파랑·노랑·빨강
const EV_MS={p:520,m:620,s:1500,t:760,x:600};
const S_LIFT=[220,520,1150];   // 수색: 들기 시작·다 들림(보임)·내려오기 시작
let CS=null,pend=null,sel=-1,flash=null,flashAt=0;
let EVQ=[],evSeen=-1,evKey='',evEnd=0;
let elRoot=null,elSvg=null,elMain=null,elBar=null,elBarMe=null,elHint=null,lastBoard='',lastBar='',lastHint='';
const dblOn=()=>typeof dblTap!=='undefined'&&!!dblTap;
const nm=i=>V.ps[i]?V.ps[i].n:'?';
const seatMe=()=>{const m=myIdx();return !!CS&&m>=0&&m<CS.cnt};
const iAmThief=()=>seatMe()&&myIdx()===CS.th;
const playing=()=>!!(V&&V.cc&&V.st==='play'&&CS&&!introWait());
const isOut=i=>!!(CS&&CS.out&&CS.out[i]);
/* 내가 지금 움직일 수 있는 헬기 */
function myHelis(){
  if(!playing()||!seatMe()||V.t!==myIdx()||isOut(myIdx())||!myReady())return [];
  const m=myIdx(),o=[];
  for(let h=0;h<NH;h++){if(CS.own[h]!==m)continue;if(CS.ph==='heli'?CS.hel[h]<0:CS.ph==='police'?!CS.hd[h]:false)o.push(h)}
  return o;
}
const myHide=()=>playing()&&CS.ph==='thief'&&iAmThief()&&myReady();
function fixSel(){const L=myHelis();if(!L.includes(sel))sel=L.length?L[0]:-1}
function redraw(){drawAll();G.buttons();P3.dirty=true}
/* 소리 */
function sndLift(vol){tone(1100,.03,{type:'triangle',vol:vol*.5});hiss(.02,{freq:3400,q:3,vol:vol*.4})}
function sndNo(){sfx('no')}
function sndRotor(at,len){for(let k=0;k<Math.round(len/.09);k++)hiss(.05,{freq:900+k%2*200,q:1.5,vol:.05,at:at+k*.09})}
function sndCar(at){tone(95,.35,{type:'sawtooth',vol:.05,at,slide:150});hiss(.25,{freq:500,q:1,vol:.05,at})}
function sndCreak(at){tone(210,.12,{type:'triangle',vol:.08,at,slide:260});hiss(.05,{freq:1800,q:2,vol:.05,at})}
function sndThud(at){tone(120,.1,{type:'triangle',vol:.18,at});hiss(.06,{freq:650,vol:.1,at})}
function sndTrace(at){tone(880,.08,{type:'triangle',vol:.1,at});tone(1320,.12,{type:'triangle',vol:.08,at:at+.08})}
function sndEmpty(at){tone(300,.08,{type:'triangle',vol:.06,at})}
function sndSiren(at){for(let k=0;k<6;k++)tone(k%2?740:990,.2,{type:'square',vol:.035,at:at+k*.21})}
function sndWin(at){[660,880,1320].forEach((f,k)=>tone(f,.13,{type:'square',vol:.035,at:at+k*.1}))}

/* ----- 사건 재생 ----- */
function evSync(){
  if(!CS)return;
  const key=(V.di||0)+':'+CS.th+':'+CS.bl.join('');
  const top=CS.ev.length?CS.ev[CS.ev.length-1].n:0;
  if(key!==evKey){evKey=key;EVQ=[];evEnd=0;evSeen=top}   // 새 판: 들어올 때 이미 지난 사건은 재생하지 않음
  const now=clock();
  for(const e of CS.ev){
    if(e.n<=evSeen)continue;evSeen=e.n;
    const t0=Math.max(now,evEnd),dur=EV_MS[e.k]||400;EVQ.push({e,t0,dur});evEnd=t0+dur;
    const a=(t0-now)/1000;
    if(e.k==='p'||e.k==='m')sndRotor(a,dur/1000);
    else if(e.k==='t'){if(iAmThief()||V.st==='over')sndCar(a);else hiss(.3,{freq:400,q:1,vol:.04,at:a})}
    else if(e.k==='s'){sndRotor(a,.2);sndCreak(a+S_LIFT[0]/1000);const r=e.r,b=a+S_LIFT[1]/1000;if(r===4)sndSiren(b);else if(r)sndTrace(b);else sndEmpty(b);sndThud(a+(S_LIFT[2]+300)/1000)}
  }
  EVQ=EVQ.filter(q=>q.t0+q.dur>now-50);
}
const evBusy=()=>EVQ.some(q=>q.t0+q.dur>clock());
/* 화면에 보일 상태: 아직 재생이 안 끝난 사건은 되돌려 봄 */
function shownState(now){
  const hel=CS.hel.slice(),rv=CS.rv.slice();let t=CS.t,caught=V.st==='over'&&CS.res&&CS.res.why==='catch';
  for(let k=EVQ.length-1;k>=0;k--){
    const {e,t0,dur}=EVQ[k];if(now>=t0+dur)continue;
    if(e.k==='m')hel[e.h]=e.f;
    else if(e.k==='p')hel[e.h]=-1;
    else if(e.k==='s'){if(e.r>=1&&e.r<=3&&now<t0+S_LIFT[2])rv[e.b]=0;if(e.r===4&&now<t0+S_LIFT[1])caught=false}
    else if(e.k==='t'&&now<t0)t--;
  }
  return {hel,rv,t,caught};
}

/* ----- 누르기: 건물 b, 교차로 q, 헬기 h ----- */
function tapHeli(h){
  if(!CS)return;
  const L=myHelis();
  if(L.includes(h)&&CS.ph==='police'){sel=h;if(pend&&pend.h!==h)pend=null;sndLift(.1);redraw();return}
  if(CS.hel[h]>=0)tapInter(CS.hel[h]);
}
function tapBuilding(b){
  if(!CS||b<0||b>=NB)return;
  if(myHide()){
    if(!legalHides(CS.path||[]).includes(b)){noAt('b',b);return}
    if(pend&&pend.k==='hide'&&pend.b===b){if(dblOn())confirmPend();else{pend=null;sndLift(.08);redraw()}return}
    pend={k:'hide',b};sndLift(.12);redraw();return;
  }
  const L=myHelis();
  if(CS.ph==='police'&&L.length){
    const c=L.filter(h=>heliSearches(CS.hel,CS.rv,h).includes(b));
    if(!c.length){noAt('b',b);return}
    const h=c.includes(sel)?sel:c[0];sel=h;
    if(pend&&pend.k==='search'&&pend.b===b&&pend.h===h){if(dblOn())confirmPend();else{pend=null;sndLift(.08);redraw()}return}
    pend={k:'search',h,b};sndLift(.12);redraw();return;
  }
  if(L.length||myHide())noAt('b',b);
}
function tapInter(q){
  if(!CS||q<0||q>=NI)return;
  const L=myHelis();if(!L.length)return;
  if(CS.ph==='heli'){
    if(CS.hel.includes(q)){noAt('q',q);return}
    const h=L.includes(sel)?sel:L[0];
    if(pend&&pend.k==='place'&&pend.q===q){if(dblOn())confirmPend();else{pend=null;sndLift(.08);redraw()}return}
    pend={k:'place',h,q};sndLift(.12);redraw();return;
  }
  if(CS.ph!=='police')return;
  const own=CS.hel.indexOf(q);
  if(own>=0&&L.includes(own)){tapHeli(own);return}
  const c=L.filter(h=>heliMoves(CS.hel,h).includes(q));
  if(!c.length){noAt('q',q);return}
  const h=c.includes(sel)?sel:c[0];sel=h;
  if(pend&&pend.k==='move'&&pend.q===q&&pend.h===h){if(dblOn())confirmPend();else{pend=null;sndLift(.08);redraw()}return}
  pend={k:'move',h,q};sndLift(.12);redraw();
}
function noAt(k,i){pend=null;flash={k,i};flashAt=clock();sndNo();redraw()}
/* 판 좌표(건물 하나 = 1, 0~5)로 누름: 교차로 가까이면 교차로, 아니면 건물 */
function tapAt(fx,fy){
  if(!CS)return;
  if(fx<0||fx>=N||fy<0||fy>=N)return;
  const i=Math.round(fx)-1,j=Math.round(fy)-1;
  if(i>=0&&i<4&&j>=0&&j<4&&Math.hypot(fx-(i+1),fy-(j+1))<.24){tapInter(j*4+i);return}
  tapBuilding(Math.floor(fy)*N+Math.floor(fx));
}
let actLock=-1,actAt=0;
function confirmPend(){
  if(!pend)return;
  if(actLock===CS.n&&clock()-actAt<1500){sndNo();return}
  const p=pend;
  if(p.k==='hide'){if(!myHide())return;sendAct({t:'hide',b:p.b})}
  else{if(!myHelis().includes(p.h))return;
    if(p.k==='place')sendAct({t:'place',h:p.h,k:p.q});
    else if(p.k==='move')sendAct({t:'move',h:p.h,k:p.q});
    else sendAct({t:'search',h:p.h,b:p.b})}
  pend=null;actLock=CS.n;actAt=clock();redraw();
}

/* ----- 2D (SVG): 건물 하나 = 1, 판은 (0,0)~(5,5) ----- */
function boardHTML(){
  const now=clock(),S=shownState(now),me=iAmThief(),out=['<rect x="-.3" y="-.3" width="5.6" height="5.6" rx=".14" fill="#5d6a72"/>'];
  const legal=myHide()?legalHides(CS.path||[]):[],L=myHelis(),srch=new Set(),mvs=new Set();
  if(CS.ph==='police')for(const h of L){if(h!==sel&&L.includes(sel))continue;heliSearches(CS.hel,CS.rv,h).forEach(b=>srch.add(b));heliMoves(CS.hel,h).forEach(q=>mvs.add(q))}
  if(CS.ph==='heli'&&L.length)for(let q=0;q<NI;q++)if(!CS.hel.includes(q))mvs.add(q);
  const path=(me||V.st==='over')&&CS.path?CS.path:[];
  for(let b=0;b<NB;b++){
    const x=BX(b),y=BY(b),big=CS.bl[b]&1,hl=legal.includes(b)||srch.has(b),pk=pend&&(pend.k==='hide'||pend.k==='search')&&pend.b===b,fl=flash&&flash.k==='b'&&flash.i===b&&now-flashAt<700;
    out.push(`<rect x="${x+.12}" y="${y+.12}" width=".76" height=".76" rx=".06" fill="${big?'#c9b79a':'#e2d3b6'}" stroke="${fl?'#d6342a':pk?'#4f9d3f':hl?'#f2c94c':'#6b5a44'}" stroke-width="${fl||pk||hl?.07:.025}"/>`);
    const r=S.rv[b];if(r)out.push(`<circle cx="${x+.5}" cy="${y+.5}" r=".17" fill="${TR_C[r]}" stroke="#fff" stroke-width=".04"/>`);
    else{const i=path.indexOf(b);if(i>=0&&b!==CS.pos)out.push(`<circle cx="${x+.5}" cy="${y+.5}" r=".13" fill="${TR_C[traceCol(i,CS.mid)]}" opacity=".55"/>`)}
    if(CS.em.includes(b)&&!r)out.push(`<path d="M${x+.38} ${y+.5}l.08 .09l.18-.2" fill="none" stroke="#6b5a44" stroke-width=".05" stroke-linecap="round"/>`);
  }
  if(path.length>1)out.push(`<polyline points="${path.map(b=>(BX(b)+.5)+','+(BY(b)+.5)).join(' ')}" fill="none" stroke="#c53026" stroke-width=".05" opacity=".6"/>`);
  if((me||V.st==='over')&&CS.pos>=0)out.push(`<rect x="${BX(CS.pos)+.32}" y="${BY(CS.pos)+.38}" width=".36" height=".24" rx=".06" fill="#c53026" opacity="${V.st==='over'?1:.7}"/>`);
  if(pend&&pend.k==='hide')out.push(`<rect x="${BX(pend.b)+.32}" y="${BY(pend.b)+.38}" width=".36" height=".24" rx=".06" fill="#c53026" opacity=".45"/>`);
  for(const q of mvs)out.push(`<circle cx="${IX(q)+1}" cy="${IY(q)+1}" r=".09" fill="#4f9d3f" opacity=".8"/>`);
  if(flash&&flash.k==='q'&&now-flashAt<700)out.push(`<circle cx="${IX(flash.i)+1}" cy="${IY(flash.i)+1}" r=".14" fill="#d6342a"/>`);
  for(let h=0;h<NH;h++){const q=S.hel[h];if(q<0)continue;const on=L.includes(h)&&CS.ph==='police'&&h===sel;out.push(`<circle cx="${IX(q)+1}" cy="${IY(q)+1}" r=".2" fill="${HELI_C[h]}" stroke="${on?'#fff':'#2a2a2a'}" stroke-width="${on?.07:.03}"/>`)}
  if(pend&&(pend.k==='place'||pend.k==='move'))out.push(`<circle cx="${IX(pend.q)+1}" cy="${IY(pend.q)+1}" r=".2" fill="${HELI_C[pend.h]}" opacity=".5"/>`);
  return out.join('');
}
function onSvgClick(e){
  if(!CS)return;
  const pt=elSvg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;const m=elSvg.getScreenCTM();if(!m)return;
  const q=pt.matrixTransform(m.inverse());tapAt(q.x,q.y);
}
const helDots=i=>{let s='';for(let h=0;h<NH;h++)if(CS.own[h]===i&&!(CS.ph==='police'&&CS.hd[h]&&V.st==='play'))s+=`<i class="hd" style="--hc:${HELI_C[h]}"></i>`;return s};
function chipHTML(i){
  const me=myIdx(),p=V.ps[i];if(!p||i>=CS.cnt)return '';
  let on=false;
  if(introWait())on=IN.fp?IN.fp.idx(clock())===i:false;
  else if(V.st==='play'&&!p.sr)on=CS.ph==='thief'?i===CS.th:(CS.ph==='heli'||CS.ph==='police')&&CS.own.some((o,h)=>o===i&&(CS.ph==='heli'?CS.hel[h]<0:!CS.hd[h]));
  const r=CS.res,thief=i===CS.th&&!introWait();
  const st=p.sr===3?'탈주':p.sr?'항복':V.st==='over'?(r&&r.w.includes(i)?'승리':''):'';
  return `<div class="cc-p${on?' on':''}${i===me?' me':''}${p.sr?' out':''}" style="--pc:${SEAT_C[i]}"><i class="dot"></i><b>${esc(p.n)}${i===me?' (나)':''}</b><span class="role${thief?' th':''}">${introWait()?'':thief?'도둑':'경찰'}</span>${thief||introWait()?'':helDots(i)}${st?`<span class="st">${st}</span>`:''}${on&&V.st==='play'?'<span class="tb"><i></i></span>':''}</div>`;
}
function barHTML(){const n=CS.cnt,me=myIdx(),s=seatMe(),b=s?me:0,o=Array.from({length:n},(_,k)=>(b+k)%n);return (s?o.slice(1):o).map(chipHTML).join('')}
const meBarHTML=()=>seatMe()?chipHTML(myIdx()):'';
function hintText(){
  if(!V||!V.cc||!CS)return '';
  if(V.st==='play'){
    if(introWait())return '';
    if(CS.ph==='heli')return myHelis().length?'헬기 놓기':'';
    if(CS.ph==='thief')return iAmThief()?'':'도둑이 숨는 중';
    return '';
  }
  const r=CS.res;if(!r||evBusy())return '';
  if(r.why==='catch')return '경찰이 차를 찾았습니다';
  if(r.why==='trap')return '도둑이 갈 곳이 없어 경찰 승리';
  if(r.why==='escape')return '도둑이 끝까지 숨었습니다';
  return r.w.includes(CS.th)?'도둑 승리':'경찰 승리';
}
function drawHint(){if(!elHint)return;const h=hintText(),rd=!P3.on&&CS&&CS.rn?`${Math.min(CS.rn,CS.R)}/${CS.R}`:'',k=h+'|'+rd;if(k!==lastHint){elHint.textContent=h;elRoot.querySelector('.cc-rd').textContent=rd;lastHint=k}}
function fit(){
  if(!elRoot||elRoot.hidden)return;
  const bd=elRoot.querySelector('.cc-bd'),k=Math.min(bd.clientWidth,bd.clientHeight);
  if(k>0){elSvg.style.width=k+'px';elSvg.style.height=k+'px'}
}
function drawAll(){
  if(!CS||!elMain)return;
  fixSel();
  if(!P3.on){const bd=boardHTML();if(bd!==lastBoard){elMain.innerHTML=bd;lastBoard=bd}}
  const top=barHTML(),mb=meBarHTML(),key=top+'\u0001'+mb;if(key!==lastBar){elBar.innerHTML=top;elBarMe.innerHTML=mb;lastBar=key;P3.lay=''}
  drawHint();fit();
}

/* ---------- 3D: 공통 테이블 가운데 도시 판, 건물 25채, 헬기 3대, 라운드 판 ----------
   월드 좌표: 건물 b의 가운데 (BX-2)*P, (BY-2)*P. 교차로 q는 판 좌표 (IX+1, IY+1). 카메라는 남쪽에서 비스듬히(EL°) 내려다봄 */
const P=.82,FP=.58,FPB=.62,M=.2,BH=2.5*P,FH=BH+M,TOP=.12,GY=TOP+.004,HY=TOP+1.02,LIFT=.62,EL=56;
const TRK_GAP=.07,TRK_D=.36,TRK=TRK_GAP+TRK_D;   // 판 앞 라운드 판
const bWX=b=>(BX(b)-2)*P,bWZ=b=>(BY(b)-2)*P,qWX=q=>(IX(q)-1.5)*P,qWZ=q=>(IY(q)-1.5)*P;
const P3={on:false,built:false,fail:false,root:null,cam:null,dirty:true,lastR:0,lay:'',layAt:0,d:12,bld:[],heli:[],trk:[],trkKey:'',roofTr:[],gTr:null,car:null,glow:[],rings:[],ghostH:null,path:null,pathKey:'',ofs:[0,0]};
const ease=k=>k<=0?0:k>=1?1:k*k*(3-2*k);
const dropY=(x,h)=>x>=1?0:x<.68?h*(1-(x/.68)*(x/.68)):h*.1*Math.sin(Math.PI*(x-.68)/.32);
const GEO={},MAT={};
const INK=()=>MAT.ink||(MAT.ink=new THREE.MeshBasicMaterial({color:GFX_INK,side:THREE.BackSide}));
/* 건물 모양: 6가지 색 묶음 [벽, 창 밝음, 창 어두움, 지붕] */
const STY=[['#e8d9bd','#9ec6d8','#5d7f92','#a8937a'],['#d98f6c','#f6e3b4','#7a4d3a','#8c5a45'],['#9fb7a6','#e9f2e4','#4d6b5a','#6f8a78'],['#c9c3d9','#f3eefc','#5e587a','#8f88a8'],['#e3b85f','#fff1c9','#8a6420','#a77f36'],['#b9c7d6','#eaf4ff','#4a5f75','#7d90a5']];
function winTex(s,big){
  const k='w'+s+big;if(MAT[k])return MAT[k];
  const [wall,lit,dark]=STY[s],rows=big?7:4;
  const tex=canvasTex(64,128,(c,w,h)=>{c.fillStyle=wall;c.fillRect(0,0,w,h);
    for(let r=0;r<rows;r++)for(let q=0;q<3;q++){const x=8+q*18,y=10+r*(h-18)/rows;c.fillStyle=((r*3+q+s)%5)?dark:lit;c.fillRect(x,y,12,(h-18)/rows*.55)}
    c.fillStyle='rgba(0,0,0,.12)';c.fillRect(0,h-6,w,6)});
  return MAT[k]=tex;
}
function bldMesh(b,v){
  const big=v&1,s=(v>>1)%STY.length,fp=big?FPB:FP,h=big?.58+.06*((s+b)%3)/2:.34+.06*((s+b)%3)/2;
  const g=new THREE.Group(),lift=new THREE.Group();g.add(lift);
  const side=toon({map:winTex(s,big),rim:.12}),roof=toon({color:new THREE.Color(STY[s][3]).getHex(),rim:.05});
  side.transparent=roof.transparent=true;
  const body=new THREE.Mesh(GEO.bb||(GEO.bb=new THREE.BoxGeometry(1,1,1)),[side,side,roof,roof,side,side]);
  body.scale.set(fp,h,fp);body.position.y=h/2;body.castShadow=true;body.userData.b=b;lift.add(body);
  const ink=new THREE.Mesh(GEO.bb,INK());ink.scale.set(fp+.03,h+.03,fp+.03);ink.position.y=h/2;lift.add(ink);
  if((s+b)%3===0){const t=new THREE.Mesh(GEO.tk||(GEO.tk=new THREE.CylinderGeometry(.07,.07,.12,12)),roof);t.position.set(fp*.22,h+.06,-fp*.18);lift.add(t)}   // 지붕 물탱크
  g.position.set(bWX(b),GY,bWZ(b));
  g.userData={b,h,lift,body,ink,mats:[side,roof]};
  return g;
}
/* 헬기: 동그란 몸통·꼬리·스키드·날개, 아래로 내려 비추는 빛기둥(어느 교차로에 있는지) */
function heliMesh(h){
  const g=new THREE.Group(),col=new THREE.Color(HELI_C[h]).getHex(),m=toon({color:col,rim:.25}),dk=toon({color:0x2e2a28,rim:.1});
  const body=new THREE.Mesh(GEO.hb||(GEO.hb=new THREE.SphereGeometry(.15,20,14)),m);body.scale.set(1.25,.95,.95);g.add(body);
  const gl=new THREE.Mesh(GEO.hg||(GEO.hg=new THREE.SphereGeometry(.1,16,10,0,Math.PI*2,0,Math.PI/2)),MAT.glass||(MAT.glass=toon({color:0xbfe6ff,rim:.4})));gl.position.set(.08,.04,0);gl.rotation.z=-.5;g.add(gl);
  const tail=new THREE.Mesh(GEO.ht||(GEO.ht=new THREE.CylinderGeometry(.025,.045,.32,10)),m);tail.rotation.z=Math.PI/2;tail.position.set(-.3,.03,0);g.add(tail);
  const fin=new THREE.Mesh(GEO.hf||(GEO.hf=new THREE.BoxGeometry(.06,.12,.02)),m);fin.position.set(-.45,.08,0);g.add(fin);
  for(const z of [-.1,.1]){const sk=new THREE.Mesh(GEO.hs||(GEO.hs=new THREE.BoxGeometry(.32,.02,.02)),dk);sk.position.set(0,-.16,z);g.add(sk)}
  const ink=new THREE.Mesh(GEO.hb,INK());ink.scale.set(1.25*1.1,.95*1.1,.95*1.1);g.add(ink);
  const rotor=new THREE.Group();rotor.position.y=.17;g.add(rotor);
  for(let k=0;k<2;k++){const bl=new THREE.Mesh(GEO.hr||(GEO.hr=new THREE.BoxGeometry(.62,.012,.04)),dk);bl.rotation.y=k*Math.PI/2;rotor.add(bl)}
  const hub=new THREE.Mesh(GEO.hh||(GEO.hh=new THREE.CylinderGeometry(.025,.025,.05,8)),dk);hub.position.y=.15;g.add(hub);
  const tr=new THREE.Mesh(GEO.htr||(GEO.htr=new THREE.BoxGeometry(.012,.14,.02)),dk);tr.position.set(-.46,.08,.02);g.add(tr);
  const beamM=new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.22,depthWrite:false,blending:THREE.AdditiveBlending});
  const beam=new THREE.Mesh(GEO.beam||(GEO.beam=new THREE.CylinderGeometry(.03,.2,1,20,1,true)),beamM);beam.renderOrder=3;
  const spot=new THREE.Mesh(GEO.spot||(GEO.spot=new THREE.CircleGeometry(.2,28)),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.45,depthWrite:false}));spot.rotation.x=-Math.PI/2;spot.renderOrder=3;
  const halo=new THREE.Mesh(GEO.halo||(GEO.halo=new THREE.RingGeometry(.36,.42,36)),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.85,depthWrite:false,side:THREE.DoubleSide}));halo.rotation.x=-Math.PI/2;halo.position.y=.17;halo.visible=false;g.add(halo);
  body.userData.h=h;
  return {g,rotor,beam,spot,halo,body,beamM,spin:Math.random()*6};
}
function carMesh(){
  const g=new THREE.Group(),red=toon({color:0xd33a2c,rim:.25}),dk=toon({color:0x2a2420,rim:.1});
  const b=new THREE.Mesh(new THREE.BoxGeometry(.3,.07,.16),red);b.position.y=.06;g.add(b);
  const c=new THREE.Mesh(new THREE.BoxGeometry(.15,.06,.13),MAT.glass||toon({color:0xbfe6ff}));c.position.set(-.02,.125,0);g.add(c);
  const ink=new THREE.Mesh(new THREE.BoxGeometry(.32,.09,.18),INK());ink.position.y=.06;g.add(ink);
  for(const [x,z] of [[.09,.08],[-.09,.08],[.09,-.08],[-.09,-.08]]){const w=new THREE.Mesh(GEO.wh||(GEO.wh=new THREE.CylinderGeometry(.035,.035,.03,12)),dk);w.rotation.x=Math.PI/2;w.position.set(x,.035,z);g.add(w)}
  const sl=new THREE.Mesh(new THREE.BoxGeometry(.05,.025,.05),new THREE.MeshBasicMaterial({color:0x4aa3ff}));sl.position.set(-.02,.17,0);g.add(sl);g.userData.siren=sl;
  return g;
}
function traceMesh(c,ghost){
  const k='tr'+c+(ghost?'g':'');
  const m=MAT[k]||(MAT[k]=toon({color:new THREE.Color(TR_C[c]).getHex(),rim:.3}));if(ghost){m.transparent=true;m.opacity=.5;m.depthWrite=false}
  const t=new THREE.Mesh(GEO.trd||(GEO.trd=new THREE.CylinderGeometry(.1,.1,.03,24)),m);
  if(!ghost){const o=new THREE.Mesh(GEO.tri||(GEO.tri=new THREE.CylinderGeometry(.115,.115,.025,24)),INK());t.add(o)}
  return t;
}
/* 판 윗면: 아스팔트 길, 보도 블록, 차선, 좌표 */
function drawCityTex(g,Sz){
  const s=Sz/(2*FH),p=v=>(v+FH)*s;
  g.fillStyle='#6a5a4a';g.fillRect(0,0,Sz,Sz);
  g.fillStyle='#4b4f55';g.fillRect(p(-BH),p(-BH),2*BH*s,2*BH*s);
  g.strokeStyle='rgba(255,226,140,.75)';g.lineWidth=Math.max(2,Sz/380);g.setLineDash([Sz/90,Sz/110]);
  for(let k=1;k<N;k++){const v=(k-2.5)*P;g.beginPath();g.moveTo(p(-BH),p(v));g.lineTo(p(BH),p(v));g.stroke();g.beginPath();g.moveTo(p(v),p(-BH));g.lineTo(p(v),p(BH));g.stroke()}
  g.setLineDash([]);
  for(let b=0;b<NB;b++){const x=bWX(b),z=bWZ(b),w=FPB+.1;g.fillStyle='#b8b2a6';g.fillRect(p(x-w/2),p(z-w/2),w*s,w*s);g.strokeStyle='#8a8478';g.lineWidth=Math.max(1,Sz/700);g.strokeRect(p(x-w/2),p(z-w/2),w*s,w*s)}
  for(let q=0;q<NI;q++){g.fillStyle='rgba(255,255,255,.16)';g.beginPath();g.arc(p(qWX(q)),p(qWZ(q)),.1*s,0,7);g.fill()}
  g.fillStyle='rgba(255,236,196,.92)';g.textAlign='center';g.textBaseline='middle';g.font=`700 ${Math.round(.12*s)}px "IBM Plex Mono",monospace`;
  const lab=BH+M*.5;
  for(let k=0;k<N;k++){g.fillText('ABCDE'[k],p((k-2)*P),p(lab));g.fillText(String(N-k),p(-lab),p((k-2)*P))}
}
function d3Build(){
  if(P3.built||P3.fail)return P3.built;
  if(!T.ok||typeof THREE==='undefined'){P3.fail=true;return false}
  try{
    const root=new THREE.Group();root.visible=false;
    const bg=new THREE.Group();root.add(bg);P3.boardG=bg;
    const wood=toon({map:canvasTex(512,512,(g,w,h)=>{g.fillStyle='#6b4a2e';g.fillRect(0,0,w,h)}),rim:.08});
    const frame=new THREE.Mesh(new THREE.BoxGeometry(2*FH,TOP-.02,2*FH),wood);frame.position.y=.02+(TOP-.02)/2;frame.castShadow=frame.receiveShadow=true;bg.add(frame);
    const fo=new THREE.Mesh(new THREE.BoxGeometry(2*FH+.05,TOP,2*FH+.05),INK());fo.position.copy(frame.position);bg.add(fo);
    const top=new THREE.Mesh(new THREE.PlaneGeometry(2*FH-.02,2*FH-.02),toon({map:canvasTex(1024,1024,(g,w)=>drawCityTex(g,w)),rim:0}));top.rotation.x=-Math.PI/2;top.position.y=TOP+.002;top.receiveShadow=true;bg.add(top);
    /* 라운드 판: 판 앞에 칸을 판 나무 띠 */
    const tg=new THREE.Group();tg.position.set(0,0,FH+TRK_GAP+TRK_D/2);bg.add(tg);P3.trkG=tg;
    const tw=toon({color:0xb98a55,rim:.1}),tb=new THREE.Mesh(new THREE.BoxGeometry(2*FH,TOP-.02,TRK_D),tw);tb.position.y=.02+(TOP-.02)/2;tb.castShadow=tb.receiveShadow=true;tg.add(tb);
    const ti=new THREE.Mesh(new THREE.BoxGeometry(2*FH+.04,TOP,TRK_D+.04),INK());ti.position.y=tb.position.y;tg.add(ti);
    P3.bg=new THREE.Group();root.add(P3.bg);P3.hg=new THREE.Group();root.add(P3.hg);P3.mg=new THREE.Group();root.add(P3.mg);
    for(let h=0;h<NH;h++){const o=heliMesh(h);o.g.visible=false;o.beam.visible=o.spot.visible=false;P3.hg.add(o.g);P3.mg.add(o.beam);P3.mg.add(o.spot);P3.heli.push(o)}
    P3.car=carMesh();P3.car.visible=false;root.add(P3.car);
    P3.gTr=new THREE.Group();root.add(P3.gTr);   // 들린 건물 밑에 보이는 흔적
    /* 고를 수 있는 곳 표시: 지붕 빛(건물), 떠 있는 고리(교차로) */
    const glowM=c=>new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:.55,depthWrite:false});
    MAT.gOK=glowM(0xf2c94c);MAT.gPick=glowM(0x5fc24e);MAT.gNo=glowM(0xe0402e);
    for(let b=0;b<NB;b++){const m=new THREE.Mesh(GEO.gl||(GEO.gl=new THREE.PlaneGeometry(1,1)),MAT.gOK);m.rotation.x=-Math.PI/2;m.visible=false;m.renderOrder=6;P3.mg.add(m);P3.glow.push(m)}
    for(let q=0;q<NI;q++){const g=new THREE.Group();const r=new THREE.Mesh(GEO.rg||(GEO.rg=new THREE.RingGeometry(.13,.19,32)),MAT.rOK||(MAT.rOK=new THREE.MeshBasicMaterial({color:0x5fc24e,transparent:true,opacity:.9,depthWrite:false,side:THREE.DoubleSide})));r.rotation.x=-Math.PI/2;r.renderOrder=7;g.add(r);
      const d=new THREE.Mesh(GEO.rd||(GEO.rd=new THREE.CircleGeometry(.07,20)),MAT.rOK);d.rotation.x=-Math.PI/2;d.position.y=GY+.01-HY;d.renderOrder=7;g.add(d);
      g.position.set(qWX(q),HY,qWZ(q));g.visible=false;g.userData={r,d};P3.mg.add(g);P3.rings.push(g)}
    {const o=heliMesh(0);o.g.traverse(x=>{if(x.isMesh){x.material=MAT.ghost||(MAT.ghost=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.4,depthWrite:false}))}});o.g.visible=false;root.add(o.g);P3.ghostH=o}
    P3.ghostCar=carMesh();P3.ghostCar.traverse(x=>{if(x.isMesh)x.material=MAT.ghostC||(MAT.ghostC=new THREE.MeshBasicMaterial({color:0xd33a2c,transparent:true,opacity:.45,depthWrite:false}))});P3.ghostCar.visible=false;root.add(P3.ghostCar);
    P3.cam=new THREE.PerspectiveCamera(32,1,.1,100);
    T.scene.add(root);P3.root=root;P3.built=true;
  }catch(e){P3.fail=true;try{console.warn('시티 체이스 3D 준비 실패',e)}catch(_){}}
  return P3.built;
}
/* 판이 바뀌면(새 판) 건물을 다시 세움 */
function cityBuild(){
  const key=CS.bl.join(',');if(P3.cityKey===key)return;P3.cityKey=key;
  for(const g of P3.bld){P3.bg.remove(g);g.userData.mats.forEach(m=>m.dispose())}
  P3.bld=CS.bl.map((v,b)=>{const g=bldMesh(b,v);P3.bg.add(g);return g});
  for(const m of P3.roofTr)P3.root.remove(m);P3.roofTr=[];
  if(P3.path){P3.root.remove(P3.path);P3.path=null;P3.pathKey=''}
  for(const t of [...P3.gTr.children])P3.gTr.remove(t);
  P3.roofKey='';P3.revealAt=0;
}
function trackBuild(){
  const key=CS.R+':'+CS.mid;if(P3.trkKey===key)return;P3.trkKey=key;
  for(const o of P3.trk)P3.trkG.remove(o.g);P3.trk=[];
  const L=2*FH-.3,sp=L/CS.R;
  for(let k=0;k<CS.R;k++){
    const g=new THREE.Group();g.position.set(-L/2+sp*(k+.5),TOP,0);P3.trkG.add(g);
    const pit=new THREE.Mesh(GEO.pit||(GEO.pit=new THREE.CircleGeometry(.075,20)),MAT.pit||(MAT.pit=new THREE.MeshBasicMaterial({color:0x6e4b2a})));pit.rotation.x=-Math.PI/2;pit.position.y=.003;g.add(pit);
    const glow=new THREE.Mesh(GEO.pg||(GEO.pg=new THREE.RingGeometry(.085,.12,24)),MAT.pgl||(MAT.pgl=new THREE.MeshBasicMaterial({color:0xffe07a,transparent:true,opacity:.9,depthWrite:false})));glow.rotation.x=-Math.PI/2;glow.position.y=.004;glow.visible=false;g.add(glow);
    const t=traceMesh(traceCol(k,CS.mid));t.scale.setScalar(.7);t.position.y=.012;g.add(t);
    P3.trk.push({g,t,glow});
  }
}
const evAt=(k,now)=>EVQ.find(q=>q.e.k===k&&now>=q.t0&&now<q.t0+q.dur);
function d3Frame(now){
  if(!P3.on||!V||!V.cc||!CS)return false;
  EVQ=EVQ.filter(q=>q.t0+q.dur>now);
  const S=shownState(now),me=iAmThief(),over=V.st==='over',seeCar=me||over;
  if(!over)P3.revealAt=0;
  let busy=EVQ.length>0;
  /* 건물: 수색 중이면 들림, 도둑에게는 내 건물이 비침 */
  const lifted=new Map();
  for(const {e,t0,dur} of EVQ){if(e.k!=='s'||now<t0)continue;const x=now-t0;let y=0;
    if(x<S_LIFT[0])y=0;else if(x<S_LIFT[1])y=ease((x-S_LIFT[0])/(S_LIFT[1]-S_LIFT[0]));else if(e.r===4)y=1;else if(x<S_LIFT[2])y=1;else y=1-ease((x-S_LIFT[2])/(dur-S_LIFT[2]-80));
    if(x<dur||e.r===4)lifted.set(e.b,{y,r:e.r,open:x>=S_LIFT[0]+120&&(x<S_LIFT[2]+60||e.r===4)})}
  const res=CS.res,endB=over&&res?(res.why==='catch'?res.b:CS.pos):-1,endT=over&&!evBusy()?(P3.revealAt||(P3.revealAt=now)):0;
  if(over&&endB>=0&&!lifted.has(endB)&&(res.why==='catch'?S.caught:endT)){const k=res.why==='catch'?1:ease((now-endT)/450);lifted.set(endB,{y:k,r:4,open:k>.3});if(k<1)busy=true}
  const tEv=evAt('t',now);
  P3.bld.forEach((g,b)=>{
    const L=lifted.get(b),y=L?L.y*LIFT:0;g.userData.lift.position.y=y;
    let op=1;if(me&&!over){if(b===CS.pos&&!(tEv&&tEv.e.b===b&&now<tEv.t0+tEv.dur*.4))op=.42;if(tEv&&tEv.e.b!==undefined&&CS.path&&CS.path.length>1&&b===CS.path[CS.path.length-2]&&now<tEv.t0+tEv.dur*.8)op=.42}
    for(const m of g.userData.mats){m.opacity=op;m.depthWrite=op>.99}
    g.userData.ink.visible=op>.99;
  });
  /* 들린 건물 밑: 흔적 또는 차 */
  for(const t of P3.gTr.children)t.visible=false;
  let carShown=false;
  for(const [b,L] of lifted){if(!L.open)continue;
    if(L.r===4){P3.car.position.set(bWX(b),GY,bWZ(b));P3.car.visible=true;carShown=true;P3.car.userData.siren.material.color.setHex(((now/180)|0)%2?0xff3b30:0x4aa3ff)}
    else if(L.r){const key=b+':'+L.r;let t=P3.gTr.children.find(m=>m.userData.key===key);if(!t){t=traceMesh(L.r);t.userData.key=key;t.position.set(bWX(b),GY+.015,bWZ(b));P3.gTr.add(t)}t.visible=true}}
  /* 도둑 화면: 비치는 건물 안의 차 (옮기는 중이면 길을 따라 미끄러짐) */
  if(!carShown&&seeCar&&CS.pos>=0&&!over){
    let x=bWX(CS.pos),z=bWZ(CS.pos);
    if(tEv&&CS.path&&CS.path.length>1){const a=CS.path[CS.path.length-2],k=ease((now-tEv.t0)/tEv.dur);x=bWX(a)+(x-bWX(a))*k;z=bWZ(a)+(z-bWZ(a))*k;busy=true}
    else if(tEv&&CS.path&&CS.path.length===1){const k=ease((now-tEv.t0)/tEv.dur);P3.car.scale.setScalar(Math.max(.01,k));busy=true}
    if(!tEv)P3.car.scale.setScalar(1);
    P3.car.position.set(x,GY,z);P3.car.visible=true;P3.car.userData.siren.material.color.setHex(0x4aa3ff);carShown=true;
  }
  if(!carShown){P3.car.visible=false;P3.car.scale.setScalar(1)}
  /* 지붕 위 흔적: 찾은 것(모두), 도둑에게는 지나온 곳(흐리게), 끝나면 모두 */
  const want=[];
  for(let b=0;b<NB;b++){if(S.rv[b])want.push([b,S.rv[b],0])}
  if((me||(over&&endT))&&CS.path)CS.path.forEach((b,i)=>{if(b===CS.pos||S.rv[b])return;if(me&&!over&&tEv&&i===CS.path.length-2&&now<tEv.t0+tEv.dur*.5)return;want.push([b,traceCol(i,CS.mid),over?0:1])});
  const wk=want.map(a=>a.join(':')).join('|');
  if(wk!==P3.roofKey){P3.roofKey=wk;for(const m of P3.roofTr)P3.root.remove(m);P3.roofTr=want.map(([b,c,gh])=>{const t=traceMesh(c,!!gh);t.position.set(bWX(b),GY+P3.bld[b].userData.h+.017,bWZ(b));P3.root.add(t);t.userData.b=b;return t})}
  for(const t of P3.roofTr)t.position.y=GY+P3.bld[t.userData.b].userData.h+.017+P3.bld[t.userData.b].userData.lift.position.y;
  /* 지나온 길: 도둑·끝 */
  {const show=(me||(over&&endT))&&CS.path&&CS.path.length>1,pk=show?CS.path.join(','):'';
   if(pk!==P3.pathKey){P3.pathKey=pk;if(P3.path){P3.root.remove(P3.path);if(P3.path.userData.mat)P3.path.userData.mat.dispose();P3.path=null}
     if(show){const g=new THREE.Group(),mat=new THREE.MeshBasicMaterial({color:0xd33a2c,transparent:true,opacity:.7,depthWrite:false});
       for(let k=1;k<CS.path.length;k++){const a=CS.path[k-1],c=CS.path[k],ax=bWX(a),az=bWZ(a),cx=bWX(c),cz=bWZ(c),Lg=Math.hypot(cx-ax,cz-az);
         const sgm=new THREE.Mesh(GEO.seg||(GEO.seg=new THREE.PlaneGeometry(1,1)),mat);sgm.scale.set(Lg,.05,1);sgm.rotation.set(-Math.PI/2,0,-Math.atan2(cz-az,cx-ax));sgm.position.set((ax+cx)/2,GY+.012,(az+cz)/2);sgm.renderOrder=4;g.add(sgm)}
       g.userData.mat=mat;P3.root.add(g);P3.path=g}}}
  /* 헬기 */
  const mine=myHelis();
  for(let h=0;h<NH;h++){
    const o=P3.heli[h];let q=S.hel[h],x=0,z=0,y=HY,vis=q>=0,tilt=0;
    if(vis){x=qWX(q);z=qWZ(q)}
    for(const {e,t0,dur} of EVQ){if(e.h!==h||now<t0||now>=t0+dur)continue;const k=ease((now-t0)/dur);
      if(e.k==='m'){x=qWX(e.f)+(qWX(e.to)-qWX(e.f))*k;z=qWZ(e.f)+(qWZ(e.to)-qWZ(e.f))*k;y=HY+Math.sin(Math.PI*k)*.12;tilt=Math.sin(Math.PI*k)*.25;vis=true;busy=true}
      else if(e.k==='p'){x=qWX(e.to);z=qWZ(e.to);y=HY+(1-k)*1.6;vis=true;busy=true}
      else if(e.k==='s'){const f=Math.sin(Math.PI*Math.min(1,(now-t0)/(dur*.5)));const dx=bWX(e.b)-qWX(CS.hel[h]),dz=bWZ(e.b)-qWZ(CS.hel[h]);x+=dx*.25*f;z+=dz*.25*f;y=HY-.08*f;tilt=.18*f;busy=true}}
    o.g.visible=vis;o.beam.visible=o.spot.visible=vis;
    if(!vis)continue;
    o.spin+=.9;o.rotor.rotation.y=o.spin;
    const bob=Math.sin(now/420+h*2)*.02;o.g.position.set(x,y+bob,z);o.g.rotation.set(0,Math.PI/2,tilt);
    const done=V.st==='play'&&CS.ph==='police'&&CS.hd[h];
    o.beam.position.set(x,(y+GY)/2,z);o.beam.scale.set(1,y-GY-.12,1);o.beamM.opacity=done?.06:.2;
    o.spot.position.set(x,GY+.006,z);o.spot.material.opacity=done?.18:.42;
    o.halo.visible=CS.ph==='police'&&mine.length>1&&h===sel;
  }
  /* 고를 수 있는 곳 */
  const pk=pend&&(pend.k==='hide'||pend.k==='search')?pend.b:-1,fl=flash&&now-flashAt<700?flash:null;
  const ok=new Set();
  if(myHide())legalHides(CS.path||[]).forEach(b=>ok.add(b));
  if(CS.ph==='police')for(const h of mine){if(mine.includes(sel)&&h!==sel)continue;heliSearches(CS.hel,CS.rv,h).forEach(b=>ok.add(b))}
  P3.glow.forEach((m,b)=>{
    const st=fl&&fl.k==='b'&&fl.i===b?MAT.gNo:b===pk?MAT.gPick:ok.has(b)&&!busy?MAT.gOK:null;
    m.visible=!!st;if(!st)return;m.material=st;
    const g=P3.bld[b],fp=(CS.bl[b]&1?FPB:FP)+.06;m.scale.set(fp,fp,1);m.position.set(bWX(b),GY+g.userData.h+g.userData.lift.position.y+.012,bWZ(b));
    if(st===MAT.gOK)MAT.gOK.opacity=.32+.22*Math.sin(now/260);
  });
  const ringOK=new Set();
  if(mine.length&&CS.ph==='heli')for(let q=0;q<NI;q++)if(!CS.hel.includes(q))ringOK.add(q);
  if(mine.length&&CS.ph==='police')for(const h of mine){if(mine.includes(sel)&&h!==sel)continue;heliMoves(CS.hel,h).forEach(q=>ringOK.add(q))}
  P3.rings.forEach((g,q)=>{const no=!!(fl&&fl.k==='q'&&fl.i===q);g.visible=(ringOK.has(q)&&!busy)||no;if(g.visible){const m=no?MAT.gNo:MAT.rOK;g.userData.r.material=g.userData.d.material=m}});
  /* 미리 보기 */
  {const gh=P3.ghostH;gh.g.visible=!!pend&&(pend.k==='place'||pend.k==='move');if(gh.g.visible){gh.g.position.set(qWX(pend.q),HY,qWZ(pend.q));gh.g.rotation.set(0,Math.PI/2,0);gh.rotor.rotation.y=now/40}}
  {const gc=P3.ghostCar;gc.visible=!!pend&&pend.k==='hide';if(gc.visible){const g=P3.bld[pend.b];gc.position.set(bWX(pend.b),GY+g.userData.h+.02,bWZ(pend.b))}}
  /* 라운드 판: 아직 안 쓴 흔적만, 지금 라운드는 빛 */
  P3.trk.forEach((o,k)=>{o.t.visible=k>=S.t&&!over;o.glow.visible=V.st==='play'&&CS.rn>0&&k===CS.rn-1});
  return busy||!!fl||mine.length>0||myHide()||!!pend;
}
function tvBox(r){
  const Wd=r.clientWidth,Hh=r.clientHeight;r.classList.toggle('wide',Wd>Hh*1.15);
  const narrow=Wd<700,bar=r.querySelector('.cc-bar'),mb=r.querySelector('.cc-mebar'),gap=10;
  const low=narrow&&Hh>Wd?78:14;
  const R=Math.max(bar.offsetTop+bar.offsetHeight+gap,low+(mb.offsetHeight||26)+gap),m=narrow?8:16;
  return {fw:Wd-2*m,fh:Hh-2*R,cy:Hh/2,R};
}
const CHIP_GAP=10;
function chipsAt(topY,botY){
  const r=elRoot,bar=r.querySelector('.cc-bar'),mb=r.querySelector('.cc-mebar');if(!bar||!mb)return;
  const Hh=r.clientHeight,lim=Hh-14-(mb.offsetHeight||34);
  r.style.setProperty('--bs',Math.max(bar.offsetHeight,Math.round(topY-CHIP_GAP-bar.offsetTop))+'px');
  r.style.setProperty('--mt',Math.round(Math.min(botY+CHIP_GAP,lim))+'px');
  r.classList.add('lay');
}
/* 판 전체(라운드 판·헬기 높이까지)가 칸에 들어가는 거리를 찾고, 가운데에 오게 화면을 옮김 */
function d3Layout(t){
  if(t-P3.layAt<100&&P3.lay)return false;
  P3.layAt=t;
  const st=$('#stage'),Wd=st.clientWidth,Hh=st.clientHeight;if(!Wd||!Hh||!V||!V.cc)return false;
  const B=tvBox(elRoot),key=[Wd,Hh,B.R].join(',');
  if(key===P3.lay)return false;
  P3.lay=key;
  const cam=P3.cam,el=EL*Math.PI/180,tz=.15,pts=[];
  for(const x of [-FH,FH])for(const z of [-FH,FH+TRK])for(const y of [0,z<0?HY+.2:TOP+.7])pts.push(new THREE.Vector3(x,y,z));
  const v=new THREE.Vector3();
  const box=D=>{cam.aspect=Wd/Hh;cam.clearViewOffset();cam.position.set(0,TOP+D*Math.sin(el),tz+D*Math.cos(el));cam.lookAt(0,TOP,tz);cam.updateProjectionMatrix();cam.updateMatrixWorld();
    let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;for(const p of pts){v.copy(p).project(cam);const px=(v.x+1)/2*Wd,py=(1-v.y)/2*Hh;x0=Math.min(x0,px);x1=Math.max(x1,px);y0=Math.min(y0,py);y1=Math.max(y1,py)}return {x0,x1,y0,y1}};
  let lo=2,hi=60;for(let k=0;k<32;k++){const D=(lo+hi)/2,b=box(D);if(b.x1-b.x0<=B.fw&&b.y1-b.y0<=B.fh)hi=D;else lo=D}
  const b=box(hi),ox=(b.x0+b.x1)/2-Wd/2,oy=(b.y0+b.y1)/2-B.cy;
  cam.setViewOffset(Wd,Hh,ox,oy,Wd,Hh);cam.updateProjectionMatrix();
  chipsAt(b.y0-oy,b.y1-oy);
  P3.d=hi;P3.dirty=true;
  return true;
}
function d3Render(t){
  if(!P3.on||!T.ok)return;
  if(d3Layout(t))P3.dirty=true;
  if(CS&&V&&V.cc){cityBuild();trackBuild()}
  const intro=IN.on3d&&introStep(t),busy=d3Frame(t);
  if(!busy&&!intro&&!P3.dirty&&t-P3.lastR<200)return;
  P3.dirty=false;P3.lastR=t;
  const fog=T.scene.fog,fn=fog?fog.near:0,ff=fog?fog.far:0;
  if(fog){fog.near=P3.d+5;fog.far=P3.d+30}
  for(const m of [T.timerBg,T.timerArc,T.ring])if(m)m.visible=false;
  let cam=P3.cam;
  {const k=intro&&IN.fromLobby?ease((t-IN.t0)/INTRO.cam):1;
   if(k<1){
     const ic=P3.icam||(P3.icam=new THREE.PerspectiveCamera());
     ic.position.copy(T.cam.position).lerp(P3.cam.position,k);ic.quaternion.copy(T.cam.quaternion).slerp(P3.cam.quaternion,k);
     const a=T.cam.projectionMatrix.elements,b=P3.cam.projectionMatrix.elements,m=ic.projectionMatrix.elements;
     for(let j=0;j<16;j++)m[j]=a[j]+(b[j]-a[j])*k;
     ic.projectionMatrixInverse.copy(ic.projectionMatrix).invert();ic.updateMatrixWorld();
     if(fog){fog.near=fn+(fog.near-fn)*k;fog.far=ff+(fog.far-ff)*k}
     cam=ic;
   }}
  T.r.render(T.scene,cam);
  if(fog){fog.near=fn;fog.far=ff}
}
/* ---------- 시작 연출 (방장이 그동안 시간·봇을 멈춤, 길이 G.introMs) ----------
   0~1.1초 로비 카메라 → 비스듬한 카메라, 판이 내려앉고 건물이 차례로 솟음 → 도둑 정하는 주사위. 바로 시작은 건물만 다시 솟고 주사위 없이 알림 */
const INTRO={cam:1100,ui:650,board:[100,400],city:[450,900],dice:1500};
const AGAIN={dice:700};
const DIE=.62;
G.introMs=(again,rolls)=>Math.round((again?AGAIN.dice:INTRO.dice)+DicePick.totalFor(again?-1:rolls)+100);
const IN={on:false,on3d:false,t0:0,total:0,r:0,again:false,fromLobby:true,said:false,fp:null,die:null,snd:{}};
const introOn=()=>IN.on&&clock()<IN.t0+IN.total;
const introWait=()=>introOn()&&!IN.said;
G.intro=(t0,o)=>{
  if(!V||!V.cc||!V.ps)return;
  IN.again=!!(o&&o.again)&&P3.on;
  const rolls=IN.again?-1:o&&o.rolls,seed=(o&&o.seed)||1,cnt=V.cc.cnt;
  IN.on=true;IN.t0=t0;IN.said=false;IN.snd={};IN.fromLobby=!P3.on;IN.on3d=true;
  IN.r=IN.again?AGAIN.dice:INTRO.dice;IN.total=(o&&o.total)||G.introMs(IN.again,rolls);
  if(IN.die){IN.die.dispose();IN.die=null}
  IN.fp=firstPick(t0+IN.r,{seats:Array.from({length:cnt},(_,k)=>k),first:V.cc.th,rolls,seed});
  $('#stage').classList.add('cc-intro');if(elRoot&&IN.fromLobby)elRoot.classList.add('intro');
  lastBar='';P3.dirty=true;
};
function introStep(now,force){
  if(!P3.built||!V||!V.cc||!CS)return false;
  const e=now-IN.t0,done=force||e>=IN.total,fl=IN.fromLobby;
  if(done)IN.on3d=false;
  {const x=done||!fl?1:(e-INTRO.board[0])/INTRO.board[1];P3.boardG.visible=x>0;P3.boardG.position.y=dropY(Math.max(0,x),1.6)}
  {const c0=IN.again?0:INTRO.city[0],cd=IN.again?500:INTRO.city[1];
   P3.bld.forEach((g,b)=>{const d=c0+((b*7)%NB)/NB*cd,k=done?1:Math.max(0,Math.min(1,(e-d)/260));g.scale.y=Math.max(.001,k<1?ease(k)*1.08-(k>.8?(k-.8)*.4:0):1);g.visible=k>0})}
  if(IN.fp&&!IN.fp.fixed){
    if(!IN.die&&!done&&P3.root){IN.die=DicePick.mesh(THREE,CS.cnt,SEAT_C.slice(0,CS.cnt));P3.root.add(IN.die.g)}
    if(IN.die)IN.die.apply(done||e<IN.r?null:IN.fp.pose(now),DIE,0,TOP+.95,.2);
  }
  if(done&&IN.die){IN.die.dispose();IN.die=null}
  return true;
}
function introEnd(){
  if(IN.on3d)introStep(clock(),true);
  if(IN.die){IN.die.dispose();IN.die=null}
  IN.on=false;IN.on3d=false;IN.said=true;
  $('#stage').classList.remove('cc-intro');if(elRoot)elRoot.classList.remove('intro');
}
function introTick(){
  if(!IN.on)return;
  const e=clock()-IN.t0,S_=IN.snd,once=(k,f)=>{if(!S_[k]){S_[k]=1;f()}};
  if(e>=INTRO.ui&&elRoot&&elRoot.classList.contains('intro'))elRoot.classList.remove('intro');
  if(IN.on3d&&P3.on&&CS&&IN.fromLobby&&e>=INTRO.board[0]+INTRO.board[1]*.68)once('thud',()=>sndThud(0));
  if(IN.on3d&&P3.on&&CS&&e>=(IN.again?0:INTRO.city[0]))once('city',()=>{for(let k=0;k<6;k++)tone(300+k*60,.05,{type:'triangle',vol:.05,at:k*.13})});
  if(IN.fp&&e>=IN.r&&IN.fp.tick(IN.t0+e)){
    IN.said=true;$('#stage').classList.remove('cc-intro');if(elRoot)elRoot.classList.remove('intro');
    const th=V.cc.th;fxSay(th===myIdx()?'내가 도둑입니다':`${nm(th)} 도둑`,SEAT_C[th]);
    lastBar='';redraw();
  }
  if(e>=IN.total){IN.on=false;lastBar='';lastHint='';G.buttons()}
  drawAll();
}
/* 3D 화면에서 누름: 헬기 → (교차로를 고를 때) 헬기 높이의 고리 → 건물 → 바닥 */
function d3Click(e){
  if(!P3.on||G!==GAMES.citychase||V.cfg.game!=='citychase'||!CS)return;
  const r=T.r.domElement.getBoundingClientRect();if(!r.width||!P3.cam)return;
  const ray=P3.ray||(P3.ray=new THREE.Raycaster());
  ray.setFromCamera({x:(e.clientX-r.left)/r.width*2-1,y:-(e.clientY-r.top)/r.height*2+1},P3.cam);
  const hb=ray.intersectObjects(P3.heli.filter(o=>o.g.visible).map(o=>o.body),false);
  if(hb.length){tapHeli(hb[0].object.userData.h);return}
  const o=ray.ray.origin,dv=ray.ray.direction,onY=y=>{if(Math.abs(dv.y)<1e-6)return null;const k=(y-o.y)/dv.y;return k>0?{x:o.x+dv.x*k,z:o.z+dv.z*k}:null};
  if(P3.rings.some(g=>g.visible)){const p=onY(HY);if(p){let best=-1,bd=.3*P;for(let q=0;q<NI;q++){const d=Math.hypot(p.x-qWX(q),p.z-qWZ(q));if(d<bd){bd=d;best=q}}if(best>=0){tapInter(best);return}}}
  const bh=ray.intersectObjects(P3.bld.map(g=>g.userData.body),false);
  if(bh.length){tapBuilding(bh[0].object.userData.b);return}
  const p=onY(GY);if(!p)return;
  const fx=p.x/P+2.5,fy=p.z/P+2.5;
  if(fx<0||fx>=N||fy<0||fy>=N)return;
  tapAt(fx,fy);
}
/* 대기실 홀로그램의 대표 말: 건물 하나와 그 위를 나는 헬기 */
G.holoPiece=mkM=>{
  const g=new THREE.Group(),bm=mkM(0xe8d9bd),hm=mkM(new THREE.Color(HELI_C[0]).getHex()),dk=mkM(0x6b5a44);
  const b=new THREE.Mesh(new THREE.BoxGeometry(.26,.46,.26),bm);b.position.set(-.08,-.2,0);g.add(b);
  const b2=new THREE.Mesh(new THREE.BoxGeometry(.2,.28,.2),bm);b2.position.set(.18,-.29,.08);g.add(b2);
  const body=new THREE.Mesh(new THREE.SphereGeometry(.1,16,12),hm);body.scale.set(1.3,.95,.95);body.position.set(.08,.22,0);g.add(body);
  const tail=new THREE.Mesh(new THREE.CylinderGeometry(.018,.03,.24,8),hm);tail.rotation.z=Math.PI/2;tail.position.set(-.13,.24,0);g.add(tail);
  const rot=new THREE.Mesh(new THREE.BoxGeometry(.5,.01,.035),dk);rot.position.set(.08,.33,0);rot.rotation.y=.5;g.add(rot);
  const rot2=new THREE.Mesh(new THREE.BoxGeometry(.5,.01,.035),dk);rot2.position.set(.08,.33,0);rot2.rotation.y=.5+Math.PI/2;g.add(rot2);
  return g;
};

/* 새 상태를 받았을 때 */
G.preView=()=>{
  if(!V.cc){CS=null;return}
  const pv=PV&&PV.cc;
  CS={...V.cc};
  if(!pv||PV.st!==V.st||pv.n!==CS.n||pv.ph!==CS.ph||pv.th!==CS.th)pend=null;
  if(V.st!=='play')pend=null;
  evSync();fixSel();
};
G.postView=()=>{};
G.overExtra=()=>'';
G.logCue=(txt,cls)=>cls==='fin';   // 끝 소리는 연출이 끝날 때 (cues)
G.overDelay=()=>Math.round(Math.max(0,evEnd-clock())+1500);
G.overWho=()=>CS&&CS.res?(CS.res.w.includes(CS.th)?'도둑 승리':'경찰 승리'):'';
G.cues=(v,pv)=>{
  if(!v.cc||!pv.cc)return;
  if(v.cc.rn>pv.cc.rn&&v.cc.rn>1){const a=Math.max(0,(evEnd-clock())/1000);tone(660,.06,{type:'triangle',vol:.08,at:a});tone(990,.08,{type:'triangle',vol:.06,at:a+.07})}
  if(v.st==='over'&&pv.st==='play'){const a=Math.max(0,(evEnd-clock())/1000)+.35,me=myIdx(),r=v.cc.res;if(r&&me>=0&&r.w.includes(me))sndWin(a);else sfx('finish')}
};
G.hud=inGame=>{
  if(!elRoot)return;
  const on=!!(inGame&&V&&V.cc&&CS);
  elRoot.hidden=!on;
  $('#stage').classList.toggle('cc-over',!!(on&&V.st==='over'));
  const d3=on&&d3Build();
  if(d3!==P3.on){P3.on=d3;P3.lay='';if(P3.root)P3.root.visible=d3;$('#stage').classList.toggle('cc3d',d3);lastBoard='';lastHint=''}
  $('#stage').classList.toggle('cc2d',on&&!d3);
  if(!on){lastBoard='';lastBar='';lastHint='';return}
  drawAll();P3.dirty=true;
};
G.handMarks=()=>{};
G.me=()=>{$('#numpick').hidden=true};
G.overRank=p=>{const i=V.ps.indexOf(p),t=p.sr===3?'탈주':p.sr?'항복':'',r=CS&&i>=0?(i===CS.th?'도둑':'경찰'):'';return t||r?`<span class="left">${[r,t].filter(Boolean).join(' · ')}</span>`:''};
G.usesDbl=true;
G.no3D=true;
const PLAY_LB={hide:'숨기',place:'놓기',move:'이동',search:'수색'};
G.buttons=()=>{
  const play=$('#btnPlay'),mine=myHelis().length>0||myHide(),can=!!pend&&mine,lb=pend?PLAY_LB[pend.k]:CS&&CS.ph==='thief'?'숨기':CS&&CS.ph==='heli'?'놓기':'수색';
  play.hidden=!mine;
  $('#btnPass').hidden=true;$('#btnGura').hidden=true;
  play.disabled=!can;play.classList.toggle('ready',can);
  if($('#playMain').textContent!==lb)$('#playMain').textContent=lb;
  const sub=keyLabel(KEYS.play);if($('#playSub').textContent!==sub)$('#playSub').textContent=sub;
};
G.live=()=>{
  if(IN.on)introTick();
  if(!V||!V.cc||!CS)return;
  for(const bar of elRoot?elRoot.querySelectorAll('.cc-p.on .tb i'):[])if(V.st==='play'){const left=Math.max(0,(V.deadAt-clock())/1000);bar.style.width=Math.min(100,left/(V.cfg.turn||30)*100)+'%'}
  if(!P3.on&&(evBusy()||(flash&&clock()-flashAt<760))){lastBoard='';drawAll()}
  drawHint();
};
G.play=()=>confirmPend();
G.pass=()=>{};
G.keyPhase=st=>st==='play';
G.onKey=()=>false;
G.field3D=()=>{if(T.stacks)for(const arr of T.stacks.values())arr.forEach(c=>{c.visible=false})};
G.render3D=t=>{if(P3.on)d3Render(t);else if(T.ok&&!$('#stage').classList.contains('cc2d'))T.r.render(T.scene,T.cam)};
G.enter=()=>{
  $('#stage').classList.add('citychase');
  $('#btnPass').hidden=true;$('#btnGura').hidden=true;$('#numpick').hidden=true;
  pend=null;sel=-1;
  if(elRoot)fit();
};
G.leave=()=>{
  introEnd();
  $('#stage').classList.remove('citychase','cc-over','cc3d','cc2d');
  if(T.stacks)for(const arr of T.stacks.values())arr.forEach(c=>{c.visible=true});
  if(P3.root)P3.root.visible=false;P3.on=false;
  EVQ=[];evKey='';evEnd=0;
  $('#btnPass').hidden=false;$('#btnPlay').hidden=false;
  if(elRoot){elRoot.hidden=true;lastBoard='';lastBar='';lastHint=''}
};
G.init=()=>{
  const css=document.createElement('style');
  css.textContent=`
.stage.citychase{background:radial-gradient(ellipse at 50% 38%,#eef0ea 0%,#d5d9cf 70%,#bfc5b8 100%)}
.stage.citychase.cc2d #cv,.stage.citychase #dim{visibility:hidden}
.stage.cc3d #cv{touch-action:manipulation}
.stage.cc-intro .actions,.stage.cc-intro .myplate{opacity:0;pointer-events:none}
.stage.citychase .actions,.stage.citychase .myplate,#citychase .cc-bar,#citychase .cc-mebar,#citychase .cc-row{transition:opacity .35s}
#citychase.intro .cc-bar,#citychase.intro .cc-mebar{opacity:0}
.stage.cc3d #citychase svg.cc-board{display:none}
.stage.citychase .labels{visibility:hidden}
.stage.citychase .nogl{display:none}
.stage.citychase.cc-over .myplate,.stage.citychase.cc-over .actions{display:none}
.specbar:not([hidden])~#citychase .cc-bar{margin-top:30px}
.stage.citychase .actions{left:auto}
.stage.citychase .myplate{max-width:calc(100% - 150px)}
#citychase{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;gap:6px;padding:8px 10px 82px;pointer-events:none;min-height:0}
#citychase[hidden]{display:none}
#citychase .cc-bar{min-height:44px;display:flex;flex-wrap:wrap;justify-content:center;align-items:flex-start;align-content:flex-end;gap:6px;align-self:center;max-width:calc(100% - 188px);pointer-events:none}
#citychase .cc-mebar{position:absolute;left:50%;bottom:var(--plateB,14px);transform:translateX(-50%);z-index:2;display:flex;pointer-events:none;max-width:calc(100% - 188px)}
#citychase .cc-mebar:empty{display:none}
#citychase .cc-p{position:relative;display:flex;align-items:center;gap:6px;padding:4px 10px 6px;border-radius:12px;background:rgba(255,250,240,.92);border:1.5px solid var(--line-strong,#cdb391);font-size:13px;line-height:1.15;overflow:hidden;white-space:nowrap;max-width:100%}
#citychase .cc-p .dot{width:12px;height:12px;border-radius:50%;background:var(--pc);box-shadow:0 0 0 1.5px rgba(59,42,31,.5);flex:none}
#citychase .cc-p b{font-weight:600;overflow:hidden;text-overflow:ellipsis;max-width:8em}
#citychase .cc-p .role{font-size:12px;color:#2b65ca;font-weight:700}
#citychase .cc-p .role.th{color:#c53026}
#citychase .cc-p .role:empty{display:none}
#citychase .cc-p .hd{width:10px;height:10px;border-radius:50%;background:var(--hc);box-shadow:0 0 0 1.5px rgba(40,30,20,.55);flex:none;margin-left:-2px}
#citychase .cc-p .st{font-size:12px;color:var(--muted,#7a6550)}
#citychase .cc-p.on{border-color:var(--pc);box-shadow:0 0 0 2px var(--pc)}
#citychase .cc-p.out{opacity:.55}
#citychase .cc-p .tb{position:absolute;left:0;right:0;bottom:0;height:3px;background:rgba(0,0,0,.08)}
#citychase .cc-p .tb i{display:block;height:100%;width:100%;background:var(--pc)}
#citychase .cc-row{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;pointer-events:none;min-height:44px}
.stage.cc3d #citychase .cc-row{height:44px;min-height:0;flex:none;overflow:hidden;position:relative;z-index:1;order:-1}
#citychase .cc-hint:empty,#citychase .cc-rd:empty{display:none}
#citychase .cc-hint,#citychase .cc-rd{flex:0 0 auto;font-size:13px;line-height:1.3;color:#3f4650;background:rgba(255,252,246,.92);border:1px solid var(--line-strong,#cdb391);border-radius:99px;padding:4px 12px}
#citychase .cc-rd{font:700 13px "IBM Plex Mono",monospace}
#citychase .cc-bd{position:relative;flex:1;min-height:0;width:100%}
#citychase svg.cc-board{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);pointer-events:auto;touch-action:manipulation;user-select:none;-webkit-user-select:none;filter:drop-shadow(0 6px 8px rgba(40,40,40,.35))}
@media (max-width:520px){#citychase .cc-p{font-size:12px;padding:3px 8px 5px;gap:5px}#citychase .cc-bar{max-width:calc(100% - 150px)}}
.stage.cc3d #citychase.lay .cc-bar{transform:translateY(calc(var(--bs) - 100%));transition:transform .35s,opacity .35s}
.stage.cc3d #citychase.lay .cc-mebar{top:var(--mt);bottom:auto;transition:top .35s,opacity .35s}
.stage.cc3d .specbar:not([hidden])~#citychase .cc-bar{margin-top:0}
.stage.cc3d .specbar:not([hidden])~#citychase .cc-row{margin-top:30px}
.stage.cc3d #citychase.wide .cc-row{position:absolute;left:16px;top:8px;width:calc(50% - 280px);min-width:190px;max-width:42%;justify-content:flex-start;flex-wrap:wrap;height:auto;max-height:90%}
.stage.cc3d #citychase.wide .cc-bar{min-height:0}
.stage.cc3d .specbar:not([hidden])~#citychase.wide .cc-bar{margin-top:30px}
@media (max-width:699px) and (orientation:portrait){#citychase{padding-bottom:96px}
.stage.cc3d #citychase .cc-row{width:calc(100% - 110px);align-self:flex-start;justify-content:flex-start}
#citychase .cc-mebar{bottom:70px;max-width:calc(100% - 24px)}}
`;
  document.head.appendChild(css);
  elRoot=document.createElement('div');elRoot.id='citychase';elRoot.hidden=true;
  elRoot.innerHTML=`<div class="cc-bar"></div><div class="cc-mebar"></div><div class="cc-row"><div class="cc-rd"></div><div class="cc-hint" aria-live="polite"></div></div><div class="cc-bd"><svg class="cc-board" viewBox="-.35 -.35 5.7 5.7" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="시티 체이스 판"><g id="ccMain"></g></svg></div>`;
  $('#stage').insertBefore(elRoot,$('#fx'));
  elSvg=elRoot.querySelector('svg.cc-board');elMain=elRoot.querySelector('#ccMain');
  elBar=elRoot.querySelector('.cc-bar');elBarMe=elRoot.querySelector('.cc-mebar');elHint=elRoot.querySelector('.cc-hint');
  elSvg.addEventListener('click',onSvgClick);
  document.addEventListener('keydown',e=>{if(e.code==='Escape'&&elRoot&&!elRoot.hidden&&pend){pend=null;redraw()}});
  window.addEventListener('resize',()=>{fit();P3.lay=''});
  $('#cv').addEventListener('click',d3Click);
};
G._d3={P3,IN,introEnd,get CS(){return CS},tapAt,tapBuilding,tapInter,tapHeli,confirmPend,get pend(){return pend},get sel(){return sel},shownState,get EVQ(){return EVQ},bWX,bWZ,qWX,qWZ,HY,GY};   // 화면 검사용

/* ===== 번역 (English·日本語) =====
   화면 문구는 한국어로 쓰고 여기에 [영어, 일본어]를 한 줄로 같이 더함(docs/i18n.md). 바뀌는 값은 {0}·{1}, 숫자 자리는 {#0}.
   헬기 기록은 색마다 키를 따로(값 하나 + 낱말 패턴이 다른 문장을 가로채지 않게). 게임 방법은 rulesHTML을 통째로 */
G.i18n=typeof i18nGame!=='function'?null:i18nGame((()=>{
  const t={
'도둑':['Thief','泥棒'],
'경찰':['Police','警察'],
'헬기 놓기':['Place helicopters','ヘリを置く'],
'도둑이 숨는 중':['The thief is hiding','泥棒が隠れています'],
'경찰이 차를 찾았습니다':['The police found the car','警察が車を見つけました'],
'도둑이 갈 곳이 없어 경찰 승리':['The thief is cornered. Police win','泥棒は行き場がなく、警察の勝ち'],
'도둑이 끝까지 숨었습니다':['The thief stayed hidden to the end','泥棒は最後まで隠れきりました'],
'도둑 승리':['Thief wins','泥棒の勝ち'],
'경찰 승리':['Police win','警察の勝ち'],
'내가 도둑입니다':["I'm the thief",'わたしが泥棒です'],
'{0} 도둑':['{0} is the thief','{0}が泥棒'],
'숨기':['Hide','隠れる'],
'이동':['Move','移動'],
'수색':['Search','捜索'],
'라운드':['Rounds','ラウンド'],
'도둑은 시간이 지나면 무작위 건물로 옮기고, 헬기는 무작위로 수색합니다. 연결이 끊겨도 시간은 흐르고, 45초가 지나면 탈주로 처리합니다':['When time runs out, the thief moves to a random building and helicopters search at random. The clock keeps running if you disconnect, and after 45 seconds you count as having left','時間切れになると、泥棒はランダムなビルへ移り、ヘリはランダムに捜索します。接続が切れても時間は進み、45秒過ぎると離脱扱いになります'],
'도둑이 이만큼 숨으면 이깁니다. 원래 규칙은 11라운드이고, 빨간 흔적은 가운데 라운드에 남습니다':['The thief wins after hiding for this many rounds. The original rules use 11 rounds, and the red trace is left in the middle round','泥棒はこのラウンド数だけ隠れきれば勝ちです。元のルールは11ラウンドで、赤い痕跡は真ん中のラウンドに残ります'],
'선택: 방장이 이름표 메뉴의 [선]으로 도둑을 고릅니다. 무작위: 주사위로 정하고, 바로 시작하면 다음 사람이 도둑입니다':['Choose: the host picks the thief with [1st] in the name tag menu. Random: decided by dice; when you play again, the next player is the thief','指定：ホストが名札メニューの[先]で泥棒を選びます。ランダム：サイコロで決め、もう一度遊ぶときは次の人が泥棒です'],
'{#0}라운드 · 제한 시간 {#1}초 · 도둑 {2}':['{0} rounds · Time limit {1}s · Thief {2}','{0}ラウンド · 制限時間{1}秒 · 泥棒 {2}'],
'도둑 한 명과 경찰이 겨룹니다. 헬기는 늘 3대입니다.':['One thief against the police. There are always 3 helicopters.','泥棒1人と警察の対決です。ヘリはいつも3機です。'],
'시티 체이스는 최대 4명까지 할 수 있습니다.':['City Chase allows up to 4 players.','シティチェイスは最大4人まで遊べます。'],
'시티 체이스 판':['City Chase board','シティチェイスの盤'],
'{#0}라운드 도둑이 숨었습니다':['Round {0}: the thief hid','{0}ラウンド 泥棒が隠れました'],
'{#0}라운드 도둑이 갈 곳이 없어 경찰 승리':['Round {0}: the thief is cornered. Police win','{0}ラウンド 泥棒は行き場がなく、警察の勝ち'],
'{#0}라운드까지 숨어 도둑 승리':['The thief hid through round {0} and wins','{0}ラウンドまで隠れきって泥棒の勝ち']
  };
  [['분홍','Pink','ピンク'],['노랑','Yellow','黄色'],['초록','Green','緑']].forEach(([k,e,j])=>{
    t[`{0} ${k} 헬기 {1}`]=[`{0}: ${e} helicopter to {1}`,`{0} ${j}のヘリ {1}`];
    t[`{#0}라운드 ${k} 헬기 {1}로`]=[`Round {0}: ${e} helicopter to {1}`,`{0}ラウンド ${j}のヘリ {1}へ`];
    t[`{#0}라운드 ${k} 헬기가 {1}에서 차를 찾아 경찰 승리`]=[`Round {0}: the ${e} helicopter found the car at {1}. Police win`,`{0}ラウンド ${j}のヘリが{1}で車を見つけ、警察の勝ち`];
    t[`{#0}라운드 ${k} 헬기 {1} 흔적`]=[`Round {0}: ${e} helicopter found a trace at {1}`,`{0}ラウンド ${j}のヘリ {1}で痕跡`];
    t[`{#0}라운드 ${k} 헬기 {1} 빈 건물`]=[`Round {0}: ${e} helicopter found {1} empty`,`{0}ラウンド ${j}のヘリ {1}は空`];
  });
  return t;
})(),{
en:{rulesHTML:'<ol class="rules"><li><b>Goal</b> : One thief plays against the police. The police win by finding the thief\'s car before the last round ends; the thief wins by staying hidden to the end</li><li><b>Setup</b> : Dice decide the thief. The police place 3 helicopters on intersections (always 3, whatever the player count)</li><li><b>Thief</b> : Each round, secretly move to a building right next to yours (not diagonal). In the first round, choose any building. Every building you pass keeps a trace, and you can never enter a building with a trace again</li><li><b>Police</b> : Each helicopter either moves to a neighboring intersection or lifts one of the four buildings around it. Any order</li><li><b>Traces</b> : Found traces are placed on top of the building. Yellow is where the thief started, red is where they hid in the middle round, and blue is anywhere else</li><li><b>End</b> : The police win by finding the car or when the thief has nowhere to go. The thief wins by staying hidden through the last round</li></ol>'},
ja:{rulesHTML:'<ol class="rules"><li><b>目標</b> : 泥棒1人と残りの警察が対決します。警察は最後のラウンドが終わる前に泥棒の車を見つければ勝ち、泥棒は最後まで隠れきれば勝ちです</li><li><b>準備</b> : サイコロで泥棒を決めます。警察はヘリコプター3機を交差点に置きます（人数に関係なく3機）</li><li><b>泥棒</b> : ラウンドごとに、すぐ隣のビル（斜めは除く）へこっそり移って隠れます。最初のラウンドは好きなビルを選びます。通ったビルには痕跡が残り、痕跡のあるビルには二度と入れません</li><li><b>警察</b> : ヘリごとに1回、隣の交差点へ移るか、周りの4つのビルのうち1つを持ち上げて調べます。順番は自由です</li><li><b>痕跡</b> : 見つけた痕跡はビルの上に置きます。黄色は出発した場所、赤は真ん中のラウンドに隠れた場所、青はそれ以外の場所です</li><li><b>終わり</b> : 車を見つけるか泥棒の行き場がなくなれば警察の勝ち、最後のラウンドまで隠れきれば泥棒の勝ちです</li></ol>'}});
if(typeof window!=='undefined')(window.GAMES=window.GAMES||{}).citychase=G;
})();
