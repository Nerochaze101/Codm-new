// Service Worker for CODM Stake 1v1 Mobile & Browser Notifications
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
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
    self.registration.showNotification(title, options);
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
    icon: data.icon || '/18012397-6DAC-458A-9230-E51DC47747A9.png',
    badge: data.badge || '/18012397-6DAC-458A-9230-E51DC47747A9.png',
    vibrate: [200, 100, 200, 100, 250],
    data: data.data || { url: '/arena' },
    tag: data.tag || `codm_alert_${Date.now()}`,
    requireInteraction: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

