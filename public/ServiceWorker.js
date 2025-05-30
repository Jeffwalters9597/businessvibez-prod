// This is a service worker file that helps with caching and offline functionality
// It also ensures consistent behavior across browsers, especially for mobile devices

// Cache version - change this when you update your assets
const CACHE_VERSION = 'v2';
const CACHE_NAME = `business-vibez-${CACHE_VERSION}`;

// Assets to cache on install
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/missing-image.svg',
  '/logo.svg'
];

// Image file extensions to identify image requests
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'];

// Install event - cache critical assets
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing...');
  
  // Activate the service worker immediately, even if other tabs 
  // are open with the old service worker
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Caching core assets');
      return cache.addAll(CORE_ASSETS);
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activating...');
  
  // Take control of all clients immediately
  event.waitUntil(clients.claim());
  
  // Remove old cache versions
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('business-vibez-') && name !== CACHE_NAME)
          .map((name) => {
            console.log('[ServiceWorker] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
});

// Helper function to determine if a request is for an image
function isImageRequest(url) {
  const path = new URL(url).pathname.toLowerCase();
  return IMAGE_EXTENSIONS.some(ext => path.endsWith(ext));
}

// Special handling for mobile devices
function isMobileUserAgent(userAgent) {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
}

// Fetch event - network first with cache fallback
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const userAgent = event.request.headers.get('user-agent') || '';
  const isMobile = isMobileUserAgent(userAgent);
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Skip browser extensions and non-http(s) requests
  if (!url.protocol.startsWith('http') ||
      url.href.includes('chrome-extension://') ||
      url.href.includes('extension') || 
      url.href.includes('sockjs-node')) {
    return;
  }
  
  // Special handling for Supabase API requests
  if (url.href.includes('supabase.co')) {
    // For Supabase API requests, we don't want to cache them
    // but we do want to handle CORS and authentication properly
    
    const customRequest = new Request(url, {
      method: event.request.method,
      headers: new Headers(event.request.headers),
      mode: 'cors',
      credentials: 'omit',
      redirect: 'follow'
    });
    
    // Network-only strategy for API calls
    event.respondWith(
      fetch(customRequest)
        .catch(error => {
          console.error('[ServiceWorker] Supabase fetch error:', error);
          return new Response(
            JSON.stringify({ error: 'Network request failed' }),
            { 
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        })
    );
    return;
  }
  
  // Different caching strategies based on request type
  
  // 1. For image requests, use cache-first strategy to improve performance
  if (isImageRequest(url.href)) {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        if (cachedResponse) {
          // If we have it in cache, use it
          return cachedResponse;
        }
        
        // If not in cache, fetch from network and cache for next time
        return fetch(event.request)
          .then(response => {
            // Check if we received a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clone the response so we can cache it and return it
            const responseToCache = response.clone();
            
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          })
          .catch(() => {
            // If image fetch fails, return the missing image placeholder
            return caches.match('/missing-image.svg');
          });
      })
    );
    return;
  }
  
  // 2. For HTML navigation requests, use network-first strategy
  if (event.request.mode === 'navigate' || event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          // If network fails, try to serve from cache
          return caches.match(event.request)
            .then(cachedResponse => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // If not in cache, serve the index.html as a fallback
              return caches.match('/index.html');
            });
        })
    );
    return;
  }
  
  // 3. For all other requests, use a network-first approach
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // If we get a good response, clone it and put in cache
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
        }
        return response;
      })
      .catch(() => {
        // If network fails, try to serve from cache
        return caches.match(event.request);
      })
  );
});

// Handle errors better
self.addEventListener('error', (event) => {
  console.error('[ServiceWorker] Error:', event.error);
});

// Handle unhandled promise rejections
self.addEventListener('unhandledrejection', (event) => {
  console.error('[ServiceWorker] Unhandled Rejection:', event.reason);
});

// Log when the service worker is active
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({
      version: CACHE_VERSION
    });
  }
});

console.log('[ServiceWorker] Script loaded!');