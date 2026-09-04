const CACHE = 'guardian-dragon-art-v59';
const CORE = [
  '/',
  '/index.html',
  '/core/res/font/world-fonts.css?v=10',
  '/core/res/font/metropolitain.ttf',
  '/core/res/font/zcool-kuaile-menu.ttf',
  '/core/res/world/interface-shell.css?v=13',
  '/core/res/world/visual-novel.css?v=10',
  '/core/res/world/app.css?v=36',
  '/core/res/world/nouveau-base.css?v=2',
  '/core/res/world/theme.css?v=14',
  '/core/res/world/menu-shell.js?v=14',
  '/core/res/world/annals-shell.js?v=17',
  '/core/res/world/world-era-intro.js?v=19',
  '/core/res/vendor/three.r128.min.js',
  '/core/res/world/world-planet-map.js?v=40',
  '/core/res/world/visual-novel.js?v=10',
  '/core/res/world/app.js?v=29',
  '/core/res/world/engine.js?v=9',
  '/core/res/world/sonus.js?v=1',
  '/core/res/world/lore-retrieval.mjs',
  '/core/res/world/runtime.mjs',
  '/core/res/data/world/index.json',
  '/core/res/data/world/customization.json',
  '/core/res/data/world/timeline-arcs.json',
  '/core/res/data/world/era-intros.json',
  '/core/res/data/world/vn-images.json',
  '/core/res/data/world/world-map.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))));
  self.clients.claim();
});

/* 大档（叙事内核的向量模型、wasm）不进 SW 缓存：配额一满浏览器会连本站存档一起清。
   代码类网络优先，断网回落缓存；其余素材缓存优先、后台回源刷新。 */
const MAXB = 4 * 1024 * 1024;
function cacheable(response) {
  const n = parseInt(response.headers.get('content-length') || '', 10);
  if (isNaN(n)) return false;
  return n <= MAXB;
}
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  let url;
  try { url = new URL(request.url); } catch (_) { return; }
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/_vercel/') || url.pathname.startsWith('/cdn-cgi/')) return;
  if (request.mode === 'navigate' || /\.(js|mjs|json|webmanifest|html|css)$/i.test(url.pathname)) {
    event.respondWith(fetch(request).then((response) => {
      if (response && response.ok && response.type === 'basic') {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy).catch(() => {}));
      }
      return response;
    }).catch(() => caches.match(request).then((hit) => hit || Response.error())));
    return;
  }
  event.respondWith(caches.match(request).then((hit) => {
    const net = fetch(request).then((response) => {
      if (response && response.ok && response.type === 'basic' && cacheable(response)) {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy).catch(() => {}));
      }
      return response;
    }).catch(() => hit || Response.error());
    return hit || net;
  }));
});
