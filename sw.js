
const CACHE_NAME = 'chocuatui-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Be+Vietnam+Pro:wght@300;400;500;600;700&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Chỉ cache các request GET
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).then((fetchResponse) => {
        // Cache các tài nguyên tĩnh mới
        if (fetchResponse.status === 200 && (
          event.request.url.includes('gstatic.com') || 
          event.request.url.includes('esm.sh') ||
          event.request.url.includes('dicebear.com')
        )) {
          const cacheCopy = fetchResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, cacheCopy);
          });
        }
        return fetchResponse;
      });
    }).catch(() => {
      // Trả về trang chủ nếu mất mạng và không có cache
      return caches.match('/');
    })
  );
});
