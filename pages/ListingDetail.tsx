
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { db } from '../services/db';
import { Listing, User } from '../types';
import { formatPrice, formatTimeAgo, getListingUrl } from '../utils/format';
import ListingCard from '../components/ListingCard';
import ShareModal from '../components/ShareModal';
import ReviewSection from '../components/ReviewSection';

const REPORT_REASONS = [
  "Lừa đảo, giả mạo",
  "Hàng giả, hàng nhái",
  "Thông tin không chính xác",
  "Hàng cấm buôn bán",
  "Sản phẩm đã bán",
  "Lý do khác"
];

const ListingDetail: React.FC<{ user: User | null }> = ({ user }) => {
  const { slugWithId } = useParams();
  const navigate = useNavigate();
  const [listing, setListing] = useState<Listing | null>(null);
  const [seller, setSeller] = useState<User | null>(null); 
  const [allListings, setAllListings] = useState<Listing[]>([]);
  const [activeImage, setActiveImage] = useState(0);
  const [userFavorites, setUserFavorites] = useState<string[]>([]);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");

  const id = useMemo(() => {
    if (!slugWithId) return null;
    const parts = slugWithId.split('-');
    return parts[parts.length - 1];
  }, [slugWithId]);

  useEffect(() => {
    if (!id) return;
    const loadListing = async () => {
      const data = await db.getListings();
      setAllListings(data);
      const l = data.find(x => x.id === id);
      if (l) {
        setListing(l);
        db.getUserById(l.sellerId).then(setSeller);
        if (user) db.getFavorites(user.id).then(setUserFavorites);
      }
    };
    loadListing();
    window.scrollTo(0, 0);
  }, [id, user]);

  if (!listing) return null;

  const handleStartChat = async () => {
    if (!user) return navigate('/login');
    if (user.id === listing.sellerId) return;
    const roomId = await db.createChatRoom(listing, user.id);
    navigate(`/chat/${roomId}`);
  };

  const handleToggleFav = async () => {
    if (!user) return navigate('/login');
    await db.toggleFavorite(user.id, listing.id);
    const updated = await db.getFavorites(user.id);
    setUserFavorites(updated);
  };

  return (
    <div className="max-w-7xl mx-auto md:px-4 lg:px-8 py-0 md:py-8 space-y-6">
      <div className="grid lg:grid-cols-12 gap-0 md:gap-8 bg-white md:bg-transparent">
        
        {/* Gallery Section - Cải thiện phong cách Marketplace */}
        <div className="lg:col-span-8 space-y-4">
          <div className="relative bg-gray-100 aspect-square md:aspect-video md:rounded-2xl overflow-hidden group">
            <img 
              src={listing.images[activeImage]} 
              className="w-full h-full object-contain" 
              alt={listing.title} 
            />
            
            {/* Nav buttons for gallery */}
            {listing.images.length > 1 && (
              <>
                <button 
                  onClick={() => setActiveImage(prev => prev > 0 ? prev - 1 : listing.images.length - 1)}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/80 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth={3}/></svg>
                </button>
                <button 
                  onClick={() => setActiveImage(prev => prev < listing.images.length - 1 ? prev + 1 : 0)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/80 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeWidth={3}/></svg>
                </button>
              </>
            )}
          </div>

          {/* Thumbnails */}
          {listing.images.length > 1 && (
            <div className="hidden md:flex gap-2 overflow-x-auto no-scrollbar py-2">
              {listing.images.map((img, idx) => (
                <button 
                  key={idx}
                  onClick={() => setActiveImage(idx)}
                  className={`w-20 h-20 rounded-lg overflow-hidden border-2 flex-shrink-0 transition-all ${activeImage === idx ? 'border-primary' : 'border-transparent opacity-60'}`}
                >
                  <img src={img} className="w-full h-full object-cover" alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info Sidebar - Phong cách FB Marketplace */}
        <div className="lg:col-span-4 p-4 md:p-6 bg-white md:rounded-2xl md:shadow-sm border-l md:border border-gray-100 h-fit sticky top-24">
          <div className="space-y-4">
            <div className="space-y-1">
              <h1 className="text-xl md:text-2xl font-black text-gray-900 leading-tight">{listing.title}</h1>
              <p className="text-2xl font-black text-primary">{formatPrice(listing.price)}</p>
              <div className="flex items-center gap-2 text-xs text-gray-500 font-bold uppercase tracking-tight py-2 border-b border-gray-50">
                <span>{listing.location}</span>
                <span>•</span>
                <span>{formatTimeAgo(listing.createdAt)}</span>
              </div>
            </div>

            <div className="py-4 space-y-4">
              <div className="flex items-center gap-3">
                <Link to={`/seller/${listing.sellerId}`} className="w-12 h-12 rounded-full overflow-hidden border border-gray-200">
                  <img src={listing.sellerAvatar} className="w-full h-full object-cover" />
                </Link>
                <div className="flex-1 min-w-0">
                  <Link to={`/seller/${listing.sellerId}`} className="font-black text-sm hover:underline block truncate">{listing.sellerName}</Link>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Đối tác tin cậy</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button onClick={handleStartChat} className="bg-primary text-white py-3.5 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 hover:bg-primaryHover transition-all">
                  Nhắn tin
                </button>
                {seller?.phone && (
                  <a href={`tel:${seller.phone}`} className="bg-gray-100 text-gray-900 py-3.5 rounded-xl font-black text-xs uppercase tracking-widest text-center hover:bg-gray-200 transition-all">
                    Gọi điện
                  </a>
                )}
              </div>
              
              <div className="flex gap-2">
                <button onClick={handleToggleFav} className="flex-1 flex items-center justify-center gap-2 py-3 border-2 border-gray-100 rounded-xl text-xs font-bold hover:bg-gray-50">
                  <svg className={`w-5 h-5 ${userFavorites.includes(listing.id) ? 'text-red-500 fill-current' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" strokeWidth={2}/></svg>
                  Lưu tin
                </button>
                <button onClick={() => setIsShareModalOpen(true)} className="flex-1 flex items-center justify-center gap-2 py-3 border-2 border-gray-100 rounded-xl text-xs font-bold hover:bg-gray-50">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" strokeWidth={2}/></svg>
                  Chia sẻ
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100">
              <h3 className="font-black text-sm uppercase mb-3">Mô tả của người bán</h3>
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{listing.description}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recommended Section */}
      <div className="px-4 md:px-0">
        <h2 className="text-lg font-black uppercase mb-4 tracking-tight">Gợi ý dành cho bạn</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
          {allListings.slice(0, 12).map(l => (
            <ListingCard key={l.id} listing={l} isFavorite={userFavorites.includes(l.id)} onToggleFavorite={handleToggleFav} />
          ))}
        </div>
      </div>

      <ShareModal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} url={getListingUrl(listing)} title={listing.title} />
    </div>
  );
};

export default ListingDetail;
