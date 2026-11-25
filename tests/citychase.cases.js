/* 시티 체이스 테스트 (tests/engine.test.js가 이 파일을 불러서 { } 블록 안에서 돌림) */
const T=CC._test;
const eq=(a,b,m)=>{if(a!==b)fail('citychase '+m+': '+a+' != '+b)};
const ok=(v,m)=>{if(!v)fail('citychase '+m)};
let seedV=1;const rng=()=>{seedV=(seedV*16807)%2147483647;return seedV/2147483647};
/* 판: 이름·이웃·교차로 둘레 */
eq(T.bName(0),'A5','A5 top left');eq(T.bName(24),'E1','E1 bottom right');
eq(T.NBR_B[0].length,2,'corner nbrs');eq(T.NBR_B[2].length,3,'edge nbrs');eq(T.NBR_B[12].length,4,'inner nbrs');
eq(T.AROUND[0].join(),'0,1,5,6','around q0');eq(T.AROUND[15].join(),'18,19,23,24','around q15');
eq(T.IAT[0].length,1,'corner under 1 intersection');eq(T.IAT[1].length,2,'edge under 2');eq(T.IAT[12].length,4,'inner under 4');
eq(T.NBR_I[0].length,2,'q corner moves');eq(T.NBR_I[5].length,4,'q inner moves');
/* 도둑 이동: 처음은 아무 곳, 그다음 옆(대각선 아님), 흔적 금지 */
eq(T.legalHides([]).length,25,'first anywhere');
eq(T.legalHides([12]).sort((a,b)=>a-b).join(),'7,11,13,17','orthogonal only');
eq(T.legalHides([0,1]).sort((a,b)=>a-b).join(),'2,6','no back to trace');
eq(T.legalHides([1,6,5,0]).length,0,'cornered');
/* 흔적 색: 처음 노랑, 가운데(11라운드면 여섯째) 빨강 */
eq(T.midOf(11),6,'mid 11');eq(T.midOf(9),5,'mid 9');eq(T.traceCol(0,6),2,'yellow');eq(T.traceCol(5,6),3,'red');eq(T.traceCol(3,6),1,'blue');
/* 헬기 주인: 경찰 1명이면 셋 다, 2명이면 셋째가 번갈아, 3명이면 하나씩 */
eq([0,1,2].map(h=>T.ownerOf(h,[1],3)).join(),'1,1,1','one cop all');
eq([0,1,2].map(h=>T.ownerOf(h,[0,2],1)).join(),'0,2,0','two cops r1');eq([0,1,2].map(h=>T.ownerOf(h,[0,2],2)).join(),'0,2,2','two cops r2');
eq([0,1,2].map(h=>T.ownerOf(h,[1,2,3],5)).join(),'1,2,3','three cops');
/* 공개 정보와 맞는 길: 진짜 길은 언제나 들어 있음, 정보가 없으면 모든 길 */
eq(T.pathsFor(1,[],[],6).length,25,'25 starts');eq(T.pathsFor(2,[],[],6).length,80,'80 two-step');eq(T.pathsFor(1,[[7,1]],[],6).length,24,'empty removes');
for(let k=0;k<160;k++){
  const R=7+(k%9),mid=T.midOf(R),path=[],rv=new Array(25).fill(0),es=[],tr=[];
  for(let r=0;r<R;r++){
    const L=T.legalHides(path);if(!L.length)break;path.push(L[rng()*L.length|0]);
    for(let s=0;s<3;s++){const b=rng()*25|0;if(rv[b]||b===path[path.length-1])continue;const i=path.indexOf(b);if(i>=0){const c=T.traceCol(i,mid);rv[b]=c;tr.push([b,c,path.length])}else es.push([b,path.length])}
    const S=T.pathsFor(path.length,es,tr,mid);
    if(!S.some(p=>p.join()===path.join())){fail('citychase true path lost '+path.join()+' es '+JSON.stringify(es)+' tr '+JSON.stringify(tr));break}
    if(S.some(p=>new Set(p).size!==p.length))fail('citychase path repeats');
  }
}
{const S=T.pathsFor(3,[],[[4,2,3]],6);ok(S.length&&S.every(p=>p[0]===4),'yellow fixes start')}
{const S=T.pathsFor(7,[],[[9,3,7]],6);ok(S.length&&S.every(p=>p[5]===9),'red fixes middle')}
{const S=T.pathsFor(4,[],[[12,1,4]],6);ok(S.length&&S.every(p=>{const i=p.indexOf(12);return i>0&&i<3}),'blue before now, not start')}
/* 엔진 */
const setup=(n,bots,lvs,over)=>{
  hostNew(false,'t','t');H.cfg={...cfgFor('citychase'),game:'citychase',turn:30,max:4,...(over||{})};
  H.members=[];for(let i=0;i<n;i++)H.members.push(bots?{name:'b'+i,bot:true,conn:null,host:i===0,lv:(lvs||[1])[i%(lvs||[1]).length]}:{name:'p'+i,bot:false,conn:i?{}:null,host:i===0,cid:i?'c'+i:''});
  hostStart();for(let k=0;k<80&&dealing();k++){NOW+=250;engineTick()}
};
const X=()=>H.cc;
const cops=()=>T.polOf();
const placeAll=()=>{let g=0;while(X().ph==='heli'&&g++<10){const h=T.pendHelis()[0],s=T.ownNow(h),q=[5,10,0,15,3,12].find(q=>!X().hel.includes(q));hostAct(s,{t:'place',h,k:q})}};
/* 시작: 헬기 놓기 → 도둑 → 경찰 */
setup(3);{
  eq(X().ph,'heli','starts with helis');eq(X().rn,0,'round 0');
  const th=X().th,[a,b]=cops();
  hostAct(th,{t:'place',h:0,k:5});eq(X().hel[0],-1,'thief cannot place');
  eq(snapFor(a).t,a,'cop a to place');eq(snapFor(b).t,b,'cop b to place');
  hostAct(a,{t:'place',h:0,k:5});eq(X().hel[0],5,'cop places own heli');
  hostAct(b,{t:'place',h:0,k:6});eq(X().hel[0],5,'cannot place others heli');
  hostAct(b,{t:'place',h:1,k:5});eq(X().hel[1],-1,'occupied intersection');
  hostAct(b,{t:'place',h:1,k:10});hostAct(T.ownNow(2),{t:'place',h:2,k:0});
  eq(X().ph,'thief','thief after helis');eq(X().rn,1,'round 1');eq(H.turn,th,'thief turn');
  hostAct(a,{t:'hide',b:20});eq(X().path.length,0,'cop cannot hide');
  hostAct(th,{t:'hide',b:20});eq(X().pos,20,'hid');eq(X().ph,'police','police phase');
  /* 비밀: 경찰·관전자에게 자리·길이 가지 않음 */
  const sa=snapFor(a),ss=snapFor(-1),st=snapFor(th);
  eq(sa.cc.pos,undefined,'cop no pos');eq(sa.cc.path,undefined,'cop no path');eq(ss.cc.pos,undefined,'spec no pos');eq(st.cc.pos,20,'thief sees pos');
  ok(!JSON.stringify(sa).includes('"b":20'),'hide event hides building');ok(JSON.stringify(st.cc.ev).includes('"b":20'),'thief sees own event');
  eq(sa.t,a,'cop turn');eq(st.t!==th,true,'not thief turn');
  /* 경찰: 이동·수색 규칙 (헬기 0은 교차로 5, 1은 10, 2는 0) */
  hostAct(a,{t:'move',h:0,k:6});eq(X().hel[0],6,'move');eq(X().hd[0],1,'acted');
  hostAct(a,{t:'search',h:0,b:7});eq(X().es.length,0,'one action per heli');
  hostAct(b,{t:'move',h:1,k:6});eq(X().hel[1],10,'no move onto heli');
  hostAct(b,{t:'move',h:1,k:15});eq(X().hel[1],10,'no diagonal move');
  hostAct(b,{t:'search',h:1,b:3});eq(X().es.length,0,'search only around');
  hostAct(b,{t:'search',h:1,b:17});eq(X().es.length,1,'empty search');eq(X().em[0],17,'empty shown');
  hostAct(T.ownNow(2),{t:'search',h:2,b:0});
  eq(X().ph,'thief','next thief');eq(X().rn,2,'round 2');eq(X().em.length,0,'empty marks cleared');
  hostAct(th,{t:'hide',b:16});eq(X().pos,20,'no diagonal');hostAct(th,{t:'hide',b:21});eq(X().pos,21,'move right');
  /* 흔적 찾기: 노랑(첫 자리) */
  X().hel[0]=12;hostAct(T.ownNow(0),{t:'search',h:0,b:20});eq(X().rv[20],2,'yellow trace found');eq(X().tr.length,1,'trace kept');
  hostAct(T.ownNow(0),{t:'search',h:0,b:15});eq(X().es.length,2,'acted heli cannot search');
  hostAct(T.ownNow(1),{t:'move',h:1,k:9});hostAct(T.ownNow(2),{t:'move',h:2,k:1});
  eq(X().rn,3,'round 3');hostAct(th,{t:'hide',b:20});eq(X().pos,21,'no return to trace');
  hostAct(th,{t:'hide',b:22});eq(X().pos,22,'onward');
  X().hd=[1,0,0];X().hel[1]=13;hostAct(T.ownNow(1),{t:'search',h:1,b:20});eq(X().rv[20],2,'revealed trace not searchable');eq(X().hd[1],0,'turn kept')
}
/* 잡기: 경찰 승리, 순위 */
setup(3);placeAll();{const th=X().th;hostAct(th,{t:'hide',b:6});const q=X().hel.findIndex(k=>k>=0&&T.AROUND[k].includes(6));
  const h=q>=0?q:0;if(q<0){X().hel[0]=0}
  hostAct(T.ownNow(h),{t:'search',h,b:6});eq(H.phase,'over','caught ends');eq(X().res.why,'catch','why catch');
  eq(H.players[th].rank,2,'thief loses');for(const c of [0,1,2].filter(i=>i!==th))eq(H.players[c].rank,1,'cops win');
  eq(snapFor(cops()[0]).cc.path.length,1,'path shown at end')}
