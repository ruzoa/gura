/* index.html 공통 코드 · 규칙 나무판·설정 판자. 파일 순서는 index.html의 <script src> 순서 */
/* ===== 규칙 나무판: 글자를 인두로 지진 판자 (게임 규칙 키·탁자 설정·규칙 키) =====
   공개 탁자 목록 판과 같은 틈에서 양쪽 기둥(거치대) 사이로 판자가 올라옴. 첫 화면은 게임 목록 판자 → 줄을 누르면 그 게임,
   대기실은 설정 판자(⚙ 탁자 설정, 🎲 게임 설정)부터 열리고 레버로 넘기면 규칙 판자(1, 2, 3…)가 이어짐.
   왼쪽 기둥의 놋쇠 단추(⚙·🎲·숫자)를 누르면 그 판자로 바로. 오른쪽 기둥 레버 = 다음 판자, ✕ = 닫기, 왼쪽 기둥 위 ← = 목록으로(목록에서 들어왔을 때만).
   한 항목이 길면 판자가 길어지고, 위아래로 밀면(휠·↑↓) 판자째 틈에서 올라오고 들어감(글자만 움직이지 않음).
   세로로 긴 화면(휴대폰)은 판자를 세로로 길게(`rbFit`) 하고 설정 줄을 두 줄(이름 / 장치)로 그려 장치를 크게 */
