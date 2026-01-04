
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CATEGORIES } from '../constants.tsx';
import { db } from '../services/db.ts';
import { Listing, User } from '../types.ts';
import ListingCard from '../components/ListingCard.tsx';
import { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';

const Home: React.FC<{ user: User | null }> = ({ user }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const search = searchParams.get('search') || '';
  const categoryId = searchParams.get('category') || '';
  
  const [latestListings, setLatestListings] = useState<Listing[]>([]);
  const [vipListings, setVipListings] = useState<Listing[]>([]);
  const [nearbyListings, setNearbyListings] = useState<Listing[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  
  const PAGE_SIZE = 12;

  const fetchInitialData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Fetch VIP Listings
      const vipResult = await db.getVIPListings(6);
      setVipListings(vipResult.listings);

      // 2. Fetch Nearby Listings (if location available)
      if (user?.location) {
        const nearbyResult = await db.getListingsPaged({
          pageSize: 6,
          location: user.location
        });
        setNearbyListings(nearbyResult.listings.filter(l => l.sellerId !== user.id));
      }

      // 3. Fetch Main Feed
      const result = await db.getListingsPaged({
        pageSize: PAGE_SIZE,
        categoryId: categoryId || undefined,
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
  }, [categoryId, search, user]);

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

      if (!result.error) {
        setLatestListings(prev => [...prev, ...result.listings]);
        setLastDoc(result.lastDoc);
        setHasMore(result.hasMore);
      }
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
    <div className="space-y-8 pb-24 px-2 md:px-4 max-w-[1400px] mx-auto">
      
      {/* Category Strip */}
      <section className="bg-white border-b md:border md:rounded-2xl p-2 md:p-4 overflow-x-auto no-scrollbar flex gap-2 md:gap-4 sticky top-20 z-30">
        <button 
          onClick={() => selectCategory(null)}
          className={`px-4 py-2 rounded-full text-[11px] font-black uppercase transition-all flex-shrink-0 ${!categoryId ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-gray-100 text-gray-500'}`}
        >
          Tất cả
        </button>
        {CATEGORIES.map(cat => (
          <button 
            key={cat.id} 
            onClick={() => selectCategory(cat.id)} 
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-black uppercase transition-all flex-shrink-0 ${categoryId === cat.id ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-white border border-gray-100 text-gray-500 hover:bg-gray-50'}`}
          >
            <span>{cat.icon}</span>
            <span>{cat.name}</span>
          </button>
        ))}
      </section>

      {/* Tin VIP - Ưu tiên hiển thị */}
      {!search && !categoryId && vipListings.length > 0 && (
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
      {!search && !categoryId && nearbyListings.length > 0 && (
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
          {search ? `Kết quả cho "${search}"` : categoryId ? `${CATEGORIES.find(c => c.id === categoryId)?.name}` : 'Lựa chọn hôm nay'}
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