/* 포위: 갈 곳이 없으면 경찰 승리 (6의 이웃 1·5·7·11이 모두 흔적) */
setup(2);placeAll();{const th=X().th,c=T.polOf()[0];
  Object.assign(X(),{path:[7,2,1,0,5,10,11,6],pos:6,rn:8,ph:'police',hd:[1,1,0]});
  const sr=T.heliSearches(X().hel,X().rv,2).filter(b=>b!==6);
  if(sr.length)hostAct(c,{t:'search',h:2,b:sr[0]});else hostAct(c,{t:'move',h:2,k:T.heliMoves(X().hel,2)[0]});
  eq(H.phase,'over','trap ends');eq(X().res&&X().res.why,'trap','why trap');eq(H.players[th].rank,2,'trapped thief loses')}
/* 끝까지 숨음: 도둑 승리 */
setup(2,false,null,{rnd:7});placeAll();{const th=X().th,c=T.polOf()[0];const route=[0,1,2,3,4,9,14];
  for(let r=0;r<7;r++){hostAct(th,{t:'hide',b:route[r]});eq(X().pos,route[r],'hide '+r);
    for(let h=0;h<3&&H.phase==='play'&&X().ph==='police';h++){if(X().hd[h])continue;const mv=T.heliMoves(X().hel,h);if(mv.length)hostAct(c,{t:'move',h,k:mv[0]});else{X().hd[h]=1}}
    if(H.phase!=='play')break}
  eq(H.phase,'over','escape ends');eq(X().res&&X().res.why,'escape','why escape');eq(H.players[th].rank,1,'thief wins')}
