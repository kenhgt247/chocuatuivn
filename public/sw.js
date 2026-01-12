// public/sw.js

// 1. Tăng version để trình duyệt biết cần cập nhật
const CACHE_NAME = 'chocuatui-v3-fix-video';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// --- INSTALL ---
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Kích hoạt ngay lập tức
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
            console.log('[SW] Xóa cache cũ:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// --- FETCH (QUAN TRỌNG NHẤT) ---
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // 1. BỎ QUA KHÔNG XỬ LÝ VIDEO & FIREBASE STORAGE
  // Để trình duyệt tự xử lý video (Range Requests) -> Fix lỗi lúc hiện lúc không
  if (
    requestUrl.pathname.endsWith('.mp4') || 
    requestUrl.href.includes('firebasestorage.googleapis.com') ||
    requestUrl.href.includes('video')
  ) {
    return; // Return để browser tự fetch trực tiếp từ mạng (Network Only)
  }

  // 2. Chỉ xử lý GET request http/https
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) return;

  event.respondWith(
    (async () => {
      // A. Thử tìm trong Cache trước
      const cachedResponse = await caches.match(event.request);
      if (cachedResponse) {
        return cachedResponse;
      }

      // B. Nếu không có, tải từ Mạng
      try {
        const networkResponse = await fetch(event.request);

        // Nếu mạng lỗi hoặc server trả về lỗi (404, 500...), trả về nguyên bản
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        // C. Cache lại các file tĩnh (JS, CSS, Font, Ảnh nhỏ)
        // KHÔNG cache API call hoặc Video
        if (
          requestUrl.pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff2)$/) &&
          !requestUrl.href.includes('firebasestorage') // Chặn cache ảnh từ Firebase để tránh lỗi CORS
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }

        return networkResponse;

      } catch (error) {
        // D. MẤT MẠNG (OFFLINE)
        // Nếu là request điều hướng trang (HTML) -> Trả về trang chủ hoặc trang Offline
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
        
        // [FIX LỖI FAILED TO CONVERT] Trả về response rỗng thay vì undefined để không crash
        return new Response('', { status: 408, statusText: 'Request timed out' });
      }
    })()
  );
});
