
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Listing } from '../types';
import { formatPrice, formatTimeAgo, getListingUrl } from '../utils/format';
import ShareModal from './ShareModal';

interface ListingCardProps {
  listing: Listing;
  isFavorite?: boolean;
  onToggleFavorite?: (id: string) => void;
  layout?: 'grid' | 'list';
}

const ListingCard: React.FC<ListingCardProps> = ({ 
  listing, 
  isFavorite, 
  onToggleFavorite,
  layout = 'grid'
}) => {
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const getTierStyles = () => {
    switch(listing.tier) {
      case 'pro':
        return {
          card: 'border-yellow-400/50 shadow-[0_8px_25px_rgba(234,179,8,0.15)] bg-gradient-to-br from-white to-yellow-50/10',
          badge: 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white',
          badgeText: '★ PRO VIP',
          title: 'text-yellow-700 font-black'
        };
      case 'basic':
        return {
          card: 'border-blue-200/50 bg-white shadow-soft',
          badge: 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white',
          badgeText: 'VIP',
          title: 'font-bold'
        };
      default:
        return {
          card: 'border-borderMain/50 bg-white shadow-soft',
          badge: null,
          badgeText: null,
          title: 'font-bold'
        };
    }
  };

  const styles = getTierStyles();
  const detailUrl = getListingUrl(listing);

  return (
    <>
      <Link 
        to={detailUrl}
        className={`border rounded-[1.75rem] overflow-hidden hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-500 group flex flex-col ${styles.card} ${listing.tier === 'pro' ? 'scale-[1.02]' : ''}`}
      >
        <div className="aspect-[1/1] relative overflow-hidden bg-gray-50">
          {styles.badge && (
            <div className={`absolute top-3 left-3 text-[9px] font-black px-2.5 py-1 rounded-xl shadow-lg z-10 uppercase tracking-tight flex items-center gap-1 border border-white/20 backdrop-blur-md ${styles.badge}`}>
              {styles.badgeText}
            </div>
          )}
          <img 
            src={listing.images[0]} 
            alt={listing.title} 
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 ease-out" 
          />
          
          <div className="absolute top-3 right-3 flex flex-col gap-2 z-10">
            <button 
              onClick={(e) => {
                e.preventDefault();
                onToggleFavorite?.(listing.id);
              }}
              className="p-2 bg-white/90 backdrop-blur rounded-xl text-gray-400 hover:text-red-500 transition-all shadow-lg group/fav"
            >
              <svg className={`w-4 h-4 transform group-hover/fav:scale-125 transition-transform ${isFavorite ? 'text-red-500 fill-current' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </button>
            <button 
              onClick={(e) => {
                e.preventDefault();
                setIsShareModalOpen(true);
              }}
              className="p-2 bg-white/90 backdrop-blur rounded-xl text-gray-400 hover:text-primary transition-all shadow-lg group/share"
            >
              <svg className="w-4 h-4 transform group-hover/share:scale-125 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </button>
          </div>
        </div>
        <div className="p-4 flex-1 flex flex-col gap-2">
          <h3 className={`text-sm line-clamp-2 leading-snug group-hover:text-primary transition-colors h-[2.8rem] ${styles.title}`}>
            {listing.title}
          </h3>
          <div className="mt-auto space-y-3">
            <p className="text-primary font-black text-lg leading-none">{formatPrice(listing.price)}</p>
            <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 border-t border-gray-50 pt-3">
              <span className="truncate max-w-[100px] flex items-center gap-1">
                 <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                 {listing.location}
              </span>
              <span>{formatTimeAgo(listing.createdAt)}</span>
            </div>
          </div>
        </div>
      </Link>
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
