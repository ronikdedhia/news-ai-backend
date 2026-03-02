const CACHE_NAME = 'news-app-v1'

// Install event
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...')
  self.skipWaiting()
})

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...')
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName)
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
  self.clients.claim()
})

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return
  }

  // Skip chrome extensions
  if (!url.protocol.startsWith('http')) {
    return
  }

  // For API calls, try network first, then cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Only cache successful responses
          if (response && response.status === 200) {
            const responseClone = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              console.log('[SW] Caching API response:', url.pathname)
              cache.put(request, responseClone)
            })
          }
          return response
        })
        .catch((error) => {
          console.log('[SW] Network failed, trying cache:', url.pathname)
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              console.log('[SW] Serving from cache:', url.pathname)
              return cachedResponse
            }
            // Return a generic offline response
            return new Response(
              JSON.stringify({ success: false, error: 'Offline - no cached data' }),
              { status: 503, headers: { 'Content-Type': 'application/json' } }
            )
          })
        })
    )
    return
  }

  // For other requests (HTML, CSS, JS), cache first, then network
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        console.log('[SW] Serving from cache:', url.pathname)
        return cachedResponse
      }
      return fetch(request).then((response) => {
        if (response && response.status === 200) {
          const responseClone = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Caching:', url.pathname)
            cache.put(request, responseClone)
          })
        }
        return response
      })
    })
  )
})
