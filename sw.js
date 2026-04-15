const CACHE_NAME = 'kalorify-v1';

// Diese Dateien werden beim ersten Start auf das Handy geladen und gespeichert
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap',
  'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js'
];

// Installation: Cachen der Basis-Dateien
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching Dateien');
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
  self.skipWaiting();
});

// Aktivierung: Alte Caches aufräumen, falls du später Updates machst
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Alter Cache gelöscht', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch: Das Handy fragt nach einer Datei (z.B. index.html)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Wenn wir die Datei gespeichert haben, gib sie sofort zurück (Offline-Support)
        if (cachedResponse) {
          // Im Hintergrund versuchen wir trotzdem die neuste Version aus dem Netz zu laden
          fetch(event.request).then((networkResponse) => {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse.clone());
            });
          }).catch(() => {}); // Wenn kein Internet da ist, ignoriere den Fehler
          return cachedResponse;
        }
        
        // Wenn die Datei nicht im Cache ist, lade sie normal aus dem Internet
        return fetch(event.request).then((networkResponse) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        });
      })
  );
});