/* 시간 초과: 도둑은 무작위 건물, 헬기는 모두 행동 */
setup(3);placeAll();{const th=X().th;NOW+=31000;engineTick();eq(X().path.length,1,'thief timeout hides');eq(X().ph,'police','police after timeout');
  NOW+=31000;engineTick();ok(H.phase==='over'||(X().ph==='thief'&&X().rn===2),'police timeout acts all')}
/* 항복: 도둑이면 경찰 승리, 마지막 경찰이면 도둑 승리, 경찰 하나가 빠지면 헬기를 넘겨받음 */
setup(3);placeAll();{const th=X().th;hostAct(th,{t:'surrender'});eq(H.phase,'over','thief gave up');ok(X().res.w.length===2&&!X().res.w.includes(th),'cops win')}
setup(3);{const th=X().th,[a,b]=cops();hostAct(a,{t:'surrender'});eq(H.phase,'play','one cop gave up');eq([0,1,2].every(h=>T.ownNow(h)===b),true,'other cop takes all helis');
  hostAct(b,{t:'surrender'});eq(H.phase,'over','last cop gave up');eq(X().res.w.join(),String(th),'thief wins')}
/* 바로 시작: 다음 사람이 도둑 */
setup(3,true);{for(let k=0;k<4000&&H.phase!=='over';k++){NOW+=250;engineTick()}const th0=X().th;hostStart();for(let k=0;k<80&&dealing();k++){NOW+=250;engineTick()}eq(X().th,(th0+1)%3,'next thief')}
/* 도둑 고르기(선택): 방장이 고른 사람 */
{hostNew(false,'t','t');H.cfg={...cfgFor('citychase'),game:'citychase',pickfirst:1,max:4};H.members=[0,1,2].map(i=>({name:'p'+i,bot:false,conn:i?{}:null,host:i===0,cid:i?'c'+i:''}));H.firstName='p2';hostStart();eq(H.cc.th,2,'chosen thief')}
/* 경찰 봇은 공개 정보만: 진짜 길만 다르고 공개 정보가 같으면 같은 행동 */
for(let k=0;k<40;k++){
  const P={t:3,es:[[2,1],[7,2]],tr:[[11,1,3]],mid:6,hel:[0,5,10],rv:new Array(25).fill(0)};P.rv[11]=1;
  for(const lv of [0,1,2]){seedV=1000+k;const a1=JSON.stringify(T.policeAction(P,k%3,lv,rng));seedV=1000+k;const a2=JSON.stringify(T.policeAction({...P,path:[3,4,9],pos:9},k%3,lv,rng));if(a1!==a2)fail('citychase police bot peeks');}
}
/* 경찰 봇: 둘레에 확실한 차가 있으면 수색 */
{const S=T.pathsFor(2,[[1,2],[5,2],[6,2]],[[0,2,2]],6);eq(S.length,0,'no path when boxed');
 const P={t:2,es:[[2,2],[10,2],[11,2],[12,2]],tr:[[6,2,2]],mid:6,hel:[0,9,14],rv:new Array(25).fill(0)};P.rv[6]=2;
 const B=T.beliefOf(P);ok(B.n>0&&B.car[1]+B.car[5]+B.car[7]>.99,'belief around start');
 const a=T.policeAction(P,0,2,()=>.5);ok(a&&a.t==='search'&&[1,5].includes(a.b),'hard cop searches likely '+JSON.stringify(a))}
