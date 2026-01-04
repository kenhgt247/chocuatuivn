
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { Review, User } from '../types';
import { formatTimeAgo } from '../utils/format';

interface ReviewSectionProps {
  targetId: string;
  targetType: 'listing' | 'user';
  currentUser: User | null;
}

const ReviewSection: React.FC<ReviewSectionProps> = ({ targetId, targetType, currentUser }) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const unsub = db.getReviews(targetId, targetType, (loadedReviews) => {
      setReviews(loadedReviews);
    });
    return () => unsub();
  }, [targetId, targetType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !comment.trim()) return;

    setIsSubmitting(true);
    try {
      await db.addReview({
        targetId,
        targetType,
        authorId: currentUser.id,
        authorName: currentUser.name,
        authorAvatar: currentUser.avatar,
        rating,
        comment: comment.trim()
      });
      setComment('');
      setRating(5);
      setShowForm(false);
    } catch (err) {
      console.error(err);
      alert("Lỗi khi gửi đánh giá. Vui lòng kiểm tra quyền truy cập.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const avgRating = reviews.length > 0 
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1) 
    : "0";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="text-3xl font-black text-textMain">{avgRating}</div>
          <div>
            <div className="flex text-yellow-400 text-sm">
              {"★".repeat(Math.round(Number(avgRating)))}{"☆".repeat(5 - Math.round(Number(avgRating)))}
            </div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{reviews.length} đánh giá</p>
          </div>
        </div>
        
        {currentUser && (
          <button 
            onClick={() => setShowForm(!showForm)}
            className="px-3 py-2 bg-primary/5 text-primary text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-primary hover:text-white transition-all"
          >
            {showForm ? 'Đóng' : 'Đánh giá'}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-bgMain p-4 rounded-2xl space-y-3 animate-fade-in-up">
          <div className="flex justify-between items-center">
            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Đánh giá sao</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(s => (
                <button 
                  key={s} 
                  type="button" 
                  onClick={() => setRating(s)}
                  className={`text-xl transition-all ${s <= rating ? 'text-yellow-400' : 'text-gray-300'}`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
          <textarea 
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Nội dung..."
            className="w-full bg-white border border-borderMain rounded-xl p-3 text-xs font-medium focus:outline-none focus:border-primary"
          />
          <button 
            type="submit" 
            disabled={isSubmitting || !comment.trim()}
            className="w-full bg-primary text-white font-black py-3 rounded-xl shadow-lg shadow-primary/20 active:scale-95 disabled:opacity-50 transition-all uppercase text-[10px] tracking-widest"
          >
            {isSubmitting ? 'Đang gửi...' : 'Gửi ngay'}
          </button>
        </form>
      )}

      <div className="space-y-3">
        {reviews.length > 0 ? reviews.map(review => (
          <div key={review.id} className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm hover:shadow-md transition-all flex gap-3">
            <img src={review.authorAvatar} alt="" className="w-8 h-8 rounded-lg flex-shrink-0 shadow-sm" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-black text-textMain truncate">{review.authorName}</h4>
                <span className="text-[8px] text-gray-300 font-bold uppercase">{formatTimeAgo(review.createdAt)}</span>
              </div>
              <div className="flex text-yellow-400 text-[10px] mt-0.5">
                {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
              </div>
              <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">{review.comment}</p>
            </div>
          </div>
        )) : (
          <div className="py-6 text-center text-gray-400">
             <div className="text-2xl mb-1 opacity-30">⭐</div>
             <p className="text-[9px] font-black uppercase tracking-widest">Chưa có đánh giá</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewSection;
