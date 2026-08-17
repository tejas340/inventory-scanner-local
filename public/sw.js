const CACHE_NAME = 'inventory-scanner-v3';
const ASSETS = ['/', '/index.html', '/styles.css', '/app.js', '/scanner-photo-fix.js', '/icon.svg', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== location.origin) return;
  if (request.url.includes('/api/')) return;
  event.respondWith(
    fetch(request).then((response) =>
      caches.open(CACHE_NAME).then((cache) => {
        cache.put(request, response.clone());
        return response;
      })
    ).catch(() =>
      caches.match(request).then((cached) => cached || caches.match('/index.html'))
    )
  );
});