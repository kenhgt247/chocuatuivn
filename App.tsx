import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

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

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Khởi tạo: Kiểm tra user đang đăng nhập
  useEffect(() => {
    const initialize = async () => {
      try {
        const u = await db.getCurrentUser();
        setUser(u);
      } catch (err) {
        console.error("Auth init error:", err);
      } finally {
        setIsInitializing(false);
      }
    };
    initialize();
  }, []);

  // Các handler quản lý User state
  const handleLogin = (u: User) => setUser(u);
  const handleLogout = () => {
    db.logout();
    setUser(null);
  };
  const handleUpdateUser = (u: User) => setUser(u);

  // Màn hình loading khi đang check login
  if (isInitializing) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-bgMain">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-primary font-black uppercase text-[10px] tracking-widest">Đang tải...</p>
      </div>
    );
  }

  return (
    <Router>
      {/* ========================================================= */}
      {/* TÍCH HỢP GOOGLE ONE TAP LOGIN */}
      {/* ========================================================= */}
      {!isInitializing && !user && <GoogleOneTap onLogin={handleLogin} />}

      <Layout user={user}>
        <Routes>
          {/* ========================================================= */}
          {/* 1. TRANG CHỦ & TÌM KIẾM */}
          {/* ========================================================= */}
          <Route path="/" element={<Home user={user} />} />
          <Route path="/search" element={<Home user={user} />} />
          <Route path="/danh-muc/:slug" element={<Home user={user} />} />

          {/* ========================================================= */}
          {/* 2. CHI TIẾT SẢN PHẨM & ROUTES HỖ TRỢ THÔNG BÁO */}
          {/* ========================================================= */}
          
          {/* Route SEO chuẩn (hiển thị trên web) */}
          <Route path="/san-pham/:slugWithId" element={<ListingDetail user={user} />} />
          
          {/* [QUAN TRỌNG] Route Cầu nối cho Thông báo (Do db.ts gửi link dạng này) */}
          {/* Khi bấm thông báo "Tin được duyệt", nó chạy vào đây và vẫn hiển thị ListingDetail */}
          <Route path="/listings/:slugWithId" element={<ListingDetail user={user} />} />


          {/* ========================================================= */}
          {/* 3. USER & SELLER */}
          {/* ========================================================= */}
          
          {/* Route xem Profile người khác */}
          <Route path="/seller/:id" element={<SellerProfile currentUser={user} />} />
          
          {/* [QUAN TRỌNG] Route Cầu nối cho Thông báo Follow */}
          {/* Khi bấm thông báo "Có người theo dõi", nó chạy vào đây */}
          <Route path="/profile/:id" element={<SellerProfile currentUser={user} />} />

          {/* Trang cá nhân của MÌNH */}
          <Route path="/profile" element={<Profile user={user} onLogout={handleLogout} onUpdateUser={handleUpdateUser} />} />
          
          {/* ========================================================= */}
          {/* 4. CÁC ROUTE CẦN ĐĂNG NHẬP (PROTECTED ROUTES) */}
          {/* ========================================================= */}
          <Route path="/post" element={user ? <PostListing user={user} /> : <Navigate to="/login" />} />
          <Route path="/manage-ads" element={user ? <ManageAds user={user} onUpdateUser={handleUpdateUser} /> : <Navigate to="/login" />} />
          
          {/* Route Chat (Cả danh sách và chi tiết phòng chat) */}
          <Route path="/chat" element={user ? <Chat user={user} /> : <Navigate to="/login" />} />
          <Route path="/chat/:roomId" element={user ? <Chat user={user} /> : <Navigate to="/login" />} />
          
          <Route path="/upgrade" element={<Subscription user={user} onUpdateUser={handleUpdateUser} />} />
          <Route path="/wallet" element={user ? <Wallet user={user} onUpdateUser={handleUpdateUser} /> : <Navigate to="/login" />} />
          
          {/* Admin Route */}
          <Route path="/admin" element={<Admin user={user} />} />

          {/* ========================================================= */}
          {/* 5. AUTH & STATIC PAGES */}
          {/* ========================================================= */}
          <Route path="/login" element={<Auth onLogin={handleLogin} />} />
          <Route path="/register" element={<Register onLogin={handleLogin} />} />
          <Route path="/page/:slug" element={<StaticPage />} />

          {/* Route 404 - Trang không tồn tại */}
          <Route path="*" element={<div className="h-[50vh] flex items-center justify-center font-bold text-gray-400">404 - Trang không tồn tại</div>} />

        </Routes>
      </Layout>
    </Router>
  );
};

export default App;
