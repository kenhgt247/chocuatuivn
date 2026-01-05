import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { db, SystemSettings } from '../services/db'; // Import thêm SystemSettings
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
  
  // --- STATE CHO QUẢN LÝ TIN (MỚI) ---
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [isPushing, setIsPushing] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>({
    show: false, title: '', message: '', type: 'alert', onConfirm: () => {}
  });

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
      // Load settings để lấy giá đẩy tin
      const [all, s] = await Promise.all([db.getListings(true), db.getSettings()]); // true để lấy cả tin pending/rejected
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

  // --- LOGIC XỬ LÝ ĐẨY TIN & XÓA TIN (MỚI) ---
  const handlePushListing = (listingId: string, title: string) => {
    if (!user || !settings) return;
    
    const pushPrice = settings.pushPrice * (1 - (settings.pushDiscount || 0) / 100);
    
    if (user.walletBalance < pushPrice) {
      setModal({
        show: true,
        title: "Số dư không đủ",
        message: `Ví của bạn không đủ tiền (${formatPrice(pushPrice)}). Bạn có muốn nạp thêm không?`,
        type: 'alert',
        onConfirm: () => {
          setModal(prev => ({ ...prev, show: false }));
          navigate('/wallet');
        }
      });
      return;
    }

    setModal({
      show: true,
      title: "Xác nhận đẩy tin",
      message: `Bạn muốn dùng ${formatPrice(pushPrice)} để đưa tin "${title}" lên đầu danh sách?`,
      type: 'push',
      onConfirm: async () => {
        setModal(prev => ({ ...prev, show: false }));
        setIsPushing(listingId);
        try {
          const res = await db.pushListing(listingId, user.id);
          if (res.success) {
            // Reload lại data
            const all = await db.getListings(true);
            setMyListings(all.filter(l => l.sellerId === user.id));
            
            // Cập nhật ví user
            const updatedUser = await db.getCurrentUser();
            if (updatedUser) onUpdateUser(updatedUser);
            
            alert("Đẩy tin thành công!");
          }
        } catch (err) {
          console.error("Push error:", err);
          alert("Có lỗi xảy ra khi đẩy tin.");
        } finally {
          setIsPushing(null);
        }
      }
    });
  };

  const handleDelete = (id: string) => {
    setModal({
      show: true,
      title: "Xóa tin đăng",
      message: "Bạn có chắc chắn muốn xoá tin đăng này? Giao dịch này không thể hoàn tác.",
      type: 'delete',
      onConfirm: async () => {
        setModal(prev => ({ ...prev, show: false }));
        try {
            await db.deleteListing(id);
            setMyListings(prev => prev.filter(l => l.id !== id));
        } catch (e) {
            alert("Lỗi khi xóa tin");
        }
      }
    });
  };
  // ------------------------------------------------

  const handleLogout = async () => {
    await db.logout();
    onLogout();
    navigate('/');
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    const cleanUpdates: any = {};
    Object.keys(editForm).forEach(key => {
      const val = (editForm as any)[key];
      if (val !== undefined) {
        cleanUpdates[key] = val;
      }
    });

    setTimeout(async () => {
      try {
        const updated = await db.updateUserProfile(user.id, cleanUpdates);
        onUpdateUser(updated);
        alert('Cập nhật thông tin tài khoản thành công!');
      } catch (err) {
        console.error("Update profile error:", err);
        alert("Đã xảy ra lỗi khi cập nhật hồ sơ.");
      } finally {
        setIsSaving(false);
      }
    }, 800);
  };

  const pickCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setEditForm(prev => ({
          ...prev,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        }));
      }, () => alert("Không thể lấy vị trí hiện tại. Vui lòng kiểm tra quyền truy cập GPS."));
    }
  };

  const currentPushPrice = settings ? settings.pushPrice * (1 - (settings.pushDiscount || 0) / 100) : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 px-4 md:px-0 relative">
      
      {/* --- MODAL OVERLAY (MỚI) --- */}
      {modal.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setModal(prev => ({ ...prev, show: false }))}></div>
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl relative animate-fade-in-up border border-borderMain">
            <h3 className="text-xl font-black text-textMain mb-2">{modal.title}</h3>
            <p className="text-gray-500 text-sm font-medium mb-8 leading-relaxed">{modal.message}</p>
            <div className="flex gap-3">
               <button 
                onClick={() => setModal(prev => ({ ...prev, show: false }))}
                className="flex-1 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-widest bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
               >
                 Hủy
               </button>
               <button 
                onClick={modal.onConfirm}
                className={`flex-1 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-widest text-white shadow-lg transition-transform active:scale-95 ${modal.type === 'delete' ? 'bg-red-500' : 'bg-primary'}`}
               >
                 Xác nhận
               </button>
            </div>
          </div>
        </div>
      )}
      {/* --------------------------- */}

      {/* Profile Header */}
      <div className="bg-white border border-borderMain rounded-[2.5rem] p-6 md:p-10 shadow-soft overflow-hidden relative">
        <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full -mr-20 -mt-20 blur-3xl"></div>
        <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
          <div className="relative group">
            <img src={user.avatar} alt={user.name} className="w-24 h-24 md:w-32 md:h-32 rounded-[2rem] border-4 border-white shadow-xl object-cover" />
            <button className="absolute -bottom-2 -right-2 bg-primary text-white p-2.5 rounded-2xl shadow-lg hover:scale-110 transition-transform border-4 border-white">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            </button>
          </div>
          <div className="flex-1 space-y-3 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-4">
              <h1 className="text-2xl md:text-4xl font-black text-textMain tracking-tight">{user.name}</h1>
              {user.role === 'admin' && (
                <Link to="/admin" className="bg-red-500 text-white text-[10px] font-black px-4 py-1.5 rounded-xl uppercase tracking-widest shadow-lg shadow-red-100 flex items-center gap-2 hover:scale-105 transition-all">
                  <span className="w-2 h-2 bg-white rounded-full"></span>
                  Bảng Quản Trị
                </Link>
              )}
            </div>
            <div className="flex flex-wrap justify-center md:justify-start items-center gap-4 text-gray-400 text-xs font-bold uppercase tracking-widest">
              <span>{user.email}</span>
              <span className="hidden md:inline">•</span>
              <span>{user.phone || 'Chưa cập nhật SĐT'}</span>
            </div>
            
            {/* VIP Card Section */}
            <div className="flex flex-wrap justify-center md:justify-start gap-4 mt-6">
               <div className={`relative overflow-hidden p-5 rounded-3xl border shadow-lg transition-all min-w-[280px] ${user.subscriptionTier === 'free' ? 'bg-gray-50 border-gray-200' : 'bg-gradient-to-br from-yellow-500 to-orange-600 border-yellow-400 text-white shadow-yellow-200'}`}>
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
                  
                  {/* Decorative background element */}
                  {user.subscriptionTier !== 'free' && (
                    <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
                  )}
               </div>
               
               <div className="bg-white border border-borderMain p-5 rounded-3xl shadow-soft min-w-[200px] flex flex-col justify-center gap-1">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Số dư ví</p>
                  <p className="text-2xl font-black text-primary">{formatPrice(user.walletBalance)}</p>
                  <Link to="/wallet" className="text-[10px] font-black text-primary/60 hover:text-primary mt-1 uppercase">Nạp thêm tiền →</Link>
               </div>
            </div>
          </div>
          
          <div className="flex flex-col gap-2 w-full md:w-auto self-start">
            <button onClick={handleLogout} className="text-red-500 font-black px-8 py-2 text-xs hover:bg-red-50 rounded-2xl transition-all uppercase tracking-widest">Đăng xuất tài khoản</button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2 p-1.5 bg-gray-200/50 rounded-3xl w-full max-w-xl mx-auto md:mx-0">
        {[
          { id: 'listings', label: 'Quản lý tin', icon: '📦' },
          { id: 'favorites', label: 'Tin đã lưu', icon: '❤️' },
          { id: 'settings', label: 'Cài đặt tài khoản', icon: '⚙️' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 flex items-center justify-center gap-3 py-3.5 rounded-2xl text-[11px] font-black transition-all uppercase tracking-tighter ${activeTab === tab.id ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <span className="text-lg">{tab.icon}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="mt-8">
        {activeTab === 'listings' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {myListings.length > 0 ? (
              myListings.map(listing => (
                // --- ĐÃ NÂNG CẤP PHẦN NÀY ĐỂ HIỂN THỊ NÚT QUẢN LÝ ---
                <div key={listing.id} className="flex flex-col gap-3 group">
                    <div className="relative">
                        <ListingCard listing={listing} />
                        {listing.status !== 'approved' && (
                            <div className="absolute top-2 right-2 bg-gray-800 text-white text-[9px] font-black px-2 py-1 rounded uppercase z-20">
                                {listing.status === 'pending' ? 'Đang duyệt' : 'Từ chối'}
                            </div>
                        )}
                    </div>
                    
                    {/* THANH CÔNG CỤ QUẢN LÝ */}
                    <div className="grid grid-cols-2 gap-2">
                        <button 
                            onClick={() => handlePushListing(listing.id, listing.title)}
                            disabled={isPushing !== null || listing.status !== 'approved'}
                            className="bg-green-50 text-green-600 hover:bg-green-500 hover:text-white py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1 disabled:opacity-50 disabled:grayscale"
                        >
                             {isPushing === listing.id ? (
                                <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                             ) : (
                                <>⚡ Đẩy tin</>
                             )}
                        </button>
                        <button 
                            onClick={() => handleDelete(listing.id)}
                            className="bg-red-50 text-red-500 hover:bg-red-500 hover:text-white py-2 rounded-xl text-[10px] font-black uppercase transition-all"
                        >
                            🗑 Xóa
                        </button>
                    </div>
                </div>
                // ----------------------------------------------------
              ))
            ) : (
              <div className="col-span-full py-32 text-center bg-white border border-borderMain rounded-[3rem] shadow-soft">
                <div className="text-6xl mb-4">📭</div>
                <p className="text-gray-400 font-bold">Bạn chưa đăng tin nào. <button onClick={() => navigate('/post')} className="text-primary hover:underline">Đăng ngay!</button></p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'favorites' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {myFavs.length > 0 ? (
              myFavs.map(listing => (
                <ListingCard key={listing.id} listing={listing} isFavorite={true} />
              ))
            ) : (
              <div className="col-span-full py-32 text-center bg-white border border-borderMain rounded-[3rem] shadow-soft">
                <div className="text-6xl mb-4">❤️</div>
                <p className="text-gray-400 font-bold">Bạn chưa lưu tin nào.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="bg-white border border-borderMain rounded-[3rem] p-6 md:p-12 shadow-soft">
            <form onSubmit={handleSaveSettings} className="space-y-12">
              <div className="grid lg:grid-cols-2 gap-12">
                {/* Account & Contact */}
                <div className="space-y-8">
                  <h3 className="text-xl font-black text-textMain flex items-center gap-3">
                    <span className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">👤</span>
                    Thông tin liên hệ
                  </h3>
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Tên hiển thị</label>
                      <input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full bg-bgMain border border-borderMain rounded-2xl p-4 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-bold text-sm" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Email (Dùng để đăng nhập)</label>
                      <input type="email" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} className="w-full bg-bgMain border border-borderMain rounded-2xl p-4 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-bold text-sm" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Số điện thoại liên hệ</label>
                      <input type="tel" placeholder="090..." value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} className="w-full bg-bgMain border border-borderMain rounded-2xl p-4 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-bold text-sm" />
                    </div>
                  </div>
                </div>

                {/* Seller Location & GPS */}
                <div className="space-y-8">
                  <h3 className="text-xl font-black text-textMain flex items-center gap-3">
                    <span className="w-10 h-10 bg-red-50 text-red-500 rounded-xl flex items-center justify-center">📍</span>
                    Vị trí bán hàng
                  </h3>
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Thành phố / Tỉnh</label>
                      <select value={editForm.location} onChange={e => setEditForm({...editForm, location: e.target.value})} className="w-full bg-bgMain border border-borderMain rounded-2xl p-4 font-bold text-sm appearance-none cursor-pointer">
                        {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="flex items-center justify-between px-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Ghim tọa độ (Giúp tin quanh đây chính xác hơn)</label>
                        <button type="button" onClick={pickCurrentLocation} className="text-[10px] font-black text-primary hover:text-primaryHover flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                          Lấy vị trí hiện tại
                        </button>
                      </div>
                      
                      <div className="relative aspect-video rounded-3xl overflow-hidden border-2 border-white shadow-lg group">
                         <div className="absolute inset-0 bg-primary/10 pointer-events-none"></div>
                         <div className="absolute inset-0 flex items-center justify-center">
                            <div className="relative animate-bounce">
                               <div className="w-12 h-12 bg-primary rounded-full border-4 border-white shadow-2xl flex items-center justify-center text-white text-xs font-black">Me</div>
                               <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-4 h-4 bg-primary rotate-45 border-r-4 border-b-4 border-white"></div>
                            </div>
                         </div>
                         <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur-md px-4 py-3 rounded-2xl flex items-center justify-between shadow-xl border border-white/20">
                            <div className="space-y-0.5">
                               <p className="text-[8px] font-black text-gray-400 uppercase">GPS COORDS</p>
                               <p className="text-xs font-bold text-textMain">{editForm.lat.toFixed(6)}, {editForm.lng.toFixed(6)}</p>
                            </div>
                         </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-10 border-t border-gray-100 flex flex-col md:flex-row items-center justify-between gap-6">
                <p className="text-xs text-gray-400 max-w-sm text-center md:text-left">
                  Thông tin này sẽ được hiển thị công khai để người mua có thể liên lạc và xem hàng tại khu vực của bạn.
                </p>
                <button type="submit" disabled={isSaving} className="w-full md:w-auto px-16 py-5 bg-primary text-white font-black rounded-2xl shadow-2xl shadow-primary/30 hover:bg-primaryHover hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3">
                  {isSaving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Lưu thay đổi hồ sơ'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;
