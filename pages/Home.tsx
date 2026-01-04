
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
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  
  const PAGE_SIZE = 12;

  const fetchInitialData = useCallback(async () => {
    setIsLoading(true);
    try {
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
    <div className="space-y-6 pb-20 px-2 md:px-0 max-w-[1400px] mx-auto">
      
      {/* Category Strip - Marketplace Style */}
      <section className="bg-white border-b md:border md:rounded-2xl p-2 md:p-4 overflow-x-auto no-scrollbar flex gap-2 md:gap-4">
        <button 
          onClick={() => selectCategory(null)}
          className={`px-4 py-2 rounded-full text-[11px] font-black uppercase transition-all flex-shrink-0 ${!categoryId ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'}`}
        >
          Tất cả
        </button>
        {CATEGORIES.map(cat => (
          <button 
            key={cat.id} 
            onClick={() => selectCategory(cat.id)} 
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-black uppercase transition-all flex-shrink-0 ${categoryId === cat.id ? 'bg-primary/10 text-primary' : 'bg-white border border-gray-100 text-gray-500 hover:bg-gray-50'}`}
          >
            <span>{cat.icon}</span>
            <span>{cat.name}</span>
          </button>
        ))}
      </section>

      {/* Listings Grid - Mật độ tin dày giống Marketplace */}
      <section className="space-y-4">
        <h2 className="text-lg md:text-xl font-black text-gray-900 px-2 tracking-tight">
          {search ? `Kết quả tìm kiếm cho "${search}"` : categoryId ? `Khám phá ${CATEGORIES.find(c => c.id === categoryId)?.name}` : 'Tin đăng hôm nay'}
        </h2>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 md:gap-4 px-1 md:px-0">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg p-2 space-y-3 animate-pulse">
                <div className="aspect-square bg-gray-100 rounded-lg"></div>
                <div className="h-3 bg-gray-100 rounded-full w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded-full w-1/2"></div>
              </div>
            ))}
          </div>
        ) : latestListings.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-2xl border-2 border-dashed border-gray-100">
             <div className="text-5xl mb-4 grayscale opacity-20">📭</div>
             <p className="text-gray-400 font-bold">Không tìm thấy tin đăng phù hợp</p>
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
              className="px-10 py-3 bg-white border-2 border-primary text-primary font-black rounded-full text-xs uppercase tracking-widest hover:bg-primary hover:text-white transition-all disabled:opacity-50"
            >
              {isFetchingMore ? 'Đang tải thêm...' : 'Tải thêm nội dung'}
            </button>
          </div>
        )}
      </section>
    </div>
  );
};

export default Home;
