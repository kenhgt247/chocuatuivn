import React, { useEffect, useRef, useState } from 'react';
import { db } from '../services/db'; // Bỏ SystemSettings vì PayOS trả về đủ info rồi
import { User, Transaction } from '../types';
import { formatPrice } from '../utils/format';

/* ============================================================================
   ICONS INLINE – GIỮ NGUYÊN BỘ ICON CŨ
============================================================================ */
const IconWallet = () => <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12V8H6a2 2 0 0 1 0-4h14v4"/><path d="M4 6v12a2 2 0 0 0 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>;
const IconRotate = ({ spin }: { spin?: boolean }) => (
  <svg width="20" height="20" className={spin ? 'animate-spin' : ''} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 3-6"/><path d="M3 3v5h5"/>
  </svg>
);
const IconDown = () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>;
const IconUp = () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>;
const IconX = () => <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 18 18"/></svg>;
const IconCheck = () => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const IconLoader = () => <svg width="20" height="20" className="animate-spin" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.2-8.6"/></svg>;

/* ============================================================================
   CONSTANTS
============================================================================ */
const PRESET_AMOUNTS = [50_000, 100_000, 200_000, 500_000, 1_000_000, 2_000_000];

interface Props {
  user: User | null;
}

const Wallet: React.FC<Props> = ({ user }) => {
  /* 🚫 KHÔNG USER → KHÔNG RENDER */
  if (!user) return null;

  const mountedRef = useRef(true);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [amount, setAmount] = useState('50000');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // State hiển thị QR PayOS
  const [showQR, setShowQR] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState<any>(null);

  /* ================= LOAD DATA ================= */
  useEffect(() => {
    mountedRef.current = true;

    const load = async () => {
      try {
        // Chỉ cần load Transactions, Settings PayOS tự lo
        const tx = await db.getTransactions(user.id);
        if (mountedRef.current) {
          setTransactions(tx);
        }
      } catch (e) {
        console.error(e);
      }
    };

    load();
    // Auto refresh để cập nhật trạng thái khi nạp thành công
    const id = setInterval(load, 5000);

    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, [user.id]);

  /* ================= HANDLERS ================= */
  const handleRefresh = async () => {
    setRefreshing(true);
    const tx = await db.getTransactions(user.id);
    if (mountedRef.current) setTransactions(tx);
    setTimeout(() => mountedRef.current && setRefreshing(false), 500);
  };

  // Hàm quan trọng: Gọi PayOS tạo link thanh toán
  const handleCreatePayment = async () => {
    const numAmount = parseInt(amount.replace(/\D/g, ''));

    if (!numAmount || numAmount < 2000) {
        alert("PayOS yêu cầu nạp tối thiểu 2.000đ");
        return;
    }
    if (numAmount > 100000000) {
        alert("Số tiền nạp tối đa là 100 triệu");
        return;
    }

    setLoading(true);
    try {
      // 👇👇👇 GỬI THÊM TÊN NGƯỜI DÙNG 👇👇👇
      const userNameToSend = user.name || "Khach hang";
      const data = await db.createPayOSPayment(numAmount, user.id, userNameToSend);
      // 👆👆👆 KẾT THÚC THAY ĐỔI 👆👆👆
      
      setPaymentInfo(data);
      setShowQR(true);

      const tx = await db.getTransactions(user.id);
      if(mountedRef.current) setTransactions(tx);

    } catch (error: any) {
      console.error(error);
      alert("Lỗi tạo mã thanh toán: " + (error.message || "Vui lòng thử lại sau"));
    } finally {
      if(mountedRef.current) setLoading(false);
    }
  };

  /* ================= RENDER ================= */
  return (
    <div className="max-w-3xl mx-auto px-4 pb-32 pt-6 font-sans space-y-8 animate-fade-in">
      
      {/* 1. THẺ SỐ DƯ (CARD) */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2rem] p-8 text-white shadow-2xl shadow-blue-500/30 transition-transform hover:scale-[1.01]">
        {/* Họa tiết nền trang trí */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-white/10 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-40 h-40 rounded-full bg-black/10 blur-2xl"></div>

        <div className="relative z-10 flex justify-between items-start">
            <div>
                <p className="text-sm font-bold uppercase tracking-widest opacity-80 flex items-center gap-2 mb-2">
                    <IconWallet /> Số dư khả dụng
                </p>
                <h2 className="text-5xl font-black tracking-tighter">
                    {formatPrice(user.walletBalance)}
                </h2>
            </div>
            <button 
                onClick={handleRefresh} 
                className="p-3 bg-white/20 hover:bg-white/30 rounded-2xl backdrop-blur-md transition-all active:rotate-180"
                title="Làm mới"
            >
                <IconRotate spin={refreshing} />
            </button>
        </div>
        <div className="relative z-10 mt-8 pt-6 border-t border-white/20 flex gap-8">
            <div>
                <p className="text-[10px] uppercase font-bold opacity-60">Chủ tài khoản</p>
                <p className="font-bold text-lg">{user.name}</p>
            </div>
            <div>
                <p className="text-[10px] uppercase font-bold opacity-60">Trạng thái</p>
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="font-bold text-sm">Hoạt động</span>
                </div>
            </div>
        </div>
      </div>

      {/* 2. KHU VỰC NẠP TIỀN */}
      <div className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-gray-100/50 border border-gray-100">
        <h3 className="text-lg font-black text-gray-800 mb-6 uppercase tracking-wide border-l-4 border-blue-500 pl-3">Nạp tiền vào ví</h3>
        
        {/* Input nhập tiền */}
        <div className="relative mb-6 group">
            <input
                value={Number(amount).toLocaleString('vi-VN')}
                onChange={e => setAmount(e.target.value.replace(/\D/g, ''))}
                className="w-full text-4xl font-black p-6 text-center bg-gray-50 rounded-2xl border-2 border-transparent focus:border-blue-500 focus:bg-white outline-none transition-all placeholder-gray-300 text-slate-800"
                placeholder="0"
            />
            <span className="absolute right-6 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">VNĐ</span>
        </div>

        {/* Các mức tiền gợi ý */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {PRESET_AMOUNTS.map(v => (
            <button
              key={v}
              onClick={() => setAmount(String(v))}
              className={`py-3 rounded-xl font-bold text-xs transition-all active:scale-95 ${
                +amount === v 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                    : 'bg-white border border-gray-100 text-gray-500 hover:border-blue-200 hover:text-blue-600'
              }`}
            >
              {v / 1000}k
            </button>
          ))}
        </div>

        <button
          onClick={handleCreatePayment}
          disabled={loading}
          className="w-full py-5 bg-slate-900 hover:bg-black text-white font-black rounded-2xl shadow-xl hover:shadow-2xl transition-all active:scale-95 text-sm uppercase tracking-widest flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? <IconLoader /> : <IconCheck />} Tạo mã thanh toán (PayOS)
        </button>
      </div>

      {/* 3. LỊCH SỬ GIAO DỊCH */}
      <div className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-gray-100/50 border border-gray-100 min-h-[300px]">
        <h3 className="text-lg font-black text-gray-800 mb-6 uppercase tracking-wide border-l-4 border-gray-300 pl-3">Lịch sử giao dịch</h3>
        
        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {transactions.length === 0 && (
                <div className="text-center py-12 text-gray-300 flex flex-col items-center">
                    <div className="bg-gray-50 p-4 rounded-full mb-3"><IconWallet /></div>
                    <p className="text-xs font-bold uppercase">Chưa có giao dịch nào</p>
                </div>
            )}
            
            {transactions.map(tx => (
                <div key={tx.id} className="flex justify-between items-center p-4 rounded-2xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100 group">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md ${tx.type === 'deposit' ? 'bg-green-500 shadow-green-200' : 'bg-red-500 shadow-red-200'}`}>
                            {tx.type === 'deposit' ? <IconDown /> : <IconUp />}
                        </div>
                        <div>
                            <p className="text-sm font-bold text-gray-800 group-hover:text-blue-600 transition-colors">
                                {tx.type === 'deposit' ? 'Nạp tiền vào ví' : 'Thanh toán dịch vụ'}
                            </p>
                            <p className="text-[10px] font-bold text-gray-400 mt-0.5 uppercase tracking-wide">
                                {new Date(tx.createdAt).toLocaleDateString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                        </div>
                    </div>
                    
                    <div className="text-right">
                        <p className={`text-sm font-black ${tx.type === 'deposit' ? 'text-green-600' : 'text-red-600'}`}>
                            {tx.type === 'deposit' ? '+' : '-'}{formatPrice(tx.amount)}
                        </p>
                        <span className={`inline-block mt-1 text-[9px] font-black px-2 py-0.5 rounded-lg uppercase ${
                            tx.status === 'approved' || tx.status === 'success' ? 'bg-green-100 text-green-700' :
                            tx.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                        }`}>
                            {tx.status === 'success' ? 'Thành công' : tx.status === 'pending' ? 'Đang chờ' : 'Thất bại'}
                        </span>
                    </div>
                </div>
            ))}
        </div>
      </div>

      {/* 4. MODAL QUÉT QR - TÍCH HỢP PAYOS */}
      {showQR && paymentInfo && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in" onClick={() => setShowQR(false)}>
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl relative animate-scale-up" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-gray-900 uppercase">Quét mã thanh toán</h3>
              <button onClick={() => setShowQR(false)} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"><IconX /></button>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-3xl border border-blue-100 mb-6 text-center">
                {/* Hiển thị QR Code
                   - PayOS trả về `qrCode` (dạng chuỗi base64) hoặc info để tự build.
                   - Ở đây ta dùng api VietQR + thông tin PayOS trả về để có ảnh QR đẹp nhất 
                */}
                <img 
                    src={`https://img.vietqr.io/image/${paymentInfo.bin}-${paymentInfo.accountNumber}-compact2.png?amount=${paymentInfo.amount}&addInfo=${encodeURIComponent(paymentInfo.description)}&accountName=${encodeURIComponent(paymentInfo.accountName)}`}
                    className="w-full h-auto rounded-xl mix-blend-multiply mb-3" 
                    alt="QR PayOS" 
                />
                
                <p className="text-xs text-blue-600 font-bold mb-1">Số tiền: {formatPrice(paymentInfo.amount)}</p>
                <p className="text-[10px] text-gray-500">Nội dung CK: <span className="font-bold text-black bg-yellow-200 px-1 rounded">{paymentInfo.description}</span></p>
            </div>

            <div className="space-y-3">
                {/* Nút mở App thanh toán (Deep Link) */}
                <a 
                    href={paymentInfo.checkoutUrl} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-4 bg-green-500 hover:bg-green-600 text-white font-black rounded-2xl shadow-lg shadow-green-200 transition-all active:scale-95 uppercase text-xs tracking-widest"
                >
                    <IconCheck /> Mở App thanh toán
                </a>
                
                <button 
                    onClick={() => setShowQR(false)}
                    className="w-full py-3 text-gray-400 font-bold text-sm hover:text-gray-600"
                >
                    Đóng cửa sổ
                </button>
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-100 text-center">
                 <p className="text-[10px] text-gray-400">
                    Hệ thống sẽ tự động cộng tiền sau khi bạn chuyển khoản thành công (10-30s).
                    <br/>Không cần xác nhận thủ công.
                 </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Wallet;