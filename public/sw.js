// 1. TĂNG VERSION lên v4 để ép trình duyệt xóa sạch cache v3 cũ lỗi
const CACHE_NAME = 'chocuatui-v4-final'; 

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// --- INSTALL ---
self.addEventListener('install', (event) => {
  self.skipWaiting(); 
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

// --- ACTIVATE ---
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[SW] Đang xóa cache cũ để cập nhật phiên bản mới:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// --- FETCH (CHIẾN LƯỢC TỐI ƯU) ---
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // 1. BỎ QUA: Video, Firebase, API, và các request không phải GET
  if (
    event.request.method !== 'GET' || 
    !requestUrl.href.startsWith('http') ||
    requestUrl.pathname.endsWith('.mp4') || 
    requestUrl.href.includes('firebasestorage.googleapis.com') ||
    requestUrl.href.includes('video')
  ) {
    return; 
  }

  event.respondWith(
    (async () => {
      // 2. CHIẾN LƯỢC NETWORK FIRST cho HTML và JS/CSS
      // Thử tải từ mạng trước để đảm bảo luôn lấy bản build mới nhất
      try {
        const networkResponse = await fetch(event.request);

        if (networkResponse && networkResponse.status === 200) {
          // Chỉ cache các file tĩnh (JS, CSS, Ảnh)
          if (requestUrl.pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff2|json)$/)) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        }
        return networkResponse;
      } catch (error) {
        // 3. OFFLINE: Nếu mạng lỗi, mới tìm trong Cache
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) return cachedResponse;

        // Nếu là điều hướng trang (Navigate) mà mất mạng, trả về index.html
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }

        return new Response('Mất kết nối mạng', { status: 503 });
      }
    })()
  );
});
