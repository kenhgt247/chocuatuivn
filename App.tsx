import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { ToastContainer, toast } from 'react-toastify'; // [THÊM]
import 'react-toastify/dist/ReactToastify.css';

// Layout & Pages (GIỮ NGUYÊN 100% NHƯ CŨ)
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

// Component
import GoogleOneTap from './components/GoogleOneTap';

// Services
import { db } from './services/db';
import { User } from './types';
import { formatPrice } from './utils/format';

// [THÊM] Firebase Online/Offline
import { getFirestore, doc, updateDoc, serverTimestamp } from 'firebase/firestore';

// Helper: Scroll to Top
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
  const prevBalanceRef = useRef<number>(0);

  // 1. INITIALIZE & WALLET LISTENER
  useEffect(() => {
    let unsubscribe: () => void;

    const initialize = async () => {
      try {
        const currentUser = await db.getCurrentUser();
        
        if (currentUser) {
            setUser(currentUser);
            prevBalanceRef.current = currentUser.walletBalance;

            if (db.onUserChange) {
                unsubscribe = db.onUserChange(currentUser.id, (updatedUser) => {
                    // Ting Ting Logic
                    if (updatedUser.walletBalance > prevBalanceRef.current) {
                        const amount = updatedUser.walletBalance - prevBalanceRef.current;
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
    return () => { if (unsubscribe) unsubscribe(); };
  }, []);

  // 2. [THÊM] HEARTBEAT ONLINE/OFFLINE
  useEffect(() => {
    if (!user) return;

    const dbInstance = getFirestore();
    const userRef = doc(dbInstance, "users", user.id);

    const reportOnline = async () => {
      try {
        await updateDoc(userRef, { isOnline: true, lastActiveAt: serverTimestamp() });
      } catch (e) {}
    };

    const reportOffline = async () => {
      try {
        await updateDoc(userRef, { isOnline: false, lastActiveAt: serverTimestamp() });
      } catch (e) {}
    };

    reportOnline();
    const interval = setInterval(reportOnline, 60000); // 1 phút

    const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') reportOnline();
    };
    const handleBeforeUnload = () => reportOffline();

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
        clearInterval(interval);
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        window.removeEventListener("beforeunload", handleBeforeUnload);
        reportOffline();
    };
  }, [user]); // Chỉ chạy lại khi login/logout

  // HANDLERS
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

  if (isInitializing) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-50">
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
            {/* GIỮ NGUYÊN ROUTE CŨ: Dùng PostListing cho Edit */}
            <Route path="/edit/:id" element={user ? <PostListing user={user} /> : <Navigate to="/login" />} />
            
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
