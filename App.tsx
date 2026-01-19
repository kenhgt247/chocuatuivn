import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';

// [MỚI] Import các hàm Firestore để cập nhật trạng thái Online
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db as firestoreDB } from './services/db'; // Import DB gốc (đặt tên khác để không trùng service db)

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
import SecretImport from './pages/SecretImport';

// Component Google One Tap
import GoogleOneTap from './components/GoogleOneTap';

// Services & Types
import { db } from './services/db'; // Service wrapper
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
            prevBalanceRef.current = currentUser.walletBalance || 0;

            // 1.2 Lắng nghe thay đổi User (Số dư, Trạng thái) Realtime từ Firestore
            if (db.onUserChange) {
                unsubscribe = db.onUserChange(currentUser.id, (updatedUser) => {
                    // Kiểm tra tiền về: Nếu số dư mới > số dư cũ
                    if ((updatedUser.walletBalance || 0) > prevBalanceRef.current) {
                        const amount = (updatedUser.walletBalance || 0) - prevBalanceRef.current;
                        // Thông báo "Ting Ting" khi được cộng tiền
                        alert(`💰 Ting Ting! Ví của bạn vừa được cộng ${formatPrice(amount)}`);
                    }
                    
                    // Cập nhật State và Ref
                    setUser(updatedUser);
                    prevBalanceRef.current = updatedUser.walletBalance || 0;
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

  // -----------------------------------------------------------
  // [MỚI] 2. LOGIC CẬP NHẬT TRẠNG THÁI ONLINE (HEARTBEAT)
  // -----------------------------------------------------------
  useEffect(() => {
    if (!user) return;

    // Hàm báo cáo lên Server: "Tôi đang hoạt động"
    const reportOnline = async () => {
      try {
        // Tham chiếu đến document của user hiện tại
        const userRef = doc(firestoreDB, "users", user.id);
        
        // Cập nhật trường isOnline và thời gian hoạt động
        await updateDoc(userRef, {
          isOnline: true,
          lastActive: new Date().toISOString() // Hoặc dùng serverTimestamp() nếu muốn chuẩn server
        });
      } catch (e) {
        console.error("Lỗi cập nhật trạng thái Online:", e);
      }
    };

    // a. Chạy ngay lập tức khi vừa có user (vừa đăng nhập/F5)
    reportOnline();

    // b. Thiết lập vòng lặp: Cứ 5 phút báo cáo lại 1 lần (để duy trì trạng thái)
    const interval = setInterval(reportOnline, 5 * 60 * 1000);

    // c. Cleanup: Xóa vòng lặp khi user đăng xuất hoặc tắt component
    return () => clearInterval(interval);
  }, [user]); // Chạy lại mỗi khi user thay đổi (đăng nhập/đăng xuất)
  // -----------------------------------------------------------


  // Các handler quản lý User state
  const handleLogin = (u: User) => {
      setUser(u);
      prevBalanceRef.current = u.walletBalance || 0;
  };
  
  const handleLogout = async () => {
    // [Tuỳ chọn] Trước khi logout, set Offline ngay lập tức
    if (user) {
        try {
            const userRef = doc(firestoreDB, "users", user.id);
            await updateDoc(userRef, { isOnline: false });
        } catch (e) {}
    }

    db.logout();
    setUser(null);
    prevBalanceRef.current = 0;
  };
  
  const handleUpdateUser = (u: User) => {
    setUser(u);
    prevBalanceRef.current = u.walletBalance || 0;
  };

  // Màn hình loading
  if (isInitializing) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-bgMain">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-primary font-black uppercase text-[10px] tracking-widest">Chợ Của Tui đang tải...</p>
      </div>
    );
  }

  return (
    <HelmetProvider>
      <Router>
        <ScrollToTop />

        {!isInitializing && !user && <GoogleOneTap onLogin={handleLogin} />}

        <Layout user={user}>
          <Routes>
            <Route path="/" element={<Home user={user} />} />
            <Route path="/search" element={<Home user={user} />} />
            <Route path="/danh-muc/:slug" element={<Home user={user} />} />
            <Route path="/danh-muc/:parentSlug/:childSlug" element={<Home user={user} />} />

            <Route path="/san-pham/:slugWithId" element={<ListingDetail user={user} />} />
            <Route path="/listings/:slugWithId" element={<ListingDetail user={user} />} />
            <Route path="/listing/:slugWithId" element={<ListingDetail user={user} />} />

            <Route path="/profile" element={user ? <Profile user={user} onLogout={handleLogout} onUpdateUser={handleUpdateUser} /> : <Navigate to="/login" />} />
            <Route path="/profile/:id" element={<SellerProfile currentUser={user} />} />
            <Route path="/seller/:id" element={<SellerProfile currentUser={user} />} />
            
            <Route path="/post" element={user ? <PostListing user={user} /> : <Navigate to="/login" />} />
            <Route path="/edit/:id" element={user ? <PostListing user={user} /> : <Navigate to="/login" />} />
            
            <Route path="/manage-ads" element={user ? <ManageAds user={user} onUpdateUser={handleUpdateUser} /> : <Navigate to="/login" />} />
            
            <Route path="/chat" element={user ? <Chat user={user} /> : <Navigate to="/login" />} />
            <Route path="/chat/:roomId" element={user ? <Chat user={user} /> : <Navigate to="/login" />} />
            
            <Route path="/upgrade" element={user ? <Subscription user={user} onUpdateUser={handleUpdateUser} /> : <Navigate to="/login" />} />
            <Route path="/wallet" element={user ? <Wallet user={user} onUpdateUser={handleUpdateUser} /> : <Navigate to="/login" />} />
            
            <Route path="/admin" element={user?.role === 'admin' ? <Admin user={user} /> : <Navigate to="/" />} />

            <Route 
              path="/login" 
              element={!user ? <Auth onLogin={handleLogin} /> : <Navigate to="/" replace />} 
            />
            <Route 
              path="/register" 
              element={!user ? <Register onLogin={handleLogin} /> : <Navigate to="/" replace />} 
            />
            
            <Route path="/page/:slug" element={<StaticPage />} />
            <Route path="*" element={<div className="h-[50vh] flex items-center justify-center font-bold text-gray-400">404 - Trang này không tồn tại</div>} />
            <Route path="/secret-pump" element={<SecretImport />} />
          </Routes>
        </Layout>
      </Router>
    </HelmetProvider>
  );
};

export default App;
