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

const STATIC_LINKS = [
  { slug: 'gioi-thieu', title: 'Giới thiệu' },
  { slug: 'quy-che-hoat-dong', title: 'Quy chế hoạt động' },
  { slug: 'chinh-sach-bao-mat', title: 'Chính sách bảo mật' },
  { slug: 'meo-mua-ban-an-toan', title: 'Mẹo an toàn' },
  { slug: 'huong-dan-dang-tin', title: 'Hỗ trợ' },
];

// --- BẢN ĐỒ NHÃN ĐẦY ĐỦ CHO TẤT CẢ DANH MỤC ---
const ATTRIBUTE_LABELS: Record<string, { label: string; icon: string }> = {
  // Xe cộ
  mileage: { label: 'Số Km đã đi', icon: '🚗' },
  year: { label: 'Năm sản xuất', icon: '📅' },
  gearbox: { label: 'Hộp số', icon: '⚙️' },
  fuel: { label: 'Nhiên liệu', icon: '⛽' },
  carType: { label: 'Kiểu dáng', icon: '🚙' },
  seatCount: { label: 'Số chỗ', icon: '💺' },
  // Bất động sản
  area: { label: 'Diện tích', icon: '📐' },
  bedrooms: { label: 'Phòng ngủ', icon: '🛏️' },
  bathrooms: { label: 'Số WC', icon: '🚿' },
  direction: { label: 'Hướng nhà', icon: '🧭' },
  legal: { label: 'Pháp lý', icon: '📜' },
  propertyType: { label: 'Loại hình', icon: '🏘️' },
  // Đồ điện tử
  battery: { label: 'Pin', icon: '🔋' },
  storage: { label: 'Bộ nhớ', icon: '💾' },
  ram: { label: 'RAM', icon: '⚡' },
  color: { label: 'Màu sắc', icon: '🎨' },
  warranty: { label: 'Bảo hành', icon: '🛡️' },
  // Điện lạnh
  capacity: { label: 'Công suất', icon: '❄️' },
  inverter: { label: 'Inverter', icon: '📉' },
  // Thú cưng
  breed: { label: 'Giống loài', icon: '🐕' },
  age: { label: 'Độ tuổi', icon: '🐾' },
  gender: { label: 'Giới tính', icon: '⚧' },
  // Nội thất / Đồ dùng
  material: { label: 'Chất liệu', icon: '🪵' },
  size: { label: 'Kích thước', icon: '📏' },
  brand: { label: 'Thương hiệu', icon: '🏷️' },
  personalSize: { label: 'Size', icon: '👕' },
  // Việc làm
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

  const id = useMemo(() => {
    if (!slugWithId) return null;
    const parts = slugWithId.split('-');
    return parts[parts.length - 1];
  }, [slugWithId]);

  useEffect(() => {
    if (!id) return;
    const loadListing = async () => {
      // Tối ưu: Dùng getListingById nếu có, fallback về getListings
      if (db.getListingById) {
         const l = await db.getListingById(id);
         if (l) {
            setListing(l);
            db.getUserById(l.sellerId).then(setSeller);
            if (user) db.getFavorites(user.id).then(setUserFavorites);
            // Load similar sau để trang hiện nhanh
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

  const similarListings = useMemo(() => {
    if (!listing || allListings.length === 0) return [];
    return allListings
      .filter(l => l.id !== listing.id && l.category === listing.category)
      .sort((a, b) => {
        const aVip = (a as any).isVip ? 1 : 0;
        const bVip = (b as any).isVip ? 1 : 0;
        if (aVip !== bVip) return bVip - aVip;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })
      .slice(0, 12); 
  }, [allListings, listing]);

  if (!listing) return null;

  const currentCategory = CATEGORIES.find(c => c.id === listing.category);

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
    await db.reportListing({ listingId: listing.id, userId: user.id, reason: reportReason, details: reportDetails });
    alert("Báo cáo của bạn đã được gửi.");
    setShowReportModal(false);
  };

  const formatHiddenPhone = (phone: string) => phone ? phone.substring(0, 4) + " *** ***" : "";

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
                <button onClick={() => setActiveImage(prev => prev > 0 ? prev - 1 : listing.images.length - 1)} className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/90 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10"><svg className="w-5 h-5 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth={3}/></svg></button>
                <button onClick={() => setActiveImage(prev => prev < listing.images.length - 1 ? prev + 1 : 0)} className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/90 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10"><svg className="w-5 h-5 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeWidth={3}/></svg></button>
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

          {/* THÔNG SỐ KỸ THUẬT (FULL) */}
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
            <div className="space-y-4">
              <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest">Mô tả chi tiết</h2>
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap text-base font-medium">{listing.description}</p>
            </div>
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
            <div className="space-y-3">
              <p className="text-4xl font-black text-primary tracking-tighter">{formatPrice(listing.price)}</p>
              <h1 className="text-2xl font-black text-textMain leading-tight">{listing.title}</h1>
              <div className="flex items-center gap-3 text-[10px] text-gray-400 font-black uppercase tracking-widest pt-2">
                <span>📍 {listing.location}</span>
                <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                <span>🕒 {formatTimeAgo(listing.createdAt)}</span>
              </div>
            </div>

            <div className="pt-8 border-t border-gray-100 space-y-6">
              <Link to={`/seller/${listing.sellerId}`} className="flex items-center gap-4 p-4 bg-bgMain rounded-3xl border border-gray-100 hover:shadow-md transition-all group">
                <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-white shadow-sm flex-shrink-0 group-hover:rotate-3 transition-transform">
                  <img src={listing.sellerAvatar} className="w-full h-full object-cover" alt={listing.sellerName} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-black text-sm text-textMain group-hover:text-primary transition-colors truncate">{listing.sellerName}</p>
                  <p className="text-[9px] font-black text-green-500 uppercase mt-1 flex items-center gap-1.5"><span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> Đang hoạt động</p>
                </div>
              </Link>

              <div className="grid grid-cols-1 gap-3">
                <button onClick={handleStartChat} className="w-full bg-primary text-white py-4.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 hover:bg-primaryHover active:scale-95 transition-all flex items-center justify-center gap-2">💬 Nhắn tin cho người bán</button>
                {seller?.phone && (
                  isPhoneVisible ? (
                    <a href={`tel:${seller.phone}`} className="w-full bg-white border-2 border-primary text-primary py-4.5 rounded-2xl font-black text-xs uppercase tracking-widest text-center hover:bg-primary/5 active:scale-95 transition-all flex items-center justify-center gap-2">📞 Gọi: {seller.phone}</a>
                  ) : (
                    <button onClick={() => setIsPhoneVisible(true)} className="w-full bg-white border-2 border-primary text-primary py-4.5 rounded-2xl font-black text-xs uppercase tracking-widest text-center hover:bg-primary/5 active:scale-95 transition-all flex items-center justify-center gap-2">📞 Hiện số điện thoại</button>
                  )
                )}
              </div>
              
              <div className="flex gap-3">
                <button onClick={handleToggleFav} className="flex-1 flex items-center justify-center gap-2 py-4 border-2 border-gray-100 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all">
                  <svg className={`w-5 h-5 ${userFavorites.includes(listing.id) ? 'text-red-500 fill-current' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" strokeWidth={2.5}/></svg>
                  {userFavorites.includes(listing.id) ? 'Đã lưu' : 'Lưu tin'}
                </button>
                <button onClick={() => setIsShareModalOpen(true)} className="flex-1 flex items-center justify-center gap-2 py-4 border-2 border-gray-100 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all">📤 Chia sẻ</button>
              </div>

              <button onClick={() => setShowReportModal(true)} className="w-full text-[9px] font-black text-gray-300 uppercase tracking-widest hover:text-red-400 transition-colors py-2 flex items-center justify-center gap-2">🚩 Báo cáo tin đăng vi phạm</button>
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
