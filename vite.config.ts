import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load các biến môi trường
  const env = loadEnv(mode, process.cwd(), '');

  return {
    // 1. Base nên để '/' nếu deploy tên miền riêng hoặc Vercel gốc
    base: '/',

    plugins: [react()],

    // 2. Xử lý lỗi MIME type bằng cách chỉ định rõ file root
    root: './', 

    server: {
      port: 3000,
      host: '0.0.0.0',
      // Tự động mở trình duyệt khi chạy npm run dev
      open: true,
    },

    // Không đưa khóa Gemini vào code trình duyệt (ai cũng đọc được).

    resolve: {
      alias: {
        // Trỏ @ về thư mục hiện tại (nơi chứa index.jsx của bạn)
        '@': path.resolve(__dirname, './'),
      },
    },

    build: {
      outDir: 'dist',
      // Loại bỏ Puppeteer khỏi bundle vì nó chỉ chạy trên Node.js (Server)
      // Nếu bạn không dùng nó ở Client, tốt nhất nên uninstall nó
      rollupOptions: {
        external: ['puppeteer'],
        input: {
          main: path.resolve(__dirname, 'index.html'),
        },
      },
      // Tăng giới hạn cảnh báo kích thước file nếu cần
      chunkSizeWarningLimit: 1000,
    },

    // 3. Quan trọng: Tối ưu hóa việc nạp dependency
    optimizeDeps: {
      exclude: ['puppeteer'], // Không cố gắng tối ưu hóa thư viện server-side
    },
  };
});
