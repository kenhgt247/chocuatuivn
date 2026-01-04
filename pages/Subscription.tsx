
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, SubscriptionTier } from '../types';
import { TIER_CONFIG } from '../constants';
import { db, SystemSettings } from '../services/db';
import { formatPrice } from '../utils/format';

const Subscription: React.FC<{ user: User | null, onUpdateUser: (u: User) => void }> = ({ user, onUpdateUser }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<SubscriptionTier | null>(null);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [showPayModal, setShowPayModal] = useState<{ tier: SubscriptionTier, price: number } | null>(null);
  const [toast, setToast] = useState<{ show: boolean, message: string, type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });

  useEffect(() => {
    const loadSettings = async () => {
      const s = await db.getSettings();
      setSettings(s);
    };
    loadSettings();
  }, []);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
  };

  if (!user || !settings) {
    if (!user) navigate('/login');
    return null;
  }

  const handleUpgradeClick = (tier: SubscriptionTier) => {
    if (tier === user.subscriptionTier) return;
    const config = settings.tierConfigs[tier];
    if (!config) return;
    const actualPrice = config.price * (1 - settings.tierDiscount / 100);
    setShowPayModal({ tier, price: actualPrice });
  };

  const payWithWallet = async () => {
    if (!showPayModal) return;
    if (user.walletBalance < showPayModal.price) {
      showToast("Ví không đủ tiền. Vui lòng nạp thêm.", "error");
      setTimeout(() => navigate('/wallet'), 1500);
      return;
    }

    setLoading(showPayModal.tier);
    const res = await db.buySubscriptionWithWallet(user.id, showPayModal.tier, showPayModal.price);
    if (res.success) {
      const updated = await db.getCurrentUser();
      if (updated) onUpdateUser(updated);
      showToast("Nâng cấp gói thành công!");
      setTimeout(() => navigate('/profile'), 1500);
    } else {
      showToast(res.message || "Giao dịch thất bại", "error");
    }
    setLoading(null);
    setShowPayModal(null);
  };

  const payWithTransfer = async () => {
    if (!showPayModal) return;
    setLoading(showPayModal.tier);
    await db.requestSubscriptionTransfer(user.id, showPayModal.tier, showPayModal.price);
    showToast("Yêu cầu đã được gửi. Chờ Admin duyệt.");
    setTimeout(() => navigate('/wallet'), 1500);
    setLoading(null);
    setShowPayModal(null);
  };

  const tiers: SubscriptionTier[] = ['free', 'basic', 'pro'];

  return (
    <div className="max-w-5xl mx-auto py-10 px-4 relative">
      {/* Toast Notification */}
      {toast.show && (
        <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-[110] px-6 py-3 rounded-2xl shadow-2xl font-black text-xs uppercase tracking-widest animate-fade-in-up flex items-center gap-3 ${toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
           <span>{toast.type === 'success' ? '✅' : '❌'}</span>
           {toast.message}
        </div>
      )}

      <div className="text-center mb-12 space-y-4">
        <h1 className="text-4xl font-black text-textMain tracking-tight">Nâng cấp đặc quyền</h1>
        <p className="text-gray-500 max-w-lg mx-auto">Tăng khả năng bán hàng gấp nhiều lần với các gói VIP.</p>
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-bold">
          <span>⚡</span> Gói hiện tại: {TIER_CONFIG[user.subscriptionTier]?.name || user.subscriptionTier}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {tiers.map((tier) => {
          const config = settings.tierConfigs[tier];
          const isCurrent = user.subscriptionTier === tier;
          const isPro = tier === 'pro';
          const tierName = tier === 'free' ? 'Miễn Phí' : tier === 'basic' ? 'Gói Basic' : 'Gói Pro VIP';
          
          let displayPrice = tier === 'free' ? '0đ' : formatPrice(config.price * (1 - settings.tierDiscount / 100));

          return (
            <div key={tier} className={`relative bg-white border-2 rounded-3xl p-8 flex flex-col transition-all hover:scale-[1.03] ${isPro ? 'border-yellow-400 shadow-xl shadow-yellow-100' : 'border-borderMain'} ${isCurrent ? 'bg-gray-50 opacity-80' : ''}`}>
              {isPro && <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-[10px] font-black px-6 py-1.5 rounded-full shadow-lg uppercase tracking-widest">Phổ biến nhất</div>}
              <div className="mb-8">
                <h3 className={`text-xl font-black mb-2 uppercase ${isPro ? 'text-yellow-600' : 'text-gray-900'}`}>{tierName}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black">{displayPrice}</span>
                  {tier !== 'free' && <span className="text-gray-400 text-sm">/tháng</span>}
                </div>
              </div>
              <ul className="space-y-4 mb-10 flex-1">
                {config.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <svg className={`w-5 h-5 flex-shrink-0 mt-0.5 ${isPro ? 'text-yellow-500' : 'text-primary'}`} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                    <span className="text-gray-600 font-medium">{f}</span>
                  </li>
                ))}
              </ul>
              <button disabled={isCurrent || loading === tier} onClick={() => handleUpgradeClick(tier)} className={`w-full py-4 rounded-2xl font-black transition-all ${isCurrent ? 'bg-gray-100 text-gray-400' : isPro ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white' : 'bg-primary text-white'}`}>
                {isCurrent ? 'Gói đang dùng' : loading === tier ? 'Đang xử lý...' : 'Nâng cấp ngay'}
              </button>
            </div>
          );
        })}
      </div>

      {showPayModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowPayModal(null)}></div>
          <div className="bg-white w-full max-w-sm rounded-[2rem] p-8 shadow-2xl relative space-y-6">
            <h3 className="text-xl font-black">Chọn hình thức thanh toán</h3>
            <p className="text-sm text-gray-500">Bạn đang mua gói <span className="font-bold text-primary">{showPayModal.tier.toUpperCase()}</span> với giá <span className="font-bold">{formatPrice(showPayModal.price)}</span></p>
            
            <div className="space-y-3">
              <button onClick={payWithWallet} className="w-full flex items-center justify-between p-4 border-2 border-gray-100 rounded-2xl hover:border-primary transition-all group">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">💳</span>
                  <div className="text-left">
                    <p className="text-sm font-black uppercase">Thanh toán qua Ví</p>
                    <p className="text-[10px] text-gray-400">Số dư: {formatPrice(user.walletBalance)}</p>
                  </div>
                </div>
                <div className="w-6 h-6 rounded-full border-2 group-hover:border-primary"></div>
              </button>

              <button onClick={payWithTransfer} className="w-full flex items-center justify-between p-4 border-2 border-gray-100 rounded-2xl hover:border-primary transition-all group">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🏦</span>
                  <div className="text-left">
                    <p className="text-sm font-black uppercase">Chuyển khoản Ngân hàng</p>
                    <p className="text-[10px] text-gray-400">Chờ Admin phê duyệt (5-30p)</p>
                  </div>
                </div>
                <div className="w-6 h-6 rounded-full border-2 group-hover:border-primary"></div>
              </button>
            </div>

            <button onClick={() => setShowPayModal(null)} className="w-full text-xs font-bold text-gray-400 uppercase py-2">Hủy bỏ</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Subscription;
