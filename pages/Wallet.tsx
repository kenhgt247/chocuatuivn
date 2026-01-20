import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, SystemSettings } from '../services/db';
import { User, Transaction } from '../types';
import { formatPrice } from '../utils/format';

// --- IMPORT ICON VECTOR ---
import { 
  Wallet as WalletIcon, QrCode, CreditCard, Copy, Check, 
  Clock, XCircle, ArrowUpRight, ArrowDownLeft, Loader2, 
  Banknote, History, CheckCircle, RefreshCw, User as UserIcon
} from 'lucide-react';

const PRESET_AMOUNTS = [50000, 100000, 200000, 500000, 1000000, 2000000];

// Hàm sinh mã giao dịch ngắn
const generateRefCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 4; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

// Hàm xóa dấu tiếng Việt
const removeVietnameseTones = (str: string) => {
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g,"a"); 
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g,"e"); 
    str = str.replace(/ì|í|ị|ỉ|ĩ/g,"i"); 
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g,"o"); 
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g,"u"); 
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g,"y"); 
    str = str.replace(/đ/g,"d");
    str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
    str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
    str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
    str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
    str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
    str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
    str = str.replace(/Đ/g, "D");
    return str.toUpperCase();
}

// [SỬA LỖI] Bỏ onUpdateUser ra khỏi props vì không cần dùng nữa (App lo rồi)
const Wallet: React.FC<{ user: User | null; onUpdateUser: (u: User) => void }> = ({ user }) => {
  const navigate = useNavigate();
  
  // State
  const [amount, setAmount] = useState<string>('100000'); 
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // State mã giao dịch
  const [currentRefCode, setCurrentRefCode] = useState<string>("");

  // ------------------------------------------------------------------
  // 1. [QUAN TRỌNG] FIX LỖI TRẮNG TRANG
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    
    let interval: NodeJS.Timeout;

    const loadData = async () => {
      try {
        // Chỉ tải Cài đặt và Lịch sử giao dịch
        // KHÔNG tải User nữa để tránh vòng lặp vô tận với App.tsx
        const [s, txs] = await Promise.all([
            db.getSettings(), 
            db.getTransactions(user.id)
        ]);
        
        setSettings(s);
        setTransactions(txs);
      } catch (error) {
        console.error("Lỗi tải ví:", error);
      }
    };

    loadData();
    // Tự động tải lại lịch sử giao dịch mỗi 5 giây
    interval = setInterval(loadData, 5000); 

    return () => clearInterval(interval);
    
    // [FIX]: Dependency chỉ phụ thuộc ID, không phụ thuộc object user
  }, [user?.id, navigate]); 

  if (!user) return null;

  // Handlers
  const handleSelectPreset = (value: number) => setAmount(value.toString());
  
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value.replace(/\D/g, '');
      setAmount(val);
  };

  const handleShowQR = () => {
    const finalAmount = parseInt(amount);
    if (!finalAmount || finalAmount < 10000) {
        alert("Vui lòng nạp tối thiểu 10.000đ");
        return;
    }
    const newRefCode = generateRefCode();
    setCurrentRefCode(newRefCode);
    setShowQRModal(true);
  };

  // Nội dung chuyển khoản
  const sanitizedName = removeVietnameseTones(user.name).replace(/[^A-Z0-9 ]/g, ''); 
  const transferContent = `NAP ${currentRefCode} ${sanitizedName}`.trim().substring(0, 50);

  const handleConfirmTransfer = async () => {
    const finalAmount = parseInt(amount);
    setIsProcessing(true);
    try {
        await db.requestDeposit(user.id, finalAmount, transferContent);
        const txs = await db.getTransactions(user.id);
        setTransactions(txs);
        setShowQRModal(false); 
        alert(`✅ Đã gửi lệnh nạp: ${transferContent}\nAdmin sẽ duyệt ngay khi tiền về (1-5 phút).`);
    } catch (e) {
        alert("Lỗi tạo yêu cầu nạp tiền");
    } finally {
        setIsProcessing(false);
    }
  };

  const getVietQRUrl = () => {
    if (!settings?.bankName || !settings?.accountNumber) return '';
    const bankId = settings.bankName; 
    const accountNo = settings.accountNumber;
    const template = 'compact2'; 
    const finalAmount = parseInt(amount) || 0;
    const accountName = encodeURI(settings.accountName || '');
    return `https://img.vietqr.io/image/${bankId}-${accountNo}-${template}.png?amount=${finalAmount}&addInfo=${encodeURI(transferContent)}&accountName=${accountName}`;
  };

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleManualRefresh = async () => {
      setIsRefreshing(true);
      // Chỉ tải lại giao dịch, số dư sẽ tự cập nhật nhờ App.tsx
      const txs = await db.getTransactions(user.id);
      setTransactions(txs);
      setTimeout(() => setIsRefreshing(false), 800);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-5 pb-24 px-3 md:px-4 font-sans animate-fade-in pt-4 overflow-x-hidden">
      
      {/* 1. THẺ VÍ TIỀN */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[1.5rem] p-5 md:p-8 text-white shadow-xl relative overflow-hidden group">
        <div className="relative z-10 flex flex-col justify-between h-full gap-6">
          
          {/* Hàng 1: Số dư + Refresh */}
          <div className="flex justify-between items-start">
             <div className="min-w-0"> 
                <p className="text-blue-100 text-[10px] font-black uppercase tracking-widest mb-1 opacity-70 flex items-center gap-2">
                    <WalletIcon className="w-3.5 h-3.5" /> Số dư khả dụng
                </p>
                <div className="flex items-center gap-2">
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tighter truncate">
                        {formatPrice(user.walletBalance || 0)}
                    </h2>
                    <button onClick={handleManualRefresh} className={`p-1.5 bg-white/10 rounded-full hover:bg-white/20 transition-all ${isRefreshing ? 'animate-spin' : ''}`}>
                        <RefreshCw className="w-4 h-4 text-white" />
                    </button>
                </div>
             </div>
             <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 shrink-0 shadow-lg">
                 <CreditCard className="w-6 h-6 text-white" />
             </div>
          </div>
          
          {/* Hàng 2: Thông tin Người dùng */}
          <div className="pt-4 border-t border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-3">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center border border-white/30 text-lg">
                    {user.avatar ? <img src={user.avatar} className="w-full h-full rounded-full object-cover" alt="" /> : <UserIcon className="w-5 h-5 text-white" />}
                </div>
                <div>
                    <p className="font-bold text-sm text-white uppercase tracking-wide">{user.name}</p>
                    <div className="flex items-center gap-2 text-[10px] opacity-70">
                        <span className="font-mono">ID: {user.id.slice(-8).toUpperCase()}</span>
                        <button onClick={() => handleCopy(user.id, 'id')} className="hover:text-white transition-colors" title="Copy ID">
                            {copiedField === 'id' ? <Check className="w-3 h-3 text-green-300" /> : <Copy className="w-3 h-3" />}
                        </button>
                    </div>
                </div>
             </div>
             
             {user.subscriptionTier && user.subscriptionTier !== 'free' && (
                 <div className="bg-yellow-400 text-yellow-900 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-md self-start md:self-auto">
                     {user.subscriptionTier === 'pro' ? '👑 VIP PRO' : '💎 VIP BASIC'}
                 </div>
             )}
          </div>
        </div>
        
        {/* Background Effects */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-400/20 rounded-full -ml-10 -mb-10 blur-2xl pointer-events-none"></div>
      </div>

      <div className="grid lg:grid-cols-5 gap-5 md:gap-8">
        
        {/* 2. KHU VỰC NẠP TIỀN */}
        <div className="lg:col-span-3 space-y-5">
          <div className="bg-white border border-gray-100 rounded-[1.5rem] p-5 shadow-sm">
            <h3 className="font-black text-sm md:text-base mb-5 flex items-center gap-2 text-slate-800 uppercase tracking-wide">
               <span className="w-8 h-8 bg-green-50 text-green-600 rounded-lg flex items-center justify-center shadow-sm">
                   <Banknote className="w-4 h-4" />
               </span>
               Nạp tiền nhanh
            </h3>
            
            <div className="mb-5 relative">
                <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest absolute top-2 left-4">Số tiền muốn nạp</label>
                <input 
                    type="text" 
                    value={amount ? parseInt(amount).toLocaleString('vi-VN') : ''}
                    onChange={handleAmountChange}
                    placeholder="0"
                    className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl pt-6 pb-2 px-4 font-black text-lg text-primary focus:border-primary focus:ring-0 outline-none transition-all"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 mt-2 font-bold text-gray-400 text-xs">VNĐ</span>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-6">
              {PRESET_AMOUNTS.map(a => (
                <button 
                  key={a} 
                  onClick={() => handleSelectPreset(a)} 
                  className={`py-3 rounded-xl border-2 font-black text-[10px] sm:text-xs transition-all active:scale-95 touch-manipulation truncate px-1 ${parseInt(amount) === a ? 'border-primary bg-primary/5 text-primary shadow-md' : 'border-gray-50 bg-white text-gray-400 hover:border-gray-200'}`}
                >
                  {a / 1000}k
                </button>
              ))}
            </div>

            <div className="space-y-3 pt-3 border-t border-gray-50">
               <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Thanh toán</span>
                  <span className="text-[10px] font-black text-primary uppercase flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-md">
                    <QrCode className="w-3 h-3" /> VietQR Auto
                  </span>
               </div>
               
               <button 
                onClick={handleShowQR} 
                disabled={!settings?.bankName || !amount} 
                className="w-full bg-primary text-white font-black py-4 rounded-xl shadow-xl shadow-primary/20 flex items-center justify-center gap-2 hover:bg-primaryHover active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed text-xs uppercase tracking-wider"
               >
                  <QrCode className="w-4 h-4" />
                  {settings?.bankName ? 'Tạo mã thanh toán' : 'Đang bảo trì'}
               </button>
            </div>
          </div>
        </div>

        {/* 3. LỊCH SỬ GIAO DỊCH */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-gray-100 rounded-[1.5rem] p-5 shadow-sm flex flex-col h-[400px]">
            <h3 className="font-black text-sm md:text-base mb-4 flex items-center gap-2 text-slate-800 uppercase tracking-wide">
               <span className="w-8 h-8 bg-orange-50 text-orange-600 rounded-lg flex items-center justify-center shadow-sm">
                   <History className="w-4 h-4" />
               </span>
               Giao dịch gần đây
            </h3>
            
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-hide">
              {transactions.length > 0 ? transactions.map(tx => (
                <div key={tx.id} className="flex items-center justify-between p-3 bg-gray-50/30 border border-gray-100 rounded-xl active:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-3 overflow-hidden">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${tx.type === 'deposit' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                          {tx.type === 'deposit' ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0 pr-2">
                        <p className="text-[10px] font-black uppercase text-slate-700 truncate leading-tight mb-0.5 max-w-[120px]">
                            {tx.type === 'deposit' ? 'Nạp tiền' : 'Thanh toán'}
                        </p>
                        <p className="text-[9px] text-gray-400 font-bold flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {new Date(tx.createdAt).toLocaleDateString('vi-VN')}
                        </p>
                      </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-xs font-black ${tx.type === 'deposit' ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.type === 'deposit' ? '+' : '-'}{formatPrice(tx.amount)}
                    </p>
                    <span className={`text-[8px] px-1.5 py-0.5 rounded-md font-black uppercase tracking-tighter inline-block mt-1 ${tx.status === 'pending' ? 'bg-yellow-100 text-yellow-600' : tx.status === 'success' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                      {tx.status === 'pending' ? 'Đang duyệt' : tx.status === 'success' ? 'Thành công' : 'Thất bại'}
                    </span>
                  </div>
                </div>
              )) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-3 opacity-60">
                   <History className="w-10 h-10" />
                   <p className="text-[10px] font-black uppercase tracking-widest">Chưa có giao dịch</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4. MODAL VIETQR */}
      {showQRModal && settings && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center sm:p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity" onClick={() => setShowQRModal(false)}></div>
          
          <div className="bg-white w-full md:max-w-sm rounded-t-[2rem] md:rounded-[2.5rem] overflow-hidden shadow-2xl relative animate-slide-up md:animate-fade-in-up flex flex-col max-h-[90vh]">
            <div className="bg-primary px-6 py-4 text-white text-center relative shrink-0">
                <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-3 md:hidden"></div> 
                <h3 className="text-base font-black uppercase tracking-wider flex items-center justify-center gap-2">
                    Thanh toán
                </h3>
                <button onClick={() => setShowQRModal(false)} className="absolute top-1/2 -translate-y-1/2 right-4 text-white/70 hover:text-white bg-white/10 p-1.5 rounded-full active:bg-white/20 transition-colors hidden md:block">
                    <XCircle className="w-5 h-5" />
                </button>
            </div>

            <div className="p-5 overflow-y-auto scrollbar-hide space-y-5">
                <div className="flex justify-center">
                    <div className="p-2 bg-white border-2 border-dashed border-primary/30 rounded-2xl shadow-lg w-[200px] h-[200px] flex items-center justify-center relative">
                        <img src={getVietQRUrl()} className="w-full h-full object-contain rounded-xl" alt="VietQR Payment" />
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-3">
                          <div className="flex justify-between items-center">
                             <span className="text-[10px] font-black text-gray-400 uppercase">STK Nhận</span>
                             <div className="flex items-center gap-2">
                                <span className="font-bold text-gray-800 text-sm">{settings.accountNumber}</span>
                                <button onClick={() => handleCopy(settings.accountNumber, 'acc')} className="text-primary bg-primary/10 p-1 rounded-lg active:scale-95" title="Sao chép">
                                    {copiedField === 'acc' ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                             </div>
                          </div>
                          
                          <div className="border-t border-gray-200/60"></div>
                          
                          <div className="flex justify-between items-center">
                             <span className="text-[10px] font-black text-gray-400 uppercase">Nội dung (Bắt buộc)</span>
                             <div className="flex items-center gap-2 max-w-[65%]">
                                <span className="font-black text-red-500 text-[10px] truncate bg-white px-2 py-1 rounded border border-gray-100" title={transferContent}>{transferContent}</span>
                                <button onClick={() => handleCopy(transferContent, 'content')} className="text-primary bg-primary/10 p-1 rounded-lg active:scale-95 shrink-0" title="Sao chép">
                                    {copiedField === 'content' ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                             </div>
                          </div>

                          <div className="flex justify-between items-center pt-2 bg-yellow-50 p-2.5 rounded-lg border border-yellow-100 mt-1">
                             <span className="text-[10px] font-black text-yellow-700 uppercase">Cần thanh toán</span>
                             <span className="font-black text-primary text-base">{formatPrice(parseInt(amount) || 0)}</span>
                          </div>
                    </div>
                </div>

                <div className="space-y-3 pt-1">
                    <button 
                        onClick={handleConfirmTransfer} 
                        disabled={isProcessing}
                        className="w-full bg-slate-900 text-white font-black py-4 rounded-xl shadow-xl active:scale-[0.98] transition-transform uppercase text-xs tracking-widest flex items-center justify-center gap-2"
                    >
                        {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} 
                        Tôi đã chuyển khoản
                    </button>
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Wallet;
