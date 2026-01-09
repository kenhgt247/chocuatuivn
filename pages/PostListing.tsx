import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CATEGORIES, LOCATIONS } from '../constants'; 
import { db, SystemSettings } from '../services/db'; // Import SystemSettings
import { User } from '../types';
import { analyzeListingImages } from '../services/geminiService';
import { getLocationFromCoords } from '../utils/locationHelper';
import { compressAndGetBase64 } from '../utils/imageCompression';

interface ListingFormData {
  title: string;
  category: string;
  price: string;
  description: string;
  location: string;
  address: string;
  condition: 'new' | 'used';
  images: string[];
  attributes: Record<string, string>;
}

const PostListing: React.FC<{ user: User | null }> = ({ user }) => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // --- STATE QUẢN LÝ ---
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<SystemSettings | null>(null); // Lưu cấu hình Admin
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiSuccess, setAiSuccess] = useState(false);
  const [locationDetected, setLocationDetected] = useState<{lat: number, lng: number} | null>(null);
  const [agreedToRules, setAgreedToRules] = useState(false);
  
  const [formData, setFormData] = useState<ListingFormData>({
    title: '',
    category: '',
    price: '',
    description: '',
    location: user?.location || 'TPHCM',
    address: user?.address || '',
    condition: 'used',
    images: [],
    attributes: {}
  });

  // --- 1. LOAD SETTINGS & KIỂM TRA ĐĂNG NHẬP ---
  useEffect(() => {
    if (!user) { navigate('/login'); return; }

    const loadInitialData = async () => {
      // Lấy cài đặt từ Admin về để biết user được đăng bao nhiêu tin
      const s = await db.getSettings();
      setSettings(s);
    };
    loadInitialData();

    // Tự động định vị
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;
          setLocationDetected({ lat: latitude, lng: longitude });
          try {
            const info = await getLocationFromCoords(latitude, longitude);
            setFormData(prev => ({
              ...prev,
              location: info.city || prev.location,
              address: info.address || prev.address
            }));
          } catch (e) { console.warn("GPS Address Error"); }
        },
        null,
        { timeout: 10000 }
      );
    }
  }, [user, navigate]);

  // --- 2. LOGIC CHẶN ĐĂNG TIN THEO CÀI ĐẶT ADMIN ---
  const checkDailyLimit = async (tierConfig: any) => {
    if (!user) return false;
    
    // Gọi hàm đếm tin trong ngày từ Database
    const countToday = await db.countUserListingsToday(user.id);
    const limit = tierConfig.postsPerDay || 0;

    // So sánh: Nếu đã đăng >= hạn mức cho phép
    if (countToday >= limit) {
      alert(`⚠️ HẠN MỨC ĐÃ HẾT!\n\nGói "${tierConfig.name}" chỉ được đăng tối đa ${limit} tin/ngày.\nHôm nay bạn đã đăng ${countToday} tin.\n\nVui lòng quay lại vào ngày mai hoặc nâng cấp lên gói cao hơn.`);
      return false;
    }
    return true;
  };

  const updateAttr = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, attributes: { ...prev.attributes, [key]: value } }));
  };

  // --- 3. XỬ LÝ ẢNH (NÉN & KIỂM TRA SỐ LƯỢNG) ---
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0 || !settings) return;
    
    const userTier = user?.subscriptionTier || 'free';
    const tierConfig = (settings.tierConfigs as any)[userTier];

    // Kiểm tra giới hạn ảnh từ Admin
    if (files.length + formData.images.length > tierConfig.maxImages) {
      return alert(`Gói ${tierConfig.name} chỉ cho phép tối đa ${tierConfig.maxImages} ảnh/tin.`);
    }

    try {
        // Nén ảnh trước khi xử lý
        const compressedResults = await Promise.all(files.map(file => compressAndGetBase64(file)));
        const updatedImages = [...formData.images, ...compressedResults];
        setFormData(prev => ({ ...prev, images: updatedImages }));
        
        // Chạy AI nếu có ảnh
        if (compressedResults.length > 0) runAIAnalysis(updatedImages);
    } catch (error) {
        alert("Lỗi xử lý hình ảnh.");
    } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const runAIAnalysis = async (images: string[]) => {
    setAiAnalyzing(true);
    setAiSuccess(false);
    try {
      const analysis = await analyzeListingImages(images.slice(0, 3));
      if (!analysis.isProhibited) {
        setFormData(prev => ({
          ...prev,
          title: prev.title || analysis.title || '',
          category: prev.category || analysis.category || '',
          price: prev.price || analysis.suggestedPrice?.toString() || '',
          description: prev.description || analysis.description || '',
          condition: (analysis.condition as 'new' | 'used') || prev.condition,
          attributes: { ...prev.attributes, ...(analysis.attributes || {}) }
        }));
        setAiSuccess(true);
        setTimeout(() => setAiSuccess(false), 3000);
      } else {
        alert(`🚨 Cảnh báo nội dung: ${analysis.prohibitedReason}`);
      }
    } catch (err) { console.error("AI Error"); }
    finally { setAiAnalyzing(false); }
  };

  // --- 4. RENDER CÁC TRƯỜNG NHẬP LIỆU ĐỘNG ---
  const renderDynamicFields = () => {
    switch (formData.category) {
      case '1': return <div className="grid grid-cols-2 gap-4"><div className="space-y-1"><label className="text-[10px] uppercase font-bold text-gray-400">Diện tích (m²)</label><input type="number" value={formData.attributes.area || ''} onChange={e=>updateAttr('area',e.target.value)} className={inputStyle} /></div><div className="space-y-1"><label className="text-[10px] uppercase font-bold text-gray-400">Phòng ngủ</label><input type="number" value={formData.attributes.bedrooms || ''} onChange={e=>updateAttr('bedrooms',e.target.value)} className={inputStyle} /></div></div>;
      case '2': return <div className="grid grid-cols-2 gap-4"><div className="space-y-1"><label className="text-[10px] uppercase font-bold text-gray-400">Số Km (ODO)</label><input type="number" value={formData.attributes.mileage || ''} onChange={e=>updateAttr('mileage',e.target.value)} className={inputStyle} /></div><div className="space-y-1"><label className="text-[10px] uppercase font-bold text-gray-400">Năm SX</label><input type="number" value={formData.attributes.year || ''} onChange={e=>updateAttr('year',e.target.value)} className={inputStyle} /></div></div>;
      case '3': return <div className="grid grid-cols-2 gap-4"><div className="space-y-1"><label className="text-[10px] uppercase font-bold text-gray-400">Dung lượng</label><input type="text" value={formData.attributes.storage || ''} onChange={e=>updateAttr('storage',e.target.value)} className={inputStyle} /></div><div className="space-y-1"><label className="text-[10px] uppercase font-bold text-gray-400">Pin (%)</label><input type="number" value={formData.attributes.battery || ''} onChange={e=>updateAttr('battery',e.target.value)} className={inputStyle} /></div></div>;
      default: return null;
    }
  };

  // --- 5. SUBMIT FORM (CHỐT CHẶN CUỐI CÙNG) ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !settings) return;

    const userTier = user.subscriptionTier || 'free';
    const tierConfig = (settings.tierConfigs as any)[userTier];

    // BƯỚC 1: KIỂM TRA HẠN MỨC TIN ĐĂNG NGAY LẬP TỨC
    const canPost = await checkDailyLimit(tierConfig);
    if (!canPost) return; // Nếu hàm trả về false -> Dừng ngay, không làm gì nữa

    // BƯỚC 2: VALIDATE DỮ LIỆU
    if (!formData.title.trim() || !formData.category || !formData.price || formData.images.length === 0) {
      return alert('Vui lòng điền đầy đủ Tiêu đề, Danh mục, Giá và Hình ảnh!');
    }
    const priceNumber = parseInt(formData.price.replace(/\D/g, ''));
    if (isNaN(priceNumber) || priceNumber < 0) return alert("Giá không hợp lệ");
    if (!agreedToRules) return alert('Bạn cần cam kết thông tin chính xác.');

    setLoading(true);
    try {
      // Upload ảnh
      const uploadedUrls = await Promise.all(
        formData.images.map((base64, index) => 
          db.uploadImage(base64, `listings/${user.id}/${Date.now()}_${index}.jpg`)
        )
      );

      // BƯỚC 3: XÉT DUYỆT DỰA TRÊN CÀI ĐẶT ADMIN (autoApprove)
      const listingStatus = tierConfig.autoApprove ? 'approved' : 'pending';

      const listingData: any = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        price: priceNumber,
        category: formData.category,
        images: uploadedUrls,
        location: formData.location, 
        address: formData.address,
        condition: formData.condition,
        attributes: formData.attributes,
        sellerId: user.id,
        sellerName: user.name,
        sellerAvatar: user.avatar || '',
        status: listingStatus,
        tier: userTier,
        createdAt: new Date().toISOString()
      };
      
      if (locationDetected) {
        listingData.lat = locationDetected.lat;
        listingData.lng = locationDetected.lng;
      }
      
      await db.saveListing(listingData);
      
      if (listingStatus === 'approved') {
          alert("🎉 ĐĂNG TIN THÀNH CÔNG!\nTin của bạn đã được hiển thị ngay lập tức.");
      } else {
          alert("📩 ĐÃ GỬI TIN!\nTin đăng đang chờ Admin duyệt (Thời gian duyệt: 15-30p).");
      }
      navigate('/manage-ads');
    } catch (error) {
      alert("Lỗi hệ thống khi đăng tin.");
    } finally {
      setLoading(false);
    }
  };

  // --- UI Styles ---
  const inputStyle = "w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-bold text-sm focus:ring-2 ring-primary/20 focus:border-primary outline-none transition-all shadow-sm";
  const labelStyle = "text-[10px] font-black text-slate-400 uppercase tracking-[0.1em] px-1";

  if (!settings) return <div className="h-96 flex items-center justify-center font-black text-primary animate-pulse uppercase tracking-widest">Đang tải cấu hình...</div>;

  const currentTierConfig = (settings.tierConfigs as any)[user?.subscriptionTier || 'free'];

  return (
    <div className="max-w-6xl mx-auto space-y-8 px-4 pb-20 pt-10 font-sans">
      <div className="text-center space-y-3">
        <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Đăng tin mới</h1>
        <div className="flex justify-center gap-2">
            <span className="bg-slate-100 text-slate-500 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider border border-slate-200">
                Gói: {currentTierConfig.name}
            </span>
            <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider border ${currentTierConfig.postsPerDay > 20 ? 'bg-yellow-50 text-yellow-600 border-yellow-200' : 'bg-primary/10 text-primary border-primary/20'}`}>
                Hạn mức: {currentTierConfig.postsPerDay >= 900 ? 'Không giới hạn' : `${currentTierConfig.postsPerDay} tin/ngày`}
            </span>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-10">
        {/* CỘT TRÁI: HÌNH ẢNH */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white border border-slate-100 rounded-[3rem] p-8 shadow-xl shadow-slate-100 space-y-6">
            <div className="flex items-center justify-between">
              <label className="text-sm font-black uppercase text-slate-800">Hình ảnh ({formData.images.length}/{currentTierConfig.maxImages})</label>
              {aiAnalyzing && <div className="text-[10px] font-bold text-primary animate-bounce">AI Quét ảnh...</div>}
              {aiSuccess && <div className="text-[10px] font-bold text-green-500 animate-fade-in-up">✨ Xong!</div>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {formData.images.map((img, i) => (
                <div key={i} className="aspect-square rounded-[1.5rem] overflow-hidden border border-slate-100 relative group shadow-inner">
                  <img src={img} className="w-full h-full object-cover transition-transform group-hover:scale-110" alt="" />
                  <button type="button" onClick={() => setFormData(p => ({...p, images: p.images.filter((_, idx) => idx !== i)}))} className="absolute top-2 right-2 bg-slate-900/80 text-white rounded-full p-2 hover:bg-red-500 transition-colors shadow-lg">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
              ))}
              {formData.images.length < currentTierConfig.maxImages && (
                <button type="button" onClick={() => fileInputRef.current?.click()} className="aspect-square bg-slate-50 border-2 border-dashed border-slate-200 rounded-[1.5rem] flex flex-col items-center justify-center text-slate-400 hover:border-primary hover:text-primary transition-all group">
                  <div className="w-12 h-12 rounded-2xl bg-white shadow-md flex items-center justify-center mb-3 group-hover:scale-110 transition-transform"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/></svg></div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Tải ảnh</span>
                </button>
              )}
            </div>
            <input type="file" ref={fileInputRef} onChange={handleImageUpload} multiple accept="image/*" className="hidden" />
            <p className="text-[10px] text-slate-400 font-bold text-center uppercase tracking-tighter">AI sẽ tự động nhận diện sản phẩm qua 3 ảnh đầu</p>
          </div>

          <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white space-y-4 shadow-2xl shadow-slate-200">
            <h4 className="text-xs font-black uppercase text-primary tracking-widest">Quy định Chợ Của Tui</h4>
            <ul className="space-y-4">
              {['Ảnh thật, không copy', 'Mô tả rõ tình trạng', 'Giá bán minh bạch', 'Địa chỉ giao dịch rõ ràng'].map(t => (
                <li key={t} className="flex items-center gap-3 text-[11px] font-bold text-slate-300 uppercase"><span className="text-primary text-lg">✦</span> {t}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* CỘT PHẢI: FORM DỮ LIỆU */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="bg-white border border-slate-100 rounded-[3rem] p-10 shadow-2xl shadow-slate-100 space-y-8">
            <div className="space-y-2">
              <label className={labelStyle}>Tiêu đề tin đăng *</label>
              <input type="text" placeholder="Ví dụ: iPhone 15 Pro Max 256GB còn bảo hành..." value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} className={inputStyle} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className={labelStyle}>Danh mục sản phẩm *</label>
                <select value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value, attributes: {}})} className={inputStyle}>
                  <option value="">Chọn một danh mục</option>
                  {CATEGORIES.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className={labelStyle}>Giá bán mong muốn (VNĐ) *</label>
                <input type="number" placeholder="0" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} className={`${inputStyle} text-primary text-lg`} />
              </div>
            </div>

            {/* Render các trường thuộc tính động dựa trên danh mục */}
            {formData.category && (
                <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 animate-fade-in-up">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-4 text-center tracking-widest">Thông số chi tiết</p>
                    {renderDynamicFields()}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className={labelStyle}>Tình trạng hàng hóa</label>
                <div className="flex gap-3">
                   {['new', 'used'].map(cond => (
                     <button key={cond} type="button" onClick={() => setFormData({...formData, condition: cond as 'new' | 'used'})} className={`flex-1 py-4 rounded-2xl text-[11px] font-black uppercase border-2 transition-all ${formData.condition === cond ? 'bg-slate-900 border-slate-900 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400'}`}>{cond === 'new' ? '💎 Mới' : '⌛ Đã dùng'}</button>
                   ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className={labelStyle}>Khu vực giao dịch</label>
                <select value={formData.location} onChange={(e) => setFormData({...formData, location: e.target.value})} className={inputStyle}>
                    {LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-2">
                <div className="flex justify-between px-1">
                    <label className={labelStyle}>Địa chỉ chi tiết (Hiện trên bản đồ)</label>
                    <button type="button" onClick={() => {
                        if(navigator.geolocation) {
                            navigator.geolocation.getCurrentPosition(async (pos) => {
                                const {latitude, longitude} = pos.coords;
                                setLocationDetected({lat: latitude, lng: longitude});
                                const info = await getLocationFromCoords(latitude, longitude);
                                setFormData(p => ({...p, address: info.address, location: info.city}));
                            });
                        }
                    }} className="text-[10px] font-black text-primary uppercase hover:underline flex items-center gap-1">📍 Lấy vị trí hiện tại</button>
                </div>
                <textarea 
                  value={formData.address} 
                  onChange={(e) => setFormData({...formData, address: e.target.value})} 
                  placeholder="Số nhà, tên đường, phường xã..."
                  className={`${inputStyle} h-24 resize-none`}
                />
            </div>

            <div className="space-y-2">
              <label className={labelStyle}>Mô tả sản phẩm</label>
              <textarea rows={6} placeholder="Hãy mô tả thật chi tiết để người mua tin tưởng bạn hơn..." value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className={inputStyle} />
            </div>

            <div className="flex items-center gap-4 p-5 bg-primary/5 rounded-[1.5rem] border border-primary/10">
               <input type="checkbox" id="agreed" checked={agreedToRules} onChange={(e) => setAgreedToRules(e.target.checked)} className="w-6 h-6 rounded-lg border-slate-200 text-primary focus:ring-0" />
               <label htmlFor="agreed" className="text-[11px] font-bold text-slate-600 cursor-pointer uppercase tracking-tight">Tôi cam kết nội dung đúng sự thật và chịu trách nhiệm trước pháp luật</label>
            </div>

            <button type="submit" disabled={loading || aiAnalyzing} className="w-full bg-primary text-white font-black py-6 rounded-[2rem] hover:bg-slate-900 transition-all shadow-2xl shadow-primary/30 flex items-center justify-center gap-4 active:scale-[0.98] uppercase tracking-[0.2em] text-sm">
              {loading ? <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div> : (
                  <>
                    <span>Xác nhận đăng tin</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
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
