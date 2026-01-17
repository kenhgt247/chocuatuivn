// 1. VERSION v5 - Thêm tính năng Push Notification
const CACHE_NAME = 'chocuatui-v5-push-enabled'; 

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/vite.svg', // Cache luôn icon
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
            console.log('[SW] Xóa cache cũ:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// ==========================================
// 🔔 TÍNH NĂNG 1: HIỆN SỐ ĐỎ (BADGE)
// ==========================================
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SET_BADGE') {
    const count = event.data.count;
    if ('setAppBadge' in self.navigator) {
      if (count > 0) {
        self.navigator.setAppBadge(count).catch(() => {});
      } else {
        self.navigator.clearAppBadge().catch(() => {});
      }
    }
  }
});

// ==========================================
// 📢 TÍNH NĂNG 2: THÔNG BÁO ĐẨY (PUSH NOTIFICATION)
// ==========================================
// Sự kiện này chạy khi Server gửi tin nhắn xuống, kể cả khi tắt App
self.addEventListener('push', (event) => {
  let data = { title: 'Chợ Của Tui', body: 'Bạn có thông báo mới!', url: '/' };

  // Đọc dữ liệu từ server gửi về (nếu có)
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/icons/icon-192.png', // Icon hiện bên cạnh thông báo
    badge: '/icons/icon-72.png', // Icon nhỏ trên thanh trạng thái (Android)
    vibrate: [100, 50, 100], // Rung điện thoại
    data: {
      url: data.url || '/' // Link sẽ mở khi bấm vào
    },
    // Các tùy chọn nâng cao cho iOS/Android
    actions: [
      { action: 'open', title: 'Xem ngay' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Sự kiện bấm vào thông báo
self.addEventListener('notificationclick', (event) => {
  event.notification.close(); // Đóng thông báo

  // Mở ứng dụng hoặc focus vào tab đang mở
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 1. Nếu app đang mở -> Focus vào nó
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      // 2. Nếu app đang tắt -> Mở mới
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url);
      }
    })
  );
});

// ==========================================
// 🚀 TÍNH NĂNG 3: CACHE (OFFLINE MODE)
// ==========================================
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // BỎ QUA các request không cần cache
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
      // ƯU TIÊN MẠNG (Network First)
      try {
        const networkResponse = await fetch(event.request);
        if (networkResponse && networkResponse.status === 200) {
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
        // MẤT MẠNG -> Dùng Cache
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) return cachedResponse;

        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
        return new Response('Offline', { status: 503 });
      }
    })()
  );
});
