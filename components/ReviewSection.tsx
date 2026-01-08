import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { Review, User } from '../types';
import { formatTimeAgo } from '../utils/format';

interface ReviewSectionProps {
  targetId: string;
  targetType: 'listing' | 'user';
  currentUser: User | null;
}

const DEFAULT_AVATAR = "https://ui-avatars.com/api/?background=random&color=fff&name=User";

const ReviewSection: React.FC<ReviewSectionProps> = ({ targetId, targetType, currentUser }) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // State kiểm tra xem user đã đánh giá chưa
  const [hasReviewed, setHasReviewed] = useState(false);

  useEffect(() => {
    const unsub = db.getReviews(targetId, targetType, (loadedReviews) => {
      // Sắp xếp mới nhất lên đầu
      const sorted = loadedReviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setReviews(sorted);

      // Kiểm tra xem user hiện tại đã có trong danh sách review chưa
      if (currentUser) {
        const userReview = loadedReviews.find(r => r.authorId === currentUser.id);
        setHasReviewed(!!userReview);
      }
    });
    return () => unsub();
  }, [targetId, targetType, currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !comment.trim()) return;

    // Chặn spam
    if (hasReviewed) {
        alert("Bạn đã đánh giá sản phẩm này rồi.");
        return;
    }

    setIsSubmitting(true);
    
    // Lưu lại giá trị hiện tại để dùng cho cả UI và DB
    const currentRating = rating;
    const currentComment = comment.trim();

    // 1. Optimistic UI: Hiện ngay lập tức
    const newReview: Review = {
        id: 'temp_' + Date.now(),
        targetId,
        targetType,
        authorId: currentUser.id,
        authorName: currentUser.name,
        authorAvatar: currentUser.avatar,
        rating: currentRating,
        comment: currentComment,
        createdAt: new Date().toISOString()
    };

    setReviews(prev => [newReview, ...prev]);
    setShowForm(false);
    setHasReviewed(true);
    
    // Reset form
    setComment('');
    setRating(5);

    // 2. Gửi lên Server
    try {
      await db.addReview({
        targetId,
        targetType,
        authorId: currentUser.id,
        authorName: currentUser.name,
        authorAvatar: currentUser.avatar,
        rating: currentRating,
        comment: currentComment
      });
    } catch (err) {
      console.error(err);
      alert("Lỗi khi gửi đánh giá. Vui lòng thử lại.");
      // Revert lại nếu lỗi
      setReviews(prev => prev.filter(r => r.id !== newReview.id));
      setHasReviewed(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const avgRating = reviews.length > 0 
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1) 
    : "0";

  return (
    <div className="space-y-4">
      {/* Header Thống kê */}
      <div className="flex items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="text-3xl font-black text-textMain">{avgRating}</div>
          <div>
            {/* FIX: Tách sao vàng và sao xám riêng biệt */}
            <div className="flex items-center gap-0.5 text-sm">
              <span className="text-yellow-400">
                {"★".repeat(Math.round(Number(avgRating)))}
              </span>
              <span className="text-gray-300">
                {"★".repeat(5 - Math.round(Number(avgRating)))}
              </span>
            </div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{reviews.length} đánh giá</p>
          </div>
        </div>
        
        {/* Chỉ hiện nút Viết đánh giá nếu chưa đánh giá */}
        {currentUser && !hasReviewed && (
          <button 
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-primary/5 text-primary text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-primary hover:text-white transition-all shadow-sm"
          >
            {showForm ? 'Đóng' : 'Viết đánh giá'}
          </button>
        )}

        {currentUser && hasReviewed && (
            <span className="text-[10px] text-green-600 font-bold bg-green-50 px-3 py-1.5 rounded-lg">
                ✓ Bạn đã đánh giá
            </span>
        )}
      </div>

      {/* Form đánh giá */}
      {showForm && !hasReviewed && (
        <form onSubmit={handleSubmit} className="bg-bgMain p-5 rounded-2xl space-y-4 animate-fade-in-up border border-gray-100 shadow-inner">
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Chất lượng</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(s => (
                <button 
                  key={s} 
                  type="button" 
                  onClick={() => setRating(s)} 
                  className={`text-2xl transition-all hover:scale-110 active:scale-95 ${s <= rating ? 'text-yellow-400' : 'text-gray-300'}`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
          <textarea 
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Chia sẻ trải nghiệm của bạn về sản phẩm/người bán này..."
            className="w-full bg-white border border-borderMain rounded-xl p-3 text-xs font-medium focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all resize-none"
          />
          <button 
            type="submit" 
            disabled={isSubmitting || !comment.trim()}
            className="w-full bg-primary text-white font-black py-3 rounded-xl shadow-lg shadow-primary/20 active:scale-95 disabled:opacity-50 transition-all uppercase text-[10px] tracking-widest hover:bg-primaryHover"
          >
            {isSubmitting ? 'Đang gửi...' : 'Gửi đánh giá'}
          </button>
        </form>
      )}

      {/* Danh sách đánh giá */}
      <div className="space-y-3">
        {reviews.length > 0 ? reviews.map(review => (
          <div key={review.id} className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm hover:shadow-md transition-all flex gap-3 animate-fade-in">
            <img 
                src={review.authorAvatar || DEFAULT_AVATAR} 
                alt="" 
                className="w-10 h-10 rounded-full flex-shrink-0 shadow-sm object-cover border border-gray-100" 
                onError={(e) => {e.currentTarget.src = DEFAULT_AVATAR}}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-black text-textMain truncate">{review.authorName}</h4>
                <span className="text-[9px] text-gray-300 font-bold uppercase tracking-wide">{formatTimeAgo(review.createdAt)}</span>
              </div>
              
              {/* FIX: Tách sao vàng và sao xám riêng biệt cho từng review */}
              <div className="flex text-[10px] mt-0.5 mb-1.5 gap-0.5">
                <span className="text-yellow-400">
                  {"★".repeat(review.rating)}
                </span>
                <span className="text-gray-300">
                  {"★".repeat(5 - review.rating)}
                </span>
              </div>

              <p className="text-xs text-gray-600 leading-relaxed font-medium">{review.comment}</p>
            </div>
          </div>
        )) : (
          <div className="py-12 text-center text-gray-400 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
              <div className="text-4xl mb-2 opacity-30 grayscale">📝</div>
              <p className="text-[10px] font-black uppercase tracking-widest">Chưa có đánh giá nào</p>
              <p className="text-[9px] mt-1">Hãy là người đầu tiên chia sẻ cảm nhận!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewSection;
