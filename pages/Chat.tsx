import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { ChatRoom, User, Message } from '../types';
import { formatPrice, formatTimeAgo, getListingUrl } from '../utils/format';

const DEFAULT_AVATAR = "https://ui-avatars.com/api/?background=random&color=fff&name=User";

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
  
  const [fetchedPartners, setFetchedPartners] = useState<Record<string, { name: string, avatar: string }>>({});
  
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>, fallback: string) => {
    e.currentTarget.src = fallback;
    e.currentTarget.onerror = null;
  };

  // 1. Load Rooms
  useEffect(() => {
    if (user) {
      const unsubscribe = db.getChatRooms(user.id, (loadedRooms) => {
        setRooms(loadedRooms);
      });
      return () => unsubscribe();
    }
  }, [user]);

  // 2. [FIX] Tối ưu Fetch missing partner info (Tránh render loop)
  useEffect(() => {
    if (!user || rooms.length === 0) return;

    // Lọc ra các ID cần fetch trước để tránh gọi setFetchedPartners nhiều lần
    const idsToFetch: string[] = [];
    
    rooms.forEach(room => {
        // [FIX] Thêm ?. để tránh crash nếu data lỗi
        const partnerId = room.participantIds?.find(id => id !== user.id);
        if (partnerId && (!room.participantsData || !room.participantsData[partnerId]) && !fetchedPartners[partnerId]) {
            idsToFetch.push(partnerId);
        }
    });

    if (idsToFetch.length > 0) {
        // Fetch song song tất cả các user thiếu
        Promise.all(idsToFetch.map(id => db.getUserById(id).then(u => ({ id, u }))))
            .then(results => {
                const newPartners: Record<string, any> = {};
                results.forEach(({ id, u }) => {
                    if (u) newPartners[id] = { name: u.name, avatar: u.avatar };
                });
                // Update state 1 lần duy nhất
                if (Object.keys(newPartners).length > 0) {
                    setFetchedPartners(prev => ({ ...prev, ...newPartners }));
                }
            });
    }
  }, [rooms, user]); // Bỏ fetchedPartners khỏi dependency để tránh loop

  // 3. Load Active Room & Mark as Seen
  useEffect(() => {
    const loadActiveRoom = async () => {
      if (user && roomId) {
        // Ưu tiên lấy từ state rooms (realtime)
        const existingRoom = rooms.find(r => r.id === roomId);
        
        if (existingRoom) {
          setActiveRoom(existingRoom);
          // [FIX] Chỉ gọi API markSeen nếu thực sự chưa xem (Tiết kiệm write DB)
          if (!existingRoom.seenBy?.includes(user.id)) {
             db.markRoomAsSeen(roomId, user.id);
          }
        } else {
          // Fallback: Fetch lẻ nếu chưa có trong list
          const room = await db.getChatRoom(roomId);
          if (room) {
             setActiveRoom(room);
             if (!room.seenBy?.includes(user.id)) {
                 db.markRoomAsSeen(roomId, user.id);
             }
          }
        }
      } else {
        setActiveRoom(null);
      }
    };
    loadActiveRoom();
  }, [roomId, user, rooms]); 

  // Auto scroll
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeRoom?.messages]); // Chỉ scroll khi messages thay đổi

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !activeRoom || !user) return;
    const textToSend = message;
    setMessage(''); 
    try {
        await db.addMessage(activeRoom.id, {
        senderId: user.id,
        text: textToSend,
        type: 'text'
        });
    } catch (error) {
        console.error("Lỗi gửi tin nhắn:", error);
        alert("Không thể gửi tin nhắn. Vui lòng thử lại.");
        setMessage(textToSend); // Hoàn lại tin nhắn nếu lỗi
    }
  };

  const handleSendQuickReply = async (text: string) => {
    if (!activeRoom || !user) return;
    try {
        await db.addMessage(activeRoom.id, {
        senderId: user.id,
        text: text,
        type: 'text'
        });
    } catch (error) {
        console.error(error);
    }
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
    try {
        const result = await db.respondToOffer(offerId, status, activeRoom.id);
        if (!result.success) alert("Lỗi: " + result.message);
    } catch (error) {
        alert("Lỗi kết nối server.");
    }
  };

  const handleRespondSwap = async (messageId: string, status: 'accepted' | 'rejected') => {
    if (!activeRoom || !messageId) return;
    if (!window.confirm(`Bạn có chắc muốn ${status === 'accepted' ? 'ĐỒNG Ý' : 'TỪ CHỐI'} lời đề nghị này?`)) return;
    try {
        const result = await db.respondToSwap(activeRoom.id, messageId, status);
        if (!result.success) {
            alert("Lỗi: " + result.message);
        }
    } catch (e) {
        console.error(e);
        alert("Lỗi kết nối.");
    }
  };

  // [FIX] Thêm optional chaining ?. và fallback an toàn
  const getPartnerInfo = (room: any, currentUserId: string) => {
    const partnerId = room.participantIds?.find((id: string) => id !== currentUserId) || '';
    
    // Ưu tiên 1: Data có sẵn trong room
    if (room.participantsData && room.participantsData[partnerId]) {
        return { name: room.participantsData[partnerId].name, avatar: room.participantsData[partnerId].avatar, isProductAvatar: false };
    }
    // Ưu tiên 2: Data đã fetch lẻ
    if (fetchedPartners[partnerId]) {
        return { name: fetchedPartners[partnerId].name, avatar: fetchedPartners[partnerId].avatar, isProductAvatar: false };
    }
    // Ưu tiên 3: Fallback lấy ảnh sản phẩm làm avatar
    return { name: room.listingTitle || "Người dùng", avatar: room.listingImage || DEFAULT_AVATAR, isProductAvatar: true };
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

  const renderSwapMessage = (msg: Message, isMe: boolean) => {
    const swapData = msg.swapData || {
        offeredItemName: "Sản phẩm đổi",
        offeredItemImage: DEFAULT_AVATAR,
        cashTopUp: 0,
        status: undefined
    };

    const status = swapData.status; 
    const isPending = !status;
    // [LOGIC] Chỉ người nhận (not me) mới được accept, VÀ status phải là pending
    const canRespond = !isMe && isPending;

    return (
        <div className={`bg-white border-2 rounded-2xl p-4 shadow-sm w-72 space-y-3 relative overflow-hidden ${status === 'accepted' ? 'border-green-500 bg-green-50' : (status === 'rejected' ? 'border-gray-200 opacity-75' : 'border-purple-100')}`}>
            <div className="flex items-center gap-2 border-b border-black/5 pb-2 relative z-10">
                <span className="text-xl">{status === 'accepted' ? '✅' : (status === 'rejected' ? '❌' : '🔄')}</span>
                <span className={`font-black text-xs uppercase ${status === 'accepted' ? 'text-green-700' : (status === 'rejected' ? 'text-gray-500' : 'text-purple-700')}`}>
                    {status === 'accepted' ? 'Giao kèo thành công' : (status === 'rejected' ? 'Đã từ chối' : 'Đề nghị đổi đồ')}
                </span>
            </div>
            
            {isPending && <div className="absolute -right-4 -top-4 w-20 h-20 bg-purple-50 rounded-full blur-2xl z-0"></div>}

            <div className="relative z-10">
                <div className="flex items-center gap-3 bg-white/60 p-2 rounded-xl border border-black/5">
                    <img src={swapData.offeredItemImage} className="w-12 h-12 rounded-lg object-cover bg-white" alt="" onError={(e) => handleImageError(e, DEFAULT_AVATAR)} />
                    <div className="min-w-0">
                        <p className="text-[9px] text-gray-400 font-bold uppercase">Đổi lấy món:</p>
                        <p className="text-xs font-bold text-gray-800 truncate">{swapData.offeredItemName}</p>
                    </div>
                </div>

                <div className="mt-3 text-center">
                    {swapData.cashTopUp > 0 ? (
                        <>
                            <p className="text-[10px] text-gray-400 font-bold uppercase">Bù thêm</p>
                            <p className="text-xl font-black text-purple-600">+{formatPrice(swapData.cashTopUp)}</p>
                        </>
                    ) : swapData.cashTopUp < 0 ? (
                        <>
                            <p className="text-[10px] text-gray-400 font-bold uppercase">Nhận lại</p>
                            <p className="text-xl font-black text-orange-500">+{formatPrice(Math.abs(swapData.cashTopUp))}</p>
                        </>
                    ) : (
                        <p className="text-xs font-bold text-gray-500 py-1">🤝 Trao đổi ngang giá</p>
                    )}
                </div>
            </div>

            {canRespond && (
                <div className="grid grid-cols-2 gap-2 relative z-10">
                    <button onClick={() => handleRespondSwap(msg.id, 'rejected')} className="py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-xs rounded-xl transition-colors">Từ chối</button>
                    <button onClick={() => handleRespondSwap(msg.id, 'accepted')} className="py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-200 transition-colors">Đồng ý</button>
                </div>
            )}
            
            {!isPending && (
                <div className={`text-center text-[10px] font-bold uppercase py-1 rounded-lg ${status === 'accepted' ? 'text-green-600 bg-green-100' : 'text-red-500 bg-red-100'}`}>
                    {status === 'accepted' ? 'Hai bên đã chốt kèo' : 'Đề nghị đã bị hủy'}
                </div>
            )}
            
            {!canRespond && isPending && <div className="text-center text-[10px] text-gray-400 italic bg-gray-50 py-1 rounded-lg">Đang chờ phản hồi...</div>}
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
                      {room.lastMessage?.includes('💰') ? '💰 Có lời mặc cả mới' : 
                       room.lastMessage?.includes('🔄') ? '🔄 Có đề nghị đổi đồ' : 
                       (room.lastMessage || 'Bắt đầu cuộc trò chuyện')}
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
                            ) : msg.type === 'swap' ? (
                                renderSwapMessage(msg, isMe)
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

            {/* Quick Replies */}
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
