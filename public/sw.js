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

    const notificationTitle = payload.notification.title || 'Chợ Của Tui';
    const notificationOptions = {
      body: payload.notification.body,
      icon: '/vite.svg', 
      image: payload.notification.image,
      data: payload.data,
      vibrate: [100, 50, 100],
      actions: [
         { action: 'open', title: 'Xem ngay' }
      ]
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
// 4. PHẦN CACHE CŨ CỦA BẠN (GIỮ NGUYÊN 100%)
// ==========================================
const CACHE_NAME = 'chocuatui-v6-combined';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/vite.svg',
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