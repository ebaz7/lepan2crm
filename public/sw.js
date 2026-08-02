const CACHE_NAME = 'finance-app-v6';
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

// Function to mark notification as shown in CacheStorage
async function markAsShownInCache(id) {
  if (!id) return;
  try {
    const cache = await self.caches.open('shown-notifications-v1');
    await cache.put(
      new Request(`/notification-shown/${id}`),
      new Response('true', { headers: { 'Content-Type': 'text/plain' } })
    );
  } catch (e) {
    console.error('Failed to mark shown in service worker cache:', e);
  }
}

self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  try {
    const data = event.data.json();
    const options = {
      body: data.body || 'اعلان جدید',
      icon: 'https://cdn-icons-png.flaticon.com/512/3135/3135706.png',
      badge: 'https://cdn-icons-png.flaticon.com/512/3135/3135706.png',
      data: {
        url: data.url || '/',
        id: data.id
      },
      vibrate: [200, 100, 200],
      dir: 'rtl',
      lang: 'fa-IR',
      tag: data.id || 'payment-msg',
      renotify: true
    };
    
    const showPromise = self.registration.showNotification(data.title || 'سامانه مالی', options);
    const savePromise = data.id ? markAsShownInCache(data.id) : Promise.resolve();
    
    event.waitUntil(
      Promise.all([showPromise, savePromise])
        .catch(err => console.error('Notification tasks error:', err))
    );
  } catch (e) {
    console.error('Push handling error:', e);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  let targetUrl = event.notification.data ? event.notification.data.url : '/';
  if (!targetUrl || targetUrl === '/') targetUrl = '/chat'; // default to chat for now if missing
  
  if (!targetUrl.startsWith('http')) {
    targetUrl = new URL(targetUrl, self.location.origin).href;
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.focus();
          client.postMessage({ type: 'NAVIGATE', url: targetUrl });
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