const RB={L:1.6,W:1.3,CW:832,PX:640,MX:58,TOP:58,BOT:96,FB:42,LH:60,GAP:30,ROWS:7,RY0:190,RSTEP:112,RH:96,tall:false};   // 판자 크기, 글자 크기, 줄 간격(px), 목록 줄
const RB_PG=12;   // 왼쪽 기둥 쪽 단추 수 (판자 수가 이보다 많으면 앞쪽만)
function frontBuildRules(TG){
  const {Z,D}=DSP,{W}=RB,cv=document.createElement('canvas');cv.width=RB.CW;cv.height=Math.round(RB.L*RB.PX);
  const tex=new THREE.CanvasTexture(cv);tex.anisotropy=8;
  const g=new THREE.Group();g.position.set(0,.002,Z+D*.8);TG.add(g);
  const arm=new THREE.Group();arm.rotation.x=-.08;g.add(arm);
  const r=new THREE.Group();arm.add(r);   // 올라오는 묶음 (기둥·레버·판자)
  const wood=toon({color:0x8a5530}),dark=toon({color:0x6a3e20}),face=toon({map:tex,rim:0}),brass=toon({color:0xb8925a,rim:.3}),knobM=toon({color:0x5a3a22,rim:.25});
  const px=W/2+.075,posts=[];
  for(const sx of [-1,1]){const post=new THREE.Mesh(new THREE.BoxGeometry(.1,1,.15),dark);post.position.set(sx*px,.5,0);post.castShadow=true;r.add(post);const po=hull(new THREE.BoxGeometry(.13,1,.18),post,r);
    const cap=new THREE.Mesh(new THREE.BoxGeometry(.15,.05,.2),wood);cap.position.set(sx*px,1,0);r.add(cap);const co=hull(new THREE.BoxGeometry(.18,.08,.23),cap,r);posts.push({post,po,cap,co})}
  const knobTex=draw=>canvasTex(128,128,(x,w,h)=>{x.fillStyle='#c9a46a';x.fillRect(0,0,w,h);x.strokeStyle=x.fillStyle='#5a3a1c';x.lineCap='round';x.lineJoin='round';x.translate(64,64);x.rotate(-Math.PI/2);draw(x)});   // 원통 윗면 그림은 90도 돌아 보여서 미리 반대로 돌려 그림
  const knob=(tx,x,y)=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(.075,.075,.05,24),[brass,toon({map:tx,rim:.2}),brass]);m.rotation.x=Math.PI/2;m.position.set(x,y,.1);r.add(m);const o=hull(new THREE.CylinderGeometry(.088,.088,.06,24),m,r);o.rotation.x=Math.PI/2;return [m,o]};
  // 닫기: 오른쪽 기둥 위 ✕, 뒤로: 왼쪽 기둥 위 ← (목록에서 들어온 규칙일 때만)
  const [xk,xkO]=knob(knobTex(x=>{x.lineWidth=16;x.beginPath();x.moveTo(-26,-26);x.lineTo(26,26);x.moveTo(26,-26);x.lineTo(-26,26);x.stroke()}),px,1);
  const [bk,bkO]=knob(knobTex(x=>{x.lineWidth=15;x.beginPath();x.moveTo(28,0);x.lineTo(-12,0);x.stroke();x.beginPath();x.moveTo(-34,0);x.lineTo(-8,-26);x.lineTo(-8,26);x.closePath();x.fill()}),-px,1);
  // 쪽 단추: 왼쪽 기둥 앞면의 둥근 놋쇠 단추. ⚙ 탁자 설정, 🎲 게임 설정, 숫자 = 규칙 판자. 지금 판자는 밝고 눌려 들어감
  const pgs=[];
  for(let k=0;k<RB_PG;k++){const cvp=document.createElement('canvas');cvp.width=cvp.height=128;const tx=new THREE.CanvasTexture(cvp);
    const mOn=toon({color:0xffffff,map:tx,rim:.35}),side=toon({color:0x8a6a3c,rim:.2});
    const m=new THREE.Mesh(new THREE.CylinderGeometry(.062,.062,.045,24),[side,mOn,side]);m.rotation.x=Math.PI/2;m.position.set(-px,.5,.1);m.visible=false;r.add(m);
    const o=hull(new THREE.CylinderGeometry(.074,.074,.055,24),m,r);o.rotation.x=Math.PI/2;o.visible=false;
    pgs.push({m,o,cv:cvp,tx,mat:mOn,lab:'',lit:null})}
  // 다음 판자: 오른쪽 기둥의 레버 (공개 탁자 목록 판과 같은 모양)
  const lv=new THREE.Group();lv.position.set(px+.055,.9,0);r.add(lv);
  const hub=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,.06,20),brass);hub.rotation.z=Math.PI/2;lv.add(hub);
  const rod=new THREE.Group();lv.add(rod);
  const bar=new THREE.Mesh(new THREE.CylinderGeometry(.02,.02,.34,10),brass);bar.rotation.x=Math.PI/2;bar.position.set(.025,0,.17);rod.add(bar);
  const kn=new THREE.Mesh(new THREE.SphereGeometry(.07,16,12),knobM);kn.position.set(.025,0,.36);kn.castShadow=true;rod.add(kn);hull(new THREE.SphereGeometry(.082,16,12),kn,rod);
  rod.rotation.x=-.5;
  // 판자: 길이는 쪽마다 다름 (scale.y)
  const plank=new THREE.Mesh(new THREE.BoxGeometry(W,1,.08),[wood,wood,wood,wood,face,wood]);plank.castShadow=true;r.add(plank);
  const pOut=hull(new THREE.BoxGeometry(W+.03,1,.11),plank,r);
  const clipY=[new THREE.Plane(new THREE.Vector3(0,1,0),-.001)];   // 탁자 윗면 아래는 안 보임
  r.traverse(o=>{if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{m.clippingPlanes=clipY})});
  const slit=new THREE.Mesh(new THREE.PlaneGeometry(2*(W/2+.165)+.08,.3),new THREE.MeshBasicMaterial({color:0x15100c}));slit.rotation.x=-Math.PI/2;slit.position.y=.0006;g.add(slit);
  const hitM=new THREE.MeshBasicMaterial({visible:false});
  const win=new THREE.Mesh(new THREE.PlaneGeometry(W,1),hitM);win.position.set(0,.5,.05);r.add(win);
  lv.visible=false;   // 레버는 없앰(쪽은 왼쪽 기둥 쪽 단추·옆으로 밀기·←→). ✕는 오른쪽 기둥 위
  T.rb={g,r,cv,tex,plank,pOut,posts,xk,xkO,bk,bkO,pgs,win,px,lever:{g:lv,rod,at:-1e9,dir:1},key:'',fitL:0};
  rbFit(RB.L,true);
  g.visible=false;
  const fr=$('#front'),mk=(id,lab)=>{const b=document.createElement('button');b.type='button';b.className='fr-hot off fr-key';b.id=id;if(lab){b.setAttribute('aria-label',lab);b.title=lab}fr.insertBefore(b,$('#frFoot'));return b};
  { // 판자: 위아래로 밀면 판자가 올라오고 들어감, 옆으로 밀면 다음·이전 판자. 휠도
    const b=mk('frRbWin','');let sy=null,sx=0,ls=0,lt=0,moved=false;
    b.addEventListener('pointerdown',e=>{sy=ls=e.clientY;sx=e.clientX;lt=performance.now();moved=false;FR.rb.drag=true;FR.rb.v=0;try{b.setPointerCapture(e.pointerId)}catch(_){}});
    b.addEventListener('pointermove',e=>{if(sy==null)return;const h=b.getBoundingClientRect().height||1,dy=e.clientY-ls,now=performance.now();
      if(Math.abs(e.clientY-sy)>6)moved=true;const ds=-dy*RB.L/h;frontRulesScroll(ds,true);FR.rb.v=ds/Math.max(.008,(now-lt)/1000);ls=e.clientY;lt=now});
    const up=e=>{if(sy==null)return;FR.rb.drag=false;const dx=e.clientX-sx,dy=e.clientY-sy;sy=null;if(performance.now()-lt>90)FR.rb.v=0;
      if(!moved&&Math.abs(dx)>50){frontRulesPage(dx<0?1:-1);return}
      if(!moved&&Math.abs(dx)<8&&Math.abs(dy)<8&&FR.rb.mode==='list')frontRulesPick(e.clientY-b.getBoundingClientRect().top,b.getBoundingClientRect().height)};
    b.addEventListener('pointerup',up);b.addEventListener('pointercancel',()=>{sy=null;FR.rb.drag=false});
    b.addEventListener('wheel',e=>{e.preventDefault();frontRulesScroll(e.deltaY*.0016,false);FR.rb.v=0},{passive:false});
  }
  mk('frRbX','닫기').addEventListener('click',()=>frontRules(null));
  mk('frRbBack','뒤로').addEventListener('click',()=>{sfx('tick');frontRulesBack()});
  for(let k=0;k<RB_PG;k++)mk('frRbPg'+k,'').addEventListener('click',()=>frontRulesGo(k));
  mk('frRbTitle','게임 고르기').addEventListener('click',()=>{const S=FR.rb;if(!S.on||S.chg||S.mode!=='game')return;sfx('tick');S.fromList=true;frontRulesSet('list',null,0,true)});   // 게임 이름을 누르면 게임 목록 판
}
/* 화면 비율에 맞춰 판자 높이를 정함: 세로로 긴 화면은 판자를 길게 + 글자·장치를 크게 (폭은 그대로라 카메라가 더 멀어지지 않음) */
function rbFitFor(a){const L=Math.max(1.6,Math.min(2.6,1.48/a-.2));return Math.round(L*20)/20}
function rbFit(L,force){
  const P=T.rb;if(!P||(!force&&P.fitL===L))return;
  P.fitL=L;RB.L=L;RB.tall=L>=1.95;RB.FB=RB.tall?50:42;RB.LH=RB.tall?70:60;
  RB.RY0=RB.tall?230:190;RB.RSTEP=RB.tall?150:112;RB.RH=RB.tall?128:96;
  const PH=L+.06;
  for(const s of P.posts){s.post.scale.y=PH;s.post.position.y=PH/2;s.po.scale.y=PH+.03;s.po.position.y=PH/2;s.cap.position.y=s.co.position.y=PH+.025}
  P.xk.position.y=P.xkO.position.y=P.bk.position.y=P.bkO.position.y=PH-.13;
  P.lever.g.position.y=L*.55;P.win.scale.y=L;P.win.position.y=L/2;
  rbPlanks.c={};rbSetPlanks.c=null;
  if(FR.rb&&FR.rb.on){FR.rb.s=0;rbDraw()}
}
/* 규칙 글 → 항목 [{t:이름, runs:[{s,b}]}] */
function rbSections(gid){
  const d=document.createElement('div');d.innerHTML=gameOf(gid).rulesHTML||'';const out=[];
  const lis=[...d.querySelectorAll('li')].filter(li=>!li.parentElement.closest('li'));
  for(const li of lis){
    const first=li.firstElementChild&&li.firstChild===li.firstElementChild&&/^(B|STRONG)$/.test(li.firstElementChild.tagName)?li.firstElementChild:null;
    const runs=[];
    const walk=(n,b)=>{for(const c of n.childNodes){
      if(c===first)continue;
      if(c.nodeType===3){runs.push({s:c.textContent,b})}
      else if(c.tagName==='BR'){runs.push({s:'\n',b})}
      else if(c.tagName==='LI'){runs.push({s:'\n· ',b});walk(c,b)}
      else walk(c,b||/^(B|STRONG)$/.test(c.tagName))}};
    walk(li,false);
    if(runs.length)runs[0].s=runs[0].s.replace(/^\s*:\s*/,'');
    out.push({t:first?first.textContent.trim():'',runs});
  }
  return out;
}
const RB_BODY='"Jua","Black Han Sans","Apple SD Gothic Neo",sans-serif',RB_HEAD='"Black Han Sans","Jua","Apple SD Gothic Neo",sans-serif';
/* 줄 나누기: 낱말(띄어쓰기) 단위, 너무 긴 낱말은 글자 단위 */
function rbWrap(g,runs,maxW){
  const lines=[[]];let w=0;
  const font=b=>`${b?'700 ':''}${RB.FB}px ${RB_BODY}`;
  for(const r of runs){
    const parts=r.s.split(/(\n|\s+)/);
    for(const p of parts){
      if(!p)continue;
      if(p==='\n'){lines.push([]);w=0;continue}
      g.font=font(r.b);
      if(/^\s+$/.test(p)){if(w>0){const sw=g.measureText(' ').width;lines[lines.length-1].push({s:' ',b:r.b,w:sw});w+=sw}continue}
      let pw=g.measureText(p).width;
      if(w+pw>maxW&&w>0){const cur=lines[lines.length-1];while(cur.length&&cur[cur.length-1].s===' ')cur.pop();lines.push([]);w=0}
      if(pw<=maxW){lines[lines.length-1].push({s:p,b:r.b,w:pw});w+=pw;continue}
      for(const ch of p){const cw=g.measureText(ch).width;if(w+cw>maxW&&w>0){lines.push([]);w=0}lines[lines.length-1].push({s:ch,b:r.b,w:cw});w+=cw}
    }
  }
  return lines.filter((l,i)=>l.length||i<lines.length-1);
}
/* 판자 나누기: 머리(게임 이름) + 항목들을 판자 높이에 맞게 담음. 한 항목이 넘치면 그 항목만 긴 판자 */
function rbPlanks(gid){
  const c=rbPlanks.c||(rbPlanks.c={});if(c[gid])return c[gid];
  const g=document.createElement('canvas').getContext('2d'),maxW=RB.CW-2*RB.MX,H0=Math.round(RB.L*RB.PX);
  const items=rbSections(gid).map(sc=>{const lines=rbWrap(g,sc.runs,maxW);return {t:sc.t,lines,h:(sc.t?70:0)+lines.length*RB.LH}});
  const planks=[];let cur={items:[],h:RB.TOP+120};   // 첫 판자: 게임 이름
  cur.head=gameOf(gid).name;
  for(const it of items){
    if(cur.items.length&&cur.h+RB.GAP+it.h+RB.BOT>H0){planks.push(cur);cur={items:[],h:RB.TOP}}
    cur.items.push(it);cur.h+=(cur.items.length>1?RB.GAP:0)+it.h;
  }
  planks.push(cur);
  planks.forEach(p=>{p.px=Math.max(H0,p.h+RB.BOT)});
  return c[gid]=planks;
}
/* 나무 바탕: 결 무늬 + 가장자리 그을림 */
function rbWood(g,w,h,seed){
  g.fillStyle='#c99560';g.fillRect(0,0,w,h);
  const r=gfxRng(seed);
  for(let k=0;k<h/9;k++){const y=r()*h,a=.06+r()*.14;g.strokeStyle=`rgba(110,60,25,${a})`;g.lineWidth=1+r()*3;g.beginPath();g.moveTo(0,y);for(let x=0;x<=w;x+=64)g.lineTo(x,y+Math.sin(x/120+k)*6*r());g.stroke()}
  for(let k=0;k<3;k++){const x=r()*w,y=r()*h;g.strokeStyle='rgba(95,50,20,.35)';g.lineWidth=3;g.beginPath();g.ellipse(x,y,26+r()*20,8+r()*5,0,0,7);g.stroke()}   // 옹이
  const e=g.createLinearGradient(0,0,26,0);e.addColorStop(0,'rgba(80,40,15,.45)');e.addColorStop(1,'rgba(80,40,15,0)');g.fillStyle=e;g.fillRect(0,0,26,h);
  const e2=g.createLinearGradient(w,0,w-26,0);e2.addColorStop(0,'rgba(80,40,15,.45)');e2.addColorStop(1,'rgba(80,40,15,0)');g.fillStyle=e2;g.fillRect(w-26,0,26,h);
}
/* 새긴 글자(제목): 파낸 홈 = 짙은 글자 + 아래쪽 밝은 테두리. 지진 글자(본문): 짙은 갈색 + 그을린 번짐 */
function rbCarve(g,txt,x,y,size,align){g.font=`${size}px ${RB_HEAD}`;g.textAlign=align;g.textBaseline='alphabetic';g.fillStyle='rgba(255,226,180,.75)';g.fillText(txt,x,y+3);g.fillStyle='#2a160a';g.fillText(txt,x,y)}
function rbBurn(g,draw){g.save();g.shadowColor='rgba(100,45,10,.55)';g.shadowBlur=5;g.fillStyle='#3b1d0b';draw();g.restore()}
/* 설정 판자: 항목 이름은 지진 글자, 장치는 판자에 박힌 나무·놋쇠
   숫자 = 플립 칸 + 나무 ◀▶(숫자 칸 왼쪽 절반을 눌러도 −, 오른쪽 절반은 +), 켜기·끄기 = 홈 속 놋쇠 손잡이(왼쪽 끄기·오른쪽 켜기),
   고르기 = 새긴 선택지 아래 홈을 미끄러지는 놋쇠 못. 방장만 바꿈(참가자는 금지 소리). 정해진 값과 다른 규칙은 이름 옆 붉은 인두 점.
   ⚙ 탁자 설정: 관전 인원 같은 탁자 공통 항목. 🎲 게임 설정: 게임 모드·게임별 값·규칙(G.boardSet 포함)
   (맨 위 묶음 레버(대부호·오목) → 바꾸면 아래 항목이 한꺼번에 미끄러짐. 항목마다 act(v)가 패널 동작 문자열을 돌려주면 G.panelAct, 'tog:k'면 toggleRule) */
