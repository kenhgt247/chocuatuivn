import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { db, SystemSettings } from '../services/db';
import { User, Category, CategoryAttribute } from '../types';
import { analyzeListingImages } from '../services/geminiService';
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
  const [loadingStep, setLoadingStep] = useState("");
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
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

  const inputStyle = "w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-bold text-sm focus:outline-none focus:border-primary focus:bg-white transition-all shadow-sm";
  const labelStyle = "text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-1 block";

  // 1. INITIALIZE
  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    const init = async () => {
      try {
        const [s, cats, count] = await Promise.all([
          db.getSettings(), db.getCategories(), !isEditing ? db.countUserListingsToday(user.id) : Promise.resolve(0)
        ]);
        setSettings(s); setCategories(cats); setPostsToday(count);
        
        const limit = (s?.tierConfigs as any)?.[user.subscriptionTier || 'free']?.postsPerDay || 5;
        setMaxPosts(limit);
        if (!isEditing && count >= limit) setIsLimitReached(true);

        if (isEditing && id) {
          setLoading(true);
          const listing = await db.getListingById(id);
          if (listing) {
            const currentCat = cats.find(c => c.id === listing.category);
            if (currentCat) {
              if (currentCat.parentId) { setSelectedParentId(currentCat.parentId); setSelectedChildId(currentCat.id); setCurrentAttributes(currentCat.attributes || []); }
              else setSelectedParentId(currentCat.id);
            }
            setFormData({
              title: listing.title, price: listing.price.toString(), description: listing.description,
              location: listing.location, address: listing.address || '', condition: listing.condition,
              images: listing.images, attributes: listing.attributes || {}, affiliateLink: listing.affiliateLink || '',
              isAuction: listing.isAuction || false,
              auctionEndAt: listing.auctionEndAt ? new Date(listing.auctionEndAt).toISOString().slice(0, 16) : '',
              bidIncrement: listing.bidIncrement?.toString() || '50000'
            });
            if (listing.affiliateLink) setListingType('affiliate');
            if (listing.videoUrl) { setExistingVideoUrl(listing.videoUrl); setVideoPreview(listing.videoUrl); }
            setAgreedToRules(true);
          }
          setLoading(false);
        }
      } catch (err) { console.error(err); }
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

  // 2. HANDLERS
  const handleParentCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const pId = e.target.value; setSelectedParentId(pId); setSelectedChildId(""); setCurrentAttributes([]); setFormData(prev => ({ ...prev, attributes: {} }));
  };
  const handleChildCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cId = e.target.value; setSelectedChildId(cId);
    const childCat = categories.find(c => c.id === cId);
    setCurrentAttributes(childCat?.attributes || []);
  };
  const handleManualLocate = () => {
    if (!navigator.geolocation) return alert("Trình duyệt không hỗ trợ GPS");
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      setLocationDetected({ lat: latitude, lng: longitude });
      try {
        const info = await getLocationFromCoords(latitude, longitude);
        setFormData(prev => ({ ...prev, location: info.city || prev.location, address: info.address || prev.address }));
      } catch (e) { alert("Không thể lấy vị trí."); }
    });
  };
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0 || !settings) return;
    const limit = (settings.tierConfigs as any)[user?.subscriptionTier || 'free'].maxImages;
    if (files.length + formData.images.length > limit) return alert(`Tối đa ${limit} ảnh.`);
    
    setAiAnalyzing(true);
    try {
      const compressed = await Promise.all(files.map(f => compressAndGetBase64(f)));
      const newImages = [...formData.images, ...compressed];
      setFormData(prev => ({ ...prev, images: newImages }));
      if (!isEditing && compressed.length > 0 && !formData.title) runAIAnalysis(newImages);
    } catch(e) { alert("Lỗi ảnh"); }
    finally { setAiAnalyzing(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };
  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) return alert("Video tối đa 50MB");
      setVideoFile(file); setVideoPreview(URL.createObjectURL(file)); setExistingVideoUrl(null);
    }
  };
  const runAIAnalysis = async (images: string[]) => {
    setAiAnalyzing(true);
    try {
      const analysis = await analyzeListingImages(images.slice(0, 3)).catch(() => null);
      if (analysis) {
        let pId = "", cId = "", attrs: any[] = [];
        const cat = categories.find(c => c.id === analysis.category);
        if (cat) {
          if (cat.parentId) { cId = cat.id; pId = cat.parentId; attrs = cat.attributes || []; }
          else { pId = cat.id; }
        }
        if (pId) setSelectedParentId(pId); if (cId) setSelectedChildId(cId); if (attrs.length) setCurrentAttributes(attrs);
        setFormData(p => ({
          ...p, title: p.title || analysis.title || '', price: p.price || analysis.suggestedPrice?.toString() || '',
          description: p.description || analysis.description || '', condition: (analysis.condition as any) || p.condition,
          attributes: { ...p.attributes, ...(analysis.attributes || {}) }
        }));
      }
    } finally { setAiAnalyzing(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !settings) return;
    if (!isEditing && postsToday >= maxPosts) return alert("Hết hạn mức đăng tin!");
    const catId = selectedChildId || selectedParentId;
    if (!formData.title.trim() || !catId || !formData.price || formData.images.length === 0) return alert('Thiếu thông tin bắt buộc (Tiêu đề, Giá, Ảnh, Danh mục)!');
    if (listingType === 'affiliate' && !formData.affiliateLink) return alert('Thiếu link affiliate');
    if (!agreedToRules) return alert('Vui lòng đồng ý quy tắc!');

    let auctionData = { isAuction: false, auctionEndAt: null as any, bidIncrement: null as any, bidsCount: 0, highestBidderId: null };
    if (formData.isAuction) {
      if (!formData.auctionEndAt) return alert("Chọn giờ kết thúc đấu giá!");
      if (new Date(formData.auctionEndAt) <= new Date()) return alert("Giờ kết thúc phải ở tương lai.");
      auctionData = { isAuction: true, auctionEndAt: new Date(formData.auctionEndAt).toISOString(), bidIncrement: Number(formData.bidIncrement), bidsCount: 0, highestBidderId: null };
    }

    setLoading(true);
    try {
      setLoadingStep("1/3: Xử lý Video...");
      let vUrl = existingVideoUrl;
      if (videoFile) vUrl = await db.uploadVideo(videoFile, user.id);

      setLoadingStep("2/3: Tải hình ảnh...");
      const iUrls = await Promise.all(formData.images.map((img, i) => img.startsWith('data:') ? db.uploadImage(img, `listings/${user.id}/${Date.now()}_${i}.jpg`) : img));

      setLoadingStep("3/3: Lưu dữ liệu...");
      let status = 'pending';
      if (isEditing) status = user.role === 'admin' ? 'approved' : 'pending';
      else if (listingType === 'affiliate' || (settings.tierConfigs as any)[user.subscriptionTier].autoApprove) status = 'approved';

      const data: any = {
        title: formData.title.trim(), description: formData.description.trim(), price: parseInt(formData.price.replace(/\D/g, '')),
        category: catId, images: iUrls, videoUrl: vUrl, location: formData.location, address: formData.address,
        condition: listingType === 'affiliate' ? 'new' : formData.condition, attributes: formData.attributes,
        status, tier: listingType === 'affiliate' ? 'pro' : user.subscriptionTier,
        affiliateLink: listingType === 'affiliate' ? formData.affiliateLink : null,
        lat: locationDetected?.lat || null, lng: locationDetected?.lng || null, ...auctionData
      };

      if (!isEditing) { data.sellerId = user.id; data.sellerName = user.name; data.sellerAvatar = user.avatar || ''; }
      if (isEditing) await db.updateListingContent(id!, data); else await db.saveListing(data);
      
      alert(isEditing ? "Cập nhật xong!" : "Đăng tin thành công!");
      navigate(isEditing ? `/san-pham/${id}` : '/manage-ads');
    } catch (e) { console.error(e); alert("Lỗi hệ thống."); }
    finally { setLoading(false); setLoadingStep(""); }
  };

  // --- HÀM RENDER ATTRIBUTES (ĐÃ BỔ SUNG ĐỂ SỬA LỖI) ---
  const renderDynamicFields = () => {
    if (currentAttributes.length === 0) return null;
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-blue-50/50 p-5 rounded-3xl border border-blue-100 mb-6">
        <div className="col-span-1 md:col-span-2 text-xs font-black text-blue-500 uppercase tracking-widest mb-2 border-b border-blue-100 pb-2">Thông số kỹ thuật</div>
        {currentAttributes.map((attr) => (
          <div key={attr.key} className="space-y-1">
            <label className={labelStyle}>{attr.label} {attr.required && <span className="text-red-500">*</span>}</label>
            {attr.type === 'select' ? (
              <select className={inputStyle} value={formData.attributes[attr.key] || ''} onChange={(e) => setFormData(prev => ({ ...prev, attributes: { ...prev.attributes, [attr.key]: e.target.value } }))} required={attr.required}>
                <option value="">-- Chọn --</option>{attr.options?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            ) : (
              <div className="relative">
                <input type={attr.type === 'number' ? 'number' : 'text'} className={inputStyle} placeholder="..." value={formData.attributes[attr.key] || ''} onChange={(e) => setFormData(prev => ({ ...prev, attributes: { ...prev.attributes, [attr.key]: e.target.value } }))} required={attr.required} />
                {attr.suffix && <span className="absolute right-4 top-4 text-gray-400 text-xs font-bold pointer-events-none">{attr.suffix}</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  // --- RULES BLOCK (GIAO DIỆN DARK MODE) ---
  const RulesBlock = () => (
    <div className="bg-slate-900 text-white rounded-[2.5rem] p-8 md:p-10 space-y-6 relative overflow-hidden shadow-2xl border border-slate-800">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full -mr-16 -mt-16 blur-3xl pointer-events-none"></div>
        <div className="relative z-10">
            <h3 className="flex items-center gap-3 font-black text-sm uppercase tracking-[0.15em] mb-6 text-slate-200 border-b border-white/10 pb-4">
                <span className="text-xl">🛡️</span> Quy tắc đăng tin
            </h3>
            <ul className="space-y-4 text-xs text-slate-300 font-bold uppercase tracking-wide">
                <li className="flex items-center gap-3"><span className="text-green-400">✓</span> Không hàng cấm/giả</li>
                <li className="flex items-center gap-3"><span className="text-green-400">✓</span> Ảnh thật tự chụp</li>
                <li className="flex items-center gap-3"><span className="text-green-400">✓</span> Mô tả trung thực</li>
            </ul>
            <div className="mt-6 pt-4 border-t border-white/5 text-[10px] text-slate-500 italic text-center">
                "Cộng đồng mua bán văn minh."
            </div>
        </div>
    </div>
  );

  // --- RENDER ---
  if (!settings) return <div className="h-screen flex items-center justify-center font-black text-primary animate-pulse tracking-widest text-xs">LOADING...</div>;
  if (isLimitReached && !isEditing) return <div className="p-20 text-center text-red-500 font-black text-xl uppercase">Hết hạn mức đăng tin hôm nay</div>;

  const currentTierConfig = (settings.tierConfigs as any)[user?.subscriptionTier || 'free'];
  const parentCategories = categories.filter(c => !c.parentId);
  const childCategories = categories.filter(c => c.parentId === selectedParentId);
  const remainingPosts = maxPosts - postsToday;

  return (
    <div className="max-w-7xl mx-auto space-y-6 px-4 pb-24 pt-6 font-sans">
      <Helmet><title>{isEditing ? 'Sửa tin' : 'Đăng tin'} | Chợ Của Tui</title></Helmet>
      
      {loading && (
        <div className="fixed inset-0 z-[1000] flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-md text-white animate-fade-in">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-6"></div>
          <p className="font-black uppercase tracking-widest text-sm animate-pulse">{loadingStep}</p>
        </div>
      )}

      {/* Header */}
      <div className="text-center space-y-3 mb-8">
        <h1 className="text-3xl md:text-4xl font-black text-slate-900 uppercase tracking-tighter">{isEditing ? 'Chỉnh Sửa Tin' : 'Đăng Tin Mới'}</h1>
        {!isEditing && (
          <div className="inline-flex items-center gap-3 px-5 py-2 rounded-full border border-slate-200 bg-white shadow-sm">
             <span className="text-xs font-black text-slate-400 uppercase">{currentTierConfig.name}</span>
             <div className="h-4 w-[1px] bg-slate-200"></div>
             <span className="text-xs font-black text-primary">CÒN {remainingPosts}/{maxPosts} LƯỢT</span>
          </div>
        )}
      </div>

      {/* [KHÔI PHỤC] Toggle Loại tin */}
      {!isEditing && (
        <div className="bg-gray-100 p-1.5 rounded-2xl flex max-w-md mx-auto mb-10 shadow-inner">
          <button onClick={() => setListingType('normal')} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all ${listingType === 'normal' ? 'bg-white shadow text-primary' : 'text-gray-400'}`}>📦 Bán thường</button>
          <button onClick={() => setListingType('affiliate')} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all ${listingType === 'affiliate' ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow' : 'text-gray-400'}`}>💰 Tiếp thị VIP</button>
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-8">
        {/* LEFT COLUMN */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white border border-slate-200 rounded-[2.5rem] p-6 md:p-8 shadow-sm">
             <div className="flex justify-between items-center mb-6">
                <label className={labelStyle}>Media ({formData.images.length}/{currentTierConfig.maxImages})</label>
                {aiAnalyzing && <span className="text-[9px] font-black text-blue-500 animate-pulse uppercase flex items-center gap-1">Scanning...</span>}
             </div>
             <div className="grid grid-cols-2 gap-3">
                {formData.images.map((img, i) => (
                  <div key={i} className="aspect-square rounded-2xl overflow-hidden relative group border border-slate-100 shadow-sm">
                    <img src={img} className="w-full h-full object-cover" alt="" />
                    <button type="button" onClick={() => setFormData(p => ({ ...p, images: p.images.filter((_, idx) => idx !== i) }))} className="absolute inset-0 bg-red-500/80 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all font-black text-xs">XÓA</button>
                  </div>
                ))}
                {formData.images.length < currentTierConfig.maxImages && (
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="aspect-square bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-400 hover:border-primary hover:text-primary transition-all">
                    <span className="text-3xl font-light">+</span><span className="text-[8px] font-black uppercase mt-2">Ảnh</span>
                  </button>
                )}
                {!videoPreview ? (
                    <button type="button" onClick={() => {
                        if (!currentTierConfig.allowVideo) return alert("Nâng cấp VIP để đăng video!");
                        videoInputRef.current?.click();
                    }} className={`aspect-square rounded-2xl border-2 border-dashed flex flex-col items-center justify-center transition-all ${currentTierConfig.allowVideo ? 'bg-blue-50 border-blue-200 text-blue-500 hover:border-blue-400' : 'bg-gray-50 border-gray-200 text-gray-300 opacity-50'}`}>
                        <span className="text-2xl">📹</span><span className="text-[8px] font-black uppercase mt-2">Video</span>
                    </button>
                ) : (
                    <div className="aspect-square rounded-2xl overflow-hidden border border-blue-200 relative group shadow-md">
                        <video src={videoPreview} className="w-full h-full object-cover" />
                        <button type="button" onClick={() => { setVideoFile(null); setVideoPreview(""); setExistingVideoUrl(null); }} className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1.5 shadow-md">✕</button>
                    </div>
                )}
             </div>
             <input type="file" ref={fileInputRef} onChange={handleImageUpload} multiple accept="image/*" className="hidden" />
             <input type="file" ref={videoInputRef} onChange={handleVideoChange} accept="video/*" className="hidden" />
          </div>

          {/* RULES - DESKTOP ONLY */}
          <div className="hidden lg:block">
             <RulesBlock />
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="lg:col-span-8 space-y-8">
          <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-[3rem] p-8 md:p-12 shadow-xl space-y-8">
            
            {/* Link Affiliate */}
            {listingType === 'affiliate' && (
                <div className="bg-orange-50 p-6 rounded-2xl border border-orange-100"><label className={labelStyle}>Link Affiliate *</label><input type="url" value={formData.affiliateLink || ''} onChange={e => setFormData({ ...formData, affiliateLink: e.target.value })} className={inputStyle} placeholder="https://shope.ee/..." /></div>
            )}

            {/* Toggle Đấu giá (Chỉ khi bán thường) */}
            {listingType === 'normal' && (
                <div className="flex bg-slate-100 p-1.5 rounded-2xl relative max-w-md mx-auto lg:mx-0">
                  <div className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-white rounded-xl shadow-sm transition-all duration-300 ${formData.isAuction ? 'left-[calc(50%+3px)]' : 'left-1.5'}`}></div>
                  <button type="button" onClick={() => setFormData(p => ({ ...p, isAuction: false }))} className={`flex-1 relative z-10 py-3 text-[10px] font-black uppercase tracking-widest transition-colors ${!formData.isAuction ? 'text-primary' : 'text-slate-400'}`}>🏷️ Giá cố định</button>
                  <button type="button" onClick={() => setFormData(p => ({ ...p, isAuction: true }))} className={`flex-1 relative z-10 py-3 text-[10px] font-black uppercase tracking-widest transition-colors ${formData.isAuction ? 'text-purple-600' : 'text-slate-400'}`}>🔨 Đấu giá</button>
                </div>
            )}

            <div className="space-y-1"><label className={labelStyle}>Tiêu đề *</label><input type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} className={inputStyle} placeholder="Tên sản phẩm..." /></div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><label className={labelStyle}>Danh mục</label><select value={selectedParentId} onChange={handleParentCategoryChange} className={inputStyle}><option value="">-- Chọn --</option>{parentCategories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}</select></div>
                <div className="space-y-1"><label className={labelStyle}>Chi tiết</label><select value={selectedChildId} onChange={handleChildCategoryChange} className={inputStyle} disabled={!selectedParentId}><option value="">-- Chọn --</option>{childCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            </div>

            {renderDynamicFields()}

            <div className={`p-6 rounded-[2rem] border transition-all ${formData.isAuction ? 'bg-purple-50 border-purple-100' : 'bg-slate-50 border-slate-100'}`}>
                {formData.isAuction ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1"><label className="text-[10px] font-black text-purple-400 uppercase">Khởi điểm</label><input type="text" value={formData.price ? Number(formData.price).toLocaleString('vi-VN') : ''} onChange={e => setFormData({ ...formData, price: e.target.value.replace(/\D/g, '') })} className="w-full bg-white border border-purple-200 rounded-xl p-3 font-black text-purple-700" /></div>
                        <div className="space-y-1"><label className="text-[10px] font-black text-purple-400 uppercase">Bước giá</label><select value={formData.bidIncrement} onChange={e => setFormData({ ...formData, bidIncrement: e.target.value })} className="w-full bg-white border border-purple-200 rounded-xl p-3 font-bold"><option value="10000">10k</option><option value="50000">50k</option><option value="100000">100k</option></select></div>
                        <div className="space-y-1 md:col-span-2"><label className="text-[10px] font-black text-purple-400 uppercase">Kết thúc</label><input type="datetime-local" value={formData.auctionEndAt} onChange={e => setFormData({ ...formData, auctionEndAt: e.target.value })} className="w-full bg-white border border-purple-200 rounded-xl p-3 font-bold" /></div>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1"><label className={labelStyle}>Giá bán</label><input type="text" value={formData.price ? Number(formData.price).toLocaleString('vi-VN') : ''} onChange={e => setFormData({ ...formData, price: e.target.value.replace(/\D/g, '') })} className={inputStyle} /></div>
                        <div className="space-y-1"><label className={labelStyle}>Tình trạng</label><select value={formData.condition} onChange={e => setFormData({ ...formData, condition: e.target.value as any })} className={inputStyle}><option value="used">Cũ</option><option value="new">Mới</option></select></div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1"><label className={labelStyle}>Khu vực</label><select value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} className={inputStyle}>{LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}</select></div>
                <div className="space-y-1"><div className="flex justify-between"><label className={labelStyle}>Địa chỉ</label><button type="button" onClick={handleManualLocate} className="text-[9px] font-black text-blue-500 uppercase">📍 Vị trí</button></div><input type="text" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} className={inputStyle} /></div>
            </div>

            <div className="space-y-1"><label className={labelStyle}>Mô tả</label><textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className={`${inputStyle} h-40 resize-none`} placeholder="Chi tiết sản phẩm..." /></div>

            <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                <input type="checkbox" id="rules" checked={agreedToRules} onChange={e => setAgreedToRules(e.target.checked)} className="w-5 h-5 text-primary rounded border-slate-300" />
                <label htmlFor="rules" className="text-[10px] font-black text-slate-400 uppercase cursor-pointer">Tôi cam kết bán hàng trung thực</label>
            </div>

            <button type="submit" disabled={loading} className={`w-full py-5 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl text-white transition-all transform active:scale-95 ${formData.isAuction ? 'bg-gradient-to-r from-purple-600 to-indigo-600 shadow-purple-200' : (listingType === 'affiliate' ? 'bg-gradient-to-r from-orange-500 to-red-500' : 'bg-primary hover:bg-primaryHover shadow-primary/20')}`}>
                {loading ? 'Đang xử lý...' : (isEditing ? 'Cập nhật tin' : (formData.isAuction ? 'Kích hoạt đấu giá' : 'Đăng tin ngay'))}
            </button>
          </form>

          {/* RULES BLOCK - MOBILE ONLY (ĐẨY XUỐNG CUỐI) */}
          <div className="block lg:hidden pt-8">
             <RulesBlock />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PostListing;