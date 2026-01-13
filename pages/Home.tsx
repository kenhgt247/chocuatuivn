import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, useParams, Link } from 'react-router-dom';
import { db, SystemSettings } from '../services/db'; 
import { Listing, User, Category } from '../types';
import ListingCard from '../components/ListingCard';
import HomeBanner from '../components/HomeBanner'; 
// [QUAN TRỌNG] Import CategoryBar mới
import CategoryBar from '../components/CategoryBar'; 
import { formatPrice } from '../utils/format'; 
import { getLocationFromCoords } from '../utils/locationHelper'; 
import { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';

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
  
  // Lấy tham số từ URL (hỗ trợ cả danh mục cha và con)
  const { slug, parentSlug, childSlug } = useParams();

  const search = searchParams.get('search') || '';
  const typeParam = searchParams.get('type');
  const locationParam = searchParams.get('location');

  // --- STATE QUẢN LÝ DỮ LIỆU ---
  const [activeCategoryId, setActiveCategoryId] = useState<string>('');
  const [activeCategoryName, setActiveCategoryName] = useState<string>('');
  const [allCategories, setAllCategories] = useState<Category[]>([]);

  const [vipListings, setVipListings] = useState<Listing[]>([]);
  const [nearbyListings, setNearbyListings] = useState<Listing[]>([]);
  const [latestListings, setLatestListings] = useState<Listing[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null); 
    
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);

  // Định vị
  const [detectedLocation, setDetectedLocation] = useState<string | null>(locationParam || user?.location || null);
  const [isLocating, setIsLocating] = useState(false);

  const LIMIT_VIP = 12;
  const LIMIT_NEARBY = 12;
  const PAGE_SIZE = 12;

  // 1. Tải danh sách Danh mục từ DB để đối chiếu Slug -> ID
  useEffect(() => {
    const fetchCats = async () => {
        const cats = await db.getCategories();
        setAllCategories(cats);
    };
    fetchCats();
  }, []);

  // 2. Logic "Dịch" URL Slug thành ID Danh mục (Fix lỗi bấm không đổi)
  useEffect(() => {
    if (allCategories.length === 0) return;

    // Ưu tiên: childSlug > slug > parentSlug
    const targetSlug = childSlug || slug || parentSlug;

    if (targetSlug) {
        const found = allCategories.find(c => c.slug === targetSlug);
        if (found) {
            setActiveCategoryId(found.id);
            setActiveCategoryName(found.name);
        } else {
            // Trường hợp không tìm thấy (hoặc đang ở trang chủ /search)
            setActiveCategoryId('');
            setActiveCategoryName('');
        }
    } else {
        // Trang chủ
        setActiveCategoryId('');
        setActiveCategoryName('');
    }
  }, [slug, parentSlug, childSlug, allCategories]);

  // 3. Load Settings
  useEffect(() => {
    const loadSettings = async () => {
      const s = await db.getSettings();
      setSettings(s);
    };
    loadSettings();
  }, []);

  // 4. Load VIP & Nearby (Chỉ chạy ở trang chủ gốc)
  const loadSpecialSections = useCallback(async (locationToUse: string | null) => {
    if (search || activeCategoryId || typeParam) return;

    // Load VIP
    const vipRes = await db.getVIPListings(LIMIT_VIP);
    if (!vipRes.error) setVipListings(vipRes.listings);

    // Load Nearby
    const targetLoc = locationToUse || user?.location;
    if (targetLoc) {
      const nearbyRes = await db.getListingsPaged({ pageSize: LIMIT_NEARBY, location: targetLoc });
      if (!nearbyRes.error) setNearbyListings(nearbyRes.listings);
    }
  }, [user, search, activeCategoryId, typeParam]);

  // 5. Xử lý Định vị (Giữ nguyên logic cũ)
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

            // Reload lại phần Nearby
            if (!search && !activeCategoryId) {
                loadSpecialSections(locationInfo.city);
            }
        } catch (err) {
            console.error("Lỗi lấy địa chỉ:", err);
            setIsLocating(false);
            setDetectedLocation("TPHCM"); 
        }
      },
      (error) => {
        setIsLocating(false);
        alert("Vui lòng cho phép truy cập vị trí.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [user, loadSpecialSections, search, activeCategoryId]);

  // 6. Fetch Listings Chính (Thay đổi khi activeCategoryId đổi)
  const fetchInitialData = useCallback(async () => {
    setIsLoading(true);
    setLatestListings([]);
    setLastDoc(null);
    setHasMore(true);
    
    try {
      if (!search && !activeCategoryId && !typeParam && !locationParam) {
        loadSpecialSections(detectedLocation);
      }

      // Query DB với ID danh mục chuẩn
      const result = await db.getListingsPaged({
        pageSize: PAGE_SIZE,
        categoryId: activeCategoryId || undefined, // Truyền ID vào đây
        search: search || undefined,
        location: locationParam || undefined,
        isVip: typeParam === 'vip'
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
    } catch (e) {
      console.error("Home fetch error:", e);
    } finally {
      setIsLoading(false);
    }
  }, [activeCategoryId, search, typeParam, locationParam, user, loadSpecialSections, detectedLocation]);

  // Trigger fetch khi activeCategoryId thay đổi (Quan trọng!)
  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // 7. Load More
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

  // Actions
  const toggleFav = async (id: string) => {
    if (!user) return navigate('/login');
    await db.toggleFavorite(user.id, id);
    const updatedFavs = await db.getFavorites(user.id);
    setFavorites(updatedFavs);
  };

  const handlePushListing = async (listingId: string) => {
    if (!user) { if(window.confirm("Đăng nhập để đẩy tin?")) navigate('/login'); return; }
    if (!settings) return;
    if (!window.confirm(`Phí đẩy tin: ${formatPrice(settings.pushPrice)}. Đồng ý?`)) return;
    setIsLoading(true);
    await db.pushListing(listingId, user.id);
    alert("Đẩy tin thành công!");
    fetchInitialData();
    setIsLoading(false);
  };

  return (
    <div className="space-y-6 pb-28 md:pb-24 px-2 md:px-4 max-w-[1400px] mx-auto relative font-sans animate-fade-in">
      
      {/* 1. MỚI: CATEGORY BAR */}
      <div className="mt-4">
        <CategoryBar />
      </div>

  

      {/* 3. BANNER (Chỉ hiện khi ở trang chủ) */}
      {!search && !activeCategoryId && !typeParam && !locationParam && <HomeBanner />}

      {/* 4. TIN VIP */}
      {!search && !activeCategoryId && !typeParam && !locationParam && vipListings.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
              <span className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-[10px] font-black px-2.5 py-1 rounded-lg shadow-md uppercase tracking-wider transform hover:scale-105 transition-transform"><span className="animate-pulse">👑</span> VIP</span>
              <span className="font-bold text-gray-800">Tin tài trợ</span>
            </h2>
            <Link to="/?type=vip" className="text-[10px] font-black text-primary uppercase hover:underline">Xem tất cả</Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {vipListings.map(l => (
              <ListingCard 
                key={l.id} listing={l} isFavorite={favorites.includes(l.id)} onToggleFavorite={toggleFav} 
                onPushListing={user && user.id === l.sellerId ? handlePushListing : undefined} hideViews={true} 
              />
            ))}
          </div>
        </section>
      )}

      {/* 5. TIN MỚI / KẾT QUẢ TÌM KIẾM */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-2">
           <h2 className="text-lg md:text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
             {search ? `Kết quả: "${search}"` 
              : typeParam === 'vip' ? 'Tất cả tin Tài Trợ (VIP)'
              : locationParam ? `Tin đăng tại ${locationParam}`
              : activeCategoryId ? (
                  <>
                    <span className="text-primary">{activeCategoryName}</span>
                    <span className="text-gray-400 text-sm font-normal">({latestListings.length} tin)</span>
                  </>
              ) 
              : <span className="flex items-center gap-2"><span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span></span><span className="text-yellow-500 text-2xl">✨</span><span>Tin mới đăng</span></span>
             }
           </h2>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {[...Array(12)].map((_, i) => <div key={i} className="bg-white rounded-[2rem] p-4 space-y-4 animate-pulse border border-slate-100"><div className="aspect-square bg-slate-100 rounded-2xl"></div><div className="h-4 bg-slate-100 rounded-full w-3/4"></div></div>)}
          </div>
        ) : latestListings.length === 0 ? (
          <div className="py-24 text-center bg-white border border-gray-200 rounded-[3rem] shadow-sm">
              <div className="text-6xl mb-4 grayscale opacity-20">🌵</div>
              <p className="text-gray-400 font-black uppercase text-[10px] tracking-widest">Không tìm thấy tin đăng nào</p>
              {activeCategoryId && <p className="text-gray-400 text-xs mt-2">Hãy thử chọn danh mục khác</p>}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {latestListings.map(l => (
                <ListingCard 
                    key={l.id} listing={l} isFavorite={favorites.includes(l.id)} onToggleFavorite={toggleFav} 
                    onPushListing={user && user.id === l.sellerId ? handlePushListing : undefined} hideViews={true} 
                />
              ))}
            </div>
            {hasMore && !search && (
              <div className="pt-12 flex justify-center">
                <button onClick={handleLoadMore} disabled={isFetchingMore} className="px-12 py-4 bg-white border-2 border-primary text-primary font-black rounded-full text-[11px] uppercase tracking-widest hover:bg-primary hover:text-white transition-all shadow-md active:scale-95">
                  {isFetchingMore ? 'Đang tải...' : 'Khám phá thêm tin đăng'}
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* 6. FOOTER */}
      <footer className="hidden md:block pt-16 border-t border-dashed border-gray-200 mt-20">
         <div className="bg-white border border-gray-200 rounded-[3rem] p-10 shadow-sm">
            <div className="flex items-center justify-between mb-8">
               <h4 className="text-xl font-black text-slate-900 flex items-center gap-2"><span className="text-2xl">⚡</span> Chợ Của Tui</h4>
               <div className="flex gap-4">
                  {STATIC_LINKS.map(link => <Link key={link.slug} to={`/page/${link.slug}`} className="text-xs font-bold text-gray-400 hover:text-primary transition-colors uppercase">{link.title}</Link>)}
               </div>
            </div>
            <div className="text-[10px] text-gray-400 font-medium text-center border-t border-gray-100 pt-8">© 2024 ChoCuaTui.vn - Nền tảng rao vặt AI. All rights reserved.</div>
         </div>
      </footer>
    </div>
  );
};

export default Home;