import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { CATEGORIES, LOCATIONS } from '../constants'; 
import { db, SystemSettings } from '../services/db'; 
import { User } from '../types';
import { analyzeListingImages } from '../services/geminiService';
import { getLocationFromCoords } from '../utils/locationHelper';
import { compressAndGetBase64 } from '../utils/imageCompression';
import { crawlLinkMetadata } from '../utils/crawler';

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
  affiliateLink?: string;
}

const PostListing: React.FC<{ user: User | null }> = ({ user }) => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // --- STATE ---
  const [listingType, setListingType] = useState<'normal' | 'affiliate'>('normal');
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiSuccess, setAiSuccess] = useState(false);
  
  // State riêng cho Affiliate
  const [affiliateLinkInput, setAffiliateLinkInput] = useState('');
  const [isCrawling, setIsCrawling] = useState(false);
  const [manualAffiliateMode, setManualAffiliateMode] = useState(false); 
  
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

  const inputStyle = "w-full bg-white border border-gray-200 rounded-2xl p-4 font-bold text-sm focus:outline-none focus:border-primary transition-all shadow-sm";
  const labelStyle = "text-[10px] font-black text-gray-400 uppercase tracking-widest px-1";
  const wrapperStyle = "space-y-1.5";

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    const loadInitialData = async () => {
      const s = await db.getSettings();
      setSettings(s);
    };
    loadInitialData();
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;
          setLocationDetected({ lat: latitude, lng: longitude });
          try {
            const info = await getLocationFromCoords(latitude, longitude);
            setFormData(prev => ({ ...prev, location: info.city || prev.location, address: info.address || prev.address }));
          } catch (e) { console.warn("GPS Address Error"); }
        }, null, { timeout: 10000 }
      );
    }
  }, [user, navigate]);

  const handleManualLocate = () => {
    if (!navigator.geolocation) return alert("Trình duyệt không hỗ trợ GPS");
    navigator.geolocation.getCurrentPosition(
        async (pos) => {
            const { latitude, longitude } = pos.coords;
            setLocationDetected({ lat: latitude, lng: longitude });
            try {
                const info = await getLocationFromCoords(latitude, longitude);
                setFormData(prev => ({ ...prev, location: info.city || prev.location, address: info.address || prev.address }));
            } catch (e) { alert("Không thể lấy tên đường chi tiết."); }
        },
        () => alert("Vui lòng bật quyền truy cập vị trí."),
        { enableHighAccuracy: true }
    );
  };

  const checkDailyLimit = async (tierConfig: any) => {
    if (!user) return false;
    const countToday = await db.countUserListingsToday(user.id);
    const limit = tierConfig.postsPerDay || 0;
    if (countToday >= limit) {
      alert(`⚠️ HẠN MỨC ĐÃ HẾT!\n\nGói "${tierConfig.name}" chỉ được đăng tối đa ${limit} tin/ngày.`);
      return false;
    }
    return true;
  };

  const updateAttr = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, attributes: { ...prev.attributes, [key]: value } }));
  };

  const handleFetchLink = async () => {
      if (!affiliateLinkInput) return alert("Vui lòng nhập link sản phẩm!");
      
      setIsCrawling(true);
      setManualAffiliateMode(false); 
      
      const res = await crawlLinkMetadata(affiliateLinkInput);
      setIsCrawling(false);
      
      if (res.success && res.data) {
          setFormData(prev => ({
              ...prev,
              title: res.data.title,
              images: [res.data.image], 
              affiliateLink: res.data.url, 
              description: prev.description || 'Sản phẩm tiếp thị liên kết chính hãng.',
              attributes: { ...prev.attributes, brand: res.data.brand || 'Affiliate' }
          }));
          alert("✅ Đã lấy thông tin thành công!");
      } else {
          setManualAffiliateMode(true);
          setFormData(prev => ({ ...prev, affiliateLink: affiliateLinkInput })); 
          alert("⚠️ Trang web này chặn tính năng lấy tin tự động.\n\nĐừng lo! Bạn có thể tải ảnh lên và nhập tiêu đề thủ công bên dưới.");
      }
  };

  const renderDynamicFields = () => {
    // ... Copy lại đoạn switch case cũ vào đây ...
    return null; 
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0 || !settings) return;
    
    const userTier = user?.subscriptionTier || 'free';
    const tierConfig = (settings.tierConfigs as any)[userTier];

    if (files.length + formData.images.length > tierConfig.maxImages) {
      return alert(`Gói ${tierConfig.name} chỉ cho phép tối đa ${tierConfig.maxImages} ảnh.`);
    }

    try {
        const compressedResults = await Promise.all(files.map(file => compressAndGetBase64(file)));
        const updatedImages = [...formData.images, ...compressedResults];
        setFormData(prev => ({ ...prev, images: updatedImages }));
        if (compressedResults.length > 0 && listingType === 'normal') runAIAnalysis(updatedImages);
    } catch (error) { alert("Lỗi xử lý ảnh."); } 
    finally { if (fileInputRef.current) fileInputRef.current.value = ''; }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !settings) return;

    const userTier = user.subscriptionTier || 'free';
    const tierConfig = (settings.tierConfigs as any)[userTier];

    const canPost = await checkDailyLimit(tierConfig);
    if (!canPost) return;

    if (!formData.title.trim() || !formData.category || !formData.price || formData.images.length === 0) {
      return alert('Vui lòng điền đủ thông tin: Tiêu đề, Danh mục, Giá, Ảnh!');
    }
    
    if (listingType === 'affiliate' && !formData.affiliateLink) {
        return alert('Vui lòng nhập Link tiếp thị liên kết.');
    }

    const priceNumber = parseInt(formData.price.replace(/\D/g, ''));
    if (isNaN(priceNumber) || priceNumber < 0) return alert('Giá bán không hợp lệ!');
    if (!agreedToRules) return alert('Bạn cần đồng ý với quy tắc cộng đồng.');

    setLoading(true);
    try {
      let uploadedUrls = formData.images;
      
      if (listingType === 'normal' || manualAffiliateMode) {
          uploadedUrls = await Promise.all(
            formData.images.map((base64, index) => 
              base64.startsWith('http') ? base64 : db.uploadImage(base64, `listings/${user.id}/${Date.now()}_${index}.jpg`)
            )
          );
      }

      const listingStatus = (listingType === 'affiliate' || tierConfig.autoApprove) ? 'approved' : 'pending';
      
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
        tier: listingType === 'affiliate' ? 'pro' : userTier, 
        affiliateLink: listingType === 'affiliate' ? (formData.affiliateLink || affiliateLinkInput) : undefined,
        createdAt: new Date().toISOString()
      };
      
      if (locationDetected) {
        listingData.lat = locationDetected.lat;
        listingData.lng = locationDetected.lng;
      }
      
      await db.saveListing(listingData);
      
      alert(listingStatus === 'approved' ? "🎉 Thành công! Tin đã được đăng." : "📩 Tin đăng thành công và đang chờ duyệt.");
      navigate('/manage-ads');
    } catch (error) {
      alert("Đã có lỗi xảy ra. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  if (!settings) return <div className="h-96 flex items-center justify-center font-black text-primary animate-pulse uppercase tracking-widest">Đang tải cấu hình...</div>;

  const currentTierConfig = (settings.tierConfigs as any)[user?.subscriptionTier || 'free'];
  const isVip = user?.subscriptionTier === 'pro';

  return (
    <div className="max-w-5xl mx-auto space-y-8 px-4 pb-20 pt-8 font-sans">
      
      {/* HEADER SECTION (ĐƯỢC NÂNG CẤP) */}
      <div className="text-center space-y-3 mb-8">
        <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase">Đăng Tin Rao Vặt</h1>
        
        {/* Badge Gói Thành Viên Sang Trọng */}
        <div className="flex justify-center">
            <div className={`
                relative inline-flex items-center gap-2 px-6 py-2 rounded-full border-2 
                ${isVip ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-300 text-yellow-700 shadow-yellow-100' : 'bg-slate-50 border-slate-200 text-slate-600'}
                shadow-lg transition-all hover:scale-105 cursor-pointer
            `} onClick={() => navigate('/upgrade')}>
                <span className="text-xl">{isVip ? '👑' : '💎'}</span>
                <div className="flex flex-col items-start">
                    <span className="text-[9px] font-black uppercase opacity-60 leading-none">Thành viên</span>
                    <span className="text-xs font-black uppercase tracking-widest">{currentTierConfig.name}</span>
                </div>
                {!isVip && <span className="ml-2 text-[9px] font-bold bg-primary text-white px-2 py-0.5 rounded-md animate-pulse">Nâng cấp</span>}
            </div>
        </div>
      </div>

      {/* --- THANH CHUYỂN ĐỔI CHẾ ĐỘ (TAB SWITCHER) --- */}
      <div className="bg-slate-100 p-1.5 rounded-2xl flex max-w-lg mx-auto shadow-inner border border-slate-200">
          <button 
             type="button"
             onClick={() => { 
                 setListingType('normal'); 
                 setManualAffiliateMode(false);
                 setFormData(prev => ({...prev, title: '', price: '', images: [], affiliateLink: undefined})); 
             }}
             className={`flex-1 py-4 rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center gap-2 ${listingType === 'normal' ? 'bg-white shadow-md text-primary scale-[1.02] ring-1 ring-black/5' : 'text-slate-400 hover:bg-slate-200 hover:text-slate-600'}`}
          >
             <span className="text-lg">📦</span> ĐĂNG BÁN SẢN PHẨM
          </button>
          <button 
             type="button"
             onClick={() => { 
                 setListingType('affiliate'); 
                 setFormData(prev => ({...prev, title: '', price: '', images: []})); 
             }}
             className={`flex-1 py-4 rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center gap-2 ${listingType === 'affiliate' ? 'bg-gradient-to-r from-orange-500 to-red-500 shadow-md text-white scale-[1.02] shadow-orange-200' : 'text-slate-400 hover:bg-slate-200 hover:text-slate-600'}`}
          >
             <span className="text-lg">💰</span> KIẾM TIỀN AFFILIATE
          </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        
        {/* --- CỘT TRÁI: UPLOAD ẢNH / LINK --- */}
        <div className="space-y-6">
          
          {/* TRƯỜNG HỢP AFFILIATE NHƯNG KHÔNG PHẢI VIP */}
          {listingType === 'affiliate' && !isVip ? (
              <div className="bg-gradient-to-br from-orange-50 to-amber-50 border-2 border-orange-100 rounded-[2.5rem] p-8 text-center animate-fade-in-up shadow-sm">
                  <div className="text-6xl mb-4 animate-bounce">👑</div>
                  <h3 className="text-xl font-black text-orange-800 mb-2 uppercase tracking-tight">Đặc quyền VIP PRO</h3>
                  <p className="text-sm text-slate-600 font-medium leading-relaxed mb-6 px-4">Mở khóa tính năng kiếm tiền thụ động từ tiếp thị liên kết (Affiliate) ngay hôm nay.</p>
                  <Link to="/upgrade" className="bg-gradient-to-r from-orange-500 to-red-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase shadow-xl shadow-orange-300 hover:scale-105 hover:shadow-orange-400 transition-all inline-block tracking-widest">
                      Nâng cấp ngay
                  </Link>
              </div>
          ) : (
              /* KHU VỰC ẢNH CHÍNH */
              <div className="bg-white border border-slate-200 rounded-[2.5rem] p-6 shadow-sm space-y-4 relative overflow-hidden">
                
                <div className="flex items-center justify-between relative z-10">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-500">Hình ảnh ({formData.images.length}/{currentTierConfig.maxImages})</label>
                  {aiAnalyzing && <div className="text-[9px] font-black text-primary animate-pulse bg-primary/10 px-2 py-1 rounded">🤖 AI ĐANG QUÉT...</div>}
                </div>

                {/* Ô NHẬP LINK AFFILIATE */}
                {listingType === 'affiliate' && (
                    <div className="space-y-3 mb-4 animate-fade-in relative z-10">
                        <div className="flex gap-2">
                            <input 
                                type="url" 
                                value={affiliateLinkInput}
                                onChange={e => setAffiliateLinkInput(e.target.value)}
                                placeholder="Dán link Shopee/Lazada..."
                                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-500/10 outline-none transition-all"
                            />
                            <button type="button" onClick={handleFetchLink} disabled={isCrawling || !affiliateLinkInput} className="bg-orange-500 text-white px-4 rounded-xl text-[10px] font-black uppercase hover:bg-orange-600 whitespace-nowrap shadow-md shadow-orange-200 disabled:opacity-50 transition-all active:scale-95">
                                {isCrawling ? '⏳' : 'Lấy tin'}
                            </button>
                        </div>
                        {manualAffiliateMode && <p className="text-[10px] text-red-500 font-bold italic text-center bg-red-50 py-2 rounded-lg border border-red-100">⚠ Không lấy được tin tự động. Vui lòng tải ảnh thủ công.</p>}
                    </div>
                )}

                {/* GRID ẢNH */}
                <div className="grid grid-cols-2 gap-3 relative z-10">
                  {formData.images.map((img, i) => (
                    <div key={i} className="aspect-square rounded-2xl overflow-hidden border border-slate-200 relative group shadow-sm bg-white">
                      <img src={img} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="" />
                      <button type="button" onClick={() => setFormData(p => ({...p, images: p.images.filter((_, idx) => idx !== i)}))} className="absolute top-2 right-2 bg-black/50 hover:bg-red-500 text-white rounded-full p-1.5 backdrop-blur-sm transition-all scale-0 group-hover:scale-100">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12"/></svg>
                      </button>
                    </div>
                  ))}
                  
                  {/* NÚT THÊM ẢNH */}
                  {formData.images.length < currentTierConfig.maxImages && (listingType === 'normal' || manualAffiliateMode) && (
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="aspect-square bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center text-slate-400 hover:border-primary hover:text-primary hover:bg-blue-50/50 transition-all group">
                      <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center mb-2 group-hover:scale-110 transition-transform group-hover:shadow-md"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/></svg></div>
                      <span className="text-[9px] font-black uppercase tracking-widest">Thêm ảnh</span>
                    </button>
                  )}
                </div>
                
                <input type="file" ref={fileInputRef} onChange={handleImageUpload} multiple accept="image/*" className="hidden" />
              </div>
          )}

          <div className="bg-blue-50 border border-blue-100 rounded-[2.5rem] p-6 space-y-4">
            <h4 className="text-xs font-black text-blue-600 uppercase flex items-center gap-2 tracking-widest">🛡️ Quy tắc cộng đồng</h4>
            <ul className="space-y-3">
              {['Ảnh thật sản phẩm', 'Giá cả minh bạch', 'Không hàng cấm', 'Mô tả trung thực'].map(t => (
                <li key={t} className="flex items-center gap-2 text-[10px] text-slate-600 font-bold uppercase">
                    <span className="text-blue-500">✔</span> {t}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* --- CỘT PHẢI: FORM NHẬP LIỆU --- */}
        <div className="lg:col-span-2">
          { (listingType === 'normal' || isVip) && (
              <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm space-y-6 animate-fade-in relative overflow-hidden">
                
                <div className="space-y-2">
                  <label className={labelStyle}>Tiêu đề sản phẩm *</label>
                  <input type="text" placeholder="Ví dụ: iPhone 15 Pro Max 256GB..." value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} className={inputStyle} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className={labelStyle}>Danh mục *</label>
                    <div className="relative">
                        <select value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value, attributes: {}})} className={`${inputStyle} appearance-none`}>
                        <option value="">-- Chọn danh mục --</option>
                        {CATEGORIES.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">▼</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className={labelStyle}>Giá bán (VNĐ) *</label>
                    <input type="number" placeholder="0" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} className={inputStyle} />
                  </div>
                </div>

                {renderDynamicFields()}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className={labelStyle}>Tình trạng</label>
                    <div className="flex gap-2 p-1 bg-slate-50 rounded-2xl border border-slate-100">
                        {['new', 'used'].map(cond => (
                          <button key={cond} type="button" onClick={() => setFormData({...formData, condition: cond as 'new' | 'used'})} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${formData.condition === cond ? 'bg-white text-primary shadow-md ring-1 ring-black/5' : 'text-slate-400 hover:text-slate-600'}`}>{cond === 'new' ? 'Mới 100%' : 'Đã qua sử dụng'}</button>
                        ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className={labelStyle}>Khu vực (Lọc tìm kiếm)</label>
                    <div className="relative">
                        <select value={formData.location} onChange={(e) => setFormData({...formData, location: e.target.value})} className={`${inputStyle} appearance-none`}>
                            {LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">▼</div>
                        {locationDetected && <div className="absolute right-10 top-1/2 -translate-y-1/2 text-green-500 text-[9px] font-black uppercase tracking-widest bg-green-50 px-2 py-0.5 rounded">📍 GPS Auto</div>}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 animate-fade-in-up">
                    <div className="flex justify-between items-end">
                        <label className={labelStyle}>Địa chỉ giao dịch (Hiển thị trên bản đồ)</label>
                        <button type="button" onClick={handleManualLocate} className="text-[10px] text-primary font-bold hover:underline flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-lg transition-colors hover:bg-blue-100">
                            📍 Định vị hiện tại
                        </button>
                    </div>
                    <textarea 
                      value={formData.address} 
                      onChange={(e) => setFormData({...formData, address: e.target.value})} 
                      placeholder="Số nhà, Tên đường, Phường/Xã..."
                      className={`${inputStyle} h-24 resize-none`}
                    />
                </div>

                <div className="space-y-2">
                  <label className={labelStyle}>Mô tả chi tiết</label>
                  <textarea rows={6} placeholder="Mô tả chi tiết về sản phẩm, tình trạng, lý do bán..." value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className={inputStyle} />
                </div>

                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <input type="checkbox" id="agreed" checked={agreedToRules} onChange={(e) => setAgreedToRules(e.target.checked)} className="w-5 h-5 rounded-lg border-slate-300 text-primary focus:ring-primary" />
                    <label htmlFor="agreed" className="text-[10px] font-bold text-slate-500 cursor-pointer uppercase tracking-tight select-none">Tôi cam kết thông tin trên là chính xác & trung thực</label>
                </div>

                <button type="submit" disabled={loading || aiAnalyzing || (listingType === 'affiliate' && !formData.images.length)} className={`w-full text-white font-black py-5 rounded-2xl transition-all shadow-xl flex items-center justify-center gap-3 active:scale-95 uppercase tracking-widest text-xs ${listingType === 'affiliate' ? 'bg-gradient-to-r from-orange-500 to-red-500 shadow-orange-500/30 hover:shadow-orange-500/50' : 'bg-primary hover:bg-primaryHover shadow-primary/30 hover:shadow-primary/50'}`}>
                  {loading ? <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div> : (listingType === 'affiliate' ? 'Đăng tin kiếm tiền ngay 💰' : 'Xác nhận đăng tin')}
                </button>
              </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default PostListing;