/* 첫 차례 주사위 계산 테스트: node tests/dicepick.test.js */
const D=require('../dicepick.js');
const {qRot}=D.math;
let fails=0,checks=0;
const ok=(c,m)=>{checks++;if(!c){fails++;console.log('FAIL',m)}};

/* 위로 향한 면 번호 */
function topFace(p,q){let best=-1,by=-2;p.shape.faces.forEach((f,i)=>{const y=qRot(q,f.n)[1];if(y>by){by=y;best=i}});return {face:best,y:by}}
const lowest=(p,pose)=>{let m=1e9;for(const v of p.shape.verts)m=Math.min(m,qRot(pose.q,v)[1]);return pose.y+m};

/* 모양: 인원별 면 수와 주인 */
{
  const want={2:6,3:6,4:8,5:6,6:6,7:8,8:8};
  for(let n=2;n<=8;n++){
    ok(D.sidesFor(n)===want[n],`n=${n} 면 수`);
    const own=D.owners(n),cnt=new Array(n).fill(0);let rr=0;
    own.forEach(s=>{if(s<0)rr++;else cnt[s]++});
    ok(cnt.every(c=>c===cnt[0]&&c>=1),`n=${n} 색마다 면 수가 같음 ${cnt}`);
    ok(rr===(n===5||n===7?1:0),`n=${n} 다시 굴리기 면 ${rr}개`);
    ok(own.length===D.sidesFor(n),`n=${n} 면 수와 주인 수`);
    ok(Math.abs(D.rerollP(n)-(rr/own.length))<1e-12,`n=${n} 다시 굴림 확률`);
  }
  /* 이웃한 면이 같은 색이 되지 않게(나누어떨어지는 경우) */
  for(const n of [2,3,4,6,8]){const own=D.owners(n),S=D.shape(D.sidesFor(n));
    let same=0;S.faces.forEach((a,i)=>S.faces.forEach((b,j)=>{if(j<=i)return;const sh=a.idx.filter(x=>b.idx.includes(x)).length;if(sh>=2&&own[i]===own[j])same++}));
    if(n!==2)ok(same===0,`n=${n} 모서리를 맞댄 같은 색 면 ${same}쌍`)}
}

/* 모양 법선이 바깥을 향하고 꼭짓점 순서가 반시계 */
for(const s of [6,8]){const S=D.shape(s);
  S.faces.forEach((f,i)=>{const p=f.idx.map(k=>S.verts[k]),a=p[0],b=p[1],c=p[2];
    const e1=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],e2=[c[0]-a[0],c[1]-a[1],c[2]-a[2]],cr=[e1[1]*e2[2]-e1[2]*e2[1],e1[2]*e2[0]-e1[0]*e2[2],e1[0]*e2[1]-e1[1]*e2[0]];
    ok(cr[0]*f.n[0]+cr[1]*f.n[1]+cr[2]*f.n[2]>0,`s=${s} 면${i} 반시계`);
    const d=a[0]*f.n[0]+a[1]*f.n[1]+a[2]*f.n[2];ok(Math.abs(d-S.faceR)<1e-9,`s=${s} 면${i} 중심 거리`)})}

/* 모든 인원·모든 첫 차례·여러 씨앗: 마지막에 위로 오는 면의 주인 = 첫 차례, 중간 굴림은 다시 굴리기 면 */
for(let n=2;n<=8;n++)for(let first=0;first<n;first++)for(let seed=1;seed<=6;seed++){
  const rolls=D.rerollP(n)?1+(seed%4):1,p=D.plan(n,first,{rolls,seed});
  ok(p.rolls===rolls,`n=${n} rolls ${p.rolls}/${rolls}`);
  ok(p.throws.length===rolls,`n=${n} 던진 횟수`);
  p.throws.forEach((T,k)=>{
    const last=k===rolls-1;
    ok(p.own[T.face]===(last?first:-1),`n=${n} first=${first} seed=${seed} 굴림${k} 목표 면 주인 ${p.own[T.face]}`);
    /* 멈춘 자세에서 실제로 그 면이 위 */
    const e=T.t0+T.dur+1,pose=p.poseAt(e);
    if(last&&e>=p.total)return;
    ok(pose&&pose.rest,`n=${n} 굴림${k} 멈춘 뒤 정지 자세`);
    if(pose){const tf=topFace(p,pose.q);ok(tf.face===T.face&&tf.y>.999,`n=${n} first=${first} 굴림${k}: 위 면 ${tf.face} (목표 ${T.face}) y=${tf.y.toFixed(4)}`);ok(Math.abs(lowest(p,pose))<1e-9,`n=${n} 멈춘 주사위가 바닥에 닿음 ${lowest(p,pose)}`)}
  });
  /* 시간 */
  const o=D.DEF;
  ok(Math.abs(p.total-D.totalFor(rolls))<1e-9,`n=${n} totalFor 일치`);
  ok(Math.abs(p.total-(o.dur+(rolls-1)*(o.pause+o.durAgain)+o.wait))<1e-9,`n=${n} total 식`);
  ok(Math.abs(p.landAt-(p.total-o.wait))<1e-9,`n=${n} landAt`);
  ok(p.at(p.landAt-1)===-1&&p.at(p.landAt)===first&&p.at(p.total-1)===first,`n=${n} at()`);
  ok(p.poseAt(-1)===null&&p.poseAt(p.total)===null,`n=${n} 범위 밖은 null`);
  /* 매 프레임: 바닥 아래로 파고들지 않고 위로 너무 튀지 않음, 좌표 유한 */
  let prevAir=false,maxY=0;
  for(let e=0;e<p.total;e+=8){
    const pose=p.poseAt(e);if(!pose)continue;
    const low=lowest(p,pose);
    ok(low>-1e-6,`n=${n} t=${e} 바닥 아래 ${low}`);
    maxY=Math.max(maxY,low);
    ok([pose.x,pose.y,pose.z,...pose.q].every(Number.isFinite),`n=${n} t=${e} 유한한 값`);
    const L=Math.hypot(...pose.q);ok(Math.abs(L-1)<1e-6,`n=${n} t=${e} 사원수 길이 ${L}`);
    ok(Math.abs(pose.x)<4&&Math.abs(pose.z)<4,`n=${n} t=${e} 가운데에서 너무 멂 ${pose.x},${pose.z}`);
  }
  ok(maxY<4,`n=${n} 너무 높이 뜸 ${maxY}`);
}

