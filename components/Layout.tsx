import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { User, ChatRoom } from '../types'; 
import { identifyProductForSearch } from '../services/geminiService';
import { db, app } from '../services/db'; 
import UniversalInstallPrompt from './UniversalInstallPrompt';
import { compressAndGetBase64 } from '../utils/imageCompression';
import NotificationMenu from '../components/NotificationMenu';

// ⚠️ TUYỆT ĐỐI KHÔNG IMPORT firebase/messaging Ở ĐÂY
// ⚠️ ĐÃ LOẠI BỎ LUCIDE-REACT ĐỂ TRÁNH LỖI CRASH KHI NHẬN TIỀN

/* ====================================================================================
   BỘ ICON VẼ TAY (AN TOÀN TUYỆT ĐỐI 100%)
   Dùng bộ này thì Admin duyệt tiền thoải mái cũng không bao giờ lỗi #130 nữa.
   ==================================================================================== */
const IconZap = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>;
const IconBell = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>;
const IconWallet = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>;
const IconMessage = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>;
const IconUser = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const IconHome = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
const IconPlus = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const IconSearch = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>;
const IconManage = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>;

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
}

const Layout: React.FC<LayoutProps> = ({ children, user }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams(); 
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [isSearchingImage, setIsSearchingImage] = useState(false);
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  
  const [notifPermission, setNotifPermission] = useState(() => {
    try {
      return ("Notification" in window) ? Notification.permission : 'default';
    } catch (e) { return 'default'; }
  });

  const [hasInteractedWithNotif, setHasInteractedWithNotif] = useState(false);

  const minPriceParam = searchParams.get('minPrice');
  const maxPriceParam = searchParams.get('maxPrice');
  const locationParam = searchParams.get('location');

  useEffect(() => {
    setSearchQuery(searchParams.get('search') || '');
  }, [searchParams]);

  useEffect(() => {
    if (user?.id) {
      // @ts-ignore
      const unsubChats = db.getChatRooms(user.id, (rooms: ChatRoom[]) => {
        if (rooms) setChatRooms(rooms);
      });
      return () => {
        // @ts-ignore
        if (typeof unsubChats === 'function') unsubChats();
      };
    } else {
      setChatRooms([]);
    }
  }, [user?.id]);

  const unreadChatCount = user ? chatRooms.filter(r => 
    r.messages.length > 0 && 
    !r.seenBy?.includes(user.id) 
  ).length : 0;

  const handleEnableNotifications = async () => {
    setHasInteractedWithNotif(true);

    if (!("Notification" in window)) {
      alert("Thiết bị này không hỗ trợ thông báo web.");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotifPermission(permission);

      if (permission === 'granted') {
        if ('setAppBadge' in navigator) {
            // @ts-ignore
            navigator.setAppBadge(unreadChatCount).catch(() => {});
        }

        try {
            console.log("Đang kích hoạt thông báo...");
            const { getMessaging, getToken } = await import("firebase/messaging");
            
            const messaging = getMessaging(app);
            const registration = await navigator.serviceWorker.ready;

            const currentToken = await getToken(messaging, { 
              vapidKey: 'BC-HSAKsOy5hvpSPgtlC52kwy8OWL2oX1jn4pIkzyRkcqgPzlzTkHe2Xa9rBPJYtGjygvoTcfaWmCxYCeFZrlMI', 
              serviceWorkerRegistration: registration 
            });

            if (currentToken && user?.id) {
                // @ts-ignore
                if (db.updateUserProfile) {
                    // @ts-ignore
                    await db.updateUserProfile(user.id, { fcmToken: currentToken });
                    console.log("Đã đăng ký nhận tin thành công!");
                }
            }
            alert("✅ Đã bật thông báo! Bạn sẽ nhận được tin nhắn ngay cả khi tắt ứng dụng.");
        } catch (err) {
            console.error('Lỗi kích hoạt thông báo:', err);
        }
      }
    } catch (error) {
      console.error("Lỗi xin quyền:", error);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && 'setAppBadge' in navigator && notifPermission === 'granted') {
      if (unreadChatCount > 0) {
          // @ts-ignore
          navigator.setAppBadge(unreadChatCount).catch(() => {});
      } else {
          // @ts-ignore
          navigator.clearAppBadge().catch(() => {});
      }
    }
  }, [unreadChatCount, notifPermission]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    navigate(q ? `/?search=${encodeURIComponent(q)}` : `/`);
  };

  const handleImageSearchClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsSearchingImage(true);
    try {
        const base64 = await compressAndGetBase64(file);
        const keywords = await identifyProductForSearch(base64);
        navigate(`/?search=${encodeURIComponent(keywords.trim().toLowerCase())}&visual=true`);
    } catch (err) { alert("Lỗi ảnh."); }
    finally { setIsSearchingImage(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  return (
    <div className="min-h-screen flex flex-col bg-bgMain">
      
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 px-3 md:px-6 lg:px-10 h-auto min-h-[5rem] flex items-center justify-between gap-2 md:gap-4 shadow-sm pt-[env(safe-area-inset-top)] transition-all">
        
       {/* LOGO */}
        <div className="flex items-center flex-shrink-0 h-14 md:h-20">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 md:w-11 md:h-11 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-xl md:rounded-2xl flex items-center justify-center text-white text-xl md:text-2xl shadow-lg shadow-blue-500/40 group-hover:rotate-12 transition-all duration-500 border border-white/20">
                {/* Dùng IconZap vẽ tay */}
                <div className="w-6 h-6"><IconZap /></div>
            </div>
            <span className="hidden lg:block font-black text-xl md:text-2xl tracking-tighter bg-gradient-to-r from-blue-700 via-blue-500 to-yellow-500 bg-clip-text text-transparent group-hover:scale-[1.02] transition-transform origin-left drop-shadow-sm">
              Chợ của tui
            </span>
          </Link>
        </div>

        {/* SEARCH BAR */}
        <form onSubmit={handleSearch} className="flex-1 max-w-2xl relative group px-1 md:px-0">
          <div className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-gray-400">
              <div className="w-4 h-4 md:w-5 md:h-5"><IconSearch /></div>
          </div>
          <input type="text" placeholder={window.innerWidth < 768 ? "Tìm kiếm..." : "Tìm gì cũng có..."} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-gray-100 border-2 border-transparent hover:border-gray-200 rounded-xl md:rounded-[1.25rem] py-2.5 md:py-3 pl-9 md:pl-12 pr-10 md:pr-14 focus:outline-none focus:ring-0 focus:border-primary focus:bg-white transition-all text-xs md:text-sm font-bold text-slate-700 placeholder:text-gray-400 shadow-sm" />
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isSearchingImage} className={`absolute right-1.5 md:right-3 top-1/2 -translate-y-1/2 p-1.5 md:p-2 rounded-lg md:rounded-xl hover:bg-white text-gray-400 transition-all ${isSearchingImage ? 'animate-pulse text-primary' : 'hover:text-primary hover:shadow-sm'}`}>
            <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </button>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
        </form>

        {/* ACTIONS */}
        <div className="flex items-center gap-1 md:gap-4 flex-shrink-0">
          
          {/* NÚT BẬT THÔNG BÁO MOBILE (Dùng IconBell) */}
          {user && notifPermission === 'default' && !hasInteractedWithNotif && (
            <button 
              onClick={handleEnableNotifications}
              className="flex items-center gap-1 bg-red-500 text-white px-2.5 py-1.5 rounded-lg text-[10px] font-black border border-red-400 animate-bounce md:hidden shadow-lg active:scale-95"
            >
              <div className="w-3 h-3"><IconBell /></div> Bật báo tin
            </button>
          )}

          <Link to="/chat" className={`hidden md:flex relative p-2.5 rounded-2xl transition-all ${location.pathname.startsWith('/chat') ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-gray-100 hover:text-primary'}`}>
            <div className="w-6 h-6 md:w-7 md:h-7"><IconMessage /></div>
            {unreadChatCount > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-white shadow-sm animate-bounce">{unreadChatCount}</span>}
          </Link>

          {user ? <NotificationMenu userId={user.id} /> : <Link to="/login" className="relative p-2 rounded-2xl text-slate-600 hover:bg-gray-100 hover:text-primary transition-all"><div className="w-6 h-6"><IconUser /></div></Link>}

          <div className="hidden md:flex items-center gap-4">
            <Link to="/post" className="flex items-center gap-2 bg-primary text-white px-6 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 hover:bg-primaryHover hover:-translate-y-1 transition-all active:scale-95">
                <div className="w-4 h-4"><IconPlus /></div>
                <span>Đăng tin</span>
            </Link>
            {user ? <Link to="/profile" className="flex items-center pl-2"><div className="w-11 h-11 rounded-2xl overflow-hidden border-2 border-white shadow-lg ring-1 ring-gray-200 hover:ring-primary hover:scale-110 transition-all"><img src={user.avatar} alt={user.name} className="w-full h-full object-cover" /></div></Link> : <Link to="/login" className="text-xs font-black text-primary hover:bg-primary/5 px-6 py-3.5 rounded-2xl border-2 border-primary transition-all uppercase tracking-widest">Đăng nhập</Link>}
          </div>
        </div>
      </header>

      {/* FILTER BAR */}
      {(searchQuery || searchParams.get('visual')) && (
        <div className="sticky top-[5rem] z-40 bg-white/80 backdrop-blur-md border-b border-gray-100 py-3 animate-fade-in shadow-sm transition-all">
          <div className="max-w-[1400px] mx-auto px-2 md:px-4 flex items-center gap-3">
            <div className="flex items-center gap-2 flex-shrink-0 pr-3 border-r border-gray-100 hidden md:flex"><div className="w-1.5 h-4 bg-primary rounded-full"></div><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Bộ lọc giá</span></div>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              <button onClick={() => navigate(`/?search=${encodeURIComponent(searchQuery)}&maxPrice=2000000`)} className="flex-shrink-0 px-4 py-2 bg-white border border-gray-100 rounded-full text-[10px] font-bold text-slate-600 hover:border-primary hover:text-primary transition-all shadow-sm active:scale-95">💰 Dưới 2 Triệu</button>
              <button onClick={() => navigate(`/?search=${encodeURIComponent(searchQuery)}&minPrice=2000000&maxPrice=10000000`)} className="flex-shrink-0 px-4 py-2 bg-white border border-gray-100 rounded-full text-[10px] font-bold text-slate-600 hover:border-primary hover:text-primary transition-all shadow-sm active:scale-95">💎 2 - 10 Triệu</button>
              <button onClick={() => navigate(`/?search=${encodeURIComponent(searchQuery)}&minPrice=10000000`)} className="flex-shrink-0 px-4 py-2 bg-white border border-gray-100 rounded-full text-[10px] font-bold text-slate-600 hover:border-primary hover:text-primary transition-all shadow-sm active:scale-95">🔥 Trên 10 Triệu</button>
              <button onClick={() => navigate(`/?search=${encodeURIComponent(searchQuery)}&location=${encodeURIComponent(user?.location || 'TPHCM')}`)} className="flex-shrink-0 px-4 py-2 bg-primary/5 border border-primary/20 rounded-full text-[10px] font-black text-primary uppercase tracking-tight ml-2 hover:bg-primary/10 transition-all shadow-sm">📍 Gần tôi</button>
              {(minPriceParam || maxPriceParam || locationParam) && <button onClick={() => navigate(`/?search=${encodeURIComponent(searchQuery)}`)} className="flex-shrink-0 ml-2 px-3 py-2 text-[10px] font-black text-red-500 hover:bg-red-50 rounded-full transition-all uppercase tracking-tighter animate-fade-in">✕ Lọc</button>}
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTENT */}
      <main className="flex-1 w-full max-w-screen-2xl mx-auto md:px-8 py-6 md:py-10 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-10">
        {children}
      </main>

      {/* MOBILE NAV BAR (Dùng Icon vẽ tay) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-gray-100 flex items-end justify-between h-[calc(4rem+env(safe-area-inset-bottom))] z-50 px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_40px_rgba(0,0,0,0.03)]">
        <Link to="/" className={`flex-1 flex flex-col items-center justify-center gap-1 pb-2 group transition-all duration-300 ${location.pathname === '/' ? 'text-blue-600 -translate-y-1' : 'text-gray-400 hover:text-gray-600'}`}>
          <div className={`p-1.5 rounded-xl transition-all duration-300 ${location.pathname === '/' ? 'bg-blue-50' : ''}`}>
             <div className="w-6 h-6"><IconHome /></div>
          </div>
          <span className={`text-[10px] font-bold ${location.pathname === '/' ? 'opacity-100' : 'opacity-70'}`}>Trang chủ</span>
        </Link>
        <Link to="/manage-ads" className={`flex-1 flex flex-col items-center justify-center gap-1 pb-2 group transition-all duration-300 ${location.pathname === '/manage-ads' ? 'text-blue-600 -translate-y-1' : 'text-gray-400 hover:text-gray-600'}`}>
          <div className={`p-1.5 rounded-xl transition-all duration-300 ${location.pathname === '/manage-ads' ? 'bg-blue-50' : ''}`}>
              <div className="w-6 h-6"><IconManage /></div>
          </div>
          <span className={`text-[10px] font-bold ${location.pathname === '/manage-ads' ? 'opacity-100' : 'opacity-70'}`}>Quản lý</span>
        </Link>
        <div className="flex-1 flex flex-col items-center justify-end pb-3 relative z-10">
           <Link to="/post" className="w-14 h-14 mb-1 bg-gradient-to-tr from-blue-600 to-cyan-400 text-white rounded-full flex items-center justify-center shadow-[0_4px_20px_rgba(59,130,246,0.5)] border-[4px] border-white transform transition-all duration-300 active:scale-90 hover:scale-105 hover:-translate-y-2">
               <div className="w-7 h-7"><IconPlus /></div>
           </Link>
          <span className="text-[10px] font-black text-blue-600 tracking-tight">Đăng tin</span>
        </div>
        <Link to="/chat" className={`flex-1 flex flex-col items-center justify-center gap-1 pb-2 group transition-all duration-300 relative ${location.pathname.startsWith('/chat') ? 'text-blue-600 -translate-y-1' : 'text-gray-400 hover:text-gray-600'}`}>
          <div className={`p-1.5 rounded-xl transition-all duration-300 relative ${location.pathname.startsWith('/chat') ? 'bg-blue-50' : ''}`}>
             <div className="w-6 h-6"><IconMessage /></div>
             {unreadChatCount > 0 && <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-0.5 bg-red-500 text-white text-[9px] font-bold flex items-center justify-center rounded-full border-2 border-white shadow-sm animate-pulse">{unreadChatCount > 9 ? '9+' : unreadChatCount}</span>}
          </div>
          <span className={`text-[10px] font-bold ${location.pathname.startsWith('/chat') ? 'opacity-100' : 'opacity-70'}`}>Tin nhắn</span>
        </Link>
        <Link to="/profile" className={`flex-1 flex flex-col items-center justify-center gap-1 pb-2 group transition-all duration-300 ${location.pathname === '/profile' ? 'text-blue-600 -translate-y-1' : 'text-gray-400 hover:text-gray-600'}`}>
          <div className={`p-0.5 rounded-full transition-all duration-300 border-2 ${location.pathname === '/profile' ? 'border-blue-500' : 'border-transparent'}`}>{user ? <img src={user.avatar} className="w-6 h-6 rounded-full object-cover" alt="User" /> : <div className="w-6 h-6 m-0.5"><IconUser /></div>}</div>
          <span className={`text-[10px] font-bold ${location.pathname === '/profile' ? 'opacity-100' : 'opacity-70'}`}>Cá nhân</span>
        </Link>
      </nav>

      <UniversalInstallPrompt />
    </div>
  );
};

export default Layout;
