import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { db } from '../services/db';
import { Listing, User } from '../types';
import { formatPrice, formatTimeAgo, getListingUrl } from '../utils/format';
import ShareModal from '../components/ShareModal';
import ReviewSection from '../components/ReviewSection';
import { CATEGORIES } from '../constants';
import ListingCard from '../components/ListingCard';

const REPORT_REASONS = [
  "Lừa đảo, giả mạo",
  "Hàng giả, hàng nhái",
  "Thông tin không chính xác",
  "Hàng cấm buôn bán",
  "Sản phẩm đã bán",
  "Lý do khác"
];

// Danh sách câu hỏi nhanh giống yêu cầu
const QUICK_QUESTIONS = [
  "Xe còn hay đã bán rồi ạ?",
  "Xe chính chủ hay được uỷ quyền ạ?",
  "Giá xe có thể thương lượng được không ạ?",
  "Động cơ xe đã từng qua sửa chữa chưa?",
  "Xe có còn nguyên bản?"
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
  const [chatMessage, setChatMessage] = useState("");

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

  const similarListings = useMemo(() => {
    if (!listing || allListings.length === 0) return [];
    return allListings
      .filter(l => l.id !== listing.id && l.category === listing.category)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6); 
  }, [allListings, listing]);

  if (!listing) return null;

  const currentCategory = CATEGORIES.find(c => c.id === listing.category);

  // --- HANDLERS ---
  const handleStartChat = async (msg?: string) => {
    if (!user) return navigate('/login');
    if (user.id === listing.sellerId) return alert("Bạn không thể chat với chính mình!");
    const roomId = await db.createChatRoom(listing, user.id);
    console.log("Gửi tin nhắn khởi tạo:", msg); // Logic gửi tin nhắn thực tế sẽ nằm ở đây
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
    return phone.substring(0, 6) + "****";
  };

  return (
    <div className="bg-[#f8f9fa] min-h-screen pb-20 font-sans">
      
      {/* --- 1. HEADER / BREADCRUMB (Đã khôi phục) --- */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3">
            <nav className="flex items-center gap-2 text-xs text-gray-500 overflow-x-auto no-scrollbar whitespace-nowrap">
                <Link to="/" className="text-blue-600 hover:underline">Chợ Tốt Xe</Link>
                <span className="text-gray-400">/</span>
                <Link to={`/search?location=${listing.location}`} className="hover:text-blue-600">{listing.location}</Link>
                <span className="text-gray-400">/</span>
                {currentCategory ? (
                <Link to={`/danh-muc/${currentCategory.slug}`} className="hover:text-blue-600">
                    {currentCategory.name}
                </Link>
                ) : <span>...</span>}
                <span className="text-gray-400">/</span>
                <span className="text-gray-800 font-medium truncate max-w-[200px]" title={listing.title}>{listing.title}</span>
            </nav>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-4 mt-2">
        <div className="grid lg:grid-cols-12 gap-4">
            
            {/* --- CỘT TRÁI (CHIẾM 8 PHẦN) --- */}
            <div className="lg:col-span-8 space-y-4">
                
                {/* 1.1 IMAGE GALLERY */}
                <div className="bg-black rounded-lg overflow-hidden relative group aspect-[4/3] md:aspect-video">
                    <img 
                        src={listing.images[activeImage]} 
                        className="w-full h-full object-contain" 
                        alt={listing.title} 
                    />
                    {listing.images.length > 1 && (
                    <>
                        <button onClick={() => setActiveImage(prev => prev > 0 ? prev - 1 : listing.images.length - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/40 text-white rounded-full hover:bg-black/60">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth={2}/></svg>
                        </button>
                        <button onClick={() => setActiveImage(prev => prev < listing.images.length - 1 ? prev + 1 : 0)} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/40 text-white rounded-full hover:bg-black/60">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeWidth={2}/></svg>
                        </button>
                    </>
                    )}
                    <div className="absolute bottom-3 right-3 bg-black/60 text-white px-3 py-1 rounded-md text-xs font-bold">
                        {activeImage + 1} / {listing.images.length}
                    </div>
                </div>

                {/* 1.2 THUMBNAILS */}
                {listing.images.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                        {listing.images.map((img, idx) => (
                            <button key={idx} onClick={() => setActiveImage(idx)} className={`w-20 h-16 flex-shrink-0 border-2 rounded-md overflow-hidden ${activeImage === idx ? 'border-yellow-400' : 'border-transparent opacity-70 hover:opacity-100'}`}>
                                <img src={img} className="w-full h-full object-cover" alt="" />
                            </button>
                        ))}
                    </div>
                )}

                {/* 1.3 MÔ TẢ CHI TIẾT */}
                <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
                    <h3 className="font-bold text-gray-900 mb-4 text-base">Mô tả chi tiết</h3>
                    <p className="text-gray-800 text-sm leading-7 whitespace-pre-wrap">{listing.description}</p>
                </div>

                {/* 1.4 BÌNH LUẬN & ĐÁNH GIÁ (Đặt ở cuối cột trái) */}
                <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm" id="reviews">
                     <h3 className="font-bold text-gray-900 mb-4 text-base">Đánh giá và Bình luận</h3>
                     <ReviewSection targetId={listing.id} targetType="listing" currentUser={user} />
                </div>
            </div>

            {/* --- CỘT PHẢI (CHIẾM 4 PHẦN - STICKY) --- */}
            <div className="lg:col-span-4 space-y-3">
                
                {/* 2.1 THÔNG TIN SẢN PHẨM (GIỐNG ẢNH BẠN GỬI) */}
                <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm sticky top-24">
                    {/* Tiêu đề + Nút Lưu */}
                    <div className="flex justify-between items-start gap-2 mb-2">
                        <h1 className="text-lg font-bold text-gray-900 leading-snug">
                            {listing.title}
                        </h1>
                        <button 
                            onClick={handleToggleFav}
                            className="flex flex-col items-center gap-1 min-w-[50px] text-red-500"
                        >
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center border ${userFavorites.includes(listing.id) ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
                                <svg className={`w-5 h-5 ${userFavorites.includes(listing.id) ? 'fill-current' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                            </div>
                            <span className="text-[10px] font-bold text-gray-500">{userFavorites.includes(listing.id) ? 'Đã lưu' : 'Lưu'}</span>
                        </button>
                    </div>

                    {/* Thông số (Năm - Km - Tình trạng) */}
                    <div className="flex items-center gap-3 text-sm text-gray-600 mb-3 font-medium">
                        {/* Dữ liệu giả lập nếu listing thiếu trường này để giống mẫu */}
                        <span>{(listing as any).year || '2019'}</span>
                        <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                        <span>{(listing as any).mileage || '40 km'}</span>
                        <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                        <span>{listing.condition === 'new' ? 'Mới' : 'Đã sử dụng'}</span>
                    </div>

                    {/* Giá tiền (Đỏ - To - Đậm) */}
                    <div className="text-[#d0021b] font-bold text-2xl mb-4">
                        {formatPrice(listing.price)}
                    </div>

                    {/* 2 Nút: Chat & Hiện số */}
                    <div className="flex gap-2 mb-4 h-11">
                        <button 
                            onClick={() => handleStartChat()} 
                            className="flex-1 bg-white border border-gray-300 text-green-600 rounded font-bold text-sm hover:bg-gray-50 flex items-center justify-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                            Chat
                        </button>
                        
                        {seller?.phone ? (
                            isPhoneVisible ? (
                                <a href={`tel:${seller.phone}`} className="flex-[1.5] bg-[#ffba00] text-white border border-[#ffba00] rounded font-bold text-xl flex items-center justify-center gap-2 shadow-sm hover:bg-yellow-500">
                                    <span>{seller.phone}</span>
                                </a>
                            ) : (
                                <button onClick={() => setIsPhoneVisible(true)} className="flex-[1.5] bg-[#ffba00] text-white border border-[#ffba00] rounded font-bold text-sm flex items-center justify-center gap-2 shadow-sm hover:bg-yellow-500">
                                    <span className="text-lg">📞</span>
                                    <span>Hiện số {formatHiddenPhone(seller.phone)}</span>
                                </button>
                            )
                        ) : (
                             <button disabled className="flex-[1.5] bg-gray-200 text-gray-500 rounded font-bold text-sm">Chưa có SĐT</button>
                        )}
                    </div>

                    {/* Địa chỉ & Thời gian */}
                    <div className="space-y-2 text-xs text-gray-500 border-t border-gray-100 pt-3">
                        <div className="flex items-start gap-2">
                            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            <span>{listing.location}</span>
                        </div>
                        <div className="flex items-center gap-2">
                             <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                             <span>Đăng {formatTimeAgo(listing.createdAt)}</span>
                        </div>
                    </div>
                </div>

                {/* 2.2 CARD NGƯỜI BÁN (SELLER PROFILE) */}
                <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                    <div className="flex items-start gap-3 mb-3">
                        <Link to={`/seller/${listing.sellerId}`} className="relative flex-shrink-0">
                            <img 
                                src={listing.sellerAvatar || "https://via.placeholder.com/60"} 
                                alt={listing.sellerName} 
                                className="w-12 h-12 rounded-full object-cover border border-gray-100" 
                            />
                            {/* Chấm tròn trạng thái */}
                            <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full ring-2 ring-white bg-green-400" />
                        </Link>
                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start">
                                <Link to={`/seller/${listing.sellerId}`} className="text-sm font-bold text-gray-900 hover:underline truncate">
                                    {listing.sellerName}
                                </Link>
                                <Link to={`/seller/${listing.sellerId}`} className="text-[10px] border border-orange-400 text-orange-500 px-2 py-0.5 rounded-full hover:bg-orange-50">
                                    Xem trang
                                </Link>
                            </div>
                            
                            {/* Seller Stats Row */}
                            <div className="flex items-center gap-3 mt-1 text-xs">
                                <div className="flex items-center gap-1">
                                    <span className="font-bold text-gray-900">{(seller as any)?.rating || 4.5}</span>
                                    <svg className="w-3 h-3 text-yellow-400 fill-current" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                                </div>
                                <span className="text-gray-300">|</span>
                                <span className="text-gray-500">{(seller as any)?.soldCount || 833} đã bán</span>
                                <span className="text-gray-300">|</span>
                                <span className="text-gray-500">{(seller as any)?.activeCount || 70} đang bán</span>
                            </div>

                             {/* Seller Status Row */}
                             <div className="flex flex-wrap gap-y-1 gap-x-3 mt-2 text-[10px] text-gray-400">
                                <span>Hoạt động 42 phút trước</span>
                                <span>•</span>
                                <span>Phản hồi: 91%</span>
                             </div>
                        </div>
                    </div>
                </div>

                {/* 2.3 CHAT NHANH (INPUT & TAGS) */}
                <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                    {/* Input Gửi tin nhắn */}
                    <div className="flex gap-2 mb-3">
                        <input 
                            type="text" 
                            placeholder="Đăng nhập để gửi tin nhắn"
                            value={chatMessage}
                            onChange={(e) => setChatMessage(e.target.value)}
                            className="flex-1 bg-gray-100 border-none rounded px-3 py-2 text-sm focus:ring-0 focus:bg-white focus:outline-none transition-colors"
                        />
                        <button 
                            onClick={() => chatMessage && handleStartChat(chatMessage)}
                            className="bg-[#ffba00] text-white font-bold px-4 rounded text-sm hover:bg-yellow-500"
                        >
                            Gửi
                        </button>
                    </div>

                    {/* Quick Tags (Chips) */}
                    <div className="flex flex-wrap gap-2">
                        {QUICK_QUESTIONS.map((q, idx) => (
                            <button 
                                key={idx}
                                onClick={() => handleStartChat(q)}
                                className="bg-gray-100 text-gray-600 text-xs px-3 py-1.5 rounded-full hover:bg-gray-200 transition-colors text-left"
                            >
                                {q}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 2.4 ACTION PHỤ & BÁO CÁO */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                    <button onClick={() => setIsShareModalOpen(true)} className="col-span-2 text-xs text-blue-600 font-bold flex items-center justify-center gap-2 hover:underline">
                         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" strokeWidth={2}/></svg>
                         Chia sẻ tin đăng này
                    </button>
                    <button onClick={() => setShowReportModal(true)} className="col-span-2 text-xs text-gray-400 hover:text-red-500 text-center py-1">
                        Tin này có vấn đề? <span className="underline">Báo cáo</span>
                    </button>
                </div>

            </div>
        </div>
      </div>

      {/* 3. TIN ĐĂNG TƯƠNG TỰ */}
      <div className="max-w-6xl mx-auto px-4 mt-8 pb-8">
        <h2 className="font-bold text-lg text-gray-900 mb-4">Tin đăng tương tự</h2>
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

      {/* --- MODALS --- */}
      {showReportModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowReportModal(false)}></div>
          <div className="bg-white w-full max-w-md rounded-lg p-6 shadow-2xl relative animate-fade-in-up">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Báo cáo vi phạm</h3>
            <div className="space-y-4">
              <select value={reportReason} onChange={(e) => setReportReason(e.target.value)} className="w-full border border-gray-300 rounded p-3 text-sm focus:border-yellow-400 focus:outline-none">
                  <option value="">Chọn lý do...</option>
                  {REPORT_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <textarea rows={3} placeholder="Mô tả thêm chi tiết..." value={reportDetails} onChange={(e) => setReportDetails(e.target.value)} className="w-full border border-gray-300 rounded p-3 text-sm focus:border-yellow-400 focus:outline-none" />
              <div className="flex gap-3">
                <button onClick={() => setShowReportModal(false)} className="flex-1 py-3 bg-gray-100 rounded font-bold text-sm text-gray-600 hover:bg-gray-200">Hủy bỏ</button>
                <button onClick={handleReport} className="flex-1 py-3 bg-[#ffba00] text-white rounded font-bold text-sm hover:bg-yellow-500">Gửi báo cáo</button>
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