/* 도둑 봇: 막히지 않는 길, 헬기 옆을 피함 */
{const Xs={path:[0,1],R:11,mid:6,hel:[1,-1,-1],es:[],tr:[]};for(let k=0;k<20;k++){const b=T.thiefAction(Xs,2,rng);ok([2,6].includes(b),'thief legal')}}
{const Xs={path:[0],R:11,mid:6,hel:[-1,-1,-1],es:[],tr:[]};for(let k=0;k<20;k++)eq(T.thiefAction(Xs,1,rng)!==-1,true,'thief moves')}
/* 봇끼리 끝까지: 2~4명, 난이도 섞어서 */
for(let rep=0;rep<18;rep++){
  const n=2+rep%3;setup(n,true,[rep%3,(rep+1)%3,(rep+2)%3],{rnd:[11,7,13][rep%3],turn:20});
  let g=0;while(H.phase!=='over'&&g++<6000){NOW+=250;engineTick();if(H.phase==='play'&&!H.players[H.turn])fail('citychase bad turn')}
  if(H.phase!=='over'){fail('citychase bots stuck n='+n);break}
  const r=H.players.slice(0,n).map(p=>p.rank);ok(r.every(v=>v===1||v===2)&&r.includes(1)&&r.includes(2),'ranks '+r)
}
/* 단계별 세기: 같은 도둑(보통)에게 경찰 단계가 오를수록 더 잡고, 같은 경찰(보통)에게 도둑 단계가 오를수록 더 숨음 */
{
  const sim=(clv,tlv,n,games)=>{let cw=0;
    for(let g=0;g<games;g++){
      const R=11,mid=6,hel=[-1,-1,-1],rv=new Array(25).fill(0),es=[],tr=[],path=[];
      for(let h=0;h<3;h++)hel[h]=T.placeHeli(hel,rng);
      let caught=false;
      for(let r=1;r<=R&&!caught;r++){
        const L=T.legalHides(path);if(!L.length){caught=true;break}
        const b=T.thiefAction({path,R,mid,hel,es,tr},tlv,rng);path.push(b);
        for(let h=0;h<3&&!caught;h++){
          const a=T.policeAction({t:path.length,es,tr,mid,hel,rv},h,clv,rng);if(!a)continue;
          if(a.t==='move')hel[h]=a.k;
          else if(a.b===b)caught=true;
          else{const i=path.indexOf(a.b);if(i>=0){const c=T.traceCol(i,mid);rv[a.b]=c;tr.push([a.b,c,path.length])}else es.push([a.b,path.length])}
        }
      }
      if(caught)cw++;
    }
    return cw/games;
  };
  const G_=60,c0=sim(0,1,0,G_),c1=sim(1,1,0,G_),c2=sim(2,1,0,G_),t0=sim(1,0,0,G_),t2=sim(1,2,0,G_);
  if(typeof process!=='undefined'&&process.env.CC_BAL)console.log('citychase cop win vs medium thief: easy',c0,'medium',c1,'hard',c2,'| vs medium cop: easy thief',t0,'hard thief',t2);
  ok(c2>c0,'hard cop beats easy cop '+c2+' '+c0);ok(t2<t0,'hard thief hides better than easy '+t2+' '+t0);
}
