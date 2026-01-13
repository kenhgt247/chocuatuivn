import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { db, SystemSettings } from '../services/db'; 
import { User, Category, CategoryAttribute } from '../types';
import { analyzeListingImages } from '../services/geminiService'; 
import { getLocationFromCoords } from '../utils/locationHelper';
import { compressAndGetBase64 } from '../utils/imageCompression';
import { LOCATIONS } from '../constants'; // Chỉ lấy danh sách Tỉnh/TP

interface ListingFormData {
  title: string;
  price: string;
  description: string;
  location: string;
  address: string;
  condition: 'new' | 'used';
  images: string[];
  attributes: Record<string, string>; // Lưu các trường động (RAM, ODO...)
  affiliateLink?: string | null;
}

const PostListing: React.FC<{ user: User | null }> = ({ user }) => {
  const navigate = useNavigate();
  const { id } = useParams(); // Lấy ID nếu đang sửa tin
  const isEditing = !!id;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
    
  // --- STATE QUẢN LÝ DANH MỤC ĐỘNG ---
  const [categories, setCategories] = useState<Category[]>([]); // Tất cả danh mục từ DB
  const [selectedParentId, setSelectedParentId] = useState<string>(""); // ID danh mục Cha
  const [selectedChildId, setSelectedChildId] = useState<string>("");   // ID danh mục Con
  const [currentAttributes, setCurrentAttributes] = useState<CategoryAttribute[]>([]); // Cấu hình trường nhập liệu

  // --- STATE KHÁC ---
  const [listingType, setListingType] = useState<'normal' | 'affiliate'>('normal');
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [locationDetected, setLocationDetected] = useState<{lat: number, lng: number} | null>(null);
  const [agreedToRules, setAgreedToRules] = useState(false);

  // --- STATE VIDEO & FORM ---
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string>("");
  const [existingVideoUrl, setExistingVideoUrl] = useState<string | null>(null);
    
  const [formData, setFormData] = useState<ListingFormData>({
    title: '',
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
  const labelStyle = "text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 mb-1 block";

  // --- 1. LOAD DATA ---
  useEffect(() => {
    if (!user) { navigate('/login'); return; }

    const init = async () => {
        // Load Settings & Categories từ DB
        const [s, cats] = await Promise.all([db.getSettings(), db.getCategories()]);
        setSettings(s);
        setCategories(cats);

        // Nếu là chế độ Sửa -> Load dữ liệu tin cũ
        if (isEditing && id) {
            setLoading(true);
            const listing = await db.getListingById(id);
            
            if (!listing) { alert("Tin không tồn tại"); return navigate('/'); }
            if (listing.sellerId !== user.id && user.role !== 'admin') { alert("Không có quyền sửa"); return navigate('/'); }

            // Logic phục hồi danh mục Cha/Con
            const currentCat = cats.find(c => c.id === listing.category);
            if (currentCat) {
                if (currentCat.parentId) {
                    setSelectedParentId(currentCat.parentId);
                    setSelectedChildId(currentCat.id);
                    setCurrentAttributes(currentCat.attributes || []);
                } else {
                    setSelectedParentId(currentCat.id);
                }
            }

            setFormData({
                title: listing.title,
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
            setAgreedToRules(true);
            setLoading(false);
        }
    };

    init();

    // Auto Locate
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

  // --- XỬ LÝ KHI CHỌN DANH MỤC CHA ---
  const handleParentCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const pId = e.target.value;
      setSelectedParentId(pId);
      setSelectedChildId(""); // Reset con
      setCurrentAttributes([]); // Reset form động
      setFormData(prev => ({ ...prev, attributes: {} })); 
  };

  // --- XỬ LÝ KHI CHỌN DANH MỤC CON ---
  const handleChildCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const cId = e.target.value;
      setSelectedChildId(cId);
      
      const childCat = categories.find(c => c.id === cId);
      if (childCat) {
          setCurrentAttributes(childCat.attributes || []);
      } else {
          setCurrentAttributes([]);
      }
  };

  // --- RENDER FORM ĐỘNG ---
  const renderDynamicFields = () => {
      if (currentAttributes.length === 0) return null;

      return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in-up bg-blue-50/50 p-5 rounded-3xl border border-blue-100">
              <div className="col-span-1 md:col-span-2 text-xs font-black text-blue-500 uppercase tracking-widest mb-2 border-b border-blue-100 pb-2">
                  Thông tin chi tiết
              </div>
              {currentAttributes.map((attr) => (
                  <div key={attr.key} className="space-y-1">
                      <label className={labelStyle}>
                          {attr.label} {attr.required && <span className="text-red-500">*</span>}
                      </label>
                      
                      {attr.type === 'select' ? (
                          <select 
                              className={inputStyle}
                              value={formData.attributes[attr.key] || ''}
                              onChange={(e) => setFormData(prev => ({
                                  ...prev, 
                                  attributes: { ...prev.attributes, [attr.key]: e.target.value }
                              }))}
                              required={attr.required}
                          >
                              <option value="">-- Chọn {attr.label} --</option>
                              {attr.options?.map((opt) => (
                                  <option key={opt} value={opt}>{opt}</option>
                              ))}
                          </select>
                      ) : (
                          <div className="relative">
                              <input 
                                  type={attr.type === 'number' ? 'number' : 'text'}
                                  className={inputStyle}
                                  placeholder={`Nhập ${attr.label.toLowerCase()}...`}
                                  value={formData.attributes[attr.key] || ''}
                                  onChange={(e) => setFormData(prev => ({
                                      ...prev, 
                                      attributes: { ...prev.attributes, [attr.key]: e.target.value }
                                  }))}
                                  required={attr.required}
                              />
                              {attr.suffix && (
                                  <span className="absolute right-4 top-4 text-gray-400 text-xs font-bold pointer-events-none">
                                      {attr.suffix}
                                  </span>
                              )}
                          </div>
                      )}
                  </div>
              ))}
          </div>
      );
  };

  // --- CÁC HÀM XỬ LÝ KHÁC ---
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
      if (file.size > 50 * 1024 * 1024) return alert("Dung lượng video tối đa 50MB");
      setVideoFile(file);
      setVideoPreview(URL.createObjectURL(file));
      setExistingVideoUrl(null);
    }
  };

  // --- AI ANALYSIS ---
  const runAIAnalysis = async (images: string[]) => {
    setAiAnalyzing(true);
    try {
      const analysis = await analyzeListingImages(images.slice(0, 3)).catch(() => null);
      if (analysis) {
        let foundChildId = "";
        let foundParentId = "";
        let newAttributes: any[] = [];

        const detectedCategory = categories.find(c => c.id === analysis.category);
        if (detectedCategory) {
            if (detectedCategory.parentId) {
                foundChildId = detectedCategory.id;
                foundParentId = detectedCategory.parentId;
                newAttributes = detectedCategory.attributes || [];
            } else {
                foundParentId = detectedCategory.id;
            }
        }

        if (foundParentId) setSelectedParentId(foundParentId);
        if (foundChildId) setSelectedChildId(foundChildId);
        if (newAttributes.length > 0) setCurrentAttributes(newAttributes);

        setFormData(prev => ({
          ...prev,
          title: (!prev.title) ? (analysis.title || '') : prev.title,
          category: foundChildId || foundParentId || prev.category,
          price: (!prev.price) ? (analysis.suggestedPrice?.toString() || '') : prev.price,
          description: (!prev.description) ? (analysis.description || '') : prev.description,
          condition: (analysis.condition as 'new' | 'used') || prev.condition,
          attributes: { ...prev.attributes, ...(analysis.attributes || {}) }
        }));
      }
    } catch (err) { console.log("AI skip"); }
    finally { setAiAnalyzing(false); }
  };

  // --- SUBMIT ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !settings) return;
    
    if (!isEditing) {
        const userTier = user.subscriptionTier || 'free';
        const tierConfig = (settings.tierConfigs as any)[userTier];
        const countToday = await db.countUserListingsToday(user.id);
        if (countToday >= tierConfig.postsPerDay) {
             return alert(`⚠️ Hạn mức đăng tin trong ngày đã hết!`);
        }
    }

    // Validate danh mục con
    const hasChildren = categories.some(c => c.parentId === selectedParentId);
    if (hasChildren && !selectedChildId) {
        return alert("Vui lòng chọn 'Chi tiết' danh mục.");
    }
    
    const finalCategoryId = selectedChildId || selectedParentId; 

    if (!formData.title.trim() || !finalCategoryId || !formData.price || formData.images.length === 0) {
      return alert('Vui lòng điền đủ: Tiêu đề, Danh mục, Giá và ít nhất 1 Ảnh!');
    }
    
    if (listingType === 'affiliate' && !formData.affiliateLink) return alert('Nhập Link tiếp thị liên kết.');
    if (!agreedToRules) return alert('Vui lòng đồng ý quy tắc.');

    setLoading(true);
    try {
      let finalVideoUrl = existingVideoUrl; 
      if (videoFile) {
          finalVideoUrl = await db.uploadVideo(videoFile, user.id);
      }

      const uploadedUrls = await Promise.all(
        formData.images.map((img, index) => 
          img.startsWith('data:') ? db.uploadImage(img, `listings/${user.id}/${Date.now()}_${index}.jpg`) : img
        )
      );

      let status = 'pending';
      if (isEditing) {
          status = user.role === 'admin' ? 'approved' : 'pending';
      } else {
          if (listingType === 'affiliate' || (settings.tierConfigs as any)[user.subscriptionTier].autoApprove) {
              status = 'approved';
          }
      }

      const listingData: any = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        price: parseInt(formData.price.replace(/\D/g, '')),
        category: finalCategoryId,
        images: uploadedUrls,
        videoUrl: finalVideoUrl || null,
        location: formData.location, 
        address: formData.address,
        condition: listingType === 'affiliate' ? 'new' : formData.condition,
        attributes: formData.attributes,
        status: status,
        tier: listingType === 'affiliate' ? 'pro' : user.subscriptionTier, 
        affiliateLink: listingType === 'affiliate' ? formData.affiliateLink : null,
        lat: locationDetected?.lat || null,
        lng: locationDetected?.lng || null,
      };

      if (!isEditing) {
          listingData.sellerId = user.id;
          listingData.sellerName = user.name;
          listingData.sellerAvatar = user.avatar || '';
      }
      
      if (isEditing && id) {
          await db.updateListingContent(id, listingData);
          if (user.role === 'admin') {
              alert("✅ Admin đã cập nhật tin thành công.");
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

  // Lọc danh sách cha/con
  const parentCategories = categories.filter(c => !c.parentId);
  const childCategories = categories.filter(c => c.parentId === selectedParentId);
  const hasChildren = childCategories.length > 0; // Biến kiểm tra có con hay không

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
            <button onClick={() => setListingType('normal')} className={`flex-1 py-3 rounded-lg text-xs font-bold uppercase transition-all ${listingType === 'normal' ? 'bg-white shadow text-primary' : 'text-gray-400'}`}>📦 Bán ngay</button>
            <button onClick={() => setListingType('affiliate')} className={`flex-1 py-3 rounded-lg text-xs font-bold uppercase transition-all ${listingType === 'affiliate' ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow' : 'text-gray-400'}`}>💰 Tiếp thị VIP</button>
          </div>
      )}

      <div className="grid lg:grid-cols-12 gap-8">
        
        {/* CỘT TRÁI: MEDIA */}
        <div className="lg:col-span-4 space-y-6">
           {listingType === 'affiliate' && !isVip ? (
              <div className="bg-orange-50 border border-orange-100 rounded-2xl p-8 text-center space-y-4">
                  <div className="text-4xl">👑</div>
                  <h3 className="text-sm font-black text-orange-600 uppercase">Dành cho VIP PRO</h3>
                  <Link to="/upgrade" className="block w-full bg-orange-500 text-white py-4 rounded-xl font-bold text-xs">Nâng cấp ngay</Link>
              </div>
           ) : (
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <label className={labelStyle}>Media ({formData.images.length}/{currentTierConfig.maxImages})</label>
                    {aiAnalyzing && <span className="text-[9px] font-bold text-blue-500 animate-pulse uppercase">AI Đang quét...</span>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {formData.images.map((img, i) => (
                    <div key={i} className="aspect-square rounded-xl overflow-hidden border border-gray-200 relative group">
                      <img src={img} className="w-full h-full object-cover" alt="" />
                      <button type="button" onClick={() => setFormData(p => ({...p, images: p.images.filter((_, idx) => idx !== i)}))} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all">✕</button>
                    </div>
                  ))}
                  
                  {formData.images.length < currentTierConfig.maxImages && (
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="aspect-square bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:border-primary hover:text-primary transition-all">
                      <span className="text-3xl font-light">+</span>
                      <span className="text-[9px] font-black uppercase mt-1">Tải ảnh</span>
                    </button>
                  )}

                  {!videoPreview ? (
                      <button 
                        type="button" 
                        onClick={handleVideoClick}
                        className={`aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center transition-all ${currentTierConfig.allowVideo ? 'bg-blue-50 border-blue-200 text-blue-500 hover:border-blue-400' : 'bg-gray-50 border-gray-200 text-gray-300 opacity-50 cursor-not-allowed'}`}
                      >
                         <span className="text-2xl">📹</span>
                         <span className="text-[9px] font-black uppercase mt-1">Video</span>
                      </button>
                  ) : (
                    <div className="aspect-square rounded-xl overflow-hidden border border-blue-200 relative group shadow-lg">
                      <video src={videoPreview} className="w-full h-full object-cover" />
                      <button type="button" onClick={() => { setVideoFile(null); setVideoPreview(""); setExistingVideoUrl(null); }} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1.5 shadow-md">✕</button>
                    </div>
                  )}
                </div>
                
                <input type="file" ref={fileInputRef} onChange={handleImageUpload} multiple accept="image/*" className="hidden" />
                <input type="file" ref={videoInputRef} onChange={handleVideoChange} accept="video/*" className="hidden" />
              </div>
           )}

           <div className="bg-blue-50/50 border border-blue-100 p-5 rounded-2xl space-y-4">
                <h3 className="font-black text-xs uppercase text-blue-600">Quy tắc đăng tin</h3>
                <ul className="space-y-3">
                    {["Không bán hàng cấm.", "Ảnh rõ nét, thật.", "Mô tả trung thực."].map((rule, i) => (
                        <li key={i} className="flex gap-2 text-[10px] text-gray-600 font-medium"><span className="text-blue-400">•</span> {rule}</li>
                    ))}
                </ul>
            </div>
        </div>

        {/* CỘT PHẢI: FORM CHÍNH */}
        <div className="lg:col-span-8">
              {(listingType === 'normal' || isVip) && (
                  <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-3xl p-8 shadow-xl shadow-gray-100/50 space-y-6">
                    
                    {listingType === 'affiliate' && (
                        <div className="space-y-2 bg-orange-50 p-6 rounded-2xl border border-orange-100">
                            <label className={labelStyle}>Link Tiếp Thị Liên Kết *</label>
                            <input type="url" required placeholder="Dán link Shopee, Lazada..." value={formData.affiliateLink || ''} onChange={(e) => setFormData({...formData, affiliateLink: e.target.value})} className={inputStyle} />
                        </div>
                    )}

                    <div className="space-y-1">
                      <label className={labelStyle}>Tiêu đề *</label>
                      <input type="text" placeholder="Ví dụ: iPhone 15 Pro Max 256GB..." value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} className={inputStyle} />
                    </div>

                    {/* --- [ĐÃ SỬA LỖI UI] KHU VỰC CHỌN DANH MỤC --- */}
                    <div className="grid grid-cols-2 gap-6 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                      <div className="space-y-1">
                        <label className={labelStyle}>Danh mục Chính *</label>
                        <select value={selectedParentId} onChange={handleParentCategoryChange} className={inputStyle}>
                          <option value="">-- Chọn --</option>
                          {parentCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>)}
                        </select>
                      </div>
                      
                      <div className="space-y-1">
                        {/* Chỉ hiện dấu * khi có danh mục con */}
                        <label className={labelStyle}>
                            Chi tiết {hasChildren && <span className="text-red-500">*</span>}
                        </label>
                        <select 
                            value={selectedChildId} 
                            onChange={handleChildCategoryChange} 
                            className={inputStyle}
                            disabled={!selectedParentId || !hasChildren}
                        >
                          <option value="">
                              {hasChildren ? "-- Chọn loại --" : "Không có mục con"}
                          </option>
                          {childCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>)}
                        </select>
                      </div>
                    </div>

                    {renderDynamicFields()}

                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-1">
                        <label className={labelStyle}>Giá bán (VNĐ) *</label>
                        <input type="text" placeholder="0" value={formData.price ? Number(formData.price).toLocaleString('vi-VN') : ''} onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '');
                            setFormData({...formData, price: val});
                        }} className={inputStyle} />
                      </div>
                      <div className="space-y-1">
                        <label className={labelStyle}>Tình trạng</label>
                        <select value={formData.condition} onChange={(e) => setFormData({...formData, condition: e.target.value as any})} className={inputStyle}>
                            <option value="used">Đã qua sử dụng</option>
                            <option value="new">Mới 100%</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-1">
                            <label className={labelStyle}>Khu vực</label>
                            <select value={formData.location} onChange={(e) => setFormData({...formData, location: e.target.value})} className={inputStyle}>
                                {LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                            </select>
                          </div>
                          <div className="space-y-1">
                             <div className="flex justify-between items-center mb-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Địa chỉ chi tiết</label>
                                <button type="button" onClick={handleManualLocate} className="text-[9px] font-black text-blue-500 uppercase flex items-center gap-1 hover:text-blue-600">
                                    📍 Lấy vị trí
                                </button>
                             </div>
                             <input type="text" value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} className={inputStyle} placeholder="Số nhà, đường..." />
                          </div>
                    </div>

                    <div className="space-y-1">
                      <label className={labelStyle}>Mô tả chi tiết</label>
                      <textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className={`${inputStyle} h-40 leading-relaxed`} placeholder="Mô tả kỹ về sản phẩm..." />
                    </div>

                    <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                        <input type="checkbox" id="rules" checked={agreedToRules} onChange={e => setAgreedToRules(e.target.checked)} className="w-5 h-5 text-primary rounded" />
                        <label htmlFor="rules" className="text-[11px] font-bold text-gray-500 uppercase cursor-pointer">Tôi cam kết tuân thủ quy tắc cộng đồng</label>
                    </div>

                    <button type="submit" disabled={loading} className={`w-full py-5 rounded-2xl font-black text-sm uppercase shadow-xl text-white transition-all transform active:scale-95 ${listingType === 'affiliate' ? 'bg-gradient-to-r from-orange-500 to-red-500' : 'bg-primary hover:bg-primaryHover'}`}>
                        {loading ? 'Đang xử lý...' : (isEditing ? 'Lưu thay đổi' : 'Đăng tin ngay')}
                    </button>
                  </form>
              )}
        </div>
      </div>
    </div>
  );
};

export default PostListing;
