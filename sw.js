const CACHE = 'gridshift-v11';
const CORE = [
    './',
    './index.html',
    './styles.css',
    './manifest.json',
    './src/main.js',
    './src/gridshift/GridShiftAudio.js',
    './src/gridshift/GridShiftBoons.js',
    './src/gridshift/GridShiftContracts.js',
    './src/gridshift/GridShiftMain.js',
    './src/gridshift/GridShiftModel.js',
    './src/gridshift/GridShiftPraise.js',
    './src/gridshift/GridShiftProfile.js',
    './src/gridshift/GridShiftRender.js',
    './src/gridshift/GridShiftReplay.js',
    './src/gridshift/GridShiftRng.js',
    './src/gridshift/GridShiftRules.js',
    './src/gridshift/GridShiftUnlocks.js',
    './assets/icons/icon-192.png',
    './assets/icons/icon-512.png',
    './assets/share/favicon.png'
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
