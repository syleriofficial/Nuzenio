const CACHE_NAME = 'nuzenio-static-v2';
const STATIC = [
  '/offline.html',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
];

function cacheableRequest(request) {
  const url = new URL(request.url);
  return (
    request.method === 'GET' &&
    url.origin === self.location.origin &&
    !url.search &&
    !request.headers.has('authorization') &&
    !request.headers.has('rsc') &&
    !request.headers.has('next-router-state-tree') &&
    (STATIC.includes(url.pathname) || url.pathname.startsWith('/_next/static/'))
  );
}

function cacheableResponse(response) {
  return (
    response.ok &&
    !response.redirected &&
    !/(?:no-store|private)/i.test(
      response.headers.get('cache-control') || '',
    ) &&
    !/text\/x-component/i.test(response.headers.get('content-type') || '')
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      for (const path of STATIC) {
        const response = await fetch(path, {
          credentials: 'omit',
          cache: 'reload',
        });
        if (cacheableResponse(response)) await cache.put(path, response);
      }
    })(),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('nuzenio-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (!cacheableRequest(request)) {
    // Every API/private request and every RSC payload is network-only. Never
    // consult legacy caches or return successful HTML for a failed API request.
    const publicNavigation =
      request.method === 'GET' &&
      request.mode === 'navigate' &&
      url.origin === self.location.origin &&
      ['/', '/for-you', '/local', '/briefs', '/following', '/search'].includes(
        url.pathname,
      );
    if (publicNavigation)
      event.respondWith(
        fetch(request).catch(async () =>
          (await caches.open(CACHE_NAME))
            .match('/offline.html')
            .then((cached) => cached || Response.error()),
        ),
      );
    return;
  }
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request, { credentials: 'omit' });
        if (cacheableResponse(response))
          await cache.put(request, response.clone());
        return response;
      } catch {
        return (await cache.match(request)) || Response.error();
      }
    })(),
  );
});
