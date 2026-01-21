import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/db'; 
import { formatTimeAgo } from '../utils/format';
import { Notification } from '../types'; 

// --- IMPORT ICON VECTOR ---
import { 
  Bell, Check, RefreshCw, Zap, Star, Wallet, Package, 
  MessageCircle, Info 
} from 'lucide-react';
const NotificationMenu: React.FC<{ userId: string }> = ({ userId }) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  // --- KẾT NỐI DỮ LIỆU THẬT (REALTIME) ---
  useEffect(() => {
    if (!userId) return;

    // Gọi hàm lắng nghe thông báo từ Firebase
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

  const handleRead = async (noti: Notification) => {
    // 1. Đánh dấu đã đọc trên Server
    if (!noti.read) {
        await db.markNotificationAsRead(noti.id);
    }
    
    // 2. Chuyển hướng
    setIsOpen(false);
    if (noti.link) {
        navigate(noti.link);
    } else {
        // Nếu không có link, tùy loại mà chuyển hướng
        if (noti.type === 'wallet') navigate('/wallet');
        else if (noti.type === 'order') navigate('/manage-ads');
    }
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    unreadIds.forEach(id => db.markNotificationAsRead(id));
  };

  // Icon theo loại thông báo (Dùng Vector)
  const getIcon = (type: string) => {
    switch (type) {
        case 'wallet': 
            return <div className="bg-green-100 text-green-600 p-2 rounded-full"><Wallet className="w-4 h-4" /></div>;
        case 'swap': 
            return <div className="bg-purple-100 text-purple-600 p-2 rounded-full"><RefreshCw className="w-4 h-4" /></div>;
        case 'system': 
            return <div className="bg-blue-100 text-blue-600 p-2 rounded-full"><Zap className="w-4 h-4" /></div>;
        case 'review': 
            return <div className="bg-yellow-100 text-yellow-600 p-2 rounded-full"><Star className="w-4 h-4" /></div>;
        case 'order':
            return <div className="bg-orange-100 text-orange-600 p-2 rounded-full"><Package className="w-4 h-4" /></div>;
        default: 
            return <div className="bg-gray-100 text-gray-600 p-2 rounded-full"><Bell className="w-4 h-4" /></div>;
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      {/* BELL ICON BUTTON */}
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="relative p-2 rounded-full hover:bg-gray-100 transition-colors group"
      >
        <Bell className={`w-6 h-6 ${isOpen ? 'text-primary' : 'text-slate-600 group-hover:text-primary'}`} strokeWidth={2} />
        
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
            
            {/* Header */}
            <div className="p-4 border-b border-gray-50 flex items-center justify-between bg-white sticky top-0 z-10">
                <h3 className="font-black text-sm uppercase tracking-wider text-slate-800 flex items-center gap-2">
                    <Bell className="w-4 h-4" /> Thông báo
                </h3>
                {unreadCount > 0 && (
                    <button onClick={markAllAsRead} className="text-[10px] font-bold text-primary hover:bg-primary/5 px-2 py-1 rounded-md transition-colors flex items-center gap-1">
                        <Check className="w-3 h-3" /> Đánh dấu đã đọc
                    </button>
                )}
            </div>

            {/* List */}
            <div className="max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200">
                {notifications.length === 0 ? (
                    <div className="p-12 text-center text-gray-400 flex flex-col items-center gap-3">
                        <div className="p-4 bg-gray-50 rounded-full">
                            <Bell className="w-8 h-8 opacity-20" />
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
                    Xem tất cả <Info className="w-3 h-3" />
                </button>
            </div>
        </div>
      )}
    </div>
  );
};

export default NotificationMenu;
