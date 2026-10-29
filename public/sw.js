// Pages from the network (fresh after every deploy), data and assets from the cache with background refresh.
const VERSION = 'kr-2.0.0';
const CORE = ['/', '/icon.svg', '/icon-192.png', '/manifest.webmanifest', '/ashdod-logo.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)));
});
self.addEventListener('message', e => { if (e.data === 'skip') self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put('/', copy)); return r; }).catch(() => caches.match('/')));
    return;
  }
  const sameOrigin = url.origin === location.origin;
  const tiles = /tiles\.openfreemap\.org|arcgisonline\.com|fonts\.(googleapis|gstatic)\.com/.test(url.host);
  if (sameOrigin || tiles) {
    e.respondWith(caches.open(VERSION).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(r => { if (r.ok && (sameOrigin || r.type === 'cors' || r.type === 'basic')) c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
  }
});
