import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { db, SystemSettings } from '../services/db';
import { Listing, User } from '../types';
import { formatPrice, formatTimeAgo, getListingUrl } from '../utils/format';

// ⚠️ ĐÃ LOẠI BỎ LUCIDE-REACT ĐỂ TRÁNH LỖI CRASH
// --- BỘ ICON VẼ TAY (SVG THUẦN) ---
const IconPlus = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>;
const IconWallet = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12V8H6a2 2 0 0 1 0-4h14v4"/><path d="M4 6v12a2 2 0 0 0 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>;
const IconCheckCircle = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>;
const IconClock = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>;
const IconXCircle = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>;
const IconTrophy = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path></svg>;
const IconAlertOctagon = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>;
const IconMapPin = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>;
const IconCrown = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"></path></svg>;
const IconEye = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>;
const IconMessageCircle = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>;
const IconZap = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>;
const IconTrash2 = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>;
const IconPackageOpen = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="M8 8.5A6 6 0 0 1 12 3a6 6 0 0 1 4 5.5"></path></svg>;
const IconLoader2 = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>;
const IconAlertTriangle = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>;

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
  const [isFindingChat, setIsFindingChat] = useState<string | null>(null);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  
  const [modal, setModal] = useState<ModalState>({
    show: false, title: '', message: '', type: 'alert', onConfirm: () => {}
  });

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    const loadData = async () => {
      const [s, all] = await Promise.all([db.getSettings(), db.getListings(true)]);
      setSettings(s);
      setListings(all.filter(l => String(l.sellerId) === String(user.id)));
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

  const handleGoToChat = async (listingId: string) => {
    setIsFindingChat(listingId);
    try {
      const roomId = await db.findChatRoomByListing(listingId);
      if (roomId) {
        navigate(`/chat/${roomId}`);
      } else {
        alert("Hiện chưa có cuộc hội thoại nào cho tin đăng này.");
      }
    } catch (error) {
      console.error(error);
      alert("Lỗi khi tìm phòng chat.");
    } finally {
      setIsFindingChat(null);
    }
  };

  const filteredListings = listings.filter(l => {
    if (activeTab === 'active') return l.status === 'approved' || l.status === 'sold';
    if (activeTab === 'pending') return l.status === 'pending';
    return l.status === 'rejected';
  });

  if (!user || !settings) return (
    <div className="py-20 text-center flex justify-center">
      <IconLoader2 className="w-10 h-10 text-primary animate-spin" />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto pb-24 md:pb-10 px-4 relative font-sans">
      {/* Modal */}
      {modal.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setModal(prev => ({ ...prev, show: false }))}></div>
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl relative animate-fade-in-up border border-gray-100">
            <div className="flex items-center gap-3 mb-4">
                {modal.type === 'delete' ? <IconAlertTriangle className="w-6 h-6 text-red-500" /> : <IconZap className="w-6 h-6 text-primary" />}
                <h3 className="text-xl font-black text-gray-900">{modal.title}</h3>
            </div>
            <p className="text-gray-500 text-sm font-medium mb-8 leading-relaxed">{modal.message}</p>
            <div className="flex gap-3">
               <button onClick={() => setModal(prev => ({ ...prev, show: false }))} className="flex-1 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-widest bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors">Hủy</button>
               <button onClick={modal.onConfirm} className={`flex-1 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-widest text-white shadow-lg transition-transform active:scale-95 ${modal.type === 'delete' ? 'bg-red-500' : 'bg-primary'}`}>Xác nhận</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="sticky top-20 z-40 bg-white/90 backdrop-blur-md pt-4 pb-2">
        <div className="flex items-center justify-between mb-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Quản lý tin đăng</h1>
            <div className="flex items-center gap-2">
               <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                   <IconWallet className="w-3 h-3" /> Ví của bạn:
               </span>
               <span className="text-xs font-black text-primary bg-primary/5 px-2 py-1 rounded-lg border border-primary/10">{formatPrice(user.walletBalance)}</span>
            </div>
          </div>
          <Link to="/post" className="w-12 h-12 bg-primary text-white rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 hover:scale-105 transition-transform active:scale-95">
            <IconPlus className="w-6 h-6" />
          </Link>
        </div>

        <div className="bg-gray-100 p-1 rounded-2xl flex gap-1 mb-4">
          {[
            { id: 'active', label: 'Đang đăng', icon: <IconCheckCircle className="w-3.5 h-3.5" /> },
            { id: 'pending', label: 'Chờ duyệt', icon: <IconClock className="w-3.5 h-3.5" /> },
            { id: 'expired', label: 'Từ chối', icon: <IconXCircle className="w-3.5 h-3.5" /> }
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === tab.id ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              <span className="hidden sm:inline">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Danh sách tin đăng */}
      <div className="mt-2 space-y-4">
        {filteredListings.length > 0 ? filteredListings.map(listing => (
          <div key={listing.id} className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm flex flex-col group relative hover:border-primary/30 transition-all duration-300">
            
            {/* Nhãn Đấu giá thành công */}
            {listing.status === 'sold' && (
              <div className="absolute top-3 right-3 z-30 pointer-events-none">
                <div className="bg-blue-600 text-white px-3 py-1.5 rounded-xl font-black text-[8px] uppercase tracking-widest shadow-xl flex items-center gap-1 border-2 border-white">
                  <IconTrophy className="w-3 h-3" /> Thành công
                </div>
              </div>
            )}

            {/* Nhãn Tin bị từ chối */}
            {listing.status === 'rejected' && (
              <div className="absolute top-3 right-3 z-30 pointer-events-none">
                <div className="bg-red-500 text-white px-3 py-1.5 rounded-xl font-black text-[8px] uppercase tracking-widest shadow-xl flex items-center gap-1 border-2 border-white">
                  <IconAlertOctagon className="w-3 h-3" /> Từ chối
                </div>
              </div>
            )}

            <div className="flex p-4 gap-4">
              <div className="w-24 h-24 rounded-2xl overflow-hidden flex-shrink-0 bg-gray-50 border border-gray-100 relative">
                <img src={listing.images[0]} className={`w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ${listing.status === 'sold' ? 'opacity-60 grayscale-[40%]' : ''}`} alt={listing.title} />
                {listing.tier !== 'free' && (
                  <div className="absolute top-1 left-1 bg-yellow-400 text-white text-[7px] font-black px-1.5 py-0.5 rounded shadow-sm uppercase flex items-center gap-0.5">
                      <IconCrown className="w-2 h-2 fill-current" /> VIP
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-black text-gray-900 truncate leading-tight mb-1 group-hover:text-primary transition-colors">{listing.title}</h3>
                  <div className="flex items-center gap-2">
                    <p className="text-primary font-black text-base">{formatPrice(listing.price)}</p>
                    {listing.status === 'sold' && (
                      <span className="text-[9px] font-black text-blue-500 bg-blue-50 px-2 py-0.5 rounded-md uppercase tracking-tighter">Giá chốt</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[9px] text-gray-400 font-bold uppercase tracking-tight">
                  <span className="flex items-center gap-1"><IconMapPin className="w-3 h-3" /> {listing.location}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1"><IconClock className="w-3 h-3" /> {formatTimeAgo(listing.createdAt)}</span>
                </div>
              </div>
            </div>
            
            {/* Thanh điều hướng và nút chức năng */}
            <div className="grid grid-cols-3 border-t border-gray-50 bg-gray-50/30 relative z-40">
              <Link to={getListingUrl(listing)} className="py-4 text-[10px] font-black text-center uppercase text-gray-500 hover:bg-white hover:text-primary transition-all border-r border-gray-50 flex items-center justify-center gap-1">
                  <IconEye className="w-3.5 h-3.5" /> Xem tin
              </Link>
              
              {listing.status === 'sold' ? (
                 <button 
                  onClick={() => handleGoToChat(listing.id)}
                  disabled={isFindingChat === listing.id}
                  className="py-4 text-[10px] font-black text-center uppercase text-green-600 hover:bg-green-50 flex items-center justify-center gap-2 border-r border-gray-50 transition-all active:scale-95"
                 >
                   {isFindingChat === listing.id ? (
                     <IconLoader2 className="w-3.5 h-3.5 animate-spin" />
                   ) : (
                     <> <IconMessageCircle className="w-3.5 h-3.5" /> Nhắn tin</>
                   )}
                 </button>
              ) : (
                <button 
                  onClick={() => handlePushListing(listing.id, listing.title)} 
                  disabled={isPushing !== null || listing.status !== 'approved'} 
                  className={`py-4 text-[10px] font-black text-center uppercase flex items-center justify-center gap-2 border-r border-gray-50 transition-all ${isPushing === listing.id ? 'text-primary' : 'text-primary hover:bg-white active:scale-95 disabled:opacity-30 disabled:grayscale'}`}
                >
                  {isPushing === listing.id ? (
                    <IconLoader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <> <IconZap className="w-3.5 h-3.5 fill-current" /> Đẩy tin</>
                  )}
                </button>
              )}

              <button onClick={() => handleDelete(listing.id)} className="py-4 text-[10px] font-black text-center uppercase text-red-400 hover:bg-red-50 hover:text-red-500 transition-all active:scale-95 flex items-center justify-center gap-1">
                  <IconTrash2 className="w-3.5 h-3.5" /> Xóa tin
              </button>
            </div>
          </div>
        )) : (
          <div className="py-32 text-center bg-white border border-gray-200 border-dashed rounded-[3rem] space-y-4 flex flex-col items-center">
              <IconPackageOpen className="w-16 h-16 text-gray-200" />
              <p className="text-gray-400 font-black uppercase text-[10px] tracking-widest">Không có tin đăng nào</p>
              <Link to="/post" className="flex items-center gap-2 mt-4 text-[10px] font-black text-primary border-2 border-primary/20 px-6 py-3 rounded-xl hover:bg-primary hover:text-white transition-all uppercase tracking-widest">
                  <IconPlus className="w-3 h-3" /> Đăng tin ngay
              </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageAds;
