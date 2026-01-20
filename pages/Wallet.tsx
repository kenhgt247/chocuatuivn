import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, SystemSettings } from '../services/db';
import { User, Transaction } from '../types';
import { formatPrice } from '../utils/format';

// ============================================================================
// 1. KHAI BÁO ICON TRỰC TIẾP (AN TOÀN TUYỆT ĐỐI - KHÔNG SỢ LỖI IMPORT)
// ============================================================================
const IconWallet = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/><path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z"/></svg>;
const IconCreditCard = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>;
const IconRotateCcw = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>;
const IconBanknote = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>;
const IconHistory = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>;
const IconArrowDown = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>;
const IconArrowUp = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>;
const IconClock = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
const IconX = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 18 18"/></svg>;
const IconCopy = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>;
const IconCheck = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const IconLoader = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>;
const IconCheckCircle = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;
const IconUser = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;

// ============================================================================

const PRESET_AMOUNTS = [50000, 100000, 200000, 500000, 1000000, 2000000];

// --- Helper Functions ---
const generateRefCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 4; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return result;
};

const removeVietnameseTones = (str: string) => {
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g,"a").replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g,"e").replace(/ì|í|ị|ỉ|ĩ/g,"i").replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g,"o").replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g,"u").replace(/ỳ|ý|ỵ|ỷ|ỹ/g,"y").replace(/đ/g,"d");
    str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A").replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E").replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I").replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O").replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U").replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y").replace(/Đ/g, "D");
    return str.toUpperCase();
}

