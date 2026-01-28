import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';

// --- Layout & Pages ---
import Layout from './components/Layout';
import Home from './pages/Home';
import ListingDetail from './pages/ListingDetail';
import PostListing from './pages/PostListing';
import Chat from './pages/Chat';
import Profile from './pages/Profile';
import SellerProfile from './pages/SellerProfile';
import Auth from './pages/Auth';
import Register from './pages/Register';
import ManageAds from './pages/ManageAds';
import Subscription from './pages/Subscription';
import Wallet from './pages/Wallet';
import Admin from './pages/Admin';
import StaticPage from './pages/StaticPage';

// --- Component ---
import GoogleOneTap from './components/GoogleOneTap';

// --- Services ---
import { db, auth } from './services/db'; 
import { User } from './types';
import { formatPrice } from './utils/format';

// --- Firebase ---
import { onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
// [THÊM] Import Messaging để xử lý token và tin nhắn
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { app } from './services/db'; // Import app từ db service

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
        try {
          // --- BƯỚC 1: LẤY THÔNG TIN USER ---
          const currentUser = await db.getUserProfile(firebaseUser.uid);
          
          if (currentUser) {
            setUser(currentUser);
            prevBalanceRef.current = currentUser.walletBalance;

            // --- BƯỚC 2: CẤU HÌNH PUSH NOTIFICATION (AN TOÀN TUYỆT ĐỐI) ---
            try {
                const messaging = getMessaging(app);

                // A. Xin quyền
                const permission = await Notification.requestPermission();
                
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
                                await updateDoc(doc(dbInstance, "users", currentUser.id), {
                                    fcmToken: token,
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
                    const title = payload.notification?.title || "Thông báo mới";
                    const body = payload.notification?.body || "Bạn có tin nhắn mới";
                    showSafeToast(`🔔 ${title}: ${body}`);
                });

            } catch (err) {
                // Log lỗi nhẹ nhàng, không để crash App
                console.error("Lỗi Push Notification (nhưng App vẫn chạy):", err);
            }

            // --- BƯỚC 3: LẮNG NGHE THAY ĐỔI VÍ TIỀN (REALTIME) ---
            if (db.onUserChange) {
              unsubscribeUserChange = db.onUserChange(currentUser.id, (updatedUser) => {
                // Kiểm tra nếu số dư TĂNG LÊN thì mới báo
                if (updatedUser.walletBalance > prevBalanceRef.current) {
                   const amount = updatedUser.walletBalance - prevBalanceRef.current;
                   if (amount > 0) {
                       showSafeToast(`Ting ting! Ví vừa cộng ${formatPrice(amount)}`);
                   }
                }
                
                // Cập nhật state
                setUser(updatedUser);
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
    const intervalId = setInterval(reportOnline, 120000);
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

  if (isInitializing) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-blue-600 font-black uppercase text-[10px] tracking-widest">Chợ Của Tui đang khởi động...</p>
      </div>
    );
  }

  return (
    <HelmetProvider>
      <Router>
        <ScrollToTop />
        {!user && <GoogleOneTap onLogin={handleLogin} />}

        <Layout user={user}>
          <Routes>
            <Route path="/" element={<Home user={user} />} />
            <Route path="/search" element={<Home user={user} />} />
            <Route path="/danh-muc/:slug" element={<Home user={user} />} />
            <Route path="/danh-muc/:parentSlug/:childSlug" element={<Home user={user} />} />

            <Route path="/san-pham/:slugWithId" element={<ListingDetail user={user} />} />
            <Route path="/listings/:slugWithId" element={<ListingDetail user={user} />} />
            
            <Route path="/profile" element={user ? <Profile user={user} onLogout={handleLogout} onUpdateUser={handleUpdateUser} /> : <Navigate to="/login" />} />
            <Route path="/profile/:id" element={<SellerProfile currentUser={user} />} />
            <Route path="/seller/:id" element={<SellerProfile currentUser={user} />} />
            
            <Route path="/post" element={user ? <PostListing user={user} /> : <Navigate to="/login" />} />
            <Route path="/edit/:id" element={user ? <PostListing user={user} /> : <Navigate to="/login" />} />
            
            <Route path="/manage-ads" element={user ? <ManageAds user={user} onUpdateUser={handleUpdateUser} /> : <Navigate to="/login" />} />
            
            <Route path="/chat" element={user ? <Chat user={user} /> : <Navigate to="/login" />} />
            <Route path="/chat/:roomId" element={user ? <Chat user={user} /> : <Navigate to="/login" />} />
            
            <Route path="/upgrade" element={user ? <Subscription user={user} onUpdateUser={handleUpdateUser} /> : <Navigate to="/login" />} />
            <Route path="/wallet" element={user ? <Wallet user={user} /> : <Navigate to="/login" />} />
            
            <Route path="/admin" element={user?.role === 'admin' ? <Admin user={user} /> : <Navigate to="/" />} />

            <Route path="/login" element={!user ? <Auth onLogin={handleLogin} /> : <Navigate to="/" replace />} />
            <Route path="/register" element={!user ? <Register onLogin={handleLogin} /> : <Navigate to="/" replace />} />
            
            <Route path="/page/:slug" element={<StaticPage />} />
            <Route path="*" element={<div className="h-[50vh] flex items-center justify-center font-bold text-gray-400">404 - Trang không tồn tại</div>} />
          </Routes>
        </Layout>

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
