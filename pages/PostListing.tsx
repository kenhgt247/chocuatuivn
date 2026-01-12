import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
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
  affiliateLink?: string | null;
}

const PostListing: React.FC<{ user: User | null }> = ({ user }) => {
  const navigate = useNavigate();
  const { id } = useParams(); // Lấy ID từ URL để biết là Sửa hay Đăng mới
  const isEditing = !!id;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
    
  // --- STATE ---
  const [listingType, setListingType] = useState<'normal' | 'affiliate'>('normal');
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  
  const [locationDetected, setLocationDetected] = useState<{lat: number, lng: number} | null>(null);
  const [agreedToRules, setAgreedToRules] = useState(false);

  // --- STATE VIDEO ---
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string>("");
  const [existingVideoUrl, setExistingVideoUrl] = useState<string | null>(null); // Giữ video cũ khi sửa
    
  const [formData, setFormData] = useState<ListingFormData>({
    title: '',
    category: '',
    price: '',
    description: '',
    location: user?.location || 'Toàn quốc',
    address: user?.address || '',
    condition: 'used',
    images: [],
    attributes: {},
    affiliateLink: ''
  });

  const inputStyle = "w-full bg-white border border-gray-200 rounded-2xl p-4 font-bold text-sm focus:outline-none focus:border-primary transition-all shadow-sm";
  const labelStyle = "text-[10px] font-black text-gray-400 uppercase tracking-widest px-1";
  const wrapperStyle = "space-y-1.5";

  // --- 1. LOAD DATA (SETTINGS & EDIT DATA) ---
  useEffect(() => {
    if (!user) { navigate('/login'); return; }

    const init = async () => {
        // 1. Load Settings
        const s = await db.getSettings();
        setSettings(s);

        // 2. Nếu là chế độ Sửa -> Load dữ liệu tin cũ
        if (isEditing && id) {
            setLoading(true);
            const listing = await db.getListingById(id);
            
            if (!listing) { alert("Tin không tồn tại"); return navigate('/'); }
            
            // Check quyền: Chính chủ HOẶC Admin đều được sửa
            if (listing.sellerId !== user.id && user.role !== 'admin') { 
                alert("Không có quyền sửa"); 
                return navigate('/'); 
            }

            setFormData({
                title: listing.title,
                category: listing.category,
                price: listing.price.toString(),
                description: listing.description,
                location: listing.location,
                address: listing.address || '',
                condition: listing.condition,
                images: listing.images,
                attributes: listing.attributes || {},
                affiliateLink: listing.affiliateLink || ''
            });

            if (listing.affiliateLink) setListingType('affiliate');
            if (listing.videoUrl) {
                setExistingVideoUrl(listing.videoUrl);
                setVideoPreview(listing.videoUrl);
            }
            setAgreedToRules(true); // Mặc định đã đồng ý khi sửa
            setLoading(false);
        }
    };

    init();

    // 3. Auto Locate (Chỉ chạy khi đăng mới)
    if (!isEditing && navigator.geolocation) {
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
  }, [user, navigate, id, isEditing]);

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

  // --- 2. RENDER DYNAMIC FIELDS ---
  const renderDynamicFields = () => {
    switch (formData.category) {
      case 'bat-dong-san': return (
          <div className="grid grid-cols-2 gap-4 animate-fade-in-up bg-blue-50 p-4 rounded-2xl border border-blue-100">
            <div className={wrapperStyle}><label className={labelStyle}>Diện tích (m²)</label><input type="number" placeholder="m²" className={inputStyle} value={formData.attributes.area || ''} onChange={(e) => updateAttr('area', e.target.value)} /></div>
            <div className={wrapperStyle}><label className={labelStyle}>Phòng ngủ</label><input type="number" placeholder="Số phòng" className={inputStyle} value={formData.attributes.bedrooms || ''} onChange={(e) => updateAttr('bedrooms', e.target.value)} /></div>
            <div className={wrapperStyle}><label className={labelStyle}>Số WC</label><input type="number" placeholder="Số phòng" className={inputStyle} value={formData.attributes.bathrooms || ''} onChange={(e) => updateAttr('bathrooms', e.target.value)} /></div>
            <div className={wrapperStyle}><label className={labelStyle}>Hướng nhà</label><input type="text" placeholder="Đông Nam..." className={inputStyle} value={formData.attributes.direction || ''} onChange={(e) => updateAttr('direction', e.target.value)} /></div>
            <div className={wrapperStyle}><label className={labelStyle}>Pháp lý</label><input type="text" placeholder="Sổ hồng/Sổ đỏ..." className={inputStyle} value={formData.attributes.legal || ''} onChange={(e) => updateAttr('legal', e.target.value)} /></div>
            <div className={wrapperStyle}><label className={labelStyle}>Loại hình</label><select className={inputStyle} value={formData.attributes.propertyType || ''} onChange={(e) => updateAttr('propertyType', e.target.value)}><option value="">Chọn loại</option><option value="Nhà ở">Nhà ở</option><option value="Đất nền">Đất nền</option><option value="Chung cư">Chung cư</option></select></div>
          </div>
      );
      case 'xe-co': return (
          <div className="grid grid-cols-2 gap-4 animate-fade-in-up bg-blue-50 p-4 rounded-2xl border border-blue-100">
            <div className={wrapperStyle}><label className={labelStyle}>Số Km (ODO)</label><input type="number" placeholder="Km" className={inputStyle} value={formData.attributes.mileage || ''} onChange={(e) => updateAttr('mileage', e.target.value)} /></div>
            <div className={wrapperStyle}><label className={labelStyle}>Năm sản xuất</label><input type="number" placeholder="YYYY" className={inputStyle} value={formData.attributes.year || ''} onChange={(e) => updateAttr('year', e.target.value)} /></div>
            <div className={wrapperStyle}><label className={labelStyle}>Hộp số</label><select className={inputStyle} value={formData.attributes.gearbox || ''} onChange={(e) => updateAttr('gearbox', e.target.value)}><option value="">Chọn</option><option value="Tự động">Tự động</option><option value="Số sàn">Số sàn</option></select></div>
            <div className={wrapperStyle}><label className={labelStyle}>Nhiên liệu</label><select className={inputStyle} value={formData.attributes.fuel || ''} onChange={(e) => updateAttr('fuel', e.target.value)}><option value="">Chọn</option><option value="Xăng">Xăng</option><option value="Dầu">Dầu</option><option value="Điện">Điện</option></select></div>
            <div className={wrapperStyle}><label className={labelStyle}>Kiểu dáng</label><input type="text" placeholder="Sedan/SUV..." className={inputStyle} value={formData.attributes.carType || ''} onChange={(e) => updateAttr('carType', e.target.value)} /></div>
            <div className={wrapperStyle}><label className={labelStyle}>Số chỗ</label><input type="number" placeholder="Chỗ" className={inputStyle} value={formData.attributes.seatCount || ''} onChange={(e) => updateAttr('seatCount', e.target.value)} /></div>
          </div>
      );
      case 'do-dien-tu': return (
          <div className="grid grid-cols-2 gap-4 animate-fade-in-up bg-blue-50 p-4 rounded-2xl border border-blue-100">
            <div className={wrapperStyle}><label className={labelStyle}>Pin (%)</label><input type="number" placeholder="%" className={inputStyle} value={formData.attributes.battery || ''} onChange={(e) => updateAttr('battery', e.target.value)} /></div>
            <div className={wrapperStyle}><label className={labelStyle}>Bộ nhớ</label><input type="text" placeholder="128GB..." className={inputStyle} value={formData.attributes.storage || ''} onChange={(e) => updateAttr('storage', e.target.value)} /></div>
            <div className={wrapperStyle}><label className={labelStyle}>RAM</label><input type="text" placeholder="8GB..." className={inputStyle} value={formData.attributes.ram || ''} onChange={(e) => updateAttr('ram', e.target.value)} /></div>
            <div className={wrapperStyle}><label className={labelStyle}>Màu sắc</label><input type="text" placeholder="Vàng/Đen..." className={inputStyle} value={formData.attributes.color || ''} onChange={(e) => updateAttr('color', e.target.value)} /></div>
            <div className={wrapperStyle}><label className={labelStyle}>Bảo hành</label><input type="text" placeholder="Tình trạng BH" className={inputStyle} value={formData.attributes.warranty || ''} onChange={(e) => updateAttr('warranty', e.target.value)} /></div>
          </div>
      );
      default: return null;
    }
  };

  // --- 3. XỬ LÝ ẢNH & VIDEO ---
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0 || !settings) return;
    const userTier = user?.subscriptionTier || 'free';
    const tierConfig = (settings.tierConfigs as any)[userTier];

    if (files.length + formData.images.length > tierConfig.maxImages) {
      return alert(`Gói ${tierConfig.name} tối đa ${tierConfig.maxImages} ảnh.`);
    }

    try {
        const compressedResults = await Promise.all(files.map(file => compressAndGetBase64(file)));
        const updatedImages = [...formData.images, ...compressedResults];
        setFormData(prev => ({ ...prev, images: updatedImages }));
        
        // Chỉ chạy AI nếu đang đăng mới và chưa có thông tin
        if (!isEditing && compressedResults.length > 0 && !formData.title) {
            runAIAnalysis(updatedImages);
        }
    } catch (error) { alert("Lỗi xử lý ảnh."); } 
    finally { if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const handleVideoClick = () => {
    if (!settings) return;
    const userTier = user?.subscriptionTier || 'free';
    const canUploadVideo = (settings.tierConfigs as any)[userTier]?.allowVideo;

    if (!canUploadVideo) {
      alert(`📹 Gói ${userTier.toUpperCase()} hiện không hỗ trợ đăng Video. Vui lòng nâng cấp!`);
      if (userTier !== 'pro') navigate('/upgrade');
      return;
    }
    videoInputRef.current?.click();
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 35 * 1024 * 1024) return alert("Dung lượng video tối đa 35MB");
      setVideoFile(file);
      setVideoPreview(URL.createObjectURL(file));
      setExistingVideoUrl(null); // Nếu chọn video mới -> Bỏ video cũ
    }
  };

  const removeVideo = () => {
      setVideoFile(null);
      setVideoPreview("");
      setExistingVideoUrl(null);
      if (videoInputRef.current) videoInputRef.current.value = '';
  };

  const runAIAnalysis = async (images: string[]) => {
    setAiAnalyzing(true);
    try {
      const analysis = await analyzeListingImages(images.slice(0, 3)).catch(() => null);
      if (analysis && analysis.title) {
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
    } catch (err) { console.log("AI skip"); }
    finally { setAiAnalyzing(false); }
  };

  // --- 4. SUBMIT FORM ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !settings) return;
    
    // Nếu là tạo mới -> check hạn mức ngày
    if (!isEditing) {
        const userTier = user.subscriptionTier || 'free';
        const tierConfig = (settings.tierConfigs as any)[userTier];
        const countToday = await db.countUserListingsToday(user.id);
        if (countToday >= tierConfig.postsPerDay) {
             return alert(`⚠️ Hạn mức đăng tin trong ngày đã hết!`);
        }
    }

    if (!formData.title.trim() || !formData.category || !formData.price || formData.images.length === 0) {
      return alert('Vui lòng điền đủ: Tiêu đề, Danh mục, Giá và ít nhất 1 Ảnh!');
    }
    
    if (listingType === 'affiliate' && !formData.affiliateLink) return alert('Nhập Link tiếp thị liên kết.');
    if (!agreedToRules) return alert('Vui lòng đồng ý quy tắc.');

    setLoading(true);
    try {
      // 1. Upload Video (Nếu có file mới)
      let finalVideoUrl = existingVideoUrl; 
      if (videoFile) {
          finalVideoUrl = await db.uploadVideo(videoFile, user.id);
      }

      // 2. Upload Ảnh
      const uploadedUrls = await Promise.all(
        formData.images.map((img, index) => 
          img.startsWith('data:') ? db.uploadImage(img, `listings/${user.id}/${Date.now()}_${index}.jpg`) : img
        )
      );

      // --- [NEW LOGIC] XỬ LÝ TRẠNG THÁI DUYỆT ---
      let status = 'pending';
      if (isEditing) {
          // Nếu Admin sửa -> Duyệt luôn
          // Nếu User thường sửa -> Chờ duyệt lại
          status = user.role === 'admin' ? 'approved' : 'pending';
      } else {
          // Nếu Đăng mới -> Check cấu hình gói VIP hoặc Affiliate
          if (listingType === 'affiliate' || (settings.tierConfigs as any)[user.subscriptionTier].autoApprove) {
              status = 'approved';
          }
      }

      // 3. Chuẩn bị Data
      const listingData: any = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        price: parseInt(formData.price.replace(/\D/g, '')),
        category: formData.category,
        images: uploadedUrls,
        videoUrl: finalVideoUrl || null,
        location: formData.location, 
        address: formData.address,
        condition: listingType === 'affiliate' ? 'new' : formData.condition,
        attributes: formData.attributes,
        
        // Sử dụng status đã tính toán ở trên
        status: status,
        
        tier: listingType === 'affiliate' ? 'pro' : user.subscriptionTier, 
        affiliateLink: listingType === 'affiliate' ? formData.affiliateLink : null,
        lat: locationDetected?.lat || null,
        lng: locationDetected?.lng || null,
      };

      // [QUAN TRỌNG] Giữ nguyên SellerID nếu đang sửa (để Admin sửa được tin của User khác)
      if (!isEditing) {
          listingData.sellerId = user.id;
          listingData.sellerName = user.name;
          listingData.sellerAvatar = user.avatar || '';
      }
      
      // 4. Lưu hoặc Cập nhật
      if (isEditing && id) {
          await db.updateListingContent(id, listingData);
          if (user.role === 'admin') {
              alert("✅ Admin đã cập nhật tin thành công (Không cần duyệt lại).");
          } else {
              alert("✅ Cập nhật thành công! Tin sẽ chờ duyệt lại.");
          }
          navigate(`/san-pham/${id}`);
      } else {
          await db.saveListing(listingData);
          alert("🎉 Đăng tin thành công!");
          navigate('/manage-ads');
      }

    } catch (error) {
      console.error(error);
      alert("Lỗi khi xử lý tin. Thử lại sau.");
    } finally {
      setLoading(false);
    }
  };

  if (!settings) return <div className="h-96 flex items-center justify-center font-black text-primary animate-pulse uppercase tracking-widest text-xl">Đang tải dữ liệu...</div>;
  const currentTierConfig = (settings.tierConfigs as any)[user?.subscriptionTier || 'free'];
  const isVip = user?.subscriptionTier === 'pro';

  return (
    <div className="max-w-7xl mx-auto space-y-6 px-4 pb-20 pt-6 font-sans">
      <div className="text-center space-y-2 mb-6">
        <h1 className="text-3xl font-black text-gray-900 uppercase">{isEditing ? 'Chỉnh Sửa Tin' : 'Đăng Tin Mới'}</h1>
        <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-gray-100 border border-gray-200">
             <span className="text-xs font-bold text-gray-500 uppercase">{currentTierConfig.name}</span>
             {!isVip && <Link to="/upgrade" className="text-[10px] font-black text-primary hover:underline">NÂNG CẤP</Link>}
        </div>
      </div>

      {!isEditing && (
          <div className="bg-gray-100 p-1 rounded-xl flex max-w-md mx-auto mb-8">
            <button onClick={() => setListingType('normal')} className={`flex-1 py-3 rounded-lg text-xs font-bold uppercase transition-all ${listingType === 'normal' ? 'bg-white shadow text-primary' : 'text-gray-400'}`}>📦 Bán đồ cũ</button>
            <button onClick={() => setListingType('affiliate')} className={`flex-1 py-3 rounded-lg text-xs font-bold uppercase transition-all ${listingType === 'affiliate' ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow' : 'text-gray-400'}`}>💰 Tiếp thị VIP</button>
          </div>
      )}

      {/* --- BỐ CỤC 2 CỘT CHO DESKTOP --- */}
      <div className="grid lg:grid-cols-12 gap-8">
        
        {/* CỘT TRÁI: MEDIA + QUY TẮC (Sidebar) */}
        <div className="lg:col-span-4 space-y-6">
           
           {/* Box Upload Media */}
           {listingType === 'affiliate' && !isVip ? (
              <div className="bg-orange-50 border border-orange-100 rounded-2xl p-8 text-center space-y-4">
                  <div className="text-4xl">👑</div>
                  <h3 className="text-sm font-black text-orange-600 uppercase">Dành cho VIP PRO</h3>
                  <p className="text-[10px] text-orange-400 font-bold">Vui lòng nâng cấp để sử dụng tính năng kiếm tiền.</p>
                  <Link to="/upgrade" className="block w-full bg-orange-500 text-white py-4 rounded-xl font-bold text-xs">Nâng cấp ngay</Link>
              </div>
           ) : (
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <label className={labelStyle}>Media ({formData.images.length}/{currentTierConfig.maxImages})</label>
                    {aiAnalyzing && <span className="text-[9px] font-bold text-blue-500 animate-pulse uppercase">AI Đang quét...</span>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Danh sách ảnh */}
                  {formData.images.map((img, i) => (
                    <div key={i} className="aspect-square rounded-xl overflow-hidden border border-gray-200 relative group">
                      <img src={img} className="w-full h-full object-cover" alt="" />
                      <button type="button" onClick={() => setFormData(p => ({...p, images: p.images.filter((_, idx) => idx !== i)}))} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all">✕</button>
                    </div>
                  ))}
                  
                  {/* Nút thêm ảnh */}
                  {formData.images.length < currentTierConfig.maxImages && (
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="aspect-square bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:border-primary hover:text-primary transition-all">
                      <span className="text-3xl font-light">+</span>
                      <span className="text-[9px] font-black uppercase mt-1">Tải ảnh</span>
                    </button>
                  )}

                  {/* Ô ĐĂNG VIDEO */}
                  {!videoPreview ? (
                      <button 
                        type="button" 
                        onClick={handleVideoClick}
                        className={`aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center transition-all ${currentTierConfig.allowVideo ? 'bg-blue-50 border-blue-200 text-blue-500 hover:border-blue-400' : 'bg-gray-50 border-gray-200 text-gray-300 opacity-50 cursor-not-allowed'}`}
                      >
                         <span className="text-2xl">📹</span>
                         <span className="text-[9px] font-black uppercase mt-1">Video</span>
                         {!currentTierConfig.allowVideo && <span className="text-[7px] text-red-400 mt-0.5 font-bold">VIP Only</span>}
                      </button>
                  ) : (
                    <div className="aspect-square rounded-xl overflow-hidden border border-blue-200 relative group shadow-lg">
                      <video src={videoPreview} className="w-full h-full object-cover" />
                      <button type="button" onClick={removeVideo} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1.5 shadow-md">✕</button>
                    </div>
                  )}
                </div>
                
                <input type="file" ref={fileInputRef} onChange={handleImageUpload} multiple accept="image/*" className="hidden" />
                <input type="file" ref={videoInputRef} onChange={handleVideoChange} accept="video/*" className="hidden" />
                <p className="text-[9px] text-gray-400 text-center mt-3 font-medium italic">Tối đa {currentTierConfig.maxImages} ảnh & 1 video</p>
              </div>
           )}

           {/* Box Quy tắc (Đã chuyển sang trái) */}
           <div className="bg-blue-50/50 border border-blue-100 p-5 rounded-2xl space-y-4">
                <div className="flex items-center gap-2 text-blue-600">
                    <span className="text-xl">🛡️</span>
                    <h3 className="font-black text-xs uppercase">Quy tắc đăng tin</h3>
                </div>
                <ul className="space-y-3">
                    {[
                        "Không đăng hàng cấm, hàng giả.",
                        "Hình ảnh rõ nét, không chèn SĐT.",
                        "Giá bán niêm yết rõ ràng.",
                        "Mô tả trung thực về sản phẩm.",
                        "Tin đăng trùng lặp sẽ bị xóa."
                    ].map((rule, i) => (
                        <li key={i} className="flex gap-2 text-[10px] text-gray-600 font-medium leading-relaxed">
                            <span className="text-blue-400">•</span>
                            {rule}
                        </li>
                    ))}
                </ul>
            </div>

            {/* Box Mẹo Bán Nhanh (Đã chuyển sang trái) */}
            <div className="bg-yellow-50/50 border border-yellow-100 p-5 rounded-2xl space-y-4">
                <div className="flex items-center gap-2 text-yellow-600">
                    <span className="text-xl">⚡</span>
                    <h3 className="font-black text-xs uppercase">Mẹo bán nhanh</h3>
                </div>
                <ul className="space-y-3">
                    <li className="flex gap-2 text-[10px] text-gray-600 font-medium"><span className="text-yellow-400">★</span> Nên có Video quay thực tế.</li>
                    <li className="flex gap-2 text-[10px] text-gray-600 font-medium"><span className="text-yellow-400">★</span> Viết tiêu đề đầy đủ tên hãng.</li>
                    <li className="flex gap-2 text-[10px] text-gray-600 font-medium"><span className="text-yellow-400">★</span> Chia sẻ tin lên Facebook.</li>
                </ul>
            </div>
        </div>

        {/* CỘT PHẢI: FORM CHÍNH (Main Content) */}
        <div className="lg:col-span-8">
              {(listingType === 'normal' || isVip) && (
                  <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-3xl p-8 shadow-xl shadow-gray-100/50 space-y-6">
                    
                    {listingType === 'affiliate' && (
                        <div className="space-y-2 bg-orange-50 p-6 rounded-2xl border border-orange-100">
                            <label className="text-[10px] font-black text-orange-600 uppercase tracking-widest px-1">Link Tiếp Thị Liên Kết *</label>
                            <input type="url" required placeholder="Dán link Shopee, Lazada..." value={formData.affiliateLink || ''} onChange={(e) => setFormData({...formData, affiliateLink: e.target.value})} className="w-full bg-white border border-orange-200 rounded-xl p-4 font-bold text-sm focus:outline-none focus:border-orange-500 text-orange-700 placeholder-orange-300" />
                        </div>
                    )}

                    <div className="space-y-2">
                      <label className={labelStyle}>Tiêu đề *</label>
                      <input type="text" placeholder="Ví dụ: iPhone 15 Pro Max 256GB Chính hãng..." value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} className={inputStyle} />
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className={labelStyle}>Danh mục *</label>
                        <select value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value, attributes: {}})} className={inputStyle}>
                          <option value="">-- Chọn --</option>
                          {CATEGORIES.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className={labelStyle}>Giá bán (VNĐ) *</label>
                        <input type="number" placeholder="0" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} className={inputStyle} />
                      </div>
                    </div>

                    {renderDynamicFields()}

                    <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <label className={labelStyle}>Khu vực</label>
                            <select value={formData.location} onChange={(e) => setFormData({...formData, location: e.target.value})} className={inputStyle}>
                                {LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label className={labelStyle}>Tình trạng</label>
                            <select value={formData.condition} onChange={(e) => setFormData({...formData, condition: e.target.value as any})} className={inputStyle}>
                                <option value="used">Đã qua sử dụng</option>
                                <option value="new">Mới 100%</option>
                            </select>
                          </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-end px-1">
                          <label className={labelStyle}>Địa chỉ chi tiết</label>
                          <button type="button" onClick={handleManualLocate} className="text-[9px] font-black text-blue-500 uppercase flex items-center gap-1 hover:text-blue-600">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                              Lấy vị trí hiện tại
                          </button>
                      </div>
                      <textarea value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} className={`${inputStyle} h-24 resize-none`} placeholder="Số nhà, đường, phường/xã..." />
                    </div>

                    <div className="space-y-2">
                      <label className={labelStyle}>Mô tả chi tiết</label>
                      <textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className={`${inputStyle} h-40 leading-relaxed`} placeholder="Mô tả kỹ về sản phẩm, tình trạng, phụ kiện đi kèm..." />
                    </div>

                    <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                        <input type="checkbox" id="rules" checked={agreedToRules} onChange={e => setAgreedToRules(e.target.checked)} className="w-5 h-5 text-primary rounded border-gray-300 focus:ring-primary" />
                        <label htmlFor="rules" className="text-[11px] font-bold text-gray-500 uppercase cursor-pointer select-none">Tôi cam kết tuân thủ quy tắc cộng đồng của Chợ Của Tui</label>
                    </div>

                    <button type="submit" disabled={loading} className={`w-full py-5 rounded-2xl font-black text-sm uppercase shadow-xl text-white transition-all transform active:scale-95 ${listingType === 'affiliate' ? 'bg-gradient-to-r from-orange-500 to-red-500 shadow-orange-200' : 'bg-primary hover:bg-primaryHover shadow-primary/30'}`}>
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Đang xử lý...
                            </span>
                        ) : (
                            isEditing ? 'Lưu thay đổi' : (listingType === 'affiliate' ? 'Đăng tin kiếm tiền ngay' : 'Đăng tin bán ngay')
                        )}
                    </button>
                  </form>
              )}
        </div>

      </div>
    </div>
  );
};

export default PostListing;
