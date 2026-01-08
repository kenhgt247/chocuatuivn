import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { db } from '../services/db';
import { Listing, User } from '../types';
import { formatPrice, formatTimeAgo, getListingUrl } from '../utils/format';
import ListingCard from '../components/ListingCard';
import ShareModal from '../components/ShareModal';
import ReviewSection from '../components/ReviewSection';
import { CATEGORIES } from '../constants';

// --- IMPORT LEAFLET MAP ---
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix icon lỗi mặc định của Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

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
  const [isChatLoading, setIsChatLoading] = useState(false); // Thêm state loading cho chat

  const id = useMemo(() => {
    if (!slugWithId) return null;
    const parts = slugWithId.split('-');
    return parts[parts.length - 1];
  }, [slugWithId]);

  useEffect(() => {
    if (!id) return;
    const loadListing = async () => {
      // Logic tải dữ liệu tương thích cả 2 version DB
      if (db.getListingById) {
         const l = await db.getListingById(id);
         if (l) {
            setListing(l);
            db.getUserById(l.sellerId).then(setSeller);
            if (user) db.getFavorites(user.id).then(setUserFavorites);
            const all = await db.getListings();
            setAllListings(all);
         }
      } else {
         const data = await db.getListings();
         setAllListings(data);
         const l = data.find(x => x.id === id);
         if (l) {
            setListing(l);
            db.getUserById(l.sellerId).then(setSeller);
            if (user) db.getFavorites(user.id).then(setUserFavorites);
         }
      }
    };
    loadListing();
    window.scrollTo(0, 0);
  }, [id, user]);

  // --- NÂNG CẤP: Logic gợi ý sản phẩm thông minh ---
  const similarListings = useMemo(() => {
    if (!listing || allListings.length === 0) return [];
    
    // Ưu tiên vị trí: Nếu user đăng nhập thì lấy vị trí user, không thì lấy vị trí món hàng
    const targetLocation = user?.location || listing.location;

    return allListings
      .filter(l => l.id !== listing.id && l.category === listing.category)
      .sort((a, b) => {
        // 1. Ưu tiên Tin VIP
        const aVip = a.tier === 'pro' || a.tier === 'basic' ? 1 : 0;
        const bVip = b.tier === 'pro' || b.tier === 'basic' ? 1 : 0;
        if (aVip !== bVip) return bVip - aVip;

        // 2. Ưu tiên CÙNG VỊ TRÍ
        const aNear = a.location === targetLocation ? 1 : 0;
        const bNear = b.location === targetLocation ? 1 : 0;
        if (aNear !== bNear) return bNear - aNear;

        // 3. Thời gian đăng mới nhất
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })
      .slice(0, 12); 
  }, [allListings, listing, user]);

  if (!listing) return null;

  const currentCategory = CATEGORIES.find(c => c.id === listing.category);

  // [CẬP NHẬT QUAN TRỌNG]: Logic chat mới
  const handleStartChat = async () => {
    if (!user) return navigate('/login');
    if (user.id === listing.sellerId) return; // Không chat với chính mình

    setIsChatLoading(true);
    try {
        // Gọi hàm createChatRoom với tham số thứ 2 là OBJECT user (để lưu tên + avatar)
        // Chứ không phải chỉ user.id như cũ
        const roomId = await db.createChatRoom(listing, user);
        navigate(`/chat/${roomId}`);
    } catch (error) {
        console.error("Lỗi khi tạo phòng chat:", error);
        alert("Không thể kết nối trò chuyện lúc này.");
    } finally {
        setIsChatLoading(false);
    }
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
    alert("Báo cáo của bạn đã được gửi.");
    setShowReportModal(false);
  };

  // --- HÀM RENDER TÍCH XANH ---
  const renderVerificationBadge = () => {
      if (seller?.verificationStatus === 'verified') {
          return (
              <span className="bg-blue-500 text-white p-0.5 rounded-full shadow-sm ml-1" title="Đã xác thực danh tính">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
              </span>
          );
      }
      return null;
  };

  return (
    <div className="max-w-7xl mx-auto md:px-4 lg:px-8 py-0 md:py-8 space-y-6 pb-24">
      
      {/* BREADCRUMB */}
      <nav className="flex items-center gap-2 text-[10px] md:text-xs font-black uppercase tracking-widest text-gray-400 px-4 md:px-0 overflow-x-auto no-scrollbar whitespace-nowrap">
        <Link to="/" className="hover:text-primary transition-colors">Chợ Của Tui</Link>
        <span>/</span>
        {currentCategory && <Link to={`/danh-muc/${currentCategory.slug}`} className="hover:text-primary transition-colors">{currentCategory.name}</Link>}
        <span>/</span>
        <span className="text-gray-900 truncate max-w-[150px] md:max-w-xs">{listing.title}</span>
      </nav>

      <div className="grid lg:grid-cols-12 gap-0 md:gap-8 bg-white md:bg-transparent overflow-hidden">
        
        {/* LEFT COLUMN */}
        <div className="lg:col-span-8 space-y-6">
          {/* Gallery */}
          <div className="relative bg-black aspect-square md:aspect-video md:rounded-3xl overflow-hidden group">
            <img src={listing.images[activeImage]} className="w-full h-full object-contain" alt={listing.title} />
            {listing.images.length > 1 && (
              <>
                <button onClick={() => setActiveImage(prev => prev > 0 ? prev - 1 : listing.images.length - 1)} className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/90 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10"><svg className="w-5 h-5 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg></button>
                <button onClick={() => setActiveImage(prev => prev < listing.images.length - 1 ? prev + 1 : 0)} className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/90 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10"><svg className="w-5 h-5 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg></button>
              </>
            )}
            <div className="absolute bottom-4 right-4 bg-black/50 backdrop-blur-md text-white px-4 py-1.5 rounded-full text-xs font-bold border border-white/20">{activeImage + 1} / {listing.images.length}</div>
          </div>

          {/* Thumbnails */}
          {listing.images.length > 1 && (
            <div className="hidden md:flex gap-3 overflow-x-auto no-scrollbar py-2 px-1">
              {listing.images.map((img, idx) => (
                <button key={idx} onClick={() => setActiveImage(idx)} className={`w-24 h-24 rounded-2xl overflow-hidden border-4 transition-all flex-shrink-0 ${activeImage === idx ? 'border-primary shadow-lg' : 'border-transparent opacity-50'}`}><img src={img} className="w-full h-full object-cover" alt="" /></button>
              ))}
            </div>
          )}

          {/* THÔNG SỐ KỸ THUẬT */}
          {listing.attributes && Object.keys(listing.attributes).length > 0 && (
            <div className="bg-white md:rounded-[2.5rem] p-6 md:p-10 border border-gray-100 shadow-soft animate-fade-in-up">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-1.5 h-6 bg-primary rounded-full"></div>
                <h2 className="text-sm font-black text-textMain uppercase tracking-[0.2em]">Thông số kỹ thuật</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-y-8 gap-x-6">
                {Object.entries(listing.attributes).map(([key, value]) => {
                  const info = ATTRIBUTE_LABELS[key];
                  if (!value || !info) return null;
                  return (
                    <div key={key} className="flex items-start gap-4 group">
                      <div className="w-12 h-12 rounded-2xl bg-bgMain flex items-center justify-center text-2xl shadow-sm group-hover:scale-110 transition-transform duration-300">
                        {info.icon}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter mb-0.5">{info.label}</p>
                        <p className="text-sm font-black text-textMain truncate">
                          {['mileage', 'area'].includes(key) && !isNaN(Number(value)) 
                            ? parseInt(value as string).toLocaleString() 
                            : value}
                          {key === 'mileage' && ' Km'}
                          {key === 'area' && ' m²'}
                          {key === 'battery' && '%'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Description */}
          <div className="bg-white md:rounded-[2.5rem] p-6 md:p-10 border border-gray-100 shadow-soft space-y-6">
            <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest">Mô tả chi tiết</h2>
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap text-base font-medium">{listing.description}</p>
            <div className="pt-6 border-t border-gray-100 flex flex-wrap gap-3">
               <div className="bg-bgMain px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase text-gray-500">Tình trạng: <span className="text-textMain">{listing.condition === 'new' ? 'Mới' : 'Đã dùng'}</span></div>
               <div className="bg-bgMain px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase text-gray-500">Danh mục: <span className="text-textMain">{currentCategory?.name || listing.category}</span></div>
            </div>
          </div>

          {/* Reviews */}
          <div className="bg-white md:rounded-[2.5rem] p-6 md:p-10 border border-gray-100 shadow-soft">
            <ReviewSection targetId={listing.id} targetType="listing" currentUser={user} />
          </div>
        </div>

        {/* RIGHT COLUMN (STICKY) */}
        <div className="lg:col-span-4 p-4 md:p-0">
          <div className="bg-white md:rounded-[2.5rem] p-6 md:p-10 md:border border-gray-100 md:shadow-soft space-y-8 sticky top-24">
            
            {/* GIÁ & TIÊU ĐỀ */}
            <div className="space-y-3">
              <p className="text-4xl font-black text-primary tracking-tighter">{formatPrice(listing.price)}</p>
              <h1 className="text-2xl font-black text-textMain leading-tight">{listing.title}</h1>
              
              {/* ĐỊA CHỈ & THỜI GIAN */}
              <div className="flex flex-col gap-1 text-[10px] text-gray-400 font-black uppercase tracking-widest pt-2">
                <div className="flex items-start gap-2">
                    <span className="text-lg">📍</span>
                    <span className="line-clamp-2 mt-1">
                        {listing.address || listing.location}
                    </span>
                </div>
                <div className="flex items-center gap-2 pl-1">
                    <span>🕒 {formatTimeAgo(listing.createdAt)}</span>
                </div>
              </div>
            </div>

            {/* MINI MAP */}
            {listing.lat && listing.lng && (
                <div className="h-44 w-full rounded-2xl overflow-hidden border border-gray-200 shadow-inner relative z-0 group">
                    <MapContainer 
                        center={[listing.lat, listing.lng]} 
                        zoom={14} 
                        scrollWheelZoom={false}
                        dragging={false}       
                        zoomControl={false}     
                        style={{ height: '100%', width: '100%' }}
                    >
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <Marker position={[listing.lat, listing.lng]} />
                    </MapContainer>
                    
                    {/* Overlay mở Google Maps */}
                    <a 
                        href={`http://maps.google.com/maps?q=${listing.lat},${listing.lng}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="absolute inset-0 bg-black/5 group-hover:bg-black/20 transition-colors flex items-center justify-center z-[500]"
                    >
                        <span className="bg-white text-primary px-4 py-2 rounded-xl text-xs font-black uppercase shadow-lg scale-90 group-hover:scale-100 transition-transform flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                            Mở Google Maps
                        </span>
                    </a>
                </div>
            )}

            <div className="pt-8 border-t border-gray-100 space-y-6">
              {/* THẺ NGƯỜI BÁN */}
              <Link to={`/seller/${listing.sellerId}`} className="flex items-center gap-4 p-4 bg-bgMain rounded-3xl border border-gray-100 hover:shadow-md transition-all group">
                <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-white shadow-sm flex-shrink-0 group-hover:rotate-3 transition-transform">
                  <img src={listing.sellerAvatar} className="w-full h-full object-cover" alt={listing.sellerName} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                      <p className="font-black text-sm text-textMain group-hover:text-primary transition-colors truncate">{listing.sellerName}</p>
                      {renderVerificationBadge()}
                  </div>
                  
                  {seller?.verificationStatus === 'verified' ? (
                      <p className="text-[9px] font-black text-blue-500 uppercase mt-1 flex items-center gap-1.5">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg> 
                          Người bán uy tín
                      </p>
                  ) : (
                      <p className="text-[9px] font-black text-green-500 uppercase mt-1 flex items-center gap-1.5">
                          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> Đang hoạt động
                      </p>
                  )}
                </div>
              </Link>

              {/* KHU VỰC NÚT BẤM */}
              <div className="flex flex-col gap-3">
                <button 
                  onClick={handleStartChat} 
                  disabled={isChatLoading}
                  className="w-full bg-primary hover:bg-primaryHover text-white py-4 rounded-2xl font-bold text-sm shadow-xl shadow-primary/30 active:scale-95 transition-all flex items-center justify-center gap-3 group disabled:opacity-70 disabled:cursor-wait"
                >
                  {isChatLoading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                      <>
                        <svg className="w-6 h-6 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                        <span>CHAT VỚI NGƯỜI BÁN</span>
                      </>
                  )}
                </button>

                {seller?.phone && (
                  isPhoneVisible ? (
                    <a 
                      href={`tel:${seller.phone}`} 
                      className="w-full bg-green-500 hover:bg-green-600 text-white py-4 rounded-2xl font-bold text-sm shadow-xl shadow-green-500/30 active:scale-95 transition-all flex items-center justify-center gap-3 group"
                    >
                      <svg className="w-6 h-6 group-hover:rotate-12 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                      <span>GỌI: {seller.phone}</span>
                    </a>
                  ) : (
                    <button 
                      onClick={() => setIsPhoneVisible(true)} 
                      className="w-full bg-white border-2 border-green-500 text-green-600 hover:bg-green-50 py-4 rounded-2xl font-bold text-sm active:scale-95 transition-all flex items-center justify-center gap-3 group"
                    >
                      <svg className="w-6 h-6 group-hover:rotate-12 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                      <span>BẤM ĐỂ HIỆN SỐ ĐIỆN THOẠI</span>
                    </button>
                  )
                )}
              </div>
              
              <div className="flex gap-3">
                <button onClick={handleToggleFav} className="flex-1 flex items-center justify-center gap-2 py-4 border-2 border-gray-100 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all text-gray-500 hover:text-red-500">
                  <svg className={`w-5 h-5 ${userFavorites.includes(listing.id) ? 'text-red-500 fill-current' : 'text-current'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" strokeWidth={2.5}/></svg>
                  {userFavorites.includes(listing.id) ? 'Đã lưu' : 'Lưu tin'}
                </button>
                <button onClick={() => setIsShareModalOpen(true)} className="flex-1 flex items-center justify-center gap-2 py-4 border-2 border-gray-100 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all text-gray-500 hover:text-blue-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                  Chia sẻ
                </button>
              </div>

              <button onClick={() => setShowReportModal(true)} className="w-full text-[9px] font-black text-gray-300 uppercase tracking-widest hover:text-red-400 transition-colors py-2 flex items-center justify-center gap-2">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                Báo cáo tin đăng vi phạm
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SIMILAR LISTINGS */}
      <div className="px-4 md:px-0 pt-10">
        <div className="flex items-center justify-between mb-8 px-2">
          <h2 className="text-xl font-black text-textMain tracking-tighter uppercase">Sản phẩm tương tự</h2>
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
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl relative border border-borderMain">
            <h3 className="text-2xl font-black text-textMain mb-2 tracking-tighter">Báo cáo vi phạm</h3>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-8">Giúp cộng đồng Chợ Của Tui sạch hơn</p>
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase px-1">Lý do</label>
                <select value={reportReason} onChange={(e) => setReportReason(e.target.value)} className="w-full bg-bgMain border border-borderMain rounded-2xl p-4 font-bold text-sm appearance-none outline-none focus:border-primary transition-colors">
                  <option value="">Chọn lý do...</option>
                  {REPORT_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase px-1">Chi tiết</label>
                <textarea rows={3} placeholder="Mô tả thêm..." value={reportDetails} onChange={(e) => setReportDetails(e.target.value)} className="w-full bg-bgMain border border-borderMain rounded-2xl p-4 text-sm font-medium outline-none focus:border-primary transition-colors" />
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={() => setShowReportModal(false)} className="flex-1 py-4.5 rounded-2xl font-black text-[11px] uppercase bg-gray-100 text-gray-400">Hủy</button>
                <button onClick={handleReport} className="flex-1 py-4.5 rounded-2xl font-black text-[11px] uppercase bg-red-500 text-white shadow-lg shadow-red-200 active:scale-95 transition-all">Gửi báo cáo</button>
              </div>
            </div>
          </div>
        </div>
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
            <div className="text-[10px] text-gray-300 font-bold text-center border-t border-gray-50 pt-10 uppercase tracking-widest">© 2024 ChoCuaTui.vn - Trí tuệ nhân tạo phục vụ cộng đồng.</div>
         </div>
      </footer>
    </div>
  );
};

export default ListingDetail;