const RS={CX:774,X0:0};
function rbSetItems(){   // main = 탁자 설정(관전 인원 등 탁자 공통), det = 게임 설정(게임 모드·게임별 값·규칙·G.boardSet)
  if(!V||!V.cfg)return {main:[],det:[]};
  const g=G,c=V.cfg,main=[],det=[];
  const D={max:4,spec:4,...g.defaults},skip=new Set(['max','spec','rounds','chips','turn','grace','tm','inc','stones']);
  const off=(k,v)=>!skip.has(k)&&D[k]!=null&&+D[k]!==+v;
  const common=new Set(COMMON_SET.map(d=>d.k));
  if(!g.noFast){const v=+c.fast?1:0;det.push({kind:'choice',k:'fast',label:'게임 모드',opts:OPT_LABEL.fast,desc:(g.modeDesc||MODE_DESC).map((d,i)=>`${OPT_LABEL.fast[i]}: ${d}`).join('<br>'),v,diff:!!v,act:o=>'mode'+o})}
  for(const d of roomSetOf(g,c))if(!d.lever){   // 최대 인원도 여기(탁자 설정 판자)에서 바꿈
    const v=+(c[d.k]??0);(common.has(d.k)?main:det).push({kind:'num',...d,v,diff:off(d.k,v)})}
  if(g.boardSet)det.push(...g.boardSet(c));
  else for(const d of g.ruleSet)if(!d.hidden)det.push(rbRuleItem(d,c,off));
  return {main,det};
}
function rbRuleItem(d,c,off){   // 규칙 하나 → 판자 항목 (pick이면 선택·무작위 버튼 둘, 아니면 켜기·끄기)
  const v=+c[d.k]?1:0;
  if(d.pick)return {kind:'choice',k:d.k,label:d.label,opts:PICK_OPTS,desc:d.desc,v:pickIdx(v),diff:off?off(d.k,v):false,act:o=>'set:'+d.k+':'+pickVal(o)};
  return {kind:'tog',...d,v,diff:off?off(d.k,v):false,act:()=>'tog:'+d.k};
}
function rbRowH(it){const two=RB.tall?it.kind!=='tog':it.kind==='choice'&&(it.opts.length>2||it.opts.join('').length>8);return {two,h:two?(RB.tall?206:150):(RB.tall?120:96),gap:RB.tall?16:16}}
/* 판자 나누기: [{title, rows:[{it,y,two,h}]}]. ⚙ 탁자 설정 묶음 다음에 🎲 게임 설정 묶음은 새 판자부터 */
function rbSetPlanks(){
  const S=FR.rb,sets=rbSetItems(),key=JSON.stringify([V&&V.cfg,G.id,RB.L,mode,(V&&V.ps||[]).length,(V&&V.sv||[]).length]);
  if(rbSetPlanks.c&&rbSetPlanks.c.key===key)return rbSetPlanks.c.v;
  const H0=Math.round(RB.L*RB.PX),out=[];
  for(const [grp,items,title] of [['main',sets.main,'탁자 설정'],['det',sets.det,'게임 설정']]){
    if(!items.length)continue;
    let cur={grp,title,rows:[]},y=RB.tall?200:178;
    for(const it of items){const {two,h,gap}=rbRowH(it);
      if(cur.rows.length&&y+h>H0-50){out.push(cur);cur={grp,title:'',rows:[]};y=60}
      cur.rows.push({it,y,two,h});y+=h+gap}
    out.push(cur);
  }
  if(!out.length)out.push({grp:'main',title:'탁자 설정',rows:[]});
  rbSetPlanks.c={key,v:out};return out;
}
const rbNSet=()=>FR.rb.set?rbSetPlanks().length:0;
function rbLo(it){if(it.k==='max')return Math.max(it.lo,(V.ps||[]).length,2);if(it.k==='spec')return Math.max(it.lo,Array.isArray(V.sv)?V.sv.length:0);return it.lo}
/* 장치 자리(판자 그림 좌표). 누르는 자리 계산과 그리기가 같이 씀 */
function rbCtl(row){
  const it=row.it,T2=RB.tall,R=RS.CX,L0=RB.MX,o={y:row.y,parts:[]};
  o.ny=row.two?row.y+(T2?40:30):row.y+row.h/2;   // 이름 줄 가운데
  o.cy=row.two?row.y+row.h-(T2?64:44):row.y+row.h/2;   // 장치 줄 가운데
  o.ch=row.two?(T2?128:88):row.h;   // 장치 줄 높이 (누르는 자리)
  if(it.kind==='num'){
    const nd=String(it.hi).length,cw=T2?80:60,gap=6,cells=nd*cw+(nd-1)*gap,uw=it.unit?(T2?60:52):0,bw=row.two?(T2?170:120):62;
    let xd,xi,xc;
    if(row.two){xd=L0;xi=R-bw;xc=(xd+bw+xi)/2-(cells+uw)/2}
    else{xi=R-uw-bw;xc=xi-10-cells;xd=xc-10-bw}
    o.unit=[row.two?xc+cells+8:xi+bw+6,o.cy];o.cells={x:xc,w:cw,gap,nd,h:T2?108:84};o.btn={dec:{x:xd,w:bw},inc:{x:xi,w:bw}};
    const mid=xc+cells/2;o.parts=[{a:'dec',x:xd,w:mid-xd},{a:'inc',x:mid,w:xi+bw-mid}];
  }else if(it.kind==='tog'){const w=T2?190:150;o.sw={x:R-w,w,h:T2?66:52};o.parts=[{a:'tog',x:R-w-40,w:w+40}]}
  else{const n=it.opts.length,w=row.two?(R-L0)/n:Math.min(190,360/n);o.opt={x:R-w*n,w,n};o.parts=it.opts.map((_,k)=>({a:'opt'+k,x:R-w*(n-k),w}))}
  o.name={x:L0,w:row.two?R-L0:(Math.min(...o.parts.map(p=>p.x),o.btn?o.btn.dec.x:1e9)-L0-16)};
  return o;
}
const RBA={};   // 장치 움직임: 키마다 {v(지금 그린 값), from, at, flip}
const RB_NAME=s=>s.replace(/\s*\(.*\)\s*/,'');
function rbDrawSet(g,idx,t){
  const pl=rbSetPlanks()[idx],h=Math.round(RB.L*RB.PX),T2=RB.tall;if(!pl)return false;
  rbWood(g,RB.CW,h,3+idx*5);
  if(pl.title){rbCarve(g,pl.title,RB.CW/2,T2?140:124,T2?82:72,'center');rbBurn(g,()=>{g.fillRect(RB.CW/2-150,T2?162:144,300,5)})}
  let busy=false;
  const host=mode==='host',pr=FR.rb.press;
  pl.rows.forEach(row=>{
    const it=row.it,c=rbCtl(row),v=it.v,A=RBA[it.k]||(RBA[it.k]={v,from:v,at:-1e9,flip:-1e9});
    if(A.v!==v){A.from=A.v;A.v=v;A.at=t;if(it.kind==='num')A.flip=t}
    const k=Math.min(1,(t-A.at)/(it.kind==='choice'?320:240)),e=smooth(k);if(k<1)busy=true;
    // 이름: 지진 글자 (넘치면 줄임), 정해진 값과 다르면 붉은 인두 점
    const nm=RB_NAME(it.label);let fs=T2?54:46;g.font=`${fs}px ${RB_BODY}`;while(fs>28&&g.measureText(nm).width>c.name.w-24){fs-=2;g.font=`${fs}px ${RB_BODY}`}
    rbBurn(g,()=>{g.textAlign='left';g.textBaseline='middle';g.font=`${fs}px ${RB_BODY}`;g.fillText(nm,RB.MX,c.ny+3)});
    if(it.diff){const nw=g.measureText(nm).width;g.save();g.shadowColor='rgba(170,30,10,.6)';g.shadowBlur=6;g.fillStyle='#a3200f';g.beginPath();g.arc(RB.MX+nw+14,c.ny-12,7,0,7);g.fill();g.restore()}
    g.strokeStyle='rgba(90,45,15,.22)';g.lineWidth=2;g.beginPath();g.moveTo(RB.MX,row.y+row.h+8);g.lineTo(RS.CX,row.y+row.h+8);g.stroke();
    if(it.kind==='num'){
      const lo=rbLo(it),bh=row.two?(T2?110:84):72;
      for(const a of ['dec','inc']){const p=c.btn[a],dis=!host||(a==='dec'?v<=lo:v>=it.hi),down=pr&&pr.k===it.k&&pr.a===a&&t-pr.at<140;if(down)busy=true;
        g.fillStyle='rgba(60,30,10,.45)';rr(g,p.x+3,c.cy-bh/2+5,p.w,bh,12);g.fill();   // 그림자
        g.fillStyle=down?'#9a6838':'#b07a45';rr(g,p.x,c.cy-bh/2+(down?4:0),p.w,bh,12);g.fill();
        g.strokeStyle='rgba(60,30,10,.6)';g.lineWidth=3;g.stroke();
        g.fillStyle=dis?'rgba(59,29,11,.3)':'#3b1d0b';const mx=p.x+p.w/2,my=c.cy+(down?4:0),s=a==='dec'?-1:1,ts=row.two?(T2?24:18):14;
        const bl=ts*2.1,bt=ts*.6;rr(g,mx-bl/2,my-bt/2,bl,bt,bt/2);g.fill();if(s>0)rr(g,mx-bt/2,my-bl/2,bt,bl,bt/2),g.fill()}   // − / +
      const C=c.cells,str=String(v).padStart(C.nd,' '),fk=(t-A.flip)/180,mid=fk>=0&&fk<1;if(mid)busy=true;
      for(let d=0;d<C.nd;d++){const x=C.x+d*(C.w+C.gap),fh=C.h,y0=c.cy-fh/2;
        g.fillStyle='#16100c';rr(g,x,y0,C.w,fh,8);g.fill();g.fillStyle='#231a14';rr(g,x,y0,C.w,fh/2,8);g.fill();g.fillRect(x,y0+fh/2-8,C.w,8);
        g.fillStyle='rgba(0,0,0,.55)';g.fillRect(x,y0+fh/2-1.5,C.w,3);
        const ch=str[d];if(ch&&ch!==' '){g.save();g.fillStyle='#f6ecd8';g.textAlign='center';g.textBaseline='middle';g.font=`${Math.round(fh*.76)}px "Black Han Sans","Jua",sans-serif`;
          if(mid){g.translate(x+C.w/2,y0+fh/2+3);g.scale(1,Math.abs(Math.cos(fk*Math.PI))*.8+.2);g.globalAlpha=.85;g.fillText(fk<.5?String(A.from).padStart(C.nd,' ')[d]||'':ch,0,0)}else g.fillText(ch,x+C.w/2,y0+fh/2+3);g.restore()}}
      if(it.unit)rbBurn(g,()=>{g.font=`${T2?46:40}px ${RB_BODY}`;g.textAlign='left';g.textBaseline='middle';g.fillText(it.unit,c.unit[0],c.unit[1]+3)});
    }else if(it.kind==='tog'){
      const S2=c.sw,gx=S2.x,gh=S2.h,gy=c.cy-gh/2,gw=S2.w,p=A.from+(v-A.from)*e,kr=gh/2+1;
      g.fillStyle='#2b1a0f';rr(g,gx,gy,gw,gh,gh/2);g.fill();g.fillStyle='rgba(0,0,0,.35)';rr(g,gx+4,gy+4,gw-8,10,6);g.fill();
      if(v){g.fillStyle='rgba(242,182,50,.35)';rr(g,gx+4,gy+4,gw-8,gh-8,gh/2-4);g.fill()}
      const kx=gx+kr+3+(gw-2*kr-6)*p,grd=g.createRadialGradient(kx-8,c.cy-10,4,kx,c.cy,kr+3);grd.addColorStop(0,'#f2d08a');grd.addColorStop(1,'#a77b3e');
      g.fillStyle='rgba(0,0,0,.4)';g.beginPath();g.arc(kx+3,c.cy+4,kr,0,7);g.fill();g.fillStyle=grd;g.beginPath();g.arc(kx,c.cy,kr,0,7);g.fill();g.strokeStyle='#5a3a1c';g.lineWidth=3;g.stroke();
    }else{
      const O=c.opt,p=A.from+(v-A.from)*e,ty=row.two?c.cy-(T2?22:16):c.cy-14,gy=row.two?c.cy+(T2?30:22):c.cy+20,pr2=T2?22:16;
      it.opts.forEach((s,k2)=>{rbBurn(g,()=>{let f=row.two?(T2?48:40):38;g.font=`${f}px ${RB_BODY}`;while(f>24&&g.measureText(s).width>O.w-14){f-=2;g.font=`${f}px ${RB_BODY}`}g.textAlign='center';g.textBaseline='middle';g.globalAlpha=k2===v?1:.5;g.fillText(s,O.x+O.w*(k2+.5),ty)})});
      g.fillStyle='#2b1a0f';rr(g,O.x+O.w/2-pr2,gy-8,O.w*(O.n-1)+2*pr2,16,8);g.fill();
      for(let k2=0;k2<O.n;k2++){g.fillStyle='rgba(20,10,4,.6)';g.beginPath();g.arc(O.x+O.w*(k2+.5),gy,5,0,7);g.fill()}   // 못이 꽂히는 구멍
      const px=O.x+O.w*(p+.5),grd=g.createRadialGradient(px-5,gy-6,3,px,gy,pr2+2);grd.addColorStop(0,'#f2d08a');grd.addColorStop(1,'#a77b3e');
      g.fillStyle='rgba(0,0,0,.4)';g.beginPath();g.arc(px+3,gy+4,pr2,0,7);g.fill();g.fillStyle=grd;g.beginPath();g.arc(px,gy,pr2,0,7);g.fill();g.strokeStyle='#5a3a1c';g.lineWidth=3;g.stroke();
    }
  });
  return busy;
}
function rbDraw(t){
  t=t??clock();const P=T.rb,S=FR.rb;if(!P)return false;const cv=P.cv,g=cv.getContext('2d');let busy=false;
  const nS=rbNSet();
  if(S.mode==='list'){
    const h=Math.round(RB.L*RB.PX);if(cv.height!==h)cv.height=h;cv.width=RB.CW;
    rbWood(g,RB.CW,h,7);rbCarve(g,'게임 규칙',RB.CW/2,RB.tall?140:120,RB.tall?82:72,'center');
    rbBurn(g,()=>{g.fillRect(RB.CW/2-150,RB.tall?162:140,300,5)});
    GAME_IDS.forEach((id,i)=>{const y=RB.RY0+i*RB.RSTEP,lit=i===S.pick&&clock()-S.pickAt<420;if(y+RB.RH>h-20)return;
      if(lit){g.fillStyle='rgba(255,236,190,.55)';rr(g,RB.MX-20,y,RB.CW-2*RB.MX+40,RB.RH,16);g.fill()}
      rbBurn(g,()=>{g.font=`${RB.tall?66:58}px ${RB_BODY}`;g.textAlign='left';g.textBaseline='middle';g.fillText(gameOf(id).name,RB.MX+30,y+RB.RH/2+4);
        g.beginPath();g.arc(RB.MX+6,y+RB.RH/2,7,0,7);g.fill();
        g.lineWidth=7;g.strokeStyle='#3b1d0b';g.lineCap='round';g.beginPath();g.moveTo(RB.CW-RB.MX-26,y+RB.RH/2-18);g.lineTo(RB.CW-RB.MX-8,y+RB.RH/2);g.lineTo(RB.CW-RB.MX-26,y+RB.RH/2+18);g.stroke()});
      g.strokeStyle='rgba(90,45,15,.25)';g.lineWidth=2;g.beginPath();g.moveTo(RB.MX,y+RB.RH+8);g.lineTo(RB.CW-RB.MX,y+RB.RH+8);g.stroke()});
  }else if(S.pg<nS){
    const h=Math.round(RB.L*RB.PX);if(cv.height!==h)cv.height=h;cv.width=RB.CW;
    busy=rbDrawSet(g,S.pg,t);
  }else{
    const pl=rbPlanks(S.gid)[S.pg-nS];if(!pl)return false;
    if(cv.height!==pl.px)cv.height=pl.px;cv.width=RB.CW;
    rbWood(g,RB.CW,pl.px,11+S.pg*7+GAME_IDS.indexOf(S.gid)*31);
    let y=RB.TOP;
    if(pl.head){rbCarve(g,pl.head,RB.CW/2,y+66,80,'center');rbBurn(g,()=>{g.fillRect(RB.CW/2-170,y+88,340,5)});y+=120}
    pl.items.forEach((it,k)=>{
      if(k)y+=RB.GAP;
      if(it.t){rbCarve(g,it.t,RB.MX,y+54,RB.tall?62:56,'left');y+=70}
      for(const line of it.lines){
        let x=RB.MX;
        rbBurn(g,()=>{g.textAlign='left';g.textBaseline='alphabetic';for(const w of line){g.font=`${w.b?'700 ':''}${RB.FB}px ${RB_BODY}`;g.fillStyle=w.b?'#1e0e05':'#3b1d0b';g.fillText(w.s,x,y+RB.LH*.73);if(w.b){g.lineWidth=1.4;g.strokeStyle='#1e0e05';g.strokeText(w.s,x,y+RB.LH*.73)}x+=w.w}});
        y+=RB.LH;
      }
    });
  }
  P.tex.needsUpdate=true;return busy;
}
function rbPages(){return FR.rb.mode==='list'?1:rbNSet()+rbPlanks(FR.rb.gid).length}
function rbLen(){const S=FR.rb;if(S.mode==='list'||S.pg<rbNSet())return RB.L;const p=rbPlanks(S.gid)[S.pg-rbNSet()];return p?p.px/RB.PX:RB.L}
/* 쪽 단추 그림: ⚙ / 🎲 / 숫자 (원통 윗면이 90도 돌아 보여서 미리 반대로 돌려 그림) */
function rbPgLabel(k,nS){if(k<nS){const P=rbSetPlanks()[k];return P.grp==='main'?'⚙':'🎲'}return String(k-nS+1)}
function rbPgPaint(b,lab,lit){
  const g=b.cv.getContext('2d');g.setTransform(1,0,0,1,0,0);g.fillStyle=lit?'#f2d08a':'#b8925a';g.fillRect(0,0,128,128);
  g.translate(64,64);g.rotate(-Math.PI/2);g.strokeStyle=g.fillStyle=lit?'#3b1d0b':'#4a2c14';
  if(lab==='🎲'){   // 게임 설정: 주사위
    g.lineWidth=11;g.lineJoin='round';rr(g,-34,-34,68,68,14);g.stroke();
    for(const [x,y] of [[-16,-16],[16,16],[0,0],[16,-16],[-16,16]]){g.beginPath();g.arc(x,y,7,0,7);g.fill()}}
  else if(lab[0]==='⚙'){const plus=lab.length>1&&lab[1]==='+',cx=plus?-10:0,cy=plus?6:0,R=plus?28:34;
    g.save();g.translate(cx,cy);g.lineWidth=plus?11:13;for(let a=0;a<8;a++){g.rotate(Math.PI/4);g.beginPath();g.moveTo(0,-R+4);g.lineTo(0,-R-10);g.stroke()}
    g.beginPath();g.arc(0,0,R-8,0,7);g.lineWidth=plus?10:12;g.stroke();g.beginPath();g.arc(0,0,plus?6:8,0,7);g.fill();g.restore();
    if(plus){g.lineWidth=12;g.lineCap='round';g.beginPath();g.moveTo(26,-40);g.lineTo(26,-12);g.moveTo(12,-26);g.lineTo(40,-26);g.stroke()}}
  else{g.font=`${lab.length>1?66:80}px "Black Han Sans","Jua",sans-serif`;g.textAlign='center';g.textBaseline='middle';g.fillText(lab,0,6)}
  b.tx.needsUpdate=true;
}
/* 열기·닫기. gid: 'list' = 게임 목록, 게임 id = 그 게임 규칙, null = 닫기. opt.set: 설정 판자부터(대기실) */
function frontRules(gid,opt){
  const S=FR.rb;
  if(gid==null){if(!S.on)return;S.on=false;S.drag=false;rbTag(null);if(mode==='lobby'||frWaitV())FR.leanOn=false;sfx('tick');return}
  if(!FR.ok)return;
  S.set=!!(opt&&opt.set);S.fromList=false;rbSetPlanks.c=null;
  frontRulesSet(gid==='list'?'list':'game',gid==='list'?null:gid,0,false);
  S.on=true;FR.leanOn=true;FR.keyAt=clock();
}
function frontRulesSet(m,gid,pg,anim){
  const S=FR.rb,t=clock();rbTag(null);
  if(anim&&T.rb){S.chg={at:t,from:{len:rbLen()},to:{m,gid,pg},sw:false};sfx('lid');return}
  S.mode=m;S.gid=gid;S.pg=pg;S.s=0;S.v=0;S.bobAt=t+300;rbDraw(t);
}
function frontRulesBack(){   // ← 단추·Esc: 목록에서 들어온 게임 규칙이면 목록으로, 아니면 닫기
  const S=FR.rb;if(!S.on)return;
  if(S.mode==='game'&&S.fromList){S.fromList=false;frontRulesSet('list',null,0,true);return}
  frontRules(null);
}
function frontRulesPage(dir){
  const S=FR.rb;if(!S.on||S.chg)return;
  if(T.rb){T.rb.lever.at=clock();T.rb.lever.dir=dir}
  const n=rbPages();
  if(n<=1){sfx('lid');setTimeout(()=>sfx('no'),120);return}
  frontRulesSet(S.mode,S.gid,(S.pg+dir+n)%n,true);
}
function frontRulesGo(k){   // 왼쪽 기둥의 쪽 단추: 그 판자로 바로
  const S=FR.rb;if(!S.on||S.chg||S.mode!=='game')return;
  if(k===S.pg||k>=rbPages()){sfx('tick');return}
  sfx('key');frontRulesSet(S.mode,S.gid,k,true);
}
function frontRulesPick(yPx,hPx){
  const S=FR.rb,ypx=yPx/hPx*RB.L*RB.PX,i=Math.floor((ypx-RB.RY0)/RB.RSTEP);
  if(i<0||i>=GAME_IDS.length||ypx-RB.RY0-i*RB.RSTEP>RB.RH)return;
  S.pick=i;S.pickAt=clock();rbDraw();sfx('key');
  setTimeout(()=>{if(S.on&&S.mode==='list'){S.fromList=true;frontRulesSet('game',GAME_IDS[i],0,true)}},240);
}
/* 설정 판자 장치 누르기 (방장만). 숫자 ◀▶는 꾹 누르면 계속 */
function rbItem(k){const s=rbSetItems();return [...s.main,...s.det].find(x=>x.k===k)}
function rbRun(s){if(!s)return;if(G.panelAct&&G.panelAct(s))return;if(s.startsWith('tog:')){toggleRule(s.slice(4));return}
  if(s.startsWith('set:')){const p=s.split(':');setRule(p[1],p[2]);return}
  if(s==='mode0'||s==='mode1'){if(H.phase==='wait'&&!EG().noFast){H.cfg={...H.cfg,fast:s==='mode1'?1:0};saveRoomCfg(H.cfg);lastPanelHtml='';mark()}}}
