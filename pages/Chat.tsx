import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../services/db';
import { ChatRoom, User } from '../types';
import { formatPrice, formatTimeAgo, getListingUrl } from '../utils/format';

const Chat: React.FC<{ user: User | null }> = ({ user }) => {
  const { roomId } = useParams(); // Lấy roomId từ URL /chat/:roomId
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
  const [message, setMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // 1. Load danh sách phòng chat
  useEffect(() => {
    if (user) {
      const unsubscribe = db.getChatRooms(user.id, (loadedRooms) => {
        setRooms(loadedRooms);
      });
      return () => unsubscribe();
    }
  }, [user]);

  // 2. Xử lý khi chọn phòng (hoặc URL thay đổi)
  useEffect(() => {
    const loadActiveRoom = async () => {
      if (user && roomId) {
        // Tìm trong state hiện tại trước cho nhanh (Optimistic UI)
        const existingRoom = rooms.find(r => r.id === roomId);
        if (existingRoom) {
          setActiveRoom(existingRoom);
        } else {
          // Nếu chưa load kịp hoặc vào thẳng link, gọi API
          const room = await db.getChatRoom(roomId);
          if (room) setActiveRoom(room);
        }
        
        // Đánh dấu đã xem
        if (user) {
            db.markRoomAsSeen(roomId, user.id);
        }
      } else {
        setActiveRoom(null);
      }
    };
    loadActiveRoom();
  }, [roomId, user, rooms]); // Thêm rooms vào dependency để cập nhật khi có tin nhắn mới

  // Auto scroll xuống cuối
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [activeRoom?.messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !activeRoom || !user) return;

    const textToSend = message;
    setMessage(''); // Clear input ngay lập tức

    await db.addMessage(activeRoom.id, {
      senderId: user.id,
      text: textToSend
    });

    // Scroll nhẹ xuống
    setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  if (!user) return <div className="p-10 text-center">Vui lòng đăng nhập để chat</div>;

  return (
    <div className="bg-white border border-borderMain rounded-2xl h-[calc(100dvh-13rem)] md:h-[calc(100vh-140px)] flex overflow-hidden shadow-soft">
      
      {/* Sidebar - Rooms List */}
      <aside className={`w-full md:w-80 flex-shrink-0 border-r border-borderMain flex flex-col ${roomId ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-borderMain">
          <h2 className="font-bold text-lg">Tin nhắn</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {rooms.length > 0 ? (
            rooms.map(room => {
              const isUnread = room.messages.length > 0 && !room.seenBy?.includes(user.id);
              // Xác định tên người chat cùng (không phải mình)
              // Logic hiển thị tiêu đề chat nên là Tên Tin Đăng
              return (
                <Link 
                  to={`/chat/${room.id}`} 
                  key={room.id}
                  className={`flex gap-3 p-4 hover:bg-bgMain transition-colors border-b border-gray-50 relative ${roomId === room.id ? 'bg-primary/5 border-l-4 border-l-primary' : ''}`}
                >
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                    <img src={room.listingImage} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                        <h3 className={`text-sm truncate ${isUnread ? 'font-black text-textMain' : 'font-bold text-gray-700'}`}>{room.listingTitle}</h3>
                        <span className="text-[10px] text-gray-300 whitespace-nowrap">{formatTimeAgo(room.lastUpdate)}</span>
                    </div>
                    <p className={`text-xs truncate mt-1 ${isUnread ? 'font-black text-primary' : 'text-gray-400'}`}>
                      {room.lastMessage || 'Bắt đầu cuộc trò chuyện'}
                    </p>
                  </div>
                  {isUnread && (
                    <div className="absolute top-1/2 -translate-y-1/2 right-2 w-2.5 h-2.5 bg-primary rounded-full shadow-sm"></div>
                  )}
                </Link>
              );
            })
          ) : (
            <div className="p-10 text-center text-gray-400">Bạn chưa có tin nhắn nào</div>
          )}
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className={`flex-1 flex flex-col min-w-0 ${!roomId ? 'hidden md:flex' : 'flex'}`}>
        {activeRoom ? (
          <>
            {/* Header */}
            <div className="p-3 md:p-4 border-b border-borderMain flex items-center justify-between bg-white z-10">
              <div className="flex items-center gap-3">
                <Link to="/chat" className="md:hidden p-1 -ml-1 text-gray-400 hover:text-primary">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/></svg>
                </Link>
                <div className="w-10 h-10 rounded-lg overflow-hidden border border-borderMain">
                  <img src={activeRoom.listingImage} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold leading-none truncate max-w-[150px] md:max-w-xs">{activeRoom.listingTitle}</h3>
                  <p className="text-xs text-primary font-bold mt-1">{formatPrice(activeRoom.listingPrice)}</p>
                </div>
              </div>
              
              {/* Nút xem tin gốc - Chỉ hiện nếu không phải tin ảo profile */}
              {!activeRoom.listingId.startsWith('profile_') && (
                  <Link 
                    to={getListingUrl({ id: activeRoom.listingId, title: activeRoom.listingTitle } as any)}
                    className="text-[10px] md:text-xs font-bold text-primary hover:underline bg-primary/5 px-3 py-1.5 rounded-lg whitespace-nowrap"
                  >
                    Xem tin
                  </Link>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50 overscroll-contain">
              {activeRoom.messages.length > 0 ? (
                activeRoom.messages.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={`flex ${msg.senderId === user.id ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[85%] md:max-w-[75%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${msg.senderId === user.id ? 'bg-primary text-white rounded-br-none' : 'bg-white border border-borderMain text-textMain rounded-bl-none'}`}>
                      {msg.text}
                      <p className={`text-[9px] mt-1 ${msg.senderId === user.id ? 'text-white/70 text-right' : 'text-gray-400'}`}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-20 text-center text-gray-400 space-y-2">
                  <div className="text-4xl">👋</div>
                  <p className="text-sm font-bold uppercase tracking-widest">Hãy gửi tin nhắn đầu tiên!</p>
                </div>
              )}
              <div ref={scrollRef} className="h-4" />
            </div>

            {/* Input Form */}
            <form onSubmit={handleSendMessage} className="p-3 md:p-4 border-t border-borderMain bg-white pb-4 shrink-0">
              <div className="flex gap-2 md:gap-3">
                <input 
                  type="text" 
                  placeholder="Nhập tin nhắn..." 
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onFocus={() => {
                      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 300);
                  }}
                  className="flex-1 bg-gray-100 border-transparent focus:bg-white border focus:border-primary rounded-full px-4 py-2.5 focus:outline-none text-sm font-medium transition-all"
                />
                <button 
                  type="submit"
                  disabled={!message.trim()}
                  className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center shadow-lg shadow-primary/20 disabled:opacity-50 transition-all hover:scale-105 active:scale-95 flex-shrink-0"
                >
                  <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 space-y-4">
            <div className="w-24 h-24 bg-bgMain rounded-full flex items-center justify-center text-4xl shadow-inner">💬</div>
            <p className="font-bold uppercase text-[10px] tracking-[0.2em]">Chọn một cuộc trò chuyện để bắt đầu</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Chat;
