
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { db, SystemSettings } from '../services/db';
import { User, Listing, Transaction, Report } from '../types';
import { formatPrice, formatTimeAgo, getListingUrl } from '../utils/format';

type AdminTab = 'stats' | 'listings' | 'reports' | 'users' | 'payments' | 'settings';

interface ConfirmState {
  show: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  type: 'success' | 'danger' | 'warning';
}

interface ToastState {
  show: boolean;
  message: string;
  type: 'success' | 'error';
}

const Admin: React.FC<{ user: User | null }> = ({ user }) => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>('stats');
  const [users, setUsers] = useState<User[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Custom Modal & Toast states
  const [confirmModal, setConfirmModal] = useState<ConfirmState>({
    show: false, title: '', message: '', type: 'warning', onConfirm: () => {}
  });
  const [toast, setToast] = useState<ToastState>({ show: false, message: '', type: 'success' });

  useEffect(() => {
    if (!user || user.role !== 'admin') { navigate('/'); return; }
    loadData();
  }, [user]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [allUsers, allListings, allReports, allTxs, allSettings] = await Promise.all([
        db.getAllUsers(),
        db.getListings(true),
        db.getAllReports(),
        db.getTransactions(),
        db.getSettings()
      ]);
      setUsers(allUsers);
      setListings(allListings);
      setReports(allReports);
      setTransactions(allTxs);
      setSettings(allSettings);
    } catch (err) {
      showToast("Lỗi khi nạp dữ liệu hệ thống", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const pendingPayments = useMemo(() => transactions.filter(t => t.status === 'pending'), [transactions]);
  const pendingListings = useMemo(() => listings.filter(l => l.status === 'pending'), [listings]);
  const activeReports = useMemo(() => reports.filter(r => r.status === 'pending'), [reports]);

  const handleApprovePayment = (txId: string) => {
    setConfirmModal({
      show: true,
      title: "Xác nhận duyệt tiền",
      message: "Bạn đã chắc chắn nhận được tiền? Số dư hoặc Gói của người dùng sẽ được cập nhật ngay lập tức.",
      type: 'success',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, show: false }));
        setIsLoading(true);
        const result = await db.approveTransaction(txId);
        if (result.success) {
          showToast("✅ Duyệt giao dịch thành công!");
          await loadData();
        } else {
          showToast("❌ Lỗi: " + result.message, "error");
          setIsLoading(false);
        }
      }
    });
  };

  const handleRejectPayment = (txId: string) => {
    setConfirmModal({
      show: true,
      title: "Từ chối giao dịch",
      message: "Bạn muốn hủy yêu cầu nạp tiền này?",
      type: 'danger',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, show: false }));
        setIsLoading(true);
        const result = await db.rejectTransaction(txId);
        if (result.success) {
          showToast("Đã từ chối giao dịch.");
          await loadData();
        } else {
          showToast("❌ Lỗi: " + result.message, "error");
          setIsLoading(false);
        }
      }
    });
  };

  const handleApproveListing = async (lId: string) => {
    setIsLoading(true);
    await db.updateListingStatus(lId, 'approved');
    showToast("Đã duyệt tin đăng");
    await loadData();
  };

  const handleRejectListing = async (lId: string) => {
    setConfirmModal({
      show: true,
      title: "Từ chối tin đăng",
      message: "Tin này sẽ không được hiển thị trên hệ thống.",
      type: 'danger',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, show: false }));
        setIsLoading(true);
        await db.updateListingStatus(lId, 'rejected');
        showToast("Đã từ chối tin.");
        await loadData();
      }
    });
  };

  const toggleUserRole = async (u: User) => {
    const newRole = u.role === 'admin' ? 'user' : 'admin';
    setConfirmModal({
      show: true,
      title: "Đổi vai trò",
      message: `Đổi vai trò người dùng sang ${newRole}?`,
      type: 'warning',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, show: false }));
        setIsLoading(true);
        await db.updateUserProfile(u.id, { role: newRole });
        showToast("Cập nhật vai trò thành công");
        await loadData();
      }
    });
  };

  const toggleUserStatus = async (u: User) => {
    const newStatus = u.status === 'active' ? 'banned' : 'active';
    setConfirmModal({
      show: true,
      title: newStatus === 'banned' ? "Khóa tài khoản" : "Mở khóa",
      message: `${newStatus === 'banned' ? 'Khóa' : 'Mở khóa'} người dùng này?`,
      type: newStatus === 'banned' ? 'danger' : 'success',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, show: false }));
        setIsLoading(true);
        await db.updateUserProfile(u.id, { status: newStatus });
        showToast("Cập nhật trạng thái thành công");
        await loadData();
      }
    });
  };

  const handleQRUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !settings) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      setSettings({ ...settings, beneficiaryQR: base64 });
    };
    reader.readAsDataURL(file);
  };

  if (!user || user.role !== 'admin' || !settings) return null;

  return (
    <div className="flex flex-col lg:flex-row gap-8 pb-24 relative">
      {/* Toast Notification Overlay */}
      {toast.show && (
        <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-[110] px-6 py-3 rounded-2xl shadow-2xl font-black text-xs uppercase tracking-widest animate-fade-in-up flex items-center gap-3 ${toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
           <span>{toast.type === 'success' ? '✅' : '❌'}</span>
           {toast.message}
        </div>
      )}

      {/* Confirmation Modal Overlay */}
      {confirmModal.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))}></div>
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl relative animate-fade-in-up border border-borderMain">
            <h3 className="text-xl font-black text-textMain mb-2">{confirmModal.title}</h3>
            <p className="text-gray-500 text-sm font-medium mb-8 leading-relaxed">{confirmModal.message}</p>
            <div className="flex gap-3">
               <button 
                onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))}
                className="flex-1 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-widest bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
               >
                 Hủy
               </button>
               <button 
                onClick={confirmModal.onConfirm}
                className={`flex-1 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-widest text-white shadow-lg transition-transform active:scale-95 ${confirmModal.type === 'danger' ? 'bg-red-500 shadow-red-100' : confirmModal.type === 'success' ? 'bg-green-500 shadow-green-100' : 'bg-primary shadow-primary/20'}`}
               >
                 Xác nhận
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar Navigation */}
      <aside className="lg:w-72 flex-shrink-0">
        <div className="bg-white border border-borderMain rounded-[2.5rem] p-5 shadow-soft sticky top-24 space-y-6">
          <div className="px-4 py-2">
            <h2 className="text-xl font-black text-primary">Admin Console</h2>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Hệ thống quản trị Chợ</p>
          </div>
          <nav className="space-y-1">
            {[
              { id: 'stats', label: 'Bàn làm việc', icon: '📊' },
              { id: 'payments', label: 'Duyệt tiền', icon: '💰', count: pendingPayments.length },
              { id: 'listings', label: 'Duyệt tin', icon: '📦', count: pendingListings.length },
              { id: 'reports', label: 'Báo cáo', icon: '🚨', count: activeReports.length },
              { id: 'users', label: 'Thành viên', icon: '👥' },
              { id: 'settings', label: 'Cấu hình', icon: '⚙️' },
            ].map(tab => (
              <button 
                key={tab.id} 
                onClick={() => setActiveTab(tab.id as any)} 
                className={`w-full flex items-center justify-between px-5 py-3.5 rounded-2xl text-[11px] font-black transition-all ${activeTab === tab.id ? 'bg-primary text-white shadow-lg shadow-primary/25' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                <div className="flex items-center gap-4">
                  <span className="text-lg">{tab.icon}</span> 
                  <span className="uppercase tracking-tighter">{tab.label}</span>
                </div>
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="bg-red-500 text-white px-2.5 py-1 rounded-full text-[9px] font-black animate-pulse">{tab.count}</span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* Content Main Area */}
      <div className="flex-1 space-y-8 min-w-0">
        {isLoading && <div className="fixed top-24 right-10 z-[60] bg-primary text-white text-[10px] font-black px-4 py-2 rounded-full animate-bounce shadow-xl uppercase">Đang xử lý...</div>}

        {activeTab === 'stats' && (
          <div className="space-y-8">
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Doanh thu', value: formatPrice(transactions.filter(t => t.status === 'success' && t.type === 'payment').reduce((s, t) => s + t.amount, 0)), color: 'text-primary' },
                  { label: 'Chờ nhận tiền', value: formatPrice(pendingPayments.reduce((s, t) => s + t.amount, 0)), color: 'text-yellow-600' },
                  { label: 'Tổng tin đăng', value: listings.length, color: 'text-green-600' },
                  { label: 'Tổng thành viên', value: users.length, color: 'text-textMain' }
                ].map((s, i) => (
                  <div key={i} className="bg-white p-6 rounded-3xl border border-borderMain shadow-soft text-center space-y-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{s.label}</p>
                    <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                  </div>
                ))}
             </div>
             
             <div className="bg-white border border-borderMain rounded-[2.5rem] p-8 shadow-soft">
                <h3 className="text-xl font-black mb-6">Giao dịch gần đây</h3>
                <div className="overflow-x-auto">
                   <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                           <th className="pb-4">Mô tả</th>
                           <th className="pb-4">Số tiền</th>
                           <th className="pb-4">Thời gian</th>
                           <th className="pb-4">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {transactions.slice(0, 10).map(tx => (
                          <tr key={tx.id}>
                             <td className="py-4 font-bold text-xs">{tx.description}</td>
                             <td className="py-4 font-black">{formatPrice(tx.amount)}</td>
                             <td className="py-4 text-gray-400 text-[10px]">{new Date(tx.createdAt).toLocaleString()}</td>
                             <td className="py-4">
                                <span className={`text-[9px] px-2 py-1 rounded font-black uppercase ${tx.status === 'success' ? 'bg-green-100 text-green-600' : tx.status === 'pending' ? 'bg-yellow-100 text-yellow-600' : 'bg-red-100 text-red-600'}`}>
                                   {tx.status}
                                </span>
                             </td>
                          </tr>
                        ))}
                      </tbody>
                   </table>
                </div>
             </div>
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="bg-white border border-borderMain rounded-[2.5rem] p-8 shadow-soft">
            <h3 className="text-xl font-black mb-8">Xác nhận nạp tiền/Gói ({pendingPayments.length})</h3>
            <div className="space-y-4">
              {pendingPayments.length > 0 ? pendingPayments.map(tx => {
                const txUser = users.find(u => u.id === tx.userId);
                return (
                  <div key={tx.id} className="group border-2 border-gray-100 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 hover:border-primary transition-all">
                    <div className="flex items-center gap-5 flex-1 min-w-0">
                      <div className="w-14 h-14 bg-bgMain rounded-2xl flex items-center justify-center text-3xl shadow-inner">
                        {tx.type === 'deposit' ? '💰' : '💎'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-3">
                           <p className="text-sm font-black text-textMain truncate">{tx.description}</p>
                           <span className="bg-primary/10 text-primary text-[10px] font-black px-2 py-0.5 rounded uppercase">{tx.type}</span>
                        </div>
                        <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-tight">Người dùng: {txUser?.name || 'Unknown'} ({tx.userId.slice(-6).toUpperCase()})</p>
                        <p className="text-[9px] text-primary font-black mt-1 uppercase">SỐ TIỀN: {formatPrice(tx.amount)}</p>
                      </div>
                    </div>
                    <div className="flex gap-3 w-full md:w-auto">
                      <button onClick={() => handleApprovePayment(tx.id)} disabled={isLoading} className="flex-1 md:flex-none bg-green-500 text-white px-8 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-green-600 shadow-lg shadow-green-100 transition-all active:scale-95">Duyệt</button>
                      <button onClick={() => handleRejectPayment(tx.id)} disabled={isLoading} className="flex-1 md:flex-none bg-red-50 text-red-500 px-8 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-red-100 transition-all">Từ chối</button>
                    </div>
                  </div>
                );
              }) : (
                <div className="text-center py-20 text-gray-400 font-bold bg-bgMain rounded-3xl uppercase text-[10px] tracking-widest">Hiện chưa có giao dịch nào đang chờ.</div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'listings' && (
          <div className="bg-white border border-borderMain rounded-[2.5rem] p-8 shadow-soft">
            <h3 className="text-xl font-black mb-8">Tin đăng chờ duyệt ({pendingListings.length})</h3>
            <div className="space-y-4">
              {pendingListings.length > 0 ? pendingListings.map(l => (
                <div key={l.id} className="border-2 border-gray-100 rounded-3xl p-5 flex flex-col md:flex-row items-center gap-6 hover:border-primary transition-all">
                  <img src={l.images[0]} className="w-24 h-24 object-cover rounded-2xl shadow-sm" />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-black text-textMain leading-tight">{l.title}</h4>
                    <p className="text-primary font-black text-xs mt-1">{formatPrice(l.price)}</p>
                    <div className="flex items-center gap-4 mt-2">
                       <span className="text-[10px] text-gray-400 font-bold uppercase">{l.location}</span>
                       <span className="text-[10px] text-gray-400 font-bold uppercase">• {formatTimeAgo(l.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 w-full md:w-auto">
                    <Link to={getListingUrl(l)} target="_blank" className="bg-gray-100 text-gray-500 px-4 py-3 rounded-xl text-[10px] font-black uppercase">Xem tin</Link>
                    <button onClick={() => handleApproveListing(l.id)} disabled={isLoading} className="bg-primary text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-primary/20">Duyệt</button>
                    <button onClick={() => handleRejectListing(l.id)} disabled={isLoading} className="bg-red-500 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase">Hủy</button>
                  </div>
                </div>
              )) : (
                <div className="text-center py-20 text-gray-400 font-bold bg-bgMain rounded-3xl uppercase text-[10px] tracking-widest">Tất cả tin đã được duyệt.</div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="bg-white border border-borderMain rounded-[2.5rem] p-8 shadow-soft">
            <h3 className="text-xl font-black mb-8">Quản lý thành viên ({users.length})</h3>
            <div className="overflow-x-auto">
               <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                       <th className="pb-4">Người dùng</th>
                       <th className="pb-4">Ví</th>
                       <th className="pb-4">Gói</th>
                       <th className="pb-4">Vai trò</th>
                       <th className="pb-4">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {users.map(u => (
                      <tr key={u.id} className={u.status === 'banned' ? 'opacity-50 grayscale' : ''}>
                         <td className="py-4">
                            <div className="flex items-center gap-3">
                               <img src={u.avatar} className="w-10 h-10 rounded-xl" />
                               <div>
                                  <p className="text-xs font-black">{u.name}</p>
                                  <p className="text-[9px] text-gray-400">{u.email}</p>
                               </div>
                            </div>
                         </td>
                         <td className="py-4 text-xs font-black">{formatPrice(u.walletBalance || 0)}</td>
                         <td className="py-4"><span className="text-[10px] font-black text-primary uppercase">{u.subscriptionTier}</span></td>
                         <td className="py-4">
                           <button onClick={() => toggleUserRole(u)} className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-xl border ${u.role === 'admin' ? 'border-red-500 text-red-500' : 'border-gray-200 text-gray-500'}`}>
                             {u.role}
                           </button>
                         </td>
                         <td className="py-4">
                           <button onClick={() => toggleUserStatus(u)} className={`text-[10px] font-black uppercase px-4 py-2 rounded-xl transition-all ${u.status === 'active' ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'}`}>
                             {u.status === 'active' ? 'Khóa' : 'Mở khóa'}
                           </button>
                         </td>
                      </tr>
                    ))}
                  </tbody>
               </table>
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="bg-white border border-borderMain rounded-[2.5rem] p-8 shadow-soft">
             <h3 className="text-xl font-black mb-8">Báo cáo vi phạm ({activeReports.length})</h3>
             <div className="space-y-4">
                {activeReports.map(r => (
                  <div key={r.id} className="border-2 border-red-50 bg-red-50/10 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                     <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3">
                           <span className="bg-red-500 text-white text-[9px] font-black px-2 py-1 rounded uppercase">VI PHẠM</span>
                           <h4 className="text-sm font-black text-textMain leading-tight">{r.reason}</h4>
                        </div>
                        <p className="text-xs text-gray-600">{r.details || 'Không có mô tả chi tiết'}</p>
                        <p className="text-[10px] text-gray-400 font-bold uppercase">Tin đăng: {r.listingId} • Gửi lúc: {new Date(r.createdAt).toLocaleString()}</p>
                     </div>
                     <div className="flex gap-2">
                        <button onClick={() => db.resolveReport(r.id).then(() => { showToast("Báo cáo đã được xử lý"); loadData(); })} className="bg-green-500 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase">Đã xử lý</button>
                        <button onClick={() => db.deleteListing(r.listingId).then(() => db.resolveReport(r.id)).then(() => { showToast("Đã xóa tin vi phạm"); loadData(); })} className="bg-red-500 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase">Xóa tin vi phạm</button>
                     </div>
                  </div>
                ))}
                {activeReports.length === 0 && <div className="text-center py-20 text-gray-400 font-bold bg-bgMain rounded-3xl uppercase text-[10px] tracking-widest">Chưa có báo cáo nào.</div>}
             </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="bg-white border border-borderMain rounded-[2.5rem] p-8 shadow-soft">
             <form onSubmit={async (e) => { e.preventDefault(); setIsLoading(true); await db.updateSettings(settings); setIsLoading(false); showToast("Đã cập nhật hệ thống thành công!"); }} className="space-y-12">
                
                {/* 1. General Fees */}
                <div className="space-y-6">
                   <h4 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
                      <span className="w-2 h-2 bg-primary rounded-full"></span>
                      Phí & Ưu đãi
                   </h4>
                   <div className="grid md:grid-cols-2 gap-8">
                      <div className="space-y-3">
                         <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-1">Giá đẩy tin (VNĐ)</label>
                         <input type="number" value={settings.pushPrice} onChange={e => setSettings({...settings, pushPrice: parseInt(e.target.value)})} className="w-full bg-bgMain border border-borderMain rounded-2xl p-4 font-bold focus:ring-4 focus:ring-primary/10 transition-all" />
                      </div>
                      <div className="space-y-3">
                         <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-1">Chiết khấu chung (%)</label>
                         <input type="number" value={settings.tierDiscount} onChange={e => setSettings({...settings, tierDiscount: parseInt(e.target.value)})} className="w-full bg-bgMain border border-borderMain rounded-2xl p-4 font-bold focus:ring-4 focus:ring-primary/10 transition-all" />
                      </div>
                   </div>
                </div>

                {/* 2. VIP Tier Configuration */}
                <div className="space-y-6 pt-6 border-t border-gray-100">
                   <h4 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
                      <span className="w-2 h-2 bg-primary rounded-full"></span>
                      Cấu hình các Gói VIP
                   </h4>
                   
                   <div className="space-y-8">
                      {/* Basic Tier */}
                      <div className="bg-gray-50/50 p-6 rounded-3xl border border-gray-100 space-y-6">
                        <h5 className="font-black text-blue-600 uppercase text-xs">Gói Basic (VIP Bạc)</h5>
                        <div className="grid md:grid-cols-2 gap-6">
                           <div className="space-y-2">
                              <label className="text-[10px] font-black text-gray-400 uppercase">Giá gói (VNĐ)</label>
                              <input type="number" value={settings.tierConfigs.basic.price} onChange={e => setSettings({...settings, tierConfigs: {...settings.tierConfigs, basic: {...settings.tierConfigs.basic, price: parseInt(e.target.value)}}})} className="w-full bg-white border border-borderMain rounded-xl p-3 text-sm font-bold" />
                           </div>
                           <div className="space-y-2">
                              <label className="text-[10px] font-black text-gray-400 uppercase">Số ảnh tối đa</label>
                              <input type="number" value={settings.tierConfigs.basic.maxImages} onChange={e => setSettings({...settings, tierConfigs: {...settings.tierConfigs, basic: {...settings.tierConfigs.basic, maxImages: parseInt(e.target.value)}}})} className="w-full bg-white border border-borderMain rounded-xl p-3 text-sm font-bold" />
                           </div>
                           <div className="md:col-span-2 space-y-2">
                              <label className="text-[10px] font-black text-gray-400 uppercase">Tính năng (mỗi dòng 1 tính năng)</label>
                              <textarea rows={4} value={settings.tierConfigs.basic.features.join('\n')} onChange={e => setSettings({...settings, tierConfigs: {...settings.tierConfigs, basic: {...settings.tierConfigs.basic, features: e.target.value.split('\n').filter(f => f.trim() !== '')}}})} className="w-full bg-white border border-borderMain rounded-xl p-3 text-sm" />
                           </div>
                        </div>
                      </div>

                      {/* Pro Tier */}
                      <div className="bg-yellow-50/30 p-6 rounded-3xl border border-yellow-100 space-y-6">
                        <h5 className="font-black text-yellow-600 uppercase text-xs">Gói Pro VIP (Vàng)</h5>
                        <div className="grid md:grid-cols-2 gap-6">
                           <div className="space-y-2">
                              <label className="text-[10px] font-black text-gray-400 uppercase">Giá gói (VNĐ)</label>
                              <input type="number" value={settings.tierConfigs.pro.price} onChange={e => setSettings({...settings, tierConfigs: {...settings.tierConfigs, pro: {...settings.tierConfigs.pro, price: parseInt(e.target.value)}}})} className="w-full bg-white border border-borderMain rounded-xl p-3 text-sm font-bold" />
                           </div>
                           <div className="space-y-2">
                              <label className="text-[10px] font-black text-gray-400 uppercase">Số ảnh tối đa</label>
                              <input type="number" value={settings.tierConfigs.pro.maxImages} onChange={e => setSettings({...settings, tierConfigs: {...settings.tierConfigs, pro: {...settings.tierConfigs.pro, maxImages: parseInt(e.target.value)}}})} className="w-full bg-white border border-borderMain rounded-xl p-3 text-sm font-bold" />
                           </div>
                           <div className="md:col-span-2 space-y-2">
                              <label className="text-[10px] font-black text-gray-400 uppercase">Tính năng (mỗi dòng 1 tính năng)</label>
                              <textarea rows={4} value={settings.tierConfigs.pro.features.join('\n')} onChange={e => setSettings({...settings, tierConfigs: {...settings.tierConfigs, pro: {...settings.tierConfigs.pro, features: e.target.value.split('\n').filter(f => f.trim() !== '')}}})} className="w-full bg-white border border-borderMain rounded-xl p-3 text-sm" />
                           </div>
                        </div>
                      </div>
                   </div>
                </div>

                {/* 3. Beneficiary Account Info */}
                <div className="space-y-6 pt-6 border-t border-gray-100">
                   <h4 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
                      <span className="w-2 h-2 bg-primary rounded-full"></span>
                      Tài khoản thụ hưởng (Nạp tiền)
                   </h4>
                   <div className="grid md:grid-cols-2 gap-10">
                      <div className="space-y-6">
                         <div className="space-y-3">
                            <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-1">Tên Ngân hàng / Ứng dụng</label>
                            <input type="text" placeholder="Ví dụ: Vietcombank, MB Bank, MoMo..." value={settings.bankName} onChange={e => setSettings({...settings, bankName: e.target.value})} className="w-full bg-bgMain border border-borderMain rounded-2xl p-4 font-bold" />
                         </div>
                         <div className="space-y-3">
                            <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-1">Số tài khoản</label>
                            <input type="text" value={settings.accountNumber} onChange={e => setSettings({...settings, accountNumber: e.target.value})} className="w-full bg-bgMain border border-borderMain rounded-2xl p-4 font-bold" />
                         </div>
                         <div className="space-y-3">
                            <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-1">Tên chủ tài khoản</label>
                            <input type="text" value={settings.accountName} onChange={e => setSettings({...settings, accountName: e.target.value})} className="w-full bg-bgMain border border-borderMain rounded-2xl p-4 font-bold" />
                         </div>
                      </div>

                      <div className="space-y-4">
                         <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-1">Mã QR thụ hưởng (VietQR)</label>
                         <div className="aspect-square bg-bgMain border-2 border-dashed border-borderMain rounded-3xl relative overflow-hidden group">
                            {settings.beneficiaryQR ? (
                               <>
                                 <img src={settings.beneficiaryQR} alt="QR Code" className="w-full h-full object-contain p-4" />
                                 <button type="button" onClick={() => setSettings({...settings, beneficiaryQR: ''})} className="absolute top-4 right-4 bg-red-500 text-white p-2 rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={3}/></svg>
                                 </button>
                               </>
                            ) : (
                               <button type="button" onClick={() => fileInputRef.current?.click()} className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 hover:text-primary transition-colors">
                                  <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth={2}/></svg>
                                  <span className="text-[10px] font-black uppercase">Tải lên QR Tĩnh</span>
                               </button>
                            )}
                         </div>
                         <input type="file" ref={fileInputRef} onChange={handleQRUpload} accept="image/*" className="hidden" />
                         <p className="text-[10px] text-gray-400 italic">Lưu ý: Nếu không tải lên ảnh QR, hệ thống sẽ tự động tạo mã VietQR theo thông tin số tài khoản bên cạnh.</p>
                      </div>
                   </div>
                </div>

                <button type="submit" disabled={isLoading} className="w-full bg-primary text-white font-black py-5 rounded-3xl shadow-2xl shadow-primary/20 hover:scale-[1.01] active:scale-95 transition-all uppercase tracking-widest text-xs">Cập nhật cấu hình toàn hệ thống</button>
             </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default Admin;
