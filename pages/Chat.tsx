import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom'; // Thêm useNavigate
import { db } from '../services/db';
import { ChatRoom, User } from '../types';
import { formatPrice, formatTimeAgo, getListingUrl } from '../utils/format';

// Ảnh mặc định
const DEFAULT_AVATAR = "https://ui-avatars.com/api/?background=random&color=fff&name=User";

const Chat: React.FC<{ user: User | null }> = ({ user }) => {
  const { roomId } = useParams();
  const navigate = useNavigate(); // Hook để chuyển trang
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
  const [message, setMessage] = useState('');
  
  // State để lưu thông tin người dùng được fetch bù cho các phòng chat cũ
  const [fetchedPartners, setFetchedPartners] = useState<Record<string, { name: string, avatar: string }>>({});
  
  const scrollRef = useRef<HTMLDivElement>(null);

  // Xử lý ảnh lỗi
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>, fallback: string) => {
    e.currentTarget.src = fallback;
    e.currentTarget.onerror = null;
  };

  // 1. Load danh sách phòng
  useEffect(() => {
    if (user) {
      const unsubscribe = db.getChatRooms(user.id, (loadedRooms) => {
        setRooms(loadedRooms);
      });
      return () => unsubscribe();
    }
  }, [user]);

  // 2. Tự động lấy thông tin người chat cho các phòng cũ (Legacy Rooms)
  useEffect(() => {
    if (!user || rooms.length === 0) return;

    rooms.forEach(async (room) => {
        const partnerId = room.participantIds.find(id => id !== user.id);
        
        if (partnerId && (!room.participantsData || !room.participantsData[partnerId]) && !fetchedPartners[partnerId]) {
            try {
                const partnerUser = await db.getUserById(partnerId);
                if (partnerUser) {
                    setFetchedPartners(prev => ({
                        ...prev,
                        [partnerId]: {
                            name: partnerUser.name,
                            avatar: partnerUser.avatar
                        }
                    }));
                }
            } catch (err) {
                console.error("Không thể lấy thông tin user cũ:", err);
            }
        }
    });
  }, [rooms, user, fetchedPartners]);

  // 3. Load phòng đang active
  useEffect(() => {
    const loadActiveRoom = async () => {
      if (user && roomId) {
        // Ưu tiên lấy từ state rooms (vì nó là realtime)
        const existingRoom = rooms.find(r => r.id === roomId);
        if (existingRoom) {
          setActiveRoom(existingRoom);
        } else {
          // Fallback nếu chưa load kịp list
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

  // Auto scroll
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [activeRoom?.messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !activeRoom || !user) return;
    const textToSend = message;
    setMessage(''); 
    await db.addMessage(activeRoom.id, {
      senderId: user.id,
      text: textToSend
    });
    setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // Hàm xử lý xóa tin nhắn (Message)
  const handleDeleteMessage = async (messageId: string) => {
    if (!activeRoom || !window.confirm("Bạn có chắc muốn thu hồi tin nhắn này không?")) return;
    
    try {
        await db.deleteMessage(activeRoom.id, messageId);
    } catch (error) {
        alert("Có lỗi xảy ra khi xóa tin nhắn.");
    }
  };

  // [MỚI] Hàm xử lý xóa phòng chat (Conversation)
  const handleDeleteRoom = async (e: React.MouseEvent, idToDelete: string) => {
    e.preventDefault(); // Ngăn Link kích hoạt chuyển trang
    e.stopPropagation(); // Ngăn sự kiện lan truyền

    if (!window.confirm("Bạn có chắc chắn muốn xóa cuộc trò chuyện này? Hành động này không thể hoàn tác.")) return;

    try {
        // Gọi hàm xóa từ db (Bạn cần đảm bảo hàm này có trong services/db.ts)
        await db.deleteChatRoom(idToDelete);
        
        // Nếu đang xem phòng vừa xóa, hãy quay về trang chủ chat
        if (roomId === idToDelete) {
            setActiveRoom(null);
            navigate('/chat');
        }
    } catch (error) {
        console.error(error);
        alert("Không thể xóa cuộc trò chuyện. Vui lòng thử lại.");
    }
  };

  // --- HÀM HELPER ---
  const getPartnerInfo = (room: any, currentUserId: string) => {
    const partnerId = room.participantIds.find((id: string) => id !== currentUserId) || '';
    
    if (room.participantsData && room.participantsData[partnerId]) {
        return {
            name: room.participantsData[partnerId].name,
            avatar: room.participantsData[partnerId].avatar,
            subtitle: `Tin: ${room.listingTitle}`,
            isProductAvatar: false
        };
    }

    if (fetchedPartners[partnerId]) {
        return {
            name: fetchedPartners[partnerId].name,
            avatar: fetchedPartners[partnerId].avatar,
            subtitle: `Tin: ${room.listingTitle}`,
            isProductAvatar: false
        };
    }

    return {
        name: room.listingTitle,
        avatar: room.listingImage,
        subtitle: formatPrice(room.listingPrice),
        isProductAvatar: true
    };
  };

  if (!user) return <div className="p-10 text-center">Vui lòng đăng nhập để chat</div>;

  const activePartner = activeRoom ? getPartnerInfo(activeRoom, user.id) : null;

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
              const partner = getPartnerInfo(room, user.id); 

              return (
                <Link 
                  to={`/chat/${room.id}`} 
                  key={room.id}
                  // [MỚI] Thêm 'group' để xử lý hover cho nút xóa
                  className={`flex gap-3 p-4 hover:bg-bgMain transition-colors border-b border-gray-50 relative group ${roomId === room.id ? 'bg-primary/5 border-l-4 border-l-primary' : ''}`}
                >
                  <div className={`w-12 h-12 rounded-full overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-200 ${partner.isProductAvatar ? 'rounded-lg' : ''}`}>
                    <img 
                        src={partner.avatar || DEFAULT_AVATAR} 
                        alt="" 
                        className="w-full h-full object-cover" 
                        onError={(e) => handleImageError(e, DEFAULT_AVATAR)}
                    />
                  </div>
                  <div className="flex-1 min-w-0 pr-6"> {/* Thêm padding phải để tránh chữ đè lên nút xóa */}
                    <div className="flex items-center justify-between gap-2">
                        <h3 className={`text-sm truncate ${isUnread ? 'font-black text-textMain' : 'font-bold text-gray-700'}`}>{partner.name}</h3>
                        <span className="text-[10px] text-gray-300 whitespace-nowrap">{formatTimeAgo(room.lastUpdate)}</span>
                    </div>
                    <p className="text-[10px] text-gray-500 truncate font-medium bg-gray-100 px-1.5 py-0.5 rounded w-fit max-w-full mt-0.5">
                        {room.listingTitle}
                    </p>
                    <p className={`text-xs truncate mt-1 ${isUnread ? 'font-black text-primary' : 'text-gray-400'}`}>
                      {room.lastMessage || 'Bắt đầu cuộc trò chuyện'}
                    </p>
                  </div>
                  
                  {isUnread && (
                    <div className="absolute top-1/2 -translate-y-1/2 right-2 w-2.5 h-2.5 bg-primary rounded-full shadow-sm group-hover:opacity-0 transition-opacity"></div>
                  )}

                  {/* [MỚI] NÚT XÓA PHÒNG CHAT */}
                  <button
                    onClick={(e) => handleDeleteRoom(e, room.id)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-white border border-gray-200 text-gray-400 hover:text-red-500 hover:bg-red-50 hover:border-red-200 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-all z-20"
                    title="Xóa cuộc trò chuyện"
                  >
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </Link>
              );
            })
          ) : (
            <div className="p-10 text-center text-gray-400">Bạn chưa có tin nhắn nào</div>
          )}
        </div>
      </aside>

      {/* Main Chat Area - Phần này giữ nguyên như cũ */}
      <main className={`flex-1 flex flex-col min-w-0 ${!roomId ? 'hidden md:flex' : 'flex'}`}>
        {activeRoom && activePartner ? (
          <>
            {/* Header */}
            <div className="p-3 md:p-4 border-b border-borderMain flex items-center justify-between bg-white z-10">
              <div className="flex items-center gap-3">
                <Link to="/chat" className="md:hidden p-1 -ml-1 text-gray-400 hover:text-primary">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/></svg>
                </Link>
                <div className={`w-10 h-10 overflow-hidden border border-borderMain ${activePartner.isProductAvatar ? 'rounded-lg' : 'rounded-full'}`}>
                  <img 
                    src={activePartner.avatar || DEFAULT_AVATAR} 
                    alt="" 
                    className="w-full h-full object-cover" 
                    onError={(e) => handleImageError(e, DEFAULT_AVATAR)}
                  />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold leading-none truncate max-w-[150px] md:max-w-xs">{activePartner.name}</h3>
                  <p className="text-[10px] text-gray-500 font-medium truncate max-w-[200px] flex items-center gap-1 mt-1">
                    <span>🛒</span> {activeRoom.listingTitle} • <span className="text-primary font-bold">{formatPrice(activeRoom.listingPrice)}</span>
                  </p>
                </div>
              </div>
              
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
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50 overscroll-contain">
              {activeRoom.messages.length > 0 ? (
                activeRoom.messages.map((msg, index) => {
                   const isMe = msg.senderId === user.id;
                   const showAvatar = !isMe && (index === 0 || activeRoom.messages[index - 1].senderId !== msg.senderId);
                   
                   return (
                      <div key={msg.id} className={`flex gap-2 group items-center ${isMe ? 'justify-end' : 'justify-start'}`}>
                        {!isMe && (
                            <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 self-end mb-1 border border-gray-200 bg-white">
                                {showAvatar ? (
                                    <img 
                                        src={activePartner.avatar || DEFAULT_AVATAR} 
                                        className="w-full h-full object-cover" 
                                        alt="" 
                                        onError={(e) => handleImageError(e, DEFAULT_AVATAR)}
                                    />
                                ) : <div className="w-8"></div>}
                            </div>
                        )}

                        {isMe && (
                            <button 
                                onClick={() => handleDeleteMessage(msg.id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full"
                                title="Thu hồi tin nhắn"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
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

            {/* Input Form */}
            <form onSubmit={handleSendMessage} className="p-3 md:p-4 bg-white border-t border-borderMain">
              <div className="flex gap-2 items-end bg-gray-100 p-1.5 rounded-[1.5rem]">
                <input 
                  type="text" 
                  placeholder={`Nhắn cho ${activePartner.name}...`}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onFocus={() => {
                      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 300);
                  }}
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
