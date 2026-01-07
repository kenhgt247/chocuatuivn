import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/db';

// --- QUAN TRỌNG: Khai báo Window.google để TypeScript không báo lỗi ---
declare global {
  interface Window {
    google: any;
  }
}

const GoogleOneTap: React.FC = () => {
  const navigate = useNavigate();
  // Dùng ref để đảm bảo code chỉ chạy 1 lần duy nhất (Fix lỗi React Strict Mode)
  const isInitialized = useRef(false);

  useEffect(() => {
    // 1. Kiểm tra nếu đã chạy rồi thì dừng lại ngay
    if (isInitialized.current) return;
    isInitialized.current = true;

    const handleGoogleOneTap = () => {
      // Đảm bảo thư viện Google đã tải xong
      if (!window.google) return;

      // 2. Cấu hình Google One Tap
      window.google.accounts.id.initialize({
        client_id: "373357283352-d756his44ie84b014r4jus4lr9i03jik.apps.googleusercontent.com", // <--- ⚠️ HÃY THAY MÃ CLIENT ID THẬT CỦA BẠN VÀO ĐÂY
        callback: async (response: any) => {
          try {
            console.log("Đăng nhập Google thành công:", response);
            
            // Gọi hàm xử lý đăng nhập phía Firebase
            await db.loginWithOneTap(response.credential);
            
            // Đăng nhập xong thì reload lại trang để cập nhật giao diện User
            window.location.reload(); 
          } catch (error) {
            console.error("Lỗi xử lý đăng nhập:", error);
          }
        },
        auto_select: false, // Tắt tự động chọn tài khoản để tránh vòng lặp
        cancel_on_tap_outside: false, // Bắt buộc user phải chọn hoặc tắt hẳn
        use_fedcm_for_prompt: true, // Sử dụng chuẩn bảo mật mới của trình duyệt
      });

      // 3. Hiển thị Popup
      try {
        window.google.accounts.id.prompt((notification: any) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            console.log("One Tap không hiện vì:", notification.getNotDisplayedReason());
            
            // Logic phụ: Xử lý xóa cookie nếu bị Google chặn do user tắt thủ công (suppressed_by_user)
            // Giúp dev test dễ hơn, user thật thì không ảnh hưởng nhiều
            if (notification.getNotDisplayedReason() === "suppressed_by_user") {
                console.log("User đã tắt popup trước đó. Đang reset cookie g_state để hiện lại...");
                document.cookie = `g_state=;path=/;expires=Thu, 01 Jan 1970 00:00:01 GMT;`;
            }
          }
        });
      } catch (error) {
        // Bắt lỗi AbortError vô hại để console sạch sẽ hơn
        console.warn("One Tap Prompt Warning:", error);
      }
    };

    // 4. Tải script Google từ CDN nếu chưa có
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
      // Nếu script đã có sẵn trong trang, gọi hàm luôn
      handleGoogleOneTap();
    }

    // 5. Cleanup function
    return () => {
      // Không cần gọi cancel() ở đây để tránh lỗi AbortError không cần thiết trong môi trường Dev
    };
  }, [navigate]);

  return null; // Component này không có giao diện (UI-less)
};

export default GoogleOneTap;
