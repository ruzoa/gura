/* 첫 차례 룰렛: 순서만 계산하는 순수 함수 (화면·소리 없음)
   테스트룸(lab.html)과 게임이 같은 파일을 쓰면 테스트룸에서 맞춘 감각이 그대로 나옵니다.

   Roulette.plan(n, first, opt) → { times, start, first, fast, steps, total, ratio }
     n      : 자리 수 (2~4)
     first  : 첫 차례 자리 (0 ~ n-1)
     opt    : { fastCount, fastGap, endGap, ratio, wait }  (ms, 칸 수)
   times[k] : k번째 칸 넘김이 일어나는 시각 (연출 시작 기준 ms)
   start    : 처음 켜지는 자리. 칸을 times.length번 넘기면 first에서 멈춥니다.
   total    : 마지막 칸 넘김 뒤 wait만큼 기다린 시각 (= 안내가 나오는 시각)
   at(e)    : e ms 시점에 가리키는 자리 */
(function(root){
  const DEF={fastMin:10,fastMax:30,fastCount:10,fastGap:50,endGap:1250,ratio:1.3,wait:650};   // 확정 값: 빠른 칸 10~30(매 판 무작위), 빠른 간격 50ms, 감속 ×1.3, 마지막 1.25초, 멈춘 뒤 0.65초

  /* 빠르게 도는 구간(fastGap 일정) 다음, 칸 사이 간격이 fastGap에서 바로 매번 같은 비율로 늘어 endGap에 닿음 */
  function gaps(opt){
    const o=Object.assign({},DEF,opt),g=[];
    for(let k=0;k<Math.max(0,Math.round(o.fastCount));k++)g.push(o.fastGap);
    // 감속 칸 수: ratio에 가장 가깝게 맞추고, 실제 비율 r은 마지막 간격이 정확히 endGap이 되도록 조금 보정
    const steps=Math.max(1,Math.round(Math.log(o.endGap/o.fastGap)/Math.log(Math.max(1.01,o.ratio))));
    const r=Math.pow(o.endGap/o.fastGap,1/steps);
    // 첫 감속 칸은 fastGap*r 부터 시작 (이음새에서 빨라지지 않음)
    for(let k=1;k<=steps;k++)g.push(o.fastGap*Math.pow(r,k));
    return {gaps:g,steps,ratio:r,fast:Math.max(0,Math.round(o.fastCount))};
  }

  function plan(n,first,opt){
    const o=Object.assign({},DEF,opt),G=gaps(o),times=[];
    let t=0;for(const x of G.gaps){t+=x;times.push(t)}
    const m=times.length,start=(((first-m)%n)+n)%n;
    return {
      times,start,first,n,fast:G.fast,steps:G.steps,ratio:G.ratio,gaps:G.gaps,
      total:t+o.wait,
      at(e){let c=0;while(c<m&&times[c]<=e)c++;return (start+c)%n}
    };
  }

  /* 매 판 빠르게 도는 칸 수를 무작위로 (min~max). rnd는 0~1 난수 (테스트에서 고정 가능) */
  function pickFast(min,max,rnd){const a=Math.min(min,max),b=Math.max(min,max);return a+Math.floor((rnd==null?Math.random():rnd)*(b-a+1))}

  const api={DEF,gaps,plan,pickFast};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Roulette=api;
})(typeof window!=='undefined'?window:globalThis);
