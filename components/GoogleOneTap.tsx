import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/db';

const GoogleOneTap: React.FC = () => {
  const navigate = useNavigate();
  const isInitialized = useRef(false);

  useEffect(() => {
    // 1. Nếu đã chạy rồi thì thôi, tránh React Strict Mode gọi 2 lần
    if (isInitialized.current) return;
    isInitialized.current = true;

    const handleGoogleOneTap = () => {
      if (!window.google) return;

      // 2. Cấu hình
      window.google.accounts.id.initialize({
        client_id: "YOUR_GOOGLE_CLIENT_ID", // <-- NHỚ ĐỔI LẠI CLIENT ID CỦA BẠN
        callback: async (response: any) => {
          try {
            console.log("Đăng nhập Google thành công:", response);
            await db.loginWithOneTap(response.credential);
            // Đăng nhập xong thì reload trang để cập nhật state user
            window.location.reload(); 
          } catch (error) {
            console.error("Lỗi xử lý đăng nhập:", error);
          }
        },
        auto_select: false,
        cancel_on_tap_outside: false,
        use_fedcm_for_prompt: true, // Chuẩn mới của trình duyệt
      });

      // 3. Hiển thị Popup (Thêm try/catch để bắt lỗi Abort)
      try {
        window.google.accounts.id.prompt((notification: any) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            console.log("One Tap không hiện vì:", notification.getNotDisplayedReason());
            
            // Xử lý cookies nếu bị chặn (tùy chọn)
            if (notification.getNotDisplayedReason() === "suppressed_by_user") {
                // User đã tắt popup này trước đó -> Google sẽ không hiện lại trong 2 tiếng (Cool-down period)
                console.log("User đã tắt popup, cần xóa cookie g_state để hiện lại ngay lập tức nếu muốn test.");
                document.cookie = `g_state=;path=/;expires=Thu, 01 Jan 1970 00:00:01 GMT;`;
            }
          }
        });
      } catch (error) {
        // Bắt lỗi AbortError để không hiện đỏ lòm trong console
        console.warn("One Tap Prompt Error (có thể bỏ qua):", error);
      }
    };

    // 4. Load Script
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

    // 5. Cleanup: Chỉ cancel nếu thực sự cần thiết khi component unmount hẳn
    return () => {
      // Trong môi trường Dev, việc cancel() này gây ra lỗi AbortError
      // Nhưng trong Production nó giúp tránh memory leak.
      // Chúng ta có thể giữ nguyên, lỗi này vô hại.
      if (window.google) {
        // window.google.accounts.id.cancel(); 
      }
    };
  }, [navigate]);

  return null;
};

export default GoogleOneTap;