const Wallet: React.FC<{ user: User | null; onUpdateUser: (u: User) => void }> = ({ user }) => {
  const navigate = useNavigate();
  const [amount, setAmount] = useState<string>('100000'); 
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentRefCode, setCurrentRefCode] = useState<string>("");

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    
    // Chỉ tải dữ liệu, không gọi onUpdateUser để tránh vòng lặp
    const loadData = async () => {
      try {
        const [s, txs] = await Promise.all([db.getSettings(), db.getTransactions(user.id)]);
        setSettings(s);
        setTransactions(txs);
      } catch (error) { console.error(error); }
    };

    loadData();
    // Refresh nhẹ nhàng mỗi 5s
    const interval = setInterval(loadData, 5000); 
    return () => clearInterval(interval);
  }, [user?.id, navigate]); 

  if (!user) return null;

  // Handlers
  const handleSelectPreset = (value: number) => setAmount(value.toString());
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => setAmount(e.target.value.replace(/\D/g, ''));
  
  const handleShowQR = () => {
    if (!parseInt(amount) || parseInt(amount) < 10000) return alert("Tối thiểu 10.000đ");
    setCurrentRefCode(generateRefCode());
    setShowQRModal(true);
  };

  const sanitizedName = removeVietnameseTones(user.name).replace(/[^A-Z0-9 ]/g, ''); 
  const transferContent = `NAP ${currentRefCode} ${sanitizedName}`.substring(0, 50);

  const handleConfirmTransfer = async () => {
    setIsProcessing(true);
    try {
        await db.requestDeposit(user.id, parseInt(amount), transferContent);
        setTransactions(await db.getTransactions(user.id));
        setShowQRModal(false); 
        alert(`✅ Đã gửi lệnh. Chờ duyệt.`);
    } catch (e) { alert("Lỗi"); } 
    finally { setIsProcessing(false); }
  };

  const getVietQRUrl = () => {
    if (!settings?.bankName || !settings?.accountNumber) return '';
    return `https://img.vietqr.io/image/${settings.bankName}-${settings.accountNumber}-compact2.png?amount=${amount}&addInfo=${encodeURI(transferContent)}&accountName=${encodeURI(settings.accountName || '')}`;
  };

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleManualRefresh = async () => {
      setIsRefreshing(true);
      const txs = await db.getTransactions(user.id);
      setTransactions(txs);
      setTimeout(() => setIsRefreshing(false), 800);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-5 pb-24 px-3 md:px-4 font-sans animate-fade-in pt-4">
      {/* Thẻ Ví */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[1.5rem] p-5 md:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col justify-between h-full gap-6">
          <div className="flex justify-between items-start">
             <div> 
                <p className="text-blue-100 text-[10px] font-black uppercase tracking-widest mb-1 flex items-center gap-2">
                    <IconWallet /> Số dư khả dụng
                </p>
                <div className="flex items-center gap-2">
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tighter">{formatPrice(user.walletBalance || 0)}</h2>
                    {/* Nút Refresh */}
                    <button onClick={handleManualRefresh} className={`p-1.5 bg-white/10 rounded-full hover:bg-white/20 transition-all ${isRefreshing ? 'animate-spin' : ''}`}>
                        <IconRotateCcw className="w-4 h-4 text-white" />
                    </button>
                </div>
             </div>
             <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10"><IconCreditCard /></div>
          </div>
          <div className="pt-4 border-t border-white/10 flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center border border-white/30">{user.avatar ? <img src={user.avatar} className="w-full h-full rounded-full object-cover" /> : <IconUser />}</div>
             <div><p className="font-bold text-sm uppercase">{user.name}</p><p className="text-[10px] opacity-70 font-mono">ID: {user.id.slice(-8).toUpperCase()}</p></div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-5 md:gap-8">
        {/* Nạp tiền */}
        <div className="lg:col-span-3 space-y-5">
          <div className="bg-white border border-gray-100 rounded-[1.5rem] p-5 shadow-sm">
            <h3 className="font-black text-sm mb-5 flex items-center gap-2 uppercase text-slate-800">
                <span className="w-8 h-8 bg-green-50 text-green-600 rounded-lg flex items-center justify-center"><IconBanknote /></span> Nạp tiền nhanh
            </h3>
            <div className="mb-5 relative">
                <input type="text" value={amount ? parseInt(amount).toLocaleString('vi-VN') : ''} onChange={handleAmountChange} className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl pt-6 pb-2 px-4 font-black text-lg text-primary outline-none focus:border-primary" />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 mt-2 font-bold text-gray-400 text-xs">VNĐ</span>
                <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest absolute top-2 left-4">Số tiền nạp</label>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-6">{PRESET_AMOUNTS.map(a => (<button key={a} onClick={() => handleSelectPreset(a)} className={`py-3 rounded-xl border-2 font-black text-[10px] ${parseInt(amount) === a ? 'border-primary bg-primary/5 text-primary' : 'border-gray-50 bg-white text-gray-400'}`}>{a/1000}k</button>))}</div>
            <button onClick={handleShowQR} disabled={!settings?.bankName || !amount} className="w-full bg-primary text-white font-black py-4 rounded-xl shadow-xl flex items-center justify-center gap-2 uppercase text-xs hover:bg-primaryHover disabled:opacity-50">
                <IconBanknote /> Tạo mã thanh toán
            </button>
          </div>
        </div>

        {/* Lịch sử */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-gray-100 rounded-[1.5rem] p-5 shadow-sm h-[400px] flex flex-col">
            <h3 className="font-black text-sm mb-4 flex items-center gap-2 uppercase text-slate-800"><span className="w-8 h-8 bg-orange-50 text-orange-600 rounded-lg flex items-center justify-center"><IconHistory /></span> Giao dịch gần đây</h3>
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-hide">
              {transactions.length > 0 ? transactions.map(tx => (
                <div key={tx.id} className="flex items-center justify-between p-3 bg-gray-50/30 border border-gray-100 rounded-xl">
                  <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${tx.type === 'deposit' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                          {tx.type === 'deposit' ? <IconArrowDown /> : <IconArrowUp />}
                      </div>
                      <div>
                          <p className="text-[10px] font-black uppercase text-slate-700">{tx.type === 'deposit' ? 'Nạp tiền' : 'Thanh toán'}</p>
                          <p className="text-[9px] text-gray-400 font-bold">{new Date(tx.createdAt).toLocaleDateString('vi-VN')}</p>
                      </div>
                  </div>
                  <div className="text-right">
                      <p className={`text-xs font-black ${tx.type === 'deposit' ? 'text-green-600' : 'text-red-600'}`}>
                          {tx.type === 'deposit' ? '+' : '-'}{formatPrice(tx.amount)}
                      </p>
                      <span className={`text-[8px] px-1.5 py-0.5 rounded-md font-black uppercase ${tx.status === 'pending' ? 'bg-yellow-100 text-yellow-600' : tx.status === 'success' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                          {tx.status === 'pending' ? 'Đang duyệt' : tx.status === 'success' ? 'Thành công' : 'Thất bại'}
                      </span>
                  </div>
                </div>
              )) : <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-3 opacity-60"><IconHistory /><p className="text-[10px] font-black uppercase">Trống</p></div>}
            </div>
          </div>
        </div>
      </div>

      {/* Modal QR */}
      {showQRModal && settings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setShowQRModal(false)}>
          <div className="bg-white w-full max-w-sm rounded-[2rem] overflow-hidden shadow-2xl relative" onClick={e => e.stopPropagation()}>
            <div className="bg-primary px-6 py-4 text-white text-center relative">
                <h3 className="font-black uppercase">Thanh toán</h3>
                <button onClick={() => setShowQRModal(false)} className="absolute top-1/2 -translate-y-1/2 right-4"><IconX /></button>
            </div>
            <div className="p-5 space-y-5">
                <div className="flex justify-center"><img src={getVietQRUrl()} className="w-[200px] h-[200px] object-contain border-2 border-dashed border-primary/30 rounded-xl" /></div>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-3">
                    <div className="flex justify-between text-xs"><span className="font-bold text-gray-400">STK:</span> <span className="font-black">{settings.accountNumber}</span></div>
                    <div className="flex justify-between text-xs"><span className="font-bold text-gray-400">Nội dung:</span> <span className="font-black text-red-500">{transferContent}</span></div>
                    <div className="flex justify-between text-xs"><span className="font-bold text-gray-400">Số tiền:</span> <span className="font-black text-primary">{formatPrice(parseInt(amount))}</span></div>
                </div>
                <button onClick={handleConfirmTransfer} disabled={isProcessing} className="w-full bg-slate-900 text-white font-black py-4 rounded-xl shadow-xl uppercase text-xs flex items-center justify-center gap-2">
                    {isProcessing ? <IconLoader className="w-4 h-4 animate-spin" /> : <IconCheckCircle />} Tôi đã chuyển khoản
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Wallet;
