import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async'; // Hỗ trợ SEO
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// --- Layout & Pages ---
import Layout from './components/Layout'; // Giữ nguyên Layout của bạn
import Home from './pages/Home';
import ListingDetail from './pages/ListingDetail';
import PostListing from './pages/PostListing';
import Chat from './pages/Chat';
//import ChatList from './pages/ChatList'; // Thêm nếu bạn có trang danh sách chat
import Profile from './pages/Profile';
import SellerProfile from './pages/SellerProfile';
import Auth from './pages/Auth';
import Register from './pages/Register';
import ManageAds from './pages/ManageAds';
import Subscription from './pages/Subscription';
import Wallet from './pages/Wallet';
import Admin from './pages/Admin';
import StaticPage from './pages/StaticPage';
import CategoryPage from './pages/CategoryPage'; // Thêm trang danh mục nếu cần
import EditListing from './pages/EditListing';   // Thêm trang sửa tin nếu cần

// --- Component Google ---
import GoogleOneTap from './components/GoogleOneTap';

// --- Services & Types ---
import { db } from './services/db';
import { User } from './types';
import { formatPrice } from './utils/format';

// --- Firebase (QUAN TRỌNG: Để báo Online) ---
import { getFirestore, doc, updateDoc, serverTimestamp } from 'firebase/firestore';

// Helper: Tự động cuộn lên đầu trang
const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  
  // Dùng ref để lưu số dư cũ nhằm so sánh chính xác ("Ting Ting")
  const prevBalanceRef = useRef<number>(0);

  // ------------------------------------------------------------------
  // 1. KHỞI TẠO & LẮNG NGHE VÍ TIỀN
  // ------------------------------------------------------------------
  useEffect(() => {
    let unsubscribe: () => void;

    const initialize = async () => {
      try {
        const currentUser = await db.getCurrentUser();
        
        if (currentUser) {
            setUser(currentUser);
            prevBalanceRef.current = currentUser.walletBalance;

            // Lắng nghe thay đổi User (Số dư) Realtime
            if (db.onUserChange) {
                unsubscribe = db.onUserChange(currentUser.id, (updatedUser) => {
                    // Kiểm tra tiền về
                    if (updatedUser.walletBalance > prevBalanceRef.current) {
                        const amount = updatedUser.walletBalance - prevBalanceRef.current;
                        // Dùng Toast cho đẹp thay vì alert
                        toast.success(`💰 Ting Ting! Ví vừa được cộng ${formatPrice(amount)}`);
                    }
                    
                    setUser(updatedUser);
                    prevBalanceRef.current = updatedUser.walletBalance;
                });
            }
        }
      } catch (err) {
        console.error("Auth init error:", err);
      } finally {
        setIsInitializing(false);
      }
    };

    initialize();
    return () => {
        if (unsubscribe) unsubscribe();
    };
  }, []);

  // ------------------------------------------------------------------
  // 2. [QUAN TRỌNG] LOGIC BÁO ONLINE (HEARTBEAT) - FIX LỖI NÚT XÁM
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!user) return;

    const dbInstance = getFirestore();
    const userRef = doc(dbInstance, "users", user.id);

    // Hàm báo "Tôi đang Online"
    const reportOnline = async () => {
      try {
        await updateDoc(userRef, {
          isOnline: true,
          lastActiveAt: serverTimestamp() // Cập nhật giờ hiện tại
        });
      } catch (error) {
        // Lỗi nhỏ bỏ qua (ví dụ mất mạng)
      }
    };

    // Hàm báo "Tôi Offline"
    const reportOffline = async () => {
      try {
        await updateDoc(userRef, {
          isOnline: false,
          lastActiveAt: serverTimestamp()
        });
      } catch (error) {}
    };

    // A. Báo Online ngay lập tức khi vào App
    reportOnline();

    // B. Cứ 60 giây báo lại 1 lần (Tim đập)
    const intervalId = setInterval(reportOnline, 60 * 1000);

    // C. Xử lý khi ẩn/hiện tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') reportOnline();
    };

    // D. Xử lý khi tắt trình duyệt
    const handleBeforeUnload = () => { reportOffline(); };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      reportOffline();
    };
  }, [user]); // Chạy lại khi user thay đổi (login/logout)


  // --- HANDLERS ---
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

  // Màn hình chờ (Loading Screen)
  if (isInitializing) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-white">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-blue-600 font-black uppercase text-[10px] tracking-widest">Chợ Của Tui đang tải...</p>
      </div>
    );
  }

  return (
    <HelmetProvider>
      <Router>
        <ScrollToTop />

        {/* Google One Tap */}
        {!user && <GoogleOneTap onLogin={handleLogin} />}

        {/* --- MAIN LAYOUT (Bao bọc tất cả) --- */}
        <Layout user={user}>
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

            {/* Trang người bán */}
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
        </Layout>

        {/* Thông báo đẹp (Toast) */}
        <ToastContainer position="bottom-center" autoClose={3000} hideProgressBar={true} newestOnTop={true} theme="light" />
      </Router>
    </HelmetProvider>
  );
};

export default App;
