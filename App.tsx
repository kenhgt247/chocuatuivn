import React, { useState, useEffect, useRef } from 'react';
import { lazyRetry } from './utils/lazy';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';

// --- Layout & Pages ---
import CommunityShell from './components/CommunityShell';
import CommunityApp from './pages/CommunityApp';
// Các trang ít dùng ngay lúc đầu: tải khi mở tới (trang chủ nhẹ hơn)
const Chat = lazyRetry(() => import('./pages/Chat'));
const Profile = lazyRetry(() => import('./pages/Profile'));
const SellerProfile = lazyRetry(() => import('./pages/SellerProfile'));
const Auth = lazyRetry(() => import('./pages/Auth'));
const Register = lazyRetry(() => import('./pages/Register'));
const Admin = lazyRetry(() => import('./pages/Admin'));
const StaticPage = lazyRetry(() => import('./pages/StaticPage'));
const AppDownload = lazyRetry(() => import('./pages/AppDownload'));

// --- Component ---
import GoogleOneTap from './components/GoogleOneTap';

// --- Services ---
import { db, auth } from './services/db'; 
import { User } from './types';

// --- Firebase ---
import { onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, updateDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { app } from './services/db'; // Import app từ db service

// Chờ trong khung trang (đầu trang + thanh dưới vẫn hiện)
const PageWait = () => (
  <div className="flex flex-col gap-3" aria-busy="true" aria-label="Đang tải">
    <div className="h-7 w-1/2 rounded-xl bg-[#ECE5D4] animate-pulse" />
    <div className="h-40 rounded-2xl bg-[#ECE5D4] animate-pulse" />
    <div className="h-24 rounded-2xl bg-[#ECE5D4] animate-pulse" />
  </div>
);

// Helper: Scroll to Top
const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

// --- ICON VẼ TAY ---
const IconCheckCircle = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);


// Link cũ của rao vặt (/san-pham/ten-tin-<id>) chuyển sang trang tin cộng đồng.
// Bản rao vặt đầy đủ được lưu ở nhánh git "luu-tru-rao-vat-2026-11".
const OldListingRedirect = () => {
  const { slugWithId = '' } = useParams();
  const id = slugWithId.split('-').pop() || '';
  return <Navigate to={id ? '/cong-dong/tin/' + encodeURIComponent(id) : '/'} replace />;
};

// Mọi trang dùng chung một khung giao diện cộng đồng.
const CommunityFrame: React.FC<{user: User | null; children: React.ReactNode}> = ({user,children}) => (
  <CommunityShell user={user}>{children}</CommunityShell>
);

