import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/db'; 
import { formatTimeAgo } from '../utils/format';
import { AppNotification } from '../types'; // ✅ ĐÃ SỬA: Dùng AppNotification thay vì Notification

// ⚠️ ĐÃ LOẠI BỎ LUCIDE-REACT ĐỂ TRÁNH LỖI CRASH

/* ====================================================================================
   BỘ ICON VẼ TAY CHO THÔNG BÁO (AN TOÀN 100%)
   ==================================================================================== */
const IconBell = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>;
const IconCheck = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const IconWallet = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>;
const IconRefresh = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>;
const IconZap = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>;
const IconStar = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
const IconPackage = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16.5 9.4 7.55 4.24"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" y1="22" x2="12" y2="12"/></svg>;
const IconInfo = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>;
const IconCheckAll = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/></svg>;


const NotificationMenu: React.FC<{ userId: string }> = ({ userId }) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  
  // ✅ ĐÃ SỬA: State dùng AppNotification
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  
  const [unreadCount, setUnreadCount] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  // --- KẾT NỐI DỮ LIỆU THẬT (REALTIME) ---
  useEffect(() => {
    if (!userId) return;

    // ✅ ĐÃ SỬA: db.getNotifications giờ trả về AppNotification[]
    const unsubscribe = db.getNotifications(userId, (realNotifs) => {
      setNotifications(realNotifs);
      setUnreadCount(realNotifs.filter(n => !n.read).length);
    });

    // Đóng menu khi click ra ngoài
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
        // @ts-ignore
        if (typeof unsubscribe === 'function') unsubscribe();
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [userId]);

  // ✅ ĐÃ SỬA: Tham số đầu vào là AppNotification
  const handleRead = async (noti: AppNotification) => {
    // 1. Cập nhật UI ngay lập tức (để người dùng thấy đã đọc liền)
    const updatedNotifs = notifications.map(n => 
        n.id === noti.id ? { ...n, read: true } : n
    );
    setNotifications(updatedNotifs);
    setUnreadCount(updatedNotifs.filter(n => !n.read).length);

    // 2. Gọi API cập nhật ngầm
    if (!noti.read) {
        db.markNotificationAsRead(noti.id).catch(console.error);
    }
    
    // 3. Chuyển hướng
    setIsOpen(false);
    if (noti.link) {
        navigate(noti.link);
    } else {
        if (noti.type === 'wallet') navigate('/wallet');
        else if (noti.type === 'order') navigate('/manage-ads');
    }
  };

  // [NÂNG CẤP] Hàm đánh dấu tất cả đã đọc (Siêu tốc)
  const markAllAsRead = async () => {
    // 1. Cập nhật UI ngay lập tức (Số đỏ về 0 ngay)
    const allRead = notifications.map(n => ({ ...n, read: true }));
    setNotifications(allRead);
    setUnreadCount(0);

    // 2. Gửi lệnh cập nhật lên Server (chạy ngầm)
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    await Promise.all(unreadIds.map(id => db.markNotificationAsRead(id)));
  };

  // Icon theo loại thông báo (Dùng Vector Vẽ Tay)
  const getIcon = (type: string) => {
    switch (type) {
        case 'wallet': 
            return <div className="bg-green-100 text-green-600 p-2 rounded-full"><IconWallet className="w-4 h-4" /></div>;
        case 'swap': 
            return <div className="bg-purple-100 text-purple-600 p-2 rounded-full"><IconRefresh className="w-4 h-4" /></div>;
        case 'system': 
            return <div className="bg-blue-100 text-blue-600 p-2 rounded-full"><IconZap className="w-4 h-4" /></div>;
        case 'review': 
            return <div className="bg-yellow-100 text-yellow-600 p-2 rounded-full"><IconStar className="w-4 h-4" /></div>;
        case 'order':
            return <div className="bg-orange-100 text-orange-600 p-2 rounded-full"><IconPackage className="w-4 h-4" /></div>;
        default: 
            return <div className="bg-gray-100 text-gray-600 p-2 rounded-full"><IconBell className="w-4 h-4" /></div>;
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      {/* BELL ICON BUTTON */}
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="relative p-2 rounded-full hover:bg-gray-100 transition-colors group"
      >
        <IconBell className={`w-6 h-6 ${isOpen ? 'text-primary' : 'text-slate-600 group-hover:text-primary'}`} />
        
        {/* Badge số lượng (Chấm đỏ) */}
        {unreadCount > 0 && (
            <span className="absolute top-0 right-0 min-w-[20px] h-5 px-1 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white animate-pulse shadow-sm">
                {unreadCount > 9 ? '9+' : unreadCount}
            </span>
        )}
      </button>

      {/* DROPDOWN MENU */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 md:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-[100] animate-fade-in-up origin-top-right ring-1 ring-black/5">
            
            {/* Header: Nơi chứa nút Đánh dấu tất cả */}
            <div className="p-4 border-b border-gray-50 flex items-center justify-between bg-white sticky top-0 z-10">
                <h3 className="font-black text-sm uppercase tracking-wider text-slate-800 flex items-center gap-2">
                    <IconBell className="w-4 h-4" /> Thông báo
                </h3>
                
                {/* NÚT ĐÁNH DẤU ĐÃ ĐỌC TẤT CẢ (Chỉ hiện khi có tin chưa đọc) */}
                {unreadCount > 0 && (
                    <button 
                        onClick={markAllAsRead} 
                        className="text-[10px] font-bold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5 border border-blue-100 hover:border-blue-200"
                    >
                        <IconCheckAll className="w-3.5 h-3.5" /> 
                        Đánh dấu đã đọc hết
                    </button>
                )}
            </div>

            {/* List */}
            <div className="max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200">
                {notifications.length === 0 ? (
                    <div className="p-12 text-center text-gray-400 flex flex-col items-center gap-3">
                        <div className="p-4 bg-gray-50 rounded-full">
                            <IconBell className="w-8 h-8 opacity-20" />
                        </div>
                        <p className="text-xs font-medium">Chưa có thông báo nào</p>
                    </div>
                ) : (
                    notifications.map(noti => (
                        <div 
                            key={noti.id} 
                            onClick={() => handleRead(noti)}
                            className={`p-4 flex gap-3 cursor-pointer transition-all border-b border-gray-50 last:border-0 group relative overflow-hidden
                                ${!noti.read ? 'bg-blue-50/40 hover:bg-blue-50' : 'bg-white hover:bg-gray-50'}`}
                        >
                            {/* Thanh đánh dấu chưa đọc bên trái */}
                            {!noti.read && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>}

                            <div className="flex-shrink-0 mt-0.5">
                                {getIcon(noti.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start mb-1">
                                    <h4 className={`text-sm truncate pr-2 ${!noti.read ? 'font-black text-slate-900' : 'font-bold text-slate-700'}`}>{noti.title}</h4>
                                    {!noti.read && <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-1.5 shadow-sm shadow-primary/50"></span>}
                                </div>
                                <p className={`text-xs line-clamp-2 leading-relaxed ${!noti.read ? 'text-slate-600 font-medium' : 'text-gray-500'}`}>{noti.message}</p>
                                <p className="text-[10px] text-gray-400 font-bold mt-2 flex items-center gap-1">
                                    {formatTimeAgo(noti.createdAt)}
                                </p>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Footer */}
            <div className="p-3 bg-gray-50 text-center border-t border-gray-100">
                <button className="text-[10px] font-black uppercase text-gray-500 hover:text-primary transition-colors flex items-center justify-center gap-1 w-full py-1">
                    Xem tất cả <IconInfo className="w-3 h-3" />
                </button>
            </div>
        </div>
      )}
    </div>
  );
};

export default NotificationMenu;