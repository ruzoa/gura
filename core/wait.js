/* index.html 공통 코드 · 대기실 자리 이름표·첫 화면 시작. 파일 순서는 index.html의 <script src> 순서 */
/* ===== 대기실 자리 이름표 (대기실 창 대신) =====
   사람·봇 자리 = 이름표, 빈 자리 = 점선 '+' 이름표. 누르면 작은 메뉴:
   방장 → 봇 난이도·선·내보내기 / 빈 자리: 봇 앉히기·자리 치우기,  나 → 이모티콘·관전하기,  관전 중 빈 자리 → 앉기 */
function seatPopClose(){const p=$('#seatPop');if(p){p.hidden=true;p.innerHTML=''}FR.pop=null}
function seatPopOpen(key,anchor){
  if(!frWaitV())return;
  const isHost=mode==='host',me=myIdx(),max=+V.cfg.max,ps=V.ps||[],pop=$('#seatPop');
  const pickF=!!(G.firstPick&&+V.cfg.pickfirst);
  let h='';
  if(key[0]==='e'){   // 빈 자리
    if(me<0&&V.spec){sendAct({t:'join'});sfx('pick');return}   // 방장의 봇 앉히기·자리 치우기는 자판(봇 추가·의자 빼기)으로
    else{sfx('no');return}
  }else{
    const i=+key.slice(1),p=ps[i];if(!p)return;
    if(i===me){
      if(!(pickF&&isHost)&&(isHost||+(V.cfg.spec??4)<=0)){sfx('no');return}   // 내 이름표 메뉴: 선 플레이어(방장)·관전하기(참가자)
      if(pickF&&isHost)h+=`<button type="button" data-sp="first:${i}">선 플레이어</button>`;
      if(!isHost&&+(V.cfg.spec??4)>0)h+=`<button type="button" data-sp="tospec">관전하기</button>`;
    }else if(isHost){
      if(p.b&&!G.oneBotLv)h+=`<div class="sp-lv">${BOT_LV.map((t,k)=>`<button type="button" data-sp="lv:${i}:${k}"${(p.lv??1)===k?' class="on"':''}>${t}</button>`).join('')}</div>`;
      if(pickF)h+=`<button type="button" data-sp="first:${i}">선 플레이어</button>`;
      h+=`<button type="button" class="danger" data-sp="kick:${i}" data-name="${esc(p.n)}">내보내기</button>`;
    }else{sfx('no');return}
  }
  if(FR.pop===key){seatPopClose();return}   // 같은 이름표를 다시 누르면 닫힘
  FR.pop=key;pop.innerHTML=h;pop.hidden=false;sfx('tick');
  const st=$('#stage').getBoundingClientRect(),r=anchor.getBoundingClientRect(),pw=pop.offsetWidth,ph=pop.offsetHeight;
  let x=r.left-st.left+r.width/2-pw/2,y=r.top-st.top-ph-8;if(y<8)y=r.bottom-st.top+8;
  x=Math.max(8,Math.min(st.width-pw-8,x));pop.style.left=x+'px';pop.style.top=y+'px';
}
$('#seatPop').addEventListener('click',e=>{
  const b=e.target.closest('[data-sp]');if(!b)return;const a=b.dataset.sp;
  if(a==='emo'){openEmoPad(b);seatPopClose();return}
  if(a==='tospec'){sendAct({t:'spec'});seatPopClose();return}
  if(mode!=='host'||!H||H.phase!=='wait')return;
  if(a==='addbot'){hostAddBot();sfx('pick')}
  else if(a==='drop')setRoomCfg('max',(+H.cfg.max)-1);
  else if(a.startsWith('lv:')){const [,i,k]=a.split(':'),m=H.members[+i];if(m&&m.bot){m.lv=+k;sfx('tick');mark()}seatPopClose();return}
  else if(a.startsWith('first:')){const m=H.members[+a.slice(6)];if(m){H.firstName=m.name;sfx('tick');mark()}}
  else if(a.startsWith('kick:')){const i=+a.slice(5),m=H.members[i],nm=b.dataset.name||'';if(m&&!m.host&&m.name===nm&&(m.bot||confirm(`${nm}님을 탁자에서 내보낼까요?\n내보낸 사람은 이 탁자에 다시 앉을 수 없습니다.`)))hostKick(i)}
  seatPopClose();
});
document.addEventListener('pointerdown',e=>{if(FR.pop!=null&&!e.target.closest('#seatPop')&&!e.target.closest('.wseat'))seatPopClose()},true);
$('#labels').addEventListener('click',e=>{const em=e.target.closest('.wemo');if(em){seatPopClose();$('#emoPad').hidden?openEmoPad(em):closeEmoPad();return}const b=e.target.closest('.wseat button');if(!b)return;seatPopOpen(b.dataset.seat,b)});
$('#specBar').addEventListener('click',e=>{   // 대기실: 방장이 관전자 이름을 누르면 내보내기
  const b=e.target.closest('.sb-n[data-s]');if(!b||mode!=='host'||!H||H.phase!=='wait')return;
  const k=+b.dataset.s,sp=(H.specs||[])[k];if(sp&&confirm(`${sp.name}님을 탁자에서 내보낼까요?\n내보낸 사람은 이 탁자에 다시 앉을 수 없습니다.`))hostKickSpec(k);
});
const CHAIR_SVG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="2.6 2.4" aria-hidden="true"><rect x="7" y="3" width="10" height="7" rx="1.5"/><path d="M9 10v2.5M15 10v2.5M4.5 13h15M6 13.5 5 21M18 13.5 19 21"/></svg>';
function waitSeatsHTML(){
  const me=myIdx(),max=+V.cfg.max,ps=V.ps||[],isHost=mode==='host';
  const pickF=!!(G.firstPick&&+V.cfg.pickfirst);
  let fi=pickF?ps.findIndex(p=>p.n===V.fn):-1;if(pickF&&fi<0)fi=Math.max(0,ps.findIndex(p=>p.hs));
  let h='';
  for(let k=0;k<Math.max(max,ps.length);k++){
    const p=ps[k];
    if(p){const sub=p.hs?'방장':p.b?(G.oneBotLv?'봇':`봇 · ${BOT_LV[p.lv??1]}`):p.aw?'연결 끊김':'';
      h+=`<div class="seat wseat${k===me?' mine':''}${p.b?' bot lv'+(p.lv??1):''}" data-w="${k}"><button type="button" data-seat="s${k}" aria-label="${esc(p.n)}${k===me?' (나)':''}">${k===fi?'<i class="fsel">선</i>':''}<span class="nm">${G.nameTag?G.nameTag(p,k):''}${esc(p.n)}</span>${sub?`<small>${esc(sub)}</small>`:''}</button>${k===me?'<button type="button" class="wemo" aria-label="이모티콘" title="이모티콘">😊</button>':''}</div>`}
    else h+=`<div class="seat wseat empty${me<0&&V.spec?' sitok':''}" data-w="${k}"><button type="button" data-seat="e${k}" aria-label="빈 자리"${me<0&&V.spec?'':' tabindex="-1"'}>${CHAIR_SVG}</button></div>`;   // 빈 자리: 빈 의자 점선 그림 (관전자만 눌러서 앉음)
  }
  return h;
}
/* 3D가 준비되면 첫 화면으로 */
function frontStart(){
  if(!T.ok)return;
  FR.ok=true;frontNick();
  const v=mode==='lobby'?1:0,tw=x=>({v:x,to:x,from:x,t0:0,ms:0});
  FR.stand=v;FR.sa=tw(v);FR.open=0;FR.oa=tw(0);FR.ma=tw(0);FR.kmode='menu';FR.sit=false;FR.dva=tw(0);FR.hla=tw(0);FR.hba=tw(0);FR.hra=tw(0);FR.ka=tw(0);FR.pla=tw(0);FR.list=false;FR.rba=tw(0);FR.rb.on=false;FR.rb.chg=null;FR.la=tw(0);FR.sta=tw(0);FR.sha=tw(0);FR.arm=tw(0);FR.lean=0;
  if(mode==='lobby')showView(lobbyView,false);
  const n=$('#resumeNote');if(n.textContent)$('#frNote').textContent=n.textContent;
}
let lastFrame=clock();
function frame(){
  const t=clock(),dt=Math.min(.05,(t-lastFrame)/1000);lastFrame=t;
  if(T.ok){
    GFX_U.time.value=t/1000+FR.tw;   // 타임머신 중에는 구름·바람이 빨라짐
    frontUpdate(t,dt);rcptUpdate(t);
    if(T.bubbles.length)updBubbles(t);
    const k=1-Math.exp(-dt*7);
    dealUpdate(t);
    for(const c of [...T.cards]){
      const u=c.userData;if(u.man)continue;c.position.lerp(u.p,k);c.rotation.x+=(u.rx-c.rotation.x)*k;c.rotation.y+=(u.ry-c.rotation.y)*k;
      c.scale.setScalar(c.scale.x+(u.s-c.scale.x)*k);
      if(u.die&&c.position.distanceTo(u.p)<.1)killCard(c);
    }
    if(V&&V.ps&&V.st==='play'&&V.t!=null&&V.t!==myIdx()&&!T.deal&&!dealingV()){
      T.ring.visible=false;const sp=seatPos(V.t,3.85);
      const grace=t<V.graceAt,frac=grace?1:Math.max(0,Math.min(1,(V.deadAt-t)/(V.cfg.turn*1000)));
      const q=Math.round(frac*200)/200;
      if(q!==T.timerFrac){T.timerFrac=q;T.timerArc.geometry.dispose();T.timerArc.geometry=new THREE.RingGeometry(.66,.78,64,1,Math.PI/2,Math.max(.001,q*Math.PI*2))}
      T.timerArc.material.color.set(grace?0xcdb391:0xcc3a2e);
      // 카드 더미가 쌓인 각도에 맞춰 시작점이 그 사람 쪽(바깥)을 향하게
      T.timerArc.rotation.z=seatAngle(V.t);
      for(const m of [T.timerBg,T.timerArc]){m.visible=true;m.position.set(sp.x,.035,sp.z)}
    }else{T.ring.visible=false;T.timerBg.visible=false;T.timerArc.visible=false}
    if(G.render3D)G.render3D(t,dt);   // 자기 카메라로 그리는 게임 (야추다이스의 주사위 트레이)
    else if(!G.no3D)T.r.render(T.scene,T.cam);   // 3D 테이블을 쓰지 않는 게임(쿼리도)은 그리기를 쉼
  }
  if(!T.ok&&T.deal)dealUpdate(t);   // 3D가 없어도 손패 펼치기는 같은 때에
  placeLabels();
  liveUI(t);
  requestAnimationFrame(frame);
}
function placeLabels(){
  if(!V||!V.ps)return;
  const st=$('#stage'),W=st.clientWidth,Hh=st.clientHeight;
  {const np=$('#numpick');
  if(!np.hidden){
    const me=$('#me'),plateTop=me.hidden?Hh:me.offsetTop,nh=np.offsetHeight;
    np.style.transform='none';np.style.top=Math.max(8,Math.min((Hh-nh)/2,plateTop-nh-8))+'px';
  }}
  const avoid=stageRects();
  const wN=Math.max(+(V.cfg&&V.cfg.max)||0,V.ps.length),wMe=myIdx(),wB=wMe>=0?wMe:0;
  document.querySelectorAll('#labels .seat').forEach(el=>{
    const i=+el.dataset.i;let x,y;
    if(el.dataset.w!=null&&T.ok){   // 대기실 자리: 최대 인원만큼 둥글게. 내 이름표는 디스플레이 왼쪽 앞에
      const k=+el.dataset.w,a=((k-wB+wN)%wN+(wMe<0?.5:0))*Math.PI*2/wN;
      const p=k===wMe?new THREE.Vector3(-2.55,0,3.55):new THREE.Vector3(Math.sin(a)*3.9,0,Math.cos(a)*3.9);p.project(T.cam);x=(p.x+1)/2*W;y=(1-p.y)/2*Hh}
    else if(T.ok){const p=seatPos(i,3.85);p.y=0;p.project(T.cam);x=(p.x+1)/2*W;y=(1-p.y)/2*Hh+16+el.offsetHeight/2}
    else{const a=seatAngle(i);x=W/2+Math.sin(a)*W*.38;y=Hh/2+Math.cos(a)*Hh*.36}
    const hw=el.offsetWidth/2,hh=el.offsetHeight/2;
    x=Math.max(hw+6,Math.min(W-hw-6,x));y=Math.max(hh+6,Math.min(Hh-hh-6,y));
    // 위쪽 HUD·오른쪽 위 버튼과 겹치면 그 아래로, 오른쪽 아래 행동 버튼과 겹치면 위로
    // 겹치는 상자의 가운데보다 위면 위로, 아래면 아래로 비켜 감 (두 번 확인)
    for(let pass=0;pass<2;pass++)for(const r of avoid){
      if(x+hw>r.l&&x-hw<r.r&&y+hh>r.t&&y-hh<r.b){
        y=y<(r.t+r.b)/2?r.t-hh-6:r.b+hh+6;
        if(y-hh<4)y=r.b+hh+6;
      }
    }
    y=Math.max(hh+6,Math.min(Hh-hh-6,y));
    el.style.left=x+'px';el.style.top=y+'px';
  });
  // 필드 가운데 위치 (장수 배지와 이펙트 기준)
  let ax=W/2,ay=Hh/2;
  if(T.ok){const p=new THREE.Vector3(0,.05,0);p.project(T.cam);ax=(p.x+1)/2*W;ay=(1-p.y)/2*Hh}
  T.anchor={x:ax,y:ay};
  {const d=$('#dim');d.style.setProperty('--cx',ax+'px');d.style.setProperty('--cy',(ay-10)+'px');d.style.setProperty('--rx',Math.min(W*.34,260)+'px');d.style.setProperty('--ry',Math.min(Hh*.26,170)+'px')}
  let by=ay+70;if(T.ok){const q=new THREE.Vector3(0,0,1.3);q.project(T.cam);by=(1-q.y)/2*Hh+14}
  T.anchorBelow=by;
  const pc=$('#pileCount');if(!pc.hidden){pc.style.left=ax+'px';pc.style.top=Math.min(Hh-20,by)+'px'}
  const pn=$('#pileNum');if(!pn.hidden){pn.style.left=ax+'px';pn.style.top=Math.max(84,ay-62)+'px'}
  const vd=$('#verdict');
  if(!vd.hidden){
    if(T.ok){
      const top=new THREE.Vector3(0,2.3+.62,1.2-.45).project(T.cam),bot=new THREE.Vector3(0,2.3-.62,1.2+.45).project(T.cam);
      const yt=(1-top.y)/2*Hh,yb=(1-bot.y)/2*Hh,vh=vd.offsetHeight;
      if(yt-vh-10>8){vd.style.top=(yt-vh-10)+'px'}else{vd.style.top=Math.min(Hh-vh-8,yb+10)+'px'}
    }else vd.style.top='8px';
  }
}
function stageRects(){
  const st=$('#stage').getBoundingClientRect(),out=[];
  for(const id of ['btnLog','btnFs','btnMenu','actions','numpick','me','ruleBadges','holoTag']){
    const el=document.getElementById(id);if(!el||el.hidden||!el.offsetWidth)continue;
    const r=el.getBoundingClientRect();out.push({l:r.left-st.left-4,r:r.right-st.left+4,t:r.top-st.top-4,b:r.bottom-st.top+4});
  }
  return out;
}

