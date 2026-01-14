import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { db, SystemSettings } from '../services/db';
import { User, Listing, Transaction, Report, Category } from '../types';
import { formatPrice, getListingUrl } from '../utils/format';
import { QueryDocumentSnapshot, DocumentData, collection, getDocs, getFirestore } from 'firebase/firestore';
import { compressAndGetBase64 } from '../utils/imageCompression';
import { seedCategoriesToFirebase } from '../utils/seedCategories';

// [CẬP NHẬT] Thêm 'categories' vào danh sách Tab
type AdminTab = 'stats' | 'listings' | 'reports' | 'users' | 'payments' | 'settings' | 'categories';

interface ConfirmState { show: boolean; title: string; message: string; onConfirm: () => void; type: 'success' | 'danger' | 'warning'; }
interface ToastState { show: boolean; message: string; type: 'success' | 'error'; }
interface EditListingState { show: boolean; listing: Listing | null; }
interface VerificationModalState { show: boolean; user: User | null; }

const Admin: React.FC<{ user: User | null }> = ({ user }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AdminTab>('stats');
  const [reports, setReports] = useState<Report[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  
  // State cho Listings
  const [listings, setListings] = useState<Listing[]>([]);
  const [listingLastDocs, setListingLastDocs] = useState<QueryDocumentSnapshot<DocumentData>[]>([]);
  const [hasMoreListings, setHasMoreListings] = useState(true);
  const [listingPage, setListingPage] = useState(1);
  const [listingSearch, setListingSearch] = useState('');
  const [listingStatusFilter, setListingStatusFilter] = useState<'all' | 'pending'>('pending');
  const [selectedListings, setSelectedListings] = useState<Set<string>>(new Set());
  
  // State cho Users
  const [users, setUsers] = useState<User[]>([]);
  const [userLastDocs, setUserLastDocs] = useState<QueryDocumentSnapshot<DocumentData>[]>([]);
  const [hasMoreUsers, setHasMoreUsers] = useState(true);
  const [userPage, setUserPage] = useState(1);
  const [isUserLoading, setIsUserLoading] = useState(false);
  
  // [MỚI] State cho Categories
  const [categories, setCategories] = useState<Category[]>([]);
  const [editingCat, setEditingCat] = useState<Category | null>(null);

  const ITEMS_PER_PAGE = 10;
  const [isLoading, setIsLoading] = useState(false);
  const [confirmModal, setConfirmModal] = useState<ConfirmState>({ show: false, title: '', message: '', type: 'warning', onConfirm: () => {} });
  const [toast, setToast] = useState<ToastState>({ show: false, message: '', type: 'success' });
  const [editModal, setEditModal] = useState<EditListingState>({ show: false, listing: null });
  const [verifyModal, setVerifyModal] = useState<VerificationModalState>({ show: false, user: null });
  const [editForm, setEditForm] = useState({ title: '', price: 0, status: '' });

  useEffect(() => {
    if (!user || user.role !== 'admin') { navigate('/'); return; }
    loadInitialData();
  }, [user]);

  useEffect(() => {
    if (activeTab === 'listings') {
        setListingPage(1); setListingLastDocs([]); loadListings(null);
    }
    // [MỚI] Load danh mục khi chuyển tab
    if (activeTab === 'categories') {
        db.getCategories().then(setCategories);
    }
  }, [listingStatusFilter, activeTab]);

  useEffect(() => {
    if (activeTab === 'users' && users.length === 0) loadUsers(null);
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
      
      const defaultSlides = [
         { id: 1, type: 'text', title: "Đăng tin siêu tốc 🚀", desc: "Tiếp cận hàng ngàn khách hàng mỗi ngày.", btnText: "Đăng ngay", btnLink: "/post", colorFrom: "from-blue-600", colorTo: "to-indigo-600", icon: "⚡", isActive: true },
         { id: 2, type: 'text', title: "Nâng cấp VIP 👑", desc: "Tin đăng nổi bật, chốt đơn nhanh gấp 5 lần.", btnText: "Xem gói VIP", btnLink: "/profile", colorFrom: "from-orange-500", colorTo: "to-red-500", icon: "💎", isActive: true },
         { id: 3, type: 'text', title: "Săn đồ cũ giá hời 🛍️", desc: "Hàng ngàn món đồ chất lượng đang chờ bạn.", btnText: "Khám phá", btnLink: "/", colorFrom: "from-green-500", colorTo: "to-teal-500", icon: "🔥", isActive: true }
      ];

      setSettings({
          ...allSettings, 
          bannerSlides: (allSettings?.bannerSlides && allSettings.bannerSlides.length > 0) ? allSettings.bannerSlides : defaultSlides
      } as any);
      
      await loadListings(null);
    } catch (err) {
      showToast("Lỗi nạp dữ liệu hệ thống", "error");
    } finally {
      setIsLoading(false);
    }
  };

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
        if (res.lastDoc && isNext) setListingLastDocs(prev => [...prev, res.lastDoc!]);
    }
    setIsLoading(false);
  };

  const handleNextListingPage = () => { if (!hasMoreListings) return; const nextCursor = listingLastDocs[listingPage - 1]; setListingPage(p => p + 1); loadListings(nextCursor, true); };
  const handlePrevListingPage = () => { if (listingPage === 1) return; const prevCursor = (listingPage - 1) === 1 ? null : listingLastDocs[listingPage - 3]; setListingPage(p => p - 1); loadListings(prevCursor, false); };
  const handleSearchListings = (e: React.FormEvent) => { e.preventDefault(); setListingPage(1); setListingLastDocs([]); loadListings(null); };

  const loadUsers = async (lastDoc: QueryDocumentSnapshot<DocumentData> | null, isNext = true) => {
    setIsUserLoading(true);
    const res = await db.getUsersPaged({ pageSize: ITEMS_PER_PAGE, lastDoc: lastDoc });
    if (!res.error) {
        setUsers(res.users);
        setHasMoreUsers(res.hasMore);
        if (res.lastDoc && isNext) setUserLastDocs(prev => [...prev, res.lastDoc!]);
    }
    setIsUserLoading(false);
  };

  const handleNextUserPage = () => { if (!hasMoreUsers) return; const nextCursor = userLastDocs[userPage - 1]; setUserPage(p => p + 1); loadUsers(nextCursor, true); };
  const handlePrevUserPage = () => { if (userPage === 1) return; const prevCursor = (userPage - 1) === 1 ? null : userLastDocs[userPage - 3]; setUserPage(p => p - 1); loadUsers(prevCursor, false); };

  const handleResolveReport = async (reportId: string) => {
    const originalReports = [...reports];
    setReports(prev => prev.filter(r => r.id !== reportId));
    try { await db.resolveReport(reportId); showToast("✅ Đã xử lý báo cáo"); } 
    catch (error) { setReports(originalReports); showToast("Lỗi kết nối", "error"); }
  };

  const handleDeleteListingFromReport = async (reportId: string, listingId: string) => {
    setConfirmModal({
        show: true, title: "Xóa tin & Đóng báo cáo?", message: "Tin đăng sẽ bị xóa vĩnh viễn và báo cáo được đánh dấu đã xử lý.", type: 'danger',
        onConfirm: async () => {
            setConfirmModal(prev => ({ ...prev, show: false }));
            setReports(prev => prev.filter(r => r.id !== reportId));
            setListings(prev => prev.filter(l => l.id !== listingId));
            try { await db.deleteListing(listingId); await db.resolveReport(reportId); showToast("✅ Đã xóa tin và xử lý"); } 
            catch (error) { showToast("Lỗi khi xóa tin", "error"); loadInitialData(); }
        }
    });
  };

  const handleApproveListing = async (lId: string) => {
    setIsLoading(true);
    await db.updateListingStatus(lId, 'approved');
    showToast("✅ Đã duyệt tin đăng");
    setListings(prev => prev.map(l => l.id === lId ? { ...l, status: 'approved' } as Listing : l));
    if (listingStatusFilter === 'pending') setListings(prev => prev.filter(l => l.id !== lId));
    setIsLoading(false);
  };

  const handleRejectListing = async (lId: string) => {
    setConfirmModal({
      show: true, title: "Từ chối tin đăng", message: "Tin này sẽ bị từ chối và không hiển thị.", type: 'danger',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, show: false })); setIsLoading(true);
        await db.updateListingStatus(lId, 'rejected'); showToast("Đã từ chối tin.");
        setListings(prev => prev.map(l => l.id === lId ? { ...l, status: 'rejected' } as Listing : l));
        if (listingStatusFilter === 'pending') setListings(prev => prev.filter(l => l.id !== lId));
        setIsLoading(false);
      }
    });
  };

  const toggleSelectListing = (id: string) => { const newSet = new Set(selectedListings); if (newSet.has(id)) newSet.delete(id); else newSet.add(id); setSelectedListings(newSet); };
  const toggleSelectAll = () => { if (selectedListings.size === listings.length) setSelectedListings(new Set()); else setSelectedListings(new Set(listings.map(l => l.id))); };

  const handleBatchDelete = () => {
    if (selectedListings.size === 0) return;
    setConfirmModal({
        show: true, title: `Xóa vĩnh viễn ${selectedListings.size} tin?`, message: "Hành động này không thể hoàn tác!", type: 'danger',
        onConfirm: async () => {
            setConfirmModal(prev => ({...prev, show: false})); setIsLoading(true);
            const ids = Array.from(selectedListings);
            const res = await db.deleteListingsBatch(ids);
            if(res.success) { showToast(`Đã xóa ${ids.length} tin.`); setSelectedListings(new Set()); loadListings(listingPage === 1 ? null : listingLastDocs[listingPage - 2] || null, false); } 
            else { showToast("Lỗi xóa: " + res.error, "error"); }
            setIsLoading(false);
        }
    });
  };

  const openEditModal = (l: Listing) => { setEditForm({ title: l.title, price: l.price, status: l.status }); setEditModal({ show: true, listing: l }); };
  const saveListingChanges = async () => {
    if(!editModal.listing) return;
    setIsLoading(true);
    const res = await db.updateListingContent(editModal.listing.id, { title: editForm.title, price: Number(editForm.price), status: editForm.status as any });
    setIsLoading(false); setEditModal({ show: false, listing: null });
    if(res.success) { showToast("Cập nhật tin thành công"); setListings(prev => prev.map(item => item.id === editModal.listing!.id ? {...item, ...editForm} as Listing : item)); } 
    else { showToast("Lỗi cập nhật", "error"); }
  };

  const handleApprovePayment = (txId: string) => {
    setConfirmModal({
        show: true, title: "Duyệt giao dịch", message: "Tiền/Gói sẽ được cộng cho user ngay lập tức.", type: 'success',
        onConfirm: async () => {
            setConfirmModal(prev => ({...prev, show: false})); setIsLoading(true);
            const res = await db.approveTransaction(txId);
            if(res.success) { showToast("Giao dịch thành công!"); loadInitialData(); } else { showToast("Lỗi: " + res.message, "error"); setIsLoading(false); }
        }
    });
  };

  const handleRejectPayment = (txId: string) => {
    setConfirmModal({
        show: true, title: "Từ chối giao dịch", message: "Hủy yêu cầu này?", type: 'danger',
        onConfirm: async () => {
            setConfirmModal(prev => ({...prev, show: false})); setIsLoading(true);
            const res = await db.rejectTransaction(txId);
            if(res.success) { showToast("Đã từ chối."); loadInitialData(); } else { showToast("Lỗi: " + res.message, "error"); setIsLoading(false); }
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

  const handleSaveSettings = async (e: React.FormEvent) => {
      e.preventDefault(); setIsLoading(true);
      await db.updateSettings(settings);
      setIsLoading(false); showToast("Đã lưu cấu hình hệ thống!");
  };

  const handleDownloadSitemap = async () => {
    setIsLoading(true);
    try {
      const firestore = getFirestore();
      const qListings = collection(firestore, "listings");
      const snap = await getDocs(qListings);
      const allListings = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Listing));
      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n <url><loc>https://www.chocuatui.vn/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>\n <url><loc>https://www.chocuatui.vn/login</loc><priority>0.8</priority></url>\n <url><loc>https://www.chocuatui.vn/register</loc><priority>0.8</priority></url>\n <url><loc>https://www.chocuatui.vn/wallet</loc><priority>0.8</priority></url>`;
      allListings.forEach(l => {
        if (l.status === 'approved') {
            const date = l.createdAt ? new Date(l.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
            xml += `\n <url>\n  <loc>https://www.chocuatui.vn/listing/${l.id}</loc>\n  <lastmod>${date}</lastmod>\n  <changefreq>weekly</changefreq>\n  <priority>0.8</priority>\n </url>`;
        }
      });
      xml += `\n</urlset>`;
      const blob = new Blob([xml], { type: 'text/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'sitemap.xml'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      showToast("✅ Đã tạo xong Sitemap!");
    } catch (error) { showToast("Lỗi tạo sitemap", "error"); } finally { setIsLoading(false); }
  };

  const pendingPayments = useMemo(() => transactions.filter(t => t.status === 'pending'), [transactions]);
  const activeReports = useMemo(() => reports.filter(r => r.status === 'pending'), [reports]);
  const pendingVerifications = useMemo(() => users.filter(u => u.verificationStatus === 'pending'), [users]);
  const hasPendingListings = useMemo(() => listings.some(l => l.status === 'pending'), [listings]);

  if (!user || user.role !== 'admin' || !settings) return null;

  return (
    <div className="flex flex-col lg:flex-row gap-8 pb-24 relative min-h-screen">
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

      {/* KYC Modal & Edit Modal */}
      {verifyModal.show && verifyModal.user && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-white w-full max-w-3xl rounded-[2rem] p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black text-textMain">Duyệt KYC: <span className="text-primary">{verifyModal.user.name}</span></h3>
                    <button onClick={() => setVerifyModal({ show: false, user: null })} className="bg-gray-100 p-2 rounded-full hover:bg-gray-200">✕</button>
                </div>
                <div className="grid md:grid-cols-2 gap-4 mb-8">
                    <div className="space-y-2"><p className="text-[10px] font-black uppercase text-gray-400">Mặt trước</p><div className="aspect-video bg-gray-100 rounded-2xl overflow-hidden border border-gray-200">{verifyModal.user.verificationDocuments?.[0] ? <a href={verifyModal.user.verificationDocuments[0]} target="_blank"><img src={verifyModal.user.verificationDocuments[0]} className="w-full h-full object-contain" /></a> : <div className="flex items-center justify-center h-full text-gray-400">Không có ảnh</div>}</div></div>
                    <div className="space-y-2"><p className="text-[10px] font-black uppercase text-gray-400">Mặt sau</p><div className="aspect-video bg-gray-100 rounded-2xl overflow-hidden border border-gray-200">{verifyModal.user.verificationDocuments?.[1] ? <a href={verifyModal.user.verificationDocuments[1]} target="_blank"><img src={verifyModal.user.verificationDocuments[1]} className="w-full h-full object-contain" /></a> : <div className="flex items-center justify-center h-full text-gray-400">Không có ảnh</div>}</div></div>
                </div>
                <div className="flex gap-4">
                    <button onClick={() => handleProcessKyc(verifyModal.user!, 'rejected')} className="flex-1 py-4 bg-red-50 text-red-500 font-black rounded-2xl uppercase hover:bg-red-100">Từ chối</button>
                    <button onClick={() => handleProcessKyc(verifyModal.user!, 'verified')} className="flex-1 py-4 bg-green-500 text-white font-black rounded-2xl uppercase hover:bg-green-600 shadow-lg">Xác thực</button>
                </div>
            </div>
        </div>
      )}

      {editModal.show && editModal.listing && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <div className="bg-white p-8 rounded-[2.5rem] max-w-lg w-full animate-fade-in-up space-y-6">
                  <h3 className="text-xl font-black text-primary">Chỉnh sửa nhanh</h3>
                  <div className="space-y-4">
                      <div><label className="text-[10px] font-black uppercase text-gray-400">Tiêu đề</label><input type="text" value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})} className="w-full border border-gray-200 rounded-xl p-3 font-bold text-sm" /></div>
                      <div><label className="text-[10px] font-black uppercase text-gray-400">Giá</label><input type="number" value={editForm.price} onChange={e => setEditForm({...editForm, price: Number(e.target.value)})} className="w-full border border-gray-200 rounded-xl p-3 font-bold text-sm" /></div>
                      <div><label className="text-[10px] font-black uppercase text-gray-400">Trạng thái</label><select value={editForm.status} onChange={e => setEditForm({...editForm, status: e.target.value})} className="w-full border border-gray-200 rounded-xl p-3 font-bold text-sm"><option value="approved">Approved</option><option value="pending">Pending</option><option value="rejected">Rejected</option></select></div>
                  </div>
                  <div className="flex gap-3 pt-4"><button onClick={() => setEditModal({show: false, listing: null})} className="flex-1 py-3 bg-gray-100 rounded-xl font-bold text-xs uppercase">Đóng</button><button onClick={saveListingChanges} className="flex-1 py-3 bg-primary text-white rounded-xl font-bold text-xs uppercase shadow-lg">Lưu</button></div>
              </div>
          </div>
      )}

      <aside className="lg:w-72 flex-shrink-0">
         <div className="bg-white border border-borderMain rounded-[2.5rem] p-5 shadow-soft sticky top-24 space-y-6">
            <div className="px-4 py-2"><h2 className="text-xl font-black text-primary">Admin Console</h2></div>
            <nav className="space-y-1">
               {[
                   { id: 'stats', label: 'Bàn làm việc', icon: '📊', notify: false }, 
                   { id: 'payments', label: 'Duyệt tiền', icon: '💰', notify: pendingPayments.length > 0 }, 
                   { id: 'listings', label: 'Duyệt tin', icon: '📦', notify: hasPendingListings }, 
                   { id: 'categories', label: 'Danh mục', icon: '📂', notify: false }, // [MỚI] Tab Danh mục
                   { id: 'reports', label: 'Báo cáo', icon: '🚨', notify: activeReports.length > 0 }, 
                   { id: 'users', label: 'Thành viên', icon: '👥', notify: pendingVerifications.length > 0 }, 
                   { id: 'settings', label: 'Cấu hình', icon: '⚙️', notify: false }
               ].map(tab => (
                   <button key={tab.id} onClick={() => setActiveTab(tab.id as AdminTab)} className={`w-full flex items-center justify-between px-5 py-3.5 rounded-2xl text-[11px] font-black uppercase transition-all ${activeTab === tab.id ? 'bg-primary text-white shadow-lg' : 'text-gray-500 hover:bg-gray-50'}`}>
                      <div className="flex items-center gap-4"><span className="text-lg">{tab.icon}</span><span>{tab.label}</span></div>
                      <div className="flex items-center gap-2">{(['payments', 'reports'].includes(tab.id) && (tab as any).count > 0) && <span className="bg-red-500 text-white px-2.5 py-1 rounded-full text-[9px] font-black animate-pulse">{(tab as any).count}</span>}{tab.notify && <span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border border-white"></span></span>}</div>
                   </button>
               ))}
            </nav>
         </div>
      </aside>

      <div className="flex-1 min-w-0 space-y-6">
         {isLoading && <div className="fixed top-24 right-10 z-[60] bg-primary text-white text-[10px] font-black px-4 py-2 rounded-full animate-bounce shadow-xl uppercase">Đang xử lý...</div>}

         {activeTab === 'stats' && (
             <div className="space-y-8">
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[{ label: 'Doanh thu', value: formatPrice(transactions.filter(t => t.status === 'success' && t.type === 'payment').reduce((s, t) => s + t.amount, 0)), color: 'text-primary' }, { label: 'Chờ duyệt tiền', value: formatPrice(pendingPayments.reduce((s, t) => s + t.amount, 0)), color: 'text-yellow-600' }, { label: 'Tổng User', value: users.length, color: 'text-textMain' }, { label: 'Trạng thái', value: "Online", color: 'text-green-600' }].map((s, i) => (<div key={i} className="bg-white p-6 rounded-3xl border border-borderMain shadow-soft text-center space-y-1"><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{s.label}</p><p className={`text-xl font-black ${s.color}`}>{s.value}</p></div>))}</div>
                 <div className="bg-white border border-borderMain rounded-[2.5rem] p-8 shadow-soft"><h3 className="text-xl font-black mb-6">Giao dịch mới nhất</h3><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100"><th className="pb-4">Mô tả</th><th className="pb-4">Số tiền</th><th className="pb-4">Thời gian</th><th className="pb-4">Trạng thái</th></tr></thead><tbody className="divide-y divide-gray-50">{transactions.slice(0, 5).map(tx => (<tr key={tx.id}><td className="py-4 font-bold text-xs">{tx.description}</td><td className="py-4 font-black">{formatPrice(tx.amount)}</td><td className="py-4 text-gray-400 text-[10px]">{new Date(tx.createdAt).toLocaleString()}</td><td className="py-4"><span className={`text-[9px] px-2 py-1 rounded font-black uppercase ${tx.status === 'success' ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'}`}>{tx.status}</span></td></tr>))}</tbody></table></div></div>
             </div>
         )}

         {activeTab === 'payments' && (
             <div className="bg-white border border-borderMain rounded-[2.5rem] p-8 shadow-soft"><h3 className="text-xl font-black mb-8">Yêu cầu nạp tiền ({pendingPayments.length})</h3><div className="space-y-4">{pendingPayments.map(tx => (<div key={tx.id} className="border-2 border-gray-100 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 hover:border-primary transition-all"><div className="flex items-center gap-5 flex-1 min-w-0"><div className="w-14 h-14 bg-bgMain rounded-2xl flex items-center justify-center text-3xl shadow-inner">{tx.type === 'deposit' ? '💰' : '💎'}</div><div className="min-w-0"><div className="flex items-center gap-3"><p className="text-sm font-black text-textMain truncate">{tx.description}</p><span className="bg-primary/10 text-primary text-[10px] font-black px-2 py-0.5 rounded uppercase">{tx.type}</span></div><p className="text-[10px] font-bold text-gray-400 mt-1 uppercase">User ID: {tx.userId.slice(0,8)}... • {new Date(tx.createdAt).toLocaleString()}</p><p className="text-[9px] text-primary font-black mt-1 uppercase">SỐ TIỀN: {formatPrice(tx.amount)}</p></div></div><div className="flex gap-3"><button onClick={() => handleApprovePayment(tx.id)} className="bg-green-500 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase shadow-lg">Duyệt</button><button onClick={() => handleRejectPayment(tx.id)} className="bg-red-50 text-red-500 px-6 py-3 rounded-xl text-[10px] font-black uppercase">Từ chối</button></div></div>))}{pendingPayments.length === 0 && <div className="text-center py-20 text-gray-400 font-bold bg-bgMain rounded-3xl uppercase text-[10px] tracking-widest">Không có giao dịch chờ.</div>}</div></div>
         )}

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
                                <th className="pb-4 w-10">
                                    <input type="checkbox" onChange={toggleSelectAll} checked={selectedListings.size === listings.length && listings.length > 0} className="rounded text-primary focus:ring-primary" />
                                </th>
                                <th className="pb-4">Tin đăng</th>
                                <th className="pb-4">Loại tin</th>
                                <th className="pb-4">Người đăng</th>
                                <th className="pb-4">Trạng thái</th>
                                <th className="pb-4 text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {listings.map(l => (
                                <tr key={l.id} className="group hover:bg-gray-50 transition-colors">
                                    <td className="py-4">
                                        <input type="checkbox" checked={selectedListings.has(l.id)} onChange={() => toggleSelectListing(l.id)} className="rounded text-primary focus:ring-primary" />
                                    </td>
                                    <td className="py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="relative w-10 h-10 flex-shrink-0">
                                                <img src={l.images[0]} className="w-full h-full rounded-lg object-cover bg-gray-100" />
                                                {l.videoUrl && (
                                                    <div className="absolute -bottom-1 -right-1 bg-red-500 text-white w-4 h-4 flex items-center justify-center rounded-full text-[8px] border border-white z-10 shadow-sm" title="Có Video">
                                                        🎥
                                                    </div>
                                                )}
                                            </div>
                                            
                                            <div className="min-w-0 max-w-[200px]">
                                                <Link to={getListingUrl(l)} target="_blank" className="text-xs font-black truncate block hover:text-primary">
                                                    {l.title}
                                                </Link>
                                                <p className="text-[10px] text-primary font-bold">{formatPrice(l.price)}</p>
                                                {l.affiliateLink && (
                                                    <a href={l.affiliateLink} target="_blank" rel="noreferrer" className="text-[9px] text-blue-500 hover:underline flex items-center gap-1 mt-0.5">
                                                        <span>🔗 Link Gốc</span>
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-4">
                                        {l.affiliateLink ? (
                                            <span className="bg-orange-100 text-orange-600 px-2 py-1 rounded text-[9px] font-black uppercase border border-orange-200">
                                                Affiliate 💰
                                            </span>
                                        ) : (
                                            <span className="bg-gray-100 text-gray-500 px-2 py-1 rounded text-[9px] font-black uppercase border border-gray-200">
                                                Bán thường 📦
                                            </span>
                                        )}
                                    </td>
                                    <td className="py-4">
                                        <div className="flex items-center gap-2">
                                            <img src={l.sellerAvatar} className="w-6 h-6 rounded-full" />
                                            <span className="text-[10px] font-bold">{l.sellerName}</span>
                                        </div>
                                    </td>
                                    <td className="py-4">
                                        <span className={`text-[9px] px-2 py-1 rounded font-black uppercase ${l.status === 'approved' ? 'bg-green-100 text-green-600' : l.status === 'pending' ? 'bg-yellow-100 text-yellow-600' : 'bg-red-100 text-red-600'}`}>
                                            {l.status}
                                        </span>
                                    </td>
                                    <td className="py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            {l.status === 'pending' && (
                                                <>
                                                    <button onClick={() => handleApproveListing(l.id)} className="bg-green-500 text-white p-2 rounded-lg hover:shadow-lg">✅</button>
                                                    <button onClick={() => handleRejectListing(l.id)} className="bg-red-100 text-red-500 p-2 rounded-lg hover:bg-red-200">⛔</button>
                                                </>
                                            )}
                                            <button onClick={() => openEditModal(l)} className="text-blue-500 hover:bg-blue-50 p-2 rounded-lg">✏️</button>
                                            <button onClick={() => { setSelectedListings(new Set([l.id])); handleBatchDelete(); }} className="text-red-500 hover:bg-red-50 p-2 rounded-lg">🗑</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {listings.length === 0 && <div className="text-center py-10 text-gray-400 font-bold text-xs uppercase">Không tìm thấy tin nào.</div>}
                 </div>
                 
                 <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                     <p className="text-[10px] font-bold text-gray-400 uppercase">Trang {listingPage}</p>
                     <div className="flex gap-2">
                         <button onClick={handlePrevListingPage} disabled={listingPage === 1 || isLoading} className="px-4 py-2 rounded-lg border border-gray-200 text-xs font-bold uppercase hover:bg-gray-50 disabled:opacity-50">Trước</button>
                         <button onClick={handleNextListingPage} disabled={!hasMoreListings || isLoading} className="px-4 py-2 rounded-lg bg-primary text-white text-xs font-bold uppercase hover:bg-primaryHover disabled:opacity-50">Sau</button>
                     </div>
                 </div>
             </div>
         )}

         {/* [MỚI] TAB QUẢN LÝ DANH MỤC & TRƯỜNG DỮ LIỆU */}
         {activeTab === 'categories' && (
             <div className="bg-white border border-borderMain rounded-[2.5rem] p-8 shadow-soft flex flex-col h-[80vh]">
                 <div className="flex justify-between items-center mb-6">
                     <h3 className="text-xl font-black">Quản lý Danh mục ({categories.length})</h3>
                     <div className="flex gap-2">
                         <button onClick={async () => {
                             setIsLoading(true);
                             await seedCategoriesToFirebase();
                             db.getCategories().then(setCategories);
                             setIsLoading(false);
                         }} className="bg-gray-100 text-gray-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-gray-200 uppercase">
                             🔄 Nạp từ Code
                         </button>
                         <button 
                             onClick={() => setEditingCat({ id: '', name: '', icon: '', parentId: null, attributes: [] } as any)} 
                             className="bg-primary text-white px-4 py-2 rounded-xl text-xs font-black uppercase shadow-lg hover:bg-primaryHover"
                         >
                             + Tạo mới
                         </button>
                     </div>
                 </div>

                 <div className="flex gap-6 flex-1 min-h-0">
                     {/* CỘT TRÁI: DANH SÁCH (Tree View) */}
                     <div className="w-1/3 overflow-y-auto pr-2 space-y-2">
                         {categories.filter(c => !c.parentId).map(parent => (
                             <div key={parent.id} className="space-y-1">
                                 <div 
                                     onClick={() => setEditingCat(parent)}
                                     className={`p-3 rounded-xl border cursor-pointer flex justify-between items-center transition-all ${editingCat?.id === parent.id ? 'border-primary bg-blue-50 shadow-sm' : 'border-gray-100 hover:bg-gray-50'}`}
                                 >
                                     <span className="font-bold text-sm flex items-center gap-2">{parent.icon} {parent.name}</span>
                                     <span className="text-[9px] bg-gray-200 px-1.5 rounded text-gray-600 font-bold">{parent.attributes?.length || 0} fields</span>
                                 </div>
                                 {categories.filter(c => c.parentId === parent.id).map(child => (
                                     <div 
                                         key={child.id}
                                         onClick={() => setEditingCat(child)}
                                         className={`ml-6 p-2 rounded-lg border-l-2 border-gray-100 cursor-pointer flex justify-between items-center hover:bg-gray-50 ${editingCat?.id === child.id ? 'text-primary font-bold bg-blue-50/50' : 'text-gray-500 text-xs font-medium'}`}
                                     >
                                         <span>↳ {child.icon} {child.name}</span>
                                     </div>
                                 ))}
                             </div>
                         ))}
                     </div>

                     {/* CỘT PHẢI: FORM CHỈNH SỬA */}
                     <div className="w-2/3 bg-gray-50 rounded-3xl p-6 border border-gray-200 overflow-y-auto">
                         {editingCat ? (
                             <div className="space-y-6">
                                 <div className="flex justify-between items-center border-b border-gray-200 pb-4">
                                     <h4 className="font-black text-lg text-primary">{editingCat.id ? 'Chỉnh sửa' : 'Tạo mới'}</h4>
                                     {editingCat.id && <button onClick={async () => { if(window.confirm("Xóa danh mục này?")) { setIsLoading(true); await db.deleteCategory(editingCat.id); setCategories(prev => prev.filter(c => c.id !== editingCat.id)); setEditingCat(null); setIsLoading(false); }}} className="text-red-500 text-xs font-bold hover:bg-red-100 px-3 py-1.5 rounded-lg uppercase">Xóa bỏ</button>}
                                 </div>

                                 <div className="grid grid-cols-2 gap-4">
                                     <div><label className="text-[10px] font-black uppercase text-gray-400">Tên danh mục</label><input type="text" value={editingCat.name} onChange={e => setEditingCat({...editingCat, name: e.target.value})} className="w-full border border-gray-200 rounded-xl p-3 text-sm font-bold bg-white" /></div>
                                     <div><label className="text-[10px] font-black uppercase text-gray-400">Icon</label><input type="text" value={editingCat.icon} onChange={e => setEditingCat({...editingCat, icon: e.target.value})} className="w-full border border-gray-200 rounded-xl p-3 text-sm text-center bg-white" /></div>
                                     <div><label className="text-[10px] font-black uppercase text-gray-400">ID (Slug)</label><input type="text" value={editingCat.id} onChange={e => setEditingCat({...editingCat, id: e.target.value})} disabled={!!editingCat.id && categories.some(c => c.id === editingCat.id && c !== editingCat)} className="w-full border border-gray-200 rounded-xl p-3 text-sm font-mono bg-white disabled:bg-gray-100" placeholder="vd: xe-co" /></div>
                                     <div>
                                         <label className="text-[10px] font-black uppercase text-gray-400">Danh mục Cha</label>
                                         <select value={editingCat.parentId || ''} onChange={e => setEditingCat({...editingCat, parentId: e.target.value || null})} className="w-full border border-gray-200 rounded-xl p-3 text-sm font-bold bg-white">
                                             <option value="">-- Là danh mục gốc --</option>
                                             {categories.filter(c => !c.parentId && c.id !== editingCat.id).map(c => (
                                                 <option key={c.id} value={c.id}>{c.name}</option>
                                             ))}
                                         </select>
                                     </div>
                                 </div>

                                 <div className="bg-white p-4 rounded-2xl border border-blue-100 shadow-sm">
                                     <div className="flex justify-between items-center mb-4">
                                         <label className="text-[10px] font-black uppercase text-blue-500">Các trường nhập liệu đặc thù (Dynamic Fields)</label>
                                         <button 
                                             onClick={() => setEditingCat({
                                                 ...editingCat, 
                                                 attributes: [...(editingCat.attributes || []), { key: '', label: '', type: 'text' }]
                                             })}
                                             className="text-[9px] font-bold bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100 uppercase"
                                         >+ Thêm trường</button>
                                     </div>

                                     <div className="space-y-3">
                                         {(editingCat.attributes || []).map((attr, idx) => (
                                             <div key={idx} className="flex gap-2 items-start p-3 bg-gray-50 rounded-xl border border-gray-100 group hover:border-blue-200 transition-colors">
                                                 <div className="grid grid-cols-3 gap-2 flex-1">
                                                     <input type="text" placeholder="Tên hiển thị (VD: Số Km)" value={attr.label} onChange={e => { const attrs = [...(editingCat.attributes || [])]; attrs[idx].label = e.target.value; setEditingCat({...editingCat, attributes: attrs}); }} className="border border-gray-200 rounded-lg p-2 text-xs font-bold" />
                                                     <input type="text" placeholder="Key (VD: odo)" value={attr.key} onChange={e => { const attrs = [...(editingCat.attributes || [])]; attrs[idx].key = e.target.value; setEditingCat({...editingCat, attributes: attrs}); }} className="border border-gray-200 rounded-lg p-2 text-xs font-mono" />
                                                     <select value={attr.type} onChange={e => { const attrs = [...(editingCat.attributes || [])]; attrs[idx].type = e.target.value as any; setEditingCat({...editingCat, attributes: attrs}); }} className="border border-gray-200 rounded-lg p-2 text-xs">
                                                         <option value="text">Chữ (Text)</option>
                                                         <option value="number">Số (Number)</option>
                                                         <option value="select">Chọn (Select)</option>
                                                     </select>
                                                     {attr.type === 'select' && (
                                                         <input type="text" placeholder="Options (cách nhau dấu phẩy)" value={attr.options?.join(',') || ''} onChange={e => { const attrs = [...(editingCat.attributes || [])]; attrs[idx].options = e.target.value.split(','); setEditingCat({...editingCat, attributes: attrs}); }} className="col-span-3 border border-gray-200 rounded-lg p-2 text-xs bg-white" />
                                                     )}
                                                 </div>
                                                 <button onClick={() => { const attrs = editingCat.attributes?.filter((_, i) => i !== idx); setEditingCat({...editingCat, attributes: attrs}); }} className="p-2 text-gray-400 hover:text-red-500">✕</button>
                                             </div>
                                         ))}
                                         {(editingCat.attributes?.length === 0) && <p className="text-center text-[10px] text-gray-400 italic">Chưa có trường nào. Nhấn "+ Thêm trường" để tạo.</p>}
                                     </div>
                                 </div>

                                 <div className="flex gap-3 pt-4">
                                     <button onClick={() => setEditingCat(null)} className="flex-1 py-4 bg-white border border-gray-200 rounded-xl font-black uppercase text-xs hover:bg-gray-50">Hủy</button>
                                     <button 
                                         onClick={async () => {
                                             setIsLoading(true);
                                             const res = await db.saveCategory(editingCat);
                                             if (res.success) {
                                                 showToast("✅ Đã lưu danh mục!");
                                                 db.getCategories().then(setCategories); 
                                                 setEditingCat(null); 
                                             } else {
                                                 showToast("❌ Lỗi: " + res.message, "error");
                                             }
                                             setIsLoading(false);
                                         }}
                                         className="flex-1 py-4 bg-primary text-white rounded-xl font-black uppercase text-xs shadow-xl hover:scale-[1.01] transition-transform"
                                     >
                                         Lưu thay đổi
                                     </button>
                                 </div>
                             </div>
                         ) : (
                             <div className="h-full flex flex-col items-center justify-center text-gray-300">
                                 <span className="text-4xl mb-4">👈</span>
                                 <p className="text-xs font-bold uppercase">Chọn danh mục để sửa</p>
                                 <p className="text-[10px]">hoặc bấm nút "Tạo mới"</p>
                             </div>
                         )}
                     </div>
                 </div>
             </div>
         )}

         {activeTab === 'users' && (
             <div className="bg-white border border-borderMain rounded-[2.5rem] p-8 shadow-soft space-y-8">{pendingVerifications.length > 0 && (<div className="bg-yellow-50 border border-yellow-100 rounded-3xl p-6"><h3 className="text-lg font-black text-yellow-800 mb-4 flex items-center gap-2"><span className="animate-pulse">⚠️</span> Yêu cầu xác thực (Trang này)</h3><div className="grid md:grid-cols-2 gap-4">{pendingVerifications.map(u => (<div key={u.id} className="bg-white p-4 rounded-2xl flex items-center justify-between shadow-sm"><div className="flex items-center gap-3"><img src={u.avatar} className="w-10 h-10 rounded-full" /><div><p className="text-xs font-black">{u.name}</p><p className="text-[9px] text-gray-400">{u.email}</p></div></div><button onClick={() => setVerifyModal({ show: true, user: u })} className="bg-primary text-white text-[10px] font-black px-4 py-2 rounded-xl uppercase hover:scale-105 transition-transform">Xem hồ sơ</button></div>))}</div></div>)}<div className="flex justify-between items-center"><h3 className="text-xl font-black">Danh sách thành viên</h3>{isUserLoading && <span className="text-xs font-bold text-primary animate-pulse">Đang tải...</span>}</div><div className="overflow-x-auto"><table className="w-full text-left"><thead><tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100"><th className="pb-4">User</th><th className="pb-4">Xác thực</th><th className="pb-4">Ví</th><th className="pb-4">Thao tác</th></tr></thead><tbody className="divide-y divide-gray-50">{users.map(u => (<tr key={u.id} className={u.status === 'banned' ? 'opacity-50 grayscale' : ''}><td className="py-4"><div className="flex items-center gap-3"><img src={u.avatar} className="w-10 h-10 rounded-xl" /><div><p className="text-xs font-black">{u.name}</p><p className="text-[9px] text-gray-400">{u.email}</p></div></div></td><td className="py-4"><div className="flex items-center gap-2">{u.verificationStatus === 'verified' ? <span className="text-green-500 text-lg">✅</span> : u.verificationStatus === 'pending' ? <span className="text-yellow-500 text-lg animate-pulse">🕒</span> : <span className="text-gray-300 text-lg">⚪</span>}<button onClick={() => setVerifyModal({ show: true, user: u })} className={`text-[9px] font-black px-3 py-1.5 rounded-lg border ${u.verificationStatus === 'pending' ? 'bg-primary text-white' : 'bg-white text-gray-500'}`}>{u.verificationStatus === 'pending' ? 'DUYỆT' : 'HỒ SƠ'}</button></div></td><td className="py-4 text-xs font-black">{formatPrice(u.walletBalance || 0)}</td><td className="py-4"><button onClick={() => toggleUserStatus(u)} className={`text-[10px] font-black uppercase px-4 py-2 rounded-xl transition-all ${u.status === 'active' ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'}`}>{u.status === 'active' ? 'Khóa' : 'Mở'}</button></td></tr>))}</tbody></table>{users.length === 0 && !isUserLoading && <div className="text-center py-10 text-gray-400 font-bold text-xs uppercase">Không tìm thấy thành viên nào.</div>}</div><div className="flex justify-between items-center pt-4 border-t border-gray-100"><p className="text-[10px] font-bold text-gray-400 uppercase">Trang {userPage}</p><div className="flex gap-2"><button onClick={handlePrevUserPage} disabled={userPage === 1 || isUserLoading} className="px-4 py-2 rounded-lg border border-gray-200 text-xs font-bold uppercase hover:bg-gray-50 disabled:opacity-50">Trước</button><button onClick={handleNextUserPage} disabled={!hasMoreUsers || isUserLoading} className="px-4 py-2 rounded-lg bg-primary text-white text-xs font-bold uppercase hover:bg-primaryHover disabled:opacity-50">Sau</button></div></div></div>
         )}

         {activeTab === 'reports' && (
             <div className="bg-white border border-borderMain rounded-[2.5rem] p-8 shadow-soft"><h3 className="text-xl font-black mb-8">Báo cáo vi phạm ({activeReports.length})</h3><div className="space-y-4">{activeReports.map(r => (<div key={r.id} className="border-2 border-red-50 bg-red-50/10 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6"><div className="flex-1 space-y-2"><div className="flex items-center gap-3"><span className="bg-red-500 text-white text-[9px] font-black px-2 py-1 rounded uppercase">VI PHẠM</span><h4 className="text-sm font-black text-textMain">{r.reason}</h4></div><p className="text-xs text-gray-600">{r.details}</p><p className="text-[10px] text-gray-400 font-bold uppercase">ID Tin: {r.listingId}</p></div><div className="flex gap-2"><button onClick={() => handleResolveReport(r.id)} className="bg-green-500 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase shadow-lg hover:scale-105 transition-transform">Đánh dấu xử lý</button><button onClick={() => handleDeleteListingFromReport(r.id, r.listingId)} className="bg-red-500 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase shadow-lg hover:scale-105 transition-transform">Xóa tin</button></div></div>))}{activeReports.length === 0 && <div className="text-center py-20 text-gray-400 font-bold bg-bgMain rounded-3xl uppercase text-[10px] tracking-widest">Không có báo cáo.</div>}</div></div>
         )}

         {/* === TAB SETTINGS (QUẢN LÝ TẤT CẢ CẤU HÌNH HỆ THỐNG) === */}
          {activeTab === 'settings' && settings && (
              <div className="bg-white border border-borderMain rounded-[2.5rem] p-8 shadow-soft">
                  <form onSubmit={handleSaveSettings} className="space-y-12">
                    
                    {/* 1. Cấu hình Phí & Ưu đãi */}
                    <div className="space-y-6">
                       <h4 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
                           <span className="w-2 h-2 bg-primary rounded-full"></span> Quản lý Chiết khấu & Giá
                       </h4>
                       <div className="grid md:grid-cols-3 gap-6 bg-gray-50 p-6 rounded-[2rem]">
                           <div className="space-y-2">
                               <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Giá Đẩy Tin (đ)</label>
                               <input type="number" value={settings.pushPrice} onChange={e => setSettings({...settings, pushPrice: parseInt(e.target.value)})} className="w-full bg-white border border-gray-200 rounded-xl p-3 font-bold" />
                           </div>
                           <div className="space-y-2">
                               <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Giảm giá Đẩy Tin (%)</label>
                               <input type="number" value={settings.pushDiscount} onChange={e => setSettings({...settings, pushDiscount: parseInt(e.target.value)})} className="w-full bg-white border border-gray-200 rounded-xl p-3 font-bold text-red-500" />
                           </div>
                           <div className="space-y-2">
                               <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Giảm giá Gói VIP (%)</label>
                               <input type="number" value={settings.tierDiscount} onChange={e => setSettings({...settings, tierDiscount: parseInt(e.target.value)})} className="w-full bg-white border border-gray-200 rounded-xl p-3 font-bold text-red-500" />
                           </div>
                       </div>
                    </div>

                    {/* 2. Quản lý Banner */}
                    <div className="space-y-6 pt-6 border-t border-gray-100">
                        <div className="flex items-center justify-between">
                             <h4 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                  <span className="w-2 h-2 bg-orange-500 rounded-full"></span> Quản lý Banner Slide
                             </h4>
                             <button 
                                 type="button"
                                 onClick={() => {
                                     const newSlide = { id: Date.now(), type: 'text', title: 'Slide Mới', desc: 'Mô tả...', btnText: 'Xem', btnLink: '/', colorFrom: 'from-blue-600', colorTo: 'to-indigo-600', icon: '⚡', isActive: true };
                                     setSettings({...settings, bannerSlides: [...(settings.bannerSlides || []), newSlide]});
                                 }}
                                 className="bg-primary/10 text-primary px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-primary/20 transition-colors"
                             >
                                 + Thêm Slide
                             </button>
                        </div>

                        <div className="space-y-6">
                            {(settings.bannerSlides || []).map((slide: any, idx: number) => (
                               <div key={idx} className={`border p-6 rounded-[2rem] space-y-4 transition-all ${slide.isActive ? 'bg-white border-gray-200 shadow-sm' : 'bg-gray-50 border-gray-100 opacity-60'}`}>
                                   <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                                        <div className="flex items-center gap-3">
                                            <span className="bg-gray-100 text-gray-500 text-[10px] font-black px-2 py-1 rounded">#{idx + 1}</span>
                                            <div className="flex items-center bg-gray-50 rounded-lg p-0.5 border border-gray-100">
                                                 <button type="button" disabled={idx === 0} onClick={() => {
                                                     const slides = [...(settings.bannerSlides || [])];
                                                     [slides[idx], slides[idx - 1]] = [slides[idx - 1], slides[idx]];
                                                     setSettings({...settings, bannerSlides: slides});
                                                 }} className={`p-1.5 rounded ${idx === 0 ? 'text-gray-300' : 'text-gray-600 hover:bg-white shadow-sm'}`}>⬆️</button>
                                                 <button type="button" disabled={idx === (settings.bannerSlides?.length || 0) - 1} onClick={() => {
                                                     const slides = [...(settings.bannerSlides || [])];
                                                     [slides[idx], slides[idx + 1]] = [slides[idx + 1], slides[idx]];
                                                     setSettings({...settings, bannerSlides: slides});
                                                 }} className={`p-1.5 rounded ${idx === (settings.bannerSlides?.length || 0) - 1 ? 'text-gray-300' : 'text-gray-600 hover:bg-white shadow-sm'}`}>⬇️</button>
                                            </div>
                                            <select value={slide.type || 'text'} onChange={e => {
                                                 const newSlides = [...(settings.bannerSlides || [])];
                                                 newSlides[idx].type = e.target.value;
                                                 setSettings({...settings, bannerSlides: newSlides});
                                            }} className="bg-gray-50 border-none text-[10px] font-black rounded-lg py-1 px-2 focus:ring-0">
                                                 <option value="text">Dạng Chữ</option>
                                                 <option value="image">Dạng Ảnh</option>
                                            </select>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <label className="flex items-center cursor-pointer gap-2">
                                                <span className="text-[9px] font-black text-gray-400 uppercase">{slide.isActive ? 'Hiển thị' : 'Ẩn'}</span>
                                                <input type="checkbox" className="hidden" checked={slide.isActive} onChange={e => {
                                                     const newSlides = [...(settings.bannerSlides || [])];
                                                     newSlides[idx].isActive = e.target.checked;
                                                     setSettings({...settings, bannerSlides: newSlides});
                                                }} />
                                                <div className={`w-8 h-4 rounded-full relative transition-colors ${slide.isActive ? 'bg-green-500' : 'bg-gray-300'}`}>
                                                     <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${slide.isActive ? 'translate-x-4' : ''}`}></div>
                                                </div>
                                            </label>
                                            <button type="button" onClick={() => {if(window.confirm("Xóa slide này?")){const ns = settings.bannerSlides.filter((_:any, i:number) => i !== idx); setSettings({...settings, bannerSlides: ns});}}} className="text-red-400 hover:text-red-600 bg-red-50 p-1.5 rounded-lg">🗑</button>
                                        </div>
                                   </div>

                                   {slide.type === 'image' ? (
                                       <div className="flex gap-4 items-start">
                                            <div className="w-1/3 aspect-[3/1] bg-gray-100 rounded-2xl overflow-hidden border border-gray-200 relative group">
                                                 {slide.imageUrl ? <img src={slide.imageUrl} className="w-full h-full object-cover" /> : <div className="flex items-center justify-center h-full text-[10px] text-gray-400 font-bold uppercase">Chưa có ảnh</div>}
                                                 <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity text-white text-[10px] font-black">TẢI ẢNH<input type="file" className="hidden" accept="image/*" onChange={async (e) => {
                                                     if(e.target.files?.[0]) {
                                                         setIsLoading(true);
                                                         try {
                                                             const compressed = await compressAndGetBase64(e.target.files[0]);
                                                             const url = await db.uploadImage(compressed, `banners/${Date.now()}.jpg`);
                                                             const ns = [...settings.bannerSlides];
                                                             ns[idx].imageUrl = url;
                                                             setSettings({...settings, bannerSlides: ns});
                                                         } catch (err) { alert("Lỗi tải ảnh"); }
                                                         setIsLoading(false);
                                                     }
                                                 }} /></label>
                                            </div>
                                            <input type="text" placeholder="Link (Ví dụ: /post)" value={slide.btnLink} onChange={e => {const ns=[...settings.bannerSlides]; ns[idx].btnLink=e.target.value; setSettings({...settings, bannerSlides: ns})}} className="flex-1 bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs font-bold" />
                                       </div>
                                   ) : (
                                       <div className="space-y-3">
                                            <div className="grid md:grid-cols-2 gap-3">
                                                 <input type="text" placeholder="Tiêu đề chính" value={slide.title} onChange={e => {const ns=[...settings.bannerSlides]; ns[idx].title=e.target.value; setSettings({...settings, bannerSlides: ns})}} className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs font-black" />
                                                 <input type="text" placeholder="Mô tả" value={slide.desc} onChange={e => {const ns=[...settings.bannerSlides]; ns[idx].desc=e.target.value; setSettings({...settings, bannerSlides: ns})}} className="w-full bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs font-bold" />
                                            </div>
                                            <div className="grid grid-cols-3 gap-3">
                                                 <input type="text" placeholder="Chữ trên nút" value={slide.btnText} onChange={e => {const ns=[...settings.bannerSlides]; ns[idx].btnText=e.target.value; setSettings({...settings, bannerSlides: ns})}} className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs font-black text-center" />
                                                 <input type="text" placeholder="Link đích" value={slide.btnLink} onChange={e => {const ns=[...settings.bannerSlides]; ns[idx].btnLink=e.target.value; setSettings({...settings, bannerSlides: ns})}} className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs font-bold" />
                                                 <input type="text" placeholder="Icon (VD: 🚀)" value={slide.icon} onChange={e => {const ns=[...settings.bannerSlides]; ns[idx].icon=e.target.value; setSettings({...settings, bannerSlides: ns})}} className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs text-center" />
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                 <select value={slide.colorFrom} onChange={e => {const ns=[...settings.bannerSlides]; ns[idx].colorFrom=e.target.value; setSettings({...settings, bannerSlides: ns})}} className="border border-gray-200 rounded-xl p-3 text-xs font-bold">
                                                     <option value="from-blue-600">Xanh Dương (Đậm)</option>
                                                     <option value="from-red-600">Đỏ (Đậm)</option>
                                                     <option value="from-green-600">Xanh Lá (Đậm)</option>
                                                     <option value="from-yellow-500">Vàng (Đậm)</option>
                                                     <option value="from-purple-600">Tím (Đậm)</option>
                                                     <option value="from-orange-500">Cam (Đậm)</option>
                                                     <option value="from-pink-500">Hồng (Đậm)</option>
                                                     <option value="from-gray-800">Đen</option>
                                                 </select>
                                                 <select value={slide.colorTo} onChange={e => {const ns=[...settings.bannerSlides]; ns[idx].colorTo=e.target.value; setSettings({...settings, bannerSlides: ns})}} className="border border-gray-200 rounded-xl p-3 text-xs font-bold">
                                                     <option value="to-indigo-600">Indigo</option>
                                                     <option value="to-blue-400">Xanh Nhạt</option>
                                                     <option value="to-red-400">Đỏ Nhạt</option>
                                                     <option value="to-green-400">Lá Nhạt</option>
                                                     <option value="to-yellow-400">Vàng Nhạt</option>
                                                     <option value="to-purple-400">Tím Nhạt</option>
                                                     <option value="to-pink-400">Hồng Nhạt</option>
                                                     <option value="to-orange-400">Cam Nhạt</option>
                                                 </select>
                                            </div>
                                       </div>
                                   )}
                               </div>
                            ))}
                        </div>
                    </div>

                    {/* 3. Cấu hình các Gói Thành Viên */}
                    <div className="space-y-6 pt-6 border-t border-gray-100">
                        <h4 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
                            <span className="w-2 h-2 bg-primary rounded-full"></span> Đặc quyền & Hạn mức Gói
                        </h4>
                        <div className="grid lg:grid-cols-3 gap-6">
                            {(['free', 'basic', 'pro'] as const).map((tierKey) => (
                                <div key={tierKey} className={`p-6 rounded-[2.5rem] border-2 space-y-5 transition-all ${tierKey === 'pro' ? 'border-yellow-400 bg-yellow-50/20' : tierKey === 'basic' ? 'border-blue-200 bg-blue-50/10' : 'border-gray-100 bg-gray-50/30'}`}>
                                    
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-gray-400 uppercase ml-1">Tên gói hiển thị</label>
                                        <input type="text" value={(settings.tierConfigs as any)[tierKey].name} onChange={e => {
                                            const newConfigs = { ...settings.tierConfigs };
                                            (newConfigs as any)[tierKey].name = e.target.value;
                                            setSettings({...settings, tierConfigs: newConfigs});
                                        }} className="w-full bg-white border border-gray-100 rounded-xl p-3 text-xs font-black uppercase" />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-gray-400 uppercase ml-1">Giá (VNĐ)</label>
                                            <input type="number" value={(settings.tierConfigs as any)[tierKey].price} onChange={e => {
                                                const newConfigs = { ...settings.tierConfigs };
                                                (newConfigs as any)[tierKey].price = parseInt(e.target.value);
                                                setSettings({...settings, tierConfigs: newConfigs});
                                            }} className="w-full bg-white border border-gray-100 rounded-xl p-2.5 text-xs font-black" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-gray-400 uppercase ml-1">Ảnh tối đa</label>
                                            <input type="number" value={(settings.tierConfigs as any)[tierKey].maxImages} onChange={e => {
                                                const newConfigs = { ...settings.tierConfigs };
                                                (newConfigs as any)[tierKey].maxImages = parseInt(e.target.value);
                                                setSettings({...settings, tierConfigs: newConfigs});
                                            }} className="w-full bg-white border border-gray-100 rounded-xl p-2.5 text-xs font-black" />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-gray-400 uppercase ml-1">Tin/ngày</label>
                                            <input type="number" value={(settings.tierConfigs as any)[tierKey].postsPerDay || 0} onChange={e => {
                                                const newConfigs = { ...settings.tierConfigs };
                                                (newConfigs as any)[tierKey].postsPerDay = parseInt(e.target.value);
                                                setSettings({...settings, tierConfigs: newConfigs});
                                            }} className="w-full bg-white border border-gray-100 rounded-xl p-2.5 text-xs font-black text-primary" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-gray-400 uppercase ml-1">Quyền Đăng Video</label>
                                            <select 
                                                value={(settings.tierConfigs as any)[tierKey].allowVideo ? "true" : "false"}
                                                onChange={e => {
                                                    const newConfigs = { ...settings.tierConfigs };
                                                    (newConfigs as any)[tierKey].allowVideo = e.target.value === "true";
                                                    setSettings({...settings, tierConfigs: newConfigs});
                                                }}
                                                className={`w-full border rounded-xl p-2.5 text-[10px] font-black uppercase transition-colors ${(settings.tierConfigs as any)[tierKey].allowVideo ? 'bg-green-50 border-green-200 text-green-600' : 'bg-white border-gray-100 text-gray-400'}`}
                                            >
                                                <option value="false">❌ KHÓA</option>
                                                <option value="true">✅ MỞ</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-gray-400 uppercase ml-1">Chế độ kiểm duyệt</label>
                                        <select 
                                            value={(settings.tierConfigs as any)[tierKey].autoApprove ? "true" : "false"}
                                            onChange={e => {
                                                const newConfigs = { ...settings.tierConfigs };
                                                (newConfigs as any)[tierKey].autoApprove = e.target.value === "true";
                                                setSettings({...settings, tierConfigs: newConfigs});
                                            }}
                                            className="w-full bg-white border border-gray-100 rounded-xl p-2.5 text-[10px] font-black uppercase"
                                        >
                                            <option value="false">⏳ Phải duyệt tay</option>
                                            <option value="true">🚀 Duyệt tự động</option>
                                        </select>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-gray-400 uppercase ml-1">Tính năng (Mỗi dòng 1 ý)</label>
                                        <textarea rows={3} value={(settings.tierConfigs as any)[tierKey].features.join('\n')} onChange={e => {
                                            const newConfigs = { ...settings.tierConfigs };
                                            (newConfigs as any)[tierKey].features = e.target.value.split('\n');
                                            setSettings({...settings, tierConfigs: newConfigs});
                                        }} className="w-full bg-white border border-gray-100 rounded-xl p-3 text-[11px] font-medium leading-relaxed" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 4. Cấu hình Ngân hàng */}
                    <div className="space-y-6 pt-6 border-t border-gray-100">
                        <h4 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
                            <span className="w-2 h-2 bg-primary rounded-full"></span> Ngân hàng VietQR
                        </h4>
                        <div className="grid md:grid-cols-2 gap-10">
                            <div className="space-y-4">
                                <div><label className="text-[10px] font-black uppercase text-gray-400 pl-1">Mã Ngân Hàng (VD: MB, VCB...)</label><input type="text" value={settings.bankName} onChange={e => setSettings({...settings, bankName: e.target.value.toUpperCase()})} className="w-full bg-bgMain border border-borderMain rounded-2xl p-4 font-bold" /></div>
                                <div><label className="text-[10px] font-black uppercase text-gray-400 pl-1">Số Tài Khoản</label><input type="text" value={settings.accountNumber} onChange={e => setSettings({...settings, accountNumber: e.target.value})} className="w-full bg-bgMain border border-borderMain rounded-2xl p-4 font-bold" /></div>
                                <div><label className="text-[10px] font-black uppercase text-gray-400 pl-1">Tên Chủ Tài Khoản</label><input type="text" value={settings.accountName} onChange={e => setSettings({...settings, accountName: e.target.value.toUpperCase()})} className="w-full bg-bgMain border border-borderMain rounded-2xl p-4 font-bold" /></div>
                            </div>
                            <div className="flex flex-col items-center justify-center bg-gray-50 rounded-[2.5rem] p-6 border border-dashed border-gray-200">
                                <p className="text-[10px] font-black uppercase text-gray-400 mb-4">Xem trước mã QR nạp tiền</p>
                                {settings.bankName && settings.accountNumber ? (
                                    <img src={`https://img.vietqr.io/image/${settings.bankName}-${settings.accountNumber}-compact.jpg?accountName=${encodeURI(settings.accountName)}`} className="w-48 h-48 object-contain rounded-2xl shadow-lg border-4 border-white" />
                                ) : (
                                    <div className="w-48 h-48 bg-white rounded-2xl flex items-center justify-center text-[10px] text-gray-300 font-bold uppercase p-4 text-center">Vui lòng nhập đủ thông tin ngân hàng</div>
                                )}
                            </div>
                        </div>
                    </div>

                  {/* 5. SEO & Công cụ */}
                    <div className="space-y-6 pt-6 border-t border-gray-100">
                        <h4 className="text-sm font-black uppercase tracking-widest text-gray-800 flex items-center gap-2">
                            <span className="w-2 h-2 bg-gray-800 rounded-full"></span> Công cụ Developer
                        </h4>
                        
                        {/* --- BẮT ĐẦU GRID --- */}
                        <div className="grid md:grid-cols-2 gap-6">
                            
                            {/* Cột 1: Dữ liệu hệ thống (Đỏ) */}
                            <div className="bg-red-50 p-6 rounded-3xl border border-red-100">
                                <h5 className="font-black text-sm text-red-700">Dữ liệu hệ thống</h5>
                                <p className="text-[11px] text-red-600/70 mb-4 font-medium">Quản lý dữ liệu mẫu để test ứng dụng.</p>
                                
                                <div className="flex flex-col gap-3">
                                    {/* Nút Reset & Seed */}
                                    <button 
                                        type="button" 
                                        onClick={async () => {
                                            if(window.confirm("CẢNH BÁO: Hành động này sẽ xóa dữ liệu cũ và TẠO MỚI 100 tin mẫu. Tiếp tục?")){
                                                setIsLoading(true); 
                                                await db.seedDatabase(); 
                                                setIsLoading(false); 
                                                loadInitialData();
                                                showToast("Đã Reset và tạo dữ liệu mẫu!");
                                            }
                                        }} 
                                        className="bg-red-500 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-red-200 hover:bg-red-600 transition-colors"
                                    >
                                        🔄 Reset & Tạo Sample
                                    </button>

                                    {/* Nút Xóa sạch (Mới) */}
                                    <button 
                                        type="button" 
                                        onClick={async () => {
                                            if(window.confirm("NGUY HIỂM: Hành động này sẽ XÓA SẠCH toàn bộ dữ liệu và KHÔNG tạo lại. Web sẽ trắng trơn. Bạn chắc chắn chứ?")){
                                                setIsLoading(true); 
                                                await db.clearDatabase(); 
                                                setIsLoading(false); 
                                                loadInitialData();
                                                showToast("🗑 Đã xóa sạch trơn dữ liệu!");
                                            }
                                        }} 
                                        className="bg-white border-2 border-red-200 text-red-500 px-6 py-3 rounded-xl text-[10px] font-black uppercase hover:bg-red-50 transition-colors"
                                    >
                                        🗑 Xóa sạch (Về 0)
                                    </button>
                                </div>
                            </div>

                            {/* Cột 2: Sitemap SEO (Xanh) */}
                            <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100">
                                <h5 className="font-black text-sm text-blue-700">Sitemap SEO</h5>
                                <p className="text-[11px] text-blue-600/70 mb-4 font-medium">Tạo file sitemap.xml chứa toàn bộ link sản phẩm cho Google.</p>
                                <button type="button" onClick={handleDownloadSitemap} className="bg-blue-600 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-blue-200 w-full">Tải Sitemap.xml</button>
                            </div>

                        </div> {/* --- KẾT THÚC GRID --- */}
                    </div>

                    {/* --- NÚT LƯU CẤU HÌNH (QUAN TRỌNG: PHẢI CÓ) --- */}
                    <button type="submit" disabled={isLoading} className="w-full bg-primary text-white font-black py-5 rounded-[2rem] shadow-2xl shadow-primary/30 hover:scale-[1.01] active:scale-95 transition-all uppercase tracking-widest text-xs">
                        {isLoading ? 'Đang lưu hệ thống...' : 'Lưu tất cả cấu hình'}
                    </button>
                  </form>
              </div>
          )}
      </div>
    </div>
  );
};

export default Admin;
