import React from 'react';
import { Link } from 'react-router-dom';
import { Listing } from '../types';
import { formatPrice, formatTimeAgo, getListingUrl } from '../utils/format';

interface ListingCardProps {
  listing: Listing;
  isFavorite?: boolean;
  onToggleFavorite?: (id: string) => void;
  // Thêm dòng này để nhận hàm đẩy tin từ cha
  onPushListing?: (id: string) => void;
}

const ListingCard: React.FC<ListingCardProps> = ({ 
  listing, 
  isFavorite, 
  onToggleFavorite,
  onPushListing 
}) => {
  const detailUrl = getListingUrl(listing);

  return (
    <div className="flex flex-col bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all group relative border border-gray-100">
      <Link to={detailUrl} className="block relative aspect-square overflow-hidden bg-gray-100">
        <img 
          src={listing.images[0]} 
          alt={listing.title} 
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
        />
        
        {/* Huy hiệu VIP */}
        {listing.tier !== 'free' && (
          <div className={`absolute top-2 left-2 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter shadow-sm z-10 ${
            listing.tier === 'pro' ? 'bg-yellow-400 text-white' : 'bg-blue-500 text-white'
          }`}>
            {listing.tier === 'pro' ? '★ VIP PRO' : 'Được tài trợ'}
          </div>
        )}

        {/* Khu vực nút hành động (Yêu thích + Đẩy tin) */}
        <div className="absolute top-2 right-2 flex flex-col gap-2 z-20">
            {/* Nút yêu thích */}
            <button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleFavorite?.(listing.id);
              }}
              className="p-1.5 bg-white/90 backdrop-blur rounded-full text-gray-400 hover:text-red-500 transition-all shadow-sm"
              title="Lưu tin"
            >
              <svg className={`w-4 h-4 ${isFavorite ? 'text-red-500 fill-current' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </button>

            {/* Nút Đẩy tin (Chỉ hiện nếu có truyền hàm onPushListing) */}
            {onPushListing && (
              <button 
                onClick={(e) => {
                  e.preventDefault(); 
                  e.stopPropagation();
                  onPushListing(listing.id);
                }}
                className="p-1.5 bg-white/90 backdrop-blur rounded-full text-green-600 hover:bg-green-500 hover:text-white transition-all shadow-sm animate-fade-in-up"
                title="Đẩy tin lên đầu"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              </button>
            )}
        </div>
      </Link>

      <Link to={detailUrl} className="p-2 md:p-3 space-y-0.5">
        <p className="text-primary font-black text-base md:text-lg leading-none">
          {formatPrice(listing.price)}
        </p>
        <p className="text-sm text-gray-800 font-medium line-clamp-2 leading-snug min-h-[2.5rem]">
          {listing.title}
        </p>
        <div className="flex flex-col text-[11px] text-gray-500 font-medium">
          <span className="truncate">{listing.location}</span>
          <span className="opacity-60">{formatTimeAgo(listing.createdAt)}</span>
        </div>
      </Link>
    </div>
  );
};

export default ListingCard;
