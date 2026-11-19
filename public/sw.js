// ==========================================
// 1. NHÚNG THƯ VIỆN GOOGLE & CẤU HÌNH
// ==========================================
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyD-kdwqMhAuddGMZRXMkQgbXIt4qukKObo",
  authDomain: "chocuatui-3e65c.firebaseapp.com",
  projectId: "chocuatui-3e65c",
  storageBucket: "chocuatui-3e65c.firebasestorage.app",
  messagingSenderId: "373357283352",
  appId: "1:373357283352:web:cb19a68560bf06a067db6d",
  measurementId: "G-CRKRLNGF8V"
};

firebase.initializeApp(firebaseConfig);

// ==========================================
// 2. XỬ LÝ THÔNG BÁO ĐẨY (AN TOÀN - KHÔNG GÂY CHẾT PWA)
// ==========================================
// Chúng ta bọc phần này trong try-catch.
// Nếu trình duyệt không hỗ trợ Push, nó sẽ bỏ qua và chạy tiếp xuống phần Cache.
try {
  const messaging = firebase.messaging();

  // Xử lý tin nhắn nền (Khi tắt App)
  messaging.onBackgroundMessage((payload) => {
    console.log('[sw.js] Nhận tin nhắn nền:', payload);

    // Máy chủ gửi tiêu đề/nội dung trong "data" (không kèm "notification" để khỏi hiện 2 lần)
    const d = payload.data || {};
    const n = payload.notification || {};
    const notificationTitle = d.title || n.title || 'Chợ Của Tui';
    const notificationOptions = {
      body: d.body || n.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/favicon-32.png',
      data: d,
      tag: d.link || undefined,
      renotify: true,
      vibrate: [100, 50, 100],
      actions: [{ action: 'open', title: 'Xem ngay' }]
    };

    // Cập nhật số đỏ (Badge) trên iPhone/Android
    if (payload.data && payload.data.badge) {
        if ('setAppBadge' in self.navigator) {
            const badgeCount = parseInt(payload.data.badge);
            self.navigator.setAppBadge(badgeCount).catch(() => {});
        }
    }

    return self.registration.showNotification(notificationTitle, notificationOptions);
  });
} catch (error) {
  // Nếu lỗi (do chạy localhost http hoặc browser cũ), chỉ log ra và không làm chết App
  console.log('[SW] Push Notification không được hỗ trợ ở môi trường này (PWA vẫn chạy).');
}

// ==========================================
// 3. SỰ KIỆN BẤM VÀO THÔNG BÁO (Standard API)
// ==========================================
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const linkToOpen = (event.notification.data && event.notification.data.link) ? event.notification.data.link : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Nếu App đang mở -> Focus
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus().then(c => c.navigate(linkToOpen));
        }
      }
      // Nếu App đang tắt -> Mở mới
      if (clients.openWindow) {
        return clients.openWindow(linkToOpen);
      }
    })
  );
});

// ==========================================
// 4. CACHE
// ==========================================
// Đổi tên cache để máy người dùng bỏ icon/giao diện rao vặt cũ.
const CACHE_NAME = 'chocuatui-v9-ban-do';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting(); 
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

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

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  if (
    event.request.method !== 'GET' || 
    !requestUrl.href.startsWith('http') ||
    requestUrl.pathname.endsWith('.mp4') || 
    requestUrl.href.includes('googleapis.com') || 
    requestUrl.href.includes('gstatic.com') ||
    requestUrl.hostname.endsWith('openfreemap.org') ||
    requestUrl.hostname === 'unpkg.com' ||
    requestUrl.href.includes('video')
  ) {
    return; 
  }

  event.respondWith(
    (async () => {
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

// Xử lý setBadge từ Foreground
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