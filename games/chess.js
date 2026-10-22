/* ===== 체스 게임 모듈 =====
   공통 코드(index.html)가 GAMES.chess의 함수를 불러서 이 게임의 규칙·봇·화면을 그림.
   판: 0x88 배열(128칸). 칸 번호 = 줄*16 + 세로줄 (줄 0 = 1번 줄, 세로줄 0 = a). 기물: 1 폰 2 나이트 3 비숍 4 룩 5 퀸 6 킹, 흑은 +8 (0은 빈 칸)
   두 사람이 하는 게임. 백을 잡은 사람이 먼저 둠. 방 설정: 총 시간 tm(분), 추가 시간 inc(초), 선 플레이어 직접 선택 pickfirst(켜면 방장이 대기실에서 백을 고름)
   무승부: 스테일메이트, 50수(100수 반 동안 폰 이동·잡기 없음), 같은 국면 3번, 기물 부족은 저절로 무승부. 그 밖에 무승부 제안(상대가 받으면 무승부)
   손패(hand)는 카드가 아니라 표시용 값: 공통 코드가 hand가 비면 끝난 사람으로 보기 때문에 게임 중에는 [0]으로 둠 */
(function(){
const G={id:'chess',name:'체스',short:'체스',lead:'클래식 체스와 체스 시계',brand:'체스',brandPx:62,maxHi:2,minN:2,noFast:true,firstPick:true};

/* ---------- 규칙 엔진 (방장 엔진·화면·봇·테스트가 같은 함수를 씀) ---------- */
const PW=1,NN=2,BB=3,RR=4,QQ=5,KK=6;
const FILES='abcdefgh',PCH=' pnbrqk';
const N_D=[33,31,18,14,-33,-31,-18,-14],K_D=[1,-1,16,-16,17,15,-17,-15],B_D=[17,15,-17,-15],R_D=[1,-1,16,-16];
const sqStr=sq=>FILES[sq&7]+((sq>>4)+1);
const strSq=s=>(s.charCodeAt(1)-49)*16+(s.charCodeAt(0)-97);
/* 수: from | to<<7 | 프로모션 기물<<14 | 표시<<17 (1 폰 두 칸, 2 앙파상, 4 캐슬링) */
const mFrom=m=>m&127,mTo=m=>(m>>7)&127,mPro=m=>(m>>14)&7,mFl=m=>m>>17;
const mk=(f,t,p,fl)=>f|(t<<7)|((p||0)<<14)|((fl||0)<<17);
/* 국면 해시(반복 판정·봇 기억표): 32비트 두 줄. 값은 고정 씨앗으로 만들어 모든 기기에서 같음 */
const Z1=new Int32Array(16*128),Z2=new Int32Array(16*128),ZC1=new Int32Array(16),ZC2=new Int32Array(16),ZE1=new Int32Array(8),ZE2=new Int32Array(8);
let ZS1=0,ZS2=0;
{let s=0x2545f491;const r=()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return s|0};
 for(let i=0;i<Z1.length;i++){Z1[i]=r();Z2[i]=r()}
 for(let i=0;i<16;i++){ZC1[i]=r();ZC2[i]=r()}
 for(let i=0;i<8;i++){ZE1[i]=r();ZE2[i]=r()}
 ZS1=r();ZS2=r()}
/* 캐슬링 권리: 1 백 킹쪽, 2 백 퀸쪽, 4 흑 킹쪽, 8 흑 퀸쪽. 그 칸에서 움직이거나 잡히면 권리가 사라짐 */
const CM=new Uint8Array(128).fill(15);CM[0]=13;CM[4]=12;CM[7]=14;CM[112]=7;CM[116]=3;CM[119]=11;
function newPos(){return {b:new Int8Array(128),side:0,castle:0,ep:-1,half:0,full:1,k:[4,116],h1:0,h2:0,st:[]}}
function hashOf(p){
  let a=0,c=0;
  for(let sq=0;sq<128;sq++){if(sq&0x88){sq+=7;continue}const v=p.b[sq];if(v){a^=Z1[v*128+sq];c^=Z2[v*128+sq]}}
  a^=ZC1[p.castle];c^=ZC2[p.castle];
  if(p.ep>=0){a^=ZE1[p.ep&7];c^=ZE2[p.ep&7]}
  if(p.side){a^=ZS1;c^=ZS2}
  p.h1=a;p.h2=c;
}
const START='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
function fromFEN(fen){
  const p=newPos(),f=String(fen||START).trim().split(/\s+/),rows=f[0].split('/');
  for(let r=0;r<8;r++){let c=0;for(const ch of rows[r]||''){
    if(ch>='1'&&ch<='8'){c+=+ch;continue}
    const t=PCH.indexOf(ch.toLowerCase());if(t<1)continue;
    const sq=(7-r)*16+c,v=t|(ch===ch.toLowerCase()?8:0);p.b[sq]=v;if(t===KK)p.k[v>>3]=sq;c++}}
  p.side=f[1]==='b'?1:0;
  p.castle=(f[2]||'').split('').reduce((a,ch)=>a|({K:1,Q:2,k:4,q:8}[ch]||0),0);
  p.ep=f[3]&&f[3]!=='-'?strSq(f[3]):-1;
  p.half=+f[4]||0;p.full=+f[5]||1;
  hashOf(p);return p;
}
function toFEN(p){
  const rows=[];
  for(let r=7;r>=0;r--){let s='',e=0;for(let c=0;c<8;c++){const v=p.b[r*16+c];if(!v){e++;continue}if(e){s+=e;e=0}const ch=PCH[v&7];s+=v&8?ch:ch.toUpperCase()}if(e)s+=e;rows.push(s)}
  const cs=(p.castle&1?'K':'')+(p.castle&2?'Q':'')+(p.castle&4?'k':'')+(p.castle&8?'q':'');
  return `${rows.join('/')} ${p.side?'b':'w'} ${cs||'-'} ${p.ep>=0?sqStr(p.ep):'-'} ${p.half} ${p.full}`;
}
/* sq가 by 색에게 공격받나 */
function attacked(p,sq,by){
  const b=p.b;
  if(by===0){let s=sq-15;if(!(s&0x88)&&b[s]===1)return true;s=sq-17;if(!(s&0x88)&&b[s]===1)return true}
  else{let s=sq+15;if(!(s&0x88)&&b[s]===9)return true;s=sq+17;if(!(s&0x88)&&b[s]===9)return true}
  const o=by<<3,kn=NN|o,kg=KK|o,bi=BB|o,rk=RR|o,qn=QQ|o;
  for(let i=0;i<8;i++){const s=sq+N_D[i];if(!(s&0x88)&&b[s]===kn)return true}
  for(let i=0;i<8;i++){const s=sq+K_D[i];if(!(s&0x88)&&b[s]===kg)return true}
  for(let i=0;i<4;i++){const d=B_D[i];let s=sq+d;while(!(s&0x88)){const v=b[s];if(v){if(v===bi||v===qn)return true;break}s+=d}}
  for(let i=0;i<4;i++){const d=R_D[i];let s=sq+d;while(!(s&0x88)){const v=b[s];if(v){if(v===rk||v===qn)return true;break}s+=d}}
  return false;
}
const inCheck=p=>attacked(p,p.k[p.side],p.side^1);
/* 둘 수 있을지도 모르는 수(킹이 공격받는지는 아직 안 봄). caps면 잡는 수와 프로모션만 (봇의 정리 탐색용) */
function gen(p,out,caps){
  const b=p.b,us=p.side,them=us^1,fw=us?-16:16,start=us?6:1,last=us?0:7;
  for(let sq=0;sq<128;sq++){
    if(sq&0x88){sq+=7;continue}
    const v=b[sq];if(!v||(v>>3)!==us)continue;
    const t=v&7;
    if(t===PW){
      const one=sq+fw;
      if(!(one&0x88)&&!b[one]){
        if((one>>4)===last){out.push(mk(sq,one,QQ));if(!caps){out.push(mk(sq,one,RR),mk(sq,one,BB),mk(sq,one,NN))}}
        else if(!caps){out.push(mk(sq,one));const two=one+fw;if((sq>>4)===start&&!b[two])out.push(mk(sq,two,0,1))}
      }
      for(const d of us?[-15,-17]:[15,17]){
        const s=sq+d;if(s&0x88)continue;const q=b[s];
        if(q&&(q>>3)===them){if((s>>4)===last)out.push(mk(sq,s,QQ),mk(sq,s,RR),mk(sq,s,BB),mk(sq,s,NN));else out.push(mk(sq,s))}
        else if(s===p.ep&&!q)out.push(mk(sq,s,0,2));
      }
    }else if(t===NN||t===KK){
      const D=t===NN?N_D:K_D;
      for(let i=0;i<8;i++){const s=sq+D[i];if(s&0x88)continue;const q=b[s];if(!q){if(!caps)out.push(mk(sq,s))}else if((q>>3)===them)out.push(mk(sq,s))}
      if(t===KK&&!caps){
        const base=us?112:0,o=us<<3;
        if(sq===base+4){
          if(p.castle&(us?4:1)&&b[base+7]===(RR|o)&&!b[base+5]&&!b[base+6]&&!attacked(p,base+4,them)&&!attacked(p,base+5,them)&&!attacked(p,base+6,them))out.push(mk(sq,base+6,0,4));
          if(p.castle&(us?8:2)&&b[base]===(RR|o)&&!b[base+3]&&!b[base+2]&&!b[base+1]&&!attacked(p,base+4,them)&&!attacked(p,base+3,them)&&!attacked(p,base+2,them))out.push(mk(sq,base+2,0,4));
        }
      }
    }else{
      const D=t===BB?B_D:t===RR?R_D:K_D,nd=t===QQ?8:4;
      for(let i=0;i<nd;i++){const d=D[i];let s=sq+d;while(!(s&0x88)){const q=b[s];if(!q){if(!caps)out.push(mk(sq,s))}else{if((q>>3)===them)out.push(mk(sq,s));break}s+=d}}
    }
  }
  return out;
}
/* 수 두기·되돌리기 (봇 탐색이 수만 번 부르므로 판을 그대로 바꾸고 되돌릴 값만 쌓음) */
function make(p,m){
  const b=p.b,from=m&127,to=(m>>7)&127,pr=(m>>14)&7,fl=m>>17,pc=b[from],us=p.side;
  let capSq=to;if(fl&2)capSq=to+(us?16:-16);
  const cap=b[capSq];
  p.st.push(m,cap,p.castle,p.ep,p.half,p.h1,p.h2);
  let a=p.h1,c=p.h2;
  if(p.ep>=0){a^=ZE1[p.ep&7];c^=ZE2[p.ep&7]}
  a^=ZC1[p.castle];c^=ZC2[p.castle];
  a^=Z1[pc*128+from];c^=Z2[pc*128+from];b[from]=0;
  if(cap){b[capSq]=0;a^=Z1[cap*128+capSq];c^=Z2[cap*128+capSq]}
  const np=pr?(pr|(us<<3)):pc;
  b[to]=np;a^=Z1[np*128+to];c^=Z2[np*128+to];
  if(fl&4){const rf=to>from?from+3:from-4,rt=to>from?from+1:from-1,rk=b[rf];b[rf]=0;b[rt]=rk;a^=Z1[rk*128+rf]^Z1[rk*128+rt];c^=Z2[rk*128+rf]^Z2[rk*128+rt]}
  if((pc&7)===KK)p.k[us]=to;
  p.castle&=CM[from]&CM[to];a^=ZC1[p.castle];c^=ZC2[p.castle];
  p.ep=-1;if(fl&1){p.ep=(from+to)>>1;a^=ZE1[p.ep&7];c^=ZE2[p.ep&7]}
  p.half=(pc&7)===PW||cap?0:p.half+1;
  if(us)p.full++;
  p.side=us^1;a^=ZS1;c^=ZS2;
  p.h1=a;p.h2=c;
}
function unmake(p){
  const st=p.st,n=st.length,h2=st[n-1],h1=st[n-2],half=st[n-3],ep=st[n-4],castle=st[n-5],cap=st[n-6],m=st[n-7];st.length=n-7;
  const b=p.b,from=m&127,to=(m>>7)&127,pr=(m>>14)&7,fl=m>>17;
  p.side^=1;const us=p.side;
  const pc=pr?(PW|(us<<3)):b[to];
  b[from]=pc;b[to]=0;
  if(fl&2)b[to+(us?16:-16)]=cap;else b[to]=cap;
  if(fl&4){const rf=to>from?from+3:from-4,rt=to>from?from+1:from-1;b[rf]=b[rt];b[rt]=0}
  if((pc&7)===KK)p.k[us]=from;
  p.castle=castle;p.ep=ep;p.half=half;p.h1=h1;p.h2=h2;if(us)p.full--;
}
/* 아무 일도 없이 차례만 넘기기 (봇의 널 무브 가지치기) */
function makeNull(p){p.st.push(0,0,p.castle,p.ep,p.half,p.h1,p.h2);if(p.ep>=0){p.h1^=ZE1[p.ep&7];p.h2^=ZE2[p.ep&7]}p.ep=-1;p.side^=1;p.h1^=ZS1;p.h2^=ZS2}
function unmakeNull(p){const st=p.st,n=st.length;p.h2=st[n-1];p.h1=st[n-2];p.half=st[n-3];p.ep=st[n-4];p.castle=st[n-5];st.length=n-7;p.side^=1}
/* 정말로 둘 수 있는 수 (킹이 공격받지 않게 남는 수만) */
function legal(p){
  const out=gen(p,[],false),res=[],us=p.side;
  for(const m of out){make(p,m);if(!attacked(p,p.k[us],us^1))res.push(m);unmake(p)}
  return res;
}
function perft(p,d){
  if(!d)return 1;
  const ms=gen(p,[],false),us=p.side;let n=0;
  for(const m of ms){make(p,m);if(!attacked(p,p.k[us],us^1))n+=d===1?1:perft(p,d-1);unmake(p)}
  return n;
}
/* 앙파상을 실제로 할 수 있을 때만 국면이 다름 (반복 판정용 열쇠) */
function repKey(p){
  let a=p.h1,c=p.h2;
  if(p.ep>=0){
    const us=p.side,pw=PW|(us<<3),s1=p.ep+(us?15:-15),s2=p.ep+(us?17:-17);
    let can=false;
    for(const s of [s1,s2])if(!(s&0x88)&&p.b[s]===pw){const m=mk(s,p.ep,0,2);make(p,m);if(!attacked(p,p.k[us],us^1))can=true;unmake(p)}
    if(!can){a^=ZE1[p.ep&7];c^=ZE2[p.ep&7]}
  }
  return (a>>>0).toString(36)+'.'+(c>>>0).toString(36);
}
/* 기물 부족: 어느 쪽도 체크메이트를 할 수 없음 (킹끼리, 킹+나이트나 비숍 하나, 같은 색 칸 비숍들뿐) */
function deadDraw(p){
  let minors=0,knights=0,bsq=[0,0];
  for(let sq=0;sq<128;sq++){
    if(sq&0x88){sq+=7;continue}
    const t=p.b[sq]&7;if(!t||t===KK)continue;
    if(t===PW||t===RR||t===QQ)return false;
    minors++;if(t===NN)knights++;else bsq[((sq>>4)+(sq&7))&1]++;
  }
  if(minors<=1)return true;
  return !knights&&(!bsq[0]||!bsq[1]);
}
/* 기보 표기(SAN): Nf3, exd5, O-O, e8=Q+, Qxf7# */
function san(p,m,ls){
  const from=mFrom(m),to=mTo(m),pr=mPro(m),fl=mFl(m),pc=p.b[from],t=pc&7;
  let s;
  if(fl&4)s=to>from?'O-O':'O-O-O';
  else{
    const cap=p.b[to]||(fl&2);
    if(t===PW)s=(cap?FILES[from&7]+'x':'')+sqStr(to)+(pr?'='+PCH[pr].toUpperCase():'');
    else{
      const same=(ls||legal(p)).filter(x=>x!==m&&mTo(x)===to&&p.b[mFrom(x)]===pc);
      let dis='';
      if(same.length){const f=same.some(x=>(mFrom(x)&7)===(from&7)),r=same.some(x=>(mFrom(x)>>4)===(from>>4));dis=!f?FILES[from&7]:!r?String((from>>4)+1):sqStr(from)}
      s=PCH[t].toUpperCase()+dis+(cap?'x':'')+sqStr(to);
    }
  }
  make(p,m);
  if(inCheck(p))s+=legal(p).length?'+':'#';
  unmake(p);
  return s;
}
/* 'e2e4', 'e7e8q' 꼴의 수를 이 국면의 수로 (없으면 0) */
function fromUci(p,u,ls){
  if(typeof u!=='string'||u.length<4)return 0;
  const f=strSq(u.slice(0,2)),t=strSq(u.slice(2,4)),pr=u[4]?PCH.indexOf(u[4]):0;
  for(const m of ls||legal(p))if(mFrom(m)===f&&mTo(m)===t&&mPro(m)===(pr>0?pr:0))return m;
  return 0;
}
const toUci=m=>sqStr(mFrom(m))+sqStr(mTo(m))+(mPro(m)?PCH[mPro(m)]:'');
/* 기보(수 목록)를 처음부터 다시 두어 지금 국면과 반복 횟수를 만듦 */
function replay(ucis,fen){
  const p=fromFEN(fen||START),reps={};
  const bump=()=>{const k=repKey(p);reps[k]=(reps[k]||0)+1;return reps[k]};
  bump();
  for(const u of ucis||[]){const m=fromUci(p,u);if(!m)break;make(p,m);p.st.length=0;bump()}
  return {p,reps};
}
/* 지금 국면이 끝났나: 'mate' 체크메이트, 'stale' 스테일메이트, 'fifty' 50수, 'rep' 3번 반복, 'dead' 기물 부족, '' 계속 */
function endOf(p,repN){
  const ls=legal(p);
  if(!ls.length)return inCheck(p)?'mate':'stale';
  if(repN>=3)return 'rep';
  if(p.half>=100)return 'fifty';
  if(deadDraw(p))return 'dead';
  return '';
}

/* ---------- 봇 (임시: 알파-베타 탐색 + 기물 값·자리 점수. 강한 봇은 따로 만듦) ---------- */
const VAL=[0,100,320,330,500,900,0];
/* 자리 점수 (백 기준, 위가 8번 줄). 흑은 위아래를 뒤집어 씀 */
const PST=[[],
 [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
 [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30, -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
 [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10, -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
 [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
 [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
 [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10, 20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20]];
const KEND=[-50,-40,-30,-20,-20,-30,-40,-50, -30,-20,-10,0,0,-10,-20,-30, -30,-10,20,30,30,20,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,20,30,30,20,-10,-30, -30,-30,0,0,0,0,-30,-30, -50,-30,-30,-30,-30,-30,-30,-50];
const pstIdx=(sq,col)=>col?(sq>>4)*8+(sq&7):(7-(sq>>4))*8+(sq&7);
/* 국면 점수 (지금 둘 차례인 쪽 기준) */
function evalPos(p){
  const b=p.b;let s=0,mat=0;
  for(let sq=0;sq<128;sq++){if(sq&0x88){sq+=7;continue}const v=b[sq];if(v&&(v&7)!==KK&&(v&7)!==PW)mat+=VAL[v&7]}
  const end=mat<=1600;
  for(let sq=0;sq<128;sq++){
    if(sq&0x88){sq+=7;continue}
    const v=b[sq];if(!v)continue;
    const t=v&7,col=v>>3,i=pstIdx(sq,col);
    const x=VAL[t]+(t===KK&&end?KEND[i]:PST[t][i]);
    s+=col?-x:x;
  }
  return p.side?-s:s;
}
const MATE=30000;
const TTN=1<<16,TT={h:new Int32Array(TTN),d:new Int8Array(TTN),v:new Int32Array(TTN),f:new Int8Array(TTN),m:new Int32Array(TTN)};
/* 탐색: 반복 심화 + 알파-베타 + 잡는 수 끝까지(정리 탐색). 노드 수로 끊음 (방장 화면이 멈추지 않게) */
function search(p,opt){
  const maxD=opt.depth||6,budget=opt.nodes||40000,hist=opt.hist||{};
  let nodes=0,stop=false;const killers=[];
  const path=[];
  const order=(ms,ply,tm)=>{
    const sc=ms.map(m=>{
      if(m===tm)return 1e6;
      const v=p.b[mTo(m)];let s=0;
      if(v)s=10000+VAL[v&7]*10-VAL[p.b[mFrom(m)]&7];
      else if(mFl(m)&2)s=10000+1000;
      if(mPro(m))s+=8000+VAL[mPro(m)];
      if(killers[ply]&&killers[ply].includes(m))s+=5000;
      return s;
    });
    const idx=ms.map((_,i)=>i).sort((a,b)=>sc[b]-sc[a]);return idx.map(i=>ms[i]);
  };
  function qs(alpha,beta,ply){
    nodes++;
    const st=evalPos(p);if(st>=beta)return st;if(st>alpha)alpha=st;
    const ms=order(gen(p,[],true),ply,0),us=p.side;
    for(const m of ms){
      make(p,m);if(attacked(p,p.k[us],us^1)){unmake(p);continue}
      const v=-qs(-beta,-alpha,ply+1);unmake(p);
      if(v>=beta)return v;if(v>alpha)alpha=v;
    }
    return alpha;
  }
  function ab(d,alpha,beta,ply,nullOk){
    if((++nodes&1023)===0&&nodes>budget)stop=true;
    if(stop)return 0;
    const key=repKey0(p);
    if(ply&&(path.includes(key)||hist[key]>=1))return 0;   // 반복은 무승부로 봄
    if(ply&&p.half>=100)return 0;
    const chk=inCheck(p);if(chk)d++;
    if(d<=0)return qs(alpha,beta,ply);
    const ti=p.h1&(TTN-1);let tm=0;
    if(TT.h[ti]===p.h2){tm=TT.m[ti];if(ply&&TT.d[ti]>=d){const v=TT.v[ti],f=TT.f[ti];if(f===0||(f===1&&v>=beta)||(f===2&&v<=alpha))return v}}
    // 널 무브: 차례를 넘겨도 beta 이상이면 가지치기 (체크 중·끝내기 근처는 안 함)
    if(nullOk&&!chk&&d>=3&&ply&&evalPos(p)>=beta){
      let big=0;for(let sq=0;sq<128;sq++){if(sq&0x88){sq+=7;continue}const v=p.b[sq];if(v&&(v>>3)===p.side&&(v&7)>PW&&(v&7)<KK){big=1;break}}
      if(big){makeNull(p);const v=-ab(d-3,-beta,-beta+1,ply+1,false);unmakeNull(p);if(stop)return 0;if(v>=beta)return beta}
    }
    path.push(key);
    const ms=order(gen(p,[],false),ply,tm),us=p.side,a0=alpha;let best=-MATE*2,bm=0,n=0;
    for(const m of ms){
      make(p,m);if(attacked(p,p.k[us],us^1)){unmake(p);continue}
      n++;
      let v;
      if(n>1){v=-ab(d-1,-alpha-1,-alpha,ply+1,true);if(v>alpha&&v<beta)v=-ab(d-1,-beta,-alpha,ply+1,true)}
      else v=-ab(d-1,-beta,-alpha,ply+1,true);
      unmake(p);
      if(stop){path.pop();return 0}
      if(v>best){best=v;bm=m}
      if(v>alpha)alpha=v;
      if(alpha>=beta){if(!p.b[mTo(m)]){(killers[ply]||(killers[ply]=[])).unshift(m);killers[ply].length=Math.min(2,killers[ply].length)}break}
    }
    path.pop();
    if(!n)return chk?-MATE+ply:0;
    TT.h[ti]=p.h2;TT.d[ti]=d;TT.v[ti]=best;TT.m[ti]=bm;TT.f[ti]=best>=beta?1:best<=a0?2:0;
    return best;
  }
  const root=legal(p);if(!root.length)return {m:0,v:0};
  let bestM=root[0],bestV=0;
  for(let d=1;d<=maxD&&!stop;d++){
    let alpha=-MATE*2,cur=0,cv=-MATE*2;
    const ms=order(root,0,bestM);
    const scored=[];
    for(const m of ms){
      make(p,m);
      const v=-ab(d-1,-MATE*2,-alpha+(opt.noise?opt.noise:0),1,true);
      unmake(p);
      if(stop)break;
      scored.push([m,v]);
      if(v>cv){cv=v;cur=m}
      if(v>alpha)alpha=v;
    }
    if(!stop||(cur&&d===1)){bestM=cur;bestV=cv;if(opt.noise&&scored.length&&Math.abs(cv)<MATE-100){const ok=scored.filter(x=>x[1]>cv-opt.noise);const x=ok[Math.random()*ok.length|0];bestM=x[0];bestV=x[1]}}
    if(Math.abs(bestV)>MATE-100)break;
  }
  return {m:bestM,v:bestV,nodes};
}
const repKey0=p=>(p.h1>>>0).toString(36)+'.'+(p.h2>>>0).toString(36);   // 앙파상이 없는 국면이면 repKey와 같은 값 (지난 기보의 반복도 알아봄)
/* 봇의 한 수: lv 0 쉬움(얕게 + 흔들림), 1 보통, 2 어려움 */
function botPick(p,lv,hist){
  const ls=legal(p);if(!ls.length)return 0;
  if(lv===0&&Math.random()<.12)return ls[Math.random()*ls.length|0];
  const o=lv===0?{depth:2,nodes:4000,noise:70}:lv===1?{depth:4,nodes:20000,noise:12}:{depth:8,nodes:90000,noise:0};
  const h={};for(const k in hist||{})h[k]=1;
  return search(p,{...o,hist:h}).m||ls[0];
}
/* 봇이 무승부 제안을 받을까: 지고 있거나, 오래 둔 비슷한 판 */
function botTakesDraw(p,lv,ply){
  const v=search(p,{depth:lv===2?4:2,nodes:8000}).v;
  return v<=-150||(Math.abs(v)<=30&&ply>=60);
}

/* ---------- 규칙 설명·방 설정 ---------- */
G.rulesHTML='<ol class="rules"><li><b>목표</b> : 상대 킹을 잡을 수밖에 없게 몰면(<b>체크메이트</b>) 이깁니다. 백이 먼저 두고 번갈아 한 수씩 둡니다</li><li><b>기물</b> : 킹은 한 칸, 퀸은 모든 방향으로 끝까지, 룩은 가로·세로, 비숍은 대각선, 나이트는 L자(다른 기물을 뛰어넘음), 폰은 앞으로 한 칸(처음에는 두 칸)이고 잡을 때는 대각선 앞으로 갑니다</li><li><b>체크</b> : 킹이 공격받으면 킹 칸이 붉게 빛납니다. 체크를 풀지 않는 수는 둘 수 없습니다</li><li><b>캐슬링</b> : 킹과 룩이 한 번도 움직이지 않았고 사이가 비어 있으면, 킹을 룩 쪽으로 두 칸 옮기고 룩을 킹 너머로 넘깁니다. 체크 중이거나 킹이 지나가는 칸이 공격받으면 할 수 없습니다</li><li><b>앙파상</b> : 상대 폰이 두 칸 나와 내 폰 바로 옆에 서면, 바로 다음 수에 한 칸만 나온 것처럼 대각선으로 잡을 수 있습니다</li><li><b>프로모션</b> : 폰이 끝 줄에 닿으면 퀸·룩·비숍·나이트 중 하나로 바뀝니다</li><li><b>무승부</b> : 둘 수 있는 수가 없는데 체크가 아니면(<b>스테일메이트</b>), 같은 국면이 세 번 나오면, 50수 동안 폰이 움직이지 않고 잡힌 기물도 없으면, 어느 쪽도 체크메이트를 할 수 없는 기물만 남으면 저절로 무승부입니다. 위쪽 내 이름 칸을 눌러 <b>무승부 제안</b>을 할 수 있고, 상대가 받으면 무승부, 상대가 그냥 두면 없던 일이 됩니다</li><li><b>시계</b> : 두 사람이 각자의 총 시간을 쓰는 체스 시계입니다. 한 수를 둘 때마다 추가 시간이 붙고, 총 시간을 다 쓰면 <b>패배</b>합니다. 이때 상대에게 체크메이트할 기물이 없으면 무승부입니다. 연결이 끊겨도 시계는 흐르고, 45초 안에 돌아오지 않으면 탈주로 처리합니다</li><li><b>선 플레이어</b> : 첫 판은 탁자 설정으로 정합니다(직접 고르기를 켜면 방장이 대기실에서 백을 고름). 결과 화면에서 바로 시작하면 서로 색을 바꿉니다</li><li><b>조작</b> : 내 기물을 누르면 갈 수 있는 칸에 점(잡을 수 있는 칸은 고리)이 보입니다. 칸을 누르면 미리 보기, <b>[두기]</b>로 확정합니다. 설정의 <b>두 번 눌러 놓기</b>를 켜면 같은 칸을 한 번 더 눌러 바로 둡니다. 상대 차례에도 미리 골라 둘 수 있습니다</li><li><b>기보</b> : 게임이 끝나면 기보(PGN)를 복사해 다른 체스 사이트에 붙여 넣을 수 있습니다</li></ol>';
G.modeDesc=['체크메이트하면 끝','체크메이트하면 끝'];
const clockTxt=c=>`${+c.tm||3}+${+c.inc||0}`;
G.defaults={max:2,turn:30,tm:3,inc:2,pickfirst:0};
G.roomSet=[
  {k:'tm',label:'총 시간',unit:'분',lo:1,hi:60,step:1,desc:'한 사람이 쓸 수 있는 전체 시간입니다. 다 쓰면 패배합니다'},
  {k:'inc',label:'추가 시간',unit:'초',lo:0,hi:30,step:1,desc:'한 수를 둘 때마다 늘어나는 시간입니다'}];
G.ruleSet=[{k:'pickfirst',label:'선 직접 고르기',desc:'켜면 방장이 대기실에서 백(먼저 두는 사람)을 고릅니다. 끄면 랜덤이고, 바로 시작하면 색을 바꿉니다'}];
G.cfgChips=c=>`<span class="chip">시계 <b>${clockTxt(c)}</b></span><span class="chip">선 <b>${+c.pickfirst?'방장 선택':'랜덤'}</b></span>`;
G.cfgSum=c=>`시계 ${+c.tm||3}분 + ${+c.inc||0}초 · 선 ${+c.pickfirst?'방장 선택':'랜덤'}`;
G.roomSub=()=>'2명 보드게임';
G.pubExtra=()=>({});
G.cardInfo=(c,nowN)=>`<p class="cardinfo">${nowN>2?'체스는 두 명이 하는 게임입니다.':'두 명이 하는 게임입니다.'}</p>`;
G.rankTitle=()=>'';
G.finLabel=()=>'';
G.noEmotes=['gq'];
G.keys={};
G.keyActions=[];
G.cardHTML=()=>'';G.drawFace=()=>{};G.cmpCard=()=>0;G.labelOf=()=>'';

/* ---------- 방장 엔진 (규칙 처리) ----------
   H.c: 저장할 수 있는 값만 둠(JSON). 지금 국면은 기보를 다시 두어 만들고 아래 HC에 기억해 둠 */
const CNAME=['백','흑'];
const HC={c:null,n:-1,p:null,reps:null};
function hostPos(){
  const C=H.c;
  if(HC.c!==C||HC.n!==C.mv.length){const r=replay(C.mv);HC.c=C;HC.n=C.mv.length;HC.p=r.p;HC.reps=r.reps}
  return HC.p;
}
const other=i=>1-i;
const seatOfColor=col=>H.c.co[0]===col?0:1;
function sameNames(a,b){return a.length===2&&b.length===2&&a.every(x=>b.includes(x))&&a[0]!==a[1]}
/* 첫 판 백: 결과 화면에서 바로 시작하면 지난 판과 색을 바꿈, 아니면 공통 firstSeat (직접 고르기면 방장이 고른 사람, 아니면 랜덤) */
function pickWhite(again){
  const ns=H.players.slice(0,2).map(p=>p.name),L=H.cLast;
  if(again&&L&&L.ns&&sameNames(ns,L.ns))return ns.indexOf(L.b);
  return typeof firstSeat==='function'?firstSeat(2):(Math.random()<.5?0:1);
}
function setMover(to,inc){
  const C=H.c,t=clock(),from=C.mv_;
  const cur=H.players[from];
  if(cur&&!cur.bot)C.rem[from]=Math.max(0,C.rem[from]-Math.max(0,t-C.since));   // 사람이 쓴 시간만 깎음 (봇·봇이 맡은 자리는 시계가 안 감)
  if(inc&&from!==to&&cur&&!cur.bot)C.rem[from]+=C.R.inc*1000;
  C.mv_=to;H.turn=to;C.since=t;
  const nx=H.players[to];C.mvBot=nx&&nx.bot?1:0;
  H.botActAt=nx&&nx.bot?t+rand(500,1300):0;
  mark();
}
/* 기물이 킹 말고 나이트나 비숍 하나뿐이면 혼자서는 체크메이트를 할 수 없음 (시간 초과 무승부 판정) */
function cantMate(p,col){
  let n=0,big=false;
  for(let sq=0;sq<128;sq++){if(sq&0x88){sq+=7;continue}const v=p.b[sq];if(!v||(v>>3)!==col||(v&7)===KK)continue;const t=v&7;if(t===PW||t===RR||t===QQ)big=true;else n++}
  return !big&&n<=1;
}
const WHY_TXT={mate:'체크메이트',time:'시간 초과',surrender:'항복',desert:'탈주',stale:'스테일메이트',rep:'같은 국면 3번',fifty:'50수 규칙',dead:'기물 부족',agree:'합의',tdead:'시간 초과 · 기물 부족'};
function finishGame(winSeat,why){
  const C=H.c;
  C.res={w:winSeat,why:why||''};C.dr=-1;
  if(winSeat>=0){
    const l=other(winSeat),pw=H.players[winSeat],pl=H.players[l];
    pw.finished=true;pw.rank=1;pw.hand=[];
    pl.finished=true;pl.rank=2;pl.hand=[];
    if(why==='time')pl.surrendered='time';else if(why==='surrender'||why==='desert')pl.surrendered=true;
    addLog(why==='time'?`${pl.name} 시간 초과로 패배! ${pw.name} 승리`:why==='surrender'||why==='desert'?`${pl.name} ${why==='desert'?'탈주':'항복'}! ${pw.name} 승리`:`체크메이트! ${pw.name} 승리 (${CNAME[C.co[winSeat]]})`,why==='mate'?'fin':'lie');
  }else{
    for(const i of [0,1]){const p=H.players[i];p.finished=true;p.rank=1;p.hand=[]}
    addLog(`무승부입니다. (${WHY_TXT[why]||''})`,'sys');
  }
  H.cLast={ns:H.players.slice(0,2).map(p=>p.name),b:H.players[seatOfColor(1)].name};   // 바로 시작하면 지난 판의 흑이 백
  H.phase='over';H.botActAt=0;mark();
  H.players.forEach((p,i)=>{if(p.bot&&i<2&&Math.random()<.5)botEmote(i,'gg',800+Math.random()*1600)});
}
/* 한 수: 기보에 더하고, 잡은 기물·체크·끝 판정 */
function doMove(seat,u){
  const C=H.c,p=hostPos();
  if(C.co[seat]!==p.side)return false;
  const ls=legal(p),m=fromUci(p,u,ls);if(!m)return false;
  const s=san(p,m,ls),cap=p.b[mTo(m)]||(mFl(m)&2?(PW|((p.side^1)<<3)):0),no=p.full,side=p.side;
  make(p,m);p.st.length=0;
  C.mv.push(toUci(m));C.sn.push(s);HC.n=C.mv.length;
  const k=repKey(p);HC.reps[k]=(HC.reps[k]||0)+1;
  if(cap)C.cp[seat].push(cap&7);
  C.lm=[mFrom(m),mTo(m)];C.fen=toFEN(p);C.chk=inCheck(p)?1:0;
  if(C.dr===other(seat))C.dr=-1;   // 제안을 받은 사람이 그냥 두면 없던 일
  addLog(`${no}.${side?'..':''} ${H.players[seat].name} ${s}`);
  const end=endOf(p,HC.reps[k]);
  if(end==='mate'){finishGame(seat,'mate');return true}
  if(end){finishGame(-1,end);return true}
  setMover(other(seat),true);
  return true;
}
function doSurrender(seat){
  if(H.phase!=='play'||seat<0||seat>1||H.players[seat].finished)return;
  finishGame(other(seat),H.players[seat].deserter?'desert':'surrender');
}
/* 무승부 제안: 내 제안이 없으면 제안(다시 누르면 거둠), 상대 제안이 있으면 받음 */
function doDraw(seat){
  const C=H.c;
  if(H.phase!=='play'||seat<0||seat>1)return;
  if(C.dr===other(seat)){addLog(`${H.players[seat].name} 무승부 제안을 받았습니다.`,'sys');finishGame(-1,'agree');return}
  if(C.dr===seat){C.dr=-1;mark();return}
  if(C.drN[seat]>=3)return;   // 한 판에 세 번까지 (계속 눌러 귀찮게 하지 않게)
  C.dr=seat;C.drN[seat]++;C.drAt=clock();
  addLog(`${H.players[seat].name} 무승부를 제안합니다.`,'sys');
  const o=H.players[other(seat)];if(o&&o.bot&&!awayHuman(o))C.drBot=clock()+rand(1200,2400);
  mark();
}
function timeout(){
  const C=H.c,i=C.mv_,p=hostPos();
  if(cantMate(p,C.co[other(i)]))finishGame(-1,'tdead');
  else finishGame(other(i),'time');
}
function botTurn(i){
  const C=H.c,p=hostPos(),lv=botLv(H.players[i]);
  const m=botPick(p,lv,HC.reps);
  if(!m||!doMove(i,toUci(m)))finishGame(-1,'stale');
}
G._test={fromFEN,toFEN,legal,perft,make,unmake,san,fromUci,toUci,replay,endOf,deadDraw,repKey,inCheck,attacked,evalPos,search,botPick,cantMate,doMove,doDraw,doSurrender,timeout,pickWhite,START,sqStr,strSq,mFrom,mTo,mPro,recordText:v=>recordText(v)};
G.engine={
  start(){
    const again=H.phase==='over',R={tm:Math.max(1,+H.cfg.tm||3),inc:Math.max(0,+H.cfg.inc||0)};
    Object.assign(H,{phase:'play',log:[],seatNote:{},field:[],last:null,reveal:null,shouts:[],pending:null,rankNext:1,known:{}});
    H.players.forEach((p,i)=>{
      p.finished=false;p.rank=null;p.surrendered=false;
      if(i<2)p.hand=[0];else{p.hand=[];p.finished=true;p.rank=i+1}
    });
    const W=pickWhite(again),t=clock();
    H.c={R,A:W,co:W===0?[0,1]:[1,0],mv:[],sn:[],cp:[[],[]],fen:START,lm:null,chk:0,mv_:W,rem:[R.tm*60000,R.tm*60000],since:t,mvBot:H.players[W].bot?1:0,res:null,dr:-1,drN:[0,0],drAt:0,drBot:0};
    HC.c=null;H.turn=W;
    H.botActAt=H.players[W].bot?t+rand(900,1800):0;
    addLog(`${H.players[W].name}님이 백으로 먼저 시작합니다.`,'sys');
    mark();
  },
  act(seat,a){
    if(a.t==='surrender'){doSurrender(seat);return}
    const C=H.c;
    if(!C||H.phase!=='play'||seat<0||seat>1)return;
    if(a.t==='draw'){doDraw(seat);return}
    if(a.t==='mv'&&C.mv_===seat&&typeof a.u==='string')doMove(seat,a.u);
  },
  tick(t){
    const C=H.c;
    if(!C||H.phase!=='play')return;
    // 봇이 무승부 제안을 받았으면 잠시 뒤 답함
    if(C.dr>=0&&C.drBot&&t>=C.drBot){
      const r=other(C.dr),p=H.players[r];C.drBot=0;
      if(p&&p.bot&&!awayHuman(p)){
        const q=hostPos(),flip=q.side!==C.co[r];
        let take=false;
        if(flip){makeNull(q);take=botTakesDraw(q,botLv(p),C.mv.length);unmakeNull(q)}else take=botTakesDraw(q,botLv(p),C.mv.length);
        if(take){addLog(`${p.name} 무승부 제안을 받았습니다.`,'sys');finishGame(-1,'agree');return}
        C.dr=-1;addLog(`${p.name} 무승부 제안을 거절했습니다.`,'sys');mark();
      }
    }
    const p=H.players[C.mv_];if(!p)return;
    if(p.bot&&!awayHuman(p)){
      if(!C.mvBot){C.rem[C.mv_]=Math.max(0,C.rem[C.mv_]-Math.max(0,t-C.since));C.mvBot=1}
      C.since=t;
      if(H.botActAt&&t>=H.botActAt&&!(p.away&&t<p.awayAt+AWAY_WAIT))botTurn(C.mv_);
      return;
    }
    if(C.mvBot){C.mvBot=0;C.since=t}
    if(C.rem[C.mv_]-Math.max(0,t-C.since)<=0)timeout();
  },
  snap(s,you,t){
    const C=H.c,p=H.players[C.mv_],run=H.phase==='play'&&p&&(!p.bot||awayHuman(p))?1:0;
    const el=run?Math.max(0,t-C.since):0,rem=C.rem.map((v,i)=>Math.max(0,Math.round(v-(run&&i===C.mv_?el:0))));
    s.c={fen:C.fen,mv:C.mv.slice(),sn:C.sn.slice(),cp:C.cp.map(a=>a.slice()),A:C.A,co:C.co.slice(),lm:C.lm?C.lm.slice():null,chk:C.chk,rem,run,hold:run?Math.max(0,Math.round(C.since-t)):0,R:{...C.R},res:C.res?{...C.res}:null,dr:C.dr,drN:C.drN.slice()};
    s.gr=0;s.dl=rem[C.mv_];
  },
  restore(ms){if(H.c&&ms)H.c.since+=ms},
  emoPhase:ph=>ph==='play'||ph==='over'
};

/* 기보 (PGN): 다른 체스 사이트에 그대로 붙여 넣을 수 있게 */
function recordText(v){
  const c=v.c,name=i=>v.ps[i]?v.ps[i].n:'?',wi=c.co[0]===0?0:1,bi=1-wi;
  const d=new Date(),ds=`${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
  let res='*';
  if(v.st==='over'&&c.res)res=c.res.w<0?'1/2-1/2':c.co[c.res.w]===0?'1-0':'0-1';
  const term=c.res?({time:'Time forfeit',tdead:'Time forfeit',surrender:'Resignation',desert:'Abandoned',agree:'Agreement',rep:'Threefold repetition',fifty:'50-move rule',dead:'Insufficient material',stale:'Stalemate',mate:'Checkmate'})[c.res.why]||'':'';
  const tags=[['Event','탁자하나 체스'],['Site','https://ruzoa.github.io/gura/'],['Date',ds],['White',name(wi)],['Black',name(bi)],['Result',res],['TimeControl',`${c.R.tm*60}+${c.R.inc}`]];
  if(term)tags.push(['Termination',term]);
  const mv=[];c.sn.forEach((s,i)=>{if(i%2===0)mv.push(`${i/2+1}.`);mv.push(s)});
  mv.push(res);
  const lines=[];let line='';
  for(const w of mv){if(line&&(line+' '+w).length>78){lines.push(line);line=w}else line=line?line+' '+w:w}
  if(line)lines.push(line);
  return tags.map(([k,x])=>`[${k} "${String(x).replace(/"/g,"'")}"]`).join('\n')+'\n\n'+lines.join('\n');
}

/* ---------- 화면 (모든 참가자) ----------
   2D(SVG)와 3D(공통 테이블 가운데 체스판 + 클래식 기물)는 같은 상태(CS)를 보고 그림. 흑을 잡으면 판을 돌려 내 기물이 늘 아래 */
let CS=null,sel=-1,pend=null,proP=QQ,msg='',msgUntil=0,msgTimer=null,flash=null,popOpen=false;   // CS: 지금 판, sel: 고른 내 기물 칸, pend: 미리 보기로 고른 수 {m,from,to,pro}, proP: 프로모션으로 고를 기물
let elCh=null,elSvg=null,elMain=null,elGhost=null,elBar=null,elHint=null,elModes=null,lastBoard='',lastBar='',lastHint='',lastModes='';
const OC={at:0,mk:'',ms:[]};   // OC.at: 상태를 받은 시각, mk·ms: 내가 둘 수 있는 수 캐시
function buildS(c){
  const p=fromFEN(c.fen);
  return {p,co:c.co,A:c.A,lm:c.lm,chk:c.chk,rem:c.rem,run:c.run,hold:c.hold,res:c.res,dr:c.dr,drN:c.drN||[0,0],cp:c.cp||[[],[]],sn:c.sn||[],mv:c.mv||[],R:c.R};
}
const myCol=()=>{const me=myIdx();return me>=0&&me<2&&CS?CS.co[me]:-1};
const flipped=()=>myCol()===1;   // 흑을 잡으면 판을 돌림 (관전은 백 쪽에서)
const myTurnNow=()=>!!(V&&V.c&&V.st==='play'&&myReady());
const dblOn=()=>typeof dblTap!=='undefined'&&!!dblTap;
function say(txt){msg=txt;msgUntil=Date.now()+2400;drawHint();clearTimeout(msgTimer);msgTimer=setTimeout(drawHint,2500)}
function remMs(i){
  const c=V&&V.c;if(!c)return 0;
  let v=c.rem[i];
  if(V.st==='play'&&c.run&&V.t===i){const e=clock()-OC.at-(c.hold||0);if(e>0)v-=e}
  return Math.max(0,v);
}
function fmtT(ms){
  if(ms<10000&&ms>0){return (Math.floor(ms/100)/10).toFixed(1)}   // 10초 아래는 0.1초까지
  const s=Math.ceil(ms/1000),m=Math.floor(s/60);return m+':'+String(s%60).padStart(2,'0');
}
/* 미리 고를 수 있나: 내 차례, 또는 상대 차례(내 색으로 미리 골라 둠) */
const canPre=()=>{const me=myIdx();return !!(V&&V.c&&CS&&V.st==='play'&&me>=0&&me<2&&!introWait()&&!(V.ps[me]&&V.ps[me].f))};
/* 내 기물이 둘 수 있는 수: 내 차례면 지금 국면, 상대 차례면 내 차례라고 치고 계산 (미리 고르기) */
function myMoves(){
  if(!canPre())return [];
  const col=myCol(),k=V.c.fen+'|'+col;
  if(OC.mk!==k){
    OC.mk=k;
    if(CS.p.side===col)OC.ms=legal(CS.p);
    else{const q=fromFEN(V.c.fen);q.side=col;q.ep=-1;hashOf(q);OC.ms=legal(q)}
  }
  return OC.ms;
}
const movesFrom=sq=>myMoves().filter(m=>mFrom(m)===sq);
const pcAt=sq=>CS?CS.p.b[sq]:0;
/* 기물을 못 움직이는 까닭: 체크하는 상대 기물·핀을 건 상대 기물 (잠깐 붉게). 그냥 막혀 있으면 빈 목록 */
function blockers(sq){
  const col=pcAt(sq)>>3,them=col^1,q=fromFEN(V.c.fen),ks=q.k[col],out=[];
  if((q.b[sq]&7)===KK)return out;
  for(let s=0;s<128;s++){
    if(s&0x88){s+=7;continue}
    const v=q.b[s];if(!v||(v>>3)!==them)continue;
    if(attackFrom(q,s,ks)){out.push(s);continue}
    const keep=q.b[sq];q.b[sq]=0;const pin=attackFrom(q,s,ks);q.b[sq]=keep;if(pin)out.push(s);
  }
  return out;
}
/* s의 기물이 t 칸을 공격하나 */
function attackFrom(q,s,t){
  const v=q.b[s],ty=v&7,col=v>>3,d=t-s;
  if(ty===PW)return col?(d===-15||d===-17):(d===15||d===17);
  if(ty===NN)return N_D.includes(d);
  if(ty===KK)return K_D.includes(d);
  const D=ty===BB?B_D:ty===RR?R_D:K_D;
  for(const dd of D){let x=s+dd;while(!(x&0x88)){if(x===t)return true;if(q.b[x])break;x+=dd}}
  return false;
}
/* 칸을 눌렀을 때: 내 기물이면 고르고(다시 누르면 내려놓음), 갈 수 있는 칸이면 미리 보기, 미리 보기 칸을 다시 누르면 두 번 눌러 놓기면 둠 */
function tapSq(sq){
  if(!V||!V.c||V.st!=='play'||!CS)return;
  if(sq<0||(sq&0x88))return;
  if(!canPre()){sndNo();return}
  const col=myCol(),v=pcAt(sq),mine=myTurnNow();
  if(pend&&pend.to===sq){if(dblOn()&&mine)confirmPend();else{pend=null;sndLift(.08);redraw()}return}
  if(v&&(v>>3)===col){
    if(sel===sq&&!pend){sel=-1;sndLift(.06);redraw();return}
    const ms=movesFrom(sq);
    if(!ms.length){sel=-1;pend=null;const bl=blockers(sq);flash={sq:[...bl,...(bl.length?[]:[sq])],at:clock()};sndNo();redraw();return}
    sel=sq;pend=null;sndLift(.14);redraw();return;
  }
  if(sel>=0){
    const ms=movesFrom(sel).filter(m=>mTo(m)===sq);
    if(ms.length){
      const isPro=ms.some(m=>mPro(m));
      const m=isPro?ms.find(x=>mPro(x)===proP)||ms[0]:ms[0];
      pend={m,from:sel,to:sq,pro:isPro};sndLift(.1);redraw();return;
    }
  }
  sndNo();
}
function confirmPend(){
  if(!pend||!myTurnNow())return;
  let m=pend.m;
  if(pend.pro){const ms=movesFrom(pend.from).filter(x=>mTo(x)===pend.to&&mPro(x)===proP);if(ms.length)m=ms[0]}
  // 상대 차례에 골라 둔 수는 지금 국면에서 다시 확인
  const ok=legal(CS.p).find(x=>x===m);
  if(!ok){pend=null;sel=-1;sndNo();redraw();return}
  pend=null;sel=-1;
  sendAct({t:'mv',u:toUci(m)});redraw();
}
function cancelSel(){if(pend){pend=null}else sel=-1;redraw()}
function setPro(t){proP=t;if(pend&&pend.pro){const ms=movesFrom(pend.from).filter(x=>mTo(x)===pend.to&&mPro(x)===t);if(ms.length)pend.m=ms[0]}sndLift(.08);redraw()}
function sendDraw(){if(V&&V.c&&V.st==='play'&&myIdx()>=0&&myIdx()<2){sendAct({t:'draw'});popOpen=false;drawAll()}}
function redraw(){msgUntil=0;drawAll();G.buttons();Ch3.dirty=true;ch3Marks()}
/* 소리: 기물을 드는 소리(나무 톡), 두는 소리(나무판에 탁), 잡는 소리, 체크 */
function sndLift(vol){tone(1250,.03,{type:'triangle',vol:vol*.5});hiss(.02,{freq:3800,q:3,vol:vol*.4})}
function sndNo(){sfx('no')}
function sndPut(at,cap){hiss(.035,{freq:2100,q:2,vol:.22,at});tone(520,.07,{type:'triangle',vol:.12,at});tone(190,.09,{type:'sine',vol:.1,at:at+.004});if(cap){hiss(.05,{freq:4200,q:4,vol:.14,at:at+.03});tone(880,.04,{type:'triangle',vol:.06,at:at+.03})}}
/* 시작 연출에서 기물이 서는 소리: k 0 폰 … 5 킹 (계급이 오를수록 낮고 묵직, 킹은 쿵) */
function sndLand(k){const f=1.35-k*.12;hiss(.03,{freq:2600*f,q:2,vol:.13+k*.02});tone(560*f,.06+k*.012,{type:'triangle',vol:.09+k*.012});tone(200*f,.08+k*.02,{type:'sine',vol:.07+k*.02,at:.004});if(k===5){tone(95,.22,{type:'sine',vol:.2,at:.01});hiss(.12,{freq:420,vol:.12})}}
function sndCheck(at){tone(660,.09,{type:'triangle',vol:.1,at});tone(990,.14,{type:'triangle',vol:.09,at:at+.09})}

/* ----- 기물 그림 (2D 판·프로모션 단추·잡은 기물에 같이 씀): 0~1 칸 안의 SVG ----- */
function pieceSvg(t,col,x,y,s,op){
  const f=col?'#2b2724':'#f6efe0',k=col?'#0d0b0a':'#5a4630',hl=col?'rgba(255,255,255,.22)':'rgba(255,255,255,.7)';
  const P=(d)=>`<path d="${d}" fill="${f}" stroke="${k}" stroke-width=".035" stroke-linejoin="round"/>`;
  const base='M.2 .9 L.8 .9 L.78 .82 L.22 .82 Z';
  let body='';
  if(t===PW)body=P(base)+P('M.3 .82 Q.33 .62 .42 .55 L.58 .55 Q.67 .62 .7 .82 Z')+P('M.36 .56 L.64 .56 L.6 .5 L.4 .5 Z')+`<circle cx=".5" cy=".38" r=".13" fill="${f}" stroke="${k}" stroke-width=".035"/>`;
  else if(t===RR)body=P(base)+P('M.3 .82 L.33 .4 L.67 .4 L.7 .82 Z')+P('M.27 .4 L.73 .4 L.73 .2 L.64 .2 L.64 .27 L.55 .27 L.55 .2 L.45 .2 L.45 .27 L.36 .27 L.36 .2 L.27 .2 Z');
  else if(t===BB)body=P(base)+P('M.3 .82 Q.38 .62 .44 .5 L.56 .5 Q.62 .62 .7 .82 Z')+P('M.5 .16 C.66 .3 .66 .44 .58 .5 L.42 .5 C.34 .44 .34 .3 .5 .16 Z')+`<circle cx=".5" cy=".13" r=".045" fill="${f}" stroke="${k}" stroke-width=".03"/><path d="M.46 .37 L.57 .26" stroke="${k}" stroke-width=".035" stroke-linecap="round"/>`;
  else if(t===QQ)body=P(base)+P('M.3 .82 Q.38 .6 .4 .44 L.6 .44 Q.62 .6 .7 .82 Z')+P('M.36 .46 L.64 .46 L.74 .2 L.62 .34 L.56 .16 L.5 .32 L.44 .16 L.38 .34 L.26 .2 Z')+[.26,.44,.56,.74].map((x,i)=>`<circle cx="${x}" cy="${i%3?.15:.19}" r=".04" fill="${f}" stroke="${k}" stroke-width=".028"/>`).join('');
  else if(t===KK)body=P(base)+P('M.3 .82 Q.38 .6 .4 .44 L.6 .44 Q.62 .6 .7 .82 Z')+P('M.36 .46 L.64 .46 Q.72 .36 .62 .27 L.38 .27 Q.28 .36 .36 .46 Z')+P('M.46 .27 L.46 .2 L.4 .2 L.4 .14 L.46 .14 L.46 .07 L.54 .07 L.54 .14 L.6 .14 L.6 .2 L.54 .2 L.54 .27 Z');
  else if(t===NN)body=P(base)+P('M.26 .82 Q.26 .6 .4 .5 Q.32 .5 .24 .56 Q.18 .5 .24 .42 L.4 .28 Q.42 .2 .46 .14 L.5 .2 Q.66 .2 .74 .4 Q.8 .6 .72 .82 Z')+`<circle cx=".44" cy=".3" r=".025" fill="${k}"/>`;
  const hi=t===KK||t===QQ?`<path d="M.42 .78 Q.44 .62 .46 .5" stroke="${hl}" stroke-width=".04" fill="none" stroke-linecap="round"/>`:'';
  return `<g transform="translate(${x} ${y}) scale(${s})"${op!=null&&op<1?` opacity="${op}"`:''}>${body}${hi}</g>`;
}
const pieceIcon=(t,col,px)=>`<svg viewBox="0 0 1 1" width="${px}" height="${px}" aria-hidden="true">${pieceSvg(t,col,0,0,1)}</svg>`;

/* ----- 2D (SVG): 판 한 칸 = 1 ----- */
function sqXY(sq){const f=sq&7,r=sq>>4;return flipped()?[7-f,r]:[f,7-r]}
function xySq(x,y){if(x<0||y<0||x>7||y>7)return -1;return flipped()?y*16+(7-x):(7-y)*16+x}
function toLat(e){
  const r=elSvg.getBoundingClientRect(),s=Math.min(r.width,r.height)||1,vb=9.0;
  const ox=(r.width-s)/2,oy=(r.height-s)/2;
  return [(e.clientX-r.left-ox)/s*vb-.5,(e.clientY-r.top-oy)/s*vb-.5];
}
function onSvgClick(e){if(!CS)return;const [x,y]=toLat(e);tapSq(xySq(Math.floor(x),Math.floor(y)))}
function boardHTML(){
  const out=[],p=CS.p,fl=flipped();
  out.push(`<rect x="-.42" y="-.42" width="8.84" height="8.84" rx=".14" fill="#6b3f1f"/>`);
  for(let y=0;y<8;y++)for(let x=0;x<8;x++)out.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${(x+y)&1?'#b07a48':'#ecd3a6'}"/>`);
  for(let i=0;i<8;i++){out.push(`<text class="ch-co" x="${i+.5}" y="8.24">${FILES[fl?7-i:i]}</text><text class="ch-co" x="-.22" y="${i+.53}">${fl?i+1:8-i}</text>`)}
  const hl=(sq,c,op)=>{const [x,y]=sqXY(sq);out.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${c}" opacity="${op}"/>`)};
  if(CS.lm){hl(CS.lm[0],'#f2c94c',.45);hl(CS.lm[1],'#f2c94c',.55)}
  if(CS.chk&&V.st==='play'){const [x,y]=sqXY(CS.p.k[CS.p.side]);out.push(`<circle cx="${x+.5}" cy="${y+.5}" r=".55" fill="url(#chChk)"/>`)}
  if(sel>=0)hl(sel,'#6fbf5a',.5);
  if(flash&&clock()-flash.at<700)for(const s of flash.sq)hl(s,'#d6342a',.55);
  const capSq=pend?(p.b[pend.to]?pend.to:(mFl(pend.m)&2)?pend.to+(myCol()?16:-16):-1):-1;
  for(let sq=0;sq<128;sq++){if(sq&0x88){sq+=7;continue}const v=p.b[sq];if(!v||sq===capSq)continue;const [x,y]=sqXY(sq);out.push(pieceSvg(v&7,v>>3,x,y,1,pend&&pend.from===sq?.35:1))}
  if(sel>=0&&!pend)for(const m of movesFrom(sel)){const t=mTo(m),[x,y]=sqXY(t);if(p.b[t]||mFl(m)&2)out.push(`<circle cx="${x+.5}" cy="${y+.5}" r=".44" fill="none" stroke="rgba(30,30,30,.4)" stroke-width=".08"/>`);else out.push(`<circle cx="${x+.5}" cy="${y+.5}" r=".15" fill="rgba(30,30,30,.32)"/>`)}
  return out.join('');
}
function drawGhost(){
  if(!elGhost)return;
  if(pend&&CS){const [x,y]=sqXY(pend.to),v=pcAt(pend.from);elGhost.innerHTML=`<rect x="${x}" y="${y}" width="1" height="1" fill="#6fbf5a" opacity=".45"/>`+pieceSvg(pend.pro?proP:v&7,v>>3,x,y,1,.75)}
  else elGhost.innerHTML='';
  ch3Marks();
}
const nm=i=>V.ps[i]?V.ps[i].n:'?';
const colDot=col=>`<i class="dot ${col===0?'wht':col===1?'blk':'non'}"></i>`;
/* 위쪽 이름 칸: 색·이름·시간·잡은 기물. 내 칸을 누르면 무승부 제안 */
function barHTML(){
  const me=myIdx(),c=CS,order=me===1?[1,0]:[0,1];
  return order.map(i=>{
    const p=V.ps[i];if(!p||i>1)return '';
    const on=V.st==='play'&&V.t===i&&!introWait();
    const st=V.st==='over'?(c.res&&c.res.w<0?'무승부':p.f===1?'승리':(p.sr===2?'시간 초과':p.sr===3?'탈주':p.sr?'항복':'패배')):'';
    const cps=(c.cp[i]||[]).slice().sort((a,b)=>VAL[b]-VAL[a]);
    const capt=cps.length?`<span class="cp">${cps.map(t=>pieceIcon(t,c.co[i]^1,15)).join('')}</span>`:'';
    const dr=V.st==='play'&&c.dr===i?'<span class="dr" title="무승부 제안">½</span>':'';
    const mine=i===me&&V.st==='play';
    return `<div class="ch-p${on?' on':''}${i===me?' me':''}${mine?' tap':''}"${mine?' data-me="1"':''}>${colDot(c.co[i])}<b>${esc(p.n)}${i===me?' (나)':''}</b>${dr}<span class="w" data-ct="${i}"></span>${st?`<span class="st">${st}</span>`:''}${capt}${mine&&popOpen?`<span class="ch-pop"><button type="button" class="ch-drbtn" data-dr="1">½ ${c.dr===i?'제안 거두기':'무승부 제안'}</button></span>`:''}</div>`;
  }).join('');
}
const WHY_SHORT={mate:'체크메이트',time:'시간 초과',surrender:'항복',desert:'탈주',stale:'스테일메이트',rep:'같은 국면 3번',fifty:'50수 규칙',dead:'기물 부족',agree:'합의',tdead:'기물 부족'};
/* 안내 줄: 결과만 (누구 차례·체크·갈 수 있는 칸은 판이 보여 줌) */
function hintText(){
  if(Date.now()<msgUntil&&msg)return msg;
  if(!V||!V.c||!CS)return '';
  if(V.st==='over'){
    const r=CS.res;if(!r)return '게임이 끝났습니다.';
    return r.w<0?`무승부입니다. (${WHY_SHORT[r.why]||''})`:`${nm(r.w)} 승리 (${WHY_SHORT[r.why]||''})`;
  }
  return '';
}
/* 안내 줄 옆 단추: 프로모션 기물 고르기, 상대가 낸 무승부 제안 받기 */
function modesHTML(){
  if(!V||!V.c||!CS||V.st!=='play')return '';
  const out=[],me=myIdx();
  if(pend&&pend.pro){const col=myCol();for(const t of [QQ,RR,BB,NN])out.push(`<button type="button" class="ch-m pro${proP===t?' on':''}" data-pro="${t}" aria-pressed="${proP===t}" aria-label="${({5:'퀸',4:'룩',3:'비숍',2:'나이트'})[t]}">${pieceIcon(t,col,26)}</button>`)}
  if(me>=0&&me<2&&CS.dr===1-me)out.push(`<button type="button" class="ch-m dr" data-dr="1">½ 무승부 받기</button>`);
  return out.join('');
}
function drawHint(){
  if(!elHint)return;
  const h=hintText();if(h!==lastHint){elHint.textContent=h;lastHint=h}
  const m=modesHTML();if(m!==lastModes){elModes.innerHTML=m;lastModes=m}
}
function fit(){
  if(!elCh||elCh.hidden)return;
  const bd=elCh.querySelector('.ch-bd'),bw=bd.clientWidth,bh=bd.clientHeight;
  const s=Math.floor(Math.min(bw,bh));
  if(s>0){elSvg.style.width=elSvg.style.height=s+'px'}
}
function drawAll(){
  if(!CS||!elMain)return;
  if(!Ch3.on){const bd=boardHTML();if(bd!==lastBoard){elMain.innerHTML=bd;lastBoard=bd}}
  const bar=barHTML();if(bar!==lastBar){elBar.innerHTML=bar;lastBar=bar;clockTick()}   // 시간은 글에 넣지 않음 (매초 칸을 다시 만들면 누르는 중인 칸이 사라짐)
  drawGhost();drawHint();fit();
}

/* ---------- 3D: 공통 원목 테이블 가운데 체스판 + 클래식 기물, 비스듬히 내려다보는 자기 카메라 ----------
   단위: 월드 그대로. 칸 S, 판 반폭 HB, 틀 반폭 BW. 내 쪽(1번 줄, 흑이면 8번 줄)이 화면 아래(+z)
   잡은 기물은 판 옆(넓은 화면: 내 것은 오른쪽 아래, 상대 것은 왼쪽 위) 또는 판 앞뒤(좁은 화면)에 작게 세워 둠 */
const S=.52,HB=4*S,BW=HB+.3,TOP=.16,GS=.58;   // 칸, 판 반폭, 틀 반폭, 판 윗면 높이, 잡은 기물 크기
const Ch3={on:false,built:false,fail:false,root:null,cam:null,dirty:true,lastR:0,lay:'',layAt:0,d:12,layout:'h',pcs:new Map(),grave:[[],[]],anim:[],flipT:null,mvN:-1,fen:'',hits:[]};
const ease=k=>k<=0?0:k>=1?1:k*k*(3-2*k);
function sqW(sq){const f=sq&7,r=sq>>4;return Ch3.flipT?[(3.5-f)*S,(r-3.5)*S]:[(f-3.5)*S,(3.5-r)*S]}
function woodPaint(g,w,h,base,dark,n,seed){
  let s=seed||7;const rnd=()=>{s=(s*16807)%2147483647;return s/2147483647};
  g.fillStyle=base;g.fillRect(0,0,w,h);
  for(let i=0;i<n;i++){const y0=rnd()*h,a=rnd()*.12+.04;g.strokeStyle=dark;g.globalAlpha=a;g.lineWidth=rnd()*2.5+.8;g.beginPath();
    for(let t=0;t<=w;t+=8){const y=y0+Math.sin(t/30+i)*3+Math.sin(t/11+i*3)*1.2;t?g.lineTo(t,y):g.moveTo(t,y)}g.stroke()}
  g.globalAlpha=1;
}
/* 판 무늬: 밝은 칸(단풍)·어두운 칸(호두) + 틀의 좌표 (흑 쪽에서 보면 다시 그림) */
function drawBoardTex(fl){
  const cv=Ch3.boardTex.image,g=cv.getContext('2d'),N=cv.width,s=N/(2*BW),X=v=>(v+BW)*s;
  woodPaint(g,N,N,'#5e3418','#24100a',120,5);
  for(let r=0;r<8;r++)for(let f=0;f<8;f++){
    const x=X(-HB+f*S),y=X(-HB+r*S),w=S*s;
    const light=(r+f)%2===0;
    g.save();g.beginPath();g.rect(x,y,w,w);g.clip();
    woodPaint(g,N,N,light?'#ecd6ad':'#9c6638',light?'#b08350':'#4e2a10',light?14:22,31+r*8+f);
    g.restore();
  }
  g.strokeStyle='rgba(20,8,2,.9)';g.lineWidth=Math.max(3,N/260);g.strokeRect(X(-HB),X(-HB),2*HB*s,2*HB*s);
  g.fillStyle='rgba(240,214,170,.92)';g.font=`600 ${Math.round(.15*s)}px "IBM Plex Mono", monospace`;g.textAlign='center';g.textBaseline='middle';
  for(let i=0;i<8;i++){const v=-HB+(i+.5)*S;g.fillText(FILES[fl?7-i:i],X(v),X(HB+.15));g.fillText(String(fl?i+1:8-i),X(-HB-.15),X(v))}
  Ch3.boardTex.needsUpdate=true;
}
/* ----- 기물: 돌림 모양(받침·몸통·머리) + 장식(룩 성벽, 비숍 홈, 퀸 왕관 구슬, 킹 십자, 나이트 말머리) ----- */
/* 비율 (실물 스탠턴 기준, 칸 = 1): 키는 킹 1.6을 1로 퀸 .9 · 비숍 .78 · 나이트 .72 · 룩 .62 · 폰 .52, 받침 반지름은 킹 .35 … 폰 .26.
   몸통은 곡선(캣멀-롬)으로 가늘게 들어가고, 칼라(목 위 원반)와 받침 턱은 얇고 모서리가 섬 */
const BR0={1:.26,2:.31,3:.31,4:.3,5:.34,6:.35};
const baseP=r=>[[0,0],[r,0],[r,.04],[r*.94,.055],[r*.94,.075],[r*.85,.095],[r*.85,.11],[r*.72,.15]];
/* 곡선: 지난 점에서 시작해 cs 점들을 부드럽게 지나감 */
function curve(from,cs,n){
  const P=[from,...cs],o=[];
  for(let i=0;i<P.length-1;i++){
    const p0=P[Math.max(0,i-1)],p1=P[i],p2=P[i+1],p3=P[Math.min(P.length-1,i+2)];
    for(let k=1;k<=n;k++){const t=k/n,t2=t*t,t3=t2*t;o.push([0,1].map(j=>.5*((2*p1[j])+(-p0[j]+p2[j])*t+(2*p0[j]-5*p1[j]+4*p2[j]-p3[j])*t2+(-p0[j]+3*p1[j]-3*p2[j]+p3[j])*t3)))}
  }
  return o;
}
/* 마디: 배열이면 곧은 점들, {c:[…]}면 곡선 */
function prof(segs){const o=[];for(const sg of segs){if(Array.isArray(sg))o.push(...sg);else o.push(...curve(o[o.length-1],sg.c,sg.n||6))}return o.map(([x,y])=>[Math.max(0,x),y])}
const arcP=(cy,r,a0,a1,n)=>{const o=[];for(let i=0;i<=n;i++){const a=a0+(a1-a0)*i/n;o.push([Math.max(0,r*Math.cos(a)),cy+r*Math.sin(a)])}return o};
let PROF=null;
function profs(){
  if(PROF)return PROF;
  return PROF={
    1:prof([baseP(.26),{c:[[.15,.22],[.11,.34],[.085,.45]]},[[.15,.465],[.15,.495],[.08,.51]],arcP(.65,.14,-.96,Math.PI/2,12)]),
    4:prof([baseP(.3),{c:[[.21,.3],[.19,.52],[.2,.66]]},[[.27,.69],[.27,.72],[.21,.735]],{c:[[.235,.8],[.27,.88]]},[[.27,.9],[.19,.9],[.19,.86],[0,.86]]]),
    3:prof([baseP(.31),{c:[[.17,.3],[.11,.55],[.085,.7]]},[[.17,.72],[.17,.755],[.1,.77],[.13,.785],[.13,.8],[.08,.81]],{c:[[.14,.87],[.165,.96],[.145,1.05],[.095,1.12],[.035,1.165],[0,1.175]]}]),
    5:prof([baseP(.34),{c:[[.19,.32],[.13,.62],[.1,.86]]},[[.2,.88],[.2,.915],[.12,.93],[.15,.945],[.15,.96],[.12,.97]],{c:[[.15,1.06],[.21,1.17],[.255,1.24]]},[[.2,1.245]],{c:[[.15,1.27],[.09,1.3],[0,1.31]]}]),
    6:prof([baseP(.35),{c:[[.2,.33],[.14,.66],[.11,.92]]},[[.21,.94],[.21,.975],[.13,.99],[.16,1.005],[.16,1.02],[.13,1.03]],{c:[[.16,1.12],[.215,1.22],[.23,1.28]]},[[.23,1.3],[.15,1.31]],{c:[[.1,1.355],[0,1.37]]}]),
    2:prof([baseP(.31),[[.24,.165],[.24,.2],[0,.2]]])};
}
/* 나이트 말머리 옆모양 (오른쪽을 봄): 가슴 → 목 → 턱 → 둥근 코 → 이마 → 귀 → 갈기 */
function knightShape(){
  const sh=new THREE.Shape(),X=x=>x-.06;
  sh.moveTo(X(-.3),.22);sh.lineTo(X(.3),.22);
  sh.quadraticCurveTo(X(.31),.36,X(.15),.46);
  sh.quadraticCurveTo(X(.12),.52,X(.23),.57);
  sh.lineTo(X(.41),.65);
  sh.quadraticCurveTo(X(.5),.69,X(.48),.77);
  sh.quadraticCurveTo(X(.46),.83,X(.35),.85);
  sh.quadraticCurveTo(X(.23),.88,X(.16),.96);
  sh.lineTo(X(.14),1.07);sh.lineTo(X(.05),1.0);
  sh.quadraticCurveTo(X(-.06),1.01,X(-.15),.92);
  sh.quadraticCurveTo(X(-.31),.78,X(-.33),.56);
  sh.quadraticCurveTo(X(-.35),.38,X(-.3),.22);
  return sh;
}
/* 나이트 머리: 옆모양을 돌출하고 키를 맞춘 뒤, 코 쪽과 귀 쪽으로 갈수록 얇게 깎음 (off: 먹선용으로 조금 크게) */
const kTaper=(x,y)=>(1-.4*Math.min(1,Math.max(0,(x+.05)/.45)))*(1-.3*Math.min(1,Math.max(0,(y-.85)/.35)));
function knightGeo(off){
  const g=new THREE.ExtrudeGeometry(knightShape(),{depth:.32,bevelEnabled:true,bevelThickness:.06+off,bevelSize:.045+off,bevelSegments:3,curveSegments:8});
  g.translate(0,0,-.16);g.scale(1,1.12,1);g.translate(0,-.04,0);
  const P=g.attributes.position;for(let i=0;i<P.count;i++)P.setZ(i,P.getZ(i)*kTaper(P.getX(i),P.getY(i)));
  g.computeVertexNormals();return g;
}
const GEO={};
function geoOf(t){
  if(GEO[t])return GEO[t];
  const pr=profs()[t],off=BR0[t]*.065,top=pr[pr.length-1][1];
  const lat=new THREE.LatheGeometry(pr.map(([x,y])=>new THREE.Vector2(x,y)),36);
  const ink=new THREE.LatheGeometry(pr.map(([x,y])=>new THREE.Vector2(x?x+off:0,y>=top-.001?y+off:y<.001?y-.004:y)),36);   // 먹선: 기물 크기에 비례한 두께
  const ex=[];   // 장식: [모양, x, y, z, 돌림y, 돌림z, 표시]
  if(t===RR){   // 성벽: 둥근 테를 다섯 토막으로 (토막 사이가 홈)
    for(let k=0;k<5;k++){const a0=k/5*Math.PI*2+.2,a1=a0+Math.PI*2/5-.46,sh=new THREE.Shape();sh.absarc(0,0,.27,a0,a1,false);sh.absarc(0,0,.19,a1,a0,true);
      const g=new THREE.ExtrudeGeometry(sh,{depth:.1,bevelEnabled:false,curveSegments:8});g.rotateX(-Math.PI/2);ex.push([g,0,.9,0,0,0])}}
  if(t===QQ){for(let k=0;k<9;k++){const a=k/9*Math.PI*2;ex.push([new THREE.SphereGeometry(.038,10,8),Math.sin(a)*.25,1.255,Math.cos(a)*.25,0,0])}ex.push([new THREE.SphereGeometry(.06,14,10),0,1.36,0,0,0])}
  if(t===KK){ex.push([new THREE.BoxGeometry(.075,.27,.075),0,1.48,0,0,0]);ex.push([new THREE.BoxGeometry(.21,.07,.075),0,1.52,0,0,0])}
  if(t===BB)ex.push([new THREE.SphereGeometry(.045,12,8),0,1.2,0,0,0]);
  if(t===NN){ex.push([knightGeo(0),0,0,0,0,0,'head']);
    const ez=(.16+.06)*kTaper(.2,.856)-.005;for(const z of [-ez,ez])ex.push([new THREE.SphereGeometry(.03,8,6),.2,.856,z,0,0,'eye'])}
  return GEO[t]={lat,ink,ex,kInk:t===NN?knightGeo(.022):null};
}
const MAT={};
function matOf(col,ghost){
  const k=(ghost?'g':'m')+col;
  if(!MAT[k])MAT[k]=ghost?new THREE.MeshBasicMaterial({color:col?0x3a332e:0xf3e8d2,transparent:true,opacity:.5,depthWrite:false}):toon({color:col?0x2f2925:0xefe3c8,rim:col?.42:.12});
  return MAT[k];
}
const INK=()=>MAT.ink||(MAT.ink=new THREE.MeshBasicMaterial({color:GFX_INK,side:THREE.BackSide}));
const SLIT=()=>MAT.slit||(MAT.slit=new THREE.MeshBasicMaterial({color:0x1a120c}));
/* 기물 하나: t 종류, col 색(0 백·1 흑), ghost면 반투명(미리 보기). 나이트는 상대 쪽을 보되 옆모양이 보이게 비스듬히 돌림 */
function pieceMesh(t,col,ghost){
  const G3=geoOf(t),g=new THREE.Group(),m=matOf(col,ghost);
  const body=new THREE.Mesh(G3.lat,m);body.castShadow=!ghost;body.receiveShadow=!ghost;g.add(body);
  if(!ghost){g.add(new THREE.Mesh(G3.ink,INK()))}
  const parts=[body];
  for(const [geo,x,y,z,ry,rz,tag] of G3.ex){
    if(tag==='eye'){if(!ghost){const e=new THREE.Mesh(geo,SLIT());e.position.set(x,y,z);g.add(e)}continue}
    const e=new THREE.Mesh(geo,m);e.position.set(x,y,z);e.rotation.y=ry;e.rotation.z=rz;e.castShadow=!ghost;g.add(e);parts.push(e);
    if(!ghost){const o=new THREE.Mesh(tag==='head'?G3.kInk:geo,INK());o.position.copy(e.position);o.rotation.copy(e.rotation);if(t===RR){o.scale.set(1.08,1.15,1.08);o.position.y=e.position.y-.006}else if(tag!=='head')o.scale.setScalar(1.3);g.add(o)}
  }
  if(t===BB){const sl=new THREE.Mesh(new THREE.BoxGeometry(.03,.17,.36),ghost?m:SLIT());sl.position.set(.03,1.0,0);sl.rotation.z=.7;g.add(sl)}
  g.scale.setScalar(S*.95);
  g.userData={t,col,parts};
  return g;
}
/* 나이트는 내 화면에서 옆모양이 보이게 왼쪽을 보고, 상대 쪽으로 조금 돌림 (도면의 나이트처럼) */
function placeRotFor(g,fl){if(g.userData.t===NN){const away=(g.userData.col===0)!==!!fl;g.rotation.y=away?Math.PI-.44:Math.PI+.44}}
function placeRot(g){if(g.userData.t===NN){const away=(g.userData.col===0)!==!!Ch3.flipT;g.rotation.y=away?Math.PI-.44:Math.PI+.44}}   // 화면 왼쪽을 보며 상대 쪽으로 조금
function ch3Build(){
  if(Ch3.built||Ch3.fail)return Ch3.built;
  if(!T.ok||typeof THREE==='undefined'){Ch3.fail=true;return false}
  try{
    const root=new THREE.Group();root.visible=false;
    const bg=new THREE.Group();root.add(bg);Ch3.boardG=bg;
    const frameT=canvasTex(512,512,(g,w,h)=>woodPaint(g,w,h,'#5e3418','#24100a',110,3));
    const frame=new THREE.Mesh(new THREE.BoxGeometry(2*BW,TOP-.02,2*BW),toon({map:frameT,rim:.08}));frame.position.y=.02+(TOP-.02)/2;frame.castShadow=frame.receiveShadow=true;bg.add(frame);
    const fo=new THREE.Mesh(new THREE.BoxGeometry(2*BW+.05,TOP,2*BW+.05),INK());fo.position.copy(frame.position);bg.add(fo);
    Ch3.boardTex=canvasTex(1024,1024,()=>{});
    const top=new THREE.Mesh(new THREE.PlaneGeometry(2*BW-.04,2*BW-.04),toon({map:Ch3.boardTex,rim:0}));
    top.rotation.x=-Math.PI/2;top.position.y=TOP+.002;top.receiveShadow=true;bg.add(top);
    // 칸 표시: 마지막 수(노랑)·고른 기물(초록)·안 되는 까닭(빨강)·체크(붉은 빛)·갈 수 있는 칸(점)·잡을 수 있는 칸(고리)
    const plane=(c,op)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(S,S),new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:op,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.y=TOP+.004;m.visible=false;m.renderOrder=2;root.add(m);return m};
    Ch3.lmA=plane(0xf2c94c,.42);Ch3.lmB=plane(0xf2c94c,.55);Ch3.selM=plane(0x6fbf5a,.55);Ch3.pendM=plane(0x6fbf5a,.4);
    Ch3.flashM=[0,1,2,3].map(()=>plane(0xd6342a,.6));
    const gT=canvasTex(128,128,(x,w,h)=>{const gr=x.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);gr.addColorStop(0,'rgba(255,40,20,.95)');gr.addColorStop(.55,'rgba(230,30,20,.55)');gr.addColorStop(1,'rgba(200,20,10,0)');x.fillStyle=gr;x.fillRect(0,0,w,h)});
    Ch3.chkM=new THREE.Mesh(new THREE.PlaneGeometry(S*1.5,S*1.5),new THREE.MeshBasicMaterial({map:gT,transparent:true,depthWrite:false}));Ch3.chkM.rotation.x=-Math.PI/2;Ch3.chkM.position.y=TOP+.006;Ch3.chkM.visible=false;Ch3.chkM.renderOrder=3;root.add(Ch3.chkM);
    const dotM=new THREE.MeshBasicMaterial({color:0x1d1a17,transparent:true,opacity:.38,depthWrite:false});
    const ringM=new THREE.MeshBasicMaterial({color:0x1d1a17,transparent:true,opacity:.45,depthWrite:false});
    Ch3.dots=[];Ch3.rings=[];
    for(let k=0;k<28;k++){
      const d=new THREE.Mesh(new THREE.CircleGeometry(S*.15,20),dotM);d.rotation.x=-Math.PI/2;d.position.y=TOP+.008;d.visible=false;d.renderOrder=4;root.add(d);Ch3.dots.push(d);
      const r=new THREE.Mesh(new THREE.RingGeometry(S*.42,S*.5,32),ringM);r.rotation.x=-Math.PI/2;r.position.y=TOP+.008;r.visible=false;r.renderOrder=4;root.add(r);Ch3.rings.push(r);
    }
    Ch3.pg=new THREE.Group();root.add(Ch3.pg);   // 기물(판 위·잡은 것): 바로 시작에서 색이 바뀌면 이 묶음만 돌림
    Ch3.ghost=new THREE.Group();Ch3.ghost.visible=false;root.add(Ch3.ghost);
    Ch3.cam=new THREE.PerspectiveCamera(34,1,.1,100);
    T.scene.add(root);Ch3.root=root;Ch3.built=true;
  }catch(e){Ch3.fail=true;try{console.warn('체스 3D 준비 실패',e)}catch(_){}}
  return Ch3.built;
}
/* 잡은 기물 자리: k 0 = 내 쪽(내가 잡은 것), 1 = 상대 쪽 */
function graveXZ(k,i){
  const sg=k?-1:1;
  if(Ch3.layout==='h')return [sg*(BW+.32+(i%2)*.36),sg*(HB-.2-Math.floor(i/2)*.42)];
  return [sg*(HB-.22-(i%8)*.5)*-1,sg*(BW+.32+Math.floor(i/8)*.4)];
}
/* 바로 시작: 판은 그대로 두고 지금 기물(판 위·잡힌 것)을 처음 자리로 모음. 같은 종류·색 중 가까운 것부터 짝을 지어
   계급 순서(시작 연출과 같은 박자)로 미끄러져 돌아감. 색이 바뀌어 판을 돌려 봐야 하면 먼저 기물 묶음이 반 바퀴 돎(판 무늬는 그대로, 좌표 글자만 중간에 바뀜) */
const GLIDE=420,SPIN=520;
function regather(fl,p){
  const spin=Ch3.flipT!==fl,pool=[...Ch3.pcs.values(),...Ch3.grave[0],...Ch3.grave[1]];
  if(spin){for(const g of pool){g.position.x=-g.position.x;g.position.z=-g.position.z;placeRotFor(g,fl)}Ch3.pg.rotation.y=Math.PI;IN.spin=1}
  Ch3.flipT=fl;Ch3.pcs.clear();Ch3.grave=[[],[]];Ch3.anim=[];
  const used=new Set();
  for(let sq=0;sq<128;sq++){
    if(sq&0x88){sq+=7;continue}
    const v=p.b[sq];if(!v)continue;
    const [x,z]=sqW(sq);let best=null,bd=1e9;
    for(const g of pool){if(used.has(g)||g.userData.t!==(v&7)||g.userData.col!==(v>>3))continue;const d=Math.hypot(g.position.x-x,g.position.z-z);if(d<bd){bd=d;best=g}}
    if(!best){best=pieceMesh(v&7,v>>3);placeRot(best);best.position.set(x,TOP+1.1,z);best.visible=false;Ch3.pg.add(best)}
    used.add(best);Ch3.pcs.set(sq,best);
    const [a]=pieceAt(v&7,sq),g=best,s0=g.scale.x,y0=g.userData.grave?0:g.visible?g.position.y:TOP+1.1;
    g.userData.grave=0;
    Ch3.anim.push({obj:g,t0:IN.t0+a,dur:GLIDE,x0:g.position.x,z0:g.position.z,x1:x,z1:z,lift:Math.hypot(g.position.x-x,g.position.z-z)>.05?.35:0,s0,s1:S*.95,y0,y1:TOP,show:1});
  }
  for(const g of pool)if(!used.has(g))Ch3.pg.remove(g);
  Ch3.mvN=0;Ch3.fen=V.c.fen;Ch3.dirty=true;
}
/* 기물 자리를 상태에 맞춤: 마지막 수는 미끄러지듯(나이트는 뛰어오름), 잡힌 기물은 판 옆으로 */
function ch3Sync(){
  if(!Ch3.on||!V||!V.c||!CS)return;
  const fl=flipped(),c=V.c,p=CS.p;
  if(IN.again&&!IN.gathered&&c.mv.length===0&&Ch3.flipT!==null){IN.gathered=true;regather(fl,p)}
  if(Ch3.flipT!==fl){Ch3.flipT=fl;drawBoardTex(fl);for(const g of Ch3.pcs.values())Ch3.pg.remove(g);Ch3.pcs.clear();for(const k of [0,1]){for(const g of Ch3.grave[k])Ch3.pg.remove(g);Ch3.grave[k]=[]}Ch3.mvN=-1}
  const n=c.mv.length,step=Ch3.mvN>=0&&n===Ch3.mvN+1&&c.lm&&!IN.on3d;
  const now=clock(),me=myIdx()<0?0:myIdx();
  let capMesh=null;
  if(step){
    const [f,t]=c.lm,g=Ch3.pcs.get(f);
    if(g){
      const old=Ch3.pcs.get(t);
      if(old){Ch3.pcs.delete(t);capMesh=old}
      else if((g.userData.t===PW)&&((f&7)!==(t&7))){const es=t+(g.userData.col?16:-16),eg=Ch3.pcs.get(es);if(eg){Ch3.pcs.delete(es);capMesh=eg}}
      Ch3.pcs.delete(f);Ch3.pcs.set(t,g);
      const [x0,z0]=sqW(f),[x1,z1]=sqW(t),jump=g.userData.t===NN;
      Ch3.anim.push({obj:g,t0:now,dur:jump?300:240,x0,z0,x1,z1,lift:jump?.5:.08});
      if(g.userData.t===KK&&Math.abs((t&7)-(f&7))===2){const rf=t>f?f+3:f-4,rt=t>f?f+1:f-1,rg=Ch3.pcs.get(rf);if(rg){Ch3.pcs.delete(rf);Ch3.pcs.set(rt,rg);const [a0,b0]=sqW(rf),[a1,b1]=sqW(rt);Ch3.anim.push({obj:rg,t0:now+120,dur:260,x0:a0,z0:b0,x1:a1,z1:b1,lift:.35})}}
    }
  }
  // 판 위 기물을 국면과 맞춤 (프로모션·처음·되돌아온 경우)
  const want=new Map();
  for(let sq=0;sq<128;sq++){if(sq&0x88){sq+=7;continue}const v=p.b[sq];if(v)want.set(sq,v)}
  for(const [sq,g] of Ch3.pcs){const v=want.get(sq);if(!v||(g.userData.t!==(v&7))||(g.userData.col!==(v>>3))){
    const busy=Ch3.anim.some(a=>a.obj===g);
    if(v&&busy&&g.userData.col===(v>>3)){const a=Ch3.anim.find(a=>a.obj===g);a.swap=v}   // 프로모션: 도착하면 바꿈
    else{Ch3.pg.remove(g);Ch3.pcs.delete(sq)}}}
  for(const [sq,v] of want){
    if(Ch3.pcs.has(sq))continue;
    const g=pieceMesh(v&7,v>>3);placeRot(g);const [x,z]=sqW(sq);g.position.set(x,TOP,z);Ch3.pg.add(g);Ch3.pcs.set(sq,g);
  }
  for(const g of Ch3.pcs.values())if(!Ch3.anim.some(a=>a.obj===g)){const sq=[...Ch3.pcs].find(e=>e[1]===g)[0],[x,z]=sqW(sq);g.position.set(x,TOP,z)}
  // 잡은 기물: 자리 순서(내가 잡은 것 k0, 상대가 잡은 것 k1)
  for(const k of [0,1]){
    const seat=k?1-me:me,list=(c.cp[seat]||[]).slice(),gs=Ch3.grave[k],col=c.co[seat]^1;
    while(gs.length>list.length)Ch3.pg.remove(gs.pop());
    for(let i=0;i<list.length;i++){
      let g=gs[i];
      if(g&&g.userData.t!==list[i]){Ch3.pg.remove(g);g=null}
      const [x,z]=graveXZ(k,i);
      if(!g){
        if(capMesh&&i===list.length-1&&capMesh.userData.col===col&&capMesh.userData.t===list[i]){g=capMesh;capMesh=null;Ch3.anim.push({obj:g,t0:now+120,dur:420,x0:g.position.x,z0:g.position.z,x1:x,z1:z,lift:.6,s0:g.scale.x,s1:S*.95*GS})}
        else{g=pieceMesh(list[i],col);placeRot(g);g.scale.setScalar(S*.95*GS);g.position.set(x,0,z);Ch3.pg.add(g)}
        gs[i]=g;g.userData.grave=1;
      }else if(!Ch3.anim.some(a=>a.obj===g))g.position.set(x,0,z);
    }
  }
  if(capMesh)Ch3.pg.remove(capMesh);
  Ch3.mvN=n;Ch3.fen=c.fen;
  ch3Marks();Ch3.dirty=true;
}
/* 칸 표시를 상태에 맞춤 (고를 때마다) */
function ch3Marks(){
  if(!Ch3.on||!V||!V.c||!CS)return;
  const put=(m,sq)=>{if(sq==null||sq<0){m.visible=false;return}const [x,z]=sqW(sq);m.position.x=x;m.position.z=z;m.visible=true};
  put(Ch3.lmA,CS.lm?CS.lm[0]:-1);put(Ch3.lmB,CS.lm?CS.lm[1]:-1);
  put(Ch3.selM,sel>=0&&!introWait()?sel:-1);put(Ch3.pendM,pend?pend.to:-1);
  put(Ch3.chkM,CS.chk&&V.st==='play'?CS.p.k[CS.p.side]:-1);
  const fs=flash&&clock()-flash.at<700?flash.sq:[];Ch3.flashM.forEach((m,k)=>put(m,fs[k]));
  const ms=sel>=0&&!pend?movesFrom(sel):[],seen=new Set();let di=0,ri=0;
  for(const m of ms){const t=mTo(m);if(seen.has(t))continue;seen.add(t);if(CS.p.b[t]||mFl(m)&2){if(ri<Ch3.rings.length)put(Ch3.rings[ri++],t)}else if(di<Ch3.dots.length)put(Ch3.dots[di++],t)}
  for(;di<Ch3.dots.length;di++)Ch3.dots[di].visible=false;for(;ri<Ch3.rings.length;ri++)Ch3.rings[ri].visible=false;
  // 고른 기물은 살짝 들림, 미리 보기는 반투명 기물
  const capSq=pend?(CS.p.b[pend.to]?pend.to:(mFl(pend.m)&2)?pend.to+(myCol()?16:-16):-1):-1;
  for(const [sq,g] of Ch3.pcs){if(Ch3.anim.some(a=>a.obj===g))continue;const up=sq===sel&&!introWait();const y=TOP+(up?.12:0);if(g.position.y!==y){g.position.y=y;Ch3.dirty=true}
    g.visible=!(pend&&(pend.from===sq||capSq===sq))}   // 미리 보기: 옮기는 기물과 잡힐 기물은 숨기고 반투명 기물만
  if(pend){
    const v=pcAt(pend.from),t=pend.pro?proP:v&7,col=v>>3,key=t+'|'+col+'|'+Ch3.flipT;
    if(Ch3.ghost.userData.k!==key){Ch3.ghost.clear();const gm=pieceMesh(t,col,true);placeRot(gm);gm.traverse(o=>{o.renderOrder=6});Ch3.ghost.add(gm);Ch3.ghost.userData.k=key}
    const [x,z]=sqW(pend.to);Ch3.ghost.position.set(x,TOP,z);Ch3.ghost.visible=true;
    // 미리 보기 칸의 상대 기물은 흐리게 (잡힘)
  }else Ch3.ghost.visible=false;
  Ch3.dirty=true;
}
/* 카메라: 내 쪽에서 비스듬히(52도) 판을 내려다봄. 판·기물·잡은 기물이 '판 자리'(위 이름 칸 아래, 아래 단추 위)에 꽉 차게 */
const PITCH=52*Math.PI/180;
function ch3Layout(t){
  if(t-Ch3.layAt<100&&Ch3.lay)return false;
  Ch3.layAt=t;
  const st=$('#stage'),W=st.clientWidth,Hh=st.clientHeight;if(!W||!Hh||!V||!V.c)return false;
  const sr=st.getBoundingClientRect(),bd=elCh.querySelector('.ch-bd').getBoundingClientRect();
  const base=[W,Hh].join(',');
  if(Ch3.topBase!==base){Ch3.topBase=base;Ch3.topMax=0}
  const top=Math.max(Math.round(bd.top-sr.top),Ch3.topMax);Ch3.topMax=top;
  const key=base+','+top+','+flipped();
  if(key===Ch3.lay)return false;
  Ch3.lay=key;
  const narrow=W<700,fy=top+2,fh=(narrow?Hh-80:Hh-58)-fy,fw=W-12;
  const pts=lay=>{const o=[];const E=BW,ty=.72;
    for(const x of [-E,E])for(const z of [-E,E])o.push([x,0,z],[x,TOP,z]);
    for(const x of [-HB+S/2,HB-S/2])o.push([x,TOP+1.6*S*.95,-HB+S/2],[x,TOP+1.6*S*.95,HB-S/2]);
    Ch3.layout=lay;for(const k of [0,1])for(const i of lay==='h'?[0,1,14,15]:[0,7,8,15]){const [x,z]=graveXZ(k,i);o.push([x+.2,0,z+.2],[x-.2,.75*S*GS,z-.2])}
    return o};
  const cam=Ch3.cam;cam.aspect=W/Hh;cam.clearViewOffset();cam.updateProjectionMatrix();
  const v=new THREE.Vector3();
  const measure=(P,D)=>{cam.position.set(0,D*Math.sin(PITCH),D*Math.cos(PITCH));cam.lookAt(0,0,0);cam.updateMatrixWorld();
    let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;for(const q of P){v.set(q[0],q[1],q[2]).project(cam);const px=(v.x+1)/2*W,py=(1-v.y)/2*Hh;x0=Math.min(x0,px);x1=Math.max(x1,px);y0=Math.min(y0,py);y1=Math.max(y1,py)}
    return {x0,x1,y0,y1}};
  const fitD=P=>{let lo=2,hi=80;for(let k=0;k<30;k++){const m=(lo+hi)/2,b=measure(P,m);if(b.x1-b.x0<=fw&&b.y1-b.y0<=fh)hi=m;else lo=m}return hi};
  const dH=fitD(pts('h')),dV=fitD(pts('v'));
  const lay=dH<=dV?'h':'v',P=pts(lay),D=Math.min(dH,dV);
  const b=measure(P,D);
  const cx=(b.x0+b.x1)/2,cy=(b.y0+b.y1)/2,tx=W/2,ty=fy+fh/2;
  cam.setViewOffset(W,Hh,Math.round(cx-tx),Math.round(cy-ty),W,Hh);cam.updateProjectionMatrix();cam.updateMatrixWorld();
  Ch3.d=D;Ch3.dirty=true;
  ch3Sync();   // 잡은 기물 자리가 바뀌었을 수 있음
  return true;
}
function ch3Step(now){
  let busy=false;
  Ch3.anim=Ch3.anim.filter(a=>{
    const k=(now-a.t0)/a.dur;if(k<0){busy=true;return true}
    const e=ease(Math.min(1,k)),o=a.obj;busy=true;
    o.position.x=a.x0+(a.x1-a.x0)*e;o.position.z=a.z0+(a.z1-a.z0)*e;
    const base=o.userData.grave?0:TOP;
    if(a.show)o.visible=true;
    o.position.y=(a.y0!=null?a.y0+(a.y1-a.y0)*e:base)+Math.sin(Math.PI*Math.min(1,k))*(a.lift||0);
    if(a.s1!=null){const s=a.s0+(a.s1-a.s0)*e;o.scale.setScalar(s)}
    if(k>=1){
      o.position.set(a.x1,a.y1!=null?a.y1:base,a.z1);
      if(a.swap){const sq=[...Ch3.pcs].find(e=>e[1]===o);if(sq){Ch3.pg.remove(o);const g=pieceMesh(a.swap&7,a.swap>>3);placeRot(g);g.position.copy(o.position);Ch3.pg.add(g);Ch3.pcs.set(sq[0],g)}}
      return false;
    }
    return true;
  });
  return busy;
}
function ch3Render(t){
  if(!Ch3.on||!T.ok)return;
  if(ch3Layout(t))Ch3.dirty=true;
  const busy=ch3Step(t),intro=IN.on3d&&introStep(t),fl=flash&&t-flash.at<760;
  if(flash&&!fl&&Ch3.flashM[0].visible){flash=null;ch3Marks();drawAll()}
  if(!busy&&!intro&&!fl&&!Ch3.dirty&&t-Ch3.lastR<400)return;
  Ch3.dirty=false;Ch3.lastR=t;
  const fog=T.scene.fog,fn=fog?fog.near:0,ff=fog?fog.far:0;
  if(fog){fog.near=Ch3.d+5;fog.far=Ch3.d+30}
  for(const m of [T.timerBg,T.timerArc,T.ring])if(m)m.visible=false;
  let cam=Ch3.cam;
  {const k=intro&&IN.fromLobby?ease((t-IN.t0)/INTRO.cam):1;
   if(k<1){
     const ic=Ch3.icam||(Ch3.icam=new THREE.PerspectiveCamera());
     ic.position.copy(T.cam.position).lerp(Ch3.cam.position,k);ic.quaternion.copy(T.cam.quaternion).slerp(Ch3.cam.quaternion,k);
     const a=T.cam.projectionMatrix.elements,b=Ch3.cam.projectionMatrix.elements,m=ic.projectionMatrix.elements;
     for(let j=0;j<16;j++)m[j]=a[j]+(b[j]-a[j])*k;
     ic.projectionMatrixInverse.copy(ic.projectionMatrix).invert();ic.updateMatrixWorld();
     if(fog){fog.near=fn+(fog.near-fn)*k;fog.far=ff+(fog.far-ff)*k}
     cam=ic;
   }}
  T.r.render(T.scene,cam);
  if(fog){fog.near=fn;fog.far=ff}
}
/* ---------- 시작 연출 (게임이 시작되면 한 번: 방장이 그동안 시간·봇을 멈춤, 길이 G.introMs) ----------
   0~1.1초    로비 카메라 → 체스 카메라. 0.65초부터 위쪽 이름 칸이 들어옴
   0.1~0.5초  판이 위에서 툭 내려앉음
   0.55초~    기물이 계급 순서로 서로 섬 (백·흑 같은 박자): 폰(a→h 물결) → 나이트 → 비숍 → 룩 → 퀸 → 킹(혼자 마지막, 더 높이서 무겁게)
   킹이 서면 '○○님이 백으로 먼저 시작합니다' 안내, 3.5초에 끝
   다시 하기(결과 화면에서 바로 시작)는 판을 다시 차리지 않음: 판 위·옆의 기물이 같은 계급 순서로 처음 자리로 미끄러져 돌아감(regather),
   색이 바뀌어 판을 돌려 봐야 하면 먼저 기물이 반 바퀴 돎 */
const INTRO={cam:1100,ui:650,board:[100,400],pawn:[550,70,300],at:{2:1400,3:1700,4:2000,5:2350,6:2800},dur:330,kDur:420,say:3100};
G.introMs=3500;
const IN={on:false,on3d:false,t0:0,fromLobby:true,said:false,snd:{}};
const introOn=()=>IN.on&&clock()<IN.t0+G.introMs;
const introWait=()=>introOn()&&!IN.said;
const dropY=(x,h)=>x>=1?0:x<.68?h*(1-(x/.68)*(x/.68)):h*.1*Math.sin(Math.PI*(x-.68)/.32);
/* 기물 하나가 떨어지기 시작하는 시각과 길이 (폰은 화면 왼쪽부터 물결) */
function pieceAt(t,sq){
  if(t===PW){const f=Ch3.flipT?7-(sq&7):sq&7;return [INTRO.pawn[0]+f*INTRO.pawn[1],INTRO.pawn[2]]}
  return [INTRO.at[t]||INTRO.at[2],t===KK?INTRO.kDur:INTRO.dur];
}
G.intro=(t0,o)=>{
  if(!V||!V.c||!V.ps)return;
  IN.on=true;IN.t0=t0;IN.said=false;IN.snd={};IN.fromLobby=!Ch3.on;IN.on3d=true;IN.again=!!(o&&o.again)&&Ch3.on;IN.gathered=false;IN.spin=0;IN.texDone=false;
  $('#stage').classList.add('ch-intro');if(elCh&&IN.fromLobby)elCh.classList.add('intro');
  lastBar='';Ch3.dirty=true;
};
function introStep(now,force){
  if(!Ch3.built||!V||!V.c)return false;
  const e=now-IN.t0,done=force||e>=G.introMs,fl=IN.fromLobby;
  if(done)IN.on3d=false;
  {const x=done||!fl?1:(e-INTRO.board[0])/INTRO.board[1];Ch3.boardG.visible=x>0;Ch3.boardG.position.y=dropY(Math.max(0,x),1.6)}
  if(IN.again){   // 바로 시작: 기물은 regather의 움직임이 옮김. 색이 바뀌었으면 기물 묶음만 반 바퀴 (좌표 글자는 중간에 바뀜)
    if(IN.spin){const k=done?1:ease(e/SPIN);Ch3.pg.rotation.y=Math.PI*(1-k);if(k>=.5&&!IN.texDone){IN.texDone=true;drawBoardTex(Ch3.flipT)}}
    if(done){Ch3.pg.rotation.y=0;for(const g of Ch3.pcs.values())g.visible=true}
    return true;
  }
  for(const [sq,g] of Ch3.pcs){
    const [a,d]=pieceAt(g.userData.t,sq),x=done?1:(e-a)/d;
    g.visible=x>0;g.position.y=TOP+dropY(Math.max(0,Math.min(1,x)),g.userData.t===KK?1.6:1.1);
  }
  return true;
}
function introEnd(){
  if(IN.on3d)introStep(clock(),true);
  IN.on=false;IN.on3d=false;IN.said=true;
  $('#stage').classList.remove('ch-intro');if(elCh)elCh.classList.remove('intro');
}
function introTick(){
  if(!IN.on)return;
  const e=clock()-IN.t0,S_=IN.snd,once=(k,f)=>{if(!S_[k]){S_[k]=1;f()}};
  if(e>=INTRO.ui&&elCh&&elCh.classList.contains('intro'))elCh.classList.remove('intro');
  if(IN.on3d&&Ch3.on){
    if(IN.fromLobby&&e>=INTRO.board[0]+INTRO.board[1]*.68)once('thud',()=>{tone(120,.13,{type:'triangle',vol:.2});hiss(.09,{freq:650,vol:.12})});
    const land=d=>IN.again?GLIDE:d*.68;   // 떨어지면 닿는 순간, 미끄러져 돌아오면 도착하는 순간
    if(IN.again&&IN.spin&&e>=60)once('spin',()=>{hiss(.45,{freq:900,sweep:2400,q:.8,vol:.07})});
    for(let f=0;f<8;f++)if(e>=INTRO.pawn[0]+f*INTRO.pawn[1]+land(INTRO.pawn[2]))once('p'+f,()=>sndLand(0));   // 폰: 톡톡톡
    for(const t of [2,3,4,5,6])if(e>=INTRO.at[t]+land(t===KK?INTRO.kDur:INTRO.dur))once('t'+t,()=>sndLand(t-1));   // 계급이 오를수록 낮고 묵직하게
  }
  if(e>=(IN.again?INTRO.at[6]+GLIDE+40:INTRO.say)&&!IN.said){
    IN.said=true;$('#stage').classList.remove('ch-intro');if(elCh)elCh.classList.remove('intro');
    const w=V&&V.c?seatW():-1,p=w>=0&&V.ps[w];
    if(p)say(w===myIdx()?'내가 백으로 먼저 시작합니다.':`${p.n}님이 백으로 먼저 시작합니다.`);
    sfx('turn');lastBar='';if(Ch3.on)ch3Marks();
  }
  if(e>=G.introMs){IN.on=false;lastBar='';lastHint='';G.buttons()}
  drawAll();
}
const seatW=()=>V.c.co[0]===0?0:1;
/* 3D 화면에서 누른 곳 → 칸 (기물 몸통을 먼저, 아니면 판 윗면) */
const chRay=()=>Ch3.ray||(Ch3.ray=new THREE.Raycaster());
function ch3Point(e){
  const r=T.r.domElement.getBoundingClientRect();if(!r.width||!CS)return -1;
  const ray=chRay();ray.setFromCamera({x:(e.clientX-r.left)/r.width*2-1,y:-(e.clientY-r.top)/r.height*2+1},Ch3.cam);
  const objs=[];for(const g of Ch3.pcs.values())if(g.visible)for(const pm of g.userData.parts)objs.push(pm);
  const hit=ray.intersectObjects(objs,false)[0];
  if(hit){for(const [sq,g] of Ch3.pcs)if(g.userData.parts.includes(hit.object))return sq}
  const o=ray.ray.origin,dv=ray.ray.direction;if(Math.abs(dv.y)<1e-6)return -1;
  const k=(TOP-o.y)/dv.y,x=o.x+dv.x*k,z=o.z+dv.z*k;
  if(Math.abs(x)>HB||Math.abs(z)>HB)return -1;
  let f=Math.floor((x+HB)/S),rr=7-Math.floor((z+HB)/S);
  if(Ch3.flipT){f=7-f;rr=7-rr}
  return rr*16+f;
}
function ch3Click(e){
  if(!Ch3.on||G!==GAMES.chess)return;
  const sq=ch3Point(e);if(sq<0)return;
  tapSq(sq);
}
/* 새 상태를 받았을 때 */
G.preView=()=>{
  if(!V.c){CS=null;return}
  CS=buildS(V.c);OC.at=clock();
  const me=myIdx();
  if(!PV||!PV.c||PV.st!==V.st||V.c.mv.length<PV.c.mv.length||(V.c.mv.length===0&&PV.c.mv.length===0&&PV.c.A!==V.c.A)){sel=-1;pend=null;popOpen=false}
  else if(PV.c.mv.length!==V.c.mv.length){
    const myMove=me>=0&&V.c.lm&&(CS.p.b[V.c.lm[1]]>>3)===myCol();
    if(myMove){sel=-1;pend=null}
    else{
      // 상대가 둔 뒤: 고른 기물이 잡혔거나 미리 고른 수가 이제 안 되면 조용히 지움
      const col=myCol();
      if(sel>=0&&(!CS.p.b[sel]||(CS.p.b[sel]>>3)!==col)){sel=-1;pend=null}
      if(pend&&!legal(CS.p).some(m=>mFrom(m)===pend.from&&mTo(m)===pend.to)){pend=null}
    }
  }
  if(V.st!=='play'){sel=-1;pend=null;popOpen=false}
};
G.postView=()=>{};
G.overExtra=()=>{
  if(!V||!V.c||!V.c.sn||!V.c.sn.length)return '';
  return `<div class="qd-rec"><div class="qd-rec-h"><b>기보</b><button type="button" class="btn btn-sub ch-copy">기보 복사</button></div><pre>${esc(recordText(V))}</pre></div>`;
};
G.logCue=()=>false;
/* 소리: 기물이 놓이면 탁(도착하는 순간에 맞춤), 잡으면 딸깍이 더해짐, 체크면 두 음 */
G.cues=(v,pv)=>{
  if(!v.c||!pv.c)return;
  if(v.c.mv.length>pv.c.mv.length){
    const cap=(v.c.cp[0].length+v.c.cp[1].length)>(pv.c.cp[0].length+pv.c.cp[1].length);
    const at=Ch3.on?.22:0;sndPut(at,cap);
    if(v.c.chk&&v.st==='play')sndCheck(at+.12);
  }
};
G.hud=inGame=>{
  if(!elCh)return;
  const on=!!(inGame&&V&&V.c&&CS);
  elCh.hidden=!on;
  $('#stage').classList.toggle('ch-over',!!(on&&V.st==='over'));
  const d3=on&&ch3Build();
  if(d3!==Ch3.on){Ch3.on=d3;Ch3.lay='';if(Ch3.root)Ch3.root.visible=d3;$('#stage').classList.toggle('ch3d',d3);lastBoard='';lastHint=''}
  $('#stage').classList.toggle('ch2d',on&&!d3);
  if(!on){lastBoard='';lastBar='';lastHint='';lastModes='';return}
  drawAll();
  ch3Sync();
};
G.handMarks=()=>{};
G.me=(i,h)=>{
  $('#numpick').hidden=true;
  const p=V.ps[i];if(!p||!V.c||!CS)return;
  if(p.f){if(!p.sr)$('#meSub').innerHTML=CS.res&&CS.res.w<0?'<b>무승부</b>입니다.':`<b>${+p.f}위</b>입니다.`;return}
  $('#meSub').innerHTML=`<b>${CS.co[i]===0?'백':'흑'}</b>을 잡았습니다`;
};
G.specNote='관전 중입니다. 두 사람의 대국을 지켜봅니다.';
G.overRank=p=>{
  const r=V&&V.c&&V.c.res,t=p.sr===2?'시간 초과':p.sr===3?'탈주':p.sr?'항복':r&&r.w<0?'무승부':'';
  return t?`<span class="left">${t}</span>`:'';
};
G.usesDbl=true;
G.no3D=true;
G.buttons=()=>{
  const play=$('#btnPlay'),can=!!(pend&&myTurnNow());
  $('#btnPass').hidden=true;$('#btnGura').hidden=true;
  play.disabled=!can;play.classList.toggle('ready',can);
  if($('#playMain').textContent!=='두기')$('#playMain').textContent='두기';
  const sub=keyLabel(KEYS.play);if($('#playSub').textContent!==sub)$('#playSub').textContent=sub;
};
G.live=()=>{
  if(IN.on)introTick();
  if(!V||!V.c||!CS)return;
  clockTick();
  const me=myIdx();
  if(me>=0&&me<2){const mt=$('#meTime');const t=V.st==='play'?fmtT(remMs(me)):'';if(mt.textContent!==t)mt.textContent=t}
  if(flash&&!Ch3.on&&clock()-flash.at>720){flash=null;lastBoard='';drawAll()}
};
/* 이름 칸의 시간 (매 프레임 글자만 바꿈). 10초 남으면 빨갛게 깜빡임 */
function clockTick(){
  if(!elBar||!V||!V.c)return;
  elBar.querySelectorAll('[data-ct]').forEach(el=>{const i=+el.dataset.ct,ms=remMs(i),t=fmtT(ms);if(el.textContent!==t)el.textContent=t;
    const low=V.st==='play'&&V.t===i&&V.c.run&&ms<=10000;if(el.parentNode.classList.contains('low')!==low)el.parentNode.classList.toggle('low',low)});
}
G.play=confirmPend;
G.pass=()=>{};
G.keyPhase=st=>st==='play';
G.onKey=()=>false;
G.field3D=()=>{if(T.stacks)for(const arr of T.stacks.values())arr.forEach(c=>{c.visible=false})};
G.render3D=t=>{if(Ch3.on)ch3Render(t);else if(T.ok&&!$('#stage').classList.contains('ch2d'))T.r.render(T.scene,T.cam)};
G.enter=()=>{
  $('#stage').classList.add('ch');
  $('#btnPass').hidden=true;$('#btnGura').hidden=true;$('#numpick').hidden=true;
  sel=-1;pend=null;popOpen=false;
  if(elCh)fit();
};
G.leave=()=>{
  introEnd();
  $('#stage').classList.remove('ch','ch-over','ch3d','ch2d');
  if(T.stacks)for(const arr of T.stacks.values())arr.forEach(c=>{c.visible=true});
  if(Ch3.root)Ch3.root.visible=false;Ch3.on=false;Ch3.anim=[];
  $('#btnPass').hidden=false;
  if(elCh){elCh.hidden=true;lastBoard='';lastBar='';lastHint='';lastModes=''}
};
G.init=()=>{
  const css=document.createElement('style');
  css.textContent=`
.stage.ch{background:radial-gradient(ellipse at 50% 38%,#f3e4c2 0%,#e2c89a 70%,#d3b27c 100%)}
.stage.ch.ch2d #cv,.stage.ch #dim{visibility:hidden}
.stage.ch-intro .actions,.stage.ch-intro .myplate,.stage.ch-intro #ch .ch-row{opacity:0;pointer-events:none}
.stage.ch .actions,.stage.ch .myplate,#ch .ch-row,#ch .ch-bar{transition:opacity .35s}
#ch.intro .ch-bar{opacity:0}
.stage.ch3d #ch svg.ch-board{display:none}
.stage.ch3d #ch .ch-hint{flex:0 1 auto;background:rgba(255,250,240,.9);border:1px solid var(--line-strong,#cdb391);border-radius:99px;padding:4px 12px;box-shadow:0 2px 6px -2px rgba(59,42,31,.35)}
.stage.ch .labels{visibility:hidden}
.stage.ch .nogl{display:none}
.stage.ch.ch-over .myplate,.stage.ch.ch-over .actions{display:none}
.specbar:not([hidden])~#ch .ch-bar{margin-top:30px}
.stage.ch .actions{left:auto}
.stage.ch .myplate{max-width:calc(100% - 150px)}
#ch{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;gap:6px;padding:8px 10px 82px;pointer-events:none;min-height:0}
#ch[hidden]{display:none}
#ch .ch-bar{min-height:44px;display:flex;flex-wrap:wrap;gap:6px;align-self:flex-start;max-width:calc(100% - 188px);pointer-events:none}
#ch .ch-p{position:relative;display:flex;align-items:center;gap:6px;padding:4px 10px 5px;border-radius:12px;background:rgba(255,250,240,.92);border:1.5px solid var(--line-strong,#cdb391);font-size:13px;line-height:1.15;white-space:nowrap;max-width:100%}
#ch .ch-p.tap{pointer-events:auto;cursor:pointer}
#ch .dot{width:13px;height:13px;border-radius:50%;flex:none;display:inline-block;vertical-align:-2px}
#ch .dot.blk{background:#2b2724;box-shadow:0 0 0 2px #fffaf0,0 0 0 3px #555}
#ch .dot.wht{background:#f6efe0;box-shadow:0 0 0 2px #fffaf0,0 0 0 3px #8c7a5b}
#ch .ch-p b{font-weight:600;overflow:hidden;text-overflow:ellipsis;max-width:8em}
#ch .ch-p .w{font-family:var(--f-num,monospace);font-size:13px;font-weight:700;color:#5b4129;min-width:3em;text-align:right}
#ch .ch-p.low .w{color:#c0281c;animation:chBlink 1s steps(2,start) infinite}
@keyframes chBlink{50%{opacity:.25}}
#ch .ch-p .st{font-size:12px;color:var(--muted,#7a6550)}
#ch .ch-p.on{border-color:#c08a17;box-shadow:0 0 0 2px #f2b632}
#ch .ch-p .cp{display:inline-flex;margin-left:-2px}
#ch .ch-p .cp svg{margin-right:-5px}
#ch .ch-p .dr{font-weight:700;color:#7a4a10;background:#f2d27a;border-radius:99px;padding:0 6px;font-size:12px;animation:chPulse 1.4s ease-in-out infinite}
@keyframes chPulse{50%{box-shadow:0 0 0 3px rgba(242,182,50,.45)}}
#ch .ch-pop{position:absolute;left:0;top:calc(100% + 4px);z-index:5}
#ch .ch-drbtn,#ch .ch-m{height:34px;padding:0 12px;border-radius:10px;border:2px solid var(--mustard-edge,#c08a17);background:var(--mustard,#f2b632);color:#3b2a1f;font-family:var(--f-display,inherit);font-size:15px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;pointer-events:auto;white-space:nowrap}
#ch .ch-m.pro{padding:0 4px;background:rgba(255,250,240,.95);border-color:var(--line-strong,#cdb391)}
#ch .ch-m.pro.on{background:var(--mustard,#f2b632);border-color:var(--mustard-edge,#c08a17)}
#ch .ch-row{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;width:100%;pointer-events:none;min-height:44px}
.stage.ch3d #ch .ch-row{height:44px;min-height:0;flex:none;align-items:flex-start;padding-top:4px;overflow:visible;position:relative;z-index:1}
#ch .ch-hint:empty{visibility:hidden}
#ch .ch-hint{flex:1 1 200px;min-width:0;font-size:13px;line-height:1.3;color:#5b4129;text-align:center;min-height:17px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
#ch .ch-modes{display:flex;gap:4px;pointer-events:auto;flex-wrap:wrap;justify-content:center}
#ch .ch-modes:empty{display:none}
#ch .ch-bd{position:relative;flex:1;min-height:0;width:100%}
#ch svg.ch-board{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);pointer-events:auto;touch-action:manipulation;user-select:none;-webkit-user-select:none;filter:drop-shadow(0 6px 8px rgba(59,42,31,.35))}
#ch .ch-co{font-size:.26px;font-weight:700;fill:#f0d6aa;text-anchor:middle;dominant-baseline:central;font-family:var(--f-num,monospace)}
@media (max-width:520px){#ch .ch-p{font-size:12px;padding:3px 8px 4px;gap:5px}#ch .ch-m,#ch .ch-drbtn{height:32px;padding:0 10px;font-size:14px}#ch{padding-bottom:76px}#ch .ch-bar{max-width:calc(100% - 150px)}}
`;
  document.head.appendChild(css);
  elCh=document.createElement('div');elCh.id='ch';elCh.hidden=true;
  elCh.innerHTML=`<div class="ch-bar"></div><div class="ch-row"><div class="ch-hint" aria-live="polite"></div><div class="ch-modes" role="group" aria-label="고르기"></div></div><div class="ch-bd"><svg class="ch-board" viewBox="-.5 -.5 9 9" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="체스판"><defs><radialGradient id="chChk"><stop offset="0" stop-color="#ff2a14" stop-opacity=".95"/><stop offset=".6" stop-color="#e01e14" stop-opacity=".5"/><stop offset="1" stop-color="#c8140a" stop-opacity="0"/></radialGradient></defs><g id="chMain"></g><g id="chGhost"></g></svg></div>`;
  $('#stage').insertBefore(elCh,$('#fx'));
  elSvg=elCh.querySelector('svg.ch-board');elMain=elCh.querySelector('#chMain');elGhost=elCh.querySelector('#chGhost');
  elBar=elCh.querySelector('.ch-bar');elHint=elCh.querySelector('.ch-hint');elModes=elCh.querySelector('.ch-modes');
  elSvg.addEventListener('click',onSvgClick);
  elModes.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.pro)setPro(+b.dataset.pro);else if(b.dataset.dr)sendDraw()});
  elBar.addEventListener('click',e=>{
    const b=e.target.closest('[data-dr]');if(b){e.stopPropagation();sendDraw();return}
    if(e.target.closest('[data-me]')){e.chPop=1;popOpen=!popOpen;lastBar='';drawAll()}
  });
  document.addEventListener('click',e=>{if(popOpen&&elCh&&!e.chPop){popOpen=false;lastBar='';drawAll()}});   // 바깥을 누르면 닫힘 (칸을 다시 그리므로 e.target 대신 표시로 판단)
  document.addEventListener('keydown',e=>{if(e.code==='Escape'&&(pend||sel>=0)&&elCh&&!elCh.hidden)cancelSel()});
  window.addEventListener('resize',()=>{fit();Ch3.lay=''});
  $('#cv').addEventListener('click',ch3Click);
  document.addEventListener('click',e=>{
    const b=e.target.closest('.ch-copy');if(!b||!V||!V.c)return;
    const txt=recordText(V),done=ok=>{b.textContent=ok?'복사했습니다':'복사하지 못했습니다';setTimeout(()=>{b.textContent='기보 복사'},1600)};
    try{navigator.clipboard.writeText(txt).then(()=>done(true),()=>done(false))}catch(_){done(false)}
  });
};
G._ch3={Ch3,IN,introEnd,sqW,get CS(){return CS},tapSq,myMoves,movesFrom,get sel(){return sel},get pend(){return pend},get flash(){return flash}};   // 화면 검사용

(window.GAMES=window.GAMES||{}).chess=G;
})();
