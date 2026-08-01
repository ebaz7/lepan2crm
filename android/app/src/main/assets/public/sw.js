const CACHE_NAME = 'finance-app-v4';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => console.log("Assets not found yet"));
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  // We only cache GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Handle page navigation
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Clone and cache the navigated page
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Network first with cache fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // If it's a valid successful response, cache it for offline use (if it's not an API call)
        const url = event.request.url;
        if (response.status === 200 && !url.includes('/api/') && !url.includes('chrome-extension')) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME) {
              return caches.delete(name);
            }
          })
        );
      })
    ])
  );
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  try {
    const data = event.data.json();
    const options = {
      body: data.body || 'اعلان جدید',
      icon: 'https://cdn-icons-png.flaticon.com/512/3135/3135706.png',
      badge: 'https://cdn-icons-png.flaticon.com/512/3135/3135706.png',
      data: {
        url: data.url || '/'
      },
      vibrate: [200, 100, 200],
      dir: 'rtl',
      lang: 'fa-IR',
      tag: 'payment-msg',
      renotify: true
    };
    
  event.waitUntil(
    self.registration.showNotification(data.title || 'سامانه مالی', options)
      .catch(err => console.error('Notification show error:', err))
  );
  } catch (e) {
    console.error('Push handling error:', e);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  let targetUrl = event.notification.data.url || '/';
  if (!targetUrl.startsWith('http')) {
    targetUrl = new URL(targetUrl, self.location.origin).href;
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // 1. Try to find an existing focused window on our origin
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.focus();
          if ('navigate' in client && client.url !== targetUrl) {
            return client.navigate(targetUrl);
          }
          return;
        }
      }
      // 2. Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
