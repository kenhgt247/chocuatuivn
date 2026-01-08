import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, SubscriptionTier } from '../types';
import { TIER_CONFIG } from '../constants';
import { db, SystemSettings } from '../services/db';
import { formatPrice } from '../utils/format';

const Subscription: React.FC<{ user: User | null, onUpdateUser: (u: User) => void }> = ({ user, onUpdateUser }) => {
  const navigate = useNavigate();
  
  // State quản lý logic
  const [loading, setLoading] = useState<SubscriptionTier | null>(null);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [showPayModal, setShowPayModal] = useState<{ tier: SubscriptionTier, price: number } | null>(null);
  
  // State quản lý hiệu ứng loading riêng cho từng nút trong Modal
  const [processingMethod, setProcessingMethod] = useState<'wallet' | 'transfer' | null>(null);

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
    // Cho phép click nếu khác tier hiện tại HOẶC tier hiện tại đã/sắp hết hạn
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

    setProcessingMethod('wallet');
    setLoading(showPayModal.tier);

    try {
      const res = await db.buySubscriptionWithWallet(user.id, showPayModal.tier, showPayModal.price);
      if (res.success) {
        const updated = await db.getCurrentUser();
        if (updated) onUpdateUser(updated);
        showToast("Nâng cấp gói thành công!");
        setShowPayModal(null);
        setTimeout(() => navigate('/profile'), 1500);
      } else {
        showToast(res.message || "Giao dịch thất bại", "error");
      }
    } catch (error) {
      showToast("Lỗi hệ thống", "error");
    } finally {
      setLoading(null);
      setProcessingMethod(null);
    }
  };

  const payWithTransfer = async () => {
    if (!showPayModal) return;

    setProcessingMethod('transfer');
    setLoading(showPayModal.tier);

    try {
      await db.requestSubscriptionTransfer(user.id, showPayModal.tier, showPayModal.price);
      showToast("Yêu cầu đã được gửi. Chờ Admin duyệt.");
      setShowPayModal(null);
      setTimeout(() => navigate('/wallet'), 1500);
    } catch (error) {
      showToast("Lỗi khi gửi yêu cầu", "error");
    } finally {
      setLoading(null);
      setProcessingMethod(null);
    }
  };

  // --- [LOGIC MỚI] KIỂM TRA HẠN DÙNG ---
  const checkSubscriptionStatus = (tier: SubscriptionTier) => {
      // 1. Nếu user không phải tier này -> Không phải current
      if (user.subscriptionTier !== tier) return { isCurrent: false, isExpired: false, daysLeft: 0 };

      // 2. Nếu là gói Free -> Luôn là current, không bao giờ hết hạn
      if (tier === 'free') return { isCurrent: true, isExpired: false, daysLeft: 9999 };

      // 3. Kiểm tra ngày hết hạn
      if (!user.subscriptionExpires) return { isCurrent: true, isExpired: false, daysLeft: 0 };

      const expires = new Date(user.subscriptionExpires);
      const now = new Date();
      const diffTime = expires.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return {
          isCurrent: true,
          isExpired: diffDays <= 0,
          daysLeft: diffDays
      };
  };

  const tiers: SubscriptionTier[] = ['free', 'basic', 'pro'];

  return (
    <div className="max-w-5xl mx-auto py-10 px-4 relative pb-24">
      {/* Toast Notification */}
      {toast.show && (
        <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-[110] px-6 py-3 rounded-2xl shadow-2xl font-black text-xs uppercase tracking-widest animate-fade-in-up flex items-center gap-3 ${toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
           <span>{toast.type === 'success' ? '✅' : '❌'}</span>
           {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-12 space-y-4">
        <h1 className="text-3xl md:text-4xl font-black text-textMain tracking-tight">Nâng cấp đặc quyền</h1>
        <p className="text-gray-500 max-w-lg mx-auto text-sm md:text-base">Tăng khả năng bán hàng gấp nhiều lần với các gói VIP.</p>
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-bold">
          <span>⚡</span> Gói hiện tại: {TIER_CONFIG[user.subscriptionTier]?.name || user.subscriptionTier}
        </div>
      </div>

      {/* Tier Cards Grid */}
      <div className="grid md:grid-cols-3 gap-6 md:gap-8">
        {tiers.map((tier) => {
          const config = settings.tierConfigs[tier];
          const status = checkSubscriptionStatus(tier);
          const isPro = tier === 'pro';
          const tierName = tier === 'free' ? 'Miễn Phí' : tier === 'basic' ? 'Gói Basic' : 'Gói Pro VIP';
          
          let displayPrice = tier === 'free' ? '0đ' : formatPrice(config.price * (1 - settings.tierDiscount / 100));

          // Logic nút bấm: Disable nếu đang dùng VÀ chưa hết hạn
          const isButtonDisabled = status.isCurrent && !status.isExpired && tier !== 'free'; 
          // Cho phép gia hạn nếu sắp hết hạn (ví dụ < 5 ngày) hoặc đã hết hạn
          const showRenew = status.isCurrent && (status.isExpired || status.daysLeft < 5) && tier !== 'free';

          return (
            <div key={tier} className={`relative bg-white border-2 rounded-[2rem] p-6 md:p-8 flex flex-col transition-all hover:border-primary/50 hover:shadow-xl ${isPro ? 'border-yellow-400 shadow-lg shadow-yellow-100' : 'border-gray-100'} ${status.isCurrent && !status.isExpired ? 'bg-gray-50' : ''}`}>
              {isPro && <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-[10px] font-black px-4 py-1.5 rounded-full shadow-lg uppercase tracking-widest whitespace-nowrap">Phổ biến nhất</div>}
              
              <div className="mb-6 md:mb-8">
                <h3 className={`text-lg md:text-xl font-black mb-2 uppercase ${isPro ? 'text-yellow-600' : 'text-gray-900'}`}>{tierName}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl md:text-3xl font-black">{displayPrice}</span>
                  {tier !== 'free' && <span className="text-gray-400 text-xs md:text-sm font-bold">/tháng</span>}
                </div>
              </div>

              <ul className="space-y-4 mb-8 flex-1">
                {config.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <svg className={`w-5 h-5 flex-shrink-0 mt-0.5 ${isPro ? 'text-yellow-500' : 'text-primary'}`} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                    <span className="text-gray-600 font-medium leading-tight">{f}</span>
                  </li>
                ))}
              </ul>

              <div className="space-y-2">
                  <button 
                    disabled={isButtonDisabled && !showRenew} 
                    onClick={() => handleUpgradeClick(tier)} 
                    className={`w-full py-3.5 rounded-xl font-black text-sm uppercase tracking-wider transition-all active:scale-95 
                        ${isButtonDisabled && !showRenew 
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                            : isPro 
                                ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-lg shadow-orange-200 hover:shadow-xl' 
                                : 'bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primaryHover'
                        }`}
                  >
                    {showRenew ? 'Gia hạn ngay' : status.isCurrent ? 'Đang sử dụng' : 'Nâng cấp ngay'}
                  </button>
                  
                  {/* Hiển thị ngày hết hạn nếu đang dùng */}
                  {status.isCurrent && tier !== 'free' && (
                      <p className={`text-[10px] text-center font-bold ${status.daysLeft < 3 ? 'text-red-500' : 'text-gray-400'}`}>
                          {status.isExpired 
                              ? 'Đã hết hạn' 
                              : `Hết hạn sau ${status.daysLeft} ngày`
                          }
                      </p>
                  )}
              </div>
            </div>
          );
        })}
      </div>

      {/* --- PHẦN MODAL THANH TOÁN (GIỮ NGUYÊN UI) --- */}
      {showPayModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !loading && setShowPayModal(null)}></div>
          
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-6 md:p-8 shadow-2xl relative space-y-6 animate-fade-in-up border border-gray-100">
            
            <div className="text-center">
                <h3 className="text-xl font-black text-gray-800">Thanh toán</h3>
                <p className="text-sm text-gray-500 mt-2 font-medium bg-gray-50 py-2 px-4 rounded-xl inline-block">
                    Gói <span className="font-black text-primary uppercase">{showPayModal.tier}</span> 
                    <span className="mx-2 text-gray-300">|</span> 
                    <span className="font-black text-gray-800">{formatPrice(showPayModal.price)}</span>
                </p>
            </div>
            
            <div className="space-y-3">
              <button 
                onClick={payWithWallet}
                disabled={loading !== null}
                className={`w-full flex items-center justify-between p-4 border-2 rounded-2xl transition-all duration-200 group relative overflow-hidden active:scale-95
                  ${processingMethod === 'wallet' ? 'border-primary bg-blue-50' : 'border-gray-100 hover:border-primary hover:bg-blue-50/50 hover:shadow-md'}
                  disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-2xl shadow-sm">💳</div>
                  <div className="text-left">
                    <p className="text-sm font-black uppercase text-gray-800 group-hover:text-primary transition-colors">Ví của tôi</p>
                    <p className="text-[11px] font-bold text-gray-400">Số dư: <span className="text-green-600">{formatPrice(user.walletBalance)}</span></p>
                  </div>
                </div>
                
                {processingMethod === 'wallet' ? (
                   <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                ) : (
                   <div className="w-6 h-6 rounded-full border-2 border-gray-200 group-hover:border-primary group-active:bg-primary flex items-center justify-center">
                      <div className="w-2.5 h-2.5 bg-white rounded-full opacity-0 group-active:opacity-100"></div>
                   </div>
                )}
              </button>

              <button 
                onClick={payWithTransfer}
                disabled={loading !== null}
                className={`w-full flex items-center justify-between p-4 border-2 rounded-2xl transition-all duration-200 group relative overflow-hidden active:scale-95
                  ${processingMethod === 'transfer' ? 'border-primary bg-purple-50' : 'border-gray-100 hover:border-primary hover:bg-purple-50/50 hover:shadow-md'}
                  disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-2xl shadow-sm">🏦</div>
                  <div className="text-left">
                    <p className="text-sm font-black uppercase text-gray-800 group-hover:text-primary transition-colors">Chuyển khoản</p>
                    <p className="text-[11px] font-bold text-gray-400">Duyệt thủ công (15p)</p>
                  </div>
                </div>
                
                {processingMethod === 'transfer' ? (
                   <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                   <div className="w-6 h-6 rounded-full border-2 border-gray-200 group-hover:border-primary group-active:bg-primary flex items-center justify-center">
                      <div className="w-2.5 h-2.5 bg-white rounded-full opacity-0 group-active:opacity-100"></div>
                   </div>
                )}
              </button>
            </div>

            <button 
                onClick={() => !loading && setShowPayModal(null)} 
                disabled={loading !== null}
                className="w-full py-3 rounded-xl font-black text-xs text-gray-400 uppercase hover:bg-gray-100 hover:text-gray-600 active:scale-95 transition-all"
            >
                Hủy bỏ
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Subscription;
