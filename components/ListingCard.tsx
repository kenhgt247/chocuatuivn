import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Listing } from '../types';
import { formatPrice, formatTimeAgo, getListingUrl } from '../utils/format';

// Ảnh mặc định nếu tin đăng không có ảnh hoặc ảnh lỗi
const PLACEHOLDER_IMAGE = "https://placehold.co/400x400?text=No+Image";

interface ListingCardProps {
  listing: Listing;
  isFavorite?: boolean;
  onToggleFavorite?: (id: string) => void;
  onPushListing?: (id: string) => void;
}

const ListingCard: React.FC<ListingCardProps> = ({ 
  listing, 
  isFavorite, 
  onToggleFavorite,
  onPushListing 
}) => {
  const detailUrl = getListingUrl(listing);
  
  // State để xử lý khi ảnh bị lỗi (404)
  const [imgSrc, setImgSrc] = useState(
    listing.images && listing.images.length > 0 ? listing.images[0] : PLACEHOLDER_IMAGE
  );

  return (
    <div className="flex flex-col bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 group relative border border-gray-100">
      
      {/* PHẦN HÌNH ẢNH */}
      <Link to={detailUrl} className="block relative aspect-square overflow-hidden bg-gray-100">
        <img 
          src={imgSrc} 
          alt={listing.title} 
          onError={() => setImgSrc(PLACEHOLDER_IMAGE)} // Tự động thay thế nếu ảnh lỗi
          
          // [TỐI ƯU HIỆU NĂNG]
          loading="lazy" // Chỉ tải ảnh khi người dùng cuộn tới
          decoding="async" // Giải mã ảnh không chặn luồng chính
          
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
        />
        
        {/* Huy hiệu VIP */}
        {listing.tier && listing.tier !== 'free' && (
          <div className={`absolute top-2 left-2 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider shadow-md z-10 backdrop-blur-md border border-white/20 ${
            listing.tier === 'pro' 
              ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white' 
              : 'bg-blue-500/90 text-white'
          }`}>
            {listing.tier === 'pro' ? '👑 VIP PRO' : '💎 TÀI TRỢ'}
          </div>
        )}

        {/* Khu vực nút hành động */}
        <div className="absolute top-2 right-2 flex flex-col gap-2 z-20">
            {/* Nút yêu thích */}
            <button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleFavorite?.(listing.id);
              }}
              className="p-2 bg-white/80 backdrop-blur-md rounded-full text-gray-400 hover:text-red-500 hover:bg-white transition-all shadow-sm group/btn"
              title={isFavorite ? "Bỏ lưu" : "Lưu tin"}
            >
              <svg className={`w-4 h-4 transition-transform group-active/btn:scale-75 ${isFavorite ? 'text-red-500 fill-current' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </button>

            {/* Nút Đẩy tin */}
            {onPushListing && (
              <button 
                onClick={(e) => {
                  e.preventDefault(); 
                  e.stopPropagation();
                  onPushListing(listing.id);
                }}
                className="p-2 bg-white/80 backdrop-blur-md rounded-full text-green-600 hover:bg-green-500 hover:text-white transition-all shadow-sm animate-fade-in-up"
                title="Đẩy tin lên đầu"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              </button>
            )}
        </div>
      </Link>

      {/* PHẦN THÔNG TIN */}
      <Link to={detailUrl} className="p-3 space-y-1.5 flex flex-col flex-1">
        {/* Giá tiền */}
        <p className="text-primary font-black text-lg leading-none tracking-tight">
          {formatPrice(listing.price)}
        </p>
        
        {/* Tiêu đề */}
        <h3 className="text-xs md:text-sm text-gray-800 font-bold line-clamp-2 leading-snug min-h-[2.5em] group-hover:text-primary transition-colors">
          {listing.title}
        </h3>
        
        {/* Footer Card (Địa điểm + Thời gian) */}
        <div className="mt-auto pt-2 flex items-center justify-between text-[10px] text-gray-400 font-bold border-t border-dashed border-gray-100">
          <span className="truncate max-w-[60%] flex items-center gap-1">
              📍 {listing.location || 'Toàn quốc'}
          </span>
          <span className="opacity-70 whitespace-nowrap">
              {formatTimeAgo(listing.createdAt)}
          </span>
        </div>
      </Link>
    </div>
  );
};

export default ListingCard;