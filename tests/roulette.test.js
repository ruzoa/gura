/* 룰렛 계산 테스트: node tests/roulette.test.js */
const R=require('../roulette.js');
let fails=0;const ok=(c,m)=>{if(!c){fails++;console.log('FAIL',m)}};

for(const n of [2,3,4])for(let f=0;f<n;f++)for(const fc of [0,1,10,17,26]){
  const p=R.plan(n,f,{fastCount:fc});
  ok(p.at(p.total)===f,`끝 자리 n=${n} f=${f} fast=${fc}`);                 // 멈춘 자리 = 첫 차례
  ok(p.at(-1)===-1&&p.at(p.lead-1)===-1&&p.at(p.lead)===p.start,`앞 연출 동안은 후보(-1), 끝나면 시작 자리 n=${n}`);
  for(let k=1;k<p.times.length;k++)ok(p.times[k]>p.times[k-1],'시각이 늘어남');
  const g=p.gaps;
  ok(Math.abs(g[g.length-1]-R.DEF.endGap)<1,`마지막 간격 ${R.DEF.endGap} (${g[g.length-1]})`);
  // 이음새: 빠른 구간 다음 칸이 더 빠르지 않음
  if(fc>0)ok(g[fc]>=g[fc-1]-1e-9,`감속 이음새 fast=${fc}`);
  // 감속 구간은 매번 같은 비율로 늘어남
  for(let k=fc+1;k<g.length;k++)ok(Math.abs(g[k]/g[k-1]-p.ratio)<1e-6,'같은 비율');
}
// 빠르게 도는 칸 수가 판마다 달라지면 처음 켜지는 자리도 달라질 수 있음 (결과를 미리 알 수 없음)
const starts=new Set();for(let fc=10;fc<=20;fc++)starts.add(R.plan(4,0,{fastCount:fc}).start);
ok(starts.size>1,'시작 자리가 고정되지 않음');
ok(R.pickFast(10,20,0)===10&&R.pickFast(10,20,.999)===20,'pickFast 범위');
// 방장이 고른 선(fixed): 돌지 않고 바로 그 자리, 대기 시간 뒤 안내
{const p=R.planFor(4,2,-1);ok(p.fixed&&p.times.length===0&&p.at(0)===2&&p.total===R.DEF.wait,'고정 선');}
{const p=R.planFor(3,1,undefined);ok(!p.fixed&&p.fast===R.DEF.fastCount,'신호가 없으면 기본값');}
// 앞 연출 값을 바꿔도 끝 자리는 그대로
for(const lead of [0,400,1200]){const p=R.plan(4,3,{fastCount:12,lead});ok(p.at(p.total)===3&&p.times[0]>=lead,'lead '+lead)}
console.log('fails',fails);process.exit(fails?1:0);
