import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, SystemSettings } from '../services/db';
import { User, Transaction } from '../types';
import { formatPrice } from '../utils/format';

// [AN TOÀN] Sử dụng icon cơ bản để tránh lỗi version
import { 
  Wallet as WalletIcon, CreditCard, Copy, Check, X, 
  ArrowUp, ArrowDown, Loader, Banknote, History, CheckCircle, RotateCcw
} from 'lucide-react';

const PRESET_AMOUNTS = [50000, 100000, 200000, 500000, 1000000, 2000000];

const Wallet: React.FC<{ user: User | null; onUpdateUser: (u: User) => void }> = ({ user }) => {
  const navigate = useNavigate();
  const [selectedAmount, setSelectedAmount] = useState<number>(100000);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load dữ liệu
  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    
    const loadData = async () => {
      try {
        // Chỉ load setting và transaction, KHÔNG update user ngược lên App
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
    // Refresh định kỳ để cập nhật trạng thái giao dịch
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [user?.id, navigate]); // Chỉ phụ thuộc ID

  if (!user) return null;

  const handleDepositRequest = async () => {
    setIsProcessing(true);
    try {
        const content = `NAP ${user.id.slice(-6).toUpperCase()}`;
        await db.requestDeposit(user.id, selectedAmount, content);
        
        const txs = await db.getTransactions(user.id);
        setTransactions(txs);
        setShowQRModal(true);
    } catch (e) {
        alert("Lỗi tạo yêu cầu nạp tiền");
    } finally {
        setIsProcessing(false);
    }
  };

  // Helper tạo QR Code
  const getDynamicQR = () => {
    if (!settings?.bankName || !settings?.accountNumber) return '';
    const content = `NAP ${user.id.slice(-6).toUpperCase()}`;
    const amount = selectedAmount;
    
    // Ưu tiên VietQR nếu có đủ thông tin
    if (settings.bankName && settings.accountNumber) {
        const accountName = encodeURI(settings.accountName || '');
        return `https://img.vietqr.io/image/${settings.bankName}-${settings.accountNumber}-compact2.png?amount=${amount}&addInfo=${content}&accountName=${accountName}`;
    }
    
    // Fallback nếu thiếu thông tin ngân hàng (như code cũ của bạn)
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=STK:${settings.accountNumber}|BANK:${settings.bankName}|NAME:${settings.accountName}|AMT:${amount}|MSG:${content}`;
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
    <div className="max-w-4xl mx-auto space-y-8 pb-10 px-4">
      {/* Wallet Card */}
      <div className="bg-gradient-to-br from-primary to-blue-700 rounded-[2rem] p-8 text-white shadow-2xl relative overflow-hidden group">
        <div className="relative z-10 space-y-6">
          <div>
            <p className="text-blue-100 text-[10px] font-black uppercase tracking-widest mb-1 opacity-70 flex items-center gap-2">
                <WalletIcon className="w-3.5 h-3.5" /> Số dư khả dụng
            </p>
            <div className="flex items-center gap-3">
                <h2 className="text-4xl font-black tracking-tight">{formatPrice(user.walletBalance || 0)}</h2>
                <button onClick={handleManualRefresh} className={`p-1.5 bg-white/10 rounded-full hover:bg-white/20 transition-all ${isRefreshing ? 'animate-spin' : ''}`}>
                    <RotateCcw className="w-4 h-4" />
                </button>
            </div>
          </div>
          <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest opacity-60">
            <span>Mã ví: {user.id.slice(-8).toUpperCase()}</span>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
      </div>

      <div className="grid lg:grid-cols-5 gap-8">
        {/* Deposit Section */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white border border-gray-200 rounded-[2rem] p-8 shadow-sm">
            <h3 className="font-black text-lg mb-8 flex items-center gap-3">
               <span className="w-1.5 h-6 bg-primary rounded-full"></span>
               Nạp tiền vào ví
            </h3>
            
            <div className="grid grid-cols-3 gap-4 mb-10">
              {PRESET_AMOUNTS.map(a => (
                <button 
                  key={a} 
                  onClick={() => setSelectedAmount(a)} 
                  className={`py-4 rounded-2xl border-2 font-black text-sm transition-all active:scale-95 ${selectedAmount === a ? 'border-primary bg-primary/5 text-primary shadow-lg shadow-primary/10' : 'border-gray-50 bg-gray-50 text-gray-400 hover:border-gray-200'}`}
                >
                  {a / 1000}k
                </button>
              ))}
            </div>

            <div className="space-y-4">
               <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Phương thức</span>
                  <span className="text-[10px] font-black text-primary uppercase flex items-center gap-1">
                    <Banknote className="w-3 h-3" /> VietQR / Chuyển khoản
                  </span>
               </div>
               <button 
                onClick={handleDepositRequest} 
                disabled={isProcessing || !settings?.bankName} 
                className="w-full bg-primary text-white font-black py-5 rounded-2xl shadow-xl shadow-primary/20 flex items-center justify-center gap-3 hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-50"
               >
                 {isProcessing ? (
                   <Loader className="w-5 h-5 animate-spin" />
                 ) : (
                   <>
                     <CheckCircle className="w-5 h-5" />
                     {settings?.bankName ? 'Tạo mã Nạp tiền' : 'Đang bảo trì'}
                   </>
                 )}
               </button>
            </div>
          </div>
        </div>

        {/* History Section */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-gray-200 rounded-[2rem] p-8 shadow-sm flex flex-col h-[480px]">
            <h3 className="font-black text-lg mb-6 flex items-center gap-3">
               <span className="w-1.5 h-6 bg-primary rounded-full"></span>
               Lịch sử giao dịch
            </h3>
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {transactions.length > 0 ? transactions.map(tx => (
                <div key={tx.id} className="flex items-center justify-between p-4 bg-gray-50 border border-gray-100 rounded-2xl">
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="text-[10px] font-black uppercase text-gray-700 truncate leading-tight mb-1">{tx.description}</p>
                    <p className="text-[9px] text-gray-400 font-bold">{new Date(tx.createdAt).toLocaleString('vi-VN')}</p>
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

      {/* QR Modal */}
      {showQRModal && settings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowQRModal(false)}></div>
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl relative text-center space-y-6 animate-fade-in-up">
            <div>
               <h3 className="text-xl font-black">Quét mã VietQR</h3>
               <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Nạp tiền vào ví</p>
               <button onClick={() => setShowQRModal(false)} className="absolute top-6 right-6 p-2 bg-gray-100 rounded-full hover:bg-gray-200"><X className="w-4 h-4" /></button>
            </div>
            
            <div className="aspect-square bg-gray-50 rounded-[2rem] p-4 flex flex-col items-center justify-center relative border-4 border-white shadow-inner">
               <img src={getDynamicQR()} className="w-full h-full object-contain" alt="Payment QR" />
            </div>

            <div className="bg-gray-50 p-5 rounded-3xl text-left text-[11px] space-y-3 border border-gray-100">
              <div className="flex justify-between items-center"><span className="text-gray-400 font-bold">Ngân hàng:</span><span className="font-black">{settings.bankName}</span></div>
              <div className="flex justify-between items-center"><span className="text-gray-400 font-bold">Số TK:</span>
                <span className="font-black text-primary text-sm flex items-center gap-1">
                    {settings.accountNumber} 
                    <button onClick={() => handleCopy(settings.accountNumber, 'acc')} className="text-gray-400 hover:text-primary"><Copy className="w-3 h-3" /></button>
                </span>
              </div>
              <div className="flex justify-between items-center"><span className="text-gray-400 font-bold">Chủ TK:</span><span className="font-black">{settings.accountName}</span></div>
              <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                <span className="text-gray-400 font-bold uppercase tracking-tighter">Nội dung:</span>
                <span className="font-black text-red-500 text-sm flex items-center gap-1">
                    NAP {user.id.slice(-6).toUpperCase()}
                    <button onClick={() => handleCopy(`NAP ${user.id.slice(-6).toUpperCase()}`, 'content')} className="text-gray-400 hover:text-primary"><Copy className="w-3 h-3" /></button>
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 font-bold uppercase tracking-tighter">Số tiền:</span>
                <span className="font-black text-primary text-sm">{formatPrice(selectedAmount)}</span>
              </div>
            </div>

            <button onClick={() => setShowQRModal(false)} className="w-full bg-primary text-white font-black py-4 rounded-2xl shadow-xl hover:bg-blue-700 transition-all active:scale-95 uppercase text-xs tracking-widest">
               Đã chuyển khoản xong
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Wallet;
