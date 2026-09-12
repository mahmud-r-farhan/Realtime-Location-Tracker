// Service Worker for Realtime Location Tracker PWA
// NOTE: bump the cache versions whenever precached assets change, so all
// clients pick up the new files (old caches are purged on activation).
const CACHE_NAME        = 'location-tracker-v3';
const STATIC_CACHE_NAME = 'static-cache-v3';
const DYNAMIC_CACHE_NAME= 'dynamic-cache-v3';

// Assets to cache immediately on install - includes the full ES-module graph
// (main.js imports every other module, so all of them are required offline).
const STATIC_ASSETS = [
    '/',
    '/css/style.css',
    '/css/panel.css',
    '/css/device.css',
    '/css/chat.css',
    '/css/audio.css',
    '/css/notification.css',
    '/css/popup.css',
    '/css/responsive.css',
    '/css/icon.css',
    '/css/sos.css',
    '/vendor/leaflet/leaflet.js',
    '/vendor/leaflet/leaflet.css',
    '/vendor/font-awesome/all.min.css',
    '/vendor/font-awesome/webfonts/fa-solid-900.woff2',
    '/vendor/font-awesome/webfonts/fa-regular-400.woff2',
    '/vendor/font-awesome/webfonts/fa-brands-400.woff2',
    '/js/main.js',
    '/js/config.js',
    '/js/utils.js',
    '/js/map.js',
    '/js/device.js',
    '/js/ui.js',
    '/js/notification.js',
    '/js/socket.js',
    '/js/audio.js',
    '/js/chat.js',
    '/js/sounds.js',
    '/js/theme.js',
    '/js/controls.js',
    '/js/profile.js',
    '/js/batteryMonitor.js',
    '/js/sos.js',
    '/js/pwa.js',
    '/assets/favico.png',
    '/assets/android-log.png',
    '/assets/ios-log.png',
    '/assets/windows-log.png',
    '/assets/mac-log.png',
    '/assets/linux-log.png',
    '/assets/unknown-log.png',
    '/assets/microphone-muted-icon.png',
    '/assets/microphone-on-icon.png',
    '/assets/speaker-on-icon.png',
    '/assets/speaker-off-icon.png',
    '/assets/icons8-location.gif',
    '/assets/icons/icon.svg',
    '/manifest.json',
    '/offline.html'
];

// Map tile hosts that should be cached network-first (offline map support)
const TILE_HOST_PATTERNS = [
    /(^|\.)tile\.openstreetmap\.org$/i,
    /(^|\.)tile\.opentopomap\.org$/i,
    /(^|\.)tile-cyclosm\.openstreetmap\.fr$/i,
    /(^|\.)tile\.thunderforest\.com$/i,
    /(^|\.)basemaps\.cartocdn\.com$/i,
    /(^|\.)arcgisonline\.com$/i
];

function isTileRequest(url) {
    return TILE_HOST_PATTERNS.some((pattern) => pattern.test(url.hostname));
}

// Upper bound for the runtime caches so they cannot grow without limit
const MAX_DYNAMIC_CACHE_ENTRIES = 500;

