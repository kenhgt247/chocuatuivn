import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/db';

const GoogleOneTap: React.FC = () => {
  const navigate = useNavigate();
  // Dùng ref để kiểm tra xem đã khởi tạo chưa (tránh React chạy 2 lần)
  const isInitialized = useRef(false);

  useEffect(() => {
    // Nếu đã chạy rồi thì dừng ngay, không chạy lại
    if (isInitialized.current) return;
    isInitialized.current = true;

    const handleGoogleOneTap = () => {
      // Kiểm tra Google script đã tải xong chưa
      if (!window.google) return;

      // 1. Khởi tạo cấu hình
      window.google.accounts.id.initialize({
        client_id: "YOUR_GOOGLE_CLIENT_ID", // <--- NHỚ THAY CLIENT ID CỦA BẠN VÀO ĐÂY
        callback: async (response: any) => {
          try {
            console.log("Google response:", response);
            // Gọi hàm login bên db.ts
            await db.loginWithOneTap(response.credential);
            // Đăng nhập xong thì reload hoặc về trang chủ
            window.location.reload(); 
          } catch (error) {
            console.error("Login Failed:", error);
          }
        },
        // Tắt tự động chọn để tránh vòng lặp nếu user logout
        auto_select: false, 
        cancel_on_tap_outside: false,
        // Quan trọng: fix lỗi FedCM hiển thị trên một số trình duyệt mới
        use_fedcm_for_prompt: true 
      });

      // 2. Hiển thị Popup (Bọc trong try catch để tránh lỗi "Only one request")
      try {
        window.google.accounts.id.prompt((notification: any) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            console.log("One Tap không hiển thị vì:", notification.getNotDisplayedReason());
          }
        });
      } catch (err) {
        console.warn("One Tap prompt error (có thể do gọi 2 lần):", err);
      }
    };

    // 3. Tải script Google (nếu chưa có)
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
      // Nếu script đã có sẵn, gọi luôn hàm xử lý
      handleGoogleOneTap();
    }

    // Cleanup function: Tắt prompt khi component bị hủy (chuyển trang)
    return () => {
      if (window.google) {
        window.google.accounts.id.cancel();
      }
    };
  }, [navigate]);

  return null;
};

export default GoogleOneTap;
