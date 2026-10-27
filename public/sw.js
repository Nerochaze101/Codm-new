// Service Worker for CODM Stake 1v1 Mobile & Browser Notifications
const CACHE_NAME = 'ops-stake-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/aistudio/IMG_2853_9c73529e.jpeg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Cache-first strategy for assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  
  // Always fetch API calls from network
  if (url.pathname.startsWith('/api/')) {
    return event.respondWith(fetch(request));
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      });

      // For core UI files, use cache-first. For others, use stale-while-revalidate.
      const isCoreUI = ASSETS_TO_CACHE.includes(url.pathname) || url.pathname.endsWith('.js') || url.pathname.endsWith('.css');
      
      if (cachedResponse && isCoreUI) {
        return cachedResponse;
      }
      
      return cachedResponse || fetchPromise;
    }).catch(() => {
      return caches.match('/');
    })
  );
});

// Handle phone lock-screen / notification drawer tap
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/arena';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing tab if open
      for (const client of clientList) {
        if ('focus' in client) {
          if (client.url && client.url.includes(self.location.origin)) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
      }
      // Otherwise open a new window/tab
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Receive notification events from page or push
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    // Add custom sound hint for supported platforms
    const enhancedOptions = {
      ...options,
      sound: '/assets/audio/shotgun.mp3' 
    };
    self.registration.showNotification(title, enhancedOptions);
  }
});

// Native Push Event handler for lock-screen push notifications
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'CODM Stake 1v1', body: event.data ? event.data.text() : 'Match state updated!' };
  }

  const title = data.title || '⚔️ CODM Match Alert';
  const options = {
    body: data.body || 'Your challenge has an update.',
    icon: data.icon || '/assets/aistudio/IMG_2853_9c73529e.jpeg',
    badge: data.badge || '/assets/aistudio/IMG_2853_9c73529e.jpeg',
    vibrate: [200, 100, 200, 100, 250],
    data: data.data || { url: '/arena' },
    tag: data.tag || `codm_alert_${Date.now()}`,
    requireInteraction: true,
    silent: false,
    sound: '/assets/audio/shotgun.mp3' // Attempt custom sound in push
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

