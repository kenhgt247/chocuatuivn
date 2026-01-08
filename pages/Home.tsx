import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate, useParams, Link, useLocation } from 'react-router-dom';
import { CATEGORIES } from '../constants';
import { db } from '../services/db';
import { Listing, User, Category } from '../types';
import ListingCard from '../components/ListingCard';
import { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { getCategoryUrl } from '../utils/format';
import { getLocationFromCoords } from '../utils/locationHelper'; 

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

  // Lấy các tham số từ URL
  const search = searchParams.get('search') || '';
  const typeParam = searchParams.get('type'); // ví dụ: ?type=vip
  const locationParam = searchParams.get('location'); // ví dụ: ?location=Hà Nội

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

  const LIMIT_VIP = 10;
  const LIMIT_NEARBY = 12;
  const PAGE_SIZE = 12;

  const extractIndexLink = (error: string) => {
    const match = error.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
    return match ? match[0] : null;
  };

  const loadSpecialSections = useCallback(async (locationToUse: string | null) => {
    const vipRes = await db.getVIPListings(LIMIT_VIP);
    if (!vipRes.error) {
      setVipListings(vipRes.listings);
    }

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

  const handleDetectLocation = useCallback(() => {
    if (!navigator.geolocation) {
        alert("Trình duyệt của bạn không hỗ trợ định vị.");
        return;
    }

    setIsLocating(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        try {
            const locationInfo = await getLocationFromCoords(latitude, longitude);
            
            setDetectedLocation(locationInfo.city);
            setIsLocating(false);

            if (user) {
              db.updateUserProfile(user.id, { 
                  location: locationInfo.city, 
                  address: locationInfo.address, 
                  lat: latitude, 
                  lng: longitude 
              }).catch(console.error);
            }

            // Load lại section nearby nếu đang ở trang chủ thuần túy
            if (!search && !activeCategoryId && !typeParam && !locationParam) {
                loadSpecialSections(locationInfo.city);
            }

        } catch (err) {
            console.error("Lỗi lấy địa chỉ:", err);
            setIsLocating(false);
            const fallbackCity = latitude > 16 ? "TP Hà Nội" : "TPHCM";
            setDetectedLocation(fallbackCity);
        }
      },
      (error) => {
        setIsLocating(false);
        let msg = "Lỗi định vị.";
        if (error.code === 1) msg = "Vui lòng cho phép truy cập vị trí trong cài đặt trình duyệt.";
        alert(msg);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [user, loadSpecialSections, search, activeCategoryId, typeParam, locationParam]);

  useEffect(() => {
    if (!detectedLocation && !user?.location) {
       // logic tự động định vị nếu cần
    } else if (user?.location) {
        setDetectedLocation(user.location);
    }
  }, [user, detectedLocation]);

  const fetchInitialData = useCallback(async () => {
    setIsLoading(true);
    setLatestListings([]);
    setLastDoc(null);
    setHasMore(true);
    setIndexErrors([]);

    try {
      // Chỉ load section VIP/Nearby nếu đang ở trang chủ thuần túy (không search/filter)
      if (!search && !activeCategoryId && !typeParam && !locationParam) {
        await loadSpecialSections(detectedLocation);
      }

      const result = await db.getListingsPaged({
        pageSize: PAGE_SIZE,
        categoryId: activeCategoryId || undefined,
        search: search || undefined,
        location: locationParam || undefined, // Truyền tham số lọc địa điểm
        isVip: typeParam === 'vip' // Truyền tham số lọc VIP
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
  }, [activeCategoryId, search, typeParam, locationParam, user, loadSpecialSections, detectedLocation]);

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
    if (isFetchingMore || !hasMore || (search && !lastDoc)) return;
    
    setIsFetchingMore(true);
    try {
      const result = await db.getListingsPaged({
        pageSize: PAGE_SIZE,
        lastDoc,
        categoryId: activeCategoryId || undefined,
        search: search || undefined,
        location: locationParam || undefined,
        isVip: typeParam === 'vip'
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

  const handlePushListing = async (listingId: string) => {
    if (!user) {
        if(window.confirm("Bạn cần đăng nhập để thực hiện chức năng này.")) {
            navigate('/login');
        }
        return;
    }

    if (!window.confirm("Bạn có chắc muốn đẩy tin này lên đầu? Phí sẽ được trừ vào ví.")) {
        return;
    }

    try {
        setIsLoading(true);
        const result = await db.pushListing(listingId, user.id);
        
        if (result.success) {
            alert("Đẩy tin thành công! Tin của bạn đã lên đầu trang chủ.");
            fetchInitialData();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            alert("Lỗi: " + result.message);
            if (result.message && result.message.includes("không đủ tiền")) {
                 navigate('/wallet');
            }
        }
    } catch (error) {
        console.error("Lỗi khi đẩy tin:", error);
        alert("Có lỗi xảy ra, vui lòng thử lại sau.");
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-28 md:pb-24 px-2 md:px-4 max-w-[1400px] mx-auto relative">
      
      {/* 1. CATEGORY STRIP */}
      <div ref={categoryRef} className="sticky top-20 z-40 bg-bgMain/95 backdrop-blur-lg py-2 -mx-2 px-2 md:mx-0 md:px-0">
         {/* MOBILE */}
         <section className="flex md:hidden bg-white border border-borderMain p-2 overflow-x-auto no-scrollbar gap-2 shadow-sm rounded-2xl items-center">
            <button 
                onClick={() => selectCategory(null)}
                className={`px-4 py-2 rounded-full text-[11px] font-black uppercase transition-all flex-shrink-0 ${!activeCategoryId ? 'bg-primary text-white shadow-lg' : 'bg-gray-100 text-gray-500'}`}
            >
                Khám phá
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
                                ⚡ Khám Phá
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
                                <span>{detectedLocation || 'Quanh đây'}</span>
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
                                <span className="text-3xl">⚡</span><span className="text-[10px] font-black uppercase text-center leading-tight">Chợ Của Tui</span>
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

      {/* 3. TIN PRO VIP - Chỉ hiện khi không lọc gì */}
      {!search && !activeCategoryId && !typeParam && !locationParam && indexErrors.every(e => !e.msg.includes('VIP')) && vipListings.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
              <span className="text-yellow-400 text-xl">★</span> Tin đăng tài trợ
            </h2>
            {/* CẬP NHẬT LINK CHÍNH XÁC */}
            <Link to="/?type=vip" className="text-[10px] font-black text-primary uppercase hover:underline">Xem tất cả</Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 md:gap-4">
            {vipListings.map(l => (
              <ListingCard 
                key={l.id} 
                listing={l} 
                isFavorite={favorites.includes(l.id)} 
                onToggleFavorite={toggleFav} 
                onPushListing={user && user.id === l.sellerId ? handlePushListing : undefined}
              />
            ))}
          </div>
        </section>
      )}

      {/* 4. TIN QUANH ĐÂY - Chỉ hiện khi không lọc gì */}
      {!search && !activeCategoryId && !typeParam && !locationParam && detectedLocation && nearbyListings.length > 0 && (
        <section className="space-y-4 animate-fade-in-up">
          <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <h2 className="text-lg md:text-xl font-black text-gray-900 tracking-tight">Tin Quanh Đây</h2>
                <span className="text-[10px] font-black text-green-600 uppercase bg-green-50 px-2 py-1 rounded-md">{detectedLocation}</span>
              </div>
              <div className="flex gap-4 items-center">
                 <button onClick={handleDetectLocation} className="text-[10px] font-black text-gray-400 uppercase underline hover:text-primary">Làm mới</button>
                 {/* CẬP NHẬT LINK CHÍNH XÁC */}
                 <Link to={`/?location=${encodeURIComponent(detectedLocation)}`} className="text-[10px] font-black text-primary uppercase hover:underline">Xem thêm &gt;</Link>
              </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 md:gap-4">
            {nearbyListings.map(l => (
              <ListingCard 
                key={l.id} 
                listing={l} 
                isFavorite={favorites.includes(l.id)} 
                onToggleFavorite={toggleFav} 
                onPushListing={user && user.id === l.sellerId ? handlePushListing : undefined}
              />
            ))}
          </div>
        </section>
      )}

      {/* 5. TIN MỚI NHẤT (HOẶC KẾT QUẢ TÌM KIẾM/FILTER) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-2">
           <h2 className="text-lg md:text-xl font-black text-gray-900 tracking-tight">
             {search ? `Kết quả: "${search}"` 
              : typeParam === 'vip' ? 'Tất cả tin Tài Trợ (VIP)'
              : locationParam ? `Tin đăng tại ${locationParam}`
              : currentCategory ? `Danh mục: ${currentCategory.name}` 
              : 'Tin mới đăng'}
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
                <ListingCard 
                    key={l.id} 
                    listing={l} 
                    isFavorite={favorites.includes(l.id)} 
                    onToggleFavorite={toggleFav} 
                    onPushListing={user && user.id === l.sellerId ? handlePushListing : undefined}
                />
              ))}
            </div>
            {hasMore && !search && (
              <div className="pt-8 flex justify-center">
                <button onClick={handleLoadMore} disabled={isFetchingMore} className="px-10 py-3 bg-white border-2 border-primary text-primary font-black rounded-full text-[11px] uppercase tracking-widest hover:bg-primary hover:text-white transition-all shadow-md active:scale-95">
                  {isFetchingMore ? 'Đang tải...' : 'Xem thêm tin đăng'}
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* 6. FOOTER DESKTOP */}
      <footer className="hidden md:block pt-16 border-t border-dashed border-gray-200 mt-20">
         <div className="bg-white border border-borderMain rounded-[3rem] p-10 shadow-soft">
            <div className="flex items-center justify-between mb-8">
               <h4 className="text-xl font-black text-textMain flex items-center gap-2"><span className="text-2xl">⚡</span> Chợ Của Tui</h4>
               <div className="flex gap-4">
                  {STATIC_LINKS.map(link => <Link key={link.slug} to={`/page/${link.slug}`} className="text-xs font-bold text-gray-400 hover:text-primary transition-colors uppercase">{link.title}</Link>)}
               </div>
            </div>
            <div className="text-[10px] text-gray-400 font-medium text-center border-t border-gray-100 pt-8">© 2024 ChoCuaTui.vn - Nền tảng rao vặt ứng dụng AI. All rights reserved.</div>
         </div>
      </footer>
       
    </div>
  );
};

export default Home;
