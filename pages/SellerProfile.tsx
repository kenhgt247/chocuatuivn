import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { db } from '../services/db';
import { User, Listing, Review } from '../types';
import ListingCard from '../components/ListingCard';
import { formatTimeAgo } from '../utils/format';
import ReviewSection from '../components/ReviewSection';
import { QueryDocumentSnapshot, DocumentData, getFirestore, doc, onSnapshot } from 'firebase/firestore';

// ⚠️ ĐÃ LOẠI BỎ LUCIDE-REACT ĐỂ TRÁNH LỖI CRASH
// --- BỘ ICON VẼ TAY (SVG THUẦN) ---
const IconShieldCheck = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>;
const IconShield = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
const IconCalendar = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
const IconMapPin = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>;
const IconStar = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
const IconPackage = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>;
const IconUsers = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const IconMessageSquare = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
const IconSettings = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>;
const IconUserCheck = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>;
const IconUserPlus = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>;
const IconPhone = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>;
const IconMessageCircle = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>;
const IconAlertTriangle = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
const IconChevronRight = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>;
const IconLoader2 = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>;
const IconPackageOpen = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M8 8.5A6 6 0 0 1 12 3a6 6 0 0 1 4 5.5"/></svg>;
const IconExternalLink = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>;

const SellerProfile: React.FC<{ currentUser: User | null }> = ({ currentUser }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  // State cơ bản
  const [seller, setSeller] = useState<User | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [activeTab, setActiveTab] = useState<'listings' | 'reviews'>('listings');
  
  // State Follow & Contact
  const [isFollowing, setIsFollowing] = useState(false);
  const [followStats, setFollowStats] = useState({ followers: 0, following: 0 });
  const [isPhoneVisible, setIsPhoneVisible] = useState(false);
  
  // [NEW] State Online Realtime
  const [isSellerOnline, setIsSellerOnline] = useState(false);

  // State Loading & Error
  const [loading, setLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  
  // Pagination States
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const PAGE_SIZE = 10;

  // Kiểm tra xem người xem có phải là chủ sở hữu trang này không
  const isOwner = currentUser && id && currentUser.id === id;

  const loadInitialData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setListings([]);
    setLastDoc(null);
    setHasMore(true);
    setQueryError(null);

    try {
      // 1. Lấy thông tin người bán (Lần đầu)
      const found = await db.getUserById(id);
      
      if (found) {
        setSeller(found);
        
        // 2. Lấy thống kê Follow
        try {
            const stats = await db.getFollowStats(id); 
            setFollowStats(stats);
        } catch (e) {
            console.warn("Chưa lấy được follow stats", e);
        }

        // 3. Kiểm tra xem mình có đang follow người này không
        if (currentUser && !isOwner) {
            try {
                const isF = await db.checkIsFollowing(currentUser.id, id);
                setIsFollowing(isF);
            } catch (e) {
                setIsFollowing(false);
            }
        }
        
        // 4. Phân trang tin đăng
        const result = await db.getListingsPaged({
          pageSize: PAGE_SIZE,
          sellerId: id,
          status: 'approved'
        });
        
        if (result.error) {
          setQueryError(result.error);
        } else {
          setListings(result.listings);
          setLastDoc(result.lastDoc);
          setHasMore(result.hasMore);
        }
        
        // 5. Lấy đánh giá
        db.getReviews(id, 'user', (loadedReviews) => {
          setReviews(loadedReviews);
        });
      }
    } catch (err) {
      console.error("Error loading seller:", err);
    } finally {
      setLoading(false);
    }
  }, [id, currentUser, isOwner]);

  useEffect(() => {
    loadInitialData();
    window.scrollTo(0, 0);
  }, [loadInitialData]);

  // [QUAN TRỌNG] Lắng nghe trạng thái Online Realtime
  useEffect(() => {
    if (!id) return;

    const dbInstance = getFirestore();
    const userRef = doc(dbInstance, "users", id);

    const unsubscribe = onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            const isOnline = data.isOnline === true;
            
            // Kiểm tra thêm thời gian hoạt động cuối cùng (trong vòng 5 phút)
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
  }, [id]);

  const handleLoadMore = async () => {
    if (isFetchingMore || !hasMore || !lastDoc || !id) return;
    setIsFetchingMore(true);
    try {
      const result = await db.getListingsPaged({
        pageSize: PAGE_SIZE,
        lastDoc,
        sellerId: id,
        status: 'approved'
      });
      
      if (!result.error) {
        setListings(prev => [...prev, ...result.listings]);
        setLastDoc(result.lastDoc);
        setHasMore(result.hasMore);
      }
    } catch (e) {
      console.error("Seller load more error:", e);
    } finally {
      setIsFetchingMore(false);
    }
  };

  const avgRating = useMemo(() => {
    if (reviews.length === 0) return 0;
    return Number((reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1));
  }, [reviews]);

  // --- LOGIC FOLLOW ---
  const handleToggleFollow = async () => {
    if (!currentUser) return navigate('/login');
    if (isOwner) return;
    
    const prevStatus = isFollowing;
    const prevCount = followStats.followers;
    
    setIsFollowing(!prevStatus);
    setFollowStats(prev => ({
        ...prev,
        followers: !prevStatus ? prev.followers + 1 : prev.followers - 1
    }));
    
    try {
      if (!prevStatus) {
        await db.followUser(currentUser.id, id!); 
      } else {
        await db.unfollowUser(currentUser.id, id!);
      }
    } catch (err) {
      console.error("Lỗi follow:", err);
      setIsFollowing(prevStatus);
      setFollowStats(prev => ({ ...prev, followers: prevCount }));
      alert("Có lỗi xảy ra, vui lòng thử lại.");
    }
  };

  // --- LOGIC CHAT ---
  const handleStartChat = async () => {
    if (!currentUser) return navigate('/login');
    if (!seller || isOwner) return;

    setChatLoading(true);
    try {
        const targetListing = listings.length > 0 ? listings[0] : {
            id: `profile_chat_${seller.id}`, 
            title: `Chat với ${seller.name}`,
            images: [seller.avatar],
            price: 0,
            sellerId: seller.id,
            sellerName: seller.name, 
            sellerAvatar: seller.avatar
        };

        const roomId = await db.createChatRoom(targetListing, currentUser);
        navigate(`/chat/${roomId}`);

    } catch (error) {
        console.error("Start chat error:", error);
        alert("Không thể khởi tạo cuộc trò chuyện.");
    } finally {
        setChatLoading(false);
    }
  };

  // --- LOGIC HIỆN SỐ ĐIỆN THOẠI ---
  const handlePhoneClick = () => {
    if (!currentUser) {
        if(window.confirm("Bạn cần đăng nhập để xem số điện thoại.")) {
            navigate('/login', { state: { from: location.pathname } });
        }
        return;
    }

    if (isPhoneVisible && seller?.phone) {
        window.location.href = `tel:${seller.phone}`;
    } else {
        setIsPhoneVisible(true);
    }
  };

  if (loading) return (
    <div className="py-32 flex flex-col items-center gap-6 justify-center">
      <IconLoader2 className="w-12 h-12 text-primary animate-spin" />
      <p className="text-gray-400 font-black uppercase text-[10px] tracking-widest animate-pulse">Đang nạp hồ sơ...</p>
    </div>
  );

  if (!seller) return (
    <div className="py-32 text-center flex flex-col items-center">
      <IconAlertTriangle className="w-16 h-16 text-gray-300 mb-4" />
      <h2 className="text-xl font-black text-gray-800">Người dùng không tồn tại</h2>
      <Link to="/" className="text-primary font-bold hover:underline mt-2 flex items-center gap-1">
         <IconChevronRight className="w-4 h-4" /> Về trang chủ
      </Link>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-24 px-4 md:px-0">
      
      {/* Header Profile Section */}
      <div className="bg-white border border-gray-100 rounded-[3rem] p-6 md:p-12 shadow-soft overflow-hidden relative">
        <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 rounded-full -mr-40 -mt-40 blur-3xl"></div>
        <div className="flex flex-col md:flex-row gap-10 items-center md:items-start relative z-10">
          
          {/* Avatar Section */}
          <div className="relative">
            <img 
              src={seller.avatar} 
              alt={seller.name} 
              className="w-32 h-32 md:w-44 md:h-44 rounded-[3rem] border-4 border-white shadow-2xl object-cover" 
            />
            
            {/* [UPDATED] Online Status Badge (Realtime) */}
            <div className={`absolute -bottom-2 right-4 px-3 py-1 rounded-xl border-4 border-white shadow-lg flex items-center gap-1.5 transition-colors duration-300 ${isSellerOnline ? 'bg-green-500' : 'bg-gray-400'}`}>
                <div className={`w-1.5 h-1.5 bg-white rounded-full ${isSellerOnline ? 'animate-pulse' : ''}`}></div>
                <span className="text-[8px] font-black text-white uppercase">{isSellerOnline ? 'Online' : 'Offline'}</span>
            </div>
          </div>

          {/* Info Section */}
          <div className="flex-1 space-y-6 text-center md:text-left w-full">
            <div className="space-y-2">
              <div className="flex items-center justify-center md:justify-start gap-3">
                  <h1 className="text-3xl md:text-5xl font-black text-gray-900 tracking-tighter">{seller.name}</h1>
                  {seller.verificationStatus === 'verified' && (
                      <div className="text-blue-500" title="Tài khoản đã xác thực">
                          <IconShieldCheck className="w-6 h-6 fill-blue-50" />
                      </div>
                  )}
                  {seller.role === 'admin' && (
                      <div className="text-red-500" title="Quản trị viên">
                          <IconShield className="w-6 h-6 fill-red-50" />
                      </div>
                  )}
              </div>
              
              <div className="flex flex-col md:flex-row items-center justify-center md:justify-start gap-3 text-gray-400">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] flex items-center gap-1">
                      <IconCalendar className="w-3 h-3 mb-0.5" /> Tham gia: {formatTimeAgo(seller.joinedAt)}
                  </p>
                  {seller.location && (
                      <>
                        <span className="hidden md:inline">•</span>
                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] flex items-center gap-1">
                            <IconMapPin className="w-3 h-3 mb-0.5" /> {seller.location}
                        </p>
                      </>
                  )}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-6 border-y border-gray-100">
               <div>
                 <div className="flex items-center justify-center md:justify-start gap-2">
                   <span className="text-2xl font-black text-gray-900">{avgRating}</span>
                   <div className="flex gap-0.5">
                     {[1, 2, 3, 4, 5].map((star) => (
                       <IconStar 
                         key={star} 
                         className={`w-3.5 h-3.5 ${star <= Math.round(Number(avgRating)) ? 'text-yellow-400 fill-current' : 'text-gray-200'}`} 
                       />
                     ))}
                   </div>
                 </div>
                 <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Đánh giá TB</p>
               </div>

               <div className="border-x border-gray-100 px-4">
                   <div className="flex items-center justify-center md:justify-start gap-2">
                        <IconPackage className="w-5 h-5 text-primary" />
                        <span className="text-2xl font-black text-gray-900">{listings.length}</span>
                   </div>
                   <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Tin đang bán</p>
               </div>
               
               <div className="border-r border-gray-100 pr-4">
                 <div className="flex items-center justify-center md:justify-start gap-2">
                    <IconUsers className="w-5 h-5 text-blue-500" />
                    <span className="text-2xl font-black text-gray-900">{followStats.followers}</span>
                 </div>
                 <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Theo dõi</p>
               </div>
               
               <div>
                   <div className="flex items-center justify-center md:justify-start gap-2">
                        <IconMessageSquare className="w-5 h-5 text-green-500" />
                        <span className="text-2xl font-black text-green-600">99%</span>
                   </div>
                   <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Phản hồi</p>
               </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex flex-wrap gap-4 pt-2">
              {isOwner ? (
                  <Link to="/profile" className="flex-1 md:flex-none min-w-[200px] bg-gray-100 text-gray-600 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-all shadow-sm flex items-center justify-center gap-2">
                    <IconSettings className="w-4 h-4" /> Chỉnh sửa hồ sơ
                  </Link>
              ) : (
                  <>
                      {/* Nút Follow */}
                      <button 
                        onClick={handleToggleFollow} 
                        className={`flex-1 md:flex-none min-w-[140px] px-8 py-4 rounded-2xl font-black text-xs transition-all uppercase tracking-widest flex items-center justify-center gap-2 ${isFollowing ? 'bg-gray-100 text-gray-400' : 'bg-primary text-white shadow-xl shadow-primary/20 hover:scale-105 active:scale-95'}`}
                      >
                        {isFollowing ? <IconUserCheck className="w-4 h-4" /> : <IconUserPlus className="w-4 h-4" />}
                        {isFollowing ? 'Đang theo dõi' : 'Theo dõi'}
                      </button>
                      
                      {/* Nút Gọi Điện */}
                      {seller.phone && (
                        <button 
                          onClick={handlePhoneClick}
                          className="flex-1 md:flex-none min-w-[160px] px-8 py-4 bg-white border-2 border-green-500 text-green-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-green-50 transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            <IconPhone className="w-4 h-4" />
                            {isPhoneVisible ? seller.phone : 'Hiện SĐT'}
                        </button>
                      )}

                      {/* Nút Chat */}
                      <button 
                        onClick={handleStartChat} 
                        disabled={chatLoading}
                        className="flex-1 md:flex-none min-w-[140px] px-8 py-4 bg-white border-2 border-primary text-primary rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-primary/5 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-wait flex items-center justify-center gap-2"
                      >
                        {chatLoading ? <IconLoader2 className="w-4 h-4 animate-spin" /> : <IconMessageCircle className="w-4 h-4" />}
                        {chatLoading ? 'Kết nối...' : 'Nhắn tin'}
                      </button>
                  </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs and Content Section */}
      <div className="space-y-8">
        <div className="flex gap-4 p-2 bg-gray-100 rounded-3xl w-full max-w-md mx-auto md:mx-0">
          <button onClick={() => setActiveTab('listings')} className={`flex-1 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'listings' ? 'bg-white text-primary shadow-lg' : 'text-gray-500'}`}>
              <IconPackage className="w-4 h-4" /> Tin rao ({listings.length})
          </button>
          <button onClick={() => setActiveTab('reviews')} className={`flex-1 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'reviews' ? 'bg-white text-primary shadow-lg' : 'text-gray-500'}`}>
              <IconStar className="w-4 h-4" /> Đánh giá ({reviews.length})
          </button>
        </div>

        {queryError && (
          <div className="bg-red-50 border-2 border-dashed border-red-200 rounded-[2.5rem] p-10 text-center animate-fade-in-up flex flex-col items-center">
            <IconAlertTriangle className="w-10 h-10 text-red-500 mb-2" />
            <h3 className="text-sm font-black text-red-700 uppercase mb-2">Lỗi truy vấn hệ thống</h3>
            <p className="text-[11px] text-red-600/70 mb-6">Firestore yêu cầu cấu hình Index để hiển thị tin đăng.</p>
            {queryError.includes('https://') && (
              <a href={queryError.split('here: ')[1]} target="_blank" className="bg-red-600 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-100 flex items-center gap-2" rel="noreferrer">
                  <IconExternalLink className="w-3 h-3" /> Cấu hình ngay
              </a>
            )}
          </div>
        )}

        {!queryError && (
          <div className="min-h-[400px]">
            {activeTab === 'listings' ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                  {listings.length > 0 ? listings.map(l => (
                    <ListingCard key={l.id} listing={l} />
                  )) : (
                    <div className="col-span-full py-32 text-center bg-white border border-gray-100 rounded-[3rem] shadow-soft flex flex-col items-center">
                      <IconPackageOpen className="w-16 h-16 text-gray-200 mb-4" strokeWidth={1} />
                      <p className="text-gray-400 font-black uppercase text-[10px] tracking-widest">Người bán hiện không có tin đăng nào</p>
                    </div>
                  )}
                </div>
                {hasMore && listings.length > 0 && (
                  <div className="pt-10 flex justify-center">
                    <button onClick={handleLoadMore} disabled={isFetchingMore} className="px-10 py-4 border-2 border-primary text-primary font-black rounded-2xl text-xs uppercase tracking-widest hover:bg-primary hover:text-white transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center gap-2">
                      {isFetchingMore ? <IconLoader2 className="w-4 h-4 animate-spin" /> : null}
                      {isFetchingMore ? 'Đang tải thêm...' : 'Tải thêm tin đăng'}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white border border-gray-100 rounded-[3rem] p-8 md:p-12 shadow-soft">
                <ReviewSection targetId={seller.id} targetType="user" currentUser={currentUser} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SellerProfile;
