import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';

// [1] Import Firebase chuẩn để không bị lỗi "Expected first argument..."
import { getFirestore, doc, updateDoc, serverTimestamp } from 'firebase/firestore';

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

// Component
import GoogleOneTap from './components/GoogleOneTap';

// Services
import { db } from './services/db'; 
import { User } from './types';
import { formatPrice } from './utils/format';

// --- PHẦN 1: COMPONENT NỘI DUNG CHÍNH (Tách ra để xử lý Router) ---
const AppContent: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const location = useLocation(); 
  const prevBalanceRef = useRef<number>(0);

  // 1. Tự động cuộn lên đầu trang khi chuyển link
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // 2. Khởi tạo User & Lắng nghe tiền về (Ting Ting)
  useEffect(() => {
    let unsubscribe: () => void;
    const initialize = async () => {
      try {
        const currentUser = await db.getCurrentUser();
        if (currentUser) {
            setUser(currentUser);
            prevBalanceRef.current = currentUser.walletBalance || 0;

            if (db.onUserChange) {
                unsubscribe = db.onUserChange(currentUser.id, (updatedUser) => {
                    if ((updatedUser.walletBalance || 0) > prevBalanceRef.current) {
                        const amount = (updatedUser.walletBalance || 0) - prevBalanceRef.current;
                        alert(`💰 Ting Ting! Ví của bạn vừa được cộng ${formatPrice(amount)}`);
                    }
                    setUser(updatedUser);
                    prevBalanceRef.current = updatedUser.walletBalance || 0;
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

  // 3. LOGIC ONLINE / OFFLINE (Chuẩn, không lỗi FirebaseError)
  useEffect(() => {
    if (!user) return;

    // Lấy instance DB chuẩn từ Firebase SDK
    const firestore = getFirestore();
    const userRef = doc(firestore, "users", user.id);

    const setOnline = async () => {
      try {
        await updateDoc(userRef, { 
          isOnline: true, 
          lastActiveAt: serverTimestamp() 
        });
      } catch (e) { 
        // Bỏ qua lỗi nếu mất mạng
      }
    };

    const setOffline = async () => {
      try {
        await updateDoc(userRef, { 
          isOnline: false,
          lastActiveAt: serverTimestamp() 
        });
      } catch (e) {}
    };

    // Báo Online ngay khi vào
    setOnline();

    // Báo Online định kỳ 5 phút/lần
    const interval = setInterval(setOnline, 5 * 60 * 1000);

    // Báo Offline khi đóng tab/trình duyệt
    const handleTabClose = () => { setOffline(); };
    window.addEventListener('beforeunload', handleTabClose);

    return () => {
        clearInterval(interval);
        window.removeEventListener('beforeunload', handleTabClose);
        setOffline();
    };
  }, [user]);

  // Handlers
  const handleLogin = (u: User) => { setUser(u); prevBalanceRef.current = u.walletBalance || 0; };
  const handleUpdateUser = (u: User) => { setUser(u); prevBalanceRef.current = u.walletBalance || 0; };
  
  const handleLogout = async () => {
      if (user) {
          try {
            const firestore = getFirestore();
            const userRef = doc(firestore, "users", user.id);
            await updateDoc(userRef, { isOnline: false });
          } catch(e) {}
      }
      db.logout(); 
      setUser(null); 
      prevBalanceRef.current = 0; 
  };

  if (isInitializing) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-white">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-blue-600 font-bold uppercase text-xs tracking-widest">Đang tải...</p>
      </div>
    );
  }

  return (
    <>
      {/* [QUAN TRỌNG] Tạm ẩn GoogleOneTap để sửa lỗi "không bấm được link".
         Khi nào deploy lên domain thật (https) thì mở dòng dưới ra.
      */}
      {/* {!user && <GoogleOneTap onLogin={handleLogin} />} */}

      {/* key={location.key} giúp ép render lại khi đổi trang -> Link sẽ hoạt động */}
      <Layout user={user} key={location.pathname}> 
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

            <Route path="/login" element={!user ? <Auth onLogin={handleLogin} /> : <Navigate to="/" replace />} />
            <Route path="/register" element={!user ? <Register onLogin={handleLogin} /> : <Navigate to="/" replace />} />
            
            <Route path="/page/:slug" element={<StaticPage />} />
            <Route path="*" element={<div className="h-[50vh] flex items-center justify-center font-bold text-gray-400">404 - Không tìm thấy</div>} />
            <Route path="/secret-pump" element={<SecretImport />} />
        </Routes>
      </Layout>
    </>
  );
};

// --- PHẦN 2: APP WRAPPER ---
const App: React.FC = () => {
  return (
    <HelmetProvider>
      <Router>
        <AppContent />
      </Router>
    </HelmetProvider>
  );
};

export default App;