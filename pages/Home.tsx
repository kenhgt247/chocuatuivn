
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { CATEGORIES, LOCATIONS } from '../constants.tsx';
import { db } from '../services/db.ts';
import { Listing, User } from '../types.ts';
import ListingCard from '../components/ListingCard.tsx';
import { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';

const Home: React.FC<{ user: User | null }> = ({ user }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const search = searchParams.get('search') || '';
  const categoryId = searchParams.get('category') || '';
  
  const [vipListings, setVipListings] = useState<Listing[]>([]);
  const [nearbyListings, setNearbyListings] = useState<Listing[]>([]);
  const [latestListings, setLatestListings] = useState<Listing[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  
  // Vị trí thực tế được phát hiện
  const [detectedLocation, setDetectedLocation] = useState<string | null>(user?.location || null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Lưu trữ danh sách các lỗi Index cần xử lý
  const [indexErrors, setIndexErrors] = useState<{msg: string, link: string | null}[]>([]);

  const PAGE_SIZE = 12;

  const extractIndexLink = (error: string) => {
    const match = error.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
    return match ? match[0] : null;
  };

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
        // Logic giả lập: Nếu vĩ độ > 15 thì ở Miền Bắc (Hà Nội), ngược lại Miền Nam (TPHCM)
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
      if (!search && !categoryId) {
        await loadSpecialSections(detectedLocation);
      }

      const result = await db.getListingsPaged({
        pageSize: PAGE_SIZE,
        categoryId: categoryId || undefined,
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
  }, [categoryId, search, user, loadSpecialSections, detectedLocation]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const handleLoadMore = async () => {
    if (isFetchingMore || !hasMore || !lastDoc) return;
    setIsFetchingMore(true);
    try {
      const result = await db.getListingsPaged({
        pageSize: PAGE_SIZE,
        lastDoc,
        categoryId: categoryId || undefined,
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

  const selectCategory = (id: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (id) params.set('category', id);
    else params.delete('category');
    setSearchParams(params);
  };

  const toggleFav = async (id: string) => {
    if (!user) return navigate('/login');
    await db.toggleFavorite(user.id, id);
    const updatedFavs = await db.getFavorites(user.id);
    setFavorites(updatedFavs);
  };

  return (
    <div className="space-y-8 pb-24 px-4 md:px-0 max-w-[1400px] mx-auto">
      
      {/* 1. CATEGORY STRIP + LOCATION QUICK SELECT */}
      <section className="bg-white border border-borderMain rounded-[2rem] p-4 md:p-6 shadow-soft flex flex-col md:flex-row items-center gap-6 overflow-hidden">
        <div className="flex items-center gap-4 overflow-x-auto no-scrollbar py-2 flex-1 w-full">
          <button 
            onClick={() => selectCategory(null)}
            className={`flex-shrink-0 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${!categoryId ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-bgMain text-gray-500 hover:bg-gray-200'}`}
          >
            Tất cả
          </button>
          {CATEGORIES.map(cat => (
            <button 
              key={cat.id} 
              onClick={() => selectCategory(cat.id)} 
              className={`flex-shrink-0 flex items-center gap-3 px-6 py-3 rounded-2xl transition-all border-2 ${categoryId === cat.id ? 'bg-primary/5 border-primary text-primary' : 'bg-white border-transparent text-gray-500 hover:bg-gray-50'}`}
            >
              <span className="text-xl">{cat.icon}</span>
              <span className="text-[10px] font-black uppercase tracking-tight">{cat.name}</span>
            </button>
          ))}
        </div>

        {/* Nút định vị nhỏ gọn thay thế banner */}
        <div className="flex-shrink-0 border-l border-gray-100 pl-6 hidden md:block">
           <button 
            onClick={handleDetectLocation}
            disabled={isLocating}
            className={`flex items-center gap-3 px-6 py-3 rounded-2xl border-2 transition-all font-black text-[10px] uppercase tracking-widest ${detectedLocation ? 'border-green-500/20 text-green-600 bg-green-50' : 'border-primary/10 text-primary bg-primary/5 hover:bg-primary hover:text-white'}`}
           >
             {isLocating ? (
               <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
             ) : (
               <span>📍 {detectedLocation || 'Định vị gần bạn'}</span>
             )}
           </button>
        </div>
      </section>

      {/* ADMIN SETUP WIZARD (Chỉ hiện khi có lỗi Index) */}
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

      {/* 2. TIN PRO VIP (Slider) */}
      {!search && !categoryId && indexErrors.every(e => !e.msg.includes('VIP')) && vipListings.length > 0 && (
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

      {/* 3. TIN QUANH ĐÂY (Location Based) */}
      {!search && !categoryId && indexErrors.every(e => !e.msg.includes('Quanh Đây')) && (
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

            {/* Trigger định vị tích hợp vào header nếu chưa có */}
            {!detectedLocation ? (
              <button 
                onClick={handleDetectLocation} 
                className="flex items-center gap-2 bg-primary text-white text-[9px] font-black uppercase tracking-widest px-6 py-2.5 rounded-xl shadow-lg shadow-primary/10 animate-pulse active:scale-95 transition-all"
              >
                {isLocating ? 'Đang xác định...' : 'Bật định vị ngay'}
              </button>
            ) : (
              <button onClick={handleDetectLocation} className="text-[10px] font-black text-gray-400 uppercase underline bg-gray-50 px-4 py-2 rounded-xl hover:text-primary transition-colors">Làm mới vị trí</button>
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

      {/* 4. TIN MỚI NHẤT (Main Feed) */}
      <section className="space-y-8">
        <div className="flex items-center justify-between px-2">
           <h2 className="text-xl md:text-2xl font-black text-textMain tracking-tight flex items-center gap-3">
             <span className="w-2 h-8 bg-primary rounded-full shadow-lg"></span>
             {search ? `Kết quả: "${search}"` : categoryId ? `Mục: ${CATEGORIES.find(c => c.id === categoryId)?.name}` : '🆕 Tin mới đăng'}
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
