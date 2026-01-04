import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate, useParams, Link } from 'react-router-dom';
import { CATEGORIES } from '../constants';
import { db } from '../services/db';
import { Listing, User, Category } from '../types';
import ListingCard from '../components/ListingCard';
import { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { getCategoryUrl } from '../utils/format';

// Danh sách các trang tĩnh cho Footer
const STATIC_LINKS = [
  { slug: 'gioi-thieu', title: 'Giới thiệu' },
  { slug: 'quy-che-hoat-dong', title: 'Quy chế hoạt động' },
  { slug: 'chinh-sach-bao-mat', title: 'Chính sách bảo mật' },
  { slug: 'meo-mua-ban-an-toan', title: 'Mẹo an toàn' },
  { slug: 'huong-dan-dang-tin', title: 'Hỗ trợ' },
];

const Home: React.FC<{ user: User | null }> = ({ user }) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const categoryRef = useRef<HTMLDivElement>(null);

  const search = searchParams.get('search') || '';

  // --- LOGIC: XÁC ĐỊNH DANH MỤC TỪ SEO URL ---
  const currentCategory = slug 
    ? CATEGORIES.find(c => c.slug === slug || c.slug === slug.split('-')[0]) 
    : null;
  const activeCategoryId = currentCategory ? currentCategory.id : '';

  // --- STATE ---
  const [vipListings, setVipListings] = useState<Listing[]>([]);
  const [nearbyListings, setNearbyListings] = useState<Listing[]>([]);
  const [latestListings, setLatestListings] = useState<Listing[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);

  // UI State
  const [isExpanded, setIsExpanded] = useState(false);
  const DISPLAY_COUNT = 7;

  // State Vị trí
  const [detectedLocation, setDetectedLocation] = useState<string | null>(user?.location || null);
  const [isLocating, setIsLocating] = useState(false);
  const [indexErrors, setIndexErrors] = useState<{msg: string, link: string | null}[]>([]);

  // GIỚI HẠN HIỂN THỊ (QUAN TRỌNG ĐỂ KHÔNG BỊ LAG KHI CÓ 1000 TIN)
  const LIMIT_VIP = 10;      // Chỉ tải 10 tin VIP để lướt ngang
  const LIMIT_NEARBY = 12;   // Chỉ tải 12 tin quanh đây (vừa đẹp lưới)
  const PAGE_SIZE = 12;      // Load more từng 12 tin một

  // --- HELPER FUNCTIONS ---
  const extractIndexLink = (error: string) => {
    const match = error.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
    return match ? match[0] : null;
  };

  // --- HANDLERS ---
  const handleDetectLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const city = latitude > 15 ? "TP Hà Nội" : "TPHCM"; 
        setDetectedLocation(city);
        setIsLocating(false);
        if (user) {
          db.updateUserProfile(user.id, { location: city, lat: latitude, lng: longitude }).catch(console.error);
        }
      },
      (error) => {
        setIsLocating(false);
        console.log("Location error:", error.message);
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  }, [user]);

  useEffect(() => {
    if (!detectedLocation) handleDetectLocation();
  }, [handleDetectLocation, detectedLocation]);

  const loadSpecialSections = useCallback(async (locationToUse: string | null) => {
    // 1. VIP: Chỉ lấy giới hạn (LIMIT_VIP) để hiển thị slider
    const vipRes = await db.getVIPListings(LIMIT_VIP);
    if (!vipRes.error) {
      setVipListings(vipRes.listings);
    }

    // 2. Nearby: Chỉ lấy giới hạn (LIMIT_NEARBY)
    const targetLoc = locationToUse || user?.location;
    if (targetLoc) {
      const nearbyRes = await db.getListingsPaged({
        pageSize: LIMIT_NEARBY,
        location: targetLoc
      });
      if (!nearbyRes.error) {
        setNearbyListings(nearbyRes.listings);
      }
    }
  }, [user]);

  const fetchInitialData = useCallback(async () => {
    setIsLoading(true);
    setLatestListings([]);
    setLastDoc(null);
    setHasMore(true);
    setIndexErrors([]);

    try {
      if (!search && !activeCategoryId) {
        await loadSpecialSections(detectedLocation);
      }

      // Main Feed: Load phân trang bình thường
      const result = await db.getListingsPaged({
        pageSize: PAGE_SIZE,
        categoryId: activeCategoryId || undefined,
        search: search || undefined
      });
      
      if (result.error) {
        const link = extractIndexLink(result.error);
        setIndexErrors(prev => {
          if (link && prev.some(e => e.link === link)) return prev;
          return [...prev, { msg: "Lỗi truy vấn dữ liệu", link }];
        });
      } else {
        setLatestListings(result.listings);
        setLastDoc(result.lastDoc);
        setHasMore(result.hasMore);
      }

      if (user) {
        const favs = await db.getFavorites(user.id);
        setFavorites(favs);
      }
    } catch (e) {
      console.error("Home fetch error:", e);
    } finally {
      setIsLoading(false);
    }
  }, [activeCategoryId, search, user, loadSpecialSections, detectedLocation]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryRef.current && !categoryRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLoadMore = async () => {
    if (isFetchingMore || !hasMore || !lastDoc) return;
    setIsFetchingMore(true);
    try {
      const result = await db.getListingsPaged({
        pageSize: PAGE_SIZE,
        lastDoc,
        categoryId: activeCategoryId || undefined,
        search: search || undefined
      });
      if (!result.error) {
        setLatestListings(prev => [...prev, ...result.listings]);
        setLastDoc(result.lastDoc);
        setHasMore(result.hasMore);
      }
    } finally {
      setIsFetchingMore(false);
    }
  };

  const selectCategory = (cat: Category | null) => {
    if (cat) navigate(getCategoryUrl(cat));
    else navigate('/');
    setIsExpanded(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleFav = async (id: string) => {
    if (!user) return navigate('/login');
    await db.toggleFavorite(user.id, id);
    const updatedFavs = await db.getFavorites(user.id);
    setFavorites(updatedFavs);
  };

  return (
    <div className="space-y-6 pb-24 px-2 md:px-4 max-w-[1400px] mx-auto">
      
      {/* 1. CATEGORY STRIP */}
      <div ref={categoryRef} className="sticky top-20 z-40 bg-bgMain/95 backdrop-blur-lg py-2 -mx-2 px-2 md:mx-0 md:px-0">
         {/* MOBILE */}
         <section className="flex md:hidden bg-white border border-borderMain p-2 overflow-x-auto no-scrollbar gap-2 shadow-sm rounded-2xl items-center">
            <button 
                onClick={() => selectCategory(null)}
                className={`px-4 py-2 rounded-full text-[11px] font-black uppercase transition-all flex-shrink-0 ${!activeCategoryId ? 'bg-primary text-white shadow-lg' : 'bg-gray-100 text-gray-500'}`}
            >
                Tất cả
            </button>
            {CATEGORIES.map(cat => (
                <button 
                key={cat.id} 
                onClick={() => selectCategory(cat)} 
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-black uppercase transition-all flex-shrink-0 ${activeCategoryId === cat.id ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-white border border-gray-100 text-gray-500'}`}
                >
                <span>{cat.icon}</span>
                <span>{cat.name}</span>
                </button>
            ))}
        </section>

        {/* DESKTOP */}
        <section className="hidden md:block">
            <div className={`bg-white border border-borderMain rounded-[2.5rem] p-3 shadow-soft transition-all duration-500 ease-in-out ${isExpanded ? 'ring-4 ring-primary/5' : ''}`}>
                {!isExpanded ? (
                    <div className="flex items-center justify-between gap-2">
                         <div className="flex items-center gap-2 overflow-hidden">
                            <button 
                                onClick={() => selectCategory(null)}
                                className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase transition-all flex-shrink-0 ${!activeCategoryId ? 'bg-primary text-white shadow-lg' : 'bg-gray-50 text-gray-400 hover:text-gray-600'}`}
                            >
                                🏠 Mặc định
                            </button>
                            {CATEGORIES.slice(0, DISPLAY_COUNT).map(cat => (
                                <button 
                                key={cat.id} 
                                onClick={() => selectCategory(cat)} 
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase transition-all border border-transparent flex-shrink-0 ${activeCategoryId === cat.id ? 'bg-primary/10 text-primary border-primary/20' : 'text-gray-500 hover:bg-gray-50 hover:text-primary'}`}
                                >
                                <span className="text-base">{cat.icon}</span>
                                <span>{cat.name}</span>
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-3 border-l border-gray-100 pl-3">
                             <button onClick={handleDetectLocation} disabled={isLocating} className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border transition-all text-[10px] font-black uppercase ${detectedLocation ? 'border-green-200 bg-green-50 text-green-600' : 'border-gray-100 text-gray-400 hover:border-primary/30 hover:text-primary'}`}>
                                {isLocating ? <div className="w-3 h-3 border-2 border-current border-t-transparent animate-spin rounded-full"></div> : '📍'}
                                <span>{detectedLocation || 'Định vị'}</span>
                            </button>
                            <button onClick={() => setIsExpanded(true)} className="flex items-center gap-2 px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase bg-gray-100 text-gray-600 hover:bg-primary hover:text-white transition-all shadow-sm flex-shrink-0 group">
                                <span>Xem tất cả</span>
                                <svg className="w-4 h-4 group-hover:rotate-180 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7"/></svg>
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="animate-fade-in-up">
                        <div className="flex items-center justify-between mb-8 px-6 pt-2">
                            <h3 className="text-sm font-black text-primary uppercase tracking-[0.2em]">Khám phá danh mục</h3>
                            <button onClick={() => setIsExpanded(false)} className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7"/></svg> Thu gọn
                            </button>
                        </div>
                        <div className="grid grid-cols-4 lg:grid-cols-7 gap-4 px-3 pb-4">
                            <button onClick={() => selectCategory(null)} className={`flex flex-col items-center justify-center gap-3 p-6 rounded-[2rem] transition-all border-2 ${!activeCategoryId ? 'bg-primary border-primary text-white shadow-xl shadow-primary/20' : 'bg-bgMain border-transparent hover:border-primary/30 text-gray-500 hover:text-primary'}`}>
                                <span className="text-3xl">🏠</span><span className="text-[10px] font-black uppercase text-center leading-tight">Mặc định</span>
                            </button>
                            {CATEGORIES.map(cat => (
                                <button key={cat.id} onClick={() => selectCategory(cat)} className={`flex flex-col items-center justify-center gap-3 p-6 rounded-[2rem] transition-all border-2 ${activeCategoryId === cat.id ? 'bg-primary border-primary text-white shadow-xl shadow-primary/20' : 'bg-bgMain border-transparent hover:border-primary/30 text-gray-500 hover:text-primary'}`}>
                                <span className="text-3xl">{cat.icon}</span><span className="text-[10px] font-black uppercase text-center leading-tight">{cat.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </section>
      </div>

      {/* 2. ADMIN ALERTS */}
      {indexErrors.length > 0 && (
        <section className="bg-red-50 border-2 border-dashed border-red-200 rounded-[2.5rem] p-10 text-center space-y-6">
           <div className="text-5xl animate-bounce">⚙️</div>
           <p className="text-xs text-red-600/70">Firebase cần Index. Click bên dưới:</p>
           <div className="flex flex-col gap-3 max-w-md mx-auto">
             {indexErrors.map((err, idx) => (
               <div key={idx} className="flex flex-col gap-2">
                 <p className="text-[9px] font-black text-red-400 uppercase text-left pl-2">{err.msg}</p>
                 {err.link && <a href={err.link} target="_blank" className="bg-red-600 text-white font-black px-6 py-4 rounded-2xl text-[10px] uppercase tracking-widest shadow-xl">Tạo chỉ số #{idx + 1}</a>}
               </div>
             ))}
           </div>
        </section>
      )}

      {/* 3. TIN PRO VIP (Có 1000 tin cũng chỉ hiện 10 tin rồi bấm Xem tất cả) */}
      {!search && !activeCategoryId && indexErrors.every(e => !e.msg.includes('VIP')) && vipListings.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
              <span className="text-yellow-400 text-xl">★</span> Tin đăng tài trợ
            </h2>
            {/* NÚT XEM TẤT CẢ */}
            <Link to="/search?type=vip" className="text-[10px] font-black text-primary uppercase hover:underline">Xem tất cả ({vipListings.length}+)</Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 md:gap-4">
            {vipListings.map(l => (
              <ListingCard key={l.id} listing={l} isFavorite={favorites.includes(l.id)} onToggleFavorite={toggleFav} />
            ))}
          </div>
        </section>
      )}

      {/* 4. TIN QUANH ĐÂY (Có 1000 tin cũng chỉ hiện 12 tin) */}
      {!search && !activeCategoryId && detectedLocation && nearbyListings.length > 0 && (
        <section className="space-y-4 animate-fade-in-up">
          <div className="flex items-center justify-between px-2">
             <div className="flex items-center gap-2">
               <h2 className="text-lg md:text-xl font-black text-gray-900 tracking-tight">Tin Quanh Đây</h2>
               <span className="text-[10px] font-black text-green-600 uppercase bg-green-50 px-2 py-1 rounded-md">{detectedLocation}</span>
             </div>
             <div className="flex gap-4 items-center">
                <button onClick={handleDetectLocation} className="text-[10px] font-black text-gray-400 uppercase underline hover:text-primary">Làm mới</button>
                {/* NÚT XEM TẤT CẢ */}
                <Link to={`/search?location=${detectedLocation}`} className="text-[10px] font-black text-primary uppercase hover:underline">Xem thêm ></Link>
             </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 md:gap-4">
            {nearbyListings.map(l => (
              <ListingCard key={l.id} listing={l} isFavorite={favorites.includes(l.id)} onToggleFavorite={toggleFav} />
            ))}
          </div>
        </section>
      )}

      {/* 5. TIN MỚI NHẤT (Main Feed - Cái này thì Load more vô tư) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-2">
           <h2 className="text-lg md:text-xl font-black text-gray-900 tracking-tight">
             {search ? `Kết quả: "${search}"` : currentCategory ? `Danh mục: ${currentCategory.name}` : 'Tin mới đăng'}
           </h2>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 md:gap-4 px-1">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg p-2 space-y-3 animate-pulse">
                <div className="aspect-square bg-gray-100 rounded-lg"></div>
                <div className="h-4 bg-gray-100 rounded-full w-3/4"></div>
              </div>
            ))}
          </div>
        ) : latestListings.length === 0 ? (
          <div className="py-24 text-center bg-white border border-borderMain rounded-[3rem] shadow-soft">
             <div className="text-6xl mb-4 grayscale opacity-20">🌵</div>
             <p className="text-gray-400 font-black uppercase text-[10px] tracking-widest">Không có tin đăng nào</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 md:gap-4 px-1 md:px-0">
              {latestListings.map(l => (
                <ListingCard key={l.id} listing={l} isFavorite={favorites.includes(l.id)} onToggleFavorite={toggleFav} />
              ))}
            </div>
            {hasMore && (
              <div className="pt-8 flex justify-center">
                <button onClick={handleLoadMore} disabled={isFetchingMore} className="px-10 py-3 bg-white border-2 border-primary text-primary font-black rounded-full text-[11px] uppercase tracking-widest hover:bg-primary hover:text-white transition-all shadow-md active:scale-95">
                  {isFetchingMore ? 'Đang tải...' : 'Xem thêm tin đăng'}
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* 6. FOOTER */}
      <footer className="hidden md:block pt-16 border-t border-dashed border-gray-200 mt-20">
         <div className="bg-white border border-borderMain rounded-[3rem] p-10 shadow-soft">
            <div className="flex items-center justify-between mb-8">
               <h4 className="text-xl font-black text-textMain flex items-center gap-2"><span className="text-2xl">⚡</span> Chợ Của Tui</h4>
               <div className="flex gap-4">
                  {STATIC_LINKS.map(link => <Link key={link.slug} to={`/page/${link.slug}`} className="text-xs font-bold text-gray-400 hover:text-primary transition-colors uppercase">{link.title}</Link>))}
               </div>
            </div>
            <div className="text-[10px] text-gray-400 font-medium text-center border-t border-gray-100 pt-8">© 2024 ChoCuaTui.vn - Nền tảng rao vặt ứng dụng AI. All rights reserved.</div>
         </div>
      </footer>
    </div>
  );
};

export default Home;
