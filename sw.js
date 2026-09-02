// Service Worker para PWA (Progressive Web App) - InventarioG
const CACHE_NAME = 'inventariog-pwa-v5';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => caches.delete(key)));
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Pasar directamente a Apache/PHP sin interceptar ni guardar en caché
  return;
});
