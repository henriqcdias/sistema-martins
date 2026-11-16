const CACHE_NAME = 'martins-erp-qa-rbac';
const ASSETS_TO_PRECACHE = [
  './',
  './index.html',
  './qa-public-settings.js?v=3',
  './qa-config.js?v=3',
  './qa-auth-ui.js?v=8',
  './manifest.json',
  './favicon.png',
  './logo_martins.png',
  './icon-192.png',
  './icon-512.png',
  './dist/martins-offline.min.css',
  './dist/vendor.min.js',
  './dist/app-martins.min.js?t=20261114_rbac_qa'
];

// Estado observável de saúde do pré-cache (nunca engole falhas silenciosamente!)
self.STATUS_PRECACHE_SW = {
  instaladoComSucesso: false,
  ativosCacheados: [],
  ativosComFalha: [],
  ultimaVerificacaoIso: null
};

async function executarPrecacheVerificado(cache) {
  const cacheados = [];
  const falhas = [];

  // 1. Tenta cache.addAll() rápido
  try {
    await cache.addAll(ASSETS_TO_PRECACHE);
    self.STATUS_PRECACHE_SW = {
      instaladoComSucesso: true,
      ativosCacheados: [...ASSETS_TO_PRECACHE],
      ativosComFalha: [],
      ultimaVerificacaoIso: new Date().toISOString()
    };
    return self.STATUS_PRECACHE_SW;
  } catch (errBatch) {
    // 2. Se qualquer ativo falhar no addAll, audita individualmente cada ativo para detectar e registrar a falha exata!
    for (const urlAtivo of ASSETS_TO_PRECACHE) {
      try {
        const resp = await fetch(urlAtivo, { cache: 'no-cache' });
        if (!resp || !resp.ok) {
          throw new Error(`HTTP ${resp ? resp.status : 'ERRO_REDE'} em ${urlAtivo}`);
        }
        await cache.put(urlAtivo, resp.clone());
        cacheados.push(urlAtivo);
      } catch (errIndividual) {
        falhas.push({ url: urlAtivo, erro: String(errIndividual.message || errIndividual) });
      }
    }

    self.STATUS_PRECACHE_SW = {
      instaladoComSucesso: falhas.length === 0,
      ativosCacheados: cacheados,
      ativosComFalha: falhas,
      ultimaVerificacaoIso: new Date().toISOString()
    };

    // Notifica clientes abertos caso algum ativo essencial tenha falhado no pré-cache
    if (falhas.length > 0 && self.clients && typeof self.clients.matchAll === 'function') {
      const clientes = await self.clients.matchAll({ includeUncontrolled: true });
      clientes.forEach((cli) => {
        cli.postMessage({
          tipo: 'SW_PRECACHE_FALHA_DETECTADA',
          cacheName: CACHE_NAME,
          ativosComFalha: falhas,
          ativosCacheadosCount: cacheados.length
        });
      });
    }
    return self.STATUS_PRECACHE_SW;
  }
}

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => executarPrecacheVerificado(cache))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) {
            return caches.delete(k);
          }
          return Promise.resolve(false);
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  // Navegações do Auth nunca usam HTML antigo nem entram no cache de navegação.
  // O fragmento não chega ao service worker, por isso toda navegação online revalida.
  const url = new URL(e.request.url);
  if (e.request.mode === 'navigate' && url.origin === self.location.origin) {
    const retornoAuth = ['recuperar','token_hash','code','error','error_code','type']
      .some(key => url.searchParams.has(key));
    e.respondWith(fetch(e.request, { cache: 'no-store' }).catch(() => {
      if (retornoAuth) return Response.error();
      return caches.open(CACHE_NAME).then(cache => cache.match('./index.html'))
        .then(response => response || Response.error());
    }));
    return;
  }


  // Regra de Segurança Offline: NUNCA armazenar em cache respostas de API privadas,
  // tokens de autenticação, holerites ou dados financeiros sensíveis!
  const urlStr = String(e.request.url || '').toLowerCase();
  const ehRotaPrivadaNaoCacheavel =
    urlStr.includes('/auth/') ||
    urlStr.includes('/rest/v1/') ||
    urlStr.includes('/storage/v1/object/sign') ||
    urlStr.includes('holerite') ||
    urlStr.includes('privado');

  if (ehRotaPrivadaNaoCacheavel) {
    e.respondWith(fetch(e.request));
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return networkResponse;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
