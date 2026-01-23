import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { User, ChatRoom } from '../types'; 
import { identifyProductForSearch } from '../services/geminiService';
import { db, app } from '../services/db'; 
import UniversalInstallPrompt from './UniversalInstallPrompt';
import { compressAndGetBase64 } from '../utils/imageCompression';
import NotificationMenu from '../components/NotificationMenu';

// ⚠️ TUYỆT ĐỐI KHÔNG IMPORT firebase/messaging Ở ĐÂY

/* ====================================================================================
   BỘ ICON VẼ TAY (SVG THUẦN)
   ==================================================================================== */
const IconZap = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>;
const IconBell = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>;
const IconMessage = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>;
const IconUser = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const IconHome = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
const IconPlus = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const IconSearch = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>;
const IconManage = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>;
// Smart Search Icons
const IconMic = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>;
const IconClock = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
const IconTrendingUp = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>;
const IconCamera = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>;
const IconLogin = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>;

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
}

const Layout: React.FC<LayoutProps> = ({ children, user }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams(); 
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLFormElement>(null); 
  
  // --- STATE ---
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [isSearchingImage, setIsSearchingImage] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [isListening, setIsListening] = useState(false);

  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [notifPermission, setNotifPermission] = useState(() => {
    try { return ("Notification" in window) ? Notification.permission : 'default'; } catch (e) { return 'default'; }
  });
  const [hasInteractedWithNotif, setHasInteractedWithNotif] = useState(false);

  const minPriceParam = searchParams.get('minPrice');
  const maxPriceParam = searchParams.get('maxPrice');
  const locationParam = searchParams.get('location');

  useEffect(() => {
    const saved = localStorage.getItem('search_history');
    if (saved) setSearchHistory(JSON.parse(saved));
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => { setSearchQuery(searchParams.get('search') || ''); }, [searchParams]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    if (user?.id) {
      try {
        // @ts-ignore
        unsubscribe = db.getChatRooms(user.id, (rooms: ChatRoom[]) => { if (rooms) setChatRooms(rooms); });
      } catch (error) { console.warn("Lỗi lắng nghe chat:", error); }
    } else { setChatRooms([]); }
    return () => { if (unsubscribe) unsubscribe(); };
  }, [user?.id]);

  const unreadChatCount = user ? chatRooms.filter(r => r.messages.length > 0 && !r.seenBy?.includes(user.id) ).length : 0;

  const handleEnableNotifications = async () => {
    setHasInteractedWithNotif(true);
    if (!("Notification" in window)) return alert("Thiết bị này không hỗ trợ thông báo web.");
    try {
      const permission = await Notification.requestPermission();
      setNotifPermission(permission);
      if (permission === 'granted') {
        if ('setAppBadge' in navigator) { /* @ts-ignore */ navigator.setAppBadge(unreadChatCount).catch(() => {}); }
        try {
            if ('serviceWorker' in navigator) {
                const registration = await navigator.serviceWorker.ready;
                const { getMessaging, getToken } = await import("firebase/messaging");
                const messaging = getMessaging(app);
                const currentToken = await getToken(messaging, { vapidKey: 'BC-HSAKsOy5hvpSPgtlC52kwy8OWL2oX1jn4pIkzyRkcqgPzlzTkHe2Xa9rBPJYtGjygvoTcfaWmCxYCeFZrlMI', serviceWorkerRegistration: registration });
                // @ts-ignore
                if (currentToken && user?.id && db.updateUserProfile) { await db.updateUserProfile(user.id, { fcmToken: currentToken }); alert("✅ Đã bật thông báo thành công!"); }
            }
        } catch (err) { console.error('Lỗi kích hoạt thông báo:', err); }
      } else { alert("Bạn đã chặn thông báo."); }
    } catch (error) { console.error("Lỗi xin quyền:", error); }
  };

  const saveToHistory = (query: string) => {
      if(!query) return;
      const newHistory = [query, ...searchHistory.filter(h => h !== query)].slice(0, 5);
      setSearchHistory(newHistory);
      localStorage.setItem('search_history', JSON.stringify(newHistory));
  };

  const handleSearchSubmit = (e?: React.FormEvent, queryOverride?: string) => {
    if(e) e.preventDefault();
    const q = (queryOverride || searchQuery).trim();
    if (!q) return;
    
    saveToHistory(q);
    setShowSuggestions(false);
    navigate(`/?search=${encodeURIComponent(q)}`);
  };

  const handleVoiceSearch = () => {
    if (!('webkitSpeechRecognition' in window)) {
        alert("Trình duyệt không hỗ trợ giọng nói. Hãy dùng Chrome hoặc Edge.");
        return;
    }
    // @ts-ignore
    const recognition = new window.webkitSpeechRecognition();
    recognition.lang = 'vi-VN';
    recognition.start();
    setIsListening(true);

    recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setSearchQuery(transcript);
        handleSearchSubmit(undefined, transcript);
        setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
  };

  const handleImageSearchClick = () => { fileInputRef.current?.click(); };

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
                <div className="w-6 h-6"><IconZap /></div>
            </div>
            <span className="hidden lg:block font-black text-xl md:text-2xl tracking-tighter bg-gradient-to-r from-blue-700 via-blue-500 to-yellow-500 bg-clip-text text-transparent group-hover:scale-[1.02] transition-transform origin-left drop-shadow-sm">
              Chợ của tui
            </span>
          </Link>
        </div>

        {/* SEARCH BAR */}
        <form 
            ref={searchContainerRef}
            onSubmit={(e) => handleSearchSubmit(e)} 
            className="flex-1 max-w-2xl relative group px-1 md:px-0"
        >
          <div className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-gray-400">
              <div className="w-4 h-4 md:w-5 md:h-5"><IconSearch /></div>
          </div>
          
          <input 
            type="text" 
            placeholder={isListening ? "Đang nghe..." : (window.innerWidth < 768 ? "Tìm kiếm..." : "Tìm gì cũng có...")}
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            onFocus={() => setShowSuggestions(true)}
            className={`w-full bg-gray-100 border-2 transition-all rounded-xl md:rounded-[1.25rem] py-2.5 md:py-3 pl-9 md:pl-12 pr-20 md:pr-24 focus:outline-none text-xs md:text-sm font-bold text-slate-700 placeholder:text-gray-400 shadow-sm ${isListening ? 'border-red-500 bg-red-50 animate-pulse' : 'border-transparent hover:border-gray-200 focus:border-primary focus:bg-white'}`} 
          />

          <div className="absolute right-1.5 md:right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <button 
                type="button" 
                onClick={handleVoiceSearch}
                className={`p-1.5 md:p-2 rounded-lg hover:bg-gray-200 transition-all ${isListening ? 'text-red-500 scale-110' : 'text-gray-400 hover:text-blue-500'}`}
                title="Tìm bằng giọng nói"
              >
                 <IconMic />
              </button>

              <button 
                type="button" 
                onClick={handleImageSearchClick} 
                disabled={isSearchingImage} 
                className={`p-1.5 md:p-2 rounded-lg hover:bg-gray-200 transition-all ${isSearchingImage ? 'animate-pulse text-primary' : 'text-gray-400 hover:text-primary'}`}
                title="Tìm bằng hình ảnh"
              >
                <IconCamera />
              </button>
          </div>
          
          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />

          {showSuggestions && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-fade-in-up z-50">
                  {searchHistory.length > 0 && (
                      <div className="p-2">
                          <p className="text-[10px] font-black text-gray-400 uppercase px-3 py-2">Lịch sử tìm kiếm</p>
                          {searchHistory.map((item, idx) => (
                              <div 
                                key={idx} 
                                onClick={() => { setSearchQuery(item); handleSearchSubmit(undefined, item); }}
                                className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 rounded-xl cursor-pointer group"
                              >
                                  <span className="text-gray-300 group-hover:text-primary"><IconClock /></span>
                                  <span className="text-sm font-medium text-gray-700 group-hover:text-primary">{item}</span>
                              </div>
                          ))}
                      </div>
                  )}
                  <div className="p-2 border-t border-gray-50 bg-gray-50/50">
                      <p className="text-[10px] font-black text-gray-400 uppercase px-3 py-2 flex items-center gap-1"><IconTrendingUp /> Xu hướng</p>
                      <div className="flex flex-wrap gap-2 px-2 pb-2">
                          {['iPhone 15', 'Xe máy cũ', 'Laptop Gaming', 'Nhà trọ', 'Việc làm'].map(tag => (
                              <button 
                                key={tag}
                                type="button"
                                onClick={() => { setSearchQuery(tag); handleSearchSubmit(undefined, tag); }}
                                className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-600 hover:border-primary hover:text-primary hover:shadow-sm transition-all"
                              >
                                  {tag}
                              </button>
                          ))}
                      </div>
                  </div>
              </div>
          )}
        </form>

        {/* ACTIONS */}
        <div className="flex items-center gap-1 md:gap-4 flex-shrink-0">
          
          {/* CHAT ICON - Chỉ hiện trên PC khi ĐÃ ĐĂNG NHẬP */}
          {user && (
              <Link to="/chat" className={`hidden md:flex relative p-2.5 rounded-2xl transition-all ${location.pathname.startsWith('/chat') ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-gray-100 hover:text-primary'}`}>
                <div className="w-6 h-6 md:w-7 md:h-7"><IconMessage /></div>
                {unreadChatCount > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-white shadow-sm animate-bounce">{unreadChatCount}</span>}
              </Link>
          )}

          {/* ICON CHUÔNG/USER */}
          {user ? (
              // ĐÃ LOGIN: Hiện Menu Thông báo (Chuông)
              <NotificationMenu userId={user.id} />
          ) : (
              // CHƯA LOGIN: 
              // Mobile: Hiện icon Chuông để gợi ý login
              // PC: Ẩn luôn (để dành chỗ cho nút Login to)
              <Link to="/login" className="relative p-2 rounded-2xl text-slate-600 hover:bg-gray-100 hover:text-primary transition-all md:hidden">
                 <div className="w-6 h-6"><IconBell /></div>
              </Link>
          )}

          {/* NHÓM NÚT ĐĂNG TIN & AVATAR (Chỉ hiện trên PC) */}
          <div className="hidden md:flex items-center gap-3">
            
            <Link to="/post" className="flex items-center gap-2 bg-primary text-white px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 hover:bg-primaryHover hover:-translate-y-1 transition-all active:scale-95">
                <div className="w-4 h-4"><IconPlus /></div>
                <span>Đăng tin</span>
            </Link>

            {user ? (
                // Đã login -> Hiện Avatar
                <Link to="/profile" className="flex items-center pl-2">
                    <div className="w-11 h-11 rounded-2xl overflow-hidden border-2 border-white shadow-lg ring-1 ring-gray-200 hover:ring-primary hover:scale-110 transition-all">
                        <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                    </div>
                </Link>
            ) : (
                // Chưa login -> Hiện nút Đăng Nhập & Đăng Ký (Thiết kế mới)
                <>
                    <Link to="/login" className="px-5 py-3 rounded-2xl text-xs font-bold text-slate-600 hover:bg-gray-100 hover:text-primary transition-all flex items-center gap-2">
                        <IconLogin /> Đăng nhập
                    </Link>
                    <Link to="/register" className="px-5 py-3 rounded-2xl text-xs font-black bg-white border-2 border-primary text-primary hover:bg-primary hover:text-white transition-all uppercase tracking-wide shadow-sm">
                        Đăng ký
                    </Link>
                </>
            )}
          </div>
        </div>
      </header>

      {/* FILTER BAR (Giữ nguyên) */}
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

      {/* MOBILE NAV BAR */}
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