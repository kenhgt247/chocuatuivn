import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// --- Services & Types ---
import { db } from './services/db';
import { User } from './types';
import { formatPrice } from './utils/format';

// --- Firebase (Dùng cho chức năng Online Realtime) ---
import { getFirestore, doc, updateDoc, serverTimestamp } from 'firebase/firestore';

// --- Components ---
import Header from './components/Header';
import BottomNav from './components/BottomNav'; // Đảm bảo bạn có file này
import GoogleOneTap from './components/GoogleOneTap';

// --- Pages ---
import Home from './pages/Home';
import ListingDetail from './pages/ListingDetail';
import PostListing from './pages/PostListing';
import EditListing from './pages/EditListing';
import ChatList from './pages/ChatList';
import Chat from './pages/Chat';
import Profile from './pages/Profile';
import SellerProfile from './pages/SellerProfile';
import Auth from './pages/Auth';
import Register from './pages/Register';
import ManageAds from './pages/ManageAds';
import Subscription from './pages/Subscription';
import Wallet from './pages/Wallet';
import Admin from './pages/Admin'; // Hoặc AdminDashboard tùy tên file bạn đặt
import StaticPage from './pages/StaticPage';
import CategoryPage from './pages/CategoryPage'; // Thêm trang danh mục nếu thiếu

// Helper: Tự động cuộn lên đầu trang
const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
};

