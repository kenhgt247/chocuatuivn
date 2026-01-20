import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Layout & Pages
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
import CategoryPage from './pages/CategoryPage';
import EditListing from './pages/EditListing';

// Component
import GoogleOneTap from './components/GoogleOneTap';

// Services
import { db } from './services/db';
import { User } from './types';
import { formatPrice } from './utils/format';

// Firebase
import { getFirestore, doc, updateDoc, serverTimestamp } from 'firebase/firestore';

// Helper: Scroll to top
const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const prevBalanceRef = useRef<number>(0);

  // 1. KHỞI TẠO USER & LẮNG NGHE VÍ (Chỉ chạy 1 lần khi load app)
  useEffect(() => {
    let unsubscribe: () => void;

    const initialize = async () => {
      try {
        const currentUser = await db.getCurrentUser();
        
        if (currentUser) {
            setUser(currentUser);
            prevBalanceRef.current = currentUser.walletBalance;

            // Lắng nghe thay đổi User (Số dư)
            if (db.onUserChange) {
                unsubscribe = db.onUserChange(currentUser.id, (updatedUser) => {
                    // Logic báo tiền về
                    if (updatedUser.walletBalance > prevBalanceRef.current) {
                        const amount = updatedUser.walletBalance - prevBalanceRef.current;
                        toast.success(`💰 Ting Ting! Ví được cộng ${formatPrice(amount)}`);
                    }
                    // Cập nhật User nhưng KHÔNG làm ảnh hưởng logic Online bên dưới
                    setUser(updatedUser);
                    prevBalanceRef.current = updatedUser.walletBalance;
                });
            }
        }
      } catch (err) {
        console.error("Auth error:", err);
      } finally {
        setIsInitializing(false);
      }
    };

    initialize();
    return () => { if (unsubscribe) unsubscribe(); };
  }, []);

  // ------------------------------------------------------------------
  // 2. [ĐÃ SỬA LỖI] LOGIC ONLINE/OFFLINE ỔN ĐỊNH (HEARTBEAT)
  // ------------------------------------------------------------------
  useEffect(() => {
    // Nếu chưa đăng nhập thì không làm gì
    if (!user?.id) return;

    const dbInstance = getFirestore();
    const userRef = doc(dbInstance, "users", user.id);

    // Hàm báo Online (Cập nhật timestamp)
    const reportOnline = async () => {
      try {
        await updateDoc(userRef, {
          isOnline: true,
          lastActiveAt: serverTimestamp()
        });
      } catch (e) { /* Bỏ qua lỗi mạng nhỏ */ }
    };

    // Hàm báo Offline (Chỉ dùng khi tắt tab)
    const reportOffline = async () => {
      try {
        await updateDoc(userRef, {
          isOnline: false,
          lastActiveAt: serverTimestamp()
        });
      } catch (e) {}
    };

    // A. Báo Online ngay lập tức
    reportOnline();

    // B. Cứ 2 phút báo Online lại 1 lần (Heartbeat)
    // Giảm tần suất xuống để đỡ tốn tài nguyên, server check 5 phút mới coi là offline
    const intervalId = setInterval(reportOnline, 2 * 60 * 1000);

    // C. Xử lý khi người dùng ẩn tab đi và quay lại
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        reportOnline();
      }
    };

    // D. Xử lý khi tắt hẳn trình duyệt (Quan trọng)
    const handleBeforeUnload = () => {
        // Dùng navigator.sendBeacon để gửi tin hiệu cuối cùng tin cậy hơn
        reportOffline();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      
      // [QUAN TRỌNG]: KHÔNG gọi reportOffline() ở đây nữa!
      // Vì React có thể chạy cleanup khi component re-render (do update ví tiền),
      // nếu gọi ở đây sẽ gây nhấp nháy.
      // Chúng ta chỉ Offline khi: 1. Tắt trình duyệt (beforeUnload), 2. Bấm Logout.
    };
  }, [user?.id]); // [FIX]: Chỉ chạy lại khi ID thay đổi (Đăng nhập/Đăng xuất), ko chạy khi update ví.


  // --- HANDLERS ---
  const handleLogin = (u: User) => {
      setUser(u);
      prevBalanceRef.current = u.walletBalance;
  };
  
  const handleLogout = async () => {
    // Báo Offline chủ động trước khi logout
    if (user?.id) {
        try {
            const dbInstance = getFirestore();
            await updateDoc(doc(dbInstance, "users", user.id), {
                isOnline: false,
                lastActiveAt: serverTimestamp()
            });
        } catch(e) {}
    }
    
    db.logout();
    setUser(null);
    prevBalanceRef.current = 0;
  };
  
  const handleUpdateUser = (u: User) => {
    setUser(u);
    prevBalanceRef.current = u.walletBalance;
  };

  // Màn hình chờ
  if (isInitializing) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-blue-600 font-black uppercase text-[10px] tracking-widest">Chợ Của Tui...</p>
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
            <Route path="/listing/:id" element={<ListingDetail user={user} />} />

            <Route path="/profile" element={user ? <Profile user={user} onLogout={handleLogout} onUpdateUser={handleUpdateUser} /> : <Navigate to="/login" />} />
            <Route path="/profile/:id" element={<SellerProfile currentUser={user} />} />
            <Route path="/seller/:id" element={<SellerProfile currentUser={user} />} />
            
            <Route path="/post" element={user ? <PostListing user={user} /> : <Navigate to="/login" />} />
            <Route path="/edit/:id" element={user ? <EditListing user={user} /> : <Navigate to="/login" />} />
            
            <Route path="/manage-ads" element={user ? <ManageAds user={user} onUpdateUser={handleUpdateUser} /> : <Navigate to="/login" />} />
            
            <Route path="/chat" element={user ? <Chat user={user} /> : <Navigate to="/login" />} />
            <Route path="/chat/:roomId" element={user ? <Chat user={user} /> : <Navigate to="/login" />} />
            
            <Route path="/upgrade" element={user ? <Subscription user={user} onUpdateUser={handleUpdateUser} /> : <Navigate to="/login" />} />
            <Route path="/wallet" element={user ? <Wallet user={user} onUpdateUser={handleUpdateUser} /> : <Navigate to="/login" />} />
            
            <Route path="/admin" element={user?.role === 'admin' ? <Admin user={user} /> : <Navigate to="/" />} />

            <Route path="/login" element={!user ? <Auth onLogin={handleLogin} /> : <Navigate to="/" replace />} />
            <Route path="/register" element={!user ? <Register onLogin={handleLogin} /> : <Navigate to="/" replace />} />
            
            <Route path="/page/:slug" element={<StaticPage />} />
            <Route path="*" element={<div className="h-[50vh] flex items-center justify-center font-bold text-gray-400">404 - Trang không tồn tại</div>} />
          </Routes>
        </Layout>

        <ToastContainer position="bottom-center" autoClose={3000} hideProgressBar={true} newestOnTop={true} theme="light" />
      </Router>
    </HelmetProvider>
  );
};

export default App;
