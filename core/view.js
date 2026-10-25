/* index.html 공통 코드 · 화면 상태·소리(Web Audio)·말풍선·소리 설정. 파일 순서는 index.html의 <script src> 순서 */
/* ================= 화면 상태 ================= */
function applyView(s){
  PV=V;const t=clock();
  V={...s,graceAt:t+(+s.gr||0),deadAt:t+(+s.dl||0),dealAt:s.dk?t+(+s.dk):0};
  useGame(s.cfg&&s.cfg.game);
  dealCheck(V);
  const mine=myHand();const hs=new Set(mine);for(const id of [...sel])if(!hs.has(id))sel.delete(id);
  G.preView();
  render();sync3D(V,PV);cues(V,PV);showNewEmotes(V,PV);
  G.postView();
}
/* 화면에 보일 게임 바꾸기 (방에 들어가거나 방장이 게임을 바꿨을 때) */
function useGame(id){
  const g=gameOf(id);if(g===G)return;
  G.leave();G=g;G.enter();
  sel.clear();pickNum=null;newCards=new Set();
  $('#hand').innerHTML='';$('#hand').dataset.key='';
  if(T.ok&&T.back){T.back.map=backTex();T.back.needsUpdate=true}
  renderKeys();
}
let newCards=new Set();
let emoSeen=-1,emoMuted=new Set(),emoOff=store('gura-emo-off')==='1';
function emoteHTML(em){return em.q?'<span class="bt">구라<span class="qm">?</span></span>':em.e?`<span class="be">${em.e}</span>`:`<span class="bt${em.t.length>2?' sm':''}">${esc(em.t)}</span>`}
function showNewEmotes(v,pv){
  const list=Array.isArray(v.em)?v.em:[];
  const top=list.length?+list[list.length-1][0]:0;
  if(top<emoSeen)emoSeen=-1;   // 방장이 바뀌어 번호가 처음부터 다시 시작된 경우
  if(emoSeen<0||!pv||(pv.st==='wait')!==(v.st==='wait')){emoSeen=Math.max(emoSeen,top);return}
  for(const [sq,p,k,nm] of list){
    if(+sq<=emoSeen)continue;
    const em=EMOTES.find(x=>x.k===k);if(!em)continue;
    if(+p<0)continue;
    if(!v.ps||!v.ps[p])continue;
    if(emoOff||(emoMuted.has(v.ps[p].n)&&p!==myIdx()))continue;
    showBubble(+p,emoteHTML(em),1600,em.q?'q':'soft');
    sfx('emo_'+em.k);
  }
  emoSeen=Math.max(emoSeen,top);
}
let emoCoolUntil=0;
function sendEmote(k){
  if(!V||myIdx()<0||G.noEmotes.includes(k)||!(V.st==='wait'||V.st==='play'||V.st==='reveal'||V.st==='over'))return;
  const now=Date.now();if(now<emoCoolUntil)return;
  emoCoolUntil=now+1600;const b=$('#btnEmo');b.classList.add('cool');setTimeout(()=>b.classList.remove('cool'),1600);
  sendAct({t:'emo',k});closeEmoPad();
}
function renderEmoPad(){
  $('#emoPad').innerHTML=EMOTES.filter(em=>!G.noEmotes.includes(em.k)).map(em=>`<button type="button" role="menuitem" data-emo="${em.k}" class="${em.q?'q':em.t?'tx'+(em.t.length>2?' wide':''):''}" aria-label="${em.n}" title="${em.n}">${em.q?'구라?':em.e||esc(em.t)}<small>${esc(keyLabel(KEYS['emo_'+em.k]||''))}</small></button>`).join('')
;
}
function openEmoPad(anchor){
  renderEmoPad();const pad=$('#emoPad'),st=$('#stage').getBoundingClientRect(),pr=(anchor||$('#me')).getBoundingClientRect();
  pad.hidden=false;
  // 버튼 위에 띄우되 화면(테이블) 밖으로 나가지 않게: 오른쪽 끝 버튼이면 왼쪽으로 당기고, 위에 자리가 없으면 아래로
  const W=st.width,Hh=st.height,pw=pad.offsetWidth,ph=pad.offsetHeight;
  const want=pr.width>120?pr.left-st.left:pr.left-st.left+pr.width/2-pw/2;   // 넓은 내 정보 칸은 왼쪽 맞춤, 작은 버튼은 가운데 맞춤
  const x=Math.min(W-pw-8,want);
  let y=pr.top-st.top-ph-8;if(y<8)y=Math.min(Hh-ph-8,pr.bottom-st.top+8);
  pad.style.left=Math.max(8,x)+'px';pad.style.top=Math.max(8,y)+'px';
  $('#btnEmo').setAttribute('aria-expanded','true');
}
function closeEmoPad(){$('#emoPad').hidden=true;$('#btnEmo').setAttribute('aria-expanded','false')}
$('#btnEmo').addEventListener('click',e=>{e.stopPropagation();$('#emoPad').hidden?openEmoPad():closeEmoPad()});
$('#emoPad').addEventListener('click',e=>{
  e.stopPropagation();
  const b=e.target.closest('[data-emo]');if(b)sendEmote(b.dataset.emo);
});
document.addEventListener('click',e=>{if(!$('#emoPad').hidden&&!e.target.closest('#emoPad')&&!e.target.closest('#btnEmo')&&!e.target.closest('.emo-open')&&!e.target.closest('.wemo'))closeEmoPad()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#emoPad').hidden)closeEmoPad()});
/* 이름표 옆 스피커: 그 사람 이모티콘 보기/끄기 */
const SPK_ON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
const SPK_OFF='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"/><line x1="16" y1="9" x2="22" y2="15"/><line x1="22" y1="9" x2="16" y2="15"/></svg>';
$('#labels').addEventListener('click',e=>{
  const b=e.target.closest('.spk');if(!b||!V||!V.ps)return;const i=+b.dataset.spk,p=V.ps[i];if(!p)return;
  const mu=!emoMuted.has(p.n);mu?emoMuted.add(p.n):emoMuted.delete(p.n);
  const s=b.closest('.seat');s.classList.toggle('muted',mu);b.innerHTML=mu?SPK_OFF:SPK_ON;b.setAttribute('aria-pressed',mu);
  const t=`이모티콘 ${mu?'켜기':'끄기'}`;b.title=t;b.setAttribute('aria-label',`${p.n} ${t}`);
  if(mu){$('#bubbles').querySelectorAll(`.bubble.soft[data-i="${i}"],.bubble.q[data-i="${i}"]`).forEach(x=>x.remove());if(T&&T.bubbles)T.bubbles.filter(x=>x.i===i&&x.kind==='q').forEach(killBubble)}
  sfx('tick');
});
function showTaken(ids){newCards=new Set(ids);markNewCards();sfx('sweep')}
function seeNewCard(el){if(!el||!el.classList.contains('newcard'))return;newCards.delete(+el.dataset.id);el.classList.remove('newcard')}
function markNewCards(){document.querySelectorAll('#hand .card').forEach(c=>c.classList.toggle('newcard',newCards.has(+c.dataset.id)))}

/* ================= 소리 (Web Audio로 직접 합성, 파일 없음) ================= */
const volOf=(k,d)=>{const v=+store(k);return store(k)!=null&&v>=0&&v<=100?v:d};
const SND={ctx:null,master:null,fx:null,bgm:null,noise:null,on:store('gura-sound')!=='off',vol:volOf('gura-vol',70),bgmVol:volOf('gura-bgm-vol',50)};
function audioOn(){
  if(!SND.ctx){
    const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;
    try{SND.ctx=new AC()}catch(e){return null}
    SND.master=SND.ctx.createGain();SND.master.gain.value=.55;SND.master.connect(SND.ctx.destination);
    SND.fx=SND.ctx.createGain();SND.fx.gain.value=SND.vol/100;SND.fx.connect(SND.master);
    SND.bgm=SND.ctx.createGain();SND.bgm.gain.value=SND.bgmVol/100;SND.bgm.connect(SND.master);
    const len=SND.ctx.sampleRate*.6,buf=SND.ctx.createBuffer(1,len,SND.ctx.sampleRate),d=buf.getChannelData(0);
    for(let i=0;i<len;i++)d[i]=Math.random()*2-1;SND.noise=buf;
  }
  if(SND.ctx.state==='suspended'&&!document.hidden)SND.ctx.resume().catch(()=>{});   // 다른 앱으로 가 있을 때는 다시 켜지 않음
  return SND.ctx;
}
/* 다른 앱으로 가거나 화면이 꺼지면 배경음악·효과음을 멈추고, 돌아오면 다시 켬 */
function audioBg(){
  const c=SND.ctx;if(!c)return;
  if(document.hidden){if(c.state==='running')c.suspend().catch(()=>{})}
  else if(c.state==='suspended')c.resume().catch(()=>{});
}
document.addEventListener('visibilitychange',audioBg);
window.addEventListener('pagehide',()=>{const c=SND.ctx;if(c&&c.state==='running')c.suspend().catch(()=>{})});
window.addEventListener('pageshow',audioBg);
['pointerdown','keydown'].forEach(ev=>document.addEventListener(ev,audioOn,{passive:true}));
function tone(f,dur,o={}){
  const c=SND.ctx;if(!c||!SND.on||c.state!=='running')return;
  const t=c.currentTime+(o.at||0),os=c.createOscillator(),g=c.createGain();
  os.type=o.type||'sine';os.frequency.setValueAtTime(f,t);if(o.slide)os.frequency.exponentialRampToValueAtTime(o.slide,t+dur);
  if(o.path)o.path.forEach(([dt,fq])=>os.frequency.exponentialRampToValueAtTime(fq,t+dt));   // 음 높이를 여러 번 꺾기: [[시간, Hz], ...]
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(o.vol||.2,t+(o.attack||.006));
  if(o.sus)g.gain.setValueAtTime(o.vol||.2,t+dur*o.sus);   // sus: 소리를 그 비율만큼 유지한 뒤 줄임 (길게 끄는 소리)
  g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  os.connect(g);g.connect(o.bus==='bgm'?SND.bgm:SND.fx);os.start(t);os.stop(t+dur+.03);
}
function hiss(dur,o={}){
  const c=SND.ctx;if(!c||!SND.on||c.state!=='running'||!SND.noise)return;
  const t=c.currentTime+(o.at||0),s=c.createBufferSource(),fl=c.createBiquadFilter(),g=c.createGain();
  s.buffer=SND.noise;fl.type=o.ftype||'bandpass';fl.Q.value=o.q||1;fl.frequency.setValueAtTime(o.freq||1800,t);
  if(o.sweep)fl.frequency.exponentialRampToValueAtTime(o.sweep,t+dur);
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(o.vol||.25,t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  s.connect(fl);fl.connect(g);g.connect(o.bus==='bgm'?SND.bgm:SND.fx);s.start(t);s.stop(t+dur+.03);
}
/* 차오르는 소리(우우우웅): ms 동안 음이 올라가며 커지고 떨림이 빨라짐. 돌려준 함수를 부르면 바로 꺼짐 (상치우기 꾹 누르기) */
function hum(ms){
  const c=SND.ctx;if(!c||!SND.on||c.state!=='running')return ()=>{};
  const t=c.currentTime,d=ms/1000,o1=c.createOscillator(),o2=c.createOscillator(),lp=c.createBiquadFilter(),g=c.createGain(),trem=c.createGain(),lfo=c.createOscillator(),lg=c.createGain();
  o1.type='sawtooth';o2.type='sine';o1.frequency.setValueAtTime(70,t);o1.frequency.exponentialRampToValueAtTime(230,t+d);o2.frequency.setValueAtTime(140,t);o2.frequency.exponentialRampToValueAtTime(460,t+d);
  lp.type='lowpass';lp.Q.value=6;lp.frequency.setValueAtTime(260,t);lp.frequency.exponentialRampToValueAtTime(1900,t+d);
  lfo.frequency.setValueAtTime(5,t);lfo.frequency.linearRampToValueAtTime(15,t+d);lg.gain.value=.45;lfo.connect(lg);lg.connect(trem.gain);trem.gain.value=.55;   // 우-우-우-웅: 떨림이 점점 빨라짐
  g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(.05,t+.03);g.gain.linearRampToValueAtTime(.12,t+d);   // 누르자마자 들리고 점점 커짐
  o1.connect(lp);o2.connect(lp);lp.connect(trem);trem.connect(g);g.connect(SND.fx);[o1,o2,lfo].forEach(o=>o.start(t));
  let done=false;return ()=>{if(done)return;done=true;const n=c.currentTime;g.gain.cancelScheduledValues(n);g.gain.setValueAtTime(Math.max(.0001,g.gain.value),n);g.gain.exponentialRampToValueAtTime(.0001,n+.12);[o1,o2,lfo].forEach(o=>o.stop(n+.15))};
}
const SFX={
  special(){tone(392,.1,{type:'square',vol:.08});tone(523,.1,{type:'square',vol:.08,at:.09});tone(784,.3,{type:'square',vol:.1,at:.18})},   // 대부호 혁명·8 끊기 등
  tick(){tone(1250,.03,{type:'square',vol:.035})},
  pick(){tone(880,.05,{type:'triangle',vol:.09});tone(1320,.04,{type:'triangle',vol:.05,at:.03})},
  play(n=1){for(let k=0;k<Math.min(n,4);k++){hiss(.08,{freq:2200,q:.9,vol:.3,at:k*.055});tone(140,.07,{type:'triangle',vol:.18,at:k*.055})}},
  pass(){tone(330,.09,{vol:.13});tone(247,.13,{vol:.11,at:.08})},
  // 이모티콘 소리: 이름 = 'emo_' + 이모티콘 키
  emo_gq(){tone(300,.22,{type:'triangle',vol:.12,slide:620});tone(620,.12,{type:'triangle',vol:.06,at:.2,slide:560})},             // 띠용?
  emo_shh(){hiss(.55,{freq:3800,q:1.4,vol:.07,sweep:3000})},                                                                        // 쉬―
  emo_plz(){tone(587,.22,{vol:.07,attack:.03});tone(784,.34,{vol:.07,attack:.04,at:.16})},                                           // 제발~ (부드러운 두 음)
  emo_omg(){tone(420,.32,{type:'sawtooth',vol:.045,slide:1250});tone(1250,.16,{type:'sawtooth',vol:.03,at:.3,slide:1150})},          // 끄아악 (치솟음)
  emo_lol(){[880,784,880,784,698].forEach((f,k)=>tone(f,.07,{type:'triangle',vol:.075,at:k*.075}))},                                  // 하하하하
  emo_dizzy(){[620,520,560,440,480,330].forEach((f,k)=>tone(f,.12,{type:'sine',vol:.07,at:k*.09,slide:f*.86}))},                    // 빙글빙글 내려감
  emo_cry(){tone(520,.36,{vol:.07,slide:380});tone(470,.46,{vol:.07,at:.34,slide:320})},                                             // 엉엉
  emo_mad(){tone(110,.16,{type:'square',vol:.05});tone(98,.22,{type:'square',vol:.05,at:.14});hiss(.2,{freq:600,q:.8,vol:.05,at:.02})}, // 부글부글
  emo_hurry(){for(let k=0;k<6;k++)tone(k%2?880:1175,.06,{type:'square',vol:.035,at:k*.07})},                                          // 따르릉
  emo_smile(){[523,659,784].forEach((f,k)=>tone(f,.14,{type:'triangle',vol:.075,at:k*.07}))},                                         // 밝은 화음
  // 줴~ 줴~~ 야~ : 예시 소리의 억양(음 높이·박자·끌기)을 분석해서 맞춤, 소리는 실로폰처럼
  //  (사인파만: 맑은 몸통 + 채로 때리는 순간의 높은 '딩' 소리를 음마다 짧게 겹침)
  emo_gg(){
    const v={type:'sine',vol:.15,attack:.004,sus:.7};   // 사인파만 사용
    const note=(at,d,f,o)=>{tone(f,d,{...v,at,...o});
      tone(f*4,.05,{type:'sine',vol:.045,at,attack:.002});tone(f*2.76,.09,{type:'sine',vol:.03,at,attack:.002})};
    const k=1/1.44;   // 빠르기 (처음보다 1.44배 = 1.2배 × 1.2배)
    note(0,.3*k,290,{slide:262});
    note(.34*k,.44*k,435,{path:[[.15*k,525],[.44*k,370]]});
    note(.82*k,.3*k,333,{slide:262});
  },
  turn(){tone(660,.12,{type:'triangle',vol:.17});tone(990,.22,{type:'triangle',vol:.17,at:.1})},
  gura(){tone(240,.38,{type:'sawtooth',vol:.15,slide:150});tone(360,.38,{type:'square',vol:.06,slide:225});hiss(.18,{freq:900,vol:.18})},
  lie(){tone(392,.16,{type:'square',vol:.09});tone(330,.16,{type:'square',vol:.09,at:.17});tone(262,.45,{type:'square',vol:.09,at:.34,slide:190})},
  truth(){tone(523,.12,{type:'triangle',vol:.16});tone(659,.12,{type:'triangle',vol:.16,at:.1});tone(784,.3,{type:'triangle',vol:.16,at:.2})},
  sweep(){hiss(.4,{freq:500,sweep:3200,q:.7,vol:.22})},
  // 카드 섞고 나누기: 리플(촤라락), 탁 정리, 커트, 한 장씩 착
  riffle(){for(let k=0;k<26;k++)hiss(.03,{freq:2600+((k*997)%9)*160,q:1.6,vol:.07+.05*Math.sin(k/26*Math.PI),at:k*.017})},
  square(){hiss(.05,{freq:1500,q:.8,vol:.16});tone(170,.05,{type:'triangle',vol:.1});hiss(.04,{freq:1700,q:.8,vol:.12,at:.07})},
  cut(){hiss(.07,{freq:1100,q:.7,vol:.14,sweep:1900})},
  flick(){hiss(.035,{freq:2900,q:1.3,vol:.09})},
  lift(){hiss(.32,{freq:700,sweep:2600,q:.6,vol:.1})},
  finish(){[523,659,784,1047].forEach((f,k)=>tone(f,.22,{type:'triangle',vol:.15,at:k*.09}))},
  warn(last){tone(last?1400:1000,.06,{type:'square',vol:.06})},
  // 금지: 안 되는 곳을 눌렀을 때 글 대신 짧고 둔탁하게 (모든 게임 공통)
  no(){tone(150,.08,{type:'triangle',vol:.16});hiss(.05,{freq:420,vol:.06})},
  // 탈주: 누가 자리를 떴을 때 (문이 닫히듯 낮게 쓸리고 툭)
  desert(){hiss(.16,{freq:900,sweep:300,q:.7,vol:.1});tone(196,.1,{type:'triangle',vol:.13,at:.12});tone(147,.18,{type:'triangle',vol:.11,at:.2})},
  // 첫 화면: 천 펼치기(펄럭 → 툭), 천 걷기, 숫자판 넘김, 타임머신 출발·도착·고장
  cloth(){hiss(.42,{freq:1600,sweep:420,q:.55,vol:.15});tone(118,.14,{type:'triangle',vol:.12,at:.44})},
  clothUp(){hiss(.34,{freq:450,sweep:1700,q:.55,vol:.11})},
  flap(){hiss(.025,{freq:3400,q:2,vol:.05});tone(1900,.012,{type:'square',vol:.012})},
  warpGo(){for(let k=0;k<14;k++)tone(48+k*3,.14,{type:'sawtooth',vol:.03+k*.003,at:.5+k*.11});hiss(1.9,{freq:180,sweep:900,q:.7,vol:.09,at:.5})},   // 덜덜덜 점점 세게
  lid(){tone(260,.05,{type:'triangle',vol:.12});hiss(.04,{freq:1200,q:1,vol:.08,at:.01})},   // 디스플레이 덮개 딸깍
  lock(){tone(1500,.03,{type:'square',vol:.05});tone(700,.06,{type:'triangle',vol:.1,at:.04})},   // 철컥
  paper(){hiss(.18,{freq:3000,sweep:1600,q:.9,vol:.08})},
  key(){tone(1700,.02,{type:'square',vol:.03});hiss(.025,{freq:2600,q:1.5,vol:.06})},   // 키 딸깍
  dice(){for(let k=0;k<5;k++){tone(900+k*120,.03,{type:'triangle',vol:.06,at:k*.06});hiss(.03,{freq:2400,q:1.2,vol:.05,at:k*.06})}},   // 주사위 달그락
  iris(){hiss(.28,{freq:900,sweep:2400,q:1.2,vol:.06});tone(240,.2,{type:'triangle',vol:.06,slide:360})},   // 구멍 열림
  btnUp(){tone(180,.18,{type:'triangle',vol:.1,slide:320});hiss(.12,{freq:600,q:.8,vol:.05})},
  btnGo(){tone(110,.08,{type:'square',vol:.1});[523,784].forEach((f,k)=>tone(f,.16,{type:'triangle',vol:.12,at:.06+k*.08}))},
  rcPrint(n=1){for(let k=0;k<Math.min(n,3);k++){hiss(.2,{freq:3600,q:4,vol:.045,at:k*.22});for(let i=0;i<5;i++)tone(2600+((i*37)%5)*120,.012,{type:'square',vol:.018,at:k*.22+i*.035})}},   // 영수증 '지직'
  tableClear(){hiss(.5,{freq:3000,sweep:260,q:.7,vol:.16});tone(80,.3,{type:'triangle',vol:.22,slide:50,at:.05});[2093,2637,1760,2349,1976].forEach((f,k)=>tone(f,.07,{type:'triangle',vol:.05,at:.12+k*.045}));hiss(.12,{freq:4200,q:2,vol:.06,at:.14})},   // 상치우기: 휙 쓸어내림 + 쿵 + 그릇 달그락
  stamp(){tone(90,.12,{type:'triangle',vol:.2});hiss(.08,{freq:700,q:.8,vol:.14})},   // 도장 쿵
  holoOn(){tone(330,.5,{vol:.07,slide:990,attack:.05});tone(1320,.4,{vol:.03,at:.25,attack:.1})},
  holoOff(){tone(880,.35,{vol:.05,slide:220})},
  holoTick(){tone(1560,.05,{vol:.05});tone(2340,.04,{vol:.025,at:.02})},
  holoPick(){[784,1047,1568].forEach((f,k)=>tone(f,.18,{vol:.06,at:k*.06}))},
  warpArrive(){tone(420,.7,{type:'sawtooth',vol:.04,slide:110,sus:.2});[784,988,1175].forEach((f,k)=>tone(f,.25,{type:'triangle',vol:.07,at:.55+k*.08}))},
  warpFail(){tone(95,.16,{type:'square',vol:.12});tone(70,.22,{type:'square',vol:.1,at:.14});hiss(.18,{freq:500,q:.7,vol:.14});hiss(.7,{freq:2400,sweep:300,q:.8,vol:.06,at:.35})},
};
function sfx(name,...a){try{if(SFX[name])SFX[name](...a)}catch(e){}}
let lastLogId=0,lastWarnSec=-1;
function cues(v,pv){
  if(!v||!v.ps)return;
  const ids=(Array.isArray(v.lg)?v.lg:[]).map(l=>+l[2]||0);
  const top=ids.length?Math.max(...ids):0;
  if(!pv||!pv.ps||top<lastLogId-50){lastLogId=top;return}  // 첫 화면이나 새 게임은 소리 없이 기준만 잡음
  const fresh=v.lg.filter(l=>(+l[2]||0)>lastLogId).reverse();
  lastLogId=Math.max(lastLogId,top);
  for(const l of fresh){
    const txt=String(l[0]),cls=l[1];
    if(G.logCue(txt,cls))continue;   // 게임마다 다른 소리 (구라!, 혁명 등)
    if(cls==='fin')sfx('finish');
    else if(txt.includes('패스'))sfx('pass');
  }
  if(v.st!=='wait'&&v.st!=='over'&&pv.ps&&v.ps.some((p,i)=>p.dz&&pv.ps[i]&&!pv.ps[i].dz))sfx('desert');   // 누가 탈주하면 글 대신 짧은 소리
  if(v.st!=='wait'&&pv.st!=='wait')G.cues(v,pv);
  const me=myIdx();
  if(v.st==='play'&&me>=0&&v.t===me&&!(pv.st==='play'&&pv.t===me))setTimeout(()=>sfx('turn'),Math.max(v.gr>0?Math.min(v.gr,1500):0,v.dk?+v.dk:0));   // 카드를 나누는 중이면 다 나눈 뒤
}
/* 말풍선: 외친 사람(내 자리면 내 정보 칸) 옆, 테이블 가운데 쪽에 뾰족한 풍선. 꼬리가 그 사람을 가리킴. html에 이모티콘을 넣어도 됨 */
const BUB={w:220,h:180,cx:110,cy:90,rx:62,ry:40,tail:70};
function softPath(ang,tail){
  // 둥근 말풍선 + 이름표 쪽으로 짧은 꼬리
  const {cx,cy}=BUB,rx=52,ry=36,N=44,pts=[];
  let best=0,bd=9;
  for(let k=0;k<N;k++){const a=k/N*Math.PI*2,pa=Math.atan2(Math.sin(a)*ry,Math.cos(a)*rx);let dd=Math.abs(((pa-ang)%(2*Math.PI)+3*Math.PI)%(2*Math.PI)-Math.PI);if(dd<bd){bd=dd;best=k}}
  for(let k=0;k<N;k++){
    const a=k/N*Math.PI*2;let x=cx+Math.cos(a)*rx,y=cy+Math.sin(a)*ry;
    if(k===best){x=cx+Math.cos(ang)*tail;y=cy+Math.sin(ang)*tail}
    pts.push(x.toFixed(1)+','+y.toFixed(1));
  }
  return 'M'+pts.join('L')+'Z';
}
function burstPath(ang,tailLen){
  const {cx,cy,rx,ry}=BUB,N=20,pts=[];
  // 꼬리 방향과 가장 가까운 바깥 꼭지를 길게 뺌
  let best=0,bd=9;
  for(let k=0;k<N;k+=2){const a=-Math.PI/2+k/N*Math.PI*2,pa=Math.atan2(Math.sin(a)*ry,Math.cos(a)*rx);let dd=Math.abs(((pa-ang)%(2*Math.PI)+3*Math.PI)%(2*Math.PI)-Math.PI);if(dd<bd){bd=dd;best=k}}
  for(let k=0;k<N;k++){
    const a=-Math.PI/2+k/N*Math.PI*2,out=k%2===0;
    let x=cx+Math.cos(a)*(out?rx:rx-10),y=cy+Math.sin(a)*(out?ry:ry-9);
    if(k===best){const L=tailLen||BUB.tail;x=cx+Math.cos(ang)*L;y=cy+Math.sin(ang)*L}
    pts.push(x.toFixed(1)+','+y.toFixed(1));
  }
  return 'M'+pts.join('L')+'Z';
}
function showBubble(i,html,life,kind){
  kind=kind||'real';
  const spc=typeof i==='string';   // 's0', 's1'… = 관전자
  if(!spc&&(kind==='real'||kind==='q')&&T&&T.ok&&V&&V.st!=='wait'&&i!==myIdx()&&show3DBubble(i,kind,life))return;   // 내 말풍선은 내 정보 칸 위(화면 위층)
  const st=$('#stage'),sr=st.getBoundingClientRect(),W=sr.width,Hh=sr.height;
  // 대기실 명단, 결과 화면 순위표가 떠 있으면 그 사람 줄에 붙임 (결과 화면에서는 내 정보 칸·자리 이름표가 가려지거나 숨어 있음)
  const overRow=!spc&&V&&V.st==='over'&&!$('#panel').hidden?document.querySelector(`#panel .ranks li[data-i="${i}"]`):null;
  const tw=!overRow&&V&&V.st==='wait'&&frTableUI();   // 3D 대기실: 탁자 위 2D 이름표에 붙임
  const inWait=!tw&&(V&&V.st==='wait'||!!overRow);
  const el=tw?(spc?document.querySelector(`#specBar [data-s="${i.slice(1)}"]`):document.querySelector(`#labels .wseat[data-w="${i}"]`)):overRow||(spc?document.querySelector(V&&V.st==='wait'?`#panel .specs [data-s="${i.slice(1)}"]`:`#specBar [data-s="${i.slice(1)}"]`):inWait?document.querySelector(`#panel .slots li[data-i="${i}"]`):i===myIdx()?$('#me'):document.querySelector(`#labels .seat[data-i="${i}"]`));
  if(!el)return;
  const r0=el.getBoundingClientRect(),r=inWait&&!spc?{left:r0.right-70,top:r0.top,width:60,height:r0.height,right:r0.right,bottom:r0.bottom}:r0,lx=r.left-sr.left+r.width/2,ly=r.top-sr.top+r.height/2;
  // 이름표에서 테이블 가운데 쪽으로 풍선을 띄움
  const A=(typeof T!=='undefined'&&T&&T.anchor)||{x:W/2,y:Hh*.45};
  let dx=A.x-lx,dy=A.y-ly,len=Math.hypot(dx,dy)||1;dx/=len;dy/=len;
  if(inWait){dx=.7;dy=-.7}           // 대기실: 명단 줄의 오른쪽 위로
  else if(i===myIdx()){dx=.55;dy=-.83}   // 내 정보 칸은 왼쪽 아래 → 오른쪽 위로
  const ext=Math.abs(dx)*r.width/2+Math.abs(dy)*r.height/2;
  const k=Math.max(1,Math.min(2.2,W/900,Hh/620));   // 큰 화면(QHD 전체화면 등)에서는 비율대로 크게
  const TL=kind==='soft'?60:BUB.tail;
  const dist=TL*k+ext+2;
  let bx=lx+dx*dist,by=ly+dy*dist;
  bx=Math.max(BUB.rx*k+6,Math.min(W-BUB.rx*k-6,bx));by=Math.max(BUB.ry*k+6,Math.min(Hh-BUB.ry*k-6,by));
  const ang=Math.atan2(ly-by,lx-bx);
  const box=$('#bubbles');
  // 진짜 구라! 풍선이 떠 있는 동안에는 그 사람 이모티콘이 덮지 않음
  if(kind!=='real'&&box.querySelector(`.bubble.real[data-i="${i}"]`))return;
  box.querySelectorAll(`[data-i="${i}"]`).forEach(b=>b.remove());
  const b=document.createElement('div');b.className='bubble '+kind;b.dataset.i=i;
  b.style.left=bx+'px';b.style.top=by+'px';b.style.setProperty('--life',(life||2200)+'ms');b.style.setProperty('--bk',k);
  b.innerHTML=`<svg viewBox="0 0 ${BUB.w} ${BUB.h}" aria-hidden="true"><path d="${kind==='soft'?softPath(ang,TL):burstPath(ang)}"/></svg>${html}`;
  b.addEventListener('animationend',e=>{if(e.animationName==='bubout')b.remove()});
  setTimeout(()=>b.remove(),(life||2200)+500);   // 윈도우 '애니메이션 효과 끄기' 등으로 애니메이션이 안 돌 때 대비
  box.appendChild(b);
}
/* 소리 끄기·켜기: 설정(게임 중 메뉴·로비 설정)에서만. 스위치 원칙대로 왼쪽 끄기, 오른쪽 켜기 */
function syncSndSeg(){document.querySelectorAll('.sndseg button').forEach(b=>{const on=(b.dataset.v==='on')===SND.on;b.setAttribute('aria-pressed',on);b.setAttribute('aria-checked',on)})}
function setSound(on){if(on===SND.on)return;SND.on=on;store('gura-sound',on?'on':'off');syncSndSeg();if(on){audioOn();setTimeout(()=>sfx('pick'),30)}}
function buildSndSeg(box){
  box.setAttribute('role','radiogroup');box.setAttribute('aria-label','소리');
  box.innerHTML='<button type="button" role="radio" data-v="off">끄기</button><button type="button" role="radio" data-v="on">켜기</button>';
  box.addEventListener('click',e=>{const b=e.target.closest('button');if(b)setSound(b.dataset.v==='on')});
}
buildSndSeg($('#mSnd'));buildSndSeg($('#segSnd'));syncSndSeg();
/* ================= 들판 BGM: 바람·풀 스치는 소리·새소리 (배경이 들판일 때) =================
   바람은 긴 잡음을 낮은 필터로 걸러 계속 틀고, 몇 초마다 바람 세기(gust)를 바꿔 천천히 따라가게 함.
   풀 소리는 높은 잡음을 바람 세기에 맞춰 잘게 떨리게, 새소리는 가끔 한 마리씩 좌우 아무 데서나 울림. */
const FIELD = {
  n: null, gust: .3, goal: .3, nextGoal: 0,
  LEVEL: 2.2,   // 재즈와 비슷하게 들리도록 맞춘 음량 (조금 작게)
  build(c, out) {
    const sr = c.sampleRate, len = sr * 4, buf = c.createBuffer(1, len, sr), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = (off) => { const s = c.createBufferSource(); s.buffer = buf; s.loop = true; s.start(c.currentTime, off); return s };
    const filt = (type, f, q) => { const b = c.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b };
    const gain = (v) => { const g = c.createGain(); g.gain.value = v; return g };
    const n = { out: gain(0) };
    n.out.connect(out);
    // 바람: 두 겹 저역 필터(웅-) + 공명 대역 필터(휘잉-)
    n.lp1 = filt('lowpass', 500, .7); n.lp2 = filt('lowpass', 500, .7); n.wind = gain(.01);
    src(0).connect(n.lp1); n.lp1.connect(n.lp2); n.lp2.connect(n.wind); n.wind.connect(n.out);
    n.bp = filt('bandpass', 700, 7); n.whistle = gain(.002);
    src(1.3).connect(n.bp); n.bp.connect(n.whistle); n.whistle.connect(n.out);
    // 풀 스치는 소리: 높은 잡음
    n.hp = filt('highpass', 2600, .5); n.lpR = filt('lowpass', 7000, .5); n.grass = gain(.003);
    src(2.6).connect(n.hp); n.hp.connect(n.lpR); n.lpR.connect(n.grass); n.grass.connect(n.out);
    // 새소리 버스: 멀리서 울리는 느낌으로 짧은 메아리
    n.birds = gain(.6); n.birds.connect(n.out);
    n.dl = c.createDelay(1); n.dl.delayTime.value = .17; n.fb = gain(.28); n.dlf = filt('lowpass', 3000, .5);
    n.birds.connect(n.dl); n.dl.connect(n.dlf); n.dlf.connect(n.fb); n.fb.connect(n.dl); n.dlf.connect(n.out);
    this.n = n;
  },
  // 켜기·끄기: 바로 끊지 않고 천천히 커지고 작아짐
  set(c, on, out) {
    if (!this.n) { if (!on) return; this.build(c, out) }
    this.n.out.gain.setTargetAtTime(on ? this.LEVEL : 0, c.currentTime, on ? 1 : .4);
  },
  // 새 한 번 짹: f0→f1로 미끄러지는 짧은 소리
  chirp(c, t, f0, f1, dur, vol, pan) {
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(.012, dur * .3)); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g);
    if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(this.n.birds) } else g.connect(this.n.birds);
    o.start(t); o.stop(t + dur + .02);
  },
  // 새 종류 몇 가지 (가까운 짹짹·휘파람·떨림 소리·먼 산비둘기)
  call(c, t) {
    const pan = Math.random() * 1.6 - .8, far = .45 + Math.random() * .55, r = Math.random(), j = (a) => a * (.94 + Math.random() * .12);
    if (r < .38) {           // 짹짹: 짧은 소리 2~4번
      const k = 2 + Math.floor(Math.random() * 3), f = j(3600);
      for (let i = 0; i < k; i++) this.chirp(c, t + i * j(.11), f, f * .78, .055, .03 * far, pan);
    } else if (r < .63) {    // 휘파람: 올라갔다 내려오는 소리
      const f = j(2300);
      this.chirp(c, t, f, f * 1.45, .2, .022 * far, pan);
      this.chirp(c, t + .22, f * 1.45, f * 1.1, .14, .02 * far, pan);
      if (Math.random() < .5) this.chirp(c, t + .45, f * 1.2, f * 1.5, .1, .016 * far, pan);
    } else if (r < .85) {    // 떨림: 아주 짧은 소리를 빠르게 여러 번
      const k = 8 + Math.floor(Math.random() * 8), f = j(4300);
      for (let i = 0; i < k; i++) this.chirp(c, t + i * .045, f * (1 + .04 * Math.sin(i)), f * .9, .03, .016 * far * (1 - i / k * .5), pan);
    } else {                 // 멀리서 산비둘기: 낮고 둥근 두 음
      const f = j(620);
      this.chirp(c, t, f, f * .95, .32, .02, pan * .5);
      this.chirp(c, t + .45, f * .86, f * .8, .5, .018, pan * .5);
    }
  },
  // 박자(약 0.43초)마다 한 번: 바람 세기를 따라가고 가끔 새가 울림
  step(c, t) {
    const n = this.n;
    if (t >= this.nextGoal) { this.goal = Math.pow(Math.random(), 1.4); this.nextGoal = t + 3 + Math.random() * 5 }
    this.gust += (this.goal - this.gust) * .12;
    const g = this.gust;
    n.wind.gain.setTargetAtTime(.014 + .02 * g, t, 1.2);
    n.lp1.frequency.setTargetAtTime(260 + 650 * g, t, 1.5); n.lp2.frequency.setTargetAtTime(300 + 700 * g, t, 1.5);
    n.bp.frequency.setTargetAtTime(520 + 520 * g, t, 2);
    n.whistle.gain.setTargetAtTime(.0015 + .007 * g * g, t, 1.5);
    // 풀은 바람이 불 때 잘게 사각거림
    for (let i = 0; i < 4; i++) n.grass.gain.setTargetAtTime((.002 + .012 * g * g) * (.5 + Math.random()), t + i * .1, .05);
    if (Math.random() < .11) this.call(c, t + Math.random() * .4);
  }
};