// Helper: Ẩn BottomNav ở các trang Chat/Login
const LayoutWithNav: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  // Các đường dẫn muốn ẩn BottomNav
  const hideNavRoutes = ['/login', '/register', '/chat/']; 
  const shouldHide = hideNavRoutes.some(path => location.pathname.includes(path));

  return (
    <>
      {children}
      {!shouldHide && <BottomNav />}
    </>
  );
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const prevBalanceRef = useRef<number>(0);

  // ------------------------------------------------------------------
  // 1. KHỞI TẠO & LẮNG NGHE VÍ TIỀN (Realtime User Data)
  // ------------------------------------------------------------------
  useEffect(() => {
    let unsubscribe: () => void;

    const initialize = async () => {
      try {
        const currentUser = await db.getCurrentUser();
        
        if (currentUser) {
            setUser(currentUser);
            prevBalanceRef.current = currentUser.walletBalance;

            // Lắng nghe thay đổi User (Số dư) từ Firestore
            if (db.onUserChange) {
                unsubscribe = db.onUserChange(currentUser.id, (updatedUser) => {
                    // Logic báo tiền về "Ting Ting"
                    if (updatedUser.walletBalance > prevBalanceRef.current) {
                        const amount = updatedUser.walletBalance - prevBalanceRef.current;
                        // Dùng Alert hoặc Toast tùy ý
                        // alert(`💰 Ting Ting! Ví của bạn vừa được cộng ${formatPrice(amount)}`);
                    }
                    
                    setUser(updatedUser);
                    prevBalanceRef.current = updatedUser.walletBalance;
                });
            }
        }
      } catch (err) {
        console.error("Init error:", err);
      } finally {
        setIsInitializing(false);
      }
    };

    initialize();
    return () => { if (unsubscribe) unsubscribe(); };
  }, []);

  // ------------------------------------------------------------------
  // 2. [QUAN TRỌNG] LOGIC BÁO ONLINE (HEARTBEAT) - ĐỂ NÚT XANH SÁNG
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!user) return;

    const dbInstance = getFirestore();
    const userRef = doc(dbInstance, "users", user.id);

    // Hàm báo "Tôi đang Online" lên server
    const reportOnline = async () => {
      try {
        await updateDoc(userRef, {
          isOnline: true,
          lastActiveAt: serverTimestamp() // Cập nhật thời gian thực
        });
      } catch (error) {
        console.error("Heartbeat error (không quan trọng):", error);
      }
    };

    // Hàm báo "Tôi đã Offline"
    const reportOffline = async () => {
      try {
        await updateDoc(userRef, {
          isOnline: false,
          lastActiveAt: serverTimestamp()
        });
      } catch (error) { /* Ignore errors on exit */ }
    };

    // A. Báo Online ngay khi App chạy
    reportOnline();

    // B. Cứ 60 giây báo Online lại 1 lần (Heartbeat)
    const intervalId = setInterval(reportOnline, 60 * 1000);

    // C. Xử lý khi ẩn tab/tắt trình duyệt
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') reportOnline();
    };

    const handleBeforeUnload = () => { reportOffline(); };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      reportOffline();
    };
  }, [user]); // Chạy lại mỗi khi user thay đổi (login/logout)


  // ------------------------------------------------------------------
  // HANDLERS
  // ------------------------------------------------------------------
  const handleLogin = (u: User) => {
      setUser(u);
      prevBalanceRef.current = u.walletBalance;
  };
  
  const handleLogout = () => {
    db.logout();
    setUser(null);
    prevBalanceRef.current = 0;
  };
  
  const handleUpdateUser = (u: User) => {
    setUser(u);
    prevBalanceRef.current = u.walletBalance;
  };

  // Màn hình loading
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

        {/* Google One Tap */}
        {!user && <GoogleOneTap onLogin={handleLogin} />}

        {/* Header luôn hiện */}
        <Header user={user} />

        <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
          <LayoutWithNav>
            <Routes>
              {/* --- PUBLIC ROUTES --- */}
              <Route path="/" element={<Home user={user} />} />
              <Route path="/search" element={<Home user={user} />} />
              <Route path="/danh-muc/:slug" element={<CategoryPage />} /> 
              <Route path="/danh-muc/:parentSlug/:childSlug" element={<CategoryPage />} />

              {/* Chi tiết tin đăng */}
              <Route path="/san-pham/:slugWithId" element={<ListingDetail user={user} />} />
              <Route path="/listings/:slugWithId" element={<ListingDetail user={user} />} />
              <Route path="/listing/:id" element={<ListingDetail user={user} />} />

              {/* Trang người bán (Public) */}
              <Route path="/profile/:id" element={<SellerProfile currentUser={user} />} />
              <Route path="/seller/:id" element={<SellerProfile currentUser={user} />} />

              {/* --- PRIVATE ROUTES (Cần đăng nhập) --- */}
              <Route path="/profile" element={user ? <Profile user={user} onLogout={handleLogout} onUpdateUser={handleUpdateUser} /> : <Navigate to="/login" />} />
              <Route path="/post" element={user ? <PostListing user={user} /> : <Navigate to="/login" />} />
              <Route path="/edit/:id" element={user ? <EditListing user={user} /> : <Navigate to="/login" />} />
              <Route path="/manage-ads" element={user ? <ManageAds user={user} onUpdateUser={handleUpdateUser} /> : <Navigate to="/login" />} />
              
              {/* Chat */}
              <Route path="/chat" element={user ? <ChatList user={user} /> : <Navigate to="/login" />} />
              <Route path="/chat/:roomId" element={user ? <Chat user={user} /> : <Navigate to="/login" />} />

              {/* Ví & Nâng cấp */}
              <Route path="/upgrade" element={user ? <Subscription user={user} onUpdateUser={handleUpdateUser} /> : <Navigate to="/login" />} />
              <Route path="/wallet" element={user ? <Wallet user={user} onUpdateUser={handleUpdateUser} /> : <Navigate to="/login" />} />

              {/* Admin */}
              <Route path="/admin" element={user?.role === 'admin' ? <Admin user={user} /> : <Navigate to="/" />} />

              {/* Auth */}
              <Route path="/login" element={!user ? <Auth onLogin={handleLogin} /> : <Navigate to="/" replace />} />
              <Route path="/register" element={!user ? <Register onLogin={handleLogin} /> : <Navigate to="/" replace />} />
              
              {/* Static & 404 */}
              <Route path="/page/:slug" element={<StaticPage />} />
              <Route path="*" element={<div className="h-[50vh] flex items-center justify-center font-bold text-gray-400">404 - Trang không tồn tại</div>} />
            </Routes>
          </LayoutWithNav>
        </div>

        {/* Thông báo toàn cục */}
        <ToastContainer position="bottom-center" autoClose={2000} hideProgressBar={true} newestOnTop={true} theme="light" />
      </Router>
    </HelmetProvider>
  );
};

export default App;
