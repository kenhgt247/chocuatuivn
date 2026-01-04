/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",             // Quét các file App.tsx, index.tsx ở gốc
    "./pages/**/*.{js,ts,jsx,tsx}",    // Quét thư mục pages
    "./components/**/*.{js,ts,jsx,tsx}", // Quét thư mục components
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1677ff',  // Màu Cam chủ đạo
        bgMain: '#F8F9FA',   // Màu nền Xám nhạt
      }
    },
  },
  plugins: [],
}