const PREFIX=`fifa22-${new URL(self.registration.scope).pathname}-`;
const CACHE=PREFIX+'__VERSION__';
const FILES=['./','./index.html','./app.js','./catalog.js','./data/fifa22-sofifa-220002.json','./engine.js','./storage.js','./style.css','./pwa.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./icons/icon-maskable.png','./icons/apple-touch-icon.png'];
const urls=FILES.map(path=>new URL(path,self.registration.scope).href);
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(urls))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith(PREFIX)&&key!==CACHE)await caches.delete(key);await self.clients.claim();})()));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;
 if(request.mode==='navigate'){
  event.respondWith((async()=>{try{const response=await fetch(request);if(response.ok){const cache=await caches.open(CACHE);await cache.put(new URL('./index.html',self.registration.scope),response.clone());return response;}}catch{}return (await caches.open(CACHE)).match(new URL('./index.html',self.registration.scope));})());return;
 }
 if(urls.includes(url.href))event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(request))||fetch(request)));
});
