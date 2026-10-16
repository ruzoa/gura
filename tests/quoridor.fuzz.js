/* 쿼리도 규칙을 따로 만든 참조 구현과 무작위로 대조 (engine.test.js 안에서 실행)
   벽 겹침·길 막기 판정, 한 칸 이동·뛰어넘기·대각선, 최단 경로, 봇이 고른 수가 규칙에 맞는지 */
const Q=GAMES.quoridor._test;
/* 참조: 막힌 변(edge) 집합 */
const ek=(a,b,c,d)=>{const x=a*9+b,y=c*9+d;return x<y?x+'-'+y:y+'-'+x};
function edgesOf(walls){const s=new Set();for(const [r,c,o] of walls){if(o===0){s.add(ek(r,c,r+1,c));s.add(ek(r,c+1,r+1,c+1))}else{s.add(ek(r,c,r,c+1));s.add(ek(r+1,c,r+1,c+1))}}return s}
const inb=(r,c)=>r>=0&&r<9&&c>=0&&c<9;
const D=[[-1,0],[0,1],[1,0],[0,-1]];
function refStep(E,r,c,d){const nr=r+D[d][0],nc=c+D[d][1];return inb(nr,nc)&&!E.has(ek(r,c,nr,nc))}
function refConflict(walls,w){
  for(const v of walls){
    if(v[0]===w[0]&&v[1]===w[1])return true;   // 같은 중심 (같은 벽이거나 십자)
    if(v[2]===w[2]){
      if(w[2]===0&&v[0]===w[0]&&Math.abs(v[1]-w[1])===1)return true;
      if(w[2]===1&&v[1]===w[1]&&Math.abs(v[0]-w[0])===1)return true;
    }
  }
  return false;
}
const goal=(sd,r,c)=>[r===0,c===8,r===8,c===0][sd];   // 출발 0 아래→위, 1 왼쪽→오른쪽, 2 위→아래, 3 오른쪽→왼쪽
function refReach(E,p,sd){
  const seen=new Set([p[0]*9+p[1]]),q=[p];
  while(q.length){const [r,c]=q.shift();if(goal(sd,r,c))return true;for(let d=0;d<4;d++)if(refStep(E,r,c,d)){const n=(r+D[d][0])*9+c+D[d][1];if(!seen.has(n)){seen.add(n);q.push([r+D[d][0],c+D[d][1]])}}}
  return false;
}
function refMoves(E,pos,i){
  const occ=new Set(pos.filter((p,j)=>p).map(p=>p[0]*9+p[1]));
  const [r,c]=pos[i],out=new Set();
  for(let d=0;d<4;d++){
    if(!refStep(E,r,c,d))continue;
    const nr=r+D[d][0],nc=c+D[d][1];
    if(!occ.has(nr*9+nc)){out.add(nr*9+nc);continue}
    if(refStep(E,nr,nc,d)&&!occ.has((nr+D[d][0])*9+nc+D[d][1])){out.add((nr+D[d][0])*9+nc+D[d][1]);continue}
    for(const e of [(d+1)%4,(d+3)%4])if(refStep(E,nr,nc,e)){const x=(nr+D[e][0])*9+nc+D[e][1];if(!occ.has(x))out.add(x)}
  }
  return out;
}

const SD=[0,3,2,1];
for(let trial=0;trial<600;trial++){
  const n=2+(trial%3);
  const S={n,cnt:n,sd:SD.slice(0,n),pos:[],done:Array(n).fill(0),wl:Array(n).fill(99),B:Q.mkB(),walls:[],lm:null};
  // 말을 서로 다른 칸에, 가끔은 붙여서 배치
  const used=new Set();
  for(let i=0;i<n;i++){let r,c;do{if(i>0&&Math.random()<.6){const b=S.pos[Math.random()*i|0],d=D[Math.random()*4|0];r=b[0]+d[0];c=b[1]+d[1]}else{r=Math.random()*9|0;c=Math.random()*9|0}}while(!inb(r,c)||used.has(r*9+c)||goal(S.sd[i],r,c));used.add(r*9+c);S.pos.push([r,c])}
  // 벽을 무작위로 쌓아 가며 매번 대조
  const k=Math.random()*24|0;
  for(let t=0;t<60&&S.walls.length<k;t++){
    const w=[Math.random()*8|0,Math.random()*8|0,Math.random()*2|0];
    const fits=Q.wallFits(S.B,w[0],w[1],w[2]),rf=!refConflict(S.walls,w);
    if(fits!==rf)fail('wallFits '+JSON.stringify(w)+' walls='+JSON.stringify(S.walls));
    let refOk=rf;
    if(rf){const E=edgesOf([...S.walls,w]);for(let i=0;i<n;i++)if(!refReach(E,S.pos[i],S.sd[i]))refOk=false}
    const ok=Q.wallOK(S,w[0],w[1],w[2]);
    if(ok!==refOk)fail('wallOK '+JSON.stringify(w)+' ref='+refOk+' got='+ok+' walls='+JSON.stringify(S.walls)+' pos='+JSON.stringify(S.pos));
    if(ok){S.walls.push([w[0],w[1],w[2],0]);(w[2]===0?S.B.hw:S.B.vw)[w[0]][w[1]]=1}
  }
  const E=edgesOf(S.walls);
  for(let r=0;r<9;r++)for(let c=0;c<9;c++)for(let d=0;d<4;d++)if(Q.canStep(S.B,r,c,d)!==refStep(E,r,c,d))fail('canStep '+[r,c,d]);
  for(let i=0;i<n;i++){
    const got=new Set(Q.legalMoves(S,i).map(m=>m[0]*9+m[1])),ref=refMoves(E,S.pos,i);
    if(got.size!==ref.size||[...ref].some(x=>!got.has(x)))fail('moves i='+i+' got='+[...got]+' ref='+[...ref]+' pos='+JSON.stringify(S.pos)+' walls='+JSON.stringify(S.walls));
    if((Q.dist(S,i)>=0)!==refReach(E,S.pos[i],S.sd[i]))fail('dist reach');
    // 길 목록이 실제로 이어지고 목표에서 끝나는지
    const pt=Q.path(S,i);
    if(pt){if(pt.length-1!==Q.dist(S,i))fail('path len');for(let t=0;t+1<pt.length;t++){const a=pt[t],b=pt[t+1];if(E.has(ek(a/9|0,a%9,b/9|0,b%9))||Math.abs((a/9|0)-(b/9|0))+Math.abs(a%9-b%9)!==1)fail('path broken')}const L=pt[pt.length-1];if(!goal(S.sd[i],L/9|0,L%9))fail('path end')}
  }
  // 봇이 고른 수가 늘 규칙에 맞는지
  for(let i=0;i<n;i++)for(const lv of [0,1,2]){
    const a=Q.botChoose(S,i,lv);if(!a)continue;
    if(a.k===0){if(!Q.legalMoves(S,i).some(m=>m[0]===a.r&&m[1]===a.c))fail('bot illegal move')}
    else if(!Q.wallOK(S,a.r,a.c,a.o))fail('bot illegal wall');
  }
}
