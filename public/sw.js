// ==========================================
// 1. NHÚNG THƯ VIỆN GOOGLE (BẮT BUỘC)
// ==========================================
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// 2. CẤU HÌNH FIREBASE (Lấy từ thông tin bạn cung cấp)
const firebaseConfig = {
  apiKey: "AIzaSyD-kdwqMhAuddGMZRXMkQgbXIt4qukKObo",
  authDomain: "chocuatui-3e65c.firebaseapp.com",
  projectId: "chocuatui-3e65c",
  storageBucket: "chocuatui-3e65c.firebasestorage.app",
  messagingSenderId: "373357283352",
  appId: "1:373357283352:web:cb19a68560bf06a067db6d",
  measurementId: "G-CRKRLNGF8V"
};

// Khởi tạo Firebase ngay trong Service Worker
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// ==========================================
// 3. XỬ LÝ THÔNG BÁO & SỐ ĐỎ (KHI TẮT APP)
// ==========================================
// Hàm này của Google sẽ tự động bắt tin nhắn khi App tắt
messaging.onBackgroundMessage((payload) => {
  console.log('[sw.js] Nhận tin nhắn nền:', payload);

  const notificationTitle = payload.notification.title || 'Chợ Của Tui';
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/vite.svg', // Dùng luôn icon bạn đã cache
    image: payload.notification.image, // Ảnh to nếu có
    data: payload.data, // Chứa link và số lượng badge
    vibrate: [100, 50, 100],
    actions: [
       { action: 'open', title: 'Xem ngay' }
    ]
  };

  // --- QUAN TRỌNG: CẬP NHẬT SỐ ĐỎ (BADGE) TRÊN IPHONE ---
  // Đoạn này giúp hiện chấm đỏ ngay cả khi bạn không mở web
  if (payload.data && payload.data.badge) {
      if ('setAppBadge' in self.navigator) {
          const badgeCount = parseInt(payload.data.badge);
          self.navigator.setAppBadge(badgeCount).catch(() => {});
      }
  }

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// ==========================================
// 4. SỰ KIỆN BẤM VÀO THÔNG BÁO
// ==========================================
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  // Lấy link cần mở (nếu tin nhắn có gửi kèm link)
  const linkToOpen = (event.notification.data && event.notification.data.link) ? event.notification.data.link : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Nếu App đang mở sẵn thì focus vào nó
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus().then(c => {
               // Chuyển hướng đến đúng trang chat/sản phẩm
               if (c && 'navigate' in c) return c.navigate(linkToOpen);
          });
        }
      }
      // Nếu App đang tắt thì mở cửa sổ mới
      if (clients.openWindow) {
        return clients.openWindow(linkToOpen);
      }
    })
  );
});

// ==========================================
// 5. PHẦN CACHE CŨ CỦA BẠN (GIỮ NGUYÊN)
// ==========================================
const CACHE_NAME = 'chocuatui-v6-combined'; // Đổi tên để trình duyệt cập nhật mới
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

// Xử lý Offline/Cache
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Bỏ qua các request của Google/Firebase/Video để tránh lỗi
  if (
    event.request.method !== 'GET' || 
    !requestUrl.href.startsWith('http') ||
    requestUrl.pathname.endsWith('.mp4') || 
    requestUrl.href.includes('googleapis.com') || // Bỏ qua Google API
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
          // Chỉ cache các file tĩnh
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

// Xử lý setBadge khi app đang mở (Foreground)
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
