const CACHE = 'guardian-dragon-art-v19';
const CORE = [
  '/',
  '/index.html',
  '/core/res/font/world-fonts.css?v=10',
  '/core/res/world/interface-shell.css?v=10',
  '/core/res/world/visual-novel.css?v=10',
  '/core/res/world/app.css?v=16',
  '/core/res/world/menu-shell.js?v=10',
  '/core/res/world/annals-shell.js?v=15',
  '/core/res/world/world-era-intro.js?v=19',
  '/core/res/world/mvu-shell.js?v=10',
  '/core/res/world/world-mvu-content.js?v=17',
  '/core/res/world/game-ui-shell.js?v=18',
  '/core/res/world/visual-novel.js?v=10',
  '/core/res/world/app.js?v=19',
  '/core/res/world/lore-retrieval.mjs',
  '/core/res/world/runtime.mjs',
  '/core/res/data/world/index.json',
  '/core/res/data/world/customization.json',
  '/core/res/data/world/timeline-arcs.json',
  '/core/res/data/world/era-intros.json',
  '/core/res/data/world/vn-images.json',
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