/* 같은 씨앗이면 모두 같은 연출 (방장이 보낸 값으로 재생) */
{
  const a=D.plan(5,2,{rolls:3,seed:77}),b=D.plan(5,2,{rolls:3,seed:77}),c=D.plan(5,2,{rolls:3,seed:78});
  let same=true,diff=false;
  for(let e=0;e<a.total;e+=37){const x=a.poseAt(e),y=b.poseAt(e),z=c.poseAt(e);if(!x)continue;if(JSON.stringify(x)!==JSON.stringify(y))same=false;if(JSON.stringify(x)!==JSON.stringify(z))diff=true}
  ok(same,'같은 씨앗은 같은 자세');ok(diff,'다른 씨앗은 다른 자세');
}

/* 나누어떨어지는 인원은 rolls를 크게 받아도 한 번만 굴림 (다시 굴리기 면이 없음) */
ok(D.plan(4,1,{rolls:5,seed:3}).rolls===1,'4명은 다시 굴리기가 없음');
ok(D.plan(6,1,{rolls:5,seed:3}).rolls===1,'6명은 다시 굴리기가 없음');

/* 고정(방장이 직접 고름): 굴리지 않고 안내 시간만 */
{
  const p=D.planFor(4,2,-1);
  ok(p.fixed&&p.total===D.DEF.wait&&p.at(0)===2&&p.poseAt(10)===null,'고정 선');
  ok(D.totalFor(-1)===D.DEF.wait&&D.totalFor(0)===D.DEF.wait&&D.totalFor(undefined)===D.DEF.wait,'신호가 없거나 음수면 안내 시간만');
  const q=D.planFor(3,1,undefined);ok(q.rolls===1&&!q.fixed,'rolls가 없으면 한 번');
}

/* 방장이 던질 횟수 뽑기: 5명은 다시 굴림 1/6, 7명은 1/8 → 평균 횟수 1/(1-p) */
{
  let seed=12345;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
  for(const [n,p] of [[5,1/6],[7,1/8]]){
    const N=200000;let s=0,max=0;for(let i=0;i<N;i++){const k=D.pickRolls(n,rnd);s+=k;max=Math.max(max,k)}
    const mean=s/N,exp=1/(1-p);
    ok(Math.abs(mean-exp)<.01,`n=${n} 평균 던진 횟수 ${mean.toFixed(4)} (기대 ${exp.toFixed(4)})`);
    ok(max<=D.MAXR,`n=${n} 최대 횟수 ${max}`);
  }
  for(const n of [2,3,4,6,8])ok(D.pickRolls(n,()=>0)===1,`n=${n} 다시 굴림 없음`);
  ok(D.pickRolls(5,()=>0)===D.MAXR,'난수가 항상 0이어도 끝남 (상한)');
}

/* 소리 시각: 던진 횟수마다 닿는 소리가 있고 시간순 */
{
  const p=D.plan(7,3,{rolls:3,seed:5});
  ok(p.impacts.length===3*4,`닿는 소리 ${p.impacts.length}개`);
  ok(p.impacts.every((x,i,a)=>i===0||x.t>a[i-1].t),'닿는 시각이 시간순');
  ok(p.impacts[p.impacts.length-1].t<=p.landAt+1e-9,'마지막 닿음은 멈추기 전');
}

/* 옛 값이 섞여도 안전 */
ok(D.plan(9,0,{rolls:1}).N===8&&D.plan(1,0,{rolls:1}).N===2,'인원은 2~8로 맞춤');
ok(D.plan(3,5,{rolls:1}).first===2,'첫 차례는 인원으로 나눈 나머지');
ok(Number.isFinite(D.plan(2,0,{rolls:'x',dur:null,seed:'y'}).total),'숫자가 아닌 옵션은 무시');

console.log(`dicepick checks ${checks}, fails ${fails}`);
process.exit(fails?1:0);
