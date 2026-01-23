import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { Listing, User } from '../types';
import ListingCard from './ListingCard';
import { Link } from 'react-router-dom';

// --- ICONS ---
const IconRobot = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>;
const IconArrowRight = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>;

interface RecommendedSectionProps {
  user: User | null;
  onToggleFavorite: (id: string) => void;
  favorites: string[];
}

const RecommendedSection: React.FC<RecommendedSectionProps> = ({ user, onToggleFavorite, favorites }) => {
  const [listings, setListings] = useState<Listing[]>([]);
  const [keyword, setKeyword] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRecommendations = async () => {
      setIsLoading(true);
      try {
        // 1. Lấy lịch sử tìm kiếm từ LocalStorage
        const historyJson = localStorage.getItem('search_history');
        const history: string[] = historyJson ? JSON.parse(historyJson) : [];

        // Nếu không có lịch sử, dừng lại
        if (history.length === 0) {
            setIsLoading(false);
            return;
        }

        // 2. Lấy từ khóa mới nhất
        const lastSearch = history[0]; 
        setKeyword(lastSearch);

        // 3. Tìm kiếm tin đăng phù hợp
        const result = await db.getListingsPaged({
          pageSize: 12, // Gửi yêu cầu 12 tin
          search: lastSearch
        });
        
        // [QUAN TRỌNG] Cắt mảng kết quả chỉ lấy 12 tin đầu tiên để đảm bảo giao diện không bị vỡ
        setListings(result.listings.slice(0, 12));

      } catch (error) {
        console.error("Lỗi lấy gợi ý AI:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecommendations();
  }, []);

  // Nếu tải xong mà không có tin nào -> Ẩn luôn section này
  if (!isLoading && listings.length === 0) return null;

  return (
    <section className="my-8 animate-fade-in-up">
      {/* Header Section */}
      <div className="flex items-end justify-between px-2 mb-5">
        <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl text-white shadow-lg shadow-purple-200">
                <IconRobot />
            </div>
            <div>
                <h2 className="text-lg md:text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                    Gợi ý cho bạn
                    <span className="text-[9px] font-bold bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full border border-purple-100 uppercase tracking-wider hidden sm:inline-block">Chuẩn Gu 👌</span>
                </h2>
                <p className="text-xs text-gray-500 font-medium mt-0.5">
                    Dựa trên việc bạn tìm kiếm <span className="font-bold text-gray-800">"{keyword}"</span>
                </p>
            </div>
        </div>

        {/* Nút Xem tất cả -> Dẫn sang trang tìm kiếm (Sẽ hiện 24 tin theo logic Home.tsx) */}
        <Link 
            to={`/?search=${encodeURIComponent(keyword)}`} 
            className="flex items-center gap-1 text-[11px] font-bold text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-full transition-all"
        >
            Xem tất cả <IconArrowRight />
        </Link>
      </div>

      {/* Content Grid */}
      {isLoading ? (
         <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white rounded-[1.5rem] p-3 space-y-3 border border-slate-50 shadow-sm">
                    <div className="aspect-square bg-slate-100 rounded-xl animate-pulse"></div>
                    <div className="h-3 bg-slate-100 rounded w-3/4 animate-pulse"></div>
                    <div className="h-3 bg-slate-100 rounded w-1/2 animate-pulse"></div>
                </div>
            ))}
         </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {listings.map(l => (
                <ListingCard 
                    key={l.id} 
                    listing={l} 
                    isFavorite={favorites.includes(l.id)} 
                    onToggleFavorite={onToggleFavorite} 
                    currentUser={user} 
                />
            ))}
        </div>
      )}
    </section>
  );
};

export default RecommendedSection;