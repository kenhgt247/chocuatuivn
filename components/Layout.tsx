import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { User, Notification, ChatRoom } from '../types'; 
import { identifyProductForSearch } from '../services/geminiService';
import { formatTimeAgo } from '../utils/format';
import { db } from '../services/db';
import UniversalInstallPrompt from './UniversalInstallPrompt';
// [MỚI] Import hàm nén ảnh để tối ưu tốc độ tìm kiếm AI
import { compressAndGetBase64 } from '../utils/imageCompression';

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
}

const Layout: React.FC<LayoutProps> = ({ children, user }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams(); // Để đồng bộ URL với ô input
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  
  // Khởi tạo giá trị ban đầu từ URL để khi F5 không bị mất từ khóa
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [isSearchingImage, setIsSearchingImage] = useState(false);
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);

  // Effect này giúp xóa ô tìm kiếm khi người dùng bấm vào Logo (về trang chủ) hoặc nút Back
  useEffect(() => {
    const currentSearch = searchParams.get('search') || '';
    setSearchQuery(currentSearch);
  }, [searchParams]);

  // --- 1. DATA FETCHING (REAL-TIME) ---
  useEffect(() => {
    if (user?.id) {
      // Lắng nghe thông báo real-time
      const unsubNotifs = db.getNotifications(user.id, (notifs) => {
        setNotifications(notifs);
      });
      
      // Lắng nghe tin nhắn real-time
      const unsubChats = db.getChatRooms(user.id, (rooms) => {
        setChatRooms(rooms);
      });

      return () => {
        // Hủy lắng nghe khi unmount để tránh memory leak
        unsubNotifs();
        unsubChats();
      };
    } else {
      setNotifications([]);
      setChatRooms([]);
    }
  }, [user?.id]);

  // --- 2. CLICK OUTSIDE TO CLOSE NOTIFS ---
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifs(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadNotifCount = user ? notifications.filter(n => !n.read).length : 0;
  const unreadChatCount = user ? chatRooms.filter(r => r.messages.length > 0 && !r.seenBy?.includes(user?.id || '')).length : 0;

  // --- 3. SEARCH HANDLERS ---
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanQuery = searchQuery.trim();
    if (cleanQuery) {
      // Khi tìm kiếm mới, ta reset về trang chủ với tham số search
      navigate(`/?search=${encodeURIComponent(cleanQuery)}`);
    } else {
      navigate(`/`);
    }
  };

  const handleImageSearchClick = () => {
    fileInputRef.current?.click();
  };

  // [ĐÃ NÂNG CẤP] Xử lý tìm kiếm ảnh với tính năng NÉN ẢNH
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsSearchingImage(true);
    
    try {
        // 1. Nén ảnh trước khi gửi đi (Giúp AI xử lý nhanh hơn và tiết kiệm băng thông)
        const compressedBase64 = await compressAndGetBase64(file);
        
        // 2. Gửi chuỗi Base64 đã nén cho Gemini AI
        const keywords = await identifyProductForSearch(compressedBase64);
        
        setSearchQuery(keywords);
        navigate(`/?search=${encodeURIComponent(keywords.trim())}&visual=true`);
    } catch (err) {
        console.error("Lỗi tìm kiếm hình ảnh:", err);
        alert("Không thể nhận diện hình ảnh. Vui lòng thử lại với ảnh rõ nét hơn.");
    } finally {
        setIsSearchingImage(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // --- 4. NOTIFICATION HANDLERS ---
  const handleMarkAsRead = async (notif: Notification) => {
    // Đánh dấu đã đọc trên server
    if (!notif.read) {
      await db.markNotificationAsRead(notif.id);
    }
    // Đóng dropdown
    setShowNotifs(false);
    // Điều hướng nếu có link
    if (notif.link) {
      navigate(notif.link);
    }
  };

  const handleNotifClick = () => {
    if (!user) {
      navigate('/login');
    } else {
      setShowNotifs(!showNotifs);
    }
  };

  // Helper: Lấy màu sắc và icon dựa trên loại thông báo
  const getNotificationStyle = (type: string) => {
    switch (type) {
      case 'review':
        return {
          bg: 'bg-yellow-100', text: 'text-yellow-600',
          icon: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
        };
      case 'message':
        return {
          bg: 'bg-blue-100', text: 'text-blue-600',
          icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
        };
      case 'approval':
      case 'success':
        return {
          bg: 'bg-green-100', text: 'text-green-600',
          icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        };
      case 'follow':
        return {
          bg: 'bg-purple-100', text: 'text-purple-600',
          icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
        };
      case 'error':
      case 'warning':
        return {
          bg: 'bg-red-100', text: 'text-red-600',
          icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        };
      case 'system':
        return {
          bg: 'bg-indigo-100', text: 'text-indigo-600',
          icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
        };
      default: // info
        return {
          bg: 'bg-gray-100', text: 'text-gray-600',
          icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        };
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-bgMain">
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-xl border-b border-borderMain/50 px-3 md:px-6 lg:px-10 h-20 flex items-center justify-between gap-2 md:gap-4 shadow-sm">
        {/* LOGO */}
        <div className="flex items-center flex-shrink-0">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 md:w-11 md:h-11 bg-gradient-to-tr from-primary to-blue-400 rounded-xl md:rounded-2xl flex items-center justify-center text-white text-xl md:text-2xl shadow-lg shadow-primary/25 group-hover:rotate-6 transition-all duration-300">⚡</div>
            <span className="font-black text-xl text-primary hidden lg:block tracking-tighter">Chợ của tui</span>
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
            className="w-full bg-gray-100/60 border border-transparent rounded-xl md:rounded-[1.25rem] py-2.5 md:py-3 pl-9 md:pl-12 pr-10 md:pr-14 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/30 focus:bg-white transition-all text-xs md:text-sm font-medium"
          />
          {/* [ĐÃ THAY ĐỔI ICON] Icon Camera mới, đẹp hơn */}
          <button 
            type="button"
            onClick={handleImageSearchClick}
            disabled={isSearchingImage}
            className={`absolute right-2 md:right-3 top-1/2 -translate-y-1/2 p-1.5 md:p-2 rounded-lg md:rounded-xl hover:bg-gray-100 text-gray-400 transition-all ${isSearchingImage ? 'animate-pulse text-primary' : 'hover:text-primary'}`}
            title="Tìm bằng AI"
          >
            {/* Icon Camera Lens/Scan mới */}
            <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
        </form>

        {/* ACTIONS */}
        <div className="flex items-center gap-1 md:gap-4 flex-shrink-0">
          {/* Chat Icon */}
          <Link to="/chat" className={`hidden md:flex relative p-2.5 rounded-2xl transition-all ${location.pathname.startsWith('/chat') ? 'bg-primary/10 text-primary' : 'text-gray-400 hover:bg-gray-100'}`}>
            <svg className="w-6 h-6 md:w-7 md:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {unreadChatCount > 0 && (
              <span className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-white shadow-sm">
                {unreadChatCount}
              </span>
            )}
          </Link>

          {/* Notification Icon */}
          <div className="relative" ref={notifRef}>
            <button 
              onClick={handleNotifClick}
              className={`relative p-2.5 rounded-2xl transition-all ${showNotifs ? 'bg-primary/10 text-primary' : 'text-gray-400 hover:bg-gray-100'}`}
            >
              {/* Hiệu ứng rung nhẹ khi có thông báo mới */}
              <div className={unreadNotifCount > 0 ? "animate-pulse origin-top" : ""}>
                 <svg className="w-6 h-6 md:w-7 md:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                 </svg>
              </div>
              
              {unreadNotifCount > 0 && (
                <span className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-white shadow-sm animate-pulse">
                  {unreadNotifCount}
                </span>
              )}
            </button>
            
            {/* NOTIFICATION DROPDOWN */}
            {showNotifs && (
              <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white border border-borderMain rounded-[2rem] shadow-2xl overflow-hidden animate-fade-in-up z-50">
                <div className="p-5 border-b border-gray-50 flex items-center justify-between bg-bgMain/30">
                  <h3 className="font-black text-sm uppercase tracking-tight">Thông báo</h3>
                  <span className="text-[10px] font-black text-primary bg-primary/10 px-2.5 py-1 rounded-lg">{unreadNotifCount} mới</span>
                </div>
                <div className="max-h-96 overflow-y-auto no-scrollbar">
                  {notifications.length > 0 ? notifications.map(notif => {
                    const style = getNotificationStyle(notif.type);
                    return (
                      <button key={notif.id} onClick={() => handleMarkAsRead(notif)} className={`w-full text-left p-4 hover:bg-bgMain transition-colors flex gap-4 border-b border-gray-50 last:border-0 ${!notif.read ? 'bg-primary/5' : ''}`}>
                          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 text-xl ${style.bg} ${style.text}`}>
                            {style.icon}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={`text-xs font-black truncate ${!notif.read ? 'text-primary' : 'text-textMain'}`}>{notif.title}</p>
                            <p className="text-[10px] text-gray-500 line-clamp-2 font-medium mt-0.5">{notif.message}</p>
                            <p className="text-[8px] text-gray-300 font-bold uppercase mt-1.5">{formatTimeAgo(notif.createdAt)}</p>
                          </div>
                          {!notif.read && <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>}
                      </button>
                    )
                  }) : (
                    <div className="p-16 text-center opacity-30">
                      <div className="text-4xl mb-4">📭</div>
                      <p className="text-gray-400 text-[10px] font-black uppercase">Không có thông báo mới</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-4">
            <Link to="/post" className="flex items-center gap-2 bg-primary text-white px-6 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 hover:bg-primaryHover hover:-translate-y-1 transition-all active:scale-95">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4"/></svg>
              <span>Đăng tin</span>
            </Link>
            {user ? (
              <Link to="/profile" className="flex items-center pl-2">
                <div className="w-11 h-11 rounded-2xl overflow-hidden border-2 border-white shadow-xl ring-1 ring-borderMain/50 hover:scale-110 transition-transform">
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

      {/* MAIN CONTENT */}
      <main className="flex-1 w-full max-w-screen-2xl mx-auto md:px-8 py-6 md:py-10">
        {children}
      </main>

      {/* MOBILE NAV BAR */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-gray-100 flex items-end justify-between h-[5.5rem] z-50 px-2 pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.03)]">
        
        <Link to="/" className={`flex-1 flex flex-col items-center justify-center gap-1 pb-4 group transition-all duration-300 ${location.pathname === '/' ? 'text-blue-600 -translate-y-1' : 'text-gray-400 hover:text-gray-500'}`}>
          <div className={`p-1.5 rounded-xl transition-all duration-300 ${location.pathname === '/' ? 'bg-blue-50 shadow-[0_0_15px_rgba(37,99,235,0.2)]' : ''}`}>
            <svg className="w-6 h-6 transition-transform duration-300 group-active:scale-90" fill={location.pathname === '/' ? "currentColor" : "none"} stroke="currentColor" strokeWidth={location.pathname === '/' ? 0 : 2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
          <span className={`text-[10px] font-bold tracking-tight ${location.pathname === '/' ? 'opacity-100' : 'opacity-70'}`}>Trang chủ</span>
        </Link>

        <Link to="/manage-ads" className={`flex-1 flex flex-col items-center justify-center gap-1 pb-4 group transition-all duration-300 ${location.pathname === '/manage-ads' ? 'text-blue-600 -translate-y-1' : 'text-gray-400 hover:text-gray-500'}`}>
          <div className={`p-1.5 rounded-xl transition-all duration-300 ${location.pathname === '/manage-ads' ? 'bg-blue-50 shadow-[0_0_15px_rgba(37,99,235,0.2)]' : ''}`}>
            <svg className="w-6 h-6 transition-transform duration-300 group-active:scale-90" fill={location.pathname === '/manage-ads' ? "currentColor" : "none"} stroke="currentColor" strokeWidth={location.pathname === '/manage-ads' ? 0 : 2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <span className={`text-[10px] font-bold tracking-tight ${location.pathname === '/manage-ads' ? 'opacity-100' : 'opacity-70'}`}>Quản lý</span>
        </Link>

        <div className="flex-1 flex justify-center pb-6 relative z-10">
           <Link to="/post" className="w-16 h-16 mb-2 bg-gradient-to-tr from-blue-600 to-cyan-400 text-white rounded-full flex items-center justify-center shadow-[0_4px_20px_rgba(59,130,246,0.5)] border-[4px] border-white transform transition-all duration-300 active:scale-90 hover:scale-105 hover:-translate-y-2">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
            <span className="absolute w-full h-full rounded-full bg-blue-400 opacity-20 animate-ping -z-10"></span>
          </Link>
        </div>

        <Link to="/chat" className={`flex-1 flex flex-col items-center justify-center gap-1 pb-4 group transition-all duration-300 relative ${location.pathname.startsWith('/chat') ? 'text-blue-600 -translate-y-1' : 'text-gray-400 hover:text-gray-500'}`}>
          <div className={`p-1.5 rounded-xl transition-all duration-300 ${location.pathname.startsWith('/chat') ? 'bg-blue-50 shadow-[0_0_15px_rgba(37,99,235,0.2)]' : ''}`}>
             <svg className="w-6 h-6 transition-transform duration-300 group-active:scale-90" fill={location.pathname.startsWith('/chat') ? "currentColor" : "none"} stroke="currentColor" strokeWidth={location.pathname.startsWith('/chat') ? 0 : 2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <span className={`text-[10px] font-bold tracking-tight ${location.pathname.startsWith('/chat') ? 'opacity-100' : 'opacity-70'}`}>Tin nhắn</span>
          {unreadChatCount > 0 && <span className="absolute top-1 right-2 w-4 h-4 bg-red-500 text-white text-[9px] font-bold flex items-center justify-center rounded-full border-2 border-white shadow-sm animate-bounce">{unreadChatCount}</span>}
        </Link>

        <Link to="/profile" className={`flex-1 flex flex-col items-center justify-center gap-1 pb-4 group transition-all duration-300 ${location.pathname === '/profile' ? 'text-blue-600 -translate-y-1' : 'text-gray-400 hover:text-gray-500'}`}>
          <div className={`p-0.5 rounded-full transition-all duration-300 border-2 ${location.pathname === '/profile' ? 'border-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.3)]' : 'border-transparent'}`}>
             {user ? (
                 <img src={user.avatar} className="w-7 h-7 rounded-full object-cover" alt="User" />
             ) : (
                <svg className="w-6 h-6 m-1" fill={location.pathname === '/profile' ? "currentColor" : "none"} stroke="currentColor" strokeWidth={location.pathname === '/profile' ? 0 : 2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
             )}
          </div>
          <span className={`text-[10px] font-bold tracking-tight ${location.pathname === '/profile' ? 'opacity-100' : 'opacity-70'}`}>Cá nhân</span>
        </Link>
      </nav>

      <UniversalInstallPrompt />
    </div>
  );
};

export default Layout;