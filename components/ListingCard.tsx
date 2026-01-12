import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Listing } from '../types';
import { formatPrice, formatTimeAgo, getListingUrl } from '../utils/format';

const PLACEHOLDER_IMAGE = "https://placehold.co/400x400?text=No+Image";

interface ListingCardProps {
  listing: Listing;
  isFavorite?: boolean;
  onToggleFavorite?: (id: string) => void;
  onPushListing?: (id: string) => void;
  hideViews?: boolean;
}

const ListingCard: React.FC<ListingCardProps> = ({ 
  listing, 
  isFavorite, 
  onToggleFavorite,
  onPushListing,
  hideViews = false 
}) => {
  const isAffiliate = !!listing.affiliateLink;
  const detailUrl = getListingUrl(listing);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [imgSrc, setImgSrc] = useState(
    listing.images && listing.images.length > 0 ? listing.images[0] : PLACEHOLDER_IMAGE
  );
  
  // Trạng thái hover
  const [isHovered, setIsHovered] = useState(false);
  const isSold = listing.status === 'sold';

  // --- LOGIC HOVER: Di chuột vào thì chạy, ra thì dừng ---
  const handleMouseEnter = () => {
    setIsHovered(true);
    if (videoRef.current) {
      // play() trả về promise, cần catch lỗi nếu trình duyệt chặn
      videoRef.current.play().catch(error => console.log("Auto-play prevented", error));
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0; // Reset video về đầu để lần sau xem lại từ đầu
    }
  };

  return (
    <div 
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`flex flex-col bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group relative border border-gray-100 ${isSold ? 'opacity-70 grayscale' : ''}`}
    >
      
      {/* PHẦN MEDIA (ẢNH/VIDEO) */}
      <Link to={detailUrl} className="block relative aspect-square overflow-hidden bg-gray-100">
        
        {/* VIDEO LAYER: Nằm đè lên ảnh, mặc định ẩn (opacity-0) */}
        {listing.videoUrl && (
          <video 
            ref={videoRef}
            src={listing.videoUrl}
            muted // Bắt buộc muted
            loop
            playsInline
            // Khi hover thì hiện rõ (opacity-100), bình thường ẩn đi
            className={`absolute inset-0 w-full h-full object-cover z-20 transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`}
          />
        )}

        {/* ẢNH LAYER: Luôn hiện ở dưới */}
        <img 
          src={imgSrc} 
          alt={listing.title} 
          onError={() => setImgSrc(PLACEHOLDER_IMAGE)}
          loading="lazy" 
          className="absolute inset-0 w-full h-full object-cover z-10 transition-transform duration-700 group-hover:scale-105" 
        />
        
        {/* ICON VIDEO BADGE: Báo hiệu cho người dùng biết tin này có video */}
        {listing.videoUrl && !isHovered && (
           <div className="absolute top-2 right-2 z-30 bg-black/60 text-white p-1.5 rounded-full backdrop-blur-sm animate-pulse">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                <path d="M4.5 4.5a3 3 0 00-3 3v9a3 3 0 003 3h8.25a3 3 0 003-3v-9a3 3 0 00-3-3H4.5zM19.94 18.75l-2.69-2.69V7.94l2.69-2.69c.944-.945 2.56-.276 2.56 1.06v11.38c0 1.336-1.616 2.005-2.56 1.06z" />
              </svg>
           </div>
        )}

        {/* Overlay ĐÃ BÁN */}
        {isSold && (
            <div className="absolute inset-0 bg-black/50 z-40 flex items-center justify-center">
                <span className="text-white font-black text-xs border-2 border-white px-3 py-1 -rotate-12 rounded uppercase tracking-widest">Đã bán</span>
            </div>
        )}

        {/* Badge VIP/Affiliate (Giữ nguyên logic cũ của bạn) */}
        {!isAffiliate && !isSold && listing.tier === 'pro' && (
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider shadow-sm z-30 bg-gradient-to-r from-yellow-400 to-orange-500 text-white">
            👑 VIP
          </div>
        )}
        
      </Link>

      {/* PHẦN THÔNG TIN (Giữ nguyên) */}
      <Link to={detailUrl} className="p-3 space-y-2 flex flex-col flex-1">
         <div className="flex items-center justify-between">
            <p className={`font-extrabold text-base leading-none ${isAffiliate ? 'text-orange-600' : 'text-red-600'}`}>
              {listing.price > 0 ? formatPrice(listing.price) : 'Liên hệ'}
            </p>
            {isAffiliate && <span className="text-[8px] font-bold text-gray-500 bg-gray-100 px-1.5 rounded border border-gray-200">Ad</span>}
        </div>
        
        <h3 className="text-xs md:text-sm text-gray-700 font-medium line-clamp-2 min-h-[2.5em] group-hover:text-blue-600 transition-colors">
          {listing.title}
        </h3>

        <div className="mt-auto pt-2 flex items-center justify-between text-[10px] text-gray-400 font-medium border-t border-dashed border-gray-100">
          <span className="truncate max-w-[60%] flex items-center gap-1">
              📍 {listing.location || 'Toàn quốc'}
          </span>
          <span>{formatTimeAgo(listing.createdAt)}</span>
        </div>
      </Link>
    </div>
  );
};

export default ListingCard;