async function trimCache(cacheName, maxEntries) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    while (keys.length > maxEntries) {
        await cache.delete(keys.shift());
    }
}

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing Service Worker...');

    event.waitUntil(
        caches.open(STATIC_CACHE_NAME).then((cache) => {
            console.log('[SW] Caching static assets...');
            return cache.addAll(STATIC_ASSETS);
        }).then(() => {
            console.log('[SW] Installation complete');
            return self.skipWaiting();
        })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating Service Worker...');

    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => {
                        return name !== STATIC_CACHE_NAME &&
                            name !== DYNAMIC_CACHE_NAME &&
                            name !== CACHE_NAME;
                    })
                    .map((name) => {
                        console.log('[SW] Deleting old cache:', name);
                        return caches.delete(name);
                    })
            );
        }).then(() => {
            console.log('[SW] Claiming clients...');
            return self.clients.claim();
        })
    );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Skip socket.io and WebSocket connections
    if (url.pathname.includes('socket.io') ||
        request.url.includes('socket.io') ||
        url.protocol === 'ws:' ||
        url.protocol === 'wss:') {
        return;
    }

    // Handle tile requests (map tiles) - Network first, then cache
    if (isTileRequest(url)) {
        event.respondWith(
            caches.open(DYNAMIC_CACHE_NAME).then((cache) => {
                return fetch(request)
                    .then((response) => {
                        if (response.ok) {
                            cache.put(request, response.clone());
                        }
                        return response;
                    })
                    .catch(() => cache.match(request));
            })
        );
        return;
    }

    // For navigation requests (HTML pages), use network first
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // Cache the successful response
                    if (response.ok) {
                        const responseClone = response.clone();
                        caches.open(STATIC_CACHE_NAME).then((cache) => {
                            cache.put(request, responseClone);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // If offline, try to serve cached page or offline fallback
                    return caches.match(request).then((cachedResponse) => {
                        if (cachedResponse) {
                            return cachedResponse;
                        }
                        return caches.match('/offline.html');
                    });
                })
        );
        return;
    }

    // For static assets (CSS, JS, images), use cache first
    if (url.origin === location.origin) {
        event.respondWith(
            caches.match(request).then((cachedResponse) => {
                if (cachedResponse) {
                    // Return cached version, but update cache in background
                    event.waitUntil(
                        fetch(request)
                            .then((response) => {
                                if (response.ok) {
                                    return caches.open(STATIC_CACHE_NAME).then((cache) => {
                                        cache.put(request, response);
                                    });
                                }
                            })
                            .catch(() => { })
                    );
                    return cachedResponse;
                }

                // Not in cache, fetch from network
                return fetch(request)
                    .then((response) => {
                        if (response.ok) {
                            const responseClone = response.clone();
                            caches.open(DYNAMIC_CACHE_NAME).then((cache) => {
                                cache.put(request, responseClone);
                            });
                        }
                        return response;
                    })
                    .catch(() => {
                        // Return offline placeholder for images
                        if (request.destination === 'image') {
                            return new Response(
                                '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="#ddd" width="100" height="100"/><text fill="#888" x="50%" y="50%" dominant-baseline="middle" text-anchor="middle">Offline</text></svg>',
                                { headers: { 'Content-Type': 'image/svg+xml' } }
                            );
                        }
                    });
            })
        );
        return;
    }

    // For external resources, use stale-while-revalidate
    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            const fetchPromise = fetch(request)
                .then((response) => {
                    if (response.ok) {
                        const responseClone = response.clone();
                        caches.open(DYNAMIC_CACHE_NAME).then((cache) => {
                            cache.put(request, responseClone);
                            trimCache(DYNAMIC_CACHE_NAME, MAX_DYNAMIC_CACHE_ENTRIES);
                        });
                    }
                    return response;
                })
                .catch(() => cachedResponse);

            return cachedResponse || fetchPromise;
        })
    );
});

// Handle push notifications (for future use)
self.addEventListener('push', (event) => {
    if (!event.data) return;

    const data = event.data.json();
    const options = {
        body: data.body || 'New notification from Location Tracker',
        icon: '/assets/icons/icon.svg',
        badge: '/assets/favico.png',
        vibrate: [100, 50, 100],
        data: {
            url: data.url || '/',
            dateOfArrival: Date.now()
        },
        actions: [
            {
                action: 'open',
                title: 'Open App'
            },
            {
                action: 'close',
                title: 'Close'
            }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'Location Tracker', options)
    );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'close') {
        return;
    }

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // If app is already open, focus it
                for (const client of clientList) {
                    if (client.url === event.notification.data.url && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Otherwise, open new window
                if (clients.openWindow) {
                    return clients.openWindow(event.notification.data.url);
                }
            })
    );
});

// Background sync (for future use - e.g., syncing location data when back online)
self.addEventListener('sync', (event) => {
    console.log('[SW] Sync event:', event.tag);

    if (event.tag === 'sync-location') {
        event.waitUntil(
            // Implement location sync logic here
            Promise.resolve()
        );
    }
});

// Periodic background sync (for future use)
self.addEventListener('periodicsync', (event) => {
    console.log('[SW] Periodic sync event:', event.tag);
});

// Message handling from the main app
self.addEventListener('message', (event) => {
    console.log('[SW] Message received:', event.data);

    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data && event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((name) => caches.delete(name))
                );
            })
        );
    }
});
