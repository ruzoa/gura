/* 탁자하나 서비스 워커: 항상 최신 버전을 먼저 받고, 인터넷이 끊겼을 때만 저장해 둔 화면을 보여줌 */
const CACHE='gura-v1';
self.addEventListener('install',e=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET'||new URL(req.url).origin!==location.origin)return;
  e.respondWith(fetch(req).then(res=>{
    if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy))}
    return res;
  }).catch(()=>caches.match(req).then(r=>r||caches.match('./'))));
});
