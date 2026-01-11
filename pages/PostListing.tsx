import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { CATEGORIES, LOCATIONS } from '../constants'; 
import { db, SystemSettings } from '../services/db'; 
import { User } from '../types';
import { analyzeListingImages } from '../services/geminiService'; // Vẫn giữ AI để hỗ trợ điền form
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
  affiliateLink?: string | null;
}

const PostListing: React.FC<{ user: User | null }> = ({ user }) => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
   
  // --- STATE ---
  const [listingType, setListingType] = useState<'normal' | 'affiliate'>('normal');
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  
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
    attributes: {},
    affiliateLink: ''
  });

  const inputStyle = "w-full bg-white border border-gray-200 rounded-2xl p-4 font-bold text-sm focus:outline-none focus:border-primary transition-all shadow-sm";
  const labelStyle = "text-[10px] font-black text-gray-400 uppercase tracking-widest px-1";
  const wrapperStyle = "space-y-1.5";

  // --- 1. LOAD SETTINGS ---
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
          } catch (e) { }
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
            } catch (e) { alert("Không thể lấy địa chỉ chi tiết."); }
        },
        () => alert("Vui lòng bật quyền truy cập vị trí."),
        { enableHighAccuracy: true }
    );
  };

  const updateAttr = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, attributes: { ...prev.attributes, [key]: value } }));
  };

  // --- 2. RENDER DYNAMIC FIELDS (GIỮ NGUYÊN) ---
  const renderDynamicFields = () => {
    switch (formData.category) {
      case '1': return ( /* Bất động sản */
          <div className="grid grid-cols-2 gap-4 animate-fade-in-up">
            <div className={wrapperStyle}><label className={labelStyle}>Diện tích (m²)</label><input type="number" placeholder="m²" className={inputStyle} value={formData.attributes.area || ''} onChange={(e) => updateAttr('area', e.target.value)} /></div>
            <div className={wrapperStyle}><label className={labelStyle}>Phòng ngủ</label><input type="number" placeholder="Số phòng" className={inputStyle} value={formData.attributes.bedrooms || ''} onChange={(e) => updateAttr('bedrooms', e.target.value)} /></div>
            <div className={wrapperStyle}><label className={labelStyle}>Số WC</label><input type="number" placeholder="Số phòng" className={inputStyle} value={formData.attributes.bathrooms || ''} onChange={(e) => updateAttr('bathrooms', e.target.value)} /></div>
            <div className={wrapperStyle}><label className={labelStyle}>Hướng nhà</label><input type="text" placeholder="Đông Nam..." className={inputStyle} value={formData.attributes.direction || ''} onChange={(e) => updateAttr('direction', e.target.value)} /></div>
            <div className={wrapperStyle}><label className={labelStyle}>Pháp lý</label><input type="text" placeholder="Sổ hồng/Sổ đỏ..." className={inputStyle} value={formData.attributes.legal || ''} onChange={(e) => updateAttr('legal', e.target.value)} /></div>
            <div className={wrapperStyle}><label className={labelStyle}>Loại hình</label><select className={inputStyle} value={formData.attributes.propertyType || ''} onChange={(e) => updateAttr('propertyType', e.target.value)}><option value="">Chọn loại</option><option value="Nhà ở">Nhà ở</option><option value="Đất nền">Đất nền</option><option value="Chung cư">Chung cư</option></select></div>
          </div>
      );
      case '2': return ( /* Xe cộ */
          <div className="grid grid-cols-2 gap-4 animate-fade-in-up">
            <div className={wrapperStyle}><label className={labelStyle}>Số Km (ODO)</label><input type="number" placeholder="Km" className={inputStyle} value={formData.attributes.mileage || ''} onChange={(e) => updateAttr('mileage', e.target.value)} /></div>
            <div className={wrapperStyle}><label className={labelStyle}>Năm sản xuất</label><input type="number" placeholder="YYYY" className={inputStyle} value={formData.attributes.year || ''} onChange={(e) => updateAttr('year', e.target.value)} /></div>
            <div className={wrapperStyle}><label className={labelStyle}>Hộp số</label><select className={inputStyle} value={formData.attributes.gearbox || ''} onChange={(e) => updateAttr('gearbox', e.target.value)}><option value="">Chọn</option><option value="Tự động">Tự động</option><option value="Số sàn">Số sàn</option></select></div>
            <div className={wrapperStyle}><label className={labelStyle}>Nhiên liệu</label><select className={inputStyle} value={formData.attributes.fuel || ''} onChange={(e) => updateAttr('fuel', e.target.value)}><option value="">Chọn</option><option value="Xăng">Xăng</option><option value="Dầu">Dầu</option><option value="Điện">Điện</option></select></div>
            <div className={wrapperStyle}><label className={labelStyle}>Kiểu dáng</label><input type="text" placeholder="Sedan/SUV..." className={inputStyle} value={formData.attributes.carType || ''} onChange={(e) => updateAttr('carType', e.target.value)} /></div>
            <div className={wrapperStyle}><label className={labelStyle}>Số chỗ</label><input type="number" placeholder="Chỗ" className={inputStyle} value={formData.attributes.seatCount || ''} onChange={(e) => updateAttr('seatCount', e.target.value)} /></div>
          </div>
      );
      case '3': return ( /* Đồ điện tử */
          <div className="grid grid-cols-2 gap-4 animate-fade-in-up">
            <div className={wrapperStyle}><label className={labelStyle}>Pin (%)</label><input type="number" placeholder="%" className={inputStyle} value={formData.attributes.battery || ''} onChange={(e) => updateAttr('battery', e.target.value)} /></div>
            <div className={wrapperStyle}><label className={labelStyle}>Bộ nhớ</label><input type="text" placeholder="128GB..." className={inputStyle} value={formData.attributes.storage || ''} onChange={(e) => updateAttr('storage', e.target.value)} /></div>
            <div className={wrapperStyle}><label className={labelStyle}>RAM</label><input type="text" placeholder="8GB..." className={inputStyle} value={formData.attributes.ram || ''} onChange={(e) => updateAttr('ram', e.target.value)} /></div>
            <div className={wrapperStyle}><label className={labelStyle}>Màu sắc</label><input type="text" placeholder="Vàng/Đen..." className={inputStyle} value={formData.attributes.color || ''} onChange={(e) => updateAttr('color', e.target.value)} /></div>
            <div className={wrapperStyle}><label className={labelStyle}>Bảo hành</label><input type="text" placeholder="Tình trạng BH" className={inputStyle} value={formData.attributes.warranty || ''} onChange={(e) => updateAttr('warranty', e.target.value)} /></div>
          </div>
      );
      case '10': return ( /* Điện lạnh */
          <div className="grid grid-cols-2 gap-4 animate-fade-in-up">
            <div className={wrapperStyle}><label className={labelStyle}>Công suất</label><input type="text" placeholder="1.5 HP/BTU" className={inputStyle} value={formData.attributes.capacity || ''} onChange={(e) => updateAttr('capacity', e.target.value)} /></div>
            <div className={wrapperStyle}><label className={labelStyle}>Inverter</label><select className={inputStyle} value={formData.attributes.inverter || ''} onChange={(e) => updateAttr('inverter', e.target.value)}><option value="">Chọn</option><option value="Có">Có</option><option value="Không">Không</option></select></div>
          </div>
      );
      case '8': return ( /* Thú cưng */
          <div className="grid grid-cols-2 gap-4 animate-fade-in-up">
            <div className={wrapperStyle}><label className={labelStyle}>Giống loài</label><input type="text" placeholder="Poodle/Mèo..." className={inputStyle} value={formData.attributes.breed || ''} onChange={(e) => updateAttr('breed', e.target.value)} /></div>
            <div className={wrapperStyle}><label className={labelStyle}>Độ tuổi</label><input type="text" placeholder="2 tháng..." className={inputStyle} value={formData.attributes.age || ''} onChange={(e) => updateAttr('age', e.target.value)} /></div>
            <div className={wrapperStyle}><label className={labelStyle}>Giới tính</label><select className={inputStyle} value={formData.attributes.gender || ''} onChange={(e) => updateAttr('gender', e.target.value)}><option value="">Chọn</option><option value="Đực">Đực</option><option value="Cái">Cái</option></select></div>
          </div>
      );
      case '4': return ( /* Nội thất */
          <div className="grid grid-cols-2 gap-4 animate-fade-in-up">
            <div className={wrapperStyle}><label className={labelStyle}>Chất liệu</label><input type="text" placeholder="Gỗ/Nhựa..." className={inputStyle} value={formData.attributes.material || ''} onChange={(e) => updateAttr('material', e.target.value)} /></div>
            <div className={wrapperStyle}><label className={labelStyle}>Kích thước</label><input type="text" placeholder="Dài x Rộng" className={inputStyle} value={formData.attributes.size || ''} onChange={(e) => updateAttr('size', e.target.value)} /></div>
          </div>
      );
      case '6': return ( /* Đồ cá nhân */
          <div className="grid grid-cols-2 gap-4 animate-fade-in-up">
            <div className={wrapperStyle}><label className={labelStyle}>Thương hiệu</label><input type="text" placeholder="Nike/Adidas..." className={inputStyle} value={formData.attributes.brand || ''} onChange={(e) => updateAttr('brand', e.target.value)} /></div>
            <div className={wrapperStyle}><label className={labelStyle}>Kích cỡ</label><input type="text" placeholder="M/L/42..." className={inputStyle} value={formData.attributes.personalSize || ''} onChange={(e) => updateAttr('personalSize', e.target.value)} /></div>
          </div>
      );
      case '11': return ( /* Việc làm */
          <div className="grid grid-cols-2 gap-4 animate-fade-in-up">
            <div className={wrapperStyle}><label className={labelStyle}>Mức lương</label><input type="text" placeholder="Lương" className={inputStyle} value={formData.attributes.salary || ''} onChange={(e) => updateAttr('salary', e.target.value)} /></div>
            <div className={wrapperStyle}><label className={labelStyle}>Kinh nghiệm</label><input type="text" placeholder="Yêu cầu" className={inputStyle} value={formData.attributes.experience || ''} onChange={(e) => updateAttr('experience', e.target.value)} /></div>
            <div className={wrapperStyle}><label className={labelStyle}>Hình thức</label><select className={inputStyle} value={formData.attributes.jobType || ''} onChange={(e) => updateAttr('jobType', e.target.value)}><option value="">Chọn</option><option value="Toàn thời gian">Toàn thời gian</option><option value="Bán thời gian">Bán thời gian</option></select></div>
          </div>
      );
      default: return null;
    }
  };

  // --- 3. UPLOAD ẢNH & AI ---
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
        
        // Vẫn chạy AI để hỗ trợ điền thông tin (dù là Affiliate hay Normal)
        if (compressedResults.length > 0) {
            runAIAnalysis(updatedImages);
        }
    } catch (error) { alert("Lỗi xử lý ảnh."); } 
    finally { if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const runAIAnalysis = async (images: string[]) => {
    setAiAnalyzing(true);
    try {
      const analysis = await analyzeListingImages(images.slice(0, 3));
      // Chỉ tự động điền nếu có tiêu đề, không đè lên dữ liệu đã nhập nếu người dùng đang sửa
      if (analysis.title) {
        setFormData(prev => ({
          ...prev,
          title: (!prev.title) ? (analysis.title || '') : prev.title,
          category: (!prev.category) ? (analysis.category || '') : prev.category,
          price: (!prev.price) ? (analysis.suggestedPrice?.toString() || '') : prev.price,
          description: (!prev.description) ? (analysis.description || '') : prev.description,
          condition: (analysis.condition as 'new' | 'used') || prev.condition,
          attributes: { ...prev.attributes, ...(analysis.attributes || {}) }
        }));
      }
    } catch (err) { }
    finally { setAiAnalyzing(false); }
  };

  // --- 4. SUBMIT FORM ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !settings) return;
    const userTier = user.subscriptionTier || 'free';
    const tierConfig = (settings.tierConfigs as any)[userTier];

    const countToday = await db.countUserListingsToday(user.id);
    if (countToday >= tierConfig.postsPerDay) {
         return alert(`⚠️ Hạn mức đăng tin trong ngày đã hết!`);
    }

    if (!formData.title.trim() || !formData.category || !formData.price || formData.images.length === 0) {
      return alert('Vui lòng điền đủ: Tiêu đề, Danh mục, Giá và ít nhất 1 Ảnh!');
    }
    
    // Check Affiliate Link
    if (listingType === 'affiliate' && !formData.affiliateLink) {
        return alert('Vui lòng nhập Link tiếp thị liên kết.');
    }

    if (!agreedToRules) return alert('Bạn cần đồng ý với quy tắc cộng đồng.');

    setLoading(true);
    try {
      let uploadedUrls = formData.images;
      // Upload ảnh lên Storage
      uploadedUrls = await Promise.all(
        formData.images.map((img, index) => 
          img.startsWith('data:') ? db.uploadImage(img, `listings/${user.id}/${Date.now()}_${index}.jpg`) : img
        )
      );

      const listingData: any = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        price: parseInt(formData.price.replace(/\D/g, '')),
        category: formData.category,
        images: uploadedUrls,
        location: formData.location, 
        address: formData.address,
        condition: listingType === 'affiliate' ? 'new' : formData.condition, // Affiliate mặc định là hàng mới
        attributes: formData.attributes,
        sellerId: user.id,
        sellerName: user.name,
        sellerAvatar: user.avatar || '',
        status: (listingType === 'affiliate' || tierConfig.autoApprove) ? 'approved' : 'pending',
        tier: listingType === 'affiliate' ? 'pro' : userTier, 
        affiliateLink: listingType === 'affiliate' ? formData.affiliateLink : null,
        lat: locationDetected?.lat,
        lng: locationDetected?.lng,
        createdAt: new Date().toISOString()
      };
      
      Object.keys(listingData).forEach(key => listingData[key] === undefined && delete listingData[key]);
      await db.saveListing(listingData);
      alert("🎉 Đăng tin thành công!");
      navigate('/manage-ads');
    } catch (error) {
      alert("Lỗi khi đăng tin. Thử lại sau.");
    } finally {
      setLoading(false);
    }
  };

  if (!settings) return <div className="h-96 flex items-center justify-center font-black text-primary animate-pulse">Đang tải...</div>;
  const currentTierConfig = (settings.tierConfigs as any)[user?.subscriptionTier || 'free'];
  const isVip = user?.subscriptionTier === 'pro';

  return (
    <div className="max-w-5xl mx-auto space-y-6 px-4 pb-20 pt-6 font-sans">
      <div className="text-center space-y-2 mb-6">
        <h1 className="text-3xl font-black text-gray-900 uppercase">Đăng Tin Mới</h1>
        <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-gray-100 border border-gray-200">
             <span className="text-xs font-bold text-gray-500 uppercase">{currentTierConfig.name}</span>
             {!isVip && <Link to="/upgrade" className="text-[10px] font-black text-primary hover:underline">NÂNG CẤP</Link>}
        </div>
      </div>

      <div className="bg-gray-100 p-1 rounded-xl flex max-w-md mx-auto">
          <button 
            onClick={() => { 
                setListingType('normal'); 
                setFormData(p => ({...p, title: '', price: '', images: [], affiliateLink: null})); 
            }} 
            className={`flex-1 py-3 rounded-lg text-xs font-bold uppercase ${listingType === 'normal' ? 'bg-white shadow text-primary' : 'text-gray-400'}`}
          >
            📦 Bán ngay
          </button>
          <button 
            onClick={() => { 
                setListingType('affiliate'); 
                setFormData(p => ({...p, title: '', price: '', images: [], affiliateLink: ''})); 
            }} 
            className={`flex-1 py-3 rounded-lg text-xs font-bold uppercase ${listingType === 'affiliate' ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow' : 'text-gray-400'}`}
          >
            💰 Tiếp thị liên kết
          </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* CỘT TRÁI: ẢNH */}
        <div className="space-y-4">
           {listingType === 'affiliate' && !isVip ? (
              <div className="bg-orange-50 border border-orange-100 rounded-2xl p-6 text-center">
                  <h3 className="text-lg font-black text-orange-600 mb-2">DÀNH CHO VIP</h3>
                  <Link to="/upgrade" className="bg-orange-500 text-white px-6 py-3 rounded-xl font-bold text-xs uppercase shadow-lg">Nâng cấp ngay</Link>
              </div>
           ) : (
              <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <label className={labelStyle}>Hình ảnh ({formData.images.length}/{currentTierConfig.maxImages})</label>
                    {aiAnalyzing && <span className="text-[9px] font-bold text-blue-500 animate-pulse">✨ AI đang quét...</span>}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {formData.images.map((img, i) => (
                    <div key={i} className="aspect-square rounded-xl overflow-hidden border border-gray-200 relative group">
                      <img src={img} className="w-full h-full object-cover" alt="" />
                      <button type="button" onClick={() => setFormData(p => ({...p, images: p.images.filter((_, idx) => idx !== i)}))} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 scale-0 group-hover:scale-100 transition-all">✕</button>
                    </div>
                  ))}
                  
                  {/* NÚT UPLOAD ẢNH (DÙNG CHO CẢ 2 CHẾ ĐỘ) */}
                  {formData.images.length < currentTierConfig.maxImages && (
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="aspect-square bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:border-primary hover:text-primary transition-all">
                      <span className="text-2xl">+</span>
                      <span className="text-[8px] font-bold uppercase mt-1">Tải ảnh</span>
                    </button>
                  )}
                </div>
                <input type="file" ref={fileInputRef} onChange={handleImageUpload} multiple accept="image/*" className="hidden" />
              </div>
           )}
        </div>

        {/* CỘT PHẢI: FORM */}
        <div className="lg:col-span-2">
          {(listingType === 'normal' || isVip) && (
             <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
                
                {/* Ô NHẬP LINK AFFILIATE (CHỈ HIỆN KHI Ở TAB AFFILIATE) */}
                {listingType === 'affiliate' && (
                    <div className="space-y-1 bg-orange-50 p-4 rounded-xl border border-orange-100">
                        <label className="text-[10px] font-black text-orange-600 uppercase tracking-widest px-1">Link Tiếp Thị (Shopee/Lazada...)</label>
                        <input 
                            type="url" 
                            placeholder="Dán link sản phẩm vào đây để nhận hoa hồng..." 
                            value={formData.affiliateLink || ''} 
                            onChange={(e) => setFormData({...formData, affiliateLink: e.target.value})} 
                            className="w-full bg-white border border-orange-200 rounded-xl p-3 font-bold text-sm focus:outline-none focus:border-orange-500 text-orange-700" 
                        />
                        <p className="text-[9px] text-gray-500 italic px-1">Người mua sẽ được chuyển đến link này khi bấm "Mua Ngay".</p>
                    </div>
                )}

                <div className="space-y-1">
                  <label className={labelStyle}>Tiêu đề *</label>
                  <input type="text" placeholder="Tên sản phẩm..." value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} className={inputStyle} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className={labelStyle}>Danh mục *</label>
                    <select value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value, attributes: {}})} className={inputStyle}>
                      <option value="">-- Chọn --</option>
                      {CATEGORIES.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className={labelStyle}>Giá bán *</label>
                    <input type="number" placeholder="VNĐ" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} className={inputStyle} />
                  </div>
                </div>

                {renderDynamicFields()}

                <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1">
                        <label className={labelStyle}>Khu vực</label>
                        <select value={formData.location} onChange={(e) => setFormData({...formData, location: e.target.value})} className={inputStyle}>
                            {LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                        </select>
                     </div>
                     {listingType === 'normal' && (
                         <div className="space-y-1">
                            <label className={labelStyle}>Tình trạng</label>
                            <select value={formData.condition} onChange={(e) => setFormData({...formData, condition: e.target.value as any})} className={inputStyle}>
                                <option value="used">Đã qua sử dụng</option>
                                <option value="new">Mới 100%</option>
                            </select>
                         </div>
                     )}
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between">
                     <label className={labelStyle}>Địa chỉ</label>
                     <button type="button" onClick={handleManualLocate} className="text-[9px] font-bold text-blue-500 uppercase">📍 Định vị</button>
                  </div>
                  <textarea value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} className={`${inputStyle} h-20 resize-none`} placeholder="Địa chỉ giao dịch..." />
                </div>

                <div className="space-y-1">
                  <label className={labelStyle}>Mô tả</label>
                  <textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className={`${inputStyle} h-28`} placeholder="Mô tả chi tiết sản phẩm..." />
                </div>

                <div className="flex items-center gap-2 pt-2">
                   <input type="checkbox" checked={agreedToRules} onChange={e => setAgreedToRules(e.target.checked)} className="w-4 h-4 text-primary rounded" />
                   <span className="text-[10px] font-bold text-gray-500 uppercase">Đồng ý quy tắc cộng đồng</span>
                </div>

                <button type="submit" disabled={loading} className={`w-full py-4 rounded-xl font-black text-xs uppercase shadow-lg text-white ${listingType === 'affiliate' ? 'bg-gradient-to-r from-orange-500 to-red-500 shadow-orange-200' : 'bg-primary hover:bg-primaryHover shadow-blue-200'}`}>
                    {loading ? 'Đang xử lý...' : (listingType === 'affiliate' ? 'Đăng tin kiếm tiền ngay' : 'Đăng tin bán')}
                </button>
             </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default PostListing;
