import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { db, SystemSettings } from '../services/db';
import { User, Category, CategoryAttribute } from '../types';
import { analyzeListingImages } from '../services/geminiService';
import { getLocationFromCoords } from '../utils/locationHelper';
// [QUAN TRỌNG] Import hàm nén ảnh từ utils của bạn
import { compressAndGetBase64 } from '../utils/imageCompression';
import { LOCATIONS } from '../constants';

// ⚠️ GIỮ NGUYÊN BỘ ICON VẼ TAY (AN TOÀN TUYỆT ĐỐI)
const IconTag = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l5 5a2 2 0 0 0 2.828 0l7.172-7.172a2 2 0 0 0 0-2.828l-5-5z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/></svg>;
const IconGavel = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m14 13-7.5 7.5c-.83.83-2.17.83-3 0 0 0 0 0 0 0a2.12 2.12 0 0 1 0-3L11 10"/><path d="m16 16 6-6"/><path d="m8 8 6-6"/><path d="m9 7 8 8"/><path d="m21 11-8-8"/></svg>;
const IconVideo = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>;
const IconLock = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
const IconPackage = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m16.5 9.4-9-5.19"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>;
const IconCoins = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/><path d="m14.59 15.29.7.71"/></svg>;
const IconCrown = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/></svg>;
const IconImagePlus = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7"/><line x1="16" y1="5" x2="22" y2="5"/><line x1="19" y1="2" x2="19" y2="8"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>;
const IconX = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 18 18"/></svg>;
const IconMapPin = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>;
const IconShieldAlert = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
const IconBan = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 14.14 14.14"/></svg>;
const IconCamera = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>;
const IconFileText = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>;
const IconMessageCircle = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>;
const IconAlertTriangle = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
const IconZap = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>;
const IconThumbsUp = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z"/></svg>;
const IconTrendingUp = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>;
const IconAlertOctagon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
const IconCheckSquare = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>;

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

  // [UI STYLES]
  const inputStyle = "w-full min-w-0 bg-white border border-slate-300 rounded-xl p-4 text-sm font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm hover:border-blue-400";
  const labelStyle = "text-xs font-black text-slate-500 uppercase tracking-widest px-1 mb-2 block";

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

  // [CHỨC NĂNG NÉN ẢNH ĐÃ ĐƯỢC TÍCH HỢP]
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0 || !settings) return;
    const userTier = user?.subscriptionTier || 'free';
    const tierConfig = (settings.tierConfigs as any)[userTier];

    if (files.length + formData.images.length > tierConfig.maxImages) {
      return alert(`Gói ${tierConfig.name} tối đa ${tierConfig.maxImages} ảnh.`);
    }

    try {
      // Dùng hàm nén ảnh từ utils (như yêu cầu của bạn)
      const compressedResults = await Promise.all(files.map(file => compressAndGetBase64(file)));
      const updatedImages = [...formData.images, ...compressedResults];
      setFormData(prev => ({ ...prev, images: updatedImages }));

      // Tự động phân tích ảnh bằng AI nếu chưa có tiêu đề
      if (!isEditing && compressedResults.length > 0 && !formData.title) {
        runAIAnalysis(updatedImages);
      }
    } catch (error) { 
        console.error(error); 
        alert("Lỗi xử lý ảnh."); 
    }
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

    const currentTierConfig = (settings.tierConfigs as any)[user.subscriptionTier || 'free'];
    
    if ((videoFile || existingVideoUrl) && !currentTierConfig.allowVideo) {
        return alert("❌ Gói cước của bạn không hỗ trợ đăng Video. Vui lòng nâng cấp!");
    }
    if (formData.isAuction && !['basic', 'pro'].includes(user.subscriptionTier || '')) {
        return alert("❌ Tính năng Đấu giá chỉ dành cho VIP. Vui lòng nâng cấp!");
    }
    if (formData.images.length > currentTierConfig.maxImages) {
        return alert(`❌ Bạn chỉ được đăng tối đa ${currentTierConfig.maxImages} ảnh!`);
    }

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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in-up bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-2xl border border-blue-100 shadow-inner">
        <div className="col-span-1 md:col-span-2 text-xs font-black text-blue-600 uppercase tracking-widest mb-2 border-b border-blue-200 pb-2 flex items-center gap-2">
            <IconFileText className="w-4 h-4" /> Thông tin chi tiết
        </div>
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
                {attr.suffix && <span className="absolute right-4 top-4 text-slate-400 text-xs font-bold pointer-events-none">{attr.suffix}</span>}
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
          <IconAlertOctagon className="w-20 h-20 text-red-500 animate-bounce mb-4" />
          <h2 className="text-2xl font-black text-red-600 uppercase">Hết hạn mức đăng tin</h2>
          <p className="text-gray-600 font-medium leading-relaxed">
            Bạn đã sử dụng hết <span className="font-bold text-black">{maxPosts}/{maxPosts}</span> lượt đăng tin miễn phí trong ngày hôm nay.
          </p>
          <div className="flex gap-4 justify-center pt-4">
            <Link to="/" className="px-6 py-3 bg-white border border-gray-200 rounded-xl font-bold text-sm uppercase hover:bg-gray-50">Về trang chủ</Link>
            <Link to="/upgrade" className="px-6 py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-xl font-bold text-sm uppercase shadow-lg hover:scale-105 transition-transform flex items-center gap-2">
              <IconCrown className="w-4 h-4" /> Nâng cấp VIP
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
    <div className="w-full max-w-4xl mx-auto space-y-8 px-4 pb-24 pt-8 font-sans overflow-x-hidden">
      
      {/* HEADER */}
      <div className="text-center space-y-4 mb-8">
        <h1 className="text-3xl md:text-4xl font-black text-slate-900 uppercase tracking-tighter drop-shadow-sm">{isEditing ? 'Sửa Tin' : 'Đăng Tin'}</h1>
        {!isEditing && (
          <div className="flex justify-center">
            <div className={`inline-flex items-center gap-4 px-6 py-2.5 rounded-full border shadow-sm backdrop-blur-sm ${remainingPosts <= 1 ? 'bg-red-50 border-red-200 ring-4 ring-red-50' : 'bg-white border-slate-200 ring-4 ring-slate-50'}`}>
              <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                 <IconCrown className="w-4 h-4 text-yellow-500" /> {currentTierConfig.name}
              </span>
              <div className="h-4 w-[1px] bg-slate-300"></div>
              <span className={`text-xs font-black ${remainingPosts <= 1 ? 'text-red-500 animate-pulse' : 'text-primary'}`}>
                Còn {remainingPosts}/{maxPosts} tin
              </span>
            </div>
          </div>
        )}
      </div>

      {!isEditing && (
        <div className="bg-slate-100 p-1.5 rounded-2xl flex max-w-md mx-auto shadow-inner mb-8">
          <button onClick={() => setListingType('normal')} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wide transition-all flex items-center justify-center gap-2 ${listingType === 'normal' ? 'bg-white shadow-md text-primary scale-[1.02]' : 'text-gray-400 hover:text-gray-600'}`}>
            <IconPackage className="w-4 h-4" /> Bán ngay
          </button>
          <button onClick={() => setListingType('affiliate')} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wide transition-all flex items-center justify-center gap-2 ${listingType === 'affiliate' ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md scale-[1.02]' : 'text-gray-400 hover:text-gray-600'}`}>
            <IconCoins className="w-4 h-4" /> Tiếp thị VIP
          </button>
        </div>
      )}

      {/* --- KHỐI MEDIA --- */}
      {listingType === 'affiliate' && user?.subscriptionTier !== 'pro' ? (
        <div className="bg-orange-50 border-2 border-orange-100 rounded-[2.5rem] p-10 text-center space-y-6 flex flex-col items-center shadow-lg shadow-orange-100/50">
          <div className="bg-white p-4 rounded-full shadow-md"><IconCrown className="w-16 h-16 text-orange-400" /></div>
          <div className="space-y-2">
              <h3 className="text-lg font-black text-orange-600 uppercase tracking-widest">Dành cho VIP PRO</h3>
              <p className="text-sm text-orange-800 font-medium">Nâng cấp để mở khóa tính năng tiếp thị liên kết và kiếm tiền thụ động.</p>
          </div>
          <Link to="/upgrade" className="block w-full max-w-xs bg-gradient-to-r from-orange-500 to-red-500 text-white py-4 rounded-2xl font-black text-sm uppercase shadow-lg shadow-orange-300 hover:scale-105 transition-transform">Nâng cấp ngay</Link>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-xl shadow-slate-100/50 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full blur-3xl -mr-32 -mt-32 opacity-50 group-hover:opacity-100 transition-opacity"></div>

          <div className="flex justify-between items-center mb-6 relative z-10">
            <label className={labelStyle}>Hình ảnh & Video ({formData.images.length}/{currentTierConfig.maxImages})</label>
            {aiAnalyzing && (
                <div className="flex items-center gap-2 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></div>
                    <span className="text-[10px] font-bold text-blue-600 uppercase">AI đang phân tích...</span>
                </div>
            )}
          </div>
          
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 relative z-10">
            {formData.images.map((img, i) => (
              <div key={i} className="aspect-square rounded-2xl overflow-hidden border-2 border-slate-100 relative group shadow-sm hover:shadow-md transition-all">
                <img src={img} className="w-full h-full object-cover" alt="" />
                <button type="button" onClick={() => setFormData(p => ({ ...p, images: p.images.filter((_, idx) => idx !== i) }))} className="absolute top-1 right-1 bg-black/50 hover:bg-red-500 text-white rounded-full p-1.5 backdrop-blur-sm transition-all scale-90 hover:scale-100">
                    <IconX className="w-3 h-3" />
                </button>
              </div>
            ))}
            
            {formData.images.length < currentTierConfig.maxImages && (
              <button type="button" onClick={() => fileInputRef.current?.click()} className="aspect-square bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center text-slate-400 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-500 transition-all group">
                <div className="bg-white p-2 rounded-full shadow-sm mb-2 group-hover:scale-110 transition-transform">
                    <IconImagePlus className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-bold uppercase">Thêm ảnh</span>
              </button>
            )}

            {!videoPreview ? (
              currentTierConfig.allowVideo ? (
                <button type="button" onClick={handleVideoClick} className="aspect-square rounded-2xl border-2 border-dashed border-purple-200 bg-purple-50 text-purple-500 hover:border-purple-500 hover:bg-purple-100 flex flex-col items-center justify-center transition-all group">
                  <div className="bg-white p-2 rounded-full shadow-sm mb-2 group-hover:scale-110 transition-transform">
                      <IconVideo className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-bold uppercase">Video</span>
                </button>
              ) : (
                <button type="button" onClick={() => {
                    if(window.confirm("📹 Tính năng đăng Video chỉ dành cho VIP.\nNâng cấp ngay?")) { navigate('/upgrade'); }
                  }} className="aspect-square rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 text-slate-300 flex flex-col items-center justify-center cursor-not-allowed transition-all relative">
                  <IconVideo className="w-8 h-8 grayscale opacity-50" />
                  <div className="absolute top-2 right-2 bg-slate-200 rounded-full p-1.5 text-slate-500">
                    <IconLock className="w-3 h-3" />
                  </div>
                </button>
              )
            ) : (
              <div className="aspect-square rounded-2xl overflow-hidden border-2 border-purple-500 relative group shadow-lg">
                <video src={videoPreview} className="w-full h-full object-cover" />
                <button type="button" onClick={() => { setVideoFile(null); setVideoPreview(""); setExistingVideoUrl(null); }} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1.5 shadow-md hover:scale-110 transition-transform">
                    <IconX className="w-3 h-3" />
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
        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-[2.5rem] p-8 md:p-10 shadow-xl shadow-slate-200/50 space-y-8 relative">
          
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-gradient-to-r from-transparent via-slate-300 to-transparent rounded-b-full"></div>

          {!isEditing && remainingPosts === 1 && (
            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-2xl flex items-center gap-4 animate-pulse shadow-sm">
              <div className="bg-yellow-100 p-2 rounded-full text-yellow-600"><IconAlertTriangle className="w-6 h-6" /></div>
              <div>
                <h4 className="text-xs font-black text-yellow-800 uppercase tracking-wide">Lưu ý quan trọng</h4>
                <p className="text-xs text-yellow-700 font-medium">Đây là tin đăng cuối cùng miễn phí trong ngày của bạn.</p>
              </div>
            </div>
          )}

          {listingType === 'normal' && (
            <div className="bg-slate-100 p-1.5 rounded-2xl flex relative max-w-sm">
              <div className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-white rounded-xl shadow-md transition-all duration-300 ease-spring ${formData.isAuction ? 'left-[calc(50%+3px)]' : 'left-1.5'}`}></div>
              
              <button type="button" onClick={() => setFormData(prev => ({ ...prev, isAuction: false }))} className={`flex-1 relative z-10 py-3 text-xs font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 ${!formData.isAuction ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>
                <IconTag className="w-3.5 h-3.5" /> Giá cố định
              </button>
              
              {['basic', 'pro'].includes(user?.subscriptionTier || '') ? (
                <button type="button" onClick={() => setFormData(prev => ({ ...prev, isAuction: true }))} className={`flex-1 relative z-10 py-3 text-xs font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 ${formData.isAuction ? 'text-purple-600' : 'text-slate-400 hover:text-slate-600'}`}>
                    <IconGavel className="w-3.5 h-3.5" /> Đấu giá
                </button>
              ) : (
                <button type="button" onClick={() => { if(window.confirm("💎 Tính năng Đấu Giá chỉ dành cho thành viên VIP.\nBạn có muốn nâng cấp ngay không?")) { navigate('/upgrade'); } }} className="flex-1 relative z-10 py-3 text-xs font-black uppercase tracking-widest text-slate-300 cursor-not-allowed flex items-center justify-center gap-1">
                  <IconGavel className="w-3.5 h-3.5" /> <span>Đấu giá</span>
                  <IconLock className="w-3 h-3 ml-1" />
                </button>
              )}
            </div>
          )}

          <div className="space-y-2">
            <label className={labelStyle}>Tiêu đề tin đăng *</label>
            <input type="text" placeholder="Ví dụ: iPhone 15 Pro Max 256GB Chính hãng..." value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className={`${inputStyle} text-lg`} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-slate-50 rounded-3xl border border-slate-100">
            <div className="space-y-2">
              <label className={labelStyle}>Danh mục Chính *</label>
              <select value={selectedParentId} onChange={handleParentCategoryChange} className={inputStyle}>
                <option value="">-- Chọn danh mục --</option>
                {parentCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className={labelStyle}>Chi tiết danh mục</label>
              <select value={selectedChildId} onChange={handleChildCategoryChange} className={inputStyle} disabled={!selectedParentId || !hasChildren}>
                <option value="">{hasChildren ? "-- Chọn loại --" : "Không có mục con"}</option>
                {childCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
            </div>
          </div>

          {renderDynamicFields()}

          {/* SECTION GIÁ */}
          <div className={`p-6 rounded-3xl border-2 transition-all shadow-sm ${formData.isAuction ? 'bg-purple-50 border-purple-200' : 'bg-white border-slate-100'}`}>
            {formData.isAuction ? (
              <div className="space-y-6 animate-fade-in">
                <div className="flex items-center gap-3 border-b border-purple-200 pb-4">
                  <div className="bg-purple-200 p-2 rounded-lg text-purple-700"><IconGavel className="w-6 h-6" /></div>
                  <h3 className="font-black text-purple-800 uppercase text-sm tracking-widest">Thiết lập phiên đấu giá</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase text-purple-500 tracking-widest">Giá khởi điểm *</label>
                    <input type="text" value={formData.price ? Number(formData.price).toLocaleString('vi-VN') : ''} onChange={(e) => setFormData({ ...formData, price: e.target.value.replace(/\D/g, '') })} className="w-full bg-white border border-purple-200 rounded-xl p-4 font-black text-lg text-purple-700 focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 outline-none" placeholder="0" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase text-purple-500 tracking-widest">Bước giá tối thiểu *</label>
                    <select value={formData.bidIncrement} onChange={(e) => setFormData({ ...formData, bidIncrement: e.target.value })} className="w-full bg-white border border-purple-200 rounded-xl p-4 font-bold text-slate-700 focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 outline-none">
                      <option value="10000">10.000 đ</option>
                      <option value="20000">20.000 đ</option>
                      <option value="50000">50.000 đ</option>
                      <option value="100000">100.000 đ</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase text-purple-500 tracking-widest">Thời gian kết thúc *</label>
                  <input type="datetime-local" value={formData.auctionEndAt} onChange={(e) => setFormData({ ...formData, auctionEndAt: e.target.value })} className="w-full bg-white border border-purple-200 rounded-xl p-4 font-bold text-slate-700 focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 outline-none" />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className={labelStyle}>Giá bán mong muốn (VNĐ) *</label>
                    <div className="relative">
                        <input type="text" placeholder="0" value={formData.price ? Number(formData.price).toLocaleString('vi-VN') : ''} onChange={(e) => setFormData({ ...formData, price: e.target.value.replace(/\D/g, '') })} className={`${inputStyle} text-lg pl-4 pr-12 font-black text-blue-600`} />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">VNĐ</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className={labelStyle}>Tình trạng sản phẩm</label>
                    <select value={formData.condition} onChange={(e) => setFormData({ ...formData, condition: e.target.value as any })} className={inputStyle}>
                      <option value="used">Đã qua sử dụng</option>
                      <option value="new">Mới 100% (Chưa bóc seal)</option>
                    </select>
                  </div>
                </div>
                
                {priceSuggestions && (
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-3 flex items-center gap-1"><IconZap className="w-3 h-3 text-yellow-500" /> Gợi ý giá từ AI:</p>
                        <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => setFormData(p => ({...p, price: priceSuggestions.fast.toString()}))} className="flex items-center gap-2 px-4 py-2 bg-white border border-green-200 rounded-xl hover:bg-green-50 transition shadow-sm">
                                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                <div>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase">Bán nhanh</p>
                                    <p className="text-xs font-black text-green-600">{Number(priceSuggestions.fast).toLocaleString('vi-VN')}</p>
                                </div>
                            </button>
                            <button type="button" onClick={() => setFormData(p => ({...p, price: priceSuggestions.market.toString()}))} className="flex items-center gap-2 px-4 py-2 bg-white border border-blue-200 rounded-xl hover:bg-blue-50 transition shadow-sm ring-1 ring-blue-100">
                                <IconThumbsUp className="w-4 h-4 text-blue-500" />
                                <div>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase">Giá thị trường</p>
                                    <p className="text-xs font-black text-blue-600">{Number(priceSuggestions.market).toLocaleString('vi-VN')}</p>
                                </div>
                            </button>
                            <button type="button" onClick={() => setFormData(p => ({...p, price: priceSuggestions.high.toString()}))} className="flex items-center gap-2 px-4 py-2 bg-white border border-purple-200 rounded-xl hover:bg-purple-50 transition shadow-sm">
                                <IconTrendingUp className="w-4 h-4 text-purple-500" />
                                <div>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase">Giá cao</p>
                                    <p className="text-xs font-black text-purple-600">{Number(priceSuggestions.high).toLocaleString('vi-VN')}</p>
                                </div>
                            </button>
                        </div>
                    </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className={labelStyle}>Khu vực bán</label>
              <select value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} className={inputStyle}>
                {LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center mb-2">
                <label className={labelStyle}>Địa chỉ chi tiết</label>
                <button type="button" onClick={handleManualLocate} className="text-[10px] font-black text-blue-600 uppercase flex items-center gap-1 hover:underline bg-blue-50 px-2 py-1 rounded-lg">
                    <IconMapPin className="w-3 h-3" /> Lấy vị trí hiện tại
                </button>
              </div>
              <input type="text" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className={inputStyle} placeholder="Số nhà, tên đường, phường/xã..." />
            </div>
          </div>

          <div className="space-y-2">
            <label className={labelStyle}>Mô tả chi tiết sản phẩm</label>
            <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className={`${inputStyle} h-48 leading-relaxed resize-none`} placeholder="Hãy mô tả chi tiết về sản phẩm: xuất xứ, tình trạng, phụ kiện đi kèm, bảo hành..." />
          </div>

          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-100 p-6 rounded-3xl relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="flex items-center gap-2 font-black text-xs uppercase text-blue-700 mb-4 tracking-wider">
                <IconShieldAlert className="w-5 h-5" /> Quy tắc & Mẹo Bán Nhanh
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex items-start gap-3 bg-white/60 p-3 rounded-xl">
                    <div className="bg-red-100 p-1.5 rounded-lg text-red-500"><IconBan className="w-4 h-4" /></div>
                    <span className="text-xs text-slate-700 font-medium pt-0.5">Không đăng hàng cấm, hàng giả, hàng nhái.</span>
                  </div>
                  <div className="flex items-start gap-3 bg-white/60 p-3 rounded-xl">
                    <div className="bg-blue-100 p-1.5 rounded-lg text-blue-500"><IconCamera className="w-4 h-4" /></div>
                    <span className="text-xs text-slate-700 font-medium pt-0.5">Hình ảnh tự chụp, rõ nét, đầy đủ góc cạnh.</span>
                  </div>
                  <div className="flex items-start gap-3 bg-white/60 p-3 rounded-xl">
                    <div className="bg-green-100 p-1.5 rounded-lg text-green-500"><IconFileText className="w-4 h-4" /></div>
                    <span className="text-xs text-slate-700 font-medium pt-0.5">Mô tả trung thực tình trạng, lỗi lầm (nếu có).</span>
                  </div>
                  <div className="flex items-start gap-3 bg-white/60 p-3 rounded-xl">
                    <div className="bg-purple-100 p-1.5 rounded-lg text-purple-500"><IconMessageCircle className="w-4 h-4" /></div>
                    <span className="text-xs text-slate-700 font-medium pt-0.5">Trả lời khách hàng lịch sự, nhanh chóng.</span>
                  </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
            <div className="relative flex items-center">
                <input type="checkbox" id="rules" checked={agreedToRules} onChange={e => setAgreedToRules(e.target.checked)} className="peer h-6 w-6 cursor-pointer appearance-none rounded-lg border-2 border-slate-300 transition-all checked:border-blue-600 checked:bg-blue-600 hover:border-blue-400" />
                <IconCheckSquare className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100 w-4 h-4" />
            </div>
            <label htmlFor="rules" className="text-xs font-bold text-slate-600 uppercase cursor-pointer select-none hover:text-blue-600 transition-colors">Tôi cam kết tuân thủ quy tắc cộng đồng của Chợ Của Tui</label>
          </div>

          <button type="submit" disabled={loading} className={`w-full py-5 rounded-2xl font-black text-sm uppercase shadow-xl text-white transition-all transform active:scale-[0.98] hover:shadow-2xl flex items-center justify-center gap-3 ${formData.isAuction ? 'bg-gradient-to-r from-purple-600 to-indigo-600 shadow-purple-200' : (listingType === 'affiliate' ? 'bg-gradient-to-r from-orange-500 to-red-500 shadow-orange-200' : 'bg-gradient-to-r from-blue-600 to-cyan-600 shadow-blue-200 hover:brightness-110')}`}>
            {loading ? (
                <span>Đang xử lý...</span>
            ) : (
                <>
                    {formData.isAuction ? <IconGavel className="w-5 h-5" /> : <IconPackage className="w-5 h-5" />}
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