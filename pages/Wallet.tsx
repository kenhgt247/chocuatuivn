import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, SystemSettings } from '../services/db';
import { User, Transaction } from '../types';
import { formatPrice } from '../utils/format';

const PRESET_AMOUNTS = [50000, 100000, 200000, 500000, 1000000, 2000000];

const Wallet: React.FC<{ user: User | null; onUpdateUser: (u: User) => void }> = ({ user, onUpdateUser }) => {
  const navigate = useNavigate();
  const [selectedAmount, setSelectedAmount] = useState<number>(100000);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    const loadData = async () => {
      const [s, txs] = await Promise.all([db.getSettings(), db.getTransactions(user.id)]);
      setSettings(s);
      setTransactions(txs);
    };
    loadData();
  }, [user, navigate]);

  if (!user || !settings) return null;

  const handleDepositRequest = async () => {
    setIsProcessing(true);
    // Tạo transaction pending
    await db.requestDeposit(user.id, selectedAmount, `NAP ${user.id.slice(-6).toUpperCase()}`);
    setIsProcessing(false);
    setShowQRModal(true);
    
    // Reload transaction list
    const txs = await db.getTransactions(user.id);
    setTransactions(txs);
  };

  // --- VIETQR LOGIC ---
  const getVietQRUrl = () => {
    if (!settings.bankName || !settings.accountNumber) return '';
    
    const bankId = settings.bankName; // Lưu ý: Admin cần nhập Mã NH (VD: MB, VCB, TPB)
    const accountNo = settings.accountNumber;
    const template = 'compact2'; // compact, compact2, qr_only, print
    const amount = selectedAmount;
    const content = `NAP ${user.id.slice(-6).toUpperCase()}`;
    const accountName = encodeURI(settings.accountName);

    // API VietQR public (QuickLink)
    return `https://img.vietqr.io/image/${bankId}-${accountNo}-${template}.png?amount=${amount}&addInfo=${content}&accountName=${accountName}`;
  };

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const transferContent = `NAP ${user.id.slice(-6).toUpperCase()}`;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-10 px-4">
      {/* Header Wallet Card */}
      <div className="bg-gradient-to-br from-primary to-blue-700 rounded-[2rem] p-8 text-white shadow-2xl relative overflow-hidden group">
        <div className="relative z-10 space-y-6">
          <div>
            <p className="text-blue-100 text-[10px] font-black uppercase tracking-widest mb-1 opacity-70">Số dư khả dụng</p>
            <h2 className="text-4xl font-black tracking-tight">{formatPrice(user.walletBalance)}</h2>
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
          <div className="bg-white border border-borderMain rounded-[2rem] p-8 shadow-soft">
            <h3 className="font-black text-lg mb-8 flex items-center gap-3">
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
                  <span className="text-[10px] font-black text-primary uppercase flex items-center gap-1">
                    <img src="/v.png" className="h-4" alt="VietQR" /> Quét mã tự động
                  </span>
               </div>
               <button 
                onClick={handleDepositRequest} 
                disabled={isProcessing} 
                className="w-full bg-primary text-white font-black py-5 rounded-2xl shadow-xl shadow-primary/20 flex items-center justify-center gap-3 hover:bg-primaryHover active:scale-[0.98] transition-all disabled:opacity-50"
               >
                 {isProcessing ? (
                   <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                 ) : (
                   <>
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v1m6 11h2m-6 0h-2v4h-4v-2h4v-4H6v4H2v-4h4V4h2v2h4v4a2 2 0 002 2h2v4z" strokeWidth={2}/></svg>
                     Tạo mã VietQR
                   </>
                 )}
               </button>
            </div>
          </div>
        </div>

        {/* History Section */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-borderMain rounded-[2rem] p-8 shadow-soft flex flex-col h-[480px]">
            <h3 className="font-black text-lg mb-6 flex items-center gap-3">
               <span className="w-1.5 h-6 bg-primary rounded-full"></span>
               Lịch sử giao dịch
            </h3>
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 no-scrollbar">
              {transactions.length > 0 ? transactions.map(tx => (
                <div key={tx.id} className="flex items-center justify-between p-4 bg-gray-50/50 border border-gray-100 rounded-2xl group hover:bg-white hover:shadow-md transition-all">
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="text-[10px] font-black uppercase text-textMain truncate leading-tight mb-1">{tx.description}</p>
                    <p className="text-[9px] text-gray-400 font-bold">{new Date(tx.createdAt).toLocaleString('vi-VN')}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-black ${tx.type === 'deposit' ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.type === 'deposit' ? '+' : '-'}{formatPrice(tx.amount)}
                    </p>
                    <span className={`text-[8px] px-2 py-0.5 rounded-lg font-black uppercase tracking-tighter ${tx.status === 'pending' ? 'bg-yellow-100 text-yellow-600' : tx.status === 'success' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                      {tx.status === 'pending' ? 'Chờ duyệt' : tx.status === 'success' ? 'Thành công' : 'Thất bại'}
                    </span>
                  </div>
                </div>
              )) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-3">
                   <div className="text-4xl grayscale opacity-30">💸</div>
                   <p className="text-[10px] font-black uppercase tracking-widest">Chưa có giao dịch</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL VIETQR - SMART PAYMENT UI */}
      {showQRModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowQRModal(false)}></div>
          <div className="bg-white w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl relative animate-fade-in-up flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="bg-primary p-6 text-white text-center relative">
                <h3 className="text-xl font-black uppercase tracking-wider">Thanh toán</h3>
                <p className="text-[10px] opacity-80 font-bold mt-1">Sử dụng App Ngân hàng bất kỳ để quét</p>
                <button onClick={() => setShowQRModal(false)} className="absolute top-6 right-6 text-white/70 hover:text-white">✕</button>
            </div>

            <div className="p-8 overflow-y-auto space-y-6">
                {/* QR Image Area */}
                <div className="flex justify-center">
                    <div className="p-3 bg-white border-2 border-dashed border-primary/30 rounded-3xl shadow-lg">
                        <img 
                            src={getVietQRUrl()} 
                            className="w-full max-w-[280px] object-contain rounded-2xl" 
                            alt="VietQR Payment"
                        />
                    </div>
                </div>

                {/* Transfer Details with Copy Buttons */}
                <div className="space-y-4">
                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-3">
                         {/* Account Num */}
                         <div className="flex justify-between items-center group">
                            <span className="text-[10px] font-black text-gray-400 uppercase">Số tài khoản</span>
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-gray-800">{settings.accountNumber}</span>
                                <button onClick={() => handleCopy(settings.accountNumber, 'acc')} className="text-primary hover:bg-blue-50 p-1.5 rounded-lg transition-colors" title="Sao chép">
                                    {copiedField === 'acc' ? '✓' : '❐'}
                                </button>
                            </div>
                         </div>
                         <div className="border-t border-gray-200"></div>
                         
                         {/* Content (Quan trọng nhất) */}
                         <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-gray-400 uppercase">Nội dung CK</span>
                            <div className="flex items-center gap-2">
                                <span className="font-black text-red-500">{transferContent}</span>
                                <button onClick={() => handleCopy(transferContent, 'content')} className="text-primary hover:bg-blue-50 p-1.5 rounded-lg transition-colors" title="Sao chép">
                                    {copiedField === 'content' ? '✓' : '❐'}
                                </button>
                            </div>
                         </div>

                         {/* Amount */}
                         <div className="flex justify-between items-center pt-2 bg-yellow-50 p-2 rounded-xl border border-yellow-100 mt-2">
                             <span className="text-[10px] font-black text-yellow-700 uppercase">Số tiền</span>
                             <span className="font-black text-primary text-lg">{formatPrice(selectedAmount)}</span>
                         </div>
                    </div>
                </div>

                <button 
                  onClick={() => setShowQRModal(false)} 
                  className="w-full bg-gray-900 text-white font-black py-4 rounded-2xl shadow-xl hover:scale-[1.02] transition-transform active:scale-95 uppercase text-xs tracking-widest"
                >
                  Đã chuyển khoản
                </button>
            </div>
            
            {/* Footer Note */}
            <div className="bg-gray-50 p-4 text-center border-t border-gray-100">
                <p className="text-[9px] text-gray-400 font-bold">Hệ thống sẽ xử lý giao dịch trong vài phút.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Wallet;
