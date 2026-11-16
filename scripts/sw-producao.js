// O build substitui o marcador por uma impressão digital dos arquivos.
const CACHE_NAME = 'martins-erp-prod-__REVISAO__';
const CACHE_ANTIGO = /^(?:martins-erp-(?:qa-|prod-)|martins-rdo-v)/;
const ASSETS = ['./favicon.png', './logo_martins.png', './icon-192.png', './icon-512.png']
  .map(asset => new URL(asset, self.registration.scope).href);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const nomes = await caches.keys();
    await Promise.all(nomes.filter(nome => nome !== CACHE_NAME && CACHE_ANTIGO.test(nome))
      .map(nome => caches.delete(nome)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || !ASSETS.includes(event.request.url)) return;
  event.respondWith(caches.open(CACHE_NAME)
    .then(cache => cache.match(event.request))
    .then(resposta => resposta || fetch(event.request)));
});
