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
  const finalizeLock = useRef(false);

  // 1. Hàm chốt đơn (Trigger gửi tin nhắn)
  const runFinalize = async (winner: Bid) => {
    if (finalizeLock.current || listing.status === 'sold') return;
    finalizeLock.current = true;

    try {
      await db.updateListingStatus(listing.id, 'sold');
      const winnerUser = { id: winner.userId, name: winner.userName, avatar: winner.userAvatar } as User;
      const roomId = await db.createChatRoom(listing, winnerUser);

      // Gửi tin nhắn tự động
      await db.addMessage(roomId, {
        senderId: listing.sellerId,
        text: `🎉 CHÚC MỪNG! Bạn đã thắng đấu giá sản phẩm "${listing.title}" với mức giá ${formatPrice(winner.amount)}. Hãy liên hệ tại đây để nhận hàng!`,
        type: 'text'
      });

      await db.sendNotification({
        userId: winner.userId,
        title: "🏆 THẮNG ĐẤU GIÁ!",
        message: `Bạn đã thắng phiên đấu giá "${listing.title}". Hãy kiểm tra tin nhắn ngay!`,
        type: 'success',
        link: `/chat/${roomId}`
      });
    } catch (error) {
      console.error("Lỗi chốt đơn:", error);
      finalizeLock.current = false;
    }
  };

  // 2. Logic đếm ngược và tự động chốt đơn
  useEffect(() => {
    const unsubscribe = db.getBids(listing.id, (data) => {
      setBids(data);
      const now = new Date().getTime();
      const end = new Date(listing.auctionEndAt || "").getTime();

      // [FIX PHẢN HỒI CHẬM] Tự động chốt ngay khi load nếu đã hết giờ
      if (now >= end && data.length > 0 && listing.status !== 'sold') {
          runFinalize(data[0]);
      }
      
      const minNextBid = (data[0]?.amount || listing.price || 0) + (listing.bidIncrement || 50000);
      setBidAmount(minNextBid);
    });

    const timer = setInterval(() => {
      const distance = new Date(listing.auctionEndAt || "").getTime() - new Date().getTime();

      if (distance <= 0) {
        clearInterval(timer);
        setTimeLeft("ĐÃ KẾT THÚC");
        setIsEnded(true);
        if (bids.length > 0 && listing.status !== 'sold') runFinalize(bids[0]);
      } else {
        const d = Math.floor(distance / (1000 * 60 * 60 * 24));
        const h = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((distance % (1000 * 60)) / 1000);
        setTimeLeft(`${d}d ${h}h ${m}m ${s}s`);
      }
    }, 1000);

    return () => { unsubscribe(); clearInterval(timer); };
  }, [listing.id, listing.status, bids.length]);

  const handlePlaceBid = async () => {
    if (!user) return navigate('/login');
    if (user.id === listing.sellerId) return alert("Không thể tự đấu giá!");
    const minBid = (bids[0]?.amount || listing.price || 0) + (listing.bidIncrement || 50000);
    if (bidAmount < minBid) return alert(`Giá tối thiểu: ${formatPrice(minBid)}`);

    setIsBidding(true);
    try {
      const res = await db.placeBid(listing.id, user.id, bidAmount);
      await db.notifyBidSuccess({ ...res, id: listing.id }, user.id, bidAmount);
    } catch (e: any) { alert(e.message); }
    finally { setIsBidding(false); }
  };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl md:rounded-[2.5rem] p-4 md:p-8 shadow-xl">
      {/* Header Thời Gian - Tự co giãn font chữ */}
      <div className="text-center mb-6">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Kết thúc sau</p>
        <div className={`text-2xl md:text-4xl font-black ${isEnded ? 'text-red-500' : 'text-slate-800'}`}>
          {timeLeft}
        </div>
        {isEnded && bids.length > 0 && (
          <div className="mt-2 inline-block bg-yellow-50 text-yellow-700 px-3 py-1 rounded-full text-[10px] font-bold">
            🏆 Người thắng: {bids[0].userName}
          </div>
        )}
      </div>

      {/* Khu vực Đấu giá - Tối ưu mobile */}
      <div className="bg-slate-50 rounded-xl md:rounded-3xl p-4 md:p-6 mb-6 border border-slate-100">
        <div className="flex justify-between items-center mb-4">
          <span className="text-[10px] md:text-xs font-bold text-slate-400 uppercase">Giá hiện tại</span>
          <span className="text-xl md:text-3xl font-black text-blue-600">{formatPrice(listing.price)}</span>
        </div>
        
        {!isEnded ? (
          <div className="flex flex-col sm:flex-row gap-2">
            <input 
              type="number" 
              value={bidAmount}
              onChange={(e) => setBidAmount(Number(e.target.value))}
              className="flex-1 bg-white border border-slate-200 rounded-lg md:rounded-2xl px-4 py-2 md:py-3.5 font-bold text-sm md:text-xl outline-none"
            />
            <button 
              onClick={handlePlaceBid} 
              disabled={isBidding}
              className="bg-blue-600 text-white font-black px-6 py-2 md:py-3.5 rounded-lg md:rounded-2xl hover:bg-blue-700 disabled:opacity-50 text-xs md:text-sm uppercase tracking-widest"
            >
              {isBidding ? '...' : 'ĐẤU GIÁ'}
            </button>
          </div>
        ) : (
          <div className="text-center py-3 bg-slate-200 rounded-lg font-bold text-slate-500 text-xs uppercase tracking-widest">
            🔒 Phiên đã chốt
          </div>
        )}
      </div>

      {/* Lịch sử - Giới hạn chiều cao để không vỡ khung */}
      <div className="px-1">
        <h4 className="text-[10px] font-bold uppercase text-slate-400 mb-3 flex justify-between">
          <span>🔨 Lịch sử lượt trả</span>
          <span>{bids.length} lượt</span>
        </h4>
        <div className="max-h-32 md:max-h-48 overflow-y-auto space-y-2 no-scrollbar">
          {bids.map((bid, index) => (
            <div key={bid.id} className={`flex items-center justify-between p-2 md:p-3 rounded-lg border ${index === 0 ? 'bg-yellow-50 border-yellow-100' : 'bg-white border-slate-50'}`}>
              <div className="flex items-center gap-2 min-w-0">
                <img src={bid.userAvatar} className="w-6 h-6 md:w-8 md:h-8 rounded-full object-cover" alt="" />
                <p className="text-[10px] md:text-xs font-bold truncate max-w-[80px] md:max-w-none">{bid.userName}</p>
              </div>
              <span className="text-[10px] md:text-sm font-black text-orange-600">{formatPrice(bid.amount)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AuctionBox;
