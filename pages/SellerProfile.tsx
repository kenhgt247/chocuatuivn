import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { db } from '../services/db';
import { User, Listing, Review } from '../types';
import ListingCard from '../components/ListingCard';
import { formatTimeAgo } from '../utils/format';
import ReviewSection from '../components/ReviewSection';
import { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';

const SellerProfile: React.FC<{ currentUser: User | null }> = ({ currentUser }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // State cơ bản
  const [seller, setSeller] = useState<User | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [activeTab, setActiveTab] = useState<'listings' | 'reviews'>('listings');
  
  // State Follow
  const [isFollowing, setIsFollowing] = useState(false);
  const [followStats, setFollowStats] = useState({ followers: 0, following: 0 });
  
  // State Loading & Error
  const [loading, setLoading] = useState(true);
  const [queryError, setQueryError] = useState<string | null>(null);
  
  // Pagination States
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const PAGE_SIZE = 10;

  const loadInitialData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setListings([]);
    setLastDoc(null);
    setHasMore(true);
    setQueryError(null);

    try {
      // 1. Lấy thông tin người bán
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
        if (currentUser) {
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
  }, [id, currentUser]);

  useEffect(() => {
    loadInitialData();
    window.scrollTo(0, 0);
  }, [loadInitialData]);

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
    return (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1);
  }, [reviews]);

  // --- LOGIC FOLLOW ---
  const handleToggleFollow = async () => {
    if (!currentUser) return navigate('/login');
    if (currentUser.id === id) return;
    
    // Optimistic Update
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
      // Revert lại nếu lỗi
      setIsFollowing(prevStatus);
      setFollowStats(prev => ({ ...prev, followers: prevCount }));
      alert("Có lỗi xảy ra, vui lòng thử lại.");
    }
  };

  if (loading) return (
    <div className="py-32 flex flex-col items-center gap-6">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      <p className="text-gray-400 font-black uppercase text-[10px] tracking-widest animate-pulse">Đang nạp hồ sơ người bán...</p>
    </div>
  );

  if (!seller) return (
    <div className="py-32 text-center">
      <div className="text-6xl mb-4 grayscale">👤</div>
      <h2 className="text-xl font-black">Người dùng không tồn tại</h2>
      <Link to="/" className="text-primary font-bold hover:underline">Về trang chủ</Link>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-24 px-4 md:px-0">
      {/* Header Profile Section */}
      <div className="bg-white border border-borderMain rounded-[3rem] p-6 md:p-12 shadow-soft overflow-hidden relative">
        <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 rounded-full -mr-40 -mt-40 blur-3xl"></div>
        <div className="flex flex-col md:flex-row gap-10 items-center md:items-start relative z-10">
          
          {/* Avatar Section */}
          <div className="relative">
            <img src={seller.avatar} alt={seller.name} className="w-32 h-32 md:w-44 md:h-44 rounded-[3rem] border-4 border-white shadow-2xl object-cover" />
            <div className="absolute -bottom-2 right-4 bg-green-500 text-white px-3 py-1 rounded-xl border-4 border-white shadow-lg flex items-center gap-1.5">
               <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
               <span className="text-[8px] font-black uppercase">Online</span>
            </div>
          </div>

          {/* Info Section */}
          <div className="flex-1 space-y-6 text-center md:text-left w-full">
            <div className="space-y-2">
              
              {/* TÊN + TÍCH XANH */}
              <div className="flex items-center justify-center md:justify-start gap-3">
                  <h1 className="text-3xl md:text-5xl font-black text-textMain tracking-tighter">{seller.name}</h1>
                  {seller.verificationStatus === 'verified' && (
                      <div className="bg-blue-500 text-white p-1 md:p-1.5 rounded-full shadow-lg shadow-blue-200" title="Tài khoản đã xác thực">
                          <svg className="w-3 h-3 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
                      </div>
                  )}
              </div>
              
              <div className="flex flex-col md:flex-row items-center justify-center md:justify-start gap-2">
                  <p className="text-[11px] text-gray-400 font-bold uppercase tracking-[0.2em]">Tham gia: {formatTimeAgo(seller.joinedAt)}</p>
                  
                  {/* BADGE UY TÍN */}
                  {seller.verificationStatus === 'verified' && (
                      <>
                        <span className="hidden md:inline text-gray-300">•</span>
                        <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-wider">Đã xác thực danh tính (KYC)</span>
                      </>
                  )}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-6 border-y border-gray-100">
               <div><p className="text-2xl font-black text-textMain">{avgRating} <span className="text-yellow-400 text-lg">★</span></p><p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Đánh giá TB</p></div>
               <div className="border-x border-gray-100 px-4"><p className="text-2xl font-black text-textMain">{listings.length}</p><p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Tin đang bán</p></div>
               
               <div className="border-r border-gray-100 pr-4">
                 <p className="text-2xl font-black text-textMain">{followStats.followers}</p>
                 <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Theo dõi</p>
               </div>
               
               <div><p className="text-2xl font-black text-green-600">99%</p><p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Phản hồi</p></div>
            </div>

            <div className="flex flex-wrap gap-4 pt-2">
              <button 
                onClick={handleToggleFollow} 
                className={`flex-1 md:flex-none min-w-[160px] px-8 py-4 rounded-2xl font-black text-xs transition-all uppercase tracking-widest ${isFollowing ? 'bg-gray-100 text-gray-400' : 'bg-primary text-white shadow-xl shadow-primary/20 hover:scale-105 active:scale-95'}`}
              >
                {isFollowing ? 'Đang theo dõi ✓' : '+ Theo dõi'}
              </button>
              <button onClick={() => navigate('/chat')} className="flex-1 md:flex-none min-w-[160px] px-8 py-4 bg-white border-2 border-primary text-primary rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-primary/5 transition-all active:scale-95">Nhắn tin</button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs and Content Section */}
      <div className="space-y-8">
        <div className="flex gap-4 p-2 bg-gray-200/50 rounded-3xl w-full max-w-md mx-auto md:mx-0">
          <button onClick={() => setActiveTab('listings')} className={`flex-1 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'listings' ? 'bg-white text-primary shadow-lg' : 'text-gray-500'}`}>Tin rao ({listings.length})</button>
          <button onClick={() => setActiveTab('reviews')} className={`flex-1 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'reviews' ? 'bg-white text-primary shadow-lg' : 'text-gray-500'}`}>Đánh giá ({reviews.length})</button>
        </div>

        {queryError && (
          <div className="bg-red-50 border-2 border-dashed border-red-200 rounded-[2.5rem] p-10 text-center animate-fade-in-up">
            <h3 className="text-sm font-black text-red-700 uppercase mb-2">Lỗi truy vấn hệ thống</h3>
            <p className="text-[11px] text-red-600/70 mb-6">Firestore yêu cầu tạo Chỉ số tổng hợp để hiển thị tin đăng của người bán này.</p>
            {queryError.includes('https://') && (
              <a href={queryError.split('here: ')[1]} target="_blank" className="bg-red-600 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-100" rel="noreferrer">Cấu hình ngay</a>
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
                    <div className="col-span-full py-32 text-center bg-white border border-borderMain rounded-[3rem] shadow-soft">
                      <div className="text-6xl mb-4 grayscale">📭</div>
                      <p className="text-gray-400 font-black uppercase text-[10px] tracking-widest">Người bán hiện không có tin đăng nào</p>
                    </div>
                  )}
                </div>
                {hasMore && listings.length > 0 && (
                  <div className="pt-10 flex justify-center">
                    <button onClick={handleLoadMore} disabled={isFetchingMore} className="px-10 py-4 border-2 border-primary text-primary font-black rounded-2xl text-xs uppercase tracking-widest hover:bg-primary hover:text-white transition-all shadow-lg active:scale-95 disabled:opacity-50">
                      {isFetchingMore ? 'Đang tải thêm...' : 'Tải thêm tin đăng'}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white border border-borderMain rounded-[3rem] p-8 md:p-12 shadow-soft">
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