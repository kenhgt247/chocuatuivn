import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async'; // [QUAN TRỌNG] Hỗ trợ SEO Facebook/Zalo

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

// Component Google One Tap
import GoogleOneTap from './components/GoogleOneTap';

// Services & Types
import { db } from './services/db';
import { User } from './types';
import { formatPrice } from './utils/format';

// Helper: Tự động cuộn lên đầu trang khi chuyển Route
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
  
  // Dùng ref để lưu số dư cũ nhằm so sánh chính xác giữa các lần render
  const prevBalanceRef = useRef<number>(0);

  // 1. Khởi tạo: Kiểm tra user login & Thiết lập Realtime Listener
  useEffect(() => {
    let unsubscribe: () => void;

    const initialize = async () => {
      try {
        // 1.1 Lấy user hiện tại từ Auth
        const currentUser = await db.getCurrentUser();
        
        if (currentUser) {
            setUser(currentUser);
            prevBalanceRef.current = currentUser.walletBalance;

            // 1.2 Lắng nghe thay đổi User (Số dư, Trạng thái) Realtime từ Firestore
            if (db.onUserChange) {
                unsubscribe = db.onUserChange(currentUser.id, (updatedUser) => {
                    // Kiểm tra tiền về: Nếu số dư mới > số dư cũ
                    if (updatedUser.walletBalance > prevBalanceRef.current) {
                        const amount = updatedUser.walletBalance - prevBalanceRef.current;
                        // Thông báo "Ting Ting" khi được cộng tiền
                        alert(`💰 Ting Ting! Ví của bạn vừa được cộng ${formatPrice(amount)}`);
                    }
                    
                    // Cập nhật State và Ref
                    setUser(updatedUser);
                    prevBalanceRef.current = updatedUser.walletBalance;
                });
            }
        }
      } catch (err) {
        console.error("Auth init error:", err);
      } finally {
        // Hoàn tất quá trình khởi tạo ứng dụng
        setIsInitializing(false);
      }
    };

    initialize();

    // Cleanup: Ngắt kết nối listener khi component bị hủy (Unmount)
    return () => {
        if (unsubscribe) unsubscribe();
    };
  }, []);

  // Các handler quản lý User state
  const handleLogin = (u: User) => {
      setUser(u);
      prevBalanceRef.current = u.walletBalance; // Reset mốc so sánh ngay khi login
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

  // Màn hình loading khi đang check login (Xử lý UX khi mở app)
  if (isInitializing) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-bgMain">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-primary font-black uppercase text-[10px] tracking-widest">Chợ Của Tui đang tải...</p>
      </div>
    );
  }

  return (
    <HelmetProvider> {/* [BẮT BUỘC] Bao bọc toàn bộ để SEO Helmet hoạt động */}
      <Router>
        <ScrollToTop />

        {/* Google One Tap chỉ hiện cho khách chưa đăng nhập */}
        {!isInitializing && !user && <GoogleOneTap onLogin={handleLogin} />}

        <Layout user={user}>
          <Routes>
            {/* TRANG CHỦ & TÌM KIẾM */}
            <Route path="/" element={<Home user={user} />} />
            <Route path="/search" element={<Home user={user} />} />
            <Route path="/danh-muc/:slug" element={<Home user={user} />} />
            <Route path="/danh-muc/:parentSlug/:childSlug" element={<Home user={user} />} />

            {/* CHI TIẾT SẢN PHẨM (Hỗ trợ nhiều định dạng URL) */}
            <Route path="/san-pham/:slugWithId" element={<ListingDetail user={user} />} />
            <Route path="/listings/:slugWithId" element={<ListingDetail user={user} />} />
            <Route path="/listing/:slugWithId" element={<ListingDetail user={user} />} />

            {/* TRANG CÁ NHÂN & QUẢN LÝ (Yêu cầu Đăng nhập) */}
            <Route path="/profile" element={user ? <Profile user={user} onLogout={handleLogout} onUpdateUser={handleUpdateUser} /> : <Navigate to="/login" />} />
            <Route path="/profile/:id" element={<SellerProfile currentUser={user} />} />
            <Route path="/seller/:id" element={<SellerProfile currentUser={user} />} />
            
            {/* ĐĂNG TIN & CHỈNH SỬA */}
            <Route path="/post" element={user ? <PostListing user={user} /> : <Navigate to="/login" />} />
            <Route path="/edit/:id" element={user ? <PostListing user={user} /> : <Navigate to="/login" />} />
            
            {/* QUẢN LÝ TIN ĐĂNG */}
            <Route path="/manage-ads" element={user ? <ManageAds user={user} onUpdateUser={handleUpdateUser} /> : <Navigate to="/login" />} />
            
            {/* HỆ THỐNG CHAT */}
            <Route path="/chat" element={user ? <Chat user={user} /> : <Navigate to="/login" />} />
            <Route path="/chat/:roomId" element={user ? <Chat user={user} /> : <Navigate to="/login" />} />
            
            {/* VÍ & NÂNG CẤP DỊCH VỤ */}
            <Route path="/upgrade" element={user ? <Subscription user={user} onUpdateUser={handleUpdateUser} /> : <Navigate to="/login" />} />
            <Route path="/wallet" element={user ? <Wallet user={user} onUpdateUser={handleUpdateUser} /> : <Navigate to="/login" />} />
            
            {/* QUẢN TRỊ VIÊN (ADMIN) */}
            <Route path="/admin" element={user?.role === 'admin' ? <Admin user={user} /> : <Navigate to="/" />} />

            {/* XÁC THỰC (Ẩn khi đã đăng nhập) */}
            <Route 
              path="/login" 
              element={!user ? <Auth onLogin={handleLogin} /> : <Navigate to="/" replace />} 
            />
            <Route 
              path="/register" 
              element={!user ? <Register onLogin={handleLogin} /> : <Navigate to="/" replace />} 
            />
            
            {/* TRANG TĨNH & 404 */}
            <Route path="/page/:slug" element={<StaticPage />} />
            <Route path="*" element={<div className="h-[50vh] flex items-center justify-center font-bold text-gray-400">404 - Trang này không tồn tại</div>} />
          </Routes>
        </Layout>
      </Router>
    </HelmetProvider>
  );
};

export default App;