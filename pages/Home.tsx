import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { db, SystemSettings } from '../services/db'; 
import { Listing, User, Category } from '../types';
import ListingCard from '../components/ListingCard';
import HomeBanner from '../components/HomeBanner'; 
import CategoryBar from '../components/CategoryBar'; 
import { getLocationFromCoords } from '../utils/locationHelper'; 
import { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';

// --- IMPORT ICON VECTOR ---
import { 
  Crown, MapPin, Navigation, Sparkles, Search, Layers, 
  PackageOpen, Zap, ChevronRight, Loader2 
} from 'lucide-react';

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
  
  // Lấy tham số từ URL
  const { slug, parentSlug, childSlug } = useParams();
  const isUrlCategory = Boolean(slug || parentSlug || childSlug);

  const search = searchParams.get('search') || '';
  const typeParam = searchParams.get('type');
  const locationParam = searchParams.get('location');
  const minPriceParam = searchParams.get('minPrice');
  const maxPriceParam = searchParams.get('maxPrice');

  // --- STATE ---
  const [activeCategoryId, setActiveCategoryId] = useState<string>('');
  const [activeCategoryName, setActiveCategoryName] = useState<string>('');
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [isCatsLoading, setIsCatsLoading] = useState(true); 

  const [vipListings, setVipListings] = useState<Listing[]>([]);
  const [nearbyListings, setNearbyListings] = useState<Listing[]>([]);
  const [latestListings, setLatestListings] = useState<Listing[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [settings, setSettings] = useState<SystemSettings | null>(null); 
    
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const [detectedLocation, setDetectedLocation] = useState<string | null>(locationParam || user?.location || null);
  const [isLocating, setIsLocating] = useState(false);

  const LIMIT_VIP = 12;
  const LIMIT_NEARBY = 12;
  const PAGE_SIZE = 12;

  // --- HÀM SẮP XẾP TIN (VIP > BASIC > THƯỜNG) ---
  const sortListings = useCallback((items: Listing[]) => {
    return [...items].sort((a, b) => {
        const tierScore: Record<string, number> = { pro: 3, basic: 2, free: 1 };
        const scoreA = tierScore[a.tier || 'free'] || 1;
        const scoreB = tierScore[b.tier || 'free'] || 1;
        
        if (scoreA !== scoreB) {
            return scoreB - scoreA; 
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, []);

  // 1. Tải danh mục
  useEffect(() => {
    const fetchCats = async () => {
        setIsCatsLoading(true);
        const cats = await db.getCategories();
        setAllCategories(cats);
        setIsCatsLoading(false);
    };
    fetchCats();
  }, []);

  // 2. Map URL Slug -> ID Danh mục
  useEffect(() => {
    if (isCatsLoading || allCategories.length === 0) return;
    const targetSlug = childSlug || slug || parentSlug;
    if (targetSlug) {
        const found = allCategories.find(c => c.slug === targetSlug);
        if (found) {
            setActiveCategoryId(found.id);
            setActiveCategoryName(found.name);
        } else {
            setActiveCategoryId('');
            setActiveCategoryName('');
        }
    } else {
        setActiveCategoryId('');
        setActiveCategoryName('');
    }
  }, [slug, parentSlug, childSlug, allCategories, isCatsLoading]);

  // 3. Load Settings
  useEffect(() => {
    const loadSettings = async () => {
      const s = await db.getSettings();
      setSettings(s);
    };
    loadSettings();
  }, []);

  // 4. Load VIP & Nearby
  const loadSpecialSections = useCallback(async (locationToUse: string | null) => {
    if (search || isUrlCategory || typeParam) return; 
    const vipRes = await db.getVIPListings(LIMIT_VIP);
    if (!vipRes.error) setVipListings(vipRes.listings);

    const targetLoc = locationToUse || user?.location;
    if (targetLoc) {
      const nearbyRes = await db.getListingsPaged({ pageSize: LIMIT_NEARBY, location: targetLoc });
      if (!nearbyRes.error) setNearbyListings(nearbyRes.listings);
    }
  }, [user, search, isUrlCategory, typeParam]);

  // 5. Định vị
  const handleDetectLocation = useCallback(() => {
    if (!navigator.geolocation) {
        alert("Trình duyệt không hỗ trợ định vị.");
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
            if (!search && !isUrlCategory) {
                loadSpecialSections(locationInfo.city);
            }
        } catch (err) {
            console.error("Lỗi lấy địa chỉ:", err);
            setIsLocating(false);
            setDetectedLocation("TPHCM"); 
        }
      },
      () => {
        setIsLocating(false);
        alert("Vui lòng cho phép truy cập vị trí.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [user, loadSpecialSections, search, isUrlCategory]);

  // Tự động hỏi vị trí (1 lần)
  useEffect(() => {
    const hasAsked = sessionStorage.getItem('has_asked_location');
    if (!user?.location && !locationParam && !detectedLocation && !hasAsked) {
        handleDetectLocation();
        sessionStorage.setItem('has_asked_location', 'true');
    }
  }, [user, locationParam, detectedLocation, handleDetectLocation]);

  // 6. Fetch Listings
  const fetchInitialData = useCallback(async () => {
    if (isUrlCategory && !activeCategoryId) {
        if (isCatsLoading) return;
    }

    setIsLoading(true);
    setLatestListings([]);
    setLastDoc(null);
    setHasMore(true);
    
    try {
      if (!search && !isUrlCategory && !typeParam && !locationParam) {
        loadSpecialSections(detectedLocation);
      }

      const selectedCat = allCategories.find(c => c.id === activeCategoryId);
      const isParent = selectedCat && !selectedCat.parentId;

      const result = await db.getListingsPaged({
        pageSize: PAGE_SIZE,
        parentCategoryId: isParent ? activeCategoryId : undefined,
        categoryId: (!isParent && activeCategoryId) ? activeCategoryId : undefined,
        search: search || undefined,
        location: locationParam || undefined,
        isVip: typeParam === 'vip',
        minPrice: minPriceParam ? Number(minPriceParam) : undefined,
        maxPrice: maxPriceParam ? Number(maxPriceParam) : undefined,
      });

      if (!result.error) {
        const sortedList = sortListings(result.listings);
        setLatestListings(sortedList);
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
  }, [activeCategoryId, allCategories, search, typeParam, locationParam, user, loadSpecialSections, detectedLocation, isUrlCategory, isCatsLoading, minPriceParam, maxPriceParam, sortListings]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // 7. Load More
  const handleLoadMore = async () => {
    if (isFetchingMore || !hasMore) return;
    setIsFetchingMore(true);
    try {
      const selectedCat = allCategories.find(c => c.id === activeCategoryId);
      const isParent = selectedCat && !selectedCat.parentId;

      const result = await db.getListingsPaged({
        pageSize: PAGE_SIZE,
        lastDoc,
        parentCategoryId: isParent ? activeCategoryId : undefined,
        categoryId: (!isParent && activeCategoryId) ? activeCategoryId : undefined,
        search: search || undefined,
        location: locationParam || undefined,
        isVip: typeParam === 'vip',
        minPrice: minPriceParam ? Number(minPriceParam) : undefined,
        maxPrice: maxPriceParam ? Number(maxPriceParam) : undefined,
      });

      if (!result.error) {
        setLatestListings(prev => sortListings([...prev, ...result.listings]));
        setLastDoc(result.lastDoc);
        setHasMore(result.hasMore);
      }
    } finally {
      setIsFetchingMore(false);
    }
  };

  const toggleFav = async (id: string) => {
    if (!user) return navigate('/login');
    await db.toggleFavorite(user.id, id);
    const updatedFavs = await db.getFavorites(user.id);
    setFavorites(updatedFavs);
  };

  return (
    <div className="space-y-6 pb-28 md:pb-24 px-2 md:px-4 max-w-[1400px] mx-auto relative font-sans animate-fade-in">
      
      <Helmet>
        <title>Chợ Của Tui - Sàn Đấu Giá & Rao Vặt Trực Tuyến Số 1</title>
        <meta name="description" content="Khám phá hàng ngàn tin đăng mua bán, đấu giá hấp dẫn mỗi ngày tại Chợ Của Tui." />
      </Helmet>

      {/* 1. CATEGORY BAR */}
      <div className="mt-4">
        <CategoryBar />
      </div>

      {/* 2. BANNER */}
      {!search && !isUrlCategory && !typeParam && !locationParam && <HomeBanner />}

      {/* 3. TIN VIP */}
      {!search && !isUrlCategory && !typeParam && !locationParam && vipListings.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
              <span className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-[10px] font-black px-2.5 py-1 rounded-lg shadow-md uppercase tracking-wider transform hover:scale-105 transition-transform flex items-center gap-1">
                 <Crown className="w-3 h-3 fill-current animate-pulse" /> VIP
              </span>
              <span className="font-bold text-gray-800">Tin tài trợ</span>
            </h2>
            <Link to="/?type=vip" className="text-[10px] font-black text-primary uppercase hover:underline flex items-center gap-1">
                Xem tất cả <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {vipListings.map(l => (
              <ListingCard 
                key={l.id} 
                listing={l} 
                isFavorite={favorites.includes(l.id)} 
                onToggleFavorite={toggleFav} 
                currentUser={user} 
              />
            ))}
          </div>
        </section>
      )}

      {/* 4. TIN QUANH ĐÂY */}
      {!search && !isUrlCategory && !typeParam && !locationParam && (
        <section className="space-y-4 animate-fade-in-up">
          <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <h2 className="text-lg md:text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-red-500" /> Tin Quanh Đây
                </h2>
                {detectedLocation ? (
                    <span className="text-[10px] font-black text-green-600 uppercase bg-green-50 px-2 py-1 rounded-md flex items-center gap-1">
                        <Navigation className="w-3 h-3" /> {detectedLocation}
                    </span>
                ) : (
                    <button onClick={handleDetectLocation} className="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-1 rounded-md flex items-center gap-1 hover:bg-blue-100">
                        {isLocating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Navigation className="w-3 h-3" />} 
                        {isLocating ? '...' : 'Định vị'}
                    </button>
                )}
              </div>
              {detectedLocation && (
                  <Link to={`/?location=${encodeURIComponent(detectedLocation)}`} className="text-[10px] font-black text-primary uppercase hover:underline flex items-center gap-1">
                      Xem thêm <ChevronRight className="w-3 h-3" />
                  </Link>
              )}
          </div>
          {nearbyListings.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {nearbyListings.map(l => (
                    <ListingCard 
                        key={l.id} 
                        listing={l} 
                        isFavorite={favorites.includes(l.id)} 
                        onToggleFavorite={toggleFav} 
                        currentUser={user} 
                    />
                ))}
              </div>
          ) : (
             <div className="text-center py-8 text-xs text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200 flex flex-col items-center gap-2">
                <MapPin className="w-8 h-8 opacity-20" />
                Chưa có tin đăng nào gần bạn.
             </div>
          )}
        </section>
      )}

      {/* 5. DANH SÁCH CHÍNH */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-2">
           <h2 className="text-lg md:text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
             {search ? (
                 <>
                    <Search className="w-5 h-5 text-gray-500" />
                    Kết quả: "{search}"
                 </>
             )
              : typeParam === 'vip' ? (
                  <>
                    <Crown className="w-5 h-5 text-yellow-500 fill-current" />
                    Tất cả tin Tài Trợ (VIP)
                  </>
              )
              : locationParam ? (
                  <>
                    <MapPin className="w-5 h-5 text-red-500" />
                    Tin đăng tại {locationParam}
                  </>
              )
              : activeCategoryId ? (
                  <>
                    <Layers className="w-5 h-5 text-primary" />
                    <span className="text-primary">{activeCategoryName}</span>
                    <span className="text-gray-400 text-sm font-normal">({latestListings.length} tin)</span>
                  </>
              ) 
              : (
                  <span className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-yellow-500 fill-yellow-100" />
                      <span>Tin mới đăng</span>
                  </span>
              )
             }
           </h2>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {[...Array(12)].map((_, i) => <div key={i} className="bg-white rounded-[2rem] p-4 space-y-4 animate-pulse border border-slate-100"><div className="aspect-square bg-slate-100 rounded-2xl"></div><div className="h-4 bg-slate-100 rounded-full w-3/4"></div></div>)}
          </div>
        ) : latestListings.length === 0 ? (
          <div className="py-24 text-center bg-white border border-gray-200 rounded-[3rem] shadow-sm flex flex-col items-center">
              <PackageOpen className="w-20 h-20 text-gray-200 mb-4" strokeWidth={1} />
              <p className="text-gray-400 font-black uppercase text-[10px] tracking-widest">Không tìm thấy tin đăng nào</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {latestListings.map(l => (
                <ListingCard 
                    key={l.id} 
                    listing={l} 
                    isFavorite={favorites.includes(l.id)} 
                    onToggleFavorite={toggleFav} 
                    currentUser={user} 
                />
              ))}
            </div>
            {hasMore && !search && (
              <div className="pt-12 flex justify-center">
                <button onClick={handleLoadMore} disabled={isFetchingMore} className="px-12 py-4 bg-white border-2 border-primary text-primary font-black rounded-full text-[11px] uppercase tracking-widest hover:bg-primary hover:text-white transition-all shadow-md active:scale-95 flex items-center gap-2">
                  {isFetchingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {isFetchingMore ? 'Đang tải...' : 'Khám phá thêm tin đăng'}
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* 6. FOOTER - PHIÊN BẢN PREMIUM */}
      <footer className="hidden md:block pt-20 pb-10 px-4 md:px-0 mt-10">
         <div className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-[3rem] p-12 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] relative overflow-hidden group">
            
            {/* Hiệu ứng nền trang trí (Blob) */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-50 to-purple-50 rounded-full blur-3xl -mr-32 -mt-32 opacity-60 pointer-events-none transition-opacity group-hover:opacity-100"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-yellow-50 to-orange-50 rounded-full blur-3xl -ml-20 -mb-20 opacity-40 pointer-events-none"></div>

            <div className="relative z-10 flex items-center justify-between mb-10">
               {/* Logo Footer - Đồng bộ Gradient Tech */}
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-xl flex items-center justify-center text-white text-xl shadow-lg shadow-blue-500/30">
                    <Zap className="w-5 h-5 fill-current" />
                  </div>
                  <span className="font-black text-2xl tracking-tighter bg-gradient-to-r from-blue-700 via-blue-500 to-yellow-500 bg-clip-text text-transparent">
                    Chợ của tui
                  </span>
               </div>

               {/* Links - Style tinh tế hơn */}
               <div className="flex gap-8">
                  {STATIC_LINKS.map(link => (
                    <Link key={link.slug} to={`/page/${link.slug}`} className="text-[11px] font-black text-slate-400 hover:text-blue-600 transition-all uppercase tracking-widest hover:underline decoration-2 underline-offset-4">
                        {link.title}
                    </Link>
                  ))}
               </div>
            </div>

            {/* Copyright */}
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between pt-8 border-t border-slate-100">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    © 2026 ChoCuaTui.vn - Nền tảng rao vặt AI.
                </p>
                <div className="flex gap-2 mt-2 md:mt-0">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                    <span className="text-[10px] font-bold text-green-600">Hệ thống hoạt động ổn định</span>
                </div>
            </div>
         </div>
      </footer>
    </div>
  );
};

export default Home;
