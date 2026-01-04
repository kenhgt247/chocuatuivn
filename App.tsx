import React, { useState, useEffect } from 'react';
// QUAN TRỌNG: Sử dụng BrowserRouter để link đẹp (không có dấu #)
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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
import { db } from './services/db';
import { User } from './types';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

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

  const handleLogin = (u: User) => setUser(u);
  const handleLogout = () => {
    db.logout();
    setUser(null);
  };

  const handleUpdateUser = (u: User) => setUser(u);

  if (isInitializing) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-bgMain">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-primary font-black uppercase text-[10px] tracking-widest">Đang tải hồ sơ...</p>
      </div>
    );
  }

  return (
    <Router>
      <Layout user={user}>
        <Routes>
          {/* Trang chủ */}
          <Route path="/" element={<Home user={user} />} />
          
          {/* Chi tiết sản phẩm (SEO friendly) */}
          <Route path="/san-pham/:slugWithId" element={<ListingDetail user={user} />} />
          
          {/* Danh mục sản phẩm (SEO friendly) - Đã sửa từ /categories sang /danh-muc/:slug */}
          <Route path="/danh-muc/:slug" element={<Home user={user} />} />
          
          <Route path="/seller/:id" element={<SellerProfile currentUser={user} />} />
          <Route path="/post" element={user ? <PostListing user={user} /> : <Navigate to="/login" />} />
          <Route path="/manage-ads" element={user ? <ManageAds user={user} onUpdateUser={handleUpdateUser} /> : <Navigate to="/login" />} />
          <Route path="/chat" element={user ? <Chat user={user} /> : <Navigate to="/login" />} />
          <Route path="/chat/:roomId" element={user ? <Chat user={user} /> : <Navigate to="/login" />} />
          <Route path="/profile" element={<Profile user={user} onLogout={handleLogout} onUpdateUser={handleUpdateUser} />} />
          <Route path="/upgrade" element={<Subscription user={user} onUpdateUser={handleUpdateUser} />} />
          <Route path="/wallet" element={user ? <Wallet user={user} onUpdateUser={handleUpdateUser} /> : <Navigate to="/login" />} />
          <Route path="/admin" element={<Admin user={user} />} />
          <Route path="/login" element={<Auth onLogin={handleLogin} />} />
          <Route path="/register" element={<Register onLogin={handleLogin} />} />
          <Route path="/page/:slug" element={<StaticPage />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default App;
