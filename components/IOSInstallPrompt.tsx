
import React, { useState, useEffect } from 'react';

const IOSInstallPrompt: React.FC = () => {
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Kiểm tra xem có phải iOS không
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    
    // Kiểm tra xem đã ở chế độ standalone (đã cài đặt) chưa
    const isStandalone = (window.navigator as any).standalone || window.matchMedia('(display-mode: standalone)').matches;

    // Kiểm tra xem người dùng đã đóng prompt này chưa trong phiên này
    const hasPrompted = localStorage.getItem('iosPwaPromptDismissed');

    if (isIOS && !isStandalone && !hasPrompted) {
      // Hiển thị sau 3 giây để người dùng không bị ngợp
      const timer = setTimeout(() => setShowPrompt(true), 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('iosPwaPromptDismissed', 'true');
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 z-[100] animate-fade-in-up">
      <div className="bg-white/95 backdrop-blur-xl border border-primary/20 rounded-[2.5rem] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.15)] relative">
        <button 
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-gradient-to-tr from-primary to-blue-400 rounded-2xl flex items-center justify-center text-white text-3xl shadow-lg shadow-primary/25 shrink-0">
            ⚡
          </div>
          <div className="space-y-1">
            <h3 className="font-black text-sm text-textMain uppercase tracking-tight">Cài đặt Chợ Của Tui</h3>
            <p className="text-[11px] text-gray-500 font-medium leading-relaxed">Để trải nghiệm mượt mà như ứng dụng thật và nhận thông báo mới nhất.</p>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-100 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-lg">1️⃣</div>
            <p className="text-xs font-bold text-gray-600">Nhấn vào biểu tượng <span className="inline-block mx-1"><svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg></span> (Chia sẻ) ở thanh công cụ dưới Safari.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-lg">2️⃣</div>
            <p className="text-xs font-bold text-gray-600">Kéo xuống và chọn <span className="text-primary font-black uppercase tracking-tighter">"Thêm vào MH chính"</span>.</p>
          </div>
        </div>

        <div className="mt-4 flex justify-center">
            <div className="animate-bounce">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
            </div>
        </div>
      </div>
    </div>
  );
};

export default IOSInstallPrompt;
