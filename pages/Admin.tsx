import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { db, SystemSettings } from '../services/db';
import { User, Listing, Transaction, Report } from '../types';
import { formatPrice, getListingUrl } from '../utils/format';
import { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';

type AdminTab = 'stats' | 'listings' | 'reports' | 'users' | 'payments' | 'settings';

// --- INTERFACES STATE ---
interface ConfirmState {
  show: boolean; title: string; message: string; onConfirm: () => void; type: 'success' | 'danger' | 'warning';
}
interface ToastState {
  show: boolean; message: string; type: 'success' | 'error';
}
interface EditListingState {
  show: boolean; listing: Listing | null;
}
interface VerificationModalState {
  show: boolean; user: User | null;
}

const Admin: React.FC<{ user: User | null }> = ({ user }) => {
  const navigate = useNavigate();
  // Đã xóa fileInputRef vì không còn dùng upload ảnh QR thủ công
  const [activeTab, setActiveTab] = useState<AdminTab>('stats');

  // --- GLOBAL DATA STATES ---
  const [reports, setReports] = useState<Report[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);

  // --- LISTING STATES (Pagination) ---
  const [listings, setListings] = useState<Listing[]>([]);
  const [listingLastDocs, setListingLastDocs] = useState<QueryDocumentSnapshot<DocumentData>[]>([]);
  const [hasMoreListings, setHasMoreListings] = useState(true);
  const [listingPage, setListingPage] = useState(1);
  const [listingSearch, setListingSearch] = useState('');
  const [listingStatusFilter, setListingStatusFilter] = useState<'all' | 'pending'>('pending');
  const [selectedListings, setSelectedListings] = useState<Set<string>>(new Set());

  // --- USER STATES (Pagination) ---
  const [users, setUsers] = useState<User[]>([]);
  const [userLastDocs, setUserLastDocs] = useState<QueryDocumentSnapshot<DocumentData>[]>([]);
  const [hasMoreUsers, setHasMoreUsers] = useState(true);
  const [userPage, setUserPage] = useState(1);
  const [isUserLoading, setIsUserLoading] = useState(false);

  const ITEMS_PER_PAGE = 10;

  // --- UI STATES ---
  const [isLoading, setIsLoading] = useState(false);
  const [confirmModal, setConfirmModal] = useState<ConfirmState>({ show: false, title: '', message: '', type: 'warning', onConfirm: () => {} });
  const [toast, setToast] = useState<ToastState>({ show: false, message: '', type: 'success' });

  // Modals
  const [editModal, setEditModal] = useState<EditListingState>({ show: false, listing: null });
  const [verifyModal, setVerifyModal] = useState<VerificationModalState>({ show: false, user: null });
  
  // Forms
  const [editForm, setEditForm] = useState({ title: '', price: 0, status: '' });

  // --- 1. INIT DATA ---
  useEffect(() => {
    if (!user || user.role !== 'admin') { navigate('/'); return; }
    loadInitialData();
  }, [user]);

  // Khi thay đổi filter Listings -> Reset và load lại
  useEffect(() => {
    if (activeTab === 'listings') {
        setListingPage(1);
        setListingLastDocs([]);
        loadListings(null);
    }
  }, [listingStatusFilter]);

  // Khi chuyển sang tab Users lần đầu -> Load Users
  useEffect(() => {
    if (activeTab === 'users' && users.length === 0) {
        loadUsers(null);
    }
  }, [activeTab]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
  };

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const [allReports, allTxs, allSettings] = await Promise.all([
        db.getAllReports(),
        db.getTransactions(),
        db.getSettings()
      ]);
      setReports(allReports);
      setTransactions(allTxs);
      setSettings(allSettings);
      
      // Load trang đầu tiên của Listings
      await loadListings(null);
    } catch (err) {
      showToast("Lỗi nạp dữ liệu hệ thống", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // --- 2. LOGIC LISTINGS (PAGINATION) ---
  const loadListings = async (lastDoc: QueryDocumentSnapshot<DocumentData> | null, isNext = true) => {
    setIsLoading(true);
    const res = await db.getListingsPaged({
        pageSize: ITEMS_PER_PAGE,
        lastDoc: lastDoc,
        search: listingSearch || undefined,
        status: listingStatusFilter === 'all' ? undefined : listingStatusFilter
    });

    if (!res.error) {
        setListings(res.listings);
        setHasMoreListings(res.hasMore);
        if (res.lastDoc && isNext) {
            setListingLastDocs(prev => [...prev, res.lastDoc!]);
        }
    }
    setIsLoading(false);
  };

  const handleNextListingPage = () => {
    if (!hasMoreListings) return;
    const nextCursor = listingLastDocs[listingPage - 1];
    setListingPage(p => p + 1);
    loadListings(nextCursor, true);
  };

  const handlePrevListingPage = () => {
    if (listingPage === 1) return;
    const prevCursor = (listingPage - 1) === 1 ? null : listingLastDocs[listingPage - 3];
    setListingPage(p => p - 1);
    loadListings(prevCursor, false);
  };

  const handleSearchListings = (e: React.FormEvent) => {
    e.preventDefault();
    setListingPage(1);
    setListingLastDocs([]);
    loadListings(null);
  };

  // --- 3. LOGIC USERS (PAGINATION) ---
  const loadUsers = async (lastDoc: QueryDocumentSnapshot<DocumentData> | null, isNext = true) => {
    setIsUserLoading(true);
    const res = await db.getUsersPaged({
        pageSize: ITEMS_PER_PAGE,
        lastDoc: lastDoc
    });

    if (!res.error) {
        setUsers(res.users);
        setHasMoreUsers(res.hasMore);
        if (res.lastDoc && isNext) {
            setUserLastDocs(prev => [...prev, res.lastDoc!]);
        }
    }
    setIsUserLoading(false);
  };

  const handleNextUserPage = () => {
    if (!hasMoreUsers) return;
    const nextCursor = userLastDocs[userPage - 1];
    setUserPage(p => p + 1);
    loadUsers(nextCursor, true);
  };

  const handlePrevUserPage = () => {
    if (userPage === 1) return;
    const prevCursor = (userPage - 1) === 1 ? null : userLastDocs[userPage - 3];
    setUserPage(p => p - 1);
    loadUsers(prevCursor, false);
  };

  // --- 4. LOGIC REPORTS ---
  const handleResolveReport = async (reportId: string) => {
    const originalReports = [...reports];
    setReports(prev => prev.filter(r => r.id !== reportId));
    try {
        await db.resolveReport(reportId);
        showToast("✅ Đã xử lý báo cáo");
    } catch (error) {
        setReports(originalReports);
        showToast("Lỗi kết nối", "error");
    }
  };

  const handleDeleteListingFromReport = async (reportId: string, listingId: string) => {
    setConfirmModal({
        show: true, 
        title: "Xóa tin & Đóng báo cáo?", 
        message: "Tin đăng sẽ bị xóa vĩnh viễn và báo cáo được đánh dấu đã xử lý.", 
        type: 'danger',
        onConfirm: async () => {
            setConfirmModal(prev => ({ ...prev, show: false }));
            setReports(prev => prev.filter(r => r.id !== reportId));
            setListings(prev => prev.filter(l => l.id !== listingId));

            try {
                await db.deleteListing(listingId);
                await db.resolveReport(reportId);
                showToast("✅ Đã xóa tin và xử lý");
            } catch (error) {
                showToast("Lỗi khi xóa tin", "error");
                loadInitialData();
            }
        }
    });
  };

  // --- 5. ACTIONS: LISTINGS ---
  const handleApproveListing = async (lId: string) => {
    setIsLoading(true);
    await db.updateListingStatus(lId, 'approved');
    showToast("✅ Đã duyệt tin đăng");
    setListings(prev => prev.map(l => l.id === lId ? { ...l, status: 'approved' } as Listing : l));
    if (listingStatusFilter === 'pending') {
        setListings(prev => prev.filter(l => l.id !== lId));
    }
    setIsLoading(false);
  };

  const handleRejectListing = async (lId: string) => {
    setConfirmModal({
      show: true,
      title: "Từ chối tin đăng",
      message: "Tin này sẽ bị từ chối và không hiển thị.",
      type: 'danger',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, show: false }));
        setIsLoading(true);
        await db.updateListingStatus(lId, 'rejected');
        showToast("Đã từ chối tin.");
        setListings(prev => prev.map(l => l.id === lId ? { ...l, status: 'rejected' } as Listing : l));
        if (listingStatusFilter === 'pending') {
            setListings(prev => prev.filter(l => l.id !== lId));
        }
        setIsLoading(false);
      }
    });
  };

  const toggleSelectListing = (id: string) => {
    const newSet = new Set(selectedListings);
    if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
    setSelectedListings(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedListings.size === listings.length) setSelectedListings(new Set());
    else setSelectedListings(new Set(listings.map(l => l.id)));
  };

  const handleBatchDelete = () => {
    if (selectedListings.size === 0) return;
    setConfirmModal({
        show: true, title: `Xóa vĩnh viễn ${selectedListings.size} tin?`, message: "Hành động này không thể hoàn tác!", type: 'danger',
        onConfirm: async () => {
            setConfirmModal(prev => ({...prev, show: false})); setIsLoading(true);
            const ids = Array.from(selectedListings);
            const res = await db.deleteListingsBatch(ids);
            if(res.success) {
                showToast(`Đã xóa ${ids.length} tin.`);
                setSelectedListings(new Set());
                loadListings(listingPage === 1 ? null : listingLastDocs[listingPage - 2] || null, false); 
            } else { showToast("Lỗi xóa: " + res.error, "error"); }
            setIsLoading(false);
        }
    });
  };

  // --- 6. ACTIONS: EDIT LISTING ---
  const openEditModal = (l: Listing) => {
    setEditForm({ title: l.title, price: l.price, status: l.status });
    setEditModal({ show: true, listing: l });
  };

  const saveListingChanges = async () => {
    if(!editModal.listing) return;
    setIsLoading(true);
    const res = await db.updateListingContent(editModal.listing.id, {
        title: editForm.title,
        price: Number(editForm.price),
        status: editForm.status as any
    });
    setIsLoading(false); setEditModal({ show: false, listing: null });
    if(res.success) {
        showToast("Cập nhật tin thành công");
        setListings(prev => prev.map(item => item.id === editModal.listing!.id ? {...item, ...editForm} as Listing : item));
    } else { showToast("Lỗi cập nhật", "error"); }
  };

  // --- 7. ACTIONS: PAYMENTS & KYC ---
  const handleApprovePayment = (txId: string) => {
    setConfirmModal({
        show: true, title: "Duyệt giao dịch", message: "Tiền/Gói sẽ được cộng cho user ngay lập tức.", type: 'success',
        onConfirm: async () => {
            setConfirmModal(prev => ({...prev, show: false})); setIsLoading(true);
            const res = await db.approveTransaction(txId);
            if(res.success) { showToast("Giao dịch thành công!"); loadInitialData(); }
            else { showToast("Lỗi: " + res.message, "error"); setIsLoading(false); }
        }
    });
  };

  const handleRejectPayment = (txId: string) => {
    setConfirmModal({
        show: true, title: "Từ chối giao dịch", message: "Hủy yêu cầu này?", type: 'danger',
        onConfirm: async () => {
            setConfirmModal(prev => ({...prev, show: false})); setIsLoading(true);
            const res = await db.rejectTransaction(txId);
            if(res.success) { showToast("Đã từ chối."); loadInitialData(); }
            else { showToast("Lỗi: " + res.message, "error"); setIsLoading(false); }
        }
    });
  };

  const handleProcessKyc = (u: User, status: 'verified' | 'rejected') => {
    setVerifyModal({ show: false, user: null }); 
    setUsers(prev => prev.map(usr => usr.id === u.id ? { ...usr, verificationStatus: status } : usr));
    
    db.updateUserProfile(u.id, { verificationStatus: status })
       .then(() => { showToast(status === 'verified' ? `Đã xác thực ${u.name}` : `Đã từ chối ${u.name}`); })
       .catch(() => { showToast("Lỗi xử lý KYC", "error"); loadUsers(null); });
  };

  const toggleUserStatus = (u: User) => {
      const newStatus = u.status === 'active' ? 'banned' : 'active';
      setConfirmModal({
          show: true, title: newStatus === 'banned' ? "Khóa tài khoản" : "Mở khóa", message: "Xác nhận hành động?", type: newStatus === 'banned' ? 'danger' : 'success',
          onConfirm: async () => {
              setConfirmModal(prev => ({...prev, show: false})); 
              setUsers(prev => prev.map(usr => usr.id === u.id ? { ...usr, status: newStatus } : usr));
              await db.updateUserProfile(u.id, { status: newStatus });
              showToast("Đã cập nhật trạng thái user");
          }
      });
  };

  // --- 8. ACTIONS: SETTINGS ---
  // Đã xóa hàm handleQRUpload

  const handleSaveSettings = async (e: React.FormEvent) => {
      e.preventDefault(); setIsLoading(true);
      await db.updateSettings(settings);
      setIsLoading(false); showToast("Đã lưu cấu hình hệ thống!");
  };

  // --- CALCULATED LISTS ---
  const pendingPayments = useMemo(() => transactions.filter(t => t.status === 'pending'), [transactions]);
  const activeReports = useMemo(() => reports.filter(r => r.status === 'pending'), [reports]);
  const pendingVerifications = useMemo(() => users.filter(u => u.verificationStatus === 'pending'), [users]);
  const hasPendingListings = useMemo(() => listings.some(l => l.status === 'pending'), [listings]);

  if (!user || user.role !== 'admin' || !settings) return null;

  return (
    <div className="flex flex-col lg:flex-row gap-8 pb-24 relative min-h-screen">
      {/* 1. OVERLAYS (MODALS & TOAST) */}
      {toast.show && <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-[110] px-6 py-3 rounded-2xl shadow-2xl font-black text-xs uppercase tracking-widest ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white`}>{toast.message}</div>}
      
      {confirmModal.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
           <div className="bg-white p-8 rounded-[2.5rem] max-w-sm w-full animate-fade-in-up">
              <h3 className="text-xl font-black mb-2">{confirmModal.title}</h3>
              <p className="text-sm text-gray-500 mb-6">{confirmModal.message}</p>
              <div className="flex gap-3">
                  <button onClick={() => setConfirmModal({...confirmModal, show: false})} className="flex-1 py-3 bg-gray-100 rounded-xl font-bold text-xs uppercase">Hủy</button>
                  <button onClick={confirmModal.onConfirm} className="flex-1 py-3 bg-primary text-white rounded-xl font-bold text-xs uppercase">Đồng ý</button>
              </div>
           </div>
        </div>
      )}

      {/* KYC Modal */}
      {verifyModal.show && verifyModal.user && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-white w-full max-w-3xl rounded-[2rem] p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black text-textMain">Duyệt KYC: <span className="text-primary">{verifyModal.user.name}</span></h3>
                    <button onClick={() => setVerifyModal({ show: false, user: null })} className="bg-gray-100 p-2 rounded-full hover:bg-gray-200">✕</button>
                </div>
                <div className="grid md:grid-cols-2 gap-4 mb-8">
                    <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase text-gray-400">Mặt trước</p>
                        <div className="aspect-video bg-gray-100 rounded-2xl overflow-hidden border border-gray-200">
                             {verifyModal.user.verificationDocuments?.[0] ? <a href={verifyModal.user.verificationDocuments[0]} target="_blank"><img src={verifyModal.user.verificationDocuments[0]} className="w-full h-full object-contain" /></a> : <div className="flex items-center justify-center h-full text-gray-400">Không có ảnh</div>}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase text-gray-400">Mặt sau</p>
                        <div className="aspect-video bg-gray-100 rounded-2xl overflow-hidden border border-gray-200">
                             {verifyModal.user.verificationDocuments?.[1] ? <a href={verifyModal.user.verificationDocuments[1]} target="_blank"><img src={verifyModal.user.verificationDocuments[1]} className="w-full h-full object-contain" /></a> : <div className="flex items-center justify-center h-full text-gray-400">Không có ảnh</div>}
                        </div>
                    </div>
                </div>
                <div className="flex gap-4">
                    <button onClick={() => handleProcessKyc(verifyModal.user!, 'rejected')} className="flex-1 py-4 bg-red-50 text-red-500 font-black rounded-2xl uppercase hover:bg-red-100">Từ chối</button>
                    <button onClick={() => handleProcessKyc(verifyModal.user!, 'verified')} className="flex-1 py-4 bg-green-500 text-white font-black rounded-2xl uppercase hover:bg-green-600 shadow-lg">Xác thực</button>
                </div>
            </div>
        </div>
      )}

      {/* Edit Listing Modal */}
      {editModal.show && editModal.listing && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <div className="bg-white p-8 rounded-[2.5rem] max-w-lg w-full animate-fade-in-up space-y-6">
                  <h3 className="text-xl font-black text-primary">Chỉnh sửa nhanh</h3>
                  <div className="space-y-4">
                      <div><label className="text-[10px] font-black uppercase text-gray-400">Tiêu đề</label><input type="text" value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})} className="w-full border border-gray-200 rounded-xl p-3 font-bold text-sm" /></div>
                      <div><label className="text-[10px] font-black uppercase text-gray-400">Giá</label><input type="number" value={editForm.price} onChange={e => setEditForm({...editForm, price: Number(e.target.value)})} className="w-full border border-gray-200 rounded-xl p-3 font-bold text-sm" /></div>
                      <div><label className="text-[10px] font-black uppercase text-gray-400">Trạng thái</label>
                          <select value={editForm.status} onChange={e => setEditForm({...editForm, status: e.target.value})} className="w-full border border-gray-200 rounded-xl p-3 font-bold text-sm">
                              <option value="approved">Approved (Duyệt)</option><option value="pending">Pending (Chờ)</option><option value="rejected">Rejected (Hủy)</option>
                          </select>
                      </div>
                  </div>
                  <div className="flex gap-3 pt-4">
                      <button onClick={() => setEditModal({show: false, listing: null})} className="flex-1 py-3 bg-gray-100 rounded-xl font-bold text-xs uppercase">Đóng</button>
                      <button onClick={saveListingChanges} className="flex-1 py-3 bg-primary text-white rounded-xl font-bold text-xs uppercase shadow-lg">Lưu</button>
                  </div>
              </div>
          </div>
      )}

      {/* 2. SIDEBAR */}
      <aside className="lg:w-72 flex-shrink-0">
         <div className="bg-white border border-borderMain rounded-[2.5rem] p-5 shadow-soft sticky top-24 space-y-6">
            <div className="px-4 py-2"><h2 className="text-xl font-black text-primary">Admin Console</h2></div>
            <nav className="space-y-1">
               {[
                 { id: 'stats', label: 'Bàn làm việc', icon: '📊', notify: false },
                 { id: 'payments', label: 'Duyệt tiền', icon: '💰', notify: pendingPayments.length > 0 },
                 { id: 'listings', label: 'Duyệt tin', icon: '📦', notify: hasPendingListings },
                 { id: 'reports', label: 'Báo cáo', icon: '🚨', notify: activeReports.length > 0 },
                 { id: 'users', label: 'Thành viên', icon: '👥', notify: pendingVerifications.length > 0 },
                 { id: 'settings', label: 'Cấu hình', icon: '⚙️', notify: false },
               ].map(tab => (
                   <button key={tab.id} onClick={() => setActiveTab(tab.id as AdminTab)} className={`w-full flex items-center justify-between px-5 py-3.5 rounded-2xl text-[11px] font-black uppercase transition-all ${activeTab === tab.id ? 'bg-primary text-white shadow-lg' : 'text-gray-500 hover:bg-gray-50'}`}>
                      <div className="flex items-center gap-4"><span className="text-lg">{tab.icon}</span><span>{tab.label}</span></div>
                      
                      <div className="flex items-center gap-2">
                          {['payments', 'reports'].includes(tab.id) && (tab as any).count > 0 && <span className="bg-red-500 text-white px-2.5 py-1 rounded-full text-[9px] font-black animate-pulse">{(tab as any).count}</span>}
                          
                          {tab.notify && (
                              <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border border-white"></span>
                              </span>
                          )}
                      </div>
                   </button>
               ))}
            </nav>
         </div>
      </aside>

      {/* 3. MAIN CONTENT */}
      <div className="flex-1 min-w-0 space-y-6">
         {isLoading && <div className="fixed top-24 right-10 z-[60] bg-primary text-white text-[10px] font-black px-4 py-2 rounded-full animate-bounce shadow-xl uppercase">Đang xử lý...</div>}

         {/* === TAB STATS === */}
         {activeTab === 'stats' && (
             <div className="space-y-8">
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: 'Doanh thu', value: formatPrice(transactions.filter(t => t.status === 'success' && t.type === 'payment').reduce((s, t) => s + t.amount, 0)), color: 'text-primary' },
                      { label: 'Chờ duyệt tiền', value: formatPrice(pendingPayments.reduce((s, t) => s + t.amount, 0)), color: 'text-yellow-600' },
                      { label: 'Tổng User (Trang này)', value: users.length, color: 'text-textMain' },
                      { label: 'Trạng thái', value: "Online", color: 'text-green-600' }
                    ].map((s, i) => (
                      <div key={i} className="bg-white p-6 rounded-3xl border border-borderMain shadow-soft text-center space-y-1">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{s.label}</p>
                        <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                      </div>
                    ))}
                 </div>
                 <div className="bg-white border border-borderMain rounded-[2.5rem] p-8 shadow-soft">
                    <h3 className="text-xl font-black mb-6">Giao dịch mới nhất</h3>
                    <div className="overflow-x-auto">
                       <table className="w-full text-left text-sm">
                          <thead><tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100"><th className="pb-4">Mô tả</th><th className="pb-4">Số tiền</th><th className="pb-4">Thời gian</th><th className="pb-4">Trạng thái</th></tr></thead>
                          <tbody className="divide-y divide-gray-50">{transactions.slice(0, 5).map(tx => (<tr key={tx.id}><td className="py-4 font-bold text-xs">{tx.description}</td><td className="py-4 font-black">{formatPrice(tx.amount)}</td><td className="py-4 text-gray-400 text-[10px]">{new Date(tx.createdAt).toLocaleString()}</td><td className="py-4"><span className={`text-[9px] px-2 py-1 rounded font-black uppercase ${tx.status === 'success' ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'}`}>{tx.status}</span></td></tr>))}</tbody>
                       </table>
                    </div>
                 </div>
             </div>
         )}

         {/* === TAB PAYMENTS === */}
         {activeTab === 'payments' && (
             <div className="bg-white border border-borderMain rounded-[2.5rem] p-8 shadow-soft">
                <h3 className="text-xl font-black mb-8">Yêu cầu nạp tiền ({pendingPayments.length})</h3>
                <div className="space-y-4">
                  {pendingPayments.map(tx => (
                    <div key={tx.id} className="border-2 border-gray-100 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 hover:border-primary transition-all">
                       <div className="flex items-center gap-5 flex-1 min-w-0">
                          <div className="w-14 h-14 bg-bgMain rounded-2xl flex items-center justify-center text-3xl shadow-inner">{tx.type === 'deposit' ? '💰' : '💎'}</div>
                          <div className="min-w-0">
                             <div className="flex items-center gap-3"><p className="text-sm font-black text-textMain truncate">{tx.description}</p><span className="bg-primary/10 text-primary text-[10px] font-black px-2 py-0.5 rounded uppercase">{tx.type}</span></div>
                             <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase">User ID: {tx.userId.slice(0,8)}... • {new Date(tx.createdAt).toLocaleString()}</p>
                             <p className="text-[9px] text-primary font-black mt-1 uppercase">SỐ TIỀN: {formatPrice(tx.amount)}</p>
                          </div>
                       </div>
                       <div className="flex gap-3">
                          <button onClick={() => handleApprovePayment(tx.id)} className="bg-green-500 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase shadow-lg">Duyệt</button>
                          <button onClick={() => handleRejectPayment(tx.id)} className="bg-red-50 text-red-500 px-6 py-3 rounded-xl text-[10px] font-black uppercase">Từ chối</button>
                       </div>
                    </div>
                  ))}
                  {pendingPayments.length === 0 && <div className="text-center py-20 text-gray-400 font-bold bg-bgMain rounded-3xl uppercase text-[10px] tracking-widest">Không có giao dịch chờ.</div>}
                </div>
             </div>
         )}

         {/* === TAB LISTINGS (FIXED PAGINATION) === */}
         {activeTab === 'listings' && (
             <div className="bg-white border border-borderMain rounded-[2.5rem] p-8 shadow-soft space-y-6">
                 <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                     <div>
                        <h3 className="text-xl font-black">Quản lý tin đăng</h3>
                        <div className="flex gap-2 mt-2">
                             <button onClick={() => setListingStatusFilter('pending')} className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-lg border ${listingStatusFilter === 'pending' ? 'bg-yellow-500 text-white border-yellow-500 shadow-md' : 'bg-white border-gray-200 text-gray-500'}`}>Chờ duyệt</button>
                             <button onClick={() => setListingStatusFilter('all')} className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-lg border ${listingStatusFilter === 'all' ? 'bg-primary text-white border-primary shadow-md' : 'bg-white border-gray-200 text-gray-500'}`}>Tất cả</button>
                        </div>
                     </div>
                     <div className="flex items-center gap-2 w-full md:w-auto">
                         <form onSubmit={handleSearchListings} className="relative flex-1 md:w-64">
                             <input type="text" placeholder="Tìm ID, Tên..." value={listingSearch} onChange={e => setListingSearch(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2 text-xs font-bold focus:outline-none focus:border-primary" />
                             <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
                         </form>
                         {selectedListings.size > 0 && <button onClick={handleBatchDelete} className="bg-red-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase animate-pulse">Xóa ({selectedListings.size})</button>}
                     </div>
                 </div>
                 
                 <div className="overflow-x-auto">
                     <table className="w-full text-left">
                         <thead>
                             <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                                 <th className="pb-4 w-10"><input type="checkbox" onChange={toggleSelectAll} checked={selectedListings.size === listings.length && listings.length > 0} className="rounded text-primary focus:ring-primary" /></th>
                                 <th className="pb-4">Tin đăng</th><th className="pb-4">Người đăng</th><th className="pb-4">Trạng thái</th><th className="pb-4 text-right">Thao tác</th>
                             </tr>
                         </thead>
                         <tbody className="divide-y divide-gray-50">
                             {listings.map(l => (
                                 <tr key={l.id} className="group hover:bg-gray-50 transition-colors">
                                     <td className="py-4"><input type="checkbox" checked={selectedListings.has(l.id)} onChange={() => toggleSelectListing(l.id)} className="rounded text-primary focus:ring-primary" /></td>
                                     <td className="py-4">
                                         <div className="flex items-center gap-3">
                                              <img src={l.images[0]} className="w-10 h-10 rounded-lg object-cover bg-gray-100" />
                                              <div className="min-w-0 max-w-[200px]"><Link to={getListingUrl(l)} target="_blank" className="text-xs font-black truncate block hover:text-primary">{l.title}</Link><p className="text-[10px] text-primary font-bold">{formatPrice(l.price)}</p></div>
                                         </div>
                                     </td>
                                     <td className="py-4"><div className="flex items-center gap-2"><img src={l.sellerAvatar} className="w-6 h-6 rounded-full" /><span className="text-[10px] font-bold">{l.sellerName}</span></div></td>
                                     <td className="py-4"><span className={`text-[9px] px-2 py-1 rounded font-black uppercase ${l.status === 'approved' ? 'bg-green-100 text-green-600' : l.status === 'pending' ? 'bg-yellow-100 text-yellow-600' : 'bg-red-100 text-red-600'}`}>{l.status}</span></td>
                                     <td className="py-4 text-right">
                                         <div className="flex justify-end gap-2">
                                              {l.status === 'pending' && (
                                                  <>
                                                      <button onClick={() => handleApproveListing(l.id)} className="bg-green-500 text-white p-2 rounded-lg transition-colors hover:shadow-lg" title="Duyệt ngay">✅</button>
                                                      <button onClick={() => handleRejectListing(l.id)} className="bg-red-100 text-red-500 p-2 rounded-lg transition-colors hover:bg-red-200" title="Từ chối">⛔</button>
                                                  </>
                                              )}
                                              <button onClick={() => openEditModal(l)} className="text-blue-500 hover:bg-blue-50 p-2 rounded-lg transition-colors" title="Sửa nhanh">✏️</button>
                                              <button onClick={() => { setSelectedListings(new Set([l.id])); handleBatchDelete(); }} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors" title="Xóa">🗑</button>
                                         </div>
                                     </td>
                                 </tr>
                             ))}
                         </tbody>
                     </table>
                     {listings.length === 0 && <div className="text-center py-10 text-gray-400 font-bold text-xs uppercase">Không tìm thấy tin nào.</div>}
                 </div>
                 {/* LISTING PAGINATION CONTROLS */}
                 <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                     <p className="text-[10px] font-bold text-gray-400 uppercase">Trang {listingPage}</p>
                     <div className="flex gap-2">
                         <button onClick={handlePrevListingPage} disabled={listingPage === 1 || isLoading} className="px-4 py-2 rounded-lg border border-gray-200 text-xs font-bold uppercase hover:bg-gray-50 disabled:opacity-50">Trước</button>
                         <button onClick={handleNextListingPage} disabled={!hasMoreListings || isLoading} className="px-4 py-2 rounded-lg bg-primary text-white text-xs font-bold uppercase hover:bg-primaryHover disabled:opacity-50">Sau</button>
                     </div>
                 </div>
             </div>
         )}

         {/* === TAB USERS (PAGINATION) === */}
         {activeTab === 'users' && (
             <div className="bg-white border border-borderMain rounded-[2.5rem] p-8 shadow-soft space-y-8">
                {/* Phần Alert Pending KYC */}
                {pendingVerifications.length > 0 && (
                    <div className="bg-yellow-50 border border-yellow-100 rounded-3xl p-6">
                        <h3 className="text-lg font-black text-yellow-800 mb-4 flex items-center gap-2"><span className="animate-pulse">⚠️</span> Yêu cầu xác thực (Trang này)</h3>
                        <div className="grid md:grid-cols-2 gap-4">
                            {pendingVerifications.map(u => (
                                <div key={u.id} className="bg-white p-4 rounded-2xl flex items-center justify-between shadow-sm">
                                    <div className="flex items-center gap-3"><img src={u.avatar} className="w-10 h-10 rounded-full" /><div><p className="text-xs font-black">{u.name}</p><p className="text-[9px] text-gray-400">{u.email}</p></div></div>
                                    <button onClick={() => setVerifyModal({ show: true, user: u })} className="bg-primary text-white text-[10px] font-black px-4 py-2 rounded-xl uppercase hover:scale-105 transition-transform">Xem hồ sơ</button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                <div className="flex justify-between items-center">
                    <h3 className="text-xl font-black">Danh sách thành viên</h3>
                    {isUserLoading && <span className="text-xs font-bold text-primary animate-pulse">Đang tải...</span>}
                </div>

                <div className="overflow-x-auto">
                   <table className="w-full text-left">
                      <thead><tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100"><th className="pb-4">User</th><th className="pb-4">Xác thực</th><th className="pb-4">Ví</th><th className="pb-4">Thao tác</th></tr></thead>
                      <tbody className="divide-y divide-gray-50">
                        {users.map(u => (
                          <tr key={u.id} className={u.status === 'banned' ? 'opacity-50 grayscale' : ''}>
                             <td className="py-4"><div className="flex items-center gap-3"><img src={u.avatar} className="w-10 h-10 rounded-xl" /><div><p className="text-xs font-black">{u.name}</p><p className="text-[9px] text-gray-400">{u.email}</p></div></div></td>
                             <td className="py-4">
                                <div className="flex items-center gap-2">
                                    {u.verificationStatus === 'verified' ? <span className="text-green-500 text-lg">✅</span> : u.verificationStatus === 'pending' ? <span className="text-yellow-500 text-lg animate-pulse">🕒</span> : <span className="text-gray-300 text-lg">⚪</span>}
                                    <button onClick={() => setVerifyModal({ show: true, user: u })} className={`text-[9px] font-black px-3 py-1.5 rounded-lg border ${u.verificationStatus === 'pending' ? 'bg-primary text-white' : 'bg-white text-gray-500'}`}>{u.verificationStatus === 'pending' ? 'DUYỆT' : 'HỒ SƠ'}</button>
                                </div>
                             </td>
                             <td className="py-4 text-xs font-black">{formatPrice(u.walletBalance || 0)}</td>
                             <td className="py-4"><button onClick={() => toggleUserStatus(u)} className={`text-[10px] font-black uppercase px-4 py-2 rounded-xl transition-all ${u.status === 'active' ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'}`}>{u.status === 'active' ? 'Khóa' : 'Mở'}</button></td>
                          </tr>
                        ))}
                      </tbody>
                   </table>
                   {users.length === 0 && !isUserLoading && <div className="text-center py-10 text-gray-400 font-bold text-xs uppercase">Không tìm thấy thành viên nào.</div>}
                </div>
                {/* USER PAGINATION CONTROLS */}
                <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                     <p className="text-[10px] font-bold text-gray-400 uppercase">Trang {userPage}</p>
                     <div className="flex gap-2">
                         <button onClick={handlePrevUserPage} disabled={userPage === 1 || isUserLoading} className="px-4 py-2 rounded-lg border border-gray-200 text-xs font-bold uppercase hover:bg-gray-50 disabled:opacity-50">Trước</button>
                         <button onClick={handleNextUserPage} disabled={!hasMoreUsers || isUserLoading} className="px-4 py-2 rounded-lg bg-primary text-white text-xs font-bold uppercase hover:bg-primaryHover disabled:opacity-50">Sau</button>
                     </div>
                 </div>
             </div>
         )}

         {/* === TAB REPORTS (OPTIMISTIC UI) === */}
         {activeTab === 'reports' && (
             <div className="bg-white border border-borderMain rounded-[2.5rem] p-8 shadow-soft">
                 <h3 className="text-xl font-black mb-8">Báo cáo vi phạm ({activeReports.length})</h3>
                 <div className="space-y-4">
                    {activeReports.map(r => (
                        <div key={r.id} className="border-2 border-red-50 bg-red-50/10 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                            <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-3"><span className="bg-red-500 text-white text-[9px] font-black px-2 py-1 rounded uppercase">VI PHẠM</span><h4 className="text-sm font-black text-textMain">{r.reason}</h4></div>
                                <p className="text-xs text-gray-600">{r.details}</p>
                                <p className="text-[10px] text-gray-400 font-bold uppercase">ID Tin: {r.listingId}</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => handleResolveReport(r.id)} className="bg-green-500 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase shadow-lg hover:scale-105 transition-transform">Đánh dấu xử lý</button>
                                <button onClick={() => handleDeleteListingFromReport(r.id, r.listingId)} className="bg-red-500 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase shadow-lg hover:scale-105 transition-transform">Xóa tin</button>
                            </div>
                        </div>
                    ))}
                    {activeReports.length === 0 && <div className="text-center py-20 text-gray-400 font-bold bg-bgMain rounded-3xl uppercase text-[10px] tracking-widest">Không có báo cáo.</div>}
                 </div>
             </div>
         )}

         {/* === TAB SETTINGS (UPDATED FOR VIETQR) === */}
         {activeTab === 'settings' && (
             <div className="bg-white border border-borderMain rounded-[2.5rem] p-8 shadow-soft">
                 <form onSubmit={handleSaveSettings} className="space-y-12">
                   {/* 1. General */}
                   <div className="space-y-6">
                      <h4 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2"><span className="w-2 h-2 bg-primary rounded-full"></span> Phí & Ưu đãi</h4>
                      <div className="grid md:grid-cols-2 gap-8">
                         <div className="space-y-3"><label className="text-[11px] font-black text-gray-400 uppercase px-1">Giá đẩy tin (VNĐ)</label><input type="number" value={settings.pushPrice} onChange={e => setSettings({...settings, pushPrice: parseInt(e.target.value)})} className="w-full bg-bgMain border border-borderMain rounded-2xl p-4 font-bold" /></div>
                         <div className="space-y-3"><label className="text-[11px] font-black text-gray-400 uppercase px-1">Chiết khấu chung (%)</label><input type="number" value={settings.pushDiscount || 0} onChange={e => setSettings({...settings, pushDiscount: parseInt(e.target.value)})} className="w-full bg-bgMain border border-borderMain rounded-2xl p-4 font-bold" /></div>
                      </div>
                   </div>
                   
                   {/* 2. VIP Config */}
                   <div className="space-y-6 pt-6 border-t border-gray-100">
                       <h4 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2"><span className="w-2 h-2 bg-primary rounded-full"></span> Gói VIP</h4>
                       <div className="grid md:grid-cols-2 gap-6">
                          {/* Basic */}
                          <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 space-y-4">
                              <h5 className="font-black text-blue-600 text-xs uppercase">Gói Basic</h5>
                              <input type="number" placeholder="Giá" value={settings.tierConfigs.basic.price} onChange={e => setSettings({...settings, tierConfigs: {...settings.tierConfigs, basic: {...settings.tierConfigs.basic, price: parseInt(e.target.value)}}})} className="w-full bg-white border border-borderMain rounded-xl p-3 text-sm font-bold" />
                              <input type="number" placeholder="Số ảnh" value={settings.tierConfigs.basic.maxImages} onChange={e => setSettings({...settings, tierConfigs: {...settings.tierConfigs, basic: {...settings.tierConfigs.basic, maxImages: parseInt(e.target.value)}}})} className="w-full bg-white border border-borderMain rounded-xl p-3 text-sm font-bold" />
                          </div>
                          {/* Pro */}
                          <div className="bg-yellow-50 p-6 rounded-3xl border border-yellow-100 space-y-4">
                              <h5 className="font-black text-yellow-600 text-xs uppercase">Gói Pro</h5>
                              <input type="number" placeholder="Giá" value={settings.tierConfigs.pro.price} onChange={e => setSettings({...settings, tierConfigs: {...settings.tierConfigs, pro: {...settings.tierConfigs.pro, price: parseInt(e.target.value)}}})} className="w-full bg-white border border-borderMain rounded-xl p-3 text-sm font-bold" />
                              <input type="number" placeholder="Số ảnh" value={settings.tierConfigs.pro.maxImages} onChange={e => setSettings({...settings, tierConfigs: {...settings.tierConfigs, pro: {...settings.tierConfigs.pro, maxImages: parseInt(e.target.value)}}})} className="w-full bg-white border border-borderMain rounded-xl p-3 text-sm font-bold" />
                          </div>
                       </div>
                   </div>

                   {/* 3. Bank Configuration for VietQR */}
                   <div className="space-y-6 pt-6 border-t border-gray-100">
                        <h4 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
                            <span className="w-2 h-2 bg-primary rounded-full"></span> Ngân hàng (VietQR)
                        </h4>
                        <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 mb-4">
                            <p className="text-[10px] font-bold text-blue-600">
                                ℹ️ Lưu ý: Để tạo mã VietQR tự động, vui lòng nhập chính xác "Mã Ngân Hàng" (Bank Code).
                                <br/>Ví dụ: Vietcombank nhập <b>VCB</b>, MBBank nhập <b>MB</b>, Techcombank nhập <b>TCB</b>...
                            </p>
                        </div>
                        <div className="grid md:grid-cols-2 gap-10">
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-gray-400 pl-1">Mã Ngân Hàng (Bank Code)</label>
                                    <input 
                                        type="text" 
                                        placeholder="VD: MB, VCB, TPB, ACB..." 
                                        value={settings.bankName} 
                                        onChange={e => setSettings({...settings, bankName: e.target.value.toUpperCase()})} 
                                        className="w-full bg-bgMain border border-borderMain rounded-2xl p-4 font-bold placeholder:font-normal" 
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-gray-400 pl-1">Số Tài Khoản</label>
                                    <input 
                                        type="text" 
                                        placeholder="Số TK" 
                                        value={settings.accountNumber} 
                                        onChange={e => setSettings({...settings, accountNumber: e.target.value})} 
                                        className="w-full bg-bgMain border border-borderMain rounded-2xl p-4 font-bold" 
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-gray-400 pl-1">Tên Chủ Tài Khoản</label>
                                    <input 
                                        type="text" 
                                        placeholder="NGUYEN VAN A" 
                                        value={settings.accountName} 
                                        onChange={e => setSettings({...settings, accountName: e.target.value.toUpperCase()})} 
                                        className="w-full bg-bgMain border border-borderMain rounded-2xl p-4 font-bold" 
                                    />
                                </div>
                            </div>
                            
                            {/* Preview VietQR trong Admin */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-gray-400 pl-1">Xem trước QR</label>
                                <div className="aspect-square bg-white border border-gray-200 rounded-3xl flex items-center justify-center p-4 shadow-sm">
                                    {settings.bankName && settings.accountNumber ? (
                                        <img 
                                            src={`https://img.vietqr.io/image/${settings.bankName}-${settings.accountNumber}-compact.jpg?accountName=${encodeURI(settings.accountName)}`}
                                            className="w-full h-full object-contain"
                                            alt="Preview"
                                        />
                                    ) : (
                                        <span className="text-gray-300 text-xs font-bold text-center">Nhập thông tin bên trái<br/>để xem trước</span>
                                    )}
                                </div>
                            </div>
                        </div>
                   </div>

                   {/* 4. SEED DATA TOOL */}
                   <div className="space-y-6 pt-6 border-t border-gray-100">
                       <h4 className="text-sm font-black uppercase tracking-widest text-red-500 flex items-center gap-2">
                           <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span> Công cụ Developer
                       </h4>
                       <div className="bg-red-50 p-6 rounded-3xl border border-red-100 flex flex-col md:flex-row items-center justify-between gap-4">
                           <div>
                               <h5 className="font-black text-gray-800">Tạo dữ liệu mẫu (Seed Data)</h5>
                               <p className="text-[10px] text-gray-500 mt-1">Tự động tạo 50 User + 100 Tin đăng đẹp mắt để test.</p>
                           </div>
                           <button 
                               type="button" 
                               onClick={async () => {
                                   if(window.confirm("Hành động này sẽ tạo ra rất nhiều dữ liệu giả. Bạn chắc chứ?")) {
                                       setIsLoading(true);
                                       const res = await db.seedDatabase(); 
                                       setIsLoading(false);
                                       if(res.success) {
                                           showToast(res.message);
                                           loadInitialData();
                                       }
                                       else showToast("Lỗi: " + res.message, "error");
                                   }
                               }}
                               disabled={isLoading}
                               className="bg-red-500 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-red-600 transition-all w-full md:w-auto"
                           >
                               {isLoading ? "Đang tạo..." : "Khởi tạo ngay"}
                           </button>
                       </div>
                   </div>

                   <button type="submit" disabled={isLoading} className="w-full bg-primary text-white font-black py-5 rounded-3xl shadow-2xl shadow-primary/20 hover:scale-[1.01] active:scale-95 transition-all uppercase tracking-widest text-xs">Lưu cấu hình</button>
                </form>
             </div>
         )}
      </div>
    </div>
  );
};

export default Admin;
