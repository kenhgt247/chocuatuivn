
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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

  useEffect(() => {
    db.init();
    const loadUser = async () => {
      const u = await db.getCurrentUser();
      setUser(u);
    };
    loadUser();
  }, []);

  const handleLogin = (u: User) => setUser(u);
  const handleLogout = () => {
    db.logout();
    setUser(null);
  };

  const handleUpdateUser = (u: User) => setUser(u);

  return (
    <BrowserRouter>
      <Layout user={user}>
        <Routes>
          <Route path="/" element={<Home user={user} />} />
          <Route path="/san-pham/:slugWithId" element={<ListingDetail user={user} />} />
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
          <Route path="/categories" element={<Home user={user} />} />
          <Route path="/page/:slug" element={<StaticPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
};

export default App;
