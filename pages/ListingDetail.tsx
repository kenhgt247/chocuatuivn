import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async'; // Thêm để SEO FB/Zalo
import { db } from '../services/db';
import { Listing, User } from '../types';
import { formatPrice, formatTimeAgo, getListingUrl } from '../utils/format';
import ListingCard from '../components/ListingCard';
import ShareModal from '../components/ShareModal';
import ReviewSection from '../components/ReviewSection';
import OfferModal from '../components/OfferModal';
import AuctionBox from '../components/AuctionBox'; 
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
  { slug: 'quy-che-hoat-dong', title: 'Quy chế' },
  { slug: 'chinh-sach-bao-mat', title: 'Bảo mật' },
  { slug: 'meo-mua-ban-an-toan', title: 'An toàn' },
];

// --- HÀM LẤY ICON ĐỘNG DỰA TRÊN KEY (GIỮ NGUYÊN) ---
const getAttributeIcon = (key: string): React.ReactNode => {
    const k = key.toLowerCase();
    if (k.includes('area') || k.includes('size')) return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>;
    if (k.includes('bed')) return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>;
    if (k.includes('bath')) return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21H3m18-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14" /></svg>;
    if (k.includes('mileage') || k.includes('odo')) return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
    if (k.includes('year') || k.includes('age')) return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
    if (k.includes('fuel') || k.includes('battery')) return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>;
    if (k.includes('gear')) return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>;
    if (k.includes('storage') || k.includes('ram') || k.includes('cpu')) return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>;
    if (k.includes('salary') || k.includes('price') || k.includes('deposit')) return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
    if (k.includes('job') || k.includes('position')) return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>;
    
    return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>;
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
  const [showOfferModal, setShowOfferModal] = useState(false);

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

  const mediaList = useMemo(() => {
    if (!listing) return [];
    const list = [...listing.images];
    if (listing.videoUrl) {
        list.unshift(listing.videoUrl); 
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

  // --- LOGIC GỢI Ý: VIP > Kim cương > Quanh đây ---
  const similarListings = useMemo(() => {
    if (!listing) return [];
    
    return allListings
      .filter(l => l.id !== listing.id && l.category === listing.category && l.status === 'approved')
      .sort((a, b) => {
          // 1. Ưu tiên Hạng (VIP = pro, Kim Cương = basic)
          const getTierScore = (tier?: string) => (tier === 'pro' ? 3 : tier === 'basic' ? 2 : 1);
          const scoreA = getTierScore(a.tier);
          const scoreB = getTierScore(b.tier);
          if (scoreA !== scoreB) return scoreB - scoreA;

          // 2. Ưu tiên cùng Vị trí (Quanh đây)
          const locScoreA = a.location === listing.location ? 1 : 0;
          const locScoreB = b.location === listing.location ? 1 : 0;
          if (locScoreA !== locScoreB) return locScoreB - locScoreA;

          // 3. Ưu tiên tin mới nhất
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })
      .slice(0, 12);
  }, [allListings, listing]);

  if (!listing) return null;

  const categoryConfig = CATEGORIES.find(c => c.id === listing.category);
  const isVideoActive = listing.videoUrl && activeMedia === 0;
  const isOwner = user && user.id === listing.sellerId;

  // --- ACTIONS ---
  const handleToggleFav = async () => {
    if (!user) return navigate('/login');
    await db.toggleFavorite(user.id, listing.id);
    db.getFavorites(user.id).then(setUserFavorites);
  };

  const handleStartChat = async () => {
    if (!user) return navigate('/login');
    if (isOwner) return; 
    setIsChatLoading(true);
    try {
        const roomId = await db.createChatRoom(listing, user);
        navigate(`/chat/${roomId}`);
    } catch (e) { alert("Lỗi kết nối chat."); }
    finally { setIsChatLoading(false); }
  };

  const handleMakeOffer = async (offerPrice: number) => {
    if (!user) { alert("Vui lòng đăng nhập!"); return navigate('/login'); }
    if (isOwner) { alert("Bạn không thể mặc cả sản phẩm của chính mình!"); return; }

    setShowOfferModal(false);
    const result = await db.createOffer(listing, user, offerPrice);
    if (result.success) {
        alert(`✅ Đã gửi đề nghị giá ${offerPrice.toLocaleString()}đ thành công!`);
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
      
      {/* [MỚI] SEO HELMET CHO FB/ZALO */}
      <Helmet>
        <title>{listing.title} | Chợ Của Tui</title>
        <meta property="og:title" content={listing.title} />
        <meta property="og:description" content={listing.description.substring(0, 150) + "..."} />
        <meta property="og:image" content={listing.images[0]} />
        <meta property="og:url" content={window.location.href} />
        <meta property="og:type" content="product" />
      </Helmet>

      {/* BREADCRUMB (GIỮ NGUYÊN) */}
      <nav className="flex items-center gap-2 text-[10px] md:text-xs font-bold uppercase tracking-widest text-gray-400 px-4 md:px-0">
        <Link to="/" className="hover:text-primary transition-colors">Trang chủ</Link>
        <svg className="w-3 h-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        {categoryConfig && (
            <>
                <Link to={`/danh-muc/${categoryConfig.slug}`} className="hover:text-primary transition-colors">{categoryConfig.name}</Link>
                <svg className="w-3 h-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </>
        )}
        <span className="text-gray-900 truncate max-w-[200px]">{listing.title}</span>
      </nav>

      <div className="grid lg:grid-cols-12 gap-0 md:gap-8">
        
        {/* LEFT: MEDIA GALLERY & DETAILS (GIỮ NGUYÊN) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="relative bg-gray-900 aspect-square md:aspect-video md:rounded-[2rem] overflow-hidden group shadow-2xl border border-gray-800">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 overflow-hidden select-none">
                <div className="transform -rotate-45 leading-none pointer-events-none">
                    <span className="text-white/10 text-sm md:text-lg font-black uppercase tracking-widest whitespace-nowrap px-4 py-2">Chợ Của Tui</span>
                </div>
            </div>

            {isVideoActive ? (
                <div className="relative w-full h-full cursor-pointer" onClick={handleVideoPlayPause}>
                    <video ref={videoRef} src={listing.videoUrl || ""} poster={listing.images[0] || ""} className="w-full h-full object-contain bg-black" autoPlay loop muted={isMuted} playsInline />
                    <div className="absolute bottom-6 left-6 right-6 z-30 flex justify-between items-end">
                        <button onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }} className="pointer-events-auto bg-black/60 backdrop-blur-md text-white p-3 rounded-full hover:bg-primary transition-all">{isMuted ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>}</button>
                        <div className="bg-primary text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest animate-pulse shadow-lg flex items-center gap-1">Video</div>
                    </div>
                </div>
            ) : (
                <img src={mediaList[activeMedia]} className="w-full h-full object-contain bg-gray-100" alt={listing.title} />
            )}
            
            {mediaList.length > 1 && (
              <>
                <button onClick={() => setActiveMedia(prev => prev > 0 ? prev - 1 : mediaList.length - 1)} className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-primary transition-all z-40 shadow-xl opacity-0 group-hover:opacity-100"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" /></svg></button>
                <button onClick={() => setActiveMedia(prev => prev < mediaList.length - 1 ? prev + 1 : 0)} className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-primary transition-all z-40 shadow-xl opacity-0 group-hover:opacity-100"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" /></svg></button>
              </>
            )}
          </div>

          {/* THUMBNAILS & ATTRIBUTES & DESCRIPTION (GIỮ NGUYÊN) */}
          <div className="hidden md:flex gap-3 overflow-x-auto no-scrollbar py-2">
            {mediaList.map((item, idx) => (
              <button key={idx} onClick={() => setActiveMedia(idx)} className={`w-20 h-20 rounded-xl overflow-hidden border-2 transition-all flex-shrink-0 relative ${activeMedia === idx ? 'border-primary shadow-lg scale-105' : 'border-transparent opacity-60 hover:opacity-100'}`}>
                <img src={listing.videoUrl && idx === 0 ? listing.images[0] : item} className="w-full h-full object-cover" alt="" />
              </button>
            ))}
          </div>

          {listing.attributes && Object.keys(listing.attributes).length > 0 && (
            <div className="bg-white md:rounded-[2rem] p-8 border border-gray-100 shadow-sm">
              <h2 className="text-xs font-black text-gray-900 uppercase tracking-widest mb-8 border-l-4 border-primary pl-4">⚡ Thông số kỹ thuật</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-y-8 gap-x-6">
                {categoryConfig?.attributes?.map((attr) => {
                    const value = listing.attributes?.[attr.key];
                    if (!value) return null;
                    return (
                        <div key={attr.key} className="flex items-center gap-4 group">
                            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 group-hover:bg-primary group-hover:text-white transition-colors">{getAttributeIcon(attr.key)}</div>
                            <div className="min-w-0"><p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">{attr.label}</p><p className="text-sm font-bold text-gray-800 truncate">{value} {attr.suffix || ''}</p></div>
                        </div>
                    );
                })}
              </div>
            </div>
          )}

          <div className="bg-white md:rounded-[2rem] p-8 border border-gray-100 shadow-sm space-y-4">
            <h2 className="text-xs font-black text-gray-900 uppercase tracking-widest">📝 Mô tả sản phẩm</h2>
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap text-sm font-medium border-l-4 border-gray-100 pl-6 py-2">{listing.description}</p>
          </div>

          <div className="bg-white md:rounded-[2rem] p-8 border border-gray-100 shadow-sm">
            <ReviewSection targetId={listing.id} targetType="listing" currentUser={user} />
          </div>
        </div>

        {/* RIGHT: SIDEBAR (GIỮ NGUYÊN) */}
        <div className="lg:col-span-4 p-4 md:p-0">
          <div className="bg-white md:rounded-[2.5rem] p-8 border border-gray-100 shadow-xl space-y-8 sticky top-24">
            <div className="space-y-4">
              <h1 className="text-xl font-bold text-gray-800 leading-snug uppercase">{listing.title}</h1>
              {listing.isAuction ? (
                  <AuctionBox listing={listing} user={user} />
              ) : (
                  <p className="text-4xl font-black tracking-tighter text-primary">{listing.price > 0 ? formatPrice(listing.price) : 'Liên hệ'}</p>
              )}
              <div className="flex flex-col gap-3 pt-4 border-t border-gray-50">
                <div className="flex items-start gap-3 text-gray-500 font-bold text-xs"><span>📍 {listing.address || listing.location}</span></div>
                <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold"><span>🕒 {formatTimeAgo(listing.createdAt)}</span> • <span>👀 {listing.viewCount} xem</span></div>
              </div>
            </div>

            <Link to={`/seller/${listing.sellerId}`} className="flex items-center gap-4 p-4 bg-gray-50/50 rounded-2xl border border-gray-100 hover:border-primary/30 transition-all group">
                <div className="relative">
                    <img src={listing.sellerAvatar} className="w-14 h-14 rounded-2xl object-cover border-2 border-white shadow-md" alt="" />
                    {seller?.status === 'active' && <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></div>}
                </div>
                <div className="min-w-0">
                    <p className="font-bold text-sm text-gray-900 group-hover:text-primary">{listing.sellerName}</p>
                    {seller?.verificationStatus === 'verified' ? <p className="text-[10px] font-black text-blue-500 uppercase mt-1">✓ Đã xác thực</p> : <p className="text-[10px] font-bold text-gray-400 mt-1">Thành viên mới</p>}
                </div>
            </Link>

            <div className="space-y-3">
              {(isOwner || user?.role === 'admin') ? (
                  <Link to={`/edit/${listing.id}`} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black text-xs uppercase shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all">Chỉnh sửa tin này</Link>
              ) : (
                  !listing.isAuction && (
                    <>
                      {listing.affiliateLink ? (
                        <a href={listing.affiliateLink} target="_blank" rel="nofollow" className="w-full bg-orange-600 hover:bg-orange-700 text-white py-4 rounded-2xl font-black text-xs shadow-xl animate-bounce flex justify-center">MUA NGAY</a>
                      ) : (
                        <div className="flex gap-3">
                            <button onClick={() => setShowOfferModal(true)} className="flex-1 bg-green-50 text-green-600 border border-green-200 py-4 rounded-2xl font-black text-xs uppercase">Trả giá</button>
                            <button onClick={handleStartChat} disabled={isChatLoading} className="flex-[2] bg-primary hover:bg-primaryHover text-white py-4 rounded-2xl font-black text-xs uppercase shadow-xl">{isChatLoading ? '...' : 'Chat ngay'}</button>
                        </div>
                      )}
                      {!listing.affiliateLink && seller?.phone && (
                        <button onClick={() => isPhoneVisible ? window.location.href=`tel:${seller.phone}` : setIsPhoneVisible(true)} className="w-full bg-white border-2 border-green-500 text-green-600 py-4 rounded-2xl font-black text-xs uppercase">{isPhoneVisible ? seller.phone : 'Hiện số điện thoại'}</button>
                      )}
                    </>
                  )
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={handleToggleFav} className="flex-1 py-4 border border-gray-200 bg-gray-50 rounded-2xl text-[10px] font-black uppercase text-gray-500 hover:text-red-500 transition-colors flex items-center justify-center gap-2"><svg className={`w-5 h-5 ${userFavorites.includes(listing.id) ? 'text-red-500 fill-current' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg> {userFavorites.includes(listing.id) ? 'Đã lưu' : 'Lưu tin'}</button>
              <button onClick={() => setIsShareModalOpen(true)} className="flex-1 py-4 border border-gray-200 bg-gray-50 rounded-2xl text-[10px] font-black uppercase text-gray-500 hover:text-blue-500 transition-colors">Chia sẻ</button>
            </div>

            {listing.lat && listing.lng && (
                <div className="w-full h-48 rounded-2xl overflow-hidden relative border border-gray-200 mt-4 z-0">
                    <MapContainer center={[listing.lat, listing.lng]} zoom={13} style={{ height: '100%', width: '100%' }}>
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='© OpenStreetMap' />
                        <Marker position={[listing.lat, listing.lng]}><Popup>{listing.address || "Vị trí"}</Popup></Marker>
                    </MapContainer>
                </div>
            )}
            
            <button onClick={() => setShowReportModal(true)} className="w-full text-[9px] font-black text-gray-300 uppercase tracking-widest hover:text-red-400 transition-colors text-center pt-2">🚩 Báo cáo tin này</button>
          </div>
        </div>
      </div>

      {/* SIMILAR LISTINGS (LOGIC ƯU TIÊN VIP > KIM CƯƠNG > QUANH ĐÂY) */}
      <div className="px-4 md:px-0 pt-10">
        <div className="flex items-center justify-between mb-8 px-2 border-b border-gray-100 pb-4">
          <h2 className="text-xl font-black text-gray-800 uppercase flex items-center gap-2">🔥 Có thể bạn thích</h2>
          <Link to={`/?category=${listing.category}`} className="text-xs font-black text-primary hover:underline">Xem tất cả →</Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-5">
          {similarListings.map(l => (
            <ListingCard key={l.id} listing={l} isFavorite={userFavorites.includes(l.id)} onToggleFavorite={handleToggleFav} />
          ))}
        </div>
      </div>

      {/* FOOTER (KHÔI PHỤC MÀU SẮC NGUYÊN BẢN CỦA BẠN) */}
      <footer className="hidden md:block pt-20 border-t border-dashed border-gray-200 mt-20">
         <div className="bg-white border border-gray-100 rounded-[3rem] p-12 shadow-sm">
            <div className="flex items-center justify-between mb-10">
               <h4 className="text-2xl font-black text-gray-800 flex items-center gap-3"><span className="text-3xl">⚡</span> Chợ Của Tui</h4>
               <div className="flex gap-8">
                  {STATIC_LINKS.map(link => <Link key={link.slug} to={`/page/${link.slug}`} className="text-[11px] font-black text-gray-400 hover:text-primary transition-colors uppercase tracking-widest">{link.title}</Link>)}
               </div>
            </div>
            <div className="text-[10px] text-gray-300 font-bold text-center border-t border-gray-50 pt-10 uppercase tracking-widest">© 2026 ChoCuaTui.vn - Trí tuệ nhân tạo phục vụ cộng đồng.</div>
         </div>
      </footer>

      {/* MODALS & OTHERS (GIỮ NGUYÊN) */}
      {showReportModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowReportModal(false)}></div>
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl relative border border-gray-200">
            <h3 className="text-2xl font-black text-gray-900 mb-6">Báo cáo vi phạm</h3>
            <div className="space-y-5">
                <select value={reportReason} onChange={(e) => setReportReason(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 font-bold text-sm">
                  <option value="">-- Chọn lý do --</option>
                  {REPORT_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <textarea rows={3} placeholder="Chi tiết thêm..." value={reportDetails} onChange={(e) => setReportDetails(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 text-sm" />
                <div className="flex gap-3 pt-4">
                    <button onClick={() => setShowReportModal(false)} className="flex-1 py-4 rounded-2xl font-black text-[11px] uppercase bg-gray-100 text-gray-500">Hủy</button>
                    <button onClick={handleReport} className="flex-1 py-4 rounded-2xl font-black text-[11px] uppercase bg-red-500 text-white shadow-lg shadow-red-200">Gửi báo cáo</button>
                </div>
            </div>
          </div>
        </div>
      )}
      {listing && <OfferModal isOpen={showOfferModal} onClose={() => setShowOfferModal(false)} onSubmit={handleMakeOffer} originalPrice={listing.price} productName={listing.title} />}
      <ShareModal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} url={getListingUrl(listing)} title={listing.title} />
    </div>
  );
};

export default ListingDetail;