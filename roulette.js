/* 첫 차례 룰렛: 순서만 계산하는 순수 함수 (화면·소리 없음)
   테스트룸(lab.html)과 게임이 같은 파일을 쓰면 테스트룸에서 맞춘 감각이 그대로 나옵니다.

   Roulette.plan(n, first, opt) → { times, start, first, fast, steps, total, ratio }
     n      : 자리 수 (2~4)
     first  : 첫 차례 자리 (0 ~ n-1)
     opt    : { fastCount, fastGap, endGap, ratio, wait }  (ms, 칸 수)
   times[k] : k번째 칸 넘김이 일어나는 시각 (연출 시작 기준 ms)
   start    : 처음 켜지는 자리. 칸을 times.length번 넘기면 first에서 멈춥니다.
   total    : lead(후보만 켜진 시간) + 칸 넘김 + wait만큼 기다린 시각 (= 안내가 나오는 시각)
   at(e)    : e ms 시점에 가리키는 자리 (lead 동안은 -1 = 후보 전체) */
(function(root){
  const DEF={fastMin:10,fastMax:30,fastCount:10,fastGap:50,endGap:1250,ratio:1.3,wait:650,lead:400};   // 확정 값: 빠른 칸 10~30(매 판 무작위), 빠른 간격 50ms, 감속 ×1.3, 마지막 1.25초, 멈춘 뒤 0.65초

  /* 값이 없거나 숫자가 아닌 옵션은 무시하고 기본값을 씀 (옛 신호·빠진 값에도 안전) */
  const merge=opt=>{const o=Object.assign({},DEF);if(opt)for(const k in opt)if(Number.isFinite(+opt[k])&&opt[k]!==null&&opt[k]!=='')o[k]=+opt[k];return o};

  /* 빠르게 도는 구간(fastGap 일정) 다음, 칸 사이 간격이 fastGap에서 바로 매번 같은 비율로 늘어 endGap에 닿음 */
  function gaps(opt){
    const o=merge(opt),g=[];
    for(let k=0;k<Math.max(0,Math.round(o.fastCount));k++)g.push(o.fastGap);
    // 감속 칸 수: ratio에 가장 가깝게 맞추고, 실제 비율 r은 마지막 간격이 정확히 endGap이 되도록 조금 보정
    const steps=Math.max(1,Math.round(Math.log(o.endGap/o.fastGap)/Math.log(Math.max(1.01,o.ratio))));
    const r=Math.pow(o.endGap/o.fastGap,1/steps);
    // 첫 감속 칸은 fastGap*r 부터 시작 (이음새에서 빨라지지 않음)
    for(let k=1;k<=steps;k++)g.push(o.fastGap*Math.pow(r,k));
    return {gaps:g,steps,ratio:r,fast:Math.max(0,Math.round(o.fastCount))};
  }

  /* lead: 돌기 전에 후보(모든 자리)가 한꺼번에 켜져 있는 시간. 그동안 at()은 -1
     fixed: 방장이 선을 직접 골랐을 때 — 돌지 않고 바로 그 자리 (칸 넘김 없음, 대기 시간 뒤 안내) */
  function plan(n,first,opt){
    const o=merge(opt);
    if(o.fixed)return {times:[],start:first,first,n,fast:0,steps:0,ratio:1,gaps:[],lead:0,fixed:true,total:o.wait,at(){return first}};
    const G=gaps(o),times=[],lead=Math.max(0,o.lead);
    let t=lead;for(const x of G.gaps){t+=x;times.push(t)}
    const m=times.length,start=(((first-m)%n)+n)%n;
    return {
      times,start,first,n,fast:G.fast,steps:G.steps,ratio:G.ratio,gaps:G.gaps,lead,fixed:false,
      total:t+o.wait,
      at(e){if(e<lead)return -1;let c=0;while(c<m&&times[c]<=e)c++;return (start+c)%n}
    };
  }
  /* 시작 신호의 빠른 칸 수(fast)로 계획 만들기: 음수(-1)는 방장이 직접 고른 선(고정), 없으면 기본값 */
  const planFor=(n,first,fast)=>plan(n,first,fast<0?{fixed:1}:{fastCount:fast});

  /* 매 판 빠르게 도는 칸 수를 무작위로 (min~max). rnd는 0~1 난수 (테스트에서 고정 가능) */
  function pickFast(min,max,rnd){const a=Math.min(min,max),b=Math.max(min,max);return a+Math.floor((rnd==null?Math.random():rnd)*(b-a+1))}

  const api={DEF,gaps,plan,planFor,pickFast,merge};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Roulette=api;
})(typeof window!=='undefined'?window:globalThis);
