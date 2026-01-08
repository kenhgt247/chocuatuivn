import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { Review, User } from '../types';
import { formatTimeAgo } from '../utils/format';
import { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';

interface ReviewSectionProps {
  targetId: string;
  targetType: 'listing' | 'user';
  currentUser: User | null;
  // [QUAN TRỌNG] Các thông số này phải được truyền từ cha (đã tính sẵn ở DB)
  // Không được tính toán lại ở đây vì chúng ta không load hết data
  initialAvgRating?: number; 
  initialTotalReviews?: number;
}

const DEFAULT_AVATAR = "https://ui-avatars.com/api/?background=random&color=fff&name=User";
const PAGE_SIZE = 5; // Chỉ tải 5 đánh giá mỗi lần

const ReviewSection: React.FC<ReviewSectionProps> = ({ 
  targetId, 
  targetType, 
  currentUser,
  initialAvgRating = 0, // Nhận từ props
  initialTotalReviews = 0 // Nhận từ props
}) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  
  // State phân trang
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Form State
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);

  // --- 1. Load dữ liệu lần đầu (Chỉ tải 5 dòng) ---
  useEffect(() => {
    const fetchInitial = async () => {
      setLoading(true);
      try {
        // Hàm này trong db cần sửa để hỗ trợ limit
        const result = await db.getReviewsPaged({
            targetId, 
            targetType, 
            pageSize: PAGE_SIZE
        });
        
        setReviews(result.data);
        setLastDoc(result.lastDoc);
        setHasMore(result.hasMore);

        // Check user review (Cần 1 query riêng nhẹ hơn thay vì find trong list)
        if (currentUser) {
            const userRev = await db.checkUserReviewed(targetId, currentUser.id);
            setHasReviewed(userRev);
        }
      } catch (error) {
        console.error("Load reviews failed", error);
      } finally {
        setLoading(false);
      }
    };

    fetchInitial();
  }, [targetId, targetType, currentUser]);

  // --- 2. Load thêm dữ liệu (Pagination) ---
  const handleLoadMore = async () => {
    if (loadingMore || !hasMore || !lastDoc) return;
    setLoadingMore(true);
    try {
        const result = await db.getReviewsPaged({
            targetId, 
            targetType, 
            pageSize: PAGE_SIZE,
            startAfter: lastDoc // Con trỏ để tải tiếp
        });

        setReviews(prev => [...prev, ...result.data]);
        setLastDoc(result.lastDoc);
        setHasMore(result.hasMore);
    } catch (error) {
        console.error("Load more failed", error);
    } finally {
        setLoadingMore(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !comment.trim()) return;

    setIsSubmitting(true);
    const newReview = {
        rating,
        comment,
        authorId: currentUser.id,
        // ... (các field khác)
        createdAt: new Date().toISOString()
    };

    try {
      // Gửi lên server
      await db.addReview({ ...newReview, targetId, targetType } as any);
      
      // Optimistic UI: Thêm vào đầu list
      setReviews(prev => [{ ...newReview, id: 'temp', authorName: currentUser.name, authorAvatar: currentUser.avatar } as Review, ...prev]);
      
      setHasReviewed(true);
      setShowForm(false);
      
      // LƯU Ý: Không tính lại avgRating ở đây vì Client không đủ dữ liệu
      // Server sẽ tính toán ngầm và update sau
    } catch (err) {
      alert("Lỗi kết nối");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Render ---
  // Dùng props truyền vào thay vì tính toán reduce
  const displayRating = initialAvgRating.toFixed(1);
  const displayCount = initialTotalReviews + (hasReviewed ? 0 : 0); // Logic tạm

  return (
    <div className="space-y-4">
      {/* Header Thống kê - Dùng dữ liệu Aggregation từ DB */}
      <div className="flex items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="text-3xl font-black text-textMain">{displayRating}</div>
          <div>
            <div className="flex text-[10px] gap-0.5">
               {/* Dùng SVG Star để đảm bảo màu sắc */}
               {[1,2,3,4,5].map(s => (
                   <svg key={s} className={`w-3 h-3 ${s <= Math.round(Number(displayRating)) ? 'text-yellow-400' : 'text-gray-300'}`} fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
               ))}
            </div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                {displayCount > 1000 ? `${(displayCount/1000).toFixed(1)}k` : displayCount} đánh giá
            </p>
          </div>
        </div>
        
        {currentUser && !hasReviewed && (
          <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-primary/5 text-primary text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-primary hover:text-white transition-all">
            {showForm ? 'Đóng' : 'Viết đánh giá'}
          </button>
        )}
      </div>

      {/* Form Area ... (Giữ nguyên logic form) */}
      {showForm && !hasReviewed && (
          // ... Form code here
          <div className="p-4 bg-gray-50 rounded">Form Placeholder</div>
      )}

      {/* Danh sách đánh giá */}
      <div className="space-y-3">
        {reviews.map(review => (
          <div key={review.id} className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm flex gap-3">
             {/* ... Render nội dung review ... */}
             <div className="flex-1">
                 <div className="font-bold text-xs">{review.authorName}</div>
                 <div className="text-xs text-gray-600">{review.comment}</div>
             </div>
          </div>
        ))}

        {/* Nút Tải thêm (Load More) */}
        {hasMore ? (
            <button 
                onClick={handleLoadMore} 
                disabled={loadingMore}
                className="w-full py-3 text-xs font-bold text-gray-500 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all disabled:opacity-50"
            >
                {loadingMore ? 'Đang tải...' : 'Xem thêm đánh giá cũ hơn'}
            </button>
        ) : (
            reviews.length > 0 && <p className="text-center text-[10px] text-gray-400 py-4">Đã hiển thị hết danh sách</p>
        )}
      </div>
    </div>
  );
};

export default ReviewSection;
