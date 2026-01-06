import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CATEGORIES, LOCATIONS, TIER_CONFIG } from '../constants';
import { db } from '../services/db';
import { User } from '../types';
import { analyzeListingImages } from '../services/geminiService';

const PostListing: React.FC<{ user: User | null }> = ({ user }) => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [loading, setLoading] = useState(false);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiSuccess, setAiSuccess] = useState(false);
  
  // Lưu tọa độ, mặc định null
  const [locationDetected, setLocationDetected] = useState<{lat: number, lng: number} | null>(null);
  const [agreedToRules, setAgreedToRules] = useState(false);
  
  const userTier = user?.subscriptionTier || 'free';
  const tierSettings = TIER_CONFIG[userTier as keyof typeof TIER_CONFIG];

  const [formData, setFormData] = useState({
    title: '',
    category: '',
    price: '',
    description: '',
    location: user?.location || 'TPHCM',
    condition: 'used' as 'new' | 'used',
    images: [] as string[],
    // --- MỚI: Thuộc tính để chứa thông số cứng (Pin, Km, Diện tích...) ---
    attributes: {} as Record<string, string>
  });

  // --- 1. KIỂM TRA LOGIN & LẤY VỊ TRÍ ---
  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocationDetected({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          });
        },
        (err) => {
          console.warn("⚠️ Không thể lấy vị trí GPS:", err.message);
        },
        { timeout: 10000, enableHighAccuracy: true }
      );
    }
  }, [user, navigate]);

  // --- LOGIC MỚI: HIỂN THỊ CÁC TRƯỜNG THÔNG TIN ĐỘNG THEO DANH MỤC ---
  const renderDynamicFields = () => {
    switch (formData.category) {
      case '1': // Bất động sản
        return (
          <div className="space-y-2 animate-fade-in-up">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Diện tích (m²)</label>
            <input 
              type="number" 
              placeholder="Ví dụ: 50"
              value={formData.attributes.area || ''}
              onChange={(e) => setFormData({...formData, attributes: {...formData.attributes, area: e.target.value}})}
              className="w-full bg-bgMain border border-borderMain rounded-2xl p-4 font-bold text-sm focus:outline-none focus:border-primary transition-all"
            />
          </div>
        );
      case '2': // Xe cộ
        return (
          <div className="space-y-2 animate-fade-in-up">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Số Km đã đi (Km)</label>
            <input 
              type="number" 
              placeholder="Ví dụ: 15000"
              value={formData.attributes.mileage || ''}
              onChange={(e) => setFormData({...formData, attributes: {...formData.attributes, mileage: e.target.value}})}
              className="w-full bg-bgMain border border-borderMain rounded-2xl p-4 font-bold text-sm focus:outline-none focus:border-primary transition-all"
            />
          </div>
        );
      case '3': // Đồ điện tử
        return (
          <div className="grid grid-cols-2 gap-4 animate-fade-in-up">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Pin (%)</label>
              <input 
                type="number" 
                placeholder="Ví dụ: 99"
                value={formData.attributes.battery || ''}
                onChange={(e) => setFormData({...formData, attributes: {...formData.attributes, battery: e.target.value}})}
                className="w-full bg-bgMain border border-borderMain rounded-2xl p-4 font-bold text-sm focus:outline-none focus:border-primary transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Bộ nhớ</label>
              <input 
                type="text" 
                placeholder="Ví dụ: 256GB"
                value={formData.attributes.storage || ''}
                onChange={(e) => setFormData({...formData, attributes: {...formData.attributes, storage: e.target.value}})}
                className="w-full bg-bgMain border border-borderMain rounded-2xl p-4 font-bold text-sm focus:outline-none focus:border-primary transition-all"
              />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  // --- 2. XỬ LÝ ẢNH & AI ---
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;

    if (files.length + formData.images.length > tierSettings.maxImages) {
      return alert(`Gói ${tierSettings.name} chỉ cho phép đăng tối đa ${tierSettings.maxImages} ảnh.`);
    }

    const readPromises = files.map(file => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    });

    const results = await Promise.all(readPromises);
    const updatedImages = [...formData.images, ...results];
    setFormData(prev => ({ ...prev, images: updatedImages }));

    if (results.length > 0) {
      runAIAnalysis(updatedImages);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const runAIAnalysis = async (images: string[]) => {
    const imagesToAnalyze = images.slice(0, 3);
    setAiAnalyzing(true);
    setAiSuccess(false);

    try {
      const analysis = await analyzeListingImages(imagesToAnalyze);
      if (analysis.isProhibited) {
        alert(`🚨 Cảnh báo AI: Tin đăng có thể vi phạm chính sách (${analysis.prohibitedReason}). Vui lòng kiểm tra lại.`);
      } else {
        setFormData(prev => ({
          ...prev,
          title: prev.title ? prev.title : (analysis.title || ''),
          category: prev.category ? prev.category : (analysis.category || prev.category),
          price: prev.price ? prev.price : (analysis.suggestedPrice?.toString() || ''),
          description: prev.description ? prev.description : (analysis.description || ''),
          condition: analysis.condition || prev.condition,
          // --- MỚI: Tự động gán thông số bóc tách từ AI vào attributes ---
          attributes: {
            ...prev.attributes,
            ...(analysis.attributes || {})
          }
        }));
        setAiSuccess(true);
        setTimeout(() => setAiSuccess(false), 3000);
      }
    } catch (err) {
      console.error("❌ AI Analysis failed:", err);
    } finally {
      setAiAnalyzing(false);
    }
  };

  // --- 3. SUBMIT FORM ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim() || !formData.category || !formData.price || formData.images.length === 0) {
      return alert('Vui lòng điền đầy đủ thông tin và tải ít nhất 1 ảnh!');
    }
    
    const priceNumber = parseInt(formData.price.replace(/\D/g, ''));
    if (isNaN(priceNumber) || priceNumber < 0) {
      return alert('Giá bán không hợp lệ!');
    }

    if (!agreedToRules) {
      return alert('Vui lòng xác nhận bạn đã đọc và đồng ý với Quy tắc cộng đồng.');
    }

    setLoading(true);
    try {
      const uploadedUrls = await Promise.all(
        formData.images.map((base64, index) => 
          db.uploadImage(base64, `listings/${user!.id}/${Date.now()}_${index}.jpg`)
        )
      );

      const listingStatus = userTier === 'free' ? 'pending' : 'approved';

      const listingData: any = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        price: priceNumber,
        category: formData.category,
        images: uploadedUrls,
        location: formData.location,
        condition: formData.condition,
        // --- MỚI: Gửi attributes lên DB ---
        attributes: formData.attributes,
        sellerId: user!.id,
        sellerName: user!.name,
        sellerAvatar: user!.avatar || '',
        status: listingStatus,
        tier: userTier,
        createdAt: new Date().toISOString()
      };

      if (locationDetected?.lat && locationDetected?.lng) {
        listingData.lat = locationDetected.lat;
        listingData.lng = locationDetected.lng;
      }

      await db.saveListing(listingData);

      if (listingStatus === 'approved') {
        alert("🎉 Chúc mừng! Tin đăng của bạn đã được duyệt tự động.");
      } else {
        alert("📩 Tin đăng đã gửi duyệt! Vui lòng chờ Admin kiểm tra.");
      }
      
      navigate('/manage-ads');
    } catch (error) {
      console.error("Save error:", error);
      alert("Đã có lỗi xảy ra khi lưu tin. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 px-4 pb-20">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-black text-textMain">Đăng tin thông minh</h1>
        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest px-4">AI sẽ tự động soạn tin từ hình ảnh của bạn giúp tiết kiệm thời gian</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left: Image Upload & AI Status */}
        <div className="space-y-6">
          <div className="bg-white border border-borderMain rounded-[2.5rem] p-6 shadow-soft space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-black uppercase tracking-tight">Hình ảnh ({formData.images.length}/{tierSettings.maxImages})</label>
              {aiAnalyzing && (
                <div className="flex items-center gap-2 text-[10px] font-bold text-primary animate-pulse">
                  <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  AI Đang phân tích...
                </div>
              )}
              {aiSuccess && <div className="text-[10px] font-bold text-green-500 flex items-center gap-1">✨ AI đã điền mẫu</div>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {formData.images.map((img, i) => (
                <div key={i} className="aspect-square rounded-2xl overflow-hidden border border-borderMain group relative">
                  <img src={img} alt="" className="w-full h-full object-cover" />
                  <button 
                    type="button" 
                    onClick={() => setFormData(p => ({...p, images: p.images.filter((_, idx) => idx !== i)}))}
                    className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1.5 hover:bg-red-500 transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
              ))}
              {formData.images.length < tierSettings.maxImages && (
                <button 
                  type="button" 
                  onClick={() => fileInputRef.current?.click()} 
                  className="aspect-square bg-bgMain border-2 border-dashed border-borderMain rounded-2xl flex flex-col items-center justify-center text-gray-400 hover:border-primary hover:text-primary transition-all group"
                >
                  <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/></svg>
                  </div>
                  <span className="text-[10px] font-black uppercase">Thêm ảnh</span>
                </button>
              )}
            </div>
            <input type="file" ref={fileInputRef} onChange={handleImageUpload} multiple accept="image/*" className="hidden" />
          </div>

          {/* Quy tắc cộng đồng */}
          <div className="bg-primary/5 border border-primary/20 rounded-[2.5rem] p-6 space-y-4">
            <h4 className="text-xs font-black text-primary uppercase flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
              Quy tắc đăng tin
            </h4>
            <ul className="space-y-3">
              {[
                { icon: '📸', text: 'Phải sử dụng hình ảnh thật.' },
                { icon: '🛡️', text: 'Không đăng hàng cấm.' },
                { icon: '🏷️', text: 'Giá bán phải minh bạch.' },
                { icon: '📝', text: 'Mô tả rõ ràng tình trạng.' }
              ].map((rule, i) => (
                <li key={i} className="flex gap-2 text-[10px] text-primary/70 font-bold leading-relaxed">
                  <span>{rule.icon}</span>
                  {rule.text}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right: Form Data */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="bg-white border border-borderMain rounded-[2.5rem] p-8 shadow-soft space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Tiêu đề tin đăng <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                placeholder="Ví dụ: iPhone 15 Pro Max 256GB mới 99%..."
                value={formData.title} 
                onChange={(e) => setFormData({...formData, title: e.target.value})} 
                className={`w-full bg-bgMain border rounded-2xl p-4 font-bold text-sm focus:outline-none focus:border-primary transition-all ${aiSuccess ? 'border-green-300 ring-4 ring-green-50 shadow-inner' : 'border-borderMain'}`} 
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Danh mục <span className="text-red-500">*</span></label>
                <select 
                  value={formData.category} 
                  onChange={(e) => setFormData({...formData, category: e.target.value, attributes: {}})} 
                  className={`w-full bg-bgMain border rounded-2xl p-4 font-bold text-sm appearance-none cursor-pointer focus:outline-none focus:border-primary transition-all ${aiSuccess ? 'border-green-300' : 'border-borderMain'}`}
                >
                  <option value="">Chọn danh mục</option>
                  {CATEGORIES.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Giá bán (VNĐ) <span className="text-red-500">*</span></label>
                <input 
                  type="number" 
                  placeholder="0"
                  min="0"
                  value={formData.price} 
                  onChange={(e) => setFormData({...formData, price: e.target.value})} 
                  className={`w-full bg-bgMain border rounded-2xl p-4 font-bold text-sm focus:outline-none focus:border-primary transition-all ${aiSuccess ? 'border-green-300' : 'border-borderMain'}`} 
                />
              </div>
            </div>

            {/* HIỂN THỊ CÁC TRƯỜNG ĐỘNG (DIỆN TÍCH, KM, PIN...) */}
            {renderDynamicFields()}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Tình trạng</label>
                <div className="flex gap-2">
                   {['new', 'used'].map(cond => (
                     <button
                       key={cond}
                       type="button"
                       onClick={() => setFormData({...formData, condition: cond as any})}
                       className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase border-2 transition-all ${formData.condition === cond ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' : 'bg-white border-gray-100 text-gray-400'}`}
                     >
                       {cond === 'new' ? 'Mới' : 'Đã sử dụng'}
                     </button>
                   ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Khu vực</label>
                <select 
                  value={formData.location} 
                  onChange={(e) => setFormData({...formData, location: e.target.value})} 
                  className="w-full bg-bgMain border border-borderMain rounded-2xl p-4 font-bold text-sm appearance-none cursor-pointer focus:outline-none focus:border-primary"
                >
                  {LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Mô tả chi tiết</label>
              <textarea 
                rows={5} 
                placeholder="Mô tả đặc điểm nổi bật, tình trạng bảo hành..."
                value={formData.description} 
                onChange={(e) => setFormData({...formData, description: e.target.value})} 
                className={`w-full bg-bgMain border rounded-2xl p-4 text-sm font-medium focus:outline-none focus:border-primary transition-all ${aiSuccess ? 'border-green-300' : 'border-borderMain'}`} 
              />
            </div>

            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
               <input 
                 type="checkbox" 
                 id="agreed" 
                 checked={agreedToRules} 
                 onChange={(e) => setAgreedToRules(e.target.checked)}
                 className="w-5 h-5 rounded-lg border-gray-300 text-primary focus:ring-primary"
               />
               <label htmlFor="agreed" className="text-xs font-bold text-gray-500 cursor-pointer select-none">
                 Tôi cam kết thông tin đăng tải là chính xác và tuân thủ <span className="text-primary underline">Quy tắc cộng đồng</span>.
               </label>
            </div>

            <button 
              type="submit" 
              disabled={loading || aiAnalyzing} 
              className="w-full bg-primary text-white font-black py-5 rounded-2xl hover:bg-primaryHover transition-all shadow-xl shadow-primary/20 flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
                  Xác nhận đăng tin
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PostListing;