function rbSetAct(k,a){
  const it=rbItem(k);if(!it)return;
  if(mode!=='host'||!H||H.phase!=='wait'){sfx('no');return}
  FR.rb.press={k,a,at:clock()};
  if(it.kind==='num'){const v=it.v,nv=v+(a==='inc'?it.step:-it.step);if((a==='dec'&&v<=rbLo(it))||(a==='inc'&&v>=it.hi)){sfx('no');return false}setRoomCfg(k,nv);sfx('flap');return true}
  if(it.kind==='tog'){rbRun(it.act(it.v?0:1));sfx('lock');return}
  if(a.startsWith('opt')){const o=+a.slice(3);if(it.v===o)return;rbRun(it.act(o));sfx('lock')}
}
const RBH={timer:null};
function rbHoldStop(){clearTimeout(RBH.timer);RBH.timer=null}
['pointerup','pointercancel','blur'].forEach(ev=>window.addEventListener(ev,rbHoldStop));
/* 항목 이름을 누르면 판자 옆에 나무 꼬리표(설명)가 걸림 */
function rbTag(it,x,y){
  let el=$('#rbTag');
  if(!it){if(el)el.hidden=true;return}
  if(!it.desc){sfx('tick');return}
  if(!el){el=document.createElement('div');el.id='rbTag';el.className='rbtag';$('#front').appendChild(el);el.addEventListener('click',()=>{el.hidden=true})}
  el.innerHTML=`<b>${esc(RB_NAME(it.label))}</b>${it.desc}`;el.hidden=false;
  const fr=$('#front').getBoundingClientRect();el.style.left=Math.round(Math.max(8,Math.min(x,fr.width-Math.min(300,fr.width*.8)-8)))+'px';el.style.top=Math.round(y)+'px';el.classList.remove('swing');void el.offsetWidth;el.classList.add('swing');
  clearTimeout(rbTag.tm);rbTag.tm=setTimeout(()=>{el.hidden=true},6000);sfx('paper');
}
document.addEventListener('pointerdown',e=>{const el=$('#rbTag');if(!el||el.hidden||e.target.closest('#rbTag'))return;el.hidden=true},true);   // 꼬리표 바깥을 누르면 닫힘 (이름을 다시 누르면 새로 걸림)
/* 판자 그림 좌표 → 화면 좌표 */
const _rbv=window.THREE?new THREE.Vector3():null;
function rbScreen(xpx,ypx,W,Hh){const P=T.rb,len=P.plank.scale.y,hpx=len*RB.PX;_rbv.set((xpx/RB.CW-.5)*RB.W,.5-ypx/hpx,.045);P.plank.localToWorld(_rbv);_rbv.project(T.cam);return [(_rbv.x+1)/2*W,(1-_rbv.y)/2*Hh]}
function rbLayoutSet(on,W,Hh){
  const S=FR.rb,pl=on?rbSetPlanks()[S.pg]:null;let n=0;
  const put=(l,t2,r,b,data)=>{const id=n++;let el=$('#frRs'+id);if(!el){el=document.createElement('button');el.type='button';el.className='fr-hot off fr-key rs-hot';el.id='frRs'+id;$('#front').insertBefore(el,$('#frFoot'));
      el.addEventListener('pointerdown',e=>{const d=el.dataset;if(d.a==='name')return;e.preventDefault();rbHoldStop();const ok=rbSetAct(d.k,d.a);
        if(ok===true&&(d.a==='inc'||d.a==='dec')){let c2=0;const go=()=>{if(rbSetAct(d.k,d.a)===true){c2++;RBH.timer=setTimeout(go,c2<6?140:c2<16?80:45)}};RBH.timer=setTimeout(go,400)}});
      el.addEventListener('click',()=>{const d=el.dataset;if(d.a!=='name')return;const r=el.getBoundingClientRect(),fr=$('#front').getBoundingClientRect();rbTag(rbItem(d.k),r.left-fr.left,r.bottom-fr.top+4)})}
    el.dataset.k=data.k;el.dataset.a=data.a;el.setAttribute('aria-label',data.lab);
    frontPut(el,true,{l,t:t2,r,b},0,40,40)};
  if(pl)pl.rows.forEach(row=>{const it=row.it,c=rbCtl(row);
    {const nh=row.two?(RB.tall?64:52):row.h,[l,t2]=rbScreen(c.name.x,c.ny-nh/2,W,Hh),[r,b]=rbScreen(c.name.x+Math.min(c.name.w,row.two?420:c.name.w),c.ny+nh/2,W,Hh);put(l,t2,r,b,{k:it.k,a:'name',lab:it.label+' 설명'})}
    for(const p of c.parts){const [l,t2]=rbScreen(p.x,c.cy-c.ch/2,W,Hh),[r,b]=rbScreen(p.x+p.w,c.cy+c.ch/2,W,Hh);
      put(l,t2,r,b,{k:it.k,a:p.a,lab:RB_NAME(it.label)+' '+(p.a==='dec'?'줄이기':p.a==='inc'?'늘리기':p.a==='tog'?'켜기·끄기':it.opts[+p.a.slice(3)])})}});
  for(let k=n;$('#frRs'+k);k++)frontPut($('#frRs'+k),false,null,0);
}
function frontRulesScroll(ds,drag){
  const S=FR.rb;if(!S.on||S.chg)return;const max=Math.max(0,rbLen()-RB.L);
  if(drag&&(S.s+ds<0||S.s+ds>max))ds*=.35;   // 끝을 넘으면 뻑뻑하게
  S.s+=ds;if(!drag){const c=Math.max(0,Math.min(max,S.s));if(c!==S.s&&max>0&&!S.bumped){S.bumped=1;sfx('lid')}S.s=c}
  FR.keyAt=clock();
}
function frontRulesUpdate(t,dt,lobby,wait){
  const P=T.rb,S=FR.rb;if(!P)return;
  if(S.on&&((!lobby&&!wait)||FR.warp||FR.spread||(lobby&&!FR.sit)||roomSetOpen||FR.browse)){S.on=false;S.drag=false}
  const others=FR.ma.v<=.01&&FR.ka.v<=.01&&FR.pla.v<=.01&&[T.hostPad,T.guestPad,T.sitPad].every(Q=>!Q||Q.a.v<=.01);
  const v=frontTween(FR.rba,S.on&&others?1:0,t,S.on?560:400),u=smooth(v);
  if(FR.rba.to===1&&v>0&&!S.up){S.up=1;sfx('btnUp')}if(FR.rba.to===0)S.up=0;
  P.g.visible=v>.01;if(!P.g.visible)return;
  P.r.position.y=-(RB.L+.25)*(1-u);
  // 판자 바꾸기: 들어갔다가(0~.5) 다음 판자가 올라옴(.5~1)
  let off=0;
  if(S.chg){const k=(t-S.chg.at)/620;
    if(k<.5)off=-(S.chg.from.len+.12)*smooth(k*2);
    else{if(!S.chg.sw){S.chg.sw=true;const to=S.chg.to;S.mode=to.m;S.gid=to.gid;S.pg=to.pg;S.s=0;S.v=0;rbDraw()}off=-(rbLen()+.12)*(1-smooth(Math.min(1,(k-.5)*2)))}
    if(k>=1){S.chg=null;S.bobAt=t;S.setKey=''}}   // 바뀐 판자는 다시 그림(넘기는 동안 바뀐 값의 움직임을 마저 그림)
  // 밀기 관성, 끝을 넘으면 되돌아옴
  const max=Math.max(0,rbLen()-RB.L);
  if(!S.drag&&!S.chg){
    if(Math.abs(S.v)>.01){S.s+=S.v*dt;S.v*=Math.exp(-dt*5)}else S.v=0;
    const c=Math.max(0,Math.min(max,S.s));
    if(c!==S.s){if(Math.abs(S.v)>.4&&!S.bumped){S.bumped=1;sfx('lid')}S.v=0;S.s+=(c-S.s)*(1-Math.exp(-dt*14));if(Math.abs(c-S.s)<.002)S.s=c}else S.bumped=0;
  }
  // 긴 판자는 처음 한 번 살짝 올라왔다 내려가서 밀 수 있다는 걸 보여 줌
  const bk=(t-(S.bobAt||-1e9))/800,bob=max>0&&bk>0&&bk<1?.08*Math.sin(bk*Math.PI):0;
  const len=rbLen();P.plank.scale.y=len;P.pOut.scale.y=len+.03;
  P.plank.position.y=RB.L-len/2+S.s+off+bob;P.pOut.position.copy(P.plank.position);
  // 쪽 단추: 기둥 위아래에 고르게(판자가 많아도 누를 만하게), 설정 묶음과 규칙 묶음 사이는 조금 띄움
  const pg=S.mode==='game'?Math.min(RB_PG,rbPages()):0,nS=S.mode==='game'?rbNSet():0,show=pg>1;
  const top=RB.L+.06-.34,bot=.2,gapN=nS&&pg>nS?.5:0,step=pg>1?Math.min(.26,(top-bot)/(pg-1+gapN)):0;
  P.pgs.forEach((b,k)=>{const on=show&&k<pg;b.m.visible=b.o.visible=on;if(!on)return;
    const y=top-step*(k+(k>=nS?gapN:0)),lit=k===S.pg,sc=Math.min(1,step/.15);b.m.position.y=b.o.position.y=y;b.m.scale.set(sc,1,sc);b.o.scale.set(sc,1,sc);b.m.position.z=b.o.position.z=lit?.085:.1;
    const lab=rbPgLabel(k,nS);if(b.lab!==lab||b.lit!==lit){b.lab=lab;b.lit=lit;rbPgPaint(b,lab,lit)}});
  P.bk.visible=P.bkO.visible=S.mode==='game'&&!!S.fromList;
  if(S.on&&wait&&S.set&&V&&V.cfg&&S.gid!==(V.cfg.game||'gura')&&!S.chg){S.gid=V.cfg.game||'gura';rbSetPlanks.c=null;if(S.pg>=rbPages())S.pg=0;rbDraw(t)}   // 방장이 게임을 바꿈
  if(S.on&&S.mode==='game'&&S.pg<nS&&!S.chg){const key=JSON.stringify(V&&V.cfg)+mode+S.pg+(S.press?S.press.at:0)+(V&&V.ps?V.ps.length:0);if(key!==S.setKey||S.busy){S.setKey=key;S.busy=rbDraw(t)}}   // 설정이 바뀌면 다시 그림(숫자 넘김·손잡이·못 미끄러짐)
  if(S.on&&S.mode==='game'&&S.pg>=rbPages()&&!S.chg){S.pg=Math.max(0,rbPages()-1);rbDraw(t)}   // 판자 수가 줄면 마지막 판자로
  if(S.pick>=0&&t-S.pickAt>=420){S.pick=-1;if(S.mode==='list')rbDraw()}
  {const L=P.lever,d=t-L.at,k=d<0||d>520?0:d<160?d/160:1-smooth((d-160)/360);L.rod.rotation.x=-.5+(L.dir>0?.95:-.55)*k}
}
