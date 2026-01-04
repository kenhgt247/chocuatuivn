// 1. Tăng phiên bản lên để xóa cache cũ
const CACHE_NAME = 'chocuatui-v2';

// 2. Danh sách các file tĩnh quan trọng nhất (App Shell)
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  // Lưu ý: Không cần cache file CSS/JS cụ thể ở đây vì tên file sẽ đổi sau mỗi lần build.
  // Chúng ta sẽ cache chúng tự động ở phần fetch bên dưới.
];

// --- INSTALL: Cài đặt Service Worker ---
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching App Shell');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Kích hoạt ngay lập tức không cần chờ reload
  self.skipWaiting();
});

// --- ACTIVATE: Xóa Cache cũ khi có phiên bản mới ---
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[SW] Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// --- FETCH: Xử lý request mạng ---
self.addEventListener('fetch', (event) => {
  // Chỉ xử lý GET request
  if (event.request.method !== 'GET') return;

  // Bỏ qua các request chrome-extension hoặc không phải http/https
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // 1. Nếu có trong cache thì dùng luôn (Tốc độ cao)
      if (cachedResponse) {
        return cachedResponse;
      }

      // 2. Nếu không có, tải từ mạng
      return fetch(event.request).then((networkResponse) => {
        // Kiểm tra response hợp lệ
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        // 3. Logic Cache Động (Dynamic Caching)
        // Cache các file JS, CSS, Font, Ảnh nội bộ để lần sau dùng offline được
        // Điều kiện: Là file nội bộ (cùng domain) HOẶC là font Google/ảnh Dicebear
        const url = event.request.url;
        
        if (
           url.match(/\.(js|css|png|jpg|jpeg|svg|ico)$/) || // File tĩnh
           url.includes('fonts.googleapis.com') ||           // Font
           url.includes('fonts.gstatic.com') ||              // Font file
           url.includes('dicebear.com')                      // Avatar
        ) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
        }

        return networkResponse;
      }).catch(() => {
        // 4. Nếu mất mạng và không có cache -> Trả về trang chủ (Offline Fallback)
        // Áp dụng cho các đường dẫn điều hướng (HTML)
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
