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
import StoryBar from '../components/StoryBar';
import AdPlacement from '../components/AdPlacement'; 
import MapView from '../components/MapView'; 

// --- BỘ ICON VẼ TAY (SVG THUẦN) ---
const IconZap = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>;
const IconCrown = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/></svg>;
const IconMapPin = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>;
const IconNavigation = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>;
const IconSparkles = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M9 5H5"/><path d="M19 15v4"/><path d="M23 17h-4"/></svg>;
const IconSearch = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>;
const IconLayers = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/></svg>;
const IconPackageOpen = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M8 8.5A6 6 0 0 1 12 3a6 6 0 0 1 4 5.5"/></svg>;
const IconChevronRight = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>;
const IconLoader2 = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>;
const IconGrid = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>;
const IconMap = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/></svg>;

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

  // [VIEW MODE] Cho cả 2 phần: Tin Quanh Đây & Danh Sách Chính (khi có lọc location)
  const [nearbyViewMode, setNearbyViewMode] = useState<'grid' | 'map'>('grid');
  const [mainViewMode, setMainViewMode] = useState<'grid' | 'map'>('grid');

  const [detectedLocation, setDetectedLocation] = useState<string | null>(
      locationParam || user?.location || sessionStorage.getItem('user_location') || null
  );
  
  // Tọa độ trung tâm bản đồ
  const [mapCenter, setMapCenter] = useState<[number, number]>([10.7769, 106.7009]); 
  const [isLocating, setIsLocating] = useState(false);

  const LIMIT_VIP = 12;
  const LIMIT_NEARBY = 24; 
  const PAGE_SIZE = 12;

  const sortListings = useCallback((items: Listing[]) => {
    return [...items].sort((a, b) => {
        const tierScore: Record<string, number> = { pro: 3, basic: 2, free: 1 };
        const scoreA = tierScore[a.tier || 'free'] || 1;
        const scoreB = tierScore[b.tier || 'free'] || 1;
        
        if (scoreA !== scoreB) return scoreB - scoreA; 
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

  // 4. Load VIP & Nearby (Chỉ khi cần thiết)
  const loadSpecialSections = useCallback(async (locationToUse: string | null) => {
    if (search || isUrlCategory || typeParam) return; 
    
    // Tin VIP
    const vipRes = await db.getVIPListings(LIMIT_VIP);
    if (!vipRes.error) setVipListings(vipRes.listings);

    // Load Nearby
    if (locationToUse) {
        try {
            const nearbyRes = await db.getListingsPaged({ pageSize: LIMIT_NEARBY, location: locationToUse });
            if (!nearbyRes.error) {
                setNearbyListings(nearbyRes.listings);
                // Nếu có tọa độ của tin đầu tiên, set center
                if (nearbyRes.listings.length > 0 && nearbyRes.listings[0].lat) {
                    setMapCenter([nearbyRes.listings[0].lat!, nearbyRes.listings[0].lng!]);
                }
            }
        } catch (e) {
            console.warn("Lỗi tải tin gần bạn:", e);
        }
    } else {
        setNearbyListings([]);
    }
  }, [search, isUrlCategory, typeParam]);

  // 5. Định vị (Khi bấm nút)
  const handleDetectLocation = useCallback(() => {
    if (!navigator.geolocation) {
        alert("Trình duyệt không hỗ trợ định vị.");
        return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setMapCenter([latitude, longitude]);

        try {
            const locationInfo = await getLocationFromCoords(latitude, longitude);
            setDetectedLocation(locationInfo.city);
            setIsLocating(false);
            
            sessionStorage.setItem('user_location', locationInfo.city);

            if (user?.id) {
              db.updateUserProfile(user.id, { 
                  location: locationInfo.city, 
                  address: locationInfo.address, 
                  lat: latitude, 
                  lng: longitude 
              }).catch(() => {});
            }
            
            if (!search && !isUrlCategory) {
                loadSpecialSections(locationInfo.city);
            }
        } catch (err) {
            console.error("Lỗi lấy địa chỉ:", err);
            setIsLocating(false);
        }
      },
      () => {
        setIsLocating(false);
        alert("Vui lòng cho phép truy cập vị trí để xem tin gần bạn.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [user, loadSpecialSections, search, isUrlCategory]);

  useEffect(() => {
    if (!search && !isUrlCategory && !typeParam) {
        loadSpecialSections(detectedLocation);
    }
  }, [detectedLocation, loadSpecialSections, search, isUrlCategory, typeParam]);


  // 6. Fetch Listings Chính (Latest / Location Filter)
  const fetchInitialData = useCallback(async () => {
    if (isUrlCategory && !activeCategoryId) {
        if (isCatsLoading) return;
    }

    setIsLoading(true);
    setLatestListings([]);
    setLastDoc(null);
    setHasMore(true);
    
    try {
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

        // [QUAN TRỌNG] Nếu đang ở trang lọc địa điểm (View All), set tâm bản đồ
        if (locationParam && sortedList.length > 0 && sortedList[0].lat && sortedList[0].lng) {
            setMapCenter([sortedList[0].lat, sortedList[0].lng]);
        }
      }

      if (user?.id) {
        try {
            const favs = await db.getFavorites(user.id);
            setFavorites(favs);
        } catch (e) { console.warn("Bỏ qua tải yêu thích:", e); }
      } else {
          setFavorites([]);
      }

    } catch (e) {
      console.error("Home fetch error:", e);
    } finally {
      setIsLoading(false);
    }
  }, [activeCategoryId, allCategories, search, typeParam, locationParam, user, minPriceParam, maxPriceParam, sortListings, isUrlCategory, isCatsLoading]);

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

      {/* [CHÈN QUẢNG CÁO 1] */}
      {!search && !isUrlCategory && (
         <div className="my-6 space-y-4">
            <AdPlacement zone="home_below_categories" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="w-full"><AdPlacement zone="home_top_left" /></div>
                <div className="w-full"><AdPlacement zone="home_top_right" /></div>
            </div>
         </div>
      )}

      {/* 2. STORY BAR */}
      <div className="animate-fade-in-up">
        <StoryBar user={user} />
      </div>

      {/* 4. TIN VIP */}
      {!search && !isUrlCategory && !typeParam && !locationParam && vipListings.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
              <span className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-[10px] font-black px-2.5 py-1 rounded-lg shadow-md uppercase tracking-wider transform hover:scale-105 transition-transform flex items-center gap-1">
                 <IconCrown className="w-3 h-3 fill-current animate-pulse" /> VIP
              </span>
              <span className="font-bold text-gray-800">Tin tài trợ</span>
            </h2>
            <Link to="/?type=vip" className="text-[10px] font-black text-primary uppercase hover:underline flex items-center gap-1">
                Xem tất cả <IconChevronRight className="w-3 h-3" />
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

      {/* --- QUẢNG CÁO GIỮA TRANG --- */}
      {!search && !isUrlCategory && (
         <div className="my-8 space-y-6">
            <AdPlacement zone="home_middle_banner" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div className="w-full"><AdPlacement zone="home_grid_left" /></div>
                <div className="w-full"><AdPlacement zone="home_grid_right" /></div>
            </div>
         </div>
      )}

      {/* 5. TIN QUANH ĐÂY (TÍCH HỢP MAP & NÚT XEM TẤT CẢ) */}
      {!search && !isUrlCategory && !typeParam && !locationParam && (
        <section className="space-y-4 animate-fade-in-up">
          <div className="flex flex-col md:flex-row md:items-end justify-between px-2 gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-lg md:text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                    <IconMapPin className="w-5 h-5 text-red-500" /> Tin Quanh Đây
                </h2>
                {detectedLocation ? (
                    <span className="text-[10px] font-black text-green-600 uppercase bg-green-50 px-2 py-1 rounded-md flex items-center gap-1">
                        <IconNavigation className="w-3 h-3" /> {detectedLocation}
                    </span>
                ) : (
                    <button onClick={handleDetectLocation} className="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-1 rounded-md flex items-center gap-1 hover:bg-blue-100 animate-pulse">
                        {isLocating ? <IconLoader2 className="w-3 h-3 animate-spin" /> : <IconNavigation className="w-3 h-3" />} 
                        {isLocating ? '...' : 'Bật vị trí để xem'}
                    </button>
                )}
              </div>

              {detectedLocation && (
                  <div className="flex items-center gap-3 self-end md:self-auto">
                      {/* Nút Toggle cho mục Nearby */}
                      <div className="flex bg-gray-100 rounded-xl p-1 shadow-inner">
                            <button 
                                onClick={() => setNearbyViewMode('grid')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${nearbyViewMode === 'grid' ? 'bg-white text-primary shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                <IconGrid className="w-3 h-3" /> Lưới
                            </button>
                            <button 
                                onClick={() => setNearbyViewMode('map')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${nearbyViewMode === 'map' ? 'bg-white text-primary shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                <IconMap className="w-3 h-3" /> Bản đồ
                            </button>
                      </div>
                      
                      {/* [ĐÃ CÓ LẠI] Nút Xem Tất Cả */}
                      <Link to={`/?location=${encodeURIComponent(detectedLocation)}`} className="text-[10px] font-black text-primary uppercase hover:underline flex items-center gap-1 bg-primary/5 px-3 py-2 rounded-xl hover:bg-primary/10 transition-all">
                          Xem tất cả <IconChevronRight className="w-3 h-3" />
                      </Link>
                  </div>
              )}
          </div>

          {detectedLocation ? (
              nearbyListings.length > 0 ? (
                  <>
                    {nearbyViewMode === 'map' ? (
                        <div className="animate-fade-in">
                            <MapView listings={nearbyListings} center={mapCenter} />
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 animate-fade-in-up">
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
                    )}
                  </>
              ) : (
                 <div className="text-center py-8 text-xs text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200 flex flex-col items-center gap-2">
                    <IconMapPin className="w-8 h-8 opacity-20" />
                    Chưa có tin đăng nào gần bạn.
                 </div>
              )
          ) : (
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 flex items-center justify-between">
                  <div className="text-xs text-blue-600 font-medium">Bật định vị để xem các món hời đang bán gần bạn!</div>
                  <button onClick={handleDetectLocation} className="bg-blue-500 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase shadow-md hover:bg-blue-600">Kích hoạt ngay</button>
              </div>
          )}
        </section>
      )}

      {/* 6. DANH SÁCH CHÍNH (CÓ THÊM NÚT MAP CHO TRANG "XEM TẤT CẢ") */}
      <section className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between px-2 gap-4">
           {/* Tiêu đề */}
           <h2 className="text-lg md:text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
             {search ? <><IconSearch className="w-5 h-5 text-gray-500" /> Kết quả: "{search}"</>
             : typeParam === 'vip' ? <><IconCrown className="w-5 h-5 text-yellow-500 fill-current" /> Tất cả tin Tài Trợ (VIP)</>
             : locationParam ? <><IconMapPin className="w-5 h-5 text-red-500" /> Tin đăng tại {locationParam}</>
             : activeCategoryId ? <><IconLayers className="w-5 h-5 text-primary" /><span className="text-primary">{activeCategoryName}</span><span className="text-gray-400 text-sm font-normal">({latestListings.length} tin)</span></>
             : <span className="flex items-center gap-2"><IconSparkles className="w-5 h-5 text-yellow-500 fill-yellow-100" /><span>Tin mới đăng</span></span>
            }
           </h2>

           {/* [FIXED] Nút chuyển đổi MAP/GRID chỉ hiện khi đang xem danh sách LỌC THEO ĐỊA ĐIỂM */}
           {locationParam && (
               <div className="flex bg-gray-100 rounded-xl p-1 shadow-inner">
                    <button 
                        onClick={() => setMainViewMode('grid')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${mainViewMode === 'grid' ? 'bg-white text-primary shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        <IconGrid className="w-3 h-3" /> Lưới
                    </button>
                    <button 
                        onClick={() => setMainViewMode('map')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${mainViewMode === 'map' ? 'bg-white text-primary shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        <IconMap className="w-3 h-3" /> Bản đồ
                    </button>
               </div>
           )}
        </div>

        {/* CONTENT CHÍNH */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {[...Array(12)].map((_, i) => <div key={i} className="bg-white rounded-[2rem] p-4 space-y-4 animate-pulse border border-slate-100"><div className="aspect-square bg-slate-100 rounded-2xl"></div><div className="h-4 bg-slate-100 rounded-full w-3/4"></div></div>)}
          </div>
        ) : latestListings.length === 0 ? (
          <div className="py-24 text-center bg-white border border-gray-200 rounded-[3rem] shadow-sm flex flex-col items-center">
              <IconPackageOpen className="w-20 h-20 text-gray-200 mb-4" strokeWidth={1} />
              <p className="text-gray-400 font-black uppercase text-[10px] tracking-widest">Không tìm thấy tin đăng nào</p>
          </div>
        ) : (
          <>
            {/* Logic hiển thị MAP hoặc GRID cho danh sách chính */}
            {locationParam && mainViewMode === 'map' ? (
                <div className="animate-fade-in">
                    <MapView listings={latestListings} center={mapCenter} />
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 animate-fade-in-up">
                    {latestListings.map((l, index) => (
                        <React.Fragment key={l.id}>
                            <ListingCard 
                                listing={l} 
                                isFavorite={favorites.includes(l.id)} 
                                onToggleFavorite={toggleFav} 
                                currentUser={user} 
                            />
                            
                            {/* [CHÈN QUẢNG CÁO 3] - Xen kẽ mỗi 12 tin */}
                            {(index + 1) % 12 === 0 && (
                                <div className="col-span-2 sm:col-span-3 md:col-span-4 lg:col-span-6">
                                    <AdPlacement zone="in_feed" />
                                </div>
                            )}
                        </React.Fragment>
                    ))}
                </div>
            )}

            {/* Load More Button (Chỉ hiện khi Grid) */}
            {hasMore && !search && mainViewMode === 'grid' && (
              <div className="pt-12 flex justify-center">
                <button onClick={handleLoadMore} disabled={isFetchingMore} className="px-12 py-4 bg-white border-2 border-primary text-primary font-black rounded-full text-[11px] uppercase tracking-widest hover:bg-primary hover:text-white transition-all shadow-md active:scale-95 flex items-center gap-2">
                  {isFetchingMore ? <IconLoader2 className="w-4 h-4 animate-spin" /> : null}
                  {isFetchingMore ? 'Đang tải...' : 'Khám phá thêm tin đăng'}
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* 3. BANNER */}
      {!search && !isUrlCategory && !typeParam && !locationParam && <HomeBanner />}
      
      {/* 7. FOOTER */}
      <footer className="hidden md:block pt-16 border-t border-dashed border-gray-200 mt-20">
         <div className="bg-white border border-gray-200 rounded-[3rem] p-10 shadow-sm">
            <div className="flex items-center justify-between mb-8">
               <h4 className="text-xl font-black text-slate-900 flex items-center gap-2">
                   <IconZap className="w-6 h-6 text-yellow-500 fill-current" /> Chợ Của Tui
               </h4>
               <div className="flex gap-4">
                  {STATIC_LINKS.map(link => <Link key={link.slug} to={`/page/${link.slug}`} className="text-xs font-bold text-gray-400 hover:text-primary transition-colors uppercase">{link.title}</Link>)}
               </div>
            </div>
            <div className="text-[10px] text-gray-400 font-medium text-center border-t border-gray-100 pt-8">© 2026 ChoCuaTui.vn - Nền tảng rao vặt AI phục vụ cộng đồng.</div>
         </div>
      </footer>
    </div>
  );
};

export default Home;