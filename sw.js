// ==========================================
// PARK AI — PWA Service Worker
// Cache static assets for instant loading
// ==========================================

const CACHE_NAME = 'parkai-v2.0';
const ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/core.js',
  '/js/auth.js',
  '/js/payments.js',
  '/js/map.js',
  '/js/booking.js',
  '/js/weather-ev.js',
  '/js/insights-host.js',
  '/js/backend.js',
  '/js/app.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdn.socket.io/4.7.5/socket.io.min.js'
];

// Install Event
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('SW: Caching static assets');
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('SW: Clearing old cache', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event
self.addEventListener('fetch', (e) => {
  // Only cache GET requests going to local or CDN origins
  if (e.request.method !== 'GET') return;
  
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      
      return fetch(e.request).then((networkResponse) => {
        // Don't cache dynamic API responses
        if (e.request.url.includes('/api/')) return networkResponse;
        
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, networkResponse.clone());
          return networkResponse;
        });
      });
    }).catch(() => {
      // Offline fallback for index page
      if (e.request.mode === 'navigate') {
        return caches.match('/index.html');
      }
    })
  );
});
