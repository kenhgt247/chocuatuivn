import React, { useEffect, useRef, useState } from 'react';
import { db, SystemSettings } from '../services/db';
import { User, Transaction } from '../types';
import { formatPrice } from '../utils/format';

/* ============================================================================
   ICONS INLINE – KHÔNG PHỤ THUỘC LIB (AN TOÀN TUYỆT ĐỐI)
============================================================================ */
const IconWallet = () => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 12V8H6a2 2 0 1 1 0-4h12v4"/><path d="M4 6v12a2 2 0 0 0 2 2h14v-4"/><path d="M18 12a2 2 0 1 0 0 4h4v-4z"/></svg>;
const IconRotate = ({ spin }: { spin?: boolean }) => (
  <svg width="16" height="16" className={spin ? 'animate-spin' : ''} fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 12a9 9 0 1 0 3-6"/><path d="M3 3v5h5"/>
  </svg>
);
const IconDown = () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>;
const IconUp = () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>;
const IconX = () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 18 18"/></svg>;
const IconCheck = () => <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>;
const IconLoader = () => <svg width="18" height="18" className="animate-spin" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.2-8.6"/></svg>;

/* ============================================================================
   CONSTANTS + HELPERS
============================================================================ */
const PRESET_AMOUNTS = [50_000, 100_000, 200_000, 500_000, 1_000_000, 2_000_000];

const generateRefCode = () =>
  Math.random().toString(36).substring(2, 6).toUpperCase();

const normalizeVN = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

/* ============================================================================
   COMPONENT
============================================================================ */
interface Props {
  user: User | null;
}

const Wallet: React.FC<Props> = ({ user }) => {
  /* 🚫 KHÔNG USER → KHÔNG RENDER (route guard ở App.tsx) */
  if (!user) return null;

  const mountedRef = useRef(true);

  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [amount, setAmount] = useState('100000');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [refCode, setRefCode] = useState('');

  /* ================= LOAD DATA (SAFE) ================= */
  useEffect(() => {
    mountedRef.current = true;

    const load = async () => {
      try {
        const [s, tx] = await Promise.all([
          db.getSettings(),
          db.getTransactions(user.id),
        ]);
        if (!mountedRef.current) return;
        setSettings(s);
        setTransactions(tx);
      } catch (e) {
        console.error(e);
      }
    };

    load();
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

  const handleShowQR = () => {
    if (+amount < 10_000) return alert('Tối thiểu 10.000đ');
    setRefCode(generateRefCode());
    setShowQR(true);
  };

  const transferContent = `NAP ${refCode} ${normalizeVN(user.name)}`.slice(0, 50);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await db.requestDeposit(user.id, +amount, transferContent);
      const tx = await db.getTransactions(user.id);
      if (mountedRef.current) {
        setTransactions(tx);
        setShowQR(false);
      }
      alert('✅ Đã gửi lệnh, chờ duyệt');
    } finally {
      mountedRef.current && setLoading(false);
    }
  };

  const vietQR =
    settings?.bankName && settings?.accountNumber
      ? `https://img.vietqr.io/image/${settings.bankName}-${settings.accountNumber}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(transferContent)}`
      : '';

  /* ================= RENDER ================= */
  return (
    <div className="max-w-4xl mx-auto px-4 pb-24 space-y-6 font-sans">
      {/* CARD */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow">
        <p className="text-xs uppercase opacity-80 flex items-center gap-2">
          <IconWallet /> Số dư khả dụng
        </p>
        <div className="flex items-center gap-3 mt-2">
          <h2 className="text-4xl font-black">{formatPrice(user.walletBalance)}</h2>
          <button onClick={handleRefresh} className="p-2 bg-white/10 rounded-full">
            <IconRotate spin={refreshing} />
          </button>
        </div>
      </div>

      {/* NẠP */}
      <div className="bg-white rounded-2xl p-6 shadow space-y-4">
        <input
          value={Number(amount).toLocaleString('vi-VN')}
          onChange={e => setAmount(e.target.value.replace(/\D/g, ''))}
          className="w-full text-xl font-black p-4 bg-gray-50 rounded-xl"
        />

        <div className="grid grid-cols-3 gap-2">
          {PRESET_AMOUNTS.map(v => (
            <button
              key={v}
              onClick={() => setAmount(String(v))}
              className={`py-3 rounded-xl font-black text-xs ${
                +amount === v ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-400'
              }`}
            >
              {v / 1000}k
            </button>
          ))}
        </div>

        <button
          onClick={handleShowQR}
          disabled={!settings}
          className="w-full py-4 bg-blue-600 text-white font-black rounded-xl"
        >
          Tạo mã thanh toán
        </button>
      </div>

      {/* LỊCH SỬ */}
      <div className="bg-white rounded-2xl p-6 shadow space-y-3 max-h-[400px] overflow-y-auto">
        {transactions.length === 0 && (
          <p className="text-center text-gray-400 text-xs">Chưa có giao dịch</p>
        )}
        {transactions.map(tx => (
          <div key={tx.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-xl">
            <div className="flex items-center gap-2">
              {tx.type === 'deposit' ? <IconDown /> : <IconUp />}
              <div>
                <p className="text-xs font-bold">{tx.type === 'deposit' ? 'Nạp tiền' : 'Thanh toán'}</p>
                <p className="text-[10px] text-gray-400">{new Date(tx.createdAt).toLocaleDateString('vi-VN')}</p>
              </div>
            </div>
            <div className="text-right">
              <p className={`font-black text-xs ${tx.type === 'deposit' ? 'text-green-600' : 'text-red-600'}`}>
                {tx.type === 'deposit' ? '+' : '-'}
                {formatPrice(tx.amount)}
              </p>
              <span className="text-[9px] uppercase opacity-70">{tx.status}</span>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL */}
      {showQR && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setShowQR(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-black">Thanh toán</h3>
              <button onClick={() => setShowQR(false)}><IconX /></button>
            </div>
            <img src={vietQR} className="w-48 h-48 mx-auto" />
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="w-full mt-6 py-4 bg-black text-white font-black rounded-xl flex justify-center gap-2"
            >
              {loading ? <IconLoader /> : <IconCheck />} Tôi đã chuyển khoản
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Wallet;
