/* 탁자하나 서비스 워커: 항상 최신 버전을 먼저 받고, 인터넷이 끊겼을 때만 저장해 둔 화면을 보여줌 */
const CACHE='gura-v1';
/* 브라우저 캐시(GitHub Pages는 10분)를 건너뛰고 서버에 바뀌었는지 물어봄(no-cache: 안 바뀌었으면 304로 가볍게). 그래야 올린 직후에도 새 파일이 바로 보임 */
const fresh=req=>req.mode==='navigate'?new Request(req.url,{cache:'no-cache',credentials:'same-origin'}):new Request(req,{cache:'no-cache'});
self.addEventListener('install',e=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET'||new URL(req.url).origin!==location.origin)return;
  e.respondWith(fetch(fresh(req)).then(res=>{
    if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy))}
    return res;
  }).catch(()=>caches.match(req).then(r=>r||caches.match('./'))));
});
