import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { db } from '../services/db';
import { Listing, User } from '../types';
import { formatPrice, formatTimeAgo, getListingUrl } from '../utils/format';
import ListingCard from '../components/ListingCard';
import ShareModal from '../components/ShareModal';
import ReviewSection from '../components/ReviewSection';
import OfferModal from '../components/OfferModal'; // [MỚI] Import Modal Mặc cả
import { CATEGORIES } from '../constants';

// --- IMPORT LEAFLET MAP ---
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

// Fix lỗi icon Leaflet mặc định
let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const REPORT_REASONS = [
  "Lừa đảo, giả mạo",
  "Hàng giả, hàng nhái",
  "Thông tin không chính xác",
  "Hàng cấm buôn bán",
  "Sản phẩm đã bán",
  "Lý do khác"
];

const STATIC_LINKS = [
  { slug: 'gioi-thieu', title: 'Giới thiệu' },
  { slug: 'quy-che-hoat-dong', title: 'Quy chế hoạt động' },
  { slug: 'chinh-sach-bao-mat', title: 'Chính sách bảo mật' },
  { slug: 'meo-mua-ban-an-toan', title: 'Mẹo an toàn' },
  { slug: 'huong-dan-dang-tin', title: 'Hỗ trợ' },
];

const ATTRIBUTE_LABELS: Record<string, { label: string; icon: string }> = {
  mileage: { label: 'Số Km đã đi', icon: '🚗' },
  year: { label: 'Năm sản xuất', icon: '📅' },
  gearbox: { label: 'Hộp số', icon: '⚙️' },
  fuel: { label: 'Nhiên liệu', icon: '⛽' },
  carType: { label: 'Kiểu dáng', icon: '🚙' },
  seatCount: { label: 'Số chỗ', icon: '💺' },
  area: { label: 'Diện tích', icon: '📐' },
  bedrooms: { label: 'Phòng ngủ', icon: '🛏️' },
  bathrooms: { label: 'Số WC', icon: '🚿' },
  direction: { label: 'Hướng nhà', icon: '🧭' },
  legal: { label: 'Pháp lý', icon: '📜' },
  propertyType: { label: 'Loại hình', icon: '🏘️' },
  battery: { label: 'Pin', icon: '🔋' },
  storage: { label: 'Bộ nhớ', icon: '💾' },
  ram: { label: 'RAM', icon: '⚡' },
  color: { label: 'Màu sắc', icon: '🎨' },
  warranty: { label: 'Bảo hành', icon: '🛡️' },
  capacity: { label: 'Công suất', icon: '❄️' },
  inverter: { label: 'Inverter', icon: '📉' },
  breed: { label: 'Giống loài', icon: '🐕' },
  age: { label: 'Độ tuổi', icon: '🐾' },
  gender: { label: 'Giới tính', icon: '⚧' },
  material: { label: 'Chất liệu', icon: '🪵' },
  size: { label: 'Kích thước', icon: '📏' },
  brand: { label: 'Thương hiệu', icon: '🏷️' },
  personalSize: { label: 'Size', icon: '👕' },
  salary: { label: 'Mức lương', icon: '💰' },
  jobType: { label: 'Hình thức', icon: '💼' },
  experience: { label: 'Kinh nghiệm', icon: '🎓' },
};

