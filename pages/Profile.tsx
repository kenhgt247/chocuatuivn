import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { db, SystemSettings } from '../services/db';
import { User, Listing } from '../types';
import ListingCard from '../components/ListingCard';
import { LOCATIONS, TIER_CONFIG } from '../constants';
import { formatPrice } from '../utils/format';

// Interface cho Modal xác nhận
interface ModalState {
  show: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  type: 'push' | 'delete' | 'alert';
}

const Profile: React.FC<{ user: User | null, onLogout: () => void, onUpdateUser: (u: User) => void }> = ({ user, onLogout, onUpdateUser }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'listings' | 'favorites' | 'settings'>('listings');
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [myFavs, setMyFavs] = useState<Listing[]>([]);
  
  // State quản lý tin
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [isPushing, setIsPushing] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>({
    show: false, title: '', message: '', type: 'alert', onConfirm: () => {}
  });

  // State Upload Avatar
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // State Xác thực (KYC)
  const [kycFiles, setKycFiles] = useState<{front: File | null, back: File | null}>({ front: null, back: null });
  const [kycPreviews, setKycPreviews] = useState<{front: string | null, back: string | null}>({ front: null, back: null });
  const [isSubmittingKyc, setIsSubmittingKyc] = useState(false);

  // Settings Form State
  const [editForm, setEditForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    location: user?.location || 'TPHCM',
    lat: user?.lat || 10.762622,
    lng: user?.lng || 106.660172
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    const loadProfileData = async () => {
      const [all, s] = await Promise.all([db.getListings(true), db.getSettings()]);
      setMyListings(all.filter(l => l.sellerId === user.id));
      setSettings(s);
      const favIds = await db.getFavorites(user.id);
      setMyFavs(all.filter(l => favIds.includes(l.id)));
    };
    loadProfileData();
  }, [user, navigate]);

  const subscriptionInfo = useMemo(() => {
    if (!user || !user.subscriptionExpires) return null;
    const expires = new Date(user.subscriptionExpires);
    const now = new Date();
    const diffTime = expires.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return {
      daysRemaining: diffDays > 0 ? diffDays : 0,
      expiryDate: expires.toLocaleDateString('vi-VN'),
      isExpired: diffDays <= 0
    };
  }, [user]);

  if (!user) return null;

  // --- LOGIC 1: ĐỔI AVATAR ---
  const handleAvatarClick = () => {
    avatarInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        // Validate ảnh (ví dụ < 2MB)
        if (file.size > 2 * 1024 * 1024) {
            alert("Vui lòng chọn ảnh nhỏ hơn 2MB");
            return;
        }

        setIsUploadingAvatar(true);
        try {
            // Convert file sang base64 để upload (hoặc dùng blob tùy logic db.uploadImage của bạn)
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                const base64 = reader.result as string;
                // Giả sử db.uploadImage nhận base64 và path
                const url = await db.uploadImage(base64, `avatars/${user.id}_${Date.now()}`);
                
                // Cập nhật profile ngay lập tức
                const updatedUser = await db.updateUserProfile(user.id, { avatar: url });
                onUpdateUser(updatedUser);
                alert("Đổi ảnh đại diện thành công!");
            };
        } catch (error) {
            console.error(error);
            alert("Lỗi khi tải ảnh lên");
        } finally {
            setIsUploadingAvatar(false);
        }
    }
  };

  // --- LOGIC 2: XÁC THỰC DANH TÍNH (KYC) ---
  const handleKycFileChange = (field: 'front' | 'back', e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        setKycFiles(prev => ({ ...prev, [field]: file }));
        
        // Tạo preview
        const reader = new FileReader();
        reader.onload = (ev) => {
            setKycPreviews(prev => ({ ...prev, [field]: ev.target?.result as string }));
        };
        reader.readAsDataURL(file);
    }
  };

  const handleSubmitKyc = async () => {
    if (!kycFiles.front || !kycFiles.back) {
        alert("Vui lòng tải lên đủ 2 mặt giấy tờ (CCCD/GPKD)");
        return;
    }

    if (!window.confirm("Bạn cam kết thông tin cung cấp là chính xác?")) return;

    setIsSubmittingKyc(true);
    try {
        // Upload 2 ảnh
        const uploadPromises = [kycFiles.front, kycFiles.back].map(file => {
             return new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = async () => {
                    const base64 = reader.result as string;
                    const url = await db.uploadImage(base64, `kyc/${user.id}_${Date.now()}_${Math.random()}`);
                    resolve(url);
                };
                reader.onerror = reject;
             });
        });

        const urls = await Promise.all(uploadPromises);

        // Cập nhật user status sang 'pending'
        // Lưu ý: Bạn cần update db.ts để hỗ trợ các trường này hoặc dùng updateUserProfile generic
        const updatedUser = await db.updateUserProfile(user.id, { 
            verificationStatus: 'pending',
            verificationDocuments: urls
        } as any); // cast any nếu type chưa cập nhật

        onUpdateUser(updatedUser);
        alert("Đã gửi yêu cầu xác thực! Admin sẽ duyệt trong 24h.");
        // Reset form
        setKycFiles({ front: null, back: null });
        setKycPreviews({ front: null, back: null });

    } catch (error) {
        console.error("KYC Error:", error);
        alert("Có lỗi xảy ra khi gửi hồ sơ.");
    } finally {
        setIsSubmittingKyc(false);
    }
  };

  // --- LOGIC CŨ (Đẩy tin, Xóa tin, Update Profile) ---
  const handlePushListing = (listingId: string, title: string) => {
    // ... (Giữ nguyên logic cũ của bạn)
     if (!user || !settings) return;
    const pushPrice = settings.pushPrice * (1 - (settings.pushDiscount || 0) / 100);
    if (user.walletBalance < pushPrice) {
      setModal({
        show: true,
        title: "Số dư không đủ",
        message: `Ví của bạn không đủ tiền (${formatPrice(pushPrice)}). Bạn có muốn nạp thêm không?`,
        type: 'alert',
        onConfirm: () => { setModal(prev => ({ ...prev, show: false })); navigate('/wallet'); }
      });
      return;
    }
    setModal({
      show: true, title: "Xác nhận đẩy tin", message: `Đẩy tin "${title}" với phí ${formatPrice(pushPrice)}?`, type: 'push',
      onConfirm: async () => {
        setModal(prev => ({ ...prev, show: false })); setIsPushing(listingId);
        try {
          const res = await db.pushListing(listingId, user.id);
          if (res.success) {
            const all = await db.getListings(true); setMyListings(all.filter(l => l.sellerId === user.id));
            const updatedUser = await db.getCurrentUser(); if (updatedUser) onUpdateUser(updatedUser);
            alert("Đẩy tin thành công!");
          }
        } catch (err) { alert("Lỗi khi đẩy tin"); } finally { setIsPushing(null); }
      }
    });
  };

  const handleDelete = (id: string) => {
    // ... (Giữ nguyên logic cũ của bạn)
    setModal({
      show: true, title: "Xóa tin đăng", message: "Hành động này không thể hoàn tác.", type: 'delete',
      onConfirm: async () => {
        setModal(prev => ({ ...prev, show: false }));
        try { await db.deleteListing(id); setMyListings(prev => prev.filter(l => l.id !== id)); } catch (e) { alert("Lỗi xóa tin"); }
      }
    });
  };

  const handleLogout = async () => { await db.logout(); onLogout(); navigate('/'); };
  
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault(); setIsSaving(true);
    const cleanUpdates: any = {};
    Object.keys(editForm).forEach(key => { const val = (editForm as any)[key]; if (val !== undefined) cleanUpdates[key] = val; });
    setTimeout(async () => {
      try { const updated = await db.updateUserProfile(user.id, cleanUpdates); onUpdateUser(updated); alert('Cập nhật thành công!'); } 
      catch (err) { alert("Lỗi cập nhật."); } finally { setIsSaving(false); }
    }, 800);
  };

  const pickCurrentLocation = () => { /* Giữ nguyên */
     if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setEditForm(prev => ({ ...prev, lat: pos.coords.latitude, lng: pos.coords.longitude }));
      }, () => alert("Lỗi GPS"));
    }
  };

  const currentPushPrice = settings ? settings.pushPrice * (1 - (settings.pushDiscount || 0) / 100) : 0;

  // Render Status Badge
  const renderVerificationStatus = () => {
    const status = (user as any).verificationStatus || 'unverified';
    switch (status) {
        case 'verified': return <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1">✅ Đã xác thực</span>;
        case 'pending': return <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1">🕒 Đang chờ duyệt</span>;
        case 'rejected': return <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1">❌ Bị từ chối</span>;
        default: return <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-[10px] font-black uppercase">Chưa xác thực</span>;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 px-4 md:px-0 relative">
      {/* Modal Overlay (Giữ nguyên) */}
      {modal.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setModal(prev => ({ ...prev, show: false }))}></div>
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl relative animate-fade-in-up border border-borderMain">
            <h3 className="text-xl font-black text-textMain mb-2">{modal.title}</h3>
            <p className="text-gray-500 text-sm font-medium mb-8 leading-relaxed">{modal.message}</p>
            <div className="flex gap-3">
               <button onClick={() => setModal(prev => ({ ...prev, show: false }))} className="flex-1 py-3.5 rounded-2xl font-black text-[11px] uppercase bg-gray-100 text-gray-500 hover:bg-gray-200">Hủy</button>
               <button onClick={modal.onConfirm} className={`flex-1 py-3.5 rounded-2xl font-black text-[11px] uppercase text-white shadow-lg ${modal.type === 'delete' ? 'bg-red-500' : 'bg-primary'}`}>Xác nhận</button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Header */}
      <div className="bg-white border border-borderMain rounded-[2.5rem] p-6 md:p-10 shadow-soft overflow-hidden relative">
        <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full -mr-20 -mt-20 blur-3xl"></div>
        <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
          
          {/* AVATAR CLICKABLE */}
          <div className="relative group cursor-pointer" onClick={handleAvatarClick}>
            <input 
                type="file" 
                ref={avatarInputRef} 
                className="hidden" 
                accept="image/*"
                onChange={handleAvatarChange}
            />
            <img src={user.avatar} alt={user.name} className="w-24 h-24 md:w-32 md:h-32 rounded-[2rem] border-4 border-white shadow-xl object-cover transition-filter group-hover:brightness-75" />
            
            {/* Loading Indicator for Avatar */}
            {isUploadingAvatar ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-[2rem]">
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                </div>
            )}
            
            {/* Edit Icon Badge */}
            <div className="absolute -bottom-2 -right-2 bg-primary text-white p-2.5 rounded-2xl shadow-lg border-4 border-white">
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            </div>
          </div>
          
          <div className="flex-1 space-y-3 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-4">
              <h1 className="text-2xl md:text-4xl font-black text-textMain tracking-tight">{user.name}</h1>
              {renderVerificationStatus()}
              {user.role === 'admin' && (
                <Link to="/admin" className="bg-red-500 text-white text-[10px] font-black px-4 py-1.5 rounded-xl uppercase tracking-widest shadow-lg shadow-red-100 hover:scale-105 transition-all">
                  Admin
                </Link>
              )}
            </div>
            {/* ... (Các phần hiển thị email/phone giữ nguyên) ... */}
            <div className="flex flex-wrap justify-center md:justify-start items-center gap-4 text-gray-400 text-xs font-bold uppercase tracking-widest">
              <span>{user.email}</span>
              <span className="hidden md:inline">•</span>
              <span>{user.phone || 'Chưa cập nhật SĐT'}</span>
            </div>

            {/* ... (Phần VIP Card giữ nguyên) ... */}
            <div className="flex flex-wrap justify-center md:justify-start gap-4 mt-6">
                <div className={`relative overflow-hidden p-5 rounded-3xl border shadow-lg transition-all min-w-[280px] ${user.subscriptionTier === 'free' ? 'bg-gray-50 border-gray-200' : 'bg-gradient-to-br from-yellow-500 to-orange-600 border-yellow-400 text-white shadow-yellow-200'}`}>
                  {/* ... Nội dung VIP card ... */}
                  <div className="relative z-10 flex items-start justify-between">
                     <div className="space-y-1">
                        <p className={`text-[10px] font-black uppercase tracking-widest ${user.subscriptionTier === 'free' ? 'text-gray-400' : 'text-white/80'}`}>Hạng thành viên</p>
                        <h4 className="text-xl font-black">{TIER_CONFIG[user.subscriptionTier].name}</h4>
                     </div>
                     <span className="text-2xl">{user.subscriptionTier === 'pro' ? '👑' : user.subscriptionTier === 'basic' ? '💎' : '🌱'}</span>
                  </div>
                  <div className="mt-4 flex items-end justify-between">
                     <div className="space-y-1">
                        {subscriptionInfo && !subscriptionInfo.isExpired ? (
                           <>
                              <p className={`text-[10px] font-bold ${user.subscriptionTier === 'free' ? 'text-gray-400' : 'text-white/70'}`}>Hết hạn: {subscriptionInfo.expiryDate}</p>
                              <p className="text-sm font-black">Còn {subscriptionInfo.daysRemaining} ngày</p>
                           </>
                        ) : (
                           <p className="text-[10px] font-bold text-gray-400">Chưa có đặc quyền VIP</p>
                        )}
                     </div>
                     <Link to="/upgrade" className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${user.subscriptionTier === 'free' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white/20 backdrop-blur-md text-white border border-white/30 hover:bg-white/30'}`}>
                        {user.subscriptionTier === 'free' ? 'Nâng cấp ngay' : 'Gia hạn gói'}
                     </Link>
                  </div>
               </div>

               <div className="bg-white border border-borderMain p-5 rounded-3xl shadow-soft min-w-[200px] flex flex-col justify-center gap-1">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Số dư ví</p>
                  <p className="text-2xl font-black text-primary">{formatPrice(user.walletBalance)}</p>
                  <Link to="/wallet" className="text-[10px] font-black text-primary/60 hover:text-primary mt-1 uppercase">Nạp thêm tiền →</Link>
               </div>
            </div>
          </div>
          
          <div className="flex flex-col gap-2 w-full md:w-auto self-start">
            <button onClick={handleLogout} className="text-red-500 font-black px-8 py-2 text-xs hover:bg-red-50 rounded-2xl transition-all uppercase tracking-widest">Đăng xuất</button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1.5 bg-gray-200/50 rounded-3xl w-full max-w-xl mx-auto md:mx-0">
        {[
          { id: 'listings', label: 'Quản lý tin', icon: '📦' },
          { id: 'favorites', label: 'Tin đã lưu', icon: '❤️' },
          { id: 'settings', label: 'Cài đặt', icon: '⚙️' }
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex-1 flex items-center justify-center gap-3 py-3.5 rounded-2xl text-[11px] font-black transition-all uppercase tracking-tighter ${activeTab === tab.id ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <span className="text-lg">{tab.icon}</span> <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="mt-8">
        {/* TAB 1 & 2: GIỮ NGUYÊN */}
        {activeTab === 'listings' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {myListings.map(listing => (
                <div key={listing.id} className="flex flex-col gap-3 group">
                    <div className="relative">
                        <ListingCard listing={listing} />
                        {listing.status !== 'approved' && (
                            <div className="absolute top-2 right-2 bg-gray-800 text-white text-[9px] font-black px-2 py-1 rounded uppercase z-20">
                                {listing.status === 'pending' ? 'Đang duyệt' : 'Từ chối'}
                            </div>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => handlePushListing(listing.id, listing.title)} disabled={isPushing !== null || listing.status !== 'approved'} className="bg-green-50 text-green-600 hover:bg-green-500 hover:text-white py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1 disabled:opacity-50 disabled:grayscale">
                             {isPushing === listing.id ? <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div> : <>⚡ Đẩy tin</>}
                        </button>
                        <button onClick={() => handleDelete(listing.id)} className="bg-red-50 text-red-500 hover:bg-red-500 hover:text-white py-2 rounded-xl text-[10px] font-black uppercase transition-all">🗑 Xóa</button>
                    </div>
                </div>
            ))}
            {myListings.length === 0 && <div className="col-span-full py-32 text-center bg-white border border-borderMain rounded-[3rem] shadow-soft text-gray-400 font-bold">Bạn chưa đăng tin nào.</div>}
          </div>
        )}

        {activeTab === 'favorites' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                {myFavs.map(listing => <ListingCard key={listing.id} listing={listing} isFavorite={true} />)}
                {myFavs.length === 0 && <div className="col-span-full py-32 text-center bg-white border border-borderMain rounded-[3rem] shadow-soft text-gray-400 font-bold">Chưa lưu tin nào.</div>}
            </div>
        )}

        {/* TAB 3: SETTINGS (ĐÃ THÊM PHẦN XÁC THỰC) */}
        {activeTab === 'settings' && (
          <div className="bg-white border border-borderMain rounded-[3rem] p-6 md:p-12 shadow-soft space-y-12">
            
            {/* 1. FORM THÔNG TIN CƠ BẢN */}
            <form onSubmit={handleSaveSettings} className="space-y-12">
              <div className="grid lg:grid-cols-2 gap-12">
                <div className="space-y-8">
                  <h3 className="text-xl font-black text-textMain flex items-center gap-3"><span className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">👤</span> Thông tin liên hệ</h3>
                  <div className="space-y-6">
                    <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Tên hiển thị</label><input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full bg-bgMain border border-borderMain rounded-2xl p-4 font-bold text-sm" /></div>
                    <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Email</label><input type="email" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} className="w-full bg-bgMain border border-borderMain rounded-2xl p-4 font-bold text-sm" /></div>
                    <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Số điện thoại</label><input type="tel" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} className="w-full bg-bgMain border border-borderMain rounded-2xl p-4 font-bold text-sm" /></div>
                  </div>
                </div>
                <div className="space-y-8">
                  <h3 className="text-xl font-black text-textMain flex items-center gap-3"><span className="w-10 h-10 bg-red-50 text-red-500 rounded-xl flex items-center justify-center">📍</span> Vị trí bán hàng</h3>
                  <div className="space-y-6">
                    <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Thành phố</label><select value={editForm.location} onChange={e => setEditForm({...editForm, location: e.target.value})} className="w-full bg-bgMain border border-borderMain rounded-2xl p-4 font-bold text-sm">{LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}</select></div>
                    <div className="space-y-4">
                        <button type="button" onClick={pickCurrentLocation} className="text-[10px] font-black text-primary flex items-center gap-1">Lấy vị trí hiện tại</button>
                        <div className="relative aspect-video rounded-3xl overflow-hidden border-2 border-white shadow-lg bg-gray-100 flex items-center justify-center">
                            <p className="text-gray-400 font-bold text-xs">{editForm.lat.toFixed(4)}, {editForm.lng.toFixed(4)}</p>
                        </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="pt-6 border-t border-gray-100 flex justify-end"><button type="submit" disabled={isSaving} className="px-12 py-4 bg-primary text-white font-black rounded-2xl shadow-lg">{isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}</button></div>
            </form>

            {/* 2. FORM XÁC THỰC DANH TÍNH (MỚI) */}
            <div className="pt-6 border-t-4 border-dashed border-gray-100 space-y-8">
                <h3 className="text-xl font-black text-textMain flex items-center gap-3">
                    <span className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">🛡️</span> 
                    Xác thực người bán (KYC)
                </h3>
                
                {(user as any).verificationStatus === 'verified' ? (
                    <div className="bg-green-50 border border-green-200 rounded-3xl p-8 text-center">
                        <div className="text-5xl mb-4">🎉</div>
                        <h4 className="text-lg font-black text-green-700">Tài khoản đã được xác thực!</h4>
                        <p className="text-sm text-green-600 mt-2">Bạn đã có tích xanh uy tín và được ưu tiên hiển thị.</p>
                    </div>
                ) : (user as any).verificationStatus === 'pending' ? (
                     <div className="bg-yellow-50 border border-yellow-200 rounded-3xl p-8 text-center">
                        <div className="text-5xl mb-4">⏳</div>
                        <h4 className="text-lg font-black text-yellow-700">Hồ sơ đang chờ duyệt</h4>
                        <p className="text-sm text-yellow-600 mt-2">Admin đang kiểm tra thông tin của bạn. Vui lòng quay lại sau.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <p className="text-sm text-gray-500">Vui lòng tải lên ảnh 2 mặt CCCD hoặc Giấy phép kinh doanh để được cấp tích xanh uy tín.</p>
                        
                        {(user as any).verificationStatus === 'rejected' && (
                             <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-sm font-bold border border-red-200">
                                ❌ Hồ sơ trước đó bị từ chối. Vui lòng kiểm tra lại ảnh chụp rõ nét hơn.
                             </div>
                        )}

                        <div className="grid md:grid-cols-2 gap-6">
                            {/* Mặt trước */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Mặt trước CCCD / GPKD</label>
                                <div className="relative aspect-video bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl overflow-hidden hover:border-primary/50 transition-colors group cursor-pointer">
                                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={(e) => handleKycFileChange('front', e)} accept="image/*" />
                                    {kycPreviews.front ? (
                                        <img src={kycPreviews.front} className="w-full h-full object-cover" alt="Front" />
                                    ) : (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                                            <span className="text-3xl mb-2">📷</span>
                                            <span className="text-xs font-bold">Tải ảnh lên</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Mặt sau */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Mặt sau CCCD / GPKD</label>
                                <div className="relative aspect-video bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl overflow-hidden hover:border-primary/50 transition-colors group cursor-pointer">
                                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={(e) => handleKycFileChange('back', e)} accept="image/*" />
                                    {kycPreviews.back ? (
                                        <img src={kycPreviews.back} className="w-full h-full object-cover" alt="Back" />
                                    ) : (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                                            <span className="text-3xl mb-2">📷</span>
                                            <span className="text-xs font-bold">Tải ảnh lên</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end pt-4">
                            <button 
                                type="button" 
                                onClick={handleSubmitKyc}
                                disabled={isSubmittingKyc || !kycFiles.front || !kycFiles.back}
                                className="px-12 py-4 bg-purple-600 text-white font-black rounded-2xl shadow-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                {isSubmittingKyc ? 'Đang gửi hồ sơ...' : 'Gửi hồ sơ xác thực'}
                            </button>
                        </div>
                    </div>
                )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;
