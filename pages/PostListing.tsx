import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
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

  // --- STATE QUẢN LÝ DANH MỤC ---
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedParentId, setSelectedParentId] = useState<string>("");
  const [selectedChildId, setSelectedChildId] = useState<string>("");
  const [currentAttributes, setCurrentAttributes] = useState<CategoryAttribute[]>([]);

  // --- STATE HỆ THỐNG & UI ---
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  
  // [AI STATE]
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [priceSuggestions, setPriceSuggestions] = useState<{fast: number, market: number, high: number} | null>(null);

  const [locationDetected, setLocationDetected] = useState<{ lat: number, lng: number } | null>(null);
  const [agreedToRules, setAgreedToRules] = useState(false);
  const [listingType, setListingType] = useState<'normal' | 'affiliate'>('normal');

  // --- STATE HẠN MỨC ---
  const [postsToday, setPostsToday] = useState(0);
  const [maxPosts, setMaxPosts] = useState(0);
  const [isLimitReached, setIsLimitReached] = useState(false);

  // --- STATE MEDIA ---
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string>("");
  const [existingVideoUrl, setExistingVideoUrl] = useState<string | null>(null);

  const [formData, setFormData] = useState<ListingFormData>({
    title: '', price: '', description: '', location: user?.location || 'Toàn quốc', address: user?.address || '',
    condition: 'used', images: [], attributes: {}, affiliateLink: '',
    // Đấu giá defaults
    isAuction: false,
    auctionEndAt: '',
    bidIncrement: '50000'
  });

  // Styles
  const inputStyle = "w-full bg-white border border-gray-200 rounded-2xl p-4 font-bold text-sm focus:outline-none focus:border-primary transition-all shadow-sm";
  const labelStyle = "text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 mb-1 block";

  // --- 1. INITIALIZE DATA ---
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

        // Tính hạn mức
        const userTier = user.subscriptionTier || 'free';
        const limit = (s?.tierConfigs as any)?.[userTier]?.postsPerDay || 5;
        setMaxPosts(limit);

        if (!isEditing && count >= limit) {
          setIsLimitReached(true);
        }

        // --- LOAD DATA KHI EDIT ---
        if (isEditing && id) {
          setLoading(true);
          const listing = await db.getListingById(id);
          if (!listing) { alert("Tin không tồn tại"); return navigate('/'); }
          if (listing.sellerId !== user.id && user.role !== 'admin') { alert("Không có quyền sửa"); return navigate('/'); }

          // Map Category
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

          // Map Form Data
          setFormData({
            title: listing.title,
            price: listing.price.toString(),
            description: listing.description,
            location: listing.location,
            address: listing.address || '',
            condition: listing.condition,
            images: listing.images,
            attributes: listing.attributes || {},
            affiliateLink: listing.affiliateLink || '',
            isAuction: listing.isAuction || false,
            auctionEndAt: listing.auctionEndAt ? new Date(listing.auctionEndAt).toISOString().slice(0, 16) : '',
            bidIncrement: listing.bidIncrement?.toString() || '50000'
          });

          if (listing.affiliateLink) setListingType('affiliate');
          if (listing.videoUrl) {
            setExistingVideoUrl(listing.videoUrl);
            setVideoPreview(listing.videoUrl);
          }
          setAgreedToRules(true);
          setLoading(false);
        }
      } catch (error) {
        console.error("Lỗi khởi tạo:", error);
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

      // GỌI AI: Chỉ chạy khi đang tạo mới, chưa có tiêu đề và vừa upload ảnh xong
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

  // --- AI LOGIC (MỚI: TỰ ĐỘNG ĐIỀN) ---
  const runAIAnalysis = async (images: string[]) => {
    setAiAnalyzing(true);
    try {
      const analysis = await analyzeListingImages(images.slice(0, 3)).catch(() => null);
      if (analysis) {
        // 1. Tự động khớp danh mục
        let foundChildId = "", foundParentId = "", newAttributes: any[] = [];
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

        // Cập nhật State Danh mục UI
        if (foundParentId) setSelectedParentId(foundParentId);
        if (foundChildId) setSelectedChildId(foundChildId);
        if (newAttributes.length > 0) setCurrentAttributes(newAttributes);

        // 2. Lưu gợi ý giá để hiện nút bấm (Inline)
        if (analysis.pricingStrategy) {
            setPriceSuggestions({
                fast: analysis.pricingStrategy.fastSell || 0,
                market: analysis.pricingStrategy.suggested || 0,
                high: analysis.pricingStrategy.highProfit || 0
            });
        }

        // 3. ĐIỀN THẲNG VÀO FORM (Ghi đè)
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

  // --- SUBMIT (ĐẦY ĐỦ LOGIC) ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !settings) return;

    // Check hạn mức
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
    if (!agreedToRules) return alert('Vui lòng đồng ý quy tắc.');

    // Validate Đấu giá
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
        auctionData = {
            isAuction: false,
            auctionEndAt: null,
            bidIncrement: null,
            bidsCount: 0,
            highestBidderId: null
        }
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
          } else {
            navigate('/manage-ads');
          }
        } else {
          alert("🎉 Đăng tin thành công!");
          navigate('/manage-ads');
        }
      }

    } catch (error) {
      console.error(error);
      alert("Lỗi khi xử lý tin. Thử lại sau.");
    } finally {
      setLoading(false);
    }
  };

  // --- RENDER DYNAMIC FIELDS ---
  const renderDynamicFields = () => {
    if (currentAttributes.length === 0) return null;
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in-up bg-blue-50/50 p-5 rounded-3xl border border-blue-100">
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

  // --- RENDER UI ---
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
            <br />Vui lòng quay lại vào ngày mai hoặc nâng cấp gói để đăng không giới hạn.
          </p>
          <div className="flex gap-4 justify-center pt-4">
            <Link to="/" className="px-6 py-3 bg-white border border-gray-200 rounded-xl font-bold text-sm uppercase hover:bg-gray-50">Về trang chủ</Link>
            <Link to="/upgrade" className="px-6 py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-xl font-bold text-sm uppercase shadow-lg hover:scale-105 transition-transform">Nâng cấp VIP ngay</Link>
          </div>
        </div>
      </div>
    );
  }

  const parentCategories = categories.filter(c => !c.parentId);
  const childCategories = categories.filter(c => c.parentId === selectedParentId);
  const hasChildren = childCategories.length > 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6 px-4 pb-20 pt-6 font-sans">
      <div className="text-center space-y-3 mb-6">
        <h1 className="text-3xl font-black text-gray-900 uppercase">{isEditing ? 'Chỉnh Sửa Tin' : 'Đăng Tin Mới'}</h1>
        {!isEditing && (
          <div className="flex flex-col items-center gap-2">
            <div className={`inline-flex items-center gap-3 px-5 py-2 rounded-full border shadow-sm ${remainingPosts <= 1 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
              <span className="text-xs font-bold text-gray-500 uppercase">{currentTierConfig.name}</span>
              <div className="h-4 w-[1px] bg-gray-300"></div>
              <span className={`text-xs font-black ${remainingPosts <= 1 ? 'text-red-500 animate-pulse' : 'text-primary'}`}>
                Còn {remainingPosts}/{maxPosts} tin hôm nay
              </span>
            </div>
          </div>
        )}
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
          {listingType === 'affiliate' && user?.subscriptionTier !== 'pro' ? (
            <div className="bg-orange-50 border border-orange-100 rounded-2xl p-8 text-center space-y-4">
              <div className="text-4xl">👑</div>
              <h3 className="text-sm font-black text-orange-600 uppercase">Dành cho VIP PRO</h3>
              <Link to="/upgrade" className="block w-full bg-orange-500 text-white py-4 rounded-xl font-bold text-xs">Nâng cấp ngay</Link>
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
              <div className="grid grid-cols-2 gap-3">
                {formData.images.map((img, i) => (
                  <div key={i} className="aspect-square rounded-xl overflow-hidden border border-gray-200 relative group">
                    <img src={img} className="w-full h-full object-cover" alt="" />
                    <button type="button" onClick={() => setFormData(p => ({ ...p, images: p.images.filter((_, idx) => idx !== i) }))} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all">✕</button>
                  </div>
                ))}
                {formData.images.length < currentTierConfig.maxImages && (
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="aspect-square bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:border-primary hover:text-primary transition-all">
                    <span className="text-3xl font-light">+</span><span className="text-[9px] font-black uppercase mt-1">Tải ảnh</span>
                  </button>
                )}
                {!videoPreview ? (
                  <button type="button" onClick={handleVideoClick} className={`aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center transition-all ${currentTierConfig.allowVideo ? 'bg-blue-50 border-blue-200 text-blue-500 hover:border-blue-400' : 'bg-gray-50 border-gray-200 text-gray-300 opacity-50 cursor-not-allowed'}`}>
                    <span className="text-2xl">📹</span><span className="text-[9px] font-black uppercase mt-1">Video</span>
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

          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 p-6 rounded-3xl relative overflow-hidden">
            <div className="absolute top-0 right-0 -mr-4 -mt-4 w-24 h-24 bg-blue-100 rounded-full opacity-50 blur-2xl"></div>
            <div className="relative z-10">
              <h3 className="flex items-center gap-2 font-black text-xs md:text-sm uppercase text-blue-600 mb-4 tracking-wider">
                <span className="text-lg">🛡️</span> Quy tắc & Mẹo Bán Nhanh
              </h3>
              <ul className="space-y-3">
                {[
                  { icon: "🚫", text: "Không đăng hàng cấm, hàng giả." },
                  { icon: "📸", text: "Hình ảnh tự chụp, rõ nét, không mờ." },
                  { icon: "📝", text: "Mô tả chi tiết tình trạng, xuất xứ." },
                  { icon: "💬", text: "Trả lời khách hàng lịch sự, nhanh chóng." }
                ].map((rule, i) => (
                  <li key={i} className="flex items-start gap-3 text-xs text-gray-700 font-medium">
                    <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center bg-white rounded-full shadow-sm text-[10px] border border-blue-100">
                      {rule.icon}
                    </span>
                    <span className="pt-0.5">{rule.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* CỘT PHẢI: FORM */}
        <div className="lg:col-span-8">
          {(listingType === 'normal' || user?.subscriptionTier === 'pro') && (
            <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-3xl p-8 shadow-xl shadow-gray-100/50 space-y-6">

              {!isEditing && remainingPosts === 1 && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-xl mb-2 animate-pulse">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">⚠️</span>
                    <div>
                      <h4 className="text-xs font-black text-yellow-700 uppercase">Lưu ý quan trọng</h4>
                      <p className="text-[11px] text-yellow-800">
                        Đây là tin đăng <strong>cuối cùng</strong> trong ngày của bạn. Sau tin này, bạn cần <Link to="/upgrade" className="font-bold underline ml-1">Nâng cấp VIP</Link> để đăng tiếp.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {listingType === 'normal' && (
                <div className="bg-gray-50 p-1.5 rounded-2xl flex relative mb-4">
                  <div className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-white rounded-xl shadow-sm transition-all duration-300 ${formData.isAuction ? 'left-[calc(50%+3px)]' : 'left-1.5'}`}></div>
                  <button type="button" onClick={() => setFormData(prev => ({ ...prev, isAuction: false }))} className={`flex-1 relative z-10 py-3 text-xs font-black uppercase tracking-widest transition-colors ${!formData.isAuction ? 'text-primary' : 'text-gray-400'}`}>🏷️ Giá cố định</button>
                  <button type="button" onClick={() => setFormData(prev => ({ ...prev, isAuction: true }))} className={`flex-1 relative z-10 py-3 text-xs font-black uppercase tracking-widest transition-colors ${formData.isAuction ? 'text-purple-600' : 'text-gray-400'}`}>🔨 Đấu giá</button>
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
                <input type="text" placeholder="Ví dụ: iPhone 15 Pro Max 256GB..." value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className={`${inputStyle} ${aiAnalyzing ? 'animate-pulse bg-blue-50' : ''}`} />
              </div>

              <div className="grid grid-cols-2 gap-6 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <div className="space-y-1">
                  <label className={labelStyle}>Danh mục Chính *</label>
                  <select value={selectedParentId} onChange={handleParentCategoryChange} className={inputStyle}>
                    <option value="">-- Chọn --</option>
                    {parentCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className={labelStyle}>Chi tiết {hasChildren && <span className="text-red-500">*</span>}</label>
                  <select value={selectedChildId} onChange={handleChildCategoryChange} className={inputStyle} disabled={!selectedParentId || !hasChildren}>
                    <option value="">{hasChildren ? "-- Chọn loại --" : "Không có mục con"}</option>
                    {childCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>)}
                  </select>
                </div>
              </div>

              {renderDynamicFields()}

              <div className={`p-6 rounded-2xl border transition-all ${formData.isAuction ? 'bg-purple-50 border-purple-100' : 'bg-white border-transparent'}`}>
                {formData.isAuction ? (
                  <div className="space-y-4 animate-fade-in">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">🔨</span>
                      <h3 className="font-black text-purple-700 uppercase text-xs tracking-widest">Thiết lập đấu giá</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
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
                          <option value="200000">200.000 đ</option>
                          <option value="500000">500.000 đ</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-purple-400 tracking-widest">Kết thúc lúc *</label>
                      <input type="datetime-local" value={formData.auctionEndAt} onChange={(e) => setFormData({ ...formData, auctionEndAt: e.target.value })} className="w-full bg-white border border-purple-200 rounded-xl p-3 font-bold text-slate-700 focus:ring-2 focus:ring-purple-500" />
                      <p className="text-[9px] text-purple-400 font-bold mt-1">* Tin đấu giá sẽ tự động kết thúc vào thời điểm này.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-6">
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
                    {/* [NEW] Gợi ý giá Inline */}
                    {priceSuggestions && (
                        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                            <button type="button" onClick={() => setFormData(p => ({...p, price: priceSuggestions.fast.toString()}))} className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition whitespace-nowrap">
                                <span className="text-[10px] font-bold text-green-600 uppercase">⚡ Bán nhanh</span>
                                <span className="text-xs font-black text-green-700">{Number(priceSuggestions.fast).toLocaleString('vi-VN')}</span>
                            </button>
                            <button type="button" onClick={() => setFormData(p => ({...p, price: priceSuggestions.market.toString()}))} className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition whitespace-nowrap">
                                <span className="text-[10px] font-bold text-blue-600 uppercase">👍 Hợp lý</span>
                                <span className="text-xs font-black text-blue-700">{Number(priceSuggestions.market).toLocaleString('vi-VN')}</span>
                            </button>
                            <button type="button" onClick={() => setFormData(p => ({...p, price: priceSuggestions.high.toString()}))} className="flex items-center gap-2 px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition whitespace-nowrap">
                                <span className="text-[10px] font-bold text-purple-600 uppercase">💰 Lời cao</span>
                                <span className="text-xs font-black text-purple-700">{Number(priceSuggestions.high).toLocaleString('vi-VN')}</span>
                            </button>
                        </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className={labelStyle}>Khu vực</label>
                  <select value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} className={inputStyle}>
                    {LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Địa chỉ chi tiết</label>
                    <button type="button" onClick={handleManualLocate} className="text-[9px] font-black text-blue-500 uppercase flex items-center gap-1 hover:text-blue-600">📍 Lấy vị trí</button>
                  </div>
                  <input type="text" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className={inputStyle} placeholder="Số nhà, đường..." />
                </div>
              </div>

              <div className="space-y-1">
                <label className={labelStyle}>Mô tả chi tiết</label>
                <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className={`${inputStyle} h-40 leading-relaxed ${aiAnalyzing ? 'animate-pulse bg-gray-50' : ''}`} placeholder="AI sẽ tự động viết mô tả..." />
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                <input type="checkbox" id="rules" checked={agreedToRules} onChange={e => setAgreedToRules(e.target.checked)} className="w-5 h-5 text-primary rounded" />
                <label htmlFor="rules" className="text-[11px] font-bold text-gray-500 uppercase cursor-pointer">Tôi cam kết tuân thủ quy tắc cộng đồng</label>
              </div>

              <button type="submit" disabled={loading} className={`w-full py-5 rounded-2xl font-black text-sm uppercase shadow-xl text-white transition-all transform active:scale-95 ${formData.isAuction ? 'bg-gradient-to-r from-purple-600 to-indigo-600 shadow-purple-200' : (listingType === 'affiliate' ? 'bg-gradient-to-r from-orange-500 to-red-500' : 'bg-primary hover:bg-primaryHover')}`}>
                {loading ? 'Đang xử lý...' : (isEditing ? 'Lưu thay đổi' : (formData.isAuction ? '🔨 Tạo phiên đấu giá' : (remainingPosts === 1 ? 'Đăng tin cuối cùng' : 'Đăng tin ngay')))}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default PostListing;
