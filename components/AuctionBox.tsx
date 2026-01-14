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
  const [isEnded, setIsEnded] = useState(false);
  const [bidAmount, setBidAmount] = useState<number>(0);
  const [isBidding, setIsBidding] = useState(false);

  // --- LOGIC TÍNH TOÁN ---
  const currentPrice = listing.price || 0;
  const step = listing.bidIncrement || 50000;
  const minValidBid = currentPrice + step;
  
  // Kiểm tra chủ sở hữu
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

  // 2. Đồng hồ đếm ngược
  useEffect(() => {
    const calculateTimeLeft = () => {
      const end = new Date(listing.auctionEndAt || "").getTime();
      const now = new Date().getTime();
      const distance = end - now;

      if (distance < 0) {
        setIsEnded(true);
        setTimeLeft("ĐÃ KẾT THÚC");
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
  }, [listing.auctionEndAt]);

  // --- HÀM XỬ LÝ ĐẶT GIÁ ---
  const handlePlaceBid = async () => {
    if (!user) {
        if(window.confirm("Bạn cần đăng nhập để tham gia đấu giá.")) {
            navigate('/login');
        }
        return;
    }

    if (isOwner) return alert("Bạn không thể tự đấu giá sản phẩm của mình!");
    if (isEnded) return alert("Phiên đấu giá đã kết thúc.");
    if (bidAmount < minValidBid) return alert(`Giá đặt phải tối thiểu là ${formatPrice(minValidBid)}`);

    if (!window.confirm(`Xác nhận đặt giá: ${formatPrice(bidAmount)}?`)) return;

    setIsBidding(true);
    try {
        const result = await db.placeBid(listing.id, user.id, bidAmount);
        await db.notifyBidSuccess({ ...result, id: listing.id }, user.id, bidAmount);
        alert("🎉 Đặt giá thành công!");
    } catch (error: any) {
        console.error(error);
        alert(error.message || "Lỗi khi đặt giá.");
    } finally {
        setIsBidding(false);
    }
  };

  return (
    <div className="bg-white border-2 border-indigo-100 rounded-[2rem] p-6 shadow-xl relative overflow-hidden">
      
      {/* Header */}
      <div className="text-center mb-8 relative z-10">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
            {isEnded ? "Trạng thái" : "Thời gian còn lại"}
        </p>
        <div className={`text-3xl md:text-4xl font-black tracking-tight ${isEnded ? 'text-red-500' : 'text-slate-800'}`}>
          {timeLeft}
        </div>
        {isEnded && bids.length > 0 && (
            <div className="mt-2 inline-block bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-bold uppercase">
                👑 Người thắng: {bids[0].userName}
            </div>
        )}
      </div>

      {/* Box đặt giá */}
      <div className="bg-slate-50 rounded-2xl p-5 mb-6 border border-slate-200 relative z-10">
        <div className="flex justify-between items-end mb-4">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Giá hiện tại</span>
          <span className="text-2xl font-black text-blue-600">{formatPrice(currentPrice)}</span>
        </div>
        
        {/* Logic hiển thị: Nếu Hết giờ -> Báo hết. Nếu là Chủ -> Báo chủ. Nếu Khách -> Hiện Input */}
        {isEnded ? (
            <div className="text-center py-3 bg-gray-200 rounded-xl font-bold text-gray-500 uppercase text-sm">
                ⛔️ Đã chốt sổ
            </div>
        ) : isOwner ? (
            <div className="text-center py-3 bg-yellow-50 border border-yellow-200 rounded-xl font-bold text-yellow-700 uppercase text-xs flex flex-col items-center justify-center gap-1">
                <span className="text-xl">🏠</span>
                Đây là sản phẩm của bạn
            </div>
        ) : (
          <div className="space-y-3">
             <div className="flex gap-2 items-center">
                 <input 
                   type="number" 
                   value={bidAmount}
                   onChange={(e) => setBidAmount(Number(e.target.value))}
                   className="flex-1 w-full bg-white border-2 border-indigo-100 rounded-xl px-4 py-3 font-bold text-slate-800 focus:border-blue-500 focus:ring-0 outline-none text-lg transition-all"
                 />
                 <button 
                   onClick={handlePlaceBid}
                   disabled={isBidding}
                   className="shrink-0 bg-blue-600 text-white font-black px-6 py-3.5 rounded-xl hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-200 uppercase text-sm tracking-wide whitespace-nowrap"
                 >
                   {isBidding ? '...' : 'ĐẤU GIÁ'}
                 </button>
             </div>
             <p className="text-[10px] text-center text-slate-400 font-bold">
                Bước giá tối thiểu: +{formatPrice(step)}
             </p>
          </div>
        )}
      </div>

      {/* Lịch sử đấu giá */}
      <div className="relative z-10">
        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
          <span>🔨 Lịch sử đấu giá</span>
          <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[9px]">{bids.length} lượt</span>
        </h4>
        
        <div className="max-h-48 overflow-y-auto pr-1 space-y-2 no-scrollbar">
          {bids.length > 0 ? bids.map((bid, index) => (
            <div key={bid.id} className={`flex items-center justify-between p-3 rounded-xl border ${index === 0 ? 'bg-yellow-50 border-yellow-200 shadow-sm' : 'bg-white border-slate-50'}`}>
              <div className="flex items-center gap-3">
                <div className="relative">
                    <img src={bid.userAvatar || "https://placehold.co/50"} className="w-8 h-8 rounded-full object-cover border border-white shadow-sm" alt="User" />
                    {index === 0 && <span className="absolute -top-2 -right-1 text-xs">👑</span>}
                </div>
                <div>
                  <p className={`text-xs font-bold ${index === 0 ? 'text-slate-900' : 'text-slate-600'}`}>
                      {bid.userName} {user?.id === bid.userId && <span className="text-[9px] text-blue-500">(Bạn)</span>}
                  </p>
                  <p className="text-[9px] text-slate-400 font-medium">{formatTimeAgo(bid.createdAt)}</p>
                </div>
              </div>
              <span className={`text-sm font-black ${index === 0 ? 'text-orange-600' : 'text-slate-500'}`}>
                {formatPrice(bid.amount)}
              </span>
            </div>
          )) : (
            <div className="text-center py-8 opacity-40">
                <div className="text-3xl mb-2">👋</div>
                <p className="text-xs font-bold">Chưa có ai trả giá.<br/>Hãy là người đầu tiên!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuctionBox;