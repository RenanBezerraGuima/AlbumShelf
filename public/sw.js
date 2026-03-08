const ALBUM_IMAGE_CACHE = 'album-shelf-images-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter((cacheName) => cacheName !== ALBUM_IMAGE_CACHE)
        .map((cacheName) => caches.delete(cacheName)),
    );
    await self.clients.claim();
  })());
});

async function updateAlbumImageCache(request) {
  const cache = await caches.open(ALBUM_IMAGE_CACHE);

  try {
    const response = await fetch(request);
    if (response && (response.ok || response.type === 'opaque')) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET' || request.destination !== 'image') {
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(ALBUM_IMAGE_CACHE);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      event.waitUntil(updateAlbumImageCache(request));
      return cachedResponse;
    }

    return updateAlbumImageCache(request);
  })());
});
