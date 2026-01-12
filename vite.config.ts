import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load toàn bộ biến môi trường từ hệ thống
  const env = loadEnv(mode, process.cwd(), '');

  return {
    // 1. Đường dẫn gốc (Bắt buộc để chạy trên Vercel)
    base: '/',

    plugins: [react()],

    server: {
      port: 3000,
      host: '0.0.0.0',
    },

    // 2. [QUAN TRỌNG] Cấu hình biến môi trường
    // Vì bạn đã đặt tên là VITE_GEMINI_API_KEY trên Vercel,
    // ta cần đảm bảo code đọc đúng biến này.
    define: {
      // Dòng này đảm bảo biến VITE_ không bị ghi đè bởi undefined
      'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY),
      // Fallback cho các thư viện cũ dùng process.env
      'process.env.API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY),
    },

    resolve: {
      alias: {
        // 3. Trỏ @ về thư mục gốc (.) vì bạn không dùng thư mục src
        '@': path.resolve(__dirname, '.'), 
      }
    },

    build: {
      outDir: 'dist',
    }
  };
});
