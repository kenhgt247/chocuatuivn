import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Listing, User, Bid } from '../types';
import { db } from '../services/db';
import { formatPrice, formatTimeAgo } from '../utils/format';

interface AuctionBoxProps {
  listing: Listing;
  user: User | null;
}

const AuctionBox: React.FC<AuctionBoxProps> = ({ listing, user }) => {
  const navigate = useNavigate();
  
  // --- STATE ---
  const [bids, setBids] = useState<Bid[]>([]);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isEnded, setIsEnded] = useState(listing.status === 'sold');
  const [bidAmount, setBidAmount] = useState<number>(0);
  const [isBidding, setIsBidding] = useState(false);

  // --- LOGIC TÍNH TOÁN ---
  const currentPrice = listing.price || 0;
  const step = listing.bidIncrement || 50000;
  const minValidBid = currentPrice + step;
  const isOwner = user?.id === listing.sellerId;

  // 1. Lắng nghe Bids Realtime
  useEffect(() => {
    if (typeof db.getBids !== 'function') return;
    const unsubscribe = db.getBids(listing.id, (data) => {
      setBids(data);
    });
    setBidAmount(minValidBid);
    return () => unsubscribe();
  }, [listing.id, listing.price]);

  // 2. Hàm Tự Động Chốt Đấu Giá
  const handleFinalizeAuction = async (winnerBid: Bid) => {
    try {
      // Chỉ chốt nếu tin chưa chuyển sang trạng thái sold
      if (listing.status === 'sold') return;

      // A. Cập nhật trạng thái tin đăng
      await db.updateListingStatus(listing.id, 'sold');

      // B. Tạo phòng chat giữa người bán và người thắng
      const winnerUser = {
        id: winnerBid.userId,
        name: winnerBid.userName,
        avatar: winnerBid.userAvatar
      } as User;

      const roomId = await db.createChatRoom(listing, winnerUser);

      // C. Gửi tin nhắn chốt đơn tự động (Nhân danh người bán)
      await db.addMessage(roomId, {
        senderId: listing.sellerId,
        text: `🎉 CHÚC MỪNG! Bạn đã thắng đấu giá sản phẩm "${listing.title}" với mức giá ${formatPrice(winnerBid.amount)}. Tôi sẽ liên hệ với bạn để giao dịch sớm nhất!`,
        type: 'text',
        isSystem: true
      });

      // D. Gửi thông báo hệ thống cho người thắng
      await db.sendNotification({
        userId: winnerBid.userId,
        title: "🏆 THẮNG ĐẤU GIÁ!",
        message: `Bạn đã thắng phiên đấu giá "${listing.title}". Kiểm tra tin nhắn ngay!`,
        type: 'success',
        link: `/chat/${roomId}`
      });

      console.log("✅ Đã tự động chốt đấu giá và gửi tin nhắn.");
    } catch (error) {
      console.error("Lỗi khi tự động chốt đấu giá:", error);
    }
  };

  // 3. Đồng hồ đếm ngược & Kích hoạt chốt đơn
  useEffect(() => {
    const calculateTimeLeft = () => {
      const end = new Date(listing.auctionEndAt || "").getTime();
      const now = new Date().getTime();
      const distance = end - now;

      if (distance <= 0) {
        if (!isEnded) {
          setIsEnded(true);
          setTimeLeft("ĐÃ KẾT THÚC");
          
          // Nếu có người đấu giá, người thắng là bids[0]
          if (bids.length > 0) {
            handleFinalizeAuction(bids[0]);
          }
        }
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`);
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [listing.auctionEndAt, bids, isEnded]);

  // --- HÀM XỬ LÝ ĐẶT GIÁ ---
  const handlePlaceBid = async () => {
    if (!user) {
      if(window.confirm("Vui lòng đăng nhập để đấu giá.")) navigate('/login');
      return;
    }
    if (isOwner) return alert("Bạn không thể tự đấu giá sản phẩm của mình.");
    if (isEnded) return alert("Phiên đấu giá đã kết thúc.");
    if (bidAmount < minValidBid) return alert(`Giá tối thiểu: ${formatPrice(minValidBid)}`);

    if (!window.confirm(`Xác nhận trả giá: ${formatPrice(bidAmount)}?`)) return;

    setIsBidding(true);
    try {
      const result = await db.placeBid(listing.id, user.id, bidAmount);
      await db.notifyBidSuccess({ ...result, id: listing.id }, user.id, bidAmount);
      alert("🎉 Trả giá thành công! Bạn đang dẫn đầu.");
    } catch (error: any) {
      alert(error.message || "Lỗi đấu giá.");
    } finally {
      setIsBidding(false);
    }
  };

  return (
    <div className="bg-white border-2 border-indigo-100 rounded-[2.5rem] p-6 shadow-2xl relative overflow-hidden">
      {/* Nền trang trí */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full blur-3xl -mr-10 -mt-10 opacity-60"></div>

      {/* Thời gian */}
      <div className="text-center mb-8 relative z-10">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
            {isEnded ? "Phiên đấu giá" : "Kết thúc sau"}
        </p>
        <div className={`text-3xl md:text-4xl font-black tracking-tighter ${isEnded ? 'text-red-500' : 'text-slate-800'}`}>
          {timeLeft}
        </div>
        {isEnded && bids.length > 0 && (
            <div className="mt-3 inline-flex items-center gap-2 bg-yellow-100 text-yellow-700 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm">
                <span>🏆</span> Người thắng: {bids[0].userName}
            </div>
        )}
      </div>

      {/* Đặt giá */}
      <div className="bg-slate-50 rounded-3xl p-6 mb-6 border border-slate-100 relative z-10">
        <div className="flex justify-between items-center mb-5">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Giá hiện tại</span>
          <span className="text-3xl font-black text-blue-600 tracking-tight">{formatPrice(currentPrice)}</span>
        </div>
        
        {isEnded ? (
            <div className="text-center py-4 bg-slate-200/50 rounded-2xl font-black text-slate-500 uppercase text-xs tracking-widest">
                🔒 Phiên đã đóng
            </div>
        ) : isOwner ? (
            <div className="text-center py-4 bg-yellow-50 border border-yellow-100 rounded-2xl font-bold text-yellow-600 uppercase text-[10px] tracking-wider">
                🏠 Sản phẩm của bạn
            </div>
        ) : (
          <div className="space-y-4">
             <div className="flex gap-2">
                 <input 
                   type="number" 
                   value={bidAmount}
                   onChange={(e) => setBidAmount(Number(e.target.value))}
                   className="flex-1 min-w-0 bg-white border-2 border-indigo-100 rounded-2xl px-5 py-3.5 font-black text-slate-800 focus:border-blue-500 outline-none text-xl shadow-inner"
                 />
                 <button 
                   onClick={handlePlaceBid}
                   disabled={isBidding}
                   className="shrink-0 bg-blue-600 text-white font-black px-8 py-3.5 rounded-2xl hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-blue-200 uppercase text-sm tracking-widest"
                 >
                   {isBidding ? '...' : 'ĐẤU'}
                 </button>
             </div>
             <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-tight">
                Bước giá tối thiểu: <span className="text-blue-500">+{formatPrice(step)}</span>
             </p>
          </div>
        )}
      </div>

      {/* Lịch sử */}
      <div className="relative z-10 px-1">
        <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-4 flex items-center justify-between">
          <span>🔨 Lịch sử lượt trả</span>
          <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[9px]">{bids.length}</span>
        </h4>
        
        <div className="max-h-52 overflow-y-auto space-y-2.5 no-scrollbar">
          {bids.length > 0 ? bids.map((bid, index) => (
            <div key={bid.id} className={`flex items-center justify-between p-3.5 rounded-2xl border ${index === 0 ? 'bg-yellow-50/50 border-yellow-200 shadow-sm' : 'bg-white border-slate-50'}`}>
              <div className="flex items-center gap-3">
                <div className="relative">
                    <img src={bid.userAvatar || "https://placehold.co/50"} className="w-9 h-9 rounded-xl object-cover border-2 border-white shadow-sm" alt="" />
                    {index === 0 && <span className="absolute -top-2.5 -right-2 text-base">👑</span>}
                </div>
                <div className="min-w-0">
                  <p className={`text-[11px] font-black truncate ${index === 0 ? 'text-slate-900' : 'text-slate-600'}`}>
                      {bid.userName} {user?.id === bid.userId && <span className="text-blue-500 ml-1">●</span>}
                  </p>
                  <p className="text-[9px] text-slate-400 font-bold uppercase">{formatTimeAgo(bid.createdAt)}</p>
                </div>
              </div>
              <span className={`text-sm font-black tracking-tight ${index === 0 ? 'text-orange-600' : 'text-slate-500'}`}>
                {formatPrice(bid.amount)}
              </span>
            </div>
          )) : (
            <div className="text-center py-10 opacity-30">
                <p className="text-xs font-black uppercase tracking-widest">Chưa có lượt trả giá</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuctionBox;
