const CACHE_NAME = 'km-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isHtml =
    req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');

  // HTML всегда берём из сети: иначе старая страница просит удалённые файлы.
  if (isHtml) {
    event.respondWith(
      fetch(req).catch(() => caches.match(req).then((r) => r || caches.match('/')))
    );
    return;
  }

  // Файлы сборки имеют уникальные имена — их можно кэшировать надолго.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        return response;
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Новое уведомление';
  const options = {
    body: data.body || 'У вас новое уведомление',
    icon: 'https://cdn.poehali.dev/projects/f80fd906-4206-41c6-bbee-1ea450433e49/files/favicon-1766477326634.svg',
    badge: 'https://cdn.poehali.dev/projects/f80fd906-4206-41c6-bbee-1ea450433e49/files/favicon-1766477326634.svg',
    data: data.url || '/',
    tag: data.tag || 'notification',
    requireInteraction: true,
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data || '/')
  );
});