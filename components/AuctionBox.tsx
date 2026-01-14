import React, { useState, useEffect, useRef } from 'react';
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
  const [bids, setBids] = useState<Bid[]>([]);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isEnded, setIsEnded] = useState(listing.status === 'sold');
  const [bidAmount, setBidAmount] = useState<number>(0);
  const [isBidding, setIsBidding] = useState(false);
  
  // Ref để đảm bảo hàm chốt đơn chỉ chạy 1 lần duy nhất trong 1 phiên làm việc
  const finalizeLock = useRef(false);

  // 1. Hàm thực hiện chốt đơn và gửi tin nhắn tự động
  const runFinalize = async (winner: Bid) => {
    if (finalizeLock.current || listing.status === 'sold') return;
    finalizeLock.current = true;

    try {
      console.log("🔔 Đang tự động chốt đơn cho người thắng:", winner.userName);
      
      // Cập nhật trạng thái tin đăng sang 'sold'
      await db.updateListingStatus(listing.id, 'sold');

      // Tạo phòng chat
      const winnerUser = { id: winner.userId, name: winner.userName, avatar: winner.userAvatar } as User;
      const roomId = await db.createChatRoom(listing, winnerUser);

      // Gửi tin nhắn chúc mừng (Nhân danh người bán)
      // Sử dụng type 'text' để khớp với logic trong Chat.tsx của bạn
      await db.addMessage(roomId, {
        senderId: listing.sellerId,
        text: `🎉 CHÚC MỪNG! Bạn đã thắng đấu giá sản phẩm "${listing.title}" với mức giá ${formatPrice(winner.amount)}. Hãy trao đổi tại đây để nhận hàng nhé!`,
        type: 'text'
      });

      // Gửi thông báo hệ thống
      await db.sendNotification({
        userId: winner.userId,
        title: "🏆 BẠN ĐÃ THẮNG ĐẤU GIÁ!",
        message: `Chúc mừng bạn đã thắng "${listing.title}". Hãy kiểm tra tin nhắn ngay!`,
        type: 'success',
        link: `/chat/${roomId}`
      });

    } catch (error) {
      console.error("Lỗi chốt đơn tự động:", error);
      finalizeLock.current = false; // Mở khóa để thử lại nếu lỗi
    }
  };

  // 2. Lắng nghe Bids và Đếm ngược
  useEffect(() => {
    // A. Lấy danh sách Bid
    const unsubscribe = db.getBids(listing.id, (data) => {
      setBids(data);
      if (data.length > 0) {
        setBidAmount(data[0].amount + (listing.bidIncrement || 50000));
      } else {
        setBidAmount((listing.price || 0) + (listing.bidIncrement || 50000));
      }
    });

    // B. Bộ đếm ngược
    const timer = setInterval(() => {
      const end = new Date(listing.auctionEndAt || "").getTime();
      const now = new Date().getTime();
      const distance = end - now;

      if (distance <= 0) {
        clearInterval(timer);
        setTimeLeft("ĐÃ KẾT THÚC");
        setIsEnded(true);

        // NẾU HẾT GIỜ: Tự động chốt đơn nếu có người đấu giá
        if (bids.length > 0 && listing.status !== 'sold') {
            runFinalize(bids[0]);
        }
      } else {
        const d = Math.floor(distance / (1000 * 60 * 60 * 24));
        const h = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((distance % (1000 * 60)) / 1000);
        setTimeLeft(`${d}d ${h}h ${m}m ${s}s`);
      }
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, [listing.id, bids.length, listing.status]);

  const handlePlaceBid = async () => {
    if (!user) return navigate('/login');
    if (user.id === listing.sellerId) return alert("Bạn không thể tự đấu giá.");
    if (isEnded) return alert("Phiên đấu giá đã kết thúc.");
    
    const minBid = (listing.price || 0) + (listing.bidIncrement || 50000);
    if (bidAmount < minBid) return alert(`Giá tối thiểu là ${formatPrice(minBid)}`);

    setIsBidding(true);
    try {
      const result = await db.placeBid(listing.id, user.id, bidAmount);
      await db.notifyBidSuccess({ ...result, id: listing.id }, user.id, bidAmount);
    } catch (error: any) {
      alert(error.message || "Lỗi đấu giá.");
    } finally {
      setIsBidding(false);
    }
  };

  return (
    <div className="bg-white border-2 border-indigo-50 rounded-[2rem] p-5 shadow-lg overflow-hidden">
      
      {/* Header Thời gian - Gọn gàng */}
      <div className="text-center mb-5">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
            {isEnded ? "Trạng thái" : "Thời gian còn lại"}
        </p>
        <div className={`text-3xl font-black ${isEnded ? 'text-red-500' : 'text-slate-800'}`}>
          {timeLeft}
        </div>
        {isEnded && bids.length > 0 && (
            <div className="mt-2 inline-block bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wide">
                🏆 Người thắng: {bids[0].userName}
            </div>
        )}
      </div>

      {/* Giá hiện tại & Input */}
      <div className="bg-slate-50 rounded-2xl p-4 mb-5 border border-slate-100">
        <div className="flex justify-between items-end mb-3">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Giá hiện tại</span>
          <span className="text-2xl font-black text-blue-600">{formatPrice(listing.price)}</span>
        </div>
        
        {!isEnded ? (
          <div className="flex gap-2">
             <input 
               type="number" 
               value={bidAmount}
               onChange={(e) => setBidAmount(Number(e.target.value))}
               className="flex-1 min-w-0 bg-white border border-gray-200 rounded-xl px-3 py-2.5 font-bold text-sm outline-none focus:border-blue-500"
             />
             <button 
               onClick={handlePlaceBid}
               disabled={isBidding}
               className="bg-blue-600 text-white font-black px-4 py-2.5 rounded-xl text-xs uppercase hover:bg-blue-700 transition-all disabled:opacity-50"
             >
               {isBidding ? '...' : 'ĐẤU GIÁ'}
             </button>
          </div>
        ) : (
            <div className="text-center py-2.5 bg-gray-200 rounded-xl font-bold text-gray-500 uppercase text-[10px]">
                🔒 Đã chốt sổ
            </div>
        )}
      </div>

      {/* Lịch sử đấu giá - Max height 150px để không làm vỡ khung */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold text-slate-400 uppercase flex items-center justify-between px-1">
          <span>🔨 Lịch sử lượt trả</span>
          <span>{bids.length}</span>
        </p>
        <div className="max-h-[150px] overflow-y-auto pr-1 space-y-2 custom-scrollbar">
          {bids.length > 0 ? bids.map((bid, index) => (
            <div key={bid.id} className={`flex items-center justify-between p-2.5 rounded-xl border ${index === 0 ? 'bg-yellow-50 border-yellow-100' : 'bg-white border-slate-50'}`}>
              <div className="flex items-center gap-2 min-w-0">
                <img src={bid.userAvatar || DEFAULT_AVATAR} className="w-7 h-7 rounded-full object-cover border border-white" alt="" />
                <div className="min-w-0">
                  <p className="text-[11px] font-bold truncate">{bid.userName}</p>
                  <p className="text-[9px] text-slate-400">{formatTimeAgo(bid.createdAt)}</p>
                </div>
              </div>
              <span className={`text-xs font-black ${index === 0 ? 'text-orange-600' : 'text-slate-500'}`}>
                {formatPrice(bid.amount)}
              </span>
            </div>
          )) : (
            <div className="text-center py-4 text-[10px] font-bold text-slate-300 uppercase">Chưa có ai trả giá</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuctionBox;
