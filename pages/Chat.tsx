import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../services/db';
import { ChatRoom, User } from '../types';
import { formatPrice, formatTimeAgo, getListingUrl } from '../utils/format';

const Chat: React.FC<{ user: User | null }> = ({ user }) => {
  const { roomId } = useParams();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
  const [message, setMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      const unsubscribe = db.getChatRooms(user.id, (loadedRooms) => {
        setRooms(loadedRooms);
      });
      return () => unsubscribe();
    }
  }, [user]);

  useEffect(() => {
    const loadActiveRoom = async () => {
      if (user && roomId) {
        const existingRoom = rooms.find(r => r.id === roomId);
        if (existingRoom) {
          setActiveRoom(existingRoom);
        } else {
          const room = await db.getChatRoom(roomId);
          if (room) setActiveRoom(room);
        }
        if (user) db.markRoomAsSeen(roomId, user.id);
      } else {
        setActiveRoom(null);
      }
    };
    loadActiveRoom();
  }, [roomId, user, rooms]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [activeRoom?.messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !activeRoom || !user) return;
    const textToSend = message;
    setMessage('');
    await db.addMessage(activeRoom.id, { senderId: user.id, text: textToSend });
    setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  // --- HÀM HELPER QUAN TRỌNG: Lấy thông tin người đối diện ---
  const getPartnerInfo = (room: any, currentUserId: string) => {
    const partnerId = room.participantIds.find((id: string) => id !== currentUserId) || '';
    
    // 1. Nếu có dữ liệu participantsData (phòng mới tạo sau khi update code này)
    if (room.participantsData && room.participantsData[partnerId]) {
        return {
            name: room.participantsData[partnerId].name,
            avatar: room.participantsData[partnerId].avatar,
            subtitle: `Tin: ${room.listingTitle}` // Dòng phụ là tên sản phẩm
        };
    }

    // 2. Fallback cho phòng cũ (chưa có tên): Vẫn hiện tên sản phẩm
    return {
        name: room.listingTitle,
        avatar: room.listingImage,
        subtitle: formatPrice(room.listingPrice)
    };
  };

  if (!user) return <div className="p-10 text-center">Vui lòng đăng nhập để chat</div>;

  // Lấy thông tin partner của phòng đang mở (để hiển thị trên Header)
  const activePartner = activeRoom ? getPartnerInfo(activeRoom, user.id) : null;

  return (
    <div className="bg-white border border-borderMain rounded-2xl h-[calc(100dvh-13rem)] md:h-[calc(100vh-140px)] flex overflow-hidden shadow-soft">
      
      {/* Sidebar */}
      <aside className={`w-full md:w-80 flex-shrink-0 border-r border-borderMain flex flex-col ${roomId ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-borderMain bg-gray-50/50">
          <h2 className="font-black text-lg">Tin nhắn</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {rooms.length > 0 ? (
            rooms.map(room => {
              const isUnread = room.messages.length > 0 && !room.seenBy?.includes(user.id);
              const partner = getPartnerInfo(room, user.id); // <--- Lấy info đối phương

              return (
                <Link 
                  to={`/chat/${room.id}`} 
                  key={room.id}
                  className={`flex gap-3 p-4 hover:bg-bgMain transition-colors border-b border-gray-50 relative group ${roomId === room.id ? 'bg-primary/5 border-l-4 border-l-primary' : ''}`}
                >
                  {/* AVATAR: Hiển thị ảnh người chat cùng (tròn) */}
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200 flex-shrink-0 border border-gray-100 shadow-sm">
                    <img src={partner.avatar} alt="" className="w-full h-full object-cover" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                        {/* TÊN: Hiển thị tên người chat cùng */}
                        <h3 className={`text-sm truncate ${isUnread ? 'font-black text-textMain' : 'font-bold text-gray-700'}`}>{partner.name}</h3>
                        <span className="text-[10px] text-gray-400 whitespace-nowrap">{formatTimeAgo(room.lastUpdate)}</span>
                    </div>
                    
                    {/* SUBTITLE: Hiển thị tên sản phẩm họ đang quan tâm */}
                    <p className="text-[10px] text-gray-500 truncate font-medium bg-gray-100 px-1.5 py-0.5 rounded w-fit max-w-full mt-0.5">
                       {partner.subtitle}
                    </p>

                    {/* LAST MESSAGE */}
                    <p className={`text-xs truncate mt-1 ${isUnread ? 'font-black text-primary' : 'text-gray-400'}`}>
                      {room.lastMessage || 'Bắt đầu trò chuyện...'}
                    </p>
                  </div>
                  {isUnread && <div className="absolute top-1/2 -translate-y-1/2 right-2 w-2.5 h-2.5 bg-primary rounded-full shadow-sm animate-pulse"></div>}
                </Link>
              );
            })
          ) : (
            <div className="p-10 text-center text-gray-400">Chưa có tin nhắn nào</div>
          )}
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className={`flex-1 flex flex-col min-w-0 ${!roomId ? 'hidden md:flex' : 'flex'}`}>
        {activeRoom && activePartner ? (
          <>
            {/* Header Chat: Hiển thị Tên Partner + Tên Sản phẩm nhỏ bên dưới */}
            <div className="p-3 md:p-4 border-b border-borderMain flex items-center justify-between bg-white z-10 shadow-sm">
              <div className="flex items-center gap-3">
                <Link to="/chat" className="md:hidden p-1 -ml-1 text-gray-400 hover:text-primary">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/></svg>
                </Link>
                
                {/* Avatar Partner */}
                <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-200">
                  <img src={activePartner.avatar} alt="" className="w-full h-full object-cover" />
                </div>
                
                <div className="min-w-0">
                  {/* Tên Partner */}
                  <h3 className="text-sm font-black leading-tight truncate">{activePartner.name}</h3>
                  {/* Tên sản phẩm */}
                  <p className="text-[10px] text-gray-500 font-medium truncate max-w-[200px] flex items-center gap-1">
                    <span>🛒</span> {activeRoom.listingTitle} • <span className="text-primary font-bold">{formatPrice(activeRoom.listingPrice)}</span>
                  </p>
                </div>
              </div>
              
              {!activeRoom.listingId.startsWith('profile_') && (
                  <Link 
                    to={getListingUrl({ id: activeRoom.listingId, title: activeRoom.listingTitle } as any)}
                    className="hidden md:block text-[10px] font-bold text-gray-500 hover:text-primary border border-gray-200 hover:border-primary px-3 py-1.5 rounded-xl transition-all"
                  >
                    Xem bài đăng ↗
                  </Link>
              )}
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50 overscroll-contain">
              {activeRoom.messages.length > 0 ? (
                activeRoom.messages.map((msg, index) => {
                   const isMe = msg.senderId === user.id;
                   const showAvatar = !isMe && (index === 0 || activeRoom.messages[index - 1].senderId !== msg.senderId);
                   
                   return (
                      <div key={msg.id} className={`flex gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                        {!isMe && (
                            <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 self-end mb-1">
                                {showAvatar ? <img src={activePartner.avatar} className="w-full h-full object-cover" alt="" /> : <div className="w-8"></div>}
                            </div>
                        )}
                        <div className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm shadow-sm ${isMe ? 'bg-primary text-white rounded-br-sm' : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm'}`}>
                          {msg.text}
                          <p className={`text-[9px] mt-1 text-right ${isMe ? 'text-white/60' : 'text-gray-300'}`}>
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                   )
                })
              ) : (
                <div className="py-20 text-center text-gray-400 space-y-2">
                  <div className="text-4xl animate-bounce">👋</div>
                  <p className="text-sm font-bold uppercase tracking-widest">Gửi lời chào tới {activePartner.name}!</p>
                </div>
              )}
              <div ref={scrollRef} className="h-2" />
            </div>

            {/* Input */}
            <form onSubmit={handleSendMessage} className="p-3 md:p-4 bg-white border-t border-borderMain">
              <div className="flex gap-2 items-end bg-gray-100 p-1.5 rounded-[1.5rem]">
                <input 
                  type="text" 
                  placeholder={`Nhắn cho ${activePartner.name}...`}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="flex-1 bg-transparent border-none focus:ring-0 px-4 py-2 text-sm font-medium max-h-24"
                />
                <button 
                  type="submit"
                  disabled={!message.trim()}
                  className="w-9 h-9 bg-primary text-white rounded-full flex items-center justify-center shadow-md disabled:opacity-50 disabled:shadow-none hover:scale-105 transition-transform"
                >
                  <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-300 space-y-4">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center text-4xl grayscale opacity-50">💬</div>
            <p className="font-bold text-xs uppercase tracking-widest">Chọn hội thoại để xem</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Chat;
