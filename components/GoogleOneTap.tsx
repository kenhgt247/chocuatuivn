import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { User } from '../types';

// Khai báo để TypeScript không báo lỗi
declare global {
  interface Window {
    google: any;
  }
}

// Thêm prop onLogin để cập nhật trạng thái ngay lập tức mà không cần reload
interface GoogleOneTapProps {
    onLogin?: (user: User) => void;
}

const GoogleOneTap: React.FC<GoogleOneTapProps> = ({ onLogin }) => {
  const navigate = useNavigate();
  const isInitialized = useRef(false);
  const [isLoading, setIsLoading] = useState(false); // State để hiện loading

  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    const handleGoogleOneTap = () => {
      if (!window.google) return;

      window.google.accounts.id.initialize({
        client_id: "373357283352-d756his44ie84b014r4jus4lr9i03jik.apps.googleusercontent.com", // <--- ⚠️ ĐỪNG QUÊN THAY CLIENT ID CỦA BẠN VÀO ĐÂY
        callback: async (response: any) => {
          try {
            // 1. Bắt đầu Loading ngay khi nhận được phản hồi từ Google
            setIsLoading(true);
            console.log("Đang xử lý đăng nhập Google...");
            
            // 2. Gọi API đăng nhập
            const user = await db.loginWithOneTap(response.credential);
            
            // 3. Cập nhật User vào App ngay lập tức (Không cần Reload)
            if (onLogin) {
                onLogin(user);
            } else {
                // Fallback nếu không truyền onLogin thì mới reload
                window.location.reload();
            }

          } catch (error) {
            console.error("Lỗi xử lý đăng nhập:", error);
            setIsLoading(false); // Tắt loading nếu lỗi
          }
        },
        auto_select: false,
        cancel_on_tap_outside: false,
        use_fedcm_for_prompt: true,
      });

      try {
        window.google.accounts.id.prompt((notification: any) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            console.log("One Tap skipped:", notification.getNotDisplayedReason());
            if (notification.getNotDisplayedReason() === "suppressed_by_user") {
                document.cookie = `g_state=;path=/;expires=Thu, 01 Jan 1970 00:00:01 GMT;`;
            }
          }
        });
      } catch (error) {
        console.warn("Prompt Warning:", error);
      }
    };

    const scriptUrl = 'https://accounts.google.com/gsi/client';
    const existingScript = document.querySelector(`script[src="${scriptUrl}"]`);

    if (!existingScript) {
      const script = document.createElement('script');
      script.src = scriptUrl;
      script.async = true;
      script.defer = true;
      script.onload = handleGoogleOneTap;
      document.body.appendChild(script);
    } else {
      handleGoogleOneTap();
    }

    return () => {};
  }, [navigate, onLogin]);

  // Nếu đang xử lý đăng nhập, hiển thị màn hình Loading đè lên
  if (isLoading) {
      return (
        <div className="fixed inset-0 z-[9999] bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-primary font-bold animate-pulse">Đang đăng nhập...</p>
        </div>
      );
  }

  return null;
};

export default GoogleOneTap;
