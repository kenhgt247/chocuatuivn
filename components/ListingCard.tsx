import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Listing, User } from '../types';
import { formatPrice, formatTimeAgo } from '../utils/format';
import { db } from '../services/db';

interface ListingCardProps {
  listing: Listing;
  currentUser?: User | null; // Cần user để check ví khi đẩy tin
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
  const [pushConfig, setPushConfig] = useState<{ price: number, discount: number }>({ price: 5000, discount: 0 });

  // 1. Load cấu hình giá đẩy tin
  useEffect(() => {
      const loadSettings = async () => {
          try {
            const settings = await db.getSettings();
            if (settings) {
                setPushConfig({
                    price: settings.pushPrice || 5000,
                    discount: settings.pushDiscount || 0
                });
            }
          } catch (error) {}
      };
      loadSettings();
  }, []);

  // 2. Xử lý yêu thích
  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault(); 
    e.stopPropagation();
    if (onToggleFavorite) onToggleFavorite(listing.id);
  };

  // 3. Xử lý Đẩy tin (Logic quan trọng giữ nguyên)
  const handlePushClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!currentUser) {
        if(window.confirm("Bạn cần đăng nhập để sử dụng tính năng này.")) navigate('/login');
        return;
    }

    const finalPrice = pushConfig.price * (1 - pushConfig.discount / 100);

    // Kiểm tra số dư ví
    if ((currentUser.walletBalance || 0) < finalPrice) {
        if (window.confirm(`⚠️ Số dư không đủ (${formatPrice(currentUser.walletBalance || 0)} < ${formatPrice(finalPrice)}).\nBạn có muốn nạp tiền ngay không?`)) {
            navigate('/wallet');
        }
        return;
    }

    if (window.confirm(`Trừ ${formatPrice(finalPrice)} để đẩy tin "${listing.title}" lên đầu trang chủ?`)) {
        setIsPushing(true);
        try {
            const res = await db.pushListing(listing.id, currentUser.id);
            if (res.success) {
                alert(`🚀 Đẩy tin thành công!`);
                window.location.reload(); // Reload để thấy thay đổi
            } else {
                alert("Lỗi: " + res.message);
            }
        } catch (error) {
            console.error(error);
            alert("Có lỗi xảy ra khi đẩy tin.");
        } finally {
            setIsPushing(false);
        }
    }
  };

  // Kiểm tra quyền chủ sở hữu để hiện nút Đẩy tin
  const isOwner = currentUser && (String(currentUser.id) === String(listing.sellerId));
  const canPush = isOwner && (listing.status === 'approved');

  return (
    <div className="group relative flex flex-col bg-white border border-gray-100 rounded shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden h-full">
      
      {/* --- PHẦN HÌNH ẢNH --- */}
      <div className="relative aspect-square overflow-hidden bg-gray-100">
        <Link to={`/san-pham/${listing.slug}-${listing.id}`} className="block w-full h-full">
            <img 
              src={listing.images?.[0] || 'https://placehold.co/400?text=No+Image'} 
              alt={listing.title} 
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              loading="lazy"
            />
            {/* Lớp phủ đen mờ khi hover */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors pointer-events-none"></div>
        </Link>
        
        {/* Badges (VIP / Mới) */}
        <div className="absolute top-2 left-2 flex flex-col gap-1 z-10 pointer-events-none">
            {listing.tier === 'pro' && <span className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-[9px] font-black px-2 py-1 rounded-lg uppercase shadow-sm tracking-wider">VIP</span>}
            {listing.condition === 'new' && <span className="bg-blue-500 text-white text-[9px] font-black px-2 py-1 rounded-lg uppercase shadow-sm tracking-wider">Mới</span>}
        </div>

        {/* Nút Yêu thích - ĐÃ SỬA Z-INDEX CAO LÊN */}
        <button 
          onClick={handleFavoriteClick}
          className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center shadow-md transition-all active:scale-90 z-40 cursor-pointer ${isFavorite ? 'bg-red-500 text-white' : 'bg-white/90 text-gray-400 hover:text-red-500 hover:bg-white'}`}
          title="Lưu tin"
        >
          <svg className="w-4 h-4" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>

        {/* Nút Đẩy tin (Chỉ hiện cho chủ tin) */}
        {canPush && (
            <button 
                onClick={handlePushClick}
                disabled={isPushing}
                className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center shadow-lg hover:bg-green-600 transition-all active:scale-90 animate-bounce-slow z-30 disabled:opacity-50 disabled:animate-none border-2 border-white"
                title={`Đẩy tin lên đầu (${formatPrice(pushConfig.price * (1 - pushConfig.discount/100))})`}
            >
                {isPushing ? (
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                )}
            </button>
        )}
      </div>

      {/* --- PHẦN NỘI DUNG --- */}
      <Link to={`/san-pham/${listing.slug}-${listing.id}`} className="flex flex-col flex-1 p-3 space-y-2">
        
        {/* Tiêu đề */}
        <h3 className="text-xs font-bold text-slate-700 line-clamp-2 min-h-[2.5em] leading-relaxed group-hover:text-primary transition-colors">
          {listing.title}
        </h3>

        {/* [FIX UI] GIÁ TIỀN & LƯỢT XEM (NẰM NGANG NHAU) */}
        <div className="flex items-center justify-between mt-1">
            <span className="text-sm font-black text-red-600">
                {formatPrice(listing.price)}
            </span>
            
            {!hideViews && (
                <div className="flex items-center gap-1 text-gray-400 text-[10px] bg-slate-50 px-2 py-0.5 rounded-full">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                        <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                        <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                    </svg>
                    <span className="font-bold">{listing.views || listing.viewCount || 0}</span>
                </div>
            )}
        </div>

        {/* Footer: Avatar + Thời gian + Địa điểm */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-50 mt-auto">
            <div className="flex items-center gap-1.5 min-w-0">
                <img 
                    src={listing.sellerAvatar || 'https://ui-avatars.com/api/?name=User'} 
                    alt="" 
                    className="w-5 h-5 rounded-full object-cover border border-gray-100" 
                />
                <span className="text-[9px] font-bold text-gray-400 truncate">{formatTimeAgo(listing.createdAt)}</span>
            </div>
            
            <div className="flex items-center gap-0.5 text-gray-400 max-w-[45%]">
                <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                <span className="text-[9px] font-bold truncate">{listing.location}</span>
            </div>
        </div>

      </Link>
    </div>
  );
};

export default ListingCard;
