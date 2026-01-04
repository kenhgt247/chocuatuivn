
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CATEGORIES } from '../constants.tsx';
import { db } from '../services/db.ts';
import { Listing, User, Category } from '../types.ts';
import ListingCard from '../components/ListingCard.tsx';
import { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';

const Home: React.FC<{ user: User | null }> = ({ user }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const categoryRef = useRef<HTMLDivElement>(null);
  
  const search = searchParams.get('search') || '';
  const categoryParam = searchParams.get('category') || ''; // Dạng: "bat-dong-san-1"
  
  // Trích xuất ID từ chuỗi slug-id (ví dụ: "bat-dong-san-1" -> "1")
  const activeCategoryId = categoryParam.split('-').pop() || '';
  
  const [latestListings, setLatestListings] = useState<Listing[]>([]);
  const [vipListings, setVipListings] = useState<Listing[]>([]);
  const [nearbyListings, setNearbyListings] = useState<Listing[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  
  // State quản lý mở rộng danh mục trên Desktop
  const [isExpanded, setIsExpanded] = useState(false);
  const DISPLAY_COUNT = 7;

  const fetchInitialData = useCallback(async () => {
    setIsLoading(true);
    try {
      const vipResult = await db.getVIPListings(6);
      setVipListings(vipResult.listings);

      if (user?.location) {
        const nearbyResult = await db.getListingsPaged({
          pageSize: 6,
          location: user.location
        });
        setNearbyListings(nearbyResult.listings.filter(l => l.sellerId !== user.id));
      }

      const result = await db.getListingsPaged({
        pageSize: 12,
        categoryId: activeCategoryId || undefined,
        search: search || undefined
      });
      
      if (!result.error) {
        setLatestListings(result.listings);
        setLastDoc(result.lastDoc);
        setHasMore(result.hasMore);
      }

      if (user) {
        const favs = await db.getFavorites(user.id);
        setFavorites(favs);
      }
    } finally {
      setIsLoading(false);
    }
  }, [activeCategoryId, search, user]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Xử lý Click Outside để thu gọn menu trên Desktop
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
        pageSize: 12,
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
    const params = new URLSearchParams(searchParams);
    if (cat) {
      // URL chuẩn SEO: slug-id (ví dụ: bat-dong-san-1)
      params.set('category', `${cat.slug}-${cat.id}`);
    } else {
      params.delete('category');
    }
    setSearchParams(params);
    setIsExpanded(false); // Thu gọn menu sau khi chọn
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleFav = async (id: string) => {
    if (!user) return navigate('/login');
    await db.toggleFavorite(user.id, id);
    const updatedFavs = await db.getFavorites(user.id);
    setFavorites(updatedFavs);
  };

  return (
    <div className="space-y-8 pb-24 px-2 md:px-4 max-w-[1400px] mx-auto">
      
      {/* Category Section Container */}
      <div ref={categoryRef} className="sticky top-20 z-40 bg-bgMain/80 backdrop-blur-md py-2 -mx-2 px-2 md:mx-0 md:px-0">
        
        {/* --- MOBILE VIEW: Thanh trượt ngang --- */}
        <section className="flex md:hidden bg-white border-b p-2 overflow-x-auto no-scrollbar gap-2 shadow-sm rounded-xl">
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

        {/* --- DESKTOP VIEW: Thông minh (7 + Tất cả) --- */}
        <section className="hidden md:block">
          <div className={`bg-white border border-borderMain rounded-[2.5rem] p-3 shadow-soft transition-all duration-500 ease-in-out ${isExpanded ? 'ring-4 ring-primary/5' : ''}`}>
            
            {!isExpanded ? (
              // TRẠNG THÁI THU GỌN: 7 danh mục đầu tiên
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 overflow-hidden">
                  <button 
                    onClick={() => selectCategory(null)}
                    className={`px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase transition-all flex-shrink-0 ${!activeCategoryId ? 'bg-primary text-white shadow-lg' : 'bg-gray-50 text-gray-400 hover:text-gray-600'}`}
                  >
                    Mặc định
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
                
                <button 
                  onClick={() => setIsExpanded(true)}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase bg-gray-100 text-gray-600 hover:bg-primary hover:text-white transition-all shadow-sm flex-shrink-0 group"
                >
                  <svg className="w-4 h-4 group-hover:rotate-180 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7"/></svg>
                  <span>Tất cả</span>
                </button>
              </div>
            ) : (
              // TRẠNG THÁI MỞ RỘNG: Lưới toàn bộ danh mục chuẩn SEO
              <div className="animate-fade-in-up">
                <div className="flex items-center justify-between mb-8 px-4">
                  <div className="flex flex-col">
                    <h3 className="text-sm font-black text-primary uppercase tracking-[0.2em]">Khám phá danh mục</h3>
                    <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">Chọn một chủ đề bạn quan tâm</p>
                  </div>
                  <button 
                    onClick={() => setIsExpanded(false)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7"/></svg>
                    Thu gọn
                  </button>
                </div>
                
                <div className="grid grid-cols-4 lg:grid-cols-7 gap-4">
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
                
                <div className="mt-8 pt-6 border-t border-gray-100 flex items-center justify-center gap-2">
                   <div className="w-1 h-1 bg-primary rounded-full animate-ping"></div>
                   <p className="text-[9px] text-gray-400 font-bold uppercase tracking-[0.3em]">Hệ thống AI đang lọc tin theo sở thích của bạn</p>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* --- PHẦN HIỂN THỊ TIN ĐĂNG (Giữ nguyên logic cũ) --- */}
      
      {/* Tin VIP */}
      {!search && !activeCategoryId && vipListings.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
              <span className="text-yellow-400 text-xl">★</span> Tin đăng tài trợ
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 md:gap-4">
            {vipListings.map(l => (
              <ListingCard key={l.id} listing={l} isFavorite={favorites.includes(l.id)} onToggleFavorite={toggleFav} />
            ))}
          </div>
        </section>
      )}

      {/* Tin Gần Bạn */}
      {!search && !activeCategoryId && nearbyListings.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
              <span className="text-red-500 text-xl">📍</span> Tin đăng gần bạn ({user?.location})
            </h2>
          </div>
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 px-1">
            {nearbyListings.map(l => (
              <div key={l.id} className="w-[160px] md:w-[200px] flex-shrink-0">
                <ListingCard listing={l} isFavorite={favorites.includes(l.id)} onToggleFavorite={toggleFav} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Feed Chính */}
      <section className="space-y-4">
        <h2 className="text-lg md:text-xl font-black text-gray-900 px-2 tracking-tight">
          {search ? `Kết quả cho "${search}"` : activeCategoryId ? `${CATEGORIES.find(c => c.id === activeCategoryId)?.name}` : 'Lựa chọn hôm nay'}
        </h2>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 md:gap-4 px-1">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg p-2 space-y-3 animate-pulse">
                <div className="aspect-square bg-gray-100 rounded-lg"></div>
                <div className="h-4 bg-gray-100 rounded-full w-3/4"></div>
                <div className="h-6 bg-gray-200 rounded-full w-1/2"></div>
              </div>
            ))}
          </div>
        ) : latestListings.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-2xl border-2 border-dashed border-gray-100">
             <div className="text-5xl mb-4 grayscale opacity-20">📭</div>
             <p className="text-gray-400 font-bold uppercase text-xs tracking-widest">Không tìm thấy tin đăng phù hợp</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 md:gap-4 px-1 md:px-0">
            {latestListings.map(l => (
              <ListingCard key={l.id} listing={l} isFavorite={favorites.includes(l.id)} onToggleFavorite={toggleFav} />
            ))}
          </div>
        )}

        {hasMore && !isLoading && (
          <div className="pt-8 flex justify-center">
            <button 
              onClick={handleLoadMore}
              disabled={isFetchingMore}
              className="px-10 py-3 bg-white border-2 border-primary text-primary font-black rounded-full text-[11px] uppercase tracking-widest hover:bg-primary hover:text-white transition-all shadow-md active:scale-95"
            >
              {isFetchingMore ? 'Đang tải...' : 'Xem thêm kết quả'}
            </button>
          </div>
        )}
      </section>
    </div>
  );
};

export default Home;
