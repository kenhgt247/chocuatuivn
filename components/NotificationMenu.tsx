import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/db'; 
import { formatTimeAgo } from '../utils/format';
import { Notification } from '../types'; // Import type chuẩn từ file types

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
      // Đếm số lượng chưa đọc (Lưu ý: trong DB trường là 'read' hay 'isRead' tùy bạn định nghĩa, ở đây tôi dùng 'read' theo chuẩn cũ của bạn)
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
        unsubscribe(); // Hủy lắng nghe khi thoát
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
    // Lặp qua các thông báo chưa đọc và đánh dấu (Hoặc viết hàm markAll trong db.ts để tối ưu hơn)
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    unreadIds.forEach(id => db.markNotificationAsRead(id));
  };

  // Icon theo loại thông báo
  const getIcon = (type: string) => {
    switch (type) {
        case 'wallet': return <span className="bg-green-100 text-green-600 p-2 rounded-full">💰</span>;
        case 'swap': return <span className="bg-purple-100 text-purple-600 p-2 rounded-full">🔄</span>;
        case 'system': return <span className="bg-blue-100 text-blue-600 p-2 rounded-full">⚡</span>;
        case 'review': return <span className="bg-yellow-100 text-yellow-600 p-2 rounded-full">⭐</span>;
        default: return <span className="bg-gray-100 text-gray-600 p-2 rounded-full">🔔</span>;
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      {/* BELL ICON BUTTON */}
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="relative p-2 rounded-full hover:bg-gray-100 transition-colors group"
      >
        <svg className={`w-6 h-6 ${isOpen ? 'text-primary' : 'text-gray-600 group-hover:text-primary'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
        
        {/* Badge số lượng (Chấm đỏ) */}
        {unreadCount > 0 && (
            <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
            </span>
        )}
      </button>

      {/* DROPDOWN MENU */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 md:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-[100] animate-fade-in-up origin-top-right">
            
            {/* Header */}
            <div className="p-4 border-b border-gray-50 flex items-center justify-between bg-white sticky top-0 z-10">
                <h3 className="font-black text-sm uppercase tracking-wider text-gray-800">Thông báo</h3>
                {unreadCount > 0 && (
                    <button onClick={markAllAsRead} className="text-[10px] font-bold text-primary hover:underline">
                        Đánh dấu đã đọc
                    </button>
                )}
            </div>

            {/* List */}
            <div className="max-h-[400px] overflow-y-auto">
                {notifications.length === 0 ? (
                    <div className="p-10 text-center text-gray-400">
                        <div className="text-4xl mb-2 opacity-30">🔕</div>
                        <p className="text-xs">Chưa có thông báo nào</p>
                    </div>
                ) : (
                    notifications.map(noti => (
                        <div 
                            key={noti.id} 
                            onClick={() => handleRead(noti)}
                            className={`p-4 flex gap-3 cursor-pointer transition-colors border-b border-gray-50 last:border-0 ${!noti.read ? 'bg-blue-50/50 hover:bg-blue-50' : 'bg-white hover:bg-gray-50'}`}
                        >
                            <div className="flex-shrink-0 mt-1">
                                {getIcon(noti.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start mb-0.5">
                                    <h4 className={`text-sm truncate pr-2 ${!noti.read ? 'font-black text-gray-900' : 'font-bold text-gray-700'}`}>{noti.title}</h4>
                                    {!noti.read && <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-1.5"></span>}
                                </div>
                                <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{noti.message}</p>
                                <p className="text-[10px] text-gray-400 font-bold mt-2">{formatTimeAgo(noti.createdAt)}</p>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Footer */}
            <div className="p-3 bg-gray-50 text-center border-t border-gray-100">
                <button className="text-[10px] font-black uppercase text-gray-500 hover:text-primary transition-colors">Xem tất cả</button>
            </div>
        </div>
      )}
    </div>
  );
};

export default NotificationMenu;
