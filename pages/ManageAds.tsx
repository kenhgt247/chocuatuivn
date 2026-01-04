
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { db, SystemSettings } from '../services/db';
import { Listing, User } from '../types';
import { formatPrice, formatTimeAgo, getListingUrl } from '../utils/format';

interface ManageAdsProps {
  user: User | null;
  onUpdateUser: (u: User) => void;
}

interface ModalState {
  show: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  type: 'push' | 'delete' | 'alert';
}

const ManageAds: React.FC<ManageAdsProps> = ({ user, onUpdateUser }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'active' | 'pending' | 'expired'>('active');
  const [listings, setListings] = useState<Listing[]>([]);
  const [isPushing, setIsPushing] = useState<string | null>(null);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  
  // Custom Modal State
  const [modal, setModal] = useState<ModalState>({
    show: false, title: '', message: '', type: 'alert', onConfirm: () => {}
  });

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    const loadData = async () => {
      const [s, all] = await Promise.all([db.getSettings(), db.getListings(true)]);
      setSettings(s);
      setListings(all.filter(l => l.sellerId === user.id));
    };
    loadData();
  }, [user, navigate]);

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
            const all = await db.getListings(true);
            setListings(all.filter(l => l.sellerId === user.id));
            const updatedUser = await db.getCurrentUser();
            if (updatedUser) onUpdateUser(updatedUser);
          }
        } catch (err) {
          console.error("Push error:", err);
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
        await db.deleteListing(id);
        setListings(prev => prev.filter(l => l.id !== id));
      }
    });
  };

  const filteredListings = listings.filter(l => {
    if (activeTab === 'active') return l.status === 'approved';
    if (activeTab === 'pending') return l.status === 'pending';
    return l.status === 'rejected';
  });

  if (!user || !settings) return (
    <div className="py-20 text-center">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
    </div>
  );

  const currentPushPrice = settings.pushPrice * (1 - (settings.pushDiscount || 0) / 100);

  return (
    <div className="max-w-2xl mx-auto pb-24 md:pb-10 px-4 relative">
      {/* Custom Modal Overlay */}
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

      <div className="sticky top-20 z-40 bg-bgMain/90 backdrop-blur-md pt-4 pb-2">
        <div className="flex items-center justify-between mb-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-black text-textMain tracking-tight">Quản lý tin đăng</h1>
            <div className="flex items-center gap-2">
               <span className="text-[10px] font-black text-gray-400 uppercase">Số dư ví:</span>
               <span className="text-xs font-black text-primary bg-primary/5 px-2 py-1 rounded-lg border border-primary/10">
                 {formatPrice(user.walletBalance)}
               </span>
            </div>
          </div>
          <Link to="/post" className="w-12 h-12 bg-primary text-white rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 hover:scale-105 transition-transform active:scale-95">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4"/></svg>
          </Link>
        </div>

        {user.subscriptionTier === 'free' && (
          <div className="mb-6 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-200 rounded-[1.5rem] p-4 flex items-center justify-between gap-4 animate-fade-in-up shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center text-xl shadow-inner">🚀</div>
              <div className="min-w-0">
                <p className="text-xs font-black text-yellow-800 uppercase tracking-tighter">Ưu tiên hiển thị gấp 5 lần</p>
                <p className="text-[10px] text-yellow-700/70 font-bold truncate">Gói VIP giúp tin luôn ở vị trí "Vàng".</p>
              </div>
            </div>
            <Link to="/upgrade" className="bg-yellow-500 text-white text-[9px] font-black px-4 py-2.5 rounded-xl uppercase tracking-widest flex-shrink-0 shadow-lg shadow-yellow-200 hover:bg-yellow-600 transition-colors">Nâng cấp</Link>
          </div>
        )}

        <div className="bg-gray-200/50 p-1 rounded-2xl flex gap-1 mb-4">
          {[
            { id: 'active', label: 'Đang đăng', icon: '✅' },
            { id: 'pending', label: 'Chờ duyệt', icon: '🕒' },
            { id: 'expired', label: 'Từ chối', icon: '❌' }
          ].map(tab => (
            <button 
              key={tab.id} 
              onClick={() => setActiveTab(tab.id as any)} 
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === tab.id ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <span className="hidden sm:inline">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2 space-y-4">
        {filteredListings.length > 0 ? filteredListings.map(listing => (
          <div key={listing.id} className="bg-white border border-borderMain rounded-3xl overflow-hidden shadow-soft flex flex-col group hover:border-primary/30 transition-all duration-300">
            <div className="flex p-4 gap-4">
              <div className="w-24 h-24 rounded-2xl overflow-hidden flex-shrink-0 bg-gray-50 border border-gray-100 relative">
                <img src={listing.images[0]} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={listing.title} />
                {listing.tier !== 'free' && (
                  <div className="absolute top-1 left-1 bg-yellow-400 text-white text-[7px] font-black px-1.5 py-0.5 rounded shadow-sm uppercase">VIP</div>
                )}
              </div>
              <div className="flex-1 min-w-0 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-black text-textMain truncate leading-tight mb-1 group-hover:text-primary transition-colors">{listing.title}</h3>
                  <p className="text-primary font-black text-base">{formatPrice(listing.price)}</p>
                </div>
                <div className="flex items-center gap-2 text-[9px] text-gray-400 font-bold uppercase tracking-tight">
                  <span className="flex items-center gap-1">📍 {listing.location}</span>
                  <span>•</span>
                  <span>🕒 {formatTimeAgo(listing.createdAt)}</span>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-3 border-t border-gray-50 bg-gray-50/30">
              <Link to={getListingUrl(listing)} className="py-4 text-[10px] font-black text-center uppercase text-gray-500 hover:bg-white hover:text-primary transition-all border-r border-gray-50">Xem tin</Link>
              
              <button 
                onClick={() => handlePushListing(listing.id, listing.title)} 
                disabled={isPushing !== null || listing.status !== 'approved'} 
                className={`py-4 text-[10px] font-black text-center uppercase flex items-center justify-center gap-2 border-r border-gray-50 transition-all ${isPushing === listing.id ? 'text-primary' : 'text-primary hover:bg-white active:scale-95 disabled:opacity-30 disabled:grayscale'}`}
              >
                {isPushing === listing.id ? (
                  <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>⚡ Đẩy tin ({formatPrice(currentPushPrice)})</>
                )}
              </button>

              <button 
                onClick={() => handleDelete(listing.id)} 
                className="py-4 text-[10px] font-black text-center uppercase text-red-400 hover:bg-red-50 hover:text-red-500 transition-all active:scale-95"
              >
                Xóa tin
              </button>
            </div>
          </div>
        )) : (
          <div className="py-32 text-center bg-white border border-borderMain border-dashed rounded-[3rem] space-y-4">
             <div className="text-5xl opacity-20">📭</div>
             <div className="space-y-1">
                <p className="text-gray-400 font-black uppercase text-[10px] tracking-widest">Không có tin đăng nào</p>
                <p className="text-[10px] text-gray-300 font-bold">Hãy bắt đầu bằng cách đăng tin đầu tiên của bạn!</p>
             </div>
             <Link to="/post" className="inline-block mt-4 text-[10px] font-black text-primary border-2 border-primary/20 px-6 py-2.5 rounded-xl hover:bg-primary hover:text-white transition-all uppercase tracking-widest">Đăng tin ngay</Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageAds;
