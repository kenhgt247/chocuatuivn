import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { db } from '../services/db';
import { Listing, User } from '../types';
import { formatPrice, formatTimeAgo, getListingUrl } from '../utils/format';
import ListingCard from '../components/ListingCard';
import ShareModal from '../components/ShareModal';
import ReviewSection from '../components/ReviewSection';
import { CATEGORIES } from '../constants'; // Import danh sách danh mục

const REPORT_REASONS = [
  "Lừa đảo, giả mạo",
  "Hàng giả, hàng nhái",
  "Thông tin không chính xác",
  "Hàng cấm buôn bán",
  "Sản phẩm đã bán",
  "Lý do khác"
];

// Danh sách link footer
const STATIC_LINKS = [
  { slug: 'gioi-thieu', title: 'Giới thiệu' },
  { slug: 'quy-che-hoat-dong', title: 'Quy chế hoạt động' },
  { slug: 'chinh-sach-bao-mat', title: 'Chính sách bảo mật' },
  { slug: 'meo-mua-ban-an-toan', title: 'Mẹo an toàn' },
  { slug: 'huong-dan-dang-tin', title: 'Hỗ trợ' },
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
  const [reportDetails, setReportDetails] = useState("");
  const [isPhoneVisible, setIsPhoneVisible] = useState(false);

  // Lấy ID từ URL
  const id = useMemo(() => {
    if (!slugWithId) return null;
    const parts = slugWithId.split('-');
    return parts[parts.length - 1];
  }, [slugWithId]);

  // Load dữ liệu
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

  // Logic sắp xếp sản phẩm tương tự
  const similarListings = useMemo(() => {
    if (!listing || allListings.length === 0) return [];

    return allListings
      .filter(l => 
        l.id !== listing.id &&          
        l.category === listing.category 
      )
      .sort((a, b) => {
        const aVip = (a as any).isVip ? 1 : 0;
        const bVip = (b as any).isVip ? 1 : 0;
        if (aVip !== bVip) return bVip - aVip;

        const aNear = a.location === listing.location ? 1 : 0;
        const bNear = b.location === listing.location ? 1 : 0;
        if (aNear !== bNear) return bNear - aNear;

        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA;
      })
      .slice(0, 12); 
  }, [allListings, listing]);

  if (!listing) return null;

  // --- LOGIC LẤY THÔNG TIN DANH MỤC CHO BREADCRUMB ---
  const currentCategory = CATEGORIES.find(c => c.id === listing.category);

  // --- HANDLERS ---
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

  const handleReport = async () => {
    if (!user) return navigate('/login');
    if (!reportReason) return alert("Vui lòng chọn lý do báo cáo");
    
    await db.reportListing({
      listingId: listing.id,
      userId: user.id,
      reason: reportReason,
      details: reportDetails
    });
    
    alert("Cảm ơn bạn! Báo cáo của bạn đã được gửi tới Ban quản trị.");
    setShowReportModal(false);
  };

  const formatHiddenPhone = (phone: string) => {
    if (!phone) return "";
    return phone.substring(0, 4) + " *** ***";
  };

  return (
    <div className="max-w-7xl mx-auto md:px-4 lg:px-8 py-0 md:py-8 space-y-6 pb-24">
      
      {/* --- BREADCRUMB --- */}
      <nav className="flex items-center gap-2 text-[10px] md:text-xs font-black uppercase tracking-widest text-gray-400 px-4 md:px-0 overflow-x-auto no-scrollbar whitespace-nowrap">
        <Link to="/" className="hover:text-primary transition-colors flex-shrink-0">
          Chợ Của Tui
        </Link>
        <span>/</span>
        {currentCategory ? (
          <Link to={`/danh-muc/${currentCategory.slug}`} className="hover:text-primary transition-colors flex-shrink-0">
            {currentCategory.name}
          </Link>
        ) : (
          <span className="text-gray-300">...</span>
        )}
        <span>/</span>
        <span className="text-gray-900 truncate max-w-[150px] md:max-w-xs" title={listing.title}>
          {listing.title}
        </span>
      </nav>
      {/* ------------------- */}

      <div className="grid lg:grid-cols-12 gap-0 md:gap-8 bg-white md:bg-transparent overflow-hidden">
        
        {/* Cột trái: Gallery, Mô tả & Đánh giá */}
        <div className="lg:col-span-8 space-y-6">
          <div className="relative bg-black aspect-square md:aspect-video md:rounded-3xl overflow-hidden group">
            <img 
              src={listing.images[activeImage]} 
              className="w-full h-full object-contain" 
              alt={listing.title} 
            />
            
            {listing.images.length > 1 && (
              <>
                <button 
                  onClick={() => setActiveImage(prev => prev > 0 ? prev - 1 : listing.images.length - 1)}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/90 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10"
                >
                  <svg className="w-5 h-5 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth={3}/></svg>
                </button>
                <button 
                  onClick={() => setActiveImage(prev => prev < listing.images.length - 1 ? prev + 1 : 0)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/90 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10"
                >
                  <svg className="w-5 h-5 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeWidth={3}/></svg>
                </button>
              </>
            )}
            
            <div className="absolute bottom-4 right-4 bg-black/50 backdrop-blur-md text-white px-4 py-1.5 rounded-full text-xs font-bold border border-white/20">
              {activeImage + 1} / {listing.images.length}
            </div>
          </div>

          {/* Thumbnails trên Desktop */}
          {listing.images.length > 1 && (
            <div className="hidden md:flex gap-3 overflow-x-auto no-scrollbar py-2">
              {listing.images.map((img, idx) => (
                <button 
                  key={idx}
                  onClick={() => setActiveImage(idx)}
                  className={`w-24 h-24 rounded-2xl overflow-hidden border-4 transition-all flex-shrink-0 ${activeImage === idx ? 'border-primary' : 'border-transparent opacity-50 hover:opacity-100'}`}
                >
                  <img src={img} className="w-full h-full object-cover" alt="" />
                </button>
              ))}
            </div>
          )}

          {/* Khối mô tả chi tiết */}
          <div className="bg-white md:rounded-[2.5rem] p-6 md:p-8 border border-gray-100 shadow-sm space-y-6">
            <div className="space-y-4">
              <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest">Mô tả chi tiết</h2>
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap text-base font-medium">{listing.description}</p>
            </div>
            
            <div className="pt-6 border-t border-gray-100">
               <div className="flex flex-wrap gap-4">
                 <div className="bg-bgMain px-4 py-2 rounded-xl text-xs font-bold text-gray-500">
                    Tình trạng: <span className="text-textMain">{listing.condition === 'new' ? 'Mới 100%' : 'Đã sử dụng'}</span>
                 </div>
                 <div className="bg-bgMain px-4 py-2 rounded-xl text-xs font-bold text-gray-500">
                    Danh mục: <span className="text-textMain">
                        {currentCategory?.name || listing.category}
                    </span>
                 </div>
               </div>
            </div>
          </div>

          {/* Mục Đánh giá & Bình luận */}
          <div className="bg-white md:rounded-[2.5rem] p-6 md:p-8 border border-gray-100 shadow-sm space-y-6">
            <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest">Đánh giá & Bình luận</h2>
            <ReviewSection targetId={listing.id} targetType="listing" currentUser={user} />
          </div>
        </div>

        {/* Cột phải: Thông tin người bán & Thao tác (Sticky) */}
        <div className="lg:col-span-4 p-4 md:p-0">
          <div className="bg-white md:rounded-[2.5rem] p-6 md:p-8 md:border border-gray-100 md:shadow-soft space-y-6 sticky top-24">
            <div className="space-y-2">
              <p className="text-3xl font-black text-primary">{formatPrice(listing.price)}</p>
              <h1 className="text-xl font-bold text-gray-900 leading-tight">{listing.title}</h1>
              <div className="flex items-center gap-2 text-[10px] text-gray-400 font-black uppercase tracking-widest pt-2">
                <span className="flex items-center gap-1">📍 {listing.location}</span>
                <span>•</span>
                <span>🕒 {formatTimeAgo(listing.createdAt)}</span>
              </div>
            </div>

            <div className="pt-6 border-t border-gray-100 space-y-6">
              <div className="flex items-center gap-4 p-4 bg-bgMain rounded-3xl border border-gray-100 group transition-all">
                <Link to={`/seller/${listing.sellerId}`} className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-white shadow-md flex-shrink-0 group-hover:scale-105 transition-transform">
                  <img src={listing.sellerAvatar} className="w-full h-full object-cover" alt={listing.sellerName} />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link to={`/seller/${listing.sellerId}`} className="font-black text-sm hover:text-primary transition-colors block truncate">{listing.sellerName}</Link>
                  <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase mt-0.5">
                    <span className="text-green-500">● Online</span>
                    <span>•</span>
                    <span>Xác thực</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <button 
                  onClick={handleStartChat} 
                  className="w-full bg-primary text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 hover:bg-primaryHover active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" strokeWidth={2}/></svg>
                  Nhắn tin cho người bán
                </button>
                {seller?.phone && (
                  isPhoneVisible ? (
                    <a 
                      href={`tel:${seller.phone}`} 
                      className="w-full bg-white border-2 border-primary text-primary py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-center hover:bg-primary/5 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" strokeWidth={2}/></svg>
                      Gọi: {seller.phone}
                    </a>
                  ) : (
                    <button 
                      onClick={() => setIsPhoneVisible(true)}
                      className="w-full bg-white border-2 border-primary text-primary py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-center hover:bg-primary/5 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" strokeWidth={2}/></svg>
                      Bấm để hiện số: {formatHiddenPhone(seller.phone)}
                    </button>
                  )
                )}
              </div>
              
              <div className="flex gap-3">
                <button 
                  onClick={handleToggleFav} 
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 border-2 border-gray-100 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all"
                >
                  <svg className={`w-5 h-5 ${userFavorites.includes(listing.id) ? 'text-red-500 fill-current' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" strokeWidth={2.5}/></svg>
                  {userFavorites.includes(listing.id) ? 'Đã lưu' : 'Lưu tin'}
                </button>
                <button 
                  onClick={() => setIsShareModalOpen(true)} 
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 border-2 border-gray-100 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all"
                >
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" strokeWidth={2.5}/></svg>
                  Chia sẻ
                </button>
              </div>

              <div className="pt-4">
                <button 
                  onClick={() => setShowReportModal(true)}
                  className="w-full text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-red-500 transition-colors py-2 flex items-center justify-center gap-2"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeWidth={3}/></svg>
                  Báo cáo tin đăng vi phạm
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sản phẩm tương tự */}
      <div className="px-4 md:px-0">
        <div className="flex items-center justify-between mb-6 px-2">
          <h2 className="text-xl font-black text-textMain tracking-tight uppercase">Sản phẩm tương tự</h2>
          <Link to={`/?category=${listing.category}`} className="text-xs font-black text-primary hover:underline">Xem tất cả →</Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
          {similarListings.map(l => (
            <ListingCard 
              key={l.id} 
              listing={l} 
              isFavorite={userFavorites.includes(l.id)} 
              onToggleFavorite={handleToggleFav} 
            />
          ))}
          
          {similarListings.length === 0 && (
             <div className="col-span-full py-10 text-center text-gray-400 text-sm italic">
                Chưa có sản phẩm tương tự.
             </div>
          )}
        </div>
      </div>

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowReportModal(false)}></div>
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl relative animate-fade-in-up border border-borderMain">
            <h3 className="text-xl font-black text-textMain mb-2">Báo cáo vi phạm</h3>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-6">Giúp chúng tôi giữ cộng đồng an toàn</p>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Lý do báo cáo</label>
                <select 
                  value={reportReason} 
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full bg-bgMain border border-borderMain rounded-2xl p-4 font-bold text-sm appearance-none cursor-pointer"
                >
                  <option value="">Chọn lý do...</option>
                  {REPORT_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Mô tả thêm (Không bắt buộc)</label>
                <textarea 
                  rows={3} 
                  placeholder="Ví dụ: Người bán yêu cầu chuyển cọc trước..."
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  className="w-full bg-bgMain border border-borderMain rounded-2xl p-4 text-sm font-medium focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setShowReportModal(false)}
                  className="flex-1 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
                >
                  Hủy
                </button>
                <button 
                  onClick={handleReport}
                  className="flex-1 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest bg-red-500 text-white shadow-lg shadow-red-100 hover:bg-red-600 transition-all active:scale-95"
                >
                  Gửi báo cáo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ShareModal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} url={getListingUrl(listing)} title={listing.title} />

      {/* --- PHẦN MỚI: FOOTER (CHỈ HIỆN TRÊN MÁY TÍNH) --- */}
      <footer className="hidden md:block pt-16 border-t border-dashed border-gray-200 mt-20">
         <div className="bg-white border border-borderMain rounded-[3rem] p-10 shadow-soft">
            <div className="flex items-center justify-between mb-8">
               <h4 className="text-xl font-black text-textMain flex items-center gap-2"><span className="text-2xl">⚡</span> Chợ Của Tui</h4>
               <div className="flex gap-4">
                  {STATIC_LINKS.map(link => <Link key={link.slug} to={`/page/${link.slug}`} className="text-xs font-bold text-gray-400 hover:text-primary transition-colors uppercase">{link.title}</Link>)}
               </div>
            </div>
            <div className="text-[10px] text-gray-400 font-medium text-center border-t border-gray-100 pt-8">© 2024 ChoCuaTui.vn - Nền tảng rao vặt ứng dụng AI. All rights reserved.</div>
         </div>
      </footer>
      {/* ------------------- */}

    </div>
  );
};

export default ListingDetail;
