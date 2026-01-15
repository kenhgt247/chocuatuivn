import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Listing, User, Bid } from '../types';
import { db } from '../services/db';
import { formatPrice } from '../utils/format';

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

  const runFinalize = async (winner: Bid) => {
    if (finalizeLock.current || listing.status === 'sold') return;
    finalizeLock.current = true;
    try {
      await db.updateListingStatus(listing.id, 'sold');
      const winnerUser = { id: winner.userId, name: winner.userName, avatar: winner.userAvatar } as User;
      const roomId = await db.createChatRoom(listing, winnerUser);
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

  useEffect(() => {
    const unsubscribe = db.getBids(listing.id, (data) => {
      setBids(data);
      const now = new Date().getTime();
      const end = new Date(listing.auctionEndAt || "").getTime();
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
    <div className="w-full bg-white border border-gray-100 rounded-2xl md:rounded-[2rem] p-3 md:p-6 shadow-xl overflow-hidden">
      {/* Header Thời Gian */}
      <div className="text-center mb-4 md:mb-6">
        <p className="text-[9px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Kết thúc sau</p>
        <div className={`text-xl md:text-3xl font-black tabular-nums tracking-tight ${isEnded ? 'text-red-500' : 'text-slate-800'}`}>
          {timeLeft}
        </div>
        {isEnded && bids.length > 0 && (
          <div className="mt-2 inline-block bg-yellow-50 text-yellow-700 px-3 py-1 rounded-full text-[9px] md:text-[10px] font-bold">
            🏆 Thắng giải: {bids[0].userName}
          </div>
        )}
      </div>

      {/* Khu vực Đấu giá */}
      <div className="bg-slate-50 rounded-xl md:rounded-2xl p-3 md:p-4 mb-4 md:mb-6 border border-slate-100">
        <div className="flex justify-between items-center mb-3">
          <span className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase">Giá hiện tại</span>
          <span className="text-lg md:text-2xl font-black text-blue-600">{formatPrice(listing.price)}</span>
        </div>
        
        {!isEnded ? (
          <div className="flex flex-col gap-2">
            <div className="relative">
                <input 
                  type="number" 
                  value={bidAmount}
                  onChange={(e) => setBidAmount(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 rounded-lg md:rounded-xl px-3 py-2 md:py-3 font-bold text-sm md:text-lg outline-none focus:border-blue-500 transition-all"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none">VNĐ</span>
            </div>
            <button 
              onClick={handlePlaceBid} 
              disabled={isBidding}
              className="w-full bg-blue-600 text-white font-black py-2.5 md:py-3 rounded-lg md:rounded-xl hover:bg-blue-700 disabled:opacity-50 text-xs md:text-sm uppercase tracking-widest transition-all shadow-md active:scale-95"
            >
              {isBidding ? 'ĐANG XỬ LÝ...' : 'ĐẶT GIÁ THẦU'}
            </button>
          </div>
        ) : (
          <div className="text-center py-2.5 bg-slate-200 rounded-lg font-bold text-slate-500 text-[10px] md:text-xs uppercase tracking-widest">
            🔒 PHIÊN ĐÃ KẾT THÚC
          </div>
        )}
      </div>

      {/* Lịch sử lượt trả */}
      <div className="px-1">
        <h4 className="text-[9px] md:text-[10px] font-bold uppercase text-slate-400 mb-3 flex justify-between items-center border-b border-slate-50 pb-2">
          <span>🔨 Lịch sử</span>
          <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-500">{bids.length} lượt</span>
        </h4>
        <div className="max-h-32 md:max-h-40 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
          {bids.map((bid, index) => (
            <div key={bid.id} className={`flex items-center justify-between p-2 rounded-lg transition-all ${index === 0 ? 'bg-yellow-50/50 border border-yellow-100' : 'bg-white border border-transparent'}`}>
              <div className="flex items-center gap-2 min-w-0">
                <img src={bid.userAvatar} className="w-5 h-5 md:w-6 md:h-6 rounded-full object-cover shadow-sm" alt="" />
                <p className="text-[10px] md:text-xs font-bold truncate text-slate-700">{bid.userName}</p>
              </div>
              <span className="text-[10px] md:text-sm font-black text-orange-600 flex-shrink-0">{formatPrice(bid.amount)}</span>
            </div>
          ))}
          {bids.length === 0 && <p className="text-[10px] text-center text-slate-300 py-4 italic">Chưa có lượt trả giá nào</p>}
        </div>
      </div>
    </div>
  );
};

export default AuctionBox;