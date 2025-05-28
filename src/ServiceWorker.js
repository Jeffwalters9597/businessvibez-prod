// This is a service worker file that helps with caching and offline functionality
// It also ensures consistent fetch behavior across browsers

// Cache version - change this when you update your assets
const CACHE_VERSION = 'v1';
const CACHE_NAME = `business-vibez-${CACHE_VERSION}`;

// Install event - cache critical assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/missing-image.svg'
      ]);
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('business-vibez-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
});

// Fetch event - network first, fallback to cache for GET requests
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests and browser extensions
  if (event.request.method !== 'GET' || 
      event.request.url.startsWith('chrome-extension://') ||
      event.request.url.includes('extension') || 
      event.request.url.includes('sockjs-node')) {
    return;
  }

  // Handle Supabase API requests with proper headers
  if (event.request.url.includes('supabase.co')) {
    const customRequest = new Request(event.request.url, {
      method: event.request.method,
      headers: new Headers(event.request.headers),
      mode: 'cors',
      credentials: 'same-origin',
      redirect: 'follow'
    });
    
    event.respondWith(fetch(customRequest));
    return;
  }

  // For other requests, try network first, fallback to cache
  event.respondWith(
    fetch(event.request)
      .catch(() => {
        return caches.match(event.request)
          .then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            
            // If the request is for an image and we don't have it cached,
            // return the missing image placeholder
            if (event.request.destination === 'image') {
              return caches.match('/missing-image.svg');
            }
            
            // If not an image and not in cache, return a basic offline response
            return new Response('You appear to be offline and this content is not cached.', {
              status: 503,
              headers: { 'Content-Type': 'text/plain' }
            });
          });
      })
  );
});

// Handle errors better
self.addEventListener('error', (event) => {
  console.error('ServiceWorker error:', event.error);
});