// Service Worker Construtora Martins - Versão v8-final
const CACHE_NAME = 'martins-rdo-v8-final';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key.startsWith('martins-rdo-')).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Sempre busca da rede para não prender arquivos desatualizados
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
