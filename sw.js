const CACHE = 'guardian-dragon-art-v5';
const CORE = [
  '/',
  '/index.html',
  '/core/res/world/interface-shell.css?v=5',
  '/core/res/world/app.css?v=5',
  '/core/res/world/menu-shell.js?v=5',
  '/core/res/world/app.js?v=5',
  '/core/res/world/runtime.mjs',
  '/core/res/data/world/index.json',
  '/core/res/data/world/customization.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(fetch(event.request).then((response) => {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request)));
});
