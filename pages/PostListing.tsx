import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { db, SystemSettings } from '../services/db';
import { User, Category, CategoryAttribute } from '../types';
import { analyzeListingImages, ListingAnalysis } from '../services/geminiService';
import { getLocationFromCoords } from '../utils/locationHelper';
import { compressAndGetBase64 } from '../utils/imageCompression';
import { LOCATIONS } from '../constants';

interface ListingFormData {
  title: string;
  price: string;
  description: string;
  location: string;
  address: string;
  condition: 'new' | 'used';
  images: string[];
  attributes: Record<string, string>;
  affiliateLink?: string | null;
  isAuction: boolean;
  auctionEndAt: string;
  bidIncrement: string;
}

const PostListing: React.FC<{ user: User | null }> = ({ user }) => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // --- STATE ---
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedParentId, setSelectedParentId] = useState<string>("");
  const [selectedChildId, setSelectedChildId] = useState<string>("");
  const [currentAttributes, setCurrentAttributes] = useState<CategoryAttribute[]>([]);

  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  
  // AI State
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [priceSuggestions, setPriceSuggestions] = useState<{fast: number, market: number, high: number} | null>(null);

  const [locationDetected, setLocationDetected] = useState<{ lat: number, lng: number } | null>(null);
  const [agreedToRules, setAgreedToRules] = useState(false);
  const [listingType, setListingType] = useState<'normal' | 'affiliate'>('normal');

  const [postsToday, setPostsToday] = useState(0);
  const [maxPosts, setMaxPosts] = useState(0);
  const [isLimitReached, setIsLimitReached] = useState(false);

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string>("");
  const [existingVideoUrl, setExistingVideoUrl] = useState<string | null>(null);

  const [formData, setFormData] = useState<ListingFormData>({
    title: '', price: '', description: '', location: user?.location || 'Toàn quốc', address: user?.address || '',
    condition: 'used', images: [], attributes: {}, affiliateLink: '',
    isAuction: false, auctionEndAt: '', bidIncrement: '50000'
  });

  // [FIX UI] Input Style
  const inputStyle = "w-full min-w-0 bg-white border border-gray-200 rounded-xl p-3 md:p-4 text-sm font-semibold focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all shadow-sm placeholder:font-normal placeholder:text-gray-400";
  const labelStyle = "text-[11px] font-bold text-gray-500 uppercase tracking-wide px-1 mb-1.5 block truncate";

  // --- INITIALIZE ---
  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    const init = async () => {
      try {
        const [s, cats, count] = await Promise.all([
          db.getSettings(),
          db.getCategories(),
          !isEditing ? db.countUserListingsToday(user.id) : Promise.resolve(0)
        ]);
        setSettings(s);
        setCategories(cats);
        setPostsToday(count);
        
        const userTier = user.subscriptionTier || 'free';
        const limit = (s?.tierConfigs as any)?.[userTier]?.postsPerDay || 5;
        setMaxPosts(limit);
        if (!isEditing && count >= limit) setIsLimitReached(true);

        if (isEditing && id) {
          setLoading(true);
          const listing = await db.getListingById(id);
          if (!listing) { alert("Tin không tồn tại"); return navigate('/'); }
          if (listing.sellerId !== user.id && user.role !== 'admin') { alert("Không có quyền sửa"); return navigate('/'); }

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
            title: listing.title, price: listing.price.toString(), description: listing.description,
            location: listing.location, address: listing.address || '', condition: listing.condition,
            images: listing.images, attributes: listing.attributes || {}, affiliateLink: listing.affiliateLink || '',
            isAuction: listing.isAuction || false, auctionEndAt: listing.auctionEndAt ? new Date(listing.auctionEndAt).toISOString().slice(0, 16) : '',
            bidIncrement: listing.bidIncrement?.toString() || '50000'
          });
          if (listing.affiliateLink) setListingType('affiliate');
          if (listing.videoUrl) { setExistingVideoUrl(listing.videoUrl); setVideoPreview(listing.videoUrl); }
          setAgreedToRules(true);
          setLoading(false);
        }
      } catch (error) { console.error(error); }
    };
    init();
    if (!isEditing && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
          const { latitude, longitude } = pos.coords;
          setLocationDetected({ lat: latitude, lng: longitude });
          try {
            const info = await getLocationFromCoords(latitude, longitude);
            setFormData(prev => ({ ...prev, location: info.city || prev.location, address: info.address || prev.address }));
          } catch (e) { }
      }, null, { timeout: 10000 });
    }
  }, [user, navigate, id, isEditing]);

  // --- HANDLERS ---
  const handleParentCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const pId = e.target.value;
    setSelectedParentId(pId);
    setSelectedChildId("");
    setCurrentAttributes([]);
    setFormData(prev => ({ ...prev, attributes: {} }));
  };

  const handleChildCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cId = e.target.value;
    setSelectedChildId(cId);
    const childCat = categories.find(c => c.id === cId);
    if (childCat) setCurrentAttributes(childCat.attributes || []);
    else setCurrentAttributes([]);
  };

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
      if (window.confirm(`📹 Gói ${userTier.toUpperCase()} không hỗ trợ đăng Video.\nBạn có muốn nâng cấp lên VIP không?`)) {
        navigate('/upgrade');
      }
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

  // --- AI LOGIC ---
  const runAIAnalysis = async (images: string[]) => {
    setAiAnalyzing(true);
    try {
      const analysis = await analyzeListingImages(images.slice(0, 3)).catch(() => null);
      if (analysis) {
        let foundChildId = "", foundParentId = "", newAttributes: any[] = [];
        
        let detectedCategory = categories.find(c => c.id === analysis.category);
        if (!detectedCategory) {
             detectedCategory = categories.find(c => c.id.includes(analysis.category) || analysis.category.includes(c.id));
        }

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

        if (analysis.pricingStrategy) {
            setPriceSuggestions({
                fast: analysis.pricingStrategy.fastSell || 0,
                market: analysis.pricingStrategy.suggested || 0,
                high: analysis.pricingStrategy.highProfit || 0
            });
        }

        setFormData(prev => ({
          ...prev,
          title: analysis.title || prev.title,
          price: analysis.pricingStrategy?.suggested ? analysis.pricingStrategy.suggested.toString() : prev.price,
          description: analysis.description || prev.description,
          condition: (analysis.condition as 'new' | 'used') || prev.condition,
          category: foundChildId || foundParentId || prev.category,
          attributes: { ...prev.attributes, ...(analysis.attributes || {}) }
        }));
      }
    } catch (err) { console.log("AI skip", err); }
    finally { setAiAnalyzing(false); }
  };

  // --- SUBMIT ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !settings) return;

    if (!isEditing && postsToday >= maxPosts) {
      return alert(`⚠️ Hạn mức đăng tin trong ngày đã hết!`);
    }

    const hasChildren = categories.some(c => c.parentId === selectedParentId);
    if (hasChildren && !selectedChildId) return alert("Vui lòng chọn 'Chi tiết' danh mục.");
    const finalCategoryId = selectedChildId || selectedParentId;

    if (!formData.title.trim() || !finalCategoryId || !formData.price || formData.images.length === 0) {
      return alert('Vui lòng điền đủ: Tiêu đề, Danh mục, Giá và ít nhất 1 Ảnh!');
    }
    if (listingType === 'affiliate' && !formData.affiliateLink) return alert('Nhập Link tiếp thị liên kết.');
    if (!agreedToRules) return alert('Vui lòng đồng ý quy tắc cộng đồng trước khi đăng.');

    let auctionData = {};
    if (formData.isAuction) {
      if (!formData.auctionEndAt) return alert("Vui lòng chọn thời gian kết thúc đấu giá.");
      const end = new Date(formData.auctionEndAt);
      if (end <= new Date()) return alert("Thời gian kết thúc phải ở tương lai.");

      auctionData = {
        isAuction: true,
        auctionEndAt: end.toISOString(),
        bidIncrement: Number(formData.bidIncrement),
        bidsCount: 0,
        highestBidderId: null
      };
    } else {
        auctionData = { isAuction: false, auctionEndAt: null, bidIncrement: null, bidsCount: 0, highestBidderId: null }
    }

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
      if (isEditing) status = user.role === 'admin' ? 'approved' : 'pending';
      else if (listingType === 'affiliate' || (settings.tierConfigs as any)[user.subscriptionTier].autoApprove) status = 'approved';

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
        ...auctionData
      };

      if (!isEditing) {
        listingData.sellerId = user.id;
        listingData.sellerName = user.name;
        listingData.sellerAvatar = user.avatar || '';
      }

      if (isEditing && id) {
        await db.updateListingContent(id, listingData);
        alert("✅ Cập nhật thành công!");
        navigate(`/san-pham/${id}`);
      } else {
        await db.saveListing(listingData);
        const newCount = postsToday + 1;
        if (newCount >= maxPosts) {
          if (window.confirm(`🎉 Đăng tin thành công!\n\n⚠️ Bạn đã dùng hết ${newCount}/${maxPosts} lượt đăng hôm nay.\nHãy nâng cấp VIP để đăng không giới hạn?`)) {
            navigate('/upgrade');
          } else { navigate('/manage-ads'); }
        } else {
          alert("🎉 Đăng tin thành công!");
          navigate('/manage-ads');
        }
      }
    } catch (error) { console.error(error); alert("Lỗi xử lý. Thử lại sau."); } 
    finally { setLoading(false); }
  };

  const renderDynamicFields = () => {
    if (currentAttributes.length === 0) return null;
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in-up bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
        <div className="col-span-1 md:col-span-2 text-xs font-black text-blue-500 uppercase tracking-widest mb-2 border-b border-blue-100 pb-2">Thông tin chi tiết</div>
        {currentAttributes.map((attr) => (
          <div key={attr.key} className="space-y-1">
            <label className={labelStyle}>{attr.label} {attr.required && <span className="text-red-500">*</span>}</label>
            {attr.type === 'select' ? (
              <select className={inputStyle} value={formData.attributes[attr.key] || ''} onChange={(e) => setFormData(prev => ({ ...prev, attributes: { ...prev.attributes, [attr.key]: e.target.value } }))} required={attr.required}>
                <option value="">-- Chọn {attr.label} --</option>
                {attr.options?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            ) : (
              <div className="relative">
                <input type={attr.type === 'number' ? 'number' : 'text'} className={inputStyle} placeholder={`Nhập ${attr.label.toLowerCase()}...`} value={formData.attributes[attr.key] || ''} onChange={(e) => setFormData(prev => ({ ...prev, attributes: { ...prev.attributes, [attr.key]: e.target.value } }))} required={attr.required} />
                {attr.suffix && <span className="absolute right-4 top-3.5 text-gray-400 text-xs font-bold pointer-events-none">{attr.suffix}</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  if (!settings) return <div className="h-96 flex items-center justify-center font-black text-primary animate-pulse uppercase tracking-widest text-xl">Đang tải dữ liệu...</div>;
  const currentTierConfig = (settings.tierConfigs as any)[user?.subscriptionTier || 'free'];
  const remainingPosts = maxPosts - postsToday;

  if (isLimitReached && !isEditing) {
    return (
      <div className="max-w-2xl mx-auto mt-10 px-4 pb-20">
        <div className="bg-red-50 border-2 border-red-100 rounded-[2.5rem] p-10 text-center space-y-6 shadow-xl animate-fade-in-up">
          <div className="text-6xl animate-bounce">⛔️</div>
          <h2 className="text-2xl font-black text-red-600 uppercase">Hết hạn mức đăng tin</h2>
          <p className="text-gray-600 font-medium leading-relaxed">
            Bạn đã sử dụng hết <span className="font-bold text-black">{maxPosts}/{maxPosts}</span> lượt đăng tin miễn phí trong ngày hôm nay.
          </p>
          <div className="flex gap-4 justify-center pt-4">
            <Link to="/" className="px-6 py-3 bg-white border border-gray-200 rounded-xl font-bold text-sm uppercase hover:bg-gray-50">Về trang chủ</Link>
            <Link to="/upgrade" className="px-6 py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-xl font-bold text-sm uppercase shadow-lg hover:scale-105 transition-transform">Nâng cấp VIP</Link>
          </div>
        </div>
      </div>
    );
  }

  const parentCategories = categories.filter(c => !c.parentId);
  const childCategories = categories.filter(c => c.parentId === selectedParentId);
  const hasChildren = childCategories.length > 0;

  return (
    <div className="w-full max-w-7xl mx-auto space-y-5 px-4 pb-24 pt-4 font-sans overflow-x-hidden">
      
      {/* HEADER */}
      <div className="flex flex-col items-center gap-2 mb-4">
        <h1 className="text-xl md:text-3xl font-black text-gray-900 uppercase tracking-tight">{isEditing ? 'Sửa Tin' : 'Đăng Tin'}</h1>
        {!isEditing && (
          <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border shadow-sm ${remainingPosts <= 1 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
            <span className="text-[10px] font-bold text-gray-500 uppercase">{currentTierConfig.name}</span>
            <div className="h-3 w-[1px] bg-gray-300"></div>
            <span className={`text-[10px] font-black ${remainingPosts <= 1 ? 'text-red-500 animate-pulse' : 'text-primary'}`}>
              Còn {remainingPosts}/{maxPosts} tin
            </span>
          </div>
        )}
      </div>

      {!isEditing && (
        <div className="bg-gray-100 p-1 rounded-xl flex max-w-md mx-auto shadow-inner">
          <button onClick={() => setListingType('normal')} className={`flex-1 py-2.5 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-wide transition-all ${listingType === 'normal' ? 'bg-white shadow text-primary' : 'text-gray-400'}`}>📦 Bán ngay</button>
          <button onClick={() => setListingType('affiliate')} className={`flex-1 py-2.5 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-wide transition-all ${listingType === 'affiliate' ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow' : 'text-gray-400'}`}>💰 Tiếp thị VIP</button>
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-6">
        {/* MEDIA SECTION */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <label className={labelStyle}>Ảnh ({formData.images.length}/{currentTierConfig.maxImages})</label>
              {aiAnalyzing && (
                  <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping"></div>
                      <span className="text-[9px] font-bold text-blue-500 uppercase">AI đang phân tích...</span>
                  </div>
              )}
            </div>
            <div className="grid grid-cols-3 md:grid-cols-2 gap-2">
              {formData.images.map((img, i) => (
                <div key={i} className="aspect-square rounded-lg overflow-hidden border border-gray-200 relative group">
                  <img src={img} className="w-full h-full object-cover" alt="" />
                  <button type="button" onClick={() => setFormData(p => ({ ...p, images: p.images.filter((_, idx) => idx !== i) }))} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 w-5 h-5 flex items-center justify-center text-xs opacity-80 hover:opacity-100">✕</button>
                </div>
              ))}
              {formData.images.length < currentTierConfig.maxImages && (
                <button type="button" onClick={() => fileInputRef.current?.click()} className="aspect-square bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-primary hover:text-primary transition-all">
                  <span className="text-2xl font-light">+</span>
                </button>
              )}
              {!videoPreview && (
                <button type="button" onClick={handleVideoClick} className={`aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center transition-all ${currentTierConfig.allowVideo ? 'bg-blue-50 border-blue-200 text-blue-500 hover:border-blue-400' : 'bg-gray-50 border-gray-200 text-gray-300 opacity-50'}`}>
                  <span className="text-xl">📹</span>
                </button>
              )}
              {videoPreview && (
                <div className="aspect-square rounded-lg overflow-hidden border border-blue-200 relative group shadow-sm bg-black">
                  <video src={videoPreview} className="w-full h-full object-cover opacity-80" />
                  <button type="button" onClick={() => { setVideoFile(null); setVideoPreview(""); setExistingVideoUrl(null); }} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 w-5 h-5 flex items-center justify-center text-xs shadow">✕</button>
                </div>
              )}
            </div>
            <input type="file" ref={fileInputRef} onChange={handleImageUpload} multiple accept="image/*" className="hidden" />
            <input type="file" ref={videoInputRef} onChange={handleVideoChange} accept="video/*" className="hidden" />
          </div>
        </div>

        {/* FORM SECTION */}
        <div className="lg:col-span-8">
          {(listingType === 'normal' || user?.subscriptionTier === 'pro') && (
            <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-2xl p-4 md:p-6 shadow-lg shadow-gray-100/50 space-y-5">

              {/* Title & Category - Giữ nguyên */}
              <div className="space-y-1">
                <label className={labelStyle}>Tiêu đề *</label>
                <input type="text" placeholder="Ví dụ: iPhone 15 Pro Max..." value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className={`${inputStyle} ${aiAnalyzing ? 'animate-pulse bg-blue-50' : ''}`} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className={labelStyle}>Danh mục Chính *</label>
                  <select value={selectedParentId} onChange={handleParentCategoryChange} className={inputStyle}>
                    <option value="">-- Chọn --</option>
                    {parentCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className={labelStyle}>Chi tiết</label>
                  <select value={selectedChildId} onChange={handleChildCategoryChange} className={inputStyle} disabled={!selectedParentId || !hasChildren}>
                    <option value="">{hasChildren ? "-- Chọn loại --" : "Không có mục con"}</option>
                    {childCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>)}
                  </select>
                </div>
              </div>

              {renderDynamicFields()}

              {/* Price Section */}
              <div className="space-y-3">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className={labelStyle}>Giá bán (VNĐ) *</label>
                      <input type="text" placeholder="0" value={formData.price ? Number(formData.price).toLocaleString('vi-VN') : ''} onChange={(e) => setFormData({ ...formData, price: e.target.value.replace(/\D/g, '') })} className={inputStyle} />
                    </div>
                    <div className="space-y-1">
                      <label className={labelStyle}>Tình trạng</label>
                      <select value={formData.condition} onChange={(e) => setFormData({ ...formData, condition: e.target.value as any })} className={inputStyle}>
                        <option value="used">Đã qua sử dụng</option>
                        <option value="new">Mới 100%</option>
                      </select>
                    </div>
                 </div>

                 {priceSuggestions && !formData.isAuction && (
                    <div className="w-full max-w-[calc(100vw-60px)] md:max-w-full overflow-hidden">
                        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar touch-pan-x snap-x">
                            <button type="button" onClick={() => setFormData(p => ({...p, price: priceSuggestions.fast.toString()}))} className="snap-start flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition">
                                <span className="text-[10px] font-bold text-green-600 uppercase">⚡ Bán nhanh</span>
                                <span className="text-xs font-black text-green-700">{Number(priceSuggestions.fast).toLocaleString('vi-VN')}</span>
                            </button>
                            <button type="button" onClick={() => setFormData(p => ({...p, price: priceSuggestions.market.toString()}))} className="snap-start flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition">
                                <span className="text-[10px] font-bold text-blue-600 uppercase">👍 Hợp lý</span>
                                <span className="text-xs font-black text-blue-700">{Number(priceSuggestions.market).toLocaleString('vi-VN')}</span>
                            </button>
                            <button type="button" onClick={() => setFormData(p => ({...p, price: priceSuggestions.high.toString()}))} className="snap-start flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition">
                                <span className="text-[10px] font-bold text-purple-600 uppercase">💰 Lời cao</span>
                                <span className="text-xs font-black text-purple-700">{Number(priceSuggestions.high).toLocaleString('vi-VN')}</span>
                            </button>
                        </div>
                    </div>
                 )}
              </div>

              <div className="space-y-1">
                <label className={labelStyle}>Mô tả</label>
                <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className={`${inputStyle} h-32 leading-relaxed`} placeholder="Mô tả chi tiết..." />
              </div>

              {/* [ĐÃ BỔ SUNG LẠI] NÚT CHECKBOX */}
              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
                <input 
                  type="checkbox" 
                  id="rules" 
                  checked={agreedToRules} 
                  onChange={e => setAgreedToRules(e.target.checked)} 
                  className="w-5 h-5 mt-0.5 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer" 
                />
                <label htmlFor="rules" className="text-xs font-medium text-gray-600 cursor-pointer select-none">
                  Tôi cam kết thông tin đăng tải là sự thật và tuân thủ <span className="text-primary font-bold hover:underline">Quy tắc cộng đồng</span>.
                </label>
              </div>

              <button type="submit" disabled={loading} className={`w-full py-4 rounded-xl font-black text-sm uppercase shadow-lg text-white transition-all active:scale-95 ${formData.isAuction ? 'bg-purple-600 shadow-purple-200' : 'bg-primary shadow-blue-200'} disabled:opacity-50 disabled:cursor-not-allowed`}>
                {loading ? 'Đang xử lý...' : (isEditing ? 'Lưu thay đổi' : (formData.isAuction ? '🔨 Tạo đấu giá' : 'Đăng tin ngay'))}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default PostListing;
