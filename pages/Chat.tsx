import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { ChatRoom, User, Message } from '../types';
import { formatPrice, formatTimeAgo, getListingUrl } from '../utils/format';

const DEFAULT_AVATAR = "https://ui-avatars.com/api/?background=random&color=fff&name=User";

// [BỔ SUNG] Danh sách tin nhắn mẫu để người dùng bấm nhanh
const QUICK_REPLIES = [
  "Sản phẩm này còn không bạn?",
  "Hàng chuẩn như hình không ạ?",
  "Bạn cho mình xin địa chỉ xem hàng nhé.",
  "Sản phẩm còn mới bao nhiêu % vậy?",
  "Cảm ơn bạn, mình sẽ chốt đơn sớm.",
  "Giá này có bớt thêm được không?"
];

const Chat: React.FC<{ user: User | null }> = ({ user }) => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
  const [message, setMessage] = useState('');
  
  // State quản lý việc load thông tin đối tác
  const [fetchedPartners, setFetchedPartners] = useState<Record<string, { name: string, avatar: string }>>({});
  
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>, fallback: string) => {
    e.currentTarget.src = fallback;
    e.currentTarget.onerror = null;
  };

  // 1. Load Rooms (Giữ nguyên logic gốc)
  useEffect(() => {
    if (user) {
      const unsubscribe = db.getChatRooms(user.id, (loadedRooms) => {
        setRooms(loadedRooms);
      });
      return () => unsubscribe();
    }
  }, [user]);

  // 2. Fetch missing partner info (Giữ nguyên logic gốc)
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
                        [partnerId]: { name: partnerUser.name, avatar: partnerUser.avatar }
                    }));
                }
            } catch (err) { console.error(err); }
        }
    });
  }, [rooms, user, fetchedPartners]);

  // 3. Load Active Room (Giữ nguyên logic gốc)
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

  // Auto scroll
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeRoom?.messages]);

  // Gửi tin nhắn thường
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !activeRoom || !user) return;
    const textToSend = message;
    setMessage(''); 
    await db.addMessage(activeRoom.id, {
      senderId: user.id,
      text: textToSend,
      type: 'text'
    });
  };

  // [MỚI] Hàm gửi tin nhắn nhanh khi nhấn vào nút mẫu
  const handleSendQuickReply = async (text: string) => {
    if (!activeRoom || !user) return;
    await db.addMessage(activeRoom.id, {
      senderId: user.id,
      text: text,
      type: 'text'
    });
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!activeRoom || !window.confirm("Bạn có chắc muốn thu hồi tin nhắn này không?")) return;
    try { await db.deleteMessage(activeRoom.id, messageId); } catch (error) { alert("Lỗi xóa tin nhắn."); }
  };

  const handleDeleteRoom = async (e: React.MouseEvent, idToDelete: string) => {
    e.preventDefault(); e.stopPropagation();
    if (!window.confirm("Xóa cuộc trò chuyện này?")) return;
    try {
        await db.deleteChatRoom(idToDelete);
        if (roomId === idToDelete) { setActiveRoom(null); navigate('/chat'); }
    } catch (error) { alert("Lỗi xóa phòng chat."); }
  };

  const handleRespondOffer = async (offerId: string, status: 'accepted' | 'rejected') => {
    if (!activeRoom || !offerId) return;
    if (!window.confirm(`Bạn có chắc muốn ${status === 'accepted' ? 'ĐỒNG Ý' : 'TỪ CHỐI'} mức giá này?`)) return;
    const result = await db.respondToOffer(offerId, status, activeRoom.id);
    if (!result.success) alert("Lỗi: " + result.message);
  };

  const getPartnerInfo = (room: any, currentUserId: string) => {
    const partnerId = room.participantIds.find((id: string) => id !== currentUserId) || '';
    if (room.participantsData && room.participantsData[partnerId]) {
        return { name: room.participantsData[partnerId].name, avatar: room.participantsData[partnerId].avatar, isProductAvatar: false };
    }
    if (fetchedPartners[partnerId]) {
        return { name: fetchedPartners[partnerId].name, avatar: fetchedPartners[partnerId].avatar, isProductAvatar: false };
    }
    return { name: room.listingTitle, avatar: room.listingImage, isProductAvatar: true };
  };

  const renderOfferMessage = (msg: Message, isMe: boolean) => {
    const priceMatch = msg.text.match(/[\d,.]+/);
    const priceStr = priceMatch ? priceMatch[0] : "???";
    const canRespond = !isMe;

    return (
        <div className="bg-white border-2 border-green-100 rounded-2xl p-4 shadow-sm w-64 space-y-3">
            <div className="flex items-center gap-2 border-b border-green-50 pb-2">
                <span className="text-xl">💸</span>
                <span className="font-black text-xs text-green-700 uppercase">Lời mặc cả</span>
            </div>
            <div className="text-center py-2">
                <p className="text-[10px] text-gray-400 font-bold uppercase">Khách trả giá</p>
                <p className="text-2xl font-black text-green-600">{priceStr} <span className="text-xs text-gray-400">VNĐ</span></p>
            </div>
            {canRespond && msg.offerId && (
                <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => handleRespondOffer(msg.offerId!, 'rejected')} className="py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-xs rounded-xl transition-colors">Từ chối</button>
                    <button onClick={() => handleRespondOffer(msg.offerId!, 'accepted')} className="py-2 bg-green-500 hover:bg-green-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-green-200 transition-colors">Đồng ý</button>
                </div>
            )}
            {!canRespond && <div className="text-center text-[10px] text-gray-400 italic bg-gray-50 py-1 rounded-lg">Đang chờ phản hồi...</div>}
        </div>
    );
  };

  if (!user) return <div className="p-10 text-center">Vui lòng đăng nhập để chat</div>;
  const activePartner = activeRoom ? getPartnerInfo(activeRoom, user.id) : null;

  return (
    <div className="bg-white border border-borderMain rounded-2xl h-[calc(100dvh-13rem)] md:h-[calc(100vh-140px)] flex overflow-hidden shadow-soft">
      
      {/* Sidebar */}
      <aside className={`w-full md:w-80 flex-shrink-0 border-r border-borderMain flex flex-col ${roomId ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-borderMain"><h2 className="font-bold text-lg">Tin nhắn</h2></div>
        <div className="flex-1 overflow-y-auto">
          {rooms.length > 0 ? (
            rooms.map(room => {
              const isUnread = room.messages.length > 0 && !room.seenBy?.includes(user.id);
              const partner = getPartnerInfo(room, user.id); 
              return (
                <Link to={`/chat/${room.id}`} key={room.id} className={`flex gap-3 p-4 hover:bg-bgMain transition-colors border-b border-gray-50 relative group ${roomId === room.id ? 'bg-primary/5 border-l-4 border-l-primary' : ''}`}>
                  <div className={`w-12 h-12 rounded-full overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-200 ${partner.isProductAvatar ? 'rounded-lg' : ''}`}>
                    <img src={partner.avatar || DEFAULT_AVATAR} alt="" className="w-full h-full object-cover" onError={(e) => handleImageError(e, DEFAULT_AVATAR)} />
                  </div>
                  <div className="flex-1 min-w-0 pr-6">
                    <div className="flex items-center justify-between gap-2">
                        <h3 className={`text-sm truncate ${isUnread ? 'font-black text-textMain' : 'font-bold text-gray-700'}`}>{partner.name}</h3>
                        <span className="text-[10px] text-gray-300 whitespace-nowrap">{formatTimeAgo(room.lastUpdate)}</span>
                    </div>
                    <p className="text-[10px] text-gray-500 truncate font-medium bg-gray-100 px-1.5 py-0.5 rounded w-fit max-w-full mt-0.5">{room.listingTitle}</p>
                    <p className={`text-xs truncate mt-1 ${isUnread ? 'font-black text-primary' : 'text-gray-400'}`}>
                      {room.lastMessage?.includes('💰') ? '💰 Có lời mặc cả mới' : (room.lastMessage || 'Bắt đầu cuộc trò chuyện')}
                    </p>
                  </div>
                  {isUnread && <div className="absolute top-1/2 -translate-y-1/2 right-2 w-2.5 h-2.5 bg-primary rounded-full shadow-sm group-hover:opacity-0 transition-opacity"></div>}
                  <button onClick={(e) => handleDeleteRoom(e, room.id)} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-white border border-gray-200 text-gray-400 hover:text-red-500 hover:bg-red-50 hover:border-red-200 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-all z-20">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </Link>
              );
            })
          ) : <div className="p-10 text-center text-gray-400">Bạn chưa có tin nhắn nào</div>}
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className={`flex-1 flex flex-col min-w-0 ${!roomId ? 'hidden md:flex' : 'flex'}`}>
        {activeRoom && activePartner ? (
          <>
            {/* Header */}
            <div className="p-3 md:p-4 border-b border-borderMain flex items-center justify-between bg-white z-10">
              <div className="flex items-center gap-3">
                <Link to="/chat" className="md:hidden p-1 -ml-1 text-gray-400 hover:text-primary"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/></svg></Link>
                <div className={`w-10 h-10 overflow-hidden border border-borderMain ${activePartner.isProductAvatar ? 'rounded-lg' : 'rounded-full'}`}>
                  <img src={activePartner.avatar || DEFAULT_AVATAR} alt="" className="w-full h-full object-cover" onError={(e) => handleImageError(e, DEFAULT_AVATAR)} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold leading-none truncate max-w-[150px] md:max-w-xs">{activePartner.name}</h3>
                  <p className="text-[10px] text-gray-500 font-medium truncate max-w-[200px] flex items-center gap-1 mt-1"><span>🛒</span> {activeRoom.listingTitle} • <span className="text-primary font-bold">{formatPrice(activeRoom.listingPrice)}</span></p>
                </div>
              </div>
              {!activeRoom.listingId.startsWith('profile_') && (
                  <Link to={getListingUrl({ id: activeRoom.listingId, title: activeRoom.listingTitle } as any)} className="text-[10px] md:text-xs font-bold text-primary hover:underline bg-primary/5 px-3 py-1.5 rounded-lg whitespace-nowrap">Xem tin</Link>
              )}
            </div>

            {/* Messages List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50 overscroll-contain">
              {activeRoom.messages.length > 0 ? (
                activeRoom.messages.map((msg, index) => {
                   const isMe = msg.senderId === user.id;
                   const showAvatar = !isMe && (index === 0 || activeRoom.messages[index - 1].senderId !== msg.senderId);
                   
                   return (
                      <div key={msg.id} className={`flex gap-2 group items-end ${isMe ? 'justify-end' : 'justify-start'}`}>
                        {!isMe && (
                            <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 mb-1 border border-gray-200 bg-white">
                                {showAvatar && <img src={activePartner.avatar || DEFAULT_AVATAR} className="w-full h-full object-cover" alt="" onError={(e) => handleImageError(e, DEFAULT_AVATAR)} />}
                            </div>
                        )}
                        <div className={`relative max-w-[85%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                            {msg.type === 'offer' ? (
                                renderOfferMessage(msg, isMe)
                            ) : (
                                <div className={`px-4 py-2.5 rounded-2xl text-sm shadow-sm leading-relaxed ${isMe ? 'bg-primary text-white rounded-br-sm' : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm'}`}>
                                  {msg.text}
                                </div>
                            )}
                            <div className="flex items-center gap-1 mt-1 opacity-60">
                                {isMe && (
                                    <button onClick={() => handleDeleteMessage(msg.id)} className="text-[9px] text-red-400 hover:underline mr-1 opacity-0 group-hover:opacity-100 transition-opacity">Thu hồi</button>
                                )}
                                <span className="text-[9px] text-gray-400 font-medium">
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        </div>
                      </div>
                   )
                })
              ) : (
                <div className="py-20 text-center text-gray-400 space-y-2"><div className="text-4xl animate-bounce">👋</div><p className="text-sm font-bold uppercase tracking-widest">Gửi lời chào tới {activePartner.name}!</p></div>
              )}
              <div ref={scrollRef} className="h-2" />
            </div>

            {/* [MỚI] Khối tin nhắn nhanh */}
            <div className="bg-white border-t border-borderMain/50 px-4 py-2 flex gap-2 overflow-x-auto no-scrollbar whitespace-nowrap">
                {QUICK_REPLIES.map((text, idx) => (
                    <button
                        key={idx}
                        onClick={() => handleSendQuickReply(text)}
                        className="bg-gray-100 hover:bg-primary/10 hover:text-primary text-[10px] font-black uppercase px-4 py-2 rounded-full border border-gray-200 transition-all active:scale-95 shadow-sm"
                    >
                        {text}
                    </button>
                ))}
            </div>

            {/* Input Form */}
            <form onSubmit={handleSendMessage} className="p-3 md:p-4 bg-white border-t border-borderMain">
              <div className="flex gap-2 items-end bg-gray-100 p-1.5 rounded-[1.5rem]">
                <input type="text" placeholder={`Nhắn cho ${activePartner.name}...`} value={message} onChange={(e) => setMessage(e.target.value)} onFocus={() => setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 300)} className="flex-1 bg-transparent border-none focus:ring-0 px-4 py-2 text-sm font-medium max-h-24" />
                <button type="submit" disabled={!message.trim()} className="w-9 h-9 bg-primary text-white rounded-full flex items-center justify-center shadow-md disabled:opacity-50 disabled:shadow-none hover:scale-105 transition-transform">
                  <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-300 space-y-4"><div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center text-4xl grayscale opacity-50">💬</div><p className="font-bold text-xs uppercase tracking-widest">Chọn hội thoại để xem</p></div>
        )}
      </main>
    </div>
  );
};

export default Chat;