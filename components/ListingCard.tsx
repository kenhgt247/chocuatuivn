import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Listing, User } from '../types';
import { formatPrice, formatTimeAgo } from '../utils/format';
import { db } from '../services/db';
import ShareModal from './ShareModal';

// --- BỘ ICON ---
const IconZap = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>;
const IconHeart = ({ fill, className }: { fill?: string, className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill={fill || "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>;
const IconLoader2 = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>;
const IconEye = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const IconUser = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const IconClock = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
const IconMapPin = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>;
const IconArrowUp = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>;
const IconShare = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>;
const IconCreditCard = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>;
const IconStar = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;

interface ListingCardProps {
  listing: Listing;
  currentUser?: User | null;
  isFavorite?: boolean;
  onToggleFavorite?: (id: string) => void;
  hideViews?: boolean;
}

const ListingCard: React.FC<ListingCardProps> = ({ 
  listing, 
  currentUser,
  isFavorite = false, 
  onToggleFavorite, 
  hideViews = false 
}) => {
  const navigate = useNavigate();
  const [isPushing, setIsPushing] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  
  // State bật tắt Modal chọn phương thức đẩy tin
  const [showPushModal, setShowPushModal] = useState(false);
  
  const [pushConfig, setPushConfig] = useState<{ price: number, discount: number }>({ price: 5000, discount: 0 });

  useEffect(() => {
      let isMounted = true;
      const loadSettings = async () => {
          try {
            const settings = await db.getSettings();
            if (isMounted && settings) {
                setPushConfig({
                    price: settings.pushPrice || 5000,
                    discount: settings.pushDiscount || 0
                });
            }
          } catch (error) {}
      };
      loadSettings();
      return () => { isMounted = false; };
  }, []);

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault(); 
    e.stopPropagation();
    if (onToggleFavorite) onToggleFavorite(listing.id);
  };

  const handleShareClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsShareModalOpen(true);
  };

  // --- 1. SỰ KIỆN BẤM NÚT ĐẨY TIN ---
  const handlePushClick = (e: React.MouseEvent) => {
    e.preventDefault();     // Chặn link
    e.stopPropagation();    // Chặn sự kiện lan truyền ra thẻ cha (quan trọng!)

    if (!currentUser) {
        if(window.confirm("Bạn cần đăng nhập để sử dụng tính năng này.")) navigate('/login');
        return;
    }

    // Mở Modal
    setShowPushModal(true);
  };

  // --- 2. HÀM XỬ LÝ ĐẨY TIN (GỌI API) ---
  const processPush = async (method: 'money' | 'point') => {
    // Tính toán giá
    const finalPrice = pushConfig.price * (1 - pushConfig.discount / 100);
    const pointsNeeded = Math.ceil(finalPrice / 100); // 100đ = 1 điểm

    setShowPushModal(false); // Đóng modal ngay

    // Kiểm tra số dư
    if (method === 'money') {
        if ((currentUser?.walletBalance || 0) < finalPrice) {
            if(confirm(`Số dư không đủ (Thiếu ${formatPrice(finalPrice - (currentUser?.walletBalance || 0))}). Nạp ngay?`)) {
                navigate('/wallet');
            }
            return;
        }
    } else {
        if ((currentUser?.pointBalance || 0) < pointsNeeded) {
            alert(`Không đủ điểm (Thiếu ${pointsNeeded - (currentUser?.pointBalance || 0)} điểm). Chia sẻ tin để kiếm thêm!`);
            return;
        }
    }

    setIsPushing(true);
    try {
        let res;
        // Gọi hàm tương ứng trong db.ts
        if (method === 'money') {
            res = await db.pushListing(listing.id, currentUser!.id);
        } else {
            res = await db.pushListingWithPoints(listing.id, currentUser!.id, pointsNeeded);
        }

        if (res.success) {
            alert("🚀 Đẩy tin thành công!");
            window.location.reload(); // Load lại trang để thấy tin lên đầu
        } else {
            alert("Lỗi: " + res.message);
        }
    } catch (error) {
        console.error(error);
        alert("Có lỗi xảy ra.");
    } finally {
        // Đảm bảo state được set lại an toàn
        setIsPushing(false);
    }
  };

  const isOwner = currentUser && (String(currentUser.id) === String(listing.sellerId));
  const canPush = isOwner && (listing.status === 'approved');

  // Tính giá hiển thị để hover xem
  const finalPrice = pushConfig.price * (1 - pushConfig.discount / 100);
  const pointsNeeded = Math.ceil(finalPrice / 100);

  const getCardStyle = () => {
    switch (listing.tier) {
      case 'pro':
        return {
          container: "border-yellow-400 shadow-md ring-1 ring-yellow-400/50",
          badge: (<span className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-[9px] font-black px-2 py-1 rounded-lg uppercase shadow-sm tracking-wider flex items-center gap-1"><IconZap className="w-2.5 h-2.5 fill-current" /> VIP</span>),
          bgTitle: "bg-yellow-50/50"
        };
      case 'basic':
        return {
          container: "border-blue-200 shadow-sm",
          badge: (<span className="bg-blue-500 text-white text-[9px] font-black px-2 py-1 rounded-lg uppercase shadow-sm tracking-wider">HOT</span>),
          bgTitle: "bg-blue-50/30"
        };
      default:
        return {
          container: "border-gray-100 hover:border-gray-300",
          badge: listing.condition === 'new' ? (<span className="bg-green-500 text-white text-[9px] font-black px-2 py-1 rounded-lg uppercase shadow-sm tracking-wider">Mới</span>) : null,
          bgTitle: "bg-white"
        };
    }
  };

  const cardStyle = getCardStyle();

  return (
    <>
        <div className={`group relative flex flex-col bg-white rounded-lg transition-all duration-300 overflow-hidden h-full hover:-translate-y-1 hover:shadow-lg ${cardStyle.container}`}>
        
        {/* --- PHẦN HÌNH ẢNH --- */}
        <div className="relative aspect-square overflow-hidden bg-gray-100">
            <Link to={`/san-pham/${listing.slug}-${listing.id}`} className="block w-full h-full">
                <img 
                src={listing.images?.[0] || 'https://placehold.co/400?text=No+Image'} 
                alt={listing.title} 
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                loading="lazy"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors pointer-events-none"></div>
            </Link>
            
            <div className="absolute top-2 left-2 flex flex-col gap-1 z-10 pointer-events-none">{cardStyle.badge}</div>

            <button 
            onClick={handleFavoriteClick}
            className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center shadow-md transition-all active:scale-90 z-40 cursor-pointer ${isFavorite ? 'bg-red-500 text-white' : 'bg-white/90 text-gray-400 hover:text-red-500 hover:bg-white'}`}
            title="Lưu tin"
            >
            <IconHeart className="w-4 h-4" fill={isFavorite ? "currentColor" : "none"} />
            </button>

            {/* Nút Chia Sẻ (Góc dưới Trái) */}
            <button 
                onClick={handleShareClick}
                className="group/share absolute bottom-2 left-2 h-8 bg-white/90 hover:bg-pink-500 hover:text-white text-pink-500 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 z-30 border border-pink-100 hover:pr-3 hover:pl-1 min-w-[32px] w-auto overflow-hidden"
                title="Chia sẻ nhận điểm"
            >
                <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                    <IconShare className="w-4 h-4" />
                </div>
                <span className="max-w-0 group-hover/share:max-w-[120px] transition-all duration-300 text-[10px] font-black uppercase whitespace-nowrap opacity-0 group-hover/share:opacity-100">
                    Share nhận điểm
                </span>
            </button>

            {/* Nút Đẩy tin (Góc dưới Phải) */}
            {canPush && (
                <button 
                    onClick={handlePushClick}
                    disabled={isPushing}
                    className="group/push absolute bottom-2 right-2 h-8 bg-green-600 text-white rounded-full flex items-center justify-center shadow-lg transition-all duration-300 z-30 border-2 border-white hover:pr-3 hover:pl-1 min-w-[32px] w-auto"
                    title={`Đẩy tin: ${formatPrice(finalPrice)} hoặc ${pointsNeeded} điểm`}
                >
                    <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                        {isPushing ? <IconLoader2 className="w-4 h-4 animate-spin" /> : <IconArrowUp className="w-4 h-4" />}
                    </div>
                    <span className="max-w-0 overflow-hidden group-hover/push:max-w-[120px] transition-all duration-300 text-[10px] font-black uppercase whitespace-nowrap">
                        Đẩy tin
                    </span>
                </button>
            )}
        </div>

        {/* --- PHẦN NỘI DUNG --- */}
        <Link to={`/san-pham/${listing.slug}-${listing.id}`} className={`flex flex-col flex-1 p-3 space-y-2 ${cardStyle.bgTitle}`}>
            <h3 className={`text-xs ${listing.tier === 'pro' ? 'font-black text-black' : 'font-bold text-slate-700'} line-clamp-2 min-h-[2.5em] leading-relaxed group-hover:text-primary transition-colors`}>
            {listing.title}
            </h3>

            <div className="flex items-center justify-between mt-1">
                <span className="text-sm font-black text-red-600">{formatPrice(listing.price)}</span>
                {!hideViews && (
                    <div className="flex items-center gap-1 text-gray-400 text-[10px] bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
                        <IconEye className="w-3 h-3" />
                        <span className="font-bold">{listing.views || listing.viewCount || 0}</span>
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-auto">
                <div className="flex items-center gap-1.5 min-w-0">
                    {listing.sellerAvatar ? (
                        <img src={listing.sellerAvatar} alt="" className="w-5 h-5 rounded-full object-cover border border-gray-100" />
                    ) : (
                        <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center border border-gray-200"><IconUser className="w-3 h-3 text-slate-400" /></div>
                    )}
                    <span className="text-[9px] font-bold text-gray-400 truncate flex items-center gap-1"><IconClock className="w-2.5 h-2.5" />{formatTimeAgo(listing.createdAt)}</span>
                </div>
                <div className="flex items-center gap-0.5 text-gray-400 max-w-[45%]">
                    <IconMapPin className="w-3 h-3 flex-shrink-0" />
                    <span className="text-[9px] font-bold truncate">{listing.location}</span>
                </div>
            </div>
        </Link>
        </div>

        {/* --- 🔥 MODAL CHỌN PHƯƠNG THỨC ĐẨY TIN (FIXED BUBBLING) --- */}
        {showPushModal && (
             <div 
                className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md" 
                onClick={(e) => { 
                    e.preventDefault();
                    e.stopPropagation(); 
                    setShowPushModal(false); 
                }}
             >
                 <div 
                    className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl relative animate-scale-up border border-white" 
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation(); // CHẶN click xuyên qua modal
                    }}
                 >
                    <h3 className="text-xl font-black text-slate-900 mb-2">Đẩy tin lên đầu</h3>
                    <p className="text-slate-500 text-xs font-bold mb-6">Chọn phương thức thanh toán bạn muốn:</p>

                    <div className="flex flex-col gap-3">
                         {/* Cách 1: Tiền mặt */}
                         <button onClick={() => processPush('money')} className="w-full p-4 rounded-2xl bg-blue-50 hover:bg-blue-100 border border-blue-200 flex items-center justify-between group transition-all">
                             <div className="flex items-center gap-3">
                                 <div className="w-10 h-10 bg-blue-500 text-white rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform"><IconCreditCard className="w-5 h-5" /></div>
                                 <div className="text-left">
                                     <p className="text-[10px] font-black uppercase text-blue-400">Dùng tiền ví</p>
                                     <p className="text-sm font-black text-slate-800">{formatPrice(finalPrice)}</p>
                                 </div>
                             </div>
                             <IconArrowUp className="w-4 h-4 text-blue-500" />
                         </button>

                         {/* Cách 2: Điểm thưởng */}
                         <button onClick={() => processPush('point')} className="w-full p-4 rounded-2xl bg-yellow-50 hover:bg-yellow-100 border border-yellow-200 flex items-center justify-between group transition-all">
                             <div className="flex items-center gap-3">
                                 <div className="w-10 h-10 bg-yellow-500 text-white rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform"><IconStar className="w-5 h-5" /></div>
                                 <div className="text-left">
                                     <p className="text-[10px] font-black uppercase text-yellow-600">Dùng điểm thưởng</p>
                                     <p className="text-sm font-black text-slate-800">{pointsNeeded} điểm</p>
                                 </div>
                             </div>
                             <IconArrowUp className="w-4 h-4 text-yellow-600" />
                         </button>

                         <button onClick={() => setShowPushModal(false)} className="mt-2 text-xs font-bold text-slate-400 hover:text-slate-600 py-3">
                             Hủy bỏ
                         </button>
                    </div>
                 </div>
             </div>
        )}

        <ShareModal 
            isOpen={isShareModalOpen} 
            onClose={() => setIsShareModalOpen(false)} 
            url={`${window.location.origin}/san-pham/${listing.slug}-${listing.id}${currentUser ? `?ref=${currentUser.id}` : ''}`} 
            title={listing.title} 
        />
    </>
  );
};

export default ListingCard;