// Lưu hồ sơ người dùng trên máy để lần sau mở web không phải chờ tải hồ sơ
const USER_CACHE = 'ccut-user-v1';
function readUserCache(uid: string): User | null {
  try { const u = JSON.parse(localStorage.getItem(USER_CACHE) || 'null'); return u && u.id === uid ? u : null; } catch (_) { return null; }
}
function writeUserCache(u: User | null) {
  try { if (u) localStorage.setItem(USER_CACHE, JSON.stringify(u)); else localStorage.removeItem(USER_CACHE); } catch (_) { /* bỏ qua */ }
}

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  
  // Ref để theo dõi số dư cũ
  const prevBalanceRef = useRef<number>(0);
  
  const [notification, setNotification] = useState<{ show: boolean; message: string } | null>(null);

  const showSafeToast = (message: string) => {
    setNotification({ show: true, message });
    setTimeout(() => setNotification(null), 4000);
  };

 // App.tsx

  // 1. LẮNG NGHE AUTH & VÍ TIỀN & PUSH NOTIFICATION
  useEffect(() => {
    let unsubscribeUserChange: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Có hồ sơ lưu trên máy từ lần trước: mở trang ngay, cập nhật hồ sơ sau
        const cached = readUserCache(firebaseUser.uid);
        if (cached) { setUser(cached); setIsInitializing(false); }
        try {
          // --- BƯỚC 1: LẤY THÔNG TIN USER ---
          const currentUser = await db.getUserProfile(firebaseUser.uid);
          
          if (currentUser) {
            setUser(currentUser);
            writeUserCache(currentUser);
            // Giữ hồ sơ công khai (tên, ảnh, khu vực) luôn cập nhật; không chứa email/SĐT.
            db.syncPublicProfile({ ...currentUser, id: firebaseUser.uid });
            prevBalanceRef.current = currentUser.walletBalance;

            // --- BƯỚC 2: CẤU HÌNH PUSH NOTIFICATION (AN TOÀN TUYỆT ĐỐI) ---
            try {
                // Thư viện thông báo đẩy chỉ tải khi đã đăng nhập
                const { getMessaging, getToken, onMessage, isSupported } = await import('firebase/messaging');
                if (!(await isSupported().catch(() => false))) throw new Error('push-unsupported');
                const messaging = getMessaging(app);

                // A. Xin quyền
                // Không xin quyền thông báo khi người dùng chưa bấm. Nút trên giao diện mới sẽ xin quyền.
                const permission = typeof Notification !== 'undefined' ? Notification.permission : 'default';
                
                if (permission === 'granted') {
                    // Kiểm tra trình duyệt có hỗ trợ Service Worker không
                    if ('serviceWorker' in navigator) {
                        
                        // 🔥 Đăng ký file sw.js thủ công
                        const swReg = await navigator.serviceWorker.register('/sw.js');

                        // ⚠️ QUAN TRỌNG: Kiểm tra swReg tồn tại rồi mới gọi getToken
                        // Đây chính là chỗ sửa lỗi "reading 'pushManager'"
                        if (swReg) {
                            const token = await getToken(messaging, { 
                                vapidKey: "BC-HSAKsOy5hvpSPgtlC52kwy8OWL2oX1jn4pIkzyRkcqgPzlzTkHe2Xa9rBPJYtGjygvoTcfaWmCxYCeFZrlMI",
                                serviceWorkerRegistration: swReg 
                            });
    
                            if (token) {
                                console.log("✅ FCM Token:", token);
                                // C. Lưu token lên Firestore
                                const dbInstance = getFirestore();
                                // Lưu thêm mã của máy này, không ghi đè máy khác (điện thoại + máy tính cùng nhận)
                                await updateDoc(doc(dbInstance, "users", currentUser.id), {
                                    fcmTokens: arrayUnion(token),
                                    notificationsEnabled: true
                                });
                            }
                        } else {
                            console.warn("⚠️ Không lấy được Service Worker Registration (Có thể do lỗi mạng hoặc Cache)");
                        }
                    } else {
                        console.log("❌ Trình duyệt này không hỗ trợ Service Worker");
                    }
                }

                // D. Lắng nghe tin nhắn khi App đang mở (Foreground)
                onMessage(messaging, (payload) => {
                    console.log("📩 Tin nhắn mới:", payload);
                    const title = payload.data?.title || payload.notification?.title || "Thông báo mới";
                    const body = payload.data?.body || payload.notification?.body || "";
                    showSafeToast(`🔔 ${title}: ${body}`);
                });

            } catch (err) {
                // Log lỗi nhẹ nhàng, không để crash App
                console.error("Lỗi Push Notification (nhưng App vẫn chạy):", err);
            }

            // --- BƯỚC 3: LẮNG NGHE THAY ĐỔI VÍ TIỀN (REALTIME) ---
            if (db.onUserChange) {
              unsubscribeUserChange = db.onUserChange(currentUser.id, (updatedUser) => {
                // Cập nhật state
                setUser(updatedUser);
                writeUserCache(updatedUser);
                prevBalanceRef.current = updatedUser.walletBalance;
              });
            }
          }
        } catch (err) {
          console.error("Lỗi lấy thông tin user:", err);
        }
      } else {
        // --- KHI LOGOUT ---
        if (unsubscribeUserChange) unsubscribeUserChange();
        writeUserCache(null);
        
        setUser(null);
        prevBalanceRef.current = 0; 
      }
      setIsInitializing(false);
    });

    // Cleanup khi unmount component
    return () => {
      unsubscribeAuth();
      if (unsubscribeUserChange) unsubscribeUserChange();
    };
  }, []);

  // 2. LOGIC BÁO ONLINE
  useEffect(() => {
    if (!user?.id) return;
    const dbInstance = getFirestore();
    const userRef = doc(dbInstance, "users", user.id);

    const reportOnline = async () => {
      if (document.visibilityState !== 'visible') return;
      try { await updateDoc(userRef, { isOnline: true, lastActiveAt: serverTimestamp() }); } catch (e) {}
    };
    const reportOffline = async () => {
      try { await updateDoc(userRef, { isOnline: false, lastActiveAt: serverTimestamp() }); } catch (e) {}
    };

    reportOnline();
    const intervalId = setInterval(reportOnline, 300000); // 5 phút/lần cho đỡ tốn lượt ghi
    window.addEventListener("beforeunload", reportOffline);
    document.addEventListener("visibilitychange", reportOnline);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("beforeunload", reportOffline);
      document.removeEventListener("visibilitychange", reportOnline);
    };
  }, [user?.id]); 

  // --- HANDLERS ---
  const handleLogin = (u: User) => {
      setUser(u);
      prevBalanceRef.current = u.walletBalance;
  };
  
  const handleLogout = async () => {
    // 1. Cập nhật offline
    if (user?.id) {
        try {
            const dbInstance = getFirestore();
            await updateDoc(doc(dbInstance, "users", user.id), {
                isOnline: false,
                lastActiveAt: serverTimestamp()
            });
        } catch(e) {}
    }
    
    // 2. Gọi hàm logout
    await db.logout();
    
    // 3. KHÔNG CẦN reset thủ công ở đây nữa, vì window.location.href sẽ lo việc dọn dẹp
    // setUser(null); 
    // prevBalanceRef.current = 0; 

    // 4. Ép tải lại trang để xóa sạch bộ nhớ đệm (Fix triệt để lỗi lưu phiên)
    window.location.href = '/login';
  };
  
  const handleUpdateUser = (u: User) => {
    setUser(u);
    prevBalanceRef.current = u.walletBalance;
  };

  // Trang chủ và trang xem tin hiện ngay, không chờ đăng nhập.
  // Trang cần biết đã đăng nhập hay chưa thì chờ tới khi biết.
  const wait = (el: React.ReactElement) => isInitializing ? <PageWait /> : el;

  return (
    <HelmetProvider>
      <Router>
        <ScrollToTop />
        {!user && !isInitializing && <GoogleOneTap onLogin={handleLogin} />}

        <CommunityFrame user={user}>
          <React.Suspense fallback={<PageWait />}>
          <Routes>
            <Route path="/" element={<CommunityApp user={user} />} />
            <Route path="/cong-dong/tin/*" element={<CommunityApp user={user} />} />
            <Route path="/xa/*" element={<CommunityApp user={user} />} />
            <Route path="/cong-dong/*" element={wait(<CommunityApp user={user} />)} />
            {/* Rao vặt đã lưu trữ: các đường dẫn cũ chuyển về cộng đồng */}
            <Route path="/rao-vat" element={<Navigate to="/" replace />} />
            <Route path="/search" element={<Navigate to="/" replace />} />
            <Route path="/danh-muc/*" element={<Navigate to="/" replace />} />
            <Route path="/san-pham/:slugWithId" element={<OldListingRedirect />} />
            <Route path="/listings/:slugWithId" element={<OldListingRedirect />} />
            <Route path="/listing/:slugWithId" element={<OldListingRedirect />} />

            <Route path="/profile" element={wait(user ? <Profile user={user} onLogout={handleLogout} onUpdateUser={handleUpdateUser} /> : <Navigate to="/login" />)} />
            <Route path="/profile/:id" element={<SellerProfile currentUser={user} />} />
            <Route path="/seller/:id" element={<SellerProfile currentUser={user} />} />
            
            <Route path="/post" element={<Navigate to="/cong-dong/dang-tin" replace />} />
            <Route path="/edit/:id" element={<Navigate to="/profile" replace />} />
            <Route path="/manage-ads" element={<Navigate to="/cong-dong/yeu-cau" replace />} />

            <Route path="/chat" element={wait(user ? <Chat user={user} /> : <Navigate to="/login" />)} />
            <Route path="/chat/:roomId" element={wait(user ? <Chat user={user} /> : <Navigate to="/login" />)} />
            
            <Route path="/upgrade" element={<Navigate to="/" replace />} />
            <Route path="/wallet" element={<Navigate to="/" replace />} />
            
            <Route path="/admin" element={wait(user?.role === 'admin' ? <Admin user={user!} /> : <Navigate to="/" />)} />

            <Route path="/login" element={wait(!user ? <Auth onLogin={handleLogin} /> : <Navigate to="/" replace />)} />
            <Route path="/register" element={wait(!user ? <Register onLogin={handleLogin} /> : <Navigate to="/" replace />)} />
            
            <Route path="/tai-ung-dung" element={<AppDownload />} />
            <Route path="/tai" element={<Navigate to="/tai-ung-dung" replace />} />
            <Route path="/page/:slug" element={<StaticPage />} />
            <Route path="*" element={<div className="h-[50vh] flex items-center justify-center font-bold text-gray-400">404 - Trang không tồn tại</div>} />
          </Routes>
          </React.Suspense>
        </CommunityFrame>

        {/* --- [CUSTOM TOAST] --- */}
        {notification && notification.show && (
            <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[9999] animate-bounce-in">
                <div className="bg-green-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 border-2 border-white/20 backdrop-blur-md">
                    <div className="bg-white/20 p-1 rounded-full">
                        <IconCheckCircle />
                    </div>
                    <span className="font-bold text-sm tracking-wide">{notification.message}</span>
                </div>
            </div>
        )}
      </Router>
    </HelmetProvider>
  );
};

export default App;
