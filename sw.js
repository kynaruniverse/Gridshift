const CACHE = 'gridshift-v5';
const CORE = [
    './',
    './index.html',
    './styles.css',
    './manifest.json',
    './src/main.js',
    './src/gridshift/GridShiftAudio.js',
    './src/gridshift/GridShiftMain.js',
    './src/gridshift/GridShiftModel.js',
    './src/gridshift/GridShiftRender.js',
    './assets/icons/icon-192.png',
    './assets/icons/icon-512.png',
    './assets/share/favicon.png',
    './assets/islands/sky_haven.webp',
    './assets/islands/prismatic_falls.webp',
    './assets/islands/neon_cyber_city.webp',
    './assets/runtime/clear_burst.webp',
    './assets/runtime/special_bomb.webp',
    './assets/runtime/special_lightning.webp',
    './assets/runtime/special_prism.webp',
    './assets/runtime/tile_blue.webp',
    './assets/runtime/tile_cyan.webp',
    './assets/runtime/tile_gold.webp',
    './assets/runtime/tile_lime.webp',
    './assets/runtime/tile_pink.webp',
    './assets/runtime/tile_violet.webp'
];

self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)));
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET') return;
    if (request.headers.has('range')) return; // let audio streaming hit the network
    if (new URL(request.url).origin !== self.location.origin) return;

    event.respondWith(
        caches.match(request).then(cached => {
            const refresh = fetch(request).then(response => {
                if (response.ok) {
                    const copy = response.clone();
                    caches.open(CACHE).then(cache => cache.put(request, copy));
                }
                return response;
            });
            if (cached) {
                refresh.catch(() => {});
                return cached;
            }
            return refresh.catch(() => caches.match('./index.html'));
        })
    );
});