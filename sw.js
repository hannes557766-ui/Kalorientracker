/* Kalorify Service Worker
   - Safe app-shell caching for PWA starts
   - Network-first navigations to avoid stale white screens
   - Stale-while-revalidate for same-origin static assets
   - No caching for Firebase/API calls
*/

const SW_VERSION = 'kalorify-sw-2026-07-07-01';

const APP_CACHE = `${SW_VERSION}-app`;
const RUNTIME_CACHE = `${SW_VERSION}-runtime`;

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './vendor/html5-qrcode.min.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png'
];

const NETWORK_TIMEOUT_MS = 3500;

function isHttpRequest(request) {
  return request && (request.url.startsWith('http://') || request.url.startsWith('https://'));
}

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isApiOrAuthRequest(url) {
  const host = url.hostname;
  const path = url.pathname;
  return (
    host.includes('firebaseio.com') ||
    host.includes('firebaseapp.com') ||
    host.includes('googleapis.com') ||
    host.includes('gstatic.com') ||
    host.includes('anthropic.com') ||
    host.includes('groq.com') ||
    host.includes('mistral.ai') ||
    host.includes('openfoodfacts.org') ||
    host.includes('usda.gov') ||
    host.includes('api.apilayer.com') ||
    host.includes('fatsecret.com') ||
    path.startsWith('/api/')
  );
}

async function cachePutSafe(cacheName, request, response) {
  try {
    if (!response || !request || request.method !== 'GET') return;
    if (!(response.ok || response.type === 'opaque')) return;
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
  } catch (_) {
    // Ignore quota/cache errors. App must never crash because of caching.
  }
}

async function addAppShell() {
  const cache = await caches.open(APP_CACHE);
  await Promise.allSettled(
    APP_SHELL.map(async item => {
      try {
        const response = await fetch(item, { cache: 'reload' });
        if (response && (response.ok || response.type === 'opaque')) {
          await cache.put(item, response);
        }
      } catch (_) {
        // Individual assets may not exist on every host. That's fine.
      }
    })
  );
}

async function networkFirst(request) {
  const cache = await caches.open(APP_CACHE);
  const networkPromise = fetch(request).then(async response => {
    if (response && response.ok) {
      await cachePutSafe(APP_CACHE, request, response);
    }
    return response;
  });
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('network-timeout')), NETWORK_TIMEOUT_MS);
  });
  try {
    return await Promise.race([networkPromise, timeoutPromise]);
  } catch (_) {
    return (
      (await caches.match(request)) ||
      (await caches.match('./')) ||
      (await caches.match('./index.html')) ||
      offlineFallback()
    );
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const fetchPromise = fetch(request)
    .then(response => {
      cachePutSafe(RUNTIME_CACHE, request, response);
      return response;
    })
    .catch(() => null);
  return cached || (await fetchPromise) || offlineFallback();
}

function offlineFallback() {
  return new Response(
    `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Kalorify offline</title>
  <style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#F8F9FA;color:#212529;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
    div{max-width:360px;padding:24px;text-align:center}
    h1{font-size:24px;margin:0 0 8px}p{color:#6C757D;line-height:1.45}
  </style>
</head>
<body><div><h1>Kalorify ist offline</h1><p>Die App konnte gerade nicht geladen werden. Bitte öffne sie erneut, sobald du wieder online bist.</p></div></body>
</html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

self.addEventListener('install', event => {
  event.waitUntil(addAppShell());
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(key => !key.startsWith(SW_VERSION))
        .map(key => caches.delete(key))
    );
    if (self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.enable(); } catch (_) {}
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (!isHttpRequest(request) || request.method !== 'GET') return;
  const url = new URL(request.url);
  if (isApiOrAuthRequest(url)) {
    // Auth/API calls must stay fresh. Never cache them.
    return;
  }
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }
  if (isSameOrigin(url)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

self.addEventListener('message', event => {
  const type = event.data && event.data.type;
  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (type === 'CLEAR_KALORIFY_CACHES') {
    event.waitUntil(
      caches.keys().then(keys => Promise.all(keys.map(key => caches.delete(key))))
    );
  }
});
