const VERSION='b0d05c6c3085c56d';
const PREFIX=`fifa22-${new URL(self.registration.scope).pathname}-`;
const CACHE=PREFIX+VERSION;
const IMAGE_CACHE=PREFIX+'team-images-v1';
const FILES=['./','./index.html','./app.js','./bracket.js','./catalog.js','./data/fifa22-sofifa-220002.json','./engine.js','./storage.js','./style.css','./pwa.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./icons/icon-maskable.png','./icons/apple-touch-icon.png'];
const urls=FILES.map(path=>new URL(path,self.registration.scope).href);
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 // Refresh the HTTP cache as well; never build a release from stale assets.
 await Promise.all(urls.map(async url=>{
  const fresh=new URL(url);fresh.searchParams.set('v',VERSION);
  const response=await fetch(fresh,{cache:'reload'});
  if(!response.ok)throw Error('Appbestand kon niet worden vernieuwd: '+fresh.pathname);
  await cache.put(url,response);
 }));
 await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const key of await caches.keys())if(key.startsWith(PREFIX)&&key!==CACHE&&key!==IMAGE_CACHE)await caches.delete(key);
 await self.clients.claim();
 // Tell current clients that a release is ready; they choose when to reload.
 for(const client of await self.clients.matchAll({type:'window'}))client.postMessage({type:'APP_UPDATED',version:VERSION});
})()));
self.addEventListener('message',event=>{
 if(event.data?.type==='GET_VERSION')event.ports[0]?.postMessage({version:VERSION});
});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method==='GET'&&request.destination==='image'&&url.hostname==='cdn.sofifa.net'){event.respondWith((async()=>{const cache=await caches.open(IMAGE_CACHE);const saved=await cache.match(request);if(saved)return saved;try{const response=await fetch(request);if(response.ok||response.type==='opaque'){try{await cache.put(request,response.clone());}catch{}}return response;}catch{return Response.error();}})());return;}
 if(request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;
 if(request.mode==='navigate'){
  event.respondWith((async()=>{try{const response=await fetch(request,{cache:'no-cache'});if(response.ok){const cache=await caches.open(CACHE);await cache.put(new URL('./index.html',self.registration.scope),response.clone());return response;}}catch{}return (await caches.open(CACHE)).match(new URL('./index.html',self.registration.scope));})());return;
 }
 // Both versioned and legacy requests use the active release's offline cache.
 const key=url.origin+url.pathname;
 if(urls.includes(key))event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(key))||fetch(request)));
});
