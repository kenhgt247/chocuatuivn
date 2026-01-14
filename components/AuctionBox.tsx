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

  // 1. Hàm Tự Động Chốt Đấu Giá (Logic gửi tin nhắn)
  const handleFinalizeAuction = async (winnerBid: Bid) => {
    try {
      // Chỉ chốt nếu trạng thái hiện tại chưa phải là 'sold'
      if (listing.status === 'sold') return;

      console.log("🚀 Đang thực hiện chốt đơn tự động...");

      // A. Cập nhật trạng thái tin đăng sang 'sold'
      await db.updateListingStatus(listing.id, 'sold');

      // B. Tạo phòng chat giữa người bán và người thắng
      const winnerUser = {
        id: winnerBid.userId,
        name: winnerBid.userName,
        avatar: winnerBid.userAvatar
      } as User;

      const roomId = await db.createChatRoom(listing, winnerUser);

      // C. Gửi tin nhắn tự động (Nhân danh người bán)
      await db.addMessage(roomId, {
        senderId: listing.sellerId,
        text: `🎉 CHÚC MỪNG! Bạn đã thắng đấu giá sản phẩm "${listing.title}" với mức giá ${formatPrice(winnerBid.amount)}. Tôi sẽ liên hệ với bạn để giao dịch sớm nhất!`,
        type: 'text',
        isSystem: true
      });

      // D. Gửi thông báo thông qua quả chuông cho người thắng
      await db.sendNotification({
        userId: winnerBid.userId,
        title: "🏆 THẮNG ĐẤU GIÁ!",
        message: `Bạn đã thắng phiên đấu giá "${listing.title}". Kiểm tra tin nhắn ngay!`,
        type: 'success',
        link: `/chat/${roomId}`
      });

    } catch (error) {
      console.error("Lỗi khi tự động chốt đấu giá:", error);
    }
  };

  // 2. Lắng nghe Bids Realtime & [QUAN TRỌNG] Tự động chốt bù
  useEffect(() => {
    if (typeof db.getBids !== 'function') return;

    const unsubscribe = db.getBids(listing.id, (data) => {
      setBids(data);
      
      // LOGIC CHỐT BÙ: Nếu thấy đã hết giờ mà chưa được chốt 'sold'
      const now = new Date().getTime();
      const endTime = new Date(listing.auctionEndAt || "").getTime();

      if (now >= endTime && data.length > 0 && listing.status !== 'sold') {
          handleFinalizeAuction(data[0]);
      }
    });

    setBidAmount(minValidBid);
    return () => unsubscribe();
  }, [listing.id, listing.status, listing.auctionEndAt]);

  // 3. Đồng hồ đếm ngược
  useEffect(() => {
    const calculateTimeLeft = () => {
      const end = new Date(listing.auctionEndAt || "").getTime();
      const now = new Date().getTime();
      const distance = end - now;

      if (distance <= 0) {
        if (!isEnded) {
          setIsEnded(true);
          setTimeLeft("ĐÃ KẾT THÚC");
          // Kích hoạt chốt ngay nếu đang mở trang
          if (bids.length > 0 && listing.status !== 'sold') {
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
  }, [listing.auctionEndAt, bids, isEnded, listing.status]);

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
      alert("🎉 Trả giá thành công!");
    } catch (error: any) {
      alert(error.message || "Lỗi đấu giá.");
    } finally {
      setIsBidding(false);
    }
  };

  return (
    <div className="bg-white border-2 border-indigo-100 rounded-[2.5rem] p-6 shadow-2xl relative overflow-hidden">
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
                 <button onClick={handlePlaceBid} disabled={isBidding} className="shrink-0 bg-blue-600 text-white font-black px-8 py-3.5 rounded-2xl hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-200 uppercase text-sm tracking-widest">
                   {isBidding ? '...' : 'ĐẤU'}
                 </button>
             </div>
          </div>
        )}
      </div>

      <div className="relative z-10 px-1">
        <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-4 flex items-center justify-between">
          <span>🔨 Lịch sử lượt trả</span>
          <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[9px]">{bids.length}</span>
        </h4>
        <div className="max-h-52 overflow-y-auto space-y-2.5">
          {bids.map((bid, index) => (
            <div key={bid.id} className={`flex items-center justify-between p-3.5 rounded-2xl border ${index === 0 ? 'bg-yellow-50/50 border-yellow-200 shadow-sm' : 'bg-white border-slate-50'}`}>
              <div className="flex items-center gap-3">
                <img src={bid.userAvatar || "https://placehold.co/50"} className="w-9 h-9 rounded-xl object-cover" alt="" />
                <div className="min-w-0">
                  <p className="text-[11px] font-black truncate">{bid.userName}</p>
                  <p className="text-[9px] text-slate-400 font-bold uppercase">{formatTimeAgo(bid.createdAt)}</p>
                </div>
              </div>
              <span className="text-sm font-black text-orange-600">{formatPrice(bid.amount)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AuctionBox;
