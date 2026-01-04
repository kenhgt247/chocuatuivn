
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
  const [isReporting, setIsReporting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [agreedToReportRules, setAgreedToReportRules] = useState(false);

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
        const sellerData = await db.getUserById(l.sellerId);
        if (sellerData) setSeller(sellerData);
        
        if (user) {
          const favorites = await db.getFavorites(user.id);
          setUserFavorites(favorites);
        }
      }
    };
    
    loadListing();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [id, user]);

  const recommendedListings = useMemo(() => {
    if (!listing || allListings.length === 0) return [];

    const now = new Date().getTime();

    return allListings
      .filter(l => l.id !== listing.id && l.status === 'approved')
      .map(l => {
        let score = 0;
        if (l.tier === 'pro') score += 10;
        if (l.tier === 'basic') score += 5;
        if (l.category === listing.category) score += 5;
        if (l.location === listing.location) score += 3;
        if (user?.location && l.location === user.location) score += 3;

        const ageInHours = (now - new Date(l.createdAt).getTime()) / (1000 * 60 * 60);
        if (ageInHours < 24) {
          score += (24 - ageInHours) / 2;
        }
        score += Math.random() * 4;

        return { ...l, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 12); 
  }, [listing, allListings, user]);

  if (!listing) return <div className="p-10 text-center flex flex-col items-center gap-4">
    <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    <p className="font-bold text-gray-400 text-xs">Đang tải tin đăng...</p>
  </div>;

  const handleToggleFav = async (targetId?: string) => {
    if (!user) return navigate('/login');
    const idToToggle = targetId || listing.id;
    await db.toggleFavorite(user.id, idToToggle);
    const updatedFavs = await db.getFavorites(user.id);
    setUserFavorites(updatedFavs);
  };

  const handleStartChat = async () => {
    if (!user) return navigate('/login');
    if (user.id === listing.sellerId) return alert('Bạn không thể chat với chính mình');
    const roomId = await db.createChatRoom(listing, user.id);
    navigate(`/chat/${roomId}`);
  };

  const handleReportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return navigate('/login');
    if (!reportReason) return;
    if (!agreedToReportRules) return alert("Vui lòng xác nhận quy tắc báo cáo.");

    setIsReporting(true);
    setTimeout(async () => {
      await db.reportListing({
        userId: user.id,
        listingId: listing.id,
        reason: reportReason
      });
      setIsReporting(false);
      setReportSuccess(true);
      setTimeout(() => {
        setReportSuccess(false);
        setShowReportModal(false);
        setReportReason("");
        setAgreedToReportRules(false);
      }, 2000);
    }, 800);
  };

  const isCurrentListingFav = userFavorites.includes(listing.id);

  return (
    <div className="space-y-12 pb-32">
      <div className="grid lg:grid-cols-3 gap-6 md:gap-8 px-0 md:px-4">
        {/* Left: Images and Info */}
        <div className="lg:col-span-2 space-y-4 md:space-y-6">
          <div className="bg-white md:border md:border-borderMain md:rounded-3xl overflow-hidden shadow-soft">
            <div className="aspect-[4/3] relative bg-gray-100">
              <img src={listing.images[activeImage]} alt={listing.title} className="w-full h-full object-contain" />
              
              <div className="absolute top-4 right-4 flex flex-col gap-3 z-10">
                <button 
                  onClick={() => handleToggleFav()}
                  className={`p-3 rounded-full backdrop-blur-md shadow-lg transition-all ${isCurrentListingFav ? 'bg-red-500 text-white' : 'bg-white/80 text-gray-400'}`}
                >
                  <svg className="w-6 h-6" fill={isCurrentListingFav ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </button>
                <button 
                  onClick={() => setIsShareModalOpen(true)}
                  className="p-3 bg-white/80 text-gray-400 rounded-full backdrop-blur-md shadow-lg transition-all hover:text-primary"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                </button>
              </div>
            </div>
            
            {listing.images.length > 1 && (
              <div className="p-4 flex gap-3 overflow-x-auto no-scrollbar bg-white">
                {listing.images.map((img, idx) => (
                  <button 
                    key={idx} 
                    onClick={() => setActiveImage(idx)}
                    className={`w-16 h-16 md:w-20 md:h-20 rounded-xl overflow-hidden flex-shrink-0 border-2 transition-all ${activeImage === idx ? 'border-primary' : 'border-transparent opacity-60'}`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border-y md:border md:border-borderMain md:rounded-3xl p-5 md:p-8 shadow-soft space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-black px-2 py-1 rounded uppercase ${listing.condition === 'new' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                  {listing.condition === 'new' ? 'Mới' : 'Đã sử dụng'}
                </span>
                <span className="text-[10px] font-black bg-blue-50 text-blue-600 px-2 py-1 rounded uppercase">Xác thực 100%</span>
              </div>
              <h1 className="text-xl md:text-2xl font-black text-textMain leading-tight">{listing.title}</h1>
              <p className="text-2xl md:text-3xl font-black text-primary">{formatPrice(listing.price)}</p>
              
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-gray-400 pt-2 border-t border-gray-50 mt-4">
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  Đăng {formatTimeAgo(listing.createdAt)}
                </span>
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                  {listing.location}
                </span>
              </div>
            </div>

            <div className="pt-6 border-t border-gray-100">
              <h2 className="text-lg font-black mb-4 flex items-center gap-2">
                <span className="w-1 h-6 bg-primary rounded-full"></span>
                Mô tả chi tiết
              </h2>
              <div className="text-gray-600 whitespace-pre-wrap leading-relaxed text-sm md:text-base prose prose-sm max-w-none">
                {listing.description}
              </div>
            </div>

            <div className="pt-6 border-t border-gray-100 flex justify-end">
              <button 
                onClick={() => setShowReportModal(true)}
                className="flex items-center gap-2 text-[10px] font-black text-gray-400 hover:text-red-500 transition-colors py-2 px-4 rounded-xl border border-dashed border-gray-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                Báo cáo tin đăng
              </button>
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <aside className="space-y-6">
          {/* Seller Info Card */}
          <div className="bg-white border border-borderMain rounded-3xl p-6 shadow-soft group">
            <Link to={`/seller/${listing.sellerId}`} className="flex items-start gap-4 mb-6">
              <div className="relative">
                <img src={listing.sellerAvatar} alt={listing.sellerName} className="w-16 h-16 rounded-2xl border border-gray-100 shadow-sm" />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-2 border-white rounded-full"></div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <h3 className="font-black text-lg text-textMain truncate">{listing.sellerName}</h3>
                  <svg className="w-4 h-4 text-blue-500 fill-current" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                </div>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Đối tác xác thực</p>
              </div>
            </Link>
            
            <div className="space-y-3">
              <button 
                onClick={handleStartChat}
                className="w-full bg-primary text-white font-black py-4 rounded-2xl hover:bg-primaryHover transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20 active:scale-95"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                Chat với người bán
              </button>

              {seller?.phone && (
                <a 
                  href={`tel:${seller.phone}`}
                  className="w-full bg-green-500 text-white font-black py-4 rounded-2xl hover:bg-green-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-100 active:scale-95"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
                  Gọi điện: {seller.phone}
                </a>
              )}
            </div>
          </div>

          {/* Reviews & Comments Section in Sidebar */}
          <div className="bg-white border border-borderMain rounded-3xl p-6 shadow-soft space-y-6">
            <h2 className="text-lg font-black flex items-center gap-2">
              <span className="w-1 h-6 bg-yellow-400 rounded-full"></span>
              Bình luận & Đánh giá
            </h2>
            <ReviewSection targetId={listing.id} targetType="listing" currentUser={user} />
          </div>
        </aside>
      </div>

      {/* Suggested Listings */}
      <section className="space-y-6 px-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl md:text-2xl font-black text-textMain tracking-tight">Tin rao liên quan</h2>
          <Link to="/" className="text-xs font-bold text-primary hover:underline">Xem thêm →</Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 md:gap-6">
          {recommendedListings.map(l => (
            <ListingCard key={l.id} listing={l} isFavorite={userFavorites.includes(l.id)} onToggleFavorite={handleToggleFav} />
          ))}
        </div>
      </section>

      {/* Share Modal */}
      <ShareModal 
        isOpen={isShareModalOpen} 
        onClose={() => setIsShareModalOpen(false)} 
        url={getListingUrl(listing)} 
        title={listing.title} 
      />

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowReportModal(false)}></div>
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl relative animate-fade-in-up">
            <h3 className="text-xl font-black mb-2">Báo cáo tin đăng</h3>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-6">Giúp chúng tôi giữ cộng đồng an toàn</p>
            
            {reportSuccess ? (
              <div className="py-10 text-center animate-bounce">
                <div className="text-5xl mb-4">✅</div>
                <p className="font-bold text-green-500">Đã gửi báo cáo thành công!</p>
              </div>
            ) : (
              <form onSubmit={handleReportSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Lý do báo cáo</label>
                  <select 
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="w-full bg-bgMain border border-borderMain rounded-xl p-3 text-sm font-medium focus:outline-none focus:border-primary appearance-none"
                    required
                  >
                    <option value="">Chọn lý do...</option>
                    {REPORT_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                
                <div className="flex items-start gap-3 p-3 bg-red-50 rounded-xl">
                  <input 
                    type="checkbox" 
                    id="confirm-report" 
                    checked={agreedToReportRules}
                    onChange={(e) => setAgreedToReportRules(e.target.checked)}
                    className="mt-1"
                  />
                  <label htmlFor="confirm-report" className="text-[10px] text-red-700 font-bold leading-tight">Tôi cam kết thông tin báo cáo là chính xác và chịu trách nhiệm về nội dung này.</label>
                </div>

                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setShowReportModal(false)} className="flex-1 py-3 font-bold text-gray-400 text-xs uppercase">Hủy</button>
                  <button type="submit" disabled={isReporting} className="flex-1 bg-red-500 text-white font-black py-3 rounded-xl text-xs uppercase shadow-lg shadow-red-100 disabled:opacity-50">
                    {isReporting ? 'Đang gửi...' : 'Gửi báo cáo'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ListingDetail;
