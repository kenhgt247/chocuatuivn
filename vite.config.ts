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
        // Tách thư viện ít thay đổi ra tệp riêng: lần cập nhật web sau, máy người dùng
        // dùng lại bản đã lưu, chỉ tải phần mã mới.
        output: {
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return undefined;
            if (/[\\/]node_modules[\\/](@firebase|firebase)[\\/](storage|messaging|installations)/.test(id)) return undefined; // tải khi cần
            if (/[\\/]node_modules[\\/](@firebase|firebase|idb)[\\/]/.test(id)) return 'firebase';
            if (/[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom|react-helmet-async)[\\/]/.test(id)) return 'react';
            return undefined;
          },
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
