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
  
  // State quản lý việc hiển thị video khi hover
  const [isHovered, setIsHovered] = useState(false);

  const isSold = listing.status === 'sold';

  // Hàm xử lý phát video khi di chuột vào
  const handleMouseEnter = () => {
    setIsHovered(true);
    if (videoRef.current) {
      videoRef.current.play().catch(() => {}); // Tránh lỗi trình duyệt chặn autoplay
    }
  };

  // Hàm xử lý dừng video khi di chuột ra
  const handleMouseLeave = () => {
    setIsHovered(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0; // Reset video về đầu
    }
  };

  return (
    <div 
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`flex flex-col bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 group relative border border-gray-100 ${isSold ? 'opacity-70 grayscale' : ''}`}
    >
      
      {/* PHẦN HÌNH ẢNH / VIDEO */}
      <Link to={detailUrl} className="block relative aspect-square overflow-hidden bg-gray-100">
        
        {/* Render Video nếu có videoUrl và đang Hover */}
        {listing.videoUrl ? (
          <>
            <video 
              ref={videoRef}
              src={listing.videoUrl}
              muted // Bắt buộc muted để autoplay hoạt động mượt
              loop
              playsInline
              className={`absolute inset-0 w-full h-full object-cover z-10 transition-opacity duration-500 ${isHovered ? 'opacity-100' : 'opacity-0'}`}
            />
            {/* Badge báo hiệu tin có Video */}
            {!isHovered && (
              <div className="absolute bottom-2 right-2 z-20 bg-black/50 text-white p-1 rounded-md backdrop-blur-sm">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                </svg>
              </div>
            )}
          </>
        ) : null}

        {/* Hình ảnh chính */}
        <img 
          src={imgSrc} 
          alt={listing.title} 
          onError={() => setImgSrc(PLACEHOLDER_IMAGE)}
          loading="lazy" 
          className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ${isHovered && listing.videoUrl ? 'opacity-0' : 'opacity-100'}`} 
        />
        
        {/* Overlay ĐÃ BÁN */}
        {isSold && (
            <div className="absolute inset-0 bg-black/40 z-30 flex items-center justify-center">
                <span className="text-white font-black text-xs border-2 border-white px-3 py-1 -rotate-12 rounded-md uppercase tracking-widest">Đã bán</span>
            </div>
        )}

        {/* Badge Affiliate */}
        {isAffiliate && !isSold && (
             <div className="absolute top-2 left-2 px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider shadow-md z-10 bg-gradient-to-r from-orange-500 to-red-500 text-white flex items-center gap-1">
                <span>🛒</span> {listing.attributes?.brand || 'TIẾP THỊ LIÊN KẾT'}
             </div>
        )}

        {/* Huy hiệu VIP */}
        {!isAffiliate && !isSold && listing.tier && listing.tier !== 'free' && (
          <div className={`absolute top-2 left-2 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider shadow-md z-10 backdrop-blur-md border border-white/20 ${
            listing.tier === 'pro' 
              ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white' 
              : 'bg-blue-500/90 text-white'
          }`}>
            {listing.tier === 'pro' ? '👑 VIP PRO' : '💎 TÀI TRỢ'}
          </div>
        )}

        {/* Nút hành động */}
        {!isAffiliate && (
            <div className="absolute top-2 right-2 flex flex-col gap-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <button 
                  onClick={(e) => {
                    e.preventDefault(); e.stopPropagation();
                    onToggleFavorite?.(listing.id);
                  }}
                  className="p-2 bg-white/80 backdrop-blur-md rounded-full text-gray-400 hover:text-red-500 hover:bg-white transition-all shadow-sm"
                >
                  <svg className={`w-4 h-4 ${isFavorite ? 'text-red-500 fill-current' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </button>

                {onPushListing && !isSold && (
                  <button 
                    onClick={(e) => {
                      e.preventDefault(); e.stopPropagation();
                      onPushListing(listing.id);
                    }}
                    className="p-2 bg-white/80 backdrop-blur-md rounded-full text-green-600 hover:bg-green-500 hover:text-white transition-all shadow-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                  </button>
                )}
            </div>
        )}
      </Link>

      {/* PHẦN THÔNG TIN */}
      <Link to={detailUrl} className="p-3 space-y-1.5 flex flex-col flex-1">
        <div className="flex items-center justify-between">
            <p className={`font-black text-lg leading-none tracking-tight ${isAffiliate ? 'text-orange-600' : 'text-primary'}`}>
              {listing.price > 0 ? formatPrice(listing.price) : (isAffiliate ? 'Xem giá ↗' : 'Liên hệ')}
            </p>
            {isAffiliate && <span className="text-[9px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">QC</span>}
        </div>
        
        <h3 className="text-xs md:text-sm text-gray-800 font-bold line-clamp-2 leading-snug min-h-[2.5em] group-hover:text-primary transition-colors">
          {listing.title}
        </h3>
        
        <div className="mt-auto pt-2 flex items-center justify-between text-[10px] text-gray-400 font-bold border-t border-dashed border-gray-100">
          <span className="truncate max-w-[50%] flex items-center gap-1">
              📍 {listing.location || 'Toàn quốc'}
          </span>
          
          <div className="flex items-center gap-2 opacity-70">
              {!hideViews && listing.viewCount !== undefined && (
                 <span className="flex items-center gap-0.5" title="Lượt xem">
                   👀 {listing.viewCount}
                 </span>
              )}
              <span>{formatTimeAgo(listing.createdAt)}</span>
          </div>
        </div>
      </Link>
    </div>
  );
};

export default ListingCard;