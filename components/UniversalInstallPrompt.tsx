import React, { useState, useEffect } from 'react';

const UniversalInstallPrompt: React.FC = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android-pc' | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalling, setIsInstalling] = useState(false); // [MỚI] Trạng thái đang cài đặt

  useEffect(() => {
    // Logic kiểm tra PWA đã cài đặt chưa
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    if (isStandalone) return;

    // Kiểm tra iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

    // Logic kiểm tra xem người dùng đã đóng prompt chưa và thời gian đóng
    const dismissedTimestamp = localStorage.getItem('pwaPromptDismissed');
    const now = Date.now();
    // Nếu đã đóng, chỉ hiện lại sau 7 ngày (7 * 24 * 60 * 60 * 1000 ms)
    if (dismissedTimestamp && now - parseInt(dismissedTimestamp) < 7 * 24 * 60 * 60 * 1000) {
        return;
    }

    if (isIOS) {
      setPlatform('ios');
      // Delay hiển thị để không che khuất nội dung chính ngay khi vào trang
      const timer = setTimeout(() => setShowPrompt(true), 5000); 
      return () => clearTimeout(timer);
    } else {
      // Xử lý sự kiện cho Android & PC
      const handleBeforeInstallPrompt = (e: any) => {
        e.preventDefault(); // Ngăn trình duyệt hiển thị prompt mặc định xấu xí
        setDeferredPrompt(e);
        setPlatform('android-pc');
        const timer = setTimeout(() => setShowPrompt(true), 5000);
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      
      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      };
    }
  }, []);

  const handleDismiss = () => {
    setShowPrompt(false);
    // Lưu thời điểm đóng để tính toán thời gian hiển thị lại
    localStorage.setItem('pwaPromptDismissed', Date.now().toString());
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    setIsInstalling(true);
    
    // Hiển thị prompt cài đặt native
    deferredPrompt.prompt();
    
    // Đợi người dùng phản hồi
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setShowPrompt(false);
      setDeferredPrompt(null); // Clear prompt sau khi cài đặt thành công
    }
    
    setIsInstalling(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 z-[100] animate-fade-in-up">
      <div className="bg-white/95 backdrop-blur-xl border border-primary/20 rounded-[2.5rem] p-6 shadow-[0_25px_60px_rgba(0,0,0,0.2)] relative max-w-md mx-auto">
        <button 
          onClick={handleDismiss}
          className="absolute top-5 right-5 p-2 text-gray-400 hover:text-gray-600 transition-colors bg-gray-50 rounded-full hover:bg-gray-100"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-gradient-to-tr from-primary to-blue-400 rounded-[1.5rem] flex items-center justify-center text-white text-3xl shadow-lg shadow-primary/25 shrink-0 animate-bounce-slow">
            ⚡
          </div>
          <div className="space-y-1">
            <h3 className="font-black text-sm text-textMain uppercase tracking-tight">Cài đặt Chợ Của Tui</h3>
            <p className="text-[11px] text-gray-500 font-medium leading-relaxed">
              Trải nghiệm mượt mà hơn, nhanh hơn và luôn cập nhật tin đăng mới nhất.
            </p>
          </div>
        </div>

        {platform === 'ios' ? (
          <div className="mt-6 pt-6 border-t border-gray-100 space-y-4">
            <div className="flex items-center gap-4 bg-bgMain/50 p-3 rounded-2xl">
              <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-xs font-black text-primary">1</div>
              <p className="text-[11px] font-bold text-gray-600">
                Nhấn biểu tượng <span className="inline-block mx-1 align-middle"><svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg></span> trên thanh công cụ Safari.
              </p>
            </div>
            <div className="flex items-center gap-4 bg-bgMain/50 p-3 rounded-2xl">
              <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-xs font-black text-primary">2</div>
              <p className="text-[11px] font-bold text-gray-600">
                Chọn <span className="text-primary font-black uppercase tracking-tighter">"Thêm vào MH chính"</span> (Add to Home Screen).
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-6">
            <button 
              onClick={handleInstallClick}
              disabled={isInstalling}
              className="w-full bg-primary text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 hover:bg-primaryHover transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-wait"
            >
              {isInstalling ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Đang cài đặt...
                  </>
              ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Cài đặt ứng dụng ngay
                  </>
              )}
            </button>
            <p className="text-center text-[9px] text-gray-400 font-bold mt-4 uppercase tracking-widest italic">Chỉ tốn 3 giây - Không tốn dung lượng</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UniversalInstallPrompt;
