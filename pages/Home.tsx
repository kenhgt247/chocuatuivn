import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate, useParams } from 'react-router-dom';
import { CATEGORIES } from '../constants';
import { db } from '../services/db';
import { Listing, User, Category } from '../types';
import ListingCard from '../components/ListingCard';
import { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { getCategoryUrl } from '../utils/format'; // Cần hàm này từ file format.ts đã sửa ở bước trước

const Home: React.FC<{ user: User | null }> = ({ user }) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>(); // Lấy slug từ URL chuẩn SEO
  const categoryRef = useRef<HTMLDivElement>(null);

  const search = searchParams.get('search') || '';

  // --- LOGIC XÁC ĐỊNH DANH MỤC TỪ SLUG ---
  // Tìm danh mục khớp với slug trên URL
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

  // State giao diện Menu mở rộng
  const [isExpanded, setIsExpanded] = useState(false);
  const DISPLAY_COUNT = 7;

  // State Vị trí & Lỗi Index
  const [detectedLocation, setDetectedLocation] = useState<string | null>(user?.location || null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [indexErrors, setIndexErrors] = useState<{msg: string, link: string | null}[]>([]);

  const PAGE_SIZE = 12;

  // --- HELPER FUNCTIONS ---
  const extractIndexLink = (error: string) => {
    const match = error.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
    return match ? match[0] : null;
  };

  // --- HANDLERS ---
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Trình duyệt không hỗ trợ định vị.");
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        // Logic giả lập: > 15 vĩ độ là Miền Bắc
        const city = latitude > 15 ? "TP Hà Nội" : "TPHCM";
        setDetectedLocation(city);
        setIsLocating(false);
        
        if (user) {
          db.updateUserProfile(user.id, { 
            location: city, 
            lat: latitude, 
            lng: longitude 
          }).catch(console.error);
        }
      },
      (error) => {
        setIsLocating(false);
        if (error.code === error.PERMISSION_DENIED) {
          setLocationError("Bạn đã chặn quyền truy cập vị trí.");
        } else {
          setLocationError("Lỗi định vị.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const loadSpecialSections = useCallback(async (locationToUse: string | null) => {
    // 1. Load Tin PRO VIP
    const vipRes = await db.getVIPListings(8);
    if (vipRes.error) {
      const link = extractIndexLink(vipRes.error);
      setIndexErrors(prev => {
        if (link && prev.some(e => e.link === link)) return prev;
        return [...prev, { msg: "Lỗi truy vấn Tin VIP", link }];
      });
    } else {
      setVipListings(vipRes.listings);
    }

    // 2. Load Tin Quanh Đây
    const targetLoc = locationToUse || user?.location;
    if (targetLoc) {
      const nearbyRes = await db.getListingsPaged({
        pageSize: 6,
        location: targetLoc
      });
      if (nearbyRes.error) {
        const link = extractIndexLink(nearbyRes.error);
        setIndexErrors(prev => {
          if (link && prev.some(e => e.link === link)) return prev;
          return [...prev, { msg: `Lỗi truy vấn Tin Quanh Đây (${targetLoc})`, link }];
        });
      } else {
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
      // Chỉ load VIP và Nearby khi ở trang chủ (không search, không danh mục)
      if (!search && !activeCategoryId) {
        await loadSpecialSections(detectedLocation);
      }

      const result = await db.getListingsPaged({
        pageSize: PAGE_SIZE,
        categoryId: activeCategoryId || undefined,
        search: search || undefined
      });
      
      if (result.error) {
        const link = extractIndexLink(result.error);
        setIndexErrors(prev => {
          if (link && prev.some(e => e.link === link)) return prev;
          return [...prev, { msg: "Lỗi truy vấn Tin Mới Nhất", link }];
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
      console.error("Home initial fetch error:", e);
    } finally {
      setIsLoading(false);
    }
  }, [activeCategoryId, search, user, loadSpecialSections, detectedLocation]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Click Outside để thu gọn menu
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

      if (result.error) {
        const link = extractIndexLink(result.error);
        if (link) setIndexErrors(prev => [...prev, { msg: "Lỗi phân trang", link }]);
      } else {
        setLatestListings(prev => [...prev, ...result.listings]);
        setLastDoc(result.lastDoc);
        setHasMore(result.hasMore);
      }
    } catch (e) {
      console.error("Load more error:", e);
    } finally {
      setIsFetchingMore(false);
    }
  };

  // CHỌN DANH MỤC: Đã sửa để dùng URL chuẩn SEO
  const selectCategory = (cat: Category | null) => {
    if (cat) {
        navigate(getCategoryUrl(cat));
    } else {
        navigate('/');
    }
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
    <div className="space-y-8 pb-24 px-4 md:px-0 max-w-[1400px] mx-auto">
      
      {/* 1. CATEGORY & LOCATION SECTION (Giao diện 7+1 thông minh) */}
      <div ref={categoryRef} className="sticky top-20 z-40 bg-bgMain/95 backdrop-blur-lg py-2 -mx-4 px-4 md:mx-0 md:px-0">
         {/* --- MOBILE VIEW: Scroll ngang --- */}
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
             {/* Nút định vị Mobile */}
             <div className="w-[1px] h-6 bg-gray-200 mx-1 flex-shrink-0"></div>
             <button onClick={handleDetectLocation} disabled={isLocating} className="flex-shrink-0 text-xl p-2 bg-gray-50 rounded-full text-primary">
                {isLocating ? <div className="w-4 h-4 border-2 border-primary border-t-transparent animate-spin rounded-full"></div> : '📍'}
             </button>
        </section>

        {/* --- DESKTOP VIEW: 7+1 Grid --- */}
        <section className="hidden md:block">
            <div className={`bg-white border border-borderMain rounded-[2.5rem] p-3 shadow-soft transition-all duration-500 ease-in-out ${isExpanded ? 'ring-4 ring-primary/5' : ''}`}>
                {!isExpanded ? (
                    // Giao diện thu gọn
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
                            {/* Nút Định Vị Desktop */}
                             <button 
                                onClick={handleDetectLocation}
                                disabled={isLocating}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border transition-all text-[10px] font-black uppercase ${detectedLocation ? 'border-green-200 bg-green-50 text-green-600' : 'border-gray-100 text-gray-400 hover:border-primary/30 hover:text-primary'}`}
                            >
                                {isLocating ? <div className="w-3 h-3 border-2 border-current border-t-transparent animate-spin rounded-full"></div> : '📍'}
                                <span>{detectedLocation || 'Định vị'}</span>
                            </button>

                            <button 
                                onClick={() => setIsExpanded(true)}
                                className="flex items-center gap-2 px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase bg-gray-100 text-gray-600 hover:bg-primary hover:text-white transition-all shadow-sm flex-shrink-0 group"
                            >
                                <span>Xem tất cả</span>
                                <svg className="w-4 h-4 group-hover:rotate-180 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7"/></svg>
                            </button>
                        </div>
                    </div>
                ) : (
                    // Giao diện mở rộng
                    <div className="animate-fade-in-up">
                        <div className="flex items-center justify-between mb-8 px-6 pt-2">
                            <div className="flex flex-col">
                                <h3 className="text-sm font-black text-primary uppercase tracking-[0.2em]">Khám phá danh mục</h3>
                                <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">Lọc sản phẩm theo nhu cầu của bạn</p>
                            </div>
                            <button 
                                onClick={() => setIsExpanded(false)}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7"/></svg>
                                Thu gọn
                            </button>
                        </div>
                        <div className="grid grid-cols-4 lg:grid-cols-7 gap-4 px-3 pb-4">
                            <button 
                                onClick={() => selectCategory(null)}
                                className={`flex flex-col items-center justify-center gap-3 p-6 rounded-[2rem] transition-all border-2 ${!activeCategoryId ? 'bg-primary border-primary text-white shadow-xl shadow-primary/20' : 'bg-bgMain border-transparent hover:border-primary/30 text-gray-500 hover:text-primary'}`}
                            >
                                <span className="text-3xl">🏠</span>
                                <span className="text-[10px] font-black uppercase text-center leading-tight">Mặc định</span>
                            </button>
                            {CATEGORIES.map(cat => (
                                <button 
                                key={cat.id} 
                                onClick={() => selectCategory(cat)} 
                                className={`flex flex-col items-center justify-center gap-3 p-6 rounded-[2rem] transition-all border-2 ${activeCategoryId === cat.id ? 'bg-primary border-primary text-white shadow-xl shadow-primary/20' : 'bg-bgMain border-transparent hover:border-primary/30 text-gray-500 hover:text-primary'}`}
                                >
                                <span className="text-3xl">{cat.icon}</span>
                                <span className="text-[10px] font-black uppercase text-center leading-tight">{cat.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </section>
      </div>

      {/* 2. ADMIN SETUP WIZARD (Chỉ hiện khi có lỗi Index) */}
      {indexErrors.length > 0 && (
        <section className="bg-red-50 border-2 border-dashed border-red-200 rounded-[2.5rem] p-10 text-center space-y-6 animate-fade-in-up">
           <div className="text-5xl animate-bounce">⚙️</div>
           <div className="space-y-2">
             <h3 className="text-lg font-black text-red-700 uppercase">Cấu hình Cơ sở dữ liệu Triệu Tin</h3>
             <p className="text-xs text-red-600/70 max-w-lg mx-auto leading-relaxed">
               Firebase cần các "Chỉ số tổng hợp" để chạy các tính năng nâng cao. 
               Vui lòng click vào từng link bên dưới:
             </p>
           </div>
           
           <div className="flex flex-col gap-3 max-w-md mx-auto">
             {indexErrors.map((err, idx) => (
               <div key={idx} className="flex flex-col gap-2">
                 <p className="text-[9px] font-black text-red-400 uppercase text-left pl-2">{err.msg}</p>
                 {err.link ? (
                   <a 
                     href={err.link} 
                     target="_blank" 
                     className="flex items-center justify-between bg-red-600 text-white font-black px-6 py-4 rounded-2xl text-[10px] uppercase tracking-widest shadow-xl shadow-red-100 hover:bg-red-700 active:scale-95 transition-all"
                   >
                     <span>Tạo chỉ số #{idx + 1}</span>
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                   </a>
                 ) : (
                   <div className="bg-orange-100 text-orange-600 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-orange-200 italic">
                     🏗️ Đang trong quá trình xây dựng...
                   </div>
                 )}
               </div>
             ))}
           </div>
        </section>
      )}

      {/* 3. TIN PRO VIP (Slider) - Ẩn khi đang lọc danh mục hoặc tìm kiếm */}
      {!search && !activeCategoryId && indexErrors.every(e => !e.msg.includes('VIP')) && vipListings.length > 0 && (
        <section className="space-y-6 animate-fade-in-up">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xl md:text-2xl font-black text-textMain tracking-tight flex items-center gap-3">
              <span className="w-10 h-10 bg-gradient-to-tr from-yellow-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg text-white">★</span>
              ⚡ Tin PRO VIP
            </h2>
          </div>
          <div className="flex gap-6 overflow-x-auto no-scrollbar pb-6 px-2">
            {vipListings.map(l => (
              <div key={l.id} className="w-[200px] md:w-[240px] flex-shrink-0">
                <ListingCard listing={l} isFavorite={favorites.includes(l.id)} onToggleFavorite={toggleFav} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4. TIN QUANH ĐÂY (Location Based) - Ẩn khi đang lọc danh mục */}
      {!search && !activeCategoryId && indexErrors.every(e => !e.msg.includes('Quanh Đây')) && (
        <section className="space-y-6 animate-fade-in-up">
          <div className="flex items-center justify-between px-2">
            <div className="space-y-1">
              <h2 className="text-xl md:text-2xl font-black text-textMain tracking-tight flex items-center gap-3">
                <span className="w-10 h-10 bg-green-500 rounded-2xl flex items-center justify-center shadow-lg text-white">📍</span>
                Tin Quanh Đây
              </h2>
              {detectedLocation && (
                <p className="text-[10px] font-black text-green-600 uppercase tracking-widest flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  Vị trí hiện tại: {detectedLocation}
                </p>
              )}
            </div>

            {/* Trigger định vị */}
            {!detectedLocation ? (
              <button 
                onClick={handleDetectLocation} 
                className="flex items-center gap-2 bg-primary text-white text-[9px] font-black uppercase tracking-widest px-6 py-2.5 rounded-xl shadow-lg shadow-primary/10 animate-pulse active:scale-95 transition-all"
              >
                {isLocating ? 'Đang xác định...' : 'Bật định vị ngay'}
              </button>
            ) : (
              <button onClick={handleDetectLocation} className="text-[10px] font-black text-gray-400 uppercase underline bg-gray-50 px-4 py-2 rounded-xl hover:text-primary transition-colors">Làm mới</button>
            )}
          </div>

          {detectedLocation ? (
            nearbyListings.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                {nearbyListings.map(l => (
                  <ListingCard key={l.id} listing={l} isFavorite={favorites.includes(l.id)} onToggleFavorite={toggleFav} />
                ))}
              </div>
            ) : (
              <div className="bg-white border border-borderMain rounded-[2rem] p-12 text-center text-gray-400 italic text-xs">
                Hiện chưa có tin đăng nào tại {detectedLocation}.
              </div>
            )
          ) : (
            <div className="bg-white border-2 border-dashed border-borderMain rounded-[2.5rem] p-12 text-center space-y-4">
               <div className="text-4xl opacity-20">🧭</div>
               <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cho phép truy cập vị trí để xem hàng ngàn tin đăng sát vách nhà bạn</p>
               <button onClick={handleDetectLocation} className="text-[10px] font-black text-primary border-2 border-primary/20 px-8 py-3 rounded-2xl hover:bg-primary hover:text-white transition-all uppercase tracking-widest">Kích hoạt ngay</button>
            </div>
          )}
          {locationError && <p className="text-center text-red-500 text-[9px] font-bold">{locationError}</p>}
        </section>
      )}

      {/* 5. TIN MỚI NHẤT (Main Feed) */}
      <section className="space-y-8">
        <div className="flex items-center justify-between px-2">
           <h2 className="text-xl md:text-2xl font-black text-textMain tracking-tight flex items-center gap-3">
             <span className="w-2 h-8 bg-primary rounded-full shadow-lg"></span>
             {search ? `Kết quả: "${search}"` : currentCategory ? `Danh mục: ${currentCategory.name}` : '🆕 Tin mới đăng'}
           </h2>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="bg-white border border-borderMain rounded-[1.75rem] p-4 space-y-4 animate-pulse">
                <div className="aspect-square bg-gray-100 rounded-2xl"></div>
                <div className="h-3 bg-gray-100 rounded-full w-3/4"></div>
                <div className="h-5 bg-gray-200 rounded-full w-1/2"></div>
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
              {latestListings.map(l => (
                <ListingCard key={l.id} listing={l} isFavorite={favorites.includes(l.id)} onToggleFavorite={toggleFav} />
              ))}
            </div>

            {hasMore && (
              <div className="pt-10 flex justify-center">
                <button 
                  onClick={handleLoadMore}
                  disabled={isFetchingMore}
                  className="px-12 py-5 bg-white border-2 border-primary text-primary font-black rounded-2xl text-[11px] uppercase tracking-[0.2em] hover:bg-primary hover:text-white transition-all shadow-xl shadow-primary/5 flex items-center gap-3"
                >
                  {isFetchingMore ? (
                    <>
                      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                      Đang tải...
                    </>
                  ) : (
                    'Xem thêm tin đăng'
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
};

export default Home;
