/*
 * Service worker mínimo de la PWA del portal de clientes.
 *
 * Estrategia deliberadamente conservadora: la app, los JS/CSS con hash y la
 * API NUNCA se cachean, así un deploy o un reinicio siempre se ven al
 * instante (sin el clásico problema de "no me actualiza"). Sólo se guardan
 * los iconos y el manifest, que son estáticos.
 */

const STATIC_CACHE = 'robles-static-v1';
const STATIC_ASSETS = ['/icons/icon-192.png', '/icons/icon-512.png', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Nada de API ni de navegaciones: siempre red.
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api')) {
    return;
  }

  // Estáticos inmutables: cache-first con respaldo en red.
  if (url.pathname.startsWith('/icons/') || url.pathname === '/manifest.webmanifest') {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(STATIC_CACHE).then((cache) => cache.put(req, copy));
        return res;
      }))
    );
  }
  // Todo lo demás (index.html, assets con hash): red, sin cache local.
});
