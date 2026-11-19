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
      fontFamily: { sans: ['"Be Vietnam Pro"', 'system-ui', 'sans-serif'] },
      colors: {
        // Bảng màu Chợ Của Tui: xanh lá đậm, vàng nắng, nền kem
        primary: '#1F6F43',
        primaryHover: '#123524',
        textMain: '#1D2A22',
        bgMain: '#FBF7EE',
        cream: '#FBF7EE',
        ink: '#1D2A22',
        line: '#E7E0D0',
        sun: { DEFAULT: '#F2B33D', light: '#FCEFD2', dark: '#7A4B00' },
        // Ghi đè dải emerald để mọi trang dùng cùng tông xanh lá của thiết kế
        emerald: {
          50: '#EEF6F0', 100: '#DCEFE2', 200: '#BFDDC8', 300: '#93C5A2', 400: '#5FA578',
          500: '#3A8A5A', 600: '#2A7D4E', 700: '#1F6F43', 800: '#185A36', 900: '#123524', 950: '#0B2117',
        },
      }
    },
  },
  plugins: [],
}