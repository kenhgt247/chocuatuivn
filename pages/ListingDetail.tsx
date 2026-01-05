import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { db } from '../services/db';
import { Listing, User } from '../types';
import { formatPrice, formatTimeAgo, getListingUrl } from '../utils/format';
import ListingCard from '../components/ListingCard';
import ShareModal from '../components/ShareModal';
import ReviewSection from '../components/ReviewSection';
import { CATEGORIES } from '../constants';

const REPORT_REASONS = [
  "Lừa đảo, giả mạo",
  "Hàng giả, hàng nhái",
  "Thông tin không chính xác",
  "Hàng cấm buôn bán",
  "Sản phẩm đã bán",
  "Lý do khác"
];

// Danh sách câu chat nhanh mẫu giống Chợ Tốt
const QUICK_CHAT_MESSAGES = [
  "Sản phẩm này còn không ạ?",
  "Thời gian bảo hành thế nào?",
  "Bạn có ship hàng không?",
  "Giá này có bớt thêm không?"
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
  
  // State cho Chat nhanh
  const [customMessage, setCustomMessage] = useState("");

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
        // Lấy thông tin người bán thực tế (bao gồm rating, avatar từ DB)
        db.getUserById(l.sellerId).then(setSeller);
        if (user) db.getFavorites(user.id).then(setUserFavorites);
      }
    };
    loadListing();
    window.scrollTo(0, 0);
  }, [id, user]);

  const similarListings = useMemo(() => {
    if (!listing || allListings.length === 0) return [];
    return allListings
      .filter(l => l.id !== listing.id && l.category === listing.category)
      .sort((a, b) => {
        const aVip = (a as any).isVip ? 1 : 0;
        const bVip = (b as any).isVip ? 1 : 0;
        if (aVip !== bVip) return bVip - aVip;
        const aNear = a.location === listing.location ? 1 : 0;
        const bNear = b.location === listing.location ? 1 : 0;
        if (aNear !== bNear) return bNear - aNear;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })
      .slice(0, 12); 
  }, [allListings, listing]);

  if (!listing) return null;

  const currentCategory = CATEGORIES.find(c => c.id === listing.category);

  // --- HANDLERS ---
  const handleStartChat = async (message?: string) => {
    if (!user) return navigate('/login');
    if (user.id === listing.sellerId) return alert("Bạn không thể chat với chính mình!");
    
    // Tạo phòng chat
    const roomId = await db.createChatRoom(listing, user.id);
    
    // Nếu có tin nhắn chat nhanh, logic gửi tin nhắn sẽ cần được xử lý ở đây 
    // (Giả sử hàm createChatRoom hoặc trang Chat nhận tham số initialMessage)
    // Ví dụ: navigate(`/chat/${roomId}?initMessage=${encodeURIComponent(message || "")}`);
    
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
    await db.reportListing({ listingId: listing.id, userId: user.id, reason: reportReason, details: reportDetails });
    alert("Cảm ơn bạn! Báo cáo của bạn đã được gửi tới Ban quản trị.");
    setShowReportModal(false);
  };

  const formatHiddenPhone = (phone: string) => {
    if (!phone) return "";
    return phone.substring(0, 4) + "*****";
  };

  return (
    <div className="bg-[#f4f4f4] min-h-screen pb-20 font-sans">
      {/* 1. BREADCRUMB */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-3">
            <nav className="flex items-center gap-2 text-xs text-gray-500 overflow-x-auto no-scrollbar whitespace-nowrap">
                <Link to="/" className="text-blue-600 hover:underline">Trang chủ</Link>
                <span className="text-gray-400">/</span>
                <Link to={`/search?location=${listing.location}`} className="hover:text-blue-600">{listing.location}</Link>
                <span className="text-gray-400">/</span>
                {currentCategory ? (
                <Link to={`/danh-muc/${currentCategory.slug}`} className="hover:text-blue-600">
                    {currentCategory.name}
                </Link>
                ) : <span>...</span>}
                <span className="text-gray-400">/</span>
                <span className="text-gray-800 truncate max-w-[200px]" title={listing.title}>{listing.title}</span>
            </nav>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="grid lg:grid-cols-12 gap-4">
            
            {/* --- CỘT TRÁI (8 phần): ẢNH, MÔ TẢ, ĐÁNH GIÁ --- */}
            <div className="lg:col-span-8 space-y-4">
                
                {/* Image Gallery */}
                <div className="bg-white rounded border border-gray-200 overflow-hidden">
                    <div className="relative bg-black aspect-[4/3] group">
                        <img 
                            src={listing.images[activeImage]} 
                            className="w-full h-full object-contain" 
                            alt={listing.title} 
                        />
                        {/* Arrows */}
                        {listing.images.length > 1 && (
                        <>
                            <button onClick={() => setActiveImage(prev => prev > 0 ? prev - 1 : listing.images.length - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/30 text-white rounded-full hover:bg-black/50 transition-colors">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth={2}/></svg>
                            </button>
                            <button onClick={() => setActiveImage(prev => prev < listing.images.length - 1 ? prev + 1 : 0)} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/30 text-white rounded-full hover:bg-black/50 transition-colors">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeWidth={2}/></svg>
                            </button>
                        </>
                        )}
                        <div className="absolute bottom-2 right-2 bg-black/60 text-white px-3 py-1 rounded text-xs font-medium">
                            {activeImage + 1} / {listing.images.length}
                        </div>
                    </div>
                    {/* Thumbnails */}
                    {listing.images.length > 1 && (
                        <div className="flex gap-2 p-2 overflow-x-auto no-scrollbar border-t border-gray-100 bg-white">
                            {listing.images.map((img, idx) => (
                                <button key={idx} onClick={() => setActiveImage(idx)} className={`w-16 h-12 flex-shrink-0 border rounded overflow-hidden ${activeImage === idx ? 'border-yellow-400 ring-1 ring-yellow-400' : 'border-gray-200 opacity-60 hover:opacity-100'}`}>
                                    <img src={img} className="w-full h-full object-cover" alt="" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Mô tả chi tiết */}
                <div className="bg-white rounded border border-gray-200 p-4">
                    <h3 className="font-bold text-gray-900 mb-3 text-base uppercase">Mô tả chi tiết</h3>
                    <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">{listing.description}</p>
                    
                    <div className="mt-6 pt-4 border-t border-gray-100 grid grid-cols-2 gap-y-2 text-sm">
                        <div className="flex gap-2"><span className="text-gray-500">Danh mục:</span> <span className="text-blue-600 font-medium">{currentCategory?.name || listing.category}</span></div>
                        <div className="flex gap-2"><span className="text-gray-500">Tình trạng:</span> <span>{listing.condition === 'new' ? 'Mới 100%' : 'Đã sử dụng'}</span></div>
                        <div className="flex gap-2"><span className="text-gray-500">Khu vực:</span> <span>{listing.location}</span></div>
                    </div>
                </div>

                {/* PHẦN ĐÁNH GIÁ & BÌNH LUẬN (Đặt ở đây cho rộng rãi) */}
                <div className="bg-white rounded border border-gray-200 p-4">
                     <h3 className="font-bold text-gray-900 mb-4 text-base uppercase border-b pb-2">Đánh giá & Bình luận</h3>
                     <ReviewSection targetId={listing.id} targetType="listing" currentUser={user} />
                </div>
            </div>

            {/* --- CỘT PHẢI (4 phần): STICKY --- */}
            <div className="lg:col-span-4 space-y-3">
                
                {/* 1. Tiêu đề - Giá - Nút Chat/Gọi */}
                <div className="bg-white rounded border border-gray-200 p-4 shadow-sm sticky top-24">
                    <h1 className="text-lg font-bold text-gray-900 leading-snug mb-2">
                        {listing.title}
                    </h1>
                    
                    {/* Giá tiền: Đỏ, To, Đậm */}
                    <div className="text-red-600 font-bold text-xl mb-4 flex items-center gap-2">
                        {formatPrice(listing.price)}
                        <span className="text-xs text-gray-400 font-normal line-through"></span>
                    </div>

                    {/* Nút Action */}
                    <div className="flex gap-2 mb-4">
                        <button onClick={() => handleStartChat()} className="flex-1 flex flex-col items-center justify-center py-2 px-4 border border-green-600 text-green-600 bg-white rounded font-bold text-sm hover:bg-green-50 transition-colors">
                            <span className="text-lg">💬</span>
                            <span>Chat</span>
                        </button>
                        
                        {seller?.phone ? (
                            isPhoneVisible ? (
                                <a href={`tel:${seller.phone}`} className="flex-[2] flex flex-col items-center justify-center py-2 px-4 bg-yellow-400 text-white rounded font-bold text-sm hover:bg-yellow-500 transition-colors shadow-sm">
                                    <span className="text-lg">📞</span>
                                    <span>{seller.phone}</span>
                                </a>
                            ) : (
                                <button onClick={() => setIsPhoneVisible(true)} className="flex-[2] flex flex-col items-center justify-center py-2 px-4 bg-yellow-400 text-white rounded font-bold text-sm hover:bg-yellow-500 transition-colors shadow-sm">
                                    <span className="text-lg font-bold">📞 Hiện số</span>
                                    <span className="text-xs font-normal opacity-90">{formatHiddenPhone(seller.phone)}</span>
                                </button>
                            )
                        ) : (
                             <button disabled className="flex-[2] bg-gray-200 text-gray-500 rounded font-bold text-sm">Chưa có SĐT</button>
                        )}
                    </div>
                </div>

                {/* 2. CARD NGƯỜI BÁN (Dữ liệu thật) */}
                <div className="bg-white rounded border border-gray-200 p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <Link to={`/seller/${listing.sellerId}`} className="relative block">
                            <img 
                                src={listing.sellerAvatar || "https://via.placeholder.com/50"} 
                                alt={listing.sellerName} 
                                className="w-12 h-12 rounded-full object-cover border border-gray-100" 
                            />
                            {/* Chấm xanh Online */}
                            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" title="Đang hoạt động"></span>
                        </Link>
                        <div className="flex-1 min-w-0">
                            <Link to={`/seller/${listing.sellerId}`} className="font-bold text-gray-900 block hover:underline truncate text-sm">
                                {listing.sellerName}
                            </Link>
                            <div className="flex items-center gap-2 text-xs mt-1">
                                {/* HIỂN THỊ RATING THẬT TỪ DỮ LIỆU SELLER */}
                                <div className="flex items-center gap-1 text-yellow-500 font-bold border border-yellow-200 bg-yellow-50 px-1.5 py-0.5 rounded">
                                   <span>{(seller as any)?.rating?.toFixed(1) || "5.0"}</span> 
                                   <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                                </div>
                                <span className="text-gray-400">• {(seller as any)?.reviewCount || 0} đánh giá</span>
                            </div>
                        </div>
                        <Link to={`/seller/${listing.sellerId}`} className="text-xs font-bold border border-orange-400 text-orange-500 px-3 py-1.5 rounded-full hover:bg-orange-50 transition-colors">
                            Xem trang
                        </Link>
                    </div>
                </div>

                {/* 3. CHAT NHANH (Quick Chat) */}
                <div className="bg-white rounded border border-gray-200 p-4 shadow-sm">
                    <p className="text-xs font-bold text-gray-500 uppercase mb-3">Chat nhanh với người bán</p>
                    <div className="flex flex-wrap gap-2 mb-3">
                        {QUICK_CHAT_MESSAGES.map((msg, idx) => (
                             <button 
                                key={idx}
                                onClick={() => handleStartChat(msg)}
                                className="text-xs bg-gray-100 hover:bg-blue-50 hover:text-blue-600 text-gray-700 py-2 px-3 rounded-full transition-colors border border-transparent hover:border-blue-200 text-left"
                             >
                                {msg}
                             </button>
                        ))}
                    </div>
                    {/* Input giả lập để kích thích người dùng bấm */}
                    <div className="relative">
                        <input 
                            type="text" 
                            placeholder="Nhập nội dung chat..."
                            value={customMessage}
                            onChange={(e) => setCustomMessage(e.target.value)}
                            className="w-full border border-gray-300 rounded-full py-2 px-4 text-sm focus:outline-none focus:border-green-500"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && customMessage.trim()) {
                                    handleStartChat(customMessage);
                                }
                            }}
                        />
                        <button 
                            onClick={() => customMessage.trim() && handleStartChat(customMessage)}
                            className="absolute right-1 top-1 bg-green-500 text-white p-1.5 rounded-full hover:bg-green-600"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                        </button>
                    </div>
                </div>

                {/* 4. Action phụ (Lưu, Share, Report) */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                    <button onClick={handleToggleFav} className="bg-white border border-gray-200 rounded p-2 text-xs font-bold text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-2">
                         <svg className={`w-4 h-4 ${userFavorites.includes(listing.id) ? 'text-red-500 fill-current' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" strokeWidth={2}/></svg>
                         {userFavorites.includes(listing.id) ? 'Đã lưu' : 'Lưu tin'}
                    </button>
                    <button onClick={() => setIsShareModalOpen(true)} className="bg-white border border-gray-200 rounded p-2 text-xs font-bold text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-2">
                         <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" strokeWidth={2}/></svg>
                         Chia sẻ
                    </button>
                </div>
                <button onClick={() => setShowReportModal(true)} className="w-full text-xs text-gray-400 hover:text-red-500 underline text-center py-2">
                    Báo cáo tin này
                </button>
            </div>
        </div>
      </div>

      {/* Sản phẩm tương tự */}
      <div className="max-w-6xl mx-auto px-4 mt-8">
        <div className="flex items-center justify-between mb-4">
             <h2 className="font-bold text-lg text-gray-900 uppercase">Tin đăng tương tự</h2>
             <Link to={`/?category=${listing.category}`} className="text-sm font-bold text-blue-600 hover:underline">Xem tất cả</Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {similarListings.map(l => (
            <ListingCard 
              key={l.id} 
              listing={l} 
              isFavorite={userFavorites.includes(l.id)} 
              onToggleFavorite={handleToggleFav} 
            />
          ))}
        </div>
      </div>

      {/* Report Modal & Share Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowReportModal(false)}></div>
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl relative animate-fade-in-up border border-gray-200">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Báo cáo vi phạm</h3>
            <div className="space-y-3">
              <select value={reportReason} onChange={(e) => setReportReason(e.target.value)} className="w-full border rounded p-3 text-sm">
                  <option value="">Chọn lý do...</option>
                  {REPORT_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <textarea rows={3} placeholder="Mô tả thêm..." value={reportDetails} onChange={(e) => setReportDetails(e.target.value)} className="w-full border rounded p-3 text-sm" />
              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowReportModal(false)} className="flex-1 py-3 bg-gray-100 rounded font-bold text-sm text-gray-600">Hủy</button>
                <button onClick={handleReport} className="flex-1 py-3 bg-red-500 text-white rounded font-bold text-sm">Gửi báo cáo</button>
              </div>
            </div>
          </div>
        </div>
      )}
      <ShareModal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} url={getListingUrl(listing)} title={listing.title} />
    </div>
  );
};

export default ListingDetail;
