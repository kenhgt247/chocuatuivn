
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Listing } from '../types';
import { formatPrice, formatTimeAgo, getListingUrl } from '../utils/format';
import ShareModal from './ShareModal';

interface ListingCardProps {
  listing: Listing;
  isFavorite?: boolean;
  onToggleFavorite?: (id: string) => void;
}

const ListingCard: React.FC<ListingCardProps> = ({ 
  listing, 
  isFavorite, 
  onToggleFavorite
}) => {
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const detailUrl = getListingUrl(listing);

  // Xử lý huy hiệu VIP tinh tế hơn
  const badgeStyles = listing.tier === 'pro' 
    ? "bg-yellow-400 text-white" 
    : listing.tier === 'basic' 
      ? "bg-blue-500 text-white" 
      : null;

  return (
    <>
      <div className="flex flex-col bg-white rounded-lg md:rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group relative">
        <Link to={detailUrl} className="block relative aspect-square overflow-hidden bg-gray-100">
          <img 
            src={listing.images[0]} 
            alt={listing.title} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
          />
          
          {/* Badge VIP phong cách gọn gàng */}
          {badgeStyles && (
            <div className={`absolute top-2 left-2 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter shadow-sm z-10 ${badgeStyles}`}>
              {listing.tier === 'pro' ? '★ VIP PRO' : 'VIP'}
            </div>
          )}

          {/* Nút yêu thích đặt trên ảnh như FB */}
          <button 
            onClick={(e) => {
              e.preventDefault();
              onToggleFavorite?.(listing.id);
            }}
            className="absolute top-2 right-2 p-2 bg-white/80 backdrop-blur rounded-full text-gray-500 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100 md:opacity-100 shadow-sm"
          >
            <svg className={`w-4 h-4 ${isFavorite ? 'text-red-500 fill-current' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </button>
        </Link>

        <Link to={detailUrl} className="p-2 md:p-3 space-y-1">
          <p className="text-sm md:text-base font-bold text-gray-900 leading-tight line-clamp-2">
            {listing.title}
          </p>
          <p className="text-primary font-black text-base md:text-lg">
            {formatPrice(listing.price)}
          </p>
          <div className="flex flex-col text-[11px] md:text-xs text-gray-500">
            <span className="truncate">{listing.location}</span>
            <span className="opacity-60">{formatTimeAgo(listing.createdAt)}</span>
          </div>
        </Link>
      </div>

      <ShareModal 
        isOpen={isShareModalOpen} 
        onClose={() => setIsShareModalOpen(false)} 
        url={detailUrl} 
        title={listing.title} 
      />
    </>
  );
};

export default ListingCard;
