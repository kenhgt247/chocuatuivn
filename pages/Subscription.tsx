import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, SubscriptionTier } from '../types';
import { db, SystemSettings } from '../services/db';
import { formatPrice } from '../utils/format';

const Subscription: React.FC<{ user: User | null, onUpdateUser: (u: User) => void }> = ({ user, onUpdateUser }) => {
  const navigate = useNavigate();
  
  // --- STATE ---
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [processingTier, setProcessingTier] = useState<SubscriptionTier | null>(null); // Loading khi đang xử lý
  
  // Modal State
  const [showPayModal, setShowPayModal] = useState<{ tier: SubscriptionTier, price: number } | null>(null);
  const [paymentStep, setPaymentStep] = useState<'method' | 'qr'>('method');
  const [processingMethod, setProcessingMethod] = useState<'wallet' | 'transfer' | null>(null);
  
  // Toast Notification
  const [toast, setToast] = useState<{ show: boolean, message: string, type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });

  // --- INITIAL DATA ---
  useEffect(() => {
    const loadSettings = async () => {
      const s = await db.getSettings();
      setSettings(s);
    };
    loadSettings();
  }, []);

  // --- HELPER FUNCTIONS ---
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
  };

  /**
   * [LOGIC CHUẨN] Kiểm tra trạng thái gói cước
   * Trả về: Có phải gói hiện tại ko? Đã hết hạn chưa? Còn bao nhiêu ngày?
   */
  const checkSubscriptionStatus = (tier: SubscriptionTier) => {
    if (!user) return { isCurrent: false, isExpired: false, daysLeft: 0 };
    
    // 1. Nếu không phải gói user đang gắn -> Không quan tâm
    if (user.subscriptionTier !== tier) return { isCurrent: false, isExpired: false, daysLeft: 0 };
    
    // 2. Gói Free -> Luôn active, không bao giờ hết hạn
    if (tier === 'free') return { isCurrent: true, isExpired: false, daysLeft: 9999 };
    
    // 3. Gói trả phí nhưng data lỗi (không có ngày hết hạn) -> Coi như còn hạn
    if (!user.subscriptionExpires) return { isCurrent: true, isExpired: false, daysLeft: 0 };
    
    const expires = new Date(user.subscriptionExpires).getTime();
    const now = new Date().getTime();
    
    // Tính chênh lệch
    const diffTime = expires - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // Làm tròn lên

    return { 
        isCurrent: true, 
        isExpired: diffTime <= 0, // Hết hạn nếu thời gian <= 0
        daysLeft: diffDays > 0 ? diffDays : 0 // Chỉ hiển thị số dương
    };
  };

  // --- HANDLERS ---
  
  // 1. Bấm nút Nâng cấp / Gia hạn
  const handleUpgradeClick = (tier: SubscriptionTier) => {
    if (!settings) return;
    const config = (settings.tierConfigs as any)[tier];
    if (!config) return;

    const actualPrice = config.price * (1 - settings.tierDiscount / 100);
    
    // Reset Modal
    setPaymentStep('method'); 
    setProcessingMethod(null);
    setShowPayModal({ tier, price: actualPrice });
  };

  // 2. Thanh toán qua Ví
  const payWithWallet = async () => {
    if (!showPayModal || !user) return;
    
    // Check số dư
    if (user.walletBalance < showPayModal.price) {
      showToast("Ví không đủ tiền. Đang chuyển đến trang nạp...", "error");
      setTimeout(() => navigate('/wallet'), 1500);
      return;
    }

    setProcessingMethod('wallet');
    setProcessingTier(showPayModal.tier);

    try {
      const res = await db.buySubscriptionWithWallet(user.id, showPayModal.tier, showPayModal.price);
      
      if (res.success) {
        // Lấy lại info user mới nhất để cập nhật giao diện ngay lập tức
        const updatedUser = await db.getCurrentUser();
        if (updatedUser) onUpdateUser(updatedUser);
        
        showToast("Nâng cấp gói thành công!");
        setShowPayModal(null);
        // Chuyển trang sau khi user kịp đọc thông báo
        setTimeout(() => navigate('/profile'), 1500);
      } else {
        showToast(res.message || "Giao dịch thất bại", "error");
      }
    } catch (error) {
      console.error(error);
      showToast("Lỗi hệ thống", "error");
    } finally {
      setProcessingTier(null);
      setProcessingMethod(null);
    }
  };

  // 3. Chọn chuyển khoản
  const handleSelectTransfer = () => {
      setProcessingMethod('transfer');
      setPaymentStep('qr');
  };

  // 4. Xác nhận đã chuyển khoản
  const confirmTransfer = async () => {
    if (!showPayModal || !user) return;
    setProcessingTier(showPayModal.tier);
    
    try {
      await db.requestSubscriptionTransfer(user.id, showPayModal.tier, showPayModal.price);
      showToast("Yêu cầu đã gửi. Admin sẽ duyệt sớm nhất.");
      setShowPayModal(null);
      setTimeout(() => navigate('/wallet'), 2000); 
    } catch (error) {
      showToast("Lỗi khi gửi yêu cầu", "error");
    } finally {
      setProcessingTier(null);
      setProcessingMethod(null);
    }
  };

  // --- RENDER CONDITION ---
  if (!user || !settings) {
    return <div className="h-screen flex items-center justify-center font-bold text-gray-400 animate-pulse">Đang tải dữ liệu...</div>;
  }

  const tiers: SubscriptionTier[] = ['free', 'basic', 'pro'];
  
  // QR Data
  const transferContent = `MUA GOI ${showPayModal?.tier.toUpperCase()} ${user.phone || user.id.slice(0, 5)}`;
  const qrLink = showPayModal 
    ? `https://img.vietqr.io/image/${settings.bankName}-${settings.accountNumber}-compact.jpg?amount=${Math.round(showPayModal.price)}&addInfo=${encodeURIComponent(transferContent)}&accountName=${encodeURIComponent(settings.accountName)}` 
    : '';

  return (
    <div className="max-w-6xl mx-auto py-16 px-4 relative pb-24 font-sans animate-fade-in">
      
      {/* Toast */}
      {toast.show && (
        <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-[150] px-8 py-4 rounded-2xl shadow-2xl font-black text-xs uppercase tracking-widest animate-fade-in-up flex items-center gap-3 ${toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
           {toast.type === 'success' ? '✅' : '⚠️'} {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-16 space-y-6">
        <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter">Gói Thành Viên</h1>
        <p className="text-slate-500 max-w-2xl mx-auto text-lg leading-relaxed">Nâng cấp đặc quyền để tiếp cận khách hàng và bán hàng nhanh chóng hơn.</p>
        
        <div className="inline-flex items-center gap-3 bg-white px-6 py-3 rounded-full text-sm font-bold border-2 border-primary/20 shadow-sm">
          <span className={`flex h-2 w-2 rounded-full ${user.subscriptionTier === 'free' ? 'bg-gray-400' : 'bg-green-500 animate-pulse'}`}></span>
          Đang sử dụng: <span className="text-primary uppercase ml-1">{(settings.tierConfigs as any)[user.subscriptionTier]?.name || 'Miễn phí'}</span>
        </div>
      </div>

      {/* Grid Packages */}
      <div className="grid md:grid-cols-3 gap-8 items-stretch">
        {tiers.map((tier) => {
          const config = (settings.tierConfigs as any)[tier];
          const status = checkSubscriptionStatus(tier);
          const isPro = tier === 'pro';
          
          const originalPrice = config.price;
          const discountPercent = settings.tierDiscount || 0;
          const discountedPrice = originalPrice * (1 - discountPercent / 100);
          const hasDiscount = discountPercent > 0 && tier !== 'free';

          // LOGIC BUTTON DISABLE / ENABLE
          // - Disable nếu: Đang dùng gói này VÀ (Chưa hết hạn VÀ Còn nhiều hơn 5 ngày)
          // - Enable nếu: Đang dùng gói này NHƯNG (Đã hết hạn HOẶC Sắp hết hạn < 5 ngày)
          // - Enable nếu: Không phải gói đang dùng (Nâng cấp)
          const isRenewable = status.isCurrent && (status.isExpired || status.daysLeft <= 5) && tier !== 'free';
          const isButtonDisabled = status.isCurrent && !isRenewable && tier !== 'free';
          const isFreeTierActive = status.isCurrent && tier === 'free'; // Gói free đang dùng thì luôn disable nút

          // Text nút bấm
          let buttonText = 'Nâng cấp ngay';
          if (isFreeTierActive) buttonText = 'Đang sử dụng';
          else if (isRenewable) buttonText = 'Gia hạn ngay';
          else if (status.isCurrent) buttonText = 'Gói đang dùng';

          return (
            <div key={tier} className={`group relative flex flex-col p-8 md:p-10 transition-all duration-500 rounded-[3.5rem] ${
              isPro 
              ? 'bg-white border-4 border-yellow-400 shadow-[0_20px_50px_rgba(234,179,8,0.2)] scale-105 z-10' 
              : 'bg-white border-2 border-slate-100 hover:border-primary/30 hover:shadow-2xl shadow-slate-200/50'
            } ${status.isCurrent && !status.isExpired ? 'ring-2 ring-primary ring-offset-4' : ''}`}>
              
              {isPro && (
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-[11px] font-black px-6 py-2 rounded-full shadow-xl uppercase tracking-[0.2em] whitespace-nowrap animate-bounce-subtle">
                  Phổ biến nhất
                </div>
              )}
              
              <div className="mb-10 text-center">
                <h3 className={`text-xl font-black mb-6 uppercase tracking-widest ${isPro ? 'text-yellow-600' : 'text-slate-800'}`}>
                  {config.name}
                </h3>

                <div className="flex flex-col items-center justify-center min-h-[90px]">
                  {hasDiscount ? (
                    <>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-slate-400 line-through text-sm font-bold">{formatPrice(originalPrice)}</span>
                        <span className="bg-red-500 text-white text-[10px] font-black px-2.5 py-1 rounded-lg uppercase shadow-sm">-{discountPercent}%</span>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-black tracking-tighter text-slate-900">{formatPrice(discountedPrice)}</span>
                        <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">/tháng</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-black tracking-tighter text-slate-900">{tier === 'free' ? '0đ' : formatPrice(originalPrice)}</span>
                      {tier !== 'free' && <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">/tháng</span>}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4 mb-10 flex-1">
                {/* Stats */}
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 group-hover:bg-white transition-colors">
                  <span className="text-2xl">🚀</span>
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-400 leading-none mb-1">Hạn mức đăng tin</p>
                    <p className="text-sm font-bold text-slate-800">{config.postsPerDay >= 900 ? 'Không giới hạn' : `${config.postsPerDay} tin mỗi ngày`}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 group-hover:bg-white transition-colors">
                  <span className="text-2xl">{config.autoApprove ? '✅' : '⏳'}</span>
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-400 leading-none mb-1">Kiểm duyệt</p>
                    <p className="text-sm font-bold text-slate-800">{config.autoApprove ? 'Tự động (Hiện ngay)' : 'Chờ Admin duyệt'}</p>
                  </div>
                </div>

                <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent my-6"></div>

                {/* Feature List */}
                <ul className="space-y-4 px-2">
                  {config.features.map((f: string, i: number) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <div className={`mt-1 flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center ${isPro ? 'bg-yellow-500' : 'bg-primary'}`}>
                        <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="4"><path d="M5 13l4 4L19 7" /></svg>
                      </div>
                      <span className="text-slate-600 font-semibold leading-tight">{f}</span>
                    </li>
                  ))}
                  
                  {tier === 'pro' && (
                      <li className="flex items-start gap-3 text-sm font-bold text-orange-600 animate-pulse">
                          <span className="text-lg">💰</span>
                          Mở khóa Tiếp thị liên kết (Affiliate)
                      </li>
                  )}
                </ul>
              </div>

              <div className="space-y-4">
                  <button 
                    disabled={isButtonDisabled || isFreeTierActive} 
                    onClick={() => handleUpgradeClick(tier)} 
                    className={`w-full py-5 rounded-2xl font-black text-sm uppercase tracking-[0.1em] transition-all duration-300 transform active:scale-95 shadow-xl flex items-center justify-center gap-2
                        ${(isButtonDisabled || isFreeTierActive)
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none' 
                            : isPro 
                                ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-yellow-200 hover:shadow-yellow-400 hover:-translate-y-1' 
                                : 'bg-slate-900 text-white shadow-slate-200 hover:bg-slate-800 hover:-translate-y-1'
                        }`}
                  >
                    {processingTier === tier && <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>}
                    {buttonText}
                  </button>
                  
                  {/* Status Label (Hiển thị thời hạn) */}
                  {status.isCurrent && tier !== 'free' && (
                      <div className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-[11px] font-black uppercase tracking-wider bg-white border-2 
                        ${status.isExpired || status.daysLeft < 3 
                          ? 'text-red-500 border-red-100 animate-pulse' 
                          : 'text-slate-500 border-slate-100'
                        }`}>
                          {status.isExpired 
                            ? '❌ Gói đã hết hạn' 
                            : `⏳ Hiệu lực: ${status.daysLeft} ngày`}
                      </div>
                  )}
              </div>
            </div>
          );
        })}
      </div>

      {/* --- PAYMENT MODAL --- */}
      {showPayModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-10 shadow-2xl relative space-y-8 animate-fade-in-up border border-white">
            
            {/* Header Modal */}
            <div className="text-center">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-2">
                    {paymentStep === 'method' ? 'Bước 1: Chọn thanh toán' : 'Bước 2: Quét mã QR'}
                </p>
                <h3 className="text-2xl font-black text-slate-900">{(settings.tierConfigs as any)[showPayModal.tier]?.name}</h3>
                <div className="mt-4 flex flex-col items-center">
                   <span className="text-3xl font-black text-primary">{formatPrice(showPayModal.price)}</span>
                </div>
            </div>
            
            {/* STEP 1: METHOD SELECTION */}
            {paymentStep === 'method' && (
                <div className="space-y-4">
                  <button onClick={payWithWallet} disabled={processingTier !== null} className={`w-full flex items-center justify-between p-5 border-2 rounded-[2rem] transition-all group active:scale-95 ${processingMethod === 'wallet' ? 'border-primary bg-primary/5' : 'border-slate-100 hover:border-primary hover:shadow-md'}`}>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center text-2xl shadow-sm group-hover:scale-110 transition-transform">💳</div>
                      <div className="text-left">
                        <p className="text-[10px] font-black uppercase text-slate-400">Thanh toán qua</p>
                        <p className="text-xs font-black text-slate-800">Ví Chợ Của Tui</p>
                      </div>
                    </div>
                    {processingMethod === 'wallet' ? <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div> : <div className="w-6 h-6 rounded-full border-2 border-slate-200 group-hover:border-primary"></div>}
                  </button>

                  <button onClick={handleSelectTransfer} className={`w-full flex items-center justify-between p-5 border-2 rounded-[2rem] transition-all group active:scale-95 border-slate-100 hover:border-primary hover:shadow-md`}>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-500 flex items-center justify-center text-2xl shadow-sm group-hover:scale-110 transition-transform">🏦</div>
                      <div className="text-left">
                        <p className="text-[10px] font-black uppercase text-slate-400">Thanh toán qua</p>
                        <p className="text-xs font-black text-slate-800">Chuyển khoản</p>
                      </div>
                    </div>
                    <div className="w-6 h-6 rounded-full border-2 border-slate-200 group-hover:border-primary"></div>
                  </button>
                </div>
            )}

            {/* STEP 2: QR SCAN */}
            {paymentStep === 'qr' && (
                <div className="space-y-6 animate-fade-in-up">
                    <div className="bg-slate-50 p-4 rounded-[2rem] border border-slate-100 flex flex-col items-center text-center space-y-4">
                        <div className="p-2 bg-white rounded-2xl shadow-sm">
                            <img src={qrLink} alt="VietQR" className="w-48 h-48 object-contain" />
                        </div>
                        <div className="space-y-1 w-full">
                            <p className="text-[10px] font-black text-slate-400 uppercase">Nội dung chuyển khoản</p>
                            <p className="text-xs font-black bg-yellow-100 text-yellow-800 px-3 py-1.5 rounded-lg select-all break-all">{transferContent}</p>
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium px-4">
                            Hệ thống sẽ tự động duyệt sau khi nhận được tiền (5-10 phút).
                        </div>
                    </div>
                    
                    <button onClick={confirmTransfer} disabled={processingTier !== null} className="w-full bg-green-500 text-white font-black py-4 rounded-[1.5rem] hover:bg-green-600 transition-all shadow-lg active:scale-95 uppercase text-xs tracking-widest flex items-center justify-center gap-2">
                        {processingTier ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <span>✅ Tôi đã chuyển khoản</span>}
                    </button>
                </div>
            )}

            <button onClick={() => { if(paymentStep === 'qr') setPaymentStep('method'); else setShowPayModal(null); }} disabled={processingTier !== null} className="w-full py-4 rounded-xl font-black text-xs text-slate-400 uppercase hover:bg-slate-50 transition-all tracking-widest">
                {paymentStep === 'qr' ? 'Quay lại' : 'Hủy giao dịch'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Subscription;
