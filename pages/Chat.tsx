import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { ChatRoom, User, Message } from '../types';
import { formatPrice, formatTimeAgo, getListingUrl } from '../utils/format';
import { getLocationFromCoords } from '../utils/locationHelper';

const DEFAULT_AVATAR = "https://ui-avatars.com/api/?background=random&color=fff&name=User";

// --- ICON SVG ---
const IconImage = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>;
const IconMapPin = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>;
const IconSend = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;
const IconLoader = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>;

const QUICK_REPLIES = [
  "Sản phẩm này còn không bạn?",
  "Hàng chuẩn như hình không ạ?",
  "Bạn cho mình xin địa chỉ xem hàng nhé.",
  "Giá này có bớt thêm được không?"
];

const Chat: React.FC<{ user: User | null }> = ({ user }) => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  
  // Cache thông tin partner để tránh giật lag
  const [fetchedPartners, setFetchedPartners] = useState<Record<string, { name: string, avatar: string }>>({});
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>, fallback: string) => {
    e.currentTarget.src = fallback;
    e.currentTarget.onerror = null;
  };

  // 1. Load Rooms (Realtime)
  useEffect(() => {
    if (user) {
      const unsubscribe = db.getChatRooms(user.id, (loadedRooms) => {
        setRooms(loadedRooms);
      });
      return () => unsubscribe();
    }
  }, [user]);

  // 2. Fetch missing partner info (Tối ưu performance)
  useEffect(() => {
    if (!user || rooms.length === 0) return;
    const idsToFetch: string[] = [];
    rooms.forEach(room => {
        const partnerId = room.participantIds?.find(id => id !== user.id);
        if (partnerId && (!room.participantsData || !room.participantsData[partnerId]) && !fetchedPartners[partnerId]) {
            idsToFetch.push(partnerId);
        }
    });

    if (idsToFetch.length > 0) {
        Promise.all(idsToFetch.map(id => db.getUserById(id).then(u => ({ id, u }))))
            .then(results => {
                const newPartners: Record<string, any> = {};
                results.forEach(({ id, u }) => {
                    if (u) newPartners[id] = { name: u.name, avatar: u.avatar };
                });
                if (Object.keys(newPartners).length > 0) {
                    setFetchedPartners(prev => ({ ...prev, ...newPartners }));
                }
            });
    }
  }, [rooms, user]); // Bỏ fetchedPartners ra khỏi dependency để tránh lặp vô hạn

  // 3. Load Active Room & Mark as Seen
  useEffect(() => {
    const loadActiveRoom = async () => {
      if (user && roomId) {
        const existingRoom = rooms.find(r => r.id === roomId);
        if (existingRoom) {
          setActiveRoom(existingRoom);
          if (!existingRoom.seenBy?.includes(user.id)) {
              db.markRoomAsSeen(roomId, user.id);
          }
        } else {
          // Fallback nếu chưa có trong list (vừa tạo)
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

  // Auto scroll xuống cuối khi có tin nhắn mới
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeRoom?.messages]);

  // --- HANDLERS ---

  // Gửi Text
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
        setMessage(textToSend); // Hoàn lại nếu lỗi
        alert("Gửi thất bại, vui lòng kiểm tra mạng.");
    }
  };

  // Gửi Ảnh (Logic mới)
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !activeRoom || !user) return;

      setIsSending(true);
      try {
          const imageUrl = await db.uploadChatImage(file);
          await db.addMessage(activeRoom.id, {
              senderId: user.id,
              text: 'Đã gửi một ảnh',
              type: 'image',
              imageUrl: imageUrl
          });
      } catch (error) {
          console.error(error);
          alert("Lỗi tải ảnh lên.");
      } finally {
          setIsSending(false);
          if(fileInputRef.current) fileInputRef.current.value = '';
      }
  };

  // Gửi Vị trí (Logic mới)
  const handleSendLocation = () => {
      if (!navigator.geolocation) return alert("Trình duyệt không hỗ trợ vị trí");
      if (!activeRoom || !user) return;

      setIsSending(true);
      navigator.geolocation.getCurrentPosition(async (pos) => {
          try {
              const { latitude, longitude } = pos.coords;
              const locInfo = await getLocationFromCoords(latitude, longitude);
              await db.addMessage(activeRoom.id, {
                  senderId: user.id,
                  text: `📍 Vị trí: ${locInfo.address}`,
                  type: 'location',
                  location: { lat: latitude, lng: longitude, address: locInfo.address }
              });
          } catch (e) {
              alert("Không lấy được vị trí.");
          } finally {
              setIsSending(false);
          }
      }, () => {
          setIsSending(false);
          alert("Vui lòng cấp quyền vị trí.");
      });
  };

  const handleSendQuickReply = async (text: string) => {
    if (!activeRoom || !user) return;
    db.addMessage(activeRoom.id, { senderId: user.id, text, type: 'text' });
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!activeRoom || !window.confirm("Thu hồi tin nhắn này?")) return;
    try { await db.deleteMessage(activeRoom.id, messageId); } catch (error) {}
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
    if (!window.confirm(`Bạn muốn ${status === 'accepted' ? 'ĐỒNG Ý' : 'TỪ CHỐI'} giá này?`)) return;
    try {
        const result = await db.respondToOffer(offerId, status, activeRoom.id);
        if (!result.success) alert("Lỗi: " + result.message);
    } catch (error) { alert("Lỗi kết nối."); }
  };

  const handleRespondSwap = async (messageId: string, status: 'accepted' | 'rejected') => {
    if (!activeRoom || !messageId) return;
    if (!window.confirm(`Bạn muốn ${status === 'accepted' ? 'ĐỒNG Ý' : 'TỪ CHỐI'} đổi đồ?`)) return;
    try {
        const result = await db.respondToSwap(activeRoom.id, messageId, status);
        if (!result.success) alert("Lỗi: " + result.message);
    } catch (e) { alert("Lỗi kết nối."); }
  };

  const getPartnerInfo = (room: any, currentUserId: string) => {
    const partnerId = room.participantIds?.find((id: string) => id !== currentUserId) || '';
    if (room.participantsData && room.participantsData[partnerId]) {
        return { name: room.participantsData[partnerId].name, avatar: room.participantsData[partnerId].avatar, isProductAvatar: false };
    }
    if (fetchedPartners[partnerId]) {
        return { name: fetchedPartners[partnerId].name, avatar: fetchedPartners[partnerId].avatar, isProductAvatar: false };
    }
    return { name: room.listingTitle || "Người dùng", avatar: room.listingImage || DEFAULT_AVATAR, isProductAvatar: true };
  };

  // --- RENDER COMPONENT CON ---
  const renderMessageContent = (msg: Message, isMe: boolean) => {
      switch (msg.type) {
          case 'image':
              return (
                  <div className="rounded-2xl overflow-hidden border border-gray-200 mt-1 max-w-[200px] shadow-sm">
                      <img src={msg.imageUrl} alt="Sent" className="w-full h-auto cursor-pointer hover:opacity-90 transition-opacity" onClick={() => window.open(msg.imageUrl, '_blank')} />
                  </div>
              );
          case 'location':
              return (
                  <a 
                    href={`https://www.google.com/maps?q=${msg.location?.lat},${msg.location?.lng}`} 
                    target="_blank" 
                    rel="noreferrer"
                    className={`block p-3 rounded-2xl border mt-1 max-w-[220px] transition-colors ${isMe ? 'bg-primary/10 border-primary/20' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
                  >
                      <div className="flex items-center gap-2 mb-1">
                          <span className="text-red-500"><IconMapPin /></span>
                          <span className="text-xs font-black uppercase text-gray-500">Vị trí hiện tại</span>
                      </div>
                      <p className="text-xs font-bold text-gray-800 line-clamp-2">{msg.location?.address || "Xem trên bản đồ"}</p>
                  </a>
              );
          case 'offer':
               return (
                <div className="bg-white border-2 border-green-100 rounded-2xl p-4 shadow-sm w-64 space-y-3">
                    <div className="flex items-center gap-2 border-b border-green-50 pb-2">
                        <span className="text-xl">💸</span><span className="font-black text-xs text-green-700 uppercase">Lời mặc cả</span>
                    </div>
                    <div className="text-center py-2">
                        <p className="text-[10px] text-gray-400 font-bold uppercase">Khách trả giá</p>
                        <p className="text-2xl font-black text-green-600">{msg.text.match(/[\d,.]+/)?.[0]} <span className="text-xs text-gray-400">VNĐ</span></p>
                    </div>
                    {!isMe && msg.offerId && (
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => handleRespondOffer(msg.offerId!, 'rejected')} className="py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-xs rounded-xl">Từ chối</button>
                            <button onClick={() => handleRespondOffer(msg.offerId!, 'accepted')} className="py-2 bg-green-500 hover:bg-green-600 text-white font-bold text-xs rounded-xl shadow-lg">Đồng ý</button>
                        </div>
                    )}
                    {isMe && <div className="text-center text-[10px] text-gray-400 italic bg-gray-50 py-1 rounded-lg">Đang chờ người bán phản hồi...</div>}
                </div>
               );
          case 'swap':
              const status = msg.swapData?.status;
              const isPending = !status;
              return (
                 <div className={`bg-white border-2 rounded-2xl p-4 shadow-sm w-72 space-y-3 relative overflow-hidden ${status === 'accepted' ? 'border-green-500 bg-green-50' : (status === 'rejected' ? 'border-gray-200 opacity-75' : 'border-purple-100')}`}>
                    <div className="flex items-center gap-2 border-b border-black/5 pb-2 relative z-10">
                        <span className="text-xl">{status === 'accepted' ? '✅' : (status === 'rejected' ? '❌' : '🔄')}</span>
                        <span className={`font-black text-xs uppercase ${status === 'accepted' ? 'text-green-700' : (status === 'rejected' ? 'text-gray-500' : 'text-purple-700')}`}>{status === 'accepted' ? 'Giao kèo thành công' : (status === 'rejected' ? 'Đã từ chối' : 'Đề nghị đổi đồ')}</span>
                    </div>
                    <div className="relative z-10"><p className="text-sm font-bold text-purple-700">Đổi: {msg.swapData?.offeredItemName}</p></div>
                    {!isMe && isPending && (
                        <div className="grid grid-cols-2 gap-2 relative z-10">
                            <button onClick={() => handleRespondSwap(msg.id, 'rejected')} className="py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-xs rounded-xl">Từ chối</button>
                            <button onClick={() => handleRespondSwap(msg.id, 'accepted')} className="py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-lg">Đồng ý</button>
                        </div>
                    )}
                 </div>
              );
          default:
              return (
                  <div className={`px-4 py-2.5 rounded-2xl text-sm shadow-sm leading-relaxed ${isMe ? 'bg-primary text-white rounded-br-sm' : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm'}`}>
                      {msg.text}
                  </div>
              );
      }
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
                       room.lastMessage?.includes('📍') ? '📍 Vị trí' :
                       (room.lastMessage || 'Bắt đầu cuộc trò chuyện')}
                    </p>
                  </div>
                  {isUnread && <div className="absolute top-1/2 -translate-y-1/2 right-2 w-2.5 h-2.5 bg-primary rounded-full shadow-sm group-hover:opacity-0 transition-opacity"></div>}
                  <button onClick={(e) => handleDeleteRoom(e, room.id)} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-white border border-gray-200 text-gray-400 hover:text-red-500 hover:bg-red-50 hover:border-red-200 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-all z-20">✕</button>
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
                            {renderMessageContent(msg, isMe)}
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
                    <button key={idx} onClick={() => handleSendQuickReply(text)} className="bg-gray-100 hover:bg-primary/10 hover:text-primary text-[10px] font-black uppercase px-4 py-2 rounded-full border border-gray-200 transition-all active:scale-95 shadow-sm">
                        {text}
                    </button>
                ))}
            </div>

            {/* Input Form [NÂNG CẤP] */}
            <form onSubmit={handleSendMessage} className="p-3 md:p-4 bg-white border-t border-borderMain">
              <div className="flex gap-2 items-end bg-gray-100 p-1.5 rounded-[1.5rem]">
                {/* Image Upload Button */}
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isSending} className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-full transition-all">
                    <IconImage />
                </button>
                <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />

                {/* Location Button */}
                <button type="button" onClick={handleSendLocation} disabled={isSending} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all">
                    <IconMapPin />
                </button>

                <input type="text" placeholder={isSending ? "Đang gửi..." : `Nhắn cho ${activePartner.name}...`} value={message} onChange={(e) => setMessage(e.target.value)} onFocus={() => setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 300)} className="flex-1 bg-transparent border-none focus:ring-0 px-2 py-2 text-sm font-medium max-h-24" />
                
                <button type="submit" disabled={!message.trim() && !isSending} className="w-9 h-9 bg-primary text-white rounded-full flex items-center justify-center shadow-md disabled:opacity-50 disabled:shadow-none hover:scale-105 transition-transform">
                  {isSending ? <IconLoader /> : <IconSend />}
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