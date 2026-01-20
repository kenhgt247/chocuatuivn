import React, { useState, useEffect } from 'react';
import { db, SystemSettings } from '../services/db';
import { User, Transaction } from '../types';
import { formatPrice } from '../utils/format';

// Icons
import { 
  Wallet as WalletIcon, QrCode, CreditCard,
  XCircle, ArrowUp, ArrowDown, Loader2,
  Banknote, History, CheckCircle, RefreshCcw, User as UserIcon
} from 'lucide-react';

const PRESET_AMOUNTS = [50000, 100000, 200000, 500000, 1000000, 2000000];

// ---------------- Helpers ----------------
const generateRefCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

const removeVietnameseTones = (str: string) =>
  str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toUpperCase();

// ---------------- Component ----------------
const Wallet: React.FC<{
  user: User;
  onUpdateUser: (u: User) => void;
}> = ({ user }) => {

  const [amount, setAmount] = useState('100000');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);

  const [showQRModal, setShowQRModal] = useState(false);
  const [currentRefCode, setCurrentRefCode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // -------- Load data once --------
  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        const [s, txs] = await Promise.all([
          db.getSettings(),
          db.getTransactions(user.id)
        ]);
        if (!mounted) return;
        setSettings(s);
        setTransactions(txs);
      } catch (err) {
        console.error('Wallet load error:', err);
      }
    };

    loadData();
    return () => { mounted = false; };
  }, [user.id]);

  // -------- Handlers --------
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setAmount(e.target.value.replace(/\D/g, ''));

  const handleSelectPreset = (v: number) => setAmount(String(v));

  const handleShowQR = () => {
    if (parseInt(amount) < 10000) return alert('Tối thiểu 10.000đ');
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
      alert('✅ Đã gửi lệnh. Chờ admin duyệt.');
    } catch {
      alert('Có lỗi xảy ra');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    setTransactions(await db.getTransactions(user.id));
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const getVietQRUrl = () => {
    if (!settings?.bankName || !settings?.accountNumber) return '';
    return `https://img.vietqr.io/image/${settings.bankName}-${settings.accountNumber}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(transferContent)}&accountName=${encodeURIComponent(settings.accountName || '')}`;
  };

  // ---------------- UI ----------------
  return (
    <div className="w-full max-w-4xl mx-auto space-y-5 pb-24 px-3 md:px-4 pt-4 font-sans animate-fade-in">

      {/* Wallet Card */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[1.5rem] p-6 text-white shadow-xl">
        <p className="text-[10px] uppercase font-black opacity-80 flex items-center gap-2">
          <WalletIcon className="w-3.5 h-3.5" /> Số dư khả dụng
        </p>
        <div className="flex items-center gap-2 mt-2">
          <h2 className="text-4xl font-black">{formatPrice(user.walletBalance || 0)}</h2>
          <button onClick={handleManualRefresh} className={isRefreshing ? 'animate-spin' : ''}>
            <RefreshCcw className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-3 mt-4">
          {user.avatar ? (
            <img src={user.avatar} className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <UserIcon className="w-6 h-6" />
          )}
          <div>
            <p className="font-bold">{user.name}</p>
            <p className="text-[10px] opacity-70">ID: {user.id.slice(-8).toUpperCase()}</p>
          </div>
        </div>
      </div>

      {/* Deposit */}
      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 bg-white rounded-[1.5rem] p-5 shadow-sm">
          <h3 className="font-black text-sm mb-4 flex items-center gap-2 uppercase">
            <Banknote className="w-4 h-4" /> Nạp tiền
          </h3>

          <input
            type="text"
            value={amount ? parseInt(amount).toLocaleString('vi-VN') : ''}
            onChange={handleAmountChange}
            className="w-full bg-gray-50 border-2 rounded-xl px-4 py-4 font-black text-lg"
          />

          <div className="grid grid-cols-3 gap-2 my-4">
            {PRESET_AMOUNTS.map(v => (
              <button key={v} onClick={() => handleSelectPreset(v)} className="border rounded-xl py-3 font-black text-[10px]">
                {v / 1000}k
              </button>
            ))}
          </div>

          <button
            onClick={handleShowQR}
            disabled={!settings}
            className="w-full bg-primary text-white py-4 rounded-xl font-black uppercase"
          >
            <QrCode className="inline w-4 h-4 mr-2" /> Tạo mã thanh toán
          </button>
        </div>

        {/* History */}
        <div className="lg:col-span-2 bg-white rounded-[1.5rem] p-5 shadow-sm h-[400px] overflow-y-auto">
          <h3 className="font-black text-sm mb-4 flex items-center gap-2 uppercase">
            <History className="w-4 h-4" /> Giao dịch
          </h3>

          {transactions.map(tx => (
            <div key={tx.id} className="flex justify-between items-center p-3 border rounded-xl mb-2">
              <div className="flex items-center gap-3">
                {tx.type === 'deposit' ? <ArrowDown /> : <ArrowUp />}
                <div>
                  <p className="text-xs font-black">{tx.type === 'deposit' ? 'Nạp tiền' : 'Thanh toán'}</p>
                  <p className="text-[9px] text-gray-400">{new Date(tx.createdAt).toLocaleDateString('vi-VN')}</p>
                </div>
              </div>
              <p className="font-black">{formatPrice(tx.amount)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* QR Modal */}
      {showQRModal && settings && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setShowQRModal(false)}>
          <div className="bg-white rounded-[2rem] p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-black uppercase">Thanh toán</h3>
              <XCircle onClick={() => setShowQRModal(false)} />
            </div>
            <img src={getVietQRUrl()} className="mx-auto w-48 h-48" />
            <button
              onClick={handleConfirmTransfer}
              disabled={isProcessing}
              className="w-full mt-4 bg-slate-900 text-white py-4 rounded-xl font-black uppercase"
            >
              {isProcessing ? <Loader2 className="animate-spin" /> : <CheckCircle className="inline w-4 h-4 mr-2" />}
              Tôi đã chuyển khoản
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Wallet;
