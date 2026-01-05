
import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { User, Notification, ChatRoom } from '../types.ts';
import { identifyProductForSearch } from '../services/geminiService.ts';
import { formatPrice, formatTimeAgo } from '../utils/format.ts';
import { db } from '../services/db.ts';
import UniversalInstallPrompt from './UniversalInstallPrompt.tsx';

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
}

const Layout: React.FC<LayoutProps> = ({ children, user }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchingImage, setIsSearchingImage] = useState(false);
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);

  useEffect(() => {
    if (user) {
      const unsubNotifs = db.getNotifications(user.id, (notifs) => {
        setNotifications(notifs);
      });
      const unsubChats = db.getChatRooms(user.id, (rooms) => {
        setChatRooms(rooms);
      });
      return () => {
        unsubNotifs();
        unsubChats();
      };
    }
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifs(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadNotifCount = notifications.filter(n => !n.read).length;
  const unreadChatCount = chatRooms.filter(r => r.messages.length > 0 && !r.seenBy?.includes(user?.id || '')).length;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/?search=${encodeURIComponent(searchQuery.trim())}`);
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
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      try {
        const keywords = await identifyProductForSearch(base64);
        setSearchQuery(keywords);
        navigate(`/?search=${encodeURIComponent(keywords)}&visual=true`);
      } catch (err) {
        alert("Không thể nhận diện hình ảnh.");
      } finally {
        setIsSearchingImage(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const handleMarkAsRead = async (notif: Notification) => {
    if (!notif.read) {
      await db.markNotificationAsRead(notif.id);
    }
    if (notif.link) {
      navigate(notif.link);
      setShowNotifs(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-bgMain">
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-xl border-b border-borderMain/50 px-3 md:px-6 lg:px-10 h-20 flex items-center justify-between gap-2 md:gap-4 shadow-sm">
        <div className="flex items-center flex-shrink-0">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 md:w-11 md:h-11 bg-gradient-to-tr from-primary to-blue-400 rounded-xl md:rounded-2xl flex items-center justify-center text-white text-xl md:text-2xl shadow-lg shadow-primary/25 group-hover:rotate-6 transition-all duration-300">⚡</div>
            <span className="font-black text-xl text-primary hidden lg:block tracking-tighter">Chợ của tui</span>
          </Link>
        </div>

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
            className="w-full bg-gray-100/60 border border-transparent rounded-xl md:rounded-[1.25rem] py-2.5 md:py-3 pl-9 md:pl-12 pr-9 md:pr-12 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/30 focus:bg-white transition-all text-xs md:text-sm font-medium"
          />
          <button 
            type="button"
            onClick={handleImageSearchClick}
            disabled={isSearchingImage}
            className={`absolute right-2 md:right-3 top-1/2 -translate-y-1/2 p-1.5 md:p-2 rounded-lg md:rounded-xl hover:bg-gray-100 text-gray-400 transition-all ${isSearchingImage ? 'animate-pulse text-primary' : 'hover:text-primary'}`}
            title="Tìm bằng AI"
          >
            <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            </svg>
          </button>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
        </form>

        <div className="flex items-center gap-1 md:gap-4 flex-shrink-0">
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

          <div className="relative" ref={notifRef}>
            <button 
              onClick={() => setShowNotifs(!showNotifs)}
              className={`relative p-2.5 rounded-2xl transition-all ${showNotifs ? 'bg-primary/10 text-primary' : 'text-gray-400 hover:bg-gray-100'}`}
            >
              <svg className="w-6 h-6 md:w-7 md:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unreadNotifCount > 0 && (
                <span className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-white shadow-sm">
                  {unreadNotifCount}
                </span>
              )}
            </button>
            {showNotifs && (
              <div className="absolute right-0 mt-3 w-80 bg-white border border-borderMain rounded-[2rem] shadow-2xl overflow-hidden animate-fade-in-up">
                <div className="p-5 border-b border-gray-50 flex items-center justify-between bg-bgMain/30">
                  <h3 className="font-black text-sm uppercase tracking-tight">Thông báo</h3>
                  <span className="text-[10px] font-black text-primary bg-primary/10 px-2.5 py-1 rounded-lg">{unreadNotifCount} mới</span>
                </div>
                <div className="max-h-96 overflow-y-auto no-scrollbar">
                  {notifications.length > 0 ? notifications.map(notif => (
                    <button key={notif.id} onClick={() => handleMarkAsRead(notif)} className={`w-full text-left p-4 hover:bg-bgMain transition-colors flex gap-4 border-b border-gray-50 last:border-0 ${!notif.read ? 'bg-primary/5' : ''}`}>
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 text-xl ${notif.type === 'success' ? 'bg-green-100 text-green-600' : notif.type === 'error' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                        {notif.type === 'success' ? '✅' : notif.type === 'error' ? '❌' : '🔔'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs font-black truncate ${!notif.read ? 'text-primary' : 'text-textMain'}`}>{notif.title}</p>
                        <p className="text-[10px] text-gray-500 line-clamp-2 font-medium mt-0.5">{notif.message}</p>
                        <p className="text-[8px] text-gray-300 font-bold uppercase mt-1.5">{formatTimeAgo(notif.createdAt)}</p>
                      </div>
                    </button>
                  )) : (
                    <div className="p-16 text-center opacity-30">
                      <div className="text-4xl mb-4">📭</div>
                      <p className="text-gray-400 text-[10px] font-black uppercase">Không có thông báo mới</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

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

      <main className="flex-1 w-full max-w-screen-2xl mx-auto md:px-8 py-6 md:py-10">
        {children}
      </main>

      {/* Mobile Nav Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-borderMain/50 flex items-center justify-around h-22 z-50 px-4 shadow-lg pb-safe">
        <Link to="/" className={`flex flex-col items-center gap-1.5 flex-1 py-3 ${location.pathname === '/' ? 'text-primary' : 'text-gray-400'}`}>
          <div className={`p-2 rounded-2xl transition-all ${location.pathname === '/' ? 'bg-primary/10' : ''}`}>
            <svg className="w-6 h-6" fill={location.pathname === '/' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
          </div>
          <span className="text-[9px] font-black uppercase tracking-widest">Trang chủ</span>
        </Link>
        <Link to="/manage-ads" className={`flex flex-col items-center gap-1.5 flex-1 py-3 ${location.pathname === '/manage-ads' ? 'text-primary' : 'text-gray-400'}`}>
          <div className={`p-2 rounded-2xl transition-all ${location.pathname === '/manage-ads' ? 'bg-primary/10' : ''}`}>
            <svg className="w-6 h-6" fill={location.pathname === '/manage-ads' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
          </div>
          <span className="text-[9px] font-black uppercase tracking-widest">Quản lý</span>
        </Link>
      {/* NÚT ĐĂNG TIN ĐÃ CẢI TIẾN */}
<div className="flex-1 flex justify-center -mt-14 relative z-10"> {/* Kéo lên cao hơn chút (-mt-14) */}
  <Link 
    to="/post" 
    className="
      w-20 h-20 
      bg-gradient-to-tr from-blue-600 to-cyan-400 
      text-white 
      rounded-full 
      flex items-center justify-center 
      shadow-[0_0_25px_rgba(59,130,246,0.6)] 
      border-[6px] border-white 
      transform transition-all duration-300 
      active:scale-90 hover:scale-105 hover:-translate-y-1
    "
  >
    <svg className="w-8 h-8 md:w-9 md:h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {/* Icon dấu cộng mảnh hơn và bo tròn */}
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
    </svg>
    
    {/* Hiệu ứng gợn sóng (Pulse) để gây chú ý */}
    <span className="absolute w-full h-full rounded-full bg-blue-400 opacity-20 animate-ping -z-10"></span>
  </Link>
</div>

        <Link to="/chat" className={`flex flex-col items-center gap-1.5 flex-1 py-3 relative ${location.pathname.startsWith('/chat') ? 'text-primary' : 'text-gray-400'}`}>
          <div className={`p-2 rounded-2xl transition-all ${location.pathname.startsWith('/chat') ? 'bg-primary/10' : ''}`}>
            <svg className="w-6 h-6" fill={location.pathname.startsWith('/chat') ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
          </div>
          <span className="text-[9px] font-black uppercase tracking-widest">Tin nhắn</span>
          {unreadChatCount > 0 && <span className="absolute top-2 right-4 w-4 h-4 bg-red-500 rounded-full border-2 border-white"></span>}
        </Link>
        <Link to="/profile" className={`flex flex-col items-center gap-1.5 flex-1 py-3 ${location.pathname === '/profile' ? 'text-primary' : 'text-gray-400'}`}>
          <div className={`p-2 rounded-2xl transition-all ${location.pathname === '/profile' ? 'bg-primary/10' : ''}`}>
            <svg className="w-6 h-6" fill={location.pathname === '/profile' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
          </div>
          <span className="text-[9px] font-black uppercase tracking-widest">Cá nhân</span>
        </Link>
      </nav>

      {/* Universal PWA Install Prompt */}
      <UniversalInstallPrompt />
    </div>
  );
};

export default Layout;
