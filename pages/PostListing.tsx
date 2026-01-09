import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CATEGORIES, LOCATIONS } from '../constants'; 
import { db, SystemSettings } from '../services/db'; 
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
  
  // --- STATE ---
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

  // --- STYLE CHUNG (KHÔI PHỤC MÀU SẮC CŨ) ---
  const inputStyle = "w-full bg-white border border-gray-200 rounded-2xl p-4 font-bold text-sm focus:outline-none focus:border-primary transition-all shadow-sm";
  const labelStyle = "text-[10px] font-black text-gray-400 uppercase tracking-widest px-1";
  const wrapperStyle = "space-y-1.5";

  // --- 1. LOAD SETTINGS & KIỂM TRA ĐĂNG NHẬP ---
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
            setFormData(prev => ({
              ...prev,
              location: info.city || prev.location,
              address: info.address || prev.address
            }));
          } catch (e) { console.warn("GPS Address Error"); }
        },
        null, { timeout: 10000 }
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

  // --- 2. LOGIC CHẶN ĐĂNG TIN THEO CÀI ĐẶT ADMIN ---
  const checkDailyLimit = async (tierConfig: any) => {
    if (!user) return false;
    const countToday = await db.countUserListingsToday(user.id);
    const limit = tierConfig.postsPerDay || 0;

    if (countToday >= limit) {
      alert(`⚠️ HẠN MỨC ĐÃ HẾT!\n\nGói "${tierConfig.name}" chỉ được đăng tối đa ${limit} tin/ngày.\nHôm nay bạn đã đăng ${countToday} tin.\n\nVui lòng quay lại vào ngày mai hoặc nâng cấp lên gói cao hơn.`);
      return false;
    }
    return true;
  };

  const updateAttr = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, attributes: { ...prev.attributes, [key]: value } }));
  };

  // --- 3. RENDER CÁC TRƯỜNG NHẬP LIỆU ĐỘNG ---
  const renderDynamicFields = () => {
    switch (formData.category) {
      case '1': // Bất động sản
        return (
          <div className="grid grid-cols-2 gap-4 animate-fade-in-up">
            <div className={wrapperStyle}><label className={labelStyle}>Diện tích (m²)</label><input type="number" placeholder="m²" className={inputStyle} value={formData.attributes.area || ''} onChange={(e) => updateAttr('area', e.target.value)} /></div>
            <div className={wrapperStyle}><label className={labelStyle}>Phòng ngủ</label><input type="number" placeholder="Số phòng" className={inputStyle} value={formData.attributes.bedrooms || ''} onChange={(e) => updateAttr('bedrooms', e.target.value)} /></div>
            <div className={wrapperStyle}><label className={labelStyle}>Số WC</label><input type="number" placeholder="Số phòng" className={inputStyle} value={formData.attributes.bathrooms || ''} onChange={(e) => updateAttr('bathrooms', e.target.value)} /></div>
            <div className={wrapperStyle}><label className={labelStyle}>Hướng nhà</label><input type="text" placeholder="Đông Nam..." className={inputStyle} value={formData.attributes.direction || ''} onChange={(e) => updateAttr('direction', e.target.value)} /></div>
            <div className={wrapperStyle}><label className={labelStyle}>Pháp lý</label><input type="text" placeholder="Sổ hồng/Sổ đỏ..." className={inputStyle} value={formData.attributes.legal || ''} onChange={(e) => updateAttr('legal', e.target.value)} /></div>
            <div className={wrapperStyle}><label className={labelStyle}>Loại hình</label><select className={inputStyle} value={formData.attributes.propertyType || ''} onChange={(e) => updateAttr('propertyType', e.target.value)}><option value="">Chọn loại</option><option value="Nhà ở">Nhà ở</option><option value="Đất nền">Đất nền</option><option value="Chung cư">Chung cư</option></select></div>
          </div>
        );
      case '2': // Xe cộ
        return (
          <div className="grid grid-cols-2 gap-4 animate-fade-in-up">
            <div className={wrapperStyle}><label className={labelStyle}>Số Km (ODO)</label><input type="number" placeholder="Km" className={inputStyle} value={formData.attributes.mileage || ''} onChange={(e) => updateAttr('mileage', e.target.value)} /></div>
            <div className={wrapperStyle}><label className={labelStyle}>Năm sản xuất</label><input type="number" placeholder="YYYY" className={inputStyle} value={formData.attributes.year || ''} onChange={(e) => updateAttr('year', e.target.value)} /></div>
            <div className={wrapperStyle}><label className={labelStyle}>Hộp số</label><select className={inputStyle} value={formData.attributes.gearbox || ''} onChange={(e) => updateAttr('gearbox', e.target.value)}><option value="">Chọn</option><option value="Tự động">Tự động</option><option value="Số sàn">Số sàn</option></select></div>
            <div className={wrapperStyle}><label className={labelStyle}>Nhiên liệu</label><select className={inputStyle} value={formData.attributes.fuel || ''} onChange={(e) => updateAttr('fuel', e.target.value)}><option value="">Chọn</option><option value="Xăng">Xăng</option><option value="Dầu">Dầu</option><option value="Điện">Điện</option></select></div>
            <div className={wrapperStyle}><label className={labelStyle}>Kiểu dáng</label><input type="text" placeholder="Sedan/SUV..." className={inputStyle} value={formData.attributes.carType || ''} onChange={(e) => updateAttr('carType', e.target.value)} /></div>
            <div className={wrapperStyle}><label className={labelStyle}>Số chỗ</label><input type="number" placeholder="Chỗ" className={inputStyle} value={formData.attributes.seatCount || ''} onChange={(e) => updateAttr('seatCount', e.target.value)} /></div>
          </div>
        );
      case '3': // Đồ điện tử
        return (
          <div className="grid grid-cols-2 gap-4 animate-fade-in-up">
            <div className={wrapperStyle}><label className={labelStyle}>Pin (%)</label><input type="number" placeholder="%" className={inputStyle} value={formData.attributes.battery || ''} onChange={(e) => updateAttr('battery', e.target.value)} /></div>
            <div className={wrapperStyle}><label className={labelStyle}>Bộ nhớ</label><input type="text" placeholder="128GB..." className={inputStyle} value={formData.attributes.storage || ''} onChange={(e) => updateAttr('storage', e.target.value)} /></div>
            <div className={wrapperStyle}><label className={labelStyle}>RAM</label><input type="text" placeholder="8GB..." className={inputStyle} value={formData.attributes.ram || ''} onChange={(e) => updateAttr('ram', e.target.value)} /></div>
            <div className={wrapperStyle}><label className={labelStyle}>Màu sắc</label><input type="text" placeholder="Vàng/Đen..." className={inputStyle} value={formData.attributes.color || ''} onChange={(e) => updateAttr('color', e.target.value)} /></div>
            <div className={wrapperStyle}><label className={labelStyle}>Bảo hành</label><input type="text" placeholder="Tình trạng BH" className={inputStyle} value={formData.attributes.warranty || ''} onChange={(e) => updateAttr('warranty', e.target.value)} /></div>
          </div>
        );
      case '10': // Điện lạnh
        return (
          <div className="grid grid-cols-2 gap-4 animate-fade-in-up">
            <div className={wrapperStyle}><label className={labelStyle}>Công suất</label><input type="text" placeholder="1.5 HP/BTU" className={inputStyle} value={formData.attributes.capacity || ''} onChange={(e) => updateAttr('capacity', e.target.value)} /></div>
            <div className={wrapperStyle}><label className={labelStyle}>Inverter</label><select className={inputStyle} value={formData.attributes.inverter || ''} onChange={(e) => updateAttr('inverter', e.target.value)}><option value="">Chọn</option><option value="Có">Có</option><option value="Không">Không</option></select></div>
          </div>
        );
      case '8': // Thú cưng
        return (
          <div className="grid grid-cols-2 gap-4 animate-fade-in-up">
            <div className={wrapperStyle}><label className={labelStyle}>Giống loài</label><input type="text" placeholder="Poodle/Mèo..." className={inputStyle} value={formData.attributes.breed || ''} onChange={(e) => updateAttr('breed', e.target.value)} /></div>
            <div className={wrapperStyle}><label className={labelStyle}>Độ tuổi</label><input type="text" placeholder="2 tháng..." className={inputStyle} value={formData.attributes.age || ''} onChange={(e) => updateAttr('age', e.target.value)} /></div>
            <div className={wrapperStyle}><label className={labelStyle}>Giới tính</label><select className={inputStyle} value={formData.attributes.gender || ''} onChange={(e) => updateAttr('gender', e.target.value)}><option value="">Chọn</option><option value="Đực">Đực</option><option value="Cái">Cái</option></select></div>
          </div>
        );
      case '4': // Nội thất
        return (
          <div className="grid grid-cols-2 gap-4 animate-fade-in-up">
            <div className={wrapperStyle}><label className={labelStyle}>Chất liệu</label><input type="text" placeholder="Gỗ/Nhựa..." className={inputStyle} value={formData.attributes.material || ''} onChange={(e) => updateAttr('material', e.target.value)} /></div>
            <div className={wrapperStyle}><label className={labelStyle}>Kích thước</label><input type="text" placeholder="Dài x Rộng" className={inputStyle} value={formData.attributes.size || ''} onChange={(e) => updateAttr('size', e.target.value)} /></div>
          </div>
        );
      case '6': // Đồ dùng cá nhân
        return (
          <div className="grid grid-cols-2 gap-4 animate-fade-in-up">
            <div className={wrapperStyle}><label className={labelStyle}>Thương hiệu</label><input type="text" placeholder="Nike/Adidas..." className={inputStyle} value={formData.attributes.brand || ''} onChange={(e) => updateAttr('brand', e.target.value)} /></div>
            <div className={wrapperStyle}><label className={labelStyle}>Kích cỡ</label><input type="text" placeholder="M/L/42..." className={inputStyle} value={formData.attributes.personalSize || ''} onChange={(e) => updateAttr('personalSize', e.target.value)} /></div>
          </div>
        );
      case '11': // Việc làm
        return (
          <div className="grid grid-cols-2 gap-4 animate-fade-in-up">
            <div className={wrapperStyle}><label className={labelStyle}>Mức lương</label><input type="text" placeholder="Lương" className={inputStyle} value={formData.attributes.salary || ''} onChange={(e) => updateAttr('salary', e.target.value)} /></div>
            <div className={wrapperStyle}><label className={labelStyle}>Kinh nghiệm</label><input type="text" placeholder="Yêu cầu" className={inputStyle} value={formData.attributes.experience || ''} onChange={(e) => updateAttr('experience', e.target.value)} /></div>
            <div className={wrapperStyle}><label className={labelStyle}>Hình thức</label><select className={inputStyle} value={formData.attributes.jobType || ''} onChange={(e) => updateAttr('jobType', e.target.value)}><option value="">Chọn</option><option value="Toàn thời gian">Toàn thời gian</option><option value="Bán thời gian">Bán thời gian</option></select></div>
          </div>
        );
      default: return null;
    }
  };

  // --- 4. XỬ LÝ ẢNH & SUBMIT ---
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
        if (compressedResults.length > 0) runAIAnalysis(updatedImages);
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

    // CHỐT CHẶN: Kiểm tra hạn mức tin đăng
    const canPost = await checkDailyLimit(tierConfig);
    if (!canPost) return;

    if (!formData.title.trim() || !formData.category || !formData.price || formData.images.length === 0) {
      return alert('Vui lòng điền đủ thông tin bắt buộc (Tiêu đề, Danh mục, Giá, Ảnh)!');
    }
    const priceNumber = parseInt(formData.price.replace(/\D/g, ''));
    if (isNaN(priceNumber) || priceNumber < 0) return alert('Giá bán không hợp lệ!');
    if (!agreedToRules) return alert('Bạn cần đồng ý với quy tắc cộng đồng.');

    setLoading(true);
    try {
      const uploadedUrls = await Promise.all(
        formData.images.map((base64, index) => 
          db.uploadImage(base64, `listings/${user.id}/${Date.now()}_${index}.jpg`)
        )
      );

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

  return (
    <div className="max-w-5xl mx-auto space-y-8 px-4 pb-20 pt-8 font-sans">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-black text-gray-900 tracking-tighter">Đăng tin mới</h1>
        <div className="flex justify-center gap-2">
            <span className="bg-gray-100 text-gray-600 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider border border-gray-200">
                Gói: {currentTierConfig.name}
            </span>
            <span className="bg-blue-50 text-blue-600 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider border border-blue-100">
                Hạn mức: {currentTierConfig.postsPerDay >= 900 ? 'Không giới hạn' : `${currentTierConfig.postsPerDay} tin/ngày`}
            </span>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* CỘT TRÁI: UPLOAD ẢNH */}
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-[2.5rem] p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-black uppercase tracking-tight text-gray-800">Hình ảnh ({formData.images.length}/{currentTierConfig.maxImages})</label>
              {aiAnalyzing && <div className="text-[10px] font-bold text-primary animate-pulse">AI Đang quét...</div>}
              {aiSuccess && <div className="text-[10px] font-bold text-green-500">✨ Đã điền thông số</div>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {formData.images.map((img, i) => (
                <div key={i} className="aspect-square rounded-2xl overflow-hidden border border-gray-200 relative group shadow-sm">
                  <img src={img} className="w-full h-full object-cover" alt="" />
                  <button type="button" onClick={() => setFormData(p => ({...p, images: p.images.filter((_, idx) => idx !== i)}))} className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1.5 hover:bg-red-500 transition-colors">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
              ))}
              {formData.images.length < currentTierConfig.maxImages && (
                <button type="button" onClick={() => fileInputRef.current?.click()} className="aspect-square bg-gray-50 border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center text-gray-400 hover:border-primary hover:text-primary transition-all group">
                  <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center mb-2 group-hover:scale-110 transition-transform"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/></svg></div>
                  <span className="text-[9px] font-black uppercase tracking-widest">Thêm ảnh</span>
                </button>
              )}
            </div>
            <input type="file" ref={fileInputRef} onChange={handleImageUpload} multiple accept="image/*" className="hidden" />
            <p className="text-[10px] text-gray-400 font-bold text-center uppercase tracking-tighter">AI sẽ tự động nhận diện sản phẩm qua 3 ảnh đầu</p>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-[2.5rem] p-6 space-y-4">
            <h4 className="text-xs font-black text-blue-600 uppercase flex items-center gap-2">🛡️ Quy tắc đăng tin</h4>
            <ul className="space-y-3">
              {['Ảnh thật', 'Giá thật', 'Không hàng cấm', 'Mô tả trung thực'].map(t => (
                <li key={t} className="flex items-center gap-2 text-[10px] text-blue-500 font-black uppercase">✅ {t}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* CỘT PHẢI: FORM NHẬP LIỆU */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-[2.5rem] p-8 shadow-sm space-y-6">
            <div className="space-y-2">
              <label className={labelStyle}>Tiêu đề *</label>
              <input type="text" placeholder="Tên sản phẩm..." value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} className={inputStyle} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className={labelStyle}>Danh mục *</label>
                <select value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value, attributes: {}})} className={inputStyle}>
                  <option value="">Chọn danh mục</option>
                  {CATEGORIES.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className={labelStyle}>Giá bán (VNĐ) *</label>
                <input type="number" placeholder="0" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} className={inputStyle} />
              </div>
            </div>

            {/* HIỂN THỊ DỮ LIỆU ĐỘNG THEO DANH MỤC */}
            {renderDynamicFields()}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className={labelStyle}>Tình trạng</label>
                <div className="flex gap-2">
                   {['new', 'used'].map(cond => (
                     <button key={cond} type="button" onClick={() => setFormData({...formData, condition: cond as 'new' | 'used'})} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase border-2 transition-all ${formData.condition === cond ? 'bg-primary border-primary text-white shadow-lg' : 'bg-white border-gray-100 text-gray-400'}`}>{cond === 'new' ? 'Mới' : 'Đã dùng'}</button>
                   ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className={labelStyle}>Thành phố (Lọc)</label>
                <div className="relative">
                    <select value={formData.location} onChange={(e) => setFormData({...formData, location: e.target.value})} className={inputStyle}>
                        {LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                    </select>
                    {locationDetected && <div className="absolute right-8 top-1/2 -translate-y-1/2 text-green-500 text-xs font-bold">📍 GPS</div>}
                </div>
              </div>
            </div>

            {/* ĐỊA CHỈ CHI TIẾT */}
            <div className="space-y-2 animate-fade-in-up">
               <div className="flex justify-between items-end">
                   <label className={labelStyle}>Địa chỉ chi tiết (Hiện trên bản đồ)</label>
                   <button type="button" onClick={handleManualLocate} className="text-[10px] text-primary font-bold hover:underline flex items-center gap-1">
                       📍 Lấy vị trí hiện tại
                   </button>
               </div>
               <textarea 
                 value={formData.address} 
                 onChange={(e) => setFormData({...formData, address: e.target.value})} 
                 placeholder="Số nhà, Tên đường, Phường/Xã... (Để người mua tìm đường)"
                 className={`${inputStyle} h-20 resize-none`}
               />
            </div>

            <div className="space-y-2">
              <label className={labelStyle}>Mô tả chi tiết</label>
              <textarea rows={5} placeholder="Thông tin chi tiết..." value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className={inputStyle} />
            </div>

            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
               <input type="checkbox" id="agreed" checked={agreedToRules} onChange={(e) => setAgreedToRules(e.target.checked)} className="w-5 h-5 rounded-lg border-gray-300 text-primary" />
               <label htmlFor="agreed" className="text-[10px] font-bold text-gray-500 cursor-pointer uppercase tracking-tight">Cam kết thông tin chính xác</label>
            </div>

            <button type="submit" disabled={loading || aiAnalyzing} className="w-full bg-primary text-white font-black py-5 rounded-2xl hover:bg-primaryHover transition-all shadow-xl shadow-primary/20 flex items-center justify-center gap-3 active:scale-95 uppercase tracking-widest text-xs">
              {loading ? <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div> : 'Xác nhận đăng tin'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PostListing;
