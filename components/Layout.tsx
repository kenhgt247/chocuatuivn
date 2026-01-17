import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { User, ChatRoom } from '../types'; 
import { identifyProductForSearch } from '../services/geminiService';
import { db } from '../services/db';
import UniversalInstallPrompt from './UniversalInstallPrompt';
import { compressAndGetBase64 } from '../utils/imageCompression';
import NotificationMenu from '../components/NotificationMenu';

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
  // [QUAN TRỌNG] State kiểm tra quyền thông báo
  const [notifPermission, setNotifPermission] = useState(Notification.permission);

  const minPriceParam = searchParams.get('minPrice');
  const maxPriceParam = searchParams.get('maxPrice');
  const locationParam = searchParams.get('location');

  // --- EFFECT 1: Sync Search Params ---
  useEffect(() => {
    const currentSearch = searchParams.get('search') || '';
    setSearchQuery(currentSearch);
  }, [searchParams]);

  // --- EFFECT 2: Real-time Chat Data ---
  useEffect(() => {
    if (user?.id) {
      const unsubChats = db.getChatRooms(user.id, (rooms) => {
        setChatRooms(rooms);
      });
      return () => {
        unsubChats();
      };
    } else {
      setChatRooms([]);
    }
  }, [user?.id]);

  // --- TÍNH TOÁN SỐ TIN NHẮN CHƯA ĐỌC ---
  const unreadChatCount = user ? chatRooms.filter(r => r.messages.length > 0 && !r.seenBy?.includes(user?.id || '')).length : 0;

  // --- [FIX] HÀM XIN QUYỀN THÔNG BÁO (BẮT BUỘC CHO IPHONE) ---
  const requestPermission = async () => {
    if (!("Notification" in window)) {
      alert("Trình duyệt này không hỗ trợ thông báo.");
      return;
    }
    
    // Yêu cầu quyền
    const permission = await Notification.requestPermission();
    setNotifPermission(permission); // Cập nhật state

    if (permission === "granted") {
      // Nếu đồng ý -> Set luôn badge hiện tại
      if ('setAppBadge' in navigator) {
        navigator.setAppBadge(unreadChatCount);
      }
      alert("✅ Đã bật thông báo! Bây giờ icon sẽ hiện số đỏ khi có tin nhắn.");
    }
  };

  // --- APP BADGING API (HIỆN SỐ ĐỎ) ---
  useEffect(() => {
    const updateAppBadge = async () => {
      // Chỉ chạy nếu quyền đã được cấp (granted)
      if (notifPermission === 'granted' && 'setAppBadge' in navigator) {
        try {
          if (unreadChatCount > 0) {
            await navigator.setAppBadge(unreadChatCount);
          } else {
            await navigator.clearAppBadge();
          }
        } catch (error) {
          console.error("Lỗi set Badge:", error);
        }
      }
    };

    updateAppBadge();
  }, [unreadChatCount, notifPermission]);

  // --- HANDLERS ---
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanQuery = searchQuery.trim();
    if (cleanQuery) {
      navigate(`/?search=${encodeURIComponent(cleanQuery)}`);
    } else {
      navigate(`/`);
    }
  };

  const handleImageSearchClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsSearchingImage(true);
    try {
        const compressedBase64 = await compressAndGetBase64(file);
        const keywords = await identifyProductForSearch(compressedBase64);
        const cleanKeywords = keywords.trim().toLowerCase();
        setSearchQuery(cleanKeywords);
        navigate(`/?search=${encodeURIComponent(cleanKeywords)}&visual=true`);
    } catch (err) {
        console.error("Lỗi tìm kiếm hình ảnh:", err);
        alert("Không thể nhận diện hình ảnh. Vui lòng thử lại với ảnh rõ nét hơn.");
    } finally {
        setIsSearchingImage(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-bgMain">
      
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 px-3 md:px-6 lg:px-10 h-auto min-h-[5rem] flex items-center justify-between gap-2 md:gap-4 shadow-sm pt-[env(safe-area-inset-top)] transition-all">
        
        {/* LOGO */}
        <div className="flex items-center flex-shrink-0 h-14 md:h-20">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 md:w-11 md:h-11 bg-gradient-to-tr from-primary to-blue-400 rounded-xl md:rounded-2xl flex items-center justify-center text-white text-lg md:text-2xl shadow-lg shadow-primary/25 group-hover:rotate-6 transition-all duration-300">⚡</div>
            <span className="font-black text-lg md:text-xl text-slate-800 hidden lg:block tracking-tighter group-hover:text-primary transition-colors">Chợ của tui</span>
          </Link>
        </div>

        {/* SEARCH BAR */}
        <form onSubmit={handleSearch} className="flex-1 max-w-2xl relative group px-1 md:px-0">
          <div className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors">
            <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input 
            type="text" 
            placeholder={window.innerWidth < 768 ? "Tìm kiếm..." : "Tìm gì cũng có..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-100 border-2 border-transparent hover:border-gray-200 rounded-xl md:rounded-[1.25rem] py-2.5 md:py-3 pl-9 md:pl-12 pr-10 md:pr-14 focus:outline-none focus:ring-0 focus:border-primary focus:bg-white transition-all text-xs md:text-sm font-bold text-slate-700 placeholder:text-gray-400 shadow-sm"
          />
          <button 
            type="button"
            onClick={handleImageSearchClick}
            disabled={isSearchingImage}
            className={`absolute right-1.5 md:right-3 top-1/2 -translate-y-1/2 p-1.5 md:p-2 rounded-lg md:rounded-xl hover:bg-white text-gray-400 transition-all ${isSearchingImage ? 'animate-pulse text-primary' : 'hover:text-primary hover:shadow-sm'}`}
            title="Tìm bằng AI"
          >
            <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
        </form>

        {/* ACTIONS */}
        <div className="flex items-center gap-1 md:gap-4 flex-shrink-0">
          
          {/* [NÚT QUAN TRỌNG] BẬT THÔNG BÁO (Chỉ hiện khi chưa cấp quyền) */}
          {user && notifPermission === 'default' && (
            <button 
              onClick={requestPermission}
              className="flex items-center gap-1 bg-red-50 text-red-500 px-2 py-1.5 rounded-lg text-[10px] font-bold border border-red-100 animate-bounce md:hidden"
            >
              🔔 Bật báo tin
            </button>
          )}

          {/* Desktop Chat Icon */}
          <Link to="/chat" className={`hidden md:flex relative p-2.5 rounded-2xl transition-all ${location.pathname.startsWith('/chat') ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-gray-100 hover:text-primary'}`}>
            <svg className="w-6 h-6 md:w-7 md:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {unreadChatCount > 0 && (
              <span className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-white shadow-sm animate-pulse">
                {unreadChatCount}
              </span>
            )}
          </Link>

          {user ? (
             <NotificationMenu userId={user.id} />
          ) : (
             <Link to="/login" className="relative p-2 rounded-2xl text-slate-600 hover:bg-gray-100 hover:text-primary transition-all">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
             </Link>
          )}

          <div className="hidden md:flex items-center gap-4">
            <Link to="/post" className="flex items-center gap-2 bg-primary text-white px-6 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 hover:bg-primaryHover hover:-translate-y-1 transition-all active:scale-95">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4"/></svg>
              <span>Đăng tin</span>
            </Link>
            {user ? (
              <Link to="/profile" className="flex items-center pl-2">
                <div className="w-11 h-11 rounded-2xl overflow-hidden border-2 border-white shadow-lg ring-1 ring-gray-200 hover:ring-primary hover:scale-110 transition-all">
                  <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                </div>
              </Link>
            ) : (
              <Link to="/login" className="text-xs font-black text-primary hover:bg-primary/5 px-6 py-3.5 rounded-2xl border-2 border-primary transition-all uppercase tracking-widest">
                Đăng nhập
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* FILTER BAR */}
      {(searchQuery || searchParams.get('visual')) && (
        <div className="sticky top-[5rem] z-40 bg-white/80 backdrop-blur-md border-b border-gray-100 py-3 animate-fade-in shadow-sm transition-all">
          <div className="max-w-[1400px] mx-auto px-2 md:px-4 flex items-center gap-3">
            <div className="flex items-center gap-2 flex-shrink-0 pr-3 border-r border-gray-100 hidden md:flex">
              <div className="w-1.5 h-4 bg-primary rounded-full"></div>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                Bộ lọc giá
              </span>
            </div>
            
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              <button onClick={() => navigate(`/?search=${encodeURIComponent(searchQuery)}&maxPrice=2000000`)} className="flex-shrink-0 px-4 py-2 bg-white border border-gray-100 rounded-full text-[10px] font-bold text-slate-600 hover:border-primary hover:text-primary transition-all shadow-sm active:scale-95">💰 Dưới 2 Triệu</button>
              <button onClick={() => navigate(`/?search=${encodeURIComponent(searchQuery)}&minPrice=2000000&maxPrice=10000000`)} className="flex-shrink-0 px-4 py-2 bg-white border border-gray-100 rounded-full text-[10px] font-bold text-slate-600 hover:border-primary hover:text-primary transition-all shadow-sm active:scale-95">💎 2 - 10 Triệu</button>
              <button onClick={() => navigate(`/?search=${encodeURIComponent(searchQuery)}&minPrice=10000000`)} className="flex-shrink-0 px-4 py-2 bg-white border border-gray-100 rounded-full text-[10px] font-bold text-slate-600 hover:border-primary hover:text-primary transition-all shadow-sm active:scale-95">🔥 Trên 10 Triệu</button>
              <button onClick={() => navigate(`/?search=${encodeURIComponent(searchQuery)}&location=${encodeURIComponent(user?.location || 'TPHCM')}`)} className="flex-shrink-0 px-4 py-2 bg-primary/5 border border-primary/20 rounded-full text-[10px] font-black text-primary uppercase tracking-tight ml-2 hover:bg-primary/10 transition-all shadow-sm">📍 Gần tôi</button>

              {(minPriceParam || maxPriceParam || locationParam) && (
                <button onClick={() => navigate(`/?search=${encodeURIComponent(searchQuery)}`)} className="flex-shrink-0 ml-2 px-3 py-2 text-[10px] font-black text-red-500 hover:bg-red-50 rounded-full transition-all uppercase tracking-tighter animate-fade-in">✕ Lọc</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTENT */}
      <main className="flex-1 w-full max-w-screen-2xl mx-auto md:px-8 py-6 md:py-10 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-10">
        {children}
      </main>

      {/* MOBILE NAV BAR (BOTTOM) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-gray-100 flex items-end justify-between h-[calc(4rem+env(safe-area-inset-bottom))] z-50 px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_40px_rgba(0,0,0,0.03)]">
        
        <Link to="/" className={`flex-1 flex flex-col items-center justify-center gap-1 pb-2 group transition-all duration-300 ${location.pathname === '/' ? 'text-blue-600 -translate-y-1' : 'text-gray-400 hover:text-gray-600'}`}>
          <div className={`p-1.5 rounded-xl transition-all duration-300 ${location.pathname === '/' ? 'bg-blue-50' : ''}`}>
            <svg className="w-6 h-6" fill={location.pathname === '/' ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
          </div>
          <span className={`text-[10px] font-bold ${location.pathname === '/' ? 'opacity-100' : 'opacity-70'}`}>Trang chủ</span>
        </Link>

        <Link to="/manage-ads" className={`flex-1 flex flex-col items-center justify-center gap-1 pb-2 group transition-all duration-300 ${location.pathname === '/manage-ads' ? 'text-blue-600 -translate-y-1' : 'text-gray-400 hover:text-gray-600'}`}>
          <div className={`p-1.5 rounded-xl transition-all duration-300 ${location.pathname === '/manage-ads' ? 'bg-blue-50' : ''}`}>
            <svg className="w-6 h-6" fill={location.pathname === '/manage-ads' ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
          </div>
          <span className={`text-[10px] font-bold ${location.pathname === '/manage-ads' ? 'opacity-100' : 'opacity-70'}`}>Quản lý</span>
        </Link>

        {/* Nút Đăng Tin Lớn */}
        <div className="flex-1 flex flex-col items-center justify-end pb-3 relative z-10">
           <Link to="/post" className="w-14 h-14 mb-1 bg-gradient-to-tr from-blue-600 to-cyan-400 text-white rounded-full flex items-center justify-center shadow-[0_4px_20px_rgba(59,130,246,0.5)] border-[4px] border-white transform transition-all duration-300 active:scale-90 hover:scale-105 hover:-translate-y-2">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
          </Link>
          <span className="text-[10px] font-black text-blue-600 tracking-tight">Đăng tin</span>
        </div>

        {/* Tab Tin Nhắn (Có số đỏ hiển thị trên icon) */}
        <Link to="/chat" className={`flex-1 flex flex-col items-center justify-center gap-1 pb-2 group transition-all duration-300 relative ${location.pathname.startsWith('/chat') ? 'text-blue-600 -translate-y-1' : 'text-gray-400 hover:text-gray-600'}`}>
          <div className={`p-1.5 rounded-xl transition-all duration-300 ${location.pathname.startsWith('/chat') ? 'bg-blue-50' : ''}`}>
             <svg className="w-6 h-6" fill={location.pathname.startsWith('/chat') ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
          </div>
          <span className={`text-[10px] font-bold ${location.pathname.startsWith('/chat') ? 'opacity-100' : 'opacity-70'}`}>Tin nhắn</span>
          
          {/* SỐ ĐỎ (BADGE) TRÊN TAB TIN NHẮN */}
          {unreadChatCount > 0 && (
            <span className="absolute top-2 right-4 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[9px] font-bold flex items-center justify-center rounded-full border-2 border-white shadow-sm animate-pulse">
              {unreadChatCount > 9 ? '9+' : unreadChatCount}
            </span>
          )}
        </Link>

        <Link to="/profile" className={`flex-1 flex flex-col items-center justify-center gap-1 pb-2 group transition-all duration-300 ${location.pathname === '/profile' ? 'text-blue-600 -translate-y-1' : 'text-gray-400 hover:text-gray-600'}`}>
          <div className={`p-0.5 rounded-full transition-all duration-300 border-2 ${location.pathname === '/profile' ? 'border-blue-500' : 'border-transparent'}`}>
             {user ? (
                 <img src={user.avatar} className="w-6 h-6 rounded-full object-cover" alt="User" />
             ) : (
                <svg className="w-6 h-6 m-0.5" fill={location.pathname === '/profile' ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
             )}
          </div>
          <span className={`text-[10px] font-bold ${location.pathname === '/profile' ? 'opacity-100' : 'opacity-70'}`}>Cá nhân</span>
        </Link>
      </nav>

      <UniversalInstallPrompt />
    </div>
  );
};

export default Layout;
