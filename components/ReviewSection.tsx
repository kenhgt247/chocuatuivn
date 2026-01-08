import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { Review, User } from '../types';
import { formatTimeAgo } from '../utils/format';
import { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';

interface ReviewSectionProps {
  targetId: string;
  targetType: 'listing' | 'user';
  currentUser: User | null;
}

const DEFAULT_AVATAR = "https://ui-avatars.com/api/?background=random&color=fff&name=User";
const ITEMS_PER_PAGE = 5; // Số lượng review hiển thị mỗi lần

const ReviewSection: React.FC<ReviewSectionProps> = ({ targetId, targetType, currentUser }) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  
  // State Form
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  
  // State Edit/Update
  const [editingId, setEditingId] = useState<string | null>(null);

  // State Pagination (Phân trang)
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Check đã review chưa
  const [hasReviewed, setHasReviewed] = useState(false);

  // --- 1. Load dữ liệu lần đầu ---
  useEffect(() => {
    // Reset state khi target thay đổi
    setReviews([]);
    setLastDoc(null);
    setHasMore(true);
    setEditingId(null);
    setShowForm(false);
    
    const fetchInitial = async () => {
      try {
        // Tải 5 review đầu tiên
        const result = await db.getReviewsPaged({
            targetId, 
            targetType, 
            pageSize: ITEMS_PER_PAGE
        });
        
        setReviews(result.data);
        setLastDoc(result.lastDoc);
        setHasMore(result.hasMore);

        // Kiểm tra xem user hiện tại đã review chưa (để ẩn/hiện nút viết đánh giá)
        if (currentUser) {
            const alreadyReviewed = await db.checkUserReviewed(targetId, currentUser.id);
            setHasReviewed(alreadyReviewed);
        }
      } catch (error) {
        console.error("Load reviews failed", error);
      }
    };

    fetchInitial();
  }, [targetId, targetType, currentUser]);

  // --- 2. Load thêm (Xem thêm) ---
  const handleLoadMore = async () => {
    if (loadingMore || !hasMore || !lastDoc) return;
    setLoadingMore(true);
    try {
        const result = await db.getReviewsPaged({
            targetId, 
            targetType, 
            pageSize: ITEMS_PER_PAGE,
            startAfterDoc: lastDoc // Load tiếp từ dòng cuối cùng
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

  // --- 3. Xử lý click Sửa ---
  const handleEditClick = (review: Review) => {
    setRating(review.rating);
    setComment(review.comment);
    setEditingId(review.id);
    setShowForm(true); // Mở form
    
    // Cuộn màn hình tới form để user thấy
    document.getElementById('review-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // --- 4. Xử lý click Xóa ---
  const handleDeleteClick = async (reviewId: string) => {
    if (!window.confirm("Bạn có chắc muốn xóa đánh giá này không?")) return;
    
    try {
        await db.deleteReview(reviewId);
        // Cập nhật UI: Xóa khỏi mảng reviews
        setReviews(prev => prev.filter(r => r.id !== reviewId));
        setHasReviewed(false); // Cho phép đánh giá lại
        alert("Đã xóa đánh giá.");
    } catch (error) {
        console.error("Lỗi xóa review:", error);
        alert("Không thể xóa đánh giá. Thử lại sau.");
    }
  };

  // --- 5. Submit Form (Tạo mới hoặc Cập nhật) ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !comment.trim()) return;

    setIsSubmitting(true);
    const currentRating = rating;
    const currentComment = comment.trim();

    try {
      if (editingId) {
        // --- LOGIC CẬP NHẬT (UPDATE) ---
        await db.updateReview(editingId, {
            rating: currentRating,
            comment: currentComment
        });
        
        // Update state local để UI phản hồi ngay
        setReviews(prev => prev.map(r => r.id === editingId ? { ...r, rating: currentRating, comment: currentComment } : r));
        setEditingId(null); // Tắt chế độ sửa
        alert("Cập nhật đánh giá thành công!");

      } else {
        // --- LOGIC TẠO MỚI (CREATE) ---
        if (hasReviewed) {
             alert("Bạn đã đánh giá rồi. Hãy dùng tính năng sửa.");
             setIsSubmitting(false);
             return;
        }

        const newReviewData = {
            targetId,
            targetType,
            authorId: currentUser.id,
            authorName: currentUser.name,
            authorAvatar: currentUser.avatar,
            rating: currentRating,
            comment: currentComment
        };

        const newId = await db.addReview(newReviewData);

        // Thêm ngay vào đầu danh sách (Optimistic UI)
        const newReview: Review = {
            id: newId,
            ...newReviewData,
            createdAt: new Date().toISOString()
        };
        
        setReviews(prev => [newReview, ...prev]);
        setHasReviewed(true);
      }
      
      // Reset Form
      setShowForm(false);
      setComment('');
      setRating(5);
      
    } catch (err) {
      console.error(err);
      alert("Lỗi khi gửi đánh giá. Vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Tính toán hiển thị (chỉ trên số lượng đã tải - thực tế nên lấy từ DB User)
  const avgRating = reviews.length > 0 
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1) 
    : "0.0";

  // Component SVG Star tái sử dụng (Đảm bảo màu chuẩn)
  const StarIcon = ({ filled, className }: { filled: boolean, className?: string }) => (
    <svg 
        className={`w-3 h-3 ${className} ${filled ? 'text-yellow-400' : 'text-gray-200'}`} 
        fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"
    >
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );

  return (
    <div className="space-y-4">
      {/* Header Thống kê */}
      <div className="flex items-center justify-between gap-4 border-b border-gray-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="text-3xl font-black text-textMain">{avgRating}</div>
          <div>
            <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map(star => (
                    <StarIcon key={star} filled={star <= Math.round(Number(avgRating))} />
                ))}
            </div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                {reviews.length} đánh giá
            </p>
          </div>
        </div>
        
        {/* Nút Viết đánh giá: Chỉ hiện khi chưa đánh giá HOẶC đang muốn đóng form */}
        {currentUser && !hasReviewed && !editingId && (
          <button 
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-primary/5 text-primary text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-primary hover:text-white transition-all shadow-sm"
          >
            {showForm ? 'Đóng' : 'Viết đánh giá'}
          </button>
        )}
      </div>

      {/* --- FORM ĐÁNH GIÁ ĐẦY ĐỦ --- */}
      {showForm && (
        <form id="review-form" onSubmit={handleSubmit} className="bg-bgMain p-5 rounded-2xl space-y-4 animate-fade-in-up border border-gray-100 shadow-inner">
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                {editingId ? 'Sửa đánh giá của bạn' : 'Chất lượng sản phẩm'}
            </label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(s => (
                <button 
                  key={s} 
                  type="button" 
                  onClick={() => setRating(s)} 
                  className="transition-all hover:scale-110 active:scale-95"
                >
                   <svg className={`w-6 h-6 ${s <= rating ? 'text-yellow-400' : 'text-gray-300'}`} fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                </button>
              ))}
            </div>
          </div>
          <textarea 
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Chia sẻ trải nghiệm của bạn..."
            className="w-full bg-white border border-borderMain rounded-xl p-3 text-xs font-medium focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all resize-none"
          />
          <div className="flex gap-2">
            {editingId && (
                <button 
                    type="button"
                    onClick={() => { setEditingId(null); setShowForm(false); setComment(''); setRating(5); }}
                    className="flex-1 bg-gray-100 text-gray-500 font-black py-3 rounded-xl hover:bg-gray-200 transition-all uppercase text-[10px] tracking-widest"
                >
                    Hủy
                </button>
            )}
            <button 
                type="submit" 
                disabled={isSubmitting || !comment.trim()}
                className="flex-1 bg-primary text-white font-black py-3 rounded-xl shadow-lg shadow-primary/20 active:scale-95 disabled:opacity-50 transition-all uppercase text-[10px] tracking-widest hover:bg-primaryHover"
            >
                {isSubmitting ? 'Đang gửi...' : (editingId ? 'Cập nhật' : 'Gửi đánh giá')}
            </button>
          </div>
        </form>
      )}

      {/* Danh sách đánh giá */}
      <div className="space-y-3">
        {reviews.length > 0 ? (
          <>
            {reviews.map(review => (
              <div key={review.id} className={`bg-white border p-4 rounded-2xl shadow-sm transition-all flex gap-3 animate-fade-in group ${review.authorId === currentUser?.id ? 'border-primary/30 bg-primary/5' : 'border-gray-100'}`}>
                <img 
                    src={review.authorAvatar || DEFAULT_AVATAR} 
                    alt="" 
                    className="w-10 h-10 rounded-full flex-shrink-0 shadow-sm object-cover border border-gray-100" 
                    onError={(e) => {e.currentTarget.src = DEFAULT_AVATAR}}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-black text-textMain truncate">
                        {review.authorName} 
                        {review.authorId === currentUser?.id && <span className="ml-2 text-[8px] bg-primary text-white px-1.5 py-0.5 rounded uppercase">Tôi</span>}
                    </h4>
                    
                    {/* MENU SỬA / XÓA (Chỉ hiện cho chính chủ) */}
                    {currentUser && review.authorId === currentUser.id && (
                        <div className="flex gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleEditClick(review)} className="text-gray-400 hover:text-blue-500" title="Sửa">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            </button>
                            <button onClick={() => handleDeleteClick(review.id)} className="text-gray-400 hover:text-red-500" title="Xóa">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                        </div>
                    )}
                    
                    {(!currentUser || review.authorId !== currentUser.id) && (
                        <span className="text-[9px] text-gray-300 font-bold uppercase tracking-wide">{formatTimeAgo(review.createdAt)}</span>
                    )}
                  </div>
                  
                  <div className="flex text-[10px] mt-0.5 mb-1.5 gap-0.5">
                    {[1, 2, 3, 4, 5].map(star => (
                        <StarIcon key={star} filled={star <= review.rating} />
                    ))}
                  </div>
                  
                  <p className="text-xs text-gray-600 leading-relaxed font-medium">{review.comment}</p>
                </div>
              </div>
            ))}

            {/* Nút Xem thêm */}
            {hasMore ? (
                <button 
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="w-full py-3 text-xs font-bold text-gray-500 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all disabled:opacity-50 mt-2"
                >
                    {loadingMore ? 'Đang tải...' : 'Xem thêm đánh giá cũ hơn'}
                </button>
            ) : (
                <p className="text-center text-[10px] text-gray-400 py-4 italic">Đã hiển thị hết danh sách</p>
            )}
          </>
        ) : (
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
