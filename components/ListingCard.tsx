import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Listing, User } from '../types';
import { formatPrice, formatTimeAgo } from '../utils/format';
import { db } from '../services/db';

// --- IMPORT ICON VECTOR ---
import { Heart, Zap, MapPin, Eye, Loader2, Clock, User as UserIcon } from 'lucide-react';

interface ListingCardProps {
  listing: Listing;
  currentUser?: User | null;
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

  // 3. Xử lý Đẩy tin
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
                window.location.reload(); 
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

  // Kiểm tra quyền chủ sở hữu
  const isOwner = currentUser && (String(currentUser.id) === String(listing.sellerId));
  const canPush = isOwner && (listing.status === 'approved');

  // --- LOGIC PHÂN LOẠI TIN (Giữ nguyên logic cũ) ---
  const getCardStyle = () => {
    switch (listing.tier) {
      case 'pro': // TIN VIP
        return {
          container: "border-yellow-400 shadow-md ring-1 ring-yellow-400/50",
          badge: (
            <span className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-[9px] font-black px-2 py-1 rounded-lg uppercase shadow-sm tracking-wider flex items-center gap-1">
              <Zap className="w-2.5 h-2.5 fill-current" /> VIP
            </span>
          ),
          bgTitle: "bg-yellow-50/50"
        };
      case 'basic': // TIN BASIC
        return {
          container: "border-blue-200 shadow-sm",
          badge: (
            <span className="bg-blue-500 text-white text-[9px] font-black px-2 py-1 rounded-lg uppercase shadow-sm tracking-wider">
              HOT
            </span>
          ),
          bgTitle: "bg-blue-50/30"
        };
      default: // TIN THƯỜNG
        return {
          container: "border-gray-100 hover:border-gray-300",
          badge: listing.condition === 'new' ? (
            <span className="bg-green-500 text-white text-[9px] font-black px-2 py-1 rounded-lg uppercase shadow-sm tracking-wider">Mới</span>
          ) : null,
          bgTitle: "bg-white"
        };
    }
  };

  const cardStyle = getCardStyle();

  return (
    <div className={`group relative flex flex-col bg-white rounded-xl transition-all duration-300 overflow-hidden h-full hover:-translate-y-1 hover:shadow-lg ${cardStyle.container}`}>
      
      {/* --- PHẦN HÌNH ẢNH --- */}
      <div className="relative aspect-square overflow-hidden bg-gray-100">
        <Link to={`/san-pham/${listing.slug}-${listing.id}`} className="block w-full h-full">
            <img 
              src={listing.images?.[0] || 'https://placehold.co/400?text=No+Image'} 
              alt={listing.title} 
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors pointer-events-none"></div>
        </Link>
        
        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1 z-10 pointer-events-none">
            {cardStyle.badge}
        </div>

        {/* Nút Yêu thích */}
        <button 
          onClick={handleFavoriteClick}
          className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center shadow-md transition-all active:scale-90 z-40 cursor-pointer ${isFavorite ? 'bg-red-500 text-white' : 'bg-white/90 text-gray-400 hover:text-red-500 hover:bg-white'}`}
          title="Lưu tin"
        >
          <Heart className="w-4 h-4" fill={isFavorite ? "currentColor" : "none"} strokeWidth={2.5} />
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
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                    <Zap className="w-4 h-4" fill="currentColor" />
                )}
            </button>
        )}
      </div>

      {/* --- PHẦN NỘI DUNG --- */}
      <Link to={`/san-pham/${listing.slug}-${listing.id}`} className={`flex flex-col flex-1 p-3 space-y-2 ${cardStyle.bgTitle}`}>
        
        {/* Tiêu đề */}
        <h3 className={`text-xs ${listing.tier === 'pro' ? 'font-black text-black' : 'font-bold text-slate-700'} line-clamp-2 min-h-[2.5em] leading-relaxed group-hover:text-primary transition-colors`}>
          {listing.title}
        </h3>

        {/* GIÁ TIỀN & LƯỢT XEM */}
        <div className="flex items-center justify-between mt-1">
            <span className="text-sm font-black text-red-600">
                {formatPrice(listing.price)}
            </span>
            
            {!hideViews && (
                <div className="flex items-center gap-1 text-gray-400 text-[10px] bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
                    <Eye className="w-3 h-3" />
                    <span className="font-bold">{listing.views || listing.viewCount || 0}</span>
                </div>
            )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-auto">
            <div className="flex items-center gap-1.5 min-w-0">
                {listing.sellerAvatar ? (
                    <img 
                        src={listing.sellerAvatar} 
                        alt="" 
                        className="w-5 h-5 rounded-full object-cover border border-gray-100" 
                    />
                ) : (
                    <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center border border-gray-200">
                        <UserIcon className="w-3 h-3 text-slate-400" />
                    </div>
                )}
                <span className="text-[9px] font-bold text-gray-400 truncate flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    {formatTimeAgo(listing.createdAt)}
                </span>
            </div>
            
            <div className="flex items-center gap-0.5 text-gray-400 max-w-[45%]">
                <MapPin className="w-3 h-3 flex-shrink-0" />
                <span className="text-[9px] font-bold truncate">{listing.location}</span>
            </div>
        </div>

      </Link>
    </div>
  );
};

export default ListingCard;
