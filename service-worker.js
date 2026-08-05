const CACHE='spididay-v2.4.3';
const APP_SHELL=['./','./index.html','./styles.css?v=29','./data/quotes.js?v=19','./data/motivation-messages.js?v=1','./db.js?v=12','./app.js?v=1.1.1','./story.js?v=2.4.1','./compass.js?v=15','./data/verses-rv1909.js','./manifest.webmanifest?v=2','./mascot-spidi-marea.svg?v=13','./decorations-marea.svg','./assets/origin-spididay.png','./fonts/Manrope-Variable.ttf','./fonts/Fraunces-Variable.ttf','./icons/icon-192.png?v=2','./icons/icon-512.png?v=2'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(APP_SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==location.origin)return;
  if(/\/(app\.js|styles\.css)$/.test(new URL(event.request.url).pathname)){
    event.respondWith(fetch(event.request).then(response=>{if(response.ok)caches.open(CACHE).then(cache=>cache.put(event.request,response.clone()));return response}).catch(()=>caches.match(event.request)));
    return;
  }
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).then(response=>{if(response.ok)caches.open(CACHE).then(cache=>cache.put('./index.html',response.clone()));return response}).catch(()=>caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy))}return response})));
});



















