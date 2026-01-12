import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load toàn bộ biến môi trường (bao gồm cả GEMINI_API_KEY trên Vercel)
  const env = loadEnv(mode, process.cwd(), '');

  return {
    // 1. Đường dẫn gốc tuyệt đối
    base: '/',

    plugins: [react()],

    server: {
      port: 3000,
      host: '0.0.0.0',
    },

    // 2. [QUAN TRỌNG] Ánh xạ Key từ Vercel vào code
    // Code đang tìm "VITE_GEMINI_API_KEY", nhưng trên Vercel bạn đặt là "GEMINI_API_KEY"
    // Đoạn này sẽ nối chúng lại với nhau.
    define: {
      'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },

    resolve: {
      alias: {
        // 3. [QUAN TRỌNG] Vì không có thư mục src, dấu @ phải trỏ về thư mục gốc (.)
        '@': path.resolve(__dirname, '.'), 
      }
    },

    build: {
      outDir: 'dist',
    }
  };
});
