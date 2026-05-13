const CACHE_NAME = 'driveapp-v1';
const STATIC_URLS = [
  '/',
  '/dashboard',
  '/offline',
];

// Install — pre-cache app shell
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_URLS).catch(() => {}))
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — strategy per resource type
self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Skip non-GET, cross-origin, socket, HMR
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/socketio')) return;
  if (url.pathname.startsWith('/_next/webpack-hmr')) return;

  // API routes — network-first with 3s timeout, no caching for real-time data
  if (url.pathname.startsWith('/api/')) {
    // Only cache non-real-time endpoints
    const cacheable = ['/api/xp', '/api/leaderboard', '/api/routes/public', '/api/dashboard/stats'];
    const shouldCache = cacheable.some((p) => url.pathname.startsWith(p));

    if (shouldCache) {
      e.respondWith(
        fetch(request)
          .then((res) => {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clone));
            return res;
          })
          .catch(() => caches.match(request))
      );
    }
    return;
  }

  // Static assets (_next/static) — cache-first
  if (url.pathname.startsWith('/_next/static/')) {
    e.respondWith(
      caches.match(request).then((cached) => cached ?? fetch(request).then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(request, clone));
        return res;
      }))
    );
    return;
  }

  // Pages — network-first, fallback to cache, then offline page
  e.respondWith(
    fetch(request)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(request, clone));
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        const offline = await caches.match('/offline');
        return offline ?? new Response('Offline', { status: 503 });
      })
  );
});

// Push notifications
self.addEventListener('push', (e) => {
  if (!e.data) return;
  let payload;
  try { payload = e.data.json(); } catch { payload = { title: 'DriveApp', body: e.data.text() }; }

  e.waitUntil(
    self.registration.showNotification(payload.title ?? 'DriveApp', {
      body: payload.body,
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: payload.tag ?? 'driveapp',
      data: payload.url ?? '/dashboard',
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then((cs) => {
      const url = e.notification.data ?? '/dashboard';
      const existing = cs.find((c) => c.url === url && 'focus' in c);
      if (existing) return existing.focus();
      return clients.openWindow(url);
    })
  );
});