const ListingDetail: React.FC<{ user: User | null }> = ({ user }) => {
  const { slugWithId } = useParams();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
   
  const [listing, setListing] = useState<Listing | null>(null);
  const [seller, setSeller] = useState<User | null>(null);
  const [allListings, setAllListings] = useState<Listing[]>([]);
  const [activeMedia, setActiveMedia] = useState(0); 
  const [userFavorites, setUserFavorites] = useState<string[]>([]);
  
  // Modals State
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false); // [MỚI] State Offer Modal

  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [isPhoneVisible, setIsPhoneVisible] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);
  
  // Video Controls
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);

  const id = useMemo(() => {
    if (!slugWithId) return null;
    const parts = slugWithId.split('-');
    return parts[parts.length - 1];
  }, [slugWithId]);

  // Hợp nhất Ảnh và Video thành một mảng Media
  const mediaList = useMemo(() => {
    if (!listing) return [];
    const list = [...listing.images];
    if (listing.videoUrl) {
        list.unshift(listing.videoUrl); // Video luôn ở đầu
    }
    return list;
  }, [listing]);

  useEffect(() => {
    if (!id) return;
    db.incrementListingView(id);
    const loadListing = async () => {
        const l = await db.getListingById(id);
        if (l) {
            setListing(l);
            db.getUserById(l.sellerId).then(setSeller);
            if (user) db.getFavorites(user.id).then(setUserFavorites);
            db.getListings().then(setAllListings);
        }
    };
    loadListing();
    window.scrollTo(0, 0);
  }, [id, user]);

  const similarListings = useMemo(() => {
    if (!listing) return [];
    return allListings
      .filter(l => l.id !== listing.id && l.category === listing.category)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 12);
  }, [allListings, listing]);

  if (!listing) return null;
  const currentCategory = CATEGORIES.find(c => c.id === listing.category);
  const isVideoActive = listing.videoUrl && activeMedia === 0;

  // --- ACTIONS ---
  const handleToggleFav = async () => {
    if (!user) return navigate('/login');
    await db.toggleFavorite(user.id, listing.id);
    db.getFavorites(user.id).then(setUserFavorites);
  };

  const handleStartChat = async () => {
    if (!user) return navigate('/login');
    if (user.id === listing.sellerId) return;
    setIsChatLoading(true);
    try {
        const roomId = await db.createChatRoom(listing, user);
        navigate(`/chat/${roomId}`);
    } catch (e) { alert("Lỗi kết nối chat."); }
    finally { setIsChatLoading(false); }
  };

  // [MỚI] Hàm xử lý Mặc cả
  const handleMakeOffer = async (offerPrice: number) => {
    if (!user) {
        alert("Vui lòng đăng nhập để mặc cả!");
        navigate('/login');
        return;
    }
    if (user.id === listing.sellerId) {
        alert("Bạn không thể mặc cả sản phẩm của chính mình!");
        return;
    }

    setShowOfferModal(false);
    const result = await db.createOffer(listing, user, offerPrice);
    
    if (result.success) {
        alert(`✅ Đã gửi đề nghị giá ${offerPrice.toLocaleString()}đ thành công! Chủ shop sẽ trả lời bạn qua Chat.`);
        // Optional: Chuyển hướng sang chat luôn để xem tin nhắn offer
        // navigate(`/chat/${result.offerId}`); // Cần chỉnh lại logic navigate nếu muốn
    } else {
        alert("Lỗi: " + result.message);
    }
  };

  const handleReport = async () => {
    if (!user) return navigate('/login');
    if (!reportReason) return alert("Vui lòng chọn lý do báo cáo");
    await db.reportListing({ listingId: listing.id, userId: user.id, reason: reportReason, details: reportDetails });
    alert("Báo cáo của bạn đã được gửi.");
    setShowReportModal(false);
  };

  const handleVideoPlayPause = () => {
      if (videoRef.current) {
          if (videoRef.current.paused) {
              videoRef.current.play();
              setIsPlaying(true);
          } else {
              videoRef.current.pause();
              setIsPlaying(false);
          }
      }
  };

  return (
    <div className="max-w-7xl mx-auto md:px-4 lg:px-8 py-0 md:py-8 space-y-6 pb-24 font-sans">
      
      {/* BREADCRUMB */}
      <nav className="flex items-center gap-2 text-[10px] md:text-xs font-black uppercase tracking-widest text-gray-400 px-4 md:px-0">
        <Link to="/" className="hover:text-primary">Chợ Của Tui</Link>
        <span>/</span>
        {currentCategory && <Link to={`/danh-muc/${currentCategory.slug}`} className="hover:text-primary">{currentCategory.name}</Link>}
        <span>/</span>
        <span className="text-gray-900 truncate max-w-[200px]">{listing.title}</span>
      </nav>

      <div className="grid lg:grid-cols-12 gap-0 md:gap-8">
        
        {/* LEFT: MEDIA GALLERY & DETAILS */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* MEDIA VIEWER */}
          <div className="relative bg-black aspect-square md:aspect-video md:rounded-[2.5rem] overflow-hidden group shadow-2xl border border-gray-800">
            
            {/* RENDER VIDEO OR IMAGE */}
            {isVideoActive ? (
                <div className="relative w-full h-full cursor-pointer" onClick={handleVideoPlayPause}>
                    <video 
                        ref={videoRef}
                        src={listing.videoUrl} 
                        poster={listing.images[0] || ""} 
                        className="w-full h-full object-contain bg-black"
                        autoPlay 
                        loop 
                        muted={isMuted}
                        playsInline
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                    />
                    
                    {/* Play Button Overlay */}
                    {!isPlaying && (
                        <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/30 backdrop-blur-[2px]">
                            <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/50 shadow-xl transition-transform hover:scale-110">
                                <svg className="w-10 h-10 text-white fill-current ml-1" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                            </div>
                        </div>
                    )}

                    {/* Controls Overlay */}
                    <div className="absolute bottom-6 left-6 right-6 z-30 flex justify-between items-end pointer-events-none">
                        <button 
                            onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }}
                            className="pointer-events-auto bg-black/60 backdrop-blur-md text-white p-3 rounded-full hover:bg-primary transition-all border border-white/10"
                        >
                            {isMuted ? '🔇' : '🔊'}
                        </button>

                        <div className="bg-primary text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest animate-pulse shadow-lg">
                            Video Sống động
                        </div>
                    </div>
                </div>
            ) : (
                <img 
                    src={mediaList[activeMedia]} 
                    className="w-full h-full object-contain select-none bg-gray-100" 
                    alt={listing.title} 
                />
            )}

            {/* WATERMARK */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 opacity-20">
               <span className="text-white text-5xl md:text-7xl font-black uppercase tracking-[0.5em] -rotate-45 whitespace-nowrap drop-shadow-lg">CHỢ CỦA TUI</span>
            </div>

            {/* NAVIGATION */}
            {mediaList.length > 1 && (
              <>
                <button onClick={() => setActiveMedia(prev => prev > 0 ? prev - 1 : mediaList.length - 1)} className="absolute left-4 top-1/2 -translate-y-1/2 p-4 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-primary transition-all z-40 shadow-xl opacity-0 group-hover:opacity-100 pointer-events-auto border border-white/10">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <button onClick={() => setActiveMedia(prev => prev < mediaList.length - 1 ? prev + 1 : 0)} className="absolute right-4 top-1/2 -translate-y-1/2 p-4 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-primary transition-all z-40 shadow-xl opacity-0 group-hover:opacity-100 pointer-events-auto border border-white/10">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                </button>
              </>
            )}
            
            <div className="absolute bottom-6 right-6 bg-black/60 backdrop-blur-md text-white px-5 py-2 rounded-full text-xs font-black border border-white/10 z-30">
                {activeMedia + 1} / {mediaList.length}
            </div>
          </div>

          {/* THUMBNAILS */}
          <div className="hidden md:flex gap-3 overflow-x-auto no-scrollbar py-2">
            {mediaList.map((item, idx) => (
              <button 
                key={idx} 
                onClick={() => setActiveMedia(idx)} 
                className={`w-24 h-24 rounded-2xl overflow-hidden border-4 transition-all flex-shrink-0 relative group/thumb ${activeMedia === idx ? 'border-primary shadow-xl scale-105' : 'border-transparent opacity-60 hover:opacity-100'}`}
              >
                <img 
                    src={listing.videoUrl && idx === 0 ? listing.images[0] : item} 
                    className="w-full h-full object-cover" 
                    alt="" 
                />
                
                {listing.videoUrl && idx === 0 && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <div className="w-8 h-8 rounded-full bg-white/30 backdrop-blur flex items-center justify-center border border-white/50">
                            <span className="text-white text-sm">▶️</span>
                        </div>
                    </div>
                )}
              </button>
            ))}
          </div>

          {/* ATTRIBUTES */}
          {listing.attributes && Object.keys(listing.attributes).length > 0 && (
            <div className="bg-white md:rounded-[2.5rem] p-8 md:p-12 border border-gray-100 shadow-soft">
              <h2 className="text-xs font-black text-primary uppercase tracking-[0.3em] mb-10 border-l-4 border-primary pl-4">Thông số kỹ thuật</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-10">
                {Object.entries(listing.attributes).map(([key, value]) => {
                  const info = ATTRIBUTE_LABELS[key];
                  if (!value || !info) return null;
                  return (
                    <div key={key} className="flex items-center gap-4 group">
                      <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-3xl shadow-inner group-hover:bg-primary/10 transition-colors">{info.icon}</div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1">{info.label}</p>
                        <p className="text-sm font-black text-slate-800 truncate">{value}{key === 'mileage' ? ' Km' : key === 'area' ? ' m²' : ''}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* DESCRIPTION */}
          <div className="bg-white md:rounded-[2.5rem] p-8 md:p-12 border border-gray-100 shadow-soft space-y-6">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Mô tả từ người bán</h2>
            <p className="text-slate-700 leading-relaxed whitespace-pre-wrap font-medium text-lg italic border-l-4 border-slate-100 pl-6">"{listing.description}"</p>
          </div>

          {/* [ĐÃ KHÔI PHỤC] MAP SECTION */}
          {listing.lat && listing.lng && (
             <div className="bg-white md:rounded-[2.5rem] overflow-hidden border border-gray-100 shadow-soft h-[350px] relative z-0">
                <MapContainer center={[listing.lat, listing.lng]} zoom={15} style={{ height: '100%', width: '100%' }}>
                    <TileLayer 
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />
                    <Marker position={[listing.lat, listing.lng]}>
                        <Popup>{listing.address || "Vị trí người bán"}</Popup>
                    </Marker>
                </MapContainer>
                {/* Overlay chặn cuộn chuột khi chưa focus để tránh lỗi UX */}
                <div className="absolute inset-0 pointer-events-none border-[10px] border-white/50 z-[400] md:rounded-[2.5rem]"></div>
             </div>
          )}

          {/* REVIEWS */}
          <div className="bg-white md:rounded-[2.5rem] p-8 border border-gray-100 shadow-soft">
            <ReviewSection targetId={listing.id} targetType="listing" currentUser={user} />
          </div>
        </div>

        {/* RIGHT: CONTACT & INFO */}
        <div className="lg:col-span-4 p-4 md:p-0">
          <div className="bg-white md:rounded-[2.5rem] p-8 md:p-10 border border-gray-100 shadow-2xl space-y-8 sticky top-24">
            <div className="space-y-4">
              <p className={`text-4xl font-black tracking-tighter ${listing.affiliateLink ? 'text-orange-600' : 'text-primary'}`}>
                  {listing.price > 0 ? formatPrice(listing.price) : 'Liên hệ'}
              </p>
              <h1 className="text-2xl font-black text-slate-900 leading-tight uppercase tracking-tight">{listing.title}</h1>
              <div className="flex flex-col gap-3 pt-2 text-[10px] font-black uppercase text-slate-400">
                <div className="flex items-start gap-2"><span>📍</span><span className="mt-1">{listing.address || listing.location}</span></div>
                <div className="flex items-center gap-4">
                    <span>🕒 {formatTimeAgo(listing.createdAt)}</span>
                    {listing.viewCount !== undefined && <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600">👀 {listing.viewCount} lượt xem</span>}
                </div>
              </div>
            </div>

            {/* SELLER CARD */}
            <Link to={`/seller/${listing.sellerId}`} className="flex items-center gap-4 p-5 bg-slate-50 rounded-[2rem] border border-slate-100 hover:shadow-lg transition-all group">
                <img src={listing.sellerAvatar} className="w-16 h-16 rounded-2xl object-cover border-2 border-white shadow-md group-hover:rotate-6 transition-transform" alt="" />
                <div className="min-w-0">
                    <p className="font-black text-slate-900 group-hover:text-primary transition-colors">{listing.sellerName}</p>
                    {seller?.verificationStatus === 'verified' ? (
                        <p className="text-[9px] font-black text-blue-500 uppercase flex items-center gap-1 mt-1">✅ Đối tác uy tín</p>
                    ) : (
                        <p className="text-[9px] font-black text-green-500 uppercase flex items-center gap-1 mt-1"><span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> Đang online</p>
                    )}
                </div>
            </Link>

            {/* CTA BUTTONS (Affiliate / Chat / Offer) */}
            <div className="space-y-4">
              {listing.affiliateLink ? (
                <a href={listing.affiliateLink} target="_blank" rel="nofollow" className="w-full bg-orange-600 hover:bg-orange-700 text-white py-5 rounded-2xl font-black text-sm shadow-xl shadow-orange-200 flex items-center justify-center gap-3 animate-bounce">
                  🛒 ĐẾN NƠI BÁN ↗
                </a>
              ) : (
                <div className="flex gap-3">
                    {/* [MỚI] Nút Mặc cả */}
                    <button 
                        onClick={() => setShowOfferModal(true)}
                        className="flex-1 bg-green-50 text-green-600 border border-green-200 py-4 rounded-2xl font-black text-xs uppercase hover:bg-green-100 transition-all flex items-center justify-center gap-2"
                    >
                        <span>💸</span> Mặc cả
                    </button>

                    {/* Nút Chat */}
                    <button 
                        onClick={handleStartChat} 
                        disabled={isChatLoading} 
                        className="flex-[2] bg-primary hover:bg-primaryHover text-white py-4 rounded-2xl font-black text-xs uppercase shadow-xl shadow-primary/20 flex items-center justify-center gap-2 active:scale-95 transition-all"
                    >
                        {isChatLoading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <>💬 Chat ngay</>}
                    </button>
                </div>
              )}

              {!listing.affiliateLink && seller?.phone && (
                <button 
                    onClick={() => isPhoneVisible ? window.location.href=`tel:${seller.phone}` : setIsPhoneVisible(true)} 
                    className="w-full bg-white border-2 border-green-500 text-green-600 py-5 rounded-2xl font-black text-sm hover:bg-green-50 transition-all flex items-center justify-center gap-3 shadow-lg shadow-green-100"
                >
                    📞 {isPhoneVisible ? seller.phone : 'HIỆN SỐ ĐIỆN THOẠI'}
                </button>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={handleToggleFav} className="flex-1 py-4 border-2 border-slate-100 rounded-2xl text-[10px] font-black uppercase text-slate-500 hover:text-red-500 transition-colors flex items-center justify-center gap-2">
                  <svg className={`w-5 h-5 ${userFavorites.includes(listing.id) ? 'text-red-500 fill-current' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" strokeWidth={2.5}/></svg>
                  {userFavorites.includes(listing.id) ? 'Đã lưu' : 'Lưu tin'}
              </button>
              <button onClick={() => setIsShareModalOpen(true)} className="flex-1 py-4 border-2 border-slate-100 rounded-2xl text-[10px] font-black uppercase text-slate-500 hover:text-blue-500 transition-colors flex items-center justify-center gap-2">
                  <span>📤</span> Chia sẻ
              </button>
            </div>
            
            <button onClick={() => setShowReportModal(true)} className="w-full text-[9px] font-black text-gray-300 uppercase tracking-widest hover:text-red-400 transition-colors text-center">
                Báo cáo tin này
            </button>
          </div>
        </div>
      </div>

      {/* SIMILAR LISTINGS */}
      <div className="px-4 md:px-0 pt-10">
        <div className="flex items-center justify-between mb-8 px-2">
          <h2 className="text-xl font-black text-textMain tracking-tighter uppercase">Có thể bạn thích</h2>
          <Link to={`/?category=${listing.category}`} className="text-xs font-black text-primary hover:underline">Xem tất cả →</Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-5">
          {similarListings.map(l => (
            <ListingCard key={l.id} listing={l} isFavorite={userFavorites.includes(l.id)} onToggleFavorite={handleToggleFav} />
          ))}
          {similarListings.length === 0 && <div className="col-span-full py-20 text-center text-gray-300 text-xs font-bold uppercase tracking-widest">Chưa có sản phẩm tương tự.</div>}
        </div>
      </div>

      {/* REPORT MODAL */}
      {showReportModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowReportModal(false)}></div>
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl relative border border-gray-200">
            <h3 className="text-2xl font-black text-slate-900 mb-2 tracking-tighter">Báo cáo vi phạm</h3>
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase px-1">Lý do</label>
                <select value={reportReason} onChange={(e) => setReportReason(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-bold text-sm">
                  <option value="">Chọn lý do...</option>
                  {REPORT_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase px-1">Chi tiết</label>
                <textarea rows={3} placeholder="Mô tả thêm..." value={reportDetails} onChange={(e) => setReportDetails(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-medium" />
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={() => setShowReportModal(false)} className="flex-1 py-4.5 rounded-2xl font-black text-[11px] uppercase bg-gray-100 text-gray-400">Hủy</button>
                <button onClick={handleReport} className="flex-1 py-4.5 rounded-2xl font-black text-[11px] uppercase bg-red-500 text-white shadow-lg">Gửi báo cáo</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* [MỚI] OFFER MODAL */}
      {listing && (
        <OfferModal 
          isOpen={showOfferModal}
          onClose={() => setShowOfferModal(false)}
          onSubmit={handleMakeOffer}
          originalPrice={listing.price}
          productName={listing.title}
        />
      )}

      <ShareModal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} url={getListingUrl(listing)} title={listing.title} />

      {/* FOOTER DESKTOP */}
      <footer className="hidden md:block pt-20 border-t border-dashed border-gray-200 mt-20">
         <div className="bg-white border border-borderMain rounded-[3rem] p-12 shadow-soft">
            <div className="flex items-center justify-between mb-10">
               <h4 className="text-2xl font-black text-textMain flex items-center gap-3"><span className="text-3xl">⚡</span> Chợ Của Tui</h4>
               <div className="flex gap-6">
                  {STATIC_LINKS.map(link => <Link key={link.slug} to={`/page/${link.slug}`} className="text-[10px] font-black text-gray-400 hover:text-primary transition-colors uppercase tracking-widest">{link.title}</Link>)}
               </div>
            </div>
            <div className="text-[10px] text-gray-300 font-bold text-center border-t border-gray-50 pt-10 uppercase tracking-widest">© 2026 ChoCuaTui.vn - Trí tuệ nhân tạo phục vụ cộng đồng.</div>
         </div>
      </footer>
    </div>
  );
};

export default ListingDetail;
