import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, SubscriptionTier } from '../types';
import { db, SystemSettings } from '../services/db';
import { formatPrice } from '../utils/format';

// --- ICONS (GIỮ NGUYÊN) ---
const IconCheck = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const IconCrown = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/></svg>;
const IconZap = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>;
const IconStar = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
const IconShield = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
const IconLoader2 = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>;
const IconWallet = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>;
const IconLandmark = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/></svg>;
const IconCheckCircle = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;
const IconAlertTriangle = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
const IconClock = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
const IconChevronRight = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>;
const IconSparkles = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M9 5H5"/><path d="M19 15v4"/><path d="M23 17h-4"/></svg>;
const IconX = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>;

const Subscription: React.FC<{ user: User | null, onUpdateUser: (u: User) => void }> = ({ user, onUpdateUser }) => {
  const navigate = useNavigate();
  const mountedRef = useRef(true);
  
  // --- STATE ---
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loadingPkg, setLoadingPkg] = useState<string | null>(null);
  
  // Modal State
  const [showPayModal, setShowPayModal] = useState<{ tier: string, price: number, name: string } | null>(null);
  const [paymentStep, setPaymentStep] = useState<'method' | 'qr'>('method');
  const [processingMethod, setProcessingMethod] = useState<'wallet' | 'transfer' | 'points' | null>(null); // Thêm 'points'
  
  // PayOS State
  const [payOSInfo, setPayOSInfo] = useState<any>(null); // Lưu thông tin QR trả về từ PayOS
  
  // Toast Notification
  const [toast, setToast] = useState<{ show: boolean, message: string, type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });

  // --- INITIAL DATA ---
  useEffect(() => {
    mountedRef.current = true;
    const loadSettings = async () => {
      const s = await db.getSettings();
      if(mountedRef.current) setSettings(s);
    };
    loadSettings();
    return () => { mountedRef.current = false; };
  }, []);

  // --- AUTO CHECK BALANCE ---
  // Tự động kiểm tra nếu người dùng nạp tiền xong (số dư tăng lên đủ trả) thì chuyển về tab Ví
  useEffect(() => {
    if (showPayModal && user && user.walletBalance >= showPayModal.price && paymentStep === 'qr') {
        // Nếu đang ở màn hình QR mà tiền đã vào ví -> Chuyển về màn hình xác nhận thanh toán ví
        setPaymentStep('method');
        setProcessingMethod('wallet'); // Gợi ý thanh toán ví ngay
        showToast("Tiền đã vào ví! Vui lòng xác nhận nâng cấp.", "success");
    }
  }, [user?.walletBalance, showPayModal, paymentStep]);


  // --- BIẾN ĐỔI DỮ LIỆU ĐỘNG TỪ DB THÀNH MẢNG GÓI CƯỚC ---
  const dynamicPackages = useMemo(() => {
    if (!settings || !settings.tierConfigs) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pkgs = Object.entries(settings.tierConfigs).map(([key, config]: [string, any]) => {
        let style = {
            color: 'bg-slate-100 text-slate-600',
            border: 'border-slate-200',
            icon: <IconStar className="w-6 h-6" />,
            isPopular: false,
            btnColor: 'bg-slate-900 text-white'
        };

        if (key === 'free') {
            style = {
                color: 'bg-slate-100 text-slate-600',
                border: 'border-slate-200',
                icon: <IconShield className="w-6 h-6" />,
                isPopular: false,
                btnColor: 'bg-slate-200 text-slate-500'
            };
        } else if (key === 'basic' || config.price < 50000) {
            style = {
                color: 'bg-blue-50 text-blue-600',
                border: 'border-blue-200',
                icon: <IconZap className="w-6 h-6" />,
                isPopular: false,
                btnColor: 'bg-blue-600 text-white'
            };
        } else if (key === 'pro' || config.price >= 50000) {
            style = {
                color: 'bg-yellow-50 text-yellow-700',
                border: 'border-yellow-400',
                icon: <IconCrown className="w-6 h-6 fill-yellow-400 text-yellow-600" />,
                isPopular: true,
                btnColor: 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white'
            };
        }

        return { id: key, ...config, ...style };
    });

    return pkgs.sort((a, b) => a.price - b.price);
  }, [settings]);

  // --- HELPER FUNCTIONS ---
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
  };

  const checkSubscriptionStatus = (tierId: string) => {
    if (!user) return { isCurrent: false, isExpired: false, daysLeft: 0 };
    if (user.subscriptionTier !== tierId) return { isCurrent: false, isExpired: false, daysLeft: 0 };
    if (tierId === 'free') return { isCurrent: true, isExpired: false, daysLeft: 9999 };
    if (!user.subscriptionExpires) return { isCurrent: true, isExpired: false, daysLeft: 0 };
    
    const expires = new Date(user.subscriptionExpires).getTime();
    const now = new Date().getTime();
    const diffDays = Math.ceil((expires - now) / (1000 * 60 * 60 * 24)); 

    return { isCurrent: true, isExpired: diffDays <= 0, daysLeft: diffDays > 0 ? diffDays : 0 };
  };

  // --- HANDLERS ---
  const handleUpgradeClick = (pkg: typeof dynamicPackages[0]) => {
    if (!user) return navigate('/login');
    if (pkg.price === 0) return;

    const discount = settings?.tierDiscount || 0;
    const finalPrice = pkg.price * (1 - discount / 100);

    setPaymentStep('method'); 
    setProcessingMethod(null);
    setPayOSInfo(null);
    setShowPayModal({ tier: pkg.id, price: finalPrice, name: pkg.name });
  };

  // 1. THANH TOÁN BẰNG VÍ
  const payWithWallet = async () => {
    if (!showPayModal || !user) return;
    
    // Nếu tiền không đủ -> Gợi ý nạp qua PayOS
    if (user.walletBalance < showPayModal.price) {
        showToast(`Ví thiếu ${formatPrice(showPayModal.price - user.walletBalance)}. Đang chuyển sang nạp tiền...`, "error");
        handleSelectPayOS(); // Chuyển sang PayOS ngay
        return;
    }

    setProcessingMethod('wallet');
    setLoadingPkg(showPayModal.tier);

    try {
      const res = await db.buySubscriptionWithWallet(user.id, showPayModal.tier as SubscriptionTier, showPayModal.price);
      
      if (res.success) {
        const updatedUser = await db.getCurrentUser();
        if (updatedUser) onUpdateUser(updatedUser);
        
        showToast("Nâng cấp thành công! Tận hưởng ngay.");
        setShowPayModal(null);
        setTimeout(() => navigate('/profile'), 1500);
      } else {
        showToast(res.message || "Giao dịch thất bại", "error");
      }
    } catch (error) {
      console.error(error);
      showToast("Lỗi hệ thống", "error");
    } finally {
      if(mountedRef.current) {
        setLoadingPkg(null);
        setProcessingMethod(null);
      }
    }
  };

  // 2. TẠO QR PAYOS (Thay thế chuyển khoản thủ công)
  const handleSelectPayOS = async () => {
      if (!showPayModal || !user) return;
      setProcessingMethod('transfer');
      setLoadingPkg(showPayModal.tier);
      
      try {
          // Gọi API PayOS để lấy QR chính xác
          const data = await db.createPayOSPayment(Math.round(showPayModal.price), user.id);
          setPayOSInfo(data);
          setPaymentStep('qr');
      } catch (error: any) {
          console.error(error);
          showToast(error.message || "Lỗi tạo QR PayOS", "error");
      } finally {
          if(mountedRef.current) setLoadingPkg(null);
      }
  };

  // 3. THANH TOÁN BẰNG ĐIỂM (NEW)
  const payWithPoints = async () => {
    if (!showPayModal || !user) return;
    // QUY ĐỔI: 1000 VNĐ = 10 ĐIỂM (VÍ DỤ)
    const pointsNeeded = Math.ceil(showPayModal.price / 100); 

    if ((user.pointBalance || 0) < pointsNeeded) {
        showToast(`Bạn cần ${pointsNeeded} điểm (Thiếu ${pointsNeeded - (user.pointBalance || 0)} điểm)`, "error");
        return;
    }

    if (!confirm(`Dùng ${pointsNeeded} điểm để đổi gói này?`)) return;

    setProcessingMethod('points');
    setLoadingPkg(showPayModal.tier);

    try {
        const res = await db.buySubscriptionWithPoints(user.id, showPayModal.tier as SubscriptionTier, pointsNeeded);
        if (res.success) {
            const updatedUser = await db.getCurrentUser();
            if (updatedUser) onUpdateUser(updatedUser);
            showToast("Đổi điểm thành công! Gói đã kích hoạt.");
            setShowPayModal(null);
            setTimeout(() => navigate('/profile'), 1500);
        } else {
            showToast(res.message || "Lỗi đổi điểm", "error");
        }
    } catch (error) {
        showToast("Lỗi hệ thống", "error");
    } finally {
        if(mountedRef.current) {
            setLoadingPkg(null);
            setProcessingMethod(null);
        }
    }
  };


  if (!user || !settings) {
    return (
        <div className="h-screen flex flex-col items-center justify-center font-bold text-gray-400 animate-pulse gap-4">
            <IconLoader2 className="w-10 h-10 animate-spin text-primary" />
            <span>Đang tải bảng giá...</span>
        </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-12 px-4 relative pb-24 font-sans animate-fade-in">
      
      {/* Toast */}
      {toast.show && (
        <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-[150] px-8 py-4 rounded-2xl shadow-2xl font-black text-xs uppercase tracking-widest animate-fade-in-up flex items-center gap-3 ${toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
           {toast.type === 'success' ? <IconCheckCircle className="w-5 h-5" /> : <IconAlertTriangle className="w-5 h-5" />} {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-16 space-y-6">
        <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter flex items-center justify-center gap-3">
            <IconCrown className="w-10 h-10 text-yellow-500 fill-current" /> Nâng Cấp VIP
        </h1>
        <p className="text-slate-500 max-w-2xl mx-auto text-lg leading-relaxed">
            Chọn gói phù hợp để mở khóa tính năng Video Story, ghim tin và tiếp cận hàng ngàn khách hàng.
        </p>
        
        {/* Current Plan Badge */}
        <div className="inline-flex items-center gap-3 bg-white px-6 py-3 rounded-full text-sm font-bold border-2 border-primary/20 shadow-sm">
          <div className={`flex h-2.5 w-2.5 rounded-full ${user.subscriptionTier === 'free' ? 'bg-gray-400' : 'bg-green-500 animate-pulse'}`}></div>
          <span className="text-slate-500 uppercase text-xs tracking-wider">Đang dùng:</span>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <span className="text-primary font-black uppercase">{(settings.tierConfigs as any)[user.subscriptionTier]?.name || 'Gói ẩn'}</span>
        </div>
      </div>

      {/* Pricing Grid */}
      <div className="grid md:grid-cols-3 gap-8 items-stretch">
        {dynamicPackages.map((pkg) => {
          const status = checkSubscriptionStatus(pkg.id);
          const isCurrent = status.isCurrent;
          const isRenewable = isCurrent && (status.isExpired || status.daysLeft <= 5) && pkg.id !== 'free';
          const isDisabled = isCurrent && !isRenewable && pkg.id !== 'free';
          const isFreeActive = isCurrent && pkg.id === 'free';

          const discount = settings.tierDiscount || 0;
          const finalPrice = pkg.price * (1 - discount / 100);
          const hasDiscount = discount > 0 && pkg.price > 0;

          return (
            <div key={pkg.id} className={`group relative flex flex-col p-8 md:p-10 transition-all duration-500 rounded-[3.5rem]
                    ${pkg.isPopular ? 'bg-white border-4 border-yellow-400 shadow-[0_20px_50px_rgba(234,179,8,0.2)] scale-105 z-10' : 'bg-white border-2 border-slate-100 hover:border-primary/30 hover:shadow-2xl shadow-slate-200/50'} 
                    ${isCurrent && !status.isExpired ? 'ring-2 ring-primary ring-offset-4' : ''}`}>
              {pkg.isPopular && (
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-[11px] font-black px-6 py-2 rounded-full shadow-xl uppercase tracking-[0.2em] whitespace-nowrap animate-bounce-subtle flex items-center gap-2">
                  <IconSparkles className="w-3 h-3 fill-white" /> Khuyên dùng
                </div>
              )}
              
              <div className="mb-8 text-center">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 mx-auto ${pkg.color}`}>
                    {pkg.icon}
                </div>
                <h3 className="text-xl font-black mb-4 uppercase tracking-widest text-slate-800">{pkg.name}</h3>

                <div className="flex flex-col items-center justify-center min-h-[80px]">
                  {hasDiscount ? (
                    <>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-slate-400 line-through text-sm font-bold">{formatPrice(pkg.price)}</span>
                        <span className="bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded uppercase">-{discount}%</span>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-black tracking-tighter text-slate-900">{formatPrice(finalPrice)}</span>
                        <span className="text-slate-400 text-xs font-bold uppercase">/tháng</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-black tracking-tighter text-slate-900">{pkg.price === 0 ? 'Miễn phí' : formatPrice(pkg.price)}</span>
                      {pkg.price > 0 && <span className="text-slate-400 text-xs font-bold uppercase">/tháng</span>}
                    </div>
                  )}
                </div>
              </div>

              <ul className="space-y-4 mb-10 flex-1 px-2">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {pkg.features && pkg.features.map((feat: string, i: number) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <div className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center ${pkg.id === 'pro' ? 'bg-yellow-500' : 'bg-blue-500'}`}>
                        <IconCheck className="w-2.5 h-2.5 text-white" />
                      </div>
                      <span className="text-slate-600 font-semibold leading-tight">{feat}</span>
                    </li>
                ))}
              </ul>

              <div className="space-y-4">
                  <button 
                    disabled={isDisabled || isFreeActive || loadingPkg === pkg.id} 
                    onClick={() => handleUpgradeClick(pkg)} 
                    className={`w-full py-5 rounded-2xl font-black text-sm uppercase tracking-[0.1em] transition-all duration-300 transform active:scale-95 shadow-xl flex items-center justify-center gap-2
                        ${(isDisabled || isFreeActive) ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none' : `${pkg.btnColor} hover:brightness-110 hover:-translate-y-1`}`}
                  >
                    {loadingPkg === pkg.id && <IconLoader2 className="w-4 h-4 animate-spin" />}
                    {isFreeActive ? 'Đang sử dụng' : isRenewable ? 'Gia hạn ngay' : isDisabled ? 'Đang sử dụng' : 'Nâng cấp ngay'}
                  </button>
                  
                  {isCurrent && pkg.id !== 'free' && (
                      <div className={`flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-[10px] font-black uppercase tracking-wider bg-white border-2 
                        ${status.isExpired || status.daysLeft < 3 ? 'text-red-500 border-red-100 animate-pulse' : 'text-slate-500 border-slate-100'}`}>
                          {status.isExpired 
                            ? <><IconX className="w-3 h-3" /> Hết hạn</> 
                            : <><IconClock className="w-3 h-3" /> Còn {status.daysLeft} ngày</>}
                      </div>
                  )}
              </div>
            </div>
          );
        })}
      </div>

      {/* --- PAYMENT MODAL --- */}
      {showPayModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fade-in" onClick={() => setShowPayModal(null)}>
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-10 shadow-2xl relative space-y-8 animate-fade-in-up border border-white" onClick={e => e.stopPropagation()}>
            
            <button onClick={() => setShowPayModal(null)} className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-100 text-slate-400 transition-colors">
                <IconX className="w-5 h-5" />
            </button>

            <div className="text-center">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-2">
                    {paymentStep === 'method' ? 'Bước 1: Chọn thanh toán' : 'Bước 2: Quét mã PayOS'}
                </p>
                <h3 className="text-2xl font-black text-slate-900">{showPayModal.name}</h3>
                <div className="mt-4 flex flex-col items-center">
                    <span className="text-3xl font-black text-primary">{formatPrice(showPayModal.price)}</span>
                    <p className="text-xs font-bold text-slate-400 mt-1">Số dư ví: {formatPrice(user.walletBalance)}</p>
                </div>
            </div>
            
            {/* STEP 1: Chọn phương thức */}
            {paymentStep === 'method' && (
                <div className="space-y-4">
                  {/* Nút 1: Thanh toán ví */}
                  <button onClick={payWithWallet} disabled={loadingPkg !== null} className={`w-full flex items-center justify-between p-5 border-2 rounded-[2rem] transition-all group active:scale-95 ${processingMethod === 'wallet' ? 'border-primary bg-primary/5' : 'border-slate-100 hover:border-primary hover:shadow-md'}`}>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center text-2xl shadow-sm group-hover:scale-110 transition-transform">
                          <IconWallet className="w-6 h-6" />
                      </div>
                      <div className="text-left">
                        <p className="text-[10px] font-black uppercase text-slate-400">Dùng tiền trong Ví</p>
                        <p className="text-xs font-black text-slate-800">Số dư: {formatPrice(user.walletBalance)}</p>
                      </div>
                    </div>
                    {processingMethod === 'wallet' ? <IconLoader2 className="w-5 h-5 text-primary animate-spin" /> : <div className="w-6 h-6 rounded-full border-2 border-slate-200 group-hover:border-primary"></div>}
                  </button>

                  {/* Nút 2: Đổi bằng Điểm */}
                  <button onClick={payWithPoints} disabled={loadingPkg !== null} className={`w-full flex items-center justify-between p-5 border-2 rounded-[2rem] transition-all group active:scale-95 ${processingMethod === 'points' ? 'border-yellow-500 bg-yellow-50' : 'border-slate-100 hover:border-yellow-500 hover:shadow-md'}`}>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-yellow-100 text-yellow-600 flex items-center justify-center text-2xl shadow-sm group-hover:scale-110 transition-transform">
                          <IconStar className="w-6 h-6" />
                      </div>
                      <div className="text-left">
                        <p className="text-[10px] font-black uppercase text-slate-400">Đổi bằng Điểm thưởng</p>
                        <p className="text-xs font-black text-slate-800">Có: {user.pointBalance || 0} điểm</p>
                      </div>
                    </div>
                    {processingMethod === 'points' ? <IconLoader2 className="w-5 h-5 text-yellow-600 animate-spin" /> : <div className="w-6 h-6 rounded-full border-2 border-slate-200 group-hover:border-yellow-500"></div>}
                  </button>

                  {/* Nút 3: Nạp tiền qua PayOS */}
                  <button onClick={handleSelectPayOS} disabled={loadingPkg !== null} className={`w-full flex items-center justify-between p-5 border-2 rounded-[2rem] transition-all group active:scale-95 border-slate-100 hover:border-purple-500 hover:shadow-md`}>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-500 flex items-center justify-center text-2xl shadow-sm group-hover:scale-110 transition-transform">
                          <IconLandmark className="w-6 h-6" />
                      </div>
                      <div className="text-left">
                        <p className="text-[10px] font-black uppercase text-slate-400">Thiếu tiền?</p>
                        <p className="text-xs font-black text-slate-800">Nạp nhanh qua PayOS</p>
                      </div>
                    </div>
                    {processingMethod === 'transfer' ? <IconLoader2 className="w-5 h-5 text-purple-600 animate-spin" /> : <div className="w-6 h-6 rounded-full border-2 border-slate-200 group-hover:border-purple-500"><IconChevronRight className="w-4 h-4 text-white" /></div>}
                  </button>
                </div>
            )}

            {/* STEP 2: QR PayOS */}
            {paymentStep === 'qr' && payOSInfo && (
                <div className="space-y-6 animate-fade-in-up">
                    <div className="bg-slate-50 p-4 rounded-[2rem] border border-slate-100 flex flex-col items-center text-center space-y-4">
                        <div className="p-2 bg-white rounded-2xl shadow-sm">
                            <img 
                                src={`https://img.vietqr.io/image/${payOSInfo.bin}-${payOSInfo.accountNumber}-compact.png?amount=${payOSInfo.amount}&addInfo=${encodeURIComponent(payOSInfo.description)}&accountName=${encodeURIComponent(payOSInfo.accountName)}`}
                                alt="VietQR" 
                                className="w-48 h-48 object-contain mix-blend-multiply" 
                            />
                        </div>
                        <div className="space-y-1 w-full">
                            <p className="text-[10px] font-black text-slate-400 uppercase">Nội dung chuyển khoản</p>
                            <p className="text-xs font-black bg-yellow-100 text-yellow-800 px-3 py-1.5 rounded-lg select-all break-all border border-yellow-200">{payOSInfo.description}</p>
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium px-4 flex items-center gap-2">
                            <IconClock className="w-3 h-3 animate-pulse text-green-500" /> 
                            Đang chờ thanh toán... Hệ thống tự động xử lý.
                        </div>
                    </div>
                    
                    <a 
                        href={payOSInfo.checkoutUrl}
                        target="_blank" 
                        rel="noreferrer"
                        className="w-full bg-green-500 text-white font-black py-4 rounded-[1.5rem] hover:bg-green-600 transition-all shadow-lg active:scale-95 uppercase text-xs tracking-widest flex items-center justify-center gap-2"
                    >
                        <IconCheckCircle className="w-4 h-4" /> Mở App Ngân Hàng
                    </a>
                </div>
            )}

            {paymentStep === 'qr' && (
                <button onClick={() => setPaymentStep('method')} className="w-full py-4 rounded-xl font-black text-xs text-slate-400 uppercase hover:bg-slate-50 transition-all tracking-widest">
                    Quay lại chọn phương thức
                </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Subscription;