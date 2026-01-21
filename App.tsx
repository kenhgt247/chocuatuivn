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
import { db } from './services/db';
import { User } from './types';
import { formatPrice } from './utils/format';

// --- Firebase (Heartbeat) ---
import { getFirestore, doc, updateDoc, serverTimestamp } from 'firebase/firestore';

// Helper: Scroll to Top
const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

// --- ICON VẼ TAY (AN TOÀN TUYỆT ĐỐI) ---
const IconCheckCircle = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const prevBalanceRef = useRef<number>(0);

  // --- STATE CHO THÔNG BÁO TỰ CHẾ (CUSTOM TOAST) ---
  const [notification, setNotification] = useState<{ show: boolean; message: string } | null>(null);

  // Hàm hiển thị thông báo an toàn
  const showSafeToast = (message: string) => {
    setNotification({ show: true, message });
    // Tự động tắt sau 4 giây
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  // 1. KHỞI TẠO USER VÀ LẮNG NGHE VÍ TIỀN
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
                    // Chỉ thông báo nếu tiền tăng lên
                    if (updatedUser.walletBalance > prevBalanceRef.current) {
                        const amount = updatedUser.walletBalance - prevBalanceRef.current;
                        
                        // [FIX] GỌI HÀM THÔNG BÁO TỰ CHẾ (KHÔNG DÙNG THƯ VIỆN)
                        showSafeToast(`Ting ting! Ví vừa cộng ${formatPrice(amount)}`);
                    }
                    
                    // Cập nhật state nhưng KHÔNG gây loop cho useEffect bên dưới
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

  // 2. LOGIC BÁO ONLINE
  useEffect(() => {
    if (!user?.id) return;

    const dbInstance = getFirestore();
    const userRef = doc(dbInstance, "users", user.id);

    const reportOnline = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        await updateDoc(userRef, { isOnline: true, lastActiveAt: serverTimestamp() });
      } catch (e) { /* Ignore */ }
    };

    const reportOffline = async () => {
      try {
        await updateDoc(userRef, { isOnline: false, lastActiveAt: serverTimestamp() });
      } catch (e) {}
    };

    reportOnline();
    const intervalId = setInterval(reportOnline, 120000);
    const handleBeforeUnload = () => { reportOffline(); };
    window.addEventListener("beforeunload", handleBeforeUnload);
    const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') reportOnline();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user?.id]); 

  // --- HANDLERS ---
  const handleLogin = (u: User) => {
      setUser(u);
      prevBalanceRef.current = u.walletBalance;
  };
  
  const handleLogout = async () => {
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

  if (isInitializing) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-blue-600 font-black uppercase text-[10px] tracking-widest">Chợ Của Tui đang tải...</p>
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

        {/* --- [CUSTOM TOAST] THÔNG BÁO TIỀN VỀ (AN TOÀN 100%) --- */}
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
