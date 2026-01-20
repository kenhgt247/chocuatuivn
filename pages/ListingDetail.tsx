import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { db } from '../services/db';
import { Listing, User } from '../types';
import { formatPrice, formatTimeAgo, getListingUrl } from '../utils/format';
import ListingCard from '../components/ListingCard';
import ShareModal from '../components/ShareModal';
import ReviewSection from '../components/ReviewSection';
import OfferModal from '../components/OfferModal';
import AuctionBox from '../components/AuctionBox';
import { CATEGORIES } from '../constants';
import ProductZoom from '../components/ProductZoom';
import SwapModal from '../components/SwapModal';

// --- IMPORT FIREBASE FOR REALTIME STATUS ---
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';

// --- IMPORT LEAFLET MAP ---
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

// --- IMPORT ICON VECTOR (LUCIDE) ---
import { 
  Home, ChevronRight, ChevronLeft, Volume2, VolumeX, Maximize2, 
  Play, Pause, Flag, MapPin, Clock, Eye, BadgeCheck, Edit, 
  ExternalLink, Tag, RefreshCcw, MessageCircle, Phone, Heart, 
  Share2, Flame, BedDouble, Bath, Gauge, Calendar, Fuel, 
  Settings, HardDrive, Banknote, Briefcase, Info, Scaling, 
  ShieldCheck, AlertTriangle, X
} from 'lucide-react';

// Fix Leaflet default icon issue
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

// --- HELPER: GET DYNAMIC ATTRIBUTE ICON ---
const getAttributeIcon = (key: string): React.ReactNode => {
    const k = key.toLowerCase();
    const style = "w-5 h-5";

    if (k.includes('area') || k.includes('size')) return <Scaling className={style} />;
    if (k.includes('bed')) return <BedDouble className={style} />;
    if (k.includes('bath')) return <Bath className={style} />;
    if (k.includes('mileage') || k.includes('odo')) return <Gauge className={style} />;
    if (k.includes('year') || k.includes('age')) return <Calendar className={style} />;
    if (k.includes('fuel') || k.includes('battery')) return <Fuel className={style} />;
    if (k.includes('gear')) return <Settings className={style} />;
    if (k.includes('storage') || k.includes('ram') || k.includes('cpu')) return <HardDrive className={style} />;
    if (k.includes('salary') || k.includes('price') || k.includes('deposit')) return <Banknote className={style} />;
    if (k.includes('job') || k.includes('position')) return <Briefcase className={style} />;
    
    return <Info className={style} />;
};

