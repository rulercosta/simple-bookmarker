const CACHE_NAME = 'bookmarker-app-v1';
const ASSETS = [
  '/simple-bookmarker/',
  '/simple-bookmarker/index.html',
  '/simple-bookmarker/static/styles.css',
  '/simple-bookmarker/static/script.js',
  '/simple-bookmarker/static/manifest.json',
  '/simple-bookmarker/README.md',
  '/simple-bookmarker/static/android-chrome-192x192.png',
  '/simple-bookmarker/static/android-chrome-512x512.png',
  '/simple-bookmarker/static/apple-touch-icon.png',
  '/simple-bookmarker/static/favicon-32x32.png',
  '/simple-bookmarker/static/favicon-16x16.png',
  '/simple-bookmarker/static/favicon.ico'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return Promise.allSettled(
          ASSETS.map(asset =>
            cache.add(asset).catch(error => {
              console.warn(`Failed to cache asset: ${asset}`, error);
            })
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        return response || fetch(event.request)
          .then((fetchResponse) => {
            return caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, fetchResponse.clone());
                return fetchResponse;
              });
          });
      })
      .catch(() => {
        return new Response('Offline content not available');
      })
  );
});