/* ================= 카페 재즈 BGM (Swing Jazz Trio Sequencer, 배경이 카페일 때) ================= */
const BGM = {
  timer: null,
  step: 0,
  playing: false,

  // 4마디 재즈 코드 진행: Dm9 -> G13 -> Cmaj9 -> A7alt (16스텝 = 4마디 x 4박자)
  // 1) 어쿠스틱 업라이트 워킹 베이스 라인 (Hz)
  bass: [
    73.42, 82.41, 87.31, 92.50,  // Dm7: D2 - E2 - F2 - F#2
    98.00, 110.00, 123.47, 73.42,// G7:  G2 - A2 - B2 - D2
    65.41, 73.42, 82.41, 98.00,  // Cmaj7: C2 - D2 - E2 - G2
    110.00, 98.00, 87.31, 82.41  // A7:  A2 - G2 - F2 - E2
  ],

  // 2) 일렉트릭 피아노(Rhodes) 재즈 보이싱 코드
  chords: [
    [293.66, 349.23, 440.00, 523.25], // Dm7 (D4, F4, A4, C5)
    [246.94, 349.23, 392.00, 440.00], // G9  (B3, F4, G4, A4)
    [261.63, 329.63, 392.00, 493.88], // Cmaj7 (C4, E4, G4, B4)
    [277.18, 349.23, 440.00, 523.25]  // A7#5#9 (C#4, F4, A4, C5)
  ],

  // 3) 카페 피아노 고음역대 애드리브 멜로디용 스케일 (Hz)
  licks: [523.25, 587.33, 659.25, 698.46, 783.99, 880.00, 987.77, 1046.50],

  // 피아노 화음 연주 헬퍼
  playChord(notes, dur, delay = 0, vol = 0.022) {
    notes.forEach((f, idx) => {
      // 손가락으로 살짝 굴려 치는 느낌(아르페지오 스트럼)을 위해 0.012초씩 미세 딜레이
      tone(f, dur, { bus: 'bgm', type: 'sine', vol, attack: 0.02, at: delay + idx * 0.012 });
    });
  },

  start() {
    if (this.playing) return;
    this.playing = true;
    this.step = 0;

    const tick = () => {
      if (!this.playing) return;
      const c = SND.ctx;

      // 오디오가 켜져 있고, '구라!' 판정(reveal) 연출 중이 아닐 때만 연주
      // 게임이 자기 배경음악을 틀고 있으면(대부호 방) 쉼. 배경이 들판이면 들판 소리, 카페면 재즈
      const ok = c && SND.on && SND.bgmVol > 0 && c.state === 'running' && !(V && V.st === 'reveal') && !(G.ownBgm && G.ownBgm());
      const field = typeof GFX_ENV === 'undefined' || GFX_ENV !== 'cafe';
      if (c && SND.bgm) FIELD.set(c, ok && field, SND.bgm);
      if (ok && field) FIELD.step(c, c.currentTime + .03);
      else if (ok) {
        const idx = this.step % 16;
        const bar = Math.floor(idx / 4); // 현재 마디 (0~3)
        const beat = idx % 4;            // 마디 내 박자 (0, 1, 2, 3)

        // [1] 워킹 베이스: 매 박자마다 묵직하고 따뜻하게 둥-둥- 연주
        const bf = this.bass[idx];
        if (bf) {
          tone(bf, 0.36, { bus: 'bgm', type: 'triangle', vol: 0.065, attack: 0.015, slide: bf * 0.99 });
        }

        // [2] 재즈 브러시 드럼 (스윙 라이드 심벌 & 하이햇)
        // 정박 브러시 터치
        hiss(0.05, { bus: 'bgm', freq: 6200, q: 2.2, vol: 0.018 });
        // 2박, 4박(beat 1, 3)에 하이햇 액센트 + 스윙 엇박(0.28초 뒤)에 '치-키' 리듬 추가
        if (beat === 1 || beat === 3) {
          hiss(0.08, { bus: 'bgm', freq: 4800, q: 1.6, vol: 0.032 });
          hiss(0.04, { bus: 'bgm', freq: 6800, q: 2.8, vol: 0.022, at: 0.28 });
        }

        // [3] 재즈 피아노 컴핑 (Comping - 리드미컬한 화음 반주)
        const chord = this.chords[bar];
        if (beat === 0) {
          // 각 마디 첫 박자에 부드럽게 화음 깔아주기
          this.playChord(chord, 0.55, 0, 0.024);
        } else if (beat === 2 && Math.random() < 0.75) {
          // 3박자 뒤 스윙 엇박 타이밍에 짧고 세련된 리듬 커팅 반주
          this.playChord(chord, 0.28, 0.26, 0.02);
        }

        // [4] 은은한 피아노 즉흥 멜로디 (매번 조금씩 다르게 연주되어 지루함 방지)
        if (Math.random() < 0.42) {
          const note = pick(this.licks);
          const swingDelay = Math.random() < 0.6 ? 0.27 : 0; // 스윙 엇박 반영
          tone(note, 0.24, { bus: 'bgm', type: 'sine', vol: 0.028, attack: 0.01, at: swingDelay });
        }

        this.step++;
      }

      // 기본 템포: 1박자당 약 430ms (약 140 BPM의 여유로운 카페 스윙 템포)
      this.timer = setTimeout(tick, 430);
    };

    tick();
  },

  stop() {
    this.playing = false;
    clearTimeout(this.timer);
    this.timer = null;
  }
};

// 사용자가 화면을 처음 클릭하거나 키를 누를 때 BGM 자동 시작
['pointerdown', 'keydown'].forEach(ev => {
  document.addEventListener(ev, () => {
    audioOn();
    BGM.start();
  }, { once: true, passive: true });
});
function myIdx(){return V&&V.ps&&Number.isInteger(V.you)&&V.you>=0&&V.you<V.ps.length?V.you:-1}
function myHand(){const i=myIdx();return i>=0&&Array.isArray(V.ps[i].h)?V.ps[i].h:[]}
function activeV(i){const p=V.ps[i];return p&&!p.f&&p.c>0}
function myReady(){const i=myIdx();return V&&!dealingV()&&V.st==='play'&&V.t===i&&i>=0&&activeV(i)&&clock()>=V.graceAt}
function sendAct(a){
  if(mode==='host'&&H)hostAct(hostSeat(),a);
  else if(mode==='guest'&&net.conn&&net.conn.open){try{net.conn.send(a)}catch(e){}}
}

