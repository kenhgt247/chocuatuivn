import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, SystemSettings } from '../services/db';
import { User, Transaction } from '../types';
import { formatPrice } from '../utils/format';

// [SỬA LỖI QUAN TRỌNG] Thay thế các Icon gây lỗi #130 bằng Icon cơ bản
// ArrowUpRight -> ArrowUp
// ArrowDownLeft -> ArrowDown
// Loader2 -> Loader
// RefreshCw -> RotateCcw
import { 
  Wallet as WalletIcon, 
  CreditCard, 
  Copy, 
  Check, 
  Clock, 
  X,           // Dùng X thay vì XCircle
  ArrowUp,     // AN TOÀN
  ArrowDown,   // AN TOÀN
  Loader,      // AN TOÀN
  Banknote, 
  History, 
  CheckCircle, 
  RotateCcw,   // AN TOÀN
  User as UserIcon
} from 'lucide-react';

const PRESET_AMOUNTS = [50000, 100000, 200000, 500000, 1000000, 2000000];

const Wallet: React.FC<{ user: User | null; onUpdateUser: (u: User) => void }> = ({ user, onUpdateUser }) => {
  const navigate = useNavigate();
  const [selectedAmount, setSelectedAmount] = useState<number>(100000);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // --- LOGIC LOAD DỮ LIỆU ---
  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    
    let interval: NodeJS.Timeout;

    const loadData = async () => {
      try {
        // Chỉ load Cài đặt và Lịch sử giao dịch
        // KHÔNG load lại User ở đây để tránh xung đột với App.tsx
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

    // Tự động tải lại lịch sử mỗi 5s (để cập nhật trạng thái Success/Failed)
    interval = setInterval(loadData, 5000);

    return () => clearInterval(interval);
  }, [user?.id, navigate]);

  if (!user) return null;

  // --- LOGIC XỬ LÝ ---
  const handleDepositRequest = async () => {
    setIsProcessing(true);
    try {
        const content = `NAP ${user.id.slice(-6).toUpperCase()}`;
        await db.requestDeposit(user.id, selectedAmount, content);
        
        // Reload lại lịch sử ngay
        const txs = await db.getTransactions(user.id);
        setTransactions(txs);
        setShowQRModal(true);
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
    const amount = selectedAmount;
    const content = `NAP ${user.id.slice(-6).toUpperCase()}`;
    const accountName = encodeURI(settings.accountName || '');

    return `https://img.vietqr.io/image/${bankId}-${accountNo}-${template}.png?amount=${amount}&addInfo=${content}&accountName=${accountName}`;
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

  const transferContent = `NAP ${user.id.slice(-6).toUpperCase()}`;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-10 px-4 pt-6">
      
      {/* 1. THẺ VÍ TIỀN (Giao diện cũ của bạn) */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2rem] p-8 text-white shadow-2xl relative overflow-hidden group">
        <div className="relative z-10 space-y-6">
          <div className="flex justify-between items-start">
             <div>
                <p className="text-blue-100 text-[10px] font-black uppercase tracking-widest mb-1 opacity-70 flex items-center gap-2">
                    <WalletIcon className="w-3.5 h-3.5" /> Số dư khả dụng
                </p>
                <div className="flex items-center gap-3">
                    <h2 className="text-4xl font-black tracking-tight">{formatPrice(user.walletBalance || 0)}</h2>
                    {/* Nút Refresh tay */}
                    <button onClick={handleManualRefresh} className={`p-2 bg-white/10 rounded-full hover:bg-white/20 transition-all ${isRefreshing ? 'animate-spin' : ''}`}>
                        <RotateCcw className="w-4 h-4 text-white" />
                    </button>
                </div>
             </div>
             <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 shadow-lg">
                 <CreditCard className="w-6 h-6 text-white" />
             </div>
          </div>
          
          <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest opacity-60">
            <span>Mã ví: {user.id.slice(-8).toUpperCase()}</span>
          </div>
        </div>
        {/* Background Effect */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
      </div>

      <div className="grid lg:grid-cols-5 gap-8">
        
        {/* 2. KHU VỰC NẠP TIỀN */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white border border-gray-100 rounded-[2rem] p-8 shadow-sm">
            <h3 className="font-black text-lg mb-8 flex items-center gap-3 text-slate-800">
               <span className="w-1.5 h-6 bg-primary rounded-full"></span>
               Nạp tiền vào ví
            </h3>
            
            <div className="grid grid-cols-3 gap-4 mb-10">
              {PRESET_AMOUNTS.map(a => (
                <button 
                  key={a} 
                  onClick={() => setSelectedAmount(a)} 
                  className={`py-4 rounded-2xl border-2 font-black text-sm transition-all active:scale-95 ${selectedAmount === a ? 'border-primary bg-primary/5 text-primary shadow-lg shadow-primary/10' : 'border-gray-50 bg-gray-50/50 text-gray-400 hover:border-gray-200'}`}
                >
                  {a / 1000}k
                </button>
              ))}
            </div>

            <div className="space-y-4">
               <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Phương thức thanh toán</span>
                  <span className="text-[10px] font-black text-primary uppercase flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-md">
                    <Banknote className="w-3 h-3" /> Quét mã tự động
                  </span>
               </div>
               <button 
                onClick={handleDepositRequest} 
                disabled={isProcessing || !settings?.bankName} 
                className="w-full bg-primary text-white font-black py-5 rounded-2xl shadow-xl shadow-primary/20 flex items-center justify-center gap-3 hover:bg-primaryHover active:scale-[0.98] transition-all disabled:opacity-50"
               >
                 {isProcessing ? (
                   <Loader className="w-5 h-5 animate-spin" />
                 ) : (
                   <>
                     <CheckCircle className="w-5 h-5" />
                     {settings?.bankName ? 'Tạo mã VietQR' : 'Hệ thống đang bảo trì'}
                   </>
                 )}
               </button>
            </div>
          </div>
        </div>

        {/* 3. LỊCH SỬ GIAO DỊCH */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-gray-100 rounded-[2rem] p-8 shadow-sm flex flex-col h-[480px]">
            <h3 className="font-black text-lg mb-6 flex items-center gap-3 text-slate-800">
               <span className="w-1.5 h-6 bg-primary rounded-full"></span>
               Lịch sử giao dịch
            </h3>
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-hide">
              {transactions.length > 0 ? transactions.map(tx => (
                <div key={tx.id} className="flex items-center justify-between p-4 bg-gray-50/50 border border-gray-100 rounded-2xl group hover:bg-white hover:shadow-md transition-all">
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="text-[10px] font-black uppercase text-slate-700 truncate leading-tight mb-1">{tx.description}</p>
                    <p className="text-[9px] text-gray-400 font-bold flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {new Date(tx.createdAt).toLocaleString('vi-VN')}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-black flex items-center justify-end gap-1 ${tx.type === 'deposit' ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.type === 'deposit' ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />}
                      {formatPrice(tx.amount)}
                    </p>
                    <span className={`text-[8px] px-2 py-0.5 rounded-lg font-black uppercase tracking-tighter ${tx.status === 'pending' ? 'bg-yellow-100 text-yellow-600' : tx.status === 'success' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                      {tx.status === 'pending' ? 'Chờ duyệt' : tx.status === 'success' ? 'Thành công' : 'Thất bại'}
                    </span>
                  </div>
                </div>
              )) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-3">
                   <History className="w-8 h-8 opacity-30" />
                   <p className="text-[10px] font-black uppercase tracking-widest">Chưa có giao dịch</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4. MODAL VIETQR */}
      {showQRModal && settings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowQRModal(false)}></div>
          <div className="bg-white w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl relative animate-fade-in-up flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="bg-primary p-6 text-white text-center relative">
               <h3 className="text-xl font-black uppercase tracking-wider">Thanh toán</h3>
               <p className="text-[10px] opacity-80 font-bold mt-1">Sử dụng App Ngân hàng bất kỳ để quét</p>
               <button onClick={() => setShowQRModal(false)} className="absolute top-6 right-6 text-white/70 hover:text-white">
                   <X className="w-6 h-6" />
               </button>
            </div>

            <div className="p-8 overflow-y-auto space-y-6">
               <div className="flex justify-center">
                  <div className="p-3 bg-white border-2 border-dashed border-primary/30 rounded-3xl shadow-lg">
                     <img src={getVietQRUrl()} className="w-full max-w-[280px] object-contain rounded-2xl" alt="VietQR" />
                  </div>
               </div>

               <div className="space-y-4">
                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-3">
                     <div className="flex justify-between items-center group">
                        <span className="text-[10px] font-black text-gray-400 uppercase">Số tài khoản</span>
                        <div className="flex items-center gap-2">
                           <span className="font-bold text-gray-800">{settings.accountNumber}</span>
                           <button onClick={() => handleCopy(settings.accountNumber, 'acc')} className="text-primary hover:bg-blue-50 p-1.5 rounded-lg transition-colors">
                              {copiedField === 'acc' ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                           </button>
                        </div>
                     </div>
                     <div className="border-t border-gray-200"></div>
                     <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-gray-400 uppercase">Nội dung CK</span>
                        <div className="flex items-center gap-2">
                           <span className="font-black text-red-500">{transferContent}</span>
                           <button onClick={() => handleCopy(transferContent, 'content')} className="text-primary hover:bg-blue-50 p-1.5 rounded-lg transition-colors">
                              {copiedField === 'content' ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                           </button>
                        </div>
                     </div>
                     <div className="flex justify-between items-center pt-2 bg-yellow-50 p-2 rounded-xl border border-yellow-100 mt-2">
                        <span className="text-[10px] font-black text-yellow-700 uppercase">Số tiền</span>
                        <span className="font-black text-primary text-lg">{formatPrice(selectedAmount)}</span>
                     </div>
                  </div>
               </div>

               <button onClick={() => setShowQRModal(false)} className="w-full bg-gray-900 text-white font-black py-4 rounded-2xl shadow-xl hover:scale-[1.02] transition-transform active:scale-95 uppercase text-xs tracking-widest">
                  Đã chuyển khoản
               </button>
            </div>
            
            <div className="bg-gray-50 p-4 text-center border-t border-gray-100">
               <p className="text-[9px] text-gray-400 font-bold">Hệ thống sẽ tự động cập nhật số dư sau 1-3 phút.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Wallet;
