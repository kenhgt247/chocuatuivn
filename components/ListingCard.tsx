import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Listing, User } from '../types';
import { formatPrice, formatTimeAgo } from '../utils/format';
import { db } from '../services/db';

interface ListingCardProps {
  listing: Listing;
  currentUser?: User | null; // Cần user để check ví
  isFavorite?: boolean;
  onToggleFavorite?: (id: string) => void;
  hideViews?: boolean;
}

const ListingCard: React.FC<ListingCardProps> = ({ 
  listing, 
  currentUser,
  isFavorite = false, 
  onToggleFavorite, 
  hideViews = false 
}) => {
  
  const navigate = useNavigate();
  const [isPushing, setIsPushing] = useState(false);

  // Xử lý sự kiện click nút Tim (Yêu thích)
  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault(); 
    e.stopPropagation();
    if (onToggleFavorite) {
      onToggleFavorite(listing.id);
    }
  };

  // --- [LOGIC ĐẨY TIN: ĐÃ KIỂM TRA SỐ DƯ VÍ] ---
  const handlePushClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // 1. Kiểm tra đăng nhập
    if (!currentUser) {
        if(window.confirm("Bạn cần đăng nhập để sử dụng tính năng này.")) {
            navigate('/login');
        }
        return;
    }

    // 2. Cấu hình giá đẩy tin (Nên lấy từ Settings nếu có, ở đây ví dụ 5k)
    const PUSH_PRICE = 5000;

    // 3. KIỂM TRA SỐ DƯ VÍ (QUAN TRỌNG)
    if (currentUser.walletBalance < PUSH_PRICE) {
        const confirm = window.confirm(
            `⚠️ Số dư không đủ!\n\n` +
            `Chi phí: ${formatPrice(PUSH_PRICE)}\n` +
            `Số dư ví: ${formatPrice(currentUser.walletBalance)}\n\n` +
            `Bạn có muốn nạp tiền ngay không?`
        );
        
        if (confirm) {
            navigate('/wallet'); // Chuyển sang trang nạp tiền
        }
        return; // Dừng lại, không chạy tiếp
    }

    // 4. Nếu đủ tiền -> Xác nhận lần cuối & Trừ tiền
    if (window.confirm(`Xác nhận trừ ${formatPrice(PUSH_PRICE)} để đẩy tin "${listing.title}" lên đầu?`)) {
        setIsPushing(true);
        try {
            const res = await db.pushListing(listing.id, currentUser.id);
            if (res.success) {
                alert(`🚀 Đẩy tin thành công! (Đã trừ ${formatPrice(PUSH_PRICE)})`);
                window.location.reload(); // Reload để thấy tin lên top
            } else {
                alert("Lỗi: " + res.message);
            }
        } catch (error) {
            console.error(error);
            alert("Có lỗi xảy ra, vui lòng thử lại.");
        } finally {
            setIsPushing(false);
        }
    }
  };

  // Kiểm tra quyền chủ sở hữu (để hiện nút đẩy tin)
  const isOwner = currentUser && currentUser.id === listing.sellerId;

  return (
    <div className="group relative flex flex-col gap-2 cursor-pointer">
      
      {/* 1. KHUNG ẢNH */}
      <Link to={`/san-pham/${listing.slug}-${listing.id}`} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 border border-gray-100">
        <img 
          src={listing.images[0] || 'https://placehold.co/400'} 
          alt={listing.title} 
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          loading="lazy"
        />
        
        {/* Badge VIP/MỚI */}
        <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
            {listing.tier === 'pro' && (
                <span className="bg-yellow-400 text-white text-[9px] font-black px-2 py-1 rounded-md uppercase shadow-sm tracking-wider">
                    VIP
                </span>
            )}
            {listing.condition === 'new' && (
                <span className="bg-blue-500 text-white text-[9px] font-black px-2 py-1 rounded-md uppercase shadow-sm tracking-wider">
                    Mới
                </span>
            )}
        </div>

        {/* NÚT TIM (GÓC PHẢI TRÊN) */}
        <button 
          onClick={handleFavoriteClick}
          className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center shadow-md transition-all active:scale-90 z-20 ${isFavorite ? 'bg-red-500 text-white' : 'bg-white/80 text-gray-400 hover:bg-white hover:text-red-500'}`}
          title={isFavorite ? "Bỏ lưu" : "Lưu tin"}
        >
          <svg className="w-4 h-4" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>

        {/* --- [NÚT ĐẨY TIN] MŨI TÊN XANH (GÓC PHẢI DƯỚI) --- */}
        {/* Chỉ hiện nếu là chủ sở hữu và tin đã được duyệt */}
        {isOwner && listing.status === 'approved' && (
            <button 
                onClick={handlePushClick}
                disabled={isPushing}
                className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center shadow-lg hover:bg-green-600 transition-all active:scale-90 animate-bounce-slow z-20 disabled:opacity-50 disabled:animate-none"
                title="Đẩy tin lên đầu"
            >
                {isPushing ? (
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                )}
            </button>
        )}

        {/* Overlay đen mờ khi hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors pointer-events-none"></div>
      </Link>

      {/* 2. THÔNG TIN */}
      <Link to={`/san-pham/${listing.slug}-${listing.id}`} className="space-y-1.5 px-1">
        <h3 className="text-xs font-medium text-gray-700 line-clamp-2 min-h-[2.5em] leading-relaxed group-hover:text-primary transition-colors">
          {listing.title}
        </h3>
        
        <div className="flex items-center justify-between">
            <p className="text-sm font-black text-gray-900">{formatPrice(listing.price)}</p>
            {!hideViews && (
                <span className="text-[9px] text-gray-400 font-bold flex items-center gap-1">
                    👁️ {listing.viewCount || 0}
                </span>
            )}
        </div>

        {/* --- ICON VỊ TRÍ & THỜI GIAN --- */}
        <div className="flex items-center pt-2 border-t border-gray-100 mt-1">
            {/* Trái: Avatar + Thời gian */}
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <div className="w-4 h-4 rounded-full overflow-hidden bg-gray-100 border border-gray-200 flex-shrink-0">
                    <img src={listing.sellerAvatar || 'https://placehold.co/50'} alt="" className="w-full h-full object-cover" />
                </div>
                <span className="text-[9px] font-bold text-gray-500 truncate flex-shrink-0">
                    {formatTimeAgo(listing.createdAt)}
                </span>
            </div>
            
            {/* Phải: Icon Vị trí + Địa điểm */}
            <div className="flex items-center gap-0.5 text-gray-500 max-w-[50%]">
                <svg className="w-2.5 h-2.5 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-[9px] font-bold truncate">
                    {listing.location}
                </span>
            </div>
        </div>
      </Link>
    </div>
  );
};

export default ListingCard;
