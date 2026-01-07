import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/db';

// Khai báo type cho window.google để không bị lỗi TypeScript
declare global {
  interface Window {
    google: any;
  }
}

const GoogleOneTap: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Nếu người dùng đã đăng nhập (kiểm tra qua localStorage hoặc state cha), bạn có thể return để không hiện popup
    // Tuy nhiên, One Tap thông minh, nó sẽ tự ẩn nếu đã đăng nhập google nhưng logic ứng dụng cần chặt chẽ.

    const handleGoogleOneTap = () => {
      if (!window.google) return;

      window.google.accounts.id.initialize({
        client_id: "373357283352-d756his44ie84b014r4jus4lr9i03jik.apps.googleusercontent.com", // <--- DÁN CLIENT ID VÀO ĐÂY
        callback: async (response: any) => {
          try {
            // response.credential chính là ID Token
            const user = await db.loginWithOneTap(response.credential);
            console.log("One Tap Login Success:", user);
            
            // Reload hoặc điều hướng sau khi đăng nhập thành công
            // Vì App.tsx của bạn dùng onAuthStateChanged nên UI sẽ tự cập nhật, 
            // nhưng an toàn thì chuyển hướng về Home hoặc reload.
            navigate('/'); 
            // Hoặc window.location.reload(); nếu state không tự cập nhật
          } catch (error) {
            console.error("One Tap Error:", error);
          }
        },
        // Tắt tự động chọn tài khoản để tránh loop nếu user muốn logout
        auto_select: false, 
        cancel_on_tap_outside: false
      });

      // Hiển thị popup
      window.google.accounts.id.prompt((notification: any) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          console.log("One Tap skipped/not displayed reason:", notification.getNotDisplayedReason());
        }
      });
    };

    // Tải script Google Identity Services
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = handleGoogleOneTap;
    document.body.appendChild(script);

    return () => {
      // Cleanup script khi component unmount
      document.body.removeChild(script);
    };
  }, [navigate]);

  return null; // Component này không render UI gì cả, nó chỉ gọi popup của Google
};

export default GoogleOneTap;