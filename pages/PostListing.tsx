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
    attributes: {} as Record<string, string>
  });

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

  // --- LOGIC: RENDER ĐẦY ĐỦ CÁC TRƯỜNG THEO CHỢ TỐT ---
  const renderDynamicFields = () => {
    const inputStyle = "w-full bg-bgMain border border-borderMain rounded-2xl p-4 font-bold text-sm focus:outline-none focus:border-primary transition-all shadow-sm";
    const labelStyle = "text-[10px] font-black text-gray-400 uppercase tracking-widest px-1";
    const wrapperStyle = "space-y-1.5";

    const updateAttr = (key: string, value: string) => {
      setFormData(prev => ({
        ...prev,
        attributes: { ...prev.attributes, [key]: value }
      }));
    };

    switch (formData.category) {
      case '1': // Bất động sản
        return (
          <div className="grid grid-cols-2 gap-4 animate-fade-in-up">
            <div className={wrapperStyle}>
              <label className={labelStyle}>Diện tích (m²)</label>
              <input type="number" placeholder="50" className={inputStyle} value={formData.attributes.area || ''} onChange={(e) => updateAttr('area', e.target.value)} />
            </div>
            <div className={wrapperStyle}>
              <label className={labelStyle}>Phòng ngủ</label>
              <input type="number" placeholder="2" className={inputStyle} value={formData.attributes.bedrooms || ''} onChange={(e) => updateAttr('bedrooms', e.target.value)} />
            </div>
            <div className={wrapperStyle}>
              <label className={labelStyle}>Hướng nhà</label>
              <select className={inputStyle} value={formData.attributes.direction || ''} onChange={(e) => updateAttr('direction', e.target.value)}>
                <option value="">Chọn hướng</option>
                {['Đông', 'Tây', 'Nam', 'Bắc', 'Đông Bắc', 'Đông Nam', 'Tây Bắc', 'Tây Nam'].map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className={wrapperStyle}>
              <label className={labelStyle}>Pháp lý</label>
              <select className={inputStyle} value={formData.attributes.legal || ''} onChange={(e) => updateAttr('legal', e.target.value)}>
                <option value="">Chọn pháp lý</option>
                {['Sổ đỏ/Sổ hồng', 'Đang chờ sổ', 'Giấy tờ tay'].map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>
        );
      case '2': // Xe cộ
        return (
          <div className="grid grid-cols-2 gap-4 animate-fade-in-up">
            <div className={wrapperStyle}>
              <label className={labelStyle}>Số Km đã đi (ODO)</label>
              <input type="number" placeholder="15000" className={inputStyle} value={formData.attributes.mileage || ''} onChange={(e) => updateAttr('mileage', e.target.value)} />
            </div>
            <div className={wrapperStyle}>
              <label className={labelStyle}>Năm sản xuất</label>
              <input type="number" placeholder="2022" className={inputStyle} value={formData.attributes.year || ''} onChange={(e) => updateAttr('year', e.target.value)} />
            </div>
            <div className={wrapperStyle}>
              <label className={labelStyle}>Hộp số</label>
              <select className={inputStyle} value={formData.attributes.gearbox || ''} onChange={(e) => updateAttr('gearbox', e.target.value)}>
                <option value="">Chọn</option>
                <option value="Số tự động">Số tự động</option>
                <option value="Số sàn">Số sàn</option>
              </select>
            </div>
            <div className={wrapperStyle}>
              <label className={labelStyle}>Nhiên liệu</label>
              <select className={inputStyle} value={formData.attributes.fuel || ''} onChange={(e) => updateAttr('fuel', e.target.value)}>
                <option value="">Chọn</option>
                <option value="Xăng">Xăng</option>
                <option value="Dầu">Dầu</option>
                <option value="Điện">Điện</option>
              </select>
            </div>
          </div>
        );
      case '3': // Đồ điện tử
        return (
          <div className="grid grid-cols-2 gap-4 animate-fade-in-up">
            <div className={wrapperStyle}>
              <label className={labelStyle}>Pin (%)</label>
              <input type="number" placeholder="99" className={inputStyle} value={formData.attributes.battery || ''} onChange={(e) => updateAttr('battery', e.target.value)} />
            </div>
            <div className={wrapperStyle}>
              <label className={labelStyle}>Bộ nhớ (ROM)</label>
              <input type="text" placeholder="256GB" className={inputStyle} value={formData.attributes.storage || ''} onChange={(e) => updateAttr('storage', e.target.value)} />
            </div>
            <div className={wrapperStyle}>
              <label className={labelStyle}>RAM</label>
              <input type="text" placeholder="8GB" className={inputStyle} value={formData.attributes.ram || ''} onChange={(e) => updateAttr('ram', e.target.value)} />
            </div>
            <div className={wrapperStyle}>
              <label className={labelStyle}>Bảo hành</label>
              <input type="text" placeholder="12 tháng" className={inputStyle} value={formData.attributes.warranty || ''} onChange={(e) => updateAttr('warranty', e.target.value)} />
            </div>
          </div>
        );
      case '10': // Điện lạnh
        return (
          <div className="grid grid-cols-2 gap-4 animate-fade-in-up">
            <div className={wrapperStyle}>
              <label className={labelStyle}>Công suất (HP/BTU)</label>
              <input type="text" placeholder="1.5 HP" className={inputStyle} value={formData.attributes.capacity || ''} onChange={(e) => updateAttr('capacity', e.target.value)} />
            </div>
            <div className={wrapperStyle}>
              <label className={labelStyle}>Tiết kiệm điện (Inverter)</label>
              <select className={inputStyle} value={formData.attributes.inverter || ''} onChange={(e) => updateAttr('inverter', e.target.value)}>
                <option value="">Chọn</option>
                <option value="Có">Có</option>
                <option value="Không">Không</option>
              </select>
            </div>
          </div>
        );
      case '11': // Việc làm
        return (
          <div className="grid grid-cols-2 gap-4 animate-fade-in-up">
            <div className={wrapperStyle}>
              <label className={labelStyle}>Mức lương</label>
              <input type="text" placeholder="10 - 15 triệu" className={inputStyle} value={formData.attributes.salary || ''} onChange={(e) => updateAttr('salary', e.target.value)} />
            </div>
            <div className={wrapperStyle}>
              <label className={labelStyle}>Kinh nghiệm</label>
              <input type="text" placeholder="1 năm" className={inputStyle} value={formData.attributes.experience || ''} onChange={(e) => updateAttr('experience', e.target.value)} />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;
    if (files.length + formData.images.length > tierSettings.maxImages) {
      return alert(`Gói ${tierSettings.name} chỉ cho phép tối đa ${tierSettings.maxImages} ảnh.`);
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
    if (results.length > 0) runAIAnalysis(updatedImages);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const runAIAnalysis = async (images: string[]) => {
    const imagesToAnalyze = images.slice(0, 3);
    setAiAnalyzing(true);
    setAiSuccess(false);
    try {
      const analysis = await analyzeListingImages(imagesToAnalyze);
      if (analysis.isProhibited) {
        alert(`🚨 Cảnh báo AI: Tin đăng có thể vi phạm (${analysis.prohibitedReason}).`);
      } else {
        setFormData(prev => ({
          ...prev,
          title: prev.title || analysis.title || '',
          category: prev.category || analysis.category || '',
          price: prev.price || analysis.suggestedPrice?.toString() || '',
          description: prev.description || analysis.description || '',
          condition: analysis.condition || prev.condition,
          attributes: { ...prev.attributes, ...(analysis.attributes || {}) }
        }));
        setAiSuccess(true);
        setTimeout(() => setAiSuccess(false), 3000);
      }
    } catch (err) {
      console.error("AI Error:", err);
    } finally {
      setAiAnalyzing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.category || !formData.price || formData.images.length === 0) {
      return alert('Vui lòng điền đầy đủ thông tin bắt buộc!');
    }
    const priceNumber = parseInt(formData.price.replace(/\D/g, ''));
    if (isNaN(priceNumber) || priceNumber < 0) return alert('Giá bán không hợp lệ!');
    if (!agreedToRules) return alert('Bạn cần đồng ý với Quy tắc cộng đồng.');

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
        attributes: formData.attributes,
        sellerId: user!.id,
        sellerName: user!.name,
        sellerAvatar: user!.avatar || '',
        status: listingStatus,
        tier: userTier,
        createdAt: new Date().toISOString()
      };
      if (locationDetected) {
        listingData.lat = locationDetected.lat;
        listingData.lng = locationDetected.lng;
      }
      await db.saveListing(listingData);
      alert(listingStatus === 'approved' ? "🎉 Thành công!" : "📩 Đang chờ duyệt.");
      navigate('/manage-ads');
    } catch (error) {
      console.error("Save error:", error);
      alert("Đã có lỗi xảy ra.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 px-4 pb-20">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-black text-textMain tracking-tighter">Đăng tin thông minh</h1>
        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em]">AI sẽ phân biệt xe cũ mới, số km và diện tích tự động</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="space-y-6">
          <div className="bg-white border border-borderMain rounded-[2.5rem] p-6 shadow-soft space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-black uppercase tracking-tight">Hình ảnh ({formData.images.length}/{tierSettings.maxImages})</label>
              {aiAnalyzing && <div className="text-[10px] font-bold text-primary animate-pulse">AI Đang quét ảnh...</div>}
              {aiSuccess && <div className="text-[10px] font-bold text-green-500">✨ Đã điền thông số</div>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {formData.images.map((img, i) => (
                <div key={i} className="aspect-square rounded-2xl overflow-hidden border border-borderMain group relative shadow-inner">
                  <img src={img} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => setFormData(p => ({...p, images: p.images.filter((_, idx) => idx !== i)}))} className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1.5 hover:bg-red-500 transition-colors shadow-lg">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
              ))}
              {formData.images.length < tierSettings.maxImages && (
                <button type="button" onClick={() => fileInputRef.current?.click()} className="aspect-square bg-bgMain border-2 border-dashed border-borderMain rounded-2xl flex flex-col items-center justify-center text-gray-400 hover:border-primary hover:text-primary transition-all group">
                  <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center mb-2 group-hover:scale-110 transition-transform"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/></svg></div>
                  <span className="text-[9px] font-black uppercase tracking-widest">Thêm ảnh</span>
                </button>
              )}
            </div>
            <input type="file" ref={fileInputRef} onChange={handleImageUpload} multiple accept="image/*" className="hidden" />
          </div>

          <div className="bg-primary/5 border border-primary/20 rounded-[2.5rem] p-6 space-y-4">
            <h4 className="text-xs font-black text-primary uppercase flex items-center gap-2">🛡️ Quy tắc đăng tin</h4>
            <ul className="space-y-3">
              {['Ảnh thật', 'Giá thật', 'Không hàng cấm', 'Mô tả trung thực'].map(t => (
                <li key={t} className="flex items-center gap-2 text-[10px] text-primary/70 font-black uppercase">✅ {t}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="bg-white border border-borderMain rounded-[2.5rem] p-8 shadow-soft space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Tiêu đề *</label>
              <input type="text" placeholder="Tên sản phẩm..." value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} className="w-full bg-bgMain border border-borderMain rounded-2xl p-4 font-bold text-sm focus:outline-none focus:border-primary transition-all" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Danh mục *</label>
                <select value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value, attributes: {}})} className="w-full bg-bgMain border border-borderMain rounded-2xl p-4 font-bold text-sm appearance-none focus:outline-none focus:border-primary">
                  <option value="">Chọn danh mục</option>
                  {CATEGORIES.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Giá bán (VNĐ) *</label>
                <input type="number" placeholder="0" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} className="w-full bg-bgMain border border-borderMain rounded-2xl p-4 font-bold text-sm focus:outline-none focus:border-primary" />
              </div>
            </div>

            {/* HIỂN THỊ ĐẦY ĐỦ CÁC TRƯỜNG CHI TIẾT */}
            {renderDynamicFields()}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Tình trạng</label>
                <div className="flex gap-2">
                   {['new', 'used'].map(cond => (
                     <button key={cond} type="button" onClick={() => setFormData({...formData, condition: cond as any})} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase border-2 transition-all ${formData.condition === cond ? 'bg-primary border-primary text-white shadow-lg' : 'bg-white border-gray-100 text-gray-400'}`}>{cond === 'new' ? 'Mới' : 'Đã dùng'}</button>
                   ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Khu vực</label>
                <select value={formData.location} onChange={(e) => setFormData({...formData, location: e.target.value})} className="w-full bg-bgMain border border-borderMain rounded-2xl p-4 font-bold text-sm appearance-none focus:outline-none focus:border-primary">{LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}</select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Mô tả chi tiết</label>
              <textarea rows={5} placeholder="Thông tin chi tiết về sản phẩm..." value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className="w-full bg-bgMain border border-borderMain rounded-2xl p-4 text-sm font-medium focus:outline-none focus:border-primary transition-all" />
            </div>

            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
               <input type="checkbox" id="agreed" checked={agreedToRules} onChange={(e) => setAgreedToRules(e.target.checked)} className="w-5 h-5 rounded-lg border-gray-300 text-primary" />
               <label htmlFor="agreed" className="text-[10px] font-bold text-gray-500 cursor-pointer uppercase tracking-tight">Cam kết thông tin chính xác</label>
            </div>

            <button type="submit" disabled={loading || aiAnalyzing} className="w-full bg-primary text-white font-black py-5 rounded-2xl hover:bg-primaryHover transition-all shadow-xl shadow-primary/20 flex items-center justify-center gap-3 disabled:opacity-50 active:scale-95 uppercase tracking-widest text-xs">
              {loading ? <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div> : 'Xác nhận đăng tin'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PostListing;
