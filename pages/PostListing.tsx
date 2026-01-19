import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { db, SystemSettings } from '../services/db';
import { User, Category, CategoryAttribute } from '../types';
import { analyzeListingImages, ListingAnalysis } from '../services/geminiService';
import { getLocationFromCoords } from '../utils/locationHelper';
import { compressAndGetBase64 } from '../utils/imageCompression';
import { LOCATIONS } from '../constants';

// Import Icons chuyên nghiệp từ lucide-react
import { 
  Tag, Gavel, Video, Lock, Package, Coins, Crown, ImagePlus, X, MapPin, 
  ShieldAlert, Ban, Camera, FileText, MessageCircle, AlertTriangle, 
  Zap, ThumbsUp, TrendingUp, AlertOctagon, CheckSquare 
} from 'lucide-react';

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
  // --- Đấu giá ---
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

  // [UI STYLES]
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !settings) return;

    // --- [LOGIC BẢO MẬT] CHỐT CHẶN KIỂM TRA QUYỀN TRƯỚC KHI LƯU ---
    const currentTierConfig = (settings.tierConfigs as any)[user.subscriptionTier || 'free'];
    
    // 1. Chặn hack Video
    if ((videoFile || existingVideoUrl) && !currentTierConfig.allowVideo) {
        return alert("❌ Gói cước của bạn không hỗ trợ đăng Video. Vui lòng nâng cấp!");
    }
    // 2. Chặn hack Đấu giá
    if (formData.isAuction && !['basic', 'pro'].includes(user.subscriptionTier || '')) {
        return alert("❌ Tính năng Đấu giá chỉ dành cho VIP. Vui lòng nâng cấp!");
    }
    // 3. Chặn hack số lượng ảnh
    if (formData.images.length > currentTierConfig.maxImages) {
        return alert(`❌ Bạn chỉ được đăng tối đa ${currentTierConfig.maxImages} ảnh!`);
    }
    // --------------------------------------------------------------

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
    if (!agreedToRules) return alert('Vui lòng đồng ý quy tắc cộng đồng.');

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
    } catch (error) { console.error(error); alert("Lỗi xử lý tin. Thử lại sau."); } 
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
                {attr.suffix && <span className="absolute right-4 top-4 text-gray-400 text-xs font-bold pointer-events-none">{attr.suffix}</span>}
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
        <div className="bg-red-50 border-2 border-red-100 rounded-[2.5rem] p-10 text-center space-y-6 shadow-xl animate-fade-in-up flex flex-col items-center">
          <AlertOctagon className="w-20 h-20 text-red-500 animate-bounce mb-4" strokeWidth={1.5} />
          <h2 className="text-2xl font-black text-red-600 uppercase">Hết hạn mức đăng tin</h2>
          <p className="text-gray-600 font-medium leading-relaxed">
            Bạn đã sử dụng hết <span className="font-bold text-black">{maxPosts}/{maxPosts}</span> lượt đăng tin miễn phí trong ngày hôm nay.
          </p>
          <div className="flex gap-4 justify-center pt-4">
            <Link to="/" className="px-6 py-3 bg-white border border-gray-200 rounded-xl font-bold text-sm uppercase hover:bg-gray-50">Về trang chủ</Link>
            <Link to="/upgrade" className="px-6 py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-xl font-bold text-sm uppercase shadow-lg hover:scale-105 transition-transform flex items-center gap-2">
              <Crown className="w-4 h-4" /> Nâng cấp VIP
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const parentCategories = categories.filter(c => !c.parentId);
  const childCategories = categories.filter(c => c.parentId === selectedParentId);
  const hasChildren = childCategories.length > 0;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 px-4 pb-24 pt-4 font-sans overflow-x-hidden">
      
      <div className="text-center space-y-3 mb-6">
        <h1 className="text-xl md:text-3xl font-black text-gray-900 uppercase tracking-tight">{isEditing ? 'Sửa Tin' : 'Đăng Tin'}</h1>
        {!isEditing && (
          <div className="flex flex-col items-center gap-2">
            <div className={`inline-flex items-center gap-3 px-5 py-2 rounded-full border shadow-sm ${remainingPosts <= 1 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
              <span className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                 <Crown className="w-3 h-3 text-yellow-500" /> {currentTierConfig.name}
              </span>
              <div className="h-4 w-[1px] bg-gray-300"></div>
              <span className={`text-xs font-black ${remainingPosts <= 1 ? 'text-red-500 animate-pulse' : 'text-primary'}`}>
                Còn {remainingPosts}/{maxPosts} tin
              </span>
            </div>
          </div>
        )}
      </div>

      {!isEditing && (
        <div className="bg-gray-100 p-1 rounded-xl flex max-w-md mx-auto shadow-inner mb-6">
          <button onClick={() => setListingType('normal')} className={`flex-1 py-2.5 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-wide transition-all flex items-center justify-center gap-2 ${listingType === 'normal' ? 'bg-white shadow text-primary' : 'text-gray-400'}`}>
            <Package className="w-4 h-4" /> Bán ngay
          </button>
          <button onClick={() => setListingType('affiliate')} className={`flex-1 py-2.5 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-wide transition-all flex items-center justify-center gap-2 ${listingType === 'affiliate' ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow' : 'text-gray-400'}`}>
            <Coins className="w-4 h-4" /> Tiếp thị VIP
          </button>
        </div>
      )}

      {/* --- KHỐI MEDIA --- */}
      {listingType === 'affiliate' && user?.subscriptionTier !== 'pro' ? (
        <div className="bg-orange-50 border border-orange-100 rounded-2xl p-8 text-center space-y-4 flex flex-col items-center">
          <Crown className="w-16 h-16 text-orange-400" strokeWidth={1} />
          <h3 className="text-sm font-black text-orange-600 uppercase">Dành cho VIP PRO</h3>
          <Link to="/upgrade" className="block w-full max-w-xs bg-orange-500 text-white py-4 rounded-xl font-bold text-xs hover:bg-orange-600 transition">Nâng cấp ngay</Link>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <label className={labelStyle}>Media ({formData.images.length}/{currentTierConfig.maxImages})</label>
            {aiAnalyzing && (
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></div>
                    <span className="text-[10px] font-bold text-blue-500 uppercase">AI đang tự điền...</span>
                </div>
            )}
          </div>
          {/* Grid ảnh */}
          <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
            {formData.images.map((img, i) => (
              <div key={i} className="aspect-square rounded-xl overflow-hidden border border-gray-200 relative group">
                <img src={img} className="w-full h-full object-cover" alt="" />
                <button type="button" onClick={() => setFormData(p => ({ ...p, images: p.images.filter((_, idx) => idx !== i) }))} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 group-hover:bg-red-500 transition-all">
                    <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {formData.images.length < currentTierConfig.maxImages && (
              <button type="button" onClick={() => fileInputRef.current?.click()} className="aspect-square bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:border-primary hover:text-primary transition-all">
                <ImagePlus className="w-8 h-8 opacity-50" strokeWidth={1.5} />
              </button>
            )}

            {/* --- NÚT VIDEO (CÓ LOGIC KHÓA & ICON VECTOR) --- */}
            {!videoPreview ? (
              currentTierConfig.allowVideo ? (
                <button type="button" onClick={handleVideoClick} className="aspect-square rounded-xl border-2 border-dashed border-blue-200 bg-blue-50 text-blue-500 hover:border-blue-400 flex flex-col items-center justify-center transition-all">
                  <Video className="w-8 h-8 mb-1" strokeWidth={1.5} />
                </button>
              ) : (
                <button type="button" onClick={() => {
                    if(window.confirm("📹 Tính năng đăng Video chỉ dành cho VIP.\nNâng cấp ngay để bán hàng sinh động hơn?")) {
                      navigate('/upgrade');
                    }
                  }} className="aspect-square rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 text-gray-400 flex flex-col items-center justify-center cursor-not-allowed opacity-70 hover:bg-gray-100 transition-all relative">
                  <Video className="w-8 h-8 grayscale opacity-50" strokeWidth={1.5} />
                  <div className="absolute top-1 right-1 bg-gray-200 rounded-full p-1.5 text-gray-500 shadow-sm">
                    <Lock className="w-3 h-3" />
                  </div>
                </button>
              )
            ) : (
              <div className="aspect-square rounded-xl overflow-hidden border border-blue-200 relative group shadow-lg">
                <video src={videoPreview} className="w-full h-full object-cover" />
                <button type="button" onClick={() => { setVideoFile(null); setVideoPreview(""); setExistingVideoUrl(null); }} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 shadow-md">
                    <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
          <input type="file" ref={fileInputRef} onChange={handleImageUpload} multiple accept="image/*" className="hidden" />
          <input type="file" ref={videoInputRef} onChange={handleVideoChange} accept="video/*" className="hidden" />
        </div>
      )}

      {/* KHỐI FORM */}
      {(listingType === 'normal' || user?.subscriptionTier === 'pro') && (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-3xl p-6 md:p-8 shadow-xl shadow-gray-100/50 space-y-6">

          {!isEditing && remainingPosts === 1 && (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-xl mb-2 animate-pulse">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-yellow-600" />
                <div>
                  <h4 className="text-xs font-black text-yellow-700 uppercase">Lưu ý quan trọng</h4>
                  <p className="text-[11px] text-yellow-800">Tin cuối cùng trong ngày.</p>
                </div>
              </div>
            </div>
          )}

          {listingType === 'normal' && (
            <div className="bg-gray-50 p-1.5 rounded-2xl flex relative mb-4 max-w-sm">
              <div className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-white rounded-xl shadow-sm transition-all duration-300 ${formData.isAuction ? 'left-[calc(50%+3px)]' : 'left-1.5'}`}></div>
              
              <button type="button" onClick={() => setFormData(prev => ({ ...prev, isAuction: false }))} className={`flex-1 relative z-10 py-3 text-xs font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 ${!formData.isAuction ? 'text-primary' : 'text-gray-400'}`}>
                <Tag className="w-3.5 h-3.5" /> Giá cố định
              </button>
              
              {/* --- NÚT ĐẤU GIÁ (CÓ ICON VECTOR & LOGIC KHÓA) --- */}
              {['basic', 'pro'].includes(user?.subscriptionTier || '') ? (
                <button type="button" onClick={() => setFormData(prev => ({ ...prev, isAuction: true }))} className={`flex-1 relative z-10 py-3 text-xs font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 ${formData.isAuction ? 'text-purple-600' : 'text-gray-400'}`}>
                    <Gavel className="w-3.5 h-3.5" /> Đấu giá
                </button>
              ) : (
                <button type="button" onClick={() => {
                    if(window.confirm("💎 Tính năng Đấu Giá chỉ dành cho thành viên VIP.\nBạn có muốn nâng cấp ngay không?")) {
                      navigate('/upgrade');
                    }
                  }} className="flex-1 relative z-10 py-3 text-xs font-black uppercase tracking-widest text-gray-400 cursor-not-allowed flex items-center justify-center gap-1 opacity-60">
                  <Gavel className="w-3.5 h-3.5" /> <span>Đấu giá</span>
                  <Lock className="w-3 h-3 text-gray-400 ml-1" />
                </button>
              )}
            </div>
          )}

          {listingType === 'affiliate' && (
            <div className="space-y-2 bg-orange-50 p-6 rounded-2xl border border-orange-100">
              <label className={labelStyle}>Link Tiếp Thị Liên Kết *</label>
              <input type="url" required placeholder="Dán link Shopee, Lazada..." value={formData.affiliateLink || ''} onChange={(e) => setFormData({ ...formData, affiliateLink: e.target.value })} className={inputStyle} />
            </div>
          )}

          <div className="space-y-1">
            <label className={labelStyle}>Tiêu đề *</label>
            <input type="text" placeholder="Ví dụ: iPhone 15 Pro Max 256GB..." value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className={inputStyle} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-4 rounded-2xl border border-gray-100">
            <div className="space-y-1">
              <label className={labelStyle}>Danh mục Chính *</label>
              <select value={selectedParentId} onChange={handleParentCategoryChange} className={inputStyle}>
                <option value="">-- Chọn --</option>
                {parentCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className={labelStyle}>Chi tiết</label>
              <select value={selectedChildId} onChange={handleChildCategoryChange} className={inputStyle} disabled={!selectedParentId || !hasChildren}>
                <option value="">{hasChildren ? "-- Chọn loại --" : "Không có mục con"}</option>
                {childCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
            </div>
          </div>

          {renderDynamicFields()}

          {/* KHUNG GIÁ / ĐẤU GIÁ */}
          <div className={`p-4 rounded-2xl border transition-all ${formData.isAuction ? 'bg-purple-50 border-purple-100' : 'bg-white border-transparent'}`}>
            {formData.isAuction ? (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center gap-2 mb-2">
                  <Gavel className="w-5 h-5 text-purple-600" />
                  <h3 className="font-black text-purple-700 uppercase text-xs tracking-widest">Thiết lập đấu giá</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase text-purple-400 tracking-widest">Giá khởi điểm *</label>
                    <input type="text" value={formData.price ? Number(formData.price).toLocaleString('vi-VN') : ''} onChange={(e) => setFormData({ ...formData, price: e.target.value.replace(/\D/g, '') })} className="w-full bg-white border border-purple-200 rounded-xl p-3 font-black text-purple-700 focus:ring-2 focus:ring-purple-500" placeholder="0" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-purple-400 tracking-widest">Bước giá *</label>
                    <select value={formData.bidIncrement} onChange={(e) => setFormData({ ...formData, bidIncrement: e.target.value })} className="w-full bg-white border border-purple-200 rounded-xl p-3 font-bold text-slate-700 focus:ring-2 focus:ring-purple-500">
                      <option value="10000">10.000 đ</option>
                      <option value="20000">20.000 đ</option>
                      <option value="50000">50.000 đ</option>
                      <option value="100000">100.000 đ</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-purple-400 tracking-widest">Kết thúc lúc *</label>
                  <input type="datetime-local" value={formData.auctionEndAt} onChange={(e) => setFormData({ ...formData, auctionEndAt: e.target.value })} className="w-full bg-white border border-purple-200 rounded-xl p-3 font-bold text-slate-700 focus:ring-2 focus:ring-purple-500" />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
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
                
                {priceSuggestions && (
                    <div className="w-full overflow-hidden mt-2">
                        <div className="flex gap-2 overflow-x-auto pb-2 w-full no-scrollbar touch-pan-x snap-x">
                            <button type="button" onClick={() => setFormData(p => ({...p, price: priceSuggestions.fast.toString()}))} className="snap-start flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition whitespace-nowrap">
                                <Zap className="w-3 h-3 text-green-600" fill="currentColor" />
                                <span className="text-[10px] font-bold text-green-600 uppercase">Bán nhanh</span>
                                <span className="text-xs font-black text-green-700">{Number(priceSuggestions.fast).toLocaleString('vi-VN')}</span>
                            </button>
                            <button type="button" onClick={() => setFormData(p => ({...p, price: priceSuggestions.market.toString()}))} className="snap-start flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition whitespace-nowrap">
                                <ThumbsUp className="w-3 h-3 text-blue-600" />
                                <span className="text-[10px] font-bold text-blue-600 uppercase">Hợp lý</span>
                                <span className="text-xs font-black text-blue-700">{Number(priceSuggestions.market).toLocaleString('vi-VN')}</span>
                            </button>
                            <button type="button" onClick={() => setFormData(p => ({...p, price: priceSuggestions.high.toString()}))} className="snap-start flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition whitespace-nowrap">
                                <TrendingUp className="w-3 h-3 text-purple-600" />
                                <span className="text-[10px] font-bold text-purple-600 uppercase">Lời cao</span>
                                <span className="text-xs font-black text-purple-700">{Number(priceSuggestions.high).toLocaleString('vi-VN')}</span>
                            </button>
                        </div>
                    </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className={labelStyle}>Khu vực</label>
              <select value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} className={inputStyle}>
                {LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between items-center mb-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Địa chỉ chi tiết</label>
                <button type="button" onClick={handleManualLocate} className="text-[9px] font-black text-blue-500 uppercase flex items-center gap-1 hover:text-blue-600">
                    <MapPin className="w-3 h-3" /> Lấy vị trí
                </button>
              </div>
              <input type="text" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className={inputStyle} placeholder="Số nhà, đường..." />
            </div>
          </div>

          <div className="space-y-1">
            <label className={labelStyle}>Mô tả chi tiết</label>
            <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className={`${inputStyle} h-40 leading-relaxed`} placeholder="Mô tả kỹ về sản phẩm..." />
          </div>

          {/* QUY TẮC & MẸO - ĐẸP HƠN VỚI ICON */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 p-5 rounded-2xl relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="flex items-center gap-2 font-black text-xs uppercase text-blue-600 mb-3 tracking-wider">
                <ShieldAlert className="w-4 h-4" /> Quy tắc & Mẹo Bán Nhanh
              </h3>
              <ul className="space-y-2">
                  <li className="flex items-start gap-2 text-xs text-gray-700 font-medium">
                    <Ban className="w-3.5 h-3.5 text-red-400 mt-0.5" /> <span>Không đăng hàng cấm, hàng giả.</span>
                  </li>
                  <li className="flex items-start gap-2 text-xs text-gray-700 font-medium">
                    <Camera className="w-3.5 h-3.5 text-blue-400 mt-0.5" /> <span>Hình ảnh tự chụp, rõ nét, không mờ.</span>
                  </li>
                  <li className="flex items-start gap-2 text-xs text-gray-700 font-medium">
                    <FileText className="w-3.5 h-3.5 text-green-400 mt-0.5" /> <span>Mô tả chi tiết tình trạng, xuất xứ.</span>
                  </li>
                  <li className="flex items-start gap-2 text-xs text-gray-700 font-medium">
                    <MessageCircle className="w-3.5 h-3.5 text-purple-400 mt-0.5" /> <span>Trả lời khách hàng lịch sự, nhanh chóng.</span>
                  </li>
              </ul>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
            <div className="relative flex items-center">
                <input type="checkbox" id="rules" checked={agreedToRules} onChange={e => setAgreedToRules(e.target.checked)} className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-gray-300 transition-all checked:border-primary checked:bg-primary" />
                <CheckSquare className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100 w-3.5 h-3.5" />
            </div>
            <label htmlFor="rules" className="text-[11px] font-bold text-gray-500 uppercase cursor-pointer select-none">Tôi cam kết tuân thủ quy tắc cộng đồng</label>
          </div>

          <button type="submit" disabled={loading} className={`w-full py-5 rounded-2xl font-black text-sm uppercase shadow-xl text-white transition-all transform active:scale-95 flex items-center justify-center gap-2 ${formData.isAuction ? 'bg-gradient-to-r from-purple-600 to-indigo-600 shadow-purple-200' : (listingType === 'affiliate' ? 'bg-gradient-to-r from-orange-500 to-red-500' : 'bg-primary hover:bg-primaryHover')}`}>
            {loading ? (
                <span>Đang xử lý...</span>
            ) : (
                <>
                    {formData.isAuction && <Gavel className="w-4 h-4" />}
                    {isEditing ? 'Lưu thay đổi' : (formData.isAuction ? 'Tạo phiên đấu giá' : (remainingPosts === 1 ? 'Đăng tin cuối cùng' : 'Đăng tin ngay'))}
                </>
            )}
          </button>
        </form>
      )}
    </div>
  );
};

export default PostListing;
