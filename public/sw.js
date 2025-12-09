// Service Worker for Realtime Location Tracker PWA
const CACHE_NAME = 'location-tracker-v1';
const STATIC_CACHE_NAME = 'static-cache-v1';
const DYNAMIC_CACHE_NAME = 'dynamic-cache-v1';

// Assets to cache immediately on install
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
    '/js/main.js',
    '/js/pwa.js',
    '/js/sos.js',
    '/assets/favico.png',
    '/assets/android-log.png',
    '/assets/ios-log.png',
    '/assets/windows-log.png',
    '/assets/mac-log.png',
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

// External resources to cache
const EXTERNAL_ASSETS = [
    'https://unpkg.com/leaflet@1.7.1/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.7.1/dist/leaflet.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing Service Worker...');

    event.waitUntil(
        Promise.all([
            // Cache static assets
            caches.open(STATIC_CACHE_NAME).then((cache) => {
                console.log('[SW] Caching static assets...');
                return cache.addAll(STATIC_ASSETS.filter(url => !url.startsWith('http')));
            }),
            // Cache external assets
            caches.open(DYNAMIC_CACHE_NAME).then((cache) => {
                console.log('[SW] Caching external assets...');
                return Promise.allSettled(
                    EXTERNAL_ASSETS.map(url =>
                        fetch(url, { mode: 'cors' })
                            .then(response => {
                                if (response.ok) {
                                    return cache.put(url, response);
                                }
                            })
                            .catch(err => console.log('[SW] Failed to cache external:', url))
                    )
                );
            })
        ]).then(() => {
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
    if (url.hostname.includes('tile.openstreetmap.org')) {
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
