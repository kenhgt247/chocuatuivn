
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
    await db.requestDeposit(user.id, selectedAmount, 'Chuyển khoản / QR');
    setIsProcessing(false);
    setShowQRModal(true);
    const txs = await db.getTransactions(user.id);
    setTransactions(txs);
  };

  // Helper to get bank ID for VietQR (Simplification: using a common map or generic if unknown)
  const getDynamicQR = () => {
    if (settings.beneficiaryQR) return settings.beneficiaryQR;
    
    // Auto-generate VietQR using VietQR.io API if statically configured QR is not present
    // Format: https://img.vietqr.io/image/<BANK_ID>-<ACCOUNT_NO>-compact.png?amount=<AMOUNT>&addInfo=<INFO>&accountName=<NAME>
    // Since we don't have Bank ID yet, we fallback to a simpler QR server if bank info is incomplete
    const content = `NAP ${user.id.slice(-6).toUpperCase()}`;
    const amount = selectedAmount;
    
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=STK:${settings.accountNumber}|BANK:${settings.bankName}|NAME:${settings.accountName}|AMT:${amount}|MSG:${content}`;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-10 px-4">
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
        {/* Decorative circle */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
      </div>

      <div className="grid lg:grid-cols-5 gap-8">
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
                  <span className="text-[10px] font-black text-primary uppercase">VietQR / Chuyển khoản</span>
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
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" strokeWidth={2.5}/></svg>
                     Tạo mã QR Nạp tiền
                   </>
                 )}
               </button>
            </div>
          </div>
        </div>

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

      {showQRModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowQRModal(false)}></div>
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl relative text-center space-y-6 animate-fade-in-up">
            <div>
               <h3 className="text-xl font-black text-textMain">Quét mã VietQR</h3>
               <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Nạp tiền vào ví Chợ Của Tui</p>
            </div>
            
            <div className="aspect-square bg-bgMain rounded-[2.5rem] p-6 flex flex-col items-center justify-center relative border-4 border-white shadow-inner">
               <img 
                src={getDynamicQR()} 
                className="w-full h-full object-contain" 
                alt="Payment QR" 
               />
               <div className="absolute inset-0 border-2 border-primary/20 rounded-[2.5rem] pointer-events-none"></div>
            </div>

            <div className="bg-bgMain p-5 rounded-3xl text-left text-[11px] space-y-3 border border-borderMain">
              <div className="flex justify-between items-center"><span className="text-gray-400 font-bold">Ngân hàng:</span><span className="font-black text-textMain">{settings.bankName}</span></div>
              <div className="flex justify-between items-center"><span className="text-gray-400 font-bold">Số TK:</span><span className="font-black text-primary text-sm">{settings.accountNumber}</span></div>
              <div className="flex justify-between items-center"><span className="text-gray-400 font-bold">Chủ TK:</span><span className="font-black text-textMain">{settings.accountName}</span></div>
              <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                <span className="text-gray-400 font-bold uppercase tracking-tighter">Nội dung nạp:</span>
                <span className="font-black text-red-500 text-sm">NAP {user.id.slice(-6).toUpperCase()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 font-bold uppercase tracking-tighter">Số tiền:</span>
                <span className="font-black text-primary text-sm">{formatPrice(selectedAmount)}</span>
              </div>
            </div>

            <div className="space-y-4">
               <p className="text-[10px] text-gray-400 italic font-bold">Lưu ý: Bạn phải nhập đúng nội dung chuyển khoản để hệ thống có thể đối soát và cộng tiền tự động.</p>
               <button 
                onClick={() => setShowQRModal(false)} 
                className="w-full bg-primary text-white font-black py-4 rounded-2xl shadow-xl shadow-primary/20 hover:scale-105 transition-all active:scale-95 uppercase text-xs tracking-widest"
               >
                 Tôi đã chuyển khoản xong
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Wallet;
