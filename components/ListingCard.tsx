import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Listing, User } from '../types';
import { formatPrice, formatTimeAgo } from '../utils/format';
import { db } from '../services/db';

// ⚠️ ĐÃ LOẠI BỎ LUCIDE-REACT ĐỂ TRÁNH LỖI CRASH
// --- BỘ ICON VẼ TAY (SVG THUẦN) ---
const IconZap = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>;
const IconHeart = ({ fill, className }: { fill?: string, className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill={fill || "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>;
const IconLoader2 = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>;
const IconEye = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const IconUser = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const IconClock = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
const IconMapPin = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>;
// Icon Mũi tên lên (Dùng cho nút Đẩy tin)
const IconArrowUp = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>;

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
              <IconZap className="w-2.5 h-2.5 fill-current" /> VIP
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
    <div className={`group relative flex flex-col bg-white rounded-lg transition-all duration-300 overflow-hidden h-full hover:-translate-y-1 hover:shadow-lg ${cardStyle.container}`}>
      
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
          <IconHeart className="w-4 h-4" fill={isFavorite ? "currentColor" : "none"} />
        </button>

        {/* Nút Đẩy tin (ĐÃ SỬA: MŨI TÊN XANH + HOVER HIỆN CHỮ) */}
        {canPush && (
            <button 
                onClick={handlePushClick}
                disabled={isPushing}
                // Group để trigger hover text
                className="group/push absolute bottom-2 right-2 h-8 bg-green-600 text-white rounded-full flex items-center justify-center shadow-lg transition-all duration-300 z-30 border-2 border-white
                           hover:pr-3 hover:pl-1 min-w-[32px] w-auto"
                title={`Đẩy tin lên đầu (${formatPrice(pushConfig.price * (1 - pushConfig.discount/100))})`}
            >
                {/* Icon (Luôn hiện) */}
                <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                    {isPushing ? (
                        <IconLoader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <IconArrowUp className="w-4 h-4" />
                    )}
                </div>

                {/* Chữ (Chỉ hiện khi hover) */}
                <span className="max-w-0 overflow-hidden group-hover/push:max-w-[120px] transition-all duration-300 text-[10px] font-black uppercase whitespace-nowrap">
                    Đẩy tin lên đầu
                </span>
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
                    <IconEye className="w-3 h-3" />
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
                        <IconUser className="w-3 h-3 text-slate-400" />
                    </div>
                )}
                <span className="text-[9px] font-bold text-gray-400 truncate flex items-center gap-1">
                    <IconClock className="w-2.5 h-2.5" />
                    {formatTimeAgo(listing.createdAt)}
                </span>
            </div>
            
            <div className="flex items-center gap-0.5 text-gray-400 max-w-[45%]">
                <IconMapPin className="w-3 h-3 flex-shrink-0" />
                <span className="text-[9px] font-bold truncate">{listing.location}</span>
            </div>
        </div>

      </Link>
    </div>
  );
};

export default ListingCard;