const ListingDetail: React.FC<{ user: User | null }> = ({ user }) => {
  const { slugWithId } = useParams();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // State
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [listing, setListing] = useState<Listing | null>(null);
  const [seller, setSeller] = useState<User | null>(null);
  const [allListings, setAllListings] = useState<Listing[]>([]);
  const [activeMedia, setActiveMedia] = useState(0); 
  const [userFavorites, setUserFavorites] = useState<string[]>([]);
  
  // [NEW] Realtime Online Status State
  const [isSellerOnline, setIsSellerOnline] = useState(false);

  // Modals State
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);
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

  // -----------------------------------------------------------
  // 1. [SỬA LỖI] EFFECT RIÊNG ĐỂ TĂNG VIEW (CHỈ CHẠY 1 LẦN KHI CÓ ID)
  // -----------------------------------------------------------
  useEffect(() => {
    if (id) {
        db.incrementListingView(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]); // <--- QUAN TRỌNG: Chỉ phụ thuộc vào ID, bỏ 'user' ra khỏi đây để tránh lặp

  // -----------------------------------------------------------
  // 2. EFFECT ĐỂ LOAD DỮ LIỆU (CHẠY KHI ID HOẶC USER THAY ĐỔI)
  // -----------------------------------------------------------
  useEffect(() => {
    if (!id) return;
    
    const loadListing = async () => {
        const l = await db.getListingById(id);
        if (l) {
            setListing(l);
            db.getUserById(l.sellerId).then(setSeller);
            
            // Cần user để biết đã favorite chưa
            if (user) db.getFavorites(user.id).then(setUserFavorites);
            
            db.getListings().then(setAllListings);
        }
    };
    loadListing();
    window.scrollTo(0, 0);
  }, [id, user]); // Effect này vẫn cần user để load favorite

  // Realtime Online Status Listener
  useEffect(() => {
    if (!listing?.sellerId) return;

    const dbInstance = getFirestore();
    const sellerRef = doc(dbInstance, "users", listing.sellerId);

    const unsubscribe = onSnapshot(sellerRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            const isOnline = data.isOnline === true;
            
            // Check last active time (within 5 minutes)
            let isActiveRecently = true;
            if (data.lastActiveAt) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const lastActiveTime = (data.lastActiveAt as any).toMillis ? (data.lastActiveAt as any).toMillis() : new Date(data.lastActiveAt).getTime();
                const now = Date.now();
                if (now - lastActiveTime > 5 * 60 * 1000) {
                    isActiveRecently = false;
                }
            }

            setIsSellerOnline(isOnline && isActiveRecently);
        }
    });

    return () => unsubscribe();
  }, [listing?.sellerId]);

 // --- SMART RECOMMENDATION LOGIC ---
  const similarListings = useMemo(() => {
    if (!listing) return [];
    const LIMIT = 12;

    const getScore = (item: Listing, isSameCategory: boolean) => {
        let score = 0;
        if (isSameCategory) score += 1000;
        if (item.location === listing.location) score += 500;
        if (item.tier === 'pro') score += 50;
        else if (item.tier === 'basic') score += 20;
        score += new Date(item.createdAt).getTime() / 10000000000000; 
        return score;
    };
    
    const candidates = allListings.filter(l => l.id !== listing.id && l.status === 'approved');
    const sorted = candidates.sort((a, b) => {
        const scoreA = getScore(a, a.category === listing.category);
        const scoreB = getScore(b, b.category === listing.category);
        return scoreB - scoreA;
    });

    return sorted.slice(0, LIMIT);
  }, [allListings, listing]);

  if (!listing) return null;

  const categoryConfig = CATEGORIES.find(c => c.id === listing.category);
  const isVideoActive = listing.videoUrl && activeMedia === 0;
  const isOwner = user && user.id === listing.sellerId;

  // --- ACTIONS ---
  const handleToggleFav = async (targetId?: string) => {
    if (!user) return navigate('/login');
    const idToToggle = (typeof targetId === 'string') ? targetId : listing.id;
    await db.toggleFavorite(user.id, idToToggle);
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

  const handleSwapSubmit = async (selectedItem: Listing, cashTopUp: number) => {
    if (!user) return;
    setIsChatLoading(true);

    try {
        const roomId = await db.createChatRoom(listing, user);
        const cashText = cashTopUp > 0 
            ? ` (bù ${formatPrice(cashTopUp)})` 
            : (cashTopUp < 0 ? ` (nhận lại ${formatPrice(Math.abs(cashTopUp))})` : "");
        const textSummary = `🔄 Đề nghị đổi: ${selectedItem.title}${cashText}`;

        const messageData = {
            senderId: user.id,
            text: textSummary, 
            type: 'swap', 
            swapData: {
                offeredItemName: selectedItem.title,
                offeredItemImage: selectedItem.images[0],
                cashTopUp: cashTopUp
            }
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await db.addMessage(roomId, messageData as any);
        setShowSwapModal(false);
        alert("✅ Đã gửi đề nghị đổi đồ thành công!");
        navigate(`/chat/${roomId}`);

    } catch (e) {
        console.error(e);
        alert("Có lỗi xảy ra, vui lòng thử lại.");
    } finally {
        setIsChatLoading(false);
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
      
      {/* SEO HELMET */}
      <Helmet>
        <title>{listing.title} | Chợ Của Tui</title>
        <meta property="og:title" content={listing.title} />
        <meta property="og:description" content={listing.description.substring(0, 150) + "..."} />
        <meta property="og:image" content={listing.images[0]} />
        <meta property="og:url" content={window.location.href} />
        <meta property="og:type" content="product" />
      </Helmet>

      {/* BREADCRUMB */}
      <nav className="flex items-center gap-2 text-[10px] md:text-xs font-bold uppercase tracking-widest text-gray-400 px-4 md:px-0">
        <Link to="/" className="hover:text-primary transition-colors flex items-center gap-1">
            <Home className="w-3 h-3 mb-0.5" /> Trang chủ
        </Link>
        <ChevronRight className="w-3 h-3 text-gray-300" />
        {categoryConfig && (
            <>
                <Link to={`/danh-muc/${categoryConfig.slug}`} className="hover:text-primary transition-colors">{categoryConfig.name}</Link>
                <ChevronRight className="w-3 h-3 text-gray-300" />
            </>
        )}
        <span className="text-gray-900 truncate max-w-[200px]">{listing.title}</span>
      </nav>

      <div className="grid lg:grid-cols-12 gap-0 md:gap-8">
        
        {/* LEFT: MEDIA GALLERY & DETAILS */}
        <div className="lg:col-span-8 space-y-6">
          
         {/* Main Media (Video/Image) */}
          <div className={`relative aspect-square md:aspect-video md:rounded-xl group shadow-sm border border-gray-100 z-20 ${isVideoActive ? 'bg-gray-900 border-gray-800 overflow-hidden' : 'bg-white'}`}>
            
            {/* Watermark */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 overflow-hidden select-none">
                <div className="transform -rotate-45 leading-none pointer-events-none">
                    <span className="text-white/40 drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)] text-sm md:text-lg font-black uppercase tracking-widest whitespace-nowrap px-4 py-2">
                        ⚡ Chợ Của Tui
                    </span>
                </div>
            </div>
            
            {isVideoActive ? (
                // VIDEO
                <div className="relative w-full h-full cursor-pointer" onClick={handleVideoPlayPause}>
                    <video ref={videoRef} src={listing.videoUrl || ""} poster={listing.images[0] || ""} className="w-full h-full object-contain bg-black" autoPlay loop muted={isMuted} playsInline />
                    <div className="absolute bottom-6 left-6 right-6 z-30 flex justify-between items-end">
                        <button onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }} className="pointer-events-auto bg-black/60 backdrop-blur-md text-white p-3 rounded-full hover:bg-primary transition-all">
                            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                        </button>
                        <div className="bg-primary text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest animate-pulse shadow-lg flex items-center gap-1">
                            {isPlaying ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />} Video
                        </div>
                    </div>
                </div>
            ) : (
                // IMAGE
                <>
                    {/* MOBILE: Click to Lightbox */}
                    <div className="md:hidden w-full h-full relative" onClick={() => setIsLightboxOpen(true)}>
                        <img src={mediaList[activeMedia]} className="w-full h-full object-contain" alt={listing.title} />
                        <div className="absolute bottom-4 right-4 bg-black/50 text-white p-2 rounded-full pointer-events-none backdrop-blur-sm">
                            <Maximize2 className="w-4 h-4" />
                        </div>
                    </div>

                    {/* DESKTOP: ProductZoom */}
                    <div className="hidden md:block w-full h-full">
                        <ProductZoom src={mediaList[activeMedia]} alt={listing.title} />
                    </div>
                </>
            )}
            
            {/* Nav Buttons */}
            {mediaList.length > 1 && (
              <>
                <button onClick={(e) => { e.stopPropagation(); setActiveMedia(prev => prev > 0 ? prev - 1 : mediaList.length - 1); }} className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-primary transition-all z-30 shadow-xl opacity-0 group-hover:opacity-100">
                    <ChevronLeft className="w-6 h-6" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); setActiveMedia(prev => prev < mediaList.length - 1 ? prev + 1 : 0); }} className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-primary transition-all z-30 shadow-xl opacity-0 group-hover:opacity-100">
                    <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
          </div>

          {/* Thumbnails - ĐÃ SỬA LỖI UI */}
          <div className="flex gap-2 mt-4 overflow-x-auto pb-2 px-1 snap-x scrollbar-hide">
            {mediaList.map((item, idx) => (
              <button 
                key={idx} 
                onClick={() => setActiveMedia(idx)} 
                // --- CÁC CLASS QUAN TRỌNG ĐÃ SỬA ---
                // 1. flex-shrink-0: Bắt buộc ảnh giữ nguyên kích thước, không bị bóp méo khi hết chỗ
                // 2. w-16 h-16 (Mobile) & md:w-20 md:h-20 (Desktop): Kích thước vuông vức, cố định
                // 3. snap-start: Giúp cảm giác vuốt trên điện thoại mượt mà (dừng đúng vị trí ảnh)
                className={`
                  relative flex-shrink-0 
                  w-16 h-16 md:w-20 md:h-20 
                  aspect-square rounded-xl overflow-hidden border-2 
                  snap-start transition-all duration-300
                  ${activeMedia === idx 
                    ? 'border-primary ring-2 ring-primary/20 scale-105 z-10 shadow-md' 
                    : 'border-transparent opacity-70 hover:opacity-100 hover:border-gray-300 grayscale hover:grayscale-0'
                  }
                `}
              >
                <img 
                  src={listing.videoUrl && idx === 0 ? listing.images[0] : item} 
                  className="w-full h-full object-cover" 
                  alt={`Thumbnail ${idx + 1}`} 
                />
                
                {/* Icon Play cho Video */}
                {listing.videoUrl && idx === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <div className="w-5 h-5 bg-white/90 rounded-full flex items-center justify-center shadow-sm backdrop-blur-sm">
                          <Play className="w-2.5 h-2.5 text-primary ml-0.5" fill="currentColor" />
                      </div>
                  </div>
                )}
              </button>
            ))}
          </div>

        {/* Attributes - Vector Icons */}
          {(() => {
            const validAttributes = categoryConfig?.attributes?.filter(attr => {
                const val = listing.attributes?.[attr.key];
                return val !== null && val !== undefined && String(val).trim() !== '';
            }) || [];

            if (validAttributes.length === 0) return null;

            return (
              <div className="bg-white md:rounded-xl p-6 border border-gray-100 shadow-sm">
                <h2 className="text-xs font-black text-gray-900 uppercase tracking-widest mb-6 border-l-4 border-primary pl-4">
                  ⚡ Thông số kỹ thuật
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-y-6 gap-x-4">
                  {validAttributes.map((attr) => {
                    const value = listing.attributes?.[attr.key];
                    return (
                      <div key={attr.key} className="flex items-center gap-3 group">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex-shrink-0 flex items-center justify-center border border-blue-100 group-hover:bg-primary group-hover:text-white transition-colors">
                          {getAttributeIcon(attr.key)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">
                            {attr.label}
                          </p>
                          <p className="text-sm font-bold text-gray-800 truncate" title={String(value)}>
                            {value} {attr.suffix || ''}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

        {/* Description */}
          <div className="bg-white md:rounded-xl p-6 border border-gray-100 shadow-sm space-y-4">
            <h2 className="text-xs font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                <Edit className="w-4 h-4 text-gray-400" /> Mô tả sản phẩm
            </h2>
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap text-sm font-medium border-l-4 border-gray-100 pl-6 py-2">{listing.description}</p>
          </div>

          {/* Reviews */}
          <div className="bg-white md:rounded-xl p-6 border border-gray-100 shadow-sm">
            <ReviewSection targetId={listing.id} targetType="listing" currentUser={user} />
          </div>
        </div>

        {/* RIGHT: SIDEBAR */}
        <div className="lg:col-span-4 p-4 md:p-0">
          <div className="bg-white md:rounded-xl p-6 border border-gray-100 shadow-xl space-y-6 sticky top-24">
            <div className="space-y-4">
              <h1 className="text-xl font-bold text-gray-800 leading-snug uppercase">{listing.title}</h1>
              {listing.isAuction ? (
                  <AuctionBox listing={listing} user={user} />
              ) : (
                  <p className="text-4xl font-black tracking-tighter text-primary">{listing.price > 0 ? formatPrice(listing.price) : 'Liên hệ'}</p>
              )}
              <div className="flex flex-col gap-3 pt-4 border-t border-gray-50">
                <div className="flex items-start gap-3 text-gray-500 font-bold text-xs">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5" /> <span>{listing.address || listing.location}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold">
                    <Clock className="w-3 h-3" /> <span>{formatTimeAgo(listing.createdAt)}</span> • 
                    <Eye className="w-3 h-3" /> <span>{listing.viewCount} xem</span>
                </div>
              </div>
            </div>

           {/* SELLER INFO - [UPDATED: Realtime Online Status] */}
            <Link to={`/seller/${listing.sellerId}`} className="flex items-center gap-4 p-4 bg-gray-50/50 rounded-2xl border border-gray-100 hover:border-primary/30 transition-all group">
                <div className="relative">
                    <img src={listing.sellerAvatar} className="w-14 h-14 rounded-2xl object-cover border-2 border-white shadow-md" alt="" />
                    {/* Online Status */}
                    <div 
                        className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 border-2 border-white rounded-full transition-colors ${
                            isSellerOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-300'
                        }`}
                        title={isSellerOnline ? "Đang Online" : "Đang Offline"}
                    ></div>
                </div>
                <div className="min-w-0">
                    <p className="font-bold text-sm text-gray-900 group-hover:text-primary">{listing.sellerName}</p>
                    {seller?.verificationStatus === 'verified' ? 
                        <p className="text-[10px] font-black text-blue-500 uppercase mt-1 flex items-center gap-1"><BadgeCheck className="w-3 h-3" /> Đã xác thực</p> : 
                        <p className="text-[10px] font-bold text-gray-400 mt-1">Thành viên mới</p>
                    }
                </div>
            </Link>

             <div className="space-y-3">
              {(isOwner || user?.role === 'admin') ? (
                  <Link to={`/edit/${listing.id}`} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black text-xs uppercase shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all">
                      <Edit className="w-5 h-5" /> Chỉnh sửa tin này
                  </Link>
              ) : (
                  !listing.isAuction && (
                    <>
                      {listing.affiliateLink ? (
                        <a href={listing.affiliateLink} target="_blank" rel="nofollow" className="w-full bg-orange-600 hover:bg-orange-700 text-white py-4 rounded-2xl font-black text-xs shadow-xl animate-bounce flex items-center justify-center gap-2">
                            <ExternalLink className="w-5 h-5" /> MUA NGAY
                        </a>
                      ) : (
                        <div className="flex gap-2">
                            {/* 1. Nút Trả giá */}
                            <button 
                                onClick={() => { 
                                    if(!user) return navigate('/login'); 
                                    setShowOfferModal(true); 
                                }} 
                                className="flex-1 bg-green-50 text-green-600 border border-green-200 py-3 rounded-xl font-black text-[10px] uppercase hover:bg-green-100 transition-colors flex flex-col items-center justify-center gap-1"
                            >
                                <Tag className="w-5 h-5" />
                                <span>Trả giá</span>
                            </button>
                            
                            {/* 2. Nút Đổi đồ */}
                            <button 
                                onClick={() => { 
                                    if(!user) return navigate('/login');
                                    setShowSwapModal(true); 
                                }} 
                                className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-none py-3 rounded-xl font-black text-[10px] uppercase shadow-lg shadow-purple-200 hover:shadow-purple-400 hover:scale-[1.02] active:scale-95 transition-all duration-300 flex flex-col items-center justify-center gap-1 group"
                            >
                                <RefreshCcw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
                                <span>Đổi đồ</span>
                            </button>

                            {/* 3. Nút Chat */}
                            <button onClick={handleStartChat} disabled={isChatLoading} className="flex-[1.5] bg-primary hover:bg-primaryHover text-white py-3 rounded-xl font-black text-[10px] uppercase shadow-lg shadow-primary/30 flex flex-col items-center justify-center gap-1">
                                {isChatLoading ? (
                                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                ) : (
                                    <MessageCircle className="w-5 h-5" />
                                )}
                                <span>{isChatLoading ? 'Đang kết nối...' : 'Chat ngay'}</span>
                            </button>
                        </div>
                      )}

                      {/* Nút Hiện số điện thoại */}
                      {!listing.affiliateLink && seller?.phone && (
                        <button 
                            onClick={() => {
                                if(!user) return navigate('/login');
                                if(isPhoneVisible) window.location.href=`tel:${seller.phone}`;
                                else setIsPhoneVisible(true);
                            }} 
                            className="w-full bg-white border-2 border-green-500 text-green-600 py-4 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2 hover:bg-green-50 transition-colors"
                        >
                            <Phone className="w-5 h-5" />
                            {isPhoneVisible ? seller.phone : 'Hiện số điện thoại'}
                        </button>
                      )}
                    </>
                  )
              )}
            </div>


            <div className="flex gap-3">
              <button 
                onClick={() => handleToggleFav(listing.id)} 
                className={`flex-1 py-4 border border-gray-200 bg-gray-50 rounded-2xl text-[10px] font-black uppercase transition-colors flex items-center justify-center gap-2 ${userFavorites.includes(listing.id) ? 'text-red-500 border-red-200 bg-red-50' : 'text-gray-500 hover:text-red-500'}`}
              >
                <Heart className={`w-5 h-5 ${userFavorites.includes(listing.id) ? 'fill-current' : ''}`} />
                {userFavorites.includes(listing.id) ? 'Đã lưu' : 'Lưu tin'}
              </button>
              
              <button onClick={() => setIsShareModalOpen(true)} className="flex-1 py-4 border border-gray-200 bg-gray-50 rounded-2xl text-[10px] font-black uppercase text-gray-500 hover:text-blue-500 transition-colors flex items-center justify-center gap-2">
                <Share2 className="w-5 h-5" /> Chia sẻ
              </button>
            </div>

            {listing.lat && listing.lng && (
                <div className="w-full h-48 rounded-2xl overflow-hidden relative border border-gray-200 mt-4 z-0">
                    <MapContainer center={[listing.lat, listing.lng]} zoom={13} style={{ height: '100%', width: '100%' }}>
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='© OpenStreetMap' />
                        <Marker position={[listing.lat, listing.lng]}><Popup>{listing.address || "Vị trí"}</Popup></Marker>
                    </MapContainer>
                </div>
            )}
            
            <button onClick={() => setShowReportModal(true)} className="w-full text-[9px] font-black text-gray-300 uppercase tracking-widest hover:text-red-400 transition-colors text-center pt-2 flex items-center justify-center gap-1">
                <Flag className="w-3 h-3" /> Báo cáo tin này
            </button>
          </div>
        </div>
      </div>

      {/* SIMILAR LISTINGS */}
      <div className="px-4 md:px-0 pt-10">
        <div className="flex items-center justify-between mb-8 px-2 border-b border-gray-100 pb-4">
          <h2 className="text-xl font-black text-gray-800 uppercase flex items-center gap-2">
            <Flame className="w-6 h-6 text-orange-500 fill-orange-500 animate-pulse" /> Có thể bạn thích
          </h2>
          <Link to={`/?category=${listing.category}`} className="text-xs font-black text-primary hover:underline flex items-center gap-1">
            Xem tất cả <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-5">
          {similarListings.map(l => (
            <ListingCard 
                key={l.id} 
                listing={l} 
                isFavorite={userFavorites.includes(l.id)} 
                onToggleFavorite={() => handleToggleFav(l.id)} 
            />
          ))}
        </div>
      </div>

      {/* FOOTER */}
      <footer className="hidden md:block pt-20 border-t border-dashed border-gray-200 mt-20">
         <div className="bg-white border border-gray-100 rounded-[3rem] p-12 shadow-sm">
            <div className="flex items-center justify-between mb-10">
               <h4 className="text-2xl font-black text-gray-800 flex items-center gap-3">
                 <ShieldCheck className="w-8 h-8 text-yellow-500" /> Chợ Của Tui
               </h4>
               <div className="flex gap-8">
                  {STATIC_LINKS.map(link => <Link key={link.slug} to={`/page/${link.slug}`} className="text-[11px] font-black text-gray-400 hover:text-primary transition-colors uppercase tracking-widest">{link.title}</Link>)}
               </div>
            </div>
            <div className="text-[10px] text-gray-300 font-bold text-center border-t border-gray-50 pt-10 uppercase tracking-widest">© 2026 ChoCuaTui.vn - Trí tuệ nhân tạo phục vụ cộng đồng.</div>
         </div>
      </footer>

     {/* MODALS */}
      {showReportModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowReportModal(false)}></div>
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl relative border border-gray-200">
            <h3 className="text-2xl font-black text-gray-900 mb-6 flex items-center gap-2">
                <AlertTriangle className="w-6 h-6 text-red-500" /> Báo cáo vi phạm
            </h3>
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

      {/* Lightbox Modal */}
      {isLightboxOpen && (
        <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center" onClick={() => setIsLightboxOpen(false)}>
            <button className="absolute top-4 right-4 text-white p-4 z-50 bg-white/10 rounded-full" onClick={() => setIsLightboxOpen(false)}>
                <X className="w-6 h-6" />
            </button>

            <img 
                src={mediaList[activeMedia]} 
                className="max-w-full max-h-full object-contain transition-transform duration-200"
                alt="Fullscreen"
                onClick={(e) => e.stopPropagation()} 
            />
            
            {mediaList.length > 1 && (
                <>
                    <button onClick={(e) => { e.stopPropagation(); setActiveMedia(prev => prev > 0 ? prev - 1 : mediaList.length - 1); }} className="absolute left-2 top-1/2 -translate-y-1/2 p-3 text-white bg-white/10 rounded-full">
                        <ChevronLeft className="w-8 h-8" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setActiveMedia(prev => prev < mediaList.length - 1 ? prev + 1 : 0); }} className="absolute right-2 top-1/2 -translate-y-1/2 p-3 text-white bg-white/10 rounded-full">
                        <ChevronRight className="w-8 h-8" />
                    </button>
                </>
            )}
            
            <p className="absolute bottom-8 text-white font-bold text-sm bg-black/50 px-4 py-2 rounded-full">{activeMedia + 1} / {mediaList.length}</p>
        </div>
      )}

      {/* Modal Đổi đồ */}
      {listing && user && (
          <SwapModal 
            isOpen={showSwapModal} 
            onClose={() => setShowSwapModal(false)} 
            targetListing={listing} 
            currentUser={user} 
            onSubmit={handleSwapSubmit} 
          />
      )}
      {listing && <OfferModal isOpen={showOfferModal} onClose={() => setShowOfferModal(false)} onSubmit={handleMakeOffer} originalPrice={listing.price} productName={listing.title} />}
      <ShareModal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} url={getListingUrl(listing)} title={listing.title} />
    </div>
  );
};

export default ListingDetail;
